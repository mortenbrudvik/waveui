import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Tag } from '../src';
import type { TagProps } from '../src';
/** The props Storybook passes (the default `<span>` Tag's props). */
type TagStoryProps = React.ComponentProps<typeof Tag>;

const meta = {
  title: 'Components/Data Display/Tag',
  component: Tag,
  args: {
    children: 'Tag label',
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;
/** A story that renders the tag as an anchor takes the anchor's props. */
type AnchorStory = StoryObj<TagProps<'a'>>;

/**
 * Keeps the tag's visibility in local state so dismissing it actually removes it. A tag cannot
 * keep focus once it is removed, so the dismissal moves focus to the "Restore" button next to it,
 * which brings the tag back. While the tag is shown, Restore is unavailable but stays focusable
 * (`disabledFocusable`), so it can take focus before the tag goes.
 */
function DismissibleTag(props: TagStoryProps) {
  const { onDismiss, ...rest } = props;
  const [visible, setVisible] = React.useState(true);
  const restore = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center gap-2">
      {visible && (
        <Tag
          {...rest}
          onDismiss={() => {
            onDismiss?.();
            // The Restore button stays mounted, so it can take focus before the tag goes.
            restore.current?.focus();
            setVisible(false);
          }}
        />
      )}
      <Button
        ref={restore}
        appearance="subtle"
        size="small"
        disabledFocusable={visible}
        onClick={() => setVisible(true)}
      >
        Restore
      </Button>
    </div>
  );
}

const FILTERS = ['Red', 'Blue', 'Large'];

/**
 * A filter bar that keeps its filters in state. Removing a tag moves focus to the next tag's
 * dismiss button, else the previous one, else "Reset filters", so keyboard focus is never lost.
 * "Reset filters" is unavailable but focusable (`disabledFocusable`) while every filter is set.
 * `Tag.test.tsx` implements the same recipe (its `FilterTags` component): keep the two in sync.
 */
function FilterBar(props: TagStoryProps) {
  const { onDismiss, ...rest } = props;
  const [filters, setFilters] = React.useState(FILTERS);
  // Each rendered tag by filter, to reach its dismiss button (the tag's only button).
  const tags = React.useRef(new Map<string, HTMLElement>());
  const reset = React.useRef<HTMLButtonElement>(null);

  const dismiss = (filter: string) => {
    onDismiss?.();
    const index = filters.indexOf(filter);
    const neighbour = filters[index + 1] ?? filters[index - 1];
    const target =
      neighbour === undefined
        ? reset.current
        : (tags.current.get(neighbour)?.querySelector('button') ?? null);
    // The neighbour stays mounted, so it can take focus before the tag is removed.
    target?.focus();
    setFilters((current) => current.filter((f) => f !== filter));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Active filters" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Tag
            key={filter}
            {...rest}
            ref={(element) => {
              if (element) tags.current.set(filter, element);
              return () => {
                tags.current.delete(filter);
              };
            }}
            onDismiss={() => dismiss(filter)}
          >
            {filter}
          </Tag>
        ))}
      </div>
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

export const Default: Story = {};

/**
 * The dismiss button is named "Dismiss" plus the tag content ("Dismiss Dismissible tag").
 * Dismissing moves focus to the separate "Restore" button.
 */
export const Dismissible: Story = {
  args: {
    children: 'Dismissible tag',
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => <DismissibleTag {...args} />,
};

/**
 * Every dismiss button of a filter bar has its own name ("Remove Red", "Remove Blue", …).
 * Removing a filter moves focus to the next filter's dismiss button, else the previous one, else
 * "Reset filters": the focus recipe of Tag's "Focus after dismissal" docs.
 */
export const FilterGroup: Story = {
  args: {
    dismissible: true,
    dismissLabel: 'Remove',
    onDismiss: fn(),
  },
  render: (args) => <FilterBar {...args} />,
};

/** `dismissIcon` replaces only the icon inside the built-in dismiss button. */
export const CustomDismissIcon: Story = {
  args: {
    children: 'Custom icon',
    dismissible: true,
    onDismiss: fn(),
    dismissIcon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
        <path d="M2 6h8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  render: (args) => <DismissibleTag {...args} />,
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
          className="me-1"
        >
          <circle cx="8" cy="8" r="6" />
        </svg>
        With icon
      </>
    ),
  },
};

/** Polymorphic: `as="a"` renders a link chip (anchor props are type-checked). */
export const AsLink: AnchorStory = {
  args: {
    as: 'a',
    href: '#topics/react',
    children: 'React',
  },
};
