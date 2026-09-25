import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Drawer, Toast, Toaster, useToastController } from '../src';
import type { ToastProps } from '../src';

const meta = {
  title: 'Components/Feedback/Toast',
  component: Toast,
  args: {
    title: 'Notification',
    status: 'info',
    children: 'This is an informational message.',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info'],
    },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keeps the toast's visibility in local state so dismissing it actually removes it. */
function DismissibleToast(props: ToastProps) {
  const { onDismiss, ...rest } = props;
  const [visible, setVisible] = React.useState(true);
  if (!visible) {
    return (
      <Button appearance="subtle" size="small" onClick={() => setVisible(true)}>
        Show the toast again
      </Button>
    );
  }
  return (
    <Toast
      {...rest}
      onDismiss={() => {
        onDismiss?.();
        setVisible(false);
      }}
    />
  );
}

/** Screen readers hear "Info:" before the title (visually hidden status text). */
export const Default: Story = {};

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
    children: 'Click the X to dismiss.',
    onDismiss: fn(),
  },
  render: (args) => <DismissibleToast {...args} />,
};

/** Dispatches toasts built from the story args, plus a persistent toast replaced by id. */
function ToasterDemo({ status, title, children, statusLabel }: ToastProps) {
  const { dispatchToast, dismissToast } = useToastController();
  const body = typeof children === 'string' ? children : undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        appearance="primary"
        onClick={() => dispatchToast({ status, title: title ?? 'Notification', body, statusLabel })}
      >
        Show toast
      </Button>
      <Button onClick={() => dispatchToast({ toastId: 'upload', title: 'Uploading…', timeout: 0 })}>
        Start upload
      </Button>
      <Button
        onClick={() =>
          dispatchToast({ toastId: 'upload', status: 'success', title: 'Upload complete' })
        }
      >
        Finish upload
      </Button>
      <Button onClick={() => dismissToast('upload')}>Cancel upload</Button>
    </div>
  );
}

/**
 * `<Toaster>` wraps the app and provides `useToastController()`. Toasts appear at the bottom end
 * (the right in LTR, the left in RTL), pause while hovered or focused, and are announced through
 * the Toaster's permanent live regions.
 */
export const ToasterExample: Story = {
  args: {
    title: 'Saved',
    status: 'success',
    children: 'Your changes were saved.',
  },
  render: (args) => (
    <Toaster>
      <ToasterDemo {...args} />
    </Toaster>
  ),
};

/** Logical positions follow the writing direction: `top-start` is the top left in LTR. */
export const ToasterTopStart: Story = {
  args: {
    title: 'Heads up',
    status: 'warning',
    children: 'Toasts appear at the top start corner.',
  },
  render: (args) => (
    <Toaster position="top-start">
      <ToasterDemo {...args} />
    </Toaster>
  ),
};

/** Dispatches a burst of five toasts built from the story args. */
function BurstDemo({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  const body = typeof children === 'string' ? children : undefined;
  return (
    <Button
      appearance="primary"
      onClick={() => {
        for (let count = 1; count <= 5; count += 1) {
          dispatchToast({ status, title: `${title ?? 'Notification'} (${count} of 5)`, body });
        }
      }}
    >
      Show five toasts
    </Button>
  );
}

/**
 * `limit={3}` shows at most three toasts at once. A burst of five shows three; the other two wait
 * in dispatch order, unannounced and without a running timer, and appear as shown toasts go.
 */
export const Limit: Story = {
  args: {
    title: 'File uploaded',
    status: 'success',
    children: 'The file is ready to share.',
  },
  render: (args) => (
    <Toaster limit={3}>
      <BurstDemo {...args} />
    </Toaster>
  ),
};

/** Shows three persistent toasts, and removes every toast with `dismissAllToasts()`. */
function DismissAllDemo({ status, title, children }: ToastProps) {
  const { dispatchToast, dismissAllToasts } = useToastController();
  const body = typeof children === 'string' ? children : undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        appearance="primary"
        onClick={() => {
          for (let count = 1; count <= 3; count += 1) {
            dispatchToast({
              status,
              title: `${title ?? 'Notification'} (${count} of 3)`,
              body,
              timeout: 0,
            });
          }
        }}
      >
        Show three toasts
      </Button>
      <Button onClick={() => dismissAllToasts()}>Dismiss all</Button>
    </div>
  );
}

/**
 * `dismissAllToasts()` from `useToastController()` removes every toast, shown and queued, and
 * cancels their timers (for example when the user signs out or leaves the page's context).
 */
export const DismissAll: Story = {
  args: {
    title: 'Sync conflict',
    status: 'warning',
    children: 'Review the changed files.',
  },
  render: (args) => (
    <Toaster>
      <DismissAllDemo {...args} />
    </Toaster>
  ),
};

/** A Drawer whose Notify button shows a persistent toast while the drawer is open. */
function DrawerWithToasts({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  const body = typeof children === 'string' ? children : undefined;
  return (
    <Drawer title="Filters">
      <Drawer.Trigger>
        <Button appearance="primary">Open drawer</Button>
      </Drawer.Trigger>
      <p>Toasts shown while the drawer is open sit beside it and never cover its actions.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          onClick={() =>
            dispatchToast({ status, title: title ?? 'Notification', body, timeout: 0 })
          }
        >
          Notify
        </Button>
        <Drawer.Close>
          <Button appearance="primary">Apply</Button>
        </Drawer.Close>
      </div>
    </Drawer>
  );
}

/**
 * While a Drawer (or another modal panel) is open on the toasts' side, the toasts move beside it,
 * so they never hide its focused controls. Tab reaches them from inside the drawer.
 */
export const ToasterBesideDrawer: Story = {
  args: {
    title: 'Filters saved',
    status: 'success',
    children: 'Dismiss this toast with its button.',
  },
  render: (args) => (
    <Toaster>
      <DrawerWithToasts {...args} />
    </Toaster>
  ),
};
