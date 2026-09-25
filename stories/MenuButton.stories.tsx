import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Menu, MenuButton } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

/** Decorative gear icon (the MenuButton hides its icon slot from assistive technology). */
const GearIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <circle cx="8" cy="8" r="2.5" strokeWidth="1.2" />
    <path
      d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);

const meta = {
  title: 'Components/Button/MenuButton',
  component: MenuButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
  },
  args: {
    children: 'Actions',
    onClick: fn(),
  },
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    appearance: 'primary',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Settings',
    icon: <GearIcon />,
  },
};

/** An icon-only menu button has no visible label, so it needs an `aria-label`. */
export const IconOnly: Story = {
  args: {
    children: undefined,
    icon: <GearIcon />,
    'aria-label': 'Settings',
  },
};

/**
 * A MenuButton opens a menu as the child of `Menu.Trigger`, which merges `id`, `aria-expanded`,
 * `aria-controls` (while open), the open handlers and the ref onto it — leave `expanded` unset.
 * Enter, Space and ArrowDown open the menu on its first item, ArrowUp on its last; selecting an
 * item, Escape or an outside click closes it and returns focus to the button.
 */
export const WithMenu: Story = {
  render: (args) => (
    <Menu>
      <Menu.Trigger>
        <MenuButton {...args} />
      </Menu.Trigger>
      <Menu.Popover>
        <Menu.Item onClick={fn()}>Edit</Menu.Item>
        <Menu.Item onClick={fn()}>Duplicate</Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={fn()}>Delete</Menu.Item>
      </Menu.Popover>
    </Menu>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

/** A custom indicator replaces the chevron; `menuIcon={false}` hides it. */
export const CustomMenuIcon: Story = {
  args: {
    menuIcon: <span className="text-caption-1">▾</span>,
  },
};
