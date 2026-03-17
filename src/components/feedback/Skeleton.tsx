import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Skeleton component. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the skeleton placeholder. */
  width?: string | number;
  /** Height of the skeleton placeholder. */
  height?: string | number;
  /** Shape variant of the skeleton.
   * @default 'text'
   */
  variant?: 'text' | 'circular' | 'rectangular';
}

const variantClasses: Record<string, string> = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded',
};

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ width, height, variant = 'text', className, style, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        {...rest}
        className={cn(
          'bg-[#e0e0e0] animate-[wave-pulse_1.5s_ease-in-out_infinite]',
          variantClasses[variant],
          className,
        )}
        style={{ width, height, ...style }}
        aria-hidden="true"
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
