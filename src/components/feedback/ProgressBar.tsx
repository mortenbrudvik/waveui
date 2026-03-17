import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the ProgressBar component. */
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current progress value. Omit for indeterminate mode. */
  value?: number;
  /** Maximum progress value.
   * @default 100
   */
  max?: number;
  /** Accessible label for the progress bar. */
  label?: string;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, max = 100, label, className, ...rest }, ref) => {
    const isIndeterminate = value === undefined;
    const percentage = isIndeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        {...rest}
        className={cn('h-2 rounded-full bg-[#e0e0e0] overflow-hidden', className)}
      >
        <div
          className={cn(
            'h-full bg-primary rounded-full',
            isIndeterminate && 'w-[40%] animate-[wave-indeterminate_1.5s_ease-in-out_infinite]',
          )}
          style={isIndeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    );
  },
);

ProgressBar.displayName = 'ProgressBar';
