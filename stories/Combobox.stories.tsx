import type { Meta, StoryObj } from '@storybook/react';
import { Combobox, Option } from '../src';

const meta = {
  title: 'Input/Combobox',
  component: Combobox,
  argTypes: {
    disabled: { control: 'boolean' },
    freeform: { control: 'boolean' },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select a fruit...',
    style: { width: 250 },
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="apple">Apple</Option>
      <Option value="banana">Banana</Option>
      <Option value="cherry">Cherry</Option>
      <Option value="grape">Grape</Option>
      <Option value="orange">Orange</Option>
    </Combobox>
  ),
};

export const Freeform: Story = {
  args: {
    placeholder: 'Type or select...',
    freeform: true,
    style: { width: 250 },
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="red">Red</Option>
      <Option value="green">Green</Option>
      <Option value="blue">Blue</Option>
    </Combobox>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
    style: { width: 250 },
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="a">Alpha</Option>
    </Combobox>
  ),
};
