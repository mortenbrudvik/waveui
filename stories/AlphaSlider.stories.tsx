import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { AlphaSlider } from '../src';
import { colorPickerShapeArgType, orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/AlphaSlider',
  component: AlphaSlider,
  argTypes: {
    ...colorPickerShapeArgType,
    ...orientationArgType,
    transparency: { control: 'boolean' },
  },
  args: {
    defaultValue: { h: 208, s: 0.92, v: 0.74, a: 0.6 },
    onValueChange: fn(),
  },
} satisfies Meta<typeof AlphaSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Shows transparency (100 % is fully transparent); `value.a` is still the opacity. */
export const Transparency: Story = {
  args: { transparency: true },
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
};
