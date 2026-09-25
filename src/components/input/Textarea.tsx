import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { inputFocus, inputInvalid } from '../../lib/styles';
import { useFieldControl } from '../../hooks/useFieldControl';
import { isInvalidLook, useControlErrorMessage, type InputErrorMessageProps } from './Input';

/** Properties for the Textarea component. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Validation error.
   * - A non-empty string renders the message in a `role="alert"` element **after** the textarea
   *   (a sibling, so `ref` and `className` stay on the textarea) and links it through
   *   `aria-describedby` and `aria-errormessage`. Inside a `Field` that renders its own `error`,
   *   the message is not repeated.
   * - `true` only marks the textarea invalid (`aria-invalid` and the error border), as in 0.4.
   *
   * The error border also shows whenever the textarea ends up `aria-invalid="true"` without this
   * prop (an `error` on the surrounding `Field`, or your own `aria-invalid`).
   * Your own `aria-invalid={false}` (or `"false"`) wins over this prop: the textarea is reported
   * valid and shows neither the error border nor the message.
   */
  error?: string | boolean;
  /** Props of the error message element (`id`, `className`, …) rendered for a string `error`. */
  errorMessageProps?: InputErrorMessageProps;
  /** Ref to the `<textarea>` element. */
  ref?: React.Ref<HTMLTextAreaElement>;
}

/**
 * A multi-line text input with Fluent styling (vertical resize, accessible bottom stroke, primary
 * bottom border while focused). Inside a `Field` it picks up the label, hint, error, `required`
 * (native attribute) and invalid state automatically.
 *
 * @example
 * <Field label="Description" hint="Markdown is supported">
 *   <Textarea rows={4} />
 * </Field>
 */
export const Textarea = ({
  error,
  errorMessageProps,
  className,
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
}: TextareaProps) => {
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
    <textarea
      ref={ref}
      className={cn(
        'min-h-20 w-full resize-y rounded border border-input border-b-stroke-accessible bg-background px-3 py-2 text-body-1 text-foreground',
        'placeholder:text-muted-foreground',
        inputFocus,
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalidLook && inputInvalid,
        className,
      )}
      {...props}
      {...fieldProps}
      aria-errormessage={joinIds(ariaErrorMessage, messageId)}
    />
  );

  if (!message) return control;
  return (
    <>
      {control}
      {message}
    </>
  );
};

Textarea.displayName = 'Textarea';
