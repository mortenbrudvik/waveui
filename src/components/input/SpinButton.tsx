import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { AddIcon, SubtractIcon } from '../../lib/icons';
import { inputFocusWithin, inputInvalidWithin } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';

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

/** Properties for the SpinButton component. */
export interface SpinButtonProps
  extends
    Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'onChange' | 'defaultValue' | keyof SpinButtonInputProps
    >,
    SpinButtonInputProps {
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
  /** Whether the spin button is disabled and non-interactive. */
  disabled?: boolean;
  /** Form field name. With a name, the committed value is submitted with the form. */
  name?: string;
  /** Id of the form the spin button belongs to, when it is rendered outside that form. */
  form?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
  /** Ref to the `<input role="spinbutton">` (the focusable control). */
  controlRef?: React.Ref<HTMLInputElement>;
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

const stepButtonClass = cn(
  'flex h-8 w-8 shrink-0 items-center justify-center border-input text-foreground',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  'disabled:pointer-events-none',
);

/**
 * A numeric input with decrement/increment buttons (APG spinbutton pattern).
 *
 * - **Keyboard** on the input: ArrowUp/ArrowDown step by `step`, PageUp/PageDown by `largeStep`
 *   (default ten steps), Home/End jump to `min`/`max` when they are finite. The −/+ buttons are
 *   not tab stops and never take focus, so focus stays on the spinbutton and screen readers
 *   announce the new value.
 * - **Typing** edits a draft: the value is parsed, clamped and committed on blur or Enter
 *   (Escape reverts). Text that is not a number is flagged with `aria-invalid` and reverted on
 *   blur. Steps (keys and buttons) start from the typed number, and the −/+ buttons are disabled
 *   when that number is at `min`/`max`. Steps are rounded to the precision of `step` and of the
 *   value, so `0.1 + 0.2` is `0.3`.
 * - **Routing**: `id`, ARIA, native input attributes and focus/keyboard handlers go to the
 *   `<input role="spinbutton">`; `className`, `style`, `data-*`, other handlers and `ref` stay on
 *   the root (`controlRef` reaches the input). Inside a `Field` it picks up the label, hint, error
 *   and required state automatically. It has no built-in name: pass `aria-label`/`aria-labelledby`
 *   or use a label (development warning otherwise).
 * - **Forms**: with `name` the committed value is submitted; `required` makes the input natively
 *   required; a form reset restores `defaultValue`.
 *
 * @example
 * <SpinButton aria-label="Quantity" min={1} max={10} value={qty} onValueChange={setQty} />
 */
export const SpinButton = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  largeStep,
  disabled,
  name,
  form,
  className,
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
}: SpinButtonProps) => {
  if (onChange !== undefined) warnDeprecated('SpinButton', 'onChange', 'onValueChange');
  const initialValue = defaultValue ?? 0;
  const [value, setValue] = useControllable(valueProp, initialValue, (next: number) => {
    onValueChange?.(next);
    onChange?.(next);
  });

  // The text is a draft while the user types (null = show the value).
  const [draft, setDraft] = React.useState<string | null>(null);
  // A value that changes from outside replaces the draft (adjust state during render, C-HOOKS).
  const [prevValue, setPrevValue] = React.useState(value);
  if (!Object.is(prevValue, value)) {
    setPrevValue(value);
    setDraft(null);
  }

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

  const commit = (next: number) => {
    setDraft(null);
    setValue(clamp(next));
  };

  /** Steps from the typed draft when it is a number, else from the value. */
  const stepBy = (delta: number) => {
    const precision = Math.max(decimalsOf(step), decimalsOf(delta), decimalsOf(current));
    commit(roundTo(current + delta, precision));
  };

  const commitDraft = () => {
    if (draft === null) return;
    if (draftNumber === null) setDraft(null);
    else commit(draftNumber);
  };

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedInputRef = useMergedRefs(inputRef, controlRef);

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
  const resolvedInvalid = draftInvalid || fieldProps['aria-invalid'];
  const invalid =
    resolvedInvalid !== undefined && resolvedInvalid !== false && resolvedInvalid !== 'false';

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
        const size = e.key === 'ArrowUp' || e.key === 'ArrowDown' ? step : big;
        stepBy(e.key === 'ArrowUp' || e.key === 'PageUp' ? size : -size);
        return;
      }
      case 'Home':
      case 'End': {
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
      className={cn(
        'relative inline-flex items-center rounded border border-input border-b-stroke-accessible bg-background',
        inputFocusWithin,
        invalid && inputInvalidWithin,
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      {...rest}
    >
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={keepFocus}
        onClick={() => stepBy(-step)}
        disabled={!interactive || current <= min}
        aria-label="Decrement"
        className={cn(stepButtonClass, 'border-e', !disabled && 'disabled:opacity-50')}
      >
        <SubtractIcon size={12} />
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
        aria-invalid={invalid || undefined}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={ariaValueText}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={onFocus}
        onBlur={composeEventHandlers(onBlur, commitDraft, { checkDefaultPrevented: false })}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onKeyUp={onKeyUp}
        disabled={disabled}
        className="h-8 w-12 min-w-0 border-none bg-transparent text-center text-body-1 text-foreground focus:outline-hidden disabled:cursor-not-allowed [appearance:textfield]"
      />

      <button
        type="button"
        tabIndex={-1}
        onMouseDown={keepFocus}
        onClick={() => stepBy(step)}
        disabled={!interactive || current >= max}
        aria-label="Increment"
        className={cn(stepButtonClass, 'border-s', !disabled && 'disabled:opacity-50')}
      >
        <AddIcon size={12} />
      </button>

      <HiddenInput name={name} form={form} disabled={disabled} value={String(value)} />
    </div>
  );
};

SpinButton.displayName = 'SpinButton';
