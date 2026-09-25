import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ColorPicker } from '../src';

const meta = {
  title: 'Components/Input/ColorPicker',
  component: ColorPicker,
  argTypes: {
    showOpacity: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Brand color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The opacity slider edits the alpha byte of the value (`#rrggbbaa`). */
export const WithOpacity: Story = {
  args: {
    showOpacity: true,
    defaultValue: '#0f6cbdcc', // wave-allow-color: fixture
  },
};

/** Presets given as `{ color, label }` are announced by name instead of their hex code. */
export const CustomPresets: Story = {
  args: {
    presets: [
      { color: '#ff6b6b', label: 'Coral' }, // wave-allow-color: fixture
      { color: '#ffa94d', label: 'Tangerine' }, // wave-allow-color: fixture
      { color: '#ffd43b', label: 'Sunflower' }, // wave-allow-color: fixture
      { color: '#69db7c', label: 'Mint' }, // wave-allow-color: fixture
      { color: '#4dabf7', label: 'Sky' }, // wave-allow-color: fixture
      { color: '#9775fa', label: 'Lavender' }, // wave-allow-color: fixture
    ],
    defaultValue: '#ff6b6b', // wave-allow-color: fixture
  },
};

export const NoPresets: Story = {
  args: {
    presets: [],
    defaultValue: '#242424', // wave-allow-color: fixture
  },
};

/** Controlled: the parent owns `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  args: {
    showOpacity: true,
  },
  render: function ControlledStory(args) {
    const [color, setColor] = useState('#0f6cbd'); // wave-allow-color: fixture
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-body-1 text-foreground">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded border border-border"
            style={{ backgroundColor: color }}
          />
          Color: {color}
        </p>
        <ColorPicker
          {...args}
          value={color}
          onValueChange={(next) => {
            setColor(next);
            args.onValueChange?.(next);
          }}
        />
      </div>
    );
  },
};
