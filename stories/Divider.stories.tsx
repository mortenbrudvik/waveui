import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from '../src';
import { orientationArgType } from './_helpers';

const meta = {
  title: 'Components/Data Display/Divider',
  component: Divider,
  argTypes: {
    ...orientationArgType,
  },
  args: {
    orientation: 'horizontal',
  },
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  decorators: [
    (Story) => (
      <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
        <Story />
      </div>
    ),
  ],
};

/** A labelled divider is one separator named by its label; the lines are presentational. */
export const WithText: Story = {
  args: {
    children: 'OR',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    ),
  ],
};

/** The label of a vertical divider sits between two vertical line segments. */
export const VerticalWithText: Story = {
  args: {
    orientation: 'vertical',
    children: 'OR',
  },
  decorators: [
    (Story) => (
      <div style={{ height: 120, display: 'flex', alignItems: 'stretch' }}>
        <Story />
      </div>
    ),
  ],
};
