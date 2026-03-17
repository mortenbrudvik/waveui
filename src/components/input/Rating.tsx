import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import type { Size } from '../../lib/types';

/** Properties for the Rating component. */
export interface RatingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled rating value. */
  value?: number;
  /** Initial rating for uncontrolled usage.
   * @default 0
   */
  defaultValue?: number;
  /** Callback fired when the rating changes. */
  onChange?: (value: number) => void;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /** Size of the star icons.
   * @default 'medium'
   */
  size?: Size;
  /** Whether the rating is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
}

/** Properties for the RatingDisplay (read-only) component. */
export interface RatingDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rating value to display. */
  value: number;
  /** Maximum number of stars.
   * @default 5
   */
  max?: number;
  /** Size of the star icons.
   * @default 'medium'
   */
  size?: Size;
}

const sizeMap: Record<Size, string> = {
  'extra-small': 'h-3 w-3',
  small: 'h-4 w-4',
  medium: 'h-5 w-5',
  large: 'h-6 w-6',
  'extra-large': 'h-8 w-8',
};

function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
    >
      <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 13.88l-4.94 2.82.94-5.49-4-3.9 5.53-.8L10 1.5z" />
    </svg>
  );
}

export const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onChange,
      max = 5,
      size = 'medium',
      disabled = false,
      className,
      ...rest
    },
    ref,
  ) => {
    const [value, setValue] = useControllable(valueProp, defaultValue ?? 0, onChange);
    const [hovered, setHovered] = React.useState(0);

    const displayValue = hovered || value;
    const starSize = sizeMap[size];

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setValue(Math.min(value + 1, max));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setValue(Math.max(value - 1, 0));
      }
    };

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Rating"
        className={cn(
          'inline-flex items-center gap-0.5',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0f6cbd] rounded',
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        {...rest}
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={value === starValue}
              aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
              className={cn(
                'inline-flex cursor-pointer bg-transparent border-0 p-0.5 transition-colors',
                displayValue >= starValue ? 'text-[#f7b538]' : 'text-[#c4c4c4]',
              )}
              tabIndex={-1}
              onClick={() => !disabled && setValue(starValue)}
              onMouseEnter={() => !disabled && setHovered(starValue)}
              onMouseLeave={() => !disabled && setHovered(0)}
              disabled={disabled}
            >
              <StarIcon filled={displayValue >= starValue} className={starSize} />
            </button>
          );
        })}
      </div>
    );
  },
);
Rating.displayName = 'Rating';

export const RatingDisplay = React.forwardRef<HTMLDivElement, RatingDisplayProps>(
  ({ value, max = 5, size = 'medium', className, ...rest }, ref) => {
    const starSize = sizeMap[size];

    return (
      <div
        ref={ref}
        role="img"
        aria-label={`Rating: ${value} out of ${max}`}
        className={cn('inline-flex items-center gap-0.5', className)}
        {...rest}
      >
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={cn('inline-flex', value >= i + 1 ? 'text-[#f7b538]' : 'text-[#c4c4c4]')}
          >
            <StarIcon filled={value >= i + 1} className={starSize} />
          </span>
        ))}
      </div>
    );
  },
);
RatingDisplay.displayName = 'RatingDisplay';
