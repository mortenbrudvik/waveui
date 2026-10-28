import * as React from 'react';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { FOCUSABLE_SELECTOR, getFirstTabbable, isFocusable, isFocused } from '../../lib/focus';

/**
 * The data behind the rows of a windowed grid, whose rows are mounted only in part (see
 * {@link UseGridNavigationOptions.model}). Each mounted data row carries its 0-based index in the
 * data as `data-row-index`.
 */
export interface GridNavigationModel {
  /** How many data rows there are, mounted or not. */
  rowCount: number;
  /**
   * How many header rows are above the data rows: the first rows of the grid without a
   * `data-row-index` (they stay mounted). Other rows without one, such as the spacer rows of a
   * window, are not navigated.
   */
  headerRowCount: number;
  /**
   * Brings data row `index` into the mounted rows (scrolls the window to it). Called once for each
   * row a key moves focus to that is not mounted; focus moves to the row's cell in the commit that
   * mounts it. Ctrl+Home in a grid with header rows also calls it for row 0, so the first rows
   * show under the header.
   */
  scrollToRow(index: number): void;
}

/** Options of {@link useGridNavigation}. */
export interface UseGridNavigationOptions {
  /**
   * How many rows PageUp and PageDown move focus.
   * @default 10
   */
  pageSize?: number;
  /**
   * The data of a windowed grid (DataGrid with a virtual window). ArrowUp/ArrowDown,
   * PageUp/PageDown and Ctrl+Home/Ctrl+End then move by the rows of the data: a target row that is
   * not mounted is asked for with `scrollToRow` and focused when it mounts. The active row is kept
   * by its index (see {@link UseGridNavigationResult.activeRowIndex}). Without it, the mounted
   * rows are the whole grid.
   */
  model?: GridNavigationModel;
}

/** Handlers {@link useGridNavigation} needs on the grid element (compose them with the consumer's). */
export interface GridNavigationHandlers {
  onKeyDown: React.KeyboardEventHandler<HTMLTableElement>;
  onFocus: React.FocusEventHandler<HTMLTableElement>;
  onBlur: React.FocusEventHandler<HTMLTableElement>;
}

/** Result of {@link useGridNavigation}. */
export interface UseGridNavigationResult {
  /** Callback ref for the `<table role="grid">` element. Stable identity. */
  gridRef: React.RefCallback<HTMLTableElement>;
  /** Keyboard and focus handlers for the grid element. Stable identities. */
  gridProps: GridNavigationHandlers;
  /**
   * With a `model`: the `data-row-index` of the active cell's row, the row that holds the grid's
   * tab stop (or takes it back once it is mounted again), so the owner keeps that row mounted.
   * `null` on a header row, and always `null` without a model. A change re-renders the owner.
   */
  activeRowIndex: number | null;
  /**
   * With a `model`: the index of the data row a key moved focus to while it is not mounted (asked
   * for with `scrollToRow`); focus moves there in the commit that mounts it, so the owner keeps it
   * mounted too. `null` when no row is awaited, and always `null` without a model. A change
   * re-renders the owner.
   */
  pendingRowIndex: number | null;
}

/** Input types that do not take arrow or character keys, so a lone one can be a cell's focus target. */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
  'file',
  'color',
]);

/** Widget roles that use arrow or character keys themselves (treated like text entry). */
const KEY_CONSUMING_ROLES: ReadonlySet<string> = new Set([
  'textbox',
  'searchbox',
  'combobox',
  'spinbutton',
  'slider',
]);

/**
 * Roles of composite widgets that manage their own children (and usually their tab indexes): an
 * element with one of them, or with `data-roving-container`, is a nested composite. Close to the
 * list of `useRovingTabIndex`, which is kept separately and differs on purpose: here a `toolbar`
 * is a composite (a toolbar in a cell is one widget), while `spinbutton` is not (it is one
 * focusable control that uses the arrow keys, handled by `KEY_CONSUMING_ROLES` like a text
 * field). Keep both lists in mind when adding a role.
 */
const COMPOSITE_ROLES: readonly string[] = [
  'toolbar',
  'radiogroup',
  'listbox',
  'grid',
  'treegrid',
  'tablist',
  'menu',
  'menubar',
  'tree',
];

const COMPOSITE_SELECTOR = [
  '[data-roving-container]',
  ...COMPOSITE_ROLES.map((role) => `[role="${role}"]`),
].join(', ');

/** Every element that can be a cell widget: a focusable element or a nested composite root. */
const WIDGET_CANDIDATE_SELECTOR = `${FOCUSABLE_SELECTOR}, ${COMPOSITE_SELECTOR}`;

/**
 * Marks an auxiliary widget (a column's resize handle): a widget of its cell that never decides the
 * cell's target and is entered with F2.
 */
const AUXILIARY_ATTRIBUTE = 'data-grid-auxiliary';

/** The attribute of a windowed grid's data rows that holds their 0-based index in the data. */
const ROW_INDEX_ATTRIBUTE = 'data-row-index';

/**
 * Attributes whose changes can change a cell's widgets or the grid's rows. `aria-selected` on a row
 * signals a selection change, which can change the active cell's target (radio groups). A row's
 * index changes in place when rows keyed by id are shown at other indexes (items inserted above).
 */
const OBSERVED_ATTRIBUTES = [
  'disabled',
  'tabindex',
  'hidden',
  'inert',
  'type',
  'contenteditable',
  'role',
  'data-roving-container',
  'aria-selected',
  AUXILIARY_ATTRIBUTE,
  ROW_INDEX_ATTRIBUTE,
];

/**
 * Whether `el` is a text-entry control (or another widget that uses arrow keys itself): a text-like
 * `input`, `textarea`, `select`, a `contenteditable` element, or an element with role textbox,
 * searchbox, combobox, spinbutton or slider. Such widgets are never a cell's navigation target: the
 * cell takes focus and Enter/F2 moves into the widget, so the arrow keys keep moving the caret.
 */
