import * as React from 'react';
import { cn } from '../../lib/cn';
import {
  dataGridBodyClassNames,
  dataGridCellClassNames,
  dataGridClassNames,
  dataGridHeaderCellClassNames,
  dataGridHeaderClassNames,
  dataGridRowClassNames,
  dataGridSelectionCellClassNames,
} from '../../lib/classNames';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import {
  isDev,
  reportMissingContext,
  resolveDeprecatedProp,
  warnDeprecated,
  warnOnce,
} from '../../lib/dev';
import { endsTextSelection, isForeignEvent } from '../../lib/events';
import type { Slot } from '../../lib/slot';
import { focusRingInset, forcedColors } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import {
  SELECTION_CELL_CLASSES,
  TableSelectionControl,
  TableSortButton,
  getTablePartKind,
  markTablePart,
} from './Table.shared';
import type { SortDirection } from './Table.shared';
import { useGridNavigation } from './useGridNavigation';

export type { SortDirection };

/** The sort state of a DataGrid: the sorted column and its direction. */
export interface DataGridSort {
  /** The `columnId` of the sorted column. */
  columnId: string;
  /** The sort direction. */
  direction: SortDirection;
}

/** Second argument of `onSortChange` (the `DataGridSort` form): the event behind the sort. */
export interface DataGridSortChangeDetails {
  /** The DOM event behind the sort: the click of the sort button (Enter and Space click it). */
  event: Event;
}

/** Second argument of `onSelectedItemsChange`: the event behind the change. */
export interface DataGridSelectedItemsChangeDetails {
  /**
   * The DOM event behind the change: the click of a selection control (the select-all checkbox
   * included), or the key press of Space on a row.
   */
  event: Event;
}

/**
 * Defines a column of the DataGrid, typed by the grid's items (`T`): the header cell it renders
 * and, with `items`, the cell of each row. `createTableColumn` builds one with `sortable` resolved.
 * A column with functions (`compare`, `renderCell`, `renderHeaderCell`) cannot be passed from a
 * Server Component to the DataGrid, since functions are not serializable: define such columns in a
 * client component.
 */
export interface DataGridColumn<T = unknown> {
  /**
   * Unique identifier of the column: the `columnId` of its header cell (and of the grid's sort) and
   * the React key of its cells. Required in practice: a column without it (and without the
   * deprecated `id`) cannot sort, with a development warning.
   */
  columnId?: string;
  /**
   * @deprecated Use `columnId`. Read only when `columnId` is not given, with a development
   * warning.
   */
  id?: string;
  /** The header content (text or any React node), unless `renderHeaderCell` is given. */
  label: React.ReactNode;
  /**
   * Orders two items of the column, as for `Array.prototype.sort` (negative: `a` first). A column
   * with `compare` is sortable unless `sortable` is `false`. While the grid's sort names the column
   * (its own sort, or a controlled `sort`), a grid with `items` renders its rows in this order: a
   * stable sort of a copy of `items`, so items that compare equal keep their order in `items`,
   * in both directions (descending negates `compare`). Without `compare` the grid never reorders
   * the rows: leave it out when the rows arrive sorted (a server-sorted grid).
   */
  compare?: (a: T, b: T) => number;
  /**
   * Renders the content of the column's cell for one item (rows rendered from `items`). Without
   * it, the column's cells are empty.
   */
  renderCell?: (item: T) => React.ReactNode;
  /** Renders the header content, in place of `label`. */
  renderHeaderCell?: () => React.ReactNode;
  /**
   * Whether the column's header is a sort button (the header cell carries `aria-sort`).
   * @default compare !== undefined
   */
  sortable?: boolean;
}

/** The built-in text of a DataGrid, for localization (see `DataGridBaseProps.labels`). */
export interface DataGridLabels {
  /** Accessible name of the select-all checkbox in the header (`selectionMode="multiple"`).
   * @default 'Select all rows'
   */
  selectAll?: string;
  /**
   * Visually hidden text of the selection column's header cell (`selectionMode="single"`), which
   * names that column.
   * @default 'Selection'
   */
  selectionHeader?: string;
}

const DEFAULT_SELECT_ALL_LABEL = 'Select all rows';
const DEFAULT_SELECTION_HEADER_LABEL = 'Selection';

/**
 * How a selected row of a DataGrid is filled (`selectionAppearance`): `'brand'` with the selected
 * token, `'neutral'` with the subtle selected token, `'none'` not at all.
 */
export type DataGridSelectionAppearance = 'brand' | 'neutral' | 'none';

/**
 * The props of a row's selection cell (`DataGrid.Row` `selectionCellProps`), the automatic cell or
 * a `DataGrid.SelectionCell` child (whose own props win).
 */
export interface DataGridRowSelectionCellProps {
  /**
   * Disables the row's selection control natively. The control is then no focus target of the grid
   * (the cell takes focus), and neither a row click (`selectOnRowClick`), Space on a cell nor
   * select-all changes the row's selection: select-all skips it, keeps it as it is, and tells its
   * state from the other rows. In a header row it disables the select-all checkbox.
   * @default false
   */
  disabled?: boolean;
  /**
   * Hides the selection control (it keeps its space and cannot be focused). The row is still
   * selected by a row click and Space, and tells its state with `aria-selected`.
   * @default false
   */
  invisible?: boolean;
  /** Class of the selection cell (`<td>`, or the `<th>` of a header row). */
  className?: string;
  /**
   * Accessible name of the selection control, in place of `selectionLabel` and the name taken from
   * the row's first cell; in a header row, the name of the select-all checkbox.
   */
  'aria-label'?: string;
}

/** Properties for the DataGridSelectionCell sub-component. */
export interface DataGridSelectionCellProps
  extends
    Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'children'>,
    DataGridRowSelectionCellProps {
  /**
   * The cell holds no content of its own: the grid renders the selection control (or, in a
   * single-mode header row, the hidden "Selection" header text).
   */
  children?: never;
  /**
   * Accessible name of the control, in place of `aria-label` and the row's `selectionLabel`.
   * Routed to the control, as `aria-label` and `aria-describedby` are.
   */
  'aria-labelledby'?: string;
  /** Ref to the selection control (`<input type="checkbox">` or `<input type="radio">`). */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the cell element (`<td>`, or the `<th>` of a header row's select-all). */
  ref?: React.Ref<HTMLTableCellElement>;
}

/**
 * The `items` prop of a DataGrid that renders its rows from data, part of every sort form of
 * `DataGridProps` but the 0.4 one. `T` is the type of the items.
 */
export interface DataGridItemsProps<T = unknown> {
  /**
   * The grid's data, one body row per item, in this order unless the sorted column has `compare`
   * (see `DataGridColumn.compare`). With `columns` and no `DataGrid.Body` child (or one without
   * children), the grid renders the rows and cells from the columns; a `DataGrid.Body` whose child
   * is a render function renders the row of each item. Each row's `rowId` comes from `getRowId`.
   * The grid reads the array and never changes it. With `items`, `onSortChange` receives a
   * `DataGridSort` object and `details`, never the 0.4 arguments. `items` may not be `undefined`
   * unless `sort` or `defaultSort` is given; pass `items={data ?? []}` while loading.
   */
  items?: readonly T[];
}

/** Props of every DataGrid, whatever sort API it uses. `T` is the type of its `items`. */
export interface DataGridBaseProps<T = unknown> extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * The row id of an item: the `rowId` of its row (for selection), for rows rendered from `items`.
   * A row's own `rowId` wins. Ids must be unique (a duplicate warns in development).
   * @default the item's index in `items`, as a string
   */
  getRowId?: (item: T) => string;
  /**
   * Column definitions. When given and no `DataGrid.Header` child is present, the header row
   * (including the selection column) is rendered from them: `columnId` becomes the header cell's
   * `columnId`, `renderHeaderCell()` (else `label`) its content, and `sortable` (by default, having
   * `compare`) makes it a sort button. With `items` and no `DataGrid.Body` child, the body rows are
   * rendered from them too: one `DataGrid.Cell` per column, filled by `renderCell`. Those rows
   * render again whenever the array changes, so keep it stable (defined outside the component, or
   * memoised).
   */
  columns?: readonly DataGridColumn<T>[];
  /**
   * Row selection mode. `'multiple'` adds a checkbox column with a "Select all rows" header
   * checkbox; `'single'` adds a radio column (its header reads "Selection" to assistive
   * technology). `labels` localizes both texts.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /**
   * The name of the select-all checkbox and the header text of the selection column, for
   * localization. Unset members keep their English defaults. Rows are named with their own
   * `selectionLabel`.
   */
  labels?: DataGridLabels;
  /**
   * Whether a click on a body row toggles its selection in a selectable grid (single mode: selects
   * the row alone, or clears it). The row's own `onClick` runs first; calling `preventDefault()`
   * in it keeps the selection. A click never toggles when it lands on an interactive element in
   * the row (a link, a button, an input, a label, an element with `tabindex` or a widget role, the
   * selection control included), comes from a popup portaled from the row (a Menu, a Popover), or
   * ends a text selection in the row (a drag across its text); nor does a click on a header row
   * or on a row whose selection is disabled (`selectionCellProps.disabled`). Space on a cell
   * toggles the row either way.
   * @default false
   */
  selectOnRowClick?: boolean;
  /**
   * How a selected row is filled: `'brand'` with the selected token, `'neutral'` with the subtle
   * selected token, `'none'` not at all (the selection control, `aria-selected` and, in forced
   * colors, the row's outline still show it). Rendered as `data-selection-appearance` on the grid.
   * @default 'brand'
   */
  selectionAppearance?: DataGridSelectionAppearance;
  /**
   * Subtle selection controls: a row's control is transparent while the row is not selected, until
   * the row is hovered or holds focus, and the select-all checkbox while no row is selected, until
   * the grid is hovered or holds focus. Forced colors and a coarse pointer (touch) always draw
   * them; they stay focusable and named. Rendered as `data-subtle-selection` on the grid.
   * @default false
   */
  subtleSelection?: boolean;
  /**
   * Controlled selected row ids (`DataGrid.Row` `rowId`). In single mode pass at most one id: with
   * several, only the first one whose row is rendered is selected (a development warning says so).
   */
  selectedItems?: readonly string[];
  /** Initially selected row ids (uncontrolled). In single mode, at most one (see `selectedItems`). */
  defaultSelectedItems?: readonly string[];
  /**
   * Called with the new selected row ids when the selection changes, then `details` (`{ event }`,
   * the click or key press behind the change). Ids of rows that are not rendered are left out of
   * the reported selection and of the select-all state, so the next change drops them. Until that
   * change an uncontrolled grid still holds such an id: a row re-added with the same `rowId` before
   * then is shown selected again.
   */
  onSelectedItemsChange?: (
    selectedItems: string[],
    details?: DataGridSelectedItemsChangeDetails,
  ) => void;
  /** @deprecated Use `selectedItems` (an array). A `Set` or an array is accepted. */
  selectedKeys?: ReadonlySet<string> | readonly string[];
  /** @deprecated Use `defaultSelectedItems` (an array). A `Set` or an array is accepted. */
  defaultSelectedKeys?: ReadonlySet<string> | readonly string[];
  /** @deprecated Use `onSelectedItemsChange`, which receives an array. Both are called. */
  onSelectionChange?: (keys: Set<string>) => void;
  /**
   * Props for the wrapper `<div>` around the `<table>`: a horizontally scrollable container
   * (`overflow-x-auto`). Use it for its className, style (e.g. a max height) or ref. The wrapper
   * is not a tab stop (the grid's own cell tab stop scrolls it) and has no role, so its
   * `aria-label`/`aria-labelledby` are applied only together with a `role` (e.g. `'region'`);
   * without one they are dropped with a development warning. Name the grid with `aria-label`.
   */
  containerProps?: Omit<React.ComponentPropsWithRef<'div'>, 'children'>;
  /**
   * DataGrid header, body, and row elements. Optional when `items` and `columns` render the grid;
   * a generated body is placed after the header and before a `<tfoot>` child.
   */
  children?: React.ReactNode;
  /** Ref to the `<table role="grid">` element. */
  ref?: React.Ref<HTMLTableElement>;
}

