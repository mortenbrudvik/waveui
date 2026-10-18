import * as React from 'react';
import type { ArgTypes, Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Button, InteractionTag, Tag, TagGroup, Text } from '../src';
import type { TagAppearance, TagGroupProps, TagShape, TagSize } from '../src';
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

const PEOPLE = ['Katri Athokas', 'Elvia Atkins', 'Cameron Evans'];

/** Reviewers kept in state: the group's `onDismiss(value)` removes one, "Add reviewer" restores them. */
function Reviewers(props: TagGroupProps) {
  const { onDismiss, ...rest } = props;
  const [people, setPeople] = React.useState(PEOPLE);
  const add = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TagGroup
        {...rest}
        fallbackFocusRef={add}
        onDismiss={(value) => {
          onDismiss?.(value);
          setPeople((current) => current.filter((person) => person !== value));
        }}
      >
        {people.map((person) => (
          <InteractionTag key={person} value={person}>
            <InteractionTag.Primary media={<Avatar name={person} />} onClick={fn()}>
              {person}
            </InteractionTag.Primary>
            <InteractionTag.Secondary />
          </InteractionTag>
        ))}
      </TagGroup>
      <Button
        ref={add}
        appearance="subtle"
        size="small"
        disabledFocusable={people.length === PEOPLE.length}
        onClick={() => setPeople(PEOPLE)}
      >
        Add reviewer
      </Button>
    </div>
  );
}

/**
 * Reviewers as InteractionTags, each with a Secondary: the Primary opens the person, the
 * Secondary removes them. Both buttons of every tag join the toolbar's arrow order; Delete or
 * Backspace on either removes the reviewer. Focus then moves to the next reviewer's Dismiss
 * button (from a Primary, to the next reviewer's Primary), else the previous one, else "Add
 * reviewer", the group's `fallbackFocusRef`.
 */
export const WithInteractionTags: Story = {
  args: {
    'aria-label': 'Reviewers',
    dismissible: false,
  },
  render: (args) => <Reviewers {...args} />,
};

const FRUIT = ['Cherry', 'Plum', 'Fig', 'Kiwi'];

/** The selected values as a sentence, for the stories that show them. */
const selectedText = (values: readonly string[]) =>
  `Selected: ${values.length > 0 ? values.join(', ') : 'none'}`;

/**
 * Fruit chips the story keeps the selection of: the group reports each toggle with the new values
 * (in selection order), and the line below shows them.
 */
function SelectableChips(props: TagGroupProps) {
  const { value: _value, defaultValue, onValueChange, ...rest } = props;
  const [selected, setSelected] = React.useState<readonly string[]>(defaultValue ?? []);
  return (
    <div className="flex flex-col items-start gap-2">
      <TagGroup
        {...rest}
        value={selected}
        onValueChange={(value) => {
          onValueChange?.(value);
          setSelected(value);
        }}
      >
        {FRUIT.map((fruit) => (
          <InteractionTag key={fruit} value={fruit.toLowerCase()}>
            <InteractionTag.Primary>{fruit}</InteractionTag.Primary>
          </InteractionTag>
        ))}
      </TagGroup>
      <Text variant="caption-1">{selectedText(selected)}</Text>
    </div>
  );
}

/**
 * Filter chips: with `value` and `onValueChange` (Fluent's `selectedValues` and `onTagSelect`)
 * the group selects, and every `InteractionTag.Primary` is a toggle (`aria-pressed`). Tab reaches
 * the chips, Left/Right move between them, and Enter or Space toggles one; the arrow keys never
 * toggle. Plain Tags are never selected.
 */
export const Selectable: Story = {
  args: {
    'aria-label': 'Fruit',
    dismissible: false,
    defaultValue: ['plum'],
    onValueChange: fn(),
  },
  render: (args) => <SelectableChips {...args} />,
};

/**
 * Fruit chips with a Dismiss button each: the story keeps the fruit and the selection, removes a
 * fruit when the group reports its dismissal, and "Restore fruit" brings them back.
 */
function SelectableDismissibleChips(props: TagGroupProps) {
  const { value: _value, defaultValue, onValueChange, onDismiss, ...rest } = props;
  const [fruit, setFruit] = React.useState(FRUIT);
  const [selected, setSelected] = React.useState<readonly string[]>(defaultValue ?? []);
  const restore = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <TagGroup
          {...rest}
          fallbackFocusRef={restore}
          value={selected}
          onValueChange={(value) => {
            onValueChange?.(value);
            setSelected(value);
          }}
          onDismiss={(value) => {
            onDismiss?.(value);
            setFruit((current) => current.filter((item) => item.toLowerCase() !== value));
          }}
        >
          {fruit.map((item) => (
            <InteractionTag key={item} value={item.toLowerCase()}>
              <InteractionTag.Primary>{item}</InteractionTag.Primary>
              <InteractionTag.Secondary />
            </InteractionTag>
          ))}
        </TagGroup>
        <Button
          ref={restore}
          appearance="subtle"
          size="small"
          disabledFocusable={fruit.length === FRUIT.length}
          onClick={() => setFruit(FRUIT)}
        >
          Restore fruit
        </Button>
      </div>
      <Text variant="caption-1">{selectedText(selected)}</Text>
    </div>
  );
}

/**
 * Chips that are selected and dismissed: each InteractionTag has a Secondary, and both of its
 * buttons join the arrow order. Dismissing a selected chip calls `onDismiss` and then
 * `onValueChange` without its value, so the selection never keeps a removed chip. Focus then
 * moves to the next chip, else the previous one, else "Restore fruit", the group's
 * `fallbackFocusRef`.
 */
export const SelectableDismissible: Story = {
  args: {
    'aria-label': 'Fruit',
    dismissible: false,
    defaultValue: ['cherry', 'fig'],
    onValueChange: fn(),
  },
  render: (args) => <SelectableDismissibleChips {...args} />,
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

/** A form around the group that prints its entries when it is submitted. */
function FruitOrder(props: TagGroupProps) {
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  return (
    <form
      aria-label="Fruit order"
      className="flex flex-col items-start gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const entries = [...new FormData(event.currentTarget).entries()];
        setSubmitted(entries.map(([key, value]) => `${key}=${String(value)}`).join(', '));
      }}
      onReset={() => setSubmitted(null)}
    >
      <TagGroup {...props}>
        {FRUIT.map((fruit) => (
          <InteractionTag key={fruit} value={fruit.toLowerCase()}>
            <InteractionTag.Primary>{fruit}</InteractionTag.Primary>
          </InteractionTag>
        ))}
      </TagGroup>
      <div className="flex gap-2">
        <Button type="submit" appearance="primary" size="small">
          Order
        </Button>
        <Button type="reset" size="small">
          Reset
        </Button>
      </div>
      <output className="text-caption-1 text-muted-foreground">
        {submitted === null ? 'Nothing submitted yet' : `Submitted: ${submitted || 'nothing'}`}
      </output>
    </form>
  );
}

/**
 * In a form: with `name` the group submits one entry per selected value (the hidden inputs sit in
 * the group), `required` blocks the submission of an empty selection and moves focus to the
 * group's Tab stop, and Reset restores `defaultValue`. "Order" prints the submitted entries.
 */
export const InAForm: Story = {
  args: {
    'aria-label': 'Fruit',
    dismissible: false,
    name: 'fruit',
    required: true,
    defaultValue: ['plum'],
    onValueChange: fn(),
  },
  render: (args) => <FruitOrder {...args} />,
};
