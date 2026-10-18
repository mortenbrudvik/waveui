import { afterEach, describe, it, expect, expectTypeOf, vi } from 'vitest';
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Drawer,
  type DrawerModalType,
  type DrawerProps,
  type DrawerTriggerRenderProps,
} from '../Drawer';
import { Dialog } from '../Dialog';
import { Toaster } from '../../feedback/Toaster';
import { dialogContentClassNames, drawerClassNames } from '../../../lib/classNames';
import { useDismiss } from '../../../hooks/useDismiss';
import { useRestoreFocus } from '../../../hooks/useRestoreFocus';
import { Portal } from '../../portal/Portal';
import { getTopmostLayer } from '../../../lib/layers';
import type { ModalType } from '../../../lib/types';
import { expectNoA11yViolations, renderWithProviders } from '../../../test-utils';

/*
 * P6-06 D86, D87: Drawer's `modalType` — `modal` (the 0.10 drawer), `alert` and `non-modal` (the
 * page stays usable: no backdrop, no trap, nothing inert, no scroll lock; focus moves in on open,
 * Escape closes it only from inside, presses on the page never close it, its Tab place follows
 * its opener, and focus returns only from inside).
 */

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  expect(document.documentElement.style.overflow).toBe('');
});

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function button(name: string | RegExp) {
  return screen.getByRole('button', { name });
}

const pageField = () => screen.getByRole('textbox', { name: 'Page field' });
const backdropElement = () => document.querySelector<HTMLElement>('.' + drawerClassNames.backdrop);

/** A page around an uncontrolled Drawer with a trigger, non-modal unless `drawerProps` says so. */
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
      <Drawer modalType="non-modal" title="Order details" {...drawerProps}>
        <Drawer.Trigger>
          <button type="button">Details</button>
        </Drawer.Trigger>
        {children ?? (
          <>
            <button type="button">Edit</button>
            <button type="button">Share</button>
          </>
        )}
      </Drawer>
      <button type="button">After</button>
      <input aria-label="Page field" />
    </>
  );
}

/** A controlled non-modal Drawer opened from the parent's own button (no Drawer.Trigger). */
function Controlled({
  open,
  onOpenChange = () => {},
  finalFocus = false,
}: {
  open: boolean;
  onOpenChange?: DrawerProps['onOpenChange'];
  finalFocus?: boolean;
}) {
  const finalRef = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button">Edit order</button>
      <button type="button">Next to the opener</button>
      <input aria-label="Page field" />
      <button type="button" ref={finalRef}>
        Final
      </button>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        modalType="non-modal"
        title="Order details"
        finalFocusRef={finalFocus ? finalRef : undefined}
      >
        <button type="button">Edit</button>
        <button type="button">Share</button>
      </Drawer>
    </>
  );
}

/** Stand-in for a Menu on the page: a `menu` layer that returns focus to its own trigger. */
function PageMenu() {
  const [open, setOpen] = React.useState(false);
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setSurface(el);
  }, []);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [surfaceRef, triggerRef],
    anchorRef: triggerRef,
    kind: 'menu',
  });
  useRestoreFocus({ enabled: open, container: surface, triggerRef, onlyIfFocusInside: true });
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        Page menu
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={attach} role="menu" aria-label="Page menu">
            <button type="button" role="menuitem" autoFocus onClick={() => setOpen(false)}>
              Print
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}

/** Stand-in for a Popover opened inside the drawer: a child layer with its own trigger. */
function InnerPopover() {
  const [open, setOpen] = React.useState(false);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => setOpen(false),
    refs: [surfaceRef, triggerRef],
    anchorRef: triggerRef,
  });
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        More
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={surfaceRef} data-testid="inner-popover">
            <button type="button" autoFocus>
              Inner option
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}

