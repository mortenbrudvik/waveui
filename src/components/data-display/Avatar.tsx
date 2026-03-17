import * as React from 'react';
import { cn } from '../../lib/cn';
import type { Size, Slot } from '../../lib/types';
import { renderSlot } from '../../lib/slot';

/** Properties for the Avatar component. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** URL of the avatar image. */
  src?: string;
  /** Full name used to generate initials when no image is provided. */
  name?: string;
  /** Size of the avatar.
   * @default 'medium'
   */
  size?: Size;
  /** Custom icon to display when no image or name is provided. */
  icon?: React.ReactNode;
  /** Slot for a custom image element. */
  image?: Slot<'img'>;
  /** Slot for a badge element positioned at the bottom-right corner. */
  badge?: Slot<'span'>;
}

const sizeMap: Record<Size, string> = {
  'extra-small': 'w-6 h-6 text-[10px]',    // 24px
  small: 'w-8 h-8 text-xs',                 // 32px
  medium: 'w-10 h-10 text-sm',              // 40px
  large: 'w-12 h-12 text-base',             // 48px
  'extra-large': 'w-14 h-14 text-lg',       // 56px
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : '';
  return (first + last).toUpperCase();
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ src, name, size = 'medium', icon, image, badge, className, ...props }, ref) => {
    const bgClass = src ? '' : (icon ? 'bg-[#f0f0f0] text-[#707070]' : 'bg-primary text-white');

    const avatarElement = (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-bold',
          sizeMap[size],
          bgClass,
          className,
        )}
        {...props}
      >
        {image ? (
          renderSlot(image, 'img', 'w-full h-full object-cover')
        ) : src ? (
          <img
            src={src}
            alt={name ?? ''}
            className="w-full h-full object-cover"
          />
        ) : icon ? (
          icon
        ) : name ? (
          <span>{getInitials(name)}</span>
        ) : null}
      </span>
    );

    if (badge) {
      return (
        <span className="relative inline-flex">
          {avatarElement}
          <span className="absolute bottom-0 right-0">
            {renderSlot(badge, 'span')}
          </span>
        </span>
      );
    }

    return avatarElement;
  },
);

Avatar.displayName = 'Avatar';
