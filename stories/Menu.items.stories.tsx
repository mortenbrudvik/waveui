import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Menu } from '../src';
import type { CheckedValues, MenuProps } from '../src';
import {
  MenuItemCheckbox,
  MenuItemRadio,
  MenuItemSwitch,
} from '../src/components/navigation/Menu.selectable';
import { MenuGroup, MenuGroupHeader } from '../src/components/navigation/Menu.group';
import { MenuItemLink } from '../src/components/navigation/Menu.link';

/*
 * The new menu item kinds, imported from their modules until they join the `Menu` compound
 * (`Menu.ItemCheckbox`, `Menu.ItemRadio`, `Menu.ItemSwitch`, `Menu.Group`, `Menu.GroupHeader`,
 * `Menu.ItemLink`) and these stories move into the Menu stories.
 */

const viewItems = (
  <>
    <MenuItemCheckbox name="view" value="ruler">
      Ruler
    </MenuItemCheckbox>
    <MenuItemCheckbox name="view" value="gridlines">
      Gridlines
    </MenuItemCheckbox>
    <MenuItemCheckbox name="view" value="status-bar">
      Status bar
    </MenuItemCheckbox>
  </>
);

const sortItems = (
  <>
    <MenuItemRadio name="sort" value="name">
      Name
    </MenuItemRadio>
    <MenuItemRadio name="sort" value="modified">
      Date modified
    </MenuItemRadio>
    <MenuItemRadio name="sort" value="size">
      Size
    </MenuItemRadio>
  </>
);

const meta = {
  title: 'Components/Navigation/MenuItems',
  component: Menu,
  args: {
    onCheckedValuesChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <Button>View</Button>
        </Menu.Trigger>
        <Menu.Popover>{viewItems}</Menu.Popover>
      </>
    ),
  },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Checkbox items (`role="menuitemcheckbox"`) bound to the Menu's `checkedValues` by `name` and
 * `value`. Space toggles the focused item and keeps the menu open; Enter and a click toggle it and
 * close the menu. A check shows while an item is checked.
 */
export const CheckboxItems: Story = {
  args: {
    defaultCheckedValues: { view: ['ruler', 'status-bar'] },
  },
};

/**
 * Radio items (`role="menuitemradio"`): checking one unchecks the others of its `name`. The set
 * sits in a `Menu.Group` labelled by its `Menu.GroupHeader`, so assistive technology announces it
 * as one set.
 */
