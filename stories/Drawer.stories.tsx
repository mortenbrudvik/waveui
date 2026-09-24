import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Drawer, Button, Tooltip } from '../src';
import type { DrawerPosition } from '../src/components/overlays/Drawer';

const positions = ['start', 'end', 'left', 'right'] as const satisfies readonly DrawerPosition[];

const meta = {
  title: 'Components/Overlays/Drawer',
  component: Drawer,
  args: {
    defaultOpen: false,
    position: 'end',
    title: 'Filters',
    onOpenChange: fn(),
    children: 'Choose the filters to apply to the list.',
  },
  argTypes: {
    position: { control: 'select', options: positions },
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An uncontrolled drawer with `Drawer.Trigger` (rendered in place) and a `Drawer.Close` action. */
function renderWithTrigger({ children, ...args }: React.ComponentProps<typeof Drawer>) {
  return (
    <Drawer {...args}>
      <Drawer.Trigger>
        <Button appearance="primary">Open drawer</Button>
      </Drawer.Trigger>
      <p>{children}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Drawer.Close>
          <Button appearance="primary">Apply</Button>
        </Drawer.Close>
      </div>
    </Drawer>
  );
}

/** Slides in at the end edge (the right in left-to-right layouts). */
export const Default: Story = {
  render: renderWithTrigger,
};

/** Attached to the start edge: the left in left-to-right layouts, the right in right-to-left ones. */
export const StartPosition: Story = {
  args: { position: 'start', title: 'Navigation' },
  render: renderWithTrigger,
};

/**
 * `Drawer.Trigger` must be a direct child of `Drawer`: wrapped in another component it becomes
 * panel content, which exists only while the drawer is open. To add a Tooltip, put it inside the
 * trigger with a render-prop child, so the trigger props and the description land on the same
 * button.
 */
export const TriggerWithTooltip: Story = {
  render: function TriggerWithTooltipDrawer({ children, ...args }) {
    return (
      <Drawer {...args}>
        <Drawer.Trigger>
          {(triggerProps) => (
            <Tooltip content="Narrow the list">
              <Button appearance="primary" {...triggerProps}>
                Open drawer
              </Button>
            </Tooltip>
          )}
        </Drawer.Trigger>
        <p>{children}</p>
      </Drawer>
    );
  },
};

/** The parent owns `open`; buttons outside the drawer open and close it. */
export const Controlled: Story = {
  args: { position: 'start', title: 'Start drawer' },
  render: function ControlledDrawer({ children, ...args }) {
    const [open, setOpen] = React.useState(false);
    const handleOpenChange = (next: boolean) => {
      setOpen(next);
      args.onOpenChange?.(next);
    };
    return (
      <>
        <div className="flex gap-2">
          <Button appearance="primary" onClick={() => handleOpenChange(true)}>
            Open
          </Button>
          <Button appearance="subtle" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </div>
        {/* The story owns the controlled pair; every other arg is forwarded. */}
        <Drawer {...args} open={open} onOpenChange={handleOpenChange}>
          <p>{children}</p>
        </Drawer>
      </>
    );
  },
};
