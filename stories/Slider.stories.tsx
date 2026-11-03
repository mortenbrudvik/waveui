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

export const Sizes: Story = {
  render: (args) => (
    <div className="grid gap-4">
      <Slider {...args} size="small" defaultValue={30} aria-label="Small volume" />
      <Slider {...args} size="medium" defaultValue={60} aria-label="Medium volume" />
    </div>
  ),
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

/**
 * `orientation="vertical"` runs the rail up with the minimum at the bottom (Fluent UI's
 * `vertical`). The slider is as wide as its thumb and 8rem tall; give it another height with
 * `className`.
 */
export const Vertical: Story = {
  render: (args) => (
    <div className="flex items-end gap-8">
      <Slider {...args} orientation="vertical" size="small" aria-label="Small volume" />
      <Slider {...args} orientation="vertical" aria-label="Medium volume" />
      <Slider {...args} orientation="vertical" className="h-48" aria-label="Tall volume" />
      <Slider {...args} orientation="vertical" disabled aria-label="Disabled volume" />
    </div>
  ),
};
