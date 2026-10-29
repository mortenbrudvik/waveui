import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFlatTree, type FlatTreeModel, type UseFlatTreeOptions } from '../useFlatTree';
import type { TreeCheckedItemsChangeDetails } from '../Tree';
import type { CheckState } from '../../../lib/treeCascade';
import type { FlatTreeItemData, VisibleFlatItem } from '../../../lib/flatTree';

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
  { value: 'docs', label: 'Documents' },
  { value: 'report', parentValue: 'work' },
  { value: 'work', parentValue: 'docs' },
  { value: 'images' },
  { value: 'slides', parentValue: 'work' },
  { value: 'personal', parentValue: 'docs' },
  { value: 'photo', parentValue: 'images' },
  { value: 'readme' },
];

const values = (model: FlatTreeModel) => model.visibleItems.map((row) => row.item.value);
const checkedOf = (model: FlatTreeModel) =>
  Object.fromEntries(model.visibleItems.map((row) => [row.item.value, row.checked]));
const clickEvent = () => new MouseEvent('click', { bubbles: true });

function setup(
  items: readonly FlatTreeItemData[] = FILES,
  options?: UseFlatTreeOptions,
  wrapper?: React.JSXElementConstructor<{ children: React.ReactNode }>,
) {
  return renderHook(({ items: current, options: opts }) => useFlatTree(current, opts), {
    initialProps: { items, options },
    wrapper,
  });
}

