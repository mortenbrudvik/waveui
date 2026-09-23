import { useEffect, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { useEventCallback } from './useEventCallback';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Options of {@link usePreserveFocus}. */
export interface UsePreserveFocusOptions {
  /** While `false` nothing is done; flipping to `false` while focus is inside moves it. @default true */
  enabled?: boolean;
}

function moveFocusOut(
  node: HTMLElement | null,
  getFallback: () => HTMLElement | null | undefined,
): void {
  const active = node?.ownerDocument.activeElement;
  if (!node || !active || !node.contains(active)) return;
  const fallback = getFallback();
  if (fallback && !node.contains(fallback)) {
    fallback.focus({ preventScroll: true });
  }
}

/**
 * Keeps focus from falling to `<body>` when an element that contains it goes away: if
 * `ref.current` contains the focused element when the component unmounts or when `enabled` flips
 * to `false`, focus moves to `getFallback()`.
 *
 * - **`enabled` → `false`**: focus moves in the layout phase, while the element is still there.
 * - **Unmount**: the layout-effect cleanup notes (before the node is removed) that it contains
 *   focus, and the move runs in a **microtask** after the commit. It is cancelled when the same
 *   instance mounts again, so React 19 StrictMode's simulated unmount right after mount (an
 *   `autoFocus` inside the element) does not move focus in development. Tests assert the move
 *   after awaiting a microtask (`await act(async () => {})`, or `userEvent`).
 * - **Other focus owners.** The unmount move is skipped when focus was already placed outside the
 *   element before the microtask runs: in the same commit's layout phase (an `autoFocus`, a
 *   layout-effect restore-focus hook), or in passive effects React flushes synchronously with the
 *   commit (renders caused by a discrete event such as a click or a key press). Focus placed later
 *   — for example by a passive effect of a render caused by a timer, which React runs in a later
 *   task — is placed after the move and simply replaces it.
 *
 * Used for elements removed as a result of their own activation or a timer (a toast whose Dismiss
 * button has focus, a clear button that hides itself).
 *
 * @param ref         The element that may contain focus.
 * @param getFallback Returns the element to focus instead. It is read when needed, which for an
 *   unmount is after the element (and possibly the whole React tree) has been removed: it must
 *   return `null`/`undefined` rather than throw when the fallback no longer exists (e.g. use
 *   `querySelector`, not a throwing lookup). A fallback that is not connected is ignored.
 * @param options     See {@link UsePreserveFocusOptions}.
 */
export function usePreserveFocus(
  ref: React.RefObject<HTMLElement | null>,
  getFallback: () => HTMLElement | null | undefined,
  options?: UsePreserveFocusOptions,
): void {
  const enabled = options?.enabled ?? true;
  const resolveFallback = useEventCallback(getFallback);
  // Element and `enabled` of the last commit, read by the unmount cleanup.
  const stateRef = useRef<{ node: HTMLElement | null; enabled: boolean }>({
    node: null,
    enabled,
  });
  const previousEnabledRef = useRef(enabled);
  // Token of the unmount move scheduled by the cleanup; a remount of this instance clears it.
  const scheduledMoveRef = useRef<object | null>(null);

  useIsomorphicLayoutEffect(() => {
    stateRef.current = { node: ref.current, enabled };
  });

  // `enabled` true -> false: move focus in the layout phase. (A move inside a cleanup would be
  // undone: React refocuses the previously focused element after the mutation phase when it is
  // still in the document.)
  useIsomorphicLayoutEffect(() => {
    const wasEnabled = previousEnabledRef.current;
    previousEnabledRef.current = enabled;
    if (wasEnabled && !enabled) moveFocusOut(ref.current, resolveFallback);
  }, [enabled, ref, resolveFallback]);

  // Unmount: the cleanup runs before the node is removed, while it still contains focus; the move
  // is deferred to a microtask and cancelled by a remount of this instance (StrictMode).
  useIsomorphicLayoutEffect(() => {
    const state = stateRef;
    const scheduled = scheduledMoveRef;
    scheduled.current = null;
    return () => {
      const { node, enabled: isEnabled } = state.current;
      if (!isEnabled || !node) return;
      const doc = node.ownerDocument;
      const active = doc.activeElement;
      if (!active || !node.contains(active)) return;
      const token = {};
      scheduled.current = token;
      queueMicrotask(() => {
        if (scheduled.current !== token) return;
        scheduled.current = null;
        const now = doc.activeElement;
        // Focus placed elsewhere before this microtask (same commit) wins.
        if (now && now !== doc.body && !node.contains(now)) return;
        const fallback = resolveFallback();
        if (fallback && fallback.isConnected && !node.contains(fallback)) {
          fallback.focus({ preventScroll: true });
        }
      });
    };
  }, [resolveFallback]);
}
