import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PopupAlign, PopupSide, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { mergeProps } from '../../lib/mergeProps';
import { STATE_ARIA } from '../../lib/renderTrigger';
import { getFirstTabbable } from '../../lib/focus';
import { disabledStyles, focusRing, focusRingInset } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useDismiss } from '../../hooks/useDismiss';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import {
  getTriggerFocusTarget,
  useTriggerElement,
  useTriggerFocusRef,
} from '../../hooks/useTriggerElement';
import { Portal } from '../portal/Portal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Properties for the Menu component. */
export interface MenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Menu items and dividers (static menu), or a `Menu.Trigger` and a `Menu.Popover` (popup menu).
   */
  children: React.ReactNode;
  /**
   * Controlled open state of a popup menu (`Menu.Trigger` + `Menu.Popover`). Passing it, even
   * `false` (like passing `defaultOpen` or `onOpenChange`), makes Menu a popup menu that renders no
   * element of its own: use it only with `Menu.Trigger`/`Menu.Popover`. Items outside
   * `Menu.Popover` then have no `role="menu"` parent (development warning). Leave all three out
   * for a static menu.
   */
  open?: boolean;
  /**
   * Initial open state of an uncontrolled popup menu; a popup menu starts closed without it.
   * Passing it, even `false`, makes Menu a popup menu (see `open`), so for a Menu without
   * `Menu.Trigger`/`Menu.Popover` children, leaving it out is not the same as `false`.
   */
  defaultOpen?: boolean;
  /**
   * Called with the next open state when the popup menu opens or closes (only on change). Passing
   * it makes Menu a popup menu (see `open`).
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Ref to the static menu element (`role="menu"`). A popup menu renders no root element, so it
   * ignores `ref`, `className` and other DOM props (development warning): pass them to
   * `Menu.Popover`.
   */
  ref?: React.Ref<HTMLDivElement>;
}

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
   * Keep a popup menu open after this item is activated (by default activation closes the menu
   * and returns focus to the trigger).
   * @default false
   */
  persistOnClick?: boolean;
  /** Label content of the menu item. */
  children: React.ReactNode;
  /** Ref to the `role="menuitem"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the MenuDivider sub-component. */
