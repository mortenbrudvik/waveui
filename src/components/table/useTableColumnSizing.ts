import { useCallback, useMemo, useRef } from 'react';
import { useControllable } from '../../hooks/useControllable';
import {
  clampColumnWidth,
  DEFAULT_MIN_COLUMN_WIDTH,
  getColumnEntry,
  initialColumnWidth,
  resolveColumnWidths,
  totalWidth,
  type ColumnSizingOption,
} from '../../lib/columnSizing';
import {
  createTableFeaturePlugin,
  type TableColumnSizingState,
  type TableFeaturePlugin,
} from './useTableFeatures';

const NO_WIDTHS: Readonly<Record<string, number>> = {};

/** What {@link UseTableColumnSizingOptions.onColumnWidthsChange} gets besides the new widths. */
export interface TableColumnWidthsChangeDetails {
  /** The column that was resized. */
  columnId: string;
  /** Its new width in pixels, held at or above its `minWidth`. */
  width: number;
  /**
   * The event behind the change (the drag, the key press); when none was passed, an untrusted
   * `resize` event with no target.
   */
  event: Event;
}

/** Options of {@link useTableColumnSizing}. */
export interface UseTableColumnSizingOptions {
  /**
   * Per column, by `columnId`: `minWidth` (`@default 80`), and the width the column starts at,
   * `defaultWidth` or else `idealWidth` (else 150). Ids that are not columns are ignored. May be
   * written inline.
   */
  columnSizingOptions?: Record<string, ColumnSizingOption>;
  /**
   * The column widths in pixels (controlled), by `columnId`: a column without an entry has its
   * initial width. Pair it with `onColumnWidthsChange`.
   */
  columnWidths?: Record<string, number>;
  /** The column widths at first render (uncontrolled). */
  defaultColumnWidths?: Record<string, number>;
  /**
   * Called with the width of every column and the details whenever a width changes (every step of
   * a drag or key press). The details are always passed; they are typed optional through 0.x, as
   * every `details` argument. Setting the width a column already has does not call it, once a
   * width is state.
   */
  onColumnWidthsChange?: (
    widths: Record<string, number>,
    details?: TableColumnWidthsChangeDetails,
  ) => void;
}

/**
 * The column sizing plugin of `useTableFeatures`: the width of every column, held at or above its
 * minimum, and the props that lay a static `Table` out with them. Fills `state.columnSizing`.
 * Spread `getTableProps()` on the `Table`, render a `<colgroup>` with a `<col>` per column and
 * spread `getColumnProps(columnId)` on it, and give each `Table.ResizeHandle` the
 * `getResizeHandleProps(columnId)`. The widths are controlled with `columnWidths` or uncontrolled
 * with `defaultColumnWidths`. Until a width is state (a resize, or `columnWidths` or
 * `defaultColumnWidths` is given) the table is 100% wide and at least as wide as the columns; from
 * then on it is exactly as wide as they are, so a dragged edge follows the pointer. There is no
 * maximum width, and no fitting of the columns to the container. Call it unconditionally and pass
 * the plugin to `useTableFeatures`.
 *
 * @example
 * const { columnSizing } = useTableFeatures({ items, columns }, [
 *   useTableColumnSizing({ columnSizingOptions: { name: { minWidth: 120, defaultWidth: 240 } } }),
 * ]);
 * <Table {...columnSizing.getTableProps()}>
 *   <colgroup>
 *     {columns.map((c) => <col key={c.columnId} {...columnSizing.getColumnProps(c.columnId!)} />)}
 *   </colgroup>
 * </Table>
 */
export function useTableColumnSizing<T>(
  options: UseTableColumnSizingOptions = {},
): TableFeaturePlugin<T> {
  const {
    columnSizingOptions,
    columnWidths: columnWidthsProp,
    defaultColumnWidths,
    onColumnWidthsChange,
  } = options;

  // The details of the change being made, set around the setter: useControllable calls its
  // onChange synchronously inside it, and only on change.
  const detailsRef = useRef<TableColumnWidthsChangeDetails | undefined>(undefined);
  const [widths, setWidths, isControlled] = useControllable<Record<string, number>>(
    columnWidthsProp,
    defaultColumnWidths ?? NO_WIDTHS,
    (next) => {
      const details = detailsRef.current;
      if (details) onColumnWidthsChange?.(next, details);
    },
  );
  // Until a width is state, an uncontrolled table without defaults holds `NO_WIDTHS` itself.
  const isSized = isControlled || defaultColumnWidths !== undefined || widths !== NO_WIDTHS;

  const resize = useCallback(
    (ids: readonly string[], columnId: string, width: number, event: Event | undefined) => {
      if (!ids.includes(columnId) || !Number.isFinite(width)) return;
      const clamped = clampColumnWidth(width, getColumnEntry(columnSizingOptions, columnId));
      detailsRef.current = { columnId, width: clamped, event: event ?? new Event('resize') };
      try {
        setWidths((previous) => {
          const next = resolveColumnWidths(ids, columnSizingOptions, previous);
          // The first width taken as state is a change even when it equals the initial one (an
          // earlier change of the same event already took one).
          const sized = isSized || previous !== NO_WIDTHS;
          if (sized && next[columnId] === clamped) return previous;
          next[columnId] = clamped;
          return next;
        });
      } finally {
        detailsRef.current = undefined;
      }
    },
    [setWidths, columnSizingOptions, isSized],
  );

  return useMemo(
    () =>
      createTableFeaturePlugin<T>({
        feature: 'columnSizing',
        extend: (state) => {
          const ids: string[] = [];
          for (const column of state.columns) {
            if (column.columnId !== undefined) ids.push(column.columnId);
          }
          const resolved = resolveColumnWidths(ids, columnSizingOptions, widths);
          const total = totalWidth(ids, resolved);
          const setColumnWidth: TableColumnSizingState['setColumnWidth'] = (id, width, event) =>
            resize(ids, id, width, event);
          const initialWidthOf = (id: string) =>
            initialColumnWidth(getColumnEntry(columnSizingOptions, id));
          const widthOf = (id: string) => getColumnEntry(resolved, id) ?? initialWidthOf(id);
          const columnSizing: TableColumnSizingState = {
            columnWidths: resolved,
            isSized,
            getColumnWidth: (id) => getColumnEntry(resolved, id),
            setColumnWidth,
            getTableProps: () => ({
              style: isSized
                ? { tableLayout: 'fixed', width: total }
                : { tableLayout: 'fixed', width: '100%', minWidth: total },
            }),
            getColumnProps: (id) => ({ style: { width: widthOf(id) } }),
            getResizeHandleProps: (id) => ({
              width: widthOf(id),
              minWidth:
                getColumnEntry(columnSizingOptions, id)?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH,
              onResize: (width, details) => setColumnWidth(id, width, details?.event),
              // A table without width state is in its initial layout: nothing to reset.
              onReset: ({ event }) => {
                if (isSized) setColumnWidth(id, initialWidthOf(id), event);
              },
            }),
          };
          return { ...state, columnSizing };
        },
      }),
    [widths, isSized, columnSizingOptions, resize],
  );
}