describe('useFlatTree', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  describe('visible items', () => {
    it('lists the roots while nothing is expanded, with the facts of a row', () => {
      const { result } = setup();
      expect(values(result.current)).toEqual(['docs', 'images', 'readme']);
      expect(result.current.visibleItems[0]).toEqual({
        item: FILES[0],
        level: 1,
        position: 1,
        setSize: 3,
        parentValue: undefined,
        hasChildren: true,
        isBranch: true,
        expanded: false,
        index: 0,
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('lists the children of expanded branches in tree order', () => {
      const { result } = setup(FILES, { defaultExpandedItems: ['docs', 'work'] });
      expect(values(result.current)).toEqual([
        'docs',
        'work',
        'report',
        'slides',
        'personal',
        'images',
        'readme',
      ]);
      expect(result.current.visibleItems.map((row) => row.level)).toEqual([1, 2, 3, 3, 2, 1, 1]);
    });

    it('does not set checked on the rows unless selectionMode is multiple', () => {
      const { result } = setup(FILES, { defaultCheckedItems: ['docs'] });
      expect(result.current.visibleItems.every((row) => !('checked' in row))).toBe(true);
    });

    it('keeps the same visibleItems and model while nothing changes', () => {
      const { result, rerender } = setup(FILES, { selectionMode: 'multiple' });
      const first = result.current;
      rerender({ items: FILES, options: { selectionMode: 'multiple' } });
      expect(result.current.visibleItems).toBe(first.visibleItems);
      expect(result.current).toBe(first);
    });

    it('does not recompute when only inline option objects and callbacks change', () => {
      const { result, rerender } = setup(FILES, { defaultExpandedItems: ['docs'] });
      const first = result.current.visibleItems;
      rerender({
        items: FILES,
        options: { defaultExpandedItems: ['docs'], onExpandedItemsChange: () => {} },
      });
      expect(result.current.visibleItems).toBe(first);
    });

    it('builds a new list when the items or the expanded set change', () => {
      const { result, rerender } = setup();
      const first = result.current.visibleItems;
      act(() => result.current.expand('docs'));
      const second = result.current.visibleItems;
      expect(second).not.toBe(first);
      rerender({ items: [...FILES, { value: 'zip' }], options: undefined });
      expect(result.current.visibleItems).not.toBe(second);
      expect(values(result.current)).toContain('zip');
    });

    it('finds a visible row with getItem, and nothing for a hidden or unknown value', () => {
      const { result } = setup(FILES, { defaultExpandedItems: ['docs'] });
      expect(result.current.getItem('work')).toBe(result.current.visibleItems[1]);
      expect(result.current.getItem('work')?.parentValue).toBe('docs');
      expect(result.current.getItem('report')).toBeUndefined();
      expect(result.current.getItem('ghost')).toBeUndefined();
    });

    it('renders on the server', () => {
      function Probe() {
        const model = useFlatTree(FILES, { defaultExpandedItems: ['docs'] });
        return <p>{model.visibleItems.map((row) => row.item.value).join(',')}</p>;
      }
      expect(renderToString(<Probe />)).toContain('docs,work,personal,images,readme');
    });
  });

  describe('expanded items', () => {
    it('expands, collapses and toggles (uncontrolled), calling the callback once per change', () => {
      const onExpandedItemsChange = vi.fn();
      const { result } = setup(FILES, { onExpandedItemsChange });
      act(() => result.current.expand('docs'));
      expect(onExpandedItemsChange).toHaveBeenLastCalledWith(['docs']);
      expect(result.current.isExpanded('docs')).toBe(true);
      expect(values(result.current)).toEqual(['docs', 'work', 'personal', 'images', 'readme']);

      act(() => result.current.expand('docs'));
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);

      act(() => result.current.toggle('images'));
      expect(onExpandedItemsChange).toHaveBeenLastCalledWith(['docs', 'images']);

      act(() => result.current.collapse('docs'));
      expect(onExpandedItemsChange).toHaveBeenLastCalledWith(['images']);
      expect(result.current.isExpanded('docs')).toBe(false);

      act(() => result.current.collapse('docs'));
      act(() => result.current.toggle('images'));
      expect(onExpandedItemsChange).toHaveBeenLastCalledWith([]);
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(4);
    });

    it('fires once per change in StrictMode', () => {
      const onExpandedItemsChange = vi.fn();
      const { result } = setup(FILES, { onExpandedItemsChange }, React.StrictMode);
      act(() => result.current.toggle('docs'));
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs']);
    });

    it('expands a list of values in one change, adding each new value once', () => {
      const onExpandedItemsChange = vi.fn();
      const { result } = setup(FILES, { defaultExpandedItems: ['work'], onExpandedItemsChange });
      act(() => result.current.expand(['docs', 'work', 'images', 'docs']));
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      expect(onExpandedItemsChange).toHaveBeenCalledWith(['work', 'docs', 'images']);
      act(() => result.current.expand(['docs', 'images']));
      act(() => result.current.expand([]));
      expect(onExpandedItemsChange).toHaveBeenCalledTimes(1);
      expectTypeOf<FlatTreeModel['expand']>().parameters.toEqualTypeOf<
        [value: string | readonly string[]]
      >();
    });

    it('emits a new mutable array', () => {
      const onExpandedItemsChange = vi.fn();
      const defaultExpandedItems = ['docs'] as const;
      const { result } = setup(FILES, { defaultExpandedItems, onExpandedItemsChange });
      act(() => result.current.expand('work'));
      const emitted = onExpandedItemsChange.mock.calls[0][0] as string[];
      expect(emitted).toEqual(['docs', 'work']);
      expect(emitted).not.toBe(defaultExpandedItems);
    });

    it('follows expandedItems while controlled and asks the parent through the callback', () => {
      const onExpandedItemsChange = vi.fn();
      const { result, rerender } = setup(FILES, { expandedItems: [], onExpandedItemsChange });
      act(() => result.current.expand('docs'));
      expect(onExpandedItemsChange).toHaveBeenCalledWith(['docs']);
      expect(values(result.current)).toEqual(['docs', 'images', 'readme']);
      rerender({ items: FILES, options: { expandedItems: ['docs'], onExpandedItemsChange } });
      expect(values(result.current)).toEqual(['docs', 'work', 'personal', 'images', 'readme']);
      expect(result.current.isExpanded('docs')).toBe(true);
    });

    it('treats an expanded value that is no branch as not expanded', () => {
      const { result } = setup(FILES, { defaultExpandedItems: ['readme', 'ghost'] });
      expect(result.current.isExpanded('readme')).toBe(false);
      expect(result.current.isExpanded('ghost')).toBe(false);
      expect(values(result.current)).toEqual(['docs', 'images', 'readme']);
    });

    it('expands a childless item typed as a branch', () => {
      const lazy: FlatTreeItemData[] = [{ value: 'lazy', itemType: 'branch' }, { value: 'leaf' }];
      const { result } = setup(lazy);
      expect(result.current.visibleItems[0]).toMatchObject({ isBranch: true, expanded: false });
      act(() => result.current.expand('lazy'));
      expect(result.current.visibleItems[0]).toMatchObject({ isBranch: true, expanded: true });
      expect(result.current.isExpanded('lazy')).toBe(true);
    });

    it('keeps the expanded values that still exist when the items are replaced', () => {
      const onExpandedItemsChange = vi.fn();
      const { result, rerender } = setup(FILES, {
        defaultExpandedItems: ['docs', 'images'],
        onExpandedItemsChange,
      });
      const withoutImages = FILES.filter((it) => it.value !== 'images' && it.value !== 'photo');
      rerender({ items: withoutImages, options: { onExpandedItemsChange } });
      expect(values(result.current)).toEqual(['docs', 'work', 'personal', 'readme']);
      expect(result.current.isExpanded('docs')).toBe(true);
      expect(result.current.isExpanded('images')).toBe(false);
      expect(onExpandedItemsChange).not.toHaveBeenCalled();

      // The value of the removed item stays in the state: it is back expanded with its item.
      rerender({ items: FILES, options: { onExpandedItemsChange } });
      expect(values(result.current)).toEqual([
        'docs',
        'work',
        'personal',
        'images',
        'photo',
        'readme',
      ]);
    });
  });

  describe('checked items', () => {
    const multiple = { selectionMode: 'multiple' } as const;

    it('reports checked, mixed and unchecked rows from the cascade', () => {
      const { result } = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        defaultCheckedItems: ['report'],
      });
      expect(checkedOf(result.current)).toEqual({
        docs: 'mixed',
        work: 'mixed',
        report: 'checked',
        slides: 'unchecked',
        personal: 'unchecked',
        images: 'unchecked',
        readme: 'unchecked',
      } satisfies Record<string, CheckState>);
    });

    it('checks a parent when all of its children are checked, and a listed parent checks its subtree', () => {
      const { result } = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        defaultCheckedItems: ['report', 'slides'],
      });
      expect(checkedOf(result.current).work).toBe('checked');
      expect(checkedOf(result.current).docs).toBe('mixed');

      const listed = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        defaultCheckedItems: ['docs'],
      });
      expect(Object.values(checkedOf(listed.result.current)).slice(0, 5)).toEqual([
        'checked',
        'checked',
        'checked',
        'checked',
        'checked',
      ]);
    });

    it('toggles a child up the cascade: the parent turns mixed, then checked', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        onCheckedItemsChange,
      });
      const event = clickEvent();
      act(() => result.current.setChecked('report', true, event));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['report'], {
        value: 'report',
        checked: true,
        event,
      });
      expect(checkedOf(result.current)).toMatchObject({
        docs: 'mixed',
        work: 'mixed',
        report: 'checked',
      });

      act(() => result.current.setChecked('slides', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['work', 'report', 'slides'],
        expect.objectContaining({ value: 'slides', checked: true }),
      );
      expect(checkedOf(result.current)).toMatchObject({ docs: 'mixed', work: 'checked' });
    });

    it('checks every descendant of a parent and unchecks them again', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        onCheckedItemsChange,
      });
      act(() => result.current.setChecked('docs', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['docs', 'work', 'report', 'slides', 'personal'],
        expect.objectContaining({ value: 'docs', checked: true }),
      );
      act(() => result.current.setChecked('work', false, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['personal'],
        expect.objectContaining({ value: 'work', checked: false }),
      );
      expect(checkedOf(result.current)).toMatchObject({ docs: 'mixed', work: 'unchecked' });
    });

    it('sets a mixed parent to the requested state', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, {
        ...multiple,
        defaultExpandedItems: ['docs', 'work'],
        defaultCheckedItems: ['report'],
        onCheckedItemsChange,
      });
      act(() => result.current.setChecked('work', false, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ value: 'work', checked: false }),
      );
      act(() => result.current.setChecked('work', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['work', 'report', 'slides'],
        expect.objectContaining({ value: 'work', checked: true }),
      );
    });

    it('does not call the callback when the item is already in the requested state', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, {
        ...multiple,
        defaultCheckedItems: ['images'],
        onCheckedItemsChange,
      });
      act(() => result.current.setChecked('images', true, clickEvent()));
      act(() => result.current.setChecked('readme', false, clickEvent()));
      act(() => result.current.setChecked('photo', true, clickEvent()));
      expect(onCheckedItemsChange).not.toHaveBeenCalled();
    });

    it('passes no details without an event, and clears the details after the change', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, { ...multiple, onCheckedItemsChange });
      act(() => result.current.setChecked('readme', true));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(['readme'], undefined);
      const event = clickEvent();
      act(() => result.current.setChecked('readme', false, event));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith([], {
        value: 'readme',
        checked: false,
        event,
      });
    });

    it('adds and removes a value that matches no item, like the nested Tree', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, { ...multiple, onCheckedItemsChange });
      act(() => result.current.setChecked('ghost', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        ['ghost'],
        expect.objectContaining({ value: 'ghost', checked: true }),
      );
      act(() => result.current.setChecked('ghost', false, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ value: 'ghost', checked: false }),
      );
    });

    it('fires once per change in StrictMode', () => {
      const onCheckedItemsChange = vi.fn();
      const { result } = setup(FILES, { ...multiple, onCheckedItemsChange }, React.StrictMode);
      act(() => result.current.setChecked('readme', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenCalledTimes(1);
    });

    it('follows checkedItems while controlled', () => {
      const onCheckedItemsChange = vi.fn();
      const { result, rerender } = setup(FILES, {
        ...multiple,
        checkedItems: ['readme'],
        onCheckedItemsChange,
      });
      expect(checkedOf(result.current).readme).toBe('checked');
      act(() => result.current.setChecked('images', true, clickEvent()));
      expect(onCheckedItemsChange).toHaveBeenCalledWith(
        ['images', 'photo', 'readme'],
        expect.objectContaining({ value: 'images', checked: true }),
      );
      // A parent that ignores the change leaves the rendered state alone.
      expect(checkedOf(result.current)).toMatchObject({ images: 'unchecked', readme: 'checked' });
      rerender({
        items: FILES,
        options: { ...multiple, checkedItems: ['images', 'photo', 'readme'], onCheckedItemsChange },
      });
      expect(checkedOf(result.current)).toMatchObject({ images: 'checked', readme: 'checked' });
    });

    it('keeps the rows when only the callback identity changes', () => {
      const { result, rerender } = setup(FILES, { ...multiple, defaultCheckedItems: ['readme'] });
      const first = result.current.visibleItems;
      rerender({
        items: FILES,
        options: { ...multiple, defaultCheckedItems: ['readme'], onCheckedItemsChange: () => {} },
      });
      expect(result.current.visibleItems).toBe(first);
    });

    it('keeps setChecked, expand, collapse and toggle at a stable identity', () => {
      const { result, rerender } = setup(FILES, multiple);
      const first = result.current;
      act(() => result.current.expand('docs'));
      rerender({ items: [...FILES], options: multiple });
      for (const key of ['setChecked', 'expand', 'collapse', 'toggle'] as const) {
        expect(result.current[key]).toBe(first[key]);
      }
    });
  });

  describe('getTreeProps', () => {
    it('returns the selection mode, none by default', () => {
      expect(setup().result.current.getTreeProps()).toEqual({ selectionMode: 'none' });
      expect(setup(FILES, { selectionMode: 'multiple' }).result.current.getTreeProps()).toEqual({
        selectionMode: 'multiple',
      });
      expect(setup(FILES, { selectionMode: 'single' }).result.current.getTreeProps()).toEqual({
        selectionMode: 'single',
      });
    });
  });

  describe('issues in the items', () => {
    it('warns once about an unknown parent, and indexes the item as a root', () => {
      const items = [{ value: 'a' }, { value: 'b', parentValue: 'missing' }];
      const { result, rerender } = setup(items);
      expect(values(result.current)).toEqual(['a', 'b']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[WaveUI\] useFlatTree: .*"b".*"missing"/),
      );
      rerender({ items: [...items], options: undefined });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warns once about a cycle, cutting it', () => {
      const items = [
        { value: 'a', parentValue: 'b' },
        { value: 'b', parentValue: 'a' },
      ];
      const { result } = setup(items);
      expect(values(result.current)).toEqual(['a']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[WaveUI\] useFlatTree: .*cycle.*"a"/),
      );
    });

    it('warns once about a duplicate value, keeping the first item', () => {
      const items = [
        { value: 'a', label: 'first' },
        { value: 'a', label: 'second' },
        { value: 'b' },
      ];
      const { result } = setup(items);
      expect(result.current.visibleItems.map((row) => row.item.label)).toEqual([
        'first',
        undefined,
      ]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[WaveUI\] useFlatTree: .*duplicate.*"a"/),
      );
    });

    it('warns once per kind when several kinds are present, not during render', () => {
      const items = [
        { value: 'a' },
        { value: 'a' },
        { value: 'b', parentValue: 'ghost' },
        { value: 'c', parentValue: 'd' },
        { value: 'd', parentValue: 'c' },
      ];
      const { result } = setup(items, undefined, React.StrictMode);
      expect(values(result.current)).toEqual(['a', 'b', 'c']);
      expect(warn).toHaveBeenCalledTimes(3);
    });

    it('does not warn while rendering on the server', () => {
      function Probe() {
        const model = useFlatTree([{ value: 'b', parentValue: 'ghost' }]);
        return <p>{model.visibleItems.length}</p>;
      }
      renderToString(<Probe />);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('types', () => {
    it('has the documented signature', () => {
      expectTypeOf(useFlatTree).parameters.toEqualTypeOf<
        [items: readonly FlatTreeItemData[], options?: UseFlatTreeOptions]
      >();
      expectTypeOf(useFlatTree).returns.toEqualTypeOf<FlatTreeModel>();
      expectTypeOf<FlatTreeModel['visibleItems']>().toEqualTypeOf<
        readonly (VisibleFlatItem & { checked?: CheckState })[]
      >();
      expectTypeOf<FlatTreeModel['getTreeProps']>().returns.toEqualTypeOf<{
        selectionMode: 'none' | 'single' | 'multiple';
      }>();
      expectTypeOf<FlatTreeModel['setChecked']>().toEqualTypeOf<
        (value: string, checked: boolean, event?: Event) => void
      >();
      expectTypeOf<
        NonNullable<UseFlatTreeOptions['onCheckedItemsChange']>
      >().parameters.toEqualTypeOf<
        [checkedItems: string[], details?: TreeCheckedItemsChangeDetails]
      >();
      expectTypeOf<UseFlatTreeOptions['expandedItems']>().toEqualTypeOf<
        readonly string[] | undefined
      >();
    });
  });
});
