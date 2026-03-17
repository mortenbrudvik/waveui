import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size } from '../../lib/types';

/** Properties for the AvatarGroup component. */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum number of avatars to display before showing an overflow indicator. */
  max?: number;
  /** Size of the overflow indicator badge.
   * @default 'medium'
   */
  size?: Size;
}

const overflowSizeMap: Record<Size, string> = {
  'extra-small': 'w-6 h-6 text-[10px]',
  small: 'w-8 h-8 text-xs',
  medium: 'w-10 h-10 text-sm',
  large: 'w-12 h-12 text-base',
  'extra-large': 'w-14 h-14 text-lg',
};

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max, size = 'medium', className, children, ...props }, ref) => {
    const items = React.Children.toArray(children);
    const visible = max && items.length > max ? items.slice(0, max) : items;
    const overflow = max && items.length > max ? items.length - max : 0;

    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center', className)}
        {...props}
      >
        {visible.map((child, i) => (
          <span
            key={i}
            className={cn(i > 0 && '-ml-2', 'ring-2 ring-white rounded-full')}
          >
            {child}
          </span>
        ))}
        {overflow > 0 && (
          <span className={cn(
            '-ml-2 ring-2 ring-white rounded-full inline-flex items-center justify-center bg-muted text-muted-foreground font-semibold',
            overflowSizeMap[size],
          )}>
            +{overflow}
          </span>
        )}
      </div>
    );
  },
);

AvatarGroup.displayName = 'AvatarGroup';
