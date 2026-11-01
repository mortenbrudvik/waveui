import * as React from 'react';
import { describe, it, expect, vi, afterEach, expectTypeOf, onTestFinished } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  Nav,
  NavAppItem,
  NavAppItemStatic,
  NavCategory,
  NavDivider,
  NavItem,
  NavSectionHeader,
  NavSubItem,
} from '../Nav';
import type {
  NavCategoryProps,
  NavItemAnchorProps,
  NavItemDynamicProps,
  NavItemOwnProps,
  NavItemProps,
  NavProps,
  NavSubItemButtonProps,
  NavSubItemOwnProps,
  NavSubItemProps,
} from '../Nav';
import { NavDrawer, type NavDrawerProps } from '../NavDrawer';
import type { Slot } from '../../../lib/types';
import { NavContext, NavRovingContext } from '../Nav.context';
import type { NavContextValue, NavRovingContextValue } from '../Nav.context';
import { useNavRootState } from '../Nav.root';
import {
  navCategoryClassNames,
  navClassNames,
  navItemClassNames,
  navSubItemClassNames,
} from '../../../lib/classNames';
import type { UseNavRootStateOptions } from '../Nav.root';
import {
  asClientReference,
  createOverlayTestWrapper,
  expectInertSlotProps,
  expectNoA11yViolations,
  openingTags,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
  expectThrows,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const NavWrapper = createOverlayTestWrapper(Nav, {});

function SampleNav(props: Partial<NavProps>) {
  return (
    <Nav {...props}>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Item value="settings">Settings</Nav.Item>
      <Nav.Category value="docs" label="Docs">
        <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        <Nav.SubItem value="api">API</Nav.SubItem>
      </Nav.Category>
    </Nav>
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const toggle = () => screen.getByRole('button', { name: 'Docs' });

/** The deprecation warning of a renamed Nav prop (asserted, never silenced). */
const deprecated = (oldName: string, newName: string) =>
  `[WaveUI] Nav: \`${oldName}\` is deprecated and will be removed in 1.0. Use \`${newName}\` instead.`;

/**
 * Icons that render nothing: `icon={name && <Icon />}` with `name` '' or a count of 0, and a list
 * mapped to nothing (F2 `slotRendersContent`). A factory each, since a generator is one-shot.
 */
const EMPTY_ICONS = [
  ["''", () => ''],
  ['0', () => 0],
  ['an empty array', () => []],
  ['an array of empty items', () => [null, false, '', [undefined]]],
  [
    'a generator of empty items',
    function* emptyItems() {
      yield null;
      yield '';
    },
  ],
] as Array<[string, () => Slot<'span'>]>;

describe('Nav', () => {
  testSystemProps(Nav, {
    expectedTag: 'nav',
    displayName: 'Nav',
    defaultProps: {
      children: [
        <Nav.Item key="home" value="home" icon={<span>H</span>}>
          Home
        </Nav.Item>,
        <Nav.Category key="docs" value="docs" label="Docs">
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>,
      ],
    },
    a11yVariants: [
      { name: 'category expanded', props: { defaultOpenCategories: ['docs'] } },
      { name: 'item selected', props: { defaultValue: 'home' } },
      {
        name: 'closed category holding the current page',
        props: { defaultValue: 'intro', defaultOpenCategories: [] },
      },
    ],
    conflictingClass: { className: 'w-72', overrides: 'w-60' },
  });

  testCompoundExposure(Nav, [
    'Category',
    'Item',
    'SubItem',
    'SectionHeader',
    'Divider',
    'AppItem',
    'AppItemStatic',
  ]);

  testNoImplicitSubmit(Nav, {
    defaultProps: {
      defaultOpenCategories: ['docs'],
      children: [
        <Nav.Item key="home" value="home">
          Home
        </Nav.Item>,
        <Nav.Category key="docs" value="docs" label="Docs">
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>,
      ],
    },
  });

  it('exports every sub-component under its flat name (C-COMPOUND)', () => {
    expect(NavCategory).toBe(Nav.Category);
    expect(NavItem).toBe(Nav.Item);
    expect(NavSubItem).toBe(Nav.SubItem);
    expect(NavSectionHeader).toBe(Nav.SectionHeader);
    expect(NavDivider).toBe(Nav.Divider);
    expect(NavAppItem).toBe(Nav.AppItem);
    expect(NavAppItemStatic).toBe(Nav.AppItemStatic);
  });

  // C-COMPOUND: parts written in a Server Component reach the client as lazy references.
  it.each([
    ['uncontrolled', { defaultValue: 'api' }],
    ['controlled', { value: 'api' }],
  ])(
    'parts as client references (%s) render the same server HTML and open the current category',
    async (_mode, props) => {
      const user = userEvent.setup();
      const LazyCategory = asClientReference(NavCategory);
      const LazyItem = asClientReference(NavItem);
      const LazySubItem = asClientReference(NavSubItem);
      const plain = renderToString(
        <Nav {...props}>
          <NavItem value="home">Home</NavItem>
          <NavCategory value="docs" label="Docs">
            <NavSubItem value="intro">Introduction</NavSubItem>
            <NavSubItem value="api">API</NavSubItem>
          </NavCategory>
        </Nav>,
      );
      expect(plain).toContain('aria-expanded="true"');
      expect(plain).toContain('aria-current="page"');
      const lazy = (
        <Nav {...props}>
          <LazyItem value="home">Home</LazyItem>
          <LazyCategory value="docs" label="Docs">
            <LazySubItem value="intro">Introduction</LazySubItem>
            <LazySubItem value="api">API</LazySubItem>
          </LazyCategory>
        </Nav>
      );
      expect(renderToString(lazy)).toBe(plain);

      render(lazy);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
      await user.click(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    },
  );

  // The walk that finds the category of the current value reaches consumer content too: content
  // still loading inside the consumer's own <Suspense> suspends that boundary only, never Nav.
  describe('consumer content still loading inside its own Suspense', () => {
    type AdminModule = { default: React.ComponentType<{ children?: React.ReactNode }> };

    function AdminLinks({ children }: { children?: React.ReactNode }) {
      return (
        <>
          <Nav.Item value="admin">Admin</Nav.Item>
          {children}
        </>
      );
    }

    function Passthrough({ children }: { children?: React.ReactNode }) {
      return <>{children}</>;
    }

    /** A `React.lazy` of `component` whose chunk loads only when `load()` is called. */
    function pendingLazy(component: AdminModule['default'] = AdminLinks) {
      let resolveModule: (module: AdminModule) => void = () => {};
      const loading = new Promise<AdminModule>((resolve) => {
        resolveModule = resolve;
      });
      const Lazy = React.lazy(() => loading);
      return { Lazy, load: () => resolveModule({ default: component }) };
    }

    function Shell({ slot, value = 'api' }: { slot: React.ReactNode; value?: string }) {
      return (
        <Nav value={value}>
          <Nav.Item value="home">Home</Nav.Item>
          <React.Suspense fallback={null}>{slot}</React.Suspense>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            <Nav.SubItem value="api">API</Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
    }

    it('a React.lazy component does not suspend Nav; the current category still opens', async () => {
      const { Lazy, load } = pendingLazy();
      render(<Shell slot={<Lazy />} />);
      expect(button('Home')).toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
      expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();

      await act(async () => load());
      expect(button('Admin')).toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
    });

    it('a promise child does not suspend Nav; the current category still opens', async () => {
      let resolveChild: (node: React.ReactElement) => void = () => {};
      const child = new Promise<React.ReactElement>((resolve) => {
        resolveChild = resolve;
      });
      // Awaited: React attaches the retry of a suspended promise child when the act scope ends.
      await act(async () => {
        render(<Shell slot={child} />);
      });
      expect(button('Home')).toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');

      await act(async () => resolveChild(<Nav.Item value="admin">Admin</Nav.Item>));
      expect(button('Admin')).toBeInTheDocument();
    });

    it('the server renders Nav with the current category open around the loading content', () => {
      const { Lazy } = pendingLazy();
      const html = renderToString(<Shell slot={<Lazy />} />);
      expect(html).toContain('aria-expanded="true"');
      expect(html).toMatch(/aria-current="page"[^>]*>API</);
    });

    it('a category holding the value opens when its sub-items sit inside a loading React.lazy', async () => {
      const { Lazy, load } = pendingLazy(Passthrough);
      render(
        <Nav value="api">
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <React.Suspense fallback={null}>
              <Lazy>
                <Nav.SubItem value="api">API</Nav.SubItem>
              </Lazy>
            </React.Suspense>
          </Nav.Category>
        </Nav>,
      );
      expect(button('Home')).toBeInTheDocument();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');

      await act(async () => load());
      expect(button('API')).toHaveAttribute('aria-current', 'page');
    });
  });

  it('has navigation aria-label', () => {
    render(<Nav data-testid="nav" />);
    expect(screen.getByTestId('nav')).toHaveAttribute('aria-label', 'Navigation');
  });

  it('lets the consumer rename the landmark', () => {
    render(<Nav aria-label="Main" />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('renders nav items as list items', () => {
    render(<SampleNav />);
    const list = within(screen.getByRole('navigation')).getAllByRole('list')[0];
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(button('Home')).toBeInTheDocument();
    expect(button('Settings')).toBeInTheDocument();
  });

  describe('selection (C-NAMING)', () => {
    it('selects an item on click and calls onValueChange', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SampleNav onValueChange={onValueChange} />);
      await user.click(button('Home'));
      expect(onValueChange).toHaveBeenCalledWith('home');
      expect(button('Home')).toHaveAttribute('aria-current', 'page');
    });

    it('onValueChange fires only when the value changes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SampleNav defaultValue="home" onValueChange={onValueChange} />);
      await user.click(button('Home'));
      expect(onValueChange).not.toHaveBeenCalled();
      await user.click(button('Settings'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it('sets aria-current on the selected item and moves it', async () => {
      const user = userEvent.setup();
      render(<SampleNav defaultValue="home" />);
      expect(button('Home')).toHaveAttribute('aria-current', 'page');
      await user.click(button('Settings'));
      expect(button('Settings')).toHaveAttribute('aria-current', 'page');
      expect(button('Home')).not.toHaveAttribute('aria-current');
    });

    it('controlled: respects value and does not change on its own', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SampleNav value="settings" onValueChange={onValueChange} />);
      expect(button('Settings')).toHaveAttribute('aria-current', 'page');
      await user.click(button('Home'));
      expect(onValueChange).toHaveBeenCalledWith('home');
      expect(button('Settings')).toHaveAttribute('aria-current', 'page');
    });

    it('StrictMode: onValueChange fires exactly once per click', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <React.StrictMode>
          <SampleNav onValueChange={onValueChange} />
        </React.StrictMode>,
      );
      await user.click(button('Home'));
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    describe('deprecated aliases', () => {
      it('selectedValue still controls the selection and warns once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<SampleNav selectedValue="settings" />);
        expect(button('Settings')).toHaveAttribute('aria-current', 'page');
        expect(warn.mock.calls).toEqual([[deprecated('selectedValue', 'value')]]);
      });

      it('defaultSelectedValue still sets the initial selection and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<SampleNav defaultSelectedValue="home" />);
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
        expect(warn.mock.calls).toEqual([[deprecated('defaultSelectedValue', 'defaultValue')]]);
      });

      it('value wins over selectedValue when both are given', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<SampleNav value="home" selectedValue="settings" />);
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
        expect(warn.mock.calls).toEqual([[deprecated('selectedValue', 'value')]]);
      });

      it('onNavItemSelect warns once and still fires on every activation, re-selection included', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        const onNavItemSelect = vi.fn();
        const onValueChange = vi.fn();
        render(
          <SampleNav
            defaultValue="home"
            onNavItemSelect={onNavItemSelect}
            onValueChange={onValueChange}
          />,
        );
        await user.click(button('Home'));
        await user.click(button('Home'));
        expect(onNavItemSelect).toHaveBeenCalledTimes(2);
        expect(onNavItemSelect).toHaveBeenCalledWith('home');
        expect(onValueChange).not.toHaveBeenCalled();
        await user.click(button('Settings'));
        expect(onNavItemSelect).toHaveBeenLastCalledWith('settings');
        expect(onValueChange).toHaveBeenCalledWith('settings');
        expect(warn.mock.calls).toEqual([[deprecated('onNavItemSelect', 'onValueChange')]]);
      });

      it('onNavItemSelect does not fire when a disabled item is activated, the current one included', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const user = userEvent.setup();
        const onNavItemSelect = vi.fn();
        render(
          <Nav value="docs" onNavItemSelect={onNavItemSelect}>
            <Nav.Item value="home" disabled>
              Home
            </Nav.Item>
            <Nav.Item value="docs" href="#docs" disabled>
              Docs
            </Nav.Item>
            <Nav.Item value="settings">Settings</Nav.Item>
          </Nav>,
        );
        await user.click(button('Home'));
        // Re-selection fires the alias for an enabled item; a disabled current item stays silent.
        await user.click(screen.getByRole('link', { name: 'Docs' }));
        expect(onNavItemSelect).not.toHaveBeenCalled();
        await user.click(button('Settings'));
        expect(onNavItemSelect).toHaveBeenCalledTimes(1);
        expect(onNavItemSelect).toHaveBeenCalledWith('settings');
        expect(warn.mock.calls).toEqual([[deprecated('onNavItemSelect', 'onValueChange')]]);
      });
    });
  });

  describe('categories', () => {
    it('renders collapsible NavCategory with aria-expanded after each toggle', async () => {
      const user = userEvent.setup();
      render(<SampleNav />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Introduction' })).not.toBeInTheDocument();
      await user.click(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('Introduction')).toBeInTheDocument();
      expect(toggle()).toHaveAttribute(
        'aria-controls',
        button('Introduction').closest('ul')?.id ?? 'missing',
      );
      await user.click(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'Introduction' })).not.toBeInTheDocument();
    });

    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('%s toggles a category from the keyboard', async (_name, key) => {
      const user = userEvent.setup();
      render(<SampleNav />);
      act(() => toggle().focus());
      await user.keyboard(key);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard(key);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    });

    it('NavSubItem triggers selection', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(<SampleNav onValueChange={onValueChange} />);
      await user.click(toggle());
      await user.click(button('Introduction'));
      expect(onValueChange).toHaveBeenCalledWith('intro');
      expect(button('Introduction')).toHaveAttribute('aria-current', 'page');
    });

    it('renders an element label in the button and the children unchanged in the list', async () => {
      const user = userEvent.setup();
      render(
        <Nav>
          <Nav.Category value="docs" label={<span className="consumer-label">Docs</span>}>
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      expect(toggle()).toHaveAccessibleName('Docs');
      expect(within(toggle()).getByText('Docs')).toHaveClass('consumer-label');
      await user.click(toggle());
      const list = button('Introduction').closest('ul') as HTMLElement;
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    });

    it('renders an interpolated text label in full', () => {
      const count = 3;
      render(
        <Nav>
          <Nav.Category value="inbox" label={`Inbox (${count})`}>
            <Nav.SubItem value="unread">Unread</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      expect(screen.getByRole('button', { name: 'Inbox (3)' })).toBeInTheDocument();
    });

    it('deprecated: text children still label the category (all text parts) and warn', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const user = userEvent.setup();
      const count = 3;
      render(
        <Nav>
          <Nav.Category value="inbox">
            Inbox ({count})<Nav.SubItem value="unread">Unread</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      const categoryButton = screen.getByRole('button', { name: 'Inbox (3)' });
      await user.click(categoryButton);
      const list = button('Unread').closest('ul') as HTMLElement;
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(list.textContent).toBe('Unread');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Nav.Category: `text children as the label` is deprecated and will be removed in 1.0. Use `label` instead. Pass the category label in `label` and only the sub-items as children.',
        ],
      ]);
    });

    it('defaultOpenCategories opens categories initially', () => {
      render(<SampleNav defaultOpenCategories={['docs']} />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('Introduction')).toBeInTheDocument();
    });

    it('uncontrolled: opens the category that contains the selected value', () => {
      render(<SampleNav defaultValue="api" />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
    });

    // The router pattern, `<Nav value={pathname}>`.
    it('controlled: opens the category that contains the controlled value', () => {
      render(<SampleNav value="api" />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
    });

    it('deprecated selectedValue also opens the category that contains it', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<SampleNav selectedValue="api" />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(button('API')).toHaveAttribute('aria-current', 'page');
      expect(warn.mock.calls).toEqual([[deprecated('selectedValue', 'value')]]);
    });

    it('defaultOpenCategories replaces the automatic opening, an empty list included', () => {
      render(<SampleNav defaultValue="api" defaultOpenCategories={[]} />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: 'API' })).not.toBeInTheDocument();
    });

    it('accepts readonly category lists and reports a mutable copy (C-NAMING)', async () => {
      const user = userEvent.setup();
      const onOpenCategoriesChange = vi.fn();
      const open = ['docs'] as const;
      render(
        <SampleNav defaultOpenCategories={open} onOpenCategoriesChange={onOpenCategoriesChange} />,
      );
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      await user.click(toggle());
      expect(onOpenCategoriesChange).toHaveBeenCalledWith([]);
      expectTypeOf(open).toMatchTypeOf<NonNullable<NavProps['openCategories']>>();
      expectTypeOf(open).toMatchTypeOf<NonNullable<NavProps['defaultOpenCategories']>>();
      expectTypeOf<Parameters<NonNullable<NavProps['onOpenCategoriesChange']>>[0]>().toEqualTypeOf<
        string[]
      >();
    });

    it('controlled openCategories: reports changes and follows the prop', async () => {
      const user = userEvent.setup();
      const onOpenCategoriesChange = vi.fn();
      const { rerender } = render(
        <SampleNav openCategories={[]} onOpenCategoriesChange={onOpenCategoriesChange} />,
      );
      await user.click(toggle());
      expect(onOpenCategoriesChange).toHaveBeenCalledWith(['docs']);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      rerender(
        <SampleNav openCategories={['docs']} onOpenCategoriesChange={onOpenCategoriesChange} />,
      );
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      await user.click(toggle());
      expect(onOpenCategoriesChange).toHaveBeenLastCalledWith([]);
    });

    it('uncontrolled: onOpenCategoriesChange receives the open list', async () => {
      const user = userEvent.setup();
      const onOpenCategoriesChange = vi.fn();
      render(<SampleNav onOpenCategoriesChange={onOpenCategoriesChange} />);
      await user.click(toggle());
      expect(onOpenCategoriesChange).toHaveBeenCalledWith(['docs']);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('a closed category that contains the current page', () => {
    /** A toggle whose category contains the current page (the look follows these attributes). */
    const expectMarked = (categoryToggle: HTMLElement) => {
      expect(categoryToggle).toHaveAttribute('aria-current', 'true');
      expect(categoryToggle).toHaveAttribute('data-contains-current', '');
    };
    const expectUnmarked = (categoryToggle: HTMLElement) => {
      expect(categoryToggle).not.toHaveAttribute('aria-current');
      expect(categoryToggle).not.toHaveAttribute('data-contains-current');
    };

    /** Renders its sub-items itself, so Nav cannot find them among the category's children. */
    function GuideLinks() {
      return (
        <>
          <Nav.SubItem value="setup">Setup</Nav.SubItem>
          <Nav.SubItem value="deploy">Deploy</Nav.SubItem>
        </>
      );
    }

    function GuidesNav(props: Partial<NavProps>) {
      return (
        <Nav {...props}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category value="guides" label="Guides">
            <GuideLinks />
          </Nav.Category>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
    }

    const guides = () => screen.getByRole('button', { name: 'Guides' });

    it('marks the toggle of a closed category that holds the current sub-item', () => {
      render(
        <Nav defaultValue="api" defaultOpenCategories={[]}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            <Nav.SubItem value="api">API</Nav.SubItem>
          </Nav.Category>
          <Nav.Category value="blog" label="Blog">
            <Nav.SubItem value="news">News</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expectMarked(toggle());
      expectUnmarked(button('Blog'));
      expectUnmarked(button('Home'));
    });

    it('finds the current sub-item through Fragments and wrapper elements', () => {
      render(
        <Nav value="api" defaultOpenCategories={[]}>
          <Nav.Category value="docs" label="Docs">
            <>
              <div>
                <Nav.SubItem value="api">API</Nav.SubItem>
              </div>
            </>
          </Nav.Category>
        </Nav>,
      );
      expectMarked(toggle());
    });

    it('gives the marked toggle the selected look of an item, with logical classes', () => {
      render(<SampleNav defaultValue="api" defaultOpenCategories={[]} />);
      expect(toggle()).toHaveClass(
        'data-[contains-current]:bg-subtle-selected',
        'data-[contains-current]:text-primary',
        'data-[contains-current]:border-s-2',
        'data-[contains-current]:border-s-primary',
      );
      expect(toggle().className).not.toMatch(/border-(l|r)\b|border-(l|r)-/);
    });

    it('marks it in the server HTML (the children are scanned during render)', () => {
      const html = renderToString(<SampleNav value="api" defaultOpenCategories={[]} />);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      const docs = within(parsed).getByRole('button', { name: 'Docs' });
      expect(docs).toHaveAttribute('aria-expanded', 'false');
      expectMarked(docs);
    });

    it('hydrates the server HTML of a marked category without a mismatch', async () => {
      const element = <SampleNav value="api" defaultOpenCategories={[]} />;
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(error).not.toHaveBeenCalled();
        expectMarked(toggle());
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    });

    it('an open category is not marked: its sub-item shows the current page', async () => {
      const user = userEvent.setup();
      render(<SampleNav defaultValue="api" />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expectUnmarked(toggle());
      expect(button('API')).toHaveAttribute('aria-current', 'page');
      await user.click(toggle());
      expectMarked(toggle());
      await user.click(toggle());
      expectUnmarked(toggle());
    });

    it('selecting a sub-item and then closing its category marks it', async () => {
      const user = userEvent.setup();
      render(<SampleNav defaultValue="home" />);
      expectUnmarked(toggle());
      await user.click(toggle());
      await user.click(button('Introduction'));
      await user.click(toggle());
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expectMarked(toggle());
    });

    it('remembers the category of a sub-item a component renders once it has been shown', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <GuidesNav defaultValue="home" />
        </React.StrictMode>,
      );
      await user.click(guides());
      await user.click(button('Deploy'));
      expect(button('Deploy')).toHaveAttribute('aria-current', 'page');
      await user.click(guides());
      expectMarked(guides());
      expectUnmarked(toggle());
    });

    it('a sub-item a component renders, never shown, is marked only through currentCategory', () => {
      const { rerender } = render(<GuidesNav value="deploy" />);
      expect(guides()).toHaveAttribute('aria-expanded', 'false');
      expectUnmarked(guides());
      rerender(<GuidesNav value="deploy" currentCategory="guides" />);
      expectMarked(guides());
      expectUnmarked(toggle());
    });

    it('currentCategory marks its category only while it is closed', async () => {
      const user = userEvent.setup();
      render(<GuidesNav defaultValue="deploy" currentCategory="guides" />);
      expectMarked(guides());
      await user.click(guides());
      expectUnmarked(guides());
      expect(button('Deploy')).toHaveAttribute('aria-current', 'page');
    });

    it('changing the current value to a top-level item clears the mark', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<GuidesNav value="intro" defaultOpenCategories={[]} />);
      expectMarked(toggle());
      rerender(<GuidesNav value="home" defaultOpenCategories={[]} />);
      expectUnmarked(toggle());

      // A remembered sub-item counts only while its value is current.
      await user.click(guides());
      rerender(<GuidesNav value="setup" defaultOpenCategories={[]} />);
      await user.click(guides());
      expectMarked(guides());
      rerender(<GuidesNav value="home" defaultOpenCategories={[]} />);
      expectUnmarked(guides());
      rerender(<GuidesNav value="setup" defaultOpenCategories={[]} />);
      expectMarked(guides());
    });

    it('forgets the remembered category of a value that moves out of it', async () => {
      const user = userEvent.setup();
      /** `moved`: the current page becomes a top-level item instead of a Guides sub-item. */
      function Restructured({ moved }: { moved: boolean }) {
        return (
          <Nav value="deploy" defaultOpenCategories={['guides']}>
            {moved && <Nav.Item value="deploy">Deploy</Nav.Item>}
            <Nav.Category value="guides" label="Guides">
              {moved ? <Nav.SubItem value="setup">Setup</Nav.SubItem> : <GuideLinks />}
            </Nav.Category>
          </Nav>
        );
      }
      const { rerender } = render(<Restructured moved={false} />);
      expect(button('Deploy')).toHaveAttribute('aria-current', 'page');
      rerender(<Restructured moved />);
      await user.click(guides());
      expect(guides()).toHaveAttribute('aria-expanded', 'false');
      expectUnmarked(guides());
      expect(button('Deploy')).toHaveAttribute('aria-current', 'page');
    });

    it('a value moved into another closed category marks only that category', async () => {
      const user = userEvent.setup();
      /** `moved`: the current page moves from the Guides category into the closed Docs category. */
      function Restructured({ moved }: { moved: boolean }) {
        return (
          <Nav value="deploy" defaultOpenCategories={['guides']}>
            <Nav.Category value="guides" label="Guides">
              {moved ? <Nav.SubItem value="setup">Setup</Nav.SubItem> : <GuideLinks />}
            </Nav.Category>
            <Nav.Category value="docs" label="Docs">
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
              {moved && <Nav.SubItem value="deploy">Deploy</Nav.SubItem>}
            </Nav.Category>
          </Nav>
        );
      }
      const { rerender } = render(<Restructured moved={false} />, { wrapper: React.StrictMode });
      expect(button('Deploy')).toHaveAttribute('aria-current', 'page');
      await user.click(guides());
      expectMarked(guides());
      expectUnmarked(toggle());

      rerender(<Restructured moved />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expectMarked(toggle());
      expectUnmarked(guides());
      // Opening and closing the old category does not bring its mark back.
      await user.click(guides());
      await user.click(guides());
      expectUnmarked(guides());
      expectMarked(toggle());
    });

    it('stops marking a closed category once its children no longer hold the current value', () => {
      /** `listed`: whether the current page is still one of the Docs sub-items. */
      function Pruned({ listed }: { listed: boolean }) {
        return (
          <Nav value="api" defaultOpenCategories={[]}>
            <Nav.Category value="docs" label="Docs">
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
              {listed && <Nav.SubItem value="api">API</Nav.SubItem>}
            </Nav.Category>
          </Nav>
        );
      }
      const { rerender } = render(<Pruned listed />, { wrapper: React.StrictMode });
      expectMarked(toggle());
      rerender(<Pruned listed={false} />);
      expectUnmarked(toggle());
      rerender(<Pruned listed />);
      expectMarked(toggle());
    });

    it('has no axe violations with a marked category', async () => {
      render(<GuidesNav defaultValue="intro" defaultOpenCategories={[]} currentCategory="docs" />);
      expectMarked(toggle());
      await expectNoA11yViolations();
    });

    it('types currentCategory as an optional string', () => {
      expectTypeOf<NavProps['currentCategory']>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('links (href)', () => {
    function LinkNav({
      onValueChange,
      onHomeClick,
      onIntroClick,
    }: {
      onValueChange?: (v: string) => void;
      onHomeClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
      onIntroClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    }) {
      return (
        <Nav onValueChange={onValueChange} defaultOpenCategories={['docs']}>
          <Nav.Item value="home" href="#home" onClick={onHomeClick}>
            Home
          </Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro" href="#intro" onClick={onIntroClick}>
              Introduction
            </Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
    }

    it('Nav.Item with href renders a link; a click selects it and calls the consumer onClick', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onHomeClick = vi.fn();
      render(<LinkNav onValueChange={onValueChange} onHomeClick={onHomeClick} />);
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveAttribute('href', '#home');
      await user.click(link);
      expect(onValueChange).toHaveBeenCalledWith('home');
      expect(onHomeClick).toHaveBeenCalledTimes(1);
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('Nav.SubItem with href renders a link; aria-current moves to it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onIntroClick = vi.fn();
      render(<LinkNav onValueChange={onValueChange} onIntroClick={onIntroClick} />);
      await user.click(screen.getByRole('link', { name: 'Home' }));
      const intro = screen.getByRole('link', { name: 'Introduction' });
      expect(intro).toHaveAttribute('href', '#intro');
      await user.click(intro);
      expect(onValueChange).toHaveBeenLastCalledWith('intro');
      expect(onIntroClick).toHaveBeenCalledTimes(1);
      expect(intro).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    });

    it('a link is still selected when the consumer prevents its default (client-side routing)', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onHomeClick = vi.fn((e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault());
      render(<LinkNav onValueChange={onValueChange} onHomeClick={onHomeClick} />);
      await user.click(screen.getByRole('link', { name: 'Home' }));
      expect(onHomeClick).toHaveBeenCalledTimes(1);
      expect(onValueChange).toHaveBeenCalledWith('home');
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });

    // A click that opens the link elsewhere leaves the current page current.
    describe('a click that opens the link somewhere else', () => {
      function ReportsNav({
        onValueChange,
        onNavItemSelect,
        onReportsClick,
        target,
        download,
      }: {
        onValueChange?: (value: string) => void;
        onNavItemSelect?: (value: string) => void;
        onReportsClick?: React.MouseEventHandler<HTMLAnchorElement>;
        target?: string;
        download?: boolean;
      }) {
        return (
          <Nav defaultValue="home" onValueChange={onValueChange} onNavItemSelect={onNavItemSelect}>
            <Nav.Item value="home" href="#home">
              Home
            </Nav.Item>
            <Nav.Item
              value="reports"
              href="#reports"
              target={target}
              download={download}
              onClick={onReportsClick}
            >
              Reports
            </Nav.Item>
          </Nav>
        );
      }

      const link = (name: string) => screen.getByRole('link', { name });

      function expectHomeStillCurrent(onValueChange: ReturnType<typeof vi.fn>) {
        expect(onValueChange).not.toHaveBeenCalled();
        expect(link('Home')).toHaveAttribute('aria-current', 'page');
        expect(link('Reports')).not.toHaveAttribute('aria-current');
      }

      it.each([
        ['Ctrl+click', { ctrlKey: true }],
        ['Cmd+click', { metaKey: true }],
        ['Shift+click', { shiftKey: true }],
        ['Alt+click', { altKey: true }],
        ['a click with another mouse button', { button: 1 }],
      ])('%s calls onClick, lets the browser open the link and selects nothing', (_name, init) => {
        const onValueChange = vi.fn();
        const onReportsClick = vi.fn();
        render(<ReportsNav onValueChange={onValueChange} onReportsClick={onReportsClick} />);
        const notPrevented = fireEvent.click(link('Reports'), init);
        expect(notPrevented).toBe(true);
        expect(onReportsClick).toHaveBeenCalledTimes(1);
        expectHomeStillCurrent(onValueChange);
      });

      it.each([['_blank'], ['_top'], ['reports-window']])(
        'a plain click on a link with target="%s" selects nothing',
        async (target) => {
          const user = userEvent.setup();
          const onValueChange = vi.fn();
          const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
          const onNavItemSelect = vi.fn();
          render(
            <ReportsNav
              target={target}
              onValueChange={onValueChange}
              onNavItemSelect={onNavItemSelect}
            />,
          );
          await user.click(link('Reports'));
          expectHomeStillCurrent(onValueChange);
          expect(onNavItemSelect).not.toHaveBeenCalled();
          expect(warn.mock.calls).toEqual([[deprecated('onNavItemSelect', 'onValueChange')]]);
        },
      );

      it('a plain click on a download link selects nothing', async () => {
        const user = userEvent.setup();
        const onValueChange = vi.fn();
        render(<ReportsNav download onValueChange={onValueChange} />);
        await user.click(link('Reports'));
        expectHomeStillCurrent(onValueChange);
      });

      it.each([['_self'], ['']])(
        'a plain click on a link with target="%s" still selects it',
        async (target) => {
          const user = userEvent.setup();
          const onValueChange = vi.fn();
          render(<ReportsNav target={target} onValueChange={onValueChange} />);
          await user.click(link('Reports'));
          expect(onValueChange).toHaveBeenCalledWith('reports');
          expect(link('Reports')).toHaveAttribute('aria-current', 'page');
        },
      );

      // The consumer's onClick routes in place (`preventDefault()` + a router push): the browser
      // opens nothing elsewhere, the current page changes, so the link is selected.
      it.each([
        ['Ctrl+click', { ctrlKey: true }, {}],
        ['Shift+click', { shiftKey: true }, {}],
        ['a click with another mouse button', { button: 1 }, {}],
        ['a plain click on a target="_blank" link', {}, { target: '_blank' }],
        ['a plain click on a download link', {}, { download: true }],
      ])(
        '%s whose default the consumer prevents selects the link',
        (_name, init, linkProps: { target?: string; download?: boolean }) => {
          const onValueChange = vi.fn();
          const navigate = vi.fn();
          const onReportsClick = vi.fn((e: React.MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault();
            navigate('/reports');
          });
          render(
            <ReportsNav
              {...linkProps}
              onValueChange={onValueChange}
              onReportsClick={onReportsClick}
            />,
          );
          const notPrevented = fireEvent.click(link('Reports'), init);
          expect(notPrevented).toBe(false);
          expect(navigate).toHaveBeenCalledTimes(1);
          expect(onValueChange.mock.calls).toEqual([['reports']]);
          expect(link('Reports')).toHaveAttribute('aria-current', 'page');
          expect(link('Home')).not.toHaveAttribute('aria-current');
        },
      );

      it('a button item is selected whatever the modifier keys (it opens nothing)', () => {
        const onValueChange = vi.fn();
        render(<SampleNav onValueChange={onValueChange} />);
        fireEvent.click(button('Settings'), { ctrlKey: true });
        expect(onValueChange).toHaveBeenCalledWith('settings');
        expect(button('Settings')).toHaveAttribute('aria-current', 'page');
      });
    });

    it('anchor props are typed for links and button props for buttons', () => {
      render(
        <Nav>
          <Nav.Item value="docs" href="/docs" target="_blank" rel="noopener" download>
            Docs
          </Nav.Item>
          <Nav.SubItem value="dl" href="/file" hrefLang="en" referrerPolicy="no-referrer">
            File
          </Nav.SubItem>
          <Nav.Item value="save" disabled onClick={(e: React.MouseEvent<HTMLButtonElement>) => e}>
            Save
          </Nav.Item>
        </Nav>,
      );
      // Type-only: never rendered (React logs an error for `formAction` on an <a>).
      const invalidLinkItem = (
        // @ts-expect-error formAction is a button attribute; not valid on a link item
        <Nav.Item value="bad" href="/bad" formAction="/submit">
          Bad
        </Nav.Item>
      );
      expect(React.isValidElement(invalidLinkItem)).toBe(true);
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('target', '_blank');
      expectTypeOf<{ value: 'a'; target: string }>().not.toMatchTypeOf<NavItemProps>();
      expectTypeOf<NavItemProps>().toBeObject();
      expectTypeOf<{ value: 'a'; href: string; target: string }>().toMatchTypeOf<NavItemProps>();
      expectTypeOf<{
        value: 'a';
        href: string;
        download: boolean;
      }>().toMatchTypeOf<NavSubItemProps>();
    });

    it('anchor attributes without href are a type error (they would land on a <button>)', () => {
      render(
        <Nav defaultOpenCategories={['docs']}>
          {/* @ts-expect-error target needs href: without it the item is a button */}
          <Nav.Item value="item" target="_blank">
            Item
          </Nav.Item>
          <Nav.Category value="docs" label="Docs">
            {/* @ts-expect-error download needs href: without it the sub-item is a button */}
            <Nav.SubItem value="sub" download>
              Sub
            </Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      expect(button('Item')).toBeInTheDocument();
    });

    it('types unannotated handlers from href: button events without it, link events with it', async () => {
      const user = userEvent.setup();
      const onButtonClick = vi.fn();
      const onButtonKeyDown = vi.fn();
      const onSubClick = vi.fn();
      const onLinkClick = vi.fn();
      render(
        <Nav defaultOpenCategories={['docs']}>
          <Nav.Item
            value="a"
            onClick={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLButtonElement>>();
              e.currentTarget.focus();
              onButtonClick(e.currentTarget.tagName);
            }}
          >
            A
          </Nav.Item>
          <Nav.Item
            value="d"
            onKeyDown={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.KeyboardEvent<HTMLButtonElement>>();
              onButtonKeyDown(e.key);
            }}
          >
            D
          </Nav.Item>
          <Nav.Item
            value="l"
            href="#l"
            onClick={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLAnchorElement>>();
              e.preventDefault();
              onLinkClick(e.currentTarget.getAttribute('href'));
            }}
          >
            L
          </Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem
              value="c"
              onClick={(e) => {
                expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLButtonElement>>();
                e.stopPropagation();
                onSubClick(e.currentTarget.tagName);
              }}
            >
              C
            </Nav.SubItem>
            <Nav.SubItem
              value="s"
              href="#s"
              onClick={(e) => {
                expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLAnchorElement>>();
                e.preventDefault();
              }}
            >
              S
            </Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      await user.click(button('A'));
      expect(onButtonClick).toHaveBeenCalledWith('BUTTON');
      act(() => button('D').focus());
      await user.keyboard('x');
      expect(onButtonKeyDown).toHaveBeenCalledWith('x');
      await user.click(screen.getByRole('link', { name: 'L' }));
      expect(onLinkClick).toHaveBeenCalledWith('#l');
      await user.click(button('C'));
      expect(onSubClick).toHaveBeenCalledWith('BUTTON');
    });

    it('a 0.4 handler pre-typed on HTMLButtonElement still compiles on a link item', async () => {
      const user = userEvent.setup();
      const seen = vi.fn();
      // 0.4 typed every item's handlers on HTMLButtonElement. React's handler types are
      // bivariant, so such a handler still type-checks on a link item (anchor events).
      const legacyHandler: React.MouseEventHandler<HTMLButtonElement> = (e) => {
        e.preventDefault();
        seen(e.currentTarget.tagName);
      };
      render(
        <Nav>
          <Nav.Item value="docs" href="#docs" onClick={legacyHandler}>
            Docs
          </Nav.Item>
          <Nav.Item
            value="guide"
            href="#guide"
            onClick={(e) => {
              // An unannotated handler is typed on HTMLAnchorElement with a string href, so a
              // button-only member (0.4 typing) is a type error here.
              // @ts-expect-error `form` exists on HTMLButtonElement, not on HTMLAnchorElement
              seen(e.currentTarget.form);
              e.preventDefault();
            }}
          >
            Guide
          </Nav.Item>
        </Nav>,
      );
      await user.click(screen.getByRole('link', { name: 'Docs' }));
      expect(seen).toHaveBeenLastCalledWith('A');
      await user.click(screen.getByRole('link', { name: 'Guide' }));
      expect(seen).toHaveBeenLastCalledWith(undefined);
    });

    it('a runtime href (string | undefined) still compiles with an unannotated handler (0.4)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      function DynamicEntries({ href }: { href?: string }) {
        return (
          <>
            <Nav.Item
              value="item"
              href={href}
              onClick={(e) => {
                expectTypeOf(e).toEqualTypeOf<
                  React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>
                >();
                e.preventDefault();
                onClick(e.currentTarget.tagName);
              }}
            >
              Item
            </Nav.Item>
            <Nav.SubItem value="sub" href={href} onClick={(e) => onClick(e.currentTarget.tagName)}>
              Sub
            </Nav.SubItem>
          </>
        );
      }
      const { rerender } = render(
        <Nav>
          <DynamicEntries />
        </Nav>,
      );
      await user.click(button('Item'));
      expect(onClick).toHaveBeenLastCalledWith('BUTTON');
      rerender(
        <Nav>
          <DynamicEntries href="#item" />
        </Nav>,
      );
      await user.click(screen.getByRole('link', { name: 'Item' }));
      expect(onClick).toHaveBeenLastCalledWith('A');
      expect(screen.getByRole('link', { name: 'Sub' })).toHaveAttribute('href', '#item');
    });
  });

  describe('button branch', () => {
    testComposedHandler(Nav.Item, {
      handler: 'onClick',
      wrapper: NavWrapper,
      defaultProps: { value: 'home', children: 'Home' },
      act: async ({ user }) => {
        await user.click(button('Home'));
      },
      assertInternal: () => {
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
      },
      assertInternalSuppressed: () => {
        expect(button('Home')).not.toHaveAttribute('aria-current');
      },
    });

    testComposedHandler(Nav.SubItem, {
      handler: 'onClick',
      wrapper: NavWrapper,
      defaultProps: { value: 'intro', children: 'Introduction' },
      act: async ({ user }) => {
        await user.click(button('Introduction'));
      },
      assertInternal: () => {
        expect(button('Introduction')).toHaveAttribute('aria-current', 'page');
      },
      assertInternalSuppressed: () => {
        expect(button('Introduction')).not.toHaveAttribute('aria-current');
      },
    });

    it('calls the consumer onClick of a button item', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Nav>
          <Nav.Item value="home" onClick={onClick}>
            Home
          </Nav.Item>
        </Nav>,
      );
      await user.click(button('Home'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('disabled items', () => {
    it('a disabled button item is natively disabled and activating it never selects it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Nav onValueChange={onValueChange}>
          <Nav.Item value="home" disabled>
            Home
          </Nav.Item>
          <Nav.SubItem value="sub" disabled>
            Sub
          </Nav.SubItem>
        </Nav>,
      );
      expect(button('Home')).toBeDisabled();
      expect(button('Sub')).toBeDisabled();
      await user.click(button('Home'));
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('a disabled link item is aria-disabled, drops its href and activating it never selects it', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      const onClick = vi.fn();
      render(
        <Nav onValueChange={onValueChange}>
          <Nav.Item value="home" href="#home" disabled onClick={onClick}>
            Home
          </Nav.Item>
        </Nav>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
      await user.click(link);
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a disabled item whose value is the current value still shows as current', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      render(
        <Nav value="home" onValueChange={onValueChange}>
          <Nav.Item value="home" disabled>
            Home
          </Nav.Item>
          <Nav.Item value="docs" href="#docs" disabled>
            Docs
          </Nav.Item>
        </Nav>,
      );
      // The current value belongs to the app: disabling the entry does not hide where the user is.
      expect(button('Home')).toBeDisabled();
      expect(button('Home')).toHaveAttribute('aria-current', 'page');
      expect(button('Home')).toHaveClass('bg-subtle-selected', 'border-s-primary');
      await user.click(button('Home'));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('aria-current');
    });

    it('a disabled link item that is current keeps aria-current (uncontrolled default)', () => {
      render(
        <Nav defaultValue="docs">
          <Nav.Item value="docs" href="#docs" disabled>
            Docs
          </Nav.Item>
        </Nav>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('rel', () => {
    it('button items and sub-items do not render rel; link items keep it', () => {
      render(
        <Nav defaultOpenCategories={['docs']}>
          <Nav.Item value="home" rel="noopener" title="Home page">
            Home
          </Nav.Item>
          <Nav.Item value="ext" href="#ext" rel="noopener">
            External
          </Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro" rel="noopener">
              Introduction
            </Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      expect(button('Home')).not.toHaveAttribute('rel');
      expect(button('Home')).toHaveAttribute('title', 'Home page');
      expect(button('Introduction')).not.toHaveAttribute('rel');
      expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute('rel', 'noopener');
    });
  });

  describe('styles', () => {
    it('items, sub-items and categories carry the shared focus ring (C-FOCUS)', () => {
      render(<SampleNav defaultOpenCategories={['docs']} />);
      for (const name of ['Home', 'Docs', 'Introduction']) {
        expect(button(name)).toHaveClass(
          'focus-visible:outline-2',
          'focus-visible:outline-ring',
          'focus-visible:-outline-offset-2',
        );
      }
    });

    it('gates hover so it also works on links and never on disabled items (C-TOKENS)', () => {
      render(
        <Nav>
          <Nav.Item value="home" href="#home">
            Home
          </Nav.Item>
        </Nav>,
      );
      expect(screen.getByRole('link', { name: 'Home' })).toHaveClass(
        'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
      );
    });

    it('gates the category toggle hover like the items (C-TOKENS)', () => {
      render(<SampleNav />);
      expect(toggle()).toHaveClass('not-disabled:not-aria-disabled:hover:bg-subtle-hover');
      expect(toggle()).not.toHaveClass('hover:bg-subtle-hover');
    });

    it('uses a token background and a logical indicator for the selected item', () => {
      render(<SampleNav defaultValue="home" />);
      expect(button('Home')).toHaveClass('bg-subtle-selected', 'border-s-2', 'border-s-primary');
      expect(button('Home').className).not.toMatch(/border-l|#[0-9a-f]{3,6}/i);
    });

    it('reduces the chevron and color transitions for reduced motion (C-MOTION)', () => {
      render(<SampleNav />);
      expect(button('Home')).toHaveClass('motion-reduce:transition-none');
      const chevron = toggle().querySelector('svg');
      expect(chevron).toHaveClass('transition-transform', 'motion-reduce:transition-none');
    });

    it('RTL: uses logical utilities for the indicator, indent, alignment and border', () => {
      renderWithProviders(<SampleNav defaultValue="intro" />, { dir: 'rtl' });
      const nav = screen.getByRole('navigation');
      expect(nav.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(nav).toHaveClass('border-e');
      expect(nav).not.toHaveClass('border-r');
      const intro = button('Introduction');
      expect(intro).toHaveClass('ps-11', 'pe-4', 'text-start');
      expect(intro.className).not.toMatch(/\b(pl|pr)-/);
      expect(button('Home')).toHaveClass('text-start');
    });

    it('icon slot is aria-hidden and accepts a slot object with className (C-SLOTS)', () => {
      render(
        <Nav>
          <Nav.Item value="home" icon={{ children: 'H', className: 'consumer-icon' }}>
            Home
          </Nav.Item>
          <Nav.Category value="docs" label="Docs" icon={<span>D</span>}>
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      const icon = screen.getByText('H');
      expect(icon).toHaveClass('consumer-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(button('Home')).toHaveAccessibleName('Home');
      expect(button('Docs')).toHaveAccessibleName('Docs');
    });

    // An icon that renders nothing is no icon, as in 0.4 (`{icon && …}`) and as in Avatar: no
    // empty 20px aria-hidden box before the label.
    it.each(EMPTY_ICONS)('renders no icon box for an icon set to %s', (_kind, makeIcon) => {
      render(
        <Nav>
          <Nav.Item value="home" icon={makeIcon()}>
            Home
          </Nav.Item>
          <Nav.Category value="docs" label="Docs" icon={makeIcon()}>
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>,
      );
      for (const name of ['Home', 'Docs']) {
        expect(button(name).querySelector('span[aria-hidden="true"]')).toBeNull();
        expect(button(name).textContent).toBe(name);
      }
    });

    it('renders the items of a generator icon that has content (the check does not consume it)', () => {
      function* glyphs() {
        yield null;
        yield <svg key="glyph" data-testid="glyph" />;
      }
      render(
        <Nav>
          <Nav.Item value="home" icon={glyphs()}>
            Home
          </Nav.Item>
        </Nav>,
      );
      expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('sub-components', () => {
    describe('Nav.Item', () => {
      testSystemProps(Nav.Item, {
        expectedTag: 'button',
        displayName: 'NavItem',
        wrapper: NavWrapper,
        defaultProps: { value: 'home', children: 'Home' },
        a11yVariants: [{ name: 'disabled', props: { disabled: true } }],
        conflictingClass: { className: 'px-8', overrides: 'px-4' },
      });
    });

    describe('Nav.Item (link)', () => {
      testSystemProps(Nav.Item, {
        expectedTag: 'a',
        displayName: 'NavItem',
        wrapper: NavWrapper,
        defaultProps: { value: 'home', href: '#home', children: 'Home' },
      });
    });

    describe('Nav.SubItem', () => {
      testSystemProps(Nav.SubItem, {
        expectedTag: 'button',
        displayName: 'NavSubItem',
        wrapper: NavWrapper,
        defaultProps: { value: 'intro', children: 'Introduction' },
        conflictingClass: { className: 'py-3', overrides: 'py-1.5' },
      });
    });

    describe('Nav.Category', () => {
      testSystemProps(Nav.Category, {
        expectedTag: 'li',
        displayName: 'NavCategory',
        wrapper: NavWrapper,
        defaultProps: {
          value: 'docs',
          label: 'Docs',
          children: <Nav.SubItem value="intro">Introduction</Nav.SubItem>,
        },
      });

      it('composes a consumer onClick with toggling', async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
          <Nav>
            <Nav.Category value="docs" label="Docs" onClick={onClick}>
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            </Nav.Category>
          </Nav>,
        );
        await user.click(toggle());
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      });

      it('composes a consumer onKeyDown with keyboard toggling', async () => {
        const user = userEvent.setup();
        const onKeyDown = vi.fn();
        render(
          <Nav>
            <Nav.Category value="docs" label="Docs" onKeyDown={onKeyDown}>
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            </Nav.Category>
          </Nav>,
        );
        act(() => toggle().focus());
        await user.keyboard('{Enter}');
        expect(onKeyDown).toHaveBeenCalled();
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('context (C-CONTEXT, C-MEMO)', () => {
    it.each([
      ['Nav.Item', () => <Nav.Item value="a">A</Nav.Item>],
      ['Nav.SubItem', () => <Nav.SubItem value="a">A</Nav.SubItem>],
      [
        'Nav.Category',
        () => (
          <Nav.Category value="a" label="A">
            {null}
          </Nav.Category>
        ),
      ],
    ])('%s outside a Nav throws in development', (name, renderOrphan) => {
      expectThrows(renderOrphan(), `[WaveUI] ${name} must be used within Nav`);
    });

    it('logs each misplaced part once in production and renders it inert', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const user = userEvent.setup();
        const orphans = (count: number) => (
          <ul>
            {Array.from({ length: count }, (_, index) => (
              <React.Fragment key={index}>
                <Nav.Item value="a">A</Nav.Item>
                <Nav.SubItem value="b">B</Nav.SubItem>
                <Nav.Category value="c" label="C">
                  {null}
                </Nav.Category>
              </React.Fragment>
            ))}
          </ul>
        );
        const { rerender } = render(orphans(1));
        rerender(orphans(2));
        expect(screen.getAllByRole('button', { name: 'A' })).toHaveLength(2);
        await user.click(screen.getAllByRole('button', { name: 'C' })[0]);
        expect(screen.getAllByRole('button', { name: 'C' })[0]).toHaveAttribute(
          'aria-expanded',
          'false',
        );
        expect(error.mock.calls).toEqual([
          ['[WaveUI] Nav.Item must be used within Nav'],
          ['[WaveUI] Nav.SubItem must be used within Nav'],
          ['[WaveUI] Nav.Category must be used within Nav'],
        ]);
      } finally {
        error.mockRestore();
        vi.unstubAllEnvs();
      }
    });

    // C-DEV: one value per item (Nav.Item and Nav.SubItem share them) and one per category.
    it('warns once per value that several items or several categories share', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Sub-items register while their category is open (they are rendered only then).
      const tree = (
        <Nav defaultOpenCategories={['docs']}>
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Item value="docs">Docs home</Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="home">Start</Nav.SubItem>
          </Nav.Category>
          <Nav.Category value="docs" label="Guides">
            <Nav.SubItem value="guide">Guide</Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
      const { rerender } = render(tree);
      rerender(tree);
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Nav: several items share the value "home". Nav.Item and Nav.SubItem values must be unique within a Nav; every item with the current value is marked as the current page.',
        ],
        [
          '[WaveUI] Nav: several categories share the value "docs". Nav.Category values must be unique within a Nav; they open and close together.',
        ],
      ]);
    });

    it('does not warn for unique values, in StrictMode or when an item replaces another', () => {
      const warn = vi.spyOn(console, 'warn');
      const tree = (swap: boolean) => (
        <React.StrictMode>
          <Nav>
            {swap ? (
              <Nav.Item key="start" value="home">
                Start
              </Nav.Item>
            ) : (
              <Nav.Item key="home" value="home" href="#home">
                Home
              </Nav.Item>
            )}
            <Nav.Category value="home" label="Home pages">
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            </Nav.Category>
          </Nav>
        </React.StrictMode>
      );
      const { rerender } = render(tree(false));
      rerender(tree(true));
      expect(warn).not.toHaveBeenCalled();
    });

    it('re-rendering Nav with unchanged state does not re-render memoized items', () => {
      const onRender = vi.fn();
      const Items = React.memo(function Items() {
        return (
          <React.Profiler id="items" onRender={onRender}>
            <Nav.Item value="home">Home</Nav.Item>
          </React.Profiler>
        );
      });
      function Host({ tick }: { tick: number }) {
        return (
          <Nav data-tick={tick}>
            <Items />
          </Nav>
        );
      }
      const { rerender } = render(<Host tick={0} />);
      const initial = onRender.mock.calls.length;
      rerender(<Host tick={1} />);
      expect(onRender.mock.calls.length).toBe(initial);
    });
  });
});

// ---------------------------------------------------------------------------
// The Nav seam (spec §4.3): the roving bookkeeping and the root state hook
// ---------------------------------------------------------------------------

/** Items, a closed category that holds the current page and an open one (D113). */
function SeamNav(props: Partial<NavProps>) {
  return (
    <Nav defaultValue="intro" defaultOpenCategories={['guides']} {...props}>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Item value="settings" href="#settings">
        Settings
      </Nav.Item>
      <Nav.Category value="docs" label="Docs">
        <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        <Nav.SubItem value="api" href="#api">
          API
        </Nav.SubItem>
      </Nav.Category>
      <Nav.Category value="guides" label="Guides">
        <Nav.SubItem value="start">Getting started</Nav.SubItem>
      </Nav.Category>
    </Nav>
  );
}

/** The links and buttons of the Nav.Item and Nav.SubItem entries of `root`. */
const entriesOf = (root: ParentNode) =>
  Array.from(root.querySelectorAll(`.${navItemClassNames.root}, .${navSubItemClassNames.root}`));

describe('renders no data-roving-value outside an arrow body', () => {
  it('renders none in the DOM, and no id on an item without actions', () => {
    const { container } = render(<SeamNav />);
    expect(toggle()).toHaveAttribute('data-contains-current', '');
    expect(screen.getByRole('button', { name: 'Guides' })).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelectorAll('[data-roving-value]')).toHaveLength(0);
    const entries = entriesOf(container);
    expect(entries).toHaveLength(3); // Home, Settings and the open category's sub-item
    for (const entry of entries) expect(entry).not.toHaveAttribute('id');
  });

  it('renders none in the server HTML', () => {
    const html = renderToString(<SeamNav />);
    expect(html).not.toContain('data-roving-value');
    const parsed = document.createElement('div'); // detached: nothing reaches document.body
    parsed.innerHTML = html;
    const entries = entriesOf(parsed);
    expect(entries).toHaveLength(3); // Home, Settings and the open category's sub-item
    for (const entry of entries) expect(entry).not.toHaveAttribute('id');
  });
});

describe('with NavRovingContext', () => {
  function renderInBody(reportCurrentCategory: NavRovingContextValue['reportCurrentCategory']) {
    const roving: NavRovingContextValue = { reportCurrentCategory };
    return render(
      <React.StrictMode>
        <NavRovingContext.Provider value={roving}>
          <SeamNav defaultOpenCategories={[]} />
        </NavRovingContext.Provider>
      </React.StrictMode>,
    );
  }

  it('renders the value of every entry and of every toggle, also after the toggle opens', async () => {
    const user = userEvent.setup();
    renderInBody(vi.fn());
    expect(button('Home')).toHaveAttribute('data-roving-value', 'home');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'data-roving-value',
      'settings',
    );
    expect(toggle()).toHaveAttribute('data-roving-value', 'wave-nav-category:docs');
    expect(screen.getByRole('button', { name: 'Guides' })).toHaveAttribute(
      'data-roving-value',
      'wave-nav-category:guides',
    );
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAttribute('data-roving-value', 'wave-nav-category:docs');
    expect(button('Introduction')).toHaveAttribute('data-roving-value', 'intro');
    expect(screen.getByRole('link', { name: 'API' })).toHaveAttribute('data-roving-value', 'api');
  });

  it('a consumer data-roving-value does not win over the bookkeeping', () => {
    render(
      <NavRovingContext.Provider value={{ reportCurrentCategory: vi.fn() }}>
        <Nav>
          <Nav.Item value="home" data-roving-value="mine">
            Home
          </Nav.Item>
        </Nav>
      </NavRovingContext.Provider>,
    );
    expect(button('Home')).toHaveAttribute('data-roving-value', 'home');
  });

  it('renders none on an app item or on item actions', () => {
    render(
      <NavRovingContext.Provider value={{ reportCurrentCategory: vi.fn() }}>
        <Nav>
          <Nav.AppItem href="#app">Contoso</Nav.AppItem>
          <Nav.Item value="home" actions={<button type="button">Pin</button>}>
            Home
          </Nav.Item>
        </Nav>
      </NavRovingContext.Provider>,
    );
    expect(screen.getByRole('link', { name: 'Contoso' })).not.toHaveAttribute('data-roving-value');
    expect(button('Pin')).not.toHaveAttribute('data-roving-value');
    expect(button('Home')).toHaveAttribute('data-roving-value', 'home');
  });

  it('reports the closed category that holds the current page, its opening and its unmount', async () => {
    const user = userEvent.setup();
    const report = vi.fn();
    const { unmount } = renderInBody(report);
    const docsCalls = () => report.mock.calls.filter(([category]) => category === 'docs');
    // StrictMode's double mount: the effect, its cleanup, the effect again.
    expect(docsCalls()).toEqual([
      ['docs', true],
      ['docs', false],
      ['docs', true],
    ]);
    expect(docsCalls().at(-1)).toEqual(['docs', true]);
    expect(report.mock.calls.filter(([category]) => category === 'guides')).toEqual([
      ['guides', false],
      ['guides', false],
      ['guides', false],
    ]);

    report.mockClear();
    await user.click(toggle());
    expect(report.mock.calls).toEqual([
      ['docs', false],
      ['docs', false],
    ]);

    report.mockClear();
    unmount();
    expect(report.mock.calls).toEqual(
      expect.arrayContaining([
        ['docs', false],
        ['guides', false],
      ]),
    );
    expect(report.mock.calls.every(([, holdsCurrent]) => holdsCurrent === false)).toBe(true);
  });

  it('reports and renders nothing for a Nav outside the provider', () => {
    const report = vi.fn();
    render(
      <>
        <NavRovingContext.Provider value={{ reportCurrentCategory: report }}>
          <Nav aria-label="Inside">
            <Nav.Category value="inside" label="Inside category">
              <Nav.SubItem value="x">X</Nav.SubItem>
            </Nav.Category>
          </Nav>
        </NavRovingContext.Provider>
        <SeamNav aria-label="Outside" defaultOpenCategories={[]} />
      </>,
    );
    expect(report.mock.calls).toEqual([['inside', false]]);
    const outside = screen.getByRole('navigation', { name: 'Outside' });
    expect(outside.querySelectorAll('[data-roving-value]')).toHaveLength(0);
  });
});

describe('useNavRootState', () => {
  type HarnessProps = Partial<Omit<UseNavRootStateOptions, 'children'>> & {
    children?: React.ReactNode;
    onContext?: (context: NavContextValue) => void;
  };

  /** A root built on the hook alone, as NavDrawer is: `componentName: 'Test'`, its own list. */
  function Harness({ children, onContext, ...options }: HarnessProps) {
    const context = useNavRootState({
      componentName: 'Test',
      value: undefined,
      defaultValue: '',
      onValueChange: undefined,
      openCategories: undefined,
      defaultOpenCategories: undefined,
      onOpenCategoriesChange: undefined,
      currentCategory: undefined,
      children,
      ...options,
    });
    React.useEffect(() => {
      onContext?.(context);
    });
    return (
      <NavContext.Provider value={context}>
        <ul>{children}</ul>
      </NavContext.Provider>
    );
  }

  /** Categories behind a wrapper element and a Fragment, the scan's reach. */
  const wrapped = (
    <>
      <li>
        <ul>
          <Nav.Category value="docs" label="Docs">
            <React.Fragment>
              <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            </React.Fragment>
          </Nav.Category>
        </ul>
      </li>
      <Nav.Category value="guides" label="Guides">
        <Nav.SubItem value="start">Getting started</Nav.SubItem>
      </Nav.Category>
    </>
  );
  const guides = () => screen.getByRole('button', { name: 'Guides' });

  it('opens the categories that hold the selected value, found once through wrappers', () => {
    const { rerender } = render(<Harness value="intro">{wrapped}</Harness>);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(guides()).toHaveAttribute('aria-expanded', 'false');
    expect(button('Introduction')).toHaveAttribute('aria-current', 'page');
    // The scan runs at mount only: a later value opens nothing.
    rerender(<Harness value="start">{wrapped}</Harness>);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(guides()).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts from defaultOpenCategories instead of the scan', () => {
    render(
      <Harness defaultValue="intro" defaultOpenCategories={['guides']}>
        {wrapped}
      </Harness>,
    );
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(guides()).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onActivate on every activation and onValueChange only on a change (StrictMode)', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onValueChange = vi.fn();
    const onOpenCategoriesChange = vi.fn();
    render(
      <React.StrictMode>
        <Harness
          onActivate={onActivate}
          onValueChange={onValueChange}
          onOpenCategoriesChange={onOpenCategoriesChange}
        >
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Category value="docs" label="Docs">
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Harness>
      </React.StrictMode>,
    );
    await user.click(button('Home'));
    await user.click(button('Home'));
    expect(onActivate.mock.calls).toEqual([['home'], ['home']]);
    expect(onValueChange.mock.calls).toEqual([['home']]);
    await user.click(toggle());
    expect(onOpenCategoriesChange.mock.calls).toEqual([[['docs']]]);
    expect(button('Home')).toHaveAttribute('aria-current', 'page');
  });

  it('keys and words the duplicate-value warnings with its componentName', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = (
      <Harness defaultOpenCategories={['docs']}>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="home">Start</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="docs" label="Guides">
          {null}
        </Nav.Category>
      </Harness>
    );
    const { rerender } = render(tree);
    rerender(tree);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Test: several items share the value "home". Nav.Item and Nav.SubItem values must be unique within a Test; every item with the current value is marked as the current page.',
      ],
      [
        '[WaveUI] Test: several categories share the value "docs". Nav.Category values must be unique within a Test; they open and close together.',
      ],
    ]);
  });

  it('returns the same context value across a re-render with unchanged state', () => {
    const contexts: NavContextValue[] = [];
    const record = (context: NavContextValue) => contexts.push(context);
    const items = () => <Nav.Item value="home">Home</Nav.Item>;
    const { rerender } = render(<Harness onContext={record}>{items()}</Harness>);
    rerender(<Harness onContext={record}>{items()}</Harness>);
    expect(contexts).toHaveLength(2);
    expect(contexts[1]).toBe(contexts[0]);
  });
});

describe('Nav, Nav.Category, Nav.Item and Nav.SubItem — slotProps', () => {
  type ListSlotProps = NonNullable<NavProps['slotProps']>;
  type CategorySlotProps = NonNullable<NavCategoryProps['slotProps']>;
  type ItemSlotProps = NonNullable<NavItemOwnProps['slotProps']>;
  type SubItemSlotProps = NonNullable<NavSubItemOwnProps['slotProps']>;
  /** The parts of each component of {@link Entries}, by component. */
  interface EntriesSlotProps {
    nav?: ListSlotProps;
    category?: CategorySlotProps;
    item?: ItemSlotProps;
    subItem?: SubItemSlotProps;
  }
  const EVERY_PART: EntriesSlotProps = {
    nav: { list: {} },
    category: { button: {}, label: {}, list: {} },
    item: { listItem: {}, content: {}, actions: {} },
    subItem: { listItem: {}, actions: {} },
  };

  /**
   * Home (current, with an action), Reports (a link), Docs (open) › Introduction (with an action)
   * and API (a link); every entry of a kind with the same parts.
   */
  function Entries({ parts, ...props }: Partial<NavProps> & { parts?: EntriesSlotProps }) {
    return (
      <Nav defaultValue="home" defaultOpenCategories={['docs']} {...props} slotProps={parts?.nav}>
        <Nav.Item
          value="home"
          icon={<span>H</span>}
          actions={<button type="button">Pin Home</button>}
          slotProps={parts?.item}
        >
          Home
        </Nav.Item>
        <Nav.Item value="reports" href="#reports" icon={<span>R</span>} slotProps={parts?.item}>
          Reports
        </Nav.Item>
        <Nav.Category value="docs" label="Docs" icon={<span>D</span>} slotProps={parts?.category}>
          <Nav.SubItem
            value="intro"
            actions={<button type="button">Pin Intro</button>}
            slotProps={parts?.subItem}
          >
            Introduction
          </Nav.SubItem>
          <Nav.SubItem value="api" href="#api" slotProps={parts?.subItem}>
            API
          </Nav.SubItem>
        </Nav.Category>
      </Nav>
    );
  }

  const q = (root: ParentNode, selector: string) =>
    root.querySelector<HTMLElement>(selector) as HTMLElement;
  /** Every part of {@link Entries}, by name ({@link PART_NAMES} gives their document order). */
  function partsOf(root: ParentNode = document) {
    const [home, reports] = Array.from(
      root.querySelectorAll<HTMLElement>(`.${navItemClassNames.listItem}`),
    );
    const [intro, api] = Array.from(
      root.querySelectorAll<HTMLElement>(`.${navSubItemClassNames.listItem}`),
    );
    return {
      navList: q(root, `.${navClassNames.list}`),
      home,
      homeContent: q(home, `.${navItemClassNames.content}`),
      homeActions: q(home, `.${navItemClassNames.actions}`),
      reports,
      reportsContent: q(reports, `.${navItemClassNames.content}`),
      button: q(root, `.${navCategoryClassNames.button}`),
      label: q(root, `.${navCategoryClassNames.label}`),
      list: q(root, `.${navCategoryClassNames.list}`),
      intro,
      introActions: q(intro, `.${navSubItemClassNames.actions}`),
      api,
    };
  }
  type PartName = keyof ReturnType<typeof partsOf>;
  const PART_NAMES: PartName[] = [
    'navList',
    'home',
    'homeContent',
    'homeActions',
    'reports',
    'reportsContent',
    'button',
    'label',
    'list',
    'intro',
    'introActions',
    'api',
  ];
  const STABLE: Record<PartName, string> = {
    navList: navClassNames.list,
    home: navItemClassNames.listItem,
    homeContent: navItemClassNames.content,
    homeActions: navItemClassNames.actions,
    reports: navItemClassNames.listItem,
    reportsContent: navItemClassNames.content,
    button: navCategoryClassNames.button,
    label: navCategoryClassNames.label,
    list: navCategoryClassNames.list,
    intro: navSubItemClassNames.listItem,
    introActions: navSubItemClassNames.actions,
    api: navSubItemClassNames.listItem,
  };
  const tagsOf = (root: ParentNode = document) => {
    const parts = partsOf(root);
    return openingTags(...PART_NAMES.map((name) => parts[name]));
  };

  const ACTIONS_CLASSES =
    'flex shrink-0 items-center gap-1 pe-2 *:opacity-0 group-hover/nav-row:*:opacity-100 group-focus-within/nav-row:*:opacity-100 forced-colors:*:opacity-100 [@media(hover:none)]:*:opacity-100 *:has-[[aria-pressed=true]]:opacity-100 *:has-[[aria-expanded=true]]:opacity-100 [&amp;>[aria-pressed=true]]:opacity-100 [&amp;>[aria-expanded=true]]:opacity-100 *:transition *:duration-wave-fast *:ease-wave-easy-ease motion-reduce:*:transition-none';
  const BUTTON_CLASSES =
    'flex w-full items-center gap-2 px-4 py-2 text-body-1 font-semibold text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover transition-colors motion-reduce:transition-none data-[contains-current]:bg-subtle-selected data-[contains-current]:text-primary data-[contains-current]:border-s-2 data-[contains-current]:border-s-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';
  // Captured from 73e9b81's dist (client and server agree).
  const BASE_PINS = [
    '<ul class="wave-nav__list m-0 list-none p-0">',
    '<li class="wave-nav-item__list-item group/nav-row flex items-center transition-colors motion-reduce:transition-none bg-subtle-selected border-s-2 border-s-primary">',
    '<span class="wave-nav-item__content flex-1 text-start">',
    `<span aria-labelledby="wave-nav-item-_id0_" class="wave-nav-item__actions ${ACTIONS_CLASSES}" data-wave-nav-actions="" role="group">`,
    '<li class="wave-nav-item__list-item">',
    '<span class="wave-nav-item__content flex-1 text-start">',
    `<button aria-controls="wave-nav-category-_id1_" aria-expanded="true" class="wave-nav-category__button ${BUTTON_CLASSES}" type="button">`,
    '<span class="wave-nav-category__label flex-1 text-start">',
    '<ul class="wave-nav-category__list m-0 list-none p-0" id="wave-nav-category-_id1_">',
    '<li class="wave-nav-sub-item__list-item group/nav-row flex items-center transition-colors motion-reduce:transition-none hover:bg-subtle-hover">',
    `<span aria-labelledby="wave-nav-item-_id2_" class="wave-nav-sub-item__actions ${ACTIONS_CLASSES}" data-wave-nav-actions="" role="group">`,
    '<li class="wave-nav-sub-item__list-item">',
  ].join('\n');
  const CLOSED_BUTTON_PIN = `<button aria-current="true" aria-expanded="false" class="wave-nav-category__button ${BUTTON_CLASSES}" data-contains-current="" type="button">`;
  const ARROW_BUTTON_PIN = `<button aria-expanded="false" class="wave-nav-category__button ${BUTTON_CLASSES}" data-roving-value="wave-nav-category:docs" tabindex="-1" type="button">`;

  /** An open inline NavDrawer whose body is one arrow-key stop, around `children`. */
  function ArrowBody({
    children,
    ...props
  }: Partial<NavDrawerProps> & { children: React.ReactNode }) {
    return (
      <NavDrawer type="inline" open onOpenChange={() => {}} {...props}>
        <NavDrawer.Body focusMode="arrow">{children}</NavDrawer.Body>
      </NavDrawer>
    );
  }

  it('renders the parts of 73e9b81 (attributes sorted), on the client and the server', () => {
    let view = render(<Entries />);
    expect(tagsOf()).toBe(BASE_PINS);
    view.unmount();
    view = render(<Entries parts={EVERY_PART} />);
    expect(tagsOf()).toBe(BASE_PINS);
    view.unmount();
    for (const parts of [undefined, EVERY_PART]) {
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Entries parts={parts} />);
      expect(tagsOf(template.content)).toBe(BASE_PINS);
    }
    view = render(<Entries defaultValue="intro" defaultOpenCategories={[]} parts={EVERY_PART} />);
    expect(openingTags(toggle())).toBe(CLOSED_BUTTON_PIN);
    view.unmount();
    render(
      <ArrowBody>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Category value="docs" label="Docs" slotProps={EVERY_PART.category}>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </ArrowBody>,
    );
    expect(openingTags(toggle())).toBe(ARROW_BUTTON_PIN);
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const cases: Partial<NavProps>[] = [
      {},
      { defaultValue: 'intro', defaultOpenCategories: [] },
      { defaultValue: 'api', defaultOpenCategories: ['docs'] },
      { defaultValue: '' },
    ];
    for (const props of cases) {
      expectInertSlotProps(
        (slotProps: EntriesSlotProps | undefined) => <Entries {...props} parts={slotProps} />,
        EVERY_PART,
      );
    }
    // Disabled entries, in an arrow-key body.
    expectInertSlotProps(
      (slotProps: EntriesSlotProps | undefined) => (
        <ArrowBody defaultOpenCategories={['docs']}>
          <Nav.Item value="home" disabled icon={<span>H</span>} slotProps={slotProps?.item}>
            Home
          </Nav.Item>
          <Nav.Item value="x" href="#x" disabled icon={<span>X</span>} slotProps={slotProps?.item}>
            X
          </Nav.Item>
          <Nav.Category value="docs" label="Docs" slotProps={slotProps?.category}>
            <Nav.SubItem value="intro" disabled slotProps={slotProps?.subItem}>
              Introduction
            </Nav.SubItem>
          </Nav.Category>
        </ArrowBody>
      ),
      EVERY_PART,
    );
  });

  it('puts your className, style and data-* on each part, after its stable class and own classes', () => {
    const mine = (name: string) => ({
      className: `my-${name}`,
      style: { opacity: 0.5 },
      'data-part': name,
    });
    render(
      <Entries
        parts={{
          nav: { list: mine('nav-list') },
          category: { button: mine('button'), label: mine('label'), list: mine('list') },
          item: { listItem: mine('li'), content: mine('content'), actions: mine('actions') },
          subItem: { listItem: mine('sub-li'), actions: mine('sub-actions') },
        }}
      />,
    );
    const MINE: Record<PartName, string> = {
      navList: 'nav-list',
      home: 'li',
      homeContent: 'content',
      homeActions: 'actions',
      reports: 'li',
      reportsContent: 'content',
      button: 'button',
      label: 'label',
      list: 'list',
      intro: 'sub-li',
      introActions: 'sub-actions',
      api: 'sub-li',
    };
    const parts = partsOf();
    for (const name of PART_NAMES) {
      const element = parts[name];
      expect(element.classList[0]).toBe(STABLE[name]);
      expect(element.classList[element.classList.length - 1]).toBe(`my-${MINE[name]}`);
      expect(element).toHaveAttribute('data-part', MINE[name]);
      expect(element).toHaveStyle({ opacity: '0.5' });
    }
    // The roots take none of it: the parts are drawn inside them.
    expect(screen.getByRole('navigation')).not.toHaveClass('my-nav-list');
    expect(button('Home')).not.toHaveClass('my-content');
    expect(button('Home')).not.toHaveClass('my-li');
    expect(toggle().closest('li')).not.toHaveClass('my-button');
  });

  it('lets your class replace a conflicting class of a part', () => {
    render(
      <Entries
        parts={{
          nav: { list: { className: 'p-2' } },
          category: {
            button: { className: 'px-6' },
            label: { className: 'text-end' },
            list: { className: 'p-1' },
          },
          item: {
            listItem: { className: 'items-start' },
            content: { className: 'flex-none' },
            actions: { className: 'gap-2' },
          },
          subItem: { listItem: { className: 'items-end' }, actions: { className: 'gap-3' } },
        }}
      />,
    );
    const parts = partsOf();
    for (const [name, mine, theirs] of [
      ['navList', 'p-2', 'p-0'],
      ['home', 'items-start', 'items-center'],
      ['homeContent', 'flex-none', 'flex-1'],
      ['homeActions', 'gap-2', 'gap-1'],
      ['button', 'px-6', 'px-4'],
      ['label', 'text-end', 'text-start'],
      ['list', 'p-1', 'p-0'],
      ['intro', 'items-end', 'items-center'],
      ['introActions', 'gap-3', 'gap-1'],
    ] as const) {
      expect(parts[name]).toHaveClass(mine);
      expect(parts[name]).not.toHaveClass(theirs);
    }
  });

  it('attaches your refs to the parts', () => {
    const refs = {
      navList: React.createRef<HTMLUListElement>(),
      home: React.createRef<HTMLLIElement>(),
      homeContent: React.createRef<HTMLSpanElement>(),
      homeActions: React.createRef<HTMLSpanElement>(),
      button: React.createRef<HTMLButtonElement>(),
      label: React.createRef<HTMLSpanElement>(),
      list: React.createRef<HTMLUListElement>(),
      intro: React.createRef<HTMLLIElement>(),
      introActions: React.createRef<HTMLSpanElement>(),
    };
    render(
      <Nav defaultOpenCategories={['docs']} slotProps={{ list: { ref: refs.navList } }}>
        <Nav.Item
          value="home"
          icon={<span>H</span>}
          actions={<button type="button">Pin Home</button>}
          slotProps={{
            listItem: { ref: refs.home },
            content: { ref: refs.homeContent },
            actions: { ref: refs.homeActions },
          }}
        >
          Home
        </Nav.Item>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{
            button: { ref: refs.button },
            label: { ref: refs.label },
            list: { ref: refs.list },
          }}
        >
          <Nav.SubItem
            value="intro"
            actions={<button type="button">Pin Intro</button>}
            slotProps={{ listItem: { ref: refs.intro }, actions: { ref: refs.introActions } }}
          >
            Introduction
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    for (const [name, ref] of Object.entries(refs)) {
      expect(ref.current).toBe(q(document, `.${STABLE[name as PartName]}`));
    }
  });

  it('keeps moving focus to the toggle as its list collapses, with new inline refs on every render', async () => {
    function Controlled({ open }: { open: boolean }) {
      return (
        <Nav openCategories={open ? ['docs'] : []} slotProps={{ list: { ref: () => {} } }}>
          <Nav.Category
            value="docs"
            label="Docs"
            motion={null}
            slotProps={{ button: { ref: () => {} }, list: { ref: () => {} } }}
          >
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
    }
    const { rerender } = render(<Controlled open />);
    rerender(<Controlled open />);
    act(() => button('Introduction').focus());
    rerender(<Controlled open={false} />);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: 'Introduction' })).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('keeps the development checks of the lists while you pass inline refs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inline = () => () => {};
    const tree = () => (
      <Nav defaultOpenCategories={['docs']} slotProps={{ list: { ref: inline() } }}>
        <div>Stray</div>
        <Nav.Category value="docs" label="Docs" slotProps={{ list: { ref: inline() } }}>
          <div>Stray</div>
        </Nav.Category>
      </Nav>
    );
    const { rerender } = render(tree());
    rerender(tree());
    expect(warn.mock.calls.map(([message]) => message).sort()).toEqual(
      [
        '[WaveUI] Nav: its list holds a <div> element, but a list can hold only <li> elements. Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>.',
        '[WaveUI] Nav.Category: its list holds a <div> element, but a list can hold only <li> elements. Use Nav.SubItem, Nav.SectionHeader and Nav.Divider as its children, or wrap your own content in an <li>.',
      ].sort(),
    );
  });

  it('locks each part’s role, ids, names, tab index, markers, state and hidden state', () => {
    const attempt = (name: string): Record<string, unknown> => ({
      id: `my-${name}`,
      role: 'menu',
      tabIndex: 0,
      hidden: true,
      inert: true,
      'aria-hidden': true,
      'aria-label': 'Mine',
      type: 'submit',
      disabled: true,
      'aria-disabled': true,
      'aria-expanded': false,
      'aria-controls': 'extra',
      'aria-current': 'page',
      'data-contains-current': 'x',
      'data-roving-value': 'mine',
      'data-roving-container': '',
      'data-roving-disabled': '',
      'data-wave-nav-actions': 'x',
    });
    const all = <S,>(names: string[]) =>
      Object.fromEntries(names.map((name) => [name, attempt(name)])) as S;
    const category = all<CategorySlotProps>(['button', 'label', 'list']);
    // Your aria-label may name the toggle (its tests are below): here it keeps the label's name.
    delete (category.button as Record<string, unknown>)['aria-label'];
    const item = all<ItemSlotProps>(['listItem', 'content', 'actions']);
    const subItem = all<SubItemSlotProps>(['listItem', 'actions']);
    // The names of the actions are id lists: yours are joined after the item's.
    Object.assign(item.actions!, { 'aria-labelledby': 'extra' });
    Object.assign(subItem.actions!, { 'aria-labelledby': 'extra' });
    render(
      <>
        <span id="extra">Extra</span>
        <Entries parts={{ nav: all<ListSlotProps>(['list']), category, item, subItem }} />
      </>,
    );
    const parts = partsOf();
    for (const name of PART_NAMES) {
      const element = parts[name];
      for (const locked of [
        'tabindex',
        'hidden',
        'inert',
        'aria-hidden',
        'data-roving-container',
      ]) {
        expect(element).not.toHaveAttribute(locked);
      }
      if (name === 'homeActions' || name === 'introActions') {
        expect(element).toHaveAttribute('role', 'group');
        expect(element).toHaveAttribute('data-wave-nav-actions', '');
      } else {
        expect(element).not.toHaveAttribute('role');
      }
    }
    // The toggle: its type, state, list reference and value; never disabled.
    const { button: toggleButton, list, label, homeContent, homeActions, introActions } = parts;
    expect(toggleButton).toHaveAttribute('type', 'button');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(toggleButton).toHaveAttribute('aria-controls', list.id);
    expect(list.id).toMatch(/^wave-nav-category-/);
    for (const unset of [
      'aria-current',
      'data-contains-current',
      'data-roving-value',
      'disabled',
      'aria-disabled',
      'data-roving-disabled',
    ]) {
      expect(toggleButton).not.toHaveAttribute(unset);
    }
    // The label and the content name their button: no name of their own.
    expect(label).not.toHaveAttribute('aria-label');
    expect(homeContent).not.toHaveAttribute('aria-label');
    expect(toggle()).toHaveAccessibleName('Docs');
    expect(button('Home')).toHaveAccessibleName('Home');
    // The actions: named by their item, your ids joined after it.
    expect(homeActions).toHaveAttribute('aria-labelledby', `${button('Home').id} extra`);
    expect(introActions).toHaveAttribute('aria-labelledby', `${button('Introduction').id} extra`);
    // The lists and their items are unchanged: one list each, every item a list item.
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lets your aria-label name the toggle, which otherwise takes its name from the label', () => {
    render(<Entries parts={{ category: { button: { 'aria-label': 'Documentation' } } }} />);
    const named = screen.getByRole('button', { name: 'Documentation' });
    expect(named).toHaveClass(navCategoryClassNames.button);
    expect(named).toHaveAttribute('aria-expanded', 'true');
  });

  it('locks the toggle’s state attributes unset where the category sets none, and its own where it does', () => {
    const rogue = {
      'aria-controls': 'elsewhere',
      'aria-current': 'page',
      'data-contains-current': 'x',
      'data-roving-value': 'mine',
    } as CategorySlotProps['button'];
    const { unmount } = render(
      <Entries
        defaultValue="home"
        defaultOpenCategories={[]}
        parts={{ category: { button: rogue } }}
      />,
    );
    // Closed, not holding the current page, in a plain Nav: none of the four.
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    for (const unset of [
      'aria-controls',
      'aria-current',
      'data-contains-current',
      'data-roving-value',
    ]) {
      expect(toggle()).not.toHaveAttribute(unset);
    }
    unmount();
    render(
      <ArrowBody defaultValue="intro" defaultOpenCategories={[]}>
        <Nav.Category value="docs" label="Docs" slotProps={{ button: rogue }}>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </ArrowBody>,
    );
    // Closed with the current page, in an arrow-key body: the category's own values.
    expect(toggle()).toHaveAttribute('aria-current', 'true');
    expect(toggle()).toHaveAttribute('data-contains-current', '');
    expect(toggle()).toHaveAttribute('data-roving-value', 'wave-nav-category:docs');
    expect(toggle()).not.toHaveAttribute('aria-controls');
  });

  it('keeps the tab order of a Nav: no part adds or removes a stop', async () => {
    const user = userEvent.setup();
    const stop = { tabIndex: 0 };
    render(
      <>
        <Entries
          parts={{
            nav: { list: stop },
            category: { button: { tabIndex: -1 }, label: stop, list: stop },
            item: { listItem: stop, content: stop, actions: stop },
            subItem: { listItem: stop, actions: stop },
          }}
        />
        <button type="button">After</button>
      </>,
    );
    const order = [
      button('Home'),
      button('Pin Home'),
      screen.getByRole('link', { name: 'Reports' }),
      toggle(),
      button('Introduction'),
      button('Pin Intro'),
      screen.getByRole('link', { name: 'API' }),
      button('After'),
    ];
    for (const element of order) {
      await user.tab();
      expect(element).toHaveFocus();
    }
  });

  it('keeps the arrow order of an arrow-key body: no part becomes an entry or a nested composite', async () => {
    const user = userEvent.setup();
    const rogue = { role: 'button', tabIndex: 0 } as const;
    const composite = { role: 'menu', 'data-roving-container': '' } as const;
    render(
      <ArrowBody defaultOpenCategories={['docs']}>
        <Nav.Item
          value="home"
          icon={<span>H</span>}
          slotProps={{ listItem: composite, content: rogue }}
        >
          Home
        </Nav.Item>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{ button: composite, label: rogue, list: composite }}
        >
          <Nav.SubItem value="intro" slotProps={{ listItem: rogue }}>
            Introduction
          </Nav.SubItem>
          <Nav.SubItem
            value="api"
            actions={<button type="button">Pin API</button>}
            slotProps={{ actions: composite }}
          >
            API
          </Nav.SubItem>
        </Nav.Category>
        <Nav.Item value="settings">Settings</Nav.Item>
      </ArrowBody>,
    );
    await user.tab();
    expect(button('Home')).toHaveFocus();
    for (const name of ['Docs', 'Introduction', 'API', 'Pin API', 'Settings', 'Home']) {
      await user.keyboard('{ArrowDown}');
      expect(button(name)).toHaveFocus();
    }
  });

  it('runs your toggle handler first: preventDefault() keeps the category as it is', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    const order: string[] = [];
    function Toggle({ prevent }: { prevent: boolean }) {
      return (
        <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
          <Nav.Category
            value="docs"
            label="Docs"
            slotProps={{
              button: {
                onClick: (event) => {
                  order.push('button');
                  if (prevent) event.preventDefault();
                },
              },
            }}
          >
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          </Nav.Category>
        </Nav>
      );
    }
    const { rerender } = render(<Toggle prevent />);
    await user.click(toggle());
    expect(order).toEqual(['button']);
    expect(onOpenCategoriesChange).not.toHaveBeenCalled();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    rerender(<Toggle prevent={false} />);
    await user.click(toggle());
    expect(onOpenCategoriesChange).toHaveBeenCalledWith(['docs']);
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the category as it is on a click prevented in the label part or in your label content', async () => {
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    const order: string[] = [];
    const prevent = (name: string) => (event: React.MouseEvent) => {
      order.push(name);
      event.preventDefault();
    };
    const { rerender } = render(
      <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{ label: { onClick: prevent('label') } }}
        >
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    await user.click(screen.getByText('Docs'));
    // With a toggle part too: yours run from the inside out, then nothing.
    rerender(
      <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{
            label: { onClick: prevent('label') },
            button: { onClick: () => void order.push('button') },
          }}
        >
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    await user.click(screen.getByText('Docs'));
    // Your own label content that prevents the click, without parts.
    rerender(
      <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
        <Nav.Category value="docs" label={<span onClick={prevent('content')}>Docs</span>}>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    await user.click(screen.getByText('Docs'));
    expect(order).toEqual(['label', 'label', 'button', 'content']);
    expect(onOpenCategoriesChange).not.toHaveBeenCalled();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    // A label part that prevents nothing: the click opens the category.
    rerender(
      <Nav onOpenCategoriesChange={onOpenCategoriesChange}>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{ label: { onClick: () => void order.push('mine') } }}
        >
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    await user.click(screen.getByText('Docs'));
    expect(onOpenCategoriesChange).toHaveBeenCalledWith(['docs']);
  });

  it('runs your content handler before the item’s: preventDefault() leaves a button unselected and a link selected but not followed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const order: string[] = [];
    const followed: boolean[] = [];
    const record = (event: MouseEvent) => {
      if ((event.target as Element).closest?.('a')) followed.push(!event.defaultPrevented);
      event.preventDefault();
    };
    document.addEventListener('click', record);
    onTestFinished(() => document.removeEventListener('click', record));
    const content = {
      onClick: (event: React.MouseEvent) => {
        order.push('content');
        event.preventDefault();
      },
    };
    render(
      <Nav onValueChange={onValueChange}>
        <Nav.Item
          value="home"
          icon={<span>H</span>}
          onClick={() => void order.push('home')}
          slotProps={{ content }}
        >
          Home
        </Nav.Item>
        <Nav.Item
          value="reports"
          href="#reports"
          icon={<span>R</span>}
          onClick={() => void order.push('reports')}
          slotProps={{ content }}
        >
          Reports
        </Nav.Item>
      </Nav>,
    );
    await user.click(screen.getByText('Home'));
    expect(order).toEqual(['content', 'home']);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(button('Home')).not.toHaveAttribute('aria-current');
    await user.click(screen.getByText('Reports'));
    expect(order).toEqual(['content', 'home', 'content', 'reports']);
    expect(onValueChange).toHaveBeenCalledWith('reports');
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page');
    expect(followed).toEqual([false]);
  });

  it('does not call your content click handler while the item is disabled', () => {
    const onClick = vi.fn();
    const onValueChange = vi.fn();
    function Item(props: { disabled?: boolean; 'aria-disabled'?: boolean; href?: string }) {
      return (
        <Nav onValueChange={onValueChange}>
          <Nav.Item
            value="home"
            icon={<span>H</span>}
            {...props}
            slotProps={{ content: { onClick } }}
          >
            Home
          </Nav.Item>
        </Nav>
      );
    }
    const { rerender } = render(<Item disabled />);
    fireEvent.click(screen.getByText('Home'));
    rerender(<Item disabled href="#home" />);
    fireEvent.click(screen.getByText('Home'));
    expect(onClick).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(<Item />);
    fireEvent.click(screen.getByText('Home'));
    expect(onClick).toHaveBeenCalledTimes(1);
    // Your aria-disabled alone does not disable the item: it is selected, and yours is called.
    rerender(<Item aria-disabled />);
    fireEvent.click(screen.getByText('Home'));
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('calls the handlers of the list items, the actions and the lists after the entries’ own; the actions still select nothing', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onValueChange = vi.fn();
    const push = (name: string) => ({ onClick: () => void order.push(name) });
    render(
      <Nav
        defaultOpenCategories={['docs']}
        onValueChange={onValueChange}
        slotProps={{ list: push('nav-list') }}
      >
        <Nav.Item
          value="home"
          onClick={() => void order.push('home')}
          actions={
            <button type="button" onClick={() => void order.push('pin')}>
              Pin Home
            </button>
          }
          slotProps={{ listItem: push('li'), actions: push('actions') }}
        >
          Home
        </Nav.Item>
        <Nav.Category value="docs" label="Docs" slotProps={{ list: push('list') }}>
          <Nav.SubItem
            value="intro"
            onClick={() => void order.push('intro')}
            slotProps={{ listItem: push('sub-li') }}
          >
            Introduction
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    await user.click(button('Pin Home'));
    expect(order).toEqual(['pin', 'actions', 'li', 'nav-list']);
    expect(onValueChange).not.toHaveBeenCalled();
    order.length = 0;
    await user.click(button('Home'));
    expect(order).toEqual(['home', 'li', 'nav-list']);
    order.length = 0;
    await user.click(button('Introduction'));
    expect(order).toEqual(['intro', 'sub-li', 'list', 'nav-list']);
    expect(onValueChange.mock.calls).toEqual([['home'], ['intro']]);
  });

  it('runs a category list part’s keys before an arrow-key body’s: preventDefault() skips them', async () => {
    const user = userEvent.setup();
    function Keys({ prevent }: { prevent: boolean }) {
      return (
        <ArrowBody defaultOpenCategories={['docs']}>
          <Nav.Category
            value="docs"
            label="Docs"
            slotProps={{
              list: {
                onKeyDown: (event) => {
                  if (prevent) event.preventDefault();
                },
              },
            }}
          >
            <Nav.SubItem value="intro">Introduction</Nav.SubItem>
            <Nav.SubItem value="api">API</Nav.SubItem>
          </Nav.Category>
        </ArrowBody>
      );
    }
    const { rerender } = render(<Keys prevent />);
    act(() => button('Introduction').focus());
    await user.keyboard('{ArrowDown}');
    expect(button('Introduction')).toHaveFocus();
    rerender(<Keys prevent={false} />);
    await user.keyboard('{ArrowDown}');
    expect(button('API')).toHaveFocus();
  });

  it('calls each part handler once per click in StrictMode; the Nav updates once', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenCategoriesChange = vi.fn();
    const handlers = {
      navList: vi.fn(),
      button: vi.fn(),
      label: vi.fn(),
      list: vi.fn(),
      listItem: vi.fn(),
      content: vi.fn(),
      subItem: vi.fn(),
    };
    render(
      <React.StrictMode>
        <Nav
          onValueChange={onValueChange}
          onOpenCategoriesChange={onOpenCategoriesChange}
          slotProps={{ list: { onClick: handlers.navList } }}
        >
          <Nav.Item
            value="home"
            icon={<span>H</span>}
            slotProps={{
              listItem: { onClick: handlers.listItem },
              content: { onClick: handlers.content },
            }}
          >
            Home
          </Nav.Item>
          <Nav.Category
            value="docs"
            label="Docs"
            slotProps={{
              button: { onClick: handlers.button },
              label: { onClick: handlers.label },
              list: { onClick: handlers.list },
            }}
          >
            <Nav.SubItem value="intro" slotProps={{ listItem: { onClick: handlers.subItem } }}>
              Introduction
            </Nav.SubItem>
          </Nav.Category>
        </Nav>
      </React.StrictMode>,
    );
    await user.click(screen.getByText('Home'));
    await user.click(screen.getByText('Docs'));
    await user.click(button('Introduction'));
    expect(handlers.navList).toHaveBeenCalledTimes(3);
    const { navList: _navList, ...once } = handlers;
    for (const handler of Object.values(once)) expect(handler).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls).toEqual([['home'], ['intro']]);
    expect(onOpenCategoriesChange.mock.calls).toEqual([[['docs']]]);
  });

  it('ignores the parts a component does not render', () => {
    const anyParts = {
      listItem: { className: 'my-sub-li' },
      content: { className: 'my-content' },
    } as SubItemSlotProps;
    render(
      <Nav defaultOpenCategories={['more']} slotProps={{ list: { className: 'my-nav-list' } }}>
        {/* No actions: no actions part. */}
        <Nav.Item value="home" slotProps={{ actions: { className: 'my-actions' } }}>
          Home
        </Nav.Item>
        {/* A closed category: no list part yet. */}
        <Nav.Category value="docs" label="Docs" slotProps={{ list: { className: 'my-list' } }}>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="more" label="More">
          {/* A sub-item draws no label span: no content part. */}
          <Nav.SubItem value="x" slotProps={anyParts}>
            X
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    expect(document.querySelector('.my-actions')).toBeNull();
    expect(document.querySelector('.my-list')).toBeNull();
    expect(document.querySelector('.my-content')).toBeNull();
    expect(button('X').closest('li')).toHaveClass('my-sub-li');
    expect(screen.getByRole('navigation').firstElementChild).toHaveClass('my-nav-list');
  });

  it('applies the parts in RTL, where an arrow-key body still swaps Left and Right', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ArrowBody defaultOpenCategories={['docs']}>
        <Nav.Category
          value="docs"
          label="Docs"
          slotProps={{ button: { className: 'my-button' }, list: { className: 'my-list' } }}
        >
          <Nav.SubItem value="intro" slotProps={{ listItem: { className: 'my-li' } }}>
            Introduction
          </Nav.SubItem>
        </Nav.Category>
      </ArrowBody>,
      { dir: 'rtl' },
    );
    expect(toggle()).toHaveClass('my-button');
    expect(button('Introduction').closest('li')).toHaveClass('my-li');
    act(() => toggle().focus());
    await user.keyboard('{ArrowLeft}');
    expect(button('Introduction')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(toggle()).toHaveFocus();
  });

  it('has no accessibility violations with every part customised', async () => {
    const mine = (name: string) => ({ className: `my-${name}`, title: name });
    render(
      <Entries
        parts={{
          nav: { list: mine('nav-list') },
          category: { button: mine('button'), label: mine('label'), list: mine('list') },
          item: { listItem: mine('li'), content: mine('content'), actions: mine('actions') },
          subItem: { listItem: mine('sub-li'), actions: mine('sub-actions') },
        }}
      />,
    );
    await expectNoA11yViolations();
  });

  it('types each part for its element, and takes no children', () => {
    expectTypeOf<keyof ListSlotProps>().toEqualTypeOf<'list'>();
    expectTypeOf<keyof CategorySlotProps>().toEqualTypeOf<'button' | 'label' | 'list'>();
    expectTypeOf<keyof ItemSlotProps>().toEqualTypeOf<'listItem' | 'content' | 'actions'>();
    expectTypeOf<keyof SubItemSlotProps>().toEqualTypeOf<'listItem' | 'actions'>();
    expectTypeOf<NonNullable<ListSlotProps['list']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLUListElement> | undefined
    >();
    expectTypeOf<NonNullable<CategorySlotProps['button']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<NonNullable<CategorySlotProps['label']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    expectTypeOf<NonNullable<ItemSlotProps['listItem']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<NonNullable<SubItemSlotProps['actions']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLSpanElement> | undefined
    >();
    // Every branch of the items takes the same parts.
    expectTypeOf<NavItemAnchorProps['slotProps']>().toEqualTypeOf<NavItemOwnProps['slotProps']>();
    expectTypeOf<NavItemDynamicProps['slotProps']>().toEqualTypeOf<NavItemOwnProps['slotProps']>();
    expectTypeOf<NavSubItemButtonProps['slotProps']>().toEqualTypeOf<
      NavSubItemOwnProps['slotProps']
    >();
    // @ts-expect-error -- a part takes no children: the Nav renders them
    void (<Nav slotProps={{ list: { children: 'List' } }} />);
    // @ts-expect-error -- a part takes no children: the category renders them
    void (<Nav.Category value="docs" slotProps={{ label: { children: 'Docs' } }} />);
    void (
      (
        // @ts-expect-error -- a part takes no children: the item renders them
        <Nav.Item value="home" slotProps={{ content: { children: 'Home' } }}>
          Home
        </Nav.Item>
      )
    );
    void (
      (
        // @ts-expect-error -- a sub-item draws no label span
        <Nav.SubItem value="intro" slotProps={{ content: {} }}>
          Introduction
        </Nav.SubItem>
      )
    );
  });
});
