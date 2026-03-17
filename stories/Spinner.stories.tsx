import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Feedback/Spinner',
  component: Spinner,
  argTypes: {
    ...sizeArgType,
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Loading',
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Spinner size="extra-small" label="Extra Small" />
      <Spinner size="small" label="Small" />
      <Spinner size="medium" label="Medium" />
      <Spinner size="large" label="Large" />
      <Spinner size="extra-large" label="Extra Large" />
    </div>
  ),
};

export const WithLabel: Story = {
  args: {
    size: 'medium',
    label: 'Loading content...',
    labelVisible: true,
  },
};
