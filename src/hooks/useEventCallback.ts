import { useCallback, useInsertionEffect, useRef } from 'react';

/**
 * Returns a callback with a stable identity that always invokes the latest `fn` passed to the hook.
 * Use it for handlers read by effects or passed to memoised children, so neither re-runs when the
 * consumer passes a new inline function on every render.
 *
 * The latest `fn` is stored in an insertion effect, so it is current before any layout effect or
 * event handler runs. Do not call the returned function during render.
 *
 * Typing: for a required `fn` the result has exactly `fn`'s type `T` (overloads and generic call
 * signatures included); for an optional `fn` it is `(...args: Parameters<T>) => ReturnType<T> |
 * undefined`. The single function-type parameter of 0.4 is kept, so
 * `useEventCallback<(event: React.MouseEvent) => void>((event) => …)` still types an inline lambda.
 *
 * @example
 * const emitChange = useEventCallback(props.onValueChange); // optional prop
 * emitChange(next); // always a function; returns `undefined` while the prop is not given
 *
 * @param fn - The callback to wrap. May be `undefined`; calls are then no-ops that return `undefined`.
 * @returns A function with a stable identity that delegates to the latest `fn`.
 */
export function useEventCallback<T extends (...args: never[]) => unknown>(fn: T): T;
export function useEventCallback<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
): (...args: Parameters<T>) => ReturnType<T> | undefined;
export function useEventCallback<T extends (...args: never[]) => unknown>(
  fn: T | undefined,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const ref = useRef(fn);

  // useInsertionEffect runs before layout effects, so the ref is up to date before any effect or
  // event handler reads it.
  useInsertionEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: Parameters<T>) => {
    // `T` is only known to take `never[]`; calling it with its own parameters is sound.
    const current = ref.current as ((...params: Parameters<T>) => ReturnType<T>) | undefined;
    return current?.(...args);
  }, []);
}
