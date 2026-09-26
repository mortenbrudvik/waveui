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

// Phase 4 D18, Fluent's timing (`DEFAULT_SPIN_DELAY_MS`, `MIN_SPIN_DELAY_MS`, `MAX_SPIN_TIME_MS`)
// without its step on the press itself.
/** Delay before a press becomes a hold, and the first delay between repeats (ms). */
const SPIN_DELAY = 300;
/** The shortest delay between repeats, reached after SPIN_RAMP ms of holding. */
const SPIN_MIN_DELAY = 80;
/** How long into a hold the delay between repeats takes to ease down to SPIN_MIN_DELAY (ms). */
const SPIN_RAMP = 1000;

/** The delay after a step taken `elapsed` ms into a hold: 300ms easing linearly to 80ms. */
function spinDelay(elapsed: number): number {
  const t = Math.min(1, elapsed / SPIN_RAMP);
  return Math.round(SPIN_DELAY + (SPIN_MIN_DELAY - SPIN_DELAY) * t);
}

/**
 * Runs the timers of a hold: calls `step` once SPIN_DELAY has passed, then again after each
 * `spinDelay` (steps at 300, 534, 717, 859, 970 and 1057ms, then every 80ms), until `step` returns
 * false or the returned function is called.
 */
function startSpin(step: () => boolean): () => void {
  let elapsed = SPIN_DELAY;
  let timer = setTimeout(function tick() {
    if (!step()) return;
    const delay = spinDelay(elapsed);
    elapsed += delay;
    timer = setTimeout(tick, delay);
  }, SPIN_DELAY);
  return () => clearTimeout(timer);
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
  // A finger holding a button (D18): no double-tap zoom, text selection or iOS callout.
  'touch-manipulation select-none [-webkit-touch-callout:none]',
);

