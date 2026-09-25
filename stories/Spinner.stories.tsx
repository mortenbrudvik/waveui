import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Spinner } from '../src';
import type { Size, SpinnerProps } from '../src';
import type { SpinnerAppearance } from '../src/components/feedback/Spinner';
import { sizeArgType } from './_helpers';

const appearances: SpinnerAppearance[] = ['primary', 'inverted'];

const meta = {
  title: 'Components/Feedback/Spinner',
  component: Spinner,
  argTypes: {
    ...sizeArgType,
    appearance: { control: 'inline-radio', options: appearances },
    delay: { control: { type: 'number', min: 0, step: 100 } },
  },
  args: {
    label: 'Loading',
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const sizes: Array<[Size, string]> = [
  ['extra-small', 'Extra Small'],
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
  ['extra-large', 'Extra Large'],
];

export const Sizes: Story = {
  render: ({ size: _size, label: _label, ...args }) => (
    <div className="flex items-center gap-4">
      {sizes.map(([size, label]) => (
        <Spinner key={size} size={size} label={label} {...args} />
      ))}
    </div>
  ),
};

export const WithLabel: Story = {
  args: {
    size: 'medium',
    label: 'Loading content...',
    labelVisible: true,
  },
};

/**
 * `appearance="inverted"` draws the spinner in the current text color: the on-brand text of a
 * primary Button (here in its `icon` slot, which is decorative, so the Button's text names the busy
 * state) and the foreground of an inverted surface.
 */
export const Inverted: Story = {
  args: {
    appearance: 'inverted',
    label: 'Saving',
  },
  render: ({ size: _size, labelVisible: _labelVisible, ...args }) => (
    <div className="flex flex-wrap items-center gap-4">
      <Button appearance="primary" icon={<Spinner {...args} size="extra-small" />}>
        Saving
      </Button>
      <div className="inline-flex items-center rounded bg-inverted px-3 py-2 text-inverted-foreground">
        <Spinner {...args} size="small" labelVisible />
      </div>
    </div>
  ),
};

/** Mounts the spinner while loading, as an app would for a request. */
function DelayedDemo(props: SpinnerProps) {
  const [loading, setLoading] = React.useState(false);
  return (
    <div className="flex items-center gap-4">
      <Button onClick={() => setLoading((prev) => !prev)}>
        {loading ? 'Stop loading' : 'Start loading'}
      </Button>
      {loading ? <Spinner {...props} /> : null}
    </div>
  );
}

/**
 * `delay` holds back the ring and the label, so a load that ends quickly never flashes a spinner.
 * Start loading: the status region mounts at once (empty), and the spinner appears after 800 ms.
 */
export const Delayed: Story = {
  args: {
    delay: 800,
    label: 'Loading results',
    labelVisible: true,
  },
  render: (args) => <DelayedDemo {...args} />,
};
