import * as React from 'react';
import { dataGridClassNames } from '../../lib/classNames';
import { isDev, warnOnce } from '../../lib/dev';
import { useEventCallback } from '../../hooks/useEventCallback';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { returnFocusToGridCell, type GridNavigationModel } from './useGridNavigation';

// The row window of a DataGrid with a `virtualWindow` (module-only): the navigation model, the
// contexts of the window and of each row, the spacer rows, the scroller check, and the focus that
// a data change must not lose. It imports nothing from `DataGrid.tsx`.

/** What the body and the header of a windowed grid read; `null` in a grid that renders every row. */
export interface DataGridWindowContextValue {
  virtualWindow: VirtualWindow;
  /** The data rows kept rendered outside the window: the active row and a row a key awaits. */
  keep: readonly number[];
  /** The header rows above the data rows (the first data row's `aria-rowindex` is one more). */
  headerRowCount: number;
  /** The columns of the table, the selection column included: what a spacer's cell spans. */
  columnCount: number;
}

/** The window of the grid, for its body and header (reset by every grid, so nested grids own theirs). */
export const DataGridWindowContext = React.createContext<DataGridWindowContextValue | null>(null);

/** The place of a row in a windowed grid; `null` for a row of a grid that renders every row. */
export interface DataGridWindowRow {
  /** A data row's 0-based position in the sorted order (`data-row-index`); `undefined` in the header. */
  index: number | undefined;
  /** The row's `aria-rowindex`: 1-based, the header rows first. */
  ariaRowIndex: number;
  /** The height of a data row in pixels (the window's `itemSize`); `undefined` in the header. */
  height: number | undefined;
}

/** The place of the row around it (see {@link DataGridWindowRow}). */
export const DataGridWindowRowContext = React.createContext<DataGridWindowRow | null>(null);

/** The navigation model of a windowed grid (its rows by their index in the sorted data). */
export function getWindowNavigationModel(
  virtualWindow: VirtualWindow | null,
  rowCount: number,
  headerRowCount: number,
): GridNavigationModel | undefined {
  if (!virtualWindow) return undefined;
  return {
    rowCount,
    headerRowCount,
    scrollToRow: (index) => virtualWindow.scrollToIndex(index, { align: 'auto' }),
  };
}

/**
 * A row that stands in for the rows of a windowed grid that are not rendered: as tall as they
 * are, out of the accessibility tree, with one cell over every column and no focus target.
 */
export function DataGridSpacerRow({ size, columnCount }: { size: number; columnCount: number }) {
  return (
    <tr
      aria-hidden="true"
      data-virtual-spacer=""
      className={dataGridClassNames.spacer}
      style={{ height: size }}
    >
      <td colSpan={columnCount} className="p-0" />
    </tr>
  );
}
DataGridSpacerRow.displayName = 'DataGridSpacerRow';

/**
 * The body rows of a windowed grid of `count` data rows: the window's layout, each of its rows
 * rendered by `renderRow(index)` (which keys it) and each gap as a spacer row.
 */
export function renderWindowRows(
  context: DataGridWindowContextValue,
  count: number,
  renderRow: (index: number) => React.ReactNode,
): React.ReactNode[] {
  return context.virtualWindow
    .layout(count, { keep: context.keep })
    .map((entry) =>
      entry.kind === 'item' ? (
        renderRow(entry.index)
      ) : (
        <DataGridSpacerRow key={entry.key} size={entry.size} columnCount={context.columnCount} />
      ),
    );
}

/** The data row index a row carries, or `null` (a header or spacer row). */
function getRowIndex(row: Element | null): number | null {
  const value = row?.getAttribute('data-row-index');
  return value != null && /^\d+$/.test(value) ? Number(value) : null;
}

/** The cell of `table` (not of a table nested in it) that holds `node`. */
function getOwnCell(
  table: HTMLTableElement,
  node: EventTarget | null,
): HTMLTableCellElement | null {
  for (let el = node instanceof Element ? node : null; el && el !== table; el = el.parentElement) {
    if ((el.localName === 'td' || el.localName === 'th') && el.closest('table') === table) {
      return el as HTMLTableCellElement;
    }
  }
  return null;
}

/** Whether focus is nowhere: on the body, on the scroller, or on an element no longer in the page. */
function isFocusLost(active: Element | null, scroller: Element | null): boolean {
  if (!active || !active.isConnected) return true;
  const doc = active.ownerDocument;
  return active === doc.body || active === doc.documentElement || active === scroller;
}

/** The focused cell of a data row: the row's id, its index then and the cell's place in the row. */
interface FocusedCell {
  rowId: string;
  index: number;
  column: number;
}

