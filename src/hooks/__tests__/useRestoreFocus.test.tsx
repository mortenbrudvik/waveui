import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useRestoreFocus, type UseRestoreFocusOptions } from '../useRestoreFocus';
import { DismissLayerProvider, useDismiss } from '../useDismiss';
import { getTopmostLayer, registerLayer, type LayerRecord } from '../../lib/layers';
import { Portal } from '../../components/portal/Portal';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

/** Runs the microtask in which the unmount restore happens. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function button(name: string) {
  return screen.getByRole('button', { name });
}

type SurfaceOptions = Partial<Omit<UseRestoreFocusOptions, 'enabled' | 'container'>>;

/** A stand-in surface: container held in state, restore wired while open. */
function Surface({
  open,
  children,
  ...options
}: SurfaceOptions & { open: boolean; children?: React.ReactNode }) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  useRestoreFocus({ enabled: open, container: surface, ...options });
  if (!open) return null;
  return (
    <div ref={setSurface} role="dialog" aria-label="Surface">
      {children ?? <button type="button">Inside</button>}
    </div>
  );
}

function makeLayer(id: string, overrides: Partial<LayerRecord> = {}): LayerRecord {
  return {
    id,
    parentId: null,
    kind: 'modal',
    order: 0,
    getElements: () => [],
    getAnchor: () => null,
    escape: true,
    outsidePress: true,
    focusOutside: false,
    onDismiss: () => {},
    ...overrides,
  };
}

describe('useRestoreFocus — capture and restore', () => {
  it('restores focus to the opener when it closes', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Surface open={open}>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Open'));
    await user.click(button('Close'));
    expect(button('Open')).toHaveFocus();
  });

  it('restores to the real opener when the content autoFocuses (controlled, no trigger)', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Edit name
          </button>
          <Surface open={open}>
            <input aria-label="Name" autoFocus />
            <button type="button" onClick={() => setOpen(false)}>
              Save
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Edit name'));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await user.click(button('Save'));
    expect(button('Edit name')).toHaveFocus();
  });

  it('restores when a conditionally rendered open surface unmounts', async () => {
    const user = userEvent.setup();
    function App() {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Open
          </button>
          {show && (
            <Surface open>
              <button type="button" onClick={() => setShow(false)}>
                Close
              </button>
            </Surface>
          )}
        </>
      );
    }
    render(<App />);
    await user.click(button('Open'));
    await user.click(button('Close'));
    await flushMicrotasks();
    expect(button('Open')).toHaveFocus();
  });

  it('keeps focus inside when opened under StrictMode (no snap back)', async () => {
    const user = userEvent.setup();
    function App() {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Open
          </button>
          {show && (
            <Surface open>
              <input aria-label="Field" autoFocus />
            </Surface>
          )}
        </>
      );
    }
    render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    await user.click(button('Open'));
    await flushMicrotasks();
    expect(screen.getByRole('textbox', { name: 'Field' })).toHaveFocus();
  });

  it('prefers the trigger ref over the focused element', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      const triggerRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={triggerRef}>
            Trigger
          </button>
          <button type="button" onClick={() => setOpen(true)}>
            Other opener
          </button>
          <Surface open={open} triggerRef={triggerRef}>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Other opener'));
    await user.click(button('Close'));
    expect(button('Trigger')).toHaveFocus();
  });

  it('uses the trigger when the opener was <body> (Safari does not focus clicked buttons)', () => {
    function App({ open }: { open: boolean }) {
      const triggerRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" ref={triggerRef}>
            Trigger
          </button>
          <Surface open={open} triggerRef={triggerRef} />
        </>
      );
    }
    const { rerender } = render(<App open={false} />);
    expect(document.activeElement).toBe(document.body);
    rerender(<App open />);
    act(() => button('Inside').focus());
    rerender(<App open={false} />);
    expect(button('Trigger')).toHaveFocus();
  });

  it('ignores <body> and does nothing when there is no opener', () => {
    const { rerender } = render(<Surface open />);
    act(() => button('Inside').focus());
    rerender(<Surface open={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses with preventScroll', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Surface open={open}>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Open'));
    const focus = vi.spyOn(button('Open'), 'focus');
    await user.click(button('Close'));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });
});

