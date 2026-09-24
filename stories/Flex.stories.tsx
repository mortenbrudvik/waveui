import type * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Flex } from '../src';

const meta = {
  title: 'Components/Layout/Flex',
  component: Flex,
  args: {
    gap: 'md',
  },
} satisfies Meta<typeof Flex>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Demo item drawn with theme tokens. */
const Box = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div className="rounded border border-border bg-muted px-4 py-3" style={style}>
    {children}
  </div>
);

export const Default: Story = {
  render: (args) => (
    <Flex {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Flex>
  ),
};

export const Column: Story = {
  args: {
    direction: 'column',
    style: { width: 300 },
  },
  render: (args) => (
    <Flex {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Flex>
  ),
};

export const AlignCenter: Story = {
  args: {
    align: 'center',
    className: 'border border-dashed border-border',
    style: { height: 120 },
  },
  render: (args) => (
    <Flex {...args}>
      <Box style={{ height: 40 }}>Short</Box>
      <Box style={{ height: 80 }}>Tall</Box>
      <Box style={{ height: 60 }}>Medium</Box>
    </Flex>
  ),
};

export const SpaceBetween: Story = {
  args: {
    justify: 'between',
    className: 'border border-dashed border-border p-2',
  },
  render: (args) => (
    <Flex {...args}>
      <Box>Left</Box>
      <Box>Center</Box>
      <Box>Right</Box>
    </Flex>
  ),
};

export const Wrapped: Story = {
  args: {
    wrap: 'wrap',
    gap: 'sm',
    style: { width: 300 },
  },
  render: (args) => (
    <Flex {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
      <Box>Item 5</Box>
      <Box>Item 6</Box>
    </Flex>
  ),
};

/** `grow` fills the free space; `shrink={false}` (`shrink-0`) keeps an item from shrinking. */
export const GrowShrink: Story = {
  args: {
    style: { width: 500 },
  },
  render: (args) => (
    <Flex {...args}>
      <Flex grow className="rounded bg-selected p-3 text-selected-foreground">
        Grows to fill
      </Flex>
      <Flex shrink={false} className="rounded border border-border bg-muted px-4 py-3">
        Never shrinks
      </Flex>
    </Flex>
  ),
};

/**
 * Reversed directions change the visual order only (keyboard and screen readers follow the DOM),
 * so they suit static content like this; reorder the DOM for focusable items.
 */
export const RowReverse: Story = {
  args: {
    direction: 'row-reverse',
    justify: 'end',
  },
  render: (args) => (
    <Flex {...args}>
      <Box>First in the DOM</Box>
      <Box>Second in the DOM</Box>
    </Flex>
  ),
};
