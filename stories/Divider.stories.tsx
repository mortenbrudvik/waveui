import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from '../src';

const meta = {
  title: 'Data Display/Divider',
  component: Divider,
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    orientation: 'horizontal',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  decorators: [
    (Story) => (
      <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
        <Story />
      </div>
    ),
  ],
};

export const WithText: Story = {
  args: {
    children: 'OR',
    orientation: 'horizontal',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
};
