import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { warnOnce } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';
import { ChevronRightIcon } from '../../lib/icons';
import {
  MenuSubmenuTriggerContext,
  useMenuListContext,
  useOptionalMenuContext,
} from './Menu.context';
import { menuItemClasses } from './Menu.shared';

/** Properties for the MenuItem sub-component. */
export interface MenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Slot for an icon displayed before the item text. Rendered with `aria-hidden="true"`. A falsy
   * icon (`''`, `0`) or a list of nothing renders no icon box.
   */
  icon?: Slot<'span'>;
  /** Keyboard shortcut text displayed at the end of the item. */
  shortcut?: string;
  /** Whether the menu item is disabled (`aria-disabled`; skipped by keyboard navigation). */
  disabled?: boolean;
  /**
   * Keep a popup menu open after this item is activated. `true` or `false` here wins over the
   * Menu's `persistOnItemClick`.
   * @default the Menu's `persistOnItemClick` (`false`)
   */
  persistOnClick?: boolean;
  /**
   * Label content of the menu item. Leave it out only for the submenu half of a
   * `Menu.SplitGroup`, which then needs `aria-label`.
   */
  children?: React.ReactNode;
  /** Ref to the `role="menuitem"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the MenuDivider sub-component. */
export interface MenuDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the `role="separator"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

// ---------------------------------------------------------------------------
// The item row and the column alignment
// ---------------------------------------------------------------------------

/** Internal: the content of one menu item row, rendered inside the item element. */
export interface MenuItemRowProps {
  /**
   * Checkable items: the checkmark column's content (the glyph, or `null` while unchecked); the
   * column renders in both states, marked `data-menu-checkmark`. `undefined` for other items,
   * which render a hidden placeholder instead.
   */
  checkmark?: React.ReactNode | null;
  /** The icon slot (a falsy icon or a list of nothing is no icon). */
  icon?: Slot<'span'>;
  /** The label (typeahead reads a non-string label through its `data-menu-label` element). */
  label: React.ReactNode;
  /** The shortcut text. */
  shortcut?: string;
  /** Content at the row's end: the submenu chevron or a switch. */
  end?: React.ReactNode;
  /**
   * Whether a non-string label is marked `data-menu-label` for typeahead. Pass `false` when the
   * item carries its own `data-roving-text`, which the label's text must not replace.
   * @default true
   */
  markLabel?: boolean;
}

/**
 * The placeholder of the checkmark or the icon column: hidden, and shown as soon as any item of
 * the same menu list (the `group/menu` element) renders that column, so every label starts at the
 * same place. Decorative (`aria-hidden`).
 */
function renderColumnSpace(column: 'checkmark' | 'icon'): React.ReactElement {
  return column === 'checkmark' ? (
    <span
      aria-hidden="true"
      data-menu-column-space="checkmark"
      className="hidden w-4 shrink-0 group-has-[[data-menu-checkmark]]/menu:inline-flex"
    />
  ) : (
    <span
      aria-hidden="true"
      data-menu-column-space="icon"
      className="hidden h-5 w-5 shrink-0 group-has-[[data-menu-icon]]/menu:inline-flex"
    />
  );
}

/**
 * Internal: one menu item row, in DOM order (RTL mirrors it): the checkmark column, the icon
 * column, the label, the shortcut and the end content. A row without a checkmark or an icon
 * renders the column's placeholder instead; a row whose label renders nothing (the icon-only
 * submenu half of a split group) renders no placeholders.
 */
export function MenuItemRow({
  checkmark,
  icon,
  label,
  shortcut,
  end,
  markLabel = true,
}: MenuItemRowProps): React.ReactElement {
  // The check does not consume a one-shot iterable label: it is rendered materialised.
  const hasLabel = slotRendersContent(label);
  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in Nav,
  // Tree and Avatar, and so is a collection whose items render nothing: no empty 20px box before
  // the label. The check does not consume a generator: renderSlot still renders its items.
  const iconNode =
    icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', 'flex h-5 w-5 shrink-0 items-center justify-center', {
          'aria-hidden': true,
          'data-menu-icon': '',
        })
      : null;

  return (
    <>
      {checkmark !== undefined ? (
        <span
          aria-hidden="true"
          data-menu-checkmark=""
          className="inline-flex w-4 shrink-0 items-center justify-center"
        >
          {checkmark}
        </span>
      ) : (
        hasLabel && renderColumnSpace('checkmark')
      )}
      {iconNode ?? (hasLabel && renderColumnSpace('icon'))}
      <span
        className="flex-1"
        data-menu-label={markLabel && typeof label !== 'string' ? '' : undefined}
      >
        {materialiseSlotContent(label)}
      </span>
      {shortcut && <span className="ms-4 text-caption-1 text-muted-foreground">{shortcut}</span>}
      {end}
    </>
  );
}
MenuItemRow.displayName = 'MenuItemRow';

/** Internal: the two column placeholders alone, for a row that is not an item (a group header). */
export function MenuColumnSpacers(): React.ReactElement {
  return (
    <>
      {renderColumnSpace('checkmark')}
      {renderColumnSpace('icon')}
    </>
  );
}
MenuColumnSpacers.displayName = 'MenuColumnSpacers';

// ---------------------------------------------------------------------------
// Item activation
// ---------------------------------------------------------------------------

/** Internal: the activation of every menu item kind. */
export interface MenuItemActivationOptions {
  disabled: boolean;
  /**
   * The item's own `persistOnClick`; `undefined` falls back to the Menu's `persistOnItemClick`.
   * A link item passes `false` (a link always closes).
   */
  persistOnClick: boolean | undefined;
  /** The consumer's handlers, composed consumer first (C-COMPOSE). */
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  /**
   * Runs on an own, enabled click after the consumer's `onClick`, unless it prevented the default.
   * Its own `preventDefault()` keeps the menu open.
   */
  onActivate?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Space activates and keeps the menu open (checkbox, radio and switch items). */
  keepOpenOnSpace?: boolean;
  /** Enter is left to the element's native activation (links); Space still clicks. */
  nativeEnter?: boolean;
  /** The item opens a submenu: activation never closes its menu. */
  hasSubmenu?: boolean;
}

/**
 * Internal: the click and key handlers of a menu item.
 *
 * - Events from a portal opened inside the item (a Popover, a Dialog) reach the consumer's
 *   handlers, as React bubbles them, but never activate the item or close the menu.
 * - A disabled item calls no `onClick` and prevents its own click; its Enter and Space are still
 *   consumed.
 * - Enter and Space are consumed (no page scroll) and click the item; with Ctrl, Alt or Meta they
 *   are left to the page. A Space that continues a typeahead search is skipped (the roving
 *   capture handler prevented it). With `nativeEnter`, Enter is left to the element.
 * - After the consumer's `onClick` and `onActivate`, the item closes its menu through the list's
 *   `closeFromItem`, unless the click was not its own, its default was prevented, `hasSubmenu` is
 *   set, `keepOpenOnSpace` is set and Space caused the click, or
 *   `persistOnClick ?? menu.persistOnItemClick` is `true`.
 */
export function useMenuItemActivation({
  disabled,
  persistOnClick,
  onClick,
  onKeyDown,
  onActivate,
  keepOpenOnSpace = false,
  nativeEnter = false,
  hasSubmenu = false,
}: MenuItemActivationOptions): {
  onClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
} {
  const list = useMenuListContext();
  // Set while the key handler's click runs, so the click knows that Space caused it.
  const clickFromSpaceRef = React.useRef(false);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    // A click inside a portal opened from the item reaches the consumer's onClick (React bubbles
    // it), but is not a click on the item: it never activates the item or closes the menu. A
    // disabled item calls no onClick, as a disabled button; a portal's click keeps its default.
    const own = isOwnEvent(event);
    if (disabled) {
      if (own) event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!own || event.defaultPrevented) return;
    onActivate?.(event);
    if (event.defaultPrevented || hasSubmenu) return;
    if (keepOpenOnSpace && clickFromSpaceRef.current) return;
    if (persistOnClick ?? list?.menu.persistOnItemClick ?? false) return;
    list?.closeFromItem();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // C-COMPOSE: the consumer's onKeyDown runs first; preventDefault() skips the built-in keys.
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Enter and Space typed in a portal opened from the item belong to that portal.
    if (!isOwnEvent(event)) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // A link follows itself on Enter (Shift, Ctrl and Meta keep opening a new window or tab).
    if (event.key === 'Enter' && nativeEnter) return;
    // With Ctrl, Alt or Meta (Ctrl+Alt+Space included) the key is a shortcut, left to the page.
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    // Menu items consume Enter/Space (no page scroll), whether or not they can be activated.
    event.preventDefault();
    if (disabled) return;
    clickFromSpaceRef.current = event.key === ' ';
    try {
      event.currentTarget.click();
    } finally {
      clickFromSpaceRef.current = false;
    }
  };

  return { onClick: handleClick, onKeyDown: handleKeyDown };
}

/**
 * Internal (C-DEV): warns once, from an effect, when an item of any kind renders in a popup menu
 * outside `Menu.Popover`. A Menu with `open`, `defaultOpen` or `onOpenChange` is a popup menu that
 * renders no element of its own, so such an item has no `role="menu"` parent.
 *
 * @param componentName The item's name in the message, e.g. `'Menu.ItemCheckbox'`.
 */
export function useMenuItemPlacementWarning(componentName: string): void {
  const list = useMenuListContext();
  const menu = useOptionalMenuContext();
  const outsidePopover = menu !== null && menu.popup && list === null;
  React.useEffect(() => {
    if (!outsidePopover) return;
    warnOnce(
      'Menu:item-outside-popover',
      `${componentName}: rendered in a popup menu outside Menu.Popover, so it has no \`role="menu"\` parent. A Menu with \`open\`, \`defaultOpen\` or \`onOpenChange\` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.`,
    );
  }, [outsidePopover, componentName]);
}

