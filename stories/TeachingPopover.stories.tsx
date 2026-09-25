import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { TeachingPopover, Button } from '../src';

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
