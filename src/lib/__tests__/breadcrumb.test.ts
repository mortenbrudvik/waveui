import { describe, expect, it } from 'vitest';
import {
  isTruncatableBreadcrumbContent,
  partitionBreadcrumbItems,
  truncateBreadcrumbLongName,
  truncateBreadcrumbLongTooltip,
} from '../breadcrumb';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('partitionBreadcrumbItems', () => {
  it.each([
    // [length, maxDisplayedItems, overflowIndex, start, overflow, end]
    [8, 6, 1, [0], [1, 2], [3, 4, 5, 6, 7]],
    [8, 6, 2, [0, 1], [2, 3], [4, 5, 6, 7]],
    [8, 6, 0, [], [0, 1], [2, 3, 4, 5, 6, 7]],
    [7, 6, undefined, [0], [1], [2, 3, 4, 5, 6]],
    [5, 3, 1, [0], [1, 2], [3, 4]],
    [4, 1, 0, [], [0, 1, 2], [3]],
  ])(
    '%i items, max %s, index %s hides length - max items from the index',
    (length, max, index, start, overflow, end) => {
      expect(
        partitionBreadcrumbItems({
          items: range(length),
          maxDisplayedItems: max,
          overflowIndex: index,
        }),
      ).toEqual({
        startDisplayedItems: start,
        overflowItems: overflow,
        endDisplayedItems: end,
      });
    },
  );

  it.each([
    // an index at or past the max becomes max - 1
    [8, 4, 4, [0, 1, 2], [3, 4, 5, 6], [7]],
    [8, 4, 9, [0, 1, 2], [3, 4, 5, 6], [7]],
    [8, 4, 3, [0, 1, 2], [3, 4, 5, 6], [7]],
  ])(
    '%i items, max %i, index %i clamps the index to max - 1',
    (length, max, index, start, overflow, end) => {
      expect(
        partitionBreadcrumbItems({
          items: range(length),
          maxDisplayedItems: max,
          overflowIndex: index,
        }),
      ).toEqual({
        startDisplayedItems: start,
        overflowItems: overflow,
        endDisplayedItems: end,
      });
    },
  );

  it('defaults the index to 1', () => {
    expect(partitionBreadcrumbItems({ items: range(8), maxDisplayedItems: 6 })).toEqual({
      startDisplayedItems: [0],
      overflowItems: [1, 2],
      endDisplayedItems: [3, 4, 5, 6, 7],
    });
  });

  it.each([[undefined], [0], [-3], [Number.NaN]])(
    'falls back to 6 items for a max of %s',
    (max) => {
      const result = partitionBreadcrumbItems({ items: range(9), maxDisplayedItems: max });
      expect(result.startDisplayedItems).toEqual([0]);
      expect(result.overflowItems).toEqual([1, 2, 3]);
      expect(result.endDisplayedItems).toEqual([4, 5, 6, 7, 8]);
    },
  );

  it.each([[0], [3], [6]])('gives no overflow for %i items with a max of 6', (length) => {
    const result = partitionBreadcrumbItems({ items: range(length) });
    expect(result).toEqual({ startDisplayedItems: range(length) });
    expect('overflowItems' in result).toBe(false);
    expect('endDisplayedItems' in result).toBe(false);
  });

  it('gives no overflow for fewer items than the max', () => {
    expect(
      partitionBreadcrumbItems({ items: range(3), maxDisplayedItems: 5, overflowIndex: 1 }),
    ).toEqual({ startDisplayedItems: [0, 1, 2] });
  });

  it('handles an empty list', () => {
    expect(partitionBreadcrumbItems({ items: [], maxDisplayedItems: 2 })).toEqual({
      startDisplayedItems: [],
    });
  });

  it('treats a negative index as 0', () => {
    expect(
      partitionBreadcrumbItems({ items: range(5), maxDisplayedItems: 3, overflowIndex: -2 }),
    ).toEqual({ startDisplayedItems: [], overflowItems: [0, 1], endDisplayedItems: [2, 3, 4] });
  });

  it('keeps the item objects and does not change the input', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const copy = [...items];
    const result = partitionBreadcrumbItems({ items, maxDisplayedItems: 3 });
    expect(items).toEqual(copy);
    expect(result.startDisplayedItems[0]).toBe(items[0]);
    expect(result.overflowItems?.[0]).toBe(items[1]);
    expect(result.endDisplayedItems).toEqual([items[2], items[3]]);
    expect(result.startDisplayedItems).not.toBe(items);
  });

  it('accepts a readonly array', () => {
    const items: readonly string[] = ['a', 'b', 'c'];
    expect(partitionBreadcrumbItems({ items, maxDisplayedItems: 2 }).overflowItems).toEqual(['b']);
  });
});

describe('truncateBreadcrumbLongName', () => {
  it('cuts text over 30 characters and adds an ellipsis', () => {
    const text = 'a'.repeat(31);
    expect(truncateBreadcrumbLongName(text)).toBe('a'.repeat(30) + '...');
  });

  it('leaves text of exactly the limit untouched', () => {
    const text = 'a'.repeat(30);
    expect(truncateBreadcrumbLongName(text)).toBe(text);
  });

  it('takes the limit as an argument', () => {
    expect(truncateBreadcrumbLongName('Documents and settings', 9)).toBe('Documents...');
  });

  it('trims the text before it cuts, so a leading space does not count', () => {
    expect(truncateBreadcrumbLongName('  hello world', 4)).toBe('hell...');
  });

  it('leaves short text untouched', () => {
    expect(truncateBreadcrumbLongName('Home')).toBe('Home');
    expect(truncateBreadcrumbLongName('')).toBe('');
  });
});

describe('truncateBreadcrumbLongTooltip', () => {
  it('cuts text over 80 characters and adds an ellipsis', () => {
    expect(truncateBreadcrumbLongTooltip('b'.repeat(81))).toBe('b'.repeat(80) + '...');
  });

  it('leaves text of exactly the limit untouched', () => {
    const text = 'b'.repeat(80);
    expect(truncateBreadcrumbLongTooltip(text)).toBe(text);
  });

  it('takes the limit as an argument', () => {
    expect(truncateBreadcrumbLongTooltip('abcdef', 3)).toBe('abc...');
  });
});

describe('isTruncatableBreadcrumbContent', () => {
  it.each([
    ['a'.repeat(31), 30, true],
    ['a'.repeat(30), 30, false],
    ['a'.repeat(29), 30, false],
    ['', 30, false],
    ['a'.repeat(81), 80, true],
    ['a'.repeat(80), 80, false],
  ])('%j with a limit of %i gives %s', (content, max, expected) => {
    expect(isTruncatableBreadcrumbContent(content, max)).toBe(expected);
  });
});
