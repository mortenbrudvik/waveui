import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, MessageBar, MessageBarGroup } from '../src';
import type { MessageBarGroupProps, MessageBarProps } from '../src';
import { motionCases } from './_motion';

const meta = {
  title: 'Components/Feedback/MessageBarGroup',
  component: MessageBarGroup,
  args: {
    animate: 'exit-only',
  },
  argTypes: {
    animate: {
      control: 'inline-radio',
      options: ['exit-only', 'both'] satisfies readonly NonNullable<
        MessageBarGroupProps['animate']
      >[],
    },
    motion: { control: false },
    children: { control: false },
  },
} satisfies Meta<typeof MessageBarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A message of the stories. */
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
 * A MessageBarGroup of dismissible bars, keyed by their id, with a button that adds a bar at the
 * top and one that puts the first three back. The story's args go to the group.
 */
function MessageBarGroupDemo({ label, ...groupProps }: MessageBarGroupProps & { label: string }) {
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
      <MessageBarGroup {...groupProps}>
        {messages.map((message) => (
          <MessageBar
            key={message.id}
            status={message.status}
            onDismiss={() =>
              setMessages((current) => current.filter(({ id }) => id !== message.id))
            }
          >
            {message.text}
          </MessageBar>
        ))}
      </MessageBarGroup>
    </div>
  );
}

/**
 * Dismiss a bar: it fades out while its row closes, over 250ms, so the bars below glide up
 * instead of jumping. With `animate="exit-only"`, the default, a bar added later appears at once.
 * Every bar has a stable `key`, by which the group keeps a removed bar, `inert`, in its place while
 * it exits. Focus on a bar's Dismiss button moves to the next bar's. Bars present when the group
 * mounts never animate.
 */
export const ExitOnly: Story = {
  render: (args) => <MessageBarGroupDemo {...args} label="exit only" />,
};

/** `animate="both"`: a bar added after mount also opens its row and fades in, over 250ms. */
export const AnimateBoth: Story = {
  args: { animate: 'both' },
  render: (args) => <MessageBarGroupDemo {...args} label="both" />,
};

/** The Motion story's bars: they fade while their row opens and closes, over 400ms. */
const slowFadeAndCollapse =
  'transition-[grid-template-rows,margin-bottom,opacity] duration-wave-slower ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0';

/**
 * `motion`, on the element around each bar (`wave-message-bar-group__item`), here with
 * `animate="both"`. `null` turns the motion off (bars come and go at once); a class string
 * replaces the motion of both directions (here a slower fade and collapse). The negative bottom
 * margin makes up for the group's 8px gap, so nothing jumps when a bar unmounts. Under reduced
 * motion bars come and go at once.
 */
export const Motion: Story = {
  args: { animate: 'both' },
  render: (args) => (
    <div className="flex flex-col gap-8">
      {motionCases(slowFadeAndCollapse).map(({ label, motion }) => (
        // The story renders one group per case; every other arg is forwarded.
        <MessageBarGroupDemo key={label} {...args} label={label.toLowerCase()} motion={motion} />
      ))}
    </div>
  ),
};
