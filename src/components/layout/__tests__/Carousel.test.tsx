import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, expectTypeOf, vi, afterEach, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carousel, CarouselItem } from '../Carousel';
import { CarouselButton } from '../Carousel.button';
import {
  carouselButtonClassNames,
  carouselClassNames,
  carouselItemClassNames,
} from '../../../lib/classNames';
import type {
  CarouselAutoPlayLabels,
  CarouselChangeDetails,
  CarouselChangeReason,
  CarouselItemProps,
  CarouselLabels,
  CarouselProps,
} from '../Carousel';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  expectThrows,
  mockMatchMedia,
  mockRect,
  normaliseIds,
  openingTags,
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

  testCompoundExposure(Carousel, ['Item', 'Button']);

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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(0, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(2, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(0, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(2, expect.anything());
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
      expect(onValueChange).toHaveBeenLastCalledWith(2, expect.anything());
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
        expect(button).toHaveClass('wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover');
        expect(button.className).not.toMatch(/(^|\s)wave:hover:/);
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
      for (const dot of dots()) expect(dot).toHaveClass('wave:h-6', 'wave:min-w-6');
      const inactiveMark = inactive.firstElementChild;
      const activeMark = active.firstElementChild;
      expect(inactiveMark).toHaveClass('wave:w-2', 'wave:bg-stroke-accessible');
      expect(activeMark).toHaveClass('wave:w-5', 'wave:bg-primary');
      expect(activeMark).not.toHaveClass('wave:w-2');
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
      expect(onValueChange).toHaveBeenCalledWith(0, expect.anything());
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
        mirrored: classes.includes('wave:-scale-x-100'),
        cssDirectionVariant: classes.some(
          (c) => c.startsWith('wave:rtl:') || c.startsWith('wave:ltr:'),
        ),
      };
    }

    it('places previous/next with logical insets and mirrors the chevrons', () => {
      renderWithProviders(<Carousel>{threeSlides}</Carousel>, { dir: 'rtl' });
      expect(prevButton()).toHaveClass('wave:start-2');
      expect(nextButton()).toHaveClass('wave:end-2');
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
      expect(onValueChange).toHaveBeenLastCalledWith(1, expect.anything());
      expect(liveRegion()).toHaveTextContent('Slide 2 of 3');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(2, expect.anything());
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
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [0, expect.anything()],
      ]);
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
      expect(onValueChange.mock.calls).toEqual([[1, expect.anything()]]);
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
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [2, expect.anything()],
      ]);

      // Rotation has ended: the control offers Start, and the live region is polite again.
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      expect(vi.getTimerCount()).toBe(0);

      await user.click(toggle);
      expect(onValueChange).toHaveBeenLastCalledWith(0, expect.anything());
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(liveRegion()).toHaveTextContent('Slide 1 of 3');
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange).toHaveBeenLastCalledWith(1, expect.anything());
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
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [2, expect.anything()],
      ]);
      const toggle = screen.getByRole('button', { name: 'Start slide rotation' });

      // Previous from the last slide is a manual step, not a Start: rotation stays ended.
      await user.click(prevButton());
      expect(onValueChange).toHaveBeenLastCalledWith(1, expect.anything());
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
      expect(onValueChange).toHaveBeenLastCalledWith(2, expect.anything());
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
      expect(onValueChange.mock.calls).toEqual([[1, expect.anything()]]);
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
      expect(onValueChange.mock.calls).toEqual([[1, expect.anything()]]);

      // Lazy-loaded slides: slide 2 is no longer the last one, so the end no longer applies.
      rerender(ui(4));
      expect(toggle).toHaveAccessibleName('Pause slide rotation');
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [2, expect.anything()],
        [3, expect.anything()],
      ]);
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
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [0, expect.anything()],
      ]);
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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
      expect(onValueChange.mock.calls).toEqual([[1, expect.anything()]]);
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
      expect(onValueChange).toHaveBeenLastCalledWith(2, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());

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
      expect(onValueChange.mock.calls).toEqual([[1, expect.anything()]]);

      // The pointer leaves: the consumer onMouseLeave runs and rotation resumes.
      fireEvent.mouseEnter(region());
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      fireEvent.mouseLeave(region());
      expect(onMouseLeave).toHaveBeenCalledTimes(1);
      expect(liveRegion()).toHaveAttribute('aria-live', 'off');
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onValueChange.mock.calls).toEqual([
        [1, expect.anything()],
        [2, expect.anything()],
      ]);
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
    });
  });

  it('isolates its stacking context, so the controls stay under page headers', () => {
    render(<Carousel aria-label="Featured">{threeSlides}</Carousel>);
    expect(region()).toHaveClass('wave:relative', 'wave:isolate', 'wave:overflow-hidden');
    // The controls' z-index is local to the carousel.
    expect(nextButton()).toHaveClass('wave:z-10');
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
      expect(onValueChange).toHaveBeenCalledWith(1, expect.anything());
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

  it('sizes each slide to a share of the viewport and moves the track by pages', async () => {
    render(<Carousel groupSize={3}>{slides(9)}</Carousel>);
    // jsdom folds calc(100% / 3) into calc(33.3333%); a browser keeps the division.
    expect(slideElements()[0]!.style.width).toMatch(/^calc\((100% \/ 3|33\.3333%)\)$/);
    expect(track().style.transform).toBe('translateX(0%)');
    act(() => nextButton().click());
    expect(track().style.transform).toBe('translateX(-100%)');
    // Settle the observers the roving focus group and the sizing set up.
    await act(async () => {});
  });

  it('groupSize 1 keeps the 0.12 markup: full-width slides', () => {
    render(<Carousel>{slides(3)}</Carousel>);
    expect(slideElements()[0]).toHaveClass('wave:w-full');
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
    expect(onValueChange).toHaveBeenLastCalledWith(3, expect.anything());
    await user.click(nextButton());
    expect(onValueChange).toHaveBeenLastCalledWith(6, expect.anything());
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
    expect(onValueChange).toHaveBeenCalledWith(6, expect.anything());
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

  it('keeps showing the last page when slides are removed under it', async () => {
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
    // Settle the observers the roving focus group and the sizing set up.
    await act(async () => {});
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
    it('advances a page at a time and stops at the last page without loop', async () => {
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
      // Settle the observers the roving focus group and the sizing set up.
      await act(async () => {});
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
        return this.classList.contains('wave-carousel__viewport') ? rootWidth() : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('wave-carousel__slide') ? slideWidth() : 0;
      });
    }

    it('shows as many slides as fit and follows a resize', async () => {
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
      // Settle the observers the roving focus group and the sizing set up.
      await act(async () => {});
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
      expect(slideElements()[0]).toHaveClass('wave:w-auto', 'wave:shrink-0');
      expect(slideElements()[0]).not.toHaveClass('wave:w-full');
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
          <input aria-label="Notes" />
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
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
      expect(exposedSlides()).toEqual([2]);
    },
  );

  it('a drag towards the end shows the previous page', () => {
    const { el, onValueChange } = renderDraggable({ defaultValue: 2 });
    drag(el, 100, 250, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
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
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
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
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
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
    expect(el).not.toHaveClass('wave:transition-transform');
    act(() => {
      fireEvent.pointerUp(el, pointer('mouse', 240));
    });
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('translateX(0%)');
    expect(el).toHaveClass('wave:transition-transform');
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
    const dragClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    act(() => {
      action.dispatchEvent(dragClick);
    });
    expect(onClick).not.toHaveBeenCalled();
    expect(dragClick.defaultPrevented).toBe(true);
    act(() => {
      action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
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
    expect(el).not.toHaveClass('wave:touch-pan-y');
  });

  it('lets the page scroll vertically over a draggable track', () => {
    const { el } = renderDraggable();
    expect(el).toHaveClass('wave:touch-pan-y');
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
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
  });

  it('moves by pages with groupSize', async () => {
    const { el, onValueChange } = renderDraggable({ groupSize: 2 });
    drag(el, 300, 100, 1000);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(2, expect.anything());
    // Settle the observers the roving focus group and the sizing set up.
    await act(async () => {});
  });

  it('forgets a press that was released outside the track', () => {
    const { el } = renderDraggable();
    act(() => {
      fireEvent.pointerDown(el, pointer('mouse', 300));
      fireEvent.pointerMove(el, pointer('mouse', 299));
    });
    // The release lands elsewhere (the picker, outside the carousel): the track never sees it.
    act(() => {
      fireEvent.pointerUp(document.body, pointer('mouse', 299));
    });
    act(() => {
      fireEvent.pointerMove(el, { ...pointer('mouse', 200), buttons: 0 });
    });
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('translateX(0%)');
  });

  it('does not swallow a keyboard or programmatic click after a touch drag', () => {
    const { el } = renderDraggable();
    const onClick = vi.fn();
    const action = screen.getByRole('button', { name: 'Inside action' });
    action.addEventListener('click', onClick);
    // A touch drag produces no click of its own.
    drag(el, 300, 100, 1000, 'touch');
    act(() => {
      action.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not start a drag from a text field inside a slide', () => {
    const { el } = renderDraggable();
    const input = screen.getByRole('textbox', { name: 'Notes', hidden: true });
    act(() => {
      fireEvent.pointerDown(input, pointer('mouse', 300));
      fireEvent.pointerMove(input, pointer('mouse', 200));
    });
    expect(el).not.toHaveAttribute('data-dragging');
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
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
  });
});

describe('Carousel thumbnails, layouts and buttons (0.13)', () => {
  const thumbs = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <Carousel.Item key={i} thumbnail={`/thumb-${i + 1}.png`}>
        <p>Slide {i + 1} content</p>
      </Carousel.Item>
    ));
  const LAYOUTS = ['overlay', 'inline', 'overlay-wide', 'inline-wide'] as const;
  const pickerButtons = () => dots();

  describe('thumbnails', () => {
    it('shows the thumbnail of each slide in its picker button, keeping the button name', () => {
      render(<Carousel>{thumbs(3)}</Carousel>);
      const buttons = pickerButtons();
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Slide 1 of 3',
        'Slide 2 of 3',
        'Slide 3 of 3',
      ]);
      const images = buttons.map((button) => button.querySelector('img'));
      expect(images.map((image) => image?.getAttribute('src'))).toEqual([
        '/thumb-1.png',
        '/thumb-2.png',
        '/thumb-3.png',
      ]);
      for (const image of images) {
        expect(image).toHaveAttribute('alt', '');
        expect(image).toHaveClass(carouselItemClassNames.thumbnail);
      }
      expect(currentDot()).toBe(buttons[0]);
      expect(region().querySelector(`.${carouselClassNames.pickerIndicator}`)).toBeNull();
    });

    it('takes an object of img attributes', () => {
      render(
        <Carousel>
          <Carousel.Item thumbnail={{ src: '/a.png', className: 'custom-thumb', loading: 'lazy' }}>
            <p>One</p>
          </Carousel.Item>
          <Carousel.Item>
            <p>Two</p>
          </Carousel.Item>
        </Carousel>,
      );
      const image = pickerButtons()[0]!.querySelector('img')!;
      expect(image).toHaveAttribute('src', '/a.png');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveClass('custom-thumb', carouselItemClassNames.thumbnail);
    });

    it('keeps the dot of a slide without a thumbnail', () => {
      render(
        <Carousel>
          <Carousel.Item thumbnail="/a.png">One</Carousel.Item>
          <Carousel.Item>Two</Carousel.Item>
        </Carousel>,
      );
      expect(pickerButtons()[0]!.querySelector('img')).not.toBeNull();
      expect(pickerButtons()[1]!.querySelector('img')).toBeNull();
      expect(
        pickerButtons()[1]!.querySelector(`.${carouselClassNames.pickerIndicator}`),
      ).not.toBeNull();
    });

    it('renders no image and keeps the dots without any thumbnail', () => {
      render(<Carousel>{slides(3)}</Carousel>);
      expect(region().querySelector('img')).toBeNull();
      expect(region().querySelectorAll(`.${carouselClassNames.pickerIndicator}`)).toHaveLength(3);
    });

    it('does not put the thumbnail prop on the slide element', () => {
      render(<Carousel>{thumbs(2)}</Carousel>);
      expect(
        slideGroups()[0]!.querySelector(`.${carouselItemClassNames.root}`),
      ).not.toHaveAttribute('thumbnail');
    });

    it('shows the thumbnail of the first slide of each page with groupSize', () => {
      render(<Carousel groupSize={2}>{thumbs(5)}</Carousel>);
      expect(
        pickerButtons().map((button) => button.querySelector('img')?.getAttribute('src')),
      ).toEqual(['/thumb-1.png', '/thumb-3.png', '/thumb-5.png']);
    });

    it('moves to the slide of the thumbnail that is clicked', async () => {
      const user = userEvent.setup();
      render(<Carousel>{thumbs(3)}</Carousel>);
      await user.click(pickerButtons()[2]!);
      expect(exposedSlides()).toEqual([3]);
      expect(currentDot()).toBe(pickerButtons()[2]);
    });

    it('has no accessibility violations', async () => {
      render(<Carousel aria-label="Gallery">{thumbs(3)}</Carousel>);
      await expectNoA11yViolations();
    });
  });

  describe('controlsLayout', () => {
    it('defaults to overlay and renders the layout and appearance as data attributes', () => {
      render(<Carousel>{slides(3)}</Carousel>);
      expect(region()).toHaveAttribute('data-controls-layout', 'overlay');
      expect(region()).toHaveAttribute('data-appearance', 'flat');
    });

    it.each(LAYOUTS)('renders data-controls-layout=%s', (layout) => {
      render(<Carousel controlsLayout={layout}>{slides(3)}</Carousel>);
      expect(region()).toHaveAttribute('data-controls-layout', layout);
    });

    it.each(['overlay', 'overlay-wide'] as const)(
      '%s puts the buttons over the slides, inside the viewport after the track',
      (layout) => {
        render(<Carousel controlsLayout={layout}>{slides(3)}</Carousel>);
        const viewport = region().querySelector<HTMLElement>(`.${carouselClassNames.viewport}`)!;
        expect(prevButton().parentElement).toBe(viewport);
        expect(nextButton().parentElement).toBe(viewport);
        expect(prevButton()).toHaveClass('wave:absolute');
        expect(nextButton()).toHaveClass('wave:absolute');
        expect(viewport.firstElementChild).toBe(track());
      },
    );

    it.each(['inline', 'inline-wide'] as const)(
      '%s flanks the viewport with the buttons, outside the slides',
      (layout) => {
        render(<Carousel controlsLayout={layout}>{slides(3)}</Carousel>);
        const viewport = region().querySelector<HTMLElement>(`.${carouselClassNames.viewport}`)!;
        expect(prevButton().nextElementSibling).toBe(viewport);
        expect(viewport.nextElementSibling).toBe(nextButton());
        expect(viewport).not.toContainElement(prevButton());
        expect(viewport).not.toContainElement(nextButton());
        expect(prevButton()).not.toHaveClass('wave:absolute');
      },
    );

    it('overlay-wide makes full-height strips and overlay keeps round buttons', () => {
      const { unmount } = render(<Carousel controlsLayout="overlay-wide">{slides(3)}</Carousel>);
      expect(prevButton()).toHaveClass('wave:inset-y-0', 'wave:start-0');
      expect(nextButton()).toHaveClass('wave:inset-y-0', 'wave:end-0');
      unmount();
      render(<Carousel>{slides(3)}</Carousel>);
      expect(prevButton()).toHaveClass('wave:rounded-full', 'wave:start-2');
      expect(nextButton()).toHaveClass('wave:rounded-full', 'wave:end-2');
    });

    it('inline-wide stretches the buttons over the full height', () => {
      render(<Carousel controlsLayout="inline-wide">{slides(3)}</Carousel>);
      expect(prevButton()).toHaveClass('wave:self-stretch');
      expect(nextButton()).toHaveClass('wave:self-stretch');
    });

    it.each(LAYOUTS)('%s keeps the rotation control the first focusable element', (layout) => {
      render(
        <Carousel controlsLayout={layout} autoPlay loop>
          {slides(3)}
        </Carousel>,
      );
      const tabbable = getTabbableElements(region());
      expect(tabbable[0]).toBe(screen.getByRole('button', { name: 'Pause slide rotation' }));
      expect(tabbable).toContain(prevButton());
      expect(tabbable).toContain(nextButton());
    });

    it('keeps the rotation control at the start corner, clear of an inline Previous button', () => {
      const { unmount } = render(<Carousel autoPlay>{slides(3)}</Carousel>);
      const rotation = () => screen.getByRole('button', { name: /slide rotation/ });
      expect(rotation()).toHaveClass('wave:top-2', 'wave:start-2');
      unmount();
      render(
        <Carousel autoPlay controlsLayout="inline">
          {slides(3)}
        </Carousel>,
      );
      expect(rotation()).toHaveClass('wave:top-2', 'wave:start-12');
    });

    it.each(LAYOUTS)('%s stacks the rotation control above the edge strips', (layout) => {
      render(
        <Carousel controlsLayout={layout} autoPlay>
          {slides(3)}
        </Carousel>,
      );
      const rotation = screen.getByRole('button', { name: /slide rotation/ });
      expect(rotation).toHaveClass('wave:z-20');
      expect(rotation).not.toHaveClass('wave:z-10');
    });

    it.each(LAYOUTS)('%s has no accessibility violations', async (layout) => {
      render(
        <Carousel aria-label="Promo" controlsLayout={layout} autoPlay>
          {slides(3)}
        </Carousel>,
      );
      await expectNoA11yViolations();
    });

    it('mirrors the chevrons in right-to-left layouts in every layout', () => {
      renderWithProviders(<Carousel controlsLayout="inline">{slides(3)}</Carousel>, { dir: 'rtl' });
      expect(prevButton().querySelector('svg')).toHaveClass('wave:-scale-x-100');
    });

    it('measures the viewport, not the whole carousel, for groupSize auto', () => {
      const ro = installResizeObserverMock();
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        if (this.classList.contains('wave-carousel__viewport')) return 200;
        return this.classList.contains('wave-carousel') ? 300 : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
        this: HTMLElement,
      ) {
        return this.classList.contains('wave-carousel__slide') ? 100 : 0;
      });
      render(
        <Carousel controlsLayout="inline" groupSize="auto">
          {slides(6)}
        </Carousel>,
      );
      expect(slideGroups().filter((slide) => !slide.hasAttribute('aria-hidden'))).toHaveLength(2);
      ro.restore();
    });
  });

  describe('appearance', () => {
    it('flat adds no corners or shadow', () => {
      render(<Carousel>{slides(3)}</Carousel>);
      expect(region()).not.toHaveClass('wave:rounded-md');
      expect(region()).not.toHaveClass('wave:shadow-4');
    });

    it('elevated rounds the corners and adds a shadow', () => {
      render(<Carousel appearance="elevated">{slides(3)}</Carousel>);
      expect(region()).toHaveAttribute('data-appearance', 'elevated');
      expect(region()).toHaveClass('wave:rounded-md', 'wave:shadow-4');
    });

    it('renders the data attributes on a carousel without slides too', () => {
      const { container } = render(<Carousel appearance="elevated" controlsLayout="inline" />);
      expect(container.firstElementChild).toHaveAttribute('data-appearance', 'elevated');
      expect(container.firstElementChild).toHaveAttribute('data-controls-layout', 'inline');
    });
  });

  describe('Carousel.Button', () => {
    it('exposes the flat name', () => {
      expect(CarouselButton).toBe(Carousel.Button);
    });

    it('replaces the built-in button of its direction and keeps the other', () => {
      render(
        <Carousel>
          {slides(3)}
          <Carousel.Button direction="next" data-testid="custom-next">
            Go
          </Carousel.Button>
        </Carousel>,
      );
      expect(screen.getAllByRole('button', { name: 'Next slide' })).toHaveLength(1);
      expect(screen.getByTestId('custom-next')).toHaveTextContent('Go');
      expect(screen.getByTestId('custom-next')).toBe(nextButton());
      expect(screen.getByTestId('custom-next')).toHaveClass(carouselButtonClassNames.root);
      expect(prevButton()).toHaveClass(carouselClassNames.previousButton);
      expect(screen.getByTestId('custom-next')).not.toHaveClass(carouselClassNames.nextButton);
    });

    it('is named, wired to the track and disabled like the built-in ones', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Carousel onValueChange={onValueChange}>
          {slides(3)}
          <Carousel.Button direction="previous" />
          <Carousel.Button direction="next" />
        </Carousel>,
      );
      expect(prevButton()).toHaveAttribute('aria-controls', track().id);
      expect(nextButton()).toHaveAttribute('aria-controls', track().id);
      expect(prevButton()).toHaveAttribute('aria-disabled', 'true');
      expect(prevButton()).toHaveAttribute('data-disabled');
      expect(prevButton()).not.toBeDisabled();
      await user.click(prevButton());
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(nextButton());
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
      expect(prevButton()).not.toHaveAttribute('aria-disabled');
      await user.click(nextButton());
      expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    });

    it('uses the localized labels and lets aria-label win', () => {
      render(
        <Carousel labels={{ previous: 'Forrige', next: 'Neste' }}>
          {slides(3)}
          <Carousel.Button direction="previous" />
          <Carousel.Button direction="next" aria-label="Weiter" />
        </Carousel>,
      );
      expect(screen.getByRole('button', { name: 'Forrige' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
    });

    it('composes the consumer onClick before moving, and does not call it while disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Carousel>
          {slides(2)}
          <Carousel.Button direction="previous" onClick={onClick} />
          <Carousel.Button direction="next" onClick={onClick} />
        </Carousel>,
      );
      await user.click(prevButton());
      expect(onClick).not.toHaveBeenCalled();
      await user.click(nextButton());
      expect(onClick).toHaveBeenCalledOnce();
      expect(exposedSlides()).toEqual([2]);
    });

    it('does not move when the consumer onClick prevents the default', async () => {
      const user = userEvent.setup();
      render(
        <Carousel>
          {slides(3)}
          <Carousel.Button direction="next" onClick={(event) => event.preventDefault()} />
        </Carousel>,
      );
      await user.click(nextButton());
      expect(exposedSlides()).toEqual([1]);
    });

    it('draws the children instead of the chevron, and the chevron mirrors in RTL', () => {
      const { unmount } = render(
        <Carousel>
          {slides(3)}
          <Carousel.Button direction="next">
            <span data-testid="glyph">→</span>
          </Carousel.Button>
        </Carousel>,
      );
      expect(within(nextButton()).getByTestId('glyph')).toBeInTheDocument();
      expect(nextButton().querySelector('svg')).toBeNull();
      unmount();
      renderWithProviders(
        <Carousel>
          {slides(3)}
          <Carousel.Button direction="next" />
        </Carousel>,
        { dir: 'rtl' },
      );
      expect(nextButton().querySelector('svg')).toHaveClass('wave:-scale-x-100');
    });

    it('takes the place of the built-in button in the layout', () => {
      render(
        <Carousel controlsLayout="inline">
          {slides(3)}
          <Carousel.Button direction="previous" />
        </Carousel>,
      );
      const viewport = region().querySelector(`.${carouselClassNames.viewport}`);
      expect(prevButton().nextElementSibling).toBe(viewport);
      expect(prevButton()).toHaveClass('wave:relative');
    });

    it('keeps type="button" before the rest and the data-direction attribute', () => {
      render(
        <Carousel>
          {slides(2)}
          <Carousel.Button direction="next" />
        </Carousel>,
      );
      expect(nextButton()).toHaveAttribute('type', 'button');
      expect(nextButton()).toHaveAttribute('data-direction', 'next');
    });

    it('does not submit a surrounding form', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Carousel>
            {slides(3)}
            <Carousel.Button direction="next" />
          </Carousel>
        </form>,
      );
      await user.click(nextButton());
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('is not a slide: no warning, and other children still warn', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Carousel>
          {slides(2)}
          <Carousel.Button direction="next" />
          <p>stray</p>
        </Carousel>,
      );
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0]![0])).toContain('Carousel: only `Carousel.Item`');
      expect(slideGroups()).toHaveLength(2);
    });

    it('renders only the first Carousel.Button of a direction and warns about the other', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Carousel>
          {slides(3)}
          <Carousel.Button direction="next" data-testid="first" />
          <Carousel.Button direction="next" data-testid="second" />
        </Carousel>,
      );
      expect(screen.queryByTestId('second')).toBeNull();
      expect(screen.getByTestId('first')).toBeInTheDocument();
      expect(warn).toHaveBeenCalledOnce();
    });

    it('finds the button inside Fragments', () => {
      render(
        <Carousel>
          {slides(3)}
          <>
            <Carousel.Button direction="next" data-testid="in-fragment" />
          </>
        </Carousel>,
      );
      expect(screen.getByTestId('in-fragment')).toBe(nextButton());
    });

    it('throws outside a Carousel in development', () => {
      expectThrows(
        <CarouselButton direction="next" />,
        '[WaveUI] Carousel.Button must be used within Carousel',
      );
    });

    it('logs once and renders an inert disabled button outside a Carousel in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<CarouselButton direction="next" aria-label="Orphan" />);
      expect(screen.getByRole('button', { name: 'Orphan' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(error).toHaveBeenCalledExactlyOnceWith(
        '[WaveUI] Carousel.Button must be used within Carousel',
      );
      vi.unstubAllEnvs();
    });

    it('is recognised when written in a Server Component', () => {
      const Button = asClientReference(CarouselButton);
      const Item = asClientReference(CarouselItem);
      const lazy = renderToString(
        <Carousel aria-label="Promo">
          <Item>One</Item>
          <Item>Two</Item>
          <Button direction="next" data-testid="lazy-next" />
        </Carousel>,
      );
      const plain = renderToString(
        <Carousel aria-label="Promo">
          <CarouselItem>One</CarouselItem>
          <CarouselItem>Two</CarouselItem>
          <CarouselButton direction="next" data-testid="lazy-next" />
        </Carousel>,
      );
      expect(lazy).toBe(plain);
      expect(plain).toContain('data-testid="lazy-next"');
    });

    it('has no accessibility violations in any layout', async () => {
      render(
        <Carousel aria-label="Promo" controlsLayout="inline-wide">
          {slides(3)}
          <Carousel.Button direction="previous" />
          <Carousel.Button direction="next" />
        </Carousel>,
      );
      await expectNoA11yViolations();
    });
  });
});

