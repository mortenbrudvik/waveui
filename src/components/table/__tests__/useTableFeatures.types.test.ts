import { describe, it, expect, expectTypeOf } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { createTableColumn } from '../../../lib/table';
import type { SelectionMode } from '../../../lib/types';
import type { UseSelectionChangeDetails } from '../../../hooks/useSelection';
import type {
  DataGridColumn,
  DataGridSort,
  DataGridSortChangeDetails,
  SortDirection,
} from '../DataGrid';
import {
  useTableFeatures,
  type TableColumnSizingState,
  type TableFeaturePlugin,
  type TableFeaturesState,
  type TableRowData,
  type TableSelectionState,
  type TableSortState,
  type UseTableFeaturesOptions,
} from '../useTableFeatures';
import { useTableSelection, type UseTableSelectionOptions } from '../useTableSelection';
import { useTableSort, type UseTableSortOptions } from '../useTableSort';

interface Person {
  id: string;
  name: string;
  age: number;
}

interface Car {
  make: string;
}

const people: readonly Person[] = [
  { id: 'p1', name: 'Cleo', age: 30 },
  { id: 'p2', name: 'Abe', age: 25 },
];

const columns = [
  createTableColumn<Person>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
  }),
];

describe('useTableFeatures types', () => {
  it('flows the item type from items to the rows and to isDisabled', () => {
    const { result } = renderHook(() =>
      useTableFeatures({ items: people, columns, getRowId: (person) => person.id }, [
        useTableSort(),
        useTableSelection({
          selectionMode: 'multiple',
          isDisabled: (item, index) => {
            expectTypeOf(item).toEqualTypeOf<Person>();
            expectTypeOf(index).toEqualTypeOf<number>();
            return item.age > 40;
          },
        }),
      ]),
    );
    expectTypeOf(result.current).toEqualTypeOf<TableFeaturesState<Person>>();
    expectTypeOf(result.current.getRows()).toEqualTypeOf<readonly TableRowData<Person>[]>();
    expectTypeOf(result.current.getRows()[0]!.item).toEqualTypeOf<Person>();
    expect(result.current.getRows()[0]!.item).toBe(people[0]);
  });

  it('takes the plugins as an optional second argument', () => {
    const { result } = renderHook(() => useTableFeatures({ items: people, columns }));
    expectTypeOf(result.current.items).toEqualTypeOf<readonly Person[]>();
    expectTypeOf(result.current.columns).toEqualTypeOf<readonly DataGridColumn<Person>[]>();
    expectTypeOf(result.current.getRowId).toEqualTypeOf<(item: Person, index: number) => string>();
    expectTypeOf(useTableFeatures<Person>)
      .parameter(1)
      .toEqualTypeOf<readonly TableFeaturePlugin<Person>[] | undefined>();
    expect(result.current.getRows()).toHaveLength(2);
  });

  it('fits a plugin that reads no item to every table, and a typed one only to its own', () => {
    const { result } = renderHook(() => {
      const sort = useTableSort();
      const selection = useTableSelection({
        selectionMode: 'single',
        isDisabled: (person: Person) => person.age > 40,
      });
      const cars = useTableSelection({
        selectionMode: 'single',
        isDisabled: (car: Car) => car.make === '',
      });
      expectTypeOf(sort).toEqualTypeOf<TableFeaturePlugin<unknown>>();
      expectTypeOf(cars).toEqualTypeOf<TableFeaturePlugin<Car>>();
      // @ts-expect-error a plugin for cars does not fit a table of people
      const wrong: readonly TableFeaturePlugin<Person>[] = [cars];
      expect(wrong).toHaveLength(1);
      return useTableFeatures({ items: people, columns }, [sort, selection]);
    });
    expectTypeOf(result.current.getRows()[0]!.item).toEqualTypeOf<Person>();
  });

  it('keeps a plugin opaque: it comes only from the plugin hooks', () => {
    // @ts-expect-error a plugin cannot be written by hand
    const handmade: TableFeaturePlugin<Person> = {};
    expect(handmade).toEqual({});
  });

  it('types the options of the hooks with the existing table and selection types', () => {
    expectTypeOf<UseTableFeaturesOptions<Person>['items']>().toEqualTypeOf<readonly Person[]>();
    expectTypeOf<UseTableFeaturesOptions<Person>['columns']>().toEqualTypeOf<
      readonly DataGridColumn<Person>[]
    >();
    expectTypeOf<UseTableFeaturesOptions<Person>['getRowId']>().toEqualTypeOf<
      ((item: Person, index: number) => string) | undefined
    >();

    expectTypeOf<UseTableSortOptions['sort']>().toEqualTypeOf<DataGridSort | null | undefined>();
    expectTypeOf<UseTableSortOptions['defaultSort']>().toEqualTypeOf<
      DataGridSort | null | undefined
    >();
    expectTypeOf<NonNullable<UseTableSortOptions['onSortChange']>>().toEqualTypeOf<
      (sort: DataGridSort, details?: DataGridSortChangeDetails) => void
    >();
    expectTypeOf(useTableSort<Person>)
      .parameter(0)
      .toEqualTypeOf<UseTableSortOptions | undefined>();

    expectTypeOf<
      UseTableSelectionOptions<Person>['selectionMode']
    >().toEqualTypeOf<SelectionMode>();
    expectTypeOf<UseTableSelectionOptions<Person>['selectedItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<UseTableSelectionOptions<Person>['defaultSelectedItems']>().toEqualTypeOf<
      readonly string[] | undefined
    >();
    expectTypeOf<
      NonNullable<UseTableSelectionOptions<Person>['onSelectedItemsChange']>
    >().toEqualTypeOf<(selectedItems: string[], details?: UseSelectionChangeDetails) => void>();
    expectTypeOf<UseTableSelectionOptions<Person>['isDisabled']>().toEqualTypeOf<
      ((item: Person, index: number) => boolean) | undefined
    >();
    // @ts-expect-error selectionMode is required
    const missing: UseTableSelectionOptions<Person> = {};
    expect(missing).toEqual({});
  });

  it('types the feature slots, with string column ids', () => {
    expectTypeOf<TableFeaturesState<Person>['sort']>().toEqualTypeOf<TableSortState>();
    expectTypeOf<TableFeaturesState<Person>['selection']>().toEqualTypeOf<TableSelectionState>();
    expectTypeOf<
      TableFeaturesState<Person>['columnSizing']
    >().toEqualTypeOf<TableColumnSizingState>();
    expectTypeOf<TableRowData<Person>>().toEqualTypeOf<{
      item: Person;
      rowId: string;
      index: number;
    }>();

    expectTypeOf<TableSortState['value']>().toEqualTypeOf<DataGridSort | null>();
    expectTypeOf<TableSortState['setColumnSort']>().toEqualTypeOf<
      (columnId: string, direction: SortDirection, event?: Event) => void
    >();
    expectTypeOf<TableSortState['toggleColumnSort']>().toEqualTypeOf<
      (columnId: string, event?: Event) => void
    >();
    expectTypeOf<TableSortState['getSortDirection']>().toEqualTypeOf<
      (columnId: string) => SortDirection | undefined
    >();

    expectTypeOf<TableSelectionState['selectionMode']>().toEqualTypeOf<SelectionMode>();
    expectTypeOf<TableSelectionState['selectedItems']>().toEqualTypeOf<ReadonlySet<string>>();
    expectTypeOf<TableSelectionState['allRowsSelected']>().toEqualTypeOf<boolean>();
    expectTypeOf<TableSelectionState['someRowsSelected']>().toEqualTypeOf<boolean>();
    expectTypeOf<TableSelectionState['isRowSelected']>().toEqualTypeOf<(id: string) => boolean>();
    expectTypeOf<TableSelectionState['toggleRow']>().toEqualTypeOf<
      (id: string, event?: Event) => void
    >();
    expectTypeOf<TableSelectionState['selectRow']>().toEqualTypeOf<
      (id: string, event?: Event) => void
    >();
    expectTypeOf<TableSelectionState['deselectRow']>().toEqualTypeOf<
      (id: string, event?: Event) => void
    >();
    expectTypeOf<TableSelectionState['toggleAllRows']>().toEqualTypeOf<(event?: Event) => void>();
    expectTypeOf<TableSelectionState['clearRows']>().toEqualTypeOf<(event?: Event) => void>();

    expectTypeOf<TableColumnSizingState['columnWidths']>().toEqualTypeOf<
      Readonly<Record<string, number>>
    >();
    expectTypeOf<TableColumnSizingState['getColumnWidth']>().toEqualTypeOf<
      (columnId: string) => number | undefined
    >();
    expectTypeOf<TableColumnSizingState['setColumnWidth']>().toEqualTypeOf<
      (columnId: string, width: number, event?: Event) => void
    >();
    expectTypeOf<ReturnType<TableColumnSizingState['getTableProps']>>().toEqualTypeOf<{
      style: CSSProperties;
    }>();
    expectTypeOf<ReturnType<TableColumnSizingState['getColumnProps']>>().toEqualTypeOf<{
      style: CSSProperties;
    }>();
  });
});
