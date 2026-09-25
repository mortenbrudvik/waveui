import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dialog, Button, Input, Label } from '../src';
import type { DialogProps } from '../src';

/** Stories that render the dialog open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

const modalTypes = ['modal', 'alert'] as const satisfies readonly NonNullable<
  DialogProps['modalType']
>[];

/** The fields of the LongContent form. */
const shippingFields = [
  'Full name',
  'Company',
  'Email',
  'Phone',
  'Address line 1',
  'Address line 2',
  'City',
  'State or region',
  'Postal code',
  'Country',
  'Delivery contact',
  'Contact phone',
  'Gate code',
  'Floor',
  'Building',
  'Preferred day',
  'Preferred time',
  'Order reference',
  'Cost centre',
  'Notes for the driver',
];

const meta = {
  title: 'Components/Overlays/Dialog',
  component: Dialog,
  args: {
    defaultOpen: false,
    modalType: 'modal',
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
    modalType: { control: 'select', options: modalTypes },
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

/**
 * `modalType="alert"`: a confirmation that needs an answer. The surface is `role="alertdialog"`,
 * and a backdrop press does not close it (Escape, the Close button and `Dialog.Close` still do).
 * The least destructive action comes first.
 */
export const AlertDialog: Story = {
  args: {
    modalType: 'alert',
    children: (
      <>
        <Dialog.Trigger>
          <Button>Delete file</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Delete report.pdf?" size="small">
          <p>The file is deleted permanently. This cannot be undone.</p>
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
 * `onOpenChange` receives the reason of each request as its second argument (`details.reason`,
 * with the DOM event as `details.event`). This controlled dialog ignores a backdrop press
 * (`outside-press`) while the form has unsaved changes, so a stray click does not lose them;
 * Escape, the Close button and Cancel still close it.
 */
export const UnsavedChanges: Story = {
  render: function UnsavedChangesDialog(args) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const dirty = name !== '';
    const handleOpenChange: NonNullable<DialogProps['onOpenChange']> = (next, details) => {
      args.onOpenChange?.(next, details);
      if (!next && dirty && details?.reason === 'outside-press') return;
      setOpen(next);
      if (!next) setName('');
    };
    return (
      // The story owns the controlled pair; every other arg is forwarded.
      <Dialog {...args} open={open} onOpenChange={handleOpenChange}>
        <Dialog.Trigger>
          <Button appearance="primary">Rename project</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Rename project">
          <div className="flex flex-col gap-1">
            <Label htmlFor="unsaved-changes-name">New name</Label>
            <Input
              id="unsaved-changes-name"
              value={name}
              onValueChange={setName}
              aria-describedby="unsaved-changes-hint"
            />
            <p id="unsaved-changes-hint" className="text-caption-1">
              {dirty
                ? 'Unsaved changes: a click outside the dialog keeps it open.'
                : 'Type a name, then click outside the dialog.'}
            </p>
          </div>
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="subtle">Cancel</Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button appearance="primary">Save</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    );
  },
};

/**
 * A form taller than the viewport inside the dialog: the body scrolls and `Dialog.Footer`, the
 * form's last child, sticks to its bottom with an opaque background. The body reserves the
 * footer's height as scroll padding, so tabbing to a field under the footer scrolls it into view
 * above the footer.
 */
export const LongContent: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Dialog.Content title="Shipping details">
        <form
          aria-label="Shipping details"
          className="flex flex-col gap-3"
          onSubmit={(event) => event.preventDefault()}
        >
          {shippingFields.map((field, index) => (
            <div key={field} className="flex flex-col gap-1">
              <Label htmlFor={`shipping-field-${index}`}>{field}</Label>
              <Input id={`shipping-field-${index}`} />
            </div>
          ))}
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="subtle">Cancel</Button>
            </Dialog.Close>
            <Button appearance="primary" type="submit">
              Save
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    ),
  },
  parameters: openStoryParameters,
};

/** The parent owns `open`; the dialog asks to close through `onOpenChange`. */
export const Controlled: Story = {
  render: function ControlledDialog(args) {
    const [open, setOpen] = React.useState(false);
    const handleOpenChange: NonNullable<DialogProps['onOpenChange']> = (next, details) => {
      setOpen(next);
      args.onOpenChange?.(next, details);
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
