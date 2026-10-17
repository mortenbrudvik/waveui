import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Field } from '../src';
import { Calendar } from '../src/components/input/Calendar';
import { isSameDay } from '../src/lib/date';

/** A fixed "today", so the stories and their checks do not change with the date. */
const TODAY = new Date(2025, 5, 18);

const meta = {
  title: 'Components/Input/Calendar',
  component: Calendar,
  argTypes: {
    showMonthPicker: { control: 'boolean' },
    showWeekNumbers: { control: 'boolean' },
    showGoToToday: { control: 'boolean' },
    selectionRange: { control: 'select', options: ['day', 'week', 'work-week', 'month'] },
    firstDayOfWeek: { control: 'select', options: [0, 1, 2, 3, 4, 5, 6] },
    firstWeekOfYear: {
      control: 'select',
      options: ['first-day', 'first-full-week', 'first-four-day-week'],
    },
    locale: { control: 'text' },
  },
  args: {
    'aria-label': 'Calendar',
    today: TODAY,
    onValueChange: fn(),
  },
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Month and weekday names and day labels follow `locale`. */
export const Localized: Story = {
  args: {
    'aria-label': 'Kalender',
    locale: 'de-DE',
    firstDayOfWeek: 1,
    defaultValue: new Date(2025, 5, 12),
    labels: {
      previousMonth: 'Voriger Monat',
      nextMonth: 'Nächster Monat',
      previousYear: 'Voriges Jahr',
      nextYear: 'Nächstes Jahr',
      goToToday: 'Heute',
    },
    showGoToToday: true,
  },
};

/** ISO 8601 weeks: Monday first, week 1 holds the first Thursday. */
export const WeekNumbersISO: Story = {
  name: 'Week numbers (ISO)',
  args: {
    showWeekNumbers: true,
    firstDayOfWeek: 1,
    firstWeekOfYear: 'first-four-day-week',
  },
};

export const MarkedDays: Story = {
  args: {
    markedDates: (date: Date) => date.getDate() % 7 === 0,
  },
};

/** The day's name follows `dayLabel`, not the custom content. */
export const CustomDayContent: Story = {
  args: {
    renderDay: (date: Date, defaultContent) =>
      date.getDate() === 25 ? <span>★ {defaultContent}</span> : defaultContent,
    dayLabel: (date: Date, defaultLabel: string) =>
      date.getDate() === 25 ? `${defaultLabel}, holiday` : defaultLabel,
  },
};

export const WeekSelection: Story = {
  args: {
    selectionRange: 'week',
    firstDayOfWeek: 1,
    defaultValue: new Date(2025, 5, 11),
  },
};

export const WorkWeekSelection: Story = {
  args: {
    selectionRange: 'work-week',
    defaultValue: new Date(2025, 5, 11),
  },
};

/** Shows a month far from today, so the footer button has something to do. */
export const GoToToday: Story = {
  args: {
    showGoToToday: true,
    initialVisibleDate: new Date(2025, 0, 10),
  },
};

export const MonthPickerOff: Story = {
  args: {
    showMonthPicker: false,
  },
};

export const MinMax: Story = {
  args: {
    minDate: new Date(2025, 5, 10),
    maxDate: new Date(2025, 6, 20),
    defaultValue: new Date(2025, 5, 18),
  },
};

export const Controlled: Story = {
  render: function ControlledCalendar(args) {
    const [value, setValue] = useState<Date | null>(new Date(2025, 5, 15));
    return (
      <div>
        {/* The controlled pair is wired after the args on purpose. */}
        <Calendar
          {...args}
          value={value}
          onValueChange={(date, details) => {
            setValue(date);
            args.onValueChange?.(date, details);
          }}
        />
        <p className="mt-2 text-body-1">
          Selected: {value ? value.toDateString() : '(none)'}
          {value && isSameDay(value, TODAY) ? ' (today)' : ''}
        </p>
      </div>
    );
  },
};

export const InAField: Story = {
  name: 'In a Field',
  args: { 'aria-label': undefined },
  render: (args) => (
    <Field label="Arrival date" hint="Pick the day you arrive." required>
      <Calendar {...args} />
    </Field>
  ),
};
