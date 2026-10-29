import { describe, it, expect } from 'vitest';
import { computeCheckStates, toggleCheck, type CheckState, type TreeNode } from '../treeCascade';

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