export const RadioItems: Story = {
  args: {
    defaultCheckedValues: { sort: ['modified'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>Sort</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <MenuGroup>
            <MenuGroupHeader>Sort by</MenuGroupHeader>
            {sortItems}
          </MenuGroup>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * Switch items are checkbox items drawn as a switch at the end of the row. With
 * `persistOnItemClick`, the menu stays open after every activation, which suits a menu of toggles.
 */
export const SwitchItems: Story = {
  args: {
    persistOnItemClick: true,
    defaultCheckedValues: { editor: ['autosave', 'word-wrap'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>Editor settings</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <MenuItemSwitch name="editor" value="autosave">
            Autosave
          </MenuItemSwitch>
          <MenuItemSwitch name="editor" value="word-wrap">
            Word wrap
          </MenuItemSwitch>
          <MenuItemSwitch name="editor" value="minimap">
            Minimap
          </MenuItemSwitch>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * The labels line up whatever each item shows: once an item of the menu shows a check (or an
 * icon), every item keeps an empty column of that width, and shortcuts sit at the end.
 */
export const MixedColumns: Story = {
  args: {
    'aria-label': 'Format',
    defaultCheckedValues: { format: ['bold'] },
    children: (
      <>
        <MenuItemCheckbox name="format" value="bold" shortcut="Ctrl+B">
          Bold
        </MenuItemCheckbox>
        <MenuItemCheckbox name="format" value="italic" shortcut="Ctrl+I">
          Italic
        </MenuItemCheckbox>
        <Menu.Divider />
        <Menu.Item icon={{ children: '✂️' }} shortcut="Ctrl+X">
          Cut
        </Menu.Item>
        <Menu.Item icon={{ children: '📋' }} shortcut="Ctrl+C">
          Copy
        </Menu.Item>
        <Menu.Item shortcut="Ctrl+V">Paste</Menu.Item>
        <Menu.Divider />
        <MenuItemSwitch name="format" value="spellcheck">
          Check spelling
        </MenuItemSwitch>
      </>
    ),
  },
};

/**
 * Checkable items work in a static menu too: activation changes the checked values and closes
 * nothing. `checkedValues` does not make a Menu a popup menu.
 */
export const StaticCheckable: Story = {
  args: {
    'aria-label': 'View options',
    defaultCheckedValues: { view: ['gridlines'], sort: ['name'] },
    children: (
      <>
        <MenuGroup aria-label="Show">{viewItems}</MenuGroup>
        <Menu.Divider />
        <MenuGroup>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortItems}
        </MenuGroup>
      </>
    ),
  },
};

function ControlledViewMenu(args: MenuProps) {
  const { onCheckedValuesChange } = args;
  const [checkedValues, setCheckedValues] = React.useState<CheckedValues>({
    view: ['ruler'],
    sort: ['name'],
  });
  const shown = checkedValues.view?.join(', ') || 'nothing';
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-body-1 text-foreground">
        Showing: {shown}. Sorted by: {checkedValues.sort?.[0] ?? 'none'}.
      </p>
      <Menu
        {...args}
        checkedValues={checkedValues}
        onCheckedValuesChange={(next, details) => {
          setCheckedValues(next);
          onCheckedValuesChange?.(next, details);
        }}
      />
      <Button onClick={() => setCheckedValues({ view: [], sort: ['name'] })}>Reset</Button>
    </div>
  );
}

/**
 * Controlled `checkedValues` with `onCheckedValuesChange(checkedValues, details)`: the callback
 * receives a fresh object (safe to store), then `details` with the group's `name`, its
 * `checkedItems` and the `event`.
 */
export const ControlledCheckedValues: Story = {
  args: {
    'aria-label': 'View',
    children: (
      <>
        {viewItems}
        <Menu.Divider />
        <MenuGroup>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortItems}
        </MenuGroup>
      </>
    ),
  },
  render: (args) => <ControlledViewMenu {...args} />,
};

/**
 * Groups: `Menu.Group` is a `role="group"` named by its `Menu.GroupHeader` (a direct child). The
 * header is not an item: the arrow keys and typeahead skip it. Separate groups with `Menu.Divider`.
 */
export const Groups: Story = {
  args: {
    defaultCheckedValues: { view: ['ruler'], sort: ['name'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>View</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <MenuGroup>
            <MenuGroupHeader>Show</MenuGroupHeader>
            {viewItems}
          </MenuGroup>
          <Menu.Divider />
          <MenuGroup>
            <MenuGroupHeader>Sort by</MenuGroupHeader>
            {sortItems}
          </MenuGroup>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * Link items (`role="menuitem"` on the anchor) navigate natively: Enter and Space follow them,
 * Ctrl, Cmd or Shift open a new tab or window, and every click closes the menu. Middle click and
 * the link's context menu keep working. A router link renders through `as`.
 */
export const LinkItems: Story = {
  args: {
    children: (
      <>
        <Menu.Trigger>
          <Button>Account</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <MenuItemLink href="#profile">Profile</MenuItemLink>
          <MenuItemLink href="#settings" shortcut="Ctrl+,">
            Settings
          </MenuItemLink>
          <MenuItemLink href="#billing" disabled>
            Billing
          </MenuItemLink>
          <Menu.Divider />
          <MenuItemLink
            href="https://example.com/help"
            target="_blank"
            rel="noreferrer"
            icon={{ children: '↗' }}
          >
            Help center (opens in a new window)
          </MenuItemLink>
        </Menu.Popover>
      </>
    ),
  },
};
