import * as React from 'react';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { slotRendersContent } from '../../lib/slot';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { disabledStyles, focusRing, forcedColors } from '../../lib/styles';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useDirection } from '../../hooks/useDirection';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

/** Accessible names of the rotation control shown while `autoPlay` is on. */
export interface CarouselAutoPlayLabels {
  /** Name of the control while slides rotate (activating it stops the rotation).
   * @default 'Pause slide rotation'
   */
  pause?: string;
  /** Name of the control while rotation is stopped (activating it starts the rotation).
   * @default 'Start slide rotation'
   */
  play?: string;
}

/**
 * Accessible names of the Carousel's built-in controls and slides, for localization. Each member
 * is optional and falls back to its English default. The rotation control has its own
 * `autoPlayLabels`; the region's name comes from `aria-label` or `aria-labelledby`.
 */
export interface CarouselLabels {
  /** Name of the Previous button.
   * @default 'Previous slide'
   */
  previous?: string;
  /** Name of the Next button.
   * @default 'Next slide'
   */
  next?: string;
  /** Name of the group that holds the slide picker buttons.
   * @default 'Choose slide'
   */
  picker?: string;
  /**
   * Name of the slide at `index` (zero-based, like `value`) out of `total` slides. It names the
   * slide itself and its picker button, and is announced by the live region when that slide is
   * shown.
   * @default (index, total) => `Slide ${index + 1} of ${total}`
   */
  slide?: (index: number, total: number) => string;
}

/** Properties for the Carousel component. */
export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled index of the currently active slide. Out-of-range values show the nearest slide. */
  value?: number;
  /** Default active slide index for uncontrolled usage.
   * @default 0
   */
  defaultValue?: number;
  /** Called with the new index when the active slide changes (not when it stays the same). */
  onValueChange?: (index: number) => void;
  /**
   * Rotates the slides automatically. A Pause/Start control is rendered as the first focusable
   * element. Rotation pauses while focus is anywhere inside the carousel (the control included;
   * clicking a control also moves focus there in most browsers) or the pointer is over it (except
   * over the control), and resumes when they leave, unless rotation is stopped. Activating Start
   * rotates at once, also while focus stays on the control; moving focus on to other content
   * pauses again. It starts stopped when the user prefers reduced motion. Without `loop`, rotation
   * ends at the last slide: the control shows Start, and rotation stays stopped (also after the
   * user moves back to an earlier slide) until Start is activated, which continues from the shown
   * slide, or from the first one while the last is shown. The end is tied to its cause: when the
   * number of slides changes (slides loaded later) or `loop` is turned on, rotation continues on
   * its own, unless the user stopped it with Pause.
   * @default false
   */
  autoPlay?: boolean;
  /** Interval in milliseconds between auto-play transitions.
   * @default 5000
   */
  autoPlayInterval?: number;
  /** Accessible names of the rotation control. */
  autoPlayLabels?: CarouselAutoPlayLabels;
  /**
   * Accessible names of the Previous and Next buttons, the slide picker and the slides (also
   * announced by the live region), for localization. Unset members keep their English defaults.
   */
  labels?: CarouselLabels;
  /** Whether the carousel loops back to the first slide after the last.
   * @default false
   */
  loop?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the CarouselItem sub-component. */
export interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_PAUSE_LABEL = 'Pause slide rotation';
const DEFAULT_PLAY_LABEL = 'Start slide rotation';
const DEFAULT_PREVIOUS_LABEL = 'Previous slide';
const DEFAULT_NEXT_LABEL = 'Next slide';
const DEFAULT_PICKER_LABEL = 'Choose slide';
const defaultSlideLabel = (index: number, total: number) => `Slide ${index + 1} of ${total}`;

function clampIndex(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

function isRotationControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-carousel-rotation]') !== null;
}

const controlButton = [
  'absolute z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-2',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  focusRing,
  disabledStyles,
].join(' ');

const PauseGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <rect x="4" y="3" width="3" height="10" rx="1" />
    <rect x="9" y="3" width="3" height="10" rx="1" />
  </svg>
);

const PlayGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M5 3.5v9a.5.5 0 0 0 .77.42l7-4.5a.5.5 0 0 0 0-.84l-7-4.5A.5.5 0 0 0 5 3.5Z" />
  </svg>
);

