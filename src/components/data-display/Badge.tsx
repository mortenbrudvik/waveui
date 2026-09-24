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
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Theme-token classes per color (the foreground tokens keep text readable in every theme). */
const colorMap: Record<BadgeColor, { filled: string; tint: string; border: string }> = {
  brand: {
    filled: 'bg-primary text-primary-foreground',
    tint: 'bg-info-tint text-info-tint-foreground',
    border: 'border-primary',
  },
  success: {
    filled: 'bg-success text-success-foreground',
    tint: 'bg-success-tint text-success-tint-foreground',
    border: 'border-success',
  },
  warning: {
    filled: 'bg-warning text-warning-foreground',
    tint: 'bg-warning-tint text-warning-tint-foreground',
    border: 'border-warning',
  },
  danger: {
    filled: 'bg-destructive text-destructive-foreground',
    tint: 'bg-error-tint text-error-tint-foreground',
    border: 'border-destructive',
  },
  important: {
    filled: 'bg-severe text-severe-foreground',
    tint: 'bg-severe-tint text-severe-tint-foreground',
    border: 'border-severe',
  },
  informative: {
    filled: 'bg-muted text-foreground',
    tint: 'bg-muted text-foreground',
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

/**
 * A short, non-interactive label that highlights a status or category ("New", "Beta", "3").
 * `appearance` picks a solid fill, a light tint or an outline; `color` the semantic color. Colors
 * come from the theme tokens, so the text keeps its contrast in the light, dark and high-contrast
 * themes.
 *
 * @example
 * <Badge appearance="tint" color="success">Passed</Badge>
 */
export const Badge = ({
  appearance = 'filled',
  color = 'brand',
  size = 'medium',
  className,
  children,
  ref,
  ...props
}: BadgeProps) => {
  const c = colorMap[color];

  const appearanceClasses =
    appearance === 'filled'
      ? c.filled
      : appearance === 'tint'
        ? c.tint
        : cn('bg-transparent border text-foreground', c.border);

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
