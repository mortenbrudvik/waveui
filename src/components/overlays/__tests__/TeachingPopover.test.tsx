import * as React from 'react';
import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TeachingPopover,
  type TeachingPopoverLabels,
  type TeachingPopoverProps,
} from '../TeachingPopover';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import { getOpenLayers, subscribeLayers } from '../../../lib/layers';
import { FOCUSABLE_SELECTOR } from '../../../lib/focus';
import {
  renderWithProviders,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const steps = [
  { title: 'Welcome', body: 'This is step one.' },
  { title: 'Features', body: 'Here are the features.' },
  { title: 'Done', body: 'You are all set!' },
];

afterEach(() => {
  vi.restoreAllMocks();
});

const heading = () => screen.getByRole('heading', { level: 3 });
const dots = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-wave-teaching-popover-dot]'));

describe('TeachingPopover', () => {
  testSystemProps(TeachingPopover, {
    expectedTag: 'div',
    displayName: 'TeachingPopover',
    defaultProps: { steps },
    conflictingClass: { className: 'w-96', overrides: 'w-80' },
    a11yVariants: [
      { name: 'middle step', props: { activeStep: 1 } },
      { name: 'last step', props: { activeStep: 2 } },
      { name: 'single step', props: { steps: [{ title: 'Tip', body: 'Press Ctrl+K.' }] } },
    ],
  });

  testNoImplicitSubmit(TeachingPopover, { defaultProps: { steps, activeStep: 1 } });

  it('renders nothing when open is false', () => {
    render(<TeachingPopover steps={steps} open={false} data-testid="tp" />);
    expect(screen.queryByTestId('tp')).not.toBeInTheDocument();
  });

  it('renders nothing when steps is empty', () => {
    render(<TeachingPopover steps={[]} data-testid="tp" />);
    expect(screen.queryByTestId('tp')).not.toBeInTheDocument();
  });

  it('has role="dialog" named by the step title with the step position', () => {
    render(<TeachingPopover steps={steps} />);
    expect(screen.getByRole('dialog', { name: /^Welcome/ })).toBeInTheDocument();
    expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
  });

  it('displays the first step by default', () => {
    render(<TeachingPopover steps={steps} />);
    expect(heading()).toHaveTextContent(/^Welcome/);
    expect(screen.getByText('This is step one.')).toBeInTheDocument();
  });

  it('accepts readonly steps (R6)', () => {
    const readonlySteps = [
      { title: 'Tip', body: 'Press Ctrl+K.' },
      { title: 'Search', body: 'Type to filter.' },
    ] as const;
    expectTypeOf(readonlySteps).toExtend<TeachingPopoverProps['steps']>();
    render(<TeachingPopover steps={readonlySteps} />);
    expect(heading()).toHaveTextContent('Tip, step 1 of 2');
  });

  it('displays the step given by activeStep', () => {
    render(<TeachingPopover steps={steps} activeStep={1} />);
    expect(heading()).toHaveTextContent('Features, step 2 of 3');
  });

  describe('navigation (overlays#26)', () => {
    it('Next and Back change the rendered step (uncontrolled)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(<TeachingPopover steps={steps} onStepChange={onStepChange} />);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      expect(heading()).toHaveTextContent(/^Features/);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent(/^Done/);
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      expect(heading()).toHaveTextContent(/^Features/);
    });

    it('a controlled activeStep only changes through the parent', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const { rerender } = render(
        <TeachingPopover steps={steps} activeStep={0} onStepChange={onStepChange} />,
      );
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(onStepChange).toHaveBeenCalledWith(1);
      expect(heading()).toHaveTextContent(/^Welcome/);
      rerender(<TeachingPopover steps={steps} activeStep={1} onStepChange={onStepChange} />);
      expect(heading()).toHaveTextContent(/^Features/);
    });

    it('fires onStepChange exactly once per Next under StrictMode', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <React.StrictMode>
          <TeachingPopover steps={steps} onStepChange={onStepChange} />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(onStepChange).toHaveBeenCalledTimes(1);
    });

    it.each([
      [5, 'Done', 3],
      [-2, 'Welcome', 1],
    ])(
      'clamps an out-of-range activeStep %i (content, first/last state and dots) and warns',
      async (activeStep, title, position) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<TeachingPopover steps={steps} activeStep={activeStep} />);
        expect(heading()).toHaveTextContent(`${title}, step ${position} of 3`);
        const current = dots().filter((dot) => dot.getAttribute('aria-current') === 'step');
        expect(current).toEqual([dots()[position - 1]]);
        if (position === 3) {
          expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
        } else {
          expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute(
            'aria-disabled',
            'true',
          );
        }
        expect(warn.mock.calls).toEqual([
          [
            `[WaveUI] TeachingPopover: activeStep ${activeStep} is out of range for 3 steps; showing step ${position}.`,
          ],
        ]);
      },
    );

    it('Done on the last step dismisses', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<TeachingPopover steps={steps} activeStep={2} onDismiss={onDismiss} />);
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Back button (overlays#27, overlays#31, C-DISABLED)', () => {
    it('stays rendered and aria-disabled on the first step', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(<TeachingPopover steps={steps} onStepChange={onStepChange} />);
      const back = screen.getByRole('button', { name: 'Back' });
      expect(back).toHaveAttribute('aria-disabled', 'true');
      expect(back).not.toBeDisabled();
      await user.click(back);
      expect(onStepChange).not.toHaveBeenCalled();
      expect(heading()).toHaveTextContent(/^Welcome/);
    });

    it('keeps focus on Back when it becomes unavailable on the first step', async () => {
      const user = userEvent.setup();
      render(<TeachingPopover steps={steps} defaultActiveStep={1} />);
      const back = screen.getByRole('button', { name: 'Back' });
      await user.click(back);
      expect(heading()).toHaveTextContent(/^Welcome/);
      expect(back).toHaveFocus();
      expect(back).toHaveAttribute('aria-disabled', 'true');
    });

    it('uses gated hover styles that do not react while aria-disabled', () => {
      render(<TeachingPopover steps={steps} />);
      const back = screen.getByRole('button', { name: 'Back' });
      const hoverClasses = Array.from(back.classList).filter((cls) => cls.includes('hover:'));
      expect(hoverClasses.length).toBeGreaterThan(0);
      for (const cls of hoverClasses) {
        expect(cls.startsWith('not-disabled:not-aria-disabled:hover:')).toBe(true);
      }
    });

    it('is not rendered for a single-step popover', () => {
      render(<TeachingPopover steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]} />);
      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  describe('dismissal (overlays#25, overlays#29)', () => {
    it('Close hides an uncontrolled popover and calls onDismiss and onOpenChange once', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onOpenChange = vi.fn();
      render(<TeachingPopover steps={steps} onDismiss={onDismiss} onOpenChange={onOpenChange} />);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('names the Close button with closeLabel (R7), "Close" by default, and keeps it off the surface', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const { rerender } = render(<TeachingPopover steps={steps} onDismiss={onDismiss} />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      rerender(<TeachingPopover steps={steps} onDismiss={onDismiss} closeLabel="Lukk" />);
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).not.toHaveAttribute('closeLabel');
      expect(screen.getByRole('dialog')).not.toHaveAttribute('closelabel');
      await user.click(screen.getByRole('button', { name: 'Lukk' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape dismisses without focusing the dialog manually', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<TeachingPopover steps={steps} onDismiss={onDismiss} />);
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('Escape works while focus is outside the popover', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <>
          <button type="button">Page button</button>
          <TeachingPopover steps={steps} onDismiss={onDismiss} />
        </>,
      );
      screen.getByRole('button', { name: 'Page button' }).focus();
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('defaultOpen={false} starts hidden', () => {
      render(<TeachingPopover steps={steps} defaultOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('controlled open: Escape, Close and Done each call onOpenChange(false) once while it stays open (overlays#32)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onDismiss = vi.fn();
      render(
        <TeachingPopover
          steps={steps}
          open
          activeStep={2}
          onOpenChange={onOpenChange}
          onDismiss={onDismiss}
        />,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onOpenChange).toHaveBeenCalledTimes(3);
      expect(onOpenChange.mock.calls).toEqual([[false], [false], [false]]);
      expect(onDismiss).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('focus (overlays#27, overlays#29)', () => {
    function Tour({ onDismiss }: { onDismiss?: () => void }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Start tour
          </button>
          <TeachingPopover steps={steps} open={open} onOpenChange={setOpen} onDismiss={onDismiss} />
        </>
      );
    }

    it('moves focus to the dialog on mount', () => {
      render(<TeachingPopover steps={steps} />);
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('moves focus to the dialog when open changes from false to true', async () => {
      const user = userEvent.setup();
      render(<Tour />);
      await user.click(screen.getByRole('button', { name: 'Start tour' }));
      expect(screen.getByRole('dialog')).toHaveFocus();
    });

    it('returns focus to the opener when closed with Close', async () => {
      const user = userEvent.setup();
      render(<Tour />);
      await user.click(screen.getByRole('button', { name: 'Start tour' }));
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start tour' })).toHaveFocus();
    });

    it('returns focus to the opener when dismissed with Escape', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<Tour onDismiss={onDismiss} />);
      await user.click(screen.getByRole('button', { name: 'Start tour' }));
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Start tour' })).toHaveFocus();
    });
  });

  describe('step announcements (overlays#28)', () => {
    it('puts a visually hidden “step n of m” in the heading', () => {
      render(<TeachingPopover steps={steps} activeStep={1} />);
      const position = within(heading()).getByText(', step 2 of 3');
      expect(position).toHaveClass('sr-only');
    });

    it('announces the new step politely after Next', async () => {
      const user = userEvent.setup();
      render(<TeachingPopover steps={steps} />);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));
    });

    it('keeps the dots visible in forced-colors mode, the current one in Highlight (x-styling-4)', () => {
      render(<TeachingPopover steps={steps} activeStep={1} />);
      const [first, second, third] = dots();
      expect(second).toHaveClass(
        'forced-colors:bg-[Highlight]',
        'forced-colors:forced-color-adjust-none',
      );
      for (const dot of [first, third]) {
        expect(dot).toHaveClass(
          'forced-colors:bg-[CanvasText]',
          'forced-colors:forced-color-adjust-none',
        );
        expect(dot).not.toHaveClass('forced-colors:bg-[Highlight]');
      }
    });

    it('marks the current dot with aria-current and a larger shape, decorative for AT', () => {
      render(<TeachingPopover steps={steps} activeStep={1} />);
      expect(dots()).toHaveLength(3);
      const [first, second] = dots();
      expect(second).toHaveAttribute('aria-current', 'step');
      expect(first).not.toHaveAttribute('aria-current');
      expect(second).toHaveClass('w-4', 'bg-primary');
      expect(first).toHaveClass('w-1.5', 'bg-stroke-accessible');
      expect(first!.parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('built-in text', () => {
    const labels: TeachingPopoverLabels = {
      back: 'Tilbake',
      next: 'Neste',
      done: 'Ferdig',
      step: (index, count) => `steg ${index + 1} av ${count}`,
    };

    it('labels names the navigation buttons and words the step position', async () => {
      const user = userEvent.setup();
      render(<TeachingPopover steps={steps} labels={labels} closeLabel="Lukk" />);
      expect(heading()).toHaveTextContent('Welcome, steg 1 av 3');
      expect(within(heading()).getByText(', steg 1 av 3')).toHaveClass('sr-only');
      expect(screen.getByRole('button', { name: 'Tilbake' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await user.click(screen.getByRole('button', { name: 'Neste' }));
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, steg 2 av 3'));
      await user.click(screen.getByRole('button', { name: 'Neste' }));
      expect(screen.getByRole('button', { name: 'Ferdig' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^(Back|Next|Done|Close)$/ })).toBeNull();
    });

    it('keeps the English text for the members labels leaves out', () => {
      render(<TeachingPopover steps={steps} activeStep={2} labels={{ back: 'Tilbake' }} />);
      expect(heading()).toHaveTextContent('Done, step 3 of 3');
      expect(screen.getByRole('button', { name: 'Tilbake' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  describe('deprecated aliases (feedback-navigation#46)', () => {
    it('currentStep still selects the step and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} currentStep={1} />);
      expect(heading()).toHaveTextContent(/^Features/);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TeachingPopover: `currentStep` is deprecated and will be removed in 1.0. Use `activeStep` instead.',
        ],
      ]);
    });

    it('defaultCurrentStep still sets the initial step and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} defaultCurrentStep={2} />);
      expect(heading()).toHaveTextContent(/^Done/);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TeachingPopover: `defaultCurrentStep` is deprecated and will be removed in 1.0. Use `defaultActiveStep` instead.',
        ],
      ]);
    });

    it('activeStep wins over currentStep', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} activeStep={2} currentStep={0} />);
      expect(heading()).toHaveTextContent(/^Done/);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TeachingPopover: `currentStep` is deprecated and will be removed in 1.0. Use `activeStep` instead.',
        ],
      ]);
    });
  });

  describe('stable listeners (table-core#23)', () => {
    it('does not re-register document listeners when the parent re-renders', async () => {
      const { rerender } = render(<TeachingPopover steps={steps} onDismiss={() => {}} />);
      await act(async () => {});
      const add = vi.spyOn(document, 'addEventListener');
      const remove = vi.spyOn(document, 'removeEventListener');
      for (let i = 0; i < 3; i++) {
        rerender(<TeachingPopover steps={steps} onDismiss={() => {}} className={`c${i}`} />);
      }
      await act(async () => {});
      expect(add).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('refs (overlays#35)', () => {
    it('attaches a stable callback ref once, not on every render', () => {
      const ref = vi.fn();
      const { rerender } = render(<TeachingPopover ref={ref} steps={steps} />);
      rerender(<TeachingPopover ref={ref} steps={steps} className="a" />);
      rerender(<TeachingPopover ref={ref} steps={steps} className="b" />);
      expect(ref).toHaveBeenCalledTimes(1);
      expect(ref).toHaveBeenCalledWith(screen.getByRole('dialog'));
    });
  });

  describe('styles (button-provider#3, repo-level#7, feedback-navigation#34)', () => {
    it('uses theme tokens and rounded-md', () => {
      render(<TeachingPopover steps={steps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('rounded-md', 'bg-background', 'text-foreground');
      expect(dialog).not.toHaveClass('rounded-lg');
      expect(dialog.outerHTML).not.toMatch(/#[0-9a-f]{6}/i);
    });

    it('places the close button at the logical end in RTL', () => {
      renderWithProviders(<TeachingPopover steps={steps} />, { dir: 'rtl' });
      const close = screen.getByRole('button', { name: 'Close' });
      expect(close).toHaveClass('end-3');
      expect(close).not.toHaveClass('right-3');
      expect(close.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('target anchoring (overlays#30)', () => {
    function Anchored() {
      const targetRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={targetRef}>
            New feature
          </button>
          <TeachingPopover steps={steps} target={targetRef} side="bottom" />
        </>
      );
    }

    /** Records every style value of the surface, every focusin and every layer (un)registration. */
    function watch(dialog: HTMLElement) {
      const styles: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) styles.push(record.oldValue ?? '');
        styles.push(dialog.getAttribute('style') ?? '');
      });
      observer.observe(dialog, {
        attributes: true,
        attributeFilter: ['style'],
        attributeOldValue: true,
      });
      const focused: string[] = [];
      const onFocusIn = (event: FocusEvent) => {
        const el = event.target as HTMLElement;
        focused.push(el.getAttribute('role') === 'dialog' ? 'dialog' : (el.textContent ?? ''));
      };
      document.addEventListener('focusin', onFocusIn);
      const layerChanges = vi.fn();
      const unsubscribe = subscribeLayers(layerChanges);
      return {
        styles,
        focused,
        layerChanges,
        async stop() {
          // Flush the observer's pending records before disconnecting.
          await act(async () => {});
          for (const record of observer.takeRecords()) styles.push(record.oldValue ?? '');
          styles.push(dialog.getAttribute('style') ?? '');
          observer.disconnect();
          document.removeEventListener('focusin', onFocusIn);
          unsubscribe();
        },
      };
    }

    it.each([
      ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
      [
        'Done',
        async (user: ReturnType<typeof userEvent.setup>) => {
          await user.tab();
          await user.tab();
          await user.tab();
          expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
          await user.keyboard('{Enter}');
        },
      ],
    ])(
      'returns focus to the target when a tour opened on page load is dismissed with %s (overlays-anchored-tests-3)',
      async (_how, dismissWith) => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        function PageLoadTour() {
          const targetRef = React.useRef<HTMLButtonElement>(null);
          return (
            <>
              <button type="button" ref={targetRef}>
                New feature
              </button>
              <TeachingPopover
                steps={steps}
                defaultActiveStep={2}
                target={targetRef}
                onDismiss={onDismiss}
              />
            </>
          );
        }
        render(<PageLoadTour />);
        // Opened on page load: nothing had focus, so the target is where focus goes back to.
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());
        await dismissWith(user);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New feature' })).toHaveFocus();
      },
    );

    describe('keyboard order next to the target (x-keyboard-4)', () => {
      /** The focused element's name, `dialog` for the surface, or `body` when focus left the page. */
      const focused = () => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'body';
        if (el.getAttribute('role') === 'dialog') return 'dialog';
        return el.getAttribute('aria-label') ?? el.textContent;
      };

      async function tabs(user: ReturnType<typeof userEvent.setup>, count: number, shift = false) {
        const visited: Array<string | null | undefined> = [];
        for (let i = 0; i < count; i++) {
          await user.tab({ shift });
          visited.push(focused());
        }
        return visited;
      }

      /** A page with the tour's target in the middle; the popover is portaled after all of it. */
      function Page({ target = 'button' }: { target?: 'button' | 'group' | 'heading' }) {
        const targetRef = React.useRef<HTMLElement>(null);
        return (
          <>
            <button type="button">Before</button>
            {target === 'button' && (
              <button type="button" ref={targetRef as React.RefObject<HTMLButtonElement>}>
                New feature
              </button>
            )}
            {target === 'group' && (
              <div ref={targetRef as React.RefObject<HTMLDivElement>}>
                <button type="button">Bold</button>
                <button type="button">Italic</button>
              </div>
            )}
            {target === 'heading' && (
              <h2 ref={targetRef as React.RefObject<HTMLHeadingElement>}>Reports</h2>
            )}
            <button type="button">After</button>
            <TeachingPopover steps={steps} defaultActiveStep={1} target={targetRef} />
            <button type="button">End</button>
          </>
        );
      }

      async function renderPage(target?: 'button' | 'group' | 'heading') {
        const user = userEvent.setup();
        render(<Page target={target} />);
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());
        return user;
      }

      it('Tab moves through the popover and continues after the target', async () => {
        const user = await renderPage();
        expect(await tabs(user, 4)).toEqual(['Close', 'Back', 'Next', 'After']);
      });

      it('Shift+Tab from the element after the target enters the popover at its last button', async () => {
        const user = await renderPage();
        screen.getByRole('button', { name: 'After' }).focus();
        expect(await tabs(user, 4, true)).toEqual(['Next', 'Back', 'Close', 'New feature']);
      });

      it('Shift+Tab from the surface returns to the target, and Tab from the target enters the popover', async () => {
        const user = await renderPage();
        expect(await tabs(user, 2, true)).toEqual(['New feature', 'Before']);
        expect(await tabs(user, 3)).toEqual(['New feature', 'Close', 'Back']);
      });

      it('Tab from the last element of the page moves past the popover and leaves the page: one visit per lap, no Tab cycle', async () => {
        const user = await renderPage();
        screen.getByRole('button', { name: 'End' }).focus();
        expect(await tabs(user, 6)).toEqual([
          'body',
          'Before',
          'New feature',
          'Close',
          'Back',
          'Next',
        ]);
        expect(await tabs(user, 3)).toEqual(['After', 'End', 'body']);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('dialog').style.visibility).toBe('');
      });

      it.each([
        ['Tab', false],
        ['Shift+Tab', true],
      ] as const)(
        'scans the document for tabbable elements once per %s outside the popover',
        async (_key, shiftKey) => {
          await renderPage();
          const before = screen.getByRole('button', { name: 'Before' });
          act(() => before.focus());
          const scans = vi.spyOn(document.body, 'querySelectorAll');
          fireEvent.keyDown(before, { key: 'Tab', shiftKey });
          expect(
            scans.mock.calls.filter(([selector]) => selector === FOCUSABLE_SELECTOR),
          ).toHaveLength(1);
        },
      );

      it('a Shift+Tab lap from outside the page visits the popover once, after the target', async () => {
        const user = await renderPage();
        act(() => screen.getByRole('dialog').blur());
        expect(await tabs(user, 8, true)).toEqual([
          'End',
          'After',
          'Next',
          'Back',
          'Close',
          'New feature',
          'Before',
          'body',
        ]);
      });

      it.each([
        ['a script', false, 'Next', 'After'],
        ['Shift+Tab from the browser controls', true, 'End', 'body'],
      ] as const)(
        'keyboard only: focus that reaches the last button from nothing by %s',
        async (_how, fromBrowser, landsOn, next) => {
          const user = await renderPage();
          act(() => screen.getByRole('dialog').blur());
          // The window gets focus back just before the browser's own Shift+Tab focuses the
          // document's last element; a script (a focus restore after a removed layer) does not.
          if (fromBrowser) {
            act(() => {
              window.dispatchEvent(new FocusEvent('blur'));
              window.dispatchEvent(new FocusEvent('focus'));
            });
          }
          act(() => screen.getByRole('button', { name: 'Next' }).focus());
          expect(focused()).toBe(landsOn);
          expect(await tabs(user, 1)).toEqual([next]);
        },
      );

      it.each([
        ['Tab', false, ['After']],
        ['Shift+Tab', true, ['Back', 'Close', 'New feature']],
      ] as const)(
        'a click on the last button with nothing focused keeps the order after the target: %s (R1-1)',
        async (_key, shift, expected) => {
          const user = await renderPage();
          // A press where nothing takes focus (the tour stays open): focus moves to the body.
          await user.click(document.body);
          expect(document.body).toHaveFocus();
          // Focus reaches the popover's last button from nothing, by a pointer press (Next moves on
          // to the last step, where the same button reads Done): not Shift+Tab from the browser.
          await user.click(screen.getByRole('button', { name: 'Next' }));
          expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
          expect(await tabs(user, expected.length, shift)).toEqual(expected);
        },
      );

      it('a target that is not focusable: the tab stops around it', async () => {
        const user = await renderPage('group');
        // The popover's place is after the target's last control.
        expect(await tabs(user, 2, true)).toEqual(['Italic', 'Bold']);
        expect(await tabs(user, 2)).toEqual(['Italic', 'Close']);
        screen.getByRole('button', { name: 'Next' }).focus();
        expect(await tabs(user, 1)).toEqual(['After']);
      });

      it('a target without anything focusable: the tab stops before and after it', async () => {
        const user = await renderPage('heading');
        expect(await tabs(user, 1, true)).toEqual(['Before']);
        expect(await tabs(user, 1)).toEqual(['Close']);
        screen.getByRole('button', { name: 'Next' }).focus();
        expect(await tabs(user, 1)).toEqual(['After']);
      });
    });

    it('renders inline without a target (no portal, no beak)', () => {
      const { container } = render(<TeachingPopover steps={steps} />);
      const dialog = screen.getByRole('dialog');
      expect(container.contains(dialog)).toBe(true);
      expect(dialog.querySelector('[data-wave-teaching-popover-arrow]')).toBeNull();
    });

    it('portals and positions the surface next to the target, with a beak', async () => {
      const { container } = render(<Anchored />);
      const dialog = await screen.findByRole('dialog');
      expect(container.contains(dialog)).toBe(false);
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      expect(dialog).toHaveAttribute('data-side', 'bottom');
      expect(dialog.style.position).toBe('fixed');
      const arrow = dialog.querySelector('[data-wave-teaching-popover-arrow]');
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      // The beak inherits the surface colors, so a className override reaches it (button-provider#3).
      expect(arrow).toHaveClass('bg-inherit', 'border-inherit');
      expect(arrow).not.toHaveClass('bg-background');
      await waitFor(() => expect(dialog).toHaveFocus());
    });

    it('accepts the target element itself', async () => {
      function WithElement() {
        const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
        return (
          <>
            <button type="button" ref={setTarget}>
              New feature
            </button>
            <TeachingPopover steps={steps} target={target} />
          </>
        );
      }
      render(<WithElement />);
      expect((await screen.findByRole('dialog')).closest('[data-wave-portal]')).not.toBeNull();
    });

    it('stays hidden, unfocused and without an Escape layer while the target is null', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      function LateTarget() {
        const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
        const [showTarget, setShowTarget] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setShowTarget(true)}>
              Show target
            </button>
            {showTarget && (
              <button type="button" ref={setTarget}>
                New feature
              </button>
            )}
            <TeachingPopover steps={steps} target={target} onDismiss={onDismiss} data-testid="tp" />
          </>
        );
      }
      render(<LateTarget />);
      await act(async () => {});
      const surface = screen.getByTestId('tp');
      expect(surface).toHaveStyle({ visibility: 'hidden' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(surface).not.toHaveFocus();
      await user.keyboard('{Escape}');
      expect(onDismiss).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Show target' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBe(surface);
      expect(dialog).not.toHaveStyle({ visibility: 'hidden' });
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('hides again when the target goes back to null', async () => {
      function ToggleTarget({ attached }: { attached: boolean }) {
        const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
        return (
          <>
            {attached && (
              <button type="button" ref={setTarget}>
                New feature
              </button>
            )}
            <TeachingPopover steps={steps} target={attached ? target : null} data-testid="tp" />
          </>
        );
      }
      const { rerender } = render(<ToggleTarget attached />);
      await screen.findByRole('dialog');
      rerender(<ToggleTarget attached={false} />);
      expect(screen.getByTestId('tp')).toHaveStyle({ visibility: 'hidden' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['after', false],
      ['before', true],
    ])(
      'hides when a ref target unmounts after it was positioned, and shows again when it returns (popover %s the target in the tree)',
      async (_order, popoverFirst) => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        function RefTarget() {
          const targetRef = React.useRef<HTMLButtonElement>(null);
          const [attached, setAttached] = React.useState(true);
          // Before the target, the popover's layout effect runs before the ref attaches.
          const popover = (
            <TeachingPopover
              steps={steps}
              target={targetRef}
              onDismiss={onDismiss}
              data-testid="tp"
            />
          );
          return (
            <>
              <button type="button" onClick={() => setAttached((value) => !value)}>
                Toggle target
              </button>
              {popoverFirst && popover}
              {attached && (
                <button type="button" ref={targetRef}>
                  New feature
                </button>
              )}
              {!popoverFirst && popover}
            </>
          );
        }
        render(<RefTarget />);
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());

        await user.click(screen.getByRole('button', { name: 'Toggle target' }));
        await waitFor(() => expect(screen.getByTestId('tp')).toHaveStyle({ visibility: 'hidden' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(onDismiss).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Toggle target' }));
        const again = await screen.findByRole('dialog');
        expect(again).toBe(dialog);
        await waitFor(() => expect(again).toHaveFocus());
        await user.keyboard('{Escape}');
        expect(onDismiss).toHaveBeenCalledTimes(1);
      },
    );

    it('hides when the target switches to a ref that is not attached', async () => {
      function TwoRefs({ useSecond }: { useSecond: boolean }) {
        const firstRef = React.useRef<HTMLButtonElement>(null);
        const secondRef = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={firstRef}>
              New feature
            </button>
            <TeachingPopover
              steps={steps}
              target={useSecond ? secondRef : firstRef}
              data-testid="tp"
            />
          </>
        );
      }
      const { rerender } = render(<TwoRefs useSecond={false} />);
      await screen.findByRole('dialog');
      rerender(<TwoRefs useSecond />);
      // A ref cannot be read during render: the new ref's attachment is resolved by the deferred
      // update after the commit, which hides the popover.
      await act(async () => {});
      expect(screen.getByTestId('tp')).toHaveStyle({ visibility: 'hidden' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    describe('moving between attached ref targets (a multi-target tour)', () => {
      interface TourOptions {
        strict?: boolean;
        popoverFirst?: boolean;
      }

      function RefTour({
        onDismiss,
        onOpenChange,
        popoverFirst = false,
      }: {
        onDismiss: () => void;
        onOpenChange: (open: boolean) => void;
        popoverFirst?: boolean;
      }) {
        const firstRef = React.useRef<HTMLButtonElement>(null);
        const secondRef = React.useRef<HTMLButtonElement>(null);
        const [step, setStep] = React.useState(0);
        const popover = (
          <TeachingPopover
            steps={steps}
            activeStep={step}
            onStepChange={setStep}
            target={step === 0 ? firstRef : secondRef}
            onDismiss={onDismiss}
            onOpenChange={onOpenChange}
          />
        );
        return (
          <>
            {popoverFirst && popover}
            <button type="button" ref={firstRef}>
              Target A
            </button>
            <button type="button" ref={secondRef}>
              Target B
            </button>
            {!popoverFirst && popover}
          </>
        );
      }

      async function renderTour({ strict = false, popoverFirst = false }: TourOptions = {}) {
        const onDismiss = vi.fn();
        const onOpenChange = vi.fn();
        const tour = (
          <RefTour onDismiss={onDismiss} onOpenChange={onOpenChange} popoverFirst={popoverFirst} />
        );
        render(strict ? <React.StrictMode>{tour}</React.StrictMode> : tour);
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());
        expect(getOpenLayers()).toHaveLength(1);
        return { dialog, onDismiss, onOpenChange };
      }

      it('keeps the dialog shown and focus on Next when Next is clicked', async () => {
        const user = userEvent.setup();
        const { dialog, onDismiss, onOpenChange } = await renderTour();
        const watcher = watch(dialog);

        await user.click(screen.getByRole('button', { name: 'Next' }));
        await act(async () => {});

        expect(screen.getByRole('dialog', { name: 'Features, step 2 of 3' })).toBe(dialog);
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));

        // Back moves to the first target again, with the same guarantees.
        await user.click(screen.getByRole('button', { name: 'Back' }));
        await act(async () => {});
        expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBe(dialog);
        expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
        await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Welcome, step 1 of 3'));

        await watcher.stop();
        expect(watcher.styles.filter((style) => style.includes('hidden'))).toEqual([]);
        expect(watcher.focused).toEqual(['Next', 'Back']);
        expect(watcher.layerChanges).not.toHaveBeenCalled();
        expect(getOpenLayers()).toHaveLength(1);
        expect(onOpenChange).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onOpenChange.mock.calls).toEqual([[false]]);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it.each<[string, TourOptions]>([
        ['', {}],
        [' under StrictMode', { strict: true }],
        [' when the popover comes before its targets in the tree', { popoverFirst: true }],
      ])(
        'keeps the dialog shown and focus on Next when Next is pressed with Enter%s',
        async (_name, options) => {
          const user = userEvent.setup();
          const { dialog, onDismiss, onOpenChange } = await renderTour(options);
          await user.tab();
          expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
          await user.tab();
          await user.tab();
          expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
          const watcher = watch(dialog);

          await user.keyboard('{Enter}');
          await act(async () => {});

          expect(screen.getByRole('dialog', { name: 'Features, step 2 of 3' })).toBe(dialog);
          expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
          await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));

          // Space on Back moves to the first target again, with the same guarantees.
          await user.tab({ shift: true });
          expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
          await user.keyboard(' ');
          await act(async () => {});
          expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBe(dialog);
          expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();

          await watcher.stop();
          expect(watcher.styles.filter((style) => style.includes('hidden'))).toEqual([]);
          // Only the Tab to Back moved focus: nothing left the popover or came back to it.
          expect(watcher.focused).toEqual(['Back']);
          expect(watcher.layerChanges).not.toHaveBeenCalled();
          expect(getOpenLayers()).toHaveLength(1);
          expect(onOpenChange).not.toHaveBeenCalled();

          await user.keyboard('{Escape}');
          expect(onDismiss).toHaveBeenCalledTimes(1);
          expect(onOpenChange.mock.calls).toEqual([[false]]);
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        },
      );
    });

    it('stays shown when a new ref object is passed on every render', async () => {
      function InlineRef({ label }: { label: string }) {
        const [element, setElement] = React.useState<HTMLButtonElement | null>(null);
        return (
          <>
            <button type="button" ref={setElement}>
              {label}
            </button>
            <TeachingPopover steps={steps} target={{ current: element }} />
          </>
        );
      }
      const { rerender } = render(<InlineRef label="New feature" />);
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveFocus());
      const watcher = watch(dialog);

      rerender(<InlineRef label="Renamed feature" />);
      expect(dialog).not.toHaveStyle({ visibility: 'hidden' });
      rerender(<InlineRef label="Renamed again" />);
      await act(async () => {});

      await watcher.stop();
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(dialog).toHaveFocus();
      expect(watcher.styles.filter((style) => style.includes('hidden'))).toEqual([]);
      expect(watcher.focused).toEqual([]);
      expect(watcher.layerChanges).not.toHaveBeenCalled();
    });

    it('does not announce a step change while it is hidden, only once it is shown (overlays#28)', async () => {
      function Harness({ step, withTarget }: { step: number; withTarget: boolean }) {
        const [target, setTarget] = React.useState<HTMLButtonElement | null>(null);
        return (
          <>
            {withTarget && (
              <button type="button" ref={setTarget}>
                New feature
              </button>
            )}
            <TeachingPopover steps={steps} target={withTarget ? target : null} activeStep={step} />
          </>
        );
      }
      // The live region is written on the next animation frame: wait well past it.
      const afterFrames = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      const { rerender } = render(<Harness step={0} withTarget={false} />);
      rerender(<Harness step={1} withTarget={false} />);
      await afterFrames();
      expect(__getAnnouncerText('polite')).toBe('');

      // Showing it announces nothing either: the focused dialog's name carries the step position.
      rerender(<Harness step={1} withTarget />);
      expect(await screen.findByRole('dialog', { name: 'Features, step 2 of 3' })).toBeVisible();
      await afterFrames();
      expect(__getAnnouncerText('polite')).toBe('');

      rerender(<Harness step={2} withTarget />);
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Done, step 3 of 3'));
    });
  });

  describe('composed handlers (layout#10)', () => {
    testComposedHandler(TeachingPopover, {
      handler: 'onKeyDown',
      defaultProps: { steps },
      act: async ({ user }) => {
        screen.getByRole('dialog').focus();
        await user.keyboard('{Escape}');
      },
      assertInternal: () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
      assertInternalSuppressed: () => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      },
    });
  });
});
