import { describe, it, expect } from 'vitest';
import {
  buildFlatTreeIndex,
  flatTreeForest,
  visibleFlatItems,
  type FlatTreeItemData,
} from '../flatTree';
import { computeCheckStates, type TreeNode } from '../treeCascade';

const item = (
  value: string,
  parentValue?: string,
  extra: Partial<FlatTreeItemData> = {},
): FlatTreeItemData => ({
  value,
  ...(parentValue === undefined ? {} : { parentValue }),
  ...extra,
});

/**
 * docs
 *   work
 *     report
 *     slides
 *   personal
 * images
 *   photo
 * readme
 *
 * Written out of order on purpose: parents may appear anywhere.
 */
const FILES: FlatTreeItemData[] = [
  item('docs'),
  item('report', 'work'),
  item('work', 'docs'),
  item('images'),
  item('slides', 'work'),
  item('personal', 'docs'),
  item('photo', 'images'),
  item('readme'),
];

const summary = (visible: ReturnType<typeof visibleFlatItems>) =>
  visible.map((v) => [v.item.value, v.level, v.position, v.setSize]);

const NESTED: TreeNode[] = [
  {
    value: 'docs',
    children: [
      {
        value: 'work',
        children: [
          { value: 'report', children: [] },
          { value: 'slides', children: [] },
        ],
      },
      { value: 'personal', children: [] },
    ],
  },
  { value: 'images', children: [{ value: 'photo', children: [] }] },
  { value: 'readme', children: [] },
];

describe('buildFlatTreeIndex', () => {
  it('orders roots and siblings by the order of items and resolves levels, positions and set sizes', () => {
    const index = buildFlatTreeIndex(FILES);
    expect(index.issues).toEqual([]);
    expect(index.roots).toEqual(['docs', 'images', 'readme']);
    expect(index.byValue.get('docs')).toMatchObject({ level: 1, position: 1, setSize: 3 });
    expect(index.byValue.get('work')).toMatchObject({
      level: 2,
      position: 1,
      setSize: 2,
      parentValue: 'docs',
      children: ['report', 'slides'],
    });
    expect(index.byValue.get('personal')).toMatchObject({ level: 2, position: 2, setSize: 2 });
    expect(index.byValue.get('slides')).toMatchObject({ level: 3, position: 2, setSize: 2 });
    expect(index.byValue.get('readme')).toMatchObject({ level: 1, position: 3, setSize: 3 });
  });

  it('counts an item with child items as having children, and a childless branch as a branch', () => {
    const index = buildFlatTreeIndex([
      item('a'),
      item('b', 'a'),
      item('empty', undefined, { itemType: 'branch' }),
      item('leaf', undefined, { itemType: 'leaf' }),
    ]);
    expect(index.byValue.get('a')).toMatchObject({ hasChildren: true, isBranch: true });
    expect(index.byValue.get('b')).toMatchObject({ hasChildren: false, isBranch: false });
    expect(index.byValue.get('empty')).toMatchObject({ hasChildren: false, isBranch: true });
    expect(index.byValue.get('leaf')).toMatchObject({ hasChildren: false, isBranch: false });
  });

  it('keeps the first of a duplicated value and reports each ignored item', () => {
    const index = buildFlatTreeIndex([
      item('a', undefined, { label: 'first' }),
      item('b', 'a'),
      item('a', undefined, { label: 'second' }),
      item('a', 'b'),
    ]);
    expect(index.byValue.get('a')?.item.label).toBe('first');
    expect(index.byValue.size).toBe(2);
    expect(index.roots).toEqual(['a']);
    expect(index.issues).toEqual([
      { kind: 'duplicate-value', value: 'a', index: 2 },
      { kind: 'duplicate-value', value: 'a', index: 3 },
    ]);
  });

  it('makes an item with an unknown parent a root and reports it', () => {
    const index = buildFlatTreeIndex([item('a'), item('b', 'missing'), item('c', 'b')]);
    expect(index.roots).toEqual(['a', 'b']);
    expect(index.byValue.get('b')).toMatchObject({ level: 1, parentValue: undefined });
    expect(index.byValue.get('c')).toMatchObject({ level: 2, parentValue: 'b' });
    expect(index.issues).toEqual([{ kind: 'unknown-parent', value: 'b', parentValue: 'missing' }]);
  });

  it('cuts a cycle at the repeated value, which becomes a root, and terminates', () => {
    const index = buildFlatTreeIndex([item('a', 'b'), item('b', 'c'), item('c', 'a'), item('d')]);
    expect(index.issues).toEqual([{ kind: 'cycle', value: 'a' }]);
    expect(index.roots).toEqual(['a', 'd']);
    expect(index.byValue.get('c')).toMatchObject({ level: 2, parentValue: 'a' });
    expect(index.byValue.get('b')).toMatchObject({ level: 3, parentValue: 'c' });
    expect(summary(visibleFlatItems(index, new Set(['a', 'b', 'c'])))).toEqual([
      ['a', 1, 1, 2],
      ['c', 2, 1, 1],
      ['b', 3, 1, 1],
      ['d', 1, 2, 2],
    ]);
  });

  it('treats an item that is its own parent as a one-item cycle', () => {
    const index = buildFlatTreeIndex([item('a', 'a'), item('b', 'a')]);
    expect(index.issues).toEqual([{ kind: 'cycle', value: 'a' }]);
    expect(index.roots).toEqual(['a']);
    expect(index.byValue.get('b')).toMatchObject({ level: 2, parentValue: 'a' });
  });

  it('reports a cycle once when several items lead into it', () => {
    const index = buildFlatTreeIndex([item('x', 'a'), item('a', 'b'), item('b', 'a')]);
    expect(index.issues).toEqual([{ kind: 'cycle', value: 'a' }]);
    expect(index.roots).toEqual(['a']);
    expect(index.byValue.get('x')).toMatchObject({ level: 2, parentValue: 'a' });
    expect(index.byValue.get('b')).toMatchObject({ level: 2, parentValue: 'a' });
  });

  it('builds a 5,000 level chain without recursing', () => {
    const items = Array.from({ length: 5000 }, (_, i) =>
      item(`n${i}`, i === 0 ? undefined : `n${i - 1}`),
    );
    const index = buildFlatTreeIndex(items.reverse());
    expect(index.issues).toEqual([]);
    expect(index.byValue.get('n4999')?.level).toBe(5000);
    const expanded = new Set(Array.from({ length: 5000 }, (_, i) => `n${i}`));
    const visible = visibleFlatItems(index, expanded);
    expect(visible).toHaveLength(5000);
    expect(visible[4999]).toMatchObject({ level: 5000, index: 4999 });
    let depth = 0;
    let node: TreeNode | undefined = flatTreeForest(index)[0];
    while (node) {
      depth += 1;
      node = node.children[0];
    }
    expect(depth).toBe(5000);
  });
});

