import * as React from 'react';
import { cn } from '../../lib/cn';
import { presenceBadgeClassNames } from '../../lib/classNames';
import {
  PresenceAvailableIcon,
  PresenceAwayIcon,
  PresenceBusyIcon,
  PresenceDndIcon,
  PresenceOfflineIcon,
  PresenceOofIcon,
} from '../../lib/icons';
import type { IconComponent } from '../../lib/icons';
import { warnDeprecated } from '../../lib/dev';
import { forcedColors } from '../../lib/styles';
import type { DeprecatedPresenceStatus, PresenceStatus, Size } from '../../lib/types';

/** Properties for the PresenceBadge component. */
export interface PresenceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Presence status to display. `'dnd'` and `'oof'` are deprecated aliases of `'do-not-disturb'`
   * and `'out-of-office'`: they render the same and warn once in development (removed in 1.0).
   * @default 'available'
   */
  status?: PresenceStatus;
  /** Size of the presence indicator.
   * @default 'medium'
   */
  size?: Size;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
}

/** The shape drawn for a status, exposed as `data-glyph` (styling hook and test contract). */
type PresenceGlyph = 'check' | 'solid' | 'clock' | 'ring-x' | 'bar' | 'arrow';

/**
 * Per status: the glyph name, its shared icon (src/lib/icons.tsx, drawn in a 16×16 box that the
 * badge circle fills) and the colors. Busy is a full disc in `currentColor`: forced-colors mode
 * replaces the background with Canvas but forces `color` to CanvasText, so busy stays a solid dot
 * instead of an empty ring.
 */
const statusStyles: Record<
  Exclude<PresenceStatus, DeprecatedPresenceStatus>,
  { glyph: PresenceGlyph; Icon: IconComponent; className: string }
> = {
  available: {
    glyph: 'check',
    Icon: PresenceAvailableIcon,
    className: 'bg-presence-available text-presence-glyph',
  },
  busy: {
    glyph: 'solid',
    Icon: PresenceBusyIcon,
    className: 'bg-presence-busy text-presence-busy',
  },
  away: {
    glyph: 'clock',
    Icon: PresenceAwayIcon,
    className: 'bg-presence-away text-presence-glyph',
  },
  offline: {
    glyph: 'ring-x',
    Icon: PresenceOfflineIcon,
    className: 'bg-background text-presence-offline',
  },
  'do-not-disturb': {
    glyph: 'bar',
    Icon: PresenceDndIcon,
    className: 'bg-presence-busy text-presence-glyph',
  },
  'out-of-office': {
    glyph: 'arrow',
    Icon: PresenceOofIcon,
    className: 'bg-presence-oof text-presence-glyph',
  },
};

const statusLabels: Record<Exclude<PresenceStatus, DeprecatedPresenceStatus>, string> = {
  available: 'Available',
  busy: 'Busy',
  away: 'Away',
  offline: 'Offline',
  'do-not-disturb': 'Do not disturb',
  'out-of-office': 'Out of office',
};

const DEPRECATED_STATUS_NAMES = {
  dnd: 'do-not-disturb',
  oof: 'out-of-office',
} as const;

/** Maps the deprecated spellings to their Fluent names; warns once for an alias. */
function normalizePresenceStatus(
  status: PresenceStatus,
): Exclude<PresenceStatus, DeprecatedPresenceStatus> {
  if (status === 'dnd' || status === 'oof') {
    const current = DEPRECATED_STATUS_NAMES[status];
    warnDeprecated('PresenceBadge', `status '${status}'`, `status '${current}'`);
    return current;
  }
  return status;
}

const sizeClasses: Record<Size, string> = {
  'extra-small': 'size-2', // 8px
  small: 'size-2.5', // 10px
  medium: 'size-3', // 12px
  large: 'size-4', // 16px
  'extra-large': 'size-5', // 20px
};

/**
 * A person's availability as a small badge, usually placed on an `Avatar` (`badge` prop).
 *
 * Every status has its own shape, so it is not conveyed by color alone: available (check),
 * busy (solid), away (clock), offline (hollow ring with an X), do not disturb (bar), out of office
 * (arrow, mirrored in right-to-left layouts). A background-colored ring separates it from the
 * avatar. It is a named image (`role="img"`, `aria-label` = the status name; pass `aria-label` to
 * localise or extend it) and never a live region.
 *
 * @example
 * <PresenceBadge status="busy" />
 * <PresenceBadge status="do-not-disturb" />
 */
export const PresenceBadge = ({
  status: statusProp = 'available',
  size = 'medium',
  className,
  ref,
  ...props
}: PresenceBadgeProps) => {
  const status = normalizePresenceStatus(statusProp);
  const { glyph, Icon, className: statusClassName } = statusStyles[status];

  return (
    <span
      ref={ref}
      role="img"
      aria-label={statusLabels[status]}
      data-glyph={glyph}
      data-status={status}
      {...props}
      className={cn(
        presenceBadgeClassNames.root,
        'inline-flex shrink-0 items-center justify-center rounded-full ring-2 ring-background',
        'forced-colors:border',
        forcedColors.border,
        sizeClasses[size],
        statusClassName,
        className,
      )}
    >
      <Icon
        size="100%"
        className={cn(
          presenceBadgeClassNames.icon,
          'size-full',
          glyph === 'arrow' && 'wave-rtl:-scale-x-100',
        )}
      />
    </span>
  );
};

PresenceBadge.displayName = 'PresenceBadge';
