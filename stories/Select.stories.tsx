import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '../src';

const meta = {
  title: 'Components/Input/Select',
  component: Select,
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

export const Error: Story = {
  render: (args) => (
    <Select error="Please select a value" {...args}>
      <option value="">Select an option</option>
      <option value="a">Option A</option>
    </Select>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Select disabled {...args}>
      <option value="">Disabled</option>
    </Select>
  ),
};
