import * as React from 'react';
import { describe, it, expect, vi, expectTypeOf, afterEach, onTestFinished } from 'vitest';
import { createPortal } from 'react-dom';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBar } from '../MessageBar';
import type { MessageBarProps } from '../MessageBar';
import { MessageBarGroup } from '../MessageBarGroup';
import { StatusIcon, StatusText } from '../MessageBar.status';
import { Button } from '../../button/Button';
import { Toolbar } from '../../button/Toolbar';
import { messageBarClassNames, messageBarGroupClassNames } from '../../../lib/classNames';
import type { Slot } from '../../../lib/types';
import {
  asClientReference,
  expectInertSlotProps,
  expectNoA11yViolations,
  honourInert,
  installResizeObserverMock,
  mockAnimations,
  mockRect,
  openingTags,
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

  describe('layout (P3-04)', () => {
    it('renders data-layout="multiline" by default and keeps the 0.7 markup of a bar without actions', () => {
      render(
        <MessageBar onDismiss={() => {}} data-testid="bar">
          Msg
        </MessageBar>,
      );
      const bar = screen.getByTestId('bar');
      expect(bar).toHaveAttribute('data-layout', 'multiline');
      expect(Array.from(bar.children, (child) => child.tagName)).toEqual(['SPAN', 'DIV', 'BUTTON']);
      expect(bar.children[1]).toHaveClass('min-w-0', 'flex-1', 'text-body-1');
      expect(bar.children[1]).not.toHaveClass('whitespace-nowrap');
    });

    it('an explicit singleline bar without actions renders the same markup', () => {
      const { container, rerender } = render(<MessageBar onDismiss={() => {}}>Msg</MessageBar>);
      const auto = container.innerHTML.replace('data-layout="multiline"', '');
      rerender(
        <MessageBar layout="singleline" onDismiss={() => {}}>
          Msg
        </MessageBar>,
      );
      expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'singleline');
      expect(container.innerHTML.replace('data-layout="singleline"', '')).toBe(auto);
    });

    it('types layout as a union', () => {
      expectTypeOf<MessageBarProps['layout']>().toEqualTypeOf<
        'auto' | 'singleline' | 'multiline' | undefined
      >();
      const elements = [
        // @ts-expect-error `wrap` is not a layout
        <MessageBar key="1" layout="wrap">
          Msg
        </MessageBar>,
      ];
      expect(elements).toHaveLength(1);
    });
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

    it('renders the icon element through a render function; one that renders nothing shows no icon (P13-01)', () => {
      const { rerender } = render(
        <MessageBar
          status="warning"
          icon={{
            className: 'mt-1',
            children: (Component, props) => (
              <Component {...props} data-testid="icon">
                <svg />
              </Component>
            ),
          }}
          data-testid="bar"
        >
          Msg
        </MessageBar>,
      );
      const icon = screen.getByTestId('icon');
      expect(icon.tagName).toBe('SPAN');
      expect(icon.classList[0]).toBe(messageBarClassNames.icon);
      expect(icon).toHaveClass('inline-flex', 'shrink-0', 'mt-1');
      expect(icon).not.toHaveClass('mt-0.5');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('bar').querySelector('[data-wave-icon]')).toBeNull();

      // The status-icon rule: a slot that renders nothing shows none (no default icon).
      rerender(
        <MessageBar status="warning" icon={{ children: () => null }} data-testid="bar">
          Msg
        </MessageBar>,
      );
      const bar = screen.getByTestId('bar');
      expect(bar.getElementsByClassName(messageBarClassNames.icon)).toHaveLength(0);
      expect(bar.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('icon={null} renders no icon', () => {
      render(
        <MessageBar icon={null} data-testid="bar">
          Msg
        </MessageBar>,
      );
      expect(screen.getByTestId('bar').querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it.each([
      ['null', null],
      ['false', false],
      ['an empty string', ''],
    ] as const)(
      'icon set to %s renders no icon element at all (status icon rule)',
      (_name, icon) => {
        render(
          <MessageBar icon={icon as Slot<'span'>} data-testid="bar">
            Msg
          </MessageBar>,
        );
        const bar = screen.getByTestId('bar');
        expect(bar.getElementsByClassName(messageBarClassNames.icon)).toHaveLength(0);
        expect(bar.querySelector('[aria-hidden="true"]')).toBeNull();
      },
    );
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

    describe('a render function (P13-01)', () => {
      it('renders the content element inside the wired button, given the default glyph', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        const renderContent = vi.fn((Component: React.ElementType, props: object) => (
          <Component {...props} data-testid="content" />
        ));
        render(
          <MessageBar
            onDismiss={onDismiss}
            dismiss={{ className: 'text-error', children: renderContent }}
          >
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss' });
        const content = screen.getByTestId('content');
        expect(button).toContainElement(content);
        expect(content.tagName).toBe('SPAN');
        expect(content).toHaveClass(messageBarClassNames.dismissIcon, 'text-error');
        expect(content).toHaveAttribute('aria-hidden', 'true');
        expect(renderContent).toHaveBeenCalledWith(
          'span',
          expect.objectContaining({ children: expect.anything() }),
        );
        expect(content.querySelector('[data-wave-icon="dismiss"]')).not.toBeNull();
        await user.click(content);
        expect(onDismiss).toHaveBeenCalledTimes(1);
      });

      it('one that renders nothing leaves the default glyph, with the object’s other attributes', () => {
        render(
          <MessageBar
            onDismiss={() => {}}
            dismiss={{ className: 'text-error', 'data-part': 'x', children: () => null }}
          >
            Msg
          </MessageBar>,
        );
        const button = screen.getByRole('button', { name: 'Dismiss' });
        const content = button.querySelector<HTMLElement>('[data-part="x"]')!;
        expect(content).toHaveClass(messageBarClassNames.dismissIcon, 'text-error');
        expect(content.querySelector('[data-wave-icon="dismiss"]')).not.toBeNull();
      });

      it.each([
        ['"button"', 'button'],
        ['a Wave Button', Button],
      ] as const)(
        'merges an object whose `as` is %s into the wired button, never nesting one, with the warning',
        async (_name, as) => {
          const warn = spyOnWarn();
          const user = userEvent.setup();
          const onDismiss = vi.fn();
          const renderContent = vi.fn((Component: React.ElementType, props: object) => (
            <Component {...props} data-testid="content">
              ×
            </Component>
          ));
          render(
            <MessageBar
              onDismiss={onDismiss}
              dismiss={{ as, children: renderContent } as Slot<'span'>}
            >
              Msg
            </MessageBar>,
          );
          const button = screen.getByRole('button', { name: 'Dismiss' });
          expect(screen.getAllByRole('button')).toEqual([button]);
          expect(renderContent).toHaveBeenCalledWith('span', {});
          expect(button).toContainElement(screen.getByTestId('content'));
          expect(screen.getByTestId('content').tagName).toBe('SPAN');
          await user.click(screen.getByTestId('content'));
          expect(onDismiss).toHaveBeenCalledTimes(1);
          expect(warn.mock.calls).toEqual([[BUTTON_OBJECT_WARNING]]);
        },
      );
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

    // The bar and the toast container pass the id from Fluent parity phase 3 on (P3-04, P3-02).
    it('renders its id on the visually hidden text, so a labelled bar or toast can name it', () => {
      render(<StatusText label="Warning:" id="status-text-id" />);
      const text = document.getElementById('status-text-id');
      expect(text).toHaveClass('sr-only');
      expect(text?.textContent).toBe('Warning: ');
    });

    it('renders nothing for an empty label, so an id never names an empty element', () => {
      const { container } = render(<StatusText label="" id="status-text-id" />);
      expect(container).toBeEmptyDOMElement();
      expect(document.getElementById('status-text-id')).toBeNull();
    });
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

describe('MessageBar — slotProps', () => {
  type BarSlotProps = NonNullable<MessageBarProps['slotProps']>;
  const EVERY_PART: BarSlotProps = { body: {}, dismissButton: {} };
  const all = (root: ParentNode, cls: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`));
  const partsOf = (root: ParentNode = document) => [
    ...all(root, messageBarClassNames.body),
    ...all(root, messageBarClassNames.dismissButton),
  ];
  const bodyOf = (bar: HTMLElement) => all(bar, messageBarClassNames.body)[0];
  const barOf = (id: string) => document.querySelector<HTMLElement>(`[data-bar="${id}"]`);
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const Icon = () => <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" />;
  const DISMISS_CLASSES =
    'wave-message-bar__dismiss-button ms-auto inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground not-disabled:not-aria-disabled:active:bg-subtle-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:focus-visible:opacity-100';
  const BODY_CLASSES = 'wave-message-bar__body min-w-0 flex-1 text-body-1';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * A measuring bar with a title and actions, one with a merged `<button>`, one with a merged
   * `disabledFocusable` Button and one with the deprecated button object.
   */
  function Bars({ slotProps }: { slotProps?: BarSlotProps }) {
    return (
      <>
        <MessageBar status="warning" onDismiss={() => {}} slotProps={slotProps}>
          <MessageBar.Title>Update available</MessageBar.Title>A new version is ready.
          <MessageBar.Actions>
            <Button size="small">Update</Button>
          </MessageBar.Actions>
        </MessageBar>
        <MessageBar
          onDismiss={() => {}}
          dismiss={
            <button type="button" id="merged" title="Close it" className="my-merged" tabIndex={-1}>
              Close
            </button>
          }
          slotProps={slotProps}
        >
          Saved.
        </MessageBar>
        <MessageBar
          onDismiss={() => {}}
          dismiss={<Button disabledFocusable icon={<Icon />} />}
          slotProps={slotProps}
        >
          Held.
        </MessageBar>
        <MessageBar
          layout="singleline"
          dismiss={{ as: 'button', type: 'reset', 'aria-label': 'Close', className: 'obj' }}
          slotProps={slotProps}
        >
          Object.
        </MessageBar>
      </>
    );
  }

  // Captured from 54699b8's dist (client and server agree).
  const BASE_PINS = [
    `<div class="${BODY_CLASSES} whitespace-nowrap">`,
    `<div class="${BODY_CLASSES}">`,
    `<div class="${BODY_CLASSES}">`,
    `<div class="${BODY_CLASSES}">`,
    `<button aria-label="Dismiss" class="${DISMISS_CLASSES}" type="button">`,
    `<button class="${DISMISS_CLASSES} my-merged" id="merged" tabindex="-1" title="Close it" type="button">`,
    `<button aria-disabled="true" aria-label="Dismiss" class="${DISMISS_CLASSES}" data-disabled="" data-disabled-focusable="" type="button">`,
    `<button aria-label="Close" class="${DISMISS_CLASSES} obj" type="reset">`,
  ].join('\n');

  /** The development warnings of the merged button and the button object, once each. */
  function expectMergedWarnings(warn: { mock: { calls: unknown[][] } }) {
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING], [BUTTON_OBJECT_WARNING]]);
  }

  it('renders the parts of 54699b8 (attributes sorted), on the client and the server', () => {
    const warn = spyOnWarn();
    for (const slotProps of [undefined, EVERY_PART]) {
      const view = render(<Bars slotProps={slotProps} />);
      expect(openingTags(...partsOf())).toBe(BASE_PINS);
      view.unmount();
      const template = document.createElement('template');
      template.innerHTML = renderToString(<Bars slotProps={slotProps} />);
      expect(openingTags(...partsOf(template.content))).toBe(BASE_PINS);
    }
    expectMergedWarnings(warn);
  });

  it('renders the same markup without slotProps, with {} and with every part empty', () => {
    const warn = spyOnWarn();
    expectInertSlotProps(
      (slotProps: BarSlotProps | undefined) => <Bars slotProps={slotProps} />,
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: BarSlotProps | undefined) => (
        <MessageBar role="region" status="success" onDismiss={() => {}} slotProps={slotProps}>
          <MessageBar.Title>Done</MessageBar.Title>
          All files uploaded.
        </MessageBar>
      ),
      EVERY_PART,
    );
    expectInertSlotProps(
      (slotProps: BarSlotProps | undefined) => (
        <MessageBarGroup>
          <MessageBar key="a" onDismiss={() => {}} slotProps={slotProps}>
            A
          </MessageBar>
          <MessageBar key="b" status="error" slotProps={slotProps}>
            B
          </MessageBar>
        </MessageBarGroup>
      ),
      EVERY_PART,
    );
    expectMergedWarnings(warn);
  });

  it('does not pass slotProps to the root', () => {
    const error = vi.spyOn(console, 'error');
    render(
      <MessageBar data-testid="bar" slotProps={EVERY_PART}>
        Saved.
      </MessageBar>,
    );
    expect(screen.getByTestId('bar')).not.toHaveAttribute('slotprops');
    expect(error).not.toHaveBeenCalled();
  });

  it('puts your className, style, data-* and ref on each part', () => {
    const refs: Element[] = [];
    const collect = (node: Element | null) => void (node && refs.push(node));
    render(
      <MessageBar
        onDismiss={() => {}}
        slotProps={{
          body: {
            className: 'my-body flex-auto',
            style: { opacity: 0.5 },
            'data-part': 'body',
            ref: collect,
          },
          dismissButton: {
            className: 'my-dismiss p-2',
            style: { opacity: 0.5 },
            'data-part': 'dismissButton',
            ref: collect,
          },
        }}
      >
        Saved.
      </MessageBar>,
    );
    for (const [cls, name, mine, conflict] of [
      [messageBarClassNames.body, 'body', 'my-body', 'flex-1'],
      [messageBarClassNames.dismissButton, 'dismissButton', 'my-dismiss', 'p-1'],
    ] as const) {
      const [element] = all(document, cls);
      expect(element.classList[0]).toBe(cls);
      expect(element).toHaveClass(mine);
      // Your class replaces a conflicting one of the part.
      expect(element).not.toHaveClass(conflict);
      expect(element).toHaveAttribute('data-part', name);
      expect(element).toHaveStyle({ opacity: '0.5' });
      expect(refs).toContain(element);
    }
    expect(refs).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute(
      'data-part',
      'dismissButton',
    );
  });

  it('locks the attributes the bar sets on its parts, at the values a merged button gives', () => {
    const warn = spyOnWarn();
    const bodyAttempt = {
      hidden: true,
      inert: true,
      'aria-hidden': true,
    } as unknown as BarSlotProps['body'];
    const dismissAttempt = {
      type: 'submit',
      disabled: true,
      tabIndex: 0,
      hidden: true,
      'aria-hidden': true,
      inert: true,
      role: 'link',
      contentEditable: true,
      'aria-label': 'Mine',
      'aria-disabled': 'true',
      'data-disabled': 'mine',
      'data-disabled-focusable': 'mine',
      'data-roving-container': '',
      'data-roving-disabled': '',
      'data-roving-value': 'mine',
    } as unknown as BarSlotProps['dismissButton'];
    render(<Bars slotProps={{ body: bodyAttempt, dismissButton: dismissAttempt }} />);
    expect(openingTags(...partsOf())).toBe(BASE_PINS);
    expectMergedWarnings(warn);
  });

  it("adds your ids to the Dismiss button's aria-labelledby and aria-describedby", () => {
    const warn = spyOnWarn();
    render(
      <>
        <span id="what">Dismiss the notice</span>
        <span id="note">Closes it for good</span>
        <span id="merged-name">Close</span>
        <MessageBar
          onDismiss={() => {}}
          slotProps={{ dismissButton: { 'aria-labelledby': 'what', 'aria-describedby': 'note' } }}
        >
          Saved.
        </MessageBar>
        <MessageBar
          onDismiss={() => {}}
          dismiss={
            <button type="button" aria-labelledby="merged-name">
              x
            </button>
          }
          slotProps={{ dismissButton: { 'aria-labelledby': 'what' } }}
        >
          Sent.
        </MessageBar>
      </>,
    );
    const own = screen.getByRole('button', { name: 'Dismiss the notice' });
    // The default name stays on the button; your ids name it.
    expect(own).toHaveAttribute('aria-label', 'Dismiss');
    expect(own).toHaveAttribute('aria-labelledby', 'what');
    expect(own).toHaveAttribute('aria-describedby', 'note');
    const merged = screen.getByRole('button', { name: 'Close Dismiss the notice' });
    expect(merged).toHaveAttribute('aria-labelledby', 'merged-name what');
    expect(merged).not.toHaveAttribute('aria-label');
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
  });

  it('runs your dismissButton onClick first: preventDefault() skips onDismiss, once in StrictMode', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const ui = (prevent: boolean) => (
      <React.StrictMode>
        <MessageBar
          onDismiss={() => void order.push('onDismiss')}
          slotProps={{
            dismissButton: {
              onClick: (event) => {
                order.push('part');
                if (prevent) event.preventDefault();
              },
            },
          }}
        >
          Saved.
        </MessageBar>
      </React.StrictMode>
    );
    const { rerender } = render(ui(false));
    const button = screen.getByRole('button', { name: 'Dismiss' });
    await user.click(button);
    expect(order).toEqual(['part', 'onDismiss']);
    rerender(ui(true));
    await user.click(button);
    expect(order).toEqual(['part', 'onDismiss', 'part']);
  });

  it("gives a merged <button> the defaults: your attributes replace its own, the bar's wiring stays locked", () => {
    const warn = spyOnWarn();
    const order: string[] = [];
    const ui = (prevent: boolean) => (
      <>
        <p id="merged-note">Merged note</p>
        <p id="part-note">Part note</p>
        <MessageBar
          onDismiss={() => void order.push('onDismiss')}
          dismiss={
            <button
              type="button"
              id="merged"
              title="Merged"
              className="merged p-1"
              data-from="merged"
              tabIndex={-1}
              aria-describedby="merged-note"
              onClick={() => void order.push('merged')}
            >
              Close
            </button>
          }
          slotProps={{
            dismissButton: {
              id: 'part',
              title: 'Part',
              className: 'part p-2',
              'data-from': 'part',
              'aria-describedby': 'part-note',
              // Locked: tried, and kept at the values the bar and the merged button give.
              type: 'submit',
              tabIndex: 0,
              disabled: true,
              'aria-label': 'Mine',
              onClick: (event) => {
                order.push('part');
                if (prevent) event.preventDefault();
              },
            },
          }}
        >
          Saved.
        </MessageBar>
      </>
    );
    const { rerender } = render(ui(false));
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.classList[0]).toBe(messageBarClassNames.dismissButton);
    expect(button).toHaveAttribute('id', 'part');
    expect(button).toHaveAttribute('title', 'Part');
    expect(button).toHaveAttribute('data-from', 'part');
    // The merged button's classes, then yours, which win a conflict.
    expect(button).toHaveClass('merged', 'part', 'p-2');
    expect(button).not.toHaveClass('p-1');
    expect(button).toHaveAttribute('aria-describedby', 'merged-note part-note');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-label');
    fireEvent.click(button);
    expect(order).toEqual(['part', 'merged', 'onDismiss']);
    rerender(ui(true));
    fireEvent.click(button);
    expect(order).toEqual(['part', 'merged', 'onDismiss', 'part']);
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
  });

  it('keeps the type and name a merged button or the button object gives over yours', () => {
    const warn = spyOnWarn();
    render(
      <>
        <MessageBar
          dismiss={<button type="reset">Reset</button>}
          slotProps={{ dismissButton: { type: 'button', 'aria-label': 'Mine' } }}
        >
          Form.
        </MessageBar>
        <MessageBar
          dismiss={{
            as: 'button',
            type: 'reset',
            name: 'object',
            className: 'obj',
            'aria-label': 'Close',
          }}
          slotProps={{
            dismissButton: {
              name: 'part',
              className: 'part',
              type: 'button',
              'aria-label': 'Mine',
            },
          }}
        >
          Object.
        </MessageBar>
      </>,
    );
    const merged = screen.getByRole('button', { name: 'Reset' });
    expect(merged).toHaveAttribute('type', 'reset');
    expect(merged).not.toHaveAttribute('aria-label');
    const object = screen.getByRole('button', { name: 'Close' });
    expect(object).toHaveAttribute('type', 'reset');
    // The button attributes of the object are defaults too: your name replaces its name.
    expect(object).toHaveAttribute('name', 'part');
    expect(object).toHaveClass('obj', 'part');
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING], [BUTTON_OBJECT_WARNING]]);
  });

  it("keeps a merged disabledFocusable Button's state and does not call your onClick", () => {
    const warn = spyOnWarn();
    const onClick = vi.fn();
    const onDismiss = vi.fn();
    // A click that reaches the document: a natively disabled button dispatches none either.
    const outer = vi.fn();
    document.addEventListener('click', outer);
    onTestFinished(() => document.removeEventListener('click', outer));
    render(
      <>
        <MessageBar
          onDismiss={onDismiss}
          dismiss={<Button disabledFocusable icon={<Icon />} />}
          slotProps={{
            dismissButton: {
              onClick,
              'aria-disabled': false,
              'data-disabled-focusable': 'no',
              tabIndex: -1,
            },
          }}
        >
          Held.
        </MessageBar>
      </>,
    );
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('data-disabled-focusable', '');
    expect(button).not.toHaveAttribute('tabindex');
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
  });

  it('calls your onClick on a merged button only while it is enabled', () => {
    const warn = spyOnWarn();
    const onClick = vi.fn();
    const ui = (disabled: boolean) => (
      <MessageBar
        dismiss={
          <button type="button" disabled={disabled}>
            Close
          </button>
        }
        slotProps={{ dismissButton: { onClick } }}
      >
        Saved.
      </MessageBar>
    );
    const { rerender } = render(ui(false));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(ui(true));
    // React dispatches no click to a natively disabled button: neither yours nor the bar's.
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
  });

  it("keeps the slot's ref, the label check and your ref on the Dismiss button", () => {
    const warn = spyOnWarn();
    const slotRef = React.createRef<HTMLButtonElement>();
    const partNodes: (HTMLButtonElement | null)[] = [];
    // Text from a component: only the rendered button tells that it names the button.
    const Label = () => <>Close</>;
    const ui = (tick: number) => (
      <MessageBar
        data-tick={tick}
        onDismiss={() => {}}
        dismiss={
          <button type="button" ref={slotRef}>
            <Label />
          </button>
        }
        slotProps={{ dismissButton: { ref: (node) => void partNodes.push(node) } }}
      >
        Saved.
      </MessageBar>
    );
    const { rerender } = render(ui(0));
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).not.toHaveAttribute('aria-label');
    expect(slotRef.current).toBe(button);
    // A new inline ref on every render: yours follows, the slot's stays attached.
    rerender(ui(1));
    rerender(ui(2));
    expect(slotRef.current).toBe(button);
    expect(partNodes.at(-1)).toBe(button);
    expect(screen.getByRole('button', { name: 'Close' })).toBe(button);
    expect(warn.mock.calls).toEqual([[BUTTON_ELEMENT_WARNING]]);
  });

  it("measures the body with your ref; the layout the bar writes stays the root's", async () => {
    const ro = installResizeObserverMock();
    try {
      const objectRef = React.createRef<HTMLDivElement>();
      const inline: (HTMLDivElement | null)[] = [];
      const ui = (tick: number) => (
        <MessageBar
          data-tick={tick}
          slotProps={{
            body: {
              ref: tick % 2 ? objectRef : (node) => void inline.push(node),
              className: 'my-body',
              'data-layout': 'mine',
            },
          }}
        >
          Your session expires in five minutes.
          <MessageBar.Actions>
            <Button>Retry</Button>
          </MessageBar.Actions>
        </MessageBar>
      );
      const { rerender } = render(ui(0));
      const bar = screen.getByRole('status');
      const body = bodyOf(bar);
      expect(inline.at(-1)).toBe(body);
      rerender(ui(1));
      expect(objectRef.current).toBe(body);
      expect(bar).toHaveAttribute('data-layout', 'singleline');
      expect(body).toHaveAttribute('data-layout', 'mine');
      expect(body).toHaveClass('whitespace-nowrap', 'my-body');

      // The text needs 150 px more than its column: the bar measures it and goes multiline.
      mockRect(bar, { width: 400 });
      mockRect(body, { width: 200 });
      Object.defineProperty(body, 'scrollWidth', { configurable: true, value: 350 });
      ro.trigger(bar);
      await act(async () => {
        await nextFrame();
      });
      expect(bar).toHaveAttribute('data-layout', 'multiline');
      expect(body).toHaveAttribute('data-layout', 'mine');
      expect(body).not.toHaveClass('whitespace-nowrap');
      expect(bodyOf(bar)).toBe(body);

      // Back to one row once the bar is as wide as the text needed, with the ref changed again.
      rerender(ui(2));
      mockRect(bar, { width: 550 });
      mockRect(body, { width: 550 });
      ro.trigger(bar);
      await act(async () => {
        await nextFrame();
      });
      expect(bar).toHaveAttribute('data-layout', 'singleline');
      expect(inline.at(-1)).toBe(body);
    } finally {
      ro.restore();
    }
  });

  it('gives the body no handler of the bar: yours runs first, and the bar still sees the event', () => {
    const order: string[] = [];
    render(
      <MessageBar
        onClick={() => void order.push('bar')}
        slotProps={{ body: { onClick: () => void order.push('body') } }}
      >
        <a href="#details">Details</a>
      </MessageBar>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(order).toEqual(['body', 'bar']);
  });

  it('dismisses a bar of a MessageBarGroup through your part, and focus moves to the next bar', async () => {
    const motion = mockAnimations({
      animated: (el) => el.classList.contains(messageBarGroupClassNames.item),
    });
    honourInert();
    const user = userEvent.setup();
    const partClick = vi.fn();
    const slotProps = {
      body: { className: 'my-body', hidden: true },
      dismissButton: {
        className: 'my-dismiss',
        onClick: partClick,
        tabIndex: -1,
        inert: true,
        hidden: true,
      },
    } as unknown as BarSlotProps;
    function Group() {
      const [ids, setIds] = React.useState(['a', 'b', 'c']);
      return (
        <MessageBarGroup>
          {ids.map((id) => (
            <MessageBar
              key={id}
              data-bar={id}
              onDismiss={() => setIds((current) => current.filter((other) => other !== id))}
              slotProps={slotProps}
            >{`Message ${id}`}</MessageBar>
          ))}
        </MessageBarGroup>
      );
    }
    render(<Group />);
    const dismissOf = (id: string) =>
      within(barOf(id) as HTMLElement).getByRole('button', { name: 'Dismiss' });
    for (const id of ['a', 'b', 'c']) {
      const body = bodyOf(barOf(id) as HTMLElement);
      expect(body).not.toHaveAttribute('hidden');
      expect(body).toHaveClass('my-body');
    }
    await user.click(dismissOf('b'));
    expect(partClick).toHaveBeenCalledTimes(1);
    expect(barOf('b')?.parentElement).toHaveAttribute('data-presence', 'exiting');
    expect(dismissOf('c')).toHaveFocus();
    expect(dismissOf('c')).toHaveClass('my-dismiss');
    await act(async () => {
      await motion.finishAll();
    });
    expect(barOf('b')).toBeNull();
    expect(dismissOf('c')).toHaveFocus();
  });

  it("keeps the Dismiss buttons in a toolbar's arrow order and one Tab stop, with the roving markers tried", async () => {
    const user = userEvent.setup();
    const marked = {
      dismissButton: {
        role: 'radiogroup',
        inert: true,
        tabIndex: 0,
        'data-roving-container': '',
        'data-roving-disabled': '',
        'data-roving-value': 'mine',
      },
    } as unknown as BarSlotProps;
    render(
      <>
        <button type="button">Before</button>
        <Toolbar aria-label="Tools">
          <Toolbar.Button>Bold</Toolbar.Button>
          <MessageBar onDismiss={() => {}} slotProps={marked}>
            Saved.
          </MessageBar>
          <MessageBar onDismiss={() => {}} slotProps={marked}>
            Sent.
          </MessageBar>
          <Toolbar.Button>Italic</Toolbar.Button>
        </Toolbar>
        <button type="button">After</button>
      </>,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const tabStops = () => toolbar.querySelectorAll('[tabindex="0"]');
    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });
    const [saved, sent] = screen.getAllByRole('button', { name: 'Dismiss' });
    for (const button of [saved, sent]) {
      for (const key of ['role', 'inert', 'data-roving-container', 'data-roving-disabled']) {
        expect(button).not.toHaveAttribute(key);
      }
      expect(button).not.toHaveAttribute('data-roving-value', 'mine');
    }
    expect(tabStops()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(bold).toHaveFocus();
    const order: Element[] = [];
    for (let step = 0; step < 4; step++) {
      await user.keyboard('{ArrowRight}');
      order.push(document.activeElement as Element);
      expect(tabStops()).toHaveLength(1);
    }
    expect(order).toEqual([saved, sent, italic, bold]);
    // From a Dismiss button Tab leaves the toolbar, and Shift+Tab comes back to it only.
    await user.keyboard('{ArrowRight}');
    expect(saved).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(saved).toHaveFocus();
  });

  it('ignores a dismissButton part while the bar has no Dismiss button', () => {
    const ref = vi.fn();
    render(
      <MessageBar slotProps={{ dismissButton: { ref, className: 'my-dismiss' } }}>
        Saved.
      </MessageBar>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(ref).not.toHaveBeenCalled();
  });

  it('puts the parts in a right-to-left bar too', () => {
    renderWithProviders(
      <MessageBar
        onDismiss={() => {}}
        slotProps={{ body: { className: 'my-body' }, dismissButton: { className: 'my-dismiss' } }}
      >
        Saved.
      </MessageBar>,
      { dir: 'rtl' },
    );
    const bar = screen.getByRole('status');
    expect(bar.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(bodyOf(bar)).toHaveClass('my-body');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('my-dismiss', 'ms-auto');
  });

  it('has no axe violations with parts', async () => {
    render(
      <MessageBar
        status="error"
        onDismiss={() => {}}
        slotProps={{
          body: { className: 'my-body', id: 'error-body' },
          dismissButton: { title: 'Dismiss the error', 'aria-describedby': 'error-body' },
        }}
      >
        <MessageBar.Title>Upload failed</MessageBar.Title>
        Try again later.
        <MessageBar.Actions>
          <Button size="small">Retry</Button>
        </MessageBar.Actions>
      </MessageBar>,
    );
    await expectNoA11yViolations(document.body);
  });

  it('types the parts by their elements and takes no children', () => {
    expectTypeOf<NonNullable<BarSlotProps['body']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
    expectTypeOf<NonNullable<BarSlotProps['dismissButton']>['ref']>().toEqualTypeOf<
      React.Ref<HTMLButtonElement> | undefined
    >();
    expectTypeOf<keyof BarSlotProps>().toEqualTypeOf<'body' | 'dismissButton'>();
    const elements = [
      // @ts-expect-error a part takes no children
      <MessageBar key="1" slotProps={{ body: { children: 'x' } }}>
        Msg
      </MessageBar>,
      // @ts-expect-error a part takes no children
      <MessageBar key="2" onDismiss={() => {}} slotProps={{ dismissButton: { children: 'x' } }}>
        Msg
      </MessageBar>,
    ];
    expect(elements).toHaveLength(2);
  });
});
