import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from '../src';

const meta = {
  title: 'Components/Input/Slider',
  component: Slider,
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Volume',
    defaultValue: 50,
  },
};

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