describe('Carousel — slotProps', () => {
  type CarouselSlotProps = NonNullable<CarouselProps['slotProps']>;
  const EVERY_PART: CarouselSlotProps = {
    autoPlayButton: {},
    track: {},
    slide: {},
    previousButton: {},
    nextButton: {},
    picker: {},
    pickerButton: {},
    pickerIndicator: {},
  };
  const PART_CLASSES = [
    carouselClassNames.autoPlayButton,
    carouselClassNames.track,
    carouselClassNames.slide,
    carouselClassNames.previousButton,
    carouselClassNames.nextButton,
    carouselClassNames.picker,
    carouselClassNames.pickerButton,
    carouselClassNames.pickerIndicator,
  ];
  const all = <E extends Element = HTMLElement>(root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<E>(`.${cls}`));
  const one = (cls: string) => all(document, cls)[0];
  const partsOf = (root: ParentNode = document) => PART_CLASSES.flatMap((cls) => all(root, cls));
  /** The styles are left out of the pins: jsdom and the server write them apart. */
  const withoutStyle = (tags: string) => tags.replace(/ style="[^"]*"/g, '');

  /**
   * Rotation, pages of two slides (a picker dot, then a thumbnail), at the start: every part, the
   * Previous button unavailable.
   */
  function Featured(props: Partial<CarouselProps>) {
    return (
      <Carousel aria-label="Featured" autoPlay groupSize={2} draggable {...props}>
        {Array.from({ length: 4 }, (_, i) => (
          <Carousel.Item key={i} thumbnail={i === 2 ? 'third.png' : undefined}>
            Slide {i + 1}
          </Carousel.Item>
        ))}
      </Carousel>
    );
  }

  // Captured from ee05cf8's dist, client and server alike (styles left out).
  const BASE_PINS = [
    '<button aria-controls="carousel-slides-_id0_" aria-label="Pause slide rotation" class="wave-carousel__auto-play-button wave:inline-flex wave:items-center wave:justify-center wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:absolute wave:z-20 wave:h-8 wave:w-8 wave:rounded-full wave:border wave:border-border wave:bg-background wave:shadow-2 wave:top-2 wave:start-2" data-carousel-rotation="" type="button">',
    '<div class="wave-carousel__track wave:flex wave:transition-transform wave:duration-wave-slow wave:ease-wave-easy-ease wave:motion-reduce:transition-none wave:touch-pan-y" data-roving-container="" id="carousel-slides-_id0_">',
    '<div aria-label="Slide 1 of 4" aria-roledescription="slide" class="wave-carousel__slide wave:shrink-0 wave:focus-visible:outline-2 wave:focus-visible:-outline-offset-2 wave:focus-visible:outline-ring" data-roving-value="0" role="group" tabindex="0">',
    '<div aria-label="Slide 2 of 4" aria-roledescription="slide" class="wave-carousel__slide wave:shrink-0 wave:focus-visible:outline-2 wave:focus-visible:-outline-offset-2 wave:focus-visible:outline-ring" data-roving-value="1" role="group" tabindex="-1">',
    '<div aria-hidden="true" aria-label="Slide 3 of 4" aria-roledescription="slide" class="wave-carousel__slide wave:shrink-0 wave:focus-visible:outline-2 wave:focus-visible:-outline-offset-2 wave:focus-visible:outline-ring" inert="" role="group">',
    '<div aria-hidden="true" aria-label="Slide 4 of 4" aria-roledescription="slide" class="wave-carousel__slide wave:shrink-0 wave:focus-visible:outline-2 wave:focus-visible:-outline-offset-2 wave:focus-visible:outline-ring" inert="" role="group">',
    '<button aria-controls="carousel-slides-_id0_" aria-disabled="true" aria-label="Previous slide" class="wave-carousel__previous-button wave:z-10 wave:inline-flex wave:items-center wave:justify-center wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:absolute wave:top-1/2 wave:start-2 wave:-translate-y-1/2 wave:h-8 wave:w-8 wave:rounded-full wave:border wave:border-border wave:bg-background wave:shadow-2" data-disabled="" type="button">',
    '<button aria-controls="carousel-slides-_id0_" aria-label="Next slide" class="wave-carousel__next-button wave:z-10 wave:inline-flex wave:items-center wave:justify-center wave:text-foreground wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100 wave:absolute wave:top-1/2 wave:end-2 wave:-translate-y-1/2 wave:h-8 wave:w-8 wave:rounded-full wave:border wave:border-border wave:bg-background wave:shadow-2" type="button">',
    '<div aria-label="Choose slide" class="wave-carousel__picker wave:relative wave:mx-auto wave:flex wave:w-fit wave:flex-wrap wave:justify-center wave:gap-2 wave:p-2" role="group">',
    '<button aria-current="true" aria-label="Slides 1 to 2 of 4" class="wave-carousel__picker-button wave:group wave:inline-flex wave:items-center wave:justify-center wave:h-6 wave:min-w-6 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring" type="button">',
    '<button aria-label="Slides 3 to 4 of 4" class="wave-carousel__picker-button wave:group wave:inline-flex wave:items-center wave:justify-center wave:rounded-md wave:p-0.5 wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring" type="button">',
    '<span aria-hidden="true" class="wave-carousel__picker-indicator wave:block wave:h-2 wave:rounded-full wave:transition-[width,background-color] wave:duration-200 wave:motion-reduce:transition-none wave:w-5 wave:bg-primary wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none">',
  ].join('\n');

  it('renders the parts of ee05cf8 (attributes sorted), on the client and the server', () => {
    for (const slotProps of [undefined, EVERY_PART]) {
      const view = render(<Featured slotProps={slotProps} />);
      expect(withoutStyle(openingTags(...partsOf()))).toBe(BASE_PINS);
      expect(one(carouselClassNames.track)).toHaveStyle({ transform: 'translateX(0%)' });
      // jsdom writes the width it keeps as `calc(50%)`.
      for (const slide of all(document, carouselClassNames.slide)) {
        expect(slide.style.width).toBe('calc(50%)');
      }
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Featured slotProps={slotProps} />);
      expect(withoutStyle(openingTags(...partsOf(template.content)))).toBe(BASE_PINS);
      expect(all(template.content, carouselClassNames.track)[0].getAttribute('style')).toBe(
        'transform:translateX(0%)',
      );
    }
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    expectInertSlotProps(
      (slotProps: CarouselSlotProps | undefined) => <Featured slotProps={slotProps} />,
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: CarouselSlotProps | undefined) => (
        <Carousel motion="fade" motionDuration={500} defaultValue={2} slotProps={slotProps}>
          {slides(3)}
        </Carousel>
      ),
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: CarouselSlotProps | undefined) => (
        <Carousel controlsLayout="inline" loop autoPlay slotProps={slotProps}>
          <Carousel.Button direction="next" />
          {slides(3)}
        </Carousel>
      ),
      EVERY_PART,
    );
  });

  it('keeps the attribute order of ee05cf8 with every part empty', () => {
    const markup = (slotProps?: CarouselSlotProps) => {
      const { container, unmount } = render(<Featured slotProps={slotProps} />);
      const html = normaliseIds(container.innerHTML);
      unmount();
      return html;
    };
    expect(markup(EVERY_PART)).toBe(markup());
  });

  it('puts your className, style, data-* and ref on each part', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    const part = (name: string, conflict: string) => ({
      className: `my-${name} ${conflict}`,
      style: { outlineWidth: '3px' },
      'data-part': name,
      ref: collect,
    });
    render(
      <Featured
        slotProps={{
          autoPlayButton: part('auto-play-button', 'top-4'),
          track: part('track', 'block'),
          slide: part('slide', 'shrink'),
          previousButton: part('previous-button', 'start-4'),
          nextButton: part('next-button', 'end-4'),
          picker: part('picker', 'gap-4'),
          pickerButton: part('picker-button', 'focus-visible:outline-4'),
          pickerIndicator: part('picker-indicator', 'h-3'),
        }}
      />,
    );
    for (const [cls, name, conflict, count] of [
      [carouselClassNames.autoPlayButton, 'auto-play-button', 'wave:top-2', 1],
      [carouselClassNames.track, 'track', 'wave:flex', 1],
      [carouselClassNames.slide, 'slide', 'wave:shrink-0', 4],
      [carouselClassNames.previousButton, 'previous-button', 'wave:start-2', 1],
      [carouselClassNames.nextButton, 'next-button', 'wave:end-2', 1],
      [carouselClassNames.picker, 'picker', 'wave:gap-2', 1],
      [carouselClassNames.pickerButton, 'picker-button', 'wave:focus-visible:outline-2', 2],
      [carouselClassNames.pickerIndicator, 'picker-indicator', 'wave:h-2', 1],
    ] as const) {
      const elements = all(document, cls);
      expect(elements).toHaveLength(count);
      for (const element of elements) {
        expect(element.classList[0]).toBe(cls);
        expect(element).toHaveClass(`my-${name}`);
        // Your class replaces a conflicting one of the part.
        expect(element).not.toHaveClass(conflict);
        expect(element).toHaveAttribute('data-part', name);
        expect(element).toHaveStyle({ outlineWidth: '3px' });
        expect(refs).toContain(element);
      }
    }
    expect(refs).toHaveLength(12);
    expect(region()).not.toHaveAttribute('data-part');
  });

  it('keeps the position and timing the carousel writes over your style', () => {
    const { rerender } = render(
      <Carousel
        groupSize={2}
        defaultValue={2}
        motionDuration={800}
        slotProps={{
          track: { style: { transform: 'none', transitionDuration: '1s', outlineWidth: '3px' } },
          slide: { style: { width: '10px', outlineWidth: '3px' } },
        }}
      >
        {slides(4)}
      </Carousel>,
    );
    expect(one(carouselClassNames.track)).toHaveStyle({
      transform: 'translateX(-100%)',
      transitionDuration: '800ms',
      outlineWidth: '3px',
    });
    for (const slide of all(document, carouselClassNames.slide)) {
      expect(slide.style.width).toBe('calc(50%)');
      expect(slide).toHaveStyle({ outlineWidth: '3px' });
    }
    // A fade times the slides; the track has no style of its own, so yours is all of it.
    rerender(
      <Carousel
        motion="fade"
        motionDuration={500}
        slotProps={{
          track: { style: { outlineWidth: '2px' } },
          slide: { style: { transitionDuration: '1s', outlineWidth: '3px' } },
        }}
      >
        {slides(2)}
      </Carousel>,
    );
    expect(one(carouselClassNames.track)).toHaveAttribute('style', 'outline-width: 2px;');
    for (const slide of all(document, carouselClassNames.slide)) {
      expect(slide).toHaveStyle({ transitionDuration: '500ms', outlineWidth: '3px' });
    }
  });

  it('locks the attributes the carousel sets on every part', () => {
    const hiddenState = { hidden: true, inert: true, 'aria-hidden': true };
    const attempts = {
      autoPlayButton: {
        ...hiddenState,
        type: 'submit',
        role: 'switch',
        tabIndex: -1,
        disabled: true,
        'aria-label': 'Mine',
        'aria-controls': 'mine',
        'aria-pressed': true,
        'data-carousel-rotation': 'mine',
        'data-roving-container': '',
      },
      track: {
        ...hiddenState,
        id: 'mine',
        role: 'list',
        tabIndex: 0,
        'data-dragging': '',
        'data-roving-container': 'mine',
        'data-carousel-rotation': '',
      },
      // On a shown slide your inert would land without the lock, on a hidden one your aria-hidden.
      slide: {
        hidden: true,
        inert: true,
        'aria-hidden': false,
        role: 'listitem',
        tabIndex: 3,
        'aria-roledescription': 'mine',
        'aria-label': 'Mine',
        'data-roving-value': '9',
        'data-roving-container': '',
        'data-carousel-rotation': '',
        'aria-disabled': 'true',
        'data-roving-disabled': '',
      },
      // Unavailable: its state wins over yours.
      previousButton: {
        ...hiddenState,
        type: 'reset',
        role: 'link',
        tabIndex: -1,
        disabled: true,
        'aria-label': 'Mine',
        'aria-controls': 'mine',
        'aria-disabled': false,
        'data-roving-container': '',
        'data-carousel-rotation': '',
      },
      // Available: no unavailable state of yours lands.
      nextButton: {
        ...hiddenState,
        type: 'reset',
        role: 'link',
        tabIndex: -1,
        disabled: true,
        'aria-label': 'Mine',
        'aria-controls': 'mine',
        'aria-disabled': true,
        'data-disabled': '',
        'data-roving-container': '',
        'data-carousel-rotation': '',
      },
      picker: {
        ...hiddenState,
        role: 'tablist',
        tabIndex: 0,
        'aria-label': 'Mine',
        'data-roving-container': '',
        'data-carousel-rotation': '',
      },
      pickerButton: {
        ...hiddenState,
        type: 'submit',
        role: 'tab',
        tabIndex: -1,
        disabled: true,
        'aria-label': 'Mine',
        'aria-current': 'page',
        'data-roving-container': '',
        'data-carousel-rotation': '',
      },
      pickerIndicator: {
        hidden: true,
        inert: true,
        'aria-hidden': false,
        role: 'img',
        tabIndex: 0,
        'data-roving-container': '',
        'data-carousel-rotation': '',
      },
    } as unknown as CarouselSlotProps;
    render(<Featured slotProps={attempts} />);
    expect(withoutStyle(openingTags(...partsOf()))).toBe(BASE_PINS);
  });

  it.each([
    ['aria-disabled', { 'aria-disabled': 'true' }],
    ['data-roving-disabled', { 'data-roving-disabled': '' }],
  ] as const)(
    'keeps the shown slides in the arrow order and one Tab stop with your %s',
    async (_, attempt) => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Carousel groupSize={2} slotProps={{ slide: attempt }}>
            {slides(4)}
          </Carousel>
        </>,
      );
      const tabStops = () =>
        Array.from(one(carouselClassNames.track).querySelectorAll('[tabindex="0"]'));
      const [first, second, third] = slideGroups();
      expect(tabStops()).toEqual([first]);
      act(() => screen.getByRole('button', { name: 'Before' }).focus());
      await user.tab();
      expect(first).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(second).toHaveFocus();
      expect(tabStops()).toEqual([second]);
      // On past the page: the next page's first slide.
      await user.keyboard('{ArrowRight}');
      expect(third).toHaveFocus();
      expect(tabStops()).toEqual([third]);
      for (const slide of slideGroups()) {
        expect(slide).not.toHaveAttribute('aria-disabled');
        expect(slide).not.toHaveAttribute('data-roving-disabled');
      }
    },
  );

  it('pauses the rotation when focus moves on into a part that tries the rotation marker', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    render(
      <Carousel
        autoPlay
        loop
        autoPlayInterval={1000}
        slotProps={{
          track: { 'data-carousel-rotation': '' },
          slide: { 'data-carousel-rotation': '' },
        }}
      >
        {threeSlides}
      </Carousel>,
    );
    // Start on the control: the rotation runs while focus stays there.
    await user.tab();
    const toggle = screen.getByRole('button', { name: 'Start slide rotation' });
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(liveRegion()).toHaveAttribute('aria-live', 'off');
    // Focus moving on into a slide pauses it again.
    act(() => screen.getByRole('link', { name: 'First link' }).focus());
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
    expect(one(carouselClassNames.track)).not.toHaveAttribute('data-carousel-rotation');
    for (const slide of slideGroups()) expect(slide).not.toHaveAttribute('data-carousel-rotation');
  });

  it('runs your handler of a control first: preventDefault() skips the carousel', () => {
    const onValueChange = vi.fn();
    const order: string[] = [];
    const ui = (prevent: boolean) => (
      <Carousel
        autoPlay
        loop
        onValueChange={onValueChange}
        slotProps={{
          autoPlayButton: {
            onClick: (event) => {
              order.push('rotation');
              if (prevent) event.preventDefault();
            },
          },
          nextButton: {
            onClick: (event) => {
              order.push('next');
              if (prevent) event.preventDefault();
            },
          },
          pickerButton: {
            onClick: (event) => {
              order.push('picker');
              if (prevent) event.preventDefault();
            },
          },
        }}
      >
        {slides(3)}
      </Carousel>
    );
    const { rerender } = render(ui(true));
    fireEvent.click(screen.getByRole('button', { name: 'Pause slide rotation' }));
    fireEvent.click(nextButton());
    fireEvent.click(dots()[2]);
    expect(order).toEqual(['rotation', 'next', 'picker']);
    expect(screen.getByRole('button', { name: 'Pause slide rotation' })).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();

    rerender(ui(false));
    fireEvent.click(screen.getByRole('button', { name: 'Pause slide rotation' }));
    expect(screen.getByRole('button', { name: 'Start slide rotation' })).toBeInTheDocument();
    fireEvent.click(nextButton());
    expect(onValueChange).toHaveBeenLastCalledWith(1, expect.anything());
    fireEvent.click(dots()[2]);
    expect(onValueChange).toHaveBeenLastCalledWith(2, expect.anything());
    expect(order).toEqual(['rotation', 'next', 'picker', 'rotation', 'next', 'picker']);
  });

  it('calls no click handler of an unavailable Previous or Next button', () => {
    const previous = vi.fn();
    const next = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Carousel
        onValueChange={onValueChange}
        slotProps={{ previousButton: { onClick: previous }, nextButton: { onClick: next } }}
      >
        {slides(2)}
      </Carousel>,
    );
    // At the start: Previous is unavailable.
    fireEvent.click(prevButton());
    expect(previous).not.toHaveBeenCalled();
    fireEvent.click(nextButton());
    expect(next).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(1, expect.anything());
    // At the end: Next is unavailable, Previous is available again.
    fireEvent.click(nextButton());
    expect(next).toHaveBeenCalledTimes(1);
    fireEvent.click(prevButton());
    expect(previous).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(0, expect.anything());
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });

  it('keeps tracking the pointer over the rotation control whatever your handlers do', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const enter = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const leave = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <Carousel
        autoPlay
        loop
        autoPlayInterval={1000}
        slotProps={{ autoPlayButton: { onMouseEnter: enter, onMouseLeave: leave } }}
      >
        {threeSlides}
      </Carousel>,
    );
    // The pointer over the control does not pause the rotation.
    await user.hover(screen.getByRole('button', { name: 'Pause slide rotation' }));
    expect(enter).toHaveBeenCalledTimes(1);
    expect(liveRegion()).toHaveAttribute('aria-live', 'off');
    // Over the slides it does.
    await user.hover(screen.getByText('First slide'));
    expect(leave).toHaveBeenCalledTimes(1);
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps the arrow keys on the track and its focus record whatever your handlers do', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    const { rerender } = render(
      <Carousel
        groupSize={2}
        slotProps={{
          track: {
            onKeyDown: (event) => {
              keys.push(event.key);
              event.preventDefault();
            },
          },
        }}
      >
        {slides(4)}
      </Carousel>,
    );
    const [first, second] = slideGroups();
    act(() => first.focus());
    await user.keyboard('{ArrowRight}');
    // Prevented: the arrow key does not move.
    expect(keys).toEqual(['ArrowRight']);
    expect(first).toHaveFocus();

    // Your focus handler cancels nothing: the slide you focus takes the tab stop.
    rerender(
      <Carousel
        groupSize={2}
        slotProps={{
          track: {
            onKeyDown: (event) => void keys.push(event.key),
            onFocus: (event) => event.preventDefault(),
          },
        }}
      >
        {slides(4)}
      </Carousel>,
    );
    act(() => second.focus());
    expect(second).toHaveAttribute('tabindex', '0');
    expect(first).toHaveAttribute('tabindex', '-1');
    // Not prevented: the arrows move after yours, past the page too (the track's ref holds it).
    await user.keyboard('{ArrowLeft}');
    expect(first).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(slideGroups()[2]).toHaveFocus();
    expect(exposedSlides()).toEqual([3, 4]);
    expect(keys).toEqual(['ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowRight']);
  });

  it('keeps the track working while a new inline ref arrives on every render', async () => {
    const user = userEvent.setup();
    const seen: Element[] = [];
    const ui = () => (
      <Carousel
        groupSize={2}
        slotProps={{ track: { ref: (node) => void (node && seen.push(node)) } }}
      >
        {slides(4)}
      </Carousel>
    );
    const { rerender } = render(ui());
    rerender(ui());
    rerender(ui());
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((node) => node === one(carouselClassNames.track))).toBe(true);
    const [first] = slideGroups();
    act(() => first.focus());
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(slideGroups()[2]).toHaveFocus();
    expect(exposedSlides()).toEqual([3, 4]);
  });

  it('keeps measuring the first slide of an auto-sized page with your slide ref', async () => {
    const ro = installResizeObserverMock();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains(carouselClassNames.viewport) ? 300 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains(carouselClassNames.slide) ? 100 : 0;
    });
    const seen = new Set<Element>();
    render(
      <Carousel
        groupSize="auto"
        slotProps={{
          slide: { ref: (node: HTMLDivElement | null) => void (node && seen.add(node)) },
        }}
      >
        {slides(6)}
      </Carousel>,
    );
    expect(exposedSlides()).toEqual([1, 2, 3]);
    expect(seen.size).toBe(6);
    ro.restore();
    await act(async () => {});
  });

  it('applies a Previous or Next part to the built-in button only', () => {
    render(
      <Carousel
        slotProps={{
          previousButton: { className: 'my-previous', 'data-part': 'previous' },
          nextButton: { className: 'my-next' },
        }}
      >
        <Carousel.Button direction="previous">Back</Carousel.Button>
        {slides(3)}
      </Carousel>,
    );
    expect(document.querySelector('.my-previous')).toBeNull();
    expect(prevButton()).toHaveClass(carouselButtonClassNames.root);
    expect(prevButton()).not.toHaveAttribute('data-part');
    expect(nextButton()).toHaveClass(carouselClassNames.nextButton, 'my-next');
  });

  it('ignores a part the carousel does not draw', () => {
    const error = vi.spyOn(console, 'error');
    const { rerender } = render(
      <Carousel aria-label="Thumbs" slotProps={EVERY_PART}>
        {[0, 1].map((i) => (
          <Carousel.Item key={i} thumbnail={`slide-${i}.png`}>
            Slide {i + 1}
          </Carousel.Item>
        ))}
      </Carousel>,
    );
    // No autoPlay: no rotation control; every page has a thumbnail: no dot.
    expect(all(document, carouselClassNames.autoPlayButton)).toHaveLength(0);
    expect(all(document, carouselClassNames.pickerIndicator)).toHaveLength(0);
    expect(all(document, carouselClassNames.track)).toHaveLength(1);
    // No slides: the root alone, without the parts or a slotProps attribute.
    rerender(<Carousel aria-label="Empty" slotProps={EVERY_PART} />);
    expect(partsOf()).toHaveLength(0);
    expect(one(carouselClassNames.root)).not.toHaveAttribute('slotProps');
    expect(one(carouselClassNames.root)).not.toHaveAttribute('slotprops');
    expect(error).not.toHaveBeenCalled();
  });

  it('calls each part handler once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const handlers = {
      autoPlayButton: vi.fn(),
      nextButton: vi.fn(),
      pickerButton: vi.fn(),
      pickerIndicator: vi.fn(),
      slide: vi.fn(),
    };
    render(
      <React.StrictMode>
        <Carousel
          autoPlay
          loop
          onValueChange={onValueChange}
          slotProps={{
            autoPlayButton: { onClick: handlers.autoPlayButton },
            nextButton: { onClick: handlers.nextButton },
            pickerButton: { onClick: handlers.pickerButton },
            pickerIndicator: { onClick: handlers.pickerIndicator },
            slide: { onClick: handlers.slide },
          }}
        >
          {threeSlides}
        </Carousel>
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Pause slide rotation' }));
    await user.click(nextButton());
    await user.click(dots()[2].firstElementChild as HTMLElement);
    await user.click(screen.getByText('Third slide'));
    expect(handlers.autoPlayButton).toHaveBeenCalledTimes(1);
    expect(handlers.nextButton).toHaveBeenCalledTimes(1);
    expect(handlers.pickerIndicator).toHaveBeenCalledTimes(1);
    // The picker button received the dot's click too.
    expect(handlers.pickerButton).toHaveBeenCalledTimes(1);
    expect(handlers.slide).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls).toEqual([
      [1, expect.anything()],
      [2, expect.anything()],
    ]);
  });

  it('keeps the mirrored layout in right-to-left carousels', () => {
    renderWithProviders(
      <Carousel
        groupSize={2}
        defaultValue={2}
        slotProps={{
          track: { style: { transform: 'none' } },
          previousButton: { className: 'my-previous' },
        }}
      >
        {slides(4)}
      </Carousel>,
      { dir: 'rtl' },
    );
    expect(one(carouselClassNames.track)).toHaveStyle({ transform: 'translateX(100%)' });
    expect(prevButton()).toHaveClass('my-previous');
    expect(prevButton().querySelector('svg')).toHaveClass('wave:-scale-x-100');
  });

  it('has no accessibility violations with every part customised', async () => {
    render(
      <>
        <p id="carousel-note">Swipe or use the buttons</p>
        <Featured
          slotProps={{
            autoPlayButton: { className: 'my-rotation', 'aria-describedby': 'carousel-note' },
            track: { className: 'my-track' },
            slide: { className: 'my-slide', lang: 'en' },
            previousButton: { className: 'my-previous' },
            nextButton: { className: 'my-next', 'aria-describedby': 'carousel-note' },
            picker: { className: 'my-picker' },
            pickerButton: { className: 'my-picker-button' },
            pickerIndicator: { className: 'my-indicator' },
          }}
        />
      </>,
    );
    expect(nextButton()).toHaveAccessibleDescription('Swipe or use the buttons');
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof CarouselSlotProps>().toEqualTypeOf<
      | 'autoPlayButton'
      | 'track'
      | 'slide'
      | 'previousButton'
      | 'nextButton'
      | 'picker'
      | 'pickerButton'
      | 'pickerIndicator'
    >();
    expectTypeOf<NonNullable<CarouselSlotProps['track']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<CarouselSlotProps['nextButton']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<CarouselSlotProps['pickerIndicator']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // @ts-expect-error -- the carousel draws the slides into the track
    const track: CarouselSlotProps = { track: { children: 'x' } };
    // @ts-expect-error -- the carousel draws the chevron
    const next: CarouselSlotProps = { nextButton: { children: 'x' } };
    expect([track, next]).toHaveLength(2);
  });
});

