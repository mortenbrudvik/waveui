import { useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { getGlobalRegistry } from '../lib/globalRegistry';
import { focusElement, getFirstTabbable, getTabbableElements, isFocusable } from '../lib/focus';
import {
  ALLOW_OUTSIDE_SELECTOR,
  compareLayers,
  getLayer,
  getLayerTreeElements,
  getOpenLayers,
  isDescendantLayer,
  type LayerRecord,
} from '../lib/layers';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Options of {@link useFocusTrap}. */
export interface UseFocusTrapOptions {
  /** Whether the trap is active. */
  enabled: boolean;
  /**
   * The surface's dismiss layer; focus inside its descendant layers (portaled popovers opened from
   * inside) is allowed. The layer's own `refs` outside the container (its trigger) are not.
   */
  layerId?: string;
  /**
   * What to focus when the trap starts, unless focus is already inside (an `autoFocus` element
   * wins). @default 'first' (the first tabbable element, else the container)
   */
  initialFocus?:
    | React.RefObject<HTMLElement | null>
    | 'first'
    | 'container'
    | (() => HTMLElement | null);
  /** Regions outside the container whose tabbables join the Tab cycle. @default ALLOW_OUTSIDE_SELECTOR */
  allowOutsideSelector?: string;
}

interface TrapEntry {
  container: HTMLElement;
  seq: number;
  readonly layerId: string | undefined;
  readonly allowOutsideSelector: string;
  lastFocused: HTMLElement | null;
  /** `lastFocused` was inside an allow-listed region (a toast) while it was connected. */
  lastFocusedInAllow: boolean;
}

interface TrapState {
  traps: TrapEntry[];
  seq: number;
  listeners: { remove(): void } | null;
}

function getState(): TrapState {
  return getGlobalRegistry<TrapState>('traps', () => ({ traps: [], seq: 0, listeners: null }));
}

// ---------------------------------------------------------------------------
// Trap stack
// ---------------------------------------------------------------------------

/** `> 0` when trap `a` is above trap `b`: layer parentage/stacking first, then activation order. */
function compareTraps(a: TrapEntry, b: TrapEntry): number {
  const idA = a.layerId;
  const idB = b.layerId;
  if (idA !== undefined && idB !== undefined && idA !== idB) {
    if (isDescendantLayer(idA, idB)) return 1;
    if (isDescendantLayer(idB, idA)) return -1;
    const layerA = getLayer(idA);
    const layerB = getLayer(idB);
    if (layerA && layerB) return compareLayers(layerA, layerB);
  }
  return a.seq - b.seq;
}

function getActiveTrap(state: TrapState): TrapEntry | null {
  let active: TrapEntry | null = null;
  for (const trap of state.traps) {
    if (!active || compareTraps(trap, active) > 0) active = trap;
  }
  return active;
}

// ---------------------------------------------------------------------------
// Tab cycle
// ---------------------------------------------------------------------------

interface CycleEntry {
  el: HTMLElement;
  /** 0 = the container, 1… = allow-listed regions in document order. */
  segment: number;
}

const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
const PRECEDING = 2; // Node.DOCUMENT_POSITION_PRECEDING

/** Top-level allow-listed regions outside the container. */
function getAllowRegions(trap: TrapEntry): HTMLElement[] {
  const doc = trap.container.ownerDocument;
  const all = Array.from(doc.querySelectorAll<HTMLElement>(trap.allowOutsideSelector));
  return all.filter(
    (region) =>
      !trap.container.contains(region) &&
      !region.contains(trap.container) &&
      !all.some((other) => other !== region && other.contains(region)),
  );
}

function getCycle(trap: TrapEntry, regions: HTMLElement[]): CycleEntry[] {
  const entries: CycleEntry[] = getTabbableElements(trap.container).map((el) => ({
    el,
    segment: 0,
  }));
  regions.forEach((region, index) => {
    for (const el of getTabbableElements(region)) entries.push({ el, segment: index + 1 });
  });
  return entries;
}

function follows(reference: Node, el: Node): boolean {
  return (reference.compareDocumentPosition(el) & FOLLOWING) !== 0;
}

function precedes(reference: Node, el: Node): boolean {
  // An ancestor also "precedes"; it is not a place Tab goes back to.
  return (reference.compareDocumentPosition(el) & PRECEDING) !== 0 && !el.contains(reference);
}

/** The cycle entry Tab (or Shift+Tab) reaches from `from`, an element not in the cycle. */
function findFromPosition(
  cycle: CycleEntry[],
  from: Element,
  segment: number,
  backward: boolean,
): HTMLElement {
  if (!backward) {
    const sameSegment = cycle.find((entry) => entry.segment === segment && follows(from, entry.el));
    if (sameSegment) return sameSegment.el;
    const later = cycle.find((entry) => entry.segment > segment);
    return (later ?? cycle[0]).el;
  }
  for (let i = cycle.length - 1; i >= 0; i--) {
    const entry = cycle[i];
    if (entry.segment === segment && precedes(from, entry.el)) return entry.el;
  }
  for (let i = cycle.length - 1; i >= 0; i--) {
    if (cycle[i].segment < segment) return cycle[i].el;
  }
  return cycle[cycle.length - 1].el;
}

/**
 * Whether `node` is inside a **descendant** of the layer `layerId`: the portal wrappers registered
 * with it (overlays rendered inside the trapped surface) and the trees of its descendant layers.
 * The layer's own `getElements()` are left out — they usually include its trigger, which lives
 * outside the container (a DatePicker toggle) and must not count as inside the trap.
 */
function isInsideDescendantLayers(layerId: string | undefined, node: Node): boolean {
  if (layerId === undefined) return false;
  return getLayerTreeElements(layerId, { includeOwnElements: false }).some((el) =>
    el.contains(node),
  );
}

function isInsideTrap(trap: TrapEntry, node: Node): boolean {
  if (trap.container.contains(node)) return true;
  const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
  if (el && el.closest(trap.allowOutsideSelector)) return true;
  return isInsideDescendantLayers(trap.layerId, node);
}

/**
 * The open descendant layer of the trap's layer that `node` is in (the topmost when several
 * contain it), with the element of that layer containing `node` (its portaled surface).
 */
function findDescendantLayer(
  trap: TrapEntry,
  node: Node,
): { layer: LayerRecord; region: HTMLElement } | null {
  const layerId = trap.layerId;
  if (layerId === undefined) return null;
  let found: { layer: LayerRecord; region: HTMLElement } | null = null;
  for (const layer of getOpenLayers()) {
    if (layer.id === layerId || !isDescendantLayer(layer.id, layerId)) continue;
    const region = layer
      .getElements()
      .find((el): el is HTMLElement => !!el && el.contains(node) && !trap.container.contains(el));
    if (region && (!found || compareLayers(layer, found.layer) > 0)) found = { layer, region };
  }
  return found;
}

function focusFirstPossible(candidates: Array<HTMLElement | null | undefined>): void {
  for (const candidate of candidates) {
    if (candidate && focusElement(candidate)) return;
  }
}

/**
 * Tab inside a descendant layer: native inside it; leaving it forward goes to the tabbable after
 * the layer's anchor, backward to the anchor itself. Returns `true` when it handled the event.
 */
function handleDescendantLayerTab(
  trap: TrapEntry,
  event: KeyboardEvent,
  active: HTMLElement,
  regions: HTMLElement[],
): boolean {
  let from: HTMLElement = active;
  // Nested descendant layers: leave each one whose edge is reached, up to the container.
  for (let depth = 0; depth < 10; depth++) {
    const found = findDescendantLayer(trap, from);
    if (!found) return false;
    const { layer, region } = found;
    const tabbables = getTabbableElements(region);
    const index = tabbables.indexOf(from);
    const backward = event.shiftKey;
    if (from === active) {
      const atEdge =
        index === -1
          ? backward
            ? !tabbables.some((el) => precedes(from, el))
            : !tabbables.some((el) => follows(from, el))
          : backward
            ? index === 0
            : index === tabbables.length - 1;
      if (!atEdge) return true; // native Tab inside the layer
    }

    const anchor = layer.getAnchor();
    event.preventDefault();
    if (!anchor || !anchor.isConnected) {
      const cycle = getCycle(trap, regions);
      focusFirstPossible([backward ? cycle[cycle.length - 1]?.el : cycle[0]?.el, trap.container]);
      return true;
    }
    if (backward && isFocusable(anchor)) {
      focusElement(anchor);
      return true;
    }
    if (trap.container.contains(anchor)) {
      const cycle = getCycle(trap, regions);
      if (cycle.length === 0) {
        focusElement(trap.container);
        return true;
      }
      const target = cycle.some((entry) => entry.el === anchor)
        ? neighbour(cycle, anchor, backward)
        : findFromPosition(cycle, anchor, 0, backward);
      focusFirstPossible([target, trap.container]);
      return true;
    }
    // The anchor lives in another descendant layer: continue from there.
    const outer = findDescendantLayer(trap, anchor);
    if (!outer) {
      focusFirstPossible([anchor, trap.container]);
      return true;
    }
    const outerTabbables = getTabbableElements(outer.region);
    const next = backward
      ? [...outerTabbables].reverse().find((el) => precedes(anchor, el))
      : outerTabbables.find((el) => follows(anchor, el));
    if (next) {
      focusElement(next);
      return true;
    }
    from = anchor;
  }
  return true;
}

function neighbour(cycle: CycleEntry[], el: HTMLElement, backward: boolean): HTMLElement {
  const index = cycle.findIndex((entry) => entry.el === el);
  const next = backward ? index - 1 : index + 1;
  return cycle[(next + cycle.length) % cycle.length].el;
}

function handleTab(trap: TrapEntry, event: KeyboardEvent): void {
  const { container } = trap;
  if (!container.isConnected) return;
  const doc = container.ownerDocument;
  const active = doc.activeElement as HTMLElement | null;
  const backward = event.shiftKey;
  const regions = getAllowRegions(trap);

  const inContainer = !!active && container.contains(active);
  const regionIndex =
    active && !inContainer ? regions.findIndex((region) => region.contains(active)) : -1;

  if (active && !inContainer && regionIndex === -1 && active !== doc.body) {
    if (isInsideDescendantLayers(trap.layerId, active)) {
      if (handleDescendantLayerTab(trap, event, active, regions)) return;
    }
  }

  const cycle = getCycle(trap, regions);
  if (cycle.length === 0) {
    event.preventDefault();
    focusElement(container);
    return;
  }

  const index = active ? cycle.findIndex((entry) => entry.el === active) : -1;
  if (index !== -1) {
    const nextIndex = backward ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= cycle.length) {
      event.preventDefault();
      focusElement(cycle[backward ? cycle.length - 1 : 0].el);
      return;
    }
    // Inside one segment the browser's own Tab order is used; crossing segments is explicit.
    const next = cycle[nextIndex];
    if (next.segment !== cycle[index].segment) {
      event.preventDefault();
      focusElement(next.el);
    }
    return;
  }

  event.preventDefault();
  if (active && (inContainer || regionIndex !== -1)) {
    const segment = inContainer ? 0 : regionIndex + 1;
    focusElement(findFromPosition(cycle, active, segment, backward));
    return;
  }
  focusElement(cycle[backward ? cycle.length - 1 : 0].el);
}

