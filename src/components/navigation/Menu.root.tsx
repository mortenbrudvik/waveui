import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { getFirstTabbable } from '../../lib/focus';
import { getLayerTreeElements, type DismissReason } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import type { CheckedValues, CheckedValuesChangeHandler } from '../../lib/types';
import { useCheckedValues, withCheckedValuesListener } from '../../hooks/useCheckedValues';
import { useContextMenuAnchor } from '../../hooks/useContextMenuAnchor';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useHoverIntent, type HoverIntent } from '../../hooks/useHoverIntent';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { PortalDepthContext } from '../portal/Portal';
import {
  MenuContext,
  MenuListContext,
  useCheckableRegistry,
  useMenuListContext,
} from './Menu.context';
import type {
  InitialFocus,
  MenuContextValue,
  MenuListContextValue,
  MenuSurfaceApi,
  OpenSubmenu,
} from './Menu.context';
import { MENU_ITEM_SELECTOR, menuSurfaceClasses, withTypeaheadText } from './Menu.shared';
import { MenuPopover, useMenuListPointer } from './Menu.popover';
import { MenuTrigger } from './Menu.trigger';

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
   * for a static menu. The popup renders only in the browser: an open menu is closed in the
   * server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state of an uncontrolled popup menu; a popup menu starts closed without it.
   * Passing it, even `false`, makes Menu a popup menu (see `open`), so for a Menu without
   * `Menu.Trigger`/`Menu.Popover` children, leaving it out is not the same as `false`. The popup
   * renders only in the browser: a menu open by default is closed in the server HTML and opens
   * once it has hydrated.
   */
  defaultOpen?: boolean;
  /**
   * Called with the next open state when the popup menu opens or closes (only on change). Passing
   * it makes Menu a popup menu (see `open`).
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Checked items of the menu's checkbox, radio and switch items, per group `name` (controlled).
   * A submenu without its own `checkedValues` or `defaultCheckedValues` shares its parent menu's
   * state. Works for static and popup menus; unlike `open`, it does not make Menu a popup menu.
   */
  checkedValues?: CheckedValues;
  /** Initial checked items for uncontrolled usage (gives a submenu its own state). @default {} */
  defaultCheckedValues?: CheckedValues;
  /**
   * Called when an item changes the checked items (only on change): the new checked values of every
   * group first, then `details` with the group's `name`, its `checkedItems` and the `event` (Fluent's
   * `onCheckedValueChange(event, { name, checkedItems })`). WaveUI always passes `details`; it is
   * typed optional until 1.0. On a submenu that shares its parent's state it only listens: it is
   * called after the parent's callback, for changes made in this submenu.
   */
  onCheckedValuesChange?: CheckedValuesChangeHandler;
  /**
   * Keep a popup menu open after any of its items is activated; an item's own `persistOnClick`
   * wins. A submenu inherits it unless it sets it.
   * @default false
   */
  persistOnItemClick?: boolean;
  /**
   * Open the popup menu when a mouse pointer rests on its trigger, and close it once the pointer
   * has been off the trigger and the menu for `closeDelay` while focus is not inside the menu. A
   * menu opened by hover does not take focus; a click (or Enter, Space, ArrowDown) on its trigger
   * keeps it open and moves focus into it, as opening it that way does. After Escape or an
   * outside press it does not reopen until the pointer has left the trigger. Touch and pen never
   * open it by hover, and an `aria-disabled` trigger never opens. A triangle between the trigger
   * and the menu keeps it open while the pointer moves diagonally into it. Ignored with
   * `openOnContext` (development warning) and on a static menu (development warning).
   * @default false (true for a submenu)
   */
  openOnHover?: boolean;
  /**
   * Milliseconds a hovering mouse pointer rests on the trigger before the menu opens (mouse hover
   * only). A submenu inherits its parent's, also from a static menu. @default 250
   */
  openDelay?: number;
  /**
   * Milliseconds before a hover-opened menu closes once the mouse pointer has left it and its
   * trigger (mouse hover only). A submenu inherits its parent's, also from a static menu.
   * @default 250
   */
  closeDelay?: number;
  /**
   * Make `Menu.Trigger` a context-menu region: a right click (a Ctrl+click on macOS, a long press
   * where the browser reports one) opens the menu at the pointer, and Shift+F10 or the
   * ContextMenu key opens it at the focused element inside the region, instead of a click; a
   * second gesture while it is open moves it there. Focus returns to the element that had it.
   * The browser's context menu is suppressed there and inside the menu, except in text fields
   * inside the region, which keep it. A press elsewhere, a right click outside or a scroll that
   * moves the region or the row of the gesture (the one under the pointer, or the focused one)
   * closes it. The trigger gets no `aria-haspopup`/`aria-expanded` (it is not a menu button; with
   * a render-prop child, do not spread them): name the menu with `aria-label` on `Menu.Popover`,
   * and consider `aria-keyshortcuts="Shift+F10"` on the region. iOS Safari reports no long press.
   * Ignored on a submenu; `openOnHover` is ignored with it.
   * @default false
   */
  openOnContext?: boolean;
  /**
   * Ref to the static menu element (`role="menu"`). A popup menu renders no root element, so it
   * ignores `ref`, `className` and other DOM props (development warning): pass them to
   * `Menu.Popover`.
   */
  ref?: React.Ref<HTMLDivElement>;
}

