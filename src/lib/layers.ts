import { getGlobalRegistry } from './globalRegistry';

/**
 * The shared stack of open dismissable layers (dialogs, drawers, popovers, menus, listboxes,
 * tooltips) and the document listeners that route Escape, outside presses and focus changes to
 * them. `useDismiss` registers layers; focus traps, modal isolation and focus restore read the
 * stack. It lives in `getGlobalRegistry('layers')`, so an app that loads both the ESM and the CJS
 * build still has one stack and one set of listeners.
 */

/**
 * z-index of each portal layer. `Portal` adds its nesting depth, so a surface opened from inside
 * another overlay always stacks above it. The values fall back to the defaults of `tokens.css`.
 */
export const Z_INDEX = {
  overlay: 'var(--wave-z-overlay, 1000)',
  toast: 'var(--wave-z-toast, 1100)',
  tooltip: 'var(--wave-z-tooltip, 1200)',
} as const;

/**
 * What kind of surface a layer is. `modal` marks dialog-like surfaces (focus-restore validation and
 * modal isolation look for them); a modal blocks presses and Escape for the layers below it only
 * while its page isolation is active ({@link registerLayerIsolation}).
 */
export type LayerKind = 'modal' | 'popover' | 'menu' | 'listbox' | 'tooltip' | 'toast';

/** Why a layer is being dismissed. */
export type DismissReason = 'escape' | 'outside-press' | 'focus-outside';

/** A registered layer. Getters are allowed, so fields can read the latest options. */
export interface LayerRecord {
  /** Unique id; children name it as their `parentId` (through `DismissLayerContext`). */
  id: string;
  /** The enclosing layer (React parentage, which survives portals), or `null`. */
  parentId: string | null;
  kind: LayerKind;
  /** Global open-order counter, assigned by {@link registerLayer} (the passed value is replaced). */
  order: number;
  /** The elements that belong to the layer: its surface, its trigger, extra ignore targets. */
  getElements(): Array<HTMLElement | null>;
  /** The element the layer is anchored to (its trigger); focus traps leave the layer through it. */
  getAnchor(): HTMLElement | null;
  /** Whether Escape dismisses the layer. */
  escape: boolean;
  /** Whether a press outside the layer's tree dismisses it; a predicate returning `false` opts out. */
  outsidePress: boolean | ((event: PointerEvent | MouseEvent) => boolean);
  /** Whether focus moving outside the layer's tree dismisses it. */
  focusOutside: boolean;
  /** Called when the layer should close. */
  onDismiss(reason: DismissReason, event: Event): void;
}

/**
 * Regions (the Toaster viewport) whose content counts as inside **every** layer and whose
 * tabbables join every focus trap's Tab cycle. Modal isolation never makes them inert.
 */
export const ALLOW_OUTSIDE_SELECTOR = '[data-wave-focus-trap-allow]';

interface PressSnapshot {
  /** Layers with outside press enabled whose tree did not contain the pointerdown target. */
  layers: LayerRecord[];
  /** The open-order counter at pointerdown: layers registered later are never dismissed. */
  watermark: number;
}

interface InstalledListeners {
  remove(): void;
}

interface LayerState {
  /** Open layers from bottom to top. A parent always precedes its descendants. */
  stack: LayerRecord[];
  /** Elements registered per layer id (portal wrappers of the layer's descendants). */
  elements: Map<string, Set<HTMLElement>>;
  counter: number;
  press: PressSnapshot | null;
  listeners: InstalledListeners | null;
  /** Called after a layer registers or unregisters (modal isolation re-plans). */
  subscribers: Set<() => void>;
  /** Ids of layers whose modal isolation currently makes the page inert, with a use count. */
  isolated: Map<string, number>;
}

function getState(): LayerState {
  const state = getGlobalRegistry<LayerState>('layers', () => ({
    stack: [],
    elements: new Map(),
    counter: 0,
    press: null,
    listeners: null,
    subscribers: new Set(),
    isolated: new Map(),
  }));
  // A registry created by an earlier copy of this module (hot reload) may predate these fields.
  state.subscribers ??= new Set();
  state.isolated ??= new Map();
  return state;
}

function notifySubscribers(state: LayerState): void {
  for (const subscriber of Array.from(state.subscribers)) subscriber();
}

const ELEMENT_NODE = 1;

