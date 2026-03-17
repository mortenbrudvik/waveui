import type { Meta, StoryObj } from '@storybook/react';
import { Stack } from '../src';

const meta = {
  title: 'Layout/Stack',
  component: Stack,
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: '12px 16px', background: '#f0f0f0', border: '1px solid #d1d1d1', borderRadius: 4 }}>
    {children}
  </div>
);

export const Default: Story = {
  render: (args) => (
    <Stack {...args} style={{ width: 300 }}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Stack direction="horizontal">
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Stack>
  ),
};

export const GapSizes: Story = {
  render: () => (
    <Stack gap="lg">
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="none"</p>
        <Stack direction="horizontal" gap="none">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="xs"</p>
        <Stack direction="horizontal" gap="xs">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="sm"</p>
        <Stack direction="horizontal" gap="sm">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="md" (default)</p>
        <Stack direction="horizontal" gap="md">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="lg"</p>
        <Stack direction="horizontal" gap="lg">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
      <div>
        <p style={{ marginBottom: 4, fontWeight: 600 }}>gap="xl"</p>
        <Stack direction="horizontal" gap="xl">
          <Box>A</Box>
          <Box>B</Box>
          <Box>C</Box>
        </Stack>
      </div>
    </Stack>
  ),
};

export const Centered: Story = {
  render: () => (
    <Stack align="center" justify="center" style={{ height: 200, border: '1px dashed #d1d1d1' }}>
      <Box>Centered content</Box>
    </Stack>
  ),
};

export const Wrapped: Story = {
  render: () => (
    <Stack direction="horizontal" wrap gap="sm" style={{ width: 300 }}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
      <Box>Item 5</Box>
      <Box>Item 6</Box>
    </Stack>
  ),
};
