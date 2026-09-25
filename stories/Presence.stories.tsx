import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { Button, Input, Presence } from '../src';
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
 * The card fades and slides in with a `starting:` style, and out with `data-[presence=exiting]:`
 * classes that use a faster, accelerating curve; it unmounts when its exit transition ends. Under
 * reduced motion (`motion-reduce:transition-none`) it appears and disappears at once, and so does
 * the core's phase.
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
            className={`${cardClasses} transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid starting:translate-y-1 starting:opacity-0 data-[presence=exiting]:translate-y-1 data-[presence=exiting]:opacity-0 data-[presence=exiting]:duration-wave-fast data-[presence=exiting]:ease-wave-accelerate-mid motion-reduce:transition-none`}
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
            className={`${cardClasses} transition-opacity duration-wave-normal ease-wave-easy-ease starting:opacity-0 data-[presence=exiting]:opacity-0 motion-reduce:transition-none`}
          >
            <Input aria-label="Note text" placeholder="Type a note, then hide and show it" />
          </section>
        }
      />
    );
  },
};
