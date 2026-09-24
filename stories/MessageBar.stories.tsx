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
