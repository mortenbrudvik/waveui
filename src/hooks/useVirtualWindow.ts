import type * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEventCallback } from './useEventCallback';
import { warnOnce } from '../lib/dev';
import { computeVirtualLayout, scrollOffsetForIndex, type VirtualEntry } from '../lib/virtual';

/** Options of {@link useVirtualWindow}. */
export interface UseVirtualWindowOptions {
  /**
   * The height of every row, in pixels (all rows have the same height). A value that is not a
   * positive finite number warns once in development and counts as 1.
   */
  itemSize: number;
  /**
   * Rows rendered beyond each edge of the viewport, so a fast scroll shows rows instead of blank
   * space before the next window renders. A given number is a number of rows; the default covers
   * at least 240 pixels, so small rows get more of them (9 rows of 28 pixels, 8 of 32).
   * @default enough rows for 240 pixels, and at least 6
   */
  overscan?: number;
  /**
   * The viewport height, in pixels, assumed until the scroller is measured: on the server, in the
   * first render, and while the scroller measures 0 (it has no layout, as in jsdom).
   * @default 480
   */
  initialViewportSize?: number;
  /**
   * The height, in pixels, of content pinned over the top of the rows inside the scroller (a
   * sticky header). `scrollToIndex` places rows in the area below it, and its content bound leaves
   * it out; the rows' offsets and the layout do not change. A value that is not a finite number of
   * 0 or more counts as 0.
   * @default 0
   */
  scrollPaddingStart?: number;
}

/**
 * A window over a long list of fixed-height rows: which rows to render for the scroll position,
 * and the space that stands in for the others. {@link useVirtualWindow} returns one; a component
 * that takes a `virtualWindow` prop renders its rows through it, and an adapter over a
 * virtualization library can implement the same interface.
 */
export interface VirtualWindow {
  /** The row height the window lays out with, in pixels. */
  itemSize: number;
  /**
   * The callback ref of the scrolling element (the element with a bounded height and its own
   * scrollbar). It attaches once per element and detaches when called with `null`.
   */
  scrollRef: React.RefCallback<HTMLElement>;
  /**
   * The entries to render, in order, for a list of `count` rows: the rows in view plus the
   * overscan, every `keep` index outside them as a row of its own (the focused row, a row about
   * to be focused), and spacers for the rows in between. The sizes add up to `count * itemSize`.
   * A pure function of the window's state and its arguments, called during render; it reads no
   * DOM.
   */
  layout(count: number, options?: { keep?: readonly number[] }): readonly VirtualEntry[];
  /**
   * Scrolls the row at `index` into view and moves the window to it in the same update, so the
   * row is rendered once that update commits. `align` places it at the `start`, `center` or `end`
   * of the viewport; `auto` (the default) scrolls the least that shows it whole. The offset is
   * bounded by the rendered content. Before the scroller attaches, the last request is kept and
   * applied when it does, and once more when the scroller first changes height after that (a
   * popup that positioning shrinks once it is shown), unless it was scrolled or another request
   * came in between. Call it from an event handler or an effect, never during render.
   */
  scrollToIndex(index: number, options?: { align?: 'auto' | 'start' | 'center' | 'end' }): void;
}

/** The measured state: the first row in view and the viewport height (0 until measured). */
interface WindowState {
  firstVisible: number;
  viewportSize: number;
}

interface ScrollRequest {
  index: number;
  align: 'auto' | 'start' | 'center' | 'end';
}

/** A request applied on attach, with the viewport height and the offset it was applied with. */
interface SettlingRequest {
  element: HTMLElement;
  request: ScrollRequest;
  viewportSize: number;
  offset: number;
}

const UNMEASURED: WindowState = { firstVisible: 0, viewportSize: 0 };

/** The pixels the default overscan covers beyond each edge of the viewport (at least 6 rows). */
const OVERSCAN_PIXELS = 240;

function isValidItemSize(itemSize: number): boolean {
  return Number.isFinite(itemSize) && itemSize > 0;
}

/**
 * A window over a long list of fixed-height rows, for rendering only the rows in view. Give
 * `scrollRef` to the scrolling element and render `layout(count)`: rows for the item entries and
 * empty blocks of `size` pixels for the spacer entries.
 *
 * The window re-renders only when the first row in view or the viewport height changes, not on
 * every scroll event: scrolling is read in a passive `scroll` listener once per animation frame,
 * and the viewport height on attach, on scroll and from a `ResizeObserver` where one exists. The
 * server and the first render lay out the top of the list in `initialViewportSize`, and read no
 * DOM.
 *
 * Never write `ref={virtualWindow.scrollRef}` in JSX: the React Compiler's lint types a member
 * read in the `ref` position as a ref, then reports that read and every call on the window during
 * render (`virtualWindow.layout(count)` included). Merge the callback with the element's other
 * refs through `useMergedRefs(ownRef, virtualWindow.scrollRef)`, or destructure it first
 * (`const { scrollRef } = virtualWindow`); `virtualWindow.layout(count)` can then be called as is.
 *
 * @example
 * const virtualWindow = useVirtualWindow({ itemSize: 32 });
 * const { scrollRef } = virtualWindow;
 * return (
 *   <div ref={scrollRef} style={{ height: 320, overflowY: 'auto' }}>
 *     {virtualWindow.layout(rows.length).map((entry) =>
 *       entry.kind === 'item' ? (
 *         <Row key={rows[entry.index].id} row={rows[entry.index]} />
 *       ) : (
 *         <div key={entry.key} aria-hidden="true" style={{ height: entry.size }} />
 *       ),
 *     )}
 *   </div>
 * );
 */
