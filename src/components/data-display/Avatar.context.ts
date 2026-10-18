import * as React from 'react';

/*
 * The box a container gives the Avatars inside it that set no `size`: Tag and
 * InteractionTag.Primary provide it around their `media`, so a person's Avatar there matches the
 * tag's size. Internal (never exported from a barrel); imports no component, so a Tag that reads
 * it holds no Avatar code.
 */

/**
 * The box a container gives the Avatars inside it that set no `size` (Tag and InteractionTag
 * media). Internal.
 */
export interface AvatarSizeContextValue {
  /** The box: 24px (Avatar's `extra-small`), or the internal 20px and 16px boxes. */
  size: 16 | 20 | 24;
}

/** Internal: provided by Tag and InteractionTag.Primary around their `media`; `null` elsewhere. */
export const AvatarSizeContext = React.createContext<AvatarSizeContextValue | null>(null);
AvatarSizeContext.displayName = 'AvatarSizeContext';
