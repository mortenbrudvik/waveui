import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Button,
  DataGrid,
  Menu,
  MenuButton,
  ToggleButton,
  createTableColumn,
  useDataGridRowId,
  useDataGridSelection,
  useDataGridSort,
  useVirtualWindow,
} from '../src';
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
  { columnId: 'name', label: 'Name', sortable: true },
  { columnId: 'role', label: 'Role', sortable: true },
  { columnId: 'location', label: 'Location', sortable: true },
  { columnId: 'status', label: 'Status' },
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
                className="h-8 w-full rounded border border-wave-input bg-wave-background px-2 text-wave-body-1 text-wave-foreground focus:border-b-2 focus:border-b-wave-primary focus:outline-hidden"
              />
            </DataGrid.Cell>
            <DataGrid.Cell>
              <button
                type="button"
                className="rounded border border-wave-stroke bg-wave-background px-3 py-1 text-wave-body-1 text-wave-foreground hover:bg-wave-subtle-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wave-ring"
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

/** Columns typed by the grid's items; `compare` makes a column sortable and the grid sorts by it. */
const MEMBER_COLUMNS: readonly DataGridColumn<Member>[] = [
  createTableColumn<Member>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => a.name.localeCompare(b.name),
    renderCell: (member) => member.name,
  }),
  createTableColumn<Member>({
    columnId: 'role',
    label: 'Role',
    compare: (a, b) => a.role.localeCompare(b.role),
    renderCell: (member) => member.role,
  }),
  createTableColumn<Member>({
    columnId: 'location',
    label: 'Location',
    compare: (a, b) => a.location.localeCompare(b.location),
    renderCell: (member) => member.location,
  }),
  createTableColumn<Member>({
    columnId: 'status',
    label: 'Status',
    renderCell: (member) => member.status,
  }),
];

/** The same columns plus one whose cells hold a Menu. */
const MEMBER_COLUMNS_WITH_ACTIONS: readonly DataGridColumn<Member>[] = [
  ...MEMBER_COLUMNS,
  createTableColumn<Member>({
    columnId: 'actions',
    label: 'Actions',
    renderCell: (member) => (
      <Menu>
        <Menu.Trigger>
          <MenuButton appearance="subtle">{`${member.name} actions`}</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>Message</Menu.Item>
          <Menu.Item>Change role</Menu.Item>
        </Menu.Popover>
      </Menu>
    ),
  }),
];

const memberId = (member: Member) => member.id;

type MemberGridProps = Omit<DataGridStoryArgs, 'columns' | 'getRowId'> & {
  columns?: readonly DataGridColumn<Member>[];
  defaultSort?: DataGridSort | null;
};

/** A grid rendered from `MEMBERS` and typed columns: the grid itself orders the rows. */
function MemberGrid({ columns = MEMBER_COLUMNS, ...args }: MemberGridProps) {
  return <DataGrid items={MEMBERS} columns={columns} getRowId={memberId} {...args} />;
}

/**
 * `items` with typed columns (`createTableColumn`): the grid renders the header and the rows, and
 * orders them by the sorted column's `compare`. Status has no `compare`, so it is no sort button.
 */
export const TypedColumnsAndSorting: Story = {
  render: (args) => (
    <MemberGrid {...args} defaultSort={{ columnId: 'name', direction: 'ascending' }} />
  ),
};

/**
 * `selectOnRowClick` selects a row with a click anywhere on it. A click on a control in the row
 * (a link, a button) or one that ends a text selection selects nothing, and Space on a cell
 * toggles the row either way.
 */
export const SelectOnRowClick: Story = {
  args: {
    selectionMode: 'multiple',
    selectOnRowClick: true,
    defaultSelectedItems: ['2'],
  },
  render: (args) => <MemberGrid {...args} />,
};

/** A Menu in a cell: opening it and choosing an item leaves the row's selection alone. */
export const MenuInCell: Story = {
  args: {
    'aria-label': 'Team members with actions',
    selectionMode: 'multiple',
    selectOnRowClick: true,
  },
  render: (args) => <MemberGrid {...args} columns={MEMBER_COLUMNS_WITH_ACTIONS} />,
};

/**
 * `selectionAppearance` fills a selected row with the selected token (`brand`, the default), the
 * subtle one (`neutral`) or not at all (`none`): the control and `aria-selected` still show it.
 */
