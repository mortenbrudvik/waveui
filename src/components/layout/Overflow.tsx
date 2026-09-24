import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev } from '../../lib/dev';
import { useMergedRefs } from '../../hooks/useMergedRefs';

/** Properties for the Overflow component. */
export interface OverflowProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Renders the overflow button (for example a "+3" menu trigger) while at least one item is
   * hidden. Receives the number of hidden items and their `itemId`s in DOM order, so the button
   * can open a menu of the hidden items. `hiddenIds` is the button's own array (sorting it in
   * place affects nobody else). Its width is measured and reserved when items overflow.
   * Components rendered by it can also read the hidden items with {@link useOverflowMenu}.
   */
  overflowButton?: (count: number, hiddenIds: string[]) => React.ReactNode;
  /**
   * The {@link OverflowItem}s to lay out in one row. Only items and the overflow button are
   * measured: the container's whole content box is the room for them, so other content placed in
   * the row is not accounted for and could clip items that still count as visible. Keep fixed
   * content outside the Overflow (for example in a surrounding flex row), or wrap it in an
   * `OverflowItem` (the first item is never hidden).
   */
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the OverflowItem sub-component. */
export interface OverflowItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Unique identifier for tracking this item's overflow visibility. */
  itemId: string;
  /** Content of the overflow item. */
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** Result of {@link useOverflowMenu}. */
export interface UseOverflowMenuResult {
  /** `itemId`s of the hidden items, in DOM order (the caller's own array). */
  hiddenIds: string[];
  /** Number of hidden items. */
  count: number;
}

// ---------------------------------------------------------------------------
// Measurement store
// ---------------------------------------------------------------------------

/**
 * The empty snapshot. Snapshots are internal: they are compared by identity and never handed to
 * consumers, who receive their own copies (see `useOverflowMenu` and `overflowButton`).
 */
const NO_IDS: string[] = [];

/** A stable function that re-renders the calling component. */
function useForceRender(): () => void {
  return React.useReducer((n: number) => n + 1, 0)[1];
}

