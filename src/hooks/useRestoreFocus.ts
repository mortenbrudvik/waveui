import * as React from 'react';
import { useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { getFirstTabbable, getTabbableElements, isFocusable } from '../lib/focus';
import { getGlobalRegistry } from '../lib/globalRegistry';
import {
  ALLOW_OUTSIDE_SELECTOR,
  compareLayers,
  getLayer,
  getOpenLayers,
  getTopmostLayer,
  isInsideLayerTree,
  isInsideOtherOpenModal,
  subscribeLayers,
  type LayerRecord,
} from '../lib/layers';
import { DismissLayerContext } from './useDismiss';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

/** Options of {@link useRestoreFocus}. */
export interface UseRestoreFocusOptions {
  /** `true` while the surface is open. */
  enabled: boolean;
  /** The layer surface: opener candidates inside it are ignored. */
  container?: HTMLElement | null;
  /** The trigger: preferred restore target. */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Consumer override: focused first when valid. */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** Used when neither the override, the opener nor the trigger can take focus. */
  fallback?: () => HTMLElement | null;
  /**
   * Popovers: restore only when focus was inside the surface (or lost to `<body>`) at close, so a
   * click that moved focus elsewhere is respected. @default false
   */
  onlyIfFocusInside?: boolean;
}

interface Latest {
  options: UseRestoreFocusOptions;
  parentLayerId: string | null;
}

/** Where an element sat in the document, recorded so a spot near it can be found once it is gone. */
interface DomPosition {
  /** The element and its ancestors up to `<body>`, innermost first. */
  path: Element[];
  /** The next element sibling of each `path` entry when it was recorded. */
  next: Array<Element | null>;
  /** The previous element sibling of each `path` entry when it was recorded. */
  previous: Array<Element | null>;
}

/** What is captured about the opener when the surface opens. */
interface OpenerRecord {
  element: HTMLElement;
  /** Its place in the document, used when it is removed or can no longer take focus. */
  position: DomPosition;
  /** The anchors (triggers) of the open layers whose tree held it, innermost layer first. */
  anchors: Array<{ element: HTMLElement; position: DomPosition }>;
}

/** A point in document order: just before `ref`, or just after `ref` and its subtree. */
interface DomPoint {
  ref: Element;
  placement: 'before' | 'after';
}

const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
const PORTAL_SELECTOR = '[data-wave-portal]';

function isValidTarget(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el || !el.isConnected) return false;
  if (!isFocusable(el)) return false; // also rejects [inert] ancestors, hidden and disabled
  if (el.closest('[aria-hidden="true"]')) return false;
  return !isInsideOtherOpenModal(el);
}

function tryFocus(el: HTMLElement): boolean {
  try {
    el.focus({ preventScroll: true });
  } catch {
    return false;
  }
  return el.ownerDocument.activeElement === el;
}

function recordPosition(el: Element): DomPosition {
  const position: DomPosition = { path: [], next: [], previous: [] };
  const body = el.ownerDocument.body;
  for (let node: Element | null = el; node; node = node.parentElement) {
    position.path.push(node);
    position.next.push(node.nextElementSibling);
    position.previous.push(node.previousElementSibling);
    if (node === body) break;
  }
  return position;
}

/**
 * The anchors of the open layers whose tree contains `opener` (a menu item's menu button),
 * innermost layer first. An opener in an allow-listed region (a toast) belongs to no layer.
 */
function captureAnchors(
  opener: HTMLElement,
  container: HTMLElement | null | undefined,
): OpenerRecord['anchors'] {
  if (opener.closest(ALLOW_OUTSIDE_SELECTOR)) return [];
  const layers = getOpenLayers()
    .filter((layer) => isInsideLayerTree(layer.id, opener))
    .sort((a, b) => compareLayers(b, a));
  const anchors: OpenerRecord['anchors'] = [];
  for (const layer of layers) {
    const anchor = layer.getAnchor();
    if (!anchor || anchor === opener || (container && container.contains(anchor))) continue;
    if (anchors.some((entry) => entry.element === anchor)) continue;
    anchors.push({ element: anchor, position: recordPosition(anchor) });
  }
  return anchors;
}

