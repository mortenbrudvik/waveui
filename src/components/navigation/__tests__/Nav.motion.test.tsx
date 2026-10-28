import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Nav, type NavCategoryProps, type NavProps } from '../Nav';
import { NavDrawer } from '../NavDrawer';
import { Button } from '../../button/Button';
import { navCategoryClassNames, navItemClassNames } from '../../../lib/classNames';
import {
  collapseMotion,
  collapseStructure,
  expandIconMotion,
  navActionsRevealMotion,
} from '../../../lib/motion';
import type { MotionSlot, Slot } from '../../../lib/types';
import {
  expectNoA11yViolations,
  findDanglingIdRefs,
  honourInert,
  mockAnimations,
  mockMatchMedia,
  motionClasses,
  renderWithProviders,
} from '../../../test-utils';

/*
 * P10-NAV (spec §5.3, §2.5, D6, D7, D9, D12): an open Nav.Category's `<ul>` sits in a collapse
 * wrapper, the presence element, whose default motion (the category's `motion`) opens and closes
 * its rows track with a fade. While the list exits it is `inert`, so its items leave an arrow-key
 * body's order, and focus inside it at the close moves to the category button. The category's
 * `expandIcon` follows the optional-indicator rule, and `expandIconMotion` times the turn of the
 * default chevron (or the span of a custom glyph, which never turns). The item actions reveal with
 * a short fade unless the provider turns motion off. jsdom loads no CSS, so the phases wait only
 * where `mockAnimations` gives the wrapper a running animation.
 */

let warn: MockInstance<typeof console.warn>;
let error: MockInstance<typeof console.error>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn');
  error = vi.spyOn(console, 'error');
});
afterEach(() => {
  try {
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

type DocsProps = Partial<NavProps> & { category?: Partial<NavCategoryProps> };

/** Home, the Docs category (Introduction, API) and Settings. */
function Docs({ category, ...navProps }: DocsProps) {
  return (
    <Nav {...navProps}>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Category value="docs" label="Docs" {...category}>
        <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        <Nav.SubItem value="api">API</Nav.SubItem>
      </Nav.Category>
      <Nav.Item value="settings">Settings</Nav.Item>
    </Nav>
  );
}

const button = (name: string) => screen.getByRole('button', { name });
const toggle = () => button('Docs');
/** The category's `<li>`. */
const categoryItem = () => toggle().parentElement as HTMLElement;
const queryList = () => document.querySelector<HTMLElement>('.' + navCategoryClassNames.list);
const list = () => queryList()!;
const queryWrapper = () =>
  document.querySelector<HTMLElement>('.' + navCategoryClassNames.collapse);
const wrapper = () => queryWrapper()!;
/** The presence element of every Nav category list: its collapse wrapper. */
const isCollapse = (el: Element) => el.classList.contains(navCategoryClassNames.collapse);
/** The expand icon of the Docs toggle (the chevron or the span of a custom glyph). */
const expandIcon = () => toggle().querySelector<Element>('.' + navCategoryClassNames.expandIcon);

async function finish(motion: ReturnType<typeof mockAnimations>) {
  await act(async () => {
    await motion.finishAll();
  });
}

/** No word of `recipe` on `el`. */
function expectNoWordOf(el: Element | null, recipe: string) {
  expect(el).not.toBeNull();
  for (const word of motionClasses(recipe)) expect(el, word).not.toHaveClass(word);
}

describe('the collapse wrapper (§5.3 markup)', () => {
  it('li > button, div.collapse > ul.list: structure, default motion, entered, the list its only child', () => {
    render(<Docs defaultOpenCategories={['docs']} />);
    const li = categoryItem();
    const ul = list();
    const collapse = ul.parentElement!;
    expect(collapse).toBe(wrapper());
    expect(collapse.tagName).toBe('DIV');
    expect(collapse).toHaveClass(
      navCategoryClassNames.collapse,
      ...motionClasses(collapseStructure),
      ...motionClasses(collapseMotion),
    );
    expect(collapse.classList[0]).toBe(navCategoryClassNames.collapse);
    expect(collapse).toHaveAttribute('data-presence', 'entered');
    expect(collapse).not.toHaveAttribute('inert');
    expect(collapse.getAttributeNames().sort()).toEqual(['class', 'data-presence']);
    expect(Array.from(collapse.children)).toEqual([ul]);
    // The category's <li> holds its toggle button and the wrapper, in that order.
    expect(li.tagName).toBe('LI');
    expect(Array.from(li.children)).toEqual([toggle(), collapse]);

    // The list keeps its 0.14 element; the toggle still points at it.
    expect(ul.tagName).toBe('UL');
    expect(ul.classList[0]).toBe(navCategoryClassNames.list);
    expect(ul).toHaveClass('m-0', 'list-none', 'p-0');
    expect(ul.getAttributeNames().sort()).toEqual(['class', 'id']);
    expect(toggle()).toHaveAttribute('aria-controls', ul.id);
    expect(within(ul).getByRole('button', { name: 'Introduction' })).toBeInTheDocument();
    expect(Array.from(ul.children).every((child) => child.tagName === 'LI')).toBe(true);
  });

  it('a closed category renders no wrapper and no list', () => {
    render(<Docs defaultOpenCategories={[]} />);
    expect(queryWrapper()).toBeNull();
    expect(queryList()).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(Array.from(categoryItem().children)).toEqual([toggle()]);
  });

  it('passes axe with the category open: the wrapper keeps the list semantics', async () => {
    render(<Docs defaultOpenCategories={['docs']} defaultValue="api" />);
    await expectNoA11yViolations();
  });

  it('never renders its motion props on the DOM', () => {
    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ motion: 'my-motion', expandIcon: <span>+</span>, expandIconMotion: null }}
      />,
    );
    const li = categoryItem();
    for (const el of [li, toggle(), wrapper(), list()]) {
      for (const name of ['motion', 'expandicon', 'expandiconmotion']) {
        expect(el.hasAttribute(name), name).toBe(false);
      }
    }
    expect(li).not.toHaveClass('my-motion');
    expect(list()).not.toHaveClass('my-motion');
  });
});

