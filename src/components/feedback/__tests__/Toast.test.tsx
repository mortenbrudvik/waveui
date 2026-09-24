import * as React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach, expectTypeOf } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster, useToastController } from '../Toast';
import type { ToastController, ToastOptions, ToastProps, ToasterProps } from '../Toast';
import { useModalIsolation } from '../../../hooks/useModalIsolation';
import { Portal } from '../../portal/Portal';
import {
  expectNoA11yViolations,
  renderWithProviders,
  testNoImplicitSubmit,
  testSystemProps,
} from '../../../test-utils';

/** Exposes the controller of the enclosing Toaster to the test. */
function ControllerProbe({ ref }: { ref: React.Ref<ToastController> }) {
  const controller = useToastController();
  React.useImperativeHandle(ref, () => controller, [controller]);
  return null;
}

function renderToaster(props: Partial<ToasterProps> = {}, options: { app?: React.ReactNode } = {}) {
  const controllerRef = React.createRef<ToastController>();
  const ui = (
    <Toaster {...props}>
      <ControllerProbe ref={controllerRef} />
      {options.app}
    </Toaster>
  );
  const utils = render(ui);
  const controller = (): ToastController => {
    if (!controllerRef.current) throw new Error('the Toaster controller is not available');
    return controllerRef.current;
  };
  const dispatch = (toast: ToastOptions): string => {
    let id = '';
    act(() => {
      id = controller().dispatchToast(toast);
    });
    return id;
  };
  const dismiss = (id: string) => {
    act(() => controller().dismissToast(id));
  };
  return { ...utils, controller, dispatch, dismiss };
}

const getViewport = () => screen.getByRole('region', { name: 'Notifications' });

function getLiveRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const region = getViewport().querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
  if (!region) throw new Error(`no ${politeness} live region`);
  return region;
}

