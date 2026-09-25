import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useModalLayer, type UseModalLayerOptions } from '../useModalLayer';
import { useDismiss, type DismissLayer } from '../useDismiss';
import { Portal } from '../../components/portal/Portal';
import { getTopmostLayer } from '../../lib/layers';

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

function button(name: string) {
  return screen.getByRole('button', { name });
}

interface DialogProps extends Partial<
  Omit<UseModalLayerOptions, 'open' | 'onDismiss' | 'refs' | 'container'>
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: string;
  children?: React.ReactNode;
  onLayer?: (layer: DismissLayer) => void;
}

/** A stand-in Dialog built only on useModalLayer + Portal (as P15 will). */
function Dialog({
  open,
  onOpenChange,
  label = 'Dialog',
  children,
  onLayer,
  ...options
}: DialogProps) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setSurface(el);
  }, []);
  const layer = useModalLayer({
    open,
    onDismiss: () => onOpenChange(false),
    refs: [surfaceRef],
    container: surface,
    ...options,
  });
  onLayer?.(layer);
  if (!open) return null;
  return (
    <Portal layerId={layer.layerId}>
      <div data-testid={`${label}-backdrop`} />
      <div ref={setRefs} role="dialog" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </Portal>
  );
}

function App({
  children,
  dialogProps,
}: {
  children?: React.ReactNode;
  dialogProps?: Partial<DialogProps>;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Background</button>
      <Dialog open={open} onOpenChange={setOpen} triggerRef={triggerRef} {...dialogProps}>
        <button type="button">First</button>
        {children}
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </Dialog>
    </>
  );
}

