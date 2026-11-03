import * as React from 'react';
import { wcn } from '../../lib/cn';
import { presenceBadgeClassNames } from '../../lib/classNames';
import {
  PresenceAvailableIcon,
  PresenceAwayIcon,
  PresenceBlockedIcon,
  PresenceBusyIcon,
  PresenceDndIcon,
  PresenceOfflineIcon,
  PresenceOofIcon,
  PresenceUnknownIcon,
} from '../../lib/icons';
import type { IconComponent } from '../../lib/icons';
import { AvatarBadgeSizeContext } from './Avatar.context';
import { warnOnce } from '../../lib/dev';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { forcedColors } from '../../lib/styles';
import type { PresenceStatus, Size } from '../../lib/types';

/** Properties for the PresenceBadge component. */
export interface PresenceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Presence status to display. The names of 0.x that 1.0 removed from the type, `'dnd'` and
   * `'oof'`, still draw `'do-not-disturb'` and `'out-of-office'` when they come from code that no
   * type checker reads (server data, JavaScript), with a development warning once per name: a
   * bridge that may go in 2.0, so map such data to the new names.
   * Any other value (a misspelled name, `null`) draws `'offline'`, with a development warning once.
   * `'blocked'` (a person you blocked) draws a bar across a red disc and `'unknown'` (no presence
   * data) a question mark on the page color, each with a shape of its own.
   * @default 'available'
   */
  status?: PresenceStatus;
  /**
   * Marks the person as out of office, whatever their status: the badge draws the out-of-office
   * arrow in the status's own color on the page color, and its name gains ", out of office". With
   * `status="out-of-office"` it changes nothing (that status already draws the arrow). Rendered as
   * a boolean `data-out-of-office`. Fluent's `outOfOffice`.
   * @default false
   */
  outOfOffice?: boolean;
  /**
   * Size of the presence indicator. In the `badge` slot of an Avatar it is sized from the avatar.
   * @default 'medium'
   */
  size?: Size;
  /** Ref to the root `<span>`. */
  ref?: React.Ref<HTMLSpanElement>;
  /**
   * Props for the element the badge draws inside its root, by part, merged into the part's own:
   * your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref attached. Every attribute the badge sets on the part
   * is locked. A part takes no `children` (the badge draws its glyph); the root takes the badge's
   * own props.
   */
  slotProps?: {
    /**
     * The status glyph, an `<svg>` (stable class `wave-presence-badge__icon`), mirrored in
     * right-to-left layouts for out of office. Locked: `aria-hidden`, `focusable="false"` and,
     * unset, `role` and `tabIndex` (it is decorative: the badge's name is the root's
     * `aria-label`).
     */
    icon?: SlotPart<'svg'>;
  };
}

/** What the glyph part locks: decorative, never a tab stop or focusable. */
const ICON_PART_LOCKS = {
  role: undefined,
  tabIndex: undefined,
  'aria-hidden': true,
  focusable: 'false',
} as const;

/** The shape drawn for a status, exposed as `data-glyph` (styling hook and test contract). */
type PresenceGlyph =
  'check' | 'solid' | 'clock' | 'ring-x' | 'bar' | 'arrow' | 'slash' | 'question';

/**
 * Per status: the glyph name, its shared icon (src/lib/icons.tsx, drawn in a 16×16 box that the
 * badge circle fills) and the colors. Busy is a full disc in `currentColor`: forced-colors mode
 * replaces the background with Canvas but forces `color` to CanvasText, so busy stays a solid dot
 * instead of an empty ring.
 */
const statusStyles: Record<
  PresenceStatus,
  { glyph: PresenceGlyph; Icon: IconComponent; className: string; oofClassName?: string }
> = {
  available: {
    glyph: 'check',
    Icon: PresenceAvailableIcon,
    className: 'wave:bg-presence-available wave:text-presence-glyph',
    oofClassName: 'wave:text-presence-available',
  },
  busy: {
    glyph: 'solid',
    Icon: PresenceBusyIcon,
    className: 'wave:bg-presence-busy wave:text-presence-busy',
    oofClassName: 'wave:text-presence-busy',
  },
  away: {
    glyph: 'clock',
    Icon: PresenceAwayIcon,
    className: 'wave:bg-presence-away wave:text-presence-glyph',
    oofClassName: 'wave:text-presence-away',
  },
  offline: {
    glyph: 'ring-x',
    Icon: PresenceOfflineIcon,
    className: 'wave:bg-background wave:text-presence-offline',
    oofClassName: 'wave:text-presence-offline',
  },
  'do-not-disturb': {
    glyph: 'bar',
    Icon: PresenceDndIcon,
    className: 'wave:bg-presence-busy wave:text-presence-glyph',
    oofClassName: 'wave:text-presence-busy',
  },
  'out-of-office': {
    glyph: 'arrow',
    Icon: PresenceOofIcon,
    className: 'wave:bg-presence-oof wave:text-presence-glyph',
  },
  blocked: {
    glyph: 'slash',
    Icon: PresenceBlockedIcon,
    className: 'wave:bg-presence-busy wave:text-presence-glyph',
    oofClassName: 'wave:text-presence-busy',
  },
  unknown: {
    glyph: 'question',
    Icon: PresenceUnknownIcon,
    className: 'wave:bg-background wave:text-presence-offline',
    oofClassName: 'wave:text-presence-offline',
  },
};

