import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TimePicker } from '../src';

const meta = {
  title: 'Components/Input/TimePicker',
  component: TimePicker,
  argTypes: {
    disabled: { control: 'boolean' },
    clearable: { control: 'boolean' },
    format: { control: 'select', options: ['12h', '24h'] },
    step: { control: 'number' },
  },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Select a time',
    style: { width: 250 },
  },
};

export const Format24h: Story = {
  args: {
    format: '24h',
    placeholder: 'Select a time',
    style: { width: 250 },
  },
};

export const CustomStep: Story = {
  args: {
    step: 15,
    placeholder: 'Every 15 minutes',
    style: { width: 250 },
  },
};

export const WithMinMax: Story = {
  args: {
    minTime: '09:00',
    maxTime: '17:00',
    step: 30,
    placeholder: 'Business hours',
    style: { width: 250 },
  },
};

export const Clearable: Story = {
  args: {
    defaultValue: '14:00',
    clearable: true,
    style: { width: 250 },
  },
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState('10:30');
    return (
      <div>
        <TimePicker value={value} onChange={setValue} style={{ width: 250 }} />
        <p style={{ marginTop: 8 }}>Selected: {value || '(none)'}</p>
      </div>
    );
  },
};
