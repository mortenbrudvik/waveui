import type { Meta, StoryObj } from '@storybook/react';
import { AvatarGroup, Avatar, partitionAvatarGroupItems } from '../src';
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

/** `stack` overlaps the avatars, `spread` leaves a gap, `pie` shows up to three as wedges. */
export const Layouts: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-8">
      {(['stack', 'spread', 'pie'] as const).map((layout) => (
        <AvatarGroup key={layout} {...args} layout={layout} aria-label={`Team, ${layout}`}>
          {PEOPLE.slice(0, 4).map((name) => (
            <Avatar key={name} name={name} color="colorful" />
          ))}
        </AvatarGroup>
      ))}
    </div>
  ),
};

/** Members take the group's size; a member with a size of its own keeps it. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['small', 'medium', 'large'] as const).map((size) => (
        <AvatarGroup key={size} {...args} size={size} max={3} aria-label={`Team, ${size}`}>
          {PEOPLE.map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
      ))}
    </div>
  ),
};

/** The icon indicator, and a count past 99 that reads `99+`. */
export const OverflowIndicators: Story = {
  render: (args) => (
    <div className="flex items-center gap-8">
      <AvatarGroup {...args} max={2} overflowIndicator="icon" aria-label="Icon indicator">
        {PEOPLE.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarGroup>
      <AvatarGroup {...args} max={0} aria-label="Many members">
        {Array.from({ length: 120 }, (_, i) => (
          <Avatar key={i} name={`Member ${i + 1}`} />
        ))}
      </AvatarGroup>
    </div>
  ),
};

/**
 * The compound form: write the members as `AvatarGroup.Item`s and the overflow as
 * `AvatarGroup.Popover`, splitting the list yourself with `partitionAvatarGroupItems`.
 */
export const CompoundForm: Story = {
  render: (args) => {
    const { inlineItems, overflowItems } = partitionAvatarGroupItems({
      items: PEOPLE,
      maxInlineItems: 2,
    });
    return (
      <AvatarGroup {...args} aria-label="Project team">
        {inlineItems.map((name) => (
          <AvatarGroup.Item key={name} name={name} />
        ))}
        {overflowItems && (
          <AvatarGroup.Popover>
            {overflowItems.map((name) => (
              <AvatarGroup.Item key={name} name={name} />
            ))}
          </AvatarGroup.Popover>
        )}
      </AvatarGroup>
    );
  },
};
