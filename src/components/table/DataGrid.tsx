import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

export type SortDirection = 'ascending' | 'descending';

/** Defines a column in the DataGrid. */
export interface DataGridColumn {
  /** Unique identifier for the column. */
  id: string;
  /** Display label for the column header. */
  label: string;
  /** Whether the column supports sorting. */
  sortable?: boolean;
}

/** Properties for the DataGrid component. */
export interface DataGridProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Column definitions for automatic header rendering. */
  columns?: DataGridColumn[];
  /** Controlled column ID currently being sorted. */
  sortColumn?: string;
  /** Default sort column for uncontrolled usage.
   * @default ''
   */
  defaultSortColumn?: string;
  /** Controlled sort direction. */
  sortDirection?: SortDirection;
  /** Default sort direction for uncontrolled usage.
   * @default 'ascending'
   */
  defaultSortDirection?: SortDirection;
  /** Callback invoked when the sort column or direction changes. */
  onSortChange?: (columnId: string, direction: SortDirection) => void;
  /** Row selection mode.
   * @default 'none'
   */
  selectionMode?: 'none' | 'single' | 'multiple';
  /** Controlled set of selected row keys. */
  selectedKeys?: Set<string>;
  /** Default selected keys for uncontrolled usage. */
  defaultSelectedKeys?: Set<string>;
  /** Callback invoked when the selected rows change. */
  onSelectionChange?: (keys: Set<string>) => void;
  /** DataGrid header, body, and row elements. */
  children: React.ReactNode;
}

/** Properties for the DataGridHeader sub-component. */
export interface DataGridHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Header row elements. */
  children: React.ReactNode;
}

/** Properties for the DataGridHeaderCell sub-component. */
export interface DataGridHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Column ID used for sort tracking. */
  columnId?: string;
  /** Whether this column header supports click-to-sort.
   * @default false
   */
  sortable?: boolean;
  /** Header cell content. */
  children: React.ReactNode;
}

/** Properties for the DataGridBody sub-component. */
export interface DataGridBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** DataGrid row elements. */
  children: React.ReactNode;
}

/** Properties for the DataGridRow sub-component. */
export interface DataGridRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Unique identifier for this row, used for selection tracking. */
  rowId?: string;
  /** DataGrid cell elements. */
  children: React.ReactNode;
}

/** Properties for the DataGridCell sub-component. */
export interface DataGridCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell content. */
  children: React.ReactNode;
}

interface DataGridContextValue {
  sortColumn: string;
  sortDirection: SortDirection;
  handleSort: (columnId: string) => void;
  selectionMode: 'none' | 'single' | 'multiple';
  selectedKeys: Set<string>;
  toggleSelection: (key: string) => void;
  toggleAll: (allKeys: string[]) => void;
}

const DataGridContext = React.createContext<DataGridContextValue>({
  sortColumn: '',
  sortDirection: 'ascending',
  handleSort: () => {},
  selectionMode: 'none',
  selectedKeys: new Set(),
  toggleSelection: () => {},
  toggleAll: () => {},
});

function useDataGridContext() {
  return React.useContext(DataGridContext);
}

const DataGridRoot = React.forwardRef<HTMLTableElement, DataGridProps>(
  (
    {
      sortColumn: sortColumnProp,
      defaultSortColumn,
      sortDirection: sortDirectionProp,
      defaultSortDirection,
      onSortChange,
      selectionMode = 'none',
      selectedKeys: selectedKeysProp,
      defaultSelectedKeys,
      onSelectionChange,
      children,
      className,
      columns: _columns,
      ...rest
    },
    ref,
  ) => {
    const [sortColumn, setSortColumn] = useControllable(
      sortColumnProp,
      defaultSortColumn ?? '',
      undefined,
    );
    const [sortDirection, setSortDirection] = useControllable(
      sortDirectionProp,
      defaultSortDirection ?? 'ascending',
      undefined,
    );
    const [selectedKeys, setSelectedKeys] = useControllable(
      selectedKeysProp,
      defaultSelectedKeys ?? new Set<string>(),
      onSelectionChange,
    );

    const handleSort = React.useCallback(
      (columnId: string) => {
        const newDirection: SortDirection =
          sortColumn === columnId && sortDirection === 'ascending' ? 'descending' : 'ascending';
        setSortColumn(columnId);
        setSortDirection(newDirection);
        onSortChange?.(columnId, newDirection);
      },
      [sortColumn, sortDirection, setSortColumn, setSortDirection, onSortChange],
    );

    const toggleSelection = React.useCallback(
      (key: string) => {
        const next = new Set(selectedKeys);
        if (selectionMode === 'single') {
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.clear();
            next.add(key);
          }
        } else {
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
        }
        setSelectedKeys(next);
      },
      [selectedKeys, selectionMode, setSelectedKeys],
    );

    const toggleAll = React.useCallback(
      (allKeys: string[]) => {
        if (selectedKeys.size === allKeys.length) {
          setSelectedKeys(new Set());
        } else {
          setSelectedKeys(new Set(allKeys));
        }
      },
      [selectedKeys, setSelectedKeys],
    );

    const ctx = React.useMemo<DataGridContextValue>(
      () => ({
        sortColumn,
        sortDirection,
        handleSort,
        selectionMode,
        selectedKeys,
        toggleSelection,
        toggleAll,
      }),
      [
        sortColumn,
        sortDirection,
        handleSort,
        selectionMode,
        selectedKeys,
        toggleSelection,
        toggleAll,
      ],
    );

    return (
      <DataGridContext.Provider value={ctx}>
        <div className="overflow-hidden rounded-lg border border-border">
          <table
            ref={ref}
            role="grid"
            className={cn('w-full border-separate border-spacing-0', className)}
            {...rest}
          >
            {children}
          </table>
        </div>
      </DataGridContext.Provider>
    );
  },
);
DataGridRoot.displayName = 'DataGrid';

