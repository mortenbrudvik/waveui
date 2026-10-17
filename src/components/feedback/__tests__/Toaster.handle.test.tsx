import * as React from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster, useToastController } from '../Toast';
import type { ToastController, ToasterProps } from '../Toast';
import { createToaster } from '../../../lib/toaster';
import type { ToasterHandle } from '../../../lib/toaster';
import { useDismiss } from '../../../hooks/useDismiss';
import { useModalIsolation } from '../../../hooks/useModalIsolation';
import { Portal } from '../../portal/Portal';
import { advance, getLiveRegion, getToasts, getViewport } from './toasterHarness';

const texts = () => getToasts().map((toast) => toast.textContent);

describe('createToaster with a Toaster (P3-08, toaster-5)', () => {
  describe('timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows, announces once, times and pauses a toast dispatched from a plain function', () => {
      const handle = createToaster();
      /** A plain function, no hook: what a query-cache callback does. */
      const notifySaved = () => handle.dispatchToast({ status: 'success', title: 'Saved' });
      render(
        <Toaster toaster={handle}>
          <p>App</p>
        </Toaster>,
      );
      act(() => {
        notifySaved();
      });
      expect(getToasts()).toHaveLength(1);
      expect(getLiveRegion('polite').textContent).toBe('Success: Saved');
      expect(getLiveRegion('polite').childElementCount).toBe(1);
      // Paused on hover…
      fireEvent.pointerOver(getToasts()[0]);
      advance(20_000);
      expect(getToasts()).toHaveLength(1);
      fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
      // …and on focus.
      const dismissButton = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
      act(() => dismissButton.focus());
      advance(20_000);
      expect(getToasts()).toHaveLength(1);
      act(() => dismissButton.blur());
      advance(4999);
      expect(getToasts()).toHaveLength(1);
      advance(1);
      expect(getToasts()).toHaveLength(0);
    });
  });

  it('dismisses a toast through the handle', () => {
    const handle = createToaster();
    render(<Toaster toaster={handle} />);
    let id = '';
    act(() => {
      id = handle.dispatchToast(
        <Toast>
          <Toast.Title>Uploading</Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
    });
    expect(getToasts()).toHaveLength(1);
    act(() => handle.dismissToast(id));
    expect(getToasts()).toHaveLength(0);
  });

  it('shows dispatches made before a Toaster binds, in order', () => {
    const handle = createToaster();
    handle.dispatchToast({ title: 'First', timeout: 0 });
    handle.dispatchToast(<p>Second</p>, { timeout: 0 });
    render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: First', 'Info: Second']);
  });

  it('drops waiting toasts dismissed through the handle', () => {
    const handle = createToaster();
    const first = handle.dispatchToast({ title: 'First', timeout: 0 });
    handle.dispatchToast({ title: 'Second', timeout: 0 });
    handle.dismissToast(first);
    const { unmount } = render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: Second']);
    unmount();

    const other = createToaster();
    other.dispatchToast({ title: 'Third', timeout: 0 });
    other.dismissAllToasts();
    render(<Toaster toaster={other} />);
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps two handles bound to two Toasters independent (region, position, limit)', () => {
    const app = createToaster();
    const chat = createToaster();
    render(
      <>
        <Toaster toaster={app} aria-label="App notifications" position="top-end" limit={1} />
        <Toaster toaster={chat} aria-label="Chat notifications" position="bottom-start" />
      </>,
    );
    act(() => {
      app.dispatchToast({ title: 'App one', timeout: 0 });
      app.dispatchToast({ title: 'App two', timeout: 0 });
      chat.dispatchToast({ title: 'Chat one', timeout: 0 });
    });
    const appRegion = screen.getByRole('region', { name: 'App notifications' });
    const chatRegion = screen.getByRole('region', { name: 'Chat notifications' });
    expect(appRegion).toHaveAttribute('data-position', 'top-end');
    expect(within(appRegion).getByText('App one')).toBeInTheDocument();
    expect(within(appRegion).queryByText('App two')).not.toBeInTheDocument();
    expect(chatRegion).toHaveAttribute('data-position', 'bottom-start');
    expect(within(chatRegion).getByText('Chat one')).toBeInTheDocument();
    expect(within(chatRegion).queryByText('App one')).not.toBeInTheDocument();
  });

  it('unbinds when its Toaster unmounts; the next dispatch waits for a new Toaster', () => {
    const handle = createToaster();
    const first = render(<Toaster toaster={handle} />);
    first.unmount();
    handle.dispatchToast({ title: 'Later', timeout: 0 });
    render(<Toaster toaster={handle} />);
    expect(texts()).toEqual(['Info: Later']);
  });

  it('binds once under StrictMode and duplicates nothing', () => {
    const handle = createToaster();
    handle.dispatchToast({ title: 'Queued', timeout: 0 });
    render(
      <React.StrictMode>
        <Toaster toaster={handle} />
      </React.StrictMode>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Live', timeout: 0 });
    });
    expect(texts()).toEqual(['Info: Queued', 'Info: Live']);
  });

  it('warns and does not bind a second Toaster to a bound handle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = createToaster();
    render(
      <>
        <Toaster toaster={handle} aria-label="First notifications" />
        <Toaster toaster={handle} aria-label="Second notifications" />
      </>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Saved', timeout: 0 });
    });
    const firstRegion = screen.getByRole('region', { name: 'First notifications' });
    const secondRegion = screen.getByRole('region', { name: 'Second notifications' });
    expect(within(firstRegion).getByText('Saved')).toBeInTheDocument();
    expect(within(secondRegion).queryByText('Saved')).not.toBeInTheDocument();
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: this handle is already bound to another Toaster; a handle binds one Toaster. Create one handle per Toaster.',
      ],
    ]);
    warn.mockRestore();
  });

  it('warns when `toaster` is not a handle from createToaster()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function Nested() {
      const controller = useToastController();
      return <Toaster toaster={controller} aria-label="Nested notifications" />;
    }
    render(
      <Toaster>
        <Nested />
      </Toaster>,
    );
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: `toaster` is not a handle from createToaster(), so nothing is bound. Pass the value createToaster() returns.',
      ],
    ]);
    warn.mockRestore();
  });

  it('renders a handle’s toast in the Toaster’s React tree (context from above the Toaster)', () => {
    const RouteContext = React.createContext('none');
    function CurrentRoute() {
      return <>{React.useContext(RouteContext)}</>;
    }
    const handle = createToaster();
    render(
      <RouteContext.Provider value="/settings">
        <Toaster toaster={handle} />
      </RouteContext.Provider>,
    );
    act(() => {
      handle.dispatchToast(
        <Toast>
          <Toast.Title>
            Saved on <CurrentRoute />
          </Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
    });
    expect(getToasts()[0]).toHaveTextContent('Saved on /settings');
  });

  it('keeps a handle’s toast reachable by Tab over a modal', async () => {
    function StandInModal() {
      const [surface, setSurface] = React.useState<HTMLElement | null>(null);
      useModalIsolation(surface !== null, { layerId: 'stand-in-modal', container: surface });
      return (
        <Portal>
          <div ref={setSurface} role="dialog" aria-label="Stand-in">
            <button type="button">Inside</button>
          </div>
        </Portal>
      );
    }
    const user = userEvent.setup();
    const handle = createToaster();
    render(
      <Toaster toaster={handle}>
        <StandInModal />
      </Toaster>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Over the modal', timeout: 0 });
    });
    act(() => screen.getByRole('button', { name: 'Inside' }).focus());
    await user.tab();
    expect(within(getViewport()).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('moves a handle’s toasts beside an open panel at their edge', () => {
    // jsdom's window is 1024 × 768 without layout: the stand-in panel reports a stubbed box.
    function StandInPanel() {
      const surfaceRef = React.useRef<HTMLElement | null>(null);
      const { layerId } = useDismiss({
        open: true,
        onDismiss: () => {},
        refs: [surfaceRef],
        kind: 'modal',
      });
      const attach = React.useCallback((el: HTMLDivElement | null) => {
        surfaceRef.current = el;
        if (el) {
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
        }
      }, []);
      return (
        <Portal layerId={layerId}>
          <div ref={attach} role="dialog" aria-label="Filters">
            <button type="button">Apply</button>
          </div>
        </Portal>
      );
    }
    const handle = createToaster();
    render(
      <Toaster toaster={handle}>
        <StandInPanel />
      </Toaster>,
    );
    act(() => {
      handle.dispatchToast({ title: 'Filters saved', timeout: 0 });
    });
    expect(getViewport().style.getPropertyValue('--wave-toaster-offset')).toBe('320px');
  });

  it('types the handle as the controller and the toaster prop', () => {
    expectTypeOf<ToasterHandle>().toExtend<ToastController>();
    expectTypeOf(createToaster).returns.toEqualTypeOf<ToasterHandle>();
    expectTypeOf<ToasterProps['toaster']>().toEqualTypeOf<ToasterHandle | undefined>();
  });
});
