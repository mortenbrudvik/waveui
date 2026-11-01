import * as React from 'react';
import { cn } from '../../lib/cn';
import { menuDividerClassNames, menuItemClassNames } from '../../lib/classNames';
import type { Slot } from '../../lib/types';
import { materialiseSlotContent, renderSlot, slotRendersContent } from '../../lib/slot';
import { HIDDEN_PART_LOCKS, mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { warnOnce } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';
import { ChevronRightIcon } from '../../lib/icons';
import {
  MenuSubmenuTriggerContext,
  useMenuListContext,
  useOptionalMenuContext,
} from './Menu.context';
import { BLOCK_CLICK, MENU_PART_LOCKS, menuItemClasses } from './Menu.shared';

/** Properties for the MenuItem sub-component. */
export interface MenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Slot for an icon displayed before the item text. Rendered with `aria-hidden="true"`. A falsy
   * icon (`''`, `0`) or a list of nothing renders no icon box.
   */
  icon?: Slot<'span'>;
  /**
   * Keyboard shortcut text displayed at the end of the item. Its direction comes from its own text
   * (`dir="auto"`), so "Ctrl+," keeps its order in an RTL menu.
   */
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
  /**
   * Ref to the item element (`role="menuitem"`; `menuitemcheckbox` or `menuitemradio` for the
   * checkable items).
   */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements the item draws in its row, by part, merged into each part's own: your
   * classes after the part's (yours win a conflict), your styles over its styles, your attributes
   * and handlers added, your ref attached. Every attribute the item sets on a part is locked and
   * keeps the item's value, and no part takes a role, a tab index or the markers by which the menu
   * reads an item's row (the text typeahead matches, the check and icon columns its labels line up
   * by), so a part changes neither the menu's items, its one tab stop, its typeahead nor its
   * columns. A part takes no `children` (the item draws their content); the item element itself
   * takes the item's own props. No part carries a handler of the item: an event on a part reaches
   * the item and its menu as one on the label does, after your handler, and `preventDefault()` in
   * yours skips their handling of it there too. A click you prevent neither activates the item
   * (nor closes its menu) nor opens a submenu, while the item's `onClick` is still called, as for a
   * prevented click on the label. While the item is `disabled`, your `onClick` on a part is not
   * called, as the item's own is not (an `aria-disabled` alone leaves both called). Fluent UI's
   * MenuItem gives these parts slots of their own (`content`, `secondaryContent` for the shortcut,
   * `submenuIndicator`).
   */
  slotProps?: {
    /**
     * The `<span>` of the label (`children`), which fills the row (stable class
     * `wave-menu-item__content`). Locked: no role, tab index or roving container marker, the
     * menu's markers (typeahead reads a label that is no string through this element), and unset
     * `aria-label` (it would replace the text in the item's name), `hidden`, `inert` and
     * `aria-hidden`.
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `shortcut`, rendered while `shortcut` is set (stable class
     * `wave-menu-item__shortcut`). Locked: `dir` (`auto`, so the text keeps its own direction and
     * "Ctrl+," its order in a right-to-left menu), no role, tab index or roving container marker,
     * and the menu's markers.
     */
    shortcut?: SlotPart<'span'>;
    /**
     * The chevron `<svg>` at the end of a submenu's trigger item, rendered only there and mirrored
     * in a right-to-left menu (stable class `wave-menu-item__submenu-indicator`). Locked:
     * `aria-hidden` and `focusable` (it is a drawing), no role, tab index or roving container
     * marker, and the menu's markers; its size, view box and paint are the glyph's, which your
     * attributes replace.
     */
    submenuIndicator?: SlotPart<'svg'>;
  };
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
  /** The shortcut text (rendered with `dir="auto"`). */
  shortcut?: string;
  /** Content at the row's end: the submenu chevron or a switch. */
  end?: React.ReactNode;
  /**
   * Whether a non-string label is marked `data-menu-label` for typeahead. Pass `false` when the
   * item carries its own `data-roving-text`, which the label's text must not replace.
   * @default true
   */
  markLabel?: boolean;
  /**
   * Stable classes of the row's parts, written literally by each item kind (the check column,
   * the icon box, the label and the shortcut).
   */
  partClassNames?: MenuItemRowPartClassNames;
  /** The item's `slotProps` parts of the label and the shortcut, merged only when given. */
  parts?: { content?: SlotPart<'span'>; shortcut?: SlotPart<'span'> };
  /** The item's own `disabled`: the parts' click handlers are not called while it is set. */
  disabled?: boolean;
}

