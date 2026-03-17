import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';

/** Properties for the SpinButton component. */
export interface SpinButtonProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled numeric value. */
  value?: number;
  /** Initial value for uncontrolled usage.
   * @default 0
   */
  defaultValue?: number;
  /** Callback fired when the value changes. */
  onChange?: (value: number) => void;
  /** Minimum allowed value.
   * @default -Infinity
   */
  min?: number;
  /** Maximum allowed value.
   * @default Infinity
   */
  max?: number;
  /** Step increment for the increment/decrement buttons.
   * @default 1
   */
  step?: number;
  /** Whether the spin button is disabled and non-interactive. */
  disabled?: boolean;
}

export const SpinButton = (
    {
      value: controlledValue,
      defaultValue = 0,
      onChange,
      min = -Infinity,
      max = Infinity,
      step = 1,
      disabled,
      className, ref, ...rest }: SpinButtonProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [value, setValue] = useControllable(controlledValue, defaultValue, onChange);

    const clamp = (n: number) => Math.min(max, Math.max(min, n));

    const increment = () => setValue(clamp(value + step));
    const decrement = () => setValue(clamp(value - step));

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value);
      if (!Number.isNaN(parsed)) {
        setValue(clamp(parsed));
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded border border-input',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...rest}
      >
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || value <= min}
          aria-label="Decrement"
          className="flex h-8 w-8 items-center justify-center border-r border-input text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0] disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <input
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-valuenow={value}
          aria-valuemin={min === -Infinity ? undefined : min}
          aria-valuemax={max === Infinity ? undefined : max}
          value={value}
          onChange={handleInput}
          disabled={disabled}
          className="h-8 w-12 border-none bg-transparent text-center text-sm text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
          aria-label="Value"
        />

        <button
          type="button"
          onClick={increment}
          disabled={disabled || value >= max}
          aria-label="Increment"
          className="flex h-8 w-8 items-center justify-center border-l border-input text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0] disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M6 2.5v7M2.5 6h7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  };

SpinButton.displayName = 'SpinButton';
