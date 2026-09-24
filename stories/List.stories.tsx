import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, List } from '../src';
import type { ListProps } from '../src';

const meta = {
  title: 'Components/Data Display/List',
  component: List,
  args: {
    style: { width: 400 },
  },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Controlled selection with a live readout of the selected values. */
function SelectionDemo(props: ListProps) {
  const { onSelectionChange, defaultSelectedItems, ...rest } = props;
  const [selected, setSelected] = React.useState<string[]>(defaultSelectedItems ?? []);
  return (
    <div>
      <p className="mb-2 text-body-1">Selected: {selected.join(', ') || 'none'}</p>
      <List
        {...rest}
        selectedItems={selected}
        onSelectionChange={(next) => {
          setSelected(next);
          onSelectionChange?.(next);
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: (args) => (
    <List {...args}>
      <List.Item>Apples</List.Item>
      <List.Item>Bananas</List.Item>
      <List.Item>Cherries</List.Item>
      <List.Item>Dates</List.Item>
    </List>
  ),
};

/** Actions of a plain list stay in the normal Tab order. */
export const WithActions: Story = {
  render: (args) => (
    <List {...args}>
      {['Document A', 'Document B', 'Document C'].map((name) => (
        <List.Item
          key={name}
          action={
            <Button appearance="subtle" size="small" className="text-error">
              Delete {name}
            </Button>
          }
        >
          {name}
        </List.Item>
      ))}
    </List>
  ),
};

/** One Tab stop; ArrowUp/Down move, Enter/Space select. */
export const SingleSelect: Story = {
  args: {
    selectable: true,
    'aria-label': 'Items',
    onSelectionChange: fn(),
  },
  render: (args) => (
    <SelectionDemo {...args}>
      <List.Item value="a">Item Alpha</List.Item>
      <List.Item value="b">Item Beta</List.Item>
      <List.Item value="c">Item Gamma</List.Item>
    </SelectionDemo>
  ),
};

export const MultiSelect: Story = {
  args: {
    selectable: true,
    selectionMode: 'multiple',
    'aria-label': 'Options',
    onSelectionChange: fn(),
  },
  render: (args) => (
    <SelectionDemo {...args}>
      <List.Item value="1">Option One</List.Item>
      <List.Item value="2">Option Two</List.Item>
      <List.Item value="3">Option Three</List.Item>
      <List.Item value="4">Option Four</List.Item>
    </SelectionDemo>
  ),
};

/**
 * A selectable list whose items have actions uses grid semantics: one Tab stop, ArrowUp/Down
 * between rows, ArrowRight/Left into and out of the actions. Actions never toggle selection.
 */
export const SelectableWithActions: Story = {
  args: {
    selectable: true,
    selectionMode: 'multiple',
    'aria-label': 'Documents',
    onSelectionChange: fn(),
  },
  render: (args) => (
    <SelectionDemo {...args}>
      {['Document A', 'Document B', 'Document C'].map((name) => (
        <List.Item
          key={name}
          value={name}
          action={
            <Button appearance="subtle" size="small" className="text-error">
              Delete {name}
            </Button>
          }
        >
          {name}
        </List.Item>
      ))}
    </SelectionDemo>
  ),
};
