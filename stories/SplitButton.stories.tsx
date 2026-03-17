import type { Meta, StoryObj } from '@storybook/react';
import { SplitButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/SplitButton',
  component: SplitButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Split Button',
    'aria-label': 'Split button example',
  },
};

export const Primary: Story = {
  args: {
    appearance: 'primary',
    children: 'Save',
    'aria-label': 'Save options',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
    'aria-label': 'Disabled split button',
  },
};
