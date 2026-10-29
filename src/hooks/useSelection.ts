import { useCallback, useMemo, useRef, useState } from 'react';
import { useControllable } from './useControllable';
import { clearIds, selectAllIds, summarizeSelection, toggleId } from '../lib/selection';
import type { SelectionMode } from '../lib/types';

/** What {@link UseSelectionOptions.onSelectedItemsChange} receives as its second argument. */
export interface UseSelectionChangeDetails {
  /** The event that caused the change, when the caller passed one. */
  event?: Event;
  /** The id that was toggled, selected or deselected. Absent for `toggleAll` and `clear`. */
  id?: string;
}

/** Options of {@link useSelection}. */
export interface UseSelectionOptions {
  /**
   * `single` keeps at most one id selected and never deselects through `toggle`; `multiple` toggles
   * ids independently.
   */
  selectionMode: SelectionMode;
  /** The selected ids (controlled). Pair it with `onSelectedItemsChange`. */
  selectedItems?: readonly string[];
  /**
   * The ids selected at first render (uncontrolled).
   * @default []
   */
  defaultSelectedItems?: readonly string[];
  /**
   * Called with a new array of the selected ids whenever the selection changes. A call that leaves
   * the selection as it is (selecting a selected id, toggling the selected id in `single` mode)
   * does not call it.
   */
  onSelectedItemsChange?: (selectedItems: string[], details?: UseSelectionChangeDetails) => void;
}

/** What {@link useSelection} returns. */
export interface UseSelectionResult {
  /** The mode the hook was given. */
  selectionMode: SelectionMode;
  /**
   * The selected ids. The same set object is returned while the ids stay the same, so it can key a
   * memo. It holds ids whose items are not rendered.
   */
  selectedItems: ReadonlySet<string>;
  /** Whether `id` is selected. */
  isSelected(id: string): boolean;
  /** Toggles `id`: in `multiple` mode adds or removes it, in `single` mode selects it. */
  toggle(id: string, event?: Event): void;
  /** Selects `id`; in `single` mode it replaces the selection. */
  select(id: string, event?: Event): void;
  /** Removes `id` from the selection. */
  deselect(id: string, event?: Event): void;
  /**
   * Selects every id of `universe` when not all of them are selected, else removes only the ids of
   * `universe`: ids outside it stay selected. It does nothing in `single` mode.
   */
  toggleAll(universe: readonly string[], event?: Event): void;
  /** Empties the selection, ids outside any universe included. */
  clear(event?: Event): void;
}

const NO_IDS: readonly string[] = [];

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((id, index) => id === b[index]));
}

/**
 * Selection by id, held outside the DOM, for lists, tables and trees whose items are not all
 * rendered. State is controlled with `selectedItems` or uncontrolled with `defaultSelectedItems`;
 * `onSelectedItemsChange` fires once per change, never for a no-op.
 *
 * @example
 * const selection = useSelection({ selectionMode: 'multiple' });
 * selection.toggleAll(rows.map((row) => row.id));
 */
export function useSelection({
  selectionMode,
  selectedItems: selectedItemsProp,
  defaultSelectedItems,
  onSelectedItemsChange,
}: UseSelectionOptions): UseSelectionResult {
  // The details of the change in flight: set by the action just before it asks for the change, read
  // by the change callback, which `useControllable` calls synchronously from the same action.
  const detailsRef = useRef<UseSelectionChangeDetails | undefined>(undefined);
  const [ids, setIds] = useControllable<readonly string[]>(
    selectedItemsProp,
    defaultSelectedItems ?? NO_IDS,
    (next) => onSelectedItemsChange?.([...next], detailsRef.current),
  );

  // The set is rebuilt only when the ids differ, by content: a controlled parent that passes a new
  // array of the same ids on every render keeps the same set.
  const [cache, setCache] = useState(() => ({ ids, set: new Set(ids) as ReadonlySet<string> }));
  let selectedItems = cache.set;
  if (!sameIds(cache.ids, ids)) {
    selectedItems = new Set(ids);
    setCache({ ids, set: selectedItems });
  }

  const change = useCallback(
    (
      update: (prev: ReadonlySet<string>) => ReadonlySet<string>,
      details: UseSelectionChangeDetails,
    ) => {
      detailsRef.current = details;
      setIds((prev) => {
        const next = [...update(new Set(prev))];
        return sameIds(prev, next) ? prev : next;
      });
      detailsRef.current = undefined;
    },
    [setIds],
  );

  return useMemo<UseSelectionResult>(
    () => ({
      selectionMode,
      selectedItems,
      isSelected: (id) => selectedItems.has(id),
      toggle: (id, event) => change((prev) => toggleId(prev, id, selectionMode), { event, id }),
      select: (id, event) =>
        change((prev) => (selectionMode === 'single' ? new Set([id]) : new Set(prev).add(id)), {
          event,
          id,
        }),
      deselect: (id, event) =>
        change(
          (prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          },
          { event, id },
        ),
      toggleAll: (universe, event) => {
        if (selectionMode === 'single') return;
        change(
          (prev) =>
            summarizeSelection(prev, universe).all
              ? clearIds(prev, universe)
              : selectAllIds(prev, universe),
          { event },
        );
      },
      clear: (event) => change(() => new Set(), { event }),
    }),
    [selectionMode, selectedItems, change],
  );
}
