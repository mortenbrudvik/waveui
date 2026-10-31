import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  MenuColumnSpacers,
  MenuItem,
  MenuItemRow,
  useMenuItemActivation,
  useMenuItemPlacementWarning,
} from '../Menu.items';
import type { MenuItemActivationOptions, MenuItemProps } from '../Menu.items';
import { INERT_MENU_CONTEXT, MenuContext, useMenuListContext } from '../Menu.context';
import { Menu } from '../Menu';
import { useMenuListContext as usePublicMenuListContext } from '../Menu.hooks';
import type { MenuListContextValue } from '../Menu.hooks';
import { menuItemClassNames } from '../../../lib/classNames';
import { expectInertSlotProps, expectNoA11yViolations, openingTags } from '../../../test-utils';
import { MenuListHarness, renderInMenuList } from './menuHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

const item = (name: string) => screen.getByRole('menuitem', { name });

const CHECKMARK_SPACE = 'hidden w-4 shrink-0 group-has-[[data-menu-checkmark]]/menu:inline-flex';
const ICON_SPACE = 'hidden h-5 w-5 shrink-0 group-has-[[data-menu-icon]]/menu:inline-flex';

/** What each child element of a row is: its column marker, else its text. */
function describeRow(row: Element): string[] {
  return Array.from(row.children).map((child) => {
    if (child.hasAttribute('data-menu-column-space')) {
      return `space:${child.getAttribute('data-menu-column-space')}`;
    }
    if (child.hasAttribute('data-menu-checkmark')) return 'checkmark';
    if (child.hasAttribute('data-menu-icon')) return 'icon';
    if (child.hasAttribute('data-testid')) return `testid:${child.getAttribute('data-testid')}`;
    return `text:${child.textContent}`;
  });
}

