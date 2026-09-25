import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PopupAlign, PopupSide, PopupTarget } from '../../lib/types';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import { isConnectedAndFocusable } from '../../lib/focus';
import { useDismiss } from '../../hooks/useDismiss';
import { useEventCallback } from '../../hooks/useEventCallback';
import { createHoverIntentGroup, type HoverIntentGroup } from '../../hooks/useHoverIntent';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { usePresence } from '../../hooks/usePresence';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { getTriggerFocusTarget, useTriggerFocusRef } from '../../hooks/useTriggerElement';
import { Portal, PortalDepthContext } from '../portal/Portal';
import { MenuListContext, useCheckableRegistry, useMenuContext } from './Menu.context';
import type { MenuContextValue, MenuListContextValue } from './Menu.context';
import {
  MENU_ITEM_SELECTOR,
  menuPopoverClasses,
  useStaticMenuPartWarning,
  withTypeaheadText,
} from './Menu.shared';

/** Properties for the MenuPopover sub-component. */
export interface MenuPopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'id'> {
  /**
   * Side of the trigger the menu opens on (`start`/`end` follow the writing direction).
   * @default 'bottom' ('end' in a submenu)
   */
  side?: PopupSide;
  /** Alignment along that side. @default 'start' */
  align?: PopupAlign;
  /** Distance from the trigger in px. @default 4 (0 in a submenu) */
  offset?: number;
  /**
   * Where to place the menu instead of next to `Menu.Trigger`: an element or a `VirtualElement`
   * (a rectangle, such as a point; an inline object is fine). With a controlled `open`, a menu
   * with a `target` needs no trigger; name it with `aria-label`, and give a toggle button you use
   * as the target `aria-haspopup="menu"` and `aria-expanded` yourself (the menu's `id` is
   * generated, so the toggle cannot point `aria-controls` at it). A press on a target element
   * does not close the menu. Hold the element in state (a ref cannot be observed;
   * TeachingPopover's `target` also takes a ref). A menu opened by `openOnContext` is placed at
   * the gesture instead.
   */
  target?: PopupTarget;
  /** Menu items and dividers. */
  children: React.ReactNode;
  /**
   * Ref to the portaled `role="menu"` surface. Its `id` is generated (the trigger's
   * `aria-controls` points to it), and it is labelled by the trigger unless `aria-label` is given.
   */
  ref?: React.Ref<HTMLDivElement>;
}

/** Whether a `target` is an element (duck typed, so an element of another realm counts). */
function isElementTarget(target: PopupTarget | undefined): target is HTMLElement {
  return !!target && (target as Partial<Node>).nodeType === 1;
}

/**
 * Internal: the mouse behaviour of a menu list (the static root and every `Menu.Popover`
 * surface). While focus is inside the menu tree (the chain's root list or any of its submenus), a
 * mouse `pointermove` over an enabled item of this list focuses it (`preventScroll`), unless it
 * already has focus or a submenu's safe zone of this list holds the point. Hover moves no focus
 * while focus is elsewhere, so a hover-opened menu or a static menu the user is not in never takes
 * focus from the page. Also returns the list's hover group (the safe zones of its submenu trigger
 * items) and the flag the submenus of the list read while such a focus change runs.
 */
export function useMenuListPointer(menu: MenuContextValue): {
  hoverGroup: HoverIntentGroup;
  isHoverFocusing: () => boolean;
  onPointerMove: React.PointerEventHandler<HTMLElement>;
} {
  const [hoverGroup] = React.useState(createHoverIntentGroup);
  const hoverFocusingRef = React.useRef(false);
  const isHoverFocusing = React.useCallback(() => hoverFocusingRef.current, []);
  const onPointerMove = useEventCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen' || !isOwnEvent(event)) return;
    const target = event.target as Element;
    const item = target.closest<HTMLElement>(MENU_ITEM_SELECTOR);
    if (!item || !event.currentTarget.contains(item)) return;
    if (item.getAttribute('aria-disabled') === 'true') return;
    if (item.ownerDocument.activeElement === item) return;
    let root = menu;
    while (root.parent) root = root.parent;
    if (!root.containsFocus() || hoverGroup.isHeld(event.clientX, event.clientY)) return;
    hoverFocusingRef.current = true;
    item.focus({ preventScroll: true });
    // A submenu that just lost focus is dismissed (focus outside) in a microtask the focus change
    // queued; the flag is cleared after it.
    queueMicrotask(() => {
      hoverFocusingRef.current = false;
    });
  });
  return { hoverGroup, isHoverFocusing, onPointerMove };
}

