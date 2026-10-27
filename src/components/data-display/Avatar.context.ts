import * as React from 'react';
import type { Size } from '../../lib/types';

/*
 * The box a container gives the Avatars inside it that set no `size`: Tag and
 * InteractionTag.Primary provide it around their `media`, so a person's Avatar there matches the
 * tag's size, and Table.CellLayout a 32px box around its `media`. Internal (never exported
 * from a barrel); imports no component, so a Tag that reads it holds no Avatar code.
 */

/**
 * The box a container gives the Avatars inside it that set no `size` (Tag, InteractionTag and
 * Table.CellLayout media). Internal.
 */
export interface AvatarSizeContextValue {
  /** The box in pixels: a tag's 24px (Avatar's `extra-small`), 20px or 16px box, or a group's size. */
  size: number;
  /** The shape the container gives its Avatars: a rounded Tag gives `square`. */
  shape?: 'circular' | 'square';
}

/**
 * The size a badge in an Avatar's `badge` slot takes when it sets none (PresenceBadge): derived from
 * the avatar's pixel size. Internal.
 */
export const AvatarBadgeSizeContext = React.createContext<Size | null>(null);
AvatarBadgeSizeContext.displayName = 'AvatarBadgeSizeContext';

/**
 * Internal: provided by Tag, InteractionTag.Primary and Table.CellLayout around their `media`;
 * `null` elsewhere.
 */
export const AvatarSizeContext = React.createContext<AvatarSizeContextValue | null>(null);
AvatarSizeContext.displayName = 'AvatarSizeContext';
