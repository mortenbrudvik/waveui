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
  /** Index of the first row in view. Clamped to `[0, max(0, count - rows in view)]`. */
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
  // A scroller never shows a first row past the last full page: a list that shrank under a
  // scrolled window is clamped the way the browser clamps `scrollTop`.
  const first = Math.min(toCount(input.firstVisible, 0), Math.max(0, count - visibleCount));
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visibleCount + overscan);

  return entriesFor(count, start, end, keep, (from, to) => (to - from) * rowSize);
}

/**
 * The entries for the window `[start, end)` and the kept rows outside it: touching runs merge into
 * one, and `spaceOf(from, to)` is the size of the rows `[from, to)` that are not rendered.
 */
function entriesFor(
  count: number,
  start: number,
  end: number,
  keep: readonly number[] | undefined,
  spaceOf: (from: number, to: number) => number,
): readonly VirtualEntry[] {
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
      entries.push({ kind: 'spacer', size: spaceOf(next, from), key: `spacer-${from}` });
    for (let index = from; index < to; index++) entries.push({ kind: 'item', index });
    next = to;
  }
  if (next < count) entries.push({ kind: 'spacer', size: spaceOf(next, count), key: 'spacer-end' });
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

/**
 * The sizes of a list whose rows differ in height: the row sizes measured so far and an estimate
 * for every other row. An immutable value (every change returns a new one, the same one when
 * nothing changed), so a window can keep it in state and lay out from it during render.
 *
 * It keeps the measured rows as sorted indexes and the running sum of how far each measured size
 * is from the estimate, so the top of any row is `index * estimate` plus one lookup of that sum:
 * O(log m) for m measured rows, where a change costs O(m) (a balanced tree changes in O(log m)
 * but allocates a node per row, and a persistent value is what render needs).
 */
export interface VirtualSizes {
  /** The size, in pixels, of a row that is not measured. */
  readonly estimate: number;
  /** The indexes of the measured rows, ascending. */
  readonly indexes: readonly number[];
  /** The measured size of each row of `indexes`, in pixels. */
  readonly sizes: readonly number[];
  /** `prefix[j]`: the sum of `sizes[k] - estimate` for `k <= j`. */
  readonly prefix: readonly number[];
}

function toEstimate(estimate: number): number {
  return Number.isFinite(estimate) && estimate > 0 ? estimate : 1;
}

/** The first position `j` of `indexes` with `indexes[j] >= index` (binary search). */
function lowerBound(indexes: readonly number[], index: number): number {
  let low = 0;
  let high = indexes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (indexes[middle] < index) low = middle + 1;
    else high = middle;
  }
  return low;
}

function buildSizes(
  estimate: number,
  indexes: readonly number[],
  sizes: readonly number[],
): VirtualSizes {
  const prefix: number[] = new Array<number>(sizes.length);
  let sum = 0;
  for (let j = 0; j < sizes.length; j++) {
    sum += sizes[j] - estimate;
    prefix[j] = sum;
  }
  return { estimate, indexes, sizes, prefix };
}

/** The sizes of a list with nothing measured: every row is `estimate` tall. */
export function createVirtualSizes(estimate: number): VirtualSizes {
  return buildSizes(toEstimate(estimate), [], []);
}

/** The same measurements with another estimate for the rows that are not measured. */
export function withVirtualEstimate(sizes: VirtualSizes, estimate: number): VirtualSizes {
  const next = toEstimate(estimate);
  return next === sizes.estimate ? sizes : buildSizes(next, sizes.indexes, sizes.sizes);
}

/**
 * The sizes with the measured heights of some rows recorded (`index` to pixels). An entry that is
 * not a non-negative integer index with a positive finite size is ignored, and a row whose size is
 * already recorded (to within a hundredth of a pixel) changes nothing: when no entry changes
 * anything, the same value comes back.
 */
export function setVirtualSizes(
  sizes: VirtualSizes,
  updates: Iterable<readonly [index: number, size: number]>,
): VirtualSizes {
  const changes = new Map<number, number>();
  for (const [index, size] of updates) {
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(size) || size <= 0) continue;
    const at = lowerBound(sizes.indexes, index);
    const known = sizes.indexes[at] === index ? sizes.sizes[at] : sizes.estimate;
    if (Math.abs(known - size) >= 0.01) changes.set(index, size);
    else changes.delete(index);
  }
  if (changes.size === 0) return sizes;
  const merged = new Map<number, number>();
  sizes.indexes.forEach((index, j) => merged.set(index, sizes.sizes[j]));
  for (const [index, size] of changes) merged.set(index, size);
  const indexes = [...merged.keys()].sort((a, b) => a - b);
  return buildSizes(
    sizes.estimate,
    indexes,
    indexes.map((index) => merged.get(index) as number),
  );
}