export interface MenuDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ref to the `role="separator"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The props `Menu.Trigger` puts on its element (merged onto the single child, or passed to a
 * render-prop child — e.g. `SplitButton`'s `menuButtonProps`). A type alias (not an interface), so
 * it is assignable to prop types with index signatures such as `data-*`.
 */
export type MenuTriggerProps = {
  /** Generated id (the child's own `id` wins; the menu is labelled by it). */
  id: string;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  /** The menu's id, only while the menu is open. */
  'aria-controls'?: string;
  /** Toggles the menu (opening focuses the first enabled item). */
  onClick: React.MouseEventHandler<HTMLElement>;
  /** Enter/Space/ArrowDown open and focus the first item; ArrowUp opens and focuses the last. */
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  /** Anchor for positioning and focus-restore target. */
  ref: React.RefCallback<HTMLElement>;
};

/**
 * Properties for the MenuTrigger sub-component. Other props (`aria-describedby` from a wrapping
 * `Tooltip`, `className`, `data-*`, handlers, …) are forwarded to the trigger element: merged with
 * the child's own props (handlers composed, classes joined, `aria-describedby` ids joined), or
 * passed to a render-prop child together with {@link MenuTriggerProps}.
 */
export interface MenuTriggerComponentProps extends Omit<
  React.HTMLAttributes<HTMLElement>,
  'children'
> {
  /**
   * A single element that receives {@link MenuTriggerProps} (its own handlers run first; its own
   * `id` is kept; the trigger's `aria-expanded`/`aria-controls`/`aria-haspopup` always win), or a
   * render function that receives them (plus the forwarded props).
   */
  children: React.ReactNode | ((props: MenuTriggerProps) => React.ReactNode);
  /**
   * `false` renders a wrapper `<span>` carrying the trigger props instead of merging them onto the
   * child (the 0.4-style wrapper). The state ARIA (`aria-haspopup`, `aria-expanded`,
   * `aria-controls`), which a generic span cannot carry, goes to the first element in the tab
   * order inside the span (none for text children), and focus returns to that element when the
   * menu closes. A render-prop child still receives every prop.
   * @default true
   */
  asChild?: boolean;
  /** Ref to the trigger element (the child, or the wrapper span); the child's own ref is kept. */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the MenuPopover sub-component. */
export interface MenuPopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  /** Side of the trigger the menu opens on (`start`/`end` follow the writing direction). @default 'bottom' */
  side?: PopupSide;
  /** Alignment along that side. @default 'start' */
  align?: PopupAlign;
  /** Distance from the trigger in px. @default 4 */
  offset?: number;
  /** Menu items and dividers. */
  children: React.ReactNode;
  /**
   * Ref to the portaled `role="menu"` surface. Its `id` is generated (the trigger's
   * `aria-controls` points to it), and it is labelled by the trigger unless `aria-label` is given.
   */
  ref?: React.Ref<HTMLDivElement>;
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

type InitialFocus = 'first' | 'last';

interface MenuSurfaceApi {
  focusFirst(): void;
  focusLast(): void;
}

interface MenuContextValue {
  /** Whether the root is in popup mode (renders no element); `false` for the static menu. */
  popup: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the menu and focuses its first or last enabled item (or focuses it when already open). */
  openWithFocus: (target: InitialFocus) => void;
  /** Returns (and resets) the item the next opening should focus. */
  takeInitialFocus: () => InitialFocus;
  registerSurface: (api: MenuSurfaceApi | null) => void;
  triggerId: string;
  /** The trigger element's id (the child's own id wins over `triggerId`). */
  labelledBy: string;
  onTriggerId: (id: string) => void;
  menuId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  triggerElement: HTMLElement | null;
  setTriggerElement: (element: HTMLElement | null) => void;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);
MenuContext.displayName = 'MenuContext';

const noop = () => {};
const INERT_MENU_CONTEXT: MenuContextValue = {
  popup: true,
  open: false,
  setOpen: noop,
  openWithFocus: noop,
  takeInitialFocus: () => 'first',
  registerSurface: noop,
  triggerId: 'wave-menu-inert-trigger',
  labelledBy: 'wave-menu-inert-trigger',
  onTriggerId: noop,
  menuId: 'wave-menu-inert',
  triggerRef: { current: null },
  triggerElement: null,
  setTriggerElement: noop,
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
function useMenuContext(componentName: string): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (context) return context;
  reportMissingContext(componentName, 'Menu');
  return INERT_MENU_CONTEXT;
}

/** The popup surface an item lives in: activating an item closes it. `null` in a static menu. */
interface MenuSurfaceContextValue {
  /** Closes the menu after an item was activated, putting focus on the trigger first. */
  close: () => void;
}

const MenuSurfaceContext = React.createContext<MenuSurfaceContextValue | null>(null);
MenuSurfaceContext.displayName = 'MenuSurfaceContext';

/**
 * C-DEV: `Menu.Trigger`/`Menu.Popover` rendered by a static menu — the root only detects popup
 * mode from its direct children (Fragments included), so wrapped parts leave it static.
 */
function useStaticMenuPartWarning(componentName: string, popup: boolean): void {
  React.useEffect(() => {
    if (popup) return;
    warnOnce(
      'Menu:static-popup-parts',
      `${componentName}: rendered inside a static menu. Menu switches to a popup menu only when Menu.Trigger or Menu.Popover is a direct child (Fragments included); wrapped in another element or component, they are rendered inside the static \`role="menu"\` element. Make them direct children of Menu, or pass \`open\`, \`defaultOpen\` or \`onOpenChange\` to Menu to force popup mode.`,
    );
  }, [componentName, popup]);
}

// ---------------------------------------------------------------------------
// Styles and shared roving options
// ---------------------------------------------------------------------------

