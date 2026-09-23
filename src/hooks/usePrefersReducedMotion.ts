import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(QUERY);
}

function subscribe(notify: () => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) return () => {};
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', notify);
    return () => mql.removeEventListener('change', notify);
  }
  // Safari < 14
  mql.addListener(notify);
  return () => mql.removeListener(notify);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * `true` while the user asks for reduced motion (`prefers-reduced-motion: reduce`), updated when
 * the preference changes. `false` on the server and where `matchMedia` is unavailable.
 *
 * Use it for behaviour that CSS `motion-reduce:` variants cannot express, e.g. starting a carousel
 * paused.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
