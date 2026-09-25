import type { Meta, StoryObj } from '@storybook/react';
import { AvatarGroup, Avatar } from '../src';
import { sizeArgType } from './_helpers';

const PEOPLE = ['Alice Smith', 'Bob Jones', 'Carol White', 'Dave Brown', 'Eve Davis'];

const meta = {
  title: 'Components/Data Display/AvatarGroup',
  component: AvatarGroup,
  argTypes: {
    ...sizeArgType,
  },
  args: {
    'aria-label': 'Project team',
    size: 'medium',
  },
  render: (args) => (
    <AvatarGroup {...args}>
      {PEOPLE.map((name) => (
        <Avatar key={name} name={name} size={args.size} />
      ))}
    </AvatarGroup>
  ),
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The overflow button lists the hidden members' names in a popup. */
export const MaxOverflow: Story = {
  args: {
    max: 3,
  },
};

export const Small: Story = {
  args: {
    max: 2,
    size: 'small',
  },
};