describe('presence (D7, the presence pair on the wrapper)', () => {
  it('a close keeps the list, inert, the toggle already collapsed without aria-controls, until the exit ends', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Docs defaultOpenCategories={['docs']} />);
    const ul = list();
    const collapse = wrapper();
    const intro = button('Introduction');

    await user.click(toggle());
    expect(list()).toBe(ul);
    expect(button('Introduction')).toBe(intro);
    expect(collapse).toHaveAttribute('data-presence', 'exiting');
    expect(ul.closest('[inert]')).toBe(collapse);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).not.toHaveAttribute('aria-controls');
    expect(findDanglingIdRefs()).toEqual([]);

    await finish(motion);
    expect(queryList()).toBeNull();
    expect(collapse).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Introduction' })).toBeNull();
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('an opening enters from the wrapper’s motion (never on mount, D9)', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    const { unmount } = render(<Docs defaultOpenCategories={['docs']} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
    expect(motion.started).toBe(0);
    unmount();

    render(<Docs defaultOpenCategories={[]} />);
    await user.click(toggle());
    expect(wrapper()).toHaveAttribute('data-presence', 'entering');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAttribute('aria-controls', list().id);
    await finish(motion);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
  });

  it('closed and opened again before the exit ends: the same list and items, entering, not inert', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<Docs defaultOpenCategories={['docs']} />);
    const ul = list();
    const collapse = wrapper();
    const intro = button('Introduction');

    await user.click(toggle());
    expect(collapse).toHaveAttribute('data-presence', 'exiting');
    await user.click(toggle());

    expect(wrapper()).toBe(collapse);
    expect(list()).toBe(ul);
    expect(button('Introduction')).toBe(intro);
    expect(collapse).toHaveAttribute('data-presence', 'entering');
    expect(ul.closest('[inert]')).toBeNull();
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(toggle()).toHaveAttribute('aria-controls', ul.id);

    await finish(motion);
    expect(list()).toBe(ul);
    expect(collapse).toHaveAttribute('data-presence', 'entered');
  });

  it('under reduced motion a close removes the list within the same act', async () => {
    mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
    const user = userEvent.setup();
    render(<Docs defaultOpenCategories={['docs']} />);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
    await user.click(toggle());
    expect(queryList()).toBeNull();
    expect(queryWrapper()).toBeNull();
  });

  it('without reduced motion the same close waits for the wrapper’s motion', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    mockMatchMedia({ '(prefers-reduced-motion: reduce)': false });
    const user = userEvent.setup();
    render(<Docs defaultOpenCategories={['docs']} />);
    await user.click(toggle());
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(queryList()).toBeNull();
  });

  it('StrictMode: a toggle calls onOpenCategoriesChange once, and the list exits once', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    render(
      <React.StrictMode>
        <Docs defaultOpenCategories={['docs']} onOpenCategoriesChange={onOpenCategoriesChange} />
      </React.StrictMode>,
    );
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
    expect(motion.started).toBe(0);

    await user.click(toggle());
    expect(onOpenCategoriesChange).toHaveBeenCalledTimes(1);
    expect(onOpenCategoriesChange).toHaveBeenCalledWith([]);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(motion.started).toBe(1);
    await finish(motion);
    expect(queryList()).toBeNull();
  });

  it('the category has no click handler of its own: a pointer click on it while the list exits toggles nothing', async () => {
    // An exiting list is `inert`, which hit-tests as click-through, so a click on the list's place
    // lands on the category's <li>; only the toggle button opens or closes the category.
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    const onOpenCategoriesChange = vi.fn();
    render(
      <Docs defaultOpenCategories={['docs']} onOpenCategoriesChange={onOpenCategoriesChange} />,
    );
    await user.click(toggle());
    expect(onOpenCategoriesChange).toHaveBeenCalledTimes(1);
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');

    fireEvent.click(categoryItem(), { detail: 1 });
    fireEvent.click(wrapper(), { detail: 1 });
    expect(onOpenCategoriesChange).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    await finish(motion);
    expect(queryList()).toBeNull();
  });
});

