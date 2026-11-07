import { describe, expect, it } from 'vitest';
import { MAX_RESULTS, matchTier, searchEntries, type SearchEntry } from './match';

const component = (label: string, detail = 'Tables'): SearchEntry => ({
  label,
  kind: 'component',
  href: `/waveui/docs/components/${label.toLowerCase()}`,
  detail,
});
const prop = (label: string): SearchEntry => ({
  label,
  kind: 'prop',
  href: `/waveui/docs/components/${label.split('.')[0]!.toLowerCase()}#props`,
});
const page = (label: string): SearchEntry => ({ label, kind: 'page', href: '/waveui/docs/x' });

const ENTRIES: SearchEntry[] = [
  prop('DataGrid.columns'),
  prop('Calendar.dateFormat'),
  component('Grid', 'Layout'),
  prop('DatePicker.value'),
  component('DatePicker', 'Inputs'),
  component('Card', 'Data display'),
  component('DataGrid'),
  prop('Button.disabled'),
  page('Theming'),
  prop('WaveProvider.theme'),
  component('Update'),
];

const labels = (entries: readonly SearchEntry[]) => entries.map((entry) => entry.label);

describe('matchTier', () => {
  it('ranks a prefix, then a word start, then any other substring; null when absent', () => {
    expect(matchTier('DataGrid', 'dat')).toBe(0);
    // A camel-case hump, a dot, a space and a hyphen start a word.
    expect(matchTier('DataGrid', 'grid')).toBe(1);
    expect(matchTier('DataGrid.columns', 'col')).toBe(1);
    expect(matchTier('Getting started', 'sta')).toBe(1);
    expect(matchTier('high-contrast', 'con')).toBe(1);
    expect(matchTier('Update', 'dat')).toBe(2);
    expect(matchTier('Button', 'xyz')).toBeNull();
  });

  it('is case-insensitive and finds a word start after an earlier substring hit', () => {
    expect(matchTier('DATAGRID', 'Dat')).toBe(0);
    // "ate" is inside "Date" and starts "AteLast": the word start wins.
    expect(matchTier('DateAteLast', 'ate')).toBe(1);
  });
});

describe('searchEntries', () => {
  it('typing "dat" lists DataGrid and DatePicker first', () => {
    const results = searchEntries(ENTRIES, 'dat');
    expect(labels(results).slice(0, 2)).toEqual(['DataGrid', 'DatePicker']);
    // Then the prefix props, then the word starts, and the substring hits come last.
    expect(labels(results)).toEqual([
      'DataGrid',
      'DatePicker',
      'DataGrid.columns',
      'DatePicker.value',
      'Calendar.dateFormat',
      'Update',
    ]);
  });

  it('a prop name finds its component', () => {
    const [first] = searchEntries(ENTRIES, 'columns');
    expect(first).toEqual(prop('DataGrid.columns'));
    expect(first!.href).toBe('/waveui/docs/components/datagrid#props');
  });

  it('ranks components above props and pages, at the same strength of match', () => {
    expect(labels(searchEntries(ENTRIES, 'them'))).toEqual(['Theming', 'WaveProvider.theme']);
    expect(labels(searchEntries(ENTRIES, 'grid'))).toEqual([
      'Grid',
      'DataGrid',
      'DataGrid.columns',
    ]);
  });

  it('returns at most ten results, nothing for an empty query, and ignores outer spaces', () => {
    const many = Array.from({ length: 30 }, (_, index) => prop(`Item.value${index}`));
    expect(searchEntries(many, 'item')).toHaveLength(MAX_RESULTS);
    expect(MAX_RESULTS).toBe(10);
    expect(searchEntries(ENTRIES, '')).toEqual([]);
    expect(searchEntries(ENTRIES, '   ')).toEqual([]);
    expect(labels(searchEntries(ENTRIES, '  card '))).toEqual(['Card']);
  });

  it('is stable: the same input gives the same order, whatever the order of the entries', () => {
    const reversed = [...ENTRIES].reverse();
    expect(searchEntries(reversed, 'dat')).toEqual(searchEntries(ENTRIES, 'dat'));
    expect(searchEntries(reversed, 'a')).toEqual(searchEntries(ENTRIES, 'a'));
  });
});
