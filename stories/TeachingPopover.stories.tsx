import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { TeachingPopover, Button } from '../src';
import { motionCases } from './_motion';

const sampleSteps = [
  {
    title: 'Welcome to the App',
    body: 'This quick tour will help you get started with the key features.',
  },
  {
    title: 'Create Your First Project',
    body: 'Click the "New Project" button in the toolbar to create a new project.',
  },
  {
    title: 'Invite Your Team',
    body: 'Use the share menu to invite collaborators and assign roles.',
  },
  {
    title: "You're All Set!",
    body: 'You now know the basics. Explore the app to discover more features.',
  },
];

/** Decorative light bulb for the header (the header hides its icon slot from assistive technology). */
const BulbGlyph = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M8 1a4.5 4.5 0 0 0-2.5 8.25V11h5V9.25A4.5 4.5 0 0 0 8 1zM6 12.5h4V14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
  </svg>
);

const meta = {
  title: 'Components/Overlays/TeachingPopover',
  component: TeachingPopover,
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'bottom', 'start', 'end', 'left', 'right'],
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
    },
  },
  args: {
    steps: sampleSteps,
    onStepChange: fn(),
    onDismiss: fn(),
    onFinish: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof TeachingPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondStep: Story = {
  args: {
    defaultActiveStep: 1,
  },
};

/** Starts on the last step; Done, Close or Escape dismisses it, and it can be shown again. */
export const LastStep: Story = {
  args: {
    defaultActiveStep: 3,
  },
  render: ({ onOpenChange, ...args }) => {
    const [open, setOpen] = React.useState(true);
    if (!open) {
      return <Button onClick={() => setOpen(true)}>Show the tip again</Button>;
    }
    return (
      <TeachingPopover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        {...args}
      />
    );
  },
};

export const SingleStep: Story = {
  args: {
    steps: [{ title: 'Quick Tip', body: 'Press Ctrl+K to open the command palette.' }],
  },
};

/** With `target`, the popover is portaled and points at the element with a beak. */
export const AnchoredToTarget: Story = {
  args: {
    side: 'bottom',
    align: 'start',
  },
  render: (args) => {
    const targetRef = React.useRef<HTMLButtonElement>(null);
    return (
      <div style={{ paddingBottom: 240 }}>
        <Button ref={targetRef} appearance="primary">
          New Project
        </Button>
        <TeachingPopover target={targetRef} {...args} />
      </div>
    );
  },
};

/**
 * A tour that points at a different element on each step: the `target` ref follows the step, and
 * the popover stays shown (focus stays on Next or Back) while it moves.
 */
export const MultiTargetTour: Story = {
  args: {
    steps: [
      { title: 'Create a Project', body: 'Start a new project from here.' },
      { title: 'Invite Your Team', body: 'Share the project with your collaborators.' },
      { title: 'Adjust Settings', body: 'Change notifications and permissions at any time.' },
    ],
    side: 'bottom',
    align: 'start',
  },
  render: ({ onStepChange, ...args }) => {
    const projectRef = React.useRef<HTMLButtonElement>(null);
    const shareRef = React.useRef<HTMLButtonElement>(null);
    const settingsRef = React.useRef<HTMLButtonElement>(null);
    const [step, setStep] = React.useState(0);
    const target = step === 0 ? projectRef : step === 1 ? shareRef : settingsRef;
    return (
      <div style={{ paddingBottom: 240 }}>
        <div className="flex gap-2">
          <Button ref={projectRef} appearance="primary">
            New Project
          </Button>
          <Button ref={shareRef}>Share</Button>
          <Button ref={settingsRef}>Settings</Button>
        </div>
        <TeachingPopover
          activeStep={step}
          onStepChange={(next) => {
            setStep(next);
            onStepChange?.(next);
          }}
          target={target}
          {...args}
        />
      </div>
    );
  },
};

/**
 * `primaryAction` and `secondaryAction` replace Next (Done on the last step) and Back, on every
 * step or, as in `steps`, on one step (which wins). The consumer's `onClick` runs first and the
 * normal action follows unless it calls `preventDefault()`. A slot object such as `{ as: 'a', href }`
 * makes the action a link. Done, or the button that replaces it, calls `onFinish`.
 */
export const FooterActions: Story = {
  args: {
    steps: [
      {
        title: 'Welcome to the App',
        body: 'This quick tour will help you get started with the key features.',
        secondaryAction: { as: 'a', href: '#docs', children: 'Read the docs' },
      },
      sampleSteps[1],
      {
        title: "You're All Set!",
        body: 'You now know the basics. Explore the app to discover more features.',
        primaryAction: 'Finish setup',
      },
    ],
    primaryAction: 'Continue',
    onFinish: fn(),
  },
};

/** `footerLayout="vertical"` stacks the step dots above buttons that fill the width. */
export const VerticalFooter: Story = {
  args: {
    footerLayout: 'vertical',
    onFinish: fn(),
  },
};

const tourParts = (
  <TeachingPopover.Surface>
    <TeachingPopover.Header>Tip</TeachingPopover.Header>
    <TeachingPopover.Carousel>
      <TeachingPopover.Title />
      <TeachingPopover.Body />
      <TeachingPopover.CarouselFooter
        layout="centered"
        initialStepText="Not now"
        finalStepText="Got it"
      >
        <TeachingPopover.CarouselNav />
      </TeachingPopover.CarouselFooter>
    </TeachingPopover.Carousel>
  </TeachingPopover.Surface>
);

/**
 * A tour built from the parts. The Trigger opens it (and, without `target`, is what it points at),
 * `CarouselNav` makes the step indicators buttons, `initialStepText` turns the first step's Back
 * into a button that dismisses the tour, and `finalStepText` relabels Done. `layout="centered"`
 * puts the indicator between the buttons.
 */
export const TourFromParts: Story = {
  args: {
    onFinish: fn(),
  },
  render: (args) => (
    <div style={{ paddingBottom: 320 }}>
      <TeachingPopover {...args} defaultOpen>
        <TeachingPopover.Trigger>
          <Button appearance="primary">Take the tour</Button>
        </TeachingPopover.Trigger>
        {tourParts}
      </TeachingPopover>
    </div>
  ),
};

/** The Motion story's surface: it zooms in from 95% as it fades in, and back out as it fades. */
const fadeAndZoom =
  'transition-[opacity,scale] duration-wave-slow ease-wave-decelerate-max data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:scale-95 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:scale-95 data-[presence=exiting]:opacity-0';

/**
 * `motion` of the surface (on the root when it renders its own surface, else on
 * `TeachingPopover.Surface`). By default it fades in and slides 4px away from the element it
 * points at over 200ms, and fades out and slides back over 100ms; a popover rendered in place,
 * without a target or a Trigger, only fades. It stays visible while it exits, with focus already
 * back on its Trigger. `null` turns the motion off; a class string replaces it (here a zoom).
 * Under reduced motion every popover appears and disappears at once.
 */
export const Motion: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-4" style={{ paddingBottom: 240 }}>
      {motionCases(fadeAndZoom).map(({ label, motion }) => (
        // The story renders one popover per case; every other arg is forwarded.
        <TeachingPopover key={label} {...args} motion={motion}>
          <TeachingPopover.Trigger>
            <Button>{label}</Button>
          </TeachingPopover.Trigger>
        </TeachingPopover>
      ))}
    </div>
  ),
};

