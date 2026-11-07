import * as React from 'react';
import { wcn } from '../../lib/cn';
import { badgeClassNames } from '../../lib/classNames';
import { renderSlot, slotRendersContent, type Slot } from '../../lib/slot';
import type { BadgeAppearance, BadgeColor, BadgeSize, IconPosition, Shape } from '../../lib/types';
import { badgeColorClasses, badgeDotClasses, badgeShapeClasses } from './Badge.colors';
import { useAppClassName } from '../../hooks/useAppClassName';

/** Properties for the Badge component. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Visual style of the badge: `'filled'` a solid fill, `'tint'` a light tint, `'outline'` a
   * border, `'ghost'` the color as text alone, with no fill and no border. Fluent's `appearance`.
   * @default 'filled'
   */
  appearance?: BadgeAppearance;
  /**
   * Semantic color: `brand`, `danger`, `important`, `informative`, `severe`, `subtle`, `success`,
   * `warning`. `important` is Fluent's neutral high-emphasis color: near black with white text in
   * the light theme, inverted in the dark one (through 0.x it was the orange that `severe` draws).
   * `severe` is dark orange. `subtle` is the page background with foreground text, for colored
   * surfaces.
   * @default 'brand'
   */
  color?: BadgeColor;
  /**
   * Corners of the badge: `'circular'` a pill, `'rounded'` softly rounded corners, `'square'` none.
   * Fluent's `shape`.
   * @default 'circular'
   */
  shape?: Shape;
  /**
   * Size of the badge. `'tiny'` is a 6px dot: it draws no content (`children` and `icon` are not
   * rendered) and, for `'filled'`, `'tint'` and `'ghost'`, the color's solid dot (a tint or a
   * text color alone would not stand out at that size); `'outline'` draws a ring. Name a tiny
   * badge with `aria-label` when nothing else conveys its meaning.
   * @default 'medium'
   */
  size?: BadgeSize;
  /**
   * An icon beside the text, decorative (`aria-hidden`), in a `<span>` with the stable class
   * `wave-badge__icon` that fills it with a `<svg>`. A `Slot<'span'>`: a node, or an object of the
   * element's props. Ignored for `size="tiny"`. Fluent's `icon`.
   */
  icon?: Slot<'span'>;
  /**
   * Which side of the text the icon takes: `'before'` the inline start, `'after'` the inline end,
   * so the sides follow the writing direction. Fluent's `iconPosition`.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** Whether a naming attribute holds more than whitespace (an empty one names nothing). */
function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

const sizeClasses: Record<Exclude<BadgeSize, 'tiny'>, string> = {
  'extra-small': 'wave:text-[10px] wave:leading-[14px] wave:px-1',
  small: 'wave:text-[10px] wave:leading-[14px] wave:px-1',
  medium: 'wave:text-caption-1 wave:px-2 wave:py-0.5',
  large: 'wave:text-body-2 wave:px-2.5 wave:py-0.5',
  'extra-large': 'wave:text-body-2 wave:px-2.5 wave:py-0.5',
};

/** The box of the icon: 10px in the smallest badge, 12px up to medium, 16px beyond. */
const iconSizeClasses: Record<Exclude<BadgeSize, 'tiny'>, string> = {
  'extra-small': 'wave:size-2.5',
  small: 'wave:size-3',
  medium: 'wave:size-3',
  large: 'wave:size-4',
  'extra-large': 'wave:size-4',
};

/**
 * A short, non-interactive label that highlights a status or category ("New", "Beta", "3").
 * `appearance` picks a solid fill, a light tint, an outline or the color as text alone; `color`
 * the semantic color; `shape` the corners; `icon` adds a glyph. Colors come from the theme tokens,
 * so the text keeps its contrast in the light, dark and high-contrast themes. The root carries
 * `data-color`, `data-appearance`, `data-shape` and `data-size` with the resolved values.
 *
 * A badge whose text alone does not say what it means ("3") can be named with `aria-label` or
 * `aria-labelledby`: it then gets `role="img"` (unless you pass a `role`), so the name is
 * announced. An empty or whitespace-only name counts as absent and adds no role.
 *
 * @example
 * <Badge appearance="tint" color="success">Passed</Badge>
 * <Badge aria-label="3 unread messages">3</Badge>
 * <Badge icon={<CheckIcon />} shape="rounded">Done</Badge>
 * <Badge size="tiny" aria-label="Unread" />
 */
export const Badge = ({
  appearance = 'filled',
  color = 'brand',
  shape = 'circular',
  size = 'medium',
  icon,
  iconPosition = 'before',
  className,
  children,
  ref,
  ...props
}: BadgeProps) => {
  const appClassName = useAppClassName(badgeClassNames.root);

  const c = badgeColorClasses[color];
  const tiny = size === 'tiny';

  const appearanceClasses =
    appearance === 'filled'
      ? c.filled
      : appearance === 'tint'
        ? c.tint
        : appearance === 'ghost'
          ? wcn('wave:bg-transparent', c.ghost)
          : wcn('wave:bg-transparent wave:border wave:text-foreground', c.border);

  // A tiny badge is a dot: nothing in it carries the contrast, so it takes the dot colors.
  const dotClasses =
    appearance === 'filled' || appearance === 'tint' || appearance === 'ghost'
      ? c.dot
      : wcn('wave:bg-transparent wave:border', c.dotBorder);

  // A name on a role-less <span> is not announced by screen readers: name it as an image. An empty
  // or whitespace-only name adds no role (an unnamed role="img" fails axe).
  const named = isName(props['aria-label']) || isName(props['aria-labelledby']);

  const iconElement =
    !tiny && slotRendersContent(icon)
      ? renderSlot(
          icon,
          'span',
          wcn(
            badgeClassNames.icon,
            'wave:inline-flex wave:shrink-0 wave:items-center wave:justify-center wave:[&>svg]:size-full',
            iconSizeClasses[size],
          ),
          { 'aria-hidden': true },
        )
      : null;

  return (
    <span
      ref={ref}
      role={named ? 'img' : undefined}
      data-color={color}
      data-appearance={appearance}
      data-shape={shape}
      data-size={size}
      className={wcn(
        badgeClassNames.root,
        'wave:inline-flex wave:items-center wave:font-semibold',
        badgeShapeClasses[shape],
        tiny ? badgeDotClasses : sizeClasses[size],
        iconElement !== null && 'wave:gap-1',
        tiny ? dotClasses : appearanceClasses,
        appClassName,
        className,
      )}
      {...props}
    >
      {tiny ? null : (
        <>
          {iconPosition === 'before' && iconElement}
          {children}
          {iconPosition === 'after' && iconElement}
        </>
      )}
    </span>
  );
};

Badge.displayName = 'Badge';
