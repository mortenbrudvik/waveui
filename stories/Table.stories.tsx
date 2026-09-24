import type { Meta, StoryObj } from '@storybook/react';
import { Table } from '../src';

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

/**
 * A non-interactive data table. `striped` shades odd body rows. The table sits in a horizontally
 * scrollable wrapper that becomes a focusable, named region while it scrolls.
 */
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
      <caption className="px-4 py-2 text-start text-body-1 font-semibold">Team directory</caption>
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
