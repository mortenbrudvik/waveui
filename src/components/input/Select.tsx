import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { resolveDeprecatedProp } from '../../lib/dev';
import {
  inputAppearanceClasses,
  inputFocus,
  inputHeightClasses,
  inputInvalid,
  inputTextClasses,
} from '../../lib/styles';
import type { CoreSize, InputAppearance } from '../../lib/types';
import { useFieldControl } from '../../hooks/useFieldControl';
import { isInvalidLook, useControlErrorMessage, type InputErrorMessageProps } from './Input';
import { useInputLook } from './inputLook';

/** Properties for the Select component. */
export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
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
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`.
   *
   * A number is the native `size` attribute (the number of visible rows), as in 0.8: it still
   * renders, warns once in development and is removed in 1.0. Use `htmlSize` for it.
   */
  size?: CoreSize | number;
  /** The native `size` attribute: the number of visible rows. */
  htmlSize?: number;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /** Ref to the `<select>` element. */
  ref?: React.Ref<HTMLSelectElement>;
}

/** Inline paddings and chevron geometry of each size (medium is the 0.7 look). */
const SELECT_SIZE: Readonly<Record<CoreSize, string>> = {
  small:
    'ps-2 pe-6 bg-[size:4px_4px,4px_4px] bg-[position:right_12px_center,right_8px_center] wave-rtl:bg-[position:left_8px_center,left_12px_center]',
  medium:
    'ps-3 pe-8 bg-[size:5px_5px,5px_5px] bg-[position:right_16px_center,right_11px_center] wave-rtl:bg-[position:left_11px_center,left_16px_center]',
  large:
    'ps-4 pe-10 bg-[size:6px_6px,6px_6px] bg-[position:right_20px_center,right_14px_center] wave-rtl:bg-[position:left_14px_center,left_20px_center]',
};

/**
 * A native `<select>` with Fluent styling: a 1px border with an accessible bottom stroke, a token
 * chevron at the inline end and a primary bottom border while focused. Give it a name with a
 * `Field` label, `aria-label` or `aria-labelledby`. Inside a `Field` it picks up the label, hint,
 * error, `required` (native attribute) and invalid state automatically.
 *
 * `size` resolves from its own prop, then the surrounding `Field`'s `size`, then
 * `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own prop, then
 * `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as `data-size` and
 * `data-appearance` on the `<select>`.
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
  size: sizeProp,
  htmlSize,
  appearance: appearanceProp,
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
  const numericSize = typeof sizeProp === 'number' ? sizeProp : undefined;
  const nativeSize = resolveDeprecatedProp(
    'Select',
    htmlSize,
    numericSize,
    'size={number}',
    'htmlSize',
  );
  const { size, appearance } = useInputLook(
    typeof sizeProp === 'number' ? undefined : sizeProp,
    appearanceProp,
  );

  const control = (
    <select
      ref={ref}
      data-size={size}
      data-appearance={appearance}
      className={cn(
        inputHeightClasses[size],
        'w-full appearance-none',
        inputTextClasses[size],
        inputAppearanceClasses[appearance],
        'text-foreground',
        // Chevron: two token-colored gradient halves of a small triangle at the inline end.
        'bg-no-repeat',
        SELECT_SIZE[size],
        'bg-[image:linear-gradient(45deg,transparent_50%,var(--wave-muted-foreground)_50%),linear-gradient(135deg,var(--wave-muted-foreground)_50%,transparent_50%)]',
        // Forced colors drop the background chevron: show the native arrow instead.
        'forced-colors:appearance-auto forced-colors:bg-none',
        inputFocus,
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalidLook && inputInvalid,
        className,
      )}
      {...props}
      {...fieldProps}
      aria-errormessage={joinIds(ariaErrorMessage, messageId)}
      size={nativeSize}
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
