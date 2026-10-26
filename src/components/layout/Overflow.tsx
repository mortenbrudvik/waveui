import * as React from 'react';
import { overflowClassNames, overflowItemClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { reportMissingContext } from '../../lib/dev';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import type { Orientation } from '../../lib/types';
import { NO_IDS, OverflowStore, hasResizeObserver, sameIds } from './Overflow.store';
import type { OverflowDirection, OverflowGroupVisibility } from './Overflow.store';

export type { OverflowDirection, OverflowGroupVisibility };

/** What {@link OverflowProps.onOverflowChange} reports besides the hidden ids. */
export interface OverflowChangeDetails {
  /** `itemId`s of the shown items, in DOM order. */
  visibleItems: string[];
  /** The visibility of each item group, by `groupId`. */
  groupVisibility: Record<string, OverflowGroupVisibility>;
}

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
   * `OverflowItem` and pin it with `pinned`.
   */
  children: React.ReactNode;
  /**
   * Which end of the row overflows first (`start` is the start of the DOM order, so the right side
   * of a right-to-left row). Without a `priority` or `pinned` item the first item (`end`) or the
   * last one (`start`) is never hidden, as in 0.13.
   * @default 'end'
   */
  overflowDirection?: OverflowDirection;
  /**
   * The axis items are laid out on. `'vertical'` stacks them in a column and measures heights
   * (Fluent's `overflowAxis`).
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * The number of items that stay visible however little room there is (pinned items count).
   * @default 0
   */
  minimumVisible?: number;
  /**
   * Renders the overflow button before the first measurement (for example in the server HTML) so the
   * row reserves its room; `overflowButton` then receives `0` and `[]`. It goes away after the
   * first measurement when every item fits.
   * @default false
   */
  hasHiddenItems?: boolean;
  /**
   * Called, from an effect, when the set of hidden items changes (not for the initial, empty set),
   * with the hidden `itemId`s in DOM order and the {@link OverflowChangeDetails}. Called once per
   * change in StrictMode.
   */
  onOverflowChange?: (hiddenItems: string[], details: OverflowChangeDetails) => void;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * An item hides in ascending `priority` (higher overflows later, default 0), or it is `pinned` and
 * never hides: `priority` or `pinned`, never both.
 */
export type OverflowItemPriorityProps =
  | {
      /** Items with a lower priority overflow first; equal priorities follow the direction. */
      priority?: number;
      pinned?: never;
    }
  | {
      /** The item never overflows. */
      pinned?: boolean;
      priority?: never;
    };

/** Properties for the OverflowItem sub-component. */
export type OverflowItemProps = OverflowItemBaseProps & OverflowItemPriorityProps;

/** The props of an {@link OverflowItem} besides `priority` and `pinned`. */
export interface OverflowItemBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Identifier for tracking this item's overflow visibility, unique within the Overflow (a
   * duplicate warns in development: items that share one are hidden and shown together).
   */
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
// Helpers
// ---------------------------------------------------------------------------

