import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Avatar, Field, Tag, type ListboxItem } from '../src';
import {
  TagPicker,
  type TagPickerOption,
  type TagPickerProps,
} from '../src/components/input/TagPicker';

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
  { value: 'elderberry', label: 'Elderberry' },
  { value: 'fig', label: 'Fig' },
  { value: 'grape', label: 'Grape' },
];

const meta = {
  title: 'Components/Input/TagPicker',
  component: TagPicker,
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    clearable: { control: 'boolean' },
    allowCreate: { control: 'boolean' },
    overflow: { control: 'inline-radio', options: ['wrap', 'count'] },
    size: { control: 'inline-radio', options: ['medium', 'large', 'extra-large'] },
    appearance: {
      control: 'inline-radio',
      options: ['outline', 'underline', 'filled-darker', 'filled-lighter'],
    },
  },
  args: {
    options: fruitOptions,
    'aria-label': 'Fruits',
    onValueChange: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof TagPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select fruits...',
  },
};

export const WithPreselected: Story = {
  args: {
    defaultValue: ['apple', 'cherry'],
    placeholder: 'Select fruits...',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: ['banana'],
    disabled: true,
  },
};

/** Read-only: the tags are shown without remove buttons and the option list stays closed. */
export const ReadOnly: Story = {
  args: {
    defaultValue: ['apple', 'cherry'],
    readOnly: true,
  },
};

/** Lower case without accents, so "creme" compares equal to "Crème". */
function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * `filter` replaces the built-in match (a substring of the label, ignoring case). Here an option
 * matches when its label starts with the typed text, ignoring accents: "creme" finds "Crème
 * brûlée", and "e" finds "Éclair" but not the desserts that only contain an "e".
 */
export const CustomFilter: Story = {
  args: {
    'aria-label': 'Desserts',
    options: [
      { value: 'creme-brulee', label: 'Crème brûlée' },
      { value: 'eclair', label: 'Éclair' },
      { value: 'mille-feuille', label: 'Mille-feuille' },
      { value: 'pain-au-chocolat', label: 'Pain au chocolat' },
      { value: 'tarte-tatin', label: 'Tarte Tatin' },
    ],
    placeholder: 'Type the start of a dessert...',
  },
  render: (args) => (
    <TagPicker
      {...args}
      filter={(option: ListboxItem, query: string) => fold(option.label).startsWith(fold(query))}
    />
  ),
};

const countryOptions: TagPickerOption[] = [
  'Argentina',
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'Chile',
  'Denmark',
  'Finland',
  'France',
  'Germany',
  'Iceland',
  'Ireland',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'Norway',
  'Portugal',
  'Spain',
  'Sweden',
].map((name) => ({ value: name.toLowerCase(), label: name }));

/** The fake server's answer: the first eight countries whose name contains the query. */
function searchCountries(query: string) {
  const text = query.toLowerCase();
  return countryOptions.filter((option) => option.label.toLowerCase().includes(text)).slice(0, 8);
}

/**
 * A search on a server: the parent owns the query (`query`, `onQueryChange`), asks for results
 * 300 ms after the last keystroke, and passes them as `options`, which `filter={() => true}` keeps
 * as they are. Until the answer arrives the previous results stay, so "No matches" is said only
 * when the answer is empty. The selected options stay in `options`, so their tags keep their
 * labels (the list never shows a selected option).
 */
function AsyncSearchTagPicker({ onQueryChange, onValueChange, ...args }: TagPickerProps) {
  const [query, setQuery] = React.useState('');
  // The query the shown results answer: the search is pending while it differs from `query`.
  const [answered, setAnswered] = React.useState('');
  const [results, setResults] = React.useState(() => searchCountries(''));
  const [value, setValue] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (query === answered) return;
    const timer = setTimeout(() => {
      setResults(searchCountries(query));
      setAnswered(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, answered]);
  const options = [
    ...countryOptions.filter((option) => value.includes(option.value) && !results.includes(option)),
    ...results,
  ];
  return (
    <div className="flex flex-col gap-1">
      <TagPicker
        {...args}
        options={options}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
        filter={() => true}
        query={query}
        onQueryChange={(next) => {
          setQuery(next);
          onQueryChange?.(next);
        }}
      />
      <span className="text-caption-1 text-muted-foreground">
        {query === answered ? `${results.length} results` : 'Searching…'}
      </span>
    </div>
  );
}

export const AsyncSearch: Story = {
  args: {
    'aria-label': 'Countries',
    placeholder: 'Search countries...',
    onQueryChange: fn(),
  },
  render: (args) => <AsyncSearchTagPicker {...args} />,
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select fruits...',
  },
  render: (args) => (
    <Field label="Fruits" error="Pick at least one fruit." required>
      <TagPicker {...args} />
    </Field>
  ),
};

const FRUIT = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
];

