import { disabledStyles, focusRing } from '../../lib/styles';
import type { CarouselControlsLayout } from './Carousel.context';

/**
 * What every Previous/Next button shares, the built-in ones and `Carousel.Button`: the stacking
 * above the slides, the colour, the gated hover and pressed states, the focus ring and the
 * disabled look.
 */
export const CAROUSEL_CONTROL_BASE = [
  'z-10 inline-flex items-center justify-center text-foreground',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  focusRing,
  disabledStyles,
].join(' ');

const ROUND = 'h-8 w-8 rounded-full border border-border bg-background shadow-2';
const WIDE = 'w-10 rounded-none bg-background/70';

/**
 * Position and shape per layout and direction: round buttons floating over the slides, full-height
 * strips at the edges, or the same two in a row with the slides (inline layouts).
 */
export const CAROUSEL_CONTROL_LAYOUT: Record<
  CarouselControlsLayout,
  Record<'previous' | 'next', string>
> = {
  overlay: {
    previous: `absolute top-1/2 start-2 -translate-y-1/2 ${ROUND}`,
    next: `absolute top-1/2 end-2 -translate-y-1/2 ${ROUND}`,
  },
  'overlay-wide': {
    previous: `absolute inset-y-0 start-0 ${WIDE}`,
    next: `absolute inset-y-0 end-0 ${WIDE}`,
  },
  inline: {
    previous: `relative mx-1 shrink-0 self-center ${ROUND}`,
    next: `relative mx-1 shrink-0 self-center ${ROUND}`,
  },
  'inline-wide': {
    previous: `relative shrink-0 self-stretch ${WIDE}`,
    next: `relative shrink-0 self-stretch ${WIDE}`,
  },
};
