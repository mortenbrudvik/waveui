import * as React from 'react';
import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, PresenceBadge, Tag } from '../src';
import type { TagAppearance, TagProps, TagShape, TagSize } from '../src';
import { TagGroup } from '../src/components/data-display/TagGroup';
/** The props Storybook passes (the default `<span>` Tag's props). */
type TagStoryProps = React.ComponentProps<typeof Tag>;

const SIZES = ['medium', 'small', 'extra-small'] as const satisfies readonly TagSize[];
const APPEARANCES = ['filled', 'outline', 'brand'] as const satisfies readonly TagAppearance[];
const SHAPES = ['circular', 'rounded'] as const satisfies readonly TagShape[];

/** The tag vocabulary, declared here (the shared helpers cover the Wave-wide unions). */
const tagArgTypes = {
  size: { control: 'inline-radio', options: SIZES },
  appearance: { control: 'inline-radio', options: APPEARANCES },
  shape: { control: 'inline-radio', options: SHAPES },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Data Display/Tag',
  component: Tag,
  argTypes: tagArgTypes,
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
 * A filter bar that keeps its filters in state, on a TagGroup toolbar (one Tab stop, the arrow
 * keys between the dismiss buttons). The group reports each dismissal with the tag's `value`, and
 * when the filter that had focus is removed it moves focus to the next filter's dismiss button,
 * else the previous one, else "Reset filters" (its `fallbackFocusRef`), so keyboard focus is never
 * lost. "Reset filters" is unavailable but focusable (`disabledFocusable`) while every filter is
 * set.
 */
function FilterBar(props: TagStoryProps) {
  const { onDismiss, ...rest } = props;
  const [filters, setFilters] = React.useState(FILTERS);
  const reset = React.useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TagGroup
        aria-label="Active filters"
        fallbackFocusRef={reset}
        onDismiss={(value) => setFilters((current) => current.filter((f) => f !== value))}
      >
        {filters.map((filter) => (
          <Tag key={filter} {...rest} value={filter} onDismiss={onDismiss}>
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
 * Every dismiss button of a filter bar has its own name ("Remove Red", "Remove Blue", …). The
 * filters are a TagGroup: Tab reaches the first one, Left/Right move between them, and Enter,
 * Space, Delete or Backspace removes one. Removing a filter moves focus to the next filter's
 * dismiss button, else the previous one, else "Reset filters" (the group's `fallbackFocusRef`).
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

/** A decorative glyph for the `icon` slot: the tag draws it in a 20, 16 or 12px box. */
function DotIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}

/** `icon` is decorative (`aria-hidden`) and sits before the text, in a box sized for the tag. */
export const WithIcon: Story = {
  args: {
    icon: <DotIcon />,
    children: 'With icon',
  },
};

/**
 * `appearance`: `filled` (a neutral fill, the default), `outline` (a border on the surface behind
 * it) or `brand` (a light brand tint). Each dismiss button is named after its tag.
 */
export const Appearances: Story = {
  args: {
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {APPEARANCES.map((appearance) => (
        <Tag key={appearance} {...args} appearance={appearance}>
          {appearance}
        </Tag>
      ))}
    </div>
  ),
};

/**
 * `size`: `medium` (28px tall), `small` (24px) or `extra-small` (20px), with text only, an icon,
 * an Avatar (24, 20 or 16px) and a dismiss button. Every dismiss button has a 24px pointer target.
 */
export const Sizes: Story = {
  args: {
    onDismiss: fn(),
  },
  // Only the dismissible tag takes `onDismiss` (without `dismissible` it would be ignored).
  render: ({ onDismiss, ...args }) => (
    <div className="flex flex-col items-start gap-3">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <Tag {...args} size={size}>
            {size}
          </Tag>
          <Tag {...args} size={size} icon={<DotIcon />}>
            With icon
          </Tag>
          <Tag {...args} size={size} media={<Avatar name="Katri Athokas" decorative />}>
            Katri Athokas
          </Tag>
          <Tag {...args} size={size} dismissible onDismiss={onDismiss}>
            {`Dismissible ${size}`}
          </Tag>
        </div>
      ))}
    </div>
  ),
};

/** `shape`: `circular` (a pill, the default) or `rounded` (4px corners). */
export const Shapes: Story = {
  args: {
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {SHAPES.map((shape) => (
        <Tag key={shape} {...args} shape={shape}>
          {shape}
        </Tag>
      ))}
    </div>
  ),
};

/**
 * `disabled` dims the tag and disables its dismiss button natively: it leaves the Tab order and
 * calls no `onDismiss`.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    onDismiss: fn(),
  },
  // Only the dismissible tag takes `onDismiss` (without `dismissible` it would be ignored).
  render: ({ onDismiss, ...args }) => (
    <div className="flex flex-wrap items-center gap-2">
      <Tag {...args}>Disabled</Tag>
      <Tag {...args} dismissible onDismiss={onDismiss}>
        Disabled and dismissible
      </Tag>
    </div>
  ),
};

/**
 * `selected` is a look only (the brand fill, `data-selected`): a Tag is not interactive, so the
 * state is not announced. For a tag the user selects, use
 * [InteractionTag](?path=/docs/components-data-display-interactiontag--docs), whose primary
 * button is a toggle.
 */
export const Selected: Story = {
  args: {
    selected: true,
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {APPEARANCES.map((appearance) => (
        <Tag key={appearance} {...args} appearance={appearance}>
          {`Selected ${appearance}`}
        </Tag>
      ))}
    </div>
  ),
};

/**
 * `media` holds an Avatar, which takes the tag's size unless it sets its own. It is not hidden
 * from assistive technology: an Avatar whose name repeats the tag's text is `decorative`. A
 * presence badge is sized by hand (`size="extra-small"`). The dismiss button is named after the
 * text only ("Dismiss Katri Athokas").
 */
export const WithMedia: Story = {
  args: {
    dismissible: true,
    onDismiss: fn(),
  },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Tag {...args} media={<Avatar name="Katri Athokas" decorative />}>
        Katri Athokas
      </Tag>
      <Tag
        {...args}
        media={
          <Avatar
            name="Elvia Atkins"
            badge={<PresenceBadge status="available" size="extra-small" />}
          />
        }
      >
        Reviewer
      </Tag>
    </div>
  ),
};

/**
 * `secondaryText` adds a smaller second line under the text; it is not part of the dismiss
 * button's name. A small or extra-small tag grows to 28px to fit it.
 */
export const SecondaryText: Story = {
  args: {
    media: <Avatar name="Katri Athokas" decorative />,
    secondaryText: 'Designer',
    dismissible: true,
    onDismiss: fn(),
    children: 'Katri Athokas',
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

/**
 * A dismissible link chip puts the link in the tag's content: a dismiss button cannot sit inside
 * a link. The tag stays a `<span>`, the link and the dismiss button ("Dismiss React") are siblings.
 */
export const DismissibleLink: Story = {
  args: {
    dismissible: true,
    onDismiss: fn(),
    children: <a href="#topics/react">React</a>,
  },
  render: (args) => <DismissibleTag {...args} />,
};
