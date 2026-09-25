import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size, TextWeight } from '../../lib/types';

/** Properties for the Label component. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Whether to show a required indicator asterisk (hidden from assistive technology; mark the
   * control itself `required`).
   * @default false
   */
  required?: boolean;
  /** Whether the label is visually dimmed.
   * @default false
   */
  disabled?: boolean;
  /** Text size of the label: `small` = caption-1, `medium` = body-1, `large` = body-2.
   * @default 'medium'
   */
  size?: Extract<Size, 'small' | 'medium' | 'large'>;
  /** Font weight of the label (the shared `TextWeight` vocabulary).
   * @default 'regular'
   */
  weight?: TextWeight;
  /** Ref to the `<label>` element. */
  ref?: React.Ref<HTMLLabelElement>;
}

const sizeMap: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};

const weightMap: Record<TextWeight, string | undefined> = {
  regular: undefined,
  semibold: 'font-semibold',
  bold: 'font-bold',
};

/**
 * A text label for a form control (`htmlFor`), on the Fluent type ramp. The optional required
 * asterisk is decorative (`aria-hidden`). `Field` renders its own label; use `Label` for custom
 * layouts.
 *
 * @example
 * <Label htmlFor="email" required>Email</Label>
 * <Input id="email" required />
 */
export const Label = ({
  required = false,
  disabled = false,
  size = 'medium',
  weight = 'regular',
  className,
  children,
  ref,
  ...rest
}: LabelProps) => {
  return (
    <label
      ref={ref}
      className={cn(
        disabled ? 'text-muted-foreground' : 'text-foreground',
        sizeMap[size],
        weightMap[weight],
        className,
      )}
      {...rest}
    >
      {children}
      {required && (
        <span className="ms-1 text-error" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};

Label.displayName = 'Label';
