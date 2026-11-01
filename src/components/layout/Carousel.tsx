import * as React from 'react';
import { carouselClassNames, carouselItemClassNames } from '../../lib/classNames';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent } from '../../lib/direction';
import { carouselFadeMotion, carouselSlideMotion } from '../../lib/motion';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import {
  composeAfterPart,
  lockPositionStyle,
  mergeSlotProps,
  type SlotPart,
} from '../../lib/slotProps';
import type { MotionPreference, Slot } from '../../lib/types';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { focusRing, forcedColors } from '../../lib/styles';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useDirection } from '../../hooks/useDirection';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionPreference } from '../../hooks/useMotion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useRovingTabIndex } from '../../hooks/useRovingTabIndex';
import { CarouselButton } from './Carousel.button';
import { CarouselContext } from './Carousel.context';
import type { CarouselContextValue, CarouselControlsLayout } from './Carousel.context';
import { useCarouselDrag } from './Carousel.drag';
import { clampToPage, lastPageStart, pageCount } from './Carousel.groups';
import { CAROUSEL_CONTROL_BASE, CAROUSEL_CONTROL_LAYOUT } from './Carousel.styles';

export type { CarouselControlsLayout };

/** How a Carousel is drawn: `flat`, or `elevated` with rounded corners and a shadow. */
export type CarouselAppearance = 'flat' | 'elevated';

/**
 * How a Carousel moves between pages: `slide` moves the slides in from the side of the page order,
 * `fade` cross-fades them in place (one slide per page only).
 */
export type CarouselMotion = 'slide' | 'fade';

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
 * Accessible names of the Carousel's built-in controls and slides, and the role descriptions of
 * the carousel and its slides, for localization. Each member is optional and falls back to its
 * English default. The rotation control has its own `autoPlayLabels`; the region's name comes
 * from `aria-label` or `aria-labelledby`.
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
  /**
   * Name of a page of several slides, from the one-based number of its first and last slide, out
   * of `total` slides (`groupSize` above 1). It names the page's picker button and is announced
   * by the live region when the page is shown. A page of one slide uses `slide`.
   * @default (start, end, total) => `Slides ${start} to ${end} of ${total}`
   */
  slides?: (start: number, end: number, total: number) => string;
  /** How assistive technology announces the carousel region (`aria-roledescription`).
   * @default 'carousel'
   */
  carouselRoleDescription?: string;
  /** How assistive technology announces each slide (`aria-roledescription`).
   * @default 'slide'
   */
  slideRoleDescription?: string;
}