// ---------------------------------------------------------------------------
// Document listeners
// ---------------------------------------------------------------------------

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const trap = getActiveTrap(getState());
  if (trap) handleTab(trap, event);
}

function handleFocusIn(event: FocusEvent): void {
  const trap = getActiveTrap(getState());
  if (!trap) return;
  const target = event.target as { nodeType?: unknown } | null;
  if (!target || typeof target.nodeType !== 'number') return;
  const node = target as Node;
  if (node.nodeType !== 1) return;
  if (isInsideTrap(trap, node)) {
    const element = node as HTMLElement;
    trap.lastFocused = element;
    trap.lastFocusedInAllow = element.closest(trap.allowOutsideSelector) !== null;
    return;
  }
  // Removing a focused toast moves focus to <body> and fires focusin during removeChild.
  // usePreserveFocus puts it back in a microtask. Reclaiming here would focus the dialog's
  // first tabbable (Close) and that microtask would then treat focus as already placed.
  const doc = trap.container.ownerDocument;
  if (
    (node === doc.body || node === doc.documentElement) &&
    trap.lastFocusedInAllow &&
    trap.lastFocused !== null &&
    !trap.lastFocused.isConnected
  ) {
    return;
  }
  const last = trap.lastFocused;
  const lastIsValid = !!last && last.isConnected && isInsideTrap(trap, last) && isFocusable(last);
  focusFirstPossible([lastIsValid ? last : null, getFirstTabbable(trap.container), trap.container]);
}

