import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { createPortal } from 'react-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster } from '../Toast';
import type { ToastController } from '../Toast';
import { mockAnimations } from '../../../test-utils';
import { useDismiss } from '../../../hooks/useDismiss';
import { useModalLayer } from '../../../hooks/useModalLayer';
import { Portal } from '../../portal/Portal';
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

/** A portaled element rendered from a toast (a stand-in for a Menu or Dialog opened from it). */
function PortaledAction() {
  return createPortal(<button type="button">Portaled action</button>, document.body);
}

/** An open, Escape-enabled dismiss layer anchored on a toast's button (a Tooltip stand-in). */
function AnchoredLayer({ onDismiss }: { onDismiss: () => void }) {
  const [open, setOpen] = React.useState(true);
  const anchorRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const { layerId } = useDismiss({
    open,
    onDismiss: () => {
      onDismiss();
      setOpen(false);
    },
    refs: [surfaceRef, anchorRef],
    anchorRef,
    kind: 'tooltip',
  });
  return (
    <>
      <button ref={anchorRef} type="button">
        Details
      </button>
      {open ? (
        <Portal layerId={layerId}>
          <div ref={surfaceRef}>More about the upload</div>
        </Portal>
      ) : null}
    </>
  );
}

/** An open modal below the toasts (the useModalLayer harness of the Dialog and Menu tests). */
function StandInModal({ onDismiss }: { onDismiss: () => void }) {
  const [node, setNode] = React.useState<HTMLDivElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback((el: HTMLDivElement | null) => {
    surfaceRef.current = el;
    setNode(el);
  }, []);
  const { layerId } = useModalLayer({ open: true, onDismiss, refs: [surfaceRef], container: node });
  return (
    <Portal layerId={layerId}>
      <div ref={attach} role="dialog" aria-label="Settings" tabIndex={-1}>
        <button type="button">Inside</button>
      </div>
    </Portal>
  );
}

const viewToast = (
  <Toast>
    <Toast.Title action={<button type="button">View</button>}>Saved</Toast.Title>
  </Toast>
);

describe('Escape (P3-03, D14)', () => {
  it('dismisses every toast and returns focus to the origin (entered by Tab)', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(viewToast, { timeout: 0 });
    dispatchContent(<p>Second</p>, { timeout: 0 });
    await user.click(input);
    await user.tab();
    expect(screen.getByRole('button', { name: 'View' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('returns focus to the origin when focus entered by a click', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(viewToast, { timeout: 0 });
    await user.click(input);
    await user.click(screen.getByRole('button', { name: 'View' }));
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('returns focus to the origin when focus entered by the shortcut', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster(
      { shortcuts: { focus: altShiftN } },
      { app: <input aria-label="Name" /> },
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatch({ title: 'Saved', timeout: 0 });
    await user.click(input);
    await user.keyboard('{Alt>}{Shift>}N{/Shift}{/Alt}');
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });

  it('leaves focus on the page body without an origin', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(viewToast, { timeout: 0 });
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(document.body).toHaveFocus();
  });

  it('does nothing when the consumer’s onKeyDown prevents it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster({ onKeyDown: (event) => event.preventDefault() });
    dispatchContent(viewToast, { timeout: 0 });
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(1);
  });

  it('leaves an Escape pressed in a portal rendered from a toast alone', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Draft</Toast.Title>
        <Toast.Body>
          <PortaledAction />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Portaled action' }).focus());
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(1);
  });

  it('lets an open layer anchored in a toast take the first Escape; the next dismisses the toasts', async () => {
    const user = userEvent.setup();
    const onLayerDismiss = vi.fn();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title action={<AnchoredLayer onDismiss={onLayerDismiss} />}>Upload done</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Details' }).focus());
    await user.keyboard('{Escape}');
    expect(onLayerDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('More about the upload')).not.toBeInTheDocument();
    expect(getToasts()).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
  });

  it('leaves a modal below open (the key is prevented) and returns focus into it', async () => {
    const user = userEvent.setup();
    const onModalDismiss = vi.fn();
    const { dispatch } = renderToaster({}, { app: <StandInModal onDismiss={onModalDismiss} /> });
    dispatch({ title: 'Saved', timeout: 0 });
    const inside = screen.getByRole('button', { name: 'Inside' });
    act(() => inside.focus());
    await user.tab();
    expect(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(getToasts()).toHaveLength(0);
    expect(onModalDismiss).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(inside).toHaveFocus();
  });
});

describe('Delete and Backspace (P3-03, D14)', () => {
  it('dismiss the focused toast and move focus to the next container', async () => {
    const user = userEvent.setup();
    const { dispatch } = renderToaster();
    dispatch({ title: 'First', timeout: 0 });
    dispatch({ title: 'Second', timeout: 0 });
    dispatch({ title: 'Third', timeout: 0 });
    const [first, second, third] = getToasts();
    act(() => first.focus());
    await user.keyboard('{Delete}');
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(second).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(third).toHaveFocus();
  });

  it('dismiss from a button inside the toast; focus goes to the next toast’s first control', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(viewToast, { timeout: 0 });
    dispatchContent(
      <Toast>
        <Toast.Title>Second</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'View' }).focus());
    await user.keyboard('{Delete}');
    expect(getToasts()).toHaveLength(1);
    expect(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' })).toHaveFocus();
  });

  it('edit a field inside a toast instead of dismissing it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Reply</Toast.Title>
        <Toast.Body>
          <input aria-label="Message" defaultValue="Hi!" />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const field = screen.getByRole('textbox', { name: 'Message' });
    await user.type(field, '{Backspace}');
    expect(field).toHaveValue('Hi');
    expect(getToasts()).toHaveLength(1);
  });

  it('keep the toast for a key pressed in a portal rendered from it', async () => {
    const user = userEvent.setup();
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Draft</Toast.Title>
        <Toast.Body>
          <PortaledAction />
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    act(() => screen.getByRole('button', { name: 'Portaled action' }).focus());
    await user.keyboard('{Delete}');
    expect(getToasts()).toHaveLength(1);
  });
});

