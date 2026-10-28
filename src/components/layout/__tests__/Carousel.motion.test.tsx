import * as React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carousel, CarouselItem, type CarouselMotion, type CarouselProps } from '../Carousel';
import { carouselClassNames } from '../../../lib/classNames';
import { carouselFadeMotion, carouselSlideMotion } from '../../../lib/motion';
import type { MotionPreference } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  mockMatchMedia,
  mockRect,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-CAR (spec §9.1, D4, D8, D18): Carousel's `motion` (`slide`, `fade` or `null`) and
 * `motionDuration`. The slide keeps 0.14's mechanism, the track's inline transform, with its
 * transition on the motion tokens (`carouselSlideMotion`); the fade stacks the slides of one-slide
 * pages in the track's one grid cell and fades each (`carouselFadeMotion`); the root renders the
 * resolved motion as `data-motion`. A `motionDuration` other than 300 ms is an inline transition
 * duration on the element that transitions. jsdom loads no CSS: the tests assert classes, inline
 * styles and attributes, and the real transitions are a §14 check.
 */

const FADE_GROUP_WARNING =
  '[WaveUI] Carousel: `motion="fade"` needs one slide per page; with `groupSize` above 1 or ' +
  '`"auto"` the slides slide.';

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
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
    vi.useRealTimers();
  }
});

function slides(n: number) {
  return Array.from({ length: n }, (_, i) => (
    <Carousel.Item key={i}>
      <p>Slide {i + 1} content</p>
    </Carousel.Item>
  ));
}

/** Three slides under a provider with `motion` (none: no provider). */
function renderCarousel(props: Partial<CarouselProps> = {}, provider?: MotionPreference) {
  const ui = (
    <Carousel aria-label="Promo" {...props}>
      {props.children ?? slides(3)}
    </Carousel>
  );
  return provider ? renderWithProviders(ui, { motion: provider }) : render(ui);
}

const region = () => screen.getByRole('region');
const track = () => region().querySelector<HTMLElement>('.' + carouselClassNames.track)!;
const slideElements = () =>
  Array.from(region().querySelectorAll<HTMLElement>('.' + carouselClassNames.slide));
