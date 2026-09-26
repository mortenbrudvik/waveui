import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { AddIcon, SubtractIcon } from '../../lib/icons';
import {
  inputAppearanceClasses,
  inputFocusWithin,
  inputHeightClasses,
  inputInvalidWithin,
  inputTextClasses,
} from '../../lib/styles';
import type { CoreSize, InputAppearance } from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { isInvalidLook } from './Input';
import { useInputLook } from './inputLook';

/**
 * Props that SpinButton routes to its `<input role="spinbutton">` (C-ROUTING): the id, the ARIA
 * naming/validation attributes, native text-input attributes and the focus/keyboard handlers.
 */
export type SpinButtonInputProps = Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'id'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'aria-required'
  | 'aria-errormessage'
  | 'aria-details'
  | 'aria-valuetext'
  | 'required'
  | 'readOnly'
  | 'placeholder'
  | 'maxLength'
  | 'spellCheck'
  | 'autoComplete'
  | 'autoFocus'
  | 'inputMode'
  | 'enterKeyHint'
  | 'tabIndex'
  | 'onFocus'
  | 'onBlur'
  | 'onKeyDown'
  | 'onKeyUp'
>;

/**
 * Names of the SpinButton's step buttons, for localization. Each member is optional and falls back
 * to its English default.
 */
export interface SpinButtonLabels {
  /** Name of the button that steps up.
   * @default 'Increment'
   */
  increment?: string;
  /** Name of the button that steps down.
   * @default 'Decrement'
   */
  decrement?: string;
}

/**
 * Properties every SpinButton mode shares (every member of {@link SpinButtonProps} and
 * {@link SpinButtonAllowEmptyProps} except the value members, which differ between them).
 */
