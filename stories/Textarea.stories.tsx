import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Textarea } from '../src';

const meta = {
  title: 'Components/Input/Textarea',
  component: Textarea,
  args: {
    'aria-label': 'Message',
    placeholder: 'Enter your message...',
    onChange: fn(),
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A string `error` renders the message after the textarea and links it to the textarea. */
export const Error: Story = {
  args: {
    'aria-label': 'Description',
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
