import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Rating, RatingDisplay } from '../src';
import { sizeArgType } from './_helpers';

const meta = {
  title: 'Components/Input/Rating',
  component: Rating,
  argTypes: {
    max: { control: { type: 'number', min: 1, max: 10 } },
    ...sizeArgType,
  },
  args: {
    onValueChange: fn(),
  },
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 3,
  },
};

export const Large: Story = {
  args: {
    defaultValue: 4,
    size: 'large',
  },
};

/** Small stars keep a 24×24px target through padding. */
export const Small: Story = {
  args: {
    defaultValue: 2,
    size: 'extra-small',
  },
};

export const TenStars: Story = {
  args: {
    max: 10,
    defaultValue: 7,
  },
};

export const Disabled: Story = {
  args: {
    value: 3,
    disabled: true,
  },
};

/** A custom accessible name replaces the default "Rating". */
export const Labelled: Story = {
  args: {
    'aria-label': 'Product quality',
    defaultValue: 4,
  },
};

// The RatingDisplay stories below compare several displays side by side, so each sets its props
// in `render`: the controls of this file's meta belong to Rating, not to RatingDisplay.

/** A fractional value (an average) is drawn with a partly filled star. */
export const ReadOnly: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RatingDisplay value={5} size="small" />
      <RatingDisplay value={3} size="medium" />
      <RatingDisplay value={4.6} size="medium" />
      <RatingDisplay value={1} size="large" />
    </div>
  ),
};

/**
 * `showValue` adds the value after the stars; `count` adds the number of ratings (with the
 * locale's digit grouping) and names it too: "Rating: 4.5 out of 5, 1,160 ratings".
 */
export const DisplayWithValueAndCount: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RatingDisplay value={4.5} showValue locale="en-US" size="small" />
      <RatingDisplay value={4.5} count={1160} locale="en-US" />
      <RatingDisplay value={3.7} count={1} locale="en-US" size="large" />
    </div>
  ),
};

/** `compact` shows one filled star with the value (and the count): for lists and cards. */
export const DisplayCompact: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div className="flex flex-col gap-4">
      <RatingDisplay value={4.2} compact locale="en-US" />
      <RatingDisplay value={4.2} compact count={87} locale="en-US" />
    </div>
  ),
};

/**
 * `locale` formats the value and the count (pass it when rendering on the server); `labels`
 * translates the accessible name. Norwegian: "Vurdering: 4,5 av 5, 1 160 vurderinger".
 */
export const DisplayLocalized: StoryObj<typeof RatingDisplay> = {
  render: () => (
    <div lang="nb">
      <RatingDisplay
        value={4.5}
        count={1160}
        locale="nb-NO"
        labels={{
          rating: (_value, max, formattedValue) => `Vurdering: ${formattedValue} av ${max}`,
          count: (count, formattedCount) =>
            count === 1 ? '1 vurdering' : `${formattedCount} vurderinger`,
        }}
      />
    </div>
  ),
};
