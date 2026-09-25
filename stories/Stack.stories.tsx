import type * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Layout/Stack',
  component: Stack,
  argTypes: {
    ...orientationArgType,
  },
  args: {
    orientation: 'vertical',
    gap: 'md',
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Demo item drawn with theme tokens. */
const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded border border-border bg-muted px-4 py-3">{children}</div>
);

export const Default: Story = {
  args: {
    style: { width: 300 },
  },
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
  },
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

const gaps = ['none', 'xs', 'sm', 'md', 'lg', 'xl'] as const;

export const GapSizes: Story = {
  args: {
    gap: 'lg',
  },
  render: (args) => (
    <Stack {...args}>
      {gaps.map((gap) => (
        <div key={gap}>
          <p className="mb-1 font-semibold">
            gap=&quot;{gap}&quot;{gap === 'md' ? ' (default)' : ''}
          </p>
          <Stack orientation="horizontal" gap={gap}>
            <Box>A</Box>
            <Box>B</Box>
            <Box>C</Box>
          </Stack>
        </div>
      ))}
    </Stack>
  ),
};

export const Centered: Story = {
  args: {
    align: 'center',
    justify: 'center',
    className: 'border border-dashed border-border',
    style: { height: 200 },
  },
  render: (args) => (
    <Stack {...args}>
      <Box>Centered content</Box>
    </Stack>
  ),
};

export const Wrapped: Story = {
  args: {
    orientation: 'horizontal',
    wrap: true,
    gap: 'sm',
    style: { width: 300 },
  },
  render: (args) => (
    <Stack {...args}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
      <Box>Item 5</Box>
      <Box>Item 6</Box>
    </Stack>
  ),
};
