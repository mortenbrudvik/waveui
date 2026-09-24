import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import {
  DismissLayerContext,
  DismissLayerProvider,
  useDismiss,
  type DismissReason,
  type UseDismissOptions,
} from '../useDismiss';
import { Portal } from '../../components/portal/Portal';
import { getTopmostLayer } from '../../lib/layers';

type DismissOptions = Partial<Omit<UseDismissOptions, 'open' | 'onDismiss' | 'refs'>>;

interface PopupProps extends DismissOptions {
  label: string;
  defaultOpen?: boolean;
  onDismiss?: (reason: DismissReason) => void;
  /** Whether the trigger belongs to the layer (refs) — false for an "external" toggle. */
  triggerInRefs?: boolean;
  /** Opens on pointerdown instead of click (like a real browser flushing before our click). */
  openOnPointerDown?: boolean;
  children?: React.ReactNode;
}

/** A stand-in popup: a trigger button and a portaled surface registered as a dismiss layer. */
function Popup({
  label,
  defaultOpen = false,
  onDismiss,
  triggerInRefs = true,
  openOnPointerDown = false,
  children,
  ...options
}: PopupProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: (reason) => {
      onDismiss?.(reason);
      setOpen(false);
    },
    refs: triggerInRefs ? [surfaceRef, triggerRef] : [surfaceRef],
    anchorRef: triggerRef,
    ...options,
  });
  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        onClick={openOnPointerDown ? undefined : () => setOpen((o) => !o)}
        onPointerDown={openOnPointerDown ? () => setOpen(true) : undefined}
      >
        {label}
      </button>
      {open && (
        <Portal layerId={layerId}>
          <div ref={surfaceRef} role="dialog" aria-label={label}>
            <button type="button">{`${label} action`}</button>
            {children}
          </div>
        </Portal>
      )}
    </>
  );
}

function isOpen(label: string) {
  return screen.queryByRole('dialog', { name: label }) !== null;
}

afterEach(() => {
  // Unmount first (the setup file's cleanup runs after this hook), then check the shared stack.
  cleanup();
  expect(getTopmostLayer()).toBeNull();
});

describe('useDismiss — Escape', () => {
  it('dismisses the layer with reason "escape" and prevents the default', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Popup label="Menu" defaultOpen onDismiss={onDismiss} />);
    const listener = vi.fn((e: KeyboardEvent) => e.defaultPrevented);
    window.addEventListener('keydown', listener);
    await user.keyboard('{Escape}');
    window.removeEventListener('keydown', listener);
    expect(onDismiss).toHaveBeenCalledWith('escape');
    expect(listener.mock.results[0]?.value).toBe(true);
    expect(isOpen('Menu')).toBe(false);
  });

  it('closes only the child when parent and child opened in the same commit', async () => {
    const user = userEvent.setup();
    render(
      <Popup label="Parent" defaultOpen>
        <Popup label="Child" defaultOpen />
      </Popup>,
    );
    expect(isOpen('Parent')).toBe(true);
    expect(isOpen('Child')).toBe(true);
    await user.keyboard('{Escape}');
    expect(isOpen('Child')).toBe(false);
    expect(isOpen('Parent')).toBe(true);
    await user.keyboard('{Escape}');
    expect(isOpen('Parent')).toBe(false);
  });

  it('routes Escape by focus location: the topmost layer that contains the focused element', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popup label="First" defaultOpen />
        <Popup label="Second" defaultOpen />
      </>,
    );
    // "Second" opened last (global topmost), but focus is inside "First".
    screen.getByRole('button', { name: 'First action' }).focus();
    await user.keyboard('{Escape}');
    expect(isOpen('First')).toBe(false);
    expect(isOpen('Second')).toBe(true);
  });

  it('routes Escape inside a nested child layer to the child only', async () => {
    const user = userEvent.setup();
    render(
      <Popup label="Parent" defaultOpen>
        <Popup label="Child" defaultOpen />
      </Popup>,
    );
    screen.getByRole('button', { name: 'Child action' }).focus();
    await user.keyboard('{Escape}');
    expect(isOpen('Child')).toBe(false);
    expect(isOpen('Parent')).toBe(true);
  });

  it('falls back to the global topmost layer when focus is outside every layer', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Page</button>
        <Popup label="First" defaultOpen />
        <Popup label="Second" defaultOpen />
      </>,
    );
    screen.getByRole('button', { name: 'Page' }).focus();
    await user.keyboard('{Escape}');
    expect(isOpen('Second')).toBe(false);
    expect(isOpen('First')).toBe(true);
  });

  it('ignores an Escape an inner widget already handled (preventDefault)', async () => {
    const user = userEvent.setup();
    render(
      <Popup label="Dialog" defaultOpen>
        <input
          aria-label="Inner listbox input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.preventDefault();
          }}
        />
      </Popup>,
    );
    await user.click(screen.getByRole('textbox', { name: 'Inner listbox input' }));
    await user.keyboard('{Escape}');
    expect(isOpen('Dialog')).toBe(true);
  });

  it('ignores Escape during an IME composition', () => {
    render(<Popup label="Dialog" defaultOpen />);
    fireEvent.keyDown(document.body, { key: 'Escape', isComposing: true });
    expect(isOpen('Dialog')).toBe(true);
  });

  it('skips escape-disabled layers and lets an escape-only layer (tooltip) take Escape first', async () => {
    const user = userEvent.setup();
    const onOuter = vi.fn();
    render(
      <Popup label="Outer" defaultOpen onDismiss={onOuter}>
        <Popup label="Tooltip" defaultOpen kind="tooltip" outsidePress={false} />
        <Popup label="Sticky" defaultOpen escape={false} />
      </Popup>,
    );
    await user.keyboard('{Escape}');
    expect(isOpen('Tooltip')).toBe(false);
    expect(isOpen('Sticky')).toBe(true);
    expect(onOuter).not.toHaveBeenCalled();
  });
});

