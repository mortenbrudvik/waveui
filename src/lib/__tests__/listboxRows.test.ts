import { describe, expect, it } from 'vitest';
import type { ListboxItem } from '../../hooks/useListbox';
import {
  getListboxRows,
  itemGroupName,
  listboxScrollTarget,
  splitGroupNames,
} from '../listboxRows';

const item = (value: string, group?: string): ListboxItem => ({ value, label: value, group });

describe('getListboxRows', () => {
  it('is null for a list without groups, and cached by the identity of the items', () => {
    const items = [item('a'), item('b', ''), item('c', undefined)];
    expect(getListboxRows(items)).toBeNull();
    const grouped = [item('a', 'G')];
    expect(getListboxRows(grouped)).toBe(getListboxRows(grouped));
    expect(getListboxRows([])).toBeNull();
  });

  it('puts a header row before each run of adjacent items of a group', () => {
    const items = [
      item('a', 'One'),
      item('b', 'One'),
      item('c'),
      item('d', 'Two'),
      item('e', 'One'),
    ];
    const rows = getListboxRows(items)!;
    expect(
      rows.rows.map((row) => (row.kind === 'header' ? `h:${row.group.name}` : `o:${row.item}`)),
    ).toEqual(['h:One', 'o:0', 'o:1', 'o:2', 'h:Two', 'o:3', 'h:One', 'o:4']);
    expect(rows.rowOfItem).toEqual([1, 2, 3, 5, 7]);
    // A name that comes back is another group, with its own ordinal.
    const ordinals = rows.rows
      .filter((row) => row.kind === 'header')
      .map((row) => row.group.ordinal);
    expect(ordinals).toEqual([0, 1, 2]);
  });

  it('counts positions in the group, and among the ungrouped options', () => {
    const items = [item('a', 'One'), item('b', 'One'), item('c'), item('d', 'Two'), item('e')];
    const rows = getListboxRows(items)!;
    expect(rows.posInSet).toEqual([1, 2, 1, 1, 2]);
    expect(rows.setSize).toEqual([2, 2, 2, 1, 2]);
  });
});

describe('listboxScrollTarget', () => {
  it('is the index for a flat list', () => {
    expect(listboxScrollTarget(null, 3)).toEqual({ row: 3 });
  });

  it('adds the header row for the first option of a group only', () => {
    const rows = getListboxRows([item('a', 'One'), item('b', 'One'), item('c', 'Two')]);
    expect(listboxScrollTarget(rows, 0)).toEqual({ row: 1, headerRow: 0 });
    expect(listboxScrollTarget(rows, 1)).toEqual({ row: 2 });
    expect(listboxScrollTarget(rows, 2)).toEqual({ row: 4, headerRow: 3 });
  });
});

describe('group names', () => {
  it('reads a non-empty string only', () => {
    expect(itemGroupName(item('a', 'G'))).toBe('G');
    expect(itemGroupName(item('a', ''))).toBeUndefined();
    expect(itemGroupName(item('a'))).toBeUndefined();
  });

  it('finds the names that come back after other items', () => {
    expect(splitGroupNames([item('a', 'One'), item('b', 'One'), item('c', 'Two')])).toEqual([]);
    expect(
      splitGroupNames([item('a', 'One'), item('b', 'Two'), item('c', 'One'), item('d')]),
    ).toEqual(['One']);
    expect(splitGroupNames([item('a', 'One'), item('b'), item('c', 'One')])).toEqual(['One']);
  });
});