/** Properties for the Carousel component. */
export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Controlled index of the active slide: with `groupSize` above 1, the first slide of the shown
   * page. A value in the middle of a page shows that page and out-of-range values show the
   * nearest one.
   */
  value?: number;
  /** Default active slide index for uncontrolled usage.
   * @default 0
   */
  defaultValue?: number;
  /**
   * Called with the new index when the active slide changes (not when it stays the same): the
   * first slide of the new page when `groupSize` is above 1.
   */
  onValueChange?: (index: number) => void;
  /**
   * How many slides one page shows: a number, or `'auto'` to show as many as fit the width of the
   * carousel (the slides keep their own width, which must be equal). Previous, Next, the picker
   * (one button per page), looping and autoplay move by page, and the slides of the shown page
   * form one arrow-key focus group. With `1` each slide fills the width, as before.
   * @default 1
   */
  groupSize?: number | 'auto';
  /**
   * With `groupSize="auto"`, where the shown page sits when its slides do not fill the width.
   * @default 'start'
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Lets the pointer drag the slides (mouse, touch and pen). The track follows the pointer and,
   * on release, the page changes when the drag passed a quarter of the width or left fast, else
   * it snaps back; the direction follows the carousel's. Under `motion="fade"` the slides do not
   * follow the pointer (they share one place): the same drag still changes the page on release,
   * and the slides cross-fade. The click that ends a drag is not delivered to the slide, and a
   * vertical swipe still scrolls the page. Dragging pauses autoplay like the pointer over the
   * carousel does. The buttons and the keyboard stay the way to operate the carousel without a
   * pointer.
   * @default false
   */
  draggable?: boolean;
  /**
   * Where the Previous and Next buttons go. `overlay` floats round buttons over the slides;
   * `overlay-wide` makes them full-height strips at the edges; `inline` puts them in a row with
   * the slides, outside them; `inline-wide` is `inline` with full-height buttons. The rotation
   * control stays the first focusable element at the start corner in every layout.
   * @default 'overlay'
   */
  controlsLayout?: CarouselControlsLayout;
  /**
   * `elevated` rounds the corners and adds a shadow.
   * @default 'flat'
   */
  appearance?: CarouselAppearance;
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
   * announced by the live region), and the role descriptions of the carousel and its slides, for
   * localization. Unset members keep their English defaults.
   */
  labels?: CarouselLabels;
  /** Whether the carousel loops back to the first slide after the last.
   * @default false
   */
  loop?: boolean;
  /**
   * How the carousel moves between pages: `slide` glides the slides in from the side of the page
   * order (mirrored in right-to-left layouts), `fade` cross-fades them in place, and `null` turns
   * the motion off (the page changes at once). Fluent's `motion`; its object form with a
   * `duration` is not offered: use `motionDuration`. `fade` needs one slide per page: with
   * `groupSize` above 1 or `'auto'` the slides slide, and a development warning says so. Under
   * `fade` a drag still changes the page on release, but the slides do not follow the pointer.
   * Below a `WaveProvider` with `motion="none"` the carousel does not move unless this prop is
   * set. Either motion is off while the user prefers reduced motion. The root renders the motion
   * it resolves from this prop, `groupSize` and the provider as `data-motion` (`slide`, `fade` or
   * `none`); reduced motion leaves it unchanged.
   * @default 'slide'
   */
  motion?: CarouselMotion | null;
  /**
   * How long the slide or the fade takes, in milliseconds. Fluent's `duration` is a different
   * unit (Embla's unitless speed, 20 to 60), so a value ported from Fluent is far too short.
   * @default 300
   */
  motionDuration?: number;
  /**
   * Props for the elements the carousel draws around and between its slides, by part, merged into
   * each part's own: your classes after the part's (yours win a conflict), your styles over its
   * styles, your attributes and handlers added, your ref attached. Every attribute the carousel
   * sets on a part is locked, and so are its handlers: yours runs first, and `preventDefault()` in
   * yours skips the carousel's handling of the event, except where a part says its work always
   * runs. A part takes no `children` (the carousel draws their content). Each part locks, unset
   * where the carousel sets none, `role`, `tabIndex`, `data-roving-container` (it would take the
   * slides out of their arrow-key order), `data-carousel-rotation` (the rotation control's marker:
   * focus inside a part that carries it would not pause the rotation) and `hidden`, `inert` and
   * `aria-hidden`. A
   * `Carousel.Button` you write replaces the built-in button of its direction and takes its props
   * directly: `previousButton` and `nextButton` reach only the built-in buttons. The viewport
   * around the track has no part.
   */
  slotProps?: {
    /**
     * The rotation control shown while `autoPlay` rotates (stable class
     * `wave-carousel__auto-play-button`). Locked: `type`, its marker `data-carousel-rotation`,
     * `aria-label` (from `autoPlayLabels`), `aria-controls`, `disabled` and `aria-pressed` unset
     * (its name says what it does), and its click (Pause or Start). Its pointer tracking (the
     * pointer over the control does not pause the rotation) always runs after your mouse enter
     * and leave handlers, whatever they do.
     */
    autoPlayButton?: SlotPart<'button'>;
    /**
     * The track that holds the slides and moves between pages (stable class
     * `wave-carousel__track`). Locked: its `id` (the controls' `aria-controls`), its position and
     * timing (the translation and the duration it writes in its style win over your style),
     * `data-dragging`, and with several slides per page the roving container of the slides'
     * arrow keys (`data-roving-container` and the arrow-key handling). The drag (`draggable`)
     * starts on its pointer down and follows its pointer moves: `preventDefault()` in yours skips
     * them. The end of a drag (pointer up and cancel), the swallowed click that ends it and the
     * focus bookkeeping of the arrow keys always run after yours, whatever it does.
     */
    track?: SlotPart<'div'>;
    /**
     * Each slide around a `Carousel.Item` (stable class `wave-carousel__slide`). Locked:
     * `role="group"`, `aria-roledescription` and `aria-label` (from `labels`), `aria-hidden` and
     * `inert` on the slides that are not shown, and `tabIndex` and `data-roving-value` (set with
     * several slides per page, which share one arrow-key focus group), with `aria-disabled` and
     * `data-roving-disabled` unset (the group would skip a slide that carries either); the width
     * and the timing it sets win over your style. The same props reach every slide.
     */
    slide?: SlotPart<'div'>;
    /**
     * The built-in Previous button (stable class `wave-carousel__previous-button`). Locked:
     * `type`, `aria-label` (`labels.previous`), `aria-controls`, `disabled` unset, its click, and
     * `aria-disabled` and `data-disabled` while it is unavailable (at the start without `loop`, or
     * with one page), which keep it focusable. While it is unavailable your click handler is not
     * called, as the carousel's is not.
     */
    previousButton?: SlotPart<'button'>;
    /**
     * The built-in Next button (stable class `wave-carousel__next-button`), locked as
     * `previousButton` (`labels.next`; unavailable at the end without `loop`).
     */
    nextButton?: SlotPart<'button'>;
    /**
     * The group of slide picker buttons (stable class `wave-carousel__picker`). Locked:
     * `role="group"` and `aria-label` (`labels.picker`).
     */
    picker?: SlotPart<'div'>;
    /**
     * Each button of the slide picker, one per page (stable class
     * `wave-carousel__picker-button`). Locked: `type`, `aria-label` (the page's name from
     * `labels`), `aria-current` on the button of the shown page, `disabled` unset, and its click.
     * The same props reach every button.
     */
    pickerButton?: SlotPart<'button'>;
    /**
     * The dot inside each picker button of a page without a thumbnail (stable class
     * `wave-carousel__picker-indicator`). Locked: `aria-hidden` (it is decorative: the button is
     * named by its page) and, unset, `role` and `tabIndex`. A click on it is a click on its
     * button, after yours.
     */
    pickerIndicator?: SlotPart<'span'>;
  };
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the CarouselItem sub-component. */
export interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * An image for this slide's button in the picker, in place of the dot. A string is the image
   * `src`; an object sets the `<img>`'s attributes. The button keeps its slide-label name, so the
   * image is decorative (`alt=""`). When any slide has one, the picker becomes a row of
   * thumbnails below the slides; a slide without one keeps its dot. With `groupSize` above 1, a
   * page shows the thumbnail of its first slide.
   */
  thumbnail?: Slot<'img'>;
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_PAUSE_LABEL = 'Pause slide rotation';
const DEFAULT_PLAY_LABEL = 'Start slide rotation';
const DEFAULT_PREVIOUS_LABEL = 'Previous slide';
const DEFAULT_NEXT_LABEL = 'Next slide';
const DEFAULT_PICKER_LABEL = 'Choose slide';
const defaultSlideLabel = (index: number, total: number) => `Slide ${index + 1} of ${total}`;
const DEFAULT_CAROUSEL_ROLE_DESCRIPTION = 'carousel';
const DEFAULT_SLIDE_ROLE_DESCRIPTION = 'slide';
/** The default `motionDuration`: the slow duration token, which the motion classes carry. */
const DEFAULT_MOTION_DURATION = 300;

