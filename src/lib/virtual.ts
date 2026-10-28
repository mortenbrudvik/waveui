/**
 * One entry of a windowed list: a row to render, or the empty space that stands in for the rows
 * that are not rendered. A spacer's `key` is stable for React: `spacer-<index of the next item>`,
 * or `spacer-end` for the one after the last item.
 */
export type VirtualEntry =
  { kind: 'item'; index: number } | { kind: 'spacer'; size: number; key: string };

/** Input of {@link computeVirtualLayout}. */
export interface VirtualLayoutInput {
  /** Number of rows in the whole list. */
  count: number;
  /** Height (or width) of one row, in pixels. */
  itemSize: number;
  /** Index of the first row in view. Clamped to the list. */
  firstVisible: number;
  /** Height (or width) of the scroll viewport, in pixels. */
  viewportSize: number;
  /** Rows rendered beyond each edge of the view. */
  overscan: number;
  /**
   * Indexes that stay rendered outside the window (the focused row, the row a drag holds).
   * Entries that are not integers inside the list are ignored.
   */
  keep?: readonly number[];
}

/** An index run, `[from, to)`. */
type Run = readonly [from: number, to: number];

function toCount(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

/**
 * The rows to render for a scrolled list and the spacers that keep its scroll height: the rows in
 * view with `overscan` rows on both sides, plus every `keep` index as a run of its own. The sizes
 * of the items and the spacers add up to `count * itemSize`; a spacer is never empty.
 */
export function computeVirtualLayout(input: VirtualLayoutInput): readonly VirtualEntry[] {
  const { itemSize, keep } = input;
  const count = toCount(input.count, 0);
  if (count === 0) return [];

  const rowSize = Number.isFinite(itemSize) && itemSize > 0 ? itemSize : 1;
  const visibleCount = Math.max(
    1,
    Number.isFinite(input.viewportSize) ? Math.ceil(input.viewportSize / rowSize) : 1,
  );
  const overscan = toCount(input.overscan, 0);
  const first = Math.min(toCount(input.firstVisible, 0), count - 1);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visibleCount + overscan);

  // The window and the kept rows outside it, sorted; touching runs merge into one.
  const extra = [...new Set(keep ?? [])]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < count)
    .filter((index) => index < start || index >= end)
    .sort((a, b) => a - b);
  const runs: [number, number][] = [];
  const push = (from: number, to: number) => {
    const last = runs[runs.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else runs.push([from, to]);
  };
  let windowPushed = false;
  for (const index of extra) {
    if (!windowPushed && index > start) {
      push(start, end);
      windowPushed = true;
    }
    push(index, index + 1);
  }
  if (!windowPushed) push(start, end);

  const entries: VirtualEntry[] = [];
  let next = 0;
  for (const [from, to] of runs as readonly Run[]) {
    if (from > next)
      entries.push({ kind: 'spacer', size: (from - next) * rowSize, key: `spacer-${from}` });
    for (let index = from; index < to; index++) entries.push({ kind: 'item', index });
    next = to;
  }
  if (next < count)
    entries.push({ kind: 'spacer', size: (count - next) * rowSize, key: 'spacer-end' });
  return entries;
}

/** Input of {@link scrollOffsetForIndex}. */
export interface ScrollOffsetInput {
  index: number;
  /**
   * Where the row ends up: `'start'`, `'center'` or `'end'` of the viewport, or `'auto'`, the
   * smallest move that shows it whole (the current offset when it already is).
   */
  align: 'auto' | 'start' | 'center' | 'end';
  itemSize: number;
  count: number;
  scrollTop: number;
  viewportSize: number;
}

/** The scroll offset, clamped to the content, that brings row `index` to the requested place. */
export function scrollOffsetForIndex(input: ScrollOffsetInput): number {
  const { align, scrollTop, viewportSize } = input;
  const count = toCount(input.count, 0);
  const rowSize = Number.isFinite(input.itemSize) && input.itemSize > 0 ? input.itemSize : 0;
  const viewport = Number.isFinite(viewportSize) ? Math.max(0, viewportSize) : 0;
  const maxOffset = Math.max(0, count * rowSize - viewport);
  if (count === 0 || maxOffset === 0) return 0;

  const index = Math.min(
    Math.max(0, Number.isFinite(input.index) ? Math.floor(input.index) : 0),
    count - 1,
  );
  const top = index * rowSize;
  const bottom = top + rowSize;
  const current = Number.isFinite(scrollTop) ? scrollTop : 0;

  let target: number;
  switch (align) {
    case 'start':
      target = top;
      break;
    case 'end':
      target = bottom - viewport;
      break;
    case 'center':
      target = top + rowSize / 2 - viewport / 2;
      break;
    default:
      target = top < current ? top : bottom > current + viewport ? bottom - viewport : current;
  }
  return Math.min(Math.max(0, target), maxOffset);
}
