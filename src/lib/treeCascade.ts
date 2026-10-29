// The pure check-state cascade of the trees: server-safe, no React import. The nested Tree feeds it
// a forest read from its elements (`Tree.selection.ts`), the flat tree a forest built from flat data
// (`flatTree.ts`).

/** One Tree.Item of the cascade model: its value and the items nested in it. */
export interface TreeNode {
  value: string;
  children: TreeNode[];
}

/** The check state of an item in a `selectionMode="multiple"` tree. */
export type CheckState = 'checked' | 'mixed' | 'unchecked';

function forEachNode(nodes: readonly TreeNode[], visit: (node: TreeNode) => void): void {
  for (const node of nodes) {
    visit(node);
    forEachNode(node.children, visit);
  }
}

/** The first item with `value` in tree order and its ancestors, from the top down; `null` if none. */
function findPath(nodes: readonly TreeNode[], value: string): TreeNode[] | null {
  for (const node of nodes) {
    if (node.value === value) return [node];
    const below = findPath(node.children, value);
    if (below) return [node, ...below];
  }
  return null;
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
  const visit = (current: TreeNode, forcedAbove: boolean): CheckState => {
    const forced = forcedAbove || listed.has(current.value);
    const childStates = current.children.map((child) => visit(child, forced));
    let state: CheckState;
    if (forced) state = 'checked';
    else if (childStates.length === 0) state = 'unchecked';
    else if (childStates.every((childState) => childState === 'checked')) state = 'checked';
    else if (childStates.some((childState) => childState !== 'unchecked')) state = 'mixed';
    else state = 'unchecked';
    if (first.get(current.value) === current) states.set(current.value, state);
    return state;
  };
  for (const top of nodes) visit(top, ancestorListed);
  return states;
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
  const checked = new Set<string>();
  for (const [itemValue, state] of states) {
    if (state === 'checked') checked.add(itemValue);
  }
  const known = new Set<string>();
  forEachNode(nodes, (candidate) => known.add(candidate.value));
  const unmatched = Array.from(new Set(listed.filter((listedValue) => !known.has(listedValue))));

  const path = findPath(nodes, value);
  if (path) {
    const target = path[path.length - 1];
    const turnOn = states.get(value) !== 'checked';
    forEachNode([target], (candidate) => {
      if (turnOn) checked.add(candidate.value);
      else checked.delete(candidate.value);
    });
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const ancestor = path[index];
      if (ancestor.children.every((child) => checked.has(child.value))) checked.add(ancestor.value);
      else checked.delete(ancestor.value);
    }
  } else {
    const at = unmatched.indexOf(value);
    if (at === -1) unmatched.push(value);
    else unmatched.splice(at, 1);
  }

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