const nextButton = () => screen.getByRole('button', { name: 'Next slide' });

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element, recipe: string) {
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

/** The slide is the one shown: visible, reachable and exposed. */
function expectShown(slide: HTMLElement) {
  expect(slide).not.toHaveClass('opacity-0');
  expect(slide).not.toHaveAttribute('inert');
  expect(slide).not.toHaveAttribute('aria-hidden');
}

/** The slide is hidden: transparent under fade, `inert` and `aria-hidden` as in every motion. */
function expectHidden(slide: HTMLElement) {
  expect(slide).toHaveClass('opacity-0');
  expect(slide).toHaveAttribute('inert');
  expect(slide).toHaveAttribute('aria-hidden', 'true');
}

describe('data-motion (§9.1)', () => {
  it.each([
    ['by default', {}, undefined, 'slide'],
    ['with motion="slide"', { motion: 'slide' }, undefined, 'slide'],
    ['with motion="fade"', { motion: 'fade' }, undefined, 'fade'],
    ['with motion={null}', { motion: null }, undefined, 'none'],
    ['under the provider "default"', {}, 'default', 'slide'],
    ['under the provider "none"', {}, 'none', 'none'],
    ['with motion="fade" under the provider "none"', { motion: 'fade' }, 'none', 'fade'],
    ['with motion="slide" under the provider "none"', { motion: 'slide' }, 'none', 'slide'],
    ['with motion={null} under the provider "default"', { motion: null }, 'default', 'none'],
  ] as const)('renders the resolved motion %s', (_, props, provider, expected) => {
    renderCarousel(props, provider);
    expect(region()).toHaveAttribute('data-motion', expected);
  });

  it.each([
    [{}, undefined, 'slide', []],
    [{ motion: 'fade' }, undefined, 'fade', []],
    [{ motion: null }, undefined, 'none', []],
    [{}, 'none', 'none', []],
    [{ motion: 'fade', groupSize: 2 }, undefined, 'slide', [[FADE_GROUP_WARNING]]],
  ] as const)(
    'renders it on a carousel without slides too (%o, provider %s)',
    (props, provider, expected, warnings) => {
      const ui = <Carousel data-testid="empty" {...props} />;
      if (provider) renderWithProviders(ui, { motion: provider });
      else render(ui);
      expect(screen.getByTestId('empty')).toHaveAttribute('data-motion', expected);
      expect(warn.mock.calls).toEqual(warnings);
      warn.mockClear();
    },
  );

  it('keeps motion and motionDuration off the DOM', () => {
    renderCarousel({ motion: 'fade', motionDuration: 450 });
    for (const el of [region(), ...region().querySelectorAll('*')]) {
      expect(el).not.toHaveAttribute('motion');
      expect(el).not.toHaveAttribute('motionduration');
      expect(el).not.toHaveAttribute('motion-duration');
    }
  });
});

describe('slide (§9.1)', () => {
  it('the track transitions its transform on the motion tokens, no longer on 0.14’s classes', () => {
    renderCarousel();
    expect(track()).toHaveClass('flex', ...motionClasses(carouselSlideMotion));
    expect(track()).not.toHaveClass('duration-300');
    expect(track()).not.toHaveClass('ease-in-out');
    expect(track().style.transform).toBe('translateX(0%)');
    for (const slide of slideElements()) {
      expectNoWordOf(slide, carouselFadeMotion);
      expect(slide).not.toHaveClass('opacity-0');
      expect(slide).not.toHaveClass('col-start-1');
      expect(slide).toHaveClass('w-full');
    }
  });

  it('moves the track by its transform as before, also in right-to-left layouts', async () => {
    const user = userEvent.setup();
    renderCarousel();
    await user.click(nextButton());
    expect(track().style.transform).toBe('translateX(-100%)');
    expect(track()).toHaveClass(...motionClasses(carouselSlideMotion));
  });

  it('mirrors under dir="rtl" with the same motion', () => {
    renderWithProviders(
      <Carousel aria-label="Promo" defaultValue={1}>
        {slides(3)}
      </Carousel>,
      { dir: 'rtl' },
    );
    expect(track().style.transform).toBe('translateX(100%)');
    expect(track()).toHaveClass(...motionClasses(carouselSlideMotion));
    expect(region()).toHaveAttribute('data-motion', 'slide');
  });

  it.each([
    ['motion={null}', { motion: null }, undefined],
    ['the provider "none"', {}, 'none'],
  ] as const)('with %s the track has no transition and still moves', async (_, props, provider) => {
    const user = userEvent.setup();
    renderCarousel(props, provider);
    expectNoWordOf(track(), carouselSlideMotion);
    expect(track()).toHaveClass('flex');
    for (const slide of slideElements()) expectNoWordOf(slide, carouselFadeMotion);
    await user.click(nextButton());
    expect(track().style.transform).toBe('translateX(-100%)');
  });
});

describe('fade (§9.1)', () => {
  it('stacks the slides in the first cell of a one-column grid track, without a transform', () => {
    renderCarousel({ motion: 'fade' });
    expect(track()).toHaveClass('grid', 'grid-cols-[minmax(0,1fr)]');
    expect(track()).not.toHaveClass('flex');
    expect(track().style.transform).toBe('');
    expectNoWordOf(track(), carouselSlideMotion);
    for (const slide of slideElements()) {
      expect(slide).toHaveClass('col-start-1', 'row-start-1', ...motionClasses(carouselFadeMotion));
    }
  });

  it('hides the inactive slides by opacity, inert and aria-hidden, and moves that with the page', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderCarousel({ motion: 'fade', onValueChange });
    const [first, second, third] = slideElements() as [HTMLElement, HTMLElement, HTMLElement];
    expectShown(first);
    expectHidden(second);
    expectHidden(third);

    await user.click(nextButton());
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
    expectHidden(first);
    expectShown(second);
    expectHidden(third);
    expect(track().style.transform).toBe('');
    for (const slide of slideElements()) {
      expect(slide).toHaveClass(...motionClasses(carouselFadeMotion));
    }

    await user.click(screen.getByRole('button', { name: 'Slide 3 of 3' }));
    expectHidden(second);
    expectShown(third);
  });

  it('has no transform in right-to-left layouts either', () => {
    renderWithProviders(
      <Carousel aria-label="Promo" motion="fade" defaultValue={1}>
        {slides(3)}
      </Carousel>,
      { dir: 'rtl' },
    );
    expect(track().style.transform).toBe('');
    expectShown(slideElements()[1]!);
  });

  it('keeps the inactive slides out of the Tab order and passes axe', async () => {
    renderCarousel({
      motion: 'fade',
      defaultValue: 1,
      children: ['One', 'Two', 'Three'].map((name) => (
        <Carousel.Item key={name}>
          <a href={`#${name}`}>{name} link</a>
        </Carousel.Item>
      )),
    });
    expect(screen.getByRole('link', { name: 'Two link' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'One link' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Three link' })).toBeNull();
    await expectNoA11yViolations();
  });
});

describe('motionDuration (§9.1, D4)', () => {
  it('a duration other than 300 ms is an inline transition duration on the track (slide)', () => {
    renderCarousel({ motionDuration: 450 });
    expect(track().style.transitionDuration).toBe('450ms');
    for (const slide of slideElements()) expect(slide.style.transitionDuration).toBe('');
  });

  it('is an inline transition duration on each slide under fade', () => {
    renderCarousel({ motion: 'fade', motionDuration: 450 });
    expect(track().style.transitionDuration).toBe('');
    for (const slide of slideElements()) expect(slide.style.transitionDuration).toBe('450ms');
  });

  it('writes 0 ms as given', () => {
    renderCarousel({ motionDuration: 0 });
    expect(track().style.transitionDuration).toBe('0ms');
  });

  it.each([
    ['by default', {}],
    ['at an explicit 300 ms', { motionDuration: 300 }],
    ['by default under fade', { motion: 'fade' }],
    ['at an explicit 300 ms under fade', { motion: 'fade', motionDuration: 300 }],
  ] as const)('writes no inline duration %s: the tokens time it', (_, props) => {
    renderCarousel(props);
    for (const el of [track(), ...slideElements()]) {
      expect(el.style.transitionDuration).toBe('');
    }
  });

  it.each([
    ['motion={null}', { motion: null }, undefined],
    ['the provider "none"', {}, 'none'],
  ] as const)('writes none without a transition (%s)', (_, props, provider) => {
    renderCarousel({ ...props, motionDuration: 450 }, provider);
    for (const el of [track(), ...slideElements()]) {
      expect(el.style.transitionDuration).toBe('');
    }
  });
});

describe('fade with pages of several slides (§9.1)', () => {
  it.each([
    ['groupSize={2}', { groupSize: 2 }],
    ['groupSize="auto"', { groupSize: 'auto' }],
  ] as const)('falls back to the slide with %s and warns once from an effect', async (_, props) => {
    const ui = (extra: Partial<CarouselProps> = {}) => (
      <React.StrictMode>
        <Carousel aria-label="Promo" motion="fade" {...props} {...extra}>
          {slides(4)}
        </Carousel>
      </React.StrictMode>
    );
    const { rerender } = render(ui());
    expect(region()).toHaveAttribute('data-motion', 'slide');
    expect(track()).toHaveClass('flex', ...motionClasses(carouselSlideMotion));
    expect(track()).not.toHaveClass('grid');
    expect(track().style.transform).toMatch(/^translateX\(/);
    for (const slide of slideElements()) {
      expectNoWordOf(slide, carouselFadeMotion);
      expect(slide).not.toHaveClass('col-start-1');
      expect(slide).not.toHaveClass('opacity-0');
    }
    rerender(ui({ motionDuration: 450 }));
    // Settle the observers the roving focus group and the sizing set up.
    await act(async () => {});
    expect(track().style.transitionDuration).toBe('450ms');
    expect(warn.mock.calls).toEqual([[FADE_GROUP_WARNING]]);
    warn.mockClear();
  });

  it('warns from an effect: server rendering logs nothing and renders the slide', () => {
    const html = renderToString(
      <Carousel aria-label="Promo" motion="fade" groupSize={2}>
        {slides(4)}
      </Carousel>,
    );
    expect(html).toContain('data-motion="slide"');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['motion="fade" with groupSize={1}', { motion: 'fade', groupSize: 1 }],
    ['the default motion with groupSize={2}', { groupSize: 2 }],
    ['motion={null} with groupSize={2}', { motion: null, groupSize: 2 }],
    ['motion="slide" with groupSize="auto"', { motion: 'slide', groupSize: 'auto' }],
  ] as const)('does not warn for %s', async (_, props) => {
    renderCarousel(props);
    // Settle the observers the roving focus group and the sizing set up.
    await act(async () => {});
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('dragging (§9.1)', () => {
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

  /** A 400 px wide draggable carousel of three slides. */
  function renderDraggable(props: Partial<CarouselProps> = {}) {
    const onValueChange = vi.fn();
    renderCarousel({ draggable: true, onValueChange, ...props });
    mockRect(track().parentElement as Element, { left: 0, top: 0, width: 400, height: 200 });
    return { el: track(), onValueChange };
  }

  const pointer = (x: number) => ({
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: 50,
  });

  function press(el: HTMLElement, from: number, to: number) {
    act(() => {
      fireEvent.pointerDown(el, pointer(from));
    });
    clock += 1000;
    act(() => {
      fireEvent.pointerMove(el, pointer(to));
    });
  }

  function release(el: HTMLElement, at: number) {
    act(() => {
      fireEvent.pointerUp(el, pointer(at));
    });
  }

  it('slide: the track follows the pointer without its transition and gets it back on release', () => {
    const { el, onValueChange } = renderDraggable({ motionDuration: 450 });
    press(el, 300, 150);
    expect(el).toHaveAttribute('data-dragging', '');
    expect(el.style.transform).toBe('translateX(calc(0% + -150px))');
    expectNoWordOf(el, carouselSlideMotion);
    // No duration either: without a transition list it would time every property.
    expect(el.style.transitionDuration).toBe('');
    release(el, 150);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('translateX(-100%)');
    expect(el).toHaveClass(...motionClasses(carouselSlideMotion));
    expect(el.style.transitionDuration).toBe('450ms');
  });

  it('fade: a drag past the threshold pages, and no transform follows the pointer', () => {
    const { el, onValueChange } = renderDraggable({ motion: 'fade' });
    press(el, 300, 150);
    expect(el).toHaveAttribute('data-dragging', '');
    expect(el.style.transform).toBe('');
    expectShown(slideElements()[0]!);
    release(el, 150);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(1);
    expect(el).not.toHaveAttribute('data-dragging');
    expect(el.style.transform).toBe('');
    expectHidden(slideElements()[0]!);
    expectShown(slideElements()[1]!);
    for (const slide of slideElements()) {
      expect(slide).toHaveClass(...motionClasses(carouselFadeMotion));
    }
  });

  it('fade: a short drag snaps back and changes nothing', () => {
    const { el, onValueChange } = renderDraggable({ motion: 'fade' });
    press(el, 300, 260);
    release(el, 260);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(el.style.transform).toBe('');
    expectShown(slideElements()[0]!);
  });

  it('fade: lets the page scroll vertically over a draggable track', () => {
    const { el } = renderDraggable({ motion: 'fade' });
    expect(el).toHaveClass('touch-pan-y', 'grid');
  });
});

describe('reduced motion (D8)', () => {
  it.each([true, false])(
    'renders the same motion with prefers-reduced-motion %s: the CSS turns it off',
    (reduce) => {
      mockMatchMedia({ '(prefers-reduced-motion: reduce)': reduce });
      const { unmount } = renderCarousel({ motionDuration: 450 });
      expect(region()).toHaveAttribute('data-motion', 'slide');
      expect(track()).toHaveClass(...motionClasses(carouselSlideMotion));
      expect(track()).toHaveClass('motion-reduce:transition-none');
      expect(track().style.transitionDuration).toBe('450ms');
      unmount();

      renderCarousel({ motion: 'fade' });
      expect(region()).toHaveAttribute('data-motion', 'fade');
      for (const slide of slideElements()) {
        expect(slide).toHaveClass(
          ...motionClasses(carouselFadeMotion),
          'motion-reduce:transition-none',
        );
      }
    },
  );
});

describe('slides written in a Server Component (C-COMPOUND)', () => {
  const Item = asClientReference(CarouselItem);
  const names = ['First', 'Second', 'Third'];
  const plain = (props: Partial<CarouselProps>) => (
    <Carousel aria-label="Promo" {...props}>
      {names.map((name) => (
        <CarouselItem key={name}>{`${name} slide`}</CarouselItem>
      ))}
    </Carousel>
  );
  const lazy = (props: Partial<CarouselProps>) => (
    <Carousel aria-label="Promo" {...props}>
      {names.map((name) => (
        <Item key={name}>{`${name} slide`}</Item>
      ))}
    </Carousel>
  );

  it.each([
    ['fade', { motion: 'fade', motionDuration: 450 }],
    ['slide', { motionDuration: 450 }],
    ['none', { motion: null }],
  ] as const)('server-renders the %s motion as with the plain CarouselItem', (motion, props) => {
    const html = renderToString(plain(props));
    expect(html).toContain(`data-motion="${motion}"`);
    expect(renderToString(lazy(props))).toBe(html);
  });

  it('hydrates a fading carousel without warnings', () => {
    const ui = lazy({ motion: 'fade', motionDuration: 450, defaultValue: 1 });
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    document.body.appendChild(container);
    try {
      const slidesBefore = Array.from(
        container.querySelectorAll<HTMLElement>('.' + carouselClassNames.slide),
      );
      expect(slidesBefore.map((slide) => slide.style.transitionDuration)).toEqual([
        '450ms',
        '450ms',
        '450ms',
      ]);
      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      act(() => {
        root = hydrateRoot(container, ui, { onRecoverableError });
      });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(Array.from(container.querySelectorAll('.' + carouselClassNames.slide))).toEqual(
        slidesBefore,
      );
      expectShown(slidesBefore[1]!);
      expectHidden(slidesBefore[0]!);
      act(() => root?.unmount());
    } finally {
      container.remove();
    }
  });
});

describe('types (§9.1)', () => {
  it('types motion as CarouselMotion or null and motionDuration as a number', () => {
    expectTypeOf<CarouselMotion>().toEqualTypeOf<'slide' | 'fade'>();
    expectTypeOf<CarouselProps['motion']>().toEqualTypeOf<CarouselMotion | null | undefined>();
    expectTypeOf<CarouselProps['motionDuration']>().toEqualTypeOf<number | undefined>();
    // @ts-expect-error a motion is `slide` or `fade`, not a class string
    const wrong: CarouselProps = { motion: 'transition-opacity' };
    expect(wrong).toBeDefined();
  });
});