/**
 * The portaled `role="menu"` surface of a popup menu, positioned next to `Menu.Trigger`. A menu
 * taller than the space available scrolls inside the viewport: the surface is limited to the space
 * next to the trigger (`max-height`/`max-width` classes, which a `max-h-*`/`max-w-*` class in
 * `className` or a `style` replaces) and scrolls, and an item that receives focus is scrolled into
 * view. Focus moves to the first (ArrowUp: last) enabled item when it opens; arrows, Home/End and
 * typeahead move between enabled items. Escape closes it and returns focus to the trigger. An
 * outside press closes it and leaves focus where the press put it (on the trigger only when focus
 * was still in the menu or lost to the page). Tab closes it and moves focus to the trigger without
 * preventing the default, so tabbing continues from the trigger (inside a Dialog, the focus trap
 * moves on from there). The trigger here is the element that takes its focus: for a wrapper span,
 * the element inside it that carries the state ARIA (the span itself when you made it the trigger
 * with a `role` such as `button` and `tabIndex={0}`, or when nothing inside it can take focus).
 * Keys from a portal opened inside the menu (a Popover of an item) are left to that portal: Tab
 * there moves on inside it and keeps the menu open.
 *
 * In a submenu it opens at the end side of its trigger item (`side="end"`, `offset={0}`) and
 * flips to fit the viewport. ArrowLeft (ArrowRight in RTL) and Escape close only the submenu and
 * return focus to its trigger item; item activation and Tab close every menu of the chain and put
 * focus on the root trigger.
 *
 * While focus is inside the menu (or one of its submenus), the item under the mouse pointer takes
 * focus, so Enter activates the item you point at.
 *
 * A context menu (`openOnContext`) opens at the pointer or at the focused row and returns focus to
 * the element focused at the gesture; it is not labelled by its region, so give it `aria-label`
 * (development warning otherwise), as for a menu placed at a `target` without `Menu.Trigger`.
 *
 * The surface mounts through the presence core (`usePresence`): it carries
 * `data-presence="entering" | "entered" | "exiting"` and, while it closes, `data-state="closed"`
 * and `inert`, so exit motion classes on `data-presence` keep it on screen until they end. Focus,
 * the dismiss layer and positioning follow the open state, not the exit. Without motion it unmounts
 * as soon as it closes.
 *
 * Also exported as `MenuPopover` (import the flat name from React Server Components).
 */
