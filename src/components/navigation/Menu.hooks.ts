import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import {
  MenuListElementContext,
  useMenuContext as useMenuState,
  useMenuListContext as useMenuListState,
} from './Menu.context';
import type {
  MenuContextValue as InternalMenuContextValue,
  MenuListContextValue as InternalMenuListContextValue,
} from './Menu.context';

/*
 * The public hooks of Menu for items and other content of your own (P13-02, R14): narrow views of
 * the menu and of its list, mapped from the internal contexts of `Menu.context.ts`, whose objects
 * and values stay internal (R11). Imports no component.
 */

/** The state of a `Menu` that {@link useMenuContext} returns. */
export interface MenuContextValue {
  /**
   * Whether the popup menu is open. It is `false` as soon as the menu closes, also while its
   * surface still plays its exit motion, and in the server HTML (a popup menu renders only in the
   * browser). A static menu has no open state: always `false`.
   */
  open: boolean;
  /**
   * Closes the menu as activating one of its items does: focus moves where the item would move it
   * (the trigger of the outermost popup menu; for a context menu, the element focused at the
   * gesture) when it is inside the menus or lost, then every open menu of the chain closes, the
   * innermost submenu first, each calling its `onOpenChange(false)` once. In a static menu it
   * closes nothing, as its items close nothing; in a submenu of a static menu it closes that
   * submenu and returns focus to its trigger item. The same function for the life of the menu.
   */
  close: () => void;
  /**
   * Whether the menu is a submenu: a `Menu` rendered among the items of another menu (inside its
   * `Menu.Popover` or a static `Menu`), with no portal between them.
   */
  isSubmenu: boolean;
}

/** The state of a menu list that {@link useMenuListContext} returns. */
export interface MenuListContextValue {
  /**
   * Whether the list shows the icon column: `true` while an item of the list shows an icon, when
   * every built-in item without one keeps an empty column of that width (20px) before its label.
   */
  hasIcons: boolean;
  /**
   * Whether the list shows the check column: `true` while the list holds a `Menu.ItemCheckbox` or
   * `Menu.ItemRadio`, when every other built-in item keeps an empty column of that width (16px)
   * first in its row. A `Menu.ItemSwitch` draws its switch at the end instead.
   */
  hasCheckmarks: boolean;
}

/**
 * The public view of `menu` for content that renders in `list`: `close` is the list's own close
 * when the content renders among the items of that menu (the function an item activation calls),
 * else the menu's close of its chain (content of a submenu outside its list: its trigger item).
 */
function toMenuContextValue(
  menu: InternalMenuContextValue,
  list: InternalMenuListContextValue | null,
): MenuContextValue {
  return {
    open: menu.open,
    close: list !== null && list.menu === menu ? list.closeFromItem : menu.closeChain,
    isSubmenu: menu.isSubmenu,
  };
}

/**
 * The state of the surrounding `Menu`, for an item or other content of your own inside it: `open`,
 * `close()` to close the menu as an item does, and `isSubmenu`. It is a narrow view of the menu
 * (its context object is not public), the same object while none of the three changes. The
 * nearest `Menu` answers: inside a submenu (its `Menu.Popover`, or the item in its `Menu.Trigger`),
 * the submenu.
 *
 * An element of your own with `role="menuitem"` inside `Menu.Popover` or a static `Menu` is an item
 * of that menu: the arrow keys, Home, End and typeahead move focus to it (typeahead matches its
 * text, or a `data-roving-text` attribute you give it), the mouse pointer focuses it while focus is
 * in the menu, and `aria-disabled="true"` makes the keys skip it. The menu manages its `tabIndex`,
 * so render none. The element activates itself: handle its click (skip one whose default was
 * prevented), make Enter and Space click it (only while the element itself has focus, and skip a
 * key whose default was prevented: the menu prevents a Space that continues a typeahead search),
 * and call `close()` after its action. While it is disabled, render `aria-disabled="true"` and
 * ignore its click and keys. Its content is presentational, as a built-in item's: put no link,
 * button or other control inside it. `useMenuListContext` tells it which columns to keep, so its
 * label lines up with the built-in items.
 *
 * Must be called inside a `Menu`: outside one it throws in development and, in production, logs
 * once and returns an inert value (closed, not a submenu, `close` does nothing).
 *
 * Fluent UI's counterpart is `useMenuContext_unstable(selector)`, which selects from the whole menu
 * context and returns default values outside a menu; its items close the menu through the
 * context's `setOpen(event, { open: false, bubble: true, … })`.
 *
 * @example
 * function TemplateItem({ title, onSelect }: { title: string; onSelect: () => void }) {
 *   const { close } = useMenuContext();
 *   return (
 *     <div
 *       role="menuitem"
 *       onClick={(event) => {
 *         if (event.defaultPrevented) return;
 *         onSelect();
 *         close();
 *       }}
 *       onKeyDown={(event) => {
 *         if (event.defaultPrevented || event.target !== event.currentTarget) return;
 *         if (event.key !== 'Enter' && event.key !== ' ') return;
 *         event.preventDefault();
 *         event.currentTarget.click();
 *       }}
 *     >
 *       {title}
 *     </div>
 *   );
 * }
 */