/** A controlled Nav whose Introduction sub-item has an action that closes Docs. */
function ClosingDocs({ motion }: { motion?: MotionSlot | null }) {
  const [open, setOpen] = React.useState<string[]>(['docs']);
  return (
    <Nav openCategories={open} onOpenCategoriesChange={setOpen}>
      <Nav.Item value="home">Home</Nav.Item>
      <Nav.Category value="docs" label="Docs" motion={motion}>
        <Nav.SubItem
          value="intro"
          actions={
            <button type="button" onClick={() => setOpen([])}>
              Close Docs
            </button>
          }
        >
          Introduction
        </Nav.SubItem>
        <Nav.SubItem value="api">API</Nav.SubItem>
      </Nav.Category>
    </Nav>
  );
}

describe('focus inside a closing list (§2.5, §5.3)', () => {
  it('a sub-item’s action that closes the category puts focus on the category button in the closing act', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    const user = userEvent.setup();
    render(<ClosingDocs />);

    await user.click(button('Close Docs'));
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Close Docs').closest('[inert]')).toBe(wrapper());
    expect(toggle()).toHaveFocus();

    await finish(motion);
    expect(queryList()).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('a toggle click that moves no focus, with focus on a sub-item, focuses the category button', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    honourInert();
    render(<Docs defaultOpenCategories={['docs']} />);
    act(() => button('Introduction').focus());
    expect(button('Introduction')).toHaveFocus();

    // A click that moves no focus itself (assistive technology, a programmatic click).
    fireEvent.click(toggle());
    await act(async () => {});
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Introduction').closest('[inert]')).toBe(wrapper());
    expect(toggle()).toHaveFocus();

    await finish(motion);
    expect(toggle()).toHaveFocus();
  });

  it('with motion={null} focus moves to the category button before the list unmounts', async () => {
    honourInert();
    const user = userEvent.setup();
    render(<ClosingDocs motion={null} />);
    await user.click(button('Close Docs'));
    expect(queryList()).toBeNull();
    expect(toggle()).toHaveFocus();
  });

  it('focus outside the list stays where it is', async () => {
    mockAnimations({ animated: isCollapse });
    honourInert();
    function Outside() {
      const [open, setOpen] = React.useState<string[]>(['docs']);
      return (
        <>
          <button type="button" onClick={() => setOpen([])}>
            Close all
          </button>
          <Docs openCategories={open} onOpenCategoriesChange={setOpen} />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Outside />);
    await user.click(button('Close all'));
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Close all')).toHaveFocus();
  });
});

describe('NavDrawer.Body focusMode="arrow" while a list exits', () => {
  function ArrowDrawer({ defaultValue }: { defaultValue?: string }) {
    return (
      <NavDrawer type="inline" defaultOpen defaultValue={defaultValue}>
        <NavDrawer.Body focusMode="arrow">
          <Nav.Item value="home">Home</Nav.Item>
          <Nav.Item value="reports">Reports</Nav.Item>
          <Nav.Category value="settings" label="Settings">
            <Nav.SubItem value="profile">Profile</Nav.SubItem>
            <Nav.SubItem value="account">Account</Nav.SubItem>
          </Nav.Category>
        </NavDrawer.Body>
      </NavDrawer>
    );
  }

  it('the exiting list’s items leave the arrow order at once', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<ArrowDrawer />);
    act(() => button('Settings').focus());
    await user.keyboard('{Enter}');
    expect(button('Settings')).toHaveAttribute('aria-expanded', 'true');
    await finish(motion);
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
    await user.keyboard('{ArrowDown}');
    expect(button('Profile')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(button('Settings')).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(button('Settings')).toHaveAttribute('aria-expanded', 'false');
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Profile').closest('[inert]')).toBe(wrapper());

    // Down wraps to Home, past the exiting Profile and Account; End and Up skip them too.
    await user.keyboard('{ArrowDown}');
    expect(button('Home')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(button('Settings')).toHaveFocus();
    await user.keyboard('{Home}{End}');
    expect(button('Settings')).toHaveFocus();
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
  });

  it('the current sub-item in an exiting list gives the tab stop to its category', async () => {
    const motion = mockAnimations({ animated: isCollapse });
    const user = userEvent.setup();
    render(<ArrowDrawer defaultValue="profile" />);
    expect(button('Profile')).toHaveAttribute('tabindex', '0');
    expect(button('Settings')).toHaveAttribute('tabindex', '-1');

    fireEvent.click(button('Settings'));
    // The roving store reads the DOM through a MutationObserver: let it see the inert wrapper.
    await act(async () => {});
    expect(wrapper()).toHaveAttribute('data-presence', 'exiting');
    expect(button('Settings')).toHaveAttribute('aria-current', 'true');
    expect(button('Settings')).toHaveAttribute('tabindex', '0');
    // The exiting items are no longer the store's: it leaves them as they were (an element it
    // cannot see, as a `hidden` one), and `inert` keeps them out of the Tab order in a browser.
    expect(button('Profile').closest('[inert]')).toBe(wrapper());
    act(() => button('Settings').focus());
    await user.keyboard('{ArrowDown}');
    expect(button('Home')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(button('Settings')).toHaveFocus();

    await finish(motion);
    expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull();
    expect(button('Settings')).toHaveAttribute('tabindex', '0');
  });
});

describe('the category motion slot (`motion`, Fluent’s NavSubItemGroup collapseMotion)', () => {
  it('undefined is the default collapse', () => {
    render(<Docs defaultOpenCategories={['docs']} />);
    expect(wrapper()).toHaveClass(...motionClasses(collapseMotion));
  });

  it('null is no motion: the structure and data-presence stay', () => {
    render(<Docs defaultOpenCategories={['docs']} category={{ motion: null }} />);
    expectNoWordOf(wrapper(), collapseMotion);
    expect(wrapper()).toHaveClass(...motionClasses(collapseStructure));
    expect(wrapper()).toHaveAttribute('data-presence', 'entered');
  });

  it.each([
    ['a string', 'my-motion'],
    ['an object', { className: 'my-motion' }],
  ] as Array<[string, MotionSlot]>)('%s replaces the default collapse', (_kind, slot) => {
    render(<Docs defaultOpenCategories={['docs']} category={{ motion: slot }} />);
    expect(wrapper()).toHaveClass('my-motion', ...motionClasses(collapseStructure));
    expectNoWordOf(wrapper(), collapseMotion);
    expect(categoryItem()).not.toHaveClass('my-motion');
    expect(list()).not.toHaveClass('my-motion');
  });

  it('the provider’s "none" turns the default off; the category’s own motion still applies', () => {
    renderWithProviders(
      <Nav defaultOpenCategories={['docs', 'api-docs']}>
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="intro">Introduction</Nav.SubItem>
        </Nav.Category>
        <Nav.Category value="api-docs" label="API docs" motion="my-motion">
          <Nav.SubItem value="api">API</Nav.SubItem>
        </Nav.Category>
      </Nav>,
      { motion: 'none' },
    );
    const [docs, apiDocs] = Array.from(
      document.querySelectorAll<HTMLElement>('.' + navCategoryClassNames.collapse),
    );
    expectNoWordOf(docs, collapseMotion);
    expect(docs).toHaveClass(...motionClasses(collapseStructure));
    expect(apiDocs).toHaveClass('my-motion');
    expectNoWordOf(apiDocs, collapseMotion);
  });
});

/** The expand icons that render nothing (a factory each). */
const HIDDEN_ICONS = [
  ['false', () => false],
  ["''", () => ''],
  ['an empty array', () => []],
  ['an empty Fragment', () => <></>],
] as Array<[string, () => Slot<'span'>]>;

describe('the expandIcon slot (C-SLOTS, optional indicator)', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
  ] as Array<[string, Slot<'span'> | undefined]>)(
    '%s keeps the default chevron, turned while open',
    (_kind, icon) => {
      const { unmount } = render(
        <Docs defaultOpenCategories={[]} category={{ expandIcon: icon }} />,
      );
      const closed = expandIcon()!;
      expect(closed.tagName.toLowerCase()).toBe('svg');
      expect(closed).toHaveClass('shrink-0');
      expect(closed).not.toHaveClass('rotate-180');
      expect(toggle().lastElementChild).toBe(closed);
      unmount();

      render(<Docs defaultOpenCategories={['docs']} category={{ expandIcon: icon }} />);
      const open = expandIcon()!;
      expect(open.tagName.toLowerCase()).toBe('svg');
      expect(open).toHaveClass(navCategoryClassNames.expandIcon, 'shrink-0', 'rotate-180');
      expect(open.classList[0]).toBe(navCategoryClassNames.expandIcon);
    },
  );

  it.each(HIDDEN_ICONS)(
    '%s hides the chevron (aria-expanded still reports the state)',
    (_k, make) => {
      render(<Docs defaultOpenCategories={['docs']} category={{ expandIcon: make() }} />);
      expect(expandIcon()).toBeNull();
      expect(toggle().querySelector('svg')).toBeNull();
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(toggle()).toHaveAccessibleName('Docs');
      expect(toggle().textContent).toBe('Docs');
    },
  );

  it('a custom glyph renders in an aria-hidden span with the expand icon class, never turned', () => {
    const { unmount } = render(
      <Docs defaultOpenCategories={[]} category={{ expandIcon: <svg data-testid="plus" /> }} />,
    );
    const closed = expandIcon()!;
    expect(closed.tagName).toBe('SPAN');
    expect(closed).toHaveClass(navCategoryClassNames.expandIcon, 'inline-flex', 'shrink-0');
    expect(closed.classList[0]).toBe(navCategoryClassNames.expandIcon);
    expect(closed).toHaveAttribute('aria-hidden', 'true');
    expect(within(closed as HTMLElement).getByTestId('plus')).toBeInTheDocument();
    expect(closed).not.toHaveClass('rotate-180');
    expect(toggle()).toHaveAccessibleName('Docs');
    unmount();

    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ expandIcon: <svg data-testid="minus" /> }}
      />,
    );
    const open = expandIcon()!;
    expect(open.tagName).toBe('SPAN');
    expect(open).not.toHaveClass('rotate-180');
    expect(screen.getByTestId('minus').getAttribute('class')).toBeNull();
    expect(toggle().lastElementChild).toBe(open);
  });

  it('a slot object keeps its own className and children on the span', () => {
    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ expandIcon: { className: 'my-glyph', children: '−' } }}
      />,
    );
    const icon = expandIcon()!;
    expect(icon.tagName).toBe('SPAN');
    expect(icon).toHaveClass(navCategoryClassNames.expandIcon, 'my-glyph');
    expect(icon).toHaveTextContent('−');
    expect(icon).not.toHaveClass('rotate-180');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  /** The one-time warning of a button passed as the glyph (C-SLOTS, `unwrapButtonGlyph`). */
  const buttonGlyphWarning = (received: string) =>
    `[WaveUI] Nav.Category: \`expandIcon\` received ${received}; its children render as the glyph of the toggle button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. \`expandIcon={<MyIcon />}\`.`;

  it.each([
    [
      'a <button> element',
      () => (
        <button type="button" className="own-button" aria-label="Expand">
          <svg data-testid="glyph" />
        </button>
      ),
      'a button element',
    ],
    [
      'a Wave Button element',
      () => (
        <Button appearance="subtle" className="own-button" aria-label="Expand">
          <svg data-testid="glyph" />
        </Button>
      ),
      'a button element',
    ],
    [
      'a slot object whose `as` is a button',
      () =>
        ({
          as: 'button',
          className: 'own-button',
          children: <svg data-testid="glyph" />,
        }) as unknown as Slot<'span'>,
      'a slot object that renders a button',
    ],
  ] as Array<[string, () => Slot<'span'>, string]>)(
    'unwraps %s: its children are the glyph in the span, never a nested button, with one warning',
    (_kind, make, received) => {
      warn.mockImplementation(() => {});
      render(
        <React.StrictMode>
          <Docs defaultOpenCategories={['docs']} category={{ expandIcon: make() }} />
        </React.StrictMode>,
      );
      expect(toggle().querySelector('button')).toBeNull();
      const icon = expandIcon()!;
      expect(icon.tagName).toBe('SPAN');
      expect(icon.classList[0]).toBe(navCategoryClassNames.expandIcon);
      expect(icon).toHaveClass('inline-flex', 'shrink-0');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).not.toHaveClass('rotate-180');
      expect(within(icon as HTMLElement).getByTestId('glyph').parentElement).toBe(icon);
      // The button's props are dropped: neither its class nor its name reaches the toggle.
      expect(document.querySelector('.own-button')).toBeNull();
      expect(toggle()).toHaveAccessibleName('Docs');
      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(warn.mock.calls).toEqual([[buttonGlyphWarning(received)]]);
      warn.mockClear();
    },
  );

  it('a button without children keeps the default chevron (the glyph is its nothing), with the warning', () => {
    warn.mockImplementation(() => {});
    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ expandIcon: <button type="button" aria-label="Expand" /> }}
      />,
    );
    expect(toggle().querySelector('button')).toBeNull();
    expect(expandIcon()!.tagName.toLowerCase()).toBe('svg');
    expect(expandIcon()).toHaveClass('rotate-180');
    expect(toggle()).toHaveAccessibleName('Docs');
    expect(warn.mock.calls).toEqual([[buttonGlyphWarning('a button element')]]);
    warn.mockClear();
  });

  it('a glyph that is not a button never warns', () => {
    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ expandIcon: <svg data-testid="plus" /> }}
      />,
    );
    expect(screen.getByTestId('plus')).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the expandIconMotion slot (Fluent’s NavCategoryItem expandIconMotion)', () => {
  it('undefined times the chevron’s turn with the default motion', () => {
    render(<Docs defaultOpenCategories={['docs']} />);
    expect(expandIcon()).toHaveClass(...motionClasses(expandIconMotion), 'rotate-180');
  });

  it('null keeps the turn and drops its transition (the turn snaps)', () => {
    render(<Docs defaultOpenCategories={['docs']} category={{ expandIconMotion: null }} />);
    expectNoWordOf(expandIcon(), expandIconMotion);
    expect(expandIcon()).toHaveClass('rotate-180', 'shrink-0');
  });

  it.each([
    ['a string', 'my-motion'],
    ['an object', { className: 'my-motion' }],
  ] as Array<[string, MotionSlot]>)('%s replaces the default motion', (_kind, slot) => {
    render(<Docs defaultOpenCategories={['docs']} category={{ expandIconMotion: slot }} />);
    expect(expandIcon()).toHaveClass('my-motion', 'rotate-180');
    expectNoWordOf(expandIcon(), expandIconMotion);
    expect(toggle()).not.toHaveClass('my-motion');
  });

  it('the provider’s "none" turns it off; the category’s own value still applies', () => {
    const { unmount } = renderWithProviders(<Docs defaultOpenCategories={['docs']} />, {
      motion: 'none',
    });
    expectNoWordOf(expandIcon(), expandIconMotion);
    expect(expandIcon()).toHaveClass('rotate-180');
    unmount();

    renderWithProviders(
      <Docs defaultOpenCategories={['docs']} category={{ expandIconMotion: 'my-motion' }} />,
      { motion: 'none' },
    );
    expect(expandIcon()).toHaveClass('my-motion');
  });

  it('applies to the span of a custom glyph too', () => {
    const { unmount } = render(
      <Docs defaultOpenCategories={['docs']} category={{ expandIcon: <svg /> }} />,
    );
    expect(expandIcon()).toHaveClass(...motionClasses(expandIconMotion));
    unmount();

    render(
      <Docs
        defaultOpenCategories={['docs']}
        category={{ expandIcon: <svg />, expandIconMotion: 'my-motion' }}
      />,
    );
    expect(expandIcon()).toHaveClass('my-motion');
    expectNoWordOf(expandIcon(), expandIconMotion);
  });

  it('RTL: the chevron’s classes are the same in both directions, open and closed', () => {
    const classesOf = (dir: 'ltr' | 'rtl', open: boolean) => {
      const { unmount } = renderWithProviders(
        <Docs defaultOpenCategories={open ? ['docs'] : []} />,
        { dir },
      );
      const className = expandIcon()!.getAttribute('class');
      unmount();
      return className;
    };
    expect(classesOf('rtl', false)).toBe(classesOf('ltr', false));
    expect(classesOf('rtl', true)).toBe(classesOf('ltr', true));
    expect(classesOf('rtl', true)).not.toMatch(/wave-rtl:/);
  });
});