/** Internal: the stable classes of an item row's parts (see `MenuItemRowProps.partClassNames`). */
export interface MenuItemRowPartClassNames {
  checkmark?: string;
  icon?: string;
  content?: string;
  shortcut?: string;
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
  partClassNames,
  parts,
  disabled = false,
}: MenuItemRowProps): React.ReactElement {
  // The check does not consume a one-shot iterable label: it is rendered materialised.
  const hasLabel = slotRendersContent(label);
  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in Nav,
  // Tree and Avatar, and so is a collection whose items render nothing: no empty 20px box before
  // the label. The check does not consume a generator: renderSlot still renders its items.
  const iconNode =
    icon && slotRendersContent(icon)
      ? renderSlot(
          icon,
          'span',
          cn(partClassNames?.icon, 'flex h-5 w-5 shrink-0 items-center justify-center'),
          { 'aria-hidden': true, 'data-menu-icon': '' },
        )
      : null;
  const contentClasses = cn(partClassNames?.content, 'flex-1');
  const labelMarker = markLabel && hasLabel && typeof label !== 'string' ? '' : undefined;
  const shortcutClasses =
    shortcut && cn(partClassNames?.shortcut, 'ms-4 text-caption-1 text-muted-foreground');

  return (
    <>
      {checkmark !== undefined ? (
        <span
          aria-hidden="true"
          data-menu-checkmark=""
          className={cn(
            partClassNames?.checkmark,
            'inline-flex w-4 shrink-0 items-center justify-center',
          )}
        >
          {checkmark}
        </span>
      ) : (
        hasLabel && renderColumnSpace('checkmark')
      )}
      {iconNode ?? (hasLabel && renderColumnSpace('icon'))}
      <span
        className={contentClasses}
        data-menu-label={labelMarker}
        // The parts are merged only when given: a menu renders many items.
        {...(parts?.content &&
          mergeSlotProps(parts.content, {
            className: contentClasses,
            // The label names the item: a part neither renames nor hides it.
            locked: {
              ...MENU_PART_LOCKS,
              'aria-label': undefined,
              ...HIDDEN_PART_LOCKS,
              'data-menu-label': labelMarker,
            },
            blockHandlers: disabled ? BLOCK_CLICK : undefined,
          }))}
      >
        {materialiseSlotContent(label)}
      </span>
      {/* The shortcut takes its direction from its own text (`dir="auto"` also isolates it): in an
          RTL menu, "Ctrl+," would otherwise be reordered to ",+Ctrl". */}
      {shortcut && (
        <span
          dir="auto"
          className={shortcutClasses}
          {...(parts?.shortcut &&
            mergeSlotProps(parts.shortcut, {
              className: shortcutClasses,
              locked: { ...MENU_PART_LOCKS, dir: 'auto' },
              blockHandlers: disabled ? BLOCK_CLICK : undefined,
            }))}
        >
          {shortcut}
        </span>
      )}
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
 * activating it never closes its own menu. ArrowRight (ArrowLeft in RTL), Enter, Space and a click
 * open the submenu and move focus to its first item; resting the mouse on the item opens it
 * without moving focus.
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
  slotProps,
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
      className={cn(menuItemClassNames.root, menuItemClasses, className)}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        partClassNames={{
          icon: menuItemClassNames.icon,
          content: menuItemClassNames.content,
          shortcut: menuItemClassNames.shortcut,
        }}
        parts={slotProps}
        disabled={disabled}
        end={
          isSubmenuTrigger
            ? renderSubmenuIndicator(slotProps?.submenuIndicator, disabled)
            : undefined
        }
      />
    </div>
  );
};
MenuItem.displayName = 'MenuItem';

/**
 * The chevron of a submenu's trigger item, with its `slotProps` part merged only when given (its
 * click handler not called while the item is `disabled`).
 */
function renderSubmenuIndicator(
  part: SlotPart<'svg'> | undefined,
  disabled: boolean,
): React.ReactElement {
  const className = cn(
    menuItemClassNames.submenuIndicator,
    'ms-auto shrink-0 wave-rtl:-scale-x-100',
  );
  return (
    <ChevronRightIcon
      size={16}
      className={className}
      {...(part &&
        mergeSlotProps(part, {
          className,
          locked: { ...MENU_PART_LOCKS, 'aria-hidden': true, focusable: 'false' },
          blockHandlers: disabled ? BLOCK_CLICK : undefined,
        }))}
    />
  );
}

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
      className={cn(menuDividerClassNames.root, 'my-1 border-t border-border', className)}
    />
  );
};
MenuDivider.displayName = 'MenuDivider';
