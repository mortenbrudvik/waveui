import type { Meta, StoryObj } from '@storybook/react';
import { Tag } from '../src';

const meta = {
  title: 'Data Display/Tag',
  component: Tag,
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Tag label',
  },
};

export const Dismissible: Story = {
  args: {
    children: 'Dismissible tag',
    dismissible: true,
    onDismiss: () => alert('Dismissed!'),
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: 4 }}>
          <circle cx="8" cy="8" r="6" />
        </svg>
        With icon
      </>
    ),
  },
};
