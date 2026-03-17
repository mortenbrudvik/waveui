import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from '../src';

const meta = {
  title: 'Components/Input/Textarea',
  component: Textarea,
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter your message...',
  },
};

export const Error: Story = {
  args: {
    placeholder: 'Description',
    error: 'Description is required',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
};
