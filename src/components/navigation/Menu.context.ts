import * as React from 'react';
import { useDuplicatePairRegistry, type CheckedValuesApi } from '../../hooks/useCheckedValues';
import type { ContextMenuAnchor } from '../../hooks/useContextMenuAnchor';
import type { HoverIntent, HoverIntentGroup } from '../../hooks/useHoverIntent';
import { reportMissingContext } from '../../lib/dev';
import type { DismissReason } from '../../lib/layers';
import type { VirtualElement } from '../../lib/types';

/*
 * The contexts of Menu and its parts: the menu (`MenuContext`, one per `<Menu>`), the menu list
 * the items render in (`MenuListContext`: the static root's `role="menu"` element or a
 * `Menu.Popover` surface) and the submenu-trigger marker. Internal; imports no component.
 */

/** Which item an opening focuses (`'none'`: a hover opening, which leaves focus where it is). */
export type InitialFocus = 'first' | 'last' | 'none';

/** What an open `Menu.Popover` surface registers with its menu. */
export interface MenuSurfaceApi {
  /** Focuses the first enabled item. */
  focusFirst(): void;
  /** Focuses the last enabled item. */
  focusLast(): void;
  /** The surface element. */
  surface: HTMLElement;
  /** The surface's dismiss layer. */
  layerId: string;
  /**
   * Where focus returns when the menu closes from an item, Tab or its chain: the trigger's focus
   * target (a submenu: its trigger item), else a focusable `target` element; `null` when none can
   * take focus.
   */
  getReturnFocus(): HTMLElement | null;
}

/** What an open submenu registers with the menu it is nested in. */
export interface OpenSubmenu {
  /** Closes the submenu: its own open submenu first, then itself. */
  close(): void;
  /** Whether focus is inside the submenu's list or anything opened from it. */
  containsFocus(): boolean;
  /** Whether focus is inside the submenu's list or the list of one of its open submenus. */
  listContainsFocus(): boolean;
}

