import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import * as React from 'react';
import { createTableColumn } from '../../../lib/table';
import type { DataGridColumn, DataGridSort } from '../DataGrid';
import { useTableFeatures, type TableFeaturesState } from '../useTableFeatures';
import { useTableSelection } from '../useTableSelection';
import { useTableSort } from '../useTableSort';

interface Person {
  id: string;
  name: string;
  age: number;
}

const people: readonly Person[] = [
  { id: 'p1', name: 'Cleo', age: 30 },
  { id: 'p2', name: 'Abe', age: 25 },
  { id: 'p3', name: 'Bea', age: 30 },
  { id: 'p4', name: 'Dan', age: 25 },
];

const columns: readonly DataGridColumn<Person>[] = [
  createTableColumn<Person>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
  }),
  createTableColumn<Person>({ columnId: 'age', label: 'Age', compare: (a, b) => a.age - b.age }),
  createTableColumn<Person>({ columnId: 'note', label: 'Note' }),
];

const getRowId = (person: Person) => person.id;

const names = (state: TableFeaturesState<Person>) => state.getRows().map((row) => row.item.name);

const sorted = (set: ReadonlySet<string>) => [...set].sort();

function clickEvent(): Event {
  return new MouseEvent('click', { bubbles: true });
}

describe('useTableFeatures', () => {
  describe('rows', () => {
    it('returns the rows of items in order, with the index as the default row id', () => {
      const { result } = renderHook(() => useTableFeatures({ items: people, columns }));
      expect(result.current.getRows()).toEqual([
        { item: people[0], rowId: '0', index: 0 },
        { item: people[1], rowId: '1', index: 1 },
        { item: people[2], rowId: '2', index: 2 },
        { item: people[3], rowId: '3', index: 3 },
      ]);
      expect(result.current.items).toBe(people);
      expect(result.current.columns).toBe(columns);
      expect(result.current.getRowId(people[2]!, 2)).toBe('2');
    });

    it('takes the row ids from getRowId, called with the item and its index', () => {
      const ids = vi.fn((person: Person, index: number) => `${person.id}@${index}`);
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId: ids }),
      );
      expect(result.current.getRows().map((row) => row.rowId)).toEqual([
        'p1@0',
        'p2@1',
        'p3@2',
        'p4@3',
      ]);
      expect(ids).toHaveBeenCalledWith(people[1], 1);
    });

    it('holds inert feature slots without their plugins', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useTableFeatures({ items: people, columns, getRowId }));
      const { sort, selection, columnSizing } = result.current;

      expect(sort.value).toBeNull();
      expect(sort.getSortDirection('name')).toBeUndefined();
      act(() => {
        sort.setColumnSort('name', 'ascending', clickEvent());
        sort.toggleColumnSort('age');
      });
      expect(result.current.sort.value).toBeNull();
      expect(names(result.current)).toEqual(['Cleo', 'Abe', 'Bea', 'Dan']);

      expect(selection.selectionMode).toBe('multiple');
      expect(selection.selectedItems.size).toBe(0);
      expect(selection.allRowsSelected).toBe(false);
      expect(selection.someRowsSelected).toBe(false);
      act(() => {
        selection.toggleRow('p1');
        selection.selectRow('p2');
        selection.deselectRow('p2');
        selection.toggleAllRows();
        selection.clearRows();
      });
      expect(result.current.selection.isRowSelected('p1')).toBe(false);
      expect(result.current.selection.selectedItems.size).toBe(0);

      expect(columnSizing.columnWidths).toEqual({});
      expect(columnSizing.isSized).toBe(false);
      expect(columnSizing.getColumnWidth('name')).toBeUndefined();
      act(() => columnSizing.setColumnWidth('name', 300));
      expect(result.current.columnSizing.getColumnWidth('name')).toBeUndefined();
      expect(columnSizing.getTableProps()).toEqual({ style: {} });
      expect(columnSizing.getColumnProps('name')).toEqual({ style: {} });

      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps getRows and its rows across an unrelated re-render and changes them with items', () => {
      const { result, rerender } = renderHook(
        ({ items }) => useTableFeatures({ items, columns, getRowId }, [useTableSort<Person>()]),
        { initialProps: { items: people } },
      );
      const first = result.current.getRows();
      const getRows = result.current.getRows;

      rerender({ items: people });
      expect(result.current.getRows).toBe(getRows);
      expect(result.current.getRows()).toBe(first);

      rerender({ items: [...people] });
      expect(result.current.getRows()).not.toBe(first);
      expect(names(result.current)).toEqual(['Cleo', 'Abe', 'Bea', 'Dan']);
    });

    it('keeps getRows across a selection change and changes it with the sort', () => {
      const { result } = renderHook(() =>
        // The selection first: plugins apply in array order, and the order of the rows comes
        // from the sort wherever it is.
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSelection<Person>({ selectionMode: 'multiple' }),
          useTableSort<Person>({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
        ]),
      );
      const first = result.current.getRows();
      expect(names(result.current)).toEqual(['Abe', 'Bea', 'Cleo', 'Dan']);

      act(() => result.current.selection.toggleRow('p2'));
      expect(result.current.selection.isRowSelected('p2')).toBe(true);
      expect(result.current.getRows()).toBe(first);

      act(() => result.current.sort.toggleColumnSort('name'));
      expect(result.current.getRows()).not.toBe(first);
      expect(names(result.current)).toEqual(['Dan', 'Cleo', 'Bea', 'Abe']);
    });

    it('keeps getRows when a controlled sort is passed as a new object with the same value', () => {
      const { result, rerender } = renderHook(
        ({ sort }) =>
          useTableFeatures({ items: people, columns, getRowId }, [useTableSort<Person>({ sort })]),
        { initialProps: { sort: { columnId: 'age', direction: 'ascending' } as DataGridSort } },
      );
      const first = result.current.getRows();
      rerender({ sort: { columnId: 'age', direction: 'ascending' } });
      expect(result.current.getRows()).toBe(first);
    });
  });

  describe('useTableSort', () => {
    it("toggleColumnSort cycles ascending and descending, as DataGrid's sort button", () => {
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [useTableSort<Person>()]),
      );
      expect(result.current.sort.value).toBeNull();

      act(() => result.current.sort.toggleColumnSort('name'));
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'ascending' });
      expect(names(result.current)).toEqual(['Abe', 'Bea', 'Cleo', 'Dan']);

      act(() => result.current.sort.toggleColumnSort('name'));
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'descending' });
      expect(names(result.current)).toEqual(['Dan', 'Cleo', 'Bea', 'Abe']);

      act(() => result.current.sort.toggleColumnSort('name'));
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'ascending' });

      // Another column starts ascending, whatever the direction of the previous one.
      act(() => result.current.sort.toggleColumnSort('name'));
      act(() => result.current.sort.toggleColumnSort('age'));
      expect(result.current.sort.value).toEqual({ columnId: 'age', direction: 'ascending' });
    });

    it('setColumnSort sets the column and the direction; getSortDirection reads them', () => {
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [useTableSort<Person>()]),
      );
      act(() => result.current.sort.setColumnSort('name', 'descending'));
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'descending' });
      expect(result.current.sort.getSortDirection('name')).toBe('descending');
      expect(result.current.sort.getSortDirection('age')).toBeUndefined();
      expect(names(result.current)).toEqual(['Dan', 'Cleo', 'Bea', 'Abe']);
    });

    it('sorts stably: items that compare equal keep their order in items, in both directions', () => {
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [useTableSort<Person>()]),
      );
      act(() => result.current.sort.setColumnSort('age', 'ascending'));
      expect(names(result.current)).toEqual(['Abe', 'Dan', 'Cleo', 'Bea']);
      act(() => result.current.sort.setColumnSort('age', 'descending'));
      expect(names(result.current)).toEqual(['Cleo', 'Bea', 'Abe', 'Dan']);
      // The row keeps its index in items.
      expect(result.current.getRows()[0]).toEqual({ item: people[0], rowId: 'p1', index: 0 });
    });

    it('keeps the order of items for a column without compare, and for an unknown column', () => {
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [useTableSort<Person>()]),
      );
      act(() => result.current.sort.setColumnSort('note', 'descending'));
      expect(result.current.sort.getSortDirection('note')).toBe('descending');
      expect(names(result.current)).toEqual(['Cleo', 'Abe', 'Bea', 'Dan']);
      act(() => result.current.sort.setColumnSort('missing', 'ascending'));
      expect(names(result.current)).toEqual(['Cleo', 'Abe', 'Bea', 'Dan']);
    });

    it('looks the sorted column up once per sort, not once per comparison', () => {
      let reads = 0;
      const counted = columns.map((column) => {
        const copy = { ...column };
        Object.defineProperty(copy, 'columnId', {
          enumerable: true,
          get() {
            reads += 1;
            return column.columnId;
          },
        });
        return copy;
      });
      const many = Array.from({ length: 1000 }, (_, index) => ({
        id: `m${index}`,
        name: `Name ${index}`,
        age: (index * 7919) % 97,
      }));
      const { result } = renderHook(() =>
        useTableFeatures({ items: many, columns: counted, getRowId }, [useTableSort<Person>()]),
      );
      reads = 0;
      act(() => result.current.sort.setColumnSort('age', 'ascending'));
      expect(result.current.getRows()[0]!.item.age).toBe(0);
      expect(reads).toBeGreaterThan(0);
      expect(reads).toBeLessThanOrEqual(counted.length);
    });

    it('starts from defaultSort (uncontrolled)', () => {
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSort<Person>({ defaultSort: { columnId: 'age', direction: 'descending' } }),
        ]),
      );
      expect(result.current.sort.value).toEqual({ columnId: 'age', direction: 'descending' });
      expect(names(result.current)).toEqual(['Cleo', 'Bea', 'Abe', 'Dan']);
    });

    it('follows a controlled sort and asks for changes through onSortChange', () => {
      const onSortChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ sort }) =>
          useTableFeatures({ items: people, columns, getRowId }, [
            useTableSort<Person>({
              sort,
              defaultSort: { columnId: 'age', direction: 'ascending' },
              onSortChange,
            }),
          ]),
        {
          initialProps: {
            sort: { columnId: 'name', direction: 'ascending' } as DataGridSort | null,
          },
        },
      );
      expect(names(result.current)).toEqual(['Abe', 'Bea', 'Cleo', 'Dan']);

      const event = clickEvent();
      act(() => result.current.sort.toggleColumnSort('name', event));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(onSortChange).toHaveBeenCalledWith(
        { columnId: 'name', direction: 'descending' },
        { event },
      );
      // The parent did not take the change: the sort stays.
      expect(result.current.sort.value).toEqual({ columnId: 'name', direction: 'ascending' });
      expect(names(result.current)).toEqual(['Abe', 'Bea', 'Cleo', 'Dan']);

      rerender({ sort: { columnId: 'name', direction: 'descending' } });
      expect(names(result.current)).toEqual(['Dan', 'Cleo', 'Bea', 'Abe']);

      // A controlled null is an unsorted grid; defaultSort is not used.
      rerender({ sort: null });
      expect(result.current.sort.value).toBeNull();
      expect(names(result.current)).toEqual(['Cleo', 'Abe', 'Bea', 'Dan']);
    });

    it('calls onSortChange once per change, with the event when one is given', () => {
      const onSortChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSort<Person>({ onSortChange }),
        ]),
      );
      const event = clickEvent();
      act(() => result.current.sort.setColumnSort('age', 'ascending', event));
      act(() => result.current.sort.setColumnSort('age', 'ascending', event));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(onSortChange).toHaveBeenCalledWith(
        { columnId: 'age', direction: 'ascending' },
        { event },
      );

      act(() => result.current.sort.toggleColumnSort('age'));
      expect(onSortChange).toHaveBeenCalledTimes(2);
      expect(onSortChange).toHaveBeenLastCalledWith(
        { columnId: 'age', direction: 'descending' },
        undefined,
      );
    });

    it('calls onSortChange once per change in StrictMode', () => {
      const onSortChange = vi.fn();
      const { result } = renderHook(
        () =>
          useTableFeatures({ items: people, columns, getRowId }, [
            useTableSort<Person>({ onSortChange }),
          ]),
        { wrapper: React.StrictMode },
      );
      act(() => result.current.sort.toggleColumnSort('name'));
      expect(onSortChange).toHaveBeenCalledTimes(1);
      act(() => result.current.sort.toggleColumnSort('name'));
      expect(onSortChange).toHaveBeenCalledTimes(2);
      expect(names(result.current)).toEqual(['Dan', 'Cleo', 'Bea', 'Abe']);
    });
  });

  describe('useTableSelection', () => {
    it('selects, deselects and toggles rows by id in multiple mode', () => {
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSelection<Person>({ selectionMode: 'multiple', onSelectedItemsChange }),
        ]),
      );
      const event = clickEvent();
      act(() => result.current.selection.toggleRow('p1', event));
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p1'], { event, id: 'p1' });
      act(() => result.current.selection.selectRow('p3'));
      act(() => result.current.selection.toggleRow('p1'));
      expect(sorted(result.current.selection.selectedItems)).toEqual(['p3']);
      expect(result.current.selection.isRowSelected('p3')).toBe(true);
      expect(result.current.selection.isRowSelected('p1')).toBe(false);
      expect(result.current.selection.someRowsSelected).toBe(true);
      expect(result.current.selection.allRowsSelected).toBe(false);

      act(() => result.current.selection.deselectRow('p3'));
      expect(result.current.selection.selectedItems.size).toBe(0);
      expect(result.current.selection.someRowsSelected).toBe(false);
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(4);
    });

    it('select-all covers every item of items, while only a slice of 20 rows is ever read', () => {
      const many = Array.from({ length: 10_000 }, (_, index) => ({
        id: `r${index}`,
        name: `Row ${index}`,
        age: index % 90,
      }));
      const onSelectedItemsChange = vi.fn();

      function SlicedTable({ start }: { start: number }) {
        const { getRows, selection } = useTableFeatures({ items: many, columns, getRowId }, [
          useTableSelection<Person>({ selectionMode: 'multiple', onSelectedItemsChange }),
        ]);
        return (
          <table aria-label="People">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={selection.allRowsSelected}
                    onChange={(event) => selection.toggleAllRows(event.nativeEvent)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {getRows()
                .slice(start, start + 20)
                .map((row) => (
                  <tr key={row.rowId}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.item.name}`}
                        checked={selection.isRowSelected(row.rowId)}
                        onChange={(event) => selection.toggleRow(row.rowId, event.nativeEvent)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        );
      }

      const { rerender } = render(<SlicedTable start={0} />);
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      expect(selectAll).not.toBeChecked();

      fireEvent.click(selectAll);
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      const [selected, details] = onSelectedItemsChange.mock.calls[0]!;
      expect(selected).toHaveLength(10_000);
      expect(selected[0]).toBe('r0');
      expect(selected[9_999]).toBe('r9999');
      expect(details).toEqual({ event: expect.any(Event) });
      expect(selectAll).toBeChecked();

      rerender(<SlicedTable start={5_000} />);
      expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeChecked();
      const rowBoxes = screen.getAllByRole('checkbox', { name: /^Select Row/ });
      expect(rowBoxes).toHaveLength(20);
      expect(rowBoxes[0]).toHaveAccessibleName('Select Row 5000');
      for (const box of rowBoxes) expect(box).toBeChecked();

      // Deselecting one row clears the header; the next select-all selects it again.
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Row 5003' }));
      expect(onSelectedItemsChange.mock.calls[1]![0]).toHaveLength(9_999);
      expect(screen.getByRole('checkbox', { name: 'Select all rows' })).not.toBeChecked();
    });

    it('keeps a selected id that is not in items, without counting it', () => {
      const onSelectedItemsChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ items }) =>
          useTableFeatures({ items, columns, getRowId }, [
            useTableSelection<Person>({
              selectionMode: 'multiple',
              defaultSelectedItems: ['gone'],
              onSelectedItemsChange,
            }),
          ]),
        { initialProps: { items: people } },
      );
      expect(result.current.selection.isRowSelected('gone')).toBe(true);
      expect(result.current.selection.someRowsSelected).toBe(false);
      expect(result.current.selection.allRowsSelected).toBe(false);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['gone', 'p1', 'p2', 'p3', 'p4'], {
        event: undefined,
      });
      expect(result.current.selection.allRowsSelected).toBe(true);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['gone'], { event: undefined });
      expect(result.current.selection.allRowsSelected).toBe(false);
      expect(result.current.selection.someRowsSelected).toBe(false);

      // Items replaced (a filter, another page): a selected id whose item left stays selected.
      act(() => result.current.selection.selectRow('p2'));
      rerender({ items: people.filter((person) => person.id !== 'p2') });
      expect(sorted(result.current.selection.selectedItems)).toEqual(['gone', 'p2']);
      expect(result.current.selection.someRowsSelected).toBe(false);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['gone', 'p2', 'p1', 'p3', 'p4'], {
        event: undefined,
      });
      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['gone', 'p2'], { event: undefined });
    });

    it('skips isDisabled rows in select-all, called with the item and its index in items', () => {
      const isDisabled = vi.fn((person: Person) => person.id === 'p2');
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSort<Person>({ defaultSort: { columnId: 'name', direction: 'ascending' } }),
          useTableSelection<Person>({
            selectionMode: 'multiple',
            isDisabled,
            onSelectedItemsChange,
          }),
        ]),
      );
      expect(isDisabled).toHaveBeenCalledWith(people[1], 1);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p1', 'p3', 'p4'], {
        event: undefined,
      });
      // Every selectable row is selected: the disabled one does not hold the header back.
      expect(result.current.selection.allRowsSelected).toBe(true);
      expect(result.current.selection.someRowsSelected).toBe(false);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith([], { event: undefined });
      expect(result.current.selection.allRowsSelected).toBe(false);
    });

    it('keeps a selected disabled row through select-all and deselect-all', () => {
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSelection<Person>({
            selectionMode: 'multiple',
            defaultSelectedItems: ['p2'],
            isDisabled: isP2,
            onSelectedItemsChange,
          }),
        ]),
      );
      // A selected disabled row counts as some, never as all.
      expect(result.current.selection.someRowsSelected).toBe(true);
      expect(result.current.selection.allRowsSelected).toBe(false);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p2', 'p1', 'p3', 'p4'], {
        event: undefined,
      });
      expect(result.current.selection.allRowsSelected).toBe(true);

      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p2'], { event: undefined });
      expect(result.current.selection.allRowsSelected).toBe(false);
      expect(result.current.selection.someRowsSelected).toBe(true);
    });

    it('has nothing to select when every row is disabled or items is empty', () => {
      const onSelectedItemsChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ items }) =>
          useTableFeatures({ items, columns, getRowId }, [
            useTableSelection<Person>({
              selectionMode: 'multiple',
              isDisabled: always,
              onSelectedItemsChange,
            }),
          ]),
        { initialProps: { items: people } },
      );
      act(() => result.current.selection.toggleAllRows());
      expect(result.current.selection.allRowsSelected).toBe(false);
      rerender({ items: [] });
      act(() => result.current.selection.toggleAllRows());
      expect(result.current.selection.allRowsSelected).toBe(false);
      expect(result.current.selection.someRowsSelected).toBe(false);
      expect(onSelectedItemsChange).not.toHaveBeenCalled();
    });

    it('single mode keeps one id: toggleRow selects, toggleAllRows does nothing', () => {
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSelection<Person>({ selectionMode: 'single', onSelectedItemsChange }),
        ]),
      );
      expect(result.current.selection.selectionMode).toBe('single');
      act(() => result.current.selection.toggleRow('p1'));
      act(() => result.current.selection.toggleRow('p3'));
      expect(sorted(result.current.selection.selectedItems)).toEqual(['p3']);
      act(() => result.current.selection.toggleRow('p3'));
      act(() => result.current.selection.toggleAllRows());
      expect(sorted(result.current.selection.selectedItems)).toEqual(['p3']);
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p3'], {
        event: undefined,
        id: 'p3',
      });
    });

    it('follows a controlled selectedItems and asks for changes', () => {
      const onSelectedItemsChange = vi.fn();
      const { result, rerender } = renderHook(
        ({ selectedItems }) =>
          useTableFeatures({ items: people, columns, getRowId }, [
            useTableSelection<Person>({
              selectionMode: 'multiple',
              selectedItems,
              onSelectedItemsChange,
            }),
          ]),
        { initialProps: { selectedItems: ['p1'] as readonly string[] } },
      );
      act(() => result.current.selection.toggleRow('p2'));
      expect(onSelectedItemsChange).toHaveBeenCalledWith(['p1', 'p2'], {
        event: undefined,
        id: 'p2',
      });
      expect(sorted(result.current.selection.selectedItems)).toEqual(['p1']);

      rerender({ selectedItems: ['p1', 'p2', 'p3', 'p4'] });
      expect(result.current.selection.allRowsSelected).toBe(true);
    });

    it('clearRows empties the selection, ids outside items included', () => {
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(() =>
        useTableFeatures({ items: people, columns, getRowId }, [
          useTableSelection<Person>({
            selectionMode: 'multiple',
            defaultSelectedItems: ['gone', 'p1'],
            onSelectedItemsChange,
          }),
        ]),
      );
      const event = clickEvent();
      act(() => result.current.selection.clearRows(event));
      expect(onSelectedItemsChange).toHaveBeenCalledWith([], { event });
      expect(result.current.selection.selectedItems.size).toBe(0);
    });

    it('calls onSelectedItemsChange once per change in StrictMode', () => {
      const onSelectedItemsChange = vi.fn();
      const { result } = renderHook(
        () =>
          useTableFeatures({ items: people, columns, getRowId }, [
            useTableSelection<Person>({ selectionMode: 'multiple', onSelectedItemsChange }),
          ]),
        { wrapper: React.StrictMode },
      );
      act(() => result.current.selection.toggleRow('p1'));
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
      act(() => result.current.selection.toggleAllRows());
      expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
      expect(onSelectedItemsChange).toHaveBeenLastCalledWith(['p1', 'p2', 'p3', 'p4'], {
        event: undefined,
      });
    });
  });

  describe('development warnings', () => {
    it('warns once when two plugins fill the same feature', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, rerender } = renderHook(() => {
        const sort = useTableSort<Person>();
        return useTableFeatures({ items: people, columns, getRowId }, [sort, sort]);
      });
      rerender();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] useTableFeatures: more than one plugin fills `sort`. Pass each feature once; ' +
          'the plugins are applied in order, so the last one fills the state.',
      );
      // Still applied, in order.
      act(() => result.current.sort.toggleColumnSort('name'));
      expect(names(result.current)).toEqual(['Abe', 'Bea', 'Cleo', 'Dan']);
    });

    it('warns once when the number of plugins changes, and applies the new plugins', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result, rerender } = renderHook(
        ({ withSelection }) => {
          const sort = useTableSort<Person>();
          const selection = useTableSelection<Person>({ selectionMode: 'multiple' });
          return useTableFeatures(
            { items: people, columns, getRowId },
            withSelection ? [sort, selection] : [sort],
          );
        },
        { initialProps: { withSelection: false } },
      );
      act(() => result.current.selection.toggleRow('p1'));
      expect(result.current.selection.isRowSelected('p1')).toBe(false);

      rerender({ withSelection: true });
      act(() => result.current.selection.toggleRow('p1'));
      expect(result.current.selection.isRowSelected('p1')).toBe(true);
      rerender({ withSelection: false });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] useTableFeatures: the number of plugins changed between renders (from 1 to ' +
          '2). Pass the same plugins on every render and change their options instead; the new ' +
          'plugins are applied.',
      );
    });

    it('warns once when two items share a row id', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const twins = [...people, { id: 'p1', name: 'Eve', age: 41 }];
      const { result, rerender } = renderHook(
        ({ items }) => useTableFeatures({ items, columns, getRowId }),
        { initialProps: { items: twins } },
      );
      rerender({ items: [...twins] });
      expect(result.current.getRows().map((row) => row.rowId)).toEqual([
        'p1',
        'p2',
        'p3',
        'p4',
        'p1',
      ]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] useTableFeatures: more than one item has the row id "p1". Row ids must be ' +
          'unique: give getRowId an id that differs for each item.',
      );
    });
  });
});

function isP2(person: Person): boolean {
  return person.id === 'p2';
}

function always(): boolean {
  return true;
}
