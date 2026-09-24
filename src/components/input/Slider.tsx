import * as React from 'react';
import { cn } from '../../lib/cn';
import { focusRing } from '../../lib/styles';
import { useFieldControl } from '../../hooks/useFieldControl';

/** Properties for the Slider component. */
export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
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
  /** Ref to the `<input type="range">` element. */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * A native range input with Fluent styling: a rail drawn in the accessible stroke color (3:1
 * against the page) and a primary thumb. Inside a `Field` it picks up the label, hint, error,
 * `required` and invalid state automatically.
 *
 * @example
 * <Slider label="Volume" min={0} max={100} value={volume} onValueChange={setVolume} />
 */
export const Slider = ({
  className,
  label,
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

  const handleChange =
    onChange || onValueChange
      ? (event: React.ChangeEvent<HTMLInputElement>) => {
          onChange?.(event);
          onValueChange?.(Number(event.currentTarget.value));
        }
      : undefined;

  return (
    <input
      ref={ref}
      type="range"
      className={cn(
        'w-full cursor-pointer appearance-none bg-transparent',
        // Rail: the accessible stroke gives the rail itself 3:1 non-text contrast.
        '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-stroke-accessible',
        // Thumb
        '[&::-webkit-slider-thumb]:mt-[-8px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow',
        // Firefox rail
        '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-stroke-accessible',
        // Firefox thumb
        '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
      {...fieldProps}
      onChange={handleChange}
    />
  );
};

Slider.displayName = 'Slider';