/** The visual toasts rendered by the Toaster, in order. */
const getToasts = () =>
  Array.from(getViewport().querySelectorAll<HTMLElement>('[data-wave-toast]'));

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('Toast', () => {
  testSystemProps(Toast, {
    expectedTag: 'div',
    displayName: 'Toast',
    defaultProps: { title: 'Saved' },
    conflictingClass: { className: 'p-6', overrides: 'p-3' },
    a11yVariants: [
      {
        name: 'dismissible error',
        props: { status: 'error', onDismiss: () => {}, children: 'The file could not be saved.' },
      },
    ],
  });

  it('renders title and body', () => {
    render(<Toast title="Success!">Body text</Toast>);
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });

  it('calls onDismiss from a typed dismiss button', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>Hello</Toast>);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.querySelector('[data-wave-icon="dismiss"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await user.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders no dismiss button without onDismiss', () => {
    render(<Toast title="Saved" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('forms (button-provider#1)', () => {
    testNoImplicitSubmit(Toast, { defaultProps: { title: 'Saved', onDismiss: () => {} } });
  });

  it('carries no live-region role of its own (feedback-navigation#11)', () => {
    render(
      <Toast status="error" title="Failed" data-testid="toast">
        Hello
      </Toast>,
    );
    const toast = screen.getByTestId('toast');
    expect(toast).not.toHaveAttribute('role');
    expect(toast).not.toHaveAttribute('aria-live');
  });

  describe('status (feedback-navigation#4, #14)', () => {
    it.each([
      ['info', 'Info:', 'border-s-info'],
      ['success', 'Success:', 'border-s-success'],
      ['warning', 'Warning:', 'border-s-warning'],
      ['error', 'Error:', 'border-s-error'],
    ] as const)(
      'status %s reads "%s" first, shows its glyph and a %s border',
      (status, label, border) => {
        render(
          <Toast status={status} title="Upload" data-testid="toast">
            Details
          </Toast>,
        );
        const toast = screen.getByTestId('toast');
        expect(toast).toHaveTextContent(new RegExp(`^${label}\\s*Upload\\s*Details$`));
        expect(within(toast).getByText(label)).toHaveClass('sr-only');
        const glyph = toast.querySelector(`[data-wave-icon="${status}"]`);
        expect(glyph).not.toBeNull();
        expect(glyph?.closest('[aria-hidden="true"]')).not.toBeNull();
        expect(toast).toHaveClass('border-s-4', border);
      },
    );

    it('statusLabel overrides the status text (i18n)', () => {
      render(<Toast status="error" statusLabel="Fehler:" title="Upload" data-testid="toast" />);
      expect(screen.getByTestId('toast')).toHaveTextContent(/^Fehler:\s*Upload$/);
      expect(screen.queryByText('Error:')).not.toBeInTheDocument();
    });
  });

  it('uses the logical start border under RTL (feedback-navigation#34)', () => {
    renderWithProviders(<Toast title="Saved" data-testid="toast" />, { dir: 'rtl' });
    const toast = screen.getByTestId('toast');
    expect(toast.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(toast).toHaveClass('border-s-4', 'border-s-info');
  });
});

describe('Toaster', () => {
  testSystemProps(Toaster, {
    expectedTag: 'div',
    displayName: 'Toaster',
    conflictingClass: { className: 'w-96', overrides: 'w-80' },
  });

  it('renders children (app content)', () => {
    render(
      <Toaster>
        <p>App content</p>
      </Toaster>,
    );
    expect(screen.getByText('App content')).toBeInTheDocument();
  });

  it('portals a labelled, allow-listed toast region (feedback-navigation#12, #50)', () => {
    const { container } = render(
      <Toaster>
        <p>App</p>
      </Toaster>,
    );
    const viewport = getViewport();
    expect(container).not.toContainElement(viewport);
    expect(viewport).toHaveAttribute('data-wave-focus-trap-allow');
    expect(viewport.closest('[data-wave-portal]')).toHaveAttribute('data-layer', 'toast');
  });

  it('has no accessibility violations with toasts shown (feedback-navigation#15)', async () => {
    const { dispatch } = renderToaster({}, { app: <p>App content</p> });
    dispatch({ status: 'error', title: 'Upload failed', body: 'Try again.', timeout: 0 });
    dispatch({ status: 'success', title: 'Saved', timeout: 0 });
    const toasts = getToasts();
    expect(toasts).toHaveLength(2);
    for (const toast of toasts) {
      expect(within(toast).getByRole('button', { name: 'Dismiss' })).toHaveAttribute(
        'type',
        'button',
      );
    }
    expect(getLiveRegion('assertive')).toHaveTextContent('Error: Upload failed Try again.');
    expect(getLiveRegion('polite')).toHaveTextContent('Success: Saved');
    await expectNoA11yViolations(document.body);
  });

  it('renders permanent polite and assertive live regions before any toast (feedback-navigation#11)', () => {
    renderToaster();
    const polite = getLiveRegion('polite');
    const assertive = getLiveRegion('assertive');
    expect(polite).toHaveAttribute('role', 'status');
    expect(polite).toBeEmptyDOMElement();
    expect(assertive).toBeEmptyDOMElement();
    expect(polite).toHaveClass('sr-only');
    expect(assertive).toHaveClass('sr-only');
  });

  describe('positions (overlays#40)', () => {
    it.each([
      [undefined, 'bottom-end', ['bottom-4', 'end-4']],
      ['bottom-end', 'bottom-end', ['bottom-4', 'end-4']],
      ['bottom-start', 'bottom-start', ['bottom-4', 'start-4']],
      ['top-end', 'top-end', ['top-4', 'end-4']],
      ['top-start', 'top-start', ['top-4', 'start-4']],
      ['top-right', 'top-right', ['top-4', 'right-4']],
      ['top-left', 'top-left', ['top-4', 'left-4']],
      ['bottom-right', 'bottom-right', ['bottom-4', 'right-4']],
      ['bottom-left', 'bottom-left', ['bottom-4', 'left-4']],
    ] as const)('position %s maps to %s', (position, dataPosition, classes) => {
      render(<Toaster position={position} />);
      const viewport = getViewport();
      expect(viewport).toHaveAttribute('data-position', dataPosition);
      expect(viewport).toHaveClass('fixed', ...classes);
    });

    it('logical positions follow the direction (RTL)', () => {
      renderWithProviders(<Toaster />, { dir: 'rtl' });
      const viewport = getViewport();
      expect(viewport.closest('[dir]')).toHaveAttribute('dir', 'rtl');
      expect(viewport).toHaveClass('bottom-4', 'end-4');
      expect(viewport).not.toHaveClass('right-4');
    });
  });
});

describe('useToastController', () => {
  function DispatchButton() {
    const { dispatchToast } = useToastController();
    return (
      <button
        type="button"
        onClick={() => dispatchToast({ title: 'Test toast', status: 'success', timeout: 0 })}
      >
        Show Toast
      </button>
    );
  }

  it('dispatches a toast via the controller', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <DispatchButton />
      </Toaster>,
    );
    await user.click(screen.getByRole('button', { name: 'Show Toast' }));
    expect(screen.getByText('Test toast')).toBeInTheDocument();
    expect(getToasts()).toHaveLength(1);
  });

  it('throws a descriptive error outside <Toaster> in development (feedback-navigation#8)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<DispatchButton />)).toThrow(
      '[WaveUI] useToastController must be used within <Toaster>',
    );
    error.mockRestore();
  });

  it('logs and returns an inert controller outside <Toaster> in production', async () => {
    vi.resetModules();
    vi.doMock('../../../lib/dev', async (importOriginal) => ({
      ...(await importOriginal<typeof import('../../../lib/dev')>()),
      isDev: false,
    }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { useToastController: useProdController } = await import('../Toast');
      let result = 'unset';
      function Probe() {
        const { dispatchToast, dismissToast } = useProdController();
        return (
          <button
            type="button"
            onClick={() => {
              result = dispatchToast({ title: 'Lost', toastId: 'lost' });
              dismissToast('lost');
            }}
          >
            Go
          </button>
        );
      }
      const { rerender } = render(<Probe />);
      rerender(<Probe />);
      rerender(<Probe />);
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      expect(result).toBe('lost');
      // Logged once, not on every render of the calling component.
      const reports = error.mock.calls.filter(([message]) =>
        String(message).includes('[WaveUI] useToastController must be used within <Toaster>'),
      );
      expect(reports).toHaveLength(1);
      expect(screen.queryByText('Lost')).not.toBeInTheDocument();
    } finally {
      error.mockRestore();
      vi.doUnmock('../../../lib/dev');
      vi.resetModules();
    }
  });

  it('exposes a stable, memoized controller (table-core#25)', () => {
    const seen = new Set<ToastController>();
    function Collector() {
      const controller = useToastController();
      React.useEffect(() => {
        seen.add(controller);
      });
      return null;
    }
    const { rerender } = render(
      <Toaster position="top-end">
        <Collector />
      </Toaster>,
    );
    rerender(
      <Toaster position="top-end" className="w-96">
        <Collector />
      </Toaster>,
    );
    expect(seen.size).toBe(1);
  });

  it('types the controller (button-provider#27)', () => {
    expectTypeOf(useToastController).returns.toEqualTypeOf<ToastController>();
    expectTypeOf<ToastController['dispatchToast']>().returns.toEqualTypeOf<string>();
    expectTypeOf<ToastController['dismissToast']>().parameters.toEqualTypeOf<[id: string]>();
    expectTypeOf<ToastOptions>().toHaveProperty('toastId').toEqualTypeOf<string | undefined>();
    expectTypeOf<ToastProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
    expectTypeOf<ToasterProps['ref']>().toEqualTypeOf<React.Ref<HTMLDivElement> | undefined>();
  });
});

describe('Toaster: ids and dismissal (feedback-navigation#7)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispatchToast returns an id; dismissToast(id) removes only that toast and its timer', () => {
    const { dispatch, dismiss } = renderToaster();
    const first = dispatch({ title: 'First' });
    const second = dispatch({ title: 'Second', timeout: 0 });
    expect(typeof first).toBe('string');
    expect(first).not.toBe('');
    expect(second).not.toBe(first);
    expect(vi.getTimerCount()).toBe(1);

    dismiss(first);
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    dismiss(second);
    expect(getToasts()).toHaveLength(0);
  });

  it('uses a caller-supplied toastId, and the same id replaces the toast', () => {
    const { dispatch } = renderToaster();
    expect(dispatch({ toastId: 'save', title: 'Saving…', timeout: 0 })).toBe('save');
    expect(dispatch({ toastId: 'save', title: 'Saved', status: 'success' })).toBe('save');
    expect(getToasts()).toHaveLength(1);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success: Saved$/);

    // The replacement restarted the timer with its own (default) timeout.
    advance(4999);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('dismissing an unknown id is a no-op', () => {
    const { dispatch, dismiss } = renderToaster();
    dispatch({ title: 'Kept', timeout: 0 });
    dismiss('nope');
    expect(screen.getByText('Kept')).toBeInTheDocument();
  });
});

