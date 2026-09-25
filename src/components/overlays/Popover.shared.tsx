import * as React from 'react';
import { cn } from '../../lib/cn';
import { focusElement, getLastTabbable, getTabbableElements } from '../../lib/focus';
import type { UsePopupPositionResult } from '../../hooks/usePopupPosition';
import { useEventCallback } from '../../hooks/useEventCallback';

// Parts shared by the anchored popups of this folder: Popover.Content and TeachingPopover with a
// `target`. Internal: not exported from the barrels.

/** Final physical side of a positioned surface (the `side` result of `usePopupPosition`). */
export type PopoverPhysicalSide = UsePopupPositionResult['side'];

/** Borders of the rotated square beak that face the anchor, per final physical side. */
const BEAK_BORDER: Record<PopoverPhysicalSide, string> = {
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  top: 'border-b border-r',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  bottom: 'border-t border-l',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  left: 'border-t border-r',
  // wave-allow-physical: the beak follows the physical side resolved by the positioning
  right: 'border-b border-l',
};

/** Properties for the internal PopoverBeak. */
export interface PopoverBeakProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Final physical side of the surface; the beak is drawn on the edge that faces the anchor. */
  side: PopoverPhysicalSide;
  /** Ref to the beak: pass it to `usePopupPosition` as `arrowRef`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The beak of an anchored surface: a rotated square, hidden from assistive technology, that
 * inherits the surface's background and border colors (so a `className` that changes them
 * restyles the beak too). Position it with the `arrowStyles` of `usePopupPosition`; its size
 * matches the `--wave-popup-arrow-size` the arrow offset is computed from.
 */
export const PopoverBeak = ({ side, className, ref, ...rest }: PopoverBeakProps) => (
  <div
    ref={ref}
    aria-hidden="true"
    {...rest}
    className={cn('size-2 rotate-45 border-inherit bg-inherit', BEAK_BORDER[side], className)}
  />
);
PopoverBeak.displayName = 'PopoverBeak';

/**
 * The tabbable elements of the anchor's document, in sequential focus order, that are in the same
 * portal as the anchor (or, like it, in the page) and outside `exclude`. `order` is the document's
 * tabbable elements when the caller has them already.
 */
function getScopedTabbables(
  anchor: HTMLElement,
  exclude: HTMLElement,
  order: readonly HTMLElement[] = getTabbableElements(anchor.ownerDocument.body),
): HTMLElement[] {
  const scope = anchor.closest('[data-wave-portal]');
  return order.filter((el) => !exclude.contains(el) && el.closest('[data-wave-portal]') === scope);
}

/**
 * The first tabbable element after `anchor` in document order, not inside it, in the same portal
 * as the anchor and outside `exclude`: the tab stop after a surface placed right after the anchor.
 * Pass the document's tabbable elements as `order` when you have them, to spare a second scan.
 */
