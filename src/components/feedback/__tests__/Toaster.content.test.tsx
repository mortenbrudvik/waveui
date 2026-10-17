import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from '../../button/Link';
import { Toast, Toaster } from '../Toast';
import type { ToastController, ToastOptions } from '../Toast';
import { expectNoA11yViolations, findDanglingIdRefs } from '../../../test-utils';
import {
  ControllerProbe,
  advance,
  getLiveRegion,
  getToasts,
  renderToaster,
} from './toasterHarness';

/** A Toast inside the app's own component (the static scan of the dispatched element cannot see it). */
function SavedToast() {
  return (
    <Toast status="success">
      <Toast.Title>Saved</Toast.Title>
      <Toast.Body>Your changes were saved.</Toast.Body>
    </Toast>
  );
}

describe('dispatchToast with content (P3-01, toast-1)', () => {
  it.each([
    ['an element', <span key="e">Saved as an element</span>, 'Saved as an element'],
    ['a string', 'Saved as text', 'Saved as text'],
    ['a number', 42, '42'],
    ['an array', ['Saved ', 'twice'], 'Saved twice'],
    ['a Fragment', <>Saved in a Fragment</>, 'Saved in a Fragment'],
  ])('renders %s as content', (_, content, text) => {
    const { dispatchContent } = renderToaster();
    dispatchContent(content, { timeout: 0 });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveTextContent(text);
  });

  it('renders null as an (empty) toast of content, not as options', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(null, { timeout: 0 });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveAccessibleName('Info:');
  });

  it('renders a portal as content', () => {
    const target = document.createElement('div');
    document.body.append(target);
    try {
      const { dispatchContent, unmount } = renderToaster();
      dispatchContent(createPortal(<span>In a portal</span>, target), { timeout: 0 });
      expect(getToasts()).toHaveLength(1);
      expect(target).toHaveTextContent('In a portal');
      unmount();
    } finally {
      target.remove();
    }
  });

  it('returns the given toastId, else a generated id', () => {
    const { dispatchContent } = renderToaster();
    expect(dispatchContent(<span>One</span>, { toastId: 'upload', timeout: 0 })).toBe('upload');
    const generated = dispatchContent(<span>Two</span>, { timeout: 0 });
    expect(generated).not.toBe('');
    expect(generated).not.toBe('upload');
  });

  it('names content without a Toast by a visually hidden severity text from the options, first in the container', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Warning:');
    expect(container.firstElementChild).toHaveClass('sr-only');
    expect(container.firstElementChild).toHaveTextContent('Warning:');
    expect(container).toHaveTextContent(/^Warning:\s*Connection lost$/);
    // No Toast inside, so no Dismiss button (D11).
    expect(within(container).queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('registers a Toast inside the app’s own component: name, description, Dismiss button, its own severity', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />, { timeout: 0 });
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Success: Saved');
    expect(container).toHaveAccessibleDescription('Your changes were saved.');
    expect(within(container).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    // The Toast's severity text only: the container renders none of its own.
    expect(within(container).getAllByText('Success:')).toHaveLength(1);
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('describes the container by a consumer id on Toast.Body', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Saved</Toast.Title>
        <Toast.Body id="save-details">Saved to Documents.</Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getToasts()[0]).toHaveAttribute('aria-describedby', 'save-details');
  });

  it('re-labels the container when a toast is replaced with another part set, with no dangling id', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    const [container] = getToasts();
    expect(container).toHaveAccessibleName('Error: Upload failed');
    expect(container).toHaveAccessibleDescription('The file is too large.');

    dispatchContent(
      <Toast status="error">
        <Toast.Body>Retrying…</Toast.Body>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAccessibleName('Error:');
    expect(container).toHaveAccessibleDescription('Retrying…');
    expect(findDanglingIdRefs()).toEqual([]);

    dispatchContent(
      <Toast status="error" statusLabel="">
        <Toast.Title>Offline</Toast.Title>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    expect(container).toHaveAccessibleName('Offline');
    expect(container).not.toHaveAttribute('aria-describedby');
    expect(findDanglingIdRefs()).toEqual([]);

    // From a Toast to plain content (no Toast at all): `toast` becomes `null`, so the container's
    // own severity text (from the dispatch options) takes over as the label.
    dispatchContent(<p>Offline. Retrying when the connection returns.</p>, {
      toastId: 'upload',
      status: 'warning',
      timeout: 0,
    });
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAccessibleName('Warning:');
    expect(container).not.toHaveAttribute('aria-describedby');
    expect(findDanglingIdRefs()).toEqual([]);

    // And back to a Toast: the container's own severity text is gone, the Toast's takes over again.
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { toastId: 'upload', timeout: 0 },
    );
    expect(getToasts()).toEqual([container]);
    expect(container).toHaveAccessibleName('Error: Upload failed');
    expect(container).toHaveAccessibleDescription('The file is too large.');
    expect(findDanglingIdRefs()).toEqual([]);
  });

  it('keeps one toast when the same toastId is dispatched twice in one tick; the second wins', () => {
    const { controller } = renderToaster();
    act(() => {
      controller().dispatchToast(<p>First version</p>, { toastId: 'sync', timeout: 0 });
      controller().dispatchToast(<p>Second version</p>, { toastId: 'sync', timeout: 0 });
    });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toHaveTextContent('Second version');
    expect(screen.queryByText('First version')).not.toBeInTheDocument();
  });

  it('adds one toast per dispatch under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast(<SavedToast />, { timeout: 0 });
    });
    expect(getToasts()).toHaveLength(1);
  });

  describe('Toast.Close and the Dismiss button in the Toaster', () => {
    it('Toast.Close calls the Toast’s onDismiss first, then dismisses the toast', async () => {
      const user = userEvent.setup();
      const calls: number[] = [];
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast onDismiss={() => calls.push(getToasts().length)}>
          <Toast.Title
            action={
              <Toast.Close>
                <button type="button">Got it</button>
              </Toast.Close>
            }
          >
            Saved
          </Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
      await user.click(screen.getByRole('button', { name: 'Got it' }));
      // onDismiss ran while the toast was still shown; then the toast left.
      expect(calls).toEqual([1]);
      expect(getToasts()).toHaveLength(0);
    });

    it('Toast.Close dismisses dispatched content without a Toast', async () => {
      const user = userEvent.setup();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <p>
          Session expires soon.{' '}
          <Toast.Close>
            <button type="button">Stay signed in</button>
          </Toast.Close>
        </p>,
        { status: 'warning' },
      );
      await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
      expect(getToasts()).toHaveLength(0);
    });

    it('the Dismiss button of a dispatched Toast runs its onDismiss, then dismisses', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast onDismiss={onDismiss}>
          <Toast.Title>Saved</Toast.Title>
        </Toast>,
        { timeout: 0 },
      );
      await user.click(within(getToasts()[0]).getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(getToasts()).toHaveLength(0);
    });

    it('preventDefault() in the child’s onClick keeps the toast', async () => {
      const user = userEvent.setup();
      const { dispatchContent } = renderToaster();
      dispatchContent(
        <Toast>
          <Toast.Footer>
            <Toast.Close>
              <button type="button" onClick={(event) => event.preventDefault()}>
                Keep
              </button>
            </Toast.Close>
          </Toast.Footer>
        </Toast>,
        { timeout: 3000 },
      );
      await user.click(screen.getByRole('button', { name: 'Keep' }));
      expect(getToasts()).toHaveLength(1);
    });
  });

  describe('replacing by toastId', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('replaces the content and restarts the timer', () => {
      const { dispatchContent } = renderToaster();
      dispatchContent(<p>Uploading…</p>, { toastId: 'upload' });
      advance(3000);
      dispatchContent(<p>Upload complete</p>, { toastId: 'upload' });
      expect(screen.queryByText('Uploading…')).not.toBeInTheDocument();
      advance(4999);
      expect(screen.getByText('Upload complete')).toBeInTheDocument();
      advance(1);
      expect(getToasts()).toHaveLength(0);
    });

    it('keeps one timer for two same-tick dispatches: a leftover from the first would remove the toast early', () => {
      const { controller, dispatchContent } = renderToaster();
      // Two dispatches in one tick (as the "second wins" test): only one entry ever commits, so
      // only one timer ever starts. If a leftover timer from the first of the pair survived, it
      // would fire at t=5000 (5s after this act), well before the assertions below.
      act(() => {
        controller().dispatchToast(<p>Uploading…</p>, { toastId: 'upload' });
        controller().dispatchToast(<p>Uploading, 50%</p>, { toastId: 'upload' });
      });
      advance(3000);
      // A third dispatch at t=3000 restarts the (one) timer for another 5000ms, due at t=8000.
      dispatchContent(<p>Upload complete</p>, { toastId: 'upload' });
      advance(4999);
      expect(screen.getByText('Upload complete')).toBeInTheDocument();
      advance(1);
      expect(getToasts()).toHaveLength(0);
    });
  });

  it('has no accessibility violations for rich layouts and custom content (open)', async () => {
    const { dispatchContent } = renderToaster({}, { app: <p>App content</p> });
    dispatchContent(
      <Toast status="success">
        <Toast.Title
          action={
            <Toast.Close>
              <button type="button">Undo</button>
            </Toast.Close>
          }
        >
          Email sent
        </Toast.Title>
        <Toast.Body subtitle="Just now">Your message was delivered.</Toast.Body>
        <Toast.Footer>
          <button type="button">View</button>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    dispatchContent(<p>Connection lost</p>, { status: 'warning', timeout: 0 });
    await expectNoA11yViolations(document.body);
  });

  it('types both dispatch forms; derived parameters stay 0.7’s', () => {
    const typeOnly = (controller: ToastController) => {
      const withToast: string = controller.dispatchToast(<Toast />);
      const withOptions: string = controller.dispatchToast({ title: 'Saved' });
      const withContent: string = controller.dispatchToast(<span />, { timeout: 0 });
      // @ts-expect-error `title` is a string
      controller.dispatchToast({ title: 1 });
      // @ts-expect-error unknown option
      controller.dispatchToast({ title: 'Saved', tone: 'loud' });
      return [withToast, withOptions, withContent];
    };
    expect(typeof typeOnly).toBe('function');
    expectTypeOf<Parameters<ToastController['dispatchToast']>>().toEqualTypeOf<
      [options: ToastOptions]
    >();
  });
});