// ---------------------------------------------------------------------------
// Focus tracker
// ---------------------------------------------------------------------------

/**
 * Remembers the last focused element, with its place in the document and the anchors of the
 * overlays that held it, recorded while it is still in the document. A surface captures its opener
 * in the mutation phase, and by then React has already deleted anything earlier in the tree that
 * the same commit removes. A popover rendered before a dialog, whose menu item closes the popover
 * and opens the dialog, has lost its menu item (and focus is on `<body>`) when the dialog captures.
 * The record still leads the restore to the popover's trigger. It lives in
 * `getGlobalRegistry('restoreFocusTracker')`, so two copies of the library share one set of
 * listeners.
 */
interface FocusTracker {
  /** Mounted `useRestoreFocus` instances: the listeners are installed while there is one. */
  users: number;
  /** The last focused element; `null` once focus was moved away from it on purpose. */
  last: OpenerRecord | null;
  /** Removes the listeners; `null` while none are installed. */
  uninstall: (() => void) | null;
}

function getFocusTracker(): FocusTracker {
  return getGlobalRegistry<FocusTracker>('restoreFocusTracker', () => ({
    users: 0,
    last: null,
    uninstall: null,
  }));
}

const ELEMENT_NODE = 1;

function isElementTarget(target: EventTarget | null): target is HTMLElement {
  return !!target && (target as Partial<Node>).nodeType === ELEMENT_NODE;
}

function recordFocus(tracker: FocusTracker, el: HTMLElement): void {
  const doc = el.ownerDocument;
  if (el === doc.body || el === doc.documentElement) {
    tracker.last = null;
    return;
  }
  tracker.last = { element: el, position: recordPosition(el), anchors: captureAnchors(el, null) };
}

/**
 * A layer opened or closed: re-record the focused element's place and overlays while it is still in
 * the document. An element focused as its popover opens (autoFocus) gets focus before the
 * popover's layer registers. Anchors found earlier are kept (a layer unregistering as its content
 * is deleted no longer reports it).
 */
function refreshFocusRecord(tracker: FocusTracker): void {
  const last = tracker.last;
  if (!last || !last.element.isConnected) return;
  const anchors = captureAnchors(last.element, null);
  for (const anchor of last.anchors) {
    if (!anchors.some((entry) => entry.element === anchor.element)) anchors.push(anchor);
  }
  tracker.last = { element: last.element, position: recordPosition(last.element), anchors };
}

/** Installs the tracker's listeners while at least one `useRestoreFocus` is mounted. */
function retainFocusTracker(): () => void {
  if (typeof document === 'undefined') return () => {};
  const tracker = getFocusTracker();
  tracker.users += 1;
  if (!tracker.uninstall) {
    const doc = document;
    const onFocusIn = (event: FocusEvent) => {
      if (isElementTarget(event.target)) recordFocus(tracker, event.target);
    };
    // Focus leaves for nowhere when the element is removed (some browsers fire focusout then) or
    // when the user presses a non-focusable spot. Decide once the current task has run: an element
    // still in the document that can take focus was left on purpose and is no opener to return to.
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (event.relatedTarget || !isElementTarget(target)) return;
      queueMicrotask(() => {
        if (tracker.last?.element !== target) return;
        if (!target.isConnected || !isFocusable(target)) return;
        if (target.ownerDocument.activeElement !== target) tracker.last = null;
      });
    };
    doc.addEventListener('focusin', onFocusIn, true);
    doc.addEventListener('focusout', onFocusOut, true);
    const unsubscribe = subscribeLayers(() => refreshFocusRecord(tracker));
    if (isElementTarget(doc.activeElement)) recordFocus(tracker, doc.activeElement);
    tracker.uninstall = () => {
      doc.removeEventListener('focusin', onFocusIn, true);
      doc.removeEventListener('focusout', onFocusOut, true);
      unsubscribe();
      tracker.last = null;
    };
  }
  let retained = true;
  return () => {
    if (!retained) return;
    retained = false;
    tracker.users = Math.max(0, tracker.users - 1);
    if (tracker.users > 0) return;
    tracker.uninstall?.();
    tracker.uninstall = null;
  };
}

