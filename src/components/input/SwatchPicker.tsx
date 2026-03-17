import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import type { Size } from '../../lib/types';

/** Represents a single color swatch option. */
export interface SwatchItem {
  /** Unique identifier for the swatch. */
  value: string;
  /** CSS color value (e.g., hex, rgb) used as the swatch background. */
  color: string;
  /** Accessible label for the swatch. */
  label?: string;
}

/** Properties for the SwatchPicker component. */
export interface SwatchPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Array of swatch items to display. */
  items: SwatchItem[];
  /** Controlled selected swatch value. */
  value?: string;
  /** Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /** Callback fired when a swatch is selected. */
  onChange?: (value: string) => void;
  /** Size of each swatch button.
   * @default 'medium'
   */
  size?: Extract<Size, 'small' | 'medium' | 'large'>;
  /** Shape of each swatch button.
   * @default 'circular'
   */
  shape?: 'circular' | 'square' | 'rounded';
}

const sizeMap: Record<'small' | 'medium' | 'large', string> = {
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-10 h-10',
};

const shapeMap = {
  circular: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded',
};

export const SwatchPicker = (
    {
      items,
      value: controlledValue,
      defaultValue = '',
      onChange,
      size = 'medium',
      shape = 'circular',
      className, ref, ...rest }: SwatchPickerProps & { ref?: React.Ref<HTMLDivElement> }) => {
    const [value, setValue] = useControllable(controlledValue, defaultValue, onChange);

    return (
      <div
        ref={ref}
        role="radiogroup"
        aria-label="Color picker"
        className={cn('flex flex-wrap gap-2', className)}
        {...rest}
      >
        {items.map((item) => {
          const isSelected = value === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={item.label || item.color}
              onClick={() => setValue(item.value)}
              className={cn(
                sizeMap[size],
                shapeMap[shape],
                'relative border-2 transition-all flex items-center justify-center flex-shrink-0',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                isSelected
                  ? 'border-primary shadow-2'
                  : 'border-transparent hover:border-[#c0c0c0]',
              )}
              style={{ backgroundColor: item.color }}
            >
              {isSelected && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  className="drop-shadow-sm"
                >
                  <path
                    d="M3 7l3 3 5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  };

SwatchPicker.displayName = 'SwatchPicker';
