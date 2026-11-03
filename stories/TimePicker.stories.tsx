import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Field, TimePicker } from '../src';
import { coreSizeArgType, inputAppearanceArgType } from './_helpers';
import { SizeAppearanceGrid } from './_grids';

const formatHours = (value: string) => value.replace(':', 'h');
const parseHours = (text: string) => {
  const match = /^(\d{1,2})h(\d{2})$/.exec(text.trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

const meta = {
  title: 'Components/Input/TimePicker',
  component: TimePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    format: { control: 'select', options: ['12h', '24h'] },
    step: { control: { type: 'number', min: 1 } },
    expandIcon: { control: false },
    ...coreSizeArgType,
    ...inputAppearanceArgType,
  },
  args: {
    'aria-label': 'Time',
    placeholder: 'Select a time',
    style: { width: 250 },
    onValueChange: fn(),
  },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The expand button at the end of the input (a chevron) opens and closes the list without taking
 * focus from the input; it is not a tab stop. Without `format` the times follow the hour cycle of
 * the browser's language (12-hour in `en-US`, 24-hour in `en-GB`).
 */
export const Default: Story = {};

/** `format="12h"` shows 12-hour times whatever the browser's language. */
export const Format12h: Story = {
  args: {
    format: '12h',
  },
};

/** `format="24h"` shows 24-hour times whatever the browser's language. */
export const Format24h: Story = {
  args: {
    format: '24h',
  },
};

export const CustomStep: Story = {
  args: {
    step: 15,
    placeholder: 'Every 15 minutes',
  },
};

/** `minTime`/`maxTime` are inclusive; they accept `HH:mm`, `HH:mm:ss` or `h:mm AM`. */
export const WithMinMax: Story = {
  args: {
    'aria-label': 'Meeting time',
    minTime: '09:00',
    maxTime: '17:00',
    step: 30,
    placeholder: 'Business hours',
  },
};

/**
 * Text that is not a time, or a time outside `minTime`/`maxTime`, stays in the input: it is marked
 * invalid and an error message describes it (`onInvalidInput` reports it). Type `7:00 PM` or
 * `soon` and press Enter.
 */
export const ValidationFeedback: Story = {
  args: {
    'aria-label': 'Meeting time',
    minTime: '09:00',
    maxTime: '17:00',
    placeholder: 'Business hours',
    onInvalidInput: fn(),
  },
};

export const Clearable: Story = {
  args: {
    defaultValue: '14:00',
    clearable: true,
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: '14:00',
    disabled: true,
  },
};

/** Invalid state through a Field error (the Field labels and describes the input). */
export const Invalid: Story = {
  args: {
    'aria-label': undefined,
  },
  render: (args) => (
    <Field label="Start time" error="Choose a time within opening hours." required>
      <TimePicker {...args} />
    </Field>
  ),
};

export const Controlled: Story = {
  render: function ControlledTimePicker(args) {
    const [value, setValue] = useState('10:30');
    return (
      <div>
        {/* The controlled pair is wired after the args on purpose. */}
        <TimePicker
          {...args}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            args.onValueChange?.(next);
          }}
        />
        <p className="mt-2 text-wave-body-1">Selected: {value || '(none)'}</p>
      </div>
    );
  },
};

export const SizesAndAppearances: Story = {
  render: (args) => (
    <SizeAppearanceGrid
      render={(size, appearance) => (
        <TimePicker
          {...args}
          size={size}
          appearance={appearance}
          clearable
          defaultValue="09:30"
          aria-label={`${size} ${appearance}`}
        />
      )}
    />
  ),
};

/** `showSeconds` writes the value as `HH:mm:ss` and accepts typed seconds; the list stays on whole minutes. */
export const Seconds: Story = {
  args: { showSeconds: true, format: '24h', defaultValue: '09:30:15' },
};

/**
 * `formatTime` writes a time and `parseTime` reads typed text: here `9h30`. Keep both stable
 * (module-level functions or `useCallback`): an inline `formatTime` makes the options on every
 * render.
 */
export const CustomFormat: Story = {
  args: {
    formatTime: formatHours,
    parseTime: parseHours,
    minTime: '08:00',
    maxTime: '12:00',
    defaultValue: '09:30',
  },
};

/** `freeform={false}` limits the selection to the listed times: `9:15` is reported as `'not-listed'`. */
export const ListedTimesOnly: Story = {
  args: { freeform: false, format: '24h', onInvalidInput: fn() },
};
