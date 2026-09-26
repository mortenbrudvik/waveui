import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { resolveDeprecatedProp } from '../../lib/dev';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import {
  inputAppearanceClasses,
  inputFocus,
  inputFocusWithin,
  inputHeightClasses,
  inputInvalid,
  inputInvalidWithin,
  inputPaddingClasses,
  inputTextClasses,
} from '../../lib/styles';
import type { CoreSize, InputAppearance, Slot } from '../../lib/types';
import { useId } from '../../hooks/useId';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useInputLook } from './inputLook';

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
  /**
   * Whether `error` marks the control invalid (a non-empty string or `true`), unless the consumer
   * set `aria-invalid` to `false`/`"false"`.
   */
  invalid: boolean;
  /** The id of the rendered message, joined into `aria-describedby`/`aria-errormessage`. */
  messageId: string | undefined;
  /** The message element to render after the control, or `null`. */
  message: React.ReactElement | null;
}

/** Whether an `aria-invalid` value explicitly reports the control as valid. */
function isAriaValid(ariaInvalid: React.AriaAttributes['aria-invalid']): boolean {
  return ariaInvalid === false || ariaInvalid === 'false';
}

/**
 * Shared by Input, Select and Textarea (internal): a non-empty string `error` renders a sibling
 * `<span role="alert">` message, unless the surrounding `Field` already renders its own error
 * (`FieldContext.hasErrorMessage`); `true` only marks the control invalid. The consumer's
 * `aria-invalid` of `false`/`"false"` wins over `error`: the control is valid, so nothing is
 * marked invalid and no message is rendered or referenced (ARIA: an error message of a valid
 * control is hidden).
 *
 * @internal Not exported from the package.
 */
