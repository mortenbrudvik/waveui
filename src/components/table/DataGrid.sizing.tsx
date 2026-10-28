import * as React from 'react';
import { flushSync } from 'react-dom';
import { dataGridHeaderCellClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import {
  clampColumnWidth,
  DEFAULT_MIN_COLUMN_WIDTH,
  getColumnEntry,
  initialColumnWidth,
  resolveColumnWidths,
  type ColumnSizingOption,
} from '../../lib/columnSizing';
import { focusRingInset } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { TableResizeHandle } from './Table.resize';
import type { TableColumnWidthsChangeDetails } from './useTableColumnSizing';

// The column sizing of a DataGrid (module-only): its width state, the `<colgroup>`, the table
// style and the resize handle of a header cell. It imports nothing from `DataGrid.tsx`.

/** The width of the selection column in pixels, as its cells draw it. */
export const SELECTION_COLUMN_WIDTH = 40;

/** The state of an uncontrolled grid without defaults until a width is set (identity matters). */
const NO_WIDTHS: Readonly<Record<string, number>> = {};

/** Options of {@link useDataGridColumnSizing}. */
export interface UseDataGridColumnSizingOptions {
  /** Whether the grid lays its columns out from widths (`columns`, `items` and a sizing prop). */
  enabled: boolean;
  /** Whether the header cells of the columns get a resize handle (`resizableColumns`). */
  resizable: boolean;
  /** The id of each column, in the order of `columns` (`undefined` for a column without one). */
  columnIds: readonly (string | undefined)[];
  /** Whether the grid has a selection column, which comes first. */
  selectionColumn: boolean;
  columnSizingOptions: Readonly<Record<string, ColumnSizingOption>> | undefined;
  columnWidths: Record<string, number> | undefined;
  defaultColumnWidths: Record<string, number> | undefined;
  onColumnWidthsChange:
    ((widths: Record<string, number>, details: TableColumnWidthsChangeDetails) => void) | undefined;
  /** `labels.resizeColumn` of the grid. */
  resizeColumnLabel: string | undefined;
  /** `labels.columnWidth` of the grid. */
  columnWidthText: ((width: number) => string) | undefined;
}

/** What a header cell needs to render and wire its column's resize handle. */
export interface DataGridResizeContextValue {
  /** Whether a width is state; until then the browser spreads the grid over its container. */
  isSized: boolean;
  /** The width of each column with an id, in pixels: its state width, else its initial width. */
  widths: Readonly<Record<string, number>>;
  /** The minimum width of each column with an id, in pixels. */
  minWidths: Readonly<Record<string, number>>;
  /** Sets a column's width; the first one of an unresized grid adopts the drawn widths. */
  setColumnWidth: (columnId: string, width: number, event: Event) => void;
  /** Sets a column back to its initial width (nothing while no width is state). */
  resetColumnWidth: (columnId: string, event: Event) => void;
  /** Registers the getter of a column's header cell, measured on the first resize. */
  registerHeaderCell: (columnId: string, getCell: () => Element | null) => () => void;
  /** A drag of the column's handle starts (`data-resizing` on the grid). */
  startDrag: (columnId: string) => void;
  /** A drag of the column's handle ends. */
  endDrag: (columnId: string) => void;
  label: string | undefined;
  valueText: ((width: number) => string) | undefined;
}

/** The handles' context; `null` in a grid whose columns are not resizable. */
export const DataGridResizeContext = React.createContext<DataGridResizeContextValue | null>(null);

/** Whether the grid lays its columns out from widths: its cells then truncate their text. */
export const DataGridFixedLayoutContext = React.createContext(false);

/** The result of {@link useDataGridColumnSizing}. */
export interface DataGridColumnSizing {
  /** The `<colgroup>`, first in the table after a caption; `null` without column sizing. */
  colgroup: React.ReactElement | null;
  /** The table's fixed layout and width; `undefined` without column sizing. */
  tableStyle: React.CSSProperties | undefined;
  /** Whether a handle is being dragged. */
  resizing: boolean;
  /** For the header cells (see {@link DataGridResizeContext}). */
  resizeContext: DataGridResizeContextValue | null;
}

/** The header cells of the columns, by column id, for the measurement of the first resize. */
interface HeaderCellRegistry {
  register(columnId: string, getCell: () => Element | null): () => void;
  get(columnId: string): Element | null;
  /** Any registered cell (its row holds the selection column's header cell). */
  any(): Element | null;
}

function createHeaderCellRegistry(): HeaderCellRegistry {
  const cells = new Map<string, () => Element | null>();
  return {
    register(columnId, getCell) {
      cells.set(columnId, getCell);
      return () => {
        if (cells.get(columnId) === getCell) cells.delete(columnId);
      };
    },
    get: (columnId) => cells.get(columnId)?.() ?? null,
    any() {
      for (const getCell of cells.values()) {
        const cell = getCell();
        if (cell) return cell;
      }
      return null;
    },
  };
}

/** The drawn width of `el`, or 0 when it has none (not rendered, hidden, or no layout). */
function drawnWidth(el: Element | null | undefined): number {
  const width = el ? el.getBoundingClientRect().width : 0;
  return Number.isFinite(width) && width > 0 ? width : 0;
}

/**
 * The width state and the layout of a DataGrid's columns. Widths are controlled (`columnWidths`) or not (`defaultColumnWidths`); until one is state the table is 100%
 * wide and at least as wide as its columns, so the browser spreads a wider container, and from
 * then on it is exactly as wide as its columns. The first change of an unresized grid adopts the
 * widths the columns are drawn at (their header cells measured, the selection column included,
 * every edge rounded once), so nothing moves but the changed column's end edge.
 */
export function useDataGridColumnSizing(
  options: UseDataGridColumnSizingOptions,
): DataGridColumnSizing {
  const {
    enabled,
    resizable,
    columnIds,
    selectionColumn,
    columnSizingOptions,
    columnWidths: columnWidthsProp,
    defaultColumnWidths,
    onColumnWidthsChange,
    resizeColumnLabel,
    columnWidthText,
  } = options;

  const ids = React.useMemo(
    () => columnIds.filter((id): id is string => id !== undefined),
    [columnIds],
  );

  // The details of the change being made, set around the setter: useControllable calls its
  // onChange synchronously inside it, and only on change.
  const detailsRef = React.useRef<TableColumnWidthsChangeDetails | undefined>(undefined);
  const [state, setState, isControlled] = useControllable<Record<string, number>>(
    columnWidthsProp,
    defaultColumnWidths ?? NO_WIDTHS,
    (next) => {
      const details = detailsRef.current;
      if (details) onColumnWidthsChange?.(next, details);
    },
  );
  const isSized = isControlled || defaultColumnWidths !== undefined || state !== NO_WIDTHS;

  const widths = React.useMemo(
    () => resolveColumnWidths(ids, columnSizingOptions, state),
    [ids, columnSizingOptions, state],
  );
  const minWidths = React.useMemo(() => {
    const result: Record<string, number> = {};
    for (const id of ids) {
      result[id] = getColumnEntry(columnSizingOptions, id)?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
    }
    return result;
  }, [ids, columnSizingOptions]);

  /** The width the selection column was drawn at when the grid adopted its drawn widths. */
  const [adoptedSelectionWidth, setAdoptedSelectionWidth] = React.useState<number | null>(null);
  const selectionWidth = isSized
    ? (adoptedSelectionWidth ?? SELECTION_COLUMN_WIDTH)
    : SELECTION_COLUMN_WIDTH;

  const [cells] = React.useState(createHeaderCellRegistry);

  /**
   * The widths the columns are drawn at, from their header cells, in column order and with the
   * selection column first; each edge is rounded once, so the rounding moves none by more than
   * half a pixel. A column whose cell measures nothing keeps the width it has.
   */
  const measureDrawnWidths = () => {
    let exact = 0;
    let rounded = 0;
    const take = (width: number) => {
      exact += width;
      const edge = Math.round(exact);
      const result = edge - rounded;
      rounded = edge;
      return result;
    };
    let selection: number | null = null;
    if (selectionColumn) {
      const row = cells.any()?.parentElement;
      const cell = row?.querySelector(':scope > [data-selection-cell]');
      selection = take(drawnWidth(cell) || SELECTION_COLUMN_WIDTH);
    }
    const drawn: Record<string, number> = {};
    for (const id of columnIds) {
      if (id === undefined) {
        take(initialColumnWidth());
        continue;
      }
      drawn[id] = take(drawnWidth(cells.get(id)) || widths[id]);
    }
    return { widths: drawn, selection };
  };

  const setColumnWidth = useEventCallback((columnId: string, width: number, event: Event) => {
    if (!ids.includes(columnId) || !Number.isFinite(width)) return;
    const clamped = clampColumnWidth(width, getColumnEntry(columnSizingOptions, columnId));
    const drawn = isSized ? null : measureDrawnWidths();
    detailsRef.current = { columnId, width: clamped, event };
    try {
      setState((previous) => {
        // An earlier change of the same event already took the widths as state.
        const sized = isSized || previous !== NO_WIDTHS;
        const next = resolveColumnWidths(
          ids,
          columnSizingOptions,
          sized ? previous : (drawn?.widths ?? previous),
        );
        // The first width taken as state is a change even when it equals the drawn one.
        if (sized && next[columnId] === clamped) return previous;
        next[columnId] = clamped;
        return next;
      });
    } finally {
      detailsRef.current = undefined;
    }
    if (drawn) setAdoptedSelectionWidth(drawn.selection);
  });

  const resetColumnWidth = useEventCallback((columnId: string, event: Event) => {
    // An unresized grid is in its initial layout: there is nothing to reset.
    if (!isSized) return;
    setColumnWidth(
      columnId,
      initialColumnWidth(getColumnEntry(columnSizingOptions, columnId)),
      event,
    );
  });

  const [resizingColumn, setResizingColumn] = React.useState<string | null>(null);
  const startDrag = React.useCallback((columnId: string) => setResizingColumn(columnId), []);
  const endDrag = React.useCallback(
    (columnId: string) => setResizingColumn((current) => (current === columnId ? null : current)),
    [],
  );

  const resizeContext = React.useMemo<DataGridResizeContextValue | null>(
    () =>
      enabled && resizable
        ? {
            isSized,
            widths,
            minWidths,
            setColumnWidth,
            resetColumnWidth,
            registerHeaderCell: cells.register,
            startDrag,
            endDrag,
            label: resizeColumnLabel,
            valueText: columnWidthText,
          }
        : null,
    [
      enabled,
      resizable,
      isSized,
      widths,
      minWidths,
      setColumnWidth,
      resetColumnWidth,
      cells,
      startDrag,
      endDrag,
      resizeColumnLabel,
      columnWidthText,
    ],
  );

  if (!enabled) {
    return { colgroup: null, tableStyle: undefined, resizing: false, resizeContext: null };
  }

  const columnWidthsInOrder = columnIds.map((id) =>
    id === undefined ? initialColumnWidth() : widths[id],
  );
  let total = selectionColumn ? selectionWidth : 0;
  for (const width of columnWidthsInOrder) total += width;

  const colgroup = (
    <colgroup key="wave-colgroup">
      {selectionColumn && <col style={{ width: selectionWidth }} />}
      {columnWidthsInOrder.map((width, index) => (
        <col key={index} style={{ width }} />
      ))}
    </colgroup>
  );

  return {
    colgroup,
    tableStyle: isSized
      ? { tableLayout: 'fixed', width: total }
      : { tableLayout: 'fixed', width: '100%', minWidth: total },
    resizing: resizable && resizingColumn !== null,
    resizeContext,
  };
}

/**
 * The resize handle of a column's header cell. Before any width is state the column is drawn
 * wider than its width when the browser spreads the grid, so the handle measures its cell when it
 * gets focus and when a drag starts (before the drag reads the width), and starts from there.
 */
export function DataGridColumnResizeHandle({
  columnId,
  context,
}: {
  columnId: string;
  context: DataGridResizeContextValue;
}) {
  const {
    isSized,
    widths,
    minWidths,
    setColumnWidth,
    resetColumnWidth,
    registerHeaderCell,
    startDrag,
    endDrag,
    label,
    valueText,
  } = context;
  const handleRef = React.useRef<HTMLDivElement>(null);
  /** The pointer of the drag this handle reported. */
  const pointerRef = React.useRef<number | null>(null);
  const [drawnWidthOfCell, setDrawnWidthOfCell] = React.useState<number | null>(null);

  const getCell = React.useCallback(() => handleRef.current?.closest('th, td') ?? null, []);
  React.useLayoutEffect(
    () => registerHeaderCell(columnId, getCell),
    [registerHeaderCell, columnId, getCell],
  );
  // A drag of a handle that goes away ends with it.
  React.useEffect(() => () => endDrag(columnId), [endDrag, columnId]);

  const measure = () => {
    const width = drawnWidth(getCell());
    if (width > 0) setDrawnWidthOfCell(Math.round(width));
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerRef.current) return;
    pointerRef.current = null;
    endDrag(columnId);
  };

  const width = widths[columnId];
  return (
    <TableResizeHandle
      ref={handleRef}
      width={isSized ? width : (drawnWidthOfCell ?? width)}
      minWidth={minWidths[columnId]}
      label={label}
      valueText={valueText}
      className={cn(
        dataGridHeaderCellClassNames.resizeHandle,
        // The cell clips what overflows it, the outer ring included.
        focusRingInset,
        // The header ignores the pointer while the grid resizes; the dragged handle does not.
        'data-[dragging]:pointer-events-auto',
      )}
      onResize={(next, { event }) => setColumnWidth(columnId, next, event)}
      onReset={({ event }) => resetColumnWidth(columnId, event)}
      onFocus={() => {
        if (!isSized) measure();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        pointerRef.current = event.pointerId;
        if (isSized) {
          startDrag(columnId);
          return;
        }
        // Rendered before the handle reads its width for the drag, right after this handler.
        flushSync(() => {
          measure();
          startDrag(columnId);
        });
      }}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
    />
  );
}
DataGridColumnResizeHandle.displayName = 'DataGridColumnResizeHandle';
