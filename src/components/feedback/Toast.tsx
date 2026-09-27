import { ToastBody, ToastClose, ToastFooter, ToastTitle } from './Toast.parts';
import { ToastRoot } from './Toast.root';

export type { ToastProps } from './Toast.root';
export type {
  ToastTitleProps,
  ToastBodyProps,
  ToastFooterProps,
  ToastCloseProps,
  ToastCloseRenderProps,
} from './Toast.parts';
export { Toaster, useToastController } from './Toaster';
export type {
  ToasterProps,
  ToastOptions,
  ToastController,
  ToastPosition,
  ToastDispatchOptions,
} from './Toaster';

/**
 * A notification: status icon, visually hidden severity text, title, body, footer and a Dismiss
 * button. Its parts are direct children: `Toast.Title` (the title row, with an optional
 * `action`), `Toast.Body` (with an optional `subtitle`) and `Toast.Footer` (a row of actions); a
 * `Toast.Close` anywhere inside makes its child dismiss the toast. The `title` prop and plain
 * children are the 0.5 form and render as a Title and a Body.
 *
 * Dispatch it with `useToastController().dispatchToast(<Toast>…</Toast>)`, or render it yourself.
 *
 * - **In a Toaster**: not a live region itself; the Toaster announces it once through its
 *   permanent live regions (its severity text, title, body and the labels of its actions, never
 *   the Dismiss button), politely or, for `error`, assertively, and names its container by the
 *   severity text and title. Every Toast there shows the Dismiss button.
 * - **On its own** (your own container, an inline notice): a live region, as in 0.4 —
 *   `role="status"` with `aria-live="polite"`, or `role="alert"` with `aria-live="assertive"` for
 *   `error` (override with `role`/`aria-live`). A live region that is added together with its
 *   text is not announced by every screen reader, so render the Toast in advance and change its
 *   content, or dispatch it through a Toaster.
 *
 * Sub-components are also exported under flat names (`ToastTitle`, `ToastBody`, `ToastFooter`,
 * `ToastClose`): React Server Components import those, because dotted access (`Toast.Title`)
 * needs a client file.
 */
export const Toast = /* @__PURE__ */ Object.assign(ToastRoot, {
  Title: ToastTitle,
  Body: ToastBody,
  Footer: ToastFooter,
  Close: ToastClose,
});

export { ToastTitle, ToastBody, ToastFooter, ToastClose };