export const SelectionAppearances: Story = {
  args: {
    selectionMode: 'multiple',
    defaultSelectedItems: ['1', '3'],
  },
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['brand', 'neutral', 'none'] as const).map((appearance) => (
        <MemberGrid
          key={appearance}
          {...args}
          aria-label={`Team members, ${appearance} selection`}
          selectionAppearance={appearance}
        />
      ))}
    </div>
  ),
};

/**
 * `subtleSelection` hides the unchecked controls until their row is hovered or holds focus (the
 * select-all checkbox until the grid is); a touch screen and forced colors always draw them.
 */
export const SubtleSelection: Story = {
  args: {
    selectionMode: 'multiple',
    subtleSelection: true,
    selectOnRowClick: true,
    defaultSelectedItems: ['4'],
  },
  render: (args) => <MemberGrid {...args} />,
};

/**
 * `DataGrid.SelectionCell` places the selection column where you write it, here at the end of
 * every row, and takes the cell's own props: the member on leave cannot be selected.
 */
export const SelectionCellAtTheEnd: Story = {
  args: {
    'aria-label': 'Team members, selection at the end',
    selectionMode: 'multiple',
    defaultSelectedItems: ['1'],
  },
  render: ({ onSortChange: _onSortChange, ...args }) => (
    <DataGrid {...args}>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell>Name</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
          <DataGrid.SelectionCell />
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        {MEMBERS.map((member) => (
          <DataGrid.Row key={member.id} rowId={member.id}>
            <DataGrid.Cell>{member.name}</DataGrid.Cell>
            <DataGrid.Cell>{member.role}</DataGrid.Cell>
            <DataGrid.SelectionCell disabled={member.status === 'On leave'} />
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  ),
};

/**
 * A cell of your own that toggles its row's selection: `useDataGridRowId` gives the row's id and
 * `useDataGridSelection` the grid's selection, so the toggle, the row's checkbox, Space on a cell
 * and select-all always agree.
 */
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

/**
 * A footer row of your own: how many members are selected (`useDataGridSelection`), the sort in
 * words and a button that reverses it (`useDataGridSort`).
 */
function SummaryRow({ columnCount }: { columnCount: number }) {
  const { sort, setSort } = useDataGridSort();
  const { selectedItems } = useDataGridSelection();
  return (
    <tr>
      <td colSpan={columnCount} className="border-t border-wave-border px-3 py-2">
        <span className="flex flex-wrap items-center gap-3 text-wave-body-1 text-wave-foreground">
          <span>{selectedItems.length} selected</span>
          <span>{sort ? `Sorted by ${sort.columnId}, ${sort.direction}` : 'Not sorted'}</span>
          {sort && (
            <Button
              size="small"
              onClick={(event) =>
                setSort(
                  {
                    columnId: sort.columnId,
                    direction: sort.direction === 'ascending' ? 'descending' : 'ascending',
                  },
                  event.nativeEvent,
                )
              }
            >
              Reverse order
            </Button>
          )}
        </span>
      </td>
    </tr>
  );
}

/** The member columns with a Selected column of toggles, cells of your own. */
const CUSTOM_CELL_COLUMNS: readonly DataGridColumn<Member>[] = [
  ...MEMBER_COLUMNS.slice(0, 3),
  createTableColumn<Member>({
    columnId: 'selected',
    label: 'Selected',
    renderCell: (member) => <SelectToggle name={member.name} />,
  }),
];

function CustomCellGrid({ selectionMode = 'none', ...args }: MemberGridProps) {
  return (
    <DataGrid
      items={MEMBERS}
      columns={CUSTOM_CELL_COLUMNS}
      getRowId={memberId}
      defaultSort={{ columnId: 'name', direction: 'ascending' }}
      selectionMode={selectionMode}
      {...args}
    >
      <tfoot>
        <SummaryRow columnCount={CUSTOM_CELL_COLUMNS.length + (selectionMode === 'none' ? 0 : 1)} />
      </tfoot>
    </DataGrid>
  );
}

/**
 * Parts of your own built on the DataGrid hooks. Each cell of the Selected column is a toggle of
 * its row's selection (`useDataGridRowId`, `useDataGridSelection`): it follows the row's checkbox,
 * Space on a cell and select-all, and they follow it. The footer row counts the selected members
 * and tells the sort in words, with a button that reverses it (`useDataGridSort`); the header's
 * arrow follows. The grid's keyboard is unchanged: the arrow keys reach the toggles and the
 * footer's button.
 */
export const CustomCell: Story = {
  args: {
    'aria-label': 'Team members with custom cells',
    selectionMode: 'multiple',
    defaultSelectedItems: ['2'],
  },
  render: (args) => <CustomCellGrid {...args} />,
};

const PAGE_SIZE = 20;
const ROLES = ['Engineer', 'Designer', 'Manager', 'Analyst'];
const LOCATIONS = ['Seattle', 'New York', 'London', 'Oslo', 'Tokyo'];

/** 200 members for the paging story. */
const MANY_MEMBERS: Member[] = Array.from({ length: 200 }, (_, index) => ({
  id: String(index + 1),
  name: `Member ${index + 1}`,
  role: ROLES[index % ROLES.length],
  location: LOCATIONS[index % LOCATIONS.length],
  status: index % 9 === 4 ? 'On leave' : 'Active',
}));

/** Client-side pages of `MANY_MEMBERS`; the selection is held here, over every page. */
function PagedGrid({ onSelectedItemsChange, ...args }: MemberGridProps) {
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<string[]>([]);
  const pageCount = Math.ceil(MANY_MEMBERS.length / PAGE_SIZE);
  const items = React.useMemo(
    () => MANY_MEMBERS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [page],
  );
  const handleSelectedItemsChange: DataGridBaseProps['onSelectedItemsChange'] = (next, details) => {
    setSelected(next);
    onSelectedItemsChange?.(next, details);
  };
  return (
    <div className="flex flex-col gap-3">
      <DataGrid
        items={items}
        columns={MEMBER_COLUMNS}
        getRowId={memberId}
        {...args}
        selectedItems={selected}
        onSelectedItemsChange={handleSelectedItemsChange}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabledFocusable={page === 0} onClick={() => setPage(page - 1)}>
          Previous page
        </Button>
        <span className="text-wave-body-1 text-wave-foreground">
          Page {page + 1} of {pageCount}
        </span>
        <Button disabledFocusable={page === pageCount - 1} onClick={() => setPage(page + 1)}>
          Next page
        </Button>
        <span role="status" className="text-wave-body-1 text-wave-foreground">
          {selected.length} selected
        </span>
      </div>
    </div>
  );
}

/**
 * Pages of 20 over 200 members. With `items`, selection follows the data: members selected on
 * one page stay selected on the others (the status counts them all), the header checkbox shows
 * the current page, and its select-all selects that page's members and keeps the rest.
 */
export const Paging: Story = {
  args: {
    'aria-label': 'Team members, paged',
    selectionMode: 'multiple',
  },
  render: (args) => <PagedGrid {...args} />,
};

/** The initial widths of the member columns; Name is never narrower than 120 pixels. */
const MEMBER_COLUMN_SIZING = {
  name: { minWidth: 120, defaultWidth: 220 },
  role: { defaultWidth: 160 },
  location: { defaultWidth: 160 },
  status: { defaultWidth: 140 },
};

/**
 * `resizableColumns` gives every column header a resize handle: drag the end edge of a header, or
 * press F2 on a header (or its sort button) to move focus to its handle, then the arrow keys (20
 * pixels, 5 with Shift, Home for the minimum) and Enter, Space or Escape to go back. The columns
 * start at their `defaultWidth` and the grid fills its container; the first resize keeps the
 * widths the columns are drawn at, and from then on the grid is as wide as its columns. Once any
 * column has been resized, a double click on a handle sets its column back to its initial width
 * (before the first resize it changes nothing).
 */
export const Resizable: Story = {
  args: {
    'aria-label': 'Team members, resizable columns',
    resizableColumns: true,
    columnSizingOptions: MEMBER_COLUMN_SIZING,
    onColumnWidthsChange: fn(),
  },
  render: (args) => <MemberGrid {...args} />,
};

/** Widths of the controlled story, by `columnId`. */
const INITIAL_MEMBER_WIDTHS: Record<string, number> = {
  name: 220,
  role: 160,
  location: 160,
  status: 140,
};

/** Holds the column widths in state, as an app that persists them would, and shows them. */
function ControlledWidthsGrid({ onColumnWidthsChange, ...args }: MemberGridProps) {
  const [widths, setWidths] = React.useState(INITIAL_MEMBER_WIDTHS);
  const handleColumnWidthsChange: NonNullable<DataGridBaseProps['onColumnWidthsChange']> = (
    next,
    details,
  ) => {
    setWidths(next);
    onColumnWidthsChange?.(next, details);
  };
  return (
    <div className="flex flex-col gap-3">
      <MemberGrid {...args} columnWidths={widths} onColumnWidthsChange={handleColumnWidthsChange} />
      <p className="text-wave-body-1 text-wave-foreground">
        Widths:{' '}
        {MEMBER_COLUMNS.map(({ columnId = '' }) => `${columnId} ${widths[columnId]}`).join(', ')}
      </p>
    </div>
  );
}

/**
 * Controlled widths: `columnWidths` comes from state and `onColumnWidthsChange` stores every
 * change there (where an app would persist it); the line below the grid shows the state.
 */
export const ResizableControlled: Story = {
  args: {
    'aria-label': 'Team members, controlled column widths',
    resizableColumns: true,
    onColumnWidthsChange: fn(),
  },
  render: (args) => <ControlledWidthsGrid {...args} />,
};

/** 10,000 members for the windowed story. */
const TEN_THOUSAND_MEMBERS: Member[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: String(index + 1),
  name: `Member ${String(index + 1).padStart(5, '0')}`,
  role: ROLES[(index * 3) % ROLES.length],
  location: LOCATIONS[(index * 7) % LOCATIONS.length],
  status: index % 9 === 4 ? 'On leave' : 'Active',
}));

/** One collator for every comparison: sorting 10,000 rows calls `compare` about 130,000 times. */
const collator = new Intl.Collator('en');

const TEN_THOUSAND_COLUMNS: readonly DataGridColumn<Member>[] = [
  createTableColumn<Member>({
    columnId: 'name',
    label: 'Name',
    compare: (a, b) => collator.compare(a.name, b.name),
    renderCell: (member) => member.name,
  }),
  createTableColumn<Member>({
    columnId: 'role',
    label: 'Role',
    compare: (a, b) => collator.compare(a.role, b.role),
    renderCell: (member) => member.role,
  }),
  createTableColumn<Member>({
    columnId: 'location',
    label: 'Location',
    compare: (a, b) => collator.compare(a.location, b.location),
    renderCell: (member) => member.location,
  }),
  createTableColumn<Member>({
    columnId: 'status',
    label: 'Status',
    renderCell: (member) => member.status,
  }),
];

/** The args of the windowed story: the grid's, and the window's row height. */
type TenThousandRowsArgs = MemberGridProps & {
  /** The height of every row in pixels: `useVirtualWindow({ itemSize })`. */
  itemSize: number;
};

/** The height of the grid's header in `container`, followed with a ResizeObserver. */
function useHeaderHeight(container: HTMLElement | null): number {
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const header = container?.querySelector('thead');
    if (!header || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(header.offsetHeight));
    observer.observe(header);
    return () => observer.disconnect();
  }, [container]);
  return height;
}

