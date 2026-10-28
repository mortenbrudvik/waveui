import type * as React from 'react';
import { cn } from '../lib/cn';
import { collapseMotion, collapseStructure } from '../lib/motion';
import type { MotionSlot } from '../lib/types';
import { useMotionClasses } from './useMotion';
import { usePreserveFocus } from './usePreserveFocus';
import { usePresence, type PresenceAttributes, type PresencePhase } from './usePresence';

/** Options of {@link useCollapsePresence}. */
export interface UseCollapsePresenceOptions {
  /**
   * The disclosure's motion slot: `undefined` the default collapse, `null` none, a value replaces
   * it (see `MotionSlot`); the provider's `'none'` acts as `null` unless a value is given.
   */
  motion: MotionSlot | null | undefined;
  /** The part that may hold focus when it collapses. */
  partRef: React.RefObject<HTMLElement | null>;
  /** Where that focus goes: the disclosure's own trigger. */
  getTrigger: () => HTMLElement | null | undefined;
}

/** Returned by {@link useCollapsePresence}. */
export interface UseCollapsePresenceResult {
  /** Whether to render the wrapper and the part: while open, and while the part exits. */
  isMounted: boolean;
  /** The wrapper's phase. */
  phase: PresencePhase;
  /** Callback ref for the wrapper (stable): the presence element, whose motion ends the phases. */
  wrapperRef: React.RefCallback<HTMLElement>;
  /** Spread onto the wrapper: `data-presence` always, `inert` while the part exits. */
  presenceProps: PresenceAttributes;
  /** collapseStructure plus the resolved motion; the caller puts its stable class first. */
  className: string;
}

/**
 * The collapse of a disclosure's part (Accordion's region, a Tree group, a Nav category's list):
 * the part renders as the only child of a wrapper element, which mounts through the presence core
 * and carries the collapse structure and motion of `src/lib/motion.ts`. The part itself keeps its
 * own props, ref, id and role.
 *
 * - **Mounting.** `usePresence(open)` without `appear`: a part open at mount (on the server, when
 *   hydrating and in a client render) is `entered`, since in-flow content never animates on mount.
 *   Closing keeps the wrapper and the part mounted, `inert`, until the wrapper's motion ends;
 *   opening again during the exit goes back to `entering` with the same elements, so the state
 *   inside the part survives. Under reduced motion, with `motion: null` or the provider's `'none'`,
 *   a phase ends in the commit that starts it.
 * - **Structure.** While entered the wrapper renders no box, so the part lays out in its parent as
 *   it did without the wrapper; while it enters or exits, the wrapper is a clipping one-track grid
 *   of rows whose minimum is zero, with the part at the top of the track at its own height (so it
 *   is clipped, never squeezed), and the default motion moves that track between zero and the
 *   part's height with a fade (200 ms both ways).
 * - **Focus.** Focus inside the part when the disclosure closes moves to `getTrigger()` in the
 *   closing commit (`usePreserveFocus` with `enabled: open`), so it never stays in the `inert`,
 *   exiting part. A part unmounted while open with focus inside (its disclosure removed) moves
 *   focus there after the commit, when that trigger is still in the document.
 *
 * Destructure the result: react-hooks/refs treats an object whose member is passed to `ref` as a
 * ref, so reading its other members during render is an error.
 *
 * @example
 * const partRef = useRef<HTMLDivElement | null>(null);
 * const { isMounted, wrapperRef, presenceProps, className } = useCollapsePresence(open, {
 *   motion,
 *   partRef,
 *   getTrigger: () => triggerRef.current,
 * });
 * return isMounted ? (
 *   <div ref={wrapperRef} {...presenceProps} className={cn(stableCollapseClass, className)}>
 *     <div ref={partRef} role="region">…</div>
 *   </div>
 * ) : null;
 *
 * @param open - Whether the disclosure is open.
 * @param options - See {@link UseCollapsePresenceOptions}.
 */
export function useCollapsePresence(
  open: boolean,
  options: UseCollapsePresenceOptions,
): UseCollapsePresenceResult {
  const { motion, partRef, getTrigger } = options;
  const { isMounted, phase, ref, presenceProps } = usePresence(open);
  const motionClassName = useMotionClasses(motion, collapseMotion);
  usePreserveFocus(partRef, getTrigger, { enabled: open });
  return {
    isMounted,
    phase,
    wrapperRef: ref,
    presenceProps,
    className: cn(collapseStructure, motionClassName),
  };
}