const statusLabels: Record<PresenceStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  away: 'Away',
  offline: 'Offline',
  'do-not-disturb': 'Do not disturb',
  'out-of-office': 'Out of office',
  blocked: 'Blocked',
  unknown: 'Unknown',
};

/**
 * The status names of 0.x that 1.0 removed from `PresenceStatus`, and the Fluent names they draw
 * (ruling BR): a bridge for server data and untyped code, which no type checker reads.
 */
const RENAMED_STATUSES: Readonly<Record<string, PresenceStatus>> = {
  dnd: 'do-not-disturb',
  oof: 'out-of-office',
};

const sizeClasses: Record<Size, string> = {
  'extra-small': 'wave:size-2', // 8px
  small: 'wave:size-2.5', // 10px
  medium: 'wave:size-3', // 12px
  large: 'wave:size-4', // 16px
  'extra-large': 'wave:size-5', // 20px
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
  size: sizeProp,
  outOfOffice = false,
  className,
  ref,
  slotProps,
  ...props
}: PresenceBadgeProps) => {
  // A removed name from untyped code draws its new name; any other value that no type checker
  // caught (server data, `null`) draws `'offline'`, so the badge never throws (on the server too).
  const oldName = Object.hasOwn(RENAMED_STATUSES, statusProp) ? statusProp : undefined;
  const resolved = oldName ? RENAMED_STATUSES[oldName] : statusProp;
  const unknown = !Object.hasOwn(statusStyles, resolved);
  const status: PresenceStatus = unknown ? 'offline' : resolved;
  React.useEffect(() => {
    // Written out so a bundler replaces it and a production bundle drops the warnings and their
    // text; without `process` (an unbundled import in a browser) the read throws a
    // ReferenceError and they are skipped. Any other error, such as one thrown by a strict
    // console, is not swallowed.
    try {
      if (process.env.NODE_ENV !== 'production') {
        if (oldName) {
          warnOnce(
            `PresenceBadge:status:${oldName}`,
            `PresenceBadge: status '${oldName}' was removed in 1.0; the badge draws ` +
              `'${RENAMED_STATUSES[oldName]}' for it. Use '${RENAMED_STATUSES[oldName]}': this ` +
              'fallback for server data and untyped code may be removed in 2.0.',
          );
        } else if (unknown) {
          warnOnce(
            'PresenceBadge:status-unknown',
            `PresenceBadge: status '${String(resolved)}' is not a presence status; the badge ` +
              `draws 'offline'. Use one of ${Object.keys(statusStyles).join(', ')}.`,
          );
        }
      }
    } catch (error) {
      if (!(error instanceof ReferenceError)) throw error; // No `process`: see above.
    }
  }, [oldName, unknown, resolved]);
  const avatarBadgeSize = React.useContext(AvatarBadgeSizeContext);
  const size = sizeProp ?? avatarBadgeSize ?? 'medium';
  const {
    glyph: statusGlyph,
    Icon: StatusIcon,
    className: statusColors,
    oofClassName,
  } = statusStyles[status];
  // The modifier replaces the glyph with the out-of-office arrow in the status's color on the page
  // color; the status that is itself out of office has nothing to modify.
  const outOfOfficeLook = outOfOffice && oofClassName !== undefined;
  const glyph = outOfOfficeLook ? 'arrow' : statusGlyph;
  const Icon = outOfOfficeLook ? PresenceOofIcon : StatusIcon;
  const statusClassName = outOfOfficeLook ? wcn('wave:bg-background', oofClassName) : statusColors;
  const label =
    outOfOffice && status !== 'out-of-office'
      ? `${statusLabels[status]}, out of office`
      : statusLabels[status];
  const iconPart = slotProps?.icon;
  const iconClassName = wcn(
    presenceBadgeClassNames.icon,
    'wave:size-full',
    glyph === 'arrow' && 'wave:wave-rtl:-scale-x-100',
  );

  return (
    <span
      ref={ref}
      role="img"
      aria-label={label}
      data-glyph={glyph}
      data-status={status}
      data-out-of-office={outOfOffice ? '' : undefined}
      {...props}
      className={wcn(
        presenceBadgeClassNames.root,
        'wave:inline-flex wave:shrink-0 wave:items-center wave:justify-center wave:rounded-full wave:ring-2 wave:ring-background',
        'wave:forced-colors:border',
        forcedColors.border,
        sizeClasses[size],
        statusClassName,
        className,
      )}
    >
      <Icon
        size="100%"
        className={iconClassName}
        {...(iconPart &&
          mergeSlotProps(iconPart, { className: iconClassName, locked: ICON_PART_LOCKS }))}
      />
    </span>
  );
};

PresenceBadge.displayName = 'PresenceBadge';
