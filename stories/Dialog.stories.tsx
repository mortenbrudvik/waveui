import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dialog, Button, Field, Input, ToggleButton } from '../src';
import type { DialogContentProps, DialogProps } from '../src';

/** Stories that render the dialog open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

const modalTypes = ['modal', 'alert', 'non-modal'] as const satisfies readonly NonNullable<
  DialogProps['modalType']
>[];

const sizes = ['small', 'medium', 'large', 'full'] as const satisfies readonly NonNullable<
  DialogContentProps['size']
>[];

/** Decorative "expand" glyph (the Button hides its icon slot from assistive technology). */
const ExpandIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Decorative "link" glyph. */
const LinkIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
 * The `className` recipe for a width the sizes do not have: up to 72rem wide on a large screen
 * (`max-w-[72rem]` replaces the `size` cap), and full screen below 48rem, where the classes also
 * remove the surface's 1rem margin to the viewport, its height cap, its radius and its border.
 * For the fixed widths use `size` (`large` is 940px), and `size="full"` for a full-screen dialog
 * at every width.
 */
export const LargeAndFullScreen: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Dialog.Content
        title="Migrate the build to Vite"
        className="max-w-[72rem] max-[48rem]:m-0 max-[48rem]:h-dvh max-[48rem]:max-h-none max-[48rem]:rounded-none max-[48rem]:border-0"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <p key={index} className="mb-2">
            Section {index + 1}. A task dialog that is a workspace rather than a form: its content
            can lay itself out in more columns as the dialog widens, and the body scrolls when it is
            taller than the dialog.
          </p>
        ))}
        <Dialog.Footer>
          <Dialog.Close>
            <Button appearance="subtle">Cancel</Button>
          </Dialog.Close>
          <Dialog.Close>
            <Button appearance="primary">Save</Button>
          </Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    ),
  },
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
          <Field
            label="New name"
            hint={
              dirty
                ? 'Unsaved changes: a click outside the dialog keeps it open.'
                : 'Type a name, then click outside the dialog.'
            }
          >
            <Input value={name} onValueChange={setName} />
          </Field>
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
          {shippingFields.map((field) => (
            <Field key={field} label={field}>
              <Input />
            </Field>
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

/**
 * `modalType="non-modal"`: the page stays usable — no backdrop, no focus trap, nothing inert, the
 * page scrolls. Tab from the trigger enters the dialog, Tab past its last element continues after
 * the trigger, Escape inside closes it, presses on the page leave it open, and the trigger toggles
 * it. The page's controls sit above the centred dialog, so none is hidden behind it.
 */
export const NonModal: Story = {
  args: { defaultOpen: true, modalType: 'non-modal' },
  render: function NonModalDialog(args) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <Dialog {...args}>
          <Dialog.Trigger>
            <Button appearance="primary">Formatting help</Button>
          </Dialog.Trigger>
          <Dialog.Content title="Formatting help" size="small">
            <p>Wrap text in asterisks for bold, and start a line with a dash for a list.</p>
            <Dialog.Footer>
              <Dialog.Close>
                <Button appearance="primary">Got it</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        <Field label="Comment">
          <Input />
        </Field>
        <Button>Post</Button>
      </div>
    );
  },
  parameters: openStoryParameters,
};

/** `size` caps the width at 400px (`small`), 600px (`medium`, the default) or 940px (`large`); `full` covers the viewport. */
export const Sizes: Story = {
  render: function SizesStory(args) {
    return (
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          // The story renders one dialog per size; every other arg is forwarded.
          <Dialog key={size} {...args}>
            <Dialog.Trigger>
              <Button>{`Open ${size}`}</Button>
            </Dialog.Trigger>
            <Dialog.Content title={`The ${size} size`} size={size}>
              <p>The dialog takes the full width up to its size and never exceeds the viewport.</p>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button appearance="primary">Done</Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        ))}
      </div>
    );
  },
};

/**
 * `size="full"`: the dialog covers the viewport, with no margin, radius or border, and pads the
 * safe-area insets (the notch and the home indicator, once the page sets `viewport-fit=cover`).
 * The long form scrolls under the sticky `Dialog.Footer`.
 */
