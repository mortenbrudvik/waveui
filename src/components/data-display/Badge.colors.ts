import type { BadgeColor, Shape } from '../../lib/types';

/** Theme-token classes of one Badge color. */
export interface BadgeColorClasses {
  /** `appearance="filled"`: background and text. */
  filled: string;
  /** `appearance="tint"`: background and text (plus a border for `subtle`). */
  tint: string;
  /** `appearance="ghost"`: the text color (no fill, no border). */
  ghost: string;
  /** `appearance="outline"`: the border color (the outline's background and text are the component's). */
  border: string;
  /**
   * CounterBadge `dot` with `appearance="filled"`: the fill. A dot has no text, so its own color
   * must stand out from the page (3:1): `informative` and `warning` use darker tokens than their
   * filled badges, whose text carries the contrast.
   */
  dot: string;
  /** CounterBadge `dot` with `appearance="outline"`: the ring color, chosen like `dot`. */
  dotBorder: string;
}

/**
 * Theme-token classes per color, shared by Badge and CounterBadge so a color means the same in
 * both. The foreground tokens keep text readable in every theme, and every dot color keeps 3:1
 * against the page background except `subtle` (the page color, for colored surfaces); each pair is
 * asserted in `src/styles/__tests__/tokens.test.ts`.
 *
 * `important` is Fluent's neutral high-emphasis color (1.0): the page's text color as the fill
 * with the page color as its text (near black with white text in the light theme, inverted in the
 * dark one), and for the tint the secondary text color as the fill. Contrast is symmetric, so these
 * are the asserted pairs `foreground` and `muted-foreground` on `background`. `severe` is the dark
 * orange that `important` rendered through 0.x.
 */
export const badgeColorClasses: Record<BadgeColor, BadgeColorClasses> = {
  brand: {
    filled: 'wave:bg-primary wave:text-primary-foreground',
    tint: 'wave:bg-info-tint wave:text-info-tint-foreground',
    ghost: 'wave:text-primary',
    border: 'wave:border-primary',
    dot: 'wave:bg-primary',
    dotBorder: 'wave:border-primary',
  },
  success: {
    filled: 'wave:bg-success wave:text-success-foreground',
    tint: 'wave:bg-success-tint wave:text-success-tint-foreground',
    ghost: 'wave:text-success-tint-foreground',
    border: 'wave:border-success',
    dot: 'wave:bg-success',
    dotBorder: 'wave:border-success',
  },
  warning: {
    filled: 'wave:bg-warning wave:text-warning-foreground',
    tint: 'wave:bg-warning-tint wave:text-warning-tint-foreground',
    ghost: 'wave:text-warning-tint-foreground',
    border: 'wave:border-warning',
    // The warning fill is 1.30:1 on the light page; warning's text token keeps 4.5:1 everywhere.
    dot: 'wave:bg-warning-tint-foreground',
    dotBorder: 'wave:border-warning-tint-foreground',
  },
  danger: {
    filled: 'wave:bg-destructive wave:text-destructive-foreground',
    tint: 'wave:bg-error-tint wave:text-error-tint-foreground',
    ghost: 'wave:text-error-tint-foreground',
    border: 'wave:border-destructive',
    dot: 'wave:bg-destructive',
    dotBorder: 'wave:border-destructive',
  },
  important: {
    filled: 'wave:bg-foreground wave:text-background',
    tint: 'wave:bg-muted-foreground wave:text-background',
    ghost: 'wave:text-foreground',
    // Fluent's accessible neutral stroke (3:1 on the page).
    border: 'wave:border-stroke-accessible',
    dot: 'wave:bg-foreground',
    dotBorder: 'wave:border-foreground',
  },
  informative: {
    filled: 'wave:bg-muted wave:text-foreground',
    tint: 'wave:bg-muted wave:text-foreground',
    ghost: 'wave:text-muted-foreground',
    border: 'wave:border-border',
    // The muted fill and the border are about 1.2:1 on the page in every theme.
    dot: 'wave:bg-muted-foreground',
    dotBorder: 'wave:border-muted-foreground',
  },
  severe: {
    filled: 'wave:bg-severe wave:text-severe-foreground',
    tint: 'wave:bg-severe-tint wave:text-severe-tint-foreground',
    ghost: 'wave:text-severe-tint-foreground',
    border: 'wave:border-severe',
    dot: 'wave:bg-severe',
    dotBorder: 'wave:border-severe',
  },
  subtle: {
    filled: 'wave:bg-background wave:text-foreground',
    tint: 'wave:bg-background wave:text-muted-foreground wave:border wave:border-border',
    ghost: 'wave:text-muted-foreground',
    border: 'wave:border-border',
    dot: 'wave:bg-background',
    dotBorder: 'wave:border-border',
  },
};

/** The corners of each shape, as Fluent's `shape` names them (shared by Badge and CounterBadge). */
export const badgeShapeClasses: Record<Shape, string> = {
  circular: 'wave:rounded-full',
  rounded: 'wave:rounded-md',
  square: 'wave:rounded-none',
};

/**
 * A 6px dot with no content (Badge `size="tiny"`, CounterBadge `dot`). In forced colors the
 * background would become Canvas and hide the dot, so it takes the text color there.
 */
export const badgeDotClasses =
  'wave:h-1.5 wave:w-1.5 wave:min-w-0 wave:p-0 wave:forced-colors:forced-color-adjust-none wave:forced-colors:bg-[CanvasText]';
