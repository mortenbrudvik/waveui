import { describe, it, expect } from 'vitest';
import {
  allItemValues,
  checkItems,
  checkItemsIndependent,
  computeCheckStates,
  toggleCheck,
  toggleCheckIndependent,
  type CheckState,
  type TreeNode,
} from '../treeCascade';

const node = (value: string, ...children: TreeNode[]): TreeNode => ({ value, children });

/**
 * docs
 *   work
 *     report
 *     slides
 *   personal
 * images
 *   photo
 * readme
 */
const FILES: TreeNode[] = [
  node('docs', node('work', node('report'), node('slides')), node('personal')),
  node('images', node('photo')),
  node('readme'),
];

const statesOf = (listed: string[], nodes: TreeNode[] = FILES, ancestorListed = false) =>
  Object.fromEntries(computeCheckStates(nodes, new Set(listed), ancestorListed));

describe('computeCheckStates', () => {
  it.each<[string, string[], Record<string, CheckState>]>([
    [
      'a listed leaf: its ancestors are mixed',
      ['report'],
      {
        report: 'checked',
        slides: 'unchecked',
        work: 'mixed',
        docs: 'mixed',
        personal: 'unchecked',
      },
    ],
    [
      'all children checked: the parent is checked',
      ['report', 'slides'],
      { work: 'checked', docs: 'mixed' },
    ],
    [
      'checks propagate up two levels',
      ['report', 'slides', 'personal'],
      { work: 'checked', docs: 'checked' },
    ],
    [
      'a listed parent checks every descendant',
      ['docs'],
      {
        docs: 'checked',
        work: 'checked',
        report: 'checked',
        slides: 'checked',
        personal: 'checked',
        images: 'unchecked',
      },
    ],
    [
      'a listed middle item checks below and mixes above',
      ['work'],
      {
        work: 'checked',
        report: 'checked',
        slides: 'checked',
        docs: 'mixed',
        personal: 'unchecked',
      },
    ],
    [
      'a single checked child checks its parent',
      ['photo'],
      { images: 'checked', photo: 'checked' },
    ],
    [
      'a leaf is checked only when listed or under a listed ancestor',
      ['readme'],
      { readme: 'checked', docs: 'unchecked', photo: 'unchecked' },
    ],
    [
      'values that match no item change nothing',
      ['ghost'],
      { docs: 'unchecked', readme: 'unchecked' },
    ],
  ])('%s', (_name, listed, expected) => {
    expect(statesOf(listed)).toMatchObject(expected);
  });

  it('with ancestorListed, every item is checked (an item under a listed parent)', () => {
    expect(new Set(Object.values(statesOf([], [FILES[0]], true)))).toEqual(new Set(['checked']));
  });

  it('keeps the state of the first item of a duplicated value', () => {
    const nodes = [node('x', node('a')), node('x')];
    expect(statesOf(['a'], nodes)).toEqual({ x: 'checked', a: 'checked' });
  });
});

describe('toggleCheck', () => {
  it.each<[string, string[], string, string[]]>([
    ['checks an unchecked leaf', [], 'report', ['report']],
    [
      'completing the siblings checks the parent (tree order)',
      ['report'],
      'slides',
      ['work', 'report', 'slides'],
    ],
    [
      'checks a parent and every descendant',
      [],
      'docs',
      ['docs', 'work', 'report', 'slides', 'personal'],
    ],
    ['unchecks a checked parent and every descendant', ['docs'], 'docs', []],
    [
      'unchecking under a listed parent lists the siblings instead',
      ['docs'],
      'report',
      ['slides', 'personal'],
    ],
    [
      'toggling a mixed item checks it and its descendants',
      ['report'],
      'work',
      ['work', 'report', 'slides'],
    ],
    [
      'keeps listed values that match no item, after the tree order',
      ['ghost', 'report'],
      'slides',
      ['work', 'report', 'slides', 'ghost'],
    ],
    ['adds a value no item has to the unmatched values', ['report'], 'ghost', ['report', 'ghost']],
    [
      'removes a value no item has from the unmatched values',
      ['report', 'ghost'],
      'ghost',
      ['report'],
    ],
    [
      'emits every value once, also when the list repeats one',
      ['report', 'report'],
      'readme',
      ['report', 'readme'],
    ],
  ])('%s', (_name, listed, value, expected) => {
    expect(toggleCheck(FILES, listed, value)).toEqual(expected);
  });

  it('emits a duplicated value once and toggles its first item', () => {
    expect(toggleCheck([node('x', node('a')), node('x')], [], 'a')).toEqual(['x', 'a']);
  });

  it('a placeholder child is an item like any other; once real children replace it, its listed value is kept as unmatched', () => {
    const loading = [node('remote', node('remote-loading'))];
    expect(toggleCheck(loading, [], 'remote')).toEqual(['remote', 'remote-loading']);
    const loaded = [node('remote', node('a'), node('b'))];
    expect(toggleCheck(loaded, ['remote', 'remote-loading'], 'a')).toEqual(['b', 'remote-loading']);
  });

  it('an item without nested nodes toggles only itself', () => {
    const tree = [node('leafy')];
    expect(toggleCheck(tree, [], 'leafy')).toEqual(['leafy']);
  });

  it('returns a new array and never mutates the listed values', () => {
    const listed = Object.freeze(['report']) as readonly string[];
    const next = toggleCheck(FILES, listed, 'slides');
    expect(next).not.toBe(listed);
    expect(listed).toEqual(['report']);
  });
});

