import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SearchBox } from '../src';

const meta = {
  title: 'Components/Input/SearchBox',
  component: SearchBox,
  args: {
    'aria-label': 'Search',
    placeholder: 'Search...',
    onValueChange: fn(),
    onClear: fn(),
  },
} satisfies Meta<typeof SearchBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSlots: Story = {
  args: {
    'aria-label': 'Search files',
    placeholder: 'Search files...',
    defaultValue: 'report',
    contentAfter: { children: '⌘K', 'aria-hidden': true },
  },
};

/** The clear button content can be replaced; it stays the built-in, labelled button. */
export const CustomDismiss: Story = {
  args: {
    defaultValue: 'invoices',
    dismiss: <span aria-hidden="true">✕</span>,
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <div>
        <SearchBox
          {...args}
          placeholder="Type to search"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
        <p style={{ marginTop: 8 }}>Query: {value || '(empty)'}</p>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: 'archived',
    disabled: true,
  },
};