describe('MenuItemRow and the column alignment', () => {
  it('renders the checkmark column, the icon column, the label, the shortcut and the end content in this order', () => {
    renderInMenuList(
      <div role="menuitem" tabIndex={-1}>
        <MenuItemRow
          checkmark={<span data-testid="glyph" />}
          icon={{ children: 'I' }}
          label="Save"
          shortcut="Ctrl+S"
          end={<span data-testid="end" />}
        />
      </div>,
    );
    expect(describeRow(screen.getByRole('menuitem'))).toEqual([
      'checkmark',
      'icon',
      'text:Save',
      'text:Ctrl+S',
      'testid:end',
    ]);
  });

  it('the shortcut takes its direction from its own text (dir="auto"), so "Ctrl+," keeps its order in RTL', () => {
    renderInMenuList(<MenuItem shortcut="Ctrl+,">Settings</MenuItem>, {
      dir: 'rtl',
    });
    expect(screen.getByRole('menuitem').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    const shortcut = screen.getByText('Ctrl+,');
    expect(shortcut).toHaveAttribute('dir', 'auto');
    expect(shortcut).toHaveClass('ms-4', 'text-caption-1', 'text-muted-foreground');
  });

  it('a plain item renders hidden checkmark and icon placeholders that show when the list has the column', () => {
    renderInMenuList(<MenuItem>Paste</MenuItem>);
    const row = item('Paste');
    expect(describeRow(row)).toEqual(['space:checkmark', 'space:icon', 'text:Paste']);
    const [checkmarkSpace, iconSpace] = Array.from(row.children);
    expect(checkmarkSpace).toHaveAttribute('aria-hidden', 'true');
    expect(checkmarkSpace).toHaveClass(...CHECKMARK_SPACE.split(' '));
    expect(iconSpace).toHaveAttribute('aria-hidden', 'true');
    expect(iconSpace).toHaveClass(...ICON_SPACE.split(' '));
    // The placeholders are not part of the name or of the typeahead text.
    expect(row).toHaveAccessibleName('Paste');
    expect(row).toHaveAttribute('data-roving-text', 'Paste');
  });

  it('an icon item marks its icon box data-menu-icon and keeps only the checkmark placeholder', () => {
    renderInMenuList(<MenuItem icon={{ children: 'I' }}>Cut</MenuItem>);
    const row = item('Cut');
    expect(describeRow(row)).toEqual(['space:checkmark', 'icon', 'text:Cut']);
    const iconBox = row.querySelector('[data-menu-icon]');
    expect(iconBox).toHaveAttribute('aria-hidden', 'true');
    expect(iconBox).toHaveClass('flex', 'h-5', 'w-5', 'shrink-0', 'items-center', 'justify-center');
    expect(row).toHaveAccessibleName('Cut');
  });

  it('a checkable row renders its checkmark column in both states: the glyph while checked, empty while not', () => {
    renderInMenuList(
      <>
        <div role="menuitemcheckbox" aria-checked="true" tabIndex={-1}>
          <MenuItemRow checkmark={<svg data-testid="glyph" />} label="Ruler" />
        </div>
        <div role="menuitemcheckbox" aria-checked="false" tabIndex={-1}>
          <MenuItemRow checkmark={null} label="Grid" />
        </div>
      </>,
    );
    const checkedRow = screen.getByRole('menuitemcheckbox', { name: 'Ruler' });
    const uncheckedRow = screen.getByRole('menuitemcheckbox', { name: 'Grid' });
    expect(describeRow(checkedRow)).toEqual(['checkmark', 'space:icon', 'text:Ruler']);
    expect(describeRow(uncheckedRow)).toEqual(['checkmark', 'space:icon', 'text:Grid']);
    const column = checkedRow.querySelector('[data-menu-checkmark]');
    expect(column).toHaveAttribute('aria-hidden', 'true');
    expect(column).toHaveClass('inline-flex', 'w-4', 'shrink-0', 'items-center', 'justify-center');
    expect(column).toContainElement(screen.getByTestId('glyph'));
    expect(uncheckedRow.querySelector('[data-menu-checkmark]')).toBeEmptyDOMElement();
  });

  it.each([
    ['no label', undefined],
    ['an empty string', ''],
    ['a list of nothing', [null, false]],
  ])('a row whose label renders nothing (%s) renders no placeholders', (_kind, label) => {
    renderInMenuList(
      <div role="menuitem" aria-label="More" tabIndex={-1}>
        <MenuItemRow icon={{ children: 'I' }} label={label} end={<span data-testid="end" />} />
      </div>,
    );
    const row = item('More');
    expect(row.querySelector('[data-menu-column-space]')).toBeNull();
    expect(row.querySelector('[data-menu-icon]')).not.toBeNull();
    expect(screen.getByTestId('end')).toBeInTheDocument();
  });

  it('a Menu.Item without children and with aria-label renders no placeholders and is named by its label', () => {
    renderInMenuList(
      <>
        <MenuItem>Save</MenuItem>
        <MenuItem aria-label="More save options" />
      </>,
    );
    const half = item('More save options');
    expect(half.querySelector('[data-menu-column-space]')).toBeNull();
    expect(half.textContent).toBe('');
  });

  it('a Menu.Item without children marks no typeahead label, so typing writes no text onto it', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItem>Save</MenuItem>
        <MenuItem aria-label="More save options" />
      </>,
    );
    const half = item('More save options');
    expect(half.querySelector('[data-menu-label]')).toBeNull();
    act(() => item('Save').focus());
    await user.keyboard('x');
    expect(half).not.toHaveAttribute('data-roving-text');
  });

  it('renders a one-shot iterable label (a generator), which the label check does not consume', () => {
    const error = vi.spyOn(console, 'error');
    function* words() {
      yield 'Save ';
      yield 'all';
    }
    renderInMenuList(<MenuItem>{words()}</MenuItem>);
    const row = screen.getByRole('menuitem');
    expect(row).toHaveTextContent('Save all');
    expect(describeRow(row)).toEqual(['space:checkmark', 'space:icon', 'text:Save all']);
    expect(error).not.toHaveBeenCalled();
  });

  it('MenuColumnSpacers renders the two placeholders alone, for a row that is not an item', () => {
    renderInMenuList(
      <div data-testid="header">
        <MenuColumnSpacers />
        Sort by
      </div>,
    );
    const header = screen.getByTestId('header');
    expect(describeRow(header)).toEqual(['space:checkmark', 'space:icon']);
    expect(header.children[0]).toHaveClass(...CHECKMARK_SPACE.split(' '));
    expect(header.children[1]).toHaveClass(...ICON_SPACE.split(' '));
    expect(header).toHaveTextContent('Sort by');
  });

  it('the placeholders refer to the list, which is the group/menu', () => {
    const { list } = renderInMenuList(<MenuItem>Paste</MenuItem>);
    expect(list).toHaveClass('group/menu');
    expect(list).toContainElement(item('Paste'));
  });

  it('keeps the highlight of an item whose submenu is open and draws a logical forced-colors start bar', () => {
    renderInMenuList(<MenuItem>Open recent</MenuItem>);
    const row = item('Open recent');
    expect(row).toHaveClass(
      'aria-expanded:bg-subtle-hover',
      'forced-colors:aria-expanded:border-s-4',
      'forced-colors:aria-expanded:border-[Highlight]',
      'forced-colors:aria-expanded:ps-2',
      // The 0.6 classes stay: the inset, the hover background and the focus ring.
      'px-3',
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
      'focus-visible:outline-2',
    );
    expect(row.className).not.toMatch(/border-l-|pl-2/);
  });
});

/** A test item with the activation of every menu item kind. */
function ActivationItem({
  label = 'Item',
  children,
  ...options
}: Partial<MenuItemActivationOptions> & { label?: string; children?: React.ReactNode }) {
  const handlers = useMenuItemActivation({
    disabled: false,
    persistOnClick: undefined,
    ...options,
  });
  // The list's roving hook manages the tab index, as for every item.
  return (
    <div role="menuitem" {...handlers}>
      {label}
      {children}
    </div>
  );
}