export function useControlErrorMessage(
  error: string | boolean | undefined,
  errorMessageProps: InputErrorMessageProps | undefined,
  consumerAriaInvalid?: React.AriaAttributes['aria-invalid'],
): ControlErrorMessage {
  const field = useFieldContext();
  const generatedId = useId('error');
  const invalid =
    !isAriaValid(consumerAriaInvalid) &&
    (error === true || (typeof error === 'string' && error !== ''));
  const showMessage = invalid && typeof error === 'string' && !field?.hasErrorMessage;
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
 * matches the state assistive technology reports. A resolved `false`/`"false"` (the consumer's
 * override) never shows it, even with an own `error`. `"grammar"`/`"spelling"` alone do not
 * count; with an own `error` they keep the look (the control is reported invalid).
 *
 * @internal Not exported from the package.
 */
export function isInvalidLook(
  ownError: boolean,
  ariaInvalid: React.AriaAttributes['aria-invalid'],
): boolean {
  if (isAriaValid(ariaInvalid)) return false;
  return ownError || ariaInvalid === true || ariaInvalid === 'true';
}

/** Padding of the slot spans and the inner input of the slot wrapper, per size. */
const SLOT_PADDING: Readonly<Record<CoreSize, { before: string; after: string; input: string }>> = {
  small: { before: 'ps-1.5', after: 'pe-1.5', input: 'px-1.5' },
  medium: { before: 'ps-2', after: 'pe-2', input: 'px-2' },
  large: { before: 'ps-3', after: 'pe-3', input: 'px-3' },
};

/** Properties for the Input component. */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * Validation error.
   * - A non-empty string renders the message in a `role="alert"` element **after** the field (a
   *   sibling, so it does not change which element receives `ref`, `className` or `style`) and
   *   links it through `aria-describedby` and `aria-errormessage`. Inside a `Field` that renders
   *   its own `error`, the message is not repeated.
   * - `true` only marks the input invalid (`aria-invalid` and the error border), as in 0.4.
   *
   * The error border also shows whenever the input ends up `aria-invalid="true"` without this
   * prop (an `error` on the surrounding `Field`, or your own `aria-invalid`).
   * Your own `aria-invalid={false}` (or `"false"`) wins over this prop: the input is reported
   * valid and shows neither the error border nor the message.
   * Use `Field` (`label`, `hint`, `error`) for a complete field layout.
   */
  error?: string | boolean;
  /** Props of the error message element (`id`, `className`, …) rendered for a string `error`. */
  errorMessageProps?: InputErrorMessageProps;
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`.
   *
   * A number is the native `size` attribute (the visible width in characters), as in 0.8: it
   * still renders, warns once in development and is removed in 1.0. Use `htmlSize` for it.
   */
  size?: CoreSize | number;
  /** The native `size` attribute: the visible width of the field in characters. */
  htmlSize?: number;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /**
   * Slot rendered before the input text (e.g., an icon). With content in either slot, a bordered
   * `<span>` around the input draws the field: it receives `className`, `style` and `hidden`,
   * while `ref`, `id`, `aria-*`, `data-*`, handlers and native attributes stay on the `<input>`.
   * A value that renders nothing (`false`, `''`, `[]`) is no slot.
   */
  contentBefore?: Slot<'span'>;
  /** Slot rendered after the input text (e.g., a suffix). Same wrapper as `contentBefore`. */
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
 * `size` resolves from its own prop, then the surrounding `Field`'s `size`, then
 * `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own prop, then
 * `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as `data-size` and
 * `data-appearance` on the element that draws the field (the `<input>`, or the wrapper with slot
 * content).
 *
 * Every prop reaches the `<input>`, except with slot content: then a bordered `<span>` wrapper
 * draws the field and receives `className`, `style` and `hidden` (`ref` stays on the input).
 *
 * @example
 * <Field label="Email" hint="We never share it" required>
 *   <Input type="email" value={email} onValueChange={setEmail} />
 * </Field>
 */
export const Input = ({
  error,
  errorMessageProps,
  size: sizeProp,
  htmlSize,
  appearance: appearanceProp,
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
    'Input',
    htmlSize,
    numericSize,
    'size={number}',
    'htmlSize',
  );
  const { size, appearance } = useInputLook(
    typeof sizeProp === 'number' ? undefined : sizeProp,
    appearanceProp,
  );

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

  const hasBefore = slotRendersContent(contentBefore);
  const hasAfter = slotRendersContent(contentAfter);

  let control: React.ReactElement;
  if (hasBefore || hasAfter) {
    // The bordered wrapper is the visible field: `className`, `style` and `hidden` size, style and
    // hide it; `ref`, `id`, `aria-*`, `data-*`, handlers and native attributes go to the input.
    const { style, hidden, ...inputProps } = controlProps;
    control = (
      <span
        hidden={hidden}
        style={style}
        data-size={size}
        data-appearance={appearance}
        className={cn(
          'inline-flex w-full items-center',
          inputHeightClasses[size],
          inputTextClasses[size],
          inputAppearanceClasses[appearance],
          'text-foreground',
          inputFocusWithin,
          invalidLook && inputInvalidWithin,
          // The dimmed look lifts while a focus ring shows inside the wrapper (focusable slot
          // content; the disabled input never takes focus): opacity would dim the ring below 3:1.
          props.disabled && 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100',
          className,
        )}
      >
        {hasBefore && renderSlot(contentBefore, 'span', cn('shrink-0', SLOT_PADDING[size].before))}
        <input
          ref={ref}
          className={cn(
            'h-full w-full min-w-0 bg-transparent',
            SLOT_PADDING[size].input,
            inputTextClasses[size],
            'text-foreground',
            'placeholder:text-muted-foreground',
            'focus:outline-hidden',
            'disabled:cursor-not-allowed',
          )}
          {...inputProps}
          size={nativeSize}
        />
        {hasAfter && renderSlot(contentAfter, 'span', cn('shrink-0', SLOT_PADDING[size].after))}
      </span>
    );
  } else {
    control = (
      <input
        ref={ref}
        data-size={size}
        data-appearance={appearance}
        className={cn(
          inputHeightClasses[size],
          'w-full',
          inputPaddingClasses[size],
          inputTextClasses[size],
          inputAppearanceClasses[appearance],
          'text-foreground placeholder:text-muted-foreground',
          inputFocus,
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalidLook && inputInvalid,
          className,
        )}
        {...controlProps}
        size={nativeSize}
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
