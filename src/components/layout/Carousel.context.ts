import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';

/** Where a Carousel puts its Previous and Next buttons. */
export type CarouselControlsLayout = 'overlay' | 'inline' | 'overlay-wide' | 'inline-wide';

/** What `Carousel.Button` reads from the Carousel it is written in. */
export interface CarouselContextValue {
  /** The id of the track the buttons control. */
  trackId: string;
  /** The built-in accessible names, from `labels` or their English defaults. */
  previousLabel: string;
  nextLabel: string;
  /** Whether the button is at the end of the slides without `loop` (kept focusable, `aria-disabled`). */
  previousDisabled: boolean;
  nextDisabled: boolean;
  goPrevious: () => void;
  goNext: () => void;
  controlsLayout: CarouselControlsLayout;
  /** The resolved direction, for mirroring the chevrons. */
  dir: 'ltr' | 'rtl';
}

export const CarouselContext = React.createContext<CarouselContextValue | null>(null);
CarouselContext.displayName = 'CarouselContext';

const noop = () => {};

/** The value outside a Carousel in production, where the missing context is logged once. */
const INERT_CONTEXT: CarouselContextValue = {
  trackId: '',
  previousLabel: '',
  nextLabel: '',
  previousDisabled: true,
  nextDisabled: true,
  goPrevious: noop,
  goNext: noop,
  controlsLayout: 'overlay',
  dir: 'ltr',
};

/** The Carousel context of a part: throws in development, logs once in production, outside one. */
export function useCarouselContext(component: string): CarouselContextValue {
  const context = React.useContext(CarouselContext);
  if (context) return context;
  reportMissingContext(component, 'Carousel');
  return INERT_CONTEXT;
}
