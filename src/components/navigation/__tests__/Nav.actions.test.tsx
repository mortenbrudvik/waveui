/**
 * Item actions (spec P6-09, D119–D121): `actions` on Nav.Item and Nav.SubItem (Fluent's
 * SplitNavItem). The consumer's controls render after the item's link or button, in a group named
 * by the item, never inside it; they never select the item; with actions the row carries the
 * selected look and the hover, and the actions are drawn by opacity on hover, focus and holds.
 */
import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Nav } from '../Nav';
import type { NavItemOwnProps } from '../Nav';
import { Menu } from '../Menu';
import { MenuButton } from '../../button/MenuButton';
import { ToggleButton } from '../../button/ToggleButton';
import { Tooltip } from '../../overlays/Tooltip';
import { navItemClassNames, navSubItemClassNames } from '../../../lib/classNames';
import { navActionsRevealMotion } from '../../../lib/motion';
import {
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

/** The classes of D120 that draw the actions on hover, focus, holds, touch and forced colours. */
const REVEAL_CLASSES = [
  '*:opacity-0',
  'group-hover/nav-row:*:opacity-100',
  'group-focus-within/nav-row:*:opacity-100',
  'forced-colors:*:opacity-100',
  '[@media(hover:none)]:*:opacity-100',
  '*:has-[[aria-pressed=true]]:opacity-100',
  '*:has-[[aria-expanded=true]]:opacity-100',
  '[&>[aria-pressed=true]]:opacity-100',
  '[&>[aria-expanded=true]]:opacity-100',
];

/** Actions that render nothing (a factory each, since a generator is one-shot). */
const EMPTY_ACTIONS = [
  ['false', () => false],
  ['null', () => null],
  ['an empty array', () => []],
  ['an empty Fragment', () => <></>],
  [
    'a generator of nothing',
    function* nothing() {
      yield null;
      yield false;
    },
  ],
] as Array<[string, () => React.ReactNode]>;

const PinGlyph = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
    <path d="M5 2h6l-1 4 2 2v1H9v5l-1 1-1-1V9H4V8l2-2z" />
  </svg>
);

const group = (name: string) => screen.getByRole('group', { name });

