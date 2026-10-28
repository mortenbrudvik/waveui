import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { isDev, warnOnce } from '../../lib/dev';
import type { SelectionMode } from '../../lib/types';
import type { DataGridColumn, DataGridSort, SortDirection } from './DataGrid';

/** One row of {@link useTableFeatures}: an item of `items` with its id. */
export interface TableRowData<T> {
  /** The item. */
  item: T;
  /** The row's id, from `getRowId` (by default the index in `items`, as a string). */
  rowId: string;
  /** The item's index in `items`. Sorting moves the row, not this index. */
  index: number;
}

/** The sort of {@link useTableFeatures} (`state.sort`), filled by `useTableSort`. */
export interface TableSortState {
  /** The sorted column and its direction, or `null` while the rows are in the order of `items`. */
  value: DataGridSort | null;
  /** Sorts by the column `columnId` in `direction`. */
  setColumnSort(columnId: string, direction: SortDirection, event?: Event): void;
  /**
   * Sorts by the column `columnId`, as a sortable header of DataGrid does: ascending, or descending
   * when the column is already sorted ascending.
   */
  toggleColumnSort(columnId: string, event?: Event): void;
  /** The direction of the column `columnId` while the rows are sorted by it, else `undefined`. */
  getSortDirection(columnId: string): SortDirection | undefined;
}

/**
 * The selection of {@link useTableFeatures} (`state.selection`), filled by `useTableSelection`. The
 * selection is a set of row ids held apart from the rendered rows: rows that are not rendered keep
 * their state, and ids whose item is not in `items` (filtered out, on another page) stay selected.
 */
export interface TableSelectionState {
  /** `single` keeps at most one row selected; `multiple` selects rows independently. */
  selectionMode: SelectionMode;
  /** The selected row ids, ids whose item is not in `items` included. */
  selectedItems: ReadonlySet<string>;
  /**
   * Whether every selectable row of `items` is selected (and there is one): rows that
   * `isDisabled` marks do not count, rows that are not rendered do.
   */
  allRowsSelected: boolean;
  /**
   * Whether a row of `items` is selected while not every selectable one is (the mixed state of a
   * select-all checkbox). A selected disabled row counts; ids outside `items` do not.
   */
  someRowsSelected: boolean;
  /** Whether the row `id` is selected. */
  isRowSelected(id: string): boolean;
  /** Selects or deselects the row `id` (`multiple`); selects it (`single`). */
  toggleRow(id: string, event?: Event): void;
  /** Selects the row `id`; in `single` mode it replaces the selection. */
  selectRow(id: string, event?: Event): void;
  /** Deselects the row `id`. */
  deselectRow(id: string, event?: Event): void;
  /**
   * Selects every selectable row of `items` when not all of them are selected, else deselects
   * them. A disabled row keeps its state, and ids outside `items` stay selected. It does nothing in
   * `single` mode.
   */
  toggleAllRows(event?: Event): void;
  /** Empties the selection, ids outside `items` included. */
  clearRows(event?: Event): void;
}

/**
 * The column widths of {@link useTableFeatures} (`state.columnSizing`), filled by
 * `useTableColumnSizing`. Without that plugin no width is set and the functions do nothing.
 */
export interface TableColumnSizingState {
  /** The width of each sized column in pixels, by `columnId`. */
  columnWidths: Readonly<Record<string, number>>;
  /** Whether a width is state (set, controlled or given as a default). */
  isSized: boolean;
  /** The width of the column `columnId` in pixels, or `undefined` when it has none. */
  getColumnWidth(columnId: string): number | undefined;
  /** Sets the width of the column `columnId` in pixels. */
  setColumnWidth(columnId: string, width: number, event?: Event): void;
  /** Props for the table element: its width style. */
  getTableProps(): { style: CSSProperties };
  /** Props for the column's `<col>` element: its width style. */
  getColumnProps(columnId: string): { style: CSSProperties };
}

/** The state that {@link useTableFeatures} returns. */
export interface TableFeaturesState<T> {
  /** The items, as given. */
  items: readonly T[];
  /** The columns, as given. */
  columns: readonly DataGridColumn<T>[];
  /** The row id of an item: `getRowId` as given, else the index as a string. */
  getRowId: (item: T, index: number) => string;
  /**
   * The rows in display order: sorted while `useTableSort` sorts them, else in the order of
   * `items`. The same array is returned until `items`, `getRowId`, `columns` or the sort change.
   */
  getRows(): readonly TableRowData<T>[];
  /** The sort; without `useTableSort` it is `null` and its functions do nothing. */
  sort: TableSortState;
  /** The selection; without `useTableSelection` nothing is selected and its functions do nothing. */
  selection: TableSelectionState;
  /** The column widths; without `useTableColumnSizing` no width is set. */
  columnSizing: TableColumnSizingState;
}

