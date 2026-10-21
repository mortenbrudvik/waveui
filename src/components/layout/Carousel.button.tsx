import * as React from 'react';
import { carouselButtonClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { useCarouselContext } from './Carousel.context';
import { CAROUSEL_CONTROL_BASE, CAROUSEL_CONTROL_LAYOUT } from './Carousel.styles';

/** Properties for the CarouselButton sub-component. */
export interface CarouselButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Which way the button moves the carousel. */
  direction: 'previous' | 'next';
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * A Previous or Next button written in a {@link Carousel}, for a glyph or look of your own.
 * Write it as a direct child of the Carousel: it replaces the built-in button of its
 * `direction`, takes its place in the layout and is named, disabled and wired to the slides the
 * same way (`labels.previous`/`labels.next`, `aria-controls`, `aria-disabled` at the ends
 * without `loop`, which keeps it focusable). Its children replace the chevron, which mirrors in
 * right-to-left layouts; `aria-label` replaces the name.
 */
export const CarouselButton = ({
  direction,
  onClick,
  className,
  children,
  ref,
  ...rest
}: CarouselButtonProps) => {
  const carousel = useCarouselContext('Carousel.Button');
  const previous = direction === 'previous';
  const disabled = previous ? carousel.previousDisabled : carousel.nextDisabled;
  const go = previous ? carousel.goPrevious : carousel.goNext;
  const mirror = carousel.dir === 'rtl' ? '-scale-x-100' : undefined;
  return (
    <button
      type="button"
      aria-label={previous ? carousel.previousLabel : carousel.nextLabel}
      aria-controls={carousel.trackId}
      data-direction={direction}
      {...rest}
      {...focusableDisabledProps(disabled)}
      ref={ref}
      onClick={preventIfDisabled(disabled, composeEventHandlers(onClick, go))}
      className={cn(
        carouselButtonClassNames.root,
        CAROUSEL_CONTROL_BASE,
        CAROUSEL_CONTROL_LAYOUT[carousel.controlsLayout][direction],
        className,
      )}
    >
      {children ??
        (previous ? (
          <ChevronLeftIcon size={16} className={mirror} />
        ) : (
          <ChevronRightIcon size={16} className={mirror} />
        ))}
    </button>
  );
};
CarouselButton.displayName = 'CarouselButton';
