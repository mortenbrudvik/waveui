import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { useEventCallback } from './useEventCallback';
import { useIsClient } from './useIsClient';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Phase of an element that mounts and unmounts through the presence core: `entering` (its enter
 * motion runs), `entered`, `exiting` (its exit motion runs), `exited`.
 */
export type PresencePhase = 'entering' | 'entered' | 'exiting' | 'exited';

/** Options of {@link usePresence}. */
export interface UsePresenceOptions {
  /**
   * Run the enter phase when the element mounts already visible. Never on the server or while
   * hydrating: the server HTML is the `entered` phase, and a hydrated element does not replay its
   * enter motion.
   * @default false
   */
  appear?: boolean;
  /**
   * Unmount the element once it has exited. `false` keeps it mounted while exited, `hidden` and
   * `inert`, so its state (form fields, scroll position) survives.
   * @default true
   */
  unmountOnExit?: boolean;
  /** Called when an enter phase ends (after its motion, or at once without one). */
  onEntered?: () => void;
  /**
   * Called when an exit phase ends (after its motion, or at once without one), from the commit
   * that unmounts the element (or, with `unmountOnExit: false`, hides it). Not called when the
   * parent unmounts the element while it exits, or when it is shown again first.
   */
  onExited?: () => void;
}

/** The attributes the animated element takes. */
export interface PresenceAttributes {
  /** The phase, always rendered: style motion with `data-[presence=entering]:…` and friends. */
  'data-presence': PresencePhase;
  /** While exiting, and while exited when kept mounted: out of the tab order and the accessibility tree. */
  inert?: boolean;
  /** While exited when kept mounted (`unmountOnExit: false`). */
  hidden?: boolean;
}

/** Returned by {@link usePresence}. */
export interface UsePresenceResult {
  /** Whether to render the element. */
  isMounted: boolean;
  /** The current phase (Avatar's unrelated `PresenceStatus` is a user's availability). */
  phase: PresencePhase;
  /** Callback ref for the animated element (stable); the phases wait for its own animations. */
  ref: React.RefCallback<HTMLElement>;
  /** Spread onto the animated element. */
  presenceProps: PresenceAttributes;
}

/** Extra time the computed-style fallback waits past the longest motion before it ends a phase. */
const FALLBACK_GRACE_MS = 50;

/** Milliseconds of each entry of a computed time list (`0.2s, 150ms`); unreadable entries are 0. */
function parseTimes(value: string): number[] {
  return value.split(',').map((entry) => {
    const time = entry.trim();
    const amount = parseFloat(time);
    if (Number.isNaN(amount)) return 0;
    return time.endsWith('ms') ? amount : time.endsWith('s') ? amount * 1000 : 0;
  });
}

/** The entries of a computed list (`fade, spin`), without empty ones. */
function parseList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** Entry `i` of a computed list that repeats to the length of its name list (CSS list rule). */
function at<T>(list: T[], i: number, fallback: T): T {
  return list.length === 0 ? fallback : list[i % list.length];
}

/** Whether an animation of `el.getAnimations()` still has to end: running and finite. */
function isRunningFinite(animation: Animation): boolean {
  if (animation.playState !== 'running') return false;
  const endTime = animation.effect?.getComputedTiming().endTime;
  return endTime === undefined || Number.isFinite(Number(endTime));
}

/**
 * The motion `el` itself runs now, read from its computed style (engines without
 * `getAnimations`): the animation names and transitioned properties that end, and the longest
 * time until they do (delay + duration × iterations for animations, delay + duration for
 * transitions). Infinite animations never end and are left out.
 */
