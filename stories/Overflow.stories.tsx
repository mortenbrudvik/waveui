import type { Meta, StoryObj } from '@storybook/react';
import { Badge, Button, Menu, MenuButton, Overflow, OverflowItem, useOverflowMenu } from '../src';

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
