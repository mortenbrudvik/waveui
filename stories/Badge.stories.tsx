import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src';
import type { BadgeAppearance, BadgeColor, Size } from '../src';
import { badgeAppearanceArgType, badgeColorArgType, sizeArgType } from './_helpers';

const APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline'];
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
const SIZES: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];

const meta = {
  title: 'Components/Data Display/Badge',
  component: Badge,
  argTypes: {
    ...badgeAppearanceArgType,
    ...badgeColorArgType,
    ...sizeArgType,
  },
  args: {
    children: 'Badge',
    appearance: 'filled',
    color: 'brand',
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
 * `important` keeps its orange look through 0.x. In 1.0 it becomes Fluent's neutral high-emphasis
 * color (near black in the light theme). Use `severe` for the orange look: it renders the same
 * colors today and keeps them in 1.0.
 */
export const ImportantIn1: Story = {
  name: 'Important in 1.0',
  render: (args) => (
    <div className="flex flex-col gap-3 text-body-1 text-foreground">
      <p className="max-w-prose">
        <code>important</code> changes meaning in 1.0: it becomes a neutral high-emphasis color. Use{' '}
        <code>severe</code> to keep the orange look.
      </p>
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
