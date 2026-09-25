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

/** Layout axis of a component (Divider, RadioGroup, Stepper, TabList, Stack, …). */
export type Orientation = 'horizontal' | 'vertical';

/** How many items a selectable collection allows (List, DataGrid, Accordion, …). */
export type SelectionMode = 'single' | 'multiple';

/** Font weight vocabulary shared by Text and Label (400 / 600 / 700). */
export type TextWeight = 'regular' | 'semibold' | 'bold';

/** Geometry of a surface (Image, Skeleton, SwatchPicker, …). */
export type Shape = 'circular' | 'square' | 'rounded';

/**
 * Side of the anchor a popup is placed on. `start`/`end` follow the writing direction;
 * `left`/`right` are physical.
 */
export type PopupSide = 'top' | 'bottom' | 'start' | 'end' | 'left' | 'right';

/** Alignment of a popup along the anchor's edge. */
export type PopupAlign = 'start' | 'center' | 'end';

// Re-export slot and polymorphic types for convenience
export type { Slot, SlotObject, ResolvedSlot } from './slot';
export type { PolymorphicProps, PolymorphicComponent } from './polymorphic';
export { resolveSlot, renderSlot } from './slot';