const MENU_ITEM_SELECTOR = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

/**
 * Typeahead matches an item's `data-roving-text`, else its whole text, which would start with the
 * icon's text (an emoji, an icon-font ligature) and end with the shortcut. A string label is
 * passed as `data-roving-text` when the item renders. Any other label (an i18n component) marks
 * its element with `data-menu-label`, and the menu copies that element's current text onto the
 * item right before it handles a printable key, so a label that re-renders on its own is matched
 * by what it shows.
 */
function withTypeaheadText(
  handleKeyDownCapture: React.KeyboardEventHandler<HTMLDivElement>,
): React.KeyboardEventHandler<HTMLDivElement> {
  return (event) => {
    if (event.key.length === 1) {
      for (const label of event.currentTarget.querySelectorAll('[data-menu-label]')) {
        const menuItem = label.closest(MENU_ITEM_SELECTOR);
        menuItem?.setAttribute('data-roving-text', label.textContent ?? '');
      }
    }
    handleKeyDownCapture(event);
  };
}

/**
 * Whether an event started in the element that handles it (`currentTarget`) or inside its DOM.
 * React bubbles the events of a portal (a Popover or Dialog opened from an item) through the item
 * and the menu surface although their target lives elsewhere in the document: those are not the
 * menu's to handle. The target is duck typed, so a menu rendered into another realm's document
 * (an iframe) still handles its own events.
 */
function isOwnEvent(event: React.SyntheticEvent<HTMLElement>): boolean {
  const target = event.target as Partial<Node> | null;
  return (
    !!target && typeof target.nodeType === 'number' && event.currentTarget.contains(target as Node)
  );
}

const menuSurfaceClasses =
  'min-w-[180px] rounded-md border border-border bg-background py-1 shadow-4';

const menuItemClasses = cn(
  'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  // Gated like hover: a disabled item can still take focus from a mouse click (tabindex -1).
  'not-disabled:not-aria-disabled:focus:bg-subtle-hover',
  focusRingInset,
  disabledStyles,
);

// ---------------------------------------------------------------------------
// Menu.Item / Menu.Divider
// ---------------------------------------------------------------------------

/**
 * An action in a menu (`role="menuitem"`). Enter and Space activate it (a Space typed within 500 ms
 * of a typeahead character continues the search instead); in a popup menu, activation closes the
 * menu and returns focus to the trigger unless `persistOnClick` is set or the consumer's `onClick`
 * calls `preventDefault()`. Disabled items are `aria-disabled`, skipped by keyboard navigation and
 * never activated. A consumer `aria-disabled` without `disabled` only changes the look and
 * keyboard navigation: activation still runs `onClick` (guard it yourself), as on Button. The
 * item's tab index is managed by the menu. Typeahead matches the label (`children`), not the icon
 * or the shortcut; a `data-roving-text` you pass replaces the label's text. Clicks and keys from a
 * portal opened inside the item (a Popover, a Dialog) still reach your `onClick`/`onKeyDown`, as
 * React bubbles them, but never activate the item or close the menu.
 *
 * Also exported as `MenuItem` (import the flat name from React Server Components).
 */