function ensureListeners(state: TrapState): void {
  if (state.listeners || typeof document === 'undefined') return;
  const doc = document;
  doc.addEventListener('keydown', handleKeyDown);
  doc.addEventListener('focusin', handleFocusIn, true);
  state.listeners = {
    remove() {
      doc.removeEventListener('keydown', handleKeyDown);
      doc.removeEventListener('focusin', handleFocusIn, true);
    },
  };
}

function pushTrap(entry: TrapEntry): () => void {
  const state = getState();
  state.traps.push(entry);
  ensureListeners(state);
  return () => {
    const index = state.traps.indexOf(entry);
    if (index !== -1) state.traps.splice(index, 1);
    if (state.traps.length === 0) {
      state.listeners?.remove();
      state.listeners = null;
    }
  };
}

function resolveInitialFocus(
  container: HTMLElement,
  initialFocus: UseFocusTrapOptions['initialFocus'],
): Array<HTMLElement | null> {
  const first = getFirstTabbable(container);
  if (initialFocus === 'container') return [container];
  if (initialFocus === undefined || initialFocus === 'first') return [first, container];
  const chosen = typeof initialFocus === 'function' ? initialFocus() : initialFocus.current;
  return [chosen, first, container];
}

/**
 * Keeps keyboard focus inside `container` while `enabled` (modal dialogs, drawers, the DatePicker
 * calendar). Element-based: pass the surface held in state via a callback ref, so the trap starts
 * when the element appears.
 *
 * - **Initial focus** runs synchronously in the commit in which the container appears (no
 *   `requestAnimationFrame`), and does nothing when focus is already inside (an `autoFocus`
 *   element wins).
 * - **Tab / Shift+Tab** are handled by a document bubble-phase `keydown` listener that ignores
 *   events whose default is already prevented, so a React handler inside (a menu closing on Tab, a
 *   grid) can take the key first. Focus wraps at the edges, and from the container itself or a
 *   non-tabbable element it continues in document order. Tabbable elements are computed on every
 *   keydown (content may change; radio-group stops depend on focus), never cached.
 * - Tabbables inside `[data-wave-focus-trap-allow]` regions (the Toaster viewport) join the cycle.
 * - **Descendant layers** (a popover or menu opened from inside, identified through `layerId`):
 *   Tab moves natively inside them; leaving one moves focus to the element after its anchor
 *   (Shift+Tab: the anchor itself).
 * - Focus that lands outside (not in the container, an allowed region or a descendant layer)
 *   returns to the last focused element inside. The layer's own `refs` (its trigger, outside the
 *   container) are outside: opening from the focused trigger still moves focus in, and focus
 *   moving back onto the trigger is returned. Focus that falls on `<body>` or `<html>` because a
 *   focused allow-listed control was removed is left alone: `usePreserveFocus` restores it.
 * - Traps form a stack (shared through the global registry): only the topmost acts.
 */
