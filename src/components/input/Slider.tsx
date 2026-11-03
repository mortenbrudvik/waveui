import * as React from 'react';
import { sliderClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { focusRing, forcedColors } from '../../lib/styles';
import type { Orientation, Size } from '../../lib/types';
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
   * @default 'medium'
   */
  size?: SliderSize;
  /**
   * Direction of the rail (Fluent UI's `vertical` flag, named as the other components name it):
   * `horizontal`, or `vertical`, which runs the rail up with the minimum at the bottom, sets
   * `aria-orientation="vertical"` and gives the slider a default height of 8rem (set another with
   * `className="h-48"`; a vertical slider is as wide as its thumb). The up and right arrow keys
   * raise the value in both. A vertical slider does not mirror in a right-to-left page. It needs a browser that lays a range input out in a vertical
   * writing mode (recent Chrome, Edge, Firefox and Safari); an older one draws it horizontally.
   * @default 'horizontal'
   */
  orientation?: Orientation;
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
      'wave:[&::-webkit-slider-runnable-track]:h-1 wave:[&::-webkit-slider-runnable-track]:rounded-full wave:[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      'wave:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:[&::-moz-range-track]:h-1 wave:[&::-moz-range-track]:rounded-full wave:[&::-moz-range-track]:bg-stroke-accessible',
      'wave:[&::-moz-range-progress]:h-1 wave:[&::-moz-range-progress]:rounded-full wave:[&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      'wave:[&::-webkit-slider-thumb]:-mt-2 wave:[&::-webkit-slider-thumb]:h-5 wave:[&::-webkit-slider-thumb]:w-5 wave:[&::-webkit-slider-thumb]:appearance-none wave:[&::-webkit-slider-thumb]:rounded-full wave:[&::-webkit-slider-thumb]:border-2 wave:[&::-webkit-slider-thumb]:border-background wave:[&::-webkit-slider-thumb]:bg-primary wave:[&::-webkit-slider-thumb]:shadow',
    thumbMoz:
      'wave:[&::-moz-range-thumb]:h-5 wave:[&::-moz-range-thumb]:w-5 wave:[&::-moz-range-thumb]:rounded-full wave:[&::-moz-range-thumb]:border-2 wave:[&::-moz-range-thumb]:border-background wave:[&::-moz-range-thumb]:bg-primary wave:[&::-moz-range-thumb]:shadow',
  },
  small: {
    rail: [
      'wave:[&::-webkit-slider-runnable-track]:h-0.5 wave:[&::-webkit-slider-runnable-track]:rounded-full wave:[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      'wave:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:[&::-moz-range-track]:h-0.5 wave:[&::-moz-range-track]:rounded-full wave:[&::-moz-range-track]:bg-stroke-accessible',
      'wave:[&::-moz-range-progress]:h-0.5 wave:[&::-moz-range-progress]:rounded-full wave:[&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      'wave:[&::-webkit-slider-thumb]:-mt-1.75 wave:[&::-webkit-slider-thumb]:h-4 wave:[&::-webkit-slider-thumb]:w-4 wave:[&::-webkit-slider-thumb]:appearance-none wave:[&::-webkit-slider-thumb]:rounded-full wave:[&::-webkit-slider-thumb]:border-2 wave:[&::-webkit-slider-thumb]:border-background wave:[&::-webkit-slider-thumb]:bg-primary wave:[&::-webkit-slider-thumb]:shadow',
    thumbMoz:
      'wave:[&::-moz-range-thumb]:h-4 wave:[&::-moz-range-thumb]:w-4 wave:[&::-moz-range-thumb]:rounded-full wave:[&::-moz-range-thumb]:border-2 wave:[&::-moz-range-thumb]:border-background wave:[&::-moz-range-thumb]:bg-primary wave:[&::-moz-range-thumb]:shadow',
  },
};

/**
 * The vertical twin of {@link SLIDER_SIZE}: the rail's thickness is its width (a vertical writing
 * mode turns the rail's length into its height), the fill runs up from the minimum at the bottom
 * (no right-to-left variant: the input sets its own direction), and the WebKit thumb is pulled
 * back by half the difference of the two thicknesses along the block axis, `margin-block-start`.
 */
const SLIDER_VERTICAL: Readonly<
  Record<
    SliderSize,
    { rail: readonly string[]; thumbWebkit: string; thumbMoz: string; box: string }
  >
