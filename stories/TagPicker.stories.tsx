import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Field, TagPicker } from '../src';

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry' },
  { value: 'fig', label: 'Fig' },
  { value: 'grape', label: 'Grape' },
];

const meta = {
  title: 'Components/Input/TagPicker',
  component: TagPicker,
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    options: fruitOptions,
    'aria-label': 'Fruits',
    onValueChange: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof TagPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select fruits...',
  },
};

export const WithPreselected: Story = {
  args: {
    defaultValue: ['apple', 'cherry'],
    placeholder: 'Select fruits...',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: ['banana'],
    disabled: true,
  },
};

/** Read-only: the tags are shown without remove buttons and the option list stays closed. */
export const ReadOnly: Story = {
  args: {
    defaultValue: ['apple', 'cherry'],
    readOnly: true,
  },
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select fruits...',
  },
  render: (args) => (
    <Field label="Fruits" error="Pick at least one fruit." required>
      <TagPicker {...args} />
    </Field>
  ),
};