describe('checkItems', () => {
  it('checks each value with the cascade, in tree order, and keeps what is checked', () => {
    expect(checkItems(FILES, [], ['work', 'readme'])).toEqual([
      'work',
      'report',
      'slides',
      'readme',
    ]);
    expect(checkItems(FILES, ['readme'], ['report'])).toEqual(['report', 'readme']);
    // Checking the last unchecked child checks the parent.
    expect(checkItems(FILES, ['report'], ['slides'])).toEqual(['work', 'report', 'slides']);
    expect(checkItems(FILES, ['report'], ['slides', 'personal'])).toEqual([
      'docs',
      'work',
      'report',
      'slides',
      'personal',
    ]);
  });

  it('is not a toggle: a checked item stays checked', () => {
    expect(checkItems(FILES, ['work', 'report', 'slides'], ['work'])).toEqual([
      'work',
      'report',
      'slides',
    ]);
    expect(toggleCheck(FILES, ['work', 'report', 'slides'], 'work')).toEqual([]);
  });

  it('handles values no item has, listed once, after the items', () => {
    expect(checkItems(FILES, ['stray'], ['readme', 'stray', 'other', 'other'])).toEqual([
      'readme',
      'stray',
      'other',
    ]);
    expect(checkItems(FILES, [], [])).toEqual([]);
  });
});

describe('independent checks', () => {
  it('toggles one item and nothing else', () => {
    expect(toggleCheckIndependent(FILES, [], 'work')).toEqual(['work']);
    expect(toggleCheckIndependent(FILES, ['work'], 'report')).toEqual(['work', 'report']);
    expect(toggleCheckIndependent(FILES, ['work', 'report'], 'work')).toEqual(['report']);
  });

  it('lists the checked items in tree order, then the values no item has', () => {
    expect(toggleCheckIndependent(FILES, ['readme', 'stray'], 'report')).toEqual([
      'report',
      'readme',
      'stray',
    ]);
    expect(toggleCheckIndependent(FILES, ['stray'], 'stray')).toEqual([]);
    expect(toggleCheckIndependent(FILES, [], 'stray')).toEqual(['stray']);
  });

  it('checks several values, each on its own', () => {
    expect(checkItemsIndependent(FILES, ['readme'], ['personal', 'work'])).toEqual([
      'work',
      'personal',
      'readme',
    ]);
    expect(checkItemsIndependent(FILES, ['docs'], ['docs'])).toEqual(['docs']);
  });
});

describe('allItemValues', () => {
  it('lists every value in tree order, each once', () => {
    expect(allItemValues(FILES)).toEqual([
      'docs',
      'work',
      'report',
      'slides',
      'personal',
      'images',
      'photo',
      'readme',
    ]);
    expect(allItemValues([node('a', node('b')), node('b')])).toEqual(['a', 'b']);
    expect(allItemValues([])).toEqual([]);
  });
});

describe('deep trees (the walks are iterative)', () => {
  /** A chain of `depth` nested items: v0 > v1 > … > v(depth-1). */
  function chain(depth: number): { root: TreeNode; last: TreeNode } {
    const root = node('v0');
    let last = root;
    for (let level = 1; level < depth; level += 1) {
      const child = node(`v${level}`);
      last.children.push(child);
      last = child;
    }
    return { root, last };
  }
  const DEPTH = 5000;

  it('computes the states of a 5,000-level chain', () => {
    const { root, last } = chain(DEPTH);
    const states = computeCheckStates([root], new Set([last.value]));
    expect(states.size).toBe(DEPTH);
    expect(states.get('v0')).toBe('checked');
    expect(states.get(last.value)).toBe('checked');
    const none = computeCheckStates([root], new Set());
    expect(none.get('v0')).toBe('unchecked');
    // A listed item in the middle checks everything below it and leaves its ancestors mixed.
    const middle = computeCheckStates([root], new Set(['v2500']));
    expect(middle.get('v2499')).toBe('checked');
    expect(middle.get('v4999')).toBe('checked');
    expect(middle.get('v0')).toBe('checked');
    expect(computeCheckStates([root], new Set(), true).get(last.value)).toBe('checked');
  });

  it('toggles, checks and lists a 5,000-level chain', () => {
    const { root, last } = chain(DEPTH);
    const all = allItemValues([root]);
    expect(all).toHaveLength(DEPTH);
    expect(toggleCheck([root], [], 'v0')).toEqual(all);
    expect(toggleCheck([root], [], last.value)).toEqual(all);
    expect(toggleCheck([root], all, 'v2500')).toEqual([]);
    expect(checkItems([root], [], ['v4000'])).toEqual(all.slice(0));
    expect(toggleCheckIndependent([root], [], 'v4999')).toEqual(['v4999']);
    expect(checkItemsIndependent([root], [], ['v10', 'v9'])).toEqual(['v9', 'v10']);
  });

  it('a wide and deep forest gives the same answers as the shallow ones', () => {
    const wide = Array.from({ length: 3000 }, (_, index) => node(`w${index}`, node(`c${index}`)));
    const states = computeCheckStates(wide, new Set(['c2999']));
    expect(states.get('w2999')).toBe('checked');
    expect(states.get('w0')).toBe('unchecked');
    expect(toggleCheck(wide, [], 'w1')).toEqual(['w1', 'c1']);
  });
});
