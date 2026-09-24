import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, resolveDeprecatedProp, warnDeprecated, warnOnce } from '../../lib/dev';
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
  columns?: DataGridColumn[];
  /**
   * Row selection mode. `'multiple'` adds a checkbox column with a "Select all rows" header
   * checkbox; `'single'` adds a radio column.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /** Controlled selected row ids (`DataGrid.Row` `rowId`). */
  selectedItems?: string[];
  /** Initially selected row ids (uncontrolled). */
  defaultSelectedItems?: string[];
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
 * `sortDirection` props. It applies whenever neither `sort` nor `defaultSort` is given.
 */
export interface DataGridLegacySortProps {
  sort?: undefined;
  defaultSort?: undefined;
  /** @deprecated Use `sort` (`{ columnId, direction }` or `null`). */
  sortColumn?: string;
  /** @deprecated Use `defaultSort`. */
  defaultSortColumn?: string;
  /** @deprecated Use `sort`. */
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
   * should be a `DataGrid.Row`, which adds the cell itself.
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
   * Accessible name of the row's selection control. Defaults to the row's first cell
   * (`aria-labelledby`).
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
 */
interface SelectionStore {
  subscribe(listener: () => void): () => void;
  /** Registers a rendered row id; returns the unregister function. */
  register(rowId: string): () => void;
  /** Sets the committed selection (layout effect of the root). */
  setSelected(items: readonly string[]): void;
  isSelected(rowId: string): boolean;
  getSelectAllState(): SelectAllState;
  /** Registered row ids in registration order. */
  getRegistered(): string[];
  /** `items` restricted to registered rows (order of `items`). */
  prune(items: readonly string[]): string[];
}

function createSelectionStore(initial: readonly string[]): SelectionStore {
  let selected: ReadonlySet<string> = new Set(initial);
  const registered = new Map<string, number>();
  const listeners = new Set<() => void>();
  let selectAll: SelectAllState | null = null;

  const emit = () => {
    selectAll = null;
    for (const listener of Array.from(listeners)) listener();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    register(rowId) {
      registered.set(rowId, (registered.get(rowId) ?? 0) + 1);
      emit();
      return () => {
        const count = registered.get(rowId) ?? 0;
        if (count <= 1) registered.delete(rowId);
        else registered.set(rowId, count - 1);
        emit();
      };
    },
    setSelected(items) {
      const next = new Set(items);
      if (next.size === selected.size && items.every((item) => selected.has(item))) return;
      selected = next;
      emit();
    },
    isSelected(rowId) {
      return selected.has(rowId);
    },
    getSelectAllState() {
      if (selectAll === null) {
        let count = 0;
        for (const rowId of registered.keys()) if (selected.has(rowId)) count += 1;
        selectAll = count === 0 ? 'none' : count === registered.size ? 'all' : 'some';
      }
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
// Contexts
// ---------------------------------------------------------------------------

interface DataGridContextValue {
  selectionMode: 'none' | SelectionMode;
  store: SelectionStore;
  /** Toggles one row (single mode: selects it alone, or clears it). */
  toggleRow: (rowId: string) => void;
  /** Selects every rendered row, or clears the selection when all are selected. */
  toggleAll: () => void;
  /** Shared `name` of the single-mode radios. */
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

const INERT_STORE = createSelectionStore([]);
const INERT_CONTEXT: DataGridContextValue = {
  selectionMode: 'none',
  store: INERT_STORE,
  toggleRow: () => {},
  toggleAll: () => {},
  radioName: '',
};
const INERT_SORT_CONTEXT: DataGridSortContextValue = { sort: null, requestSort: () => {} };

function missingContext(component: string): void {
  const message = `[WaveUI] ${component} must be used within DataGrid.`;
  if (isDev) throw new Error(message);
  console.error(message);
}

function useDataGridContext(component: string): DataGridContextValue {
  const ctx = React.useContext(DataGridContext);
  if (ctx) return ctx;
  missingContext(component);
  return INERT_CONTEXT;
}

function useDataGridSortContext(component: string): DataGridSortContextValue {
  const ctx = React.useContext(DataGridSortContext);
  if (ctx) return ctx;
  missingContext(component);
  return INERT_SORT_CONTEXT;
}

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_ITEMS: string[] = [];

function toItems(keys: ReadonlySet<string> | readonly string[] | undefined): string[] | undefined {
  return keys === undefined ? undefined : Array.from(keys);
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function isElementOfType<P>(
  node: React.ReactNode,
  type: React.ElementType,
): node is React.ReactElement<P> {
  return React.isValidElement(node) && node.type === type;
}

/** Whether `children` (or a Fragment among them) contains a `DataGrid.Header`. */
function containsHeader(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(
    (child) =>
      isElementOfType(child, DataGridHeader) ||
      (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment) &&
        containsHeader(child.props.children)),
  );
}

const cellBase = 'px-4 py-3 border-b border-border';
const selectionCell = 'w-10 px-3 py-3 border-b border-border';
const nativeControl = 'accent-primary cursor-pointer';

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------

/**
 * An interactive data table (`role="grid"`) following the APG Grid pattern: one tab stop,
 * arrow-key navigation between cells (Home/End, Ctrl+Home/Ctrl+End, PageUp/PageDown), Enter/F2 to
 * interact with a cell's widgets and Escape to return to the cell. A composite widget in a cell
 * (a Toolbar, RadioGroup, TabList, …) is entered with Enter/F2 like a text field; it manages its
 * own tab indexes, so it keeps its own Tab stop. Supports sortable columns (controlled sorting:
 * `onSortChange` reports the new sort and the consumer reorders the rows) and single or multiple
 * row selection with a select-all header checkbox.
 *
 * Sub-components are available as `DataGrid.Header`, `DataGrid.HeaderCell`, `DataGrid.Body`,
 * `DataGrid.Row` and `DataGrid.Cell` in client components, and as the flat exports
 * `DataGridHeader`, `DataGridHeaderCell`, `DataGridBody`, `DataGridRow` and `DataGridCell` (the
 * form React Server Components can import).
 */
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
  React.useEffect(() => {
    if (!usesSortApi && sortDirectionProp !== undefined && sortColumnProp === undefined) {
      warnOnce(
        'DataGrid:sortDirection-without-sortColumn',
        'DataGrid: `sortDirection` is ignored without `sortColumn` (mixed control). Pass `sort` instead.',
      );
    }
  }, [usesSortApi, sortColumnProp, sortDirectionProp]);

  const legacyControlledSort = React.useMemo<DataGridSort | null | undefined>(() => {
    if (sortColumnProp === undefined) return undefined;
    return sortColumnProp === ''
      ? null
      : { columnId: sortColumnProp, direction: sortDirectionProp ?? 'ascending' };
  }, [sortColumnProp, sortDirectionProp]);

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
    if (!next || !onSortChange) return;
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

  const emitSelectionChange = (next: string[]) => {
    onSelectedItemsChange?.(next);
    onSelectionChange?.(new Set(next));
  };

  const [selected, setSelected] = useControllable<string[]>(
    controlledSelected,
    defaultSelected,
    emitSelectionChange,
  );

  const [store] = React.useState(() => createSelectionStore(selected));
  useIsomorphicLayoutEffect(() => {
    store.setSelected(selected);
  }, [store, selected]);

  const toggleRow = React.useCallback(
    (rowId: string) => {
      setSelected((previous) => {
        const effective = store.prune(previous);
        const isSelected = effective.includes(rowId);
        let next: string[];
        if (selectionMode === 'single') next = isSelected ? [] : [rowId];
        else next = isSelected ? effective.filter((item) => item !== rowId) : [...effective, rowId];
        return sameItems(next, previous) ? previous : next;
      });
    },
    [selectionMode, setSelected, store],
  );

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
  if (columns && !containsHeader(children)) {
    const childArray = React.Children.toArray(children);
    const captions = childArray.filter((child) => isElementOfType(child, 'caption'));
    const others = childArray.filter((child) => !isElementOfType(child, 'caption'));
    content = (
      <>
        {captions}
        <DataGridHeader>
          <tr>
            {columns.map((column) => (
              <DataGridHeaderCell key={column.id} columnId={column.id} sortable={column.sortable}>
                {column.label}
              </DataGridHeaderCell>
            ))}
          </tr>
        </DataGridHeader>
        {others}
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

function DataGridSelectionHeaderCell({ selectionMode }: { selectionMode: SelectionMode }) {
  const { store, toggleAll } = useDataGridContext('DataGrid.Header');
  const state = React.useSyncExternalStore(
    store.subscribe,
    store.getSelectAllState,
    store.getSelectAllState,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  useIsomorphicLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === 'some';
  }, [state]);

  return (
    <th
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
          onChange={toggleAll}
          className={cn(nativeControl, focusRingInset)}
        />
      ) : (
        <span className="sr-only">Selection</span>
      )}
    </th>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Prepends `selectionCell` (or `null`) to every `<tr>` in `children`, looking inside Fragments.
 * Every row gets the same child shape in every selection mode, so switching `selectionMode` does
 * not remount the header cells.
 */
function withSelectionHeaderCell(
  children: React.ReactNode,
  selectionCell: React.ReactNode,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
      return React.cloneElement(
        child,
        undefined,
        withSelectionHeaderCell(child.props.children, selectionCell),
      );
    }
    if (isElementOfType<{ children?: React.ReactNode }>(child, 'tr')) {
      return React.cloneElement(child, undefined, selectionCell, child.props.children);
    }
    return child;
  });
}

/**
 * The grid's `<thead>`. When the grid is selectable, it prepends the selection column's header
 * cell ("Select all rows" checkbox in multiple mode) to each `<tr>` child, also inside a Fragment.
 * A header row rendered by another component cannot get it (a development warning says so): use
 * `DataGrid.Row` for such a row, which adds the cell itself.
 */
const DataGridHeader = ({ children, className, ref, ...rest }: DataGridHeaderProps) => {
  const { selectionMode } = useDataGridContext('DataGrid.Header');
  const [thead, setThead] = React.useState<HTMLTableSectionElement | null>(null);
  const mergedRef = useMergedRefs<HTMLTableSectionElement>(ref, setThead);
  const content = withSelectionHeaderCell(
    children,
    selectionMode === 'none' ? null : <DataGridSelectionHeaderCell selectionMode={selectionMode} />,
  );

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
      <thead ref={mergedRef} className={cn('bg-card', className)} {...rest}>
        {content}
      </thead>
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
 * `<button type="button">` that toggles the sort; the `<th>` carries `aria-sort`.
 */
const DataGridHeaderCell = ({
  columnId,
  sortable = false,
  children,
  className,
  ref,
  ...rest
}: DataGridHeaderCellProps) => {
  const { sort, requestSort } = useDataGridSortContext('DataGrid.HeaderCell');
  /** The column this header sorts, or `undefined` when it is not sortable. */
  const sortColumnId = sortable && columnId ? columnId : undefined;
  const sortedDirection =
    sortColumnId !== undefined && sort?.columnId === sortColumnId ? sort.direction : null;

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
    >
      {sortColumnId !== undefined ? (
        <button
          type="button"
          onClick={() => requestSort(sortColumnId)}
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
  const inHeader = section === 'header';
  const selectable = selectionMode !== 'none' && !inHeader;
  const labelId = useId('wave-datagrid-row-label');

  const getSelected = React.useCallback(
    () => rowId !== undefined && store.isSelected(rowId),
    [rowId, store],
  );
  const isSelected = React.useSyncExternalStore(store.subscribe, getSelected, getSelected);

  useIsomorphicLayoutEffect(() => {
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
  // always go through `toArray`, whatever the mode, so their keys stay the same when
  // `selectionMode`, `selectionLabel` or `rowId` change and the cells are not remounted.
  let labelledBy: string | undefined;
  const childArray = React.Children.toArray(children);
  let content: React.ReactNode[] = childArray;
  if (unlabelled) {
    const firstCellIndex = childArray.findIndex(
      (child) =>
        isElementOfType(child, DataGridCell) ||
        isElementOfType(child, 'td') ||
        isElementOfType(child, 'th'),
    );
    if (firstCellIndex >= 0) {
      const firstCell = childArray[firstCellIndex] as React.ReactElement<{ id?: string }>;
      labelledBy = firstCell.props.id ?? labelId;
      if (firstCell.props.id === undefined) {
        content = childArray.map((child, index) =>
          index === firstCellIndex ? React.cloneElement(firstCell, { id: labelId }) : child,
        );
      }
    }
  }

  const needsLabel = unlabelled && labelledBy === undefined;
  React.useEffect(() => {
    if (needsLabel) {
      warnOnce(
        'DataGrid.Row:selection-label',
        'DataGrid.Row: the first child is not a cell, so the row selection control is named "Select row". Pass `selectionLabel`.',
      );
    }
  }, [needsLabel]);

  let selectionCellElement: React.ReactNode = null;
  if (inHeader && selectionMode !== 'none') {
    selectionCellElement = <DataGridSelectionHeaderCell selectionMode={selectionMode} />;
  } else if (selectable) {
    selectionCellElement = (
      <td role="gridcell" data-selection-cell="" className={cn(selectionCell, focusRingInset)}>
        {rowId !== undefined && (
          <input
            type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
            name={selectionMode === 'single' ? radioName : undefined}
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

export const DataGrid = /* @__PURE__ */ Object.assign(DataGridRoot, {
  Header: DataGridHeader,
  HeaderCell: DataGridHeaderCell,
  Body: DataGridBody,
  Row: DataGridRow,
  Cell: DataGridCell,
});
