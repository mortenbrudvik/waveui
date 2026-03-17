import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

interface CarouselContextValue {
  activeIndex: number;
  total: number;
  goTo: (index: number) => void;
  prev: () => void;
  next: () => void;
}

const CarouselContext = React.createContext<CarouselContextValue>({
  activeIndex: 0,
  total: 0,
  goTo: () => {},
  prev: () => {},
  next: () => {},
});

/** Properties for the Carousel component. */
export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled index of the currently active slide. */
  value?: number;
  /** Default active slide index for uncontrolled usage.
   * @default 0
   */
  defaultValue?: number;
  /** Callback invoked when the active slide changes. */
  onValueChange?: (index: number) => void;
  /** Whether the carousel auto-advances slides.
   * @default false
   */
  autoPlay?: boolean;
  /** Interval in milliseconds between auto-play transitions.
   * @default 5000
   */
  autoPlayInterval?: number;
  /** Whether the carousel loops back to the first slide after the last.
   * @default false
   */
  loop?: boolean;
}

/** Properties for the CarouselItem sub-component. */
export type CarouselItemProps = React.HTMLAttributes<HTMLDivElement>;

const CarouselRoot = ({
  value: controlledValue,
  defaultValue = 0,
  onValueChange,
  autoPlay = false,
  autoPlayInterval = 5000,
  loop = false,
  className,
  children,
  ref,
  ...rest
}: CarouselProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [activeIndex, setActiveIndex] = useControllable(
      controlledValue,
      defaultValue,
      onValueChange,
    );

    const items = React.Children.toArray(children).filter(
      (child) => React.isValidElement(child) && child.type === CarouselItem,
    );
    const total = items.length;

    const prev = React.useCallback(() => {
      setActiveIndex(activeIndex <= 0 ? (loop ? total - 1 : 0) : activeIndex - 1);
    }, [activeIndex, loop, total, setActiveIndex]);

    const next = React.useCallback(() => {
      setActiveIndex(activeIndex >= total - 1 ? (loop ? 0 : total - 1) : activeIndex + 1);
    }, [activeIndex, loop, total, setActiveIndex]);

    const goTo = React.useCallback(
      (index: number) => {
        if (index >= 0 && index < total) {
          setActiveIndex(index);
        }
      },
      [total, setActiveIndex],
    );

    React.useEffect(() => {
      if (!autoPlay || total <= 1) return;
      const id = setInterval(() => {
        setActiveIndex(activeIndex >= total - 1 ? (loop ? 0 : activeIndex) : activeIndex + 1);
      }, autoPlayInterval);
      return () => clearInterval(id);
    }, [autoPlay, autoPlayInterval, loop, total, activeIndex, setActiveIndex]);

    if (total === 0) {
      return <div ref={ref} className={cn('relative', className)} {...rest} />;
    }

    return (
      <CarouselContext.Provider value={{ activeIndex, total, goTo, prev, next }}>
        <div
          ref={ref}
          role="region"
          aria-roledescription="carousel"
          aria-label="Carousel"
          className={cn('relative overflow-hidden', className)}
          {...rest}
        >
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {items.map((child, i) => (
              <div
                key={i}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${i + 1} of ${total}`}
                className="w-full flex-shrink-0"
              >
                {child}
              </div>
            ))}
          </div>
          {/* Live region for screen readers */}
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {`Slide ${activeIndex + 1} of ${total}`}
          </div>
          {/* Navigation buttons */}
          <button
            type="button"
            aria-label="Previous slide"
            onClick={prev}
            disabled={!loop && activeIndex === 0}
            className={cn(
              'absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border shadow-2 flex items-center justify-center',
              'hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 12L6 8l4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={next}
            disabled={!loop && activeIndex === total - 1}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border shadow-2 flex items-center justify-center',
              'hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {/* Dot indicators */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5" role="tablist">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-label={`Go to slide ${i + 1}`}
                aria-selected={i === activeIndex}
                onClick={() => goTo(i)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === activeIndex ? 'bg-primary' : 'bg-[#e0e0e0] hover:bg-[#c0c0c0]',
                )}
              />
            ))}
          </div>
        </div>
      </CarouselContext.Provider>
    );
};
CarouselRoot.displayName = 'Carousel';

const CarouselItem = ({ className, children, ref, ...rest }: CarouselItemProps & { ref?: React.Ref<HTMLDivElement> }) => {
    return (
      <div ref={ref} className={cn('p-4', className)} {...rest}>
        {children}
      </div>
    );
  };
CarouselItem.displayName = 'CarouselItem';

export const Carousel = Object.assign(CarouselRoot, {
  Item: CarouselItem,
});
