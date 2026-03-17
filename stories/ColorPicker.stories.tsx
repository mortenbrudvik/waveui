import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ColorPicker } from '../src';

const meta = {
  title: 'Input/ColorPicker',
  component: ColorPicker,
  argTypes: {
    showOpacity: { control: 'boolean' },
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithOpacity: Story = {
  args: {
    showOpacity: true,
  },
};

export const CustomPresets: Story = {
  args: {
    presets: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'],
    defaultValue: '#ff6b6b',
  },
};

export const Controlled: Story = {
  render: () => {
    const [color, setColor] = React.useState('#0f6cbd');
    return (
      <div>
        <p style={{ marginBottom: 8 }}>
          Color: <span style={{ color }}>{color}</span>
        </p>
        <ColorPicker value={color} onChange={setColor} showOpacity />
      </div>
    );
  },
};

export const NoPresets: Story = {
  args: {
    presets: [],
    defaultValue: '#242424',
  },
};
