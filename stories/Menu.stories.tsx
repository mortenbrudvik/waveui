import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Menu, MenuButton } from '../src';
import type { CheckedValues, MenuProps } from '../src';

const meta = {
  title: 'Components/Navigation/Menu',
  component: Menu,
  args: {
    'aria-label': 'File',
    persistOnItemClick: false,
    openOnHover: false,
    openDelay: 250,
    closeDelay: 250,
    openOnContext: false,
    onCheckedValuesChange: fn(),
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

/**
 * Icons are decorative (`aria-hidden`), so they are not part of the item names. Once any item of a
 * menu shows an icon, every item keeps an icon column of the same width, so the labels line up.
 */
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

/**
 * A `max-h-*` class on `Menu.Popover` replaces the limit to the available height: this menu stops
 * at 256px (`max-h-64`) and scrolls, also where the viewport leaves it more room.
 */
export const LongMenuMaxHeight: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <Button>Commands</Button>
        </Menu.Trigger>
        <Menu.Popover className="max-h-64">
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

const viewItems = (
  <>
    <Menu.ItemCheckbox name="view" value="ruler">
      Ruler
    </Menu.ItemCheckbox>
    <Menu.ItemCheckbox name="view" value="gridlines">
      Gridlines
    </Menu.ItemCheckbox>
    <Menu.ItemCheckbox name="view" value="status-bar">
      Status bar
    </Menu.ItemCheckbox>
  </>
);

const sortItems = (
  <>
    <Menu.ItemRadio name="sort" value="name">
      Name
    </Menu.ItemRadio>
    <Menu.ItemRadio name="sort" value="modified">
      Date modified
    </Menu.ItemRadio>
    <Menu.ItemRadio name="sort" value="size">
      Size
    </Menu.ItemRadio>
  </>
);

/**
 * Checkbox items (`role="menuitemcheckbox"`) bound to the Menu's `checkedValues` by `name` and
 * `value`. Space toggles the focused item and keeps the menu open; Enter and a click toggle it and
 * close the menu. A check shows while an item is checked.
 */
export const CheckboxItems: Story = {
  args: {
    'aria-label': undefined,
    defaultCheckedValues: { view: ['ruler', 'status-bar'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>View</Button>
        </Menu.Trigger>
        <Menu.Popover>{viewItems}</Menu.Popover>
      </>
    ),
  },
};

/**
 * Radio items (`role="menuitemradio"`): checking one unchecks the others of its `name`. The set
 * sits in a `Menu.Group` labelled by its `Menu.GroupHeader`, so assistive technology announces it
 * as one set.
 */
export const RadioItems: Story = {
  args: {
    'aria-label': undefined,
    defaultCheckedValues: { sort: ['modified'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>Sort</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Group>
            <Menu.GroupHeader>Sort by</Menu.GroupHeader>
            {sortItems}
          </Menu.Group>
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
    'aria-label': undefined,
    persistOnItemClick: true,
    defaultCheckedValues: { editor: ['autosave', 'word-wrap'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>Editor settings</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.ItemSwitch name="editor" value="autosave">
            Autosave
          </Menu.ItemSwitch>
          <Menu.ItemSwitch name="editor" value="word-wrap">
            Word wrap
          </Menu.ItemSwitch>
          <Menu.ItemSwitch name="editor" value="minimap">
            Minimap
          </Menu.ItemSwitch>
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
        <Menu.ItemCheckbox name="format" value="bold" shortcut="Ctrl+B">
          Bold
        </Menu.ItemCheckbox>
        <Menu.ItemCheckbox name="format" value="italic" shortcut="Ctrl+I">
          Italic
        </Menu.ItemCheckbox>
        <Menu.Divider />
        <Menu.Item icon={{ children: '✂️' }} shortcut="Ctrl+X">
          Cut
        </Menu.Item>
        <Menu.Item icon={{ children: '📋' }} shortcut="Ctrl+C">
          Copy
        </Menu.Item>
        <Menu.Item shortcut="Ctrl+V">Paste</Menu.Item>
        <Menu.Divider />
        <Menu.ItemSwitch name="format" value="spellcheck">
          Check spelling
        </Menu.ItemSwitch>
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
        <Menu.Group aria-label="Show">{viewItems}</Menu.Group>
        <Menu.Divider />
        <Menu.Group>
          <Menu.GroupHeader>Sort by</Menu.GroupHeader>
          {sortItems}
        </Menu.Group>
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
        <Menu.Group>
          <Menu.GroupHeader>Sort by</Menu.GroupHeader>
          {sortItems}
        </Menu.Group>
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
    'aria-label': undefined,
    defaultCheckedValues: { view: ['ruler'], sort: ['name'] },
    children: (
      <>
        <Menu.Trigger>
          <Button>View</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Group>
            <Menu.GroupHeader>Show</Menu.GroupHeader>
            {viewItems}
          </Menu.Group>
          <Menu.Divider />
          <Menu.Group>
            <Menu.GroupHeader>Sort by</Menu.GroupHeader>
            {sortItems}
          </Menu.Group>
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
    'aria-label': undefined,
    children: (
      <>
        <Menu.Trigger>
          <Button>Account</Button>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.ItemLink href="#profile">Profile</Menu.ItemLink>
          <Menu.ItemLink href="#settings" shortcut="Ctrl+,">
            Settings
          </Menu.ItemLink>
          <Menu.ItemLink href="#billing" disabled>
            Billing
          </Menu.ItemLink>
          <Menu.Divider />
          <Menu.ItemLink
            href="https://example.com/help"
            target="_blank"
            rel="noreferrer"
            icon={{ children: '↗' }}
          >
            Help center (opens in a new window)
          </Menu.ItemLink>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * Submenus are nested `<Menu>`s: a `Menu.Trigger` around a `Menu.Item` opens one. ArrowRight
 * (ArrowLeft in RTL), Enter, Space, a click, or resting the mouse on the item opens it; ArrowLeft
 * and Escape close it and return to the item. Activating an item closes every level and returns
 * focus to "File"; Tab closes every level and tabbing continues from "File". A triangle between an
 * item and its open submenu keeps the submenu open while the mouse moves diagonally across the
 * other items, and while focus is in the menu the item under the mouse takes focus.
 */
export const Submenus: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <MenuButton>File</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item shortcut="Ctrl+N">New</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item>Open recent</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item onClick={fn()}>report.docx</Menu.Item>
              <Menu.Item onClick={fn()}>notes.txt</Menu.Item>
              <Menu>
                <Menu.Trigger>
                  <Menu.Item>Older</Menu.Item>
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item onClick={fn()}>archive-2025.zip</Menu.Item>
                  <Menu.Item onClick={fn()}>archive-2024.zip</Menu.Item>
                </Menu.Popover>
              </Menu>
            </Menu.Popover>
          </Menu>
          <Menu>
            <Menu.Trigger>
              <Menu.Item>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item onClick={fn()}>Email</Menu.Item>
              <Menu.Item onClick={fn()}>Copy link</Menu.Item>
            </Menu.Popover>
          </Menu>
          <Menu.Divider />
          <Menu.Item>Exit</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * Submenus work in a static menu too, and so does a split row (`Menu.SplitGroup`): activating an
 * item in a submenu closes it and returns focus to its trigger item.
 */
export const StaticWithSubmenu: Story = {
  args: {
    'aria-label': 'Edit',
    // A static menu is as wide as its container: this width leaves its submenus room beside it.
    className: 'w-64',
    children: (
      <>
        <Menu.Item shortcut="Ctrl+X">Cut</Menu.Item>
        <Menu.Item shortcut="Ctrl+C">Copy</Menu.Item>
        <Menu>
          <Menu.Trigger>
            <Menu.Item>Paste special</Menu.Item>
          </Menu.Trigger>
          <Menu.Popover>
            <Menu.Item onClick={fn()}>Text only</Menu.Item>
            <Menu.Item onClick={fn()}>Keep formatting</Menu.Item>
          </Menu.Popover>
        </Menu>
        <Menu.SplitGroup>
          <Menu.Item onClick={fn()}>Find</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item aria-label="More find options" />
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item onClick={fn()}>Find next</Menu.Item>
              <Menu.Item onClick={fn()}>Replace…</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.SplitGroup>
      </>
    ),
  },
};

/**
 * A split row: "Save" is the action, the chevron half (named by its `aria-label`) opens more save
 * options. ArrowDown and ArrowUp visit both halves; ArrowRight moves from "Save" to the chevron
 * and, there, opens the submenu; ArrowLeft moves back.
 */
export const SplitGroup: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <MenuButton>File</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item>New</Menu.Item>
          <Menu.SplitGroup>
            <Menu.Item onClick={fn()} shortcut="Ctrl+S">
              Save
            </Menu.Item>
            <Menu>
              <Menu.Trigger>
                <Menu.Item aria-label="More save options" />
              </Menu.Trigger>
              <Menu.Popover>
                <Menu.Item onClick={fn()}>Save as…</Menu.Item>
                <Menu.Item onClick={fn()}>Save a copy</Menu.Item>
              </Menu.Popover>
            </Menu>
          </Menu.SplitGroup>
          <Menu.Item>Close</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * Menu surfaces mount through the presence core: while a menu closes, its surface carries
 * `data-presence="exiting"` (and `inert`), so classes on that phase fade it out before it
 * unmounts. Focus is back on the trigger at once. The fade is off under reduced motion.
 */
export const ExitMotion: Story = {
  args: {
    'aria-label': undefined,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <Button>Actions</Button>
        </Menu.Trigger>
        <Menu.Popover className="transition-opacity duration-wave-fast data-[presence=exiting]:opacity-0 motion-reduce:transition-none">
          <Menu.Item onClick={fn()}>Edit</Menu.Item>
          <Menu.Item onClick={fn()}>Duplicate</Menu.Item>
          <Menu.Item onClick={fn()}>Delete</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

/**
 * `openOnHover`: resting the mouse on the trigger opens the menu without moving focus, and it
 * closes once the mouse has left the trigger and the menu. A click (or Enter, Space, ArrowDown)
 * on the trigger keeps it open and moves focus into it. Touch never opens it by hover.
 */
export const HoverMenu: Story = {
  args: {
    'aria-label': undefined,
    openOnHover: true,
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <MenuButton>View</MenuButton>
        </Menu.Trigger>
        <Menu.Popover>
          <Menu.Item onClick={fn()}>Zoom in</Menu.Item>
          <Menu.Item onClick={fn()}>Zoom out</Menu.Item>
          <Menu.Item onClick={fn()}>Actual size</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

const FILES = ['report.docx', 'notes.txt', 'budget.xlsx', 'photo.png'];

/**
 * `openOnContext`: the file list is a context-menu region. A right click opens the menu at the
 * pointer; Shift+F10 or the ContextMenu key opens it at the focused file (the region announces the
 * shortcut with `aria-keyshortcuts`). Escape and choosing an action return focus to that file;
 * Tab closes the menu and tabbing continues from that file. Space on "Pinned" or "Available
 * offline" toggles it and keeps the menu open. The menu is named by its `aria-label`; the region
 * gets no menu-button state.
 */
export const ContextMenu: Story = {
  args: {
    'aria-label': undefined,
    openOnContext: true,
    defaultCheckedValues: { flags: ['synced'] },
    onOpenChange: fn(),
    children: (
      <>
        <Menu.Trigger>
          <div
            aria-keyshortcuts="Shift+F10"
            className="flex w-72 flex-col items-stretch gap-1 rounded-md border border-border p-2"
          >
            <p className="px-2 text-caption-1 text-muted-foreground">
              Right-click a file, or press Shift+F10 on it.
            </p>
            {FILES.map((file) => (
              <Button key={file} appearance="subtle" className="justify-start">
                {file}
              </Button>
            ))}
          </div>
        </Menu.Trigger>
        <Menu.Popover aria-label="File actions">
          <Menu.Item onClick={fn()}>Open</Menu.Item>
          <Menu.Item onClick={fn()}>Rename</Menu.Item>
          <Menu.Divider />
          <Menu.ItemCheckbox name="flags" value="pinned">
            Pinned
          </Menu.ItemCheckbox>
          <Menu.ItemCheckbox name="flags" value="synced">
            Available offline
          </Menu.ItemCheckbox>
          <Menu.Divider />
          <Menu.Item onClick={fn()}>Delete</Menu.Item>
        </Menu.Popover>
      </>
    ),
  },
};

/** A controlled menu placed at a toggle button outside it (`Menu.Popover target`). */
function CustomTargetMenu({ onOpenChange, ...args }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const [toggle, setToggle] = React.useState<HTMLButtonElement | null>(null);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-body-1 text-foreground">Layout</span>
      <Button
        ref={setToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => changeOpen(!open)}
      >
        Options
      </Button>
      <Menu {...args} open={open} onOpenChange={changeOpen}>
        <Menu.Popover target={toggle} aria-label="Layout options">
          <Menu.Item onClick={fn()}>Grid</Menu.Item>
          <Menu.Item onClick={fn()}>List</Menu.Item>
          <Menu.Item onClick={fn()}>Columns</Menu.Item>
        </Menu.Popover>
      </Menu>
    </div>
  );
}

/**
 * `Menu.Popover target`: a controlled menu without `Menu.Trigger`, placed at a toggle button that
 * carries its own menu-button state (`aria-haspopup`, `aria-expanded`). A press on the target does
 * not close the menu through its outside-press rule, so the toggle closes it with one click. The
 * menu is named by its `aria-label`.
 */
export const CustomTarget: Story = {
  args: { 'aria-label': undefined, onOpenChange: fn() },
  render: (args) => <CustomTargetMenu {...args} />,
};
