import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PresenceStatus, Size } from '../../lib/types';

/** Properties for the PresenceBadge component. */
export interface PresenceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Presence status to display. */
  status: PresenceStatus;
  /** Size of the presence indicator.
   * @default 'medium'
   */
  size?: Size;
}

const statusColors: Record<PresenceStatus, string> = {
  available: 'bg-success',
  busy: 'bg-destructive',
  away: 'bg-warning',
  offline: 'bg-[var(--grey-60)]',
  dnd: 'bg-destructive',
  oof: 'bg-severe',
};

const statusLabels: Record<PresenceStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  away: 'Away',
  offline: 'Offline',
  dnd: 'Do not disturb',
  oof: 'Out of office',
};

const sizeClasses: Record<Size, string> = {
  'extra-small': 'w-1.5 h-1.5',
  small: 'w-2 h-2',
  medium: 'w-2.5 h-2.5',
  large: 'w-3 h-3',
  'extra-large': 'w-3.5 h-3.5',
};

export const PresenceBadge = ({ status, size = 'medium', className, ref, ...props }: PresenceBadgeProps & { ref?: React.Ref<HTMLSpanElement> }) => {
    return (
      <span
        ref={ref}
        className={cn(
          'rounded-full inline-block',
          sizeClasses[size],
          statusColors[status],
          className,
        )}
        role="status"
        aria-label={statusLabels[status]}
        {...props}
      />
    );
  };

PresenceBadge.displayName = 'PresenceBadge';