/** Counts the body rows the grid in `container` has rendered (`tr[data-row-index]`). */
function MountedRows({ container, total }: { container: HTMLElement | null; total: number }) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!container) return () => {};
      const observer = new MutationObserver(onChange);
      observer.observe(container, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    [container],
  );
  const mounted = React.useSyncExternalStore(
    subscribe,
    () => container?.querySelectorAll('tr[data-row-index]').length ?? 0,
    () => 0,
  );
  return (
    <p className="text-wave-body-1 text-wave-foreground">
      Mounted rows: {mounted} of {total.toLocaleString('en')}
    </p>
  );
}

/** A grid of 10,000 members in a 480-pixel scroller, windowed by `useVirtualWindow`. */
function TenThousandRowsGrid({ itemSize, ...args }: TenThousandRowsArgs) {
  const [container, setContainer] = React.useState<HTMLDivElement | null>(null);
  // The header sticks over the rows: keyboard moves bring rows into the area below it.
  const headerHeight = useHeaderHeight(container);
  const virtualWindow = useVirtualWindow({ itemSize, scrollPaddingStart: headerHeight });
  return (
    <div className="flex flex-col gap-3">
      <DataGrid
        items={TEN_THOUSAND_MEMBERS}
        columns={TEN_THOUSAND_COLUMNS}
        getRowId={memberId}
        {...args}
        virtualWindow={virtualWindow}
        containerProps={{ ref: setContainer, className: 'h-120' }}
      />
      <MountedRows container={container} total={TEN_THOUSAND_MEMBERS.length} />
    </div>
  );
}

