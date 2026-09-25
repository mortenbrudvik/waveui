import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, PresenceBadge } from '../src';
import type { Size } from '../src';
import { sizeArgType } from './_helpers';

const SIZES: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];

/** Decorative inline icon (the Avatar hides its icon slot from assistive technology). */
const PersonGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <path d="M10 2a4 4 0 100 8 4 4 0 000-8zM4 18a6 6 0 0112 0H4z" />
  </svg>
);

const meta = {
  title: 'Components/Data Display/Avatar',
  component: Avatar,
  argTypes: {
    ...sizeArgType,
  },
  args: {
    name: 'Jane Doe',
    size: 'medium',
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?u=avatar-story',
  },
};

/** When the image fails to load, the avatar falls back to the initials. */
export const ImageFallback: Story = {
  args: {
    src: 'data:image/png;base64,broken',
  },
};

export const WithName: Story = {
  args: {
    name: 'John Smith',
    size: 'large',
  },
};

/** An icon avatar without a name needs an `aria-label` (otherwise it is decorative). */
export const WithIcon: Story = {
  args: {
    name: undefined,
    icon: <PersonGlyph />,
    'aria-label': 'Guest',
  },
};

/** The avatar and the presence badge are both named images: "Jane Doe" and "Available". */
export const WithBadge: Story = {
  args: {
    size: 'large',
    badge: <PresenceBadge status="available" />,
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {SIZES.map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
