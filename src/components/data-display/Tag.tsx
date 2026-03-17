import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';

/** Properties for the Tag component. */
export interface TagProps extends React.HTMLAttributes<HTMLElement> {
  /** Element type to render as.
   * @default 'span'
   */
  as?: React.ElementType;
  /** Whether the tag can be dismissed by the user. */
  dismissible?: boolean;
  /** Callback invoked when the dismiss button is clicked. */
  onDismiss?: () => void;
  /** Slot for a custom dismiss icon element. */
  dismissIcon?: Slot<'span'>;
}

export const Tag = React.forwardRef<HTMLElement, TagProps>(
  (
    { as: Component = 'span', dismissible, onDismiss, dismissIcon, className, children, ...props },
    ref,
  ) => {
    const defaultDismissButton = (
      <button
        type="button"
        onClick={onDismiss}
        className="relative w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-[#e0e0e0] text-foreground"
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );

    return (
      <Component
        ref={ref}
        className={cn(
          'bg-[#f0f0f0] rounded-full pl-3 py-1 text-body-1 inline-flex items-center gap-1',
          dismissible ? 'pr-1.5' : 'pr-3',
          className,
        )}
        {...props}
      >
        {children}
        {dismissible && (dismissIcon ? renderSlot(dismissIcon, 'span') : defaultDismissButton)}
      </Component>
    );
  },
);

Tag.displayName = 'Tag';