const defaultSlidesLabel = (start: number, end: number, total: number) =>
  `Slides ${start} to ${end} of ${total}`;

/**
 * With `groupSize="auto"`: how many slides fit the width of the carousel, from the width of the
 * first slide, and the two widths. A snapshot string (`perPage:slideWidth:rootWidth`) so that
 * `useSyncExternalStore` compares it by value; one slide per page before anything is measured.
 */
function useAutoPageSize(
  enabled: boolean,
  root: HTMLElement | null,
  slide: HTMLElement | null,
): { perPage: number; slideWidth: number; rootWidth: number } {
  const subscribe = React.useCallback(
    (notify: () => void) => {
      if (!enabled || !root || typeof ResizeObserver === 'undefined') return () => {};
      const observer = new ResizeObserver(notify);
      observer.observe(root);
      if (slide) observer.observe(slide);
      return () => observer.disconnect();
    },
    [enabled, root, slide],
  );
  const getSnapshot = () => {
    if (!enabled || !root || !slide) return '1:0:0';
    const slideWidth = slide.offsetWidth;
    const rootWidth = root.clientWidth;
    const perPage = slideWidth > 0 ? Math.max(1, Math.floor(rootWidth / slideWidth)) : 1;
    return `${perPage}:${slideWidth}:${rootWidth}`;
  };
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, () => '1:0:0');
  const [perPage, slideWidth, rootWidth] = snapshot.split(':').map(Number) as [
    number,
    number,
    number,
  ];
  return { perPage, slideWidth, rootWidth };
}

/**
 * The motion a carousel asks for: its own `motion` (`null` none), else none below a provider that
 * turns motion off, else the slide.
 */
function requestedCarouselMotion(
  motion: CarouselMotion | null | undefined,
  preference: MotionPreference,
): CarouselMotion | 'none' {
  if (motion === undefined) return preference === 'none' ? 'none' : 'slide';
  if (motion === null) return 'none';
  return motion === 'fade' ? 'fade' : 'slide';
}

function isRotationControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-carousel-rotation]') !== null;
}

/** The `<img>` slot of a thumbnail: a string is its `src`. */
function thumbnailSlot(thumbnail: Slot<'img'>): Slot<'img'> {
  return typeof thumbnail === 'string' ? { src: thumbnail } : thumbnail;
}

/** The handler an unavailable Previous or Next button's part does not deliver. */
const BLOCK_CLICK = ['onClick'] as const;

/**
 * What every `slotProps` part locks unset before its own attributes: a role and a tab index (the
 * carousel decides both), the marker of a roving container (around the slides it would take them
 * out of their arrow-key order), the rotation control's marker (focus inside a part that carries
 * it would count as focus on the control and keep the rotation running) and the hidden state (the
 * parts hold the slides and controls).
 */
const PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-roving-container': undefined,
  'data-carousel-rotation': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/** What a button part locks: `PART_LOCKS`, its type, and no native `disabled` (it stays focusable). */
const CAROUSEL_BUTTON_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-roving-container': undefined,
  'data-carousel-rotation': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
  type: 'button',
  disabled: undefined,
} as const;

/** What a picker dot locks: `PART_LOCKS`, decorative. */
const INDICATOR_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'data-roving-container': undefined,
  'data-carousel-rotation': undefined,
  hidden: undefined,
  inert: undefined,
  'aria-hidden': true,
} as const;

type PartHandler = (event: { defaultPrevented: boolean }) => void;

