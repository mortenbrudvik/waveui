import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Input } from '../src';

const meta = {
  title: 'Components/Input/Input',
  component: Input,
  args: {
    'aria-label': 'Name',
    placeholder: 'Enter text...',
    onValueChange: fn(),
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithContentBefore: Story = {
  args: {
    'aria-label': 'Search',
    placeholder: 'Search...',
    contentBefore: { children: '🔍', 'aria-hidden': true },
  },
};

export const WithContentAfter: Story = {
  args: {
    'aria-label': 'Weight',
    placeholder: '0',
    contentAfter: { children: 'kg' },
  },
};

/** A string `error` renders the message after the input and links it to the input. */
export const Error: Story = {
  args: {
    'aria-label': 'Email',
    placeholder: 'you@example.com',
    error: 'This field is required',
    defaultValue: '',
  },
};

/** `error={true}` marks the input invalid without a message (use a Field for the message). */
export const ErrorFlagOnly: Story = {
  args: {
    'aria-label': 'Email',
    placeholder: 'you@example.com',
    error: true,
  },
};

export const Disabled: Story = {
  args: {
    'aria-label': 'Disabled input',
    placeholder: 'Disabled',
    disabled: true,
  },
};
