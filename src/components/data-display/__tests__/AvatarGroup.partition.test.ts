import { describe, expect, it } from 'vitest';
import { partitionAvatarGroupItems } from '../AvatarGroup.partition';

const items = ['a', 'b', 'c', 'd', 'e'];

describe('partitionAvatarGroupItems', () => {
  it('keeps every item inline without a limit', () => {
    expect(partitionAvatarGroupItems({ items })).toEqual({
      inlineItems: items,
      overflowItems: undefined,
    });
  });

  it('keeps every item inline when the limit is not below the count', () => {
    expect(partitionAvatarGroupItems({ items, maxInlineItems: 5 }).overflowItems).toBeUndefined();
    expect(partitionAvatarGroupItems({ items, maxInlineItems: 99 }).inlineItems).toEqual(items);
  });

  it('moves the items past the limit to the overflow', () => {
    expect(partitionAvatarGroupItems({ items, maxInlineItems: 3 })).toEqual({
      inlineItems: ['a', 'b', 'c'],
      overflowItems: ['d', 'e'],
    });
  });

  it.each([0, -1, -10])('a limit of %d sends everything to the overflow', (maxInlineItems) => {
    expect(partitionAvatarGroupItems({ items, maxInlineItems })).toEqual({
      inlineItems: [],
      overflowItems: items,
    });
  });

  it('floors a fraction and ignores NaN', () => {
    expect(partitionAvatarGroupItems({ items, maxInlineItems: 2.9 }).inlineItems).toEqual([
      'a',
      'b',
    ]);
    expect(partitionAvatarGroupItems({ items, maxInlineItems: Number.NaN }).inlineItems).toEqual(
      items,
    );
  });

  it('handles an empty list', () => {
    expect(partitionAvatarGroupItems({ items: [], maxInlineItems: 2 })).toEqual({
      inlineItems: [],
      overflowItems: undefined,
    });
  });

  it('caps a pie at three inline items', () => {
    expect(partitionAvatarGroupItems({ items, layout: 'pie' })).toEqual({
      inlineItems: ['a', 'b', 'c'],
      overflowItems: ['d', 'e'],
    });
    expect(
      partitionAvatarGroupItems({ items, layout: 'pie', maxInlineItems: 2 }).inlineItems,
    ).toEqual(['a', 'b']);
    expect(
      partitionAvatarGroupItems({ items, layout: 'pie', maxInlineItems: 5 }).inlineItems,
    ).toEqual(['a', 'b', 'c']);
    expect(
      partitionAvatarGroupItems({ items: ['a', 'b'], layout: 'pie' }).overflowItems,
    ).toBeUndefined();
  });

  it('does not change the list it receives', () => {
    const frozen = Object.freeze([...items]);
    expect(() => partitionAvatarGroupItems({ items: frozen, maxInlineItems: 2 })).not.toThrow();
  });
});
