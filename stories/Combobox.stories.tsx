import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Combobox, Field, Option, OptionGroup } from '../src';

const meta = {
  title: 'Components/Input/Combobox',
  component: Combobox,
  argTypes: {
    disabled: { control: 'boolean' },
    freeform: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Fruit',
    onValueChange: fn(),
    onOpenChange: fn(),
    style: { width: 250 },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select a fruit...',
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
    'aria-label': 'Color',
    placeholder: 'Type or select...',
    freeform: true,
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="red">Red</Option>
      <Option value="green">Green</Option>
      <Option value="blue">Blue</Option>
    </Combobox>
  ),
};

export const Grouped: Story = {
  args: {
    'aria-label': 'Produce',
    placeholder: 'Search produce...',
  },
  render: (args) => (
    <Combobox {...args}>
      <OptionGroup label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
      </OptionGroup>
      <OptionGroup label="Vegetables">
        <Option value="carrot">Carrot</Option>
        <Option value="pea" disabled>
          Pea (out of stock)
        </Option>
      </OptionGroup>
    </Combobox>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="a">Alpha</Option>
    </Combobox>
  ),
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select a fruit...',
  },
  render: (args) => (
    <Field label="Fruit" error="Choose a fruit from the list." required>
      <Combobox {...args}>
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
      </Combobox>
    </Field>
  ),
};
