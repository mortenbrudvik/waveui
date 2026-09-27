import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import type { HsvColor } from '../src';
// Module paths until the color parts join the barrels (INTEGRATION, spec §0.2 rule 25).
import { ColorArea } from '../src/components/input/ColorArea';
import { ColorSlider } from '../src/components/input/ColorSlider';
import { hsvToHex } from '../src/lib/color';

const meta = {
  title: 'Components/Input/ColorArea',
  component: ColorArea,
  args: {
    'aria-label': 'Accent color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The parent owns an `HsvColor`; a hue slider and the area edit the same value. */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [color, setColor] = useState<HsvColor>({ h: 208, s: 0.92, v: 0.74 });
    return (
      <div className="flex w-64 flex-col gap-3">
        <ColorArea
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
        <ColorSlider value={color} onValueChange={setColor} />
        <p className="text-body-1 text-foreground">{hsvToHex(color)}</p>
      </div>
    );
  },
};

export const Square: Story = {
  args: { shape: 'square' },
};

export const Disabled: Story = {
  args: { disabled: true },
};