describe('Drawer modalType (P6-06 D86)', () => {
  it('renders data-modal-type="modal" and role="dialog" by default, with its backdrop', () => {
    render(
      <Drawer defaultOpen title="Filters">
        Body
      </Drawer>,
    );
    const panel = screen.getByRole('dialog', { name: 'Filters' });
    expect(panel).toHaveAttribute('data-modal-type', 'modal');
    expect(backdropElement()).not.toBeNull();
  });

  it('types modalType with the shared ModalType, default modal', () => {
    expectTypeOf<DrawerModalType>().toEqualTypeOf<ModalType>();
    expectTypeOf<DrawerProps['modalType']>().toEqualTypeOf<DrawerModalType | undefined>();
    // An inline drawer's trigger renders no aria-haspopup (D89), so the render prop is optional.
    expectTypeOf<DrawerTriggerRenderProps['aria-haspopup']>().toEqualTypeOf<'dialog' | undefined>();
    const nonModal: DrawerProps['modalType'] = 'non-modal';
    expect(nonModal).toBe('non-modal');
    // @ts-expect-error not a modal type
    const none: DrawerProps['modalType'] = 'none';
    expect(none).toBe('none');
  });

  describe('alert drawers (modalType="alert")', () => {
    function Alert(props: Partial<DrawerProps>) {
      return (
        <Drawer modalType="alert" title="Discard changes?" {...props}>
          <Drawer.Trigger>
            <button type="button">Discard</button>
          </Drawer.Trigger>
          <input aria-label="Reason" autoFocus />
          <Drawer.Close>
            <button type="button">Keep editing</button>
          </Drawer.Close>
        </Drawer>
      );
    }

    it('renders role="alertdialog", named by its title, with data-modal-type="alert"', async () => {
      const user = userEvent.setup();
      render(<Alert />);
      await user.click(button('Discard'));
      const panel = screen.getByRole('alertdialog', { name: 'Discard changes?' });
      expect(panel).toHaveAttribute('data-modal-type', 'alert');
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps a consumer role', () => {
      render(<Alert defaultOpen role="dialog" />);
      expect(screen.getByRole('dialog', { name: 'Discard changes?' })).toHaveAttribute(
        'data-modal-type',
        'alert',
      );
    });

    it('a backdrop press neither closes it nor moves focus', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Alert onOpenChange={onOpenChange} />);
      await user.click(button('Discard'));
      onOpenChange.mockClear();
      const field = screen.getByRole('textbox', { name: 'Reason' });
      expect(field).toHaveFocus();
      const backdrop = backdropElement()!;
      const press = fireEvent.mouseDown(backdrop);
      // `fireEvent` returns false when the default was prevented: the press does not blur.
      expect(press).toBe(false);
      await user.click(backdrop);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(field).toHaveFocus();
    });

    it('closes on Escape (reason escape) and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Alert onOpenChange={onOpenChange} />);
      await user.click(button('Discard'));
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(button('Discard')).toHaveFocus();
    });

    it('isolates the page and traps focus as a modal drawer does', async () => {
      const user = userEvent.setup();
      const { container } = render(<Alert />);
      await user.click(button('Discard'));
      expect(container).toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('hidden');
      act(() => button('Keep editing').focus());
      await user.tab();
      expect(button('Close')).toHaveFocus();
    });

    it('has no accessibility violations while open', async () => {
      render(<Alert defaultOpen />);
      await expectNoA11yViolations();
    });
  });
});

