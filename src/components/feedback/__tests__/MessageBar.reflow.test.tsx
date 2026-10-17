import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MessageBar } from '../MessageBar';
import type { MessageBarProps } from '../MessageBar';
import { Button } from '../../button/Button';
import { messageBarClassNames } from '../../../lib/classNames';
import { installResizeObserverMock, mockRect } from '../../../test-utils';
import type { ResizeObserverMock } from '../../../test-utils';

/** The listeners React subscribed to a store through useSyncExternalStore (see the mock below). */
const storeListeners = vi.hoisted(() => [] as Array<ReturnType<typeof vi.fn>>);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  // A pass-through that records each listener, so a test can assert none is notified.
  const useSyncExternalStore: typeof actual.useSyncExternalStore = (subscribe, ...rest) =>
    actual.useSyncExternalStore(
      (listener) => {
        const spy = vi.fn(listener);
        storeListeners.push(spy);
        return subscribe(spy);
      },
      ...rest,
    );
  return { ...actual, default: { ...actual, useSyncExternalStore }, useSyncExternalStore };
});

/** Resolves after the next animation frame (the reflow measures a resize one frame later). */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** Classes that cut text off; no layout may put them on the text column (D17, WCAG 1.4.10). */
const CLIPPING_CLASSES = [
  'truncate',
  'text-ellipsis',
  'text-clip',
  'overflow-hidden',
  'line-clamp-1',
];

/** An `'auto'` bar (unless `layout` says otherwise) with a Retry action (unless `actions` is false). */
function ReflowBar({
  layout,
  actions = true,
  children = 'Your session expires in five minutes.',
}: {
  layout?: MessageBarProps['layout'];
  actions?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <MessageBar layout={layout}>
      {children}
      {actions && (
        <MessageBar.Actions>
          <Button>Retry</Button>
        </MessageBar.Actions>
      )}
    </MessageBar>
  );
}

/** Text that changes without a render of the bar (a live progress message). */
interface LiveMessageHandle {
  set(message: string): void;
}
function LiveMessage({ ref }: { ref: React.Ref<LiveMessageHandle> }) {
  const [message, setMessage] = React.useState('Uploading…');
  React.useImperativeHandle(ref, () => ({ set: setMessage }), []);
  return <>{message}</>;
}

function textColumn(bar: HTMLElement): HTMLElement {
  const column = bar.querySelector<HTMLElement>(`.${messageBarClassNames.body}`);
  if (!column) throw new Error('the bar has no text column');
  return column;
}

/**
 * Gives the bar and its text column the widths of a real layout (jsdom lays nothing out): `root`
 * is the bar's client width, `text` the column's client width and `content` its scroll width.
 */
function setWidths(
  bar: HTMLElement,
  { root, text, content }: { root: number; text: number; content: number },
): void {
  mockRect(bar, { width: root });
  const column = textColumn(bar);
  mockRect(column, { width: text });
  Object.defineProperty(column, 'scrollWidth', { configurable: true, value: content });
}