export function isTextEntryElement(el: Element): boolean {
  const tag = el.localName;
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  const editable = el.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') return true;
  const role = el.getAttribute('role');
  return role !== null && KEY_CONSUMING_ROLES.has(role);
}

/** Whether `el` is a nested composite widget (own roving container or a composite role). */
function isNestedComposite(el: Element): boolean {
  return el.matches(COMPOSITE_SELECTOR);
}

/** Whether `node` is strictly inside a nested composite of `grid` (the composite root excluded). */
function isInsideNestedComposite(node: Element, grid: HTMLTableElement): boolean {
  if (node === grid) return false;
  for (let el = node.parentElement; el && el !== grid; el = el.parentElement) {
    if (isNestedComposite(el)) return true;
  }
  return false;
}

/**
 * The element a nested composite is entered at: its own tab stop (`tabindex="0"`), else its first
 * tabbable element (the root itself when it is the focusable element).
 */
function getCompositeEntry(composite: HTMLElement): HTMLElement | null {
  const stop = composite.querySelector<HTMLElement>('[tabindex="0"]');
  if (stop && isFocusable(stop)) return stop;
  return getFirstTabbable(composite, { includeContainer: true });
}

/**
 * A cheap focusability check for cells that do not hold the tab stop: no style reads, only the
 * attributes that take an element out of the focus order. The cell that holds (or receives) the tab
 * stop is checked precisely with `isFocusable`.
 */
function isLikelyFocusable(el: HTMLElement): boolean {
  if (el.localName === 'input' && (el as HTMLInputElement).type === 'hidden') return false;
  if (el.matches(':disabled')) return false;
  return el.closest('[hidden], [inert]') === null;
}

/** Whether another radio of `radio`'s named group is checked (the browser's tab stop of the group). */
function hasCheckedPeer(radio: HTMLInputElement): boolean {
  if (!radio.name) return false;
  const root = radio.getRootNode() as Document | ShadowRoot;
  if (typeof root.querySelectorAll !== 'function') return false;
  const checked = root.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked');
  for (const other of Array.from(checked)) {
    if (other !== radio && other.name === radio.name && other.form === radio.form) return true;
  }
  return false;
}

function isCellElement(el: Element): el is HTMLTableCellElement {
  return el.localName === 'td' || el.localName === 'th';
}

/** The cell of `grid` that contains `node` (a nested table's cells belong to the outer cell). */
function getCell(grid: HTMLTableElement, node: EventTarget | null): HTMLTableCellElement | null {
  let el: Element | null = node instanceof Element ? node : null;
  while (el && el !== grid) {
    if (isCellElement(el) && el.closest('table') === grid) return el;
    el = el.parentElement;
  }
  return null;
}

/** The rows of `grid` (header, body and footer rows; a nested table's rows are not included). */
function getRows(grid: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(grid.rows).filter((row) => row.cells.length > 0 && !row.hidden);
}

/** Browsers clamp `colSpan` to 1..1000 (`rowSpan` 0 covers the rest of its row group). */
const MAX_COL_SPAN = 1000;

/** Per row, the cell covering each visual column (see {@link getColumnMap}). */
type ColumnMap = ReadonlyArray<ReadonlyArray<HTMLTableCellElement | undefined>>;

/**
 * The HTML table model of `rows`: per row, the cell covering each visual column, with `colSpan` and
 * `rowSpan` counted. A row span covers the next rows of its row group in the DOM (a hidden row
 * counts, but gets no entry). A column no cell covers is empty. O(number of cells).
 */
function getColumnMap(rows: readonly HTMLTableRowElement[]): ColumnMap {
  const indexOf = new Map<Element, number>(rows.map((row, index) => [row, index]));
  const map: Array<Array<HTMLTableCellElement | undefined>> = rows.map(() => []);
  const cover = (rowIndex: number, column: number, colSpan: number, cell: HTMLTableCellElement) => {
    for (let offset = 0; offset < colSpan; offset += 1) map[rowIndex][column + offset] = cell;
  };
  rows.forEach((row, rowIndex) => {
    const own = map[rowIndex];
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      while (own[column]) column += 1;
      const colSpan = Math.min(Math.max(cell.colSpan, 1), MAX_COL_SPAN);
      cover(rowIndex, column, colSpan, cell);
      let remaining = cell.rowSpan === 0 ? Infinity : cell.rowSpan - 1;
      for (
        let next = row.nextElementSibling;
        next && remaining > 0;
        next = next.nextElementSibling
      ) {
        if (next.localName !== 'tr') continue;
        remaining -= 1;
        const covered = indexOf.get(next);
        if (covered !== undefined) cover(covered, column, colSpan, cell);
      }
      column += colSpan;
    }
  });
  return map;
}

/** The cell of a row (as {@link getColumnMap} maps it) at `column`, else the last one before it. */
function getCellAtColumn(
  rowMap: ReadonlyArray<HTMLTableCellElement | undefined>,
  column: number,
): HTMLTableCellElement | null {
  for (let index = Math.min(column, rowMap.length - 1); index >= 0; index -= 1) {
    const cell = rowMap[index];
    if (cell) return cell;
  }
  return null;
}

/** The data row index `row` carries, or `null` (a header or spacer row, or no row). */
function getRowIndex(row: Element | null): number | null {
  const value = row?.getAttribute(ROW_INDEX_ATTRIBUTE);
  return value != null && /^\d+$/.test(value) ? Number(value) : null;
}

/** A count of a model: a whole number, at least 0 (0 when it is not finite). */
function toCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * The rows keys move between. With a model: the first `headerRowCount` rows without a row index
 * that are not `aria-hidden` (the header rows) and every row with one (the data rows); other rows,
 * the spacer rows of a window, are left out.
 */
function getGridRows(
  grid: HTMLTableElement,
  model: GridNavigationModel | undefined,
): HTMLTableRowElement[] {
  if (!model) return getRows(grid);
  const headerRowCount = toCount(model.headerRowCount);
  let headers = 0;
  return getRows(grid).filter((row) => {
    if (getRowIndex(row) !== null) return true;
    if (headers >= headerRowCount || row.getAttribute('aria-hidden') === 'true') return false;
    headers += 1;
    return true;
  });
}

