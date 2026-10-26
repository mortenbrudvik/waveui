/** The number of items a breadcrumb trail shows when `maxDisplayedItems` is missing or not positive. */
const DEFAULT_MAX_DISPLAYED_ITEMS = 6;

/** Options of {@link partitionBreadcrumbItems}. */
export interface PartitionBreadcrumbItemsOptions<T> {
  /** The trail, in order. Not changed. */
  items: readonly T[];
  /**
   * The most items shown, the collapse button not counted. A missing, zero, negative or non-numeric
   * value falls back to 6.
   * @default 6
   */
  maxDisplayedItems?: number;
  /**
   * The index of the first hidden item. An index at or past `maxDisplayedItems` becomes
   * `maxDisplayedItems - 1`; a negative index becomes 0.
   * @default 1
   */
  overflowIndex?: number;
}

/** The result of {@link partitionBreadcrumbItems}. */
export interface PartitionBreadcrumbItemsResult<T> {
  /** The items before the collapsed ones; the whole trail when nothing is hidden. */
  startDisplayedItems: T[];
  /** The hidden items, in order. Absent when the trail fits. */
  overflowItems?: T[];
  /** The items after the collapsed ones. Absent when the trail fits. */
  endDisplayedItems?: T[];
}

/**
 * Splits a breadcrumb trail into the items shown before a collapse button, the items it hides and
 * the items shown after it, with the rules of Fluent UI's `partitionBreadcrumbItems`: it hides
 * `items.length - maxDisplayedItems` items starting at `overflowIndex`. A trail with no more items
 * than `maxDisplayedItems` is not split: all items are in `startDisplayedItems`, and the other two
 * lists are absent. The function is pure and server-safe.
 *
 * @example
 * const { startDisplayedItems, overflowItems, endDisplayedItems } = partitionBreadcrumbItems({
 *   items: crumbs,
 *   maxDisplayedItems: 4,
 * });
 */
export function partitionBreadcrumbItems<T>(
  options: PartitionBreadcrumbItemsOptions<T>,
): PartitionBreadcrumbItemsResult<T> {
  const { items, maxDisplayedItems, overflowIndex = 1 } = options;
  const max =
    typeof maxDisplayedItems === 'number' &&
    Number.isFinite(maxDisplayedItems) &&
    maxDisplayedItems >= 1
      ? Math.floor(maxDisplayedItems)
      : DEFAULT_MAX_DISPLAYED_ITEMS;
  const hidden = items.length - max;
  if (hidden <= 0) return { startDisplayedItems: items.slice() };

  const requested = Number.isFinite(overflowIndex) ? Math.floor(overflowIndex) : 1;
  const index = Math.max(0, Math.min(requested, max - 1));
  return {
    startDisplayedItems: items.slice(0, index),
    overflowItems: items.slice(index, index + hidden),
    endDisplayedItems: items.slice(index + hidden),
  };
}

/**
 * Whether breadcrumb text is longer than `maxLength` characters, so that
 * {@link truncateBreadcrumbLongName} or {@link truncateBreadcrumbLongTooltip} would cut it. Text of
 * exactly `maxLength` characters is not truncatable.
 */
export function isTruncatableBreadcrumbContent(content: string, maxLength: number): boolean {
  return content.length > maxLength;
}

function truncate(content: string, maxLength: number): string {
  return isTruncatableBreadcrumbContent(content, maxLength)
    ? content.trim().slice(0, maxLength) + '...'
    : content;
}

/**
 * Shortens the text of a breadcrumb item that is longer than `maxLength` characters: it trims the
 * text, keeps the first `maxLength` characters and adds `...`. Shorter text, and text of exactly
 * `maxLength` characters, is returned unchanged. Show the full text in a tooltip when
 * {@link isTruncatableBreadcrumbContent} is true.
 * @default maxLength 30
 */
export function truncateBreadcrumbLongName(content: string, maxLength = 30): string {
  return truncate(content, maxLength);
}

/**
 * Shortens the text of a breadcrumb item's tooltip that is longer than `maxLength` characters, the
 * same way as {@link truncateBreadcrumbLongName}. Fluent UI spells this function
 * `truncateBreadcrumLongTooltip`; WaveUI spells it correctly and keeps no alias.
 * @default maxLength 80
 */
export function truncateBreadcrumbLongTooltip(content: string, maxLength = 80): string {
  return truncate(content, maxLength);
}