describe('item actions reveal (§3, D6)', () => {
  function WithActions() {
    return (
      <Nav defaultOpenCategories={['docs']}>
        <Nav.Item value="reports" actions={<button type="button">Pin Reports</button>}>
          Reports
        </Nav.Item>
        <Nav.Category value="docs" label="Docs">
          <Nav.SubItem value="intro" actions={<button type="button">Pin Introduction</button>}>
            Introduction
          </Nav.SubItem>
        </Nav.Category>
      </Nav>
    );
  }
  const actionsOf = (name: string) => screen.getByRole('group', { name });

  it('the actions of an item and a sub-item fade in with the default reveal, still in the tab order', async () => {
    const user = userEvent.setup();
    render(<WithActions />);
    for (const name of ['Reports', 'Introduction']) {
      expect(actionsOf(name)).toHaveClass(
        ...motionClasses(navActionsRevealMotion),
        '*:opacity-0',
        'group-hover/nav-row:*:opacity-100',
        'group-focus-within/nav-row:*:opacity-100',
      );
    }
    expect(actionsOf('Reports').classList[0]).toBe(navItemClassNames.actions);

    act(() => button('Reports').focus());
    await user.tab();
    expect(button('Pin Reports')).toHaveFocus();
  });

  it('the provider’s "none" turns the reveal’s motion off; the reveal itself stays', () => {
    renderWithProviders(<WithActions />, { motion: 'none' });
    for (const name of ['Reports', 'Introduction']) {
      expectNoWordOf(actionsOf(name), navActionsRevealMotion);
      expect(actionsOf(name)).toHaveClass(
        '*:opacity-0',
        'group-focus-within/nav-row:*:opacity-100',
      );
    }
  });

  it('the category’s motion props do not reach the actions', () => {
    render(
      <Nav defaultOpenCategories={['docs']}>
        <Nav.Category value="docs" label="Docs" motion={null} expandIconMotion={null}>
          <Nav.SubItem value="intro" actions={<button type="button">Pin</button>}>
            Introduction
          </Nav.SubItem>
        </Nav.Category>
      </Nav>,
    );
    expect(actionsOf('Introduction')).toHaveClass(...motionClasses(navActionsRevealMotion));
  });
});