interface NoDeprecatedSortProps {
  sortColumn?: never;
  defaultSortColumn?: never;
  sortDirection?: never;
  defaultSortDirection?: never;
}

/** The 0.5 sort API, controlled: `sort` + `onSortChange(sort, details)`. */
export interface DataGridControlledSortProps extends NoDeprecatedSortProps {
  /** The controlled sort, or `null` for an unsorted grid. */
  sort: DataGridSort | null;
  /** Initial sort while `sort` is not given yet. */
  defaultSort?: DataGridSort | null;
  /**
   * Called with the new sort when a sortable header is activated, then `details` (`{ event }`).
   * With `items`, the grid orders its rows by the sorted column's `compare` (see
   * `DataGridColumn.compare`), also while `sort` is controlled; otherwise the consumer orders them.
   */
  onSortChange?: (sort: DataGridSort, details?: DataGridSortChangeDetails) => void;
}

/** The 0.5 sort API, uncontrolled: `defaultSort` (`null` for none) + `onSortChange(sort, details)`. */
export interface DataGridUncontrolledSortProps extends NoDeprecatedSortProps {
  sort?: undefined;
  /** The initial sort, or `null` for an initially unsorted grid. */
  defaultSort: DataGridSort | null;
  /**
   * Called with the new sort when a sortable header is activated, then `details` (`{ event }`).
   * With `items`, the grid orders its rows by the sorted column's `compare` (see
   * `DataGridColumn.compare`); otherwise the consumer orders them.
   */
  onSortChange?: (sort: DataGridSort, details?: DataGridSortChangeDetails) => void;
}

/**
 * The sort props of a grid with `items`: the 0.5 sort API, whether or not `sort` or `defaultSort`
 * is given (unsorted at first without them). The 0.4 positional `onSortChange` and the deprecated
 * sort props do not apply to such a grid.
 */
export interface DataGridItemsSortProps<T = unknown>
  extends DataGridItemsProps<T>, NoDeprecatedSortProps {
  /** The grid's data (see `DataGridItemsProps.items`). */
  items: readonly T[];
  /** The controlled sort, or `null` for an unsorted grid; `undefined` leaves the sort to the grid. */
  sort?: DataGridSort | null;
  /** The initial sort while `sort` is not given. */
  defaultSort?: DataGridSort | null;
  /**
   * Called with the new sort when a sortable header is activated, then `details` (`{ event }`).
   * The grid orders its rows by the sorted column's `compare` (see `DataGridColumn.compare`).
   */
  onSortChange?: (sort: DataGridSort, details?: DataGridSortChangeDetails) => void;
}

/**
 * The 0.4 sort API: `onSortChange(columnId, direction)` and the deprecated `sortColumn`/
 * `sortDirection` props. It applies whenever none of `items`, `sort` and `defaultSort` is given.
 * As in 0.4, the column and the direction can be controlled independently: the half that is not
 * controlled is kept internally and follows every sort request (mixed control, warned in
 * development).
 */
export interface DataGridLegacySortProps {
  /** A grid with `items` uses the 0.5 sort API (`DataGridItemsSortProps`). */
  items?: undefined;
  sort?: undefined;
  defaultSort?: undefined;
  /**
   * @deprecated Use `sort` (`{ columnId, direction }` or `null`). Without `sortDirection`, the
   * direction is kept internally (it toggles on repeated clicks).
   */
  sortColumn?: string;
  /** @deprecated Use `defaultSort`. */
  defaultSortColumn?: string;
  /**
   * @deprecated Use `sort`. Without `sortColumn`, the column is kept internally (it follows the
   * clicked header, starting from `defaultSortColumn`).
   */
  sortDirection?: SortDirection;
  /** @deprecated Use `defaultSort`. */
  defaultSortDirection?: SortDirection;
  /**
   * Called when a sortable header is activated, with the 0.4 arguments. Pass `items`, `sort` or
   * `defaultSort` to receive a `DataGridSort` object (and `details`) instead:
   * `defaultSort={null}` turns the object form on for an initially unsorted grid. A `sort` that is
   * still `undefined` (e.g. while data loads) does not: pass `sort={sort ?? null}`.
   *
   * @example
   * <DataGrid defaultSort={null} onSortChange={(sort) => setSort(sort)}>…</DataGrid>
   */
  onSortChange?: (columnId: string, direction: SortDirection) => void;
}

/**
 * Properties for the DataGrid component, whose `items` are of type `T`. The sort props form a
 * union: `sort`/`defaultSort` with `onSortChange(sort, details)` (0.5, also the form of every grid
 * with `items`), or the 0.4 form `onSortChange(columnId, direction)` with the deprecated
 * `sortColumn`/`sortDirection`/`defaultSortColumn`/`defaultSortDirection`, for a grid without
 * `items`. The two cannot be mixed.
 */
export type DataGridProps<T = unknown> = DataGridBaseProps<T> &
  (
    | (DataGridItemsProps<T> & DataGridControlledSortProps)
    | (DataGridItemsProps<T> & DataGridUncontrolledSortProps)
    | DataGridItemsSortProps<T>
    | DataGridLegacySortProps
  );

/** Properties for the DataGridHeader sub-component. */
export interface DataGridHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Header row elements. Each `<tr>` child (also inside a Fragment) gets the selection column's
   * header cell prepended when the grid is selectable, unless the row holds a
   * `DataGrid.SelectionCell` (which then is that cell, where it stands); a header row rendered by
   * another component should be a `DataGrid.Row`, which adds the cell itself. With several header
   * rows (a grouped header), only the first one gets the "Select all rows" control; later rows get
   * an empty cell.
   */
  children: React.ReactNode;
  /** Ref to the `<thead>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the DataGridHeaderCell sub-component. */
export interface DataGridHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Column ID used for sort tracking. Required for `sortable`. */
  columnId?: string;
  /**
   * Whether this column can be sorted. The content is rendered inside a `<button>`; the header
   * cell carries `aria-sort`. Ignored (with a development warning) without `columnId`.
   * @default false
   */
  sortable?: boolean;
  /**
   * The glyph a sortable header shows after its content while its column is sorted, in place of
   * the default arrow (up for ascending, down for descending). It is decorative (`aria-hidden`:
   * `aria-sort` on the header tells the direction) and carries `data-direction` (`ascending` or
   * `descending`), so one glyph can be turned by a selector on it. `null` and `undefined` keep the
   * arrow; `false`, or any value that renders nothing, shows no glyph. A `<button>` or `Button`
   * element (or a slot object whose `as` is one) is not nested in the sort button: its children
   * become the glyph and its props are dropped, with a development warning.
   */
  sortIcon?: Slot<'span'>;
  /** Header cell content. */
  children: React.ReactNode;
  /** Ref to the `<th>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** Properties for the DataGridBody sub-component, in a grid whose `items` are of type `T`. */
export interface DataGridBodyProps<T = unknown> extends Omit<
  React.HTMLAttributes<HTMLTableSectionElement>,
  'children'
> {
  /**
   * The body rows: `DataGrid.Row` elements, or a render function called with each item of the
   * grid's `items` (in the grid's sort order) and the item's index in `items` (its position there,
   * whatever the sort), which returns the item's `DataGrid.Row`. The grid keys each returned row
   * by its row id and gives it that id as `rowId` (from `getRowId`), and renders it again only
   * when its item, its index or the function change (a sort moves the rows). Type the function
   * by annotating its item parameter (`(person: Person) => …`) or with `DataGrid.Body<Person>`.
   * Without children, a grid with `items` and `columns` renders the rows from the columns; empty
   * children are no rows.
   */
  children?: React.ReactNode | ((item: T, index: number) => React.ReactNode);
  /** Ref to the `<tbody>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the DataGridRow sub-component. */
export interface DataGridRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Unique identifier for this row, used for selection (rows that share one are selected together;
   * a duplicate warns in development). A selectable grid renders no selection control (and warns
   * in development) for a row without it. A row rendered from the grid's `items` (by
   * `DataGrid.Body`'s render function or from `columns`) defaults to the item's row id
   * (`getRowId`).
   */
  rowId?: string;
  /**
   * Accessible name of the row's selection control. Defaults to the row's first child that is a
   * `DataGrid.Cell`, `<td>` or `<th>` element (`aria-labelledby`); a cell that another component
   * renders is not seen, so pass `selectionLabel` when the row's first cell is one. Without such a
   * child the control is named "Select row" (with a development warning). The selection cell's
   * `aria-label` (`selectionCellProps`, or a `DataGrid.SelectionCell` child's) wins over it.
   */
  selectionLabel?: string;
  /**
   * Props of the row's selection cell (`disabled`, `invisible`, `className`, `aria-label`): the
   * cell the row adds first in a selectable grid, or a `DataGrid.SelectionCell` child, whose own
   * props win (their classes are merged). In a header row they apply to the select-all cell.
   */
  selectionCellProps?: DataGridRowSelectionCellProps;
  /**
   * DataGrid cell elements. A `DataGrid.SelectionCell` child (also inside a Fragment) is the row's
   * selection cell, where it stands: the row then adds none.
   */
  children: React.ReactNode;
  /** Ref to the `<tr>` element. */
  ref?: React.Ref<HTMLTableRowElement>;
}

/** Properties for the DataGridCell sub-component. */
export interface DataGridCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell content. */
  children: React.ReactNode;
  /** Ref to the `<td>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

// ---------------------------------------------------------------------------
// Selection store
// ---------------------------------------------------------------------------

type SelectAllState = 'all' | 'some' | 'none';

/**
 * Selection state shared with the rows through `useSyncExternalStore`, so toggling one row
 * re-renders only that row (and the select-all header cell). The root pushes the committed
 * selection in a layout effect; rows register their ids. The effective selection is always
 * `selected ∩ registered`, derived on read (no pruning effect).
 *
 * @internal Not exported from the package (exported for its unit tests).
 */
