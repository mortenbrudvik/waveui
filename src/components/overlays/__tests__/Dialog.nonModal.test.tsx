import { afterEach, describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, type DialogContentProps, type DialogProps } from '../Dialog';
import { dialogContentClassNames } from '../../../lib/classNames';
import { useModalTrigger, useModalTriggerPart, type ModalTriggerState } from '../Dialog.shared';
import { useDismiss } from '../../../hooks/useDismiss';
import { useRestoreFocus } from '../../../hooks/useRestoreFocus';
import { Portal } from '../../portal/Portal';
import { getTopmostLayer } from '../../../lib/layers';
import { expectNoA11yViolations } from '../../../test-utils';

/*
 * P6-06 D87–D92: a non-modal Dialog (`modalType="non-modal"`) leaves the page usable: no
 * backdrop, no trap, nothing inert, no scroll lock; focus moves in on open, Escape closes it only
 * from inside, presses on the page never close it, its Tab place follows its opener, and focus
 * returns only from inside.
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

/** A page around an uncontrolled non-modal Dialog with a trigger. */
function Page({
  dialogProps,
  contentProps,
  children,
}: {
  dialogProps?: Partial<DialogProps>;
  contentProps?: Partial<DialogContentProps>;
  children?: React.ReactNode;
}) {
  return (
    <>
      <button type="button">Before</button>
      <Dialog modalType="non-modal" {...dialogProps}>
        <Dialog.Trigger>
          <button type="button">Details</button>
        </Dialog.Trigger>
        <Dialog.Content title="Order details" {...contentProps}>
          {children ?? (
            <>
              <button type="button">Edit</button>
              <button type="button">Share</button>
            </>
          )}
        </Dialog.Content>
      </Dialog>
      <button type="button">After</button>
      <input aria-label="Page field" />
    </>
  );
}

