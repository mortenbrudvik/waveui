import type { Meta, StoryObj } from '@storybook/react';
import { Table } from '../src';

const meta = {
  title: 'Components/Table/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <tr>
          <Table.HeadCell>Name</Table.HeadCell>
          <Table.HeadCell>Role</Table.HeadCell>
          <Table.HeadCell>Status</Table.HeadCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Alice Johnson</Table.Cell>
          <Table.Cell>Engineer</Table.Cell>
          <Table.Cell>Active</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Bob Smith</Table.Cell>
          <Table.Cell>Designer</Table.Cell>
          <Table.Cell>Active</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Carol White</Table.Cell>
          <Table.Cell>Manager</Table.Cell>
          <Table.Cell>On Leave</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

export const Striped: Story = {
  render: () => (
    <Table striped>
      <Table.Head>
        <tr>
          <Table.HeadCell>Product</Table.HeadCell>
          <Table.HeadCell>Price</Table.HeadCell>
          <Table.HeadCell>Stock</Table.HeadCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell>Widget A</Table.Cell>
          <Table.Cell>$19.99</Table.Cell>
          <Table.Cell>142</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Widget B</Table.Cell>
          <Table.Cell>$29.99</Table.Cell>
          <Table.Cell>83</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Widget C</Table.Cell>
          <Table.Cell>$9.99</Table.Cell>
          <Table.Cell>310</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>Widget D</Table.Cell>
          <Table.Cell>$49.99</Table.Cell>
          <Table.Cell>27</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};

export const FullComposition: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <tr>
          <Table.HeadCell>ID</Table.HeadCell>
          <Table.HeadCell>Name</Table.HeadCell>
          <Table.HeadCell>Email</Table.HeadCell>
          <Table.HeadCell>Department</Table.HeadCell>
          <Table.HeadCell>Location</Table.HeadCell>
        </tr>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell>001</Table.Cell>
          <Table.Cell>Alice Johnson</Table.Cell>
          <Table.Cell>alice@example.com</Table.Cell>
          <Table.Cell>Engineering</Table.Cell>
          <Table.Cell>Seattle</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>002</Table.Cell>
          <Table.Cell>Bob Smith</Table.Cell>
          <Table.Cell>bob@example.com</Table.Cell>
          <Table.Cell>Design</Table.Cell>
          <Table.Cell>New York</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Cell>003</Table.Cell>
          <Table.Cell>Carol White</Table.Cell>
          <Table.Cell>carol@example.com</Table.Cell>
          <Table.Cell>Marketing</Table.Cell>
          <Table.Cell>London</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};