export function useFocusTrap(container: HTMLElement | null, options: UseFocusTrapOptions): void {
  const { enabled } = options;
  const latestRef = useRef(options);

  useInsertionEffect(() => {
    latestRef.current = options;
  });

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !container) return;
    const latest = latestRef;
    const state = getState();
    state.seq += 1;
    const entry: TrapEntry = {
      container,
      seq: state.seq,
      get layerId() {
        return latest.current.layerId;
      },
      get allowOutsideSelector() {
        return latest.current.allowOutsideSelector ?? ALLOW_OUTSIDE_SELECTOR;
      },
      lastFocused: null,
      lastFocusedInAllow: false,
    };
    const release = pushTrap(entry);

    // Initial focus is skipped only when focus is already inside the container or one of its
    // descendant layers (never for the layer's own trigger or an allow-listed toast).
    const active = container.ownerDocument.activeElement as HTMLElement | null;
    const focusInside =
      !!active &&
      (container.contains(active) ||
        (!active.closest(entry.allowOutsideSelector) &&
          isInsideDescendantLayers(latest.current.layerId, active)));
    if (focusInside) {
      entry.lastFocused = active;
    } else {
      focusFirstPossible(resolveInitialFocus(container, latest.current.initialFocus));
      const now = container.ownerDocument.activeElement as HTMLElement | null;
      if (now && container.contains(now)) entry.lastFocused = now;
    }
    return release;
  }, [enabled, container]);
}