/** The state and callbacks of one `<Menu>`, shared by its parts. */
export interface MenuContextValue {
  /** Whether the root is in popup mode (renders no element); `false` for the static menu. */
  popup: boolean;
  /** Whether the popup menu is open (always `false` for a static menu). */
  open: boolean;
  /** Opens or closes the popup menu. */
  setOpen: (open: boolean) => void;
  /** Opens the menu and focuses its first or last enabled item (or focuses it when already open). */
  openWithFocus: (target: InitialFocus) => void;
  /** Returns (and resets) the item the next opening should focus. */
  takeInitialFocus: () => InitialFocus;
  /** Registers the open surface (`null` unregisters it). */
  registerSurface: (api: MenuSurfaceApi | null) => void;
  /** The trigger's generated id. */
  triggerId: string;
  /** The trigger element's id (the child's own id wins over `triggerId`). */
  labelledBy: string;
  /** Reports the id the trigger element renders. */
  onTriggerId: (id: string) => void;
  /** The popup surface's id. */
  menuId: string;
  /** The trigger element, for focus and positioning. */
  triggerRef: React.RefObject<HTMLElement | null>;
  /** The trigger element, held in state. */
  triggerElement: HTMLElement | null;
  /** Sets the trigger element (a ref callback). */
  setTriggerElement: (element: HTMLElement | null) => void;
  /** The menu this one is nested in (a submenu), else `null`. */
  parent: MenuContextValue | null;
  /** The checked-values state the items of this menu read and change (own or the parent's). */
  checked: CheckedValuesApi;
  /** Whether activating an item keeps its popup open when the item sets no `persistOnClick`. */
  persistOnItemClick: boolean;
  /**
   * Whether this menu is a submenu: a Menu rendered in a menu list with no portal between the list
   * and the Menu (its `PortalDepthContext` equals the list's `portalDepth`).
   */
  isSubmenu: boolean;
  /**
   * The menu's own close (Escape, an outside press, Tab, item activation, the trigger toggle, the
   * hover close): it closes its open submenu first (innermost first), then itself.
   */
  requestClose: () => void;
  /**
   * Closes the whole chain from an item or Tab: focus goes to the return target of the top menu
   * (the root trigger; under a static root, the top submenu's trigger item) when focus is inside
   * the chain or lost, then the top menu closes (its submenus first). A static root does nothing.
   */
  closeChain: () => void;
  /**
   * An open submenu registers here (from a layout effect keyed on its open state); a second one
   * closes the first. Returns the unregister function.
   */
  registerOpenSubmenu: (submenu: OpenSubmenu) => () => void;
  /**
   * Whether focus is inside the menu's list or anything opened from it (submenus, a Popover of an
   * item), not on its trigger. A static menu: its element, or its open submenu.
   */
  containsFocus: () => boolean;
  /**
   * Whether focus is inside a list of the menu's chain: its own list (the surface, or the static
   * menu's element) or, recursively, its open submenu's. Unlike `containsFocus`, a portal opened
   * from an item (a Popover, a Dialog, a root Menu inside them) does not count: the item under
   * the mouse pointer takes focus only while focus is in one of the chain's lists.
   */
  listContainsFocus: () => boolean;
  /** Milliseconds before a hover opening (a submenu inherits its parent's). */
  openDelay: number;
  /** Milliseconds before a hover close (a submenu inherits its parent's). */
  closeDelay: number;
  /**
   * The surface's dismiss-layer close. Focus leaving a submenu for an item of an enclosing list
   * that the mouse pointer is focusing does not close it at once: it becomes a hover-opened
   * submenu and closes after `closeDelay` unless the pointer returns to it or its trigger item.
   * Every other reason closes it through `requestClose`.
   */
  dismiss: (reason: DismissReason, event: Event) => void;
  /**
   * Whether a hovered item of this menu's parent list, or of a list further up the chain, is
   * taking focus right now (focus follows the mouse inside a focused menu tree).
   */
  isHoverFocusing: () => boolean;
  /** Whether the open menu was opened by hover and not pinned since (click, keys, context). */
  isHoverOpen: () => boolean;
  /** Hover opening: composed onto the trigger (inert while hover is off). */
  hoverTriggerHandlers: HoverIntent['triggerHandlers'];
  /** Hover opening: composed onto the surface (inert while hover is off). */
  hoverSurfaceHandlers: HoverIntent['surfaceHandlers'];
  /** Whether this is a context menu: `openOnContext` on a root popup menu. */
  openOnContext: boolean;
  /** Context gestures: composed onto the trigger in context mode. */
  contextTriggerHandlers: ContextMenuAnchor['triggerHandlers'];
  /** Composed onto the surface: a context menu keeps the browser's context menu away from it. */
  contextSurfaceHandlers: ContextMenuAnchor['surfaceHandlers'];
  /** The anchor of the last context gesture: a point, or the row focused at a key press. */
  contextAnchor: HTMLElement | VirtualElement | null;
  /** Whether the open (or exiting) menu was opened by a context gesture. */
  fromContext: boolean;
  /** The element focused at the last context gesture: where focus returns first. */
  contextOpener: React.RefObject<HTMLElement | null>;
}

/** Provided by every menu list: the static root's `role="menu"` and every `Menu.Popover` surface. */
export interface MenuListContextValue {
  /** The menu that renders the list. */
  menu: MenuContextValue;
  /** `true` for a static root, `false` for a popover surface. */
  isStatic: boolean;
  /**
   * The `PortalDepthContext` value the list's children see (the static root: the value around
   * it; `Menu.Popover`: its own value + 1, inside its Portal). A Menu is a submenu only when its
   * own depth equals this: a Menu inside a Popover or Dialog opened from the list is not.
   */
  portalDepth: number;
  /**
   * Called by an item that was activated and should close its menu. A popover surface closes the
   * whole chain (`closeChain`: focus goes to the root trigger first, then every menu closes); a
   * static list does nothing.
   */
  closeFromItem: () => void;
  /**
   * Development only (a no-op in production): a checkable item registers its `name`/`value` from
   * an effect and unregisters on cleanup; a second registration of the same pair in one list warns
   * once (`Menu:duplicate-value`), since both items would show as checked.
   */
  registerCheckable: (name: string, value: string) => () => void;
  /** Coordinates the safe zones of the list's submenu trigger items (one group per list). */
  hoverGroup: HoverIntentGroup;
  /**
   * `true` while the list moves focus to the item under the mouse pointer (and until the
   * focus-outside checks that change queued have run).
   */
  isHoverFocusing: () => boolean;
}

