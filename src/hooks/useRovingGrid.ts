import * as React from 'react';
import { useEventCallback } from './useEventCallback';
import { useRovingTabIndex, type RovingContainerProps } from './useRovingTabIndex';

/** Options of {@link useRovingGrid}. */
export interface UseRovingGridOptions {
  /** The selected cell value (the first tab stop), or `null`. */
  activeValue: string | null;
}

/** Result of {@link useRovingGrid}. */
export interface UseRovingGridResult {
  /** Spread onto the grid container; `onKeyDown` already adds the grid keys. */
  containerProps: RovingContainerProps;
  /** `0` for the cell that holds the tab stop (the last focused one, else the selected one, else the first enabled), `-1` for every other cell. */
  getTabIndex: (value: string) => 0 | -1;
}

const CELL_SELECTOR = '[data-roving-value]';
const ROW_SELECTOR = '[role="row"]';

/** Whether the grid keys may land on `el`: not disabled, not hidden, not inert. */
function isEnabledCell(el: HTMLElement, container: HTMLElement): boolean {
  if ((el as { disabled?: unknown }).disabled === true) return false;
  const marker = el.getAttribute('data-roving-disabled');
  if (marker !== null && marker !== 'false') return false;
  if (!el.hasAttribute('data-disabled-focusable') && el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  for (let node: HTMLElement | null = el; node && node !== container; node = node.parentElement) {
    if (node.hidden || node.hasAttribute('inert')) return false;
  }
  return true;
}

/**
 * Internal. Roving focus for a two-dimensional grid of cells (SwatchPicker's grid layout): one
 * `useRovingTabIndex` on the container plus the keys a grid adds. Rows are the `role="row"`
 * elements inside the container and cells their `[data-roving-value]` elements.
 *
 * - Left/Right move through the cells in reading order across rows (mirrored in RTL) and stop at
 *   the grid's first and last cell.
 * - Up/Down go to the cell at the same index in the previous/next row, else to the nearest enabled
 *   cell of that row (by index; the earlier one on a tie), skipping rows without an enabled cell;
 *   they stop at the first/last row.
 * - Home/End go to the first/last enabled cell of the row, Ctrl+Home/End of the grid.
 * - Disabled cells are skipped; Space and Enter are the cell's own. Keys that start outside the
 *   container's DOM (a portaled popup) are ignored.
 *
 * @param options - See {@link UseRovingGridOptions}.
 * @returns See {@link UseRovingGridResult}.
 */
export function useRovingGrid({ activeValue }: UseRovingGridOptions): UseRovingGridResult {
  const roving = useRovingTabIndex({
    activeValue,
    orientation: 'horizontal',
    loop: false,
    homeEndKeys: false,
    tabStop: 'last-focused',
  });
  const { focusValue } = roving;
  const baseKeyDown = roving.containerProps.onKeyDown;

  const onKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const container = event.currentTarget;
    const target = event.target as Node | null;
    // A key from a portaled popup is the popup's: React bubbles it through the container.
    if (!target || typeof target.nodeType !== 'number' || !container.contains(target)) return;

    const { key } = event;
    const isHomeEnd = key === 'Home' || key === 'End';
    const isVertical = key === 'ArrowUp' || key === 'ArrowDown';
    const grid = isHomeEnd
      ? !event.metaKey && !event.altKey
      : isVertical && !event.metaKey && !event.altKey && !event.ctrlKey;
    if (!grid || event.defaultPrevented) {
      baseKeyDown(event);
      return;
    }

    const cell = (target as Element).closest<HTMLElement>(CELL_SELECTOR);
    const row = cell?.closest<HTMLElement>(ROW_SELECTOR);
    if (!cell || !row || !container.contains(row)) return;

    const rows = Array.from(container.querySelectorAll<HTMLElement>(ROW_SELECTOR));
    const cellsOf = (r: HTMLElement) =>
      Array.from(r.querySelectorAll<HTMLElement>(CELL_SELECTOR)).filter((el) =>
        isEnabledCell(el, container),
      );
    const goTo = (el: HTMLElement | undefined) => {
      event.preventDefault();
      const value = el?.getAttribute('data-roving-value');
      if (value != null && el !== cell) focusValue(value);
    };

    if (isHomeEnd) {
      const scope = event.ctrlKey ? rows.flatMap(cellsOf) : cellsOf(row);
      goTo(key === 'Home' ? scope[0] : scope[scope.length - 1]);
      return;
    }

    // Column distance by index in the row, counting every cell (disabled ones included).
    const column = Array.from(row.querySelectorAll<HTMLElement>(CELL_SELECTOR)).indexOf(cell);
    const delta = key === 'ArrowDown' ? 1 : -1;
    const rowIndex = rows.indexOf(row);
    for (let r = rowIndex + delta; r >= 0 && r < rows.length; r += delta) {
      const all = Array.from(rows[r].querySelectorAll<HTMLElement>(CELL_SELECTOR));
      let best: HTMLElement | undefined;
      let bestDistance = Infinity;
      all.forEach((el, index) => {
        if (!isEnabledCell(el, container)) return;
        const distance = Math.abs(index - column);
        if (distance < bestDistance) {
          best = el;
          bestDistance = distance;
        }
      });
      if (best) {
        goTo(best);
        return;
      }
    }
    // Last (or first) row: the key is the grid's, focus stays.
    event.preventDefault();
  });

  const containerProps = React.useMemo<RovingContainerProps>(
    () => ({ ...roving.containerProps, onKeyDown }),
    [roving.containerProps, onKeyDown],
  );

  return { containerProps, getTabIndex: roving.getTabIndex };
}
