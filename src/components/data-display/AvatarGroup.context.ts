import * as React from 'react';
import type { AvatarGroupLayout } from './AvatarGroup.partition';
import type { AvatarSize } from './Avatar.sizes';

/*
 * What an AvatarGroup gives the Avatars inside it. Internal (never exported from a barrel); imports
 * no component, so an Avatar that reads it holds no AvatarGroup code.
 */

/** The size and layout of the enclosing AvatarGroup. Internal. */
export interface AvatarGroupContextValue {
  /** The size an Avatar without its own `size` takes. */
  size: AvatarSize;
  /** The layout of the group. */
  layout: AvatarGroupLayout;
  /** Whether the group shows any member inline (the overflow button overlaps it in a stack). */
  hasInlineItems: boolean;
}

/** Internal: provided by AvatarGroup around its members; `null` elsewhere. */
export const AvatarGroupContext = React.createContext<AvatarGroupContextValue | null>(null);
AvatarGroupContext.displayName = 'AvatarGroupContext';
