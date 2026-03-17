import type { Meta, StoryObj } from '@storybook/react';
import { InfoLabel } from '../src';

const meta = {
  title: 'Data Display/InfoLabel',
  component: InfoLabel,
} satisfies Meta<typeof InfoLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Username',
    info: 'Your unique identifier for this account.',
  },
};

export const WithInfo: Story = {
  args: {
    label: 'Password strength',
    info: 'Use at least 8 characters with a mix of letters, numbers, and symbols.',
  },
};
