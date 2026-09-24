import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '../src';
import type { TextWeight } from '../src';

const weights = ['regular', 'semibold', 'bold'] as const satisfies readonly TextWeight[];

const meta = {
  title: 'Components/Input/Label',
  component: Label,
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    weight: {
      control: 'select',
      options: weights,
    },
    required: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: {
    children: 'First name',
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

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
    children: 'Semibold label',
    weight: 'semibold',
  },
};

export const Bold: Story = {
  args: {
    children: 'Bold label',
    weight: 'bold',
  },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label {...args} size="small">
        Small label
      </Label>
      <Label {...args} size="medium">
        Medium label
      </Label>
      <Label {...args} size="large">
        Large label
      </Label>
    </div>
  ),
};
