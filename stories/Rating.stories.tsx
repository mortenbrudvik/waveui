import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Rating, RatingDisplay } from '../src';

const meta = {
  title: 'Components/Input/Rating',
  component: Rating,
  argTypes: {
    max: { control: { type: 'number', min: 1, max: 10 } },
    size: {
      control: 'select',
      options: ['extra-small', 'small', 'medium', 'large', 'extra-large'],
    },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 3,
  },
};

export const Large: Story = {
  args: {
    defaultValue: 4,
    size: 'large',
  },
};

export const TenStars: Story = {
  args: {
    max: 10,
    defaultValue: 7,
  },
};

export const Disabled: Story = {
  args: {
    value: 3,
    disabled: true,
  },
};

export const ReadOnly: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RatingDisplay value={5} size="small" />
      <RatingDisplay value={3} size="medium" />
      <RatingDisplay value={1} size="large" />
    </div>
  ),
};