export const MenuContext = React.createContext<MenuContextValue | null>(null);
MenuContext.displayName = 'MenuContext';

export const MenuListContext = React.createContext<MenuListContextValue | null>(null);
MenuListContext.displayName = 'MenuListContext';

/** `true` inside the element a submenu's `Menu.Trigger` renders (its `Menu.Item`). */
export const MenuSubmenuTriggerContext = React.createContext(false);
MenuSubmenuTriggerContext.displayName = 'MenuSubmenuTriggerContext';

const noop = () => {};

const INERT_CHECKED: CheckedValuesApi = {
  values: Object.freeze({}),
  isChecked: () => false,
  toggle: noop,
  select: noop,
};

/**
 * The inert Menu context: what a misplaced part renders with in production (C-CONTEXT), and the
 * base of the item test harness. A member added to `MenuContextValue` gets its inert value here.
 */
export const INERT_MENU_CONTEXT: MenuContextValue = {
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
  parent: null,
  checked: INERT_CHECKED,
  persistOnItemClick: false,
  isSubmenu: false,
  requestClose: noop,
  closeChain: noop,
  registerOpenSubmenu: () => noop,
  containsFocus: () => false,
  listContainsFocus: () => false,
  openDelay: 250,
  closeDelay: 250,
  dismiss: noop,
  isHoverFocusing: () => false,
  isHoverOpen: () => false,
  hoverTriggerHandlers: { onPointerEnter: noop, onPointerMove: noop, onPointerLeave: noop },
  hoverSurfaceHandlers: { onPointerEnter: noop, onPointerLeave: noop },
  openOnContext: false,
  contextTriggerHandlers: { onContextMenu: noop, onKeyDown: noop },
  contextSurfaceHandlers: { onContextMenu: noop },
  contextAnchor: null,
  fromContext: false,
  contextOpener: { current: null },
};

/**
 * An inert menu list of the inert menu: closes nothing and registers nothing. The base of the item
 * test harness; a member added to `MenuListContextValue` gets its inert value here.
 */
export const INERT_MENU_LIST_CONTEXT: MenuListContextValue = {
  menu: INERT_MENU_CONTEXT,
  isStatic: true,
  portalDepth: 0,
  closeFromItem: noop,
  registerCheckable: () => noop,
  hoverGroup: { isHeld: () => false },
  isHoverFocusing: () => false,
};

/** C-CONTEXT: throws in development, logs once and returns an inert value in production. */
export function useMenuContext(componentName: string): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (context) return context;
  reportMissingContext(componentName, 'Menu');
  return INERT_MENU_CONTEXT;
}

/** The nearest Menu's context, or `null` outside any Menu (no diagnostics). */
export function useOptionalMenuContext(): MenuContextValue | null {
  return React.useContext(MenuContext);
}

/** The menu list the caller renders in, or `null` outside any list. */
export function useMenuListContext(): MenuListContextValue | null {
  return React.useContext(MenuListContext);
}

/** The warning for two checkable items of one menu list with the same `name`/`value` pair. */
function duplicateValueMessage(name: string, value: string): string {
  return `Menu: two checkable items of one menu list have the name "${name}" and the value "${value}", so both show as checked. Give every item of a group its own value.`;
}

/**
 * The `registerCheckable` of one menu list: a count per `name`/`value` pair, kept for the list's
 * lifetime. A second registration of a pair warns once (development only).
 */
export function useCheckableRegistry(): MenuListContextValue['registerCheckable'] {
  return useDuplicatePairRegistry('Menu:duplicate-value', duplicateValueMessage);
}
