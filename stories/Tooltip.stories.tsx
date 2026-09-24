import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip, Button } from '../src';

/** Decorative inline icon (the Button hides its icon slot from assistive technology). */
const SaveIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M3 2.5h8l2.5 2.5v8.5h-11zM5 2.5v3.5h5v-3.5M5 13.5v-4h6v4"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const meta = {
  title: 'Components/Overlays/Tooltip',
  component: Tooltip,
  argTypes: {
    appearance: {
      control: 'select',
      options: ['inverted', 'normal'],
    },
    relationship: {
      control: 'select',
      options: ['description', 'label'],
    },
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
    content: 'This is a tooltip',
    appearance: 'inverted',
    relationship: 'description',
    side: 'top',
    align: 'center',
    delay: 200,
    children: <Button>Hover me</Button>,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The `normal` appearance: the page background with a border (replaces 0.4's `variant="light"`). */
export const Normal: Story = {
  args: {
    content: 'Normal tooltip',
    appearance: 'normal',
    children: <Button>Normal Tooltip</Button>,
  },
};

/** `relationship="label"` names an icon-only button with the tooltip text. */
export const IconOnlyLabel: Story = {
  args: {
    content: 'Save',
    relationship: 'label',
    children: <Button icon={<SaveIcon />} />,
  },
};

/** Long text wraps inside the tooltip's maximum width. */
export const LongContent: Story = {
  args: {
    content:
      'Tooltips wrap long text instead of running off the screen, and flip to the other side near the viewport edge.',
    children: <Button>Long tooltip</Button>,
  },
};
