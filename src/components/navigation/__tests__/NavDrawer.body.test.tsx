import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from '../Nav';
import { NavDrawer, type NavDrawerBodyProps, type NavDrawerProps } from '../NavDrawer';
import { Menu } from '../Menu';
import { MenuButton } from '../../button/MenuButton';
import { SearchBox } from '../../input/SearchBox';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/*
 * P6-08 D130, D131, D113: the keyboard of NavDrawer.Body. `focusMode="tab"` (the default) keeps
 * Nav's model (every entry a Tab stop, no arrow keys); `focusMode="arrow"` makes the body one Tab
 * stop, at first on the current page or the closed category that holds it, with the arrow keys,
 * Home and End over every focusable element in DOM order. The Footer is never an arrow group.
 */

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const body = () => document.querySelector<HTMLElement>('.wave-nav-drawer-body')!;

/** A drawer with a body of `bodyProps` and the given items, and a footer with Help. */
function Drawer({
  bodyProps,
  drawerProps,
  children,
}: {
  bodyProps?: NavDrawerBodyProps;
  drawerProps?: Partial<NavDrawerProps>;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button type="button">Before</button>
      <NavDrawer type="inline" defaultOpen {...drawerProps}>
        <NavDrawer.Body {...bodyProps}>
          {children ?? (
            <>
              <Nav.Item value="home">Home</Nav.Item>
              <Nav.Item value="reports">Reports</Nav.Item>
              <Nav.Item value="archive" disabled>
                Archive
              </Nav.Item>
              <Nav.Category value="settings" label="Settings">
                <Nav.SubItem value="profile">Profile</Nav.SubItem>
                <Nav.SubItem value="account">Account</Nav.SubItem>
              </Nav.Category>
            </>
          )}
        </NavDrawer.Body>
        <NavDrawer.Footer>
          <Nav.Item value="help">Help</Nav.Item>
          <Nav.Item value="about">About</Nav.Item>
        </NavDrawer.Footer>
      </NavDrawer>
      <button type="button">After</button>
    </>
  );
}

const arrow: NavDrawerBodyProps = { focusMode: 'arrow' };

