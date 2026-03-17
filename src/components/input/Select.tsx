import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Select component. */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Validation error message; sets `aria-invalid` when provided. */
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-8 w-full appearance-none rounded border border-input bg-background px-3 pr-8 text-sm text-foreground',
          'bg-[length:16px_16px] bg-[position:right_8px_center] bg-no-repeat',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23707070' d='M3.5 5.5l4.5 5 4.5-5z'/%3E%3C/svg%3E\")]",
          'focus:outline-none focus:border-b-2 focus:border-b-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-destructive focus:border-b-destructive',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = 'Select';
