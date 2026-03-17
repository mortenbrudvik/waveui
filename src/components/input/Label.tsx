import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size } from '../../lib/types';

/** Properties for the Label component. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Whether to show a required indicator asterisk.
   * @default false
   */
  required?: boolean;
  /** Whether the label is visually dimmed.
   * @default false
   */
  disabled?: boolean;
  /** Text size of the label.
   * @default 'medium'
   */
  size?: Extract<Size, 'small' | 'medium' | 'large'>;
  /** Font weight of the label.
   * @default 'regular'
   */
  weight?: 'regular' | 'semibold';
}

const sizeMap: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      required = false,
      disabled = false,
      size = 'medium',
      weight = 'regular',
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-foreground',
          sizeMap[size],
          weight === 'semibold' && 'font-semibold',
          disabled && 'text-muted-foreground',
          className,
        )}
        {...rest}
      >
        {children}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
  },
);
Label.displayName = 'Label';
