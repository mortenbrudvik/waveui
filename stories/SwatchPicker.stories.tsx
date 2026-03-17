import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SwatchPicker } from '../src';

const defaultItems = [
  { value: 'red', color: '#d13438', label: 'Red' },
  { value: 'blue', color: '#0f6cbd', label: 'Blue' },
  { value: 'green', color: '#107c10', label: 'Green' },
  { value: 'yellow', color: '#ffb900', label: 'Yellow' },
  { value: 'purple', color: '#5c2d91', label: 'Purple' },
  { value: 'teal', color: '#008272', label: 'Teal' },
  { value: 'pink', color: '#e3008c', label: 'Pink' },
  { value: 'black', color: '#242424', label: 'Black' },
];

const meta = {
  title: 'Input/SwatchPicker',
  component: SwatchPicker,
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    shape: { control: 'select', options: ['circular', 'square', 'rounded'] },
  },
} satisfies Meta<typeof SwatchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: defaultItems,
    defaultValue: 'blue',
  },
};

export const Square: Story = {
  args: {
    items: defaultItems,
    shape: 'square',
  },
};

export const Large: Story = {
  args: {
    items: defaultItems,
    size: 'large',
    shape: 'rounded',
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = React.useState('red');
    return (
      <div>
        <p style={{ marginBottom: 8 }}>Selected: {value}</p>
        <SwatchPicker items={defaultItems} value={value} onChange={setValue} />
      </div>
    );
  },
};