describe('Drawer modalType="non-modal" (P6-06 D87)', () => {
  describe('the page stays usable', () => {
    it('renders role="dialog" with data-modal-type="non-modal", no aria-modal and no backdrop', async () => {
      const user = userEvent.setup();
      const { container } = render(<Page />);
      await user.click(button('Details'));
      const panel = screen.getByRole('dialog', { name: 'Order details' });
      expect(panel).toHaveAttribute('data-modal-type', 'non-modal');
      expect(panel).not.toHaveAttribute('aria-modal');
      expect(backdropElement()).toBeNull();
      expect(container).not.toHaveAttribute('inert');
      expect(document.querySelectorAll('[inert]')).toHaveLength(0);
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.getAttribute('style') ?? '').toBe('');
    });

    it('moves focus to the first focusable element on open (the Close button)', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Details'));
      expect(button('Close')).toHaveFocus();
    });

    it('keeps focus on an autoFocus field inside', async () => {
      const user = userEvent.setup();
      render(
        <Page>
          <input aria-label="Note" autoFocus />
        </Page>,
      );
      await user.click(button('Details'));
      expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
    });

    it('keeps focus inside when opened under StrictMode', async () => {
      const user = userEvent.setup();
      render(
        <React.StrictMode>
          <Page />
        </React.StrictMode>,
      );
      await user.click(button('Details'));
      await flushMicrotasks();
      expect(button('Close')).toHaveFocus();
    });

    it('does not close when the page is pressed: the page button takes focus', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ onOpenChange }} />);
      await user.click(button('Details'));
      onOpenChange.mockClear();
      await user.click(button('After'));
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(button('After')).toHaveFocus();
      await flushMicrotasks();
      expect(button('After')).toHaveFocus();
    });

    it('takes Escape only from inside: Escape on the page leaves it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ onOpenChange }} />);
      await user.click(button('Details'));
      onOpenChange.mockClear();
      await user.click(pageField());
      await user.keyboard('{Escape}');
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(button('Edit'));
      await user.keyboard('{Escape}');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'escape' }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button('Details')).toHaveFocus();
    });
  });

  describe('keyboard order: its place follows the opener (D87.5)', () => {
    it('Tab from the trigger enters at the first element; Tab past the last continues after the trigger', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Details'));
      act(() => button('Details').focus());
      await user.tab();
      expect(button('Close')).toHaveFocus();
      await user.tab();
      expect(button('Edit')).toHaveFocus();
      await user.tab();
      expect(button('Share')).toHaveFocus();
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('Shift+Tab from the first element returns to the trigger; from the element after it enters at the last', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Details'));
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Details')).toHaveFocus();

      act(() => button('After').focus());
      await user.tab({ shift: true });
      expect(button('Share')).toHaveFocus();
    });

    it('follows the opener for a bottom drawer too', async () => {
      const user = userEvent.setup();
      render(<Page drawerProps={{ position: 'bottom' }} />);
      await user.click(button('Details'));
      act(() => button('Share').focus());
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('anchors a controlled drawer at the parent’s own button that opened it', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Controlled open={false} />);
      act(() => button('Edit order').focus());
      rerender(<Controlled open />);
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Edit order')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
      act(() => button('Share').focus());
      await user.tab();
      expect(button('Next to the opener')).toHaveFocus();
    });

    it('keeps the document order when opened from code while nothing had focus', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Controlled open={false} />);
      expect(document.activeElement).toBe(document.body);
      rerender(<Controlled open />);
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Final')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
    });

    it('runs the consumer’s onKeyDown first: preventDefault() there skips its own Tab handling', async () => {
      const user = userEvent.setup();
      const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
      render(<Page drawerProps={{ onKeyDown }} />);
      await user.click(button('Details'));
      act(() => button('Share').focus());
      fireEvent.keyDown(button('Share'), { key: 'Tab' });
      expect(onKeyDown).toHaveBeenCalled();
      expect(button('Share')).toHaveFocus();
    });
  });

  describe('focus return (D87.6, D92)', () => {
    it('a controlled close while focus is in a page field leaves focus there', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Controlled open={false} />);
      act(() => button('Edit order').focus());
      rerender(<Controlled open />);
      await user.click(pageField());
      rerender(<Controlled open={false} />);
      expect(pageField()).toHaveFocus();
    });

    it('a controlled close while focus is on <body> leaves it there', async () => {
      const { rerender } = render(<Controlled open={false} />);
      act(() => button('Edit order').focus());
      rerender(<Controlled open />);
      act(() => (document.activeElement as HTMLElement).blur());
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);
      rerender(<Controlled open={false} />);
      expect(document.activeElement).toBe(document.body);
    });

    it('the Close button returns focus to the trigger', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Details'));
      await user.click(button('Close'));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button('Details')).toHaveFocus();
    });

    it('honours finalFocusRef when focus is inside', async () => {
      const user = userEvent.setup();
      function App() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open
            </button>
            <Controlled open={open} onOpenChange={setOpen} finalFocus />
          </>
        );
      }
      render(<App />);
      await user.click(button('Open'));
      await user.click(button('Close'));
      expect(button('Final')).toHaveFocus();
    });
  });

  describe('the trigger toggles (D89)', () => {
    it('a second click on the trigger closes it, reason trigger; focus stays on the trigger', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ onOpenChange }} />);
      const trigger = button('Details');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await user.click(trigger);
      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange).toHaveBeenLastCalledWith(
        false,
        expect.objectContaining({ reason: 'trigger', event: expect.any(Event) }),
      );
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveFocus();
    });

    it('calls onOpenChange once per change under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <Page drawerProps={{ onOpenChange }} />
        </React.StrictMode>,
      );
      await user.click(button('Details'));
      await user.click(button('Details'));
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false]);
    });

    it('a controlled parent that refuses the close keeps it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page drawerProps={{ open: true, onOpenChange }} />);
      await user.click(button('Details'));
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'trigger' }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('layers (D87.7, D90)', () => {
    it('Escape closes a popover opened inside first, then the drawer', async () => {
      const user = userEvent.setup();
      render(
        <Page>
          <InnerPopover />
        </Page>,
      );
      await user.click(button('Details'));
      await user.click(button('More'));
      expect(button('Inner option')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('inner-popover')).toBeNull();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      act(() => button('More').focus());
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button('Details')).toHaveFocus();
    });

    it('a menu on the page closes and returns focus to its own trigger while the drawer stays open', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Page />
          <PageMenu />
        </>,
      );
      await user.click(button('Details'));
      await user.click(button('Page menu'));
      expect(screen.getByRole('menuitem', { name: 'Print' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeInTheDocument();
      expect(button('Page menu')).toHaveFocus();
    });

    it('a modal confirm opened from inside isolates the page, the drawer included, and returns focus into it', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Page>
          <Dialog>
            <Dialog.Trigger>
              <button type="button">Cancel order</button>
            </Dialog.Trigger>
            <Dialog.Content title="Cancel the order?">
              <Dialog.Close>
                <button type="button">Keep it</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog>
        </Page>,
      );
      await user.click(button('Details'));
      await user.click(button('Cancel order'));
      const drawer = screen.getByRole('dialog', { name: 'Order details', hidden: true });
      expect(drawer.closest('[inert]')).not.toBeNull();
      expect(container).toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.click(button('Keep it'));
      expect(drawer.closest('[inert]')).toBeNull();
      expect(container).not.toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('');
      expect(button('Cancel order')).toHaveFocus();
    });
  });

  describe('a modalType change while open (D91)', () => {
    function Switching() {
      const [modalType, setModalType] = React.useState<DrawerProps['modalType']>('modal');
      return (
        <>
          <button type="button">Page button</button>
          <Drawer defaultOpen title="Switching" modalType={modalType}>
            <button
              type="button"
              onClick={() => setModalType((t) => (t === 'modal' ? 'non-modal' : 'modal'))}
            >
              Switch
            </button>
          </Drawer>
        </>
      );
    }

    it('releases the backdrop, the isolation, the trap and the scroll lock, and takes them back', async () => {
      const user = userEvent.setup();
      const { container } = render(<Switching />);
      expect(backdropElement()).not.toBeNull();
      await user.click(button('Switch'));
      const panel = screen.getByRole('dialog', { name: 'Switching' });
      expect(panel).toHaveAttribute('data-modal-type', 'non-modal');
      expect(backdropElement()).toBeNull();
      expect(container).not.toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('');
      expect(button('Switch')).toHaveFocus();
      act(() => button('Page button').focus());
      await flushMicrotasks();
      expect(button('Page button')).toHaveFocus();

      await user.click(button('Switch'));
      expect(panel).toHaveAttribute('data-modal-type', 'modal');
      expect(backdropElement()).not.toBeNull();
      expect(container).toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(button('Switch')).toHaveFocus();
      // The panel element is kept across the switch.
      expect(screen.getByRole('dialog', { name: 'Switching' })).toBe(panel);
    });
  });

  describe('size="full" (D87.8)', () => {
    const NON_MODAL_FULL_WARNING =
      '[WaveUI] Drawer: `size="full"` with `modalType="non-modal"` covers the whole page while leaving it usable, so Tab reaches controls hidden behind the drawer. Use `modalType="modal"`, `type="inline"`, or a smaller size with its room reserved in the page layout.';

    it.each([['end'], ['bottom']] as const)(
      'warns once when an open %s drawer is full and non-modal',
      (position) => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          render(
            <React.StrictMode>
              <Drawer defaultOpen modalType="non-modal" size="full" position={position} title="All">
                Body
              </Drawer>
            </React.StrictMode>,
          );
          expect(warn.mock.calls).toEqual([[NON_MODAL_FULL_WARNING]]);
        } finally {
          warn.mockRestore();
        }
      },
    );

    it.each([
      ['a full modal drawer', { size: 'full', modalType: 'modal' }],
      ['a large non-modal drawer', { size: 'large', modalType: 'non-modal' }],
      ['a closed full non-modal drawer', { size: 'full', modalType: 'non-modal', open: false }],
    ] as const)('does not warn for %s', (_, props) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Drawer defaultOpen title="Filters" {...props}>
            Body
          </Drawer>,
        );
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('beside a Toaster (D84, D90)', () => {
    it('moves the toasts beside a non-modal end drawer', () => {
      const attach = (el: HTMLElement | null) => {
        if (!el) return;
        el.getBoundingClientRect = () =>
          ({
            left: 704,
            right: 1024,
            top: 0,
            bottom: 768,
            width: 320,
            height: 768,
            x: 704,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect;
      };
      render(
        <Toaster>
          <Drawer defaultOpen modalType="non-modal" title="Details" ref={attach}>
            Body
          </Drawer>
        </Toaster>,
      );
      const region = screen.getByRole('region', { name: 'Notifications' });
      expect(region.style.getPropertyValue('--wave-toaster-offset')).toBe('320px');
    });
  });

  describe('accessibility', () => {
    it('has no violations while open, with the page around it', async () => {
      const user = userEvent.setup();
      render(
        <main>
          <Page />
        </main>,
      );
      await user.click(button('Details'));
      await expectNoA11yViolations();
    });

    it('has no violations for a bottom drawer', async () => {
      const user = userEvent.setup();
      render(
        <main>
          <Page drawerProps={{ position: 'bottom' }} />
        </main>,
      );
      await user.click(button('Details'));
      await expectNoA11yViolations();
    });
  });
});

