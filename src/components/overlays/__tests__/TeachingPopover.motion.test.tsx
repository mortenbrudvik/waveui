import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeachingPopover, type TeachingPopoverProps } from '../TeachingPopover';
import { Dialog } from '../Dialog';
import { Button } from '../../button/Button';
import { teachingPopoverClassNames } from '../../../lib/classNames';
import { getOpenLayers } from '../../../lib/layers';
import { popupMotion } from '../../../lib/motion';
import type { MotionSlot } from '../../../lib/types';
import {
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  mockRect,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-TEACH (spec §6.5, D7, D9, D20, D22, survey risk 1): the TeachingPopover surface mounts
 * through the presence core with the positioned popups' default motion (`popupMotion`: a fade, and
 * a slide by the resolved `data-side` when it points at a target), takes a `motion` slot on the
 * root and on `TeachingPopover.Surface`, renders `data-state`, and exits visible where it was
 * (floating-ui resets its positioned flag on close, which hid the surface in 0.14's logic), on the
 * step it closed on, with the Escape layer and focus released in the closing commit. jsdom loads
 * no CSS, so the phases wait only where `mockAnimations` gives the surface a running animation.
 */

const html = document.documentElement;

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
  }
});

const steps = [
  { title: 'Welcome', body: 'This is step one.' },
  { title: 'Features', body: 'Here are the features.' },
  { title: 'Done', body: 'You are all set!' },
];

const button = (name: string) => screen.getByRole('button', { name });
const trigger = () => button('Take the tour');
/** The surface, exiting ones included (an exiting surface is `inert`, which role queries ignore). */
const surface = () => document.querySelector<HTMLElement>('.' + teachingPopoverClassNames.root);
/** The presence element of every TeachingPopover: its surface. */
const isSurface = (el: Element) => el.classList.contains(teachingPopoverClassNames.root);
/** The step heading of a surface (its name), read from the DOM so an exiting one counts too. */
const headingOf = (el: HTMLElement) => el.querySelector('h3');

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** Gives jsdom a viewport, so floating-ui places the popover. Undone in `afterEach`. */
function stubViewport() {
  Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
  Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
}

/** The box of the element an anchored popover points at (`mockRect`). */
const targetRect = { x: 200, y: 100, width: 100, height: 20 };

/** A tour opened from a Trigger it points at, between two page buttons. */
function TriggerTour(props: Partial<TeachingPopoverProps>) {
  return (
    <>
      <button type="button">Before</button>
      <TeachingPopover steps={steps} {...props}>
        <TeachingPopover.Trigger>
          <Button>Take the tour</Button>
        </TeachingPopover.Trigger>
      </TeachingPopover>
      <button type="button">After</button>
    </>
  );
}

/** A tour rendered in place (no target, no Trigger), opened by a page button. */
function InlineTour(props: Partial<TeachingPopoverProps>) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Start tour
      </button>
      <div data-testid="host">
        <TeachingPopover steps={steps} open={open} onOpenChange={setOpen} {...props} />
      </div>
    </>
  );
}

/** The surface's own props, given to TeachingPopover's own surface or to a Surface. */
interface SurfaceOwnProps {
  motion?: MotionSlot | null;
  className?: string;
}

describe.each<[string, (props: SurfaceOwnProps) => React.ReactElement]>([
  ['TeachingPopover (its own surface)', (props) => <TeachingPopover steps={steps} {...props} />],
  [
    'TeachingPopover.Surface',
    (props) => (
      <TeachingPopover steps={steps}>
        <TeachingPopover.Surface {...props} />
      </TeachingPopover>
    ),
  ],
])('%s motion slot (D5, D6)', (_, tour) => {
  const dialog = () => screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' });

  it('undefined: the default motion of a positioned popup', () => {
    render(tour({}));
    expect(dialog()).toHaveClass(...motionClasses(popupMotion));
  });

  it('null: no motion, and the surface still renders its phase', () => {
    render(tour({ motion: null }));
    expectNoWordOf(dialog(), popupMotion);
    expect(dialog()).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['a slot object', { className: 'my-motion' }],
  ] as const)('%s replaces the default motion', (_name, slot) => {
    render(tour({ motion: slot }));
    expect(dialog()).toHaveClass('my-motion');
    expectNoWordOf(dialog(), popupMotion);
  });

  it('WaveProvider motion="none" turns the default off; the part’s own value still applies', () => {
    const { unmount } = renderWithProviders(tour({}), { motion: 'none' });
    expectNoWordOf(dialog(), popupMotion);
    expect(dialog()).toHaveAttribute('data-presence', 'entered');
    unmount();
    renderWithProviders(tour({ motion: 'my-motion' }), { motion: 'none' });
    expect(dialog()).toHaveClass('my-motion');
  });

  it('keeps the motion prop off the DOM, and a className next to the motion classes', () => {
    render(tour({ motion: 'my-motion', className: 'p-8' }));
    expect(dialog()).not.toHaveAttribute('motion');
    expect(dialog()).toHaveClass('my-motion', 'p-8');
  });
});

