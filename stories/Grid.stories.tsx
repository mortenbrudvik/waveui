import type { Meta, StoryObj } from '@storybook/react';
import { Grid } from '../src';

const meta = {
  title: 'Layout/Grid',
  component: Grid,
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: '12px 16px', background: '#f0f0f0', border: '1px solid #d1d1d1', borderRadius: 4, textAlign: 'center' }}>
    {children}
  </div>
);

export const Default: Story = {
  render: (args) => (
    <Grid {...args} columns={3} gap="md">
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
  render: () => (
    <Grid columns={2} gap="md" style={{ width: 400 }}>
      <Box>Left</Box>
      <Box>Right</Box>
      <Box>Left</Box>
      <Box>Right</Box>
    </Grid>
  ),
};

export const FourColumns: Story = {
  render: () => (
    <Grid columns={4} gap="sm">
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
  render: () => (
    <Grid columns={12} gap="xs">
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i}>{i + 1}</Box>
      ))}
    </Grid>
  ),
};

export const WithRows: Story = {
  render: () => (
    <Grid columns={3} rows={2} gap="md" style={{ height: 200 }}>
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
  render: () => (
    <Grid columns={3} columnGap="xl" rowGap="xs">
      <Box>1</Box>
      <Box>2</Box>
      <Box>3</Box>
      <Box>4</Box>
      <Box>5</Box>
      <Box>6</Box>
    </Grid>
  ),
};
