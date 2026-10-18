import * as React from 'react';
import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, Popover } from '../src';
import type { TagAppearance, TagShape, TagSize } from '../src';
import { InteractionTag } from '../src/components/data-display/InteractionTag';
import type { InteractionTagProps } from '../src/components/data-display/InteractionTag';

const SIZES = ['medium', 'small', 'extra-small'] as const satisfies readonly TagSize[];
const APPEARANCES = ['filled', 'outline', 'brand'] as const satisfies readonly TagAppearance[];
const SHAPES = ['circular', 'rounded'] as const satisfies readonly TagShape[];

/** The tag vocabulary, declared here (the shared helpers cover the Wave-wide unions). */
const interactionTagArgTypes = {
  size: { control: 'inline-radio', options: SIZES },
  appearance: { control: 'inline-radio', options: APPEARANCES },
  shape: { control: 'inline-radio', options: SHAPES },
  selected: { control: 'boolean' },
} satisfies ArgTypes;

const meta = {
  title: 'Components/Data Display/InteractionTag',
  component: InteractionTag,
  argTypes: interactionTagArgTypes,
  args: {
    value: 'cherry',
  },
} satisfies Meta<typeof InteractionTag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A decorative glyph for the Primary's `icon` slot (drawn in a 20, 16 or 12px box). */
function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.5 1a.5.5 0 0 1 .5.5V2h6v-.5a.5.5 0 0 1 1 0V2h.5A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H4v-.5a.5.5 0 0 1 .5-.5ZM3 6v6.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V6H3Z" />
    </svg>
  );
}

/**
 * Keeps the tag in local state, so its Secondary removes it. A tag cannot keep focus once it is
 * removed, so the dismissal first moves focus to the "Restore" button next to it, which brings the
 * tag back. While the tag is shown, Restore is unavailable but focusable (`disabledFocusable`).
 */
function RemovableTag({ children, ...props }: InteractionTagProps) {
  const [visible, setVisible] = React.useState(true);
  const restore = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex items-center gap-2">
      {visible && (
        <InteractionTag {...props}>
          {children}
          <InteractionTag.Secondary
            onClick={() => {
              restore.current?.focus();
              setVisible(false);
            }}
          />
        </InteractionTag>
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

/** A tag with one action: `InteractionTag.Primary` is a button named by its text. */
export const Default: Story = {
  render: (args) => (
    <InteractionTag {...args}>
      <InteractionTag.Primary onClick={fn()}>Cherry</InteractionTag.Primary>
    </InteractionTag>
  ),
};

/**
 * The Secondary is a separate Dismiss button after the Primary, named after the Primary's text
 * ("Dismiss Cherry"). Tab reaches the Primary, then the Secondary; Delete or Backspace on either
 * dismisses through the Secondary.
 */
export const WithSecondary: Story = {
  render: (args) => (
    <RemovableTag {...args}>
      <InteractionTag.Primary onClick={fn()}>Cherry</InteractionTag.Primary>
    </RemovableTag>
  ),
};

/**
 * `selected` draws the selected look and makes the Primary a toggle (`aria-pressed`): here the
 * story keeps the state and the Primary's click toggles it. Outside a TagGroup the app owns it.
 */
export const Selected: Story = {
  render: function SelectedStory(args) {
    const [selected, setSelected] = React.useState(true);
    return (
      <InteractionTag {...args} selected={selected}>
        <InteractionTag.Primary onClick={() => setSelected((current) => !current)}>
          Cherry
        </InteractionTag.Primary>
        <InteractionTag.Secondary onClick={fn()} />
      </InteractionTag>
    );
  },
};

/** `icon` is decorative (`aria-hidden`) and sits before the text, in a box sized for the tag. */
export const WithIcon: Story = {
  render: (args) => (
    <InteractionTag {...args}>
      <InteractionTag.Primary icon={<CalendarIcon />} onClick={fn()}>
        Tomorrow
      </InteractionTag.Primary>
      <InteractionTag.Secondary onClick={fn()} />
    </InteractionTag>
  ),
};

/**
 * `media` holds an Avatar, which takes the tag's size (24, 20 or 16px) unless it sets its own. It
 * is decorative in the Primary, which is named by its text ("Katri Athokas").
 */
export const WithMedia: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <InteractionTag {...args} value="katri">
        <InteractionTag.Primary media={<Avatar name="Katri Athokas" />} onClick={fn()}>
          Katri Athokas
        </InteractionTag.Primary>
        <InteractionTag.Secondary onClick={fn()} />
      </InteractionTag>
      <InteractionTag {...args} value="elvia">
        <InteractionTag.Primary media={<Avatar name="Elvia Atkins" />} onClick={fn()}>
          Elvia Atkins
        </InteractionTag.Primary>
      </InteractionTag>
    </div>
  ),
};

/**
 * `secondaryText` adds a smaller second line under the text. It is part of the Primary's name
 * ("Katri Athokas Designer"), not of the Secondary's ("Dismiss Katri Athokas").
 */
export const SecondaryText: Story = {
  render: (args) => (
    <InteractionTag {...args}>
      <InteractionTag.Primary
        media={<Avatar name="Katri Athokas" />}
        secondaryText="Designer"
        onClick={fn()}
      >
        Katri Athokas
      </InteractionTag.Primary>
      <InteractionTag.Secondary onClick={fn()} />
    </InteractionTag>
  ),
};

/** `size`: 28, 24 or 20px tall; the icon box and the Avatar follow. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-2">
          <InteractionTag {...args} size={size} value={`text-${size}`}>
            <InteractionTag.Primary onClick={fn()}>{`Cherry (${size})`}</InteractionTag.Primary>
            <InteractionTag.Secondary onClick={fn()} />
          </InteractionTag>
          <InteractionTag {...args} size={size} value={`icon-${size}`}>
            <InteractionTag.Primary icon={<CalendarIcon />} onClick={fn()}>
              {`Tomorrow (${size})`}
            </InteractionTag.Primary>
            <InteractionTag.Secondary onClick={fn()} />
          </InteractionTag>
          <InteractionTag {...args} size={size} value={`media-${size}`}>
            <InteractionTag.Primary media={<Avatar name="Katri Athokas" />} onClick={fn()}>
              {`Katri (${size})`}
            </InteractionTag.Primary>
          </InteractionTag>
        </div>
      ))}
    </div>
  ),
};

/** `shape`: `circular` (a pill, the default) or `rounded` (4px corners). */
export const Shapes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {SHAPES.map((shape) => (
        <InteractionTag key={shape} {...args} shape={shape} value={shape}>
          <InteractionTag.Primary onClick={fn()}>{shape}</InteractionTag.Primary>
          <InteractionTag.Secondary onClick={fn()} />
        </InteractionTag>
      ))}
    </div>
  ),
};

