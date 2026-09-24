import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src';
import type { BadgeAppearance, BadgeColor, Size } from '../src';
import { badgeAppearanceArgType, badgeColorArgType, sizeArgType } from './_helpers';

const APPEARANCES: BadgeAppearance[] = ['filled', 'tint', 'outline'];
const COLORS: BadgeColor[] = ['brand', 'success', 'warning', 'danger', 'important', 'informative'];
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
