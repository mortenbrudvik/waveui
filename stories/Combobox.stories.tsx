import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Combobox, Field, Option, OptionGroup } from '../src';

// The component JSDoc of src/components/input/Combobox.tsx (the one on the exported `Combobox`
// const). react-docgen does not read a JSDoc off an `Object.assign` compound, so the autodocs page
// takes the description from the meta JSDoc below; Combobox.test.tsx keeps the two identical.
/**
 * An editable combobox: a text input with a filterable listbox of `Option`s (APG combobox with
 * list autocomplete). Typing filters the options; ArrowDown/ArrowUp move the highlight
 * (`aria-activedescendant`), Enter selects, Escape closes. Without `freeform` the text is only a
 * filter: its first match becomes active while typing, and the input shows the selected option's
 * label again when the listbox closes. With `freeform` the text itself is the value. Text that
 * matches no option shows "No matches", announced through a status region.
 *
 * The `<input>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`,
 * `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text input attributes `autoComplete`,
 * `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck` and `enterKeyHint`.
 * `ref`, `className`, `style`, other `aria-*` attributes and the remaining props stay on the root
 * `<div>`. Inside a `Field` the input is labelled and described by it. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission, validation and reset. The open
 * listbox renders in a portal; while closed it stays in the DOM, hidden.
 *
 * Sub-components: `Combobox.Option`, `Combobox.OptionGroup`. React Server Components import the
 * flat names `ComboboxOption` / `ComboboxOptionGroup` (dotted access needs a client file).
 */
const meta = {
  title: 'Components/Input/Combobox',
  component: Combobox,
  argTypes: {
    disabled: { control: 'boolean' },
    freeform: { control: 'boolean' },
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
