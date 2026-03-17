import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Popover, Button } from '../src';

const meta = {
  title: 'Components/Overlays/Popover',
  component: Popover,
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <Popover.Trigger>
        <Button>Show Popover</Button>
      </Popover.Trigger>
      <Popover.Content>
        <p style={{ margin: 0, fontWeight: 600 }}>Popover Title</p>
        <p style={{ margin: '8px 0 0' }}>This is the popover content with additional details.</p>
      </Popover.Content>
    </Popover>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Trigger>
            <Button appearance="primary">Toggle Popover</Button>
          </Popover.Trigger>
          <Popover.Content>
            <p style={{ margin: 0 }}>This popover is controlled via state.</p>
            <Button
              appearance="subtle"
              size="small"
              onClick={() => setOpen(false)}
              style={{ marginTop: 8 }}
            >
              Close
            </Button>
          </Popover.Content>
        </Popover>
        <Button appearance="subtle" onClick={() => setOpen(!open)}>
          External Toggle
        </Button>
      </div>
    );
  },
};
