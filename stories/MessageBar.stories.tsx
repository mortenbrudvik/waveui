import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, MessageBar } from '../src';
import type { MessageBarProps } from '../src';

const meta = {
  title: 'Components/Feedback/MessageBar',
  component: MessageBar,
  args: {
    status: 'info',
    children: 'This is an informational message.',
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error'],
    },
    layout: {
      control: 'select',
      options: ['auto', 'singleline', 'multiline'] satisfies readonly NonNullable<
        MessageBarProps['layout']
      >[],
    },
  },
} satisfies Meta<typeof MessageBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keeps the message bar's visibility in local state so dismissing it actually removes it. */
function DismissibleMessageBar(props: MessageBarProps) {
  const { onDismiss, ...rest } = props;
  const [visible, setVisible] = React.useState(true);
  if (!visible) {
    return (
      <Button appearance="subtle" size="small" onClick={() => setVisible(true)}>
        Show the message again
      </Button>
    );
  }
  return (
    <MessageBar
      {...rest}
      onDismiss={() => {
        onDismiss?.();
        setVisible(false);
      }}
    />
  );
}

/** Screen readers hear "Info:" before the message (visually hidden status text). */
export const Info: Story = {};

export const Success: Story = {
  args: {
    status: 'success',
    children: 'Operation completed successfully.',
  },
};

/** `warning` and `error` render `role="alert"`. */
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

/** The dismiss button is the MessageBar's own `<button type="button">`, named "Dismiss". */
export const Dismissible: Story = {
  args: {
    children: 'This message can be dismissed.',
    onDismiss: fn(),
  },
  render: (args) => <DismissibleMessageBar {...args} />,
};

/**
 * `dismiss` replaces only the content of the wired dismiss button; the button keeps
 * `type="button"` and `onDismiss`. The content is decorative (`aria-hidden`), so visible text
 * comes with a matching `aria-label`: the button's accessible name then contains its visible
 * label "Close" (WCAG 2.5.3 Label in Name). Icon content needs no label (the name stays "Dismiss").
 */
export const CustomDismissContent: Story = {
  args: {
    status: 'warning',
    children: 'Your session expires in 5 minutes.',
    onDismiss: fn(),
    dismiss: {
      children: 'Close',
      'aria-label': 'Close',
      className: 'px-1 text-caption-1 font-semibold',
    },
  },
  render: (args) => <DismissibleMessageBar {...args} />,
};

/** `statusLabel` translates the visually hidden status text. */
export const LocalizedStatus: Story = {
  args: {
    status: 'success',
    statusLabel: 'Erfolg:',
    children: 'Die Änderungen wurden gespeichert.',
    lang: 'de',
  },
};

/**
 * `MessageBar.Title` is read right after the severity: "Warning: Update available A new version is
 * ready to install."
 */
export const WithTitle: Story = {
  args: {
    status: 'warning',
    children: (
      <>
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
      </>
    ),
  },
};

/**
 * `MessageBar.Actions` sit after the text while it fits on one line (`layout="auto"`, the default)
 * and move under it otherwise. Tab reaches the links of the text, the actions, then the Dismiss
 * button.
 */
export const WithActions: Story = {
  args: {
    status: 'error',
    onDismiss: fn(),
    children: (
      <>
        <MessageBar.Title>Upload failed</MessageBar.Title>The file is larger than 10 MB.
        <MessageBar.Actions>
          <Button size="small">Retry</Button>
          <Button size="small" appearance="subtle">
            Details
          </Button>
        </MessageBar.Actions>
      </>
    ),
  },
  render: (args) => <DismissibleMessageBar {...args} />,
};

/** `layout="multiline"`: the actions always get a row of their own under the text. */
export const Multiline: Story = {
  args: {
    status: 'success',
    layout: 'multiline',
    children: (
      <>
        <MessageBar.Title>Backup complete</MessageBar.Title>All 1,204 files were copied to the
        archive.
        <MessageBar.Actions>
          <Button size="small">Open archive</Button>
        </MessageBar.Actions>
      </>
    ),
  },
};

/**
 * `layout="auto"` measures after mount: narrow the container (drag its lower corner) and the actions
 * move under the text once it no longer fits on one line; widen it and they come back. The text is
 * never cut off.
 */
export const Reflow: Story = {
  args: {
    status: 'warning',
    children: (
      <>
        <MessageBar.Title>Storage almost full</MessageBar.Title>You have used 9.6 GB of your 10 GB
        plan.
        <MessageBar.Actions>
          <Button size="small">Upgrade</Button>
          <Button size="small" appearance="subtle">
            Manage files
          </Button>
        </MessageBar.Actions>
      </>
    ),
  },
  render: (args) => (
    <div className="w-[720px] min-w-[240px] max-w-full resize-x overflow-hidden p-1">
      <MessageBar {...args} />
    </div>
  ),
};

/**
 * A notice that stays on the page: `role="region"` makes it a landmark named by its severity and
 * title ("Warning: Maintenance tonight"). With the default roles the bar is a live region, and the
 * title is read as the start of its content instead.
 */
export const RegionNotice: Story = {
  args: {
    status: 'warning',
    role: 'region',
    children: (
      <>
        <MessageBar.Title>Maintenance tonight</MessageBar.Title>The service is unavailable from
        22:00 to 23:00 UTC.
      </>
    ),
  },
};
