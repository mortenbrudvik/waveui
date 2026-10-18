import { afterEach, describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerHeaderTitle,
  type DrawerPosition,
  type DrawerProps,
  type DrawerSize,
} from '../Drawer';
import { Button } from '../../button/Button';
import {
  buttonClassNames,
  drawerBodyClassNames,
  drawerClassNames,
  drawerHeaderClassNames,
  drawerHeaderNavigationClassNames,
  drawerHeaderTitleClassNames,
} from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import { focusRingInset } from '../../../lib/styles';
import {
  asClientReference,
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
});

/** The sizes with their width (side positions) and height (`bottom`) classes. */
const SIZES = [
  ['small', 'w-80', 'h-80'],
  ['medium', 'w-148', 'h-148'],
  ['large', 'w-235', 'h-235'],
  ['full', 'w-full', 'h-full'],
] as const satisfies ReadonlyArray<readonly [DrawerSize, string, string]>;

const SIDES = ['start', 'end', 'left', 'right'] as const satisfies readonly DrawerPosition[];

const WIDTHS = SIZES.map(([, width]) => width);
const HEIGHTS = SIZES.map(([, , height]) => height);
const EDGES = ['border-s', 'border-e', 'border-l', 'border-r', 'border-t', 'border-b'];
const INSET_TOP = 'pt-[env(safe-area-inset-top)]';
const INSET_BOTTOM = 'pb-[env(safe-area-inset-bottom)]';

/** Opens a Drawer named "Filters" and returns its panel. */
function renderPanel(props: Partial<DrawerProps> = {}, options: { dir?: 'rtl' } = {}) {
  const ui = (
    <Drawer defaultOpen title="Filters" {...props}>
      Content
    </Drawer>
  );
  if (options.dir) renderWithProviders(ui, { dir: options.dir });
  else render(ui);
  return screen.getByRole('dialog', { name: 'Filters' });
}

/** Asserts each class on its own (a multi-class `not.toHaveClass` passes when one is missing). */
function expectNoneOf(element: HTMLElement, classes: readonly string[]) {
  for (const name of classes) expect(element).not.toHaveClass(name);
}

describe('Drawer size and position (P6-05 D78, D79)', () => {
  it.each(SIDES.flatMap((side) => SIZES.map(([size, width]) => [side, size, width] as const)))(
    'a %s panel of size %s is %s wide and spans the window height',
    (position, size, width) => {
      const panel = renderPanel({ position, size });
      expect(panel).toHaveClass(drawerClassNames.root, width, 'top-0', 'h-full', 'max-w-full');
      expect(panel).toHaveAttribute('data-size', size);
      expectNoneOf(
        panel,
        WIDTHS.filter((other) => other !== width),
      );
      expectNoneOf(panel, ['inset-x-0', 'bottom-0', 'max-h-full', 'h-80', 'h-148', 'h-235']);
    },
  );

  it('defaults to the small size', () => {
    const panel = renderPanel();
    expect(panel).toHaveClass('w-80');
    expect(panel).toHaveAttribute('data-size', 'small');
  });

  it.each(SIZES.map(([size, , height]) => [size, height] as const))(
    'a bottom panel of size %s runs along the bottom edge, the window wide and %s high',
    (size, height) => {
      const panel = renderPanel({ position: 'bottom', size });
      expect(panel).toHaveClass(
        height,
        'w-full',
        'inset-x-0',
        'bottom-0',
        'max-h-full',
        'border-t',
      );
      expect(panel).toHaveAttribute('data-position', 'bottom');
      expect(panel).toHaveAttribute('data-size', size);
      expectNoneOf(panel, ['top-0', 'max-w-full', 'end-0', 'start-0', 'w-80', 'w-148', 'w-235']);
      expectNoneOf(
        panel,
        HEIGHTS.filter((other) => other !== height),
      );
    },
  );

  it.each([
    [undefined, 'end'],
    ['end', 'end'],
    ['start', 'start'],
    ['left', 'left'],
    ['right', 'right'],
    ['bottom', 'bottom'],
  ] as const)('position %s renders data-position="%s"', (position, expected) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveAttribute('data-position', expected);
  });

  it('lets a width class in className replace the size', () => {
    const panel = renderPanel({ size: 'medium', className: 'w-[480px]' });
    expect(panel).toHaveClass('w-[480px]', 'max-w-full');
    expect(panel).not.toHaveClass('w-148');
    expect(panel).toHaveAttribute('data-size', 'medium');
  });

  it('lets a height class in className replace the size of a bottom panel', () => {
    const panel = renderPanel({ position: 'bottom', size: 'large', className: 'h-[50vh]' });
    expect(panel).toHaveClass('h-[50vh]', 'max-h-full', 'w-full');
    expect(panel).not.toHaveClass('h-235');
  });

  it('keeps the logical classes of a side panel and the classes of a bottom one under RTL', () => {
    const start = renderPanel({ position: 'start', size: 'medium' }, { dir: 'rtl' });
    expect(start.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
    expect(start).toHaveClass('start-0', 'border-e', 'w-148');
    expectNoneOf(start, ['left-0', 'right-0', 'border-l', 'border-r']);
    cleanup();

    const bottom = renderPanel({ position: 'bottom' }, { dir: 'rtl' });
    expect(bottom).toHaveClass('inset-x-0', 'bottom-0', 'w-full', 'h-80', 'border-t');
    expectNoneOf(bottom, ['left-0', 'right-0', 'start-0', 'end-0', 'border-s', 'border-e']);
  });
});