/**
 * Every size (`medium`, `large`, `extra-large`) at every appearance, in the parts form with a
 * selected tag: the tags are one Tag size smaller (extra-small, small, medium), filled, and
 * outlined on `filled-darker`; the chevron sits on the first row.
 */
export const SizesAndAppearances: Story = {
  render: (args) => (
    <div className="grid gap-4">
      {(['outline', 'underline', 'filled-darker', 'filled-lighter'] as const).map((appearance) => (
        <div
          key={appearance}
          className={
            appearance === 'filled-lighter'
              ? 'grid grid-cols-3 items-start gap-3 rounded bg-secondary p-3'
              : 'grid grid-cols-3 items-start gap-3 p-3'
          }
        >
          {(['medium', 'large', 'extra-large'] as const).map((size) => (
            <TagPicker
              {...args}
              key={size}
              size={size}
              appearance={appearance}
              options={FRUIT}
              defaultValue={['apple']}
              clearable
              aria-label={`${size} ${appearance}`}
            >
              <TagPicker.Control>
                <TagPicker.Group />
                <TagPicker.Input />
              </TagPicker.Control>
              <TagPicker.List />
            </TagPicker>
          ))}
        </div>
      ))}
    </div>
  ),
};

const people = [
  { value: 'katri', name: 'Katri Athokas', role: 'Designer' },
  { value: 'elvia', name: 'Elvia Atkins', role: 'Engineer' },
  { value: 'cameron', name: 'Cameron Evans', role: 'Product manager' },
  { value: 'mona', name: 'Mona Kane', role: 'Researcher' },
  { value: 'wanda', name: 'Wanda Howard', role: 'Engineering manager' },
];
const nameOf = (value: string) => people.find((person) => person.value === value)?.name ?? value;

/**
 * A people picker, the parts form: `TagPicker.Option`s with an Avatar (`media`) and the person's
 * role (`secondaryContent`), and your own Tags with Avatars in `TagPicker.Group`. The option's
 * label is the name alone, so the tag, the filter and the announcements read only the name.
 */
function PeoplePickerExample(args: TagPickerProps) {
  const [value, setValue] = React.useState<string[]>(['katri']);
  return (
    <TagPicker
      {...args}
      options={undefined}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        args.onValueChange?.(next);
      }}
    >
      <TagPicker.Control>
        <TagPicker.Group>
          {value.map((id) => (
            <Tag
              key={id}
              value={id}
              media={<Avatar name={nameOf(id)} decorative />}
              dismissLabel="Remove"
            >
              {nameOf(id)}
            </Tag>
          ))}
        </TagPicker.Group>
        <TagPicker.Input />
      </TagPicker.Control>
      <TagPicker.List>
        {people.map((person) => (
          <TagPicker.Option
            key={person.value}
            value={person.value}
            label={person.name}
            media={<Avatar name={person.name} decorative />}
            secondaryContent={person.role}
          >
            {person.name}
          </TagPicker.Option>
        ))}
      </TagPicker.List>
    </TagPicker>
  );
}

export const PeoplePicker: Story = {
  args: { 'aria-label': 'People', placeholder: 'Add people...' },
  render: (args) => <PeoplePickerExample {...args} />,
};

/**
 * The parts written out: `TagPicker.Control` with your own Tags (an outline look) and the Input,
 * and a `TagPicker.List` of `TagPicker.Option`s. Each part renders its default content when it
 * has no children.
 */
function ComposedPartsExample(args: TagPickerProps) {
  const [value, setValue] = React.useState<string[]>(['banana']);
  return (
    <TagPicker
      {...args}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        args.onValueChange?.(next);
      }}
    >
      <TagPicker.Control>
        <TagPicker.Group>
          {value.map((v) => (
            <Tag key={v} value={v} appearance="outline">
              {fruitOptions.find((option) => option.value === v)?.label ?? v}
            </Tag>
          ))}
        </TagPicker.Group>
        <TagPicker.Input />
      </TagPicker.Control>
      <TagPicker.List>
        {fruitOptions.map((option) => (
          <TagPicker.Option key={option.value} value={option.value}>
            {option.label}
          </TagPicker.Option>
        ))}
      </TagPicker.List>
    </TagPicker>
  );
}

export const ComposedParts: Story = {
  render: (args) => <ComposedPartsExample {...args} />,
};

/**
 * `TagPicker.OptionGroup`s under headings. A group whose options are all selected hides itself;
 * the arrow keys cross the groups.
 */
