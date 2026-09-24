import * as React from 'react';
import { describe, it, expect, vi, afterEach, expectTypeOf } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav, NavCategory, NavItem, NavSubItem } from '../Nav';
import type { NavItemProps, NavProps, NavSubItemProps } from '../Nav';
import type { Slot } from '../../../lib/types';
import {
  createOverlayTestWrapper,
  renderWithProviders,
  testCompoundExposure,
  testComposedHandler,
  testNoImplicitSubmit,
  testSystemProps,
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
    ],
    conflictingClass: { className: 'w-72', overrides: 'w-60' },
  });

  testCompoundExposure(Nav, ['Category', 'Item', 'SubItem']);

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
        expect(warn).toHaveBeenCalledWith(
          '[WaveUI] Nav: `selectedValue` is deprecated and will be removed in 1.0. Use `value` instead.',
        );
      });

      it('defaultSelectedValue still sets the initial selection and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<SampleNav defaultSelectedValue="home" />);
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('Nav: `defaultSelectedValue` is deprecated'),
        );
      });

      it('value wins over selectedValue when both are given', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<SampleNav value="home" selectedValue="settings" />);
        expect(button('Home')).toHaveAttribute('aria-current', 'page');
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
        const deprecations = warn.mock.calls.filter(([message]) =>
          String(message).includes('`onNavItemSelect` is deprecated'),
        );
        expect(deprecations).toHaveLength(1);
      });

      it('onNavItemSelect does not fire when a disabled item is activated, the current one included', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
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
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Nav.Category'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Use `label` instead.'));
      await user.click(categoryButton);
      const list = button('Unread').closest('ul') as HTMLElement;
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(list.textContent).toBe('Unread');
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
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(renderOrphan())).toThrow(`[WaveUI] ${name} must be used within Nav`);
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
