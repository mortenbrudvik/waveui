import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Popover, Avatar, Button, Input, Tooltip } from '../src';
import { motionCases } from './_motion';

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
            <span className="text-wave-muted-foreground">Product designer, Oslo</span>
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

/** The Motion story's popover: it zooms in from 95% as it fades in, and back out as it fades. */
const fadeAndZoom =
  'transition-[opacity,scale] duration-wave-slow ease-wave-decelerate-max data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:scale-95 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:scale-95 data-[presence=exiting]:opacity-0';

/**
 * `Popover.Content motion`. By default the content fades in and slides 4px away from its trigger,
 * on the side it opened on (pick another `side` in the controls), over 200ms, and fades out and
 * slides back over 100ms. `null` turns it off; a class string replaces it (here a zoom). The
 * content stays in place, `inert`, while it exits: focus is already back on the trigger. Under
 * reduced motion every popover appears and disappears at once.
 */
export const Motion: Story = {
  render: function MotionPopovers({ children: _children, ...args }) {
    return (
      <div className="flex flex-wrap gap-2">
        {motionCases(fadeAndZoom).map(({ label, motion }) => (
          // The story renders one popover per case; every other arg is forwarded.
          <Popover key={label} {...args}>
            <Popover.Trigger>
              <Button>{label}</Button>
            </Popover.Trigger>
            <Popover.Content title={label} motion={motion}>
              <p style={{ margin: 0 }}>Press Escape or click outside to see the exit.</p>
            </Popover.Content>
          </Popover>
        ))}
      </div>
    );
  },
};

/**
 * `appearance` on `Popover`: `neutral` (the default), `brand` (the brand fill) or `inverted` (a
 * dark surface in the light theme); the beak takes the surface's fill. `size` pads the content
 * `small` (12px), `medium` (16px) or `large` (20px). `withArrow={false}` draws no beak.
 */
export const AppearancesAndSizes: Story = {
  render: function AppearancesAndSizesPopovers({ children: _children, ...args }) {
    return (
      <div className="flex flex-wrap gap-2">
        {(['neutral', 'brand', 'inverted'] as const).map((appearance) => (
          <Popover key={appearance} {...args} appearance={appearance}>
            <Popover.Trigger>
              <Button>{appearance}</Button>
            </Popover.Trigger>
            <Popover.Content title={`A ${appearance} popover`}>
              <p style={{ margin: 0 }}>Content that reads on the {appearance} surface.</p>
            </Popover.Content>
          </Popover>
        ))}
        {(['small', 'large'] as const).map((size) => (
          <Popover key={size} {...args} size={size} withArrow={false}>
            <Popover.Trigger>
              <Button>{size}, no arrow</Button>
            </Popover.Trigger>
            <Popover.Content title={`A ${size} popover`}>
              <p style={{ margin: 0 }}>Padded {size}.</p>
            </Popover.Content>
          </Popover>
        ))}
      </div>
    );
  },
};

/**
 * `trapFocus`: focus moves into the content when it opens and Tab cycles inside it; Escape and a
 * press outside still close it, and focus returns to the trigger. The page is not made inert.
 * `role="group"` (here on a second popover) is for content that only presents information: the
 * trigger then carries no `aria-haspopup`.
 */
export const FocusTrapAndRole: Story = {
  render: function FocusTrapPopovers({ children: _children, ...args }) {
    return (
      <div className="flex flex-wrap gap-2">
        <Popover {...args} trapFocus>
          <Popover.Trigger>
            <Button>Rename (focus trapped)</Button>
          </Popover.Trigger>
          <Popover.Content title="Rename">
            <Input aria-label="New name" />
            <Button size="small" className="mt-3">
              Save
            </Button>
          </Popover.Content>
        </Popover>
        <Popover {...args}>
          <Popover.Trigger>
            <Button>Details (group)</Button>
          </Popover.Trigger>
          <Popover.Content title="Details" role="group">
            <p style={{ margin: 0 }}>Created yesterday by Ada.</p>
          </Popover.Content>
        </Popover>
      </div>
    );
  },
};

/**
 * `inline` renders the content in place, not in a portal: it stays inside this bordered box and
 * follows the DOM order, so Tab from the trigger reaches it. `closeOnScroll` closes a popover when
 * the page or any container scrolls. `onOpenChange` reports `details.reason`.
 */
export const InlineAndCloseOnScroll: Story = {
  render: function InlinePopovers({ children: _children, ...args }) {
    return (
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="relative rounded-md border border-wave-border p-4"
          style={{ minHeight: 160 }}
        >
          <Popover {...args} inline>
            <Popover.Trigger>
              <Button>Inline popover</Button>
            </Popover.Trigger>
            <Popover.Content title="In place">
              <p style={{ margin: 0 }}>Rendered inside the box.</p>
            </Popover.Content>
          </Popover>
        </div>
        <div className="h-24 w-64 overflow-auto rounded-md border border-wave-border p-2">
          <Popover {...args} closeOnScroll>
            <Popover.Trigger>
              <Button>Closes on scroll</Button>
            </Popover.Trigger>
            <Popover.Content title="Scroll away">
              <p style={{ margin: 0 }}>Scroll this box to close me.</p>
            </Popover.Content>
          </Popover>
          <div style={{ height: 200 }} aria-hidden="true" />
        </div>
      </div>
    );
  },
};
