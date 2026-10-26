import * as React from 'react';
import {
  overflowClassNames,
  overflowDividerClassNames,
  overflowItemClassNames,
} from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { mergeProps } from '../../lib/mergeProps';
import { isCloneableElement, unwrapFragment } from '../../lib/renderTrigger';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import type { Orientation } from '../../lib/types';
import { NO_GROUPS, NO_IDS, OverflowStore, hasResizeObserver, sameIds } from './Overflow.store';
import type {
  GroupVisibilityRecord,
  OverflowDirection,
  OverflowGroupVisibility,
} from './Overflow.store';

export type { OverflowDirection, OverflowGroupVisibility };

/** What {@link OverflowProps.onOverflowChange} reports besides the hidden ids. */
export interface OverflowChangeDetails {
  /** `itemId`s of the shown items, in DOM order. */
  visibleItems: string[];
  /**
   * The visibility of each item group, by `groupId` (only groups with an item): `'visible'` when
   * every member is shown, `'hidden'` when none is, `'overflow'` for a mix.
   */
  groupVisibility: Record<string, OverflowGroupVisibility>;
}

/** Properties for the Overflow component. */
export interface OverflowProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Renders the overflow button (for example a "+3" menu trigger) while at least one item is
   * hidden. Receives the number of hidden items and their `itemId`s in DOM order, so the button
   * can open a menu of the hidden items. `hiddenIds` is the button's own array (sorting it in
   * place affects nobody else). Its size on the row's axis (width, or height for a vertical row)
   * is measured and reserved when items overflow.
   * Components rendered by it can also read the hidden items with {@link useOverflowMenu}.
   */
  overflowButton?: (count: number, hiddenIds: string[]) => React.ReactNode;
  /**
   * The {@link OverflowItem}s (and {@link OverflowDivider}s) to lay out in one row or column.
   * Only items, dividers and the overflow button are measured: the container's whole content box
   * is the room for them, so other content placed in the row is not accounted for and could clip
   * items that still count as visible. Keep fixed content outside the Overflow (for example in a
   * surrounding flex row), or wrap it in an `OverflowItem` and pin it with `pinned`.
   */
  children: React.ReactNode;
  /**
   * Which end of the row overflows first (`start` is the start of the DOM order, so the right side
   * of a right-to-left row). While no item sets `priority` or `pinned` (`pinned={false}` does not
   * count) the first item (`end`) or the last one (`start`) is never hidden, as in 0.13; once any
   * item pins itself or sets a priority, only `pinned` items are protected, the first one included.
   * @default 'end'
   */
  overflowDirection?: OverflowDirection;
  /**
   * The axis items are laid out on. `'vertical'` stacks them in a column and measures heights
   * (Fluent's `overflowAxis`); the column needs a definite height (a `height`, or a flex or grid
   * cell with one), since it has no room to measure otherwise.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /**
   * The number of items that stay visible however little room there is (pinned items count).
   * @default 0
   */
  minimumVisible?: number;
  /**
   * Renders the overflow button before the first measurement (for example in the server HTML) so
   * the row reserves its room; `overflowButton` then receives `0` and `[]`. It goes away after the
   * first measurement when every item fits.
   * @default false
   */
  hasHiddenItems?: boolean;
  /**
   * Called, from an effect, when the set of hidden items changes (not for the initial, empty set),
   * with the hidden `itemId`s in DOM order and the {@link OverflowChangeDetails}. Called once per
   * change in StrictMode, and only for a set that has been rendered.
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
      /**
       * Items with a lower priority overflow first; equal priorities follow the direction.
       * @default 0
       */
      priority?: number;
      pinned?: never;
    }
  | {
      /**
       * The item never overflows. Pinning any item drops the 0.13 protection of the first item for
       * the whole row; `pinned={false}` alone keeps it.
       * @default false
       */
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
  /**
   * The group the item belongs to. A group is `'visible'`, `'hidden'` or `'overflow'` (some members
   * hidden); an {@link OverflowDivider} with the same `groupId` hides with a hidden group, and
   * {@link useIsOverflowGroupVisible} reads it.
   */
  groupId?: string;
  /**
   * Puts the item's props on its single element child (an `<li>`, a Toolbar button) instead of on
   * a wrapper `<div>`: handlers and refs are composed with the child's, classes and styles merged,
   * and the hidden state (`data-overflow-hidden`, `display: none`, `aria-hidden`, `inert`) wins
   * over the child's own. A child that is not a single element (text, several elements) renders in
   * the wrapper `<div>` and warns in development.
   * @default false
   */
  asChild?: boolean;
  /** Content of the overflow item: with `asChild`, the single element that takes its props. */
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the OverflowDivider sub-component. */
export interface OverflowDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The group the divider belongs to: it is hidden while that group is `'hidden'` and takes room
   * in the row otherwise. A group without items counts as visible.
   */
  groupId: string;
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
  groupVisibility: GroupVisibilityRecord;
  direction: OverflowDirection;
  orientation: Orientation;
  /** At least one item is hidden (not the button that `hasHiddenItems` reserves). */
  hasHiddenItems: boolean;
}

