import * as React from 'react';
import { focusableDisabledProps, joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { CheckIcon, SubtractIcon } from '../../lib/icons';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing, forcedColors } from '../../lib/styles';
import type { LabelPosition } from '../../lib/types';
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

/** Where a Checkbox renders its label: after the box (default) or before it. */
export type CheckboxLabelPosition = Extract<LabelPosition, 'before' | 'after'>;

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
  /**
   * Shows the mixed state: the dash glyph and `aria-checked="mixed"`, whatever `checked` is. A
   * click still toggles `checked` and calls `onCheckedChange`, but the checkbox keeps showing and
   * announcing "mixed" until you clear `indeterminate`. For a tri-state "select all", derive
   * `checked` and `indeterminate` from the items and set every item in `onCheckedChange`.
   * @default false
   */
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
   * Marks the checkbox unavailable but keeps it focusable and in the tab order: for a disabled
   * checkbox that needs a Tooltip, or one in a toolbar. Renders `aria-disabled="true"`,
   * `data-disabled` and `data-disabled-focusable` on the checkbox instead of the native `disabled`
   * attribute. The checkbox cannot be toggled and is not submitted with its form; your `onClick`
   * is not called, and a click on the checkbox (or Space and Enter) does not reach ancestor click
   * handlers, as for a natively disabled control. Wins over `disabled` when both are set. In a
   * roving container (a `Toolbar`) it stays in the arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
  /**
   * Label next to the control (any phrasing content, links included, but no other form
   * controls). It names the control through `aria-labelledby`, after a consumer or Field
   * `aria-labelledby`; a consumer `aria-label` names it instead. Clicking its text toggles the
   * control; clicking a link inside it follows the link. `children` are not rendered: pass the
   * label here.
   */
  label?: React.ReactNode;
  /**
   * Where the label renders: after the control (default) or before it. The DOM order follows the
   * visual order.
   * @default 'after'
   */
  labelPosition?: CheckboxLabelPosition;
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
 *   `-details`/`-disabled`, `tabIndex`, `autoFocus` and the click, focus and key handlers
 *   (`controlRef` exposes it). A consumer `onClick` runs once per activation, before the toggle;
 *   `preventDefault()` in it cancels the toggle.
 * - Inside a `Field` it is named by the Field label (followed by its own `label` text) and described
 *   by the Field message and hint.
 * - With `name` (or `required`) it takes part in native forms like `<input type="checkbox">`, and
 *   a form reset restores `defaultChecked`.
 * - `label` takes rich content (a link to the terms) and renders after the box, or before it with
 *   `labelPosition="before"` (the root carries `data-label-position`). The box lines up with the
 *   first line of a label that wraps or has a second line. `children` are not rendered (a
 *   development warning says so).
 */
export const Checkbox = ({
  checked: checkedProp,
  defaultChecked = false,
  indeterminate = false,
  onCheckedChange,
  onChange,
  disabled = false,
  disabledFocusable = false,
  label,
  labelPosition = 'after',
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
  'aria-disabled': ariaDisabled,
  autoFocus,
  tabIndex,
  onClick,
  onFocus,
  onBlur,
  onKeyDown,
  onKeyUp,
  controlRef,
  className,
  children,
  ref,
  ...rest
}: CheckboxProps) => {
  if (onChange !== undefined) warnDeprecated('Checkbox', 'onChange', 'onCheckedChange');
  const hasChildren = slotRendersContent(children);
  React.useEffect(() => {
    if (hasChildren) {
      warnOnce(
        'Checkbox:children',
        'Checkbox: children are not rendered. Pass the label in `label`.',
      );
    }
  }, [hasChildren]);
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
  // `0` is a label; `null`, `false`, `''` and empty collections are not (C-SLOTS).
  const hasLabel = slotRendersContent(label);
  // The label text names the control through aria-labelledby, disabled or not: axe exempts the
  // dimmed text of a disabled control only when the control references it this way (its <label>
  // exemption covers native inputs only). A consumer aria-label still names the control alone.
  // The ids already there (the consumer's, the Field label from useFieldControl) come first, then
  // the Field label whose <label htmlFor> targets this control (aria-labelledby would hide it), so
  // the name keeps every label.
  const labelledBy =
    hasLabel && fieldProps['aria-label'] === undefined
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
  // Focusable-disabled wins over `disabled`: the box stays focusable but looks and acts disabled.
  const unavailable = disabled || disabledFocusable;
  // The glyph is the forced-colors leaf; the box stays on system colors (see `checkedBox`).
  const glyphClassName = unavailable ? disabledGlyph : forcedColors.selectedLeaf;
  const labelText = hasLabel ? (
    <span id={labelTextId} className="text-body-1 text-foreground">
      {materialiseSlotContent(label)}
    </span>
  ) : null;

  return (
    <label
      ref={ref}
      data-label-position={labelPosition}
      className={cn(
        // items-start: the box lines up with the first line of a label that wraps or has a second
        // line, not with its middle.
        'relative inline-flex items-start gap-2 select-none',
        // The dimmed look lifts while a focus ring shows inside the root (the control's, under
        // disabledFocusable, or a link's in the label): opacity would dim the ring below 3:1.
        unavailable
          ? 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100'
          : 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      {labelPosition === 'before' && labelText}
      <button
        id={generatedId}
        type="button"
        {...fieldProps}
        aria-labelledby={labelledBy}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        aria-disabled={ariaDisabled}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        ref={mergedControlRef}
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled && !disabledFocusable}
        {...focusableDisabledProps(disabledFocusable, { reachable: true })}
        onClick={
          disabledFocusable
            ? // Clicks, Space and Enter (which click a button) neither toggle nor reach `onClick`,
              // and, as a natively disabled control dispatches no click, no ancestor sees them.
              (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
              }
            : composeEventHandlers(onClick, () => setChecked((prev) => !prev))
        }
        className={cn(
          // p-0 and the unchecked bg-transparent are set here, not left to the native reset, which
          // any app button style overrides (C-NATIVE).
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-xs border p-0 transition-colors motion-reduce:transition-none',
          // Centred on the 20px first line of the label text.
          hasLabel && 'mt-px',
          focusRing,
          on
            ? cn(
                'border-primary bg-primary text-primary-foreground',
                unavailable ? disabledCheckedBox : checkedBox,
              )
            : cn(
                'border-stroke-accessible bg-transparent',
                unavailable ? forcedColors.disabled : forcedColors.control,
              ),
        )}
      >
        {indeterminate ? (
          <SubtractIcon size={12} className={glyphClassName} />
        ) : checked ? (
          <CheckIcon size={12} className={glyphClassName} />
        ) : null}
      </button>
      {labelPosition !== 'before' && labelText}
      <HiddenInput
        type="checkbox"
        name={name}
        form={form}
        disabled={unavailable}
        value={value}
        checked={checked}
        required={isRequired}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </label>
  );
};

Checkbox.displayName = 'Checkbox';
