import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from '../Link';
import type { LinkAppearance, LinkOwnProps, LinkProps, LinkVariant } from '../Link';
import { testSystemProps, testFocusEvents, testNoImplicitSubmit } from '../../../test-utils';

const HOVER_GATE = 'not-disabled:not-aria-disabled:hover:';

/** A router-link stand-in: a custom component that renders an anchor and spreads its props. */
interface FakeRouterLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  ref?: React.Ref<HTMLAnchorElement>;
}
const FakeRouterLink = ({ to, ...rest }: FakeRouterLinkProps) => <a href={to} {...rest} />;

/** A `<Link as="button">` for the implicit-submit check. */
const ButtonLink = (props: LinkProps<'button'>) => <Link as="button" {...props} />;

describe('Link', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The shared helpers click the link: a same-document href keeps jsdom from logging
  // "Not implemented: navigation to another Document". Cross-document hrefs stay in tests that
  // never click (or that prevent the default action).
  testSystemProps(Link, {
    expectedTag: 'a',
    displayName: 'Link',
    polymorphic: true,
    defaultProps: { children: 'Documentation', href: '#docs' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'standalone', props: { appearance: 'standalone' } },
      { name: 'subtle', props: { appearance: 'subtle' } },
      { name: 'without href', props: { href: undefined } },
      { name: 'without href, disabled', props: { href: undefined, disabled: true } },
      { name: 'disabledFocusable', props: { disabledFocusable: true } },
    ],
  });

  testFocusEvents(Link, { children: 'Documentation', href: '#docs' });

  describe('as="button" inside a form (C-BUTTON-TYPE)', () => {
    testNoImplicitSubmit(ButtonLink, { defaultProps: { children: 'Show more' } });
  });

  it('renders an anchor with its href', () => {
    render(<Link href="/docs">Documentation</Link>);
    const link = screen.getByRole('link', { name: 'Documentation' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/docs');
    expect(link).not.toHaveAttribute('role');
    expect(link).not.toHaveAttribute('tabindex');
    expect(link).not.toHaveAttribute('aria-disabled');
  });

  describe('without href (an action styled as a link)', () => {
    it('is a button: role="button", a tab stop, and Enter/Space call onClick once each', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <React.StrictMode>
          <button type="button">Before</button>
          <Link onClick={onClick}>Show more</Link>
        </React.StrictMode>,
      );
      const link = screen.getByRole('button', { name: 'Show more' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('role', 'button');
      expect(link).toHaveAttribute('tabindex', '0');
      expect(link).not.toHaveAttribute('href');

      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(link).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
      await user.click(link);
      expect(onClick).toHaveBeenCalledTimes(3);
    });

    it('Space activates on keyup and does not scroll the page (the keydown is prevented)', () => {
      const onClick = vi.fn();
      render(<Link onClick={onClick}>Show more</Link>);
      const link = screen.getByRole('button', { name: 'Show more' });
      // fireEvent returns false when the default action was prevented.
      expect(fireEvent.keyDown(link, { key: ' ' })).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
      fireEvent.keyUp(link, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('a consumer role and tabIndex win over the defaults', () => {
      render(
        <Link role="link" tabIndex={-1}>
          Show more
        </Link>,
      );
      expect(screen.getByRole('link', { name: 'Show more' })).toHaveAttribute('tabindex', '-1');
    });

    it('an empty href keeps the anchor a link: no role or tab index is added', () => {
      const error = vi.spyOn(console, 'error');
      render(<Link href="">Reload</Link>);
      const link = screen.getByText('Reload');
      expect(link).toHaveAttribute('href', '');
      expect(link).not.toHaveAttribute('role');
      expect(link).not.toHaveAttribute('tabindex');
      expect(error).not.toHaveBeenCalled();
    });

    it('as="span" gets button semantics', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Link as="span" onClick={onClick}>
          Details
        </Link>,
      );
      const span = screen.getByRole('button', { name: 'Details' });
      expect(span.tagName).toBe('SPAN');
      expect(span).toHaveAttribute('tabindex', '0');
      await user.tab();
      expect(span).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('a custom component `as` gets no role or tab stop', () => {
      render(
        <Link as={FakeRouterLink} to="/home">
          Home
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).not.toHaveAttribute('role');
      expect(link).not.toHaveAttribute('tabindex');
    });
  });

  it('renders as a button via as="button" with type="button"', () => {
    render(<Link as="button">Show more</Link>);
    const button = screen.getByRole('button', { name: 'Show more' });
    expect(button).toHaveAttribute('type', 'button');
  });

  describe('appearance (button-provider#14, layout#16)', () => {
    it('inline (default) is always underlined and thickens the underline on hover and focus', () => {
      render(<Link href="/docs">Documentation</Link>);
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveClass('text-primary', 'underline');
      expect(link).toHaveClass(`${HOVER_GATE}decoration-2`, 'focus-visible:decoration-2');
    });

    it('standalone is semibold and underlines on hover only', () => {
      render(
        <Link href="/docs" appearance="standalone">
          Documentation
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveClass('font-semibold', 'text-primary', `${HOVER_GATE}underline`);
      expect(link).not.toHaveClass('underline');
    });

    it('subtle uses the foreground color and underlines on hover only', () => {
      render(
        <Link href="/docs" appearance="subtle">
          Documentation
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveClass('text-foreground', `${HOVER_GATE}underline`);
      expect(link).not.toHaveClass('underline');
    });

    it('gates hover styles, never uses enabled: and reduces motion', () => {
      render(<Link href="/docs">Documentation</Link>);
      const classes = Array.from(screen.getByRole('link', { name: 'Documentation' }).classList);
      expect(classes.filter((c) => c.includes('enabled:'))).toEqual([]);
      expect(
        classes.filter(
          (c) => c.includes('hover:') && !c.startsWith('not-disabled:not-aria-disabled:'),
        ),
      ).toEqual([]);
      expect(classes).toContain('motion-reduce:transition-none');
    });

    it('the deprecated variant prop still works and warns once', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <Link href="/a" variant="standalone">
            First
          </Link>
          <Link href="/b" variant="subtle">
            Second
          </Link>
        </>,
      );
      expect(screen.getByRole('link', { name: 'First' })).toHaveClass('font-semibold');
      expect(screen.getByRole('link', { name: 'Second' })).toHaveClass('text-foreground');
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages).toEqual([
        '[WaveUI] Link: `variant` is deprecated and will be removed in 1.0. Use `appearance` instead.',
      ]);
    });

    it('appearance wins over the deprecated variant', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Link href="/docs" appearance="subtle" variant="standalone">
          Documentation
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveClass('text-foreground');
      expect(link).not.toHaveClass('font-semibold');
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Link: `variant` is deprecated and will be removed in 1.0. Use `appearance` instead.',
        ],
      ]);
    });

    it('does not warn without the deprecated prop', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Link href="/docs" appearance="standalone">
          Documentation
        </Link>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('disabled (button-provider#17, #18)', () => {
    it('drops href, keeps the link role and sets aria-disabled and tabIndex=-1', () => {
      render(
        <Link href="/docs" disabled>
          Documentation
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('role', 'link');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('prevents the default action of a click and does not call onClick', () => {
      const onClick = vi.fn();
      render(
        <Link href="/docs" disabled onClick={onClick}>
          Documentation
        </Link>,
      );
      // fireEvent returns false when the default action was prevented.
      expect(fireEvent.click(screen.getByRole('link', { name: 'Documentation' }))).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });

    it.each([
      ['with href', '/docs'],
      ['without href', undefined],
    ])(
      '%s: the click does not reach ancestor onClick handlers and Enter/Space call nothing',
      (_name, href) => {
        const onParentClick = vi.fn();
        const onClick = vi.fn();
        const onKeyDown = vi.fn();
        render(
          <div onClick={onParentClick}>
            <Link href={href} disabled onClick={onClick} onKeyDown={onKeyDown}>
              Documentation
            </Link>
          </div>,
        );
        const link = screen.getByText('Documentation');
        expect(fireEvent.click(link)).toBe(false);
        expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
        expect(fireEvent.keyDown(link, { key: ' ' })).toBe(false);
        expect(fireEvent.keyUp(link, { key: ' ' })).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
        expect(onKeyDown).not.toHaveBeenCalled();
        expect(onParentClick).not.toHaveBeenCalled();
      },
    );

    it('has role="link" with an href and role="button" without one, and data-disabled', () => {
      render(
        <>
          <Link href="/docs" disabled>
            Documentation
          </Link>
          <Link disabled>Show more</Link>
        </>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      const action = screen.getByRole('button', { name: 'Show more' });
      for (const element of [link, action]) {
        expect(element).toHaveAttribute('aria-disabled', 'true');
        expect(element).toHaveAttribute('data-disabled', '');
        expect(element).toHaveAttribute('tabindex', '-1');
      }
    });

    it('a consumer tabIndex or aria-disabled cannot re-enable a disabled link', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">Before</button>
          <Link href="/docs" disabled tabIndex={0} aria-disabled={false}>
            Documentation
          </Link>
        </>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(link).not.toHaveFocus();
    });

    it('restores href and focusability when re-enabled', () => {
      const { rerender } = render(
        <Link href="/docs" disabled>
          Documentation
        </Link>,
      );
      expect(screen.getByRole('link', { name: 'Documentation' })).not.toHaveAttribute('href');
      rerender(<Link href="/docs">Documentation</Link>);
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).toHaveAttribute('href', '/docs');
      expect(link).not.toHaveAttribute('role');
      expect(link).not.toHaveAttribute('tabindex');
      expect(link).not.toHaveAttribute('aria-disabled');
    });

    it('as="button" uses the native disabled attribute', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Link as="button" disabled onClick={onClick}>
          Show more
        </Link>,
      );
      const button = screen.getByRole('button', { name: 'Show more' });
      expect(button).toBeDisabled();
      expect(button).not.toHaveAttribute('aria-disabled');
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a custom component `as` (router link) gets aria-disabled and its click is prevented', () => {
      const onClick = vi.fn();
      render(
        <Link as={FakeRouterLink} to="/home" disabled onClick={onClick}>
          Home
        </Link>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('disabledFocusable', () => {
    it('keeps its focus ring at full strength: the dimmed look lifts while it shows the ring', () => {
      render(
        <Link href="/docs" disabledFocusable>
          Documentation
        </Link>,
      );
      // CSS opacity dims the element's own outline too, which would put the ring below 3:1.
      expect(screen.getByRole('link', { name: 'Documentation' })).toHaveClass(
        'opacity-50',
        'aria-disabled:focus-visible:opacity-100',
      );
    });

    it('drops href, keeps role="link", stays in the tab order and blocks activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onParentClick = vi.fn();
      render(
        <div onClick={onParentClick}>
          <Link href="/docs" disabledFocusable onClick={onClick}>
            Documentation
          </Link>
        </div>,
      );
      const link = screen.getByRole('link', { name: 'Documentation' });
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveAttribute('tabindex', '0');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('data-disabled', '');
      expect(link).toHaveAttribute('data-disabled-focusable', '');
      expect(link).toHaveClass('opacity-50', 'cursor-not-allowed');

      await user.tab();
      expect(link).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.click(link);
      expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
      expect(onParentClick).not.toHaveBeenCalled();
    });

    it('without href it is a focusable disabled button; it wins over disabled', () => {
      render(
        <Link disabled disabledFocusable>
          Show more
        </Link>,
      );
      const action = screen.getByRole('button', { name: 'Show more' });
      expect(action).toHaveAttribute('tabindex', '0');
      expect(action).toHaveAttribute('aria-disabled', 'true');
      expect(action).toHaveAttribute('data-disabled-focusable', '');
    });

    it('as="button" is focusable-disabled instead of natively disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Link as="button" disabledFocusable onClick={onClick}>
          Show more
        </Link>,
      );
      const button = screen.getByRole('button', { name: 'Show more' });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('data-disabled-focusable', '');
      await user.tab();
      expect(button).toHaveFocus();
      await user.click(button);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('calls onClick when not disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault());
    render(
      <Link href="/docs" onClick={onClick}>
        Documentation
      </Link>,
    );
    await user.click(screen.getByRole('link', { name: 'Documentation' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards the ref to a custom component', () => {
    const ref = React.createRef<HTMLAnchorElement>();
    render(
      <Link as={FakeRouterLink} to="/home" ref={ref}>
        Home
      </Link>,
    );
    expect(ref.current).toBe(screen.getByRole('link', { name: 'Home' }));
  });

  describe('types (button-provider#8, #27, layout#16)', () => {
    it('is polymorphic: props follow `as`', () => {
      const onAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault();
      const elements = [
        <Link key="1" href="/docs" target="_blank" onClick={onAnchorClick} />,
        <Link key="2" as="button" type="submit" />,
        <Link key="3" as={FakeRouterLink} to="/home" />,
        // @ts-expect-error href does not exist on <button>
        <Link key="4" as="button" href="/nope" />,
        // @ts-expect-error `to` is required by the router link
        <Link key="5" as={FakeRouterLink} />,
        // @ts-expect-error appearance keeps its literal type
        <Link key="6" appearance="primary" />,
      ];
      expect(elements).toHaveLength(6);
    });

    it('LinkProps (0.4 name) is the default-tag props type with ref (C-REF)', () => {
      expectTypeOf<LinkProps>().toEqualTypeOf<LinkProps<'a'>>();
      expectTypeOf<LinkProps['ref']>().toEqualTypeOf<React.Ref<HTMLAnchorElement> | undefined>();
      expectTypeOf<LinkVariant>().toEqualTypeOf<LinkAppearance>();
      expectTypeOf<keyof LinkOwnProps>().toEqualTypeOf<
        'appearance' | 'variant' | 'disabled' | 'disabledFocusable'
      >();
      expectTypeOf<LinkProps<'button'>['disabledFocusable']>().toEqualTypeOf<boolean | undefined>();
      interface MyLinkProps extends LinkProps {
        tracking?: string;
      }
      expectTypeOf<MyLinkProps>().toHaveProperty('href');
    });
  });
});
