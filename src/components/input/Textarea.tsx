import * as React from 'react';
import { wcn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { textareaClassNames } from '../../lib/classNames';
import { inputAppearanceClasses, inputFocus, inputInvalid } from '../../lib/styles';
import type { CoreSize, InputAppearance } from '../../lib/types';
import { useFieldControl } from '../../hooks/useFieldControl';
import { isInvalidLook, useControlErrorMessage, type InputErrorMessageProps } from './Input';
import { useInputLook } from './inputLook';
import { useAppClassName } from '../../hooks/useAppClassName';

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
  /**
   * Size of the field, a minimum height with its type ramp: `small` (64px, Caption 1 text),
   * `medium` (80px, Body 1) or `large` (96px, Body 2). Default: the surrounding Field's `size`,
   * else `WaveProvider inputDefaults.size`, else `'medium'`.
   */
  size?: CoreSize;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /**
   * Which directions the user can drag the corner handle to resize the field in (Fluent UI's
   * `resize`): `none`, `vertical`, `horizontal` or `both`. Default: `'vertical'`, the height-only
   * resize WaveUI has always drawn (Fluent's default is `'none'`).
   * @default 'vertical'
   */
  resize?: TextareaResize;
  /**
   * Called with the new string value on every change, next to the native `onChange` event
   * handler (`onValueChange={setNote}` instead of `onChange={(e) => setNote(e.target.value)}`;
   * Fluent UI's `onChange(event, data)` with `data.value`).
   */
  onValueChange?: (value: string) => void;
  /** Ref to the `<textarea>` element. */
  ref?: React.Ref<HTMLTextAreaElement>;
}

/** The directions a Textarea can be resized in: the values of its `resize` prop. */
export type TextareaResize = 'none' | 'vertical' | 'horizontal' | 'both';

/** The resize utilities of each `resize` value. */
const TEXTAREA_RESIZE: Readonly<Record<TextareaResize, string>> = {
  none: 'wave:resize-none',
  vertical: 'wave:resize-y',
  horizontal: 'wave:resize-x',
  both: 'wave:resize',
};

/** Minimum height, padding and type ramp of each size (medium is the 0.7 look). */
const TEXTAREA_SIZE: Readonly<Record<CoreSize, string>> = {
  small: 'wave:min-h-16 wave:px-2 wave:py-1 wave:text-caption-1',
  medium: 'wave:min-h-20 wave:px-3 wave:py-2 wave:text-body-1',
  large: 'wave:min-h-24 wave:px-4 wave:py-2.5 wave:text-body-2',
};

/**
 * A multi-line text input with Fluent styling (`resize` vertical by default, accessible bottom stroke, primary
 * bottom border while focused). Inside a `Field` it picks up the label, hint, error, `required`
 * (native attribute) and invalid state automatically.
 *
 * `size` resolves from its own prop, then the surrounding `Field`'s `size`, then
 * `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own prop, then
 * `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as `data-size` and
 * `data-appearance` on the textarea element.
 *
 * @example
 * <Field label="Description" hint="Markdown is supported">
 *   <Textarea rows={4} />
 * </Field>
 */
export const Textarea = ({
  error,
  errorMessageProps,
  size: sizeProp,
  appearance: appearanceProp,
  resize = 'vertical',
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
}: TextareaProps) => {
  const appClassName = useAppClassName(textareaClassNames.root);

  const { invalid, messageId, message } = useControlErrorMessage(
    error,
    errorMessageProps,
    ariaInvalid,
    textareaClassNames.errorMessage,
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
  const { size, appearance } = useInputLook(sizeProp, appearanceProp);

  const handleChange =
    onChange || onValueChange
      ? (event: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange?.(event);
          onValueChange?.(event.currentTarget.value);
        }
      : undefined;

  const control = (
    <textarea
      ref={ref}
      data-size={size}
      data-appearance={appearance}
      className={wcn(
        textareaClassNames.root,
        'wave:w-full',
        // A value outside the four (untyped code) falls back to the default resize.
        TEXTAREA_RESIZE[resize] ?? TEXTAREA_RESIZE.vertical,
        TEXTAREA_SIZE[size],
        inputAppearanceClasses[appearance],
        'wave:text-foreground wave:placeholder:text-muted-foreground',
        inputFocus,
        'wave:disabled:cursor-not-allowed wave:disabled:opacity-50',
        invalidLook && inputInvalid,
        appClassName,
        className,
      )}
      {...props}
      {...fieldProps}
      onChange={handleChange}
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
