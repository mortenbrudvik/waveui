import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { SpinButton } from '../src';
// Phase 4 type, in the barrel from wave C (INTEGRATION): imported from its module until then.
import type { SpinButtonBaseProps } from '../src/components/input/SpinButton';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';

const meta = {
  title: 'Components/Input/SpinButton',
  component: SpinButton,
  argTypes: {
    ...coreSizeArgType,
    ...inputAppearanceArgType,
  },
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
          onValueChange={(next: number | null) => {
            if (next === null) return;
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
        <p className="text-body-1 text-foreground">Value: {value}</p>
      </div>
    );
  },
};

/** Owns a price and shows it as currency; the story args (any mode) give it everything else. */
function CurrencySpinButton({
  onValueChange,
  ...props
}: SpinButtonBaseProps & { onValueChange?: (value: number) => void }) {
  const [value, setValue] = useState(1);
  return (
    <SpinButton
      aria-label="Price"
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      step={0.5}
      displayValue={`$${value.toFixed(2)}`}
    />
  );
}

/**
 * A controlled currency value: `displayValue` shows `$1.00` while the field is not being edited
 * (and is its `aria-valuetext`); focus it to edit the plain number.
 */
export const DisplayValue: Story = {
  args: { 'aria-label': 'Price' },
  render: (args) => <CurrencySpinButton {...args} />,
};

/** `allowEmpty`: the value starts empty (`null`), and clearing the text empties it again. */
export const AllowEmpty: Story = {
  render: () => <SpinButton aria-label="Guests (optional)" allowEmpty min={1} max={12} />,
};

/** `precision={2}` rounds typed and stepped values to two decimals, without padding them. */
export const Precision: Story = {
  args: { 'aria-label': 'Weight in kg', precision: 2, step: 0.25, defaultValue: 1.5 },
};

/** A root sized with `className` widens the input, not the space around it. */
export const FullWidth: Story = {
  args: { 'aria-label': 'Quantity', className: 'w-full' },
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <SpinButton
          {...args}
          size={size}
          appearance={appearance}
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};
