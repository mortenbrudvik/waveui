import type { Meta, StoryObj } from '@storybook/react';
import { Field, ProgressBar } from '../src';
import type { ProgressBarColor } from '../src';
import { motionCases } from './_motion';

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

/**
 * The Motion story's fill: a quarter of the track wide, with the default sweep and its
 * reduced-motion pulse.
 */
const quarterSweep =
  'w-1/4 animate-wave-indeterminate wave-rtl:animate-wave-indeterminate-rtl motion-reduce:w-full motion-reduce:translate-x-0 motion-reduce:animate-wave-pulse wave-rtl:motion-reduce:animate-wave-pulse';

/**
 * `indeterminateMotion` of a bar without `value`. By default a fill two fifths of the track wide
 * sweeps across it, mirrored right to left, and pulses at full width under reduced motion (a
 * static partial fill would read as real progress). `null` draws a static full-width fill; a
 * class string replaces the whole default, its width and reduced-motion classes included (here a
 * quarter-width sweep). A replacement that uses keyframes of its own needs them in your CSS.
 */
export const Motion: Story = {
  render: ({ label: _label, value: _value, ...args }) => (
    <div className="flex w-80 flex-col gap-4">
      {motionCases(quarterSweep).map(({ label, motion }) => (
        <ProgressBar key={label} {...args} label={label} indeterminateMotion={motion} />
      ))}
    </div>
  ),
};
