import { useBrowserTimer } from './useBrowserTimer';

// Module-level so the pair keeps its identity; the browser's functions are read when they run, so
// a test's fake timers apply, and the server (no window) gets no-ops.
const setTimeoutSafe = (callback: () => void, delay?: number): number =>
  typeof window === 'undefined' ? -1 : window.setTimeout(callback, delay);
const clearTimeoutSafe = (id: number): void => {
  if (typeof window !== 'undefined') window.clearTimeout(id);
};

/**
 * Manages one browser timeout. Scheduling again replaces the pending timeout, so it is never set
 * twice at once, and the pending one is cancelled when the component unmounts. Fluent's
 * `useTimeout`, which is internal there; the pair has the same shape. On the server `set` does
 * nothing and returns `-1`.
 *
 * @example
 * const [setTimer, clearTimer] = useTimeout();
 * const onFocus = () => setTimer(() => setShown(true), 500);
 * const onBlur = () => { clearTimer(); setShown(false); };
 *
 * @returns `[set, clear]`: `set(callback, delay?)` returns the timer's id, `clear()` cancels the
 *   pending timeout. Both keep their identity between renders.
 */
export function useTimeout(): readonly [
  set: (callback: () => void, delay?: number) => number,
  clear: () => void,
] {
  return useBrowserTimer(setTimeoutSafe, clearTimeoutSafe);
}
