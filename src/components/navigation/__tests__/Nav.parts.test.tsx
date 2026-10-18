/**
 * The parts of Nav (spec P6-09): `Nav.SectionHeader` (a heading in its own list item, D115),
 * `Nav.Divider` (a decorative list item hidden from assistive technology, D116), `Nav.AppItem` (a
 * link or button that is never selected, D117) and `Nav.AppItemStatic` (the same layout as plain
 * text, D118); their context rule (D122), Server Component references (D123) and the structure of a
 * Nav that holds them (D114: every child of a Nav list is an `<li>`).
 */
import * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  NavAppItemAnchorProps,
  NavAppItemButtonProps,
  NavAppItemDynamicProps,
  NavAppItemOwnProps,
  NavAppItemProps,
  NavAppItemStaticProps,
  NavDividerProps,
  NavSectionHeaderProps,
} from '../Nav';
import {
  dividerClassNames,
  navAppItemClassNames,
  navAppItemStaticClassNames,
  navDividerClassNames,
  navSectionHeaderClassNames,
} from '../../../lib/classNames';
import type { Slot } from '../../../lib/types';
import { disabledStyles, focusRingInset } from '../../../lib/styles';
import {
  asClientReference,
  createOverlayTestWrapper,
  expectNoA11yViolations,
  expectThrows,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const NavWrapper = createOverlayTestWrapper(Nav, {});

/** The `<ul>` of the Nav named `name` (default "Navigation"). */
const navList = (name = 'Navigation') =>
  screen.getByRole('navigation', { name }).firstElementChild as HTMLUListElement;

/**
 * Header children that render nothing: an empty string, an empty list, an empty Fragment and a
 * generator of nothing (a factory each, since a generator is one-shot).
 */
const EMPTY_CHILDREN = [
  ["''", () => ''],
  ['an empty array', () => []],
  ['an empty Fragment', () => <></>],
  [
    'a generator of nothing',
    function* nothing() {
      yield null;
      yield '';
    },
  ],
] as Array<[string, () => React.ReactNode]>;

describe('Nav.SectionHeader', () => {
  testSystemProps(Nav.SectionHeader, {
    expectedTag: 'h3',
    displayName: 'NavSectionHeader',
    wrapper: NavWrapper,
    defaultProps: { children: 'Benefits' },
    conflictingClass: { className: 'px-6', overrides: 'px-4' },
  });

  it('is a level-3 heading in its own list item of the Nav list', () => {
    render(
      <Nav>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.SectionHeader>Benefits</Nav.SectionHeader>
        <Nav.Item value="health">Health plans</Nav.Item>
      </Nav>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Benefits' });
    expect(heading.tagName).toBe('H3');
    const item = heading.parentElement as HTMLElement;
    expect(item.tagName).toBe('LI');
    expect(item.parentElement).toBe(navList());
    expect(within(navList()).getAllByRole('listitem')).toContain(item);
    // It groups nothing: the items that follow are its siblings, not its children.
    expect(item.children).toHaveLength(1);
    expect(heading).not.toHaveAttribute('aria-labelledby');
    expect(
      screen.getByRole('button', { name: 'Health plans' }).closest('li')?.previousElementSibling,
    ).toBe(item);
  });

  it.each([1, 2, 4, 5, 6] as const)(
    'headingLevel={%i} renders the heading element of that level',
    (level) => {
      render(
        <Nav>
          <Nav.SectionHeader headingLevel={level}>Benefits</Nav.SectionHeader>
        </Nav>,
      );
      const heading = screen.getByRole('heading', { level, name: 'Benefits' });
      expect(heading.tagName).toBe(`H${level}`);
      expect(heading).toHaveClass(navSectionHeaderClassNames.root);
    },
  );

  it.each(EMPTY_CHILDREN)(
    'children that render nothing (%s) render no list item and no heading',
    (_name, children) => {
      render(
        <Nav>
          <Nav.SectionHeader>{children()}</Nav.SectionHeader>
        </Nav>,
      );
      expect(screen.queryByRole('heading')).toBeNull();
      expect(navList().childNodes).toHaveLength(0);
    },
  );

  it('renders the items of a generator that yields content', () => {
    function* parts() {
      yield 'Bene';
      yield 'fits';
    }
    render(
      <Nav>
        <Nav.SectionHeader>{parts()}</Nav.SectionHeader>
      </Nav>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Benefits' })).toBeInTheDocument();
  });

  it("sits in an open category's list", () => {
    render(
      <Nav defaultOpenCategories={['docs']}>
        <Nav.Category value="docs" label="Docs">
          <Nav.SectionHeader>Guides</Nav.SectionHeader>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: 'Guides' });
    const categoryList = screen.getByRole('button', { name: 'Docs' }).nextElementSibling;
    expect(heading.parentElement?.parentElement).toBe(categoryList);
  });

  it('gives className, style, id and the rest to the heading, and its own class to the list item', () => {
    render(
      <Nav>
        <Nav.SectionHeader
          id="benefits"
          className="text-primary"
          style={{ letterSpacing: '1px' }}
          data-section="benefits"
        >
          Benefits
        </Nav.SectionHeader>
      </Nav>,
    );
    const heading = screen.getByRole('heading', { name: 'Benefits' });
    expect(heading).toHaveAttribute('id', 'benefits');
    expect(heading).toHaveAttribute('data-section', 'benefits');
    expect(heading).toHaveStyle({ letterSpacing: '1px' });
    expect(heading).toHaveClass('text-primary');
    expect(heading).not.toHaveClass('text-muted-foreground');
    const item = heading.parentElement as HTMLElement;
    expect(item.className).toBe(navSectionHeaderClassNames.listItem);
    expect(item).not.toHaveAttribute('id');
  });

  // Phase 4 rule 14: the default look is pinned; C-NATIVE (its own margin) and C-LOGICAL.
  it('draws the default look with its own margin and logical alignment, also in RTL', () => {
    renderWithProviders(
      <Nav>
        <Nav.SectionHeader>Benefits</Nav.SectionHeader>
      </Nav>,
      { dir: 'rtl' },
    );
    const heading = screen.getByRole('heading', { name: 'Benefits' });
    expect(heading).toHaveClass(
      navSectionHeaderClassNames.root,
      'm-0',
      'px-4',
      'pt-3',
      'pb-1',
      'text-caption-1',
      'font-semibold',
      'text-muted-foreground',
      'text-start',
    );
    expect(heading.className).not.toMatch(/\btext-(left|right)\b|\bp[lr]-|\bm[lr]-/);
  });

  it('types headingLevel as HeadingLevel and ref as a heading ref', () => {
    const ref = React.createRef<HTMLHeadingElement>();
    render(
      <Nav>
        <Nav.SectionHeader ref={ref} headingLevel={2}>
          Benefits
        </Nav.SectionHeader>
      </Nav>,
    );
    expect(ref.current).toBe(screen.getByRole('heading', { level: 2 }));
    const props: NavSectionHeaderProps = { headingLevel: 6, children: 'Benefits' };
    expect(props.headingLevel).toBe(6);
    // @ts-expect-error -- a heading level is 1 to 6
    const invalid: NavSectionHeaderProps = { headingLevel: 7 };
    expect(invalid).toBeDefined();
  });
});

describe('Nav.Divider', () => {
  testSystemProps(Nav.Divider, {
    expectedTag: 'li',
    displayName: 'NavDivider',
    wrapper: NavWrapper,
    conflictingClass: { className: 'my-2', overrides: 'my-1' },
  });

  it('is a list item hidden from assistive technology, no separator', () => {
    render(
      <Nav>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Divider />
        <Nav.Item value="settings">Settings</Nav.Item>
      </Nav>,
    );
    const divider = navList().children[1] as HTMLElement;
    expect(divider.tagName).toBe('LI');
    expect(divider).toHaveAttribute('aria-hidden', 'true');
    expect(divider).toHaveClass(navDividerClassNames.root);
    expect(divider).toBeEmptyDOMElement();
    expect(divider).not.toHaveAttribute('role');
    expect(screen.queryByRole('separator')).toBeNull();
    // The list counts its destinations only.
    expect(within(navList()).getAllByRole('listitem')).toHaveLength(2);
  });

  // Phase 4 rule 14: the default look is pinned; a border, so it is drawn in forced colours.
  it('draws a line with a theme border and forced-colours border, not through Divider', () => {
    render(
      <Nav>
        <Nav.Divider />
      </Nav>,
    );
    const divider = navList().firstElementChild as HTMLElement;
    expect(divider).toHaveClass(
      navDividerClassNames.root,
      'my-1',
      'h-0',
      'border-t',
      'border-border',
      'forced-colors:border-[CanvasText]',
    );
    expect(divider).not.toHaveClass(dividerClassNames.root);
  });

  it('keeps aria-hidden="true" over a consumer aria-hidden={false} (rendered after the rest)', () => {
    const consumer = { 'aria-hidden': false } as unknown as NavDividerProps;
    render(
      <Nav>
        <Nav.Divider {...consumer} data-testid="divider" />
      </Nav>,
    );
    expect(screen.getByTestId('divider')).toHaveAttribute('aria-hidden', 'true');
  });

  it('passes axe as the only child of the Nav list and of an open category list', async () => {
    const { unmount } = render(
      <Nav>
        <Nav.Divider />
      </Nav>,
    );
    await expectNoA11yViolations();
    unmount();
    render(
      <Nav defaultOpenCategories={['docs']}>
        <Nav.Category value="docs" label="Docs">
          <Nav.Divider />
        </Nav.Category>
      </Nav>,
    );
    const categoryList = screen.getByRole('button', { name: 'Docs' }).nextElementSibling;
    expect(categoryList?.firstElementChild).toHaveClass(navDividerClassNames.root);
    await expectNoA11yViolations();
  });

  it('has no children, role or aria-hidden props', () => {
    // @ts-expect-error -- a divider has no content
    const withChildren: NavDividerProps = { children: 'Section' };
    // @ts-expect-error -- a separator role would fail the list rule
    const withRole: NavDividerProps = { role: 'separator' };
    // @ts-expect-error -- it is always hidden from assistive technology
    const withHidden: NavDividerProps = { 'aria-hidden': false };
    expect([withChildren, withRole, withHidden]).toHaveLength(3);
  });
});

/**
 * Icons that render nothing (`Nav.test.tsx`'s list): `icon={name && <Icon />}` with `name` '' or a
 * count of 0, and a list mapped to nothing. A factory each, since a generator is one-shot.
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

describe('Nav.AppItem', () => {
  describe('as a button', () => {
    testSystemProps(Nav.AppItem, {
      expectedTag: 'button',
      displayName: 'NavAppItem',
      wrapper: NavWrapper,
      defaultProps: { children: 'Contoso HR' },
      conflictingClass: { className: 'px-6', overrides: 'px-4' },
    });
  });

  describe('as a link', () => {
    testSystemProps(Nav.AppItem, {
      expectedTag: 'a',
      displayName: 'NavAppItem',
      wrapper: NavWrapper,
      defaultProps: { href: '#home', children: 'Contoso HR' },
      conflictingClass: { className: 'px-6', overrides: 'px-4' },
    });
  });

  testNoImplicitSubmit(Nav, {
    defaultProps: { children: <Nav.AppItem>Contoso HR</Nav.AppItem> },
  });

  it('is a link named by its text with href, a type="button" button without, each in its own list item', () => {
    const { unmount } = render(
      <Nav>
        <Nav.AppItem href="#home">Contoso HR</Nav.AppItem>
      </Nav>,
    );
    const link = screen.getByRole('link', { name: 'Contoso HR' });
    expect(link).toHaveAttribute('href', '#home');
    expect(link).toHaveClass(navAppItemClassNames.root);
    expect(link.parentElement?.className).toBe(navAppItemClassNames.listItem);
    expect(link.parentElement?.parentElement).toBe(navList());
    unmount();
    render(
      <Nav>
        <Nav.AppItem>Contoso HR</Nav.AppItem>
      </Nav>,
    );
    const button = screen.getByRole('button', { name: 'Contoso HR' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.parentElement?.className).toBe(navAppItemClassNames.listItem);
    const content = button.lastElementChild as HTMLElement;
    expect(content).toHaveClass(navAppItemClassNames.content, 'flex-1', 'text-start');
    expect(content).toHaveTextContent('Contoso HR');
  });

  it('is never selected: a click, Enter and Space never call onValueChange or set aria-current', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onClick = vi.fn();
    const onLinkClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <React.StrictMode>
        <Nav defaultValue="home" onValueChange={onValueChange}>
          <Nav.AppItem onClick={onClick}>Contoso HR</Nav.AppItem>
          <Nav.AppItem href="#home" onClick={onLinkClick}>
            Contoso home
          </Nav.AppItem>
          <Nav.Item value="home" href="#home">
            Home
          </Nav.Item>
        </Nav>
      </React.StrictMode>,
    );
    const button = screen.getByRole('button', { name: 'Contoso HR' });
    const link = screen.getByRole('link', { name: 'Contoso home' });
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
    // Its href equals the current item's, still nothing is marked or selected.
    await user.click(link);
    expect(onLinkClick).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(button).not.toHaveAttribute('aria-current');
    expect(link).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it("passes a consumer's aria-current through", () => {
    render(
      <Nav>
        <Nav.AppItem href="#home" aria-current="page">
          Contoso HR
        </Nav.AppItem>
      </Nav>,
    );
    expect(screen.getByRole('link', { name: 'Contoso HR' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('renders the icon hidden in a box that grows with its content', () => {
    render(
      <Nav>
        <Nav.AppItem icon={<svg data-testid="logo" />}>Contoso HR</Nav.AppItem>
        <Nav.AppItem icon={{ className: 'text-primary', children: <svg data-testid="slot" /> }}>
          Fabrikam
        </Nav.AppItem>
      </Nav>,
    );
    const icon = screen.getByTestId('logo').parentElement as HTMLElement;
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass(
      navAppItemClassNames.icon,
      'flex',
      'min-h-5',
      'min-w-5',
      'shrink-0',
      'items-center',
      'justify-center',
    );
    expect(icon).not.toHaveClass('h-5');
    expect(icon).not.toHaveClass('w-5');
    const slot = screen.getByTestId('slot').parentElement as HTMLElement;
    expect(slot).toHaveClass(navAppItemClassNames.icon, 'text-primary');
    expect(slot).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(EMPTY_ICONS)('an icon that renders nothing (%s) renders no icon box', (_name, icon) => {
    render(
      <Nav>
        <Nav.AppItem icon={icon()}>Contoso HR</Nav.AppItem>
      </Nav>,
    );
    const button = screen.getByRole('button', { name: 'Contoso HR' });
    expect(button.children).toHaveLength(1);
    expect(button.querySelector(`.${navAppItemClassNames.icon}`)).toBeNull();
  });

  // Phase 4 rule 14: the default look is pinned (C-NATIVE, C-LOGICAL, C-FOCUS, C-TOKENS).
  it.each([
    ['button', {}],
    ['link', { href: '#home' }],
  ] as const)(
    'draws the default look as a %s, with the inset ring and the gated hover',
    (role, props) => {
      renderWithProviders(
        <Nav>
          <Nav.AppItem {...props}>Contoso HR</Nav.AppItem>
        </Nav>,
        { dir: 'rtl' },
      );
      const item = screen.getByRole(role, { name: 'Contoso HR' });
      expect(item).toHaveClass(
        navAppItemClassNames.root,
        'flex',
        'w-full',
        'items-center',
        'gap-2',
        'px-4',
        'py-2',
        'text-subtitle-2',
        'text-start',
        'text-foreground',
        'no-underline',
        'bg-transparent',
        'transition-colors',
        'motion-reduce:transition-none',
        'not-disabled:not-aria-disabled:hover:bg-subtle-hover',
        ...focusRingInset.split(' '),
        ...disabledStyles.split(' '),
      );
      expect(item.className).not.toMatch(/(^|\s)hover:/);
      expect(item.className).not.toMatch(/\btext-(left|right)\b|\bp[lr]-|\bm[lr]-/);
    },
  );

  it('looks unavailable when the consumer disables it, with no logic of its own', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Nav>
        <Nav.AppItem disabled onClick={onClick}>
          Contoso HR
        </Nav.AppItem>
      </Nav>,
    );
    const button = screen.getByRole('button', { name: 'Contoso HR' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass(...disabledStyles.split(' '));
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('never renders a value attribute on the button', () => {
    const consumer = { value: 'home' } as unknown as NavAppItemButtonProps;
    render(
      <Nav>
        <Nav.AppItem {...consumer}>Contoso HR</Nav.AppItem>
      </Nav>,
    );
    expect(screen.getByRole('button', { name: 'Contoso HR' })).not.toHaveAttribute('value');
  });

  it('is a Tab stop in DOM order', async () => {
    const user = userEvent.setup();
    render(
      <Nav>
        <Nav.AppItem href="#home">Contoso HR</Nav.AppItem>
        <Nav.Item value="home">Home</Nav.Item>
      </Nav>,
    );
    await user.tab();
    expect(screen.getByRole('link', { name: 'Contoso HR' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus();
  });

  it('passes axe as a link with an icon and as a button', async () => {
    render(
      <Nav>
        <Nav.AppItem href="#home" icon={<svg />}>
          Contoso HR
        </Nav.AppItem>
        <Nav.AppItem>Fabrikam</Nav.AppItem>
      </Nav>,
    );
    await expectNoA11yViolations();
  });

  it('is typed by href: link props with it, button props without, value on no branch', () => {
    const linkRef = React.createRef<HTMLAnchorElement>();
    const buttonRef = React.createRef<HTMLButtonElement>();
    render(
      <Nav>
        <Nav.AppItem
          href="#home"
          target="_self"
          ref={linkRef}
          onClick={(e) => {
            expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLAnchorElement>>();
          }}
        >
          Contoso HR
        </Nav.AppItem>
        <Nav.AppItem
          ref={buttonRef}
          onClick={(e) => {
            expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLButtonElement>>();
          }}
        >
          Fabrikam
        </Nav.AppItem>
        {/* @ts-expect-error target needs href: without it the app item is a button */}
        <Nav.AppItem target="_blank">Northwind</Nav.AppItem>
        {/* @ts-expect-error an app item has no value (button branch) */}
        <Nav.AppItem value="home">Northwind</Nav.AppItem>
        {/* @ts-expect-error an app item has no value (link branch) */}
        <Nav.AppItem href="#home" value="home">
          Northwind
        </Nav.AppItem>
      </Nav>,
    );
    expect(linkRef.current?.tagName).toBe('A');
    expect(buttonRef.current?.tagName).toBe('BUTTON');
    expectTypeOf<NavAppItemProps>().toEqualTypeOf<NavAppItemAnchorProps | NavAppItemButtonProps>();
    expectTypeOf<NavAppItemAnchorProps>().toMatchTypeOf<NavAppItemOwnProps>();
    expectTypeOf<NavAppItemButtonProps>().toMatchTypeOf<NavAppItemOwnProps>();
    expectTypeOf<NavAppItemOwnProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
  });

  it('resolves a runtime href (string | undefined) to the dynamic props, a link or a button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    function Dynamic({ href }: { href?: string }) {
      return (
        <Nav.AppItem
          href={href}
          onClick={(e) => {
            expectTypeOf(e).toEqualTypeOf<
              React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>
            >();
            e.preventDefault();
            onClick(e.currentTarget.tagName);
          }}
        >
          Contoso HR
        </Nav.AppItem>
      );
    }
    const { rerender } = render(
      <Nav>
        <Dynamic />
      </Nav>,
    );
    await user.click(screen.getByRole('button', { name: 'Contoso HR' }));
    expect(onClick).toHaveBeenLastCalledWith('BUTTON');
    rerender(
      <Nav>
        <Dynamic href="#home" />
      </Nav>,
    );
    await user.click(screen.getByRole('link', { name: 'Contoso HR' }));
    expect(onClick).toHaveBeenLastCalledWith('A');
    expectTypeOf<React.ComponentProps<typeof NavAppItem>>().toEqualTypeOf<NavAppItemDynamicProps>();
  });
});

