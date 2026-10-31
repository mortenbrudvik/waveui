import * as React from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react';
import * as stories from '../../../../stories/DataGrid.stories';
import {
  DataGrid,
  useDataGridRowId,
  useDataGridSelection,
  useDataGridSort,
  type DataGridBaseProps,
  type DataGridColumn,
  type DataGridItemsSortProps,
  type DataGridSort,
  type DataGridSortChangeDetails,
  type UseDataGridSelectionResult,
  type UseDataGridSortResult,
} from '../DataGrid';
import * as HooksModule from '../DataGrid.hooks';
import { createSelectionStore } from '../DataGrid.store';
import { ToggleButton } from '../../button/ToggleButton';
import { dataGridClassNames } from '../../../lib/classNames';
import { createTableColumn } from '../../../lib/table';
import { useVirtualWindow } from '../../../hooks/useVirtualWindow';
import { asClientReference, expectNoA11yViolations, expectThrows } from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const SORT_ERROR = '[WaveUI] useDataGridSort must be used within DataGrid';
const SELECTION_ERROR = '[WaveUI] useDataGridSelection must be used within DataGrid';
const ROW_ID_ERROR = '[WaveUI] useDataGridRowId must be used within DataGrid.Row';
const POSITIONAL_SORT_WARNING =
  '[WaveUI] DataGrid: `onSortChange(columnId, direction)` is deprecated and will be removed in 1.0. Use `onSortChange(sort, details?)` instead. Pass `items`, `sort` or `defaultSort` to receive the sort object.';

interface Person {
  id: string;
  name: string;
  role: string;
}

// Sorted by name: Alice, Bob, Carol; by role: Bob, Carol, Alice.
const PEOPLE: readonly Person[] = [
  { id: 'a', name: 'Alice', role: 'Engineer' },
  { id: 'b', name: 'Bob', role: 'Analyst' },
  { id: 'c', name: 'Carol', role: 'Designer' },
];

const getId = (person: Person) => person.id;

const COLUMNS: readonly DataGridColumn<Person>[] = [
  createTableColumn<Person>({
    columnId: 'name',
    label: 'Name',
    compare: (x, y) => x.name.localeCompare(y.name),
    renderCell: (person) => person.name,
  }),
  createTableColumn<Person>({
    columnId: 'role',
    label: 'Role',
    compare: (x, y) => x.role.localeCompare(y.role),
    renderCell: (person) => person.role,
  }),
];

/** Every value each probe recorded, by probe id. */
function recorder<V>() {
  const seen = new Map<string, V[]>();
  return {
    record: (id: string, value: V) => {
      const list = seen.get(id) ?? [];
      list.push(value);
      seen.set(id, list);
    },
    last: (id: string): V => {
      const list = seen.get(id);
      if (!list) throw new Error(`probe ${id} never rendered`);
      return list[list.length - 1];
    },
    count: (id: string): number => seen.get(id)?.length ?? 0,
    has: (id: string): boolean => seen.has(id),
  };
}

type RecordValue<V> = (id: string, value: V) => void;

function SortProbe({ id, record }: { id: string; record: RecordValue<UseDataGridSortResult> }) {
  record(id, useDataGridSort());
  return null;
}

function SelectionProbe({
  id,
  record,
}: {
  id: string;
  record: RecordValue<UseDataGridSelectionResult>;
}) {
  record(id, useDataGridSelection());
  return null;
}

function RowIdProbe({ id, record }: { id: string; record: RecordValue<string | undefined> }) {
  record(id, useDataGridRowId());
  return null;
}

/** The names of the people in the body rows of the grid named "People", in their order. */
const rowNames = () =>
  within(screen.getByRole('grid', { name: 'People' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => PEOPLE.find((person) => row.textContent?.includes(person.name))?.name);

const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) });
const rowCheckbox = (name: string) => screen.getByRole('checkbox', { name });
/** The cell that shows `text` (not the selection cell, whose checkbox it names). */
const cellWithText = (text: string) => {
  const cell = screen.getByText(text).closest('td');
  if (!cell) throw new Error(`no cell shows ${text}`);
  return cell;
};

// ---------------------------------------------------------------------------
// useDataGridSort
// ---------------------------------------------------------------------------

