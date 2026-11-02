/**
 * Shared class-string recipes. They are plain literals so Tailwind's scanner (`@source ../lib`)
 * generates every utility; compose them with `cn()` before the consumer's `className`.
 */
import type { CoreSize, InputAppearance } from './types';

/** Focus-visible ring for focusable controls (C-FOCUS). */
export const focusRing =
  'wave:focus-visible:outline-2 wave:focus-visible:outline-offset-2 wave:focus-visible:outline-ring';

/** Focus-visible ring drawn inside the element: cells, rows, list and menu items. */
export const focusRingInset =
  'wave:focus-visible:outline-2 wave:focus-visible:-outline-offset-2 wave:focus-visible:outline-ring';

/** Ring on a container while any descendant has focus. */
export const focusWithinRing =
  'wave:focus-within:outline-2 wave:focus-within:outline-offset-2 wave:focus-within:outline-ring';

/**
 * Base look of text-entry controls (Input, Textarea, Select, picker inputs).
 * @deprecated Compose inputHeightClasses, inputTextClasses, inputPaddingClasses and
 * inputAppearanceClasses.
 */
export const inputBase =
  'wave:h-8 wave:w-full wave:rounded wave:border wave:border-input wave:bg-background wave:px-3 wave:text-body-1 wave:text-foreground wave:placeholder:text-muted-foreground';

/** Height of a text control or picker per size: 24, 32 or 40px. */
export const inputHeightClasses: Readonly<Record<CoreSize, string>> = {
  small: 'wave:h-6',
  medium: 'wave:h-8',
  large: 'wave:h-10',
};

/** Type ramp of a text control or picker per size. */
export const inputTextClasses: Readonly<Record<CoreSize, string>> = {
  small: 'wave:text-caption-1',
  medium: 'wave:text-body-1',
  large: 'wave:text-body-2',
};

/** Horizontal padding of a text control drawn on its own element, per size: 8, 12 or 16px. */
export const inputPaddingClasses: Readonly<Record<CoreSize, string>> = {
  small: 'wave:px-2',
  medium: 'wave:px-3',
  large: 'wave:px-4',
};

/**
 * Fill, strokes and corners of each appearance, for a field drawn on its own element or on a
 * wrapper. Compose the focus and invalid recipes after it: they recolor the borders the appearance
 * draws. The filled appearances have a transparent stroke (a visible one in the high-contrast
 * theme). In forced colors, the filled appearances and the one with only a bottom stroke draw their
 * border in the system's button text color, so every appearance keeps a visible boundary.
 */
export const inputAppearanceClasses: Readonly<Record<InputAppearance, string>> = {
  outline:
    'wave:rounded wave:border wave:border-input wave:border-b-stroke-accessible wave:bg-background',
  underline:
    'wave:rounded-none wave:border-0 wave:border-b wave:border-b-stroke-accessible wave:bg-transparent wave:forced-colors:border-[ButtonText]',
  'filled-darker':
    'wave:rounded wave:border wave:border-input-filled-stroke wave:bg-input-filled-darker wave:forced-colors:border-[ButtonText]',
  'filled-lighter':
    'wave:rounded wave:border wave:border-input-filled-stroke wave:bg-input-filled-lighter wave:forced-colors:border-[ButtonText]',
};

/**
 * Extends a 20px control's pointer target to 24px (WCAG 2.5.8): a transparent layer 2px beyond
 * each edge. The element must be positioned: the picker buttons already are, and any other element
 * sets its own position (the recipe sets none, because cn() would then replace the position of a
 * picker button).
 */
export const hitAreaLayer = 'wave:before:absolute wave:before:-inset-0.5';

/**
 * Focus indicator of text-entry controls: a 2px primary bottom border. `focus:outline-hidden`
 * removes the outline while focused but — unlike `outline-none` — keeps a visible outline in
 * forced-colors mode, where the border colour change is not perceivable. (Scoped to `:focus` so
 * unfocused inputs do not show that outline in forced colors.)
 */
export const inputFocus =
  'wave:focus:outline-hidden wave:focus:border-b-2 wave:focus:border-b-primary';

/**
 * Wrapper form of {@link inputFocus} for inputs rendered inside a styled wrapper (slots,
 * SearchBox, TagPicker). Put `focus:outline-hidden` on the inner control.
 */
export const inputFocusWithin = 'wave:focus-within:border-b-2 wave:focus-within:border-b-primary';

/**
 * Invalid look of a text-entry control (Input, Select, Textarea, SearchBox, SpinButton, Combobox,
 * Dropdown, the picker inputs), for every appearance: the destructive color on every border the
 * appearance draws. Apply it when the control's resolved `aria-invalid` is `true`, after the
 * appearance and {@link inputFocus} in `cn()`: while the control is focused, the focus recipe
 * colors the 2px bottom border and the other borders stay destructive.
 */
export const inputInvalid = 'wave:border-destructive';

/**
 * Wrapper form of {@link inputInvalid} for a control drawn by a styled wrapper around the
 * focusable input (Input with slots, SearchBox, SpinButton, TagPicker), placed after
 * {@link inputFocusWithin}.
 */
