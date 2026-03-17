import * as React from 'react';
import { cn } from '../../lib/cn';
import { renderSlot } from '../../lib/slot';
import type { Slot } from '../../lib/types';

/** Properties for the Input component. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Validation error message; sets `aria-invalid` when provided. */
  error?: string;
  /** Slot rendered before the input text (e.g., an icon). */
  contentBefore?: Slot<'span'>;
  /** Slot rendered after the input text (e.g., a suffix). */
  contentAfter?: Slot<'span'>;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, contentBefore, contentAfter, className, ...props }, ref) => {
    if (contentBefore != null || contentAfter != null) {
      return (
        <span
          className={cn(
            'inline-flex items-center h-8 w-full rounded border border-input bg-background text-sm text-foreground',
            'focus-within:border-b-2 focus-within:border-b-primary',
            error && 'border-destructive focus-within:border-b-destructive',
            props.disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          {contentBefore != null && renderSlot(contentBefore, 'span', 'shrink-0 pl-2')}
          <input
            ref={ref}
            className={cn(
              'h-full w-full bg-transparent px-2 text-sm text-foreground',
              'placeholder:text-[#707070]',
              'focus:outline-none',
              'disabled:cursor-not-allowed',
            )}
            aria-invalid={error ? true : undefined}
            {...props}
          />
          {contentAfter != null && renderSlot(contentAfter, 'span', 'shrink-0 pr-2')}
        </span>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded border border-input bg-background px-3 text-sm text-foreground',
          'placeholder:text-[#707070]',
          'focus:outline-none focus:border-b-2 focus:border-b-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-destructive focus:border-b-destructive',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
