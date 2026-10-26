import type * as React from 'react';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DataGridColumn } from '../../components/table/DataGrid';
import { createTableColumn } from '../table';
import type { CreateTableColumnOptions } from '../table';

interface Person {
  name: string;
  age: number;
}

describe('createTableColumn', () => {
  it('returns a column with every member, sortable when it has `compare`', () => {
    const compare = (a: Person, b: Person) => a.age - b.age;
    const renderCell = (person: Person) => person.name;
    const renderHeaderCell = () => 'Age';
    const column = createTableColumn<Person>({
      columnId: 'age',
      label: 'Age',
      compare,
      renderCell,
      renderHeaderCell,
    });
    expect(column).toStrictEqual({
      columnId: 'age',
      label: 'Age',
      compare,
      renderCell,
      renderHeaderCell,
      sortable: true,
    });
  });

  it('is not sortable without `compare`, and leaves the other members unset', () => {
    expect(createTableColumn({ columnId: 'name' })).toStrictEqual({
      columnId: 'name',
      label: undefined,
      compare: undefined,
      renderCell: undefined,
      renderHeaderCell: undefined,
      sortable: false,
    });
  });

  it('keeps an explicit `sortable` over the default', () => {
    const compare = (a: Person, b: Person) => a.age - b.age;
    expect(createTableColumn<Person>({ columnId: 'age', compare, sortable: false }).sortable).toBe(
      false,
    );
    // A server-sorted column: a sort button, but no `compare` (the grid never reorders it).
    expect(createTableColumn<Person>({ columnId: 'name', sortable: true }).sortable).toBe(true);
  });

  it('returns a new object and leaves the options unchanged', () => {
    const options: CreateTableColumnOptions<Person> = { columnId: 'name', label: 'Name' };
    const column = createTableColumn(options);
    expect(column).not.toBe(options);
    expect(options).toStrictEqual({ columnId: 'name', label: 'Name' });
  });

  it('types the column by its items', () => {
    const column = createTableColumn<Person>({
      columnId: 'name',
      compare: (a, b) => {
        expectTypeOf(a).toEqualTypeOf<Person>();
        return a.name.localeCompare(b.name);
      },
      renderCell: (person) => {
        expectTypeOf(person).toEqualTypeOf<Person>();
        return person.name;
      },
    });
    expectTypeOf(column).toEqualTypeOf<DataGridColumn<Person>>();
    // The item type is inferred from an annotated callback too.
    expectTypeOf(
      createTableColumn({ columnId: 'age', renderCell: (person: Person) => person.age }),
    ).toEqualTypeOf<DataGridColumn<Person>>();
    expectTypeOf<CreateTableColumnOptions<Person>['label']>().toEqualTypeOf<
      React.ReactNode | undefined
    >();
    // @ts-expect-error — `columnId` is required (there is no deprecated `id` here).
    createTableColumn<Person>({ id: 'name' });
  });
});
