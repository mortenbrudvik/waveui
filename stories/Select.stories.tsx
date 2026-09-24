import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Field, Select } from '../src';

const meta = {
  title: 'Components/Input/Select',
  component: Select,
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