describe('placement', () => {
  it.each([
    ['button', undefined],
    ['link', '#reports'],
  ] as const)(
    'renders the group after a %s item, in its list item and never inside it',
    (role, href) => {
      render(
        <Nav defaultValue="home">
          <Nav.Item value="reports" href={href} actions={<button type="button">Pin</button>}>
            Reports
          </Nav.Item>
        </Nav>,
      );
      const item = screen.getByRole(role, { name: 'Reports' });
      expect(within(item).queryAllByRole('button')).toEqual([]);
      expect(item.nextElementSibling).toBe(group('Reports'));
      expect(item.parentElement?.tagName).toBe('LI');
      expect(group('Reports').parentElement).toBe(item.parentElement);
      expect(group('Reports')).toHaveAttribute('data-wave-nav-actions', '');
      expect(within(group('Reports')).getByRole('button', { name: 'Pin' })).toBeInTheDocument();
    },
  );

  it.each([
    ['button', undefined],
    ['link', '#reports'],
  ] as const)(
    'renders the group after a %s item whose href is known only at run time, never inside it',
    (role, href) => {
      const maybeHref = href as string | undefined;
      render(
        <Nav>
          <Nav.Item value="reports" href={maybeHref} actions={<button type="button">Pin</button>}>
            Reports
          </Nav.Item>
        </Nav>,
      );
      const item = screen.getByRole(role, { name: 'Reports' });
      expect(within(item).queryAllByRole('button')).toEqual([]);
      expect(item.nextElementSibling).toBe(group('Reports'));
      expect(group('Reports').parentElement).toBe(item.parentElement);
    },
  );

  it('renders the group of a sub-item in an open category, with its own class', () => {
    render(
      <Nav defaultOpenCategories={['docs']}>
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="api" href="#api" actions={<button type="button">Pin API</button>}>
            API
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const link = screen.getByRole('link', { name: 'API' });
    expect(within(link).queryAllByRole('button')).toEqual([]);
    expect(link.nextElementSibling).toBe(group('API'));
    expect(group('API')).toHaveClass(navSubItemClassNames.actions);
    expect(group('API')).not.toHaveClass(navItemClassNames.actions);
  });
});

describe('naming', () => {
  it('names the group by the item through a generated id', () => {
    render(
      <Nav>
        <Nav.Item value="reports" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    const item = screen.getByRole('button', { name: 'Reports' });
    expect(item.id).toMatch(/^wave-nav-item/);
    expect(group('Reports')).toHaveAttribute('aria-labelledby', item.id);
  });

  it('reuses a consumer id (no second id)', () => {
    render(
      <Nav>
        <Nav.Item value="reports" id="reports-item" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(screen.getByRole('button', { name: 'Reports' })).toHaveAttribute('id', 'reports-item');
    expect(group('Reports')).toHaveAttribute('aria-labelledby', 'reports-item');
    expect(document.querySelectorAll('[id]')).toHaveLength(1);
  });

  it('follows a consumer aria-label on the item', () => {
    render(
      <Nav>
        <Nav.Item
          value="reports"
          aria-label="Quarterly reports"
          actions={<button type="button">Pin</button>}
        >
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(group('Quarterly reports')).toHaveClass(navItemClassNames.actions);
  });
});

describe('keyboard and pointer', () => {
  function ActionsNav({ onValueChange }: { onValueChange?: (value: string) => void }) {
    return (
      <Nav defaultValue="home" onValueChange={onValueChange}>
        <Nav.Item
          value="reports"
          actions={
            <>
              <button type="button">Pin</button>
              <button type="button">More options</button>
            </>
          }
        >
          Reports
        </Nav.Item>
        <Nav.Item value="home">Home</Nav.Item>
      </Nav>
    );
  }

  it('puts every action in the Tab order after its item, before the next item', async () => {
    const user = userEvent.setup();
    render(<ActionsNav />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Reports' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Pin' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'More options' })).toHaveFocus();
  });

  it('never selects the item on a click, Enter or Space on an action (StrictMode once)', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onPin = vi.fn();
    render(
      <React.StrictMode>
        <Nav defaultValue="home" onValueChange={onValueChange}>
          <Nav.Item
            value="reports"
            actions={
              <button type="button" onClick={onPin}>
                Pin
              </button>
            }
          >
            Reports
          </Nav.Item>
          <Nav.Item value="home">Home</Nav.Item>
        </Nav>
      </React.StrictMode>,
    );
    const pin = screen.getByRole('button', { name: 'Pin' });
    await user.click(pin);
    pin.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onPin).toHaveBeenCalledTimes(3);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reports' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: 'Reports' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith('reports');
  });

  it('keeps the actions of a disabled item enabled', async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    render(
      <Nav>
        <Nav.Item
          value="reports"
          disabled
          actions={
            <button type="button" onClick={onPin}>
              Pin
            </button>
          }
        >
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(screen.getByRole('button', { name: 'Reports' })).toBeDisabled();
    const pin = screen.getByRole('button', { name: 'Pin' });
    expect(pin).toBeEnabled();
    await user.click(pin);
    expect(onPin).toHaveBeenCalledTimes(1);
  });
});

