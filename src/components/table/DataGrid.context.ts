import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { SelectionMode } from '../../lib/types';
import { createSelectionStore, type SelectionStore } from './DataGrid.store';
import type {
  DataGridRowSelectionCellProps,
  DataGridSelectionAppearance,
  DataGridSort,
} from './DataGrid';

export const DEFAULT_SELECT_ALL_LABEL = 'Select all rows';
export const DEFAULT_SELECTION_HEADER_LABEL = 'Selection';

// ---------------------------------------------------------------------------
// Header selection slots
// ---------------------------------------------------------------------------

/**
 * The selection column's header slots of one `DataGrid.Header`, one per header row. Only the first
 * slot in document order renders the "Select all rows" control (the "Selection" text in single
 * mode); the others render an empty cell, so a grouped header (several header rows) has one control
 * and every header row keeps the selection column.
 */
export interface HeaderSlotRegistry {
  subscribe(listener: () => void): () => void;
  /** Registers a slot and a getter for its current cell; returns the unregister function. */
  register(slot: object, getCell: () => Element | null): () => void;
  /** The first slot in document order, or `null` while no slot is registered. */
  getFirst(): object | null;
  /** Re-checks the order: header rows can move without a slot mounting or unmounting. */
  refresh(): void;
}

export function createHeaderSlotRegistry(): HeaderSlotRegistry {
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

export interface DataGridContextValue {
  selectionMode: 'none' | SelectionMode;
  store: SelectionStore;
  /** Toggles one row (single mode: selects it alone, or clears it); `event` goes to `details`. */
  toggleRow: (rowId: string, event: Event) => void;
  /**
   * Selects every row select-all changes (with `items`, every selectable item, rendered or not),
   * or clears them when all are selected.
   */
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
export interface DataGridRowContextValue {
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

export interface DataGridSortContextValue {
  sort: DataGridSort | null;
  /** Sorts by the column (toggling its direction); `event` goes to `details`. */
  requestSort: (columnId: string, event: Event) => void;
}

export type DataGridSection = 'header' | 'body';

export const DataGridContext = React.createContext<DataGridContextValue | null>(null);
export const DataGridSortContext = React.createContext<DataGridSortContextValue | null>(null);
/** Whether a row is rendered in the header or the body (rows in a header get a header cell). */
export const DataGridSectionContext = React.createContext<DataGridSection>('body');
/** The header's selection slots (see {@link HeaderSlotRegistry}). */
export const DataGridHeaderSlotsContext = React.createContext<HeaderSlotRegistry | null>(null);
/**
 * Whether the header row below is the header's first row, as far as the header can tell from its
 * children. Only the initial (and server) render uses it; the slots then follow the DOM order.
 */
export const DataGridHeaderRowHintContext = React.createContext(true);

/** Renders the row of one item of `items` (a `DataGrid.Body` render function, or from `columns`). */
export type DataGridRenderRow = (item: unknown, index: number) => React.ReactNode;

/** One row of the grid's `items`. */
export interface DataGridItemRowData {
  item: unknown;
  /** The item's index in `items`. */
  index: number;
  rowId: string;
  /** The row's React key: its row id, made unique when the id repeats. */
  key: string;
}

export interface DataGridItemsContextValue {
  /** The rows of `items`, in the order they are rendered; `null` without `items`. */
  rows: readonly DataGridItemRowData[] | null;
  /** Renders a row from `columns`; `null` without `items` and `columns`. */
  renderColumnsRow: DataGridRenderRow | null;
  /**
   * `isSelectionDisabled` of each item, by its index in `items`; `null` without `items` or
   * without `isSelectionDisabled`.
   */
  selectionDisabled: readonly boolean[] | null;
}

/** The grid's `items`, for `DataGrid.Body` (optional: a body of JSX rows needs none). */
export const DataGridItemsContext = React.createContext<DataGridItemsContextValue | null>(null);
/**
 * The row id of the item a body row is rendered for, the default `rowId` of `DataGrid.Row`. The
 * grid resets it, so the rows of a grid nested in a cell do not take the outer row's id.
 */
export const DataGridRowIdContext = React.createContext<string | null>(null);
/**
 * `isSelectionDisabled` of the item a body row is rendered for, the default `disabled` of the
 * row's selection cell; `undefined` without it. The grid resets it, as {@link DataGridRowIdContext}.
 */
export const DataGridItemSelectionDisabledContext = React.createContext<boolean | undefined>(
  undefined,
);
/** The row around a selection cell (see {@link DataGridRowContextValue}). */
export const DataGridRowContext = React.createContext<DataGridRowContextValue | null>(null);

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

export function useDataGridContext(component: string): DataGridContextValue {
  const ctx = React.useContext(DataGridContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid');
  return INERT_CONTEXT;
}

export function useDataGridRowContext(component: string): DataGridRowContextValue {
  const ctx = React.useContext(DataGridRowContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid.Row');
  return INERT_ROW_CONTEXT;
}

export function useDataGridSortContext(component: string): DataGridSortContextValue {
  const ctx = React.useContext(DataGridSortContext);
  if (ctx) return ctx;
  reportMissingContext(component, 'DataGrid');
  return INERT_SORT_CONTEXT;
}
