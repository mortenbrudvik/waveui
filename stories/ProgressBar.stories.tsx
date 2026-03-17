import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from '../src';

const meta = {
  title: 'Components/Feedback/ProgressBar',
  component: ProgressBar,
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    max: { control: 'number' },
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 60,
    max: 100,
  },
};

export const Indeterminate: Story = {
  args: {},
};

export const WithLabel: Story = {
  args: {
    value: 75,
    max: 100,
    label: 'Uploading files...',
  },
};
