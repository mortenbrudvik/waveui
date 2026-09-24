import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Tag } from '../src';
/** The props Storybook passes (the polymorphic Tag's props for any `as`). */
type TagStoryProps = React.ComponentProps<typeof Tag>;

const meta = {
  title: 'Components/Data Display/Tag',
  component: Tag,
  args: {
    children: 'Tag label',
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keeps the tag's visibility in local state so dismissing it actually removes it. */
function DismissibleTag(props: TagStoryProps) {
  const { onDismiss, ...rest } = props;
  const [visible, setVisible] = React.useState(true);
  if (!visible) {
    return (
      <Button appearance="subtle" size="small" onClick={() => setVisible(true)}>
        Restore tag
      </Button>
    );
  }
  return (
    <Tag
      {...rest}
      onDismiss={() => {
        onDismiss?.();
        setVisible(false);
      }}
    />
  );
}

export const Default: Story = {};

/** The dismiss button is named "Dismiss" plus the tag content ("Dismiss Dismissible tag"). */
export const Dismissible: Story = {
  args: {
    children: 'Dismissible tag',
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => <DismissibleTag {...args} />,
};

/** Every dismiss button of a filter bar has its own name ("Remove Red", "Remove Blue", …). */
export const FilterGroup: Story = {
  args: {
    dismissible: true,
    dismissLabel: 'Remove',
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {['Red', 'Blue', 'Large'].map((filter) => (
        <DismissibleTag key={filter} {...args}>
          {filter}
        </DismissibleTag>
      ))}
    </div>
  ),
};

/** `dismissIcon` replaces only the icon inside the built-in dismiss button. */
export const CustomDismissIcon: Story = {
  args: {
    children: 'Custom icon',
    dismissible: true,
    onDismiss: fn(),
    dismissIcon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
        <path d="M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  render: (args) => <DismissibleTag {...args} />,
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="me-1"
        >
          <circle cx="8" cy="8" r="6" />
        </svg>
        With icon
      </>
    ),
  },
};

/** Polymorphic: `as="a"` renders a link chip (anchor props are type-checked). */
export const AsLink: Story = {
  args: {
    as: 'a',
    href: '#topics/react',
    children: 'React',
  },
};
