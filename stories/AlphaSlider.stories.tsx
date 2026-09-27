import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
// Module path until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { AlphaSlider } from '../src/components/input/AlphaSlider';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/AlphaSlider',
  component: AlphaSlider,
  argTypes: {
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