describe('visibleFlatItems', () => {
  const index = buildFlatTreeIndex(FILES);

  it('lists only the roots while nothing is expanded', () => {
    const visible = visibleFlatItems(index, new Set());
    expect(summary(visible)).toEqual([
      ['docs', 1, 1, 3],
      ['images', 1, 2, 3],
      ['readme', 1, 3, 3],
    ]);
    expect(visible.map((v) => v.expanded)).toEqual([false, false, false]);
    expect(visible.map((v) => v.hasChildren)).toEqual([true, true, false]);
    expect(visible.map((v) => v.index)).toEqual([0, 1, 2]);
    expect(visible.map((v) => v.parentValue)).toEqual([undefined, undefined, undefined]);
  });

  it('lists a three level tree in tree order with levels, positions and set sizes', () => {
    const visible = visibleFlatItems(index, new Set(['docs', 'work', 'images']));
    expect(summary(visible)).toEqual([
      ['docs', 1, 1, 3],
      ['work', 2, 1, 2],
      ['report', 3, 1, 2],
      ['slides', 3, 2, 2],
      ['personal', 2, 2, 2],
      ['images', 1, 2, 3],
      ['photo', 2, 1, 1],
      ['readme', 1, 3, 3],
    ]);
    expect(visible.map((v) => v.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(visible.find((v) => v.item.value === 'report')?.parentValue).toBe('work');
    expect(visible.find((v) => v.item.value === 'work')).toMatchObject({
      expanded: true,
      hasChildren: true,
    });
  });

  it('hides the descendants of a collapsed branch even when they are expanded', () => {
    const visible = visibleFlatItems(index, new Set(['work']));
    expect(visible.map((v) => v.item.value)).toEqual(['docs', 'images', 'readme']);
  });

  it('ignores an expanded value whose item is missing, and an expanded leaf', () => {
    const visible = visibleFlatItems(index, new Set(['ghost', 'readme']));
    expect(visible.map((v) => v.item.value)).toEqual(['docs', 'images', 'readme']);
    expect(visible[2].expanded).toBe(false);
  });

  it('marks an expanded childless branch as expanded', () => {
    const own = buildFlatTreeIndex([item('empty', undefined, { itemType: 'branch' })]);
    expect(visibleFlatItems(own, new Set(['empty']))[0]).toMatchObject({
      expanded: true,
      hasChildren: false,
    });
    expect(visibleFlatItems(own, new Set())[0].expanded).toBe(false);
  });

  it('returns the item data it was given', () => {
    const data = item('a', undefined, { label: 'A', disabled: true });
    const visible = visibleFlatItems(buildFlatTreeIndex([data]), new Set());
    expect(visible[0].item).toBe(data);
  });

  it('lists only the visible items of 5,000 with 1% of them expanded', () => {
    const items: FlatTreeItemData[] = [];
    for (let r = 0; r < 500; r += 1) {
      items.push(item(`r${r}`));
      for (let c = 0; c < 9; c += 1) items.push(item(`r${r}c${c}`, `r${r}`));
    }
    expect(items).toHaveLength(5000);
    const expanded = new Set(Array.from({ length: 50 }, (_, i) => `r${i * 10}`));
    const visible = visibleFlatItems(buildFlatTreeIndex(items), expanded);
    expect(visible).toHaveLength(500 + 50 * 9);
    expect(visible[0].item.value).toBe('r0');
    expect(visible[1].item.value).toBe('r0c0');
    expect(visible[10].item.value).toBe('r1');
  });
});

describe('flatTreeForest', () => {
  it('builds the nested equivalent of the flat items', () => {
    expect(flatTreeForest(buildFlatTreeIndex(FILES))).toEqual(NESTED);
  });

  it('feeds the cascade and gives the states of the nested equivalent', () => {
    const forest = flatTreeForest(buildFlatTreeIndex(FILES));
    for (const listed of [
      [],
      ['report'],
      ['work'],
      ['report', 'slides', 'personal'],
      ['docs', 'photo'],
    ]) {
      expect(computeCheckStates(forest, new Set(listed))).toEqual(
        computeCheckStates(NESTED, new Set(listed)),
      );
    }
  });
});