/** Options of {@link useTableFeatures}. */
export interface UseTableFeaturesOptions<T> {
  /** The items, one row each. Every item counts for select-all, rendered or not. */
  items: readonly T[];
  /** The columns, from `createTableColumn`. The sort uses the `compare` of the sorted column. */
  columns: readonly DataGridColumn<T>[];
  /**
   * The row id of an item: unique, and the same for an item across renders (selection and the
   * selection callbacks use it). Pass a stable function (defined outside the component, or
   * memoised): the rows are rebuilt when it changes.
   * @default (item, index) => String(index)
   */
  getRowId?: (item: T, index: number) => string;
}

declare const tableFeaturePluginBrand: unique symbol;

/**
 * A feature of {@link useTableFeatures}, returned by `useTableSort`, `useTableSelection` and
 * `useTableColumnSizing`, which hold the feature's state where they are called. The object is
 * opaque. It keeps its identity while the feature's state and the options it reads keep theirs; a
 * new one costs `useTableFeatures` a recompute of its state, and of the rows only when the sort
 * changed. `T` is the item type the plugin reads (a selection's `isDisabled`): a plugin that reads
 * no item, such as the sort, fits every table.
 */
export interface TableFeaturePlugin<T> {
  /** The brand of a plugin: only the plugin hooks create one. */
  readonly [tableFeaturePluginBrand]: (item: T) => void;
}

/** The slot of the state that a plugin fills. */
type TableFeatureName = 'sort' | 'selection' | 'columnSizing';

/**
 * What a plugin does: the run-time content of a {@link TableFeaturePlugin}, read only by
 * {@link useTableFeatures} (module-only).
 */
export interface TableFeaturePluginImplementation<T> {
  /** The slot it fills; a second plugin for the same slot warns. */
  feature: TableFeatureName;
  /**
   * Puts the rows in display order (the sort plugin only). The rows are rebuilt when this function
   * changes, so it keeps its identity while the order it gives cannot change, whatever happens to
   * the plugin object.
   */
  sortRows?: (
    rows: readonly TableRowData<T>[],
    columns: readonly DataGridColumn<T>[],
  ) => readonly TableRowData<T>[];
  /** Returns the state with the plugin's slot filled. Pure. */
  extend: (state: TableFeaturesState<T>) => TableFeaturesState<T>;
}

/** Wraps a plugin's implementation as the opaque plugin (module-only, for the plugin hooks). */
export function createTableFeaturePlugin<T>(
  implementation: TableFeaturePluginImplementation<T>,
): TableFeaturePlugin<T> {
  // The brand is a type only: the plugin is its implementation object.
  return implementation as unknown as TableFeaturePlugin<T>;
}

function implementationOf<T>(plugin: TableFeaturePlugin<T>): TableFeaturePluginImplementation<T> {
  return plugin as unknown as TableFeaturePluginImplementation<T>;
}

const NO_PLUGINS: readonly never[] = [];

const NO_SELECTED_IDS: ReadonlySet<string> = new Set();

const doNothing = (): void => {};

const indexRowId = (_item: unknown, index: number): string => String(index);

const INERT_SORT: TableSortState = {
  value: null,
  setColumnSort: doNothing,
  toggleColumnSort: doNothing,
  getSortDirection: () => undefined,
};

const INERT_SELECTION: TableSelectionState = {
  selectionMode: 'multiple',
  selectedItems: NO_SELECTED_IDS,
  allRowsSelected: false,
  someRowsSelected: false,
  isRowSelected: () => false,
  toggleRow: doNothing,
  selectRow: doNothing,
  deselectRow: doNothing,
  toggleAllRows: doNothing,
  clearRows: doNothing,
};

const INERT_COLUMN_SIZING: TableColumnSizingState = {
  columnWidths: {},
  isSized: false,
  getColumnWidth: () => undefined,
  setColumnWidth: doNothing,
  getTableProps: () => ({ style: {} }),
  getColumnProps: () => ({ style: {} }),
};

/** The last plugin of `plugins` that fills `feature` (a feature given twice warns). */
function pluginFor<T>(
  plugins: readonly TableFeaturePlugin<T>[],
  feature: TableFeatureName,
): TableFeaturePluginImplementation<T> | undefined {
  for (let index = plugins.length - 1; index >= 0; index -= 1) {
    const implementation = implementationOf(plugins[index]!);
    if (implementation.feature === feature) return implementation;
  }
  return undefined;
}

