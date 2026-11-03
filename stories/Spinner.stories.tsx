import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button, Spinner, SpinnerContextProvider } from '../src';
import type { LabelPosition, Size, SpinnerAppearance, SpinnerProps, SpinnerSize } from '../src';
import { sizeArgType } from './_helpers';

const appearances: SpinnerAppearance[] = ['primary', 'inverted'];
const labelPositions: LabelPosition[] = ['before', 'after', 'above', 'below'];

const meta = {
  title: 'Components/Feedback/Spinner',
  component: Spinner,
  argTypes: {
    ...sizeArgType,
    size: {
      control: 'select',
      options: [
        'extra-tiny',
        'tiny',
        'extra-small',
        'small',
        'medium',
        'large',
        'huge',
        'extra-large',
      ],
    },
    appearance: { control: 'inline-radio', options: appearances },
    labelPosition: { control: 'inline-radio', options: labelPositions },
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
      <div className="inline-flex items-center rounded bg-wave-inverted px-3 py-2 text-wave-inverted-foreground">
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

/** `labelPosition` places the visible label before, after, above or below the ring. */
export const LabelPositions: Story = {
  args: { labelVisible: true, label: 'Loading' },
  render: ({ labelPosition: _position, ...args }) => (
    <div className="flex flex-wrap items-center gap-8">
      {labelPositions.map((position) => (
        <Spinner key={position} labelPosition={position} {...args} label={position} />
      ))}
    </div>
  ),
};

const spinnerSizes: SpinnerSize[] = [
  'extra-tiny',
  'tiny',
  'extra-small',
  'small',
  'medium',
  'large',
  'huge',
  'extra-large',
];

/**
 * Every size: the five of 0.x keep their pixel sizes (12, 16, 24, 36 and 48), and `extra-tiny`
 * (16), `tiny` (20) and `huge` (44) are Fluent's names and sizes.
 */
export const SizeScale: Story = {
  render: ({ size: _size, label: _label, ...args }) => (
    <div className="flex items-center gap-4">
      {spinnerSizes.map((size) => (
        <Spinner key={size} size={size} label={size} {...args} />
      ))}
    </div>
  ),
};

/**
 * A `SpinnerContextProvider` sizes the spinners below it; a spinner's own `size` wins. The label
 * is any content, not only text.
 */
export const SizeFromContext: Story = {
  render: () => (
    <SpinnerContextProvider size="huge">
      <div className="flex items-center gap-4">
        <Spinner label="Provider size" />
        <Spinner size="tiny" label="Own size" />
        <Spinner
          labelVisible
          label={
            <>
              Loading <strong>results</strong>
            </>
          }
        />
      </div>
    </SpinnerContextProvider>
  ),
};
