import { afterEach, describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer, type DrawerProps, type DrawerTriggerRenderProps } from '../Drawer';
import { Popover } from '../Popover';
import { drawerClassNames } from '../../../lib/classNames';
import { getTopmostLayer } from '../../../lib/layers';
import {
  expectNoA11yViolations,
  findDanglingIdRefsInHtml,
  mockAnimations,
  renderWithProviders,
  testSystemProps,
} from '../../../test-utils';

/*
 * P6-07 D100, D101, D105, D107: `type="inline"` renders the drawer in place as an `<aside>` (a
 * complementary landmark named by its title), with none of the modal machinery: no portal,
 * backdrop, dismiss layer, focus trap, isolation or scroll lock. Escape and outside presses never
 * close it; `Drawer.Trigger` toggles it without `aria-haspopup`; opening moves no focus, and
 * closing returns focus only when focus was inside. It renders in the server HTML.
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

const aside = () => document.querySelector<HTMLElement>('aside');
const complementary = (name = 'Details') => screen.getByRole('complementary', { name });

const UNNAMED_WARNING =
  '[WaveUI] Drawer has no accessible name. Pass `title`, render a Drawer.HeaderTitle or a Drawer.Title inside it, or give it `aria-label` or `aria-labelledby`.';

/** A page around an uncontrolled inline Drawer with a trigger and a Drawer.Close action. */
function Page({
  drawerProps,
  children,
}: {
  drawerProps?: Partial<DrawerProps>;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button type="button">Before</button>
      <Drawer type="inline" title="Details" {...drawerProps}>
        <Drawer.Trigger>
          <button type="button">Show details</button>
        </Drawer.Trigger>
        {children ?? (
          <>
            <button type="button">Edit</button>
            <Drawer.Close>
              <button type="button">Done</button>
            </Drawer.Close>
          </>
        )}
      </Drawer>
      <button type="button">After</button>
    </>
  );
}

/** A controlled inline Drawer with a trigger; the parent decides `open`. */
function Controlled({
  open,
  onOpenChange = () => {},
  unmountOnClose,
}: {
  open: boolean;
  onOpenChange?: DrawerProps['onOpenChange'];
  unmountOnClose?: boolean;
}) {
  return (
    <>
      <button type="button">Page button</button>
      <Drawer
        type="inline"
        title="Details"
        open={open}
        onOpenChange={onOpenChange}
        unmountOnClose={unmountOnClose}
      >
        <Drawer.Trigger>
          <button type="button">Show details</button>
        </Drawer.Trigger>
        <button type="button">Edit</button>
      </Drawer>
    </>
  );
}