describe('NavDrawer.Body focusMode', () => {
  // 17. Tab mode.
  it("'tab' (default): every enabled entry is a Tab stop and the arrow keys move nothing", async () => {
    const user = userEvent.setup();
    render(<Drawer />);
    expect(body()).toHaveAttribute('data-focus-mode', 'tab');
    expect(body()).not.toHaveAttribute('data-roving-container');
    expect(body().querySelectorAll('[data-roving-value]')).toHaveLength(0);
    act(() => button('Before').focus());
    await user.tab();
    expect(button('Home')).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(button('Home')).toHaveFocus();
    await user.tab();
    expect(button('Reports')).toHaveFocus();
    await user.tab();
    expect(button('Settings')).toHaveFocus();
    await user.tab();
    expect(button('Help')).toHaveFocus();
  });

  // 18. Arrow mode.
  describe("'arrow'", () => {
    it('is one Tab stop, on the current page, with data-focus-mode="arrow"', async () => {
      const user = userEvent.setup();
      render(<Drawer bodyProps={arrow} drawerProps={{ defaultValue: 'reports' }} />);
      expect(body()).toHaveAttribute('data-focus-mode', 'arrow');
      expect(body()).toHaveAttribute('data-roving-container', '');
      act(() => button('Before').focus());
      await user.tab();
      expect(button('Reports')).toHaveFocus();
      await user.tab();
      // Footer items stay Tab stops.
      expect(button('Help')).toHaveFocus();
      await user.tab();
      expect(button('About')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('starts on the closed category that holds the current sub-item', async () => {
      const user = userEvent.setup();
      render(
        <Drawer
          bodyProps={arrow}
          drawerProps={{ defaultValue: 'account', defaultOpenCategories: [] }}
        />,
      );
      expect(button('Settings')).toHaveAttribute('tabindex', '0');
      act(() => button('Before').focus());
      await user.tab();
      expect(button('Settings')).toHaveFocus();
    });

    it('starts on the first enabled element without a current page', async () => {
      const user = userEvent.setup();
      render(<Drawer bodyProps={arrow} />);
      act(() => button('Before').focus());
      await user.tab();
      expect(button('Home')).toHaveFocus();
    });

    it('moves with Down/Right and Up/Left, wrapping, skips disabled entries; Home and End', async () => {
      const user = userEvent.setup();
      render(<Drawer bodyProps={arrow} />);
      act(() => button('Home').focus());
      await user.keyboard('{ArrowDown}');
      expect(button('Reports')).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(button('Settings')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('Home')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(button('Settings')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('Reports')).toHaveFocus();
      await user.keyboard('{End}');
      expect(button('Settings')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(button('Home')).toHaveFocus();
    });

    it('takes item actions, a Nav.AppItem and your own controls into the order', async () => {
      const user = userEvent.setup();
      render(
        <Drawer bodyProps={arrow}>
          <Nav.AppItem>Contoso</Nav.AppItem>
          <Nav.Item
            value="home"
            actions={
              <button type="button" aria-label="Pin Home">
                P
              </button>
            }
          >
            Home
          </Nav.Item>
          <li>
            <button type="button">Custom</button>
          </li>
        </Drawer>,
      );
      act(() => button('Contoso').focus());
      await user.keyboard('{ArrowDown}');
      expect(button('Home')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('Pin Home')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('Custom')).toHaveFocus();
    });

    it('lets a MenuButton action open its Menu with Down, and Right moves past it', async () => {
      const user = userEvent.setup();
      render(
        <Drawer bodyProps={arrow}>
          <Nav.Item
            value="home"
            actions={
              <Menu>
                <Menu.Trigger>
                  <MenuButton appearance="subtle" size="small" aria-label="More options" />
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Copy link</Menu.Item>
                </Menu.Popover>
              </Menu>
            }
          >
            Home
          </Nav.Item>
          <Nav.Item value="reports">Reports</Nav.Item>
        </Drawer>,
      );
      act(() => button('More options').focus());
      await user.keyboard('{ArrowRight}');
      expect(button('Reports')).toHaveFocus();
      await user.keyboard('{ArrowLeft}');
      expect(button('More options')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('More options')).toHaveFocus();
    });

    it('leaves keys typed in a SearchBox inside the body to the field', async () => {
      const user = userEvent.setup();
      render(
        <Drawer bodyProps={arrow}>
          <li>
            <SearchBox aria-label="Find a page" />
          </li>
          <Nav.Item value="home">Home</Nav.Item>
        </Drawer>,
      );
      const field = screen.getByRole('searchbox', { name: 'Find a page' });
      await user.click(field);
      await user.keyboard('ab{ArrowLeft}{ArrowRight}{Home}{End}');
      expect(field).toHaveFocus();
      expect(field).toHaveValue('ab');
    });

    it('toggles a category with Enter and keeps focus on it', async () => {
      const user = userEvent.setup();
      render(<Drawer bodyProps={arrow} />);
      act(() => button('Settings').focus());
      await user.keyboard('{Enter}');
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
      expect(button('Settings')).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(button('Profile')).toHaveFocus();
    });

    it('keeps the last focused element as the stop after Tab out and Shift+Tab back', async () => {
      const user = userEvent.setup();
      render(<Drawer bodyProps={arrow} />);
      act(() => button('Home').focus());
      await user.keyboard('{ArrowDown}');
      expect(button('Reports')).toHaveFocus();
      await user.tab();
      expect(button('Help')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Reports')).toHaveFocus();
    });
  });

  // 19. RTL.
  it('arrow mode in RTL: Left moves to the next element, Right to the previous', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Drawer bodyProps={arrow} />, { dir: 'rtl' });
    act(() => button('Home').focus());
    await user.keyboard('{ArrowLeft}');
    expect(button('Reports')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(button('Home')).toHaveFocus();
  });

  // 20. Mode switch (D131).
  it("switching from 'arrow' to 'tab' gives every item its Tab stop back", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Drawer bodyProps={arrow} />);
    expect(button('Reports')).toHaveAttribute('tabindex', '-1');
    rerender(<Drawer bodyProps={{ focusMode: 'tab' }} />);
    expect(body()).not.toHaveAttribute('data-roving-container');
    expect(body().querySelectorAll('[tabindex="-1"]')).toHaveLength(0);
    expect(body().querySelectorAll('[data-roving-value]')).toHaveLength(0);
    act(() => button('Before').focus());
    await user.tab();
    await user.tab();
    expect(button('Reports')).toHaveFocus();
  });

  // 21. Collapsing and opening the category that holds the stop.
  it('collapsing a category whose sub-item held the stop keeps focus on the toggle, which then holds it', async () => {
    const user = userEvent.setup();
    render(<Drawer bodyProps={arrow} drawerProps={{ defaultOpenCategories: ['settings'] }} />);
    act(() => button('Account').focus());
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(button('Settings')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button('Settings')).toHaveAttribute('aria-expanded', 'false');
    expect(button('Settings')).toHaveFocus();
    expect(button('Settings')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(button('Help')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Settings')).toHaveFocus();
  });

  it('opening the marked category with Enter keeps focus and the stop on the toggle; Tab leaves the body', async () => {
    const user = userEvent.setup();
    render(
      <Drawer
        bodyProps={arrow}
        drawerProps={{ defaultValue: 'account', defaultOpenCategories: [] }}
      />,
    );
    act(() => button('Before').focus());
    await user.tab();
    expect(button('Settings')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
    expect(button('Settings')).toHaveFocus();
    expect(button('Settings')).toHaveAttribute('tabindex', '0');
    expect(button('Account')).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(button('Help')).toHaveFocus();
  });

  // 22. Server rendering of an arrow body.
  it('renders the roving values but no tabindex on the server, and stamps the stop after mount', async () => {
    const element = <Drawer bodyProps={arrow} drawerProps={{ defaultValue: 'reports' }} />;
    const html = renderToString(element);
    expect(html).toContain('data-roving-container=""');
    expect(html).toContain('data-roving-value="reports"');
    expect(html).toContain('data-roving-value="wave-nav-category:settings"');
    expect(html).not.toContain('tabindex');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(button('Reports')).toHaveAttribute('tabindex', '0');
      expect(button('Home')).toHaveAttribute('tabindex', '-1');
    } finally {
      act(() => root?.unmount());
      container.remove();
      error.mockRestore();
      warn.mockRestore();
    }
  });

  // 23. axe.
  it('has no accessibility violations with an arrow body (inline and overlay)', async () => {
    const { unmount } = render(<Drawer bodyProps={arrow} />);
    await expectNoA11yViolations();
    unmount();
    render(<Drawer bodyProps={arrow} drawerProps={{ type: 'overlay', open: true }} />);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
    await expectNoA11yViolations();
  });
});
