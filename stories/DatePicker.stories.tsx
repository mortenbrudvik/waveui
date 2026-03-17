import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DatePicker } from '../src';

const meta = {
  title: 'Components/Input/DatePicker',
  component: DatePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select a date',
    style: { width: 250 },
  },
};

export const WithMinMax: Story = {
  args: {
    minDate: new Date(2025, 0, 1),
    maxDate: new Date(2025, 11, 31),
    placeholder: 'Year 2025 only',
    style: { width: 250 },
  },
};

export const CustomFormat: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    formatDate: (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    placeholder: 'YYYY-MM-DD',
    style: { width: 250 },
  },
};

export const Clearable: Story = {
  args: {
    defaultValue: new Date(2025, 5, 15),
    clearable: true,
    style: { width: 250 },
  },
};

export const DisabledDates: Story = {
  args: {
    disabledDates: (d: Date) => d.getDay() === 0 || d.getDay() === 6,
    placeholder: 'Weekdays only',
    style: { width: 250 },
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState<Date | null>(new Date(2025, 5, 15));
    return (
      <div>
        <DatePicker value={value} onChange={setValue} style={{ width: 250 }} />
        <p style={{ marginTop: 8 }}>
          Selected: {value ? value.toLocaleDateString() : '(none)'}
        </p>
      </div>
    );
  },
};