describe('the timeout of a toast with an action (P3-01, D12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const undoToast = (onUndo: () => void = () => {}) => (
    <Toast>
      <Toast.Title
        action={
          <button type="button" onClick={onUndo}>
            Undo
          </button>
        }
      >
        Message deleted
      </Toast.Title>
    </Toast>
  );

  it('keeps a toast with an action and no timeout until it is dismissed', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast());
    advance(60_000);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
  });

  it('honours an explicit timeout on a toast with an action', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast(), { timeout: 3000 });
    advance(2999);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('dismisses a toast without an action after 5000 ms (its Dismiss button is no action)', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />);
    advance(4999);
    expect(getToasts()).toHaveLength(1);
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });

  it.each([
    [
      'an empty title action',
      <Toast key="t">
        <Toast.Title action={false}>Saved</Toast.Title>
      </Toast>,
    ],
    [
      'an empty footer',
      <Toast key="f">
        <Toast.Title>Saved</Toast.Title>
        <Toast.Footer>{false}</Toast.Footer>
      </Toast>,
    ],
  ])('keeps the 5 s timeout for %s: no action', (_, content) => {
    const { dispatchContent } = renderToaster();
    dispatchContent(content);
    advance(5000);
    expect(getToasts()).toHaveLength(0);
  });

  it('runs an Undo handler and pauses the timers while it has focus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onUndo = vi.fn();
    const { dispatchContent } = renderToaster();
    dispatchContent(undoToast(onUndo), { timeout: 3000 });
    advance(1000);
    const undo = screen.getByRole('button', { name: 'Undo' });
    act(() => undo.focus());
    advance(10_000);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    // The toast's timer is paused (cleared) while `undo` has focus, so switching the fake clock to
    // auto-advance for this one awaited interaction cannot move its deadline: dispatching a real
    // keydown/keypress/click/keyup sequence goes through the shared testing-library `act()`
    // wrapper, which needs real elapsed time to settle once an actual event was dispatched (a bare
    // `await act(async () => {})` resolves at once; `userEvent.setup({ delay: null })` — which
    // skips only user-event's own inter-key wait — does not help, with or without `advanceTimers`),
    // and otherwise never resolves under a clock that only moves on an explicit
    // `advanceTimersByTime` call (reproduced with no Toast code and no rendered React tree at all).
    // Switching back before `blur()` keeps the resumed countdown's boundary exact.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await user.keyboard('{Enter}');
    vi.useFakeTimers();
    expect(onUndo).toHaveBeenCalledTimes(1);
    act(() => undo.blur());
    advance(1999);
    expect(screen.getByText('Message deleted')).toBeInTheDocument();
    advance(1);
    expect(getToasts()).toHaveLength(0);
  });
});