const DataGridHeader = React.forwardRef<HTMLTableSectionElement, DataGridHeaderProps>(
  ({ children, className, ...rest }, ref) => (
    <thead ref={ref} className={cn('bg-[#fafafa]', className)} {...rest}>
      {children}
    </thead>
  ),
);
DataGridHeader.displayName = 'DataGridHeader';

const DataGridHeaderCell = React.forwardRef<HTMLTableCellElement, DataGridHeaderCellProps>(
  ({ columnId, sortable = false, children, className, ...rest }, ref) => {
    const { sortColumn, sortDirection, handleSort } = useDataGridContext();
    const isSorted = columnId != null && sortColumn === columnId;

    const handleClick = () => {
      if (sortable && columnId) {
        handleSort(columnId);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (sortable && columnId && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleSort(columnId);
      }
    };

    return (
      <th
        ref={ref}
        scope="col"
        className={cn(
          'px-4 py-3 text-left font-semibold text-caption-1 uppercase tracking-wider border-b',
          sortable && 'cursor-pointer select-none hover:bg-[#f0f0f0]',
          className,
        )}
        aria-sort={sortable ? (isSorted ? sortDirection : 'none') : undefined}
        tabIndex={sortable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {isSorted && (
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              {sortDirection === 'ascending' ? (
                <path d="M6 2L10 8H2L6 2Z" />
              ) : (
                <path d="M6 10L2 4H10L6 10Z" />
              )}
            </svg>
          )}
        </span>
      </th>
    );
  },
);
DataGridHeaderCell.displayName = 'DataGridHeaderCell';

const DataGridBody = React.forwardRef<HTMLTableSectionElement, DataGridBodyProps>(
  ({ children, className, ...rest }, ref) => (
    <tbody ref={ref} className={className} {...rest}>
      {children}
    </tbody>
  ),
);
DataGridBody.displayName = 'DataGridBody';

const DataGridRow = React.forwardRef<HTMLTableRowElement, DataGridRowProps>(
  ({ rowId, children, className, ...rest }, ref) => {
    const { selectionMode, selectedKeys, toggleSelection } = useDataGridContext();
    const isSelected = rowId != null && selectedKeys.has(rowId);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (selectionMode !== 'none' && rowId && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        toggleSelection(rowId);
      }
    };

    return (
      <tr
        ref={ref}
        className={cn(
          'hover:bg-[#f0f0f0] transition-colors',
          isSelected && 'bg-[#e8f4fd]',
          className,
        )}
        aria-selected={selectionMode !== 'none' ? isSelected : undefined}
        tabIndex={selectionMode !== 'none' ? 0 : undefined}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {selectionMode !== 'none' && (
          <td className="w-10 px-3 py-3 border-b border-[#f0f0f0]">
            <input
              type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
              checked={isSelected}
              onChange={() => rowId && toggleSelection(rowId)}
              aria-label={`Select row ${rowId}`}
              className="accent-[#0f6cbd]"
            />
          </td>
        )}
        {children}
      </tr>
    );
  },
);
DataGridRow.displayName = 'DataGridRow';

const DataGridCell = React.forwardRef<HTMLTableCellElement, DataGridCellProps>(
  ({ children, className, ...rest }, ref) => (
    <td
      ref={ref}
      className={cn('px-4 py-3 text-body-1 border-b border-[#f0f0f0]', className)}
      {...rest}
    >
      {children}
    </td>
  ),
);
DataGridCell.displayName = 'DataGridCell';

export const DataGrid = Object.assign(DataGridRoot, {
  Header: DataGridHeader,
  HeaderCell: DataGridHeaderCell,
  Body: DataGridBody,
  Row: DataGridRow,
  Cell: DataGridCell,
});
