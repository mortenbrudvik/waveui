import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { focusRing, forcedColors } from '../../lib/styles';
import type { Size } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useMergedRefs } from '../../hooks/useMergedRefs';

/** Size of the thumb and rail: a small 16px thumb on a 2px rail, or the 0.7 20px thumb on a 4px rail. */
export type SliderSize = Extract<Size, 'small' | 'medium'>;

/** Properties for the Slider component. */
export interface SliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Controlled slider value. */
  value?: number;
  /** Initial value for uncontrolled usage. */
  defaultValue?: number;
  /** Native change event handler (`event.target.value` is a string). */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Called with the new value as a number on every change, next to the native `onChange`. */
  onValueChange?: (value: number) => void;
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Step increment between values. */
  step?: number;
  /**
   * Accessible label for the slider (sets `aria-label`; an explicit `aria-label` wins). Inside a
   * `Field`, leave it out so the Field's label names the slider.
   */
  label?: string;
  /**
   * Size of the thumb and rail: the 0.7 20px thumb on a 4px rail, or a small 16px thumb on a 2px
   * rail in a 24px-tall input. Unlike the text controls and pickers, Slider does not read a
   * surrounding `Field`'s size or a `WaveProvider`'s input defaults: this prop is the only source
   * of its size.
   *
   * `SliderProps` inherited the native HTML `size` attribute, which a range input ignores anyway.
   * A number is deprecated: it renders nothing (not even the native attribute), is reported once
   * in development, and is a type error from 1.0.
   * @default 'medium'
   */
  size?: SliderSize | number;
  /** Ref to the `<input type="range">` element. */
  ref?: React.Ref<HTMLInputElement>;
}

/** The CSS variable that holds how much of the rail the fill covers (`<p>%`). */
const PROGRESS_VAR = '--wave-slider-progress';

/** The share of the rail up to `value`, as a CSS percentage: 0–100, and 0 when `max <= min`. */
function progressPercent(value: number, min: number, max: number): string {
  const share = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return `${Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : 0}%`;
}

/**
 * Per-size rail and thumb classes (D14). The rail is the primary fill up to the thumb, the
 * accessible stroke after it: WebKit and Blink draw it as a gradient on the track (mirrored for
 * right-to-left), Firefox has a progress part and mirrors it itself; the track color stays
 * underneath (the whole rail without the variable). WebKit and Blink align the thumb's top with
 * the rail's top, so the thumb is pulled up by half the difference of the two heights: it stays
 * centred at any root font size. Medium keeps the 0.7 strings exactly; small substitutes a
 * thinner rail and a smaller thumb (each `[&::…]` variant written out literally, since the CSS
 * build's class scanner needs whole class names, not assembled ones).
 */
const SLIDER_SIZE: Readonly<
  Record<SliderSize, { rail: readonly string[]; thumbWebkit: string; thumbMoz: string }>
