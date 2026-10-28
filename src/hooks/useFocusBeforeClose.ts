import * as React from 'react';
import { isConnectedAndFocusable } from '../lib/focus';
import { useEventCallback } from './useEventCallback';

/** Options of {@link useFocusBeforeClose}. */
export interface UseFocusBeforeCloseOptions {
  /** The surface's open state. */
  open: boolean;
  /** The surface element, read in the closing commit. */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /**
   * The preferred opener, read in an insertion effect of the commit that opens the surface;
   * when it returns no candidate, the focused element is taken (never `<body>`, `<html>` or an
   * element inside the surface).
   */
  captureOpener: () => HTMLElement | null;
  /**
   * Focus targets at close, in order; receives the captured opener. The first connected,
   * focusable one outside the surface takes focus.
   */
  candidates: (opener: HTMLElement | null) => ReadonlyArray<HTMLElement | null | undefined>;
}

/**
 * Internal: moves focus out of a surface that closes while it holds focus, in the closing commit,
 * for the positioned surfaces that stay mounted while they exit (Menu.Popover, and the other
 * popups as they mount through the presence core).
 *
 * - **Capture.** In the commit that opens the surface, in an insertion effect (before focus moves
 *   into it): `captureOpener()`, else the focused element; `<body>`, `<html>` and elements inside
 *   the surface are no opener.
 * - **Move.** When `open` turns `false` with focus inside the surface, the first of
 *   `candidates(opener)` that is connected, focusable and outside the surface takes focus
 *   (`preventScroll`), in the closing commit's mutation phase (a layout-effect cleanup). A surface
 *   opened in the same update and rendered after this one (a Dialog opened by an item of a closing
 *   menu) then records that element as its opener, not the item, which the closing surface keeps
 *   in the document, `inert`, until its exit ends and then removes. In a browser React cannot put
 *   focus back on an `inert` element, and `useRestoreFocus`, which then finds focus outside the
 *   surface, leaves it there: give both the same targets in the same order.
 * - **Unmount.** Nothing moves when the surface's component unmounts (also React StrictMode's
 *   simulated unmount, with the surface open and focus inside): that is `useRestoreFocus`'s case.
 *
 * @param options - See {@link UseFocusBeforeCloseOptions}.
 */
export function useFocusBeforeClose({
  open,
  surfaceRef,
  captureOpener,
  candidates,
}: UseFocusBeforeCloseOptions): void {
  // The element focused when the surface opened, captured as useRestoreFocus captures its opener:
  // in the commit that opens the surface, before focus moves into it.
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpenRef = React.useRef(false);
  const capture = useEventCallback(() => {
    const container = surfaceRef.current;
    const preferred = captureOpener();
    const doc = (preferred ?? container)?.ownerDocument ?? document;
    const isCandidate = (el: Element | null | undefined): el is HTMLElement =>
      !!el && el !== doc.body && el !== doc.documentElement && !container?.contains(el);
    const active = doc.activeElement;
    openerRef.current = isCandidate(preferred) ? preferred : isCandidate(active) ? active : null;
  });
  React.useInsertionEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (open && !wasOpen) capture();
  });

  // Where focus goes: the first candidate that can take it outside the surface.
  const getCloseFocus = useEventCallback((): HTMLElement | null => {
    const container = surfaceRef.current;
    return (
      candidates(openerRef.current).find(
        (el): el is HTMLElement => !!el && isConnectedAndFocusable(el) && !container?.contains(el),
      ) ?? null
    );
  });

  // Unmounting (StrictMode's simulated unmount included) runs this cleanup before the one below,
  // which then moves nothing: unmounting is left to useRestoreFocus. Keep this effect first.
  const unmountingRef = React.useRef(false);
  React.useLayoutEffect(() => {
    unmountingRef.current = false;
    return () => {
      unmountingRef.current = true;
    };
  }, []);
  const focusOutOnClose = useEventCallback(() => {
    const surface = surfaceRef.current;
    const active = surface?.ownerDocument.activeElement;
    if (unmountingRef.current || !surface || !active || !surface.contains(active)) return;
    getCloseFocus()?.focus({ preventScroll: true });
  });
  React.useLayoutEffect(() => {
    if (!open) return undefined;
    return focusOutOnClose;
  }, [open, focusOutOnClose]);
}