function findLayer(state: LayerState, id: string | null): LayerRecord | undefined {
  if (id === null) return undefined;
  return state.stack.find((layer) => layer.id === id);
}

/** Whether `layer` is a (possibly indirect) descendant of the layer `ancestorId`. */
function isDescendantOf(state: LayerState, layer: LayerRecord, ancestorId: string): boolean {
  const visited = new Set<string>([layer.id]);
  let parentId = layer.parentId;
  while (parentId !== null && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    parentId = findLayer(state, parentId)?.parentId ?? null;
  }
  return false;
}

function containsNode(container: Node | null | undefined, target: Node): boolean {
  return !!container && container.contains(target);
}

function isInsideTreeWithoutAllowList(
  state: LayerState,
  layerId: string,
  target: Node,
  visited: Set<string>,
): boolean {
  if (visited.has(layerId)) return false;
  visited.add(layerId);

  const record = findLayer(state, layerId);
  if (record && record.getElements().some((el) => containsNode(el, target))) return true;

  const registered = state.elements.get(layerId);
  if (registered) {
    for (const el of registered) {
      if (containsNode(el, target)) return true;
    }
  }

  for (const layer of state.stack) {
    if (
      layer.parentId === layerId &&
      isInsideTreeWithoutAllowList(state, layer.id, target, visited)
    ) {
      return true;
    }
  }
  return false;
}

function isInsideAllowList(target: Node): boolean {
  const el = target.nodeType === ELEMENT_NODE ? (target as Element) : target.parentElement;
  return !!el && el.closest(ALLOW_OUTSIDE_SELECTOR) !== null;
}

/**
 * Whether `target` belongs to the tree of the layer `layerId`:
 * - the layer's own elements (`getElements()`),
 * - elements registered for it with {@link registerLayerElement} (portal wrappers of overlays
 *   rendered inside it — React parentage survives portals, the DOM does not),
 * - every descendant layer's tree, and
 * - regions matching {@link ALLOW_OUTSIDE_SELECTOR} (the Toaster viewport), which count as inside
 *   every layer.
 */
export function isInsideLayerTree(layerId: string, target: Node): boolean {
  if (isInsideAllowList(target)) return true;
  return isInsideTreeWithoutAllowList(getState(), layerId, target, new Set());
}

/**
 * Compares two layers for stacking: `> 0` when `a` is above `b`. A descendant layer is above its
 * ancestor; otherwise the layer whose tree opened later is above. (A parent that registers after
 * its descendants — effects run child-first when both open in one commit — takes the place of its
 * earliest descendant.)
 */
export function compareLayers(a: LayerRecord, b: LayerRecord): number {
  if (a === b || a.id === b.id) return 0;
  const state = getState();
  if (isDescendantOf(state, a, b.id)) return 1;
  if (isDescendantOf(state, b, a.id)) return -1;
  const indexA = state.stack.indexOf(a);
  const indexB = state.stack.indexOf(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  return a.order - b.order;
}

/** The topmost open layer (optionally the topmost one matching `predicate`), or `null`. */
export function getTopmostLayer(predicate?: (layer: LayerRecord) => boolean): LayerRecord | null {
  const { stack } = getState();
  for (let i = stack.length - 1; i >= 0; i--) {
    const layer = stack[i];
    if (!predicate || predicate(layer)) return layer;
  }
  return null;
}

/**
 * Marks the layer `layerId` as isolating the page: `useModalIsolation` made everything outside its
 * tree inert (Dialog, Drawer). While it is open, the topmost isolating layer is a barrier — layers
 * stacked below it (its ancestors and older siblings) are never dismissed by outside presses and
 * never receive Escape, the way a modal blocks the page behind it. Layers above it (its
 * descendants, or a modal opened later) are unaffected. A `kind: 'modal'` layer without isolation
 * (a transient popup such as the DatePicker calendar, whose page stays interactive) is no barrier.
 * Returns the unregister function; registrations are counted, so the layer stays marked until
 * every registration is removed.
 */
export function registerLayerIsolation(layerId: string): () => void {
  const { isolated } = getState();
  isolated.set(layerId, (isolated.get(layerId) ?? 0) + 1);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const count = (isolated.get(layerId) ?? 1) - 1;
    if (count > 0) isolated.set(layerId, count);
    else isolated.delete(layerId);
  };
}