function duplicateFeatureOf<T>(plugins: readonly TableFeaturePlugin<T>[]): string | undefined {
  const seen = new Set<TableFeatureName>();
  for (const plugin of plugins) {
    const { feature } = implementationOf(plugin);
    if (seen.has(feature)) return feature;
    seen.add(feature);
  }
  return undefined;
}

/**
 * Headless table state for a table built from the static `Table` parts: the rows of `items`, and
 * the features its plugins add (`useTableSort`, `useTableSelection`, `useTableColumnSizing`). Each
 * plugin fills its own part of the state (`sort`, `selection`, `columnSizing`), so the order of
 * the array does not matter. The state follows the data, not the rendered rows, so a table that
 * renders a page or a window of its rows keeps select-all and the sort over every item.
 *
 * Call each plugin hook unconditionally, in the array or before it, and pass the same plugins on
 * every render; to turn a feature off, change its options. Options may be written inline: a plugin
 * whose options change identity on every render (an inline `isDisabled`) only makes the state be
 * recomputed on every render, while `getRows()` keeps its array until `items`, `getRowId`,
 * `columns` or the sort change. A feature given twice (the last plugin of it is used), a plugin
 * count that changes between renders and repeated row ids are development warnings.
 *
 * @example
 * const { getRows, sort, selection } = useTableFeatures({ items, columns, getRowId }, [
 *   useTableSort({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
 *   useTableSelection({ selectionMode: 'multiple' }),
 * ]);
 */
export function useTableFeatures<T>(
  options: UseTableFeaturesOptions<T>,
  plugins: readonly TableFeaturePlugin<T>[] = NO_PLUGINS,
): TableFeaturesState<T> {
  const { items, columns, getRowId = indexRowId } = options;

  // One variable per feature, so the memos below have fixed dependencies: a new array literal on
  // every render changes nothing, and a plugin that changes identity (an inline option) costs a
  // recompute of the state, never a state update during render. The rows depend on the sort's
  // `sortRows` alone, which the sort plugin keeps while the sort is the same.
  const sortPlugin = pluginFor(plugins, 'sort');
  const selectionPlugin = pluginFor(plugins, 'selection');
  const columnSizingPlugin = pluginFor(plugins, 'columnSizing');
  const sortRows = sortPlugin?.sortRows;

  const baseRows = useMemo(
    () => items.map((item, index) => ({ item, rowId: getRowId(item, index), index })),
    [items, getRowId],
  );

  const rows = useMemo(
    () => (sortRows ? sortRows(baseRows, columns) : baseRows),
    [baseRows, columns, sortRows],
  );

  const getRows = useCallback(() => rows, [rows]);

  const state = useMemo(() => {
    let next: TableFeaturesState<T> = {
      items,
      columns,
      getRowId,
      getRows,
      sort: INERT_SORT,
      selection: INERT_SELECTION,
      columnSizing: INERT_COLUMN_SIZING,
    };
    for (const plugin of [sortPlugin, selectionPlugin, columnSizingPlugin]) {
      if (plugin) next = plugin.extend(next);
    }
    return next;
  }, [items, columns, getRowId, getRows, sortPlugin, selectionPlugin, columnSizingPlugin]);

  const duplicateFeature = duplicateFeatureOf(plugins);
  useEffect(() => {
    if (duplicateFeature === undefined) return;
    warnOnce(
      'useTableFeatures:duplicate-plugin',
      `useTableFeatures: more than one plugin fills \`${duplicateFeature}\`. Pass each feature ` +
        'once; the last plugin of a feature is used.',
    );
  }, [duplicateFeature]);

  const pluginCount = plugins.length;
  const pluginCountRef = useRef(pluginCount);
  useEffect(() => {
    const previous = pluginCountRef.current;
    pluginCountRef.current = pluginCount;
    if (previous === pluginCount) return;
    warnOnce(
      'useTableFeatures:plugin-count',
      `useTableFeatures: the number of plugins changed between renders (from ${previous} to ` +
        `${pluginCount}). Pass the same plugins on every render and change their options ` +
        'instead; the new plugins are applied.',
    );
  }, [pluginCount]);

  useEffect(() => {
    if (!isDev) return;
    const seen = new Set<string>();
    for (const { rowId } of baseRows) {
      if (seen.has(rowId)) {
        warnOnce(
          'useTableFeatures:duplicate-row-id',
          `useTableFeatures: more than one item has the row id "${rowId}". Row ids must be ` +
            'unique: give getRowId an id that differs for each item.',
        );
        return;
      }
      seen.add(rowId);
    }
  }, [baseRows]);

  return state;
}
