import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import * as React from 'react';
import { createTableColumn } from '../../../lib/table';
import type { DataGridColumn } from '../DataGrid';
import { useTableFeatures, type TableFeaturesState } from '../useTableFeatures';
import { useTableColumnSizing, type UseTableColumnSizingOptions } from '../useTableColumnSizing';
import { useTableSelection } from '../useTableSelection';
import { useTableSort } from '../useTableSort';

interface Person {
  name: string;
  age: number;
}

const people: readonly Person[] = [
  { name: 'Cleo', age: 30 },
  { name: 'Abe', age: 25 },
];

const columns: readonly DataGridColumn<Person>[] = [
  createTableColumn<Person>({ columnId: 'name', label: 'Name' }),
  createTableColumn<Person>({ columnId: 'age', label: 'Age' }),
  createTableColumn<Person>({ columnId: 'note', label: 'Note' }),
];

function useSizing(options?: UseTableColumnSizingOptions) {
  return useTableFeatures<Person>({ items: people, columns }, [useTableColumnSizing(options)])
    .columnSizing;
}

function dragEvent(): Event {
  return new MouseEvent('pointermove', { bubbles: true });
}

describe('useTableColumnSizing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('before any width is state', () => {
    it('gives every column its initial width and is not sized', () => {
      const { result } = renderHook(() =>
        useSizing({
          columnSizingOptions: { name: { defaultWidth: 220 }, age: { idealWidth: 100 } },
        }),
      );
      expect(result.current.columnWidths).toEqual({ name: 220, age: 100, note: 150 });
      expect(result.current.isSized).toBe(false);
      expect(result.current.getColumnWidth('name')).toBe(220);
      expect(result.current.getColumnWidth('note')).toBe(150);
    });

    it('lays the table out fixed, 100% wide and at least the sum of the widths wide', () => {
      const { result } = renderHook(() =>
        useSizing({ columnSizingOptions: { name: { defaultWidth: 220 } } }),
      );
      expect(result.current.getTableProps()).toEqual({
        style: { tableLayout: 'fixed', width: '100%', minWidth: 520 },
      });
    });

    it('returns the width of a column as the style of its col element', () => {
      const { result } = renderHook(() =>
        useSizing({ columnSizingOptions: { name: { defaultWidth: 220 } } }),
      );
      expect(result.current.getColumnProps('name')).toEqual({ style: { width: 220 } });
      expect(result.current.getColumnProps('age')).toEqual({ style: { width: 150 } });
    });

    it('returns the default width for the col of an unknown column, and no width', () => {
      const { result } = renderHook(() => useSizing());
      expect(result.current.getColumnProps('ghost')).toEqual({ style: { width: 150 } });
      expect(result.current.getColumnWidth('ghost')).toBeUndefined();
    });
  });

  describe('sized by the options', () => {
    it('is sized once defaultColumnWidths is given, and the table is exactly the sum', () => {
      const { result } = renderHook(() => useSizing({ defaultColumnWidths: { name: 300 } }));
      expect(result.current.isSized).toBe(true);
      expect(result.current.columnWidths).toEqual({ name: 300, age: 150, note: 150 });
      expect(result.current.getTableProps()).toEqual({
        style: { tableLayout: 'fixed', width: 600 },
      });
    });

    it('is sized once columnWidths is given', () => {
      const { result } = renderHook(() => useSizing({ columnWidths: { age: 90 } }));
      expect(result.current.isSized).toBe(true);
      expect(result.current.columnWidths).toEqual({ name: 150, age: 90, note: 150 });
      expect(result.current.getTableProps().style).toEqual({ tableLayout: 'fixed', width: 390 });
    });

    it('clamps given widths to the minimum and ignores widths of unknown columns', () => {
      const { result } = renderHook(() =>
        useSizing({
          columnSizingOptions: { name: { minWidth: 120 } },
          defaultColumnWidths: { name: 100, age: 20, ghost: 900 },
        }),
      );
      expect(result.current.columnWidths).toEqual({ name: 120, age: 80, note: 150 });
    });
  });

  describe('setColumnWidth', () => {
    it('sets the width, flips isSized and makes the table exactly the sum', () => {
      const { result } = renderHook(() => useSizing());
      act(() => result.current.setColumnWidth('name', 260, dragEvent()));
      expect(result.current.columnWidths).toEqual({ name: 260, age: 150, note: 150 });
      expect(result.current.isSized).toBe(true);
      expect(result.current.getColumnProps('name')).toEqual({ style: { width: 260 } });
      expect(result.current.getTableProps().style).toEqual({ tableLayout: 'fixed', width: 560 });
    });

    it('flips isSized for the first resize even when the width stays the initial one', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }));
      act(() => result.current.setColumnWidth('name', 150, dragEvent()));
      expect(result.current.isSized).toBe(true);
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    });

    it('clamps to the minimum width of the column and has no maximum', () => {
      const { result } = renderHook(() =>
        useSizing({ columnSizingOptions: { name: { minWidth: 120 } } }),
      );
      act(() => result.current.setColumnWidth('name', 10));
      expect(result.current.getColumnWidth('name')).toBe(120);
      act(() => result.current.setColumnWidth('age', 1));
      expect(result.current.getColumnWidth('age')).toBe(80);
      act(() => result.current.setColumnWidth('note', 50000));
      expect(result.current.getColumnWidth('note')).toBe(50000);
    });

    it('does nothing for a column that does not exist or a width that is not a number', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }));
      act(() => result.current.setColumnWidth('ghost', 300));
      act(() => result.current.setColumnWidth('name', Number.NaN));
      expect(onColumnWidthsChange).not.toHaveBeenCalled();
      expect(result.current.isSized).toBe(false);
    });

    it('calls onColumnWidthsChange once per call with every width and the details', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }));
      const event = dragEvent();
      act(() => result.current.setColumnWidth('age', 200, event));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(
        { name: 150, age: 200, note: 150 },
        { columnId: 'age', width: 200, event },
      );
      act(() => result.current.setColumnWidth('name', 90, event));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(2);
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith(
        { name: 90, age: 200, note: 150 },
        { columnId: 'name', width: 90, event },
      );
    });

    it('reports the clamped width in the details', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }));
      const event = dragEvent();
      act(() => result.current.setColumnWidth('age', 5, event));
      expect(onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({ age: 80 }), {
        columnId: 'age',
        width: 80,
        event,
      });
    });

    it('does not call the callback again for the width a sized column already has', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() =>
        useSizing({ defaultColumnWidths: { name: 200 }, onColumnWidthsChange }),
      );
      act(() => result.current.setColumnWidth('name', 200));
      expect(onColumnWidthsChange).not.toHaveBeenCalled();
    });

    it('gives the callback an event when none was passed', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }));
      act(() => result.current.setColumnWidth('name', 200));
      expect(onColumnWidthsChange).toHaveBeenCalledWith(expect.anything(), {
        columnId: 'name',
        width: 200,
        event: expect.any(Event),
      });
    });

    it('calls the callback once per call in StrictMode', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() => useSizing({ onColumnWidthsChange }), {
        wrapper: React.StrictMode,
      });
      act(() => result.current.setColumnWidth('name', 240, dragEvent()));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(result.current.getColumnWidth('name')).toBe(240);
    });
  });

  describe('controlled widths', () => {
    it('shows the widths of the parent and asks it to change them', () => {
      const onColumnWidthsChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ widths }: { widths: Record<string, number> }) =>
          useSizing({ columnWidths: widths, onColumnWidthsChange }),
        { initialProps: { widths: { name: 200 } as Record<string, number> } },
      );
      act(() => result.current.setColumnWidth('name', 260, dragEvent()));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange.mock.calls[0]![0]).toEqual({ name: 260, age: 150, note: 150 });
      rerender({ widths: { name: 260, age: 150, note: 150 } });
      expect(result.current.getColumnWidth('name')).toBe(260);
    });

    it('leaves the width unchanged when the parent ignores the change', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() =>
        useSizing({ columnWidths: { name: 200 }, onColumnWidthsChange }),
      );
      act(() => result.current.setColumnWidth('name', 300, dragEvent()));
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(result.current.getColumnWidth('name')).toBe(200);
      expect(result.current.getTableProps().style).toEqual({ tableLayout: 'fixed', width: 500 });
    });
  });

  describe('getResizeHandleProps', () => {
    it('returns the width, the minimum and a resize callback that sets the width', () => {
      const onColumnWidthsChange = vi.fn();
      const { result } = renderHook(() =>
        useSizing({
          columnSizingOptions: { name: { defaultWidth: 220, minWidth: 100 }, age: {} },
          onColumnWidthsChange,
        }),
      );
      const name = result.current.getResizeHandleProps('name');
      expect(name).toEqual({ width: 220, minWidth: 100, onResize: expect.any(Function) });
      expect(result.current.getResizeHandleProps('age')).toEqual(
        expect.objectContaining({ width: 150, minWidth: 80 }),
      );

      const event = dragEvent();
      act(() => name.onResize(300, { event }));
      expect(result.current.getColumnWidth('name')).toBe(300);
      expect(onColumnWidthsChange).toHaveBeenCalledWith(expect.anything(), {
        columnId: 'name',
        width: 300,
        event,
      });
      expect(result.current.getResizeHandleProps('name').width).toBe(300);
    });

    it('describes an unknown column with the defaults', () => {
      const { result } = renderHook(() => useSizing());
      expect(result.current.getResizeHandleProps('ghost')).toEqual({
        width: 150,
        minWidth: 80,
        onResize: expect.any(Function),
      });
    });
  });

  describe('with the other plugins', () => {
    it('fills only the columnSizing slot', () => {
      const { result } = renderHook(() =>
        useTableFeatures<Person>({ items: people, columns }, [
          useTableSort({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
          useTableColumnSizing({ defaultColumnWidths: { name: 200 } }),
          useTableSelection<Person>({ selectionMode: 'multiple' }),
        ]),
      );
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'ascending' });
      expect(result.current.columnSizing.getColumnWidth('name')).toBe(200);
      expect(result.current.selection.selectionMode).toBe('multiple');
    });
  });

  describe('options written inline', () => {
    it('re-renders without a loop and keeps the widths after a resize', () => {
      const states: TableFeaturesState<Person>[] = [];
      function Probe() {
        const state = useTableFeatures<Person>({ items: people, columns }, [
          useTableColumnSizing({
            columnSizingOptions: { name: { minWidth: 100, defaultWidth: 200 } },
            onColumnWidthsChange: () => {},
          }),
        ]);
        states.push(state);
        return null;
      }
      const { rerender } = render(<Probe />);
      expect(() => rerender(<Probe />)).not.toThrow();
      const latest = () => states[states.length - 1]!;
      expect(latest().columnSizing.getColumnWidth('name')).toBe(200);

      act(() => latest().columnSizing.setColumnWidth('name', 320, dragEvent()));
      expect(latest().columnSizing.getColumnWidth('name')).toBe(320);
      rerender(<Probe />);
      expect(latest().columnSizing.columnWidths).toEqual({ name: 320, age: 150, note: 150 });
      expect(latest().columnSizing.isSized).toBe(true);
      // The rows keep their array through the recomputes.
      expect(latest().getRows()).toBe(states[0]!.getRows());
    });
  });
});
