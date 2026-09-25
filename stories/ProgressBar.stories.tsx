import type { Meta, StoryObj } from '@storybook/react';
import { Field, ProgressBar } from '../src';
import type { ProgressBarColor } from '../src';

const colors: Array<[ProgressBarColor, string]> = [
  ['brand', 'Brand'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['error', 'Error'],
];

const meta = {
  title: 'Components/Feedback/ProgressBar',
  component: ProgressBar,
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    max: { control: 'number' },
    color: { control: 'select', options: colors.map(([color]) => color) },
  },
  args: {
    label: 'Uploading files',
    max: 100,
  },
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 60,
  },
};

export const Indeterminate: Story = {
  args: {
    label: 'Syncing',
  },
};

export const WithLabel: Story = {
  args: {
    value: 75,
    label: 'Uploading files...',
    showLabel: true,
  },
};

/**
 * `color` picks the fill. `warning` fills with the dark orange of the `severe` color, which keeps
 * 3:1 against the track in every theme (the yellow warning color would not).
 */
export const Colors: Story = {
  args: {
    value: 60,
    showLabel: true,
  },
  render: ({ color: _color, label: _label, ...args }) => (
    <div className="flex w-80 flex-col gap-4">
      {colors.map(([color, label]) => (
        <ProgressBar key={color} {...args} color={color} label={label} />
      ))}
    </div>
  ),
};

/**
 * Inside a `Field`, the Field's label names the bar, its message and hint describe it, and its
 * validation state colors the fill (here `validationState="warning"` and the error state that
 * `error` sets) unless `color` is set. The bar is never marked invalid or required.
 */
export const InField: Story = {
  args: {
    value: 40,
  },
  render: ({ label: _label, ...args }) => (
    <div className="flex w-80 flex-col gap-6">
      <Field label="Uploading photos" hint="3 of 12 files uploaded.">
        <ProgressBar {...args} />
      </Field>
      <Field
        label="Storage"
        hint="Your plan includes 10 GB."
        validationState="warning"
        validationMessage="Almost full: 9.2 GB used."
      >
        <ProgressBar {...args} value={92} />
      </Field>
      <Field
        label="Backing up"
        error="The connection was lost. The backup continues when you are online."
      >
        <ProgressBar {...args} value={70} />
      </Field>
    </div>
  ),
};