describe('Carousel — slotProps of the dragged track', () => {
  const CAPTURE_METHODS = ['setPointerCapture', 'releasePointerCapture', 'hasPointerCapture'];
  let saved: Array<[string, PropertyDescriptor | undefined]> = [];
  let clock = 0;

  beforeEach(() => {
    clock = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    saved = CAPTURE_METHODS.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(Element.prototype, name),
    ]);
    // jsdom has no pointer capture.
    for (const name of CAPTURE_METHODS) {
      Object.defineProperty(Element.prototype, name, {
        configurable: true,
        writable: true,
        value: () => false,
      });
    }
  });

  afterEach(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
      else Reflect.deleteProperty(Element.prototype, name);
    }
  });

  const pointer = (x: number) => ({
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: 50,
  });
  const trackOf = () => region().querySelector(`.${carouselClassNames.track}`) as HTMLElement;

  function renderDraggable(part: NonNullable<CarouselProps['slotProps']>['track']) {
    const onValueChange = vi.fn();
    const onSlideClick = vi.fn();
    const view = render(
      <Carousel draggable onValueChange={onValueChange} slotProps={{ track: part }}>
        <Carousel.Item>
          <button type="button" onClick={onSlideClick}>
            Inside action
          </button>
        </Carousel.Item>
        {slides(2)}
      </Carousel>,
    );
    const el = trackOf();
    mockRect(el.parentElement as Element, { left: 0, top: 0, width: 400, height: 200 });
    return { el, onValueChange, onSlideClick, unmount: view.unmount };
  }
  const press = (el: HTMLElement, x: number) =>
    act(() => void fireEvent.pointerDown(el, pointer(x)));
  const move = (el: HTMLElement, x: number) => {
    clock += 1000;
    act(() => void fireEvent.pointerMove(el, pointer(x)));
  };
  const release = (el: HTMLElement, x: number) =>
    act(() => void fireEvent.pointerUp(el, pointer(x)));

  it('drags after your pointer handlers when they do not prevent it', () => {
    const order: string[] = [];
    const { el, onValueChange } = renderDraggable({
      onPointerDown: () => void order.push('down'),
      onPointerMove: () => void order.push('move'),
      onPointerUp: () => void order.push('up'),
    });
    press(el, 300);
    move(el, 150);
    expect(el).toHaveAttribute('data-dragging');
    expect(el).toHaveStyle({ transform: 'translateX(calc(0% + -150px))' });
    release(el, 150);
    expect(order).toEqual(['down', 'move', 'up']);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
  });

  it.each(['onPointerDown', 'onPointerMove'] as const)(
    'skips the drag when your %s handler prevents it',
    (handler) => {
      const own = vi.fn((event: React.PointerEvent) => event.preventDefault());
      const { el, onValueChange } = renderDraggable(
        handler === 'onPointerDown' ? { onPointerDown: own } : { onPointerMove: own },
      );
      press(el, 300);
      move(el, 150);
      expect(own).toHaveBeenCalled();
      expect(el).not.toHaveAttribute('data-dragging');
      release(el, 150);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(el).toHaveStyle({ transform: 'translateX(0%)' });
    },
  );

  it('ends a drag whatever your pointer up and cancel handlers do', () => {
    const up = vi.fn((event: React.PointerEvent) => event.preventDefault());
    const cancel = vi.fn((event: React.PointerEvent) => event.preventDefault());
    const { el, onValueChange } = renderDraggable({ onPointerUp: up, onPointerCancel: cancel });
    press(el, 300);
    move(el, 150);
    expect(el).toHaveAttribute('data-dragging');
    release(el, 150);
    expect(up).toHaveBeenCalledTimes(1);
    expect(el).not.toHaveAttribute('data-dragging');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());

    press(el, 300);
    move(el, 250);
    expect(el).toHaveAttribute('data-dragging');
    act(() => void fireEvent.pointerCancel(el, pointer(250)));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el).toHaveStyle({ transform: 'translateX(-100%)' });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('ends a drag when an untyped part gives no function as its pointer up handler', () => {
    // From JavaScript: a value that is no handler is skipped, as the merge skips it.
    const { el, onValueChange } = renderDraggable({
      onPointerUp: 'not a handler',
    } as unknown as NonNullable<CarouselProps['slotProps']>['track']);
    press(el, 300);
    move(el, 150);
    expect(el).toHaveAttribute('data-dragging');
    release(el, 150);
    expect(el).not.toHaveAttribute('data-dragging');
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1, expect.anything());
  });

  it('swallows the click that ends a drag whatever your click capture does', () => {
    const capture = vi.fn((event: React.MouseEvent) => event.preventDefault());
    const { el, onSlideClick } = renderDraggable({ onClickCapture: capture });
    const action = screen.getByRole('button', { name: 'Inside action' });
    press(el, 300);
    move(el, 250);
    release(el, 250);
    fireEvent.click(action, { detail: 1 });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(onSlideClick).not.toHaveBeenCalled();
    // The next click is delivered.
    fireEvent.click(action, { detail: 1 });
    expect(onSlideClick).toHaveBeenCalledTimes(1);
  });
});

