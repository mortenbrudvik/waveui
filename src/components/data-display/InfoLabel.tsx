import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the InfoLabel component. */
export interface InfoLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Primary label text to display. */
  label: string;
  /** Informational tooltip text shown via the info icon. */
  info: string;
}

export const InfoLabel = React.forwardRef<HTMLSpanElement, InfoLabelProps>(
  ({ label, info, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('inline-flex items-center gap-1 text-body-1', className)}
        {...props}
      >
        {label}
        <span
          className="text-muted-foreground cursor-help"
          title={info}
          tabIndex={0}
          aria-label={info}
          role="img"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
            <text
              x="8"
              y="12"
              textAnchor="middle"
              fill="currentColor"
              fontSize="10"
              fontWeight="600"
            >
              i
            </text>
          </svg>
        </span>
      </span>
    );
  },
);

InfoLabel.displayName = 'InfoLabel';
