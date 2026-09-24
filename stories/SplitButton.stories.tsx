import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { SplitButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Button/SplitButton',
  component: SplitButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
  args: {
    children: 'Save',
    'aria-label': 'Save options',
    onClick: fn(),
    onMenuClick: fn(),
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    appearance: 'primary',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/** `menuButtonLabel` names the chevron button; localize it. */
export const LocalizedMenuLabel: Story = {
  args: {
    children: 'Speichern',
    'aria-label': 'Speicheroptionen',
    menuButtonLabel: 'Weitere Optionen',
  },
};

/**
 * `menuButtonProps` reach the chevron button: pass the render-prop props of `Menu.Trigger`, or
 * wire `aria-expanded`/`aria-controls` yourself.
 */
export const MenuOpen: Story = {
  args: {
    menuButtonProps: { 'aria-expanded': true },
  },
};

/** The chevron keeps a 24×24px target at every size (an extra-small SplitButton is 24px tall). */
export const Sizes: Story = {
  argTypes: {
    size: { control: false },
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      <SplitButton {...args} size="extra-small" aria-label="Extra small save options" />
      <SplitButton {...args} size="small" aria-label="Small save options" />
      <SplitButton {...args} size="medium" aria-label="Medium save options" />
      <SplitButton {...args} size="large" aria-label="Large save options" />
    </div>
  ),
};