describe('Toaster: announcements (feedback-navigation#11, #14)', () => {
  it.each([
    ['info', 'polite', 'Info:'],
    ['success', 'polite', 'Success:'],
    ['warning', 'polite', 'Warning:'],
    ['error', 'assertive', 'Error:'],
  ] as const)('a %s toast is announced in the %s region', (status, politeness, label) => {
    const { dispatch } = renderToaster();
    dispatch({ status, title: 'Upload', body: 'Details here', timeout: 0 });
    const other = politeness === 'polite' ? 'assertive' : 'polite';
    expect(getLiveRegion(politeness)).toHaveTextContent(`${label} Upload Details here`);
    expect(getLiveRegion(other)).toBeEmptyDOMElement();

    const [toast] = getToasts();
    expect(toast).not.toHaveAttribute('role');
    expect(toast).not.toHaveAttribute('aria-live');
    expect(toast.querySelector(`[data-wave-icon="${status}"]`)).not.toBeNull();
    expect(toast).toHaveTextContent(new RegExp(`^${label}\\s*Upload\\s*Details here`));
  });

  it('announces each toast and drops the announcement when the toast goes', () => {
    const { dispatch, dismiss } = renderToaster();
    const first = dispatch({ title: 'One', timeout: 0 });
    dispatch({ title: 'Two', timeout: 0 });
    const polite = getLiveRegion('polite');
    expect(polite).toHaveTextContent('Info: One');
    expect(polite).toHaveTextContent('Info: Two');
    dismiss(first);
    expect(polite).not.toHaveTextContent('One');
    expect(polite).toHaveTextContent('Info: Two');
  });

  it('uses the statusLabel option for the visible and announced status text', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'error', statusLabel: 'Fehler:', title: 'Upload', timeout: 0 });
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Fehler: Upload$/);
    expect(getToasts()[0]).toHaveTextContent(/^Fehler:\s*Upload/);
  });
});