export const FullScreen: Story = {
  args: {
    defaultOpen: true,
    children: (
      <Dialog.Content title="Shipping details" size="full">
        <form
          aria-label="Shipping details"
          className="flex flex-col gap-3"
          onSubmit={(event) => event.preventDefault()}
        >
          {shippingFields.map((field) => (
            <Field key={field} label={field}>
              <Input />
            </Field>
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

/**
 * Header buttons before the Close button (issue #4): `titleAction` holds an "Expand" toggle that
 * switches the dialog between `large` and `full`; `Dialog.Title`'s `action` places a "Copy link"
 * button in the same corner, outside the heading, so it is never part of the dialog's name. The
 * titles' end padding follows the width of the buttons, and Tab reaches them before the Close
 * button.
 */
export const TitleActions: Story = {
  render: function TitleActionsStory(args) {
    const [expanded, setExpanded] = React.useState(false);
    return (
      <div className="flex flex-wrap gap-2">
        {/* The story renders two dialogs; every other arg is forwarded to both. */}
        <Dialog {...args}>
          <Dialog.Trigger>
            <Button appearance="primary">Open the report</Button>
          </Dialog.Trigger>
          <Dialog.Content
            title="Quarterly report"
            size={expanded ? 'full' : 'large'}
            titleAction={
              <ToggleButton
                appearance="subtle"
                size="small"
                icon={<ExpandIcon />}
                aria-label="Expand"
                pressed={expanded}
                onPressedChange={setExpanded}
              />
            }
          >
            <p>Revenue grew in every region; the tables below break it down by product line.</p>
            <Dialog.Footer>
              <Dialog.Close>
                <Button appearance="primary">Done</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        <Dialog {...args}>
          <Dialog.Trigger>
            <Button>Share the report</Button>
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title
              action={
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<LinkIcon />}
                  aria-label="Copy link"
                />
              }
            >
              Share the quarterly report
            </Dialog.Title>
            <p>People with the link can view the report.</p>
          </Dialog.Content>
        </Dialog>
      </div>
    );
  },
};

/**
 * `closeButton={null}`: an alert dialog without the built-in Close button, answered through its
 * two footer actions (Escape still closes it).
 */
export const NoCloseButton: Story = {
  args: {
    modalType: 'alert',
    children: (
      <>
        <Dialog.Trigger>
          <Button>Leave the page</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Leave without saving?" size="small" closeButton={null}>
          <p>Your changes to the report are lost.</p>
          <Dialog.Footer>
            <Dialog.Close>
              <Button appearance="subtle">Stay</Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button appearance="primary">Leave</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </>
    ),
  },
};

/**
 * A Wave `Button` passed to `closeButton` is merged into the built-in Close button (never nested;
 * a development warning says so): its text "Done" names the button instead of `closeLabel`.
 */
export const CustomCloseButton: Story = {
  args: {
    children: (
      <>
        <Dialog.Trigger>
          <Button appearance="primary">Open the checklist</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Release checklist" closeButton={<Button>Done</Button>}>
          <p>Every item is checked. Close the checklist when you have read it.</p>
        </Dialog.Content>
      </>
    ),
  },
};

/**
 * A confirm Dialog opened from another Dialog: the page is dimmed once. The upper dialog's
 * backdrop is transparent while the lower one is open (`data-appearance="transparent"`).
 */
export const StackedDialogs: Story = {
  args: {
    children: (
      <>
        <Dialog.Trigger>
          <Button appearance="primary">Open settings</Button>
        </Dialog.Trigger>
        <Dialog.Content title="Settings">
          <p>Reset every setting to its default value.</p>
          <Dialog.Footer>
            <Dialog modalType="alert">
              <Dialog.Trigger>
                <Button>Reset</Button>
              </Dialog.Trigger>
              <Dialog.Content title="Reset every setting?" size="small">
                <p>This cannot be undone.</p>
                <Dialog.Footer>
                  <Dialog.Close>
                    <Button appearance="subtle">Cancel</Button>
                  </Dialog.Close>
                  <Dialog.Close>
                    <Button appearance="primary">Reset</Button>
                  </Dialog.Close>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog>
            <Dialog.Close>
              <Button appearance="primary">Done</Button>
            </Dialog.Close>
          </Dialog.Footer>
        </Dialog.Content>
      </>
    ),
  },
};

/**
 * The `backdrop` slot: a slot object's `className` restyles the backdrop (here the brand colour at
 * 30% and a blur), and its `appearance` picks `transparent` or `dimmed` instead of the automatic
 * choice.
 */
export const CustomBackdrop: Story = {
  render: function CustomBackdropStory(args) {
    return (
      <div className="flex flex-wrap gap-2">
        {/* The story renders two dialogs; every other arg is forwarded to both. */}
        <Dialog {...args}>
          <Dialog.Trigger>
            <Button appearance="primary">Tinted backdrop</Button>
          </Dialog.Trigger>
          <Dialog.Content
            title="Tinted backdrop"
            backdrop={{ className: 'bg-primary/30 backdrop-blur-sm' }}
          >
            <p>The backdrop takes the brand colour and blurs the page behind it.</p>
          </Dialog.Content>
        </Dialog>
        <Dialog {...args}>
          <Dialog.Trigger>
            <Button>Transparent backdrop</Button>
          </Dialog.Trigger>
          <Dialog.Content title="Transparent backdrop" backdrop={{ appearance: 'transparent' }}>
            <p>The page is not dimmed; it is still inert, and a press outside closes the dialog.</p>
          </Dialog.Content>
        </Dialog>
      </div>
    );
  },
};
