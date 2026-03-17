import type { Meta, StoryObj } from '@storybook/react';
import { PresenceBadge } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Data Display/PresenceBadge',
  component: PresenceBadge,
  argTypes: {
    ...sizeArgType,
    status: {
      control: 'select',
      options: ['available', 'busy', 'away', 'offline', 'dnd', 'oof'],
    },
  },
} satisfies Meta<typeof PresenceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {
  args: { status: 'available', size: 'medium' },
};

export const Busy: Story = {
  args: { status: 'busy', size: 'medium' },
};

export const Away: Story = {
  args: { status: 'away', size: 'medium' },
};

export const Offline: Story = {
  args: { status: 'offline', size: 'medium' },
};

export const DND: Story = {
  args: { status: 'dnd', size: 'medium' },
};

export const OOF: Story = {
  args: { status: 'oof', size: 'medium' },
};
