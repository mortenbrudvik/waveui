import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Accordion, Button, Dialog, Input, Popover, Presence, WaveProvider } from '../src';
import type { PresenceProps } from '../src';

const meta = {
  title: 'Components/Motion/Presence',
  component: Presence,
  args: {
    visible: true,
    appear: false,
    unmountOnExit: true,
    onEntered: fn(),
    onExited: fn(),
    // Each story renders its own child.
    children: <span />,
  },
  argTypes: {
    children: { control: false },
  },
} satisfies Meta<typeof Presence>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The stories' card: a block element, so the `hidden` attribute of an exited card applies. */
const cardClasses =
  'mt-3 w-72 rounded-md border border-border bg-card p-4 text-body-1 text-card-foreground shadow-4';

/**
 * A toggle button and the Presence it controls; `visible` is the initial state, the other args
 * are passed on.
 */
function TogglePresence({
  args: { visible: initiallyVisible, children: _children, ...args },
  label,
  child,
}: {
  args: PresenceProps;
  label: string;
  child: React.ReactElement;
}) {
  const [visible, setVisible] = React.useState(initiallyVisible);
  return (
    <div>
      <Button aria-expanded={visible} onClick={() => setVisible((shown) => !shown)}>
        {visible ? `Hide ${label}` : `Show ${label}`}
      </Button>
      <Presence {...args} visible={visible}>
        {child}
      </Presence>
    </div>
  );
}

/**
 * The card fades and slides in with a `starting:` style gated on the entering phase
 * (`data-[presence=entering]:starting:`), and out with `data-[presence=exiting]:` classes that use
 * a faster, accelerating curve; it unmounts when its exit transition ends. A card that mounts
 * shown does not animate unless `appear` is set (an ungated `starting:` class would animate it
 * while the phase is already `entered`). Under reduced motion (`motion-reduce:transition-none`) it
 * appears and disappears at once, and so does the core's phase.
 */
export const FadeAndSlide: Story = {
  render: function FadeAndSlidePresence(args) {
    return (
      <TogglePresence
        args={args}
        label="details"
        child={
          <section
            aria-label="Details"
            className={`${cardClasses} transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=entering]:starting:translate-y-1 data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:translate-y-1 data-[presence=exiting]:opacity-0 data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none`}
          >
            The report was saved to your documents.
          </section>
        }
      />
    );
  },
};

/**
 * `unmountOnExit={false}` keeps the exited card mounted, `hidden` and `inert`, so what you type in
 * its field is still there when it is shown again.
 */
export const KeepMounted: Story = {
  args: { unmountOnExit: false },
  render: function KeepMountedPresence(args) {
    return (
      <TogglePresence
        args={args}
        label="note"
        child={
          <section
            aria-label="Note"
            className={`${cardClasses} transition-opacity duration-wave-normal ease-wave-easy-ease data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 motion-reduce:transition-none`}
          >
            <Input aria-label="Note text" placeholder="Type a note, then hide and show it" />
          </section>
        }
      />
    );
  },
};

/** The ProviderMotionNone story's own popover motion: a fade over 300ms. */
const ownFade =
  'transition-opacity duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0';

/**
 * `WaveProvider motion="none"` turns off the default motion of every Wave part below it: the
 * dialog appears and disappears at once, and so does the accordion panel. A part's own `motion`
 * still applies (the second popover fades), and so do classes of yours on a `Presence` child,
 * which is no motion slot (the card). A nested provider inherits `motion` like `theme`;
 * `motion="default"` turns the default back on below it.
 */
export const ProviderMotionNone: Story = {
  render: function ProviderMotionNonePresence(args) {
    return (
      <WaveProvider motion="none" className="flex flex-col items-start gap-4">
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <Dialog.Trigger>
              <Button>Open a dialog</Button>
            </Dialog.Trigger>
            <Dialog.Content title="No default motion">
              <p>The dialog neither scales nor fades.</p>
            </Dialog.Content>
          </Dialog>
          <Popover>
            <Popover.Trigger>
              <Button>Popover without motion</Button>
            </Popover.Trigger>
            <Popover.Content title="No default motion">It appears at once.</Popover.Content>
          </Popover>
          <Popover>
            <Popover.Trigger>
              <Button>Popover with its own motion</Button>
            </Popover.Trigger>
            <Popover.Content title="Its own motion" motion={ownFade}>
              Its own motion still fades it.
            </Popover.Content>
          </Popover>
        </div>
        <Accordion className="w-80">
          <Accordion.Item value="shipping">
            <Accordion.Trigger>Shipping</Accordion.Trigger>
            <Accordion.Panel>Orders ship within two working days.</Accordion.Panel>
          </Accordion.Item>
        </Accordion>
        <TogglePresence
          args={args}
          label="card"
          child={
            <section
              aria-label="Card"
              className={`${cardClasses} transition-opacity duration-wave-normal ease-wave-easy-ease data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 motion-reduce:transition-none`}
            >
              Your own classes on a Presence child still fade it.
            </section>
          }
        />
      </WaveProvider>
    );
  },
};