/**
 * A part's merged props with the carousel's own work kept: the keys of `style` win over the
 * part's (the track's position, a slide's width and timing), and each handler of `always` runs
 * after the part's handler of its key, whatever that does (bookkeeping that follows the pointer or
 * focus, which a `preventDefault()` must not leave stale; a part value that is no function is
 * skipped).
 */
function keepOwnWork(
  props: Record<string, unknown>,
  part: object,
  style: React.CSSProperties | undefined,
  always: Record<string, unknown> = {},
): Record<string, unknown> {
  if (style) props.style = lockPositionStyle(props.style, style);
  for (const key of Object.keys(always)) {
    props[key] = composeAfterPart(
      (part as Record<string, unknown>)[key],
      always[key] as PartHandler | undefined,
    );
  }
  return props;
}

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

// The Carousel root, documented on the exported `Carousel` const.
const CarouselRoot = ({
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  autoPlay = false,
  autoPlayInterval = 5000,
  autoPlayLabels,
  labels,
  loop = false,
  groupSize = 1,
  align = 'start',
  draggable = false,
  controlsLayout = 'overlay',
  appearance = 'flat',
  motion,
  motionDuration = DEFAULT_MOTION_DURATION,
  slotProps,
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
  const [firstSlideEl, setFirstSlideEl] = React.useState<HTMLElement | null>(null);
  const [trackEl, setTrackEl] = React.useState<HTMLElement | null>(null);
  const [viewportEl, setViewportEl] = React.useState<HTMLElement | null>(null);
  const auto = groupSize === 'auto';
  const measured = useAutoPageSize(auto, viewportEl, firstSlideEl);
  const size = auto ? measured.perPage : Math.max(1, Math.floor(groupSize) || 1);

  // The motion: the carousel's own, else none under a provider that turns motion off, else the
  // slide. A fade needs one slide per page, so pages of several slides slide (warned below).
  const requestedMotion = requestedCarouselMotion(motion, useMotionPreference());
  const fadeFallback = requestedMotion === 'fade' && (auto || size > 1);
  const resolvedMotion = fadeFallback ? 'slide' : requestedMotion;

  React.useEffect(() => {
    if (fadeFallback) {
      warnOnce(
        'Carousel:fade-group',
        'Carousel: `motion="fade"` needs one slide per page; with `groupSize` above 1 or ' +
          '`"auto"` the slides slide.',
      );
    }
  }, [fadeFallback]);

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
  // slides written in a Server Component (lazy client references) count too (C-COMPOUND).
  const items: Array<{ key: string; node: React.ReactNode; thumbnail?: Slot<'img'> }> = [];
  // A `Carousel.Button` of each direction replaces the built-in button; a second one of the same
  // direction is not rendered.
  const customButtons: { previous?: React.ReactElement; next?: React.ReactElement } = {};
  let droppedChildren = false;
  for (const child of flattenChildren(children)) {
    if (isElementOfType<CarouselItemProps>(child.node, CarouselItem)) {
      items.push({ ...child, thumbnail: child.node.props.thumbnail });
    } else if (isElementOfType<{ direction?: 'previous' | 'next' }>(child.node, CarouselButton)) {
      const direction = child.node.props.direction === 'next' ? 'next' : 'previous';
      if (customButtons[direction]) droppedChildren = true;
      else customButtons[direction] = React.cloneElement(child.node, { key: child.key });
    } else if (slotRendersContent(child.node)) droppedChildren = true;
  }
  const hasThumbnails = items.some((item) => item.thumbnail !== undefined);
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
  const index = clampToPage(storedIndex, size, total);
  const pages = pageCount(total, size);
  const lastStart = lastPageStart(total, size);
  const atStart = index <= 0;
  const atEnd = index >= lastStart;
  const prevDisabled = pages <= 1 || (!loop && atStart);
  const nextDisabled = pages <= 1 || (!loop && atEnd);

  // Without loop, rotation ends at the last slide (however it got there) and stays stopped: moving
  // back to an earlier slide does not restart it, only Start does. The end applies to the slide
  // count it happened at: once slides are added or removed, or loop is turned on, it is dropped
  // and rotation continues unless the user stopped it (adjusting state during render, C-HOOKS).
  const ended = endedAt === total && !loop;
  const stopped = (userPaused ?? prefersReducedMotion) || ended;
  const hasRotation = autoPlay && pages > 1;
  if (hasRotation && !loop && atEnd && !stopped) setEndedAt(total);
  else if (endedAt !== null && !ended) setEndedAt(null);
  // A release moves one page towards the drag; past the ends it only loops with `loop`.
  const drag = useCarouselDrag({
    enabled: draggable && pages > 1,
    dir,
    onCommit: (delta) => {
      if (delta === 1) {
        if (!atEnd) goTo(index + size);
        else if (loop) goTo(0);
      } else if (delta === -1) {
        if (!atStart) goTo(index - size);
        else if (loop) goTo(lastStart);
      }
    },
  });
  const pausedByPointer = (hovered && !pointerOnControl) || drag.dragging;
  const pausedByFocus = focusWithin && !startedFromControl;
  const rotating = hasRotation && !stopped && !pausedByPointer && !pausedByFocus;

  // Compares with the shown (clamped) index, so re-picking the visible slide reports nothing.
  const goTo = (target: number) => {
    if (target >= 0 && target < total && target !== index) setActiveIndex(target);
  };
  const goPrev = () => goTo(atStart ? lastStart : index - size);
  const goNext = () => goTo(atEnd ? 0 : index + size);

  // Reads the latest index at tick time (the updater's base), so the interval does not restart on
  // every slide or parent render and consecutive ticks chain even before a re-render.
  const advance = useEventCallback(() => {
    setActiveIndex((prev) => {
      const current = clampToPage(prev, size, total);
      if (current < lastStart) return current + size;
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

  // The slides of the shown page form one arrow-key focus group (groupSize above 1). Only they
  // carry a roving value; the others are inert.
  const grouped = size > 1;
  const pageEnd = Math.min(index + size, total);
  const visibleValues = React.useMemo(
    () => (grouped ? Array.from({ length: pageEnd - index }, (_, k) => String(index + k)) : []),
    [grouped, index, pageEnd],
  );
  const roving = useRovingTabIndex({
    items: visibleValues,
    activeValue: String(index),
    orientation: 'horizontal',
    loop: false,
    dir,
    tabStop: 'last-focused',
  });
  // The roving container's ref only with several slides per page; a part's ref joins after the
  // spread, so an inline ref never detaches the container or the track's state.
  const trackRef = useMergedRefs<HTMLDivElement>(
    grouped ? roving.containerProps.ref : null,
    setTrackEl,
    slotProps?.track?.ref,
  );
  // Which slide of the new page takes focus after an arrow past the end of a page.
  const pendingFocus = React.useRef<'first' | 'last' | null>(null);
  React.useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || !trackEl) return;
    pendingFocus.current = null;
    const target = pending === 'first' ? index : pageEnd - 1;
    trackEl.querySelector<HTMLElement>(`[data-roving-value="${target}"]`)?.focus();
  }, [index, pageEnd, trackEl]);
  // A stable callback: it writes `pendingFocus` and goes through a track part's merge.
  const handleTrackKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const slideIndex = (event.target as HTMLElement).getAttribute('data-roving-value');
    const intent = getArrowIntent(event.key, { orientation: 'horizontal', dir });
    if (
      slideIndex !== null &&
      intent &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const current = Number(slideIndex);
      if (intent === 'next' && current === pageEnd - 1) {
        event.preventDefault();
        if (!nextDisabled) {
          pendingFocus.current = 'first';
          goNext();
        }
        return;
      }
      if (intent === 'prev' && current === index) {
        event.preventDefault();
        if (!prevDisabled) {
          pendingFocus.current = 'last';
          goPrev();
        }
        return;
      }
    }
    roving.containerProps.onKeyDown(event);
  });

  const previousLabel = labels?.previous ?? DEFAULT_PREVIOUS_LABEL;
  const nextLabel = labels?.next ?? DEFAULT_NEXT_LABEL;
  const goPrevious = useEventCallback(() => goPrev());
  const goToNext = useEventCallback(() => goNext());
  // What `Carousel.Button` reads (C-MEMO).
  const context = React.useMemo<CarouselContextValue>(
    () => ({
      trackId,
      previousLabel,
      nextLabel,
      previousDisabled: prevDisabled,
      nextDisabled,
      goPrevious,
      goNext: goToNext,
      controlsLayout,
      dir,
    }),
    [
      trackId,
      previousLabel,
      nextLabel,
      prevDisabled,
      nextDisabled,
      goPrevious,
      goToNext,
      controlsLayout,
      dir,
    ],
  );

  if (total === 0) {
    return (
      <div
        ref={rootRef}
        data-controls-layout={controlsLayout}
        data-appearance={appearance}
        data-motion={resolvedMotion}
        className={cn(carouselClassNames.root, 'relative', className)}
        {...rootHandlers}
        {...rest}
      />
    );
  }

  const sign = dir === 'rtl' ? 1 : -1;
  // A page is as wide as the carousel: the track moves by pages. With `auto` the slides keep their
  // own width and the track moves by whole slides, in pixels, plus the alignment of the page.
  let transform = `translateX(${sign * (index / size) * 100}%)`;
  if (drag.offsetPx !== 0) {
    transform = `translateX(calc(${sign * (index / size) * 100}% + ${drag.offsetPx}px))`;
  }
  if (auto) {
    const leftover = Math.max(0, measured.rootWidth - size * measured.slideWidth);
    const alignShift = align === 'center' ? leftover / 2 : align === 'end' ? leftover : 0;
    const px = sign * index * measured.slideWidth + (dir === 'rtl' ? -alignShift : alignShift);
    transform = `translateX(${px + drag.offsetPx + 0}px)`;
  }
  // The slide moves the track; the fade stacks the slides in the track's one cell and hides the
  // inactive ones by their opacity (they are inert either way), with no transform, so a drag
  // pages on release but the slides do not follow the pointer. The track's transition is off
  // while it follows a drag.
  const fading = resolvedMotion === 'fade';
  const trackMoves = resolvedMotion === 'slide' && !drag.dragging;
  // A `motionDuration` other than the motion classes' own is an inline duration on the element
  // that transitions (D4), written only while that element has its transition: without a
  // property list, an inline duration would time every property.
  const durationStyle =
    motionDuration === DEFAULT_MOTION_DURATION
      ? undefined
      : { transitionDuration: `${motionDuration}ms` };
  // A slide is as wide as its content (`auto`), the viewport (one per page) or its share of it;
  // under the fade it fills the track's one cell, which every slide shares.
  const slideLayout = fading
    ? 'col-start-1 row-start-1'
    : auto
      ? 'w-auto shrink-0'
      : size === 1
        ? 'w-full shrink-0'
        : 'shrink-0';
  const slideWidth = !auto && size > 1 ? { width: `calc(100% / ${size})` } : undefined;
  const slidesLabel = labels?.slides ?? defaultSlidesLabel;
  /** The name of the page that starts at `start`: its slides, or the one slide it holds. */
  const pageLabel = (start: number) => {
    const end = Math.min(start + size, total);
    return end - start === 1 ? slideLabel(start, total) : slidesLabel(start + 1, end, total);
  };
  // The chevrons mirror by the same resolved direction as the track. A CSS `rtl:` variant would
  // also match `[dir=rtl] *`, so an LTR carousel inside an RTL ancestor got mirrored chevrons.
  const chevronClass = dir === 'rtl' ? '-scale-x-100' : undefined;
  const pauseLabel = autoPlayLabels?.pause ?? DEFAULT_PAUSE_LABEL;
  const playLabel = autoPlayLabels?.play ?? DEFAULT_PLAY_LABEL;
  const pickerLabel = labels?.picker ?? DEFAULT_PICKER_LABEL;
  const slideLabel = labels?.slide ?? defaultSlideLabel;
  const carouselRoleDescription =
    labels?.carouselRoleDescription ?? DEFAULT_CAROUSEL_ROLE_DESCRIPTION;
  const slideRoleDescription = labels?.slideRoleDescription ?? DEFAULT_SLIDE_ROLE_DESCRIPTION;

  const inline = controlsLayout === 'inline' || controlsLayout === 'inline-wide';
  const layoutClasses = CAROUSEL_CONTROL_LAYOUT[controlsLayout];
  const rotationPart = slotProps?.autoPlayButton;
  const rotationLabel = stopped ? playLabel : pauseLabel;
  const rotationClassName = cn(
    carouselClassNames.autoPlayButton,
    CAROUSEL_CONTROL_BASE,
    // Above the edge strips of the wide layouts, which would dim and cover it.
    'absolute z-20 h-8 w-8 rounded-full border border-border bg-background shadow-2 top-2',
    // Over the viewport's corner: past the Previous button of an inline layout.
    inline ? 'start-12' : 'start-2',
  );
  // The pointer over the control does not pause (APG): the user is operating it.
  const enterControl = () => setPointerOnControl(true);
  const leaveControl = () => setPointerOnControl(false);
  const pickerClassName = cn(
    carouselClassNames.picker,
    hasThumbnails
      ? 'relative mx-auto flex w-fit flex-wrap justify-center gap-2 p-2'
      : 'absolute inset-x-0 bottom-1 z-10 mx-auto flex w-fit',
  );
  const pickerButtonPart = slotProps?.pickerButton;
  /** The dot of a picker button without a thumbnail, its `slotProps` part merged in when given. */
  const pickerIndicator = (active: boolean) => {
    const className = cn(
      carouselClassNames.pickerIndicator,
      'block h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none',
      active
        ? cn('w-5 bg-primary', forcedColors.selectedLeaf)
        : 'w-2 bg-stroke-accessible group-hover:bg-foreground forced-colors:bg-[ButtonText] forced-colors:forced-color-adjust-none',
    );
    return (
      <span
        aria-hidden="true"
        className={className}
        {...(slotProps?.pickerIndicator &&
          mergeSlotProps(slotProps.pickerIndicator, {
            className,
            locked: INDICATOR_PART_LOCKS,
          }))}
      />
    );
  };
  /** A built-in Previous or Next button, its `slotProps` part merged in when given. */
  const builtInControl = (previous: boolean) => {
    const disabled = previous ? prevDisabled : nextDisabled;
    const label = previous ? previousLabel : nextLabel;
    const part = previous ? slotProps?.previousButton : slotProps?.nextButton;
    const onClick = preventIfDisabled(disabled, previous ? goPrev : goNext);
    const className = cn(
      previous ? carouselClassNames.previousButton : carouselClassNames.nextButton,
      CAROUSEL_CONTROL_BASE,
      previous ? layoutClasses.previous : layoutClasses.next,
    );
    const Chevron = previous ? ChevronLeftIcon : ChevronRightIcon;
    return (
      <button
        key={previous ? 'previous' : 'next'}
        type="button"
        aria-label={label}
        aria-controls={trackId}
        {...focusableDisabledProps(disabled)}
        onClick={onClick}
        className={className}
        {...(part &&
          mergeSlotProps(part, {
            className,
            // An unavailable button calls no click handler of a part, as it calls none of its own.
            blockHandlers: disabled ? BLOCK_CLICK : undefined,
            locked: {
              ...CAROUSEL_BUTTON_LOCKS,
              'aria-label': label,
              'aria-controls': trackId,
              'aria-disabled': undefined,
              'data-disabled': undefined,
              ...focusableDisabledProps(disabled),
              onClick,
            },
          }))}
      >
        <Chevron size={16} className={chevronClass} />
      </button>
    );
  };
  const previousControl = customButtons.previous ?? builtInControl(true);
  const nextControl = customButtons.next ?? builtInControl(false);

  const trackPart = slotProps?.track;
  const slidePart = slotProps?.slide;
  const trackClassName = cn(
    carouselClassNames.track,
    // One column with a zero minimum: the slides keep the viewport's width, whatever their
    // content's longest line.
    fading ? 'grid grid-cols-[minmax(0,1fr)]' : 'flex',
    trackMoves && carouselSlideMotion,
    // Horizontal pointer moves belong to the drag; a vertical swipe still scrolls the page.
    draggable && 'touch-pan-y',
  );
  const trackStyle = fading
    ? undefined
    : { transform, ...(trackMoves ? durationStyle : undefined) };
  const dragging = drag.dragging ? '' : undefined;
  const trackKeyDown = grouped ? handleTrackKeyDown : undefined;
  const slideStyle = fading ? durationStyle : slideWidth;

  const viewport = (
    <div
      ref={setViewportEl}
      className={cn(carouselClassNames.viewport, 'relative min-w-0 flex-1 overflow-hidden')}
    >
      <div
        id={trackId}
        className={trackClassName}
        style={trackStyle}
        data-dragging={dragging}
        {...drag.handlers}
        {...(grouped ? roving.containerProps : null)}
        onKeyDown={trackKeyDown}
        {...(trackPart &&
          keepOwnWork(
            mergeSlotProps(trackPart, {
              className: trackClassName,
              locked: {
                ...PART_LOCKS,
                id: trackId,
                'data-dragging': dragging,
                'data-roving-container': grouped ? '' : undefined,
                onPointerDown: drag.handlers.onPointerDown,
                onPointerMove: drag.handlers.onPointerMove,
                onKeyDown: trackKeyDown,
                onKeyDownCapture: grouped ? roving.containerProps.onKeyDownCapture : undefined,
              },
            }),
            trackPart,
            trackStyle,
            // The end of a drag, the click it swallows and the slides' focus record.
            {
              onPointerUp: drag.handlers.onPointerUp,
              onPointerCancel: drag.handlers.onPointerCancel,
              onClickCapture: drag.handlers.onClickCapture,
              onFocus: grouped ? roving.containerProps.onFocus : undefined,
            },
          ))}
        ref={trackRef}
      >
        {items.map(({ key, node }, i) => {
          const active = i >= index && i < index + size;
          const ref = i === 0 ? setFirstSlideEl : undefined;
          const label = slideLabel(i, total);
          const rovingValue = grouped && active ? String(i) : undefined;
          const tabIndex = grouped && active ? roving.getTabIndex(String(i)) : undefined;
          const className = cn(
            carouselClassNames.slide,
            slideLayout,
            fading && carouselFadeMotion,
            fading && !active && 'opacity-0',
            grouped &&
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          );
          return (
            <div
              key={key}
              ref={ref}
              role="group"
              aria-roledescription={slideRoleDescription}
              aria-label={label}
              aria-hidden={active ? undefined : true}
              inert={!active}
              data-roving-value={rovingValue}
              tabIndex={tabIndex}
              className={className}
              style={slideStyle}
              {...(slidePart &&
                keepOwnWork(
                  mergeSlotProps(slidePart, {
                    className,
                    ref,
                    locked: {
                      ...PART_LOCKS,
                      role: 'group',
                      'aria-roledescription': slideRoleDescription,
                      'aria-label': label,
                      'aria-hidden': active ? undefined : true,
                      inert: !active,
                      'data-roving-value': rovingValue,
                      tabIndex,
                      // The roving group would skip a slide that carries either.
                      'aria-disabled': undefined,
                      'data-roving-disabled': undefined,
                    },
                  }),
                  slidePart,
                  slideStyle,
                ))}
            >
              {node}
            </div>
          );
        })}
      </div>
      {/* Overlaid on the slides, after them in the tab order, like before the layouts. */}
      {!inline && previousControl}
      {!inline && nextControl}
    </div>
  );

  return (
    <CarouselContext.Provider value={context}>
      <div
        ref={rootRef}
        role="region"
        aria-roledescription={carouselRoleDescription}
        aria-label="Carousel"
        data-controls-layout={controlsLayout}
        data-appearance={appearance}
        data-motion={resolvedMotion}
        // A stacking context of its own: the controls' z-index cannot lift them over page headers.
        className={cn(
          carouselClassNames.root,
          'relative isolate overflow-hidden',
          appearance === 'elevated' && 'rounded-md shadow-4',
          className,
        )}
        {...rootHandlers}
        {...rest}
      >
        {hasRotation && (
          <button
            type="button"
            data-carousel-rotation=""
            aria-label={rotationLabel}
            aria-controls={trackId}
            onClick={toggleRotation}
            onMouseEnter={enterControl}
            onMouseLeave={leaveControl}
            className={rotationClassName}
            {...(rotationPart &&
              keepOwnWork(
                mergeSlotProps(rotationPart, {
                  className: rotationClassName,
                  locked: {
                    ...CAROUSEL_BUTTON_LOCKS,
                    'data-carousel-rotation': '',
                    'aria-label': rotationLabel,
                    'aria-controls': trackId,
                    'aria-pressed': undefined,
                    onClick: toggleRotation,
                  },
                }),
                rotationPart,
                undefined,
                { onMouseEnter: enterControl, onMouseLeave: leaveControl },
              ))}
          >
            {stopped ? <PlayGlyph /> : <PauseGlyph />}
          </button>
        )}
        {inline ? (
          <div className="flex items-stretch">
            {previousControl}
            {viewport}
            {nextControl}
          </div>
        ) : (
          viewport
        )}
        {/* Announces the current slide, except while slides rotate on their own. */}
        <div aria-live={rotating ? 'off' : 'polite'} aria-atomic="true" className="sr-only">
          {pageLabel(index)}
        </div>
        <div
          role="group"
          aria-label={pickerLabel}
          className={pickerClassName}
          {...(slotProps?.picker &&
            mergeSlotProps(slotProps.picker, {
              className: pickerClassName,
              locked: { ...PART_LOCKS, role: 'group', 'aria-label': pickerLabel },
            }))}
        >
          {items
            .filter((_, i) => i % size === 0)
            .map(({ key, thumbnail }, page) => {
              const start = page * size;
              const active = start === index;
              const label = pageLabel(start);
              const current = active ? 'true' : undefined;
              const onClick = () => goTo(start);
              const className = cn(
                carouselClassNames.pickerButton,
                'group inline-flex items-center justify-center',
                thumbnail !== undefined ? 'rounded-md p-0.5' : 'h-6 min-w-6',
                focusRing,
              );
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  aria-current={current}
                  onClick={onClick}
                  className={className}
                  {...(pickerButtonPart &&
                    mergeSlotProps(pickerButtonPart, {
                      className,
                      locked: {
                        ...CAROUSEL_BUTTON_LOCKS,
                        'aria-label': label,
                        'aria-current': current,
                        onClick,
                      },
                    }))}
                >
                  {thumbnail !== undefined
                    ? renderSlot(
                        thumbnailSlot(thumbnail),
                        'img',
                        cn(
                          carouselItemClassNames.thumbnail,
                          'block h-12 w-16 rounded object-cover',
                          active
                            ? cn('outline-2 outline-primary', forcedColors.selectedContainer)
                            : 'opacity-70 group-hover:opacity-100',
                        ),
                        { alt: '', draggable: false },
                      )
                    : pickerIndicator(active)}
                </button>
              );
            })}
        </div>
      </div>
    </CarouselContext.Provider>
  );
};
CarouselRoot.displayName = 'Carousel';

