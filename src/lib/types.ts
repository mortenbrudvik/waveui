import type * as React from 'react';

/** Component size affecting padding, font size, and spacing. */
export type Size = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';

/** Visual style variant controlling fill, border, and background treatment. */
export type Appearance = 'primary' | 'outline' | 'subtle' | 'transparent';

/** Visual style variant for Badge components. */
export type BadgeAppearance = 'filled' | 'tint' | 'outline';

/** Semantic color for Badge components. */
export type BadgeColor = 'brand' | 'success' | 'warning' | 'danger' | 'important' | 'informative';

/** Semantic status used for alerts, messages, and status indicators. */
export type Status = 'success' | 'warning' | 'error' | 'info';

/** User presence status for Avatar and Persona components. */
export type PresenceStatus = 'available' | 'busy' | 'away' | 'offline' | 'dnd' | 'oof';

/** Typography scale variant mapping to Fluent UI type ramp tokens. */
export type TypographyVariant =
  | 'caption-2'
  | 'caption-1'
  | 'body-1'
  | 'body-2'
  | 'subtitle-2'
  | 'subtitle-1'
  | 'title-3'
  | 'title-2'
  | 'title-1'
  | 'large-title'
  | 'display';

// Re-export slot types for convenience
export type { Slot, SlotObject } from './slot';
export { resolveSlot, renderSlot } from './slot';

/**
 * Helper type for polymorphic components that accept an `as` prop.
 *
 * @typeParam DefaultElement - The default HTML element type when `as` is not provided.
 * @typeParam Props - Additional component-specific props.
 */
export type PolymorphicProps<
  DefaultElement extends React.ElementType = 'div',
  Props = object,
> = Props & {
  /**
   * Element type to render as. Consumer is responsible for ensuring
   * props are compatible with the target element.
   */
  as?: React.ElementType;
} & Omit<React.ComponentPropsWithoutRef<DefaultElement>, keyof Props | 'as'>;