> = {
  medium: {
    rail: [
      // The rail color gives the rail itself 3:1 non-text contrast.
      '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-stroke-accessible',
      '[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      '[&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow',
    thumbMoz:
      '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow',
  },
  small: {
    rail: [
      '[&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      '[&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-stroke-accessible',
      '[&::-moz-range-progress]:h-0.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      '[&::-webkit-slider-thumb]:-mt-1.75 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow',
    thumbMoz:
      '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow',
  },
};

/**
 * Forced colors, after `forcedColors.rangeInput` (which draws the whole rail in CanvasText): the
 * filled part in Highlight; a disabled rail stays GrayText, without the fill.
 */
const forcedColorsFill = [
  'forced-colors:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,Highlight_var(--wave-slider-progress),CanvasText_var(--wave-slider-progress))]',
  'forced-colors:wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,Highlight_var(--wave-slider-progress),CanvasText_var(--wave-slider-progress))]',
  'forced-colors:[&::-moz-range-progress]:bg-[Highlight]',
  'forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-none forced-colors:disabled:[&::-moz-range-progress]:bg-[GrayText]',
];

/**
 * A native range input with Fluent styling: a rail drawn in the accessible stroke color (3:1
 * against the page), filled in the primary color up to a primary thumb; in forced-colors mode the
 * rail, fill and thumb are drawn in system colors. Inside a `Field` it picks up the label, hint,
 * validation message, `required` and invalid state automatically.
 *
 * The fill follows the value through the `--wave-slider-progress` variable on the input (also in
 * the server HTML), including the browser's snapping to `step` and a form reset.
 *
 * `size` (`small`, `medium`) sets the thumb and rail dimensions; the input carries `data-size`.
 * Slider does not read a surrounding `Field`'s size or a `WaveProvider`'s input defaults.
 *
 * @example
 * <Slider label="Volume" min={0} max={100} value={volume} onValueChange={setVolume} />
 */
export const Slider = ({
  className,
  style,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  size: sizeProp,
  form,
  onChange,
  onValueChange,
  ref,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  required,
  ...props
}: SliderProps) => {
  // D10: the deprecated numeric form of `size` never reaches the input (it was part of `...props`
  // in 0.7, which rendered it as the meaningless native `size` attribute); report it once.
  const numericSize = typeof sizeProp === 'number';
  React.useEffect(() => {
    if (numericSize) {
      warnOnce(
        'Slider:size-number',
        'Slider: a numeric `size` has no effect (a range input ignores the native attribute) and is removed in 1.0; remove it.',
      );
    }
  }, [numericSize]);
  // Any other value (an unknown string from untyped code) also resolves to medium, so the classes
  // and `data-size` always agree.
  const size: SliderSize = sizeProp === 'small' ? 'small' : 'medium';
  const sizeClasses = SLIDER_SIZE[size];

  const fieldProps = useFieldControl(
    {
      id,
      'aria-label': ariaLabel ?? label,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-required': ariaRequired,
      required,
    },
    { nativeRequired: true },
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(inputRef, ref);
  const rangeMin = min ?? 0;
  const rangeMax = max ?? 100;
  // During render (and on the server): the value, else the default, else the native midpoint.
  const renderedProgress = progressPercent(
    value ?? defaultValue ?? rangeMin + (rangeMax - rangeMin) / 2,
    rangeMin,
    rangeMax,
  );

  /** Writes the fill of the value the input really has (the browser snaps it to `step`). */
  const updateFill = useEventCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const next = progressPercent(Number(input.value), rangeMin, rangeMax);
    if (input.style.getPropertyValue(PROGRESS_VAR) !== next) {
      input.style.setProperty(PROGRESS_VAR, next);
    }
  });

  // On mount and whenever the value or its range changes: React wrote the variable from the props,
  // the input may hold another value (step snapping, an uncontrolled value the user moved).
  React.useLayoutEffect(() => {
    updateFill();
  }, [value, defaultValue, min, max, step, updateFill]);

  // The reset event fires before the form restores the value: read it a microtask later.
  useFormReset(inputRef, () => queueMicrotask(updateFill), form);

  const handleChange = composeEventHandlers(
    onChange,
    (event: React.ChangeEvent<HTMLInputElement>) => {
      // A controlled fill follows `value` (a parent that rejects the change keeps it).
      if (value === undefined) updateFill();
      onValueChange?.(Number(event.currentTarget.value));
    },
    { checkDefaultPrevented: false },
  );

  return (
    <input
      ref={mergedRef}
      type="range"
      className={cn(
        'w-full cursor-pointer appearance-none bg-transparent',
        // A 24px-tall input at the small size, the rail centred in it (D14).
        size === 'small' && 'h-6',
        sizeClasses.rail,
        sizeClasses.thumbWebkit,
        sizeClasses.thumbMoz,
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        // Forced colors replace the author backgrounds of the rail and thumb with Canvas: give
        // every part a system color instead.
        forcedColors.rangeInput,
        forcedColorsFill,
        className,
      )}
      style={{ ...style, [PROGRESS_VAR]: renderedProgress } as React.CSSProperties}
      value={value}
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      form={form}
      data-size={size}
      {...props}
      {...fieldProps}
      onChange={handleChange}
    />
  );
};

Slider.displayName = 'Slider';