// ---------------------------------------------------------------------------
// Menu.Item / Menu.Divider
// ---------------------------------------------------------------------------

/**
 * An action in a menu (`role="menuitem"`). Enter and Space activate it (a Space typed within 500 ms
 * of a typeahead character continues the search instead; with Ctrl, Alt or Meta they are left to
 * the page); in a popup menu, activation closes the menu and returns focus to the trigger unless
 * `persistOnClick` (or the Menu's `persistOnItemClick`) keeps it open or the consumer's `onClick`
 * calls `preventDefault()`. Disabled items are `aria-disabled`, skipped by keyboard navigation and
 * never activated: their `onClick` is not called. A consumer `aria-disabled` without `disabled`
 * only changes the look and keyboard navigation: activation still runs `onClick` (guard it
 * yourself), as on Button. The item's tab index is managed by the menu. Typeahead matches the
 * label (`children`), not the icon or the shortcut; a `data-roving-text` you pass replaces the
 * label's text. Clicks and keys from a portal opened inside the item (a Popover, a Dialog) still
 * reach your `onClick` (on an enabled item) and `onKeyDown`, as React bubbles them, but never
 * activate the item or close the menu.
 *
 * The labels of a menu line up: when any item of the menu shows an icon (or a check), every item
 * keeps an empty column of that width before its label.
 *
 * As the child of a submenu's `Menu.Trigger` (a `Menu` nested in a menu list), the item is the
 * submenu's trigger: it shows a chevron at its end (mirrored in RTL) and `data-has-submenu`, and
 * activating it never closes its own menu.
 *
 * Also exported as `MenuItem` (import the flat name from React Server Components).
 */
