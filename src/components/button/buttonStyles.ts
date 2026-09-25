/**
 * Shared class maps of the button family (Button, ToggleButton, MenuButton, SplitButton,
 * CompoundButton). Internal to `src/components/button/` (spec §5.7): other packages render the
 * public `Button` instead of importing these maps.
 *
 * Rules (C-TOKENS, C-FOCUS, C-MOTION):
 * - Theme tokens only — the maps follow the provider theme (light, dark, high contrast).
 * - Hover and pressed styles are gated with the literal prefixes
 *   `not-disabled:not-aria-disabled:hover:` / `not-disabled:not-aria-disabled:active:`, so they
 *   work for `<a>` and `role="button"` elements (`Button as="a"`) and never fire on a disabled or
 *   `aria-disabled` control. The `enabled:` variant is never used (it only matches form controls).
 * - The gate raises the specificity of those classes (`:not(:disabled):not([aria-disabled="true"])
 *   :hover` is 0,4,0; a bare `hover:` class is 0,2,0), and `cn()` keeps both because their variants
 *   differ. A consumer overrides a hover/pressed color with the same gate prefix
 *   (`not-disabled:not-aria-disabled:hover:bg-error`, which `cn()` merges over the built-in class)
 *   or with the important modifier (`hover:bg-error!`).
 * - Class strings stay literal so Tailwind's scanner sees every utility.
 */
import { cn } from '../../lib/cn';
import { focusRing, forcedColors } from '../../lib/styles';
import type { Appearance, Size } from '../../lib/types';

/**
 * Layout, typography, focus ring and color transition shared by every button. `no-underline`
 * keeps `Button as="a"` from showing the browser's link underline.
 */
export const buttonBaseClasses = `inline-flex items-center justify-center rounded font-semibold no-underline transition-colors motion-reduce:transition-none ${focusRing}`;

/**
 * Height, horizontal padding, minimum width and font size per size. The font size grows with the
 * ramp: 10 / 12 / 14 / 16 / 18 px (extra-large is larger than large).
 *
 * Every font size is in px, so the order holds at any root font size: the type-ramp tokens
 * (`text-caption-2` … `text-body-2`) are px, and extra-large uses `text-[18px]/[24px]` (Fluent's
 * base 450 step, which the Wave type ramp does not have). A rem size (Tailwind's 1.125rem step)
 * would shrink below the 16px large size in an app with a root font size under about 14.2px.
 */
export const buttonSizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 min-w-24 px-1.5 text-caption-2',
  small: 'h-6 min-w-24 px-2 text-caption-1',
  medium: 'h-8 min-w-24 px-3 text-body-1',
  large: 'h-10 min-w-24 px-4 text-body-2',
  'extra-large': 'h-12 min-w-24 px-5 text-[18px]/[24px]',
};

/** Square sizes for icon-only buttons (no minimum width, no horizontal padding). */
export const buttonIconOnlySizeClasses: Record<Size, string> = {
  'extra-small': 'h-5 w-5 px-0 text-caption-2',
  small: 'h-6 w-6 px-0 text-caption-1',
  medium: 'h-8 w-8 px-0 text-body-1',
  large: 'h-10 w-10 px-0 text-body-2',
  'extra-large': 'h-12 w-12 px-0 text-[18px]/[24px]',
};

/**
 * Colors per appearance. Every appearance draws a 1px border (transparent unless `outline`) so all
 * appearances have the same size and forced-colors mode shows the button's edge.
 */
export const buttonAppearanceClasses: Record<Appearance, string> = {
  primary:
    'border border-transparent bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed',
  outline:
    'border border-stroke bg-background text-foreground not-disabled:not-aria-disabled:hover:border-stroke-hover not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  subtle:
    'border border-transparent bg-transparent text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  transparent:
    'border border-transparent bg-transparent text-primary not-disabled:not-aria-disabled:hover:underline',
};

/**
 * Pressed/checked colors per appearance (ToggleButton). Layer them **after** the appearance
 * classes with `cn()` (or use `buttonClassName({ pressed: true })`); tailwind-merge then replaces
 * the conflicting appearance colors. Hover keeps the pressed color so the state stays visible.
 */