/** A controlled non-modal Dialog opened from the parent's own button (no Dialog.Trigger). */
function Controlled({
  open,
  onOpenChange = () => {},
  finalFocus = false,
}: {
  open: boolean;
  onOpenChange?: DialogProps['onOpenChange'];
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
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        modalType="non-modal"
        finalFocusRef={finalFocus ? finalRef : undefined}
      >
        <Dialog.Content title="Order details">
          <button type="button">Edit</button>
          <button type="button">Share</button>
        </Dialog.Content>
      </Dialog>
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

/** Stand-in for a Popover opened inside the dialog: a child layer with its own trigger. */
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

describe('Dialog modalType="non-modal" (P6-06 D87)', () => {
  describe('the page stays usable', () => {
    it('renders role="dialog" with data-modal-type="non-modal", no aria-modal and no backdrop', async () => {
      const user = userEvent.setup();
      const { container } = render(<Page />);
      await user.click(button('Details'));
      const dialog = screen.getByRole('dialog', { name: 'Order details' });
      expect(dialog).toHaveAttribute('data-modal-type', 'non-modal');
      expect(dialog).not.toHaveAttribute('aria-modal');
      expect(document.querySelector('.' + dialogContentClassNames.backdrop)).toBeNull();
      // The positioner centres the surface and lets presses through to the page.
      const positioner = dialog.parentElement;
      expect(positioner).toHaveClass(
        dialogContentClassNames.positioner,
        'pointer-events-none',
        'fixed',
        'inset-0',
        'flex',
        'items-center',
        'justify-center',
      );
      expect(positioner).not.toHaveClass('bg-backdrop');
      expect(dialog).toHaveClass('pointer-events-auto');
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
      render(<Page dialogProps={{ onOpenChange }} />);
      await user.click(button('Details'));
      onOpenChange.mockClear();
      await user.click(button('After'));
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(button('After')).toHaveFocus();
      // Nothing pulls focus back: there is no trap.
      await flushMicrotasks();
      expect(button('After')).toHaveFocus();
    });

    it('takes Escape only from inside: Escape on the page leaves it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page dialogProps={{ onOpenChange }} />);
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

    it('anchors a controlled dialog at the parent’s own button that opened it', async () => {
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

    it('takes its place after the button inside a wrapper-span trigger (asChild={false})', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Dialog modalType="non-modal">
            <Dialog.Trigger asChild={false}>
              <button type="button">Details</button>
            </Dialog.Trigger>
            <Dialog.Content title="Order details">
              <button type="button">Edit</button>
            </Dialog.Content>
          </Dialog>
          <button type="button">After</button>
        </>,
      );
      await user.click(button('Details'));
      expect(button('Close')).toHaveFocus();
      await user.tab({ shift: true });
      expect(button('Details')).toHaveFocus();
      act(() => button('Edit').focus());
      await user.tab();
      expect(button('After')).toHaveFocus();
    });

    it('keeps the document order once its opener is removed from the page', async () => {
      const user = userEvent.setup();
      function Opener({ open, show }: { open: boolean; show: boolean }) {
        return (
          <>
            <button type="button">First on the page</button>
            {show && <button type="button">Edit order</button>}
            <Dialog open={open} onOpenChange={() => {}} modalType="non-modal">
              <Dialog.Content title="Order details">
                <button type="button">Edit</button>
              </Dialog.Content>
            </Dialog>
          </>
        );
      }
      const view = render(<Opener open={false} show />);
      act(() => button('Edit order').focus());
      view.rerender(<Opener open show />);
      expect(button('Close')).toHaveFocus();
      view.rerender(<Opener open show={false} />);
      // With the opener gone, Shift+Tab from the first element follows the document order.
      await user.tab({ shift: true });
      expect(button('First on the page')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
    });

    it('keeps the document order when opened from code while nothing had focus', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Controlled open={false} />);
      expect(document.activeElement).toBe(document.body);
      rerender(<Controlled open />);
      expect(button('Close')).toHaveFocus();
      // The portal comes after the page: Shift+Tab from the first element reaches the page's last.
      await user.tab({ shift: true });
      expect(button('Final')).toHaveFocus();
      await user.tab();
      expect(button('Close')).toHaveFocus();
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
      // A press on a spot that takes no focus moves focus to <body>.
      act(() => (document.activeElement as HTMLElement).blur());
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);
      rerender(<Controlled open={false} />);
      expect(document.activeElement).toBe(document.body);
    });

    it('returns focus when the focused element inside was removed before the close', async () => {
      function Removing({ open, show }: { open: boolean; show: boolean }) {
        return (
          <>
            <button type="button">Edit order</button>
            <Dialog open={open} onOpenChange={() => {}} modalType="non-modal">
              <Dialog.Content title="Order details">
                {show && <button type="button">Delete line</button>}
              </Dialog.Content>
            </Dialog>
          </>
        );
      }
      const { rerender } = render(<Removing open={false} show />);
      act(() => button('Edit order').focus());
      rerender(<Removing open show />);
      act(() => button('Delete line').focus());
      rerender(<Removing open show={false} />);
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);
      rerender(<Removing open={false} show={false} />);
      expect(button('Edit order')).toHaveFocus();
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
      render(<Page dialogProps={{ onOpenChange }} />);
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

    it('Enter on the trigger while open closes it', async () => {
      const user = userEvent.setup();
      render(<Page />);
      await user.click(button('Details'));
      act(() => button('Details').focus());
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button('Details')).toHaveFocus();
    });

    it('calls onOpenChange once per change under StrictMode', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <React.StrictMode>
          <Page dialogProps={{ onOpenChange }} />
        </React.StrictMode>,
      );
      await user.click(button('Details'));
      await user.click(button('Details'));
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false]);
    });

    it('renders no aria-haspopup with the popup: false option (an inline drawer’s trigger)', async () => {
      const user = userEvent.setup();
      function DisclosureTrigger({
        state,
      }: {
        state: Omit<ModalTriggerState, 'popup' | 'trigger' | 'controlsId'>;
      }) {
        const trigger = useModalTrigger();
        return useModalTriggerPart(
          { ...state, trigger, controlsId: 'panel', popup: false },
          { children: <button type="button">Toggle panel</button> },
          'Test.Trigger',
        );
      }
      function Harness() {
        const [open, setOpen] = React.useState(false);
        return <DisclosureTrigger state={{ open, requestOpen: (next) => setOpen(next) }} />;
      }
      render(<Harness />);
      const toggle = button('Toggle panel');
      expect(toggle).not.toHaveAttribute('aria-haspopup');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('aria-controls', 'panel');
      expect(toggle).not.toHaveAttribute('aria-haspopup');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('a controlled parent that refuses the close keeps it open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<Page dialogProps={{ open: true, onOpenChange }} />);
      await user.click(button('Details'));
      expect(onOpenChange).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ reason: 'trigger' }),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('layers (D87.7, D90)', () => {
    it('Escape closes a popover opened inside first, then the dialog', async () => {
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

    it('a press in a popover opened inside counts as inside: it stays open', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <Page dialogProps={{ onOpenChange }}>
          <InnerPopover />
        </Page>,
      );
      await user.click(button('Details'));
      await user.click(button('More'));
      onOpenChange.mockClear();
      await user.click(button('Inner option'));
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('a menu on the page closes and returns focus to its own trigger while the dialog stays open', async () => {
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

      await user.click(button('Page menu'));
      await user.click(screen.getByRole('menuitem', { name: 'Print' }));
      expect(screen.getByRole('dialog', { name: 'Order details' })).toBeInTheDocument();
      expect(button('Page menu')).toHaveFocus();
    });

    it('a modal confirm opened from inside isolates the page, the non-modal dialog included, and returns focus into it', async () => {
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
      const nonModal = screen.getByRole('dialog', { name: 'Order details', hidden: true });
      expect(nonModal.closest('[inert]')).not.toBeNull();
      expect(container).toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('hidden');
      await user.click(button('Keep it'));
      expect(nonModal.closest('[inert]')).toBeNull();
      expect(container).not.toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('');
      expect(button('Cancel order')).toHaveFocus();
    });
  });

  describe('a modalType change while open (D91)', () => {
    function Switching() {
      const [modalType, setModalType] = React.useState<DialogProps['modalType']>('modal');
      return (
        <>
          <button type="button">Page button</button>
          <Dialog defaultOpen modalType={modalType}>
            <Dialog.Content title="Switching">
              <button
                type="button"
                onClick={() => setModalType((t) => (t === 'modal' ? 'non-modal' : 'modal'))}
              >
                Switch
              </button>
            </Dialog.Content>
          </Dialog>
        </>
      );
    }

    it('releases the isolation, the trap and the scroll lock, and takes them back', async () => {
      const user = userEvent.setup();
      const { container } = render(<Switching />);
      await user.click(screen.getByRole('button', { name: 'Switch' }));
      // non-modal now
      const dialog = screen.getByRole('dialog', { name: 'Switching' });
      expect(dialog).toHaveAttribute('data-modal-type', 'non-modal');
      expect(container).not.toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('');
      expect(button('Switch')).toHaveFocus();
      act(() => button('Page button').focus());
      await flushMicrotasks();
      expect(button('Page button')).toHaveFocus();

      await user.click(button('Switch'));
      expect(dialog).toHaveAttribute('data-modal-type', 'modal');
      expect(container).toHaveAttribute('inert');
      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(button('Switch')).toHaveFocus();
      // The surface element is kept across the switch.
      expect(screen.getByRole('dialog', { name: 'Switching' })).toBe(dialog);
    });
  });

  it('has no accessibility violations while open, with the page around it', async () => {
    const user = userEvent.setup();
    render(
      <main>
        <Page />
      </main>,
    );
    await user.click(button('Details'));
    await expectNoA11yViolations();
  });

  it('runs the consumer’s onKeyDown first: preventDefault() there skips its own Tab handling', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
    render(<Page contentProps={{ onKeyDown }} />);
    await user.click(button('Details'));
    act(() => button('Share').focus());
    fireEvent.keyDown(button('Share'), { key: 'Tab' });
    expect(onKeyDown).toHaveBeenCalled();
    expect(button('Share')).toHaveFocus();
  });
});
