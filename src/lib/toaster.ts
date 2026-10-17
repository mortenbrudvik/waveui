/**
 * The toaster module (P3-01, P3-08): the options recogniser and the toaster handle. Server-safe: it imports only types and touches no DOM, so a
 * Server Component may import it.
 */
import type * as React from 'react';
import type {
  ToastController,
  ToastDispatchOptions,
  ToastOptions,
} from '../components/feedback/Toaster';

/**
 * Whether a `dispatchToast` argument is the options form (0.5): a plain object (prototype
 * `Object.prototype` or `null`, from any realm) that is no React node — no `$$typeof`, not
 * iterable, not a thenable (the slot-object rule of `src/lib/slot.ts`). Anything else is content:
 * an element, a portal, a string, a number, an array or another iterable, a thenable, `null`.
 */
export function isToastOptions(value: unknown): value is ToastOptions {
  if (typeof value !== 'object' || value === null) return false;
  if ('$$typeof' in value || Symbol.iterator in value) return false;
  if (typeof (value as { then?: unknown }).then === 'function') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}

/**
 * A toast controller that code outside React components can call (a query-cache callback, a
 * server-event handler, a shared helper). Bind it to one Toaster with `<Toaster toaster={handle}>`;
 * toasts dispatched through it render there. One handle per Toaster is also how an app runs
 * several Toasters (Fluent's `toasterId`).
 */
export type ToasterHandle = ToastController;

/** A dispatch waiting for a Toaster to bind the handle. */
interface QueuedDispatch {
  id: string;
  run: (controller: ToastController) => void;
}

/** The internal state of a handle, never reachable from the handle itself. */
interface HandleState {
  controller: ToastController | null;
  /** The Toaster the handle is bound to (an identity token), or `null`. */
  owner: object | null;
  queue: QueuedDispatch[];
}

const handleStates = new WeakMap<object, HandleState>();
let handleCount = 0;

/**
 * Creates a handle. It touches no DOM, so a module-scope handle is safe during server rendering;
 * a dispatch on the server does nothing (it returns the id), so no toast is carried from one
 * request to the next.
 *
 * - `dispatchToast` returns the id at once: `toastId`, or one the handle generates.
 * - Before a Toaster binds the handle, dispatches wait in its queue, in dispatch order (a dispatch
 *   with the id of a waiting one replaces it in place); `dismissToast` removes a waiting toast and
 *   `dismissAllToasts` empties the queue. The Toaster that binds takes the queue.
 *
 * @example
 * export const appToaster = createToaster();
 * // <Toaster toaster={appToaster}><App /></Toaster>
 * queryClient.getMutationCache().config.onError = () => {
 *   appToaster.dispatchToast({ status: 'error', title: 'Could not save' });
 * };
 */
export function createToaster(): ToasterHandle {
  handleCount += 1;
  const prefix = `wave-toaster-h${handleCount}`;
  let dispatchCount = 0;
  const state: HandleState = { controller: null, owner: null, queue: [] };
  const nextId = () => {
    dispatchCount += 1;
    return `${prefix}-${dispatchCount}`;
  };
  const send = (id: string, run: (controller: ToastController) => void): string => {
    if (typeof window === 'undefined') return id;
    if (state.controller) {
      run(state.controller);
      return id;
    }
    const index = state.queue.findIndex((call) => call.id === id);
    if (index === -1) state.queue.push({ id, run });
    else state.queue[index] = { id, run };
    return id;
  };

  function dispatchToast(content: React.ReactNode, options?: ToastDispatchOptions): string;
  function dispatchToast(options: ToastOptions): string;
  function dispatchToast(
    first: React.ReactNode | ToastOptions,
    second?: ToastDispatchOptions,
  ): string {
    if (isToastOptions(first)) {
      const id = first.toastId ?? nextId();
      const options: ToastOptions = { ...first, toastId: id };
      return send(id, (controller) => {
        controller.dispatchToast(options);
      });
    }
    const id = second?.toastId ?? nextId();
    const options: ToastDispatchOptions = { ...second, toastId: id };
    return send(id, (controller) => {
      controller.dispatchToast(first, options);
    });
  }

  const handle: ToasterHandle = {
    dispatchToast,
    dismissToast(id) {
      if (state.controller) state.controller.dismissToast(id);
      else state.queue = state.queue.filter((call) => call.id !== id);
    },
    dismissAllToasts() {
      if (state.controller) state.controller.dismissAllToasts();
      else state.queue = [];
    },
  };
  handleStates.set(handle, state);
  return handle;
}

/** The result of {@link bindToasterHandle}. */
export type ToasterHandleBinding =
  | { status: 'bound'; unbind: () => void }
  | { status: 'taken' }
  | { status: 'unknown' };

/**
 * Internal (the Toaster's layout effect; not exported from the package): binds `handle` to the
 * controller of the Toaster identified by `owner` and replays the queue in dispatch order. A handle
 * bound to another mounted Toaster is `taken`; an object that `createToaster()` did not make is
 * `unknown`. The same owner binding again (StrictMode's remount) finds the queue already taken.
 */
export function bindToasterHandle(
  handle: ToastController,
  owner: object,
  controller: ToastController,
): ToasterHandleBinding {
  const state = handleStates.get(handle);
  if (!state) return { status: 'unknown' };
  if (state.owner !== null && state.owner !== owner) return { status: 'taken' };
  state.owner = owner;
  state.controller = controller;
  const queued = state.queue;
  state.queue = [];
  for (const call of queued) call.run(controller);
  return {
    status: 'bound',
    unbind: () => {
      if (state.owner !== owner) return;
      state.owner = null;
      state.controller = null;
    },
  };
}
