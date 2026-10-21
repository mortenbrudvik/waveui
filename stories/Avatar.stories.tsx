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

const NUMERIC_SIZES = [16, 24, 36, 56, 96, 128] as const;
const NAMED_COLORS = [
  'red',
  'pumpkin',
  'gold',
  'forest',
  'teal',
  'blue',
  'navy',
  'lavender',
  'purple',
  'magenta',
  'brown',
  'steel',
] as const;
const PEOPLE = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'];

/** A number is the box in pixels; the initials and the badge scale with it. */
export const NumericSizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-2">
      {NUMERIC_SIZES.map((size) => (
        <Avatar key={size} {...args} size={size} aria-label={`${args.name}, ${size} pixels`} />
      ))}
    </div>
  ),
};

/** `shape="square"` has rounded corners; the badge keeps to the corner either way. */
export const Shapes: Story = {
  args: { size: 56, badge: <PresenceBadge status="busy" /> },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} shape="circular" aria-label="Jane Doe, circular" />
      <Avatar {...args} shape="square" aria-label="Jane Doe, square" />
    </div>
  ),
};

/** `neutral`, `brand`, the twelve named colors; `colorful` picks one from the name. */
export const Colors: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Avatar {...args} color="neutral" aria-label="Neutral" />
      <Avatar {...args} color="brand" aria-label="Brand" />
      {NAMED_COLORS.map((color) => (
        <Avatar key={color} {...args} color={color} aria-label={color} />
      ))}
    </div>
  ),
};

/** The same name always gets the same color; `idForColor` picks it from something stable. */
export const ColorfulFromNameOrId: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {PEOPLE.map((name) => (
        <Avatar key={name} {...args} name={name} color="colorful" />
      ))}
      <Avatar {...args} name="Renamed Person" color="colorful" idForColor="user-1042" />
    </div>
  ),
};

/** `active` draws a ring, shadow or glow; `inactive` dims the avatar. */
export const ActiveAndInactive: Story = {
  args: { size: 56 },
  render: (args) => (
    <div className="flex items-center gap-4">
      {(['ring', 'ring-shadow', 'shadow', 'glow'] as const).map((appearance) => (
        <Avatar
          key={appearance}
          {...args}
          active="active"
          activeAppearance={appearance}
          aria-label={`Active, ${appearance}`}
        />
      ))}
      <Avatar {...args} active="inactive" aria-label="Inactive" />
    </div>
  ),
};

/** Initials come from the name: two letters, one for a single name, none for digits or emoji. */
export const Initials: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {['Ada Lovelace', 'Plato', 'Mary-Jane O’Neil', 'Ola Nordmann (UiO)'].map((name) => (
        <Avatar key={name} {...args} name={name} color="colorful" />
      ))}
      <Avatar {...args} name="Custom" initials="XY" />
    </div>
  ),
};
