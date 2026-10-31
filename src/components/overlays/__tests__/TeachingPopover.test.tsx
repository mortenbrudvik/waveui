import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, it, expect, expectTypeOf, vi, onTestFinished } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  TeachingPopover,
  TeachingPopoverBody,
  TeachingPopoverCarousel,
  TeachingPopoverCarouselFooter,
  TeachingPopoverCarouselNav,
  TeachingPopoverCarouselPageCount,
  TeachingPopoverFooter,
  TeachingPopoverHeader,
  TeachingPopoverSurface,
  TeachingPopoverTitle,
  TeachingPopoverTrigger,
  type TeachingPopoverAction,
  type TeachingPopoverBodyProps,
  type TeachingPopoverCarouselFooterProps,
  type TeachingPopoverCarouselNavProps,
  type TeachingPopoverCarouselPageCountProps,
  type TeachingPopoverCarouselProps,
  type TeachingPopoverFooterProps,
  type TeachingPopoverHeaderProps,
  type TeachingPopoverLabels,
  type TeachingPopoverProps,
  type TeachingPopoverSurfaceProps,
  type TeachingPopoverTitleProps,
  type TeachingPopoverTriggerChildProps,
} from '../TeachingPopover';
import type { TeachingPopoverContextValue } from '../TeachingPopover.context';
import { Button } from '../../button/Button';
import {
  buttonClassNames,
  teachingPopoverBodyClassNames,
  teachingPopoverCarouselClassNames,
  teachingPopoverCarouselFooterClassNames,
  teachingPopoverCarouselNavClassNames,
  teachingPopoverCarouselPageCountClassNames,
  teachingPopoverClassNames,
  teachingPopoverFooterClassNames,
  teachingPopoverHeaderClassNames,
  teachingPopoverSurfaceClassNames,
  teachingPopoverTitleClassNames,
} from '../../../lib/classNames';
import { __resetWarnings } from '../../../lib/dev';
import { popupMotion } from '../../../lib/motion';
import type { Slot } from '../../../lib/slot';
import { __getAnnouncerText } from '../../../hooks/useAnnounce';
import { getOpenLayers, subscribeLayers } from '../../../lib/layers';
import { FOCUSABLE_SELECTOR } from '../../../lib/focus';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  installResizeObserverMock,
  mockRect,
  openingTags,
  renderWithProviders,
  testCompoundExposure,
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

  it('accepts readonly steps (C-NAMING)', () => {
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

    it('names the Close button with closeLabel (C-NAMING), "Close" by default, and keeps it off the surface', async () => {
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

    it('keeps the dots visible in forced-colors mode, the current one in Highlight', () => {
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
    it('positioning.offset replaces the default offset of 12', async () => {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      onTestFinished(() => {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      });
      const rect = {
        x: 200,
        y: 100,
        width: 100,
        height: 20,
        top: 100,
        right: 300,
        bottom: 120,
        left: 200,
      };
      render(
        <TeachingPopover
          steps={steps}
          target={{ getBoundingClientRect: () => rect }}
          positioning={{ offset: 0 }}
        />,
      );
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.style.transform).toBe('translate(250px, 120px)'));
    });

    it('positions against a VirtualElement target', async () => {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      onTestFinished(() => {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      });
      const rect = {
        x: 200,
        y: 100,
        width: 100,
        height: 20,
        top: 100,
        right: 300,
        bottom: 120,
        left: 200,
      };
      render(<TeachingPopover steps={steps} target={{ getBoundingClientRect: () => rect }} />);
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.style.transform).toBe('translate(250px, 132px)'));
    });

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
      'returns focus to the target when a tour opened on page load is dismissed with %s',
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

    describe('keyboard order next to the target', () => {
      // Each test presses Tab many times through user-event, and each press scans the page for
      // tab stops: up to about two seconds alone, but more than Vitest's 5 s default under the
      // parallel gate or on a CI runner, hence the 20 s timeouts.

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
      }, 20_000);

      it('Shift+Tab from the element after the target enters the popover at its last button', async () => {
        const user = await renderPage();
        screen.getByRole('button', { name: 'After' }).focus();
        expect(await tabs(user, 4, true)).toEqual(['Next', 'Back', 'Close', 'New feature']);
      }, 20_000);

      it('Shift+Tab from the surface returns to the target, and Tab from the target enters the popover', async () => {
        const user = await renderPage();
        expect(await tabs(user, 2, true)).toEqual(['New feature', 'Before']);
        expect(await tabs(user, 3)).toEqual(['New feature', 'Close', 'Back']);
      }, 20_000);

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
      }, 20_000);

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
        20_000,
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
      }, 20_000);

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
        20_000,
      );

      it.each([
        ['Tab', false, ['After']],
        ['Shift+Tab', true, ['Back', 'Close', 'New feature']],
      ] as const)(
        'a click on the last button with nothing focused keeps the order after the target: %s',
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
        20_000,
      );

      it('a target that is not focusable: the tab stops around it', async () => {
        const user = await renderPage('group');
        // The popover's place is after the target's last control.
        expect(await tabs(user, 2, true)).toEqual(['Italic', 'Bold']);
        expect(await tabs(user, 2)).toEqual(['Italic', 'Close']);
        screen.getByRole('button', { name: 'Next' }).focus();
        expect(await tabs(user, 1)).toEqual(['After']);
      }, 20_000);

      it('a target without anything focusable: the tab stops before and after it', async () => {
        const user = await renderPage('heading');
        expect(await tabs(user, 1, true)).toEqual(['Before']);
        expect(await tabs(user, 1)).toEqual(['Close']);
        screen.getByRole('button', { name: 'Next' }).focus();
        expect(await tabs(user, 1)).toEqual(['After']);
      }, 20_000);

      it('a target with no tab stop at or before it: the popover is reached again where its portal is, and no Tab cycle forms', async () => {
        const user = userEvent.setup();
        function TopOfPage() {
          const targetRef = React.useRef<HTMLHeadingElement>(null);
          return (
            <>
              <h2 ref={targetRef}>Reports</h2>
              <button type="button">After</button>
              <TeachingPopover steps={steps} defaultActiveStep={1} target={targetRef} />
              <button type="button">End</button>
            </>
          );
        }
        render(<TopOfPage />);
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog).toHaveFocus());
        // Tab past its last button continues after the target. Its place comes before every
        // element of the page, so Tab from the end of the page reaches it where its portal is.
        expect(await tabs(user, 9)).toEqual([
          'Close',
          'Back',
          'Next',
          'After',
          'End',
          'Close',
          'Back',
          'Next',
          'body',
        ]);
        expect(await tabs(user, 6)).toEqual(['After', 'End', 'Close', 'Back', 'Next', 'body']);
        // Shift+Tab visits every element once per lap in the same order, reversed.
        expect(await tabs(user, 7, true)).toEqual([
          'Next',
          'Back',
          'Close',
          'End',
          'After',
          'body',
          'Next',
        ]);
      }, 20_000);
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

  describe('footer actions and onFinish (P9-07)', () => {
    const tip = [{ title: 'Tip', body: 'Press Ctrl+K.' }];

    it('a single-step tip takes a secondary "Learn more" and a primary "Got it"', async () => {
      const user = userEvent.setup();
      const onLearn = vi.fn();
      const onGotIt = vi.fn();
      const onFinish = vi.fn();
      render(
        <TeachingPopover
          steps={tip}
          onFinish={onFinish}
          secondaryAction={<Button onClick={onLearn}>Learn more</Button>}
          primaryAction={{ children: 'Got it', onClick: onGotIt }}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
      const learn = screen.getByRole('button', { name: 'Learn more' });
      expect(learn).toHaveClass(teachingPopoverClassNames.secondaryButton);
      await user.click(learn);
      expect(onLearn).toHaveBeenCalledTimes(1);
      expect(onFinish).not.toHaveBeenCalled();
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      expect(gotIt).toHaveClass(teachingPopoverClassNames.primaryButton);
      await user.click(gotIt);
      expect(onGotIt).toHaveBeenCalledTimes(1);
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('accepts plain content: a string label becomes the button', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(<TeachingPopover steps={tip} onFinish={onFinish} primaryAction="Got it" />);
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('a Button-like element is used as given (no nested button) and a slot object can be a link', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover
          steps={tip}
          secondaryAction={{ as: 'a', href: '#docs', children: 'Docs' }}
          primaryAction={<button type="button">Ok</button>}
        />,
      );
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', '#docs');
      expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('appearance');
      // The slot's `as` changes the element, never the component: it is still a Wave Button.
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveClass(
        buttonClassNames.root,
        teachingPopoverClassNames.secondaryButton,
      );
      const ok = screen.getByRole('button', { name: 'Ok' });
      expect(ok.querySelector('button')).toBeNull();
      expect(ok).toHaveClass(teachingPopoverClassNames.primaryButton);
      await user.click(ok);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores a render function as an action’s children, with one warning; the action stays a wired Button (P13-01)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onFinish = vi.fn();
      const renderAction = vi.fn(() => <b>never</b>);
      const action = { as: 'span', 'aria-label': 'Got it', children: renderAction };
      render(
        <React.StrictMode>
          <TeachingPopover
            steps={tip}
            onFinish={onFinish}
            primaryAction={action as unknown as TeachingPopoverAction}
          />
        </React.StrictMode>,
      );
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      // Rendered as without the function: a span that is still a Wave Button, with its wiring.
      expect(gotIt.tagName).toBe('SPAN');
      expect(gotIt).toHaveClass(buttonClassNames.root, teachingPopoverClassNames.primaryButton);
      expect(gotIt).toHaveAttribute('tabindex', '0');
      expect(gotIt).toBeEmptyDOMElement();
      expect(renderAction).not.toHaveBeenCalled();
      await user.click(gotIt);
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] TeachingPopover: a `primaryAction` or `secondaryAction` slot object took a render function as `children`; it was ignored, since an action always renders as a Wave Button. Pass the label as `children`, or change the element with `as`.',
        ],
      ]);
    });

    it('types an action’s children as its label: a render function is a type error (P13-01)', () => {
      expectTypeOf<{ children: React.ReactNode }>().toMatchTypeOf<TeachingPopoverAction>();
      // @ts-expect-error — an action takes no render function
      const action: TeachingPopoverAction = { children: () => null };
      expect(action).toBeDefined();
    });

    it.each(['Enter', ' '])(
      'a slot object rendered as a span is a keyboard-operable Button (%j)',
      async (key) => {
        const user = userEvent.setup();
        const onFinish = vi.fn();
        render(
          <TeachingPopover
            steps={tip}
            onFinish={onFinish}
            primaryAction={{ as: 'span', children: 'Got it' }}
          />,
        );
        const gotIt = screen.getByRole('button', { name: 'Got it' });
        expect(gotIt.tagName).toBe('SPAN');
        expect(gotIt).toHaveClass(buttonClassNames.root, teachingPopoverClassNames.primaryButton);
        expect(gotIt).not.toHaveAttribute('appearance');
        await user.tab();
        await user.tab();
        expect(gotIt).toHaveFocus();
        await user.keyboard(key === ' ' ? '[Space]' : '{Enter}');
        expect(onFinish).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
    );

    it('step actions replace Next/Done and Back on that step only', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover
          steps={[
            { title: 'One', body: 'a' },
            {
              title: 'Two',
              body: 'b',
              primaryAction: 'Continue',
              secondaryAction: 'Skip back',
            },
            { title: 'Three', body: 'c' },
          ]}
          defaultActiveStep={1}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Skip back' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(heading()).toHaveTextContent(/^Three/);
      expect(screen.getByRole('button', { name: 'Back' })).toHaveClass(
        teachingPopoverClassNames.backButton,
      );
      expect(screen.getByRole('button', { name: 'Done' })).toHaveClass(
        teachingPopoverClassNames.nextButton,
      );
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    });

    it('root actions are the defaults and a step action wins', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover
          steps={[
            { title: 'One', body: 'a' },
            { title: 'Two', body: 'b', primaryAction: 'Own primary' },
          ]}
          primaryAction="Root primary"
          secondaryAction="Root secondary"
        />,
      );
      expect(screen.getByRole('button', { name: 'Root primary' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Root secondary' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Root primary' }));
      expect(heading()).toHaveTextContent(/^Two/);
      expect(screen.getByRole('button', { name: 'Own primary' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Root primary' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Root secondary' })).toBeInTheDocument();
    });

    it('an action that renders nothing falls back to the built-in buttons', () => {
      render(
        <TeachingPopover
          steps={[
            { title: 'One', body: 'a', primaryAction: null, secondaryAction: [] },
            { title: 'Two', body: 'b' },
          ]}
        />,
      );
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    });

    it('the consumer onClick runs first; the step action follows', async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      render(
        <TeachingPopover
          steps={steps}
          onStepChange={() => calls.push('step')}
          primaryAction={{ children: 'Go', onClick: () => calls.push('click') }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Go' }));
      expect(calls).toEqual(['click', 'step']);
      expect(heading()).toHaveTextContent(/^Features/);
    });

    it('preventDefault() in the primary action keeps the step and the popover', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onFinish = vi.fn();
      const onDismiss = vi.fn();
      render(
        <TeachingPopover
          steps={steps}
          activeStep={0}
          onStepChange={onStepChange}
          onFinish={onFinish}
          onDismiss={onDismiss}
          primaryAction={{ children: 'Stay', onClick: (event) => event.preventDefault() }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Stay' }));
      expect(onStepChange).not.toHaveBeenCalled();
      expect(heading()).toHaveTextContent(/^Welcome/);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onFinish).not.toHaveBeenCalled();
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('preventDefault() in a step-level action keeps that step and the popover', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onFinish = vi.fn();
      render(
        <TeachingPopover
          steps={[
            { title: 'One', body: 'a' },
            {
              title: 'Two',
              body: 'b',
              primaryAction: { children: 'Hold', onClick: (event) => event.preventDefault() },
            },
          ]}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          onFinish={onFinish}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Hold' }));
      expect(onStepChange).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
      expect(heading()).toHaveTextContent(/^Two/);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('preventDefault() on the last step keeps the popover open and skips onFinish', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(
        <TeachingPopover
          steps={tip}
          onFinish={onFinish}
          primaryAction={<Button onClick={(event) => event.preventDefault()}>Hold on</Button>}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Hold on' }));
      expect(onFinish).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('a secondary action runs Back on a later step unless prevented', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const { rerender } = render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          secondaryAction="Previous tip"
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Previous tip' }));
      expect(onStepChange).toHaveBeenCalledWith(0);
      expect(heading()).toHaveTextContent(/^Welcome/);
      onStepChange.mockClear();
      rerender(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          secondaryAction={{ children: 'Learn more', onClick: (event) => event.preventDefault() }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Learn more' }));
      expect(onStepChange).not.toHaveBeenCalled();
    });

    it('a secondary action on the first step does not step back', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <TeachingPopover steps={steps} onStepChange={onStepChange} secondaryAction="Learn more" />,
      );
      await user.click(screen.getByRole('button', { name: 'Learn more' }));
      expect(onStepChange).not.toHaveBeenCalled();
      expect(heading()).toHaveTextContent(/^Welcome/);
    });

    it('Done calls onFinish, then onDismiss (kept in 0.x); Close and Escape only onDismiss', async () => {
      const user = userEvent.setup();
      const calls: string[] = [];
      render(
        <TeachingPopover
          steps={steps}
          activeStep={2}
          open
          onOpenChange={() => calls.push('open')}
          onFinish={() => calls.push('finish')}
          onDismiss={() => calls.push('dismiss')}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(calls).toEqual(['open', 'finish', 'dismiss']);
      calls.length = 0;
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await user.keyboard('{Escape}');
      expect(calls).toEqual(['open', 'dismiss', 'open', 'dismiss']);
    });

    it('fires onFinish once per Done under StrictMode', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(
        <React.StrictMode>
          <TeachingPopover steps={tip} onFinish={onFinish} />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('returns focus to the opener after a custom primary action finishes the tour', async () => {
      const user = userEvent.setup();
      function Tour() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Start tour
            </button>
            <TeachingPopover
              steps={tip}
              open={open}
              onOpenChange={setOpen}
              primaryAction="Got it"
            />
          </>
        );
      }
      render(<Tour />);
      await user.click(screen.getByRole('button', { name: 'Start tour' }));
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start tour' })).toHaveFocus();
    });

    it('renders data-layout, horizontal by default, and stacks the buttons when vertical', () => {
      const { rerender } = render(<TeachingPopover steps={steps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'horizontal');
      expect(screen.getByRole('button', { name: 'Next' }).parentElement).not.toHaveClass(
        'flex-col',
      );
      rerender(<TeachingPopover steps={steps} footerLayout="vertical" />);
      expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'vertical');
      expect(screen.getByRole('button', { name: 'Next' }).parentElement).toHaveClass('flex-col');
    });

    it('has no axe violations with custom actions in both layouts', async () => {
      const { rerender } = render(
        <TeachingPopover steps={tip} secondaryAction="Learn more" primaryAction="Got it" />,
      );
      await expectNoA11yViolations();
      rerender(
        <TeachingPopover
          steps={tip}
          footerLayout="vertical"
          secondaryAction={{ as: 'a', href: '#docs', children: 'Learn more' }}
          primaryAction="Got it"
        />,
      );
      await expectNoA11yViolations();
    });

    it('types the actions as slots', () => {
      expectTypeOf<TeachingPopoverProps['primaryAction']>().toEqualTypeOf<
        TeachingPopoverAction | undefined
      >();
      expectTypeOf<TeachingPopoverProps['footerLayout']>().toEqualTypeOf<
        'horizontal' | 'vertical' | undefined
      >();
      expectTypeOf<TeachingPopoverProps['onFinish']>().toEqualTypeOf<(() => void) | undefined>();
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

/**
 * The markup of the `steps` form, pinned (spec D2: an unchanged call renders as it did): the
 * surface's attributes and its `innerHTML`, ids normalized. Recorded from 0.14, whose parts render
 * the steps form: the header element around the Close button and the classes of
 * TeachingPopover.Header, Title, Body and Footer. TeachingPopover's own elements, classes, data
 * attributes, ARIA and text are literal; Button's rendering is not pinned, so restyling Button
 * leaves the fixture as it is: inside a `wave-button` element only the `wave-*` classes stay, the
 * attributes are sorted (Button orders them) and an icon is its `data-wave-icon`. Each button's
 * appearance is checked against reference Buttons rendered here, and the Close button's own
 * placement classes separately. Update the fixture only for an intended markup change.
 */
describe('TeachingPopover steps form markup (D2)', () => {
  const normalize = (html: string) => html.replace(/\b(id|aria-labelledby)="[^"]*"/g, '$1=""');
  const surfaceAttributes = (el: HTMLElement) =>
    Array.from(el.attributes, (attr): [string, string] => [
      attr.name,
      attr.name === 'aria-labelledby' ? '' : attr.value,
    ]);

  /** The surface's `innerHTML` with Button's rendering reduced (see above), ids normalized. */
  function surfaceMarkup(surface: HTMLElement): string {
    const clone = surface.cloneNode(true) as HTMLElement;
    for (const buttonEl of Array.from(clone.querySelectorAll(`.${buttonClassNames.root}`))) {
      for (const el of [buttonEl, ...Array.from(buttonEl.querySelectorAll('*'))]) {
        if (el.tagName.toLowerCase() === 'svg') {
          const icon = el.getAttribute('data-wave-icon');
          el.replaceChildren();
          for (const name of el.getAttributeNames()) el.removeAttribute(name);
          if (icon !== null) el.setAttribute('data-wave-icon', icon);
          continue;
        }
        if (el.hasAttribute('class')) {
          const stable = Array.from(el.classList).filter((cls) => cls.startsWith('wave-'));
          el.setAttribute('class', stable.join(' '));
        }
        const attributes = Array.from(el.attributes, (attr) => [attr.name, attr.value] as const);
        for (const [name] of attributes) el.removeAttribute(name);
        for (const [name, value] of attributes.sort(([a], [b]) => a.localeCompare(b))) {
          el.setAttribute(name, value);
        }
      }
    }
    return normalize(clone.innerHTML);
  }

  const APPEARANCES = ['primary', 'outline', 'subtle', 'transparent'] as const;

  /**
   * Which Button appearance each button of `surface` has, by its name: the appearance whose
   * classes (those not shared by every appearance, read from reference Buttons) it carries.
   */
  function buttonAppearances(surface: HTMLElement): Array<[string, string]> {
    const reference = render(
      <>
        {APPEARANCES.map((appearance) => (
          <Button key={appearance} appearance={appearance}>
            {appearance}
          </Button>
        ))}
      </>,
    );
    const classes = Array.from(
      reference.container.querySelectorAll('button'),
      (el) => new Set(el.classList),
    );
    reference.unmount();
    const own = classes.map((set) =>
      [...set].filter((cls) => !classes.every((other) => other.has(cls))),
    );
    return Array.from(surface.querySelectorAll<HTMLElement>(`.${buttonClassNames.root}`), (el) => {
      const matches = APPEARANCES.filter((_, i) =>
        own[i].every((cls) => el.classList.contains(cls)),
      );
      return [
        el.getAttribute('aria-label') ?? el.textContent ?? '',
        matches.length === 1 ? matches[0] : `no single appearance (${matches.join(', ')})`,
      ];
    });
  }

  const HEADER =
    '<div class="wave-teaching-popover-header">' +
    '<button aria-label="Close" class="wave-button wave-teaching-popover__close-button" type="button">' +
    '<span aria-hidden="true" class="wave-button__icon"><svg data-wave-icon="dismiss"></svg></span>' +
    '</button></div>';
  const TITLE_OPEN =
    '<h3 id="" class="wave-teaching-popover-title wave-teaching-popover__title mb-2 pe-8 text-subtitle-1 font-semibold text-foreground">';
  const BODY_OPEN =
    '<div class="wave-teaching-popover-body wave-teaching-popover__body mb-4 text-body-1 text-muted-foreground">';
  const FOOTER_OPEN =
    '<div data-layout="horizontal" class="wave-teaching-popover-footer wave-teaching-popover__footer flex gap-2 items-center justify-between">' +
    '<div aria-hidden="true" class="flex items-center gap-1.5">';
  const DOT =
    'wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none';
  const CURRENT_DOT = `<span data-wave-teaching-popover-dot="" aria-current="step" class="${DOT} w-4 bg-primary forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none"></span>`;
  const OTHER_DOT = `<span data-wave-teaching-popover-dot="" class="${DOT} w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none"></span>`;
  const BUTTONS_OPEN = '</div><div class="flex gap-2 items-center">';
  const FOOTER_CLOSE = '</div></div>';
  const SURFACE_ATTRIBUTES = [
    ['role', 'dialog'],
    ['aria-labelledby', ''],
    ['tabindex', '-1'],
    ['data-layout', 'horizontal'],
    ['data-presence', 'entered'],
    ['data-state', 'open'],
    [
      'class',
      `wave-teaching-popover relative w-80 rounded-md border border-border bg-background p-5 text-foreground shadow-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${popupMotion}`,
    ],
  ];

  it('the first of three steps: a focusable aria-disabled Back and Next', () => {
    render(<TeachingPopover steps={steps} />);
    const dialog = screen.getByRole('dialog');
    expect(surfaceAttributes(dialog)).toEqual(SURFACE_ATTRIBUTES);
    expect(surfaceMarkup(dialog)).toBe(
      HEADER +
        `${TITLE_OPEN}Welcome<span class="sr-only">, step 1 of 3</span></h3>` +
        `${BODY_OPEN}This is step one.</div>` +
        FOOTER_OPEN +
        CURRENT_DOT +
        OTHER_DOT +
        OTHER_DOT +
        BUTTONS_OPEN +
        '<button aria-disabled="true" class="wave-button wave-teaching-popover__back-button" data-disabled="" type="button">Back</button>' +
        '<button class="wave-button wave-teaching-popover__next-button" type="button">Next</button>' +
        FOOTER_CLOSE,
    );
    expect(buttonAppearances(dialog)).toEqual([
      ['Close', 'subtle'],
      ['Back', 'outline'],
      ['Next', 'primary'],
    ]);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('absolute', 'end-3', 'top-3');
  });

  it('the last of two steps: Back and Done', () => {
    render(
      <TeachingPopover
        steps={[
          { title: 'Tip', body: 'Press Ctrl+K.' },
          { title: 'Search', body: 'Type to filter.' },
        ]}
        activeStep={1}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(surfaceAttributes(dialog)).toEqual(SURFACE_ATTRIBUTES);
    expect(surfaceMarkup(dialog)).toBe(
      HEADER +
        `${TITLE_OPEN}Search<span class="sr-only">, step 2 of 2</span></h3>` +
        `${BODY_OPEN}Type to filter.</div>` +
        FOOTER_OPEN +
        OTHER_DOT +
        CURRENT_DOT +
        BUTTONS_OPEN +
        '<button class="wave-button wave-teaching-popover__back-button" type="button">Back</button>' +
        '<button class="wave-button wave-teaching-popover__next-button" type="button">Done</button>' +
        FOOTER_CLOSE,
    );
    expect(buttonAppearances(dialog)).toEqual([
      ['Close', 'subtle'],
      ['Back', 'outline'],
      ['Done', 'primary'],
    ]);
  });
});

describe('TeachingPopover parts: Trigger and Surface (P9-08)', () => {
  const PLACEMENT_WARNING =
    '[WaveUI] TeachingPopover.Surface: render one TeachingPopover.Surface in a TeachingPopover; a second Surface renders a second popover.';
  const SURFACE_PROPS_WARNING =
    '[WaveUI] TeachingPopover: the props of the surface element on TeachingPopover (`className`, `style`, `ref`, `onKeyDown`, `motion` and the other element props) are ignored next to a TeachingPopover.Surface: pass them to the Surface.';

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** A rectangle for a `VirtualElement` target and for `mockRect`. */
  const rect = {
    x: 200,
    y: 100,
    width: 100,
    height: 20,
    top: 100,
    right: 300,
    bottom: 120,
    left: 200,
  };

  /** Gives jsdom a viewport, so the positioning can place the popover. */
  function stubViewport() {
    const html = document.documentElement;
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
    onTestFinished(() => {
      Reflect.deleteProperty(html, 'clientWidth');
      Reflect.deleteProperty(html, 'clientHeight');
    });
  }

  /** A tour opened from a Trigger, between two page buttons. */
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
  const trigger = () => screen.getByRole('button', { name: 'Take the tour' });

  testCompoundExposure(TeachingPopover, ['Trigger', 'Surface']);

  it('exports the parts under their flat names for React Server Components (C-COMPOUND)', () => {
    expect(TeachingPopoverTrigger).toBeTypeOf('function');
    expect(TeachingPopoverTrigger).toBe(TeachingPopover.Trigger);
    expect(TeachingPopoverSurface).toBeTypeOf('function');
    expect(TeachingPopoverSurface).toBe(TeachingPopover.Surface);
  });

  it('types the parts', () => {
    expectTypeOf<TeachingPopoverSurfaceProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<TeachingPopoverTriggerChildProps['aria-haspopup']>().toEqualTypeOf<'dialog'>();
    expectTypeOf<TeachingPopoverTriggerChildProps['aria-expanded']>().toEqualTypeOf<boolean>();
  });

  describe('Trigger', () => {
    it('starts closed as a direct child, toggles the popover and carries aria-haspopup, aria-expanded and aria-controls', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onDismiss = vi.fn();
      render(<TriggerTour onOpenChange={onOpenChange} onDismiss={onDismiss} />);
      await act(async () => {});
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(trigger()).not.toHaveAttribute('aria-controls');

      await user.click(trigger());
      const dialog = await screen.findByRole('dialog', { name: 'Welcome, step 1 of 3' });
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      expect(dialog.id).not.toBe('');
      expect(trigger()).toHaveAttribute('aria-controls', dialog.id);
      expect(onOpenChange.mock.calls).toEqual([[true]]);

      await user.click(trigger());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      expect(trigger()).not.toHaveAttribute('aria-controls');
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('points the popover at the Trigger when target is unset: portaled next to it with a beak', async () => {
      stubViewport();
      const user = userEvent.setup();
      render(<TriggerTour />);
      mockRect(trigger(), rect);
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      expect(dialog).toHaveAttribute('data-side', 'bottom');
      expect(dialog.querySelector('[data-wave-teaching-popover-arrow]')).not.toBeNull();
      await waitFor(() => expect(dialog.style.transform).toBe('translate(250px, 132px)'));
    });

    it('takes its place in the keyboard order after the Trigger and returns focus to it', async () => {
      const user = userEvent.setup();
      render(<TriggerTour />);
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.tab({ shift: true });
      expect(trigger()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    }, 20_000);

    it('returns focus to the Trigger after a custom primary action finishes the tour', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <TriggerTour
          steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]}
          primaryAction="Got it"
          onFinish={onFinish}
          onOpenChange={onOpenChange}
        />,
      );
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(trigger()).toHaveFocus();
    });

    it('a target wins over the Trigger, which still toggles the popover', async () => {
      stubViewport();
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      render(
        <TeachingPopover steps={steps} target={{ getBoundingClientRect: () => rect }}>
          <TeachingPopover.Trigger>
            <Button>Take the tour</Button>
          </TeachingPopover.Trigger>
        </TeachingPopover>,
      );
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.style.transform).toBe('translate(250px, 132px)'));
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
      await user.click(trigger());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it('defaultOpen is false with a direct Trigger, also in a Fragment; an explicit defaultOpen wins', async () => {
      const tour = (defaultOpen?: boolean) => (
        <TeachingPopover steps={steps} defaultOpen={defaultOpen}>
          <>
            <TeachingPopover.Trigger>
              <Button>Take the tour</Button>
            </TeachingPopover.Trigger>
          </>
        </TeachingPopover>
      );
      const closed = render(tour());
      await act(async () => {});
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      closed.unmount();

      render(tour(true));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    });

    it('a Trigger nested in an element leaves defaultOpen at true and is still the target', async () => {
      render(
        <TeachingPopover steps={steps}>
          <div>
            <TeachingPopover.Trigger>
              <Button>Take the tour</Button>
            </TeachingPopover.Trigger>
          </div>
        </TeachingPopover>,
      );
      const dialog = await screen.findByRole('dialog');
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      await waitFor(() => expect(dialog).toHaveFocus());
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    });

    it('fires onOpenChange once per click under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <TriggerTour onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.click(trigger());
      await screen.findByRole('dialog');
      expect(onOpenChange.mock.calls).toEqual([[true]]);
    });

    it('passes the trigger props to a render-prop child', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover steps={steps}>
          <TeachingPopover.Trigger>
            {(props) => (
              <button type="button" {...props}>
                Take the tour
              </button>
            )}
          </TeachingPopover.Trigger>
        </TeachingPopover>,
      );
      expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger()).toHaveAttribute('aria-expanded', 'false');
      await user.click(trigger());
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    });

    it('has no axe violations closed and open', async () => {
      const user = userEvent.setup();
      render(<TriggerTour />);
      await expectNoA11yViolations();
      await user.click(trigger());
      await screen.findByRole('dialog');
      await expectNoA11yViolations();
    });
  });

  describe('opening again: an uncontrolled step starts over', () => {
    type User = ReturnType<typeof userEvent.setup>;
    const button = (name: string) => screen.getByRole('button', { name });
    const openWithTrigger = async (user: User, name: string) => {
      await user.click(trigger());
      return screen.findByRole('dialog', { name });
    };

    it('a tour finished with Done starts on the first step when the Trigger opens it again', async () => {
      const user = userEvent.setup();
      render(<TriggerTour />);
      await openWithTrigger(user, 'Welcome, step 1 of 3');
      await user.click(button('Next'));
      await user.click(button('Next'));
      await user.click(button('Done'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const dialog = await openWithTrigger(user, 'Welcome, step 1 of 3');
      await waitFor(() => expect(dialog).toHaveFocus());
      expect(button('Back')).toHaveAttribute('aria-disabled', 'true');
    });

    it.each<[string, (user: User) => Promise<void>]>([
      ['Close', (user) => user.click(button('Close'))],
      ['Escape', (user) => user.keyboard('{Escape}')],
      ['the Trigger', (user) => user.click(trigger())],
    ])(
      'a tour closed midway with %s starts on the first step when it opens again',
      async (_name, close) => {
        const user = userEvent.setup();
        render(<TriggerTour />);
        await openWithTrigger(user, 'Welcome, step 1 of 3');
        await user.click(button('Next'));
        expect(heading()).toHaveTextContent('Features, step 2 of 3');
        await close(user);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await openWithTrigger(user, 'Welcome, step 1 of 3');
        expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
      },
    );

    it('starts again on defaultActiveStep', async () => {
      const user = userEvent.setup();
      render(<TriggerTour defaultActiveStep={1} />);
      await openWithTrigger(user, 'Features, step 2 of 3');
      await user.click(button('Next'));
      expect(heading()).toHaveTextContent('Done, step 3 of 3');
      await user.click(button('Close'));

      await openWithTrigger(user, 'Features, step 2 of 3');
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
    });

    it('a controlled open that opens it again shows the first step from its first commit and announces nothing', async () => {
      const user = userEvent.setup();
      // Every commit of a step body, by its step title.
      const commits: string[] = [];
      function Probe({ name }: { name: string }) {
        React.useLayoutEffect(() => {
          commits.push(name);
        });
        return <>{`${name} body`}</>;
      }
      const probedSteps = steps.map((step) => ({ ...step, body: <Probe name={step.title} /> }));
      function Tour() {
        const [open, setOpen] = React.useState(true);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Start tour
            </button>
            <TeachingPopover steps={probedSteps} open={open} onOpenChange={setOpen} />
          </>
        );
      }
      // The live region is written on the next animation frame: wait well past it.
      const afterFrames = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      render(<Tour />);
      await user.click(button('Next'));
      await user.click(button('Next'));
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Done, step 3 of 3'));
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      commits.length = 0;

      await user.click(button('Start tour'));
      const dialog = screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' });
      expect(dialog).toHaveFocus();
      expect(commits.length).toBeGreaterThan(0);
      expect(new Set(commits)).toEqual(new Set(['Welcome']));
      // The focused dialog's name carries the step position: opening is not a step change.
      await afterFrames();
      expect(__getAnnouncerText('polite')).toBe('Done, step 3 of 3');
    });

    it('leaves a controlled activeStep as it is', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      function Controlled() {
        const [step, setStep] = React.useState(0);
        return (
          <TriggerTour
            activeStep={step}
            onStepChange={(next) => {
              onStepChange(next);
              setStep(next);
            }}
          />
        );
      }
      render(<Controlled />);
      await openWithTrigger(user, 'Welcome, step 1 of 3');
      await user.click(button('Next'));
      await user.click(button('Close'));

      await openWithTrigger(user, 'Features, step 2 of 3');
      expect(onStepChange.mock.calls).toEqual([[1]]);
    });

    it('calls onStepChange with the initial step once when opening moves the step back, also under StrictMode', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <React.StrictMode>
          <TriggerTour onStepChange={onStepChange} />
        </React.StrictMode>,
      );
      await openWithTrigger(user, 'Welcome, step 1 of 3');
      expect(onStepChange).not.toHaveBeenCalled();
      await user.click(button('Next'));
      expect(onStepChange.mock.calls).toEqual([[1]]);
      await user.click(button('Close'));

      await openWithTrigger(user, 'Welcome, step 1 of 3');
      expect(onStepChange.mock.calls).toEqual([[1], [0]]);

      // Opening again on the initial step changes nothing, so nothing is called.
      await user.click(button('Close'));
      await openWithTrigger(user, 'Welcome, step 1 of 3');
      expect(onStepChange.mock.calls).toEqual([[1], [0]]);
    });

    it('does not call onStepChange on the first mount', async () => {
      const onStepChange = vi.fn();
      render(
        <React.StrictMode>
          <TeachingPopover steps={steps} defaultActiveStep={1} onStepChange={onStepChange} />
        </React.StrictMode>,
      );
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      await act(async () => {});
      expect(onStepChange).not.toHaveBeenCalled();
    });
  });

  describe('Surface', () => {
    function InRoot({ children }: { children?: React.ReactNode }) {
      return <TeachingPopover steps={steps}>{children}</TeachingPopover>;
    }

    testSystemProps(TeachingPopoverSurface, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverSurface',
      wrapper: InRoot,
      conflictingClass: { className: 'w-96', overrides: 'w-80' },
    });

    it('is the one role="dialog" surface and carries the stable classes of both', () => {
      render(
        <InRoot>
          <TeachingPopover.Surface />
        </InRoot>,
      );
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]).toHaveClass(
        teachingPopoverClassNames.root,
        teachingPopoverSurfaceClassNames.root,
      );
    });

    it('renders the content of the steps form when it has no children: one surface for both forms', () => {
      const normalize = (html: string) => html.replace(/\b(id|aria-labelledby)="[^"]*"/g, '$1=""');
      const attributes = (el: HTMLElement) => Array.from(el.attributes, (attr) => attr.name).sort();
      const plain = render(
        <TeachingPopover steps={steps} activeStep={1} footerLayout="vertical" />,
      );
      const expected = screen.getByRole('dialog');
      const expectedHtml = normalize(expected.innerHTML);
      const expectedAttributes = attributes(expected);
      plain.unmount();

      render(
        <TeachingPopover steps={steps} activeStep={1} footerLayout="vertical">
          <TeachingPopover.Surface />
        </TeachingPopover>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Features, step 2 of 3' });
      expect(normalize(dialog.innerHTML)).toBe(expectedHtml);
      expect(attributes(dialog)).toEqual(expectedAttributes);
      expect(dialog).toHaveAttribute('data-layout', 'vertical');
    });

    it('shares one state with the root: steps, labels, focus, announcements and dismissal', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onDismiss = vi.fn();
      render(
        <TeachingPopover
          steps={steps}
          onStepChange={onStepChange}
          onDismiss={onDismiss}
          labels={{ next: 'Neste' }}
        >
          <TeachingPopover.Surface />
        </TeachingPopover>,
      );
      expect(screen.getByRole('dialog')).toHaveFocus();
      await user.click(screen.getByRole('button', { name: 'Neste' }));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders its children instead of the default content', () => {
      render(
        <InRoot>
          <TeachingPopover.Surface aria-label="Shortcuts">
            <p>Press Ctrl+K.</p>
          </TeachingPopover.Surface>
        </InRoot>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Shortcuts' });
      expect(dialog).toHaveTextContent('Press Ctrl+K.');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
      expect(within(dialog).queryByRole('heading')).toBeNull();
    });

    it('with a Trigger: the anchored surface takes the Surface props, and aria-controls follows its id', async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();
      render(
        <TeachingPopover steps={steps}>
          <TeachingPopover.Trigger>
            <Button>Take the tour</Button>
          </TeachingPopover.Trigger>
          <TeachingPopover.Surface ref={ref} id="tour" className="w-96" data-testid="surface" />
        </TeachingPopover>,
      );
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBe(ref.current);
      expect(dialog).toBe(screen.getByTestId('surface'));
      expect(dialog).toHaveClass('w-96');
      expect(dialog).not.toHaveClass('w-80');
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      expect(dialog).toHaveAttribute('id', 'tour');
      expect(trigger()).toHaveAttribute('aria-controls', 'tour');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it('ignores the surface props of the root next to a Surface, with a development warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ref = React.createRef<HTMLDivElement>();
      render(
        <TeachingPopover steps={steps} className="w-96" data-testid="root" ref={ref}>
          <TeachingPopover.Surface />
        </TeachingPopover>,
      );
      expect(screen.getByRole('dialog')).not.toHaveClass('w-96');
      expect(screen.queryByTestId('root')).toBeNull();
      expect(ref.current).toBeNull();
      expect(warn.mock.calls).toEqual([[SURFACE_PROPS_WARNING]]);
    });

    it('warns TeachingPopover.Surface:placement for a second Surface, also one inside a component', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function MySurface() {
        return <TeachingPopover.Surface data-testid="mine" />;
      }
      const wrapped = render(
        <InRoot>
          <TeachingPopover.Surface />
          <MySurface />
        </InRoot>,
      );
      expect(screen.getAllByRole('dialog')).toHaveLength(2);
      expect(warn.mock.calls).toEqual([[PLACEMENT_WARNING]]);
      wrapped.unmount();
      warn.mockClear();
      __resetWarnings();

      render(
        <InRoot>
          <TeachingPopover.Surface />
          <TeachingPopover.Surface />
        </InRoot>,
      );
      expect(warn.mock.calls).toEqual([[PLACEMENT_WARNING]]);
    });
  });

  describe('outside a TeachingPopover (C-CONTEXT)', () => {
    it('a part throws in development', () => {
      expectThrows(
        <TeachingPopover.Surface />,
        '[WaveUI] TeachingPopover.Surface must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.Trigger>
          <button type="button">Take the tour</button>
        </TeachingPopover.Trigger>,
        '[WaveUI] TeachingPopover.Trigger must be used within TeachingPopover',
      );
    });

    it('in production, a part logs once and renders inert', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = (tick: number) => (
        <>
          <TeachingPopover.Trigger>
            <button type="button">Take the tour {tick}</button>
          </TeachingPopover.Trigger>
          <TeachingPopover.Surface />
        </>
      );
      const { rerender } = render(ui(0));
      rerender(ui(1));
      expect(error.mock.calls).toEqual([
        ['[WaveUI] TeachingPopover.Trigger must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.Surface must be used within TeachingPopover'],
      ]);
      expect(screen.getByRole('button', { name: 'Take the tour 1' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('parts written in a Server Component', () => {
    // A client component written in a Server Component reaches the client as a lazy reference.
    const plainParts = { Trigger: TeachingPopoverTrigger, Surface: TeachingPopoverSurface };
    const lazyParts = {
      Trigger: asClientReference(TeachingPopoverTrigger),
      Surface: asClientReference(TeachingPopoverSurface),
    };

    function InlineTip({ parts }: { parts: typeof plainParts }) {
      return (
        <TeachingPopover steps={steps}>
          <parts.Surface className="w-96" />
        </TeachingPopover>
      );
    }

    function Tour({ parts }: { parts: typeof plainParts }) {
      return (
        <TeachingPopover steps={steps}>
          <parts.Trigger>
            <Button>Take the tour</Button>
          </parts.Trigger>
          <parts.Surface />
        </TeachingPopover>
      );
    }

    it('server-renders the same HTML as with the plain part types', () => {
      const tip = renderToString(<InlineTip parts={plainParts} />);
      expect(tip).toContain('Welcome');
      expect(tip.match(/role="dialog"/g)).toHaveLength(1);
      expect(renderToString(<InlineTip parts={lazyParts} />)).toBe(tip);

      const tour = renderToString(<Tour parts={plainParts} />);
      expect(tour).toContain('Take the tour');
      expect(tour).toContain('aria-expanded="false"');
      expect(tour).not.toContain('role="dialog"');
      expect(renderToString(<Tour parts={lazyParts} />)).toBe(tour);
    });

    it('a lazy Trigger and Surface start closed, open from the trigger and close like the plain parts', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      render(<Tour parts={lazyParts} />);
      await act(async () => {});
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog', { name: 'Welcome, step 1 of 3' });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe('TeachingPopover parts: a Surface in your component, focus return and module imports (P9-08)', () => {
  const SURFACE_PROPS_WARNING =
    '[WaveUI] TeachingPopover: the props of the surface element on TeachingPopover (`className`, `style`, `ref`, `onKeyDown`, `motion` and the other element props) are ignored next to a TeachingPopover.Surface: pass them to the Surface.';

  const trigger = () => screen.getByRole('button', { name: 'Take the tour' });

  /** A Surface rendered by a component of the consumer's, not a direct child of TeachingPopover. */
  function MySurface(props: TeachingPopoverSurfaceProps) {
    return <TeachingPopover.Surface data-testid="mine" {...props} />;
  }

  describe('a Surface rendered by your component', () => {
    it("replaces the popover's own surface: one dialog, one title id, focused once, no warning", async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      const focus = vi.spyOn(HTMLElement.prototype, 'focus');
      const onDismiss = vi.fn();
      render(
        <TeachingPopover steps={steps} onDismiss={onDismiss}>
          <MySurface />
        </TeachingPopover>,
      );
      await act(async () => {});
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]).toBe(screen.getByTestId('mine'));
      expect(dialogs[0]).toHaveFocus();
      const focusedDialogs = focus.mock.contexts.filter(
        (element) => element instanceof HTMLElement && element.getAttribute('role') === 'dialog',
      );
      expect(focusedDialogs).toEqual([dialogs[0]]);
      expect(document.querySelectorAll(`[id="${heading().id}"]`)).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(warn).not.toHaveBeenCalled();
    });

    it("drops the popover's own surface under StrictMode too", async () => {
      render(
        <React.StrictMode>
          <TeachingPopover steps={steps}>
            <MySurface />
          </TeachingPopover>
        </React.StrictMode>,
      );
      await act(async () => {});
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.getByTestId('mine')).toHaveFocus();
    });

    it('with a Trigger it is the anchored surface, and aria-controls follows its id, also when it mounts open', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover steps={steps} defaultOpen>
          <TeachingPopover.Trigger>
            <Button>Take the tour</Button>
          </TeachingPopover.Trigger>
          <MySurface id="tour" />
        </TeachingPopover>,
      );
      const dialog = await screen.findByRole('dialog');
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(dialog).toHaveAttribute('id', 'tour');
      expect(dialog.closest('[data-wave-portal]')).not.toBeNull();
      expect(trigger()).toHaveAttribute('aria-controls', 'tour');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it("brings back the popover's own surface when it unmounts", async () => {
      const { rerender } = render(
        <TeachingPopover steps={steps}>
          <MySurface />
        </TeachingPopover>,
      );
      expect(screen.getByTestId('mine')).toBeInTheDocument();
      rerender(<TeachingPopover steps={steps}>{null}</TeachingPopover>);
      await act(async () => {});
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(screen.queryByTestId('mine')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBeInTheDocument();
    });

    it("ignores the root's element props next to it, with the development warning", () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <TeachingPopover steps={steps} className="w-96">
          <MySurface />
        </TeachingPopover>,
      );
      expect(screen.getByRole('dialog')).not.toHaveClass('w-96');
      expect(warn.mock.calls).toEqual([[SURFACE_PROPS_WARNING]]);
    });
  });

  describe('focus return with a target and a Trigger', () => {
    function stubViewport() {
      const html = document.documentElement;
      Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
      Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
      onTestFinished(() => {
        Reflect.deleteProperty(html, 'clientWidth');
        Reflect.deleteProperty(html, 'clientHeight');
      });
    }

    it('returns focus to the Trigger, not to the target, as Popover.Trigger does', async () => {
      stubViewport();
      const user = userEvent.setup();
      function Tour() {
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
      render(<Tour />);
      mockRect(screen.getByRole('button', { name: 'Search' }), {
        x: 200,
        y: 100,
        width: 100,
        height: 20,
        top: 100,
        right: 300,
        bottom: 120,
        left: 200,
      });
      // A click that does not focus the trigger (a button in Safari): nothing has focus at open.
      fireEvent.click(trigger());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });
  });

  it('keeps the split one-way: nothing imports TeachingPopover.tsx, and the context module imports no component', () => {
    const sources = import.meta.glob<string>(
      [
        '../../**/*.{ts,tsx}',
        '../../../hooks/**/*.{ts,tsx}',
        '../../../lib/**/*.{ts,tsx}',
        '!**/__tests__/**',
      ],
      { query: '?raw', import: 'default', eager: true },
    );
    const entries = Object.entries(sources);
    expect(entries.length).toBeGreaterThan(100);
    const importers = entries
      .filter(([path]) => !/\/index\.ts$/.test(path))
      .filter(([, source]) => /from\s+['"][^'"]*\/TeachingPopover['"]/.test(source))
      .map(([path]) => path);
    expect(importers).toEqual([]);

    const context = entries.find(([path]) => /\/TeachingPopover\.context\.ts$/.test(path));
    expect(context).toBeDefined();
    const specifiers = [...(context?.[1] ?? '').matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
      ([, specifier]) => specifier,
    );
    expect(specifiers.length).toBeGreaterThan(0);
    expect(
      specifiers.filter(
        (specifier) =>
          specifier !== 'react' &&
          !specifier.startsWith('../../lib/') &&
          !specifier.startsWith('../../hooks/'),
      ),
    ).toEqual([]);
  });
});

describe('TeachingPopover parts: Header, Title, Body and Footer (P9-08)', () => {
  const MERGE_WARNING =
    '[WaveUI] TeachingPopover.Header: `dismissButton` received a button element; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `dismissButton={<CloseIcon />}`.';

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** The four parts without children: the content of the `steps` form. */
  const defaultParts = (
    <>
      <TeachingPopover.Header />
      <TeachingPopover.Title />
      <TeachingPopover.Body />
      <TeachingPopover.Footer />
    </>
  );

  /** A tour whose surface is built from parts (the four parts without children by default). */
  function PartsTour({
    surface,
    children = defaultParts,
    ...props
  }: Partial<TeachingPopoverProps> & { surface?: TeachingPopoverSurfaceProps }) {
    return (
      <TeachingPopover steps={steps} {...props}>
        <TeachingPopover.Surface {...surface}>{children}</TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  /** A surface named by its own label, for a part tested on its own. */
  function InSurface({ children }: { children?: React.ReactNode }) {
    return (
      <TeachingPopover steps={steps}>
        <TeachingPopover.Surface aria-label="Tour">{children}</TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  testCompoundExposure(TeachingPopover, ['Header', 'Title', 'Body', 'Footer']);

  it('exports the parts under their flat names for React Server Components (C-COMPOUND)', () => {
    expect(TeachingPopoverHeader).toBeTypeOf('function');
    expect(TeachingPopoverHeader).toBe(TeachingPopover.Header);
    expect(TeachingPopoverTitle).toBeTypeOf('function');
    expect(TeachingPopoverTitle).toBe(TeachingPopover.Title);
    expect(TeachingPopoverBody).toBeTypeOf('function');
    expect(TeachingPopoverBody).toBe(TeachingPopover.Body);
    expect(TeachingPopoverFooter).toBeTypeOf('function');
    expect(TeachingPopoverFooter).toBe(TeachingPopover.Footer);
  });

  it('types the parts', () => {
    expectTypeOf<TeachingPopoverHeaderProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TeachingPopoverHeaderProps['dismissButton']>().toEqualTypeOf<
      Slot<'span'> | undefined
    >();
    expectTypeOf<TeachingPopoverHeaderProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<TeachingPopoverBodyProps['media']>().toEqualTypeOf<Slot<'span'> | undefined>();
    expectTypeOf<TeachingPopoverFooterProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<TeachingPopoverTitleProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLHeadingElement> | undefined
    >();
    expectTypeOf<TeachingPopoverTitleProps<'p'>['ref']>().toEqualTypeOf<
      React.Ref<HTMLParagraphElement> | undefined
    >();
    // @ts-expect-error -- a heading has no href; `as="a"` would take one
    expectTypeOf<TeachingPopoverTitleProps>().toHaveProperty('href');
    expectTypeOf<TeachingPopoverTitleProps<'a'>>().toHaveProperty('href');
  });

  describe('defaults from the current step (Pattern 15)', () => {
    it.each<[string, Partial<TeachingPopoverProps>]>([
      ['the first step', {}],
      ['a middle step with the vertical footer', { activeStep: 1, footerLayout: 'vertical' }],
      [
        'the last step with actions',
        { activeStep: 2, primaryAction: <Button>Finish</Button>, secondaryAction: 'Skip' },
      ],
      ['a single step', { steps: [{ title: 'Tip', body: 'Press Ctrl+K.' }] }],
      ['localized text', { activeStep: 1, closeLabel: 'Lukk', labels: { next: 'Neste' } }],
    ])('the parts without children render what the steps form renders: %s', (_name, props) => {
      const normalize = (html: string) => html.replace(/\b(id|aria-labelledby)="[^"]*"/g, '$1=""');
      const plain = render(<TeachingPopover steps={steps} {...props} />);
      const expected = normalize(screen.getByRole('dialog').innerHTML);
      const expectedName = heading().textContent;
      plain.unmount();

      render(<PartsTour {...props} />);
      const dialog = screen.getByRole('dialog');
      expect(normalize(dialog.innerHTML)).toBe(expected);
      expect(dialog).toHaveAttribute('aria-labelledby', heading().id);
      expect(heading().textContent).toBe(expectedName);
    });

    it('each part shows the current step and follows it', async () => {
      const user = userEvent.setup();
      render(<PartsTour closeLabel="Lukk" />);
      const dialog = screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' });
      expect(within(dialog).getByRole('button', { name: 'Lukk' })).toHaveClass(
        teachingPopoverClassNames.closeButton,
      );
      expect(within(dialog).getByText('This is step one.')).toHaveClass(
        teachingPopoverBodyClassNames.root,
      );
      expect(dots()).toHaveLength(3);
      await user.click(within(dialog).getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      expect(within(dialog).getByText('Here are the features.')).toBeInTheDocument();
      expect(dots()[1]).toHaveAttribute('aria-current', 'step');
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));
    });

    it('children that render nothing keep the defaults', () => {
      render(
        <PartsTour>
          <TeachingPopover.Header>{''}</TeachingPopover.Header>
          <TeachingPopover.Title>{[]}</TeachingPopover.Title>
          <TeachingPopover.Body>{false}</TeachingPopover.Body>
          <TeachingPopover.Footer>{null}</TeachingPopover.Footer>
        </PartsTour>,
      );
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBeInTheDocument();
      expect(screen.getByText('This is step one.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' }).parentElement).toHaveClass(
        teachingPopoverHeaderClassNames.root,
      );
    });

    it('children replace the default content of each part', () => {
      render(
        <PartsTour>
          <TeachingPopover.Header>Tip</TeachingPopover.Header>
          <TeachingPopover.Title>Search anything</TeachingPopover.Title>
          <TeachingPopover.Body>
            <p>Press Ctrl+K.</p>
          </TeachingPopover.Body>
          <TeachingPopover.Footer>
            <Button>Got it</Button>
          </TeachingPopover.Footer>
        </PartsTour>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Search anything, step 1 of 3' });
      expect(within(dialog).getByText('Tip')).toHaveClass(teachingPopoverHeaderClassNames.root);
      expect(within(dialog).queryByText('Welcome')).toBeNull();
      expect(within(dialog).queryByText('This is step one.')).toBeNull();
      expect(within(dialog).getByText('Press Ctrl+K.')).toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: 'Next' })).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
      expect(dots()).toHaveLength(0);
      expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    testSystemProps(TeachingPopoverHeader, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverHeader',
      wrapper: InSurface,
      defaultProps: { children: 'Tip' },
      conflictingClass: { className: 'mb-4', overrides: 'mb-2' },
    });

    it('renders a decorative icon and its text in a row, with the Close button', () => {
      render(
        <PartsTour>
          <TeachingPopover.Header icon={<svg data-testid="bulb" />}>Tip</TeachingPopover.Header>
          <TeachingPopover.Title />
        </PartsTour>,
      );
      const icon = screen.getByTestId('bulb').parentElement;
      expect(icon).toHaveClass(teachingPopoverHeaderClassNames.icon);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      const header = icon?.parentElement;
      expect(header).toHaveClass(teachingPopoverHeaderClassNames.root);
      expect(header).toHaveTextContent('Tip');
      expect(within(header as HTMLElement).getByRole('button', { name: 'Close' })).toHaveClass(
        teachingPopoverClassNames.closeButton,
        buttonClassNames.root,
      );
    });

    it('an icon slot object keeps the icon class on its element', () => {
      render(
        <PartsTour>
          <TeachingPopover.Header icon={{ as: 'i', children: '*', className: 'text-error' }}>
            Tip
          </TeachingPopover.Header>
          <TeachingPopover.Title />
        </PartsTour>,
      );
      const icon = screen.getByText('*');
      expect(icon.tagName).toBe('I');
      expect(icon).toHaveClass(teachingPopoverHeaderClassNames.icon, 'text-error');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('dismisses from its Close button: closes, then onDismiss, once under StrictMode', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <PartsTour onDismiss={onDismiss} onOpenChange={onOpenChange} />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    describe('dismissButton (C-SLOTS dismiss slot)', () => {
      it('renders icon content inside the wired Close button', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(
          <PartsTour onDismiss={onDismiss}>
            <TeachingPopover.Header dismissButton={<svg data-testid="x" />} />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        const close = screen.getByRole('button', { name: 'Close' });
        expect(close).toContainElement(screen.getByTestId('x'));
        expect(close.querySelector('[data-wave-icon]')).toBeNull();
        await user.click(close);
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });

      it('null renders no Close button; undefined keeps it', () => {
        const { rerender } = render(
          <PartsTour>
            <TeachingPopover.Header dismissButton={null} />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
        rerender(
          <PartsTour>
            <TeachingPopover.Header dismissButton={undefined} />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      });

      it('merges a Button onto the wired Close button: its text names it (Label in Name) and its handler runs first', async () => {
        const user = userEvent.setup();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const order: string[] = [];
        render(
          <PartsTour onDismiss={() => order.push('onDismiss')}>
            <TeachingPopover.Header
              dismissButton={
                <Button
                  data-testid="dismiss"
                  className="ms-1"
                  onClick={() => order.push('onClick')}
                >
                  Dismiss tip
                </Button>
              }
            />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        const close = screen.getByRole('button', { name: 'Dismiss tip' });
        expect(close).toBe(screen.getByTestId('dismiss'));
        expect(close).not.toHaveAttribute('aria-label');
        expect(close.querySelector('button')).toBeNull();
        expect(close).toHaveClass(teachingPopoverClassNames.closeButton, 'ms-1');
        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
        await user.click(close);
        expect(order).toEqual(['onClick', 'onDismiss']);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
      });

      it('a merged button without a text label keeps closeLabel; its own aria-label wins', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { rerender } = render(
          <PartsTour closeLabel="Lukk">
            <TeachingPopover.Header
              dismissButton={
                <button type="button">
                  <svg data-testid="x" />
                </button>
              }
            />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        expect(screen.getByRole('button', { name: 'Lukk' })).toContainElement(
          screen.getByTestId('x'),
        );
        rerender(
          <PartsTour closeLabel="Lukk">
            <TeachingPopover.Header
              dismissButton={<Button aria-label="Hide the tip" icon={<svg />} />}
            />
            <TeachingPopover.Title />
          </PartsTour>,
        );
        expect(screen.getByRole('button', { name: 'Hide the tip' })).toBeInTheDocument();
        expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
      });
    });
  });

  describe('Title', () => {
    testSystemProps(TeachingPopoverTitle, {
      expectedTag: 'h3',
      displayName: 'TeachingPopoverTitle',
      wrapper: InSurface,
      polymorphic: true,
      conflictingClass: { className: 'mb-4', overrides: 'mb-2' },
    });

    it('carries TeachingPopover’s title class and the hidden step position, also with children', async () => {
      const user = userEvent.setup();
      render(
        <PartsTour labels={{ step: (index, count) => `steg ${index + 1} av ${count}` }}>
          <TeachingPopover.Title>Search</TeachingPopover.Title>
          <TeachingPopover.Footer />
        </PartsTour>,
      );
      expect(heading()).toHaveClass(
        teachingPopoverTitleClassNames.root,
        teachingPopoverClassNames.title,
      );
      expect(heading()).toHaveTextContent('Search, steg 1 av 3');
      expect(heading().querySelector('.sr-only')).toHaveTextContent(', steg 1 av 3');
      expect(screen.getByRole('dialog', { name: 'Search, steg 1 av 3' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent('Search, steg 2 av 3');
    });

    it('renders the element of `as`, which names the surface, and takes a ref', () => {
      const ref = React.createRef<HTMLHeadingElement>();
      render(
        <PartsTour>
          <TeachingPopover.Title as="h2" ref={ref} />
        </PartsTour>,
      );
      const title = screen.getByRole('heading', { level: 2, name: 'Welcome, step 1 of 3' });
      expect(ref.current).toBe(title);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
    });

    it('names a Surface with children by its id; without a Title the surface has no aria-labelledby', () => {
      const { rerender } = render(
        <PartsTour>
          <TeachingPopover.Body>
            <TeachingPopover.Title id="tip-title" />
            Press Ctrl+K.
          </TeachingPopover.Body>
        </PartsTour>,
      );
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toHaveAttribute(
        'aria-labelledby',
        'tip-title',
      );
      rerender(
        <PartsTour surface={{ 'aria-label': 'Tip' }}>
          <TeachingPopover.Body>Press Ctrl+K.</TeachingPopover.Body>
        </PartsTour>,
      );
      expect(screen.getByRole('dialog', { name: 'Tip' })).not.toHaveAttribute('aria-labelledby');
      expect(findDanglingIdRefs()).toEqual([]);
    });

    it('the title of a popover inside another surface names only its own surface', () => {
      // The inner popover comes first: a title of it registering with the outer surface would
      // name the outer one.
      render(
        <PartsTour>
          <TeachingPopover steps={[{ title: 'Inner', body: 'Nested tip.' }]} />
          <TeachingPopover.Title id="outer-title" />
        </PartsTour>,
      );
      const [outer, inner] = screen.getAllByRole('dialog');
      expect(outer).toHaveAttribute('aria-labelledby', 'outer-title');
      expect(inner).toHaveAccessibleName('Inner, step 1 of 1');
    });
  });

  describe('Body', () => {
    testSystemProps(TeachingPopoverBody, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverBody',
      wrapper: InSurface,
      conflictingClass: { className: 'mb-2', overrides: 'mb-4' },
    });

    it('carries TeachingPopover’s body class and renders `media` before its content, as content', () => {
      render(
        <PartsTour>
          <TeachingPopover.Title />
          <TeachingPopover.Body media={<img src="tour.png" alt="The search box" />} />
        </PartsTour>,
      );
      const body = screen.getByText('This is step one.');
      expect(body).toHaveClass(teachingPopoverBodyClassNames.root, teachingPopoverClassNames.body);
      const media = screen.getByRole('img', { name: 'The search box' }).parentElement;
      expect(media?.tagName).toBe('SPAN');
      expect(media).toHaveClass(teachingPopoverBodyClassNames.media);
      expect(media).not.toHaveAttribute('aria-hidden');
      expect(body.firstElementChild).toBe(media);
    });

    it('a media slot object keeps the media class on its element', () => {
      render(
        <PartsTour>
          <TeachingPopover.Title />
          <TeachingPopover.Body
            media={{
              as: 'figure',
              className: 'aspect-video',
              children: <img src="tour.png" alt="The search box" />,
            }}
          />
        </PartsTour>,
      );
      const media = screen.getByRole('img', { name: 'The search box' }).parentElement;
      expect(media?.tagName).toBe('FIGURE');
      expect(media).toHaveClass(teachingPopoverBodyClassNames.media, 'aspect-video');
    });
  });

  describe('Footer', () => {
    testSystemProps(TeachingPopoverFooter, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverFooter',
      wrapper: InSurface,
      conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
    });

    it('carries TeachingPopover’s footer class and data-layout, with the step dots and buttons', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const { rerender } = render(
        <PartsTour onStepChange={onStepChange}>
          <TeachingPopover.Title />
          <TeachingPopover.Footer data-testid="footer" />
        </PartsTour>,
      );
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass(
        teachingPopoverFooterClassNames.root,
        teachingPopoverClassNames.footer,
      );
      expect(footer).toHaveAttribute('data-layout', 'horizontal');
      expect(within(footer).getByRole('button', { name: 'Back' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await user.click(within(footer).getByRole('button', { name: 'Next' }));
      expect(onStepChange).toHaveBeenLastCalledWith(1);
      rerender(
        <PartsTour onStepChange={onStepChange} footerLayout="vertical">
          <TeachingPopover.Title />
          <TeachingPopover.Footer data-testid="footer" />
        </PartsTour>,
      );
      expect(screen.getByTestId('footer')).toHaveAttribute('data-layout', 'vertical');
    });
  });

  it('has no axe violations for a tour built from parts', async () => {
    render(
      <PartsTour activeStep={1}>
        <TeachingPopover.Header icon={<svg />}>Tip</TeachingPopover.Header>
        <TeachingPopover.Body media={<img src="tour.png" alt="The search box" />}>
          <TeachingPopover.Title as="h2" />
          <p>Press Ctrl+K.</p>
        </TeachingPopover.Body>
        <TeachingPopover.Footer />
      </PartsTour>,
    );
    expect(screen.getByRole('dialog', { name: 'Features, step 2 of 3' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  describe('outside a TeachingPopover (C-CONTEXT)', () => {
    it('each part throws in development', () => {
      expectThrows(
        <TeachingPopover.Header />,
        '[WaveUI] TeachingPopover.Header must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.Title />,
        '[WaveUI] TeachingPopover.Title must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.Body />,
        '[WaveUI] TeachingPopover.Body must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.Footer />,
        '[WaveUI] TeachingPopover.Footer must be used within TeachingPopover',
      );
    });

    it('in production, each part logs once and renders nothing', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = (tick: number) => (
        <div data-tick={tick}>
          <TeachingPopover.Header />
          <TeachingPopover.Title />
          <TeachingPopover.Body />
          <TeachingPopover.Footer />
        </div>
      );
      const { container, rerender } = render(ui(0));
      rerender(ui(1));
      expect(error.mock.calls).toEqual([
        ['[WaveUI] TeachingPopover.Header must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.Title must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.Body must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.Footer must be used within TeachingPopover'],
      ]);
      expect(container.firstElementChild).toBeEmptyDOMElement();
    });
  });

  describe('parts written in a Server Component', () => {
    // A client component written in a Server Component reaches the client as a lazy reference.
    const plainParts = {
      Surface: TeachingPopoverSurface,
      Header: TeachingPopoverHeader,
      Title: TeachingPopoverTitle,
      Body: TeachingPopoverBody,
      Footer: TeachingPopoverFooter,
    };
    const lazyParts = {
      Surface: asClientReference(TeachingPopoverSurface),
      Header: asClientReference(TeachingPopoverHeader),
      Title: asClientReference(TeachingPopoverTitle),
      Body: asClientReference(TeachingPopoverBody),
      Footer: asClientReference(TeachingPopoverFooter),
    };

    function Tip({ parts }: { parts: typeof plainParts }) {
      return (
        <TeachingPopover steps={steps} activeStep={1}>
          <parts.Surface>
            <parts.Header icon={<svg />}>Tip</parts.Header>
            <parts.Title as="h2" />
            <parts.Body media={<img src="tour.png" alt="" />} />
            <parts.Footer />
          </parts.Surface>
        </TeachingPopover>
      );
    }

    it('server-renders the same HTML as with the plain part types', () => {
      const html = renderToString(<Tip parts={plainParts} />);
      expect(html).toContain('Features');
      expect(html).toContain(teachingPopoverHeaderClassNames.root);
      expect(html).toContain(teachingPopoverFooterClassNames.root);
      expect(renderToString(<Tip parts={lazyParts} />)).toBe(html);
    });

    it('lazy parts render the defaults, name the surface and dismiss', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      function LazyTour() {
        return (
          <TeachingPopover steps={steps} onDismiss={onDismiss}>
            <lazyParts.Surface>
              <lazyParts.Header />
              <lazyParts.Title />
              <lazyParts.Body />
              <lazyParts.Footer />
            </lazyParts.Surface>
          </TeachingPopover>
        );
      }
      render(<LazyTour />);
      await act(async () => {});
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TeachingPopover parts: Carousel, CarouselNav, CarouselPageCount and CarouselFooter (P9-08)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const trigger = () => screen.getByRole('button', { name: 'Take the tour' });
  const nav = () => screen.getByRole('group', { name: 'Choose step' });
  const stepButtons = () => within(nav()).getAllByRole('button');

  /**
   * A three-step tour built only from parts: a caption, then the carousel with the step title and
   * body and the carousel footer, whose indicator is the interactive step buttons by default.
   */
  function CarouselTour({
    withTrigger = false,
    footer,
    indicator = <TeachingPopover.CarouselNav />,
    ...props
  }: Partial<Omit<TeachingPopoverProps, 'children'>> & {
    withTrigger?: boolean;
    footer?: Partial<TeachingPopoverCarouselFooterProps>;
    indicator?: React.ReactNode;
  }) {
    return (
      <TeachingPopover steps={steps} {...props}>
        {withTrigger && (
          <TeachingPopover.Trigger>
            <Button>Take the tour</Button>
          </TeachingPopover.Trigger>
        )}
        <TeachingPopover.Surface>
          <TeachingPopover.Header>Tip</TeachingPopover.Header>
          <TeachingPopover.Carousel>
            <TeachingPopover.Title />
            <TeachingPopover.Body />
            <TeachingPopover.CarouselFooter {...footer}>{indicator}</TeachingPopover.CarouselFooter>
          </TeachingPopover.Carousel>
        </TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  /** A surface named by its own label, for a part tested on its own. */
  function InSurface({ children }: { children?: React.ReactNode }) {
    return (
      <TeachingPopover steps={steps}>
        <TeachingPopover.Surface aria-label="Tour">{children}</TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  testCompoundExposure(TeachingPopover, [
    'Carousel',
    'CarouselNav',
    'CarouselPageCount',
    'CarouselFooter',
  ]);

  it('exports the parts under their flat names for React Server Components (C-COMPOUND)', () => {
    expect(TeachingPopoverCarousel).toBeTypeOf('function');
    expect(TeachingPopoverCarousel).toBe(TeachingPopover.Carousel);
    expect(TeachingPopoverCarouselNav).toBeTypeOf('function');
    expect(TeachingPopoverCarouselNav).toBe(TeachingPopover.CarouselNav);
    expect(TeachingPopoverCarouselPageCount).toBeTypeOf('function');
    expect(TeachingPopoverCarouselPageCount).toBe(TeachingPopover.CarouselPageCount);
    expect(TeachingPopoverCarouselFooter).toBeTypeOf('function');
    expect(TeachingPopoverCarouselFooter).toBe(TeachingPopover.CarouselFooter);
  });

  it('types the parts', () => {
    expectTypeOf<TeachingPopoverCarouselProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselNavProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    // @ts-expect-error -- the step buttons come from `steps`, not from children
    expectTypeOf<TeachingPopoverCarouselNavProps>().toHaveProperty('children');
    expectTypeOf<TeachingPopoverCarouselPageCountProps['children']>().toEqualTypeOf<
      ((current: number, total: number) => React.ReactNode) | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['layout']>().toEqualTypeOf<
      'offset' | 'centered' | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['initialStepText']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<TeachingPopoverCarouselFooterProps['finalStepText']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<TeachingPopoverLabels['nav']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TeachingPopoverLabels['navButton']>().toEqualTypeOf<
      ((index: number, count: number) => string) | undefined
    >();
  });

  it('a three-step tour built entirely from parts advances and finishes, then returns focus to the Trigger', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const onFinish = vi.fn();
    const onDismiss = vi.fn();
    render(
      <CarouselTour
        withTrigger
        footer={{ finalStepText: 'Got it' }}
        onStepChange={onStepChange}
        onFinish={onFinish}
        onDismiss={onDismiss}
      />,
    );
    await user.click(trigger());
    const dialog = await screen.findByRole('dialog', { name: 'Welcome, step 1 of 3' });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(within(dialog).getByText('This is step one.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(heading()).toHaveTextContent('Features, step 2 of 3');
    expect(within(dialog).getByText('Here are the features.')).toBeInTheDocument();
    await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Features, step 2 of 3'));

    await user.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(heading()).toHaveTextContent('Done, step 3 of 3');
    expect(within(dialog).queryByRole('button', { name: 'Next' })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onStepChange.mock.calls).toEqual([[1], [2]]);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveFocus();
  });

  describe('Carousel', () => {
    testSystemProps(TeachingPopoverCarousel, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverCarousel',
      wrapper: InSurface,
    });

    it('without children shows the step title and body and the carousel footer', async () => {
      const user = userEvent.setup();
      render(
        <TeachingPopover steps={steps}>
          <TeachingPopover.Surface>
            <TeachingPopover.Header />
            <TeachingPopover.Carousel data-testid="carousel" />
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      const carousel = screen.getByTestId('carousel');
      expect(carousel).toHaveClass(teachingPopoverCarouselClassNames.root);
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBeInTheDocument();
      expect(within(carousel).getByRole('heading', { level: 3 })).toBe(heading());
      expect(within(carousel).getByText('This is step one.')).toBeInTheDocument();
      const footer = carousel.querySelector(`.${teachingPopoverCarouselFooterClassNames.root}`);
      expect(footer).not.toBeNull();
      expect(dots()).toHaveLength(3);
      expect(footer).toContainElement(dots()[0]);
      expect(within(carousel).getByRole('button', { name: 'Back' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await user.click(within(carousel).getByRole('button', { name: 'Next' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
    });

    it('children replace its default content', () => {
      render(
        <InSurface>
          <TeachingPopover.Carousel>
            <p>Press Ctrl+K.</p>
          </TeachingPopover.Carousel>
        </InSurface>,
      );
      expect(screen.getByText('Press Ctrl+K.').parentElement).toHaveClass(
        teachingPopoverCarouselClassNames.root,
      );
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });
  });

  describe('CarouselNav', () => {
    testSystemProps(TeachingPopoverCarouselNav, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverCarouselNav',
      wrapper: InSurface,
      conflictingClass: { className: 'inline-flex', overrides: 'flex' },
    });

    it('renders a group of step buttons, each named for its step, the current one with aria-current', () => {
      render(<CarouselTour activeStep={1} />);
      expect(nav()).toHaveClass(teachingPopoverCarouselNavClassNames.root);
      const buttons = stepButtons();
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Step 1 of 3',
        'Step 2 of 3',
        'Step 3 of 3',
      ]);
      expect(buttons.map((button) => button.getAttribute('aria-current'))).toEqual([
        null,
        'step',
        null,
      ]);
      for (const button of buttons) {
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveClass(teachingPopoverCarouselNavClassNames.button);
        const indicator = button.firstElementChild;
        expect(indicator).toHaveClass(teachingPopoverCarouselNavClassNames.indicator);
        expect(indicator).toHaveAttribute('aria-hidden', 'true');
      }
      expect(buttons[1].firstElementChild).toHaveClass('w-4', 'bg-primary');
      expect(buttons[0].firstElementChild).toHaveClass('w-1.5', 'bg-stroke-accessible');
    });

    it('keeps its indicators visible in forced colors, the current one in Highlight', () => {
      render(<CarouselTour activeStep={1} />);
      const [first, second, third] = stepButtons().map((button) => button.firstElementChild);
      expect(second).toHaveClass(
        'forced-colors:bg-[Highlight]',
        'forced-colors:forced-color-adjust-none',
      );
      for (const indicator of [first, third]) {
        expect(indicator).toHaveClass(
          'forced-colors:bg-[ButtonText]',
          'forced-colors:forced-color-adjust-none',
        );
        expect(indicator).not.toHaveClass('forced-colors:bg-[Highlight]');
      }
    });

    it('makes every step button a Tab stop, between the Close button and Back', async () => {
      const user = userEvent.setup();
      render(<CarouselTour />);
      expect(screen.getByRole('dialog')).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
      for (const name of ['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3', 'Back', 'Next']) {
        await user.tab();
        expect(screen.getByRole('button', { name })).toHaveFocus();
      }
    });

    it('a step button jumps to its step: onStepChange, the announcement, and focus stays on it', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(<CarouselTour onStepChange={onStepChange} />);
      const third = screen.getByRole('button', { name: 'Step 3 of 3' });
      await user.click(third);
      expect(heading()).toHaveTextContent('Done, step 3 of 3');
      expect(third).toHaveFocus();
      expect(third).toHaveAttribute('aria-current', 'step');
      expect(screen.getByRole('button', { name: 'Step 1 of 3' })).not.toHaveAttribute(
        'aria-current',
      );
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
      await waitFor(() => expect(__getAnnouncerText('polite')).toBe('Done, step 3 of 3'));
      expect(onStepChange.mock.calls).toEqual([[2]]);

      await user.keyboard('{Enter}');
      await user.click(screen.getByRole('button', { name: 'Step 3 of 3' }));
      expect(onStepChange.mock.calls).toEqual([[2]]);
      await user.click(screen.getByRole('button', { name: 'Step 1 of 3' }));
      expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
      expect(onStepChange.mock.calls).toEqual([[2], [0]]);
    });

    it('a controlled activeStep only changes through the parent', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(<CarouselTour activeStep={0} onStepChange={onStepChange} />);
      await user.click(screen.getByRole('button', { name: 'Step 2 of 3' }));
      expect(onStepChange.mock.calls).toEqual([[1]]);
      expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
    });

    it('fires onStepChange once per step button under StrictMode', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(
        <React.StrictMode>
          <CarouselTour onStepChange={onStepChange} />
        </React.StrictMode>,
      );
      await user.click(screen.getByRole('button', { name: 'Step 2 of 3' }));
      expect(onStepChange.mock.calls).toEqual([[1]]);
    });

    it('labels localizes the group and the step buttons (C-NAMING)', () => {
      render(
        <CarouselTour
          labels={{
            nav: 'Velg steg',
            navButton: (index, count) => `Steg ${index + 1} av ${count}`,
          }}
        />,
      );
      const group = screen.getByRole('group', { name: 'Velg steg' });
      expect(
        within(group)
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label')),
      ).toEqual(['Steg 1 av 3', 'Steg 2 av 3', 'Steg 3 av 3']);
    });

    it('keeps the step order in RTL and jumps there too', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CarouselTour />, { dir: 'rtl' });
      expect(stepButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Step 1 of 3',
        'Step 2 of 3',
        'Step 3 of 3',
      ]);
      await user.click(screen.getByRole('button', { name: 'Step 2 of 3' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
    });
  });

  describe('the 0.13 step dots without CarouselNav', () => {
    it('the steps form keeps its decorative dots and has no step buttons', () => {
      render(<TeachingPopover steps={steps} activeStep={1} />);
      expect(dots()).toHaveLength(3);
      expect(dots()[0].parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('group')).toBeNull();
      expect(screen.queryByRole('button', { name: /^Step \d of 3$/ })).toBeNull();
    });

    it('a CarouselFooter without children shows the same decorative dots as the steps form', () => {
      const plain = render(<TeachingPopover steps={steps} activeStep={1} />);
      const expected = dots()[0].parentElement?.outerHTML;
      plain.unmount();

      render(<CarouselTour activeStep={1} indicator={null} />);
      expect(dots()[0].parentElement?.outerHTML).toBe(expected);
      expect(screen.queryByRole('group')).toBeNull();
    });
  });

  describe('CarouselPageCount', () => {
    testSystemProps(TeachingPopoverCarouselPageCount, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverCarouselPageCount',
      wrapper: InSurface,
      conflictingClass: { className: 'text-foreground', overrides: 'text-muted-foreground' },
    });

    it('shows the visible “n of m” and follows the step', async () => {
      const user = userEvent.setup();
      render(
        <CarouselTour indicator={<TeachingPopover.CarouselPageCount data-testid="count" />} />,
      );
      const count = screen.getByTestId('count');
      expect(count).toHaveClass(teachingPopoverCarouselPageCountClassNames.root);
      expect(count).toHaveTextContent(/^1 of 3$/);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(count).toHaveTextContent(/^2 of 3$/);
    });

    it('a render function receives the one-based current step and the total', async () => {
      const user = userEvent.setup();
      const renderCount = vi.fn((current: number, total: number) => `Steg ${current} av ${total}`);
      render(
        <CarouselTour
          indicator={
            <TeachingPopover.CarouselPageCount data-testid="count">
              {renderCount}
            </TeachingPopover.CarouselPageCount>
          }
        />,
      );
      expect(screen.getByTestId('count')).toHaveTextContent(/^Steg 1 av 3$/);
      expect(renderCount).toHaveBeenLastCalledWith(1, 3);
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByTestId('count')).toHaveTextContent(/^Steg 2 av 3$/);
      expect(renderCount).toHaveBeenLastCalledWith(2, 3);
    });

    it('a render function that renders nothing keeps the default text', () => {
      render(
        <CarouselTour
          indicator={
            <TeachingPopover.CarouselPageCount data-testid="count">
              {() => null}
            </TeachingPopover.CarouselPageCount>
          }
        />,
      );
      expect(screen.getByTestId('count')).toHaveTextContent(/^1 of 3$/);
    });

    it('sits next to the step buttons', () => {
      render(
        <CarouselTour
          indicator={
            <>
              <TeachingPopover.CarouselNav />
              <TeachingPopover.CarouselPageCount data-testid="count" />
            </>
          }
        />,
      );
      expect(stepButtons()).toHaveLength(3);
      expect(screen.getByTestId('count')).toHaveTextContent('1 of 3');
    });
  });

  describe('CarouselFooter', () => {
    testSystemProps(TeachingPopoverCarouselFooter, {
      expectedTag: 'div',
      displayName: 'TeachingPopoverCarouselFooter',
      wrapper: InSurface,
      conflictingClass: { className: 'gap-4', overrides: 'gap-2' },
    });

    it('carries the footer classes and data-carousel-layout: the indicator first by default, between the buttons when centered', () => {
      const footerOf = () =>
        document.querySelector<HTMLElement>(`.${teachingPopoverCarouselFooterClassNames.root}`)!;
      const order = () => {
        const back = screen.getByRole('button', { name: 'Back' });
        const next = screen.getByRole('button', { name: 'Next' });
        const before = (a: Node, b: Node) =>
          Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        return {
          navFirst: before(nav(), back),
          navBetween: before(back, nav()) && before(nav(), next),
        };
      };
      const { rerender } = render(<CarouselTour footerLayout="vertical" />);
      expect(footerOf()).toHaveClass(
        teachingPopoverCarouselFooterClassNames.root,
        teachingPopoverClassNames.footer,
      );
      expect(footerOf()).toHaveAttribute('data-carousel-layout', 'offset');
      expect(footerOf()).not.toHaveAttribute('data-layout');
      expect(order()).toEqual({ navFirst: true, navBetween: false });

      rerender(<CarouselTour footerLayout="vertical" footer={{ layout: 'centered' }} />);
      expect(footerOf()).toHaveAttribute('data-carousel-layout', 'centered');
      expect(order()).toEqual({ navFirst: false, navBetween: true });
    });

    describe('layout: wrapping and centring (browser pass H1, H2, L9)', () => {
      const footerOf = () =>
        document.querySelector<HTMLElement>(`.${teachingPopoverCarouselFooterClassNames.root}`)!;
      const slotsOf = (footer: HTMLElement) => Array.from(footer.children) as HTMLElement[];
      const nextFrame = () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const navAndCount = (
        <>
          <TeachingPopover.CarouselNav />
          <TeachingPopover.CarouselPageCount />
        </>
      );

      /**
       * jsdom has no layout: gives the footer its width and the secondary slot, the indicator and
       * the primary slot of a centered footer their widths, then lets the footer's resize
       * observer measure (in the next animation frame).
       */
      async function layOut(
        resize: ReturnType<typeof installResizeObserverMock>,
        widths: { footer: number; secondary?: number; indicator: number; primary: number },
      ) {
        const footer = footerOf();
        const [first, second, third] = slotsOf(footer);
        const [secondary, indicatorSlot, primary] = third
          ? [first, second, third]
          : [null, first, second];
        mockRect(footer, { width: widths.footer });
        if (secondary) mockRect(secondary, { width: widths.secondary ?? 0 });
        mockRect(indicatorSlot.firstElementChild!, { width: widths.indicator });
        mockRect(primary, { width: widths.primary });
        resize.trigger(footer);
        await act(async () => {
          await nextFrame();
        });
      }

      it('offset: the footer wraps, the indicator keeps its content width and the buttons keep to the end', () => {
        render(<CarouselTour indicator={navAndCount} />);
        const footer = footerOf();
        expect(footer).toHaveAttribute('data-carousel-layout', 'offset');
        expect(footer).toHaveClass('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-2');
        expect(footer).not.toHaveAttribute('data-stacked');
        const [indicator, buttons] = slotsOf(footer);
        expect(indicator).toContainElement(nav());
        expect(indicator).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2');
        expect(indicator).not.toHaveClass('min-w-0');
        expect(buttons).toContainElement(screen.getByRole('button', { name: 'Back' }));
        expect(buttons).toContainElement(screen.getByRole('button', { name: 'Next' }));
        expect(buttons).toHaveClass(
          'ms-auto',
          'flex',
          'flex-wrap',
          'items-center',
          'justify-end',
          'gap-2',
        );
      });

      it('offset without children keeps the decorative dots element of the steps form', () => {
        render(<CarouselTour indicator={null} />);
        const [indicator] = slotsOf(footerOf());
        expect(indicator).toHaveAttribute('aria-hidden', 'true');
        expect(indicator.getAttribute('class')).toBe('flex items-center gap-1.5');
      });

      it('centered: three columns, the indicator in the middle one between the buttons', () => {
        render(<CarouselTour footer={{ layout: 'centered' }} />);
        const footer = footerOf();
        expect(footer).toHaveClass('grid', 'grid-cols-[1fr_auto_1fr]', 'items-center', 'gap-2');
        expect(footer).not.toHaveClass('flex');
        expect(footer).not.toHaveAttribute('data-stacked');
        const [secondary, indicator, primary] = slotsOf(footer);
        expect(secondary).toContainElement(screen.getByRole('button', { name: 'Back' }));
        expect(secondary).toHaveClass('flex', 'w-max', 'max-w-full', 'col-start-1');
        expect(secondary).toHaveClass('justify-self-start');
        expect(indicator).toContainElement(nav());
        expect(indicator).toHaveClass('flex', 'justify-center', 'col-start-2');
        expect(indicator.firstElementChild).toHaveClass('w-max', 'max-w-full');
        expect(primary).toContainElement(screen.getByRole('button', { name: 'Next' }));
        expect(primary).toHaveClass('flex', 'w-max', 'max-w-full', 'col-start-3');
        expect(primary).toHaveClass('justify-self-end');
      });

      it('centered without a secondary button keeps the indicator in the middle column (L9)', () => {
        render(<CarouselTour steps={[steps[0]]} footer={{ layout: 'centered' }} />);
        const footer = footerOf();
        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
        const [indicator, primary] = slotsOf(footer);
        expect(slotsOf(footer)).toHaveLength(2);
        expect(indicator).toContainElement(nav());
        expect(indicator).toHaveClass('col-start-2');
        expect(primary).toContainElement(screen.getByRole('button', { name: 'Done' }));
        expect(primary).toHaveClass('col-start-3', 'justify-self-end');
      });

      it('centered stacks the indicator above the buttons while the row does not fit, and goes back', async () => {
        const resize = installResizeObserverMock();
        onTestFinished(() => resize.restore());
        render(<CarouselTour footer={{ layout: 'centered' }} />);
        const footer = footerOf();
        const [secondary, indicator, primary] = slotsOf(footer);
        const back = screen.getByRole('button', { name: 'Back' });
        act(() => back.focus());

        // 2 x 96 + 72 = 264 fits in 278: one row.
        await layOut(resize, { footer: 278, secondary: 96, indicator: 72, primary: 96 });
        expect(footer).not.toHaveAttribute('data-stacked');
        expect(footer).toHaveClass('grid');

        // ... not in 250: the indicator gets a row of its own, first, above the buttons.
        await layOut(resize, { footer: 250, secondary: 96, indicator: 72, primary: 96 });
        expect(footer).toHaveAttribute('data-stacked', '');
        expect(footer).toHaveClass('flex', 'flex-wrap', 'items-center', 'gap-2');
        expect(footer).not.toHaveClass('grid');
        expect(indicator).toHaveClass('order-first', 'basis-full', 'flex', 'justify-center');
        expect(indicator).not.toHaveClass('col-start-2');
        expect(secondary).not.toHaveClass('col-start-1');
        expect(primary).toHaveClass('ms-auto');
        expect(primary).not.toHaveClass('col-start-3');
        // The same elements in the same DOM order: the button keeps focus.
        expect(slotsOf(footer)).toEqual([secondary, indicator, primary]);
        expect(back).toHaveFocus();

        await layOut(resize, { footer: 300, secondary: 96, indicator: 72, primary: 96 });
        expect(footer).not.toHaveAttribute('data-stacked');
        expect(footer).toHaveClass('grid');
        expect(back).toHaveFocus();
      });

      it('centered counts the wider button on both sides, so a row it keeps is centred', async () => {
        const resize = installResizeObserverMock();
        onTestFinished(() => resize.restore());
        render(<CarouselTour footer={{ layout: 'centered' }} />);
        // 120 + 72 + 96 = 288 would fit in 300, but not with the indicator centred: 2 x 120 + 72.
        await layOut(resize, { footer: 300, secondary: 120, indicator: 72, primary: 96 });
        expect(footerOf()).toHaveAttribute('data-stacked', '');
        await layOut(resize, { footer: 312, secondary: 120, indicator: 72, primary: 96 });
        expect(footerOf()).not.toHaveAttribute('data-stacked');
      });

      it('centered without a secondary button measures the primary on both sides', async () => {
        const resize = installResizeObserverMock();
        onTestFinished(() => resize.restore());
        render(<CarouselTour steps={[steps[0]]} footer={{ layout: 'centered' }} />);
        // 2 x 96 + 72 = 264: the empty start column is as wide as the primary button's.
        await layOut(resize, { footer: 264, indicator: 72, primary: 96 });
        expect(footerOf()).not.toHaveAttribute('data-stacked');
        await layOut(resize, { footer: 264, indicator: 72, primary: 100 });
        expect(footerOf()).toHaveAttribute('data-stacked', '');
      });

      it('centered keeps its layout while the footer has no width (not laid out)', async () => {
        const resize = installResizeObserverMock();
        onTestFinished(() => resize.restore());
        render(<CarouselTour footer={{ layout: 'centered' }} />);
        await layOut(resize, { footer: 278, secondary: 96, indicator: 72, primary: 96 });
        expect(footerOf()).not.toHaveAttribute('data-stacked');
        // A footer without a box (an ancestor not displayed) has no room to compare: no stacking.
        await layOut(resize, { footer: 0, secondary: 96, indicator: 72, primary: 96 });
        expect(footerOf()).not.toHaveAttribute('data-stacked');
        await layOut(resize, { footer: 250, secondary: 96, indicator: 72, primary: 96 });
        expect(footerOf()).toHaveAttribute('data-stacked', '');
        await layOut(resize, { footer: 0, secondary: 0, indicator: 0, primary: 0 });
        expect(footerOf()).toHaveAttribute('data-stacked', '');
      });

      it('centered measures again after a step changes the buttons', async () => {
        const user = userEvent.setup();
        const resize = installResizeObserverMock();
        onTestFinished(() => resize.restore());
        render(<CarouselTour footer={{ layout: 'centered' }} />);
        await layOut(resize, { footer: 278, secondary: 96, indicator: 72, primary: 96 });
        expect(footerOf()).not.toHaveAttribute('data-stacked');
        // The next step's primary button is wider; no resize is reported, the commit measures.
        mockRect(slotsOf(footerOf())[2], { width: 120 });
        await user.click(screen.getByRole('button', { name: 'Next' }));
        expect(heading()).toHaveTextContent('Features, step 2 of 3');
        expect(footerOf()).toHaveAttribute('data-stacked', '');
      });

      it('renders the one-row layout in the server HTML', () => {
        const html = renderToString(<CarouselTour footer={{ layout: 'centered' }} />);
        expect(html).toContain('data-carousel-layout="centered"');
        expect(html).toContain('grid-cols-[1fr_auto_1fr]');
        expect(html).not.toContain('data-stacked');
      });

      it.each(['offset', 'centered'] as const)(
        '%s: the same logical classes in RTL as in LTR',
        (layout) => {
          const classes = () =>
            [footerOf(), ...Array.from(footerOf().querySelectorAll('*'))].map((el) =>
              el.getAttribute('class'),
            );
          const ltr = render(<CarouselTour indicator={navAndCount} footer={{ layout }} />);
          const expected = classes();
          ltr.unmount();
          renderWithProviders(<CarouselTour indicator={navAndCount} footer={{ layout }} />, {
            dir: 'rtl',
          });
          expect(classes()).toEqual(expected);
          expect(footerOf().closest('[dir]')).toHaveAttribute('dir', 'rtl');
        },
      );
    });

    it('children replace the dots and keep the buttons; children that render nothing keep the dots', () => {
      const { rerender } = render(<CarouselTour />);
      expect(dots()).toHaveLength(0);
      expect(stepButtons()).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      rerender(<CarouselTour indicator={false} />);
      expect(dots()).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    });

    it('finalStepText names the primary button on the last step only, and finishes the tour', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      const { rerender } = render(
        <CarouselTour activeStep={0} footer={{ finalStepText: 'Got it' }} />,
      );
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      rerender(
        <CarouselTour activeStep={2} footer={{ finalStepText: 'Got it' }} onFinish={onFinish} />,
      );
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      expect(gotIt).toHaveClass(teachingPopoverClassNames.nextButton);
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
      await user.click(gotIt);
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('without finalStepText the last step keeps the Done label of labels', () => {
      render(<CarouselTour activeStep={2} labels={{ done: 'Ferdig', next: 'Neste' }} />);
      expect(screen.getByRole('button', { name: 'Ferdig' })).toBeInTheDocument();
    });

    it('without initialStepText, Back on the first step is aria-disabled, does nothing and keeps focus (0.13)', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onDismiss = vi.fn();
      render(
        <CarouselTour defaultActiveStep={1} onStepChange={onStepChange} onDismiss={onDismiss} />,
      );
      const back = screen.getByRole('button', { name: 'Back' });
      await user.click(back);
      expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
      expect(back).toHaveFocus();
      expect(back).toHaveAttribute('aria-disabled', 'true');
      await user.click(back);
      expect(onStepChange.mock.calls).toEqual([[0]]);
      expect(onDismiss).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('initialStepText makes the first step’s secondary button an enabled button that dismisses', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onDismiss = vi.fn();
      const onFinish = vi.fn();
      const onStepChange = vi.fn();
      render(
        <CarouselTour
          footer={{ initialStepText: 'Not now' }}
          onOpenChange={onOpenChange}
          onDismiss={onDismiss}
          onFinish={onFinish}
          onStepChange={onStepChange}
        />,
      );
      const notNow = screen.getByRole('button', { name: 'Not now' });
      expect(notNow).not.toHaveAttribute('aria-disabled');
      expect(notNow).not.toBeDisabled();
      expect(notNow).toHaveClass(teachingPopoverClassNames.backButton);
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      await user.click(notNow);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange.mock.calls).toEqual([[false]]);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onFinish).not.toHaveBeenCalled();
      expect(onStepChange).not.toHaveBeenCalled();
    });

    it('initialStepText leaves Back on the other steps; back on the first step, focus stays on that button', async () => {
      const user = userEvent.setup();
      render(<CarouselTour defaultActiveStep={1} footer={{ initialStepText: 'Not now' }} />);
      const back = screen.getByRole('button', { name: 'Back' });
      expect(back).not.toHaveAttribute('aria-disabled');
      await user.click(back);
      expect(heading()).toHaveTextContent('Welcome, step 1 of 3');
      const notNow = screen.getByRole('button', { name: 'Not now' });
      expect(notNow).toBe(back);
      expect(notNow).toHaveFocus();
      expect(notNow).not.toHaveAttribute('aria-disabled');
    });

    it('focus returns to the Trigger when initialStepText dismisses', async () => {
      const user = userEvent.setup();
      render(<CarouselTour withTrigger footer={{ initialStepText: 'Not now' }} />);
      await user.click(trigger());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog).toHaveFocus());
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger()).toHaveFocus();
    });

    it('a single step shows initialStepText next to the final button', () => {
      render(
        <CarouselTour
          steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]}
          footer={{ initialStepText: 'Not now', finalStepText: 'Got it' }}
        />,
      );
      expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    });

    it('a single step without initialStepText has no Back, as the steps form', () => {
      render(<CarouselTour steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]} indicator={null} />);
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('the actions replace the buttons that the texts relabel', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(
        <CarouselTour
          steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]}
          primaryAction="Finish"
          secondaryAction="Skip"
          footer={{ initialStepText: 'Not now', finalStepText: 'Got it' }}
          onFinish={onFinish}
        />,
      );
      expect(screen.getByRole('button', { name: 'Skip' })).toHaveClass(
        teachingPopoverClassNames.secondaryButton,
      );
      expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Finish' }));
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });

  it('has no axe violations for a carousel tour built from parts', async () => {
    const { rerender } = render(
      <CarouselTour
        activeStep={1}
        footer={{ layout: 'centered' }}
        indicator={
          <>
            <TeachingPopover.CarouselNav />
            <TeachingPopover.CarouselPageCount />
          </>
        }
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Features, step 2 of 3' })).toBeInTheDocument();
    await expectNoA11yViolations();
    rerender(
      <CarouselTour
        activeStep={0}
        footer={{ initialStepText: 'Not now', finalStepText: 'Got it' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });

  describe('outside a TeachingPopover (C-CONTEXT)', () => {
    it('each part throws in development', () => {
      expectThrows(
        <TeachingPopover.Carousel />,
        '[WaveUI] TeachingPopover.Carousel must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.CarouselNav />,
        '[WaveUI] TeachingPopover.CarouselNav must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.CarouselPageCount />,
        '[WaveUI] TeachingPopover.CarouselPageCount must be used within TeachingPopover',
      );
      expectThrows(
        <TeachingPopover.CarouselFooter />,
        '[WaveUI] TeachingPopover.CarouselFooter must be used within TeachingPopover',
      );
    });

    it('in production, each part logs once and renders nothing', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ui = (tick: number) => (
        <div data-tick={tick}>
          <TeachingPopover.Carousel />
          <TeachingPopover.CarouselNav />
          <TeachingPopover.CarouselPageCount />
          <TeachingPopover.CarouselFooter />
        </div>
      );
      const { container, rerender } = render(ui(0));
      rerender(ui(1));
      expect(error.mock.calls).toEqual([
        ['[WaveUI] TeachingPopover.Carousel must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.CarouselNav must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.CarouselPageCount must be used within TeachingPopover'],
        ['[WaveUI] TeachingPopover.CarouselFooter must be used within TeachingPopover'],
      ]);
      expect(container.firstElementChild).toBeEmptyDOMElement();
    });
  });

  describe('parts written in a Server Component', () => {
    // A client component written in a Server Component reaches the client as a lazy reference.
    const plainParts = {
      Surface: TeachingPopoverSurface,
      Title: TeachingPopoverTitle,
      Body: TeachingPopoverBody,
      Carousel: TeachingPopoverCarousel,
      CarouselNav: TeachingPopoverCarouselNav,
      CarouselPageCount: TeachingPopoverCarouselPageCount,
      CarouselFooter: TeachingPopoverCarouselFooter,
    };
    const lazyParts = {
      Surface: asClientReference(TeachingPopoverSurface),
      Title: asClientReference(TeachingPopoverTitle),
      Body: asClientReference(TeachingPopoverBody),
      Carousel: asClientReference(TeachingPopoverCarousel),
      CarouselNav: asClientReference(TeachingPopoverCarouselNav),
      CarouselPageCount: asClientReference(TeachingPopoverCarouselPageCount),
      CarouselFooter: asClientReference(TeachingPopoverCarouselFooter),
    };

    function Tip({ parts, onFinish }: { parts: typeof plainParts; onFinish?: () => void }) {
      return (
        <TeachingPopover steps={steps} onFinish={onFinish}>
          <parts.Surface>
            <parts.Carousel>
              <parts.Title />
              <parts.Body />
              <parts.CarouselFooter initialStepText="Not now" finalStepText="Got it">
                <parts.CarouselNav />
                <parts.CarouselPageCount />
              </parts.CarouselFooter>
            </parts.Carousel>
          </parts.Surface>
        </TeachingPopover>
      );
    }

    it('server-renders the same HTML as with the plain part types', () => {
      const html = renderToString(<Tip parts={plainParts} />);
      expect(html).toContain('Welcome');
      expect(html).toContain(teachingPopoverCarouselClassNames.root);
      expect(html).toContain(teachingPopoverCarouselNavClassNames.root);
      expect(html).toContain(teachingPopoverCarouselPageCountClassNames.root);
      expect(html).toContain(teachingPopoverCarouselFooterClassNames.root);
      expect(html).toContain('Step 2 of 3');
      expect(html).toContain('Not now');
      expect(renderToString(<Tip parts={lazyParts} />)).toBe(html);
    });

    it('lazy parts render the defaults, jump, advance and finish', async () => {
      const user = userEvent.setup();
      const onFinish = vi.fn();
      render(<Tip parts={lazyParts} onFinish={onFinish} />);
      await act(async () => {});
      expect(screen.getByRole('dialog', { name: 'Welcome, step 1 of 3' })).toBeInTheDocument();
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Step 2 of 3' }));
      expect(heading()).toHaveTextContent('Features, step 2 of 3');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('TeachingPopover — slotProps', () => {
  type TeachingSlotProps = NonNullable<TeachingPopoverProps['slotProps']>;
  const EVERY_PART: TeachingSlotProps = {
    beak: {},
    closeButton: {},
    dot: {},
    backButton: {},
    nextButton: {},
  };
  const MERGE_WARNING =
    '[WaveUI] TeachingPopover.Header: `dismissButton` received a button element; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `dismissButton={<CloseIcon />}`.';
  const html = document.documentElement;
  const rect = {
    x: 200,
    y: 100,
    width: 100,
    height: 20,
    top: 100,
    right: 300,
    bottom: 120,
    left: 200,
  };
  const target = { getBoundingClientRect: () => rect };
  const all = (className: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('.' + className));
  const beak = () => all(teachingPopoverClassNames.beak)[0];
  const close = () => all(teachingPopoverClassNames.closeButton)[0];
  const back = () => all(teachingPopoverClassNames.backButton)[0];
  const next = () => all(teachingPopoverClassNames.nextButton)[0];

  function viewport() {
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(html, 'clientHeight', { configurable: true, value: 768 });
  }

  afterEach(() => {
    Reflect.deleteProperty(html, 'clientWidth');
    Reflect.deleteProperty(html, 'clientHeight');
  });

  /** Waits for an anchored surface to be placed. */
  async function placed() {
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.style.transform).not.toBe(''));
  }

  /**
   * {@link expectInertSlotProps} for a surface placed or settled after its render: the same root
   * re-rendered with `{}`, every part `{}` and `undefined`, the whole body compared each time.
   */
  async function expectInertSettled(
    ui: (slotProps?: TeachingSlotProps) => React.ReactElement,
    anchored = false,
  ) {
    const { baseElement, rerender, unmount } = render(ui());
    if (anchored) await placed();
    await act(async () => {});
    const markup = baseElement.innerHTML;
    for (const slotProps of [{}, EVERY_PART, undefined]) {
      rerender(ui(slotProps));
      await act(async () => {});
      expect(baseElement.innerHTML).toBe(markup);
    }
    unmount();
  }

  /** Boxes by `data-testid` (jsdom has no layout); the target is the virtual `rect`. */
  function mockLayout(boxes: Record<string, { width: number; height: number }>) {
    viewport();
    const boxOf = (el: Element) => boxes[el.getAttribute('data-testid') ?? ''];
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const { width, height } = boxOf(this) ?? { width: 0, height: 0 };
      const full = { x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height };
      return { ...full, toJSON: () => full } as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this)?.width ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return boxOf(this)?.height ?? 0;
    });
  }

  /** The parts form: a Surface with the Header and the footer of `footer`. */
  function PartsForm({
    footer = <TeachingPopover.Footer />,
    ...props
  }: Partial<TeachingPopoverProps> & { footer?: React.ReactNode }) {
    return (
      <TeachingPopover steps={steps} {...props}>
        <TeachingPopover.Surface>
          <TeachingPopover.Header />
          <TeachingPopover.Title />
          {footer}
        </TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  describe('markup without slotProps', () => {
    it('renders the parts of a98c113 in an anchored steps form (attributes sorted)', async () => {
      // Captured from a98c113: the merged props may put the class before the locked attributes.
      viewport();
      render(<TeachingPopover steps={steps} target={target} />);
      await placed();
      expect(openingTags(beak(), close(), ...dots(), back(), next())).toBe(
        [
          '<div aria-hidden="true" class="size-2 rotate-45 border-inherit bg-inherit border-t border-l wave-teaching-popover__beak" data-wave-teaching-popover-arrow="" style="position: absolute; top: calc(var(--wave-popup-arrow-size, 8px) / -2); left: 0px;">',
          '<button aria-label="Close" class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-6 w-6 px-0 text-caption-1 border border-transparent bg-transparent text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed wave-teaching-popover__close-button absolute end-3 top-3" type="button">',
          '<span aria-current="step" class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-4 bg-primary forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<span class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<span class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<button aria-disabled="true" class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-stroke bg-background text-foreground not-disabled:not-aria-disabled:hover:border-stroke-hover not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed cursor-not-allowed opacity-50 aria-disabled:focus-visible:opacity-100 forced-colors:text-[GrayText] forced-colors:border-[GrayText] wave-teaching-popover__back-button" data-disabled="" type="button">',
          '<button class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-transparent bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed wave-teaching-popover__next-button" type="button">',
        ].join('\n'),
      );
    });

    it('renders the parts of a98c113 in the parts form, with a CarouselNav (attributes sorted)', async () => {
      render(
        <TeachingPopover steps={steps} activeStep={1}>
          <TeachingPopover.Surface>
            <TeachingPopover.Header />
            <TeachingPopover.Carousel>
              <TeachingPopover.Title />
              <TeachingPopover.Body />
              <TeachingPopover.CarouselFooter initialStepText="Not now">
                <TeachingPopover.CarouselNav />
              </TeachingPopover.CarouselFooter>
            </TeachingPopover.Carousel>
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      await act(async () => {});
      expect(
        openingTags(
          close(),
          ...all(teachingPopoverCarouselNavClassNames.button),
          ...all(teachingPopoverCarouselNavClassNames.indicator),
          back(),
          next(),
        ),
      ).toBe(
        [
          '<button aria-label="Close" class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-6 w-6 px-0 text-caption-1 border border-transparent bg-transparent text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed wave-teaching-popover__close-button absolute end-3 top-3" type="button">',
          '<button aria-label="Step 1 of 3" class="wave-teaching-popover-carousel-nav__button group inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" type="button">',
          '<button aria-current="step" aria-label="Step 2 of 3" class="wave-teaching-popover-carousel-nav__button group inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" type="button">',
          '<button aria-label="Step 3 of 3" class="wave-teaching-popover-carousel-nav__button group inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" type="button">',
          '<span aria-hidden="true" class="wave-teaching-popover-carousel-nav__indicator block h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible group-hover:bg-foreground forced-colors:bg-[ButtonText] forced-colors:forced-color-adjust-none">',
          '<span aria-hidden="true" class="wave-teaching-popover-carousel-nav__indicator block h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-4 bg-primary forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none">',
          '<span aria-hidden="true" class="wave-teaching-popover-carousel-nav__indicator block h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible group-hover:bg-foreground forced-colors:bg-[ButtonText] forced-colors:forced-color-adjust-none">',
          '<button class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-stroke bg-background text-foreground not-disabled:not-aria-disabled:hover:border-stroke-hover not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed wave-teaching-popover__back-button" type="button">',
          '<button class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-transparent bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed wave-teaching-popover__next-button" type="button">',
        ].join('\n'),
      );
    });

    it('renders the parts of a98c113 in a first-step carousel footer (attributes sorted)', async () => {
      render(
        <TeachingPopover steps={steps}>
          <TeachingPopover.Surface>
            <TeachingPopover.Carousel>
              <TeachingPopover.CarouselFooter initialStepText="Not now" />
            </TeachingPopover.Carousel>
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      await act(async () => {});
      expect(openingTags(...dots(), back(), next())).toBe(
        [
          '<span aria-current="step" class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-4 bg-primary forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<span class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<span class="wave-teaching-popover__dot h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none w-1.5 bg-stroke-accessible forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none" data-wave-teaching-popover-dot="">',
          '<button class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-stroke bg-background text-foreground not-disabled:not-aria-disabled:hover:border-stroke-hover not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed wave-teaching-popover__back-button" type="button">',
          '<button class="wave-button inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring h-8 min-w-24 px-3 text-body-1 border border-transparent bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed wave-teaching-popover__next-button" type="button">',
        ].join('\n'),
      );
    });

    it('renders the same markup without slotProps, with {} and with every part empty', async () => {
      expectInertSlotProps(
        (slotProps) => <TeachingPopover steps={steps} slotProps={slotProps} />,
        EVERY_PART,
      );
      expectInertSlotProps(
        (slotProps) => (
          <TeachingPopover
            steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]}
            footerLayout="vertical"
            slotProps={slotProps}
          />
        ),
        EVERY_PART,
      );
      expectInertSlotProps(
        (slotProps) => (
          <TeachingPopover
            steps={steps}
            activeStep={1}
            primaryAction={{ children: 'Go' }}
            secondaryAction={<Button>Skip</Button>}
            slotProps={slotProps}
          />
        ),
        EVERY_PART,
      );
      viewport();
      await expectInertSettled(
        (slotProps) => (
          <TeachingPopover steps={steps} activeStep={1} target={target} slotProps={slotProps} />
        ),
        true,
      );
      await expectInertSettled(
        (slotProps) => (
          <TeachingPopover steps={steps} defaultOpen slotProps={slotProps}>
            <TeachingPopover.Trigger>
              <button type="button">Tour</button>
            </TeachingPopover.Trigger>
          </TeachingPopover>
        ),
        true,
      );
      await expectInertSettled((slotProps) => (
        <TeachingPopover steps={steps} activeStep={2} slotProps={slotProps}>
          <TeachingPopover.Surface>
            <TeachingPopover.Header dismissButton={<svg data-testid="x" />}>
              Tip
            </TeachingPopover.Header>
            <TeachingPopover.Carousel>
              <TeachingPopover.CarouselFooter layout="centered" finalStepText="Got it" />
            </TeachingPopover.Carousel>
          </TeachingPopover.Surface>
        </TeachingPopover>
      ));
    });

    it('renders the same markup with a merged dismissButton without slotProps and with every part empty', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await expectInertSettled((slotProps) => <PartsForm slotProps={slotProps} footer={null} />);
      await expectInertSettled((slotProps) => (
        <TeachingPopover steps={steps} slotProps={slotProps}>
          <TeachingPopover.Surface>
            <TeachingPopover.Header
              dismissButton={
                <button type="submit" tabIndex={-1} className="mine" style={{ zIndex: 2 }}>
                  Shut
                </button>
              }
            />
          </TeachingPopover.Surface>
        </TeachingPopover>
      ));
      expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
    });
  });

  describe('every part', () => {
    it('puts your className, style and data-* on each part, after its own classes', async () => {
      viewport();
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          target={target}
          slotProps={{
            beak: { className: 'my-beak', style: { opacity: 0.1 }, 'data-part': 'beak' },
            closeButton: { className: 'my-close', style: { opacity: 0.2 }, 'data-part': 'close' },
            dot: { className: 'my-dot', style: { opacity: 0.3 }, 'data-part': 'dot' },
            backButton: { className: 'my-back', style: { opacity: 0.4 }, 'data-part': 'back' },
            nextButton: { className: 'my-next', style: { opacity: 0.5 }, 'data-part': 'next' },
          }}
        />,
      );
      await placed();
      for (const [elements, stable, mine, data, opacity] of [
        [[beak()], teachingPopoverClassNames.beak, 'my-beak', 'beak', '0.1'],
        [[close()], teachingPopoverClassNames.closeButton, 'my-close', 'close', '0.2'],
        [dots(), teachingPopoverClassNames.dot, 'my-dot', 'dot', '0.3'],
        [[back()], teachingPopoverClassNames.backButton, 'my-back', 'back', '0.4'],
        [[next()], teachingPopoverClassNames.nextButton, 'my-next', 'next', '0.5'],
      ] as const) {
        expect(elements.length).toBeGreaterThan(0);
        for (const element of elements) {
          expect(element).toHaveClass(stable, mine);
          expect(element.classList[element.classList.length - 1]).toBe(mine);
          expect(element).toHaveAttribute('data-part', data);
          expect(element).toHaveStyle({ opacity });
        }
      }
      expect(dots()).toHaveLength(3);
      // The surface takes none of it, and no `slotProps` attribute.
      expect(screen.getByRole('dialog')).not.toHaveAttribute('data-part');
      expect(document.querySelector('[slotprops]')).toBeNull();
    });

    it('lets your class replace a conflicting class of a part', async () => {
      viewport();
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          target={target}
          slotProps={{
            beak: { className: 'size-3' },
            closeButton: { className: 'end-2' },
            dot: { className: 'h-2' },
            backButton: { className: 'min-w-16' },
            nextButton: { className: 'min-w-32' },
          }}
        />,
      );
      await placed();
      expect(beak()).toHaveClass('size-3');
      expect(beak()).not.toHaveClass('size-2');
      expect(close()).toHaveClass('end-2');
      expect(close()).not.toHaveClass('end-3');
      for (const dot of dots()) {
        expect(dot).toHaveClass('h-2');
        expect(dot).not.toHaveClass('h-1.5');
      }
      expect(back()).toHaveClass('min-w-16');
      expect(back()).not.toHaveClass('min-w-24');
      expect(next()).toHaveClass('min-w-32');
      expect(next()).not.toHaveClass('min-w-24');
    });

    it('attaches your refs to the parts, each dot included', async () => {
      viewport();
      const beakRef = React.createRef<HTMLDivElement>();
      const closeRef = React.createRef<HTMLButtonElement>();
      const backRef = React.createRef<HTMLButtonElement>();
      const nextRef = React.createRef<HTMLButtonElement>();
      const dotElements: Array<HTMLSpanElement | null> = [];
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          target={target}
          slotProps={{
            beak: { ref: beakRef },
            closeButton: { ref: closeRef },
            dot: { ref: (element) => void dotElements.push(element) },
            backButton: { ref: backRef },
            nextButton: { ref: nextRef },
          }}
        />,
      );
      await placed();
      expect(beakRef.current).toBe(beak());
      expect(closeRef.current).toBe(close());
      expect(backRef.current).toBe(back());
      expect(nextRef.current).toBe(next());
      for (const dot of dots()) expect(dotElements).toContain(dot);
    });

    it('reaches the parts in the parts form too, with no warning about the surface props', async () => {
      const warn = vi.spyOn(console, 'warn');
      viewport();
      render(
        <PartsForm
          defaultActiveStep={1}
          target={target}
          slotProps={{
            beak: { className: 'my-beak' },
            closeButton: { className: 'my-close' },
            dot: { className: 'my-dot' },
            backButton: { className: 'my-back' },
            nextButton: { className: 'my-next' },
          }}
        />,
      );
      await placed();
      expect(beak()).toHaveClass('my-beak');
      expect(close()).toHaveClass('my-close');
      for (const dot of dots()) expect(dot).toHaveClass('my-dot');
      expect(back()).toHaveClass('my-back');
      expect(next()).toHaveClass('my-next');
      expect(warn).not.toHaveBeenCalled();
    });

    it('reaches the dots and the buttons of a CarouselFooter', async () => {
      render(
        <PartsForm
          slotProps={{
            dot: { className: 'my-dot' },
            backButton: { className: 'my-back' },
            nextButton: { className: 'my-next' },
          }}
          footer={
            <TeachingPopover.Carousel>
              <TeachingPopover.CarouselFooter initialStepText="Not now" />
            </TeachingPopover.Carousel>
          }
        />,
      );
      await act(async () => {});
      expect(dots()).toHaveLength(3);
      for (const dot of dots()) expect(dot).toHaveClass('my-dot');
      expect(screen.getByRole('button', { name: 'Not now' })).toBe(back());
      expect(back()).toHaveClass('my-back');
      expect(next()).toHaveClass('my-next');
    });

    it('ignores the parts that are not rendered', async () => {
      const { unmount } = render(
        <TeachingPopover
          steps={[{ title: 'Tip', body: 'Press Ctrl+K.' }]}
          primaryAction={{ children: 'Go' }}
          slotProps={{
            beak: { className: 'my-beak' },
            backButton: { className: 'my-back' },
            nextButton: { className: 'my-next' },
          }}
        />,
      );
      // No target (no beak), a single step (no Back), and a primary action in place of Next.
      expect(screen.getByRole('button', { name: 'Go' })).not.toHaveClass('my-next');
      expect(document.querySelector('.my-beak, .my-back, .my-next')).toBeNull();
      unmount();
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          secondaryAction={{ children: 'Skip' }}
          slotProps={{ backButton: { className: 'my-back' }, dot: { className: 'my-dot' } }}
        >
          <TeachingPopover.Surface>
            <TeachingPopover.Header dismissButton={null} />
            <TeachingPopover.Title />
            <TeachingPopover.Footer />
            <TeachingPopover.Carousel>
              <TeachingPopover.CarouselFooter>
                <TeachingPopover.CarouselPageCount />
              </TeachingPopover.CarouselFooter>
            </TeachingPopover.Carousel>
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      await act(async () => {});
      expect(close()).toBeUndefined();
      expect(screen.getAllByRole('button', { name: 'Skip' })[0]).not.toHaveClass('my-back');
      expect(document.querySelector('.my-back')).toBeNull();
      // The Footer's dots only: the CarouselFooter shows its page count.
      expect(document.querySelectorAll('.my-dot')).toHaveLength(3);
    });

    it('calls your part handlers once per click in StrictMode', async () => {
      viewport();
      const onBeak = vi.fn();
      const onDot = vi.fn();
      const onBack = vi.fn();
      const onNext = vi.fn();
      const onClose = vi.fn();
      render(
        <React.StrictMode>
          <TeachingPopover
            steps={steps}
            defaultActiveStep={1}
            target={target}
            slotProps={{
              beak: { onClick: onBeak },
              dot: { onClick: onDot },
              backButton: { onClick: onBack },
              nextButton: { onClick: onNext },
              closeButton: { onClick: onClose },
            }}
          />
        </React.StrictMode>,
      );
      await placed();
      fireEvent.click(beak());
      fireEvent.click(dots()[0]);
      fireEvent.click(back());
      await act(async () => {});
      fireEvent.click(next());
      await act(async () => {});
      fireEvent.click(close());
      await act(async () => {});
      for (const handler of [onBeak, onDot, onBack, onNext, onClose]) {
        expect(handler).toHaveBeenCalledTimes(1);
      }
    });

    it('has no accessibility violations with every part customised', async () => {
      viewport();
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          target={target}
          slotProps={{
            beak: { className: 'my-beak' },
            closeButton: { className: 'my-close', title: 'Close the tour' },
            dot: { className: 'my-dot' },
            backButton: { className: 'my-back' },
            nextButton: { className: 'my-next' },
          }}
        />,
      );
      await placed();
      await expectNoA11yViolations();
    });

    it('types each part for its element, and takes no children', () => {
      expectTypeOf<keyof TeachingSlotProps>().toEqualTypeOf<
        'beak' | 'closeButton' | 'dot' | 'backButton' | 'nextButton'
      >();
      expectTypeOf<NonNullable<TeachingSlotProps['beak']>['ref']>().toEqualTypeOf<
        React.Ref<HTMLDivElement> | undefined
      >();
      expectTypeOf<NonNullable<TeachingSlotProps['dot']>['ref']>().toEqualTypeOf<
        React.Ref<HTMLSpanElement> | undefined
      >();
      for (const key of ['closeButton', 'backButton', 'nextButton'] as const) {
        void key;
        expectTypeOf<NonNullable<TeachingSlotProps[typeof key]>['ref']>().toEqualTypeOf<
          React.Ref<HTMLButtonElement> | undefined
        >();
      }
      // The context carries the same type (the context module imports nothing of the root).
      expectTypeOf<TeachingPopoverContextValue['slotProps']>().toEqualTypeOf<
        TeachingPopoverProps['slotProps']
      >();
      // @ts-expect-error -- a part takes no children: the labels are the popover's
      void (<TeachingPopover steps={steps} slotProps={{ nextButton: { children: 'Go' } }} />);
    });
  });

  describe('beak', () => {
    it('locks its hidden state, its marker, its tab stop and the position keys of its style', async () => {
      viewport();
      render(
        <TeachingPopover
          steps={steps}
          target={target}
          slotProps={{
            beak: {
              'aria-hidden': false,
              'data-wave-teaching-popover-arrow': 'mine',
              tabIndex: 0,
              style: { position: 'static', top: '1px', left: '2px', opacity: 0.5 },
              title: 'Beak',
            },
          }}
        />,
      );
      await placed();
      expect(beak()).toHaveAttribute('aria-hidden', 'true');
      expect(beak()).toHaveAttribute('data-wave-teaching-popover-arrow', '');
      expect(beak()).not.toHaveAttribute('tabindex');
      expect(beak()).toHaveAttribute('title', 'Beak');
      expect(beak().style.position).toBe('absolute');
      expect(beak().style.top).toBe('calc(var(--wave-popup-arrow-size, 8px) / -2)');
      expect(beak().style.left).toBe('0px');
      expect(beak()).toHaveStyle({ opacity: '0.5' });
    });

    it('keeps placing the beak while you pass a new inline ref on every render', async () => {
      mockLayout({
        surface: { width: 320, height: 200 },
        beak: { width: 8, height: 8 },
      });
      const elements: Array<HTMLDivElement | null> = [];
      const ui = () => (
        <TeachingPopover
          steps={steps}
          target={target}
          data-testid="surface"
          slotProps={{
            beak: { 'data-testid': 'beak', ref: (element) => void elements.push(element) },
          }}
        />
      );
      const { rerender } = render(ui());
      rerender(ui());
      rerender(ui());
      expect(elements.at(-1)).toBe(beak());
      // Below the target, centred: x = 250 - 320 / 2 = 90; the beak at 250 - 90 - 8 / 2 = 156.
      await waitFor(() =>
        expect(screen.getByRole('dialog').style.transform).toBe('translate(90px, 132px)'),
      );
      await waitFor(() => expect(beak().style.left).toBe('156px'));
    });

    it('mirrors the beak with your class in RTL', async () => {
      viewport();
      renderWithProviders(
        <TeachingPopover
          steps={steps}
          side="start"
          target={{
            getBoundingClientRect: () => ({ ...rect, x: 600, left: 600, right: 700 }),
          }}
          slotProps={{ beak: { className: 'my-beak' } }}
        />,
        { dir: 'rtl' },
      );
      await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right'));
      expect(beak()).toHaveClass('border-b', 'border-l', 'my-beak');
    });
  });

  describe('closeButton', () => {
    it('runs your onClick before the dismissal: preventDefault() keeps the popover open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      const { rerender } = render(
        <TeachingPopover
          steps={steps}
          onOpenChange={onOpenChange}
          slotProps={{ closeButton: { onClick } }}
        />,
      );
      await user.click(close());
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      rerender(
        <TeachingPopover
          steps={steps}
          onOpenChange={onOpenChange}
          slotProps={{ closeButton: { onClick: () => {} } }}
        />,
      );
      await user.click(close());
      expect(onOpenChange.mock.calls).toEqual([[false]]);
    });

    it('locks its type, name, disabled and hidden state and tab stop; your ids are added', () => {
      render(
        <>
          <span id="extra">The tour</span>
          <TeachingPopover
            steps={steps}
            slotProps={{
              closeButton: {
                type: 'submit',
                'aria-label': 'Other',
                'aria-labelledby': 'extra',
                disabled: true,
                tabIndex: -1,
                hidden: true,
                inert: true,
                'aria-hidden': true,
                'aria-disabled': true,
                'data-disabled': '',
                'data-disabled-focusable': '',
                title: 'Close the tour',
              },
            }}
          />
        </>,
      );
      const el = close();
      expect(el).toHaveAttribute('type', 'button');
      expect(el).toHaveAttribute('aria-label', 'Close');
      expect(el).toHaveAttribute('aria-labelledby', 'extra');
      for (const name of [
        'disabled',
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'data-disabled',
        'data-disabled-focusable',
      ]) {
        expect(el, name).not.toHaveAttribute(name);
      }
      expect(el).toHaveAttribute('title', 'Close the tour');
    });

    it('applies after a merged dismissButton: yours replace its attributes, its locked values stay', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const order: string[] = [];
      render(
        <TeachingPopover
          steps={steps}
          onDismiss={() => order.push('dismiss')}
          slotProps={{
            closeButton: {
              className: 'part-class',
              style: { opacity: 0.25 },
              'data-x': 'part',
              title: 'Part',
              type: 'button',
              tabIndex: 0,
              onClick: () => order.push('part'),
            },
          }}
        >
          <TeachingPopover.Surface>
            <TeachingPopover.Header
              dismissButton={
                <button
                  type="submit"
                  tabIndex={-1}
                  className="slot-class"
                  style={{ opacity: 0.5, zIndex: 2 }}
                  data-x="slot"
                  data-y="slot"
                  title="Slot"
                  onClick={() => order.push('slot')}
                >
                  Shut
                </button>
              }
            />
            <TeachingPopover.Title />
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      const el = screen.getByRole('button', { name: 'Shut' });
      expect(el).toBe(close());
      expect(el).toHaveClass('slot-class', 'part-class');
      expect(el.classList[el.classList.length - 1]).toBe('part-class');
      expect(el).toHaveStyle({ opacity: '0.25', zIndex: '2' });
      expect(el).toHaveAttribute('data-x', 'part');
      expect(el).toHaveAttribute('data-y', 'slot');
      expect(el).toHaveAttribute('title', 'Part');
      // The type and the tab stop the merged button gives stay.
      expect(el).toHaveAttribute('type', 'submit');
      expect(el).toHaveAttribute('tabindex', '-1');
      await user.click(el);
      expect(order).toEqual(['part', 'slot', 'dismiss']);
      expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
    });

    it('calls no click handler of yours while a merged disabledFocusable Button keeps it unavailable', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <TeachingPopover
          steps={steps}
          onOpenChange={onOpenChange}
          slotProps={{
            closeButton: { onClick, 'aria-disabled': false, 'data-disabled-focusable': undefined },
          }}
        >
          <TeachingPopover.Surface>
            <TeachingPopover.Header
              dismissButton={<Button disabledFocusable aria-label="Close tip" icon={<svg />} />}
            />
            <TeachingPopover.Title />
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      const el = screen.getByRole('button', { name: 'Close tip' });
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el).toHaveAttribute('data-disabled-focusable');
      await user.click(el);
      expect(onClick).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
    });

    it('keeps the name, the disabled state and the ids a merged button gives; yours are added', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="slot-note">Slot note</span>
          <span id="part-note">Part note</span>
          <TeachingPopover
            steps={steps}
            slotProps={{
              closeButton: {
                'aria-label': 'Other',
                'aria-describedby': 'part-note',
                disabled: false,
                hidden: true,
              },
            }}
          >
            <TeachingPopover.Surface>
              <TeachingPopover.Header
                dismissButton={
                  <button
                    type="button"
                    aria-label="Hide the tip"
                    aria-describedby="slot-note"
                    disabled
                  >
                    <svg />
                  </button>
                }
              />
              <TeachingPopover.Title />
            </TeachingPopover.Surface>
          </TeachingPopover>
        </>,
      );
      const el = close();
      expect(el).toHaveAccessibleName('Hide the tip');
      expect(el).toBeDisabled();
      expect(el).not.toHaveAttribute('hidden');
      expect(el).toHaveAttribute('aria-describedby', 'slot-note part-note');
      expect(warn.mock.calls).toEqual([[MERGE_WARNING]]);
    });

    it('runs yours before the handlers of a slot object, whose name stays', async () => {
      const user = userEvent.setup();
      const order: string[] = [];
      render(
        <TeachingPopover
          steps={steps}
          onDismiss={() => order.push('dismiss')}
          slotProps={{ closeButton: { 'aria-label': 'Other', onClick: () => order.push('part') } }}
        >
          <TeachingPopover.Surface>
            <TeachingPopover.Header
              dismissButton={{
                'aria-label': 'Hide the tip',
                onClick: () => order.push('slot'),
                children: <svg data-testid="glyph" />,
              }}
            />
            <TeachingPopover.Title />
          </TeachingPopover.Surface>
        </TeachingPopover>,
      );
      const el = screen.getByRole('button', { name: 'Hide the tip' });
      expect(el).toBe(close());
      expect(el).toContainElement(screen.getByTestId('glyph'));
      await user.click(el);
      expect(order).toEqual(['part', 'slot', 'dismiss']);
    });
  });

  describe('dot', () => {
    it('locks its marker, its step state, its hidden state and its tab stop', () => {
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          slotProps={{
            dot: {
              'data-wave-teaching-popover-dot': 'mine',
              'aria-current': 'page',
              'aria-hidden': true,
              tabIndex: 0,
              title: 'Dot',
            },
          }}
        />,
      );
      const [first, current, last] = dots();
      expect(current).toHaveAttribute('aria-current', 'step');
      // The other dots have no step state: yours is locked unset there too.
      expect(first).not.toHaveAttribute('aria-current');
      expect(last).not.toHaveAttribute('aria-current');
      for (const dot of dots()) {
        expect(dot).toHaveAttribute('data-wave-teaching-popover-dot', '');
        expect(dot).not.toHaveAttribute('aria-hidden');
        expect(dot).not.toHaveAttribute('tabindex');
        expect(dot).toHaveAttribute('title', 'Dot');
      }
    });
  });

  describe('backButton', () => {
    it('runs your onClick before Back: preventDefault() keeps the step', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      const { rerender } = render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          slotProps={{ backButton: { onClick } }}
        />,
      );
      await user.click(back());
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onStepChange).not.toHaveBeenCalled();
      expect(heading()).toHaveTextContent(/^Features/);
      rerender(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          slotProps={{ backButton: { onClick: () => {} } }}
        />,
      );
      await user.click(back());
      expect(onStepChange.mock.calls).toEqual([[0]]);
    });

    it('calls no click handler of yours on the first step, where Back is unavailable', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onStepChange = vi.fn();
      render(
        <TeachingPopover
          steps={steps}
          onStepChange={onStepChange}
          slotProps={{ backButton: { onClick, 'aria-disabled': false } }}
        />,
      );
      expect(back()).toHaveAttribute('aria-disabled', 'true');
      expect(back()).toHaveAttribute('data-disabled', '');
      await user.click(back());
      expect(onClick).not.toHaveBeenCalled();
      expect(onStepChange).not.toHaveBeenCalled();
      // On the next step your handler runs again.
      await user.click(next());
      await user.click(back());
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('locks its type, disabled states, hidden state and tab stop, also while available', () => {
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          slotProps={{
            backButton: {
              type: 'submit',
              disabled: true,
              tabIndex: -1,
              hidden: true,
              inert: true,
              'aria-hidden': true,
              'aria-disabled': true,
              'data-disabled': '',
              'data-disabled-focusable': '',
              disabledFocusable: true,
              title: 'Previous step',
            } as never,
          }}
        />,
      );
      const el = back();
      expect(el).toHaveAttribute('type', 'button');
      for (const name of [
        'disabled',
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'data-disabled',
        'data-disabled-focusable',
      ]) {
        expect(el, name).not.toHaveAttribute(name);
      }
      expect(el).toHaveAttribute('title', 'Previous step');
    });

    it('runs your onClick before the dismissal of initialStepText: preventDefault() keeps it open', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      render(
        <PartsForm
          onDismiss={onDismiss}
          slotProps={{ backButton: { onClick } }}
          footer={
            <TeachingPopover.Carousel>
              <TeachingPopover.CarouselFooter initialStepText="Not now" />
            </TeachingPopover.Carousel>
          }
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
      onClick.mockImplementation(() => {});
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('nextButton', () => {
    it('runs your onClick before Next and Done: preventDefault() keeps the step and the tour', async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      const onFinish = vi.fn();
      const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
      render(
        <TeachingPopover
          steps={steps}
          defaultActiveStep={1}
          onStepChange={onStepChange}
          onFinish={onFinish}
          slotProps={{ nextButton: { onClick } }}
        />,
      );
      await user.click(next());
      expect(onStepChange).not.toHaveBeenCalled();
      onClick.mockImplementation(() => {});
      await user.click(next());
      expect(onStepChange.mock.calls).toEqual([[2]]);
      onClick.mockImplementation((event: React.MouseEvent) => event.preventDefault());
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onFinish).not.toHaveBeenCalled();
      onClick.mockImplementation(() => {});
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(onFinish).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(4);
    });

    it('locks its type, its primary look, its disabled states, hidden state and tab stop', () => {
      render(
        <TeachingPopover
          steps={steps}
          slotProps={{
            nextButton: {
              type: 'submit',
              disabled: true,
              tabIndex: -1,
              hidden: true,
              inert: true,
              'aria-hidden': true,
              'aria-disabled': true,
              'data-disabled': '',
              'data-disabled-focusable': '',
              appearance: 'outline',
              disabledFocusable: true,
              title: 'Next step',
            } as never,
          }}
        />,
      );
      const el = next();
      expect(el).toHaveAttribute('type', 'button');
      expect(el).toHaveClass('bg-primary', 'text-primary-foreground');
      for (const name of [
        'disabled',
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'data-disabled',
        'data-disabled-focusable',
        'appearance',
      ]) {
        expect(el, name).not.toHaveAttribute(name);
      }
      expect(el).toHaveAttribute('title', 'Next step');
    });
  });
});

describe('TeachingPopover.CarouselNav — slotProps', () => {
  type NavSlotProps = NonNullable<TeachingPopoverCarouselNavProps['slotProps']>;
  const buttons = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.' + teachingPopoverCarouselNavClassNames.button),
    );
  const indicators = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('.' + teachingPopoverCarouselNavClassNames.indicator),
    );

  function Nav({
    slotProps,
    ...props
  }: Partial<TeachingPopoverProps> & { slotProps?: NavSlotProps }) {
    return (
      <TeachingPopover steps={steps} defaultActiveStep={1} {...props}>
        <TeachingPopover.Surface>
          <TeachingPopover.Title />
          <TeachingPopover.CarouselNav slotProps={slotProps} />
        </TeachingPopover.Surface>
      </TeachingPopover>
    );
  }

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps((slotProps) => <Nav slotProps={slotProps} />, {
      button: {},
      indicator: {},
    });
  });

  it('puts your className, style and data-* on every button and indicator', () => {
    render(
      <Nav
        slotProps={{
          button: { className: 'my-button', style: { opacity: 0.5 }, 'data-part': 'button' },
          indicator: { className: 'my-indicator', style: { opacity: 0.25 }, 'data-part': 'dot' },
        }}
      />,
    );
    expect(buttons()).toHaveLength(3);
    expect(indicators()).toHaveLength(3);
    for (const [elements, stable, mine, data, opacity] of [
      [buttons(), teachingPopoverCarouselNavClassNames.button, 'my-button', 'button', '0.5'],
      [indicators(), teachingPopoverCarouselNavClassNames.indicator, 'my-indicator', 'dot', '0.25'],
    ] as const) {
      for (const element of elements) {
        expect(element.classList[0]).toBe(stable);
        expect(element.classList[element.classList.length - 1]).toBe(mine);
        expect(element).toHaveAttribute('data-part', data);
        expect(element).toHaveStyle({ opacity });
      }
    }
    expect(screen.getByRole('group', { name: 'Choose step' })).not.toHaveAttribute('data-part');
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <Nav slotProps={{ button: { className: 'min-w-8' }, indicator: { className: 'h-2' } }} />,
    );
    for (const button of buttons()) {
      expect(button).toHaveClass('min-w-8');
      expect(button).not.toHaveClass('min-w-6');
    }
    for (const indicator of indicators()) {
      expect(indicator).toHaveClass('h-2');
      expect(indicator).not.toHaveClass('h-1.5');
    }
  });

  it('locks the buttons’ type, name and step state, and their disabled and hidden state', () => {
    render(
      <Nav
        slotProps={{
          button: {
            type: 'submit',
            'aria-label': 'Other',
            'aria-current': 'page',
            disabled: true,
            tabIndex: -1,
            hidden: true,
            inert: true,
            'aria-hidden': true,
            'aria-disabled': true,
            'data-disabled': '',
            'data-disabled-focusable': '',
            title: 'Step',
          },
          indicator: { 'aria-hidden': false, tabIndex: 0 },
        }}
      />,
    );
    buttons().forEach((button, index) => {
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', `Step ${index + 1} of 3`);
      if (index === 1) expect(button).toHaveAttribute('aria-current', 'step');
      else expect(button).not.toHaveAttribute('aria-current');
      for (const name of [
        'disabled',
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
        'aria-disabled',
        'data-disabled',
        'data-disabled-focusable',
      ]) {
        expect(button, name).not.toHaveAttribute(name);
      }
      expect(button).toHaveAttribute('title', 'Step');
    });
    for (const indicator of indicators()) {
      expect(indicator).toHaveAttribute('aria-hidden', 'true');
      expect(indicator).not.toHaveAttribute('tabindex');
    }
  });

  it('runs your button onClick before the step change: preventDefault() skips it', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<Nav onStepChange={onStepChange} slotProps={{ button: { onClick } }} />);
    await user.click(screen.getByRole('button', { name: 'Step 3 of 3' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onStepChange).not.toHaveBeenCalled();
    onClick.mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Step 3 of 3' }));
    expect(onStepChange.mock.calls).toEqual([[2]]);
  });

  it('runs your indicator onClick first: preventDefault() skips the step change of its button', async () => {
    const user = userEvent.setup();
    const onStepChange = vi.fn();
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<Nav onStepChange={onStepChange} slotProps={{ indicator: { onClick } }} />);
    await user.click(indicators()[2]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onStepChange).not.toHaveBeenCalled();
    onClick.mockImplementation(() => {});
    await user.click(indicators()[2]);
    expect(onStepChange.mock.calls).toEqual([[2]]);
  });

  it('attaches your refs to every button and indicator', () => {
    const buttonElements: Array<HTMLButtonElement | null> = [];
    const indicatorElements: Array<HTMLSpanElement | null> = [];
    render(
      <Nav
        slotProps={{
          button: { ref: (element) => void buttonElements.push(element) },
          indicator: { ref: (element) => void indicatorElements.push(element) },
        }}
      />,
    );
    for (const button of buttons()) expect(buttonElements).toContain(button);
    for (const indicator of indicators()) expect(indicatorElements).toContain(indicator);
  });

  it('calls your part handlers once per click in StrictMode', () => {
    const onButton = vi.fn();
    const onIndicator = vi.fn();
    render(
      <React.StrictMode>
        <Nav slotProps={{ button: { onClick: onButton }, indicator: { onClick: onIndicator } }} />
      </React.StrictMode>,
    );
    fireEvent.click(indicators()[0]);
    expect(onIndicator).toHaveBeenCalledTimes(1);
    expect(onButton).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <Nav
        slotProps={{ button: { className: 'my-button' }, indicator: { className: 'my-dot' } }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof NavSlotProps>().toEqualTypeOf<'button' | 'indicator'>();
    expectTypeOf<NonNullable<NavSlotProps['button']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<NavSlotProps['indicator']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the indicator is the nav's drawing
    void (<TeachingPopover.CarouselNav slotProps={{ indicator: { children: '•' } }} />);
  });
});
