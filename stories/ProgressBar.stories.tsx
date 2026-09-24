import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from '../src';

const meta = {
  title: 'Components/Feedback/ProgressBar',
  component: ProgressBar,
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    max: { control: 'number' },
  },
  args: {
    label: 'Uploading files',
    max: 100,
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 60,
  },
};

export const Indeterminate: Story = {
  args: {
    label: 'Syncing',
  },
};

export const WithLabel: Story = {
  args: {
    value: 75,
    label: 'Uploading files...',
    showLabel: true,
  },
};