export function useVirtualWindow({
  itemSize,
  overscan,
  initialViewportSize = 480,
  scrollPaddingStart = 0,
}: UseVirtualWindowOptions): VirtualWindow {
  const size = isValidItemSize(itemSize) ? itemSize : 1;
  const overscanRows = overscan ?? Math.max(6, Math.ceil(OVERSCAN_PIXELS / size));
  const paddingStart =
    Number.isFinite(scrollPaddingStart) && scrollPaddingStart > 0 ? scrollPaddingStart : 0;
  const [state, setState] = useState<WindowState>(UNMEASURED);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // The values last given to `setState`, so a frame inside the same row sets nothing (React may
  // render a component once more for an update to an equal value).
  const measuredRef = useRef<WindowState>(UNMEASURED);
  const pendingRef = useRef<ScrollRequest | null>(null);
  // The request applied on attach, applied once more at the scroller's first change of height
  // unless the scroller moved or another request came first.
  const settlingRef = useRef<SettlingRequest | null>(null);

  useEffect(() => {
    if (!isValidItemSize(itemSize))
      warnOnce(
        'useVirtualWindow:item-size',
        `useVirtualWindow: itemSize must be a positive number of pixels (got ${String(itemSize)}); 1 is used.`,
      );
  }, [itemSize]);

  const measure = useEventCallback((element: HTMLElement) => {
    const { scrollTop, clientHeight } = element;
    const next: WindowState = {
      // Negative while an elastic overscroll pulls past the top.
      firstVisible: scrollTop > 0 ? Math.floor(scrollTop / size) : 0,
      viewportSize: clientHeight,
    };
    const last = measuredRef.current;
    if (next.firstVisible === last.firstVisible && next.viewportSize === last.viewportSize) return;
    measuredRef.current = next;
    setState(next);
  });

  const scrollElementTo = useEventCallback((element: HTMLElement, request: ScrollRequest) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const viewport = clientHeight > 0 ? clientHeight : initialViewportSize;
    element.scrollTop = scrollOffsetForIndex({
      index: request.index,
      align: request.align,
      itemSize: size,
      // The browser bounds `scrollTop` by the content it laid out; its rows bound the request the
      // same way. Without layout (jsdom, a hidden scroller) only the start bounds it.
      count:
        scrollHeight > 0
          ? Math.floor((scrollHeight - paddingStart) / size)
          : Number.MAX_SAFE_INTEGER,
      scrollTop,
      // A sticky header covers the top of the viewport and leaves the rows where they are: the
      // rows are seen in the area below it (at least one row tall).
      viewportSize: Math.max(size, viewport - paddingStart),
    });
    measure(element);
  });

  const scrollToIndex = useEventCallback(
    (index: number, options?: { align?: 'auto' | 'start' | 'center' | 'end' }) => {
      const request: ScrollRequest = { index, align: options?.align ?? 'auto' };
      settlingRef.current = null;
      // A scroller that left the document but whose `null` has not committed yet counts as gone.
      if (scroller?.isConnected) scrollElementTo(scroller, request);
      else pendingRef.current = request;
    },
  );

  const scrollRef = useCallback((element: HTMLElement | null) => setScroller(element), []);

  // Attach: the scroll listener, the size observer, and a request made before the scroller.
  useLayoutEffect(() => {
    // The request applied on attach is forgotten with its scroller (a closed popup's list is not
    // held). Not in the cleanup: StrictMode's second attach of the same element keeps it.
    if (settlingRef.current && settlingRef.current.element !== scroller) settlingRef.current = null;
    if (!scroller) return;
    let frame: number | null = null;
    let released = false;
    const onFrame = () => {
      frame = null;
      if (!released) measure(scroller);
    };
    const onScroll = () => {
      if (frame !== null) return;
      if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(onFrame);
      else measure(scroller);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    // The first change of height after a request applied on attach applies it once more (the
    // height it was applied with was not the final one), unless the scroller moved since.
    const onResize = () => {
      const settling = settlingRef.current;
      if (settling?.element === scroller && scroller.clientHeight !== settling.viewportSize) {
        settlingRef.current = null;
        if (Math.abs(scroller.scrollTop - settling.offset) < 1) {
          scrollElementTo(scroller, settling.request);
          return;
        }
      }
      measure(scroller);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    observer?.observe(scroller);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      scrollElementTo(scroller, pending);
      settlingRef.current = {
        element: scroller,
        request: pending,
        viewportSize: scroller.clientHeight,
        offset: scroller.scrollTop,
      };
    }
    return () => {
      released = true;
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [scroller, measure, scrollElementTo]);

  // Read the offset and the size on attach, and again for a new row height: the first row in view
  // is counted in rows of the old one.
  useLayoutEffect(() => {
    if (scroller) measure(scroller);
  }, [scroller, size, measure]);

  return useMemo<VirtualWindow>(
    () => ({
      itemSize: size,
      scrollRef,
      scrollToIndex,
      layout: (count, options) =>
        computeVirtualLayout({
          count,
          itemSize: size,
          firstVisible: state.firstVisible,
          viewportSize: state.viewportSize > 0 ? state.viewportSize : initialViewportSize,
          overscan: overscanRows,
          keep: options?.keep,
        }),
    }),
    [size, scrollRef, scrollToIndex, state, overscanRows, initialViewportSize],
  );
}