export const OptionGroups: Story = {
  args: { 'aria-label': 'Produce', defaultValue: ['apple'] },
  render: (args) => (
    <TagPicker {...args} options={undefined}>
      <TagPicker.Control />
      <TagPicker.List>
        <TagPicker.OptionGroup label="Fruit">
          <TagPicker.Option value="apple">Apple</TagPicker.Option>
          <TagPicker.Option value="pear">Pear</TagPicker.Option>
        </TagPicker.OptionGroup>
        <TagPicker.OptionGroup label="Vegetables">
          <TagPicker.Option value="carrot">Carrot</TagPicker.Option>
          <TagPicker.Option value="leek">Leek</TagPicker.Option>
        </TagPicker.OptionGroup>
      </TagPicker.List>
    </TagPicker>
  ),
};

/**
 * `TagPicker.Button`, a select-only trigger for a short fixed list: Down, Up and typing a letter
 * open and move, Enter and Space add the active option, a click toggles the list.
 */
export const ButtonTrigger: Story = {
  args: { 'aria-label': 'Fruits', placeholder: 'Choose fruits' },
  render: (args) => (
    <TagPicker {...args}>
      <TagPicker.Control>
        <TagPicker.Group />
        <TagPicker.Button />
      </TagPicker.Control>
      <TagPicker.List />
    </TagPicker>
  ),
};

/**
 * Free tagging (`allowCreate`): type a topic that is not listed and press Enter on
 * `Create "…"`; `onOptionCreate` adds it to the options here, so the new tag keeps its label.
 */
function FreeTaggingExample(args: TagPickerProps) {
  const [options, setOptions] = React.useState<TagPickerOption[]>([
    { value: 'design', label: 'Design' },
    { value: 'frontend', label: 'Frontend' },
    { value: 'testing', label: 'Testing' },
  ]);
  return (
    <TagPicker
      {...args}
      options={options}
      allowCreate
      onOptionCreate={(text) => {
        setOptions((current) => [...current, { value: text, label: text }]);
        args.onOptionCreate?.(text);
      }}
    />
  );
}

export const FreeTagging: Story = {
  args: { 'aria-label': 'Topics', placeholder: 'Add topics...', onOptionCreate: fn() },
  render: (args) => <FreeTaggingExample {...args} />,
};

/**
 * Free tagging with a server-side search: the create option follows the current results, so it
 * disappears once the answer holds an option of that name.
 */
function FreeTaggingAsyncExample({ onQueryChange, ...args }: TagPickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState(() => searchCountries(''));
  React.useEffect(() => {
    const timer = setTimeout(() => setResults(searchCountries(query)), 300);
    return () => clearTimeout(timer);
  }, [query]);
  return (
    <TagPicker
      {...args}
      options={results}
      filter={() => true}
      query={query}
      onQueryChange={(next) => {
        setQuery(next);
        onQueryChange?.(next);
      }}
      allowCreate
    />
  );
}

export const FreeTaggingWithAsyncSearch: Story = {
  args: {
    'aria-label': 'Destinations',
    placeholder: 'Search or add...',
    onQueryChange: fn(),
    onOptionCreate: fn(),
  },
  render: (args) => <FreeTaggingAsyncExample {...args} />,
};

/** `clearable`: a clear button, a Tab stop after the input, removes every tag. */
export const Clearable: Story = {
  args: { clearable: true, defaultValue: ['apple', 'cherry', 'fig'] },
};

/**
 * `overflow="count"`: while focus is outside the picker the tags stay on one line and the ones
 * that do not fit give way to "+N"; focusing the picker shows them all.
 */
export const SingleLine: Story = {
  args: {
    overflow: 'count',
    defaultValue: ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig'],
  },
  render: (args) => (
    <div className="w-72">
      <TagPicker {...args} />
    </div>
  ),
};

/** `expandIcon`: a custom glyph, and `false`, which hides the expand button (the 0.10 look). */
export const ExpandIcon: Story = {
  render: (args) => (
    <div className="grid gap-3">
      <TagPicker {...args} aria-label="Fruits with a custom glyph" expandIcon={<span>▾</span>} />
      <TagPicker {...args} aria-label="Fruits without an expand button" expandIcon={false} />
    </div>
  ),
};

/** Every built-in text in Norwegian through `labels` (and the placeholder). */
export const LocalizedLabels: Story = {
  args: {
    'aria-label': 'Frukt',
    placeholder: 'Velg frukt...',
    defaultValue: ['apple', 'banana', 'cherry', 'date'],
    clearable: true,
    allowCreate: true,
    overflow: 'count',
    labels: {
      remove: (label) => `Fjern ${label}`,
      selected: 'Valgt',
      summary: (labels) => `Valgt: ${labels.join(', ')}`,
      added: (label, count) => `${label} lagt til, ${count} valgt`,
      removed: (label, count) => `${label} fjernet, ${count} valgt`,
      noMatches: 'Ingen treff',
      create: (text) => `Opprett «${text}»`,
      clear: 'Fjern alle',
      expand: 'Vis alternativer',
      overflowCount: (count) => `+${count}`,
    },
  },
  render: (args) => (
    <div className="w-72">
      <TagPicker {...args} />
    </div>
  ),
};
