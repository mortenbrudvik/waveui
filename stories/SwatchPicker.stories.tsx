import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SwatchPicker } from '../src';

const defaultItems = [
  { value: 'red', color: '#d13438', label: 'Red' }, // wave-allow-color: fixture
  { value: 'blue', color: '#0f6cbd', label: 'Blue' }, // wave-allow-color: fixture
  { value: 'green', color: '#107c10', label: 'Green' }, // wave-allow-color: fixture
  { value: 'yellow', color: '#ffb900', label: 'Yellow' }, // wave-allow-color: fixture
  { value: 'purple', color: '#5c2d91', label: 'Purple' }, // wave-allow-color: fixture
  { value: 'teal', color: '#008272', label: 'Teal' }, // wave-allow-color: fixture
  { value: 'pink', color: '#e3008c', label: 'Pink' }, // wave-allow-color: fixture
  { value: 'black', color: '#242424', label: 'Black' }, // wave-allow-color: fixture
];

const meta = {
  title: 'Components/Input/SwatchPicker',
  component: SwatchPicker,
  argTypes: {
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    shape: { control: 'select', options: ['circular', 'square', 'rounded'] },
  },
  args: {
    items: defaultItems,
    'aria-label': 'Accent color',
    onValueChange: fn(),
  },
} satisfies Meta<typeof SwatchPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One tab stop; arrow keys move and select. The selection shows a ring and a check glyph. */
export const Default: Story = {
  args: {
    defaultValue: 'blue',
  },
};

export const Square: Story = {
  args: {
    shape: 'square',
    defaultValue: 'yellow',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    shape: 'rounded',
    defaultValue: 'teal',
  },
};

/** Controlled: the parent owns `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [value, setValue] = useState('red');
    const selected = defaultItems.find((item) => item.value === value);
    return (
      <div className="flex flex-col gap-2">
        <p className="text-body-1 text-foreground">Selected: {selected?.label ?? 'none'}</p>
        <SwatchPicker
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
      </div>
    );
  },
};
