import * as React from 'react';
import { cn } from '../../lib/cn';
import { renderSlot } from '../../lib/slot';
import type { Size, Appearance, Slot } from '../../lib/types';

/** Properties for the MenuButton component. */
export interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
  /** Custom icon slot for the menu chevron indicator. */
  menuIcon?: Slot<'span'>;
  /** Whether the associated menu is currently expanded. */
  expanded?: boolean;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 px-1.5 text-[10px]',
  small: 'h-6 px-2 text-xs',
  medium: 'h-8 px-3 text-sm',
  large: 'h-10 px-4 text-base',
  'extra-large': 'h-12 px-5 text-sm',
};

const appearanceClasses: Record<Appearance, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-[#115ea3] active:bg-[#0c3b5e]',
  outline:
    'border border-[#d1d1d1] bg-background text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  subtle: 'bg-transparent text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  transparent: 'bg-transparent text-primary hover:underline',
};

const DefaultChevronDown = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M2.22 4.47a.75.75 0 0 1 1.06 0L6 7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06L6.53 8.78a.75.75 0 0 1-1.06 0L2.22 5.53a.75.75 0 0 1 0-1.06Z"
      fill="currentColor"
    />
  </svg>
);

export const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  (
    {
      appearance = 'outline',
      size = 'medium',
      icon,
      menuIcon,
      expanded,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={expanded}
        className={cn(
          'rounded font-semibold inline-flex items-center justify-center min-w-[96px] transition-colors gap-1.5',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          sizeClasses[size],
          appearanceClasses[appearance],
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {renderSlot(icon, 'span', 'shrink-0')}
        {children}
        {menuIcon != null ? renderSlot(menuIcon, 'span', 'shrink-0') : <DefaultChevronDown />}
      </button>
    );
  },
);

MenuButton.displayName = 'MenuButton';