/**
 * 10,000 members with `virtualWindow`: only the rows in view (and a few beyond) are rendered, as
 * the line below the grid counts, in a scroller 480 pixels tall with rows 44 pixels tall. Sorting,
 * select-all (every member), column resizing and the keyboard (Ctrl+End reaches the last member)
 * work on the whole list; a focused row stays rendered when it is scrolled away.
 */
export const TenThousandRows: StoryObj<TenThousandRowsArgs> = {
  args: {
    'aria-label': 'Ten thousand members',
    itemSize: 44,
    selectionMode: 'multiple',
    resizableColumns: true,
    onColumnWidthsChange: fn(),
  },
  argTypes: {
    // Heights a row's cells fit in; a smaller one would overlap the rows.
    itemSize: { control: 'select', options: [44, 52, 60] },
  },
  render: (args) => <TenThousandRowsGrid {...args} />,
};

/** `size` sets the density of the grid: medium (the default), small and extra-small. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['medium', 'small', 'extra-small'] as const).map((size) => (
        <HeaderChildrenGrid
          key={size}
          {...args}
          size={size}
          selectionMode="multiple"
          aria-label={`Team members, ${size}`}
        />
      ))}
    </div>
  ),
};

/** The grid of the focus stories: a button in every Role cell. */
function FocusGrid({
  cellFocusMode,
  onSortChange,
  ...args
}: DataGridStoryArgs & { cellFocusMode?: boolean }) {
  return (
    <DataGrid defaultSort={null} onSortChange={onSortChange} {...args}>
      <DataGrid.Header>
        <DataGrid.Row>
          <DataGrid.HeaderCell columnId="name" sortable>
            Name
          </DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Role</DataGrid.HeaderCell>
          <DataGrid.HeaderCell>Location</DataGrid.HeaderCell>
        </DataGrid.Row>
      </DataGrid.Header>
      <DataGrid.Body>
        {MEMBERS.map((member, index) => (
          <DataGrid.Row key={member.id} rowId={member.id}>
            <DataGrid.Cell focusMode={cellFocusMode && index === 1 ? 'none' : undefined}>
              {member.name}
            </DataGrid.Cell>
            <DataGrid.Cell focusMode={cellFocusMode && index === 2 ? 'group' : undefined}>
              <Button size="small" appearance="subtle">
                {`Edit ${member.name}`}
              </Button>
            </DataGrid.Cell>
            <DataGrid.Cell>{member.location}</DataGrid.Cell>
          </DataGrid.Row>
        ))}
      </DataGrid.Body>
    </DataGrid>
  );
}

