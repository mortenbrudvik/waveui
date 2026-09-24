import type { Meta, StoryObj } from '@storybook/react';
import { Text } from '../src';
import type { TypographyVariant } from '../src';

const variants: TypographyVariant[] = [
  'caption-2',
  'caption-1',
  'body-1',
  'body-2',
  'subtitle-2',
  'subtitle-1',
  'title-3',
  'title-2',
  'title-1',
  'large-title',
  'display',
];

const meta = {
  title: 'Components/Typography/Text',
  component: Text,
  argTypes: {
    variant: {
      control: 'select',
      options: variants,
    },
    weight: {
      control: 'select',
      options: ['regular', 'semibold', 'bold'],
    },
  },
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    variant: 'body-1',
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The whole type ramp (the variant control is off here: each line sets its own variant). */
export const Variants: Story = {
  argTypes: {
    variant: { control: false },
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      {variants.map((variant) => (
        <Text key={variant} {...args} variant={variant}>
          {variant}
        </Text>
      ))}
    </div>
  ),
};

/** `weight` uses the shared vocabulary; the numeric 0.4 values are deprecated. */
export const Weights: Story = {
  argTypes: {
    weight: { control: false },
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Text {...args} weight="regular">
        Regular
      </Text>
      <Text {...args} weight="semibold">
        Semibold
      </Text>
      <Text {...args} weight="bold">
        Bold
      </Text>
    </div>
  ),
};

/** Text inherits its color; add one with `className` and the variant stays applied. */
export const MutedCaption: Story = {
  args: {
    variant: 'caption-1',
    className: 'text-muted-foreground',
    children: 'Last saved 2 minutes ago',
  },
};

export const AsHeading: Story = {
  args: {
    as: 'h1',
    children: 'Page heading',
    variant: 'title-1',
    weight: 'bold',
  },
};
