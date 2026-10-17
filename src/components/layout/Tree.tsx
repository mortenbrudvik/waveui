import { TreeItem, TreeRoot } from './Tree.core';
import { TreeItemPersonaLayout } from './Tree.itemPersonaLayout';

export type { TreeCheckedItemsChangeDetails, TreeItemProps, TreeProps } from './Tree.core';
export type { TreeItemPersonaLayoutProps } from './Tree.itemPersonaLayout';

/**
 * A hierarchical list (WAI-ARIA Tree View pattern) with a single tab stop: Up/Down move between
 * visible items, Home/End to the first/last, Right expands or moves to the first child (or into
 * the row's actions, see below), Left collapses or moves to the parent (both mirrored in RTL),
 * Enter activates (and toggles a parent), and so does Space unless the tree has checkboxes, `*`
 * expands the siblings, and typing jumps to an item by its text.
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
 * Row content: `actions` (buttons at the end of the row, in a toolbar named by the item, shown on
 * hover and focus, and always where there is no hover or colors are forced), `aside` (a count or a
 * badge that describes the item), `iconAfter` and `expandIcon`. Tab from the focused item enters
 * its actions and Shift+Tab returns. Keys and clicks on the actions never activate or check the
 * item. With `navigationMode="treegrid"`, Right (Left in right-to-left layouts) moves from an
 * item into its actions and Left returns, the actions take no Tab stop, and on an open parent Right
 * moves into its actions rather than to its first child (Down does); the roles stay `tree` and
 * `treeitem`.
 *
 * Items are `Tree.Item` elements; nested items are written in their parent's children (directly,
 * in Fragments, or returned by a render function), not rendered by a component of their own.
 * Every item needs a `value` that is unique within the Tree. `Tree.ItemPersonaLayout` lays out a
 * person (media, name and description) as an item's label.
 *
 * `Tree.Item` and `Tree.ItemPersonaLayout` are also exported as `TreeItem` and
 * `TreeItemPersonaLayout` for React Server Components, which cannot use the dotted form.
 */
export const Tree = /* @__PURE__ */ Object.assign(TreeRoot, {
  Item: TreeItem,
  ItemPersonaLayout: TreeItemPersonaLayout,
});

export { TreeItem, TreeItemPersonaLayout };
