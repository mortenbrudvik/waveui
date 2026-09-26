import * as React from 'react';
import { cn } from '../../lib/cn';
import { warnOnce } from '../../lib/dev';
import { disabledStyles, focusRingInset } from '../../lib/styles';

/*
 * Helpers and class strings shared by the Menu modules. Internal.
 */

/** The elements the roving hook of a menu list moves between. */
export const MENU_ITEM_SELECTOR =
  '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

/**
 * Typeahead matches an item's `data-roving-text`, else its whole text, which would start with the
 * icon's text (an emoji, an icon-font ligature) and end with the shortcut. A string label is
 * passed as `data-roving-text` when the item renders. Any other label (an i18n component) marks
 * its element with `data-menu-label`, and the menu copies that element's current text onto the
 * item right before it handles a printable key, so a label that re-renders on its own is matched
 * by what it shows.
 */
export function withTypeaheadText(
  handleKeyDownCapture: React.KeyboardEventHandler<HTMLDivElement>,
): React.KeyboardEventHandler<HTMLDivElement> {
  return (event) => {
    if (event.key.length === 1) {
      for (const label of event.currentTarget.querySelectorAll('[data-menu-label]')) {
        const menuItem = label.closest(MENU_ITEM_SELECTOR);
        menuItem?.setAttribute('data-roving-text', label.textContent ?? '');
      }
    }
    handleKeyDownCapture(event);
  };
}

/**
 * C-DEV: `Menu.Trigger`/`Menu.Popover` rendered by a static menu — the root only detects popup
 * mode from its direct children (Fragments included), so wrapped parts leave it static.
 */
export function useStaticMenuPartWarning(componentName: string, popup: boolean): void {
  React.useEffect(() => {
    if (popup) return;
    warnOnce(
      'Menu:static-popup-parts',
      `${componentName}: rendered inside a static menu. Menu switches to a popup menu only when Menu.Trigger or Menu.Popover is a direct child (Fragments included); wrapped in another element or component, they are rendered inside the static \`role="menu"\` element. Make them direct children of Menu, or pass \`open\`, \`defaultOpen\` or \`onOpenChange\` to Menu to force popup mode.`,
    );
  }, [componentName, popup]);
}

/**
 * The menu list element (the static root and every `Menu.Popover` surface). It is the named group
 * `group/menu` whose items show their checkmark and icon columns when any item of the list has
 * one, so the labels line up.
 */
export const menuSurfaceClasses =
  'group/menu min-w-[180px] rounded-md border border-border bg-background py-1 shadow-4';

/**
 * The popup surface is limited to the space the viewport leaves it next to the trigger (the CSS
 * variables usePopupPosition's `fitViewport` writes) and scrolls when it is taller. The limits are
 * classes, not inline styles, so a consumer `max-h-*`/`max-w-*` class replaces them (C-COMPOSE).
 */
export const menuPopoverClasses = cn(
  menuSurfaceClasses,
  'max-h-(--wave-popup-available-height) max-w-(--wave-popup-available-width) overflow-y-auto overscroll-contain',
);

/**
 * Every menu item row. An item whose submenu is open (`aria-expanded`) keeps its highlight; in
 * forced colors, where backgrounds are replaced, it shows a start bar instead (logical, so it
 * mirrors in RTL; the 4px bar plus `ps-2` keeps the `px-3` inset), which cannot be mistaken for
 * the focus ring's inset outline.
 */
export const menuItemClasses = cn(
  'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-body-1 text-foreground',
  'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:active:bg-subtle-pressed',
  // Gated like hover: a disabled item can still take focus from a mouse click (tabindex -1).
  'not-disabled:not-aria-disabled:focus:bg-subtle-hover',
  'aria-expanded:bg-subtle-hover',
  'forced-colors:aria-expanded:border-s-4 forced-colors:aria-expanded:border-[Highlight] forced-colors:aria-expanded:ps-2',
  focusRingInset,
  disabledStyles,
);