/**
 * The tracker's record of the element focus was lost from: it no longer has focus and was removed,
 * or can no longer take focus (disabled, hidden, made inert). `null` when focus was moved away from
 * it on purpose, or it still has focus.
 */
function getLostFocus(): OpenerRecord | null {
  const last = getFocusTracker().last;
  if (!last) return null;
  const { element } = last;
  if (element.ownerDocument.activeElement === element) return null;
  if (element.isConnected && isFocusable(element)) return null;
  return last;
}

/**
 * The element to restore to when the surface opens: the trigger, else the focused element, else —
 * focus already lost to `<body>` — the element the focus tracker saw lose it.
 */
function captureOpener(options: UseRestoreFocusOptions): OpenerRecord | null {
  if (typeof document === 'undefined') return null;
  const { container, triggerRef } = options;
  const isCandidate = (el: Element | null | undefined): el is HTMLElement =>
    !!el &&
    el !== el.ownerDocument.body &&
    el !== el.ownerDocument.documentElement &&
    !(container && container.contains(el));
  const trigger = triggerRef?.current;
  const active = document.activeElement;
  let element: HTMLElement | null = null;
  if (isCandidate(trigger)) element = trigger;
  else if (isCandidate(active)) element = active;
  if (element) {
    return {
      element,
      position: recordPosition(element),
      anchors: captureAnchors(element, container),
    };
  }
  // The opener was removed earlier in this commit (a menu item in a popover that closed as this
  // surface opened), or can no longer take focus: use what the tracker recorded while it could.
  const lost = getLostFocus();
  if (!lost || !isCandidate(lost.element)) return null;
  return {
    element: lost.element,
    position: lost.position,
    anchors: lost.anchors.filter((anchor) => !(container && container.contains(anchor.element))),
  };
}

/** A layer's surface (or its first tabbable element), for the last-resort fallbacks. */
function getLayerTargets(layer: LayerRecord | null): HTMLElement[] {
  if (!layer) return [];
  const targets: HTMLElement[] = [];
  for (const el of layer.getElements()) {
    if (!el) continue;
    targets.push(el);
    const first = getFirstTabbable(el);
    if (first) targets.push(first);
  }
  return targets;
}

function isAfterPoint(el: Element, point: DomPoint): boolean {
  const { ref, placement } = point;
  if (el === ref) return placement === 'before';
  const follows = (ref.compareDocumentPosition(el) & FOLLOWING) !== 0;
  return placement === 'before' ? follows : follows && !ref.contains(el);
}

/**
 * Where to look once the recorded element is gone (or cannot take focus): its nearest ancestor
 * still in the document, and the point where the element used to be. `null` when its whole overlay
 * (the portal wrapper) was removed: that spot means nothing on the page.
 */
function resolvePoint(position: DomPosition): { root: Element; point: DomPoint } | null {
  const { path } = position;
  const index = path.findIndex((el) => el.isConnected);
  if (index === -1) return null;
  if (index === 0) {
    const root = path[0].parentElement;
    return root ? { root, point: { ref: path[0], placement: 'after' } } : null;
  }
  if (path.slice(0, index).some((el) => el.matches(PORTAL_SELECTOR))) return null;
  const root = path[index];
  const next = position.next[index - 1];
  if (next && next.parentElement === root) {
    return { root, point: { ref: next, placement: 'before' } };
  }
  const previous = position.previous[index - 1];
  if (previous && previous.parentElement === root) {
    return { root, point: { ref: previous, placement: 'after' } };
  }
  return { root, point: { ref: root, placement: 'before' } };
}

/**
 * Tabbable elements near a recorded position, nearest first. In the innermost surviving ancestor
 * that holds a valid one: the first after the old spot (where Tab would have gone from there),
 * else the last before it; then the same one level up. The search stops at the element's overlay
 * (its portal wrapper) and never reaches behind an open modal.
 */
