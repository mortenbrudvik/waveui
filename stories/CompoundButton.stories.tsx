import type { Meta, StoryObj } from '@storybook/react';
import { CompoundButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/CompoundButton',
  component: CompoundButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof CompoundButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Compound Button',
  },
};

export const WithSecondaryText: Story = {
  args: {
    children: 'Send Mail',
    secondaryText: 'Opens your email client',
  },
};

export const Primary: Story = {
  args: {
    appearance: 'primary',
    children: 'Create Account',
    secondaryText: 'Free for 30 days',
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
      <CompoundButton size="small" secondaryText="Small size">
        Small
      </CompoundButton>
      <CompoundButton size="medium" secondaryText="Medium size">
        Medium
      </CompoundButton>
      <CompoundButton size="large" secondaryText="Large size">
        Large
      </CompoundButton>
    </div>
  ),
};
