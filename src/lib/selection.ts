import type { SelectionMode } from './types';

/**
 * Toggles `id` in a selection and returns a new set; the argument is never mutated.
 *
 * `multiple` adds or removes the id. `single` replaces the selection with the id; when that id
 * is the selection already it stays selected, unless `options.allowEmpty` clears it.
 */
export function toggleId(
  selected: ReadonlySet<string>,
  id: string,
  mode: SelectionMode,
  options?: { allowEmpty?: boolean },
): Set<string> {
  if (mode === 'single') {
    return selected.has(id) && options?.allowEmpty ? new Set() : new Set([id]);
  }
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Adds `selectableIds` to a selection, keeping every id already in it (foreign ones too). */
export function selectAllIds(
  selected: ReadonlySet<string>,
  selectableIds: readonly string[],
): Set<string> {
  const next = new Set(selected);
  for (const id of selectableIds) next.add(id);
  return next;
}

/** Removes the ids of `universe` from a selection; ids outside the universe stay selected. */
export function clearIds(selected: ReadonlySet<string>, universe: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of universe) next.delete(id);
  return next;
}

/**
 * Summarises a selection over `universe`. `all`: `selectableIds` (default `universe`) is
 * non-empty and every id in it is selected. `some`: an id of `universe` is selected and not
 * `all`, so a selected disabled id counts. `none`: neither. Ids outside `universe` count toward
 * nothing.
 */
export function summarizeSelection(
  selected: ReadonlySet<string>,
  universe: readonly string[],
  selectableIds: readonly string[] = universe,
): { all: boolean; some: boolean; none: boolean } {
  const all = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const some = !all && universe.some((id) => selected.has(id));
  return { all, some, none: !all && !some };
}
