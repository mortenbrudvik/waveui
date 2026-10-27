/**
 * The table helpers (P9-03). Server-safe: the module imports only types, so a Server Component may
 * import it (a column with functions still cannot be passed from a Server Component to the client
 * DataGrid, since functions are not serializable).
 */
import type * as React from 'react';
import type { DataGridColumn } from '../components/table/DataGrid';

/** Options of {@link createTableColumn}: a DataGrid column, with `columnId` required. */
export interface CreateTableColumnOptions<T> {
  /** The column's id: the header cell's `columnId` and the `columnId` of the grid's sort. */
  columnId: string;
  /** The header content, unless `renderHeaderCell` is given. */
  label?: React.ReactNode;
  /**
   * Orders two items of the column, as `Array.prototype.sort` does (negative: `a` first). Makes the
   * column sortable unless `sortable` is `false`.
   */
  compare?: (a: T, b: T) => number;
  /** Renders the column's cell content for one item. Without it, the column's cells are empty. */
  renderCell?: (item: T) => React.ReactNode;
  /** Renders the header content in place of `label`. */
  renderHeaderCell?: () => React.ReactNode;
  /**
   * Whether the header is a sort button.
   * @default compare !== undefined
   */
  sortable?: boolean;
}

/**
 * Creates a column for DataGrid's `columns`, typed by the grid's items, with `sortable` resolved
 * (`true` when the column has `compare`, unless `sortable` says otherwise). Returns a new object
 * with every member of {@link CreateTableColumnOptions}; the options are not changed. The
 * function is pure and server-safe.
 *
 * @example
 * const columns = [
 *   createTableColumn<Person>({
 *     columnId: 'name',
 *     label: 'Name',
 *     compare: (a, b) => a.name.localeCompare(b.name),
 *     renderCell: (person) => person.name,
 *   }),
 * ];
 */
export function createTableColumn<T>(options: CreateTableColumnOptions<T>): DataGridColumn<T> {
  const { columnId, label, compare, renderCell, renderHeaderCell, sortable } = options;
  return {
    columnId,
    label,
    compare,
    renderCell,
    renderHeaderCell,
    sortable: sortable ?? compare !== undefined,
  };
}
