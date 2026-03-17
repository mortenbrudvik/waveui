import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '../src';

const meta = {
  title: 'Components/Feedback/Skeleton',
  component: Skeleton,
  argTypes: {
    variant: {
      control: 'select',
      options: ['text', 'circular', 'rectangular'],
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rectangle: Story = {
  args: {
    variant: 'rectangular',
    width: 200,
    height: 120,
  },
};

export const Circle: Story = {
  args: {
    variant: 'circular',
    width: 48,
    height: 48,
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton variant="text" width={200} height={12} />
      <Skeleton variant="text" width={160} height={12} />
      <Skeleton variant="text" width={180} height={12} />
      <Skeleton variant="rectangular" width={300} height={80} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="circular" width={48} height={48} />
        <Skeleton variant="circular" width={64} height={64} />
      </div>
    </div>
  ),
};
