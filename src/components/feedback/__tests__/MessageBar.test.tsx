import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf, afterEach } from 'vitest';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBar } from '../MessageBar';
import type { MessageBarProps } from '../MessageBar';
import { StatusIcon, StatusText } from '../MessageBar.status';
import { Button } from '../../button/Button';
import type { Slot } from '../../../lib/types';
import {
  asClientReference,
  renderWithProviders,
  testDisplayName,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

const statuses = ['info', 'success', 'warning', 'error'] as const;

/** The development warning for a `<button>` or Wave `Button` element passed as `dismiss`. */
const BUTTON_ELEMENT_WARNING =
  '[WaveUI] MessageBar: `dismiss` received a button element; its props were merged into the built-in dismiss button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.';

/** The deprecation warning for the 0.4 button-object form of `dismiss`. */
const BUTTON_OBJECT_WARNING =
  '[WaveUI] MessageBar: the button-object form of `dismiss` is deprecated and will be removed in 1.0; its button props were merged into the built-in dismiss button. Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.';

/** Records `console.warn` for one test (restored after each test); assert what it recorded. */
const spyOnWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('MessageBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  testSystemProps(MessageBar, {
    expectedTag: 'div',
    displayName: 'MessageBar',
    defaultProps: { children: 'Your changes were saved.' },
    conflictingClass: { className: 'px-8', overrides: 'px-4' },
    a11yVariants: [
      { name: 'dismissible error', props: { status: 'error', onDismiss: () => {} } },
      { name: 'warning', props: { status: 'warning' } },
      {
        name: 'custom dismiss content',
        props: { onDismiss: () => {}, dismiss: <span>x</span> },
      },
    ],
  });

  it('declares ref in the props interface (button-provider#27)', () => {
    expectTypeOf<MessageBarProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });

  it('renders children', () => {
    render(<MessageBar>Hello world</MessageBar>);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  describe('roles', () => {
    it.each([
      ['info', 'status'],
      ['success', 'status'],
      ['warning', 'alert'],
      ['error', 'alert'],
    ] as const)('status %s uses role="%s"', (status, role) => {
      render(<MessageBar status={status}>Message</MessageBar>);
      expect(screen.getByRole(role)).toHaveTextContent('Message');
    });

    it('defaults to info status with role="status"', () => {
      render(<MessageBar data-testid="bar">Info message</MessageBar>);
      expect(screen.getByTestId('bar')).toHaveAttribute('role', 'status');
      expect(screen.getByTestId('bar')).toHaveTextContent(/^Info:\s*Info message$/);
    });

    it('lets a consumer role override the default', () => {
      render(
        <MessageBar status="error" role="status">
          Message
        </MessageBar>,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Message');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('status text (feedback-navigation#4)', () => {
    it.each([
      ['info', 'Info:'],
      ['success', 'Success:'],
      ['warning', 'Warning:'],
      ['error', 'Error:'],
    ] as const)('status %s reads "%s" before the message', (status, label) => {
      render(
        <MessageBar status={status} data-testid="bar">
          Disk almost full
        </MessageBar>,
      );
      const bar = screen.getByTestId('bar');
      expect(bar).toHaveTextContent(new RegExp(`^${label}\\s*Disk almost full$`));
      const text = within(bar).getByText(label);
      expect(text).toHaveClass('sr-only');
    });

    it('statusLabel overrides the status text (i18n)', () => {
      render(
        <MessageBar status="success" statusLabel="Erfolg:" data-testid="bar">
          Gespeichert
        </MessageBar>,
      );
      expect(screen.getByTestId('bar')).toHaveTextContent(/^Erfolg:\s*Gespeichert$/);
      expect(screen.queryByText('Success:')).not.toBeInTheDocument();
    });

    it('an empty statusLabel renders no status text', () => {
      render(
        <MessageBar status="warning" statusLabel="" data-testid="bar">
          Heads up
        </MessageBar>,
      );
      expect(screen.getByTestId('bar')).toHaveTextContent(/^Heads up$/);
    });

    it.each(statuses)('the default %s icon is decorative (aria-hidden)', (status) => {
      render(
        <MessageBar status={status} data-testid="bar">
          Message
        </MessageBar>,
      );
      const icon = screen.getByTestId('bar').querySelector(`[data-wave-icon="${status}"]`);
      expect(icon).not.toBeNull();
      expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('renders a custom icon slot as decorative content (data-display#31)', () => {
      render(
        <MessageBar icon={<svg data-testid="custom-icon" />} data-testid="bar">
          Message
        </MessageBar>,
      );
      const wrapper = screen.getByTestId('custom-icon').parentElement;
      expect(wrapper?.tagName).toBe('SPAN');
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      expect(wrapper).toHaveClass('shrink-0');
      expect(screen.getByTestId('bar').querySelector('[data-wave-icon]')).toBeNull();
    });

    it('renders an object icon slot and lets it override aria-hidden', () => {
      render(
        <MessageBar icon={{ children: 'custom-icon', 'aria-hidden': false, className: 'mt-1' }}>
          Msg
        </MessageBar>,
      );
      const icon = screen.getByText('custom-icon');
      expect(icon).toHaveAttribute('aria-hidden', 'false');
      expect(icon).toHaveClass('mt-1');
      expect(icon).not.toHaveClass('mt-0.5');
    });

    it('icon={null} renders no icon', () => {
      render(
        <MessageBar icon={null} data-testid="bar">
          Msg
        </MessageBar>,
      );
      expect(screen.getByTestId('bar').querySelector('[aria-hidden="true"]')).toBeNull();
    });
  });

  describe('status tokens (button-provider#3)', () => {
    it.each([
      ['info', 'bg-info-tint', 'border-s-info', 'text-info-tint-foreground'],
      ['success', 'bg-success-tint', 'border-s-success', 'text-success-tint-foreground'],
      ['warning', 'bg-warning-tint', 'border-s-warning', 'text-warning-tint-foreground'],
      ['error', 'bg-error-tint', 'border-s-error', 'text-error-tint-foreground'],
    ] as const)('status %s uses %s, %s and an icon in %s', (status, bg, border, iconColor) => {
      render(
        <MessageBar status={status} data-testid="bar">
          Msg
        </MessageBar>,
      );
      const bar = screen.getByTestId('bar');
      expect(bar).toHaveClass(bg, border, 'border-s-4');
      const icon = bar.querySelector(`[data-wave-icon="${status}"]`);
      expect(icon?.parentElement).toHaveClass(iconColor);
    });
  });

  describe('dismiss (feedback-navigation#1, button-provider#1)', () => {
    it('renders the default dismiss button when onDismiss is provided', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(<MessageBar onDismiss={onDismiss}>Msg</MessageBar>);
      const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
      expect(dismissBtn).toHaveAttribute('type', 'button');
      expect(dismissBtn.querySelector('[data-wave-icon="dismiss"]')).not.toBeNull();
      await user.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not render a dismiss button without onDismiss or a dismiss slot', () => {
      render(<MessageBar>Msg</MessageBar>);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('dismiss={null} hides the dismiss button', () => {
      render(
        <MessageBar onDismiss={() => {}} dismiss={null}>
          Msg
        </MessageBar>,
      );
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    describe('content that renders nothing keeps the default icon (only null hides the button)', () => {
      const expectDefaultDismiss = () => {
        expect(screen.getAllByRole('button')).toHaveLength(1);
        const button = screen.getByRole('button', { name: 'Dismiss' });
        const icon = button.querySelector('[data-wave-icon="dismiss"]');
        expect(icon).not.toBeNull();
        expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
        return button;
      };

      it.each([
        ['false', false],
        ['true', true],
      ] as const)(
        'dismiss={%s} with onDismiss renders the default dismiss button',
        async (_, value) => {
          const user = userEvent.setup();
          const onDismiss = vi.fn();
          render(
            <MessageBar onDismiss={onDismiss} dismiss={value}>
              Msg
            </MessageBar>,
          );
          await user.click(expectDefaultDismiss());
          expect(onDismiss).toHaveBeenCalledTimes(1);
        },
      );

      it.each([
        ['false', false],
        ['true', true],
      ] as const)('dismiss={%s} without onDismiss renders no button (like no slot)', (_, value) => {
        render(<MessageBar dismiss={value}>Msg</MessageBar>);
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
      });

      it.each([
        ["''", ''],
        ['[]', []],
        ['an array of empty values', [null, false, '']],
        ['an empty Fragment', <React.Fragment key="f" />],
        ['a Fragment of empty values', <React.Fragment key="f">{false}</React.Fragment>],
        ['a Set of empty Fragments', new Set([<React.Fragment key="f" />])],
        ['a slot object whose children render nothing', { children: false }],
        ['a slot object whose children are an empty Fragment', { children: <></> }],
      ] as const)(
        'dismiss content %s renders the default icon, not an empty button',
        (_, dismiss) => {
          render(
            <MessageBar onDismiss={() => {}} dismiss={dismiss as MessageBarProps['dismiss']}>
              Msg
            </MessageBar>,
          );
          expectDefaultDismiss();
        },
      );

      it('a slot object with empty children styles the default icon', () => {
        render(
          <MessageBar onDismiss={() => {}} dismiss={{ children: '', className: 'text-error' }}>
            Msg
          </MessageBar>,
        );
        const icon = expectDefaultDismiss().querySelector('[data-wave-icon="dismiss"]');
        expect(icon?.parentElement).toHaveClass('text-error');
      });

      it.each([
        [
          '<button>',
          <button key="b" type="button">
            {''}
          </button>,
        ],
        ['Wave Button', <Button key="w" icon={false} />],
      ])('a %s slot whose content renders nothing shows the default icon', (_, dismiss) => {
        const warn = spyOnWarn();
        render(
          <MessageBar onDismiss={() => {}} dismiss={dismiss}>
            Msg
          </MessageBar>,
        );
        expectDefaultDismiss();
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('0 is content, not nothing', () => {
        render(
          <MessageBar onDismiss={() => {}} dismiss={0}>
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss' });
        expect(button).toHaveTextContent('0');
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
      });
    });

    describe('a slot object that brings its own content keeps it (no default icon is added)', () => {
      const HTML_ICON = '<svg data-testid="html-icon" viewBox="0 0 16 16"></svg>';

      /** An icon component that also renders its children, like icons that accept extra paths. */
      function DrawnIcon({
        className,
        children,
      }: {
        className?: string;
        children?: React.ReactNode;
      }) {
        return (
          <svg data-testid="drawn-icon" className={className} viewBox="0 0 16 16">
            {children}
          </svg>
        );
      }

      const expectOwnContent = (testId: string) => {
        const button = screen.getByRole('button', { name: 'Dismiss' });
        const content = within(button).getByTestId(testId);
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        return content;
      };

      it('renders dangerouslySetInnerHTML content in the slot element', () => {
        const error = vi.spyOn(console, 'error');
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={{ className: 'text-error', dangerouslySetInnerHTML: { __html: HTML_ICON } }}
          >
            Msg
          </MessageBar>,
        );
        const content = expectOwnContent('html-icon');
        expect(content.parentElement).toHaveClass('text-error');
        expect(content.parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(error).not.toHaveBeenCalled();
      });

      it('renders dangerouslySetInnerHTML of the deprecated button-object form inside the button', () => {
        const warn = spyOnWarn();
        const error = vi.spyOn(console, 'error');
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={{ as: 'button', dangerouslySetInnerHTML: { __html: HTML_ICON } }}
          >
            Msg
          </MessageBar>,
        );
        expect(expectOwnContent('html-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
        expect(warn.mock.calls).toEqual([[BUTTON_OBJECT_WARNING]]);
        expect(error).not.toHaveBeenCalled();
      });

      it('renders a component `as` as the icon, without the default icon inside it', () => {
        render(
          <MessageBar onDismiss={() => {}} dismiss={{ as: DrawnIcon, className: 'text-error' }}>
            Msg
          </MessageBar>,
        );
        expect(expectOwnContent('drawn-icon')).toHaveClass('text-error');
      });

      it('renders a void `as` (an img) as the icon, without the default icon or a warning', () => {
        const warn = vi.spyOn(console, 'warn');
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              { as: 'img', src: 'close.svg', alt: '', 'data-testid': 'img-icon' } as Slot<'span'>
            }
          >
            Msg
          </MessageBar>,
        );
        const image = expectOwnContent('img-icon');
        expect(image).toHaveAttribute('src', 'close.svg');
        expect(image).toHaveAttribute('aria-hidden', 'true');
        expect(warn).not.toHaveBeenCalled();
      });
    });

    describe('markup of a merged button (dangerouslySetInnerHTML)', () => {
      const HTML_ICON = '<svg data-testid="html-icon" viewBox="0 0 16 16"></svg>';

      it('renders the markup of a merged <button> inside the wired button instead of throwing', () => {
        const warn = spyOnWarn();
        const error = vi.spyOn(console, 'error');
        const onDismiss = vi.fn();
        render(
          <MessageBar
            onDismiss={onDismiss}
            dismiss={
              <button
                type="button"
                className="text-error"
                dangerouslySetInnerHTML={{ __html: HTML_ICON }}
              />
            }
          >
            Msg
          </MessageBar>,
        );
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0]).toHaveAccessibleName('Dismiss');
        expect(buttons[0]).toHaveClass('text-error');
        expect(buttons[0]).toContainElement(screen.getByTestId('html-icon'));
        expect(buttons[0].querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        fireEvent.click(buttons[0]);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
        expect(error).not.toHaveBeenCalled();
      });

      it('names the button by a text label in the markup, as it does for children', async () => {
        const warn = spyOnWarn();
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={<button type="button" dangerouslySetInnerHTML={{ __html: 'Close' }} />}
          >
            Msg
          </MessageBar>,
        );
        await waitFor(() => expect(screen.getByRole('button')).toHaveAccessibleName('Close'));
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });
    });

    it('merges a slot object whose `as` is a Wave Button instead of nesting it (deprecated form)', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar
          onDismiss={() => {}}
          dismiss={
            // Wave Button props are not part of the slot type: a JavaScript caller's 0.4 form.
            {
              as: Button,
              appearance: 'subtle',
              className: 'text-error',
              icon: <svg data-testid="button-icon" />,
            } as Slot<'span'>
          }
        >
          Msg
        </MessageBar>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName('Dismiss');
      expect(buttons[0]).toHaveClass('text-error');
      expect(buttons[0]).not.toHaveAttribute('appearance');
      expect(
        within(buttons[0]).getByTestId('button-icon').closest('[aria-hidden="true"]'),
      ).not.toBeNull();
      expect(warn.mock.calls).toEqual([[BUTTON_OBJECT_WARNING]]);
    });

    describe('a ref on the dismiss slot reaches the wired button (0.4 compatibility)', () => {
      it.each([
        [
          'a <button> element',
          (ref: React.Ref<HTMLButtonElement>) => (
            <button type="button" ref={ref}>
              Close
            </button>
          ),
          'Close',
          BUTTON_ELEMENT_WARNING,
        ],
        [
          'a Wave Button',
          (ref: React.Ref<HTMLButtonElement>) => (
            <Button appearance="subtle" ref={ref}>
              Close
            </Button>
          ),
          'Close',
          BUTTON_ELEMENT_WARNING,
        ],
        [
          'the deprecated button-object form',
          (ref: React.Ref<HTMLButtonElement>): MessageBarProps['dismiss'] => ({
            as: 'button',
            ref,
            children: 'x',
          }),
          'Dismiss',
          BUTTON_OBJECT_WARNING,
        ],
      ])('%s', (_, dismiss, name, warning) => {
        const warn = spyOnWarn();
        const ref = React.createRef<HTMLButtonElement>();
        render(
          <MessageBar onDismiss={() => {}} dismiss={dismiss(ref)}>
            Msg
          </MessageBar>,
        );
        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(ref.current).toBe(screen.getByRole('button', { name }));
        expect(warn.mock.calls).toEqual([[warning]]);
      });
    });

    describe('a Wave Button written in a Server Component (lazy client reference, C-COMPOUND)', () => {
      const ClientButton = asClientReference(Button);

      it('is merged into the wired button like the plain Button, on the server too', () => {
        const warn = spyOnWarn();
        const ui = (Part: typeof Button) => (
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              <Part appearance="subtle" icon={<svg data-testid="button-icon" />}>
                Close
              </Part>
            }
          >
            Msg
          </MessageBar>
        );
        expect(renderToString(ui(ClientButton))).toBe(renderToString(ui(Button)));
        expect(warn).not.toHaveBeenCalled();
      });

      it('renders one wired button that calls both handlers', async () => {
        const warn = spyOnWarn();
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        const onSlotClick = vi.fn();
        render(
          <MessageBar
            onDismiss={onDismiss}
            dismiss={
              <ClientButton appearance="subtle" onClick={onSlotClick}>
                Close
              </ClientButton>
            }
          >
            Msg
          </MessageBar>,
        );
        expect(screen.getAllByRole('button')).toHaveLength(1);
        await user.click(screen.getByRole('button', { name: 'Close' }));
        expect(onSlotClick).toHaveBeenCalledTimes(1);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });
    });

    it('renders custom slot content inside the wired dismiss button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <MessageBar onDismiss={onDismiss} dismiss={<span data-testid="close-icon">X</span>}>
          Msg
        </MessageBar>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      const button = screen.getByRole('button', { name: 'Dismiss' });
      expect(button).toHaveAttribute('type', 'button');
      const content = screen.getByTestId('close-icon');
      expect(button).toContainElement(content);
      expect(content.closest('[aria-hidden="true"]')).not.toBeNull();
      await user.click(button);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders an object slot as content inside the wired button', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <MessageBar onDismiss={onDismiss} dismiss={{ children: 'x', className: 'text-error' }}>
          Msg
        </MessageBar>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss' });
      const content = screen.getByText('x');
      expect(button).toContainElement(content);
      expect(content).toHaveClass('text-error');
      await user.click(button);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('merges a <button> slot into the wired button: one button, both handlers run', async () => {
      const warn = spyOnWarn();
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onSlotClick = vi.fn();
      render(
        <MessageBar
          onDismiss={onDismiss}
          dismiss={
            <button type="button" onClick={onSlotClick} data-testid="slot-button">
              Close
            </button>
          }
        >
          Msg
        </MessageBar>,
      );
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAttribute('data-testid', 'slot-button');
      expect(buttons[0]).toHaveAttribute('type', 'button');
      // Its visible text names the button, as in 0.4 (WCAG 2.5.3 Label in Name).
      expect(buttons[0]).toHaveAccessibleName('Close');
      expect(buttons[0]).not.toHaveAttribute('aria-label');
      await user.click(buttons[0]);
      expect(onSlotClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it('merges a Wave Button slot into the wired button', async () => {
      const warn = spyOnWarn();
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onSlotClick = vi.fn();
      render(
        <MessageBar
          onDismiss={onDismiss}
          dismiss={
            <Button
              appearance="subtle"
              aria-label="Close message"
              icon={<svg data-testid="button-icon" />}
              onClick={onSlotClick}
            />
          }
        >
          Msg
        </MessageBar>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const button = screen.getByRole('button', { name: 'Close message' });
      expect(button).toContainElement(screen.getByTestId('button-icon'));
      await user.click(button);
      expect(onSlotClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it.each([
      [
        'a Wave Button element',
        (onClick: () => void): MessageBarProps['dismiss'] => (
          <Button
            icon={<svg data-testid="button-icon" />}
            iconPosition="after"
            disabled
            disabledFocusable
            onClick={onClick}
          >
            Close
          </Button>
        ),
        'Close',
        BUTTON_ELEMENT_WARNING,
      ],
      [
        'a slot object whose `as` is a Wave Button (deprecated form)',
        (onClick: () => void) =>
          // Wave Button props are not part of the slot type: a JavaScript caller's 0.4 form.
          ({
            as: Button,
            icon: <svg data-testid="button-icon" />,
            iconPosition: 'after',
            disabled: true,
            disabledFocusable: true,
            onClick,
            children: 'Close',
          }) as Slot<'span'>,
        'Dismiss',
        BUTTON_OBJECT_WARNING,
      ],
    ])(
      '%s: iconPosition and disabledFocusable take effect on the wired button and never reach the DOM',
      async (_, dismiss, name, warning) => {
        const warn = spyOnWarn();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        const onSlotClick = vi.fn();
        const onParentClick = vi.fn();
        render(
          <div onClick={onParentClick}>
            <MessageBar onDismiss={onDismiss} dismiss={dismiss(onSlotClick)}>
              Msg
            </MessageBar>
          </div>,
        );
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        const button = buttons[0];
        expect(button).toHaveAccessibleName(name);
        // Neither prop lands on the button or its content as an unknown attribute.
        expect(button.outerHTML).not.toMatch(/iconposition|disabledfocusable/i);
        // iconPosition="after": the decorative icon follows the text, as in Button.
        const icon = screen.getByTestId('button-icon').parentElement as HTMLElement;
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon.previousSibling?.textContent).toBe('Close');
        expect(icon.nextSibling).toBeNull();
        // disabledFocusable wins over disabled: unavailable, but focusable and in the tab order.
        expect(button).not.toBeDisabled();
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAttribute('data-disabled', '');
        expect(button).toHaveAttribute('data-disabled-focusable', '');
        expect(button).toHaveClass(
          'aria-disabled:cursor-not-allowed',
          'aria-disabled:opacity-50',
          // The dimmed look lifts while the focus ring shows (opacity would dim the ring too).
          'aria-disabled:focus-visible:opacity-100',
        );
        await user.tab();
        expect(button).toHaveFocus();
        await user.keyboard('{Enter}');
        await user.keyboard(' ');
        await user.click(button);
        expect(onSlotClick).not.toHaveBeenCalled();
        expect(onDismiss).not.toHaveBeenCalled();
        expect(onParentClick).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([[warning]]);
        expect(error).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['an icon', <svg key="icon" data-testid="slot-icon" />],
      ['a symbol', '×'],
      // A lone character is a symbolic glyph, not a text label (C-SLOTS naming, WCAG 2.5.3).
      ['a lone capital letter', 'X'],
      ['a lone small letter', 'x'],
      ['a plus sign', '+'],
      ['a lone digit', 1],
      [
        'a lone letter beside aria-hidden text',
        [
          'X',
          <span key="h" aria-hidden="true">
            Close
          </span>,
        ],
      ],
      ['aria-hidden text', <span aria-hidden="true">Close</span>],
      ['hidden text', <span hidden>Close</span>],
      [
        'an SVG title',
        <svg key="t">
          <title>Close</title>
        </svg>,
      ],
    ])('a <button> slot whose content is %s keeps the "Dismiss" name', (_, children) => {
      const warn = spyOnWarn();
      render(
        <MessageBar onDismiss={() => {}} dismiss={<button type="button">{children}</button>}>
          Msg
        </MessageBar>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss');
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it.each([
      ['a two-letter word', 'OK', 'OK'],
      ['letters split across strings', ['O', 'K'], 'OK'],
      ['a two-digit number', 10, '10'],
      ['text in an element', <b key="b">Close</b>, 'Close'],
      ['a letter beside an icon', [<svg key="i" aria-hidden="true" />, 'Go'], 'Go'],
    ])('a <button> slot whose content is %s is named by that text', (_, children, name) => {
      const warn = spyOnWarn();
      render(
        <MessageBar onDismiss={() => {}} dismiss={<button type="button">{children}</button>}>
          Msg
        </MessageBar>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName(name);
      expect(button).not.toHaveAttribute('aria-label');
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it('decides the server-rendered name from the literal children', () => {
      // The button-element warning is emitted from an effect, so the server render logs nothing.
      const warn = spyOnWarn();
      const host = document.createElement('div');
      document.body.appendChild(host);
      try {
        host.innerHTML = renderToString(
          <>
            <MessageBar onDismiss={() => {}} dismiss={<button type="button">Close</button>}>
              First
            </MessageBar>
            <MessageBar onDismiss={() => {}} dismiss={<button type="button">X</button>}>
              Second
            </MessageBar>
          </>,
        );
        const [named, glyph] = within(host).getAllByRole('button');
        expect(named).not.toHaveAttribute('aria-label');
        expect(named).toHaveAccessibleName('Close');
        expect(glyph).toHaveAttribute('aria-label', 'Dismiss');
        expect(warn).not.toHaveBeenCalled();
      } finally {
        host.remove();
      }
    });

    // A generator is read once to decide whether it renders anything; its items are what renders.
    describe('generator content', () => {
      function* items(...values: React.ReactNode[]): Generator<React.ReactNode> {
        yield* values;
      }

      it('renders the children of a merged <button> given as a generator, named by their text', () => {
        const warn = spyOnWarn();
        const error = vi.spyOn(console, 'error');
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={<button type="button">{items('Close')}</button>}
          >
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button');
        expect(button).toHaveTextContent('Close');
        expect(button).toHaveAccessibleName('Close');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
        // The items render, never the generator itself (React warns about rendering one).
        expect(error).not.toHaveBeenCalled();
      });

      it('names a merged <button> by the text of a generator on the server too', () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        try {
          host.innerHTML = renderToString(
            <MessageBar
              onDismiss={() => {}}
              dismiss={<button type="button">{items('Close')}</button>}
            >
              Msg
            </MessageBar>,
          );
          const button = within(host).getByRole('button');
          expect(button).not.toHaveAttribute('aria-label');
          expect(button).toHaveAccessibleName('Close');
        } finally {
          host.remove();
        }
      });

      it.each([
        ['as the slot', () => items(<svg key="icon" data-testid="slot-icon" />)],
        [
          'as the children of a slot object',
          () => ({
            className: 'text-error',
            children: items(<svg key="icon" data-testid="slot-icon" />),
          }),
        ],
        [
          'as the children of a merged <button>',
          () => <button type="button">{items(<svg key="icon" data-testid="slot-icon" />)}</button>,
        ],
        [
          'as the icon of a merged Wave Button',
          () => <Button icon={items(<svg key="icon" data-testid="slot-icon" />)} />,
        ],
      ])('renders an icon given by a generator %s', (name, makeDismiss) => {
        const warn = spyOnWarn();
        const error = vi.spyOn(console, 'error');
        render(
          <MessageBar onDismiss={() => {}} dismiss={makeDismiss() as MessageBarProps['dismiss']}>
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss' });
        expect(button).toContainElement(screen.getByTestId('slot-icon'));
        expect(button.querySelector('[data-wave-icon="dismiss"]')).toBeNull();
        expect(warn.mock.calls).toEqual(name.includes('merged') ? [[BUTTON_ELEMENT_WARNING]] : []);
        expect(error).not.toHaveBeenCalled();
      });
    });

    it('a <button> slot with text and its own aria-label is named by the aria-label', () => {
      const warn = spyOnWarn();
      render(
        <MessageBar
          onDismiss={() => {}}
          dismiss={
            <button type="button" aria-label="Close the message">
              Close
            </button>
          }
        >
          Msg
        </MessageBar>,
      );
      expect(screen.getByRole('button')).toHaveAccessibleName('Close the message');
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it('a Wave Button slot with a text label is named by that label', async () => {
      const warn = spyOnWarn();
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <MessageBar onDismiss={onDismiss} dismiss={<Button appearance="subtle">Close</Button>}>
          Msg
        </MessageBar>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    describe('text rendered by a child component (i18n, WCAG 2.5.3)', () => {
      /** Stands in for `<FormattedMessage>`/`<Trans>`: the text comes from a component. */
      function Translated({ text }: { text: string }) {
        return <>{text}</>;
      }

      it('a <button> slot is named by the text its child component renders', () => {
        const warn = spyOnWarn();
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              <button type="button">
                <Translated text="Close" />
              </button>
            }
          >
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button');
        expect(button).toHaveAccessibleName('Close');
        expect(button).not.toHaveAttribute('aria-label');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('a Wave Button slot is named by the text its child component renders', () => {
        const warn = spyOnWarn();
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              <Button appearance="subtle">
                <Translated text="Schließen" />
              </Button>
            }
          >
            Msg
          </MessageBar>,
        );
        expect(screen.getByRole('button')).toHaveAccessibleName('Schließen');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('counts letters across the text of several child components', () => {
        const warn = spyOnWarn();
        render(
          <>
            <MessageBar
              onDismiss={() => {}}
              dismiss={
                <button type="button">
                  <Translated text="O" />
                  <Translated text="K" />
                </button>
              }
            >
              Pair
            </MessageBar>
            <MessageBar
              onDismiss={() => {}}
              dismiss={
                <button type="button">
                  <Translated text="X" />
                </button>
              }
            >
              Glyph
            </MessageBar>
          </>,
        );
        const [pair, glyph] = screen.getAllByRole('button');
        expect(pair).toHaveAccessibleName('OK');
        expect(pair).not.toHaveAttribute('aria-label');
        // A lone character rendered by a component is a glyph too: the DOM check agrees with the
        // literal check.
        expect(glyph).toHaveAccessibleName('Dismiss');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('an icon component keeps the "Dismiss" name', () => {
        const warn = spyOnWarn();
        function CloseIcon() {
          return <svg data-testid="close-svg" />;
        }
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              <button type="button">
                <CloseIcon />
              </button>
            }
          >
            Msg
          </MessageBar>,
        );
        expect(screen.getByRole('button')).toHaveAccessibleName('Dismiss');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('follows text that a child component renders or removes later', async () => {
        const warn = spyOnWarn();
        const setTextRef = React.createRef<(text: string) => void>();
        function LateText({ ref }: { ref: React.Ref<(text: string) => void> }) {
          const [text, setText] = React.useState('');
          React.useImperativeHandle(ref, () => setText, []);
          return <>{text}</>;
        }
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={
              <button type="button">
                <svg aria-hidden="true" />
                <LateText ref={setTextRef} />
              </button>
            }
          >
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button');
        expect(button).toHaveAccessibleName('Dismiss');

        // A lone character is a glyph: the default name stays.
        act(() => setTextRef.current?.('X'));
        await act(async () => {});
        expect(button).toHaveTextContent('X');
        expect(button).toHaveAccessibleName('Dismiss');

        act(() => setTextRef.current?.('Close'));
        await waitFor(() => expect(button).toHaveAccessibleName('Close'));
        expect(button).not.toHaveAttribute('aria-label');

        act(() => setTextRef.current?.(''));
        await waitFor(() => expect(button).toHaveAccessibleName('Dismiss'));
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });

      it('counts text hidden only by CSS as the label; an explicit aria-label names such a button', () => {
        const warn = spyOnWarn();
        // A responsive label: the text is `display: none` below the breakpoint.
        const responsive = (props: React.ComponentPropsWithoutRef<'button'>) => (
          <button type="button" {...props}>
            <svg aria-hidden="true" />
            <span className="hidden sm:inline">Close</span>
          </button>
        );
        const { rerender } = render(
          <MessageBar onDismiss={() => {}} dismiss={responsive({})}>
            Msg
          </MessageBar>,
        );
        // Documented limitation: the default name is dropped (see the `dismiss` JSDoc).
        expect(screen.getByRole('button')).not.toHaveAttribute('aria-label');

        rerender(
          <MessageBar onDismiss={() => {}} dismiss={responsive({ 'aria-label': 'Close' })}>
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Close');
        expect(button).toHaveAccessibleName('Close');
        expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
      });
    });

    describe('naming attributes on the merged button', () => {
      function Labels() {
        return <span id="dismiss-label">Close message</span>;
      }

      it.each([
        [
          'a <button> with title',
          <button key="t" type="button" title="Close" />,
          'Close',
          [[BUTTON_ELEMENT_WARNING]],
        ],
        [
          'a <button> with aria-labelledby',
          <button key="l" type="button" aria-labelledby="dismiss-label" />,
          'Close message',
          [[BUTTON_ELEMENT_WARNING]],
        ],
        ['a slot object with title', { title: 'Close' }, 'Close', []],
        [
          'a slot object with aria-labelledby',
          { 'aria-labelledby': 'dismiss-label' },
          'Close message',
          [],
        ],
      ] as const)(
        '%s is not overridden by the default aria-label',
        (_, dismiss, name, warnings) => {
          const warn = spyOnWarn();
          render(
            <>
              <Labels />
              <MessageBar onDismiss={() => {}} dismiss={dismiss}>
                Msg
              </MessageBar>
            </>,
          );
          const button = screen.getByRole('button');
          expect(button).toHaveAccessibleName(name);
          expect(button).not.toHaveAttribute('aria-label');
          expect(warn.mock.calls).toEqual(warnings);
        },
      );
    });

    it('renders a portal passed as content (F2 slot classification)', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      try {
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={createPortal(<span data-testid="portaled">x</span>, host)}
          >
            Msg
          </MessageBar>,
        );
        expect(host).toContainElement(screen.getByTestId('portaled'));
        const button = screen.getByRole('button', { name: 'Dismiss' });
        expect(button).toHaveAttribute('type', 'button');
        expect(button).not.toContainElement(screen.getByTestId('portaled'));
      } finally {
        host.remove();
      }
    });

    it('a slot onClick that calls preventDefault() cancels onDismiss', async () => {
      const warn = spyOnWarn();
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <MessageBar
          onDismiss={onDismiss}
          dismiss={
            <button type="button" onClick={(event) => event.preventDefault()}>
              x
            </button>
          }
        >
          Msg
        </MessageBar>,
      );
      await user.click(screen.getByRole('button'));
      expect(onDismiss).not.toHaveBeenCalled();
      expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
    });

    it('merges the deprecated button-object form and warns once', async () => {
      const warn = spyOnWarn();
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const onSlotClick = vi.fn();
      const { rerender } = render(
        <MessageBar
          onDismiss={onDismiss}
          dismiss={{ as: 'button', onClick: onSlotClick, className: 'p-2', children: 'x' }}
        >
          Msg
        </MessageBar>,
      );
      rerender(
        <MessageBar
          onDismiss={onDismiss}
          dismiss={{ as: 'button', onClick: onSlotClick, className: 'p-2', children: 'x' }}
        >
          Msg again
        </MessageBar>,
      );
      expect(screen.getAllByRole('button')).toHaveLength(1);
      const button = screen.getByRole('button', { name: 'Dismiss' });
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass('p-2');
      expect(button).not.toHaveClass('p-1');
      await user.click(button);
      expect(onSlotClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls).toEqual([[BUTTON_OBJECT_WARNING]]);
    });

    it('an object slot without children styles the default icon', () => {
      render(
        <MessageBar onDismiss={() => {}} dismiss={{ className: 'text-error' }}>
          Msg
        </MessageBar>,
      );
      const button = screen.getByRole('button', { name: 'Dismiss' });
      const icon = button.querySelector('[data-wave-icon="dismiss"]');
      expect(icon).not.toBeNull();
      expect(icon?.parentElement).toHaveClass('text-error');
      expect(icon?.parentElement).toHaveAttribute('aria-hidden', 'true');
    });

    it('lets a slot aria-label rename the wired button', () => {
      render(
        <MessageBar onDismiss={() => {}} dismiss={{ children: 'x', 'aria-label': 'Schließen' }}>
          Msg
        </MessageBar>,
      );
      expect(screen.getByRole('button', { name: 'Schließen' })).toContainElement(
        screen.getByText('x'),
      );
    });

    it('accepts both dismiss slot typings', () => {
      // `disabled` exists only on the `SlotObject<'button'>` arm: without that arm this object
      // literal is an excess-property error. (Assignability alone cannot tell the arms apart, since
      // a span slot object accepts extra keys structurally.)
      const buttonObject: MessageBarProps['dismiss'] = {
        as: 'button',
        type: 'button',
        disabled: true,
        onClick: () => {},
      };
      // Control: the span arm alone rejects the same button-only key.
      // @ts-expect-error -- `disabled` is not an attribute of a span slot object
      const spanOnly: Slot<'span'> = { disabled: true };
      expect([buttonObject, spanOnly]).toHaveLength(2);

      expectTypeOf<React.ReactElement>().toExtend<NonNullable<MessageBarProps['dismiss']>>();
      expectTypeOf<string>().toExtend<NonNullable<MessageBarProps['dismiss']>>();
    });

    it.each([
      ['a <button> element slot', <button key="el" type="submit" />, BUTTON_ELEMENT_WARNING],
      ['the deprecated button-object form', { type: 'submit' as const }, BUTTON_OBJECT_WARNING],
    ])('an explicit type from %s overrides the type="button" default', (_, dismiss, warning) => {
      const warn = spyOnWarn();
      render(
        <MessageBar onDismiss={() => {}} dismiss={dismiss}>
          Msg
        </MessageBar>,
      );
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute('type', 'submit');
      expect(warn.mock.calls).toEqual([[warning]]);
    });

    it.each([
      // `null` reaches the component from JavaScript callers or casts; it means "the default".
      ['a <button> element slot', <button key="el" type={null as never} />, BUTTON_ELEMENT_WARNING],
      [
        'the deprecated button-object form',
        { type: null } as unknown as MessageBarProps['dismiss'],
        BUTTON_OBJECT_WARNING,
      ],
    ])(
      'a null type from %s keeps type="button" and does not submit',
      async (_, dismiss, warning) => {
        const warn = spyOnWarn();
        const user = userEvent.setup();
        const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
        const onDismiss = vi.fn();
        render(
          <form onSubmit={onSubmit}>
            <MessageBar onDismiss={onDismiss} dismiss={dismiss}>
              Msg
            </MessageBar>
          </form>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss' });
        expect(button).toHaveAttribute('type', 'button');
        await user.click(button);
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onSubmit).not.toHaveBeenCalled();
        expect(warn.mock.calls).toEqual([[warning]]);
      },
    );
  });

  describe('internal status building blocks (feedback-navigation#4)', () => {
    testDisplayName(StatusIcon, 'StatusIcon');
    testDisplayName(StatusText, 'StatusText');
  });

  describe('forms (button-provider#1)', () => {
    describe('default dismiss button', () => {
      testNoImplicitSubmit(MessageBar, {
        defaultProps: { children: 'Msg', onDismiss: () => {} },
      });
    });

    describe('dismiss slot content', () => {
      testNoImplicitSubmit(MessageBar, {
        defaultProps: {
          children: 'Msg',
          onDismiss: () => {},
          dismiss: <span>x</span>,
        },
      });
    });
  });

  describe('RTL (feedback-navigation#34)', () => {
    it('uses logical border and dismiss placement', () => {
      renderWithProviders(
        <MessageBar onDismiss={() => {}} data-testid="bar">
          Msg
        </MessageBar>,
        { dir: 'rtl' },
      );
      const bar = screen.getByTestId('bar');
      expect(bar.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(bar).toHaveClass('border-s-4', 'border-s-info');
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('ms-auto');
    });
  });
});