describe('Drawer type="inline"', () => {
  describe('system props', () => {
    testSystemProps(Drawer, {
      expectedTag: 'aside',
      displayName: 'Drawer',
      defaultProps: {
        type: 'inline',
        defaultOpen: true,
        title: 'Details',
        children: <p>Content</p>,
      },
      conflictingClass: { className: 'w-96', overrides: 'w-80' },
      a11yVariants: [{ name: 'separator', props: { separator: true } }],
    });
  });

  it('renders an <aside> in place, named by its title, after its direct trigger', () => {
    const { container } = render(<Page drawerProps={{ defaultOpen: true }} />);
    const panel = complementary();
    expect(panel.localName).toBe('aside');
    expect(container).toContainElement(panel);
    expect(document.querySelector('[data-wave-portal]')).toBeNull();
    expect(panel).toHaveAttribute('data-type', 'inline');
    expect(panel).not.toHaveAttribute('role');
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(panel).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    // The reading order is the button, then the panel (APG disclosure).
    expect(button('Show details').compareDocumentPosition(panel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(panel).toHaveClass(drawerClassNames.root);
  });

  it('runs no modal machinery: no backdrop, layer, isolation, scroll lock or focus trap', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <main>
        <Drawer type="inline" title="Details" defaultOpen>
          <Drawer.Trigger>
            <button type="button">Show details</button>
          </Drawer.Trigger>
          <button type="button">Edit</button>
        </Drawer>
        <button type="button" onClick={onClick}>
          After
        </button>
      </main>,
    );
    expect(complementary()).toBeInTheDocument();
    expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
    expect(getTopmostLayer()).toBeNull();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    await user.click(button('After'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button('After')).toHaveFocus();
    // Tab moves through the panel and on to the page, as through page content.
    button('Edit').focus();
    await user.tab();
    expect(button('After')).toHaveFocus();
    await user.tab({ shift: true });
    expect(button('Edit')).toHaveFocus();
  });

  it('leaves focus on the trigger when it opens; an autoFocus field inside takes it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Page />);
    await user.click(button('Show details'));
    expect(complementary()).toBeInTheDocument();
    expect(button('Show details')).toHaveFocus();
    unmount();

    render(
      <Page>
        <input aria-label="Search" autoFocus />
      </Page>,
    );
    await user.click(button('Show details'));
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });

  it('toggles from Drawer.Trigger with aria-expanded and aria-controls, without aria-haspopup', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Page drawerProps={{ onOpenChange }} />);
    const trigger = button('Show details');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).not.toHaveAttribute('aria-haspopup');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', complementary().id);
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true, {
      reason: 'trigger',
      event: expect.any(MouseEvent),
    });

    await user.click(trigger);
    expect(aside()).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false, {
      reason: 'trigger',
      event: expect.any(MouseEvent),
    });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('ignores a click in a popup portaled from inside a wrapper-span trigger (C-COMPOSE)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Drawer type="inline" title="Details" defaultOpen onOpenChange={onOpenChange}>
        <Drawer.Trigger asChild={false}>
          <span>
            <button type="button">Show details</button>
            <Popover defaultOpen>
              <Popover.Trigger>
                <button type="button">Help</button>
              </Popover.Trigger>
              <Popover.Content aria-label="Help">
                <button type="button">In the popover</button>
              </Popover.Content>
            </Popover>
          </span>
        </Drawer.Trigger>
      </Drawer>,
    );
    await user.click(button('In the popover'));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(aside()).not.toBeNull();
    await user.keyboard('{Escape}');
  });

  it('passes a render-prop trigger no aria-haspopup key', async () => {
    const user = userEvent.setup();
    const received: DrawerTriggerRenderProps[] = [];
    render(
      <Drawer type="inline" title="Details">
        <Drawer.Trigger>
          {(props) => {
            received.push(props);
            return (
              <button type="button" {...props}>
                Show details
              </button>
            );
          }}
        </Drawer.Trigger>
        Content
      </Drawer>,
    );
    await user.click(button('Show details'));
    expect(complementary()).toBeInTheDocument();
    expect(received.length).toBeGreaterThan(0);
    for (const props of received) expect(Object.keys(props)).not.toContain('aria-haspopup');
    expect(received.at(-1)?.['aria-expanded']).toBe(true);
  });

  describe('closing and focus', () => {
    it.each([
      ['the Close button', 'Close'],
      ['Drawer.Close', 'Done'],
    ])(
      'mounted open (defaultOpen), returns focus to the trigger when %s closes it',
      async (_, name) => {
        const user = userEvent.setup();
        render(<Page drawerProps={{ defaultOpen: true }} />);
        await user.click(button(name));
        expect(aside()).toBeNull();
        expect(button('Show details')).toHaveFocus();
      },
    );

    it('mounted open (controlled), returns focus to the trigger when its Close button closes it', async () => {
      const user = userEvent.setup();
      function Open() {
        const [open, setOpen] = React.useState(true);
        return <Controlled open={open} onOpenChange={setOpen} />;
      }
      render(<Open />);
      await user.click(button('Close'));
      expect(aside()).toBeNull();
      expect(button('Show details')).toHaveFocus();
    });

    it('a Drawer.Close in a Popover opened inside returns focus to the trigger', async () => {
      const user = userEvent.setup();
      render(
        <Page>
          <Popover>
            <Popover.Trigger>
              <button type="button">More</button>
            </Popover.Trigger>
            <Popover.Content aria-label="More options">
              <Drawer.Close>
                <button type="button">Close drawer</button>
              </Drawer.Close>
            </Popover.Content>
          </Popover>
        </Page>,
      );
      await user.click(button('Show details'));
      await user.click(button('More'));
      await user.click(button('Close drawer'));
      await act(async () => {});
      expect(aside()).toBeNull();
      expect(button('Show details')).toHaveFocus();
    });

    it('closes from the Close button (close-button) and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ onOpenChange }} />);
      await user.click(button('Show details'));
      await user.click(button('Close'));
      expect(aside()).toBeNull();
      expect(onOpenChange).toHaveBeenLastCalledWith(false, {
        reason: 'close-button',
        event: expect.any(MouseEvent),
      });
      expect(button('Show details')).toHaveFocus();
    });

    it('closes from Drawer.Close (close) and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ onOpenChange }} />);
      await user.click(button('Show details'));
      await user.click(button('Done'));
      expect(aside()).toBeNull();
      expect(onOpenChange).toHaveBeenLastCalledWith(false, {
        reason: 'close',
        event: expect.any(MouseEvent),
      });
      expect(button('Show details')).toHaveFocus();
    });

    it('sends focus to finalFocusRef', async () => {
      const user = userEvent.setup();
      function WithFinalFocus() {
        const ref = React.useRef<HTMLInputElement>(null);
        return (
          <>
            <input aria-label="Notes" ref={ref} />
            <Page drawerProps={{ finalFocusRef: ref }} />
          </>
        );
      }
      render(<WithFinalFocus />);
      await user.click(button('Show details'));
      await user.click(button('Close'));
      expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveFocus();
    });

    it('returns focus to the trigger that opened it, with two triggers', async () => {
      const user = userEvent.setup();
      render(
        <Drawer type="inline" title="Details">
          <Drawer.Trigger>
            <button type="button">First</button>
          </Drawer.Trigger>
          <Drawer.Trigger>
            <button type="button">Second</button>
          </Drawer.Trigger>
          <button type="button">Edit</button>
        </Drawer>,
      );
      await user.click(button('Second'));
      await user.click(button('Edit'));
      await user.click(button('Close'));
      expect(button('Second')).toHaveFocus();
    });

    it('leaves focus on the page or on <body> after a close from code, and restores it from inside', async () => {
      const { rerender } = render(<Controlled open={false} />);
      // Opened from code while the trigger has focus.
      button('Show details').focus();
      rerender(<Controlled open />);
      expect(complementary()).toBeInTheDocument();
      // Focus on a page button stays there.
      button('Page button').focus();
      rerender(<Controlled open={false} />);
      expect(aside()).toBeNull();
      expect(button('Page button')).toHaveFocus();

      // Focus on <body> stays there.
      button('Show details').focus();
      rerender(<Controlled open />);
      act(() => (document.activeElement as HTMLElement).blur());
      expect(document.body).toHaveFocus();
      rerender(<Controlled open={false} />);
      expect(document.body).toHaveFocus();

      // Focus inside the panel returns to the trigger, and the panel unmounts.
      button('Show details').focus();
      rerender(<Controlled open />);
      button('Edit').focus();
      rerender(<Controlled open={false} />);
      expect(aside()).toBeNull();
      expect(button('Show details')).toHaveFocus();
    });

    it('restores focus from inside a kept-mounted panel too', () => {
      const { rerender } = render(<Controlled open={false} unmountOnClose={false} />);
      button('Show details').focus();
      rerender(<Controlled open unmountOnClose={false} />);
      button('Edit').focus();
      rerender(<Controlled open={false} unmountOnClose={false} />);
      expect(aside()).toHaveAttribute('hidden');
      expect(button('Show details')).toHaveFocus();
    });

    it('never closes on Escape or on a press outside', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ defaultOpen: true, onOpenChange }} />);
      button('Edit').focus();
      await user.keyboard('{Escape}');
      button('After').focus();
      await user.keyboard('{Escape}');
      await user.click(button('Before'));
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(complementary()).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('draws its inner edge with separator (data-separator), transparent without it', () => {
      const { rerender } = render(<Page drawerProps={{ defaultOpen: true }} />);
      const panel = complementary();
      expect(panel).not.toHaveAttribute('data-separator');
      expect(panel).toHaveClass(
        'border-s',
        'border-transparent',
        'data-[separator]:border-border',
        'forced-colors:border-[CanvasText]',
      );
      rerender(<Page drawerProps={{ defaultOpen: true, separator: true }} />);
      expect(panel).toHaveAttribute('data-separator', '');
      expect(panel).toHaveClass(
        'border-s',
        'border-transparent',
        'data-[separator]:border-border',
        'forced-colors:border-[CanvasText]',
      );
    });

    it.each([
      ['start', 'border-e'],
      ['end', 'border-s'],
      ['left', 'border-r'],
      ['right', 'border-l'],
      ['bottom', 'border-t'],
    ] as const)('draws the inner edge of a %s panel with %s', (position, edge) => {
      render(<Page drawerProps={{ defaultOpen: true, position }} />);
      const panel = complementary();
      expect(panel).toHaveClass(edge);
      for (const other of ['border-e', 'border-s', 'border-r', 'border-l', 'border-t']) {
        if (other !== edge) expect(panel).not.toHaveClass(other);
      }
      expect(panel).toHaveAttribute('data-position', position);
    });

    it('renders no data-separator on an overlay drawer', () => {
      render(
        <Drawer title="Details" defaultOpen separator>
          Content
        </Drawer>,
      );
      expect(screen.getByRole('dialog', { name: 'Details' })).not.toHaveAttribute('data-separator');
      expect(screen.getByRole('dialog', { name: 'Details' })).toHaveAttribute(
        'data-type',
        'overlay',
      );
    });

    it.each([
      ['small', 'w-80'],
      ['medium', 'w-148'],
      ['large', 'w-235'],
      ['full', 'w-full'],
    ] as const)('sizes a side panel %s with %s', (size, width) => {
      render(<Page drawerProps={{ defaultOpen: true, size }} />);
      const panel = complementary();
      expect(panel).toHaveAttribute('data-size', size);
      expect(panel).toHaveClass(
        width,
        'relative',
        'flex',
        'min-h-0',
        'shrink-0',
        'flex-col',
        'max-w-full',
        'bg-background',
        'text-foreground',
      );
      // In the page layout: no placement, insets, shadow or full height of an overlay panel.
      for (const overlayClass of [
        'fixed',
        'top-0',
        'end-0',
        'h-full',
        'shadow-64',
        'pt-[env(safe-area-inset-top)]',
        'pb-[env(safe-area-inset-bottom)]',
      ]) {
        expect(panel).not.toHaveClass(overlayClass);
      }
    });

    it.each([
      ['small', 'h-80'],
      ['medium', 'h-148'],
      ['large', 'h-235'],
      ['full', 'h-full'],
    ] as const)('sizes a bottom panel %s with %s', (size, height) => {
      render(<Page drawerProps={{ defaultOpen: true, position: 'bottom', size }} />);
      const panel = complementary();
      expect(panel).toHaveAttribute('data-size', size);
      expect(panel).toHaveClass(height, 'w-full', 'max-h-full', 'border-t');
      for (const overlayClass of ['fixed', 'inset-x-0', 'bottom-0', 'w-80', 'shadow-64']) {
        expect(panel).not.toHaveClass(overlayClass);
      }
    });

    it('lets a width in className replace the size', () => {
      render(<Page drawerProps={{ defaultOpen: true, className: 'w-[480px]' }} />);
      expect(complementary()).toHaveClass('w-[480px]');
      expect(complementary()).not.toHaveClass('w-80');
    });

    it('uses the logical edge of a start panel in a right-to-left layout and toggles there', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Page drawerProps={{ position: 'start' }} />, { dir: 'rtl' });
      await user.click(button('Show details'));
      const panel = complementary();
      expect(panel).toHaveClass('border-e');
      for (const physical of ['border-l', 'border-r', 'left-0', 'right-0']) {
        expect(panel).not.toHaveClass(physical);
      }
      await user.click(button('Show details'));
      expect(aside()).toBeNull();
    });
  });

  describe('server rendering (D107)', () => {
    it.each([
      ['defaultOpen', { defaultOpen: true }],
      ['open', { open: true }],
    ] as const)('renders an inline drawer open by %s in the server HTML', (_, props) => {
      const html = renderToString(
        <Drawer type="inline" title="Details" onOpenChange={() => {}} {...props}>
          <Drawer.Trigger>
            <button type="button">Show details</button>
          </Drawer.Trigger>
          <p>Shipping address</p>
        </Drawer>,
      );
      expect(html).toContain('<aside');
      expect(html).toContain('Details');
      expect(html).toContain('Shipping address');
      expect(html).toContain('data-presence="entered"');
      expect(findDanglingIdRefsInHtml(html)).toEqual([]);
      const parsed = document.createElement('div'); // detached: nothing reaches document.body
      parsed.innerHTML = html;
      const panel = parsed.querySelector('aside');
      const trigger = parsed.querySelector('button');
      expect(panel).not.toBeNull();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', panel!.id);
      expect(panel).toHaveAttribute('aria-labelledby');
      expect(parsed.querySelector(`#${panel!.getAttribute('aria-labelledby')}`)).toHaveTextContent(
        'Details',
      );
    });

    it('hydrates without a mismatch or an onOpenChange call, then closes from its trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const element = <Page drawerProps={{ defaultOpen: true, onOpenChange }} />;
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      const onRecoverableError = vi.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        const serverAside = container.querySelector('aside');
        await act(async () => {
          root = hydrateRoot(container, element, { onRecoverableError });
        });
        expect(error).not.toHaveBeenCalled();
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(complementary()).toBe(serverAside);
        expect(button('Show details')).toHaveAttribute('aria-controls', serverAside!.id);
        await user.click(button('Show details'));
        expect(onOpenChange).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'trigger' }),
        );
        expect(aside()).toBeNull();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
      }
    });

    it('is named by a Drawer.Title once hydrated (the title prop names it in the server HTML)', async () => {
      const element = (
        <Drawer type="inline" defaultOpen onOpenChange={() => {}}>
          <Drawer.Title>Order 1042</Drawer.Title>
          <p>Two items</p>
        </Drawer>
      );
      const html = renderToString(element);
      expect(html).toContain('<aside');
      expect(html).not.toContain('aria-labelledby');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const error = vi.spyOn(console, 'error');
      const warn = vi.spyOn(console, 'warn');
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, element);
        });
        expect(complementary('Order 1042')).toBe(container.querySelector('aside'));
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        act(() => root?.unmount());
        container.remove();
        error.mockRestore();
        warn.mockRestore();
      }
    });
  });

  it('calls onOpenChange once per toggle under StrictMode', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <React.StrictMode>
        <Page drawerProps={{ onOpenChange }} />
      </React.StrictMode>,
    );
    await user.click(button('Show details'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(complementary()).toBeInTheDocument();
    await user.click(button('Show details'));
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(aside()).toBeNull();
    expect(button('Show details')).toHaveFocus();
  });

  describe('accessibility', () => {
    it('has no violations open, named by its title, with separator and inside a <main>', async () => {
      const { rerender } = render(
        <main>
          <Page drawerProps={{ defaultOpen: true }} />
        </main>,
      );
      await expectNoA11yViolations(document.body);
      rerender(
        <main>
          <Page drawerProps={{ defaultOpen: true, separator: true }} />
        </main>,
      );
      await expectNoA11yViolations(document.body);
    });

    it('has no violations named by aria-label', async () => {
      render(
        <Drawer type="inline" defaultOpen aria-label="Order details">
          <p>Two items</p>
        </Drawer>,
      );
      expect(complementary('Order details')).toBeInTheDocument();
      await expectNoA11yViolations(document.body);
    });

    it('has no violations with a start and an end inline drawer of different titles', async () => {
      render(
        <div className="flex">
          <Drawer type="inline" position="start" title="Folders" defaultOpen>
            <p>Inbox</p>
          </Drawer>
          <main>Messages</main>
          <Drawer type="inline" position="end" title="Message details" defaultOpen>
            <p>From Ada</p>
          </Drawer>
        </div>,
      );
      expect(complementary('Folders')).toBeInTheDocument();
      expect(complementary('Message details')).toBeInTheDocument();
      await expectNoA11yViolations(document.body);
    });

    it('has no violations kept mounted and closed', async () => {
      render(<Page drawerProps={{ unmountOnClose: false }} />);
      expect(aside()).toHaveAttribute('hidden');
      await expectNoA11yViolations(document.body);
    });
  });

  describe('presence (D103)', () => {
    it('renders data-presence="entered" while open', () => {
      render(<Page drawerProps={{ defaultOpen: true }} />);
      expect(complementary()).toHaveAttribute('data-presence', 'entered');
      expect(complementary()).not.toHaveAttribute('inert');
      expect(complementary()).not.toHaveAttribute('hidden');
    });

    it.each([
      ['unmounts', true],
      ['hides', false],
    ] as const)(
      'stays mounted and inert while its exit motion runs, focus already returned, then %s it',
      async (_, unmountOnClose) => {
        // 0.15 (P10-DRW-I): the presence element is the collapse element around the <aside>.
        const motion = mockAnimations({
          animated: (el) => el.classList.contains(drawerClassNames.collapse),
        });
        const user = userEvent.setup();
        render(<Page drawerProps={{ unmountOnClose }} />);
        await user.click(button('Show details'));
        await act(async () => {
          await motion.finishAll();
        });
        expect(complementary()).toHaveAttribute('data-presence', 'entered');
        const panel = complementary();
        await user.click(button('Close'));
        expect(panel).toHaveAttribute('data-presence', 'exiting');
        expect(panel).toHaveAttribute('inert');
        expect(panel).toBeInTheDocument();
        expect(button('Show details')).toHaveFocus();
        await act(async () => {
          await motion.finishAll();
        });
        if (unmountOnClose) {
          expect(aside()).toBeNull();
        } else {
          expect(aside()).toBe(panel);
          expect(panel).toHaveAttribute('data-presence', 'exited');
          expect(panel).toHaveAttribute('hidden');
          expect(panel).toHaveAttribute('inert');
        }
      },
    );
  });

  it('ignores modalType: no role, aria-modal or data-modal-type, and no layer', () => {
    render(<Page drawerProps={{ defaultOpen: true, modalType: 'alert' }} />);
    const panel = complementary();
    expect(panel).not.toHaveAttribute('role');
    expect(panel).not.toHaveAttribute('data-modal-type');
    expect(screen.queryByRole('alertdialog', { hidden: true })).not.toBeInTheDocument();
    expect(getTopmostLayer()).toBeNull();
  });

  it('ignores a backdrop slot, with a development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(<Page drawerProps={{ defaultOpen: true, backdrop: { className: 'opacity-50' } }} />);
      expect(document.querySelector('.' + drawerClassNames.backdrop)).toBeNull();
      expect(warn.mock.calls).toEqual([
        [
          '[WaveUI] Drawer: `backdrop` and `backdropMotion` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns in development when an open inline drawer has no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <Drawer type="inline" defaultOpen>
          Unnamed
        </Drawer>,
      );
      expect(warn.mock.calls).toEqual([[UNNAMED_WARNING]]);
    } finally {
      warn.mockRestore();
    }
  });

  describe('changing type (D105)', () => {
    /** A drawer open by default whose `type` the test switches, with a field and an Edit button. */
    function Switching({ type }: { type: DrawerProps['type'] }) {
      return (
        <Drawer type={type} title="Details" defaultOpen>
          <Drawer.Trigger>
            <button type="button">Show details</button>
          </Drawer.Trigger>
          <input aria-label="Notes" />
        </Drawer>
      );
    }

    const notes = () => screen.getByRole('textbox', { name: 'Notes' });

    it('remounts the content and returns focus to the trigger, overlay → inline', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<Switching type="overlay" />);
        expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument();
        await user.type(notes(), 'Ada');
        expect(notes()).toHaveFocus();
        rerender(<Switching type="inline" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(complementary()).toBeInTheDocument();
        expect(notes()).toHaveValue('');
        expect(button('Show details')).toHaveFocus();
        expect(button('Show details')).not.toHaveAttribute('aria-haspopup');
        expect(button('Show details')).toHaveAttribute('aria-controls', complementary().id);
        expect(getTopmostLayer()).toBeNull();
        expect(document.querySelectorAll('[inert]')).toHaveLength(0);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('remounts the content and moves focus into the overlay, inline → overlay', async () => {
      const user = userEvent.setup();
      const warn = vi.spyOn(console, 'warn');
      try {
        const { rerender } = render(<Switching type="inline" />);
        await user.type(notes(), 'Ada');
        rerender(<Switching type="overlay" />);
        const dialog = screen.getByRole('dialog', { name: 'Details' });
        expect(aside()).toBeNull();
        expect(notes()).toHaveValue('');
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        expect(button('Show details')).toHaveAttribute('aria-haspopup', 'dialog');
        expect(getTopmostLayer()?.kind).toBe('modal');
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(button('Show details')).toHaveFocus();
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });
});
