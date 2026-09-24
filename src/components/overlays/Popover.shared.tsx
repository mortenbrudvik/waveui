import * as React from 'react';
import { cn } from '../../lib/cn';
import { getFirstTabbable, getLastTabbable, getTabbableElements } from '../../lib/focus';
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
 * portal as the anchor (or, like it, in the page) and outside `exclude`.
 */
function getScopedTabbables(anchor: HTMLElement, exclude: HTMLElement): HTMLElement[] {
  const scope = anchor.closest('[data-wave-portal]');
  return getTabbableElements(anchor.ownerDocument.body).filter(
    (el) => !exclude.contains(el) && el.closest('[data-wave-portal]') === scope,
  );
}

/**
 * The first tabbable element after `anchor` in document order, not inside it, in the same portal
 * as the anchor and outside `exclude`: the tab stop after a surface placed right after the anchor.
 */
export function getTabbableAfter(anchor: HTMLElement, exclude: HTMLElement): HTMLElement | null {
  return (
    getScopedTabbables(anchor, exclude).find(
      (el) =>
        !anchor.contains(el) &&
        !!(anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING),
    ) ?? null
  );
}

/**
 * The last tabbable element that is `anchor`, inside it or before it in document order, in the
 * same portal as the anchor and outside `exclude`: the tab stop before a surface placed right
 * after the anchor.
 */
export function getTabbableThrough(anchor: HTMLElement, exclude: HTMLElement): HTMLElement | null {
  const through = getScopedTabbables(anchor, exclude).filter(
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
  /** Removes the listeners; `null` while none are installed. */
  uninstall: (() => void) | null;
}

const focusOrigin: FocusOrigin = { users: 0, pressed: false, refocus: null, uninstall: null };

function retainFocusOrigin(): () => void {
  if (typeof document === 'undefined') return () => {};
  focusOrigin.users += 1;
  if (!focusOrigin.uninstall) {
    const doc = document;
    const win = doc.defaultView;
    const onPress = () => {
      focusOrigin.pressed = true;
    };
    // Not a capture listener: it hears only the window's own blur (an element's does not bubble).
    const onWindowBlur = () => {
      focusOrigin.pressed = false;
      const active = doc.activeElement;
      focusOrigin.refocus = active === doc.body || active === doc.documentElement ? null : active;
    };
    // Bubbling to the document, after the surfaces' own `focusin` listeners have read `refocus`.
    const onFocusIn = () => {
      focusOrigin.refocus = null;
    };
    // Capture: a handler that stops a press from propagating must not hide it.
    doc.addEventListener('pointerdown', onPress, true);
    doc.addEventListener('mousedown', onPress, true);
    doc.addEventListener('focusin', onFocusIn);
    win?.addEventListener('blur', onWindowBlur);
    focusOrigin.uninstall = () => {
      doc.removeEventListener('pointerdown', onPress, true);
      doc.removeEventListener('mousedown', onPress, true);
      doc.removeEventListener('focusin', onFocusIn);
      win?.removeEventListener('blur', onWindowBlur);
      focusOrigin.pressed = false;
      focusOrigin.refocus = null;
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
   * the surface's first element returns to it.
   */
  getPreviousStop: (anchor: HTMLElement, surface: HTMLElement) => HTMLElement | null;
}

/**
 * Keyboard order of a surface portaled to the end of the document, as if it were rendered right
 * after its anchor (the order of 0.4's inline content). Returns the surface's `onKeyDown`; while
 * `enabled`, a document `keydown` listener and a `focusin` listener on the surface do the rest.
 * While mounted, shared document listeners record pointer presses and the window's blur.
 *
 * - Tab from the previous stop enters the surface at its first tabbable element, and Shift+Tab
 *   from the tab stop after the anchor enters it at its last one.
 * - Tab past the surface's last element continues after the anchor; Shift+Tab from its first
 *   element (or from the surface itself) returns to the previous stop.
 * - Focus that reaches the surface natively from the far end of the page follows the document
 *   order instead: Tab from the last element before the portal, or Shift+Tab from the browser's
 *   own controls (which lands on the surface's last element). The surface is then where its portal
 *   is, so Tab past it leaves the page rather than jumping back to the anchor: there is no Tab
 *   cycle, and a lap in either direction visits every element of the page.
 * - Every other entry keeps the place after the anchor. Focus that reaches the surface's last
 *   element from nothing (the body) counts as Shift+Tab from the browser only when no pointer
 *   press came since the window last lost focus, so a click on that element (Safari and Firefox on
 *   macOS do not focus a clicked button; a press where nothing takes focus moves focus to the
 *   body), Shift+Tab from a pressed point inside the surface, or a script that focuses it after a
 *   click keeps the anchor's place. Focus that returns to an element as the window gets focus back
 *   keeps the order it had, and focus the content takes as it mounts (`autoFocus`, before the
 *   listeners exist) keeps the anchor's place.
 *
 * The listeners skip events whose default is already prevented; React handlers (a trigger's own
 * `onKeyDown`, the returned one) run before them and before a dialog's focus trap.
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
  /** The element inside the surface that the pending native Tab from the page moves focus to. */
  const pageEntryRef = React.useRef<EventTarget | null>(null);

  const onDocumentKeyDown = useEventCallback((event: KeyboardEvent) => {
    pageEntryRef.current = null;
    const anchor = anchorRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !anchor || !surface) return;
    const doc = surface.ownerDocument;
    const active = doc.activeElement as HTMLElement | null;
    if (!active || surface.contains(active)) return;
    if (event.shiftKey) {
      if (active === getTabbableAfter(anchor, surface)) {
        focusInstead(event, getLastTabbable(surface));
      }
      return;
    }
    if (active === getPrevious(anchor, surface)) {
      focusInstead(event, getFirstTabbable(surface));
      return;
    }
    const order = getTabbableElements(doc.body);
    const next = order[order.indexOf(active) + 1];
    if (next && surface.contains(next)) pageEntryRef.current = next;
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
      const from = event.relatedTarget as Node | null;
      if (from && surface.contains(from)) return;
      const entered = event.target;
      // The window got focus back: focus returns to where it was, in the order it had there.
      if (!from && entered === focusOrigin.refocus) return;
      // Nothing focused before (the body counts as nothing) and no pointer press since the window
      // last lost focus: focus came from the browser's own controls (Shift+Tab).
      const fromOutside =
        !focusOrigin.pressed && (!from || from === doc.body || from === doc.documentElement);
      const fromPage =
        entered === pageEntryRef.current || (fromOutside && entered === getLastTabbable(surface));
      entryRef.current = fromPage ? 'page' : 'anchor';
      pageEntryRef.current = null;
    };
    surface.addEventListener('focusin', onFocusIn);
    doc.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      surface.removeEventListener('focusin', onFocusIn);
      doc.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [enabled, surface, onDocumentKeyDown]);

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
