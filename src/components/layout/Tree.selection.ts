import * as React from 'react';
import { getElementType } from '../../lib/children';
import type { TreeNode } from '../../lib/treeCascade';

export { computeCheckStates, toggleCheck } from '../../lib/treeCascade';
export type { CheckState, TreeNode } from '../../lib/treeCascade';

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