export const MenuItem = ({
  icon,
  shortcut,
  disabled = false,
  persistOnClick,
  onClick,
  onKeyDown,
  children,
  className,
  ref,
  ...rest
}: MenuItemProps) => {
  const isSubmenuTrigger = React.useContext(MenuSubmenuTriggerContext);
  useMenuItemPlacementWarning('Menu.Item');

  // Typeahead text: a string label directly; any other label through its marked element.
  const stringLabel = typeof children === 'string' ? children : undefined;
  const ownRovingText = (rest as Record<string, unknown>)['data-roving-text'] !== undefined;

  // A submenu trigger item opens its submenu (the trigger's composed onClick): activating it never
  // closes its own menu.
  const activation = useMenuItemActivation({
    disabled,
    persistOnClick,
    onClick,
    onKeyDown,
    hasSubmenu: isSubmenuTrigger,
  });

  return (
    <div
      role="menuitem"
      data-roving-text={stringLabel}
      {...rest}
      ref={ref}
      aria-disabled={disabled ? true : rest['aria-disabled']}
      data-disabled={disabled ? '' : undefined}
      data-has-submenu={isSubmenuTrigger ? '' : undefined}
      onClick={activation.onClick}
      onKeyDown={activation.onKeyDown}
      className={cn(menuItemClasses, className)}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        end={
          isSubmenuTrigger ? (
            <ChevronRightIcon size={16} className="ms-auto shrink-0 wave-rtl:-scale-x-100" />
          ) : undefined
        }
      />
    </div>
  );
};
MenuItem.displayName = 'MenuItem';

/**
 * A separator between groups of menu items (`role="separator"`).
 *
 * Also exported as `MenuDivider` (import the flat name from React Server Components).
 */
export const MenuDivider = ({ className, ref, ...rest }: MenuDividerProps) => {
  return (
    <div
      role="separator"
      {...rest}
      ref={ref}
      className={cn('my-1 border-t border-border', className)}
    />
  );
};
MenuDivider.displayName = 'MenuDivider';