describe('severity (P3-01, D12)', () => {
  it('announces a dispatched error Toast assertively, with its own severity text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Error:/);
    expect(getLiveRegion('polite')).toBeEmptyDOMElement();
  });

  it('announces a dispatched success Toast politely', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<SavedToast />, { timeout: 0 });
    expect(getLiveRegion('polite')).toHaveTextContent(/^Success:/);
    expect(getLiveRegion('assertive')).toBeEmptyDOMElement();
  });

  it('uses the options’ status and statusLabel for content without a Toast', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>Connection lost</p>, {
      status: 'error',
      statusLabel: 'Fehler:',
      timeout: 0,
    });
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Fehler:/);
    expect(getToasts()[0]).toHaveAccessibleName('Fehler:');
  });

  it('uses the rendered Toast’s status over an explicit option, with one development warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { status: 'info', timeout: 0 },
    );
    expect(getLiveRegion('assertive')).toHaveTextContent(/^Error:/);
    expect(getToasts()[0]).toHaveAccessibleName('Error: Upload failed');
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] Toaster: the dispatched Toast has status "error" but the dispatch options pass "info"; the Toast\'s status is used. Remove `status` from the options.',
      ],
    ]);
    warn.mockRestore();
  });

  it('does not warn when the options pass no status, or the Toast’s own', () => {
    const warn = vi.spyOn(console, 'warn');
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    dispatchContent(
      <Toast status="warning">
        <Toast.Title>Disk almost full</Toast.Title>
      </Toast>,
      { status: 'warning', timeout: 0 },
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn across a same-toastId replacement (Toast to content, Toast to Toast)', () => {
    const warn = vi.spyOn(console, 'warn');
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { toastId: 'content', timeout: 0 },
    );
    dispatchContent(<p>Offline. Retrying when the connection returns.</p>, {
      toastId: 'content',
      status: 'warning',
      timeout: 0,
    });
    dispatchContent(
      <Toast status="error">
        <Toast.Title>Upload failed</Toast.Title>
      </Toast>,
      { toastId: 'toast', timeout: 0 },
    );
    dispatchContent(
      <Toast status="warning">
        <Toast.Title>Disk almost full</Toast.Title>
      </Toast>,
      { toastId: 'toast', status: 'warning', timeout: 0 },
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps the 0.7 announcement of the options form', () => {
    const { dispatch } = renderToaster();
    dispatch({ status: 'error', title: 'Upload failed', body: 'Try again.', timeout: 0 });
    expect(getLiveRegion('assertive').textContent).toBe('Error: Upload failed Try again.');
  });
});