function computedMotion(el: HTMLElement): {
  time: number;
  animations: Set<string>;
  transitions: Set<string>;
} {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  const animations = new Set<string>();
  const transitions = new Set<string>();
  let time = 0;
  if (!style) return { time, animations, transitions };

  const names = parseList(style.animationName);
  const durations = parseTimes(style.animationDuration);
  const delays = parseTimes(style.animationDelay);
  const counts = parseList(style.animationIterationCount);
  names.forEach((name, i) => {
    if (name === 'none') return;
    const count = Number(at(counts, i, '1'));
    if (!Number.isFinite(count)) return;
    const end = at(delays, i, 0) + at(durations, i, 0) * count;
    if (end <= 0) return;
    animations.add(name);
    time = Math.max(time, end);
  });

  const properties = parseList(style.transitionProperty);
  const transitionDurations = parseTimes(style.transitionDuration);
  const transitionDelays = parseTimes(style.transitionDelay);
  properties.forEach((property, i) => {
    const duration = at(transitionDurations, i, 0);
    if (property === 'none' || duration <= 0) return;
    const end = at(transitionDelays, i, 0) + duration;
    if (end <= 0) return;
    transitions.add(property);
    time = Math.max(time, end);
  });

  return { time, animations, transitions };
}

const END_EVENTS = ['animationend', 'animationcancel', 'transitionend', 'transitioncancel'];

/**
 * Waits for the motion `el` itself runs and calls `onEnd` once it has ended (never synchronously).
 * Returns `null` when nothing runs (the phase ends at once), else a cleanup that stops waiting.
 *
 * - With `getAnimations()`: every running finite animation of the element (CSS animations and
 *   transitions alike) has finished; a cancelled one counts as finished.
 * - Without it: the computed style's longest motion plus {@link FALLBACK_GRACE_MS}, or earlier once
 *   the element's own end and cancel events have accounted for every animation name and
 *   transitioned property it lists.
 */
function waitForMotion(el: HTMLElement, onEnd: () => void): (() => void) | null {
  if (typeof el.getAnimations === 'function') {
    const running = el.getAnimations().filter(isRunningFinite);
    if (running.length === 0) return null;
    let waiting = true;
    void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
      if (waiting) onEnd();
    });
    return () => {
      waiting = false;
    };
  }

  const { time, animations, transitions } = computedMotion(el);
  if (time <= 0) return null;
  const finish = () => {
    cleanup();
    onEnd();
  };
  const handleEnd = (event: Event) => {
    if (event.target !== el) return;
    if (event.type.startsWith('animation')) {
      animations.delete((event as AnimationEvent).animationName);
    } else {
      const property = (event as TransitionEvent).propertyName;
      if (!transitions.delete(property)) transitions.delete('all');
    }
    if (animations.size === 0 && transitions.size === 0) finish();
  };
  const timer = setTimeout(finish, time + FALLBACK_GRACE_MS);
  for (const type of END_EVENTS) el.addEventListener(type, handleEnd);
  function cleanup() {
    clearTimeout(timer);
    for (const type of END_EVENTS) el.removeEventListener(type, handleEnd);
  }
  return cleanup;
}

