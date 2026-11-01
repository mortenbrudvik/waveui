import * as React from 'react';
import {
  useDataGridContext,
  useDataGridRowContext,
  useDataGridSortContext,
} from './DataGrid.context';
import type { DataGridSort } from './DataGrid';

/*
 * The public hooks of DataGrid for cells, headers and other parts of your own (P13-02, R16):
 * narrow views of the grid's sort, its selection and the row around a cell, read from the
 * internal contexts of `DataGrid.context.ts`, whose objects and values stay internal (R11).
 * Imports no component: `DataGrid.tsx` re-exports the hooks, never the reverse.
 */

/** The sort of a `DataGrid` that {@link useDataGridSort} returns. */
export interface UseDataGridSortResult {
  /**
   * The sorted column and its direction, as the headers show it (`aria-sort`), or `null` while the
   * grid is unsorted: the controlled `sort`, else the grid's own.
   */
  sort: DataGridSort | null;
  /**
   * Sorts the grid by the column and direction of `sort`, as activating a sortable header does:
   * `onSortChange(sort, details?)` is called once with a new object of those two values (the
   * deprecated positional form with the column and the direction), `details.event` is `event`,
   * else an untrusted `sort` event with no target, and an uncontrolled grid sorts. A controlled
   * grid changes when its parent passes the new `sort`. Any column can be named, sortable or not,
   * as a controlled `sort` can; the sort the grid already has changes nothing and calls nothing.
   * The grid's callback never receives `null`, so no request clears the sort: a parent that
   * controls `sort` clears it with `sort={null}`. The same function for the life of the grid.
   */
  setSort: (sort: DataGridSort, event?: Event) => void;
}

/** The selection of a `DataGrid` that {@link useDataGridSelection} returns. */
export interface UseDataGridSelectionResult {
  /**
   * The selected row ids the grid holds: the controlled `selectedItems`, else its own, the same
   * array while the set of ids stays the same (a controlled `selectedItems` that passes the same
   * ids in another order keeps the earlier array, in its order). With `items`, every selected id,
   * whether its row is rendered (a `virtualWindow` renders only the rows in view), filtered out or
   * no item at all. Without `items`, an id whose row is no longer rendered stays until the grid's
   * next change drops it. Empty in a grid without selection (`selectionMode="none"`).
   */
  selectedItems: readonly string[];
  /**
   * Whether the row `id` is selected, as its row shows it (`aria-selected`): in single mode only
   * the one row the grid selects, though `selectedItems` holds more ids (a development warning
   * says so). Never in a grid without selection. A new function whenever the selection changes,
   * so a memoised part given only this function renders the new selection.
   */
  isSelected: (id: string) => boolean;
  /**
   * Toggles the row `id`, as its selection control does: in multiple mode it adds or removes the
   * id and keeps the others; in single mode it selects the row alone, or clears the selection when
   * it is the selected row. `onSelectedItemsChange(selectedItems, details?)` is called once with
   * the new ids and `details.event`, which is `event`, else an untrusted `select` event with no
   * target; an uncontrolled grid changes, a controlled one when its parent passes the new
   * `selectedItems`. It does nothing in a grid without selection, for a row whose selection is
   * disabled (`isSelectionDisabled`, or the `disabled` of its selection cell, whether the row is
   * rendered or not) and, in a grid without `items`, for an id no rendered row has. With `items`,
   * any id can be toggled, as the grid keeps ids that are no item. The same function while the
   * grid's `selectionMode`, and whether it has `items`, stay the same. Call it from an event or a
   * passive effect: in a grid without `items` the rows register in their layout effects, after
   * those of the cells inside them, so a call from a cell's `useLayoutEffect` on mount finds no row
   * with the id and does nothing.
   */
  toggle: (id: string, event?: Event) => void;
}

const NO_ITEMS: readonly string[] = [];

/**
 * The sort of the surrounding `DataGrid`, for a header, a cell or a footer of your own: `sort`, the
 * sorted column and its direction (`null` while unsorted), and `setSort` to sort the grid as a
 * sortable header does, through its `onSortChange`. It is a narrow view of the grid (its context
 * objects are not public), the same object while the sort stays the same. The nearest `DataGrid`
 * answers: in a grid nested in a cell, the nested grid.
 *
 * Must be called inside a `DataGrid` (anywhere in it: a `caption`, the header, a row, a footer):
 * outside one it throws in development and, in production, logs once and returns an inert value
 * (`sort: null`, `setSort` does nothing).
 *
 * Fluent UI's counterpart is `useDataGridContext_unstable(selector)` with the context's `sort`
 * (`sortColumn`, `sortDirection`, `setColumnSort(event, columnId, direction)` and
 * `toggleColumnSort(event, columnId)`), which returns default values outside a grid.
 *
 * @example
 * function ReverseButton() {
 *   const { sort, setSort } = useDataGridSort();
 *   if (sort === null) return null;
 *   const direction = sort.direction === 'ascending' ? 'descending' : 'ascending';
 *   return (
 *     <button
 *       type="button"
 *       onClick={(event) => setSort({ columnId: sort.columnId, direction }, event.nativeEvent)}
 *     >
 *       Reverse order
 *     </button>
 *   );
 * }
 */