describe('Drawer forced colours, class level (P6-05 D79)', () => {
  it.each([
    ['start', 'border-e'],
    ['end', 'border-s'],
    ['left', 'border-r'],
    ['right', 'border-l'],
    ['bottom', 'border-t'],
  ] as const)('a %s panel draws its inner edge only, %s', (position, edge) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveClass(edge, 'border-border');
    expectNoneOf(
      panel,
      EDGES.filter((other) => other !== edge),
    );
    expect(panel).not.toHaveClass('border');
  });
});

describe('Drawer safe-area insets (P6-05 D85)', () => {
  it.each(SIDES)('a %s panel pads the top and bottom insets of the screen', (position) => {
    const panel = renderPanel({ position });
    expect(panel).toHaveClass(INSET_TOP, INSET_BOTTOM);
  });

  it.each(['small', 'medium', 'large'] as const)(
    'a bottom panel of size %s pads only the bottom inset (it does not reach the top)',
    (size) => {
      const panel = renderPanel({ position: 'bottom', size });
      expect(panel).toHaveClass(INSET_BOTTOM);
      expect(panel).not.toHaveClass(INSET_TOP);
    },
  );

  it('a full bottom panel pads both insets', () => {
    const panel = renderPanel({ position: 'bottom', size: 'full' });
    expect(panel).toHaveClass(INSET_TOP, INSET_BOTTOM);
  });

  it('pads no side insets', () => {
    const panel = renderPanel({ size: 'full' });
    expect(panel.className).not.toMatch(/safe-area-inset-(left|right)/);
  });
});

describe('Drawer size and position: accessibility', () => {
  it.each([
    ['a bottom drawer', { position: 'bottom' }],
    ['a large drawer', { size: 'large' }],
    ['a full bottom drawer', { position: 'bottom', size: 'full' }],
  ] as const)('%s has no violations', async (_name, props) => {
    renderPanel(props);
    await expectNoA11yViolations(document.body);
  });
});

// ---------------------------------------------------------------------------
// Parts (P6-05 D71–D77, D83)
// ---------------------------------------------------------------------------

/** The `[WaveUI]` warnings of the parts and the root's checks (spec P6-05, Development warnings). */
const WARNINGS = {
  headerUnscanned:
    '[WaveUI] Drawer.Header is not a direct child of Drawer, so it renders inside the body instead of replacing the header. Make it a direct child (a Fragment there is fine).',
  bodyUnscanned:
    '[WaveUI] Drawer.Body is not a direct child of Drawer, so its props do not reach the scrolling body and it renders as an element inside it. Make it a direct child (a Fragment there is fine).',
  footerUnscanned:
    '[WaveUI] Drawer.Footer is not a direct child of Drawer, so it renders inside the scrolling body instead of below it. Make it a direct child (a Fragment there is fine); a submit button in it can name a form in the body with the `form` attribute.',
  bodyDuplicate:
    '[WaveUI] Drawer has more than one Drawer.Body: the props of the first one apply to the scrolling body, and the children of every one render in their place. Render one Drawer.Body.',
  outsideHeader:
    '[WaveUI] Drawer.HeaderTitle is not inside a Drawer.Header, so it renders in the body without the Close button. Put it in a Drawer.Header, or use Drawer.Title for a heading in the body.',
  titleIgnored:
    '[WaveUI] Drawer: `title` and `titleAction` are ignored because a Drawer.Header is among the children. Put a Drawer.HeaderTitle (with its `action`) in the header instead.',
} as const;

