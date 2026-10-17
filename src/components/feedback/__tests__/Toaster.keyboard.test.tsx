import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from '../Toast';
import type { ToastController } from '../Toast';
import { mockAnimations } from '../../../test-utils';
import { ControllerProbe, advance, getToasts, renderToaster } from './toasterHarness';

/** The stories' shortcut: Alt+Shift+N (with modifiers, WCAG 2.1.4). */
const altShiftN = (event: KeyboardEvent) => event.altKey && event.shiftKey && event.code === 'KeyN';

const pressAltShiftN = (target: Element = document.body) =>
  fireEvent.keyDown(target, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });

/** Records whether each Alt+Shift+N key press reached the document prevented. */
function recordPrevented(): boolean[] {
  const prevented: boolean[] = [];
  const record = (event: KeyboardEvent) => {
    if (event.code === 'KeyN') prevented.push(event.defaultPrevented);
  };
  document.addEventListener('keydown', record);
  onTestFinished(() => document.removeEventListener('keydown', record));
  return prevented;
}

describe('the focus shortcut (P3-03, toaster-2)', () => {
  it('focuses the newest toast’s container, prevents the key and remembers the origin', async () => {
    const user = userEvent.setup();
    const { dispatch, dismissAll } = renderToaster(
      { shortcuts: { focus: altShiftN } },
      { app: <input aria-label="Name" /> },
    );
    const prevented = recordPrevented();
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    await user.click(input);
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    expect(getToasts()[1]).toHaveFocus();
    expect(prevented).toEqual([true]);
    // The origin: focus returns there once the toasts go.
    dismissAll();
    expect(input).toHaveFocus();
  });

  it('focuses the most recently dispatched toast, a replaced one included', () => {
    const { dispatch } = renderToaster({ shortcuts: { focus: altShiftN } });
    dispatch({ toastId: 'sync', title: 'Syncing…', timeout: 0 });
    dispatch({ title: 'Other', timeout: 0 });
    dispatch({ toastId: 'sync', title: 'Synced', timeout: 0 });
    pressAltShiftN();
    expect(getToasts()[0]).toHaveFocus();
  });

  it('does nothing without a toast, or when the predicate returns false', () => {
    const focus = vi.fn(altShiftN);
    const { dispatch } = renderToaster({ shortcuts: { focus } });
    const prevented = recordPrevented();
    pressAltShiftN();
    dispatch({ title: 'Saved', timeout: 0 });
    fireEvent.keyDown(document.body, { key: 'M', code: 'KeyM', altKey: true, shiftKey: true });
    expect(focus).toHaveBeenCalledTimes(2);
    expect(prevented).toEqual([false]);
    expect(getToasts()[0]).not.toHaveFocus();
  });

  it('ignores a key press that is already prevented, and one while composing', () => {
    const focus = vi.fn(altShiftN);
    const { dispatch } = renderToaster({ shortcuts: { focus } });
    dispatch({ title: 'Saved', timeout: 0 });
    const prevent = (event: KeyboardEvent) => event.preventDefault();
    window.addEventListener('keydown', prevent, true);
    pressAltShiftN();
    window.removeEventListener('keydown', prevent, true);
    fireEvent.keyDown(document.body, {
      key: 'N',
      code: 'KeyN',
      altKey: true,
      shiftKey: true,
      isComposing: true,
    });
    expect(focus).not.toHaveBeenCalled();
    expect(getToasts()[0]).not.toHaveFocus();
  });

  it('skips an exiting toast, and does nothing while every toast is dismissed', async () => {
    const motion = mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') });
    const { dispatch, dismiss, dismissAll } = renderToaster({ shortcuts: { focus: altShiftN } });
    const prevented = recordPrevented();
    dispatch({ title: 'First', timeout: 0 });
    const second = dispatch({ title: 'Second', timeout: 0 });
    await act(async () => {
      await motion.finishAll();
    });
    const [first] = getToasts();
    dismiss(second);
    pressAltShiftN();
    expect(first).toHaveFocus();

    dismissAll();
    pressAltShiftN();
    expect(prevented).toEqual([true, false]);
    await act(async () => {
      await motion.finishAll();
    });
    expect(getToasts()).toHaveLength(0);
  });

  it('adds one listener under StrictMode and removes it on unmount', () => {
    const focus = vi.fn(altShiftN);
    const controllerRef = React.createRef<ToastController>();
    const { unmount } = render(
      <React.StrictMode>
        <Toaster shortcuts={{ focus }}>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast({ title: 'Saved', timeout: 0 });
    });
    pressAltShiftN();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(getToasts()[0]).toHaveFocus();
    unmount();
    pressAltShiftN();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  describe('timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('pauses the timers while the shortcut has put focus in a toast', () => {
      const { dispatch } = renderToaster({ shortcuts: { focus: altShiftN } });
      dispatch({ title: 'Saved' });
      pressAltShiftN();
      advance(10_000);
      expect(getToasts()).toHaveLength(1);
    });
  });
});
