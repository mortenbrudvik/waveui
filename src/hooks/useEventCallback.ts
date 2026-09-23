import { useCallback, useInsertionEffect, useRef } from 'react';

/**
 * Returns a callback with a stable identity that always invokes the latest `fn` passed to the hook.
 * Use it for handlers read by effects or passed to memoised children, so neither re-runs when the
 * consumer passes a new inline function on every render.
 *
 * The latest `fn` is stored in an insertion effect, so it is current before any layout effect or
 * event handler runs. Do not call the returned function during render.
 *
 * @example
 * const emitChange = useEventCallback(props.onValueChange); // optional prop
 * emitChange(next); // always a function; returns `undefined` while the prop is not given
 *
 * @param fn - The callback to wrap. May be `undefined`; calls are then no-ops that return `undefined`.
 * @returns A function with a stable identity that delegates to the latest `fn`.
 */
export function useEventCallback<Args extends unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R;
export function useEventCallback<Args extends unknown[], R>(
  fn: ((...args: Args) => R) | undefined,
): (...args: Args) => R | undefined;
export function useEventCallback<Args extends unknown[], R>(
  fn: ((...args: Args) => R) | undefined,
): (...args: Args) => R | undefined {
  const ref = useRef(fn);

  // useInsertionEffect runs before layout effects, so the ref is up to date before any effect or
  // event handler reads it.
  useInsertionEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: Args) => ref.current?.(...args), []);
}