/**
 * A slideshow that shows one slide at a time (WAI-ARIA APG carousel with previous/next buttons
 * and a slide picker).
 *
 * - Slides are the `Carousel.Item` (`CarouselItem`) children, written directly in the Carousel or
 *   in Fragments. Other children are not rendered (a development warning says so). A component
 *   that renders `Carousel.Item` itself is not recognised: write the `Carousel.Item` in the
 *   Carousel and put the component inside it.
 * - Previous/Next stay focusable at the ends (`aria-disabled`), so keyboard focus is not lost.
 * - The slide picker is a group of buttons named "Slide n of m"; the active one has
 *   `aria-current="true"`.
 * - Inactive slides are `aria-hidden` and `inert`, so neither Tab nor a screen reader reaches
 *   their content.
 * - With `autoPlay`, a Pause/Start control comes first (WAI-ARIA APG): rotation pauses while
 *   focus is inside the carousel (in most browsers also after a click on one of its controls) or
 *   the pointer is over its content, activating Start rotates at once, and the live region is
 *   silent (`aria-live="off"`) while slides rotate. Without `loop` rotation ends at the last slide
 *   and stays stopped until the control's Start is activated (or the number of slides changes, or
 *   `loop` is turned on).
 * - Right-to-left layouts slide the other way and mirror the Previous/Next chevrons: the direction
 *   is read from the rendered element (its `dir` prop, the nearest ancestor's `dir`, WaveProvider
 *   `dir` or the document's), so an LTR section inside an RTL page stays LTR throughout.
 * - Name the carousel with `aria-label` or `aria-labelledby` (the fallback name is "Carousel").
 *   The built-in names are English: `labels` and `autoPlayLabels` translate them.
 * - The controls are layered over the slides inside the carousel's own stacking context, so they
 *   never paint over page headers that stay in view while the page scrolls.
 *
 * Compound access (`Carousel.Item`) needs a client module; React Server Components import the
 * flat name `CarouselItem` instead.
 */
