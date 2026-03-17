import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, PresenceBadge } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Data Display/Avatar',
  component: Avatar,
  argTypes: {
    ...sizeArgType,
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Jane Doe',
    size: 'medium',
  },
};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?u=avatar-story',
    name: 'Jane Doe',
    size: 'medium',
  },
};

export const WithName: Story = {
  args: {
    name: 'John Smith',
    size: 'large',
  },
};

export const WithIcon: Story = {
  args: {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM4 18a6 6 0 0112 0H4z" />
      </svg>
    ),
    size: 'medium',
  },
};

export const WithBadge: Story = {
  args: {
    name: 'Jane Doe',
    size: 'large',
    badge: <PresenceBadge status="available" />,
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Avatar name="Jane Doe" size="extra-small" />
      <Avatar name="Jane Doe" size="small" />
      <Avatar name="Jane Doe" size="medium" />
      <Avatar name="Jane Doe" size="large" />
      <Avatar name="Jane Doe" size="extra-large" />
    </div>
  ),
};
