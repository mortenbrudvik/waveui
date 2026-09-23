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

/** Disabled look for native `disabled` and `aria-disabled` (C-DISABLED) controls. */
export const disabledStyles =
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

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
  /** Fill that must stay visible (ProgressBar fill, Slider range). */
  fill: 'forced-colors:bg-[Highlight]',
  /** Disabled text and borders. */
  disabled: 'forced-colors:text-[GrayText] forced-colors:border-[GrayText]',
  /**
   * @deprecated Ambiguous: use `selectedLeaf` for leaf indicators or `selectedContainer` for
   * containers. Kept as an alias of `selectedLeaf`.
   */
  selected: selectedLeaf,
} as const;
