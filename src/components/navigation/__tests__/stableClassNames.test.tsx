/**
 * Stable class names of the navigation folder (spec P3-00, Appendix A "navigation"): every root,
 * part and variant carries its registered classes on the element the registry names, in every
 * layout where it renders, the portaled submenu and the server HTML included. The values are read
 * from the registry, never written as literals.
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  breadcrumbClassNames,
  breadcrumbItemClassNames,
  buttonClassNames,
  drawerClassNames,
  hamburgerClassNames,
  menuClassNames,
  menuDividerClassNames,
  menuGroupClassNames,
  menuGroupHeaderClassNames,
  menuItemCheckboxClassNames,
  menuItemClassNames,
  menuItemLinkClassNames,
  menuItemRadioClassNames,
  menuItemSwitchClassNames,
  menuPopoverClassNames,
  menuSplitGroupClassNames,
  navAppItemClassNames,
  navAppItemStaticClassNames,
  navCategoryClassNames,
  navClassNames,
  navDividerClassNames,
  navDrawerBodyClassNames,
  navDrawerClassNames,
  navDrawerFooterClassNames,
  navDrawerHeaderClassNames,
  navItemClassNames,
  navSectionHeaderClassNames,
  navSubItemClassNames,
  paginationClassNames,
  stepperClassNames,
  stepperStepClassNames,
} from '../../../lib/classNames';
import { Breadcrumb } from '../Breadcrumb';
import { Menu } from '../Menu';
import { Hamburger } from '../Hamburger';
import { Nav } from '../Nav';
import { NavDrawer, type NavDrawerProps } from '../NavDrawer';
import { Pagination } from '../Pagination';
import { Stepper } from '../Stepper';

/** Server HTML in a detached element (never appended: src/test-setup.ts checks document.body). */
function parse(html: string): HTMLDivElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

/** The element the icon slot rendered around a test glyph. */
function iconBoxOf(testId: string): HTMLElement | null {
  return screen.getByTestId(testId).parentElement;
}