/** The topmost open layer whose modal isolation is active, or `null`. */
function getIsolationBarrier(state: LayerState): LayerRecord | null {
  if (state.isolated.size === 0) return null;
  return getTopmostLayer((layer) => state.isolated.has(layer.id));
}

/** Whether `layer` is stacked below `barrier` (neither the barrier itself nor above it). */
function isBelowBarrier(layer: LayerRecord, barrier: LayerRecord | null): boolean {
  return !!barrier && barrier !== layer && compareLayers(barrier, layer) > 0;
}

/**
 * Whether `layer` is stacked below the topmost open **isolating** modal (see
 * {@link registerLayerIsolation}). Such a layer is behind the modal and inert: outside presses
 * never dismiss it and Escape never reaches it. The modal's descendants are above it and stay
 * reachable; a modal-kind layer without isolation shields nothing.
 */
export function isBehindIsolatingModal(layer: LayerRecord): boolean {
  return isBelowBarrier(layer, getIsolationBarrier(getState()));
}

/**
 * Calls `listener` synchronously after any layer registers or unregisters (in the committing
 * component's layout effect, so a modal can re-plan its isolation before a newly opened modal
 * moves focus). Returns the unsubscribe function.
 */
export function subscribeLayers(listener: () => void): () => void {
  const { subscribers } = getState();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/** The open layers from bottom to top (a copy; a parent always precedes its descendants). */
export function getOpenLayers(): LayerRecord[] {
  return [...getState().stack];
}

/** The open layer with this id, or `null`. */
export function getLayer(layerId: string): LayerRecord | null {
  return findLayer(getState(), layerId) ?? null;
}

/** Whether the open layer `layerId` is a (possibly indirect) descendant of `ancestorId`. */
export function isDescendantLayer(layerId: string, ancestorId: string): boolean {
  const state = getState();
  const layer = findLayer(state, layerId);
  return !!layer && isDescendantOf(state, layer, ancestorId);
}

/**
 * Every element that makes up the tree of `layerId`: the layer's own elements, the elements
 * registered for it and the same for each descendant layer (the allow-list is not included).
 * With `includeOwnElements: false` the layer's own `getElements()` are left out (its descendants'
 * are still included).
 */
export function getLayerTreeElements(
  layerId: string,
  options?: { includeOwnElements?: boolean },
): HTMLElement[] {
  const state = getState();
  const result: HTMLElement[] = [];
  const includeOwn = options?.includeOwnElements ?? true;
  const visit = (id: string, visited: Set<string>) => {
    if (visited.has(id)) return;
    visited.add(id);
    const record = findLayer(state, id);
    if (record && (includeOwn || id !== layerId)) {
      for (const el of record.getElements()) {
        if (el && !result.includes(el)) result.push(el);
      }
    }
    for (const el of state.elements.get(id) ?? []) {
      if (!result.includes(el)) result.push(el);
    }
    for (const layer of state.stack) {
      if (layer.parentId === id) visit(layer.id, visited);
    }
  };
  visit(layerId, new Set());
  return result;
}

/**
 * Whether focusing `el` would send focus behind another open modal layer: the topmost open modal
 * layer other than `exceptLayerId` (and its descendants, which close with it) does not contain
 * `el` in its tree. An element inside that modal's tree (for example an opener inside a parent
 * dialog) is reachable and returns `false`. Used to validate focus-restore targets.
 */
export function isInsideOtherOpenModal(el: Element, exceptLayerId?: string): boolean {
  const state = getState();
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const layer = state.stack[i];
    if (layer.kind !== 'modal') continue;
    if (exceptLayerId !== undefined) {
      if (layer.id === exceptLayerId || isDescendantOf(state, layer, exceptLayerId)) continue;
    }
    return !isInsideLayerTree(layer.id, el);
  }
  return false;
}

/**
 * Registers an element (a portal wrapper) as part of the layer `layerId`, so presses and focus
 * inside it count as inside that layer and its ancestors. Returns the unregister function (usable
 * as a React 19 ref-callback cleanup). The layer does not need to be registered yet.
 */
export function registerLayerElement(layerId: string, el: HTMLElement): () => void {
  const state = getState();
  let set = state.elements.get(layerId);
  if (!set) {
    set = new Set();
    state.elements.set(layerId, set);
  }
  set.add(el);
  return () => {
    const current = state.elements.get(layerId);
    if (!current) return;
    current.delete(el);
    if (current.size === 0) state.elements.delete(layerId);
  };
}

