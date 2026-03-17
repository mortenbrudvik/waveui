import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../src';

const meta = {
  title: 'Components/Input/Input',
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithContentBefore: Story = {
  args: {
    placeholder: 'Search...',
    contentBefore: { children: '🔍' },
  },
};

export const WithContentAfter: Story = {
  args: {
    placeholder: 'Email',
    contentAfter: { children: '📧' },
  },
};

export const Error: Story = {
  args: {
    placeholder: 'Invalid input',
    error: 'This field is required',
    defaultValue: '',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
};
