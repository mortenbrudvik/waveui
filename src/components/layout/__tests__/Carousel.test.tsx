import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carousel, CarouselItem } from '../Carousel';
import type {
  CarouselAutoPlayLabels,
  CarouselItemProps,
  CarouselLabels,
  CarouselProps,
} from '../Carousel';
import {
  asClientReference,
  expectNoA11yViolations,
  mockMatchMedia,
  mockRect,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';
import { getTabbableElements } from '../../../lib/focus';
import { installResizeObserverMock } from '../../../test-utils';

const threeSlides = [
  <Carousel.Item key="1">
    <p>First slide</p>
    <a href="#first">First link</a>
  </Carousel.Item>,
  <Carousel.Item key="2">
    <p>Second slide</p>
    <button type="button">Second action</button>
  </Carousel.Item>,
  <Carousel.Item key="3">
    <p>Third slide</p>
    <a href="#third">Third link</a>
  </Carousel.Item>,
];

function slides(n: number) {
  return Array.from({ length: n }, (_, i) => (
    <Carousel.Item key={i}>
      <p>Slide {i + 1} content</p>
    </Carousel.Item>
  ));
}

function region() {
  return screen.getByRole('region');
}
function liveRegion() {
  const el = region().querySelector('[aria-live]');
  if (!el) throw new Error('no live region');
  return el;
}
function slideGroups() {
  return Array.from(region().querySelectorAll<HTMLElement>('[aria-roledescription="slide"]'));
}
function exposedSlides() {
  return slideGroups()
    .map((slide, i) => (slide.hasAttribute('aria-hidden') ? null : i + 1))
    .filter((n) => n !== null);
}
function dots() {
  return within(screen.getByRole('group', { name: 'Choose slide' })).getAllByRole('button');
}
function currentDot() {
  return dots().find((dot) => dot.getAttribute('aria-current') === 'true');
}
function track() {
  const el = region().querySelector<HTMLElement>('[style*="translateX"]');
  if (!el) throw new Error('no track');
  return el;
}
const prevButton = () => screen.getByRole('button', { name: 'Previous slide' });
const nextButton = () => screen.getByRole('button', { name: 'Next slide' });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Carousel', () => {
  testSystemProps(Carousel, {
    expectedTag: 'div',
    displayName: 'Carousel',
    defaultProps: { 'aria-label': 'Featured', children: threeSlides },
    a11yVariants: [
      { name: 'second slide shown, others hidden', props: { defaultValue: 1 } },
      { name: 'autoplay with rotation control', props: { autoPlay: true, loop: true } },
    ],
  });

  testCompoundExposure(Carousel, ['Item']);

  testNoImplicitSubmit(Carousel, {
    defaultProps: { autoPlay: true, children: threeSlides },
  });

  it('exports the flat sub-component name (C-COMPOUND)', () => {
    expect(CarouselItem).toBe(Carousel.Item);
    expect(CarouselItem.displayName).toBe('CarouselItem');
  });

  it('is a labelled carousel region', () => {
    render(<Carousel aria-label="Featured">{threeSlides}</Carousel>);
    expect(region()).toHaveAttribute('aria-roledescription', 'carousel');
    expect(region()).toHaveAccessibleName('Featured');
  });

  it('defaults the region name to "Carousel"', () => {
    render(<Carousel>{threeSlides}</Carousel>);
    expect(region()).toHaveAccessibleName('Carousel');
  });

  it('renders slides as labelled groups', () => {
    render(<Carousel>{threeSlides}</Carousel>);
    expect(slideGroups().map((slide) => slide.getAttribute('aria-label'))).toEqual([
      'Slide 1 of 3',
      'Slide 2 of 3',
      'Slide 3 of 3',
    ]);
  });

  describe('inactive slides (layout#22)', () => {
    it('hides inactive slides from assistive technology and makes them inert', () => {
      render(<Carousel defaultValue={1}>{threeSlides}</Carousel>);
      const [first, second, third] = slideGroups();
      expect(first).toHaveAttribute('aria-hidden', 'true');
      expect(first).toHaveAttribute('inert');
      expect(third).toHaveAttribute('aria-hidden', 'true');
      expect(third).toHaveAttribute('inert');
      expect(second).not.toHaveAttribute('aria-hidden');
      expect(second).not.toHaveAttribute('inert');
    });

    it('keeps controls in inactive slides out of the Tab order', () => {
      render(<Carousel defaultValue={1}>{threeSlides}</Carousel>);
      const tabbables = getTabbableElements(region());
      expect(tabbables).toContain(screen.getByRole('button', { name: 'Second action' }));
      const links = region().querySelectorAll('a');
      for (const link of Array.from(links)) expect(tabbables).not.toContain(link);
    });
  });

  describe('navigation (layout#29)', () => {
    it('Next moves to the next slide and updates the live region, dots, buttons and slides', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Carousel onValueChange={onValueChange}>{threeSlides}</Carousel>);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
      expect(prevButton()).toHaveAttribute('aria-disabled', 'true');

      await user.click(nextButton());

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith(1);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');
      expect(currentDot()).toHaveAccessibleName('Slide 2 of 3');
      expect(prevButton()).not.toHaveAttribute('aria-disabled');
      expect(nextButton()).not.toHaveAttribute('aria-disabled');
      expect(exposedSlides()).toEqual([2]);
      expect(track().style.transform).toBe('translateX(-100%)');
    });

    it('Previous moves to the previous slide', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel defaultValue={1} onValueChange={onValueChange}>
          {threeSlides}
        </Carousel>,
      );
      await user.click(prevButton());
      expect(onValueChange).toHaveBeenCalledWith(0);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
      expect(currentDot()).toHaveAccessibleName('Slide 1 of 3');
      expect(prevButton()).toHaveAttribute('aria-disabled', 'true');
      expect(exposedSlides()).toEqual([1]);
    });

    it('a dot moves to its slide', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Carousel onValueChange={onValueChange}>{threeSlides}</Carousel>);
      await user.click(screen.getByRole('button', { name: 'Slide 3 of 3' }));
      expect(onValueChange).toHaveBeenCalledWith(2);
      expect(liveRegion()).toHaveTextContent('Slide 3 of 3');
      expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
      expect(exposedSlides()).toEqual([3]);
    });

    it('loops from the last slide to the first with Next', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel defaultValue={2} loop onValueChange={onValueChange}>
          {threeSlides}
        </Carousel>,
      );
      expect(nextButton()).not.toHaveAttribute('aria-disabled');
      await user.click(nextButton());
      expect(onValueChange).toHaveBeenCalledWith(0);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
    });

    it('loops from the first slide to the last with Previous', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel loop onValueChange={onValueChange}>
          {threeSlides}
        </Carousel>,
      );
      expect(prevButton()).not.toHaveAttribute('aria-disabled');
      await user.click(prevButton());
      expect(onValueChange).toHaveBeenCalledWith(2);
      expect(liveRegion()).toHaveTextContent('Slide 3 of 3');
      expect(currentDot()).toHaveAccessibleName('Slide 3 of 3');
      expect(exposedSlides()).toEqual([3]);
    });

    it('does not call onValueChange when the current dot is activated again (C-NAMING)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Carousel onValueChange={onValueChange}>{threeSlides}</Carousel>);
      await user.click(screen.getByRole('button', { name: 'Slide 1 of 3' }));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('calls onValueChange once per interaction in StrictMode', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <Carousel onValueChange={onValueChange}>{threeSlides}</Carousel>
        </React.StrictMode>,
      );
      await user.click(nextButton());
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('controlled: renders the value prop', () => {
      render(<Carousel value={1}>{threeSlides}</Carousel>);
      expect(currentDot()).toHaveAccessibleName('Slide 2 of 3');
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');
    });
  });

  describe('previous/next at the ends (layout#26)', () => {
    it('uses aria-disabled instead of disabled, so focus stays on Next at the last slide', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel defaultValue={1} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      act(() => {
        nextButton().focus();
      });
      await user.keyboard('{Enter}');
      expect(onValueChange).toHaveBeenLastCalledWith(2);
      expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
      expect(nextButton()).not.toBeDisabled();
      expect(nextButton()).toHaveFocus();

      await user.keyboard('{Enter}');
      await user.click(nextButton());
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(liveRegion()).toHaveTextContent('Slide 3 of 3');
    });

    it('Previous is aria-disabled on the first slide and does nothing', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<Carousel onValueChange={onValueChange}>{slides(3)}</Carousel>);
      expect(prevButton()).toHaveAttribute('aria-disabled', 'true');
      expect(prevButton()).not.toBeDisabled();
      await user.click(prevButton());
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('gates hover styles so aria-disabled buttons do not react to hover', () => {
      render(<Carousel>{slides(2)}</Carousel>);
      for (const button of [prevButton(), nextButton()]) {
        expect(button).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-hover');
        expect(button.className).not.toMatch(/(^|\s)hover:/);
      }
    });
  });

  describe('slide picker dots (layout#24, layout#25)', () => {
    it('renders plain buttons in a "Choose slide" group with aria-current on the active one', () => {
      render(<Carousel defaultValue={1}>{threeSlides}</Carousel>);
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
        'Slide 1 of 3',
        'Slide 2 of 3',
        'Slide 3 of 3',
      ]);
      expect(dots().map((dot) => dot.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    });

    it('gives each dot a 24px hit area, a 3:1 inactive color and a wider active pill', () => {
      render(<Carousel defaultValue={1}>{threeSlides}</Carousel>);
      const [inactive, active] = dots();
      for (const dot of dots()) expect(dot).toHaveClass('h-6', 'min-w-6');
      const inactiveMark = inactive.firstElementChild;
      const activeMark = active.firstElementChild;
      expect(inactiveMark).toHaveClass('w-2', 'bg-stroke-accessible');
      expect(activeMark).toHaveClass('w-5', 'bg-primary');
      expect(activeMark).not.toHaveClass('w-2');
    });
  });

  describe('clamped index (layout#23)', () => {
    it('clamps an out-of-range controlled value to the last slide', () => {
      render(<Carousel value={7}>{threeSlides}</Carousel>);
      expect(liveRegion()).toHaveTextContent('Slide 3 of 3');
      expect(currentDot()).toHaveAccessibleName('Slide 3 of 3');
      expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
      expect(exposedSlides()).toEqual([3]);
      expect(track().style.transform).toBe('translateX(-200%)');
    });

    it('clamps when slides are removed, and interactions start from the clamped index', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <Carousel defaultValue={2} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      rerender(<Carousel onValueChange={onValueChange}>{slides(2)}</Carousel>);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 2');
      expect(exposedSlides()).toEqual([2]);
      expect(nextButton()).toHaveAttribute('aria-disabled', 'true');

      await user.click(prevButton());
      expect(onValueChange).toHaveBeenCalledWith(0);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 2');
    });

    it('does not report a change when the shown (clamped) slide is picked again (C-NAMING)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <Carousel defaultValue={2} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      rerender(<Carousel onValueChange={onValueChange}>{slides(2)}</Carousel>);
      expect(currentDot()).toHaveAccessibleName('Slide 2 of 2');

      await user.click(screen.getByRole('button', { name: 'Slide 2 of 2' }));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(liveRegion()).toHaveTextContent('Slide 2 of 2');
    });
  });

  describe('RTL (layout#27)', () => {
    it('translates the track in the positive direction under dir="rtl"', () => {
      renderWithProviders(<Carousel defaultValue={1}>{threeSlides}</Carousel>, { dir: 'rtl' });
      expect(track().style.transform).toBe('translateX(100%)');
    });

    it('translates the track in the negative direction under dir="ltr"', () => {
      renderWithProviders(<Carousel defaultValue={1}>{threeSlides}</Carousel>, { dir: 'ltr' });
      expect(track().style.transform).toBe('translateX(-100%)');
    });

    it('honours a dir prop on the carousel itself', () => {
      render(
        <Carousel dir="rtl" defaultValue={2}>
          {threeSlides}
        </Carousel>,
      );
      expect(track().style.transform).toBe('translateX(200%)');
    });

    it('follows an ancestor dir attribute outside a WaveProvider', () => {
      render(
        <div dir="rtl">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </div>,
      );
      expect(track().style.transform).toBe('translateX(100%)');
    });

    it('follows an RTL section inside an LTR WaveProvider (and the reverse)', () => {
      const { unmount } = renderWithProviders(
        <div dir="rtl">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </div>,
        { dir: 'ltr' },
      );
      expect(track().style.transform).toBe('translateX(100%)');
      unmount();

      renderWithProviders(
        <div dir="ltr">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </div>,
        { dir: 'rtl' },
      );
      expect(track().style.transform).toBe('translateX(-100%)');
    });

    it('follows a later change of an ancestor dir attribute', async () => {
      render(
        <section data-testid="section" dir="ltr">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </section>,
      );
      expect(track().style.transform).toBe('translateX(-100%)');
      await act(async () => {
        screen.getByTestId('section').setAttribute('dir', 'rtl');
      });
      expect(track().style.transform).toBe('translateX(100%)');
    });

    it('lets its own dir prop win over an ancestor', () => {
      render(
        <div dir="rtl">
          <Carousel dir="ltr" defaultValue={1}>
            {threeSlides}
          </Carousel>
        </div>,
      );
      expect(track().style.transform).toBe('translateX(-100%)');
    });

    it('shares one document dir observer between carousels (no per-instance observer)', () => {
      const observe = vi.spyOn(MutationObserver.prototype, 'observe');
      const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
      // The document-wide `dir` observers that are observing and not yet disconnected.
      const liveDirObservers = () => {
        const disconnected = new Set(disconnect.mock.contexts);
        return observe.mock.calls.filter(
          ([target, options], i) =>
            target === document.documentElement &&
            options?.subtree === true &&
            options.attributeFilter?.includes('dir') &&
            !disconnected.has(observe.mock.contexts[i]),
        );
      };
      try {
        const { unmount } = render(
          <div dir="rtl">
            <Carousel defaultValue={1}>{threeSlides}</Carousel>
            <Carousel defaultValue={1}>{slides(2)}</Carousel>
            <Carousel defaultValue={1}>{slides(4)}</Carousel>
          </div>,
        );
        expect(liveDirObservers()).toHaveLength(1);
        for (const el of screen
          .getAllByRole('region')
          .map((r) => r.querySelector<HTMLElement>('[style*="translateX"]'))) {
          expect(el?.style.transform).toBe('translateX(100%)');
        }
        unmount();
        expect(liveDirObservers()).toHaveLength(0);
      } finally {
        observe.mockRestore();
        disconnect.mockRestore();
      }
    });

    /** The chevron of a control: its icon name and whether it is mirrored (or left to CSS `rtl:`). */
    function chevron(button: HTMLElement) {
      const svg = button.querySelector('svg');
      if (!svg) throw new Error('no chevron');
      const classes = (svg.getAttribute('class') ?? '').split(/\s+/);
      return {
        icon: svg.getAttribute('data-wave-icon'),
        mirrored: classes.includes('-scale-x-100'),
        cssDirectionVariant: classes.some((c) => c.startsWith('rtl:') || c.startsWith('ltr:')),
      };
    }

    it('places previous/next with logical insets and mirrors the chevrons', () => {
      renderWithProviders(<Carousel>{threeSlides}</Carousel>, { dir: 'rtl' });
      expect(prevButton()).toHaveClass('start-2');
      expect(nextButton()).toHaveClass('end-2');
      // Previous (at the start, the right edge) points right; Next points left.
      expect(chevron(prevButton())).toEqual({
        icon: 'chevron-left',
        mirrored: true,
        cssDirectionVariant: false,
      });
      expect(chevron(nextButton())).toEqual({
        icon: 'chevron-right',
        mirrored: true,
        cssDirectionVariant: false,
      });
    });

    it('mirrors the chevrons by the direction the carousel resolved, not by any RTL ancestor', () => {
      // An LTR section inside an RTL provider: a CSS `rtl:` variant (`[dir=rtl] *`) would still
      // match here and mirror the chevrons while the track slides LTR.
      const { unmount } = renderWithProviders(
        <div dir="ltr">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </div>,
        { dir: 'rtl' },
      );
      expect(track().style.transform).toBe('translateX(-100%)');
      for (const button of [prevButton(), nextButton()]) {
        expect(chevron(button)).toMatchObject({ mirrored: false, cssDirectionVariant: false });
      }
      unmount();

      // The carousel's own dir prop inside an RTL provider behaves the same.
      const second = renderWithProviders(
        <Carousel dir="ltr" defaultValue={1}>
          {threeSlides}
        </Carousel>,
        { dir: 'rtl' },
      );
      expect(track().style.transform).toBe('translateX(-100%)');
      expect(chevron(prevButton()).mirrored).toBe(false);
      expect(chevron(nextButton()).mirrored).toBe(false);
      second.unmount();

      // And the reverse: an RTL section inside an LTR provider mirrors them.
      renderWithProviders(
        <div dir="rtl">
          <Carousel defaultValue={1}>{threeSlides}</Carousel>
        </div>,
        { dir: 'ltr' },
      );
      expect(track().style.transform).toBe('translateX(100%)');
      expect(chevron(prevButton()).mirrored).toBe(true);
      expect(chevron(nextButton()).mirrored).toBe(true);
    });

    it('updates the chevrons when an ancestor dir attribute changes later', async () => {
      render(
        <section data-testid="section" dir="ltr">
          <Carousel>{threeSlides}</Carousel>
        </section>,
      );
      expect(chevron(prevButton()).mirrored).toBe(false);
      await act(async () => {
        screen.getByTestId('section').setAttribute('dir', 'rtl');
      });
      expect(chevron(prevButton()).mirrored).toBe(true);
      expect(chevron(nextButton()).mirrored).toBe(true);
    });
  });

  describe('autoplay (layout#20)', () => {
    it('advances every interval', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(1);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(2);
      expect(onValueChange).toHaveBeenCalledTimes(2);
    });

    it('wraps to the first slide when loop is set', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(2)}
        </Carousel>,
      );
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [0]]);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 2');
    });

    it('stops at the last slide without loop (no repeated onValueChange)', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(2)}
        </Carousel>,
      );
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(onValueChange.mock.calls).toEqual([[1]]);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 2');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('shows the stopped state at the last slide, and Start restarts from the first (layout#21)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Pause slide rotation' })).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [2]]);

      // Rotation has ended: the control offers Start, and the live region is polite again.
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      expect(vi.getTimerCount()).toBe(0);

      await user.click(toggle);
      expect(onValueChange).toHaveBeenLastCalledWith(0);
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(1);
    });

    it('stays stopped after moving back from the last slide; only Start resumes (layout#21)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <>
          <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
            {slides(3)}
          </Carousel>
          <button type="button">Outside</button>
        </>,
      );
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [2]]);
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });

      // Previous from the last slide is a manual step, not a Start: rotation stays ended.
      await user.click(prevButton());
      expect(onValueChange).toHaveBeenLastCalledWith(1);
      expect(toggle).toHaveAccessibleName('Start slide rotation');

      // Leaving (pointer and focus) does not resume it either.
      await user.unhover(region());
      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });
      expect(toggle).toHaveAccessibleName('Start slide rotation');
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange).toHaveBeenCalledTimes(3);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');

      // Start resumes from the shown slide (not the last one, so no jump to the first).
      await user.click(toggle);
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(onValueChange).toHaveBeenCalledTimes(3);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(2);
      expect(toggle).toHaveAccessibleName('Start slide rotation');
    });

    it('starts ended on the last slide without loop, and Previous does not start it', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay autoPlayInterval={1000} defaultValue={2} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
      await user.click(prevButton());
      await user.unhover(region());
      act(() => {
        prevButton().blur();
      });
      expect(toggle).toHaveAccessibleName('Start slide rotation');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange.mock.calls).toEqual([[1]]);
    });

    it('continues when slides are appended after rotation ended, and ends at the new last slide (layout#21)', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      const ui = (count: number) => (
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(count)}
        </Carousel>
      );
      const { rerender } = render(ui(2));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
      expect(onValueChange.mock.calls).toEqual([[1]]);

      // Lazy-loaded slides: slide 2 is no longer the last one, so the end no longer applies.
      rerender(ui(4));
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [2], [3]]);
      expect(liveRegion()).toHaveTextContent('Slide 4 of 4');
      expect(toggle).toHaveAccessibleName('Start slide rotation');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('continues when loop is turned on after rotation ended (layout#21)', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      const ui = (loop: boolean) => (
        <Carousel autoPlay loop={loop} autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(2)}
        </Carousel>
      );
      const { rerender } = render(ui(false));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });

      rerender(ui(true));
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [0]]);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 2');
    });

    it('keeps the user pause when slides are appended or loop is turned on (layout#21)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      const ui = (count: number, loop: boolean) => (
        <>
          <Carousel autoPlay loop={loop} autoPlayInterval={1000} onValueChange={onValueChange}>
            {slides(count)}
          </Carousel>
          <button type="button">Outside</button>
        </>
      );
      const { rerender } = render(ui(3, false));
      const toggle = screen.getByRole('button', { name: 'Pause slide rotation' });
      await user.click(toggle);
      await user.unhover(region());
      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });

      rerender(ui(5, false));
      rerender(ui(5, true));
      expect(toggle).toHaveAccessibleName('Start slide rotation');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does nothing with a single slide', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(1)}
        </Carousel>,
      );
      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /slide rotation/ })).toBeNull();
    });

    it('clears its timer on unmount', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      const { unmount } = render(
        <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(5000);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not restart its timer when the parent re-renders with a new callback', () => {
      vi.useFakeTimers();
      const calls: number[] = [];
      function Parent({ tick }: { tick: number }) {
        return (
          <Carousel
            autoPlay
            autoPlayInterval={1000}
            data-tick={tick}
            onValueChange={(index) => calls.push(index)}
          >
            {slides(3)}
          </Carousel>
        );
      }
      const { rerender } = render(<Parent tick={0} />);
      for (let tick = 1; tick <= 4; tick++) {
        act(() => {
          vi.advanceTimersByTime(300);
        });
        rerender(<Parent tick={tick} />);
      }
      // 1200ms elapsed with a re-render every 300ms: the 1000ms timer fired once.
      expect(calls).toEqual([1]);
    });

    it('advances a controlled carousel whose parent accepts the value', () => {
      vi.useFakeTimers();
      function Controlled() {
        const [value, setValue] = React.useState(0);
        return (
          <Carousel autoPlay autoPlayInterval={1000} value={value} onValueChange={setValue}>
            {slides(3)}
          </Carousel>
        );
      }
      render(<Controlled />);
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(liveRegion()).toHaveTextContent('Slide 3 of 3');
    });
  });

  describe('rotation control (layout#21)', () => {
    it('renders a Pause/Start toggle as the first focusable element', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Carousel autoPlay loop>
          {threeSlides}
        </Carousel>,
      );
      const toggle = screen.getByRole('button', { name: 'Pause slide rotation' });
      expect(getTabbableElements(region())[0]).toBe(toggle);

      await user.click(toggle);
      expect(screen.getByRole('button', { name: 'Start slide rotation' })).toBe(toggle);
    });

    it('accepts custom labels for both states', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Carousel
          autoPlay
          loop
          autoPlayLabels={{ pause: 'Stop slideshow', play: 'Play slideshow' }}
        >
          {threeSlides}
        </Carousel>,
      );
      const toggle = screen.getByRole('button', { name: 'Stop slideshow' });
      await user.click(toggle);
      expect(toggle).toHaveAccessibleName('Play slideshow');
      expect(screen.queryByRole('button', { name: /slide rotation/ })).toBeNull();
      await user.click(toggle);
      expect(toggle).toHaveAccessibleName('Stop slideshow');
    });

    it('uses the custom play label when it starts stopped under reduced motion', () => {
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      render(
        <Carousel autoPlay loop autoPlayLabels={{ play: 'Play slideshow' }}>
          {threeSlides}
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Play slideshow' })).toHaveAttribute(
        'data-carousel-rotation',
      );
    });

    it('does not render a rotation control without autoPlay', () => {
      render(<Carousel>{threeSlides}</Carousel>);
      expect(screen.queryByRole('button', { name: /slide rotation/ })).toBeNull();
    });

    it('turns the live region off while rotating and polite when paused', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Carousel autoPlay loop>
          {threeSlides}
        </Carousel>,
      );
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');

      await user.click(screen.getByRole('button', { name: 'Pause slide rotation' }));
      await user.unhover(region());
      fireEvent.blur(screen.getByRole('button', { name: 'Start slide rotation' }));
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    });

    it('is polite without autoPlay', () => {
      render(<Carousel>{threeSlides}</Carousel>);
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    });

    it('stops rotating when the user pauses, and stays stopped after the pointer leaves', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      await user.click(screen.getByRole('button', { name: 'Pause slide rotation' }));
      await user.unhover(region());
      act(() => {
        screen.getByRole('button', { name: 'Start slide rotation' }).blur();
      });
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Start slide rotation' }));
      await user.unhover(region());
      act(() => {
        screen.getByRole('button', { name: 'Pause slide rotation' }).blur();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);
    });

    it('pauses while hovered and resumes when the pointer leaves', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      fireEvent.mouseEnter(region());
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).not.toHaveBeenCalled();

      fireEvent.mouseLeave(region());
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);
    });

    it('pauses while focus is inside and resumes when focus leaves', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      render(
        <>
          <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
            {slides(3)}
          </Carousel>
          <button type="button">Outside</button>
        </>,
      );
      act(() => {
        nextButton().focus();
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).not.toHaveBeenCalled();

      // Moving focus between controls inside keeps it paused.
      act(() => {
        prevButton().focus();
      });
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).not.toHaveBeenCalled();

      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);
    });

    it('stays paused after a click on Next until focus leaves (a click focuses the button)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <>
          <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
            {slides(3)}
          </Carousel>
          <button type="button">Outside</button>
        </>,
      );
      await user.click(nextButton());
      expect(onValueChange.mock.calls).toEqual([[1]]);
      expect(nextButton()).toHaveFocus();

      // The pointer has left, but focus is still on Next: still paused, not stopped.
      await user.unhover(region());
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByRole('button', { name: 'Pause slide rotation' })).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).toHaveBeenCalledTimes(1);

      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(2);
    });

    it('pauses when keyboard focus reaches the rotation control, like any element inside (APG)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      render(
        <>
          <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
            {slides(3)}
          </Carousel>
          <button type="button">Outside</button>
        </>,
      );
      await user.tab();
      const toggle = screen.getByRole('button', { name: 'Pause slide rotation' });
      expect(toggle).toHaveFocus();
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).not.toHaveBeenCalled();

      // Leaving resumes (the user did not stop it).
      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);
    });

    it('Start on the rotation control rotates while focus stays there; moving on pauses again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onValueChange = vi.fn();
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      // Keyboard user: Tab to the control (first stop) and press Start.
      await user.tab();
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
      expect(toggle).toHaveFocus();
      await user.keyboard('{Enter}');
      // An explicit Start takes effect at once (APG: rotation resumes when the user activates the
      // rotation control), so the "Pause" name matches what happens.
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);

      // Moving on to another control inside pauses again.
      await user.tab();
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      const calls = onValueChange.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).toHaveBeenCalledTimes(calls);
    });

    it('a Start click that did not move focus does not exempt a later keyboard visit', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>,
      );
      // A mouse click in Safari activates the button without focusing it.
      fireEvent.click(screen.getByRole('button', { name: 'Start slide rotation' }));
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');

      // Later, keyboard focus enters on the control: it pauses like any focus inside.
      act(() => {
        screen.getByRole('button', { name: 'Pause slide rotation' }).focus();
      });
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not pause while the pointer is over the rotation control itself (APG)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Carousel autoPlay loop autoPlayInterval={1000}>
          {threeSlides}
        </Carousel>,
      );
      await user.hover(screen.getByRole('button', { name: 'Pause slide rotation' }));
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      await user.hover(screen.getByText('First slide'));
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    });

    it('starts paused when the user prefers reduced motion', async () => {
      vi.useFakeTimers();
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
      const onValueChange = vi.fn();
      render(
        <Carousel autoPlay loop autoPlayInterval={1000} onValueChange={onValueChange}>
          {threeSlides}
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Start slide rotation' })).toBeInTheDocument();
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange).not.toHaveBeenCalled();
      vi.useRealTimers();
      await expectNoA11yViolations();
    });

    it('composes consumer focus and pointer handlers with the pause behaviour (C-COMPOSE)', () => {
      vi.useFakeTimers();
      const onMouseEnter = vi.fn();
      const onFocus = vi.fn();
      render(
        <Carousel autoPlay loop onMouseEnter={onMouseEnter} onFocus={onFocus}>
          {slides(3)}
        </Carousel>,
      );
      fireEvent.mouseEnter(region());
      expect(onMouseEnter).toHaveBeenCalledTimes(1);
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      fireEvent.mouseLeave(region());
      act(() => {
        nextButton().focus();
      });
      expect(onFocus).toHaveBeenCalled();
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    });

    it('composes consumer blur and pointer-leave handlers with the resume behaviour (C-COMPOSE)', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      const onBlur = vi.fn();
      const onMouseLeave = vi.fn();
      render(
        <>
          <Carousel
            autoPlay
            loop
            autoPlayInterval={1000}
            onValueChange={onValueChange}
            onBlur={onBlur}
            onMouseLeave={onMouseLeave}
          >
            {slides(3)}
          </Carousel>
          <button type="button">Outside</button>
        </>,
      );
      // Focus leaves the carousel: the consumer onBlur runs and rotation resumes.
      act(() => {
        nextButton().focus();
      });
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      act(() => {
        screen.getByRole('button', { name: 'Outside' }).focus();
      });
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange.mock.calls).toEqual([[1]]);

      // The pointer leaves: the consumer onMouseLeave runs and rotation resumes.
      fireEvent.mouseEnter(region());
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      fireEvent.mouseLeave(region());
      expect(onMouseLeave).toHaveBeenCalledTimes(1);
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange.mock.calls).toEqual([[1], [2]]);
    });
  });

  describe('without slides', () => {
    it('calls the consumer pointer and focus handlers on the empty root (C-COMPOSE)', () => {
      const onMouseEnter = vi.fn();
      const onMouseLeave = vi.fn();
      const onFocus = vi.fn();
      const onBlur = vi.fn();
      render(
        <Carousel
          aria-label="Loading slides"
          data-testid="empty"
          tabIndex={-1}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          onBlur={onBlur}
        />,
      );
      const root = screen.getByTestId('empty');
      fireEvent.mouseEnter(root);
      fireEvent.mouseLeave(root);
      act(() => {
        root.focus();
      });
      act(() => {
        root.blur();
      });
      expect(onMouseEnter).toHaveBeenCalledTimes(1);
      expect(onMouseLeave).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('does not stay paused when the pointer left while the slides were being reloaded', () => {
      vi.useFakeTimers();
      const onValueChange = vi.fn();
      const ui = (count: number) => (
        <Carousel
          data-testid="carousel"
          autoPlay
          loop
          autoPlayInterval={1000}
          onValueChange={onValueChange}
        >
          {slides(count)}
        </Carousel>
      );
      const { rerender } = render(ui(3));
      fireEvent.mouseEnter(screen.getByTestId('carousel'));
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');

      // A refetch empties the slides; the pointer leaves meanwhile; the slides come back.
      rerender(ui(0));
      fireEvent.mouseLeave(screen.getByTestId('carousel'));
      rerender(ui(3));

      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenCalledWith(1);
    });
  });

  it('isolates its stacking context, so the controls stay under page headers', () => {
    render(<Carousel aria-label="Featured">{threeSlides}</Carousel>);
    expect(region()).toHaveClass('relative', 'isolate', 'overflow-hidden');
    // The controls' z-index is local to the carousel.
    expect(nextButton()).toHaveClass('z-10');
  });

  describe('localizable names (C-NAMING)', () => {
    const german: CarouselLabels = {
      previous: 'Vorherige Folie',
      next: 'Nächste Folie',
      picker: 'Folie auswählen',
      slide: (index, total) => `Folie ${index + 1} von ${total}`,
    };

    it('uses custom names for Previous, Next, the picker, the slides, the dots and the live region', async () => {
      const user = userEvent.setup();
      render(
        <Carousel aria-label="Angebote" labels={german}>
          {threeSlides}
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Vorherige Folie' })).toBeInTheDocument();
      const next = screen.getByRole('button', { name: 'Nächste Folie' });
      const picker = screen.getByRole('group', { name: 'Folie auswählen' });
      expect(
        within(picker)
          .getAllByRole('button')
          .map((dot) => dot.getAttribute('aria-label')),
      ).toEqual(['Folie 1 von 3', 'Folie 2 von 3', 'Folie 3 von 3']);
      expect(slideGroups().map((slide) => slide.getAttribute('aria-label'))).toEqual([
        'Folie 1 von 3',
        'Folie 2 von 3',
        'Folie 3 von 3',
      ]);
      expect(liveRegion()).toHaveTextContent('Folie 1 von 3');

      await user.click(next);
      expect(liveRegion()).toHaveTextContent('Folie 2 von 3');
      expect(screen.queryByText(/Slide \d of \d/)).toBeNull();
      expect(screen.queryByRole('button', { name: /slide/i })).toBeNull();
      await expectNoA11yViolations();
    });

    it('keeps the English default for every name that is not given', () => {
      render(
        <Carousel aria-label="Angebote" labels={{ next: 'Weiter' }}>
          {threeSlides}
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
      expect(prevButton()).toBeInTheDocument();
      expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
        'Slide 1 of 3',
        'Slide 2 of 3',
        'Slide 3 of 3',
      ]);
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
      expect(region()).toHaveAttribute('aria-roledescription', 'carousel');
      expect(slideGroups()).toHaveLength(3);
    });

    it('uses custom role descriptions for the carousel and its slides', async () => {
      render(
        <Carousel
          aria-label="Angebote"
          labels={{ carouselRoleDescription: 'Karussell', slideRoleDescription: 'Folie' }}
        >
          {threeSlides}
        </Carousel>,
      );
      expect(region()).toHaveAttribute('aria-roledescription', 'Karussell');
      // The slides are the only elements inside the region with a role description.
      const described = Array.from(region().querySelectorAll('[aria-roledescription]'));
      expect(
        described.map((slide) => [
          slide.getAttribute('aria-label'),
          slide.getAttribute('aria-roledescription'),
        ]),
      ).toEqual([
        ['Slide 1 of 3', 'Folie'],
        ['Slide 2 of 3', 'Folie'],
        ['Slide 3 of 3', 'Folie'],
      ]);
      await expectNoA11yViolations();
    });

    it('types labels as optional members next to autoPlayLabels', () => {
      expectTypeOf<CarouselProps['labels']>().toEqualTypeOf<CarouselLabels | undefined>();
      expectTypeOf<CarouselLabels['slide']>().toEqualTypeOf<
        ((index: number, total: number) => string) | undefined
      >();
      expectTypeOf<CarouselLabels['carouselRoleDescription']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<CarouselLabels['slideRoleDescription']>().toEqualTypeOf<string | undefined>();
      const partial: CarouselLabels = { previous: 'Zurück' };
      // @ts-expect-error slide is a function of the index and the total
      const wrong: CarouselLabels = { slide: 'Folie' };
      expect([partial, wrong]).toHaveLength(2);
    });
  });

  it('declares ref in its exported props (C-REF)', () => {
    expectTypeOf<CarouselProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<CarouselItemProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<CarouselProps['autoPlayLabels']>().toEqualTypeOf<
      CarouselAutoPlayLabels | undefined
    >();
    // A wrapper typed with the exported props keeps ref typing.
    const Wrapper = (props: CarouselProps) => <Carousel {...props} />;
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Wrapper ref={ref} data-testid="wrapped">
        {slides(2)}
      </Wrapper>,
    );
    expect(ref.current).toBe(screen.getByTestId('wrapped'));
  });

  it('renders an empty root without slides', () => {
    render(<Carousel data-testid="empty" />);
    expect(screen.getByTestId('empty')).toBeEmptyDOMElement();
  });

  describe('slides written in a Server Component', () => {
    // A client component written in a Server Component reaches the client as a lazy reference.
    const Item = asClientReference(CarouselItem);
    const plainSlides = ['First', 'Second', 'Third'].map((name) => (
      <CarouselItem key={name}>{`${name} slide`}</CarouselItem>
    ));
    const lazySlides = ['First', 'Second', 'Third'].map((name) => (
      <Item key={name}>{`${name} slide`}</Item>
    ));

    it('server-renders the same HTML as with the plain CarouselItem', () => {
      const plain = renderToString(<Carousel aria-label="Promo">{plainSlides}</Carousel>);
      expect(plain).toContain('First slide');
      expect(renderToString(<Carousel aria-label="Promo">{lazySlides}</Carousel>)).toBe(plain);
    });

    it('renders and navigates the slides like the plain CarouselItem', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel aria-label="Promo" onValueChange={onValueChange}>
          {lazySlides}
        </Carousel>,
      );
      expect(region()).toHaveAccessibleName('Promo');
      expect(slideGroups()).toHaveLength(3);
      await user.click(nextButton());
      expect(onValueChange).toHaveBeenCalledWith(1);
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');
      expect(exposedSlides()).toEqual([2]);
    });
  });

  describe('children that are not slides', () => {
    it('finds slides inside Fragments, nested ones included', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <Carousel aria-label="News">
          <>
            <Carousel.Item>One</Carousel.Item>
            <>
              <Carousel.Item>Two</Carousel.Item>
              {false}
              {null}
            </>
          </>
          <Carousel.Item>Three</Carousel.Item>
        </Carousel>,
      );
      expect(slideGroups().map((slide) => slide.textContent)).toEqual(['One', 'Two', 'Three']);
      expect(dots()).toHaveLength(3);
      expect(warn).not.toHaveBeenCalled();
    });

    it('keeps a Fragment slide mounted when a slide is added before the Fragment (stable keys)', () => {
      const { rerender } = render(
        <Carousel aria-label="News">
          <React.Fragment key="group">
            <Carousel.Item key="a">
              <input aria-label="Draft" defaultValue="" />
            </Carousel.Item>
          </React.Fragment>
        </Carousel>,
      );
      const input = screen.getByRole('textbox', { name: 'Draft' });
      rerender(
        <Carousel aria-label="News">
          <Carousel.Item key="first">First</Carousel.Item>
          <React.Fragment key="group">
            <Carousel.Item key="a">
              <input aria-label="Draft" defaultValue="" />
            </Carousel.Item>
          </React.Fragment>
        </Carousel>,
      );
      expect(screen.getByRole('textbox', { name: 'Draft', hidden: true })).toBe(input);
    });

    it('warns once in development when children other than Carousel.Item are dropped', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      function Slide({ title }: { title: string }) {
        return <Carousel.Item>{title}</Carousel.Item>;
      }
      render(
        <>
          <Carousel aria-label="News" data-testid="wrapped">
            <Slide title="Hidden one" />
            <Slide title="Hidden two" />
          </Carousel>
          <Carousel aria-label="Mixed">
            <Carousel.Item>Kept</Carousel.Item>
            <p>Stray paragraph</p>
          </Carousel>
        </>,
      );
      // A component that renders Carousel.Item itself is not a slide: nothing of it renders.
      expect(screen.getByTestId('wrapped')).toBeEmptyDOMElement();
      expect(screen.queryByText('Stray paragraph')).toBeNull();
      expect(screen.getByRole('region', { name: 'Mixed' })).toHaveTextContent('Kept');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Carousel: only `Carousel.Item` (`CarouselItem`) children are slides, directly ' +
            'or in Fragments; other children are not rendered. A component that renders ' +
            '`Carousel.Item` itself is not recognised: render the `Carousel.Item` in the Carousel ' +
            'and put the component inside it.',
        ],
      ]);
    });

    it('does not warn for Carousel.Item children with nullish, boolean and empty-string children', () => {
      const warn = vi.spyOn(console, 'warn');
      render(
        <Carousel aria-label="News">
          {slides(2)}
          {''}
          {undefined}
          {false}
        </Carousel>,
      );
      expect(slideGroups()).toHaveLength(2);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe('Carousel groups (0.13)', () => {
  const slideElements = () => slideGroups();
  const isExposed = (slide: HTMLElement) =>
    !slide.hasAttribute('aria-hidden') && !slide.hasAttribute('inert');
  const exposedIndexes = () =>
    slideElements()
      .map((slide, i) => (isExposed(slide) ? i : -1))
      .filter((i) => i >= 0);

  it('shows groupSize slides at once and hides the rest', () => {
    render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
    expect(exposedIndexes()).toEqual([0, 1, 2]);
  });

  it('sizes each slide to a share of the viewport and moves the track by pages', () => {
    render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
    // jsdom folds calc(100% / 3) into calc(33.3333%); a browser keeps the division.
    expect(slideElements()[0]!.style.width).toMatch(/^calc\((100% \/ 3|33\.3333%)\)$/);
    expect(track().style.transform).toBe('translateX(0%)');
    act(() => nextButton().click());
    expect(track().style.transform).toBe('translateX(-100%)');
  });

  it('groupSize 1 keeps the 0.12 markup: full-width slides', () => {
    render(<Carousel>{slides(3)}</Carousel>);
    expect(slideElements()[0]).toHaveClass('w-full');
    expect(slideElements()[0]!.style.width).toBe('');
  });

  it('has one picker button per page, named with the slides it shows', () => {
    render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
    expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Slides 1 to 3 of 9',
      'Slides 4 to 6 of 9',
      'Slides 7 to 9 of 9',
    ]);
    expect(currentDot()).toHaveAttribute('aria-label', 'Slides 1 to 3 of 9');
  });

  it('names a one-slide last page like a single slide', () => {
    render(<Carousel groupSize={3}>{slides(7)}</Carousel>);
    expect(dots().map((dot) => dot.getAttribute('aria-label'))).toEqual([
      'Slides 1 to 3 of 7',
      'Slides 4 to 6 of 7',
      'Slide 7 of 7',
    ]);
  });

  it('announces the page in the live region', () => {
    render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
    expect(liveRegion()).toHaveTextContent('Slides 1 to 3 of 9');
  });

  it('the labels.slides function names the pages', () => {
    render(
      <Carousel
        groupSize={2}
        labels={{ slides: (start, end, total) => `Sider ${start}–${end} av ${total}` }}
      >
        {slides(4)}
      </Carousel>,
    );
    expect(dots()[0]).toHaveAttribute('aria-label', 'Sider 1–2 av 4');
  });

  it('Next and Previous move by a page and report the page start once', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Carousel groupSize={3} onValueChange={onValueChange}>
        {slides(9)}
      </Carousel>,
    );
    await user.click(nextButton());
    expect(exposedIndexes()).toEqual([3, 4, 5]);
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await user.click(nextButton());
    expect(onValueChange).toHaveBeenLastCalledWith(6);
    await user.click(prevButton());
    expect(exposedIndexes()).toEqual([3, 4, 5]);
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it('a picker button goes to its page', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Carousel groupSize={3} onValueChange={onValueChange}>
        {slides(9)}
      </Carousel>,
    );
    await user.click(dots()[2]!);
    expect(onValueChange).toHaveBeenCalledWith(6);
    expect(currentDot()).toBe(dots()[2]);
  });

  it('Next is disabled on the last page without loop and wraps with loop', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Carousel groupSize={3} defaultValue={6}>
        {slides(9)}
      </Carousel>,
    );
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    rerender(
      <Carousel groupSize={3} defaultValue={6} loop>
        {slides(9)}
      </Carousel>,
    );
    await user.click(nextButton());
    expect(exposedIndexes()).toEqual([0, 1, 2]);
  });

  it('Previous wraps to the last page with loop', async () => {
    const user = userEvent.setup();
    render(
      <Carousel groupSize={3} loop>
        {slides(7)}
      </Carousel>,
    );
    await user.click(prevButton());
    expect(exposedIndexes()).toEqual([6]);
  });

  it.each([
    [4, [3, 4, 5]],
    [5, [3, 4, 5]],
    [99, [6, 7, 8]],
    [-3, [0, 1, 2]],
  ])('a controlled value of %d shows the page that holds it', (value, expected) => {
    render(
      <Carousel groupSize={3} value={value}>
        {slides(9)}
      </Carousel>,
    );
    expect(exposedIndexes()).toEqual(expected);
  });

  it('keeps showing the last page when slides are removed under it', () => {
    const { rerender } = render(
      <Carousel groupSize={3} defaultValue={6}>
        {slides(9)}
      </Carousel>,
    );
    rerender(
      <Carousel groupSize={3} defaultValue={6}>
        {slides(5)}
      </Carousel>,
    );
    expect(exposedIndexes()).toEqual([3, 4]);
  });

  it('a group larger than the slides is one page with both buttons disabled', () => {
    render(<Carousel groupSize={5}>{slides(3)}</Carousel>);
    expect(exposedIndexes()).toEqual([0, 1, 2]);
    expect(prevButton()).toHaveAttribute('aria-disabled', 'true');
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('calls onValueChange once per page change in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Carousel groupSize={3} onValueChange={onValueChange}>
          {slides(9)}
        </Carousel>
      </React.StrictMode>,
    );
    await user.click(nextButton());
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  describe('autoplay by page', () => {
    it('advances a page at a time and stops at the last page without loop', () => {
      vi.useFakeTimers();
      render(
        <Carousel groupSize={3} autoPlay autoPlayInterval={1000}>
          {slides(9)}
        </Carousel>,
      );
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(exposedIndexes()).toEqual([3, 4, 5]);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(exposedIndexes()).toEqual([6, 7, 8]);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(exposedIndexes()).toEqual([6, 7, 8]);
    });

    it('wraps to the first page with loop', () => {
      vi.useFakeTimers();
      render(
        <Carousel groupSize={3} autoPlay loop autoPlayInterval={1000}>
          {slides(9)}
        </Carousel>,
      );
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(exposedIndexes()).toEqual([0, 1, 2]);
    });

    it('does not rotate when everything fits on one page', () => {
      render(
        <Carousel groupSize={5} autoPlay>
          {slides(3)}
        </Carousel>,
      );
      expect(region().querySelector('[data-carousel-rotation]')).toBeNull();
    });
  });

  describe('auto size', () => {
    function stubWidths(rootWidth: () => number, slideWidth: () => number) {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('wave-carousel') ? rootWidth() : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('wave-carousel__slide') ? slideWidth() : 0;
      });
    }

    it('shows as many slides as fit and follows a resize', () => {
      const ro = installResizeObserverMock();
      let rootWidth = 300;
      stubWidths(
        () => rootWidth,
        () => 100,
      );
      render(<Carousel groupSize="auto">{slides(9)}</Carousel>);
      expect(exposedIndexes()).toEqual([0, 1, 2]);
      expect(dots()).toHaveLength(3);
      rootWidth = 200;
      ro.trigger();
      expect(exposedIndexes()).toEqual([0, 1]);
      expect(dots()).toHaveLength(5);
      ro.restore();
    });

    it('snaps the shown index to the new page start when the page size changes', () => {
      const ro = installResizeObserverMock();
      let rootWidth = 100;
      stubWidths(
        () => rootWidth,
        () => 100,
      );
      render(
        <Carousel groupSize="auto" defaultValue={4}>
          {slides(9)}
        </Carousel>,
      );
      expect(exposedIndexes()).toEqual([4]);
      rootWidth = 300;
      ro.trigger();
      expect(exposedIndexes()).toEqual([3, 4, 5]);
      ro.restore();
    });

    it('shows one slide at a time before anything is measured', () => {
      render(<Carousel groupSize="auto">{slides(4)}</Carousel>);
      expect(exposedIndexes()).toEqual([0]);
    });

    it('lets the slides keep their own width', () => {
      render(<Carousel groupSize="auto">{slides(4)}</Carousel>);
      expect(slideElements()[0]).toHaveClass('w-auto', 'shrink-0');
      expect(slideElements()[0]).not.toHaveClass('w-full');
    });

    it.each([
      ['start', 0],
      ['center', 25],
      ['end', 50],
    ] as const)(
      'align=%s offsets the page by %dpx when the slides do not fill the viewport',
      (align, px) => {
        const ro = installResizeObserverMock();
        stubWidths(
          () => 250,
          () => 100,
        );
        render(
          <Carousel groupSize="auto" align={align}>
            {slides(6)}
          </Carousel>,
        );
        ro.trigger();
        expect(track().style.transform).toBe(`translateX(${px}px)`);
        ro.restore();
      },
    );
  });

  describe('focus group across the visible slides', () => {
    const focusable = () =>
      slideElements().filter((slide) => slide.hasAttribute('data-roving-value'));

    it('makes the visible slides one roving group: one tab stop', () => {
      render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
      expect(focusable()).toHaveLength(3);
      expect(focusable().map((slide) => slide.tabIndex)).toEqual([0, -1, -1]);
    });

    it('groupSize 1 adds no focus group and no key handling', () => {
      render(<Carousel>{slides(3)}</Carousel>);
      expect(focusable()).toHaveLength(0);
      expect(slideElements()[0]).not.toHaveAttribute('tabindex');
    });

    it('arrow keys move focus between the visible slides', async () => {
      const user = userEvent.setup();
      render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
      act(() => focusable()[0]!.focus());
      await user.keyboard('{ArrowRight}');
      expect(focusable()[1]).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(focusable()[0]).toHaveFocus();
    });

    it('an arrow past the last visible slide changes the page and focuses its first slide', async () => {
      const user = userEvent.setup();
      render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
      act(() => focusable()[2]!.focus());
      await user.keyboard('{ArrowRight}');
      expect(exposedIndexes()).toEqual([3, 4, 5]);
      expect(focusable()[0]).toHaveFocus();
      expect(slideElements()[3]).toHaveFocus();
    });

    it('an arrow before the first visible slide goes back a page and focuses its last slide', async () => {
      const user = userEvent.setup();
      render(
        <Carousel groupSize={3} defaultValue={3}>
          {slides(9)}
        </Carousel>,
      );
      act(() => slideElements()[3]!.focus());
      await user.keyboard('{ArrowLeft}');
      expect(exposedIndexes()).toEqual([0, 1, 2]);
      expect(slideElements()[2]).toHaveFocus();
    });

    it('stops at the ends without loop', async () => {
      const user = userEvent.setup();
      render(
        <Carousel groupSize={3} defaultValue={6}>
          {slides(9)}
        </Carousel>,
      );
      act(() => slideElements()[8]!.focus());
      await user.keyboard('{ArrowRight}');
      expect(exposedIndexes()).toEqual([6, 7, 8]);
      expect(slideElements()[8]).toHaveFocus();
    });

    it('mirrors the arrows in right-to-left layouts', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Carousel groupSize={3}>{slides(9)}</Carousel>, { dir: 'rtl' });
      act(() => focusable()[0]!.focus());
      await user.keyboard('{ArrowLeft}');
      expect(focusable()[1]).toHaveFocus();
    });

    it('leaves the arrow keys alone inside an input in a slide', async () => {
      const user = userEvent.setup();
      render(
        <Carousel groupSize={3}>
          <Carousel.Item>
            <input aria-label="Field" />
          </Carousel.Item>
          {slides(2)}
        </Carousel>,
      );
      await user.click(screen.getByRole('textbox', { name: 'Field' }));
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
    });
  });

  it('is axe clean with groups', async () => {
    const { container } = render(
      <Carousel groupSize={3} aria-label="Gallery">
        {slides(9)}
      </Carousel>,
    );
    await expectNoA11yViolations(container);
  });

  it('types groupSize, align and labels.slides', () => {
    expectTypeOf<CarouselProps['groupSize']>().toEqualTypeOf<number | 'auto' | undefined>();
    expectTypeOf<CarouselProps['align']>().toEqualTypeOf<'start' | 'center' | 'end' | undefined>();
    expectTypeOf<NonNullable<CarouselLabels['slides']>>().toEqualTypeOf<
      (start: number, end: number, total: number) => string
    >();
  });
});

