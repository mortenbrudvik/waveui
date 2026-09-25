import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Menu } from '../src';

const meta = {
  title: 'Components/Navigation/Menu',
  component: Menu,
  args: {
    'aria-label': 'File',
    children: (
      <>
        <Menu.Item>New File</Menu.Item>
        <Menu.Item>Open File</Menu.Item>
        <Menu.Item>Save</Menu.Item>
      </>
    ),
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A static menu: one item is the tab stop; arrows, Home/End and typeahead move between items. */
export const Default: Story = {};

/** Icons are decorative (`aria-hidden`), so they are not part of the item names. */
export const WithIcons: Story = {
  args: {
    'aria-label': 'Edit',
    children: (
      <>
        <Menu.Item icon={{ children: '✂️' }}>Cut</Menu.Item>
        <Menu.Item icon={{ children: '📋' }}>Copy</Menu.Item>
        <Menu.Item icon={{ children: '📌' }}>Paste</Menu.Item>
      </>
    ),
  },
};

/** Disabled items are announced as unavailable and skipped by keyboard navigation. */
export const WithDisabled: Story = {
  args: {
    'aria-label': 'Edit',
    children: (
      <>
        <Menu.Item>Undo</Menu.Item>
        <Menu.Item>Redo</Menu.Item>
        <Menu.Item disabled>Paste (empty clipboard)</Menu.Item>
      </>
    ),
  },
};

export const WithDivider: Story = {
  args: {
    children: (
      <>
        <Menu.Item>New File</Menu.Item>
        <Menu.Item>Open File</Menu.Item>
        <Menu.Divider />
        <Menu.Item>Save</Menu.Item>
        <Menu.Item>Save As</Menu.Item>
        <Menu.Divider />
        <Menu.Item>Exit</Menu.Item>
      </>
    ),
  },
};

export const WithShortcuts: Story = {
  args: {
    children: (
      <>
        <Menu.Item shortcut="Ctrl+N">New File</Menu.Item>
        <Menu.Item shortcut="Ctrl+O">Open File</Menu.Item>
        <Menu.Divider />
        <Menu.Item shortcut="Ctrl+S">Save</Menu.Item>
        <Menu.Item shortcut="Ctrl+Shift+S">Save As</Menu.Item>
      </>
    ),
  },
};

/**
 * A menu button: `Menu.Trigger` merges `aria-haspopup`, `aria-expanded` and the open handlers
 * onto its child, and `Menu.Popover` renders the menu in a portal next to it. Selecting an item
 * closes the menu and returns focus to the trigger; Escape and outside clicks close it too.
 */
export const WithTrigger: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <Button>Actions</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item onClick={fn()} shortcut="Ctrl+E">
            Edit
          </Menu.Item>
          <Menu.Item onClick={fn()}>Duplicate</Menu.Item>
          <Menu.Divider />
          <Menu.Item disabled>Archive</Menu.Item>
          <Menu.Item onClick={fn()}>Delete</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

const LONG_MENU_ITEMS = Array.from({ length: 40 }, (_, index) => `Command ${index + 1}`);

/**
 * A menu taller than the space next to its trigger: `Menu.Popover` is limited to the available
 * height and scrolls inside the viewport. Moving focus with the arrow keys, Home, End or typeahead
 * scrolls the focused item into view.
 */
export const LongMenu: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <Button>Commands</Button>
        </Menu.Trigger>
        <Menu.Popover>
          {LONG_MENU_ITEMS.map((label) => (
            <Menu.Item key={label} onClick={fn()}>
              {label}
            </Menu.Item>
          ))}
        </Menu.Popover>
      </>
    ),
  },
};
