import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
// Module path until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { ColorSlider } from '../src/components/input/ColorSlider';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Input/ColorSlider',
  component: ColorSlider,
  argTypes: {
    ...orientationArgType,
    channel: { control: 'inline-radio', options: ['hue', 'saturation', 'value'] },
  },
  args: {
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorSlider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** From gray to the full color, at the color's brightness. */
export const Saturation: Story = {
  args: { channel: 'saturation', defaultValue: { h: 208, s: 0.6, v: 0.8 } },
};

/** From black to the color at full brightness (`channel="value"`, named "Brightness"). */
export const Brightness: Story = {
  args: { channel: 'value' },
};

/** Bottom to top; the arrow keys keep their direction in right-to-left layouts too. */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
};

/** Under `dir="rtl"` a horizontal rail runs from the right, and ArrowLeft increases. */
export const RightToLeft: Story = {
  render: (args) => (
    <div dir="rtl" className="w-64">
      <ColorSlider {...args} />
    </div>
  ),
};
