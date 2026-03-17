import * as React from 'react';
import { cn } from '../../lib/cn';
import type { BadgeAppearance, BadgeColor, Size } from '../../lib/types';

/** Properties for the Badge component. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual style of the badge.
   * @default 'filled'
   */
  appearance?: BadgeAppearance;
  /** Semantic color of the badge.
   * @default 'brand'
   */
  color?: BadgeColor;
  /** Size of the badge.
   * @default 'medium'
   */
  size?: Size;
}

const colorMap: Record<
  BadgeColor,
  { bg: string; text: string; tintBg: string; tintText: string; border: string }
> = {
  brand: {
    bg: 'bg-primary',
    text: 'text-white',
    tintBg: 'bg-[#ebf3fc]',
    tintText: 'text-[#0f6cbd]',
    border: 'border-primary',
  },
  success: {
    bg: 'bg-success',
    text: 'text-white',
    tintBg: 'bg-[#e6f2e6]',
    tintText: 'text-[#107c10]',
    border: 'border-success',
  },
  warning: {
    bg: 'bg-warning',
    text: 'text-[#242424]',
    tintBg: 'bg-[#fefce8]',
    tintText: 'text-[#4d2c00]',
    border: 'border-warning',
  },
  danger: {
    bg: 'bg-destructive',
    text: 'text-white',
    tintBg: 'bg-[#fde7e9]',
    tintText: 'text-[#c50f1f]',
    border: 'border-destructive',
  },
  important: {
    bg: 'bg-severe',
    text: 'text-white',
    tintBg: 'bg-[#fdf0ec]',
    tintText: 'text-[#da3b01]',
    border: 'border-severe',
  },
  informative: {
    bg: 'bg-muted',
    text: 'text-foreground',
    tintBg: 'bg-muted',
    tintText: 'text-foreground',
    border: 'border-border',
  },
};

const sizeClasses: Record<Size, string> = {
  'extra-small': 'text-[10px] leading-[14px] px-1',
  small: 'text-[10px] leading-[14px] px-1',
  medium: 'text-caption-1 px-2 py-0.5',
  large: 'text-body-2 px-2.5 py-0.5',
  'extra-large': 'text-body-2 px-2.5 py-0.5',
};

export const Badge = (
    { appearance = 'filled', color = 'brand', size = 'medium', className, children, ref, ...props }: BadgeProps & { ref?: React.Ref<HTMLSpanElement> }) => {
    const c = colorMap[color];

    const appearanceClasses =
      appearance === 'filled'
        ? cn(c.bg, c.text)
        : appearance === 'tint'
          ? cn(c.tintBg, c.tintText)
          : cn('bg-transparent border', c.border, 'text-foreground');

    return (
      <span
        ref={ref}
        className={cn(
          'rounded-full inline-flex items-center font-semibold',
          sizeClasses[size],
          appearanceClasses,
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  };

Badge.displayName = 'Badge';