const MenuItem = ({
  icon,
  shortcut,
  disabled = false,
  persistOnClick = false,
  onClick,
  onKeyDown,
  children,
  className,
  ref,
  ...rest
}: MenuItemProps) => {
  const surface = React.useContext(MenuSurfaceContext);
  const menu = React.useContext(MenuContext);

  // C-DEV: `open`, `defaultOpen` or `onOpenChange` on a Menu of items makes it a popup menu,
  // which renders no `role="menu"` element around items outside Menu.Popover.
  const outsidePopover = menu !== null && menu.popup && surface === null;
  React.useEffect(() => {
    if (!outsidePopover) return;
    warnOnce(
      'Menu:item-outside-popover',
      'Menu.Item: rendered in a popup menu outside Menu.Popover, so it has no `role="menu"` parent. A Menu with `open`, `defaultOpen` or `onOpenChange` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.',
    );
  }, [outsidePopover]);

  // Typeahead text: a string label directly; any other label through its marked element.
  const stringLabel = typeof children === 'string' ? children : undefined;
  const markLabel =
    stringLabel === undefined &&
    (rest as Record<string, unknown>)['data-roving-text'] === undefined;

  // A falsy icon (`icon={name && <Icon />}` with `name` '' or a count of 0) is no icon, as in Nav,
  // Tree and Avatar, and so is a collection whose items render nothing: no empty 20px box before
  // the label. The check does not consume a generator: renderSlot still renders its items.
  const iconNode =
    icon && slotRendersContent(icon)
      ? renderSlot(icon, 'span', 'flex h-5 w-5 shrink-0 items-center justify-center', {
          'aria-hidden': true,
        })
      : null;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // A click inside a portal opened from the item reaches the consumer's onClick (React bubbles
    // it), but is not a click on the item: it never activates the item or closes the menu.
    const own = isOwnEvent(event);
    if (disabled && own) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (!own || event.defaultPrevented || persistOnClick) return;
    surface?.close();
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Enter and Space typed in a portal opened from the item belong to that portal.
      if (!isOwnEvent(event)) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Menu items consume Enter/Space (no page scroll), whether or not they can be activated.
      event.preventDefault();
      if (!disabled) event.currentTarget.click();
    },
  );

  return (
    <div
      role="menuitem"
      data-roving-text={stringLabel}
      {...rest}
      ref={ref}
      aria-disabled={disabled ? true : rest['aria-disabled']}
      data-disabled={disabled ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(menuItemClasses, className)}
    >
      {iconNode}
      <span className="flex-1" data-menu-label={markLabel ? '' : undefined}>
        {children}
      </span>
      {shortcut && <span className="ms-4 text-caption-1 text-muted-foreground">{shortcut}</span>}
    </div>
  );
};
MenuItem.displayName = 'MenuItem';

/**
 * A separator between groups of menu items (`role="separator"`).
 *
 * Also exported as `MenuDivider` (import the flat name from React Server Components).
 */
const MenuDivider = ({ className, ref, ...rest }: MenuDividerProps) => {
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

// ---------------------------------------------------------------------------
// Menu.Trigger
// ---------------------------------------------------------------------------

/**
 * The element that opens a popup menu. Its single child receives {@link MenuTriggerProps}
 * (`aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while open, an id and composed
 * `onClick`/`onKeyDown`); a render function receives them instead. Click, Enter, Space and
 * ArrowDown open the menu and focus its first enabled item; ArrowUp opens it and focuses the last.
 * Other props passed to `Menu.Trigger` are forwarded to the child, so
 * `<Tooltip><Menu.Trigger><MenuButton /></Menu.Trigger></Tooltip>` describes the MenuButton.
 *
 * With `asChild={false}` (and for a child that does not attach the ref, automatically) the props
 * go on a wrapper span instead; the state ARIA then goes to the first element in the tab order
 * inside it, and focus returns to that element.
 *
 * Also exported as `MenuTrigger` (import the flat name from React Server Components).
 *
 * @example
 * <Menu>
 *   <Menu.Trigger><Button>Actions</Button></Menu.Trigger>
 *   <Menu.Popover><Menu.Item onClick={edit}>Edit</Menu.Item></Menu.Popover>
 * </Menu>
 */
const MenuTrigger = ({ children, asChild, ref, ...rest }: MenuTriggerComponentProps) => {
  const { popup, open, setOpen, openWithFocus, triggerId, menuId, onTriggerId, setTriggerElement } =
    useMenuContext('Menu.Trigger');
  useStaticMenuPartWarning('Menu.Trigger', popup);
  const elementRef = useMergedRefs<HTMLElement>(setTriggerElement, ref);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (open) setOpen(false);
    else openWithFocus('first');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        openWithFocus('first');
        break;
      case 'ArrowUp':
        event.preventDefault();
        openWithFocus('last');
        break;
      case 'Enter':
      case ' ':
        // Handled here (not through the native click) so non-button children work too.
        event.preventDefault();
        if (open) setOpen(false);
        else openWithFocus('first');
        break;
      default:
        break;
    }
  };

  const ownProps: MenuTriggerProps = {
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    ref: elementRef,
  };
  // §5.3: forwarded props merge in (a consumer `id` wins, handlers compose consumer-first), but the
  // live state ARIA always wins. On a wrapper span (`asChild={false}`, the automatic fallback)
  // useTriggerElement moves the state ARIA onto the first element in the tab order inside it.
  const triggerProps = mergeProps(ownProps, rest, { oursWin: STATE_ARIA });

  return useTriggerElement(children, triggerProps, {
    componentName: 'Menu.Trigger',
    asChild,
    onResolvedId: onTriggerId,
  });
};
MenuTrigger.displayName = 'MenuTrigger';

