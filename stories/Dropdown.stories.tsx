import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dropdown, Field } from '../src';

// The component JSDoc of src/components/input/Dropdown.tsx (the one on the exported `Dropdown`
// const). react-docgen does not read a JSDoc off an `Object.assign` compound, so the autodocs page
// takes the description from the meta JSDoc below; Dropdown.test.tsx keeps the two identical.
/**
 * A select-only combobox (APG): a button that opens a listbox of `Option`s. Enter, Space,
 * ArrowDown/ArrowUp, Home/End and typing a character open it and move the highlight
 * (`aria-activedescendant`); Enter/Space select, Tab selects the highlighted option and moves on,
 * Escape closes.
 *
 * The `<button>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`
 * and `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp`. `ref`, `className`, `style`, other `aria-*`
 * attributes and the remaining props stay on the root `<div>`. Inside a `Field` the button is
 * labelled and described by it — otherwise give it an `aria-label`. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission, validation and reset. The open
 * listbox renders in a portal; while closed it stays in the DOM, hidden.
 *
 * Sub-components: `Dropdown.Option`, `Dropdown.OptionGroup`. React Server Components import the
 * flat names `DropdownOption` / `DropdownOptionGroup` (dotted access needs a client file).
 */
const meta = {
  title: 'Components/Input/Dropdown',
  component: Dropdown,
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    'aria-label': 'Pet',
    onValueChange: fn(),
    onOpenChange: fn(),
    style: { width: 250 },
  },
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select an option',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
      <Dropdown.Option value="hamster">Hamster</Dropdown.Option>
    </Dropdown>
  ),
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'dog',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="cat">Cat</Dropdown.Option>
      <Dropdown.Option value="dog">Dog</Dropdown.Option>
      <Dropdown.Option value="fish">Fish</Dropdown.Option>
    </Dropdown>
  ),
};

export const Grouped: Story = {
  args: {
    'aria-label': 'Animal',
    placeholder: 'Select an animal',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.OptionGroup label="Mammals">
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown.OptionGroup>
      <Dropdown.OptionGroup label="Fish">
        <Dropdown.Option value="goldfish">Goldfish</Dropdown.Option>
        <Dropdown.Option value="shark" disabled>
          Shark (not available)
        </Dropdown.Option>
      </Dropdown.OptionGroup>
    </Dropdown>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Disabled',
  },
  render: (args) => (
    <Dropdown {...args}>
      <Dropdown.Option value="a">Alpha</Dropdown.Option>
    </Dropdown>
  ),
};

/** Invalid state through a Field error (the Field labels and describes the button). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
    placeholder: 'Select a pet',
  },
  render: (args) => (
    <Field label="Pet" error="Choose a pet." required>
      <Dropdown {...args}>
        <Dropdown.Option value="cat">Cat</Dropdown.Option>
        <Dropdown.Option value="dog">Dog</Dropdown.Option>
      </Dropdown>
    </Field>
  ),
};