/** A layer opened from a toast's button, in a portal (a Menu stand-in): focus moves in and back. */
function MenuStandIn() {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const { layerId } = useDismiss({
    open,
    onDismiss: close,
    refs: [surfaceRef, buttonRef],
    anchorRef: buttonRef,
    kind: 'menu',
  });
  React.useLayoutEffect(() => {
    if (open) surfaceRef.current?.querySelector('button')?.focus();
  }, [open]);
  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        More
      </button>
      {open ? (
        <Portal layerId={layerId}>
          <div ref={surfaceRef} role="group" aria-label="More actions">
            <button type="button" onClick={close}>
              Archive
            </button>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

describe('region-wide pausing (P3-03, D14)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses every toast while the pointer is over one, and resumes when it leaves the region', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Hovered' });
    dispatch({ title: 'Other' });
    fireEvent.pointerOver(getToasts()[0]);
    advance(20_000);
    expect(getToasts()).toHaveLength(2);
    fireEvent.pointerOut(getToasts()[0], { relatedTarget: document.body });
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('pauses every toast while focus is in one, and resumes when focus leaves the region', () => {
    const { dispatch } = renderToaster();
    dispatch({ title: 'Focused' });
    dispatch({ title: 'Other' });
    const button = within(getToasts()[0]).getByRole('button', { name: 'Dismiss' });
    act(() => button.focus());
    advance(20_000);
    expect(getToasts()).toHaveLength(2);
    act(() => button.blur());
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps the timers paused and the return target while focus is in a layer opened from a toast', () => {
    // Synchronous events: an awaited user-event call hangs under strict fake timers.
    const { dispatchContent } = renderToaster({}, { app: <input aria-label="Name" /> });
    const input = screen.getByRole('textbox', { name: 'Name' });
    dispatchContent(
      <Toast>
        <Toast.Title action={<MenuStandIn />}>Saved</Toast.Title>
      </Toast>,
      { timeout: 3000 },
    );
    act(() => input.focus());
    act(() => screen.getByRole('button', { name: 'More' }).focus());
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveFocus();
    advance(10_000);
    expect(getToasts()).toHaveLength(1);
    // The layer takes the first Escape and puts focus back on its button.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Archive' }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
    expect(getToasts()).toHaveLength(1);
    // The origin survived the trip through the portal.
    fireEvent.keyDown(screen.getByRole('button', { name: 'More' }), { key: 'Escape' });
    expect(getToasts()).toHaveLength(0);
    expect(input).toHaveFocus();
  });
});
