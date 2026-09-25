/**
 * Classes shared by the pickers of the combobox family (Combobox, Dropdown, TimePicker).
 * Component-private: not exported from the package.
 */

/**
 * An icon button at the end of a picker's control (its clear and expand buttons): a 24×24px
 * target that the caller positions (`end-1`, `end-7`) and gives `focusRing` and `disabledStyles`.
 * It sets its own padding and background (C-NATIVE: an app-wide `button` rule would otherwise pad
 * and fill it) and gates its hover colors on the enabled state.
 */
export const PICKER_ICON_BUTTON_CLASSES =
  'absolute flex h-6 w-6 items-center justify-center rounded bg-transparent p-0 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground';

/**
 * The end padding that keeps a picker's text clear of the buttons at its end: `pe-8` for one
 * button, `pe-14` for two, nothing without one.
 */
export function pickerEndPadding(buttons: number): string | undefined {
  if (buttons >= 2) return 'pe-14';
  return buttons === 1 ? 'pe-8' : undefined;
}
