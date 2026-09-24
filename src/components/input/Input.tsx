import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { renderSlot } from '../../lib/slot';
import { inputFocus, inputFocusWithin } from '../../lib/styles';
import type { Slot } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';

/**
 * Props of the error message element that {@link Input}, `Select` and `Textarea` render after the
 * control for a string `error` (`id`, `className`, `role`, data attributes, …).
 */
export interface InputErrorMessageProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Ref to the message `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
  /** Any `data-*` attribute. */
  [dataAttribute: `data-${string}`]: unknown;
}

/**
 * Result of {@link useControlErrorMessage}.
 *
 * @internal Not exported from the package.
 */
export interface ControlErrorMessage {
  /** Whether `error` marks the control invalid (a non-empty string or `true`). */
  invalid: boolean;
  /** The id of the rendered message, joined into `aria-describedby`/`aria-errormessage`. */
  messageId: string | undefined;
  /** The message element to render after the control, or `null`. */
  message: React.ReactElement | null;
}

/**
 * Shared by Input, Select and Textarea (internal): a non-empty string `error` renders a sibling
 * `<span role="alert">` message, unless the surrounding `Field` already renders its own error
 * (`FieldContext.hasErrorMessage`); `true` only marks the control invalid.
 *
 * @internal Not exported from the package.
 */
export function useControlErrorMessage(
  error: string | boolean | undefined,
  errorMessageProps: InputErrorMessageProps | undefined,
): ControlErrorMessage {
  const field = useFieldContext();
  const generatedId = useId('error');
  const invalid = error === true || (typeof error === 'string' && error !== '');
  const showMessage = typeof error === 'string' && error !== '' && !field?.hasErrorMessage;
  if (!showMessage) return { invalid, messageId: undefined, message: null };

  const { id: ownId, className: messageClassName, ...messageRest } = errorMessageProps ?? {};
  const messageId = ownId ?? generatedId;
  const message = (
    <span
      role="alert"
      {...messageRest}
      id={messageId}
      className={cn('mt-1 block text-caption-1 text-error', messageClassName)}
    >
      {error}
    </span>
  );
  return { invalid, messageId, message };
}

/**
 * Whether a text control shows the invalid look (error border), shared by Input, Select, Textarea
 * and SearchBox (internal): its own `error`, or a resolved `aria-invalid` of `true`/`"true"` —
 * from the consumer or from the surrounding `Field` (`useFieldControl`) — so the look always
 * matches the state assistive technology reports. `"grammar"`/`"spelling"` do not count.
 *
 * @internal Not exported from the package.
 */
export function isInvalidLook(
  ownError: boolean,
  ariaInvalid: React.AriaAttributes['aria-invalid'],
): boolean {
  return ownError || ariaInvalid === true || ariaInvalid === 'true';
}

/** Properties for the Input component. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Validation error.
   * - A non-empty string renders the message in a `role="alert"` element **after** the input
   *   (a sibling, so `ref` and `className` stay on the input) and links it through
   *   `aria-describedby` and `aria-errormessage`. Inside a `Field` that renders its own `error`,
   *   the message is not repeated.
   * - `true` only marks the input invalid (`aria-invalid` and the error border), as in 0.4.
   *
   * The error border also shows whenever the input ends up `aria-invalid="true"` without this
   * prop (an `error` on the surrounding `Field`, or your own `aria-invalid`).
   * Use `Field` (`label`, `hint`, `error`) for a complete field layout.
   */
  error?: string | boolean;
  /** Props of the error message element (`id`, `className`, …) rendered for a string `error`. */
  errorMessageProps?: InputErrorMessageProps;
  /** Slot rendered before the input text (e.g., an icon). */
  contentBefore?: Slot<'span'>;
  /** Slot rendered after the input text (e.g., a suffix). */
  contentAfter?: Slot<'span'>;
  /**
   * Called with the new string value on every change, next to the native `onChange` event
   * handler (`onValueChange={setName}` instead of `onChange={(e) => setName(e.target.value)}`).
   */
  onValueChange?: (value: string) => void;
  /** Ref to the `<input>` element (also with `contentBefore`/`contentAfter`). */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * A single-line text input with Fluent styling: a 1px border with an accessible bottom stroke, a
 * primary bottom border while focused, optional `contentBefore`/`contentAfter` slots and an
 * optional error message. Inside a `Field` it picks up the label, hint, error, `required` (native
 * attribute) and invalid state automatically.
 *
 * @example
 * <Field label="Email" hint="We never share it" required>
 *   <Input type="email" value={email} onValueChange={setEmail} />
 * </Field>
 */
export const Input = ({
  error,
  errorMessageProps,
  contentBefore,
  contentAfter,
  onChange,
  onValueChange,
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
}: InputProps) => {
  const { invalid, messageId, message } = useControlErrorMessage(error, errorMessageProps);
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

  const handleChange =
    onChange || onValueChange
      ? (event: React.ChangeEvent<HTMLInputElement>) => {
          onChange?.(event);
          onValueChange?.(event.currentTarget.value);
        }
      : undefined;

  const controlProps = {
    ...props,
    ...fieldProps,
    'aria-errormessage': joinIds(ariaErrorMessage, messageId),
    onChange: handleChange,
  };

  let control: React.ReactElement;
  if (contentBefore != null || contentAfter != null) {
    control = (
      <span
        className={cn(
          'inline-flex h-8 w-full items-center rounded border border-input border-b-stroke-accessible bg-background text-body-1 text-foreground',
          inputFocusWithin,
          invalidLook && 'border-destructive focus-within:border-b-destructive',
          props.disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {contentBefore != null && renderSlot(contentBefore, 'span', 'shrink-0 ps-2')}
        <input
          ref={ref}
          className={cn(
            'h-full w-full min-w-0 bg-transparent px-2 text-body-1 text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-hidden',
            'disabled:cursor-not-allowed',
          )}
          {...controlProps}
        />
        {contentAfter != null && renderSlot(contentAfter, 'span', 'shrink-0 pe-2')}
      </span>
    );
  } else {
    control = (
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded border border-input border-b-stroke-accessible bg-background px-3 text-body-1 text-foreground',
          'placeholder:text-muted-foreground',
          inputFocus,
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalidLook && 'border-destructive focus:border-b-destructive',
          className,
        )}
        {...controlProps}
      />
    );
  }

  if (!message) return control;
  return (
    <>
      {control}
      {message}
    </>
  );
};

Input.displayName = 'Input';