describe('Carousel - the cause of a change (1.1)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const lastDetails = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.at(-1)?.[1];
  const focusable = () => slideGroups().filter((slide) => slide.hasAttribute('data-roving-value'));

  it('says previous and next for the built-in buttons, with the click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Carousel defaultValue={1} onValueChange={onValueChange}>
        {slides(3)}
      </Carousel>,
    );
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(onValueChange).toHaveBeenLastCalledWith(2, {
      reason: 'next',
      event: expect.objectContaining({ type: 'click' }),
    });
    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(onValueChange).toHaveBeenLastCalledWith(1, {
      reason: 'previous',
      event: expect.objectContaining({ type: 'click' }),
    });
  });

  it('says previous and next for a Carousel.Button, and picker for a picker button', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Carousel onValueChange={onValueChange}>
        <Carousel.Button direction="next">Go</Carousel.Button>
        {slides(3)}
      </Carousel>,
    );
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(lastDetails(onValueChange)).toMatchObject({ reason: 'next' });
    await user.click(screen.getByRole('button', { name: /Slide 3/ }));
    expect(onValueChange).toHaveBeenLastCalledWith(2, {
      reason: 'picker',
      event: expect.objectContaining({ type: 'click' }),
    });
  });

  it('says keyboard for an arrow past the edge of a page', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Carousel groupSize={3} onValueChange={onValueChange}>
        {slides(9)}
      </Carousel>,
    );
    act(() => focusable()[2]!.focus());
    await user.keyboard('{ArrowRight}');
    expect(onValueChange).toHaveBeenLastCalledWith(3, {
      reason: 'keyboard',
      event: expect.objectContaining({ type: 'keydown' }),
    });
    act(() => focusable()[0]!.focus());
    await user.keyboard('{ArrowLeft}');
    expect(onValueChange).toHaveBeenLastCalledWith(0, {
      reason: 'keyboard',
      event: expect.objectContaining({ type: 'keydown' }),
    });
  });

  it('says autoplay for the rotation, with an event of its own', () => {
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
    const details = lastDetails(onValueChange) as { reason: string; event: Event };
    expect(details.reason).toBe('autoplay');
    expect(details.event).toBeInstanceOf(Event);
    expect(details.event.type).toBe('autoplay');
  });

  it('says restart when the rotation control starts again from the first slide', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onValueChange = vi.fn();
    render(
      <Carousel autoPlay autoPlayInterval={1000} onValueChange={onValueChange}>
        {slides(2)}
      </Carousel>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(lastDetails(onValueChange)).toMatchObject({ reason: 'autoplay' });
    await user.click(screen.getByRole('button', { name: 'Start slide rotation' }));
    expect(onValueChange).toHaveBeenLastCalledWith(0, {
      reason: 'restart',
      event: expect.objectContaining({ type: 'click' }),
    });
  });

  it('carries the details of a controlled change, once per click in StrictMode, and none later', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Parent() {
      const [value, setValue] = React.useState(0);
      return (
        <Carousel
          value={value}
          onValueChange={(next, details) => {
            onValueChange(next, details);
            setValue(next);
          }}
        >
          {slides(3)}
        </Carousel>
      );
    }
    render(
      <React.StrictMode>
        <Parent />
      </React.StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'next' });
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(onValueChange.mock.calls[1]).toEqual([2, { reason: 'next', event: expect.anything() }]);
  });

  it('types: details are optional and carry a reason and an event', () => {
    expectTypeOf<CarouselProps['onValueChange']>().toEqualTypeOf<
      ((index: number, details?: CarouselChangeDetails) => void) | undefined
    >();
    expectTypeOf<CarouselChangeDetails['event']>().toEqualTypeOf<Event>();
    expectTypeOf<CarouselChangeReason>().toEqualTypeOf<
      'previous' | 'next' | 'picker' | 'drag' | 'keyboard' | 'autoplay' | 'restart'
    >();
    // A handler that takes only the index still fits.
    const handler: CarouselProps['onValueChange'] = (index: number) => void index;
    expect(handler).toBeTypeOf('function');
  });
});
