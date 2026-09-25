import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ToggleButton, Text } from '../src';
import { appearanceArgType, iconPositionArgType, sizeArgType } from './_helpers';

/** Decorative bold glyph (the ToggleButton hides its icon slot from assistive technology). */
const BoldIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M4.5 2.5h4a3 3 0 0 1 2.1 5.1A3.25 3.25 0 0 1 9 13.5H4.5zm1.5 1.5v3h2.5a1.5 1.5 0 0 0 0-3zm0 4.5v3.5h3a1.75 1.75 0 0 0 0-3.5z" />
  </svg>
);

const meta = {
  title: 'Components/Button/ToggleButton',
  component: ToggleButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
    ...iconPositionArgType,
  },
  args: {
    children: 'Bold',
    onPressedChange: fn(),
  },
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pressed: Story = {
  args: {
    defaultPressed: true,
  },
};

/**
 * The icon is decorative: the label "Bold" is the accessible name. `iconPosition` puts it before
 * the label (the default) or, as here, after it.
 */
export const WithIcon: Story = {
  args: {
    icon: <BoldIcon />,
    iconPosition: 'after',
  },
};

/** An icon-only toggle has no visible label, so it needs an `aria-label`. */
export const IconOnly: Story = {
  args: {
    children: undefined,
    icon: <BoldIcon />,
    'aria-label': 'Bold',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const DisabledPressed: Story = {
  args: {
    disabled: true,
    defaultPressed: true,
  },
};

/** Controlled: the parent owns `pressed` and updates it from `onPressedChange`. */
export const Controlled: Story = {
  render: function ControlledStory(args) {
    const [pressed, setPressed] = useState(false);
    return (
      <div className="flex items-center gap-2">
        <ToggleButton
          {...args}
          pressed={pressed}
          onPressedChange={(next) => {
            setPressed(next);
            args.onPressedChange?.(next);
          }}
        >
          {pressed ? 'On' : 'Off'}
        </ToggleButton>
        <Text>State: {pressed ? 'pressed' : 'not pressed'}</Text>
      </div>
    );
  },
};
