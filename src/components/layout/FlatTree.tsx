import * as React from 'react';
import { flatTreeClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import type { VisibleFlatItem } from '../../lib/flatTree';
import type { SlotPart } from '../../lib/slotProps';
import type { CheckState } from '../../lib/treeCascade';
import type { SelectionMode } from '../../lib/types';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useTypeahead } from '../../hooks/useTypeahead';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { FlatTreeContext, type FlatTreeContextValue, type FlatTreeRow } from './FlatTree.context';
import { FlatTreeItem } from './FlatTree.item';
import {
  focusCell,
  getCellIndex,
  getCellOf,
  getCells,
  getFirstWidget,
  parkCellWidgets,
} from './FlatTree.treegrid';
import type { FlatTreeModel } from './useFlatTree';
import { useAppClassName } from '../../hooks/useAppClassName';

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
   * is exactly `itemSize` pixels tall, so its content must fit in one row (the rows are not measured:
   * a window that measures its rows lays the tree out from its estimate). Without it every visible
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
   * How the tree is built and moved through. `'tree'` (the default) is the WAI-ARIA tree view:
   * `role="tree"` with `role="treeitem"` items, one tab stop on an item. `'treegrid'` is the
   * WAI-ARIA treegrid: `role="treegrid"` (with `aria-rowcount`), each item a `role="row"` with
   * `aria-level`, `aria-posinset`, `aria-setsize`, `aria-rowindex` and, on a branch,
   * `aria-expanded`, and its content in `role="gridcell"` elements: the first holds the chevron,
   * the check and what `renderItem` returns, and `renderCells` draws the others. A row has no
   * `aria-checked` (its checkbox does). Fluent UI's `Tree navigationMode` (whose `'treegrid'`
   * keeps the tree roles; the nested `Tree` does the same here).
   *
   * The keys of a treegrid (APG): on a row, Down and Up move to the next and previous row, Home
   * and End (also with Ctrl) to the first and last row, Right expands a collapsed branch, else
   * moves into the row's first cell (it no longer moves to the first child: Down does), Left
   * collapses an expanded branch (else it does nothing: the focus stays), and Enter, Space, `*`
   * and typing act on the row as in a tree. On a cell, Left and Right move between the row's
   * cells (Left on the first returns to the row; both mirrored in right-to-left layouts), Up and
   * Down to the cell of the same column in the previous and next row, Home and End to the first
   * and last cell of the row, Ctrl+Home and Ctrl+End to the same column of the first and last
   * row, and Enter or F2 moves focus to the cell's first control (a button, a link), where Escape
   * returns to the cell and the control's own keys apply. The tree keeps one tab stop, a row or a
   * cell; the controls in cells are taken out of the Tab order (`tabindex="-1"`, also those that
   * render later) and reached with Enter. A click on a cell other than the first, and on what is
   * in it, never activates the row.
   * @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';
  /**
   * The content of a row's further cells, in order, in `navigationMode="treegrid"`: for each
   * rendered row, the item with its level, position, set size, expanded state and check state.
   * Each node is drawn in a `role="gridcell"` element after the first cell, so a value is a column
   * (a size, a date, a button). Return the same number of cells for every row; a row with fewer
   * keeps the last column for the keys that move between rows. Without a treegrid it is ignored
   * (a development warning). Pure, and called for the rendered rows only.
   */
  renderCells?: (item: VisibleFlatItem & { checked?: CheckState }) => readonly React.ReactNode[];
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
  /** Ref to the `role="tree"` element (`role="treegrid"` with `navigationMode="treegrid"`). */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the elements every item draws, by part: each `FlatTree.Item` is rendered by the
   * tree, never written by hand, so the parts of all of them are given here once. The items read
   * the object from the tree's context: an object that keeps its identity across renders (defined
   * outside the component, or memoised) changes that context only when the tree's state changes.
   * Each part is merged into the part's own props: your classes after the part's (yours win a
   * conflict), your styles over its styles, your attributes and handlers added, your ref attached
   * (to the part of every rendered item). Every attribute an item sets on a part is locked and
   * keeps the item's value, and no part takes a role, a tab index or the markers by which the tree
   * reads an item (its row and its checkbox), so a part changes neither the tree's items, its one
   * tab stop nor which clicks an item takes. A part takes no `children` (the item draws their
   * content: the chevron, the check marks and what `renderItem` returns); the treeitem elements
   * take no props of yours. Apart from the checkbox (below), no part carries a handler of the
   * item: an event on a part reaches the item and the tree after your handler, as one on the
   * content does, and `preventDefault()` in yours skips their handling of it there too: a click
   * you prevent on the row, the chevron, the radio or the label neither activates nor expands the
   * item. While an item is disabled (its data's `disabled`), your `onClick` on its parts is not
   * called, as the item activates on no click. Fluent UI's FlatTreeItem takes the parts of its
   * TreeItemLayout as slots of their own (`main` for the label, `expandIcon`, `selector` for the
   * checkbox or radio).
   */
  slotProps?: {
    /**
     * The `<div>` of an item's row, which holds the chevron, the checkbox or radio and the label,
     * and draws the focus ring and the selected look (stable class `wave-flat-tree-item__row`);
     * in a treegrid it is the row's first `gridcell`. Locked: its marker (the focus ring finds
     * the row by it), no role or tab index (a treegrid's cell has its `gridcell` role, tab index
     * and cell marker), no checkbox marker, and no `hidden`, `inert` or `aria-hidden`, since it
     * holds the item's name and content.
     */
    row?: SlotPart<'div'>;
    /**
     * The chevron `<svg>` of a branch, turned while the branch is expanded and mirrored in a
     * right-to-left tree (stable class `wave-flat-tree-item__expand-icon`); a leaf has none.
     * Locked: `aria-hidden` and `focusable` (it is a drawing), no role or tab index, and the
     * item's markers; its size, view box and paint are the glyph's, which your attributes replace.
     */
    expandIcon?: SlotPart<'svg'>;
    /**
     * The checkbox `<span>` of a `selectionMode="multiple"` tree, or the radio `<span>` of a
     * `"single"` one (stable class `wave-flat-tree-item__indicator`); absent with
     * `selectionMode="none"`. Locked on the checkbox: its role, `aria-checked`, its name
     * (`aria-labelledby`, the item's label; your ids are joined after it), `aria-disabled` (set
     * while the item is disabled), its tab index (-1: it never takes focus) and marker, no
     * `hidden`, `inert` or `aria-hidden`, and its handlers: a press focuses the item instead, a
     * click toggles the check, and `preventDefault()` in your `onMouseDown` or `onClick` skips
     * that handling. Locked on the radio: `aria-hidden` (the item's `aria-selected` carries the
     * state), no role or tab index; a click on it is a click on the row.
     */
    indicator?: SlotPart<'span'>;
    /**
     * The `<span>` around an item's content (what `renderItem` returns, else the item's label),
     * which names the item (stable class `wave-flat-tree-item__label`). Locked: its `id` (the
     * item's `aria-labelledby`), no `aria-label` (it would replace the content's text in the
     * item's name), no role or tab index, the item's markers, and no `hidden`, `inert` or
     * `aria-hidden`.
     */
    label?: SlotPart<'span'>;
    /**
     * The `<div role="gridcell">` of each further cell of a `navigationMode="treegrid"` row, the
     * ones `renderCells` draws (stable class `wave-flat-tree-item__cell`); none without them. The
     * object is for every cell. Locked: its role, tab index (the tree's roving) and cell marker,
     * no other role, and no `hidden`, `inert` or `aria-hidden`, since it holds the cell's content.
     * Give it a width (a class or a style) to size a column. While the item is disabled, your
     * `onClick` is not called.
     */
    cell?: SlotPart<'div'>;
  };
}

