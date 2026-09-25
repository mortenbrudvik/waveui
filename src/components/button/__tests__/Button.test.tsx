import { describe, it, expect, expectTypeOf, vi, afterEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import type { ButtonOwnProps, ButtonProps } from '../Button';
import {
  testSystemProps,
  testFocusEvents,
  testNoImplicitSubmit,
  renderWithProviders,
} from '../../../test-utils';
import type { Appearance, Size, Slot } from '../../../lib/types';

const HOVER_GATE = 'not-disabled:not-aria-disabled:hover:';
const ACTIVE_GATE = 'not-disabled:not-aria-disabled:active:';

/** The development warning of an icon-only button without an accessible name. */
const ICON_ONLY_WARNING =
  '[WaveUI] Button: an icon-only button has no accessible name. Pass `aria-label`, `aria-labelledby` or `title` (the icon is decorative and hidden from assistive technology).';

/** A router-link stand-in: a custom component that renders an anchor and spreads its props. */
interface FakeRouterLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  ref?: React.Ref<HTMLAnchorElement>;
}
const FakeRouterLink = ({ to, ...rest }: FakeRouterLinkProps) => <a href={to} {...rest} />;

const PaperclipIcon = () => (
  <svg data-testid="paperclip" viewBox="0 0 16 16" width="16" height="16">
    <path d="M2 2h12v12H2z" fill="currentColor" />
  </svg>
);

/** A wrapper that forwards `type` explicitly, so the Button receives `type={undefined}`. */
const TypeForwardingButton = ({ type, ...props }: ButtonProps) => <Button type={type} {...props} />;

