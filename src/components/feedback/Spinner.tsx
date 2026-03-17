import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size } from '../../lib/types';

/** Properties for the Spinner component. */
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Size of the spinner.
   * @default 'medium'
   */
  size?: Size;
  /** Accessible label describing the loading state. */
  label?: string;
  /** Whether the label text is visually displayed alongside the spinner. */
  labelVisible?: boolean;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'w-3 h-3',
  small: 'w-4 h-4',
  medium: 'w-6 h-6',
  large: 'w-9 h-9',
  'extra-large': 'w-12 h-12',
};

export const Spinner = ({ size = 'medium', label, labelVisible, className, ref, ...rest }: SpinnerProps & { ref?: React.Ref<HTMLSpanElement> }) => {
  const spinner = (
    <span
      className={cn(
        'border-2 border-[#e0e0e0] border-t-primary rounded-full animate-[wave-spin_0.8s_linear_infinite]',
        sizeClasses[size],
      )}
    />
  );

  if (labelVisible && label) {
    return (
      <span
        ref={ref}
        {...rest}
        className={cn('inline-flex items-center gap-2', className)}
        role="status"
      >
        {spinner}
        <span className="text-body-1 text-muted-foreground">{label}</span>
      </span>
    );
  }

  return (
    <span
      ref={ref}
      {...rest}
      className={cn('inline-flex items-center gap-2', className)}
      role="status"
    >
      {spinner}
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
};

Spinner.displayName = 'Spinner';
