import * as React from 'react';
import { describe, it, expect, vi, afterEach, expectTypeOf } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb, BreadcrumbItem } from '../Breadcrumb';
import type { BreadcrumbItemProps } from '../Breadcrumb';
import type { Slot } from '../../../lib/types';
import {
  createOverlayTestWrapper,
  expectNoA11yViolations,
  renderWithProviders,
  testCompoundExposure,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

const BreadcrumbWrapper = createOverlayTestWrapper(Breadcrumb, {});

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

const separatorsIn = (el: HTMLElement) => el.querySelectorAll('[data-wave-breadcrumb-separator]');

describe('Breadcrumb', () => {
  testSystemProps(Breadcrumb, {
    expectedTag: 'nav',
    displayName: 'Breadcrumb',
    defaultProps: {
      children: [
        <Breadcrumb.Item key="home" href="/">
          Home
        </Breadcrumb.Item>,
        <Breadcrumb.Item key="current" current>
          Widget
        </Breadcrumb.Item>,
      ],
    },
  });

  testCompoundExposure(Breadcrumb, ['Item']);

  testNoImplicitSubmit(Breadcrumb, {
    defaultProps: {
      children: [
        <Breadcrumb.Item key="back" onClick={() => {}}>
          Back
        </Breadcrumb.Item>,
        <Breadcrumb.Item key="current" current>
          Page
        </Breadcrumb.Item>,
      ],
    },
  });

  it('exports Item under its flat name (C-COMPOUND)', () => {
    expect(BreadcrumbItem).toBe(Breadcrumb.Item);
  });

  it('renders with aria-label="Breadcrumb"', () => {
    render(
      <Breadcrumb data-testid="bc">
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByTestId('bc')).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('renders separator between items: one per list item after the first', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item href="/products">Products</Breadcrumb.Item>
        <Breadcrumb.Item current>Widget</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(separatorsIn(items[0])).toHaveLength(0);
    expect(separatorsIn(items[1])).toHaveLength(1);
    expect(separatorsIn(items[2])).toHaveLength(1);
    // The separator comes before the item's content.
    expect(items[1].firstElementChild).toBe(separatorsIn(items[1])[0]);
    expect(separatorsIn(items[1])[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('skips empty children without leaving a separator behind', () => {
    const showMiddle = false;
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        {showMiddle && <Breadcrumb.Item href="/x">Hidden</Breadcrumb.Item>}
        <Breadcrumb.Item current>Widget</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(separatorsIn(items[1])).toHaveLength(1);
  });

  it('mirrors the separator in RTL (C-LOGICAL)', () => {
    renderWithProviders(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item current>Widget</Breadcrumb.Item>
      </Breadcrumb>,
      { dir: 'rtl' },
    );
    const separator = separatorsIn(screen.getAllByRole('listitem')[1])[0];
    expect(separator.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(separator).toHaveClass('rtl:-scale-x-100');
  });

  it('marks current item with aria-current="page"', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
        <Breadcrumb.Item current>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page');
  });

  it('renders non-current items as links', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/home">Home</Breadcrumb.Item>
      </Breadcrumb>,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link).toHaveAttribute('href', '/home');
  });

  it('renders current item as span', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item current>Current</Breadcrumb.Item>
      </Breadcrumb>,
    );
    expect(screen.getByText('Current').tagName.toLowerCase()).toBe('span');
  });

  describe('items without href', () => {
    it('renders a <button type="button"> when onClick is given', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item onClick={onClick}>Home</Breadcrumb.Item>
          <Breadcrumb.Item current>Page</Breadcrumb.Item>
        </Breadcrumb>,
      );
      const button = screen.getByRole('button', { name: 'Home' });
      expect(button).toHaveAttribute('type', 'button');
      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('renders plain text (a <span>) without href or onClick, with a dev warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Breadcrumb>
          <Breadcrumb.Item>Home</Breadcrumb.Item>
          <Breadcrumb.Item current>Page</Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(screen.getByText('Home').tagName).toBe('SPAN');
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[WaveUI] Breadcrumb.Item: a non-current item without `href`'),
      );
    });

    it('does not warn for the current item', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Breadcrumb>
          <Breadcrumb.Item current>Page</Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('a text item drops button-only attributes (no <span disabled>) and warns that disabled is ignored', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Breadcrumb>
          <Breadcrumb.Item
            disabled
            type="submit"
            name="crumb"
            value="v"
            form="f"
            formAction="/submit"
            data-testid="text"
            title="Text item"
          >
            Text
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const span = screen.getByTestId('text');
      expect(span.tagName).toBe('SPAN');
      for (const attribute of ['disabled', 'type', 'name', 'value', 'form', 'formaction']) {
        expect(span).not.toHaveAttribute(attribute);
      }
      expect(span).toHaveAttribute('title', 'Text item');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '[WaveUI] Breadcrumb.Item: `disabled` applies to link, button and asChild items',
        ),
      );
    });

    it('does not warn about disabled on a button item', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Breadcrumb>
          <Breadcrumb.Item disabled onClick={() => {}}>
            Back
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('a current item drops disabled (no <span disabled>) and warns once that it is ignored', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // A new key remounts the item, so its warning effect runs a second time.
      const trail = (key: string) => (
        <Breadcrumb>
          <Breadcrumb.Item key={key} current disabled data-testid="current">
            Page
          </Breadcrumb.Item>
        </Breadcrumb>
      );
      const { rerender } = render(trail('first'));
      rerender(trail('second'));
      const span = screen.getByTestId('current');
      expect(span.tagName).toBe('SPAN');
      expect(span).toHaveAttribute('aria-current', 'page');
      expect(span).not.toHaveAttribute('disabled');
      const disabledWarnings = warn.mock.calls.filter(([message]) =>
        String(message).includes(
          '[WaveUI] Breadcrumb.Item: `disabled` applies to link, button and asChild items',
        ),
      );
      expect(disabledWarnings).toHaveLength(1);
    });

    it('a button item does not render rel (it only belongs on a link)', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item onClick={() => {}} rel="noopener" title="Back to start">
            Back
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const button = screen.getByRole('button', { name: 'Back' });
      expect(button).not.toHaveAttribute('rel');
      expect(button).toHaveAttribute('title', 'Back to start');
    });
  });

  it('a current item with href drops its link-only attributes from the <span>', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item
          href="/x"
          current
          target="_blank"
          rel="noreferrer"
          download
          hrefLang="en"
          ping="/ping"
          media="print"
          referrerPolicy="no-referrer"
          type="text/html"
          data-testid="current"
          lang="en"
        >
          Here
        </Breadcrumb.Item>
      </Breadcrumb>,
    );
    const span = screen.getByTestId('current');
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('aria-current', 'page');
    for (const attribute of [
      'href',
      'target',
      'rel',
      'download',
      'hreflang',
      'ping',
      'media',
      'referrerpolicy',
      'type',
    ]) {
      expect(span).not.toHaveAttribute(attribute);
    }
    expect(span).toHaveAttribute('lang', 'en');
  });

  it('a link item keeps its link attributes', () => {
    render(
      <Breadcrumb>
        <Breadcrumb.Item href="/x" target="_blank" rel="noreferrer" hrefLang="en">
          There
        </Breadcrumb.Item>
      </Breadcrumb>,
    );
    const link = screen.getByRole('link', { name: 'There' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link).toHaveAttribute('hreflang', 'en');
  });

  describe('router links (asChild)', () => {
    const RouterLink = ({
      to,
      children,
      ref,
      ...rest
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      to: string;
      ref?: React.Ref<HTMLAnchorElement>;
    }) => (
      <a ref={ref} href={to} data-router-link="" {...rest}>
        {children}
      </a>
    );

    it('merges the item styling onto the child link and keeps its props', () => {
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <Breadcrumb>
          <Breadcrumb.Item asChild icon={{ children: 'I' }} className="item-class">
            <RouterLink to="/docs" className="link-class" ref={ref}>
              Docs
            </RouterLink>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('href', '/docs');
      expect(link).toHaveAttribute('data-router-link');
      expect(link).toHaveClass('item-class', 'link-class', 'text-primary');
      expect(ref.current).toBe(link);
      expect(within(link).getByText('I')).toHaveAttribute('aria-hidden', 'true');
    });

    it('marks a current router link with aria-current', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item asChild current>
            <RouterLink to="/here">Here</RouterLink>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(screen.getByRole('link', { name: 'Here' })).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Breadcrumb.Item', () => {
    testSystemProps(Breadcrumb.Item, {
      expectedTag: 'a',
      displayName: 'BreadcrumbItem',
      wrapper: BreadcrumbWrapper,
      defaultProps: { href: '/', children: 'Home' },
    });

    describe('current', () => {
      testSystemProps(Breadcrumb.Item, {
        expectedTag: 'span',
        displayName: 'BreadcrumbItem',
        wrapper: BreadcrumbWrapper,
        defaultProps: { current: true, children: 'Page' },
      });
    });

    describe('button', () => {
      testSystemProps(Breadcrumb.Item, {
        expectedTag: 'button',
        displayName: 'BreadcrumbItem',
        wrapper: BreadcrumbWrapper,
        defaultProps: { onClick: () => {}, children: 'Home' },
      });
    });

    it('renders the icon slot aria-hidden, so icon text is not part of the name', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/" icon={{ children: 'ico' }}>
            Home
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(screen.getByText('ico')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('link')).toHaveAccessibleName('Home');
      expect(screen.getByText('ico')).toHaveClass('me-1');
    });

    // An icon that renders nothing is no icon, as in Nav, Tree and Avatar: no empty span and no
    // stray `me-1` margin before the text, also on an `asChild` element.
    it.each(EMPTY_ICONS)('renders no icon span for an icon set to %s', (_kind, makeIcon) => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/" icon={makeIcon()}>
            Home
          </Breadcrumb.Item>
          <Breadcrumb.Item asChild icon={makeIcon()}>
            <a href="/docs">Docs</a>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      for (const name of ['Home', 'Docs']) {
        const link = screen.getByRole('link', { name });
        expect(link.querySelector('span')).toBeNull();
        expect(link.textContent).toBe(name);
      }
    });

    it('renders the items of a generator icon that has content (the check does not consume it)', () => {
      function* glyphs() {
        yield null;
        yield <svg key="glyph" data-testid="glyph" />;
      }
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/" icon={glyphs()}>
            Home
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(screen.getByTestId('glyph').parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('links and buttons carry the shared focus ring (C-FOCUS)', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/">Home</Breadcrumb.Item>
          <Breadcrumb.Item onClick={() => {}}>Back</Breadcrumb.Item>
        </Breadcrumb>,
      );
      for (const el of [
        screen.getByRole('link', { name: 'Home' }),
        screen.getByRole('button', { name: 'Back' }),
      ]) {
        expect(el).toHaveClass(
          'focus-visible:outline-2',
          'focus-visible:outline-offset-2',
          'focus-visible:outline-ring',
        );
      }
    });

    it('a consumer onClick on a link runs and leaves the link working (href and default action kept)', () => {
      const onClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="#docs" onClick={onClick}>
            Docs
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      // fireEvent returns false when the click's default action was prevented.
      expect(fireEvent.click(link)).toBe(true);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('link', { name: 'Docs' })).toBe(link);
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '#docs');
    });

    it('a consumer onClick on a link can prevent its default action (client-side routing)', () => {
      const onClick = vi.fn((e: React.MouseEvent<HTMLAnchorElement>) => e.preventDefault());
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="#docs" onClick={onClick}>
            Docs
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      expect(fireEvent.click(screen.getByRole('link', { name: 'Docs' }))).toBe(false);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a disabled button item has the disabled look, no hover underline and is not activated', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item onClick={onClick} disabled>
            Back
          </Breadcrumb.Item>
          <Breadcrumb.Item current>Page</Breadcrumb.Item>
        </Breadcrumb>,
      );
      const back = screen.getByRole('button', { name: 'Back' });
      expect(back).toBeDisabled();
      expect(back).toHaveClass(
        'disabled:cursor-not-allowed',
        'disabled:opacity-50',
        'aria-disabled:opacity-50',
        'not-disabled:not-aria-disabled:hover:underline',
      );
      expect(back).not.toHaveClass('hover:underline');
      await user.click(back);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('an aria-disabled link does not navigate or run onClick', () => {
      const onClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/docs" aria-disabled="true" onClick={onClick}>
            Docs
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('tabindex', '-1');
      fireEvent.click(link);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a link item takes disabled, like Link', async () => {
      const onClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/docs" disabled onClick={onClick}>
            Docs
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
      expect(link).not.toHaveAttribute('disabled');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
      await expectNoA11yViolations(document.body);
    });

    it('an aria-disabled asChild link does not navigate or run either onClick', () => {
      const onItemClick = vi.fn();
      const onChildClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item asChild aria-disabled="true" onClick={onItemClick}>
            <a href="#docs" onClick={onChildClick}>
              Docs
            </a>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(link)).toBe(false);
      expect(onItemClick).not.toHaveBeenCalled();
      expect(onChildClick).not.toHaveBeenCalled();
    });

    it('an asChild link whose own element is aria-disabled does not navigate', () => {
      const onChildClick = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item asChild>
            <a href="#docs" aria-disabled="true" onClick={onChildClick}>
              Docs
            </a>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(link)).toBe(false);
      expect(onChildClick).not.toHaveBeenCalled();
    });

    it('an item whose href is known only at run time takes disabled', () => {
      const maybeHref = '/docs' as string | undefined;
      render(
        <Breadcrumb>
          <Breadcrumb.Item href={maybeHref} disabled>
            Docs
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).not.toHaveAttribute('href');
    });

    it('a disabled asChild router link cancels the click, so the router does not navigate', () => {
      const navigate = vi.fn();
      function RouterLink({ to, onClick, ...props }: { to: string } & React.ComponentProps<'a'>) {
        return (
          <a
            href={to}
            {...props}
            onClick={(event) => {
              onClick?.(event);
              if (!event.defaultPrevented) navigate(to);
            }}
          />
        );
      }
      render(
        <Breadcrumb>
          <Breadcrumb.Item asChild disabled>
            <RouterLink to="/docs">Docs</RouterLink>
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('disabled');
      fireEvent.click(link);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('links gate the hover underline, so an aria-disabled link does not react to hover', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/" aria-disabled="true">
            Home
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveClass(
        'not-disabled:not-aria-disabled:hover:underline',
        'aria-disabled:opacity-50',
      );
      expect(link).not.toHaveClass('hover:underline');
    });

    it('types unannotated handlers from href: button events without it, link events with it', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      const onDocs = vi.fn();
      render(
        <Breadcrumb>
          <Breadcrumb.Item
            onClick={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLButtonElement>>();
              e.preventDefault();
              onBack(e.currentTarget.tagName);
            }}
            onKeyDown={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.KeyboardEvent<HTMLButtonElement>>();
            }}
          >
            Back
          </Breadcrumb.Item>
          <Breadcrumb.Item
            href="#docs"
            onClick={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLAnchorElement>>();
              e.preventDefault();
              onDocs(e.currentTarget.getAttribute('href'));
            }}
          >
            Docs
          </Breadcrumb.Item>
          <Breadcrumb.Item current>Page</Breadcrumb.Item>
        </Breadcrumb>,
      );
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(onBack).toHaveBeenCalledWith('BUTTON');
      await user.click(screen.getByRole('link', { name: 'Docs' }));
      expect(onDocs).toHaveBeenCalledWith('#docs');
    });

    it('a runtime href (string | undefined) still compiles with an unannotated handler (0.4)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      function DynamicCrumb({ href }: { href?: string }) {
        return (
          <Breadcrumb.Item
            href={href}
            onClick={(e) => {
              expectTypeOf(e).toEqualTypeOf<React.MouseEvent<HTMLElement>>();
              e.preventDefault();
              onClick(e.currentTarget.tagName);
            }}
          >
            Dynamic
          </Breadcrumb.Item>
        );
      }
      const { rerender } = render(
        <Breadcrumb>
          <DynamicCrumb />
        </Breadcrumb>,
      );
      await user.click(screen.getByRole('button', { name: 'Dynamic' }));
      expect(onClick).toHaveBeenLastCalledWith('BUTTON');
      rerender(
        <Breadcrumb>
          <DynamicCrumb href="#dyn" />
        </Breadcrumb>,
      );
      await user.click(screen.getByRole('link', { name: 'Dynamic' }));
      expect(onClick).toHaveBeenLastCalledWith('A');
    });

    it('types anchor attributes on link items and button attributes on button items', () => {
      render(
        <Breadcrumb>
          <Breadcrumb.Item href="/file" target="_blank" rel="noreferrer" download>
            File
          </Breadcrumb.Item>
          <Breadcrumb.Item onClick={(e: React.MouseEvent<HTMLButtonElement>) => e}>
            Back
          </Breadcrumb.Item>
          {/* @ts-expect-error target needs href: without it the item is a button */}
          <Breadcrumb.Item target="_blank" onClick={() => {}}>
            No href
          </Breadcrumb.Item>
        </Breadcrumb>,
      );
      // Type-only: never rendered (React logs an error for `formAction` on an <a>).
      const invalidLinkItem = (
        // @ts-expect-error formAction is a button attribute; not valid on a link item
        <Breadcrumb.Item href="/bad" formAction="/submit">
          Bad
        </Breadcrumb.Item>
      );
      expect(React.isValidElement(invalidLinkItem)).toBe(true);
      expect(screen.getByRole('link', { name: 'File' })).toHaveAttribute('target', '_blank');
      expectTypeOf<{ target: string; children: string }>().not.toMatchTypeOf<BreadcrumbItemProps>();
      expectTypeOf<{
        href: string;
        target: string;
        children: string;
      }>().toMatchTypeOf<BreadcrumbItemProps>();
    });
  });
});
