/** Component size affecting padding, font size, and spacing. */
export type Size = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';

/** Visual style variant controlling fill, border, and background treatment. */
export type Appearance = 'primary' | 'outline' | 'subtle' | 'transparent';

/** Visual style variant for Badge components. */
export type BadgeAppearance = 'filled' | 'tint' | 'outline';

/** Semantic colors of Badge and CounterBadge. */
export type BadgeColor =
  'brand' | 'success' | 'warning' | 'danger' | 'important' | 'informative' | 'severe' | 'subtle';

/** Semantic status used for alerts, messages, and status indicators. */
export type Status = 'success' | 'warning' | 'error' | 'info';

/**
 * The 0.5 spellings of two presence statuses. They still work and warn once in development; use
 * `'do-not-disturb'` and `'out-of-office'` instead. Removed in 1.0.
 */
export type DeprecatedPresenceStatus = 'dnd' | 'oof';

/**
 * User presence status for Avatar and Persona components. `'dnd'` and `'oof'` are deprecated
 * aliases of `'do-not-disturb'` and `'out-of-office'` ({@link DeprecatedPresenceStatus}).
 */
export type PresenceStatus =
  | 'available'
  | 'busy'
  | 'away'
  | 'offline'
  | 'do-not-disturb'
  | 'out-of-office'
  | DeprecatedPresenceStatus;

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

/**
 * The three-step size of text inputs, pickers, Field and Label (Fluent's field sizes): `small`
 * (24px tall), `medium` (32px) and `large` (40px).
 */
export type CoreSize = Extract<Size, 'small' | 'medium' | 'large'>;

/**
 * Size of an overlay surface: Dialog.Content's width cap, a Drawer's width (its height at the
 * bottom). `small`, `medium`, `large`, or `full`, the whole viewport.
 */
export type SurfaceSize = CoreSize | 'full';

/**
 * Look of a text input or picker: `outline` (a full border), `underline` (a bottom stroke only),
 * `filled-darker` or `filled-lighter` (a fill without a visible stroke).
 */
export type InputAppearance = 'outline' | 'underline' | 'filled-darker' | 'filled-lighter';

/** Geometry of a surface (Image, Skeleton, SwatchPicker, …). */
export type Shape = 'circular' | 'square' | 'rounded';

/** Size of a tag (Fluent's `TagSize`): `extra-small` (20px tall), `small` (24px) or `medium` (28px). */
export type TagSize = Extract<Size, 'extra-small' | 'small' | 'medium'>;

/** Colour scheme of a tag (Fluent's `TagAppearance`): a neutral fill, a border, or a light brand tint. */
export type TagAppearance = 'filled' | 'outline' | 'brand';

/** Corners of a tag (Fluent's `TagShape`): `circular` (a pill) or `rounded` (4px). */
export type TagShape = Extract<Shape, 'rounded' | 'circular'>;

/**
 * A color in HSV (Fluent's `HsvColor`): `h` is the hue in degrees (0–360), `s` the saturation, `v`
 * the brightness (value) and `a` the opacity, each from 0 to 1. Without `a` the color is opaque.
 */
export interface HsvColor {
  /** Hue in degrees, 0–360. */
  h: number;
  /** Saturation, 0–1. */
  s: number;
  /** Brightness (value), 0–1. */
  v: number;
  /** Opacity, 0–1; left out means opaque. */
  a?: number;
}

/** The shape of ColorPicker and its color parts (a subset of `Shape`). */
export type ColorPickerShape = Extract<Shape, 'rounded' | 'square'>;

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
  'trigger' | 'close' | 'close-button' | 'escape' | 'outside-press';

/**
 * How a Dialog or Drawer relates to the page (Fluent's `modalType`). `modal`: a backdrop dims the
 * page, focus stays in the surface, the rest of the page is `inert` and does not scroll. `alert`:
 * modal, for a confirmation that needs an answer (`role="alertdialog"`; a backdrop press does not
 * close it). `non-modal`: the page stays usable (no backdrop, no focus trap, nothing inert, the
 * page scrolls).
 */
export type ModalType = 'modal' | 'alert' | 'non-modal';

/** How a modal surface's backdrop paints the page: `dimmed`, or `transparent` (a modal over another). */
export type BackdropAppearance = 'dimmed' | 'transparent';

/** Level of a heading element, `<h1>` … `<h6>`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How the keyboard reaches the items of a set: `'tab'`, every item is a Tab stop and the arrow
 * keys do nothing; `'arrow'`, the set is one Tab stop and the arrow keys move between its items.
 */
export type FocusMode = 'tab' | 'arrow';

/**
 * Checked items of a menu or toolbar, per group `name`: `{ sort: ['date'], view: ['ruler', 'grid'] }`.
 * A checkbox or switch item (or a toolbar toggle) is checked while its `value` is in
 * `checkedValues[name]`, and so is a radio item (or a toolbar radio); checking a radio makes its
 * value the group's only value, so give a radio group at most one value. Any string is a group
 * name, `Object.prototype` keys such as `constructor` included.
 */
export type CheckedValues = Readonly<Record<string, readonly string[]>>;

