import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { MenuGroup, MenuGroupHeader } from '../Menu.group';
import type { MenuGroupProps } from '../Menu.group';
import { MenuItemCheckbox, MenuItemRadio } from '../Menu.selectable';
import { MenuDivider, MenuItem } from '../Menu.items';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  testSystemProps,
} from '../../../test-utils';
import { MenuListHarness, renderInMenuList } from './menuHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

const UNLABELLED_WARNING =
  '[WaveUI] Menu.GroupHeader: this header is not a direct child of Menu.Group (or of a Fragment in it), so it does not label the group. Make it a direct child, or pass aria-label to Menu.Group.';

const HEADER_CLASSES =
  'flex items-center gap-2 px-3 pb-1 pt-2 text-caption-1 font-semibold text-muted-foreground';

const EXTRA_HEADER_WARNING =
  '[WaveUI] Menu.GroupHeader: this Menu.Group already has a header (its first direct child header), so this one does not label the group. Give a group one header, or put this one in a Menu.Group of its own.';

const sortRadios = (
  <>
    <MenuItemRadio name="sort" value="name">
      Name
    </MenuItemRadio>
    <MenuItemRadio name="sort" value="date">
      Date
    </MenuItemRadio>
  </>
);

describe('labelling', () => {
  it('renders role="group" named by its header, a direct child', () => {
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>,
    );
    const group = screen.getByRole('group', { name: 'Sort by' });
    const header = screen.getByText('Sort by');
    expect(header.id).toMatch(/^menu-group-header-/);
    expect(group).toHaveAttribute('aria-labelledby', header.id);
    expect(group).toContainElement(screen.getByRole('menuitemradio', { name: 'Date' }));
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it("uses the header's own id", () => {
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader id="sort-header">Sort by</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>,
    );
    expect(screen.getByText('Sort by')).toHaveAttribute('id', 'sort-header');
    expect(screen.getByRole('group', { name: 'Sort by' })).toHaveAttribute(
      'aria-labelledby',
      'sort-header',
    );
  });

  it('finds a header inside a Fragment and a header written in a Server Component', () => {
    const ClientHeader = asClientReference(MenuGroupHeader);
    renderInMenuList(
      <>
        <MenuGroup>
          <>
            <MenuGroupHeader>Sort by</MenuGroupHeader>
            {sortRadios}
          </>
        </MenuGroup>
        <MenuGroup>
          <ClientHeader>Show</ClientHeader>
          <MenuItemCheckbox name="view" value="ruler">
            Ruler
          </MenuItemCheckbox>
        </MenuGroup>
      </>,
    );
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument();
  });

  it('a consumer aria-label or aria-labelledby wins, and the group adds no aria-labelledby', () => {
    renderInMenuList(
      <>
        <span id="outside-label">Order</span>
        <MenuGroup aria-label="Sort">
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortRadios}
        </MenuGroup>
        <MenuGroup aria-labelledby="outside-label">
          <MenuGroupHeader>Order by</MenuGroupHeader>
          <MenuItem>Ascending</MenuItem>
        </MenuGroup>
      </>,
    );
    const sort = screen.getByRole('group', { name: 'Sort' });
    expect(sort).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByRole('group', { name: 'Order' })).toHaveAttribute(
      'aria-labelledby',
      'outside-label',
    );
  });

  it('an aria-label or aria-labelledby holding undefined is no name of its own: the header still labels the group', () => {
    const warn = vi.spyOn(console, 'warn');
    // A wrapper that forwards both props, whether or not its consumer set them.
    function ForwardingGroup({ children, ...props }: MenuGroupProps) {
      return (
        <MenuGroup aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']}>
          {children}
        </MenuGroup>
      );
    }
    renderInMenuList(
      <>
        <MenuGroup aria-labelledby={undefined}>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortRadios}
        </MenuGroup>
        <ForwardingGroup>
          <MenuGroupHeader>Show</MenuGroupHeader>
          <MenuItem>Ruler</MenuItem>
        </ForwardingGroup>
      </>,
    );
    expect(screen.getByRole('group', { name: 'Sort by' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('Sort by').id,
    );
    expect(screen.getByRole('group', { name: 'Show' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('Show').id,
    );
    expect(findDanglingIdRefs()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('without a header the group has no aria-labelledby, and nothing dangles', () => {
    const warn = vi.spyOn(console, 'warn');
    renderInMenuList(<MenuGroup data-testid="group">{sortRadios}</MenuGroup>);
    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(findDanglingIdRefs()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a header wrapped in a component does not label the group and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function SortHeader() {
      return <MenuGroupHeader>Sort by</MenuGroupHeader>;
    }
    renderInMenuList(
      <>
        <MenuGroup data-testid="first">
          <SortHeader />
          {sortRadios}
        </MenuGroup>
        <MenuGroup data-testid="second">
          <div>
            <MenuGroupHeader>Show</MenuGroupHeader>
          </div>
        </MenuGroup>
      </>,
    );
    expect(screen.getByTestId('first')).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByTestId('second')).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByRole('group', { name: 'Sort by' })).toBeNull();
    // Nothing points at such a header, so it renders no generated id.
    expect(screen.getByText('Sort by')).not.toHaveAttribute('id');
    expect(screen.getByText('Show')).not.toHaveAttribute('id');
    expect(warn.mock.calls).toEqual([[UNLABELLED_WARNING]]);
  });

  it('a wrapped header next to a direct-child header does not label the group, renders no generated id and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function MoreHeader() {
      return <MenuGroupHeader>More</MenuGroupHeader>;
    }
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        <MoreHeader />
        {sortRadios}
      </MenuGroup>,
    );
    const sortHeader = screen.getByText('Sort by');
    expect(sortHeader.id).toMatch(/^menu-group-header-/);
    expect(screen.getByRole('group', { name: 'Sort by' })).toHaveAttribute(
      'aria-labelledby',
      sortHeader.id,
    );
    expect(screen.getByText('More')).not.toHaveAttribute('id');
    expect(findDanglingIdRefs()).toEqual([]);
    expect(warn.mock.calls).toEqual([[EXTRA_HEADER_WARNING]]);
  });

  it('a second direct-child header does not label the group either: it keeps only its own id and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader>Show</MenuGroupHeader>
        <MenuItem>Ruler</MenuItem>
        <MenuGroupHeader>Also show</MenuGroupHeader>
        <MenuItem>Grid</MenuItem>
        <MenuGroupHeader id="panels-header">Panels</MenuGroupHeader>
        <MenuItem>Outline</MenuItem>
      </MenuGroup>,
    );
    expect(screen.getByRole('group', { name: 'Show' })).toHaveAttribute(
      'aria-labelledby',
      screen.getByText('Show').id,
    );
    expect(screen.getByText('Also show')).not.toHaveAttribute('id');
    expect(screen.getByText('Panels')).toHaveAttribute('id', 'panels-header');
    expect(findDanglingIdRefs()).toEqual([]);
    expect(warn.mock.calls).toEqual([[EXTRA_HEADER_WARNING]]);
  });

  it('a second header warns in a group named by aria-label too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInMenuList(
      <MenuGroup aria-label="Sort">
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        <MenuGroupHeader>Order</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>,
    );
    expect(screen.getByRole('group', { name: 'Sort' })).not.toHaveAttribute('aria-labelledby');
    expect(screen.getByText('Order')).not.toHaveAttribute('id');
    expect(warn.mock.calls).toEqual([[EXTRA_HEADER_WARNING]]);
  });

  it('the header its scan found keeps labelling the group in StrictMode, after a re-render and as a Server Component reference', () => {
    const warn = vi.spyOn(console, 'warn');
    const ClientHeader = asClientReference(MenuGroupHeader);
    function Groups({ sortLabel }: { sortLabel: string }) {
      return (
        <MenuListHarness>
          <MenuGroup>
            <MenuGroupHeader>{sortLabel}</MenuGroupHeader>
            {sortRadios}
          </MenuGroup>
          <MenuGroup>
            <ClientHeader>Show</ClientHeader>
            <MenuItem>Ruler</MenuItem>
          </MenuGroup>
        </MenuListHarness>
      );
    }
    const { rerender } = render(<Groups sortLabel="Sort by" />, { wrapper: React.StrictMode });
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument();
    rerender(<Groups sortLabel="Order by" />);
    expect(screen.getByRole('group', { name: 'Order by' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Show' })).toBeInTheDocument();
    expect(findDanglingIdRefs()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a wrapped header in a group named by aria-label does not warn', () => {
    const warn = vi.spyOn(console, 'warn');
    function SortHeader() {
      return <MenuGroupHeader>Sort by</MenuGroupHeader>;
    }
    renderInMenuList(
      <MenuGroup aria-label="Sort">
        <SortHeader />
        {sortRadios}
      </MenuGroup>,
    );
    expect(screen.getByRole('group', { name: 'Sort' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('the header outside a Menu.Group throws in development', () => {
    expectThrows(
      <MenuGroupHeader>Sort by</MenuGroupHeader>,
      '[WaveUI] Menu.GroupHeader must be used within Menu.Group',
    );
  });
});

describe('the header row', () => {
  it('is not a menu item: column placeholders, then its text, with the header classes', () => {
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>,
    );
    const header = screen.getByText('Sort by');
    expect(header.tagName).toBe('DIV');
    expect(header).not.toHaveAttribute('role');
    expect(header).not.toHaveAttribute('tabindex');
    expect(header).toHaveClass(...HEADER_CLASSES.split(' '));
    const [checkmarkSpace, iconSpace] = Array.from(header.children);
    expect(checkmarkSpace).toHaveAttribute('data-menu-column-space', 'checkmark');
    expect(iconSpace).toHaveAttribute('data-menu-column-space', 'icon');
    expect(header.children).toHaveLength(2);
    expect(header).toHaveTextContent('Sort by');
  });
});

describe('keyboard', () => {
  function renderGroups(isStatic = false) {
    return renderInMenuList(
      <>
        <MenuGroup>
          <MenuGroupHeader>Show</MenuGroupHeader>
          <MenuItemCheckbox name="view" value="ruler">
            Ruler
          </MenuItemCheckbox>
          <MenuItemCheckbox name="view" value="grid">
            Grid
          </MenuItemCheckbox>
        </MenuGroup>
        <MenuDivider />
        <MenuGroup>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortRadios}
        </MenuGroup>
        <MenuItem>Refresh</MenuItem>
      </>,
      { isStatic },
    );
  }

  it('the arrow keys, Home and End skip the headers', async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.tab();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Ruler' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', { name: 'Name' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Grid' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Ruler' })).toHaveFocus();
  });

  it("typeahead skips the headers: a header's first letter is not matched", async () => {
    const user = userEvent.setup();
    renderGroups();
    await user.tab();
    // "Sort by" and "Show" start with S; no item does.
    await user.keyboard('s');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Ruler' })).toHaveFocus();
  });

  it('checkable items inside a group keep working (the group adds no behaviour)', async () => {
    const user = userEvent.setup();
    const onCheckedValuesChange = vi.fn();
    renderInMenuList(
      <MenuGroup>
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>,
      { onCheckedValuesChange },
    );
    await user.click(screen.getByRole('menuitemradio', { name: 'Date' }));
    expect(screen.getByRole('menuitemradio', { name: 'Date' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(onCheckedValuesChange).toHaveBeenCalledWith(
      { sort: ['date'] },
      expect.objectContaining({ name: 'sort', checkedItems: ['date'] }),
    );
  });
});

describe('server rendering', () => {
  it('renders the aria-labelledby of the header on the server and hydrates without warnings', async () => {
    const tree = (
      <MenuListHarness isStatic defaultCheckedValues={{ sort: ['date'] }}>
        <MenuGroup>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          {sortRadios}
        </MenuGroup>
      </MenuListHarness>
    );
    const html = renderToString(tree);
    expect(html).toMatch(/role="group" aria-labelledby="menu-group-header-[^"]+"/);
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
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
      expect(screen.getByRole('group', { name: 'Sort by' })).toBeInTheDocument();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('accessibility', () => {
  const groups = (
    <>
      <MenuGroup>
        <MenuGroupHeader>Show</MenuGroupHeader>
        <MenuItemCheckbox name="view" value="ruler">
          Ruler
        </MenuItemCheckbox>
        <MenuItemCheckbox name="view" value="grid">
          Grid
        </MenuItemCheckbox>
      </MenuGroup>
      <MenuDivider />
      <MenuGroup>
        <MenuGroupHeader>Sort by</MenuGroupHeader>
        {sortRadios}
      </MenuGroup>
    </>
  );

  it('has no axe violations with a checkbox group and a radio group in a popover list', async () => {
    renderInMenuList(groups, { defaultCheckedValues: { view: ['ruler'], sort: ['date'] } });
    await expectNoA11yViolations();
  });

  it('has no axe violations with a checkbox group and a radio group in a static list', async () => {
    renderInMenuList(groups, { isStatic: true, defaultCheckedValues: { sort: ['name'] } });
    await expectNoA11yViolations();
  });
});

function GroupHarness({ children }: { children: React.ReactNode }) {
  return <MenuListHarness>{children}</MenuListHarness>;
}

function HeaderHarness({ children }: { children: React.ReactNode }) {
  return (
    <MenuListHarness>
      <MenuGroup>
        {children}
        <MenuItem>Name</MenuItem>
      </MenuGroup>
    </MenuListHarness>
  );
}

describe('MenuGroup system props', () => {
  testSystemProps(MenuGroup, {
    expectedTag: 'div',
    displayName: 'MenuGroup',
    defaultProps: {
      children: (
        <>
          <MenuGroupHeader>Sort by</MenuGroupHeader>
          <MenuItem>Name</MenuItem>
        </>
      ),
    },
    wrapper: GroupHarness,
  });
});

describe('MenuGroupHeader system props', () => {
  testSystemProps(MenuGroupHeader, {
    expectedTag: 'div',
    displayName: 'MenuGroupHeader',
    defaultProps: { children: 'Sort by' },
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
    wrapper: HeaderHarness,
  });
});
