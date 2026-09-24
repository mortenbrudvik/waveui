import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import * as React from 'react';
import { useModalIsolation } from '../useModalIsolation';
import { useDismiss } from '../useDismiss';
import { Portal } from '../../components/portal/Portal';
import { getOpenLayers, getTopmostLayer, isBehindIsolatingModal } from '../../lib/layers';

afterEach(() => {
  cleanup();
  expect(getTopmostLayer()).toBeNull();
  expect(document.querySelectorAll('[inert]')).toHaveLength(0);
});

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function Modal({
  open,
  label,
  children,
}: {
  open: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setSurface(el);
  }, []);
  const { layerId } = useDismiss({ open, onDismiss: () => {}, refs: [surfaceRef], kind: 'modal' });
  useModalIsolation(open, { layerId, container: surface });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div data-testid={`${label}-backdrop`} />
      <div ref={setRefs} role="dialog" aria-label={label}>
        <button type="button">{`${label} action`}</button>
        {children}
      </div>
    </Portal>
  );
}

/** A descendant popover layer rendered from inside a modal. */
function ChildPopover({ open }: { open: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({ open, onDismiss: () => {}, refs: [ref] });
  if (!open) return null;
  return (
    <Portal layerId={layerId}>
      <div ref={ref} role="group" aria-label="Child popover">
        <button type="button">Popover action</button>
      </div>
    </Portal>
  );
}

function Toaster() {
  return (
    <Portal layer="toast">
      <div data-wave-focus-trap-allow="" role="region" aria-label="Notifications">
        <button type="button">Toast action</button>
      </div>
    </Portal>
  );
}

function Announcer() {
  return (
    <Portal>
      <div data-wave-announcer="" />
    </Portal>
  );
}

function wrapperOf(el: Element): Element {
  return el.closest('[data-wave-portal]') as Element;
}

describe('useModalIsolation', () => {
  it('makes everything outside the modal inert and keeps toasts, announcer and the modal itself', () => {
    const { container } = render(
      <>
        <button type="button">Page button</button>
        <Toaster />
        <Announcer />
        <Modal open label="Dialog" />
      </>,
    );
    expect(container).toHaveAttribute('inert');
    const dialog = screen.getByRole('dialog', { name: 'Dialog' });
    expect(wrapperOf(dialog)).not.toHaveAttribute('inert');
    // The backdrop lives in the modal's own portal wrapper and stays interactive.
    expect(screen.getByTestId('Dialog-backdrop').closest('[inert]')).toBeNull();
    const toasts = screen.getByRole('region', { name: 'Notifications' });
    expect(toasts.closest('[inert]')).toBeNull();
    expect(document.querySelector('[data-wave-announcer]')!.closest('[inert]')).toBeNull();
  });

  it('removes inert on disable and unmount, keeping elements that were inert before', () => {
    const preInert = document.createElement('div');
    preInert.setAttribute('inert', '');
    document.body.appendChild(preInert);
    try {
      const { container, rerender } = render(<Modal open label="Dialog" />);
      expect(container).toHaveAttribute('inert');
      rerender(<Modal open={false} label="Dialog" />);
      expect(container).not.toHaveAttribute('inert');
      expect(preInert).toHaveAttribute('inert');
    } finally {
      preInert.remove();
    }
  });

  it('makes its layer a barrier for the layers stacked below it only while isolating', () => {
    function RawModal({ isolate }: { isolate: boolean }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const surfaceRef = React.useRef<HTMLDivElement | null>(null);
      const setRefs = React.useCallback((el: HTMLDivElement | null) => {
        surfaceRef.current = el;
        setSurface(el);
      }, []);
      const { layerId } = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [surfaceRef],
        kind: 'modal',
      });
      useModalIsolation(isolate, { layerId, container: surface });
      return (
        <Portal layerId={layerId}>
          <div ref={setRefs} role="dialog" aria-label="Raw" />
        </Portal>
      );
    }
    const { rerender } = render(
      <>
        <ChildPopover open />
        <RawModal isolate />
      </>,
    );
    const popover = getOpenLayers().find((layer) => layer.kind === 'popover')!;
    expect(isBehindIsolatingModal(popover)).toBe(true);
    rerender(
      <>
        <ChildPopover open />
        <RawModal isolate={false} />
      </>,
    );
    // Still a modal-kind layer on top, but without isolation it shields nothing.
    expect(getTopmostLayer()!.kind).toBe('modal');
    expect(isBehindIsolatingModal(popover)).toBe(false);
  });

  it('keeps descendant-layer portals opened from inside the modal', () => {
    render(
      <Modal open label="Dialog">
        <ChildPopover open />
      </Modal>,
    );
    const popover = screen.getByRole('group', { name: 'Child popover' });
    expect(popover.closest('[inert]')).toBeNull();
  });

  it('inerts content appended to <body> later, with no layer opening or closing (MutationObserver)', async () => {
    render(<Modal open label="Dialog" />);
    const late = document.createElement('div');
    late.textContent = 'Late sibling';
    try {
      // The observer's callback runs in a microtask, which the async act() flushes.
      await act(async () => {
        document.body.appendChild(late);
      });
      expect(late).toHaveAttribute('inert');
    } finally {
      late.remove();
    }
  });

  it('keeps a descendant layer opened later usable', async () => {
    function App({ childOpen }: { childOpen: boolean }) {
      return (
        <Modal open label="Dialog">
          <ChildPopover open={childOpen} />
        </Modal>
      );
    }
    const { rerender } = render(<App childOpen={false} />);
    rerender(<App childOpen />);
    await flushMicrotasks();
    expect(screen.getByRole('group', { name: 'Child popover' }).closest('[inert]')).toBeNull();
  });

  it('ref-counts nested modals so they restore in stack order', () => {
    function App({ inner }: { inner: boolean }) {
      return (
        <Modal open label="Outer">
          <Modal open={inner} label="Inner" />
        </Modal>
      );
    }
    const { container, rerender } = render(<App inner={false} />);
    const outer = screen.getByRole('dialog', { name: 'Outer' });
    expect(wrapperOf(outer)).not.toHaveAttribute('inert');

    rerender(<App inner />);
    const inner = screen.getByRole('dialog', { name: 'Inner' });
    expect(wrapperOf(outer)).toHaveAttribute('inert');
    expect(wrapperOf(inner)).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');

    rerender(<App inner={false} />);
    expect(wrapperOf(outer)).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
  });

  it('keeps a sibling modal opened later (not a React descendant) usable, and re-isolates after it closes', async () => {
    // A global confirm dialog driven by app state, opened while another modal is open.
    function App({ confirm }: { confirm: boolean }) {
      return (
        <>
          <button type="button">Page button</button>
          <Modal open label="Settings" />
          <Modal open={confirm} label="Confirm" />
        </>
      );
    }
    const { container, rerender } = render(<App confirm={false} />);
    const settings = screen.getByRole('dialog', { name: 'Settings' });

    rerender(<App confirm />);
    // Settings' MutationObserver re-plans after the Confirm wrapper is appended to <body>.
    await flushMicrotasks();
    const confirm = screen.getByRole('dialog', { name: 'Confirm' });
    expect(confirm.closest('[inert]')).toBeNull();
    expect(wrapperOf(settings)).toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');

    rerender(<App confirm={false} />);
    await flushMicrotasks();
    expect(wrapperOf(settings)).not.toHaveAttribute('inert');
    expect(container).toHaveAttribute('inert');
  });

  it('keeps an inline sibling modal opened later inside the isolated page usable', async () => {
    function InlineModal({ open }: { open: boolean }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const ref = React.useRef<HTMLDivElement | null>(null);
      const setRefs = React.useCallback((el: HTMLDivElement | null) => {
        ref.current = el;
        setSurface(el);
      }, []);
      const { layerId } = useDismiss({ open, onDismiss: () => {}, refs: [ref], kind: 'modal' });
      useModalIsolation(open, { layerId, container: surface });
      if (!open) return null;
      return (
        <div ref={setRefs} role="dialog" aria-label="Inline confirm">
          <button type="button">Yes</button>
        </div>
      );
    }
    function App({ confirm }: { confirm: boolean }) {
      return (
        <main>
          <p data-testid="text">Page</p>
          <section data-testid="section">
            <InlineModal open={confirm} />
          </section>
          <Modal open label="Settings" />
        </main>
      );
    }
    const { rerender } = render(<App confirm={false} />);
    expect(screen.getByTestId('section').closest('[inert]')).not.toBeNull();

    rerender(<App confirm />);
    await flushMicrotasks();
    expect(screen.getByRole('dialog', { name: 'Inline confirm' }).closest('[inert]')).toBeNull();
    expect(screen.getByTestId('text')).toHaveAttribute('inert');
    expect(wrapperOf(screen.getByRole('dialog', { name: 'Settings' }))).toHaveAttribute('inert');

    rerender(<App confirm={false} />);
    await flushMicrotasks();
    expect(screen.getByTestId('section').closest('[inert]')).not.toBeNull();
    expect(wrapperOf(screen.getByRole('dialog', { name: 'Settings' }))).not.toHaveAttribute(
      'inert',
    );
  });

  it('isolates an inline (non-portaled) modal by walking up its ancestors', () => {
    function Inline() {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const ref = React.useRef<HTMLDivElement>(null);
      const { layerId } = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [ref],
        kind: 'modal',
      });
      useModalIsolation(true, { layerId, container: surface });
      return (
        <main>
          <nav data-testid="nav">Navigation</nav>
          <section data-testid="section">
            <p data-testid="sibling">Sibling</p>
            <div ref={setSurface} role="dialog" aria-label="Inline" />
          </section>
        </main>
      );
    }
    render(<Inline />);
    expect(screen.getByTestId('nav')).toHaveAttribute('inert');
    expect(screen.getByTestId('sibling')).toHaveAttribute('inert');
    expect(screen.getByTestId('section')).not.toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Inline' }).closest('[inert]')).toBeNull();
  });

  it('shares the inert counts with another copy of the library (global registry)', async () => {
    vi.resetModules();
    const copy = await import('../useModalIsolation');
    expect(copy.useModalIsolation).not.toBe(useModalIsolation);
    /** The Modal above, isolated through the other copy. */
    function CopyModal({ open }: { open: boolean }) {
      const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
      const surfaceRef = React.useRef<HTMLDivElement | null>(null);
      const setRefs = React.useCallback((el: HTMLDivElement | null) => {
        surfaceRef.current = el;
        setSurface(el);
      }, []);
      const { layerId } = useDismiss({
        open,
        onDismiss: () => {},
        refs: [surfaceRef],
        kind: 'modal',
      });
      copy.useModalIsolation(open, { layerId, container: surface });
      if (!open) return null;
      return (
        <Portal layerId={layerId}>
          <div ref={setRefs} role="dialog" aria-label="Confirm" />
        </Portal>
      );
    }
    function App({ settings, confirm }: { settings: boolean; confirm: boolean }) {
      return (
        <>
          <button type="button">Page button</button>
          <Modal open={settings} label="Settings" />
          <CopyModal open={confirm} />
        </>
      );
    }
    const { container, rerender } = render(<App settings confirm={false} />);
    rerender(<App settings confirm />);
    await flushMicrotasks();
    expect(container).toHaveAttribute('inert');
    // The first modal closes while the one isolated by the other copy stays open.
    rerender(<App settings={false} confirm />);
    await flushMicrotasks();
    expect(container).toHaveAttribute('inert');
    rerender(<App settings={false} confirm={false} />);
    expect(container).not.toHaveAttribute('inert');
  });

  it('works under StrictMode', () => {
    const { container, unmount } = render(
      <React.StrictMode>
        <Modal open label="Dialog" />
      </React.StrictMode>,
    );
    expect(container).toHaveAttribute('inert');
    unmount();
    expect(container).not.toHaveAttribute('inert');
  });
});
