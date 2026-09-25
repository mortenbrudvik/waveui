import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PresenceStatus, Size, Slot } from '../../lib/types';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import { Avatar } from './Avatar';
import { PresenceBadge } from './PresenceBadge';

/** Properties for the Persona component. */
export interface PersonaProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Display name of the person. */
  name: string;
  /** Secondary text such as job title or email. */
  secondaryText?: string;
  /** URL of the person's avatar image. */
  src?: string;
  /** Size of the persona avatar.
   * @default 'medium'
   */
  size?: Size;
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

function derivePresenceSize(size: Size): Size {
  return size === 'extra-small' || size === 'small' ? 'small' : 'medium';
}

/**
 * A person's avatar next to their name and optional secondary text (job title, email), with an
 * optional presence badge.
 *
 * The built-in avatar is decorative (`<Avatar decorative>`): the visible name is announced once,
 * not a second time as the avatar's image name. The presence badge stays exposed as a named image.
 *
 * @example
 * <Persona name="Jane Doe" secondaryText="Designer" status="available" />
 */
export const Persona = ({
  name,
  secondaryText,
  src,
  size = 'medium',
  status,
  avatar,
  badge,
  className,
  ref,
  ...props
}: PersonaProps) => {
  // A slot that renders nothing (`badge={count && …}` with count 0, an empty `.map()` result) is
  // not given (C-SLOTS), so the status badge and the built-in avatar apply.
  const badgeNode =
    badge && slotRendersContent(badge) ? (
      renderSlot(badge, 'span')
    ) : status ? (
      <PresenceBadge status={status} size={derivePresenceSize(size)} />
    ) : null;

  return (
    <div ref={ref} className={cn('inline-flex items-center gap-3', className)} {...props}>
      <div className="relative inline-flex shrink-0">
        {avatar && slotRendersContent(avatar) ? (
          renderSlot(avatar, 'span')
        ) : (
          <Avatar src={src} name={name} size={size} decorative />
        )}
        {badgeNode && <span className="absolute bottom-0 end-0 inline-flex">{badgeNode}</span>}
      </div>
      <div className="flex flex-col">
        <span className="font-semibold text-body-1">{name}</span>
        {secondaryText && (
          <span className="text-caption-1 text-muted-foreground">{secondaryText}</span>
        )}
      </div>
    </div>
  );
};

Persona.displayName = 'Persona';
