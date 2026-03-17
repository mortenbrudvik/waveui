import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size, Appearance } from '../../lib/types';

/** Properties for the CompoundButton component. */
export interface CompoundButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Custom element type to render as.
   * @default 'button'
   */
  as?: React.ElementType;
  /** Secondary descriptive text displayed below the main label. */
  secondaryText?: React.ReactNode;
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting padding and font size.
   * @default 'medium'
   */
  size?: Size;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'px-1.5 py-0.5 text-[10px]',
  small: 'px-2 py-1 text-xs',
  medium: 'px-3 py-2 text-sm',
  large: 'px-4 py-3 text-base',
  'extra-large': 'px-5 py-4 text-sm',
};

const appearanceClasses: Record<Appearance, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-[#115ea3] active:bg-[#0c3b5e]',
  outline:
    'border border-[#d1d1d1] bg-background text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  subtle: 'bg-transparent text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  transparent: 'bg-transparent text-primary hover:underline',
};

export const CompoundButton = React.forwardRef<HTMLButtonElement, CompoundButtonProps>(
  (
    {
      as,
      secondaryText,
      appearance = 'outline',
      size = 'medium',
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Component = as || 'button';
    return (
      <Component
        ref={ref}
        disabled={disabled}
        className={cn(
          'rounded font-semibold inline-flex flex-col items-start justify-center min-w-[96px] transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          sizeClasses[size],
          appearanceClasses[appearance],
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        <span className="font-bold">{children}</span>
        {secondaryText && (
          <span
            className={cn(
              'text-caption-1 font-normal',
              appearance === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            {secondaryText}
          </span>
        )}
      </Component>
    );
  },
);

CompoundButton.displayName = 'CompoundButton';
