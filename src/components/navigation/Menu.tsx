import { MenuGroup, MenuGroupHeader } from './Menu.group';
import { MenuDivider, MenuItem } from './Menu.items';
import { MenuItemLink } from './Menu.link';
import { MenuPopover } from './Menu.popover';
import { MenuRoot } from './Menu.root';
import { MenuItemCheckbox, MenuItemRadio, MenuItemSwitch } from './Menu.selectable';
import { MenuSplitGroup } from './Menu.splitGroup';
import { MenuTrigger } from './Menu.trigger';

export type { MenuProps } from './Menu.root';
export type { MenuItemProps, MenuDividerProps } from './Menu.items';
export type { MenuTriggerProps, MenuTriggerComponentProps } from './Menu.trigger';
export type { MenuPopoverProps } from './Menu.popover';
export type {
  MenuItemSelectableProps,
  MenuItemCheckboxProps,
  MenuItemRadioProps,
  MenuItemSwitchProps,
} from './Menu.selectable';
export type { MenuItemLinkProps, MenuItemLinkOwnProps } from './Menu.link';
export type { MenuGroupProps, MenuGroupHeaderProps } from './Menu.group';
export type { MenuSplitGroupProps } from './Menu.splitGroup';

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
 *   opens returns focus there when it closes), unless `persistOnItemClick` (or the item's own
 *   `persistOnClick`) keeps it open. Open state is `open`/`defaultOpen`/`onOpenChange`. With
 *   `openOnHover` a mouse pointer resting on the trigger opens it without moving focus; with
 *   `openOnContext` the trigger is a context-menu region (a right click, Shift+F10 or the
 *   ContextMenu key opens the menu there).
 * - **Submenus** — a `<Menu>` rendered in a menu list (inside `Menu.Popover`, or among the items
 *   of a static menu) is a submenu. Its `Menu.Trigger` wraps a `Menu.Item`, which becomes the
 *   submenu's trigger item (`aria-haspopup="menu"`, a chevron that mirrors in RTL):
 *   ```tsx
 *   <Menu.Popover>
 *     <Menu>
 *       <Menu.Trigger><Menu.Item>Open recent</Menu.Item></Menu.Trigger>
 *       <Menu.Popover><Menu.Item>report.docx</Menu.Item></Menu.Popover>
 *     </Menu>
 *   </Menu.Popover>
 *   ```
 *   ArrowRight (ArrowLeft in RTL), Enter, Space, a click, or the mouse resting on the item opens
 *   the submenu (the keys and the click move focus to its first item); ArrowLeft (ArrowRight in
 *   RTL) and Escape close only that submenu and return focus to its item; item activation and Tab
 *   close every level and put focus on the root trigger (under a static menu, on the submenu's
 *   trigger item). One submenu of a menu is open at a time. It works in static menus too. A Menu
 *   inside a Popover or Dialog opened from an item is a root menu of its own, not a submenu.
 *   `Menu.SplitGroup` puts an action and the button of its submenu in one row.
 *
 * **Checked values**: `Menu.ItemCheckbox`, `Menu.ItemRadio` and `Menu.ItemSwitch` are bound by
 * `name` and `value` to the Menu's `checkedValues` (`defaultCheckedValues`,
 * `onCheckedValuesChange`), in static and popup menus alike: unlike `open`, they do not make a
 * Menu a popup menu. Space changes a checkable item and keeps the menu open; Enter and a click
 * change it and close a popup menu. A submenu shares its parent's checked values unless it sets
 * `checkedValues` or `defaultCheckedValues` of its own. `Menu.Group` and `Menu.GroupHeader` label
 * a set of items; `Menu.ItemLink` navigates. The item labels line up: once an item of a menu shows
 * a check or an icon, every item keeps that column.
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
 * `MenuPopover`, `MenuItemCheckbox`, `MenuItemRadio`, `MenuItemSwitch`, `MenuItemLink`,
 * `MenuGroup`, `MenuGroupHeader`, `MenuSplitGroup`): React Server Components import those, because
 * dotted access (`Menu.Item`) needs a client file.
 */
export const Menu = /* @__PURE__ */ Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
  Trigger: MenuTrigger,
  Popover: MenuPopover,
  ItemCheckbox: MenuItemCheckbox,
  ItemRadio: MenuItemRadio,
  ItemSwitch: MenuItemSwitch,
  ItemLink: MenuItemLink,
  Group: MenuGroup,
  GroupHeader: MenuGroupHeader,
  SplitGroup: MenuSplitGroup,
});

export {
  MenuItem,
  MenuDivider,
  MenuTrigger,
  MenuPopover,
  MenuItemCheckbox,
  MenuItemRadio,
  MenuItemSwitch,
  MenuItemLink,
  MenuGroup,
  MenuGroupHeader,
  MenuSplitGroup,
};