/** Options of {@link useDataGridWindow}. */
export interface UseDataGridWindowOptions {
  /**
   * The grid's window while it applies (`items`, `columns`, the body rows rendered from them);
   * otherwise `null`.
   */
  virtualWindow: VirtualWindow | null;
  /** Whether a `virtualWindow` was given that does not apply (a development warning). */
  ignored: boolean;
  /** The rows of `items` in the sorted order; `null` without `items`. */
  rows: readonly { rowId: string }[] | null;
  headerRowCount: number;
  columnCount: number;
  /** `activeRowIndex` and `pendingRowIndex` of the grid navigation: the rows to keep rendered. */
  activeRowIndex: number | null;
  pendingRowIndex: number | null;
}

/** The result of {@link useDataGridWindow}. */
export interface DataGridWindowState {
  /** For {@link DataGridWindowContext}; `null` while the window does not apply. */
  context: DataGridWindowContextValue | null;
  /** The scroll wrapper's ref (merge it with the window's `scrollRef`). */
  scrollerRef: React.RefCallback<HTMLDivElement>;
  /** The table's ref. */
  tableRef: React.RefCallback<HTMLTableElement>;
  /** Composed after the grid navigation's own focus handlers. */
  onFocus: (event: React.FocusEvent<HTMLTableElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLTableElement>) => void;
}

/**
 * The window of a DataGrid: the context its body renders the window from, the development checks
 * (a window that does not apply, a scroller without a bounded height), a focused row that the
 * sticky header covers scrolled below it, and focus kept through data changes. A sort, a filter
 * or new `items` move the keyed rows, and a browser blurs a focused row that is moved (or
 * removed): when focus was in a data row before such a change and is lost after it, focus goes
 * back to the same row (by id) and column, else to the mounted row nearest to its old index.
 */
