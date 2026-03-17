import type { Meta, StoryObj } from '@storybook/react';
import { Text } from '../src';

const meta = {
  title: 'Typography/Text',
  component: Text,
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'caption-2', 'caption-1', 'body-1', 'body-2',
        'subtitle-2', 'subtitle-1', 'title-3', 'title-2',
        'title-1', 'large-title', 'display',
      ],
    },
    weight: {
      control: 'select',
      options: [400, 600, 700],
    },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    variant: 'body-1',
  },
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text variant="caption-2">Caption 2</Text>
      <Text variant="caption-1">Caption 1</Text>
      <Text variant="body-1">Body 1</Text>
      <Text variant="body-2">Body 2</Text>
      <Text variant="subtitle-2">Subtitle 2</Text>
      <Text variant="subtitle-1">Subtitle 1</Text>
      <Text variant="title-3">Title 3</Text>
      <Text variant="title-2">Title 2</Text>
      <Text variant="title-1">Title 1</Text>
      <Text variant="large-title">Large Title</Text>
      <Text variant="display">Display</Text>
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text weight={400}>Regular (400)</Text>
      <Text weight={600}>Semibold (600)</Text>
      <Text weight={700}>Bold (700)</Text>
    </div>
  ),
};

export const AsHeading: Story = {
  args: {
    children: 'Page Heading',
    variant: 'title-1',
    weight: 700,
    as: 'h1',
  },
};