export const inputInvalidWithin = 'wave:border-destructive';

/**
 * Disabled look for native `disabled` and `aria-disabled` (C-DISABLED) controls. An
 * `aria-disabled` control that keeps keyboard focus (a self-disabling Pagination or Carousel
 * button) goes back to full opacity while it shows its focus ring, which `opacity` would dim below
 * 3:1, as a `disabledFocusable` button does.
 */
export const disabledStyles =
  'wave:disabled:cursor-not-allowed wave:disabled:opacity-50 wave:aria-disabled:cursor-not-allowed wave:aria-disabled:opacity-50 wave:aria-disabled:focus-visible:opacity-100';

/** Colour-transition recipe that is switched off for reduced motion (C-MOTION). */
export const motionSafeTransition = 'wave:transition wave:motion-reduce:transition-none';

const selectedLeaf =
  'wave:forced-colors:bg-[Highlight] wave:forced-colors:text-[HighlightText] wave:forced-colors:forced-color-adjust-none';

/**
 * Forced-colors (Windows High Contrast) recipes, built from system colours.
 */
export const forcedColors = {
  /**
   * Selected/checked state of a **leaf indicator** — Switch thumb, check glyph, radio dot,
   * progress fill, selected day cell. Opts the element out of forced colours so the Highlight
   * fill shows. Never use it on containers: `forced-color-adjust` is inherited and would opt
   * every descendant (text, icons) of a row/option/card out of forced colours too.
   */
  selectedLeaf,
  /**
   * Selected state of a **container** — options, rows, cards, tabs. A Highlight outline as the
   * non-colour indicator; the browser keeps system colours for the content.
   */
  selectedContainer:
    'wave:forced-colors:outline-2 wave:forced-colors:outline-[Highlight] wave:forced-colors:-outline-offset-2',
  /** Border of a control (Switch track, Checkbox box, Radio circle). */
  control: 'wave:forced-colors:border-[ButtonText]',
  /** Border of a non-interactive surface (tracks, separators). */
  border: 'wave:forced-colors:border-[CanvasText]',
  /**
   * Fill of a **leaf indicator drawn with its own background** that must stay visible in forced
   * colors, where author backgrounds become Canvas: a step dot or connector, a pager dot, a
   * progress segment. Paints `Highlight` and opts the element out of forced colors
   * (`forced-color-adjust` is inherited: leaf elements only, as with `selectedLeaf`).
   *
   * It only colors the element's own background, so it cannot reach an indicator drawn by a
   * pseudo-element or a border: use `rangeInput` for a native range input (Slider) and `ringArc`
   * for a border-drawn ring (Spinner).
   */
  fill: 'wave:forced-colors:bg-[Highlight] wave:forced-colors:forced-color-adjust-none',
  /**
   * A native `<input type="range">` drawn through its track and thumb pseudo-elements (Slider):
   * put it on the input, after the normal-mode classes. It opts the input out of forced colors
   * and, because the pseudo-elements inherit that opt-out, gives every part the input paints a
   * system color: the rail `CanvasText`, the thumb `Highlight` with a `Canvas` edge, rail and
   * thumb `GrayText` while disabled, and the focus-visible outline `Highlight` (the opt-out would
   * otherwise keep the author ring color). Covers the Blink/WebKit (`::-webkit-slider-*`) and
   * Firefox (`::-moz-range-*`) parts.
   */
  rangeInput:
    'wave:forced-colors:forced-color-adjust-none wave:forced-colors:[&::-webkit-slider-runnable-track]:bg-[CanvasText] wave:forced-colors:[&::-moz-range-track]:bg-[CanvasText] wave:forced-colors:[&::-webkit-slider-thumb]:bg-[Highlight] wave:forced-colors:[&::-webkit-slider-thumb]:border-[Canvas] wave:forced-colors:[&::-moz-range-thumb]:bg-[Highlight] wave:forced-colors:[&::-moz-range-thumb]:border-[Canvas] wave:forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-[GrayText] wave:forced-colors:disabled:[&::-moz-range-track]:bg-[GrayText] wave:forced-colors:disabled:[&::-webkit-slider-thumb]:bg-[GrayText] wave:forced-colors:disabled:[&::-moz-range-thumb]:bg-[GrayText] wave:forced-colors:focus-visible:outline-[Highlight]',
  /**
   * Arc of a **ring drawn with borders** whose top side is the arc (Spinner): put it on the ring,
   * after its border classes. Forced colors would give all four sides the same system color, so
   * the arc would disappear into the track. It opts the ring out of forced colors, hides the
   * track in `Canvas` and draws the arc in `Highlight`. Leaf elements only, as with `fill`.
   */
  ringArc:
    'wave:forced-colors:forced-color-adjust-none wave:forced-colors:border-[Canvas] wave:forced-colors:border-t-[Highlight]',
  /** Disabled text and borders. */
  disabled: 'wave:forced-colors:text-[GrayText] wave:forced-colors:border-[GrayText]',
  /**
   * @deprecated Ambiguous: use `selectedLeaf` for leaf indicators or `selectedContainer` for
   * containers. Kept as an alias of `selectedLeaf`.
   */
  selected: selectedLeaf,
} as const;
