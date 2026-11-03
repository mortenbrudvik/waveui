import * as React from 'react';
import { wcn } from '../../lib/cn';
import { badgeClassNames, counterBadgeClassNames } from '../../lib/classNames';
import type { BadgeColor, Shape, Size } from '../../lib/types';
import { badgeColorClasses, badgeDotClasses, badgeShapeClasses } from './Badge.colors';

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
  /**
   * Visual style of the counter badge: `'filled'` a solid fill, `'outline'` a border, `'ghost'`
   * the color as text alone, with no fill and no border. A `dot` has no text, so `'ghost'` draws
   * it as `'filled'`. Fluent's `appearance`.
   * @default 'filled'
   */
  appearance?: 'filled' | 'outline' | 'ghost';
  /**
   * Corners: `'circular'` a pill, `'rounded'` softly rounded corners, `'square'` none; a `dot`
   * follows it too. Fluent's `shape`.
   * @default 'circular'
   */
  shape?: Shape;
  /**
   * Size of the counter: 14px tall for `'extra-small'`, 16px `'small'`, 20px `'medium'`, 24px
   * `'large'` and 32px `'extra-large'`. A `dot` is always 6px and ignores it. Fluent's `size`.
   * @default 'medium'
   */
  size?: Size;
  /**
   * Semantic color, from Badge's palette: `brand`, `danger`, `important`, `informative`, `severe`,
   * `subtle`, `success`, `warning`. `important` follows Badge (see `BadgeProps.color`): Fluent's
   * neutral high-emphasis color, near black in the light theme and inverted in the dark one
   * (`severe` is the orange it drew through 0.x). A value outside the palette (from untyped code)
   * renders as `brand`.
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

/** Height, minimum width, padding and text of a count per size. */
const sizeClasses: Record<Size, string> = {
  'extra-small': 'wave:h-3.5 wave:min-w-3.5 wave:px-1 wave:text-[10px] wave:leading-[14px]',
  small: 'wave:h-4 wave:min-w-4 wave:px-1 wave:text-[10px] wave:leading-4',
  medium: 'wave:h-5 wave:min-w-5 wave:px-1.5 wave:text-caption-1',
  large: 'wave:h-6 wave:min-w-6 wave:px-2 wave:text-body-2',
  'extra-large': 'wave:h-8 wave:min-w-8 wave:px-2.5 wave:text-body-1',
};

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
  shape = 'circular',
  size = 'medium',
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
    ? appearance === 'filled' || appearance === 'ghost'
      ? c.dot
      : wcn('wave:bg-transparent wave:border', c.dotBorder)
    : appearance === 'filled'
      ? c.filled
      : appearance === 'ghost'
        ? wcn('wave:bg-transparent', c.ghost)
        : wcn(
            'wave:bg-transparent wave:border',
            c.border,
            resolvedColor === 'brand' ? 'wave:text-primary' : 'wave:text-foreground',
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
      data-shape={shape}
      data-size={size}
      data-dot={dot ? '' : undefined}
      className={wcn(
        badgeClassNames.root,
        counterBadgeClassNames.root,
        'wave:inline-flex wave:items-center wave:justify-center',
        badgeShapeClasses[shape],
        // In forced colors the dot's background would become Canvas and hide it: see the classes.
        dot ? badgeDotClasses : wcn('wave:font-semibold', sizeClasses[size]),
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
