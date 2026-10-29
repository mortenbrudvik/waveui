import { describe, it, expect } from 'vitest';
import { clearIds, selectAllIds, summarizeSelection, toggleId } from '../selection';

describe('toggleId', () => {
  it('adds and removes an id in multiple mode', () => {
    const added = toggleId(new Set(['a']), 'b', 'multiple');
    expect([...added]).toEqual(['a', 'b']);
    const removed = toggleId(added, 'a', 'multiple');
    expect([...removed]).toEqual(['b']);
  });

  it('returns a new set and leaves the argument unchanged', () => {
    const selected = new Set(['a']);
    const next = toggleId(selected, 'b', 'multiple');
    expect(next).not.toBe(selected);
    expect([...selected]).toEqual(['a']);
    const same = toggleId(selected, 'a', 'single');
    expect(same).not.toBe(selected);
    expect([...selected]).toEqual(['a']);
  });

  it('replaces the selection with the id in single mode', () => {
    expect([...toggleId(new Set(['a']), 'b', 'single')]).toEqual(['b']);
    expect([...toggleId(new Set(), 'b', 'single')]).toEqual(['b']);
  });

  it('keeps a selected id selected in single mode', () => {
    expect([...toggleId(new Set(['a']), 'a', 'single')]).toEqual(['a']);
    expect([...toggleId(new Set(['a']), 'a', 'single', { allowEmpty: false })]).toEqual(['a']);
  });

  it('clears a selected id in single mode with allowEmpty', () => {
    expect([...toggleId(new Set(['a']), 'a', 'single', { allowEmpty: true })]).toEqual([]);
  });

  it('still replaces the selection with allowEmpty when another id is selected', () => {
    expect([...toggleId(new Set(['a']), 'b', 'single', { allowEmpty: true })]).toEqual(['b']);
  });
});

describe('selectAllIds', () => {
  it('adds only the given ids and keeps foreign ones', () => {
    const next = selectAllIds(new Set(['x', 'a']), ['a', 'b', 'c']);
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'x']);
  });

  it('returns a new set and leaves the argument unchanged', () => {
    const selected = new Set(['x']);
    const next = selectAllIds(selected, ['a']);
    expect(next).not.toBe(selected);
    expect([...selected]).toEqual(['x']);
  });

  it('is harmless with duplicate ids', () => {
    expect([...selectAllIds(new Set(), ['a', 'a', 'b', 'a'])]).toEqual(['a', 'b']);
  });
});

describe('clearIds', () => {
  it('removes the ids of the universe and keeps ids outside it', () => {
    const next = clearIds(new Set(['a', 'b', 'foreign']), ['a', 'b', 'c']);
    expect([...next]).toEqual(['foreign']);
  });

  it('returns a new set and leaves the argument unchanged', () => {
    const selected = new Set(['a']);
    const next = clearIds(selected, ['a']);
    expect(next).not.toBe(selected);
    expect([...selected]).toEqual(['a']);
  });

  it('is harmless with duplicate ids', () => {
    expect([...clearIds(new Set(['a', 'b']), ['a', 'a', 'a'])]).toEqual(['b']);
  });
});

describe('summarizeSelection', () => {
  it('reports none, not all, for an empty universe', () => {
    expect(summarizeSelection(new Set(), [])).toEqual({ all: false, some: false, none: true });
    expect(summarizeSelection(new Set(['x']), [])).toEqual({
      all: false,
      some: false,
      none: true,
    });
  });

  it('reports all when every selectable id is selected', () => {
    expect(summarizeSelection(new Set(['a', 'b']), ['a', 'b'])).toEqual({
      all: true,
      some: false,
      none: false,
    });
  });

  it('reports some when part of the universe is selected', () => {
    expect(summarizeSelection(new Set(['a']), ['a', 'b'])).toEqual({
      all: false,
      some: true,
      none: false,
    });
  });

  it('reports none when nothing of the universe is selected', () => {
    expect(summarizeSelection(new Set(), ['a', 'b'])).toEqual({
      all: false,
      some: false,
      none: true,
    });
  });

  it('counts a selected disabled id toward some but not all', () => {
    // 'd' is in the universe but not selectable.
    expect(summarizeSelection(new Set(['d']), ['a', 'd'], ['a'])).toEqual({
      all: false,
      some: true,
      none: false,
    });
    // Every selectable id selected: all, even though the disabled one is not.
    expect(summarizeSelection(new Set(['a']), ['a', 'd'], ['a'])).toEqual({
      all: true,
      some: false,
      none: false,
    });
  });

  it('reports none for an empty selectable list', () => {
    expect(summarizeSelection(new Set(), ['a'], [])).toEqual({
      all: false,
      some: false,
      none: true,
    });
  });

  it('counts a selected foreign id toward nothing', () => {
    expect(summarizeSelection(new Set(['foreign']), ['a', 'b'])).toEqual({
      all: false,
      some: false,
      none: true,
    });
    expect(summarizeSelection(new Set(['a', 'b', 'foreign']), ['a', 'b'])).toEqual({
      all: true,
      some: false,
      none: false,
    });
  });

  it('is harmless with duplicate ids', () => {
    expect(summarizeSelection(new Set(['a']), ['a', 'a'], ['a', 'a'])).toEqual({
      all: true,
      some: false,
      none: false,
    });
  });

  it('handles a 10,000-id universe', () => {
    const universe = Array.from({ length: 10_000 }, (_, i) => `row-${i}`);
    const all = selectAllIds(new Set(), universe);
    expect(summarizeSelection(all, universe).all).toBe(true);
    expect(summarizeSelection(clearIds(all, universe), universe).none).toBe(true);
  });
});
