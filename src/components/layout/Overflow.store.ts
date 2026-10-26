import { isDev, warnOnce } from '../../lib/dev';
import type { Orientation } from '../../lib/types';

/**
 * Which end of the row overflows first: `'end'` hides the last items in DOM order first, `'start'`
 * the first ones. Equal priorities follow it.
 */
export type OverflowDirection = 'end' | 'start';

/**
 * How much of an item group is shown: `'visible'` (every member), `'hidden'` (none) or `'overflow'`
 * (some).
 */
export type OverflowGroupVisibility = 'visible' | 'hidden' | 'overflow';

// ---------------------------------------------------------------------------
// Measurement store
// ---------------------------------------------------------------------------

/**
 * The empty snapshot. Snapshots are internal: they are compared by identity and never handed to
 * consumers, who receive their own copies (see `useOverflowMenu` and `overflowButton`).
 */
export const NO_IDS: string[] = [];

export function hasResizeObserver(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

function documentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** Moves anywhere in the row: items reordered directly or inside wrappers. */
const REORDER_OBSERVER_OPTIONS: MutationObserverInit = { childList: true, subtree: true };

export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function warnDuplicateItemId(itemId: string): void {
  warnOnce(
    `Overflow:duplicate:${itemId}`,
    `Overflow: several items share the itemId "${itemId}". Item ids must be unique within an ` +
      'Overflow; items with the same itemId are hidden and shown together.',
  );
}

const noop = () => {};

/** Room available to items: the content box of the container on the axis, and the flex gap. */
function readContainer(
  container: HTMLElement,
  orientation: Orientation,
): { available: number; gap: number } {
  const vertical = orientation === 'vertical';
  let padding = 0;
  let gap = 0;
  const view = container.ownerDocument.defaultView;
  if (view) {
    const style = view.getComputedStyle(container);
    padding = vertical
      ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
      : (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    gap = parseFloat(vertical ? style.rowGap : style.columnGap) || 0;
  }
  return { available: (vertical ? container.clientHeight : container.clientWidth) - padding, gap };
}

/** What an item tells the store besides its id. */
export interface ItemMeta {
  id: string;
  priority: number | undefined;
  pinned: boolean;
}

/** What the store was told by the root's props. */
export interface StoreConfig {
  direction: OverflowDirection;
  orientation: Orientation;
  minimumVisible: number;
  /** The first measurement is published too (it takes the reserved button away). */
  hasHiddenItems: boolean;
}

/**
 * Picks the next item to hide: the visible, hidable item with the lowest priority; among equals
 * the last in DOM order for `end`, the first for `start`. `-1` when none is left.
 */
function pickVictim(
  metas: readonly ItemMeta[],
  hidden: readonly boolean[],
  direction: OverflowDirection,
  protectedIndex: number,
): number {
  let best = -1;
  let bestPriority = 0;
  for (let step = 0; step < metas.length; step++) {
    const i = direction === 'end' ? metas.length - 1 - step : step;
    const { priority, pinned } = metas[i];
    if (hidden[i] || pinned || i === protectedIndex) continue;
    const value = priority ?? 0;
    if (best < 0 || value < bestPriority) {
      best = i;
      bestPriority = value;
    }
  }
  return best;
}

/**
 * Tracks the container, the items and the overflow button of one `Overflow` and publishes the ids
 * of the hidden items (DOM order), and whether the button covers the first item, to
 * `useSyncExternalStore`.
 *
 * - **Measurement never writes styles.** An item's width is read (`offsetWidth`) only while it is
 *   visible and cached; a hidden item (`data-overflow-hidden` and an inline `display: none`, both
 *   rendered by React) keeps its last visible width. All reads happen before React applies the
 *   result.
 * - **Membership-only updates.** A new snapshot is published only when the hidden set (or whether
 *   the button covers the first item) changes, so a resize that hides the same items renders
 *   nothing.
 * - **One observer.** A single `ResizeObserver` (created when the root mounts) watches the
 *   container, every item and the overflow button. Without `ResizeObserver` the store measures
 *   whenever something registers and on window `resize`.
 * - **Reorders.** A keyed reorder moves item elements without registering them again or changing
 *   a size. The order of the last measurement is re-checked (n − 1 `compareDocumentPosition`
 *   calls, no layout reads) after every commit of the root and, through a `MutationObserver`
 *   (`childList`, `subtree`) on the container, after moves that do not render the root (a list
 *   component inside the row that owns its order); only an inversion re-measures.
 */
export class OverflowStore {
  private container: HTMLElement | null = null;
  private button: HTMLElement | null = null;
  private buttonSize = 0;
  /** The button is mounted and its size was read. */
  private buttonMeasured = false;
  private readonly items = new Map<HTMLElement, ItemMeta>();
  /** How many mounted items use each `itemId` (development only: a repeated one warns). */
  private readonly itemIdCounts = new Map<string, number>();
  /** The last visible size of each item on the measured axis. */
  private sizes = new WeakMap<HTMLElement, number>();
  private readonly listeners = new Set<() => void>();
  private config: StoreConfig = {
    direction: 'end',
    orientation: 'horizontal',
    minimumVisible: 0,
    hasHiddenItems: false,
  };
  private hidden: string[] = NO_IDS;
  /** Every item's id in DOM order, as of the last measurement. */
  private itemIds: string[] = NO_IDS;
  /** The visible items are wider than the room beside the button, so the button covers their end. */
  private buttonCovers = false;
  /** Whether a measurement has run (the server snapshot is `false`). */
  private measured = false;
  /** The item elements of the last measurement, in the DOM order they had then. */
  private order: HTMLElement[] = [];
  private connected = false;
  private observer: ResizeObserver | null = null;
  private reorderObserver: MutationObserver | null = null;
  private removeResizeListener: (() => void) | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): string[] => this.hidden;

  getServerSnapshot = (): string[] => NO_IDS;

  getButtonCovers = (): boolean => this.buttonCovers;

  getMeasured = (): boolean => this.measured;

  getServerFlag = (): boolean => false;

  /**
   * Whether the hidden set is final: the first items to overflow are measured without the button
   * that they bring in, so a set is provisional until a button that will render is measured.
   */
  isSettled(hasButton: boolean): boolean {
    return this.hidden.length === 0 || !hasButton || this.buttonMeasured;
  }

  /** The ids of the shown items, in DOM order. */
  getVisibleIds(): string[] {
    const hidden = new Set(this.hidden);
    return this.itemIds.filter((id) => !hidden.has(id));
  }

  /** Applies the root's props (layout effect); measures again when one changed. */
  setConfig(config: StoreConfig): void {
    const previous = this.config;
    if (
      previous.direction === config.direction &&
      previous.orientation === config.orientation &&
      previous.minimumVisible === config.minimumVisible &&
      previous.hasHiddenItems === config.hasHiddenItems
    ) {
      return;
    }
    // Sizes of the other axis are of no use to hidden items.
    if (previous.orientation !== config.orientation) this.sizes = new WeakMap();
    this.config = config;
    this.measure();
  }
  /** Starts observing (root layout effect); returns the teardown. */
  connect = (): (() => void) => {
    this.connected = true;
    if (hasResizeObserver()) {
      this.observer = new ResizeObserver(() => this.measure());
      for (const el of this.observedElements()) this.observer.observe(el);
    } else if (typeof window !== 'undefined') {
      const onResize = () => this.measure();
      window.addEventListener('resize', onResize);
      this.removeResizeListener = () => window.removeEventListener('resize', onResize);
    }
    if (typeof MutationObserver !== 'undefined') {
      this.reorderObserver = new MutationObserver(() => this.checkOrder());
      if (this.container) this.reorderObserver.observe(this.container, REORDER_OBSERVER_OPTIONS);
    }
    this.measure();
    return () => {
      this.connected = false;
      this.observer?.disconnect();
      this.observer = null;
      this.reorderObserver?.disconnect();
      this.reorderObserver = null;
      this.removeResizeListener?.();
      this.removeResizeListener = null;
    };
  };

  /** Ref callback of the container. */
  setContainer = (node: HTMLDivElement | null): void => {
    if (node === this.container) return;
    if (this.container) this.observer?.unobserve(this.container);
    this.container = node;
    if (node) this.observer?.observe(node);
    if (this.reorderObserver) {
      this.reorderObserver.disconnect();
      if (node) this.reorderObserver.observe(node, REORDER_OBSERVER_OPTIONS);
    }
    this.measure();
  };

  /**
   * Re-measures when the items of the last measurement are no longer in DOM order (a keyed
   * reorder). Cheap: neighbour comparisons only, no layout reads.
   */
  checkOrder = (): void => {
    const order = this.order;
    for (let i = 1; i < order.length; i++) {
      if (documentOrder(order[i - 1], order[i]) > 0) {
        this.measure();
        return;
      }
    }
  };

  /** Ref callback of the overflow button wrapper. The last measured width outlives it. */
  setButton = (node: HTMLDivElement | null): void => {
    if (node === this.button) return;
    if (this.button) this.observer?.unobserve(this.button);
    this.button = node;
    if (node) this.observer?.observe(node);
    this.measure();
  };

  /** Registers an item element; returns its unregistration. */
  registerItem(el: HTMLElement, id: string): () => void {
    this.items.set(el, { id, priority: undefined, pinned: false });
    this.observer?.observe(el);
    this.measure();
    return () => {
      if (this.items.get(el)?.id !== id) return;
      this.items.delete(el);
      this.observer?.unobserve(el);
      this.measure();
    };
  }

  /** Updates what a registered item says about its priority (layout effect of the item). */
  setItemMeta(el: HTMLElement, priority: number | undefined, pinned: boolean): void {
    const meta = this.items.get(el);
    if (!meta || (meta.priority === priority && meta.pinned === pinned)) return;
    meta.priority = priority;
    meta.pinned = pinned;
    this.measure();
  }

  /**
   * Counts the `itemId` of a mounted item (called from the item's effect, C-DEV); a second item
   * with an id already in use warns once per id. Returns the cleanup.
   */
  registerItemId = (itemId: string): (() => void) => {
    if (!isDev) return noop;
    const counts = this.itemIdCounts;
    const count = (counts.get(itemId) ?? 0) + 1;
    counts.set(itemId, count);
    if (count > 1) warnDuplicateItemId(itemId);
    return () => {
      const remaining = (counts.get(itemId) ?? 1) - 1;
      if (remaining > 0) counts.set(itemId, remaining);
      else counts.delete(itemId);
    };
  };

  private observedElements(): HTMLElement[] {
    const elements = Array.from(this.items.keys());
    if (this.container) elements.push(this.container);
    if (this.button) elements.push(this.button);
    return elements;
  }

  private measure(): void {
    const container = this.container;
    if (!this.connected || !container) return;
    const { direction, orientation, minimumVisible } = this.config;
    const vertical = orientation === 'vertical';

    // Reads first: sizes of the visible items, the button and the container.
    const entries = Array.from(this.items)
      .filter(([el]) => el.isConnected && container.contains(el))
      .sort(([a], [b]) => documentOrder(a, b));
    this.order = entries.map(([el]) => el);
    for (const [el] of entries) {
      if (!el.hasAttribute('data-overflow-hidden')) {
        this.sizes.set(el, vertical ? el.offsetHeight : el.offsetWidth);
      }
    }
    this.buttonMeasured = false;
    if (this.button?.isConnected) {
      this.buttonSize = vertical ? this.button.offsetHeight : this.button.offsetWidth;
      this.buttonMeasured = true;
    }
    const { available, gap } = readContainer(container, orientation);

    const metas = entries.map(([, meta]) => meta);
    const sizes = entries.map(([el]) => this.sizes.get(el) ?? 0);
    const hiddenFlags = metas.map(() => false);
    let visibleCount = metas.length;
    let used = sizes.reduce((sum, size) => sum + size, 0) + gap * Math.max(0, visibleCount - 1);

    if (used > available) {
      // Items beside the overflow button stay. Until an item sets a priority or pins itself, the
      // item at the far end from the hidden side stays too (0.13: the first item).
      const reserve = this.buttonSize > 0 ? this.buttonSize + gap : 0;
      const legacy = !metas.some((meta) => meta.pinned || meta.priority !== undefined);
      const protectedIndex = legacy ? (direction === 'end' ? 0 : metas.length - 1) : -1;
      while (used + reserve > available && visibleCount > minimumVisible) {
        const victim = pickVictim(metas, hiddenFlags, direction, protectedIndex);
        if (victim < 0) break;
        hiddenFlags[victim] = true;
        visibleCount--;
        used -= sizes[victim] + (visibleCount > 0 ? gap : 0);
      }
    }

    const next = metas.filter((_, i) => hiddenFlags[i]).map((meta) => meta.id);
    // The sticky button eats the gap before it first; it covers the visible items only when the
    // two do not fit side by side.
    const covers = next.length > 0 && used + this.buttonSize > available;

    const hiddenChanged = !sameIds(next, this.hidden);
    const itemIds = metas.map((meta) => meta.id);
    const idsChanged = !sameIds(itemIds, this.itemIds);
    if (!hiddenChanged && !idsChanged && covers === this.buttonCovers && this.measured) return;
    // The same hidden set keeps its array, so the items and useOverflowMenu() do not update.
    if (hiddenChanged) this.hidden = next.length > 0 ? next : NO_IDS;
    if (idsChanged) this.itemIds = itemIds;
    const changed =
      hiddenChanged ||
      covers !== this.buttonCovers ||
      (!this.measured && this.config.hasHiddenItems);
    this.buttonCovers = covers;
    this.measured = true;
    if (changed) for (const listener of Array.from(this.listeners)) listener();
  }
}
