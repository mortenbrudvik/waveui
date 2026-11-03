// The pure check-state cascade of the trees: server-safe, no React import. The nested Tree feeds it
// a forest read from its elements (`Tree.selection.ts`), the flat tree a forest built from flat data
// (`flatTree.ts`). Every walk is iterative, with an explicit stack, so the depth of a tree is not
// limited by the call stack.

/** One Tree.Item of the cascade model: its value and the items nested in it. */
export interface TreeNode {
  value: string;
  children: TreeNode[];
}

/** The check state of an item in a `selectionMode="multiple"` tree. */
export type CheckState = 'checked' | 'mixed' | 'unchecked';

/** Calls `visit` for every node of the forest in tree order (an item before the items in it). */
function forEachNode(nodes: readonly TreeNode[], visit: (node: TreeNode) => void): void {
  const stack: TreeNode[] = [];
  for (let index = nodes.length - 1; index >= 0; index -= 1) stack.push(nodes[index]);
  while (stack.length > 0) {
    const node = stack.pop() as TreeNode;
    visit(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1)
      stack.push(node.children[index]);
  }
}

/** The first item with `value` in tree order and its ancestors, from the top down; `null` if none. */
function findPath(nodes: readonly TreeNode[], value: string): TreeNode[] | null {
  // The path from the top to the node being visited, and the index of the next child to enter at
  // each level of it (the top level is `nodes` itself).
  const path: TreeNode[] = [];
  const next: number[] = [0];
  while (next.length > 0) {
    const level = next.length - 1;
    const siblings = level === 0 ? nodes : path[level - 1].children;
    if (next[level] >= siblings.length) {
      next.pop();
      path.pop();
      continue;
    }
    const node = siblings[next[level]];
    next[level] += 1;
    path.push(node);
    if (node.value === value) return path;
    next.push(0);
  }
  return null;
}

/** An item of the walk that computes the check states: what is known of it so far. */
interface StateFrame {
  node: TreeNode;
  /** The item or an ancestor is listed (or `ancestorListed`): the item is checked. */
  forced: boolean;
  /** The index of the next child to visit. */
  next: number;
  /** Whether every child visited so far is checked. */
  allChecked: boolean;
  /** Whether some child visited so far is checked or mixed. */
  anyChecked: boolean;
}

/**
 * The check state of every item: checked when its value is listed, when an ancestor's value is
 * listed (or `ancestorListed`), or when it has nested items and all of them are checked; mixed
 * when some of them are checked or mixed; else unchecked. For a value that several items share,
 * the first item in tree order decides the entry.
 */
export function computeCheckStates(
  nodes: readonly TreeNode[],
  listed: ReadonlySet<string>,
  ancestorListed = false,
): Map<string, CheckState> {
  const first = new Map<string, TreeNode>();
  forEachNode(nodes, (candidate) => {
    if (!first.has(candidate.value)) first.set(candidate.value, candidate);
  });
  const states = new Map<string, CheckState>();
  const enter = (node: TreeNode, forcedAbove: boolean): StateFrame => ({
    node,
    forced: forcedAbove || listed.has(node.value),
    next: 0,
    allChecked: true,
    anyChecked: false,
  });
  for (const top of nodes) {
    const stack: StateFrame[] = [enter(top, ancestorListed)];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.next < frame.node.children.length) {
        const child = frame.node.children[frame.next];
        frame.next += 1;
        stack.push(enter(child, frame.forced));
        continue;
      }
      stack.pop();
      let state: CheckState;
      if (frame.forced) state = 'checked';
      else if (frame.node.children.length === 0) state = 'unchecked';
      else if (frame.allChecked) state = 'checked';
      else if (frame.anyChecked) state = 'mixed';
      else state = 'unchecked';
      if (first.get(frame.node.value) === frame.node) states.set(frame.node.value, state);
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.allChecked &&= state === 'checked';
        parent.anyChecked ||= state !== 'unchecked';
      }
    }
  }
  return states;
}

/**
 * The checked values as a list: every item of the forest whose value is in `checked`, in tree
 * order, each value once, followed by `unmatched` (the listed values that match no item).
 */
function inTreeOrder(
  nodes: readonly TreeNode[],
  checked: ReadonlySet<string>,
  unmatched: readonly string[],
): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  forEachNode(nodes, (candidate) => {
    if (checked.has(candidate.value) && !seen.has(candidate.value)) {
      seen.add(candidate.value);
      ordered.push(candidate.value);
    }
  });
  return [...ordered, ...unmatched];
}

