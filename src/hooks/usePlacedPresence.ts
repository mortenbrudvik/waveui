import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useEventCallback } from './useEventCallback';
import { useIsClient } from './useIsClient';
import { usePresence, type UsePresenceResult } from './usePresence';

/**
 * Internal: {@link usePresence} for a positioned popup whose enter must start where it ends up.
 *
 * A popup mounts with the side it was asked for; floating-ui measures it (which resolves its
 * style) and then places it, flipping it when there is no room. An enter that starts at mount,
 * from `@starting-style`, would start from the requested side, so a popup that flips would slide
 * toward its anchor instead of away from it. Here the surface is mounted in the `exited` phase,
 * which a recipe styles as the start of the enter (transparent, moved toward its anchor, with no
 * transition), and the presence core is shown only once the popup is placed. The commit that
 * arms it forces the style of the placed surface first (a read of its computed style), so the
 * start of the transition is the resolved side's, and the enter then runs as a transition from it.
 *
 * - **`placed`.** Whether the popup has its position (`isPositioned` of `usePopupPosition`, and
 *   the anchor it waits for, if any); a popup without a position to wait for passes `true`.
 *   A popup that is not placed within a frame enters anyway, from where it is, so a surface that
 *   floating-ui cannot place never stays transparent.
 * - **The server and hydration.** A popup that renders open on the server, and the hydrating
 *   render, are `entered` at once and replay no enter, as with `usePresence`.
 * - **Closing.** A popup that closes before it was armed unmounts at once (it never showed); an
 *   armed one exits as `usePresence` does. Showing it again re-arms it.
 * - **Mounted.** `isMounted` is `true` while `open`, armed or not, so the surface is in the
 *   document (and focus can move into it) in the commit that opens it, as before.
 *
 * Destructure the result, as `usePresence`'s.
 *
 * @param open - Whether the popup is open.
 * @param placed - Whether its position is known.
 * @param hold - Whether to wait for the position. Pass `true` only while the popup has the default
 *   motion (the recipe styles the exited phase as the start of the enter): a motion of the
 *   consumer's, written against the entering phase and `starting:`, needs the surface to mount in
 *   it, and with no motion there is nothing to wait for. With `false` this is
 *   `usePresence(open, { appear: true })`.
 */
export function usePlacedPresence(
  open: boolean,
  placed: boolean,
  hold: boolean,
): Pick<UsePresenceResult, 'isMounted' | 'ref' | 'presenceProps'> {
  const isClient = useIsClient();
  // Whether the enter may start. A server or hydrating render is entered already (no motion).
  // Adjusted during render (C-HOOKS: a previous-value state): a closed popup is not armed.
  const [armed, setArmed] = useState(() => !isClient || !hold);
  if (!open && armed) setArmed(false);
  else if (open && !hold && !armed) setArmed(true);

  const {
    isMounted,
    ref: presenceRef,
    presenceProps,
  } = usePresence(open && armed, { appear: true });

  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (node: HTMLElement | null) => {
      presenceRef(node);
      setElement(node);
    },
    [presenceRef],
  );

  const arm = useEventCallback(() => setArmed(true));

  // The popup is placed: resolve the style it has now (its resolved side, in the exited phase),
  // then show the presence core in the next commit, so the enter transitions from that style.
  useLayoutEffect(() => {
    if (!hold || !open || armed || !placed || !element) return;
    element.ownerDocument.defaultView?.getComputedStyle(element).getPropertyValue('opacity');
    arm();
  }, [hold, open, armed, placed, element, arm]);

  // A popup that is not placed by the next frame enters where it is.
  useEffect(() => {
    if (!hold || !open || armed) return undefined;
    const frame = requestAnimationFrame(arm);
    return () => cancelAnimationFrame(frame);
  }, [hold, open, armed, arm]);

  return { isMounted: isMounted || open, ref, presenceProps };
}
