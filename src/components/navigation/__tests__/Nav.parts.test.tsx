/**
 * The structural parts of Nav (spec P6-09): `Nav.SectionHeader` (a heading in its own list item,
 * D115) and `Nav.Divider` (a decorative list item hidden from assistive technology, D116); their
 * context rule (D122), Server Component references (D123) and the structure of a Nav that holds
 * them (D114: every child of a Nav list is an `<li>`).
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { Nav, NavCategory, NavDivider, NavItem, NavSectionHeader, NavSubItem } from '../Nav';
import type { NavDividerProps, NavSectionHeaderProps } from '../Nav';
import {
  dividerClassNames,
  navDividerClassNames,
  navSectionHeaderClassNames,
} from '../../../lib/classNames';
import {
  asClientReference,
  createOverlayTestWrapper,
  expectNoA11yViolations,
  expectThrows,
  renderWithProviders,
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

// C-CONTEXT (D122): each part reads the Nav context.
describe('outside a Nav', () => {
  const PARTS = [
    ['Nav.SectionHeader', () => <Nav.SectionHeader>Benefits</Nav.SectionHeader>],
    ['Nav.Divider', () => <Nav.Divider />],
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
      expect(error.mock.calls).toEqual([
        ['[WaveUI] Nav.SectionHeader must be used within Nav'],
        ['[WaveUI] Nav.Divider must be used within Nav'],
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
    Category: typeof NavCategory;
    Item: typeof NavItem;
    SubItem: typeof NavSubItem;
  }) => (
    <Nav defaultValue="intro">
      <parts.SectionHeader headingLevel={2}>Library</parts.SectionHeader>
      <parts.Item value="home">Home</parts.Item>
      <parts.Divider />
      <parts.Category value="docs" label="Docs">
        <parts.SectionHeader>Guides</parts.SectionHeader>
        <parts.SubItem value="intro">Introduction</parts.SubItem>
        <parts.Divider />
      </parts.Category>
    </Nav>
  );
  const plain = {
    SectionHeader: NavSectionHeader,
    Divider: NavDivider,
    Category: NavCategory,
    Item: NavItem,
    SubItem: NavSubItem,
  };

  it('render the same server HTML as the plain parts', () => {
    const lazy = {
      SectionHeader: asClientReference(NavSectionHeader),
      Divider: asClientReference(NavDivider),
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
  });
});

// D114: every element child of each list is an <li>, the category open and closed.
describe('structure', () => {
  function FullNav() {
    return (
      <Nav defaultValue="intro">
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
        <Nav.Item value="settings">Settings</Nav.Item>
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
    // Nav list: header, Home, Files, Docs, Settings (the divider is hidden); category list:
    // header, Introduction, API.
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    await expectNoA11yViolations();

    await user.click(screen.getByRole('button', { name: 'Docs' }));
    expect(screen.getByRole('button', { name: 'Docs' })).toHaveAttribute('aria-expanded', 'false');
    expect(expectOnlyListItems()).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    await expectNoA11yViolations();
    expect(warn).not.toHaveBeenCalled();
  });
});
