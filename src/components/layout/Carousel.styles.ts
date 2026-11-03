import { disabledStyles, focusRing } from '../../lib/styles';
import type { CarouselControlsLayout } from './Carousel.context';

/**
 * What every Previous/Next button shares, the built-in ones and `Carousel.Button`: the stacking
 * above the slides, the colour, the gated hover and pressed states, the focus ring and the
 * disabled look.
 */
export const CAROUSEL_CONTROL_BASE = [
  'wave:z-10 wave:inline-flex wave:items-center wave:justify-center wave:text-foreground',
  'wave:not-disabled:not-aria-disabled:hover:bg-subtle-hover wave:not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  focusRing,
  disabledStyles,
].join(' ');

const ROUND =
  'wave:h-8 wave:w-8 wave:rounded-full wave:border wave:border-border wave:bg-background wave:shadow-2';
const WIDE = 'wave:w-10 wave:rounded-none wave:bg-background/70';

/**
 * Position and shape per layout and direction: round buttons floating over the slides, full-height
 * strips at the edges, or the same two in a row with the slides (inline layouts).
 */
export const CAROUSEL_CONTROL_LAYOUT: Record<
  CarouselControlsLayout,
  Record<'previous' | 'next', string>
> = {
  overlay: {
    previous: `wave:absolute wave:top-1/2 wave:start-2 wave:-translate-y-1/2 ${ROUND}`,
    next: `wave:absolute wave:top-1/2 wave:end-2 wave:-translate-y-1/2 ${ROUND}`,
  },
  'overlay-wide': {
    previous: `wave:absolute wave:inset-y-0 wave:start-0 ${WIDE}`,
    next: `wave:absolute wave:inset-y-0 wave:end-0 ${WIDE}`,
  },
  inline: {
    previous: `wave:relative wave:mx-1 wave:shrink-0 wave:self-center ${ROUND}`,
    next: `wave:relative wave:mx-1 wave:shrink-0 wave:self-center ${ROUND}`,
  },
  'inline-wide': {
    previous: `wave:relative wave:shrink-0 wave:self-stretch ${WIDE}`,
    next: `wave:relative wave:shrink-0 wave:self-stretch ${WIDE}`,
  },
};
