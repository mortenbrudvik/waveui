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

/**
 * Internal. Roving focus for a two-dimensional grid of cells (SwatchPicker's grid layout):
 * `useRovingTabIndex` with `orientation: 'grid'`, which holds the grid keys. Rows are the
 * `role="row"` elements inside the container and cells their `[data-roving-value]` elements; see
 * the hook's `orientation` option for the keys. The tab stop is the last focused cell, else the
 * selected one, else the first enabled.
 *
 * @param options - See {@link UseRovingGridOptions}.
 * @returns See {@link UseRovingGridResult}.
 */
export function useRovingGrid({ activeValue }: UseRovingGridOptions): UseRovingGridResult {
  const { containerProps, getTabIndex } = useRovingTabIndex({
    activeValue,
    orientation: 'grid',
    loop: false,
    homeEndKeys: false,
    tabStop: 'last-focused',
  });
  return { containerProps, getTabIndex };
}
