import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { flattenChildren, isElementOfType } from '../../lib/children';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { MenuItem } from './Menu.items';
import { MenuRoot } from './Menu.root';
import { MENU_ITEM_SELECTOR } from './Menu.shared';

/** Properties for the MenuSplitGroup sub-component. */
export interface MenuSplitGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A `Menu.Item` (the main action) followed by a submenu `<Menu>` whose `Menu.Trigger` wraps a
   * `Menu.Item` with an `aria-label` and no children, which shows only the submenu chevron:
   * `<Menu><Menu.Trigger><Menu.Item aria-label="More save options" /></Menu.Trigger>
   * <Menu.Popover>…</Menu.Popover></Menu>`.
   */
  children: React.ReactNode;
  /** Ref to the `role="group"` row. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Whether the direct children (Fragments included, Server Component references too) hold a
 * `Menu.Item` followed by a `<Menu>`.
 */
function hasActionAndSubmenu(children: React.ReactNode): boolean {
  const nodes = flattenChildren(children).map(({ node }) => node);
  return nodes.some(
    (node, index) => isElementOfType(node, MenuItem) && isElementOfType(nodes[index + 1], MenuRoot),
  );
}

/** The menu items that are the row's own children (the action first, the submenu half last). */
function rowItems(row: HTMLElement): HTMLElement[] {
  return Array.from(row.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.matches(MENU_ITEM_SELECTOR),
  );
}

/**
 * One row with a main action and a button that opens a submenu (`role="group"` holding two menu
 * items). ArrowDown and ArrowUp visit both halves; ArrowRight (ArrowLeft in RTL) moves from the
 * action to the submenu button, and on the button opens the submenu; ArrowLeft (ArrowRight in RTL)
 * moves back. The submenu half is a `Menu.Item` without children, named by its `aria-label`; it
 * shows only the submenu chevron, after a divider line. Activating the action closes the menu like
 * any item. It works the same inside a static menu.
 *
 * Also exported as `MenuSplitGroup` (import the flat name from React Server Components).
 *
 * @example
 * <Menu.SplitGroup>
 *   <Menu.Item onClick={save}>Save</Menu.Item>
 *   <Menu>
 *     <Menu.Trigger><Menu.Item aria-label="More save options" /></Menu.Trigger>
 *     <Menu.Popover><Menu.Item onClick={saveAs}>Save as…</Menu.Item></Menu.Popover>
 *   </Menu>
 * </Menu.SplitGroup>
 */
export const MenuSplitGroup = ({
  children,
  className,
  onKeyDown,
  ref,
  ...rest
}: MenuSplitGroupProps) => {
  // C-DEV: the row needs its action and its submenu to work as one.
  const complete = hasActionAndSubmenu(children);
  React.useEffect(() => {
    if (complete) return;
    warnOnce(
      'Menu.SplitGroup:children',
      'Menu.SplitGroup: expected a Menu.Item (the action) followed by a submenu <Menu> whose Menu.Trigger wraps a Menu.Item with an aria-label (its direct children, Fragments included).',
    );
  }, [complete]);

  // Inside the row, "next" (ArrowRight, ArrowLeft in RTL) moves from the action to the submenu
  // half and "previous" back; "next" on the half is its trigger's (it opens the submenu, so the
  // key arrives here already handled). Keys from the submenu (a portal) are not the row's.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (!intent) return;
    const items = rowItems(event.currentTarget);
    if (items.length < 2) return;
    const action = items[0];
    const half = items[items.length - 1];
    const [from, to] = intent === 'next' ? [action, half] : [half, action];
    if (event.target !== from || to.getAttribute('aria-disabled') === 'true') return;
    event.preventDefault();
    to.focus();
  };

  return (
    <div
      role="group"
      {...rest}
      ref={ref}
      data-menu-split-group=""
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      className={cn(
        'flex items-stretch [&>:first-child]:flex-1 [&>:last-child]:border-s [&>:last-child]:border-border',
        className,
      )}
    >
      {children}
    </div>
  );
};
MenuSplitGroup.displayName = 'MenuSplitGroup';
