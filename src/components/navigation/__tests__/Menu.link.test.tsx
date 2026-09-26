import * as React from 'react';
import { describe, it, expect, vi, afterEach, expectTypeOf, onTestFinished } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuItemLink } from '../Menu.link';
import type { MenuItemLinkOwnProps, MenuItemLinkProps } from '../Menu.link';
import { MenuItem } from '../Menu.items';
import { INERT_MENU_CONTEXT, MenuContext } from '../Menu.context';
import { WaveProvider } from '../../provider/WaveProvider';
import { expectNoA11yViolations, testSystemProps } from '../../../test-utils';
import { MenuListHarness, renderInMenuList } from './menuHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

const link = (name: string) => screen.getByRole('menuitem', { name });

function RtlProvider({ children }: { children: React.ReactNode }) {
  return <WaveProvider dir="rtl">{children}</WaveProvider>;
}

/**
 * Records whether each click that reaches `document` was default-prevented, then prevents it, so
 * jsdom never navigates ("Not implemented: navigation"). The listener runs in the bubble phase on
 * `document`, after React's root listener, so it sees what the item's handlers did; a capture
 * listener would run before React and see nothing.
 */
function recordClicks(): boolean[] {
  const prevented: boolean[] = [];
  const listener = (event: MouseEvent) => {
    prevented.push(event.defaultPrevented);
    event.preventDefault();
  };
  document.addEventListener('click', listener);
  onTestFinished(() => document.removeEventListener('click', listener));
  return prevented;
}

describe('the link element', () => {
  it('is the anchor with its href, role="menuitem", the item row and the link classes', () => {
    renderInMenuList(
      <MenuItemLink href="#settings" icon={{ children: 'S' }} shortcut="Ctrl+,">
        Settings
      </MenuItemLink>,
    );
    const anchor = screen.getByRole('menuitem');
    expect(anchor.tagName).toBe('A');
    expect(anchor).toHaveAttribute('href', '#settings');
    expect(anchor).toHaveAttribute('data-roving-text', 'Settings');
    expect(anchor).toHaveClass(
      'text-foreground',
      'no-underline',
      'flex',
      'px-3',
      'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
      'focus-visible:outline-2',
    );
    const kinds = Array.from(anchor.children).map(
      (child) =>
        child.getAttribute('data-menu-column-space') ??
        (child.hasAttribute('data-menu-icon') ? 'icon' : child.textContent),
    );
    expect(kinds).toEqual(['checkmark', 'icon', 'Settings', 'Ctrl+,']);
    expect(anchor).not.toHaveAttribute('aria-disabled');
    expect(anchor).not.toHaveAttribute('data-disabled');
  });

  it('in RTL its shortcut takes its direction from its own text (dir="auto"): "Ctrl+," is not reordered', () => {
    renderInMenuList(
      <MenuItemLink href="#settings" shortcut="Ctrl+,">
        Settings
      </MenuItemLink>,
      { renderOptions: { wrapper: RtlProvider } },
    );
    expect(screen.getByRole('menuitem').closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('Ctrl+,')).toHaveAttribute('dir', 'auto');
  });

  it('a consumer role wins, as on Menu.Item', () => {
    renderInMenuList(
      <MenuItemLink href="#help" role="menuitemradio" aria-checked="false">
        Help
      </MenuItemLink>,
    );
    expect(screen.getByRole('menuitemradio', { name: 'Help' }).tagName).toBe('A');
  });

  it('in a popup menu outside Menu.Popover it warns that it has no role="menu" parent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <MenuContext.Provider value={{ ...INERT_MENU_CONTEXT, popup: true }}>
        <MenuItemLink href="#settings">Settings</MenuItemLink>
      </MenuContext.Provider>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Menu.ItemLink: rendered in a popup menu outside Menu.Popover, so it has no `role="menu"` parent. A Menu with `open`, `defaultOpen` or `onOpenChange` is a popup menu that renders no element of its own: put the items in Menu.Popover, or leave these props out for a static menu.',
      ],
    ]);
  });
});

