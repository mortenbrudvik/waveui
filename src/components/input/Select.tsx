import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { inputFocus } from '../../lib/styles';
import { useFieldControl } from '../../hooks/useFieldControl';
import { isInvalidLook, useControlErrorMessage, type InputErrorMessageProps } from './Input';

/** Properties for the Select component. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Validation error.
   * - A non-empty string renders the message in a `role="alert"` element **after** the select
   *   (a sibling, so `ref` and `className` stay on the select) and links it through
   *   `aria-describedby` and `aria-errormessage`. Inside a `Field` that renders its own `error`,
   *   the message is not repeated.
   * - `true` only marks the select invalid (`aria-invalid` and the error border), as in 0.4.
   *
   * The error border also shows whenever the select ends up `aria-invalid="true"` without this
   * prop (an `error` on the surrounding `Field`, or your own `aria-invalid`).
   * Your own `aria-invalid={false}` (or `"false"`) wins over this prop: the select is reported
   * valid and shows neither the error border nor the message.
   */
  error?: string | boolean;
  /** Props of the error message element (`id`, `className`, …) rendered for a string `error`. */
  errorMessageProps?: InputErrorMessageProps;
  /** Ref to the `<select>` element. */
  ref?: React.Ref<HTMLSelectElement>;
}

/**
 * A native `<select>` with Fluent styling: a 1px border with an accessible bottom stroke, a token
 * chevron at the inline end and a primary bottom border while focused. Give it a name with a
 * `Field` label, `aria-label` or `aria-labelledby`. Inside a `Field` it picks up the label, hint,
 * error, `required` (native attribute) and invalid state automatically.
 *
 * @example
 * <Field label="Country" required>
 *   <Select defaultValue="">
 *     <option value="" disabled>Choose a country</option>
 *     <option value="no">Norway</option>
 *   </Select>
 * </Field>
 */
export const Select = ({
  error,
  errorMessageProps,
  className,
  children,
  ref,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  required,
  ...props
}: SelectProps) => {
  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
  );
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': joinIds(ariaDescribedBy, messageId),
      'aria-invalid': ariaInvalid ?? (invalid || undefined),
      'aria-required': ariaRequired,
      required,
    },
    { nativeRequired: true },
  );
  const invalidLook = isInvalidLook(invalid, fieldProps['aria-invalid']);

  const control = (
    <select
      ref={ref}
      className={cn(
        'h-8 w-full appearance-none rounded border border-input border-b-stroke-accessible bg-background ps-3 pe-8 text-body-1 text-foreground',
        // Chevron: two token-colored gradient halves of a small triangle at the inline end.
        'bg-no-repeat bg-[size:5px_5px,5px_5px] bg-[position:right_16px_center,right_11px_center] rtl:bg-[position:left_11px_center,left_16px_center]',
        'bg-[image:linear-gradient(45deg,transparent_50%,var(--wave-muted-foreground)_50%),linear-gradient(135deg,var(--wave-muted-foreground)_50%,transparent_50%)]',
        // Forced colors drop the background chevron: show the native arrow instead.
        'forced-colors:appearance-auto forced-colors:bg-none',
        inputFocus,
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalidLook && 'border-destructive focus:border-b-destructive',
        className,
      )}
      {...props}
      {...fieldProps}
      aria-errormessage={joinIds(ariaErrorMessage, messageId)}
    >
      {children}
    </select>
  );

  if (!message) return control;
  return (
    <>
      {control}
      {message}
    </>
  );
};

Select.displayName = 'Select';
