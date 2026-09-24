import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '../src';

const meta = {
  title: 'Components/Feedback/Skeleton',
  component: Skeleton,
  argTypes: {
    shape: {
      control: 'select',
      options: ['rounded', 'circular', 'square'],
    },
  },
  args: {
    shape: 'rounded',
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rectangle: Story = {
  args: {
    width: 200,
    height: 120,
  },
};

export const Circle: Story = {
  args: {
    shape: 'circular',
    width: 48,
    height: 48,
  },
};

export const Square: Story = {
  args: {
    shape: 'square',
    width: 64,
    height: 64,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Skeleton width={200} height={12} {...args} />
      <Skeleton width={160} height={12} {...args} />
      <Skeleton width={180} height={12} {...args} />
      <Skeleton width={300} height={80} {...args} />
      <div className="flex gap-2">
        <Skeleton shape="circular" width={32} height={32} />
        <Skeleton shape="circular" width={48} height={48} />
        <Skeleton shape="circular" width={64} height={64} />
      </div>
    </div>
  ),
};

/**
 * `Skeleton.Group` marks a loading region busy and gives it a visually hidden label, while the
 * placeholders stay decorative.
 */
export const Group: Story = {
  render: (args) => (
    <Skeleton.Group label="Loading profile" className="flex items-center gap-3">
      <Skeleton shape="circular" width={40} height={40} />
      <div className="flex flex-col gap-2">
        <Skeleton width={160} height={12} {...args} />
        <Skeleton width={120} height={12} {...args} />
      </div>
    </Skeleton.Group>
  ),
};
