import * as React from 'react';
import { useEventCallback } from './useEventCallback';

/** Options of {@link useActiveDescendant}. */
export interface UseActiveDescendantOptions {
  /** The values that can become active, in navigation order. */
  items: readonly string[];
  /** The DOM id of an item's element: the `aria-activedescendant` target. */
  getId: (value: string) => string;
  /**
   * While `false`, no item is active and the moved-to item is forgotten (a closed popup, an
   * unfocused list). A move made in the same update that enables the hook is kept.
   * @default true
   */
  enabled?: boolean;
  /**
   * The active item while none was moved to, or after the moved-to item left `items` (the
   * selected option, for example). Ignored when it is not in `items`.
   * @default null
   */
  fallback?: string | null;
  /** `next()` and `prev()` wrap at the ends. @default false */
  loop?: boolean;
  /**
   * Whenever `items` changes while the hook is enabled (compared by content), its first item
   * becomes active — also when the change comes with enabling (the keystroke that opens a
   * filtered list). Enabling with unchanged items keeps the fallback. It wins over a move made in
   * the same update.
   * @default false
   */
  activateFirstOnChange?: boolean;
  /** The element of an item, for scrolling it into view. @default document.getElementById(getId(value)) */
  getElement?: (value: string) => HTMLElement | null;
  /** Called after the active item changed (from an effect), `null` included. */
  onActiveValueChange?: (value: string | null) => void;
}

