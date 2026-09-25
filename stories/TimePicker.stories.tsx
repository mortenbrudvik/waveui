import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Field, TimePicker } from '../src';

const meta = {
  title: 'Components/Input/TimePicker',
  component: TimePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    format: { control: 'select', options: ['12h', '24h'] },
    step: { control: { type: 'number', min: 1 } },
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

export const Default: Story = {};

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
        <p className="mt-2 text-body-1">Selected: {value || '(none)'}</p>
      </div>
    );
  },
};
