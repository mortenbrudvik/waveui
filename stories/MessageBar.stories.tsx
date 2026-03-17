import type { Meta, StoryObj } from '@storybook/react';
import { MessageBar } from '../src';

const meta = {
  title: 'Components/Feedback/MessageBar',
  component: MessageBar,
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
  },
} satisfies Meta<typeof MessageBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    status: 'info',
    children: 'This is an informational message.',
  },
};

export const Success: Story = {
  args: {
    status: 'success',
    children: 'Operation completed successfully.',
  },
};

export const Warning: Story = {
  args: {
    status: 'warning',
    children: 'Please review your input before continuing.',
  },
};

export const Error: Story = {
  args: {
    status: 'error',
    children: 'Something went wrong. Please try again.',
  },
};

export const Dismissible: Story = {
  args: {
    status: 'info',
    children: 'This message can be dismissed.',
    onDismiss: () => {},
  },
};
