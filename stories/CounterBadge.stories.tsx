import type { Meta, StoryObj } from '@storybook/react';
import { CounterBadge } from '../src';

const meta = {
  title: 'Components/Data Display/CounterBadge',
  component: CounterBadge,
  argTypes: {
    appearance: {
      control: 'select',
      options: ['filled', 'outline'],
    },
  },
  args: {
    count: 5,
    appearance: 'filled',
  },
} satisfies Meta<typeof CounterBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: {
    appearance: 'outline',
  },
};

export const Overflow: Story = {
  args: {
    count: 150,
    overflowCount: 99,
  },
};

/** A count of 0 or less renders nothing. */
export const ZeroCount: Story = {
  args: {
    count: 0,
  },
};