/** The focused and the awaited item of a FlatTree, by value (see {@link FlatTreeFocusStore}). */
interface FlatTreeFocus {
  /** The item that has focus while focus is inside the tree: kept rendered, and the tab stop. */
  focused: string | null;
  /** The item a key moved to that was not rendered: kept rendered, focused after the commit. */
  pending: string | null;
  /** Treegrid: the cell of the focused item that has focus (or holds the tab stop); `null` for the row. */
  cell: number | null;
  /** Treegrid: the cell to focus once the `pending` item renders; `null` for the row. */
  pendingCell: number | null;
}

const NO_FOCUS: FlatTreeFocus = { focused: null, pending: null, cell: null, pendingCell: null };

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
    if (
      state.focused === this.state.focused &&
      state.pending === this.state.pending &&
      state.cell === this.state.cell &&
      state.pendingCell === this.state.pendingCell
    ) {
      return;
    }
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

/** The item element (a treeitem or row child of `root`) that holds `target`; `null` for a portal's. */
function getOwnItem(root: Element, target: EventTarget | null): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el.parentElement !== root) el = el.parentElement;
  const role = el instanceof HTMLElement ? el.getAttribute('role') : null;
  return el instanceof HTMLElement && (role === 'treeitem' || role === 'row') ? el : null;
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