function getNearbyTargets(
  position: DomPosition,
  container: HTMLElement | null | undefined,
): HTMLElement[] {
  const resolved = resolvePoint(position);
  if (!resolved) return [];
  const { root, point } = resolved;
  const body = root.ownerDocument.body;
  const levels: Element[] = [];
  for (let level: Element | null = root; level; level = level.parentElement) {
    if (isInsideOtherOpenModal(level)) break;
    levels.push(level);
    if (level === body || level.matches(PORTAL_SELECTOR)) break;
  }
  if (levels.length === 0) return [];
  const candidates = getTabbableElements(levels[levels.length - 1])
    .filter((el) => !(container && container.contains(el)) && isValidTarget(el))
    .sort((a, b) => ((a.compareDocumentPosition(b) & FOLLOWING) !== 0 ? -1 : 1));
  const targets: HTMLElement[] = [];
  for (const level of levels) {
    const inLevel = candidates.filter((el) => level.contains(el) && !targets.includes(el));
    const after = inLevel.find((el) => isAfterPoint(el, point));
    const before = inLevel.filter((el) => !isAfterPoint(el, point)).pop();
    if (after) targets.push(after);
    if (before) targets.push(before);
  }
  return targets;
}

/** Whether focus is where a popover's restore should still act: inside the surface or lost. */
function isFocusInsideOrLost(container: HTMLElement | null | undefined): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return true;
  return !!container && container.contains(active);
}

/**
 * Where to go when the opener was removed or can no longer take focus, nearest first: the tabbable
 * element next to where it was, else the trigger of the overlay it was in (a menu item's menu
 * button), else the element next to that trigger.
 */
function* getReplacementTargets(
  opener: OpenerRecord,
  container: HTMLElement | null | undefined,
): Generator<HTMLElement> {
  yield* getNearbyTargets(opener.position, container);
  for (const anchor of opener.anchors) yield anchor.element;
  for (const anchor of opener.anchors) yield* getNearbyTargets(anchor.position, container);
}

/** Restore targets in order of preference, computed lazily (the later ones cost more). */
function* restoreCandidates(
  latest: Latest,
  opener: OpenerRecord | null,
): Generator<HTMLElement | null | undefined> {
  const { options, parentLayerId } = latest;
  yield options.finalFocusRef?.current;
  yield opener?.element;
  yield options.triggerRef?.current;
  yield options.fallback?.();
  const replacements = opener ? getReplacementTargets(opener, options.container) : null;
  const parentLayer = parentLayerId === null ? null : getLayer(parentLayerId);
  const outsideParent: HTMLElement[] = [];
  if (parentLayer) {
    // The surface was rendered inside a layer that stays open (a confirm Dialog in a Drawer): the
    // opener's replacement inside that layer (the next row after a delete) comes before the
    // layer's surface, so where the surface sits in the React tree does not change the result.
    for (const target of replacements ?? []) {
      if (isInsideLayerTree(parentLayer.id, target)) yield target;
      else outsideParent.push(target);
    }
    yield* getLayerTargets(parentLayer);
    yield* outsideParent;
  } else if (replacements) {
    yield* replacements;
  }
  // Still nothing: into the modal that stays open, never onto the inert page behind it.
  yield* getLayerTargets(getTopmostLayer((layer) => layer.kind === 'modal'));
}

function restore(latest: Latest, opener: OpenerRecord | null): void {
  const container = latest.options.container;
  for (const candidate of restoreCandidates(latest, opener)) {
    if (container && candidate && container.contains(candidate)) continue;
    if (isValidTarget(candidate) && tryFocus(candidate)) return;
  }
}