/**
 * With a model, the active cell by its row and visual column, so the tab stop survives the row
 * unmounting: the row's element while it is mounted, and its data row index (`null`: a header row).
 */
interface ActiveRow {
  row: HTMLTableRowElement | null;
  index: number | null;
  column: number;
}

/** With a model, a data row a key moved to that is not mounted yet. */
interface PendingRow {
  index: number;
  /** The visual column to focus there (`Infinity`: the row's last cell). */
  column: number;
}

/** The row and visual column of `cell` among `rows` (column 0 for a cell outside them). */
function locateCell(rows: readonly HTMLTableRowElement[], cell: HTMLTableCellElement): ActiveRow {
  const row = cell.parentElement as HTMLTableRowElement;
  const at = rows.indexOf(row);
  return {
    row: at < 0 ? null : row,
    index: getRowIndex(row),
    column: at < 0 ? 0 : Math.max(getColumnMap(rows)[at].indexOf(cell), 0),
  };
}

/** The cell at visual `column` of the mounted data row nearest to `index` (`null`: none). */
function getNearestRowCell(
  rows: readonly HTMLTableRowElement[],
  index: number,
  column: number,
): HTMLTableCellElement | null {
  let nearest = -1;
  let distance = Infinity;
  rows.forEach((row, at) => {
    const rowIndex = getRowIndex(row);
    if (rowIndex === null || Math.abs(rowIndex - index) >= distance) return;
    nearest = at;
    distance = Math.abs(rowIndex - index);
  });
  return nearest < 0 ? null : getCellAtColumn(getColumnMap(rows)[nearest], column);
}

/**
 * With a model, where `activeRow` is now and which cell holds the tab stop for it; `null` when the
 * rule without a model applies (the first cell once the active cell is gone): a header row that is
 * gone, or a data row that left the data (`rowCount`). The row is its element while that is
 * mounted (its index follows it: rows keyed by id are shown at other indexes when items are
 * inserted above), else the mounted row of its index (a row mounted again). While neither is mounted, a stand-in holds the tab stop:
 * `current` (the active cell, while it is mounted), else the cell of the nearest mounted data row
 * (`cell` is `null` when none is mounted).
 */
function placeActiveRow(
  rows: readonly HTMLTableRowElement[],
  activeRow: ActiveRow,
  rowCount: number,
  current: HTMLTableCellElement | null,
): { activeRow: ActiveRow; cell: HTMLTableCellElement | null } | null {
  const mounted = activeRow.row !== null && rows.includes(activeRow.row);
  const index = mounted ? getRowIndex(activeRow.row) : activeRow.index;
  if (index === null ? !mounted : index >= rowCount) return null;
  const row = mounted ? activeRow.row : (rows.find((each) => getRowIndex(each) === index) ?? null);
  const { column } = activeRow;
  if (!row) {
    // `index` is a data row index here (a header row is always `mounted`).
    return { activeRow, cell: current ?? getNearestRowCell(rows, index as number, column) };
  }
  const cell =
    current?.parentElement === row
      ? current
      : getCellAtColumn(getColumnMap(rows)[rows.indexOf(row)], column);
  return { activeRow: { row, index, column }, cell };
}

