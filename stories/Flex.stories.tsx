import type { Meta, StoryObj } from '@storybook/react';
import { Flex } from '../src';

const meta = {
  title: 'Layout/Flex',
  component: Flex,
} satisfies Meta<typeof Flex>;

export default meta;
type Story = StoryObj<typeof meta>;

const Box = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      padding: '12px 16px',
      background: '#f0f0f0',
      border: '1px solid #d1d1d1',
      borderRadius: 4,
    }}
  >
    {children}
  </div>
);

export const Default: Story = {
  render: (args) => (
    <Flex {...args} gap="md">
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Flex>
  ),
};

export const Column: Story = {
  render: () => (
    <Flex direction="column" gap="md" style={{ width: 300 }}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
    </Flex>
  ),
};

export const AlignCenter: Story = {
  render: () => (
    <Flex align="center" gap="md" style={{ height: 120, border: '1px dashed #d1d1d1' }}>
      <div
        style={{
          padding: '8px 16px',
          background: '#f0f0f0',
          border: '1px solid #d1d1d1',
          borderRadius: 4,
          height: 40,
        }}
      >
        Short
      </div>
      <div
        style={{
          padding: '8px 16px',
          background: '#f0f0f0',
          border: '1px solid #d1d1d1',
          borderRadius: 4,
          height: 80,
        }}
      >
        Tall
      </div>
      <div
        style={{
          padding: '8px 16px',
          background: '#f0f0f0',
          border: '1px solid #d1d1d1',
          borderRadius: 4,
          height: 60,
        }}
      >
        Medium
      </div>
    </Flex>
  ),
};

export const SpaceBetween: Story = {
  render: () => (
    <Flex justify="between" gap="md" style={{ border: '1px dashed #d1d1d1', padding: 8 }}>
      <Box>Left</Box>
      <Box>Center</Box>
      <Box>Right</Box>
    </Flex>
  ),
};

export const Wrapped: Story = {
  render: () => (
    <Flex wrap="wrap" gap="sm" style={{ width: 300 }}>
      <Box>Item 1</Box>
      <Box>Item 2</Box>
      <Box>Item 3</Box>
      <Box>Item 4</Box>
      <Box>Item 5</Box>
      <Box>Item 6</Box>
    </Flex>
  ),
};

export const GrowShrink: Story = {
  render: () => (
    <Flex gap="md" style={{ width: 500 }}>
      <Flex grow style={{ background: '#e8f4fd', padding: 12, borderRadius: 4 }}>
        Grows to fill
      </Flex>
      <Box>Fixed</Box>
    </Flex>
  ),
};
