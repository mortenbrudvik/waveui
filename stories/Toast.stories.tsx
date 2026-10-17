import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Drawer, ProgressBar, Toast, Toaster, useToastController } from '../src';
import type { ToastProps } from '../src';
// Module path until the package entry exports it (wave C).
import { createToaster } from '../src/lib/toaster';

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

/** A decorative icon for the `icon` slot (it inherits the status color through currentColor). */
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a4 4 0 0 0-4 4v2.6L2.3 10.3a.5.5 0 0 0 .4.7h10.6a.5.5 0 0 0 .4-.7L12 7.6V5a4 4 0 0 0-4-4Zm0 14a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

/** Dispatches a Toast with a title, a body with a subtitle and a footer of actions. */
function PartsDemo({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      appearance="primary"
      onClick={() =>
        dispatchToast(
          <Toast status={status}>
            <Toast.Title>{title}</Toast.Title>
            <Toast.Body subtitle="2 minutes ago">{children}</Toast.Body>
            <Toast.Footer>
              <Toast.Close>
                <Button size="small">Open archive</Button>
              </Toast.Close>
              <Toast.Close>
                <Button size="small" appearance="subtle">
                  Later
                </Button>
              </Toast.Close>
            </Toast.Footer>
          </Toast>,
        )
      }
    >
      Show backup toast
    </Button>
  );
}

/**
 * `Toast.Title`, `Toast.Body` (with a `subtitle`) and `Toast.Footer`. The container is named
 * "Success: Backup complete" and described by the body; the footer's buttons are actions, so the
 * toast stays until it is dismissed.
 */
export const Parts: Story = {
  args: {
    status: 'success',
    title: 'Backup complete',
    children: 'All 128 files were copied to the archive.',
  },
  render: (args) => (
    <Toaster>
      <PartsDemo {...args} />
    </Toaster>
  ),
};

/** `Toast.Close` around an Undo button at the end of the title row: it calls `onDismiss`. */
export const TitleAction: Story = {
  args: { status: 'info', title: 'Message deleted', onDismiss: fn() },
  render: ({ title, ...args }) => (
    <DismissibleToast {...args}>
      <Toast.Title
        action={
          <Toast.Close>
            <Button size="small" appearance="subtle">
              Undo
            </Button>
          </Toast.Close>
        }
      >
        {title}
      </Toast.Title>
    </DismissibleToast>
  ),
};

/** `icon` replaces the status icon (decorative); `icon={null}` shows none. */
export const CustomIcon: Story = {
  args: { status: 'info', title: 'Reminder', children: 'Stand-up starts in 5 minutes.' },
  render: (args) => <Toast {...args} icon={<BellIcon />} />,
};

/**
 * A Toast with parts rendered in the page, not dispatched: it is its own live region
 * (`role="status"`, or `role="alert"` for `error`).
 */
export const Standalone: Story = {
  args: {
    status: 'warning',
    title: 'Storage almost full',
    children: 'You have used 95% of your storage.',
    onDismiss: fn(),
  },
  render: ({ title, children, ...args }) => (
    <DismissibleToast {...args}>
      <Toast.Title>{title}</Toast.Title>
      <Toast.Body>{children}</Toast.Body>
      <Toast.Footer>
        <Button size="small">Manage storage</Button>
      </Toast.Footer>
    </DismissibleToast>
  ),
};

/** Dispatches a rich Toast whose title holds an Undo action (in `Toast.Close`). */
function RichContentDemo({ status, title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  const [undone, setUndone] = React.useState(0);
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        appearance="primary"
        onClick={() =>
          dispatchToast(
            <Toast status={status}>
              <Toast.Title
                action={
                  <Toast.Close>
                    <Button
                      size="small"
                      appearance="subtle"
                      onClick={() => setUndone((count) => count + 1)}
                    >
                      Undo
                    </Button>
                  </Toast.Close>
                }
              >
                {title}
              </Toast.Title>
              <Toast.Body>{children}</Toast.Body>
            </Toast>,
          )
        }
      >
        Send email
      </Button>
      <p className="text-body-1 text-foreground">Undone {undone} times.</p>
    </div>
  );
}

/**
 * `dispatchToast(<Toast>…</Toast>)` shows rich content. The toast holds an action (Undo), so it
 * stays until it is dismissed: people using a screen reader, a switch or voice control need time
 * to reach it. Screen readers hear "Success: Email sent Your message was delivered. Undo" once.
 */
