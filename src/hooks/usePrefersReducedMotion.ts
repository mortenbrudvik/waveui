import { useMediaQuery } from './useMediaQuery';

/**
 * `true` while the user asks for reduced motion (`prefers-reduced-motion: reduce`), updated when
 * the preference changes. `false` on the server and where `matchMedia` is unavailable.
 *
 * Use it for behaviour that CSS `motion-reduce:` variants cannot express, e.g. starting a carousel
 * paused.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