describe('the root’s motion next to a TeachingPopover.Surface', () => {
  const SURFACE_PROPS_WARNING =
    '[WaveUI] TeachingPopover: the props of the surface element on TeachingPopover (`className`, `style`, `ref`, `onKeyDown`, `motion` and the other element props) are ignored next to a TeachingPopover.Surface: pass them to the Surface.';

  it.each([
    ['a class string', 'my-motion'],
    ['null', null],
  ] as const)('%s is ignored, with the TeachingPopover:surface-props warning', (_name, slot) => {
    render(
      <TeachingPopover steps={steps} motion={slot}>
        <TeachingPopover.Surface />
      </TeachingPopover>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(...motionClasses(popupMotion));
    expect(dialog).not.toHaveClass('my-motion');
    expect(warn.mock.calls).toEqual([[SURFACE_PROPS_WARNING]]);
    warn.mockClear();
  });

  it('a Surface’s own motion warns nothing', () => {
    render(
      <TeachingPopover steps={steps}>
        <TeachingPopover.Surface motion="my-motion" />
      </TeachingPopover>,
    );
    expect(screen.getByRole('dialog')).toHaveClass('my-motion');
  });
});

describe('TeachingPopover presence (D7, D9, D22)', () => {
  it('enters on open and exits after Escape: kept mounted, closed and inert, with the layer, the Trigger’s state and focus released at once', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<TriggerTour />);
    await user.click(trigger());
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover).toHaveAttribute('data-state', 'open');
    expect(popover.closest('[inert]')).toBeNull();
    await waitFor(() => expect(popover).toHaveFocus());
    expect(getOpenLayers()).toHaveLength(1);
    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
    expect(popover).toHaveAttribute('data-state', 'open');

    await user.keyboard('{Escape}');
    expect(surface()).toBe(popover);
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover).toHaveAttribute('data-state', 'closed');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(getOpenLayers()).toHaveLength(0);
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(surface()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('an anchored popover stays visible where it was through its exit (survey risk 1)', async () => {
    stubViewport();
    function AnchoredTour() {
      const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <button type="button" ref={setAnchor}>
            Search
          </button>
          <TeachingPopover steps={steps} target={anchor}>
            <TeachingPopover.Trigger>
              <Button>Take the tour</Button>
            </TeachingPopover.Trigger>
          </TeachingPopover>
        </>
      );
    }
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<AnchoredTour />);
    mockRect(button('Search'), targetRect);
    await user.click(trigger());
    const popover = surface()!;
    await waitFor(() => expect(popover.style.transform).toBe('translate(250px, 132px)'));
    expect(popover.style.visibility).toBe('');
    expect(popover).toHaveAttribute('data-side', 'bottom');
    expect(popover).toHaveClass(...motionClasses(popupMotion));
    await waitFor(() => expect(popover).toHaveFocus());
    await finish(motion);
    const style = popover.getAttribute('style');

    await user.click(button('Close'));
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.style.visibility).toBe('');
    expect(trigger()).toHaveFocus();
    // floating-ui settles once more as the popover closes (it resets its positioned flag).
    await act(async () => {});
    expect(popover.style.visibility).toBe('');
    expect(popover.getAttribute('style')).toBe(style);
    expect(popover).toHaveAttribute('data-side', 'bottom');

    await finish(motion);
    expect(surface()).toBeNull();
  });

  it.each<[string, string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]>([
    [
      'Done',
      'Done, step 3 of 3',
      async (user) => {
        await user.click(button('Next'));
        await user.click(button('Next'));
        await user.click(button('Done'));
      },
    ],
    [
      'Close',
      'Features, step 2 of 3',
      async (user) => {
        await user.click(button('Next'));
        await user.click(button('Close'));
      },
    ],
  ])(
    '%s: the surface exits on the step it closed on, with focus already on the Trigger',
    async (_name, heading, close) => {
      const motion = mockAnimations({ animated: isSurface });
      const user = userEvent.setup();
      render(<TriggerTour />);
      await user.click(trigger());
      const popover = surface()!;
      await waitFor(() => expect(popover).toHaveFocus());
      await finish(motion);

      await close(user);
      expect(popover).toHaveAttribute('data-presence', 'exiting');
      expect(popover).toHaveAttribute('data-state', 'closed');
      expect(popover.closest('[inert]')).toBe(popover);
      expect(trigger()).toHaveFocus();
      expect(headingOf(popover)).toHaveTextContent(heading);
      expect(getOpenLayers()).toHaveLength(0);
      expect(findDanglingIdRefs()).toEqual([]);

      await finish(motion);
      expect(surface()).toBeNull();
      expect(trigger()).toHaveFocus();
    },
  );

  it.each<[string, () => React.ReactElement, string, string, string]>([
    [
      'a controlled activeStep moved back as it closes',
      function ResetOnClose() {
        const [open, setOpen] = React.useState(true);
        const [step, setStep] = React.useState(1);
        return (
          <TeachingPopover
            steps={steps}
            open={open}
            activeStep={step}
            onStepChange={setStep}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setStep(0);
            }}
          />
        );
      },
      'Close',
      'Features, step 2 of 3',
      'Here are the features.',
    ],
    [
      'steps emptied as it finishes',
      function EmptiedOnFinish() {
        const [finished, setFinished] = React.useState(false);
        return (
          <TeachingPopover
            steps={finished ? [] : steps}
            defaultActiveStep={2}
            onFinish={() => setFinished(true)}
          />
        );
      },
      'Done',
      'Done, step 3 of 3',
      'You are all set!',
    ],
  ])(
    '%s: the exiting surface keeps the step it closed on',
    async (_name, Tour, closeWith, heading, body) => {
      const motion = mockAnimations({ animated: isSurface });
      const user = userEvent.setup();
      render(<Tour />);
      const popover = surface()!;
      await finish(motion);
      expect(headingOf(popover)).toHaveTextContent(heading);

      await user.click(button(closeWith));
      expect(popover).toHaveAttribute('data-presence', 'exiting');
      expect(headingOf(popover)).toHaveTextContent(heading);
      expect(popover).toHaveTextContent(body);
      expect(findDanglingIdRefs()).toEqual([]);
      await finish(motion);
      expect(surface()).toBeNull();
    },
  );

  it('opened again during its exit: the same surface enters again on the first step (0.14.1), not inert, with its layer', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const onStepChange = vi.fn();
    const user = userEvent.setup();
    render(<TriggerTour onStepChange={onStepChange} />);
    await user.click(trigger());
    const popover = surface()!;
    await waitFor(() => expect(popover).toHaveFocus());
    await finish(motion);
    await user.click(button('Next'));
    expect(headingOf(popover)).toHaveTextContent('Features, step 2 of 3');

    // The Trigger closes it, and opens it again before the exit ends.
    await user.click(trigger());
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(headingOf(popover)).toHaveTextContent('Features, step 2 of 3');
    await user.click(trigger());
    expect(surface()).toBe(popover);
    expect(document.querySelectorAll('.' + teachingPopoverClassNames.root)).toHaveLength(1);
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover).toHaveAttribute('data-state', 'open');
    expect(popover.closest('[inert]')).toBeNull();
    expect(headingOf(popover)).toHaveTextContent('Welcome, step 1 of 3');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(popover).toHaveFocus());
    expect(getOpenLayers()).toHaveLength(1);
    expect(onStepChange.mock.calls).toEqual([[1], [0]]);

    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{Escape}');
    expect(trigger()).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('rendered in place (no target): exits in place with only the fade, focus back on its opener', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<InlineTour />);
    await user.click(button('Start tour'));
    const popover = surface()!;
    const host = screen.getByTestId('host');
    expect(popover.parentElement).toBe(host);
    expect(popover).toHaveFocus();
    expect(popover).toHaveClass(...motionClasses(popupMotion));
    // No side: the slide of the default motion keys on it, so only the fade applies.
    expect(popover).not.toHaveAttribute('data-side');
    await finish(motion);

    await user.click(button('Close'));
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(popover.parentElement).toBe(host);
    expect(popover).not.toHaveAttribute('data-side');
    expect(popover).not.toHaveAttribute('style');
    expect(button('Start tour')).toHaveFocus();

    await finish(motion);
    expect(surface()).toBeNull();
    expect(button('Start tour')).toHaveFocus();
  });

  it('animates in a popover open by default on a client render (appear), and renders entered on the server', async () => {
    expect(renderToString(<TeachingPopover steps={steps} />)).toMatch(
      /role="dialog"[^>]*data-presence="entered"[^>]*data-state="open"/,
    );
    const motion = mockAnimations({ animated: isSurface });
    render(<TeachingPopover steps={steps} />);
    const popover = surface()!;
    expect(popover).toHaveAttribute('data-presence', 'entering');
    expect(popover.closest('[inert]')).toBeNull();
    expect(popover).toHaveFocus();
    await finish(motion);
    expect(popover).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion enters and exits at once', async () => {
    mockAnimations({ animated: isSurface });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<TriggerTour />);
    await user.click(trigger());
    expect(surface()).toHaveAttribute('data-presence', 'entered');
    await waitFor(() => expect(surface()).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(surface()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('without reduced motion the phases wait for the surface’s motion', async () => {
    const motion = mockAnimations({ animated: isSurface });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const user = userEvent.setup();
    render(<TriggerTour />);
    await user.click(trigger());
    const el = surface()!;
    expect(el).toHaveAttribute('data-presence', 'entering');
    await finish(motion);
    expect(el).toHaveAttribute('data-presence', 'entered');
    await waitFor(() => expect(el).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(surface()).toBe(el);
    expect(el).toHaveAttribute('data-presence', 'exiting');
    expect(trigger()).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
  });

  it('under StrictMode calls onOpenChange once per change', async () => {
    const motion = mockAnimations({ animated: isSurface });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <TriggerTour onOpenChange={onOpenChange} />
      </React.StrictMode>,
    );
    await user.click(trigger());
    await waitFor(() => expect(surface()).toHaveFocus());
    await finish(motion);
    await user.keyboard('{Escape}');
    expect(surface()).toHaveAttribute('data-presence', 'exiting');
    expect(trigger()).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });
});

describe('focus before close (D20)', () => {
  // `honourInert` (test-utils): after a commit React puts focus back on the element that had it
  // before, and jsdom would let that undo the closing commit's focus move out of the exiting
  // (`inert`) surface, leaving the choice to useRestoreFocus.
  it('without a Trigger, focus goes back to the element that opened it, not to a focusable target, in the closing commit', async () => {
    stubViewport();
    function Tour() {
      const [open, setOpen] = React.useState(false);
      const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Start tour
          </button>
          <button type="button" ref={setAnchor}>
            Search
          </button>
          <TeachingPopover steps={steps} open={open} onOpenChange={setOpen} target={anchor} />
        </>
      );
    }
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    honourInert();
    render(<Tour />);
    mockRect(button('Search'), targetRect);
    await user.click(button('Start tour'));
    const popover = surface()!;
    await waitFor(() => expect(popover).toHaveFocus());
    await finish(motion);

    await user.click(button('Close'));
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    expect(button('Start tour')).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
    expect(button('Start tour')).toHaveFocus();
  });

  it('an action that closes the tour and opens a Dialog in one update: closing the Dialog focuses the Trigger', async () => {
    /** Give feedback closes the tour and opens the Dialog (rendered after it) in one update. */
    function FeedbackTour() {
      const [open, setOpen] = React.useState(false);
      const [asking, setAsking] = React.useState(false);
      return (
        <>
          <TeachingPopover
            steps={[{ title: 'Feedback', body: 'Tell us what you think.' }]}
            open={open}
            onOpenChange={setOpen}
            primaryAction={
              <Button
                onClick={(event) => {
                  event.preventDefault();
                  setOpen(false);
                  setAsking(true);
                }}
              >
                Give feedback
              </Button>
            }
          >
            <TeachingPopover.Trigger>
              <Button>Take the tour</Button>
            </TeachingPopover.Trigger>
          </TeachingPopover>
          <Dialog open={asking} onOpenChange={setAsking}>
            <Dialog.Content title="Feedback form">
              <Dialog.Close>
                <button type="button">Cancel</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    render(<FeedbackTour />);
    await user.click(trigger());
    const popover = surface()!;
    await waitFor(() => expect(popover).toHaveFocus());
    await finish(motion);

    await user.click(button('Give feedback'));
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(popover.closest('[inert]')).toBe(popover);
    const dialog = screen.getByRole('dialog', { name: 'Feedback form' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await finish(motion);
    expect(surface()).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Feedback form' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('a tour opened on page load returns focus to its target while it exits', async () => {
    stubViewport();
    function PageLoadTour() {
      const targetRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={targetRef}>
            New feature
          </button>
          <TeachingPopover steps={steps} target={targetRef} />
        </>
      );
    }
    const motion = mockAnimations({ animated: isSurface });
    const user = userEvent.setup();
    honourInert();
    render(<PageLoadTour />);
    const popover = surface()!;
    await waitFor(() => expect(popover).toHaveFocus());
    await finish(motion);

    await user.keyboard('{Escape}');
    expect(popover).toHaveAttribute('data-presence', 'exiting');
    expect(button('New feature')).toHaveFocus();
    await finish(motion);
    expect(surface()).toBeNull();
  });
});
