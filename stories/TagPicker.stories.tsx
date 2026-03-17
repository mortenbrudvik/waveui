import type { Meta, StoryObj } from '@storybook/react';
import { TagPicker } from '../src';

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
} satisfies Meta<typeof TagPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options: fruitOptions,
    placeholder: 'Select fruits...',
  },
};

export const WithPreselected: Story = {
  args: {
    options: fruitOptions,
    defaultValue: ['apple', 'cherry'],
    placeholder: 'Select fruits...',
  },
};

export const Disabled: Story = {
  args: {
    options: fruitOptions,
    defaultValue: ['banana'],
    disabled: true,
  },
};
