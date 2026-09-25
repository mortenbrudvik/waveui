import * as React from 'react';
import { cn } from '../../lib/cn';
import type { BadgeAppearance, BadgeColor, Size } from '../../lib/types';
import { badgeColorClasses } from './Badge.colors';

/** Properties for the Badge component. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual style of the badge.
   * @default 'filled'
   */
  appearance?: BadgeAppearance;
  /**
   * Semantic color: `brand`, `danger`, `important`, `informative`, `severe`, `subtle`, `success`,
   * `warning`. `severe` is dark orange. `subtle` is the page background with foreground text, for
   * colored surfaces. `important` renders the severe (orange) colors in 0.x, as in 0.5; in 1.0 it
   * becomes Fluent's neutral high-emphasis color (near black in the light theme) — use `severe` to
   * keep the orange look.
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
 * themes. The root carries `data-color` and `data-appearance` with the resolved values.
 *
 * A badge whose text alone does not say what it means ("3") can be named with `aria-label` or
 * `aria-labelledby`: it then gets `role="img"` (unless you pass a `role`), so the name is
 * announced.
 *
 * @example
 * <Badge appearance="tint" color="success">Passed</Badge>
 * <Badge aria-label="3 unread messages">3</Badge>
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
  const c = badgeColorClasses[color];

  const appearanceClasses =
    appearance === 'filled'
      ? c.filled
      : appearance === 'tint'
        ? c.tint
        : cn('bg-transparent border text-foreground', c.border);

  // A name on a role-less <span> is not announced (and fails axe): name it as an image.
  const named = Boolean(props['aria-label'] || props['aria-labelledby']);

  return (
    <span
      ref={ref}
      role={named ? 'img' : undefined}
      data-color={color}
      data-appearance={appearance}
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
