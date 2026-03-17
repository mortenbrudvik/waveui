import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the CounterBadge component. */
export interface CounterBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Numeric count to display. Hidden when count is 0 or less. */
  count: number;
  /** Maximum count before displaying overflow indicator (e.g. "99+").
   * @default 99
   */
  overflowCount?: number;
  /** Visual style of the counter badge.
   * @default 'filled'
   */
  appearance?: 'filled' | 'outline';
}

export const CounterBadge = React.forwardRef<HTMLSpanElement, CounterBadgeProps>(
  ({ count, overflowCount = 99, appearance = 'filled', className, ...props }, ref) => {
    if (count <= 0) return null;

    const display = count > overflowCount ? `${overflowCount}+` : String(count);

    return (
      <span
        ref={ref}
        className={cn(
          'min-w-5 h-5 rounded-full text-caption-1 font-semibold inline-flex items-center justify-center px-1.5',
          appearance === 'filled'
            ? 'bg-primary text-white'
            : 'bg-transparent border border-primary text-primary',
          className,
        )}
        {...props}
      >
        {display}
      </span>
    );
  },
);

CounterBadge.displayName = 'CounterBadge';
