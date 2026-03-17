import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip, Button } from '../src';

const meta = {
  title: 'Components/Overlays/Tooltip',
  component: Tooltip,
  argTypes: {
    variant: {
      control: 'select',
      options: ['dark', 'light'],
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is a tooltip',
    children: <Button>Hover me</Button>,
  },
};

export const DarkVariant: Story = {
  args: {
    content: 'Dark tooltip',
    variant: 'dark',
    children: <Button appearance="primary">Dark Tooltip</Button>,
  },
};
