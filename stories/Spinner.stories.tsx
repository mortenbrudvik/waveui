import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from '../src';
import type { Size } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Feedback/Spinner',
  component: Spinner,
  argTypes: {
    ...sizeArgType,
  },
  args: {
    label: 'Loading',
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const sizes: Array<[Size, string]> = [
  ['extra-small', 'Extra Small'],
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['extra-large', 'Extra Large'],
];

export const Sizes: Story = {
  render: ({ size: _size, label: _label, ...args }) => (
    <div className="flex items-center gap-4">
      {sizes.map(([size, label]) => (
        <Spinner key={size} size={size} label={label} {...args} />
      ))}
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