export function useDataGridWindow(options: UseDataGridWindowOptions): DataGridWindowState {
  const {
    virtualWindow,
    ignored,
    rows,
    headerRowCount,
    columnCount,
    activeRowIndex,
    pendingRowIndex,
  } = options;
  const enabled = virtualWindow !== null;
  // Written by the ref callbacks; read in effects and handlers only.
  const scrollerElementRef = React.useRef<HTMLDivElement | null>(null);
  const tableElementRef = React.useRef<HTMLTableElement | null>(null);
  const scrollerRef = React.useCallback((element: HTMLDivElement | null) => {
    scrollerElementRef.current = element;
  }, []);
  const tableRef = React.useCallback((element: HTMLTableElement | null) => {
    tableElementRef.current = element;
  }, []);

  const keep = React.useMemo(
    () => [activeRowIndex, pendingRowIndex].filter((index): index is number => index !== null),
    [activeRowIndex, pendingRowIndex],
  );
  const context = React.useMemo<DataGridWindowContextValue | null>(
    () => (virtualWindow ? { virtualWindow, keep, headerRowCount, columnCount } : null),
    [virtualWindow, keep, headerRowCount, columnCount],
  );

  React.useEffect(() => {
    if (ignored) {
      warnOnce(
        'DataGrid:virtual-window-requires-items',
        'DataGrid: `virtualWindow` needs `items` and `columns`, with the body rows rendered from ' +
          'them (no `DataGrid.Body` child, or one whose child is a render function); it is ' +
          'ignored, and every row is rendered.',
      );
    }
  }, [ignored]);

  // Once mounted: a scroller as tall as its rows (no bounded height) lets the window measure the
  // whole list, so it would render every row. Read while the first window still has spacers.
  React.useEffect(() => {
    const scroller = scrollerElementRef.current;
    const tableElement = tableElementRef.current;
    if (!isDev || !enabled || !scroller || !tableElement) return;
    const { clientHeight, scrollHeight } = scroller;
    const hasSpacer = Array.from(tableElement.tBodies).some((body) =>
      Array.from(body.rows).some((row) => row.hasAttribute('data-virtual-spacer')),
    );
    // As tall as the table: a bounded scroller taller than all its rows is not one.
    const followsContent = tableElement.offsetHeight >= clientHeight;
    if (
      clientHeight > 0 &&
      scrollHeight > 0 &&
      scrollHeight <= clientHeight &&
      followsContent &&
      hasSpacer
    ) {
      warnOnce(
        'DataGrid:virtual-window-height',
        'DataGrid: the scroll wrapper of a grid with `virtualWindow` has no bounded height (it is ' +
          'as tall as its rows), so the window renders every row. Give it a height or a maximum ' +
          'height in `containerProps` (a class or a style).',
      );
    }
  }, [enabled]);

  // --- focus through data changes ---------------------------------------------
  /**
   * The rows of the commit, for the row id of a focused row and the restore: written before the
   * layout effects, where the grid navigation may focus a row of the new rows.
   */
  const rowsRef = React.useRef(rows);
  React.useInsertionEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  /** The rows the data-change check last saw. */
  const checkedRowsRef = React.useRef(rows);
  /** The focused cell of a data row, while focus is in one (or was, until that is decided). */
  const focusedRef = React.useRef<FocusedCell | null>(null);
  /** Set by a data change that left focus on a moved row, until the next frame or focus move. */
  const armedRef = React.useRef(false);
  const frameRef = React.useRef<number | null>(null);

  const disarm = React.useCallback(() => {
    armedRef.current = false;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  // A blur that comes after the change (a browser that blurs the moved row once it renders) is
  // taken as the change's, until the next frame.
  const arm = React.useCallback(() => {
    disarm();
    armedRef.current = true;
    if (typeof requestAnimationFrame === 'function') {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        armedRef.current = false;
      });
    }
  }, [disarm]);

  React.useEffect(() => disarm, [disarm]);

  /** Focuses the cell of `focused`: its row by id, else the mounted row nearest to its index. */
  const restore = useEventCallback((focused: FocusedCell) => {
    const tableElement = tableElementRef.current;
    if (!tableElement) return;
    const data = rowsRef.current ?? [];
    const dataRows = Array.from(tableElement.rows).filter((row) => getRowIndex(row) !== null);
    const position = data.findIndex((row) => row.rowId === focused.rowId);
    let row = dataRows.find((each) => position >= 0 && getRowIndex(each) === position) ?? null;
    if (!row && data.length > 0) {
      const target = Math.min(focused.index, data.length - 1);
      let distance = Infinity;
      for (const each of dataRows) {
        const gap = Math.abs((getRowIndex(each) ?? 0) - target);
        if (gap < distance) {
          row = each;
          distance = gap;
        }
      }
    }
    // No data row left: the first cell of the grid.
    const target = row ?? tableElement.rows[0];
    if (!target || target.cells.length === 0) return;
    const column = row ? Math.min(focused.column, target.cells.length - 1) : 0;
    returnFocusToGridCell(target.cells[column]);
  });

  // After a data change (the rows' identity: `items`, `getRowId`, the sort).
  React.useLayoutEffect(() => {
    const previous = checkedRowsRef.current;
    checkedRowsRef.current = rows;
    const tableElement = tableElementRef.current;
    const focused = focusedRef.current;
    if (previous === rows || !enabled || !tableElement || !focused) return;
    const active = tableElement.ownerDocument.activeElement;
    if (active && tableElement.contains(active)) arm();
    else if (isFocusLost(active, scrollerElementRef.current)) restore(focused);
    else focusedRef.current = null;
  }, [rows, enabled, arm, restore]);

  const onFocus = useEventCallback((event: React.FocusEvent<HTMLTableElement>) => {
    if (!virtualWindow) return;
    disarm();
    const cell = getOwnCell(event.currentTarget, event.target);
    const row = cell?.parentElement ?? null;
    const index = getRowIndex(row);
    const rowId = index === null ? undefined : rowsRef.current?.[index]?.rowId;
    focusedRef.current =
      cell && row instanceof HTMLTableRowElement && index !== null && rowId !== undefined
        ? { rowId, index, column: Array.prototype.indexOf.call(row.cells, cell) }
        : null;
    // A browser scrolls a focused row to the top edge of the scroller, under the sticky header:
    // bring it into the area below the header (a row in view does not move).
    if (index !== null) virtualWindow.scrollToIndex(index, { align: 'auto' });
  });

  const onBlur = useEventCallback((event: React.FocusEvent<HTMLTableElement>) => {
    if (!virtualWindow) return;
    const tableElement = event.currentTarget;
    const next = event.relatedTarget;
    if (next && tableElement.contains(next)) return;
    if (next) {
      focusedRef.current = null;
      disarm();
      return;
    }
    // Focus went nowhere: a click on nothing focusable, or a row the browser blurred because a
    // data change moved or removed it. Decided once the change has settled.
    const scroller = scrollerElementRef.current;
    queueMicrotask(() => {
      const focused = focusedRef.current;
      if (!focused || !tableElement.isConnected) return;
      const active = tableElement.ownerDocument.activeElement;
      if (active && tableElement.contains(active)) return;
      const restoring = armedRef.current && isFocusLost(active, scroller);
      disarm();
      if (restoring) restore(focused);
      else focusedRef.current = null;
    });
  });

  return { context, scrollerRef, tableRef, onFocus, onBlur };
}
