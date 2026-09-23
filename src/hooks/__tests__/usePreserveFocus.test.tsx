import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import * as React from 'react';
import { usePreserveFocus } from '../usePreserveFocus';

/** Runs the microtask in which the unmount move happens. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * The fallback of these tests. `queryByRole`, not `getByRole`: the hook may call it after the whole
 * tree is gone (RTL's cleanup unmounting a test that ends with focus inside the toast), and a
 * fallback must return nothing then instead of throwing (see the hook's JSDoc).
 */
function queryFallback() {
  return screen.queryByRole('button', { name: 'Fallback' });
}

function Toast({
  getFallback,
  enabled,
  autoFocus,
}: {
  getFallback: () => HTMLElement | null | undefined;
  enabled?: boolean;
  autoFocus?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  usePreserveFocus(ref, getFallback, enabled === undefined ? undefined : { enabled });
  return (
    <div ref={ref} data-testid="toast">
      <button type="button" autoFocus={autoFocus}>
        Dismiss
      </button>
    </div>
  );
}

function App({
  show = true,
  enabled,
  autoFocus,
  restoreAfterUnmount,
  getFallback,
}: {
  show?: boolean;
  enabled?: boolean;
  autoFocus?: boolean;
  /** Renders an autoFocus button in place of the toast (another owner restores focus). */
  restoreAfterUnmount?: boolean;
  getFallback?: () => HTMLElement | null | undefined;
}) {
  return (
    <div>
      <button type="button">Fallback</button>
      <button type="button">Other</button>
      {show && (
        <Toast enabled={enabled} autoFocus={autoFocus} getFallback={getFallback ?? queryFallback} />
      )}
      {!show && restoreAfterUnmount && (
        // autoFocus stands in for another owner that restores focus in the same commit.
        <button type="button" autoFocus>
          Restored
        </button>
      )}
    </div>
  );
}

describe('usePreserveFocus', () => {
  it('moves focus to the fallback when the element unmounts while containing focus', async () => {
    const { rerender } = render(<App />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    rerender(<App show={false} />);
    await flushMicrotasks();
    expect(screen.getByRole('button', { name: 'Fallback' })).toHaveFocus();
  });

  it('leaves focus alone when the element did not contain focus', async () => {
    const { rerender } = render(<App />);
    const other = screen.getByRole('button', { name: 'Other' });
    other.focus();
    rerender(<App show={false} />);
    await flushMicrotasks();
    expect(other).toHaveFocus();
  });

  it('moves focus to the fallback when enabled flips false while containing focus', () => {
    const { rerender } = render(<App enabled />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    rerender(<App enabled={false} />);
    expect(screen.getByRole('button', { name: 'Fallback' })).toHaveFocus();
  });

  it('does nothing while disabled', async () => {
    const { rerender } = render(<App enabled={false} />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    rerender(<App show={false} enabled={false} />);
    await flushMicrotasks();
    expect(screen.getByRole('button', { name: 'Fallback' })).not.toHaveFocus();
  });

  it('tolerates a fallback that returns nothing', async () => {
    const getFallback = vi.fn(() => null);
    const { rerender } = render(<App getFallback={getFallback} />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    expect(() => rerender(<App show={false} getFallback={getFallback} />)).not.toThrow();
    await flushMicrotasks();
    expect(getFallback).toHaveBeenCalledTimes(1);
  });

  it('tolerates the whole tree being removed while the element contains focus', async () => {
    const getFallback = vi.fn(queryFallback);
    const { unmount } = render(<App getFallback={getFallback} />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    unmount();
    await flushMicrotasks();
    // Called after everything is gone: the fallback no longer exists, so nothing is focused.
    expect(getFallback).toHaveBeenCalledTimes(1);
    expect(getFallback).toHaveReturnedWith(null);
    expect(document.body).toHaveFocus();
  });

  it('calls the latest getFallback', async () => {
    const first = vi.fn(queryFallback);
    const second = vi.fn(() => screen.queryByRole('button', { name: 'Other' }));
    const { rerender } = render(<App getFallback={first} />);
    rerender(<App getFallback={second} />);
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    rerender(<App show={false} getFallback={second} />);
    await flushMicrotasks();
    expect(first).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Other' })).toHaveFocus();
  });

  describe('StrictMode and other focus owners (feedback-navigation#12)', () => {
    it("keeps focus inside when StrictMode's simulated unmount runs right after an autoFocus mount", async () => {
      const getFallback = vi.fn(queryFallback);
      const { unmount } = render(
        <React.StrictMode>
          <App autoFocus getFallback={getFallback} />
        </React.StrictMode>,
      );
      await flushMicrotasks();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveFocus();
      expect(getFallback).not.toHaveBeenCalled();

      // End cleanly: the test finishes with focus inside, so unmount and run the move here instead
      // of leaving it to RTL's cleanup.
      unmount();
      await flushMicrotasks();
      expect(getFallback).toHaveBeenCalledTimes(1);
    });

    it('still moves focus on a real unmount under StrictMode', async () => {
      const { rerender } = render(
        <React.StrictMode>
          <App autoFocus />
        </React.StrictMode>,
      );
      await flushMicrotasks();
      rerender(
        <React.StrictMode>
          <App show={false} />
        </React.StrictMode>,
      );
      await flushMicrotasks();
      expect(screen.getByRole('button', { name: 'Fallback' })).toHaveFocus();
    });

    it('does not steal focus that another owner placed in the same commit', async () => {
      const { rerender } = render(<App />);
      screen.getByRole('button', { name: 'Dismiss' }).focus();
      rerender(<App show={false} restoreAfterUnmount />);
      await flushMicrotasks();
      expect(screen.getByRole('button', { name: 'Restored' })).toHaveFocus();
    });
  });
});
