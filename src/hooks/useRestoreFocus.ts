import * as React from 'react';
import { useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { getFirstTabbable, isFocusable } from '../lib/focus';
import { getLayer, isInsideOtherOpenModal } from '../lib/layers';
import { DismissLayerContext } from './useDismiss';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Options of {@link useRestoreFocus}. */
export interface UseRestoreFocusOptions {
  /** `true` while the surface is open. */
  enabled: boolean;
  /** The layer surface: opener candidates inside it are ignored. */
  container?: HTMLElement | null;
  /** The trigger: preferred restore target. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Consumer override: focused first when valid. */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** Used when neither the override, the opener nor the trigger can take focus. */
  fallback?: () => HTMLElement | null;
  /**
   * Popovers: restore only when focus was inside the surface (or lost to `<body>`) at close, so a
   * click that moved focus elsewhere is respected. @default false
   */
  onlyIfFocusInside?: boolean;
}

interface Latest {
  options: UseRestoreFocusOptions;
  parentLayerId: string | null;
}

function isValidTarget(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (!isFocusable(el)) return false; // also rejects [inert] ancestors, hidden and disabled
  if (el.closest('[aria-hidden="true"]')) return false;
  return !isInsideOtherOpenModal(el);
}

function tryFocus(el: HTMLElement): boolean {
  try {
    el.focus({ preventScroll: true });
  } catch {
    return false;
  }
  return el.ownerDocument.activeElement === el;
}

/** The element to restore to when the surface opens: the trigger, else the focused element. */
function captureOpener(options: UseRestoreFocusOptions): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const { container, triggerRef } = options;
  const isCandidate = (el: Element | null | undefined): el is HTMLElement =>
    !!el &&
    el !== el.ownerDocument.body &&
    el !== el.ownerDocument.documentElement &&
    !(container && container.contains(el));
  const trigger = triggerRef?.current;
  if (isCandidate(trigger)) return trigger;
  const active = document.activeElement;
  return isCandidate(active) ? (active as HTMLElement) : null;
}

/** The parent layer's surface (or its first tabbable element), for the last-resort fallback. */
function getParentLayerTargets(parentLayerId: string | null): HTMLElement[] {
  if (parentLayerId === null) return [];
  const parent = getLayer(parentLayerId);
  if (!parent) return [];
  const targets: HTMLElement[] = [];
  for (const el of parent.getElements()) {
    if (!el) continue;
    targets.push(el);
    const first = getFirstTabbable(el);
    if (first) targets.push(first);
  }
  return targets;
}

/** Whether focus is where a popover's restore should still act: inside the surface or lost. */
function isFocusInsideOrLost(container: HTMLElement | null | undefined): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return true;
  return !!container && container.contains(active);
}

function restore(latest: Latest, captured: HTMLElement | null): void {
  const { options, parentLayerId } = latest;
  const candidates: Array<HTMLElement | null | undefined> = [
    options.finalFocusRef?.current,
    captured,
    options.triggerRef?.current,
    options.fallback?.(),
    ...getParentLayerTargets(parentLayerId),
  ];
  const container = options.container;
  for (const candidate of candidates) {
    if (container && candidate && container.contains(candidate)) continue;
    if (isValidTarget(candidate) && tryFocus(candidate)) return;
  }
}

/**
 * Returns focus to where it came from when a surface closes (dialogs, drawers, popovers, menus,
 * the DatePicker calendar, TeachingPopover).
 *
 * - **Capture**: when `enabled` flips to `true`, the opener is captured in an insertion effect —
 *   before React applies `autoFocus` inside the new surface — preferring `triggerRef.current` and
 *   ignoring `<body>` and elements inside `container`.
 * - **Restore** when `enabled` flips to `false` (layout phase) and when the component unmounts
 *   while enabled. The unmount restore runs in a microtask and is cancelled if the same instance
 *   mounts again, so React StrictMode's simulated unmount does not pull focus out of a surface
 *   that just opened.
 * - **Targets**, first valid wins: `finalFocusRef` → the captured opener → `triggerRef` →
 *   `fallback()` → the parent layer's surface. A target is valid when it is connected, focusable,
 *   not inside `[inert]` or `[aria-hidden="true"]`, and not cut off behind another open modal
 *   layer. Focus uses `preventScroll`.
 * - `onlyIfFocusInside` (popovers): restores only when focus is inside the surface or was lost to
 *   `<body>`.
 */
export function useRestoreFocus(options: UseRestoreFocusOptions): void {
  const parentLayerId = React.useContext(DismissLayerContext);
  const latestRef = useRef<Latest>({ options, parentLayerId });
  const capturedRef = useRef<HTMLElement | null>(null);
  const insertionEnabledRef = useRef(false);
  const layoutEnabledRef = useRef(false);
  const scheduledRef = useRef<object | null>(null);
  const { enabled } = options;

  // Mutation phase: record the latest options and capture the opener when `enabled` turns on,
  // before autoFocus (layout phase) or a focus trap's initial focus moves focus into the surface.
  useInsertionEffect(() => {
    latestRef.current = { options, parentLayerId };
    const wasEnabled = insertionEnabledRef.current;
    insertionEnabledRef.current = options.enabled;
    if (options.enabled && !wasEnabled) capturedRef.current = captureOpener(options);
  });

  // `enabled` true → false: restore in the layout phase (after every cleanup of this commit, so a
  // modal's isolation is already gone).
  useIsomorphicLayoutEffect(() => {
    const wasEnabled = layoutEnabledRef.current;
    layoutEnabledRef.current = enabled;
    if (!wasEnabled || enabled) return;
    const latest = latestRef.current;
    const captured = capturedRef.current;
    capturedRef.current = null;
    if (latest.options.onlyIfFocusInside && !isFocusInsideOrLost(latest.options.container)) {
      return;
    }
    restore(latest, captured);
  }, [enabled]);

  // Unmount while enabled: restore in a microtask, cancelled by a remount of this instance.
  useIsomorphicLayoutEffect(() => {
    const latest = latestRef;
    const captured = capturedRef;
    const scheduled = scheduledRef;
    scheduled.current = null;
    return () => {
      const snapshot = latest.current;
      if (!snapshot.options.enabled) return;
      // Decide now, while the surface is still in the document.
      if (snapshot.options.onlyIfFocusInside && !isFocusInsideOrLost(snapshot.options.container)) {
        return;
      }
      const token = {};
      scheduled.current = token;
      const opener = captured.current;
      queueMicrotask(() => {
        if (scheduled.current !== token) return;
        scheduled.current = null;
        const active = typeof document === 'undefined' ? null : document.activeElement;
        const container = snapshot.options.container;
        // Focus placed elsewhere in the meantime (another surface opened) wins.
        if (
          active &&
          active !== document.body &&
          active !== document.documentElement &&
          !(container && container.contains(active))
        ) {
          return;
        }
        restore(snapshot, opener);
      });
    };
  }, []);
}
