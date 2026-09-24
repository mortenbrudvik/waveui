import * as React from 'react';
import { cn } from '../../lib/cn';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import {
  isDev,
  reportMissingContext,
  resolveDeprecatedProp,
  warnDeprecated,
  warnOnce,
} from '../../lib/dev';
import { focusRingInset, forcedColors } from '../../lib/styles';
import type { SelectionMode } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useGridNavigation } from './useGridNavigation';

export type SortDirection = 'ascending' | 'descending';

/** The sort state of a DataGrid: the sorted column and its direction. */
export interface DataGridSort {
  /** The `columnId` of the sorted column. */
  columnId: string;
  /** The sort direction. */
  direction: SortDirection;
}

/** Defines a column in the DataGrid. */
export interface DataGridColumn {
  /** Unique identifier for the column (the header cell's `columnId`). */
  id: string;
  /** Display label for the column header. */
  label: string;
  /** Whether the column supports sorting. */
  sortable?: boolean;
}

/** Props of every DataGrid, whatever sort API it uses. */
export interface DataGridBaseProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Column definitions. When given and no `DataGrid.Header` child is present, the header row
   * (including the selection column) is rendered from them: `id` becomes the header cell's
   * `columnId`, `label` its content, `sortable` makes it a sort button.
   */
  columns?: readonly DataGridColumn[];
  /**
   * Row selection mode. `'multiple'` adds a checkbox column with a "Select all rows" header
   * checkbox; `'single'` adds a radio column.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /**
   * Controlled selected row ids (`DataGrid.Row` `rowId`). In single mode pass at most one id: with
   * several, only the first one whose row is rendered is selected (a development warning says so).
   */
  selectedItems?: readonly string[];
  /** Initially selected row ids (uncontrolled). In single mode, at most one (see `selectedItems`). */
  defaultSelectedItems?: readonly string[];
  /**
   * Called with the new selected row ids when the selection changes. Ids of rows that are not
   * rendered are left out of the reported selection and of the select-all state, so the next
   * change drops them. Until that change an uncontrolled grid still holds such an id: a row
   * re-added with the same `rowId` before then is shown selected again.
   */
  onSelectedItemsChange?: (selectedItems: string[]) => void;
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
  /** DataGrid header, body, and row elements. */
  children: React.ReactNode;
  /** Ref to the `<table role="grid">` element. */
  ref?: React.Ref<HTMLTableElement>;
}

interface NoDeprecatedSortProps {
  sortColumn?: never;
  defaultSortColumn?: never;
  sortDirection?: never;
  defaultSortDirection?: never;
}

/** The 0.5 sort API, controlled: `sort` + `onSortChange(sort)`. */
export interface DataGridControlledSortProps extends NoDeprecatedSortProps {
  /** The controlled sort, or `null` for an unsorted grid. */
  sort: DataGridSort | null;
  /** Initial sort while `sort` is not given yet. */
  defaultSort?: DataGridSort | null;
  /**
   * Called with the new sort when a sortable header is activated. Sorting is controlled: the
   * consumer reorders the rows.
   */
  onSortChange?: (sort: DataGridSort) => void;
}

/** The 0.5 sort API, uncontrolled: `defaultSort` (`null` for none) + `onSortChange(sort)`. */
export interface DataGridUncontrolledSortProps extends NoDeprecatedSortProps {
  sort?: undefined;
  /** The initial sort, or `null` for an initially unsorted grid. */
  defaultSort: DataGridSort | null;
  /**
   * Called with the new sort when a sortable header is activated. Sorting is controlled: the
   * consumer reorders the rows.
   */
  onSortChange?: (sort: DataGridSort) => void;
}

/**
 * The 0.4 sort API: `onSortChange(columnId, direction)` and the deprecated `sortColumn`/
 * `sortDirection` props. It applies whenever neither `sort` nor `defaultSort` is given. As in 0.4,
 * the column and the direction can be controlled independently: the half that is not controlled is
 * kept internally and follows every sort request (mixed control, warned in development).
 */
export interface DataGridLegacySortProps {
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
   * Called when a sortable header is activated, with the 0.4 arguments. Pass `sort` or
   * `defaultSort` to receive a `DataGridSort` object instead: `defaultSort={null}` turns the
   * object form on for an initially unsorted grid. A `sort` that is still `undefined` (e.g. while
   * data loads) does not: pass `sort={sort ?? null}`.
   *
   * @example
   * <DataGrid defaultSort={null} onSortChange={(sort) => setSort(sort)}>…</DataGrid>
   */
  onSortChange?: (columnId: string, direction: SortDirection) => void;
}

