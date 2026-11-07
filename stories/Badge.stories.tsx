import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src';
import type { BadgeAppearance, BadgeColor, BadgeSize, Shape } from '../src';
import { badgeAppearanceArgType, badgeColorArgType } from './_helpers';

const APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline', 'ghost'];
const COLORS: BadgeColor[] = [
  'brand',
  'success',
  'warning',
  'danger',
  'important',
  'informative',
  'severe',
  'subtle',
];
const SIZES: BadgeSize[] = ['tiny', 'extra-small', 'small', 'medium', 'large', 'extra-large'];
const SHAPES: Shape[] = ['circular', 'rounded', 'square'];

const meta = {
  title: 'Components/Data Display/Badge',
  component: Badge,
  argTypes: {
    ...badgeAppearanceArgType,
    ...badgeColorArgType,
    size: { control: 'select', options: SIZES },
    shape: { control: 'select', options: SHAPES },
  },
  args: {
    children: 'Badge',
    appearance: 'filled',
    color: 'brand',
    shape: 'circular',
    size: 'medium',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Appearances: Story = {
  render: (args) => (
    <div className="flex gap-2">
      {APPEARANCES.map((appearance) => (
        <Badge key={appearance} {...args} appearance={appearance}>
          {appearance}
        </Badge>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {APPEARANCES.map((appearance) => (
        <div key={appearance} className="flex gap-2">
          {COLORS.map((color) => (
            <Badge key={color} {...args} appearance={appearance} color={color}>
              {color}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
};

/**
 * `important` is Fluent's neutral high-emphasis color: near black with white text in the light
 * theme, inverted in the dark one. Through 0.x it drew the dark orange that `severe` draws; use
 * `severe` for that look.
 */
export const ImportantAndSevere: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {APPEARANCES.map((appearance) => (
        <div key={appearance} className="flex gap-2">
          <Badge {...args} appearance={appearance} color="important">
            important
          </Badge>
          <Badge {...args} appearance={appearance} color="severe">
            severe
          </Badge>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {SIZES.map((size) => (
        <Badge key={size} {...args} size={size}>
          {size}
        </Badge>
      ))}
    </div>
  ),
};

/** `shape` sets the corners: a pill, softly rounded or square. */
export const Shapes: Story = {
  argTypes: { shape: { control: false } },
  render: (args) => (
    <div className="flex items-center gap-2">
      {SHAPES.map((shape) => (
        <Badge key={shape} {...args} shape={shape}>
          {shape}
        </Badge>
      ))}
    </div>
  ),
};

/** `icon` draws a glyph before the text, or after it with `iconPosition`. */
export const WithIcon: Story = {
  args: {
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M6.5 11.2 3.3 8l-1 1 4.2 4.2 7.2-7.2-1-1z" />
      </svg>
    ),
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Badge {...args}>Before</Badge>
      <Badge {...args} iconPosition="after">
        After
      </Badge>
      <Badge {...args} aria-label="Verified" children={undefined} />
    </div>
  ),
};

/** `size="tiny"` is a 6px dot with no content: name it with `aria-label`. */
export const Tiny: Story = {
  args: { size: 'tiny', 'aria-label': 'Unread', children: undefined },
  render: (args) => (
    <div className="flex items-center gap-3">
      {APPEARANCES.map((appearance) => (
        <Badge key={appearance} {...args} appearance={appearance} aria-label={appearance} />
      ))}
    </div>
  ),
};
