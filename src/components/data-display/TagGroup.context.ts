import * as React from 'react';

/*
 * The internal state of the tag family: Tag, and later TagGroup, InteractionTag and the seams
 * TagPicker reads. Module-only (never exported from a barrel), and it imports no component, so a
 * module that reads it (Tag) holds no TagGroup or InteractionTag code.
 */

/** What {@link useHeldFocus} returns for one tag control. */
export interface HeldFocus {
  /**
   * Whether the control is held: it became disabled while it had focus, so it renders the
   * focusable disabled state (`aria-disabled`, `data-disabled`, `data-disabled-focusable`, its
   * click blocked) instead of the native `disabled` until focus leaves it. Always `false` while
   * the control is enabled.
   */
  held: boolean;
  /**
   * Records that the control has focus (an event whose target is the control itself). Compose it
   * after the consumer's handler with `{ checkDefaultPrevented: false }`.
   */
  onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  /**
   * Records that focus left the control, which ends the hold. A blur after which focus went
   * nowhere (`relatedTarget` is `null` and the document has no focus: the window lost focus to
   * another app or tab) leaves the control the active element, so it keeps the hold. Compose it
   * after the consumer's handler with `{ checkDefaultPrevented: false }`.
   */
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
}

/**
 * Keeps a tag control that is disabled while it has focus focusable until focus leaves it (Tag's
 * Dismiss button and link root, InteractionTag's buttons): the browser drops focus to the page
 * from a control that becomes natively disabled, and a standalone tag has no neighbour to move it
 * to. Render the native `disabled` while `disabled && !held`, the focusable disabled state while
 * `held`. The hold is adjusted during render from the previous `disabled`, never in an effect.
 *
 * @param disabled The control's effective `disabled` (its own, its tag's, its group's).
 *
 * @example
 * const hold = useHeldFocus(disabled);
 * <button
 *   type="button"
 *   {...(disabled ? (hold.held ? MERGED_DISABLED_FOCUSABLE_PROPS : { disabled: true }) : null)}
 *   onFocus={composeEventHandlers(onFocus, hold.onFocus, { checkDefaultPrevented: false })}
 *   onBlur={composeEventHandlers(onBlur, hold.onBlur, { checkDefaultPrevented: false })}
 * />
 */
export function useHeldFocus(disabled: boolean): HeldFocus {
  const [focused, setFocused] = React.useState(false);
  const [held, setHeld] = React.useState(false);
  // A control that turns disabled while it has focus is held; one that turns enabled is not.
  const [prevDisabled, setPrevDisabled] = React.useState(disabled);
  let isHeld = held;
  if (prevDisabled !== disabled) {
    setPrevDisabled(disabled);
    isHeld = disabled && focused;
    if (isHeld !== held) setHeld(isHeld);
  }

  const onFocus = (event: React.FocusEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setFocused(true);
  };
  const onBlur = (event: React.FocusEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    // As in `useRestoreFocus`'s focus tracker, a blur after which the control is still the
    // active element (the window lost focus) is no departure.
    const departed = event.relatedTarget !== null || event.currentTarget.ownerDocument.hasFocus();
    if (!departed) return;
    setFocused(false);
    setHeld(false);
  };

  return { held: disabled && isHeld, onFocus, onBlur };
}
