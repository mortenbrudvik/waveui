import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Drawer, Button, Tooltip } from '../src';
import type { DrawerPosition } from '../src';

const positions = ['start', 'end', 'left', 'right'] as const satisfies readonly DrawerPosition[];

/**
 * The description of the autodocs page: the JSDoc of the exported `Drawer` const in
 * src/components/overlays/Drawer.tsx, repeated here. Storybook's docgen (react-docgen) reads the
 * docblock of the function passed to `Object.assign`, not the one on the export, where the JSDoc
 * has to sit to reach the published declarations. Remove this (and the `docs.description`
 * parameter) once the Storybook docgen falls back to the docblock of the export.
 */
const componentDescription = [
  'A modal panel attached to a side of the screen (Fluent UI v2 style), rendered in a portal (inheriting the WaveProvider theme) while open.',
  '',
  '- **Opening**: controlled (`open`), or uncontrolled with a `Drawer.Trigger` placed directly inside the Drawer or in a Fragment there (it renders in place, outside the panel).',
  '- **Modal**: focus moves into the panel and Tab stays inside it (toasts included), the rest of the page is `inert` (instead of `aria-modal`), and the page does not scroll.',
  '- **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on the backdrop (a drag that starts inside does not close it), the Close button and `Drawer.Close`. Focus returns to the first of these that can take focus: `finalFocusRef`, the element that had focus when the drawer opened, the trigger, an element next to where that opener was.',
  '- **Position**: `end` (default) and `start` follow the text direction.',
  '',
  'The sub-components are also exported under flat names (`DrawerTrigger`, `DrawerClose`, `DrawerTitle`) for React Server Components, which cannot use the dotted form; dotted access (`Drawer.Trigger`) needs a client file.',
].join('\n');

const meta = {
  title: 'Components/Overlays/Drawer',
  component: Drawer,
  parameters: {
    docs: { description: { component: componentDescription } },
  },
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

/** Attached to the end edge (the right in left-to-right layouts). */
export const Default: Story = {
  render: renderWithTrigger,
};

/** Attached to the start edge: the left in left-to-right layouts, the right in right-to-left ones. */
export const StartPosition: Story = {
  args: { position: 'start', title: 'Navigation' },
  render: renderWithTrigger,
};

/**
 * `Drawer.Trigger` must be a direct child of `Drawer` (a Fragment is fine): wrapped in another
 * element or component it becomes panel content, which exists only while the drawer is open. To
 * add a Tooltip, put it inside the trigger with a render-prop child, so the trigger props and the
 * description land on the same button.
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

/**
 * The parent owns `open`: its own button opens the drawer, and the drawer asks to close through
 * `onOpenChange` (Escape, the backdrop, the Close button, or the Done button inside the drawer).
 * The page outside is inert while the drawer is open, so the close action lives inside it.
 */
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
        <Button appearance="primary" onClick={() => handleOpenChange(true)}>
          Open
        </Button>
        {/* The story owns the controlled pair; every other arg is forwarded. */}
        <Drawer {...args} open={open} onOpenChange={handleOpenChange}>
          <p>{children}</p>
          <div className="mt-4 flex justify-end">
            <Button appearance="primary" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        </Drawer>
      </>
    );
  },
};
