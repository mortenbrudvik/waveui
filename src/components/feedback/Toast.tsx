import { ToastBody, ToastFooter, ToastTitle } from './Toast.parts';
import { ToastRoot } from './Toast.root';

export type { ToastProps } from './Toast.root';
export type { ToastTitleProps, ToastBodyProps, ToastFooterProps } from './Toast.parts';
export { Toaster, useToastController } from './Toaster';
export type { ToasterProps, ToastOptions, ToastController, ToastPosition } from './Toaster';

/**
 * A notification: status icon, visually hidden severity text, title, body, footer and a Dismiss
 * button. Its parts are direct children: `Toast.Title` (the title row, with an optional
 * `action`), `Toast.Body` (with an optional `subtitle`) and `Toast.Footer` (a row of actions). The
 * `title` prop and plain children are the 0.5 form and render as a Title and a Body.
 *
 * - **In a Toaster** (dispatched with `useToastController()`): not a live region itself; the
 *   Toaster announces it through its permanent live regions.
 * - **On its own** (your own container, an inline notice): a live region, as in 0.4 —
 *   `role="status"` with `aria-live="polite"`, or `role="alert"` with `aria-live="assertive"` for
 *   `error` (override with `role`/`aria-live`). A live region that is added together with its
 *   text is not announced by every screen reader, so render the Toast in advance and change its
 *   content, or dispatch it through a Toaster.
 *
 * Sub-components are also exported under flat names (`ToastTitle`, `ToastBody`, `ToastFooter`):
 * React Server Components import those, because dotted access (`Toast.Title`) needs a client file.
 */
export const Toast = /* @__PURE__ */ Object.assign(ToastRoot, {
  Title: ToastTitle,
  Body: ToastBody,
  Footer: ToastFooter,
});

export { ToastTitle, ToastBody, ToastFooter };
