import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { DatePicker, Field } from '../src';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';
import { motionCases } from './_motion';

/** Local midnight `days` days from today (story ranges follow the current date). */
function daysFromToday(days: number): Date {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
}

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Stories that render the calendar open show it in an iframe, so the docs page stays usable. */
const openStoryParameters = {
  docs: { story: { inline: false, iframeHeight: 480 } },
};

const meta = {
  title: 'Components/Input/DatePicker',
  component: DatePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    locale: { control: 'text' },
    firstDayOfWeek: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6] },
    ...coreSizeArgType,
    ...inputAppearanceArgType,
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

/**
 * A custom display format needs its inverse `parseDate`, so typed dates are read the same way. It
 * returns `null` for text that is not a date, impossible days (`2025-02-30`) included: `new Date`
 * would roll them over into the next month.
 */
export const CustomFormat: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    formatDate: toISO,
    parseDate: (text: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
      if (!match) return null;
      const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? date
        : null;
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
        <p className="mt-2 text-wave-body-1">Selected: {value ? toISO(value) : '(none)'}</p>
      </div>
    );
  },
};

/** The heading is a button to the month view, whose heading (the year) opens the year view. */
export const MonthAndYearPicker: Story = {
  args: {
    'aria-label': 'Birth date',
    showMonthPicker: true,
    defaultValue: new Date(2025, 5, 15),
    today: new Date(2025, 5, 18),
    defaultOpen: true,
  },
  parameters: openStoryParameters,
};

export const WeekNumbers: Story = {
  args: {
    showWeekNumbers: true,
    firstDayOfWeek: 1,
    defaultValue: new Date(2025, 5, 15),
    today: new Date(2025, 5, 18),
    defaultOpen: true,
  },
  parameters: openStoryParameters,
};

/** The footer button closes the calendar; with `showGoToToday` it sits next to "Go to today". */
export const CloseButton: Story = {
  args: {
    showCloseButton: true,
    showGoToToday: true,
    defaultValue: new Date(2025, 5, 15),
    today: new Date(2025, 5, 18),
    defaultOpen: true,
  },
  parameters: openStoryParameters,
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <DatePicker
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue={new Date(2026, 0, 5)}
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};

/** The Motion story's popup: it zooms in from 95% as it fades in, and back out as it fades. */
const fadeAndZoom =
  'transition-[opacity,scale] duration-wave-slow ease-wave-decelerate-max data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:scale-95 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:scale-95 data-[presence=exiting]:opacity-0';

/**
 * `DatePicker motion`. By default the calendar fades in and slides 4px away from the field, on the side it opened on, over 200ms, and fades out and slides back over 100ms (focus has moved back to the toggle by then). `null` turns it off; a class string replaces it (here a zoom).
 * The popup stays in place, `inert`, while it exits; focus is already back where it was. Under
 * reduced motion every popup appears and disappears at once.
 */
export const Motion: Story = {
  render: function MotionPopups(args) {
    return (
      <div className="flex flex-wrap gap-4">
        {motionCases(fadeAndZoom).map(({ label, motion }) => (
          <DatePicker
            key={label}
            {...args}
            aria-label={label}
            motion={motion}
            placeholder={label}
          />
        ))}
      </div>
    );
  },
};