describe('Nav.AppItemStatic', () => {
  testSystemProps(Nav.AppItemStatic, {
    expectedTag: 'div',
    displayName: 'NavAppItemStatic',
    wrapper: NavWrapper,
    defaultProps: { children: 'Contoso HR' },
    conflictingClass: { className: 'px-6', overrides: 'px-4' },
  });

  it('is plain text in a div in its own list item: no role, not a Tab stop, no hover', async () => {
    const user = userEvent.setup();
    render(
      <Nav>
        <Nav.AppItemStatic icon={<svg data-testid="logo" />}>Contoso HR</Nav.AppItemStatic>
        <Nav.Item value="home">Home</Nav.Item>
      </Nav>,
    );
    const root = navList().firstElementChild?.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.parentElement?.className).toBe(navAppItemStaticClassNames.listItem);
    expect(root).not.toHaveAttribute('role');
    expect(root).not.toHaveAttribute('tabindex');
    expect(root).toHaveClass(
      navAppItemStaticClassNames.root,
      'flex',
      'w-full',
      'items-center',
      'gap-2',
      'px-4',
      'py-2',
      'text-subtitle-2',
      'text-start',
      'text-foreground',
      'cursor-default',
    );
    expect(root).not.toHaveClass(navAppItemClassNames.root);
    expect(root.className).not.toMatch(/hover:/);
    const icon = screen.getByTestId('logo').parentElement as HTMLElement;
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass(navAppItemStaticClassNames.icon, 'min-h-5', 'min-w-5');
    expect(root.lastElementChild).toHaveClass(navAppItemStaticClassNames.content);
    expect(root.lastElementChild).toHaveTextContent('Contoso HR');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus();
    await expectNoA11yViolations();
  });

  it.each(EMPTY_ICONS)('an icon that renders nothing (%s) renders no icon box', (_name, icon) => {
    render(
      <Nav>
        <Nav.AppItemStatic icon={icon()}>Contoso HR</Nav.AppItemStatic>
      </Nav>,
    );
    const root = navList().firstElementChild?.firstElementChild as HTMLElement;
    expect(root.children).toHaveLength(1);
    expect(root.querySelector(`.${navAppItemStaticClassNames.icon}`)).toBeNull();
  });

  it('types its ref as a div ref', () => {
    expectTypeOf<NavAppItemStaticProps['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
  });
});

