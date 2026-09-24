import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { DatePicker, Field } from '../src';

/** Local midnight `days` days from today (story ranges follow the current date). */
function daysFromToday(days: number): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const meta = {
  title: 'Components/Input/DatePicker',
  component: DatePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    locale: { control: 'text' },
    firstDayOfWeek: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6] },
  },
  args: {
    'aria-label': 'Date',
    placeholder: 'Select a date',
    style: { width: 250 },
    onValueChange: fn(),
    onOpenChange: fn(),
    onInvalidInput: fn(),
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Selection limited to the next 30 days (computed from today, so the range never goes stale). */
export const WithMinMax: Story = {
  args: {
    'aria-label': 'Delivery date',
    minDate: daysFromToday(0),
    maxDate: daysFromToday(30),
    placeholder: 'Within 30 days',
  },
};

/** A custom display format needs its inverse `parseDate`, so typed dates are read the same way. */
export const CustomFormat: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    formatDate: toISO,
    parseDate: (text: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
      return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
    },
    placeholder: 'YYYY-MM-DD',
  },
};

/** Month and weekday names, day labels and the typed format follow `locale`. */
export const Localized: Story = {
  args: {
    'aria-label': 'Datum',
    locale: 'de-DE',
    firstDayOfWeek: 1,
    defaultValue: new Date(2025, 5, 15),
    placeholder: 'TT.MM.JJJJ',
  },
};

export const Clearable: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    clearable: true,
  },
};

export const DisabledDates: Story = {
  args: {
    'aria-label': 'Weekday',
    disabledDates: (d: Date) => d.getDay() === 0 || d.getDay() === 6,
    placeholder: 'Weekdays only',
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    disabled: true,
  },
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
  },
  render: (args) => (
    <Field label="Due date" error="Choose a date in the future." required>
      <DatePicker {...args} />
    </Field>
  ),
};

export const Controlled: Story = {
  render: function ControlledDatePicker(args) {
    const [value, setValue] = useState<Date | null>(new Date(2025, 5, 15));
    return (
      <div>
        {/* The controlled pair is wired after the args on purpose. */}
        <DatePicker
          {...args}
          value={value}
          onValueChange={(date) => {
            setValue(date);
            args.onValueChange?.(date);
          }}
        />
        <p className="mt-2 text-body-1">Selected: {value ? toISO(value) : '(none)'}</p>
      </div>
    );
  },
};