const noop = () => {};

/** Default of `openDelay` and `closeDelay` (InfoLabel's hover delays). */
const HOVER_DELAY_MS = 250;

/**
 * Whether the children contain a `Menu.Trigger` or `Menu.Popover`: direct children and the
 * children of Fragments only (other elements and components are not searched). Parts written in
 * a Server Component (lazy client references) are recognised too.
 */
export function hasPopupParts(children: React.ReactNode): boolean {
  return flattenChildren(children).some(({ node }) =>
    isElementOfType(node, MenuTrigger, MenuPopover),
  );
}

/** Joins prop names for a message: `a`, `` `a` and `b` ``. */
function listProps(names: string[]): string {
  const quoted = names.map((name) => `\`${name}\``);
  return quoted.length > 1
    ? `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
    : quoted.join('');
}

// The root of the `Menu` compound. Its component JSDoc is on the `Menu` export (Menu.tsx) only
// (C-DOCS): a docblock here would replace it as the Storybook description.
export const MenuRoot = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  checkedValues,
  defaultCheckedValues,
  onCheckedValuesChange,
  persistOnItemClick: persistOnItemClickProp,
  openOnHover: openOnHoverProp,
  openDelay: openDelayProp,
  closeDelay: closeDelayProp,
  openOnContext: openOnContextProp,
  className,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  onPointerMove,
  ref,
  ...rest
}: MenuProps) => {
  // A Menu rendered in a menu list with no portal between them is a submenu of that list's menu.
  // A Menu inside a Popover or Dialog opened from an item sits one portal deeper: a root menu.
  const list = useMenuListContext();
  const portalDepth = React.useContext(PortalDepthContext);
  const parentList = list !== null && list.portalDepth === portalDepth ? list : null;
  const parent = parentList?.menu ?? null;
  const isSubmenu = parent !== null;

  const [openState, setOpen, openControlled] = useControllable(
    openProp,
    defaultOpen ?? false,
    onOpenChange,
  );
  // The popup menu lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the menu reports itself closed, so the trigger's aria-expanded and
  // aria-controls never describe a menu that is not there. A submenu of a popup menu is open only
  // while that menu is: a parent that closes (through its controlled prop, or while it runs an
  // exit motion) takes the submenu's surface, layer and focus restore along in the same commit.
  const isClient = useIsClient();
  const parentOpen = parent === null || !parent.popup || parent.open;
  const open = openState && isClient && parentOpen;
  // A parent that closed without closing this submenu (its controlled `open` prop): an
  // uncontrolled submenu closes too, so it does not reopen with the parent. A controlled
  // submenu's state is the app's.
  React.useLayoutEffect(() => {
    if (parentOpen || !openState || openControlled) return;
    setOpen(false);
  }, [parentOpen, openState, openControlled, setOpen]);

  const popup =
    openProp !== undefined ||
    defaultOpen !== undefined ||
    onOpenChange !== undefined ||
    hasPopupParts(children);

  const triggerId = useId('wave-menu-trigger');
  const menuId = useId('wave-menu');
  const [labelledBy, setLabelledBy] = React.useState(triggerId);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [triggerElement, setTriggerElementState] = React.useState<HTMLElement | null>(null);
  const setTriggerElement = React.useCallback((element: HTMLElement | null) => {
    triggerRef.current = element;
    setTriggerElementState(element);
  }, []);

  // The open surface: its API in a ref (read in events), its element and layer in state (the
  // hover and context-menu hooks observe them).
  const surfaceApiRef = React.useRef<MenuSurfaceApi | null>(null);
  const [surfaceElement, setSurfaceElement] = React.useState<HTMLElement | null>(null);
  const [surfaceLayerId, setSurfaceLayerId] = React.useState('');
  const registerSurface = React.useCallback((api: MenuSurfaceApi | null) => {
    surfaceApiRef.current = api;
    setSurfaceElement(api?.surface ?? null);
    // Kept after the surface closes: a context gesture records its opener against the last layer.
    if (api) setSurfaceLayerId(api.layerId);
  }, []);

  // Checked values: one state per menu tree. A Menu owns its state when it sets `checkedValues` or
  // `defaultCheckedValues`, or has no parent; otherwise it uses its parent's, and its own
  // `onCheckedValuesChange` only listens to the changes its items make (called after the owner's).
  const ownChecked = useCheckedValues(checkedValues, defaultCheckedValues, onCheckedValuesChange);
  const parentChecked = parent?.checked ?? null;
  const ownsCheckedState =
    parentChecked === null || checkedValues !== undefined || defaultCheckedValues !== undefined;
  const listens = onCheckedValuesChange !== undefined;
  const listener = useEventCallback(onCheckedValuesChange);
  const sharedChecked = React.useMemo(
    () =>
      parentChecked && listens ? withCheckedValuesListener(parentChecked, listener) : parentChecked,
    [parentChecked, listens, listener],
  );
  const checked = ownsCheckedState || sharedChecked === null ? ownChecked : sharedChecked;
  const persistOnItemClick = persistOnItemClickProp ?? parent?.persistOnItemClick ?? false;
  const openDelay = openDelayProp ?? parent?.openDelay ?? HOVER_DELAY_MS;
  const closeDelay = closeDelayProp ?? parent?.closeDelay ?? HOVER_DELAY_MS;

  // Context mode applies to a root popup menu; hover to a popup menu outside context mode.
  const contextMode = popup && !isSubmenu && openOnContextProp === true;
  const hoverMode = popup && !contextMode && (openOnHoverProp ?? isSubmenu);

  // C-DEV: a popup menu renders no root element, so root DOM props and the ref go nowhere.
  const ignoredProps: string[] = [];
  if (popup) {
    if (className !== undefined) ignoredProps.push('className');
    if (onKeyDown !== undefined) ignoredProps.push('onKeyDown');
    if (onKeyDownCapture !== undefined) ignoredProps.push('onKeyDownCapture');
    if (onFocus !== undefined) ignoredProps.push('onFocus');
    if (onPointerMove !== undefined) ignoredProps.push('onPointerMove');
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

  // C-DEV: the popup openings do nothing on a static menu; hover gives way to context gestures.
  const staticPopupProps = popup
    ? ''
    : listProps(
        [openOnHoverProp ? 'openOnHover' : null, openOnContextProp ? 'openOnContext' : null].filter(
          (name): name is string => name !== null,
        ),
      );
  const hoverAndContext = contextMode && openOnHoverProp === true;
  React.useEffect(() => {
    if (!staticPopupProps) return;
    const [verb, pronoun] = staticPopupProps.includes(' and ') ? ['are', 'they'] : ['is', 'it'];
    warnOnce(
      'Menu:static-popup-props',
      `Menu: ${staticPopupProps} ${verb} ignored on a static menu: ${pronoun} apply to a popup menu (Menu.Trigger + Menu.Popover). A static menu passes openDelay and closeDelay on to its submenus.`,
    );
  }, [staticPopupProps]);
  React.useEffect(() => {
    if (!hoverAndContext) return;
    warnOnce(
      'Menu:hover-and-context',
      'Menu: openOnHover is ignored with openOnContext: a context menu opens only from a context gesture (a right click, Shift+F10 or the ContextMenu key).',
    );
  }, [hoverAndContext]);

  const staticMenuRef = React.useRef<HTMLDivElement | null>(null);

  // The open submenu of this menu's list (one at a time) and what focus inside means for the chain.
  const openSubmenuRef = React.useRef<OpenSubmenu | null>(null);
  const containsFocus = useEventCallback((): boolean => {
    const surfaceApi = surfaceApiRef.current;
    const element = surfaceApi?.surface ?? staticMenuRef.current;
    const active = element?.ownerDocument.activeElement;
    if (!element || !active) return false;
    if (element.contains(active)) return true;
    // A popup menu's layer tree holds its submenus and the portals opened from its items; its own
    // elements (the trigger) do not count.
    if (surfaceApi) {
      return getLayerTreeElements(surfaceApi.layerId, { includeOwnElements: false }).some((el) =>
        el.contains(active),
      );
    }
    return openSubmenuRef.current?.containsFocus() ?? false;
  });
  // Focus in a list of the chain: this menu's list, else (recursively) its open submenu's. A
  // portal opened from an item does not count, so hover never takes focus from it.
  const listContainsFocus = useEventCallback((): boolean => {
    const element = surfaceApiRef.current?.surface ?? staticMenuRef.current;
    const active = element?.ownerDocument.activeElement;
    if (element && active && element.contains(active)) return true;
    return openSubmenuRef.current?.listContainsFocus() ?? false;
  });

  // Every close of this menu closes its open submenu first, innermost first, through the
  // submenu's own state: each controlled submenu hears onOpenChange(false) once.
  const requestClose = useEventCallback(() => {
    openSubmenuRef.current?.close();
    setOpen(false);
  });

  // Why the open menu is open: a hover opening stays unpinned (the hover close applies) until the
  // trigger is activated; every other opening (click, keys, context, a controlled `open`) pins it.
  const openReasonRef = React.useRef<'hover' | 'other'>('other');
  const hoverOpenPendingRef = React.useRef(false);
  const initialFocusRef = React.useRef<InitialFocus>('first');
  React.useLayoutEffect(() => {
    if (open) openReasonRef.current = hoverOpenPendingRef.current ? 'hover' : 'other';
    hoverOpenPendingRef.current = false;
  }, [open]);
  const isHoverOpen = React.useCallback(() => openReasonRef.current === 'hover', []);

  const {
    triggerHandlers: hoverIntentTriggerHandlers,
    surfaceHandlers: hoverSurfaceHandlers,
    cancel: cancelHover,
    startClose: startHoverClose,
  } = useHoverIntent({
    enabled: hoverMode,
    open,
    openDelay,
    closeDelay,
    trigger: triggerElement,
    surface: surfaceElement,
    group: parentList?.hoverGroup,
    onOpen: () => {
      hoverOpenPendingRef.current = true;
      initialFocusRef.current = 'none';
      setOpen(true);
    },
    onClose: requestClose,
    // Pinned, or focus inside the menu (not on its trigger): the hover close waits.
    canClose: () => openReasonRef.current === 'hover' && !containsFocus(),
  });

  // A hover opening stays pending until the menu opens, in a later render too (an app that
  // applies it in a transition). One the app has not applied when the pointer leaves the trigger
  // (a controlled menu whose app kept `open` false) is forgotten then, so a later opening by the
  // app is an ordinary one: it focuses the first item and is pinned.
  const forgetHoverOpening = useEventCallback(() => {
    if (open) return;
    hoverOpenPendingRef.current = false;
    if (initialFocusRef.current === 'none') initialFocusRef.current = 'first';
  });
  const hoverTriggerHandlers = React.useMemo<HoverIntent['triggerHandlers']>(
    () => ({
      ...hoverIntentTriggerHandlers,
      onPointerLeave: (event) => {
        hoverIntentTriggerHandlers.onPointerLeave(event);
        forgetHoverOpening();
      },
    }),
    [hoverIntentTriggerHandlers, forgetHoverOpening],
  );

  const openWithFocus = React.useCallback(
    (target: InitialFocus) => {
      // Any opening but hover pins the menu; an open, hover-opened menu is pinned and focused.
      openReasonRef.current = 'other';
      hoverOpenPendingRef.current = false;
      cancelHover();
      const surfaceApi = surfaceApiRef.current;
      if (surfaceApi) {
        if (target === 'last') surfaceApi.focusLast();
        else if (target === 'first') surfaceApi.focusFirst();
        return;
      }
      initialFocusRef.current = target;
      setOpen(true);
    },
    [setOpen, cancelHover],
  );
  const takeInitialFocus = React.useCallback((): InitialFocus => {
    const target = initialFocusRef.current;
    initialFocusRef.current = 'first';
    return target;
  }, []);

  // Context gestures on the trigger region: a context gesture opens the menu (focus on its first
  // item) at the pointer or the focused row; a right click outside or an anchor-moving scroll
  // closes it.
  const {
    anchor: contextAnchor,
    fromContext,
    opener: contextOpener,
    triggerHandlers: contextTriggerHandlers,
    surfaceHandlers: contextSurfaceHandlers,
  } = useContextMenuAnchor({
    enabled: contextMode,
    open,
    trigger: triggerElement,
    layerId: surfaceLayerId,
    onOpen: () => openWithFocus('first'),
    onClose: requestClose,
  });

  // Focus follows the mouse: a submenu that loses focus to an item the pointer is focusing in an
  // enclosing list becomes a hover-opened submenu and closes through the hover close. A submenu
  // with `openOnHover={false}` has no hover close, so it closes at once, as for a keyboard move.
  const parentListHoverFocusing = parentList?.isHoverFocusing;
  const parentHoverFocusing = parent?.isHoverFocusing;
  const isHoverFocusing = useEventCallback(
    (): boolean => (parentListHoverFocusing?.() ?? false) || (parentHoverFocusing?.() ?? false),
  );
  const dismiss = useEventCallback((reason: DismissReason, event: Event) => {
    // Focus moving into a context menu's region does not close it: a right-button (or macOS
    // Ctrl+) press focuses the row under the pointer before the contextmenu event that moves the
    // menu there (Chromium, Firefox). A primary press in the region closes it as an outside press,
    // and Tab through the surface's own handler.
    if (
      reason === 'focus-outside' &&
      contextMode &&
      event.target instanceof Node &&
      triggerRef.current?.contains(event.target)
    ) {
      return;
    }
    if (reason === 'focus-outside' && isSubmenu && hoverMode && isHoverFocusing()) {
      openReasonRef.current = 'hover';
      startHoverClose(event);
      return;
    }
    requestClose();
  });

  const registerOpenSubmenu = React.useCallback((submenu: OpenSubmenu) => {
    const previous = openSubmenuRef.current;
    openSubmenuRef.current = submenu;
    // One open submenu per list: the one open before closes.
    if (previous && previous !== submenu) previous.close();
    return () => {
      if (openSubmenuRef.current === submenu) openSubmenuRef.current = null;
    };
  }, []);

  // A submenu registers with its parent while it is open.
  const submenuHandle = React.useMemo<OpenSubmenu>(
    () => ({ close: requestClose, containsFocus, listContainsFocus }),
    [requestClose, containsFocus, listContainsFocus],
  );
  const registerWithParent = parent?.registerOpenSubmenu;
  React.useLayoutEffect(() => {
    if (!open || !registerWithParent) return undefined;
    return registerWithParent(submenuHandle);
  }, [open, registerWithParent, submenuHandle]);

  // Item activation and Tab close the whole chain: a submenu of a popup menu hands the close up,
  // and the top menu (the root, or a submenu of a static menu) puts focus on its return target
  // first (focus before close: a Dialog an item opens returns focus there), then closes.
  const parentCloseChain = parent?.popup ? parent.closeChain : null;
  const closeChain = useEventCallback(() => {
    if (parentCloseChain) {
      parentCloseChain();
      return;
    }
    if (!popup) return;
    const target = surfaceApiRef.current?.getReturnFocus() ?? null;
    if (target) {
      const doc = target.ownerDocument;
      const active = doc.activeElement;
      const lost = !active || active === doc.body || active === doc.documentElement;
      if (lost || containsFocus()) target.focus({ preventScroll: true });
    }
    requestClose();
  });

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
      parent,
      checked,
      persistOnItemClick,
      isSubmenu,
      requestClose,
      closeChain,
      registerOpenSubmenu,
      containsFocus,
      listContainsFocus,
      openDelay,
      closeDelay,
      dismiss,
      isHoverFocusing,
      isHoverOpen,
      hoverTriggerHandlers,
      hoverSurfaceHandlers,
      openOnContext: contextMode,
      contextTriggerHandlers,
      contextSurfaceHandlers,
      contextAnchor,
      fromContext,
      contextOpener,
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
      parent,
      checked,
      persistOnItemClick,
      isSubmenu,
      requestClose,
      closeChain,
      registerOpenSubmenu,
      containsFocus,
      listContainsFocus,
      openDelay,
      closeDelay,
      dismiss,
      isHoverFocusing,
      isHoverOpen,
      hoverTriggerHandlers,
      hoverSurfaceHandlers,
      contextMode,
      contextTriggerHandlers,
      contextSurfaceHandlers,
      contextAnchor,
      fromContext,
      contextOpener,
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

  // The static menu is a menu list: its items close nothing when activated, and the item under
  // the mouse takes focus while focus is inside the menu tree.
  const registerCheckable = useCheckableRegistry();
  const {
    hoverGroup,
    isHoverFocusing: isListHoverFocusing,
    onPointerMove: listPointerMove,
  } = useMenuListPointer(contextValue);
  const listContext = React.useMemo<MenuListContextValue>(
    () => ({
      menu: contextValue,
      isStatic: true,
      portalDepth,
      closeFromItem: noop,
      registerCheckable,
      hoverGroup,
      isHoverFocusing: isListHoverFocusing,
    }),
    [contextValue, portalDepth, registerCheckable, hoverGroup, isListHoverFocusing],
  );

  if (popup) {
    return <MenuContext.Provider value={contextValue}>{children}</MenuContext.Provider>;
  }

  return (
    <MenuContext.Provider value={contextValue}>
      <MenuListContext.Provider value={listContext}>
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
          onPointerMove={composeEventHandlers(onPointerMove, listPointerMove)}
          className={cn(menuSurfaceClasses, focusRing, className)}
        >
          {children}
        </div>
      </MenuListContext.Provider>
    </MenuContext.Provider>
  );
};
MenuRoot.displayName = 'Menu';
