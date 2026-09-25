import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dropdown, Field } from '../src';

const meta = {
  title: 'Components/Input/Dropdown',
  component: Dropdown,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Pet',
    onValueChange: fn(),
    onOpenChange: fn(),
    style: { width: 250 },
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select an option',
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
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

/** `clearable` adds a clear button while a value is selected, a tab stop after the combobox. */
export const Clearable: Story = {
  args: {
    defaultValue: 'dog',
    clearable: true,
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

export const Grouped: Story = {
  args: {
    'aria-label': 'Animal',
    placeholder: 'Select an animal',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.OptionGroup label="Mammals">
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown.OptionGroup>
      <Dropdown.OptionGroup label="Fish">
        <Dropdown.Option value="goldfish">Goldfish</Dropdown.Option>
        <Dropdown.Option value="shark" disabled>
          Shark (not available)
        </Dropdown.Option>
      </Dropdown.OptionGroup>
    </Dropdown>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="a">Alpha</Dropdown.Option>
    </Dropdown>
  ),
};

/** Invalid state through a Field error (the Field labels and describes the button). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select a pet',
  },
  render: (args) => (
    <Field label="Pet" error="Choose a pet." required>
      <Dropdown {...args}>
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown>
    </Field>
  ),
};