describe('useDataGridSort (P13-02, R16)', () => {
  /** A grid of `PEOPLE` with a probe of the hook in its caption. */
  function SortGrid({
    probes,
    ...props
  }: Omit<ItemsGridProps, 'children'> & {
    probes: { record: RecordValue<UseDataGridSortResult> };
  }) {
    return (
      <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS} getRowId={getId} {...props}>
        <caption>
          <SortProbe id="caption" record={probes.record} />
        </caption>
      </DataGrid>
    );
  }

  it('returns exactly sort and setSort, nothing else', () => {
    const probes = recorder<UseDataGridSortResult>();
    render(<SortGrid probes={probes} defaultSort={{ columnId: 'name', direction: 'ascending' }} />);
    const value = probes.last('caption');
    expect(Object.keys(value).sort()).toEqual(['setSort', 'sort']);
    expect(value.sort).toStrictEqual({ columnId: 'name', direction: 'ascending' });
    expect(value.setSort).toBeTypeOf('function');
  });

  it('is null while the grid is unsorted, and follows a sort made with a header', async () => {
    const user = userEvent.setup();
    const probes = recorder<UseDataGridSortResult>();
    render(<SortGrid probes={probes} />);
    expect(probes.last('caption').sort).toBeNull();
    await user.click(within(header('Role')).getByRole('button'));
    expect(probes.last('caption').sort).toStrictEqual({ columnId: 'role', direction: 'ascending' });
    await user.click(within(header('Role')).getByRole('button'));
    expect(probes.last('caption').sort).toStrictEqual({
      columnId: 'role',
      direction: 'descending',
    });
  });

  it('setSort sorts an uncontrolled grid and calls onSortChange once, with the event passed', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(<SortGrid probes={probes} defaultSort={null} onSortChange={onSortChange} />);
    expect(rowNames()).toEqual(['Alice', 'Bob', 'Carol']);
    const event = new MouseEvent('click');
    act(() => probes.last('caption').setSort({ columnId: 'role', direction: 'descending' }, event));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'role', direction: 'descending' },
      { event },
    );
    expect(header('Role')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    expect(probes.last('caption').sort).toStrictEqual({
      columnId: 'role',
      direction: 'descending',
    });
    // Engineer, Designer, Analyst.
    expect(rowNames()).toEqual(['Alice', 'Carol', 'Bob']);
  });

  it('setSort without an event reports an untrusted sort event with no target', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn<(sort: DataGridSort, details?: DataGridSortChangeDetails) => void>();
    render(<SortGrid probes={probes} defaultSort={null} onSortChange={onSortChange} />);
    act(() => probes.last('caption').setSort({ columnId: 'name', direction: 'ascending' }));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    const details = onSortChange.mock.calls[0][1];
    expect(details?.event).toBeInstanceOf(Event);
    expect(details?.event.type).toBe('sort');
    expect(details?.event.isTrusted).toBe(false);
    expect(details?.event.target).toBeNull();
  });

  it('setSort of the sort the grid already has changes nothing and calls nothing', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(
      <SortGrid
        probes={probes}
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
        onSortChange={onSortChange}
      />,
    );
    const before = probes.last('caption');
    act(() => before.setSort({ columnId: 'name', direction: 'ascending' }));
    expect(onSortChange).not.toHaveBeenCalled();
    expect(probes.last('caption')).toBe(before);
  });

  it('setSort takes the column and direction of the object passed, not the object itself', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(<SortGrid probes={probes} defaultSort={null} onSortChange={onSortChange} />);
    const requested = { columnId: 'name', direction: 'descending', extra: 1 } as DataGridSort;
    act(() => probes.last('caption').setSort(requested));
    const reported = onSortChange.mock.calls[0][0];
    expect(reported).toStrictEqual({ columnId: 'name', direction: 'descending' });
    expect(reported).not.toBe(requested);
    expect(probes.last('caption').sort).toStrictEqual(reported);
  });

  it('in a controlled grid, setSort asks the parent: nothing changes until it accepts', async () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    function Controlled({ accept }: { accept: boolean }) {
      const [sort, setSort] = React.useState<DataGridSort | null>(null);
      return (
        <SortGrid
          probes={probes}
          sort={sort}
          onSortChange={(next, details) => {
            onSortChange(next, details);
            if (accept) setSort(next);
          }}
        />
      );
    }
    const { rerender } = render(<Controlled accept={false} />);
    act(() => probes.last('caption').setSort({ columnId: 'role', direction: 'ascending' }));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'role', direction: 'ascending' },
      { event: expect.any(Event) },
    );
    expect(probes.last('caption').sort).toBeNull();
    expect(header('Role')).toHaveAttribute('aria-sort', 'none');

    // A separate interaction: the next request starts from the sort the parent kept.
    await act(async () => {});
    rerender(<Controlled accept />);
    act(() => probes.last('caption').setSort({ columnId: 'role', direction: 'ascending' }));
    expect(onSortChange).toHaveBeenCalledTimes(2);
    expect(probes.last('caption').sort).toStrictEqual({ columnId: 'role', direction: 'ascending' });
    expect(header('Role')).toHaveAttribute('aria-sort', 'ascending');
    expect(rowNames()).toEqual(['Bob', 'Carol', 'Alice']);
  });

  it('works in a grid without items (the consumer orders the rows)', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="People" defaultSort={null} onSortChange={onSortChange}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="a">
            <DataGrid.Cell>
              Alice
              <SortProbe id="cell" record={probes.record} />
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    act(() => probes.last('cell').setSort({ columnId: 'name', direction: 'descending' }));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'name', direction: 'descending' },
      { event: expect.any(Event) },
    );
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
  });

  it('calls the deprecated positional onSortChange with the column and direction, and adds no warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(
      <DataGrid aria-label="People" onSortChange={onSortChange}>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell columnId="name" sortable>
              Name
            </DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="a">
            <DataGrid.Cell>
              Alice
              <SortProbe id="cell" record={probes.record} />
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    // The grid's own announcement of the positional form, from its render.
    expect(warn.mock.calls).toEqual([[POSITIONAL_SORT_WARNING]]);
    act(() => probes.last('cell').setSort({ columnId: 'name', direction: 'descending' }));
    expect(onSortChange.mock.calls).toEqual([['name', 'descending']]);
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    expect(probes.last('cell').sort).toStrictEqual({ columnId: 'name', direction: 'descending' });
    expect(warn.mock.calls).toEqual([[POSITIONAL_SORT_WARNING]]);
  });

  it('reads the grid in a header cell of your own and in a body cell', () => {
    const probes = recorder<UseDataGridSortResult>();
    const columns: readonly DataGridColumn<Person>[] = [
      {
        ...COLUMNS[0],
        renderHeaderCell: () => (
          <>
            Name
            <SortProbe id="header" record={probes.record} />
          </>
        ),
        renderCell: (person) => (
          <>
            {person.name}
            <SortProbe id={`cell-${person.id}`} record={probes.record} />
          </>
        ),
      },
    ];
    render(
      <DataGrid
        aria-label="People"
        items={PEOPLE}
        columns={columns}
        getRowId={getId}
        defaultSort={{ columnId: 'name', direction: 'descending' }}
      />,
    );
    const value = probes.last('header');
    expect(value.sort).toStrictEqual({ columnId: 'name', direction: 'descending' });
    for (const person of PEOPLE) {
      const cell = probes.last(`cell-${person.id}`);
      expect(cell.sort).toBe(value.sort);
      expect(cell.setSort).toBe(value.setSort);
    }
  });

  it('the same object across unrelated renders; setSort keeps its identity when the sort changes', () => {
    const probes = recorder<UseDataGridSortResult>();
    function Parent({ tick }: { tick: number }) {
      return <SortGrid probes={probes} defaultSort={null} data-tick={tick} />;
    }
    const { rerender } = render(<Parent tick={0} />);
    const first = probes.last('caption');
    rerender(<Parent tick={1} />);
    expect(probes.count('caption')).toBeGreaterThan(1);
    expect(probes.last('caption')).toBe(first);

    act(() => first.setSort({ columnId: 'name', direction: 'ascending' }));
    const sorted = probes.last('caption');
    expect(sorted).not.toBe(first);
    expect(sorted.setSort).toBe(first.setSort);
    rerender(<Parent tick={2} />);
    expect(probes.last('caption')).toBe(sorted);
  });

  it('calls onSortChange once per setSort in StrictMode', () => {
    const probes = recorder<UseDataGridSortResult>();
    const onSortChange = vi.fn();
    render(
      <React.StrictMode>
        <SortGrid probes={probes} defaultSort={null} onSortChange={onSortChange} />
      </React.StrictMode>,
    );
    act(() => probes.last('caption').setSort({ columnId: 'role', direction: 'ascending' }));
    expect(onSortChange).toHaveBeenCalledTimes(1);
    act(() => probes.last('caption').setSort({ columnId: 'role', direction: 'descending' }));
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });

  it('the example of the hook’s documentation works as written', async () => {
    /** The `@example` of `useDataGridSort`, verbatim. */
    function ReverseButton() {
      const { sort, setSort } = useDataGridSort();
      if (sort === null) return null;
      const direction = sort.direction === 'ascending' ? 'descending' : 'ascending';
      return (
        <button
          type="button"
          onClick={(event) => setSort({ columnId: sort.columnId, direction }, event.nativeEvent)}
        >
          Reverse order
        </button>
      );
    }
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        items={PEOPLE}
        columns={COLUMNS}
        getRowId={getId}
        defaultSort={{ columnId: 'name', direction: 'ascending' }}
        onSortChange={onSortChange}
      >
        <tfoot>
          <tr>
            <td colSpan={2}>
              <ReverseButton />
            </td>
          </tr>
        </tfoot>
      </DataGrid>,
    );
    await user.click(screen.getByRole('button', { name: 'Reverse order' }));
    expect(onSortChange).toHaveBeenCalledWith(
      { columnId: 'name', direction: 'descending' },
      { event: expect.any(MouseEvent) },
    );
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('button', { name: 'Reverse order' }));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });

  it('throws outside a DataGrid in development (C-CONTEXT)', () => {
    expectThrows(<SortProbe id="orphan" record={() => {}} />, SORT_ERROR);
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a DataGrid and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const probes = recorder<UseDataGridSortResult>();
      const { rerender } = render(<SortProbe id="orphan" record={probes.record} />);
      rerender(<SortProbe id="orphan" record={probes.record} />);
      expect(error.mock.calls).toEqual([[SORT_ERROR]]);
      const value = probes.last('orphan');
      expect(Object.keys(value).sort()).toEqual(['setSort', 'sort']);
      expect(value.sort).toBeNull();
      expect(() => value.setSort({ columnId: 'name', direction: 'ascending' })).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// useDataGridSelection
// ---------------------------------------------------------------------------

type ItemsGridProps = Partial<Omit<DataGridBaseProps<Person>, 'children'>> &
  Partial<Pick<DataGridItemsSortProps<Person>, 'sort' | 'defaultSort' | 'onSortChange'>> & {
    items?: readonly Person[];
    children?: React.ReactNode;
  };

/** A grid of `PEOPLE` (multiple selection by default) with whatever children are passed. */
function ItemsGrid({ items = PEOPLE, children, ...props }: ItemsGridProps) {
  return (
    <DataGrid
      aria-label="People"
      columns={COLUMNS}
      getRowId={getId}
      selectionMode="multiple"
      {...props}
      items={items}
    >
      {children}
    </DataGrid>
  );
}

describe('useDataGridSelection (P13-02, R16)', () => {
  it('returns exactly selectedItems, isSelected and toggle, nothing else', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    render(
      <ItemsGrid defaultSelectedItems={['b']}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    const value = probes.last('caption');
    expect(Object.keys(value).sort()).toEqual(['isSelected', 'selectedItems', 'toggle']);
    expect(value.selectedItems).toEqual(['b']);
    expect(value.isSelected('b')).toBe(true);
    expect(value.isSelected('a')).toBe(false);
  });

  it('toggle selects and deselects an uncontrolled grid’s row, calling onSelectedItemsChange once each time', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid onSelectedItemsChange={onSelectedItemsChange}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    const event = new MouseEvent('click');
    act(() => probes.last('caption').toggle('b', event));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['b'], { event }]]);
    expect(rowCheckbox('Bob')).toBeChecked();
    expect(probes.last('caption').selectedItems).toEqual(['b']);
    expect(probes.last('caption').isSelected('b')).toBe(true);

    act(() => probes.last('caption').toggle('a'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(onSelectedItemsChange.mock.calls[1][0]).toEqual(['b', 'a']);
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(3);
    expect(onSelectedItemsChange.mock.calls[2][0]).toEqual(['a']);
    expect(rowCheckbox('Bob')).not.toBeChecked();
    expect(rowCheckbox('Alice')).toBeChecked();
    expect(probes.last('caption').selectedItems).toEqual(['a']);
  });

  it('toggle without an event reports an untrusted select event with no target', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid onSelectedItemsChange={onSelectedItemsChange}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    act(() => probes.last('caption').toggle('c'));
    const details = onSelectedItemsChange.mock.calls[0][1] as { event: Event };
    expect(details.event).toBeInstanceOf(Event);
    expect(details.event.type).toBe('select');
    expect(details.event.isTrusted).toBe(false);
    expect(details.event.target).toBeNull();
  });

  it('follows the built-in controls: a row’s checkbox, Space on a cell and select-all', async () => {
    const user = userEvent.setup();
    const probes = recorder<UseDataGridSelectionResult>();
    render(
      <ItemsGrid>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    await user.click(rowCheckbox('Carol'));
    expect(probes.last('caption').selectedItems).toEqual(['c']);
    const aliceCell = cellWithText('Alice');
    act(() => aliceCell.focus());
    await user.keyboard(' ');
    expect(probes.last('caption').selectedItems).toEqual(['c', 'a']);
    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    expect(probes.last('caption').selectedItems).toEqual(['a', 'b', 'c']);
    expect(PEOPLE.every((person) => probes.last('caption').isSelected(person.id))).toBe(true);
  });

  it('in a controlled grid, toggle asks the parent: nothing changes until it accepts', async () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    function Controlled({ accept }: { accept: boolean }) {
      const [selected, setSelected] = React.useState<readonly string[]>(['a']);
      return (
        <ItemsGrid
          selectedItems={selected}
          onSelectedItemsChange={(next, details) => {
            onSelectedItemsChange(next, details);
            if (accept) setSelected(next);
          }}
        >
          <caption>
            <SelectionProbe id="caption" record={probes.record} />
          </caption>
        </ItemsGrid>
      );
    }
    const { rerender } = render(<Controlled accept={false} />);
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['a', 'b'], { event: expect.any(Event) }]]);
    expect(probes.last('caption').selectedItems).toEqual(['a']);
    expect(probes.last('caption').isSelected('b')).toBe(false);
    expect(rowCheckbox('Bob')).not.toBeChecked();

    // A separate interaction: the next toggle starts from the selection the parent kept.
    await act(async () => {});
    rerender(<Controlled accept />);
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(probes.last('caption').selectedItems).toEqual(['a', 'b']);
    expect(rowCheckbox('Bob')).toBeChecked();
  });

  it('selectedItems is the selection the grid holds, also ids that are not items', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const selected = ['x', 'a'];
    render(
      <ItemsGrid selectedItems={selected}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    expect(probes.last('caption').selectedItems).toBe(selected);
    expect(probes.last('caption').isSelected('x')).toBe(true);
  });

  it('in single mode, toggle selects the row alone, or clears it when it is the selected one', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid
        selectionMode="single"
        defaultSelectedItems={['a']}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange.mock.calls[0][0]).toEqual(['b']);
    expect(screen.getByRole('radio', { name: 'Bob' })).toBeChecked();
    expect(probes.last('caption').isSelected('a')).toBe(false);
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange.mock.calls[1][0]).toEqual([]);
    expect(probes.last('caption').selectedItems).toEqual([]);
  });

  it('in single mode with several ids (warned), isSelected is true for the one row the grid shows selected', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const probes = recorder<UseDataGridSelectionResult>();
    render(
      <ItemsGrid selectionMode="single" selectedItems={['b', 'c']}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid: a single-selection grid (selectionMode "single") has 2 selected row ids; only the first one is selected. Pass at most one id in `selectedItems`/`defaultSelectedItems`, or use selectionMode="multiple".',
      ],
    ]);
    const value = probes.last('caption');
    expect(value.selectedItems).toEqual(['b', 'c']);
    expect(value.isSelected('b')).toBe(true);
    expect(value.isSelected('c')).toBe(false);
  });

  it('without items, in single mode with several ids (warned), follows the selected row as rows come and go', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const probes = recorder<UseDataGridSelectionResult>();
    const MemoProbe = React.memo(SelectionProbe);
    const memoProbe = <MemoProbe id="memo" record={probes.record} />;
    const selected = ['zed', 'b'];
    function Grid({ ids }: { ids: readonly string[] }) {
      return (
        <DataGrid aria-label="People" selectionMode="single" selectedItems={selected}>
          <caption>{memoProbe}</caption>
          <DataGrid.Header>
            <tr>
              <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
            </tr>
          </DataGrid.Header>
          <DataGrid.Body>
            {ids.map((id) => (
              <DataGrid.Row key={id} rowId={id}>
                <DataGrid.Cell>{`Person ${id}`}</DataGrid.Cell>
              </DataGrid.Row>
            ))}
          </DataGrid.Body>
        </DataGrid>
      );
    }
    const { rerender } = render(<Grid ids={['a', 'b', 'c']} />);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] DataGrid: a single-selection grid (selectionMode "single") has 2 selected row ids; only the first one that is rendered is selected. Pass at most one id in `selectedItems`/`defaultSelectedItems`, or use selectionMode="multiple".',
      ],
    ]);
    // The first selected id with a rendered row.
    expect(screen.getByRole('radio', { name: 'Person b' })).toBeChecked();
    expect(probes.last('memo').isSelected('b')).toBe(true);
    expect(probes.last('memo').isSelected('zed')).toBe(false);
    const before = probes.last('memo');

    // Row b goes: the selected row of single mode moves to the first selected id, which no row has.
    rerender(<Grid ids={['a', 'c']} />);
    const after = probes.last('memo');
    expect(after).not.toBe(before);
    expect(after.selectedItems).toBe(selected);
    expect(after.isSelected('b')).toBe(false);
    expect(after.isSelected('zed')).toBe(true);
  });

  it('a grid without selection selects nothing: an empty selection, and toggle does nothing', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid
        selectionMode="none"
        defaultSelectedItems={['a']}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    const value = probes.last('caption');
    expect(value.selectedItems).toEqual([]);
    expect(value.isSelected('a')).toBe(false);
    act(() => value.toggle('b'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    expect(probes.last('caption').selectedItems).toEqual([]);
  });

  it('toggle does nothing for an item whose selection isSelectionDisabled disables', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid
        isSelectionDisabled={(person) => person.id === 'b'}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    act(() => probes.last('caption').toggle('a'));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['a'], { event: expect.any(Event) }]]);
  });

  it('toggle does nothing for a row whose selection cell is disabled', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="a" selectionCellProps={{ disabled: true }}>
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
          <DataGrid.Row rowId="b">
            <DataGrid.Cell>Bob</DataGrid.Cell>
            <DataGrid.SelectionCell disabled />
          </DataGrid.Row>
          <DataGrid.Row rowId="c">
            <DataGrid.Cell>Carol</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    act(() => probes.last('caption').toggle('a'));
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    act(() => probes.last('caption').toggle('c'));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['c'], { event: expect.any(Event) }]]);
  });

  it('without items, toggle does nothing for an id that no rendered row has', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <DataGrid
        aria-label="People"
        selectionMode="multiple"
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          {PEOPLE.map((person) => (
            <DataGrid.Row key={person.id} rowId={person.id}>
              <DataGrid.Cell>{person.name}</DataGrid.Cell>
            </DataGrid.Row>
          ))}
        </DataGrid.Body>
      </DataGrid>,
    );
    act(() => probes.last('caption').toggle('zed'));
    expect(onSelectedItemsChange).not.toHaveBeenCalled();
    act(() => probes.last('caption').toggle('b'));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['b'], { event: expect.any(Event) }]]);
    expect(rowCheckbox('Bob')).toBeChecked();
  });

  it('with items, toggle changes an id that is not an item, as the grid keeps such ids', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <ItemsGrid defaultSelectedItems={['gone', 'a']} onSelectedItemsChange={onSelectedItemsChange}>
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </ItemsGrid>,
    );
    act(() => probes.last('caption').toggle('gone'));
    expect(onSelectedItemsChange.mock.calls[0][0]).toEqual(['a']);
  });

  it('the same object across unrelated renders, a new one when the selection changes; toggle keeps its identity', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    function Parent({ tick }: { tick: number }) {
      return (
        <ItemsGrid data-tick={tick}>
          <caption>
            <SelectionProbe id="caption" record={probes.record} />
          </caption>
        </ItemsGrid>
      );
    }
    const { rerender } = render(<Parent tick={0} />);
    const first = probes.last('caption');
    rerender(<Parent tick={1} />);
    expect(probes.count('caption')).toBeGreaterThan(1);
    expect(probes.last('caption')).toBe(first);
    expect(probes.last('caption').isSelected).toBe(first.isSelected);

    act(() => first.toggle('a'));
    const next = probes.last('caption');
    expect(next).not.toBe(first);
    expect(next.toggle).toBe(first.toggle);
    // A new function, so a memoised part given only `isSelected` renders the new selection.
    expect(next.isSelected).not.toBe(first.isSelected);
    expect(next.isSelected('a')).toBe(true);
    rerender(<Parent tick={2} />);
    expect(probes.last('caption')).toBe(next);
  });

  it('a memoised part re-renders only when the selection changes', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const MemoProbe = React.memo(SelectionProbe);
    const memoProbe = <MemoProbe id="memo" record={probes.record} />;
    function Parent({ tick }: { tick: number }) {
      return (
        <ItemsGrid data-tick={tick}>
          {/* The same element on every render: only the selection can re-render the probe. */}
          <caption>{memoProbe}</caption>
        </ItemsGrid>
      );
    }
    const { rerender } = render(<Parent tick={0} />);
    const renders = probes.count('memo');
    rerender(<Parent tick={1} />);
    rerender(<Parent tick={2} />);
    expect(probes.count('memo')).toBe(renders);
    act(() => probes.last('memo').toggle('c'));
    expect(probes.count('memo')).toBe(renders + 1);
    expect(probes.last('memo').selectedItems).toEqual(['c']);
  });

  it('a toggle button of your own in a row that selects on click toggles the row once', async () => {
    function Toggle() {
      const rowId = useDataGridRowId();
      const { toggle } = useDataGridSelection();
      if (rowId === undefined) return null;
      return (
        <button type="button" onClick={(event) => toggle(rowId, event.nativeEvent)}>
          Toggle {rowId}
        </button>
      );
    }
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const columns = [
      ...COLUMNS,
      createTableColumn<Person>({
        columnId: 'toggle',
        label: 'Toggle',
        renderCell: () => <Toggle />,
      }),
    ];
    render(
      <ItemsGrid
        columns={columns}
        selectOnRowClick
        onSelectedItemsChange={onSelectedItemsChange}
      />,
    );
    // The row's click selection ignores a click on a button in the row.
    await user.click(screen.getByRole('button', { name: 'Toggle b' }));
    expect(onSelectedItemsChange.mock.calls).toEqual([[['b'], { event: expect.any(MouseEvent) }]]);
    expect(rowCheckbox('Bob')).toBeChecked();
  });

  it('calls onSelectedItemsChange once per toggle in StrictMode', () => {
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <React.StrictMode>
        <ItemsGrid onSelectedItemsChange={onSelectedItemsChange}>
          <caption>
            <SelectionProbe id="caption" record={probes.record} />
          </caption>
        </ItemsGrid>
      </React.StrictMode>,
    );
    act(() => probes.last('caption').toggle('a'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(1);
    act(() => probes.last('caption').toggle('a'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(onSelectedItemsChange.mock.calls.map((call) => call[0])).toEqual([['a'], []]);
  });

  it('the example of the documentation of useDataGridSelection and useDataGridRowId works as written', async () => {
    /** The `@example` of `useDataGridSelection` and of `useDataGridRowId` (the same), verbatim. */
    function SelectToggle({ name }: { name: string }) {
      const rowId = useDataGridRowId();
      const { isSelected, toggle } = useDataGridSelection();
      if (rowId === undefined) return null;
      return (
        <ToggleButton
          size="small"
          pressed={isSelected(rowId)}
          aria-label={`Select ${name}`}
          onClick={(event) => toggle(rowId, event.nativeEvent)}
        >
          Select
        </ToggleButton>
      );
    }
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    const columns = [
      ...COLUMNS,
      createTableColumn<Person>({
        columnId: 'select',
        label: 'Selected',
        renderCell: (person) => <SelectToggle name={person.name} />,
      }),
    ];
    render(<ItemsGrid columns={columns} onSelectedItemsChange={onSelectedItemsChange} />);
    const toggleBob = screen.getByRole('button', { name: 'Select Bob' });
    expect(toggleBob).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggleBob);
    expect(onSelectedItemsChange.mock.calls).toEqual([[['b'], { event: expect.any(MouseEvent) }]]);
    expect(toggleBob).toHaveAttribute('aria-pressed', 'true');
    expect(rowCheckbox('Bob')).toBeChecked();
    // The row's own checkbox moves the toggle too.
    await user.click(rowCheckbox('Bob'));
    expect(toggleBob).toHaveAttribute('aria-pressed', 'false');
    await expectNoA11yViolations();
  });

  it('throws outside a DataGrid in development (C-CONTEXT)', () => {
    expectThrows(<SelectionProbe id="orphan" record={() => {}} />, SELECTION_ERROR);
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a DataGrid and returns the inert value', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const probes = recorder<UseDataGridSelectionResult>();
      const { rerender } = render(<SelectionProbe id="orphan" record={probes.record} />);
      rerender(<SelectionProbe id="orphan" record={probes.record} />);
      expect(error.mock.calls).toEqual([[SELECTION_ERROR]]);
      const value = probes.last('orphan');
      expect(Object.keys(value).sort()).toEqual(['isSelected', 'selectedItems', 'toggle']);
      expect(value.selectedItems).toEqual([]);
      expect(value.isSelected('a')).toBe(false);
      expect(() => value.toggle('a')).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// useDataGridSelection in a windowed grid
// ---------------------------------------------------------------------------

describe('useDataGridSelection in a grid with a virtualWindow', () => {
  const ITEM = 44;
  const VIEWPORT = 480;
  const COUNT = 1000;
  const MANY: readonly Person[] = Array.from({ length: COUNT }, (_, index) => ({
    id: `id-${index}`,
    name: `Person ${String(index).padStart(4, '0')}`,
    role: 'Engineer',
  }));
  const isScroller = (el: Element) => el.classList.contains(dataGridClassNames.container);

  beforeEach(() => {
    // The window reads the scroller's height in frames that never run on their own here.
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
      return isScroller(this) ? VIEWPORT : 0;
    });
    vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
      return isScroller(this) ? ITEM + COUNT * ITEM : 0;
    });
  });

  function WindowedGrid(props: ItemsGridProps) {
    const virtualWindow = useVirtualWindow({ itemSize: ITEM, scrollPaddingStart: ITEM });
    return <ItemsGrid items={MANY} {...props} virtualWindow={virtualWindow} />;
  }

  const mountedRows = () =>
    screen.getByRole('grid', { name: 'People' }).querySelectorAll('tbody > tr[data-row-index]');

  it('reports the selection of rows outside the window, and toggles them by id', async () => {
    const user = userEvent.setup();
    const probes = recorder<UseDataGridSelectionResult>();
    const onSelectedItemsChange = vi.fn();
    render(
      <WindowedGrid
        isSelectionDisabled={(_, index) => index === 500}
        onSelectedItemsChange={onSelectedItemsChange}
      >
        <caption>
          <SelectionProbe id="caption" record={probes.record} />
        </caption>
      </WindowedGrid>,
    );
    expect(mountedRows().length).toBeGreaterThan(0);
    expect(mountedRows().length).toBeLessThanOrEqual(30);
    expect(screen.queryByRole('row', { name: /Person 0999/ })).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    const all = probes.last('caption');
    expect(all.selectedItems).toHaveLength(COUNT - 1);
    expect(all.isSelected('id-999')).toBe(true);
    expect(all.isSelected('id-500')).toBe(false);

    act(() => all.toggle('id-999'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    const reported = onSelectedItemsChange.mock.calls[1][0] as string[];
    expect(reported).toHaveLength(COUNT - 2);
    expect(reported).not.toContain('id-999');
    expect(probes.last('caption').isSelected('id-999')).toBe(false);

    // The item whose selection is disabled, not rendered either.
    act(() => probes.last('caption').toggle('id-500'));
    expect(onSelectedItemsChange).toHaveBeenCalledTimes(2);
    expect(mountedRows().length).toBeLessThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// useDataGridRowId
// ---------------------------------------------------------------------------

describe('useDataGridRowId (P13-02, R16)', () => {
  it('returns the row id of a row rendered from items (getRowId)', () => {
    const probes = recorder<string | undefined>();
    const columns: readonly DataGridColumn<Person>[] = [
      {
        ...COLUMNS[0],
        renderCell: (person) => (
          <>
            {person.name}
            <RowIdProbe id={person.name} record={probes.record} />
          </>
        ),
      },
    ];
    render(<ItemsGrid columns={columns} selectionMode="none" />);
    expect(probes.last('Alice')).toBe('a');
    expect(probes.last('Bob')).toBe('b');
    expect(probes.last('Carol')).toBe('c');
  });

  it('returns the rowId of a DataGrid.Row, also in a grid without selection', () => {
    const probes = recorder<string | undefined>();
    render(
      <DataGrid aria-label="People">
        <DataGrid.Header>
          <tr>
            <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          </tr>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="first">
            <DataGrid.Cell>
              Alice
              <RowIdProbe id="first" record={probes.record} />
            </DataGrid.Cell>
          </DataGrid.Row>
          <DataGrid.Row>
            <DataGrid.Cell>
              Bob
              <RowIdProbe id="none" record={probes.record} />
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(probes.last('first')).toBe('first');
    // A row without an id has none to give.
    expect(probes.has('none')).toBe(true);
    expect(probes.last('none')).toBeUndefined();
  });

  it('a row’s own rowId wins over its item’s id', () => {
    const probes = recorder<string | undefined>();
    render(
      <DataGrid aria-label="People" items={PEOPLE} columns={COLUMNS} getRowId={getId}>
        <DataGrid.Body<Person>>
          {(person) => (
            <DataGrid.Row rowId={`own-${person.id}`}>
              <DataGrid.Cell>
                {person.name}
                <RowIdProbe id={person.name} record={probes.record} />
              </DataGrid.Cell>
              <DataGrid.Cell>{person.role}</DataGrid.Cell>
            </DataGrid.Row>
          )}
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(probes.last('Alice')).toBe('own-a');
  });

  it('is undefined in a header DataGrid.Row', () => {
    const probes = recorder<string | undefined>();
    render(
      <DataGrid aria-label="People" selectionMode="multiple">
        <DataGrid.Header>
          <DataGrid.Row rowId="header">
            <DataGrid.HeaderCell>
              Name
              <RowIdProbe id="header" record={probes.record} />
            </DataGrid.HeaderCell>
          </DataGrid.Row>
        </DataGrid.Header>
        <DataGrid.Body>
          <DataGrid.Row rowId="a">
            <DataGrid.Cell>Alice</DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(probes.has('header')).toBe(true);
    expect(probes.last('header')).toBeUndefined();
  });

  it('a cell of a grid nested in a cell reads its own row', () => {
    const probes = recorder<string | undefined>();
    render(
      <DataGrid aria-label="Outer">
        <DataGrid.Body>
          <DataGrid.Row rowId="outer">
            <DataGrid.Cell>
              <RowIdProbe id="outer" record={probes.record} />
              <DataGrid aria-label="Inner">
                <DataGrid.Body>
                  <DataGrid.Row rowId="inner">
                    <DataGrid.Cell>
                      Nested
                      <RowIdProbe id="inner" record={probes.record} />
                    </DataGrid.Cell>
                  </DataGrid.Row>
                </DataGrid.Body>
              </DataGrid>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
    );
    expect(probes.last('outer')).toBe('outer');
    expect(probes.last('inner')).toBe('inner');
  });

  it('throws outside a DataGrid.Row in development: outside a grid, in a caption, in a generated header', () => {
    expectThrows(<RowIdProbe id="orphan" record={() => {}} />, ROW_ID_ERROR);
    expectThrows(
      <ItemsGrid>
        <caption>
          <RowIdProbe id="caption" record={() => {}} />
        </caption>
      </ItemsGrid>,
      ROW_ID_ERROR,
    );
    const columns: readonly DataGridColumn<Person>[] = [
      { ...COLUMNS[0], renderHeaderCell: () => <RowIdProbe id="header" record={() => {}} /> },
    ];
    expectThrows(<ItemsGrid columns={columns} />, ROW_ID_ERROR);
  });

  it('a nested grid outside its rows does not take the outer row’s id', () => {
    expectThrows(
      <DataGrid aria-label="Outer">
        <DataGrid.Body>
          <DataGrid.Row rowId="outer">
            <DataGrid.Cell>
              <DataGrid aria-label="Inner">
                <caption>
                  <RowIdProbe id="inner-caption" record={() => {}} />
                </caption>
              </DataGrid>
            </DataGrid.Cell>
          </DataGrid.Row>
        </DataGrid.Body>
      </DataGrid>,
      ROW_ID_ERROR,
    );
  });

  describe('in production (C-CONTEXT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('logs once outside a DataGrid.Row and returns undefined', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const probes = recorder<string | undefined>();
      const { rerender } = render(<RowIdProbe id="orphan" record={probes.record} />);
      rerender(<RowIdProbe id="orphan" record={probes.record} />);
      expect(error.mock.calls).toEqual([[ROW_ID_ERROR]]);
      expect(probes.has('orphan')).toBe(true);
      expect(probes.last('orphan')).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// The story and the server
// ---------------------------------------------------------------------------

describe('a custom cell on the DataGrid hooks (story)', () => {
  const { CustomCell } = composeStories(stories);

  it('the toggle, the row’s checkbox and the summary follow one selection; the summary reverses the sort', async () => {
    const user = userEvent.setup();
    render(<CustomCell />);
    const grid = screen.getByRole('grid', { name: 'Team members with custom cells' });
    const summary = () => within(grid).getByText(/selected$/);
    expect(summary()).toHaveTextContent('1 selected');
    const toggleAlice = within(grid).getByRole('button', { name: 'Select Alice Johnson' });
    expect(toggleAlice).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggleAlice);
    expect(toggleAlice).toHaveAttribute('aria-pressed', 'true');
    expect(within(grid).getByRole('checkbox', { name: 'Alice Johnson' })).toBeChecked();
    expect(summary()).toHaveTextContent('2 selected');
    await user.click(within(grid).getByRole('checkbox', { name: 'Select all rows' }));
    expect(summary()).toHaveTextContent('4 selected');

    const nameHeader = within(grid).getByRole('columnheader', { name: /Name/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(within(grid).getByText('Sorted by name, ascending')).toBeInTheDocument();
    await user.click(within(grid).getByRole('button', { name: 'Reverse order' }));
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(within(grid).getByText('Sorted by name, descending')).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  it('keeps the grid’s keyboard: arrows reach the toggle, Space on it toggles the row', async () => {
    const user = userEvent.setup();
    render(<CustomCell />);
    const grid = screen.getByRole('grid', { name: 'Team members with custom cells' });
    const bob = cellWithText('Bob Smith');
    act(() => bob.focus());
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    const toggleBob = within(grid).getByRole('button', { name: 'Select Bob Smith' });
    expect(toggleBob).toHaveFocus();
    expect(toggleBob).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    expect(toggleBob).toHaveAttribute('aria-pressed', 'false');
    expect(within(grid).getByRole('checkbox', { name: 'Bob Smith' })).not.toBeChecked();
  });

  it('renders the selection and the sort into the server HTML, the same through a client reference, and hydrates silently', async () => {
    const html = renderToString(<CustomCell />);
    // React separates adjacent text in the server HTML with an empty comment.
    expect(html.replaceAll('<!-- -->', '')).toContain('1 selected');
    expect(html).toContain('Sorted by name, ascending');
    expect(html).toMatch(
      /aria-pressed="true"[^>]*aria-label="Select Bob Smith"|aria-label="Select Bob Smith"[^>]*aria-pressed="true"/,
    );

    const container = document.createElement('div');
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: Root | undefined;
    try {
      container.innerHTML = html;
      document.body.appendChild(container);
      await act(async () => {
        root = hydrateRoot(container, <CustomCell />);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

/** A cell of your own on the hooks, for the client-reference check. */
function CustomCellReference({ name }: { name: string }) {
  const rowId = useDataGridRowId();
  const { isSelected, toggle } = useDataGridSelection();
  const { sort } = useDataGridSort();
  if (rowId === undefined) return null;
  return (
    <ToggleButton
      size="small"
      pressed={isSelected(rowId)}
      aria-label={`Select ${name}`}
      data-sort={sort?.direction ?? 'none'}
      onClick={(event) => toggle(rowId, event.nativeEvent)}
    >
      Select
    </ToggleButton>
  );
}

describe('a cell of your own imported by a Server Component (a client reference)', () => {
  function Grid({
    Cell,
    onSelectedItemsChange,
  }: {
    Cell: typeof CustomCellReference;
    onSelectedItemsChange?: DataGridBaseProps['onSelectedItemsChange'];
  }) {
    const columns = [
      ...COLUMNS,
      createTableColumn<Person>({
        columnId: 'select',
        label: 'Selected',
        renderCell: (person) => <Cell name={person.name} />,
      }),
    ];
    return (
      <ItemsGrid
        columns={columns}
        defaultSelectedItems={['b']}
        defaultSort={{ columnId: 'name', direction: 'descending' }}
        onSelectedItemsChange={onSelectedItemsChange}
      />
    );
  }

  it('renders the same and works the same', async () => {
    const Reference = asClientReference(CustomCellReference);
    expect(renderToString(<Grid Cell={Reference} />)).toBe(
      renderToString(<Grid Cell={CustomCellReference} />),
    );
    const user = userEvent.setup();
    const onSelectedItemsChange = vi.fn();
    render(<Grid Cell={Reference} onSelectedItemsChange={onSelectedItemsChange} />);
    const toggleAlice = await screen.findByRole('button', { name: 'Select Alice' });
    expect(toggleAlice).toHaveAttribute('data-sort', 'descending');
    await user.click(toggleAlice);
    expect(onSelectedItemsChange.mock.calls[0][0]).toEqual(['b', 'a']);
    expect(toggleAlice).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------------------------------------------------------------------------
// The selection store behind the hook
// ---------------------------------------------------------------------------

describe('the selection store: the snapshot and disabled ids the hook reads', () => {
  it('a new snapshot exactly when the rows are notified, holding the selection as given', () => {
    const initial = ['a'];
    const store = createSelectionStore(initial);
    const listener = vi.fn();
    store.subscribe(listener);
    const first = store.getSnapshot();
    expect(first.selectedItems).toBe(initial);
    expect(store.getSnapshot()).toBe(first);

    // The same ids in a new array: no change, no notification, the same snapshot.
    store.setSelected(['a']);
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toBe(first);

    const next = ['a', 'b'];
    store.setSelected(next);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(first);
    expect(store.getSnapshot().selectedItems).toBe(next);

    // A row registering notifies no row (multiple mode): the snapshot stays.
    const second = store.getSnapshot();
    store.register('a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe(second);
  });

  it('isDisabled covers the rows that disable themselves and the universe’s disabled ids', () => {
    const store = createSelectionStore([], false, {
      ids: ['a', 'b', 'c'],
      disabled: new Set(['b']),
    });
    expect(store.isDisabled('a')).toBe(false);
    expect(store.isDisabled('b')).toBe(true);
    const undo = store.disable('c');
    expect(store.isDisabled('c')).toBe(true);
    undo();
    expect(store.isDisabled('c')).toBe(false);
    store.setUniverse(null);
    expect(store.isDisabled('b')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exports and types
// ---------------------------------------------------------------------------

describe('DataGrid hooks — exports and types', () => {
  it('DataGrid re-exports the hooks of their own module (flat names)', () => {
    expect(useDataGridSort).toBe(HooksModule.useDataGridSort);
    expect(useDataGridSelection).toBe(HooksModule.useDataGridSelection);
    expect(useDataGridRowId).toBe(HooksModule.useDataGridRowId);
  });

  it('return the narrow values', () => {
    expectTypeOf(useDataGridSort).toEqualTypeOf<() => UseDataGridSortResult>();
    expectTypeOf<UseDataGridSortResult>().toEqualTypeOf<{
      sort: DataGridSort | null;
      setSort: (sort: DataGridSort, event?: Event) => void;
    }>();
    expectTypeOf(useDataGridSelection).toEqualTypeOf<() => UseDataGridSelectionResult>();
    expectTypeOf<UseDataGridSelectionResult>().toEqualTypeOf<{
      selectedItems: readonly string[];
      isSelected: (id: string) => boolean;
      toggle: (id: string, event?: Event) => void;
    }>();
    expectTypeOf(useDataGridRowId).toEqualTypeOf<() => string | undefined>();
  });

  it('a fireEvent toggle from a custom control passes its event through', () => {
    const onSelectedItemsChange = vi.fn();
    function Toggle() {
      const rowId = useDataGridRowId();
      const { toggle } = useDataGridSelection();
      return (
        <button type="button" onClick={(event) => rowId && toggle(rowId, event.nativeEvent)}>
          Toggle {rowId}
        </button>
      );
    }
    const columns = [
      ...COLUMNS,
      createTableColumn<Person>({
        columnId: 'toggle',
        label: 'Toggle',
        renderCell: () => <Toggle />,
      }),
    ];
    render(<ItemsGrid columns={columns} onSelectedItemsChange={onSelectedItemsChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle c' }));
    const [[items, details]] = onSelectedItemsChange.mock.calls as [[string[], { event: Event }]];
    expect(items).toEqual(['c']);
    expect(details.event.type).toBe('click');
    expect(details.event.target).toBe(screen.getByRole('button', { name: 'Toggle c' }));
  });
});
