/**
 * Classes shared by the pickers of the combobox family (Combobox, Dropdown, TimePicker).
 * Component-private: not exported from the package.
 */

import { cn } from '../../lib/cn';
import type { CoreSize, InputAppearance } from '../../lib/types';

/**
 * An icon button at the end of a picker's control (its clear and expand buttons): a 24×24px
 * target that the caller positions (`end-1`, `end-7`) and gives `focusRing` and `disabledStyles`.
 * It sets its own padding and background (C-NATIVE: an app-wide `button` rule would otherwise pad
 * and fill it) and gates its hover colors on the enabled state.
 */
export const PICKER_ICON_BUTTON_CLASSES =
  'absolute flex h-6 w-6 items-center justify-center rounded bg-transparent p-0 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground';

/** The button box of each size: 20px with a 24px hit layer, 24px (the 0.7 box) or 32px. */
const BUTTON_BOX: Readonly<Record<CoreSize, string>> = {
  small: 'size-5 before:absolute before:-inset-0.5',
  medium: '',
  large: 'size-8',
};

/**
 * The classes of a picker's icon button at a size and appearance (Phase 4 D11): the 0.7 classes,
 * the size's box and, on `filled-darker`, a hover fill one step darker than the field.
 */
export function pickerIconButtonClasses(
  size: CoreSize = 'medium',
  appearance: InputAppearance = 'outline',
): string {
  return cn(
    PICKER_ICON_BUTTON_CLASSES,
    BUTTON_BOX[size],
    appearance === 'filled-darker' && 'not-disabled:not-aria-disabled:hover:bg-subtle-pressed',
  );
}

const BUTTON_OFFSETS: Readonly<Record<CoreSize, readonly [string, string]>> = {
  small: ['end-1', 'end-7'],
  medium: ['end-1', 'end-7'],
  large: ['end-1', 'end-9'],
};

/** The inline-end offset of a picker's first or second icon button (the second sits before it). */
export function pickerButtonOffset(size: CoreSize, position: 1 | 2): string {
  return BUTTON_OFFSETS[size][position - 1];
}

const END_PADDINGS: Readonly<Record<CoreSize, readonly [string, string]>> = {
  small: ['pe-7', 'pe-13'],
  medium: ['pe-8', 'pe-14'],
  large: ['pe-10', 'pe-18'],
};

/** The glyph sizes of each size: the chevron, and the other icons (clear, calendar). */
const GLYPHS: Readonly<Record<CoreSize, { chevron: number; icon: number }>> = {
  small: { chevron: 12, icon: 12 },
  medium: { chevron: 12, icon: 16 },
  large: { chevron: 16, icon: 20 },
};

/** The pixel size of a picker glyph at a size. */
export function pickerGlyphSize(size: CoreSize, kind: 'chevron' | 'icon'): number {
  return GLYPHS[size][kind];
}

/**
 * The end padding that keeps a picker's text clear of the buttons at its end: per size and button
 * count (one or two buttons at the end). At medium (the default), `pe-8` for one button, `pe-14`
 * for two, nothing without one.
 */
export function pickerEndPadding(buttons: number, size: CoreSize = 'medium'): string | undefined {
  if (buttons <= 0) return undefined;
  return END_PADDINGS[size][buttons >= 2 ? 1 : 0];
}
