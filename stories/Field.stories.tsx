import type { Meta, StoryObj } from '@storybook/react';
import { Field, Input } from '../src';

const meta = {
  title: 'Components/Input/Field',
  component: Field,
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Name',
  },
  render: (args) => (
    <Field {...args}>
      <Input placeholder="Enter your name" />
    </Field>
  ),
};

export const WithHint: Story = {
  render: () => (
    <Field label="Email" hint="We'll never share your email.">
      <Input placeholder="you@example.com" />
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field label="Password" error="Password must be at least 8 characters.">
      <Input type="password" />
    </Field>
  ),
};

export const Required: Story = {
  render: () => (
    <Field label="Username" required>
      <Input placeholder="Required field" />
    </Field>
  ),
};
