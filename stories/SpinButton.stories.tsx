import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SpinButton } from '../src';

const meta = {
  title: 'Components/Input/SpinButton',
  component: SpinButton,
  args: {
    'aria-label': 'Quantity',
    defaultValue: 0,
    onValueChange: fn(),
  },
} satisfies Meta<typeof SpinButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Home/End jump to the bounds; the buttons disable at the bounds without stealing focus. */
export const MinMax: Story = {
  args: {
    'aria-label': 'Guests',
    defaultValue: 5,
    min: 0,
    max: 10,
  },
};

/** Decimal steps are rounded to the step precision (0.1 + 0.2 shows 0.3). */
export const DecimalStep: Story = {
  args: {
    'aria-label': 'Weight in kilograms',
    defaultValue: 1.5,
    min: 0,
    step: 0.1,
  },
};

export const Disabled: Story = {
  args: {
    'aria-label': 'Seats',
    defaultValue: 3,
    disabled: true,
  },
};

/** An invalid value: `aria-invalid` plus an error message linked with `aria-describedby`. */
export const Invalid: Story = {
  args: {
    'aria-label': 'Tickets',
    defaultValue: 12,
    'aria-invalid': true,
    'aria-describedby': 'spin-button-invalid-error',
  },
  render: (args) => (
    <div className="flex flex-col gap-1">
      <SpinButton {...args} />
      <span id="spin-button-invalid-error" className="text-caption-1 text-error">
        You can book at most 10 tickets.
      </span>
    </div>
  ),
};

/** Controlled: the parent owns `value` and updates it from `onValueChange`. */
export const Controlled: Story = {
  args: {
    'aria-label': 'Volume',
    min: 0,
    max: 100,
    step: 5,
  },
  render: function ControlledStory(args) {
    const [value, setValue] = useState(40);
    return (
      <div className="flex flex-col gap-2">
        <SpinButton
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
        <p className="text-body-1 text-foreground">Value: {value}</p>
      </div>
    );
  },
};