// ---------------------------------------------------------------------------
// Menu.Popover
// ---------------------------------------------------------------------------

/**
 * The portaled `role="menu"` surface of a popup menu, positioned next to `Menu.Trigger`. Focus
 * moves to the first (ArrowUp: last) enabled item when it opens; arrows, Home/End and typeahead
 * move between enabled items. Escape closes it and returns focus to the trigger. An outside press
 * closes it and leaves focus where the press put it (on the trigger only when focus was still in
 * the menu or lost to the page). Tab closes it and moves focus to the trigger without preventing
 * the default, so tabbing continues from the trigger (inside a Dialog, the focus trap moves on
 * from there). The trigger here is the element that takes its focus: for a wrapper span, the
 * element inside it that carries the state ARIA (the span itself when you made it the trigger with
 * `tabIndex={0}` or a `role`). Keys from a portal opened inside the menu (a Popover of an
 * item) are left to that portal: Tab there moves on inside it and keeps the menu open.
 *
 * Also exported as `MenuPopover` (import the flat name from React Server Components).
 */
const MenuPopover = ({
  side = 'bottom',
  align = 'start',
  offset,
  children,
  className,
  style,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  ref,
  ...rest
}: MenuPopoverProps) => {
  const {
    popup,
    open,
    setOpen,
    takeInitialFocus,
    registerSurface,
    menuId,
    labelledBy,
    triggerRef,
    triggerElement,
  } = useMenuContext('Menu.Popover');
  useStaticMenuPartWarning('Menu.Popover', popup);

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const setSurfaceElement = React.useCallback((element: HTMLDivElement | null) => {
    surfaceRef.current = element;
    setSurface(element);
  }, []);

  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open,
    side,
    align,
    offset,
  });
  React.useLayoutEffect(() => {
    setReference(triggerElement);
  }, [setReference, triggerElement]);

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  // Item activation: focus goes back to the trigger before the menu closes (as for Tab), not after
  // it. A surface the item opens in the same update (a "Delete…" confirmation Dialog) records the
  // focused element as its opener while the menu is being removed; had focus stayed on the item,
  // that would be nothing, and focus would drop to <body> when the Dialog closes. Focus the
  // consumer's onClick moved out of the menu stays where it is.
  const closeFromItem = React.useCallback(() => {
    const surfaceElement = surfaceRef.current;
    const target = getTriggerFocusTarget(triggerRef.current);
    if (surfaceElement && target) {
      const active = surfaceElement.ownerDocument.activeElement;
      const focusInsideOrLost =
        !active || active === surfaceElement.ownerDocument.body || surfaceElement.contains(active);
      if (focusInsideOrLost) target.focus({ preventScroll: true });
    }
    setOpen(false);
  }, [setOpen, triggerRef]);

  // Focus returns to the element that takes focus for the trigger (for a wrapper span, the element
  // inside it that carries the state ARIA), as on item activation and Tab: here, and as the
  // layer's anchor when a surface opened from an item that is gone by then restores focus.
  const triggerFocusRef = useTriggerFocusRef(triggerRef);
  const { layerId } = useDismiss({
    open,
    onDismiss: close,
    refs: [surfaceRef, triggerRef],
    anchorRef: triggerFocusRef,
    kind: 'menu',
    focusOutside: true,
  });

  useRestoreFocus({
    enabled: open,
    container: surface,
    triggerRef: triggerFocusRef,
    onlyIfFocusInside: true,
  });

  const {
    containerProps: { ref: rovingRef },
    handleKeyDown: rovingKeyDown,
    handleKeyDownCapture: rovingKeyDownCapture,
    handleFocus: rovingFocus,
    focusFirst,
    focusLast,
  } = useRovingTabIndex({
    orientation: 'vertical',
    loop: true,
    typeahead: true,
    manageTabIndex: true,
    itemSelector: MENU_ITEM_SELECTOR,
  });

  const mergedRef = useMergedRefs<HTMLDivElement>(ref, setSurfaceElement, rovingRef, setFloating);

  // Lets the trigger move focus into an already open menu (ArrowDown/ArrowUp on the trigger).
  React.useLayoutEffect(() => {
    if (!surface) return;
    registerSurface({ focusFirst, focusLast });
    return () => registerSurface(null);
  }, [surface, registerSurface, focusFirst, focusLast]);

  // Initial focus: the first (or last) enabled item, unless focus is already inside.
  React.useLayoutEffect(() => {
    if (!open || !surface) return;
    if (surface.contains(surface.ownerDocument.activeElement)) return;
    if (takeInitialFocus() === 'last') focusLast();
    else focusFirst();
  }, [open, surface, takeInitialFocus, focusFirst, focusLast]);

  const surfaceContext = React.useMemo<MenuSurfaceContextValue>(
    () => ({ close: closeFromItem }),
    [closeFromItem],
  );

  // C-COMPOSE: the consumer's onKeyDown runs first; preventDefault() skips the built-in keys. A key
  // from a portal opened inside the menu (a Popover of an item) is that portal's: Tab moves on
  // inside it and never closes the menu.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isOwnEvent(event)) return;
    if (event.key === 'Tab') {
      // Close and put focus on the trigger; the default Tab action then continues from there.
      getTriggerFocusTarget(triggerRef.current)?.focus();
      setOpen(false);
      return;
    }
    rovingKeyDown(event);
  };

  if (!open) return null;

  return (
    <Portal layerId={layerId}>
      <MenuSurfaceContext.Provider value={surfaceContext}>
        <div
          role="menu"
          aria-labelledby={
            triggerElement && rest['aria-label'] === undefined ? labelledBy : undefined
          }
          {...rest}
          ref={mergedRef}
          id={menuId}
          data-state="open"
          data-side={floatingProps['data-side']}
          data-align={floatingProps['data-align']}
          data-roving-container=""
          style={{ ...floatingProps.style, ...style }}
          onKeyDown={handleKeyDown}
          onKeyDownCapture={withTypeaheadText(
            composeEventHandlers(onKeyDownCapture, rovingKeyDownCapture),
          )}
          onFocus={composeEventHandlers(onFocus, rovingFocus, { checkDefaultPrevented: false })}
          className={cn(menuSurfaceClasses, className)}
        >
          {children}
        </div>
      </MenuSurfaceContext.Provider>
    </Portal>
  );
};
MenuPopover.displayName = 'MenuPopover';