/**
 * Registers an open layer and returns its unregister function. `record.order` is set to the next
 * value of the global open-order counter. The layer is placed on top of the stack — or, when some
 * of its descendants registered first (same commit), directly below the earliest of them.
 */
export function registerLayer(record: LayerRecord): () => void {
  const state = getState();
  state.counter += 1;
  record.order = state.counter;

  const firstDescendant = state.stack.findIndex((layer) => isDescendantOf(state, layer, record.id));
  if (firstDescendant === -1) state.stack.push(record);
  else state.stack.splice(firstDescendant, 0, record);

  ensureListeners(state);
  notifySubscribers(state);

  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    const index = state.stack.indexOf(record);
    if (index !== -1) state.stack.splice(index, 1);
    if (state.press) {
      state.press.layers = state.press.layers.filter((layer) => layer !== record);
    }
    if (state.stack.length === 0) removeListeners(state);
    notifySubscribers(state);
  };
}

// ---------------------------------------------------------------------------
// Document listeners
// ---------------------------------------------------------------------------

function getEventTargetNode(event: Event): Node | null {
  const target = event.target as { nodeType?: unknown } | null;
  return target && typeof target.nodeType === 'number' ? (target as Node) : null;
}

/** Topmost first: descendants before their ancestors. */
function sortTopmostFirst(layers: LayerRecord[]): LayerRecord[] {
  return [...layers].sort((a, b) => compareLayers(b, a));
}

/**
 * The layer that handles an Escape whose target / focused element is `target` / `active`.
 * Candidates are the escape-enabled layers that are not stacked below the topmost isolating modal
 * (a modal that ignores Escape never lets the key close something inert behind it — its ancestor
 * dialog as much as an older sibling):
 * 1. the innermost layer whose tree contains them (the topmost such layer) is the focus scope;
 * 2. the topmost candidate of that scope's subtree handles it — the scope itself or an open
 *    descendant above it (a tooltip or popover opened from the focused dialog closes first, while
 *    a sibling of the focused layer is not in its subtree);
 * 3. else the topmost candidate whose tree contains them (an ancestor);
 * 4. else — no layer contains them, or none of the containing layers takes Escape — the global
 *    topmost candidate.
 */
function findEscapeHandler(
  state: LayerState,
  target: Node | null,
  active: Element | null,
): LayerRecord | null {
  const barrier = getIsolationBarrier(state);
  const isCandidate = (layer: LayerRecord) => layer.escape && !isBelowBarrier(layer, barrier);
  const contains = (layer: LayerRecord) =>
    (!!target && isInsideLayerTree(layer.id, target)) ||
    (!!active && isInsideLayerTree(layer.id, active));
  const scope = getTopmostLayer(contains);
  const handler = scope
    ? (getTopmostLayer(
        (layer) =>
          isCandidate(layer) && (layer === scope || isDescendantOf(state, layer, scope.id)),
      ) ?? getTopmostLayer((layer) => isCandidate(layer) && contains(layer)))
    : null;
  return handler ?? getTopmostLayer(isCandidate);
}

/** Keys that activate the focused control with a synthetic click. */
function isClickActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

function handleKeyDown(event: KeyboardEvent): void {
  const state = getState();
  if (event.key === 'Escape' || event.key === 'Esc') {
    if (event.defaultPrevented || event.isComposing) return;
    const handler = findEscapeHandler(state, getEventTargetNode(event), document.activeElement);
    if (!handler) return;
    event.preventDefault();
    handler.onDismiss('escape', event);
    return;
  }
  // A keyboard-activated click (Enter/Space) must not dismiss layers recorded by an unrelated
  // earlier pointerdown. Other keys keep the pending press: modifiers held for a Shift/Ctrl+click
  // auto-repeat their keydown while the pointer is down.
  if (isClickActivationKey(event.key)) state.press = null;
}