/**
 * Properties for the DataGrid component. The sort props form a union: `sort`/`defaultSort` with
 * `onSortChange(sort)` (0.5), or the 0.4 form `onSortChange(columnId, direction)` with the
 * deprecated `sortColumn`/`sortDirection`/`defaultSortColumn`/`defaultSortDirection`. The two
 * cannot be mixed.
 */
export type DataGridProps = DataGridBaseProps &
  (DataGridControlledSortProps | DataGridUncontrolledSortProps | DataGridLegacySortProps);

/** Properties for the DataGridHeader sub-component. */
export interface DataGridHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /**
   * Header row elements. Each `<tr>` child (also inside a Fragment) gets the selection column's
   * header cell prepended when the grid is selectable; a header row rendered by another component
   * should be a `DataGrid.Row`, which adds the cell itself. With several header rows (a grouped
   * header), only the first one gets the "Select all rows" control; later rows get an empty cell.
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
  /** Header cell content. */
  children: React.ReactNode;
  /** Ref to the `<th>` element. */
  ref?: React.Ref<HTMLTableCellElement>;
}

/** Properties for the DataGridBody sub-component. */
export interface DataGridBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** DataGrid row elements. */
  children: React.ReactNode;
  /** Ref to the `<tbody>` element. */
  ref?: React.Ref<HTMLTableSectionElement>;
}

/** Properties for the DataGridRow sub-component. */
export interface DataGridRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /**
   * Unique identifier for this row, used for selection. A selectable grid renders no selection
   * control (and warns in development) for a row without it.
   */
  rowId?: string;
  /**
   * Accessible name of the row's selection control. Defaults to the row's first child that is a
   * `DataGrid.Cell`, `<td>` or `<th>` element (`aria-labelledby`); a cell that another component
   * renders is not seen, so pass `selectionLabel` when the row's first cell is one. Without such a
   * child the control is named "Select row" (with a development warning).
   */
  selectionLabel?: string;
  /** DataGrid cell elements. */
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
  /** Whether all, some or none of the registered rows are selected. O(1). */
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
  /** How many registered row ids are selected (kept up to date, so select-all is O(1)). */
  let selectedRegistered = 0;
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
      selectedRegistered === 0 ? 'none' : selectedRegistered === registered.size ? 'all' : 'some';
    if (next === selectAll) return;
    selectAll = next;
    notify(selectAllListeners);
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
      const count = registered.get(rowId) ?? 0;
      registered.set(rowId, count + 1);
      if (count === 0 && selected.has(rowId)) selectedRegistered += 1;
      updateSelectAll();
      if (count === 0) onRegistrationChange(rowId);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const remaining = (registered.get(rowId) ?? 0) - 1;
        if (remaining > 0) {
          registered.set(rowId, remaining);
          return;
        }
        registered.delete(rowId);
        if (selected.has(rowId)) selectedRegistered -= 1;
        updateSelectAll();
        onRegistrationChange(rowId);
      };
    },
    setSelected(items) {
      const next = new Set(items);
      if (next.size === selected.size && items.every((item) => selected.has(item))) return;
      selected = next;
      singleId = undefined;
      selectedRegistered = 0;
      for (const rowId of next) if (registered.has(rowId)) selectedRegistered += 1;
      notify(rowListeners);
      updateSelectAll();
    },
    setSingleMode(single) {
      singleMode = single;
    },
    isSelected(rowId, single = false) {
      return single ? getSingleId() === rowId : selected.has(rowId);
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
  /** Toggles one row (single mode: selects it alone, or clears it). */
  toggleRow: (rowId: string) => void;
  /** Selects every rendered row, or clears the selection when all are selected. */
  toggleAll: () => void;
  /** Shared `name` of the single-mode radios (they are kept out of any form with `form=""`). */
  radioName: string;
}