describe('useModalLayer', () => {
  it('traps focus, isolates the page and locks scrolling while open', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(button('Open'));
    expect(button('First')).toHaveFocus();
    expect(container).toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.tab();
    await user.tab();
    expect(button('First')).toHaveFocus();
  });

  it('closes on Escape and restores focus to the opener after lifting the isolation', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(button('Open'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container).not.toHaveAttribute('inert');
    expect(document.documentElement.style.overflow).toBe('');
    expect(button('Open')).toHaveFocus();
  });

  it('closes on a backdrop click, but not on a drag from the content to the backdrop', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(button('Open'));
    fireEvent.pointerDown(button('First'));
    fireEvent.click(screen.getByTestId('Dialog-backdrop'));
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeInTheDocument();
    await user.click(screen.getByTestId('Dialog-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Open')).toHaveFocus();
  });

  it('restores focus and page state when unmounted while open', async () => {
    const user = userEvent.setup();
    function Conditional() {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Show
          </button>
          {show && (
            <Dialog open onOpenChange={() => setShow(false)}>
              <button type="button" onClick={() => setShow(false)}>
                Remove
              </button>
            </Dialog>
          )}
        </>
      );
    }
    render(<Conditional />);
    await user.click(button('Show'));
    expect(button('Remove')).toHaveFocus();
    await user.click(button('Remove'));
    await flushMicrotasks();
    expect(button('Show')).toHaveFocus();
  });

  it('keeps focus inside when opened under StrictMode', async () => {
    const user = userEvent.setup();
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    await user.click(button('Open'));
    await flushMicrotasks();
    expect(button('First')).toHaveFocus();
  });

  it('honours finalFocusRef and initialFocus', async () => {
    const user = userEvent.setup();
    function WithRefs() {
      const [open, setOpen] = React.useState(false);
      const finalRef = React.useRef<HTMLButtonElement>(null);
      const initialRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button" ref={finalRef}>
            Return here
          </button>
          <Dialog
            open={open}
            onOpenChange={setOpen}
            finalFocusRef={finalRef}
            initialFocus={initialRef}
          >
            <button type="button">One</button>
            <button type="button" ref={initialRef} onClick={() => setOpen(false)}>
              Two
            </button>
          </Dialog>
        </>
      );
    }
    render(<WithRefs />);
    await user.click(button('Open'));
    expect(button('Two')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button('Return here')).toHaveFocus();
  });

  it('moves focus to the next row when the opener’s row is removed on Confirm (no trigger, no finalFocusRef)', async () => {
    const user = userEvent.setup();
    function Rows() {
      const [rows, setRows] = React.useState(['a', 'b', 'c']);
      const [pending, setPending] = React.useState<string | null>(null);
      return (
        <>
          <ul aria-label="Rows">
            {rows.map((row) => (
              <li key={row}>
                {row}{' '}
                <button type="button" onClick={() => setPending(row)}>
                  {`Delete ${row}`}
                </button>
              </li>
            ))}
          </ul>
          <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
            <button
              type="button"
              onClick={() => {
                setRows((r) => r.filter((x) => x !== pending));
                setPending(null);
              }}
            >
              Confirm
            </button>
          </Dialog>
        </>
      );
    }
    render(<Rows />);
    act(() => button('Delete b').focus());
    await user.keyboard('{Enter}');
    expect(button('Confirm')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Delete c')).toHaveFocus();
  });

  it.each([
    ['after', false],
    ['before', true],
  ])(
    'restores to the trigger of a popover whose item opened the modal as the popover closed (modal %s it)',
    async (_placement, modalFirst) => {
      const user = userEvent.setup();
      /** A stand-in controlled popover (portaled layer anchored to its trigger). */
      function Popover({
        open,
        onOpenChange,
        children,
      }: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        children: React.ReactNode;
      }) {
        const surfaceRef = React.useRef<HTMLDivElement>(null);
        const triggerRef = React.useRef<HTMLButtonElement>(null);
        const { layerId } = useDismiss({
          open,
          onDismiss: () => onOpenChange(false),
          refs: [surfaceRef, triggerRef],
          anchorRef: triggerRef,
          kind: 'popover',
        });
        return (
          <>
            <button type="button" ref={triggerRef} onClick={() => onOpenChange(!open)}>
              More
            </button>
            {open && (
              <Portal layerId={layerId}>
                <div ref={surfaceRef} role="menu" aria-label="More">
                  {children}
                </div>
              </Portal>
            )}
          </>
        );
      }
      function Page() {
        const [popover, setPopover] = React.useState(false);
        const [open, setOpen] = React.useState(false);
        // No trigger and no finalFocusRef: the modal is opened from the popover's menu item.
        const modal = (
          <Dialog open={open} onOpenChange={setOpen} label="Rename">
            <input aria-label="New name" />
          </Dialog>
        );
        return (
          <>
            {modalFirst && modal}
            <Popover open={popover} onOpenChange={setPopover}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPopover(false);
                  setOpen(true);
                }}
              >
                Rename
              </button>
            </Popover>
            {!modalFirst && modal}
          </>
        );
      }
      render(<Page />);
      await user.click(button('More'));
      act(() => screen.getByRole('menuitem', { name: 'Rename' }).focus());
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.getByRole('textbox', { name: 'New name' })).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(button('More')).toHaveFocus();
    },
  );

  it('moves focus into the sibling modal that stays open when both were opened by one click', async () => {
    const user = userEvent.setup();
    function Both() {
      const [drawer, setDrawer] = React.useState(false);
      const [dialog, setDialog] = React.useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setDrawer(true);
              setDialog(true);
            }}
          >
            Open both
          </button>
          <Dialog open={drawer} onOpenChange={setDrawer} label="Drawer">
            <button type="button">Drawer action</button>
          </Dialog>
          <Dialog open={dialog} onOpenChange={setDialog} label="Dialog">
            <button type="button">Dialog action</button>
          </Dialog>
        </>
      );
    }
    render(<Both />);
    await user.click(button('Open both'));
    await flushMicrotasks();
    expect(button('Dialog action')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Dialog' })).toBeNull();
    const drawer = screen.getByRole('dialog', { name: 'Drawer' });
    // The opener is behind the Drawer (inert): focus goes to the Drawer, never to <body>.
    expect(button('Open both').closest('[inert]')).not.toBeNull();
    expect(drawer).toHaveFocus();
    // The Drawer's trap keeps working from there.
    await user.tab();
    expect(button('Drawer action')).toHaveFocus();
  });

  it('lets a nested raw child layer take Escape first', async () => {
    const user = userEvent.setup();
    const onDialogChange = vi.fn();
    function Child() {
      const [open, setOpen] = React.useState(true);
      const ref = React.useRef<HTMLDivElement>(null);
      const { layerId } = useDismiss({ open, onDismiss: () => setOpen(false), refs: [ref] });
      if (!open) return null;
      return (
        <Portal layerId={layerId}>
          <div ref={ref} role="listbox" aria-label="Options" />
        </Portal>
      );
    }
    render(
      <Dialog open onOpenChange={onDialogChange}>
        <button type="button">Inside</button>
        <Child />
      </Dialog>,
    );
    expect(screen.getByRole('listbox', { name: 'Options' }).closest('[inert]')).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onDialogChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onDialogChange).toHaveBeenCalledWith(false);
  });

  it('keeps an allow-listed toast region reachable by Tab, not inert, and clickable', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Portal layer="toast">
          <div data-wave-focus-trap-allow="" role="region" aria-label="Notifications">
            <button type="button">Dismiss toast</button>
          </div>
        </Portal>
        <App />
      </>,
    );
    await user.click(button('Open'));
    const toastButton = button('Dismiss toast');
    expect(toastButton.closest('[inert]')).toBeNull();
    act(() => button('Close').focus());
    await user.tab();
    expect(toastButton).toHaveFocus();
    await user.click(toastButton);
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeInTheDocument();
  });

  it('keeps a sibling dialog opened from inside another dialog usable and restores focus into the first', async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    // A global confirm dialog driven by app state: a React sibling of the Settings dialog.
    function TwoDialogs() {
      const [settings, setSettings] = React.useState(false);
      const [confirm, setConfirm] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setSettings(true)}>
            Open settings
          </button>
          <Dialog
            open={settings}
            onOpenChange={(next) => {
              onSettingsChange(next);
              setSettings(next);
            }}
            label="Settings"
          >
            <button type="button" onClick={() => setConfirm(true)}>
              Reset
            </button>
          </Dialog>
          <Dialog open={confirm} onOpenChange={setConfirm} label="Confirm">
            <button type="button" onClick={() => setConfirm(false)}>
              Yes
            </button>
            <button type="button">No</button>
          </Dialog>
        </>
      );
    }
    render(<TwoDialogs />);
    await user.click(button('Open settings'));
    await user.click(button('Reset'));
    await flushMicrotasks();

    const confirm = screen.getByRole('dialog', { name: 'Confirm' });
    expect(confirm.closest('[inert]')).toBeNull();
    expect(button('Yes')).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Settings' }).closest('[inert]')).not.toBeNull();
    // The Confirm dialog's trap is the active one and its buttons are tabbable.
    await user.tab();
    expect(button('No')).toHaveFocus();
    await user.tab();
    expect(button('Yes')).toHaveFocus();

    // Pressing inside the Confirm dialog does not dismiss the Settings dialog behind it.
    await user.click(button('Yes'));
    expect(screen.queryByRole('dialog', { name: 'Confirm' })).toBeNull();
    expect(onSettingsChange).not.toHaveBeenCalled();
    expect(button('Reset')).toHaveFocus();
    await flushMicrotasks();
    expect(screen.getByRole('dialog', { name: 'Settings' }).closest('[inert]')).toBeNull();
    expect(button('Open settings').closest('[inert]')).not.toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(button('Open settings')).toHaveFocus();
  });

  it.each([['nested in'], ['a sibling of']])(
    'blocks Escape for the dialog behind an escape-disabled modal %s it',
    async (placement) => {
      const user = userEvent.setup();
      const onOuterChange = vi.fn();
      const onAlertChange = vi.fn();
      const alert = (
        <Dialog open onOpenChange={onAlertChange} label="Alert" escape={false}>
          <button type="button">Acknowledge</button>
        </Dialog>
      );
      render(
        <>
          <Dialog open onOpenChange={onOuterChange} label="Outer">
            <button type="button">Outer button</button>
            {placement === 'nested in' && alert}
          </Dialog>
          {placement === 'a sibling of' && alert}
        </>,
      );
      act(() => button('Acknowledge').focus());
      await user.keyboard('{Escape}');
      expect(onOuterChange).not.toHaveBeenCalled();
      expect(onAlertChange).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Alert' })).toBeInTheDocument();
    },
  );

  it('returns the dismiss layer', () => {
    let layer: DismissLayer | null = null;
    render(<Dialog open onOpenChange={() => {}} onLayer={(l) => (layer = l)} />);
    expect(layer).not.toBeNull();
    expect(layer!.layerId).toEqual(expect.any(String));
    expect(layer!.isTopmost()).toBe(true);
  });

  describe('an autoFocus element in a surface opened above another modal keeps focus', () => {
    it('in a confirm dialog opened over a drawer (React siblings)', async () => {
      const user = userEvent.setup();
      function DrawerWithConfirm() {
        const [confirm, setConfirm] = React.useState(false);
        return (
          <>
            <Dialog open onOpenChange={() => {}} label="Items">
              <button type="button" onClick={() => setConfirm(true)}>
                Delete
              </button>
            </Dialog>
            <Dialog open={confirm} onOpenChange={setConfirm} label="Confirm">
              <button type="button">OK</button>
              <button type="button" autoFocus>
                Cancel
              </button>
            </Dialog>
          </>
        );
      }
      render(<DrawerWithConfirm />);
      await user.click(button('Delete'));
      await flushMicrotasks();
      expect(button('Cancel')).toHaveFocus();
    });

    it('in a dialog nested in another dialog’s content', async () => {
      const user = userEvent.setup();
      function NestedDialogs() {
        const [inner, setInner] = React.useState(false);
        return (
          <Dialog open onOpenChange={() => {}} label="Outer">
            <button type="button" onClick={() => setInner(true)}>
              Open inner
            </button>
            <Dialog open={inner} onOpenChange={setInner} label="Inner">
              <button type="button">Inner first</button>
              <input aria-label="Inner name" autoFocus />
            </Dialog>
          </Dialog>
        );
      }
      render(<NestedDialogs />);
      await user.click(button('Open inner'));
      await flushMicrotasks();
      expect(screen.getByRole('textbox', { name: 'Inner name' })).toHaveFocus();
    });

    it('in a popover opened from inside a dialog', async () => {
      const user = userEvent.setup();
      /** A stand-in popover: a portaled child layer without a focus trap (as Popover). */
      function FilterPopover() {
        const [open, setOpen] = React.useState(false);
        const surfaceRef = React.useRef<HTMLDivElement>(null);
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
              Filter
            </button>
            {open && (
              <Portal layerId={layerId}>
                <div ref={surfaceRef} role="group" aria-label="Filter options">
                  <button type="button">Clear</button>
                  <input aria-label="Filter text" autoFocus />
                </div>
              </Portal>
            )}
          </>
        );
      }
      render(
        <Dialog open onOpenChange={() => {}}>
          <FilterPopover />
        </Dialog>,
      );
      await user.click(button('Filter'));
      await flushMicrotasks();
      expect(screen.getByRole('textbox', { name: 'Filter text' })).toHaveFocus();
    });
  });

  it('registers the modal as a child of an enclosing layer', async () => {
    const user = userEvent.setup();
    const onParent = vi.fn();
    function Parent({ children }: { children: React.ReactNode }) {
      const ref = React.useRef<HTMLDivElement>(null);
      const { layerId } = useDismiss({ open: true, onDismiss: onParent, refs: [ref] });
      return (
        <Portal layerId={layerId}>
          <div ref={ref} role="group" aria-label="Parent popover">
            {children}
          </div>
        </Portal>
      );
    }
    render(
      <Parent>
        <Dialog open onOpenChange={() => {}}>
          <button type="button">In dialog</button>
        </Dialog>
      </Parent>,
    );
    await user.click(button('In dialog'));
    expect(onParent).not.toHaveBeenCalled();
  });
});
