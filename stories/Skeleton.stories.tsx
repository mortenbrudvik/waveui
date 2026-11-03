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
    animation: { control: 'inline-radio', options: ['pulse', 'wave'] },
    appearance: { control: 'inline-radio', options: ['opaque', 'translucent'] },
    size: {
      control: 'select',
      options: [8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 128],
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

/** `size` presets in pixels: the height of a line, the width and height of a circle or a square. */
export const SizePresets: Story = {
  render: ({ size: _size, ...args }) => (
    <div className="flex flex-col gap-3">
      {([8, 12, 16, 20, 24, 32, 40] as const).map((size) => (
        <Skeleton key={size} {...args} size={size} width={size * 8} />
      ))}
      <div className="flex items-end gap-2">
        {([16, 24, 32, 48, 64] as const).map((size) => (
          <Skeleton key={size} {...args} shape="circular" size={size} />
        ))}
      </div>
    </div>
  ),
};

/**
 * `animation="wave"` sweeps a highlight across the placeholder instead of fading it; both stop
 * for reduced motion, and in forced colors the placeholder stays a plain `GrayText` fill.
 */
export const Wave: Story = {
  args: { animation: 'wave' },
  render: ({ animation, ...args }) => (
    <div className="flex w-72 flex-col gap-3">
      <Skeleton {...args} animation={animation} width="100%" height={16} />
      <Skeleton {...args} animation={animation} width="70%" height={16} />
      <Skeleton {...args} animation={animation} width="100%" height={80} />
    </div>
  ),
};

/** `appearance="translucent"` fills with the page color at 60%, so what is behind shows through. */
export const Translucent: Story = {
  render: ({ appearance: _appearance, ...args }) => (
    <div className="flex w-72 flex-col gap-3 rounded bg-wave-inverted p-4">
      <Skeleton {...args} appearance="translucent" width="100%" />
      <Skeleton {...args} appearance="translucent" width="60%" />
    </div>
  ),
};

/** The group sets `size`, `shape`, `animation` and `appearance` once; a placeholder's own prop wins. */
export const GroupDefaults: Story = {
  render: () => (
    <Skeleton.Group
      label="Loading people"
      animation="wave"
      size={32}
      className="flex flex-col gap-3"
    >
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton shape="circular" />
          <Skeleton width={160 - row * 20} />
          <Skeleton shape="square" size={16} />
        </div>
      ))}
    </Skeleton.Group>
  ),
};
