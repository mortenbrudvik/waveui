import { MenuDivider, MenuItem } from './Menu.items';
import { MenuPopover } from './Menu.popover';
import { MenuRoot } from './Menu.root';
import { MenuTrigger } from './Menu.trigger';

export type { MenuProps } from './Menu.root';
export type { MenuItemProps, MenuDividerProps } from './Menu.items';
export type { MenuTriggerProps, MenuTriggerComponentProps } from './Menu.trigger';
export type { MenuPopoverProps } from './Menu.popover';

/**
 * A menu of actions (`role="menu"`), in one of two forms:
 *
 * - **Static menu** — `Menu.Item`/`Menu.Divider` children render inline inside the `role="menu"`
 *   element. The menu itself is not a tab stop: one item is (the last focused enabled item, else
 *   the first enabled one). When every item is disabled, the menu element holds the tab stop
 *   instead, so keyboard and screen-reader users still reach it. Arrow keys, Home/End and
 *   typeahead move between enabled items; Enter and Space activate the focused item (a Space typed
 *   within 500 ms of a typeahead character continues the search instead).
 * - **Popup menu** — with `Menu.Trigger` and `Menu.Popover` children, or whenever `open`,
 *   `defaultOpen` or `onOpenChange` is passed (even `false`), the root renders no element of its
 *   own: the trigger opens the portaled `Menu.Popover`, item activation returns focus to the
 *   trigger and closes it (focus is on the trigger before the menu goes, so a Dialog the item
 *   opens returns focus there when it closes). Open state is `open`/`defaultOpen`/`onOpenChange`.
 *
 * **Popup detection**: Menu looks for `Menu.Trigger`/`Menu.Popover` (also under their flat names
 * from a Server Component) among its direct children and inside Fragments only. When they are
 * wrapped in another element or component, pass `open`, `defaultOpen` or `onOpenChange` to force
 * popup mode; otherwise the static `role="menu"` element is rendered around them (development
 * warning). A popup menu renders no root element, so `className`, `ref` and other DOM props on
 * `Menu` are ignored (development warning): put them on `Menu.Popover`. Items rendered in a popup
 * menu outside `Menu.Popover` have no `role="menu"` parent (development warning).
 *
 * Sub-components are also exported under flat names (`MenuItem`, `MenuDivider`, `MenuTrigger`,
 * `MenuPopover`): React Server Components import those, because dotted access (`Menu.Item`)
 * needs a client file.
 */
export const Menu = /* @__PURE__ */ Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
  Trigger: MenuTrigger,
  Popover: MenuPopover,
});

export { MenuItem, MenuDivider, MenuTrigger, MenuPopover };
