import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size, Appearance } from '../../lib/types';

/** Properties for the SplitButton component. */
export interface SplitButtonProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Whether the split button is disabled. */
  disabled?: boolean;
  /** Visual style variant.
   * @default 'outline'
   */
  appearance?: Appearance;
  /** Size affecting padding and font size.
   * @default 'medium'
   */
  size?: Size;
  /** Click handler for the primary button action. */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Click handler for the secondary menu chevron button. */
  onMenuClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 px-1.5 text-[10px]',
  small: 'h-6 px-2 text-xs',
  medium: 'h-8 px-3 text-sm',
  large: 'h-10 px-4 text-base',
  'extra-large': 'h-12 px-5 text-sm',
};

const menuSizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 px-0.5',
  small: 'h-6 px-1',
  medium: 'h-8 px-2',
  large: 'h-10 px-2',
  'extra-large': 'h-12 px-3',
};

const appearanceClasses: Record<Appearance, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[#115ea3] active:bg-[#0c3b5e]',
  outline:
    'border border-[#d1d1d1] bg-background text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  subtle: 'bg-transparent text-foreground hover:bg-[#f5f5f5] active:bg-[#e0e0e0]',
  transparent: 'bg-transparent text-primary hover:underline',
};

const separatorClasses: Record<Appearance, string> = {
  primary: 'border-l border-[rgba(255,255,255,0.3)]',
  outline: 'border-l border-[#d1d1d1]',
  subtle: 'border-l border-[#d1d1d1]',
  transparent: 'border-l border-[#d1d1d1]',
};

const ChevronDown = () => (
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

export const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
  (
    {
      appearance = 'outline',
      size = 'medium',
      disabled,
      className,
      children,
      onClick,
      onMenuClick,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} role="group" className={cn('inline-flex', className)} {...props}>
        <button
          type="button"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'rounded-l font-semibold inline-flex items-center justify-center min-w-[96px] transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            sizeClasses[size],
            appearanceClasses[appearance],
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {children}
        </button>
        <button
          disabled={disabled}
          onClick={onMenuClick}
          aria-label="More options"
          aria-haspopup="menu"
          className={cn(
            'rounded-r inline-flex items-center justify-center transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            menuSizeClasses[size],
            appearanceClasses[appearance],
            separatorClasses[appearance],
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <ChevronDown />
        </button>
      </div>
    );
  },
);

SplitButton.displayName = 'SplitButton';