describe('useRestoreFocus — validated targets', () => {
  it('uses finalFocusRef first', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      const finalRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button" ref={finalRef}>
            Final
          </button>
          <Surface open={open} finalFocusRef={finalRef}>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Open'));
    await user.click(button('Close'));
    expect(button('Final')).toHaveFocus();
  });

  it('falls back when the opener was removed (delete-row pattern)', async () => {
    const user = userEvent.setup();
    function App() {
      const [rows, setRows] = React.useState(['a', 'b']);
      const [pending, setPending] = React.useState<string | null>(null);
      return (
        <>
          <h2 tabIndex={-1} id="list-heading">
            Rows
          </h2>
          {rows.map((row) => (
            <button type="button" key={row} onClick={() => setPending(row)}>
              {`Delete ${row}`}
            </button>
          ))}
          <Surface open={pending !== null} fallback={() => document.getElementById('list-heading')}>
            <button
              type="button"
              onClick={() => {
                setRows((r) => r.filter((x) => x !== pending));
                setPending(null);
              }}
            >
              Confirm
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Delete b'));
    await user.click(button('Confirm'));
    expect(screen.queryByRole('button', { name: 'Delete b' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Rows' })).toHaveFocus();
  });

  /** The finding's delete-row code: rows in a list, a controlled surface without a trigger. */
  function DeleteRows({ initialRows = ['a', 'b', 'c'] }: { initialRows?: string[] }) {
    const [rows, setRows] = React.useState(initialRows);
    const [pending, setPending] = React.useState<string | null>(null);
    return (
      <>
        <button type="button">Before</button>
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
        <Surface open={pending !== null}>
          <button
            type="button"
            onClick={() => {
              setRows((r) => r.filter((x) => x !== pending));
              setPending(null);
            }}
          >
            Confirm
          </button>
          <button type="button" onClick={() => setPending(null)}>
            Cancel
          </button>
        </Surface>
        <button type="button">After</button>
      </>
    );
  }

  it('moves focus to the next row’s action when the opener’s row was removed (no fallback)', async () => {
    const user = userEvent.setup();
    render(<DeleteRows />);
    act(() => button('Delete b').focus());
    await user.keyboard('{Enter}');
    act(() => button('Confirm').focus());
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Delete b' })).toBeNull();
    expect(button('Delete c')).toHaveFocus();
  });

  it('moves focus to the previous row’s action when the last row was removed', async () => {
    const user = userEvent.setup();
    render(<DeleteRows />);
    await user.click(button('Delete c'));
    await user.click(button('Confirm'));
    expect(button('Delete b')).toHaveFocus();
  });

  it('moves focus next to the removed position when the list became empty', async () => {
    const user = userEvent.setup();
    render(<DeleteRows initialRows={['a']} />);
    await user.click(button('Delete a'));
    await user.click(button('Confirm'));
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(button('After')).toHaveFocus();
  });

  it('still restores to the opener when it was not removed', async () => {
    const user = userEvent.setup();
    render(<DeleteRows />);
    await user.click(button('Delete b'));
    await user.click(button('Cancel'));
    expect(button('Delete b')).toHaveFocus();
  });

  it('moves focus next to a row that was removed together with the open surface', async () => {
    const user = userEvent.setup();
    function RowsWithSurfaces() {
      const [rows, setRows] = React.useState(['a', 'b', 'c']);
      const [pending, setPending] = React.useState<string | null>(null);
      return (
        <ul aria-label="Rows">
          {rows.map((row) => (
            <li key={row}>
              <button type="button" onClick={() => setPending(row)}>
                {`Delete ${row}`}
              </button>
              {pending === row && (
                <Surface open>
                  <button type="button" onClick={() => setRows((r) => r.filter((x) => x !== row))}>
                    Confirm
                  </button>
                </Surface>
              )}
            </li>
          ))}
        </ul>
      );
    }
    render(<RowsWithSurfaces />);
    await user.click(button('Delete b'));
    await user.click(button('Confirm'));
    await flushMicrotasks();
    expect(button('Delete c')).toHaveFocus();
  });

  it('moves focus past a disabled opener to the next tabbable element', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      const [used, setUsed] = React.useState(false);
      return (
        <>
          <button type="button">Previous</button>
          <button type="button" disabled={used} onClick={() => setOpen(true)}>
            Claim
          </button>
          <button type="button">Next</button>
          <Surface open={open}>
            <button
              type="button"
              onClick={() => {
                setUsed(true);
                setOpen(false);
              }}
            >
              Confirm
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Claim'));
    await user.click(button('Confirm'));
    expect(button('Next')).toHaveFocus();
  });

  /** A stand-in menu: a portaled popover layer anchored to its trigger, with one menu item. */
  function MenuPopover({
    label = 'More actions',
    item = 'Rename',
    onPick,
  }: {
    label?: string;
    item?: string;
    onPick: () => void;
  }) {
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
          {label}
        </button>
        {open && (
          <Portal layerId={layerId}>
            <div ref={surfaceRef} role="menu" aria-label={label}>
              <button type="button" role="menuitem" onClick={onPick}>
                {item}
              </button>
            </div>
          </Portal>
        )}
      </>
    );
  }

  it('restores to the trigger of the closed popover that held the opener', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button">Before</button>
          <MenuPopover onPick={() => setOpen(true)} />
          <button type="button">After</button>
          {/* A sibling of the popover, not rendered inside it. */}
          <Surface open={open}>
            <input aria-label="New name" />
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('More actions'));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    // Pressing into the surface is outside the popover: it closes and its menu item is removed.
    await user.click(screen.getByRole('textbox', { name: 'New name' }));
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(button('Cancel'));
    expect(button('More actions')).toHaveFocus();
  });

  it('moves focus next to the menu button when a menu item deleted the menu button’s row', async () => {
    const user = userEvent.setup();
    function App() {
      const [rows, setRows] = React.useState(['a', 'b', 'c']);
      const [pending, setPending] = React.useState<string | null>(null);
      return (
        <>
          <ul aria-label="Rows">
            {rows.map((row) => (
              <li key={row}>
                <MenuPopover
                  label={`Actions ${row}`}
                  item={`Delete ${row}`}
                  onPick={() => setPending(row)}
                />
              </li>
            ))}
          </ul>
          <Surface open={pending !== null}>
            <button
              type="button"
              onClick={() => {
                setRows((r) => r.filter((x) => x !== pending));
                setPending(null);
              }}
            >
              Confirm
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Actions b'));
    await user.click(screen.getByRole('menuitem', { name: 'Delete b' }));
    await user.click(button('Confirm'));
    // The menu item, its menu and the menu button are all gone: the next row's menu button.
    expect(screen.queryByRole('button', { name: 'Actions b' })).toBeNull();
    expect(button('Actions c')).toHaveFocus();
  });

  it('skips disabled, inert and aria-hidden targets', async () => {
    const user = userEvent.setup();
    function App() {
      const [open, setOpen] = React.useState(false);
      const [state, setState] = React.useState<'ok' | 'disabled' | 'inert' | 'hidden'>('ok');
      return (
        <>
          <div inert={state === 'inert'} aria-hidden={state === 'hidden' ? true : undefined}>
            <button type="button" disabled={state === 'disabled'} onClick={() => setOpen(true)}>
              Opener
            </button>
          </div>
          <button type="button" id="fallback">
            Fallback
          </button>
          <Surface open={open} fallback={() => document.getElementById('fallback')}>
            <button type="button" onClick={() => setState('disabled')}>
              Disable
            </button>
            <button type="button" onClick={() => setState('inert')}>
              Inert
            </button>
            <button type="button" onClick={() => setState('hidden')}>
              Hide
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </Surface>
        </>
      );
    }
    for (const action of ['Disable', 'Inert', 'Hide']) {
      const { unmount } = render(<App />);
      await user.click(button('Opener'));
      await user.click(button(action));
      await user.click(button('Close'));
      expect(button('Fallback')).toHaveFocus();
      unmount();
    }
  });

  it('skips an opener that sits behind another open modal', async () => {
    const user = userEvent.setup();
    const drawerSurface = document.createElement('div');
    const inDrawer = document.createElement('button');
    inDrawer.textContent = 'In drawer';
    drawerSurface.appendChild(inDrawer);
    document.body.appendChild(drawerSurface);
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open both
          </button>
          <Surface open={open} fallback={() => inDrawer}>
            <button type="button" onClick={() => setOpen(false)}>
              Close dialog
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Open both'));
    // A drawer (modal layer) is open too, above the page.
    const unregister = registerLayer(makeLayer('drawer', { getElements: () => [drawerSurface] }));
    try {
      await user.click(button('Close dialog'));
      expect(inDrawer).toHaveFocus();
    } finally {
      unregister();
      drawerSurface.remove();
    }
  });

  it('moves focus into the modal that stays open when the opener sits behind it (no fallback)', async () => {
    const user = userEvent.setup();
    const drawerSurface = document.createElement('div');
    drawerSurface.tabIndex = -1;
    drawerSurface.setAttribute('aria-label', 'Drawer');
    const inDrawer = document.createElement('button');
    inDrawer.textContent = 'In drawer';
    drawerSurface.appendChild(inDrawer);
    document.body.appendChild(drawerSurface);
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open both
          </button>
          <Surface open={open}>
            <button type="button" onClick={() => setOpen(false)}>
              Close dialog
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Open both'));
    const unregister = registerLayer(makeLayer('drawer', { getElements: () => [drawerSurface] }));
    try {
      await user.click(button('Close dialog'));
      expect(drawerSurface).toHaveFocus();
    } finally {
      unregister();
      drawerSurface.remove();
    }
  });

  it('never moves focus to an element behind the modal that stays open', async () => {
    const user = userEvent.setup();
    // The remaining modal has nothing focusable: focus stays where it is rather than going behind.
    const drawerSurface = document.createElement('div');
    document.body.appendChild(drawerSurface);
    function App() {
      const [open, setOpen] = React.useState(false);
      const [showOpener, setShowOpener] = React.useState(true);
      return (
        <>
          <button type="button">Page button</button>
          {showOpener && (
            <button type="button" onClick={() => setOpen(true)}>
              Opener
            </button>
          )}
          <Surface open={open}>
            <button
              type="button"
              onClick={() => {
                setShowOpener(false);
                setOpen(false);
              }}
            >
              Close dialog
            </button>
          </Surface>
        </>
      );
    }
    render(<App />);
    await user.click(button('Opener'));
    const unregister = registerLayer(makeLayer('drawer', { getElements: () => [drawerSurface] }));
    try {
      await user.click(button('Close dialog'));
      expect(button('Page button')).not.toHaveFocus();
      expect(document.activeElement).toBe(document.body);
    } finally {
      unregister();
      drawerSurface.remove();
    }
  });

  it('falls back to the parent layer’s container', async () => {
    const user = userEvent.setup();
    const parentSurface = document.createElement('div');
    parentSurface.tabIndex = -1;
    parentSurface.setAttribute('aria-label', 'Parent surface');
    document.body.appendChild(parentSurface);
    const unregister = registerLayer(
      makeLayer('parent', { kind: 'popover', getElements: () => [parentSurface] }),
    );
    function App() {
      const [open, setOpen] = React.useState(false);
      const [showOpener, setShowOpener] = React.useState(true);
      return (
        <DismissLayerProvider layerId="parent">
          {showOpener && (
            <button type="button" onClick={() => setOpen(true)}>
              Menu item
            </button>
          )}
          <Surface open={open}>
            <button
              type="button"
              onClick={() => {
                setShowOpener(false);
                setOpen(false);
              }}
            >
              Done
            </button>
          </Surface>
        </DismissLayerProvider>
      );
    }
    try {
      render(<App />);
      await user.click(button('Menu item'));
      await user.click(button('Done'));
      expect(parentSurface).toHaveFocus();
    } finally {
      cleanup();
      unregister();
      parentSurface.remove();
    }
  });

  /**
   * A stand-in parent layer that stays open (a Drawer around a confirm Dialog): a focusable surface
   * in `<body>`, registered as the layer `parent`. Render into `surface` inside
   * `DismissLayerProvider layerId="parent"`, so the restoring surface is its React descendant.
   */
  function mountParentLayer(kind: LayerRecord['kind']) {
    const surface = document.createElement('div');
    surface.tabIndex = -1;
    surface.setAttribute('aria-label', 'Parent surface');
    document.body.appendChild(surface);
    const unregister = registerLayer(makeLayer('parent', { kind, getElements: () => [surface] }));
    return {
      surface,
      dispose() {
        cleanup();
        unregister();
        surface.remove();
      },
    };
  }

  it('moves focus to the removed opener’s neighbour inside the parent layer, not its surface', async () => {
    const user = userEvent.setup();
    const parent = mountParentLayer('modal');
    try {
      render(
        <DismissLayerProvider layerId="parent">
          <DeleteRows />
        </DismissLayerProvider>,
        { container: parent.surface },
      );
      await user.click(button('Delete b'));
      await user.click(button('Confirm'));
      expect(screen.queryByRole('button', { name: 'Delete b' })).toBeNull();
      expect(button('Delete c')).toHaveFocus();
      // The last row: the previous one.
      await user.click(button('Delete c'));
      await user.click(button('Confirm'));
      expect(button('Delete a')).toHaveFocus();
    } finally {
      parent.dispose();
    }
  });

  it('restores to the trigger of the closed popover inside the parent layer, not its surface', async () => {
    const user = userEvent.setup();
    const parent = mountParentLayer('modal');
    function App() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <MenuPopover onPick={() => setOpen(true)} />
          <Surface open={open}>
            <input aria-label="New name" />
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </Surface>
        </>
      );
    }
    try {
      render(
        <DismissLayerProvider layerId="parent">
          <App />
        </DismissLayerProvider>,
        { container: parent.surface },
      );
      await user.click(button('More actions'));
      await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
      // Pressing into the surface closes the popover: its menu item (the opener) is removed.
      await user.click(screen.getByRole('textbox', { name: 'New name' }));
      expect(screen.queryByRole('menu')).toBeNull();
      await user.click(button('Cancel'));
      expect(button('More actions')).toHaveFocus();
    } finally {
      parent.dispose();
    }
  });

  it('prefers the parent layer’s surface to a neighbour of the removed opener outside it', async () => {
    const user = userEvent.setup();
    const parent = mountParentLayer('popover');
    const page = document.createElement('button');
    page.type = 'button';
    page.textContent = 'Page';
    document.body.appendChild(page);
    function App() {
      const [open, setOpen] = React.useState(false);
      const [showOpener, setShowOpener] = React.useState(true);
      return (
        <>
          {showOpener && (
            <button type="button" onClick={() => setOpen(true)}>
              Menu item
            </button>
          )}
          <Surface open={open}>
            <button
              type="button"
              onClick={() => {
                setShowOpener(false);
                setOpen(false);
              }}
            >
              Done
            </button>
          </Surface>
        </>
      );
    }
    try {
      render(
        <DismissLayerProvider layerId="parent">
          <App />
        </DismissLayerProvider>,
        { container: parent.surface },
      );
      await user.click(button('Menu item'));
      await user.click(button('Done'));
      expect(parent.surface).toHaveFocus();
    } finally {
      parent.dispose();
      page.remove();
    }
  });
});

describe('useRestoreFocus — opener removed in the commit that opens the surface', () => {
  /**
   * A stand-in controlled popover: a portaled popover layer anchored to its trigger. React deletes
   * its content in the same commit that opens a surface rendered after it, before that surface's
   * insertion effect runs, so focus is already on `<body>` when the opener is captured.
   */
  function ControlledPopover({
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

  /** Menu item → closes the popover and opens a sibling surface, in one handler (one commit). */
  function App({
    surfaceFirst = false,
    autoFocusItem = false,
  }: {
    surfaceFirst?: boolean;
    autoFocusItem?: boolean;
  }) {
    const [popover, setPopover] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const surface = (
      <Surface open={open}>
        <input aria-label="New name" autoFocus />
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </Surface>
    );
    return (
      <>
        <button type="button">Before</button>
        {surfaceFirst && surface}
        <ControlledPopover open={popover} onOpenChange={setPopover}>
          <button
            type="button"
            role="menuitem"
            autoFocus={autoFocusItem}
            onClick={() => {
              setPopover(false);
              setOpen(true);
            }}
          >
            Rename
          </button>
        </ControlledPopover>
        {!surfaceFirst && surface}
        <button type="button">After</button>
      </>
    );
  }

  it.each([
    ['after', false],
    ['before', true],
  ])(
    'restores to the trigger of a popover that closed as the surface opened (surface %s it)',
    async (_placement, surfaceFirst) => {
      const user = userEvent.setup();
      render(<App surfaceFirst={surfaceFirst} />);
      await user.click(button('More'));
      act(() => screen.getByRole('menuitem', { name: 'Rename' }).focus());
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(screen.getByRole('textbox', { name: 'New name' })).toHaveFocus();
      await user.click(button('Cancel'));
      expect(button('More')).toHaveFocus();
    },
  );

  it('knows the popover of an item that was focused before the popover’s layer registered', async () => {
    const user = userEvent.setup();
    render(<App autoFocusItem />);
    // The item auto-focuses in the commit that opens the popover, before its layer registers.
    await user.click(button('More'));
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(button('Cancel'));
    expect(button('More')).toHaveFocus();
  });

  it('moves focus next to a removed opener that was not in a popover', async () => {
    const user = userEvent.setup();
    function Rows() {
      const [rows, setRows] = React.useState(['a', 'b', 'c']);
      const [pending, setPending] = React.useState<string | null>(null);
      return (
        <>
          <ul aria-label="Rows">
            {rows.map((row) => (
              <li key={row}>
                <button
                  type="button"
                  onClick={() => {
                    // Archive now, confirm later: the row goes away as the surface opens.
                    setRows((r) => r.filter((x) => x !== row));
                    setPending(row);
                  }}
                >
                  {`Archive ${row}`}
                </button>
              </li>
            ))}
          </ul>
          <Surface open={pending !== null}>
            <button type="button" onClick={() => setPending(null)}>
              OK
            </button>
          </Surface>
        </>
      );
    }
    render(<Rows />);
    act(() => button('Archive b').focus());
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('button', { name: 'Archive b' })).toBeNull();
    await user.click(button('OK'));
    expect(button('Archive c')).toHaveFocus();
  });

  it('does not restore to an element that was blurred before the surface opened', () => {
    function Page({ open }: { open: boolean }) {
      return (
        <>
          <input aria-label="Search" />
          <Surface open={open} />
        </>
      );
    }
    const { rerender } = render(<Page open={false} />);
    const search = screen.getByRole('textbox', { name: 'Search' });
    act(() => search.focus());
    act(() => search.blur());
    rerender(<Page open />);
    act(() => button('Inside').focus());
    rerender(<Page open={false} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('forgets an element the user moved focus away from before it was removed', async () => {
    function Page({ popover, open }: { popover: boolean; open: boolean }) {
      return (
        <>
          <ControlledPopover open={popover} onOpenChange={() => {}}>
            <button type="button" role="menuitem">
              Rename
            </button>
          </ControlledPopover>
          <Surface open={open} />
        </>
      );
    }
    const { rerender } = render(<Page popover open={false} />);
    const item = screen.getByRole('menuitem', { name: 'Rename' });
    act(() => item.focus());
    // A press on a non-focusable part of the page moves focus to <body>.
    act(() => item.blur());
    await flushMicrotasks();
    rerender(<Page popover={false} open />);
    act(() => button('Inside').focus());
    rerender(<Page popover={false} open={false} />);
    expect(button('More')).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('removes its document listeners when no surface is mounted', () => {
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    try {
      const { unmount } = render(<Surface open={false} />);
      const focusListeners = added.mock.calls.filter(
        ([type]) => type === 'focusin' || type === 'focusout',
      );
      expect(focusListeners.length).toBeGreaterThan(0);
      unmount();
      for (const [type, listener, options] of focusListeners) {
        expect(removed).toHaveBeenCalledWith(type, listener, options);
      }
    } finally {
      added.mockRestore();
      removed.mockRestore();
    }
  });
});

describe('useRestoreFocus — onlyIfFocusInside (popovers)', () => {
  function App({ onlyIfFocusInside = true }: { onlyIfFocusInside?: boolean }) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    return (
      <>
        <button type="button" ref={triggerRef} onClick={() => setOpen((o) => !o)}>
          Trigger
        </button>
        <input aria-label="Elsewhere" onFocus={() => setOpen(false)} />
        <Surface open={open} triggerRef={triggerRef} onlyIfFocusInside={onlyIfFocusInside}>
          <button type="button" onClick={() => setOpen(false)}>
            Inner close
          </button>
        </Surface>
      </>
    );
  }

  it('restores to the trigger when closed from inside', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(button('Trigger'));
    await user.click(button('Inner close'));
    expect(button('Trigger')).toHaveFocus();
  });

  it('does not steal focus that moved elsewhere', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(button('Trigger'));
    await user.click(screen.getByRole('textbox', { name: 'Elsewhere' }));
    expect(screen.getByRole('textbox', { name: 'Elsewhere' })).toHaveFocus();
  });
});