/** The size of row `index`, measured or estimated. */
export function virtualSizeOf(sizes: VirtualSizes, index: number): number {
  const at = lowerBound(sizes.indexes, index);
  return sizes.indexes[at] === index ? sizes.sizes[at] : sizes.estimate;
}

/**
 * The offset of the top of row `index` from the top of the list: the sum of the sizes of the rows
 * before it. `index` may be the row count, which gives the height of the whole list.
 */
export function virtualOffsetOf(sizes: VirtualSizes, index: number): number {
  const at = lowerBound(sizes.indexes, index);
  return index * sizes.estimate + (at === 0 ? 0 : sizes.prefix[at - 1]);
}

/**
 * The index of the row that contains `offset` (the first row whose bottom is past it): 0 for an
 * offset before the first row's bottom. Rows past the measured ones count as `estimate` tall, so
 * the answer can be past the end of a list; `count` bounds it when given.
 */
export function virtualIndexAt(sizes: VirtualSizes, offset: number, count?: number): number {
  if (!(offset > 0)) return 0;
  let low = 0;
  let high = count !== undefined ? toCount(count, 0) : Math.ceil(offset / sizes.estimate) + 1;
  // Measured rows can be smaller than the estimate: widen until the offset is inside.
  if (count === undefined) while (virtualOffsetOf(sizes, high) <= offset) high *= 2;
  else if (virtualOffsetOf(sizes, high) <= offset) return high;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (virtualOffsetOf(sizes, middle + 1) <= offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Input of {@link computeMeasuredLayout}. */
export interface MeasuredLayoutInput {
  /** Number of rows in the whole list. */
  count: number;
  sizes: VirtualSizes;
  /** Index of the first row in view. */
  firstVisible: number;
  /** Index of the last row in view (at least `firstVisible`). */
  lastVisible: number;
  /** Rows rendered beyond each edge of the view. */
  overscan: number;
  /** Indexes that stay rendered outside the window, as in {@link VirtualLayoutInput}. */
  keep?: readonly number[];
}

/**
 * The rows to render for a scrolled list of rows with measured sizes and the spacers that keep its
 * scroll height: the rows from `firstVisible` to `lastVisible` with `overscan` rows on both sides,
 * plus every `keep` index as a run of its own. The sizes of the items and the spacers add up to
 * the height of the whole list (`virtualOffsetOf(sizes, count)`); a spacer is never empty.
 */
export function computeMeasuredLayout(input: MeasuredLayoutInput): readonly VirtualEntry[] {
  const { sizes, keep } = input;
  const count = toCount(input.count, 0);
  if (count === 0) return [];
  const overscan = toCount(input.overscan, 0);
  const first = Math.min(toCount(input.firstVisible, 0), count - 1);
  const last = Math.min(Math.max(toCount(input.lastVisible, 0), first), count - 1);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, last + 1 + overscan);
  return entriesFor(
    count,
    start,
    end,
    keep,
    (from, to) => virtualOffsetOf(sizes, to) - virtualOffsetOf(sizes, from),
  );
}

/**
 * The scroll offset that brings row `index` of a measured list to the requested place (`align` as
 * in {@link ScrollOffsetInput}), not bounded above: the browser bounds `scrollTop` by the content.
 */
export function scrollOffsetForMeasuredIndex(input: {
  index: number;
  align: 'auto' | 'start' | 'center' | 'end';
  sizes: VirtualSizes;
  scrollTop: number;
  viewportSize: number;
}): number {
  const { align, sizes, scrollTop, viewportSize } = input;
  const viewport = Number.isFinite(viewportSize) ? Math.max(0, viewportSize) : 0;
  const index = Math.max(0, Number.isFinite(input.index) ? Math.floor(input.index) : 0);
  const top = virtualOffsetOf(sizes, index);
  const size = virtualSizeOf(sizes, index);
  const bottom = top + size;
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
      target = top + size / 2 - viewport / 2;
      break;
    default:
      target = top < current ? top : bottom > current + viewport ? bottom - viewport : current;
  }
  return Math.max(0, target);
}
