import type { BadgeColor } from '../../lib/types';

/** Theme-token classes of one Badge color. */
export interface BadgeColorClasses {
  /** `appearance="filled"`: background and text. */
  filled: string;
  /** `appearance="tint"`: background and text (plus a border for `subtle`). */
  tint: string;
  /** `appearance="outline"`: the border color (the outline's background and text are the component's). */
  border: string;
}

/**
 * Theme-token classes per color, shared by Badge and CounterBadge so a color means the same in
 * both. The foreground tokens keep text readable in every theme; each pair is asserted in
 * `src/styles/__tests__/tokens.test.ts`. `important` renders the severe colors through 0.x.
 */
export const badgeColorClasses: Record<BadgeColor, BadgeColorClasses> = {
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
  severe: {
    filled: 'bg-severe text-severe-foreground',
    tint: 'bg-severe-tint text-severe-tint-foreground',
    border: 'border-severe',
  },
  subtle: {
    filled: 'bg-background text-foreground',
    tint: 'bg-background text-muted-foreground border border-border',
    border: 'border-border',
  },
};
