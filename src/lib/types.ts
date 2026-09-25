/** Component size affecting padding, font size, and spacing. */
export type Size = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';

/** Visual style variant controlling fill, border, and background treatment. */
export type Appearance = 'primary' | 'outline' | 'subtle' | 'transparent';

/** Visual style variant for Badge components. */
export type BadgeAppearance = 'filled' | 'tint' | 'outline';

/** Semantic colors of Badge and CounterBadge. */
export type BadgeColor =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'important'
  | 'informative'
  | 'severe'
  | 'subtle';

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

/** Where an icon renders relative to a label: the inline start (`before`) or end (`after`). */
export type IconPosition = 'before' | 'after';

/**
 * Validation state of a Field message: `error` (invalid; `role="alert"`), `warning`
 * (`role="alert"`, not invalid), `success`, or `none` (a neutral message).
 */
export type ValidationState = 'none' | 'error' | 'warning' | 'success';

/**
 * Where a label renders relative to its control or indicator. Components accept a subset,
 * derived with `Extract<LabelPosition, …>` (never `Exclude<>`, so a later value does not widen
 * them silently): Checkbox `'before' | 'after'`, Switch `'before' | 'after' | 'above'`.
 */
export type LabelPosition = 'before' | 'after' | 'above' | 'below';

/** Second argument of an `onOpenChange` callback: why the open state changes, and the event. */
export interface OpenChangeDetails<R extends string = string> {
  /** What asked for the change. */
  reason: R;
  /** The DOM event behind the request. */
  event: Event;
}

/**
 * Why a Dialog or Drawer asks to open or close: `trigger` (its Trigger part), `close` (a
 * `.Close` part), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The last two are `DismissReason` values of the dismiss-layer stack.
 */
export type ModalOpenChangeReason =
  | 'trigger'
  | 'close'
  | 'close-button'
  | 'escape'
  | 'outside-press';

/** How a modal surface blocks the page (`'non-modal'` joins in a later release). */
export type ModalType = 'modal' | 'alert';

// Re-export slot and polymorphic types for convenience
export type { Slot, SlotObject, ResolvedSlot } from './slot';
export type { PolymorphicProps, PolymorphicComponent } from './polymorphic';
export { resolveSlot, renderSlot } from './slot';