describe('Toaster: timers (feedback-navigation#13)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes a toast after the default 5000 ms', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Default' });
    advance(4999);
    expect(screen.getByText('Default')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honours a custom timeout', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Quick', timeout: 1000 });
    advance(999);
    expect(screen.getByText('Quick')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('Quick')).not.toBeInTheDocument();
  });

  it('keeps a timeout: 0 toast (no timer)', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Sticky', timeout: 0 });
    expect(vi.getTimerCount()).toBe(0);
    advance(60_000);
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });

  it('dismisses one of two toasts with its Dismiss button', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'First' });
    dispatch({ title: 'Second' });
    const [first] = getToasts();
    fireEvent.click(within(first).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('clears every timer on unmount and logs nothing', () => {
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const { dispatch, unmount } = renderToaster();
    dispatch({ title: 'One' });
    dispatch({ title: 'Two', timeout: 1000 });
    expect(vi.getTimerCount()).toBe(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    error.mockRestore();
    warn.mockRestore();
  });

  it('keeps timers running under StrictMode (effects re-run)', () => {
    function Welcome() {
      const { dispatchToast } = useToastController();
      React.useEffect(() => {
        dispatchToast({ toastId: 'welcome', title: 'Welcome' });
      }, [dispatchToast]);
      return null;
    }
    render(
      <React.StrictMode>
        <Toaster>
          <Welcome />
        </Toaster>
      </React.StrictMode>,
    );
    expect(getToasts()).toHaveLength(1);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Toaster: pausing (feedback-navigation#12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses while the pointer is over a toast and resumes with the remaining time', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hover me' });
    advance(3000);
    const [toast] = getToasts();
    fireEvent.pointerOver(toast);
    advance(20_000);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    fireEvent.pointerOut(toast, { relatedTarget: document.body });
    advance(1999);
    expect(screen.getByText('Hover me')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('Hover me')).not.toBeInTheDocument();
  });

  it('pauses only the hovered toast', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hovered' });
    dispatch({ title: 'Other' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(5000);
    expect(screen.getByText('Hovered')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  it('pauses while focus is inside a toast', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Focus me' });
    advance(1000);
    const button = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
    act(() => button.focus());
    advance(20_000);
    expect(screen.getByText('Focus me')).toBeInTheDocument();
    act(() => button.blur());
    advance(3999);
    expect(screen.getByText('Focus me')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('Focus me')).not.toBeInTheDocument();
  });

  it('pauses every toast while the window is blurred', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Away' });
    advance(2000);
    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
    });
    dispatch({ title: 'Arrived while away', timeout: 1000 });
    advance(30_000);
    expect(getToasts()).toHaveLength(2);
    act(() => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    advance(1000);
    expect(screen.queryByText('Arrived while away')).not.toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
    advance(2000);
    expect(getToasts()).toHaveLength(0);
  });
});

describe('Toaster: focus (feedback-navigation#12)', () => {
  function App() {
    const { dispatchToast } = useToastController();
    return (
      <button
        type="button"
        onClick={() => dispatchToast({ title: 'Saved', status: 'success', timeout: 0 })}
      >
        Save
      </button>
    );
  }

  it('is reachable by Tab after the app content', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <App />
      </Toaster>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.tab();
    expect(within(getViewport()).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('returns focus to the previously focused element when the last focused toast goes', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <App />
      </Toaster>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(save).toHaveFocus();
  });

  it('moves focus to the next toast when a focused toast is dismissed', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    dispatch({ title: 'Third', timeout: 0 });
    const [, second, third] = getToasts();
    await user.click(within(second).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(within(third).getByRole('button', { name: 'Dismiss' })).toHaveFocus();

    await user.click(within(third).getByRole('button', { name: 'Dismiss' }));
    const [first] = getToasts();
    expect(within(first).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('keeps the return target while focus moves from a dismissed toast to the next one', async () => {
    function SaveTwice() {
      const { dispatchToast } = useToastController();
      return (
        <button
          type="button"
          onClick={() => {
            dispatchToast({ title: 'First', timeout: 0 });
            dispatchToast({ title: 'Second', timeout: 0 });
          }}
        >
          Save
        </button>
      );
    }
    const user = userEvent.setup();
    render(
      <Toaster>
        <SaveTwice />
      </Toaster>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.tab();
    const [first, second] = getToasts();
    expect(within(first).getByRole('button', { name: 'Dismiss' })).toHaveFocus();

    // The Toaster's own move to the next toast arrives with no related target.
    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(1);
    expect(within(second).getByRole('button', { name: 'Dismiss' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(save).toHaveFocus();
  });

  it('keeps the return target when the browser blurs the focused toast while removing it', async () => {
    // Emulates browsers that fire blur/focusout synchronously while a focused node is removed:
    // the node is still connected and `<body>` is already the active element. React ignores
    // events fired during its commit, so the removal must not make the Toaster forget.
    const removeChild = Node.prototype.removeChild;
    const spy = vi.spyOn(Node.prototype, 'removeChild').mockImplementation(function <
      T extends Node,
    >(this: Node, child: T): T {
      const active = child.ownerDocument?.activeElement;
      if (active instanceof HTMLElement && child.contains(active)) active.blur();
      return removeChild.call(this, child) as T;
    });
    try {
      function SaveTwice() {
        const { dispatchToast } = useToastController();
        return (
          <button
            type="button"
            onClick={() => {
              dispatchToast({ title: 'First', timeout: 0 });
              dispatchToast({ title: 'Second', timeout: 0 });
            }}
          >
            Save
          </button>
        );
      }
      const user = userEvent.setup();
      render(
        <Toaster>
          <SaveTwice />
        </Toaster>,
      );
      const save = screen.getByRole('button', { name: 'Save' });
      await user.click(save);
      await user.tab();
      await user.keyboard('{Enter}');
      const [second] = getToasts();
      expect(within(second).getByRole('button', { name: 'Dismiss' })).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(getToasts()).toHaveLength(0);
      expect(save).toHaveFocus();
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps the return target when the window loses and regains focus', async () => {
    const user = userEvent.setup();
    render(
      <Toaster>
        <App />
      </Toaster>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.tab();
    const dismissButton = within(getViewport()).getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveFocus();

    // Switching windows: the button keeps document focus while blur/focusout and, on return,
    // focus/focusin fire with no related target.
    fireEvent.blur(dismissButton);
    fireEvent.focusOut(dismissButton);
    act(() => {
      window.dispatchEvent(new FocusEvent('blur'));
    });
    act(() => {
      window.dispatchEvent(new FocusEvent('focus'));
    });
    fireEvent.focus(dismissButton);
    fireEvent.focusIn(dismissButton);
    expect(dismissButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(save).toHaveFocus();
  });

  it('forgets the previous element when focus leaves the toasts for another element', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster(
      {},
      {
        app: (
          <>
            <input aria-label="Name" />
            <button type="button">Other</button>
          </>
        ),
      },
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    const other = screen.getByRole('button', { name: 'Other' });
    dispatch({ title: 'First', timeout: 0 });
    await user.click(input);
    await user.tab();
    await user.tab();
    const dismissButton = within(getViewport()).getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveFocus();

    // Focus goes to another element, then to <body>, then back into the toast from nowhere.
    act(() => other.focus());
    act(() => other.blur());
    act(() => dismissButton.focus());
    expect(dismissButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(input).not.toHaveFocus();
    expect(other).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('forgets the previous element when focus enters the toasts from <body>', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'First', timeout: 0 });
    await user.click(input);
    await user.tab();
    const dismissButton = within(getViewport()).getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveFocus();

    // Focus leaves to <body>, then enters the toast again with no related target.
    act(() => dismissButton.blur());
    expect(document.body).toHaveFocus();
    act(() => dismissButton.focus());
    expect(dismissButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    // The input focused long before is not a valid return target any more.
    expect(input).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it('forgets the previous element once focus has returned to it', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'First', timeout: 0 });
    await user.click(input);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();

    // Focus leaves the input for <body>, then enters a new toast with no related target
    // (programmatic focus, landmark navigation): the return target was used up above.
    act(() => input.blur());
    dispatch({ title: 'Second', timeout: 0 });
    const dismissButton = within(getViewport()).getByRole('button', { name: 'Dismiss' });
    act(() => dismissButton.focus());
    expect(dismissButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(input).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("runs the consumer's onFocus and onBlur on the toast region (C-COMPOSE)", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <Toaster onFocus={onFocus} onBlur={onBlur}>
        <App />
      </Toaster>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps focus in place when an unfocused toast goes', async () => {
    const user = userEvent.setup();
    const { dispatch, dismiss } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    await user.click(input);
    const id = dispatch({ title: 'Background', timeout: 0 });
    dismiss(id);
    await act(async () => {});
    expect(input).toHaveFocus();
  });

  it('stays outside modal isolation (stand-in isolating modal, feedback-navigation#50)', async () => {
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
    const { container, dispatch } = renderToaster({}, { app: <StandInModal /> });
    dispatch({ title: 'Over the modal', timeout: 0 });
    const viewport = getViewport();
    expect(container).toHaveAttribute('inert');
    expect(viewport.closest('[inert]')).toBeNull();

    screen.getByRole('button', { name: 'Inside' }).focus();
    await user.tab();
    expect(within(viewport).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });
});

describe('Toaster: user interaction under fake timers (feedback-navigation#12)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function App() {
    const { dispatchToast } = useToastController();
    return (
      <button type="button" onClick={() => dispatchToast({ title: 'Saved', status: 'success' })}>
        Save
      </button>
    );
  }

  it('waits for a keyboard user who tabbed to the toast, then returns focus on dismiss', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Toaster>
        <App />
      </Toaster>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    await user.tab();
    const dismissButton = within(getViewport()).getByRole('button', { name: 'Dismiss' });
    expect(dismissButton).toHaveFocus();
    advance(60_000);
    expect(screen.getByText('Saved')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(getToasts()).toHaveLength(0);
    expect(save).toHaveFocus();
  });

  it('pauses while hovered and resumes after the pointer leaves', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Toaster>
        <App />
      </Toaster>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const [toast] = getToasts();
    await user.hover(toast);
    advance(60_000);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await user.unhover(toast);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });
});
