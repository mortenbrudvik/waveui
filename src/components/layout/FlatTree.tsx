import * as React from 'react';
import { flatTreeClassNames } from '../../lib/classNames';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import type { VisibleFlatItem } from '../../lib/flatTree';
import type { CheckState } from '../../lib/treeCascade';
import type { SelectionMode } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useTypeahead } from '../../hooks/useTypeahead';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { FlatTreeContext, type FlatTreeContextValue, type FlatTreeRow } from './FlatTree.context';
import { FlatTreeItem } from './FlatTree.item';
import type { FlatTreeModel } from './useFlatTree';

export type { FlatTreeItemProps } from './FlatTree.item';

/** Properties for the FlatTree component. */
export interface FlatTreeProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children' | 'onSelect'
> {
  /** The tree's model, from `useFlatTree`: the visible rows, the expanded and the checked state. */
  model: FlatTreeModel;
  /**
   * Renders only the items in view (and a few beyond), from `useVirtualWindow({ itemSize })`. The
   * tree is then the scrolling element: give it a bounded height (a class or a style). Every item
   * is exactly `itemSize` pixels tall, so its content must fit in one row. Without it every visible
   * item is rendered.
   *
   * The tree element is then no tab stop of its own while an item is (`tabIndex` -1, as Firefox
   * would stop on a scroller; a `tabIndex` you pass wins), and the browser's scroll anchoring is
   * off on it (the window lays the items out): when rows are inserted or removed above the focused
   * item while it is in view (`*`, or a change of the model from code), the tree moves the view
   * with it, so it stays where it was.
   */
  virtualWindow?: VirtualWindow;
  /**
   * The content of an item, from its row: the item data with its level, position, set size,
   * expanded state and, in multiple mode, its check state. Called for the rendered items only.
   * @default the item's `label`, else its `value`
   */
  renderItem?: (item: VisibleFlatItem & { checked?: CheckState }) => React.ReactNode;
  /**
   * How items are selected, as the nested `Tree`'s `selectionMode`. `'multiple'` draws a checkbox
   * on every item, bound to the model's checked items (create the model with
   * `selectionMode: 'multiple'`); `'single'` draws a radio for `selected`. Spread
   * `model.getTreeProps()` on the tree to pass the model's mode.
   * @default the model's mode (`model.getTreeProps().selectionMode`)
   */
  selectionMode?: 'none' | SelectionMode;
  /**
   * Value of the selected item. When set (also to `null`), every item carries `aria-selected`, and
   * the selected item is where keyboard focus enters the tree while it is visible. It has no effect
   * with `selectionMode="multiple"` (a development warning). With `selectionMode="single"` every
   * item carries `aria-selected` even while it is not set (a development warning: the radios need
   * it).
   */
  selected?: string | null;
  /** Value of the current item (for example the open page): it gets `aria-current="true"`. */
  current?: string | null;
  /**
   * Called with an item's value every time it is activated (a click on its row, Enter, or Space
   * unless the tree has checkboxes), also when the same item is activated again.
   */
  onItemSelect?: (value: string) => void;
  /** Ref to the `role="tree"` element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The focused and the awaited item of a FlatTree, by value (see {@link FlatTreeFocusStore}). */
interface FlatTreeFocus {
  /** The item that has focus while focus is inside the tree: kept rendered, and the tab stop. */
  focused: string | null;
  /** The item a key moved to that was not rendered: kept rendered, focused after the commit. */
  pending: string | null;
}

const NO_FOCUS: FlatTreeFocus = { focused: null, pending: null };

/**
 * The focused and the awaited item of a FlatTree, read during render through
 * `useSyncExternalStore` and written by the tree's handlers and layout effect (C-HOOKS: no state
 * set in an effect, no ref read during render).
 */
class FlatTreeFocusStore {
  private state: FlatTreeFocus = NO_FOCUS;
  private readonly listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): FlatTreeFocus => this.state;

  getServerSnapshot = (): FlatTreeFocus => NO_FOCUS;

  /** Changes the given fields; notifies only when one of them changed. */
  update(next: Partial<FlatTreeFocus>): void {
    const state = { ...this.state, ...next };
    if (state.focused === this.state.focused && state.pending === this.state.pending) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

/** The element that stands in for the items of a windowed tree that are not rendered. */
function FlatTreeSpacer({ size }: { size: number }) {
  return (
    <div
      role="none"
      aria-hidden="true"
      data-virtual-spacer=""
      className={flatTreeClassNames.spacer}
      style={{ height: size }}
    />
  );
}
FlatTreeSpacer.displayName = 'FlatTreeSpacer';

/** The item element (a treeitem child of `root`) that holds `target`; `null` for a portal's. */
function getOwnItem(root: Element, target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el.parentElement !== root) el = el.parentElement;
  return el instanceof HTMLElement && el.getAttribute('role') === 'treeitem' ? el : null;
}

/** The place of an item element in the visible rows (`data-index`). */
function getIndex(el: Element): number | null {
  const value = el.getAttribute('data-index');
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

/** The rendered item at `index` of the visible rows, or `null` while it is not rendered. */
function getRenderedItem(root: Element, index: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(`:scope > [data-index="${index}"]`);
}

/** The next enabled row from `from` (exclusive) in the direction of `step`, or `undefined`. */
function nextEnabled(rows: readonly FlatTreeRow[], from: number, step: 1 | -1): number | undefined {
  for (let at = from + step; at >= 0 && at < rows.length; at += step) {
    if (!rows[at].item.disabled) return at;
  }
  return undefined;
}

/** The first enabled child row of the expanded row at `index`, or `undefined`. */
function firstEnabledChild(rows: readonly FlatTreeRow[], index: number): number | undefined {
  const { level } = rows[index];
  for (let at = index + 1; at < rows.length && rows[at].level > level; at += 1) {
    if (rows[at].level === level + 1 && !rows[at].item.disabled) return at;
  }
  return undefined;
}

const NAME_MESSAGE =
  'FlatTree: a tree needs an accessible name. Pass `aria-label` or `aria-labelledby`.';

const SELECTION_MODE_MESSAGE =
  'FlatTree: selectionMode="multiple" needs a model that holds the check states: pass ' +
  "`selectionMode: 'multiple'` to `useFlatTree` as well; until then every item shows unchecked.";

const SELECTED_WITH_MULTIPLE_MESSAGE =
  'FlatTree: `selected` has no effect with selectionMode="multiple"; use the model\'s ' +
  '`checkedItems`, and `current` for the item the user is on.';

const SINGLE_WITHOUT_SELECTED_MESSAGE =
  'FlatTree: selectionMode="single" draws a radio on every item for `selected`; pass `selected` ' +
  '(null while nothing is selected) and update it from `onItemSelect`.';

// The FlatTree root, documented on the exported `FlatTree` const.
const FlatTreeRoot = ({
  model,
  virtualWindow,
  renderItem,
  selectionMode: selectionModeProp,
  selected,
  current,
  onItemSelect,
  className,
  onKeyDown,
  onFocus,
  onBlur,
  onPointerDownCapture,
  ref,
  ...rest
}: FlatTreeProps) => {
  const modelMode = model.getTreeProps().selectionMode;
  const selectionMode = selectionModeProp ?? modelMode;
  const rows = model.visibleItems;
  const count = rows.length;
  const windowed = virtualWindow !== undefined;

  // An item carries aria-checked or aria-selected, never both (APG); in single mode every item
  // carries aria-selected from the first render, so the radios and the state agree.
  const effectiveSelected =
    selectionMode === 'multiple'
      ? undefined
      : selectionMode === 'single'
        ? (selected ?? null)
        : selected;

  const [focusStore] = React.useState(() => new FlatTreeFocusStore());
  const { focused, pending } = React.useSyncExternalStore(
    focusStore.subscribe,
    focusStore.getSnapshot,
    focusStore.getServerSnapshot,
  );

  // The tab stop follows the model, not the DOM (most items are not rendered): the focused item,
  // else the selected item while it is visible and enabled, else the first enabled item.
  const firstEnabled = React.useMemo(() => rows.find((row) => !row.item.disabled), [rows]);
  const focusedRow = focused === null ? undefined : model.getItem(focused);
  const selectedRow =
    effectiveSelected === undefined || effectiveSelected === null
      ? undefined
      : model.getItem(effectiveSelected);
  const tabStopRow =
    focusedRow ?? (selectedRow && !selectedRow.item.disabled ? selectedRow : firstEnabled);
  const tabStopIndex = tabStopRow?.index;
  const pendingIndex = pending === null ? undefined : model.getItem(pending)?.index;
  // The tab stop and the awaited item stay rendered outside the window (a focused item scrolled
  // away keeps focus and its tab stop).
  const keep = React.useMemo(
    () => [tabStopIndex, pendingIndex].filter((index): index is number => index !== undefined),
    [tabStopIndex, pendingIndex],
  );

  const activate = useEventCallback((row: FlatTreeRow) => {
    if (row.item.disabled) return;
    if (row.isBranch) model.toggle(row.item.value);
    onItemSelect?.(row.item.value);
  });
  const toggleChecked = useEventCallback((row: FlatTreeRow, event: Event) => {
    if (row.item.disabled) return;
    model.setChecked(row.item.value, row.checked !== 'checked', event);
  });

  const itemSize = virtualWindow?.itemSize;
  const tabStop = tabStopRow?.item.value ?? null;
  const context = React.useMemo<FlatTreeContextValue>(
    () => ({
      selectionMode,
      selected: effectiveSelected,
      current,
      tabStop,
      itemSize,
      activate,
      toggleChecked,
    }),
    [selectionMode, effectiveSelected, current, tabStop, itemSize, activate, toggleChecked],
  );

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // The tree is the window's scroller.
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef, virtualWindow?.scrollRef);

  /**
   * Focuses the row at `index`, moving the window to it first (in the same update, so no frame
   * shows the spacer); a row that is not rendered is awaited and focused after the commit that
   * renders it.
   */
  const moveTo = (root: HTMLElement, index: number) => {
    const row = rows[index];
    if (!row) return;
    virtualWindow?.scrollToIndex(index, { align: 'auto' });
    const el = getRenderedItem(root, index);
    if (el) {
      focusStore.update({ pending: null });
      el.focus();
    } else {
      focusStore.update({ pending: row.item.value });
    }
  };

  // Typeahead over the visible items' labels (disabled items are skipped).
  const { onTypeahead, isSearching } = useTypeahead({
    getItems: () =>
      rows.map((row) => ({
        value: row.item.value,
        text: row.item.label ?? row.item.value,
        disabled: row.item.disabled,
      })),
    onMatch: (value) => {
      const root = rootRef.current;
      const row = model.getItem(value);
      if (root && row) moveTo(root, row.index);
    },
  });

  /** The visible item, its ancestors from the parent up, and its place, of the focused item. */
  const focusPathRef = React.useRef<{ path: string[]; index: number } | null>(null);

  /**
   * Set by a pointer press in a windowed tree until the focus it gives, or until a key press:
   * keyboard focus always follows one, so a press that gave no focus never keeps a later keyboard
   * focus from being scrolled into view. A press in a popup an item opened is the popup's.
   */
  const pointerPressRef = React.useRef(false);
  const handlePointerDownCapture = useEventCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (windowed && isOwnEvent(event)) pointerPressRef.current = true;
  });
  React.useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    if (!windowed || !doc) return;
    const clear = () => {
      pointerPressRef.current = false;
    };
    doc.addEventListener('keydown', clear, true);
    return () => doc.removeEventListener('keydown', clear, true);
  }, [windowed]);

  /**
   * Whether focus is in a popup that an item opened (an element outside the tree's DOM whose focus
   * React bubbles through the tree): the focused item stays kept. Written by the focus and blur
   * handlers.
   */
  const focusInPopupRef = React.useRef(false);

  // Focus moving onto an item makes it the focused item (the tab stop, kept rendered). Unless a
  // pointer press gave the focus, the window moves to it in the same update (a browser's own focus
  // scrolling moves the view a frame before the window would follow).
  const handleFocus = useEventCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const pointerFocus = pointerPressRef.current;
    pointerPressRef.current = false;
    focusInPopupRef.current = !event.currentTarget.contains(event.target as Node);
    const el = getOwnItem(event.currentTarget, event.target);
    const index = el ? getIndex(el) : null;
    const row = index === null ? undefined : rows[index];
    if (!row || index === null) return;
    focusStore.update({ focused: row.item.value, pending: null });
    const path: string[] = [];
    for (let parent = row.parentValue; parent !== undefined;) {
      path.push(parent);
      parent = model.getItem(parent)?.parentValue;
    }
    focusPathRef.current = { path, index };
    if (virtualWindow && !pointerFocus) virtualWindow.scrollToIndex(index, { align: 'auto' });
  });

  // Focus leaving the tree (for an element outside it, or for nothing) ends the focused item; the
  // tab stop then returns to the selected or the first item. Decided once focus has landed: a
  // popup an item opened takes focus in the same task (`focusInPopupRef`).
  const handleBlur = useEventCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const root = event.currentTarget;
    const next = event.relatedTarget as Node | null;
    if (next && root.contains(next)) return;
    focusInPopupRef.current = false;
    const blurred = event.target as Node;
    queueMicrotask(() => {
      if (!root.isConnected || focusInPopupRef.current) return;
      const active = root.ownerDocument.activeElement;
      if (active && root.contains(active)) return;
      // A focused item that left the document (a branch collapsed around it): the commit's check
      // below has moved focus, or decided that it cannot.
      if (!blurred.isConnected) return;
      focusStore.update({ focused: null });
    });
  });

  const handleKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const root = event.currentTarget;
    // A key from a portal is the portal's; a text field in the content keeps its keys.
    const el = getOwnItem(root, event.target);
    const current = el ? getIndex(el) : null;
    if (current === null || current >= count || isEditableTarget(event.target)) return;
    const row = rows[current];
    // Keys pressed before an awaited item renders move from it (possible only within one task).
    const awaited = focusStore.getSnapshot().pending;
    const from = (awaited === null ? undefined : model.getItem(awaited)?.index) ?? current;

    // Typeahead; a Space continues a search, and `*` starts none.
    if (event.key.length === 1 && (event.key !== '*' || isSearching())) {
      if (onTypeahead(event, rows[from].item.value)) {
        event.preventDefault();
        return;
      }
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    let target: number | undefined;
    switch (event.key) {
      case 'ArrowDown':
        target = nextEnabled(rows, from, 1);
        break;
      case 'ArrowUp':
        target = nextEnabled(rows, from, -1);
        break;
      case 'Home':
        target = nextEnabled(rows, -1, 1);
        break;
      case 'End':
        target = nextEnabled(rows, count, -1);
        break;
      case 'Enter':
        event.preventDefault();
        activate(row);
        return;
      case ' ':
        event.preventDefault();
        // A checkbox tree toggles the focused item's check (APG); the other modes activate.
        if (selectionMode === 'multiple') toggleChecked(row, event.nativeEvent);
        else activate(row);
        return;
      case '*': {
        event.preventDefault();
        // The siblings of a visible item are all visible (their parent is expanded).
        const siblings = rows
          .filter(
            (other) =>
              other.parentValue === row.parentValue &&
              other.isBranch &&
              !other.expanded &&
              !other.item.disabled,
          )
          .map((other) => other.item.value);
        if (siblings.length > 0) model.expand(siblings);
        return;
      }
      default: {
        const intent = getArrowIntent(event.key, {
          orientation: 'horizontal',
          dir: getDirection(root),
        });
        if (intent === null) return;
        if (intent === 'next') {
          // Expand a collapsed branch (focus stays), else move to the first child.
          if (row.isBranch && !row.expanded) {
            event.preventDefault();
            if (!row.item.disabled) model.expand(row.item.value);
            return;
          }
          if (row.expanded) target = firstEnabledChild(rows, current);
        } else {
          // Collapse an expanded branch (focus stays), else move to the nearest enabled ancestor.
          if (row.isBranch && row.expanded && !row.item.disabled) {
            event.preventDefault();
            model.collapse(row.item.value);
            return;
          }
          for (let parent = row.parentValue; parent !== undefined && target === undefined;) {
            const parentRow = model.getItem(parent);
            if (!parentRow) break;
            if (!parentRow.item.disabled) target = parentRow.index;
            parent = parentRow.parentValue;
          }
        }
        if (target === undefined) {
          event.preventDefault();
          return;
        }
      }
    }
    event.preventDefault();
    // No item to move to: the focused item stays, and is brought into view.
    const goal = target ?? from;
    if (goal === current) {
      focusStore.update({ pending: null });
      virtualWindow?.scrollToIndex(goal, { align: 'auto' });
      return;
    }
    moveTo(root, goal);
  });

  /**
   * The focused item of a windowed tree, its place in the visible rows and the scroll offset, at
   * the last commit (written by the layout effect below).
   */
  const focusPlaceRef = React.useRef<{ value: string; index: number; top: number } | null>(null);

  // After every commit of a windowed tree: rows inserted or removed above the focused item while
  // it was in view (`*`, a model change from code) move the view with it, so it stays where it
  // was, and the window follows in the same update. The browser's scroll anchoring would do the
  // same a frame before the window follows; it is off (the window lays the rows out).
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const value = focusStore.getSnapshot().focused;
    const index = value === null ? undefined : model.getItem(value)?.index;
    const last = focusPlaceRef.current;
    focusPlaceRef.current = null;
    if (!virtualWindow || !root || value === null || index === undefined) return;
    const size = virtualWindow.itemSize;
    let top = root.scrollTop;
    if (
      last?.value === value &&
      index !== last.index &&
      root.contains(root.ownerDocument.activeElement)
    ) {
      // Rows removed above may leave less content than the offset, which the browser has clamped
      // by now: an offset in another row than the one recorded (the tree commits at every row the
      // view enters) stands for that, and the recorded one is where the view was.
      const before = Math.floor(top / size) === Math.floor(last.top / size) ? top : last.top;
      const lastTop = last.index * size;
      if (lastTop + size > before && lastTop < before + root.clientHeight) {
        root.scrollTop = before + (index - last.index) * size;
        virtualWindow.scrollToIndex(index, { align: 'auto' });
        top = root.scrollTop;
      }
    }
    focusPlaceRef.current = { value, index, top };
  });

  // After every commit: focus the awaited item, which the commit rendered (it is kept), unless
  // focus went outside the tree meanwhile; and when the focused item is no longer visible (a
  // branch collapsed around it, or the items changed) while focus is lost with it, move focus to
  // its nearest visible ancestor, else to the visible item nearest to its place. Never to the body.
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const active = doc.activeElement;
    const lost = !active || active === doc.body || !active.isConnected;
    const snapshot = focusStore.getSnapshot();
    if (snapshot.pending !== null) {
      focusStore.update({ pending: null });
      const row = model.getItem(snapshot.pending);
      const el = row ? getRenderedItem(root, row.index) : null;
      if (el && (lost || root.contains(active))) el.focus();
      return;
    }
    if (snapshot.focused === null || model.getItem(snapshot.focused)) return;
    focusStore.update({ focused: null });
    if (!lost || count === 0) return;
    const record = focusPathRef.current;
    let target = record?.path.map((value) => model.getItem(value)).find((row) => row)?.index;
    target ??= Math.min(record?.index ?? 0, count - 1);
    moveTo(root, target);
  });

  // Development diagnostics (C-DEV): emitted from effects, once per page.
  const unnamed = !rest['aria-label'] && !rest['aria-labelledby'];
  React.useEffect(() => {
    if (unnamed) warnOnce('FlatTree:name', NAME_MESSAGE);
  }, [unnamed]);
  const missingChecks = selectionMode === 'multiple' && modelMode !== 'multiple';
  React.useEffect(() => {
    if (missingChecks) warnOnce('FlatTree:selection-mode', SELECTION_MODE_MESSAGE);
  }, [missingChecks]);
  React.useEffect(() => {
    if (selectionMode === 'multiple' && selected !== undefined) {
      warnOnce('FlatTree:selected-with-multiple', SELECTED_WITH_MULTIPLE_MESSAGE);
    }
    if (selectionMode === 'single' && selected === undefined) {
      warnOnce('FlatTree:single-without-selected', SINGLE_WITHOUT_SELECTED_MESSAGE);
    }
  }, [selectionMode, selected]);

  const renderRow = (row: FlatTreeRow) => (
    <FlatTreeItem key={`item:${row.item.value}`} item={row}>
      {renderItem ? renderItem(row) : (row.item.label ?? row.item.value)}
    </FlatTreeItem>
  );
  const content = virtualWindow
    ? virtualWindow
        .layout(count, { keep })
        .map((entry) =>
          entry.kind === 'item' ? (
            renderRow(rows[entry.index])
          ) : (
            <FlatTreeSpacer key={`spacer:${entry.key}`} size={entry.size} />
          ),
        )
    : rows.map(renderRow);

  return (
    <FlatTreeContext.Provider value={context}>
      <div
        role="tree"
        aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
        data-selection-mode={selectionMode}
        // A windowed tree's tab stop is an item: the scroller is none of its own (Firefox makes a
        // scroller a tab stop). The consumer's `tabIndex` wins.
        tabIndex={windowed && tabStop !== null ? -1 : undefined}
        className={cn(
          flatTreeClassNames.root,
          'text-body-1',
          // The window lays the rows out: the browser's scroll anchoring only fights it.
          windowed && 'overflow-y-auto [overflow-anchor:none]',
          className,
        )}
        {...rest}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onFocus={composeEventHandlers(onFocus, handleFocus, { checkDefaultPrevented: false })}
        onBlur={composeEventHandlers(onBlur, handleBlur, { checkDefaultPrevented: false })}
        onPointerDownCapture={composeEventHandlers(onPointerDownCapture, handlePointerDownCapture)}
        ref={mergedRef}
      >
        {content}
      </div>
    </FlatTreeContext.Provider>
  );
};
FlatTreeRoot.displayName = 'FlatTree';

