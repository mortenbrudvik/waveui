import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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
import type { MenuItemActivationOptions } from '../Menu.items';
import { INERT_MENU_CONTEXT, MenuContext, useMenuListContext } from '../Menu.context';
import { WaveProvider } from '../../provider/WaveProvider';
import { expectNoA11yViolations } from '../../../test-utils';
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

function RtlProvider({ children }: { children: React.ReactNode }) {
  return <WaveProvider dir="rtl">{children}</WaveProvider>;
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
      renderOptions: { wrapper: RtlProvider },
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
      renderOptions: { wrapper: RtlProvider },
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
