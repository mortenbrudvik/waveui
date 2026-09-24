import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated } from '../../lib/dev';
import { focusRing, forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

/*
 * Forced colors: the focusable track keeps system-color utilities, so the browser still forces its
 * focus outline; only the thumb (the leaf indicator) opts out of forced colors. A disabled switch
 * draws a GrayText thumb and border on Canvas, without the Highlight fill.
 */
const onTrack = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const disabledOnTrack = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';

/** Handlers that run on the `role="switch"` button instead of the root label (C-ROUTING). */
type SwitchControlHandlers = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Properties for the Switch component. */
export interface SwitchProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked' | SwitchControlHandlers
> {
  /** Controlled checked (on/off) state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage (also the value a form reset restores).
   * @default false
   */
  defaultChecked?: boolean;
  /** Called with the new checked state when the switch is toggled (not for no-op updates). */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Called with the new checked state when the switch is toggled.
   * @deprecated Use `onCheckedChange`.
   */
  onChange?: (checked: boolean) => void;
  /** Whether the switch is disabled and non-interactive. */
  disabled?: boolean;
  /**
   * Text label displayed next to the switch. It names the control through `aria-labelledby`,
   * after a consumer or Field `aria-labelledby`; a consumer `aria-label` names it instead.
   */
  label?: string;
  /**
   * Form field name. With a name, the switch takes part in native form submission: it submits
   * `name=value` while on.
   */
  name?: string;
  /** Value submitted while on.
   * @default 'on'
   */
  value?: string;
  /** The form must not be submitted while the switch is off (native validation). */
  required?: boolean;
  /** Id of the form the switch belongs to, when it is rendered outside that form. */
  form?: string;
  /** Click handler of the switch control (the `role="switch"` button). */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Focus handler of the switch control. */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Blur handler of the switch control. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /** Keydown handler of the switch control. */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Keyup handler of the switch control. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Ref to the focusable `role="switch"` button. */
  controlRef?: React.Ref<HTMLButtonElement>;
  /** Ref to the root `<label>` element. */
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * An on/off toggle drawn as a `role="switch"` button inside a `<label>`.
 *
 * - The root `<label>` receives `ref`, `className`, `style` and `data-*`; the control receives
 *   `id`, `aria-label`/`-labelledby`/`-describedby`/`-invalid`/`-required`/`-errormessage`/
 *   `-details`, `tabIndex`, `autoFocus` and the click, focus and key handlers (`controlRef` exposes
 *   it). A consumer `onClick` runs once per activation, before the toggle; `preventDefault()` in it
 *   cancels the toggle.
 * - Inside a `Field` it is named by the Field label (followed by its own `label` text) and described
 *   by the Field hint and error.
 * - With `name` (or `required`) it takes part in native forms like `<input type="checkbox">`, and
 *   a form reset restores `defaultChecked`.
 * - The thumb position mirrors under `dir="rtl"`.
 */
export const Switch = ({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  onChange,
  disabled = false,
  label,
  name,
  value,
  required,
  form,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  'aria-errormessage': ariaErrorMessage,
  'aria-details': ariaDetails,
  autoFocus,
  tabIndex,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  controlRef,
  className,
  ref,
  ...rest
}: SwitchProps) => {
  if (onChange !== undefined) warnDeprecated('Switch', 'onChange', 'onCheckedChange');
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, (next: boolean) => {
    onCheckedChange?.(next);
    onChange?.(next);
  });

  const generatedId = useId('switch');
  const labelTextId = useId('switch-label');
  const field = useFieldContext();
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required always matches
    // the native validation below (`isRequired`).
    'aria-required': ariaRequired ?? required,
  });
  const isRequired = required ?? field?.required ?? false;
  // The label text names the control through aria-labelledby, disabled or not: axe exempts the
  // dimmed text of a disabled control only when the control references it this way (its <label>
  // exemption covers native inputs only). A consumer aria-label still names the control alone.
  // The ids already there (the consumer's, the Field label from useFieldControl) come first, then
  // the Field label whose <label htmlFor> targets this control (aria-labelledby would hide it), so
  // the name keeps every label.
  const labelledBy =
    label && fieldProps['aria-label'] === undefined
      ? joinIds(
          fieldProps['aria-labelledby'],
          field && fieldProps.id === field.controlId ? field.labelId : undefined,
          labelTextId,
        )
      : fieldProps['aria-labelledby'];

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const mergedControlRef = useMergedRefs(buttonRef, controlRef);
  useFormReset(buttonRef, () => setChecked(defaultChecked), form);

  return (
    <label
      ref={ref}
      className={cn(
        'relative inline-flex items-center gap-2 select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      <button
        id={generatedId}
        type="button"
        {...fieldProps}
        aria-labelledby={labelledBy}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        ref={mergedControlRef}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={composeEventHandlers(onClick, () => setChecked((prev) => !prev))}
        className={cn(
          'relative inline-flex h-5 w-10 shrink-0 items-center rounded-full border transition-colors duration-200 motion-reduce:transition-none',
          focusRing,
          checked
            ? cn('border-primary bg-primary', disabled ? disabledOnTrack : onTrack)
            : cn(
                'border-stroke-accessible bg-transparent',
                disabled ? forcedColors.disabled : forcedColors.control,
              ),
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'block h-[14px] w-[14px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
            checked
              ? 'translate-x-[22px] rtl:-translate-x-[22px] bg-primary-foreground'
              : 'translate-x-[2px] rtl:-translate-x-[2px] bg-stroke-accessible',
            disabled
              ? 'forced-colors:bg-[GrayText]'
              : checked
                ? 'forced-colors:bg-[HighlightText]'
                : 'forced-colors:bg-[ButtonText]',
          )}
        />
      </button>
      {label && (
        <span id={labelTextId} className="text-sm text-foreground">
          {label}
        </span>
      )}
      <HiddenInput
        type="checkbox"
        name={name}
        form={form}
        disabled={disabled}
        value={value}
        checked={checked}
        required={isRequired}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </label>
  );
};

Switch.displayName = 'Switch';