function handlePointerDown(event: PointerEvent): void {
  const state = getState();
  const target = getEventTargetNode(event);
  // Only a primary press is followed by a click (right/middle buttons fire contextmenu/auxclick).
  if (!target || event.button !== 0) {
    state.press = null;
    return;
  }
  const barrier = getIsolationBarrier(state);
  const layers = state.stack.filter((layer) => {
    const { outsidePress } = layer;
    if (!outsidePress) return false;
    // A layer behind an open isolating modal (its parent dialog, or a dialog below a sibling
    // modal opened from inside it) is inert and not reachable: presses inside that modal, or on
    // its backdrop, are not "outside" presses for it.
    if (isBelowBarrier(layer, barrier)) return false;
    if (isInsideLayerTree(layer.id, target)) return false;
    return typeof outsidePress !== 'function' || outsidePress(event) !== false;
  });
  state.press = { layers, watermark: state.counter };
}

/**
 * How long (ms) a touch, pen or unknown-device press waits for its click after the pointerup. A
 * tap's click follows within about 350 ms (at most the double-tap delay); a press that gets no
 * click (a long press that opened the context menu, a tap on a non-clickable area) is forgotten
 * after this, so a later programmatic `click()` cannot complete it.
 */
const GESTURE_CLICK_TIMEOUT_MS = 1000;

/**
 * A mouse click is dispatched right after its pointerup, in the same task. When none follows (the
 * pointer was released over another window or element tree), a mouse press is forgotten on the
 * next macrotask, so a later programmatic `click()` cannot complete it. Touch and stylus taps are
 * turned into a click by a separate gesture event in a later task (Apple Pencil on iPadOS and
 * Android styluses report `pointerType: 'pen'`, and an unknown device type `''` may behave the
 * same way), so every other pointer type keeps its press for {@link GESTURE_CLICK_TIMEOUT_MS}.
 * The next pointerdown, pointercancel, contextmenu or Enter/Space forgets a press earlier.
 */
function handlePointerUp(event: PointerEvent): void {
  const press = getState().press;
  if (!press) return;
  const timeout = event.pointerType === 'mouse' ? 0 : GESTURE_CLICK_TIMEOUT_MS;
  setTimeout(() => {
    const current = getState();
    if (current.press === press) current.press = null;
  }, timeout);
}

/** A cancelled pointer stream, or a context menu (a long press, a Mac Ctrl+click), gets no click. */
function forgetPress(): void {
  getState().press = null;
}

function handleClick(event: MouseEvent): void {
  const state = getState();
  const press = state.press;
  state.press = null;
  if (!press) return;
  const target = getEventTargetNode(event);
  const toDismiss = press.layers.filter(
    (layer) =>
      layer.order <= press.watermark &&
      state.stack.includes(layer) &&
      !(target && isInsideLayerTree(layer.id, target)),
  );
  for (const layer of sortTopmostFirst(toDismiss)) {
    if (state.stack.includes(layer)) layer.onDismiss('outside-press', event);
  }
}

function handleFocusIn(event: FocusEvent): void {
  const state = getState();
  const target = getEventTargetNode(event);
  if (!target) return;
  const toDismiss = state.stack.filter(
    (layer) => layer.focusOutside && !isInsideLayerTree(layer.id, target),
  );
  for (const layer of sortTopmostFirst(toDismiss)) {
    if (state.stack.includes(layer)) layer.onDismiss('focus-outside', event);
  }
}

function ensureListeners(state: LayerState): void {
  if (state.listeners || typeof document === 'undefined') return;
  const doc = document;
  doc.addEventListener('keydown', handleKeyDown);
  doc.addEventListener('pointerdown', handlePointerDown, true);
  doc.addEventListener('pointerup', handlePointerUp, true);
  doc.addEventListener('pointercancel', forgetPress, true);
  doc.addEventListener('contextmenu', forgetPress, true);
  doc.addEventListener('click', handleClick);
  doc.addEventListener('focusin', handleFocusIn, true);
  state.listeners = {
    remove() {
      doc.removeEventListener('keydown', handleKeyDown);
      doc.removeEventListener('pointerdown', handlePointerDown, true);
      doc.removeEventListener('pointerup', handlePointerUp, true);
      doc.removeEventListener('pointercancel', forgetPress, true);
      doc.removeEventListener('contextmenu', forgetPress, true);
      doc.removeEventListener('click', handleClick);
      doc.removeEventListener('focusin', handleFocusIn, true);
    },
  };
}

function removeListeners(state: LayerState): void {
  state.listeners?.remove();
  state.listeners = null;
  state.press = null;
}