// ---------------------------------------------------------------------------
// Menu (root)
// ---------------------------------------------------------------------------

/**
 * Whether the children contain a `Menu.Trigger` or `Menu.Popover`: direct children and the
 * children of Fragments only (other elements and components are not searched). Parts written in
 * a Server Component (lazy client references) are recognised too.
 */
function hasPopupParts(children: React.ReactNode): boolean {
  return flattenChildren(children).some(({ node }) =>
    isElementOfType(node, MenuTrigger, MenuPopover),
  );
}

const MenuRoot = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  ref,
  ...rest
}: MenuProps) => {
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);

  const triggerId = useId('wave-menu-trigger');
  const menuId = useId('wave-menu');
  const [labelledBy, setLabelledBy] = React.useState(triggerId);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [triggerElement, setTriggerElementState] = React.useState<HTMLElement | null>(null);
  const setTriggerElement = React.useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
    setTriggerElementState(element);
  }, []);

  const initialFocusRef = React.useRef<InitialFocus>('first');
  const surfaceApiRef = React.useRef<MenuSurfaceApi | null>(null);
  const openWithFocus = React.useCallback(
    (target: InitialFocus) => {
      const surfaceApi = surfaceApiRef.current;
      if (surfaceApi) {
        if (target === 'last') surfaceApi.focusLast();
        else surfaceApi.focusFirst();
        return;
      }
      initialFocusRef.current = target;
      setOpen(true);
    },
    [setOpen],
  );
  const takeInitialFocus = React.useCallback((): InitialFocus => {
    const target = initialFocusRef.current;
    initialFocusRef.current = 'first';
    return target;
  }, []);
  const registerSurface = React.useCallback((api: MenuSurfaceApi | null) => {
    surfaceApiRef.current = api;
  }, []);

  const popup =
    openProp !== undefined ||
    defaultOpen !== undefined ||
    onOpenChange !== undefined ||
    hasPopupParts(children);

  // C-DEV: a popup menu renders no root element, so root DOM props and the ref go nowhere.
  const ignoredProps: string[] = [];
  if (popup) {
    if (className !== undefined) ignoredProps.push('className');
    if (onKeyDown !== undefined) ignoredProps.push('onKeyDown');
    if (onKeyDownCapture !== undefined) ignoredProps.push('onKeyDownCapture');
    if (onFocus !== undefined) ignoredProps.push('onFocus');
    for (const [name, value] of Object.entries(rest)) {
      if (value !== undefined) ignoredProps.push(name);
    }
    if (ref != null) ignoredProps.push('ref');
  }
  const ignoredMessage =
    ignoredProps.length === 0
      ? ''
      : `Menu: a popup menu (Menu.Trigger + Menu.Popover) renders no element of its own, so ${ignoredProps
          .map((name) => `\`${name}\``)
          .join(', ')} on Menu ${ignoredProps.length === 1 ? 'is' : 'are'} ignored. Pass ${
          ignoredProps.length === 1 ? 'it' : 'them'
        } to Menu.Popover (the menu surface) or to the trigger's child instead.`;
  React.useEffect(() => {
    if (ignoredMessage) warnOnce('Menu:popup-ignored-props', ignoredMessage);
  }, [ignoredMessage]);

  const contextValue = React.useMemo<MenuContextValue>(
    () => ({
      popup,
      open,
      setOpen,
      openWithFocus,
      takeInitialFocus,
      registerSurface,
      triggerId,
      labelledBy,
      onTriggerId: setLabelledBy,
      menuId,
      triggerRef,
      triggerElement,
      setTriggerElement,
    }),
    [
      popup,
      open,
      setOpen,
      openWithFocus,
      takeInitialFocus,
      registerSurface,
      triggerId,
      labelledBy,
      menuId,
      triggerElement,
      setTriggerElement,
    ],
  );

  // Static menu: roving tab stop over the items (the last focused one keeps it).
  const {
    containerProps: { ref: rovingRef },
    handleKeyDown: rovingKeyDown,
    handleKeyDownCapture: rovingKeyDownCapture,
    handleFocus: rovingFocus,
    focusFirst,
    getTabIndex,
  } = useRovingTabIndex({
    orientation: 'vertical',
    loop: true,
    typeahead: true,
    tabStop: 'last-focused',
    manageTabIndex: true,
    itemSelector: MENU_ITEM_SELECTOR,
  });
  const staticMenuRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rovingRef, staticMenuRef);

  // Disabled items never hold the tab stop, so with no enabled item the static menu itself does:
  // Tab still reaches it and a screen reader announces it. Checked whenever the roving hook's tab
  // stop changes (`getTabIndex` changes with it: an item enabled, disabled, added or removed), and
  // after it is stamped (this effect runs after the hook's).
  const [menuIsTabStop, setMenuIsTabStop] = React.useState(false);
  React.useLayoutEffect(() => {
    const menu = staticMenuRef.current;
    if (popup || !menu) return;
    const noItemTabStop = getFirstTabbable(menu) === null;
    if (noItemTabStop === menuIsTabStop) return;
    setMenuIsTabStop(noItemTabStop);
    // An item became enabled while the menu itself had focus: focus moves on to it, rather than
    // staying on an element that is no longer focusable.
    if (!noItemTabStop && menu.ownerDocument.activeElement === menu) focusFirst();
  }, [popup, menuIsTabStop, focusFirst, getTabIndex]);

  if (popup) {
    return <MenuContext.Provider value={contextValue}>{children}</MenuContext.Provider>;
  }

  return (
    <MenuContext.Provider value={contextValue}>
      <div
        role="menu"
        {...rest}
        ref={mergedRef}
        tabIndex={rest.tabIndex ?? (menuIsTabStop ? 0 : undefined)}
        data-roving-container=""
        onKeyDown={composeEventHandlers(onKeyDown, rovingKeyDown)}
        onKeyDownCapture={withTypeaheadText(
          composeEventHandlers(onKeyDownCapture, rovingKeyDownCapture),
        )}
        onFocus={composeEventHandlers(onFocus, rovingFocus, { checkDefaultPrevented: false })}
        className={cn(menuSurfaceClasses, focusRing, className)}
      >
        {children}
      </div>
    </MenuContext.Provider>
  );
};
MenuRoot.displayName = 'Menu';