describe('Carousel dragging (0.13)', () => {
  const CAPTURE_METHODS = [
    'setPointerCapture',
    'releasePointerCapture',
    'hasPointerCapture',
  ] as const;
  let saved: Array<[string, PropertyDescriptor | undefined]> = [];
  let clock = 0;

  beforeEach(() => {
    clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    // jsdom has no pointer capture: a stand-in that remembers the captured pointer ids.
    const captured = new WeakMap<Element, Set<number>>();
    saved = CAPTURE_METHODS.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(Element.prototype, name),
    ]);
    Object.defineProperties(Element.prototype, {
      setPointerCapture: {
        configurable: true,
        writable: true,
        value(this: Element, pointerId: number) {
          const ids = captured.get(this) ?? new Set<number>();
          ids.add(pointerId);
          captured.set(this, ids);
        },
      },
      releasePointerCapture: {
        configurable: true,
        writable: true,
        value(this: Element, pointerId: number) {
          captured.get(this)?.delete(pointerId);
        },
      },
      hasPointerCapture: {
        configurable: true,
        writable: true,
        value(this: Element, pointerId: number) {
          return captured.get(this)?.has(pointerId) ?? false;
        },
      },
    });
  });

  afterEach(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
      else Reflect.deleteProperty(Element.prototype, name);
    }
  });

  /** A 400 px wide carousel of five slides; `dir` mirrors it. */
  function renderDraggable(props: Partial<CarouselProps> = {}, dir?: 'rtl') {
    const onValueChange = vi.fn();
    const ui = (
      <Carousel draggable onValueChange={onValueChange} {...props}>
        <Carousel.Item>
          <p>Slide 1 content</p>
          <button type="button">Inside action</button>
        </Carousel.Item>
        {slides(4)}
      </Carousel>
    );
    if (dir) renderWithProviders(ui, { dir });
    else render(ui);
    const el = track();
    mockRect(el.parentElement as Element, { left: 0, top: 0, width: 400, height: 200 });
    return { el, onValueChange };
  }

  const pointer = (pointerType: string, x: number, pointerId = 1) => ({
    pointerId,
    pointerType,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: 50,
  });

  /** Presses at `from`, moves to `to` after `ms` and releases at once. */
  function drag(el: HTMLElement, from: number, to: number, ms: number, pointerType = 'mouse') {
    act(() => {
      fireEvent.pointerDown(el, pointer(pointerType, from));
    });
    clock += ms;
    act(() => {
      fireEvent.pointerMove(el, pointer(pointerType, to));
    });
    act(() => {
      fireEvent.pointerUp(el, pointer(pointerType, to));
    });
  }

  it.each(['mouse', 'touch', 'pen'])(
    'a slow %s drag past a quarter of the width shows the next page',
    (type) => {
      const { el, onValueChange } = renderDraggable();
      drag(el, 300, 150, 1000, type);
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
      expect(exposedSlides()).toEqual([2]);
    },
  );

  it('a drag towards the end shows the previous page', () => {
    const { el, onValueChange } = renderDraggable({ defaultValue: 2 });
    drag(el, 100, 250, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('a short slow drag snaps back and changes nothing', () => {
    const { el, onValueChange } = renderDraggable();
    drag(el, 300, 250, 1000);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(exposedSlides()).toEqual([1]);
    expect(el.style.transform).toBe('translateX(0%)');
    expect(el).not.toHaveAttribute('data-dragging');
  });

  it('a fast short flick commits', () => {
    const { el, onValueChange } = renderDraggable();
    drag(el, 300, 260, 40);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('a flick on the first page towards the end does not leave the carousel', () => {
    const { el, onValueChange } = renderDraggable();
    drag(el, 100, 200, 40);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(exposedSlides()).toEqual([1]);
  });

  it('a pointer that rests before the release has no speed', () => {
    const { el, onValueChange } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
    });
    clock += 20;
    act(() => {
      fireEvent.pointerMove(el, pointer('mouse', 250));
    });
    clock += 500;
    act(() => {
      fireEvent.pointerUp(el, pointer('mouse', 250));
    });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('mirrors the drag direction in right-to-left layouts', () => {
    const { el, onValueChange } = renderDraggable({}, 'rtl');
    drag(el, 300, 150, 1000);
    expect(onValueChange).not.toHaveBeenCalled();
    drag(el, 100, 250, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('follows the pointer while dragging and marks it', () => {
    const { el } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
    });
    expect(el).not.toHaveAttribute('data-dragging');
    act(() => {
      fireEvent.pointerMove(el, pointer('mouse', 240));
    });
    expect(el).toHaveAttribute('data-dragging', '');
    expect(el.style.transform).toBe('translateX(calc(0% + -60px))');
    expect(el).not.toHaveClass('transition-transform');
    act(() => {
      fireEvent.pointerUp(el, pointer('mouse', 240));
    });
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('translateX(0%)');
    expect(el).toHaveClass('transition-transform');
  });

  it('does not start a drag below a few pixels', () => {
    const { el } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
      fireEvent.pointerMove(el, pointer('mouse', 298));
    });
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.hasPointerCapture(1)).toBe(false);
  });

  it('captures the pointer once the drag starts', () => {
    const { el } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
      fireEvent.pointerMove(el, pointer('mouse', 280));
    });
    expect(el.hasPointerCapture(1)).toBe(true);
  });

  it('swallows the click that ends a drag once, and lets a later click through', () => {
    const { el } = renderDraggable();
    const onClick = vi.fn();
    const action = screen.getByRole('button', { name: 'Inside action', hidden: true });
    action.addEventListener('click', onClick);
    drag(el, 300, 100, 1000);
    // The browser's click that follows the release is dropped before it reaches the slide.
    const dragClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      action.dispatchEvent(dragClick);
    });
    expect(onClick).not.toHaveBeenCalled();
    expect(dragClick.defaultPrevented).toBe(true);
    act(() => {
      action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a plain click on a button inside a slide is not swallowed', () => {
    const { el } = renderDraggable();
    const onClick = vi.fn();
    const action = screen.getByRole('button', { name: 'Inside action' });
    action.addEventListener('click', onClick);
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
      fireEvent.pointerUp(el, pointer('mouse', 300));
    });
    act(() => action.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('a cancelled pointer snaps back', () => {
    const { el, onValueChange } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('touch', 300));
      fireEvent.pointerMove(el, pointer('touch', 100));
    });
    expect(el).toHaveAttribute('data-dragging');
    act(() => {
      fireEvent.pointerCancel(el, pointer('touch', 100));
    });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('translateX(0%)');
  });

  it('ignores a secondary button and a non-primary pointer', () => {
    const { el } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, { ...pointer('mouse', 300), button: 2 });
      fireEvent.pointerMove(el, pointer('mouse', 100));
    });
    expect(el).not.toHaveAttribute('data-dragging');
    act(() => {
      fireEvent.pointerDown(el, { ...pointer('touch', 300, 2), isPrimary: false });
      fireEvent.pointerMove(el, pointer('touch', 100, 2));
    });
    expect(el).not.toHaveAttribute('data-dragging');
  });

  it('attaches nothing without draggable', () => {
    const { el, onValueChange } = renderDraggable({ draggable: false });
    drag(el, 300, 50, 40);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el).not.toHaveClass('touch-pan-y');
  });

  it('lets the page scroll vertically over a draggable track', () => {
    const { el } = renderDraggable();
    expect(el).toHaveClass('touch-pan-y');
  });

  it('pauses autoplay while dragging and resumes after', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { el, onValueChange } = renderDraggable({ autoPlay: true, autoPlayInterval: 1000 });
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
      fireEvent.pointerMove(el, pointer('mouse', 290));
    });
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(onValueChange).not.toHaveBeenCalled();
    act(() => {
      fireEvent.pointerUp(el, pointer('mouse', 290));
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('moves by pages with groupSize', () => {
    const { el, onValueChange } = renderDraggable({ groupSize: 2 });
    drag(el, 300, 100, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('calls onValueChange once per change in StrictMode', () => {
    const onValueChange = vi.fn();
    render(
      <React.StrictMode>
        <Carousel draggable onValueChange={onValueChange}>
          {slides(3)}
        </Carousel>
      </React.StrictMode>,
    );
    const el = track();
    mockRect(el.parentElement as Element, { left: 0, top: 0, width: 400, height: 200 });
    drag(el, 300, 100, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
  });
});