describe('MessageBar reflow (D17)', () => {
  let ro: ResizeObserverMock;

  beforeEach(() => {
    ro = installResizeObserverMock();
  });

  afterEach(() => {
    ro.restore();
    vi.restoreAllMocks();
  });

  /** Reports a resize of the bar and lets the measurement of the next frame land. */
  async function resize(bar: HTMLElement): Promise<void> {
    ro.trigger(bar);
    await act(async () => {
      await nextFrame();
    });
  }

  it("does not observe a bar without actions ('auto' is multiline)", () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(<ReflowBar actions={false} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();
  });

  it('does not observe a bar whose actions render nothing', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(
      <MessageBar>
        Body
        <MessageBar.Actions>{false}</MessageBar.Actions>
      </MessageBar>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();
  });

  it('never observes an explicit layout', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const { rerender } = render(<ReflowBar layout="singleline" />);
    rerender(<ReflowBar layout="multiline" />);
    expect(observe).not.toHaveBeenCalled();
  });

  it('observes the root of an auto bar with actions and starts with one row', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(bar, { box: 'border-box' });
  });

  it('switches to multiline while the text overflows and back once the bar is as wide as the text needed', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    // The text needs 150 px more than its column, so the bar needs 400 + 150 = 550 px.
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    // Multiline geometry: the wrapped column never overflows, yet the bar stays multiline until it
    // is wide enough (a rule that reads the overflow in every layout would loop here).
    setWidths(bar, { root: 400, text: 400, content: 400 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 549, text: 549, content: 549 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 550, text: 550, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('keeps the text column unwrapped only while it measures one row, and never cuts it off', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(textColumn(bar)).toHaveClass('whitespace-nowrap');
    for (const cls of CLIPPING_CLASSES) expect(textColumn(bar)).not.toHaveClass(cls);

    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(textColumn(bar)).not.toHaveClass('whitespace-nowrap');
    for (const cls of CLIPPING_CLASSES) expect(textColumn(bar)).not.toHaveClass(cls);
  });

  it('keeps focus on an action through a reflow', async () => {
    render(<ReflowBar />);
    const bar = screen.getByRole('status');
    const action = screen.getByRole('button', { name: 'Retry' });
    act(() => action.focus());
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(screen.getByRole('button', { name: 'Retry' })).toBe(action);
    expect(action).toHaveFocus();
  });

  it('attaches and detaches the observer as actions come and go, with no stale multiline state', async () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const { rerender } = render(<ReflowBar actions={false} />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(observe).not.toHaveBeenCalled();

    rerender(<ReflowBar />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(1);
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    rerender(<ReflowBar actions={false} />);
    expect(bar).toHaveAttribute('data-layout', 'multiline');
    expect(disconnect).toHaveBeenCalledTimes(1);

    rerender(<ReflowBar />);
    // Measured again from one row: the new text column fits, so the old measurement is gone.
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('starts over when the layout changes back to auto', async () => {
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const { rerender } = render(<ReflowBar />);
    const bar = screen.getByRole('status');
    setWidths(bar, { root: 400, text: 200, content: 350 }); // needs 550 px
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    rerender(<ReflowBar layout="singleline" />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
    expect(disconnect).toHaveBeenCalledTimes(1);

    // The text got shorter meanwhile: it fits the 400 px bar, narrower than the 550 px measured before.
    setWidths(bar, { root: 400, text: 200, content: 150 });
    rerender(<ReflowBar layout="auto" />);
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('re-measures when the text changes inside the column without a render of the bar', async () => {
    const live = React.createRef<LiveMessageHandle>();
    render(
      <ReflowBar>
        <LiveMessage ref={live} />
      </ReflowBar>,
    );
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    setWidths(bar, { root: 400, text: 200, content: 350 });
    await act(async () => {
      live.current?.set('Uploading 3 of 10 files to the shared team folder…');
    });
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 400, text: 200, content: 150 });
    await act(async () => {
      live.current?.set('Upload done');
    });
    expect(bar).toHaveAttribute('data-layout', 'singleline');
  });

  it('releases every observer and the pending frame on unmount, and notifies no listener', async () => {
    const roDisconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    const moDisconnect = vi.spyOn(globalThis.MutationObserver.prototype, 'disconnect');
    const cancelFrame = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const { unmount } = render(<ReflowBar />);
    const bar = screen.getByRole('status');
    setWidths(bar, { root: 400, text: 200, content: 350 });
    await resize(bar);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    // A resize whose frame is still pending when the bar unmounts.
    ro.trigger(bar);
    const framesCancelled = cancelFrame.mock.calls.length;
    roDisconnect.mockClear();
    moDisconnect.mockClear();
    for (const listener of storeListeners) listener.mockClear();
    unmount();
    expect(roDisconnect).toHaveBeenCalledTimes(1);
    expect(moDisconnect).toHaveBeenCalledTimes(1);
    expect(cancelFrame.mock.calls.length).toBeGreaterThan(framesCancelled);
    // The layout cleanups run before the store unsubscribes: a notification would update a deleted fiber.
    expect(storeListeners.length).toBeGreaterThan(0);
    for (const listener of storeListeners) expect(listener).not.toHaveBeenCalled();
  });

  it('leaves one observer on the root in StrictMode', () => {
    const observe = vi.spyOn(globalThis.ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(globalThis.ResizeObserver.prototype, 'disconnect');
    render(
      <React.StrictMode>
        <ReflowBar />
      </React.StrictMode>,
    );
    const bar = screen.getByRole('status');
    expect(observe).toHaveBeenCalledWith(bar, { box: 'border-box' });
    // StrictMode runs the effects twice: every observer but one is disconnected again.
    expect(observe.mock.calls.length - disconnect.mock.calls.length).toBe(1);
  });

  it('renders one row on the server and hydrates without warnings', async () => {
    expect(renderToString(<MessageBar>Msg</MessageBar>)).toContain('data-layout="multiline"');
    const ui = (
      <MessageBar status="warning" onDismiss={() => {}}>
        <MessageBar.Title>Update available</MessageBar.Title>A new version is ready to install.
        <MessageBar.Actions>
          <Button>Update now</Button>
        </MessageBar.Actions>
      </MessageBar>
    );
    const html = renderToString(ui);
    expect(html).toContain('data-layout="singleline"');
    expect(html).toContain('whitespace-nowrap');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, ui);
      });
      expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'singleline');
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});

describe('MessageBar reflow without ResizeObserver', () => {
  it('stops following window resizes on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ReflowBar />);
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('renders one row, measures after each render of the bar and follows window resizes', () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined');
    const { rerender } = render(<ReflowBar />);
    const bar = screen.getByRole('status');
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    // A render of the bar measures before paint. The same text keeps the DOM unchanged, so no
    // MutationObserver record reaches the store after this synchronous act().
    setWidths(bar, { root: 400, text: 200, content: 350 });
    rerender(<ReflowBar />);
    expect(bar).toHaveAttribute('data-layout', 'multiline');

    setWidths(bar, { root: 600, text: 400, content: 350 });
    fireEvent(window, new Event('resize'));
    expect(bar).toHaveAttribute('data-layout', 'singleline');

    setWidths(bar, { root: 400, text: 200, content: 350 });
    fireEvent(window, new Event('resize'));
    expect(bar).toHaveAttribute('data-layout', 'multiline');
  });
});
