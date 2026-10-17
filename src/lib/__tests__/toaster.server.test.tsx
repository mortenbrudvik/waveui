// @vitest-environment node
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from '../../components/feedback/Toast';
import { Toaster } from '../../components/feedback/Toaster';
import { bindToasterHandle, createToaster } from '../toaster';

/** A module-scope handle, as an app creates it next to its query client. */
const appToaster = createToaster();

describe('createToaster on the server (P3-08, D33)', () => {
  it('returns an id for a dispatch and queues nothing', () => {
    expect(typeof window).toBe('undefined');
    expect(appToaster.dispatchToast({ title: 'Saved' })).not.toBe('');
    expect(appToaster.dispatchToast({ toastId: 'given', title: 'Saved' })).toBe('given');
    const controller = {
      dispatchToast: vi.fn<(first: unknown, second?: unknown) => string>(() => ''),
      dismissToast: vi.fn<(id: string) => void>(),
      dismissAllToasts: vi.fn<() => void>(),
    };
    const binding = bindToasterHandle(appToaster, {}, controller);
    expect(binding.status).toBe('bound');
    expect(controller.dispatchToast).not.toHaveBeenCalled();
    if (binding.status === 'bound') binding.unbind();
  });

  it('renders a page with a bound Toaster and no toast', () => {
    appToaster.dispatchToast(
      <Toast>
        <Toast.Title>Not on the server</Toast.Title>
      </Toast>,
    );
    const html = renderToString(
      <Toaster toaster={appToaster}>
        <main>App</main>
      </Toaster>,
    );
    expect(html).toContain('<main>App</main>');
    expect(html).not.toContain('data-wave-toast');
    expect(html).not.toContain('Not on the server');
  });
});