export function getTabbableAfter(
  anchor: HTMLElement,
  exclude: HTMLElement,
  order?: readonly HTMLElement[],
): HTMLElement | null {
  return (
    getScopedTabbables(anchor, exclude, order).find(
      (el) =>
        !anchor.contains(el) &&
        !!(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    ) ?? null
  );
}

/**
 * The last tabbable element that is `anchor`, inside it or before it in document order, in the
 * same portal as the anchor and outside `exclude`: the tab stop before a surface placed right
 * after the anchor. Pass the document's tabbable elements as `order` when you have them.
 */
export function getTabbableThrough(
  anchor: HTMLElement,
  exclude: HTMLElement,
  order?: readonly HTMLElement[],
): HTMLElement | null {
  const through = getScopedTabbables(anchor, exclude, order).filter(
    (el) =>
      anchor.contains(el) ||
      !!(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING),
  );
  return through[through.length - 1] ?? null;
}

function focusInstead(event: { preventDefault(): void }, target: HTMLElement | null): void {
  if (!target) return;
  event.preventDefault();
  target.focus();
}

function isNothing(doc: Document, node: EventTarget | null): boolean {
  return !node || node === doc.body || node === doc.documentElement;
}

/**
 * Hides `surface` (`visibility: hidden`) for the native Tab in progress, so the browser moves past
 * its elements. It is shown again as soon as focus moves (the `focusout` of that Tab, before the
 * next element takes focus), or before the next frame when the Tab moves nothing.
 */
function hideForNativeTab(surface: HTMLElement): void {
  const doc = surface.ownerDocument;
  const win = doc.defaultView;
  const { style } = surface;
  const value = style.getPropertyValue('visibility');
  const priority = style.getPropertyPriority('visibility');
  style.setProperty('visibility', 'hidden', 'important');
  let frame: number | undefined;
  const show = () => {
    doc.removeEventListener('focusout', show, true);
    if (frame !== undefined) win?.cancelAnimationFrame(frame);
    frame = undefined;
    // Left alone when something else changed it meanwhile.
    const ours =
      style.getPropertyValue('visibility') === 'hidden' &&
      style.getPropertyPriority('visibility') === 'important';
    if (!ours) return;
    if (value) style.setProperty('visibility', value, priority);
    else style.removeProperty('visibility');
  };
  doc.addEventListener('focusout', show, true);
  if (win) frame = win.requestAnimationFrame(show);
}

/**
 * What the document knows about focus that arrives from nothing (the body): whether it can come
 * from the browser's own controls. The listeners are installed while a {@link usePopoverTabOrder}
 * is mounted, open or not, so the press that opened a surface counts too.
 */
interface FocusOrigin {
  /** Mounted `usePopoverTabOrder` instances. */
  users: number;
  /**
   * A pointer press (`pointerdown`/`mousedown`) came since the window last lost focus. The user is
   * then in the page, not arriving from the browser's controls, which the window must lose focus
   * to reach: a key press does not clear it.
   */
  pressed: boolean;
  /**
   * The element that had focus when the window lost it: the browser focuses it again, from
   * nothing, when the window gets focus back. Cleared by the next `focusin`.
   */
  refocus: EventTarget | null;
  /**
   * The window has just got focus back: no element took focus since, and no key or pointer press
   * reached the page. Sequential navigation from the browser's own controls gives the window focus
   * right before the element it reaches; focus that arrives from nothing without it comes from the
   * page (a focus restore after the focused element was removed, a script).
   */
  windowFocused: boolean;
  /**
   * Counts the events that end a key press's focus change: key presses and releases, pointer
   * presses, `focusin` and the window's blur and focus. An entry the `keydown` of a Tab expects
   * applies only to the `focusin` of that same Tab.
   */
  epoch: number;
  /** Removes the listeners; `null` while none are installed. */
  uninstall: (() => void) | null;
}

const focusOrigin: FocusOrigin = {
  users: 0,
  pressed: false,
  refocus: null,
  windowFocused: false,
  epoch: 0,
  uninstall: null,
};

function retainFocusOrigin(): () => void {
  if (typeof document === 'undefined') return () => {};
  focusOrigin.users += 1;
  if (!focusOrigin.uninstall) {
    const doc = document;
    const win = doc.defaultView;
    const onPress = () => {
      focusOrigin.epoch += 1;
      focusOrigin.pressed = true;
      focusOrigin.windowFocused = false;
    };
    const onKey = () => {
      focusOrigin.epoch += 1;
      focusOrigin.windowFocused = false;
    };
    // Not capture listeners: they hear only the window's own blur and focus (an element's do not
    // bubble).
    const onWindowBlur = () => {
      focusOrigin.epoch += 1;
      focusOrigin.pressed = false;
      focusOrigin.windowFocused = false;
      const active = doc.activeElement;
      focusOrigin.refocus = isNothing(doc, active) ? null : active;
    };
    const onWindowFocus = () => {
      focusOrigin.epoch += 1;
      focusOrigin.windowFocused = true;
    };
    // Bubbling to the document, after the surfaces' own `focusin` listeners have read the state.
    const onFocusIn = () => {
      focusOrigin.epoch += 1;
      focusOrigin.refocus = null;
      focusOrigin.windowFocused = false;
    };
    // Capture: a handler that stops a press or a key from propagating must not hide it.
    doc.addEventListener('pointerdown', onPress, true);
    doc.addEventListener('mousedown', onPress, true);
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('keyup', onKey, true);
    doc.addEventListener('focusin', onFocusIn);
    win?.addEventListener('blur', onWindowBlur);
    win?.addEventListener('focus', onWindowFocus);
    focusOrigin.uninstall = () => {
      doc.removeEventListener('pointerdown', onPress, true);
      doc.removeEventListener('mousedown', onPress, true);
      doc.removeEventListener('keydown', onKey, true);
      doc.removeEventListener('keyup', onKey, true);
      doc.removeEventListener('focusin', onFocusIn);
      win?.removeEventListener('blur', onWindowBlur);
      win?.removeEventListener('focus', onWindowFocus);
      focusOrigin.pressed = false;
      focusOrigin.refocus = null;
      focusOrigin.windowFocused = false;
    };
  }
  let retained = true;
  return () => {
    if (!retained) return;
    retained = false;
    focusOrigin.users = Math.max(0, focusOrigin.users - 1);
    if (focusOrigin.users > 0) return;
    focusOrigin.uninstall?.();
    focusOrigin.uninstall = null;
  };
}

/** Options of {@link usePopoverTabOrder}. */
export interface PopoverTabOrderOptions {
  /** Whether the surface is shown next to its anchor; the listeners exist only while `true`. */
  enabled: boolean;
  /** The portaled surface, held in state through its callback ref. */
  surface: HTMLElement | null;
  /** The anchor: the surface takes its place in the keyboard order right after it. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /**
   * The tab stop before the surface's place: Tab from it enters the surface, and Shift+Tab from
   * the surface's first element returns to it. `order`, when given, is the document's tabbable
   * elements.
   */
  getPreviousStop: (
    anchor: HTMLElement,
    surface: HTMLElement,
    order?: readonly HTMLElement[],
  ) => HTMLElement | null;
}

/**
 * Keyboard order of a surface portaled to the end of the document, as if it were rendered right
 * after its anchor (the order of 0.4's inline content). Returns the surface's `onKeyDown`; while
 * `enabled`, a document `keydown` listener and a `focusin` listener on the surface do the rest.
 * While mounted, shared document listeners record pointer presses, key presses and the window's
 * blur and focus.
 *
 * - Tab from the previous stop enters the surface at its first tabbable element, and Shift+Tab
 *   from the tab stop after the anchor enters it at its last one.
 * - Tab past the surface's last element continues after the anchor; Shift+Tab from its first
 *   element (or from the surface itself) returns to the previous stop.
 * - The surface is not visited a second time where its portal is. Tab from the element before
 *   the portal moves past the surface (it is hidden for that one Tab), to what follows it or out
 *   of the page. Shift+Tab from the browser's own controls (the window gets focus back just before
 *   it), or from nothing without a pointer press, lands on the surface's last element as the
 *   document's last one: focus goes to the last element of the page instead, unless that is the
 *   previous stop (the surface then ends the order). A lap in either direction visits every
 *   element once, and there is no Tab cycle.
 * - Every other entry keeps the place after the anchor: a click, Shift+Tab from a pressed point,
 *   focus restored from nothing (a layer opened from the surface's last element closed), a
 *   script, focus that returns to an element as the window gets focus back, and focus the content
 *   takes as it mounts (`autoFocus`, before the listeners exist).
 * - Content that the Tab from the page still reaches (it shows itself again before the browser
 *   moves focus) follows the document order from there, so Tab past it leaves the page rather
 *   than jumping back to the anchor.
 *
 * Every Tab outside the surface costs one scan of the document's tabbable elements. The listeners
 * skip events whose default is already prevented; React handlers (a trigger's own `onKeyDown`,
 * the returned one) run before them and before a dialog's focus trap.
 */
export function usePopoverTabOrder({
  enabled,
  surface,
  anchorRef,
  getPreviousStop,
}: PopoverTabOrderOptions): React.KeyboardEventHandler<HTMLElement> {
  const getPrevious = useEventCallback(getPreviousStop);
  /** How focus last entered the surface: at its place after the anchor, or at the portal's. */
  const entryRef = React.useRef<'anchor' | 'page'>('anchor');
  /**
   * Where the Tab being pressed enters the surface natively: at `element`, from the page (had it
   * not moved past the surface) or, Shift+Tab from nothing, at the document's far end. Valid in
   * the `focusin` of that Tab only (same `epoch`).
   */
  const pendingRef = React.useRef<{
    element: HTMLElement;
    from: 'page' | 'far-end';
    epoch: number;
  } | null>(null);

  const onDocumentKeyDown = useEventCallback((event: KeyboardEvent) => {
    pendingRef.current = null;
    const anchor = anchorRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !anchor || !surface) return;
    const doc = surface.ownerDocument;
    const active = doc.activeElement as HTMLElement | null;
    if (active && surface.contains(active)) return;
    // One scan of the document; everything below is derived from it.
    const order = getTabbableElements(doc.body);
    const inside = order.filter((el) => surface.contains(el));
    const first = inside[0];
    const last = inside[inside.length - 1];
    if (!first || !last) return;
    if (!active || isNothing(doc, active)) {
      // With no pointer press to start from, Shift+Tab from nothing reaches the document's last
      // element.
      if (event.shiftKey && !focusOrigin.pressed && order[order.length - 1] === last) {
        pendingRef.current = { element: last, from: 'far-end', epoch: focusOrigin.epoch };
      }
      return;
    }
    if (event.shiftKey) {
      if (active === getTabbableAfter(anchor, surface, order)) focusInstead(event, last);
      return;
    }
    if (active === getPrevious(anchor, surface, order)) {
      focusInstead(event, first);
      return;
    }
    const index = order.indexOf(active);
    if (index === -1 || order[index + 1] !== first) return;
    // The browser would enter the surface where its portal is: the surface was visited after the
    // anchor, so move past it.
    pendingRef.current = { element: first, from: 'page', epoch: focusOrigin.epoch };
    hideForNativeTab(surface);
  });

  // Installed while mounted, not only while enabled: the press that opens the surface counts.
  React.useEffect(() => retainFocusOrigin(), []);

  React.useEffect(() => {
    if (!enabled || !surface) return;
    const doc = surface.ownerDocument;
    // A new surface, or one shown again: focus it took as it mounted (before this listener) was
    // not a native entry from the page, and an earlier entry no longer applies.
    entryRef.current = 'anchor';
    const onFocusIn = (event: FocusEvent) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      const from = event.relatedTarget as Node | null;
      if (from && surface.contains(from)) return;
      const entered = event.target;
      // The window got focus back: focus returns to where it was, in the order it had there.
      if (!from && entered === focusOrigin.refocus) return;
      const expected =
        pending && pending.epoch === focusOrigin.epoch && pending.element === entered
          ? pending.from
          : null;
      // The Tab from the page reached the surface after all: follow the document order from here,
      // so Tab past it leaves the page instead of forming a cycle through the anchor.
      entryRef.current = expected === 'page' ? 'page' : 'anchor';
      if (expected === 'page' || !isNothing(doc, from) || focusOrigin.pressed) return;
      // Shift+Tab from the browser's own controls, or from nothing: the document's last element.
      if (expected !== 'far-end' && !focusOrigin.windowFocused) return;
      const anchor = anchorRef.current;
      if (!anchor || entered !== getLastTabbable(surface)) return;
      const order = getTabbableElements(doc.body);
      const outside = order.filter((el) => !surface.contains(el));
      const pageEnd = outside[outside.length - 1];
      // The surface ends the order when the previous stop is the page's last element.
      if (!pageEnd || pageEnd === getPrevious(anchor, surface, order)) return;
      if (!focusElement(pageEnd)) entryRef.current = 'page';
    };
    surface.addEventListener('focusin', onFocusIn);
    doc.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      surface.removeEventListener('focusin', onFocusIn);
      doc.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [enabled, surface, anchorRef, getPrevious, onDocumentKeyDown]);

  return useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const anchor = anchorRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !enabled || !surface || !anchor) return;
    const active = surface.ownerDocument.activeElement;
    // Events from nested portaled layers bubble here through React: only handle our own content.
    if (!active || !surface.contains(active) || entryRef.current === 'page') return;
    const tabbables = getTabbableElements(surface);
    if (event.shiftKey) {
      if (active === surface || active === tabbables[0]) {
        focusInstead(event, getPrevious(anchor, surface));
      }
      return;
    }
    if (tabbables.length > 0 && active !== tabbables[tabbables.length - 1]) return;
    focusInstead(event, getTabbableAfter(anchor, surface));
  });
}
