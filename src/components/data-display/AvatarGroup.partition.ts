/** The layouts of an AvatarGroup. */
export type AvatarGroupLayout = 'stack' | 'spread' | 'pie';

/** Options of {@link partitionAvatarGroupItems}. */
export interface PartitionAvatarGroupItemsOptions<T> {
  /** All the items of the group. */
  items: readonly T[];
  /**
   * How many items are shown inline; the rest go to the overflow. A fraction is rounded down, `0`
   * or a negative value shows none, and `undefined` or `NaN` shows all (up to the layout's cap).
   */
  maxInlineItems?: number;
  /**
   * The layout of the group. A `pie` shows at most three items inline.
   * @default 'stack'
   */
  layout?: AvatarGroupLayout;
}

/** Result of {@link partitionAvatarGroupItems}. */
export interface PartitionAvatarGroupItemsResult<T> {
  /** The items shown inline, in order. */
  inlineItems: T[];
  /** The items in the overflow list, in order; `undefined` when nothing overflows. */
  overflowItems: T[] | undefined;
}

/** The most items a pie shows inline. */
const PIE_INLINE_LIMIT = 3;

/**
 * Splits the items of an AvatarGroup into the ones shown inline and the ones in the overflow list.
 * `AvatarGroup` uses it for `max`; use it yourself to render `AvatarGroup.Item`s and
 * `AvatarGroup.Popover` from your own list. Server-safe: it imports nothing.
 *
 * @example
 * const { inlineItems, overflowItems } = partitionAvatarGroupItems({ items: people, maxInlineItems: 4 });
 */
export function partitionAvatarGroupItems<T>({
  items,
  maxInlineItems,
  layout = 'stack',
}: PartitionAvatarGroupItemsOptions<T>): PartitionAvatarGroupItemsResult<T> {
  let limit =
    maxInlineItems === undefined || Number.isNaN(maxInlineItems)
      ? Infinity
      : Math.max(0, Math.floor(maxInlineItems));
  if (layout === 'pie') limit = Math.min(limit, PIE_INLINE_LIMIT);
  const inlineItems = items.slice(0, limit);
  return {
    inlineItems,
    overflowItems: items.length > inlineItems.length ? items.slice(inlineItems.length) : undefined,
  };
}
