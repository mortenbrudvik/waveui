import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DataGrid } from '../src';

const meta = {
  title: 'Components/Table/DataGrid',
  component: DataGrid,
} satisfies Meta<typeof DataGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DataGrid>
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell columnId="name" sortable>Name</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="role" sortable>Role</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="status">Status</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        <DataGrid.Row rowId="1">
          <DataGrid.Cell>Alice Johnson</DataGrid.Cell>
          <DataGrid.Cell>Engineer</DataGrid.Cell>
          <DataGrid.Cell>Active</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="2">
          <DataGrid.Cell>Bob Smith</DataGrid.Cell>
          <DataGrid.Cell>Designer</DataGrid.Cell>
          <DataGrid.Cell>Active</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="3">
          <DataGrid.Cell>Carol White</DataGrid.Cell>
          <DataGrid.Cell>Manager</DataGrid.Cell>
          <DataGrid.Cell>On Leave</DataGrid.Cell>
        </DataGrid.Row>
      </DataGrid.Body>
    </DataGrid>
  ),
};

export const WithSelection: Story = {
  render: () => (
    <DataGrid selectionMode="multiple">
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell>&nbsp;</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="name" sortable>Name</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="email">Email</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        <DataGrid.Row rowId="1">
          <DataGrid.Cell>Alice</DataGrid.Cell>
          <DataGrid.Cell>alice@example.com</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="2">
          <DataGrid.Cell>Bob</DataGrid.Cell>
          <DataGrid.Cell>bob@example.com</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="3">
          <DataGrid.Cell>Carol</DataGrid.Cell>
          <DataGrid.Cell>carol@example.com</DataGrid.Cell>
        </DataGrid.Row>
      </DataGrid.Body>
    </DataGrid>
  ),
};

export const SingleSelection: Story = {
  render: () => (
    <DataGrid selectionMode="single">
      <DataGrid.Header>
        <tr>
          <DataGrid.HeaderCell>&nbsp;</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="product" sortable>Product</DataGrid.HeaderCell>
          <DataGrid.HeaderCell columnId="price" sortable>Price</DataGrid.HeaderCell>
        </tr>
      </DataGrid.Header>
      <DataGrid.Body>
        <DataGrid.Row rowId="a">
          <DataGrid.Cell>Widget A</DataGrid.Cell>
          <DataGrid.Cell>$19.99</DataGrid.Cell>
        </DataGrid.Row>
        <DataGrid.Row rowId="b">
          <DataGrid.Cell>Widget B</DataGrid.Cell>
          <DataGrid.Cell>$29.99</DataGrid.Cell>
        </DataGrid.Row>
      </DataGrid.Body>
    </DataGrid>
  ),
};
