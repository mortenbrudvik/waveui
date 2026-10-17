import { TreeItem, TreeRoot } from './Tree.core';

export type { TreeCheckedItemsChangeDetails, TreeItemProps, TreeProps } from './Tree.core';

/**
 * A hierarchical list (WAI-ARIA Tree View pattern) with a single tab stop: Up/Down move between
 * visible items, Home/End to the first/last, Right expands or moves to the first child, Left
 * collapses or moves to the parent (both mirrored in RTL), Enter activates (and toggles a
 * parent), and so does Space unless the tree has checkboxes, `*` expands the siblings, and typing
 * jumps to an item by its text.
 *
 * Keyboard focus enters at the `selected` item, else the first item; while focus is inside, the
 * tab stop follows it, so Shift+Tab leaves the tree.
 *
 * `selectionMode="multiple"` draws a checkbox on every item, bound to `checkedItems`: Space
 * toggles the focused item's check, a click on the checkbox toggles it, and a click elsewhere on
 * the row activates the item (as Enter does). Checks cascade: checking an item checks every item
 * nested in it, and an item shows checked when all of its nested items are checked, mixed when
 * some are. `onCheckedItemsChange` receives every checked item in tree order (fully checked parents
 * included), followed by listed values that match no item, and `details` (`value`, `checked`,
 * `event`).
 *
 * Items are `Tree.Item` elements; nested items are written in their parent's children (directly,
 * in Fragments, or returned by a render function), not rendered by a component of their own.
 * Every item needs a `value` that is unique within the Tree.
 *
 * `Tree.Item` is also exported as `TreeItem` for React Server Components, which cannot use the
 * dotted form.
 */
export const Tree = /* @__PURE__ */ Object.assign(TreeRoot, {
  Item: TreeItem,
});

export { TreeItem };