/** The listed values that no item of the forest has, each once, in their order. */
function unmatchedValues(nodes: readonly TreeNode[], listed: readonly string[]): string[] {
  const known = new Set<string>();
  forEachNode(nodes, (candidate) => known.add(candidate.value));
  return Array.from(new Set(listed.filter((listedValue) => !known.has(listedValue))));
}

/**
 * Turns `value` on or off in `checked` (the fully checked values) with the cascade: the item and
 * every item nested in it follow, then its ancestors follow their nested items. `false` when no
 * item has the value.
 */
function applyCascade(
  nodes: readonly TreeNode[],
  checked: Set<string>,
  value: string,
  turnOn: boolean,
): boolean {
  const path = findPath(nodes, value);
  if (!path) return false;
  forEachNode([path[path.length - 1]], (candidate) => {
    if (turnOn) checked.add(candidate.value);
    else checked.delete(candidate.value);
  });
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const ancestor = path[index];
    if (ancestor.children.every((child) => checked.has(child.value))) checked.add(ancestor.value);
    else checked.delete(ancestor.value);
  }
  return true;
}

/** The values that are fully checked, from the cascade's states. */
function checkedValuesOf(states: ReadonlyMap<string, CheckState>): Set<string> {
  const checked = new Set<string>();
  for (const [itemValue, state] of states) {
    if (state === 'checked') checked.add(itemValue);
  }
  return checked;
}

/**
 * The checked items after toggling `value`. A checked item and every item nested in it become
 * unchecked; an unchecked or mixed one and every item nested in it become checked; its ancestors
 * then follow their nested items. Returns every checked item in tree order (fully checked parents
 * included, mixed ones not), each value once, followed by the listed values that match no item,
 * in their order; a value that no item has is added to, or removed from, those.
 */
export function toggleCheck(
  nodes: readonly TreeNode[],
  listed: readonly string[],
  value: string,
): string[] {
  const states = computeCheckStates(nodes, new Set(listed));
  const checked = checkedValuesOf(states);
  const unmatched = unmatchedValues(nodes, listed);
  if (!applyCascade(nodes, checked, value, states.get(value) !== 'checked')) {
    const at = unmatched.indexOf(value);
    if (at === -1) unmatched.push(value);
    else unmatched.splice(at, 1);
  }
  return inTreeOrder(nodes, checked, unmatched);
}

/**
 * The checked items after checking every one of `values`, each with the cascade of
 * {@link toggleCheck} (an item already checked stays so). The list is ordered as `toggleCheck`'s;
 * a value that no item has is added to the listed values that match none.
 */
export function checkItems(
  nodes: readonly TreeNode[],
  listed: readonly string[],
  values: readonly string[],
): string[] {
  const checked = checkedValuesOf(computeCheckStates(nodes, new Set(listed)));
  const unmatched = unmatchedValues(nodes, listed);
  for (const value of values) {
    if (!applyCascade(nodes, checked, value, true) && !unmatched.includes(value)) {
      unmatched.push(value);
    }
  }
  return inTreeOrder(nodes, checked, unmatched);
}

/**
 * The checked items after toggling `value` when checks do not cascade: only that item changes,
 * and no item is mixed. The list is ordered as `toggleCheck`'s (every checked item in tree order,
 * then the listed values that match no item); a value that no item has is added to, or removed
 * from, the unmatched ones.
 */
export function toggleCheckIndependent(
  nodes: readonly TreeNode[],
  listed: readonly string[],
  value: string,
): string[] {
  const checked = new Set(listed);
  if (checked.has(value)) checked.delete(value);
  else checked.add(value);
  return inTreeOrder(nodes, checked, unmatchedValues(nodes, Array.from(checked)));
}

/**
 * The checked items after checking every one of `values` when checks do not cascade: each of them
 * is checked on its own. The list is ordered as {@link toggleCheckIndependent}'s.
 */
export function checkItemsIndependent(
  nodes: readonly TreeNode[],
  listed: readonly string[],
  values: readonly string[],
): string[] {
  const checked = new Set(listed);
  for (const value of values) checked.add(value);
  return inTreeOrder(nodes, checked, unmatchedValues(nodes, Array.from(checked)));
}

/** Every item value of the forest, in tree order, each once. */
export function allItemValues(nodes: readonly TreeNode[]): string[] {
  const values = new Set<string>();
  forEachNode(nodes, (candidate) => values.add(candidate.value));
  return Array.from(values);
}
