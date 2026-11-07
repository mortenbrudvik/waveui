import { FOCUSABLE_SELECTOR, isFocusable } from '../../lib/focus';

/**
 * Module-only helpers of a FlatTree's `navigationMode="treegrid"`: the cells of a row, the widgets
 * inside them and the focus targets. A row is a `role="row"` element whose children are its
 * `gridcell`s, each marked `data-flat-tree-cell="<index>"` (`0` is the cell of the item's own
 * content, the chevron, check and label; `renderCells` draws the others). No React import.
 */

/** The marker of a gridcell; its value is the cell's index in the row. */
export const CELL_ATTRIBUTE = 'data-flat-tree-cell';

/** The cells of a row element, in order. */
export function getCells(row: Element): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>(`:scope > [${CELL_ATTRIBUTE}]`));
}

/**
 * The cell of `row` that holds `target` (the cell itself, or an element inside it), or `null` for
 * the row itself and for an element outside its cells.
 */
export function getCellOf(row: Element, target: Element): HTMLElement | null {
  let el: Element | null = target;
  while (el && el.parentElement !== row) el = el.parentElement;
  return el instanceof HTMLElement && el.hasAttribute(CELL_ATTRIBUTE) ? el : null;
}

/** The index a cell element carries. */
export function getCellIndex(cell: Element): number {
  return Number(cell.getAttribute(CELL_ATTRIBUTE));
}

/**
 * Focuses cell `index` of `row`, else the row's last cell when it has fewer (rows may draw
 * different numbers of cells); the row itself when it has none.
 */
export function focusCell(row: HTMLElement, index: number): void {
  const cells = getCells(row);
  const cell = cells[Math.min(index, cells.length - 1)];
  (cell ?? row).focus();
}

/**
 * The first widget in a cell that Enter or F2 moves focus to: a focusable element inside it that
 * is not the item's checkbox (which never takes focus).
 */
export function getFirstWidget(cell: Element): HTMLElement | null {
  for (const el of cell.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (!el.hasAttribute('data-flat-tree-checkbox') && isFocusable(el)) return el;
  }
  return null;
}

/**
 * Takes every widget inside a cell out of the Tab order (`tabindex="-1"`): the tree keeps one Tab
 * stop, a row or a cell, and Enter on a cell moves focus to its first widget. Run after every
 * commit and on every change of the tree's elements, so a widget that renders later is parked too.
 * Only attributes are written, so a mutation observer of the child list does not see its own work.
 */
export function parkCellWidgets(root: Element): void {
  for (const cell of root.querySelectorAll(`[${CELL_ATTRIBUTE}]`)) {
    for (const el of cell.querySelectorAll(FOCUSABLE_SELECTOR)) {
      if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
    }
  }
}
