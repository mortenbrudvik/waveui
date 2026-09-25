import * as React from 'react';
import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompoundButton } from '../CompoundButton';
import type { CompoundButtonOwnProps, CompoundButtonProps } from '../CompoundButton';
import { Button } from '../Button';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
} from '../../../test-utils';
import type { Appearance, IconPosition, Size, Slot } from '../../../lib/types';

const HOVER_GATE = 'not-disabled:not-aria-disabled:hover:';
const ACTIVE_GATE = 'not-disabled:not-aria-disabled:active:';

/** The development warning of an icon-only button without an accessible name (from Button). */
const ICON_ONLY_WARNING =
  '[WaveUI] Button: an icon-only button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon is decorative and hidden from assistive technology).';

const MailIcon = () => (
  <svg data-testid="mail-icon" viewBox="0 0 16 16" width="16" height="16">
    <path d="M2 4h12v8H2z" fill="currentColor" />
  </svg>
);

/** The wrapper of the text lines (`span[data-wave-compound-content]`). */
function contentWrapper(button: HTMLElement): HTMLElement {
  const wrapper = button.querySelector<HTMLElement>(':scope > [data-wave-compound-content]');
  if (!wrapper) throw new Error('no text wrapper');
  return wrapper;
}

/** The text lines: the main label and, when it renders, the secondary text. */
const textLines = (button: HTMLElement) => Array.from(contentWrapper(button).children);