// C-CONTEXT (D122): each part reads the Nav context.
describe('outside a Nav', () => {
  const PARTS = [
    ['Nav.SectionHeader', () => <Nav.SectionHeader>Benefits</Nav.SectionHeader>],
    ['Nav.Divider', () => <Nav.Divider />],
    ['Nav.AppItem', () => <Nav.AppItem>Contoso HR</Nav.AppItem>],
    ['Nav.AppItemStatic', () => <Nav.AppItemStatic>Fabrikam</Nav.AppItemStatic>],
  ] as const;

  it.each(PARTS)('%s throws in development', (name, renderPart) => {
    expectThrows(<ul>{renderPart()}</ul>, `[WaveUI] ${name} must be used within Nav`);
  });

  it('logs each part once in production and renders it', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const parts = (count: number) => (
        <ul>
          {Array.from({ length: count }, (_, index) => (
            <React.Fragment key={index}>
              {PARTS.map(([name, renderPart]) => (
                <React.Fragment key={name}>{renderPart()}</React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </ul>
      );
      const { container, rerender } = render(parts(1));
      rerender(parts(2));
      expect(screen.getAllByRole('heading', { level: 3, name: 'Benefits' })).toHaveLength(2);
      expect(container.querySelectorAll(`.${navDividerClassNames.root}`)).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Contoso HR' })).toHaveLength(2);
      expect(container.querySelectorAll(`.${navAppItemStaticClassNames.root}`)).toHaveLength(2);
      expect(error.mock.calls).toEqual([
        ['[WaveUI] Nav.SectionHeader must be used within Nav'],
        ['[WaveUI] Nav.Divider must be used within Nav'],
        ['[WaveUI] Nav.AppItem must be used within Nav'],
        ['[WaveUI] Nav.AppItemStatic must be used within Nav'],
      ]);
    } finally {
      error.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});

// C-COMPOUND (D123): parts written in a Server Component reach the client as lazy references.
describe('parts written in a Server Component', () => {
  const tree = (parts: {
    SectionHeader: typeof NavSectionHeader;
    Divider: typeof NavDivider;
    AppItem: typeof NavAppItem;
    AppItemStatic: typeof NavAppItemStatic;
    Category: typeof NavCategory;
    Item: typeof NavItem;
    SubItem: typeof NavSubItem;
  }) => (
    <Nav defaultValue="intro">
      <parts.AppItem href="#start" icon={<svg />} onClick={appItemClick}>
        Contoso HR
      </parts.AppItem>
      <parts.SectionHeader headingLevel={2}>Library</parts.SectionHeader>
      <parts.Item value="home">Home</parts.Item>
      <parts.Divider />
      <parts.Category value="docs" label="Docs">
        <parts.SectionHeader>Guides</parts.SectionHeader>
        <parts.SubItem value="intro">Introduction</parts.SubItem>
        <parts.Divider />
      </parts.Category>
      <parts.AppItemStatic>Fabrikam</parts.AppItemStatic>
    </Nav>
  );
  const appItemClick = vi.fn((event: React.MouseEvent) => event.preventDefault());
  const plain = {
    SectionHeader: NavSectionHeader,
    Divider: NavDivider,
    AppItem: NavAppItem,
    AppItemStatic: NavAppItemStatic,
    Category: NavCategory,
    Item: NavItem,
    SubItem: NavSubItem,
  };

  it('render the same server HTML as the plain parts', () => {
    const lazy = {
      SectionHeader: asClientReference(NavSectionHeader),
      Divider: asClientReference(NavDivider),
      AppItem: asClientReference(NavAppItem),
      AppItemStatic: asClientReference(NavAppItemStatic),
      Category: asClientReference(NavCategory),
      Item: asClientReference(NavItem),
      SubItem: asClientReference(NavSubItem),
    };
    expect(renderToString(tree(lazy))).toBe(renderToString(tree(plain)));
  });

  it('behave as the plain parts', async () => {
    const user = userEvent.setup();
    render(
      tree({
        SectionHeader: asClientReference(NavSectionHeader),
        Divider: asClientReference(NavDivider),
        AppItem: asClientReference(NavAppItem),
        AppItemStatic: asClientReference(NavAppItemStatic),
        Category: asClientReference(NavCategory),
        Item: asClientReference(NavItem),
        SubItem: asClientReference(NavSubItem),
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Library' })).toBeInTheDocument();
    // The category holding the current page starts open: the walk recognises the lazy parts.
    expect(screen.getByRole('heading', { level: 3, name: 'Guides' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(document.querySelectorAll(`.${navDividerClassNames.root}`)).toHaveLength(2);
    // The app item is never selected: its click runs only the consumer's handler.
    await user.click(screen.getByRole('link', { name: 'Contoso HR' }));
    expect(appItemClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Contoso HR' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Fabrikam')).toHaveClass(navAppItemStaticClassNames.content);
  });
});

// D114: every element child of each list is an <li>, the category open and closed.
describe('structure', () => {
  function FullNav() {
    return (
      <Nav defaultValue="intro">
        <Nav.AppItem href="#start" icon={<svg />}>
          Contoso HR
        </Nav.AppItem>
        <Nav.SectionHeader>Library</Nav.SectionHeader>
        <Nav.Item value="home">Home</Nav.Item>
        <Nav.Item value="files" href="#files">
          Files
        </Nav.Item>
        <Nav.Category value="docs" label="Docs">
          <Nav.SectionHeader>Guides</Nav.SectionHeader>
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
          <Nav.Divider />
          <Nav.SubItem value="api">API</Nav.SubItem>
        </Nav.Category>
        <Nav.Divider />
        <Nav.Item value="settings" actions={<button type="button">Pin settings</button>}>
          Settings
        </Nav.Item>
        <Nav.AppItemStatic>Fabrikam</Nav.AppItemStatic>
      </Nav>
    );
  }

  const expectOnlyListItems = () => {
    const lists = Array.from(
      screen.getByRole('navigation', { name: 'Navigation' }).querySelectorAll('ul'),
    );
    for (const list of lists) {
      expect(Array.from(list.children).every((child) => child.tagName === 'LI')).toBe(true);
    }
    return lists;
  };

  it('holds only list items, with the category open and closed, and passes axe in both', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn');
    render(<FullNav />);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(expectOnlyListItems()).toHaveLength(2);
    // Nav list: app item, header, Home, Files, Docs, Settings, static app item (the divider is
    // hidden); category list: header, Introduction, API.
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    await expectNoA11yViolations();

    await user.click(screen.getByRole('button', { name: 'Docs' }));
    expect(screen.getByRole('button', { name: 'Docs' })).toHaveAttribute('aria-expanded', 'false');
    expect(expectOnlyListItems()).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(7);
    await expectNoA11yViolations();
    expect(warn).not.toHaveBeenCalled();
  });
});