const OverflowContext = React.createContext<OverflowContextValue | null>(null);

/** Production fallback for a misplaced sub-component: a store that is never connected. */
const INERT_CONTEXT: OverflowContextValue = {
  store: /* @__PURE__ */ new OverflowStore(),
  hiddenIds: NO_IDS,
  hiddenSet: /* @__PURE__ */ new Set<string>(),
  groupVisibility: NO_GROUPS,
  direction: 'end',
  orientation: 'horizontal',
  hasHiddenItems: false,
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

/**
 * How much of the item group `groupId` is shown: `'visible'` (every member, and also a group
 * without items), `'hidden'` (none) or `'overflow'` (some). Must be called inside `Overflow`.
 */
export function useIsOverflowGroupVisible(groupId: string): OverflowGroupVisibility {
  const { groupVisibility } = useOverflowContext('useIsOverflowGroupVisible');
  return groupVisibility[groupId] ?? 'visible';
}

/**
 * Whether the enclosing {@link Overflow} currently hides at least one item (the button that the
 * `hasHiddenItems` prop reserves does not count). Must be called inside `Overflow`.
 */
export function useHasHiddenItems(): boolean {
  return useOverflowContext('useHasHiddenItems').hasHiddenItems;
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
    'sticky -end-1 flex shrink-0 items-center self-stretch ps-1 ' +
    'data-[overflow-pinned]:bg-background data-[overflow-pinned]:pe-1',
  vertical:
    'sticky -bottom-1 flex shrink-0 items-center self-stretch pt-1 ' +
    'data-[overflow-pinned]:bg-background data-[overflow-pinned]:pb-1',
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
  const buttonCovers = React.useSyncExternalStore(
    store.subscribe,
    store.getButtonCovers,
    store.getServerFlag,
  );
  const groupVisibility = React.useSyncExternalStore(
    store.subscribe,
    store.getGroups,
    store.getServerGroups,
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
  const hiddenCount = hiddenIds.length;
  const ctx = React.useMemo<OverflowContextValue>(
    () => ({
      store,
      hiddenIds,
      hiddenSet,
      groupVisibility,
      direction: overflowDirection,
      orientation,
      hasHiddenItems: hiddenCount > 0,
    }),
    [store, hiddenIds, hiddenSet, groupVisibility, overflowDirection, orientation, hiddenCount],
  );

  // Reported from an effect, once per change of the hidden set (the initial, empty set is no
  // change). The last reported set outlives the StrictMode effect replay, so it reports once.
  const emitOverflowChange = useEventCallback(onOverflowChange);
  const reported = React.useRef<string[]>(NO_IDS);
  const hasButton = overflowButton !== undefined;
  React.useEffect(() => {
    // The store's current set, and only once this render shows it: measuring the button that the
    // first hidden items bring in can hide more before the browser paints, and a re-render with
    // the final set always follows.
    const current = store.getSnapshot();
    if (!sameIds(current, hiddenIds) || !store.isSettled(hasButton)) return;
    if (sameIds(current, reported.current)) return;
    reported.current = current;
    emitOverflowChange([...current], {
      visibleItems: store.getVisibleIds(),
      groupVisibility: { ...store.getGroups() },
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
          // end of the axis when the visible items are wider than the room beside it. Browsers
          // stop a sticky element at the scroll container's padding, so -end-1 lets it reach the
          // clipping edge, and while pinned it keeps 4px inside for its own focus indicator.
          // (WebKit stops a sticky element short of the inline end of a right-to-left row; it
          // stays in the row.)
          <div
            ref={setButton}
            data-overflow-button=""
            data-overflow-pinned={buttonCovers ? '' : undefined}
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
 * `pinned` hidable, the first one included. `groupId` puts it in a group that an
 * {@link OverflowDivider} and {@link useIsOverflowGroupVisible} follow. While it does not fit it
 * stays mounted but is hidden (`data-overflow-hidden` and an inline `display: none` placed after
 * the consumer's own `style`), `aria-hidden` and `inert`. The inline style wins over the
 * consumer's `style.display` and over display utilities in any cascade layer (a prefixed Tailwind
 * app's `tw:flex` included), so a hidden item is never shown while it is counted in "+N". With
 * `asChild` the item renders no wrapper: its props are merged onto its single element child.
 * Must be rendered inside `Overflow`.
 */
export const OverflowItem = ({
  itemId,
  priority,
  pinned = false,
  groupId,
  asChild = false,
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

  // asChild: the single element (a Fragment around one is unwrapped) that takes the item's props.
  const child = asChild ? unwrapFragment(children) : undefined;
  const childElement = isCloneableElement(child) ? child : null;
  const childProps = childElement ? (childElement.props as Record<string, unknown>) : null;
  const { ref: childRef, ...ownChildProps } = childProps ?? {};
  const wrapsChildren = asChild && childElement === null && children != null;
  React.useEffect(() => {
    if (!wrapsChildren) return;
    warnOnce(
      'OverflowItem:as-child-children',
      'OverflowItem: asChild expects a single React element child (not text or several ' +
        'elements); the children are rendered inside a <div> instead.',
    );
  }, [wrapsChildren]);

  const registerRef = React.useCallback(
    (node: HTMLElement | null) => (node ? store.registerItem(node, itemId) : undefined),
    [store, itemId],
  );
  const elementRef = React.useRef<HTMLElement | null>(null);
  const mergedRef = useMergedRefs<HTMLElement>(
    ref as React.Ref<HTMLElement> | undefined,
    registerRef,
    elementRef,
    childRef as React.Ref<HTMLElement> | undefined,
  );
  // After the ref has registered the item: its priority, pinned state or group re-measures the row.
  React.useLayoutEffect(() => {
    if (elementRef.current) store.setItemMeta(elementRef.current, priority, pinned, groupId);
  }, [store, itemId, priority, pinned, groupId]);

  const itemClassName = cn(overflowItemClassNames.root, 'shrink-0', className);

  if (childElement) {
    // Only a hidden item sets these (and a consumer's own values), so a shown item keeps the
    // child's.
    const hiddenProps: Record<string, unknown> = isHidden
      ? { 'aria-hidden': true, inert: true, 'data-overflow-hidden': '' }
      : {};
    if (!isHidden && ariaHidden !== undefined) hiddenProps['aria-hidden'] = ariaHidden;
    if (!isHidden && inert !== undefined) hiddenProps.inert = inert;
    const merged = mergeProps(
      { ...rest, ...hiddenProps, className: itemClassName, style },
      ownChildProps,
      { oursWin: ['aria-hidden', 'inert', 'data-overflow-hidden'] },
    );
    // The hidden display wins over the child's own style, as it does over the consumer's.
    const mergedStyle = merged.style as React.CSSProperties | undefined;
    return React.cloneElement(childElement, {
      ...merged,
      ref: mergedRef,
      style: isHidden ? { ...mergedStyle, display: 'none' } : mergedStyle,
    } as Record<string, unknown>);
  }

  return (
    <div
      ref={mergedRef as React.Ref<HTMLDivElement>}
      className={itemClassName}
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
 * A divider between item groups of an {@link Overflow}, drawn by its children (for example a
 * vertical `Divider`; it renders a plain `<div>`). It is measured like an item and hidden, with
 * `data-overflow-hidden`, an inline `display: none`, `aria-hidden` and `inert`, while the group
 * `groupId` is `'hidden'` (none of its items is shown). Must be rendered inside `Overflow`.
 */
export const OverflowDivider = ({
  groupId,
  children,
  className,
  style,
  ref,
  'aria-hidden': ariaHidden,
  inert,
  ...rest
}: OverflowDividerProps) => {
  const { store, groupVisibility } = useOverflowContext('OverflowDivider');
  const isHidden = groupVisibility[groupId] === 'hidden';
  const registerRef = React.useCallback(
    (node: HTMLDivElement | null) => (node ? store.registerDivider(node, groupId) : undefined),
    [store, groupId],
  );
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, registerRef);

  return (
    <div
      ref={mergedRef}
      className={cn(overflowDividerClassNames.root, 'shrink-0', className)}
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
OverflowDivider.displayName = 'OverflowDivider';

/**
 * A single row (or column) that hides the items which do not fit and shows an overflow button
 * instead.
 *
 * Wrap each entry in {@link OverflowItem} with a unique `itemId`; the row holds only items and
 * {@link OverflowDivider}s (other content is not measured, see `children`). Items are measured
 * while visible and hidden while they do not fit: by ascending `priority` (equal priorities from
 * the end of the DOM order, or from its start with `overflowDirection="start"`), never a `pinned`
 * item and never below `minimumVisible`. Until an item sets `priority` or `pinned`, the first item
 * (`end`) or the last one (`start`) always stays, as in 0.13. `orientation="vertical"` lays the
 * items out in a column and measures heights; the column needs a definite height.
 *
 * Items with the same `groupId` form a group that is `'visible'`, `'hidden'` or `'overflow'` (some
 * members hidden): a divider with that `groupId` hides with a hidden group,
 * {@link useIsOverflowGroupVisible} reads a group and {@link useHasHiddenItems} whether anything
 * is hidden. `onOverflowChange` reports the hidden `itemId`s and the group visibility when the
 * hidden items change. Hidden items get `data-overflow-hidden`, an inline `display: none`,
 * `aria-hidden` and `inert`. Reordered items (for example a keyed sort) are re-measured in their
 * new order. `overflowButton(count, hiddenIds)` renders the button after the visible items (its
 * measured size is reserved); components inside it can use {@link useOverflowMenu} to list the
 * hidden items (e.g. in a Menu), and {@link useIsOverflowItemVisible} reports a single item. In a
 * horizontal row the button sticks to the inline end, so a first item wider than the room beside
 * it cannot push it out of view: it then covers the end of that item and gets
 * `data-overflow-pinned`, with the `background` token behind it (a vertical column sticks it to
 * the bottom). (In a right-to-left row, WebKit stops the pinned button short of the end, still
 * inside the row.)
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
 * The item is also `Overflow.Item` and the divider `Overflow.Divider`. The same components are
 * exported as `OverflowItem` and `OverflowDivider`; React Server Components import those flat names
 * (dotted access needs a client file).
 */
export const Overflow = /* @__PURE__ */ Object.assign(OverflowRoot, {
  Item: OverflowItem,
  Divider: OverflowDivider,
});
