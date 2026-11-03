import { useBrowserTimer } from './useBrowserTimer';

const requestFrameSafe = (callback: FrameRequestCallback): number =>
  typeof window === 'undefined' ? -1 : window.requestAnimationFrame(callback);
const cancelFrameSafe = (id: number): void => {
  if (typeof window !== 'undefined') window.cancelAnimationFrame(id);
};

/**
 * Manages one animation frame request. Requesting again replaces the pending frame, so it is never
 * requested twice at once, and the pending one is cancelled when the component unmounts. Fluent's
 * `useAnimationFrame`, which is internal there; the pair has the same shape. On the server
 * `request` does nothing and returns `-1` (Fluent's runs the callback at once; WaveUI never runs
 * a callback written for the browser on the server).
 *
 * @example
 * const [requestFrame, cancelFrame] = useAnimationFrame();
 * const onScroll = () => requestFrame(() => setOffset(readOffset()));
 *
 * @returns `[request, cancel]`: `request(callback)` returns the frame's id, `cancel()` cancels the
 *   pending frame. Both keep their identity between renders.
 */
export function useAnimationFrame(): readonly [
  request: (callback: FrameRequestCallback) => number,
  cancel: () => void,
] {
  return useBrowserTimer(requestFrameSafe, cancelFrameSafe);
}
