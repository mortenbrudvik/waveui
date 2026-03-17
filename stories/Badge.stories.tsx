import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../src';
import { badgeAppearanceArgType, badgeColorArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Data Display/Badge',
  component: Badge,
  argTypes: {
    ...badgeAppearanceArgType,
    ...badgeColorArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
    appearance: 'filled',
    color: 'brand',
    size: 'medium',
  },
};

export const Appearances: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge appearance="filled" color="brand">
        Filled
      </Badge>
      <Badge appearance="tint" color="brand">
        Tint
      </Badge>
      <Badge appearance="outline" color="brand">
        Outline
      </Badge>
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge color="brand">Brand</Badge>
      <Badge color="success">Success</Badge>
      <Badge color="warning">Warning</Badge>
      <Badge color="danger">Danger</Badge>
      <Badge color="important">Important</Badge>
      <Badge color="informative">Informative</Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Badge size="extra-small">XS</Badge>
      <Badge size="small">SM</Badge>
      <Badge size="medium">MD</Badge>
      <Badge size="large">LG</Badge>
      <Badge size="extra-large">XL</Badge>
    </div>
  ),
};
