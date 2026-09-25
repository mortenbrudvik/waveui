/**
 * Shared class-string recipes. They are plain literals so Tailwind's scanner (`@source ../lib`)
 * generates every utility; compose them with `cn()` before the consumer's `className`.
 */

/** Focus-visible ring for focusable controls (C-FOCUS). */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Focus-visible ring drawn inside the element: cells, rows, list and menu items. */
export const focusRingInset =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

/** Ring on a container while any descendant has focus. */
export const focusWithinRing =
  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring';

/** Base look of text-entry controls (Input, Textarea, Select, picker inputs). */
export const inputBase =
  'h-8 w-full rounded border border-input bg-background px-3 text-body-1 text-foreground placeholder:text-muted-foreground';

/**
 * Focus indicator of text-entry controls: a 2px primary bottom border. `focus:outline-hidden`
 * removes the outline while focused but — unlike `outline-none` — keeps a visible outline in
 * forced-colors mode, where the border colour change is not perceivable. (Scoped to `:focus` so
 * unfocused inputs do not show that outline in forced colors.)
 */
export const inputFocus = 'focus:outline-hidden focus:border-b-2 focus:border-b-primary';

/**
 * Wrapper form of {@link inputFocus} for inputs rendered inside a styled wrapper (slots,
 * SearchBox, TagPicker). Put `focus:outline-hidden` on the inner control.
 */
export const inputFocusWithin = 'focus-within:border-b-2 focus-within:border-b-primary';

/**
 * Invalid look of a text-entry control (Input, Select, Textarea, SearchBox, SpinButton, Combobox,
 * Dropdown, the picker inputs): the destructive border, kept on the bottom stroke while focused.
 * Apply it when the control's resolved `aria-invalid` is `true` (its own error state, the
 * consumer's `aria-invalid` or the surrounding Field's), after {@link inputBase} and
 * {@link inputFocus} in `cn()` so it replaces their border colours.
 */
export const inputInvalid = 'border-destructive focus:border-b-destructive';

/**
 * Wrapper form of {@link inputInvalid} for a control drawn by a styled wrapper around the
 * focusable input (Input with slots, SpinButton), placed after {@link inputFocusWithin}.
 */
export const inputInvalidWithin = 'border-destructive focus-within:border-b-destructive';

/**
 * Disabled look for native `disabled` and `aria-disabled` (C-DISABLED) controls. An
 * `aria-disabled` control that keeps keyboard focus (a self-disabling Pagination or Carousel
 * button) goes back to full opacity while it shows its focus ring, which `opacity` would dim below
 * 3:1, as a `disabledFocusable` button does.
 */
export const disabledStyles =
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100';

/** Colour-transition recipe that is switched off for reduced motion (C-MOTION). */
export const motionSafeTransition = 'transition motion-reduce:transition-none';

const selectedLeaf =
  'forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none';

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
    'forced-colors:outline-2 forced-colors:outline-[Highlight] forced-colors:-outline-offset-2',
  /** Border of a control (Switch track, Checkbox box, Radio circle). */
  control: 'forced-colors:border-[ButtonText]',
  /** Border of a non-interactive surface (tracks, separators). */
  border: 'forced-colors:border-[CanvasText]',
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
  fill: 'forced-colors:bg-[Highlight] forced-colors:forced-color-adjust-none',
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
    'forced-colors:forced-color-adjust-none forced-colors:[&::-webkit-slider-runnable-track]:bg-[CanvasText] forced-colors:[&::-moz-range-track]:bg-[CanvasText] forced-colors:[&::-webkit-slider-thumb]:bg-[Highlight] forced-colors:[&::-webkit-slider-thumb]:border-[Canvas] forced-colors:[&::-moz-range-thumb]:bg-[Highlight] forced-colors:[&::-moz-range-thumb]:border-[Canvas] forced-colors:disabled:[&::-webkit-slider-runnable-track]:bg-[GrayText] forced-colors:disabled:[&::-moz-range-track]:bg-[GrayText] forced-colors:disabled:[&::-webkit-slider-thumb]:bg-[GrayText] forced-colors:disabled:[&::-moz-range-thumb]:bg-[GrayText] forced-colors:focus-visible:outline-[Highlight]',
  /**
   * Arc of a **ring drawn with borders** whose top side is the arc (Spinner): put it on the ring,
   * after its border classes. Forced colors would give all four sides the same system color, so
   * the arc would disappear into the track. It opts the ring out of forced colors, hides the
   * track in `Canvas` and draws the arc in `Highlight`. Leaf elements only, as with `fill`.
   */
  ringArc:
    'forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:border-t-[Highlight]',
  /** Disabled text and borders. */
  disabled: 'forced-colors:text-[GrayText] forced-colors:border-[GrayText]',
  /**
   * @deprecated Ambiguous: use `selectedLeaf` for leaf indicators or `selectedContainer` for
   * containers. Kept as an alias of `selectedLeaf`.
   */
  selected: selectedLeaf,
} as const;
