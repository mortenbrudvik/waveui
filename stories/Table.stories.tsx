import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, Table, useVirtualWindow } from '../src';
import type { SortDirection } from '../src';

const members = [
  {
    id: '001',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'Engineer',
    location: 'Seattle',
  },
  {
    id: '002',
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'Designer',
    location: 'New York',
  },
  {
    id: '003',
    name: 'Carol White',
    email: 'carol@example.com',
    role: 'Manager',
    location: 'London',
  },
  { id: '004', name: 'David Brown', email: 'david@example.com', role: 'Analyst', location: 'Oslo' },
];

function header(labels: string[]) {
  return (
    <Table.Header>
      <tr>
        {labels.map((label) => (
          <Table.HeaderCell key={label}>{label}</Table.HeaderCell>
        ))}
      </tr>
    </Table.Header>
  );
}

const meta = {
  title: 'Components/Table/Table',
  component: Table,
  args: {
    striped: false,
    children: null,
  },
  render: (args) => (
    <Table {...args}>
      {header(['Name', 'Role', 'Location'])}
      <Table.Body>
        {members.slice(0, 3).map((member) => (
          <Table.Row key={member.id}>
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.role}</Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Odd body rows get the card background (a CSS selector on the table, no row context). */
export const Striped: Story = {
  args: {
    striped: true,
  },
};

/**
 * A wide table in a narrow container: the wrapper scrolls horizontally and, while it does, is a
 * focusable region named by the caption, so keyboard users can scroll it.
 */
export const WithCaptionAndScroll: Story = {
  args: {
    containerProps: { className: 'max-w-md' },
    className: 'min-w-[40rem]',
  },
  render: (args) => (
    <Table {...args}>
      <caption className="px-4 py-2 text-start text-wave-body-1 font-semibold">
        Team directory
      </caption>
      {header(['ID', 'Name', 'Email', 'Role', 'Location'])}
      <Table.Body>
        {members.map((member) => (
          <Table.Row key={member.id}>
            <Table.Cell>{member.id}</Table.Cell>
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.email}</Table.Cell>
            <Table.Cell>{member.role}</Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

export const FullComposition: Story = {
  render: (args) => (
    <Table {...args}>
      {header(['ID', 'Name', 'Email', 'Role', 'Location'])}
      <Table.Body>
        {members.map((member) => (
          <Table.Row key={member.id}>
            <Table.Cell>{member.id}</Table.Cell>
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.email}</Table.Cell>
            <Table.Cell>{member.role}</Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

type SortKey = 'name' | 'role' | 'location';

interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const onSortClick = fn();

/** A chevron for the sort glyph; the slot span carries `data-direction`, which turns it. */
const ChevronGlyph = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10l5-5 5 5" />
  </svg>
);

type SortableTableProps = React.ComponentProps<typeof Table> & { customGlyph?: boolean };

/**
 * The table keeps no sort state: the story holds it, sets `sortDirection` on the sorted header and
 * orders the rows in `onSortClick`.
 */
function SortableTable({ customGlyph = false, ...args }: SortableTableProps) {
  const [sort, setSort] = React.useState<SortState>({ key: 'name', direction: 'ascending' });
  const rows = [...members].sort((a, b) => {
    const order = a[sort.key].localeCompare(b[sort.key]);
    return sort.direction === 'ascending' ? order : -order;
  });
  const header = (key: SortKey, label: string, aside?: React.ReactNode) => (
    <Table.HeaderCell
      sortable
      sortDirection={sort.key === key ? sort.direction : undefined}
      sortIcon={
        customGlyph
          ? { className: 'data-[direction=descending]:rotate-180', children: <ChevronGlyph /> }
          : undefined
      }
      aside={aside}
      onSortClick={(event) => {
        onSortClick(key, event);
        setSort((prev) => ({
          key,
          direction:
            prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending',
        }));
      }}
    >
      {label}
    </Table.HeaderCell>
  );
  return (
    <Table {...args}>
      <Table.Header>
        <Table.Row>
          {header('name', 'Name')}
          {header(
            'role',
            'Role',
            <Button size="small" appearance="subtle">
              Filter roles
            </Button>,
          )}
          {header('location', 'Location')}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((member) => (
          <Table.Row key={member.id}>
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.role}</Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/**
 * `sortable` makes a header a sort button (`aria-sort` on the cell), `sortDirection` marks the
 * sorted column and `onSortClick` reports the click. `aside` puts a control beside the header
 * content, outside the sort button, so it is not part of the name of the button.
 */
export const SortableHeaders: Story = {
  render: (args) => <SortableTable {...args} />,
};

/** `sortIcon` replaces the arrow; its element carries `data-direction`, so one glyph can turn. */
export const CustomSortIcon: Story = {
  render: (args) => <SortableTable {...args} customGlyph />,
};

/**
 * `Table.SelectionCell` is a native checkbox in a cell. The table keeps no selection: the story
 * holds it, and the header cell with `checked="mixed"` draws a partly selected select-all.
 * `subtle` draws an unchecked box only while its row is hovered or holds focus.
 */
export const SelectionCells: Story = {
  args: { 'aria-label': 'Team members' },
  render: (args) => {
    const [selected, setSelected] = React.useState<readonly string[]>(['002']);
    const all = selected.length === members.length ? true : selected.length > 0 ? 'mixed' : false;
    return (
      <Table {...args}>
        <Table.Header>
          <Table.Row>
            <Table.SelectionCell
              aria-label="Select all members"
              checked={all}
              onCheckedChange={(checked) => setSelected(checked ? members.map((m) => m.id) : [])}
            />
            <Table.HeaderCell>Name</Table.HeaderCell>
            <Table.HeaderCell>Role</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {members.map((member) => (
            <Table.Row key={member.id}>
              <Table.SelectionCell
                subtle
                aria-label={`Select ${member.name}`}
                checked={selected.includes(member.id)}
                onCheckedChange={(checked) =>
                  setSelected((prev) =>
                    checked ? [...prev, member.id] : prev.filter((id) => id !== member.id),
                  )
                }
              />
              <Table.Cell>{member.name}</Table.Cell>
              <Table.Cell>{member.role}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  },
};

/** `type="radio"` with a shared `name` selects one row; an uncontrolled group needs no state. */
export const RadioSelection: Story = {
  args: { 'aria-label': 'Primary contact' },
  render: (args) => (
    <Table {...args}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>
            <span className="sr-only">Primary contact</span>
          </Table.HeaderCell>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Email</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {members.map((member) => (
          <Table.Row key={member.id}>
            <Table.SelectionCell
              type="radio"
              name="primary-contact"
              value={member.id}
              defaultChecked={member.id === '001'}
              aria-label={`${member.name} is the primary contact`}
            />
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.email}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

/**
 * `Table.CellLayout` lays out a cell: `media` (an Avatar takes a 32px box), the main text and a
 * `description` under it. `appearance="primary"` draws the text that names the row semibold. The
 * Avatar is decorative because the name is beside it.
 */
export const CellLayouts: Story = {
  args: { 'aria-label': 'Team directory' },
  render: (args) => (
    <Table {...args}>
      {header(['Member', 'Location'])}
      <Table.Body>
        {members.map((member) => (
          <Table.Row key={member.id}>
            <Table.Cell>
              <Table.CellLayout
                appearance="primary"
                media={<Avatar name={member.name} decorative />}
                description={member.email}
              >
                {member.name}
              </Table.CellLayout>
            </Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

const sharedFiles = [
  {
    name: 'Quarterly financial results for the northern sales region.xlsx',
    owner: 'Alice Johnson',
    note: 'Edited yesterday by Bob Smith in the finance workspace',
  },
  { name: 'Roadmap.pptx', owner: 'Carol White', note: 'Edited today' },
];

/**
 * `truncate` keeps the text and the description to one line each, ending in an ellipsis, where the
 * width of the column is bounded: here by the fixed table layout (`table-fixed`) and a width on
 * the column's header cell. (In the automatic layout a cell's width is only a minimum: the column
 * grows to fit the text that does not wrap.) Below its minimum width (`min-w-96`) the table
 * scrolls, and `containerProps['aria-label']` names the scroll region.
 */
export const TruncatedCellLayout: Story = {
  args: {
    'aria-label': 'Shared files',
    className: 'min-w-96 table-fixed',
    containerProps: { 'aria-label': 'Shared files' },
  },
  render: (args) => (
    <Table {...args}>
      <Table.Header>
        <tr>
          <Table.HeaderCell className="w-64">File</Table.HeaderCell>
          <Table.HeaderCell>Owner</Table.HeaderCell>
        </tr>
      </Table.Header>
      <Table.Body>
        {sharedFiles.map((file) => (
          <Table.Row key={file.name}>
            <Table.Cell>
              <Table.CellLayout truncate description={file.note} title={file.name}>
                {file.name}
              </Table.CellLayout>
            </Table.Cell>
            <Table.Cell>{file.owner}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

/**
 * `Table.CellActions` shows the actions of a cell over its end while the row is hovered or holds
 * focus (always on touch screens and in forced colors); `visible` keeps them shown, as in the
 * first row. They stay in the tab order, and Tab into them shows them.
 */
export const CellActions: Story = {
  args: { 'aria-label': 'Team members with actions' },
  render: (args) => (
    <Table {...args}>
      {header(['Name', 'Role'])}
      <Table.Body>
        {members.map((member, index) => (
          <Table.Row key={member.id}>
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>
              {member.role}
              <Table.CellActions visible={index === 0}>
                <Button size="small" appearance="subtle">
                  {`Edit ${member.name}`}
                </Button>
                <Button size="small" appearance="subtle">
                  {`Remove ${member.name}`}
                </Button>
              </Table.CellActions>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

/**
 * `size` sets the density: medium (the default), small and extra-small. It tightens the padding of
 * the cells, the header cells, the sort buttons and the selection cells, and sizes the media of a
 * `Table.CellLayout`.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['medium', 'small', 'extra-small'] as const).map((size) => (
        <Table key={size} {...args} size={size} aria-label={`Team members, ${size}`}>
          <caption className="px-4 py-2 text-start text-wave-body-1 font-semibold">{size}</caption>
          <Table.Header>
            <tr>
              <Table.SelectionCell aria-label={`Select all, ${size}`} />
              <Table.HeaderCell sortable sortDirection="ascending">
                Name
              </Table.HeaderCell>
              <Table.HeaderCell>Role</Table.HeaderCell>
            </tr>
          </Table.Header>
          <Table.Body>
            {members.slice(0, 3).map((member) => (
              <Table.Row key={member.id}>
                <Table.SelectionCell aria-label={`Select ${member.name}, ${size}`} />
                <Table.Cell>
                  <Table.CellLayout media={<Avatar name={member.name} />}>
                    {member.name}
                  </Table.CellLayout>
                </Table.Cell>
                <Table.Cell>{member.role}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      ))}
    </div>
  ),
};

/** Rows that fill themselves while selected: the table keeps no selection, the story does. */
function SelectableRows(args: React.ComponentProps<typeof Table>) {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set(['002']));
  return (
    <Table {...args}>
      {header(['Name', 'Role', 'Location'])}
      <Table.Body>
        {members.map((member) => (
          <Table.Row
            key={member.id}
            appearance={selected.has(member.id) ? 'brand' : 'none'}
            onClick={() =>
              setSelected((previous) => {
                const next = new Set(previous);
                if (!next.delete(member.id)) next.add(member.id);
                return next;
              })
            }
          >
            <Table.Cell>{member.name}</Table.Cell>
            <Table.Cell>{member.role}</Table.Cell>
            <Table.Cell>{member.location}</Table.Cell>
          </Table.Row>
        ))}
        <Table.Row appearance="neutral">
          <Table.Cell>A neutral row</Table.Cell>
          <Table.Cell>Fixed</Table.Cell>
          <Table.Cell>Anywhere</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  );
}

/**
 * `Table.Row` `appearance` fills a row: `brand` with the selected token and `neutral` with the
 * subtle selected token, the two fills a DataGrid gives a selected row. The table keeps no
 * selection, so the story sets it from its own state.
 */
export const RowAppearance: Story = {
  args: { 'aria-label': 'Team members, selectable rows' },
  render: (args) => <SelectableRows {...args} />,
};

const THOUSAND_ROWS = Array.from({ length: 1_000 }, (_, index) => ({
  id: index + 1,
  name: `File ${String(index + 1).padStart(4, '0')}`,
  owner: members[index % members.length].name,
}));

/** A static table of 1,000 rows in a 400-pixel scroller, windowed by `useVirtualWindow`. */
function VirtualTable(args: React.ComponentProps<typeof Table>) {
  const virtualWindow = useVirtualWindow({ itemSize: 44, scrollPaddingStart: 44 });
  return (
    <Table
      {...args}
      virtualWindow={virtualWindow}
      containerProps={{ className: 'h-100' }}
      className="min-w-[30rem]"
    >
      <caption className="sr-only">A thousand files</caption>
      <Table.Header>
        <tr>
          <Table.HeaderCell className="w-24">Number</Table.HeaderCell>
          <Table.HeaderCell>Name</Table.HeaderCell>
          <Table.HeaderCell>Owner</Table.HeaderCell>
        </tr>
      </Table.Header>
      <Table.Body count={THOUSAND_ROWS.length}>
        {(index) => (
          <Table.Row key={THOUSAND_ROWS[index].id}>
            <Table.Cell>{THOUSAND_ROWS[index].id}</Table.Cell>
            <Table.Cell>{THOUSAND_ROWS[index].name}</Table.Cell>
            <Table.Cell>{THOUSAND_ROWS[index].owner}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
      <tfoot>
        <tr>
          <td className="px-4 py-3 text-wave-body-1" colSpan={3}>
            1,000 files
          </td>
        </tr>
      </tfoot>
    </Table>
  );
}

/**
 * `virtualWindow` with a `count` and a function child on `Table.Body`: only the rows in view are
 * rendered, with spacer rows for the others. The header sticks to the top of the scroller, `striped`
 * follows each row's index, and `aria-rowcount` and `aria-rowindex` cover every row.
 */
export const VirtualWindow: Story = {
  args: { striped: true, 'aria-label': 'A thousand files' },
  render: (args) => <VirtualTable {...args} />,
};
