import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Rating, RatingDisplay } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Input/Rating',
  component: Rating,
  argTypes: {
    max: { control: { type: 'number', min: 1, max: 10 } },
    ...sizeArgType,
  },
  args: {
    onValueChange: fn(),
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

/** Small stars keep a 24×24px target through padding. */
export const Small: Story = {
  args: {
    defaultValue: 2,
    size: 'extra-small',
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

/** A custom accessible name replaces the default "Rating". */
export const Labelled: Story = {
  args: {
    'aria-label': 'Product quality',
    defaultValue: 4,
  },
};

/** A fractional value (an average) is drawn with a partly filled star. */
export const ReadOnly: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RatingDisplay value={5} size="small" />
      <RatingDisplay value={3} size="medium" />
      <RatingDisplay value={4.6} size="medium" />
      <RatingDisplay value={1} size="large" />
    </div>
  ),
};