/**
 * Mounts and unmounts an element with CSS enter and exit motion. Style the phases with
 * `data-presence` variants, e.g. `transition-opacity duration-wave-normal
 * data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0
 * motion-reduce:transition-none`. Gate the enter's start style on the entering phase, as there: an
 * ungated `starting:` class (`@starting-style`) applies to every first style of the element, so it
 * also animates a mount the core treats as `entered` (without `appear`, and when hydrating).
 * Destructure the result (`const { isMounted, ref, presenceProps } = usePresence(open)`):
 * react-hooks/refs treats an object whose member is passed to `ref` as a ref, so reading `phase`
 * or `presenceProps` from the whole object during render is an error (the usePopupPosition rule).
 *
 * - **Phases.** On the server and while hydrating the element is `entered` when `visible`, else
 *   `exited`; a client mount is `entering` with `appear`, else `entered` (or `exited`). `visible`
 *   becoming `true` enters, becoming `false` exits a mounted element; showing it again while it
 *   exits goes back to `entering` with the same element.
 * - **End of a phase.** `entering` and `exiting` end when every running finite animation of the
 *   element itself (`getAnimations()`: CSS animations and transitions) has finished or was
 *   cancelled; engines without `getAnimations` read the computed `animation-*`/`transition-*`
 *   times and the element's end events. A phase ends at once under `prefers-reduced-motion:
 *   reduce`, without an element and without running motion, from a layout effect: an element
 *   without motion unmounts before the browser paints, in the same `act()`.
 * - **Attributes.** `data-presence` always; `inert` while exiting (the exiting element is out of
 *   the tab order and the accessibility tree), and `inert` plus `hidden` while exited when kept
 *   mounted (`unmountOnExit: false`). No inline style, no class, no JS animation.
 * - **Callbacks.** `onEntered` and `onExited` run once per phase change, StrictMode included,
 *   from an effect after the commit of the new phase.
 * - Focus, dismiss layers and focus restore stay the component's: key them on the open state, not
 *   on `isMounted`, so they run on close rather than after the exit motion.
 *
 * @example
 * const { isMounted, ref, presenceProps } = usePresence(open);
 * return isMounted ? (
 *   <div
 *     ref={ref}
 *     {...presenceProps}
 *     className="transition-opacity duration-wave-normal data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 motion-reduce:transition-none"
 *   />
 * ) : null;
 *
 * @param visible - Whether the element is shown.
 * @param options - See {@link UsePresenceOptions}.
 */
export function usePresence(visible: boolean, options: UsePresenceOptions = {}): UsePresenceResult {
  const { appear = false, unmountOnExit = true, onEntered, onExited } = options;
  const isClient = useIsClient();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = useState<PresencePhase>(() => {
    if (!visible) return 'exited';
    return isClient && appear ? 'entering' : 'entered';
  });

  // Changes of `visible`, derived during render (C-HOOKS: a previous-value state).
  const [previousVisible, setPreviousVisible] = useState(visible);
  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    if (visible) setPhase('entering');
    else if (phase !== 'exited') setPhase('exiting');
  }

  // The element: in state, so the phase-end effect re-runs when it attaches, and in a ref, which
  // that effect reads (a DOM-derived update in a layout effect).
  const [element, setElement] = useState<HTMLElement | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
    setElement(node);
  }, []);

  // End of the entering and exiting phases.
  useLayoutEffect(() => {
    if (phase !== 'entering' && phase !== 'exiting') return undefined;
    const next: PresencePhase = phase === 'entering' ? 'entered' : 'exited';
    const el = elementRef.current;
    // Guards the waiting phase: one that was replaced (or unmounted) never ends the new one.
    let active = true;
    const endLater = () => {
      if (active) setPhase((current) => (current === phase ? next : current));
    };
    const stopWaiting = el && !reducedMotion ? waitForMotion(el, endLater) : null;
    if (!stopWaiting) {
      setPhase(next);
      return undefined;
    }
    return () => {
      active = false;
      stopWaiting();
    };
  }, [phase, element, reducedMotion]);

  // The callbacks, once per committed phase change (never from the effect above, which StrictMode
  // runs twice on mount before the new phase renders).
  const handleEntered = useEventCallback(onEntered);
  const handleExited = useEventCallback(onExited);
  const committedPhaseRef = useRef<PresencePhase | null>(null);
  useLayoutEffect(() => {
    const previous = committedPhaseRef.current;
    committedPhaseRef.current = phase;
    if (previous === 'entering' && phase === 'entered') handleEntered();
    else if (previous === 'exiting' && phase === 'exited') handleExited();
  }, [phase, handleEntered, handleExited]);

  const keptExited = phase === 'exited' && !unmountOnExit;
  const presenceProps = useMemo<PresenceAttributes>(() => {
    const attributes: PresenceAttributes = { 'data-presence': phase };
    if (phase === 'exiting' || keptExited) attributes.inert = true;
    if (keptExited) attributes.hidden = true;
    return attributes;
  }, [phase, keptExited]);

  return { isMounted: phase !== 'exited' || !unmountOnExit, phase, ref, presenceProps };
}
