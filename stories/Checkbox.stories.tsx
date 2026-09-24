import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Checkbox } from '../src';

const meta = {
  title: 'Components/Input/Checkbox',
  component: Checkbox,
  args: {
    label: 'Accept terms and conditions',
    onCheckedChange: fn(),
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Indeterminate: Story = {
  args: {
    label: 'Select all',
    indeterminate: true,
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Subscribe to the newsletter',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled option',
    disabled: true,
  },
};

/**
 * No visible label (e.g. a row selector in a table): the checkbox is named with `aria-label`,
 * which is routed to the checkbox control.
 */
export const WithoutVisibleLabel: Story = {
  args: {
    label: undefined,
    'aria-label': 'Select row',
  },
};

/** With `name` and `required`, the checkbox takes part in native form submission and validation. */
export const InForm: Story = {
  args: {
    name: 'terms',
    value: 'accepted',
    required: true,
  },
  render: (args) => (
    <form className="flex flex-col items-start gap-3" onSubmit={(e) => e.preventDefault()}>
      <Checkbox {...args} />
      <Button type="submit" appearance="primary">
        Submit
      </Button>
    </form>
  ),
};