describe('Drawer backdrop, closeButton and titleAction (P6-06 D93–D95, D98)', () => {
  const dialogBackdrop = () =>
    document.querySelector<HTMLElement>('.' + dialogContentClassNames.backdrop);

  describe('backdrop', () => {
    it('renders an aria-hidden, dimmed backdrop as the panel’s previous sibling', () => {
      render(
        <Drawer defaultOpen title="Filters">
          Body
        </Drawer>,
      );
      const panel = screen.getByRole('dialog', { name: 'Filters' });
      const backdrop = panel.previousElementSibling;
      expect(backdrop).toBe(backdropElement());
      expect(backdrop).toHaveClass(drawerClassNames.backdrop, 'fixed', 'inset-0', 'bg-backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      expect(backdrop).toHaveAttribute('data-appearance', 'dimmed');
    });

    it('gives a slot object’s class, style and data attribute to the backdrop', () => {
      render(
        <Drawer
          defaultOpen
          title="Filters"
          backdrop={{ className: 'bg-transparent', style: { opacity: 0.4 }, 'data-testid': 'bd' }}
        >
          Body
        </Drawer>,
      );
      const backdrop = screen.getByTestId('bd');
      expect(backdrop).toBe(backdropElement());
      expect(backdrop).toHaveClass('bg-transparent');
      expect(backdrop).not.toHaveClass('bg-backdrop');
      expect(backdrop.style.opacity).toBe('0.4');
    });

    it('{ appearance: "transparent" } renders a transparent backdrop', () => {
      render(
        <Drawer defaultOpen title="Filters" backdrop={{ appearance: 'transparent' }}>
          Body
        </Drawer>,
      );
      expect(backdropElement()).toHaveAttribute('data-appearance', 'transparent');
      expect(backdropElement()).toHaveClass('bg-transparent');
    });

    it('null renders none: the page stays inert, and a press outside still closes it', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <>
          <button type="button">Page button</button>
          <Drawer defaultOpen title="Filters" backdrop={null} onOpenChange={onOpenChange}>
            Body
          </Drawer>
        </>,
      );
      expect(backdropElement()).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Page button', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      await user.click(document.body);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'outside-press' }),
      );
    });

    it('a press on the backdrop’s content closes a modal drawer', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Filters" backdrop={<span data-testid="art">Pattern</span>}>
          Body
        </Drawer>,
      );
      expect(screen.getByTestId('art').parentElement).toBe(backdropElement());
      await user.click(screen.getByTestId('art'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('a Dialog opened beside the drawer is transparent while the drawer stays dimmed', async () => {
      const user = userEvent.setup();
      function Beside() {
        const [confirm, setConfirm] = React.useState(false);
        return (
          <>
            <Drawer defaultOpen title="Orders">
              <button type="button" onClick={() => setConfirm(true)}>
                Delete row
              </button>
            </Drawer>
            <Dialog open={confirm} onOpenChange={setConfirm}>
              <Dialog.Content title="Delete the row?">Sure?</Dialog.Content>
            </Dialog>
          </>
        );
      }
      render(<Beside />);
      await user.click(button('Delete row'));
      expect(dialogBackdrop()).toHaveAttribute('data-appearance', 'transparent');
      expect(backdropElement()).toHaveAttribute('data-appearance', 'dimmed');
      await user.keyboard('{Escape}');
      expect(dialogBackdrop()).toBeNull();
      expect(backdropElement()).toHaveAttribute('data-appearance', 'dimmed');
    });

    it('a drawer opened from a Dialog’s content is transparent', async () => {
      const user = userEvent.setup();
      render(
        <Dialog defaultOpen>
          <Dialog.Content title="Settings">
            <Drawer title="Advanced">
              <Drawer.Trigger>
                <button type="button">Advanced</button>
              </Drawer.Trigger>
              Body
            </Drawer>
          </Dialog.Content>
        </Dialog>,
      );
      await user.click(button('Advanced'));
      expect(backdropElement()).toHaveAttribute('data-appearance', 'transparent');
      expect(dialogBackdrop()).toHaveAttribute('data-appearance', 'dimmed');
    });

    it('ignores a backdrop slot on a non-modal drawer, with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const user = userEvent.setup();
        render(
          <React.StrictMode>
            <Page drawerProps={{ backdrop: { className: 'bg-transparent' } }} />
          </React.StrictMode>,
        );
        await user.click(button('Details'));
        expect(backdropElement()).toBeNull();
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Drawer: `backdrop` is ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('closeButton', () => {
    it('null hides the built-in header’s Close button; Escape still closes', async () => {
      const user = userEvent.setup();
      render(
        <Drawer defaultOpen title="Filters" closeButton={null}>
          <button type="button">Apply</button>
        </Drawer>,
      );
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Filters' }).parentElement).toHaveClass(
        drawerClassNames.header,
      );
      expect(button('Apply')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('null hides every Drawer.HeaderTitle’s Close button', () => {
      render(
        <Drawer defaultOpen closeButton={null}>
          <Drawer.Header>
            <Drawer.HeaderTitle>Settings</Drawer.HeaderTitle>
          </Drawer.Header>
          <Drawer.Header>
            <Drawer.HeaderTitle>Second header</Drawer.HeaderTitle>
          </Drawer.Header>
          Body
        </Drawer>,
      );
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    });

    it('renders no built-in header row when nothing is left in it', () => {
      render(
        <Drawer defaultOpen aria-label="Quick filters" closeButton={null}>
          <button type="button">Apply</button>
        </Drawer>,
      );
      const panel = screen.getByRole('dialog', { name: 'Quick filters' });
      expect(panel.querySelector('.' + drawerClassNames.header)).toBeNull();
    });

    it('renders content inside the Close buttons of the header and of a Drawer.HeaderTitle', () => {
      const { unmount } = render(
        <Drawer defaultOpen title="Filters" closeButton={<svg data-testid="glyph" />}>
          Body
        </Drawer>,
      );
      const close = button('Close');
      expect(close).toHaveClass(drawerClassNames.closeButton, 'ms-auto');
      expect(close).toContainElement(screen.getByTestId('glyph'));
      expect(screen.getByTestId('glyph').closest('[aria-hidden="true"]')).not.toBeNull();
      unmount();
      render(
        <Drawer defaultOpen closeButton={<svg data-testid="glyph" />} closeLabel="Close settings">
          <Drawer.Header>
            <Drawer.HeaderTitle>Settings</Drawer.HeaderTitle>
          </Drawer.Header>
          Body
        </Drawer>,
      );
      expect(button('Close settings')).toContainElement(screen.getByTestId('glyph'));
    });

    it('merges a button with a text label, named by its text, with a warning', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();
        render(
          <Drawer
            defaultOpen
            title="Filters"
            onOpenChange={onOpenChange}
            closeButton={<button type="button">Done</button>}
          >
            Body
          </Drawer>,
        );
        const done = button('Done');
        expect(done).toHaveClass(drawerClassNames.closeButton);
        expect(done).not.toHaveAttribute('aria-label');
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Drawer: `closeButton` received a button element; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `closeButton={<CloseIcon />}`.',
          ],
        ]);
        await user.click(done);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'close-button' }),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('titleAction', () => {
    it.each(['ltr', 'rtl'] as const)(
      'renders between the heading and the Close button, which drops its ms-auto (%s)',
      async (dir) => {
        const user = userEvent.setup();
        renderWithProviders(
          <Drawer
            defaultOpen
            title="Filters"
            titleAction={
              <button type="button" aria-label="Pin">
                P
              </button>
            }
          >
            <button type="button">Apply</button>
          </Drawer>,
          { dir },
        );
        const heading = screen.getByRole('heading', { name: 'Filters' });
        const pin = button('Pin');
        const close = button('Close');
        const action = pin.parentElement;
        expect(action).toHaveClass(
          drawerClassNames.titleAction,
          'ms-auto',
          'flex',
          'shrink-0',
          'items-center',
          'gap-1',
        );
        expect(heading.nextElementSibling).toBe(action);
        expect(action?.nextElementSibling).toBe(close);
        expect(close).not.toHaveClass('ms-auto');
        // Initial focus is the first focusable element, then the Tab order follows the DOM.
        expect(pin).toHaveFocus();
        await user.tab();
        expect(close).toHaveFocus();
        await user.tab();
        expect(button('Apply')).toHaveFocus();
      },
    );

    it('renders nothing for content that renders nothing, and the Close button keeps ms-auto', () => {
      render(
        <Drawer defaultOpen title="Filters" titleAction={[]}>
          Body
        </Drawer>,
      );
      expect(document.querySelector('.' + drawerClassNames.titleAction)).toBeNull();
      expect(button('Close')).toHaveClass('ms-auto');
    });

    it('is ignored next to a Drawer.Header, with the title-ignored warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        render(
          <Drawer
            defaultOpen
            titleAction={
              <button type="button" aria-label="Pin">
                P
              </button>
            }
          >
            <Drawer.Header>
              <Drawer.HeaderTitle>Settings</Drawer.HeaderTitle>
            </Drawer.Header>
            Body
          </Drawer>,
        );
        expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument();
        expect(warn.mock.calls).toEqual([
          [
            '[WaveUI] Drawer: `title` and `titleAction` are ignored because a Drawer.Header is among the children. Put a Drawer.HeaderTitle (with its `action`) in the header instead.',
          ],
        ]);
      } finally {
        warn.mockRestore();
      }
    });

    it('has no accessibility violations with a title action', async () => {
      render(
        <Drawer
          defaultOpen
          title="Filters"
          titleAction={
            <button type="button" aria-label="Pin">
              P
            </button>
          }
        >
          Body
        </Drawer>,
      );
      await expectNoA11yViolations();
    });
  });
});
