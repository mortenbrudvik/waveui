import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { DataGrid } from '../src';
import type { DataGridBaseProps, DataGridColumn, DataGridSort } from '../src';

interface Member {
  id: string;
  name: string;
  role: string;
  location: string;
  status: string;
}

const MEMBERS: Member[] = [
  { id: '1', name: 'Alice Johnson', role: 'Engineer', location: 'Seattle', status: 'Active' },
  { id: '2', name: 'Bob Smith', role: 'Designer', location: 'New York', status: 'Active' },
  { id: '3', name: 'Carol White', role: 'Manager', location: 'London', status: 'On leave' },
  { id: '4', name: 'David Brown', role: 'Analyst', location: 'Oslo', status: 'Active' },
];

type SortableKey = 'name' | 'role' | 'location';

/** Sorting is controlled: the grid reports the sort, the story reorders its rows. */
function sortMembers(members: Member[], sort: DataGridSort | null): Member[] {
  if (!sort) return members;
  const key = sort.columnId as SortableKey;
  const sorted = [...members].sort((a, b) => a[key].localeCompare(b[key]));
  return sort.direction === 'ascending' ? sorted : sorted.reverse();
}

/** The story args: the DataGrid props with the 0.5 `onSortChange(sort)` form. */
type DataGridStoryArgs = Omit<DataGridBaseProps, 'children'> & {
  /** Called with the new sort; the story reorders its rows. */
  onSortChange?: (sort: DataGridSort) => void;
};

/** Holds the sort in state so the rows really reorder, and forwards the story args. */
function useSortedMembers(onSortChange: DataGridStoryArgs['onSortChange']) {
  const [sort, setSort] = React.useState<DataGridSort | null>({
    columnId: 'name',
    direction: 'ascending',
  });
  const handleSortChange = (next: DataGridSort) => {
    setSort(next);
    onSortChange?.(next);
  };
  return { sort, rows: sortMembers(MEMBERS, sort), handleSortChange };
}

function memberRows(rows: Member[]) {
  return rows.map((member) => (
    <DataGrid.Row key={member.id} rowId={member.id}>
      <DataGrid.Cell>{member.name}</DataGrid.Cell>
      <DataGrid.Cell>{member.role}</DataGrid.Cell>
      <DataGrid.Cell>{member.location}</DataGrid.Cell>
      <DataGrid.Cell>{member.status}</DataGrid.Cell>
    </DataGrid.Row>
  ));
}

function HeaderChildrenGrid({ onSortChange, ...args }: DataGridStoryArgs) {
  const { sort, rows, handleSortChange } = useSortedMembers(onSortChange);
  return (
    <DataGrid sort={sort} onSortChange={handleSortChange} {...args}>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="role" sortable>
            Role
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="location" sortable>
            Location
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="status">Status</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>{memberRows(rows)}</DataGrid.Body>
    </DataGrid>
  );
}

const COLUMNS: DataGridColumn[] = [
  { id: 'name', label: 'Name', sortable: true },
  { id: 'role', label: 'Role', sortable: true },
  { id: 'location', label: 'Location', sortable: true },
  { id: 'status', label: 'Status' },
];

function ColumnsGrid({ onSortChange, ...args }: DataGridStoryArgs) {
  const { sort, rows, handleSortChange } = useSortedMembers(onSortChange);
  return (
    <DataGrid columns={COLUMNS} sort={sort} onSortChange={handleSortChange} {...args}>
      <DataGrid.Body>{memberRows(rows)}</DataGrid.Body>
    </DataGrid>
  );
}

/**
 * `DataGrid` typed with the story args. The runtime component is the same (Storybook reads its
 * docs from it); only the args type is narrowed to the 0.5 sort API, whose callback the stories
 * compose with their own row sorting.
 */
const DataGridWithStoryArgs = DataGrid as unknown as React.ComponentType<DataGridStoryArgs>;

// Sorting is controlled, so the stories reorder their rows in `onSortChange`.
const meta = {
  title: 'Components/Table/DataGrid',
  component: DataGridWithStoryArgs,
  args: {
    'aria-label': 'Team members',
    selectionMode: 'none',
    onSortChange: fn(),
    onSelectedItemsChange: fn(),
  },
  argTypes: {
    selectionMode: { control: 'inline-radio', options: ['none', 'single', 'multiple'] },
  },
  render: (args) => <HeaderChildrenGrid {...args} />,
} satisfies Meta<DataGridStoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Header built from `DataGrid.Header` children; Name, Role and Location sort. */
export const Default: Story = {};

/** Header generated from the `columns` prop (no `DataGrid.Header` child). */
export const FromColumns: Story = {
  render: (args) => <ColumnsGrid {...args} />,
};

/** Checkbox column with a "Select all rows" header checkbox; Space on a cell toggles its row. */
export const MultipleSelection: Story = {
  args: {
    selectionMode: 'multiple',
    defaultSelectedItems: ['2'],
  },
};

/** Radio column; the header cell carries visually hidden "Selection" text. */
export const SingleSelection: Story = {
  args: {
    selectionMode: 'single',
    defaultSelectedItems: ['1'],
  },
  render: (args) => <ColumnsGrid {...args} />,
};

/**
 * Cells with widgets. A cell with one button makes the button the cell's focus target; a text
 * field is never a target: press Enter (or F2) on its cell to edit, Escape to return to the grid.
 */
export const InteractiveCells: Story = {
  args: {
    'aria-label': 'Team notes',
  },
  render: ({ onSortChange: _onSortChange, ...args }) => (
    <DataGrid {...args}>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Notes</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Actions</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        {MEMBERS.slice(0, 3).map((member) => (
          <DataGrid.Row key={member.id} rowId={member.id}>
            <DataGrid.Cell>{member.name}</DataGrid.Cell>
            <DataGrid.Cell>
              <input
                aria-label={`Notes for ${member.name}`}
                defaultValue=""
                className="h-8 w-full rounded border border-input bg-background px-2 text-body-1 text-foreground focus:border-b-2 focus:border-b-primary focus:outline-hidden"
              />
            </DataGrid.Cell>
            <DataGrid.Cell>
              <button
                type="button"
                className="rounded border border-stroke bg-background px-3 py-1 text-body-1 text-foreground hover:bg-subtle-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Edit {member.name}
              </button>
            </DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  ),
};

/** A narrow container: the wrapper scrolls horizontally (`containerProps` styles the wrapper). */
export const HorizontalScroll: Story = {
  args: {
    containerProps: { className: 'max-w-md' },
    className: 'min-w-[48rem]',
  },
};
