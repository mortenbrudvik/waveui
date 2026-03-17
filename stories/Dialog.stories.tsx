import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, Button } from '../src';

const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Dialog.Content title="Dialog Title">
        <p>This is the dialog content. You can put any content here.</p>
        <Dialog.Footer>
          <Button appearance="subtle">Cancel</Button>
          <Button appearance="primary">Confirm</Button>
        </Dialog.Footer>
      </Dialog.Content>
    ),
  },
};

export const WithTrigger: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger>
        <Button appearance="primary">Open Dialog</Button>
      </Dialog.Trigger>
      <Dialog.Content title="Confirm Action">
        <p>Are you sure you want to proceed with this action?</p>
        <Dialog.Footer>
          <Button appearance="subtle">Cancel</Button>
          <Button appearance="primary">Confirm</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <Button appearance="primary" onClick={() => setOpen(true)}>
          Open Controlled Dialog
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <Dialog.Content title="Controlled Dialog">
            <p>This dialog is controlled via state.</p>
            <Dialog.Footer>
              <Button appearance="subtle" onClick={() => setOpen(false)}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      </>
    );
  },
};

export const SmallSize: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Dialog.Content title="Small Dialog" size="small">
        <p>This is a small dialog with reduced width.</p>
        <Dialog.Footer>
          <Button appearance="primary">OK</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};