export function useDataGridSort(): UseDataGridSortResult {
  const { sort, setSort } = useDataGridSortContext('useDataGridSort');
  return React.useMemo(() => ({ sort, setSort }), [sort, setSort]);
}

/**
 * The selection of the surrounding `DataGrid`, for a cell, a header or a footer of your own:
 * `selectedItems`, `isSelected(id)` and `toggle(id)`, which changes the selection as a row's
 * selection control does, through the grid's `onSelectedItemsChange`. With `useDataGridRowId`, a
 * cell can show and toggle its own row's selection; the row's control, Space on a cell and
 * select-all stay in step with it. It is a narrow view of the grid (its context objects and its
 * store are not public), the same object while the selection stays the same. The nearest
 * `DataGrid` answers.
 *
 * Every component that calls it renders again on each change of the selection, whichever row
 * changed: a cell per row that calls it renders in every row on each toggle, so in a grid of many
 * rendered rows keep its callers few (a footer, a header) or render only the rows in view (a
 * `virtualWindow`).
 *
 * Must be called inside a `DataGrid`: outside one it throws in development and, in production,
 * logs once and returns an inert value (nothing selected, `toggle` does nothing).
 *
 * Fluent UI's counterpart is `useDataGridContext_unstable(selector)` with the context's
 * `selection` (`selectedRows`, `isRowSelected(rowId)`, `toggleRow(event, rowId)`, …), which
 * returns default values outside a grid.
 *
 * @example
 * function SelectToggle({ name }: { name: string }) {
 *   const rowId = useDataGridRowId();
 *   const { isSelected, toggle } = useDataGridSelection();
 *   if (rowId === undefined) return null;
 *   return (
 *     <ToggleButton
 *       size="small"
 *       pressed={isSelected(rowId)}
 *       aria-label={`Select ${name}`}
 *       onClick={(event) => toggle(rowId, event.nativeEvent)}
 *     >
 *       Select
 *     </ToggleButton>
 *   );
 * }
 */
export function useDataGridSelection(): UseDataGridSelectionResult {
  const { selectionMode, store, toggleRow } = useDataGridContext('useDataGridSelection');
  const snapshot = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const toggle = React.useCallback(
    (id: string, event?: Event) => {
      if (selectionMode === 'none' || store.isDisabled(id)) return;
      toggleRow(id, event ?? new Event('select'));
    },
    [selectionMode, store, toggleRow],
  );
  return React.useMemo(
    () =>
      selectionMode === 'none'
        ? { selectedItems: NO_ITEMS, isSelected: () => false, toggle }
        : {
            selectedItems: snapshot.selectedItems,
            isSelected: (id: string) => store.isSelected(id, selectionMode === 'single'),
            toggle,
          },
    [selectionMode, snapshot, store, toggle],
  );
}

/**
 * The id of the surrounding `DataGrid.Row`, for a cell of your own: its `rowId`, else, in a row
 * rendered from the grid's `items`, the item's id (`getRowId`, by default its index), in a grid
 * with or without selection. `undefined` in a header row and in a body row without an id. Pass it
 * to `useDataGridSelection().isSelected` and `toggle`.
 *
 * Must be called inside a `DataGrid.Row`: outside one (outside a grid, in its `caption`, in a
 * header row that is a plain `<tr>`, such as the one `columns` generate) it throws in development
 * and, in production, logs once and returns `undefined`.
 *
 * Fluent UI's counterpart is `useTableRowIdContext()`, which reads the id of the item a
 * `DataGridBody` renders a row for and returns `''` outside one.
 *
 * @example
 * function SelectToggle({ name }: { name: string }) {
 *   const rowId = useDataGridRowId();
 *   const { isSelected, toggle } = useDataGridSelection();
 *   if (rowId === undefined) return null;
 *   return (
 *     <ToggleButton
 *       size="small"
 *       pressed={isSelected(rowId)}
 *       aria-label={`Select ${name}`}
 *       onClick={(event) => toggle(rowId, event.nativeEvent)}
 *     >
 *       Select
 *     </ToggleButton>
 *   );
 * }
 */
export function useDataGridRowId(): string | undefined {
  return useDataGridRowContext('useDataGridRowId').rowId;
}
