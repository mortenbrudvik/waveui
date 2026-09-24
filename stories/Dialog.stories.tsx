import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dialog, Button } from '../src';

/** Stories that render the dialog open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
  args: {
    defaultOpen: false,
    onOpenChange: fn(),
    children: (
      <>
        <Dialog.Trigger>
          <Button appearance="primary">Open dialog</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Dialog title">
          <p>This is the dialog content. You can put any content here.</p>
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="subtle">Cancel</Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button appearance="primary">Confirm</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </>
    ),
  },
  argTypes: {
    children: { control: false },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Opens from `Dialog.Trigger`; the footer buttons close it through `Dialog.Close`. */
export const Default: Story = {};

/** Rendered open (`defaultOpen`). */
export const Open: Story = {
  args: { defaultOpen: true },
  parameters: openStoryParameters,
};

export const SmallSize: Story = {
  args: {
    children: (
      <>
        <Dialog.Trigger>
          <Button appearance="primary">Open small dialog</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Small dialog" size="small">
          <p>This is a small dialog with a maximum width of 400px.</p>
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="primary">OK</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </>
    ),
  },
};

/** A rich heading through `Dialog.Title` instead of the `title` prop. */
export const WithDialogTitle: Story = {
  args: {
    children: (
      <>
        <Dialog.Trigger>
          <Button appearance="primary">Delete file</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>
            Delete <em>report.pdf</em>?
          </Dialog.Title>
          <p>The file is moved to the recycle bin.</p>
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="subtle">Cancel</Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button appearance="primary">Delete</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </>
    ),
  },
};

/**
 * At a phone width the dialog takes the full width minus a 16px margin, never exceeds the viewport
 * height, and its body scrolls.
 */
export const NarrowViewport: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Dialog.Content title="Terms of service">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index} className="mb-2">
            Paragraph {index + 1}. The dialog body scrolls when the content is taller than the
            viewport, so the title, the Close button and the actions stay reachable.
          </p>
        ))}
        <Dialog.Footer>
          <Dialog.Close>
            <Button appearance="subtle">Decline</Button>
          </Dialog.Close>
          <Dialog.Close>
            <Button appearance="primary">Accept</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    ),
  },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: openStoryParameters,
};

/** The parent owns `open`; the dialog asks to close through `onOpenChange`. */
export const Controlled: Story = {
  render: function ControlledDialog(args) {
    const [open, setOpen] = React.useState(false);
    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      args.onOpenChange?.(next);
    };
    return (
      <>
        <Button appearance="primary" onClick={() => handleOpenChange(true)}>
          Open controlled dialog
        </Button>
        {/* The story owns the controlled pair; every other arg is forwarded. */}
        <Dialog {...args} open={open} onOpenChange={handleOpenChange}>
          <Dialog.Content title="Controlled dialog">
            <p>This dialog is controlled via state.</p>
            <Dialog.Footer>
              <Button appearance="subtle" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
      </>
    );
  },
};
