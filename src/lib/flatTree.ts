// The pure model behind `useFlatTree` and `FlatTree`: server-safe, no React import. A flat list of
// items with `parentValue` links becomes an index (one pass, no recursion), the visible rows for an
// expanded set (a walk that enters only expanded branches) and a `TreeNode` forest for the check
// cascade of `treeCascade.ts`. Every walk is iterative, so a chain thousands of levels deep cannot
// overflow the stack.
import type { TreeNode } from './treeCascade';

/** One item of a flat tree: `parentValue` places it, items are listed in any order. */
export interface FlatTreeItemData {
  /** The item's identity; it must be unique among the items (a later duplicate is ignored). */
  value: string;
  /** The `value` of the item this one is nested in; absent for a root. */
  parentValue?: string;
  /**
   * `'branch'` marks an item that can expand even while it has no child items (children loaded
   * on demand). An item with child items is a branch whatever its type says.
   */
  itemType?: 'leaf' | 'branch';
  /** The text the item shows. */
  label?: string;
  /** Whether the item is disabled. */
  disabled?: boolean;
}

/**
 * One row of the visible list: an item under expanded branches only, with the facts a row needs
 * for its tree semantics. A row is a branch when `hasChildren` is true or when
 * `item.itemType === 'branch'`; `expanded` is true only for a branch whose value is in the
 * expanded set (so a childless `'branch'` item can be expanded).
 */
export interface VisibleFlatItem {
  /** The item data, as passed in. */
  item: FlatTreeItemData;
  /** The depth, 1 for a root (`aria-level`). */
  level: number;
  /** The 1-based place among its siblings, in the order of `items` (`aria-posinset`). */
  position: number;
  /** The number of siblings, itself included (`aria-setsize`). */
  setSize: number;
  /** The value of the parent as indexed (`undefined` for a root, an unknown parent included). */
  parentValue: string | undefined;
  /** Whether other items are nested in it. */
  hasChildren: boolean;
  /** Whether it can expand: `hasChildren`, or `item.itemType === 'branch'` (`aria-expanded` is set for these). */
  isBranch: boolean;
  /** Whether it is a branch in the expanded set. */
  expanded: boolean;
  /** The place in the visible list, 0-based. */
  index: number;
}

/** What the index knows about one item. */
export interface FlatTreeNodeRecord {
  /** The item data, as passed in. */
  item: FlatTreeItemData;
  /** The place of the item in `items`, 0-based. */
  index: number;
  /** The value of the parent as indexed: `undefined` for a root, also when the parent was unknown or the link was cut as a cycle. */
  parentValue: string | undefined;
  /** The depth, 1 for a root. */
  level: number;
  /** The 1-based place among its siblings. */
  position: number;
  /** The number of siblings, itself included. */
  setSize: number;
  /** The values of the items nested in it, in the order of `items`. */
  children: readonly string[];
  /** Whether other items are nested in it (`children` is not empty). */
  hasChildren: boolean;
  /** Whether it can expand: `hasChildren`, or `item.itemType === 'branch'`. */
  isBranch: boolean;
}

/** A problem the index found in the items and repaired. Stable: `useFlatTree` reports these in development. */
export type FlatTreeIssue =
  | {
      /** A later item with a value an earlier one has: it is ignored (the first is kept). */
      kind: 'duplicate-value';
      value: string;
      /** The place of the ignored item in `items`. */
      index: number;
    }
  | {
      /** An item whose `parentValue` matches no item: it is indexed as a root. */
      kind: 'unknown-parent';
      value: string;
      parentValue: string;
    }
  | {
      /** A loop of parents: the link of this value to its parent is cut, so it is a root. */
      kind: 'cycle';
      value: string;
    };

/** The indexed items of a flat tree, from `buildFlatTreeIndex`. */
export interface FlatTreeIndex {
  /** Every item by value (one record per value). */
  byValue: Map<string, FlatTreeNodeRecord>;
  /** The values of the roots, in the order of `items`. */
  roots: readonly string[];
  /** What was repaired, in the order it was found: duplicates first, then unknown parents, then cycles. */
  issues: readonly FlatTreeIssue[];
}

interface Draft {
  item: FlatTreeItemData;
  index: number;
  parent: string | undefined;
}

/**
 * Indexes `items` in one pass over them (linear time, no recursion). Repairs, each reported as an
 * issue: a repeated value keeps its first item; an item whose parent is unknown becomes a root;
 * a loop of parents is cut at the value met twice when walking up from the first item of the loop
 * in `items` order, and that value becomes a root. Siblings keep the order of `items`.
 */