/**
 * `CarouselPageCount` is a visible count; its render function words it (and localizes it). Here
 * it stands beside the interactive step buttons, with the header's icon and the body's media.
 */
export const PageCountHeaderAndMedia: Story = {
  args: {
    onFinish: fn(),
  },
  render: (args) => (
    <div style={{ paddingBottom: 360 }}>
      <TeachingPopover {...args} defaultOpen>
        <TeachingPopover.Trigger>
          <Button appearance="primary">Take the tour</Button>
        </TeachingPopover.Trigger>
        <TeachingPopover.Surface>
          <TeachingPopover.Header icon={<BulbGlyph />}>Tip</TeachingPopover.Header>
          <TeachingPopover.Carousel>
            <TeachingPopover.Title />
            <TeachingPopover.Body
              media={<span className="block h-16 w-full rounded-md bg-card" />}
            />
            <TeachingPopover.CarouselFooter>
              <TeachingPopover.CarouselNav />
              <TeachingPopover.CarouselPageCount>
                {(current, total) => `Step ${current} of ${total}`}
              </TeachingPopover.CarouselPageCount>
            </TeachingPopover.CarouselFooter>
          </TeachingPopover.Carousel>
        </TeachingPopover.Surface>
      </TeachingPopover>
    </div>
  ),
};
