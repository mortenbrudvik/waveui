import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Dropdown, Field, type DropdownProps } from '../src';

const meta = {
  title: 'Components/Input/Dropdown',
  component: Dropdown,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
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

/** `clearable` adds a clear button while a value is selected, a tab stop after the combobox. */
export const Clearable: Story = {
  args: {
    defaultValue: 'dog',
    clearable: true,
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

/** `multiselect` selects several options: a checkbox per option, the selected labels in the
 * button, and `clearable` clears all of them. */
export const Multiselect: StoryObj<DropdownProps<true>> = {
  args: {
    multiselect: true,
    clearable: true,
    'aria-label': 'Fruits',
  },
  // The spread alone leaves `multiselect` optional (StoryObj widens `args`), which satisfies
  // neither call signature (D9): the literal attribute after it forces the multi-select one.
  render: (args) => (
    <Dropdown {...args} multiselect>
      <Dropdown.Option value="apple">Apple</Dropdown.Option>
      <Dropdown.Option value="banana">Banana</Dropdown.Option>
      <Dropdown.Option value="cherry">Cherry</Dropdown.Option>
      <Dropdown.Option value="date">Date</Dropdown.Option>
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
