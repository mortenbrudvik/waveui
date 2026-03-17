import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ToggleButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/ToggleButton',
  component: ToggleButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Toggle',
  },
};

export const Pressed: Story = {
  args: {
    children: 'Pressed',
    defaultPressed: true,
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Bold',
    icon: { children: 'B' },
  },
};

export const Controlled: Story = {
  render: () => {
    const [pressed, setPressed] = useState(false);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ToggleButton pressed={pressed} onPressedChange={setPressed}>
          {pressed ? 'On' : 'Off'}
        </ToggleButton>
        <span>State: {pressed ? 'pressed' : 'not pressed'}</span>
      </div>
    );
  },
};
