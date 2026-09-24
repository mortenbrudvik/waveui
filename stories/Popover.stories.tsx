import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Popover, Button } from '../src';

const meta = {
  title: 'Components/Overlays/Popover',
  component: Popover,
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'bottom', 'start', 'end', 'left', 'right'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
  },
  args: {
    side: 'bottom',
    align: 'start',
    onOpenChange: fn(),
    children: (
      <>
        <Popover.Trigger>
          <Button>Show Popover</Button>
        </Popover.Trigger>
        <Popover.Content title="Popover title">
          This is the popover content with additional details.
        </Popover.Content>
      </>
    ),
  },
  render: (args) => <Popover {...args} />,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The content is named by its trigger when it has no `title`. */
export const LabelledByTrigger: Story = {
  args: {
    children: (
      <>
        <Popover.Trigger>
          <Button>Filters</Button>
        </Popover.Trigger>
        <Popover.Content>
          <p style={{ margin: 0 }}>Choose which items to show.</p>
        </Popover.Content>
      </>
    ),
  },
};

/** `side`/`align` place the content; it flips and shifts to stay inside the viewport. */
export const Placement: Story = {
  args: {
    side: 'top',
    align: 'center',
  },
};

/**
 * Controlled with an external toggle. The toggle is listed in `ignoreOutsideRefs`, so pressing it
 * while the popover is open closes it in one click (instead of an outside press followed by a
 * re-open).
 */
export const Controlled: Story = {
  render: ({ onOpenChange, ...args }) => {
    const [open, setOpen] = React.useState(false);
    const toggleRef = React.useRef<HTMLButtonElement>(null);
    const change = (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    };
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <Popover open={open} onOpenChange={change} ignoreOutsideRefs={[toggleRef]} {...args}>
          <Popover.Trigger>
            <Button appearance="primary">Toggle Popover</Button>
          </Popover.Trigger>
          <Popover.Content title="Controlled popover">
            <p style={{ margin: 0 }}>This popover is controlled via state.</p>
            <Button
              appearance="subtle"
              size="small"
              onClick={() => change(false)}
              style={{ marginTop: 8 }}
            >
              Close
            </Button>
          </Popover.Content>
        </Popover>
        <Button ref={toggleRef} appearance="subtle" onClick={() => change(!open)}>
          External Toggle
        </Button>
      </div>
    );
  },
};
