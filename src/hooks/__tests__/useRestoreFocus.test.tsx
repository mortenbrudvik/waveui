import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { useRestoreFocus, type UseRestoreFocusOptions } from '../useRestoreFocus';
import { DismissLayerProvider } from '../useDismiss';
import { getTopmostLayer, registerLayer, type LayerRecord } from '../../lib/layers';

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
