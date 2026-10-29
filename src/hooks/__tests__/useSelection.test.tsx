import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as React from 'react';
import {
  useSelection,
  type UseSelectionChangeDetails,
  type UseSelectionOptions,
  type UseSelectionResult,
} from '../useSelection';
import { renderWithProviders } from '../../test-utils';

const sorted = (set: ReadonlySet<string>) => [...set].sort();

function clickEvent(): Event {
  return new MouseEvent('click', { bubbles: true });
}

describe('useSelection', () => {
  describe('uncontrolled', () => {
    it('starts from defaultSelectedItems and toggles in multiple mode', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          defaultSelectedItems: ['a'],
          onSelectedItemsChange: onChange,
        }),
      );
      expect(sorted(result.current.selectedItems)).toEqual(['a']);
      expect(result.current.isSelected('a')).toBe(true);
      expect(result.current.isSelected('b')).toBe(false);

      act(() => result.current.toggle('b'));
      expect(sorted(result.current.selectedItems)).toEqual(['a', 'b']);
      expect(onChange).toHaveBeenLastCalledWith(['a', 'b'], { event: undefined, id: 'b' });

      act(() => result.current.toggle('a'));
      expect(sorted(result.current.selectedItems)).toEqual(['b']);
      expect(onChange).toHaveBeenLastCalledWith(['b'], { event: undefined, id: 'a' });
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('passes the event and the id in the details', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ selectionMode: 'multiple', onSelectedItemsChange: onChange }),
      );
      const event = clickEvent();
      act(() => result.current.select('a', event));
      expect(onChange).toHaveBeenCalledWith(['a'], { event, id: 'a' });
      act(() => result.current.deselect('a', event));
      expect(onChange).toHaveBeenLastCalledWith([], { event, id: 'a' });
      act(() => result.current.toggleAll(['x', 'y'], event));
      expect(onChange).toHaveBeenLastCalledWith(['x', 'y'], { event });
      act(() => result.current.clear(event));
      expect(onChange).toHaveBeenLastCalledWith([], { event });
    });

    it('calls the callback with a new mutable array, not the internal one', () => {
      const calls: string[][] = [];
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          onSelectedItemsChange: (items) => calls.push(items),
        }),
      );
      act(() => result.current.select('a'));
      act(() => result.current.select('b'));
      expect(calls).toEqual([['a'], ['a', 'b']]);
      expect(calls[0]).not.toBe(calls[1]);
      calls[1]!.push('mutated');
      expect(sorted(result.current.selectedItems)).toEqual(['a', 'b']);
    });

    it('single mode replaces the selection and never deselects through toggle', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'single',
          defaultSelectedItems: ['a'],
          onSelectedItemsChange: onChange,
        }),
      );
      act(() => result.current.toggle('b'));
      expect(sorted(result.current.selectedItems)).toEqual(['b']);
      expect(onChange).toHaveBeenCalledTimes(1);

      act(() => result.current.toggle('b'));
      expect(sorted(result.current.selectedItems)).toEqual(['b']);
      expect(onChange).toHaveBeenCalledTimes(1);

      act(() => result.current.select('c'));
      expect(sorted(result.current.selectedItems)).toEqual(['c']);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('does not call the callback for a no-op', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          defaultSelectedItems: ['a'],
          onSelectedItemsChange: onChange,
        }),
      );
      act(() => result.current.select('a'));
      act(() => result.current.deselect('zzz'));
      act(() => result.current.toggleAll([]));
      expect(onChange).not.toHaveBeenCalled();

      const { result: empty } = renderHook(() =>
        useSelection({ selectionMode: 'multiple', onSelectedItemsChange: onChange }),
      );
      act(() => empty.current.clear());
      expect(onChange).not.toHaveBeenCalled();
    });

    it('toggleAll selects the universe, then removes only its ids and keeps foreign ones', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          defaultSelectedItems: ['foreign', 'a'],
          onSelectedItemsChange: onChange,
        }),
      );
      const universe = ['a', 'b', 'c'];
      act(() => result.current.toggleAll(universe));
      expect(sorted(result.current.selectedItems)).toEqual(['a', 'b', 'c', 'foreign']);
      expect(onChange).toHaveBeenCalledTimes(1);

      act(() => result.current.toggleAll(universe));
      expect(sorted(result.current.selectedItems)).toEqual(['foreign']);
      expect(onChange).toHaveBeenLastCalledWith(['foreign'], { event: undefined });
    });

    it('toggleAll does nothing in single mode', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({ selectionMode: 'single', onSelectedItemsChange: onChange }),
      );
      act(() => result.current.toggleAll(['a', 'b']));
      expect(result.current.selectedItems.size).toBe(0);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('clear empties the selection, foreign ids included', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          defaultSelectedItems: ['a', 'b'],
          onSelectedItemsChange: onChange,
        }),
      );
      act(() => result.current.clear());
      expect(result.current.selectedItems.size).toBe(0);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('controlled', () => {
    it('shows the controlled value and ignores defaultSelectedItems', () => {
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          selectedItems: ['a'],
          defaultSelectedItems: ['z'],
        }),
      );
      expect(sorted(result.current.selectedItems)).toEqual(['a']);
    });

    it('a parent that ignores the callback leaves the state unchanged', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() =>
        useSelection({
          selectionMode: 'multiple',
          selectedItems: ['a'],
          onSelectedItemsChange: onChange,
        }),
      );
      act(() => result.current.toggle('b'));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(['a', 'b'], { event: undefined, id: 'b' });
      expect(sorted(result.current.selectedItems)).toEqual(['a']);
    });

    it('follows a parent that accepts the change', () => {
      const { result } = renderHook(() => {
        const [items, setItems] = React.useState<string[]>([]);
        const selection = useSelection({
          selectionMode: 'multiple',
          selectedItems: items,
          onSelectedItemsChange: setItems,
        });
        return { selection, items };
      });
      act(() => result.current.selection.toggle('a'));
      expect(result.current.items).toEqual(['a']);
      expect(sorted(result.current.selection.selectedItems)).toEqual(['a']);
    });

    it('keeps the set referentially stable while the ids stay the same', () => {
      const { result, rerender } = renderHook(
        ({ items }: { items: string[] }) =>
          useSelection({ selectionMode: 'multiple', selectedItems: items }),
        { initialProps: { items: ['a', 'b'] } },
      );
      const first = result.current.selectedItems;
      const firstApi = result.current;
      // A new array with the same ids, as an inline literal gives on every render.
      rerender({ items: ['a', 'b'] });
      expect(result.current.selectedItems).toBe(first);
      expect(result.current).toBe(firstApi);
      rerender({ items: ['a', 'b', 'c'] });
      expect(result.current.selectedItems).not.toBe(first);
      expect(sorted(result.current.selectedItems)).toEqual(['a', 'b', 'c']);
    });
  });

  it('keeps the set referentially stable between renders without a change', () => {
    const { result, rerender } = renderHook(() => useSelection({ selectionMode: 'multiple' }));
    const first = result.current.selectedItems;
    rerender();
    expect(result.current.selectedItems).toBe(first);
    act(() => result.current.select('a'));
    const second = result.current.selectedItems;
    expect(second).not.toBe(first);
    rerender();
    expect(result.current.selectedItems).toBe(second);
  });

  it('calls the callback once per change in StrictMode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(
      () => useSelection({ selectionMode: 'multiple', onSelectedItemsChange: onChange }),
      { wrapper: React.StrictMode },
    );
    act(() => result.current.toggle('a'));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => result.current.toggleAll(['a', 'b']));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'], { event: undefined });
  });

  it('calls the callback once per change when rendered through the providers in StrictMode', () => {
    const onChange = vi.fn();
    let api!: UseSelectionResult;
    function Probe() {
      api = useSelection({ selectionMode: 'single', onSelectedItemsChange: onChange });
      return <output>{[...api.selectedItems].join(',')}</output>;
    }
    const { getByRole } = renderWithProviders(
      <React.StrictMode>
        <Probe />
      </React.StrictMode>,
    );
    act(() => api.toggle('a'));
    act(() => api.toggle('a'));
    expect(getByRole('status')).toHaveTextContent('a');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('chains actions from one event, as one interaction', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useSelection({ selectionMode: 'multiple', onSelectedItemsChange: onChange }),
    );
    act(() => {
      result.current.select('a');
      result.current.select('b');
    });
    expect(sorted(result.current.selectedItems)).toEqual(['a', 'b']);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'], { event: undefined, id: 'b' });
  });

  describe('types', () => {
    it('requires selectionMode and gives the callback a mutable string[]', () => {
      // @ts-expect-error selectionMode is required
      const missing: UseSelectionOptions = {};
      expect(missing).toBeDefined();

      expectTypeOf<UseSelectionOptions['selectionMode']>().toEqualTypeOf<'single' | 'multiple'>();
      expectTypeOf<UseSelectionOptions['selectedItems']>().toEqualTypeOf<
        readonly string[] | undefined
      >();
      expectTypeOf<NonNullable<UseSelectionOptions['onSelectedItemsChange']>>().toEqualTypeOf<
        (selectedItems: string[], details?: UseSelectionChangeDetails) => void
      >();
      expectTypeOf<UseSelectionChangeDetails>().toEqualTypeOf<{ event?: Event; id?: string }>();
    });

    it('returns a read-only set and the listed actions', () => {
      expectTypeOf<UseSelectionResult['selectedItems']>().toEqualTypeOf<ReadonlySet<string>>();
      expectTypeOf<UseSelectionResult['toggleAll']>().toEqualTypeOf<
        (universe: readonly string[], event?: Event) => void
      >();
      expectTypeOf<UseSelectionResult['clear']>().toEqualTypeOf<(event?: Event) => void>();
      expectTypeOf<UseSelectionResult['isSelected']>().toEqualTypeOf<(id: string) => boolean>();
    });
  });
});