function hasResizeObserver(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

function documentOrder(a: Element, b: Element): number {
  if (a === b) return 0;
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/** Moves anywhere in the row: items reordered directly or inside wrappers. */
const REORDER_OBSERVER_OPTIONS: MutationObserverInit = { childList: true, subtree: true };

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Width available to items: the content box of the container, and the flex gap between items. */
function readContainer(container: HTMLElement): { available: number; gap: number } {
  let paddingInline = 0;
  let gap = 0;
  const view = container.ownerDocument.defaultView;
  if (view) {
    const style = view.getComputedStyle(container);
    paddingInline = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    gap = parseFloat(style.columnGap) || 0;
  }
  return { available: container.clientWidth - paddingInline, gap };
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
class OverflowStore {
  private container: HTMLElement | null = null;
  private button: HTMLElement | null = null;
  private buttonWidth = 0;
  private readonly items = new Map<HTMLElement, string>();
  private readonly widths = new WeakMap<HTMLElement, number>();
  private readonly listeners = new Set<() => void>();
  private hidden: string[] = NO_IDS;
  /** The first item is wider than the room beside the button, so the button covers its end. */
  private pinned = false;
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

  getPinned = (): boolean => this.pinned;

  getServerPinned = (): boolean => false;

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
    this.items.set(el, id);
    this.observer?.observe(el);
    this.measure();
    return () => {
      if (this.items.get(el) !== id) return;
      this.items.delete(el);
      this.observer?.unobserve(el);
      this.measure();
    };
  }

  private observedElements(): HTMLElement[] {
    const elements = Array.from(this.items.keys());
    if (this.container) elements.push(this.container);
    if (this.button) elements.push(this.button);
    return elements;
  }

  private measure(): void {
    const container = this.container;
    if (!this.connected || !container) return;

    // Reads first: widths of the visible items, the button and the container.
    const entries = Array.from(this.items)
      .filter(([el]) => el.isConnected && container.contains(el))
      .sort(([a], [b]) => documentOrder(a, b));
    this.order = entries.map(([el]) => el);
    for (const [el] of entries) {
      if (!el.hasAttribute('data-overflow-hidden')) this.widths.set(el, el.offsetWidth);
    }
    if (this.button?.isConnected) this.buttonWidth = this.button.offsetWidth;
    const { available, gap } = readContainer(container);

    const widths = entries.map(([el]) => this.widths.get(el) ?? 0);
    const total = widths.reduce((sum, width, i) => sum + width + (i > 0 ? gap : 0), 0);

    let next: string[] = NO_IDS;
    let pinned = false;
    if (total > available) {
      // Items that fit next to the overflow button stay; the first item always stays.
      const limit = available - (this.buttonWidth > 0 ? this.buttonWidth + gap : 0);
      let used = 0;
      let cut = entries.length;
      for (let i = 0; i < entries.length; i++) {
        const end = used + widths[i] + (i > 0 ? gap : 0);
        if (i > 0 && end > limit) {
          cut = i;
          break;
        }
        used = end;
      }
      next = entries.slice(cut).map(([, id]) => id);
      // The sticky button eats the gap before it first; it covers the first item only when the
      // two do not fit side by side.
      pinned = next.length > 0 && widths[0] + this.buttonWidth > available;
    }

    const hiddenChanged = !sameIds(next, this.hidden);
    if (!hiddenChanged && pinned === this.pinned) return;
    // The same hidden set keeps its array, so the items and useOverflowMenu() do not update.
    if (hiddenChanged) this.hidden = next.length > 0 ? next : NO_IDS;
    this.pinned = pinned;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

// ---------------------------------------------------------------------------
// Context (C-CONTEXT)
// ---------------------------------------------------------------------------

interface OverflowContextValue {
  store: OverflowStore;
  hiddenIds: string[];
  hiddenSet: ReadonlySet<string>;
}

const OverflowContext = React.createContext<OverflowContextValue | null>(null);

/** Production fallback for a misplaced sub-component: a store that is never connected. */
const INERT_CONTEXT: OverflowContextValue = {
  store: /* @__PURE__ */ new OverflowStore(),
  hiddenIds: NO_IDS,
  hiddenSet: /* @__PURE__ */ new Set<string>(),
};

/**
 * The enclosing Overflow's context. Outside an Overflow it throws in development and, in
 * production, logs an error and returns an inert value (C-CONTEXT).
 */
function useOverflowContext(componentName: string): OverflowContextValue {
  const ctx = React.useContext(OverflowContext);
  if (ctx) return ctx;
  const message = `[WaveUI] ${componentName} must be used within Overflow`;
  if (isDev) throw new Error(message);
  console.error(message);
  return INERT_CONTEXT;
}

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * The items an {@link Overflow} currently hides: their `itemId`s in DOM order and their count. Use
 * it in the component that `overflowButton` renders to list the hidden items in a menu. Must be
 * called inside `Overflow`.
 */
export function useOverflowMenu(): UseOverflowMenuResult {
  const { hiddenIds } = useOverflowContext('useOverflowMenu');
  // A copy per caller and snapshot: sorting or reversing it cannot affect other consumers.
  return React.useMemo(() => ({ hiddenIds: [...hiddenIds], count: hiddenIds.length }), [hiddenIds]);
}

/**
 * Whether the {@link OverflowItem} with `itemId` is currently shown (`false` while it overflows).
 * Must be called inside `Overflow`.
 */
export function useIsOverflowItemVisible(itemId: string): boolean {
  const { hiddenSet } = useOverflowContext('useIsOverflowItemVisible');
  return !hiddenSet.has(itemId);
}

function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}

/**
 * Keeps `observer` on the element children of `parent`: unobserves the removed ones and observes
 * the added ones that are still attached to `parent` (records are replayed in order, so a child
 * moved or re-added within one batch ends up observed exactly when it is present).
 */
function followDirectChildren(
  observer: ResizeObserver,
  parent: Element,
  records: readonly MutationRecord[],
): void {
  for (const record of records) {
    if (record.type !== 'childList' || record.target !== parent) continue;
    record.removedNodes.forEach((node) => {
      if (isElement(node)) observer.unobserve(node);
    });
    record.addedNodes.forEach((node) => {
      if (isElement(node) && node.parentNode === parent) observer.observe(node);
    });
  }
}

/** Tracks `scrollWidth > clientWidth` of one element. */
class OverflowingStore {
  private element: HTMLElement | null = null;
  private value = false;
  private readonly listeners = new Set<() => void>();
  private teardown: (() => void) | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): boolean => this.value;

  getServerSnapshot = (): boolean => false;

  /** Follows `element` (layout effect of every render); re-subscribes when it changes. */
  setElement(element: HTMLElement | null): void {
    if (element === this.element) return;
    this.disconnect();
    this.element = element;
    if (element) this.teardown = this.observe(element);
    this.check();
  }

  disconnect(): void {
    this.teardown?.();
    this.teardown = null;
    this.element = null;
  }

  private observe(element: HTMLElement): () => void {
    const check = () => this.check();
    const cleanups: Array<() => void> = [];

    // Resizes of the element and of its direct children (content that grows or shrinks).
    const resizeObserver = hasResizeObserver() ? new ResizeObserver(check) : null;
    if (resizeObserver) {
      resizeObserver.observe(element);
      for (const child of Array.from(element.children)) resizeObserver.observe(child);
      cleanups.push(() => resizeObserver.disconnect());
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', check);
      cleanups.push(() => window.removeEventListener('resize', check));
    }

    // Content added, removed or edited. Only a change of the direct children changes what the
    // ResizeObserver watches, and only those children are (un)observed; text edits and deeper
    // changes just re-check.
    if (typeof MutationObserver !== 'undefined') {
      const mutationObserver = new MutationObserver((records) => {
        if (resizeObserver) followDirectChildren(resizeObserver, element, records);
        check();
      });
      mutationObserver.observe(element, { childList: true, subtree: true, characterData: true });
      cleanups.push(() => mutationObserver.disconnect());
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }

  private check(): void {
    const el = this.element;
    const next = el !== null && el.scrollWidth > el.clientWidth;
    if (next === this.value) return;
    this.value = next;
    for (const listener of Array.from(this.listeners)) listener();
  }
}

function isRefObject(
  target: React.RefObject<HTMLElement | null> | HTMLElement | null | undefined,
): target is React.RefObject<HTMLElement | null> {
  return target != null && typeof target === 'object' && 'current' in target;
}

/**
 * Whether `target`'s content is wider than the element (`scrollWidth > clientWidth`).
 *
 * `target` is a ref object or the element itself (for example from callback-ref state:
 * `const [el, setEl] = useState(null)` + `ref={setEl}`). The hook re-checks when the element
 * resizes, when its direct children resize, and when content is added, removed or edited; an
 * element that mounts later (a ref attached conditionally) is picked up after the render that
 * mounts it. Without `ResizeObserver` it re-checks on window `resize` and content changes. Returns
 * `false` on the server.
 */
export function useIsOverflowing(
  target: React.RefObject<HTMLElement | null> | HTMLElement | null,
): boolean {
  const [store] = React.useState(() => new OverflowingStore());
  const isOverflowing = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const forceRender = useForceRender();

  // Every render: follow the element the ref points to now (cheap identity check). A change found
  // here re-renders from the layout phase, before paint: useSyncExternalStore only subscribes in a
  // passive effect, so on mount it would pick the first value up after the browser painted.
  useIsomorphicLayoutEffect(() => {
    const unsubscribe = store.subscribe(forceRender);
    store.setElement(isRefObject(target) ? target.current : target);
    unsubscribe();
  });

  useIsomorphicLayoutEffect(() => () => store.disconnect(), [store]);

  return isOverflowing;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * A single row that hides the items which do not fit and shows an overflow button instead.
 *
 * Wrap each entry in {@link OverflowItem} with a unique `itemId`; the row holds only items (other
 * content is not measured, see `children`). Items are measured while visible, hidden from the end
 * (in DOM order; the first item always stays) and hidden items get `data-overflow-hidden`, an
 * inline `display: none`, `aria-hidden` and `inert`. Reordered items (for example a keyed sort) are
 * re-measured in their new order. `overflowButton(count, hiddenIds)` renders the button after the
 * visible items (its measured width is reserved); components inside it can use
 * {@link useOverflowMenu} to list the hidden items (e.g. in a Menu), and
 * {@link useIsOverflowItemVisible} reports a single item. The button sticks to the inline end of
 * the row, so a first item wider than the room beside it cannot push it out of view: it then covers
 * the end of that item and gets `data-overflow-pinned`, with the `background` token behind it. (In
 * a right-to-left row, WebKit stops the pinned button short of the end, still inside the row.)
 *
 * Works without `ResizeObserver` (jsdom, old browsers): it then re-measures on window resize and
 * when items mount, unmount or move.
 */
const OverflowRoot = ({ overflowButton, children, className, ref, ...rest }: OverflowProps) => {
  const [store] = React.useState(() => new OverflowStore());
  const hiddenIds = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const pinned = React.useSyncExternalStore(
    store.subscribe,
    store.getPinned,
    store.getServerPinned,
  );
  const setContainer = React.useCallback(
    (node: HTMLDivElement | null) => store.setContainer(node),
    [store],
  );
  const setButton = React.useCallback(
    (node: HTMLDivElement | null) => store.setButton(node),
    [store],
  );
  const containerRef = useMergedRefs<HTMLDivElement>(ref, setContainer);
  const forceRender = useForceRender();

  // Observers are created once per instance (not per render or per children change). The first
  // measurement (in connect) re-renders from this layout effect, before paint: useSyncExternalStore
  // only subscribes in a passive effect, which can run after the browser painted every item.
  useIsomorphicLayoutEffect(() => {
    const unsubscribe = store.subscribe(forceRender);
    const disconnect = store.connect();
    unsubscribe();
    return disconnect;
  }, [store, forceRender]);

  // After every commit of the root (new children, a keyed reorder): items moved without any size
  // change or registration are re-measured before paint. Cheap when nothing moved.
  useIsomorphicLayoutEffect(() => {
    store.checkOrder();
  });

  const hiddenSet = React.useMemo(() => new Set(hiddenIds), [hiddenIds]);
  // The overflowButton's own copy (consumers may sort it in place).
  const buttonIds = React.useMemo(() => [...hiddenIds], [hiddenIds]);
  const ctx = React.useMemo<OverflowContextValue>(
    () => ({ store, hiddenIds, hiddenSet }),
    [store, hiddenIds, hiddenSet],
  );

  const hiddenCount = hiddenIds.length;

  return (
    <OverflowContext.Provider value={ctx}>
      <div
        ref={containerRef}
        className={cn('flex items-center overflow-hidden', className)}
        {...rest}
      >
        {children}
        {hiddenCount > 0 && overflowButton && (
          // In the row's flow (it adds to the row height and follows justify-*), sticking to the
          // inline end when the first item is wider than the room beside it. (WebKit stops a
          // sticky element short of the inline end of a right-to-left row; it stays in the row.)
          <div
            ref={setButton}
            data-overflow-button=""
            data-overflow-pinned={pinned ? '' : undefined}
            className="sticky end-0 flex shrink-0 items-center self-stretch ps-1 data-[overflow-pinned]:bg-background"
          >
            {overflowButton(hiddenCount, buttonIds)}
          </div>
        )}
      </div>
    </OverflowContext.Provider>
  );
};
OverflowRoot.displayName = 'Overflow';

/**
 * One entry of an {@link Overflow}. While it does not fit it stays mounted but is hidden
 * (`data-overflow-hidden` and an inline `display: none` placed after the consumer's own `style`),
 * `aria-hidden` and `inert`. The inline style wins over the consumer's `style.display` and over
 * display utilities in any cascade layer (a prefixed Tailwind app's `tw:flex` included), so a
 * hidden item is never shown while it is counted in "+N". Must be rendered inside `Overflow`.
 */
export const OverflowItem = ({
  itemId,
  children,
  className,
  style,
  ref,
  'aria-hidden': ariaHidden,
  inert,
  ...rest
}: OverflowItemProps) => {
  const { store, hiddenSet } = useOverflowContext('OverflowItem');
  const isHidden = hiddenSet.has(itemId);

  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => (node ? store.registerItem(node, itemId) : undefined),
    [store, itemId],
  );
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, registerRef);

  return (
    <div
      ref={mergedRef}
      className={cn('shrink-0', className)}
      {...rest}
      style={isHidden ? { ...style, display: 'none' } : style}
      aria-hidden={isHidden ? true : ariaHidden}
      inert={isHidden ? true : inert}
      data-overflow-hidden={isHidden ? '' : undefined}
    >
      {children}
    </div>
  );
};
OverflowItem.displayName = 'OverflowItem';

/**
 * Overflow with its item as `Overflow.Item`. The same component is exported as `OverflowItem`;
 * React Server Components import that flat name (dotted access needs a client file).
 */
export const Overflow = /* @__PURE__ */ Object.assign(OverflowRoot, {
  Item: OverflowItem,
});
