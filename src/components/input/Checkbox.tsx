import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated } from '../../lib/dev';
import { CheckIcon, SubtractIcon } from '../../lib/icons';
import { focusRing, forcedColors } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

/*
 * Forced colors: the focusable box keeps system-color utilities, so the browser still forces its
 * focus outline and border; only the glyph (the leaf indicator) opts out of forced colors. A
 * disabled box draws a GrayText glyph and border on Canvas, without the Highlight fill.
 */
const checkedBox = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const disabledCheckedBox = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';
const disabledGlyph = 'forced-colors:text-[GrayText] forced-colors:forced-color-adjust-none';

/** Handlers that run on the `role="checkbox"` button instead of the root label (C-ROUTING). */
type CheckboxControlHandlers = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Properties for the Checkbox component. */
export interface CheckboxProps extends Omit<
  React.HTMLAttributes<HTMLLabelElement>,
  'onChange' | 'defaultChecked' | CheckboxControlHandlers
> {
  /** Controlled checked state. */
  checked?: boolean;
  /** Initial checked state for uncontrolled usage (also the value a form reset restores).
   * @default false
   */
  defaultChecked?: boolean;
  /** Whether the checkbox shows an indeterminate (mixed) state. */
  indeterminate?: boolean;
  /** Called with the new checked state when it changes (not for no-op updates). */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Called with the new checked state when it changes.
   * @deprecated Use `onCheckedChange`.
   */
  onChange?: (checked: boolean) => void;
  /** Whether the checkbox is disabled and non-interactive. */
  disabled?: boolean;
  /**
   * Text label displayed next to the checkbox. It names the control through `aria-labelledby`,
   * after a consumer or Field `aria-labelledby`; a consumer `aria-label` names it instead.
   */
  label?: string;
  /**
   * Form field name. With a name, the checkbox takes part in native form submission: it submits
   * `name=value` while checked.
   */
  name?: string;
  /** Value submitted while checked.
   * @default 'on'
   */
  value?: string;
  /** The form must not be submitted while the checkbox is unchecked (native validation). */
  required?: boolean;
  /** Id of the form the checkbox belongs to, when it is rendered outside that form. */
  form?: string;
  /** Click handler of the checkbox control (the `role="checkbox"` button). */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Focus handler of the checkbox control. */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Blur handler of the checkbox control. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /** Keydown handler of the checkbox control. */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Keyup handler of the checkbox control. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Ref to the focusable `role="checkbox"` button. */
  controlRef?: React.Ref<HTMLButtonElement>;
  /** Ref to the root `<label>` element. */
  ref?: React.Ref<HTMLLabelElement>;
}

/**
 * A checkbox for a boolean (or mixed) choice, drawn as a `role="checkbox"` button inside a
 * `<label>`.
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
 */
export const Checkbox = ({
  checked: checkedProp,
  defaultChecked = false,
  indeterminate = false,
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
}: CheckboxProps) => {
  if (onChange !== undefined) warnDeprecated('Checkbox', 'onChange', 'onCheckedChange');
  const [checked, setChecked] = useControllable(checkedProp, defaultChecked, (next: boolean) => {
    onCheckedChange?.(next);
    onChange?.(next);
  });

  const generatedId = useId('checkbox');
  const labelTextId = useId('checkbox-label');
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

  const on = checked || indeterminate;
  // The glyph is the forced-colors leaf; the box stays on system colors (see `checkedBox`).
  const glyphClassName = disabled ? disabledGlyph : forcedColors.selectedLeaf;

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
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled}
        onClick={composeEventHandlers(onClick, () => setChecked((prev) => !prev))}
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border transition-colors motion-reduce:transition-none',
          focusRing,
          on
            ? cn(
                'border-primary bg-primary text-primary-foreground',
                disabled ? disabledCheckedBox : checkedBox,
              )
            : cn(
                'border-stroke-accessible',
                disabled ? forcedColors.disabled : forcedColors.control,
              ),
        )}
      >
        {indeterminate ? (
          <SubtractIcon size={12} className={glyphClassName} />
        ) : checked ? (
          <CheckIcon size={12} className={glyphClassName} />
        ) : null}
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

Checkbox.displayName = 'Checkbox';
