/** Measured widths by document; a document keeps its scrollbar width for its lifetime. */
const cache = new WeakMap<Document, number>();

/**
 * The width in pixels of the classic scrollbar that `targetDocument` draws on an element that
 * scrolls: `0` for overlay scrollbars (macOS, mobile) and where there is no layout (jsdom, a
 * document without a body). It appends a hidden element for one measurement and removes it,
 * so call it from an effect or an event handler, never while rendering on the server (there is
 * no document there); the result is cached per document unless `force` is `true`. Fluent's
 * `useScrollbarWidth` and `useApplyScrollbarWidth` use the same measurement.
 *
 * @param targetDocument The document to measure.
 * @param force          Measure again instead of reading the cached width.
 * @returns The scrollbar width in pixels.
 */
export function measureScrollbarWidth(targetDocument: Document, force = false): number {
  if (!force) {
    const cached = cache.get(targetDocument);
    if (cached !== undefined) return cached;
  }
  const body = targetDocument.body;
  if (!body) return 0;
  const outer = targetDocument.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  const inner = targetDocument.createElement('div');
  outer.appendChild(inner);
  body.appendChild(outer);
  const width = Math.max(0, outer.offsetWidth - inner.offsetWidth);
  outer.remove();
  cache.set(targetDocument, width);
  return width;
}
