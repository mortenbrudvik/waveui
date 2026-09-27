import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast, Toaster } from '../Toast';
import type { ToastController, ToastOptions } from '../Toast';
import { expectNoA11yViolations, findDanglingIdRefs } from '../../../test-utils';
import { ControllerProbe, advance, getToasts, renderToaster } from './toasterHarness';

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
