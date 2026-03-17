import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchBox } from '../src';

const meta = {
  title: 'Components/Input/SearchBox',
  component: SearchBox,
} satisfies Meta<typeof SearchBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Search...',
  },
};

export const WithSlots: Story = {
  args: {
    placeholder: 'Search files...',
    contentAfter: { children: '⌘K' },
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div>
        <SearchBox value={value} onChange={setValue} placeholder="Type to search" />
        <p style={{ marginTop: 8 }}>Query: {value || '(empty)'}</p>
      </div>
    );
  },
};
