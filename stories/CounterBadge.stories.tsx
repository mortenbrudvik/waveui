import type { Meta, StoryObj } from '@storybook/react';
import { CounterBadge } from '../src';

const meta = {
  title: 'Data Display/CounterBadge',
  component: CounterBadge,
  argTypes: {
    appearance: {
      control: 'select',
      options: ['filled', 'outline'],
    },
  },
} satisfies Meta<typeof CounterBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    count: 5,
    appearance: 'filled',
  },
};

export const Overflow: Story = {
  args: {
    count: 150,
    overflowCount: 99,
    appearance: 'filled',
  },
};

export const ZeroCount: Story = {
  args: {
    count: 0,
    appearance: 'filled',
  },
};
