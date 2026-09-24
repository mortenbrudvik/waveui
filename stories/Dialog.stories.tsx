import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dialog, Button } from '../src';

/** Stories that render the dialog open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

/**
 * The description of the autodocs page: the JSDoc of the exported `Dialog` const in
 * src/components/overlays/Dialog.tsx, repeated here. Storybook's docgen (react-docgen) reads the
 * docblock of the function passed to `Object.assign`, not the one on the export, where the JSDoc
 * has to sit to reach the published declarations. Remove this (and the `docs.description`
 * parameter) once the Storybook docgen falls back to the docblock of the export.
 */
const componentDescription = [
  'A modal dialog (Fluent UI v2 style): `Dialog` holds the open state; `Dialog.Trigger` opens it and `Dialog.Content` renders the surface in a portal while open.',
  '',
  '- **Modal**: focus moves into the dialog and Tab stays inside it (toasts included), the rest of the page is `inert` (instead of `aria-modal`, so toasts and live regions stay announced), and the page does not scroll.',
  '- **Closing**: Escape (only the topmost layer: a popup opened inside closes first), a click on the backdrop (a drag that starts inside does not close it), the Close button and `Dialog.Close`. Focus returns to the first of these that can take focus: `finalFocusRef`, the element that had focus when the dialog opened, the trigger, an element next to where that opener was.',
  '- **Naming**: give `Dialog.Content` a `title`, a `Dialog.Title`, or `aria-label`.',
  '',
  'The sub-components are also exported under flat names (`DialogTrigger`, `DialogContent`, `DialogFooter`, `DialogTitle`, `DialogClose`) for React Server Components, which cannot use the dotted form; dotted access (`Dialog.Content`) needs a client file.',
].join('\n');

const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
  parameters: {
    docs: { description: { component: componentDescription } },
  },
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
