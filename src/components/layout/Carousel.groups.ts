/*
 * Page maths of a Carousel that shows several slides at once. The index of a Carousel is the
 * index of the first slide of the shown page; a page starts at a multiple of the group size. Pure
 * and server-safe.
 */

/** A group size as a usable whole number: below 1 or not a number is 1, a fraction rounds down. */
function normalise(size: number): number {
  return Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
}

/** The number of pages of `total` slides shown `size` at a time. */
export function pageCount(total: number, size: number): number {
  return total <= 0 ? 0 : Math.ceil(total / normalise(size));
}

/** The index of the first slide of the last page. */
export function lastPageStart(total: number, size: number): number {
  const pages = pageCount(total, size);
  return pages === 0 ? 0 : (pages - 1) * normalise(size);
}

/** The first slide of the page that slide `index` is on. */
export function pageStartOf(index: number, size: number): number {
  const group = normalise(size);
  return Math.floor(index / group) * group;
}

/**
 * The shown index for a stored one: clamped to the slides, then snapped down to the start of its
 * page (a removed slide, a larger group size or an out-of-range value shows the nearest page).
 */
export function clampToPage(index: number, size: number, total: number): number {
  if (total <= 0) return 0;
  const clamped = Math.min(Math.max(Number.isNaN(index) ? 0 : index, 0), total - 1);
  return pageStartOf(clamped, size);
}
