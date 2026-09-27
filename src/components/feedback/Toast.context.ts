import * as React from 'react';
import { reportMissingContext } from '../../lib/dev';
import type { Status } from '../../lib/types';
import type { ToastController } from './Toaster';

/** The controller of the enclosing Toaster (`useToastController`); `null` outside one. */
export const ToasterContext = React.createContext<ToastController | null>(null);
ToasterContext.displayName = 'ToasterContext';

/**
 * `true` for the toasts the Toaster renders in its region, which its live regions announce. A
 * Toast rendered anywhere else (also as app content inside `<Toaster>`) is a live region itself.
 */
export const ToasterRegionContext = React.createContext(false);
ToasterRegionContext.displayName = 'ToasterRegionContext';

/**
 * A part registered with its toast (D9, D10): the title (its label names the toast), the body (it
 * describes the toast) or the footer (its controls are actions). The getters are read when the
 * container composes its name, timer and announcement, after the parts have mounted.
 */
export type ToastPartRegistration =
  | {
      kind: 'title';
      id: string;
      getLabel: () => HTMLElement | null;
      getRow: () => HTMLElement | null;
    }
  | { kind: 'body'; id: string; getElement: () => HTMLElement | null }
  | { kind: 'footer'; getElement: () => HTMLElement | null };

/** What a Toast rendered inside the Toaster's container registers with it (D10–D12). */
export interface ToastRegistration {
  status: Status;
  /** The resolved severity text (`''` when hidden). */
  statusLabel: string;
  /** The id of the visually hidden severity text, while it renders. */
  statusTextId: string | undefined;
  /** The Toast's `onDismiss`, called before the container dismisses the toast. */
  onDismiss: (() => void) | undefined;
  /** The Toast's built-in Dismiss button, which is no action. */
  getDismissButton: () => HTMLElement | null;
}

/** One per toast: provided by a standalone Toast and by the Toaster's container (D9). */
export interface ToastContextValue {
  /** The id of the title text that names the toast (`Toast.Title`'s label). */
  titleId: string | undefined;
  /**
   * What `Toast.Close` and the Dismiss button call: the Toast's `onDismiss` (when there is one),
   * then, inside the Toaster, the toast's dismissal. `undefined` when there is nothing to call.
   */
  dismiss: (() => void) | undefined;
  /** Registers a part (a no-op in a standalone Toast); returns the unregister function. */
  registerPart: (part: ToastPartRegistration) => () => void;
  /** Registers the Toast rendered inside a Toaster container; `null` everywhere else. */
  registerToast: ((toast: ToastRegistration) => () => void) | null;
}

export const ToastContext = React.createContext<ToastContextValue | null>(null);
ToastContext.displayName = 'ToastContext';

/** `true` inside the body a Toast wraps around children in which its scan found no part (D15 rule). */
export const ToastUnscannedContext = React.createContext(false);
ToastUnscannedContext.displayName = 'ToastUnscannedContext';

const unregisterNothing = () => {};

/** The context a part gets in production outside a Toast (C-CONTEXT). */
export const INERT_TOAST_CONTEXT: ToastContextValue = {
  titleId: undefined,
  dismiss: undefined,
  registerPart: () => unregisterNothing,
  registerToast: null,
};

/**
 * The per-toast context of a part. Outside a Toast and a Toaster's container it throws
 * `[WaveUI] <componentName> must be used within <Toast>` in development and returns an inert
 * context in production (C-CONTEXT).
 */
export function useToastContext(componentName: string): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context) return context;
  reportMissingContext(componentName, '<Toast>');
  return INERT_TOAST_CONTEXT;
}