/** Spies on `console.warn` (silenced: every test asserts each call); restored after the test. */
function spyOnWarn() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** The panel's scrolling body (`drawerClassNames.body`). */
function bodyOf(panel: HTMLElement): HTMLElement {
  const body = panel.querySelector<HTMLElement>(`.${drawerClassNames.body}`);
  if (!body) throw new Error('the drawer has no scrolling body');
  return body;
}

/** Whether `a` comes before `b` in DOM order. */
function precedes(a: Node, b: Node): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** A glyph for the icon-only buttons of the tests (tokens only). */
function Glyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" />
    </svg>
  );
}

/** A composed drawer: a header with navigation and a title row, a body and a footer. */
function Composed(props: Partial<DrawerProps> & { action?: React.ReactNode }) {
  const { action, children, ...rest } = props;
  return (
    <Drawer defaultOpen {...rest}>
      <Drawer.Header>
        <Drawer.HeaderNavigation aria-label="Drawer navigation">
          <Button appearance="subtle">Back</Button>
        </Drawer.HeaderNavigation>
        <Drawer.HeaderTitle action={action}>Settings</Drawer.HeaderTitle>
      </Drawer.Header>
      {children ?? <p>Body text</p>}
      <Drawer.Footer>
        <Drawer.Close>
          <Button appearance="primary">Apply</Button>
        </Drawer.Close>
        <Button>Reset</Button>
      </Drawer.Footer>
    </Drawer>
  );
}