export interface SelectionStore {
  /**
   * Row subscription: notified only when the selection changes. Rows registering or unregistering
   * notify no row, so adding or removing k of n rows costs O(k), not O(k·n); the one exception is
   * single mode with several selected ids, where a row registering can move the selected row.
   */
  subscribe(listener: () => void): () => void;
  /**
   * Select-all subscription: notified only when {@link getSelectAllState} changes (through the
   * selection or through rows registering and unregistering).
   */
  subscribeSelectAll(listener: () => void): () => void;
  /** Registers a rendered row id; returns the unregister function. */
  register(rowId: string): () => void;
  /**
   * Marks a row's selection disabled (`selectionCellProps.disabled`): select-all skips it and its
   * state counts only the other rows. Returns the function that undoes it. A row id is disabled
   * while any row registered with it is.
   */
  disable(rowId: string): () => void;
  /** Whether the row's selection is disabled (see {@link disable}). */
  isDisabled(rowId: string): boolean;
  /** How many rendered rows are registered with `rowId` (more than one: a duplicate). */
  countRegistrations(rowId: string): number;
  /** Sets the committed selection (layout effect of the root). */
  setSelected(items: readonly string[]): void;
  /**
   * Sets whether the grid is in single mode (layout effect of the root). Only then do rows
   * registering or unregistering re-check the one selected row of single mode and notify the rows.
   */
  setSingleMode(single: boolean): void;
  /**
   * Whether the row is selected. With `single`, only one row is: the first selected id (in
   * selection order) whose row is registered, else the first selected id (before any row
   * registered: the server render and the first client render).
   */
  isSelected(rowId: string, single?: boolean): boolean;
  /**
   * Whether all, some or none of the registered rows whose selection is not disabled are selected
   * (`'none'` without such rows). O(1).
   */
  getSelectAllState(): SelectAllState;
  /** Registered row ids in registration order. */
  getRegistered(): string[];
  /** `items` restricted to registered rows (order of `items`). */
  prune(items: readonly string[]): string[];
}

/**
 * Creates the {@link SelectionStore} of one DataGrid.
 *
 * @internal Not exported from the package (exported for its unit tests).
 */
export function createSelectionStore(
  initial: readonly string[],
  initialSingleMode = false,
): SelectionStore {
  let selected: ReadonlySet<string> = new Set(initial);
  /** Registered row id -> number of rows registered with it. */
  const registered = new Map<string, number>();
  /** Row id -> number of `disable` calls in effect for it. */
  const disabled = new Map<string, number>();
  /** Registered row ids whose selection is not disabled: the rows select-all changes. */
  let enabledCount = 0;
  /** How many of those are selected (kept up to date, so select-all is O(1)). */
  let selectedEnabled = 0;
  let selectAll: SelectAllState = 'none';
  let singleMode = initialSingleMode;
  /** The one selected row of single mode (see `isSelected`); `undefined`: not computed yet. */
  let singleId: string | null | undefined;
  const rowListeners = new Set<() => void>();
  const selectAllListeners = new Set<() => void>();

  const notify = (listeners: Set<() => void>) => {
    for (const listener of Array.from(listeners)) listener();
  };

  /** Computed on read: O(selected ids) once per change, and only in single mode. */
  const getSingleId = (): string | null => {
    if (singleId !== undefined) return singleId;
    let first: string | null = null;
    for (const rowId of selected) {
      if (registered.has(rowId)) {
        first = rowId;
        break;
      }
      first ??= rowId;
    }
    singleId = first;
    return first;
  };

  /**
   * A row id registered or unregistered. With several selected ids, the one selected row of
   * single mode can move: in single mode it is re-checked and the rows are notified if it moved.
   */
  const onRegistrationChange = (rowId: string) => {
    if (selected.size < 2 || !selected.has(rowId)) return;
    const previous = singleId;
    singleId = undefined;
    if (singleMode && getSingleId() !== previous) notify(rowListeners);
  };

  const updateSelectAll = () => {
    const next: SelectAllState =
      selectedEnabled === 0 ? 'none' : selectedEnabled === enabledCount ? 'all' : 'some';
    if (next === selectAll) return;
    selectAll = next;
    notify(selectAllListeners);
  };

  const isEnabled = (rowId: string) => registered.has(rowId) && !disabled.has(rowId);

  /**
   * Runs `change` (a registration or a `disable` of `rowId`) and keeps the counts of select-all in
   * step with whether the row is enabled before and after it.
   */
  const changeRow = (rowId: string, change: () => void) => {
    const wasEnabled = isEnabled(rowId);
    change();
    const nowEnabled = isEnabled(rowId);
    if (wasEnabled === nowEnabled) return;
    const step = nowEnabled ? 1 : -1;
    enabledCount += step;
    if (selected.has(rowId)) selectedEnabled += step;
  };

  /** Adds `step` to the count of `rowId` in `counts`, deleting it at zero. */
  const count = (counts: Map<string, number>, rowId: string, step: 1 | -1) => {
    const next = (counts.get(rowId) ?? 0) + step;
    if (next > 0) counts.set(rowId, next);
    else counts.delete(rowId);
  };

  const subscribeTo = (listeners: Set<() => void>) => (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    subscribe: subscribeTo(rowListeners),
    subscribeSelectAll: subscribeTo(selectAllListeners),
    register(rowId) {
      const first = !registered.has(rowId);
      changeRow(rowId, () => count(registered, rowId, 1));
      updateSelectAll();
      if (first) onRegistrationChange(rowId);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        changeRow(rowId, () => count(registered, rowId, -1));
        if (registered.has(rowId)) return;
        updateSelectAll();
        onRegistrationChange(rowId);
      };
    },
    disable(rowId) {
      changeRow(rowId, () => count(disabled, rowId, 1));
      updateSelectAll();
      let done = false;
      return () => {
        if (done) return;
        done = true;
        changeRow(rowId, () => count(disabled, rowId, -1));
        updateSelectAll();
      };
    },
    isDisabled(rowId) {
      return disabled.has(rowId);
    },
    setSelected(items) {
      const next = new Set(items);
      if (next.size === selected.size && items.every((item) => selected.has(item))) return;
      selected = next;
      singleId = undefined;
      selectedEnabled = 0;
      for (const rowId of next) if (isEnabled(rowId)) selectedEnabled += 1;
      notify(rowListeners);
      updateSelectAll();
    },
    setSingleMode(single) {
      singleMode = single;
    },
    isSelected(rowId, single = false) {
      return single ? getSingleId() === rowId : selected.has(rowId);
    },
    countRegistrations(rowId) {
      return registered.get(rowId) ?? 0;
    },
    getSelectAllState() {
      return selectAll;
    },
    getRegistered() {
      return Array.from(registered.keys());
    },
    prune(items) {
      return items.filter((item) => registered.has(item));
    },
  };
}

// ---------------------------------------------------------------------------
// Header selection slots
// ---------------------------------------------------------------------------

/**
 * The selection column's header slots of one `DataGrid.Header`, one per header row. Only the first
 * slot in document order renders the "Select all rows" control (the "Selection" text in single
 * mode); the others render an empty cell, so a grouped header (several header rows) has one control
 * and every header row keeps the selection column.
 */
interface HeaderSlotRegistry {
  subscribe(listener: () => void): () => void;
  /** Registers a slot and a getter for its current cell; returns the unregister function. */
  register(slot: object, getCell: () => Element | null): () => void;
  /** The first slot in document order, or `null` while no slot is registered. */
  getFirst(): object | null;
  /** Re-checks the order: header rows can move without a slot mounting or unmounting. */
  refresh(): void;
}