export const MenuPopover = ({
  side,
  align = 'start',
  offset,
  target,
  children,
  className,
  style,
  onKeyDown,
  onKeyDownCapture,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onContextMenu,
  ref,
  ...rest
}: MenuPopoverProps) => {
  const menu = useMenuContext('Menu.Popover');
  const {
    popup,
    open,
    takeInitialFocus,
    registerSurface,
    menuId,
    labelledBy,
    triggerRef,
    triggerElement,
    isSubmenu,
    requestClose,
    closeChain,
    dismiss,
    hoverSurfaceHandlers,
    openOnContext,
    contextSurfaceHandlers,
    contextAnchor,
    fromContext,
    contextOpener,
  } = menu;
  useStaticMenuPartWarning('Menu.Popover', popup);
  const targetElement = isElementTarget(target) ? target : null;

  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const setSurfaceElement = React.useCallback((element: HTMLDivElement | null) => {
    surfaceRef.current = element;
    setSurface(element);
  }, []);

  // The surface mounts and unmounts through the presence core; everything else below keys on
  // `open`, so focus returns and the layer goes on close, not after an exit motion.
  const { isMounted, ref: presenceRef, presenceProps } = usePresence(open);

  const { setReference, setFloating, floatingProps, isPositioned } = usePopupPosition({
    open,
    side: side ?? (isSubmenu ? 'end' : 'bottom'),
    align,
    offset: offset ?? (isSubmenu ? 0 : 4),
    fitViewport: true,
  });
  // The size limits come from menuPopoverClasses, which a consumer class can replace; an inline
  // max-height/max-width would beat every class.
  const { maxHeight: _maxHeight, maxWidth: _maxWidth, ...positionStyle } = floatingProps.style;
  // The positioning reference: the anchor of a context gesture (the point, else the focused row,
  // else the trigger's focus target), else `target`, else the trigger. Kept while the surface
  // exits, so it does not jump; a new inline VirtualElement only recomputes the position.
  React.useLayoutEffect(() => {
    setReference(
      fromContext
        ? (contextAnchor ?? getTriggerFocusTarget(triggerElement) ?? triggerElement)
        : (target ?? triggerElement),
    );
  }, [setReference, contextAnchor, fromContext, target, triggerElement]);

  // Where focus returns when the menu closes (item activation, Tab, Escape): in a context menu,
  // the element focused at the gesture when it can take focus; else the element that takes focus
  // for the trigger (for a wrapper span, the element inside it that carries the state ARIA; for a
  // submenu, its trigger item); else a focusable `target` element.
  const getReturnFocus = useEventCallback((): HTMLElement | null => {
    const opener = openOnContext ? contextOpener.current : null;
    if (opener && isConnectedAndFocusable(opener)) return opener;
    const triggerTarget = getTriggerFocusTarget(triggerRef.current);
    if (triggerTarget) return triggerTarget;
    return targetElement && isConnectedAndFocusable(targetElement) ? targetElement : null;
  });

  // The layer's anchor (where a surface opened from an item that is gone by then restores focus):
  // the return target, else the trigger itself.
  const returnFocusRef = React.useMemo<React.RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        return getReturnFocus() ?? triggerRef.current;
      },
    }),
    [getReturnFocus, triggerRef],
  );
  // A context region is not part of the layer (a press on another row closes the menu), and a
  // Ctrl+press there is a macOS context click, which moves the menu instead; a target element is.
  const targetRef = { current: targetElement };
  const { layerId } = useDismiss({
    open,
    onDismiss: dismiss,
    refs: openOnContext ? [surfaceRef, targetRef] : [surfaceRef, triggerRef, targetRef],
    anchorRef: returnFocusRef,
    kind: 'menu',
    focusOutside: true,
    outsidePress: openOnContext
      ? (event) =>
          !(
            event.ctrlKey &&
            event.target instanceof Node &&
            triggerRef.current?.contains(event.target)
          )
      : true,
  });

  const triggerFocusRef = useTriggerFocusRef(triggerRef);

  // The element focused when the menu opened, captured as useRestoreFocus captures its opener: in
  // the commit that opens the menu, before the initial focus moves into it; the trigger's focus
  // target first (not in a context menu, whose region is no opener), else the focused element.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  const captureOpener = useEventCallback(() => {
    const container = surfaceRef.current;
    const doc = (triggerRef.current ?? container)?.ownerDocument ?? document;
    const isCandidate = (el: Element | null | undefined): el is HTMLElement =>
      !!el && el !== doc.body && el !== doc.documentElement && !container?.contains(el);
    const trigger = openOnContext ? null : triggerFocusRef.current;
    const active = doc.activeElement;
    openerRef.current = isCandidate(trigger) ? trigger : isCandidate(active) ? active : null;
  });
  React.useInsertionEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) captureOpener();
  });
  // Where focus goes when the menu closes with focus inside it (Escape, a close by the app): where
  // useRestoreFocus would put it, in its order: the context opener, the element focused when the
  // menu opened, then the return target (a menu with a `target` and no trigger returns focus to
  // its opener, not to a focusable target element).
  const getCloseFocus = useEventCallback((): HTMLElement | null => {
    const container = surfaceRef.current;
    const candidates = [
      openOnContext ? contextOpener.current : null,
      openerRef.current,
      getReturnFocus(),
    ];
    return (
      candidates.find(
        (el): el is HTMLElement => !!el && isConnectedAndFocusable(el) && !container?.contains(el),
      ) ?? null
    );
  });

  useRestoreFocus({
    enabled: open,
    container: surface,
    // A context menu returns focus to the opener (the focused row), not to the region.
    triggerRef: openOnContext ? undefined : triggerFocusRef,
    finalFocusRef: openOnContext ? contextOpener : undefined,
    fallback: getReturnFocus,
    onlyIfFocusInside: true,
  });

  // C-DEV: a surface that no trigger labels needs its own name.
  const unnamed =
    isMounted &&
    (openOnContext || (target != null && !triggerElement)) &&
    rest['aria-label'] === undefined &&
    rest['aria-labelledby'] === undefined;
  React.useEffect(() => {
    if (!unnamed) return;
    warnOnce(
      'Menu.Popover:name',
      'Menu.Popover: this menu has no trigger to name it (a context menu, or a menu placed at a `target` without Menu.Trigger): give Menu.Popover an aria-label or aria-labelledby.',
    );
  }, [unnamed]);

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

  const mergedRef = useMergedRefs<HTMLDivElement>(
    ref,
    setSurfaceElement,
    rovingRef,
    setFloating,
    presenceRef,
  );

  // Lets the trigger move focus into an already open menu (ArrowDown/ArrowUp on the trigger) and
  // the root reach the surface. Only an open surface registers, and it unregisters in the commit
  // that closes the menu: a surface that stays mounted while it exits would otherwise make the next
  // opening focus its (inert) items instead of opening the menu.
  React.useLayoutEffect(() => {
    if (!surface || !open) return;
    registerSurface({ focusFirst, focusLast, surface, layerId, getReturnFocus });
    return () => registerSurface(null);
  }, [surface, open, registerSurface, focusFirst, focusLast, layerId, getReturnFocus]);

  // Focus before close, on every close: when the menu closes with focus inside it, focus moves to
  // where the restore would put it (`getCloseFocus`) in the closing commit's mutation phase (a
  // layout effect cleanup), before a surface opened in the same update (a Dialog rendered after
  // the menu, opened by the item that closed it) records the focused element as its opener. The
  // closing surface is still in the document then (it unmounts once its exit phase ends), so that
  // opener would be its item, gone by the time the Dialog closes. The surface is inert from this
  // commit on, so in a browser React cannot put focus back on the item after the commit, and
  // useRestoreFocus, which then finds focus outside, leaves it there: the two must agree on the
  // target. Unmounting is left to useRestoreFocus.
  const unmountingRef = React.useRef(false);
  React.useLayoutEffect(() => {
    unmountingRef.current = false;
    return () => {
      unmountingRef.current = true;
    };
  }, []);
  const focusReturnTargetOnClose = useEventCallback(() => {
    const surfaceElement = surfaceRef.current;
    const active = surfaceElement?.ownerDocument.activeElement;
    if (unmountingRef.current || !surfaceElement || !active || !surfaceElement.contains(active)) {
      return;
    }
    getCloseFocus()?.focus({ preventScroll: true });
  });
  React.useLayoutEffect(() => {
    if (!open) return undefined;
    return focusReturnTargetOnClose;
  }, [open, focusReturnTargetOnClose]);

  // Initial focus: the first (or last) enabled item, unless focus is already inside. A hover
  // opening moves no focus.
  React.useLayoutEffect(() => {
    if (!open || !surface) return;
    if (surface.contains(surface.ownerDocument.activeElement)) return;
    const target = takeInitialFocus();
    if (target === 'last') focusLast();
    else if (target === 'first') focusFirst();
  }, [open, surface, takeInitialFocus, focusFirst, focusLast]);

  // The initial focus lands before the surface is limited to the available height (floating-ui
  // measures after mount), so it scrolls nothing: once positioned, the focused item (the last one
  // after ArrowUp) is scrolled into view. Later focus moves scroll through the native focus().
  React.useLayoutEffect(() => {
    if (!isPositioned || !surface) return;
    const active = surface.ownerDocument.activeElement as HTMLElement | null;
    if (active && active !== surface && surface.contains(active)) {
      active.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isPositioned, surface]);

  // The list the items render in. Its children sit inside the Portal, one portal level deeper.
  // Item activation closes the whole chain; the item under the mouse takes focus while focus is
  // inside the menu tree.
  const portalDepth = React.useContext(PortalDepthContext) + 1;
  const registerCheckable = useCheckableRegistry();
  const { hoverGroup, isHoverFocusing, onPointerMove: listPointerMove } = useMenuListPointer(menu);
  const listContext = React.useMemo<MenuListContextValue>(
    () => ({
      menu,
      isStatic: false,
      portalDepth,
      closeFromItem: closeChain,
      registerCheckable,
      hoverGroup,
      isHoverFocusing,
    }),
    [menu, portalDepth, closeChain, registerCheckable, hoverGroup, isHoverFocusing],
  );

  // C-COMPOSE: the consumer's onKeyDown runs first; preventDefault() skips the built-in keys. A key
  // from a portal opened inside the menu (a Popover of an item, a submenu) is that portal's: Tab
  // moves on inside it and never closes the menu.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !isOwnEvent(event)) return;
    if (event.key === 'Tab') {
      // Close every menu of the chain and put focus on the root trigger; the default Tab action
      // then continues from there.
      closeChain();
      return;
    }
    // "Previous" (ArrowLeft, ArrowRight in RTL) closes a submenu and returns to its trigger item.
    if (
      isSubmenu &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !isEditableTarget(event.target) &&
      getArrowIntent(event.key, {
        orientation: 'horizontal',
        dir: getDirection(event.currentTarget),
      }) === 'prev'
    ) {
      event.preventDefault();
      getReturnFocus()?.focus({ preventScroll: true });
      requestClose();
      return;
    }
    rovingKeyDown(event);
  };

  if (!isMounted) return null;

  return (
    <Portal layerId={layerId}>
      <MenuListContext.Provider value={listContext}>
        <div
          role="menu"
          aria-labelledby={
            // A context region's whole text is no name: a context menu is named by aria-label.
            triggerElement && !openOnContext && rest['aria-label'] === undefined
              ? labelledBy
              : undefined
          }
          {...rest}
          {...presenceProps}
          ref={mergedRef}
          id={menuId}
          data-state={open ? 'open' : 'closed'}
          data-side={floatingProps['data-side']}
          data-align={floatingProps['data-align']}
          data-roving-container=""
          style={{ ...positionStyle, ...style }}
          onKeyDown={handleKeyDown}
          onKeyDownCapture={withTypeaheadText(
            composeEventHandlers(onKeyDownCapture, rovingKeyDownCapture),
          )}
          onFocus={composeEventHandlers(onFocus, rovingFocus, { checkDefaultPrevented: false })}
          onPointerEnter={composeEventHandlers(onPointerEnter, hoverSurfaceHandlers.onPointerEnter)}
          onPointerLeave={composeEventHandlers(onPointerLeave, hoverSurfaceHandlers.onPointerLeave)}
          onPointerMove={composeEventHandlers(onPointerMove, listPointerMove)}
          onContextMenu={composeEventHandlers(onContextMenu, contextSurfaceHandlers.onContextMenu)}
          className={cn(menuPopoverClasses, className)}
        >
          {children}
        </div>
      </MenuListContext.Provider>
    </Portal>
  );
};
MenuPopover.displayName = 'MenuPopover';