describe('Button', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The `as` variants render other elements, so the props are typed for any element.
  testSystemProps<ButtonProps<React.ElementType>>(Button, {
    expectedTag: 'button',
    displayName: 'Button',
    polymorphic: true,
    defaultProps: { children: 'Click me' },
    conflictingClass: { className: 'px-8', overrides: 'px-3' },
    a11yVariants: [
      { name: 'disabled', props: { disabled: true } },
      { name: 'primary', props: { appearance: 'primary' } },
      { name: 'with icon', props: { icon: { children: '📎' } } },
      {
        name: 'icon only with aria-label',
        props: { icon: <PaperclipIcon />, children: undefined, 'aria-label': 'Attach' },
      },
      { name: 'as anchor', props: { as: 'a', href: '/docs' } },
      { name: 'as anchor, disabled', props: { as: 'a', href: '/docs', disabled: true } },
      { name: 'as div', props: { as: 'div' } },
      { name: 'as div, disabled', props: { as: 'div', disabled: true } },
    ],
  });

  testFocusEvents(Button, { children: 'Click me' });

  testNoImplicitSubmit(Button, { defaultProps: { children: 'Save' } });

  describe('a wrapper that forwards type={undefined} (button-provider#1)', () => {
    testNoImplicitSubmit(TypeForwardingButton, { defaultProps: { children: 'Save' } });
  });

  it('renders without crashing', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('defaults to type="button" and lets the consumer choose another type', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    rerender(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('keeps type="button" when a wrapper forwards type={undefined} inside a form (button-provider#1)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit} aria-label="Order">
        <TypeForwardingButton>Add item</TypeForwardingButton>
        <TypeForwardingButton type="submit">Place order</TypeForwardingButton>
      </form>,
    );
    const add = screen.getByRole('button', { name: 'Add item' });
    expect(add).toHaveAttribute('type', 'button');
    await user.click(add);
    expect(onSubmit).not.toHaveBeenCalled();

    // An explicit type still wins over the default.
    await user.click(screen.getByRole('button', { name: 'Place order' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('applies type, role and tabIndex defaults when an untyped caller passes null', () => {
    // TypeScript rejects null here; JavaScript callers can still pass it.
    const nullType = { type: null } as unknown as { type?: 'button' };
    const nullRole = { role: null, tabIndex: null } as unknown as {
      role?: string;
      tabIndex?: number;
    };
    render(
      <>
        <Button {...nullType}>Save</Button>
        <Button as="div" {...nullRole}>
          Open
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
    const div = screen.getByRole('button', { name: 'Open' });
    expect(div.tagName).toBe('DIV');
    expect(div).toHaveAttribute('tabindex', '0');
  });

  describe('appearance (button-provider#3, #10, #26)', () => {
    const distinguishing: Record<Appearance, { has: string[]; lacks: string[] }> = {
      primary: {
        has: [
          'bg-primary',
          'text-primary-foreground',
          `${HOVER_GATE}bg-primary-hover`,
          `${ACTIVE_GATE}bg-primary-pressed`,
        ],
        lacks: ['text-white', 'bg-background', 'border-stroke'],
      },
      outline: {
        has: [
          'border',
          'border-stroke',
          'bg-background',
          'text-foreground',
          `${HOVER_GATE}bg-subtle-hover`,
          `${ACTIVE_GATE}bg-subtle-pressed`,
        ],
        lacks: ['bg-primary', 'text-primary'],
      },
      subtle: {
        has: [
          'bg-transparent',
          'text-foreground',
          `${HOVER_GATE}bg-subtle-hover`,
          `${ACTIVE_GATE}bg-subtle-pressed`,
        ],
        lacks: ['border-stroke', 'text-primary', `${HOVER_GATE}underline`],
      },
      transparent: {
        has: ['bg-transparent', 'text-primary', `${HOVER_GATE}underline`],
        lacks: ['text-foreground', `${HOVER_GATE}bg-subtle-hover`, 'border-stroke'],
      },
    };

    it.each(Object.keys(distinguishing) as Appearance[])(
      'renders the %s appearance with its distinguishing token classes',
      (appearance) => {
        render(<Button appearance={appearance}>Label</Button>);
        const button = screen.getByRole('button', { name: 'Label' });
        expect(button).toHaveClass(...distinguishing[appearance].has);
        for (const cls of distinguishing[appearance].lacks) {
          expect(button).not.toHaveClass(cls);
        }
      },
    );

    it('renders with outline appearance by default', () => {
      render(<Button>Outline</Button>);
      expect(screen.getByRole('button', { name: 'Outline' })).toHaveClass(
        'border',
        'border-stroke',
        'bg-background',
        'text-foreground',
      );
    });

    it.each(Object.keys(distinguishing) as Appearance[])(
      'the %s appearance uses only theme tokens and gated hover/pressed classes (never `enabled:`)',
      (appearance) => {
        render(<Button appearance={appearance}>Label</Button>);
        for (const cls of Array.from(screen.getByRole('button', { name: 'Label' }).classList)) {
          expect(cls).not.toMatch(/\[#[0-9a-f]{3,8}\]|rgba?\(|-(white|black)\b/i);
          expect(cls).not.toMatch(/(^|:|-)enabled:/);
          if (/(^|:)hover:/.test(cls)) expect(cls.startsWith(HOVER_GATE), cls).toBe(true);
          if (/(^|:)active:/.test(cls)) expect(cls.startsWith(ACTIVE_GATE), cls).toBe(true);
        }
      },
    );

    it('a hover color override uses the gate prefix, which replaces the built-in hover class (button-provider#3)', () => {
      render(
        <Button
          appearance="primary"
          className={`${HOVER_GATE}bg-error ${ACTIVE_GATE}bg-error-tint`}
        >
          Delete
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button).toHaveClass(`${HOVER_GATE}bg-error`, `${ACTIVE_GATE}bg-error-tint`);
      expect(button).not.toHaveClass(`${HOVER_GATE}bg-primary-hover`);
      expect(button).not.toHaveClass(`${ACTIVE_GATE}bg-primary-pressed`);
    });

    it('an important hover override is kept next to the gated class and wins by !important (button-provider#3)', () => {
      render(
        <Button appearance="primary" className="hover:bg-error!">
          Delete
        </Button>,
      );
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
        'hover:bg-error!',
        `${HOVER_GATE}bg-primary-hover`,
      );
    });

    it('documents the pitfall: a bare hover: class does not replace the gated class (higher specificity)', () => {
      render(
        <Button appearance="primary" className="hover:bg-error">
          Delete
        </Button>,
      );
      // Both stay; `:not(:disabled):not([aria-disabled="true"]):hover` (0,4,0) beats `:hover` (0,2,0).
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
        'hover:bg-error',
        `${HOVER_GATE}bg-primary-hover`,
      );
    });
  });

  describe('size (button-provider#19)', () => {
    const heights: Record<Size, string> = {
      'extra-small': 'h-5',
      small: 'h-6',
      medium: 'h-8',
      large: 'h-10',
      'extra-large': 'h-12',
    };

    it.each(Object.keys(heights) as Size[])('renders the %s size', (size) => {
      render(<Button size={size}>Label</Button>);
      expect(screen.getByRole('button', { name: 'Label' })).toHaveClass(heights[size], 'min-w-24');
    });

    it('renders small size', () => {
      render(<Button size="small">Small</Button>);
      expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('h-6', 'text-caption-1');
    });

    it('renders large size', () => {
      render(<Button size="large">Large</Button>);
      expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('h-10', 'text-body-2');
    });

    it('extra-large uses a larger font than large', () => {
      render(
        <>
          <Button size="large">Large</Button>
          <Button size="extra-large">Extra large</Button>
        </>,
      );
      const large = screen.getByRole('button', { name: 'Large' });
      const extraLarge = screen.getByRole('button', { name: 'Extra large' });
      expect(large).toHaveClass('text-body-2');
      // 18px (px like the rest of the ramp), not 0.4's text-sm or a rem size (button-provider#19).
      expect(extraLarge).toHaveClass('text-[18px]/[24px]');
      expect(extraLarge).not.toHaveClass('text-body-2');
      expect(extraLarge).not.toHaveClass('text-sm');
      expect(extraLarge).not.toHaveClass('text-lg');
    });

    it('keeps its type-ramp font size when the consumer adds a text color class (table-core#1)', () => {
      render(<Button className="text-error">Delete</Button>);
      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button).toHaveClass('text-body-1', 'text-error');
      expect(button).not.toHaveClass('text-foreground');
    });

    it('lets a consumer font-size class win over the size default', () => {
      render(<Button className="text-sm">Small text</Button>);
      const button = screen.getByRole('button', { name: 'Small text' });
      expect(button).toHaveClass('text-sm');
      expect(button).not.toHaveClass('text-body-1');
    });
  });

  describe('polymorphic `as` (button-provider#8, #9)', () => {
    it('renders as a different element via as prop', () => {
      render(
        <Button as="a" data-testid="btn" href="#">
          Link Button
        </Button>,
      );
      expect(screen.getByTestId('btn').tagName.toLowerCase()).toBe('a');
    });

    it('as="a" renders a link that keeps the gated hover class and no button attributes', () => {
      render(
        <Button as="a" href="/docs">
          Docs
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/docs');
      expect(link).not.toHaveAttribute('type');
      expect(link).not.toHaveAttribute('disabled');
      expect(link).not.toHaveAttribute('role');
      expect(link).not.toHaveAttribute('tabindex');
      expect(link).toHaveClass(`${HOVER_GATE}bg-subtle-hover`, `${ACTIVE_GATE}bg-subtle-pressed`);
      expect(link).toHaveClass('no-underline');
    });

    it('as="a" disabled: aria-disabled, no href, not focusable and clicks are prevented', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <>
          <button type="button">Before</button>
          <Button as="a" href="/checkout" disabled onClick={onClick}>
            Checkout
          </Button>
        </>,
      );
      const link = screen.getByRole('link', { name: 'Checkout' });
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('disabled');
      expect(link).not.toHaveAttribute('href');
      expect(link).toHaveClass('opacity-50', 'cursor-not-allowed');

      // fireEvent returns false when the default action was prevented.
      expect(fireEvent.click(link)).toBe(false);
      expect(fireEvent.keyDown(link, { key: 'Enter' })).toBe(false);
      expect(onClick).not.toHaveBeenCalled();

      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(link).not.toHaveFocus();
    });

    it('as="a" disabled cannot be made focusable again by a consumer tabIndex', () => {
      render(
        <Button as="a" href="/checkout" disabled tabIndex={0}>
          Checkout
        </Button>,
      );
      expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('tabindex', '-1');
    });

    it('as="a" restores href and focusability when re-enabled', () => {
      const { rerender } = render(
        <Button as="a" href="/checkout" disabled>
          Checkout
        </Button>,
      );
      expect(screen.getByRole('link', { name: 'Checkout' })).not.toHaveAttribute('href');
      rerender(
        <Button as="a" href="/checkout">
          Checkout
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Checkout' });
      expect(link).toHaveAttribute('href', '/checkout');
      expect(link).not.toHaveAttribute('aria-disabled');
      expect(link).not.toHaveAttribute('tabindex');
      expect(link).not.toHaveAttribute('role');
    });

    it('as="div" gets role="button", a tab stop and Enter/Space activation', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button as="div" onClick={onClick}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button.tagName).toBe('DIV');
      expect(button).toHaveAttribute('tabindex', '0');
      expect(button).not.toHaveAttribute('type');

      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.keyboard(' ');
      expect(onClick).toHaveBeenCalledTimes(2);
      await user.click(button);
      expect(onClick).toHaveBeenCalledTimes(3);
    });

    it('as="div" activates Space on keyup (like a native button) and prevents page scroll', () => {
      const onClick = vi.fn();
      render(
        <Button as="div" onClick={onClick}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(fireEvent.keyDown(button, { key: ' ' })).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('as="div": a consumer onKeyDown runs first and can suppress activation with preventDefault', () => {
      const onClick = vi.fn();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
      render(
        <Button as="div" onClick={onClick} onKeyDown={onKeyDown}>
          Open
        </Button>,
      );
      fireEvent.keyDown(screen.getByRole('button', { name: 'Open' }), { key: 'Enter' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div": a Space keyup without a preceding keydown does not activate (button-provider#9)', () => {
      const onClick = vi.fn();
      render(
        <Button as="div" onClick={onClick}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();

      // A keydown/keyup pair activates once; the keyup disarms, so a second keyup alone does not.
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('as="div": a consumer preventDefault on the Space keydown cancels the keyup activation (button-provider#9)', () => {
      const onClick = vi.fn();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => {
        if (event.key === ' ') event.preventDefault();
      });
      render(
        <Button as="div" onClick={onClick} onKeyDown={onKeyDown}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div": a consumer preventDefault on the Space keyup cancels the activation', () => {
      const onClick = vi.fn();
      const onKeyUp = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
      render(
        <Button as="div" onClick={onClick} onKeyUp={onKeyUp}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
      // The prevented keyup still disarmed the button.
      onKeyUp.mockImplementation(() => {});
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div": moving focus away between Space keydown and keyup cancels the activation', () => {
      const onClick = vi.fn();
      const onBlur = vi.fn();
      render(
        <>
          <Button as="div" onClick={onClick} onBlur={onBlur}>
            Open
          </Button>
          <button type="button">Elsewhere</button>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      button.focus();
      fireEvent.keyDown(button, { key: ' ' });
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
      expect(onBlur).toHaveBeenCalledTimes(1);
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div": a Space keydown inside a descendant does not arm the button', () => {
      const onClick = vi.fn();
      render(
        <Button as="div" onClick={onClick}>
          <span data-testid="inner">Open</span>
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      fireEvent.keyDown(screen.getByTestId('inner'), { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div" keeps role="button" and its tab stop when role/tabIndex are forwarded as undefined (button-provider#1)', () => {
      render(
        <Button as="div" role={undefined} tabIndex={undefined}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button.tagName).toBe('DIV');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('as="a" disabled keeps role="link" when role is forwarded as undefined', () => {
      render(
        <Button as="a" href="/docs" disabled role={undefined}>
          Docs
        </Button>,
      );
      expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('aria-disabled', 'true');
    });

    it('as="div": keys pressed inside a descendant do not activate the button', () => {
      const onClick = vi.fn();
      render(
        <Button as="div" onClick={onClick}>
          <input aria-label="Inner" />
        </Button>,
      );
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Inner' }), { key: 'Enter' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('as="div" lets the consumer override the default role and tabIndex', () => {
      render(
        <Button as="div" role="menuitem" tabIndex={-1}>
          Item
        </Button>,
      );
      expect(screen.getByRole('menuitem', { name: 'Item' })).toHaveAttribute('tabindex', '-1');
    });

    it('as="div" disabled: aria-disabled, not focusable, and Enter/Space/click do nothing', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <>
          <button type="button">Before</button>
          <Button as="div" disabled onClick={onClick} tabIndex={0}>
            Open
          </Button>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '-1');
      expect(button).not.toHaveAttribute('disabled');

      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(false);
      expect(fireEvent.keyDown(button, { key: ' ' })).toBe(false);
      fireEvent.keyUp(button, { key: ' ' });
      expect(fireEvent.click(button)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();

      screen.getByRole('button', { name: 'Before' }).focus();
      await user.tab();
      expect(button).not.toHaveFocus();
    });

    it.each(['div', 'a'] as const)(
      'a disabled as="%s" does not let the click reach ancestor onClick handlers (like a native disabled button)',
      (tag) => {
        const onParentClick = vi.fn();
        const onClick = vi.fn();
        render(
          <div onClick={onParentClick}>
            {tag === 'a' ? (
              <Button as="a" href="/docs" disabled onClick={onClick}>
                Target
              </Button>
            ) : (
              <Button as="div" disabled onClick={onClick}>
                Target
              </Button>
            )}
          </div>,
        );
        const target = screen.getByText('Target');
        expect(fireEvent.click(target)).toBe(false);
        expect(onClick).not.toHaveBeenCalled();
        expect(onParentClick).not.toHaveBeenCalled();
      },
    );

    it('a disabled button keeps Tab and other non-activation keys working', () => {
      const onKeyDown = vi.fn();
      render(
        <Button as="div" disabled onKeyDown={onKeyDown}>
          Open
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Open' });
      expect(fireEvent.keyDown(button, { key: 'Tab' })).toBe(true);
      expect(onKeyDown).toHaveBeenCalledTimes(1);
    });

    it('a custom component `as` (router link) gets aria-disabled instead of `disabled`', () => {
      const onClick = vi.fn();
      render(
        <Button as={FakeRouterLink} to="/home" disabled onClick={onClick}>
          Home
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).toHaveAttribute('href', '/home');
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('disabled');
      expect(fireEvent.click(link)).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('a custom component `as` that renders a native <button> (styled/motion component) gets aria-disabled instead of `disabled`', async () => {
      const user = userEvent.setup();
      const received: Array<Record<string, unknown>> = [];
      const StyledButton = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
        received.push({ ...props });
        return <button type="button" {...props} />;
      };
      const onClick = vi.fn();
      const onKeyDown = vi.fn();
      render(
        <>
          <Button as={StyledButton} disabled onClick={onClick} onKeyDown={onKeyDown}>
            Save
          </Button>
          <button type="button">After</button>
        </>,
      );
      const button = screen.getByRole('button', { name: 'Save' });
      // The component never receives `disabled`, so its native :disabled state and styling are off.
      expect(received.at(-1)).not.toHaveProperty('disabled');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('tabindex', '-1');
      expect(fireEvent.click(button)).toBe(false);
      expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(false);
      expect(fireEvent.keyDown(button, { key: ' ' })).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
      expect(onKeyDown).not.toHaveBeenCalled();
      // Out of the tab order (a mouse click can still focus it, like any tabindex=-1 element).
      await user.tab();
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('a custom component `as` gets no role or tab stop when enabled', () => {
      render(
        <Button as={FakeRouterLink} to="/home">
          Home
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Home' });
      expect(link).not.toHaveAttribute('role');
      expect(link).not.toHaveAttribute('tabindex');
      expect(link).not.toHaveAttribute('type');
    });

    it('forwards the ref to the rendered anchor', () => {
      const ref = React.createRef<HTMLAnchorElement>();
      render(
        <Button as="a" href="/docs" ref={ref}>
          Docs
        </Button>,
      );
      expect(ref.current).toBe(screen.getByRole('link', { name: 'Docs' }));
    });

    it('as="input" renders a void element without children', () => {
      render(<Button as="input" type="button" value="Go" />);
      const input = screen.getByRole('button', { name: 'Go' });
      expect(input.tagName).toBe('INPUT');
    });
  });

  describe('icon slot (button-provider#21, data-display#31)', () => {
    it('renders icon as ReactNode shorthand inside an aria-hidden span', () => {
      render(<Button icon={<span data-testid="icon">X</span>}>With Icon</Button>);
      const icon = screen.getByTestId('icon');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
      expect(icon.parentElement).toHaveClass('inline-flex', 'shrink-0');
    });

    it('renders icon as SlotObject', () => {
      render(
        <Button
          icon={{ children: <span data-testid="slot-icon">I</span>, className: 'custom-icon' }}
        >
          Slot Icon
        </Button>,
      );
      const icon = screen.getByTestId('slot-icon');
      expect(icon.parentElement).toHaveClass('custom-icon', 'shrink-0');
      expect(icon.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('keeps icon text and emoji out of the accessible name', () => {
      render(<Button icon={{ children: '📎' }}>Attach</Button>);
      expect(screen.getByRole('button', { name: 'Attach' })).toBeInTheDocument();
    });

    it('lets the slot object opt out of aria-hidden', () => {
      render(<Button icon={{ children: '★', 'aria-hidden': false }}>Star</Button>);
      expect(screen.getByRole('button', { name: /^★\s*Star$/ })).toBeInTheDocument();
    });

    it('adds a gap only when there is both an icon and a label', () => {
      const { rerender } = render(<Button icon={<PaperclipIcon />}>Attach</Button>);
      expect(screen.getByRole('button', { name: 'Attach' })).toHaveClass('gap-1.5');
      rerender(<Button>Attach</Button>);
      expect(screen.getByRole('button', { name: 'Attach' })).not.toHaveClass('gap-1.5');
    });

    it('an icon-only button is square and has no minimum width', () => {
      render(<Button icon={<PaperclipIcon />} aria-label="Attach" size="large" />);
      const button = screen.getByRole('button', { name: 'Attach' });
      expect(button).toHaveClass('h-10', 'w-10');
      expect(button).not.toHaveClass('min-w-24');
    });

    it('warns once in development when icon-only buttons have no accessible name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Two separate nameless icon-only buttons: each runs the effect, one warning in total.
      const { rerender } = render(
        <>
          <Button icon={<PaperclipIcon />} />
          <Button icon={<PaperclipIcon />} appearance="primary" />
        </>,
      );
      expect(warn.mock.calls).toEqual([[ICON_ONLY_WARNING]]);

      // Changing an effect dependency re-runs the check (named, then nameless again): still one.
      rerender(
        <>
          <Button icon={<PaperclipIcon />} aria-label="Attach" />
          <Button icon={<PaperclipIcon />} appearance="primary" />
        </>,
      );
      rerender(
        <>
          <Button icon={<PaperclipIcon />} aria-label="" />
          <Button icon={<PaperclipIcon />} appearance="primary" />
        </>,
      );
      expect(warn.mock.calls).toEqual([[ICON_ONLY_WARNING]]);
    });

    it('treats an empty-string icon (icon={name && <Icon />}) as no icon (button-provider#21)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { container, rerender } = render(<Button icon="">Attach</Button>);
      const labelled = screen.getByRole('button', { name: 'Attach' });
      expect(container.querySelector('[aria-hidden]')).toBeNull();
      expect(labelled).not.toHaveClass('gap-1.5');
      expect(labelled.childNodes).toHaveLength(1);

      // Without children it is an empty, regular-width button: not square, no icon-only warning.
      rerender(<Button icon="" aria-label="Empty" />);
      const unlabelled = screen.getByRole('button', { name: 'Empty' });
      expect(unlabelled).toHaveClass('min-w-24');
      expect(unlabelled).not.toHaveClass('w-8');
      rerender(<Button icon="" />);
      expect(screen.getByRole('button')).toHaveClass('min-w-24');
      expect(container.querySelector('[aria-hidden]')).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty array', []],
      ['an empty Fragment', <React.Fragment key="empty" />],
    ])('treats %s icon as no icon', (_name, icon) => {
      const { container } = render(<Button icon={icon}>Attach</Button>);
      expect(container.querySelector('[aria-hidden]')).toBeNull();
      expect(screen.getByRole('button', { name: 'Attach' })).not.toHaveClass('gap-1.5');
    });

    it('does not count an empty Fragment as a label (button-provider#21)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <Button icon={<PaperclipIcon />} size="large">
          <></>
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10', 'w-10');
      expect(button).not.toHaveClass('min-w-24');
      expect(button).not.toHaveClass('gap-1.5');
      expect(warn.mock.calls).toEqual([[ICON_ONLY_WARNING]]);
    });

    it('counts a Fragment with text as a label', () => {
      render(
        <Button icon={<PaperclipIcon />}>
          <>Attach</>
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Attach' });
      expect(button).toHaveClass('gap-1.5', 'min-w-24');
    });

    // The icon and the label follow the library's one renders-nothing rule. A generator is read
    // once by the check; its items are what renders.
    describe('icon and label content that renders nothing', () => {
      function* items(...values: React.ReactNode[]): Generator<React.ReactNode> {
        yield* values;
      }

      const ICON_CASES: ReadonlyArray<readonly [string, boolean, () => Slot<'span'> | undefined]> =
        [
          ['undefined', false, () => undefined],
          ['null', false, () => null],
          ['false', false, () => false],
          ['true', false, () => true],
          ['an empty string', false, () => ''],
          ['an empty array', false, () => []],
          ['an empty Fragment', false, () => <></>],
          ['an array of empty values', false, () => [<React.Fragment key="a" />, '', null, false]],
          ['a Fragment of empty values', false, () => <>{['', null]}</>],
          ['an empty Set', false, () => new Set()],
          ['a Set of empty values', false, () => new Set(['', <React.Fragment key="f" />])],
          ['a generator of empty values', false, () => items('', null)],
          ['an element', true, () => <PaperclipIcon />],
          ['a string', true, () => '⚙'],
          ['zero', true, () => 0],
          ['an array with an element', true, () => ['', <PaperclipIcon key="clip" />]],
          [
            'a Fragment with an element',
            true,
            () => (
              <>
                <PaperclipIcon />
              </>
            ),
          ],
          ['a slot object', true, () => ({ children: <PaperclipIcon /> })],
          ['an empty slot object', true, () => ({})],
          ['a Set with an element', true, () => new Set([<PaperclipIcon key="clip" />])],
          ['a generator with an element', true, () => items(<PaperclipIcon key="clip" />)],
        ];

      it.each(ICON_CASES)(
        'an icon of %s renders an icon element: %s',
        (_name, renders, makeIcon) => {
          const error = vi.spyOn(console, 'error');
          render(<Button icon={makeIcon()} aria-label="Attach" />);
          const button = screen.getByRole('button', { name: 'Attach' });
          expect(button.childNodes).toHaveLength(renders ? 1 : 0);
          expect(button.querySelector('[aria-hidden="true"]') !== null).toBe(renders);
          expect(error).not.toHaveBeenCalled();
        },
      );

      /** Rows: the label, the text it renders (`null`: no label), a factory for a fresh value. */
      const LABEL_CASES: ReadonlyArray<readonly [string, string | null, () => React.ReactNode]> = [
        ['undefined', null, () => undefined],
        ['null', null, () => null],
        ['false', null, () => false],
        ['an empty string', null, () => ''],
        ['an empty array', null, () => []],
        ['an empty Fragment', null, () => <></>],
        ['nested empty values', null, () => [<React.Fragment key="a">{''}</React.Fragment>, null]],
        ['a Set of empty values', null, () => new Set(['', null])],
        ['a generator of empty values', null, () => items('', false)],
        ['text', 'Attach', () => 'Attach'],
        ['zero', '0', () => 0],
        ['an element', 'Attach', () => <span>Attach</span>],
        ['a Fragment with text', 'Attach', () => <>Attach</>],
        ['a generator with text', 'Attach', () => items('Attach')],
      ];

      it.each(LABEL_CASES)('a label of %s renders %s', (_name, text, makeLabel) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error');
        render(
          <Button icon={<PaperclipIcon />} size="large">
            {makeLabel()}
          </Button>,
        );
        const button = screen.getByRole('button');
        if (text === null) {
          expect(button).toHaveClass('h-10', 'w-10');
          expect(button).toHaveTextContent(/^$/);
          expect(warn.mock.calls).toEqual([[ICON_ONLY_WARNING]]);
        } else {
          expect(button).toHaveClass('gap-1.5', 'min-w-24');
          expect(button).toHaveTextContent(new RegExp(`^${text}$`));
          expect(warn).not.toHaveBeenCalled();
        }
        expect(error).not.toHaveBeenCalled();
      });

      it('renders the items of a label given as a generator', () => {
        const error = vi.spyOn(console, 'error');
        render(<Button>{items('Save ', <b key="draft">draft</b>)}</Button>);
        expect(screen.getByRole('button', { name: 'Save draft' })).toBeVisible();
        expect(error).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['aria-label', { 'aria-label': 'Attach' }],
      ['aria-labelledby', { 'aria-labelledby': 'label-id' }],
      ['title', { title: 'Attach' }],
      ['a text label', { children: 'Attach' }],
    ])('does not warn when the icon button has %s', (_name, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <>
          <span id="label-id">Attach</span>
          <Button icon={<PaperclipIcon />} {...props} />
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it('applies disabled state', () => {
      render(
        <Button disabled data-testid="btn">
          Disabled
        </Button>,
      );
      const button = screen.getByTestId('btn');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(button).not.toHaveAttribute('aria-disabled');
      expect(button).not.toHaveAttribute('tabindex');
    });

    it('a consumer aria-disabled keeps the button focusable but shows the disabled look', () => {
      render(<Button aria-disabled="true">Not yet</Button>);
      const button = screen.getByRole('button', { name: 'Not yet' });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('a consumer aria-disabled stays in the tab order and does not block its handlers (spec §7.3, C-DISABLED)', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const onKeyDown = vi.fn();
      render(
        <Button aria-disabled="true" onClick={onClick} onKeyDown={onKeyDown}>
          Not yet
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Not yet' });
      expect(button).not.toHaveAttribute('tabindex');

      await user.tab();
      expect(button).toHaveFocus();

      // Button does not guard the handlers: the consumer that sets aria-disabled guards them.
      await user.keyboard('{Enter}');
      await user.click(button);
      expect(onKeyDown).toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick}>
          Disabled
        </Button>,
      );
      await user.click(screen.getByRole('button', { name: 'Disabled' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('calls onClick handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('inherits the provider theme through tokens (no fixed colors)', () => {
    renderWithProviders(<Button appearance="primary">Save</Button>, { theme: 'dark' });
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.closest('.wave-dark')).not.toBeNull();
    expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  describe('types (button-provider#8, #27)', () => {
    it('as="a" accepts anchor props and types handlers for the anchor', () => {
      const onAnchorClick = (event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault();
      const anchorRef = React.createRef<HTMLAnchorElement>();
      render(
        <>
          <Button as="a" href="/docs" target="_blank" rel="noreferrer">
            Docs
          </Button>
          <Button as="a" href="/feed" type="text/html" onClick={onAnchorClick} ref={anchorRef}>
            Feed
          </Button>
          <Button as={FakeRouterLink} to="/home" target="_self">
            Home
          </Button>
        </>,
      );
      expect(anchorRef.current).toBe(screen.getByRole('link', { name: 'Feed' }));
    });

    it('rejects button-only props on as="a" and anchor props on the default button', () => {
      const onButtonClick = (event: React.MouseEvent<HTMLButtonElement>) =>
        event.currentTarget.form;
      const elements = [
        // @ts-expect-error formAction is a <button> attribute, not an <a> attribute
        <Button key="1" as="a" href="/" formAction="/submit" />,
        // @ts-expect-error a <button> handler does not fit an anchor
        <Button key="2" as="a" href="/" onClick={onButtonClick} />,
        // @ts-expect-error href does not exist on <button>
        <Button key="3" href="/nope" />,
        // @ts-expect-error `type` on a button is 'submit' | 'reset' | 'button'
        <Button key="4" type="text/html" />,
        // @ts-expect-error `to` is required by the router link
        <Button key="5" as={FakeRouterLink} />,
        // @ts-expect-error appearance keeps its literal type
        <Button key="6" appearance="ghost" />,
      ];
      expect(elements).toHaveLength(6);
    });

    it('ButtonProps (0.4 name) is the default-tag props type, extendable, with ref (C-REF)', () => {
      interface TrackedButtonProps extends ButtonProps {
        tracking?: string;
      }
      const TrackedButton = ({ tracking, ...props }: TrackedButtonProps) => (
        <Button data-tracking={tracking} {...props} />
      );
      const ref = React.createRef<HTMLButtonElement>();
      render(
        <TrackedButton ref={ref} tracking="cta" appearance="primary">
          Buy
        </TrackedButton>,
      );
      expect(ref.current).toBe(screen.getByRole('button', { name: 'Buy' }));

      expectTypeOf<ButtonProps>().toEqualTypeOf<ButtonProps<'button'>>();
      expectTypeOf<ButtonProps>().toHaveProperty('formAction');
      expectTypeOf<ButtonProps>().toHaveProperty('ref');
      expectTypeOf<ButtonProps<'a'>>().toHaveProperty('href');
      expectTypeOf<ButtonProps['ref']>().toEqualTypeOf<React.Ref<HTMLButtonElement> | undefined>();
      expectTypeOf<ButtonProps<'a'>['ref']>().toEqualTypeOf<
        React.Ref<HTMLAnchorElement> | undefined
      >();
    });

    it('ButtonOwnProps holds only the component-specific props', () => {
      expectTypeOf<keyof ButtonOwnProps>().toEqualTypeOf<
        'appearance' | 'size' | 'icon' | 'disabled'
      >();
      expectTypeOf<ButtonOwnProps['appearance']>().toEqualTypeOf<Appearance | undefined>();
      expectTypeOf<ButtonOwnProps['size']>().toEqualTypeOf<Size | undefined>();
    });
  });
});