> = {
  medium: {
    rail: [
      'wave:[&::-webkit-slider-runnable-track]:w-1 wave:[&::-webkit-slider-runnable-track]:rounded-full wave:[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      'wave:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_top,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:[&::-moz-range-track]:w-1 wave:[&::-moz-range-track]:rounded-full wave:[&::-moz-range-track]:bg-stroke-accessible',
      'wave:[&::-moz-range-progress]:w-1 wave:[&::-moz-range-progress]:rounded-full wave:[&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      'wave:[&::-webkit-slider-thumb]:[margin-block-start:-0.5rem] wave:[&::-webkit-slider-thumb]:h-5 wave:[&::-webkit-slider-thumb]:w-5 wave:[&::-webkit-slider-thumb]:appearance-none wave:[&::-webkit-slider-thumb]:rounded-full wave:[&::-webkit-slider-thumb]:border-2 wave:[&::-webkit-slider-thumb]:border-background wave:[&::-webkit-slider-thumb]:bg-primary wave:[&::-webkit-slider-thumb]:shadow',
    thumbMoz: SLIDER_SIZE.medium.thumbMoz,
    box: 'wave:w-5',
  },
  small: {
    rail: [
      'wave:[&::-webkit-slider-runnable-track]:w-0.5 wave:[&::-webkit-slider-runnable-track]:rounded-full wave:[&::-webkit-slider-runnable-track]:bg-stroke-accessible',
      'wave:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_top,var(--wave-primary)_var(--wave-slider-progress),var(--wave-stroke-accessible)_var(--wave-slider-progress))]',
      'wave:[&::-moz-range-track]:w-0.5 wave:[&::-moz-range-track]:rounded-full wave:[&::-moz-range-track]:bg-stroke-accessible',
      'wave:[&::-moz-range-progress]:w-0.5 wave:[&::-moz-range-progress]:rounded-full wave:[&::-moz-range-progress]:bg-primary',
    ],
    thumbWebkit:
      'wave:[&::-webkit-slider-thumb]:[margin-block-start:-0.4375rem] wave:[&::-webkit-slider-thumb]:h-4 wave:[&::-webkit-slider-thumb]:w-4 wave:[&::-webkit-slider-thumb]:appearance-none wave:[&::-webkit-slider-thumb]:rounded-full wave:[&::-webkit-slider-thumb]:border-2 wave:[&::-webkit-slider-thumb]:border-background wave:[&::-webkit-slider-thumb]:bg-primary wave:[&::-webkit-slider-thumb]:shadow',
    thumbMoz: SLIDER_SIZE.small.thumbMoz,
    box: 'wave:w-6',
  },
};

/**
 * Forced colors, after `forcedColors.rangeInput` (which draws the whole rail in CanvasText): the
 * filled part in Highlight; a disabled rail stays GrayText, without the fill.
 */
const forcedColorsFill = [
  'wave:forced-colors:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,Highlight_var(--wave-slider-progress),CanvasText_var(--wave-slider-progress))]',
  'wave:forced-colors:wave-rtl:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_left,Highlight_var(--wave-slider-progress),CanvasText_var(--wave-slider-progress))]',
  'wave:forced-colors:[&::-moz-range-progress]:bg-[Highlight]',
  'wave:forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-none wave:forced-colors:disabled:[&::-moz-range-progress]:bg-[GrayText]',
];

/** {@link forcedColorsFill} for a vertical rail: the fill runs up, with no right-to-left twin. */
const forcedColorsFillVertical = [
  'wave:forced-colors:[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_top,Highlight_var(--wave-slider-progress),CanvasText_var(--wave-slider-progress))]',
  'wave:forced-colors:[&::-moz-range-progress]:bg-[Highlight]',
  'wave:forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-none wave:forced-colors:disabled:[&::-moz-range-progress]:bg-[GrayText]',
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
 * `orientation="vertical"` runs the rail up (see its docs); the input carries `data-orientation`.
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
  orientation: orientationProp,
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
  // Any other value (an unknown string or a number from untyped code) resolves to medium, so the
  // classes and `data-size` always agree; `size` never reaches the input.
  const size: SliderSize = sizeProp === 'small' ? 'small' : 'medium';
  const vertical = orientationProp === 'vertical';
  const sizeClasses = vertical ? SLIDER_VERTICAL[size] : SLIDER_SIZE[size];
  const boxClasses = vertical ? SLIDER_VERTICAL[size].box : undefined;

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
      className={wcn(
        sliderClassNames.root,
        vertical
          ? // A vertical writing mode, the minimum at the bottom; as wide as its thumb, 8rem tall.
            'wave:h-32 wave:cursor-pointer wave:appearance-none wave:bg-transparent wave:[writing-mode:vertical-lr] wave:[direction:rtl]'
          : 'wave:w-full wave:cursor-pointer wave:appearance-none wave:bg-transparent',
        // A 24px-tall input at the small size, the rail centred in it (D14).
        !vertical && size === 'small' && 'wave:h-6',
        boxClasses,
        sizeClasses.rail,
        sizeClasses.thumbWebkit,
        sizeClasses.thumbMoz,
        'wave:disabled:cursor-not-allowed wave:disabled:opacity-50',
        focusRing,
        // Forced colors replace the author backgrounds of the rail and thumb with Canvas: give
        // every part a system color instead.
        forcedColors.rangeInput,
        vertical ? forcedColorsFillVertical : forcedColorsFill,
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
      data-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-orientation={vertical ? 'vertical' : undefined}
      {...props}
      {...fieldProps}
      onChange={handleChange}
    />
  );
};

Slider.displayName = 'Slider';
