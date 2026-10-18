import * as React from 'react';
import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, Tag } from '../src';
import type { TagAppearance, TagShape, TagSize } from '../src';
import { TagGroup } from '../src/components/data-display/TagGroup';
import type { TagGroupProps } from '../src/components/data-display/TagGroup';
import { orientationArgType } from './_helpers';

const SIZES = ['medium', 'small', 'extra-small'] as const satisfies readonly TagSize[];
const APPEARANCES = ['filled', 'outline', 'brand'] as const satisfies readonly TagAppearance[];
const SHAPES = ['circular', 'rounded'] as const satisfies readonly TagShape[];

/** The tag vocabulary, declared here (the shared helpers cover the Wave-wide unions). */
const tagGroupArgTypes = {
  role: { control: 'inline-radio', options: ['toolbar', 'list'] },
  size: { control: 'inline-radio', options: SIZES },
  appearance: { control: 'inline-radio', options: APPEARANCES },
  shape: { control: 'inline-radio', options: SHAPES },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Data Display/TagGroup',
  component: TagGroup,
  argTypes: { ...orientationArgType, ...tagGroupArgTypes },
  args: {
    'aria-label': 'Active filters',
    dismissible: true,
    onDismiss: fn(),
  },
} satisfies Meta<typeof TagGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A decorative 16px glyph for the `icon` slot (the tag hides it from assistive technology). */
const FilterIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" />
  </svg>
);

const FILTERS = ['Red', 'Blue', 'Large', 'Cotton'];

/**
 * A filter bar that keeps its filters in state: the group reports each dismissal with the tag's
 * `value`, and the filter is removed. When the filter that had focus goes, the group moves focus
 * to the next filter's dismiss button, else the previous one, else "Reset filters", its
 * `fallbackFocusRef`. "Reset filters" is unavailable but focusable (`disabledFocusable`) while
 * every filter is set, so it can take focus before the last filter goes.
 */
function FilterBar(props: TagGroupProps) {
  const { onDismiss, ...rest } = props;
  const [filters, setFilters] = React.useState(FILTERS);
  const reset = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TagGroup
        {...rest}
        fallbackFocusRef={reset}
        onDismiss={(value) => {
          onDismiss?.(value);
          setFilters((current) => current.filter((filter) => filter !== value));
        }}
      >
        {filters.map((filter) => (
          <Tag key={filter} value={filter}>
            {filter}
          </Tag>
        ))}
      </TagGroup>
      <Button
        ref={reset}
        appearance="subtle"
        size="small"
        disabledFocusable={filters.length === FILTERS.length}
        onClick={() => setFilters(FILTERS)}
      >
        Reset filters
      </Button>
    </div>
  );
}

/**
 * A dismissible filter bar. Tab reaches one filter, Left/Right move between the dismiss buttons
 * (mirrored in RTL), Home/End jump to the ends, and Enter, Space, Delete or Backspace removes a
 * filter. Focus then moves to the next filter, else the previous one, else "Reset filters".
 */
export const Default: Story = {
  render: (args) => <FilterBar {...args} />,
};

/** The group's `size` sizes its tags (28, 24 or 20px tall) and the gap between them. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-4">
      {SIZES.map((size) => (
        <TagGroup key={size} {...args} size={size} aria-label={`Filters, ${size}`}>
          <Tag value="red">Red</Tag>
          <Tag value="filter" icon={<FilterIcon />}>
            In stock
          </Tag>
          <Tag value="katri" media={<Avatar name="Katri Athokas" />}>
            Katri
          </Tag>
        </TagGroup>
      ))}
    </div>
  ),
};

/** The group's `appearance` and `shape` are the defaults of its tags; a tag's own wins. */
export const Appearances: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-4">
      {APPEARANCES.map((appearance) => (
        <TagGroup
          key={appearance}
          {...args}
          appearance={appearance}
          aria-label={`Filters, ${appearance}`}
        >
          <Tag value="red">Red</Tag>
          <Tag value="blue">Blue</Tag>
          <Tag value="large" shape="rounded">
            Large (rounded)
          </Tag>
        </TagGroup>
      ))}
    </div>
  ),
};

/**
 * A disabled group disables every tag: the dismiss buttons are natively disabled and leave the
 * Tab order, and a tag cannot re-enable itself.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <TagGroup {...args}>
      <Tag value="red">Red</Tag>
      <Tag value="blue" disabled={false}>
        Blue
      </Tag>
      <Tag value="large">Large</Tag>
    </TagGroup>
  ),
};

/** Up/Down move between the dismiss buttons (`aria-orientation="vertical"`). */
export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
  render: (args) => <FilterBar {...args} />,
};

/**
 * Tags that only display are a list (`role="list"`): every tag is a list item, and a link in a
 * tag's content keeps its own Tab stop.
 */
export const StaticList: Story = {
  args: {
    role: 'list',
    'aria-label': 'Skills',
    dismissible: false,
  },
  render: (args) => (
    <TagGroup {...args}>
      <Tag appearance="brand">TypeScript</Tag>
      <Tag>React</Tag>
      <Tag>
        <a href="#accessibility">Accessibility</a>
      </Tag>
    </TagGroup>
  ),
};
