import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, MessageBar, MessageBarGroup } from '../src';
import type { MessageBarGroupProps, MessageBarProps, MotionSlot } from '../src';
import { motionCases } from './_motion';

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

/** A message of the group stories. */
interface GroupMessage {
  id: number;
  status: NonNullable<MessageBarProps['status']>;
  text: string;
}

const groupMessages: readonly GroupMessage[] = [
  { id: 1, status: 'error', text: 'The upload of report.pdf failed.' },
  { id: 2, status: 'warning', text: 'Your storage is almost full.' },
  { id: 3, status: 'success', text: 'Your profile was saved.' },
];

/**
 * A MessageBarGroup of dismissible bars, keyed by their id, and a button that adds a bar at the
 * top. The story's args go to every bar, except `status` and `children`, which each message sets.
 */
function MessageBarGroupDemo({
  args: { status: _status, children: _children, onDismiss, ...barArgs },
  label,
  animate,
  motion,
}: {
  args: MessageBarProps;
  label: string;
  animate?: MessageBarGroupProps['animate'];
  motion?: MotionSlot | null;
}) {
  const [messages, setMessages] = React.useState(groupMessages);
  const [nextId, setNextId] = React.useState(groupMessages.length + 1);
  const addMessage = () => {
    setMessages((current) => [
      { id: nextId, status: 'info', text: `Message ${nextId}: a colleague shared a file.` },
      ...current,
    ]);
    setNextId((id) => id + 1);
  };
  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button size="small" onClick={addMessage}>
          {`Add a message (${label})`}
        </Button>
        <Button size="small" appearance="subtle" onClick={() => setMessages(groupMessages)}>
          {`Reset (${label})`}
        </Button>
      </div>
      <MessageBarGroup animate={animate} motion={motion}>
        {messages.map((message) => (
          <MessageBar
            key={message.id}
            {...barArgs}
            status={message.status}
            onDismiss={() => {
              onDismiss?.();
              setMessages((current) => current.filter(({ id }) => id !== message.id));
            }}
          >
            {message.text}
          </MessageBar>
        ))}
      </MessageBarGroup>
    </div>
  );
}

/**
 * `MessageBarGroup` stacks MessageBars with an 8px gap and animates the ones it loses: dismiss a
 * bar and it fades out while its row closes, over 250ms, so the bars below glide up instead of
 * jumping. With `animate="exit-only"`, the default, a bar added later appears at once. Give every
 * bar a stable `key`: the group follows its children by key and keeps a removed bar, `inert`, in
 * its place while it exits. Focus on a bar's Dismiss button moves to the next bar's. Bars present
 * when the group mounts never animate. MessageBarGroup is a component of its own, so a page that
 * imports only MessageBar does not load its motion.
 */
export const GroupExitOnly: Story = {
  args: { onDismiss: fn() },
  render: (args) => <MessageBarGroupDemo args={args} label="exit only" />,
};

/** `animate="both"`: a bar added after mount also opens its row and fades in, over 250ms. */
export const GroupAnimateBoth: Story = {
  args: { onDismiss: fn() },
  render: (args) => <MessageBarGroupDemo args={args} label="both" animate="both" />,
};

/** The GroupMotion story's bars: they fade while their row opens and closes, over 400ms. */
const slowFadeAndCollapse =
  'transition-[grid-template-rows,margin-bottom,opacity] duration-wave-slower ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0';

/**
 * `MessageBarGroup motion`, on the element around each bar (`wave-message-bar-group__item`), with
 * `animate="both"`. `null` turns the motion off (bars come and go at once); a class string
 * replaces the motion of both directions (here a slower fade and collapse). The negative bottom
 * margin makes up for the group's 8px gap, so nothing jumps when a bar unmounts. Under reduced
 * motion bars come and go at once.
 */
export const GroupMotion: Story = {
  args: { onDismiss: fn() },
  render: (args) => (
    <div className="flex flex-col gap-8">
      {motionCases(slowFadeAndCollapse).map(({ label, motion }) => (
        <MessageBarGroupDemo
          key={label}
          args={args}
          label={label.toLowerCase()}
          animate="both"
          motion={motion}
        />
      ))}
    </div>
  ),
};
