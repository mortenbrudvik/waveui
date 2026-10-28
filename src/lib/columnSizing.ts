/** The sizing of one column of a table with resizable columns. */
export interface ColumnSizingOption {
  /**
   * The narrowest the column can be, in pixels: the initial width and every resize are held at or
   * above it.
   * @default 80
   */
  minWidth?: number;
  /**
   * The width the column starts at when it has no `defaultWidth`, in pixels.
   * @default 150
   */
  idealWidth?: number;
  /**
   * The width the column starts at, in pixels. It wins over `idealWidth`.
   * @default idealWidth, else 150
   */
  defaultWidth?: number;
}

/** The width of a column that sets none, in pixels. */
export const DEFAULT_COLUMN_WIDTH = 150;

/** The smallest width of a column that sets no `minWidth`, in pixels. */
export const DEFAULT_MIN_COLUMN_WIDTH = 80;

/**
 * Holds a width at or above the column's `minWidth` (80 without one). There is no maximum. A
 * width that is not a finite number becomes the minimum.
 */
export function clampColumnWidth(width: number, option?: ColumnSizingOption): number {
  const minWidth = option?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
  return Number.isFinite(width) ? Math.max(width, minWidth) : minWidth;
}

/**
 * The width of every column in `columnIds`: a given width (clamped), else the column's
 * `defaultWidth`, else its `idealWidth`, else 150 (clamped to `minWidth`). Ids in `options` or
 * `widths` that are not in `columnIds` are ignored.
 */
export function resolveColumnWidths(
  columnIds: readonly string[],
  options: Readonly<Record<string, ColumnSizingOption>> | undefined,
  widths: Readonly<Record<string, number>> | undefined,
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const id of columnIds) {
    const option = options?.[id];
    const given = widths?.[id];
    resolved[id] = clampColumnWidth(
      typeof given === 'number' && Number.isFinite(given)
        ? given
        : (option?.defaultWidth ?? option?.idealWidth ?? DEFAULT_COLUMN_WIDTH),
      option,
    );
  }
  return resolved;
}

/** The sum of the widths of `columnIds`; a column without a width counts as 0. */
export function totalWidth(
  columnIds: readonly string[],
  widths: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const id of columnIds) total += widths[id] ?? 0;
  return total;
}
