import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Popover, Avatar, Button, Input, Tooltip } from '../src';

/** Decorative filter icon (the Button hides its icon slot from assistive technology). */
const FilterIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path d="M2.5 3.5h11l-4.25 5v4l-2.5 1.5v-5.5z" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

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
    // An element held in state or a VirtualElement (an object with a function): set in code.
    target: { control: false },
  },
  args: {
    side: 'bottom',
    align: 'start',
    openOnHover: false,
    openDelay: 250,
    closeDelay: 500,
    openOnContext: false,
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

/**
 * An icon-only trigger named by `Tooltip relationship="label"`: the popover gets the trigger's name
 * ("Filters") from the same label.
 */
export const IconOnlyTrigger: Story = {
  args: {
    children: (
      <>
        <Popover.Trigger>
          <Tooltip content="Filters" relationship="label">
            <Button icon={<FilterIcon />} />
          </Tooltip>
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

/**
 * A hover card: with `openOnHover` the card opens when the mouse pointer rests on the trigger
 * (`openDelay`) and closes once the pointer has left the trigger and the card (`closeDelay`),
 * unless focus is inside the card. A triangle towards the card keeps it open while the pointer
 * moves into it. Opening and closing by hover move no focus; Tab from the trigger enters the card,
 * and a click on the trigger pins it. Touch and pen open it by a tap only.
 */
export const HoverCard: Story = {
  args: {
    openOnHover: true,
    children: (
      <>
        <Popover.Trigger>
          <Button appearance="transparent">Maria Lopez</Button>
        </Popover.Trigger>
        <Popover.Content title="Maria Lopez">
          <div className="flex items-center gap-3">
            <Avatar name="Maria Lopez" size="large" />
            <span className="text-muted-foreground">Product designer, Oslo</span>
          </div>
          <Button appearance="primary" size="small" className="mt-3">
            Follow
          </Button>
        </Popover.Content>
      </>
    ),
  },
};

/**
 * A context popover: with `openOnContext` the trigger is a context-menu region. A right click on a
 * file (a Ctrl+click on macOS) opens the details at the pointer and leaves focus where it is; Tab
 * from the focused file enters them. Shift+F10 or the ContextMenu key on the focused file opens
 * them next to it and moves focus into them, and Escape returns focus to the file. The filter
 * field keeps the browser's own context menu. The region is no popover button (no
 * `aria-haspopup`), so the content is named by its `title`, and `aria-keyshortcuts` announces the
 * key.
 */
export const ContextPopover: Story = {
  args: {
    openOnContext: true,
    children: (
      <>
        <Popover.Trigger>
          <div
            role="group"
            aria-label="Files"
            aria-keyshortcuts="Shift+F10"
            className="flex w-64 flex-col items-stretch gap-1"
          >
            {['Report.docx', 'Budget.xlsx', 'Slides.pptx'].map((file) => (
              <Button key={file} appearance="subtle" className="justify-start">
                {file}
              </Button>
            ))}
            <Input aria-label="Filter files" placeholder="Filter" />
          </div>
        </Popover.Trigger>
        <Popover.Content title="File details">
          <p style={{ margin: 0 }}>Shared with 3 people, edited today.</p>
          <Button size="small" className="mt-3">
            Share
          </Button>
        </Popover.Content>
      </>
    ),
  },
};

/**
 * `target` places the content at another element (or at a `VirtualElement`, such as a point).
 * This controlled popover has no trigger: it is anchored to a toggle button outside it, which
 * carries its own `aria-haspopup`, `aria-expanded` and `aria-controls`. A press on the toggle is
 * no outside press (the toggle closes the popover itself), Tab from it enters the content, and
 * Close returns focus to it.
 */
export const AnchoredToTarget: Story = {
  render: function AnchoredToTargetStory({ onOpenChange, ...args }) {
    const [open, setOpen] = React.useState(false);
    const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
    const contentId = React.useId();
    const change = (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    };
    return (
      <>
        <Button
          ref={setTarget}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={() => change(!open)}
        >
          Details
        </Button>
        <Popover {...args} open={open} onOpenChange={change} target={target}>
          <Popover.Content id={contentId} title="Details">
            <p style={{ margin: 0 }}>Anchored to the Details button.</p>
            <Button size="small" className="mt-3" onClick={() => change(false)}>
              Close
            </Button>
          </Popover.Content>
        </Popover>
      </>
    );
  },
};