/**
 * `appearance`: a neutral fill, a border on the surface behind it, or a light brand tint; the
 * last tag is `selected`. Both buttons share the look, with a divider between them.
 */
export const Appearances: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {APPEARANCES.map((appearance) => (
        <InteractionTag key={appearance} {...args} appearance={appearance} value={appearance}>
          <InteractionTag.Primary onClick={fn()}>{appearance}</InteractionTag.Primary>
          <InteractionTag.Secondary onClick={fn()} />
        </InteractionTag>
      ))}
      <InteractionTag {...args} selected value="selected">
        <InteractionTag.Primary onClick={fn()}>selected</InteractionTag.Primary>
        <InteractionTag.Secondary onClick={fn()} />
      </InteractionTag>
    </div>
  ),
};

/** `disabled` disables both buttons natively: they dim and leave the Tab order. */
export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <InteractionTag {...args}>
      <InteractionTag.Primary onClick={fn()}>Cherry</InteractionTag.Primary>
      <InteractionTag.Secondary onClick={fn()} />
    </InteractionTag>
  ),
};

/**
 * The Primary as a Popover's trigger (Fluent's "has primary action"): it opens details about the
 * person, and the Secondary stays a separate Dismiss button.
 */
export const PrimaryOpensPopover: Story = {
  args: {
    value: 'katri',
  },
  render: (args) => (
    <InteractionTag {...args}>
      <Popover>
        <Popover.Trigger>
          <InteractionTag.Primary media={<Avatar name="Katri Athokas" />}>
            Katri Athokas
          </InteractionTag.Primary>
        </Popover.Trigger>
        <Popover.Content title="Katri Athokas">Designer in the Helsinki office.</Popover.Content>
      </Popover>
      <InteractionTag.Secondary onClick={fn()} />
    </InteractionTag>
  ),
};

/**
 * The Secondary's children replace the dismiss glyph. A text label among them replaces
 * `dismissLabel` in its name: "Remove Cherry".
 */
export const CustomDismissContent: Story = {
  render: (args) => (
    <InteractionTag {...args}>
      <InteractionTag.Primary onClick={fn()}>Cherry</InteractionTag.Primary>
      <InteractionTag.Secondary onClick={fn()}>Remove</InteractionTag.Secondary>
    </InteractionTag>
  ),
};