/**
 * A menu of actions (`role="menu"`), in one of two forms:
 *
 * - **Static menu** — `Menu.Item`/`Menu.Divider` children render inline inside the `role="menu"`
 *   element. The menu itself is not a tab stop: one item is (the last focused enabled item, else
 *   the first enabled one). When every item is disabled, the menu element holds the tab stop
 *   instead, so keyboard and screen-reader users still reach it. Arrow keys, Home/End and
 *   typeahead move between enabled items; Enter and Space activate the focused item (a Space typed
 *   within 500 ms of a typeahead character continues the search instead).
 * - **Popup menu** — with `Menu.Trigger` and `Menu.Popover` children, or whenever `open`,
 *   `defaultOpen` or `onOpenChange` is passed (even `false`), the root renders no element of its
 *   own: the trigger opens the portaled `Menu.Popover`, item activation returns focus to the
 *   trigger and closes it (focus is on the trigger before the menu goes, so a Dialog the item
 *   opens returns focus there when it closes). Open state is `open`/`defaultOpen`/`onOpenChange`.
 *
 * **Popup detection**: Menu looks for `Menu.Trigger`/`Menu.Popover` (also under their flat names
 * from a Server Component) among its direct children and inside Fragments only. When they are
 * wrapped in another element or component, pass `open`, `defaultOpen` or `onOpenChange` to force
 * popup mode; otherwise the static `role="menu"` element is rendered around them (development
 * warning). A popup menu renders no root element, so `className`, `ref` and other DOM props on
 * `Menu` are ignored (development warning): put them on `Menu.Popover`. Items rendered in a popup
 * menu outside `Menu.Popover` have no `role="menu"` parent (development warning).
 *
 * Sub-components are also exported under flat names (`MenuItem`, `MenuDivider`, `MenuTrigger`,
 * `MenuPopover`): React Server Components import those, because dotted access (`Menu.Item`)
 * needs a client file.
 */
export const Menu = /* @__PURE__ */ Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
  Trigger: MenuTrigger,
  Popover: MenuPopover,
});

export { MenuItem, MenuDivider, MenuTrigger, MenuPopover };
