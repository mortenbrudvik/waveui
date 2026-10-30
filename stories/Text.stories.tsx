import type { Meta, StoryObj } from '@storybook/react';
import { Text } from '../src';
import type { TextProps, TypographyVariant } from '../src';

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
      options: ['regular', 'medium', 'semibold', 'bold'],
    },
    font: {
      control: 'select',
      options: ['base', 'monospace', 'numeric'],
    },
  },
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    variant: 'body-1',
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;
/** A story that renders the text as a heading takes the heading's props. */
type HeadingStory = StoryObj<TextProps<'h1'>>;

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
      <Text {...args} weight="medium">
        Medium
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

/** `font` picks the family (`base` keeps the inherited one) and `weight` one of four weights. */
export const FontsAndWeights: Story = {
  name: 'Fonts and weights',
  argTypes: {
    font: { control: false },
    weight: { control: false },
  },
  render: (args) => (
    <div className="flex flex-col gap-4">
      {(['base', 'monospace', 'numeric'] as const).map((font) => (
        <div key={font} className="flex flex-col gap-1">
          {(['regular', 'medium', 'semibold', 'bold'] as const).map((weight) => (
            <Text key={weight} {...args} font={font} weight={weight}>
              {font} {weight}: 0123456789 const total = 1,234.56;
            </Text>
          ))}
        </div>
      ))}
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

export const AsHeading: HeadingStory = {
  args: {
    as: 'h1',
    children: 'Page heading',
    variant: 'title-1',
    weight: 'bold',
  },
};
