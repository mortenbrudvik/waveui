import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Toast, Toaster, useToastController } from '../src';

const meta = {
  title: 'Feedback/Toast',
  component: Toast,
  argTypes: {
    status: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Notification',
    status: 'info',
    children: 'This is an informational message.',
  },
};

export const Success: Story = {
  args: {
    title: 'Success',
    status: 'success',
    children: 'Operation completed successfully.',
  },
};

export const Warning: Story = {
  args: {
    title: 'Warning',
    status: 'warning',
    children: 'Please review the details.',
  },
};

export const Error: Story = {
  args: {
    title: 'Error',
    status: 'error',
    children: 'Something went wrong.',
  },
};

export const WithDismiss: Story = {
  args: {
    title: 'Dismissible',
    status: 'info',
    children: 'Click the X to dismiss.',
    onDismiss: () => {},
  },
};

function ToasterDemo() {
  const { dispatchToast } = useToastController();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => dispatchToast({ title: 'Success!', status: 'success', body: 'Task completed.', timeout: 3000 })}>
        Success
      </button>
      <button onClick={() => dispatchToast({ title: 'Warning', status: 'warning', body: 'Check input.', timeout: 3000 })}>
        Warning
      </button>
      <button onClick={() => dispatchToast({ title: 'Error', status: 'error', body: 'Failed.', timeout: 3000 })}>
        Error
      </button>
      <button onClick={() => dispatchToast({ title: 'Info', status: 'info', body: 'FYI.', timeout: 3000 })}>
        Info
      </button>
    </div>
  );
}

export const ToasterExample: Story = {
  render: () => (
    <Toaster position="bottom-right">
      <ToasterDemo />
    </Toaster>
  ),
};
