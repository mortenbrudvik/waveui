import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from '../src';

const meta = {
  title: 'Input/Dropdown',
  component: Dropdown,
  argTypes: {
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select an option',
    style: { width: 250 },
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
      <Dropdown.Option value="hamster">Hamster</Dropdown.Option>
    </Dropdown>
  ),
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'dog',
    style: { width: 250 },
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
    style: { width: 250 },
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="a">Alpha</Dropdown.Option>
    </Dropdown>
  ),
};
