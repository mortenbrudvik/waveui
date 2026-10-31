import * as React from 'react';
import { cn } from '../../lib/cn';
import { menuItemClassNames, menuItemLinkClassNames } from '../../lib/classNames';
import type { PolymorphicComponent, PolymorphicProps } from '../../lib/polymorphic';
import type { SlotPart } from '../../lib/slotProps';
import type { Slot } from '../../lib/types';
import { MenuItemRow, useMenuItemActivation, useMenuItemPlacementWarning } from './Menu.items';
import { menuItemClasses } from './Menu.shared';

/** The MenuItemLink's own props (the XOwnProps rule: component-specific props only). */
export interface MenuItemLinkOwnProps {
  /** Icon before the label (decorative); the rules of `Menu.Item.icon`. */
  icon?: Slot<'span'>;
  /** Keyboard shortcut text at the end of the item; the rules of `Menu.Item.shortcut`. */
  shortcut?: string;
  /**
   * Unavailable: `aria-disabled`, skipped by the arrow keys, never activated, and its click is
   * cancelled (`preventDefault()`, which router links respect). On the default `'a'` the `href`
   * is removed too, so it cannot navigate at all; with `as` (a router link) the component's own
   * `to` still renders an `href`, so middle click or "open in new tab" can still follow it:
   * render a disabled router link without its target.
   * @default false
   */
  disabled?: boolean;
  /** Label of the link. */
  children: React.ReactNode;
  /**
   * Props for the elements the item draws in its row, inside the link, by part, merged into each
   * part's own: your classes after the part's (yours win a conflict), your styles over its styles,
   * your attributes and handlers added, your ref attached. Every attribute the item sets on a part
   * is locked and keeps the item's value, and no part takes a role or the markers by which the
   * menu reads an item's row (the text typeahead matches, the check and icon columns its labels
   * line up by), so a part changes neither the menu's keyboard navigation nor its columns. A part
   * takes no `children` (the item draws their content); the link element itself takes the item's
   * own props, and the icon is `icon`. No part carries a handler of the item: an event on a part
   * reaches the link and its menu as one on the label does, after your handler, and
   * `preventDefault()` in yours skips their handling of it there too. A click you prevent neither
   * follows the link nor closes its menu, while the item's `onClick` is still called, as for a
   * prevented click on the label. Fluent UI's MenuItemLink gives these parts slots of their own
   * (`content`, `secondaryContent` for the shortcut).
   */
  slotProps?: {
    /**
     * The `<span>` of the label (`children`), which fills the row (stable classes
     * `wave-menu-item__content` and `wave-menu-item-link__content`). Locked: no role, and the
     * menu's markers (typeahead reads a label that is no string through this element).
     */
    content?: SlotPart<'span'>;
    /**
     * The `<span>` of `shortcut`, rendered while `shortcut` is set (stable classes
     * `wave-menu-item__shortcut` and `wave-menu-item-link__shortcut`). Locked: `dir` (`auto`, so
     * the text keeps its own direction and "Ctrl+," its order in a right-to-left menu), no role,
     * and the menu's markers.
     */
    shortcut?: SlotPart<'span'>;
  };
}

/** Props of {@link MenuItemLink} rendered as `C` (default `'a'`, or a router link component). */
export type MenuItemLinkProps<C extends React.ElementType = 'a'> = PolymorphicProps<
  C,
  MenuItemLinkOwnProps
>;

/** The props the implementation reads, for any `as`. */
type MenuItemLinkImplProps = MenuItemLinkOwnProps &
  Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'onKeyDown' | 'children'> & {
    as?: React.ElementType;
    ref?: React.Ref<HTMLElement>;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  };

/**
 * A menu item that navigates (`role="menuitem"` on the link element). Enter follows the link the
 * way the browser does (Shift+Enter, Ctrl+Enter and Cmd+Enter open a new window or tab), Space
 * follows it too, and every click follows it and closes a popup menu (focus returns to the
 * trigger first), a Ctrl- or Cmd-click that opens a new tab included; the Menu's
 * `persistOnItemClick` does not keep it open. Middle click and the browser's link context menu
 * keep working and close nothing. A consumer `onClick` that calls `preventDefault()` cancels the
 * navigation and keeps the menu open. In a static menu a click navigates and closes nothing. In
 * forced colors the browser draws the text in its link color (`LinkText`). Typeahead matches the
 * label (`children`). `as` takes a router link component, which must forward `ref` and spread its
 * props onto the anchor.
 *
 * Also exported as `MenuItemLink` (import the flat name from React Server Components).
 *
 * @example
 * <Menu.ItemLink href="/settings">Settings</Menu.ItemLink>
 * <Menu.ItemLink as={RouterLink} to="/billing">Billing</Menu.ItemLink>
 */
export const MenuItemLink: PolymorphicComponent<'a', MenuItemLinkOwnProps> = (props) => {
  const {
    as,
    icon,
    shortcut,
    disabled = false,
    children,
    className,
    onClick,
    onKeyDown,
    ref,
    slotProps,
    ...rest
  } = props as MenuItemLinkImplProps;
  const Component: React.ElementType = as ?? 'a';
  useMenuItemPlacementWarning('Menu.ItemLink');

  // Enter is the browser's (a link keeps Shift, Ctrl and Meta for a new window or tab); Space
  // clicks it. Every activation closes the popup menu: a navigation ends the menu's job.
  const activation = useMenuItemActivation({
    disabled,
    persistOnClick: false,
    onClick,
    onKeyDown,
    nativeEnter: true,
  });

  // Typeahead text: a string label directly; any other label through its marked element.
  const stringLabel = typeof children === 'string' ? children : undefined;
  const ownRovingText = (rest as Record<string, unknown>)['data-roving-text'] !== undefined;
  // A disabled element link cannot navigate at all (middle click, "open in new tab" included); a
  // router link keeps what its own props render, and its prevented click stops it.
  const disabledHref = disabled && typeof Component === 'string' ? { href: undefined } : null;

  return (
    <Component
      role="menuitem"
      data-roving-text={stringLabel}
      {...rest}
      {...disabledHref}
      ref={ref}
      aria-disabled={disabled ? true : rest['aria-disabled']}
      data-disabled={disabled ? '' : undefined}
      onClick={activation.onClick}
      onKeyDown={activation.onKeyDown}
      className={cn(
        menuItemClassNames.root,
        menuItemLinkClassNames.root,
        menuItemClasses,
        'text-foreground no-underline',
        className,
      )}
    >
      <MenuItemRow
        icon={icon}
        label={children}
        shortcut={shortcut}
        markLabel={!ownRovingText}
        partClassNames={{
          icon: cn(menuItemClassNames.icon, menuItemLinkClassNames.icon),
          content: cn(menuItemClassNames.content, menuItemLinkClassNames.content),
          shortcut: cn(menuItemClassNames.shortcut, menuItemLinkClassNames.shortcut),
        }}
        parts={slotProps}
      />
    </Component>
  );
};
MenuItemLink.displayName = 'MenuItemLink';