describe('CompoundButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      { name: 'with icon', props: { icon: <MailIcon /> } },
      {
        name: 'icon only with aria-label',
        props: {
          icon: <MailIcon />,
          children: undefined,
          secondaryText: undefined,
          'aria-label': 'Send mail',
        },
      },
      { name: 'disabledFocusable', props: { disabledFocusable: true } },
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
    expect(textLines(button)).toHaveLength(1);
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
    expect(textLines(button)).toHaveLength(1);
  });

  it('renders a secondary line of 0 (a number is content)', () => {
    render(<CompoundButton secondaryText={0}>Items</CompoundButton>);
    expect(textLines(screen.getByRole('button', { name: /^Items\s*0$/ }))).toHaveLength(2);
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

  it('stacks the label above the secondary text in a text wrapper', () => {
    render(<CompoundButton secondaryText="Details">Main</CompoundButton>);
    const button = screen.getByRole('button', { name: /Main/ });
    // The text lines sit in one column wrapper; the root is a start-aligned row (room for an icon).
    expect(button).toHaveClass('h-auto', 'items-center', 'justify-start', 'gap-3', 'text-start');
    expect(button).not.toHaveClass('h-8');
    expect(button).not.toHaveClass('flex-col');
    expect(button).not.toHaveClass('justify-center');
    const wrapper = contentWrapper(button);
    expect(Array.from(button.children)).toEqual([wrapper]);
    expect(wrapper).toHaveClass('flex', 'min-w-0', 'flex-col', 'items-start');
    expect(textLines(button).map((line) => line.textContent)).toEqual(['Main', 'Details']);
  });

  describe('icon', () => {
    const SIZES: Size[] = ['extra-small', 'small', 'medium', 'large', 'extra-large'];
    const iconBox: Record<Size, string> = {
      'extra-small': 'size-6',
      small: 'size-8',
      medium: 'size-10',
      large: 'size-10',
      'extra-large': 'size-10',
    };

    it.each([
      ['by default', undefined],
      ['with iconPosition="before"', 'before'],
    ] as const)('renders the icon before the text wrapper %s', (_name, iconPosition) => {
      render(
        <CompoundButton
          icon={<MailIcon />}
          iconPosition={iconPosition}
          secondaryText="Opens your email client"
        >
          Send mail
        </CompoundButton>,
      );
      const button = screen.getByRole('button', { name: /^Send mail/ });
      const icon = screen.getByTestId('mail-icon').parentElement;
      expect(Array.from(button.children)).toEqual([icon, contentWrapper(button)]);
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders the icon after the text wrapper with iconPosition="after"', () => {
      render(
        <CompoundButton icon={<MailIcon />} iconPosition="after" secondaryText="Opens a new window">
          Compose
        </CompoundButton>,
      );
      const button = screen.getByRole('button', { name: /^Compose/ });
      const icon = screen.getByTestId('mail-icon').parentElement;
      expect(Array.from(button.children)).toEqual([contentWrapper(button), icon]);
    });

    it('keeps the icon out of the accessible name: main text plus secondary text', () => {
      render(
        <CompoundButton icon={{ children: '✉' }} secondaryText="Opens your email client">
          Send mail
        </CompoundButton>,
      );
      expect(
        screen.getByRole('button', { name: /^Send mail\s*Opens your email client$/ }),
      ).toBeInTheDocument();
    });

    it.each(SIZES)('the %s icon box fills its SVG', (size) => {
      render(
        <CompoundButton size={size} icon={<MailIcon />}>
          Send mail
        </CompoundButton>,
      );
      expect(screen.getByTestId('mail-icon').parentElement).toHaveClass(
        iconBox[size],
        '[&>svg]:size-full',
        'shrink-0',
      );
    });

    it('an icon that renders nothing renders no icon box', () => {
      render(<CompoundButton icon="">Send mail</CompoundButton>);
      const button = screen.getByRole('button', { name: 'Send mail' });
      expect(button.querySelector('[aria-hidden]')).toBeNull();
      expect(Array.from(button.children)).toEqual([contentWrapper(button)]);
    });

    it('keeps the DOM order in RTL', () => {
      renderWithProviders(
        <CompoundButton icon={<MailIcon />} secondaryText="Details">
          Send mail
        </CompoundButton>,
        { dir: 'rtl' },
      );
      const button = screen.getByRole('button', { name: /^Send mail/ });
      expect(button.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(button.firstElementChild).toBe(screen.getByTestId('mail-icon').parentElement);
    });

    describe('icon only (no label and no secondary text)', () => {
      it.each(SIZES)(
        'renders no wrapper and has the size classes of an icon-only Button (%s)',
        (size) => {
          render(
            <>
              <CompoundButton size={size} icon={<MailIcon />} aria-label="Send mail" />
              <Button size={size} icon={<MailIcon />} aria-label="Send" />
            </>,
          );
          const compound = screen.getByRole('button', { name: 'Send mail' });
          const button = screen.getByRole('button', { name: 'Send' });
          expect(compound.querySelector('[data-wave-compound-content]')).toBeNull();
          expect(compound.childNodes).toHaveLength(1);
          expect(Array.from(compound.classList).sort()).toEqual(
            Array.from(button.classList).sort(),
          );
          for (const cls of ['h-auto', 'gap-3', 'justify-start', 'py-2']) {
            expect(compound).not.toHaveClass(cls);
          }
        },
      );

      it('iconPosition has no effect on it', () => {
        render(<CompoundButton icon={<MailIcon />} iconPosition="after" aria-label="Send mail" />);
        expect(screen.getByRole('button', { name: 'Send mail' }).childNodes).toHaveLength(1);
      });

      it('warns once without an accessible name, like an icon-only Button', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<CompoundButton icon={<MailIcon />} secondaryText="" />);
        expect(warn.mock.calls).toEqual([[ICON_ONLY_WARNING]]);
      });

      it('does not warn when named with aria-label', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        render(<CompoundButton icon={<MailIcon />} aria-label="Send mail" />);
        expect(screen.getByRole('button', { name: 'Send mail' })).toBeInTheDocument();
        expect(warn).not.toHaveBeenCalled();
      });
    });
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

  it('disabledFocusable: focusable, the three attributes, and activation prevented', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <CompoundButton disabledFocusable secondaryText="Opens your email client" onClick={onClick}>
          Send mail
        </CompoundButton>
      </div>,
    );
    const button = screen.getByRole('button', { name: /^Send mail/ });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-disabled', '');
    expect(button).toHaveAttribute('data-disabled-focusable', '');
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onParentClick).not.toHaveBeenCalled();
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
        | 'secondaryText'
        | 'appearance'
        | 'size'
        | 'disabled'
        | 'disabledFocusable'
        | 'icon'
        | 'iconPosition'
      >();
      expectTypeOf<CompoundButtonProps['icon']>().toEqualTypeOf<Slot<'span'> | undefined>();
      expectTypeOf<CompoundButtonProps<'a'>['iconPosition']>().toEqualTypeOf<
        IconPosition | undefined
      >();
    });
  });
});
