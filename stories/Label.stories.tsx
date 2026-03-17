import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '../src';

const meta = {
  title: 'Input/Label',
  component: Label,
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    weight: {
      control: 'select',
      options: ['regular', 'semibold'],
    },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'First name',
  },
};

export const Required: Story = {
  args: {
    children: 'Email address',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled label',
    disabled: true,
  },
};

export const Semibold: Story = {
  args: {
    children: 'Bold label',
    weight: 'semibold',
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label size="small">Small label</Label>
      <Label size="medium">Medium label</Label>
      <Label size="large">Large label</Label>
    </div>
  ),
};
