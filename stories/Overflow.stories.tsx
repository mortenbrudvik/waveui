import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Overflow, OverflowItem } from '../src';
import { useOverflowMenu } from '../src/components/layout/Overflow';

const pages = ['Home', 'Products', 'Services', 'About', 'Blog', 'Contact', 'Careers'];

/**
 * Lists the hidden items in a disclosure. A stand-in for a Menu (INTEGRATION switches this story
 * to `Menu.Trigger`/`Menu.Popover`, which render in a portal); the inline list needs the row to
 * be `overflow-visible` so it is not clipped. Hidden items are `display: none`, so nothing else
 * spills out.
 */
function HiddenItemsDisclosure() {
  const { hiddenIds, count } = useOverflowMenu();
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  return (
    <div className="relative">
      <Button
        appearance="subtle"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        +{count} more
      </Button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute end-0 top-full z-10 m-0 mt-1 min-w-40 list-none rounded-md border border-border bg-background p-1 shadow-8"
      >
        {hiddenIds.map((id) => (
          <li key={id}>
            <button
              type="button"
              className="w-full rounded px-3 py-1.5 text-start text-body-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover"
            >
              {id}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const meta = {
  title: 'Components/Layout/Overflow',
  component: Overflow,
  args: {
    className: 'gap-1 overflow-visible',
    overflowButton: () => <HiddenItemsDisclosure />,
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