describe('Drawer parts: routing (P6-05 D71, D72)', () => {
  it('a Drawer.Header replaces the built-in header; the Close button ends its title row', () => {
    render(<Composed />);
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    expect(panel.querySelector(`.${drawerClassNames.header}`)).toBeNull();
    const header = panel.querySelector<HTMLElement>(`.${drawerHeaderClassNames.root}`);
    expect(header?.parentElement).toBe(panel);
    const closes = within(panel).getAllByRole('button', { name: 'Close' });
    expect(closes).toHaveLength(1);
    const row = panel.querySelector(`.${drawerHeaderTitleClassNames.root}`);
    expect(closes[0].parentElement).toBe(row);
  });

  it('renders a Footer written before the content after the scrolling body, outside it', () => {
    render(
      <Drawer defaultOpen title="Filters">
        <Drawer.Footer data-testid="footer">
          <Button>Apply</Button>
        </Drawer.Footer>
        <p>Fields</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    const header = panel.querySelector(`.${drawerClassNames.header}`) as HTMLElement;
    const body = bodyOf(panel);
    const footer = screen.getByTestId('footer');
    expect(Array.from(panel.children)).toEqual([header, body, footer]);
    expect(precedes(header, body)).toBe(true);
    expect(precedes(body, footer)).toBe(true);
    expect(body).not.toContainElement(footer);
    expect(body).toContainElement(screen.getByText('Fields'));
  });

  it('places parts written in a Fragment and in a conditional Fragment', () => {
    function Conditional({ show }: { show: boolean }) {
      return (
        <Drawer defaultOpen>
          <>
            <Drawer.Header>
              <Drawer.HeaderTitle>Filters</Drawer.HeaderTitle>
            </Drawer.Header>
            <p>Fields</p>
          </>
          {show && (
            <>
              <Drawer.Footer data-testid="footer">
                <Button>Apply</Button>
              </Drawer.Footer>
            </>
          )}
        </Drawer>
      );
    }
    const warn = spyOnWarn();
    const { rerender } = render(<Conditional show={false} />);
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(panel.firstElementChild).toHaveClass(drawerHeaderClassNames.root);
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    rerender(<Conditional show />);
    expect(panel.lastElementChild).toBe(screen.getByTestId('footer'));
    expect(bodyOf(panel)).toHaveTextContent('Fields');
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders several Footers after the body in the order written', () => {
    render(
      <Drawer defaultOpen title="Filters">
        <Drawer.Footer data-testid="first">
          <Button>One</Button>
        </Drawer.Footer>
        <p>Fields</p>
        <Drawer.Footer data-testid="second">
          <Button>Two</Button>
        </Drawer.Footer>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    const first = screen.getByTestId('first');
    const second = screen.getByTestId('second');
    expect(Array.from(panel.children).slice(-2)).toEqual([first, second]);
  });

  it('keeps the body content’s state when a Footer appears before it', async () => {
    const user = userEvent.setup();
    function WithOptionalFooter({ footer }: { footer: boolean }) {
      return (
        <Drawer defaultOpen title="Filters">
          {footer && (
            <Drawer.Footer>
              <Button>Apply</Button>
            </Drawer.Footer>
          )}
          <input aria-label="Name" />
        </Drawer>
      );
    }
    const { rerender } = render(<WithOptionalFooter footer={false} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Ada');
    rerender(<WithOptionalFooter footer />);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Ada');
  });

  it('places parts written in a Server Component (lazy references) like the plain parts', () => {
    const lazy = {
      Header: asClientReference(DrawerHeader),
      HeaderTitle: asClientReference(DrawerHeaderTitle),
      Body: asClientReference(DrawerBody),
      Footer: asClientReference(DrawerFooter),
    };
    const plain = {
      Header: DrawerHeader,
      HeaderTitle: DrawerHeaderTitle,
      Body: DrawerBody,
      Footer: DrawerFooter,
    };
    function Filters({ parts, open }: { parts: typeof plain; open?: boolean }) {
      return (
        <Drawer defaultOpen={open}>
          <Drawer.Trigger>
            <button type="button">Open filters</button>
          </Drawer.Trigger>
          <parts.Footer data-testid="footer">
            <Button>Apply</Button>
          </parts.Footer>
          <parts.Header>
            <parts.HeaderTitle>Filters</parts.HeaderTitle>
          </parts.Header>
          <parts.Body data-testid="body">
            <p>Fields</p>
          </parts.Body>
        </Drawer>
      );
    }
    // Closed, as on the server: only the trigger, the same HTML.
    expect(renderToString(<Filters parts={lazy} />)).toBe(
      renderToString(<Filters parts={plain} />),
    );

    const warn = spyOnWarn();
    const shape = (parts: typeof plain) => {
      const { unmount } = render(<Filters parts={parts} open />);
      const panel = screen.getByRole('dialog', { name: 'Filters' });
      const result = Array.from(panel.children).map((child) => child.className);
      expect(screen.getByTestId('body')).toBe(bodyOf(panel));
      expect(panel.lastElementChild).toBe(screen.getByTestId('footer'));
      unmount();
      return result;
    };
    expect(shape(lazy)).toEqual(shape(plain));
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Drawer parts: unscanned (P6-05 D71)', () => {
  it('renders a Footer inside a form in the body and warns once', () => {
    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen title="Filters">
        <form aria-label="Filters form">
          <Drawer.Footer data-testid="footer">
            <Button>Apply</Button>
          </Drawer.Footer>
        </form>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(bodyOf(panel)).toContainElement(screen.getByTestId('footer'));
    expect(warn.mock.calls).toEqual([[WARNINGS.footerUnscanned]]);
  });

  it('warns for a Header and a Body that a component of yours renders', () => {
    function MyHeader() {
      return (
        <Drawer.Header data-testid="header">
          <Drawer.HeaderTitle>Filters</Drawer.HeaderTitle>
        </Drawer.Header>
      );
    }
    function MyBody() {
      return (
        <Drawer.Body data-testid="inner-body">
          <p>Fields</p>
        </Drawer.Body>
      );
    }
    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen>
        <MyHeader />
        <MyBody />
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    const body = bodyOf(panel);
    expect(body).toContainElement(screen.getByTestId('header'));
    expect(body).toContainElement(screen.getByTestId('inner-body'));
    // The scan saw no Header: the built-in header row stays.
    expect(panel.querySelector(`.${drawerClassNames.header}`)).not.toBeNull();
    expect(warn.mock.calls).toEqual([[WARNINGS.headerUnscanned], [WARNINGS.bodyUnscanned]]);
  });

  it('does not warn for placed parts', () => {
    const warn = spyOnWarn();
    render(
      <Composed>
        <Drawer.Body>
          <p>Fields</p>
        </Drawer.Body>
      </Composed>,
    );
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once under StrictMode', () => {
    const warn = spyOnWarn();
    render(
      <React.StrictMode>
        <Drawer defaultOpen title="Filters">
          <div>
            <Drawer.Footer>
              <Button>Apply</Button>
            </Drawer.Footer>
          </div>
        </Drawer>
      </React.StrictMode>,
    );
    expect(warn.mock.calls).toEqual([[WARNINGS.footerUnscanned]]);
  });
});

describe('Drawer.Body (P6-05 D77)', () => {
  const ringClasses = focusRingInset.split(' ');

  it('puts its props on the scrolling body', () => {
    const ref = React.createRef<HTMLDivElement>();
    const onScroll = vi.fn();
    render(
      <Drawer defaultOpen title="Terms">
        <Drawer.Body
          ref={ref}
          id="terms-body"
          role="region"
          tabIndex={0}
          aria-label="Terms text"
          data-section="terms"
          className="bg-muted"
          style={{ scrollPaddingTop: 8 }}
          onScroll={onScroll}
        >
          <p>Long text</p>
        </Drawer.Body>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Terms' });
    const body = screen.getByRole('region', { name: 'Terms text' });
    expect(body).toBe(bodyOf(panel));
    expect(ref.current).toBe(body);
    expect(body).toHaveAttribute('id', 'terms-body');
    expect(body).toHaveAttribute('tabindex', '0');
    expect(body).toHaveAttribute('data-section', 'terms');
    expect(body).toHaveClass(drawerClassNames.body, drawerBodyClassNames.root, 'bg-muted');
    expect(body.className.split(' ')[0]).toBe(drawerClassNames.body);
    expect(body.style.scrollPaddingTop).toBe('8px');
    fireEvent.scroll(body);
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(body).toHaveTextContent('Long text');
  });

  it('carries the inset focus ring with and without a Drawer.Body, and on an unscanned one', () => {
    const { unmount } = render(
      <Drawer defaultOpen title="Plain">
        <p>Text</p>
      </Drawer>,
    );
    const plain = bodyOf(screen.getByRole('dialog', { name: 'Plain' }));
    expect(plain).toHaveClass(...ringClasses);
    expect(plain).not.toHaveClass(drawerBodyClassNames.root);
    unmount();

    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen title="Parts">
        <Drawer.Body>
          <div>
            <Drawer.Body data-testid="unscanned">Nested</Drawer.Body>
          </div>
        </Drawer.Body>
      </Drawer>,
    );
    expect(bodyOf(screen.getByRole('dialog', { name: 'Parts' }))).toHaveClass(...ringClasses);
    const unscanned = screen.getByTestId('unscanned');
    expect(unscanned).toHaveClass(drawerBodyClassNames.root, ...ringClasses);
    expect(unscanned).not.toHaveClass(drawerClassNames.body);
    expect(warn.mock.calls).toEqual([[WARNINGS.bodyUnscanned]]);
  });

  it('renders its children in its place among the other content', () => {
    render(
      <Drawer defaultOpen title="Filters">
        <p>Before</p>
        <Drawer.Body>
          <p>Inside</p>
        </Drawer.Body>
        <p>After</p>
      </Drawer>,
    );
    const body = bodyOf(screen.getByRole('dialog', { name: 'Filters' }));
    expect(Array.from(body.children).map((child) => child.textContent)).toEqual([
      'Before',
      'Inside',
      'After',
    ]);
  });

  it('takes the props of the first of two Bodies, renders the children of both and warns', () => {
    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen title="Filters">
        <Drawer.Body className="bg-muted" data-testid="first">
          <p>One</p>
        </Drawer.Body>
        <Drawer.Body className="bg-card" data-testid="second">
          <p>Two</p>
        </Drawer.Body>
      </Drawer>,
    );
    const body = bodyOf(screen.getByRole('dialog', { name: 'Filters' }));
    expect(body).toBe(screen.getByTestId('first'));
    expect(body).toHaveClass('bg-muted');
    expect(body).not.toHaveClass('bg-card');
    expect(screen.queryByTestId('second')).not.toBeInTheDocument();
    expect(body).toHaveTextContent('OneTwo');
    expect(warn.mock.calls).toEqual([[WARNINGS.bodyDuplicate]]);
  });

  describe('system props', () => {
    testSystemProps(Drawer.Body, {
      wrapper: createOverlayTestWrapper(Drawer, { defaultOpen: true, title: 'Settings' }),
      expectedTag: 'div',
      displayName: 'DrawerBody',
      defaultProps: { children: 'Body' },
    });
  });
});

describe('Drawer.HeaderTitle (P6-05 D75, D83)', () => {
  it('names the panel; a consumer id lands on the heading and is the aria-labelledby target', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Header>
          <Drawer.HeaderTitle id="drawer-heading">Account</Drawer.HeaderTitle>
        </Drawer.Header>
        <p>Body</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Account' });
    const heading = screen.getByRole('heading', { name: 'Account', level: 2 });
    expect(heading).toHaveAttribute('id', 'drawer-heading');
    expect(panel).toHaveAttribute('aria-labelledby', 'drawer-heading');
    expect(heading).toHaveClass(drawerHeaderTitleClassNames.heading);
  });

  it.each([1, 2, 3, 4, 5, 6] as const)('renders an h%i for headingLevel', (level) => {
    render(
      <Drawer defaultOpen>
        <Drawer.Header>
          <Drawer.HeaderTitle headingLevel={level}>Account</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    const heading = screen.getByRole('heading', { name: 'Account', level });
    expect(heading.tagName).toBe(`H${level}`);
  });

  it('renders an h2 by default', () => {
    render(
      <Drawer defaultOpen>
        <Drawer.Header>
          <Drawer.HeaderTitle>Account</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    expect(screen.getByRole('heading', { name: 'Account' }).tagName).toBe('H2');
  });

  it('renders the action between the heading and the Close button, in DOM and Tab order', async () => {
    const user = userEvent.setup();
    render(
      <Composed
        action={<Button appearance="subtle" icon={<Glyph />} aria-label="Expand" size="small" />}
      />,
    );
    const heading = screen.getByRole('heading', { name: 'Settings' });
    const expand = screen.getByRole('button', { name: 'Expand' });
    const close = screen.getByRole('button', { name: 'Close' });
    const action = expand.parentElement as HTMLElement;
    expect(action).toHaveClass(drawerHeaderTitleClassNames.action);
    expect(action.tagName).toBe('SPAN');
    expect(action).not.toHaveAttribute('aria-hidden');
    expect(Array.from((heading.parentElement as HTMLElement).children)).toEqual([
      heading,
      action,
      close,
    ]);
    // The trap focuses the first focusable element: the Back button of the navigation row.
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await user.tab();
    expect(expand).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
  });

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['an empty Fragment', <></>],
  ] as const)('renders no action element for an action that renders nothing (%s)', (_, action) => {
    render(<Composed action={action} />);
    const row = screen.getByRole('heading', { name: 'Settings' }).parentElement as HTMLElement;
    expect(row.querySelector(`.${drawerHeaderTitleClassNames.action}`)).toBeNull();
    expect(row.children).toHaveLength(2);
  });

  it('names its Close button with closeLabel; it closes with close-button and returns focus', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer closeLabel="Fermer" onOpenChange={onOpenChange}>
        <Drawer.Trigger>
          <button type="button">Open</button>
        </Drawer.Trigger>
        <Drawer.Header>
          <Drawer.HeaderTitle>Réglages</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: 'Fermer' });
    expect(close).toHaveClass(buttonClassNames.root, drawerClassNames.closeButton);
    expect(close).toHaveFocus();
    await user.click(close);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'close-button',
      event: expect.any(Event),
    });
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('renders no Close button outside a Drawer.Header and warns', () => {
    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen closeLabel="Dismiss panel">
        <Drawer.HeaderTitle>Account</Drawer.HeaderTitle>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Account' });
    const row = screen.getByRole('heading', { name: 'Account' }).parentElement as HTMLElement;
    expect(bodyOf(panel)).toContainElement(row);
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    // The built-in header keeps its own Close button.
    expect(within(panel).getAllByRole('button', { name: 'Dismiss panel' })).toHaveLength(1);
    expect(warn.mock.calls).toEqual([[WARNINGS.outsideHeader]]);
  });

  it('keeps logical classes and its DOM order under RTL', () => {
    renderWithProviders(<Composed action={<Button>Pin</Button>} />, { dir: 'rtl' });
    const heading = screen.getByRole('heading', { name: 'Settings' });
    const row = heading.parentElement as HTMLElement;
    expect(row.closest('[data-wave-portal]')).toHaveAttribute('dir', 'rtl');
    expect(row).toHaveClass(drawerHeaderTitleClassNames.root, 'flex', 'items-start', 'gap-2');
    expect(Array.from(row.children).map((child) => child.textContent)).toEqual([
      'Settings',
      'Pin',
      '',
    ]);
    for (const element of [row, ...Array.from(row.children)]) {
      expect(element.className).not.toMatch(/\b(?:m|p)[lr]-|\b(?:left|right)-|\bborder-[lr]\b/);
    }
  });
});

