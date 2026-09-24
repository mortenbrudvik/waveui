import type * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Grid } from '../src';

const meta = {
  title: 'Components/Layout/Grid',
  component: Grid,
  args: {
    columns: 3,
    gap: 'md',
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Demo cell drawn with theme tokens. */
const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded border border-border bg-muted px-4 py-3 text-center">{children}</div>
);

export const Default: Story = {
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
};

export const TwoColumns: Story = {
  args: {
    columns: 2,
    style: { width: 400 },
  },
  render: (args) => (
    <Grid {...args}>
      <Box>Left</Box>
      <Box>Right</Box>
      <Box>Left</Box>
      <Box>Right</Box>
    </Grid>
  ),
};

export const FourColumns: Story = {
  args: {
    columns: 4,
    gap: 'sm',
  },
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
      <Box>7</Box>
      <Box>8</Box>
    </Grid>
  ),
};

export const TwelveColumnGrid: Story = {
  args: {
    columns: 12,
    gap: 'xs',
  },
  render: (args) => (
    <Grid {...args}>
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i}>{i + 1}</Box>
      ))}
    </Grid>
  ),
};

export const WithRows: Story = {
  args: {
    rows: 2,
    style: { height: 200 },
  },
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
};

export const SeparateGaps: Story = {
  args: {
    gap: undefined,
    columnGap: 'xl',
    rowGap: 'xs',
  },
  render: (args) => (
    <Grid {...args}>
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
};
