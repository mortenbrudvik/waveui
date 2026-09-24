import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PopupAlign, PopupSide, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnOnce } from '../../lib/dev';
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
import { useTriggerElement } from '../../hooks/useTriggerElement';
import { Portal } from '../portal/Portal';

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

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
   * Controlled open state of a popup menu (`Menu.Trigger` + `Menu.Popover`). Ignored by the static
   * menu.
   */
  open?: boolean;
  /**
   * Initial open state of an uncontrolled popup menu.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called with the next open state when the popup menu opens or closes (only on change). */
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
   * child (the 0.4-style wrapper).
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

/** C-CONTEXT: throws in development, logs and returns an inert value in production. */
function useMenuContext(componentName: string): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (context) return context;
  const message = `[WaveUI] ${componentName} must be used within Menu`;
  if (isDev) throw new Error(message);
  console.error(message);
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
 * Runs menu typeahead, then activates the focused item on a Space that was not part of a search.
 * Space cannot be handled on the item: that click would run before typeahead saw the key.
 */
function handleMenuKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  rovingKeyDown: (event: React.KeyboardEvent) => void,
): void {
  rovingKeyDown(event);
  if (event.key !== ' ' || event.defaultPrevented) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.matches(MENU_ITEM_SELECTOR)) return;
  event.preventDefault();
  if (target.getAttribute('aria-disabled') === 'true') return;
  target.click();
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
 * An action in a menu (`role="menuitem"`). Enter activates it on the item. Space is handled by the
 * menu after typeahead, so a search in progress does not click the item; a Space that is not part
 * of a search activates it. In a popup menu, activation closes the menu and returns focus to the
 * trigger unless `persistOnClick` is set or the consumer's `onClick` calls `preventDefault()`.
 * Disabled items are `aria-disabled`, skipped by keyboard navigation and never activated. The
 * item's tab index is managed by the menu.
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
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
    if (event.defaultPrevented || persistOnClick) return;
    surface?.close();
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Space is left to the menu: it runs typeahead first, then activates when the key was not
      // part of a search. Handling it here would click before that search could consume the key.
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!disabled) event.currentTarget.click();
    },
  );

  return (
    <div
      role="menuitem"
      data-roving-text={typeof children === 'string' ? children : undefined}
      {...rest}
      ref={ref}
      aria-disabled={disabled ? true : rest['aria-disabled']}
      data-disabled={disabled ? '' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(menuItemClasses, className)}
    >
      {iconNode}
      <span className="flex-1">{children}</span>
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
  const triggerRef = useMergedRefs<HTMLElement>(setTriggerElement, ref);

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
    ref: triggerRef,
  };
  // §5.3: forwarded props merge in (a consumer `id` wins, handlers compose consumer-first), but the
  // live state ARIA always wins.
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
 * move between enabled items. Escape and outside presses close it and return focus to the
 * trigger; Tab closes it and moves focus to the trigger without preventing the default, so
 * tabbing continues from the trigger (inside a Dialog, the focus trap moves on from there).
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
  useIsomorphicLayoutEffect(() => {
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
    const trigger = triggerRef.current;
    if (surfaceElement && trigger) {
      const active = surfaceElement.ownerDocument.activeElement;
      const focusInsideOrLost =
        !active || active === surfaceElement.ownerDocument.body || surfaceElement.contains(active);
      if (focusInsideOrLost) trigger.focus({ preventScroll: true });
    }
    setOpen(false);
  }, [setOpen, triggerRef]);

  const { layerId } = useDismiss({
    open,
    onDismiss: close,
    refs: [surfaceRef, triggerRef],
    anchorRef: triggerRef,
    kind: 'menu',
    focusOutside: true,
  });

  useRestoreFocus({ enabled: open, container: surface, triggerRef, onlyIfFocusInside: true });

  const {
    containerProps: { ref: rovingRef },
    handleKeyDown: rovingKeyDown,
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
  useIsomorphicLayoutEffect(() => {
    if (!surface) return;
    registerSurface({ focusFirst, focusLast });
    return () => registerSurface(null);
  }, [surface, registerSurface, focusFirst, focusLast]);

  // Initial focus: the first (or last) enabled item, unless focus is already inside.
  useIsomorphicLayoutEffect(() => {
    if (!open || !surface) return;
    if (surface.contains(surface.ownerDocument.activeElement)) return;
    if (takeInitialFocus() === 'last') focusLast();
    else focusFirst();
  }, [open, surface, takeInitialFocus, focusFirst, focusLast]);

  const surfaceContext = React.useMemo<MenuSurfaceContextValue>(
    () => ({ close: closeFromItem }),
    [closeFromItem],
  );

  // C-COMPOSE: the consumer's onKeyDown runs first; preventDefault() skips the built-in keys.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Tab') {
      // Close and put focus on the trigger; the default Tab action then continues from there.
      triggerRef.current?.focus();
      setOpen(false);
      return;
    }
    handleMenuKeyDown(event, rovingKeyDown);
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
 * children of Fragments only (other elements and components are not searched).
 */