/** The focused element, through open shadow roots (the body, or `null`, when focus is lost). */
function getDeepActiveElement(doc: Document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

/**
 * The row indexes of {@link UseGridNavigationResult} (`activeRowIndex`, `pendingRowIndex`), read
 * by the owner's render through `useSyncExternalStore` and written by the handlers, the observer
 * and the layout effects. Without a model it stays at `null` and never notifies.
 */
class GridRowIndexes {
  private active: number | null = null;
  private pending: number | null = null;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getActive = (): number | null => this.active;

  getPending = (): number | null => this.pending;

  set(active: number | null, pending: number | null): void {
    if (active === this.active && pending === this.pending) return;
    this.active = active;
    this.pending = pending;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

/** The server snapshot of the row indexes: no row. */
const getNoRow = (): null => null;

/** The grid cells in `node` (itself, or its descendants that belong to `grid`). */
function collectCells(grid: HTMLTableElement, node: Node, into: Set<HTMLTableCellElement>): void {
  if (!(node instanceof Element)) return;
  if (isCellElement(node) && node.closest('table') === grid) into.add(node);
  for (const el of Array.from(node.querySelectorAll<HTMLTableCellElement>('td, th'))) {
    if (el.closest('table') === grid) into.add(el);
  }
}

/** A widget of a cell: a focusable element, or a nested composite counted as one widget. */
interface CellWidget {
  /** The focusable element, or the nested composite's root. */
  element: HTMLElement;
  /** A nested composite: the grid never writes `tabindex` on or inside it. */
  composite: boolean;
  /** An auxiliary widget (`data-grid-auxiliary`): never the cell's target, entered with F2. */
  auxiliary: boolean;
}

/** The element a widget is entered at: the widget, or a nested composite's entry. */
function getWidgetEntry(widget: CellWidget): HTMLElement | null {
  return widget.composite ? getCompositeEntry(widget.element) : widget.element;
}

/** The element F2 moves focus to: the entry of the cell's first auxiliary widget that has one. */
function getAuxiliaryEntry(widgets: readonly CellWidget[]): HTMLElement | null {
  for (const widget of widgets) {
    const entry = widget.auxiliary ? getWidgetEntry(widget) : null;
    if (entry) return entry;
  }
  return null;
}

/**
 * Whether focus on `focused`, inside `cell` whose target is `target`, is interaction mode: on
 * anything but the cell and its target; and on its target too while the widgets of a cell with an
 * auxiliary widget are being interacted with (`interactionCell`), so Tab moves between all of them.
 */
function isInteractionFocus(
  cell: HTMLTableCellElement,
  focused: EventTarget | null,
  target: HTMLElement,
  widgets: readonly CellWidget[],
  interactionCell: HTMLTableCellElement | null,
): boolean {
  if (focused === cell) return false;
  if (focused !== target) return true;
  return interactionCell === cell && widgets.some((widget) => widget.auxiliary);
}

/**
 * The grids of mounted {@link useGridNavigation} hooks, each with the function that returns focus
 * to one of its cells, as Escape does (see {@link returnFocusToGridCell}).
 */
const cellReturns = new WeakMap<Element, (cell: HTMLTableCellElement) => void>();

/**
 * Ends interaction mode in the grid cell that holds `element` and moves focus to the cell's target
 * (the cell, or its target widget), as Escape does: for a widget that handles Escape, Enter or
 * Space itself to leave (a DataGrid column's resize handle). Returns whether a grid of
 * {@link useGridNavigation} holds `element` in one of its cells. Module-only.
 */
export function returnFocusToGridCell(element: Element): boolean {
  for (let el = element.parentElement; el; el = el.parentElement) {
    const returnTo = cellReturns.get(el);
    if (!returnTo) continue;
    const cell = getCell(el as HTMLTableElement, element);
    if (!cell) return false;
    returnTo(cell);
    return true;
  }
  return false;
}

/**
 * Grid keyboard model of the APG Grid pattern for a `<table role="grid">` (DataGrid).
 *
 * - **One tab stop.** Exactly one cell of the grid is in the tab order (initially the first cell).
 *   Its focus target is its only focusable widget when that widget is not a text-entry control
 *   (a checkbox, a sort button, a link); otherwise — no widget, several widgets, a text-entry
 *   control or a nested composite — the cell itself. An unchecked radio whose named group has a
 *   checked radio is not a target either (browsers skip it in the Tab order), so its cell is.
 *   Every other cell and every widget inside a cell gets `tabindex="-1"`. Rows are never focusable.
 *   When a widget becomes the target of the focused cell (Space on the cell checks its radio), the
 *   cell keeps focus and the tab stop (removing its `tabindex` would blur it) while its target stays
 *   at `tabindex="-1"`; the target takes the tab stop once the cell is blurred.
 * - **Navigation mode** (focus on a cell or on its target widget): ArrowLeft/ArrowRight (the
 *   previous/next cell of the row, mirrored in RTL), ArrowUp/ArrowDown, Home/End (first/last cell
 *   of the row), Ctrl+Home/Ctrl+End (first cell of the grid / last cell of the last row) and
 *   PageUp/PageDown ({@link UseGridNavigationOptions.pageSize} rows) move focus between cells.
 *   ArrowUp/ArrowDown and PageUp/PageDown keep the visual column (`colSpan` and `rowSpan` counted,
 *   so a grouped header works), clamped to a shorter row. Space and Enter on a target widget reach
 *   the widget.
 * - **Interaction mode**: Enter or F2 on a cell that is its own target moves focus into its first
 *   widget; clicking a widget that is not the cell's target (a text input) enters it too. The
 *   grid keys are then ignored, so the arrow keys move the caret, and Tab moves between the cell's
 *   widgets. Escape returns focus to the cell. Leaving the grid ends interaction mode.
 * - **Nested composites** (an element with `data-roving-container` or role toolbar, radiogroup,
 *   listbox, grid, treegrid, tablist, menu, menubar or tree) count as one widget that uses the arrow
 *   keys: its cell takes focus, and Enter/F2 enters the composite at its own tab stop. The grid never
 *   writes `tabindex` on or inside a composite (the composite manages its own), so a composite
 *   keeps its own Tab stop — the same documented limitation as `useRovingTabIndex`.
 * - **Auxiliary widgets** (a widget that carries `data-grid-auxiliary`, such as a column's resize
 *   handle) are left out when the cell's target is chosen, so a header with a sort button and a
 *   resize handle keeps the button as its target (Enter sorts), and a cell whose only widget is
 *   auxiliary is its own target. Like every widget they are at `tabindex="-1"` in navigation mode
 *   and take part in interaction mode. F2 on a cell that has one, or on its target widget, enters
 *   interaction mode at the first auxiliary widget (Enter on a cell that is its own target still
 *   enters its first widget); Escape returns to the cell's target, the cell or its target widget.
 *   While the widgets of such a cell are interacted with, its target widget is in interaction mode
 *   too, so Tab moves between all of them and Escape on the target ends the mode. A cell without
 *   auxiliary widgets behaves as described above.
 * - **Rows by their data** (a `model`: a windowed grid, whose rows are mounted in part): the rows
 *   are the header rows and the data rows, which carry their index in the data as `data-row-index`
 *   (other rows, such as the spacer rows of a window, are skipped). ArrowUp/ArrowDown,
 *   PageUp/PageDown and Ctrl+Home/Ctrl+End go by that index over every row of the data, header
 *   rows first, with the rules above: a target row that is not mounted is asked for with
 *   `scrollToRow` (once per row) and focused in the commit that mounts it, and Ctrl+Home also
 *   brings data row 0 back under the header rows. The active cell is kept by its row and column:
 *   `activeRowIndex` and `pendingRowIndex` name the rows the owner keeps mounted, and while the
 *   active row is not mounted anyway, a cell of the nearest mounted row holds the tab stop until
 *   the row is back. ArrowLeft/ArrowRight and Home/End work in the row as above.
 *
 * Keys are ignored when the event's default was prevented (a widget that handled the key, a
 * consumer handler), or with Alt/Meta held. The tab indexes are written to the DOM (layout effect
 * plus a `MutationObserver`), so rows and widgets added later are covered without a re-render. Focus
 * moves re-sync only the cells involved, the observer only the cells that changed, and the grid's
 * own `tabindex` writes do not trigger a re-sync.
 *
 * Internal to the table package.
 */
export function useGridNavigation(options: UseGridNavigationOptions = {}): UseGridNavigationResult {
  const { model } = options;
  const pageSize = Math.max(1, options.pageSize ?? 10);
  const [grid, setGrid] = React.useState<HTMLTableElement | null>(null);
  /** The model of the last commit (read by the handlers, the observer and the effects). */
  const modelRef = React.useRef(model);
  /** With a model: the active cell's row and column (see {@link ActiveRow}). */
  const activeRowRef = React.useRef<ActiveRow | null>(null);
  /** With a model: the data row a key moved to that is not mounted yet. */
  const pendingRef = React.useRef<PendingRow | null>(null);
  const [rowIndexes] = React.useState(() => new GridRowIndexes());
  const activeRowIndex = React.useSyncExternalStore(
    rowIndexes.subscribe,
    rowIndexes.getActive,
    getNoRow,
  );
  const pendingRowIndex = React.useSyncExternalStore(
    rowIndexes.subscribe,
    rowIndexes.getPending,
    getNoRow,
  );
  /** The cell that holds the tab stop. */
  const activeCellRef = React.useRef<HTMLTableCellElement | null>(null);
  /** The cell whose widgets are being interacted with, or `null` (navigation mode). */
  const interactionCellRef = React.useRef<HTMLTableCellElement | null>(null);
  /** Elements whose `tabindex` this hook wrote. */
  const [stamped] = React.useState(() => new WeakSet<Element>());
  /** The `tabindex` value this hook last wrote per element (`null`: removed), to skip own records. */
  const [written] = React.useState(() => new WeakMap<Element, string | null>());
  /**
   * Cells kept focusable (holding the tab stop, their target at -1) because they were focused when
   * a widget became their target (a radio that got checked, a widget added): they lose the
   * attribute once blurred.
   */
  const [retained] = React.useState(() => new WeakSet<Element>());
  const pageSizeRef = React.useRef(pageSize);

  React.useLayoutEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  /**
   * The widgets of `cell` in DOM order. `precise` checks focusability with `isFocusable` (style
   * reads); otherwise only attributes are checked (cells that do not hold the tab stop).
   */
  const getWidgets = React.useCallback(
    (cell: HTMLTableCellElement, precise: boolean): CellWidget[] => {
      const widgets: CellWidget[] = [];
      let composite: HTMLElement | null = null;
      for (const el of Array.from(cell.querySelectorAll<HTMLElement>(WIDGET_CANDIDATE_SELECTOR))) {
        // Descendants of a nested composite belong to it (candidates come in document order).
        if (composite && composite.contains(el)) continue;
        if (isNestedComposite(el)) {
          composite = el;
          const available = precise ? getCompositeEntry(el) !== null : isLikelyFocusable(el);
          if (available) {
            widgets.push({
              element: el,
              composite: true,
              auxiliary: el.hasAttribute(AUXILIARY_ATTRIBUTE),
            });
          }
          continue;
        }
        const tabIndex = el.getAttribute('tabindex');
        // An author tabindex="-1" (not written by this hook) opts the element out.
        if (tabIndex !== null && Number(tabIndex) < 0 && !stamped.has(el)) continue;
        if (precise ? isFocusable(el) : isLikelyFocusable(el)) {
          widgets.push({
            element: el,
            composite: false,
            auxiliary: el.hasAttribute(AUXILIARY_ATTRIBUTE),
          });
        }
      }
      return widgets;
    },
    [stamped],
  );

  /**
   * The element of `cell` that takes focus in navigation mode. `checkRadioGroup` applies the radio
   * group rule, which only decides where the tab stop goes (the cell that holds it); a focused
   * lone radio is in navigation mode either way. Auxiliary widgets are not counted.
   */
  const getTarget = React.useCallback(
    (cell: HTMLTableCellElement, widgets: CellWidget[], checkRadioGroup: boolean): HTMLElement => {
      let only: CellWidget | null = null;
      for (const widget of widgets) {
        if (widget.auxiliary) continue;
        if (only) return cell;
        only = widget;
      }
      if (!only) return cell;
      const { element, composite } = only;
      if (composite || isTextEntryElement(element)) return cell;
      if (
        checkRadioGroup &&
        element instanceof HTMLInputElement &&
        element.type === 'radio' &&
        !element.checked &&
        hasCheckedPeer(element)
      ) {
        return cell;
      }
      return element;
    },
    [],
  );

  const setTabIndex = React.useCallback(
    (el: HTMLElement, value: 0 | -1) => {
      const next = String(value);
      if (el.getAttribute('tabindex') !== next) {
        written.set(el, next);
        el.setAttribute('tabindex', next);
      }
      stamped.add(el);
    },
    [stamped, written],
  );

  /** Writes the tab indexes of one cell and its widgets (only attributes that change). */
  const syncCell = React.useCallback(
    (cell: HTMLTableCellElement, isActive: boolean, isInteraction: boolean) => {
      const widgets = getWidgets(cell, isActive);
      if (isInteraction) {
        retained.delete(cell);
        setTabIndex(cell, -1);
        for (const widget of widgets) {
          if (!widget.composite) setTabIndex(widget.element, 0);
        }
        return;
      }
      const target = getTarget(cell, widgets, isActive);
      /** The focused cell stands in for its target until it is blurred (see below). */
      let keepCell = false;
      if (target === cell) {
        retained.delete(cell);
        setTabIndex(cell, isActive ? 0 : -1);
      } else if (stamped.has(cell) && isFocused(cell)) {
        // A widget became the focused cell's target (its radio got checked, a widget was added).
        // Removing the tabindex of the focused element blurs it (browsers move focus to the body,
        // which ends the grid session), so the cell stays focusable and stays the grid's position.
        // It keeps the tab stop (`tabindex="0"`, when active) and its target stays at -1: the grid
        // still has exactly one Tab stop even if focus is lost without a focusout, and Tab and
        // Shift+Tab from the cell leave the grid (nothing after or before it inside is tabbable).
        // Once the cell is blurred, onBlur re-syncs it and the target takes the tab stop.
        keepCell = true;
        retained.add(cell);
        setTabIndex(cell, isActive ? 0 : -1);
      } else if (stamped.has(cell)) {
        // The cell's widget is its target: the cell itself is not focusable.
        retained.delete(cell);
        stamped.delete(cell);
        if (cell.hasAttribute('tabindex')) {
          written.set(cell, null);
          cell.removeAttribute('tabindex');
        }
      }
      for (const widget of widgets) {
        if (widget.composite) continue;
        const isStop = widget.element === target && isActive && !keepCell;
        setTabIndex(widget.element, isStop ? 0 : -1);
      }
    },
    [getTarget, getWidgets, retained, setTabIndex, stamped, written],
  );

  /** With a model: publishes the active and the pending row index to the owner's render. */
  const publish = React.useCallback(() => {
    rowIndexes.set(activeRowRef.current?.index ?? null, pendingRef.current?.index ?? null);
  }, [rowIndexes]);

  /**
   * Re-resolves the active cell (the first cell when it is gone) and syncs `cells` — every cell
   * when omitted. A new active cell is always synced. With a model, an active cell that is gone
   * while its row index is in the data is replaced in its row instead (see `placeActiveRow`).
   */
  const sync = React.useCallback(
    (table: HTMLTableElement, cells?: Iterable<HTMLTableCellElement | null>) => {
      const currentModel = modelRef.current;
      const rows = getGridRows(table, currentModel);
      let active = activeCellRef.current;
      const targets = new Set<HTMLTableCellElement>();
      let gone =
        !active ||
        !active.isConnected ||
        !rows.includes(active.parentElement as HTMLTableRowElement);
      const placed =
        currentModel && activeRowRef.current
          ? placeActiveRow(
              rows,
              activeRowRef.current,
              toCount(currentModel.rowCount),
              gone ? null : active,
            )
          : null;
      if (placed) {
        activeRowRef.current = placed.activeRow;
        if (placed.cell) {
          gone = false;
          if (placed.cell !== active) {
            // The cell that held the tab stop (a stand-in) gives it up.
            if (active) targets.add(active);
            active = placed.cell;
            activeCellRef.current = active;
            targets.add(active);
          }
        }
      }
      if (gone) {
        active = rows[0]?.cells[0] ?? null;
        activeCellRef.current = active;
        if (active) targets.add(active);
        if (currentModel && !placed) activeRowRef.current = null;
      }
      if (currentModel && active && activeRowRef.current === null) {
        activeRowRef.current = locateCell(rows, active);
      }
      if (interactionCellRef.current !== null && interactionCellRef.current !== active) {
        const previous = interactionCellRef.current;
        interactionCellRef.current = null;
        targets.add(previous);
      }
      const interaction = interactionCellRef.current;

      if (cells === undefined) {
        for (const row of rows) for (const cell of Array.from(row.cells)) targets.add(cell);
      } else {
        for (const cell of cells) if (cell) targets.add(cell);
      }
      // With a model, the cells of rows keys skip (the spacer rows of a window) are never stamped.
      const skipped = currentModel ? new Set(rows) : null;
      for (const cell of targets) {
        if (!cell.isConnected || getCell(table, cell) !== cell) continue;
        if (
          skipped &&
          !skipped.has(cell.parentElement as HTMLTableRowElement) &&
          !stamped.has(cell)
        ) {
          continue;
        }
        syncCell(cell, cell === active, cell === interaction);
      }
      if (currentModel) publish();
    },
    [publish, stamped, syncCell],
  );

  /**
   * Makes `cell` the active cell (in interaction mode when `interaction`) and re-syncs only the
   * cells involved: the previous active and interaction cells and `cell`. With a model, its row is
   * the active row, and a row that was awaited is not any more (focus moved).
   */
  const activate = React.useCallback(
    (table: HTMLTableElement, cell: HTMLTableCellElement, interaction: boolean) => {
      const previousActive = activeCellRef.current;
      const previousInteraction = interactionCellRef.current;
      activeCellRef.current = cell;
      interactionCellRef.current = interaction ? cell : null;
      const currentModel = modelRef.current;
      if (currentModel) {
        activeRowRef.current = locateCell(getGridRows(table, currentModel), cell);
        pendingRef.current = null;
      }
      sync(table, [previousActive, previousInteraction, cell]);
    },
    [sync],
  );

  const focusCell = React.useCallback(
    (table: HTMLTableElement, cell: HTMLTableCellElement) => {
      activate(table, cell, false);
      getTarget(cell, getWidgets(cell, true), true).focus();
    },
    [activate, getTarget, getWidgets],
  );

  /**
   * With a model: awaits data row `index`, which is not mounted. The model scrolls to it (once per
   * row: a key pressed again before it mounts replaces the target, and asks again only for another
   * row), and focus moves to its cell at `column` once it is mounted (`resolvePending`).
   */
  const requestRow = React.useCallback(
    (index: number, column: number) => {
      const currentModel = modelRef.current;
      if (!currentModel) return;
      const previous = pendingRef.current;
      pendingRef.current = { index, column };
      publish();
      if (previous?.index !== index) currentModel.scrollToRow(index);
    },
    [publish],
  );

  /**
   * With a model: focuses the awaited row's cell once the row is mounted, from the layout effect of
   * the owner's commit that mounts it or from the observer (a row mounted by another component's
   * commit). The request is dropped when the row left the data, and when focus went to an element
   * outside the grid meanwhile (focus stays there).
   */
  const resolvePending = React.useCallback(
    (table: HTMLTableElement) => {
      const pending = pendingRef.current;
      const currentModel = modelRef.current;
      if (!pending || !currentModel) return;
      if (pending.index >= toCount(currentModel.rowCount)) {
        pendingRef.current = null;
        publish();
        return;
      }
      const rows = getGridRows(table, currentModel);
      const at = rows.findIndex((row) => getRowIndex(row) === pending.index);
      if (at < 0) return;
      pendingRef.current = null;
      const target = getCellAtColumn(getColumnMap(rows)[at], pending.column);
      const focused = getDeepActiveElement(table.ownerDocument);
      const focusInGrid =
        focused === null || focused === table.ownerDocument.body || table.contains(focused);
      if (target && focusInGrid) focusCell(table, target);
      else publish();
    },
    [focusCell, publish],
  );

  /**
   * With a model: moves focus by the rows of the data for `key` (ArrowUp/ArrowDown, PageUp/PageDown,
   * or Home/End with Ctrl held), from the awaited row while there is one, else from `cell`. The
   * header rows come first, then the data rows by index. Up/Down and PageUp/PageDown keep the
   * visual column; Ctrl+Home goes to the first cell of the grid and Ctrl+End to the last cell of the
   * last data row. A target row that is not mounted is awaited (`requestRow`).
   */
  const moveByRow = React.useCallback(
    (
      table: HTMLTableElement,
      cell: HTMLTableCellElement,
      rows: HTMLTableRowElement[],
      key: string,
    ) => {
      const currentModel = modelRef.current;
      if (!currentModel) return;
      const headers = rows.filter((row) => getRowIndex(row) === null);
      /** Where each mounted data row is in `rows`, by its index. */
      const mounted = new Map<number, number>();
      rows.forEach((row, at) => {
        const index = getRowIndex(row);
        if (index !== null) mounted.set(index, at);
      });
      const rowCount = toCount(currentModel.rowCount);
      const last = headers.length + rowCount - 1;
      const columns = getColumnMap(rows);
      const pending = pendingRef.current;
      /** The row the move starts from (header rows, then data rows) and its visual column. */
      let from: number;
      let column: number;
      if (pending) {
        from = headers.length + Math.min(pending.index, rowCount - 1);
        column = pending.column;
      } else {
        const row = cell.parentElement as HTMLTableRowElement;
        const index = getRowIndex(row);
        from = index === null ? headers.indexOf(row) : headers.length + index;
        column = Math.max(columns[rows.indexOf(row)].indexOf(cell), 0);
      }
      let start: number;
      let step: 1 | -1 = 1;
      /** Ctrl+Home and Ctrl+End go to one row (no row a spanning cell covers is skipped). */
      let single = false;
      switch (key) {
        case 'ArrowDown':
          start = from + 1;
          break;
        case 'ArrowUp':
          start = from - 1;
          step = -1;
          break;
        case 'PageDown':
          start = Math.min(from + pageSizeRef.current, last);
          break;
        case 'PageUp':
          start = Math.max(from - pageSizeRef.current, 0);
          step = -1;
          break;
        case 'Home':
          start = 0;
          column = 0;
          single = true;
          break;
        default:
          start = last;
          column = Infinity;
          single = true;
          break;
      }
      for (let position = start; position >= 0 && position <= last; position += step) {
        const at =
          position < headers.length
            ? rows.indexOf(headers[position])
            : (mounted.get(position - headers.length) ?? -1);
        if (at < 0) {
          requestRow(position - headers.length, column);
          break;
        }
        const candidate = getCellAtColumn(columns[at], column);
        if (candidate && candidate !== cell) {
          focusCell(table, candidate);
          break;
        }
        if (single) break;
      }
      // Focus on a header row: the first data rows come back under it, as the top of the grid.
      if (key === 'Home' && headers.length > 0 && rowCount > 0) currentModel.scrollToRow(0);
    },
    [focusCell, requestRow],
  );

  React.useLayoutEffect(() => {
    if (!grid) return;
    sync(grid);
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((records) => {
      let relevant = false;
      let all = false;
      const dirty = new Set<HTMLTableCellElement>();
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        // A nested composite manages its own items (and their tab indexes).
        if (isInsideNestedComposite(target, grid)) continue;
        if (record.type === 'attributes') {
          // The record of one of our own writes.
          if (
            record.attributeName === 'tabindex' &&
            written.has(target) &&
            written.get(target) === target.getAttribute('tabindex')
          ) {
            continue;
          }
          relevant = true;
          const cell = getCell(grid, target);
          if (cell) dirty.add(cell);
          else if (target.localName === 'tr') collectCells(grid, target, dirty);
          else all = true;
          continue;
        }
        relevant = true;
        const cell = getCell(grid, target);
        if (cell) {
          dirty.add(cell);
          continue;
        }
        // Rows, sections or cells added (removed ones need no sync; `sync` re-resolves the
        // active cell when it went away).
        for (const node of Array.from(record.addedNodes)) collectCells(grid, node, dirty);
      }
      if (!relevant) return;
      // The active cell's target can depend on other cells (a radio group whose checked radio
      // changed, reflected by the rows' `aria-selected`), so it is always re-checked.
      if (activeCellRef.current) dirty.add(activeCellRef.current);
      sync(grid, all ? undefined : dirty);
      // With a model, an awaited row mounted by a commit of another component.
      resolvePending(grid);
    });
    observer.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [grid, resolvePending, sync, written]);

  // A widget that handles its leaving keys itself returns through `returnFocusToGridCell`.
  React.useLayoutEffect(() => {
    if (!grid) return;
    const returnTo = (cell: HTMLTableCellElement) => focusCell(grid, cell);
    cellReturns.set(grid, returnTo);
    return () => {
      if (cellReturns.get(grid) === returnTo) cellReturns.delete(grid);
    };
  }, [grid, focusCell]);

  // After every commit: the model of this render, and focus on an awaited row that the commit
  // mounted. Without a model, no row is kept by its index.
  React.useLayoutEffect(() => {
    modelRef.current = model;
    if (!model) {
      activeRowRef.current = null;
      pendingRef.current = null;
      rowIndexes.set(null, null);
      return;
    }
    if (grid) resolvePending(grid);
  });

  const onKeyDown = React.useCallback<React.KeyboardEventHandler<HTMLTableElement>>(
    (event) => {
      const table = event.currentTarget;
      if (event.defaultPrevented) return;
      const cell = getCell(table, event.target);
      if (!cell) return;
      const widgets = getWidgets(cell, true);
      // A lone non-text widget is in navigation mode when focused, even an unchecked radio that
      // the radio group rule keeps from holding the tab stop.
      const widgetTarget = getTarget(cell, widgets, false);
      const onCell = event.target === cell;

      if (
        isInteractionFocus(cell, event.target, widgetTarget, widgets, interactionCellRef.current)
      ) {
        // Interaction mode: the widget keeps its keys; Escape returns to the cell.
        if (event.key === 'Escape') {
          event.preventDefault();
          focusCell(table, cell);
        }
        return;
      }
      if (event.altKey || event.metaKey) return;

      // F2 on a cell with an auxiliary widget, or on its target widget, enters the auxiliary one.
      const auxiliaryEntry = event.key === 'F2' ? getAuxiliaryEntry(widgets) : null;
      if (auxiliaryEntry) {
        event.preventDefault();
        activate(table, cell, true);
        auxiliaryEntry.focus();
        return;
      }

      if ((event.key === 'Enter' || event.key === 'F2') && onCell) {
        let entry: HTMLElement | null = null;
        for (const widget of widgets) {
          entry = getWidgetEntry(widget);
          if (entry) break;
        }
        if (!entry) return;
        event.preventDefault();
        activate(table, cell, true);
        entry.focus();
        return;
      }

      const rows = getGridRows(table, modelRef.current);
      const rowIndex = rows.findIndex((row) => row === cell.parentElement);
      if (rowIndex < 0) return;
      const columnIndex = Array.from(rows[rowIndex].cells).indexOf(cell);
      const lastRow = rows.length - 1;
      const ctrl = event.ctrlKey;
      /** Left/Right, Home/End: target row and cell index in it (`Infinity`: the row's last cell). */
      let next: [row: number, column: number] | null = null;
      /** Up/Down, PageUp/PageDown: the first row to try and the direction to keep going in. */
      let vertical: [row: number, step: 1 | -1] | null = null;

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (ctrl) break;
          const intent = getArrowIntent(event.key, {
            orientation: 'horizontal',
            dir: getDirection(table),
          });
          next = [rowIndex, columnIndex + (intent === 'next' ? 1 : -1)];
          break;
        }
        case 'ArrowDown':
          if (!ctrl) vertical = [rowIndex + 1, 1];
          break;
        case 'ArrowUp':
          if (!ctrl) vertical = [rowIndex - 1, -1];
          break;
        case 'Home':
          next = ctrl ? [0, 0] : [rowIndex, 0];
          break;
        case 'End':
          next = ctrl ? [lastRow, Infinity] : [rowIndex, Infinity];
          break;
        case 'PageDown':
          if (!ctrl) vertical = [Math.min(rowIndex + pageSizeRef.current, lastRow), 1];
          break;
        case 'PageUp':
          if (!ctrl) vertical = [Math.max(rowIndex - pageSizeRef.current, 0), -1];
          break;
        default:
          break;
      }
      if (!next && !vertical) return;
      // A handled key never scrolls the page or reaches the widget, even at the grid's edge.
      event.preventDefault();
      // With a model, Up/Down, PageUp/PageDown and Ctrl+Home/Ctrl+End go by the rows of the data.
      if (modelRef.current && (vertical || ctrl)) {
        moveByRow(table, cell, rows, event.key);
        return;
      }
      let destination: HTMLTableCellElement | null = null;
      if (vertical) {
        // Up/Down keep the visual column (spans counted), clamped to a shorter row; the rows a
        // row-spanning cell covers are skipped when moving away from it.
        const columns = getColumnMap(rows);
        const column = Math.max(columns[rowIndex].indexOf(cell), 0);
        for (let row = vertical[0]; row >= 0 && row <= lastRow; row += vertical[1]) {
          const candidate = getCellAtColumn(columns[row], column);
          if (candidate && candidate !== cell) {
            destination = candidate;
            break;
          }
        }
      } else if (next) {
        // Left/Right stop at the row's edges (no cell there).
        const [nextRow, nextColumn] = next;
        const rowCells = rows[nextRow].cells;
        destination =
          nextColumn === Infinity ? rowCells[rowCells.length - 1] : rowCells.item(nextColumn);
      }
      if (destination && destination !== cell) focusCell(table, destination);
    },
    [activate, focusCell, getTarget, getWidgets, moveByRow],
  );

  const onFocus = React.useCallback<React.FocusEventHandler<HTMLTableElement>>(
    (event) => {
      const table = event.currentTarget;
      // React types `target` as the handler's element type; it is the focused descendant.
      const target: EventTarget = event.target;
      const cell = getCell(table, target);
      if (!cell) return;
      let interaction = false;
      if (target !== cell) {
        const widgets = getWidgets(cell, true);
        interaction = isInteractionFocus(
          cell,
          target,
          getTarget(cell, widgets, false),
          widgets,
          interactionCellRef.current,
        );
      }
      activate(table, cell, interaction);
    },
    [activate, getTarget, getWidgets],
  );

  const onBlur = React.useCallback<React.FocusEventHandler<HTMLTableElement>>(
    (event) => {
      const table = event.currentTarget;
      // React types `target` as the handler's element type; it is the blurred descendant.
      const left: EventTarget = event.target;
      const cells: HTMLTableCellElement[] = [];
      // A cell kept focusable while focused (see syncCell) is re-synced now that it is blurred
      // (during focusout the blurred element is no longer the active element).
      if (left instanceof Element && isCellElement(left) && retained.has(left)) cells.push(left);
      const next = event.relatedTarget;
      const interaction = interactionCellRef.current;
      if (interaction !== null && !(next instanceof Node && table.contains(next))) {
        interactionCellRef.current = null;
        cells.push(interaction);
      }
      if (cells.length > 0) sync(table, cells);
    },
    [retained, sync],
  );

  const gridProps = React.useMemo<GridNavigationHandlers>(
    () => ({ onKeyDown, onFocus, onBlur }),
    [onBlur, onFocus, onKeyDown],
  );

  return { gridRef: setGrid, gridProps, activeRowIndex, pendingRowIndex };
}