export function useMenuContext(): MenuContextValue {
  const menu = useMenuState('useMenuContext');
  const list = useMenuListState();
  const { open, close, isSubmenu } = toMenuContextValue(menu, list);
  return React.useMemo(() => ({ open, close, isSubmenu }), [open, close, isSubmenu]);
}

/** The columns of a list, as bits: the icon column `1`, the check column `2`. */
const ICON_COLUMN = 1;
const CHECK_COLUMN = 2;

/** The columns the list element shows: the attributes its built-in rows mark them with. */
function readColumns(element: HTMLElement | null): number {
  if (!element) return 0;
  return (
    (element.querySelector('[data-menu-icon]') ? ICON_COLUMN : 0) |
    (element.querySelector('[data-menu-checkmark]') ? CHECK_COLUMN : 0)
  );
}

const noop = () => {};

/** Calls `onChange` when an element is added to or removed from the list, or changes its marks. */
function observeColumns(element: HTMLElement, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(element, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-menu-icon', 'data-menu-checkmark'],
  });
  return () => observer.disconnect();
}

const getServerColumns = () => 0;

/**
 * The columns of the surrounding menu list, for an item of your own (see `useMenuContext`): with
 * `hasIcons`, keep a 20px box before your label (your icon, or empty), and with `hasCheckmarks`, a
 * 16px one first, with the row's 8px gaps, so your label starts where the built-in labels do. It
 * is a narrow view of the list, the same object while neither changes.
 *
 * The values follow the built-in items as they render: an item that adds or removes an icon or a
 * check column updates them. They are `false` in the server HTML, and become right once the list
 * has mounted, before the browser paints it. Items of your own do not count: a list whose only
 * icon is yours does not make the built-in items keep the icon column. A static `Menu` nested in
 * another menu's list is a list of its own: inside it, the values report its own items only.
 *
 * Must be called inside a menu list, `Menu.Popover` or a static `Menu` (in a popup `Menu`, outside
 * its `Menu.Popover`, there is none): outside one it throws in development and, in production,
 * logs once and returns `false` for both. React context crosses portals, so in a root popup `Menu`
 * inside a Popover or Dialog opened from another menu's item, a call outside the root menu's own
 * `Menu.Popover` (in its trigger, say) finds the outer menu's list and reports its columns.
 *
 * Fluent UI's counterpart is `useMenuListContext_unstable(selector)`, whose `hasIcons` and
 * `hasCheckmarks` are props you set on `Menu` or `MenuList`; WaveUI finds them from the items.
 *
 * @example
 * // The columns before the label of an item of your own (in its row, a flex container).
 * function ColumnSpacers() {
 *   const { hasIcons, hasCheckmarks } = useMenuListContext();
 *   return (
 *     <>
 *       {hasCheckmarks && <span aria-hidden="true" style={{ width: 16, flexShrink: 0 }} />}
 *       {hasIcons && <span aria-hidden="true" style={{ width: 20, flexShrink: 0 }} />}
 *     </>
 *   );
 * }
 */
export function useMenuListContext(): MenuListContextValue {
  const list = useMenuListState();
  if (list === null) reportMissingContext('useMenuListContext', 'Menu.Popover or a static Menu');
  const element = React.useContext(MenuListElementContext);
  const subscribe = React.useCallback(
    (onChange: () => void) => (element ? observeColumns(element, onChange) : noop),
    [element],
  );
  const columns = React.useSyncExternalStore(
    subscribe,
    () => readColumns(element),
    getServerColumns,
  );
  const hasIcons = (columns & ICON_COLUMN) !== 0;
  const hasCheckmarks = (columns & CHECK_COLUMN) !== 0;
  return React.useMemo(() => ({ hasIcons, hasCheckmarks }), [hasIcons, hasCheckmarks]);
}
