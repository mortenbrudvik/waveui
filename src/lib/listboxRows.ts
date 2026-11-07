import type { ListboxItem } from '../hooks/useListbox';

/*
 * The rows of a data-mode listbox with option groups (`ListboxItem.group`): a header row before
 * each group, and a row for every option, in list order. A virtual window counts rows, so the
 * headers are rows of the window; keys, typeahead and selection keep counting options only.
 * Server-safe and pure (it imports a type); module-only.
 */

/** A run of adjacent items that share a `group` name. */
export interface ListboxGroup {
  /** The group's name (`ListboxItem.group`). */
  name: string;
  /** The group's place among the groups, from 0. */
  ordinal: number;
  /** The number of options in the group (the shown items). */
  size: number;
  /** The index, among the shown items, of the group's first option. */
  firstItem: number;
  /** The row of the group's header. */
  headerRow: number;
}

/** A header row, or the row of the option at `item` (among the shown items). */
export type ListboxRow =
  | { readonly kind: 'header'; readonly group: ListboxGroup }
  | { readonly kind: 'option'; readonly item: number; readonly group: ListboxGroup | null };

/** The rows of a list that has groups. */
export interface ListboxRows {
  rows: readonly ListboxRow[];
  /** The row of each option, by its index among the shown items. */
  rowOfItem: readonly number[];
  /** `aria-posinset` of each option: its place in its group, or among the ungrouped options. */
  posInSet: readonly number[];
  /** `aria-setsize` of each option: the size of its group, or the number of ungrouped options. */
  setSize: readonly number[];
}

/** Where to scroll for an option: its row, and its group's header row when it opens its group. */
export interface ListboxScrollTarget {
  row: number;
  headerRow?: number;
}

const cache = new WeakMap<readonly ListboxItem[], ListboxRows | null>();

/** Whether `item` belongs to a group: a non-empty `group` name. */
export function itemGroupName(item: ListboxItem): string | undefined {
  const { group } = item;
  return typeof group === 'string' && group !== '' ? group : undefined;
}

/**
 * The rows of `items` (the shown items, in order), or `null` when no item has a group, which
 * keeps a flat list on its own, unchanged path. Adjacent items with the same `group` form a
 * group; a name that comes back after other items starts another group.
 */
export function getListboxRows(items: readonly ListboxItem[]): ListboxRows | null {
  const cached = cache.get(items);
  if (cached !== undefined) return cached;
  const built = buildListboxRows(items);
  cache.set(items, built);
  return built;
}

function buildListboxRows(items: readonly ListboxItem[]): ListboxRows | null {
  if (!items.some((item) => itemGroupName(item) !== undefined)) return null;
  const rows: ListboxRow[] = [];
  const rowOfItem: number[] = [];
  const posInSet: number[] = [];
  const setSize: number[] = [];
  const groups: ListboxGroup[] = [];
  let current: ListboxGroup | null = null;
  let ungrouped = 0;
  for (let index = 0; index < items.length; index += 1) {
    const name = itemGroupName(items[index]);
    if (name === undefined) {
      current = null;
      ungrouped += 1;
      posInSet.push(ungrouped);
    } else {
      if (current === null || current.name !== name) {
        current = {
          name,
          ordinal: groups.length,
          size: 0,
          firstItem: index,
          headerRow: rows.length,
        };
        groups.push(current);
        rows.push({ kind: 'header', group: current });
      }
      current.size += 1;
      posInSet.push(current.size);
    }
    rowOfItem.push(rows.length);
    rows.push({ kind: 'option', item: index, group: current });
  }
  for (const row of rows) {
    if (row.kind === 'option') setSize.push(row.group ? row.group.size : ungrouped);
  }
  return { rows, rowOfItem, posInSet, setSize };
}

/** Where a window scrolls to show the option at `item` (see {@link ListboxScrollTarget}). */
export function listboxScrollTarget(rows: ListboxRows | null, item: number): ListboxScrollTarget {
  if (!rows) return { row: item };
  const group = (rows.rows[rows.rowOfItem[item]] as { group: ListboxGroup | null }).group;
  return group !== null && group.firstItem === item
    ? { row: rows.rowOfItem[item], headerRow: group.headerRow }
    : { row: rows.rowOfItem[item] };
}

/** The names that come back after other items (`ListboxItem.group` of non-adjacent items). */
export function splitGroupNames(items: readonly ListboxItem[]): string[] {
  const seen = new Set<string>();
  const split = new Set<string>();
  let previous: string | undefined;
  for (const item of items) {
    const name = itemGroupName(item);
    if (name !== undefined && name !== previous && seen.has(name)) split.add(name);
    if (name !== undefined) seen.add(name);
    previous = name;
  }
  return [...split];
}
