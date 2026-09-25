import * as React from 'react';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { FOCUSABLE_SELECTOR, getFirstTabbable, isFocusable } from '../../lib/focus';

/** Options of {@link useGridNavigation}. */
export interface UseGridNavigationOptions {
  /**
   * How many rows PageUp and PageDown move focus.
   * @default 10
   */
  pageSize?: number;
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
 * Attributes whose changes can change a cell's widgets or the grid's rows. `aria-selected` on a row
 * signals a selection change, which can change the active cell's target (radio groups).
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

/** Whether `el` is the focused element of its document (or shadow root). */
function isFocused(el: Element): boolean {
  return (el.getRootNode() as Partial<DocumentOrShadowRoot>).activeElement === el;
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
  const pageSize = Math.max(1, options.pageSize ?? 10);
  const [grid, setGrid] = React.useState<HTMLTableElement | null>(null);
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
          if (available) widgets.push({ element: el, composite: true });
          continue;
        }
        const tabIndex = el.getAttribute('tabindex');
        // An author tabindex="-1" (not written by this hook) opts the element out.
        if (tabIndex !== null && Number(tabIndex) < 0 && !stamped.has(el)) continue;
        if (precise ? isFocusable(el) : isLikelyFocusable(el)) {
          widgets.push({ element: el, composite: false });
        }
      }
      return widgets;
    },
    [stamped],
  );

  /**
   * The element of `cell` that takes focus in navigation mode. `checkRadioGroup` applies the radio
   * group rule, which only decides where the tab stop goes (the cell that holds it); a focused
   * lone radio is in navigation mode either way.
   */
  const getTarget = React.useCallback(
    (cell: HTMLTableCellElement, widgets: CellWidget[], checkRadioGroup: boolean): HTMLElement => {
      if (widgets.length !== 1) return cell;
      const [{ element, composite }] = widgets;
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

  /**
   * Re-resolves the active cell (the first cell when it is gone) and syncs `cells` — every cell
   * when omitted. A new active cell is always synced.
   */
  const sync = React.useCallback(
    (table: HTMLTableElement, cells?: Iterable<HTMLTableCellElement | null>) => {
      const rows = getRows(table);
      let active = activeCellRef.current;
      const targets = new Set<HTMLTableCellElement>();
      if (
        !active ||
        !active.isConnected ||
        !rows.includes(active.parentElement as HTMLTableRowElement)
      ) {
        active = rows[0]?.cells[0] ?? null;
        activeCellRef.current = active;
        if (active) targets.add(active);
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
      for (const cell of targets) {
        if (!cell.isConnected || getCell(table, cell) !== cell) continue;
        syncCell(cell, cell === active, cell === interaction);
      }
    },
    [syncCell],
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
    });
    observer.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [grid, sync, written]);

  /**
   * Makes `cell` the active cell (in interaction mode when `interaction`) and re-syncs only the
   * cells involved: the previous active and interaction cells and `cell`.
   */
  const activate = React.useCallback(
    (table: HTMLTableElement, cell: HTMLTableCellElement, interaction: boolean) => {
      const previousActive = activeCellRef.current;
      const previousInteraction = interactionCellRef.current;
      activeCellRef.current = cell;
      interactionCellRef.current = interaction ? cell : null;
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

      if (!onCell && event.target !== widgetTarget) {
        // Interaction mode: the widget keeps its keys; Escape returns to the cell.
        if (event.key === 'Escape') {
          event.preventDefault();
          focusCell(table, cell);
        }
        return;
      }
      if (event.altKey || event.metaKey) return;

      if ((event.key === 'Enter' || event.key === 'F2') && onCell) {
        let entry: HTMLElement | null = null;
        for (const widget of widgets) {
          entry = widget.composite ? getCompositeEntry(widget.element) : widget.element;
          if (entry) break;
        }
        if (!entry) return;
        event.preventDefault();
        activate(table, cell, true);
        entry.focus();
        return;
      }

      const rows = getRows(table);
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
    [activate, focusCell, getTarget, getWidgets],
  );

  const onFocus = React.useCallback<React.FocusEventHandler<HTMLTableElement>>(
    (event) => {
      const table = event.currentTarget;
      // React types `target` as the handler's element type; it is the focused descendant.
      const target: EventTarget = event.target;
      const cell = getCell(table, target);
      if (!cell) return;
      const interaction =
        target !== cell && target !== getTarget(cell, getWidgets(cell, true), false);
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

  return { gridRef: setGrid, gridProps };
}