export const buttonPressedClasses: Record<Appearance, string> = {
  primary:
    'bg-primary-pressed text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-pressed',
  outline:
    'border-primary bg-selected text-selected-foreground not-disabled:not-aria-disabled:hover:border-primary not-disabled:not-aria-disabled:hover:bg-selected',
  subtle: 'bg-selected text-selected-foreground not-disabled:not-aria-disabled:hover:bg-selected',
  transparent:
    'bg-selected text-selected-foreground not-disabled:not-aria-disabled:hover:bg-selected',
};

/**
 * The accessible pressed colors per appearance (ToggleButton `isAccessible`): a brand fill with
 * on-brand text, so the state never depends on a light tint; `primary`, already a brand fill,
 * keeps its pressed fill and adds an inset on-brand stroke. Layer them after the appearance
 * classes, in place of {@link buttonPressedClasses} (`buttonClassName({ pressed: true,
 * accessible: true })`). The forced-colors treatment is the same as without them.
 */
export const buttonPressedAccessibleClasses: Record<Appearance, string> = {
  primary:
    'bg-primary-pressed text-primary-foreground inset-ring-2 inset-ring-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-pressed',
  outline:
    'border-primary bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:border-primary-hover not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed',
  subtle:
    'bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed',
  transparent:
    'bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-pressed',
};

/**
 * Forced-colors treatment of a pressed button: the **container** recipe, a Highlight outline inside
 * a Highlight border. Never `forcedColors.selectedLeaf`: a button is a container, and the
 * inherited `forced-color-adjust: none` would take its label, icons, child content and focus ring
 * out of forced colors.
 */
const buttonPressedForcedColors = `${forcedColors.selectedContainer} forced-colors:border-[Highlight]`;

/**
 * Pressed and disabled: the pressed outline turns GrayText like the disabled text and border (a
 * Highlight indicator next to GrayText would read as available).
 */
const buttonPressedDisabledForcedColors = 'forced-colors:outline-[GrayText]';

/**
 * Disabled look (native `disabled`, `aria-disabled` or a non-button `as`), incl. forced colors.
 * `opacity` dims the element's own focus ring too, so a focusable disabled button
 * (`disabledFocusable`, a consumer `aria-disabled`) shows at full opacity while its ring is
 * visible: the ring keeps its 3:1 contrast, and `aria-disabled` still reports the state.
 */
export const buttonDisabledClasses = `cursor-not-allowed opacity-50 aria-disabled:focus-visible:opacity-100 ${forcedColors.disabled}`;

/** Options of {@link buttonClassName}. */
export interface ButtonClassNameOptions {
  /** @default 'outline' */
  appearance?: Appearance;
  /** @default 'medium' */
  size?: Size;
  /** Adds the disabled look. @default false */
  disabled?: boolean;
  /** Square, icon-only sizing without a minimum width. @default false */
  iconOnly?: boolean;
  /** Adds the pressed/checked colors (ToggleButton). @default false */
  pressed?: boolean;
  /**
   * With `pressed`: the accessible pressed colors ({@link buttonPressedAccessibleClasses}) instead
   * of the selected tint. No effect on an unpressed button. @default false
   */
  accessible?: boolean;
}

/**
 * The complete class string of a button: base, size (or icon-only size), appearance, and the
 * optional pressed and disabled layers. Consumers' `className` goes after it in `cn()`.
 *
 * @example
 * <button className={cn(buttonClassName({ appearance: 'primary', size: 'small' }), className)} />
 */
export function buttonClassName({
  appearance = 'outline',
  size = 'medium',
  disabled = false,
  iconOnly = false,
  pressed = false,
  accessible = false,
}: ButtonClassNameOptions = {}): string {
  return cn(
    buttonBaseClasses,
    iconOnly ? buttonIconOnlySizeClasses[size] : buttonSizeClasses[size],
    buttonAppearanceClasses[appearance],
    pressed && (accessible ? buttonPressedAccessibleClasses : buttonPressedClasses)[appearance],
    pressed && buttonPressedForcedColors,
    disabled && buttonDisabledClasses,
    pressed && disabled && buttonPressedDisabledForcedColors,
  );
}
