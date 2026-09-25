import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Slider } from '../src';

const meta = {
  title: 'Components/Input/Slider',
  component: Slider,
  args: {
    label: 'Volume',
    defaultValue: 50,
    onValueChange: fn(),
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MinMax: Story = {
  args: {
    label: 'Temperature',
    min: 0,
    max: 100,
    defaultValue: 25,
  },
};

export const WithStep: Story = {
  args: {
    label: 'Quantity',
    min: 0,
    max: 50,
    step: 5,
    defaultValue: 10,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Brightness',
    disabled: true,
  },
};

/**
 * Under `dir="rtl"` the minimum is on the right, so the rail fills from the right up to the
 * thumb.
 */
export const RightToLeft: Story = {
  args: {
    defaultValue: 30,
  },
  render: (args) => (
    <div dir="rtl" className="w-64">
      <Slider {...args} />
    </div>
  ),
};