describe('activation', () => {
  it('a click is not default-prevented, runs onClick and closes the menu once', async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings" onClick={onClick}>
        Settings
      </MenuItemLink>,
    );
    await user.click(link('Settings'));
    expect(clicks).toEqual([false]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Ctrl', '{Control>}', '{/Control}'],
    ['Shift', '{Shift>}', '{/Shift}'],
    ['Meta', '{Meta>}', '{/Meta}'],
  ])('a %s-click also closes the menu and is not prevented', async (_n, press, release) => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings">Settings</MenuItemLink>,
    );
    await user.keyboard(press);
    await user.click(link('Settings'));
    await user.keyboard(release);
    expect(clicks).toEqual([false]);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it("closes under the Menu's persistOnItemClick too", async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <>
        <MenuItemLink href="#settings">Settings</MenuItemLink>
        <MenuItem>Keep open</MenuItem>
      </>,
      { persistOnItemClick: true },
    );
    await user.click(screen.getByRole('menuitem', { name: 'Keep open' }));
    expect(closeFromItem).not.toHaveBeenCalled();
    await user.click(link('Settings'));
    expect(clicks).toEqual([false, false]);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('Enter on the focused link is left to the browser, whose click follows it and closes the menu', async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings">Settings</MenuItemLink>,
    );
    act(() => link('Settings').focus());
    await user.keyboard('{Enter}');
    expect(clicks).toEqual([false]);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it("Enter's keydown is not default-prevented, with or without Shift, Ctrl or Meta", () => {
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings" onClick={onClick}>
        Settings
      </MenuItemLink>,
    );
    expect(fireEvent.keyDown(link('Settings'), { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(link('Settings'), { key: 'Enter', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(link('Settings'), { key: 'Enter', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(link('Settings'), { key: 'Enter', metaKey: true })).toBe(true);
    // The item dispatches no click of its own for Enter (the browser's activation does).
    expect(onClick).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('Space clicks the link once and is prevented (no page scroll); the click is not', () => {
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings">Settings</MenuItemLink>,
    );
    expect(fireEvent.keyDown(link('Settings'), { key: ' ' })).toBe(false);
    expect(clicks).toEqual([false]);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it("a middle click (auxclick) and the link's context menu stay native and close nothing", () => {
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings">Settings</MenuItemLink>,
    );
    const auxclick = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    expect(fireEvent(link('Settings'), auxclick)).toBe(true);
    expect(fireEvent.contextMenu(link('Settings'))).toBe(true);
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('a consumer onClick that prevents the default keeps the menu open', async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings" onClick={(event) => event.preventDefault()}>
        Settings
      </MenuItemLink>,
    );
    await user.click(link('Settings'));
    expect(clicks).toEqual([true]);
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('in a static list a click navigates and closes nothing', async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#settings">Settings</MenuItemLink>,
      { isStatic: true },
    );
    await user.click(link('Settings'));
    expect(clicks).toEqual([false]);
    expect(closeFromItem).not.toHaveBeenCalled();
  });
});

describe('disabled', () => {
  it('drops the href, is aria-disabled, prevents its click and closes nothing', async () => {
    const user = userEvent.setup();
    const clicks = recordClicks();
    const onClick = vi.fn();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink href="#billing" disabled onClick={onClick}>
        Billing
      </MenuItemLink>,
    );
    const anchor = link('Billing');
    expect(anchor).not.toHaveAttribute('href');
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).toHaveAttribute('data-disabled', '');
    await user.click(anchor);
    expect(clicks).toEqual([true]);
    expect(fireEvent.keyDown(anchor, { key: ' ' })).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
    expect(closeFromItem).not.toHaveBeenCalled();
  });

  it('is skipped by the arrow keys', async () => {
    const user = userEvent.setup();
    renderInMenuList(
      <>
        <MenuItemLink href="#profile">Profile</MenuItemLink>
        <MenuItemLink href="#billing" disabled>
          Billing
        </MenuItemLink>
        <MenuItemLink href="#settings">Settings</MenuItemLink>
      </>,
    );
    await user.tab();
    expect(link('Profile')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(link('Settings')).toHaveFocus();
  });
});

describe('a router link through `as`', () => {
  interface RouterLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    /** The route. */
    to: string;
    ref?: React.Ref<HTMLAnchorElement>;
  }

  /** A test router link: navigates on a click whose default nobody prevented, as routers do. */
  function createRouterLink() {
    const received: Array<Record<string, unknown>> = [];
    const seen: boolean[] = [];
    const navigations: string[] = [];
    function RouterLink({ to, onClick, ref, ...rest }: RouterLinkProps) {
      received.push({
        to,
        role: rest.role,
        onClick: typeof onClick,
        onKeyDown: typeof rest.onKeyDown,
      });
      return (
        <a
          {...rest}
          ref={ref}
          href={to}
          onClick={(event) => {
            onClick?.(event);
            seen.push(event.defaultPrevented);
            if (!event.defaultPrevented) navigations.push(to);
            event.preventDefault();
          }}
        />
      );
    }
    return { RouterLink, received, seen, navigations };
  }

  it('receives `to`, the role and the handlers; a click navigates and closes the menu', async () => {
    const user = userEvent.setup();
    recordClicks();
    const { RouterLink, received, seen, navigations } = createRouterLink();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink as={RouterLink} to="/settings">
        Settings
      </MenuItemLink>,
    );
    expect(received.at(-1)).toEqual({
      to: '/settings',
      role: 'menuitem',
      onClick: 'function',
      onKeyDown: 'function',
    });
    expect(link('Settings')).toHaveAttribute('href', '/settings');
    await user.click(link('Settings'));
    expect(seen).toEqual([false]);
    expect(navigations).toEqual(['/settings']);
    expect(closeFromItem).toHaveBeenCalledTimes(1);
  });

  it('disabled: the click reaches the router default-prevented, and `to` still renders', async () => {
    const user = userEvent.setup();
    recordClicks();
    const { RouterLink, seen, navigations } = createRouterLink();
    const { closeFromItem } = renderInMenuList(
      <MenuItemLink as={RouterLink} to="/billing" disabled>
        Billing
      </MenuItemLink>,
    );
    expect(link('Billing')).toHaveAttribute('href', '/billing');
    expect(link('Billing')).toHaveAttribute('aria-disabled', 'true');
    await user.click(link('Billing'));
    expect(seen).toEqual([true]);
    expect(navigations).toEqual([]);
    expect(closeFromItem).not.toHaveBeenCalled();
  });
});

describe('typeahead', () => {
  const links = (
    <>
      <MenuItemLink href="#profile" icon={{ children: 'S' }}>
        Profile
      </MenuItemLink>
      <MenuItemLink href="#settings">Settings</MenuItemLink>
      <MenuItemLink href="#help">
        <span>Help center</span>
      </MenuItemLink>
    </>
  );

  it('matches the label, not the icon', async () => {
    const user = userEvent.setup();
    renderInMenuList(links);
    await user.tab();
    await user.keyboard('s');
    expect(link('Settings')).toHaveFocus();
  });

  it('matches a non-string label by its text', async () => {
    const user = userEvent.setup();
    renderInMenuList(links);
    await user.tab();
    await user.keyboard('h');
    expect(link('Help center')).toHaveFocus();
  });
});

describe('accessibility', () => {
  const links = (
    <>
      <MenuItemLink href="#profile">Profile</MenuItemLink>
      <MenuItemLink href="#billing" disabled>
        Billing
      </MenuItemLink>
      <MenuItemLink href="https://example.com/help" target="_blank" rel="noreferrer">
        Help (opens in a new window)
      </MenuItemLink>
      <MenuItem>Sign out</MenuItem>
    </>
  );

  it('has no axe violations in a popover list', async () => {
    renderInMenuList(links);
    await expectNoA11yViolations();
  });

  it('has no axe violations in a static list', async () => {
    renderInMenuList(links, { isStatic: true });
    await expectNoA11yViolations();
  });
});

describe('MenuItemLink system props', () => {
  testSystemProps(MenuItemLink, {
    expectedTag: 'a',
    displayName: 'MenuItemLink',
    polymorphic: true,
    defaultProps: { href: '#settings', children: 'Settings' },
    a11yVariants: [{ name: 'disabled', props: { disabled: true } }],
    conflictingClass: { className: 'px-4', overrides: 'px-3' },
    wrapper: function LinkHarness({ children }) {
      return <MenuListHarness>{children}</MenuListHarness>;
    },
  });
});

describe('types', () => {
  it('is polymorphic: an anchor by default, or a router link with its own props', () => {
    interface RouterLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
      to: string;
    }
    const RouterLink = ({ to, ...rest }: RouterLinkProps) => <a {...rest} href={to} />;
    expectTypeOf<MenuItemLinkProps<typeof RouterLink>['to']>().toEqualTypeOf<string>();
    expectTypeOf<MenuItemLinkProps<'a'>['href']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MenuItemLinkOwnProps['children']>().toEqualTypeOf<React.ReactNode>();
    const withRouter = (
      <MenuItemLink as={RouterLink} to="/settings">
        Settings
      </MenuItemLink>
    );
    // @ts-expect-error -- an anchor has no `to`
    const unknownProp = <MenuItemLink to="/settings">Settings</MenuItemLink>;
    // @ts-expect-error -- the router link requires `to`
    const missingTo = <MenuItemLink as={RouterLink}>Settings</MenuItemLink>;
    expect([withRouter, unknownProp, missingTo]).toHaveLength(3);
  });
});
