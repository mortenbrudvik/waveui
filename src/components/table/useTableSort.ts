import { useCallback, useMemo, useRef } from 'react';
import { useControllable } from '../../hooks/useControllable';
import type {
  DataGridColumn,
  DataGridSort,
  DataGridSortChangeDetails,
  SortDirection,
} from './DataGrid';
import {
  createTableFeaturePlugin,
  type TableFeaturePlugin,
  type TableRowData,
  type TableSortState,
} from './useTableFeatures';

/** Options of {@link useTableSort}. */
export interface UseTableSortOptions {
  /**
   * The sort (controlled): the sorted column and its direction, or `null` for the order of
   * `items`. Pair it with `onSortChange`.
   */
  sort?: DataGridSort | null;
  /**
   * The sort at first render (uncontrolled).
   * @default null
   */
  defaultSort?: DataGridSort | null;
  /**
   * Called with the new sort whenever it changes, and the event behind it when the change was
   * given one. Setting the sort it already has does not call it.
   */
  onSortChange?: (sort: DataGridSort, details?: DataGridSortChangeDetails) => void;
}

/**
 * The rows in the order of `sort`: a stable sort of a copy by the `compare` of the sorted column,
 * looked up once (not per comparison). Descending negates `compare`, so rows that compare equal
 * keep their order in both directions. Without a column of that id, or without `compare`, the
 * rows are returned as they are.
 */
export function sortTableRows<T, R extends { item: T }>(
  rows: readonly R[],
  columns: readonly DataGridColumn<T>[],
  sort: DataGridSort,
): readonly R[] {
  const compare = columns.find((column) => column.columnId === sort.columnId)?.compare;
  if (!compare) return rows;
  return rows
    .slice()
    .sort(
      sort.direction === 'descending'
        ? (a, b) => -compare(a.item, b.item)
        : (a, b) => compare(a.item, b.item),
    );
}

/**
 * The sort plugin of `useTableFeatures`: sorts the rows by the `compare` of a column and fills
 * `state.sort`. The sort is controlled with `sort` or uncontrolled with `defaultSort`;
 * `toggleColumnSort` goes from ascending to descending as a sortable DataGrid header does. The
 * sorted column is the one whose `columnId` is the sort's `columnId` (the deprecated `id` of a
 * column is not read). Call it unconditionally and pass the plugin to `useTableFeatures`.
 *
 * @example
 * const state = useTableFeatures({ items, columns }, [
 *   useTableSort({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
 * ]);
 * state.sort.toggleColumnSort('name');
 */
export function useTableSort<T>(options: UseTableSortOptions = {}): TableFeaturePlugin<T> {
  const { sort: sortProp, defaultSort = null, onSortChange } = options;

  // The details of the change being made, set around the setter: useControllable calls its
  // onChange synchronously inside it, and only on change.
  const detailsRef = useRef<DataGridSortChangeDetails | undefined>(undefined);
  const [current, setSort] = useControllable<DataGridSort | null>(sortProp, defaultSort, (next) => {
    if (next) onSortChange?.(next, detailsRef.current);
  });

  const change = useCallback(
    (update: (previous: DataGridSort | null) => DataGridSort, event: Event | undefined) => {
      detailsRef.current = event ? { event } : undefined;
      try {
        setSort((previous) => {
          const next = update(previous);
          return previous?.columnId === next.columnId && previous.direction === next.direction
            ? previous
            : next;
        });
      } finally {
        detailsRef.current = undefined;
      }
    },
    [setSort],
  );

  const setColumnSort = useCallback<TableSortState['setColumnSort']>(
    (columnId, direction, event) => change(() => ({ columnId, direction }), event),
    [change],
  );

  const toggleColumnSort = useCallback<TableSortState['toggleColumnSort']>(
    (columnId, event) =>
      change(
        (previous) => ({
          columnId,
          direction:
            previous?.columnId === columnId && previous.direction === 'ascending'
              ? 'descending'
              : 'ascending',
        }),
        event,
      ),
    [change],
  );

  // Kept by content: a controlled sort passed as a new object with the same value keeps the plugin,
  // and with it the sorted rows.
  const columnId = current?.columnId;
  const direction: SortDirection | undefined = current?.direction;
  const value = useMemo<DataGridSort | null>(
    () => (columnId === undefined || direction === undefined ? null : { columnId, direction }),
    [columnId, direction],
  );

  return useMemo(() => {
    const sortState: TableSortState = {
      value,
      setColumnSort,
      toggleColumnSort,
      getSortDirection: (id) => (value?.columnId === id ? value.direction : undefined),
    };
    return createTableFeaturePlugin<T>({
      feature: 'sort',
      sortRows: value
        ? (rows: readonly TableRowData<T>[], columns: readonly DataGridColumn<T>[]) =>
            sortTableRows(rows, columns, value)
        : undefined,
      extend: (state) => ({ ...state, sort: sortState }),
    });
  }, [value, setColumnSort, toggleColumnSort]);
}
