import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Table component. */
export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Whether to apply alternating row background colors.
   * @default false
   */
  striped?: boolean;
  /** Table head, body, and row elements. */
  children: React.ReactNode;
}

/** Properties for the TableHead sub-component. */
export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Table header row elements. */
  children: React.ReactNode;
}

/** Properties for the TableHeadCell sub-component. */
export interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Header cell content. */
  children: React.ReactNode;
}

/** Properties for the TableBody sub-component. */
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Table row elements. */
  children: React.ReactNode;
}

/** Properties for the TableRow sub-component. */
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Table cell elements. */
  children: React.ReactNode;
}

/** Properties for the TableCell sub-component. */
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cell content. */
  children: React.ReactNode;
}

const TableContext = React.createContext<{ striped: boolean }>({ striped: false });

const TableRoot = React.forwardRef<HTMLTableElement, TableProps>(
  ({ striped = false, children, className, ...props }, ref) => {
    return (
      <TableContext.Provider value={{ striped }}>
        <div className="overflow-hidden rounded-lg border border-border">
          <table
            ref={ref}
            className={cn('w-full border-separate border-spacing-0', className)}
            {...props}
          >
            {children}
          </table>
        </div>
      </TableContext.Provider>
    );
  },
);
TableRoot.displayName = 'Table';

const TableHead = React.forwardRef<HTMLTableSectionElement, TableHeadProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <thead ref={ref} {...rest} className={cn('bg-[#fafafa]', className)}>
        {children}
      </thead>
    );
  },
);
TableHead.displayName = 'TableHead';

const TableHeadCell = React.forwardRef<HTMLTableCellElement, TableHeadCellProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        scope="col"
        className={cn(
          'px-4 py-3 text-left font-semibold text-caption-1 uppercase tracking-wider border-b',
          className,
        )}
        {...props}
      >
        {children}
      </th>
    );
  },
);
TableHeadCell.displayName = 'TableHeadCell';

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <tbody ref={ref} {...rest} className={className}>
        {children}
      </tbody>
    );
  },
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ children, className, ...props }, ref) => {
    const { striped } = React.useContext(TableContext);
    return (
      <tr
        ref={ref}
        className={cn(
          'hover:bg-[#f0f0f0] transition-colors',
          striped && 'odd:bg-[#fafafa]',
          className,
        )}
        {...props}
      >
        {children}
      </tr>
    );
  },
);
TableRow.displayName = 'TableRow';

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn('px-4 py-3 text-body-1 border-b border-[#f0f0f0]', className)}
        {...props}
      >
        {children}
      </td>
    );
  },
);
TableCell.displayName = 'TableCell';

export const Table = Object.assign(TableRoot, {
  Head: TableHead,
  HeadCell: TableHeadCell,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
});