export function buildFlatTreeIndex(items: readonly FlatTreeItemData[]): FlatTreeIndex {
  const issues: FlatTreeIssue[] = [];
  const drafts = new Map<string, Draft>();
  items.forEach((item, index) => {
    if (drafts.has(item.value)) {
      issues.push({ kind: 'duplicate-value', value: item.value, index });
      return;
    }
    drafts.set(item.value, { item, index, parent: item.parentValue });
  });

  for (const [value, draft] of drafts) {
    if (draft.parent !== undefined && !drafts.has(draft.parent)) {
      issues.push({ kind: 'unknown-parent', value, parentValue: draft.parent });
      draft.parent = undefined;
    }
  }

  // Colour walk: 1 while on the current path, 2 once settled. A walk that reaches a value of its
  // own path has found a loop; cutting that value's parent link ends it.
  const state = new Map<string, 1 | 2>();
  for (const start of drafts.keys()) {
    if (state.has(start)) continue;
    const path: string[] = [];
    let current: string | undefined = start;
    while (current !== undefined && !state.has(current)) {
      state.set(current, 1);
      path.push(current);
      current = drafts.get(current)?.parent;
    }
    if (current !== undefined && state.get(current) === 1) {
      issues.push({ kind: 'cycle', value: current });
      const repeated = drafts.get(current);
      if (repeated) repeated.parent = undefined;
    }
    for (const value of path) state.set(value, 2);
  }

  const roots: string[] = [];
  const childValues = new Map<string, string[]>();
  for (const [value, draft] of drafts) {
    if (draft.parent === undefined) {
      roots.push(value);
      continue;
    }
    const siblings = childValues.get(draft.parent);
    if (siblings) siblings.push(value);
    else childValues.set(draft.parent, [value]);
  }

  const byValue = new Map<string, FlatTreeNodeRecord>();
  const queue: Array<{ value: string; level: number; position: number; setSize: number }> = [];
  roots.forEach((value, at) =>
    queue.push({ value, level: 1, position: at + 1, setSize: roots.length }),
  );
  // Every item is reachable from a root now: the loops are cut and the unknown parents are roots.
  for (let at = 0; at < queue.length; at += 1) {
    const { value, level, position, setSize } = queue[at];
    const draft = drafts.get(value) as Draft;
    const children = childValues.get(value) ?? [];
    byValue.set(value, {
      item: draft.item,
      index: draft.index,
      parentValue: draft.parent,
      level,
      position,
      setSize,
      children,
      hasChildren: children.length > 0,
      isBranch: children.length > 0 || draft.item.itemType === 'branch',
    });
    children.forEach((child, childAt) =>
      queue.push({
        value: child,
        level: level + 1,
        position: childAt + 1,
        setSize: children.length,
      }),
    );
  }
  // `byValue` is filled in breadth-first order; present it in the order of `items`.
  const ordered = new Map<string, FlatTreeNodeRecord>();
  for (const value of drafts.keys()) ordered.set(value, byValue.get(value) as FlatTreeNodeRecord);

  return { byValue: ordered, roots, issues };
}

/**
 * The rows visible with `expanded`: the roots, and the children of every branch in the set, in
 * tree order. Only expanded branches are entered, so the cost is the number of rows returned plus
 * the depth of the stack, never the number of items. A value in `expanded` that is no branch (a
 * leaf, or no item at all) has no effect.
 */
export function visibleFlatItems(
  index: FlatTreeIndex,
  expanded: ReadonlySet<string>,
): readonly VisibleFlatItem[] {
  const visible: VisibleFlatItem[] = [];
  const stack: string[] = [];
  for (let at = index.roots.length - 1; at >= 0; at -= 1) stack.push(index.roots[at]);
  while (stack.length > 0) {
    const record = index.byValue.get(stack.pop() as string);
    if (!record) continue;
    const open = record.isBranch && expanded.has(record.item.value);
    visible.push({
      item: record.item,
      level: record.level,
      position: record.position,
      setSize: record.setSize,
      parentValue: record.parentValue,
      hasChildren: record.hasChildren,
      isBranch: record.isBranch,
      expanded: open,
      index: visible.length,
    });
    if (open) {
      for (let at = record.children.length - 1; at >= 0; at -= 1) stack.push(record.children[at]);
    }
  }
  return visible;
}

/**
 * The items as a `TreeNode` forest (one node per indexed item, children in the order of `items`),
 * the input of `computeCheckStates` and `toggleCheck`. Built without recursion; walking the result
 * with those recursive functions is as deep as the tree is.
 */
export function flatTreeForest(index: FlatTreeIndex): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const value of index.byValue.keys()) nodes.set(value, { value, children: [] });
  for (const [value, record] of index.byValue) {
    const node = nodes.get(value) as TreeNode;
    for (const child of record.children) node.children.push(nodes.get(child) as TreeNode);
  }
  return index.roots.map((value) => nodes.get(value) as TreeNode);
}
