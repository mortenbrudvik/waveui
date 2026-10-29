import * as React from 'react';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { warnOnce } from '../../lib/dev';
import {
  buildFlatTreeIndex,
  flatTreeForest,
  visibleFlatItems,
  type FlatTreeItemData,
  type FlatTreeIssue,
  type VisibleFlatItem,
} from '../../lib/flatTree';
import { computeCheckStates, toggleCheck, type CheckState } from '../../lib/treeCascade';
import type { SelectionMode } from '../../lib/types';
import type { TreeCheckedItemsChangeDetails } from './Tree.core';

const EMPTY: readonly string[] = [];

/** Options of {@link useFlatTree}: the state names and shapes of the nested `Tree`. */
export interface UseFlatTreeOptions {
  /** Controlled list of expanded item values. */
  expandedItems?: readonly string[];
  /**
   * Item values that are expanded initially (uncontrolled).
   * @default []
   */
  defaultExpandedItems?: readonly string[];
  /** Called with the new list of expanded item values when an item expands or collapses. */
  onExpandedItemsChange?: (expandedItems: string[]) => void;
  /** Controlled checked items (`selectionMode="multiple"`); the cascade rule is the nested `Tree`'s. */
  checkedItems?: readonly string[];
  /**
   * Initially checked items (uncontrolled).
   * @default []
   */
  defaultCheckedItems?: readonly string[];
  /**
   * Called with every checked item (in tree order) when a check changes. `details` is passed when
   * `setChecked` got an `event`; it is typed optional until 1.0.
   */
  onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void;
  /**
   * How items are selected, as `Tree`. With `'multiple'` every visible row carries its `checked`
   * state; the model's `getTreeProps()` hands the mode on to `FlatTree`.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
}

/** The state and the visible rows of a flat tree, from {@link useFlatTree}. */
export interface FlatTreeModel {
  /**
   * The rows to show: the roots and the children of every expanded branch, in tree order. With
   * `selectionMode: 'multiple'` each row has its `checked` state. The array and its rows keep
   * their identity until the items, the expanded set or the checked set change.
   */
  visibleItems: readonly (VisibleFlatItem & { checked?: CheckState })[];
  /** The visible row of `value`; `undefined` for an item under a collapsed branch or an unknown value. */
  getItem(value: string): (VisibleFlatItem & { checked?: CheckState }) | undefined;
  /**
   * Expands `value`, or every value of a list in one change (one `onExpandedItemsChange` call, as
   * `*` on a tree item makes). Nothing happens, and nothing is called, if every value is already in
   * the expanded set.
   */
  expand(value: string | readonly string[]): void;
  /** Collapses `value`. Nothing happens, and nothing is called, if it is not in the expanded set. */
  collapse(value: string): void;
  /** Expands `value` when it is collapsed and collapses it when it is expanded. */
  toggle(value: string): void;
  /** Whether `value` is a branch (an item with child items, or typed `'branch'`) in the expanded set. */
  isExpanded(value: string): boolean;
  /**
   * Sets the check state of `value`, with the cascade of the nested `Tree`: the item and everything
   * nested in it, then its ancestors from their children. Nothing is called when the item is
   * already in that state; a mixed item is set to `checked` as requested. A value that matches no
   * item is added to, or removed from, the checked list. `event` becomes `details.event` of
   * `onCheckedItemsChange`; without it the callback gets no `details`.
   */
  setChecked(value: string, checked: boolean, event?: Event): void;
  /** The props `FlatTree` takes from the model, for `<FlatTree model={model} {...model.getTreeProps()} />`. */
  getTreeProps(): { selectionMode: 'none' | SelectionMode };
}

function issueMessage(issue: FlatTreeIssue): string {
  switch (issue.kind) {
    case 'unknown-parent':
      return (
        `useFlatTree: the item "${issue.value}" has the parentValue "${issue.parentValue}", which ` +
        'matches no item; it is shown as a root.'
      );
    case 'cycle':
      return (
        `useFlatTree: the parentValue links form a cycle at "${issue.value}"; the link of that ` +
        'item to its parent is ignored and it is shown as a root.'
      );
    case 'duplicate-value':
      return (
        `useFlatTree: duplicate item value "${issue.value}" (item ${issue.index}); only the first ` +
        'item with a value is used.'
      );
  }
}

/**
 * The model of a flat tree: items listed with a `parentValue` link, in any order, become the rows
 * a windowed tree shows (`FlatTree`), without building an element tree. Returns the visible rows
 * (with `level`, `position`, `setSize` and `expanded` for the tree ARIA), the expanded and
 * checked state, and the actions on them.
 *
 * Pass `items` as a stable reference or memoise it: the index of the items is rebuilt when its
 * identity changes. Expanded and checked state work as in `Tree`: pass `expandedItems` or
 * `checkedItems` to control it (a stable array, or the rows are rebuilt on every render), or
 * `defaultExpandedItems` and `defaultCheckedItems` to start uncontrolled; the change callbacks
 * fire once per change. When `items` is replaced, the expanded and checked values stay in the
 * state: a value that matches no item is ignored for the rows until an item with it returns, and
 * it is changed only by you.
 *
 * Development warnings, once each: an unknown `parentValue` (the item is a root), a cycle of
 * parents (cut) and a duplicate value (the first item wins).
 *
 * @example
 * const model = useFlatTree(items, { defaultExpandedItems: ['docs'] });
 * model.visibleItems.map((row) => row.item.label);
 */
export function useFlatTree(
  items: readonly FlatTreeItemData[],
  options: UseFlatTreeOptions = {},
): FlatTreeModel {
  const {
    expandedItems,
    defaultExpandedItems,
    onExpandedItemsChange,
    checkedItems,
    defaultCheckedItems,
    onCheckedItemsChange,
    selectionMode = 'none',
  } = options;

  const index = React.useMemo(() => buildFlatTreeIndex(items), [items]);
  React.useEffect(() => {
    const reported = new Set<string>();
    for (const issue of index.issues) {
      if (reported.has(issue.kind)) continue;
      reported.add(issue.kind);
      warnOnce(`useFlatTree:${issue.kind}`, issueMessage(issue));
    }
  }, [index]);

  const [initialExpanded] = React.useState<readonly string[]>(() => defaultExpandedItems ?? EMPTY);
  const [expandedList, setExpandedList] = useControllable<readonly string[]>(
    expandedItems,
    initialExpanded,
    (next) => onExpandedItemsChange?.([...next]),
  );
  const expandedSet = React.useMemo(() => new Set(expandedList), [expandedList]);

  const expand = React.useCallback(
    (value: string | readonly string[]) => {
      const values = typeof value === 'string' ? [value] : value;
      setExpandedList((prev) => {
        const added = values.filter((v, at) => !prev.includes(v) && values.indexOf(v) === at);
        return added.length > 0 ? [...prev, ...added] : prev;
      });
    },
    [setExpandedList],
  );
  const collapse = React.useCallback(
    (value: string) => {
      setExpandedList((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : prev));
    },
    [setExpandedList],
  );
  const toggle = React.useCallback(
    (value: string) => {
      setExpandedList((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
    },
    [setExpandedList],
  );
  const isExpanded = React.useCallback(
    (value: string) => (index.byValue.get(value)?.isBranch ?? false) && expandedSet.has(value),
    [index, expandedSet],
  );

  // useControllable passes the value only, so `details` reaches the change callback through a ref
  // written and cleared in the same event (the nested Tree does the same).
  const [initialChecked] = React.useState<readonly string[]>(() => defaultCheckedItems ?? EMPTY);
  const pendingDetails = React.useRef<TreeCheckedItemsChangeDetails | undefined>(undefined);
  const [checkedList, setCheckedList] = useControllable<readonly string[]>(
    checkedItems,
    initialChecked,
    (next) => onCheckedItemsChange?.([...next], pendingDetails.current),
  );

  const isMultiple = selectionMode === 'multiple';
  const forest = React.useMemo(
    () => (isMultiple ? flatTreeForest(index) : null),
    [index, isMultiple],
  );
  const checkStates = React.useMemo(
    () => (forest ? computeCheckStates(forest, new Set(checkedList)) : null),
    [forest, checkedList],
  );

  const setChecked = useEventCallback((value: string, checked: boolean, event?: Event) => {
    const nodes = forest ?? flatTreeForest(index);
    setCheckedList((previous) => {
      const current =
        computeCheckStates(nodes, new Set(previous)).get(value) ??
        (previous.includes(value) ? 'checked' : 'unchecked');
      if (current === (checked ? 'checked' : 'unchecked')) return previous;
      let next = toggleCheck(nodes, previous, value);
      // A mixed item turns checked on a toggle; asked to be unchecked it needs a second one.
      if (next.includes(value) !== checked) next = toggleCheck(nodes, next, value);
      pendingDetails.current = event ? { value, checked: next.includes(value), event } : undefined;
      return next;
    });
    pendingDetails.current = undefined;
  });

  const visibleItems = React.useMemo(() => {
    const rows = visibleFlatItems(index, expandedSet);
    if (!checkStates) return rows;
    return rows.map((row) => ({ ...row, checked: checkStates.get(row.item.value) ?? 'unchecked' }));
  }, [index, expandedSet, checkStates]);

  const rowsByValue = React.useMemo(() => {
    const map = new Map<string, (typeof visibleItems)[number]>();
    for (const row of visibleItems) map.set(row.item.value, row);
    return map;
  }, [visibleItems]);
  const getItem = React.useCallback((value: string) => rowsByValue.get(value), [rowsByValue]);

  const treeProps = React.useMemo(() => ({ selectionMode }), [selectionMode]);
  const getTreeProps = React.useCallback(() => treeProps, [treeProps]);

  return React.useMemo(
    () => ({
      visibleItems,
      getItem,
      expand,
      collapse,
      toggle,
      isExpanded,
      setChecked,
      getTreeProps,
    }),
    [visibleItems, getItem, expand, collapse, toggle, isExpanded, setChecked, getTreeProps],
  );
}
