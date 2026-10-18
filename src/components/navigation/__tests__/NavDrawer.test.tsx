import { afterEach, describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav } from '../Nav';
import {
  NavDrawer,
  NavDrawerBody,
  NavDrawerFooter,
  NavDrawerHeader,
  type NavDrawerProps,
} from '../NavDrawer';
import { Hamburger } from '../Hamburger';
import { Toaster } from '../../feedback/Toaster';
import { drawerClassNames, navDrawerClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import type { ModalType } from '../../../lib/types';
import {
  asClientReference,
  expectNoA11yViolations,
  expectThrows,
  findDanglingIdRefs,
  findDanglingIdRefsInHtml,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

/*
 * P6-08 (D124–D139): NavDrawer is Nav's state and a <nav> landmark in the drawer panel shell, an
 * overlay (a named dialog around the <nav>, in a portal) or an inline panel, with its Header, Body
 * and Footer parts. The keyboard of the body is in NavDrawer.body.test.tsx, the Hamburger in
 * Hamburger.test.tsx and the App shell story in NavDrawer.appShell.test.tsx.
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const navigation = (name = 'Navigation') => screen.getByRole('navigation', { name });
const panelOf = (nav: HTMLElement) => nav.parentElement as HTMLElement;
const backdrop = () => document.querySelector<HTMLElement>('.' + navDrawerClassNames.backdrop);

/** Body content: two items, a category with two sub-items and a disabled item. */
const bodyItems = (
  <>
    <Nav.Item value="home">Home</Nav.Item>
    <Nav.Item value="reports">Reports</Nav.Item>
    <Nav.Category value="settings" label="Settings">
      <Nav.SubItem value="profile">Profile</Nav.SubItem>
      <Nav.SubItem value="account">Account</Nav.SubItem>
    </Nav.Category>
    <Nav.Item value="archive" disabled>
      Archive
    </Nav.Item>
  </>
);

/** A full drawer's parts: a Header with a Hamburger, the Body and a Footer. */
const parts = (
  <>
    <NavDrawer.Header>
      <Hamburger />
      Contoso HR
    </NavDrawer.Header>
    <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
    <NavDrawer.Footer>
      <Nav.Item value="help">Help</Nav.Item>
    </NavDrawer.Footer>
  </>
);

/** A controlled drawer opened from a page button, with its open state in the page. */
function Page({
  drawerProps,
  children = parts,
  initialOpen = false,
}: {
  drawerProps?: Partial<NavDrawerProps>;
  children?: React.ReactNode;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen((previous) => !previous)}>
        Open navigation
      </button>
      <NavDrawer
        {...drawerProps}
        open={open}
        onOpenChange={(next, details) => {
          drawerProps?.onOpenChange?.(next, details);
          setOpen(next);
        }}
      >
        {children}
      </NavDrawer>
      <button type="button">Page action</button>
    </>
  );
}

describe('NavDrawer', () => {
  // 1. System props.
  describe('system props', () => {
    testSystemProps(NavDrawer, {
      expectedTag: 'div',
      displayName: 'NavDrawer',
      defaultProps: {
        type: 'inline',
        defaultOpen: true,
        children: (
          <NavDrawer.Body>
            <Nav.Item value="home">Home</Nav.Item>
          </NavDrawer.Body>
        ),
      },
      conflictingClass: { className: 'w-96', overrides: 'w-80' },
      control: { role: 'navigation' },
      a11yVariants: [
        { name: 'overlay open', props: { type: 'overlay' } },
        { name: 'non-modal overlay', props: { type: 'overlay', modalType: 'non-modal' } },
        {
          name: 'arrow body',
          props: {
            children: (
              <NavDrawer.Body focusMode="arrow">
                <Nav.Item value="home">Home</Nav.Item>
                <Nav.Item value="reports">Reports</Nav.Item>
              </NavDrawer.Body>
            ),
          },
        },
        { name: 'end position', props: { position: 'end' } },
        {
          name: 'closed category holding the current page',
          props: {
            defaultValue: 'profile',
            defaultOpenCategories: [],
            children: <NavDrawer.Body>{bodyItems}</NavDrawer.Body>,
          },
        },
        { name: 'medium size', props: { size: 'medium' } },
      ],
    });

    it('carries Drawer root class and its own on the panel, and the nav class on the <nav>', () => {
      render(
        <NavDrawer type="inline" defaultOpen>
          <NavDrawer.Body>
            <Nav.Item value="home">Home</Nav.Item>
          </NavDrawer.Body>
        </NavDrawer>,
      );
      const nav = navigation();
      expect(panelOf(nav)).toHaveClass(drawerClassNames.root, navDrawerClassNames.root);
      expect(nav).toHaveClass(navDrawerClassNames.nav);
      expect(nav).not.toHaveClass('wave-nav');
    });
  });

  // 2. Compound exposure, the parts' system props and implicit submission.
  describe('parts', () => {
    testCompoundExposure(NavDrawer, ['Header', 'Body', 'Footer']);

    it('exports every sub-component under its flat name (C-COMPOUND)', () => {
      expect(NavDrawerHeader).toBe(NavDrawer.Header);
      expect(NavDrawerBody).toBe(NavDrawer.Body);
      expect(NavDrawerFooter).toBe(NavDrawer.Footer);
    });

    function OpenDrawer({ children }: { children: React.ReactNode }) {
      return (
        <NavDrawer type="inline" defaultOpen>
          {children}
        </NavDrawer>
      );
    }

    describe('NavDrawer.Header', () => {
      testSystemProps(NavDrawerHeader, {
        expectedTag: 'div',
        displayName: 'NavDrawerHeader',
        defaultProps: { children: 'Contoso HR' },
        conflictingClass: { className: 'ps-4', overrides: 'ps-2.5' },
        wrapper: OpenDrawer,
        a11y: false,
      });
    });

    describe('NavDrawer.Body', () => {
      testSystemProps(NavDrawerBody, {
        expectedTag: 'div',
        displayName: 'NavDrawerBody',
        defaultProps: { children: <Nav.Item value="home">Home</Nav.Item> },
        conflictingClass: { className: 'py-4', overrides: 'py-2' },
        wrapper: OpenDrawer,
        a11y: false,
      });
    });

    describe('NavDrawer.Footer', () => {
      testSystemProps(NavDrawerFooter, {
        expectedTag: 'div',
        displayName: 'NavDrawerFooter',
        defaultProps: { children: <Nav.Item value="help">Help</Nav.Item> },
        conflictingClass: { className: 'py-4', overrides: 'py-2' },
        wrapper: OpenDrawer,
        a11y: false,
      });
    });

    it('has no accessibility violations with all three parts (inline and overlay)', async () => {
      const { unmount } = render(
        <NavDrawer type="inline" defaultOpen>
          {parts}
        </NavDrawer>,
      );
      await expectNoA11yViolations();
      unmount();
      render(<Page initialOpen>{parts}</Page>);
      await expectNoA11yViolations();
    });

    testNoImplicitSubmit(NavDrawer, {
      defaultProps: {
        type: 'inline',
        open: true,
        children: (
          <>
            <NavDrawer.Header>
              <Hamburger />
            </NavDrawer.Header>
            <NavDrawer.Body>
              <Nav.Category value="settings" label="Settings">
                <Nav.SubItem value="profile">Profile</Nav.SubItem>
              </Nav.Category>
            </NavDrawer.Body>
          </>
        ),
      },
    });
  });

  // 3. DOM per type.
  describe('DOM', () => {
    it('inline: a role-less panel around a <nav>, the parts in written order, lists of <li>', () => {
      const { container } = render(
        <NavDrawer type="inline" defaultOpen>
          <NavDrawer.Footer>
            <Nav.Item value="help">Help</Nav.Item>
          </NavDrawer.Footer>
          <NavDrawer.Header>Contoso HR</NavDrawer.Header>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
        </NavDrawer>,
      );
      const panel = container.firstElementChild as HTMLElement;
      expect(panel.localName).toBe('div');
      expect(panel).not.toHaveAttribute('role');
      expect(panel).not.toHaveAttribute('aria-label');
      expect(panel).not.toHaveAttribute('aria-labelledby');
      expect(panel).not.toHaveAttribute('tabindex');
      expect(panel).toHaveAttribute('data-type', 'inline');
      const nav = panel.firstElementChild as HTMLElement;
      expect(nav.localName).toBe('nav');
      expect(nav).toBe(navigation());
      expect(nav).toHaveAttribute('aria-label', 'Navigation');
      expect(panel.children).toHaveLength(1);
      const [footer, header, body] = Array.from(nav.children) as HTMLElement[];
      expect(footer).toHaveClass('wave-nav-drawer-footer');
      expect(header).toHaveClass('wave-nav-drawer-header');
      expect(body).toHaveClass('wave-nav-drawer-body');
      for (const part of [footer, body]) {
        const list = part.firstElementChild as HTMLElement;
        expect(list.localName).toBe('ul');
        expect(Array.from(list.children).every((child) => child.localName === 'li')).toBe(true);
      }
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('overlay: a dialog named like the <nav> inside it, without aria-modal', () => {
      render(<Page initialOpen />);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(dialog).not.toHaveAttribute('aria-modal');
      expect(dialog).toHaveAttribute('data-type', 'overlay');
      expect(dialog).toContainElement(navigation());
      expect(dialog.firstElementChild).toBe(navigation());
      expect(backdrop()).toBe(dialog.previousElementSibling);
    });
  });

  // 4. Naming.
  describe('naming', () => {
    it('renames the <nav> and the dialog with aria-label', () => {
      render(<Page initialOpen drawerProps={{ 'aria-label': 'Main' }} />);
      expect(screen.getByRole('dialog', { name: 'Main' })).toContainElement(navigation('Main'));
    });

    it('names both from aria-labelledby (a heading in the Header) and drops the default', () => {
      render(
        <Page initialOpen drawerProps={{ 'aria-labelledby': 'app-title' }}>
          <NavDrawer.Header>
            <h2 id="app-title">Contoso HR</h2>
          </NavDrawer.Header>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
        </Page>,
      );
      const dialog = screen.getByRole('dialog', { name: 'Contoso HR' });
      const nav = navigation('Contoso HR');
      expect(dialog).not.toHaveAttribute('aria-label');
      expect(nav).not.toHaveAttribute('aria-label');
      expect(nav).toHaveAttribute('aria-labelledby', 'app-title');
    });

    it('describes both with aria-describedby; inline only the <nav>', () => {
      const description = (
        <p id="nav-hint" hidden>
          Pages of the app
        </p>
      );
      const { unmount } = render(
        <>
          {description}
          <Page initialOpen drawerProps={{ 'aria-describedby': 'nav-hint' }} />
        </>,
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'nav-hint');
      expect(navigation()).toHaveAttribute('aria-describedby', 'nav-hint');
      unmount();
      render(
        <>
          {description}
          <NavDrawer
            type="inline"
            defaultOpen
            aria-label="Main"
            aria-describedby="nav-hint"
            data-testid="panel"
          >
            {parts}
          </NavDrawer>
        </>,
      );
      expect(navigation('Main')).toHaveAttribute('aria-describedby', 'nav-hint');
      expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-describedby');
      expect(screen.getByTestId('panel')).not.toHaveAttribute('aria-label');
    });
  });

  // 5. Nav through NavDrawer.
  describe('Nav state', () => {
    it('calls onValueChange once per change and onItemSelect on every activation (StrictMode)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onItemSelect = vi.fn();
      render(
        <React.StrictMode>
          <NavDrawer
            type="inline"
            defaultOpen
            defaultValue="home"
            onValueChange={onValueChange}
            onItemSelect={onItemSelect}
          >
            {parts}
          </NavDrawer>
        </React.StrictMode>,
      );
      await user.click(button('Reports'));
      expect(onValueChange.mock.calls).toEqual([['reports']]);
      expect(onItemSelect.mock.calls).toEqual([['reports']]);
      expect(button('Reports')).toHaveAttribute('aria-current', 'page');
      // The current item again: an activation, no change.
      await user.click(button('Reports'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onItemSelect.mock.calls).toEqual([['reports'], ['reports']]);
      // A footer item is a Nav item of the same drawer.
      await user.click(button('Help'));
      expect(onValueChange.mock.calls).toEqual([['reports'], ['help']]);
      expect(button('Reports')).not.toHaveAttribute('aria-current');
    });

    it('does not report a disabled item, a Ctrl+click on a link, or a prevented button item', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onItemSelect = vi.fn();
      // Link navigation in jsdom: the bubble-phase listener prevents it.
      const recordAndPrevent = (event: MouseEvent) => event.preventDefault();
      document.addEventListener('click', recordAndPrevent);
      try {
        render(
          <NavDrawer
            type="inline"
            defaultOpen
            defaultValue="home"
            onValueChange={onValueChange}
            onItemSelect={onItemSelect}
          >
            <NavDrawer.Body>
              <Nav.Item value="home">Home</Nav.Item>
              <Nav.Item value="docs" href="#docs">
                Docs
              </Nav.Item>
              <Nav.Item value="blocked" onClick={(event) => event.preventDefault()}>
                Blocked
              </Nav.Item>
              <Nav.Item value="archive" disabled>
                Archive
              </Nav.Item>
            </NavDrawer.Body>
          </NavDrawer>,
        );
        await user.click(button('Archive'));
        await user.keyboard('{Control>}');
        await user.click(screen.getByRole('link', { name: 'Docs' }));
        await user.keyboard('{/Control}');
        await user.click(button('Blocked'));
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onItemSelect).not.toHaveBeenCalled();
        expect(button('Archive')).not.toHaveAttribute('aria-current');
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
      } finally {
        document.removeEventListener('click', recordAndPrevent);
      }
    });

    it('takes a controlled value', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const { rerender } = render(
        <NavDrawer type="inline" defaultOpen value="home" onValueChange={onValueChange}>
          {parts}
        </NavDrawer>,
      );
      await user.click(button('Reports'));
      expect(onValueChange).toHaveBeenCalledWith('reports');
      expect(button('Home')).toHaveAttribute('aria-current', 'page');
      rerender(
        <NavDrawer type="inline" defaultOpen value="reports" onValueChange={onValueChange}>
          {parts}
        </NavDrawer>,
      );
      expect(button('Reports')).toHaveAttribute('aria-current', 'page');
    });

    it('opens the category of the current page through NavDrawer.Body, unless defaultOpenCategories is empty', () => {
      const { unmount } = render(
        <NavDrawer type="inline" defaultOpen defaultValue="profile">
          {parts}
        </NavDrawer>,
      );
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
      expect(button('Profile')).toHaveAttribute('aria-current', 'page');
      unmount();
      render(
        <NavDrawer type="inline" defaultOpen defaultValue="profile" defaultOpenCategories={[]}>
          {parts}
        </NavDrawer>,
      );
      const settings = button('Settings');
      expect(settings).toHaveAttribute('aria-expanded', 'false');
      expect(settings).toHaveAttribute('aria-current', 'true');
      expect(settings).toHaveAttribute('data-contains-current');
    });

    it('marks the currentCategory hint', () => {
      render(
        <NavDrawer
          type="inline"
          defaultOpen
          defaultValue="elsewhere"
          defaultOpenCategories={[]}
          currentCategory="settings"
        >
          {parts}
        </NavDrawer>,
      );
      expect(button('Settings')).toHaveAttribute('data-contains-current');
    });

    it('takes openCategories controlled and uncontrolled (StrictMode once)', async () => {
      const user = userEvent.setup();
      const onOpenCategoriesChange = vi.fn();
      const { unmount } = render(
        <React.StrictMode>
          <NavDrawer type="inline" defaultOpen onOpenCategoriesChange={onOpenCategoriesChange}>
            {parts}
          </NavDrawer>
        </React.StrictMode>,
      );
      await user.click(button('Settings'));
      expect(onOpenCategoriesChange.mock.calls).toEqual([[['settings']]]);
      expect(button('Profile')).toBeInTheDocument();
      unmount();
      const controlled = vi.fn();
      render(
        <NavDrawer
          type="inline"
          defaultOpen
          openCategories={['settings']}
          onOpenCategoriesChange={controlled}
        >
          {parts}
        </NavDrawer>,
      );
      await user.click(button('Settings'));
      expect(controlled).toHaveBeenCalledWith([]);
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
    });

    it('warns once per duplicated value with the NavDrawer key and text', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <NavDrawer type="inline" defaultOpen>
            <NavDrawer.Body>
              <Nav.Item value="home">Home</Nav.Item>
              <Nav.Category value="docs" label="Docs">
                {null}
              </Nav.Category>
            </NavDrawer.Body>
            <NavDrawer.Footer>
              <Nav.Item value="home">Start</Nav.Item>
              <Nav.Category value="docs" label="Guides">
                {null}
              </Nav.Category>
            </NavDrawer.Footer>
          </NavDrawer>,
        );
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] NavDrawer: several items share the value "home". Nav.Item and Nav.SubItem values must be unique within a NavDrawer; every item with the current value is marked as the current page.',
          ],
          [
            '[WaveUI] NavDrawer: several categories share the value "docs". Nav.Category values must be unique within a NavDrawer; they open and close together.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('has none of Nav’s deprecated aliases', () => {
      // @ts-expect-error -- NavDrawer is new: it takes `value`, not Nav's deprecated `selectedValue`.
      const props: NavDrawerProps = { selectedValue: 'home' };
      expect(props).toBeDefined();
    });
  });

  // 6. Open state.
  describe('open state', () => {
    it('is uncontrolled with defaultOpen and controlled with open', () => {
      const { rerender } = render(
        <NavDrawer type="inline" open={false}>
          {parts}
        </NavDrawer>,
      );
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      rerender(
        <NavDrawer type="inline" open>
          {parts}
        </NavDrawer>,
      );
      expect(navigation()).toBeInTheDocument();
    });

    it('overlay: Escape closes it (escape), once under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <Page initialOpen drawerProps={{ onOpenChange }} />
        </React.StrictMode>,
      );
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'escape', event: expect.any(Event) }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('overlay: a backdrop press closes it (outside-press); a drag from inside does not', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page initialOpen drawerProps={{ onOpenChange }} />);
      fireEvent.pointerDown(button('Home'));
      fireEvent.click(backdrop()!);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.click(backdrop()!);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'outside-press' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('non-modal: no backdrop, nothing inert; Escape closes it from inside, not from the page', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page initialOpen drawerProps={{ modalType: 'non-modal', onOpenChange }} />);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(dialog).toHaveAttribute('data-modal-type', 'non-modal');
      expect(backdrop()).toBeNull();
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
      act(() => button('Page action').focus());
      await user.keyboard('{Escape}');
      expect(onOpenChange).not.toHaveBeenCalled();
      act(() => button('Home').focus());
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );
    });

    it('inline: Escape and a press outside call nothing', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page initialOpen drawerProps={{ type: 'inline', onOpenChange }} />);
      await user.click(button('Home'));
      await user.keyboard('{Escape}');
      await user.click(button('Page action'));
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(navigation()).toBeInTheDocument();
    });

    it('treats an alert modalType passed through a cast as modal', () => {
      const alert: ModalType = 'alert';
      render(
        <Page initialOpen drawerProps={{ modalType: alert as NavDrawerProps['modalType'] }} />,
      );
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(dialog).toHaveAttribute('data-modal-type', 'modal');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  // 7. Focus.
  describe('focus', () => {
    it('overlay: focuses the Header’s Hamburger, traps Tab, and Escape returns focus to the opener', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Open navigation'));
      const dialog = screen.getByRole('dialog');
      const inner = button('Navigation');
      expect(inner).toHaveFocus();
      expect(dialog).toContainElement(inner);
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      expect(button('Help')).toHaveFocus();
      await user.tab();
      expect(inner).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(button('Open navigation')).toHaveFocus();
    });

    it('overlay without a Header: focuses the body’s first stop', async () => {
      const user = userEvent.setup();
      render(
        <Page>
          <NavDrawer.Body>{bodyItems}</NavDrawer.Body>
        </Page>,
      );
      await user.click(button('Open navigation'));
      expect(button('Home')).toHaveFocus();
    });

    it('overlay: finalFocusRef wins', async () => {
      const user = userEvent.setup();
      function WithFinal() {
        const finalRef = React.useRef<HTMLButtonElement>(null);
        return (
          <>
            <button type="button" ref={finalRef}>
              Final
            </button>
            <Page drawerProps={{ finalFocusRef: finalRef }} />
          </>
        );
      }
      render(<WithFinal />);
      await user.click(button('Open navigation'));
      await user.keyboard('{Escape}');
      expect(button('Final')).toHaveFocus();
    });

    it('inline: opening keeps focus; the inner Hamburger closing it moves focus to finalFocusRef', async () => {
      const user = userEvent.setup();
      function Shell() {
        const outerRef = React.useRef<HTMLButtonElement>(null);
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <Hamburger
              ref={outerRef}
              aria-label="Show navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            />
            <NavDrawer type="inline" open={open} onOpenChange={setOpen} finalFocusRef={outerRef}>
              {parts}
            </NavDrawer>
          </>
        );
      }
      render(<Shell />);
      await user.click(button('Show navigation'));
      expect(button('Show navigation')).toHaveFocus();
      await user.click(button('Navigation'));
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(button('Show navigation')).toHaveFocus();
    });

    it('inline: a controlled close while focus is on the page leaves it there', () => {
      render(<Page initialOpen drawerProps={{ type: 'inline' }} />);
      expect(navigation()).toBeInTheDocument();
      act(() => button('Page action').focus());
      // The page closes it (a click that moves no focus): focus is not inside, so it stays.
      fireEvent.click(button('Open navigation'));
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
      expect(button('Page action')).toHaveFocus();
    });
  });

  // 8. Props.
  describe('props', () => {
    it('defaults: start position, small size, separator; size medium', () => {
      const { rerender } = render(
        <NavDrawer type="inline" defaultOpen data-testid="panel">
          {parts}
        </NavDrawer>,
      );
      const panel = screen.getByTestId('panel');
      expect(panel).toHaveAttribute('data-position', 'start');
      expect(panel).toHaveAttribute('data-size', 'small');
      expect(panel).toHaveAttribute('data-separator', '');
      expect(panel).toHaveClass('border-e', 'w-80', 'data-[separator]:border-border');
      rerender(
        <NavDrawer type="inline" defaultOpen data-testid="panel" size="medium" separator={false}>
          {parts}
        </NavDrawer>,
      );
      expect(panel).toHaveAttribute('data-size', 'medium');
      expect(panel).toHaveClass('w-148');
      expect(panel).not.toHaveAttribute('data-separator');
    });

    it('overlay: the logical start classes', () => {
      render(<Page initialOpen />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('data-position', 'start');
      expect(dialog).toHaveAttribute('data-modal-type', 'modal');
      expect(dialog).toHaveClass('start-0', 'border-e', 'w-80');
    });

    it('unmountOnClose={false} keeps a closed panel hidden and inert with its selection; outer aria-controls stays valid', async () => {
      const user = userEvent.setup();
      function Kept() {
        const [open, setOpen] = React.useState(true);
        return (
          <>
            <Hamburger
              aria-label="Show navigation"
              aria-expanded={open}
              aria-controls="kept-nav"
              onClick={() => setOpen(!open)}
            />
            <NavDrawer
              id="kept-nav"
              type="inline"
              open={open}
              onOpenChange={setOpen}
              unmountOnClose={false}
            >
              {parts}
            </NavDrawer>
          </>
        );
      }
      render(<Kept />);
      await user.click(button('Reports'));
      await user.click(button('Show navigation'));
      const panel = document.getElementById('kept-nav')!;
      expect(panel).toHaveAttribute('hidden');
      expect(panel).toHaveAttribute('inert');
      expect(findDanglingIdRefs()).toEqual([]);
      await user.click(button('Show navigation'));
      expect(panel).not.toHaveAttribute('hidden');
      expect(button('Reports')).toHaveAttribute('aria-current', 'page');
    });

    it('backdrop={null} renders no backdrop', () => {
      render(<Page initialOpen drawerProps={{ backdrop: null }} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(backdrop()).toBeNull();
    });

    it('warns NavDrawer:backdrop-ignored for a backdrop on an inline drawer', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <NavDrawer type="inline" defaultOpen backdrop={{ appearance: 'transparent' }}>
            {parts}
          </NavDrawer>,
        );
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] NavDrawer: `backdrop` is ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });
  });

  // 9. A type switch.
  describe('changing type', () => {
    function Switching({ type }: { type: NavDrawerProps['type'] }) {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open navigation
          </button>
          <NavDrawer type={type} open={open} onOpenChange={setOpen} defaultValue="home">
            {parts}
          </NavDrawer>
        </>
      );
    }

    it('overlay → inline keeps the value and open categories; focus goes to the opener', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Switching type="overlay" />);
      await user.click(button('Open navigation'));
      await user.click(button('Reports'));
      await user.click(button('Settings'));
      expect(button('Settings')).toHaveFocus();
      rerender(<Switching type="inline" />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(button('Reports')).toHaveAttribute('aria-current', 'page');
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
      expect(button('Open navigation')).toHaveFocus();
    });

    it('inline → overlay keeps the state; focus moves into the overlay', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Switching type="inline" />);
      await user.click(button('Open navigation'));
      await user.click(button('Reports'));
      await user.click(button('Settings'));
      rerender(<Switching type="overlay" />);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      expect(button('Reports')).toHaveAttribute('aria-current', 'page');
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // 10. Server rendering.
  describe('server rendering', () => {
    const inline = (onOpenChange: () => void) => (
      <NavDrawer type="inline" defaultOpen defaultValue="profile" onOpenChange={onOpenChange}>
        {parts}
      </NavDrawer>
    );

    it('renders an open inline drawer: the <nav>, the open current category, aria-current, no dangling id', () => {
      const html = renderToString(inline(() => {}));
      expect(html).toContain('<nav');
      expect(html).toContain('aria-current="page"');
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      const parsed = document.createElement('div');
      parsed.innerHTML = html;
      const panel = parsed.firstElementChild as HTMLElement;
      expect(panel).toHaveAttribute('data-type', 'inline');
      const settings = Array.from(parsed.querySelectorAll('button')).find(
        (element) => element.textContent === 'Settings',
      );
      expect(settings).toHaveAttribute('aria-expanded', 'true');
      const hamburger = parsed.querySelector('button[aria-label="Navigation"]');
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');
      expect(hamburger).toHaveAttribute('aria-controls', panel.id);
      for (const part of ['header', 'body', 'footer']) {
        expect(parsed.querySelector(`.wave-nav-drawer-${part}`)).toHaveAttribute(
          'data-scroll-state',
          'none',
        );
      }
    });

    it('hydrates without a mismatch or an onOpenChange call', async () => {
      const onOpenChange = vi.fn();
      const element = inline(onOpenChange);
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        const serverNav = container.querySelector('nav');
        await act(async () => {
          root = hydrateRoot(container, element, { onRecoverableError });
        });
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(navigation()).toBe(serverNav);
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
        warn.mockRestore();
      }
    });

    it('renders nothing of an open overlay on the server; it opens after hydration', async () => {
      const element = (
        <NavDrawer open onOpenChange={() => {}}>
          {parts}
        </NavDrawer>
      );
      const html = renderToString(element);
      expect(html).toBe('');
      const container = document.createElement('div');
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
        expect(error).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });
  });

  // 11. RTL.
  it('uses logical classes in a right-to-left layout', () => {
    renderWithProviders(
      <NavDrawer type="inline" defaultOpen data-testid="panel">
        {parts}
      </NavDrawer>,
      { dir: 'rtl' },
    );
    const className = screen.getByTestId('panel').className;
    expect(className).toMatch(/\bborder-e\b/);
    expect(className).not.toMatch(/\b(border-[lr]|left-0|right-0|[mp][lr]-)/);
  });

  // 12. Context.
  describe('parts outside a NavDrawer', () => {
    it.each([
      ['NavDrawer.Header', () => <NavDrawer.Header>Contoso</NavDrawer.Header>],
      [
        'NavDrawer.Body',
        () => (
          <NavDrawer.Body>
            <li>Item</li>
          </NavDrawer.Body>
        ),
      ],
      [
        'NavDrawer.Footer',
        () => (
          <NavDrawer.Footer>
            <li>Item</li>
          </NavDrawer.Footer>
        ),
      ],
    ] as const)('%s throws in development', (name, renderOrphan) => {
      expectThrows(renderOrphan(), `[WaveUI] ${name} must be used within NavDrawer`);
    });

    it('logs each misplaced part once in production and renders it', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const orphans = (count: number) => (
          <>
            {Array.from({ length: count }, (_, index) => (
              <React.Fragment key={index}>
                <NavDrawer.Header>Header {index}</NavDrawer.Header>
                <NavDrawer.Body>
                  <li>Body {index}</li>
                </NavDrawer.Body>
                <NavDrawer.Footer>
                  <li>Footer {index}</li>
                </NavDrawer.Footer>
              </React.Fragment>
            ))}
          </>
        );
        const { rerender } = render(orphans(1));
        rerender(orphans(2));
        expect(screen.getByText('Header 1')).toHaveAttribute('data-scroll-state', 'none');
        expect(screen.getByText('Body 1')).toBeInTheDocument();
        expect(screen.getByText('Footer 1')).toBeInTheDocument();
        expect(error.mock.calls).toEqual([
          ['[WaveUI] NavDrawer.Header must be used within NavDrawer'],
          ['[WaveUI] NavDrawer.Body must be used within NavDrawer'],
          ['[WaveUI] NavDrawer.Footer must be used within NavDrawer'],
        ]);
      } finally {
        error.mockRestore();
        vi.unstubAllEnvs();
      }
    });
  });

  // 13. Warnings.
  describe('development warnings', () => {
    const UNREACHABLE =
      '[WaveUI] NavDrawer is closed and nothing can open it: it is uncontrolled (no `open` prop), and a Hamburger inside it cannot be reached while it is closed. Control it with `open` and `onOpenChange`, and open it from a Hamburger (or any button) outside it.';
    const LOOSE =
      '[WaveUI] NavDrawer: a list item sits outside NavDrawer.Body and NavDrawer.Footer, the parts that render a list. Move Nav.Item, Nav.Category and the other Nav parts into NavDrawer.Body or NavDrawer.Footer.';

    it('warns NavDrawer:unreachable once for an uncontrolled closed drawer', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { rerender } = render(<NavDrawer type="inline">{parts}</NavDrawer>);
        rerender(<NavDrawer type="inline">{parts}</NavDrawer>);
        expect(warn.mock.calls).toEqual([[UNREACHABLE]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('warns NavDrawer:unreachable after an inner Hamburger closes an uncontrolled drawer', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <NavDrawer type="inline" defaultOpen>
            {parts}
          </NavDrawer>,
        );
        expect(warn).not.toHaveBeenCalled();
        await user.click(button('Navigation'));
        expect(warn.mock.calls).toEqual([[UNREACHABLE]]);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not warn for a controlled closed drawer', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Page />);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it.each([
      [
        'a Nav.Item in the Header',
        <NavDrawer.Header key="header">
          <Nav.Item value="home">Home</Nav.Item>
        </NavDrawer.Header>,
      ],
      [
        'a Nav.Item written directly in NavDrawer',
        <Nav.Item key="item" value="home">
          Home
        </Nav.Item>,
      ],
    ])('warns NavDrawer:loose-items once for %s', (_, child) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const tree = (
          <NavDrawer type="inline" defaultOpen>
            {child}
            <NavDrawer.Body>
              <Nav.Item value="reports">Reports</Nav.Item>
            </NavDrawer.Body>
          </NavDrawer>
        );
        const { rerender } = render(tree);
        rerender(tree);
        expect(warn.mock.calls).toEqual([[LOOSE]]);
      } finally {
        warn.mockRestore();
      }
    });

    it.each(['Body', 'Footer'] as const)(
      'warns NavDrawer.%s:list-child for a <div> in its list',
      (part) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const Part = part === 'Body' ? NavDrawer.Body : NavDrawer.Footer;
        try {
          render(
            <NavDrawer type="inline" defaultOpen>
              <Part>
                <div>Stray</div>
              </Part>
            </NavDrawer>,
          );
          expect(warn.mock.calls).toEqual([
            [
              `[WaveUI] NavDrawer.${part}: its list holds a <div> element, but a list can hold only <li> elements. Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>.`,
            ],
          ]);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it('warns NavDrawer:non-modal-full for an open non-modal full overlay only', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { unmount } = render(<Page initialOpen drawerProps={{ size: 'full' }} />);
        unmount();
        const small = render(<Page initialOpen drawerProps={{ modalType: 'non-modal' }} />);
        small.unmount();
        expect(warn).not.toHaveBeenCalled();
        render(<Page initialOpen drawerProps={{ modalType: 'non-modal', size: 'full' }} />);
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] NavDrawer: `size="full"` with `modalType="non-modal"` covers the whole page while leaving it usable, so Tab reaches controls hidden behind the drawer. Use `modalType="modal"`, `type="inline"`, or a smaller size with its room reserved in the page layout.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('warns neither Drawer:unnamed nor Button:icon-only-name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(<Page initialOpen />);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  // 14. Server Components.
  describe('parts written in a Server Component', () => {
    const LazyHeader = asClientReference(NavDrawerHeader);
    const LazyBody = asClientReference(NavDrawerBody);
    const LazyFooter = asClientReference(NavDrawerFooter);
    const LazyItem = asClientReference(Nav.Item);
    const LazyCategory = asClientReference(Nav.Category);
    const LazySubItem = asClientReference(Nav.SubItem);

    const plain = (
      <NavDrawer type="inline" defaultOpen defaultValue="profile" onOpenChange={() => {}}>
        <NavDrawer.Header>Contoso HR</NavDrawer.Header>
        <NavDrawer.Body>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category value="settings" label="Settings">
            <Nav.SubItem value="profile">Profile</Nav.SubItem>
          </Nav.Category>
        </NavDrawer.Body>
        <NavDrawer.Footer>
          <Nav.Item value="help">Help</Nav.Item>
        </NavDrawer.Footer>
      </NavDrawer>
    );
    const lazy = (
      <NavDrawer type="inline" defaultOpen defaultValue="profile" onOpenChange={() => {}}>
        <LazyHeader>Contoso HR</LazyHeader>
        <LazyBody>
          <LazyItem value="home">Home</LazyItem>
          <LazyCategory value="settings" label="Settings">
            <LazySubItem value="profile">Profile</LazySubItem>
          </LazyCategory>
        </LazyBody>
        <LazyFooter>
          <LazyItem value="help">Help</LazyItem>
        </LazyFooter>
      </NavDrawer>
    );

    it('renders the same server HTML', () => {
      expect(renderToString(lazy)).toBe(renderToString(plain));
    });

    it('behaves the same: the current category is open, a click selects', async () => {
      const user = userEvent.setup();
      render(lazy);
      expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
      expect(button('Profile')).toHaveAttribute('aria-current', 'page');
      await user.click(button('Home'));
      expect(button('Home')).toHaveAttribute('aria-current', 'page');
    });
  });

  // 15. Scroll state.
  describe('scroll state', () => {
    function stubScroll(element: HTMLElement, metrics: { scrollTop: number }) {
      Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 600 });
      Object.defineProperty(element, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(element, 'scrollTop', {
        configurable: true,
        value: metrics.scrollTop,
      });
    }

    it('renders data-scroll-state on the Header, Body and Footer, with the separator classes', () => {
      const { container } = render(
        <NavDrawer type="inline" defaultOpen>
          {parts}
        </NavDrawer>,
      );
      const header = container.querySelector<HTMLElement>('.wave-nav-drawer-header')!;
      const body = container.querySelector<HTMLElement>('.wave-nav-drawer-body')!;
      const footer = container.querySelector<HTMLElement>('.wave-nav-drawer-footer')!;
      expect(header).toHaveClass('border-b', 'data-[scroll-state=middle]:border-border');
      expect(footer).toHaveClass('border-t', 'data-[scroll-state=top]:border-border');
      for (const part of [header, body, footer]) {
        expect(part).toHaveAttribute('data-scroll-state', 'none');
      }
      for (const [scrollTop, state] of [
        [0, 'top'],
        [200, 'middle'],
        [400, 'bottom'],
      ] as const) {
        stubScroll(body, { scrollTop });
        act(() => {
          fireEvent.scroll(body);
        });
        for (const part of [header, body, footer]) {
          expect(part).toHaveAttribute('data-scroll-state', state);
        }
      }
    });

    it('is none without a Body', () => {
      const { container } = render(
        <NavDrawer type="inline" defaultOpen>
          <NavDrawer.Header>Contoso</NavDrawer.Header>
          <NavDrawer.Footer>
            <Nav.Item value="help">Help</Nav.Item>
          </NavDrawer.Footer>
        </NavDrawer>,
      );
      expect(container.querySelector('.wave-nav-drawer-header')).toHaveAttribute(
        'data-scroll-state',
        'none',
      );
    });

    it('does not re-render a memoised Nav item when the scroll state changes', () => {
      const onRender = vi.fn();
      const Items = React.memo(function Items() {
        return (
          <React.Profiler id="items" onRender={onRender}>
            <Nav.Item value="home">Home</Nav.Item>
          </React.Profiler>
        );
      });
      const { container } = render(
        <NavDrawer type="inline" defaultOpen>
          <NavDrawer.Header>Contoso</NavDrawer.Header>
          <NavDrawer.Body>
            <Items />
          </NavDrawer.Body>
        </NavDrawer>,
      );
      const initial = onRender.mock.calls.length;
      const body = container.querySelector<HTMLElement>('.wave-nav-drawer-body')!;
      stubScroll(body, { scrollTop: 200 });
      act(() => {
        fireEvent.scroll(body);
      });
      expect(body).toHaveAttribute('data-scroll-state', 'middle');
      expect(onRender).toHaveBeenCalledTimes(initial);
    });
  });

  // 16. Toaster.
  describe('beside a Toaster', () => {
    const attachStartEdge = (element: HTMLElement | null) => {
      if (!element) return;
      element.getBoundingClientRect = () =>
        ({
          left: 0,
          right: 320,
          top: 0,
          bottom: 768,
          width: 320,
          height: 768,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
    };
    const offset = () =>
      screen
        .getByRole('region', { name: 'Notifications' })
        .style.getPropertyValue('--wave-toaster-offset');

    it('moves bottom-start toasts beside an open overlay at the start edge', () => {
      render(
        <Toaster position="bottom-start">
          <NavDrawer open onOpenChange={() => {}} ref={attachStartEdge}>
            {parts}
          </NavDrawer>
        </Toaster>,
      );
      expect(offset()).toBe('320px');
    });

    it('moves no toast for an inline drawer', () => {
      render(
        <Toaster position="bottom-start">
          <NavDrawer type="inline" open onOpenChange={() => {}} ref={attachStartEdge}>
            {parts}
          </NavDrawer>
        </Toaster>,
      );
      expect(offset()).toBe('');
    });
  });
});
