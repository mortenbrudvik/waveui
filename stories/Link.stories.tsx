import type { Meta, StoryObj } from '@storybook/react';
import { Link } from '../src';

const meta = {
  title: 'Components/Button/Link',
  component: Link,
  argTypes: {
    variant: {
      control: 'select',
      options: ['inline', 'standalone', 'subtle'],
    },
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'A link',
    href: '#',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled link',
    href: '#',
    disabled: true,
  },
};

export const AsButton: Story = {
  args: {
    as: 'button',
    children: 'Button styled as link',
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Link href="#" variant="inline">Inline</Link>
      <Link href="#" variant="standalone">Standalone</Link>
      <Link href="#" variant="subtle">Subtle</Link>
    </div>
  ),
};
