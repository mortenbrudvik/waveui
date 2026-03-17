import * as React from 'react';
import { cn } from '../../lib/cn';
import { useId } from '../../hooks/useId';

interface InjectedFieldProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

/** Properties for the Field component. */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label text displayed above the field. */
  label?: string;
  /** Hint text displayed below the field when no error is present. */
  hint?: string;
  /** Error message displayed below the field; sets `aria-invalid` on the child. */
  error?: string;
  /** Whether the field is required; shows a red asterisk next to the label. */
  required?: boolean;
  /** Explicit `for` attribute linking the label to a child input. */
  htmlFor?: string;
}

export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ label, hint, error, required, htmlFor, className, children, ...rest }, ref) => {
    const fieldId = useId('field');
    const id = htmlFor ?? fieldId;
    const errorId = error ? `${id}-error` : undefined;
    const hintId = hint ? `${id}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div ref={ref} className={cn('flex flex-col', className)} {...rest}>
        {label && (
          <label htmlFor={id} className="mb-1 text-sm font-semibold text-foreground">
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </label>
        )}
        {React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child as React.ReactElement<InjectedFieldProps>, {
                id,
                'aria-describedby': describedBy,
                'aria-invalid': error ? true : undefined,
                'aria-required': required ? true : undefined,
              })
            : child,
        )}
        {error ? (
          <p id={errorId} className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Field.displayName = 'Field';