describe('useMenuItemActivation', () => {
  it('an own click runs the consumer onClick, then onActivate, then closes the menu once', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const { closeFromItem } = renderInMenuList(
      <ActivationItem
        onClick={() => calls.push('onClick')}
        onActivate={() => calls.push('onActivate')}
      />,
      { closeFromItem: () => calls.push('closeFromItem') },
    );
    await user.click(item('Item'));
    expect(calls).toEqual(['onClick', 'onActivate', 'closeFromItem']);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('a click from a portal opened inside the item reaches onClick but neither activates nor closes', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem onClick={onClick} onActivate={onActivate}>
        {createPortal(<button type="button">Inside</button>, document.body)}
      </ActivationItem>,
    );
    await user.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onActivate).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('a consumer onClick that prevents the default cancels the activation and the close', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem onClick={(event) => event.preventDefault()} onActivate={onActivate} />,
    );
    await user.click(item('Item'));
    expect(onActivate).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('onActivate that prevents the default keeps the menu open', async () => {
    const user = userEvent.setup();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem onActivate={(event) => event.preventDefault()} />,
    );
    await user.click(item('Item'));
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, false, true],
    [true, false, false],
    [false, false, true],
    [undefined, true, false],
    [false, true, true],
    [true, true, false],
  ])(
    'persistOnClick %s with the Menu persistOnItemClick %s: the click closes the menu: %s',
    async (persistOnClick, persistOnItemClick, closes) => {
      const user = userEvent.setup();
      const onActivate = vi.fn();
      const { closeFromItem } = renderInMenuList(
        <ActivationItem persistOnClick={persistOnClick} onActivate={onActivate} />,
        { persistOnItemClick },
      );
      await user.click(item('Item'));
      expect(onActivate).toHaveBeenCalledTimes(1);
      expect(closeFromItem).toHaveBeenCalledTimes(closes ? 1 : 0);
    },
  );

  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('%s clicks the focused item, which closes the menu', async (_name, key) => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(<ActivationItem onClick={onClick} />);
    act(() => item('Item').focus());
    await user.keyboard(key);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Enter', 'Enter'],
    ['Space', ' '],
  ])(
    '%s is consumed (default prevented), and left to the page with Ctrl, Alt or Meta',
    (_n, key) => {
      const onClick = vi.fn();
      renderInMenuList(<ActivationItem onClick={onClick} />);
      expect(fireEvent.keyDown(item('Item'), { key })).toBe(false);
      expect(onClick).toHaveBeenCalledTimes(1);
      for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
        expect(fireEvent.keyDown(item('Item'), { key, [modifier]: true })).toBe(true);
      }
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it('Space with keepOpenOnSpace activates and keeps the menu open; Enter and a click still close it', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem keepOpenOnSpace onActivate={onActivate} />,
    );
    act(() => item('Item').focus());
    await user.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(closeFromItem).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
    await user.click(item('Item'));
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(closeFromItem).toHaveBeenCalledTimes(2);
  });

  it('Enter with nativeEnter is left to the element (not prevented, no click); Space still clicks', () => {
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(<ActivationItem nativeEnter onClick={onClick} />);
    expect(fireEvent.keyDown(item('Item'), { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(item('Item'), { key: 'Enter', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(item('Item'), { key: 'Enter', ctrlKey: true })).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(item('Item'), { key: ' ' })).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('hasSubmenu: activation never closes the menu, whatever persists', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem hasSubmenu persistOnClick={false} onActivate={onActivate} />,
    );
    await user.click(item('Item'));
    act(() => item('Item').focus());
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(3);
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('disabled: no onClick and no activation; an own click is prevented, Enter and Space consumed', () => {
    const onClick = vi.fn();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <ActivationItem disabled onClick={onClick} onActivate={onActivate} />,
    );
    expect(fireEvent.click(item('Item'))).toBe(false);
    expect(fireEvent.keyDown(item('Item'), { key: 'Enter' })).toBe(false);
    expect(fireEvent.keyDown(item('Item'), { key: ' ' })).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('a Space that continues a typeahead search does not activate the focused item', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    renderInMenuList(
      <>
        <ActivationItem label="Clear" />
        <ActivationItem label="Copy" onActivate={onActivate} />
      </>,
    );
    await user.tab();
    await user.keyboard('c');
    expect(item('Copy')).toHaveFocus();
    await user.keyboard(' ');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('in a static list activation closes nothing', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const { closeFromItem } = renderInMenuList(<ActivationItem onActivate={onActivate} />, {
      isStatic: true,
    });
    await user.click(item('Item'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(closeFromItem).not.toHaveBeenCalled();
  });
});

describe('Menu.Item activation in a menu list', () => {
  it('closes its popup menu, unless the Menu persists (persistOnItemClick) and the item does not override it', async () => {
    const user = userEvent.setup();
    const { closeFromItem } = renderInMenuList(
      <>
        <MenuItem>Keep</MenuItem>
        <MenuItem persistOnClick={false}>Close</MenuItem>
      </>,
      { persistOnItemClick: true },
    );
    await user.click(item('Keep'));
    expect(closeFromItem).not.toHaveBeenCalled();
    await user.click(item('Close'));
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('an item persistOnClick keeps the menu open by default settings', async () => {
    const user = userEvent.setup();
    const { closeFromItem } = renderInMenuList(<MenuItem persistOnClick>Keep</MenuItem>);
    await user.click(item('Keep'));
    expect(closeFromItem).not.toHaveBeenCalled();
  });
});

describe('the submenu-trigger path of Menu.Item', () => {
  it('renders data-has-submenu and a 16px chevron at the row end that mirrors in RTL', () => {
    renderInMenuList(<MenuItem shortcut="Ctrl+R">Open recent</MenuItem>, { submenuTrigger: true });
    const row = screen.getByRole('menuitem');
    expect(row).toHaveAttribute('data-has-submenu', '');
    const chevron = row.lastElementChild;
    expect(chevron).toHaveAttribute('data-wave-icon', 'chevron-right');
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(chevron).toHaveAttribute('width', '16');
    expect(chevron).toHaveClass('ms-auto', 'shrink-0', 'wave-rtl:-scale-x-100');
    expect(describeRow(row).slice(0, 4)).toEqual([
      'space:checkmark',
      'space:icon',
      'text:Open recent',
      'text:Ctrl+R',
    ]);
  });

  it('activation (click, Enter, Space) runs onClick and never closes the menu', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(<MenuItem onClick={onClick}>Open recent</MenuItem>, {
      submenuTrigger: true,
    });
    await user.click(item('Open recent'));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('keeps the disabled rules: a disabled trigger item calls no onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderInMenuList(
      <MenuItem disabled onClick={onClick}>
        Open recent
      </MenuItem>,
      { submenuTrigger: true },
    );
    await user.click(item('Open recent'));
    expect(onClick).not.toHaveBeenCalled();
    expect(item('Open recent')).toHaveAttribute('aria-disabled', 'true');
    expect(item('Open recent')).toHaveAttribute('data-has-submenu', '');
  });

  it('keeps the chevron class and the logical row in RTL', () => {
    renderInMenuList(<MenuItem>Open recent</MenuItem>, {
      submenuTrigger: true,
      dir: 'rtl',
    });
    const row = item('Open recent');
    expect(row.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(row.lastElementChild).toHaveClass('ms-auto', 'wave-rtl:-scale-x-100');
  });

  it('outside a submenu trigger an item has no chevron and no data-has-submenu', () => {
    renderInMenuList(<MenuItem>Open</MenuItem>);
    expect(item('Open')).not.toHaveAttribute('data-has-submenu');
    expect(item('Open').querySelector('[data-wave-icon="chevron-right"]')).toBeNull();
  });
});

/** An item kind that reports its placement, as every item does. */
function PlacedItem({ name = 'Test.Item' }: { name?: string }) {
  useMenuItemPlacementWarning(name);
  return <div role="menuitem">Item</div>;
}

const placementWarning = (name: string) =>
  `[WaveUI] ${name}: rendered in a popup menu outside Menu.Popover, so it has no \`role="menu"\` parent. A Menu with \`open\`, \`defaultOpen\` or \`onOpenChange\` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.`;

describe('useMenuItemPlacementWarning', () => {
  it('warns once per page, naming the item, for items of a popup menu outside any menu list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MenuContext.Provider value={{ ...INERT_MENU_CONTEXT, popup: true }}>
        <PlacedItem name="Menu.ItemCheckbox" />
        <MenuItem>Paste</MenuItem>
      </MenuContext.Provider>,
    );
    // One key for every item kind: the cause is the same Menu.
    expect(warn.mock.calls).toEqual([[placementWarning('Menu.ItemCheckbox')]]);
  });

  it('Menu.Item reports itself as Menu.Item', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MenuContext.Provider value={{ ...INERT_MENU_CONTEXT, popup: true }}>
        <MenuItem>Paste</MenuItem>
      </MenuContext.Provider>,
    );
    expect(warn.mock.calls).toEqual([[placementWarning('Menu.Item')]]);
  });

  it('does not warn inside a menu list, in a static menu or outside any Menu', () => {
    const warn = vi.spyOn(console, 'warn');
    renderInMenuList(<PlacedItem />);
    renderInMenuList(<PlacedItem />, { isStatic: true });
    render(
      <MenuContext.Provider value={{ ...INERT_MENU_CONTEXT, popup: false }}>
        <PlacedItem />
      </MenuContext.Provider>,
    );
    render(<PlacedItem />);
    expect(warn).not.toHaveBeenCalled();
  });
});

/** A checkable test item: registers its pair with the list, as checkable items do. */
function Checkable({ name, value }: { name: string; value: string }) {
  const list = useMenuListContext();
  React.useEffect(() => list?.registerCheckable(name, value), [list, name, value]);
  return (
    <div role="menuitemcheckbox" aria-checked="false" tabIndex={-1}>
      {value}
    </div>
  );
}

const DUPLICATE_WARNING =
  '[WaveUI] Menu: two checkable items of one menu list have the name "sort" and the value "date", so both show as checked. Give every item of a group its own value.';

describe('registerCheckable (duplicate name and value)', () => {
  it('warns once for a second item with the same name and value in one list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInMenuList(
      <>
        <Checkable name="sort" value="date" />
        <Checkable name="sort" value="date" />
        <Checkable name="sort" value="date" />
      </>,
    );
    expect(warn.mock.calls).toEqual([[DUPLICATE_WARNING]]);
  });

  it('does not warn for the same pair in two lists, for other values or for other names', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <MenuListHarness>
          <Checkable name="sort" value="date" />
          <Checkable name="sort" value="name" />
          <Checkable name="view" value="date" />
        </MenuListHarness>
        <MenuListHarness>
          <Checkable name="sort" value="date" />
        </MenuListHarness>
      </>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('unregisters on unmount (StrictMode included), so a replacing item does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <React.StrictMode>
        <MenuListHarness>
          <Checkable key="a" name="sort" value="date" />
        </MenuListHarness>
      </React.StrictMode>,
    );
    rerender(
      <React.StrictMode>
        <MenuListHarness>
          <Checkable key="b" name="sort" value="date" />
        </MenuListHarness>
      </React.StrictMode>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the menu list harness', () => {
  it('renders the items in a role="menu" roving container with one tab stop', async () => {
    const user = userEvent.setup();
    const { list } = renderInMenuList(
      <>
        <MenuItem>One</MenuItem>
        <MenuItem>Two</MenuItem>
      </>,
    );
    expect(list).toHaveAttribute('data-roving-container', '');
    expect(item('One')).toHaveAttribute('tabindex', '0');
    expect(item('Two')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(item('Two')).toHaveFocus();
    await user.keyboard('o');
    expect(item('One')).toHaveFocus();
  });

  it('returns closeFromItem as a spy that calls the given function through', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { closeFromItem } = renderInMenuList(<MenuItem>One</MenuItem>, {
      closeFromItem: onClose,
    });
    await user.click(item('One'));
    expect(closeFromItem).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('provides a real checked-values state and the list depth', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    function Toggle() {
      const list = useMenuListContext();
      if (!list) return null;
      const checked = list.menu.checked.isChecked('view', 'grid');
      return (
        <div
          role="menuitemcheckbox"
          aria-checked={checked}
          data-depth={list.portalDepth}
          tabIndex={-1}
          onClick={(event) => list.menu.checked.toggle('view', 'grid', event.nativeEvent)}
        >
          Grid
        </div>
      );
    }
    renderInMenuList(<Toggle />, { defaultCheckedValues: { view: [] }, onCheckedValuesChange });
    const toggle = screen.getByRole('menuitemcheckbox', { name: 'Grid' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(toggle).toHaveAttribute('data-depth', '0');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedValuesChange).toHaveBeenCalledTimes(1);
    expect(onCheckedValuesChange.mock.calls[0][0]).toEqual({ view: ['grid'] });
  });

  it('renders on the server and hydrates without warnings', async () => {
    const tree = (
      <MenuListHarness isStatic>
        <MenuItem icon={{ children: 'I' }}>Cut</MenuItem>
        <MenuItem>Paste</MenuItem>
      </MenuListHarness>
    );
    const html = renderToString(tree);
    expect(html).toContain('data-menu-column-space="checkmark"');
    expect(html).toContain('data-menu-icon=""');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(item('Cut')).toBeInTheDocument();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });

  it('has no axe violations with plain, icon, shortcut, disabled and submenu-trigger items', async () => {
    renderInMenuList(
      <>
        <MenuItem icon={{ children: 'I' }} shortcut="Ctrl+X">
          Cut
        </MenuItem>
        <MenuItem>Paste</MenuItem>
        <MenuItem disabled>Delete</MenuItem>
      </>,
    );
    await expectNoA11yViolations();
  });

  it('has no axe violations for submenu-trigger items and a label-less item named by aria-label', async () => {
    renderInMenuList(
      <>
        <MenuItem>Open recent</MenuItem>
        <MenuItem aria-label="More save options" />
      </>,
      { submenuTrigger: true },
    );
    await expectNoA11yViolations();
  });
});

describe('Menu.Item — slotProps', () => {
  type ItemSlotProps = NonNullable<MenuItemProps['slotProps']>;
  const EVERY_PART: ItemSlotProps = { content: {}, shortcut: {}, submenuIndicator: {} };
  const part = (row: Element, className: string) =>
    row.querySelector<HTMLElement>('.' + className) as HTMLElement;
  const content = (row: Element) => part(row, menuItemClassNames.content);
  const shortcut = (row: Element) => part(row, menuItemClassNames.shortcut);
  const chevron = (row: Element) => part(row, menuItemClassNames.submenuIndicator);
  /** The item whose name starts with `label` (a shortcut's text follows the label in the name). */
  const named = (label: string) => screen.getByRole('menuitem', { name: new RegExp(`^${label}`) });

  // Captured from 4a08890 (client and server agree): the merged props may put the class before the
  // locked attributes.
  const BASE_PINS = [
    '<span class="wave-menu-item__content flex-1">',
    '<span class="wave-menu-item__shortcut ms-4 text-caption-1 text-muted-foreground" dir="auto">',
    '<svg aria-hidden="true" class="wave-menu-item__submenu-indicator ms-auto shrink-0 wave-rtl:-scale-x-100" data-wave-icon="chevron-right" fill="currentColor" focusable="false" height="16" viewBox="0 0 12 12" width="16" xmlns="http://www.w3.org/2000/svg">',
    '<span class="wave-menu-item__content flex-1" data-menu-label="">',
  ].join('\n');

  function PinnedItems({ slotProps }: { slotProps?: ItemSlotProps }) {
    return (
      <MenuListHarness isStatic submenuTrigger>
        <MenuItem icon={{ children: 'S' }} shortcut="Ctrl+S" slotProps={slotProps}>
          Save
        </MenuItem>
        <MenuItem slotProps={slotProps}>
          <b>Bold</b>
        </MenuItem>
      </MenuListHarness>
    );
  }

  /** The parts of the two pinned items, in the order of {@link BASE_PINS}. */
  const pinnedParts = (root: ParentNode) => {
    const [save, bold] = Array.from(root.querySelectorAll('[role="menuitem"]'));
    return [content(save), shortcut(save), chevron(save), content(bold)];
  };

  it('renders the parts of 4a08890 (attributes sorted), on the client and the server', () => {
    render(<PinnedItems />);
    expect(openingTags(...pinnedParts(document.body))).toBe(BASE_PINS);
    const template = document.createElement('template');
    template.innerHTML = renderToString(<PinnedItems slotProps={EVERY_PART} />);
    expect(openingTags(...pinnedParts(template.content))).toBe(BASE_PINS);
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: Array<Partial<MenuItemProps> & { submenuTrigger?: boolean }> = [
      { icon: { children: 'S' }, shortcut: 'Ctrl+S', children: 'Save', submenuTrigger: true },
      { children: <b>Bold</b>, shortcut: 'Ctrl+B' },
      { children: <i>Slanted</i>, 'data-roving-text': 'Italic' } as Partial<MenuItemProps>,
      { children: 'Delete', disabled: true, shortcut: 'Del' },
      { 'aria-label': 'More options', submenuTrigger: true },
    ];
    for (const { submenuTrigger, ...props } of cases) {
      expectInertSlotProps(
        (slotProps) => (
          <MenuListHarness submenuTrigger={submenuTrigger}>
            <MenuItem {...props} slotProps={slotProps} />
          </MenuListHarness>
        ),
        EVERY_PART,
      );
    }
  });

  it('puts your className, style and data-* on each part, after its own classes', () => {
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        slotProps={{
          content: { className: 'my-content', style: { opacity: 0.5 }, 'data-part': 'content' },
          shortcut: { className: 'my-shortcut', style: { opacity: 0.25 }, 'data-part': 'shortcut' },
          submenuIndicator: {
            className: 'my-chevron',
            style: { opacity: 0.75 },
            'data-part': 'chevron',
          },
        }}
      >
        Save
      </MenuItem>,
      { submenuTrigger: true },
    );
    const row = named('Save');
    for (const [element, stable, own, mine, data, opacity] of [
      [content(row), menuItemClassNames.content, 'flex-1', 'my-content', 'content', '0.5'],
      [shortcut(row), menuItemClassNames.shortcut, 'ms-4', 'my-shortcut', 'shortcut', '0.25'],
      [
        chevron(row),
        menuItemClassNames.submenuIndicator,
        'ms-auto',
        'my-chevron',
        'chevron',
        '0.75',
      ],
    ] as const) {
      expect(element).toHaveClass(stable, own, mine);
      expect(element.classList[0]).toBe(stable);
      expect(element.classList[element.classList.length - 1]).toBe(mine);
      expect(element).toHaveAttribute('data-part', data);
      expect(element).toHaveStyle({ opacity });
    }
  });

  it('lets your class replace a conflicting class of a part', () => {
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        slotProps={{
          content: { className: 'flex-none' },
          shortcut: { className: 'ms-2' },
          submenuIndicator: { className: 'ms-1' },
        }}
      >
        Save
      </MenuItem>,
      { submenuTrigger: true },
    );
    const row = named('Save');
    expect(content(row)).toHaveClass('flex-none');
    expect(content(row)).not.toHaveClass('flex-1');
    expect(shortcut(row)).toHaveClass('ms-2');
    expect(shortcut(row)).not.toHaveClass('ms-4');
    expect(chevron(row)).toHaveClass('ms-1');
    expect(chevron(row)).not.toHaveClass('ms-auto');
  });

  it('attaches your refs to the parts', () => {
    const contentRef = React.createRef<HTMLSpanElement>();
    const shortcutRef = React.createRef<HTMLSpanElement>();
    const chevronRef = React.createRef<SVGSVGElement>();
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        slotProps={{
          content: { ref: contentRef },
          shortcut: { ref: shortcutRef },
          submenuIndicator: { ref: chevronRef },
        }}
      >
        Save
      </MenuItem>,
      { submenuTrigger: true },
    );
    const row = named('Save');
    expect(contentRef.current).toBe(content(row));
    expect(shortcutRef.current).toBe(shortcut(row));
    expect(chevronRef.current).toBe(chevron(row));
  });

  it('locks the shortcut’s direction and the chevron’s hidden state, and gives no part a role', () => {
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+,"
        slotProps={{
          content: { role: 'menuitem', title: 'Label' },
          shortcut: { dir: 'ltr', role: 'note', title: 'Shortcut' },
          submenuIndicator: {
            'aria-hidden': false,
            focusable: 'true',
            role: 'img',
            'aria-label': 'More',
          },
        }}
      >
        Settings
      </MenuItem>,
      { submenuTrigger: true, dir: 'rtl' },
    );
    const row = named('Settings');
    expect(content(row)).not.toHaveAttribute('role');
    expect(content(row)).toHaveAttribute('title', 'Label');
    expect(shortcut(row)).toHaveAttribute('dir', 'auto');
    expect(shortcut(row)).not.toHaveAttribute('role');
    expect(shortcut(row)).toHaveAttribute('title', 'Shortcut');
    expect(chevron(row)).toHaveAttribute('aria-hidden', 'true');
    expect(chevron(row)).toHaveAttribute('focusable', 'false');
    expect(chevron(row)).not.toHaveAttribute('role');
    expect(chevron(row)).toHaveAttribute('aria-label', 'More');
    // The item's name is still its label alone, and the menu has one item.
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
  });

  it('keeps a part with an item role out of the arrow keys', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItem slotProps={{ content: { role: 'menuitem' } }}>One</MenuItem>
        <MenuItem>Two</MenuItem>
      </>,
    );
    await user.tab();
    expect(item('One')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Two')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('One')).toHaveFocus();
  });

  it('keeps typeahead on the label: the shortcut cannot mark itself as the text typeahead reads', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItem shortcut="Ctrl+A" slotProps={{ shortcut: { 'data-menu-label': '' } }}>
          Apple
        </MenuItem>
        <MenuItem>Cherry</MenuItem>
      </>,
    );
    expect(shortcut(named('Apple'))).not.toHaveAttribute('data-menu-label');
    await user.tab();
    await user.keyboard('{End}');
    expect(item('Cherry')).toHaveFocus();
    await user.keyboard('a');
    expect(named('Apple')).toHaveFocus();
  });

  it('keeps your data-roving-text: the label part cannot mark itself, or take children', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItem
          data-roving-text="Paste"
          slotProps={{ content: { 'data-menu-label': '', children: 'Pear' } as never }}
        >
          <b>Insert</b>
        </MenuItem>
        <MenuItem>Cherry</MenuItem>
      </>,
    );
    // A part takes no children: the label keeps the item's own content.
    expect(content(named('Insert'))).toHaveTextContent('Insert');
    expect(content(named('Insert'))).not.toHaveAttribute('data-menu-label');
    await user.tab();
    await user.keyboard('{End}');
    expect(item('Cherry')).toHaveFocus();
    await user.keyboard('p');
    expect(named('Insert')).toHaveFocus();
  });

  it('keeps the non-string label marked for typeahead whatever a part sets', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItem>Cherry</MenuItem>
        {/* The icon's text starts the item's whole text: typeahead finds "Bold" only through the
            label's marker, which the part may neither drop nor replace. */}
        <MenuItem icon={{ children: 'X' }} slotProps={{ content: { 'data-menu-label': 'mine' } }}>
          <b>Bold</b>
        </MenuItem>
      </>,
    );
    const bold = screen.getAllByRole('menuitem')[1];
    expect(bold).toHaveTextContent(/^XBold$/);
    await user.tab();
    await user.keyboard('b');
    expect(bold).toHaveFocus();
    expect(content(bold)).toHaveAttribute('data-menu-label', '');
  });

  it('keeps the item the menu’s one tab stop: a part takes no tab index', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        slotProps={{
          content: { tabIndex: 0 },
          shortcut: { tabIndex: 0 },
          submenuIndicator: { tabIndex: 0 },
        }}
      >
        Save
      </MenuItem>,
      { submenuTrigger: true },
    );
    const row = named('Save');
    for (const element of [content(row), shortcut(row), chevron(row)]) {
      expect(element).not.toHaveAttribute('tabindex');
    }
    await user.tab();
    expect(row).toHaveFocus();
    await user.tab();
    expect(row.contains(document.activeElement)).toBe(false);
  });

  it('calls no click handler of a part while the item is disabled, as it calls no onClick', async () => {
    const parts = { content: vi.fn(), shortcut: vi.fn(), chevron: vi.fn() };
    const onClick = vi.fn();
    const ui = (props: Partial<MenuItemProps>) => (
      <MenuItem
        shortcut="Ctrl+S"
        onClick={onClick}
        {...props}
        slotProps={{
          content: { onClick: parts.content },
          shortcut: { onClick: parts.shortcut },
          submenuIndicator: { onClick: parts.chevron },
        }}
      >
        Save
      </MenuItem>
    );
    const clickEveryPart = () => {
      const row = named('Save');
      for (const element of [content(row), shortcut(row), chevron(row)]) fireEvent.click(element);
    };
    const { closeFromItem, rerender } = renderInMenuList(ui({}), { submenuTrigger: true });
    clickEveryPart();
    for (const handler of Object.values(parts)) expect(handler).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(3);
    rerender(ui({ disabled: true }));
    await act(async () => {});
    clickEveryPart();
    for (const handler of Object.values(parts)) expect(handler).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(3);
    // A consumer aria-disabled alone only changes the look: the item and its parts still run.
    rerender(ui({ 'aria-disabled': true }));
    await act(async () => {});
    clickEveryPart();
    for (const handler of Object.values(parts)) expect(handler).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledTimes(6);
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('calls no click handler of a part of a disabled item that closes its menu when enabled', async () => {
    const onContent = vi.fn();
    const ui = (disabled: boolean) => (
      <MenuItem disabled={disabled} slotProps={{ content: { onClick: onContent } }}>
        Save
      </MenuItem>
    );
    const { closeFromItem, rerender } = renderInMenuList(ui(true));
    fireEvent.click(content(item('Save')));
    expect(onContent).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
    rerender(ui(false));
    await act(async () => {});
    fireEvent.click(content(item('Save')));
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('leaves the menu’s columns to its icons and checks: a part cannot add a column marker', async () => {
    const values: MenuListContextValue[] = [];
    function Probe() {
      values.push(usePublicMenuListContext());
      return null;
    }
    const markers = {
      className: 'my-part',
      style: { opacity: 0.5 },
      'data-part': 'x',
      'data-menu-icon': '',
      'data-menu-checkmark': '',
    } as const;
    function Edit({ slotProps }: { slotProps?: ItemSlotProps }) {
      return (
        <Menu aria-label="Edit">
          <Menu.Item shortcut="Ctrl+X" slotProps={slotProps}>
            Cut
          </Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item slotProps={slotProps}>Share</Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popover>
          </Menu>
          <Probe />
        </Menu>
      );
    }
    const { rerender } = render(<Edit />);
    await act(async () => {});
    const without = values.at(-1);
    rerender(
      <Edit slotProps={{ content: markers, shortcut: markers, submenuIndicator: markers }} />,
    );
    await act(async () => {});
    expect(document.querySelectorAll('.my-part')).toHaveLength(4);
    expect(document.querySelector('[data-menu-icon], [data-menu-checkmark]')).toBeNull();
    expect(values.at(-1)).toStrictEqual(without);
    expect(without).toStrictEqual({ hasIcons: false, hasCheckmarks: false });
  });

  it('runs a part’s handler before the item’s: a prevented click calls onClick but does not activate', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onClick = vi.fn(() => void order.push('item'));
    const { closeFromItem, rerender } = renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        onClick={onClick}
        slotProps={{
          content: {
            onClick: (event) => {
              order.push('content');
              event.preventDefault();
            },
          },
        }}
      >
        Save
      </MenuItem>,
    );
    await user.click(content(named('Save')));
    expect(order).toEqual(['content', 'item']);
    expect(closeFromItem).not.toHaveBeenCalled();
    rerender(
      <MenuItem
        shortcut="Ctrl+S"
        onClick={onClick}
        slotProps={{ shortcut: { onClick: () => void order.push('shortcut') } }}
      >
        Save
      </MenuItem>,
    );
    await user.click(shortcut(named('Save')));
    expect(order).toEqual(['content', 'item', 'shortcut', 'item']);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('opens no submenu on a click the chevron’s handler prevents', () => {
    const onChevronClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    function Share({ prevent }: { prevent: boolean }) {
      return (
        <Menu aria-label="File">
          <Menu>
            <Menu.Trigger>
              <Menu.Item
                slotProps={{ submenuIndicator: { onClick: prevent ? onChevronClick : () => {} } }}
              >
                Share
              </Menu.Item>
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu>
      );
    }
    const { rerender } = render(<Share prevent />);
    fireEvent.click(chevron(item('Share')));
    expect(onChevronClick).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    rerender(<Share prevent={false} />);
    fireEvent.click(chevron(item('Share')));
    expect(screen.getAllByRole('menu')).toHaveLength(2);
    expect(item('Share')).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls your part handlers once per click in StrictMode', async () => {
    const user = userEvent.setup();
    const onContent = vi.fn();
    const onShortcut = vi.fn();
    const onChevron = vi.fn();
    renderInMenuList(
      <MenuItem
        shortcut="Ctrl+S"
        slotProps={{
          content: { onClick: onContent },
          shortcut: { onClick: onShortcut },
          submenuIndicator: { onClick: onChevron },
        }}
      >
        Save
      </MenuItem>,
      { submenuTrigger: true, renderOptions: { wrapper: React.StrictMode } },
    );
    const row = named('Save');
    await user.click(content(row));
    await user.click(shortcut(row));
    await user.click(chevron(row));
    expect(onContent).toHaveBeenCalledTimes(1);
    expect(onShortcut).toHaveBeenCalledTimes(1);
    expect(onChevron).toHaveBeenCalledTimes(1);
  });

  it('ignores the parts the item does not draw: no shortcut, no submenu', () => {
    renderInMenuList(
      <MenuItem
        slotProps={{
          shortcut: { className: 'my-shortcut' },
          submenuIndicator: { className: 'my-chevron' },
        }}
      >
        Plain
      </MenuItem>,
    );
    expect(document.querySelector('.' + menuItemClassNames.shortcut)).toBeNull();
    expect(document.querySelector('.' + menuItemClassNames.submenuIndicator)).toBeNull();
    expect(document.querySelector('.my-shortcut, .my-chevron')).toBeNull();
  });

  it('keeps the item element its own: slotProps never reaches it', () => {
    renderInMenuList(
      <MenuItem slotProps={{ root: { role: 'button', className: 'my-root' } } as never}>
        Save
      </MenuItem>,
    );
    const row = named('Save');
    expect(row).not.toHaveAttribute('slotprops');
    expect(row).not.toHaveClass('my-root');
    expect(document.querySelector('.my-root, [role="button"]')).toBeNull();
  });

  it('mirrors the chevron with your class in RTL', () => {
    renderInMenuList(
      <MenuItem slotProps={{ submenuIndicator: { className: 'my-chevron' } }}>
        Open recent
      </MenuItem>,
      { submenuTrigger: true, dir: 'rtl' },
    );
    const row = item('Open recent');
    expect(row.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(chevron(row)).toHaveClass('wave-rtl:-scale-x-100', 'my-chevron');
    expect(row.lastElementChild).toBe(chevron(row));
  });

  it('has no accessibility violations with every part customised', async () => {
    renderInMenuList(
      <>
        <MenuItem
          shortcut="Ctrl+S"
          slotProps={{
            content: { className: 'my-content', title: 'Save the file' },
            shortcut: { className: 'my-shortcut', 'aria-label': 'Control S' },
            submenuIndicator: { className: 'my-chevron' },
          }}
        >
          Save
        </MenuItem>
        <MenuItem slotProps={{ content: { id: 'label-2' } }}>Close</MenuItem>
      </>,
      { submenuTrigger: true },
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof ItemSlotProps>().toEqualTypeOf<
      'content' | 'shortcut' | 'submenuIndicator'
    >();
    expectTypeOf<NonNullable<ItemSlotProps['content']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['shortcut']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['submenuIndicator']>['ref']>().toEqualTypeOf<
      React.Ref<SVGSVGElement> | undefined
    >();
    // @ts-expect-error -- a part takes no children: the item draws them
    void (<MenuItem slotProps={{ content: { children: 'Label' } }}>Save</MenuItem>);
    // @ts-expect-error -- the item element takes the item's own props, never a part's
    void (<MenuItem slotProps={{ root: {} }}>Save</MenuItem>);
  });
});
