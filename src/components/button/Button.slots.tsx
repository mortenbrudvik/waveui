/**
 * How the slots of other components treat a `<button>` or Wave `Button` passed to them (C-SLOTS).
 * Internal (not exported from the package).
 *
 * - Dismiss and clear slots (MessageBar `dismiss`, SearchBox `dismiss`, Tag `dismissIcon`) merge
 *   it into their own wired `<button>`. {@link BUTTON_OWN_PROP_KEYS} lists the Button props that
 *   must not reach that element; {@link placeButtonIcon} and {@link MERGED_DISABLED_FOCUSABLE_PROPS}
 *   give it what the Button would have done with `icon`, `iconPosition` and `disabledFocusable`.
 * - Glyph slots inside a wired button (SplitButton and MenuButton `menuIcon`, Combobox and
 *   TimePicker `expandIcon`) unwrap it: {@link unwrapButtonGlyph}.
 */
import * as React from 'react';
import { focusableDisabledProps } from '../../lib/aria';
import { isElementOfType } from '../../lib/children';
import type { Slot } from '../../lib/slot';
import { Button } from './Button';
import type { ButtonOwnProps } from './Button';

/**
 * The keys of {@link BUTTON_OWN_PROP_KEYS}, checked against `ButtonOwnProps`: a new own prop of
 * `Button` does not compile until it is listed here, so it cannot leak onto a wired button.
 */
const buttonOwnPropKeys = {
  as: true,
  appearance: true,
  size: true,
  icon: true,
  iconPosition: true,
  disabledFocusable: true,
} satisfies Record<Exclude<keyof ButtonOwnProps, 'disabled'> | 'as', true>;

/**
 * The props of a Wave `Button` that are not DOM attributes: `as` and every own prop except
 * `disabled` (a native attribute, merged as one). A component that merges a `Button` into its own
 * `<button>` never spreads these onto it; it applies `icon`, `iconPosition` and
 * `disabledFocusable` itself.
 */
export const BUTTON_OWN_PROP_KEYS: ReadonlySet<string> = new Set(Object.keys(buttonOwnPropKeys));

/**
 * The content of a wired button that merged a Wave `Button`: the Button's decorative icon before
 * its content, or after it for `iconPosition="after"`, as `Button` renders it (DOM order, so it
 * follows the writing direction).
 *
 * @param icon The rendered icon (`aria-hidden`), or `null`.
 * @param content The Button's content.
 * @param iconPosition The Button's `iconPosition` (anything but `'after'` means before).
 */
export function placeButtonIcon(
  icon: React.ReactNode,
  content: React.ReactNode,
  iconPosition: unknown,
): React.ReactElement {
  return iconPosition === 'after' ? (
    <>
      {content}
      {icon}
    </>
  ) : (
    <>
      {icon}
      {content}
    </>
  );
}

/** Prevents a click and stops it, as a natively disabled button dispatches none to ancestors. */
function blockClick(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Spread last on a wired button that merged a Wave `Button` with `disabledFocusable`, so it
 * behaves as that Button would: `aria-disabled`, `data-disabled` and `data-disabled-focusable`
 * instead of the native `disabled` (overridden: `disabledFocusable` wins over `disabled`), so it
 * keeps its tab stop; its click is prevented and stopped, so neither the merged `onClick` nor the
 * component's own action runs and no ancestor click handler sees it. A native `<button>` also
 * activates through a click for Enter, Space and implicit form submission, so those are blocked
 * too.
 */
export const MERGED_DISABLED_FOCUSABLE_PROPS = {
  ...focusableDisabledProps(true, { reachable: true }),
  disabled: false,
  onClick: blockClick,
};

/**
 * The disabled look of a wired dismiss or clear button while `aria-disabled` (a merged
 * `disabledFocusable`, or a consumer `aria-disabled`): dimmed like a disabled button, except while
 * it shows its focus ring, which `opacity` would dim too.
 */
export const mergedAriaDisabledClasses =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100';

/** What {@link unwrapButtonGlyph} unwrapped, for the slot's development warning. */
export type UnwrappedButton = 'a button element' | 'a slot object that renders a button';

/** Whether `value` is a slot object (`{ as, children, … }`) that renders a `<button>` or `Button`. */
function isButtonSlotObject(value: unknown): value is { children?: React.ReactNode } {
  if (typeof value !== 'object' || value === null || React.isValidElement(value)) return false;
  if (Symbol.iterator in value || !('as' in value)) return false;
  const { as } = value as { as?: unknown };
  return as === 'button' || as === Button;
}

/**
 * A glyph slot's value with a button unwrapped. A glyph inside a wired button is decorative and a
 * button cannot contain a button (C-SLOTS), so for a `<button>` or `Button` element, or a slot
 * object whose `as` is `'button'` or `Button`, the glyph is its `children` and its props are
 * dropped; any other value is the glyph as given. `button` says what was unwrapped (`null`:
 * nothing), so the component can warn once from an effect. A `Button` written in a Server
 * Component (a lazy client reference) is unwrapped too.
 *
 * @example
 * const { glyph, button } = unwrapButtonGlyph(menuIcon);
 */
export function unwrapButtonGlyph(slot: Slot<'span'> | undefined): {
  glyph: Slot<'span'> | undefined;
  button: UnwrappedButton | null;
} {
  // A slot object is never an element, so any slot value can be checked as a node.
  const node = slot as React.ReactNode;
  if (isElementOfType<{ children?: React.ReactNode }>(node, 'button', Button)) {
    return { glyph: node.props.children, button: 'a button element' };
  }
  if (isButtonSlotObject(slot)) {
    return { glyph: slot.children, button: 'a slot object that renders a button' };
  }
  return { glyph: slot, button: null };
}