describe('announcements (P3-01, D13)', () => {
  it('announces a rich toast once: severity, title, body, action labels, never "Dismiss"', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="error">
        <Toast.Title action={<button type="button">Retry</button>}>Upload failed</Toast.Title>
        <Toast.Body>The file is too large.</Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    const assertive = getLiveRegion('assertive');
    expect(assertive.textContent).toBe('Error: Upload failed The file is too large. Retry');
    expect(assertive.childElementCount).toBe(1);
    // No provider or announcer is mounted: the Toaster's own live regions announce.
    expect(document.querySelector('[data-wave-announcer]')).toBeNull();
  });

  it('reads the subtitle with the body and the footer’s labels after it', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast status="success">
        <Toast.Title>Email sent</Toast.Title>
        <Toast.Body subtitle="Just now">Your message was delivered.</Toast.Body>
        <Toast.Footer>
          <button type="button">Undo</button>
          <button type="button" aria-label="Open the sent folder">
            <svg aria-hidden="true" />
          </button>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe(
      'Success: Email sent Your message was delivered. Just now Undo Open the sent folder',
    );
  });

  it('skips aria-hidden text and reads an image’s alt', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Body>
          Sent to <img src="data:," alt="Ada Lovelace" />
          <span aria-hidden="true"> ✓</span>
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Sent to Ada Lovelace');
  });

  it('reads a Toast without title or body whole, minus the Toast’s own severity text and its Dismiss button', () => {
    // The whole-container walk must skip the Toast's `statusTextId` span (the severity is added
    // once, from the registration) and the Dismiss button (an `aria-label` the walk would read),
    // and the container's own severity span that is still rendered on the registering commit.
    const { dispatchContent } = renderToaster();
    dispatchContent(<Toast status="error" />, { timeout: 0 });
    const assertive = getLiveRegion('assertive');
    expect(assertive.textContent).toBe('Error:');
    expect(assertive.childElementCount).toBe(1);
  });

  it('reads each action of a footer as its own word, links included', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Shared</Toast.Title>
        <Toast.Footer>
          <Link href="#open">Open</Link>
          <Link href="#share">Share</Link>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Shared Open Share');
  });

  it('reads each action of the title’s action slot as its own word', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title
          action={
            <>
              <span role="button" tabIndex={0}>
                Undo
              </span>
              <span role="button" tabIndex={0}>
                Redo
              </span>
            </>
          }
        >
          Edited
        </Toast.Title>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Edited Undo Redo');
  });

  it('skips a subtree with the hidden attribute', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Body>
          Visible<span hidden> secret</span>
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Visible');
  });

  it('reads the aria-label of a control by role, and walks into a labelled container', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Files</Toast.Title>
        <Toast.Footer>
          <span role="button" tabIndex={0} aria-label="Open folder">
            icon
          </span>
          <div role="toolbar" aria-label="Toast actions">
            <button type="button">Undo</button>
            <button type="button">Redo</button>
          </div>
        </Toast.Footer>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Files Open folder Undo Redo');
  });

  it('skips style and template subtrees and does not split a word at a wbr', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Body>
          Super
          <wbr />
          cali
          <style>{'.x { color: red; }'}</style>
          <template>Hidden template</template>
        </Toast.Body>
      </Toast>,
      { timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Info: Supercali');
  });

  it('announces a Toast that renders one commit after the dispatch, once, with its own severity', async () => {
    function LateToast() {
      const [ready, setReady] = React.useState(false);
      React.useEffect(() => {
        queueMicrotask(() => setReady(true));
      }, []);
      return ready ? (
        <Toast status="error">
          <Toast.Title>Upload failed</Toast.Title>
        </Toast>
      ) : null;
    }
    const { dispatchContent } = renderToaster();
    dispatchContent(<LateToast />, { timeout: 0 });
    await act(async () => {});
    const assertive = getLiveRegion('assertive');
    expect(assertive.textContent).toBe('Error: Upload failed');
    expect(assertive.childElementCount).toBe(1);
    expect(getLiveRegion('polite')).toBeEmptyDOMElement();
  });

  it('reads content without a Toast whole, after the options’ severity text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <div>
        <strong>3 files</strong> uploaded <button type="button">View</button>
      </div>,
      { status: 'success', timeout: 0 },
    );
    expect(getLiveRegion('polite').textContent).toBe('Success: 3 files uploaded View');
  });

  it('announces `announcement` instead of the text; statusLabel "" drops the severity', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(
      <Toast>
        <Toast.Title>Uploading report.pdf</Toast.Title>
        <Toast.Body>
          <progress aria-label="Upload progress" value={30} max={100} />
        </Toast.Body>
      </Toast>,
      { announcement: 'Upload started', timeout: 0 },
    );
    dispatchContent(<p>Quiet</p>, { statusLabel: '', announcement: 'Hello', timeout: 0 });
    const texts = Array.from(getLiveRegion('polite').children, (child) => child.textContent);
    expect(texts).toEqual(['Info: Upload started', 'Hello']);
  });

  it('announces a toast replaced by its toastId again, with the new text', () => {
    const { dispatchContent } = renderToaster();
    dispatchContent(<p>One</p>, { toastId: 'sync', timeout: 0 });
    dispatchContent(<p>Two</p>, { toastId: 'sync', timeout: 0 });
    const polite = getLiveRegion('polite');
    expect(polite.textContent).toBe('Info: Two');
    expect(polite.childElementCount).toBe(1);
  });

  it('announces the second of two same-id dispatches in one tick, once', () => {
    const { controller } = renderToaster();
    const polite = getLiveRegion('polite');
    // The region keeps one message per toast id, so an earlier announcement could appear and be
    // replaced unseen: record what is added.
    const observer = new MutationObserver(() => {});
    observer.observe(polite, { childList: true, subtree: true, characterData: true });
    act(() => {
      controller().dispatchToast(<p>First version</p>, { toastId: 'sync', timeout: 0 });
      controller().dispatchToast(<p>Second version</p>, { toastId: 'sync', timeout: 0 });
    });
    const added = observer
      .takeRecords()
      .flatMap((record) => Array.from(record.addedNodes, (node) => node.textContent));
    observer.disconnect();
    expect(added).toEqual(['Info: Second version']);
    expect(polite.textContent).toBe('Info: Second version');
    expect(polite.childElementCount).toBe(1);
  });

  it('announces once per dispatch under StrictMode', () => {
    const controllerRef = React.createRef<ToastController>();
    render(
      <React.StrictMode>
        <Toaster>
          <ControllerProbe ref={controllerRef} />
        </Toaster>
      </React.StrictMode>,
    );
    act(() => {
      controllerRef.current?.dispatchToast(<SavedToast />, { timeout: 0 });
    });
    const polite = getLiveRegion('polite');
    expect(polite.childElementCount).toBe(1);
    expect(polite.textContent).toBe('Success: Saved Your changes were saved.');
  });
});