const CarouselRoot = ({
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  autoPlay = false,
  autoPlayInterval = 5000,
  autoPlayLabels,
  labels,
  loop = false,
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ref,
  ...rest
}: CarouselProps) => {
  const [storedIndex, setActiveIndex] = useControllable(
    controlledValue,
    defaultValue,
    onValueChange,
  );
  const trackId = useId('carousel-slides');
  const [rootEl, setRootEl] = React.useState<HTMLDivElement | null>(null);
  const rootRef = useMergedRefs<HTMLDivElement>(ref, setRootEl);
  // The direction that applies to the rendered root (its own or an ancestor's `dir`, e.g. an RTL
  // section inside an LTR WaveProvider); before mount and on the server, the provider's/document's.
  const renderedDir = useDirection(rootEl);
  const dir = rest.dir === 'rtl' || rest.dir === 'ltr' ? rest.dir : renderedDir;
  const prefersReducedMotion = usePrefersReducedMotion();

  // Rotation state: stopped or not (the user's choice, stopped by default under reduced motion, or
  // ended at the last slide without loop) and the temporary pauses while the pointer is over the
  // content or focus is inside. An explicit Start overrides the focus pause while focus stays on
  // the rotation control (APG `hasUserActivatedPlay`), so pressing Start visibly starts the
  // rotation.
  const [userPaused, setUserPaused] = React.useState<boolean | null>(null);
  // The slide count at which rotation ended at the last slide (null while it has not ended), kept
  // apart from the user's choice so the end lasts only while its cause does.
  const [endedAt, setEndedAt] = React.useState<number | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [pointerOnControl, setPointerOnControl] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const [startedFromControl, setStartedFromControl] = React.useState(false);

  // Slides are the `CarouselItem` children, Fragments flattened; the element type is unwrapped, so
  // slides written in a Server Component (lazy client references) count too (R1, R2).
  const items: Array<{ key: string; node: React.ReactNode }> = [];
  let droppedChildren = false;
  for (const child of flattenChildren(children)) {
    if (isElementOfType(child.node, CarouselItem)) items.push(child);
    else if (slotRendersContent(child.node)) droppedChildren = true;
  }
  const total = items.length;

  React.useEffect(() => {
    if (droppedChildren) {
      warnOnce(
        'Carousel:non-item-children',
        'Carousel: only `Carousel.Item` (`CarouselItem`) children are slides, directly or in ' +
          'Fragments; other children are not rendered. A component that renders `Carousel.Item` ' +
          'itself is not recognised: render the `Carousel.Item` in the Carousel and put the ' +
          'component inside it.',
      );
    }
  }, [droppedChildren]);

  // Derived during render (C-HOOKS): removed slides or an out-of-range value show the nearest one.
  const index = clampIndex(storedIndex, total);
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  const prevDisabled = total <= 1 || (!loop && atStart);
  const nextDisabled = total <= 1 || (!loop && atEnd);

  // Without loop, rotation ends at the last slide (however it got there) and stays stopped: moving
  // back to an earlier slide does not restart it, only Start does. The end applies to the slide
  // count it happened at: once slides are added or removed, or loop is turned on, it is dropped
  // and rotation continues unless the user stopped it (adjusting state during render, C-HOOKS).
  const ended = endedAt === total && !loop;
  const stopped = (userPaused ?? prefersReducedMotion) || ended;
  const hasRotation = autoPlay && total > 1;
  if (hasRotation && !loop && atEnd && !stopped) setEndedAt(total);
  else if (endedAt !== null && !ended) setEndedAt(null);
  const pausedByPointer = hovered && !pointerOnControl;
  const pausedByFocus = focusWithin && !startedFromControl;
  const rotating = hasRotation && !stopped && !pausedByPointer && !pausedByFocus;

  // Compares with the shown (clamped) index, so re-picking the visible slide reports nothing.
  const goTo = (target: number) => {
    if (target >= 0 && target < total && target !== index) setActiveIndex(target);
  };
  const goPrev = () => goTo(atStart ? total - 1 : index - 1);
  const goNext = () => goTo(atEnd ? 0 : index + 1);

  // Reads the latest index at tick time (the updater's base), so the interval does not restart on
  // every slide or parent render and consecutive ticks chain even before a re-render.
  const advance = useEventCallback(() => {
    setActiveIndex((prev) => {
      const current = clampIndex(prev, total);
      if (current < total - 1) return current + 1;
      return loop ? 0 : prev;
    });
  });

  React.useEffect(() => {
    if (!rotating) return;
    const id = setInterval(advance, autoPlayInterval);
    return () => clearInterval(id);
  }, [rotating, autoPlayInterval, advance]);

  const toggleRotation = () => {
    if (stopped) {
      // Start: from the first slide when rotation had ended at the last one.
      if (!loop && atEnd) goTo(0);
      setEndedAt(null);
      setUserPaused(false);
      setStartedFromControl(true);
    } else {
      setUserPaused(true);
      setStartedFromControl(false);
    }
  };

  // The consumer's pointer and focus handlers composed with the pause tracking (C-COMPOSE). The
  // empty root gets them too: the consumer's handlers still run, and a pointer or focus that leaves
  // while there are no slides (slides being reloaded) does not keep rotation paused afterwards.
  const rootHandlers = {
    onMouseEnter: composeEventHandlers(onMouseEnter, () => setHovered(true)),
    onMouseLeave: composeEventHandlers(onMouseLeave, () => setHovered(false)),
    onFocus: composeEventHandlers(onFocus, (event: React.FocusEvent<HTMLDivElement>) => {
      // Any focus inside pauses (APG), the rotation control included. Focus that enters from
      // outside or moves on to other content ends the exemption of an explicit Start.
      const from = event.relatedTarget;
      const entering = !(from instanceof Node && event.currentTarget.contains(from));
      setFocusWithin(true);
      if (entering || !isRotationControl(event.target)) setStartedFromControl(false);
    }),
    onBlur: composeEventHandlers(onBlur, (event: React.FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node && event.currentTarget.contains(next))) {
        setFocusWithin(false);
        setStartedFromControl(false);
      }
    }),
  };

  if (total === 0) {
    return <div ref={rootRef} className={cn('relative', className)} {...rootHandlers} {...rest} />;
  }

  const offset = (dir === 'rtl' ? 1 : -1) * index * 100;
  // The chevrons mirror by the same resolved direction as the track. A CSS `rtl:` variant would
  // also match `[dir=rtl] *`, so an LTR carousel inside an RTL ancestor got mirrored chevrons.
  const chevronClass = dir === 'rtl' ? '-scale-x-100' : undefined;
  const pauseLabel = autoPlayLabels?.pause ?? DEFAULT_PAUSE_LABEL;
  const playLabel = autoPlayLabels?.play ?? DEFAULT_PLAY_LABEL;
  const previousLabel = labels?.previous ?? DEFAULT_PREVIOUS_LABEL;
  const nextLabel = labels?.next ?? DEFAULT_NEXT_LABEL;
  const pickerLabel = labels?.picker ?? DEFAULT_PICKER_LABEL;
  const slideLabel = labels?.slide ?? defaultSlideLabel;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Carousel"
      // A stacking context of its own: the controls' z-index cannot lift them over page headers.
      className={cn('relative isolate overflow-hidden', className)}
      {...rootHandlers}
      {...rest}
    >
      {hasRotation && (
        <button
          type="button"
          data-carousel-rotation=""
          aria-label={stopped ? playLabel : pauseLabel}
          aria-controls={trackId}
          onClick={toggleRotation}
          // The pointer over the control does not pause (APG): the user is operating it.
          onMouseEnter={() => setPointerOnControl(true)}
          onMouseLeave={() => setPointerOnControl(false)}
          className={cn(controlButton, 'top-2 start-2')}
        >
          {stopped ? <PlayGlyph /> : <PauseGlyph />}
        </button>
      )}
      <div
        id={trackId}
        className="flex transition-transform duration-300 ease-in-out motion-reduce:transition-none"
        style={{ transform: `translateX(${offset}%)` }}
      >
        {items.map(({ key, node }, i) => {
          const active = i === index;
          return (
            <div
              key={key}
              role="group"
              aria-roledescription="slide"
              aria-label={slideLabel(i, total)}
              aria-hidden={active ? undefined : true}
              inert={!active}
              className="w-full shrink-0"
            >
              {node}
            </div>
          );
        })}
      </div>
      {/* Announces the current slide, except while slides rotate on their own. */}
      <div aria-live={rotating ? 'off' : 'polite'} aria-atomic="true" className="sr-only">
        {slideLabel(index, total)}
      </div>
      <button
        type="button"
        aria-label={previousLabel}
        aria-controls={trackId}
        {...focusableDisabledProps(prevDisabled)}
        onClick={preventIfDisabled(prevDisabled, goPrev)}
        className={cn(controlButton, 'top-1/2 start-2 -translate-y-1/2')}
      >
        <ChevronLeftIcon size={16} className={chevronClass} />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        aria-controls={trackId}
        {...focusableDisabledProps(nextDisabled)}
        onClick={preventIfDisabled(nextDisabled, goNext)}
        className={cn(controlButton, 'top-1/2 end-2 -translate-y-1/2')}
      >
        <ChevronRightIcon size={16} className={chevronClass} />
      </button>
      <div
        role="group"
        aria-label={pickerLabel}
        className="absolute inset-x-0 bottom-1 z-10 mx-auto flex w-fit"
      >
        {items.map(({ key }, i) => {
          const active = i === index;
          return (
            <button
              key={key}
              type="button"
              aria-label={slideLabel(i, total)}
              aria-current={active ? 'true' : undefined}
              onClick={() => goTo(i)}
              className={cn('group inline-flex h-6 min-w-6 items-center justify-center', focusRing)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
                  active
                    ? cn('w-5 bg-primary', forcedColors.selectedLeaf)
                    : 'w-2 bg-stroke-accessible group-hover:bg-foreground forced-colors:bg-[ButtonText] forced-colors:forced-color-adjust-none',
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
CarouselRoot.displayName = 'Carousel';

/**
 * One slide of a {@link Carousel}. Write it in the Carousel, directly or in a Fragment: a component
 * that renders `Carousel.Item` itself is not recognised as a slide (put that component inside the
 * `Carousel.Item` instead).
 */
export const CarouselItem = ({ className, children, ref, ...rest }: CarouselItemProps) => {
  return (
    <div ref={ref} className={cn('p-4', className)} {...rest}>
      {children}
    </div>
  );
};
CarouselItem.displayName = 'CarouselItem';

/**
 * A slideshow that shows one slide at a time (WAI-ARIA APG carousel with previous/next buttons, a
 * slide picker and an optional `autoPlay` rotation with a Pause/Start control).
 *
 * Slides are the `Carousel.Item` children, written directly in the Carousel or in Fragments; other
 * children are not rendered (a development warning says so). Name the carousel with `aria-label`
 * or `aria-labelledby`; `labels` and `autoPlayLabels` translate the built-in English names.
 *
 * The slide is also exported as `CarouselItem`: React Server Components import that flat name
 * (dotted access needs a client file).
 */
export const Carousel = /* @__PURE__ */ Object.assign(CarouselRoot, {
  Item: CarouselItem,
});