describe('useDismiss — outside press', () => {
  it('dismisses on a press outside with reason "outside-press"', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Popup label="Popover" defaultOpen onDismiss={onDismiss} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(onDismiss).toHaveBeenCalledWith('outside-press');
    expect(isOpen('Popover')).toBe(false);
  });

  it('does not dismiss on presses inside the surface or on its trigger (the trigger toggles)', async () => {
    const user = userEvent.setup();
    render(<Popup label="Popover" defaultOpen />);
    await user.click(screen.getByRole('button', { name: 'Popover action' }));
    expect(isOpen('Popover')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Popover' }));
    expect(isOpen('Popover')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Popover' }));
    expect(isOpen('Popover')).toBe(true);
  });

  it('does not dismiss when a press starts inside and the click lands outside (drag-out)', () => {
    render(
      <>
        <div data-testid="backdrop" />
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Dialog action' }));
    fireEvent.click(screen.getByTestId('backdrop'));
    expect(isOpen('Dialog')).toBe(true);
  });

  it('does not dismiss when a press starts outside and ends inside', () => {
    render(
      <>
        <div data-testid="backdrop" />
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    fireEvent.pointerDown(screen.getByTestId('backdrop'));
    fireEvent.click(screen.getByRole('dialog', { name: 'Dialog' }));
    expect(isOpen('Dialog')).toBe(true);
  });

  it('keeps the outer layer open for clicks inside a nested portaled child layer', async () => {
    const user = userEvent.setup();
    render(
      <Popup label="Outer" defaultOpen>
        <Popup label="Inner" defaultOpen />
      </Popup>,
    );
    await user.click(screen.getByRole('button', { name: 'Inner action' }));
    expect(isOpen('Outer')).toBe(true);
    expect(isOpen('Inner')).toBe(true);
  });

  it('keeps the outer layer open for clicks inside a raw nested Portal (registered wrapper)', async () => {
    const user = userEvent.setup();
    render(
      <Popup label="Outer" defaultOpen>
        <Portal>
          <button type="button">Portaled content</button>
        </Portal>
      </Popup>,
    );
    await user.click(screen.getByRole('button', { name: 'Portaled content' }));
    expect(isOpen('Outer')).toBe(true);
  });

  it('dismisses every layer the press was outside of, not only the topmost', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Page</button>
        <Popup label="First" defaultOpen />
        <Popup label="Second" defaultOpen />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Page' }));
    expect(isOpen('First')).toBe(false);
    expect(isOpen('Second')).toBe(false);
  });

  it('closes an open calendar-like layer when a click opens another layer, which stays open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popup label="Calendar" defaultOpen />
        <Popup label="Dropdown" />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Dropdown' }));
    expect(isOpen('Calendar')).toBe(false);
    expect(isOpen('Dropdown')).toBe(true);
  });

  it('ignores layers registered after the pointerdown (opened by that very press)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popup label="Calendar" defaultOpen />
        {/* Opens in pointerdown, i.e. before the click, as when React flushes between events. */}
        <Popup label="Dropdown" openOnPointerDown triggerInRefs={false} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Dropdown' }));
    expect(isOpen('Calendar')).toBe(false);
    expect(isOpen('Dropdown')).toBe(true);
  });

  it('does not dismiss a layer reopened between pointerdown and click (a new record, not in the snapshot)', () => {
    function Harness({ open }: { open: boolean }) {
      const surfaceRef = React.useRef<HTMLDivElement>(null);
      const keeperRef = React.useRef<HTMLDivElement>(null);
      // A second layer stays open: the document listeners, and so the pending press, stay alive.
      useDismiss({ open: true, onDismiss: onKeeperDismiss, refs: [keeperRef] });
      useDismiss({ open, onDismiss, refs: [surfaceRef] });
      return (
        <>
          <button type="button">Outside</button>
          <div ref={keeperRef}>Keeper</div>
          {open && <div ref={surfaceRef}>Surface</div>}
        </>
      );
    }
    const onDismiss = vi.fn();
    const onKeeperDismiss = vi.fn();
    const { rerender } = render(<Harness open />);
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.pointerDown(outside);
    rerender(<Harness open={false} />);
    rerender(<Harness open />);
    fireEvent.click(outside);
    expect(onDismiss).not.toHaveBeenCalled();
    // The press itself was still pending: the layer that stayed open is dismissed by it.
    expect(onKeeperDismiss).toHaveBeenCalledTimes(1);
    expect(onKeeperDismiss).toHaveBeenCalledWith('outside-press', expect.any(Object));
  });

  it('lets an external toggle close the popup in one click', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = React.useState(true);
      const surfaceRef = React.useRef<HTMLDivElement>(null);
      useDismiss({ open, onDismiss: () => setOpen(false), refs: [surfaceRef] });
      return (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)}>
            External toggle
          </button>
          {open && (
            <div ref={surfaceRef} role="dialog" aria-label="Popover">
              Content
            </div>
          )}
        </>
      );
    }
    render(<Controlled />);
    await user.click(screen.getByRole('button', { name: 'External toggle' }));
    expect(isOpen('Popover')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'External toggle' }));
    expect(isOpen('Popover')).toBe(true);
  });

  it('never dismisses for clicks inside an allow-listed region (toasts)', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Portal layer="toast">
          <div data-wave-focus-trap-allow="" role="region" aria-label="Notifications">
            <button type="button">Dismiss toast</button>
          </div>
        </Portal>
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss toast' }));
    expect(isOpen('Dialog')).toBe(true);
  });

  it('ignores non-primary button presses (no click follows a right-click)', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.pointerDown(outside, { button: 2 });
    fireEvent.click(outside);
    expect(isOpen('Dialog')).toBe(true);
  });

  it('forgets a press cancelled by the browser (touch scroll)', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.pointerDown(outside);
    fireEvent.pointerCancel(outside);
    fireEvent.click(outside);
    expect(isOpen('Dialog')).toBe(true);
  });

  it('does not dismiss for a keyboard-activated click (no pointerdown)', () => {
    render(
      <>
        <button type="button">Outside</button>
        <Popup label="Dialog" defaultOpen />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(isOpen('Dialog')).toBe(true);
  });

  it('honours outsidePress: false and a predicate returning false', async () => {
    const user = userEvent.setup();
    const predicate = vi.fn((event: PointerEvent | MouseEvent) => {
      const target = event.target as HTMLElement;
      return target.textContent !== 'Ignored';
    });
    render(
      <>
        <button type="button">Ignored</button>
        <button type="button">Other</button>
        <Popup label="Never" defaultOpen outsidePress={false} />
        <Popup label="Predicate" defaultOpen outsidePress={predicate} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Ignored' }));
    expect(isOpen('Never')).toBe(true);
    expect(isOpen('Predicate')).toBe(true);
    expect(predicate).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Other' }));
    expect(isOpen('Never')).toBe(true);
    expect(isOpen('Predicate')).toBe(false);
  });
});

