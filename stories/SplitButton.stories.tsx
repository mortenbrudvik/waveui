import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Menu, SplitButton } from '../src';
import type { IconPosition } from '../src';
import { appearanceArgType, sizeArgType } from './_helpers';

/** Decorative save glyph for the primary action. */
const SaveIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
    <path
      d="M3 2.5h8l2.5 2.5v8.5h-11zM5.5 2.5v3h5v-3M5 13.5v-4h6v4"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

/** Decorative "more" glyph (three dots) for the menu half. */
const MoreIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <circle cx="3.5" cy="8" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="12.5" cy="8" r="1.25" />
  </svg>
);

/** `iconPosition` (`IconPosition`) of the primary action: before or after its label. */
const iconPositionArgType = {
  iconPosition: {
    control: 'inline-radio',
    options: ['before', 'after'] as const satisfies readonly IconPosition[],
  },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Button/SplitButton',
  component: SplitButton,
  argTypes: {
    ...appearanceArgType,
    ...sizeArgType,
    ...iconPositionArgType,
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

/** `icon` decorates the primary action (`iconPosition` moves it after the label). */
export const WithIcon: Story = {
  args: {
    icon: <SaveIcon />,
  },
};

/**
 * `menuIcon` replaces the chevron of the menu half. The menu half always shows an indicator:
 * unlike `MenuButton`, a `menuIcon` that renders nothing keeps the chevron (and warns).
 */
export const CustomMenuIcon: Story = {
  args: {
    menuIcon: <MoreIcon />,
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
