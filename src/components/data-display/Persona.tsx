import * as React from 'react';
import { cn } from '../../lib/cn';
import { personaClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import type { PresenceStatus, Size, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { Avatar } from './Avatar';
import { PresenceBadge } from './PresenceBadge';

/** The size of a Persona: the Avatar sizes, and `huge` (a 72px avatar). */
export type PersonaSize = Size | 'huge';

/** Properties for the Persona component. */
export interface PersonaProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Display name of the person. It gives the avatar its initials and the first text line its text
   * (unless `primaryText` is given). A persona with neither `name` nor `primaryText` warns in
   * development.
   */
  name?: string;
  /**
   * The first text line (the name). A string, an element or an object of `<span>` attributes.
   * @default the `name`
   */
  primaryText?: Slot<'span'>;
  /** The second text line, such as a job title or email. */
  secondaryText?: Slot<'span'>;
  /** The third text line, such as a location. */
  tertiaryText?: Slot<'span'>;
  /** The fourth text line, such as a status message. */
  quaternaryText?: Slot<'span'>;
  /**
   * Where the text sits relative to the avatar, in reading order: after it, before it, or below it.
   * @default 'after'
   */
  textPosition?: 'after' | 'before' | 'below';
  /**
   * How the text lines align with each other.
   * @default 'start' ('center' when the text is below the avatar)
   */
  textAlignment?: 'start' | 'center';
  /**
   * Shows only the presence badge (from `status` or `badge`) in place of the avatar. The text
   * stays.
   * @default false
   */
  presenceOnly?: boolean;
  /** URL of the person's avatar image. */
  src?: string;
  /**
   * Size of the persona: its avatar and its text.
   * @default 'medium'
   */
  size?: PersonaSize;
  /** Presence status shown as a badge on the avatar. Ignored when a `badge` is given. */
  status?: PresenceStatus;
  /**
   * Slot for a custom avatar element, replacing the built-in one. The name is already visible
   * next to it, so make a custom avatar decorative (e.g. `<Avatar decorative … />`). A value that
   * renders nothing (`null`, `false`, `''`, `0`, `NaN`, or an array, `Set` or generator of only
   * such items) counts as not given.
   */
  avatar?: Slot<'span'>;
  /**
   * Slot for a custom badge element. Takes precedence over `status`. A value that renders nothing
   * (`null`, `false`, `''`, `0`, `NaN`, e.g. `badge={count && <CounterBadge count={count} />}`,
   * or an array, `Set` or generator of only such items) counts as not given.
   */
  badge?: Slot<'span'>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

function derivePresenceSize(size: PersonaSize): Size {
  if (size === 'extra-small' || size === 'small') return 'small';
  return size === 'huge' ? 'large' : 'medium';
}

/** The size of the presence badge that stands alone (`presenceOnly`). */
function derivePresenceOnlySize(size: PersonaSize): Size {
  if (size === 'extra-small' || size === 'small') return 'medium';
  if (size === 'medium' || size === 'large') return 'large';
  return 'extra-large';
}

/** Type steps of the first line and of the other lines, per size. Literal strings only. */
const textClasses: Readonly<Record<PersonaSize, { primary: string; other: string }>> = {
  'extra-small': { primary: 'text-caption-1', other: 'text-caption-2' },
  small: { primary: 'text-body-1', other: 'text-caption-1' },
  medium: { primary: 'text-body-1', other: 'text-caption-1' },
  large: { primary: 'text-subtitle-2', other: 'text-body-1' },
  'extra-large': { primary: 'text-subtitle-1', other: 'text-body-1' },
  huge: { primary: 'text-title-3', other: 'text-body-2' },
};

/** The layout of the root per text position. Logical: `flex-row-reverse` mirrors in RTL by itself. */
const positionClasses = {
  after: 'inline-flex items-center gap-3',
  before: 'inline-flex flex-row-reverse items-center gap-3',
  below: 'inline-flex flex-col items-center gap-2',
} as const;

/**
 * A person's avatar next to their name and up to three more text lines (job title, location,
 * status), with an optional presence badge. The text can sit after, before or below the avatar
 * (`textPosition`), `presenceOnly` swaps the avatar for the presence badge, and the text scales with
 * `size` up to `huge`.
 *
 * The built-in avatar is decorative (`<Avatar decorative>`): the visible name is announced once,
 * not a second time as the avatar's image name. The presence badge stays exposed as a named image.
 *
 * @example
 * <Persona name="Jane Doe" secondaryText="Designer" tertiaryText="Oslo" status="available" />
 */
export const Persona = ({
  name,
  primaryText,
  secondaryText,
  tertiaryText,
  quaternaryText,
  textPosition = 'after',
  textAlignment,
  presenceOnly = false,
  src,
  size = 'medium',
  status,
  avatar,
  badge,
  className,
  ref,
  ...props
}: PersonaProps) => {
  const resolvedAlignment = textAlignment ?? (textPosition === 'below' ? 'center' : 'start');
  const hasPrimary = primaryText !== undefined ? slotRendersContent(primaryText) : !!name;
  React.useEffect(() => {
    if (!hasPrimary) {
      warnOnce(
        'Persona:unnamed',
        'Persona: it has neither a `name` nor a `primaryText`, so nothing names the person. Pass one of them.',
      );
    }
  }, [hasPrimary]);

  // A slot that renders nothing (`badge={count && …}` with count 0, an empty `.map()` result) is
  // not given (C-SLOTS), so the status badge and the built-in avatar apply.
  const badgeNode =
    badge && slotRendersContent(badge) ? (
      renderSlot(badge, 'span')
    ) : status ? (
      <PresenceBadge
        status={status}
        size={presenceOnly ? derivePresenceOnlySize(size) : derivePresenceSize(size)}
      />
    ) : null;

  const text = textClasses[size];
  const lines = [
    {
      key: 'primaryText',
      slot: primaryText ?? name,
      className: cn(personaClassNames.primaryText, text.primary, 'font-semibold'),
    },
    {
      key: 'secondaryText',
      slot: secondaryText,
      className: cn(personaClassNames.secondaryText, text.other, 'text-muted-foreground'),
    },
    {
      key: 'tertiaryText',
      slot: tertiaryText,
      className: cn(personaClassNames.tertiaryText, text.other, 'text-muted-foreground'),
    },
    {
      key: 'quaternaryText',
      slot: quaternaryText,
      className: cn(personaClassNames.quaternaryText, text.other, 'text-muted-foreground'),
    },
  ] as const;

  return (
    <div
      ref={ref}
      data-size={size}
      data-text-position={textPosition}
      data-text-alignment={resolvedAlignment}
      data-presence-only={presenceOnly ? '' : undefined}
      className={cn(personaClassNames.root, positionClasses[textPosition], className)}
      {...props}
    >
      {presenceOnly ? (
        badgeNode && (
          <span className={cn(personaClassNames.badge, 'inline-flex shrink-0')}>{badgeNode}</span>
        )
      ) : (
        <div className="relative inline-flex shrink-0">
          {avatar && slotRendersContent(avatar) ? (
            renderSlot(avatar, 'span', personaClassNames.avatar)
          ) : (
            <Avatar
              src={src}
              name={name}
              size={size === 'huge' ? 72 : size}
              decorative
              className={personaClassNames.avatar}
            />
          )}
          {badgeNode && (
            <span className={cn(personaClassNames.badge, 'absolute bottom-0 end-0 inline-flex')}>
              {badgeNode}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'flex flex-col',
          resolvedAlignment === 'center' ? 'items-center text-center' : 'items-start text-start',
        )}
      >
        {lines.map(
          ({ key, slot, className: lineClass }) =>
            slot !== undefined &&
            slotRendersContent(slot) &&
            renderSlot(slot, 'span', lineClass, { key }),
        )}
      </div>
    </div>
  );
};

Persona.displayName = 'Persona';