function createHeaderSlotRegistry(): HeaderSlotRegistry {
  const slots = new Map<object, () => Element | null>();
  const listeners = new Set<() => void>();
  let first: object | null = null;

  const update = () => {
    let next: object | null = null;
    let nextCell: Element | null = null;
    for (const [slot, getCell] of slots) {
      const cell = getCell();
      if (!cell) {
        // A slot whose cell is being replaced (control <-> empty cell): keep the current order
        // until the next registration or header commit sees every cell again.
        if (first !== null && slots.has(first)) return;
        continue;
      }
      if (!nextCell || cell.compareDocumentPosition(nextCell) & Node.DOCUMENT_POSITION_FOLLOWING) {
        next = slot;
        nextCell = cell;
      }
    }
    if (next === null) next = slots.keys().next().value ?? null;
    if (next === first) return;
    first = next;
    for (const listener of Array.from(listeners)) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(slot, getCell) {
      slots.set(slot, getCell);
      update();
      return () => {
        slots.delete(slot);
        update();
      };
    },
    getFirst: () => first,
    refresh: update,
  };
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

interface DataGridContextValue {
  selectionMode: 'none' | SelectionMode;
  store: SelectionStore;
  /** Toggles one row (single mode: selects it alone, or clears it); `event` goes to `details`. */
  toggleRow: (rowId: string, event: Event) => void;
  /** Selects every rendered row, or clears the selection when all are selected. */
  toggleAll: (event: Event) => void;
  /** Shared `name` of the single-mode radios (they are kept out of any form with `form=""`). */
  radioName: string;
  /** Name of the select-all checkbox (multiple mode). */
  selectAllLabel: string;
  /** Hidden header text of the selection column (single mode). */
  selectionHeaderLabel: string;
  /** `selectOnRowClick` of the grid. */
  selectOnRowClick: boolean;
  /** `selectionAppearance` of the grid. */
  selectionAppearance: DataGridSelectionAppearance;
  /** `subtleSelection` of the grid. */
  subtleSelection: boolean;
}

/** What a row tells its selection cell, the automatic one or a `DataGrid.SelectionCell` child. */
interface DataGridRowContextValue {
  /** The row's `selectionCellProps`. */
  selectionCellProps: DataGridRowSelectionCellProps | undefined;
  /** Whether a `DataGrid.SelectionCell` child was seen (then the row adds no cell of its own). */
  hasSelectionCell: boolean;
  /** The row's id; `undefined` for a header row, or a body row without one (no control). */
  rowId: string | undefined;
  isSelected: boolean;
  /** Resolved from the cell's own props and `selectionCellProps`. */
  disabled: boolean;
  /** Resolved from the cell's own props and `selectionCellProps`. */
  invisible: boolean;
  /** The control's `aria-label`. */
  ariaLabel: string | undefined;
  /** The control's `aria-labelledby`. */
  ariaLabelledBy: string | undefined;
}

interface DataGridSortContextValue {
  sort: DataGridSort | null;
  /** Sorts by the column (toggling its direction); `event` goes to `details`. */
  requestSort: (columnId: string, event: Event) => void;
}

type DataGridSection = 'header' | 'body';

const DataGridContext = React.createContext<DataGridContextValue | null>(null);
const DataGridSortContext = React.createContext<DataGridSortContextValue | null>(null);
/** Whether a row is rendered in the header or the body (rows in a header get a header cell). */
const DataGridSectionContext = React.createContext<DataGridSection>('body');
/** The header's selection slots (see {@link HeaderSlotRegistry}). */
const DataGridHeaderSlotsContext = React.createContext<HeaderSlotRegistry | null>(null);
/**
 * Whether the header row below is the header's first row, as far as the header can tell from its
 * children. Only the initial (and server) render uses it; the slots then follow the DOM order.
 */
const DataGridHeaderRowHintContext = React.createContext(true);

/** Renders the row of one item of `items` (a `DataGrid.Body` render function, or from `columns`). */
type DataGridRenderRow = (item: unknown, index: number) => React.ReactNode;

/** One row of the grid's `items`. */
interface DataGridItemRowData {
  item: unknown;
  /** The item's index in `items`. */
  index: number;
  rowId: string;
  /** The row's React key: its row id, made unique when the id repeats. */
  key: string;
}

interface DataGridItemsContextValue {
  /** The rows of `items`, in the order they are rendered; `null` without `items`. */
  rows: readonly DataGridItemRowData[] | null;
  /** Renders a row from `columns`; `null` without `items` and `columns`. */
  renderColumnsRow: DataGridRenderRow | null;
}

/** The grid's `items`, for `DataGrid.Body` (optional: a body of JSX rows needs none). */
const DataGridItemsContext = React.createContext<DataGridItemsContextValue | null>(null);
/**
 * The row id of the item a body row is rendered for, the default `rowId` of `DataGrid.Row`. The
 * grid resets it, so the rows of a grid nested in a cell do not take the outer row's id.
 */
const DataGridRowIdContext = React.createContext<string | null>(null);
/** The row around a selection cell (see {@link DataGridRowContextValue}). */
const DataGridRowContext = React.createContext<DataGridRowContextValue | null>(null);

const INERT_STORE = createSelectionStore([]);
const INERT_CONTEXT: DataGridContextValue = {
  selectionMode: 'none',
  store: INERT_STORE,
  toggleRow: () => {},
  toggleAll: () => {},
  radioName: '',
  selectAllLabel: DEFAULT_SELECT_ALL_LABEL,
  selectionHeaderLabel: DEFAULT_SELECTION_HEADER_LABEL,
  selectOnRowClick: false,
  selectionAppearance: 'brand',
  subtleSelection: false,
};
const INERT_SORT_CONTEXT: DataGridSortContextValue = { sort: null, requestSort: () => {} };
const INERT_ROW_CONTEXT: DataGridRowContextValue = {
  selectionCellProps: undefined,
  hasSelectionCell: true,
  rowId: undefined,
  isSelected: false,
  disabled: false,
  invisible: false,
  ariaLabel: undefined,
  ariaLabelledBy: undefined,
};

function useDataGridContext(component: string): DataGridContextValue {
  const ctx = React.useContext(DataGridContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid');
  return INERT_CONTEXT;
}

function useDataGridRowContext(component: string): DataGridRowContextValue {
  const ctx = React.useContext(DataGridRowContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid.Row');
  return INERT_ROW_CONTEXT;
}

function useDataGridSortContext(component: string): DataGridSortContextValue {
  const ctx = React.useContext(DataGridSortContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid');
  return INERT_SORT_CONTEXT;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_ITEMS: readonly string[] = [];

function toItems(
  keys: ReadonlySet<string> | readonly string[] | undefined,
): readonly string[] | undefined {
  return keys === undefined ? undefined : Array.from(keys);
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** A child of {@link flattenChildren} under its flattened key (unique across the flattened list). */
function renderFlatChild({ key, node }: { key: string; node: React.ReactNode }): React.ReactNode {
  return <React.Fragment key={key}>{node}</React.Fragment>;
}

/** A column's id: `columnId`, else the deprecated `id` (warned once). */
function columnIdOf<T>(column: DataGridColumn<T>): string | undefined {
  return resolveDeprecatedProp(
    'DataGrid',
    column.columnId,
    column.id,
    'columns[].id',
    'columns[].columnId',
  );
}

function warnDuplicateRowId(rowId: string): void {
  warnOnce(
    `DataGrid:duplicate-rowId:${rowId}`,
    `DataGrid: several rows share the rowId "${rowId}". Row ids must be unique within a ` +
      'DataGrid; rows with the same rowId are selected and deselected together.',
  );
}

const cellBase = 'px-4 py-3 border-b border-border';

/** A body row: its hover and, per `selectionAppearance`, the fill of a selected row. */
const BODY_ROW_CLASSES: Record<DataGridSelectionAppearance, string> = {
  brand:
    'hover:bg-subtle-hover data-[selected]:bg-selected transition-colors motion-reduce:transition-none',
  neutral:
    'hover:bg-subtle-hover data-[selected]:bg-subtle-selected transition-colors motion-reduce:transition-none',
  none: 'hover:bg-subtle-hover transition-colors motion-reduce:transition-none',
};

/** Whether `node` is an element of `DataGrid.SelectionCell` (lazy client references too). */
function isSelectionCellElement(
  node: React.ReactNode,
): node is React.ReactElement<DataGridSelectionCellProps> {
  return getTablePartKind(node) === 'dataGridSelectionCell';
}

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------

// The component-level JSDoc sits on the exported `DataGrid` below.
//
// Two call signatures. The first takes only a grid with `items` (`DataGridItemsSortProps`), so an
// inline `onSortChange={(sort, details) => …}` next to `items` has one contextual type: in the
// union of the second, `items` cannot tell the members apart while `T` is still being inferred
// from it. Every other grid, a generic wrapper's `DataGridProps<T>` included, takes the second.
function DataGridRoot<T>(
  props: DataGridBaseProps<T> & DataGridItemsSortProps<T>,
): React.JSX.Element;
function DataGridRoot<T = unknown>(props: DataGridProps<T>): React.JSX.Element;
function DataGridRoot<T>(props: DataGridProps<T>) {
  const {
    items,
    getRowId,
    sort: sortProp,
    defaultSort,
    sortColumn: sortColumnProp,
    defaultSortColumn,
    sortDirection: sortDirectionProp,
    defaultSortDirection,
    onSortChange,
    selectionMode = 'none',
    selectedItems: selectedItemsProp,
    defaultSelectedItems,
    onSelectedItemsChange,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    labels,
    selectOnRowClick = false,
    selectionAppearance = 'brand',
    subtleSelection = false,
    columns,
    containerProps,
    children,
    className,
    onKeyDown,
    onFocus,
    onBlur,
    ref,
    ...rest
  } = props;

  // --- sort -----------------------------------------------------------------
  const hasItems = items !== undefined;
  /** The 0.5 sort props, which win over the deprecated ones. */
  const usesSortApi = sortProp !== undefined || defaultSort !== undefined;
  /**
   * The 0.4 rules (the deprecated sort props, the positional callback) apply without `items`,
   * `sort` and `defaultSort`.
   */
  const legacySort = !usesSortApi && !hasItems;
  /** `onSortChange(sort, details)`; sticky, so the form never changes under the consumer. */
  const [objectMode, setObjectMode] = React.useState(!legacySort);
  if (!legacySort && !objectMode) setObjectMode(true);
  const objectCallbacks = objectMode || !legacySort;

  const legacySortControlled = sortColumnProp !== undefined || sortDirectionProp !== undefined;
  if (sortColumnProp !== undefined) warnDeprecated('DataGrid', 'sortColumn', 'sort');
  if (sortDirectionProp !== undefined) warnDeprecated('DataGrid', 'sortDirection', 'sort');
  if (defaultSortColumn !== undefined) {
    warnDeprecated('DataGrid', 'defaultSortColumn', 'defaultSort');
  }
  if (defaultSortDirection !== undefined) {
    warnDeprecated('DataGrid', 'defaultSortDirection', 'defaultSort');
  }
  const deprecatedSortProps =
    legacySortControlled || defaultSortColumn !== undefined || defaultSortDirection !== undefined;
  const mixedSortApi = usesSortApi && deprecatedSortProps;
  /** A grid with `items` (and no `sort`/`defaultSort`) ignores the deprecated sort props. */
  const ignoredSortProps = !legacySort && !usesSortApi && deprecatedSortProps;

  React.useEffect(() => {
    if (mixedSortApi) {
      warnOnce(
        'DataGrid:mixed-sort',
        'DataGrid: do not mix `sort`/`defaultSort` with the deprecated `sortColumn`/`sortDirection`/' +
          '`defaultSortColumn`/`defaultSortDirection`. `sort`/`defaultSort` win.',
      );
    } else if (ignoredSortProps) {
      warnOnce(
        'DataGrid:items-deprecated-sort',
        'DataGrid: the deprecated `sortColumn`/`sortDirection`/`defaultSortColumn`/' +
          '`defaultSortDirection` do not apply to a grid with `items` and are ignored. Pass `sort` ' +
          'or `defaultSort`.',
      );
    }
  }, [mixedSortApi, ignoredSortProps]);
  // 0.4 mixed control: `sortColumn` and `sortDirection` are controlled independently. The half the
  // parent does not control is kept here (seeded from its default) and follows every sort request,
  // as 0.4 did, so repeated clicks still alternate and aria-sort shows what was reported.
  React.useEffect(() => {
    if (!legacySort) return;
    if (sortColumnProp !== undefined && sortDirectionProp === undefined) {
      warnOnce(
        'DataGrid:sortColumn-without-sortDirection',
        'DataGrid: `sortColumn` is controlled but `sortDirection` is not (mixed control). The ' +
          'direction is kept internally and toggles on repeated clicks, as in 0.4. Pass `sort` ' +
          '(`{ columnId, direction }`) to control both.',
      );
    } else if (sortDirectionProp !== undefined && sortColumnProp === undefined) {
      warnOnce(
        'DataGrid:sortDirection-without-sortColumn',
        'DataGrid: `sortDirection` is controlled but `sortColumn` is not (mixed control). The ' +
          'column is kept internally and follows the clicked header, as in 0.4. Pass `sort` ' +
          '(`{ columnId, direction }`) to control both.',
      );
    }
  }, [legacySort, sortColumnProp, sortDirectionProp]);

  /** The uncontrolled halves of the 0.4 sort props (used while the other half is controlled). */
  const [legacyHalves, setLegacyHalves] = React.useState<{
    column: string;
    direction: SortDirection;
  }>(() => ({
    column: defaultSortColumn ?? '',
    direction: defaultSortDirection ?? 'ascending',
  }));

  const legacyControlledSort = React.useMemo<DataGridSort | null | undefined>(() => {
    if (sortColumnProp === undefined && sortDirectionProp === undefined) return undefined;
    const column = sortColumnProp ?? legacyHalves.column;
    return column === ''
      ? null
      : { columnId: column, direction: sortDirectionProp ?? legacyHalves.direction };
  }, [sortColumnProp, sortDirectionProp, legacyHalves]);

  const legacyDefaultSort = React.useMemo<DataGridSort | null>(
    () =>
      defaultSortColumn
        ? { columnId: defaultSortColumn, direction: defaultSortDirection ?? 'ascending' }
        : null,
    [defaultSortColumn, defaultSortDirection],
  );

  const controlledSort = legacySort ? legacyControlledSort : sortProp;
  // A grid with `items` and no `defaultSort` starts unsorted: the deprecated defaults are ignored.
  let initialSort = legacyDefaultSort;
  if (defaultSort !== undefined) initialSort = defaultSort;
  else if (ignoredSortProps) initialSort = null;

  // The details of the sort being requested, set around the setter: useControllable calls its
  // onChange synchronously inside it, and only on change (the useCheckedValues pattern).
  const sortDetailsRef = React.useRef<DataGridSortChangeDetails | undefined>(undefined);

  const emitSortChange = (next: DataGridSort | null) => {
    if (!next) return;
    if (legacySort) {
      setLegacyHalves((previous) =>
        previous.column === next.columnId && previous.direction === next.direction
          ? previous
          : { column: next.columnId, direction: next.direction },
      );
    }
    if (!onSortChange) return;
    if (objectCallbacks) {
      const objectForm = onSortChange as NonNullable<DataGridItemsSortProps['onSortChange']>;
      objectForm(next, sortDetailsRef.current);
    } else {
      const legacy = onSortChange as (columnId: string, direction: SortDirection) => void;
      legacy(next.columnId, next.direction);
    }
  };

  const [sort, setSort] = useControllable<DataGridSort | null>(
    controlledSort,
    initialSort,
    emitSortChange,
  );

  const requestSort = React.useCallback(
    (columnId: string, event: Event) => {
      sortDetailsRef.current = { event };
      try {
        setSort((previous) => ({
          columnId,
          direction:
            previous?.columnId === columnId && previous.direction === 'ascending'
              ? 'descending'
              : 'ascending',
        }));
      } finally {
        sortDetailsRef.current = undefined;
      }
    },
    [setSort],
  );

  const sortContext = React.useMemo<DataGridSortContextValue>(
    () => ({ sort, requestSort }),
    [sort, requestSort],
  );

  // --- selection ------------------------------------------------------------
  if (onSelectionChange !== undefined) {
    warnDeprecated('DataGrid', 'onSelectionChange', 'onSelectedItemsChange');
  }
  const legacySelected = React.useMemo(() => toItems(selectedKeys), [selectedKeys]);
  const legacyDefaultSelected = React.useMemo(
    () => toItems(defaultSelectedKeys),
    [defaultSelectedKeys],
  );
  const controlledSelected = resolveDeprecatedProp(
    'DataGrid',
    selectedItemsProp,
    legacySelected,
    'selectedKeys',
    'selectedItems',
  );
  const defaultSelected =
    resolveDeprecatedProp(
      'DataGrid',
      defaultSelectedItems,
      legacyDefaultSelected,
      'defaultSelectedKeys',
      'defaultSelectedItems',
    ) ?? EMPTY_ITEMS;

  // The details of the change being made, set around the setter (as `sortDetailsRef`).
  const selectionDetailsRef = React.useRef<DataGridSelectedItemsChangeDetails | undefined>(
    undefined,
  );

  const emitSelectionChange = (next: readonly string[]) => {
    onSelectedItemsChange?.([...next], selectionDetailsRef.current);
    onSelectionChange?.(new Set(next));
  };

  const [selected, setSelectedValue] = useControllable<readonly string[]>(
    controlledSelected,
    defaultSelected,
    emitSelectionChange,
  );

  const setSelected = React.useCallback(
    (event: Event, update: (previous: readonly string[]) => readonly string[]) => {
      selectionDetailsRef.current = { event };
      try {
        setSelectedValue(update);
      } finally {
        selectionDetailsRef.current = undefined;
      }
    },
    [setSelectedValue],
  );

  const single = selectionMode === 'single';
  const [store] = React.useState(() => createSelectionStore(selected, single));
  React.useLayoutEffect(() => {
    store.setSelected(selected);
  }, [store, selected]);
  React.useLayoutEffect(() => {
    store.setSingleMode(single);
  }, [store, single]);

  const toggleRow = React.useCallback(
    (rowId: string, event: Event) => {
      setSelected(event, (previous) => {
        const effective = store.prune(previous);
        let next: string[];
        if (single) {
          // Single mode shows the first selected row that is rendered (see the store).
          next = effective[0] === rowId ? [] : [rowId];
        } else {
          next = effective.includes(rowId)
            ? effective.filter((item) => item !== rowId)
            : [...effective, rowId];
        }
        return sameItems(next, previous) ? previous : next;
      });
    },
    [single, setSelected, store],
  );

  const selectedCount = selected.length;
  React.useEffect(() => {
    if (single && selectedCount > 1) {
      warnOnce(
        'DataGrid:single-several-selected',
        `DataGrid: a single-selection grid (selectionMode "single") has ${selectedCount} selected row ids; only the first one that is rendered is selected. Pass at most one id in \`selectedItems\`/\`defaultSelectedItems\`, or use selectionMode="multiple".`,
      );
    }
  }, [single, selectedCount]);

  // Rows whose selection is disabled keep their state: select-all selects (or clears) the others.
  const toggleAll = React.useCallback(
    (event: Event) => {
      setSelected(event, (previous) => {
        const effective = new Set(store.prune(previous));
        const all = store.getRegistered();
        const enabled = all.filter((rowId) => !store.isDisabled(rowId));
        const allSelected = enabled.length > 0 && enabled.every((rowId) => effective.has(rowId));
        const next = allSelected
          ? all.filter((rowId) => store.isDisabled(rowId) && effective.has(rowId))
          : all.filter((rowId) => !store.isDisabled(rowId) || effective.has(rowId));
        return sameItems(next, previous) ? previous : next;
      });
    },
    [setSelected, store],
  );

  const radioName = useId('wave-datagrid-selection');
  const selectAllLabel = labels?.selectAll ?? DEFAULT_SELECT_ALL_LABEL;
  const selectionHeaderLabel = labels?.selectionHeader ?? DEFAULT_SELECTION_HEADER_LABEL;

  const context = React.useMemo<DataGridContextValue>(
    () => ({
      selectionMode,
      store,
      toggleRow,
      toggleAll,
      radioName,
      selectAllLabel,
      selectionHeaderLabel,
      selectOnRowClick,
      selectionAppearance,
      subtleSelection,
    }),
    [
      selectionMode,
      store,
      toggleRow,
      toggleAll,
      radioName,
      selectAllLabel,
      selectionHeaderLabel,
      selectOnRowClick,
      selectionAppearance,
      subtleSelection,
    ],
  );

  // --- keyboard -------------------------------------------------------------
  const { gridRef, gridProps } = useGridNavigation();
  const mergedRef = useMergedRefs<HTMLTableElement>(ref, gridRef);

  // --- items ------------------------------------------------------------------
  const itemRows = React.useMemo<readonly DataGridItemRowData[] | null>(() => {
    if (items === undefined) return null;
    const keys = new Set<string>();
    return items.map((item, index) => {
      const rowId = getRowId ? getRowId(item) : String(index);
      // A repeated id (the selection store warns about it) still gets a key of its own.
      const key = keys.has(rowId) ? `${rowId}\u0000${index}` : rowId;
      keys.add(key);
      return { item, index, rowId, key };
    });
  }, [items, getRowId]);

  // Built-in sorting: by the `compare` of the sorted column (controlled `sort` included).
  const sortColumnId = sort?.columnId;
  const sortDirection = sort?.direction;
  const sortCompare = React.useMemo(() => {
    if (!hasItems || sortColumnId === undefined || !columns) return undefined;
    return columns.find((column) => columnIdOf(column) === sortColumnId)?.compare;
  }, [hasItems, sortColumnId, columns]);

  const sortedRows = React.useMemo(() => {
    if (itemRows === null || !sortCompare) return itemRows;
    // The rows hold the items as `unknown`; `compare` takes the grid's `T`.
    const compare = sortCompare as (a: unknown, b: unknown) => number;
    // A stable sort of a copy (never in place, never reversed): items that compare equal keep
    // their order in `items` in both directions, since descending negates `compare`.
    return itemRows
      .slice()
      .sort(
        sortDirection === 'descending'
          ? (a, b) => -compare(a.item, b.item)
          : (a, b) => compare(a.item, b.item),
      );
  }, [itemRows, sortCompare, sortDirection]);

  // Built only with `items`: the column ids are read (and the deprecated `id` warned) when used.
  const renderColumnsRow = React.useMemo<DataGridRenderRow | null>(() => {
    if (!columns || !hasItems) return null;
    const cellKeys = columns.map((column, index) => columnIdOf(column) ?? index);
    return (item) => (
      <DataGridRow>
        {columns.map((column, index) => (
          <DataGridCell key={cellKeys[index]}>{column.renderCell?.(item as T)}</DataGridCell>
        ))}
      </DataGridRow>
    );
  }, [columns, hasItems]);

  const itemsContext = React.useMemo<DataGridItemsContextValue>(
    () => ({ rows: sortedRows, renderColumnsRow }),
    [sortedRows, renderColumnsRow],
  );

  const columnWithoutId =
    columns?.some((column) => column.columnId === undefined && column.id === undefined) ?? false;
  React.useEffect(() => {
    if (columnWithoutId) {
      warnOnce(
        'DataGrid:column-without-columnId',
        'DataGrid: a column in `columns` has no `columnId` (nor the deprecated `id`), so its ' +
          'header cannot sort. Give every column a unique `columnId`.',
      );
    }
  }, [columnWithoutId]);

  // --- header and body from columns -------------------------------------------
  let content: React.ReactNode = children;
  const flatChildren = columns ? flattenChildren(children) : [];
  const hasChild = (part: unknown) => flatChildren.some(({ node }) => isElementOfType(node, part));
  const generatedHeader =
    columns && !hasChild(DataGridHeader) ? (
      <DataGridHeader key="wave-generated-header">
        <tr>
          {columns.map((column, index) => {
            const columnId = columnIdOf(column);
            return (
              <DataGridHeaderCell
                key={columnId ?? index}
                columnId={columnId}
                sortable={column.sortable ?? column.compare !== undefined}
              >
                {column.renderHeaderCell ? column.renderHeaderCell() : column.label}
              </DataGridHeaderCell>
            );
          })}
        </tr>
      </DataGridHeader>
    ) : null;
  // Without children, the body renders the rows from `columns` (see DataGrid.Body).
  const generatedBody =
    columns && hasItems && !hasChild(DataGridBody) ? (
      <DataGridBody key="wave-generated-body" />
    ) : null;
  if (generatedHeader || generatedBody) {
    // A `<caption>` stays the table's first child, before the generated header; a generated body
    // goes before a `<tfoot>`, which ends the table.
    const isCaption = ({ node }: { node: React.ReactNode }) => isElementOfType(node, 'caption');
    const others = flatChildren.filter((child) => !isCaption(child));
    const footerIndex = generatedBody
      ? others.findIndex(({ node }) => isElementOfType(node, 'tfoot'))
      : -1;
    const bodyIndex = footerIndex >= 0 ? footerIndex : others.length;
    content = [
      ...flatChildren.filter(isCaption).map(renderFlatChild),
      generatedHeader,
      ...others.slice(0, bodyIndex).map(renderFlatChild),
      generatedBody,
      ...others.slice(bodyIndex).map(renderFlatChild),
    ];
  }

  const {
    className: containerClassName,
    'aria-label': containerLabel,
    'aria-labelledby': containerLabelledBy,
    ...containerRest
  } = containerProps ?? {};
  // The wrapper has no role of its own, and a name is prohibited on a role-less `<div>`: the
  // consumer's name is kept only together with a role.
  const containerHasRole = containerRest.role !== undefined;
  const droppedContainerName =
    !containerHasRole && (containerLabel !== undefined || containerLabelledBy !== undefined);

  React.useEffect(() => {
    if (droppedContainerName) {
      warnOnce(
        'DataGrid:container-name-without-role',
        'DataGrid: `containerProps["aria-label"]`/`["aria-labelledby"]` is ignored because the ' +
          'wrapper has no role. Name the grid itself (`aria-label` on DataGrid), or pass a ' +
          '`role` (e.g. "region") in `containerProps` too.',
      );
    }
  }, [droppedContainerName]);

  return (
    <DataGridContext.Provider value={context}>
      <DataGridSortContext.Provider value={sortContext}>
        <DataGridItemsContext.Provider value={itemsContext}>
          {/* Reset for a grid nested in a cell: its rows are not the outer row. */}
          <DataGridRowContext.Provider value={null}>
            <DataGridRowIdContext.Provider value={null}>
              <div
                {...containerRest}
                aria-label={containerHasRole ? containerLabel : undefined}
                aria-labelledby={containerHasRole ? containerLabelledBy : undefined}
                className={cn(
                  dataGridClassNames.container,
                  'overflow-x-auto rounded-md border border-border',
                  containerClassName,
                )}
              >
                <table
                  ref={mergedRef}
                  role="grid"
                  aria-multiselectable={selectionMode === 'multiple' || undefined}
                  data-selection-appearance={selectionAppearance}
                  data-subtle-selection={subtleSelection ? '' : undefined}
                  className={cn(
                    dataGridClassNames.root,
                    'w-full border-separate border-spacing-0',
                    // The group whose hover or focus draws the subtle select-all checkbox.
                    subtleSelection && 'group/grid',
                    className,
                  )}
                  {...rest}
                  onKeyDown={composeEventHandlers(onKeyDown, gridProps.onKeyDown)}
                  onFocus={composeEventHandlers(onFocus, gridProps.onFocus, {
                    checkDefaultPrevented: false,
                  })}
                  onBlur={composeEventHandlers(onBlur, gridProps.onBlur, {
                    checkDefaultPrevented: false,
                  })}
                >
                  {content}
                </table>
              </div>
            </DataGridRowIdContext.Provider>
          </DataGridRowContext.Provider>
        </DataGridItemsContext.Provider>
      </DataGridSortContext.Provider>
    </DataGridContext.Provider>
  );
}
DataGridRoot.displayName = 'DataGrid';

// ---------------------------------------------------------------------------
// Selection header cell (internal)
// ---------------------------------------------------------------------------

/**
 * The props of a header row's selection cell: the row's `selectionCellProps`, merged with a
 * `DataGrid.SelectionCell`'s own (whose `ref` is passed as `cellRef`).
 */
type HeaderSelectionCellProps = Omit<DataGridSelectionCellProps, 'ref'>;

interface DataGridSelectionHeaderCellProps {
  selectionMode: SelectionMode;
  /** The root class of `DataGrid.SelectionCell`, when the cell is one. */
  stableClassName?: string;
  cellProps?: HeaderSelectionCellProps;
  ref?: React.Ref<HTMLTableCellElement>;
}

function DataGridSelectionHeaderCell({
  selectionMode,
  stableClassName,
  cellProps,
  ref,
}: DataGridSelectionHeaderCellProps) {
  const { store, toggleAll, selectAllLabel, selectionHeaderLabel, subtleSelection } =
    useDataGridContext('DataGrid.Header');
  const state = React.useSyncExternalStore(
    store.subscribeSelectAll,
    store.getSelectAllState,
    store.getSelectAllState,
  );
  const {
    className,
    disabled,
    invisible,
    controlRef,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...rest
  } = cellProps ?? {};

  let checked: boolean | 'mixed' = false;
  if (state === 'all') checked = true;
  else if (state === 'some') checked = 'mixed';

  return (
    <th
      scope="col"
      {...rest}
      ref={ref}
      data-selection-cell=""
      className={cn(
        stableClassName,
        dataGridHeaderClassNames.selectionCell,
        SELECTION_CELL_CLASSES,
        'text-start',
        focusRingInset,
        className,
      )}
    >
      {selectionMode === 'multiple' ? (
        <TableSelectionControl
          ref={controlRef}
          type="checkbox"
          aria-label={ariaLabel ?? (ariaLabelledBy === undefined ? selectAllLabel : undefined)}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          checked={checked}
          disabled={disabled}
          invisible={invisible}
          subtle={subtleSelection}
          reveal="grid"
          onChange={(event) => toggleAll(event.nativeEvent)}
          className={dataGridHeaderClassNames.selectAllCheckbox}
        />
      ) : (
        <span className="sr-only">{selectionHeaderLabel}</span>
      )}
    </th>
  );
}

const INERT_HEADER_SLOTS: HeaderSlotRegistry = {
  subscribe: () => () => {},
  register: () => () => {},
  getFirst: () => null,
  refresh: () => {},
};

/**
 * The selection column's cell of one header row: the select-all header cell in the header's first
 * row (document order), an empty cell in every later row. `initialFirst` is the header's guess from
 * its children, used until the slots are registered (the initial and the server render).
 */
function DataGridSelectionHeaderSlot({
  selectionMode,
  initialFirst,
  stableClassName,
  cellProps,
  ref,
}: DataGridSelectionHeaderCellProps & { initialFirst: boolean }) {
  const slots = React.useContext(DataGridHeaderSlotsContext) ?? INERT_HEADER_SLOTS;
  const [slot] = React.useState(() => ({}));
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);
  const mergedRef = useMergedRefs<HTMLTableCellElement>(cellRef, ref);

  const getIsFirst = React.useCallback(() => {
    const first = slots.getFirst();
    return first === null ? initialFirst : first === slot;
  }, [slots, slot, initialFirst]);
  const getServerIsFirst = React.useCallback(() => initialFirst, [initialFirst]);
  const isFirst = React.useSyncExternalStore(slots.subscribe, getIsFirst, getServerIsFirst);

  React.useLayoutEffect(() => slots.register(slot, () => cellRef.current), [slots, slot]);

  if (isFirst) {
    return (
      <DataGridSelectionHeaderCell
        ref={mergedRef}
        selectionMode={selectionMode}
        stableClassName={stableClassName}
        cellProps={cellProps}
      />
    );
  }
  // A later header row's cell: none of the control's props apply.
  const {
    className,
    disabled: _disabled,
    invisible: _invisible,
    controlRef: _controlRef,
    'aria-label': _ariaLabel,
    'aria-labelledby': _ariaLabelledBy,
    'aria-describedby': _ariaDescribedBy,
    ...rest
  } = cellProps ?? {};
  return (
    <td
      {...rest}
      ref={mergedRef}
      data-selection-cell=""
      className={cn(
        stableClassName,
        dataGridHeaderClassNames.selectionCell,
        SELECTION_CELL_CLASSES,
        focusRingInset,
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Prepends the selection column's header slot (or `null`) to every `<tr>` in `children`, looking
 * inside Fragments, unless the row holds a `DataGrid.SelectionCell` (that cell is the slot), and
 * tells every row whether it is the header's first row: the cells of a `<tr>` and every other
 * element child (a `DataGrid.Row`, or a component that renders one). Every row gets the same child
 * shape in every selection mode, so switching `selectionMode` does not remount the header cells.
 */
function withSelectionHeaderSlots(
  children: React.ReactNode,
  selectionMode: 'none' | SelectionMode,
): React.ReactNode {
  let first = true;
  const visit = (nodes: React.ReactNode): React.ReactNode =>
    React.Children.map(nodes, (child) => {
      if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
        return React.cloneElement(child, undefined, visit(child.props.children));
      }
      if (!React.isValidElement(child)) return child;
      const isFirst = first;
      first = false;
      if (isElementOfType<{ children?: React.ReactNode }>(child, 'tr')) {
        const cells = child.props.children;
        const slot =
          selectionMode === 'none' ||
          flattenChildren(cells).some(({ node }) => isSelectionCellElement(node)) ? null : (
            <DataGridSelectionHeaderSlot selectionMode={selectionMode} initialFirst={isFirst} />
          );
        return React.cloneElement(
          child,
          undefined,
          slot,
          <DataGridHeaderRowHintContext.Provider value={isFirst}>
            {cells}
          </DataGridHeaderRowHintContext.Provider>,
        );
      }
      return (
        <DataGridHeaderRowHintContext.Provider value={isFirst}>
          {child}
        </DataGridHeaderRowHintContext.Provider>
      );
    });
  return visit(children);
}

/**
 * The grid's `<thead>`. When the grid is selectable, it prepends the selection column's header
 * cell to each `<tr>` child, also inside a Fragment, unless the row holds a
 * `DataGrid.SelectionCell`: the first header row gets the "Select all rows" checkbox (multiple
 * mode) or the "Selection" header (single mode; DataGrid's `labels` localizes both), later rows of
 * a grouped header an empty cell. A header row rendered by another component cannot get it (a
 * development warning says so): use `DataGrid.Row` for such a row, which adds the cell itself.
 */
const DataGridHeader = ({ children, className, ref, ...rest }: DataGridHeaderProps) => {
  const { selectionMode } = useDataGridContext('DataGrid.Header');
  const [thead, setThead] = React.useState<HTMLTableSectionElement | null>(null);
  const mergedRef = useMergedRefs<HTMLTableSectionElement>(ref, setThead);
  const [slots] = React.useState(createHeaderSlotRegistry);
  const content = withSelectionHeaderSlots(children, selectionMode);

  // Every commit, after the rows' slots registered: header rows can move without a slot mounting.
  React.useLayoutEffect(() => {
    slots.refresh();
  });

  // Every commit: header rows can come from components the header cannot see into.
  React.useEffect(() => {
    if (!isDev || !thead || selectionMode === 'none') return;
    const selectionCells = Array.from(thead.rows, (row) =>
      Array.from(row.cells).filter((cell) => cell.hasAttribute('data-selection-cell')),
    );
    if (
      selectionCells.some(
        (cells, index) => cells.length === 0 && thead.rows[index].cells.length > 0,
      )
    ) {
      warnOnce(
        'DataGrid.Header:missing-selection-cell',
        'DataGrid.Header: a header row has no selection column header cell, so the header has one ' +
          'column fewer than the selectable rows. Render header rows as `<tr>` children of ' +
          'DataGrid.Header (a Fragment is fine), or use `DataGrid.Row` for a header row that ' +
          'another component renders.',
      );
    }
    if (selectionCells.some((cells) => cells.length > 1)) {
      warnOnce(
        'DataGrid.Header:several-selection-cells',
        'DataGrid.Header: a header row has more than one selection cell. A DataGrid.SelectionCell ' +
          'rendered by another component is not seen, so the row also gets the automatic cell: ' +
          'render DataGrid.SelectionCell as a child of the row (a Fragment is fine).',
      );
    }
  });

  return (
    <DataGridSectionContext.Provider value="header">
      <DataGridHeaderSlotsContext.Provider value={slots}>
        <thead
          ref={mergedRef}
          className={cn(dataGridHeaderClassNames.root, 'bg-card', className)}
          {...rest}
        >
          {content}
        </thead>
      </DataGridHeaderSlotsContext.Provider>
    </DataGridSectionContext.Provider>
  );
};
DataGridHeader.displayName = 'DataGridHeader';

/**
 * A column header cell. A `sortable` header (with a `columnId`) renders its content inside a
 * `<button type="button">` that toggles the sort, followed by the direction glyph (`sortIcon`)
 * while its column is sorted; the `<th>` carries `aria-sort`. A consumer `onClick` (on the `<th>`)
 * runs before the sort, and calling `preventDefault()` in it cancels the sort (also for
 * Enter/Space on the button, which click it).
 */
const DataGridHeaderCell = ({
  columnId,
  sortable = false,
  sortIcon,
  children,
  className,
  onClick,
  ref,
  ...rest
}: DataGridHeaderCellProps) => {
  const { sort, requestSort } = useDataGridSortContext('DataGrid.HeaderCell');
  /** The column this header sorts, or `undefined` when it is not sortable. */
  const sortColumnId = sortable && columnId ? columnId : undefined;
  const sortedDirection =
    sortColumnId !== undefined && sort?.columnId === sortColumnId ? sort.direction : null;

  // The sort runs from the `<th>` once the button's click bubbled up to it, composed after the
  // consumer's `onClick` (C-COMPOSE): the consumer runs first and can cancel with preventDefault().
  // The sort button is the `<th>`'s only child; clicks elsewhere in the cell do not sort.
  const sortOnButtonClick = (event: React.MouseEvent<HTMLTableCellElement>) => {
    const button = event.currentTarget.firstElementChild;
    if (
      sortColumnId !== undefined &&
      button?.localName === 'button' &&
      button.contains(event.target as Node)
    ) {
      requestSort(sortColumnId, event.nativeEvent);
    }
  };

  React.useEffect(() => {
    if (sortable && !columnId) {
      warnOnce(
        'DataGrid.HeaderCell:sortable-without-columnId',
        'DataGrid.HeaderCell: `sortable` needs a `columnId`; the header is rendered as not sortable.',
      );
    }
  }, [sortable, columnId]);

  return (
    <th
      ref={ref}
      scope="col"
      aria-sort={sortColumnId !== undefined ? (sortedDirection ?? 'none') : undefined}
      className={cn(
        dataGridHeaderCellClassNames.root,
        cellBase,
        'text-start align-middle font-semibold text-caption-1 uppercase tracking-wider',
        focusRingInset,
        sortColumnId !== undefined && 'p-0 hover:bg-subtle-hover',
        className,
      )}
      {...rest}
      onClick={
        sortColumnId !== undefined ? composeEventHandlers(onClick, sortOnButtonClick) : onClick
      }
    >
      {sortColumnId !== undefined ? (
        <TableSortButton
          component="DataGrid.HeaderCell"
          direction={sortedDirection}
          sortIcon={sortIcon}
          className={dataGridHeaderCellClassNames.button}
          iconClassName={dataGridHeaderCellClassNames.sortIcon}
        >
          {children}
        </TableSortButton>
      ) : (
        <span className="inline-flex items-center gap-1">{children}</span>
      )}
    </th>
  );
};
DataGridHeaderCell.displayName = 'DataGridHeaderCell';

/**
 * The row of one item of `items`, under its row id. Memoised, so a grid that renders again (a
 * sort, a parent update) renders the row again only when its item, its index or the render
 * function change.
 */
const DataGridItemRow = React.memo(function DataGridItemRow({
  item,
  index,
  rowId,
  render,
}: {
  item: unknown;
  index: number;
  rowId: string;
  render: DataGridRenderRow;
}) {
  return (
    <DataGridRowIdContext.Provider value={rowId}>
      {render(item, index)}
    </DataGridRowIdContext.Provider>
  );
});

/**
 * The grid's `<tbody>`. Its child can also be a render function, called with each item of the
 * grid's `items` (and its index there) to render the item's row; without children, a grid with
 * `items` and `columns` renders the rows from the columns.
 */
const DataGridBody = <T,>({ children, className, ref, ...rest }: DataGridBodyProps<T>) => {
  const itemsContext = React.useContext(DataGridItemsContext);
  const rows = itemsContext?.rows ?? null;
  const hasRenderFunction = typeof children === 'function';

  const renderWithoutItems = hasRenderFunction && rows === null;
  React.useEffect(() => {
    if (renderWithoutItems) {
      warnOnce(
        'DataGrid.Body:render-without-items',
        "DataGrid.Body: a render function child renders one row per item of the DataGrid's " +
          '`items`, which is not set, so the body has no rows.',
      );
    }
  }, [renderWithoutItems]);

  const renderRows = (render: DataGridRenderRow | null) =>
    render &&
    rows?.map((row) => (
      <DataGridItemRow
        key={row.key}
        item={row.item}
        index={row.index}
        rowId={row.rowId}
        render={render}
      />
    ));

  let content: React.ReactNode;
  if (typeof children === 'function') {
    // The items are the grid's `T`, which the body cannot see: its own `T` types the function.
    content = renderRows(children as DataGridRenderRow);
  } else if (children === undefined) {
    content = renderRows(itemsContext?.renderColumnsRow ?? null);
  } else {
    content = children;
  }

  return (
    <DataGridSectionContext.Provider value="body">
      <tbody ref={ref} className={cn(dataGridBodyClassNames.root, className)} {...rest}>
        {content}
      </tbody>
    </DataGridSectionContext.Provider>
  );
};
DataGridBody.displayName = 'DataGridBody';

/**
 * A grid row. In a selectable grid it starts with a selection cell (checkbox or radio) named
 * after the row's first cell (or `selectionLabel`), unless a `DataGrid.SelectionCell` child is
 * its selection cell; Space on one of its cells toggles the row, and so does a click on the row
 * with the grid's `selectOnRowClick`.
 *
 * The row is the `group/table-row` group whose hover or focus draws a subtle selection control
 * (`subtleSelection`) and the `Table.CellActions` of its cells. A group is matched by any
 * ancestor, so the rows of a grid nested in a cell
 * share it: hovering the outer row also draws the subtle controls of the nested grid (a limit of
 * CSS groups). A Tree in a cell keeps its own rows' group.
 */
const DataGridRow = ({
  rowId: rowIdProp,
  selectionLabel,
  selectionCellProps,
  children,
  className,
  onClick,
  onKeyDown,
  ref,
  ...rest
}: DataGridRowProps) => {
  const { selectionMode, store, toggleRow, selectOnRowClick, selectionAppearance } =
    useDataGridContext('DataGrid.Row');
  // A row rendered for an item of `items` defaults to the item's row id.
  const itemRowId = React.useContext(DataGridRowIdContext);
  const rowId = rowIdProp ?? itemRowId ?? undefined;
  const section = React.useContext(DataGridSectionContext);
  const firstHeaderRowHint = React.useContext(DataGridHeaderRowHintContext);
  const inHeader = section === 'header';
  const selectable = selectionMode !== 'none' && !inHeader;
  const labelId = useId('wave-datagrid-row-label');

  // The children are always flattened (Fragments too) and rendered under their flattened keys,
  // whatever the mode, so the keys stay the same when `selectionMode`, `selectionLabel` or `rowId`
  // change and the cells are not remounted.
  const flatChildren = flattenChildren(children);
  // A DataGrid.SelectionCell child is the row's selection cell; its own props win.
  let ownCellProps: DataGridSelectionCellProps | undefined;
  for (const { node } of flatChildren) {
    if (isSelectionCellElement(node)) {
      ownCellProps = node.props;
      break;
    }
  }
  const hasSelectionCell = ownCellProps !== undefined;
  const selectionDisabled = ownCellProps?.disabled ?? selectionCellProps?.disabled ?? false;
  const selectionInvisible = ownCellProps?.invisible ?? selectionCellProps?.invisible ?? false;
  const ownLabelledBy = ownCellProps?.['aria-labelledby'];
  const ownLabel =
    ownCellProps?.['aria-label'] ?? selectionCellProps?.['aria-label'] ?? selectionLabel;

  const single = selectionMode === 'single';
  const getSelected = React.useCallback(
    () => rowId !== undefined && store.isSelected(rowId, single),
    [rowId, store, single],
  );
  // Notified only when the selection changes (in multiple mode, rows registering notify no row).
  const isSelected = React.useSyncExternalStore(store.subscribe, getSelected, getSelected);

  React.useLayoutEffect(() => {
    if (rowId === undefined || inHeader) return;
    const unregister = store.register(rowId);
    if (isDev && store.countRegistrations(rowId) > 1) warnDuplicateRowId(rowId);
    return unregister;
  }, [store, rowId, inHeader]);

  // A row whose selection is disabled is left out of select-all.
  React.useLayoutEffect(() => {
    if (rowId === undefined || inHeader || !selectionDisabled) return;
    return store.disable(rowId);
  }, [store, rowId, inHeader, selectionDisabled]);

  React.useEffect(() => {
    if (selectable && rowId === undefined) {
      warnOnce(
        'DataGrid.Row:missing-rowId',
        'DataGrid.Row: a selectable grid needs a `rowId` on every row; this row has no selection control.',
      );
    }
  }, [selectable, rowId]);

  const unlabelled =
    selectable && rowId !== undefined && ownLabel === undefined && ownLabelledBy === undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!selectable || rowId === undefined || event.key !== ' ') return;
    const target = event.target as Element;
    // Only keys pressed on the row itself or on one of its own cells, never on a nested widget.
    if (target !== event.currentTarget && target.parentElement !== event.currentTarget) return;
    // A row whose selection is disabled takes the key too (no page scroll), and stays as it is.
    event.preventDefault();
    if (!selectionDisabled) toggleRow(rowId, event.nativeEvent);
  };

  const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    if (!selectOnRowClick || !selectable || rowId === undefined || selectionDisabled) return;
    const row = event.currentTarget;
    // The row's own cells carry the grid's tabindex; they are not widgets nested in the row.
    const nested = isForeignEvent(event, { isOwnPart: (element) => element.parentElement === row });
    if (nested || endsTextSelection(event)) return;
    toggleRow(rowId, event.nativeEvent);
  };

  // Name the selection control after the first cell (its own id, or a generated one).
  let labelledBy: string | undefined;
  let idCellIndex = -1;
  if (unlabelled) {
    const firstCellIndex = flatChildren.findIndex(({ node }) =>
      isElementOfType(node, DataGridCell, 'td', 'th'),
    );
    if (firstCellIndex >= 0) {
      const firstCell = flatChildren[firstCellIndex].node as React.ReactElement<{ id?: string }>;
      labelledBy = firstCell.props.id ?? labelId;
      if (firstCell.props.id === undefined) idCellIndex = firstCellIndex;
    }
  }
  const content = flatChildren.map(({ key, node }, index) =>
    renderFlatChild({
      key,
      node:
        index === idCellIndex
          ? React.cloneElement(node as React.ReactElement<{ id?: string }>, { id: labelId })
          : node,
    }),
  );

  const needsLabel = unlabelled && labelledBy === undefined;
  React.useEffect(() => {
    if (needsLabel) {
      warnOnce(
        'DataGrid.Row:selection-label',
        'DataGrid.Row: no child is a `DataGrid.Cell`, `<td>` or `<th>` element, so the row selection control is named "Select row". Pass `selectionLabel` (a cell rendered by another component is not seen).',
      );
    }
  }, [needsLabel]);

  // The selection control's name: the cell's own, else the row's first cell, else "Select row".
  const controlLabelledBy = ownLabelledBy ?? labelledBy;
  const controlLabel = ownLabel ?? (controlLabelledBy === undefined ? 'Select row' : undefined);

  const rowContext = React.useMemo<DataGridRowContextValue>(
    () => ({
      selectionCellProps,
      hasSelectionCell,
      rowId: selectable ? rowId : undefined,
      isSelected,
      disabled: selectionDisabled,
      invisible: selectionInvisible,
      ariaLabel: controlLabel,
      ariaLabelledBy: controlLabelledBy,
    }),
    [
      selectionCellProps,
      hasSelectionCell,
      selectable,
      rowId,
      isSelected,
      selectionDisabled,
      selectionInvisible,
      controlLabel,
      controlLabelledBy,
    ],
  );

  // The automatic selection cell, first; a DataGrid.SelectionCell child renders it where it stands.
  let selectionCellElement: React.ReactNode = null;
  if (!hasSelectionCell && inHeader && selectionMode !== 'none') {
    selectionCellElement = (
      <DataGridSelectionHeaderSlot
        selectionMode={selectionMode}
        initialFirst={firstHeaderRowHint}
        cellProps={selectionCellProps}
      />
    );
  } else if (!hasSelectionCell && selectable) {
    selectionCellElement = <DataGridBodySelectionCell component="DataGrid.Row" />;
  }

  return (
    <DataGridRowContext.Provider value={rowContext}>
      <tr
        ref={ref}
        className={cn(
          dataGridRowClassNames.root,
          // The group whose hover or focus draws a subtle selection control (its own name: a
          // Tree in a cell keys its actions on its rows' `group/row`).
          'group/table-row',
          !inHeader && BODY_ROW_CLASSES[selectionAppearance],
          selectable && isSelected && forcedColors.selectedContainer,
          className,
        )}
        aria-selected={selectable ? isSelected : undefined}
        data-selected={selectable && isSelected ? '' : undefined}
        {...rest}
        onClick={composeEventHandlers(onClick, handleClick)}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      >
        {selectionCellElement}
        {content}
      </tr>
    </DataGridRowContext.Provider>
  );
};
DataGridRow.displayName = 'DataGridRow';

/** Props of {@link DataGridBodySelectionCell}: the cell's own, without what the row resolved. */
interface DataGridBodySelectionCellProps extends Omit<
  DataGridSelectionCellProps,
  'disabled' | 'invisible' | 'aria-label' | 'aria-labelledby'
> {
  /** The public name of the part that renders the cell, for the context errors. */
  component: string;
  /** The root class of `DataGrid.SelectionCell`, when the cell is one. */
  stableClassName?: string;
}

/**
 * The selection cell of a body row (internal): the row's checkbox (multiple mode) or radio (single
 * mode), the automatic first cell or a `DataGrid.SelectionCell`. Its state, `disabled`,
 * `invisible` and name come from the row.
 */
function DataGridBodySelectionCell({
  component,
  stableClassName,
  className,
  controlRef,
  'aria-describedby': ariaDescribedBy,
  ref,
  ...rest
}: DataGridBodySelectionCellProps) {
  const { selectionMode, toggleRow, radioName, subtleSelection } = useDataGridContext(component);
  const row = useDataGridRowContext(component);
  const { rowId } = row;
  const single = selectionMode === 'single';
  return (
    <td
      role="gridcell"
      {...rest}
      ref={ref}
      data-selection-cell=""
      className={cn(
        stableClassName,
        dataGridRowClassNames.selectionCell,
        SELECTION_CELL_CLASSES,
        focusRingInset,
        row.selectionCellProps?.className,
        className,
      )}
    >
      {rowId !== undefined && selectionMode !== 'none' && (
        <TableSelectionControl
          ref={controlRef}
          type={single ? 'radio' : 'checkbox'}
          name={single ? radioName : undefined}
          // The shared name groups the radios. `form=""` matches no form, so they have no form
          // owner (still one group: same name, both ownerless) and never add a generated field
          // to an enclosing form's submission.
          form={single ? '' : undefined}
          checked={row.isSelected}
          disabled={row.disabled}
          invisible={row.invisible}
          subtle={subtleSelection}
          onChange={(event) => toggleRow(rowId, event.nativeEvent)}
          aria-label={row.ariaLabel}
          aria-labelledby={row.ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          className={dataGridRowClassNames.selectionControl}
        />
      )}
    </td>
  );
}

/**
 * The selection cell of a row, rendered where it stands among the row's cells (the row and the
 * header then add none of their own). In a header row it is the select-all checkbox (multiple
 * mode; the "Selection" header text in single mode), the first header row's only, as the
 * automatic cell; in a body row (a `DataGrid.Row`) the row's checkbox or radio. It takes the
 * selection cell props of its row (`selectionCellProps`), its own winning. `aria-label`,
 * `aria-labelledby` and `aria-describedby` go to the control; the other props, `className` and
 * `ref` to the cell. In a grid without selection it renders nothing (with a development warning).
 */
const DataGridSelectionCell = ({
  disabled,
  invisible,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  controlRef,
  ref,
  ...rest
}: DataGridSelectionCellProps) => {
  const { selectionMode } = useDataGridContext('DataGrid.SelectionCell');
  const section = React.useContext(DataGridSectionContext);
  const firstHeaderRowHint = React.useContext(DataGridHeaderRowHintContext);
  const row = React.useContext(DataGridRowContext);
  const notSelectable = selectionMode === 'none';
  // A DataGrid.Row that did not see this cell among its children added its own cell too.
  const unseen = !notSelectable && row !== null && !row.hasSelectionCell;

  React.useEffect(() => {
    if (notSelectable) {
      warnOnce(
        'DataGrid.SelectionCell:not-selectable',
        'DataGrid.SelectionCell: the grid has no row selection (`selectionMode` is "none"), so the ' +
          'cell renders nothing. Set `selectionMode` on the DataGrid, or remove the cell.',
      );
    }
  }, [notSelectable]);

  React.useEffect(() => {
    if (unseen) {
      warnOnce(
        'DataGrid.SelectionCell:unseen',
        'DataGrid.SelectionCell: rendered by another component, so its DataGrid.Row did not see ' +
          'it and added its own selection cell. Render DataGrid.SelectionCell as a child of ' +
          'DataGrid.Row (a Fragment is fine).',
      );
    }
  }, [unseen]);

  if (notSelectable) return null;
  if (section === 'header') {
    const rowProps = row?.selectionCellProps;
    return (
      <DataGridSelectionHeaderSlot
        ref={ref}
        selectionMode={selectionMode}
        initialFirst={firstHeaderRowHint}
        stableClassName={dataGridSelectionCellClassNames.root}
        cellProps={{
          ...rest,
          className: cn(rowProps?.className, className),
          disabled: disabled ?? rowProps?.disabled,
          invisible: invisible ?? rowProps?.invisible,
          'aria-label': ariaLabel ?? rowProps?.['aria-label'],
          'aria-labelledby': ariaLabelledBy,
          'aria-describedby': ariaDescribedBy,
          controlRef,
        }}
      />
    );
  }
  return (
    <DataGridBodySelectionCell
      {...rest}
      ref={ref}
      component="DataGrid.SelectionCell"
      stableClassName={dataGridSelectionCellClassNames.root}
      className={className}
      controlRef={controlRef}
      aria-describedby={ariaDescribedBy}
    />
  );
};
DataGridSelectionCell.displayName = 'DataGridSelectionCell';
markTablePart(DataGridSelectionCell, 'dataGridSelectionCell');

/**
 * A grid cell (`<td>`), focusable through the grid's keyboard navigation. It is the positioning
 * box of a `Table.CellActions` inside it.
 */
const DataGridCell = ({ children, className, ref, ...rest }: DataGridCellProps) => (
  <td
    ref={ref}
    role="gridcell"
    className={cn(
      dataGridCellClassNames.root,
      cellBase,
      'relative text-body-1',
      focusRingInset,
      className,
    )}
    {...rest}
  >
    {children}
  </td>
);
DataGridCell.displayName = 'DataGridCell';

export {
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  DataGridSelectionCell,
};

/**
 * An interactive data table (`role="grid"`) following the APG Grid pattern: one tab stop,
 * arrow-key navigation between cells (Home/End, Ctrl+Home/Ctrl+End, PageUp/PageDown; Up/Down keep
 * the visual column, so a grouped header with spanning cells works), Enter/F2 to interact with a
 * cell's widgets and Escape to return to the cell. A composite widget in a cell (a Toolbar,
 * RadioGroup, TabList, …) is entered with Enter/F2 like a text field; it manages its own tab
 * indexes, so it keeps its own Tab stop. Supports sortable columns (`onSortChange` reports the new
 * sort; a grid with `items` orders its rows by the sorted column's `compare`, otherwise the consumer
 * orders them) and single or multiple row selection with a select-all header checkbox.
 *
 * Selection is made with the row's control, Space on a cell, and, with `selectOnRowClick`, a
 * click on the row. `selectionAppearance` picks the fill of a selected row, `subtleSelection`
 * hides the unchecked controls until their row (or, for select-all, the grid) is hovered or holds
 * focus, and a row's `selectionCellProps` disables, hides or names its control. The selection
 * column comes first; a `DataGrid.SelectionCell` places it elsewhere in a row.
 *
 * The grid is composed from its parts, or rendered from data: with `items` and typed `columns`
 * (`DataGridColumn<T>`, see `createTableColumn`) it renders the header, the rows and the cells
 * itself, and `DataGrid.Body` also takes a render function that returns each item's row. Rows
 * rendered from `items` take their `rowId` from `getRowId` (by default the item's index).
 *
 * Sub-components are available as `DataGrid.Header`, `DataGrid.HeaderCell`, `DataGrid.Body`,
 * `DataGrid.Row`, `DataGrid.Cell` and `DataGrid.SelectionCell` in client components, and as the
 * flat exports `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow`,
 * `DataGridCell` and `DataGridSelectionCell` (the form React Server Components can import).
 */
export const DataGrid = /* @__PURE__ */ Object.assign(DataGridRoot, {
  Header: DataGridHeader,
  HeaderCell: DataGridHeaderCell,
  Body: DataGridBody,
  Row: DataGridRow,
  Cell: DataGridCell,
  SelectionCell: DataGridSelectionCell,
});
