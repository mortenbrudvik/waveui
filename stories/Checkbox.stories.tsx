import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button, Checkbox, Link } from '../src';

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

/**
 * `indeterminate` overrides `checked` for display and `aria-checked` ("mixed") until it is
 * cleared. A tri-state "select all" derives `checked` and `indeterminate` from its items and sets
 * every item in `onCheckedChange`.
 */
export const Indeterminate: Story = {
  args: {
    label: 'Select all',
  },
  render: function SelectAll(args) {
    const fruits = ['Apples', 'Bananas', 'Cherries'];
    const [picked, setPicked] = useState([true, false, false]);
    const all = picked.every(Boolean);
    return (
      <div className="flex flex-col gap-2">
        <Checkbox
          {...args}
          checked={all}
          indeterminate={!all && picked.some(Boolean)}
          onCheckedChange={(next) => {
            setPicked(picked.map(() => next));
            args.onCheckedChange?.(next);
          }}
        />
        <div className="flex flex-col gap-2 ps-6">
          {fruits.map((fruit, i) => (
            <Checkbox
              key={fruit}
              label={fruit}
              checked={picked[i]}
              onCheckedChange={(next) => setPicked(picked.map((v, j) => (j === i ? next : v)))}
            />
          ))}
        </div>
      </div>
    );
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

/**
 * `label` takes rich content, such as a link to the terms. Clicking the text toggles the
 * checkbox; clicking the link follows it. The whole text names the checkbox.
 */
export const RichLabel: Story = {
  args: {
    label: (
      <>
        I agree to the <Link href="#terms">terms and conditions</Link>
      </>
    ),
  },
};

/** `labelPosition="before"` renders the label before the box (the DOM order follows). */
export const LabelBefore: Story = {
  args: {
    label: 'Remember me',
    labelPosition: 'before',
  },
};

/**
 * `disabledFocusable` keeps the checkbox in the tab order while it cannot be changed, so keyboard
 * and screen-reader users reach it and hear why (here through `aria-describedby`). It is not
 * submitted with its form.
 */
export const DisabledFocusable: Story = {
  args: {
    label: 'Share with the whole organization',
    disabledFocusable: true,
    'aria-describedby': 'share-reason',
  },
  render: (args) => (
    <div className="flex flex-col items-start gap-1">
      <Checkbox {...args} />
      <p id="share-reason" className="text-caption-1 text-muted-foreground">
        Only administrators can share with the organization.
      </p>
    </div>
  ),
};
