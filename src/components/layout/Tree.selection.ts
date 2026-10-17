import * as React from 'react';
import { getElementType } from '../../lib/children';

/** One Tree.Item of the cascade model: its value and the items nested in it. */
export interface TreeNode {
  value: string;
  children: TreeNode[];
}

/** The check state of an item in a `selectionMode="multiple"` tree. */
export type CheckState = 'checked' | 'mixed' | 'unchecked';

/** The element types the scan compares with: the item type, and the tree type (a tree of its own). */
export interface TreeElementTypes {
  item: unknown;
  tree: unknown;
}

interface ItemElementProps {
  value?: unknown;
  leaf?: unknown;
  children?: React.ReactNode;
}

/**
 * The Tree.Item elements among `children`, recursively and in element order: the rule that forms
 * an item's child group (items written directly, in Fragments, or returned by a render function),
 * so the items of a collapsed item count too. A `leaf` item has none; a nested tree is a tree of
 * its own; any other element is not entered (an item that a component renders is not part of a
 * child group). A lazy type whose code is still loading is skipped instead of suspending the
 * caller (`getElementType(…, { suspend: false })`, as walks deeper than the direct children do).
 */
export function collectItems(children: React.ReactNode, types: TreeElementTypes): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const node of React.Children.toArray(children)) {
    if (!React.isValidElement<ItemElementProps>(node)) continue;
    const type = getElementType(node, { suspend: false });
    if (type === React.Fragment) {
      // Flattened here rather than through `flattenChildren`, which resolves lazy types with
      // suspending: a Fragment's items belong to the enclosing group.
      nodes.push(...collectItems(node.props.children, types));
      continue;
    }
    if (type === types.tree || type !== types.item) continue;
    const { value, leaf, children: nested } = node.props;
    if (typeof value !== 'string') continue;
    nodes.push({ value, children: leaf === true ? [] : collectItems(nested, types) });
  }
  return nodes;
}

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