describe('actions that render nothing', () => {
  it.each(EMPTY_ACTIONS)('%s renders no group and keeps the look of 0.10', (_, make) => {
    render(
      <Nav defaultValue="reports">
        <Nav.Item value="reports" actions={make()}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(screen.queryByRole('group')).toBeNull();
    const item = screen.getByRole('button', { name: 'Reports' });
    expect(item).not.toHaveAttribute('id');
    expect(item).toHaveClass('bg-subtle-selected', 'border-s-2', 'border-s-primary');
    expect(item).not.toHaveClass('min-w-0', 'flex-1');
    const row = item.parentElement as HTMLElement;
    expect(row.className).toBe(navItemClassNames.listItem);
  });

  it('renders the items of a generator with content', () => {
    function* actions() {
      yield (
        <button key="pin" type="button">
          Pin
        </button>
      );
      yield (
        <button key="more" type="button">
          More options
        </button>
      );
    }
    render(
      <Nav>
        <Nav.Item value="reports" actions={actions() as unknown as React.ReactNode}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(
      within(group('Reports'))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pin', 'More options']);
  });
});

describe('row look (D121) and reveal (D120)', () => {
  it('draws the selected background and indicator on the row, not on the link', () => {
    render(
      <Nav defaultValue="reports">
        <Nav.Item value="reports" href="#reports" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    const link = screen.getByRole('link', { name: 'Reports' });
    const row = link.parentElement as HTMLElement;
    expect(row).toHaveClass(
      navItemClassNames.listItem,
      'group/nav-row',
      'flex',
      'items-center',
      'transition-colors',
      'motion-reduce:transition-none',
      'bg-subtle-selected',
      'border-s-2',
      'border-s-primary',
    );
    expect(row).not.toHaveClass('hover:bg-subtle-hover');
    expect(link).toHaveClass('text-primary', 'font-semibold', 'min-w-0', 'flex-1');
    expect(link).not.toHaveClass('bg-subtle-selected', 'border-s-2', 'border-s-primary');
  });

  it('gives an idle row the hover, and a disabled row none', () => {
    render(
      <Nav defaultValue="home">
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="reports" actions={<button type="button">Pin reports</button>}>
          Reports
        </Nav.Item>
        <Nav.Item value="admin" disabled actions={<button type="button">Pin admin</button>}>
          Admin
        </Nav.Item>
      </Nav>,
    );
    const reportsRow = screen.getByRole('button', { name: 'Reports' }).parentElement;
    expect(reportsRow).toHaveClass('group/nav-row', 'hover:bg-subtle-hover');
    expect(reportsRow).not.toHaveClass('bg-subtle-selected');
    const adminRow = screen.getByRole('button', { name: 'Admin' }).parentElement;
    expect(adminRow).toHaveClass('group/nav-row');
    expect(adminRow).not.toHaveClass('hover:bg-subtle-hover');
  });

  it('gives a sub-item row only the hover, also while it is selected', () => {
    render(
      <Nav defaultValue="api">
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="api" actions={<button type="button">Pin</button>}>
            API
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const subItem = screen.getByRole('button', { name: 'API' });
    const row = subItem.parentElement as HTMLElement;
    expect(row).toHaveClass(
      navSubItemClassNames.listItem,
      'group/nav-row',
      'hover:bg-subtle-hover',
    );
    expect(row).not.toHaveClass('bg-subtle-selected', 'border-s-2');
    expect(subItem).toHaveClass('text-primary', 'font-semibold', 'min-w-0', 'flex-1');
  });

  it('draws the actions by opacity, with every reveal and hold class and no invisibility', () => {
    render(
      <Nav>
        <Nav.Item value="reports" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>,
    );
    expect(group('Reports')).toHaveClass(navItemClassNames.actions, ...REVEAL_CLASSES);
    expect(group('Reports')).not.toHaveClass('invisible');
    // 0.15 (P10-NAV): the reveal fades; the reveal motion's are the group's only transitions.
    const transitions = (classes: readonly string[]) => classes.filter((c) => /transition/.test(c));
    expect(transitions(Array.from(group('Reports').classList))).toEqual(
      transitions(motionClasses(navActionsRevealMotion)),
    );
  });
});

describe('with Wave controls', () => {
  function ControlsNav() {
    return (
      <Nav defaultValue="home">
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item
          value="reports"
          actions={
            <>
              <Tooltip content="Pin" relationship="label">
                <ToggleButton appearance="subtle" size="small" icon={<PinGlyph />} />
              </Tooltip>
              <Menu>
                <Menu.Trigger>
                  <MenuButton appearance="subtle" size="small" aria-label="More options" />
                </Menu.Trigger>
                <Menu.Popover>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Remove</Menu.Item>
                </Menu.Popover>
              </Menu>
            </>
          }
        >
          Reports
        </Nav.Item>
      </Nav>
    );
  }

  it('toggles a Tooltip-named ToggleButton without selecting the item', async () => {
    const user = userEvent.setup();
    render(<ControlsNav />);
    const pin = within(group('Reports')).getByRole('button', { name: 'Pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    await user.click(pin);
    expect(pin).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Reports' })).not.toHaveAttribute('aria-current');
  });

  it('opens a MenuButton’s Menu, and Escape returns focus to it; axe open and closed', async () => {
    const user = userEvent.setup();
    render(<ControlsNav />);
    await expectNoA11yViolations();
    const more = screen.getByRole('button', { name: 'More options' });
    await user.click(more);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(more).toHaveAttribute('aria-expanded', 'true');
    await expectNoA11yViolations();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('the current page in a closed category (P1-24)', () => {
  function CurrentNav() {
    return (
      <Nav value="api" defaultOpenCategories={[]}>
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="api" actions={<button type="button">Pin</button>}>
            API
          </Nav.SubItem>
        </Nav.Category>
      </Nav>
    );
  }
  const expectMarked = (toggle: HTMLElement) => {
    expect(toggle).toHaveAttribute('aria-current', 'true');
    expect(toggle).toHaveAttribute('data-contains-current', '');
  };

  it('marks the category in the server HTML', () => {
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = renderToString(<CurrentNav />);
    expectMarked(within(parsed).getByRole('button', { name: 'Docs' }));
  });

  it('marks it again after it is opened and closed', async () => {
    const user = userEvent.setup();
    render(<CurrentNav />);
    const toggle = screen.getByRole('button', { name: 'Docs' });
    expectMarked(toggle);
    await user.click(toggle);
    expect(group('API')).toBeInTheDocument();
    await user.click(toggle);
    expectMarked(toggle);
  });
});

describe('server rendering', () => {
  function ServerNav() {
    return (
      <Nav defaultValue="home">
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="reports" href="#reports" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>
    );
  }

  it('points the group at the item in the server HTML, and gives an item without actions no id', () => {
    const html = renderToString(<ServerNav />);
    expect(findDanglingIdRefsInHtml(html)).toEqual([]);
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    const link = within(parsed).getByRole('link', { name: 'Reports' });
    expect(link.id).not.toBe('');
    expect(within(parsed).getByRole('group')).toHaveAttribute('aria-labelledby', link.id);
    expect(within(parsed).getByRole('button', { name: 'Home' })).not.toHaveAttribute('id');
  });

  it('hydrates without a mismatch and logs nothing', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<ServerNav />);
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <ServerNav />);
      });
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(within(container).getByRole('group', { name: 'Reports' })).toBeInTheDocument();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('RTL', () => {
  it('uses logical classes on the actions and the row', () => {
    renderWithProviders(
      <Nav defaultValue="reports">
        <Nav.Item value="reports" actions={<button type="button">Pin</button>}>
          Reports
        </Nav.Item>
      </Nav>,
      { dir: 'rtl' },
    );
    const actions = group('Reports');
    const row = actions.parentElement as HTMLElement;
    expect(actions).toHaveClass('pe-2');
    expect(row).toHaveClass('border-s-2');
    for (const element of [actions, row]) {
      expect(element.className).not.toMatch(/(^|\s)(p|m)[lr]-|border-[lr]\b|border-[lr]-/);
    }
  });
});

describe('types', () => {
  it('accepts actions on every Nav.Item branch and on Nav.SubItem', () => {
    expectTypeOf<NavItemOwnProps['actions']>().toEqualTypeOf<React.ReactNode | undefined>();
    const maybeHref = undefined as string | undefined;
    const pin = <button type="button">Pin</button>;
    const elements = [
      <Nav.Item key="button" value="a" actions={pin} />,
      <Nav.Item key="link" value="b" href="#b" actions={pin} />,
      <Nav.Item key="dynamic" value="c" href={maybeHref} actions={pin} />,
      <Nav.SubItem key="sub-button" value="d" actions={pin} />,
      <Nav.SubItem key="sub-link" value="e" href="#e" actions={pin} />,
      <Nav.SubItem key="sub-dynamic" value="f" href={maybeHref} actions={pin} />,
    ];
    expect(elements).toHaveLength(6);
  });
});