/** Result of {@link useActiveDescendant}. The methods have stable identities. */
export interface UseActiveDescendantResult {
  /** The moved-to item, else the fallback; `null` while disabled. Derived during render. */
  activeValue: string | null;
  /** `getId(activeValue)`, or `undefined`: spread as `aria-activedescendant`. */
  activeDescendantId: string | undefined;
  /**
   * Moves to `value`, or back to the fallback with `null`. The value is kept as it is; the next
   * render drops it when it is not in that render's `items` or the hook is disabled, clearing any
   * earlier move. Scrolled into view unless `scroll` is `false`.
   */
  setActiveValue: (value: string | null, options?: { scroll?: boolean }) => void;
  /**
   * Moves to `value` for pointer movement, not scrolled into view; ignored while disabled, when
   * `value` is not in `items` or is already active.
   */
  highlight: (value: string) => void;
  /** Moves to the first item. */
  first: () => void;
  /** Moves to the last item. */
  last: () => void;
  /** The item after the active one (the first when none is active); wraps with `loop`. */
  next: () => void;
  /** The item before the active one (the last when none is active); wraps with `loop`. */
  prev: () => void;
  /**
   * Moves `delta` items (PageDown: `move(10)`), clamped at the ends, never wrapping; from no active
   * item, a positive delta goes to the first item and a negative one to the last.
   */
  move: (delta: number) => void;
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function step(values: readonly string[], current: string | null, delta: number, loop: boolean) {
  const count = values.length;
  if (count === 0) return null;
  const index = current === null ? -1 : values.indexOf(current);
  if (index === -1) return delta > 0 ? values[0] : values[count - 1];
  let next = index + delta;
  if (next < 0 || next >= count) {
    next =
      loop && Math.abs(delta) === 1
        ? (next + count) % count
        : Math.max(0, Math.min(count - 1, next));
  }
  return values[next];
}

/**
 * The active (virtually focused) item of a composite that keeps DOM focus on one element and points
 * `aria-activedescendant` at the active item: a combobox, a listbox that holds focus, a command
 * palette. The state is React state, so the active id is derived during render (server HTML
 * included) and nothing reads the DOM during render.
 *
 * - The moved-to item is dropped when it leaves `items` or while `enabled` is `false`, and does not
 *   come back without a user action; `fallback` is active while nothing was moved to.
 * - Keyboard and programmatic moves are scrolled into view (`{ block: 'nearest' }`); pointer moves
 *   (`highlight`) and `setActiveValue(value, { scroll: false })` are not.
 * - `onActiveValueChange` reports every change after the commit, once (StrictMode included).
 *
 * `useListbox` is built on it; use it directly for composites that are not listboxes.
 *
 * @example
 * const ad = useActiveDescendant({ items: results.map((r) => r.id), getId: (id) => `cmd-${id}`, enabled: open });
 * <input aria-activedescendant={ad.activeDescendantId} onKeyDown={(e) => { if (e.key === 'ArrowDown') ad.next(); }} />
 */
export function useActiveDescendant(
  options: UseActiveDescendantOptions,
): UseActiveDescendantResult {
  const {
    items,
    getId,
    enabled = true,
    fallback = null,
    loop = false,
    activateFirstOnChange = false,
    getElement,
    onActiveValueChange,
  } = options;

  const itemSet = React.useMemo(() => new Set(items), [items]);
  const [movedRaw, setMovedRaw] = React.useState<string | null>(null);
  let moved = enabled ? movedRaw : null;

  // activateFirstOnChange: tracked (and updated) only while the option is on, so a render without
  // it adds no render-phase update (C-HOOKS: adjust-during-render).
  const [track, setTrack] = React.useState(() => ({ enabled, items }));
  if (activateFirstOnChange) {
    const itemsChanged = !sameValues(track.items, items);
    if (itemsChanged || track.enabled !== enabled) {
      setTrack({ enabled, items });
      if (enabled && itemsChanged) moved = items[0] ?? null;
    }
  }
  if (moved !== null && !itemSet.has(moved)) moved = null;
  if (moved !== movedRaw) setMovedRaw(moved);

  const activeValue = enabled
    ? (moved ?? (fallback !== null && itemSet.has(fallback) ? fallback : null))
    : null;
  const activeDescendantId = activeValue === null ? undefined : getId(activeValue);

  // The value the pointer (or a `scroll: false` move) activated, until the scroll effect saw it.
  const noScrollRef = React.useRef<string | null>(null);

  const setActiveValue = useEventCallback(
    (value: string | null, moveOptions?: { scroll?: boolean }) => {
      noScrollRef.current = moveOptions?.scroll === false ? value : null;
      setMovedRaw(value);
    },
  );
  const highlight = useEventCallback((value: string) => {
    if (!enabled || !itemSet.has(value) || value === activeValue) return;
    noScrollRef.current = value;
    setMovedRaw(value);
  });
  const first = useEventCallback(() => setActiveValue(items[0] ?? null));
  const last = useEventCallback(() => setActiveValue(items[items.length - 1] ?? null));
  const next = useEventCallback(() => setActiveValue(step(items, activeValue, 1, loop)));
  const prev = useEventCallback(() => setActiveValue(step(items, activeValue, -1, loop)));
  // Never wraps, whatever `loop` is: `loop` is next()/prev()'s wrap at the ends only (fix round 1).
  const move = useEventCallback((delta: number) =>
    setActiveValue(step(items, activeValue, delta, false)),
  );

  const resolveElement = useEventCallback((value: string): HTMLElement | null => {
    const custom = getElement?.(value);
    if (custom) return custom;
    return typeof document === 'undefined' ? null : document.getElementById(getId(value));
  });
  React.useLayoutEffect(() => {
    const suppressed = activeValue !== null && activeValue === noScrollRef.current;
    noScrollRef.current = null;
    if (activeValue === null || suppressed) return;
    resolveElement(activeValue)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeValue, resolveElement]);

  const reportedRef = React.useRef<string | null>(null);
  const report = useEventCallback((value: string | null) => onActiveValueChange?.(value));
  React.useEffect(() => {
    if (reportedRef.current === activeValue) return;
    reportedRef.current = activeValue;
    report(activeValue);
  }, [activeValue, report]);

  return {
    activeValue,
    activeDescendantId,
    setActiveValue,
    highlight,
    first,
    last,
    next,
    prev,
    move,
  };
}