describe('Drawer.HeaderNavigation (P6-05 D76)', () => {
  it('is a named <nav>; className and ref land on it; its Back button takes the initial focus', () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <Drawer defaultOpen>
        <Drawer.Header>
          <Drawer.HeaderNavigation ref={ref} aria-label="Levels" className="pb-2">
            <Button appearance="subtle">Back</Button>
          </Drawer.HeaderNavigation>
          <Drawer.HeaderTitle>Advanced</Drawer.HeaderTitle>
        </Drawer.Header>
        <input aria-label="Name" />
      </Drawer>,
    );
    const nav = screen.getByRole('navigation', { name: 'Levels' });
    expect(nav.tagName).toBe('NAV');
    expect(ref.current).toBe(nav);
    expect(nav).toHaveClass(drawerHeaderNavigationClassNames.root, 'pb-2');
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
  });
});

describe('Drawer title next to a Drawer.Header (P6-05 D73)', () => {
  it('ignores title, warns once and is named by the HeaderTitle', () => {
    const warn = spyOnWarn();
    const { rerender } = render(
      <Drawer defaultOpen title="Ignored">
        <Drawer.Header>
          <Drawer.HeaderTitle>Account</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    rerender(
      <Drawer defaultOpen title="Still ignored">
        <Drawer.Header>
          <Drawer.HeaderTitle>Account</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByText('Still ignored')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(warn.mock.calls).toEqual([[WARNINGS.titleIgnored]]);
  });

  it('does not warn for a title that renders nothing', () => {
    const warn = spyOnWarn();
    render(
      <Drawer defaultOpen title="">
        <Drawer.Header>
          <Drawer.HeaderTitle>Account</Drawer.HeaderTitle>
        </Drawer.Header>
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });

  it('renders no header for a Drawer.Header whose children render nothing', () => {
    render(
      <Drawer defaultOpen aria-label="Quick actions">
        <Drawer.Header>{null}</Drawer.Header>
        <p>Body</p>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Quick actions' });
    expect(Array.from(panel.children)).toEqual([bodyOf(panel)]);
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Drawer.Footer (P6-05 D74)', () => {
  it('closes from a Drawer.Close inside it (reason close) and returns focus', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer title="Filters" onOpenChange={onOpenChange}>
        <Drawer.Trigger>
          <button type="button">Open filters</button>
        </Drawer.Trigger>
        <p>Fields</p>
        <Drawer.Footer>
          <Drawer.Close>
            <Button appearance="primary">Apply</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Open filters' }));
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, {
      reason: 'close',
      event: expect.any(Event),
    });
    expect(screen.getByRole('button', { name: 'Open filters' })).toHaveFocus();
  });

  it('submits a form in the body from a footer button named with form, and on Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Drawer defaultOpen title="Filters">
        <form id="filters" aria-label="Filters form" onSubmit={onSubmit}>
          <input aria-label="Keyword" />
        </form>
        <Drawer.Footer>
          <Button appearance="primary" type="submit" form="filters">
            Apply
          </Button>
        </Drawer.Footer>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    const form = screen.getByRole('form', { name: 'Filters form' });
    const submit = screen.getByRole('button', { name: 'Apply' });
    expect(bodyOf(panel)).toContainElement(form);
    expect(bodyOf(panel)).not.toContainElement(submit);
    // The button outside the form is its submit button (in a browser, also its default button).
    expect((submit as HTMLButtonElement).form).toBe(form);
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole('textbox', { name: 'Keyword' }), 'red{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['no children', undefined],
    ['null', null],
    ['an empty Fragment', <></>],
  ] as const)('renders no element when its children render nothing (%s)', (_, children) => {
    render(
      <Drawer defaultOpen title="Filters">
        <p>Fields</p>
        <Drawer.Footer data-testid="footer">{children}</Drawer.Footer>
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    expect(panel.lastElementChild).toBe(bodyOf(panel));
  });

  testNoImplicitSubmit(Drawer, {
    defaultProps: {
      open: true,
      'aria-label': 'Settings',
      children: (
        <>
          <Drawer.Header>
            <Drawer.HeaderTitle action={<Button>Expand</Button>}>Settings</Drawer.HeaderTitle>
          </Drawer.Header>
          <Drawer.Footer>
            <Drawer.Close>
              <Button>Done</Button>
            </Drawer.Close>
          </Drawer.Footer>
        </>
      ),
    },
  });
});

describe('Drawer parts: system props', () => {
  const panelWrapper = createOverlayTestWrapper(Drawer, {
    defaultOpen: true,
    'aria-label': 'Settings',
  });

  /** A Drawer named "Settings" whose Drawer.Header holds the part under test. */
  function InHeader({ children }: { children: React.ReactNode }) {
    return (
      <Drawer defaultOpen aria-label="Settings">
        <Drawer.Header>{children}</Drawer.Header>
      </Drawer>
    );
  }

  describe('Drawer.Header', () => {
    testSystemProps(Drawer.Header, {
      wrapper: panelWrapper,
      expectedTag: 'div',
      displayName: 'DrawerHeader',
      defaultProps: { children: <Drawer.HeaderTitle>Settings</Drawer.HeaderTitle> },
    });
  });

  describe('Drawer.HeaderTitle', () => {
    testSystemProps(Drawer.HeaderTitle, {
      wrapper: InHeader,
      expectedTag: 'div',
      displayName: 'DrawerHeaderTitle',
      defaultProps: { children: 'Settings' },
      a11yVariants: [{ name: 'with an action', props: { action: <Button>Expand</Button> } }],
    });
  });

  describe('Drawer.HeaderNavigation', () => {
    testSystemProps(Drawer.HeaderNavigation, {
      wrapper: InHeader,
      expectedTag: 'nav',
      displayName: 'DrawerHeaderNavigation',
      defaultProps: { children: <Button>Back</Button> },
    });
  });

  describe('Drawer.Footer', () => {
    testSystemProps(Drawer.Footer, {
      wrapper: panelWrapper,
      expectedTag: 'div',
      displayName: 'DrawerFooter',
      defaultProps: { children: <Button>Apply</Button> },
    });
  });
});

describe('Drawer parts: accessibility', () => {
  it('has no violations open with a Header, HeaderNavigation, HeaderTitle with an action, Body and Footer', async () => {
    render(
      <Composed action={<Button appearance="subtle" icon={<Glyph />} aria-label="Expand" />}>
        <Drawer.Body tabIndex={0} role="region" aria-label="Settings text">
          <p>Body text</p>
        </Drawer.Body>
      </Composed>,
    );
    await expectNoA11yViolations();
  });

  it('has no violations for a bottom drawer with parts', async () => {
    render(<Composed position="bottom" size="medium" />);
    await expectNoA11yViolations();
  });

  it('has no violations inside a page with its own navigation (the drawer’s nav is named)', async () => {
    render(
      <>
        <nav aria-label="Main">
          <a href="#home">Home</a>
        </nav>
        <Composed />
      </>,
    );
    expect(screen.getAllByRole('navigation', { hidden: true })).toHaveLength(2);
    await expectNoA11yViolations();
  });
});
