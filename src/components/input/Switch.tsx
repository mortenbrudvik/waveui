import * as React from 'react';
import { focusableDisabledProps, joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
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
 * Forced colors: the focusable track keeps system-color utilities, so the browser still forces its
 * focus outline; only the thumb (the leaf indicator) opts out of forced colors. A disabled switch
 * draws a GrayText thumb and border on Canvas, without the Highlight fill.
 */
const onTrack = 'forced-colors:border-[Highlight] forced-colors:bg-[Highlight]';
const disabledOnTrack = 'forced-colors:border-[GrayText] forced-colors:bg-[Canvas]';

/** Handlers that run on the `role="switch"` button instead of the root label (C-ROUTING). */
type SwitchControlHandlers = 'onClick' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Where a Switch renders its label: after the track (default), before it or above it. */
export type SwitchLabelPosition = Extract<LabelPosition, 'before' | 'after' | 'above'>;

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
   * Marks the switch unavailable but keeps it focusable and in the tab order: for a disabled
   * switch that needs a Tooltip, or one in a toolbar. Renders `aria-disabled="true"`,
   * `data-disabled` and `data-disabled-focusable` on the switch instead of the native `disabled`
   * attribute. The switch cannot be toggled and is not submitted with its form; your `onClick` is
   * not called, and a click on the switch (or Space and Enter) does not reach ancestor click
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
   * Where the label renders: after the control (default), before it, or above it. The DOM order
   * follows the visual order.
   * @default 'after'
   */
  labelPosition?: SwitchLabelPosition;
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
 *   `-details`/`-disabled`, `tabIndex`, `autoFocus` and the click, focus and key handlers
 *   (`controlRef` exposes it). A consumer `onClick` runs once per activation, before the toggle;
 *   `preventDefault()` in it cancels the toggle.
 * - Inside a `Field` it is named by the Field label (followed by its own `label` text) and described
 *   by the Field message and hint.
 * - With `name` (or `required`) it takes part in native forms like `<input type="checkbox">`, and
 *   a form reset restores `defaultChecked`.
 * - The thumb position mirrors when the switch itself is right-to-left (its nearest `dir`), so a
 *   switch in an LTR subtree of an RTL page keeps the LTR layout.
 * - `label` takes rich content (a link) and renders after the switch, or before or above it with
 *   `labelPosition` (the root carries `data-label-position`). Beside the label, the switch lines
 *   up with the first line of a label that wraps or has a second line. `children` are not
 *   rendered (a development warning says so).
 */
export const Switch = ({
  checked: checkedProp,
  defaultChecked = false,
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
}: SwitchProps) => {
  if (onChange !== undefined) warnDeprecated('Switch', 'onChange', 'onCheckedChange');
  const hasChildren = slotRendersContent(children);
  React.useEffect(() => {
    if (hasChildren) {
      warnOnce('Switch:children', 'Switch: children are not rendered. Pass the label in `label`.');
    }
  }, [hasChildren]);
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

  const labelText = hasLabel ? (
    <span id={labelTextId} className="text-body-1 text-foreground">
      {materialiseSlotContent(label)}
    </span>
  ) : null;
  const labelFirst = labelPosition === 'before' || labelPosition === 'above';
  // Focusable-disabled wins over `disabled`: the switch stays focusable but looks and acts disabled.
  const unavailable = disabled || disabledFocusable;

  return (
    <label
      ref={ref}
      data-label-position={labelPosition}
      className={cn(
        // items-start: the 20px track lines up with the 20px first line of a label that wraps or
        // has a second line, not with its middle.
        'relative inline-flex items-start gap-2 select-none',
        labelPosition === 'above' && 'flex-col gap-1',
        // The dimmed look lifts while a focus ring shows inside the root (the control's, under
        // disabledFocusable, or a link's in the label): opacity would dim the ring below 3:1.
        unavailable
          ? 'cursor-not-allowed opacity-50 has-focus-visible:opacity-100'
          : 'cursor-pointer',
        className,
      )}
      {...rest}
    >
      {labelFirst && labelText}
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
        role="switch"
        aria-checked={checked}
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
          // The whole control is sized in px, like the Checkbox box and the radio circle: the thumb
          // and its offsets are px, so a track in rem would stop fitting them at any root font size
          // other than 16px. The 40x20 track (1px border) leaves a 2px inset around the 14px thumb.
          // p-0 is set here, not left to the native reset, which any app button style overrides
          // (C-NATIVE): the thumb offsets assume no padding.
          'relative inline-flex h-[20px] w-[40px] shrink-0 items-center rounded-full border p-0 transition-colors duration-200 motion-reduce:transition-none',
          focusRing,
          checked
            ? cn('border-primary bg-primary', unavailable ? disabledOnTrack : onTrack)
            : cn(
                'border-stroke-accessible bg-transparent',
                unavailable ? forcedColors.disabled : forcedColors.control,
              ),
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'block h-[14px] w-[14px] rounded-full transition-transform duration-200 motion-reduce:transition-none forced-colors:forced-color-adjust-none',
            checked
              ? 'translate-x-[22px] wave-rtl:-translate-x-[22px] bg-primary-foreground'
              : 'translate-x-[2px] wave-rtl:-translate-x-[2px] bg-stroke-accessible',
            unavailable
              ? 'forced-colors:bg-[GrayText]'
              : checked
                ? 'forced-colors:bg-[HighlightText]'
                : 'forced-colors:bg-[ButtonText]',
          )}
        />
      </button>
      {!labelFirst && labelText}
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

Switch.displayName = 'Switch';
