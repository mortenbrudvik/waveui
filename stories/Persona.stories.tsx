import type { Meta, StoryObj } from '@storybook/react';
import { Persona } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Data Display/Persona',
  component: Persona,
  argTypes: {
    ...sizeArgType,
    status: {
      control: 'select',
      options: ['available', 'busy', 'away', 'offline', 'dnd', 'oof'],
    },
  },
} satisfies Meta<typeof Persona>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Jane Doe',
    size: 'medium',
  },
};

export const WithBadge: Story = {
  args: {
    name: 'Jane Doe',
    status: 'available',
    size: 'medium',
  },
};

export const WithSecondaryText: Story = {
  args: {
    name: 'Jane Doe',
    secondaryText: 'Software Engineer',
    status: 'busy',
    size: 'medium',
  },
};
