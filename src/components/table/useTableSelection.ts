import { useMemo } from 'react';
import { useSelection, type UseSelectionOptions } from '../../hooks/useSelection';
import { summarizeSelection } from '../../lib/selection';
import {
  createTableFeaturePlugin,
  type TableFeaturePlugin,
  type TableSelectionState,
} from './useTableFeatures';

/** Options of {@link useTableSelection}: those of `useSelection`, plus the disabled rows. */
export interface UseTableSelectionOptions<T> extends UseSelectionOptions {
  /**
   * Whether the selection of an item cannot change through select-all: `toggleAllRows` skips it,
   * and `allRowsSelected` does not wait for it. A disabled row keeps its state. The single-row
   * functions do not read it: disable the row's own control. Called for every item of `items`
   * whenever `useTableFeatures` computes its state: when the selection, `items`, `getRowId`,
   * `columns`, the sort or another plugin's state (the column widths) change, and when this
   * function changes. A function written inline is a new one on every render, so the state is
   * then computed, and this function called for every item, on every render (no more: no extra
   * render, and `getRows()` keeps its array); define it outside the component or memoise it to
   * call it only on those changes.
   */
  isDisabled?: (item: T, index: number) => boolean;
}

/**
 * The selection plugin of `useTableFeatures`: a set of row ids (`selectedItems`, controlled, or
 * `defaultSelectedItems`), and `state.selection` with select-all over every item of `items`,
 * rendered or not. Select-all selects every selectable row and leaves the other ids as they are;
 * deselecting all removes only the selectable ids of `items`, so a selected disabled row and ids
 * selected on another page or filtered out stay selected (`clearRows` empties the selection).
 * `onSelectedItemsChange` fires once per change with a new array of every selected id. Call it
 * unconditionally and pass the plugin to `useTableFeatures`.
 *
 * @example
 * const { selection } = useTableFeatures({ items, columns, getRowId }, [
 *   useTableSelection({ selectionMode: 'multiple', onSelectedItemsChange: setSelected }),
 * ]);
 */
export function useTableSelection<T>(options: UseTableSelectionOptions<T>): TableFeaturePlugin<T> {
  const { isDisabled, ...selectionOptions } = options;
  const selection = useSelection(selectionOptions);

  return useMemo(
    () =>
      createTableFeaturePlugin<T>({
        feature: 'selection',
        extend: (state) => {
          // The universe is every row id of `items`, in their order; the selectable ids leave out
          // the disabled rows.
          const universe: string[] = [];
          const selectable: string[] = [];
          state.items.forEach((item, index) => {
            const id = state.getRowId(item, index);
            universe.push(id);
            if (!isDisabled?.(item, index)) selectable.push(id);
          });
          const { all, some } = summarizeSelection(selection.selectedItems, universe, selectable);
          const selectionState: TableSelectionState = {
            selectionMode: selection.selectionMode,
            selectedItems: selection.selectedItems,
            allRowsSelected: all,
            someRowsSelected: some,
            isRowSelected: selection.isSelected,
            toggleRow: selection.toggle,
            selectRow: selection.select,
            deselectRow: selection.deselect,
            // Over the selectable ids: all of them selected removes them (a disabled row and ids
            // outside `items` keep their state), else adds them.
            toggleAllRows: (event) => selection.toggleAll(selectable, event),
            clearRows: selection.clear,
          };
          return { ...state, selection: selectionState };
        },
      }),
    [selection, isDisabled],
  );
}
