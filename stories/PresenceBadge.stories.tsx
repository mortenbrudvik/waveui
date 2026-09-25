import type { Meta, StoryObj } from '@storybook/react';
import { PresenceBadge } from '../src';
import type { PresenceStatus } from '../src';
import { sizeArgType } from './_helpers';

const STATUSES: PresenceStatus[] = ['available', 'busy', 'away', 'offline', 'dnd', 'oof'];

const meta = {
  title: 'Components/Data Display/PresenceBadge',
  component: PresenceBadge,
  argTypes: {
    ...sizeArgType,
    status: {
      control: 'select',
      options: STATUSES,
    },
  },
  args: {
    status: 'available',
    size: 'medium',
  },
} satisfies Meta<typeof PresenceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};

export const Busy: Story = {
  args: { status: 'busy' },
};

export const Away: Story = {
  args: { status: 'away' },
};

export const Offline: Story = {
  args: { status: 'offline' },
};

export const DND: Story = {
  args: { status: 'dnd' },
};

export const OOF: Story = {
  args: { status: 'oof' },
};

/** Every status has its own shape, so none depends on color alone. */
export const AllStatuses: Story = {
  args: { size: 'extra-large' },
  render: (args) => (
    <div className="flex items-center gap-4">
      {STATUSES.map((status) => (
        <PresenceBadge key={status} {...args} status={status} />
      ))}
    </div>
  ),
};