/** A stable function that re-renders the calling component. */
function useForceRender(): () => void {
  return React.useReducer((n: number) => n + 1, 0)[1];
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
 * production, logs an error once and returns an inert value (C-CONTEXT).
 */
function useOverflowContext(componentName: string): OverflowContextValue {
  const ctx = React.useContext(OverflowContext);
  if (ctx) return ctx;
  reportMissingContext(componentName, 'Overflow');
  return INERT_CONTEXT;
}

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
  React.useLayoutEffect(() => {
    const unsubscribe = store.subscribe(forceRender);
    store.setElement(isRefObject(target) ? target.current : target);
    unsubscribe();
  });

  React.useLayoutEffect(() => () => store.disconnect(), [store]);

  return isOverflowing;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const ROOT_ORIENTATION_CLASSES: Record<Orientation, string> = {
  horizontal: 'items-center',
  vertical: 'flex-col items-start',
};

// The button sticks to the end of the axis and keeps room inside for its own focus indicator while
// it covers an item.
const BUTTON_ORIENTATION_CLASSES: Record<Orientation, string> = {
  horizontal:
    'sticky -end-1 flex shrink-0 items-center self-stretch ps-1 data-[overflow-pinned]:bg-background data-[overflow-pinned]:pe-1',
  vertical:
    'sticky -bottom-1 flex shrink-0 items-center self-stretch pt-1 data-[overflow-pinned]:bg-background data-[overflow-pinned]:pb-1',
};

const OverflowRoot = ({
  overflowButton,
  overflowDirection = 'end',
  orientation = 'horizontal',
  minimumVisible = 0,
  hasHiddenItems = false,
  onOverflowChange,
  children,
  className,
  ref,
  ...rest
}: OverflowProps) => {
  const [store] = React.useState(() => new OverflowStore());
  const hiddenIds = React.useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const measured = React.useSyncExternalStore(
    store.subscribe,
    store.getMeasured,
    store.getServerFlag,
  );
  const pinned = React.useSyncExternalStore(
    store.subscribe,
    store.getButtonCovers,
    store.getServerFlag,
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

  // The props the measurement depends on, before the observers connect (the effects of one
  // component run in order), so the first measurement already uses them.
  React.useLayoutEffect(() => {
    store.setConfig({ direction: overflowDirection, orientation, minimumVisible, hasHiddenItems });
  }, [store, overflowDirection, orientation, minimumVisible, hasHiddenItems]);

  // Observers are created once per instance (not per render or per children change). The first
  // measurement (in connect) re-renders from this layout effect, before paint: useSyncExternalStore
  // only subscribes in a passive effect, which can run after the browser painted every item.
  React.useLayoutEffect(() => {
    const unsubscribe = store.subscribe(forceRender);
    const disconnect = store.connect();
    unsubscribe();
    return disconnect;
  }, [store, forceRender]);

  // After every commit of the root (new children, a keyed reorder): items moved without any size
  // change or registration are re-measured before paint. Cheap when nothing moved.
  React.useLayoutEffect(() => {
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

  // Reported from an effect, once per change of the hidden set (the initial, empty set is no
  // change). The last reported set outlives the StrictMode effect replay, so it reports once.
  const emitOverflowChange = useEventCallback(onOverflowChange);
  const reported = React.useRef<string[]>(NO_IDS);
  const hasButton = overflowButton !== undefined;
  React.useEffect(() => {
    // The store's current set, not this render's: measuring the button that the first hidden
    // items bring in can hide more before the browser paints.
    const current = store.getSnapshot();
    if (!store.isSettled(hasButton) || sameIds(current, reported.current)) return;
    reported.current = current;
    emitOverflowChange([...current], {
      visibleItems: store.getVisibleIds(),
      groupVisibility: {},
    });
  }, [store, hiddenIds, hasButton, emitOverflowChange]);

  return (
    <OverflowContext.Provider value={ctx}>
      <div
        ref={containerRef}
        // The row clips its content at its padding edge: the 4px padding leaves room for the focus
        // indicator a focused item draws 4px around itself. No negative margin offsets it: the
        // row's box would then reach past its container, which a scroll container around an
        // edge-to-edge row (or the page) counts as overflow. The store measures the room without
        // the padding.
        className={cn(
          overflowClassNames.root,
          'flex overflow-hidden p-1',
          ROOT_ORIENTATION_CLASSES[orientation],
          className,
        )}
        data-orientation={orientation}
        data-overflow-direction={overflowDirection}
        {...rest}
      >
        {children}
        {(hiddenCount > 0 || (hasHiddenItems && !measured)) && overflowButton && (
          // In the row's flow (it adds to the row height and follows justify-*), sticking to the
          // inline end when the first item is wider than the room beside it. Browsers stop a
          // sticky element at the scroll container's padding, so -end-1 lets it reach the
          // clipping edge, and while pinned it keeps 4px inside for its own focus indicator.
          // (WebKit stops a sticky element short of the inline end of a right-to-left row; it
          // stays in the row.)
          <div
            ref={setButton}
            data-overflow-button=""
            data-overflow-pinned={pinned ? '' : undefined}
            className={cn(
              overflowClassNames.overflowButton,
              BUTTON_ORIENTATION_CLASSES[orientation],
            )}
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
 * One entry of an {@link Overflow}. `priority` (higher overflows later, default 0) or `pinned`
 * (never overflows) decide when it hides; setting either on any item makes every item without
 * `pinned` hidable, the first one included. While it does not fit it stays mounted but is hidden
 * (`data-overflow-hidden` and an inline `display: none` placed after the consumer's own `style`),
 * `aria-hidden` and `inert`. The inline style wins over the consumer's `style.display` and over
 * display utilities in any cascade layer (a prefixed Tailwind app's `tw:flex` included), so a
 * hidden item is never shown while it is counted in "+N". Must be rendered inside `Overflow`.
 */
export const OverflowItem = ({
  itemId,
  priority,
  pinned = false,
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
  React.useEffect(() => store.registerItemId(itemId), [store, itemId]);

  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => (node ? store.registerItem(node, itemId) : undefined),
    [store, itemId],
  );
  const elementRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, registerRef, elementRef);
  // After the ref has registered the item: its priority or pinned state re-measures the row.
  React.useLayoutEffect(() => {
    if (elementRef.current) store.setItemMeta(elementRef.current, priority, pinned);
  }, [store, itemId, priority, pinned]);

  return (
    <div
      ref={mergedRef}
      className={cn(overflowItemClassNames.root, 'shrink-0', className)}
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
 * A single row that hides the items which do not fit and shows an overflow button instead.
 *
 * Wrap each entry in {@link OverflowItem} with a unique `itemId`; the row holds only items (other
 * content is not measured, see `children`). Items are measured while visible and hidden while they
 * do not fit: by ascending `priority` (equal priorities from the end of the DOM order, or from its
 * start with `overflowDirection="start"`), never a `pinned` item and never below `minimumVisible`.
 * Until an item sets `priority` or `pinned`, the first item (`end`) or the last one (`start`) always
 * stays, as in 0.13. `orientation="vertical"` lays the items out in a column and measures heights.
 * `onOverflowChange` reports the hidden `itemId`s when they change. Hidden items get `data-overflow-hidden`, an
 * inline `display: none`, `aria-hidden` and `inert`. Reordered items (for example a keyed sort) are
 * re-measured in their new order. `overflowButton(count, hiddenIds)` renders the button after the
 * visible items (its measured width is reserved); components inside it can use
 * {@link useOverflowMenu} to list the hidden items (e.g. in a Menu), and
 * {@link useIsOverflowItemVisible} reports a single item. The button sticks to the inline end of
 * the row, so a first item wider than the room beside it cannot push it out of view: it then covers
 * the end of that item and gets `data-overflow-pinned`, with the `background` token behind it. (In
 * a right-to-left row, WebKit stops the pinned button short of the end, still inside the row.)
 *
 * The row clips what does not fit. So that the focus indicators of its items are not cut off, it
 * has a 4px padding: the items sit 4px in from its edges, and the row is 8px taller than they are.
 * An explicit width (such as `w-full` or a style width) includes that padding. The row never
 * reaches past its own box, so an edge-to-edge row adds no scrollbar to the page or to a scroll
 * container around it. A negative margin of 4px lines the items up with the content around the
 * row; add it only where nothing within 4px of the row scrolls (the row's box then reaches 4px past
 * its container on every side). `p-0` removes the room (focus indicators at the row's edges are
 * then clipped).
 *
 * Works without `ResizeObserver` (jsdom, old browsers): it then re-measures on window resize and
 * when items mount, unmount or move.
 *
 * The item is also `Overflow.Item`. The same component is exported as `OverflowItem`; React Server
 * Components import that flat name (dotted access needs a client file).
 */
export const Overflow = /* @__PURE__ */ Object.assign(OverflowRoot, {
  Item: OverflowItem,
});
