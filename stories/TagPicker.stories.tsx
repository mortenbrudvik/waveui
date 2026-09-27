import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import {
  Field,
  TagPicker,
  type ListboxItem,
  type TagPickerOption,
  type TagPickerProps,
} from '../src';

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
