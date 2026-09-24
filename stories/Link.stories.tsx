import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Link, Text } from '../src';

const meta = {
  title: 'Components/Button/Link',
  component: Link,
  argTypes: {
    appearance: {
      control: 'select',
      options: ['inline', 'standalone', 'subtle'],
    },
  },
  args: {
    children: 'Read the documentation',
    href: '#link-docs',
    onClick: fn(),
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Inline links are always underlined, so they stand out from body text without relying on color. */
export const InlineInText: Story = {
  render: (args) => (
    <Text as="p">
      Before you start, <Link {...args}>read the documentation</Link> and check the release notes.
    </Text>
  ),
};

/** Standalone links are only for places where the position already marks them as links. */
export const Standalone: Story = {
  args: {
    appearance: 'standalone',
    children: 'See pricing',
  },
};

/** Subtle links look like body text until hovered: never use them inside a paragraph. */
export const Subtle: Story = {
  args: {
    appearance: 'subtle',
    children: 'Privacy',
  },
};

/** A disabled link drops its `href`, keeps `role="link"` and gets `aria-disabled`. */
export const Disabled: Story = {
  args: {
    children: 'Disabled link',
    disabled: true,
  },
};

/** `as="button"` renders a `<button type="button">` styled as a link. */
export const AsButton: Story = {
  args: {
    as: 'button',
    href: undefined,
    children: 'Show more',
  },
};

/** Every appearance side by side (the appearance control is off here). */
export const Appearances: Story = {
  argTypes: {
    appearance: { control: false },
  },
  render: (args) => (
    <div className="flex gap-4">
      <Link {...args} appearance="inline">
        Inline
      </Link>
      <Link {...args} appearance="standalone">
        Standalone
      </Link>
      <Link {...args} appearance="subtle">
        Subtle
      </Link>
    </div>
  ),
};