const CELLS_WITHOUT_TREEGRID_MESSAGE =
  'FlatTree: `renderCells` draws cells in a treegrid only; pass navigationMode="treegrid" ' +
  '(until then no cell is drawn).';

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
  navigationMode = 'tree',
  renderCells,
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
  slotProps,
  ...rest
}: FlatTreeProps) => {
  const appClassName = useAppClassName(flatTreeClassNames.root);

  const modelMode = model.getTreeProps().selectionMode;
  const selectionMode = selectionModeProp ?? modelMode;
  const rows = model.visibleItems;
  const count = rows.length;
  const windowed = virtualWindow !== undefined;
  const treegrid = navigationMode === 'treegrid';

  // An item carries aria-checked or aria-selected, never both (APG); in single mode every item
  // carries aria-selected from the first render, so the radios and the state agree.
  const effectiveSelected =
    selectionMode === 'multiple'
      ? undefined
      : selectionMode === 'single'
        ? (selected ?? null)
        : selected;

  const [focusStore] = React.useState(() => new FlatTreeFocusStore());
  const { focused, pending, cell } = React.useSyncExternalStore(
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
  // A treegrid's focused cell holds the tab stop in the focused item.
  const tabStopCell = treegrid && focusedRow !== undefined ? cell : null;
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
      treegrid,
      tabStopCell,
      itemSize,
      activate,
      toggleChecked,
      slotProps,
    }),
    [
      selectionMode,
      effectiveSelected,
      current,
      tabStop,
      treegrid,
      tabStopCell,
      itemSize,
      activate,
      toggleChecked,
      slotProps,
    ],
  );

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  // The tree is the window's scroller.
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef, virtualWindow?.scrollRef);

  /**
   * Focuses the row at `index`, moving the window to it first (in the same update, so no frame
   * shows the spacer); a row that is not rendered is awaited and focused after the commit that
   * renders it.
   */
  const moveTo = (root: HTMLElement, index: number, cellIndex: number | null = null) => {
    const row = rows[index];
    if (!row) return;
    virtualWindow?.scrollToIndex(index, { align: 'auto' });
    const el = getRenderedItem(root, index);
    if (el) {
      focusStore.update({ pending: null, pendingCell: null });
      if (cellIndex === null) el.focus();
      else focusCell(el, cellIndex);
    } else {
      focusStore.update({ pending: row.item.value, pendingCell: cellIndex });
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
    // A treegrid's focus on a cell, or on a control in one, makes that cell the tab stop.
    const cellOf = treegrid ? getCellOf(el as Element, event.target as Element) : null;
    focusStore.update({
      focused: row.item.value,
      pending: null,
      pendingCell: null,
      cell: cellOf ? getCellIndex(cellOf) : null,
    });
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

  /**
   * The keys of a treegrid's focused cell (APG): between its row's cells, to the cell of the same
   * column in other rows, and Enter or F2 into the cell's first control.
   */
  const handleCellKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    root: HTMLElement,
    rowEl: HTMLElement,
    cellEl: HTMLElement,
    current: number,
    from: number,
  ) => {
    if (event.altKey || event.metaKey) return;
    const column = getCellIndex(cellEl);
    const cells = getCells(rowEl);
    const toRow = (index: number | undefined) => {
      event.preventDefault();
      if (index === undefined || index === current) {
        focusStore.update({ pending: null, pendingCell: null });
        virtualWindow?.scrollToIndex(current, { align: 'auto' });
        return;
      }
      moveTo(root, index, column);
    };
    switch (event.key) {
      case 'ArrowDown':
        toRow(nextEnabled(rows, from, 1));
        return;
      case 'ArrowUp':
        toRow(nextEnabled(rows, from, -1));
        return;
      case 'Home':
        if (event.ctrlKey) toRow(nextEnabled(rows, -1, 1));
        else {
          event.preventDefault();
          cells[0]?.focus();
        }
        return;
      case 'End':
        if (event.ctrlKey) toRow(nextEnabled(rows, count, -1));
        else {
          event.preventDefault();
          cells[cells.length - 1]?.focus();
        }
        return;
      case 'Enter':
      case 'F2': {
        if (event.ctrlKey) return;
        event.preventDefault();
        getFirstWidget(cellEl)?.focus();
        return;
      }
      case ' ':
        // A cell has no activation of its own; the page does not scroll.
        event.preventDefault();
        return;
      default:
    }
    if (event.ctrlKey) return;
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(root),
    });
    if (intent === null) return;
    event.preventDefault();
    if (intent === 'next') cells[column + 1]?.focus();
    else if (column > 0) cells[column - 1]?.focus();
    else rowEl.focus();
  };

  const handleKeyDown = useEventCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const root = event.currentTarget;
    // A key from a portal is the portal's; a text field in the content keeps its keys.
    const el = getOwnItem(root, event.target);
    const current = el ? getIndex(el) : null;
    if (el === null || current === null || current >= count) return;
    // In a treegrid a key inside a cell is the cell's: the cell itself moves between cells, and
    // Escape in a control inside one returns to the cell.
    const eventTarget = event.target as Element;
    const cellEl = treegrid && eventTarget !== el ? getCellOf(el, eventTarget) : null;
    if (cellEl && eventTarget !== cellEl) {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        cellEl.focus();
      }
      return;
    }
    if (isEditableTarget(event.target)) return;
    const row = rows[current];
    // Keys pressed before an awaited item renders move from it (possible only within one task).
    const awaited = focusStore.getSnapshot().pending;
    const from = (awaited === null ? undefined : model.getItem(awaited)?.index) ?? current;

    if (cellEl) {
      handleCellKeyDown(event, root, el, cellEl, current, from);
      return;
    }

    // Typeahead; a Space continues a search, and `*` starts none.
    if (event.key.length === 1 && (event.key !== '*' || isSearching())) {
      if (onTypeahead(event, rows[from].item.value)) {
        event.preventDefault();
        return;
      }
    }
    // A treegrid's Ctrl+Home and Ctrl+End are Home and End.
    const ctrlEdge = treegrid && event.ctrlKey && (event.key === 'Home' || event.key === 'End');
    if ((event.altKey || event.ctrlKey || event.metaKey) && !ctrlEdge) return;

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
          if (treegrid) {
            // APG treegrid: an expanded row or a leaf moves into its first cell.
            event.preventDefault();
            moveTo(root, current, 0);
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
          if (treegrid) {
            // APG treegrid: on a collapsed row or a leaf the focus stays.
            event.preventDefault();
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
      focusStore.update({ pending: null, pendingCell: null });
      const row = model.getItem(snapshot.pending);
      const el = row ? getRenderedItem(root, row.index) : null;
      if (el && (lost || root.contains(active))) {
        if (snapshot.pendingCell === null) el.focus();
        else focusCell(el, snapshot.pendingCell);
      }
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

  // A treegrid keeps one tab stop: the controls inside its cells are out of the Tab order (Enter on
  // a cell moves focus to the first), also those that render later.
  React.useLayoutEffect(() => {
    if (treegrid && rootRef.current) parkCellWidgets(rootRef.current);
  });
  React.useEffect(() => {
    const root = rootRef.current;
    if (!treegrid || !root || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => parkCellWidgets(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [treegrid]);

  // Development diagnostics (C-DEV): emitted from effects, once per page.
  const cellsIgnored = !treegrid && renderCells !== undefined;
  React.useEffect(() => {
    if (cellsIgnored) warnOnce('FlatTree:cells-without-treegrid', CELLS_WITHOUT_TREEGRID_MESSAGE);
  }, [cellsIgnored]);
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
    <FlatTreeItem
      key={`item:${row.item.value}`}
      item={row}
      cells={treegrid ? renderCells?.(row) : undefined}
    >
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
        role={treegrid ? 'treegrid' : 'tree'}
        aria-rowcount={treegrid ? count : undefined}
        aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
        data-selection-mode={selectionMode}
        // A windowed tree's tab stop is an item: the scroller is none of its own (Firefox makes a
        // scroller a tab stop). The consumer's `tabIndex` wins.
        tabIndex={windowed && tabStop !== null ? -1 : undefined}
        className={wcn(
          flatTreeClassNames.root,
          'wave:text-body-1',
          // The window lays the rows out: the browser's scroll anchoring only fights it.
          windowed && 'wave:overflow-y-auto wave:[overflow-anchor:none]',
          appClassName,
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
 * `navigationMode="treegrid"` makes it a WAI-ARIA treegrid instead: `role="treegrid"`, each item a
 * `role="row"` (with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-rowindex` and
 * `aria-expanded`) whose content is in `gridcell`s, with more cells from `renderCells` and the
 * treegrid keys of APG (rows, cells, Enter into a cell's controls); the nested `Tree`'s own
 * `navigationMode="treegrid"` changes the keyboard only and keeps its tree roles. Default
 * rendering is unchanged.
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