/**
 * A tree built from flat data (WAI-ARIA Tree View pattern) that can render only the items in
 * view, for trees of thousands of items. Its model comes from `useFlatTree(items, options)`: items
 * listed with a `parentValue`, in any order, the expanded and the checked state. The tree renders
 * the visible items (the roots and the children of every expanded branch) as sibling
 * `role="treeitem"` elements with `aria-level`, `aria-setsize` and `aria-posinset` from the data,
 * `aria-expanded` on branches, and the nested `Tree`'s chevron, checkbox and radio.
 *
 * ```tsx
 * const model = useFlatTree(items, { defaultExpandedItems: ['docs'] });
 * const virtualWindow = useVirtualWindow({ itemSize: 28 });
 * <FlatTree aria-label="Files" model={model} {...model.getTreeProps()} virtualWindow={virtualWindow} style={{ height: 400 }} />
 * ```
 *
 * Windowing: with `virtualWindow` the tree is the scrolling element (it needs a bounded height),
 * renders the items in view plus the window's overscan and spacers for the others, and every item
 * is exactly the window's `itemSize` tall. The server renders the first window. Keys move over the
 * whole visible list, scrolling an item that is not rendered into view before focusing it, and the
 * focused item stays rendered (and focused) while it is scrolled away.
 *
 * Keyboard: a single tab stop, on the focused item while focus is inside, else on the `selected`
 * item while it is visible, else on the first enabled item; Tab leaves the tree. Up/Down move
 * between the visible items, Home/End to the first and last, Right expands a collapsed branch or
 * moves to its first child, Left collapses an expanded branch or moves to the parent (both
 * mirrored in right-to-left layouts), Enter activates (and toggles a branch), and so does Space
 * unless the tree has checkboxes, `*` expands the sibling branches, and typing moves to the next
 * visible item whose label starts with the typed text (items under a collapsed branch are not
 * searched). The focused item stays the focused item (rendered, and the tab stop) while focus is
 * in a popup that its content opened, such as a menu in a portal, so the popup can return focus
 * to it.
 *
 * Selection, as the nested `Tree`: `selected` and `onItemSelect` (single selection and activation,
 * with radios in `selectionMode="single"`), `current`, and with `selectionMode="multiple"` a
 * checkbox on every item bound to the model's `checkedItems` (Space or a click on the checkbox
 * toggles it, and checks cascade). An item whose data is `disabled` is `aria-disabled`, is skipped
 * by the keys and typeahead, never holds the tab stop (except while a pointer press has focused
 * it), and is neither activated, expanded nor checked by the user (a check of its parent still
 * includes it).
 *
 * When a branch collapses around the focused item (from code), focus moves to that branch, so it
 * never falls to the page. Items expand and collapse at once, without motion: there is no child
 * group to animate. A selected item under a collapsed branch is not the tab stop until it is
 * visible again.
 *
 * `FlatTree.Item` is the row the tree renders for each visible item (it is not written by hand);
 * it is also exported as `FlatTreeItem` for React Server Components, which cannot use the dotted
 * form.
 */
export const FlatTree = /* @__PURE__ */ Object.assign(FlatTreeRoot, { Item: FlatTreeItem });

export { FlatTreeItem };