describe('useDismiss — focus outside', () => {
  it('dismisses a focusOutside layer when focus moves outside its tree', () => {
    const onDismiss = vi.fn();
    render(
      <>
        <Popup label="Listbox" defaultOpen focusOutside onDismiss={onDismiss} />
        <button type="button">Next field</button>
      </>,
    );
    // The trigger and the portaled surface both belong to the layer.
    act(() => screen.getByRole('button', { name: 'Listbox' }).focus());
    act(() => screen.getByRole('button', { name: 'Listbox action' }).focus());
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => screen.getByRole('button', { name: 'Next field' }).focus());
    expect(onDismiss).toHaveBeenCalledWith('focus-outside');
    expect(isOpen('Listbox')).toBe(false);
  });

  it('keeps the layer open when focus moves into a descendant layer or the allow-list', () => {
    const onDismiss = vi.fn();
    render(
      <>
        <div data-wave-focus-trap-allow="">
          <button type="button">Toast action</button>
        </div>
        <Popup label="Parent" defaultOpen focusOutside onDismiss={onDismiss}>
          <Popup label="Child" defaultOpen />
        </Popup>
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Child action' }).focus());
    act(() => screen.getByRole('button', { name: 'Toast action' }).focus());
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does nothing without focusOutside', () => {
    const onDismiss = vi.fn();
    render(
      <>
        <Popup label="Popover" defaultOpen onDismiss={onDismiss} />
        <button type="button">Elsewhere</button>
      </>,
    );
    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus());
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('useDismiss — layer API', () => {
  it('returns a stable layer id and reports whether the layer is topmost', () => {
    const results: Array<{ layerId: string; isTopmost(): boolean }> = [];
    function Harness({ open }: { open: boolean }) {
      const ref = React.useRef<HTMLDivElement>(null);
      const layer = useDismiss({ open, onDismiss: () => {}, refs: [ref] });
      React.useEffect(() => {
        results.push(layer);
      });
      return <div ref={ref} />;
    }
    const { rerender } = render(<Harness open={false} />);
    expect(results[0].isTopmost()).toBe(false);
    rerender(<Harness open />);
    const last = results[results.length - 1];
    expect(last.layerId).toBe(results[0].layerId);
    expect(last.isTopmost()).toBe(true);
    rerender(<Harness open={false} />);
    expect(last.isTopmost()).toBe(false);
  });

  it('reads parentage from DismissLayerContext (provided by DismissLayerProvider)', () => {
    function Reader() {
      return <span data-testid="context">{React.useContext(DismissLayerContext)}</span>;
    }
    render(
      <DismissLayerProvider layerId="outer-layer">
        <Reader />
      </DismissLayerProvider>,
    );
    expect(screen.getByTestId('context')).toHaveTextContent('outer-layer');
  });

  it('uses the latest onDismiss without re-registering', async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    function Harness({ onDismiss }: { onDismiss: () => void }) {
      const ref = React.useRef<HTMLDivElement>(null);
      useDismiss({ open: true, onDismiss, refs: [ref] });
      return <div ref={ref} />;
    }
    const { rerender } = render(<Harness onDismiss={first} />);
    rerender(<Harness onDismiss={second} />);
    await user.keyboard('{Escape}');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('registers once per open under StrictMode', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    function Harness() {
      const ref = React.useRef<HTMLDivElement>(null);
      useDismiss({ open: true, onDismiss, refs: [ref] });
      return <div ref={ref} />;
    }
    render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    );
    await user.keyboard('{Escape}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