/**
 * Returns focus to where it came from when a surface closes (dialogs, drawers, popovers, menus,
 * the DatePicker calendar, TeachingPopover).
 *
 * - **Capture**: when `enabled` flips to `true`, the opener is captured in an insertion effect —
 *   before React applies `autoFocus` inside the new surface — preferring `triggerRef.current` and
 *   ignoring `<body>` and elements inside `container`. Its place in the document and the triggers
 *   of the overlays it sits in are recorded with it. When focus is already on `<body>` because
 *   the focused element was removed earlier in the same commit (a menu item in a popover that
 *   closes as the dialog it opens appears, the popover coming first in the tree), a document
 *   focus tracker supplies that element with its recorded place and overlay triggers. The tracker
 *   runs while any instance of the hook is mounted, and it forgets an element the user moved focus
 *   away from on purpose.
 * - **Restore** when `enabled` flips to `false` (layout phase) and when the component unmounts
 *   while enabled. The unmount restore runs in a microtask and is cancelled if the same instance
 *   mounts again, so React StrictMode's simulated unmount does not pull focus out of a surface
 *   that just opened.
 * - **Targets**, first valid wins:
 *   1. `finalFocusRef` → the captured opener → `triggerRef` → `fallback()`.
 *   2. When the opener was removed or cannot take focus, its replacement, nearest first: the
 *      tabbable element next to where it was (in the innermost surviving ancestor that holds one,
 *      the next one — the next row's action after a delete — else the previous one; then the same
 *      one level up), else the trigger of the overlay it was in (a menu item's menu button), else
 *      the element next to that trigger. When the surface is rendered inside another open layer
 *      (its parent layer, from `DismissLayerContext`: a confirm Dialog in a Drawer's content),
 *      only the replacements inside that layer's tree are tried here.
 *   3. The parent layer's surface, then the replacements outside the parent layer.
 *   4. The surface of the modal layer that stays open.
 *
 *   So a confirm Dialog rendered in a Drawer's content and one rendered next to the Drawer both
 *   return focus to the adjacent row, not to the Drawer's panel. A target is valid when it is
 *   connected, focusable, not inside `[inert]` or `[aria-hidden="true"]`, and not cut off behind
 *   another open modal layer — so focus never lands on the inert page behind a Drawer that stays
 *   open, and is not dropped on `<body>` while a valid target exists. Focus uses `preventScroll`.
 * - `onlyIfFocusInside` (popovers): restores only when focus is inside the surface or was lost to
 *   `<body>`.
 */
export function useRestoreFocus(options: UseRestoreFocusOptions): void {
  const parentLayerId = React.useContext(DismissLayerContext);
  const latestRef = useRef<Latest>({ options, parentLayerId });
  const capturedRef = useRef<OpenerRecord | null>(null);
  const insertionEnabledRef = useRef(false);
  const layoutEnabledRef = useRef(false);
  const scheduledRef = useRef<object | null>(null);
  const { enabled } = options;

  // Track focus while mounted, so an opener removed in the commit that opens the surface is known.
  useIsomorphicLayoutEffect(() => retainFocusTracker(), []);

  // Mutation phase: record the latest options and capture the opener when `enabled` turns on,
  // before autoFocus (layout phase) or a focus trap's initial focus moves focus into the surface.
  useInsertionEffect(() => {
    latestRef.current = { options, parentLayerId };
    const wasEnabled = insertionEnabledRef.current;
    insertionEnabledRef.current = options.enabled;
    if (options.enabled && !wasEnabled) capturedRef.current = captureOpener(options);
  });

  // `enabled` true → false: restore in the layout phase (after every cleanup of this commit, so a
  // modal's isolation is already gone).
  useIsomorphicLayoutEffect(() => {
    const wasEnabled = layoutEnabledRef.current;
    layoutEnabledRef.current = enabled;
    if (!wasEnabled || enabled) return;
    const latest = latestRef.current;
    const captured = capturedRef.current;
    capturedRef.current = null;
    if (latest.options.onlyIfFocusInside && !isFocusInsideOrLost(latest.options.container)) {
      return;
    }
    restore(latest, captured);
  }, [enabled]);

  // Unmount while enabled: restore in a microtask, cancelled by a remount of this instance.
  useIsomorphicLayoutEffect(() => {
    const latest = latestRef;
    const captured = capturedRef;
    const scheduled = scheduledRef;
    scheduled.current = null;
    return () => {
      const snapshot = latest.current;
      if (!snapshot.options.enabled) return;
      // Decide now, while the surface is still in the document.
      if (snapshot.options.onlyIfFocusInside && !isFocusInsideOrLost(snapshot.options.container)) {
        return;
      }
      const token = {};
      scheduled.current = token;
      const opener = captured.current;
      queueMicrotask(() => {
        if (scheduled.current !== token) return;
        scheduled.current = null;
        const active = typeof document === 'undefined' ? null : document.activeElement;
        const container = snapshot.options.container;
        // Focus placed elsewhere in the meantime (another surface opened) wins.
        if (
          active &&
          active !== document.body &&
          active !== document.documentElement &&
          !(container && container.contains(active))
        ) {
          return;
        }
        restore(snapshot, opener);
      });
    };
  }, []);
}
