import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Combobox, Field, Option, OptionGroup, type ComboboxProps, type ListboxItem } from '../src';

const meta = {
  title: 'Components/Input/Combobox',
  component: Combobox,
  argTypes: {
    disabled: { control: 'boolean' },
    freeform: { control: 'boolean' },
    clearable: { control: 'boolean' },
    expandIcon: { control: false },
  },
  args: {
    'aria-label': 'Fruit',
    onValueChange: fn(),
    onOpenChange: fn(),
    style: { width: 250 },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The expand button at the end of the input opens and closes the list; it is not a tab stop. */
export const Default: Story = {
  args: {
    placeholder: 'Select a fruit...',
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="apple">Apple</Option>
      <Option value="banana">Banana</Option>
      <Option value="cherry">Cherry</Option>
      <Option value="grape">Grape</Option>
      <Option value="orange">Orange</Option>
    </Combobox>
  ),
};

export const Freeform: Story = {
  args: {
    'aria-label': 'Color',
    placeholder: 'Type or select...',
    freeform: true,
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="red">Red</Option>
      <Option value="green">Green</Option>
      <Option value="blue">Blue</Option>
    </Combobox>
  ),
};

export const Grouped: Story = {
  args: {
    'aria-label': 'Produce',
    placeholder: 'Search produce...',
  },
  render: (args) => (
    <Combobox {...args}>
      <OptionGroup label="Fruit">
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
      </OptionGroup>
      <OptionGroup label="Vegetables">
        <Option value="carrot">Carrot</Option>
        <Option value="pea" disabled>
          Pea (out of stock)
        </Option>
      </OptionGroup>
    </Combobox>
  ),
};

/** `clearable` adds a clear button while a value is selected, a tab stop after the input. */
export const Clearable: Story = {
  args: {
    defaultValue: 'banana',
    clearable: true,
    placeholder: 'Select a fruit...',
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="apple">Apple</Option>
      <Option value="banana">Banana</Option>
      <Option value="cherry">Cherry</Option>
    </Combobox>
  ),
};

/**
 * `multiselect` selects several options: a checkbox per option, and the selected labels in the
 * input until you type. Focusing the input selects them, so typing replaces them with text that
 * filters the options; a toggle shows them again. `clearable` clears all of them.
 */
export const Multiselect: StoryObj<ComboboxProps<true>> = {
  args: {
    'aria-label': undefined,
    multiselect: true,
    clearable: true,
    defaultValue: ['apple', 'cherry'],
    placeholder: 'Select fruits...',
  },
  // `freeform` is not available with `multiselect`: hide the meta's control on this story.
  argTypes: { freeform: { table: { disable: true } } },
  // The spread alone leaves `multiselect` optional (StoryObj widens `args`), which satisfies
  // neither call signature (D9): the literal attribute after it forces the multi-select one.
  render: (args) => (
    <Field label="Fruits">
      <Combobox {...args} multiselect>
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
        <Option value="cherry">Cherry</Option>
        <Option value="grape">Grape</Option>
        <Option value="orange">Orange</Option>
      </Combobox>
    </Field>
  ),
};

/** Lower case without accents, so "creme" compares equal to "Crème". */
function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Matches an option whose label starts with the typed text, ignoring case and accents. */
function startsWithIgnoringAccents(option: ListboxItem, query: string) {
  return fold(option.label).startsWith(fold(query));
}

/**
 * `filter` replaces the built-in match (a substring of the label, ignoring case). Here an option
 * matches when its label starts with the typed text, ignoring accents: "creme" finds "Crème
 * brûlée", and "e" finds "Éclair" but not the desserts that only contain an "e".
 */
export const CustomFilter: Story = {
  args: {
    'aria-label': 'Dessert',
    placeholder: 'Type the start of a dessert...',
  },
  render: (args) => (
    <Combobox {...args} filter={startsWithIgnoringAccents}>
      <Option value="creme-brulee">Crème brûlée</Option>
      <Option value="eclair">Éclair</Option>
      <Option value="mille-feuille">Mille-feuille</Option>
      <Option value="pain-au-chocolat">Pain au chocolat</Option>
      <Option value="tarte-tatin">Tarte Tatin</Option>
    </Combobox>
  ),
};

const COUNTRIES = [
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
];

/** The fake server's answer: the first eight countries whose name contains the query. */
function searchCountries(query: string) {
  const text = query.toLowerCase();
  return COUNTRIES.filter((name) => name.toLowerCase().includes(text)).slice(0, 8);
}

/**
 * A search on a server: the parent owns the query (`query`, `onQueryChange`), asks for results
 * 300 ms after the last keystroke, and renders them as the options, which `filter={() => true}`
 * keeps as they are. Until the answer arrives the previous results stay, so "No matches" is said
 * only when the answer is empty. The selected country stays a hidden option while an answer
 * leaves it out, so the input keeps showing its label.
 */
function AsyncSearchCombobox({ onQueryChange, onValueChange, ...args }: ComboboxProps) {
  const [value, setValue] = React.useState('');
  const [query, setQuery] = React.useState('');
  // The query the shown results answer: the search is pending while it differs from `query`.
  const [answered, setAnswered] = React.useState('');
  const [results, setResults] = React.useState(() => searchCountries(''));
  React.useEffect(() => {
    if (query === answered) return;
    const timer = setTimeout(() => {
      setResults(searchCountries(query));
      setAnswered(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, answered]);
  return (
    <div className="flex flex-col gap-1">
      <Combobox
        {...args}
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
      >
        {results.map((name) => (
          <Option key={name} value={name}>
            {name}
          </Option>
        ))}
        {value !== '' && !results.includes(value) && (
          <Option key={value} value={value} hidden>
            {value}
          </Option>
        )}
      </Combobox>
      <span className="text-caption-1 text-muted-foreground">
        {query === answered ? `${results.length} results` : 'Searching…'}
      </span>
    </div>
  );
}

export const AsyncSearch: Story = {
  args: {
    'aria-label': 'Country',
    placeholder: 'Search countries...',
    onQueryChange: fn(),
  },
  render: (args) => <AsyncSearchCombobox {...args} />,
};

/**
 * `expandIcon={false}` hides the expand button; typing, a click or Alt+ArrowDown still open the
 * list.
 */
export const WithoutExpandIcon: Story = {
  args: {
    expandIcon: false,
    placeholder: 'Type to search...',
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="apple">Apple</Option>
      <Option value="banana">Banana</Option>
      <Option value="cherry">Cherry</Option>
    </Combobox>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled',
    disabled: true,
  },
  render: (args) => (
    <Combobox {...args}>
      <Option value="a">Alpha</Option>
    </Combobox>
  ),
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select a fruit...',
  },
  render: (args) => (
    <Field label="Fruit" error="Choose a fruit from the list." required>
      <Combobox {...args}>
        <Option value="apple">Apple</Option>
        <Option value="banana">Banana</Option>
      </Combobox>
    </Field>
  ),
};
