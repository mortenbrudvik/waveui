import * as React from 'react';
import { cn } from '../../lib/cn';
import { useControllable } from '../../hooks/useControllable';
import { renderSlot } from '../../lib/slot';
import type { Size, Appearance, Slot } from '../../lib/types';

/** Properties for the ToggleButton component. */
export interface ToggleButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  /** Controlled pressed state. */
  pressed?: boolean;
  /** Initial pressed state for uncontrolled usage.
   * @default false
   */
  defaultPressed?: boolean;
  /** Callback fired when the pressed state changes. */
  onPressedChange?: (pressed: boolean) => void;
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /** Icon slot rendered before the button label. */
  icon?: Slot<'span'>;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 px-1.5 text-[10px]',
  small: 'h-6 px-2 text-xs',
  medium: 'h-8 px-3 text-sm',
  large: 'h-10 px-4 text-base',
  'extra-large': 'h-12 px-5 text-sm',
};

const pressedClasses: Record<Appearance, string> = {
  primary: 'bg-[#0c3b5e] text-primary-foreground',
  outline: 'bg-[#ebf3fc] border border-primary text-primary',
  subtle: 'bg-[#ebf3fc] text-primary',
  transparent: 'bg-[#ebf3fc] text-primary',
};

const appearanceClasses: Record<Appearance, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-[#115ea3] active:bg-[#0c3b5e]',
  outline:
    'border border-[#d1d1d1] bg-background text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  subtle: 'bg-transparent text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  transparent: 'bg-transparent text-primary hover:underline',
};

export const ToggleButton = React.forwardRef<HTMLButtonElement, ToggleButtonProps>(
  (
    {
      pressed,
      defaultPressed = false,
      onPressedChange,
      appearance = 'outline',
      size = 'medium',
      icon,
      disabled,
      className,
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [isPressed, setIsPressed] = useControllable(pressed, defaultPressed, onPressedChange);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsPressed(!isPressed);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        aria-pressed={isPressed}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'rounded font-semibold inline-flex items-center justify-center min-w-[96px] transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          sizeClasses[size],
          isPressed ? pressedClasses[appearance] : appearanceClasses[appearance],
          icon && children && 'gap-1.5',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {renderSlot(icon, 'span', 'shrink-0')}
        {children}
      </button>
    );
  },
);

ToggleButton.displayName = 'ToggleButton';
