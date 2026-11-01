import * as React from 'react';
import type { SlotPart } from '../../lib/slotProps';
import type { AvatarGroupLayout } from './AvatarGroup.partition';
import type { AvatarSize } from './Avatar.sizes';

/*
 * What an AvatarGroup gives the members inside it: its size and layout to their Avatars, and the
 * parts of its popup (`slotProps.surface`, `list` and `listItem`) to AvatarGroup.Popover, built
 * in or yours. Internal (never exported from a barrel); imports no component, so an Avatar that
 * reads it holds no AvatarGroup code.
 */

/** The size and layout of the enclosing AvatarGroup, and the parts of its popup. Internal. */
export interface AvatarGroupContextValue {
  /** The size an Avatar without its own `size` takes. */
  size: AvatarSize;
  /** The layout of the group. */
  layout: AvatarGroupLayout;
  /** Whether the group shows any member inline (the overflow button overlaps it in a stack). */
  hasInlineItems: boolean;
  /** The group's `slotProps.surface`, which AvatarGroup.Popover merges into its popup. */
  surface?: SlotPart<'div'>;
  /** The group's `slotProps.list`, the popup's list. */
  list?: SlotPart<'ul'>;
  /** The group's `slotProps.listItem`, each item of the popup's list. */
  listItem?: SlotPart<'li'>;
}

/** Internal: provided by AvatarGroup around its members; `null` elsewhere. */
export const AvatarGroupContext = React.createContext<AvatarGroupContextValue | null>(null);
AvatarGroupContext.displayName = 'AvatarGroupContext';