/**
 * A numeric input with decrement/increment buttons (APG spinbutton pattern).
 *
 * - **Keyboard** on the input: ArrowUp/ArrowDown step by `step`, PageUp/PageDown by `largeStep`
 *   (default ten steps), Home/End jump to `min`/`max` when they are finite (Shift+Home and
 *   Shift+End keep their native text-selection instead). The −/+ buttons are not tab stops and
 *   never take focus, so focus stays on the spinbutton and screen readers announce the new
 *   value.
 * - **Pointer** on the −/+ buttons (mouse, touch or pen): a short press steps once, on release
 *   (its click), never on the press alone, so a finger that starts a scroll on a button changes
 *   nothing. Holding a button repeats the step: the first after 300ms, then faster, every 80ms
 *   after about a second (Fluent's timing). A hold stops when the button is released, the
 *   pointer leaves it or the press turns into a scroll, at the bound, when the window loses
 *   focus, and when the spin button becomes disabled or read-only. Only the primary button of a
 *   primary pointer holds: a second finger, a secondary button or a Ctrl+press with a mouse (the
 *   secondary click on macOS) neither starts a hold nor ends one. A click without a press (a
 *   screen reader, `element.click()`) steps once. The buttons open no context menu (a long press
 *   on touch would), show no iOS callout, and allow no text selection or double-tap zoom.
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

  /** The value one step of `delta` from `from` (0 while empty), rounded and clamped. */
  const stepFrom = (from: number | null, delta: number) => {
    const base = from ?? 0;
    const decimals = places ?? Math.max(decimalsOf(step), decimalsOf(delta), decimalsOf(base));
    return clamp(roundTo(base + delta, decimals));
  };

  /** Steps from the typed draft when it is a number, else from the value (0 while empty). */
  const stepBy = (delta: number) => {
    setDraft(null);
    setValue(stepFrom(current, delta));
  };

  // Phase 4 D18: a press on a step button becomes a hold after SPIN_DELAY and then repeats
  // (startSpin runs the timers); a shorter press steps on its click (WCAG 2.5.2).
  const holdRef = React.useRef<{
    /** The pointer holding the button: only its release, cancel or leave ends the hold. */
    pointerId: number;
    direction: 1 | -1;
    /** Whether the hold has stepped yet. */
    stepped: boolean;
    stop: () => void;
  } | null>(null);
  // Whether the press that ends in the next pointer click has repeated (reset by every press of
  // a primary pointer).
  const repeatedRef = React.useRef(false);

  const stopHold = React.useCallback(() => {
    holdRef.current?.stop();
    holdRef.current = null;
  }, []);

  /** Ends the hold on a pointerup, pointercancel or pointerleave of the pointer holding it. */
  const endHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId === holdRef.current?.pointerId) stopHold();
  };

  /** Whether the value the user sees is at the bound a step in `direction` moves towards. */
  const atBound = (direction: 1 | -1) =>
    current !== null && (direction === 1 ? current >= max : current <= min);

  // One step of the hold, with the latest render's values; returns false to end the hold.
  const holdStep = useEventCallback((): boolean => {
    const hold = holdRef.current;
    if (!hold) return false;
    if (!interactive || atBound(hold.direction)) {
      stopHold();
      return false;
    }
    repeatedRef.current = true;
    const delta = hold.direction * step;
    if (hold.stepped) {
      // Later steps start from what useControllable's updater gets, never from this render's
      // closure: a value set earlier in the same task (several steps can run before React
      // renders), else the rendered one, so a controlled parent that ignored a step is stepped
      // from its own value again.
      setDraft(null);
      setValue((prev) => stepFrom(prev, delta));
    } else {
      // The first step starts where a click would: from the typed number, else the value.
      hold.stepped = true;
      stepBy(delta);
    }
    return true;
  });

  const startHold = (event: React.PointerEvent<HTMLButtonElement>, direction: 1 | -1) => {
    // Only a primary pointer presses a step button: a second finger (which gets no click) neither
    // starts a hold nor resets the flag of the press that holds one.
    if (!event.isPrimary) return;
    // Every press resets the flag, so a hold that ended without a click (at a bound, or a touch
    // long press) cannot swallow the click of a later press.
    repeatedRef.current = false;
    // A hold needs the primary button: not a secondary one, nor a Ctrl+press with a mouse (the
    // secondary click on macOS).
    if (event.button !== 0 || (event.pointerType === 'mouse' && event.ctrlKey) || !interactive) {
      return;
    }
    // Touch and pen capture the pointer implicitly on the element the press landed on (the glyph
    // when the finger lands on it); release it there, so pointerleave fires when the finger slides
    // off the button.
    const holder = event.target instanceof Element ? event.target : event.currentTarget;
    if (event.pointerType !== 'mouse' && holder.hasPointerCapture?.(event.pointerId)) {
      holder.releasePointerCapture(event.pointerId);
    }
    stopHold();
    holdRef.current = {
      pointerId: event.pointerId,
      direction,
      stepped: false,
      stop: startSpin(holdStep),
    };
  };

  const clickStep = (event: React.MouseEvent<HTMLButtonElement>, direction: 1 | -1) => {
    // A click without a press (detail 0: a screen reader, element.click()) steps once; a pointer
    // click steps unless its press already repeated.
    if (event.detail !== 0 && repeatedRef.current) {
      repeatedRef.current = false;
      return;
    }
    stepBy(direction * step);
  };

  // A hold stops once the control cannot step its way any more: disabled, read-only, or at the
  // bound it steps towards (where its button is disabled).
  React.useEffect(() => {
    const hold = holdRef.current;
    if (hold && (!interactive || atBound(hold.direction))) stopHold();
  });
  // It also stops when the window loses focus (a release outside it never reaches the button),
  // and on unmount.
  React.useEffect(() => {
    window.addEventListener('blur', stopHold);
    return () => {
      window.removeEventListener('blur', stopHold);
      stopHold();
    };
  }, [stopHold]);

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
        onPointerDown={(event) => startHold(event, -1)}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerLeave={endHold}
        onClick={(event) => clickStep(event, -1)}
        onMouseDown={keepFocus}
        onContextMenu={(event) => event.preventDefault()}
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
        onPointerDown={(event) => startHold(event, 1)}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerLeave={endHold}
        onClick={(event) => clickStep(event, 1)}
        onMouseDown={keepFocus}
        onContextMenu={(event) => event.preventDefault()}
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