/**
 * `focusMode` sets how focus moves: `cell` (the default) one Tab stop and the arrow keys between
 * cells, `row` one Tab stop on a body row with the arrow keys between rows, `none` no keys and no
 * managed Tab stops. Try each in the controls.
 */
export const FocusModes: Story = {
  args: { focusMode: 'row', selectionMode: 'multiple' },
  argTypes: { focusMode: { control: 'inline-radio', options: ['cell', 'row', 'none'] } },
  render: (args) => <FocusGrid {...args} />,
};

/**
 * A cell's own `focusMode`: the arrow keys skip Bob's Name cell (`none`), and the Role cell of
 * Carol is its own focus target although it holds a single button (`group`: Enter enters the
 * button, Escape returns).
 */
export const CellFocusModes: Story = {
  render: (args) => <FocusGrid {...args} cellFocusMode />,
};

/** A windowed grid with a `<tfoot>`: its row is numbered after the 10,000 members and navigated. */
export const FooterRows: StoryObj<TenThousandRowsArgs> = {
  args: { 'aria-label': 'Ten thousand members with a footer', itemSize: 44 },
  render: ({ itemSize, ...args }) => {
    const Grid = () => {
      const virtualWindow = useVirtualWindow({ itemSize, scrollPaddingStart: itemSize });
      return (
        <DataGrid
          items={TEN_THOUSAND_MEMBERS}
          columns={TEN_THOUSAND_COLUMNS}
          getRowId={memberId}
          {...args}
          virtualWindow={virtualWindow}
          containerProps={{ className: 'h-120' }}
        >
          <tfoot>
            <tr>
              <td className="px-4 py-3 text-wave-body-1" colSpan={4}>
                10,000 members
              </td>
            </tr>
          </tfoot>
        </DataGrid>
      );
    };
    return <Grid />;
  },
};