interface DataGridSortContextValue {
  sort: DataGridSort | null;
  requestSort: (columnId: string) => void;
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

const INERT_STORE = createSelectionStore([]);
const INERT_CONTEXT: DataGridContextValue = {
  selectionMode: 'none',
  store: INERT_STORE,
  toggleRow: () => {},
  toggleAll: () => {},
  radioName: '',
};
const INERT_SORT_CONTEXT: DataGridSortContextValue = { sort: null, requestSort: () => {} };

function useDataGridContext(component: string): DataGridContextValue {
  const ctx = React.useContext(DataGridContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid');
  return INERT_CONTEXT;
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

const cellBase = 'px-4 py-3 border-b border-border';
const selectionCell = 'w-10 px-3 py-3 border-b border-border';
const nativeControl = 'accent-primary cursor-pointer';

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------

// The component-level JSDoc sits on the exported `DataGrid` below.
const DataGridRoot = (props: DataGridProps) => {
  const {
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
  /** 0.5 API: `onSortChange(sort)`. Sticky once `sort`/`defaultSort` was given. */
  const usesSortApi = sortProp !== undefined || defaultSort !== undefined;
  const [sortApiMode, setSortApiMode] = React.useState(usesSortApi);
  if (usesSortApi && !sortApiMode) setSortApiMode(true);
  const objectCallbacks = sortApiMode || usesSortApi;

  const legacySortControlled = sortColumnProp !== undefined || sortDirectionProp !== undefined;
  if (sortColumnProp !== undefined) warnDeprecated('DataGrid', 'sortColumn', 'sort');
  if (sortDirectionProp !== undefined) warnDeprecated('DataGrid', 'sortDirection', 'sort');
  if (defaultSortColumn !== undefined) {
    warnDeprecated('DataGrid', 'defaultSortColumn', 'defaultSort');
  }
  if (defaultSortDirection !== undefined) {
    warnDeprecated('DataGrid', 'defaultSortDirection', 'defaultSort');
  }
  const mixedSortApi =
    usesSortApi &&
    (legacySortControlled || defaultSortColumn !== undefined || defaultSortDirection !== undefined);

  React.useEffect(() => {
    if (mixedSortApi) {
      warnOnce(
        'DataGrid:mixed-sort',
        'DataGrid: do not mix `sort`/`defaultSort` with the deprecated `sortColumn`/`sortDirection`/' +
          '`defaultSortColumn`/`defaultSortDirection`. `sort`/`defaultSort` win.',
      );
    }
  }, [mixedSortApi]);
  // 0.4 mixed control: `sortColumn` and `sortDirection` are controlled independently. The half the
  // parent does not control is kept here (seeded from its default) and follows every sort request,
  // as 0.4 did, so repeated clicks still alternate and aria-sort shows what was reported.
  React.useEffect(() => {
    if (usesSortApi) return;
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
  }, [usesSortApi, sortColumnProp, sortDirectionProp]);

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

  const controlledSort = usesSortApi ? sortProp : legacyControlledSort;
  const initialSort = defaultSort !== undefined ? defaultSort : legacyDefaultSort;

  const emitSortChange = (next: DataGridSort | null) => {
    if (!next) return;
    if (!usesSortApi) {
      setLegacyHalves((previous) =>
        previous.column === next.columnId && previous.direction === next.direction
          ? previous
          : { column: next.columnId, direction: next.direction },
      );
    }
    if (!onSortChange) return;
    if (objectCallbacks) {
      (onSortChange as (sort: DataGridSort) => void)(next);
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
    (columnId: string) => {
      setSort((previous) => ({
        columnId,
        direction:
          previous?.columnId === columnId && previous.direction === 'ascending'
            ? 'descending'
            : 'ascending',
      }));
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

  const emitSelectionChange = (next: readonly string[]) => {
    onSelectedItemsChange?.([...next]);
    onSelectionChange?.(new Set(next));
  };

  const [selected, setSelected] = useControllable<readonly string[]>(
    controlledSelected,
    defaultSelected,
    emitSelectionChange,
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
    (rowId: string) => {
      setSelected((previous) => {
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

  const toggleAll = React.useCallback(() => {
    setSelected((previous) => {
      const effective = store.prune(previous);
      const all = store.getRegistered();
      const allSelected = all.length > 0 && all.every((rowId) => effective.includes(rowId));
      const next = allSelected ? [] : all;
      return sameItems(next, previous) ? previous : next;
    });
  }, [setSelected, store]);

  const radioName = useId('wave-datagrid-selection');

  const context = React.useMemo<DataGridContextValue>(
    () => ({ selectionMode, store, toggleRow, toggleAll, radioName }),
    [selectionMode, store, toggleRow, toggleAll, radioName],
  );

  // --- keyboard -------------------------------------------------------------
  const { gridRef, gridProps } = useGridNavigation();
  const mergedRef = useMergedRefs<HTMLTableElement>(ref, gridRef);

  // --- header from columns ----------------------------------------------------
  let content: React.ReactNode = children;
  const flatChildren = columns ? flattenChildren(children) : [];
  if (columns && !flatChildren.some(({ node }) => isElementOfType(node, DataGridHeader))) {
    // A `<caption>` stays the table's first child, before the generated header.
    const isCaption = ({ node }: { node: React.ReactNode }) => isElementOfType(node, 'caption');
    content = (
      <>
        {flatChildren.filter(isCaption).map(renderFlatChild)}
        <DataGridHeader>
          <tr>
            {columns.map((column) => (
              <DataGridHeaderCell key={column.id} columnId={column.id} sortable={column.sortable}>
                {column.label}
              </DataGridHeaderCell>
            ))}
          </tr>
        </DataGridHeader>
        {flatChildren.filter((child) => !isCaption(child)).map(renderFlatChild)}
      </>
    );
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
        <div
          {...containerRest}
          aria-label={containerHasRole ? containerLabel : undefined}
          aria-labelledby={containerHasRole ? containerLabelledBy : undefined}
          className={cn('overflow-x-auto rounded-md border border-border', containerClassName)}
        >
          <table
            ref={mergedRef}
            role="grid"
            aria-multiselectable={selectionMode === 'multiple' || undefined}
            className={cn('w-full border-separate border-spacing-0', className)}
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
      </DataGridSortContext.Provider>
    </DataGridContext.Provider>
  );
};
DataGridRoot.displayName = 'DataGrid';

// ---------------------------------------------------------------------------
// Selection header cell (internal)
// ---------------------------------------------------------------------------

function DataGridSelectionHeaderCell({
  selectionMode,
  ref,
}: {
  selectionMode: SelectionMode;
  ref?: React.Ref<HTMLTableCellElement>;
}) {
  const { store, toggleAll } = useDataGridContext('DataGrid.Header');
  const state = React.useSyncExternalStore(
    store.subscribeSelectAll,
    store.getSelectAllState,
    store.getSelectAllState,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  // A click clears the checkbox's `indeterminate` flag (checkbox activation does) and React restores
  // only `checked`, so the flag is re-applied after every click, also when the select-all state
  // stays the same (a controlled parent that keeps the selection partial, or ignores the change).
  const [clicks, setClicks] = React.useState(0);

  React.useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === 'some';
  }, [state, clicks]);

  return (
    <th
      ref={ref}
      scope="col"
      data-selection-cell=""
      className={cn(selectionCell, 'text-start', focusRingInset)}
    >
      {selectionMode === 'multiple' ? (
        <input
          ref={inputRef}
          type="checkbox"
          aria-label="Select all rows"
          checked={state === 'all'}
          onChange={() => {
            setClicks((count) => count + 1);
            toggleAll();
          }}
          className={cn(nativeControl, focusRingInset)}
        />
      ) : (
        <span className="sr-only">Selection</span>
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
}: {
  selectionMode: SelectionMode;
  initialFirst: boolean;
}) {
  const slots = React.useContext(DataGridHeaderSlotsContext) ?? INERT_HEADER_SLOTS;
  const [slot] = React.useState(() => ({}));
  const cellRef = React.useRef<HTMLTableCellElement | null>(null);

  const getIsFirst = React.useCallback(() => {
    const first = slots.getFirst();
    return first === null ? initialFirst : first === slot;
  }, [slots, slot, initialFirst]);
  const getServerIsFirst = React.useCallback(() => initialFirst, [initialFirst]);
  const isFirst = React.useSyncExternalStore(slots.subscribe, getIsFirst, getServerIsFirst);

  React.useLayoutEffect(() => slots.register(slot, () => cellRef.current), [slots, slot]);

  return isFirst ? (
    <DataGridSelectionHeaderCell ref={cellRef} selectionMode={selectionMode} />
  ) : (
    <td ref={cellRef} data-selection-cell="" className={cn(selectionCell, focusRingInset)} />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Prepends the selection column's header slot (or `null`) to every `<tr>` in `children`, looking
 * inside Fragments, and tells every other element child (a `DataGrid.Row`, or a component that
 * renders one) whether it is the header's first row. Every row gets the same child shape in every
 * selection mode, so switching `selectionMode` does not remount the header cells.
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
        const slot =
          selectionMode === 'none' ? null : (
            <DataGridSelectionHeaderSlot selectionMode={selectionMode} initialFirst={isFirst} />
          );
        return React.cloneElement(child, undefined, slot, child.props.children);
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
 * cell to each `<tr>` child, also inside a Fragment: the first header row gets the "Select all
 * rows" checkbox (multiple mode) or the "Selection" header (single mode), later rows of a grouped
 * header an empty cell. A header row rendered by another component cannot get it (a development
 * warning says so): use `DataGrid.Row` for such a row, which adds the cell itself.
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
    const missing = Array.from(thead.rows).some(
      (row) => row.cells.length > 0 && !row.cells[0].hasAttribute('data-selection-cell'),
    );
    if (missing) {
      warnOnce(
        'DataGrid.Header:missing-selection-cell',
        'DataGrid.Header: a header row has no selection column header cell, so the header has one ' +
          'column fewer than the selectable rows. Render header rows as `<tr>` children of ' +
          'DataGrid.Header (a Fragment is fine), or use `DataGrid.Row` for a header row that ' +
          'another component renders.',
      );
    }
  });

  return (
    <DataGridSectionContext.Provider value="header">
      <DataGridHeaderSlotsContext.Provider value={slots}>
        <thead ref={mergedRef} className={cn('bg-card', className)} {...rest}>
          {content}
        </thead>
      </DataGridHeaderSlotsContext.Provider>
    </DataGridSectionContext.Provider>
  );
};
DataGridHeader.displayName = 'DataGridHeader';

const sortIcon = (direction: SortDirection) => (
  <svg
    className="h-3 w-3 shrink-0"
    viewBox="0 0 12 12"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    {direction === 'ascending' ? <path d="M6 2L10 8H2L6 2Z" /> : <path d="M6 10L2 4H10L6 10Z" />}
  </svg>
);

/**
 * A column header cell. A `sortable` header (with a `columnId`) renders its content inside a
 * `<button type="button">` that toggles the sort; the `<th>` carries `aria-sort`. A consumer
 * `onClick` (on the `<th>`) runs before the sort, and calling `preventDefault()` in it cancels the
 * sort (also for Enter/Space on the button, which click it).
 */
const DataGridHeaderCell = ({
  columnId,
  sortable = false,
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
      requestSort(sortColumnId);
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
        <button
          type="button"
          className={cn(
            'inline-flex w-full cursor-pointer select-none items-center gap-1 border-0 bg-transparent px-4 py-3 text-start text-inherit [font:inherit] uppercase tracking-wider',
            focusRingInset,
          )}
        >
          {children}
          {sortedDirection && sortIcon(sortedDirection)}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">{children}</span>
      )}
    </th>
  );
};
DataGridHeaderCell.displayName = 'DataGridHeaderCell';

/** The grid's `<tbody>`. */
const DataGridBody = ({ children, className, ref, ...rest }: DataGridBodyProps) => (
  <DataGridSectionContext.Provider value="body">
    <tbody ref={ref} className={className} {...rest}>
      {children}
    </tbody>
  </DataGridSectionContext.Provider>
);
DataGridBody.displayName = 'DataGridBody';

/**
 * A grid row. In a selectable grid it starts with a selection cell (checkbox or radio) named
 * after the row's first cell (or `selectionLabel`); Space on one of its cells toggles the row.
 */
const DataGridRow = ({
  rowId,
  selectionLabel,
  children,
  className,
  onKeyDown,
  ref,
  ...rest
}: DataGridRowProps) => {
  const { selectionMode, store, toggleRow, radioName } = useDataGridContext('DataGrid.Row');
  const section = React.useContext(DataGridSectionContext);
  const firstHeaderRowHint = React.useContext(DataGridHeaderRowHintContext);
  const inHeader = section === 'header';
  const selectable = selectionMode !== 'none' && !inHeader;
  const labelId = useId('wave-datagrid-row-label');

  const single = selectionMode === 'single';
  const getSelected = React.useCallback(
    () => rowId !== undefined && store.isSelected(rowId, single),
    [rowId, store, single],
  );
  // Notified only when the selection changes (in multiple mode, rows registering notify no row).
  const isSelected = React.useSyncExternalStore(store.subscribe, getSelected, getSelected);

  React.useLayoutEffect(() => {
    if (rowId === undefined || inHeader) return;
    return store.register(rowId);
  }, [store, rowId, inHeader]);

  React.useEffect(() => {
    if (selectable && rowId === undefined) {
      warnOnce(
        'DataGrid.Row:missing-rowId',
        'DataGrid.Row: a selectable grid needs a `rowId` on every row; this row has no selection control.',
      );
    }
  }, [selectable, rowId]);

  const unlabelled = selectable && rowId !== undefined && selectionLabel === undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!selectable || rowId === undefined || event.key !== ' ') return;
    const target = event.target as Element;
    // Only keys pressed on the row itself or on one of its own cells, never on a nested widget.
    if (target !== event.currentTarget && target.parentElement !== event.currentTarget) return;
    event.preventDefault();
    toggleRow(rowId);
  };

  // Name the selection control after the first cell (its own id, or a generated one). The children
  // are always flattened (Fragments too) and rendered under their flattened keys, whatever the
  // mode, so the keys stay the same when `selectionMode`, `selectionLabel` or `rowId` change and
  // the cells are not remounted.
  const flatChildren = flattenChildren(children);
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

  let selectionCellElement: React.ReactNode = null;
  if (inHeader && selectionMode !== 'none') {
    selectionCellElement = (
      <DataGridSelectionHeaderSlot
        selectionMode={selectionMode}
        initialFirst={firstHeaderRowHint}
      />
    );
  } else if (selectable) {
    selectionCellElement = (
      <td role="gridcell" data-selection-cell="" className={cn(selectionCell, focusRingInset)}>
        {rowId !== undefined && (
          <input
            type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
            name={selectionMode === 'single' ? radioName : undefined}
            // The shared name groups the radios. `form=""` matches no form, so they have no form
            // owner (still one group: same name, both ownerless) and never add a generated field
            // to an enclosing form's submission.
            form={selectionMode === 'single' ? '' : undefined}
            checked={isSelected}
            onChange={() => toggleRow(rowId)}
            aria-label={selectionLabel ?? (labelledBy ? undefined : 'Select row')}
            aria-labelledby={selectionLabel === undefined ? labelledBy : undefined}
            className={cn(nativeControl, focusRingInset)}
          />
        )}
      </td>
    );
  }

  return (
    <tr
      ref={ref}
      className={cn(
        !inHeader &&
          'hover:bg-subtle-hover data-[selected]:bg-selected transition-colors motion-reduce:transition-none',
        selectable && isSelected && forcedColors.selectedContainer,
        className,
      )}
      aria-selected={selectable ? isSelected : undefined}
      data-selected={selectable && isSelected ? '' : undefined}
      {...rest}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
    >
      {selectionCellElement}
      {content}
    </tr>
  );
};
DataGridRow.displayName = 'DataGridRow';

/** A grid cell (`<td>`), focusable through the grid's keyboard navigation. */
const DataGridCell = ({ children, className, ref, ...rest }: DataGridCellProps) => (
  <td
    ref={ref}
    role="gridcell"
    className={cn(cellBase, 'text-body-1', focusRingInset, className)}
    {...rest}
  >
    {children}
  </td>
);
DataGridCell.displayName = 'DataGridCell';

export { DataGridHeader, DataGridHeaderCell, DataGridBody, DataGridRow, DataGridCell };

/**
 * An interactive data table (`role="grid"`) following the APG Grid pattern: one tab stop,
 * arrow-key navigation between cells (Home/End, Ctrl+Home/Ctrl+End, PageUp/PageDown; Up/Down keep
 * the visual column, so a grouped header with spanning cells works), Enter/F2 to interact with a
 * cell's widgets and Escape to return to the cell. A composite widget in a cell (a Toolbar,
 * RadioGroup, TabList, …) is entered with Enter/F2 like a text field; it manages its own tab
 * indexes, so it keeps its own Tab stop. Supports sortable columns (controlled sorting:
 * `onSortChange` reports the new sort and the consumer reorders the rows) and single or multiple
 * row selection with a select-all header checkbox.
 *
 * Sub-components are available as `DataGrid.Header`, `DataGrid.HeaderCell`, `DataGrid.Body`,
 * `DataGrid.Row` and `DataGrid.Cell` in client components, and as the flat exports
 * `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow` and `DataGridCell` (the
 * form React Server Components can import).
 */
export const DataGrid = /* @__PURE__ */ Object.assign(DataGridRoot, {
  Header: DataGridHeader,
  HeaderCell: DataGridHeaderCell,
  Body: DataGridBody,
  Row: DataGridRow,
  Cell: DataGridCell,
});
