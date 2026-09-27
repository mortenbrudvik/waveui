import { useCallback, useSyncExternalStore } from 'react';

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * `true` while `query` matches, updated when the answer changes. `false` on the server and where
 * `matchMedia` is unavailable. Internal: shared `useSyncExternalStore` plumbing for hooks and
 * components that need one media query, so they never duplicate it (`usePrefersReducedMotion`,
 * ColorArea's coarse-primary-pointer check).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void): (() => void) => {
      const mql = getMediaQueryList(query);
      if (!mql) return () => {};
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', notify);
        return () => mql.removeEventListener('change', notify);
      }
      // Safari < 14
      mql.addListener(notify);
      return () => mql.removeListener(notify);
    },
    [query],
  );
  const getSnapshot = useCallback(() => getMediaQueryList(query)?.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