export const RichContent: Story = {
  args: { status: 'success', title: 'Email sent', children: 'Your message was delivered.' },
  render: (args) => (
    <Toaster>
      <RichContentDemo {...args} />
    </Toaster>
  ),
};

/** Dispatches content that renders no Toast, with its severity in the options. */
function CustomContentDemo({ status, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <Button
      onClick={() =>
        dispatchToast(
          <div className="flex flex-col items-start gap-2 rounded border border-border bg-background p-3 text-body-1 text-foreground shadow-4">
            {children}
            <Toast.Close>
              <Button size="small">Stay signed in</Button>
            </Toast.Close>
          </div>,
          { status },
        )
      }
    >
      Show custom content
    </Button>
  );
}

/**
 * Content without a `Toast`: the options' `status` gives it a visually hidden severity text, which
 * names the container and starts the announcement. It has no Dismiss button, so it carries a
 * `Toast.Close` (Escape and Delete dismiss it too).
 */
export const CustomContent: Story = {
  args: { status: 'warning', children: 'Your session expires in 5 minutes.' },
  render: (args) => (
    <Toaster>
      <CustomContentDemo {...args} />
    </Toaster>
  ),
};

/** Starts an upload toast (announced as "Upload started") and replaces it when it finishes. */
function ProgressToastDemo({ title, children }: ToastProps) {
  const { dispatchToast } = useToastController();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        appearance="primary"
        onClick={() =>
          dispatchToast(
            <Toast>
              <Toast.Title>{title}</Toast.Title>
              <Toast.Body subtitle={children}>
                <ProgressBar value={30} label="Upload progress" />
              </Toast.Body>
            </Toast>,
            { toastId: 'upload', timeout: 0, announcement: 'Upload started' },
          )
        }
      >
        Start upload
      </Button>
      <Button
        onClick={() =>
          dispatchToast({ toastId: 'upload', status: 'success', title: 'Upload complete' })
        }
      >
        Finish upload
      </Button>
    </div>
  );
}

/** `announcement` replaces the announced text of a toast whose visible text reads badly. */
export const ProgressToast: Story = {
  args: { title: 'Uploading report.pdf', children: '3 of 10 MB' },
  render: (args) => (
    <Toaster>
      <ProgressToastDemo {...args} />
    </Toaster>
  ),
};

/** Alt+Shift+N: a shortcut with modifiers (WCAG 2.1.4). */
const altShiftN = (event: KeyboardEvent) => event.altKey && event.shiftKey && event.code === 'KeyN';

/**
 * `shortcuts={{ focus: … }}`: Alt+Shift+N moves focus to the newest toast. Escape returns focus to
 * where it was and dismisses the toasts; Delete or Backspace dismisses the focused toast.
 */
export const KeyboardShortcut: Story = {
  args: { status: 'info', title: 'New comment', children: 'Ada replied to your review.' },
  render: (args) => (
    <Toaster shortcuts={{ focus: altShiftN }}>
      <div className="flex flex-col items-start gap-2">
        <p className="text-body-1 text-foreground">
          Show a toast, then press Alt+Shift+N to move focus to it.
        </p>
        <ToasterDemo {...args} />
      </div>
    </Toaster>
  ),
};

/** A handle created once at module scope, as an app keeps one next to its query client. */
const storyToaster = createToaster();

/** A plain function, no hook: code outside components dispatches through the handle. */
function notifyExportReady({ status, title, children }: ToastProps) {
  storyToaster.dispatchToast(
    <Toast status={status}>
      <Toast.Title>{title}</Toast.Title>
      <Toast.Body>{children}</Toast.Body>
    </Toast>,
  );
}

/**
 * `createToaster()` returns a handle that code outside components can call; `<Toaster toaster>`
 * binds it. The Export button calls a plain function that dispatches through the handle.
 */
export const FromOutsideReact: Story = {
  args: {
    status: 'success',
    title: 'Export ready',
    children: 'report.csv was saved to your downloads.',
  },
  render: (args) => (
    <Toaster toaster={storyToaster}>
      <Button appearance="primary" onClick={() => notifyExportReady(args)}>
        Export
      </Button>
    </Toaster>
  ),
};
