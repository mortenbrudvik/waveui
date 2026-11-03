import * as React from 'react';
import { measureScrollbarWidth } from '../lib/scrollbar';
import { useIsClient } from './useIsClient';

/** Options of {@link useScrollbarWidth}. */
export interface UseScrollbarWidthOptions {
  /**
   * The document to measure.
   * @default the global `document`
   */
  targetDocument?: Document | null;
  /**
   * Measure again instead of reading the width cached for the document (after a change of the
   * operating system's scrollbar setting, say).
   * @default false
   */
  force?: boolean;
}

/**
 * The width in pixels of the classic scrollbar of the browser: `0` for overlay scrollbars and
 * where nothing can be measured. Fluent's `useScrollbarWidth`, which measures while rendering and
 * is not safe for server rendering; this hook returns `0` on the server and in the hydrating
 * render, then the measured width, so the markup matches. The width is measured once per document
 * (cached) unless `force` is set.
 *
 * @example
 * const scrollbarWidth = useScrollbarWidth();
 * // Keep a fixed header level with a scrolling body:
 * <header style={{ paddingInlineEnd: scrollbarWidth }} />
 *
 * @param options See {@link UseScrollbarWidthOptions}.
 * @returns The scrollbar width in pixels.
 */
export function useScrollbarWidth(options: UseScrollbarWidthOptions = {}): number {
  const { targetDocument, force } = options;
  const isClient = useIsClient();
  return React.useMemo(() => {
    if (!isClient) return 0;
    const doc = targetDocument === undefined ? document : targetDocument;
    return doc ? measureScrollbarWidth(doc, force) : 0;
  }, [isClient, targetDocument, force]);
}

/** Options of {@link useApplyScrollbarWidth}. */
export interface UseApplyScrollbarWidthOptions {
  /**
   * Measure again instead of reading the width cached for the document.
   * @default false
   */
  force?: boolean;
  /**
   * The CSS property that receives the width in pixels; a custom property (`--scrollbar-width`)
   * works too.
   * @default 'width'
   */
  property?: string;
}

/**
 * Returns a callback ref that writes the browser's scrollbar width, in pixels, to a CSS property
 * of the element (its `width`, by default) when the element mounts. Fluent's
 * `useApplyScrollbarWidth`; safe for server rendering, since nothing is measured until the ref
 * runs, but the server markup has no value, so reserve the space another way if the first
 * paint matters. Merge it with the element's own ref through `useMergedRefs`.
 *
 * @example
 * const ref = useApplyScrollbarWidth<HTMLDivElement>({ property: 'inline-size' });
 * <div ref={ref} aria-hidden="true" />;
 *
 * @param options See {@link UseApplyScrollbarWidthOptions}.
 * @returns A callback ref; it keeps its identity while the options do.
 */
export function useApplyScrollbarWidth<T extends HTMLElement>(
  options: UseApplyScrollbarWidthOptions = {},
): React.RefCallback<T> {
  const { force, property = 'width' } = options;
  return React.useCallback(
    (element: T | null) => {
      if (!element) return;
      const width = measureScrollbarWidth(element.ownerDocument, force);
      element.style.setProperty(property, `${width}px`);
    },
    [force, property],
  );
}
