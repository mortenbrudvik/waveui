import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Table,
  createTableColumn,
  useTableColumnSizing,
  useTableFeatures,
  useTableSelection,
  useTableSort,
} from '../src';
import type {
  ColumnSizingOption,
  DataGridSort,
  DataGridSortChangeDetails,
  SelectionMode,
  TableColumnWidthsChangeDetails,
} from '../src';

interface Member {
  id: string;
  name: string;
  role: string;
  location: string;
}

const ROLES = ['Engineer', 'Designer', 'Manager', 'Analyst', 'Researcher'];
const LOCATIONS = ['Seattle', 'New York', 'London', 'Oslo', 'Tokyo', 'Berlin'];
const GIVEN_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Farid', 'Grace', 'Hugo'];
const FAMILY_NAMES = ['Johnson', 'Smith', 'White', 'Brown', 'Lee', 'Khan', 'Moreau', 'Berg'];

/** Builds the members of the table: the same list on every render of the story. */
function createMembers(count: number): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${index + 1}`,
    name: `${GIVEN_NAMES[index % GIVEN_NAMES.length]} ${FAMILY_NAMES[(index * 3) % FAMILY_NAMES.length]} ${index + 1}`,
    role: ROLES[index % ROLES.length]!,
    location: LOCATIONS[(index * 5) % LOCATIONS.length]!,
  }));
}

const MEMBERS = createMembers(200);

// The columns and the row id are defined outside the component, so the state keeps its rows.
const COLUMNS = [
  createTableColumn<Member>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
  }),
  createTableColumn<Member>({
    columnId: 'role',
    label: 'Role',
    compare: (a, b) => a.role.localeCompare(b.role),
  }),
  createTableColumn<Member>({
    columnId: 'location',
    label: 'Location',
    compare: (a, b) => a.location.localeCompare(b.location),
  }),
];

const getRowId = (member: Member) => member.id;

const CELL_TEXT: Record<string, (member: Member) => string> = {
  name: (member) => member.name,
  role: (member) => member.role,
  location: (member) => member.location,
};

const COLUMN_SIZING: Record<string, ColumnSizingOption> = {
  name: { defaultWidth: 240, minWidth: 120 },
  role: { defaultWidth: 160 },
  location: { idealWidth: 160 },
};

interface FeaturesTableArgs {
  /** `multiple` shows a select-all checkbox in the header; `single` selects one row. */
  selectionMode: SelectionMode;
  /** How many members the table lists. */
  rowCount: number;
  /** Puts a `Table.ResizeHandle` in each column header, for the pointer and the arrow keys. */
  resizable: boolean;
  /** Called with the ids of every selected member. */
  onSelectedItemsChange: (selectedItems: string[]) => void;
  /** Called with the new sort. */
  onSortChange: (sort: DataGridSort, details?: DataGridSortChangeDetails) => void;
  /** Called with the widths of the columns when one changes. */
  onColumnWidthsChange: (
    widths: Record<string, number>,
    details?: TableColumnWidthsChangeDetails,
  ) => void;
}

/**
 * A static `Table` driven by the headless hooks: `useTableFeatures` holds the rows, and the sort,
 * selection and column sizing plugins fill its state. The table renders every row here; the state
 * would stay the same for a table that renders only a page or a window of them.
 */
function FeaturesTable({
  selectionMode,
  rowCount,
  resizable,
  onSelectedItemsChange,
  onSortChange,
  onColumnWidthsChange,
}: FeaturesTableArgs) {
  const items = React.useMemo(() => MEMBERS.slice(0, rowCount), [rowCount]);
  const { getRows, sort, selection, columnSizing } = useTableFeatures(
    { items, columns: COLUMNS, getRowId },
    [
      useTableSort({ defaultSort: { columnId: 'name', direction: 'ascending' }, onSortChange }),
      useTableSelection({ selectionMode, onSelectedItemsChange }),
      useTableColumnSizing({ columnSizingOptions: COLUMN_SIZING, onColumnWidthsChange }),
    ],
  );

  const selectAll = selection.allRowsSelected ? true : selection.someRowsSelected ? 'mixed' : false;

  return (
    <Table aria-label="Team members" {...columnSizing.getTableProps()}>
      <colgroup>
        <col className="w-10" />
        {COLUMNS.map((column) => (
          <col key={column.columnId} {...columnSizing.getColumnProps(column.columnId!)} />
        ))}
      </colgroup>
      <Table.Header>
        <Table.Row>
          {selectionMode === 'multiple' ? (
            <Table.SelectionCell
              aria-label="Select all members"
              checked={selectAll}
              onCheckedChange={(_checked, details) => selection.toggleAllRows(details?.event)}
            />
          ) : (
            <Table.HeaderCell>
              <span className="sr-only">Select</span>
            </Table.HeaderCell>
          )}
          {COLUMNS.map((column) => (
            <Table.HeaderCell
              key={column.columnId}
              sortable
              sortDirection={sort.getSortDirection(column.columnId!)}
              onSortClick={(event) => sort.toggleColumnSort(column.columnId!, event.nativeEvent)}
              // The handle is drawn along the cell's end edge, so the cell is its positioning box.
              className={resizable ? 'relative' : undefined}
              aside={
                resizable ? (
                  <Table.ResizeHandle
                    {...columnSizing.getResizeHandleProps(column.columnId!)}
                    label={`Resize the ${column.label} column`}
                  />
                ) : undefined
              }
            >
              {column.label}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {getRows().map(({ item, rowId }) => (
          <Table.Row key={rowId} data-selected={selection.isRowSelected(rowId) ? '' : undefined}>
            <Table.SelectionCell
              type={selectionMode === 'single' ? 'radio' : 'checkbox'}
              name={selectionMode === 'single' ? 'team-member' : undefined}
              aria-label={`Select ${item.name}`}
              checked={selection.isRowSelected(rowId)}
              onCheckedChange={(_checked, details) => selection.toggleRow(rowId, details?.event)}
            />
            {COLUMNS.map((column) => (
              <Table.Cell key={column.columnId}>{CELL_TEXT[column.columnId!]!(item)}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

const meta = {
  title: 'Components/Table/Features',
  component: FeaturesTable,
  args: {
    selectionMode: 'multiple',
    rowCount: 200,
    resizable: false,
    onSelectedItemsChange: fn(),
    onSortChange: fn(),
    onColumnWidthsChange: fn(),
  },
  argTypes: {
    selectionMode: { control: 'inline-radio', options: ['single', 'multiple'] },
    rowCount: { control: { type: 'number', min: 1, max: 200 } },
  },
} satisfies Meta<typeof FeaturesTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 200 members in a static `Table`. Sorting, the selection (select-all included) and the column
 * widths come from `useTableFeatures` with its three plugins; select-all counts every member, and
 * the `<colgroup>` carries the widths. The header is plain here; the `ResizeHandle` story adds the
 * handles.
 */
export const Default: Story = {};

/** `selectionMode="single"` selects one member at a time and shows no select-all. */
export const SingleSelection: Story = {
  args: { selectionMode: 'single' },
};

/** A short list. */
export const FewRows: Story = {
  args: { rowCount: 5 },
};

/**
 * Every column header holds a `Table.ResizeHandle` in its `aside` slot, fed by
 * `columnSizing.getResizeHandleProps(columnId)`. Drag a column's end edge with a mouse, a finger or
 * a pen, or Tab to a handle and press the arrow keys (20 pixels, 5 with Shift) or Home (the
 * column's minimum width). Double-click a handle to reset its column to its initial width. The
 * `<colgroup>` follows the widths, which are held at the column's minimum.
 */
export const ResizeHandle: Story = {
  args: { resizable: true, rowCount: 20 },
};