function hasPopupParts(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement<{ children?: React.ReactNode }>(child)) return;
    if (child.type === MenuTrigger || child.type === MenuPopover) {
      found = true;
    } else if (child.type === React.Fragment) {
      found = hasPopupParts(child.props.children);
    }
  });
  return found;
}

/**
 * A menu of actions (`role="menu"`), in one of two forms:
 *
 * - **Static menu** — `Menu.Item`/`Menu.Divider` children render inline inside the `role="menu"`
 *   element. The menu itself is not a tab stop: one item is (the last focused enabled item, else
 *   the first enabled one). When every item is disabled, the menu element holds the tab stop
 *   instead, so keyboard and screen-reader users still reach it. Arrow keys, Home/End and
 *   typeahead move between enabled items; Enter and Space activate the focused item.
 * - **Popup menu** — with `Menu.Trigger` and `Menu.Popover` children (or `open`/`defaultOpen`/
 *   `onOpenChange`), the root renders no element of its own: the trigger opens the portaled
 *   `Menu.Popover`, item activation returns focus to the trigger and closes it (focus is on the
 *   trigger before the menu goes, so a Dialog the item opens returns focus there when it closes).
 *   Open state is `open`/`defaultOpen`/`onOpenChange`.
 *
 * **Popup detection**: Menu looks for `Menu.Trigger`/`Menu.Popover` among its direct children
 * and inside Fragments only. When they are wrapped in another element or component, pass `open`,
 * `defaultOpen` or `onOpenChange` to force popup mode; otherwise the static `role="menu"` element
 * is rendered around them (development warning). A popup menu renders no root element, so
 * `className`, `ref` and other DOM props on `Menu` are ignored (development warning): put them on
 * `Menu.Popover`.
 *
 * Sub-components are also exported under flat names (`MenuItem`, `MenuDivider`, `MenuTrigger`,
 * `MenuPopover`): React Server Components import those, because dotted access (`Menu.Item`)
 * needs a client file.
 */
const MenuRoot = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  className,
  onKeyDown,
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
    handleFocus: rovingFocus,
    focusFirst,
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
  // Tab still reaches it and a screen reader announces it. Checked after every render, which
  // includes the ones the roving hook triggers when an item is enabled, disabled, added or removed
  // (its tab stop is stamped by then: this effect runs after the hook's).
  const [menuIsTabStop, setMenuIsTabStop] = React.useState(false);
  useIsomorphicLayoutEffect(() => {
    const menu = staticMenuRef.current;
    if (popup || !menu) return;
    const noItemTabStop = getFirstTabbable(menu) === null;
    if (noItemTabStop === menuIsTabStop) return;
    setMenuIsTabStop(noItemTabStop);
    // An item became enabled while the menu itself had focus: focus moves on to it, rather than
    // staying on an element that is no longer focusable.
    if (!noItemTabStop && menu.ownerDocument.activeElement === menu) focusFirst();
  });

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
        onKeyDown={composeEventHandlers(onKeyDown, (event) =>
          handleMenuKeyDown(event, rovingKeyDown),
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

export const Menu = /* @__PURE__ */ Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
  Trigger: MenuTrigger,
  Popover: MenuPopover,
});

export { MenuItem, MenuDivider, MenuTrigger, MenuPopover };
