import * as React from 'react';
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
