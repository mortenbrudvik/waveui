import type { BadgeColor } from '../../lib/types';

/** Theme-token classes of one Badge color. */
export interface BadgeColorClasses {
  /** `appearance="filled"`: background and text. */
  filled: string;
  /** `appearance="tint"`: background and text (plus a border for `subtle`). */
  tint: string;
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

/** The dark orange `severe` colors, which `important` also renders through 0.x. */
const severeClasses: BadgeColorClasses = {
  filled: 'bg-severe text-severe-foreground',
  tint: 'bg-severe-tint text-severe-tint-foreground',
  border: 'border-severe',
  dot: 'bg-severe',
  dotBorder: 'border-severe',
};

/**
 * Theme-token classes per color, shared by Badge and CounterBadge so a color means the same in
 * both. The foreground tokens keep text readable in every theme, and every dot color keeps 3:1
 * against the page background except `subtle` (the page color, for colored surfaces); each pair is
 * asserted in `src/styles/__tests__/tokens.test.ts`. `important` renders the severe colors
 * through 0.x.
 */
export const badgeColorClasses: Record<BadgeColor, BadgeColorClasses> = {
  brand: {
    filled: 'bg-primary text-primary-foreground',
    tint: 'bg-info-tint text-info-tint-foreground',
    border: 'border-primary',
    dot: 'bg-primary',
    dotBorder: 'border-primary',
  },
  success: {
    filled: 'bg-success text-success-foreground',
    tint: 'bg-success-tint text-success-tint-foreground',
    border: 'border-success',
    dot: 'bg-success',
    dotBorder: 'border-success',
  },
  warning: {
    filled: 'bg-warning text-warning-foreground',
    tint: 'bg-warning-tint text-warning-tint-foreground',
    border: 'border-warning',
    // The warning fill is 1.30:1 on the light page; warning's text token keeps 4.5:1 everywhere.
    dot: 'bg-warning-tint-foreground',
    dotBorder: 'border-warning-tint-foreground',
  },
  danger: {
    filled: 'bg-destructive text-destructive-foreground',
    tint: 'bg-error-tint text-error-tint-foreground',
    border: 'border-destructive',
    dot: 'bg-destructive',
    dotBorder: 'border-destructive',
  },
  // `important` gets its own (neutral) entry in 1.0; until then it is the severe look.
  important: severeClasses,
  informative: {
    filled: 'bg-muted text-foreground',
    tint: 'bg-muted text-foreground',
    border: 'border-border',
    // The muted fill and the border are about 1.2:1 on the page in every theme.
    dot: 'bg-muted-foreground',
    dotBorder: 'border-muted-foreground',
  },
  severe: severeClasses,
  subtle: {
    filled: 'bg-background text-foreground',
    tint: 'bg-background text-muted-foreground border border-border',
    border: 'border-border',
    dot: 'bg-background',
    dotBorder: 'border-border',
  },
};