describe('server rendering (D9)', () => {
  it('an open category’s wrapper is entered in the server HTML and hydrates without warnings', () => {
    const ui = <Docs defaultOpenCategories={['docs']} />;
    const html = renderToString(ui);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    try {
      const collapse = container.querySelector<HTMLElement>('.' + navCategoryClassNames.collapse)!;
      expect(collapse).toHaveAttribute('data-presence', 'entered');
      expect(collapse).not.toHaveAttribute('inert');
      expect(collapse).toHaveClass(
        ...motionClasses(collapseStructure),
        ...motionClasses(collapseMotion),
      );
      const ul = container.querySelector<HTMLElement>('.' + navCategoryClassNames.list)!;
      expect(Array.from(collapse.children)).toEqual([ul]);
      expect(collapse.parentElement).toHaveClass(navCategoryClassNames.root);
      const chevron = container.querySelector('.' + navCategoryClassNames.expandIcon)!;
      expect(chevron).toHaveClass(...motionClasses(expandIconMotion), 'rotate-180');

      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      act(() => {
        root = hydrateRoot(container, ui, { onRecoverableError });
      });
      expect(container.querySelector('.' + navCategoryClassNames.collapse)).toBe(collapse);
      expect(collapse).toHaveAttribute('data-presence', 'entered');
      expect(onRecoverableError).not.toHaveBeenCalled();
      act(() => root?.unmount());
    } finally {
      container.remove();
    }
  });
});
