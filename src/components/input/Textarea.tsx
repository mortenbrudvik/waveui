import * as React from 'react';
import { cn } from '../../lib/cn';

/** Properties for the Textarea component. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Validation error message; sets `aria-invalid` when provided. */
  error?: string;
}

export const Textarea = ({ error, className, ref, ...props }: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'min-h-[80px] w-full resize-y rounded border border-input bg-background px-3 py-2 text-sm text-foreground',
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
  };

Textarea.displayName = 'Textarea';
