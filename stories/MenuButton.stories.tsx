import type { Meta, StoryObj } from '@storybook/react';
import { MenuButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/MenuButton',
  component: MenuButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Menu',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Options',
    icon: { children: '⚙' },
  },
};

export const Expanded: Story = {
  args: {
    children: 'Open Menu',
    expanded: true,
  },
};