export interface SpinButtonBaseProps
  extends
    Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'onChange' | 'defaultValue' | keyof SpinButtonInputProps
    >,
    SpinButtonInputProps {
  /** Minimum allowed value.
   * @default -Infinity
   */
  min?: number;
  /** Maximum allowed value.
   * @default Infinity
   */
  max?: number;
  /** Step of the increment/decrement buttons and of ArrowUp/ArrowDown.
   * @default 1
   */
  step?: number;
  /** Step of PageUp/PageDown.
   * @default step * 10
   */
  largeStep?: number;
  /**
   * Decimals every committed value is rounded to, typed or stepped (0–20); the number is not
   * padded (use `displayValue` for `1.00`). Default: steps round to the decimals of `step` and
   * the value, typed values are kept as typed.
   */
  precision?: number;
  /** Whether the spin button is disabled and non-interactive. */
  disabled?: boolean;
  /** Form field name. With a name, the committed value is submitted with the form. */
  name?: string;
  /** Id of the form the spin button belongs to, when it is rendered outside that form. */
  form?: string;
  /**
   * Names of the −/+ step buttons (not tab stops, but in the accessibility tree), for
   * localization. Unset members keep their English defaults.
   */
  labels?: SpinButtonLabels;
  /**
   * Text shown for the value while the field is not being edited, and its `aria-valuetext` (a
   * `$1.00` for 1). While the field has focus and can be edited it shows the plain number, so
   * typing edits the number. Applies only while `value` is controlled (update it with the
   * value); Fluent's `displayValue`.
   */
  displayValue?: string;
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`.
   *
   * SpinButton is 24, 32 or 40px tall like every field; its buttons are square-ish, 24, 32 or
   * 40px wide.
   */
  size?: CoreSize;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a
   * visible label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   *
   * The step buttons keep a 1px separator from the input only in `outline`; the other
   * appearances have none.
   */
  appearance?: InputAppearance;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /** Ref to the `<input role="spinbutton">` (the focusable control). */
  controlRef?: React.Ref<HTMLInputElement>;
}

/** SpinButton props with a number value (the 0.7 shape). */
export interface SpinButtonProps extends SpinButtonBaseProps {
  /**
   * Allows an empty value (`null`). Takes the literal `true`: a `boolean` variable fits neither
   * member of the props, so branch the JSX or spread `{ allowEmpty: true, value }`.
   * @default false
   */
  allowEmpty?: false;
  /** Controlled numeric value. */
  value?: number;
  /** Initial value for uncontrolled usage (also what a form reset restores).
   * @default 0
   */
  defaultValue?: number;
  /**
   * Called with the new value when it changes: a step (buttons, arrow keys, PageUp/PageDown,
   * Home/End) or a typed value committed on blur or Enter. Not called while the user is typing,
   * nor when the value stays the same.
   */
  onValueChange?: (value: number) => void;
  /**
   * Called with the new value when it changes.
   * @deprecated Use `onValueChange`. (`onChange` is reserved for native change events.)
   */
  onChange?: (value: number) => void;
}

/** SpinButton props with `allowEmpty`: the value may be `null` (an empty field). */
export interface SpinButtonAllowEmptyProps extends SpinButtonBaseProps {
  /** The value may be `null`: clearing the text and committing it empties the field. */
  allowEmpty: true;
  /** Controlled value; `null` is an empty field. */
  value?: number | null;
  /** Initial value for uncontrolled usage (also what a form reset restores).
   * @default null
   */
  defaultValue?: number | null;
  /** Called with the new value when it changes, `null` when the field is emptied. */
  onValueChange?: (value: number | null) => void;
  /** Not available with `allowEmpty` (the deprecated alias of `onValueChange`). */
  onChange?: never;
}

/** Decimal numbers as a user types them: `12`, `-3`, `1.5`, `.5`, `2.`, `1e3`. */
const NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
/** Text on the way to a number (`-`, `.`, `-.`): not a value yet, but not an error either. */
const PARTIAL_NUMBER_TEXT = /^[+-]?\.?$/;

function parseNumberText(text: string): number | null {
  const trimmed = text.trim();
  if (!NUMBER_TEXT.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Number of decimals of `n` as written by JavaScript (`0.1` → 1, `1e-7` → 7). */
function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const [mantissa, exponent] = String(n).toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - (exponent ? Number(exponent) : 0));
}

function roundTo(n: number, decimals: number): number {
  return Number(n.toFixed(Math.min(decimals, 20)));
}

/** Per-size widths of the step buttons and the input's flex basis, and the glyph size. */
const SPIN_SIZE: Readonly<Record<CoreSize, { button: string; input: string; glyph: number }>> = {
  small: { button: 'w-6', input: 'w-10', glyph: 12 },
  medium: { button: 'w-8', input: 'w-12', glyph: 12 },
  large: { button: 'w-10', input: 'w-14', glyph: 16 },
};

const stepButtonClass = cn(
  // Padding and background set here (C-NATIVE): an app-wide `button` rule cannot fill them. The
  // size and, in `outline`, the separator are added per render (SPIN_SIZE, D13).
  'flex h-full shrink-0 items-center justify-center bg-transparent p-0 text-foreground',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  'disabled:pointer-events-none',
);

/**
 * A numeric input with decrement/increment buttons (APG spinbutton pattern).
 *
 * - **Keyboard** on the input: ArrowUp/ArrowDown step by `step`, PageUp/PageDown by `largeStep`
 *   (default ten steps), Home/End jump to `min`/`max` when they are finite (Shift+Home and
 *   Shift+End keep their native text-selection instead). The −/+ buttons are not tab stops and
 *   never take focus, so focus stays on the spinbutton and screen readers announce the new
 *   value.
 * - **Typing** edits a draft: the value is parsed, clamped and committed on blur or Enter
 *   (Escape reverts). Text that is not a number is flagged with `aria-invalid` and reverted on
 *   blur. Steps (keys and buttons) start from the typed number, and the −/+ buttons are disabled
 *   when that number is at `min`/`max`. Steps are rounded to the precision of `step` and of the
 *   value, so `0.1 + 0.2` is `0.3`; `precision` rounds every committed value, typed or stepped,
 *   to a fixed number of decimals instead, without padding it (pad with `displayValue`).
 * - **Routing**: `id`, ARIA, native input attributes and focus/keyboard handlers go to the
 *   `<input role="spinbutton">`; `className`, `style`, `data-*`, other handlers and `ref` stay on
 *   the root (`controlRef` reaches the input). Inside a `Field` it picks up the label, hint, error
 *   and required state automatically. It has no built-in name: pass `aria-label`/`aria-labelledby`
 *   or use a label (development warning otherwise).
 * - **Forms**: with `name` the committed value is submitted; `required` makes the input natively
 *   required; a form reset restores `defaultValue`.
 * - **Empty values**: `allowEmpty` lets the value become `null` (an empty field). Clearing the
 *   text and committing it (blur or Enter) sets the value to `null`, uncontrolled too; stepping
 *   up or down from an empty value starts at 0 and clamps to the nearest bound. `required` (its
 *   own, or a required Field's) still blocks submitting an empty value: the check runs on the
 *   `HiddenInput` that carries the committed value, not on the shown text, so it keeps working
 *   even when the shown text is not empty.
 * - **Display text**: `displayValue` shows formatted text (`$1.00`) for the value while the field
 *   is not being edited, and as its `aria-valuetext`; while the field has focus and can be
 *   edited it shows the plain number instead, so typing still edits the number (a consumer
 *   `aria-valuetext` always wins). It applies only while `value` is controlled: an uncontrolled
 *   spin button ignores it and warns once in development.
 * - **Size and appearance**: `size` resolves from its own prop, then the surrounding `Field`'s
 *   `size`, then `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own
 *   prop, then `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as
 *   `data-size` and `data-appearance` on the root. SpinButton takes every size the other fields
 *   do, and unlike 0.7 its root is now exactly as tall as theirs, with its step buttons and
 *   input taking up that height; sizing the root wider widens the input instead of leaving
 *   empty space inside it. The step buttons keep a 1px separator from the input only in
 *   `outline`; the other appearances have none.
 * - The −/+ buttons are named "Decrement"/"Increment"; `labels` localizes the names.
 *
 * @example
 * <SpinButton aria-label="Quantity" min={1} max={10} value={qty} onValueChange={setQty} />
 */
export const SpinButton = (props: SpinButtonProps | SpinButtonAllowEmptyProps): React.ReactNode => {
  const {
    allowEmpty = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    onChange,
    ...baseProps
  } = props as SpinButtonBaseProps & {
    allowEmpty?: boolean;
    value?: number | null;
    defaultValue?: number | null;
    onValueChange?: (value: number | null) => void;
    onChange?: (value: number) => void;
  };
  const {
    min = -Infinity,
    max = Infinity,
    step = 1,
    largeStep,
    precision,
    disabled,
    name,
    form,
    labels,
    displayValue,
    size: sizeProp,
    appearance: appearanceProp,
    className,
    hidden,
    ref,
    controlRef,
    // Routed to the input (C-ROUTING)
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    'aria-errormessage': ariaErrorMessage,
    'aria-details': ariaDetails,
    'aria-valuetext': ariaValueText,
    required,
    readOnly,
    placeholder,
    maxLength,
    spellCheck,
    autoComplete = 'off',
    autoFocus,
    inputMode,
    enterKeyHint,
    tabIndex,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    ...rest
  } = baseProps;

  if (onChange !== undefined) warnDeprecated('SpinButton', 'onChange', 'onValueChange');
  const initialValue = defaultValue !== undefined ? defaultValue : allowEmpty ? null : 0;
  const [value, setValue, isControlled] = useControllable<number | null>(
    valueProp,
    initialValue,
    (next) => {
      onValueChange?.(next);
      if (next !== null) onChange?.(next);
    },
  );

  // The text is a draft while the user types (null = show the value).
  const [draft, setDraft] = React.useState<string | null>(null);
  // A value that changes from outside replaces the draft (adjust state during render, C-HOOKS).
  const [prevValue, setPrevValue] = React.useState(value);
  if (!Object.is(prevValue, value)) {
    setPrevValue(value);
    setDraft(null);
  }
  // Phase 4 D15: whether the input currently has focus, tracked from the composed onFocus/onBlur
  // below (after the consumer's), for the displayValue formula.
  const [focused, setFocused] = React.useState(false);
  // Whether the whole text was selected right before the focus that `focused` now reflects, so
  // the effect below can reselect the whole new text once the shown text switches.
  const reselectRef = React.useRef(false);

  const draftNumber = draft === null ? null : parseNumberText(draft);
  // What stepping starts from: the typed draft when it is a number, else the value. The −/+
  // buttons are enabled by it too, so they agree with ArrowUp/ArrowDown while the user types.
  const current = draftNumber ?? value;
  const draftInvalid =
    draft !== null &&
    draftNumber === null &&
    draft.trim() !== '' &&
    !PARTIAL_NUMBER_TEXT.test(draft.trim());

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const interactive = !disabled && !readOnly;
  // Phase 4 D15: displayValue applies only while the value is controlled; while the field has
  // focus and can be edited, the plain number always shows instead (never displayValue).
  const showsDisplay = isControlled && displayValue !== undefined;
  // Phase 4 D19: a non-finite precision (NaN, Infinity) behaves as unset instead of reaching
  // roundTo, since Math.trunc(NaN) is NaN and Math.min/Math.max would otherwise carry it
  // through to `toFixed`, which treats a NaN argument as 0 (rounding to whole numbers).
  const places =
    precision === undefined || !Number.isFinite(precision)
      ? undefined
      : Math.min(20, Math.max(0, Math.trunc(precision)));

  const commit = (next: number) => {
    setDraft(null);
    const rounded = places === undefined ? next : roundTo(next, places);
    setValue(clamp(rounded));
  };

  /** Steps from the typed draft when it is a number, else from the value (0 while empty). */
  const stepBy = (delta: number) => {
    const from = current ?? 0;
    const decimals = places ?? Math.max(decimalsOf(step), decimalsOf(delta), decimalsOf(from));
    commit(roundTo(from + delta, decimals));
  };

  const commitDraft = () => {
    if (draft === null) return;
    if (allowEmpty && draft.trim() === '') {
      setDraft(null);
      setValue(null);
      return;
    }
    if (draftNumber === null) setDraft(null);
    else commit(draftNumber);
  };

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef);

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-required': ariaRequired,
      required,
    },
    { nativeRequired: true },
  );
  // Typed text that is not a number is invalid whatever the consumer says; otherwise the
  // consumer's or the Field's `aria-invalid` is passed through as is (`grammar` included), and the
  // error look follows the shared rule of the text controls.
  const ariaInvalidValue = draftInvalid ? true : fieldProps['aria-invalid'];
  const invalidLook = isInvalidLook(false, ariaInvalidValue);
  const { size, appearance } = useInputLook(sizeProp, appearanceProp);

  useFormReset(
    inputRef,
    () => {
      setDraft(null);
      setValue(initialValue);
    },
    form,
  );

  // No built-in name any more ("Value" named every instance the same): report unnamed inputs.
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const named =
      input.hasAttribute('aria-label') ||
      input.hasAttribute('aria-labelledby') ||
      (input.labels?.length ?? 0) > 0 ||
      input.hasAttribute('title');
    if (!named) {
      warnOnce(
        'SpinButton:unnamed',
        'SpinButton: the spinbutton has no accessible name. Pass `aria-label` or `aria-labelledby`, use a <label htmlFor>, or render it inside a Field.',
      );
    }
  });

  // Phase 4 D15: an uncontrolled SpinButton ignores displayValue (it would make the shown text
  // lie as soon as the value changes without a matching prop update).
  React.useEffect(() => {
    if (displayValue !== undefined && !isControlled) {
      warnOnce(
        'SpinButton:displayValue-uncontrolled',
        'SpinButton: `displayValue` is ignored while the value is uncontrolled; pass `value` (and update it in `onValueChange`).',
      );
    }
  }, [displayValue, isControlled]);

  // A stable callback, so composing it with the consumer's onFocus reads no ref during render.
  const handleFocus = useEventCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    reselectRef.current =
      input.value.length > 0 &&
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length;
    setFocused(true);
  });

  const handleBlur = () => {
    commitDraft();
    setFocused(false);
  };

  // Reselects the whole text once the shown text switches (blur shows displayValue, and a
  // programmatic focus that starts the field's editing mode shows the plain number) after a
  // focus that started with everything selected (Tab, or a consumer onFocus that calls
  // select()), so typing right after still replaces the whole value.
  React.useLayoutEffect(() => {
    if (!focused || !reselectRef.current) return;
    reselectRef.current = false;
    inputRef.current?.select();
  }, [focused]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Read-only: the keys keep their native caret behaviour and never change the value.
    if (!interactive || e.altKey || e.ctrlKey || e.metaKey) return;
    // Ten steps, rounded: step * 10 carries float error (0.07 * 10 = 0.7000000000000001) that
    // stepBy would otherwise keep, since it rounds to the precision of the delta too.
    const big = largeStep ?? roundTo(step * 10, decimalsOf(step));
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        e.preventDefault();
        const amount = e.key === 'ArrowUp' || e.key === 'ArrowDown' ? step : big;
        stepBy(e.key === 'ArrowUp' || e.key === 'PageUp' ? amount : -amount);
        return;
      }
      case 'Home':
      case 'End': {
        if (e.shiftKey) return; // Shift+Home/End select text (Fluent)
        const bound = e.key === 'Home' ? min : max;
        if (!Number.isFinite(bound)) return; // no bound: Home/End move the caret
        e.preventDefault();
        commit(bound);
        return;
      }
      case 'Enter':
        // Not prevented: Enter still submits the surrounding form, with the committed value.
        commitDraft();
        return;
      case 'Escape':
        if (draft !== null) {
          e.preventDefault(); // enclosing layers (a Dialog) ignore this Escape
          setDraft(null);
        }
        return;
      default:
    }
  };

  const defaultInputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'] =
    min < 0 ? 'text' : decimalsOf(step) > 0 || decimalsOf(min) > 0 ? 'decimal' : 'numeric';

  // The step buttons never take focus: a pointer press leaves it where it is (on the input while
  // editing), so a button that becomes disabled at a bound cannot drop focus to <body>.
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      ref={ref}
      data-size={size}
      data-appearance={appearance}
      className={cn(
        'relative inline-flex items-center',
        inputHeightClasses[size],
        inputTextClasses[size],
        inputAppearanceClasses[appearance],
        inputFocusWithin,
        invalidLook && inputInvalidWithin,
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      hidden={hidden}
      {...rest}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={keepFocus}
        onClick={() => stepBy(-step)}
        disabled={!interactive || (current !== null && current <= min)}
        aria-label={labels?.decrement ?? 'Decrement'}
        className={cn(
          stepButtonClass,
          SPIN_SIZE[size].button,
          appearance === 'outline' && 'border-e border-input',
          appearance === 'filled-darker' &&
            'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
          !disabled && 'disabled:opacity-50',
        )}
      >
        <SubtractIcon size={SPIN_SIZE[size].glyph} />
      </button>

      <input
        ref={mergedInputRef}
        type="text"
        role="spinbutton"
        inputMode={inputMode ?? defaultInputMode}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        enterKeyHint={enterKeyHint}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={spellCheck}
        tabIndex={tabIndex}
        readOnly={readOnly}
        form={form}
        {...fieldProps}
        aria-invalid={ariaInvalidValue}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        aria-valuenow={value ?? undefined}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={ariaValueText ?? (showsDisplay ? displayValue : undefined)}
        value={
          draft ??
          (showsDisplay && !(focused && interactive)
            ? displayValue
            : value === null
              ? ''
              : String(value))
        }
        onChange={(e) => setDraft(e.target.value)}
        onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
        onBlur={composeEventHandlers(onBlur, handleBlur, { checkDefaultPrevented: false })}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onKeyUp={onKeyUp}
        disabled={disabled}
        className={cn(
          'h-full min-w-0 flex-auto border-none bg-transparent text-center text-foreground focus:outline-hidden disabled:cursor-not-allowed [appearance:textfield]',
          SPIN_SIZE[size].input,
          inputTextClasses[size],
        )}
      />

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={keepFocus}
        onClick={() => stepBy(step)}
        disabled={!interactive || (current !== null && current >= max)}
        aria-label={labels?.increment ?? 'Increment'}
        className={cn(
          stepButtonClass,
          SPIN_SIZE[size].button,
          appearance === 'outline' && 'border-s border-input',
          appearance === 'filled-darker' &&
            'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
          !disabled && 'disabled:opacity-50',
        )}
      >
        <AddIcon size={SPIN_SIZE[size].glyph} />
      </button>

      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        type="text"
        value={value === null ? '' : String(value)}
        required={allowEmpty ? isRequired : undefined}
        onInvalid={() => inputRef.current?.focus()}
      />
    </div>
  );
};

SpinButton.displayName = 'SpinButton';
