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
  const [selected, setSelected] = React.useState<readonly string[]>(defaultSelectedItems ?? []);
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

const onAction = fn();

const FRUIT = ['Apples', 'Bananas', 'Cherries', 'Dates'];

/**
 * `navigationMode` decides how the keyboard reaches the items: `none` (a plain list: no item is a
 * Tab stop), `items` (one Tab stop, moved with the arrow keys) and `composite` (a grid: Up and Down
 * between the rows, Right and Left into and out of their actions, which leave the Tab order).
 */
export const NavigationModes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      {(['none', 'items', 'composite'] as const).map((mode) => (
        <div key={mode}>
          <p className="mb-2 text-body-1 font-semibold">{`navigationMode="${mode}"`}</p>
          <List {...args} navigationMode={mode} aria-label={`Documents, ${mode} navigation`}>
            {['Document A', 'Document B', 'Document C'].map((name) => (
              <List.Item
                key={name}
                action={
                  <Button appearance="subtle" size="small">
                    {`Share ${name}`}
                  </Button>
                }
              >
                {name}
              </List.Item>
            ))}
          </List>
        </div>
      ))}
    </div>
  ),
};

/**
 * `onAction` runs when an item is activated: a click, Enter, or Space on an item that cannot be
 * selected. It runs for every activation and not for clicks in an action or in interactive
 * content. Here the list is not selectable, so the items are one Tab stop (`items`).
 */
export const OnAction: Story = {
  args: {
    navigationMode: 'items',
    'aria-label': 'Recent files',
  },
  render: ({ navigationMode, ...args }) => {
    const [last, setLast] = React.useState<string | null>(null);
    return (
      <div>
        <p className="mb-2 text-body-1">Opened: {last ?? 'nothing yet'}</p>
        <List {...args} navigationMode={navigationMode}>
          {['Budget.xlsx', 'Roadmap.pptx', 'Notes.docx'].map((name) => (
            <List.Item
              key={name}
              onAction={() => {
                setLast(name);
                onAction(name);
              }}
            >
              {name}
            </List.Item>
          ))}
        </List>
      </div>
    );
  },
};

/**
 * `disabledSelection` keeps an item from being toggled while it stays focusable and in the arrow
 * order. Without `onAction` it is also `aria-disabled`; with one, a click and Enter still run
 * the action and only Space, the selection key, does nothing.
 */
export const DisabledSelection: Story = {
  args: {
    selectable: true,
    selectionMode: 'multiple',
    defaultSelectedItems: ['inbox'],
    'aria-label': 'Folders',
    onSelectionChange: fn(),
  },
  render: (args) => (
    <SelectionDemo {...args}>
      <List.Item value="inbox" disabledSelection>
        Inbox (always selected)
      </List.Item>
      <List.Item value="drafts">Drafts</List.Item>
      <List.Item value="archive" disabledSelection onAction={() => onAction('archive')}>
        Archive (opens, cannot be selected)
      </List.Item>
      <List.Item value="trash">Trash</List.Item>
    </SelectionDemo>
  ),
};

/**
 * `checkmark` draws a check at the start of every item of a selectable list while the item is
 * selected. An item's own `checkmark` replaces the glyph or, with `false`, hides it.
 */
export const Checkmarks: Story = {
  args: {
    selectable: true,
    selectionMode: 'multiple',
    checkmark: true,
    defaultSelectedItems: ['Apples', 'Cherries'],
    'aria-label': 'Fruit',
    onSelectionChange: fn(),
  },
  render: (args) => (
    <SelectionDemo {...args}>
      {FRUIT.map((fruit) => (
        <List.Item
          key={fruit}
          value={fruit}
          checkmark={fruit === 'Dates' ? false : fruit === 'Bananas' ? '★' : undefined}
        >
          {fruit}
        </List.Item>
      ))}
    </SelectionDemo>
  ),
};
