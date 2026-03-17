import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TeachingPopover } from '../src';

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
    title: 'You\'re All Set!',
    body: 'You now know the basics. Explore the app to discover more features.',
  },
];

const meta = {
  title: 'Components/Overlays/TeachingPopover',
  component: TeachingPopover,
} satisfies Meta<typeof TeachingPopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: sampleSteps,
  },
};

export const SecondStep: Story = {
  args: {
    steps: sampleSteps,
    defaultCurrentStep: 1,
  },
};

export const LastStep: Story = {
  args: {
    steps: sampleSteps,
    currentStep: 3,
  },
};

export const SingleStep: Story = {
  args: {
    steps: [{ title: 'Quick Tip', body: 'Press Ctrl+K to open the command palette.' }],
  },
};
