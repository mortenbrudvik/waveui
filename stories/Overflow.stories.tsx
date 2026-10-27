import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Badge,
  Button,
  Divider,
  Menu,
  MenuButton,
  Overflow,
  OverflowDivider,
  OverflowItem,
  Toolbar,
  useOverflowMenu,
} from '../src';

const pages = ['Home', 'Products', 'Services', 'About', 'Blog', 'Contact', 'Careers'];

/**
 * Lists the hidden items in a popup menu. `useOverflowMenu()` gives the ids of the hidden items in
 * DOM order; `Menu.Popover` renders in a portal, so the `overflow-hidden` row does not clip it.
 */
function HiddenItemsMenu() {
  const { hiddenIds, count } = useOverflowMenu();
  return (
    <Menu>
      <Menu.Trigger>
        <MenuButton appearance="subtle">+{count} more</MenuButton>
      </Menu.Trigger>
      <Menu.Popover align="end">
        {hiddenIds.map((id) => (
          <Menu.Item key={id}>{id}</Menu.Item>
        ))}
      </Menu.Popover>
    </Menu>
  );
}

const meta = {
  title: 'Components/Layout/Overflow',
  component: Overflow,
  args: {
    className: 'gap-1',
    onOverflowChange: fn(),
    overflowButton: () => <HiddenItemsMenu />,
    children: pages.map((page) => (
      <OverflowItem key={page} itemId={page}>
        <Button appearance="subtle" className="whitespace-nowrap">
          {page}
        </Button>
      </OverflowItem>
    )),
  },
} satisfies Meta<typeof Overflow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[400px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

export const NarrowContainer: Story = {
  render: (args) => (
    <div className="w-[200px]">
      <Overflow {...args} />
    </div>
  ),
};

/**
 * A first item wider than the room beside the button: the first item always stays, and the button
 * sticks to the end of the row, covering the end of that item (`data-overflow-pinned`).
 */
export const FirstItemWiderThanRow: Story = {
  args: {
    children: ['Quarterly planning overview', ...pages].map((page) => (
      <OverflowItem key={page} itemId={page}>
        <Button appearance="subtle" className="whitespace-nowrap">
          {page}
        </Button>
      </OverflowItem>
    )),
  },
  render: (args) => (
    <div className="w-[220px]">
      <Overflow {...args} />
    </div>
  ),
};

/** Items packed at the end of the row: the button follows the last visible item. */
export const EndAligned: Story = {
  args: { className: 'gap-1 justify-end' },
  render: (args) => (
    <div className="w-[400px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

/** Items shorter than the overflow button: the row takes the height of the button. */
export const ShortItems: Story = {
  args: {
    children: pages.map((page) => (
      <OverflowItem key={page} itemId={page}>
        <Badge appearance="tint">{page}</Badge>
      </OverflowItem>
    )),
  },
  render: (args) => (
    <div className="w-[300px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

const subtleButton = (label: string) => (
  <Button appearance="subtle" className="whitespace-nowrap">
    {label}
  </Button>
);

/**
 * Items hide in ascending `priority` (higher stays longer, 0 by default); `pinned` items never hide.
 * Once any item sets either, the first item is no longer protected. Narrow the row to watch
 * "Export" (priority 0) go before "Share" (2) and "Comments" (3), while "Save" stays pinned.
 */
export const PriorityAndPinned: Story = {
  args: {
    'aria-label': 'Document actions',
    children: [
      <OverflowItem key="Export" itemId="Export" priority={0}>
        {subtleButton('Export')}
      </OverflowItem>,
      <OverflowItem key="History" itemId="History" priority={1}>
        {subtleButton('History')}
      </OverflowItem>,
      <OverflowItem key="Share" itemId="Share" priority={2}>
        {subtleButton('Share')}
      </OverflowItem>,
      <OverflowItem key="Comments" itemId="Comments" priority={3}>
        {subtleButton('Comments')}
      </OverflowItem>,
      <OverflowItem key="Save" itemId="Save" pinned>
        <Button appearance="primary" className="whitespace-nowrap">
          Save
        </Button>
      </OverflowItem>,
    ],
  },
  render: (args) => (
    <div className="w-[320px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

/**
 * Items of a group (`groupId`) hide together with their `OverflowDivider`: a divider whose group is
 * hidden hides too, so no divider is left at the end of the row. `onOverflowChange` reports the
 * visibility of each group (`visible`, `hidden` or `overflow`).
 */
export const GroupsWithDividers: Story = {
  args: {
    'aria-label': 'Editing tools',
    overflowDirection: 'start',
    children: [
      <OverflowItem key="Cut" itemId="Cut" groupId="clipboard" priority={3}>
        {subtleButton('Cut')}
      </OverflowItem>,
      <OverflowItem key="Copy" itemId="Copy" groupId="clipboard" priority={3}>
        {subtleButton('Copy')}
      </OverflowItem>,
      <OverflowItem key="Paste" itemId="Paste" groupId="clipboard" priority={3}>
        {subtleButton('Paste')}
      </OverflowItem>,
      <OverflowDivider key="divider-format" groupId="format">
        <Divider orientation="vertical" className="h-6" />
      </OverflowDivider>,
      <OverflowItem key="Bold" itemId="Bold" groupId="format" priority={2}>
        {subtleButton('Bold')}
      </OverflowItem>,
      <OverflowItem key="Italic" itemId="Italic" groupId="format" priority={2}>
        {subtleButton('Italic')}
      </OverflowItem>,
      <OverflowDivider key="divider-view" groupId="view">
        <Divider orientation="vertical" className="h-6" />
      </OverflowDivider>,
      <OverflowItem key="Zoom" itemId="Zoom" groupId="view" priority={1}>
        {subtleButton('Zoom')}
      </OverflowItem>,
      <OverflowItem key="Outline" itemId="Outline" groupId="view" priority={1}>
        {subtleButton('Outline')}
      </OverflowItem>,
    ],
  },
  render: (args) => (
    <div className="w-[480px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

/**
 * A Toolbar around an Overflow: the toolbar keeps its single Tab stop and arrow-key order over the
 * items that are shown (hidden items are skipped), and the groups' dividers hide with their group.
 * The Toolbar is a block-level flex row (`className="flex"`) as wide as its container, so the
 * Overflow's room follows the container: an inline toolbar would shrink to the items it shows and
 * never give the Overflow room to show the hidden ones again.
 */
export const InToolbarWithGroups: Story = {
  args: {
    className: 'min-w-0 flex-1 gap-1',
    children: [
      <OverflowItem key="Undo" itemId="Undo" groupId="history" priority={2}>
        <Toolbar.Button>Undo</Toolbar.Button>
      </OverflowItem>,
      <OverflowItem key="Redo" itemId="Redo" groupId="history" priority={2}>
        <Toolbar.Button>Redo</Toolbar.Button>
      </OverflowItem>,
      <OverflowDivider key="divider-insert" groupId="insert">
        <Toolbar.Divider />
      </OverflowDivider>,
      <OverflowItem key="Image" itemId="Image" groupId="insert" priority={1}>
        <Toolbar.Button>Image</Toolbar.Button>
      </OverflowItem>,
      <OverflowItem key="Table" itemId="Table" groupId="insert" priority={1}>
        <Toolbar.Button>Table</Toolbar.Button>
      </OverflowItem>,
      <OverflowItem key="Link" itemId="Link" groupId="insert" priority={1}>
        <Toolbar.Button>Link</Toolbar.Button>
      </OverflowItem>,
      <OverflowDivider key="divider-share" groupId="share">
        <Toolbar.Divider />
      </OverflowDivider>,
      <OverflowItem key="Share" itemId="Share" groupId="share" pinned>
        <Toolbar.Button>Share</Toolbar.Button>
      </OverflowItem>,
    ],
  },
  render: (args) => (
    <div className="w-[420px] max-w-full">
      <Toolbar aria-label="Document tools" className="flex">
        <Overflow {...args} />
      </Toolbar>
    </div>
  ),
};

/**
 * `buttonPosition="before-hidden"` puts the button just before the first hidden item, so it stands
 * in for the hidden ones (a breadcrumb trail), instead of sticking to the end of the row.
 */
export const ButtonBeforeHiddenItems: Story = {
  args: {
    'aria-label': 'Sections',
    buttonPosition: 'before-hidden',
    overflowDirection: 'start',
    children: pages.map((page, index) => (
      <OverflowItem key={page} itemId={page} pinned={index === 0 || index === pages.length - 1}>
        {subtleButton(page)}
      </OverflowItem>
    )),
  },
  render: (args) => (
    <div className="w-[360px] max-w-full">
      <Overflow {...args} />
    </div>
  ),
};

/** `orientation="vertical"` stacks the items and measures heights; the column needs a height. */
export const Vertical: Story = {
  args: {
    'aria-label': 'Sidebar shortcuts',
    orientation: 'vertical',
    className: 'h-[160px] gap-1',
    overflowButton: () => <HiddenItemsMenu />,
    children: pages.map((page) => (
      <OverflowItem key={page} itemId={page}>
        {subtleButton(page)}
      </OverflowItem>
    )),
  },
  render: (args) => <Overflow {...args} />,
};
