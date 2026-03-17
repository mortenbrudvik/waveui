import type { Meta, StoryObj } from '@storybook/react';
import { AvatarGroup, Avatar } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Data Display/AvatarGroup',
  component: AvatarGroup,
  argTypes: {
    ...sizeArgType,
  },
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'medium',
  },
  render: (args) => (
    <AvatarGroup {...args}>
      <Avatar name="Alice Smith" />
      <Avatar name="Bob Jones" />
      <Avatar name="Carol White" />
    </AvatarGroup>
  ),
};

export const MaxOverflow: Story = {
  args: {
    max: 3,
    size: 'medium',
  },
  render: (args) => (
    <AvatarGroup {...args}>
      <Avatar name="Alice Smith" />
      <Avatar name="Bob Jones" />
      <Avatar name="Carol White" />
      <Avatar name="Dave Brown" />
      <Avatar name="Eve Davis" />
    </AvatarGroup>
  ),
};