/** Second argument of `onCheckedValuesChange`: the group that changed, its new items and the event. */
export interface CheckedValuesChangeDetails {
  /** The `name` of the group that changed. */
  name: string;
  /** The checked values of that group after the change (a new array). */
  checkedItems: string[];
  /** The DOM event behind the change (the item's click). */
  event: Event;
}

/**
 * Signature of `onCheckedValuesChange` (Menu, Toolbar): the new checked values first, then the
 * details. WaveUI always passes `details`; it is typed optional until 1.0 (read it as
 * `details?.name`), like `onOpenChange`'s.
 */
export type CheckedValuesChangeHandler = (
  checkedValues: Record<string, string[]>,
  details?: CheckedValuesChangeDetails,
) => void;

/** A rectangle in viewport coordinates, as `getBoundingClientRect()` returns it (a `DOMRect` is one). */
export interface PopupRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * A positioning anchor that is not an element: a rectangle read on demand, such as the pointer
 * position of a context menu or a text selection. `contextElement` is the element whose scroll
 * containers move the anchor (the surface follows them); without it only window scroll and resize
 * reposition the surface.
 */
export interface VirtualElement {
  getBoundingClientRect(): PopupRect;
  contextElement?: Element;
}

/**
 * Where a popup is placed instead of next to its trigger (`Menu.Popover`, `Popover` and
 * `TeachingPopover` `target`): an element held in state, or a `VirtualElement`. Those components
 * also take a ref object (`PopupPositioning['target']`).
 */
export type PopupTarget = HTMLElement | VirtualElement | null;

/**
 * What a popup's `target` prop accepts: a {@link PopupTarget}, or a ref object (an element that
 * attaches without the popup rendering is read after each render of the popup).
 */
export type PopupTargetInput = PopupTarget | { readonly current: HTMLElement | null };

/** A placement for `PopupPositioning.fallbackPlacements`: a side, and optionally an alignment on it. */
export interface PopupPlacement {
  /** Side of the anchor. `start` and `end` follow the writing direction. */
  side: PopupSide;
  /** Alignment along that side. @default the surface's own `align` */
  align?: PopupAlign;
}

/**
 * The advanced positioning options of a popup (the `positioning` prop; Fluent's `positioning`).
 * `side` and `align` stay separate props of each component, so every option has one source.
 */
export interface PopupPositioning {
  /** Distance from the anchor in px. @default the component's own (Popover 8, Tooltip 8, TeachingPopover 12, listboxes 4) */
  offset?: number;
  /**
   * Limit the surface to the space the viewport leaves (Fluent's `autoSize`). Popover also scrolls
   * its content inside its border; the other surfaces only limit their size (their own lists and
   * grids scroll as they always did).
   * @default the component's own
   */
  fitViewport?: boolean;
  /** Make the surface as wide as its anchor. @default the component's own */
  matchReferenceWidth?: boolean;
  /** Placements to try, in order, when the requested side has no room; replaces the opposite side. */
  fallbackPlacements?: readonly PopupPlacement[];
  /** Position against this instead of the trigger. */
  target?: PopupTargetInput;
}

/** {@link PopupPositioning} without `target`: the options of a popup that has no `target` prop. */
export type PopupPositioningOptions = Omit<PopupPositioning, 'target'>;

/** A day of the week, as `Date.prototype.getDay()` numbers them: 0 is Sunday, 6 is Saturday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Which week is week 1 of a year: the week of January 1 (`'first-day'`), the first week that lies
 * wholly in the year (`'first-full-week'`), or the first week with at least four days in the year
 * (`'first-four-day-week'`, ISO 8601 when weeks start on Monday).
 */
export type FirstWeekOfYear = 'first-day' | 'first-full-week' | 'first-four-day-week';

/**
 * Replaces a part's default motion (its `motion`, `backdropMotion`, `expandIconMotion` or
 * `indeterminateMotion` prop): a class string, or `{ className }`. `null` on the prop turns the
 * motion off and `undefined` keeps the default. On a part with presence phases (a surface, a
 * backdrop, a collapsing part, a toast, a bar of a MessageBarGroup), write the phases as the
 * default motion does: the enter's start with the starting variant gated on the entering phase
 * (`data-[presence=entering]:starting:…`), the exit with `data-[presence=exiting]:…`, and a
 * reduced-motion counterpart. The other parts (a Nav category's expand icon, ProgressBar's
 * indeterminate fill, TabList's selection line) have no phases: give them plain transition or
 * animation classes with a reduced-motion counterpart. The classes must exist in your CSS: the
 * precompiled stylesheet holds only Wave's own classes, so without Tailwind pass a class of your
 * own CSS (written against `[data-presence]` for a part with phases).
 */
export type MotionSlot = string | { className: string };

/** Motion below a `WaveProvider`: `'default'`, or `'none'` (every motion slot acts as `null`). */
export type MotionPreference = 'default' | 'none';

// Re-export slot and polymorphic types for convenience
export type { Slot, SlotObject, ResolvedSlot } from './slot';
export type { PolymorphicProps, PolymorphicComponent } from './polymorphic';
export { resolveSlot, renderSlot } from './slot';
