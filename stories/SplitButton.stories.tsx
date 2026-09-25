import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Menu, SplitButton } from '../src';
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
 * The chevron opens a menu: `Menu.Trigger` with a render-prop child passes its props (`id`,
 * `aria-expanded`, `aria-controls`, the open handlers and the ref) to `menuButtonProps`, so only
 * the chevron is the menu button and the primary half keeps running its own action. The menu is
 * labelled by the chevron; selecting an item, Escape or an outside click closes it and returns
 * focus to the chevron.
 */
export const WithMenu: Story = {
  render: (args) => (
    <Menu>
      <Menu.Trigger>
        {(triggerProps) => <SplitButton {...args} menuButtonProps={triggerProps} />}
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item onClick={fn()}>Save as…</Menu.Item>
        <Menu.Item onClick={fn()}>Save a copy</Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={fn()}>Save all</Menu.Item>
      </Menu.Popover>
    </Menu>
  ),
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
