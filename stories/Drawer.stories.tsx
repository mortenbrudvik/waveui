import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Drawer, Button } from '../src';

const meta = {
  title: 'Components/Overlays/Drawer',
  component: Drawer,
  argTypes: {
    position: {
      control: 'select',
      options: ['left', 'right'],
    },
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button appearance="primary" onClick={() => setOpen(true)}>
          Open Drawer
        </Button>
        <Drawer open={open} onOpenChange={setOpen} title="Drawer Title">
          <p>This is the drawer content. It slides in from the right by default.</p>
        </Drawer>
      </>
    );
  },
};

export const RightPosition: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button appearance="primary" onClick={() => setOpen(true)}>
          Open Right Drawer
        </Button>
        <Drawer open={open} onOpenChange={setOpen} position="right" title="Right Drawer">
          <p>This drawer slides in from the right side.</p>
        </Drawer>
      </>
    );
  },
};

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button appearance="primary" onClick={() => setOpen(true)}>
            Open
          </Button>
          <Button appearance="subtle" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <Drawer open={open} onOpenChange={setOpen} position="left" title="Left Drawer">
          <p>This drawer is controlled externally. Use the buttons to open/close it.</p>
        </Drawer>
      </>
    );
  },
};
