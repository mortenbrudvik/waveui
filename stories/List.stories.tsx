import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { List } from '../src';

const meta = {
  title: 'Data Display/List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <List {...args} style={{ width: 400 }}>
      <List.Item>Apples</List.Item>
      <List.Item>Bananas</List.Item>
      <List.Item>Cherries</List.Item>
      <List.Item>Dates</List.Item>
    </List>
  ),
};

export const WithActions: Story = {
  render: () => (
    <List style={{ width: 400 }}>
      <List.Item action={<button style={{ fontSize: 12, color: '#d13438' }}>Delete</button>}>
        Document A
      </List.Item>
      <List.Item action={<button style={{ fontSize: 12, color: '#d13438' }}>Delete</button>}>
        Document B
      </List.Item>
      <List.Item action={<button style={{ fontSize: 12, color: '#d13438' }}>Delete</button>}>
        Document C
      </List.Item>
    </List>
  ),
};

export const SingleSelect: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    return (
      <div>
        <p style={{ marginBottom: 8 }}>Selected: {selected.join(', ') || 'none'}</p>
        <List
          selectable
          selectedItems={selected}
          onSelectionChange={setSelected}
          style={{ width: 400 }}
        >
          <List.Item value="a">Item Alpha</List.Item>
          <List.Item value="b">Item Beta</List.Item>
          <List.Item value="c">Item Gamma</List.Item>
        </List>
      </div>
    );
  },
};

export const MultiSelect: Story = {
  render: () => {
    const [selected, setSelected] = React.useState<string[]>([]);
    return (
      <div>
        <p style={{ marginBottom: 8 }}>Selected: {selected.join(', ') || 'none'}</p>
        <List
          selectable
          selectionMode="multi"
          selectedItems={selected}
          onSelectionChange={setSelected}
          style={{ width: 400 }}
        >
          <List.Item value="1">Option One</List.Item>
          <List.Item value="2">Option Two</List.Item>
          <List.Item value="3">Option Three</List.Item>
          <List.Item value="4">Option Four</List.Item>
        </List>
      </div>
    );
  },
};
