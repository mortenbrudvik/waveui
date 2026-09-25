import type { Meta, StoryObj } from '@storybook/react';
import { CounterBadge } from '../src';
import type { BadgeColor } from '../src';
import { badgeColorArgType } from './_helpers';

const APPEARANCES = ['filled', 'outline'] as const;
const COLORS: BadgeColor[] = [
  'brand',
  'success',
  'warning',
  'danger',
  'important',
  'informative',
  'severe',
  'subtle',
];

const meta = {
  title: 'Components/Data Display/CounterBadge',
  component: CounterBadge,
  argTypes: {
    appearance: {
      control: 'select',
      options: APPEARANCES,
    },
    ...badgeColorArgType,
  },
  args: {
    count: 5,
    appearance: 'filled',
    color: 'brand',
    dot: false,
    showZero: false,
  },
} satisfies Meta<typeof CounterBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = {
  args: {
    appearance: 'outline',
  },
};

export const Overflow: Story = {
  args: {
    count: 150,
    overflowCount: 99,
  },
};

/** A count of 0 or less renders nothing (use `showZero` to show "0"). */
export const ZeroCount: Story = {
  args: {
    count: 0,
  },
};

/** `showZero` shows "0" for a count of 0; a negative count still renders nothing. */
export const ShowZero: Story = {
  args: {
    count: 0,
    showZero: true,
  },
};

/**
 * `dot` renders a 6px dot without a number, an "unread" indicator; `count` is ignored. Name it
 * with `aria-label` when nothing else conveys its meaning: it then gets `role="img"`.
 */
export const Dot: Story = {
  args: {
    dot: true,
    'aria-label': 'Unread messages',
  },
  render: (args) => (
    <span className="inline-flex items-center gap-2 text-body-1 text-foreground">
      Inbox
      <CounterBadge {...args} />
    </span>
  ),
};

/** Every color, filled (first row) and outline (second row), each above its name. */
const renderColorRows: Story['render'] = (args) => (
  <div className="flex flex-col gap-3">
    {APPEARANCES.map((appearance) => (
      <div key={appearance} className="flex flex-wrap gap-4">
        {COLORS.map((color) => (
          <span
            key={color}
            className="inline-flex flex-col items-center gap-1 text-caption-1 text-muted-foreground"
          >
            <CounterBadge {...args} appearance={appearance} color={color} />
            {color}
          </span>
        ))}
      </div>
    ))}
  </div>
);

/** Every color of Badge's palette, filled (first row) and outline (second row). */
export const Colors: Story = {
  render: renderColorRows,
};

/**
 * Every color as a dot, filled (first row) and outline (second row). A dot has no text, so its
 * color keeps 3:1 against the page: the `informative` and `warning` dots are darker than those
 * counts. `subtle` is the page color, for dots on colored surfaces.
 */
export const DotColors: Story = {
  args: {
    dot: true,
  },
  render: renderColorRows,
};
