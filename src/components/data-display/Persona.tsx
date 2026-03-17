import * as React from 'react';
import { cn } from '../../lib/cn';
import type { PresenceStatus, Size, Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';
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
  /** Presence status shown as a badge on the avatar. */
  status?: PresenceStatus;
  /** Slot for a custom avatar element. */
  avatar?: Slot<'span'>;
  /** Slot for a custom badge element. */
  badge?: Slot<'span'>;
}

function derivePresenceSize(size: Size): Size {
  return size === 'extra-small' || size === 'small' ? 'small' : 'medium';
}

export const Persona = React.forwardRef<HTMLDivElement, PersonaProps>(
  (
    { name, secondaryText, src, size = 'medium', status, avatar, badge, className, ...props },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('inline-flex items-center gap-3', className)} {...props}>
        <div className="relative">
          {avatar ? renderSlot(avatar, 'span') : <Avatar src={src} name={name} size={size} />}
          {badge ? (
            <span className="absolute bottom-0 right-0">{renderSlot(badge, 'span')}</span>
          ) : status ? (
            <span className="absolute bottom-0 right-0">
              <PresenceBadge status={status} size={derivePresenceSize(size)} />
            </span>
          ) : null}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-body-1">{name}</span>
          {secondaryText && (
            <span className="text-caption-1 text-muted-foreground">{secondaryText}</span>
          )}
        </div>
      </div>
    );
  },
);

Persona.displayName = 'Persona';