/**
 * One slide of a {@link Carousel}. Write it in the Carousel, directly or in a Fragment: a component
 * that renders `Carousel.Item` itself is not recognised as a slide (put that component inside the
 * `Carousel.Item` instead).
 */
export const CarouselItem = ({
  thumbnail: _thumbnail,
  className,
  children,
  ref,
  ...rest
}: CarouselItemProps) => {
  return (
    <div ref={ref} className={cn(carouselItemClassNames.root, 'p-4', className)} {...rest}>
      {children}
    </div>
  );
};
CarouselItem.displayName = 'CarouselItem';

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
 *   The built-in names and role descriptions are English: `labels` and `autoPlayLabels`
 *   translate them.
 * - The controls are layered over the slides inside the carousel's own stacking context, so they
 *   never paint over page headers that stay in view while the page scrolls.
 *
 * - `groupSize` shows several slides per page, `draggable` lets the pointer drag them, and a
 *   `thumbnail` on a `Carousel.Item` turns the picker into a row of thumbnails.
 * - `controlsLayout` places the Previous and Next buttons over the slides (`overlay`,
 *   `overlay-wide`) or beside them (`inline`, `inline-wide`); `Carousel.Button` replaces the
 *   built-in button of its `direction` with one of your own glyph.
 * - The slides glide to the new page over 300 ms; `motion="fade"` cross-fades them instead (one
 *   slide per page), `motion={null}` turns the motion off and `motionDuration` times it. Under
 *   reduced motion, or below a `WaveProvider` with `motion="none"` (unless `motion` is set), the
 *   page changes at once.
 *
 * Compound access (`Carousel.Item`, `Carousel.Button`) needs a client module; React Server
 * Components import the flat names `CarouselItem` and `CarouselButton` instead.
 */
export const Carousel = /* @__PURE__ */ Object.assign(CarouselRoot, {
  Item: CarouselItem,
  Button: CarouselButton,
});
