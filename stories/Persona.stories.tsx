import type { Meta, StoryObj } from '@storybook/react';
import { Persona } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Data Display/Persona',
  component: Persona,
  argTypes: {
    ...sizeArgType,
    status: {
      control: 'select',
      options: ['available', 'busy', 'away', 'offline', 'dnd', 'oof'],
    },
  },
  args: {
    name: 'Jane Doe',
    size: 'medium',
  },
} satisfies Meta<typeof Persona>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBadge: Story = {
  args: {
    status: 'available',
  },
};

export const WithSecondaryText: Story = {
  args: {
    secondaryText: 'Software Engineer',
    status: 'busy',
  },
};

export const WithImage: Story = {
  args: {
    src: 'https://i.pravatar.cc/150?u=persona-story',
    secondaryText: 'Product Designer',
    status: 'away',
  },
};
