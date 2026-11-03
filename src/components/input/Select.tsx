import * as React from 'react';
import { wcn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { selectClassNames } from '../../lib/classNames';
import { renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
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
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`. A value
   * outside the three sizes (a number from untyped code included) renders as if `size` were not
   * set. The native `size` attribute, the number of visible rows, is `htmlSize`.
   */
  size?: CoreSize;
  /** The native `size` attribute: the number of visible rows. */
  htmlSize?: number;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /**
   * The chevron at the inline end (Fluent UI's `icon` slot). `null` or `undefined` keep the
   * drawn chevron; `false`, or anything that renders nothing, draws none; content replaces it.
   * With content a `<span>` wraps the `<select>` and the icon: the `<select>` still receives
   * `ref`, `className` and the other props, and the icon is decorative (`aria-hidden`), carries
   * the stable class `wave-select__icon`, takes no pointer events (the click reaches the select)
   * and dims with a disabled select. The wrapper (`wave-select__wrapper`) is as wide as its
   * container, so size a Select with an icon through a container, not a width class on it. The
   * icon takes the box of its size (12px, 16px, 20px); give it an `svg` that fills it.
   * @default the drawn chevron
   */
  icon?: Slot<'span'>;
  /**
   * Called with the selected option's value on every change, next to the native `onChange` event
   * handler (`onValueChange={setCountry}` instead of
   * `onChange={(e) => setCountry(e.target.value)}`). Fluent UI's `onChange(event, data)` with
   * `data.value`. With `multiple` it receives the first selected option's value (the select's
   * `value`); read `event.currentTarget.selectedOptions` in `onChange` for all of them.
   */
  onValueChange?: (value: string) => void;
  /** Ref to the `<select>` element. */
  ref?: React.Ref<HTMLSelectElement>;
}

/** Inline paddings and chevron geometry of each size (medium is the 0.7 look). */
const SELECT_SIZE: Readonly<Record<CoreSize, string>> = {
  small:
    'wave:ps-2 wave:pe-6 wave:bg-[size:4px_4px,4px_4px] wave:bg-[position:right_12px_center,right_8px_center] wave:wave-rtl:bg-[position:left_8px_center,left_12px_center]',
  medium:
    'wave:ps-3 wave:pe-8 wave:bg-[size:5px_5px,5px_5px] wave:bg-[position:right_16px_center,right_11px_center] wave:wave-rtl:bg-[position:left_11px_center,left_16px_center]',
  large:
    'wave:ps-4 wave:pe-10 wave:bg-[size:6px_6px,6px_6px] wave:bg-[position:right_20px_center,right_14px_center] wave:wave-rtl:bg-[position:left_14px_center,left_20px_center]',
};

/** Padding, box and inline-end offset of the `icon` of each size (Fluent's 12, 16 and 20px). */
const SELECT_ICON: Readonly<Record<CoreSize, { padding: string; icon: string }>> = {
  small: { padding: 'wave:ps-2 wave:pe-6', icon: 'wave:size-3 wave:end-1.5' },
  medium: { padding: 'wave:ps-3 wave:pe-8', icon: 'wave:size-4 wave:end-2.5' },
  large: { padding: 'wave:ps-4 wave:pe-10', icon: 'wave:size-5 wave:end-3' },
};

/**
 * A native `<select>` with Fluent styling: a 1px border with an accessible bottom stroke, a token
 * chevron at the inline end (replaceable through `icon`) and a primary bottom border while focused. Give it a name with a
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
  icon,
  onChange,
  onValueChange,
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
    selectClassNames.errorMessage,
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

  // `null` and `undefined` keep the drawn chevron; content draws the icon in a wrapper; anything
  // else that renders nothing (`false`) draws no chevron at all.
  const drawnChevron = icon == null;
  const hasIcon = !drawnChevron && slotRendersContent(icon);
  const handleChange =
    onChange || onValueChange
      ? (event: React.ChangeEvent<HTMLSelectElement>) => {
          onChange?.(event);
          onValueChange?.(event.currentTarget.value);
        }
      : undefined;

  const control = (
    <select
      ref={ref}
      data-size={size}
      data-appearance={appearance}
      className={wcn(
        selectClassNames.root,
        inputHeightClasses[size],
        'wave:w-full wave:appearance-none',
        inputTextClasses[size],
        inputAppearanceClasses[appearance],
        'wave:text-foreground',
        drawnChevron
          ? [
              // Chevron: two token-colored gradient halves of a small triangle at the inline end.
              'wave:bg-no-repeat',
              SELECT_SIZE[size],
              'wave:bg-[image:linear-gradient(45deg,transparent_50%,var(--wave-muted-foreground)_50%),linear-gradient(135deg,var(--wave-muted-foreground)_50%,transparent_50%)]',
              // Forced colors drop the background chevron: show the native arrow instead.
              'wave:forced-colors:appearance-auto wave:forced-colors:bg-none',
            ]
          : // An `icon` (or none): no drawn chevron, and no native arrow in forced colors either.
            [SELECT_ICON[size].padding, 'wave:bg-none'],
        inputFocus,
        'wave:disabled:cursor-not-allowed wave:disabled:opacity-50',
        invalidLook && inputInvalid,
        className,
      )}
      {...props}
      {...fieldProps}
      onChange={handleChange}
      aria-errormessage={joinIds(ariaErrorMessage, messageId)}
      size={htmlSize}
    >
      {children}
    </select>
  );

  const field = hasIcon ? (
    <span className={wcn(selectClassNames.wrapper, 'wave:relative wave:block wave:w-full')}>
      {control}
      {renderSlot(
        icon,
        'span',
        wcn(
          selectClassNames.icon,
          'wave:pointer-events-none wave:absolute wave:inset-y-0 wave:my-auto',
          'wave:flex wave:items-center wave:justify-center wave:text-muted-foreground wave:[&>svg]:size-full',
          SELECT_ICON[size].icon,
          props.disabled && 'wave:opacity-50',
        ),
        { 'aria-hidden': true },
      )}
    </span>
  ) : (
    control
  );

  if (!message) return field;
  return (
    <>
      {field}
      {message}
    </>
  );
};

Select.displayName = 'Select';
