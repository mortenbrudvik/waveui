import { useCallback, useRef, useInsertionEffect } from 'react';

/**
 * Returns a stable callback reference that always invokes the latest version
 * of the provided function. Useful for event handlers passed to child
 * components to avoid unnecessary re-renders.
 *
 * The returned function has a stable identity across renders.
 *
 * @typeParam T - The callback function signature.
 * @param fn - The callback to wrap. May be `undefined`, in which case calls are no-ops.
 * @returns A memoized function with a stable identity that delegates to the latest `fn`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEventCallback<T extends (...args: any[]) => any>(fn: T | undefined): T {
  const ref = useRef<T | undefined>(fn);

  // useInsertionEffect runs synchronously before layout effects,
  // ensuring the ref is always up-to-date before any effect reads it.
  useInsertionEffect(() => {
    ref.current = fn;
  });

  // The returned callback identity never changes.
  return useCallback((...args: Parameters<T>) => ref.current?.(...args), []) as T;
}
