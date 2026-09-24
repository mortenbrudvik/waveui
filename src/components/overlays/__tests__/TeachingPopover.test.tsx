import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeachingPopover } from '../TeachingPopover';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import { getOpenLayers, subscribeLayers } from '../../../lib/layers';
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
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[WaveUI\] TeachingPopover/));
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

  describe('deprecated aliases (feedback-navigation#46)', () => {
    it('currentStep still selects the step and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} currentStep={1} />);
      expect(heading()).toHaveTextContent(/^Features/);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] TeachingPopover: `currentStep` is deprecated and will be removed in 1.0. Use `activeStep` instead.',
      );
    });

    it('defaultCurrentStep still sets the initial step and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} defaultCurrentStep={2} />);
      expect(heading()).toHaveTextContent(/^Done/);
      expect(warn).toHaveBeenCalledWith(
        '[WaveUI] TeachingPopover: `defaultCurrentStep` is deprecated and will be removed in 1.0. Use `defaultActiveStep` instead.',
      );
    });

    it('activeStep wins over currentStep', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<TeachingPopover steps={steps} activeStep={2} currentStep={0} />);
      expect(heading()).toHaveTextContent(/^Done/);
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

    it('hides when a ref target unmounts after it was positioned, and shows again when it returns', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      function RefTarget() {
        const targetRef = React.useRef<HTMLButtonElement>(null);
        const [attached, setAttached] = React.useState(true);
        return (
          <>
            <button type="button" onClick={() => setAttached((value) => !value)}>
              Toggle target
            </button>
            {attached && (
              <button type="button" ref={targetRef}>
                New feature
              </button>
            )}
            <TeachingPopover
              steps={steps}
              target={targetRef}
              onDismiss={onDismiss}
              data-testid="tp"
            />
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
    });

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
      function RefTour({ onDismiss }: { onDismiss?: () => void }) {
        const firstRef = React.useRef<HTMLButtonElement>(null);
        const secondRef = React.useRef<HTMLButtonElement>(null);
        const [step, setStep] = React.useState(0);
        return (
          <>
            <button type="button" ref={firstRef}>
              Target A
            </button>
            <button type="button" ref={secondRef}>
              Target B
            </button>
            <TeachingPopover
              steps={steps}
              activeStep={step}
              onStepChange={setStep}
              target={step === 0 ? firstRef : secondRef}
              onDismiss={onDismiss}
            />
          </>
        );
      }

      async function renderTour() {
        const onDismiss = vi.fn();
        render(<RefTour onDismiss={onDismiss} />);
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());
        expect(getOpenLayers()).toHaveLength(1);
        return { dialog, onDismiss };
      }

      it('keeps the dialog shown and focus on Next when Next is clicked', async () => {
        const user = userEvent.setup();
        const { dialog, onDismiss } = await renderTour();
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

        await user.keyboard('{Escape}');
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('keeps the dialog shown and focus on Next when Next is pressed with Enter', async () => {
        const user = userEvent.setup();
        const { dialog, onDismiss } = await renderTour();
        screen.getByRole('button', { name: 'Next' }).focus();
        const watcher = watch(dialog);

        await user.keyboard('{Enter}');
        await act(async () => {});

        expect(screen.getByRole('dialog', { name: 'Features, step 2 of 3' })).toBe(dialog);
        expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
        await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));

        await watcher.stop();
        expect(watcher.styles.filter((style) => style.includes('hidden'))).toEqual([]);
        expect(watcher.focused).toEqual([]);
        expect(watcher.layerChanges).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });
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
