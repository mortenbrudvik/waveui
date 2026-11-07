import * as React from 'react';
import { usePlacedPresence } from '../../hooks/usePlacedPresence';
import type { PresenceAttributes } from '../../hooks/usePresence';

/**
 * What a picker's popup surface holds: the option list, the empty message ("No matches"), or
 * nothing (no surface).
 */
export type PickerSurfaceContent = 'list' | 'empty' | null;

/** Result of {@link usePickerSurfacePresence}. */
export interface PickerSurfacePresence<T> {
  /** Whether to render the surface: it is shown, or its list is exiting. */
  mounted: boolean;
  /**
   * The surface's list is exiting: render the list in it, held as it was last shown (`heldItems`),
   * and give the surface `data-state="closed"`.
   */
  exiting: boolean;
  /** The `items` of the last time the list was shown (the list that an exit keeps drawing). */
  heldItems: T;
  /** Callback ref for the surface element (stable): the phases wait for its own animations. */
  ref: React.RefCallback<HTMLElement>;
  /** Spread onto the surface: `data-presence`, and `inert` while it exits. */
  presenceProps: PresenceAttributes;
}

/**
 * Internal: mounts and unmounts the popup surface of a picker (Combobox, Dropdown, TagPicker,
 * TimePicker, and a custom picker's `ListboxSurface`) through the presence core, so its list can
 * fade out. The one `<ul role="listbox">` stays in the surface while the surface exits (its option
 * ids stay in the document for the combobox's `aria-controls`) and moves back to its hidden place
 * inside the picker when the exit ends.
 *
 * - **Only a list exits, and only an unchanged one.** An empty message has no content to hold
 *   once the picker's text is gone, and a list whose `items` changed since it was last shown (the
 *   filter was reset by the selection that closed it) would redraw with different rows while it
 *   fades: both unmount at once, as before.
 * - **`appear`.** The surface enters also when it mounts open, as Popover's does.
 * - **Placement.** Through `usePlacedPresence`, a surface with the default motion mounts exited
 *   and enters once floating-ui has placed it, so a popup that flips enters on the side it ends
 *   up on. `list` and `empty` are one surface: switching between them while it is shown does not
 *   re-arm it, and an exit never waits for a position.
 *
 * @param content - What the surface holds now; `null` while no surface is shown.
 * @param items - The shown items of the list, an array whose identity holds while its content does
 *   (`useListbox`'s `items`).
 * @param placement - `placed`: the surface has its position (`isPositioned` of the picker's
 *   positioning); `hold`: wait for it (the surface has the default `popupMotion`; `false` is plain
 *   `usePresence(shown, { appear: true })`).
 */
export function usePickerSurfacePresence<T>(
  content: PickerSurfaceContent,
  items: T,
  placement: { placed: boolean; hold: boolean },
): PickerSurfacePresence<T> {
  const shown = content !== null;
  const { isMounted, ref, presenceProps } = usePlacedPresence(
    shown,
    placement.placed,
    placement.hold,
  );
  // What the surface held when it was last shown (adjusted during render, C-HOOKS: it is state so
  // that the exit reads the last shown list without reading a ref).
  const [held, setHeld] = React.useState({ content, items });
  if (shown && (held.content !== content || held.items !== items)) setHeld({ content, items });
  const exiting = !shown && isMounted && held.content === 'list' && held.items === items;
  return { mounted: shown || exiting, exiting, heldItems: held.items, ref, presenceProps };
}
