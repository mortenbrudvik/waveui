import * as React from 'react';
import { isElementOfType } from '../../lib/children';
import { tableClassNames } from '../../lib/classNames';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';

// The row window of a static Table with a `virtualWindow` (module-only): the contexts of the
// window and of each row, the spacer rows and the numbering of the rows the table does not render
// through the window (its header and footer rows). It imports nothing from `Table.tsx`.

/** What `Table.Header` and `Table.Body` read in a windowed table; `null` in a table without one. */
export interface TableWindowContextValue {
  virtualWindow: VirtualWindow;
  /** The header rows above the body rows (the first body row's `aria-rowindex` is one more). */
  headerRowCount: number;
  /** The table's `striped`: in a window the rows draw their stripe from their index. */
  striped: boolean;
}

/** The window of the table around the caller (reset by no one: a nested table has its own). */
export const TableWindowContext = React.createContext<TableWindowContextValue | null>(null);

/** The place of a row in a windowed table; `null` for a row of a table that renders every row. */
export interface TableWindowRow {
  /** A body row's 0-based position in `count` (`data-row-index`); `undefined` in a header or footer. */
  index: number | undefined;
  /** The row's `aria-rowindex`: 1-based, the header rows first. */
  ariaRowIndex: number;
  /** The height of a body row in pixels (the window's `itemSize`); `undefined` in a header or footer. */
  height: number | undefined;
  /** Whether the row draws the table's stripe (a body row of an even index of a striped table). */
  striped?: boolean;
}

/** The place of the row around the caller (see {@link TableWindowRow}). */
export const TableWindowRowContext = React.createContext<TableWindowRow | null>(null);

/**
 * A row that stands in for the body rows of a windowed table that are not rendered: as tall as they
 * are and out of the accessibility tree. Its single empty cell has no box of its own, so it adds
 * nothing to the columns.
 */
export function TableSpacerRow({ size }: { size: number }) {
  return (
    <tr
      aria-hidden="true"
      data-virtual-spacer=""
      className={tableClassNames.spacer}
      style={{ height: size }}
    >
      <td className="wave:p-0" />
    </tr>
  );
}
TableSpacerRow.displayName = 'TableSpacerRow';

/** The number of rows in `children` as the window counts them: every element child. */
export function countRows(children: React.ReactNode): number {
  let count = 0;
  const visit = (nodes: React.ReactNode) =>
    React.Children.forEach(nodes, (child) => {
      if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
        visit(child.props.children);
      } else if (React.isValidElement(child)) {
        count += 1;
      }
    });
  visit(children);
  return count;
}

/**
 * The rows of a windowed table's header or footer with their `aria-rowindex`, counted from `first`:
 * every element child (also inside a Fragment) is one row, a `<tr>` takes the attribute and any
 * other element (a `Table.Row`) the row's place through its context.
 */
export function withRowIndexes(children: React.ReactNode, first: number): React.ReactNode {
  let position = first;
  const visit = (nodes: React.ReactNode): React.ReactNode =>
    React.Children.map(nodes, (child) => {
      if (isElementOfType<{ children?: React.ReactNode }>(child, React.Fragment)) {
        return React.cloneElement(child, undefined, visit(child.props.children));
      }
      if (!React.isValidElement(child)) return child;
      const ariaRowIndex = position;
      position += 1;
      if (isElementOfType<React.HTMLAttributes<HTMLTableRowElement>>(child, 'tr')) {
        return React.cloneElement(child, { 'aria-rowindex': ariaRowIndex });
      }
      return (
        <TableWindowRowContext.Provider
          value={{ index: undefined, ariaRowIndex, height: undefined }}
        >
          {child}
        </TableWindowRowContext.Provider>
      );
    });
  return visit(children);
}