describe('stable class names: navigation folder', () => {
  it('Breadcrumb: root, list, list items, dividers; link, button, asChild and current items; icon', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="#home" icon={<svg data-testid="home-icon" />}>
          Home
        </Breadcrumb.Item>
        <Breadcrumb.Item onClick={() => {}}>Library</Breadcrumb.Item>
        <Breadcrumb.Item asChild>
          <a href="#docs">Docs</a>
        </Breadcrumb.Item>
        <Breadcrumb.Item current>Reports</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveClass(breadcrumbClassNames.root);
    const list = within(nav).getByRole('list');
    expect(list).toHaveClass(breadcrumbClassNames.list);
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    for (const item of items) expect(item).toHaveClass(breadcrumbClassNames.listItem);
    expect(items[0].querySelector('[data-wave-breadcrumb-separator]')).toBeNull();
    expect(items[1].firstElementChild).toHaveClass(breadcrumbClassNames.divider);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveClass(breadcrumbItemClassNames.root);
    expect(iconBoxOf('home-icon')).toHaveClass(breadcrumbItemClassNames.icon);
    expect(screen.getByRole('button', { name: 'Library' })).toHaveClass(
      breadcrumbItemClassNames.root,
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveClass(breadcrumbItemClassNames.root);
    expect(screen.getByText('Reports')).toHaveClass(breadcrumbItemClassNames.root);
  });

  it('Menu: static root, item parts, the item kinds as variants, divider, group and split group', async () => {
    const user = userEvent.setup();
    render(
      <Menu
        aria-label="Edit"
        defaultCheckedValues={{ view: ['grid'], sort: ['name'], wrap: ['on'] }}
      >
        <Menu.Item icon={<svg data-testid="cut-icon" />} shortcut="Ctrl+X">
          Cut
        </Menu.Item>
        <Menu.ItemLink
          href="#settings"
          icon={<svg data-testid="settings-icon" />}
          shortcut="Ctrl+,"
        >
          Settings
        </Menu.ItemLink>
        <Menu.Divider />
        <Menu.Group>
          <Menu.GroupHeader>View</Menu.GroupHeader>
          <Menu.ItemCheckbox
            name="view"
            value="grid"
            icon={<svg data-testid="grid-icon" />}
            shortcut="G"
          >
            Grid
          </Menu.ItemCheckbox>
          <Menu.ItemRadio
            name="sort"
            value="name"
            icon={<svg data-testid="sort-icon" />}
            shortcut="N"
          >
            By name
          </Menu.ItemRadio>
          <Menu.ItemSwitch
            name="wrap"
            value="on"
            icon={<svg data-testid="wrap-icon" />}
            shortcut="W"
          >
            Wrap
          </Menu.ItemSwitch>
        </Menu.Group>
        <Menu.SplitGroup>
          <Menu.Item>Save</Menu.Item>
          <Menu>
            <Menu.Trigger>
              <Menu.Item aria-label="Save options" />
            </Menu.Trigger>
            <Menu.Popover>
              <Menu.Item>Save as</Menu.Item>
            </Menu.Popover>
          </Menu>
        </Menu.SplitGroup>
      </Menu>,
    );
    expect(screen.getByRole('menu', { name: 'Edit' })).toHaveClass(menuClassNames.root);

    const cut = screen.getByRole('menuitem', { name: /^Cut/ });
    expect(cut).toHaveClass(menuItemClassNames.root);
    expect(iconBoxOf('cut-icon')).toHaveClass(menuItemClassNames.icon);
    expect(within(cut).getByText('Cut')).toHaveClass(menuItemClassNames.content);
    expect(within(cut).getByText('Ctrl+X')).toHaveClass(menuItemClassNames.shortcut);
    // A plain item's check column is a placeholder: no part class (Appendix A, judgement 3).
    expect(cut.querySelector('[data-menu-column-space="checkmark"]')).not.toHaveClass(
      menuItemClassNames.checkmark,
    );

    const settings = screen.getByRole('menuitem', { name: /^Settings/ });
    expect(settings).toHaveClass(menuItemClassNames.root, menuItemLinkClassNames.root);
    expect(iconBoxOf('settings-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemLinkClassNames.icon,
    );
    expect(within(settings).getByText('Settings')).toHaveClass(
      menuItemClassNames.content,
      menuItemLinkClassNames.content,
    );
    expect(within(settings).getByText('Ctrl+,')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemLinkClassNames.shortcut,
    );

    const grid = screen.getByRole('menuitemcheckbox', { name: /^Grid/ });
    expect(grid).toHaveClass(menuItemClassNames.root, menuItemCheckboxClassNames.root);
    expect(grid.querySelector('[data-menu-checkmark]')).toHaveClass(
      menuItemClassNames.checkmark,
      menuItemCheckboxClassNames.checkmark,
    );
    expect(iconBoxOf('grid-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemCheckboxClassNames.icon,
    );
    expect(within(grid).getByText('Grid')).toHaveClass(
      menuItemClassNames.content,
      menuItemCheckboxClassNames.content,
    );
    expect(within(grid).getByText('G')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemCheckboxClassNames.shortcut,
    );

    const byName = screen.getByRole('menuitemradio', { name: /^By name/ });
    expect(byName).toHaveClass(menuItemClassNames.root, menuItemRadioClassNames.root);
    expect(byName.querySelector('[data-menu-checkmark]')).toHaveClass(
      menuItemClassNames.checkmark,
      menuItemRadioClassNames.checkmark,
    );
    expect(iconBoxOf('sort-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemRadioClassNames.icon,
    );
    expect(within(byName).getByText('By name')).toHaveClass(
      menuItemClassNames.content,
      menuItemRadioClassNames.content,
    );
    expect(within(byName).getByText('N')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemRadioClassNames.shortcut,
    );

    const wrap = screen.getByRole('menuitemcheckbox', { name: /^Wrap/ });
    expect(wrap).toHaveClass(menuItemClassNames.root, menuItemSwitchClassNames.root);
    const track = wrap.querySelector('[data-menu-switch]') as HTMLElement;
    expect(track).toHaveClass(menuItemSwitchClassNames.track);
    expect(track.firstElementChild).toHaveClass(menuItemSwitchClassNames.thumb);
    expect(iconBoxOf('wrap-icon')).toHaveClass(
      menuItemClassNames.icon,
      menuItemSwitchClassNames.icon,
    );
    expect(within(wrap).getByText('Wrap')).toHaveClass(
      menuItemClassNames.content,
      menuItemSwitchClassNames.content,
    );
    expect(within(wrap).getByText('W')).toHaveClass(
      menuItemClassNames.shortcut,
      menuItemSwitchClassNames.shortcut,
    );

    expect(screen.getByRole('separator')).toHaveClass(menuDividerClassNames.root);
    expect(screen.getByRole('group', { name: 'View' })).toHaveClass(menuGroupClassNames.root);
    expect(screen.getByText('View')).toHaveClass(menuGroupHeaderClassNames.root);
    expect(screen.getByRole('menuitem', { name: 'Save' }).parentElement).toHaveClass(
      menuSplitGroupClassNames.root,
    );

    const half = screen.getByRole('menuitem', { name: 'Save options' });
    expect(half.querySelector('svg')).toHaveClass(menuItemClassNames.submenuIndicator);
    await user.click(half);
    const popover = screen.getByRole('menu', { name: 'Save options' });
    expect(popover).toHaveClass(menuPopoverClassNames.root);
    expect(popover).not.toHaveClass(menuClassNames.root);
  });

  it('Nav: root, list; items (link and button) with list item, icon and content; category; sub-items', () => {
    render(
      <Nav aria-label="Main" defaultValue="weekly" defaultOpenCategories={['reports']}>
        <Nav.Item value="home" href="#home" icon={<svg data-testid="home-icon" />}>
          Home
        </Nav.Item>
        <Nav.Item value="settings">Settings</Nav.Item>
        <Nav.Category value="reports" label="Reports" icon={<svg data-testid="reports-icon" />}>
          <Nav.SubItem value="weekly" href="#weekly">
            Weekly
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveClass(navClassNames.root);
    expect(nav.firstElementChild).toHaveClass(navClassNames.list);

    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveClass(navItemClassNames.root);
    expect(home.parentElement).toHaveClass(navItemClassNames.listItem);
    expect(iconBoxOf('home-icon')).toHaveClass(navItemClassNames.icon);
    expect(within(home).getByText('Home')).toHaveClass(navItemClassNames.content);
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(settings).toHaveClass(navItemClassNames.root);
    expect(settings.parentElement).toHaveClass(navItemClassNames.listItem);

    const toggle = screen.getByRole('button', { name: 'Reports' });
    expect(toggle).toHaveClass(navCategoryClassNames.button);
    expect(toggle.parentElement).toHaveClass(navCategoryClassNames.root);
    expect(iconBoxOf('reports-icon')).toHaveClass(navCategoryClassNames.icon);
    expect(within(toggle).getByText('Reports')).toHaveClass(navCategoryClassNames.label);
    expect(toggle.lastElementChild).toHaveClass(navCategoryClassNames.expandIcon);

    const weekly = screen.getByRole('link', { name: 'Weekly' });
    expect(weekly).toHaveClass(navSubItemClassNames.root);
    expect(weekly.parentElement).toHaveClass(navSubItemClassNames.listItem);
    expect(weekly.parentElement?.parentElement).toHaveClass(navCategoryClassNames.list);
  });

  it('Nav parts: section header and its list item, divider, app item (root, list item, icon, content), app item static, the actions of an item and a sub-item', () => {
    const tree = (
      <Nav aria-label="Main" defaultValue="weekly">
        <Nav.AppItem href="#start" icon={<svg data-testid="app-icon" />}>
          Contoso HR
        </Nav.AppItem>
        <Nav.AppItem>Switch app</Nav.AppItem>
        <Nav.SectionHeader>Library</Nav.SectionHeader>
        <Nav.Item value="home" actions={<button type="button">Pin home</button>}>
          Home
        </Nav.Item>
        <Nav.Divider />
        <Nav.Category value="reports" label="Reports">
          <Nav.SectionHeader headingLevel={4}>Schedules</Nav.SectionHeader>
          <Nav.SubItem value="weekly" actions={<button type="button">Pin weekly</button>}>
            Weekly
          </Nav.SubItem>
          <Nav.Divider />
        </Nav.Category>
        <Nav.AppItemStatic icon={<svg data-testid="static-icon" />}>Fabrikam</Nav.AppItemStatic>
      </Nav>
    );
    const check = (root: HTMLElement) => {
      for (const appItem of [
        within(root).getByRole('link', { name: 'Contoso HR' }),
        within(root).getByRole('button', { name: 'Switch app' }),
      ]) {
        expect(appItem).toHaveClass(navAppItemClassNames.root);
        expect(appItem.parentElement).toHaveClass(navAppItemClassNames.listItem);
        expect(appItem.lastElementChild).toHaveClass(navAppItemClassNames.content);
      }
      expect(within(root).getByTestId('app-icon').parentElement).toHaveClass(
        navAppItemClassNames.icon,
      );
      const staticItem = within(root).getByTestId('static-icon').parentElement
        ?.parentElement as HTMLElement;
      expect(staticItem).toHaveClass(navAppItemStaticClassNames.root);
      expect(staticItem).not.toHaveClass(navAppItemClassNames.root);
      expect(staticItem.parentElement).toHaveClass(navAppItemStaticClassNames.listItem);
      expect(staticItem.firstElementChild).toHaveClass(navAppItemStaticClassNames.icon);
      expect(staticItem.lastElementChild).toHaveClass(navAppItemStaticClassNames.content);
      for (const name of ['Library', 'Schedules']) {
        const heading = within(root).getByRole('heading', { name });
        expect(heading).toHaveClass(navSectionHeaderClassNames.root);
        expect(heading.parentElement).toHaveClass(navSectionHeaderClassNames.listItem);
      }
      // Found through the item: a detached server tree cannot resolve the group's name.
      const itemActions = within(root).getByRole('button', { name: 'Home' })
        .nextElementSibling as HTMLElement;
      expect(itemActions).toHaveClass(navItemClassNames.actions);
      expect(itemActions.parentElement).toHaveClass(navItemClassNames.listItem);
      const subItemActions = within(root).getByRole('button', { name: 'Weekly' })
        .nextElementSibling as HTMLElement;
      expect(subItemActions).toHaveClass(navSubItemClassNames.actions);
      expect(subItemActions.parentElement).toHaveClass(navSubItemClassNames.listItem);
      const dividers = root.querySelectorAll('li[aria-hidden="true"]');
      expect(dividers).toHaveLength(2);
      for (const divider of Array.from(dividers)) {
        expect(divider).toHaveClass(navDividerClassNames.root);
      }
    };
    check(parse(renderToString(tree)));
    render(tree);
    check(screen.getByRole('navigation', { name: 'Main' }));
  });

  it("NavDrawer: panel root (with Drawer's), backdrop, nav; header, body and footer with their lists; in both types and in the server HTML", () => {
    const tree = (type: NavDrawerProps['type']) => (
      <NavDrawer type={type} open onOpenChange={() => {}} aria-label="Main">
        <NavDrawer.Header>Contoso HR</NavDrawer.Header>
        <NavDrawer.Body>
          <Nav.Item value="home">Home</Nav.Item>
        </NavDrawer.Body>
        <NavDrawer.Footer>
          <Nav.Item value="help">Help</Nav.Item>
        </NavDrawer.Footer>
      </NavDrawer>
    );
    const check = (nav: HTMLElement) => {
      expect(nav).toHaveClass(navDrawerClassNames.nav);
      expect(nav.parentElement).toHaveClass(drawerClassNames.root, navDrawerClassNames.root);
      const [header, body, footer] = Array.from(nav.children);
      expect(header).toHaveClass(navDrawerHeaderClassNames.root);
      expect(header).not.toHaveClass(drawerClassNames.header);
      expect(body).toHaveClass(navDrawerBodyClassNames.root);
      expect(body).not.toHaveClass(drawerClassNames.body);
      expect(body.firstElementChild).toHaveClass(navDrawerBodyClassNames.list);
      expect(footer).toHaveClass(navDrawerFooterClassNames.root);
      expect(footer.firstElementChild).toHaveClass(navDrawerFooterClassNames.list);
    };
    check(parse(renderToString(tree('inline'))).querySelector('nav')!);
    const { unmount } = render(tree('inline'));
    check(screen.getByRole('navigation', { name: 'Main' }));
    unmount();
    render(tree('overlay'));
    const dialog = screen.getByRole('dialog', { name: 'Main' });
    check(within(dialog).getByRole('navigation', { name: 'Main' }));
    const backdrop = dialog.previousElementSibling;
    expect(backdrop).toHaveClass(drawerClassNames.backdrop, navDrawerClassNames.backdrop);
  });

  it("Hamburger: root and icon (with Button's)", () => {
    const check = (button: HTMLElement) => {
      expect(button).toHaveClass(buttonClassNames.root, hamburgerClassNames.root);
      const icon = button.querySelector('[data-wave-icon="navigation"]')!.parentElement;
      expect(icon).toHaveClass(buttonClassNames.icon, hamburgerClassNames.icon);
    };
    check(parse(renderToString(<Hamburger />)).querySelector('button')!);
    render(<Hamburger />);
    check(screen.getByRole('button', { name: 'Navigation' }));
  });

  it('Pagination: root, list, every list item, the five button kinds and the ellipses', () => {
    render(<Pagination totalPages={10} defaultCurrentPage={5} showFirstLast />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveClass(paginationClassNames.root);
    const list = nav.firstElementChild as HTMLElement;
    expect(list).toHaveClass(paginationClassNames.list);
    // Also the aria-hidden list items of the ellipses, which getAllByRole would skip.
    for (const item of Array.from(list.children)) {
      expect(item).toHaveClass(paginationClassNames.listItem);
    }
    expect(screen.getByRole('button', { name: 'First page' })).toHaveClass(
      paginationClassNames.firstButton,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toHaveClass(
      paginationClassNames.previousButton,
    );
    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveClass(
      paginationClassNames.pageButton,
    );
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveClass(
      paginationClassNames.nextButton,
    );
    expect(screen.getByRole('button', { name: 'Last page' })).toHaveClass(
      paginationClassNames.lastButton,
    );
    const ellipses = screen.getAllByText('…');
    expect(ellipses).toHaveLength(2);
    for (const ellipsis of ellipses) expect(ellipsis).toHaveClass(paginationClassNames.ellipsis);
  });

  it("Stepper: root, list; a step's list item, root, button, indicator, icon, label, description, connector", () => {
    render(
      <Stepper defaultActiveStep={1}>
        <Stepper.Step
          label="Account"
          description="Your details"
          icon={<svg data-testid="account-icon" />}
        />
        <Stepper.Step label="Plan" />
      </Stepper>,
    );
    const root = screen.getByRole('group', { name: 'Progress' });
    expect(root).toHaveClass(stepperClassNames.root);
    const list = within(root).getByRole('list');
    expect(list).toHaveClass(stepperClassNames.list);
    const [first] = within(list).getAllByRole('listitem');
    // The <li> sits outside the step's className target and keeps its part class.
    expect(first).toHaveClass(stepperStepClassNames.listItem);
    const stepRoot = first.firstElementChild as HTMLElement;
    expect(stepRoot).toHaveClass(stepperStepClassNames.root);
    const button = within(first).getByRole('button');
    expect(button).toHaveClass(stepperStepClassNames.button);
    expect(button.firstElementChild).toHaveClass(stepperStepClassNames.indicator);
    expect(iconBoxOf('account-icon')).toHaveClass(stepperStepClassNames.icon);
    expect(screen.getByText('Account')).toHaveClass(stepperStepClassNames.label);
    expect(screen.getByText('Your details')).toHaveClass(stepperStepClassNames.description);
    expect(stepRoot.lastElementChild).toHaveClass(stepperStepClassNames.connector);
  });

  it('renders the classes in the server HTML (renderToString)', () => {
    const host = parse(
      renderToString(
        <>
          <Breadcrumb>
            <Breadcrumb.Item href="#home">Home</Breadcrumb.Item>
            <Breadcrumb.Item current>Reports</Breadcrumb.Item>
          </Breadcrumb>
          <Menu aria-label="File">
            <Menu.Item>Open</Menu.Item>
          </Menu>
        </>,
      ),
    );
    expect(host.querySelector('nav')).toHaveClass(breadcrumbClassNames.root);
    expect(host.querySelector('ol')).toHaveClass(breadcrumbClassNames.list);
    expect(host.querySelector('li')).toHaveClass(breadcrumbClassNames.listItem);
    expect(host.querySelector('[data-wave-breadcrumb-separator]')).toHaveClass(
      breadcrumbClassNames.divider,
    );
    expect(host.querySelector('a')).toHaveClass(breadcrumbItemClassNames.root);
    expect(host.querySelector('[role="menu"]')).toHaveClass(menuClassNames.root);
    expect(host.querySelector('[role="menuitem"]')).toHaveClass(menuItemClassNames.root);
  });
});
