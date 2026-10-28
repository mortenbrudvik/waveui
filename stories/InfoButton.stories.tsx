import type { Meta, StoryObj } from '@storybook/react';
import { InfoButton } from '../src';
import { motionCases } from './_motion';

const meta = {
  title: 'Components/Data Display/InfoButton',
  component: InfoButton,
  args: {
    info: 'Charges appear on the first of the month.',
  },
} satisfies Meta<typeof InfoButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NextToAHeading: Story = {
  render: (args) => (
    <div className="flex items-center gap-1">
      <h2 id="billing-heading" className="text-subtitle-2">
        Billing
      </h2>
      <InfoButton
        {...args}
        id="billing-info"
        aria-labelledby="billing-heading billing-info"
        info="Charges appear on the first of the month."
      />
    </div>
  ),
};

/** The Motion story's note: it zooms in from 95% as it fades in, and back out as it fades. */
const fadeAndZoom =
  'transition-[opacity,scale] duration-wave-slow ease-wave-decelerate-max data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none data-[presence=entering]:starting:scale-95 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:scale-95 data-[presence=exiting]:opacity-0';

/**
 * `motion` of the note, the popover's motion: by default it fades in and slides 4px away from the
 * button over 200ms, and fades out and slides back over 100ms. `null` turns it off; a class string
 * replaces it (here a zoom). `InfoLabel` passes its `motion` to its button. Under reduced motion
 * every note appears and disappears at once.
 */
export const Motion: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {motionCases(fadeAndZoom).map(({ label, motion }, index) => (
        <div key={label} className="flex items-center gap-1">
          <span id={`motion-label-${index}`} className="text-body-1">
            {label}
          </span>
          {/* The story renders one button per case; every other arg is forwarded. */}
          <InfoButton
            {...args}
            id={`motion-info-${index}`}
            aria-labelledby={`motion-label-${index} motion-info-${index}`}
            motion={motion}
          />
        </div>
      ))}
    </div>
  ),
};
