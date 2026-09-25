import type { Meta, StoryObj } from '@storybook/react';
import { Field, Input, Select, Slider, Textarea } from '../src';

const meta = {
  title: 'Components/Input/Field',
  component: Field,
  args: {
    label: 'Name',
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Field {...args}>
      <Input placeholder="Enter your name" />
    </Field>
  ),
};

export const WithHint: Story = {
  args: {
    label: 'Email',
    hint: "We'll never share your email.",
  },
  render: (args) => (
    <Field {...args}>
      <Input type="email" placeholder="you@example.com" />
    </Field>
  ),
};

export const WithError: Story = {
  args: {
    label: 'Password',
    error: 'Password must be at least 8 characters.',
  },
  render: (args) => (
    <Field {...args}>
      <Input type="password" />
    </Field>
  ),
};

export const Required: Story = {
  args: {
    label: 'Username',
    required: true,
  },
  render: (args) => (
    <Field {...args}>
      <Input placeholder="Required field" />
    </Field>
  ),
};

export const WithSelect: Story = {
  args: {
    label: 'Country',
    hint: 'Where you live today.',
    required: true,
  },
  render: (args) => (
    <Field {...args}>
      <Select defaultValue="">
        <option value="" disabled>
          Choose a country
        </option>
        <option value="no">Norway</option>
        <option value="se">Sweden</option>
        <option value="dk">Denmark</option>
      </Select>
    </Field>
  ),
};

export const WithTextarea: Story = {
  args: {
    label: 'Description',
    error: 'Description is required.',
  },
  render: (args) => (
    <Field {...args}>
      <Textarea placeholder="Describe the issue" />
    </Field>
  ),
};

export const WithSlider: Story = {
  args: {
    label: 'Volume',
    hint: 'Applies to every output device.',
  },
  render: (args) => (
    <Field {...args}>
      <Slider min={0} max={100} defaultValue={40} />
    </Field>
  ),
};
