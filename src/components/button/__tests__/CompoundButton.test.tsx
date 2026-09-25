import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompoundButton } from '../CompoundButton';
import type { CompoundButtonOwnProps, CompoundButtonProps } from '../CompoundButton';
import { testSystemProps, testFocusEvents, testNoImplicitSubmit } from '../../../test-utils';
import type { Appearance, Size } from '../../../lib/types';

const HOVER_GATE = 'not-disabled:not-aria-disabled:hover:';
const ACTIVE_GATE = 'not-disabled:not-aria-disabled:active:';

describe('CompoundButton', () => {
  // The `as` variants render other elements, so the props are typed for any element.
  testSystemProps<CompoundButtonProps<React.ElementType>>(CompoundButton, {
    expectedTag: 'button',
    displayName: 'CompoundButton',
    polymorphic: true,
    defaultProps: { children: 'Send mail', secondaryText: 'Opens your email client' },
    conflictingClass: { className: 'px-8', overrides: 'px-3' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'primary', props: { appearance: 'primary' } },
      { name: 'as anchor', props: { as: 'a', href: '/mail' } },
      { name: 'as anchor, disabled', props: { as: 'a', href: '/mail', disabled: true } },
      { name: 'as div', props: { as: 'div' } },
    ],
  });

  testFocusEvents(CompoundButton, { children: 'Send mail' });

  testNoImplicitSubmit(CompoundButton, {
    defaultProps: { children: 'Send mail', secondaryText: 'Opens your email client' },
  });

  it('renders the label and the secondary text; both form the accessible name', () => {
    render(<CompoundButton secondaryText="Opens your email client">Send mail</CompoundButton>);
    const button = screen.getByRole('button', { name: /^Send mail\s*Opens your email client$/ });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('does not render secondaryText when not provided', () => {
    render(<CompoundButton>Send mail</CompoundButton>);
    const button = screen.getByRole('button', { name: 'Send mail' });
    expect(button.querySelectorAll('span')).toHaveLength(1);
  });

  it.each([
    ['an empty string', ''],
    ['true', true],
    ['an empty array', []],
    ['an empty Fragment', <></>],
    ['a Set of empty values', new Set([null, '', <React.Fragment key="f" />])],
  ])('renders no secondary line for secondaryText that renders nothing (%s)', (_, text) => {
    render(<CompoundButton secondaryText={text as React.ReactNode}>Send mail</CompoundButton>);
    const button = screen.getByRole('button', { name: 'Send mail' });
    expect(button.querySelectorAll('span')).toHaveLength(1);
  });

  it('renders a secondary line of 0 (a number is content)', () => {
    render(<CompoundButton secondaryText={0}>Items</CompoundButton>);
    expect(
      screen.getByRole('button', { name: /^Items\s*0$/ }).querySelectorAll('span'),
    ).toHaveLength(2);
  });

  it('renders the items of secondaryText given as a generator', () => {
    const error = vi.spyOn(console, 'error');
    function* details(): Generator<React.ReactNode> {
      yield 'Opens ';
      yield 'your mail';
    }
    render(<CompoundButton secondaryText={details()}>Send mail</CompoundButton>);
    expect(screen.getByRole('button', { name: /^Send mail\s*Opens your mail$/ })).toBeVisible();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('stacks the label above the secondary text', () => {
    render(<CompoundButton secondaryText="Details">Main</CompoundButton>);
    const button = screen.getByRole('button', { name: /Main/ });
    expect(button).toHaveClass('flex-col', 'items-start', 'h-auto');
    expect(button).not.toHaveClass('h-8', 'items-center');
  });

  describe('secondary text (button-provider#11, table-core#1)', () => {
    it('uses full-opacity text-primary-foreground on primary (no opacity modifier)', () => {
      render(
        <CompoundButton appearance="primary" secondaryText="Free for 30 days">
          Create account
        </CompoundButton>,
      );
      const secondary = screen.getByText('Free for 30 days');
      expect(secondary).toHaveClass('text-primary-foreground');
      expect(Array.from(secondary.classList).filter((c) => c.includes('/'))).toEqual([]);
    });

    it.each(['outline', 'subtle', 'transparent'] as const)(
      'uses text-muted-foreground on %s',
      (appearance) => {
        render(
          <CompoundButton appearance={appearance} secondaryText="Details">
            Main
          </CompoundButton>,
        );
        expect(screen.getByText('Details')).toHaveClass('text-muted-foreground');
      },
    );

    it('keeps the caption typography token next to the text color (cn custom type ramp)', () => {
      render(
        <CompoundButton appearance="primary" secondaryText="Details">
          Main
        </CompoundButton>,
      );
      expect(screen.getByText('Details')).toHaveClass('text-caption-1', 'text-primary-foreground');
    });

    it('keeps the size typography token when the consumer adds a text color', () => {
      render(
        <CompoundButton size="large" className="text-error">
          Delete
        </CompoundButton>,
      );
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
        'text-body-2',
        'text-error',
      );
    });
  });

  describe('styles (button-provider#3, #10, #19, #20)', () => {
    const distinguishing: Record<Appearance, string[]> = {
      primary: [
        'bg-primary',
        'text-primary-foreground',
        `${HOVER_GATE}bg-primary-hover`,
        `${ACTIVE_GATE}bg-primary-pressed`,
      ],
      outline: [
        'border-stroke',
        'bg-background',
        'text-foreground',
        `${HOVER_GATE}bg-subtle-hover`,
        `${ACTIVE_GATE}bg-subtle-pressed`,
      ],
      subtle: [
        'bg-transparent',
        'text-foreground',
        `${HOVER_GATE}bg-subtle-hover`,
        `${ACTIVE_GATE}bg-subtle-pressed`,
      ],
      transparent: ['bg-transparent', 'text-primary', `${HOVER_GATE}underline`],
    };

    it.each(Object.keys(distinguishing) as Appearance[])(
      '%s uses the shared token classes with gated hover',
      (appearance) => {
        render(<CompoundButton appearance={appearance}>Main</CompoundButton>);
        const button = screen.getByRole('button', { name: 'Main' });
        expect(button).toHaveClass(...distinguishing[appearance]);
        const classes = Array.from(button.classList);
        expect(classes.filter((c) => /\[(#|rgba?\()/.test(c))).toEqual([]);
        expect(classes.filter((c) => c.includes('enabled:'))).toEqual([]);
        expect(
          classes.filter(
            (c) =>
              /(^|:)(hover|active):/.test(c) && !c.startsWith('not-disabled:not-aria-disabled:'),
          ),
        ).toEqual([]);
      },
    );

    const padding: Record<Size, string> = {
      'extra-small': 'py-0.5',
      small: 'py-1',
      medium: 'py-2',
      large: 'py-3',
      'extra-large': 'py-4',
    };

    it.each(Object.keys(padding) as Size[])('%s size keeps its vertical padding', (size) => {
      render(<CompoundButton size={size}>Main</CompoundButton>);
      expect(screen.getByRole('button', { name: 'Main' })).toHaveClass(padding[size], 'min-w-24');
    });

    it('extra-large uses a larger font than large (button-provider#19)', () => {
      render(
        <>
          <CompoundButton size="large">Large</CompoundButton>
          <CompoundButton size="extra-large">Extra large</CompoundButton>
        </>,
      );
      expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('text-body-2');
      const xl = screen.getByRole('button', { name: 'Extra large' });
      expect(xl).toHaveClass('text-[18px]/[24px]');
      expect(xl).not.toHaveClass('text-sm');
    });
  });

  describe('polymorphic `as` (button-provider#8, #9)', () => {
    it('renders as an anchor with the gated hover class and no button attributes', () => {
      render(
        <CompoundButton as="a" href="/mail" secondaryText="Opens your email client">
          Send mail
        </CompoundButton>,
      );
      const link = screen.getByRole('link', { name: /Send mail/ });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/mail');
      expect(link).not.toHaveAttribute('type');
      expect(link).toHaveClass(`${HOVER_GATE}bg-subtle-hover`);
    });

    it('as="a" disabled: aria-disabled, no href, not focusable and clicks are prevented', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <>
          <button type="button">Before</button>
          <CompoundButton as="a" href="/mail" disabled onClick={onClick} tabIndex={0}>
            Send mail
          </CompoundButton>
        </>,
      );
      const link = screen.getByRole('link', { name: 'Send mail' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('href');
      expect(link).not.toHaveAttribute('disabled');
      expect(link).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();

      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(link).not.toHaveFocus();
    });

    it('as="div" gets role="button", a tab stop and Enter/Space activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <CompoundButton as="div" secondaryText="Details" onClick={onClick}>
          Open
        </CompoundButton>,
      );
      const button = screen.getByRole('button', { name: /Open/ });
      expect(button.tagName).toBe('DIV');
      expect(button).toHaveAttribute('tabindex', '0');
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('as="div" disabled: aria-disabled, tabindex -1, activation prevented', () => {
      const onClick = vi.fn();
      render(
        <CompoundButton as="div" disabled onClick={onClick}>
          Open
        </CompoundButton>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(false);
      expect(fireEvent.click(button)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('forwards the ref to the rendered anchor', () => {
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <CompoundButton as="a" href="/mail" ref={ref}>
          Send mail
        </CompoundButton>,
      );
      expect(ref.current).toBe(screen.getByRole('link', { name: 'Send mail' }));
    });
  });

  it('applies disabled state', () => {
    render(<CompoundButton disabled>Disabled</CompoundButton>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CompoundButton onClick={onClick}>Click</CompoundButton>);
    await user.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('types (button-provider#8, #27)', () => {
    it('as="a" accepts anchor props and types handlers for the anchor', () => {
      const onAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault();
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <CompoundButton as="a" href="/mail" target="_blank" onClick={onAnchorClick} ref={ref}>
          Send mail
        </CompoundButton>,
      );
      expect(ref.current).toBe(screen.getByRole('link', { name: 'Send mail' }));
    });

    it('rejects button-only props on as="a" and anchor props on the default button', () => {
      const elements = [
        // @ts-expect-error formAction is a <button> attribute, not an <a> attribute
        <CompoundButton key="1" as="a" href="/" formAction="/submit" />,
        // @ts-expect-error href does not exist on <button>
        <CompoundButton key="2" href="/nope" />,
        // @ts-expect-error appearance keeps its literal type
        <CompoundButton key="3" appearance="ghost" />,
      ];
      expect(elements).toHaveLength(3);
    });

    it('CompoundButtonProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface TrackedProps extends CompoundButtonProps {
        tracking?: string;
      }
      expectTypeOf<TrackedProps>().toHaveProperty('secondaryText');
      expectTypeOf<CompoundButtonProps>().toEqualTypeOf<CompoundButtonProps<'button'>>();
      expectTypeOf<CompoundButtonProps['ref']>().toEqualTypeOf<
        React.Ref<HTMLButtonElement> | undefined
      >();
      expectTypeOf<CompoundButtonProps<'a'>>().toHaveProperty('href');
      expectTypeOf<keyof CompoundButtonOwnProps>().toEqualTypeOf<
        'secondaryText' | 'appearance' | 'size' | 'disabled'
      >();
    });
  });
});
