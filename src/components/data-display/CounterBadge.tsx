import * as React from 'react';
import { cn } from '../../lib/cn';
import type { BadgeColor } from '../../lib/types';
import { badgeColorClasses } from './Badge.colors';

/** Properties for the CounterBadge component. */
export interface CounterBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Number to show. Nothing renders for 0 (unless `showZero`) or less; above `overflowCount` the
   * badge shows `overflowCount+`.
   * @default 0
   */
  count?: number;
  /** Maximum count before displaying overflow indicator (e.g. "99+").
   * @default 99
   */
  overflowCount?: number;
  /** Visual style of the counter badge.
   * @default 'filled'
   */
  appearance?: 'filled' | 'outline';
  /**
   * Semantic color, from Badge's palette: `brand`, `danger`, `important`, `informative`, `severe`,
   * `subtle`, `success`, `warning`. `important` follows Badge (see `BadgeProps.color`): it renders
   * the severe (orange) colors in 0.x and becomes a neutral high-emphasis color in 1.0. A value
   * outside the palette (from untyped code) renders as `brand`.
   * @default 'brand'
   */
  color?: BadgeColor;
  /**
   * A 6px dot without a number (an "unread" indicator); `count`, `overflowCount` and `showZero`
   * are ignored. Name it with `aria-label` when nothing else conveys its meaning. Its color keeps
   * 3:1 against the page background in every theme, so `informative` (gray) and `warning` (dark
   * yellow in the light theme) dots are darker than those counts; `subtle` is the page color, for
   * dots on colored surfaces.
   * @default false
   */
  dot?: boolean;
  /** Shows "0" for a count of 0; negative counts still render nothing.
   * @default false
   */
  showZero?: boolean;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Whether a naming attribute holds more than whitespace (an empty one names nothing). */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * A small pill showing a count (unread messages, notifications), or with `dot` a small dot
 * without a number. Renders nothing for a count of 0 (unless `showZero`) or less, and
 * `overflowCount+` above `overflowCount`. `color` takes Badge's palette, so a color means the
 * same in both. The root carries `data-color` and `data-appearance` with the resolved values,
 * and `data-dot` when it is a dot.
 *
 * A count or dot whose meaning is not in the surrounding text can be named with `aria-label` or
 * `aria-labelledby`: it then gets `role="img"` (unless you pass a `role`), so the name is
 * announced. An empty or whitespace-only name counts as absent and adds no role.
 *
 * @example
 * <CounterBadge count={12} />
 * <CounterBadge count={3} color="danger" aria-label="3 failed checks" />
 * <CounterBadge dot aria-label="Unread messages" />
 */
export const CounterBadge = ({
  count = 0,
  overflowCount = 99,
  appearance = 'filled',
  color = 'brand',
  dot = false,
  showZero = false,
  className,
  ref,
  ...props
}: CounterBadgeProps) => {
  if (!dot && (count < 0 || (count === 0 && !showZero))) return null;

  // Before 0.6 `color` was the span's HTML attribute (any string): a value outside the palette
  // (untyped code, a wrapper forwarding span attributes) renders as brand instead of throwing.
  const resolvedColor: BadgeColor = Object.hasOwn(badgeColorClasses, color ?? '') ? color : 'brand';
  const c = badgeColorClasses[resolvedColor];
  // A dot has no text to carry the contrast: it takes the dot colors, which stand out from the
  // page on their own.
  const appearanceClasses = dot
    ? appearance === 'filled'
      ? c.dot
      : cn('bg-transparent border', c.dotBorder)
    : appearance === 'filled'
      ? c.filled
      : cn(
          'bg-transparent border',
          c.border,
          resolvedColor === 'brand' ? 'text-primary' : 'text-foreground',
        );

  // A name on a role-less <span> is not announced by screen readers: name it as an image. An empty
  // or whitespace-only name adds no role (an unnamed role="img" fails axe).
  const named = isName(props['aria-label']) || isName(props['aria-labelledby']);

  return (
    <span
      ref={ref}
      role={named ? 'img' : undefined}
      data-color={resolvedColor}
      data-appearance={appearance}
      data-dot={dot ? '' : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        dot
          ? // In forced colors the background would become Canvas and hide the dot.
            'h-1.5 w-1.5 min-w-0 p-0 forced-colors:forced-color-adjust-none forced-colors:bg-[CanvasText]'
          : 'h-5 min-w-5 px-1.5 text-caption-1 font-semibold',
        appearanceClasses,
        className,
      )}
      {...props}
    >
      {dot ? null : count > overflowCount ? `${overflowCount}+` : String(count)}
    </span>
  );
};

CounterBadge.displayName = 'CounterBadge';
