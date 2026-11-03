import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Field, Select } from '../src';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';

const meta = {
  title: 'Components/Input/Select',
  component: Select,
  argTypes: {
    ...coreSizeArgType,
    ...inputAppearanceArgType,
  },
  args: {
    'aria-label': 'Option',
    onChange: fn(),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <option value="">Select an option</option>
      <option value="a">Option A</option>
      <option value="b">Option B</option>
      <option value="c">Option C</option>
    </Select>
  ),
};

/** A string `error` renders the message after the select and links it to the select. */
export const Error: Story = {
  args: {
    error: 'Please select a value',
  },
  render: (args) => (
    <Select {...args}>
      <option value="">Select an option</option>
      <option value="a">Option A</option>
    </Select>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <Select {...args}>
      <option value="">Disabled</option>
    </Select>
  ),
};

/** Named by a Field label instead of `aria-label`. */
export const InField: Story = {
  args: {
    'aria-label': undefined,
    defaultValue: '',
  },
  render: (args) => (
    <Field label="Country" hint="Where you live today." required>
      <Select {...args}>
        <option value="" disabled>
          Choose a country
        </option>
        <option value="no">Norway</option>
        <option value="se">Sweden</option>
      </Select>
    </Field>
  ),
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <Select {...args} size={size} appearance={appearance} aria-label={`${size} ${appearance}`}>
          <option>Norway</option>
          <option>Sweden</option>
        </Select>
      )}
    />
  ),
};

/** `icon` replaces the drawn chevron; `false` hides it. The select keeps `ref` and `className`. */
export const CustomIcon: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Select
        {...args}
        aria-label="Sort by"
        icon={
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 8l5 5 5-5" />
          </svg>
        }
      >
        <option>Name</option>
        <option>Date</option>
      </Select>
      <Select {...args} aria-label="No chevron" icon={false}>
        <option>Name</option>
        <option>Date</option>
      </Select>
    </div>
  ),
};

/** `onValueChange` hands over the selected value, so a controlled select needs no event handler. */
export const Controlled: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('a');
    return (
      <div className="flex flex-col gap-2">
        <Select {...args} value={value} onValueChange={setValue}>
          <option value="a">Option A</option>
          <option value="b">Option B</option>
        </Select>
        <span className="text-wave-caption-1 text-wave-muted-foreground">Selected: {value}</span>
      </div>
    );
  },
};
