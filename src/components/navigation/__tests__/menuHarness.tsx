/**
 * Test harness for Menu items: renders them as the items of a menu list, with the Menu and list
 * contexts a real menu provides, without `Menu.root.tsx`, `Menu.trigger.tsx` or
 * `Menu.popover.tsx`. Item tests use it, so they do not depend on the popup modules.
 *
 * Test-only (a `__tests__` module): excluded from the library program and the build, type-checked
 * by `tsconfig.dev.json`.
 *
 * - The Menu context is a popup menu for a popover list (`popup` and `open` are `true`) and a static
 *   menu for a static list; its checked values are a real `useCheckedValues` state, its
 *   `persistOnItemClick` is the option, `parent` is `null` and every other member is inert
 *   (`INERT_MENU_CONTEXT`).
 * - The list context: `isStatic`, `portalDepth` from the surrounding `PortalDepthContext` (the
 *   depth the items see: the harness renders inline), a real `useCheckableRegistry()` and, for a
 *   popover list, the `closeFromItem` spy; any other member is inert (`INERT_MENU_LIST_CONTEXT`).
 *   A static list ignores close requests, as the static root does, so the spy is never called for
 *   one.
 * - The list element: `<div role="menu" aria-label="Test menu" data-roving-container>` with the
 *   Menu surface classes (`group/menu` included), the static root's roving options and the
 *   typeahead text of `withTypeaheadText`.
 *
 * @example
 * const { closeFromItem } = renderInMenuList(<MenuItem>Save</MenuItem>);
 * await userEvent.click(screen.getByRole('menuitem', { name: 'Save' }));
 * expect(closeFromItem).toHaveBeenCalledTimes(1);
 *
 * @example
 * // Server HTML and hydration.
 * const html = renderToString(<MenuListHarness isStatic><MenuItem>Save</MenuItem></MenuListHarness>);
 */
import * as React from 'react';
import { render, within } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { cn } from '../../../lib/cn';
import type { CheckedValues, CheckedValuesChangeHandler } from '../../../lib/types';
import { useCheckedValues } from '../../../hooks/useCheckedValues';
import { useRovingTabIndex } from '../../../hooks/useRovingTabIndex';
import { PortalDepthContext } from '../../portal/Portal';
import {
  INERT_MENU_CONTEXT,
  INERT_MENU_LIST_CONTEXT,
  MenuContext,
  MenuListContext,
  MenuSubmenuTriggerContext,
  useCheckableRegistry,
} from '../Menu.context';
import type { MenuContextValue, MenuListContextValue } from '../Menu.context';
import { MENU_ITEM_SELECTOR, menuSurfaceClasses, withTypeaheadText } from '../Menu.shared';

/** Options of {@link renderInMenuList}. */
export interface MenuListHarnessOptions {
  /** A static list (activation closes nothing) or a popover list. @default false */
  isStatic?: boolean;
  /**
   * The list's close request; assert calls on it. A static list ignores it (never called).
   * @default vi.fn()
   */
  closeFromItem?: () => void;
  /** The Menu's controlled checked values. */
  checkedValues?: CheckedValues;
  /** The Menu's initial checked values. */
  defaultCheckedValues?: CheckedValues;
  /** The Menu's checked-values callback. */
  onCheckedValuesChange?: CheckedValuesChangeHandler;
  /** The Menu's `persistOnItemClick`. @default false */
  persistOnItemClick?: boolean;
  /** Wraps the list in `MenuSubmenuTriggerContext` for the dormant submenu path. */
  submenuTrigger?: boolean;
  /** Passed on to `render` (e.g. `wrapper` for RTL through `WaveProvider`). */
  renderOptions?: RenderOptions;
}

const noop = () => {};

/** The same tree as an element, for `renderToString` and `hydrateRoot`. */
export function MenuListHarness({
  isStatic = false,
  closeFromItem = noop,
  checkedValues,
  defaultCheckedValues,
  onCheckedValuesChange,
  persistOnItemClick = false,
  submenuTrigger = false,
  children,
}: Omit<MenuListHarnessOptions, 'renderOptions'> & { children: React.ReactNode }) {
  const checked = useCheckedValues(checkedValues, defaultCheckedValues, onCheckedValuesChange);
  // Every other member is inert (the inert context also covers members added later).
  const menu = React.useMemo<MenuContextValue>(
    () => ({
      ...INERT_MENU_CONTEXT,
      popup: !isStatic,
      open: !isStatic,
      parent: null,
      checked,
      persistOnItemClick,
    }),
    [isStatic, checked, persistOnItemClick],
  );

  const portalDepth = React.useContext(PortalDepthContext);
  const registerCheckable = useCheckableRegistry();
  const list = React.useMemo<MenuListContextValue>(
    () => ({
      ...INERT_MENU_LIST_CONTEXT,
      menu,
      isStatic,
      portalDepth,
      closeFromItem: isStatic ? noop : closeFromItem,
      registerCheckable,
    }),
    [menu, isStatic, portalDepth, closeFromItem, registerCheckable],
  );

  const {
    containerProps: { ref: rovingRef },
    handleKeyDown,
    handleKeyDownCapture,
    handleFocus,
  } = useRovingTabIndex({
    orientation: 'vertical',
    loop: true,
    typeahead: true,
    tabStop: 'last-focused',
    manageTabIndex: true,
    itemSelector: MENU_ITEM_SELECTOR,
  });

  return (
    <MenuContext.Provider value={menu}>
      <MenuListContext.Provider value={list}>
        <MenuSubmenuTriggerContext.Provider value={submenuTrigger}>
          <div
            role="menu"
            aria-label="Test menu"
            ref={rovingRef}
            data-roving-container=""
            onKeyDown={handleKeyDown}
            onKeyDownCapture={withTypeaheadText(handleKeyDownCapture)}
            onFocus={handleFocus}
            className={cn(menuSurfaceClasses)}
          >
            {children}
          </div>
        </MenuSubmenuTriggerContext.Provider>
      </MenuListContext.Provider>
    </MenuContext.Provider>
  );
}
MenuListHarness.displayName = 'MenuListHarness';

/**
 * Renders `ui` as the items of a menu list: the Menu and list contexts, and the list element.
 * `rerender` keeps the harness (with the options of this call) around the new ui. The returned
 * `closeFromItem` is a spy that calls the given function through; `list` is the list element.
 */
export function renderInMenuList(
  ui: React.ReactNode,
  options: MenuListHarnessOptions = {},
): RenderResult & { closeFromItem: Mock; list: HTMLElement } {
  const { closeFromItem: onClose, renderOptions = {}, ...harness } = options;
  const closeFromItem = vi.fn(onClose ?? noop);
  const { wrapper: Outer, ...rest } = renderOptions;
  function MenuListHarnessWrapper({ children }: { children: React.ReactNode }) {
    const tree = (
      <MenuListHarness {...harness} closeFromItem={closeFromItem}>
        {children}
      </MenuListHarness>
    );
    return Outer ? <Outer>{tree}</Outer> : tree;
  }
  const result = render(ui, { ...rest, wrapper: MenuListHarnessWrapper });
  const list = within(result.container).getByRole('menu', { name: 'Test menu' });
  return { ...result, closeFromItem, list };
}
