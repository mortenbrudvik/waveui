import type * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEventCallback } from './useEventCallback';
import { warnOnce } from '../lib/dev';
import {
  computeMeasuredLayout,
  computeVirtualLayout,
  createVirtualSizes,
  scrollOffsetForIndex,
  scrollOffsetForMeasuredIndex,
  setVirtualSizes,
  virtualIndexAt,
  virtualOffsetOf,
  virtualSizeOf,
  withVirtualEstimate,
  type VirtualEntry,
  type VirtualSizes,
} from '../lib/virtual';

/** Options of {@link useVirtualWindow}. */
export interface UseVirtualWindowOptions {
  /**
   * The height of every row, in pixels (all rows have the same height); with `measureItems`, the
   * estimate for a row that has not been measured. A value that is not a positive finite number
   * warns once in development and counts as 1.
   */
  itemSize: number;
  /**
   * Measures the rows instead of assuming that they are all `itemSize` tall, so rows of different
   * heights can be windowed (Fluent's `useVirtualizer` with `itemSize` as a function, TanStack
   * Virtual's `measureElement`). The window observes every element in the scroller that carries
   * the attributes `itemProps(index)` returns (the component that renders the rows spreads them
   * on each row's element and gives the row no fixed height), records its height, and lays the
   * list out from the measured heights and `itemSize` for the rows it has not seen yet. The height
   * of a row is its border box, margins excluded: a row has no vertical margin or gap (the same
   * rule as a fixed window). When a row above the view turns out taller or shorter than the
   * estimate, the scroll position moves by the difference, so what is in view stays put, and
   * `scrollToIndex` settles on its row as the rows around it are measured. The scrollbar is
   * as accurate as the estimate: pick an `itemSize` near the median row.
   *
   * Components built for fixed rows set a height on every row and ignore this option's attributes:
   * DataGrid (whose rows are table rows) takes a fixed window only.
   * @default false
   */
  measureItems?: boolean;
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
  /**
   * The row height the window lays out with, in pixels: the height of every row of a fixed window
   * and the estimate for a row of a measuring one (one that has `itemProps`).
   */
  itemSize: number;
  /**
   * Present on a window that measures its rows (`useVirtualWindow` with `measureItems`): the
   * attributes the element of the row at `index` must carry, which the window finds it by. A
   * component that renders the rows spreads them on each row's element and, because the rows have
   * their own heights, sets no `height` of `itemSize` on it. Absent on a window of fixed rows.
   * An adapter over a library that measures (TanStack Virtual reads `data-index`) returns the
   * attributes that library needs.
   */
  itemProps?(index: number): VirtualItemProps;
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

/** The attributes of a row's element in a measuring window (see {@link VirtualWindow.itemProps}). */
export type VirtualItemProps = Readonly<Record<`data-${string}`, string | number>>;

/**
 * The measured state: the first and the last row in view (the last is used by a measuring window
 * only) and the viewport height (0 until measured), and the measured row heights (a measuring
 * window only).
 */
interface WindowState {
  firstVisible: number;
  lastVisible: number;
  viewportSize: number;
  sizes: VirtualSizes | null;
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

/** The request a measuring window keeps aligned, with the offset it last set. */
interface AligningRequest {
  element: HTMLElement;
  request: ScrollRequest;
  offset: number;
}

const UNMEASURED: WindowState = { firstVisible: 0, lastVisible: 0, viewportSize: 0, sizes: null };

/** The attribute a measuring window finds the element of a row by. */
const ITEM_ATTRIBUTE = 'data-virtual-index';

function itemProps(index: number): VirtualItemProps {
  return { [ITEM_ATTRIBUTE]: index };
}

/** The pixels the default overscan covers beyond each edge of the viewport (at least 6 rows). */
const OVERSCAN_PIXELS = 240;

function isValidItemSize(itemSize: number): boolean {
  return Number.isFinite(itemSize) && itemSize > 0;
}

/**
 * A window over a long list of rows, for rendering only the rows in view. Give `scrollRef` to the
 * scrolling element and render `layout(count)`: rows for the item entries and empty blocks of
 * `size` pixels for the spacer entries. The rows are all `itemSize` tall, or, with `measureItems`,
 * of any height (see that option).
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
 *
 * @example
 * // Rows of different heights: `itemSize` is the estimate, each row carries `itemProps(index)`
 * // and has no fixed height.
 * const virtualWindow = useVirtualWindow({ itemSize: 56, measureItems: true });
 * // ... <Row {...virtualWindow.itemProps?.(entry.index)} />
 */
export function useVirtualWindow({
  itemSize,
  measureItems = false,
  overscan,
  initialViewportSize = 480,
  scrollPaddingStart = 0,
}: UseVirtualWindowOptions): VirtualWindow {
  const size = isValidItemSize(itemSize) ? itemSize : 1;
  const overscanRows = overscan ?? Math.max(6, Math.ceil(OVERSCAN_PIXELS / size));
  const paddingStart =
    Number.isFinite(scrollPaddingStart) && scrollPaddingStart > 0 ? scrollPaddingStart : 0;
  const measuring = measureItems === true;
  const [state, setState] = useState<WindowState>(UNMEASURED);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  // The values last given to `setState`, so a frame inside the same row sets nothing (React may
  // render a component once more for an update to an equal value).
  const measuredRef = useRef<WindowState>(UNMEASURED);
  // The measured row heights of a measuring window; the state holds the same value for render.
  const sizesRef = useRef<VirtualSizes | null>(null);
  const pendingRef = useRef<ScrollRequest | null>(null);
  // The request applied on attach, applied once more at the scroller's first change of height
  // unless the scroller moved or another request came first.
  const settlingRef = useRef<SettlingRequest | null>(null);
  // The request a measuring window keeps aligned while the rows around its target are measured.
  const aligningRef = useRef<AligningRequest | null>(null);
  // Finds, observes and measures the rows in the scroller (a measuring window with a scroller).
  const syncRowsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isValidItemSize(itemSize))
      warnOnce(
        'useVirtualWindow:item-size',
        `useVirtualWindow: itemSize must be a positive number of pixels (got ${String(itemSize)}); 1 is used.`,
      );
  }, [itemSize]);

  /** The measured heights with the current estimate (`null` for a window of fixed rows). */
  const currentSizes = useEventCallback((): VirtualSizes | null => {
    if (!measuring) return null;
    const sizes = sizesRef.current ?? createVirtualSizes(size);
    return (sizesRef.current = withVirtualEstimate(sizes, size));
  });

  const measure = useEventCallback((element: HTMLElement) => {
    const { scrollTop, clientHeight } = element;
    const sizes = currentSizes();
    // Negative while an elastic overscroll pulls past the top.
    const top = scrollTop > 0 ? scrollTop : 0;
    const next: WindowState = sizes
      ? {
          firstVisible: virtualIndexAt(sizes, top),
          // The row that holds the last pixel of the view, not the one that starts below it.
          lastVisible: virtualIndexAt(sizes, top + clientHeight - 0.01),
          viewportSize: clientHeight,
          sizes,
        }
      : {
          firstVisible: scrollTop > 0 ? Math.floor(scrollTop / size) : 0,
          lastVisible: 0,
          viewportSize: clientHeight,
          sizes: null,
        };
    const last = measuredRef.current;
    if (
      next.firstVisible === last.firstVisible &&
      next.lastVisible === last.lastVisible &&
      next.viewportSize === last.viewportSize &&
      next.sizes === last.sizes
    )
      return;
    measuredRef.current = next;
    setState(next);
  });

  const scrollElementTo = useEventCallback((element: HTMLElement, request: ScrollRequest) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const viewport = clientHeight > 0 ? clientHeight : initialViewportSize;
    const sizes = currentSizes();
    if (sizes) {
      // The browser bounds `scrollTop` by the content it laid out.
      element.scrollTop = scrollOffsetForMeasuredIndex({
        index: request.index,
        align: request.align,
        sizes,
        scrollTop,
        viewportSize: Math.max(size, viewport - paddingStart),
      });
      aligningRef.current = { element, request, offset: element.scrollTop };
      measure(element);
      return;
    }
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
      aligningRef.current = null;
      // A scroller that left the document but whose `null` has not committed yet counts as gone.
      if (scroller?.isConnected) scrollElementTo(scroller, request);
      else pendingRef.current = request;
    },
  );

  const scrollRef = useCallback((element: HTMLElement | null) => setScroller(element), []);

  /**
   * Records the measured heights of rows (a measuring window): the sizes, the scroll position
   * that keeps the view where it was when rows above it changed height, and the view of the
   * request that is still settling on its row.
   */
  const recordSizes = useEventCallback(
    (element: HTMLElement, updates: ReadonlyMap<number, number>) => {
      const previous = currentSizes();
      if (!previous) return;
      const next = setVirtualSizes(previous, updates);
      if (next === previous) return;
      sizesRef.current = next;
      const aligning = aligningRef.current;
      const settling =
        aligning?.element === element && Math.abs(element.scrollTop - aligning.offset) < 2;
      if (settling) {
        // The row the request names is still being placed: place it again from the new heights.
        const target = scrollOffsetForMeasuredIndex({
          index: aligning.request.index,
          align: aligning.request.align,
          sizes: next,
          scrollTop: element.scrollTop,
          viewportSize: Math.max(
            size,
            (element.clientHeight || initialViewportSize) - paddingStart,
          ),
        });
        if (Math.abs(target - element.scrollTop) < 1) aligningRef.current = null;
        else {
          element.scrollTop = target;
          aligning.offset = element.scrollTop;
        }
      } else {
        // Rows above the view that differ from their estimate moved what is in view by the
        // difference: move the scroll position with it. The heights in the DOM are already the
        // new ones, so the rows' tops are read from the new sizes.
        aligningRef.current = null;
        let shift = 0;
        for (const index of updates.keys()) {
          if (virtualOffsetOf(next, index) < element.scrollTop) {
            shift += virtualSizeOf(next, index) - virtualSizeOf(previous, index);
          }
        }
        if (shift !== 0) element.scrollTop += shift;
      }
      measure(element);
    },
  );

  // Attach: the scroll listener, the size observer, and a request made before the scroller.
  useLayoutEffect(() => {
    // The request applied on attach is forgotten with its scroller (a closed popup's list is not
    // held). Not in the cleanup: StrictMode's second attach of the same element keeps it.
    if (settlingRef.current && settlingRef.current.element !== scroller) settlingRef.current = null;
    if (aligningRef.current && aligningRef.current.element !== scroller) aligningRef.current = null;
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
    // A measuring window: every element that carries the row attribute is observed; the rows are
    // found again after each render of the component that holds the window (rows mount, unmount or
    // change their index only when it renders them).
    const rows = new Map<Element, number>();
    let rowObserver: ResizeObserver | null = null;
    if (measuring) {
      const readIndex = (element: Element) => Number(element.getAttribute(ITEM_ATTRIBUTE));
      const heightOf = (element: Element) => element.getBoundingClientRect().height;
      const record = (updates: Map<number, number>) => {
        if (released || updates.size === 0) return;
        recordSizes(scroller, updates);
      };
      const sync = () => {
        if (released) return;
        const found = scroller.querySelectorAll(`[${ITEM_ATTRIBUTE}]`);
        const updates = new Map<number, number>();
        const present = new Set<Element>();
        found.forEach((element) => {
          present.add(element);
          const index = readIndex(element);
          const known = rows.get(element);
          if (known === undefined) rowObserver?.observe(element);
          // A new row, or one that now stands for another index: measure it now (an observer
          // reports a size change, which a reused element need not have).
          if (known !== index) {
            rows.set(element, index);
            updates.set(index, heightOf(element));
          }
        });
        for (const element of Array.from(rows.keys())) {
          if (present.has(element)) continue;
          rowObserver?.unobserve(element);
          rows.delete(element);
        }
        record(updates);
      };
      if (typeof ResizeObserver !== 'undefined') {
        rowObserver = new ResizeObserver((entries) => {
          const updates = new Map<number, number>();
          for (const entry of entries) {
            const index = rows.get(entry.target);
            if (index === undefined) continue;
            updates.set(index, entry.borderBoxSize?.[0]?.blockSize ?? heightOf(entry.target));
          }
          record(updates);
        });
      }
      syncRowsRef.current = sync;
      sync();
    }
    return () => {
      released = true;
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      rowObserver?.disconnect();
      syncRowsRef.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [scroller, measuring, measure, scrollElementTo, recordSizes]);

  // After every render of the component that holds the window: the rows it rendered are found,
  // observed and measured (a measuring window). A scroll by the user ends the alignment of a
  // request: the next measurement finds the scroll position away from the offset it set.
  useLayoutEffect(() => {
    syncRowsRef.current?.();
  });

  // Read the offset and the size on attach, and again for a new row height: the first row in view
  // is counted in rows of the old one.
  useLayoutEffect(() => {
    if (scroller) measure(scroller);
  }, [scroller, size, measuring, measure]);

  return useMemo<VirtualWindow>(() => {
    const viewportSize = state.viewportSize > 0 ? state.viewportSize : initialViewportSize;
    if (measuring) {
      const sizes = withVirtualEstimate(state.sizes ?? createVirtualSizes(size), size);
      return {
        itemSize: size,
        scrollRef,
        scrollToIndex,
        itemProps,
        layout: (count, options) =>
          computeMeasuredLayout({
            count,
            sizes,
            firstVisible: state.firstVisible,
            // Before the scroller is measured the view is the initial viewport.
            lastVisible:
              state.viewportSize > 0
                ? state.lastVisible
                : virtualIndexAt(
                    sizes,
                    virtualOffsetOf(sizes, state.firstVisible) + viewportSize - 0.01,
                  ),
            overscan: overscanRows,
            keep: options?.keep,
          }),
      };
    }
    return {
      itemSize: size,
      scrollRef,
      scrollToIndex,
      layout: (count, options) =>
        computeVirtualLayout({
          count,
          itemSize: size,
          firstVisible: state.firstVisible,
          viewportSize,
          overscan: overscanRows,
          keep: options?.keep,
        }),
    };
  }, [size, scrollRef, scrollToIndex, state, overscanRows, initialViewportSize, measuring]);
}
