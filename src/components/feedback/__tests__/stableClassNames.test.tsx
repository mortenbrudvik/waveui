import * as React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import {
  messageBarClassNames,
  progressBarClassNames,
  skeletonClassNames,
  skeletonGroupClassNames,
  spinnerClassNames,
  toastClassNames,
  toasterClassNames,
} from '../../../lib/classNames';
import { Button } from '../../button/Button';
import { MessageBar } from '../MessageBar';
import { ProgressBar } from '../ProgressBar';
import { Skeleton } from '../Skeleton';
import { Spinner } from '../Spinner';
import { Toast, Toaster, useToastController } from '../Toast';

afterEach(() => {
  vi.restoreAllMocks();
});

/** A decorative glyph a test can find. */
const Glyph = ({ testId }: { testId: string }) => <svg data-testid={testId} aria-hidden="true" />;

/** The element a glyph sits in: the slot's element. */
const iconBox = (testId: string) => screen.getByTestId(testId).parentElement as HTMLElement;

/** Parses server HTML into a detached element, so its classes can be queried. */
function parseServerHtml(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('stable class names (P3-00): feedback folder', () => {
  it('MessageBar: root, status icon, body, dismiss button and the default dismiss glyph', () => {
    render(
      <MessageBar status="warning" onDismiss={() => {}}>
        Update available
      </MessageBar>,
    );
    const bar = screen.getByRole('alert');
    expect(bar).toHaveClass(messageBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(messageBarClassNames.icon);
    expect(screen.getByText('Update available')).toHaveClass(messageBarClassNames.body);
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss).toHaveClass(messageBarClassNames.dismissButton);
    expect(dismiss.querySelector('[data-wave-icon="dismiss"]')).toHaveClass(
      messageBarClassNames.dismissIcon,
    );
  });

  it('MessageBar: an icon slot, `dismiss` content, a slot object around the default glyph and a merged Button icon', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <>
        <MessageBar icon={<Glyph testId="custom-icon" />}>Saved</MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={<Glyph testId="dismiss-glyph" />}>
          Synced
        </MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={{ className: 'text-error' }}>
          Stored
        </MessageBar>
        <MessageBar onDismiss={() => {}} dismiss={<Button icon={<Glyph testId="merged-icon" />} />}>
          Queued
        </MessageBar>
      </>,
    );
    expect(iconBox('custom-icon')).toHaveClass(messageBarClassNames.icon);
    expect(iconBox('dismiss-glyph')).toHaveClass(messageBarClassNames.dismissIcon);
    const wrapper = document.querySelector('button .text-error');
    expect(wrapper).toHaveClass(messageBarClassNames.dismissIcon);
    expect(wrapper?.querySelector('[data-wave-icon="dismiss"]')).not.toHaveClass(
      messageBarClassNames.dismissIcon,
    );
    expect(iconBox('merged-icon')).toHaveClass(messageBarClassNames.dismissIcon);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] MessageBar: `dismiss` received a button element; its props were merged into the built-in dismiss button (buttons cannot be nested). Pass icon content instead, e.g. `dismiss={<CloseIcon />}`, and use `onDismiss`.',
      ],
    ]);
  });

  it('ProgressBar: root on the progressbar, the fill, and the visible label outside the root', () => {
    render(<ProgressBar value={40} label="Upload" showLabel />);
    const bar = screen.getByRole('progressbar', { name: 'Upload' });
    expect(bar).toHaveClass(progressBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(progressBarClassNames.bar);
    const label = screen.getByText('Upload');
    expect(label).toHaveClass(progressBarClassNames.label);
    expect(bar.contains(label)).toBe(false);
  });

  it('Spinner: root, ring, and the label with and without `labelVisible`', () => {
    render(
      <>
        <Spinner label="Loading files" labelVisible data-testid="visible" />
        <Spinner label="Loading" data-testid="hidden-label" />
      </>,
    );
    const visible = screen.getByTestId('visible');
    expect(visible).toHaveClass(spinnerClassNames.root);
    expect(visible.querySelector('[data-wave-spinner-ring]')).toHaveClass(
      spinnerClassNames.spinner,
    );
    expect(visible.querySelector('[data-wave-spinner-label]')).toHaveClass(spinnerClassNames.label);
    // The same element, visually hidden: it keeps its class (judgement 29).
    expect(
      screen.getByTestId('hidden-label').querySelector('[data-wave-spinner-label]'),
    ).toHaveClass(spinnerClassNames.label, 'sr-only');
  });

  it('Skeleton and Skeleton.Group', () => {
    render(
      <Skeleton.Group label="Loading profile" data-testid="group">
        <Skeleton width={160} height={12} data-testid="line" />
      </Skeleton.Group>,
    );
    expect(screen.getByTestId('group')).toHaveClass(skeletonGroupClassNames.root);
    expect(screen.getByTestId('line')).toHaveClass(skeletonClassNames.root);
  });

  it('Toast on its own: root, status icon, content column and dismiss button', () => {
    render(
      <Toast status="success" title="Saved" onDismiss={() => {}}>
        Your changes are live.
      </Toast>,
    );
    const toast = screen.getByRole('status');
    expect(toast).toHaveClass(toastClassNames.root);
    expect(toast.firstElementChild).toHaveClass(toastClassNames.icon);
    expect(screen.getByText('Saved').parentElement).toHaveClass(toastClassNames.content);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
      toastClassNames.dismissButton,
    );
  });

  it('Toaster: root on the viewport; a dispatched toast keeps only the Toast classes', async () => {
    const user = userEvent.setup();
    function Dispatcher() {
      const { dispatchToast } = useToastController();
      return (
        <button type="button" onClick={() => dispatchToast({ title: 'Saved' })}>
          Notify
        </button>
      );
    }
    render(
      <Toaster>
        <Dispatcher />
      </Toaster>,
    );
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveClass(
      toasterClassNames.root,
    );
    await user.click(screen.getByRole('button', { name: 'Notify' }));
    const toast = document.querySelector('[data-wave-toast]');
    expect(toast).toHaveClass(toastClassNames.root);
  });

  it('renders the classes in the server HTML', () => {
    const host = parseServerHtml(
      renderToString(
        <MessageBar status="error" onDismiss={() => {}}>
          Upload failed
        </MessageBar>,
      ),
    );
    const bar = host.querySelector('[role="alert"]') as HTMLElement;
    expect(bar).toHaveClass(messageBarClassNames.root);
    expect(bar.firstElementChild).toHaveClass(messageBarClassNames.icon);
    expect(bar.querySelector('button')).toHaveClass(messageBarClassNames.dismissButton);
  });
});
