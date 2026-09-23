/** Writing direction. */
export type Direction = 'ltr' | 'rtl';

/** The axis (or axes) an arrow-key navigation follows. */
export type ArrowOrientation = 'horizontal' | 'vertical' | 'both';

/** What an arrow key means for a composite: move to the next or previous item, or nothing. */
export type ArrowIntent = 'next' | 'prev' | null;

function asDirection(value: string | null | undefined): Direction | null {
  const normalised = value?.trim().toLowerCase();
  return normalised === 'rtl' || normalised === 'ltr' ? normalised : null;
}

/**
 * The writing direction that applies to `el`:
 * 1. the nearest `[dir="ltr" | "rtl"]` attribute on `el` or an ancestor (`dir="auto"` stops the
 *    search, because only the browser can resolve it);
 * 2. the computed CSS `direction` of `el` (or of its nearest ancestor that reports one);
 * 3. `document.dir`;
 * 4. `'ltr'`.
 *
 * Without an element it reads `document.documentElement`. Returns `'ltr'` on the server.
 * Components with a WaveProvider context read F3's `useDirection()` during render and call this
 * at event time (`getDirection(event.currentTarget)`).
 */
export function getDirection(el?: Element | null): Direction {
  if (typeof document === 'undefined') return 'ltr';
  const start = el ?? document.documentElement;

  let node: Element | null = start.closest('[dir]');
  while (node) {
    const value = node.getAttribute('dir');
    const direction = asDirection(value);
    if (direction) return direction;
    if (value?.trim().toLowerCase() === 'auto') break;
    node = node.parentElement ? node.parentElement.closest('[dir]') : null;
  }

  const view = start.ownerDocument.defaultView;
  if (view && start.isConnected) {
    for (let current: Element | null = start; current; current = current.parentElement) {
      const computed = asDirection(view.getComputedStyle(current).direction);
      if (computed) return computed;
    }
  }

  return asDirection(start.ownerDocument.dir) ?? asDirection(document.dir) ?? 'ltr';
}

/**
 * Maps an arrow key to a navigation intent for a composite widget (C-LOGICAL):
 * - `'horizontal'`: ArrowRight/ArrowLeft (swapped in `rtl`); Up/Down are ignored.
 * - `'vertical'`: ArrowDown/ArrowUp; Left/Right are ignored.
 * - `'both'`: all four (Left/Right swapped in `rtl`).
 *
 * @example
 * const intent = getArrowIntent(event.key, { orientation: 'horizontal', dir: getDirection(event.currentTarget) });
 */
export function getArrowIntent(
  key: string,
  options: { orientation: ArrowOrientation; dir: Direction },
): ArrowIntent {
  const { orientation, dir } = options;
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const vertical = orientation === 'vertical' || orientation === 'both';

  switch (key) {
    case 'ArrowRight':
      return horizontal ? (dir === 'rtl' ? 'prev' : 'next') : null;
    case 'ArrowLeft':
      return horizontal ? (dir === 'rtl' ? 'next' : 'prev') : null;
    case 'ArrowDown':
      return vertical ? 'next' : null;
    case 'ArrowUp':
      return vertical ? 'prev' : null;
    default:
      return null;
  }
}
