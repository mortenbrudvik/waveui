/**
 * Test harness of the Toaster suites (P3-toasts): renders a Toaster with a controller probe and
 * returns helpers that dispatch, dismiss and query the toasts. Not a test file itself.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { Toaster, useToastController } from '../Toast';
import type { ToastController, ToastOptions, ToasterProps } from '../Toast';

/** Exposes the controller of the enclosing Toaster to the test. */
export function ControllerProbe({ ref }: { ref: React.Ref<ToastController> }) {
  const controller = useToastController();
  React.useImperativeHandle(ref, () => controller, [controller]);
  return null;
}

export function renderToaster(
  props: Partial<ToasterProps> = {},
  options: { app?: React.ReactNode } = {},
) {
  const controllerRef = React.createRef<ToastController>();
  const ui = (toasterProps: Partial<ToasterProps>) => (
    <Toaster {...toasterProps}>
      <ControllerProbe ref={controllerRef} />
      {options.app}
    </Toaster>
  );
  const utils = render(ui(props));
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
  const dismissAll = () => {
    act(() => controller().dismissAllToasts());
  };
  /** Re-renders the Toaster with new props (the same app content). */
  const setProps = (next: Partial<ToasterProps>) => utils.rerender(ui(next));
  return { ...utils, controller, dispatch, dismiss, dismissAll, setProps };
}

export const getViewport = () => screen.getByRole('region', { name: 'Notifications' });

export function getLiveRegion(politeness: 'polite' | 'assertive'): HTMLElement {
  const region = getViewport().querySelector<HTMLElement>(`[aria-live="${politeness}"]`);
  if (!region) throw new Error(`no ${politeness} live region`);
  return region;
}

/** The toast containers of the Toaster (one per toast), in order. */
export const getToasts = () =>
  Array.from(getViewport().querySelectorAll<HTMLElement>('[data-wave-toast]'));

/** Advances the fake timers inside `act`. */
export const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
