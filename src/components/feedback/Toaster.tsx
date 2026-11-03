import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { toasterClassNames } from '../../lib/classNames';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import { getFirstTabbable, getTabbableElements, isConnectedAndFocusable } from '../../lib/focus';
import {
  Z_INDEX,
  getOpenLayers,
  isInsideLayerTree,
  subscribeLayers,
  type LayerRecord,
} from '../../lib/layers';
import { toastMotion, toastStructure } from '../../lib/motion';
import { mergeSlotProps, type SlotPart } from '../../lib/slotProps';
import { focusRing } from '../../lib/styles';
import { bindToasterHandle, isToastOptions } from '../../lib/toaster';
import type { ToasterHandle } from '../../lib/toaster';
import type { MotionSlot, Status } from '../../lib/types';
import type { Politeness } from '../../hooks/useAnnounce';
import { useDirection } from '../../hooks/useDirection';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { useMotionClasses } from '../../hooks/useMotion';
import { usePresence } from '../../hooks/usePresence';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { Portal } from '../portal/Portal';
import { StatusText, getStatusLabel } from './MessageBar.status';
import { ToastContext, ToasterContext } from './Toast.context';
import type { ToastContextValue, ToastPartRegistration, ToastRegistration } from './Toast.context';
import { ToastRoot } from './Toast.root';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Options for dispatching a toast notification. */
export interface ToastOptions {
  /** Status level controlling the toast color, icon, status text and announcement politeness
   * (`error` is announced assertively, every other status politely).
   * @default 'info'
   */
  status?: Status;
  /** Title text of the toast. */
  title: string;
  /** Optional body text displayed below the title. */
  body?: string;
  /**
   * Auto-dismiss timeout in milliseconds. The countdown starts when the toast is shown (a toast
   * waiting beyond the Toaster's `limit` does not count down) and pauses while the pointer or
   * focus is anywhere in the toast region (a menu or popover opened from a toast included) and
   * while the browser window is in the background (it has lost focus, or the page is not shown, as
   * in a background tab, also when the Toaster mounts there). `0` (or any value that is not a
   * positive finite number) keeps the toast until it is dismissed.
   * @default 5000
   */
  timeout?: number;
  /**
   * Identifier of the toast. `dispatchToast` returns it (a generated one when omitted). Dispatching
   * again with the id of a toast that is shown, or still exiting after its dismissal, replaces or
   * revives that toast (content and timer); with the id of a toast that waits beyond the Toaster's
   * `limit`, it replaces its options and the toast keeps its place in the queue.
   */
  toastId?: string;
  /**
   * Visually hidden status text read before the toast (`'Info:'`, `'Success:'`, `'Warning:'`,
   * `'Error:'` by default). Pass a translation for other languages, or `''` to omit it.
   */
  statusLabel?: string;
  /**
   * Accessible name of the toast's dismiss button. Pass a translation for other languages.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /**
   * `inverted` draws the toast on the inverted surface, as a Tooltip is (Fluent's `Toast`
   * `appearance`). The toast carries it as `data-appearance`.
   * @default 'default'
   */
  appearance?: ToastAppearance;
  /**
   * Whether the toast shows its Dismiss button. `false` leaves the toast without one (Delete,
   * Backspace, Escape, `dismissToast` and the timeout still dismiss it), for a toast the user must
   * not close from the pointer, such as one that reports a running task.
   * @default true
   */
  showDismissButton?: boolean;
  /** As {@link ToastDispatchOptions.politeness}. */
  politeness?: Politeness;
  /** As {@link ToastDispatchOptions.position}. */
  position?: ToastPosition;
  /** As {@link ToastDispatchOptions.priority}. */
  priority?: number;
  /** As {@link ToastDispatchOptions.pauseOnHover}. */
  pauseOnHover?: boolean;
  /** As {@link ToastDispatchOptions.pauseOnWindowBlur}. */
  pauseOnWindowBlur?: boolean;
  /** As {@link ToastDispatchOptions.onStatusChange}. */
  onStatusChange?: ToastStatusChangeHandler;
}

/** Options of `dispatchToast(content, options)`, the form that shows your own React content. */
export interface ToastDispatchOptions {
  /** As `ToastOptions.toastId`: dispatching again with the id of a shown or exiting toast replaces it. */
  toastId?: string;
  /**
   * Auto-dismiss timeout in milliseconds, as `ToastOptions.timeout`. A toast that holds an action
   * (an interactive element besides its Dismiss button) stays until it is dismissed unless you
   * pass one: people using a screen reader, a switch or voice control need time to reach it.
   * @default 5000, or no timeout for a toast with an action
   */
  timeout?: number;
  /**
   * Severity of content that renders no `Toast`: the announcement's politeness (`error` is
   * assertive), its spoken prefix and the container's name. A rendered `Toast` uses its own
   * `status`; a different value passed here warns in development.
   * @default 'info'
   */
  status?: Status;
  /** Visually hidden severity text for content that renders no `Toast` (as `Toast.statusLabel`). */
  statusLabel?: string;
  /**
   * Text announced instead of the toast's title, body and action labels (the severity text still
   * comes first), for a toast whose visible text is no good announcement, such as a progress toast.
   */
  announcement?: string;
  /**
   * How urgently the toast is announced: `assertive` or `polite`. Without it the toast's status
   * decides (`error` is assertive, every other status polite). Fluent's `politeness`.
   * @default by status
   */
  politeness?: Politeness;
  /**
   * Where this toast appears, instead of the Toaster's `position`. Toasts of a position other than
   * the Toaster's stack there in an element of their own inside the Toaster's region, and do not
   * move aside for an open Drawer (only the Toaster's own position does). Fluent's `position`.
   * @default the Toaster's `position`
   */
  position?: ToastPosition;
  /**
   * Orders the toasts that wait beyond the Toaster's `limit`: when a place frees up, the waiting
   * toast with the highest priority appears first (the earliest dispatch among equals). A toast
   * that is already shown stays, whatever its priority, and shown toasts keep the order of their
   * dispatch (Fluent shows the highest priorities first and can move a shown toast back to its
   * queue). Fluent's `priority`.
   * @default 0
   */
  priority?: number;
  /**
   * Whether the countdown pauses while the pointer is in the toast region. `false` lets the toast
   * time out while it is hovered. Focus in the region always pauses the countdown, so keyboard
   * and screen-reader users keep their time. Fluent's `pauseOnHover` (which defaults to `false`
   * there).
   * @default true
   */
  pauseOnHover?: boolean;
  /**
   * Whether the countdown pauses while the browser window is in the background (it has lost focus,
   * or the page is not shown). `false` keeps it running there. Fluent's `pauseOnWindowBlur` (which
   * defaults to `false` there).
   * @default true
   */
  pauseOnWindowBlur?: boolean;
  /**
   * Called when the toast's lifecycle changes: `queued` (it waits beyond the Toaster's `limit`),
   * `visible` (it is shown, announced, its timer running), `dismissed` (its exit begins; the
   * `reason` says why) and `unmounted` (it is gone). `visible` is reported again when a toast that
   * exits is revived by its id. Not called for the Toaster's own unmount. Fluent's `onStatusChange`.
   */
  onStatusChange?: ToastStatusChangeHandler;
}

/** Where a toast is in its lifecycle (`ToastDispatchOptions.onStatusChange`). */
export type ToastStatus = 'queued' | 'visible' | 'dismissed' | 'unmounted';

/**
 * Why a toast was dismissed: its `timeout` ran out, a Dismiss button or `Toast.Close` was
 * activated (`close`), Delete or Backspace (`keyboard`), Escape (`escape`), or code called
 * `dismissToast` or `dismissAllToasts` (`controller`).
 */
export type ToastDismissReason = 'timeout' | 'close' | 'keyboard' | 'escape' | 'controller';

/** The second argument of a toast's `onStatusChange`. */
export interface ToastStatusChangeDetails {
  /** The id of the toast. */
  toastId: string;
  /** Why the toast was dismissed, for the `dismissed` status; `undefined` otherwise. */
  reason: ToastDismissReason | undefined;
}

/** A toast's `onStatusChange` callback. */
export type ToastStatusChangeHandler = (
  status: ToastStatus,
  details: ToastStatusChangeDetails,
) => void;

/** Appearance of a Toast: `inverted` draws it on the inverted surface. */
export type ToastAppearance = 'default' | 'inverted';

/**
 * What {@link ToastController.updateToast} changes of a toast: any option of the dispatch (the
 * ones you leave out keep their value) and, for a toast dispatched with content, the `content`.
 */
export type ToastUpdate = Partial<Omit<ToastOptions, 'toastId'>> & {
  /** The id of the toast to update. */
  toastId: string;
  /**
   * New content of a toast dispatched with `dispatchToast(content)`. Ignored, with a development
   * warning, for one built from text options.
   */
  content?: React.ReactNode;
};

/** What a Toaster passes to its `announce` prop for each toast. */
export interface ToastAnnouncement {
  /** The id of the toast. */
  toastId: string;
  /** The text to read: the severity text, then the title, body and actions, or the `announcement`. */
  message: string;
  /** `assertive` for an `error` toast (or the toast's own `politeness`), `polite` otherwise. */
  politeness: Politeness;
}

/** The toast API returned by {@link useToastController}. */
export interface ToastController {
  /**
   * Shows a toast and returns its id. `dispatchToast(content, options?)` shows your content,
   * usually a `<Toast>` with parts; `dispatchToast(options)` builds a toast from text (0.5). A
   * plain object is read as options; anything else (an element, a portal, a string) is content. A
   * toast with the same id is replaced (revived while it exits); beyond the Toaster's `limit` the
   * toast waits in a queue. Fluent's `dispatchToast(content, options)` returns nothing.
   */
  dispatchToast: {
    (content: React.ReactNode, options?: ToastDispatchOptions): string;
    (options: ToastOptions): string;
  };
  /**
   * Dismisses the toast with this id and cancels its timer: a shown toast exits (it stays, inert,
   * until its exit motion ends; see the Toaster's `motion`), a waiting one is removed. Unknown ids
   * are ignored.
   */
  dismissToast: (id: string) => void;
  /**
   * Dismisses every toast and cancels their timers: shown toasts exit (as `dismissToast`), queued
   * ones are removed.
   */
  dismissAllToasts: () => void;
  /**
   * Changes a shown or waiting toast: the options you pass are merged over the toast's (the ones
   * you leave out keep their value, unlike dispatching again with the id, which replaces them) and
   * `content` replaces the content of a toast dispatched with content. The toast keeps its place
   * and its timer, which restarts only when you pass a `timeout`, and it is announced again only
   * when the text that is read changes (pass `announcement` to keep what is read while a progress
   * toast updates). An unknown or dismissed id is ignored. Fluent's `updateToast`.
   */
  updateToast: (update: ToastUpdate) => void;
  /**
   * Pauses the countdown of the toast with this id until `playToast`, on top of the pauses of the
   * pointer, focus and the window (a toast that is paused by hand does not time out while the
   * pointer leaves). Unknown ids are ignored. Fluent's `pauseToast`.
   */
  pauseToast: (id: string) => void;
  /** Lets the countdown of a toast paused with `pauseToast` run again. Fluent's `playToast`. */
  playToast: (id: string) => void;
}

/** What a dispatch stores: the options form, or your content with its options. */
type DispatchedToast =
  | { form: 'options'; options: ToastOptions }
  | { form: 'content'; content: React.ReactNode; options: ToastDispatchOptions };

type ToastEntry = DispatchedToast & {
  id: string;
  /** Increases with every dispatch, so a replaced toast is announced again. */
  seq: number;
  /**
   * The dispatch counter's value that started the timer: `seq`, and a newer one after an update
   * that passes a `timeout` (or a pause option), so the timer restarts without a new announcement.
   */
  timerSeq: number;
  /** The `priority` option as a number (`0` without one): the order the waiting toasts appear in. */
  priority: number;
  /**
   * Whether the toast is shown (rendered, announced, its timer running) or still waits beyond the
   * Toaster's `limit`. Only {@link promoteQueued} sets it; it never goes back to `false`.
   */
  shown: boolean;
  /**
   * Dismissed: its container exits (not announced, no timer, not counted toward `limit`) and the
   * entry is removed when the exit ends; a dispatch with its id revives it (D29).
   */
  dismissed: boolean;
};

/** A `priority` option as the number the queue orders by: finite, else `0`. */
function resolvePriority(priority: number | undefined): number {
  return typeof priority === 'number' && Number.isFinite(priority) ? priority : 0;
}

/**
 * Flags the waiting toasts as shown while fewer than `limit` toasts are shown and not dismissed:
 * the one with the highest `priority` first, the earliest dispatch among equals. Returns `toasts`
 * itself when nothing changes, so the Toaster's render-time update settles.
 */
function promoteQueued(toasts: ToastEntry[], limit: number): ToastEntry[] {
  let active = 0;
  const waiting: ToastEntry[] = [];
  for (const toast of toasts) {
    if (!toast.shown) waiting.push(toast);
    else if (!toast.dismissed) active += 1;
  }
  if (waiting.length === 0 || active >= limit) return toasts;
  // Array.prototype.sort is stable, so equal priorities keep their order in the list.
  const promoted = new Set(
    waiting.sort((a, b) => b.priority - a.priority).slice(0, Math.max(0, limit - active)),
  );
  return toasts.map((toast) => (promoted.has(toast) ? { ...toast, shown: true } : toast));
}

/**
 * Merges an update into the toast it names (`toasts` itself when there is none or it is
 * dismissed): the options over its options, the `content` over a content toast's. An update that
 * passes `timeout`, `pauseOnHover` or `pauseOnWindowBlur` restarts the timer through a new
 * `timerSeq`; the announcement's `seq` stays.
 */
function mergeUpdate(toasts: ToastEntry[], update: ToastUpdate, timerSeq: number): ToastEntry[] {
  const index = toasts.findIndex((toast) => toast.id === update.toastId);
  if (index === -1 || toasts[index].dismissed) return toasts;
  const toast = toasts[index];
  const { toastId: _toastId, content, ...patch } = update;
  const defined: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) defined[key] = value;
  const restartsTimer =
    'timeout' in defined || 'pauseOnHover' in defined || 'pauseOnWindowBlur' in defined;
  let merged: DispatchedToast;
  if (toast.form === 'options') {
    merged = { form: 'options', options: { ...toast.options, ...defined } };
  } else {
    const { title: _title, body: _body, ...options } = defined as Partial<ToastOptions>;
    merged = {
      form: 'content',
      content: content !== undefined ? content : toast.content,
      options: { ...toast.options, ...options },
    };
  }
  const next = toasts.slice();
  next[index] = {
    ...toast,
    ...merged,
    priority: resolvePriority(merged.options.priority),
    timerSeq: restartsTimer ? timerSeq : toast.timerSeq,
  };
  return next;
}

/** Dismisses a shown toast (it exits) and drops a waiting one; `toasts` itself when nothing changes. */
function markDismissed(toasts: ToastEntry[], id: string): ToastEntry[] {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index === -1) return toasts;
  const toast = toasts[index];
  if (!toast.shown) return [...toasts.slice(0, index), ...toasts.slice(index + 1)];
  if (toast.dismissed) return toasts;
  const next = toasts.slice();
  next[index] = { ...toast, dismissed: true };
  return next;
}

/** Dismisses every shown toast and drops the waiting ones; `toasts` itself when nothing changes. */
function markAllDismissed(toasts: ToastEntry[]): ToastEntry[] {
  if (toasts.every((toast) => toast.shown && toast.dismissed)) return toasts;
  return toasts
    .filter((toast) => toast.shown)
    .map((toast) => (toast.dismissed ? toast : { ...toast, dismissed: true }));
}

/** The shown, not dismissed toast dispatched last (the highest `seq`), or `undefined`. */
function findNewestToast(toasts: readonly ToastEntry[]): ToastEntry | undefined {
  let newest: ToastEntry | undefined;
  for (const toast of toasts) {
    if (toast.shown && !toast.dismissed && (!newest || toast.seq > newest.seq)) newest = toast;
  }
  return newest;
}

/**
 * Whether `node` is in the toast region: inside the viewport, or inside an open dismiss layer
 * anchored inside it (a Menu, Popover or Tooltip opened from a toast, whose portal lives elsewhere
 * in the document).
 */
function isInToastRegion(viewport: HTMLElement, node: Node): boolean {
  if (viewport.contains(node)) return true;
  return getOpenLayers().some((layer) => {
    const anchor = layer.getAnchor();
    return anchor !== null && viewport.contains(anchor) && isInsideLayerTree(layer.id, node);
  });
}

/** Whether a toast holds an action: an element in its Tab order other than its Dismiss button. */
function hasAction(container: HTMLElement, toast: ToastRegistration | null): boolean {
  const dismissButton = toast?.getDismissButton() ?? null;
  return getTabbableElements(container).some((el) => el !== dismissButton);
}

/** `limit` as the Toaster applies it: whole toasts, at least 1; `undefined` means no limit. */
function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) return Infinity;
  return limit >= 1 ? Math.floor(limit) : 1;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const INERT_CONTROLLER: ToastController = {
  dispatchToast: (first: React.ReactNode | ToastOptions, second?: ToastDispatchOptions) =>
    (isToastOptions(first) ? first.toastId : second?.toastId) ?? '',
  dismissToast: () => {},
  dismissAllToasts: () => {},
  updateToast: () => {},
  pauseToast: () => {},
  playToast: () => {},
};

/** The C-CONTEXT message without the `[WaveUI] ` prefix, which `reportMissingContext` adds. */
const MISSING_TOASTER_MESSAGE =
  'useToastController must be used within <Toaster>. Wrap your app (or the part of it that shows toasts) in <Toaster>: it provides the controller to its children.';

/**
 * Returns the {@link ToastController} of the enclosing `<Toaster>`: `dispatchToast(content,
 * options?)` shows your content (usually a `<Toast>` with parts) and `dispatchToast(options)` a
 * toast built from text; both return the toast's id. `dismissToast(id)` dismisses one toast,
 * `dismissAllToasts()` every toast.
 *
 * Must be called inside `<Toaster>`, which provides the controller to its children — wrap the app
 * (or the part of it that shows toasts) in `<Toaster>`; a sibling `<Toaster />` does not work.
 * Outside a Toaster it throws in development; in production it logs an error (once) and returns a
 * controller that does nothing.
 *
 * @example
 * function SaveButton() {
 *   const { dispatchToast } = useToastController();
 *   return (
 *     <Button
 *       onClick={() =>
 *         dispatchToast(
 *           <Toast status="success">
 *             <Toast.Title>Saved</Toast.Title>
 *           </Toast>,
 *         )
 *       }
 *     >
 *       Save
 *     </Button>
 *   );
 * }
 * // <Toaster><App /></Toaster>
 */
export function useToastController(): ToastController {
  const controller = React.useContext(ToasterContext);
  if (controller) return controller;
  reportMissingContext('useToastController', '<Toaster>', MISSING_TOASTER_MESSAGE);
  return INERT_CONTROLLER;
}

/* ------------------------------------------------------------------ */
/*  Timers                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_TIMEOUT = 5000;

type PauseReason = 'hover' | 'focus';

interface RunningTimer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
  /** Whether the pointer in the region pauses it (`pauseOnHover`). */
  pauseOnHover: boolean;
  /** Whether the window in the background pauses it (`pauseOnWindowBlur`). */
  pauseOnWindowBlur: boolean;
}

/** What a dispatch decides about the pauses of its toast's timer (both on by default). */
interface TimerPauseOptions {
  pauseOnHover?: boolean;
  pauseOnWindowBlur?: boolean;
}

/**
 * Auto-dismiss timers of one Toaster. A timer runs only while focus is not in the toast region
 * (D14), the pointer is not in it (unless the toast opted out with `pauseOnHover: false`), the
 * window is in the foreground (unless it opted out with `pauseOnWindowBlur: false`), the toast
 * is not paused by hand and the Toaster is mounted; otherwise it is suspended and keeps its
 * remaining time. Every method is called from event handlers or effects, never during render.
 */
interface ToastTimers {
  /**
   * Starts the timer of the shown toast `id` for its timer sequence `seq`, once: a call with the
   * `seq` already started does nothing, a new `seq` (the toast was replaced, or updated with a
   * new timeout) restarts it. A timeout that is not a positive finite number means none. A toast
   * replaced while the region is paused stays paused.
   */
  start(id: string, seq: number, timeout: number, pauses?: TimerPauseOptions): void;
  /** Cancels the timer of `id` and forgets its manual pause. */
  remove(id: string): void;
  /** Cancels every timer and manual pause; the region's pause is kept. */
  clear(): void;
  /** Pauses the timer of `id` by hand, until {@link ToastTimers.play}. */
  pause(id: string): void;
  /** Ends the manual pause of `id`. */
  play(id: string): void;
  /** `true` while the pointer (`'hover'`) or focus (`'focus'`) is in the toast region. */
  setPaused(reason: PauseReason, paused: boolean): void;
  /** Whether the region is paused for `reason`. */
  isPaused(reason: PauseReason): boolean;
  /** `true` while the window has lost focus or the page is not shown (a background tab). */
  setInBackground(inBackground: boolean): void;
  /** `true` while the Toaster is unmounted (including StrictMode's simulated unmount). */
  setSuspended(suspended: boolean): void;
}

function createToastTimers(onExpire: (id: string) => void): ToastTimers {
  const timers = new Map<string, RunningTimer>();
  /** Why the region pauses its timers. */
  const pauses = new Set<PauseReason>();
  /** The toasts paused by hand. */
  const manual = new Set<string>();
  /** The timer sequence that was started last, per toast. */
  const started = new Map<string, number>();
  let inBackground = false;
  let suspended = false;

  const sync = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    const canRun =
      !suspended &&
      !(inBackground && timer.pauseOnWindowBlur) &&
      !pauses.has('focus') &&
      !(pauses.has('hover') && timer.pauseOnHover) &&
      !manual.has(id);
    if (canRun && timer.handle === null) {
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => {
        timers.delete(id);
        started.delete(id);
        onExpire(id);
      }, timer.remaining);
    } else if (!canRun && timer.handle !== null) {
      clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    }
  };
  const syncAll = () => {
    for (const id of Array.from(timers.keys())) sync(id);
  };
  const stop = (id: string) => {
    const timer = timers.get(id);
    if (timer?.handle != null) clearTimeout(timer.handle);
    timers.delete(id);
  };

  return {
    start(id, seq, timeout, options) {
      if (started.get(id) === seq) return;
      started.set(id, seq);
      stop(id);
      if (!(timeout > 0) || !Number.isFinite(timeout)) return;
      timers.set(id, {
        handle: null,
        remaining: timeout,
        startedAt: 0,
        pauseOnHover: options?.pauseOnHover !== false,
        pauseOnWindowBlur: options?.pauseOnWindowBlur !== false,
      });
      sync(id);
    },
    remove(id) {
      stop(id);
      started.delete(id);
      manual.delete(id);
    },
    clear() {
      for (const id of Array.from(timers.keys())) stop(id);
      started.clear();
      manual.clear();
    },
    pause(id) {
      manual.add(id);
      sync(id);
    },
    play(id) {
      manual.delete(id);
      sync(id);
    },
    isPaused(reason) {
      return pauses.has(reason);
    },
    setPaused(reason, paused) {
      if (paused) pauses.add(reason);
      else pauses.delete(reason);
      syncAll();
    },
    setInBackground(value) {
      inBackground = value;
      syncAll();
    },
    setSuspended(value) {
      suspended = value;
      syncAll();
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Toaster (container)                                               */
/* ------------------------------------------------------------------ */

/**
 * Place of the viewport a {@link Toaster} shows its toasts in (`ToasterProps.position`): a corner,
 * or, with `top` and `bottom`, the middle of an edge. `start`/`end` follow the writing direction;
 * `left`/`right` are physical.
 */
export type ToastPosition =
  | 'top'
  | 'bottom'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left';

/** Keyboard shortcuts of a Toaster (Fluent's shape). */
export interface ToasterShortcuts {
  /**
   * Returns `true` for the key press that moves focus to the most recently dispatched toast, for
   * example `(event) => event.altKey && event.shiftKey && event.code === 'KeyN'`. Use a modifier
   * (or let people change or turn off the shortcut): a single-character shortcut fails WCAG 2.1.4.
   */
  focus?: (event: KeyboardEvent) => boolean;
}

/** Properties for the Toaster container component. */
export interface ToasterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Corner of the viewport the toasts appear in. `start`/`end` follow the writing direction (the
   * `end` side is the right in LTR and the left in RTL); `left`/`right` are physical.
   * @default 'bottom-end'
   */
  position?: ToastPosition;
  /**
   * Most toasts shown at once. Further toasts wait in a queue (in dispatch order) and appear when
   * a shown toast goes; a queued toast is not announced and its timer does not run until then.
   * Lowering it never hides a toast that is already shown, and a toast dispatched again with its id
   * while it exits comes back at once, even when `limit` toasts are already shown. A value below 1
   * counts as 1 (development warning); `Infinity` means no limit.
   * @default Infinity
   */
  limit?: number;
  /**
   * How far the toasts sit from the window edges, in pixels: a number for both axes, or
   * `{ horizontal, vertical }` (the horizontal distance is from the side the position names and
   * is ignored for the centered `top` and `bottom`). A toast that moves aside for an open Drawer
   * keeps this distance from it. A value that is not a finite number of 0 or more counts as 16.
   * Fluent's `offset` (`{ horizontal, vertical }`).
   * @default 16
   */
  offset?: ToasterOffset;
  /**
   * Renders the toast region where the Toaster is, instead of in a portal on `document.body`: for
   * a Shadow DOM or an isolated subtree whose stacking and theme classes the portal would leave.
   * The region keeps `position: fixed` (a containing block such as a `transform` positions it
   * inside that element) and the toast layer's z-index. While a modal opens, the page
   * behind it is made inert: an inline region inside that page is then not reachable, so place
   * the Toaster beside the app, not inside it, when toasts must stay usable over a Dialog.
   * Fluent's `inline`.
   * @default false
   */
  inline?: boolean;
  /**
   * Replaces the Toaster's live regions: it is called once for each toast that is shown (and again
   * when its text changes, or the toast is dispatched again), with the text the toast's live region
   * would have read and its politeness, so the app can send it through its own announcer
   * (`useAnnounce`'s `announce`, an `ariaNotify` call). Given, the Toaster's two live regions stay
   * mounted and empty. Not called for a toast that is dismissed. Fluent's `announce`.
   */
  announce?: (announcement: ToastAnnouncement) => void;
  /** Keyboard shortcuts; Escape, Delete and Backspace need none (see the component docs). */
  shortcuts?: ToasterShortcuts;
  /**
   * Binds this Toaster to a handle from `createToaster()`: toasts dispatched through the handle
   * render here. A handle binds one Toaster: a second Toaster given a bound handle does not bind
   * (development warning), and does not take the handle over when the first unmounts; the handle
   * queues again until a Toaster binds it.
   */
  toaster?: ToasterHandle;
  /**
   * The motion of every toast's container (the `role="group"` element; `className` stays on the
   * region). By default a toast opens its place in the stack, fades in and slides 8px in from the
   * stack's edge (the top or bottom edge `position` names) over 250 ms with a decelerating curve,
   * all together; dismissed, it fades out over 200 ms, then its place closes over 200 ms more,
   * so the toasts around it glide together and nothing jumps when it unmounts (the timer still
   * starts when the toast is shown). Under reduced motion it appears and disappears at once.
   * `null` turns the motion off (the container still renders its `data-presence` phases, which
   * then end at once); a class string or `{ className }` replaces the default classes with yours
   * (see `MotionSlot`), also under a `WaveProvider` with `motion="none"`, which otherwise turns
   * the default off. A WaveUI addition: Fluent's Toaster has no motion slot.
   * @default the slide, fade and collapse above
   */
  motion?: MotionSlot | null;
  /** Ref to the toast region (the portaled `<div role="region">`). */
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Props for the element the Toaster draws around each toast, by part, merged into the part's
   * own: your classes after the part's (yours win a conflict), your styles over its styles, your
   * attributes and handlers added, your ref beside its refs. Every attribute the Toaster sets on
   * the part is locked and keeps the Toaster's value; you add the attributes it does not set. A
   * part takes no `children`. The region takes the Toaster's own props, and its live regions are
   * no part.
   */
  slotProps?: {
    /**
     * The `role="group"` container of each toast (stable class `wave-toaster__toast`): the
     * element the focus shortcut and Delete act on, and the one `motion` animates (its motion
     * classes come before yours). The same props reach every toast's container: your ref
     * receives each of them, and an `id` would repeat. Your `onKeyDown` runs first:
     * `preventDefault()` in it skips the component's handling of the key, so Delete and
     * Backspace keep the toast and Escape keeps every toast (the region's own `onKeyDown` still
     * receives it). The region pauses the timers while the pointer or focus is in it, even when
     * your handlers call `preventDefault()`; a handler of yours that stops a focus or blur event
     * from propagating keeps it from the region, as one in a toast's content does, and can leave
     * the timers paused. Locked: `role`, `tabIndex`, its marker `data-wave-toast`,
     * `data-presence`, `inert` (set while the toast exits), `aria-labelledby` and
     * `aria-describedby` (the toast's status text, title and body: your ids are added after
     * them) and, unset, `hidden` and `aria-hidden`.
     */
    toast?: SlotPart<'div'>;
  };
}

/**
 * What the `toast` part locks besides its name, description and key handler: the container's role,
 * tab stop and marker, and unset the hidden state, which the presence core sets only while a toast
 * exits (its attributes follow the part's).
 */
const TOAST_PART_LOCKS = {
  role: 'group',
  tabIndex: -1,
  'data-wave-toast': '',
  hidden: undefined,
  inert: undefined,
  'aria-hidden': undefined,
} as const;

/**
 * Corner placement. The margin on the toasts' side is `--wave-toaster-offset`, and the margin on
 * their top or bottom edge `--wave-toaster-offset-block`, which the Toaster sets while a modal or
 * non-modal panel covers that side or that edge (see {@link getPanelOffsets}); unset, each is `0`.
 */
const positionClasses: Record<ToastPosition, string> = {
  // Centered: both insets and the fixed width, with auto margins on the inline axis. Only the block
  // margin follows a panel (a panel at the bottom or top edge), never the inline one.
  top: 'wave:top-4 wave:inset-x-0 wave:mx-auto wave:mt-(--wave-toaster-offset-block)',
  bottom: 'wave:bottom-4 wave:inset-x-0 wave:mx-auto wave:mb-(--wave-toaster-offset-block)',
  'top-start':
    'wave:top-4 wave:start-4 wave:ms-(--wave-toaster-offset) wave:mt-(--wave-toaster-offset-block)',
  'top-end':
    'wave:top-4 wave:end-4 wave:me-(--wave-toaster-offset) wave:mt-(--wave-toaster-offset-block)',
  'bottom-start':
    'wave:bottom-4 wave:start-4 wave:ms-(--wave-toaster-offset) wave:mb-(--wave-toaster-offset-block)',
  'bottom-end':
    'wave:bottom-4 wave:end-4 wave:me-(--wave-toaster-offset) wave:mb-(--wave-toaster-offset-block)',
  'top-right':
    'wave:top-4 wave:right-4 wave:mr-(--wave-toaster-offset) wave:mt-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'top-left':
    'wave:top-4 wave:left-4 wave:ml-(--wave-toaster-offset) wave:mt-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'bottom-right':
    'wave:bottom-4 wave:right-4 wave:mr-(--wave-toaster-offset) wave:mb-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'bottom-left':
    'wave:bottom-4 wave:left-4 wave:ml-(--wave-toaster-offset) wave:mb-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
};

/** The toasts' distance from the window edges (`*-4`), also the tolerance for "at the edge". */
const EDGE_GAP = 16;

/**
 * The distance of the toasts from the window edges in pixels: one number for both axes, or
 * `horizontal` (from the side, ignored for a centered position) and `vertical` (from the top or
 * bottom edge). A value that is not a finite number of 0 or more counts as the default, 16.
 */
export type ToasterOffset = number | { horizontal?: number; vertical?: number };

/** One axis of a {@link ToasterOffset} as pixels, or `undefined` for the default distance. */
function offsetPixels(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** The two distances of an `offset` prop; `undefined` where the default applies. */
function resolveOffset(offset: ToasterOffset | undefined): {
  horizontal: number | undefined;
  vertical: number | undefined;
} {
  if (typeof offset === 'number') {
    return { horizontal: offsetPixels(offset), vertical: offsetPixels(offset) };
  }
  return { horizontal: offsetPixels(offset?.horizontal), vertical: offsetPixels(offset?.vertical) };
}

/** Whether `position` is centered on its edge (`top` or `bottom`). */
function isCentered(position: ToastPosition): boolean {
  return position === 'top' || position === 'bottom';
}

/**
 * Inline style that moves a region to its custom `offset`: the edge properties of `position` at
 * the given pixels, over the classes' 16px. `undefined` when no distance is custom.
 */
function offsetStyle(
  position: ToastPosition,
  offset: { horizontal: number | undefined; vertical: number | undefined },
): React.CSSProperties | undefined {
  const style: React.CSSProperties = {};
  if (offset.vertical !== undefined) {
    if (position.startsWith('top')) style.top = offset.vertical;
    else style.bottom = offset.vertical;
  }
  if (offset.horizontal !== undefined && !isCentered(position)) {
    const side = position.slice(position.indexOf('-') + 1);
    if (side === 'start') style.insetInlineStart = offset.horizontal;
    else if (side === 'end') style.insetInlineEnd = offset.horizontal;
    else if (side === 'left') style.left = offset.horizontal;
    else style.right = offset.horizontal;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

/** Whether the toasts sit at the right edge of the window (`end` is the right in LTR). */
function isOnRightSide(position: ToastPosition, viewport: HTMLElement): boolean {
  const inline = position.slice(position.indexOf('-') + 1);
  if (inline === 'right' || inline === 'left') return inline === 'right';
  const rtl = getDirection(viewport) === 'rtl';
  return inline === 'end' ? !rtl : rtl;
}

/** How far the toasts move away from their corner, per axis, in px (`0`: they stay). */
interface PanelOffsets {
  /** Away from the toasts' side (`--wave-toaster-offset`). */
  inline: number;
  /** Away from their top or bottom edge (`--wave-toaster-offset-block`). */
  block: number;
}

/** No panel at the toasts' corner: they keep it. */
const NO_PANEL_OFFSETS: PanelOffsets = { inline: 0, block: 0 };

/** The open layers the toasts keep clear of: kind `'modal'` or `'dialog'` (a Dialog or Drawer). */
function getPanelLayers(): LayerRecord[] {
  return getOpenLayers().filter((layer) => layer.kind === 'modal' || layer.kind === 'dialog');
}

/** The connected elements of the open panel layers ({@link getPanelLayers}). */
function getPanelElements(): Set<HTMLElement> {
  const elements = new Set<HTMLElement>();
  for (const layer of getPanelLayers()) {
    for (const el of layer.getElements()) if (el?.isConnected) elements.add(el);
  }
  return elements;
}

/**
 * How far the toasts move away from their corner while an open panel covers it, so they never
 * hide the panel's controls (WCAG 2.4.11 Focus Not Obscured). It reads every open layer of kind
 * `'modal'` or `'dialog'` (a modal or non-modal Dialog or Drawer). An element of such a layer
 * counts when it reaches the toasts' side and their top or bottom edge (a centered Dialog does
 * not). The toasts move beside it when they fit there (a side panel: the offset is its width from
 * that side of the window, which leaves the usual gap between toasts and panel); otherwise above
 * it for bottom toasts, below it for top toasts, when they fit there (a bottom panel: its height);
 * otherwise it is ignored (a full-width side panel or a full-height bottom panel on a phone), and
 * they keep their corner. Each axis takes the largest offset of its panels, so a side panel and a
 * bottom panel open together move the toasts on both axes; an axis without room keeps `0`.
 */
function getPanelOffsets(
  viewport: HTMLElement,
  position: ToastPosition,
  gaps: { horizontal: number; vertical: number },
  extraPanels: ReadonlySet<HTMLElement>,
): PanelOffsets {
  const panels = getPanelLayers();
  if (panels.length === 0 && extraPanels.size === 0) return NO_PANEL_OFFSETS;
  const doc = viewport.ownerDocument;
  const view = doc.defaultView;
  if (!view) return NO_PANEL_OFFSETS;
  // The box fixed elements are placed in: the window without its scrollbars.
  const width = doc.documentElement.clientWidth || view.innerWidth;
  const height = doc.documentElement.clientHeight || view.innerHeight;
  const centered = isCentered(position);
  const right = centered ? false : isOnRightSide(position, viewport);
  const top = position.startsWith('top');
  // Whether the toasts fit in what an offset leaves of the window's width or height.
  const fitsInline = (offset: number) =>
    width - offset >= viewport.offsetWidth + 2 * gaps.horizontal;
  const fitsBlock = (offset: number) =>
    height - offset >= viewport.offsetHeight + 2 * gaps.vertical;

  let inline = 0;
  let block = 0;
  const elements = [...panels.flatMap((layer) => layer.getElements()), ...extraPanels];
  for (const el of elements) {
    if (!el?.isConnected) continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    // A centered position has no side: a panel counts when it covers the middle of the window.
    const onSide = centered
      ? box.left <= width / 2 && box.right >= width / 2
      : right
        ? box.right >= width - EDGE_GAP
        : box.left <= EDGE_GAP;
    const onEdge = top ? box.top <= EDGE_GAP : box.bottom >= height - EDGE_GAP;
    if (!onSide || !onEdge) continue;
    const blockOffset = top ? box.bottom : height - box.top;
    if (centered) {
      if (fitsBlock(blockOffset)) block = Math.max(block, blockOffset);
      continue;
    }
    const inlineOffset = right ? width - box.left : box.right;
    if (fitsInline(inlineOffset)) inline = Math.max(inline, inlineOffset);
    else if (fitsBlock(blockOffset)) block = Math.max(block, blockOffset);
  }
  return {
    inline: inline > 0 && fitsInline(inline) ? Math.ceil(inline) : 0,
    block: block > 0 && fitsBlock(block) ? Math.ceil(block) : 0,
  };
}

/**
 * How long a toast's text stays in the live region: long enough for screen readers to pick it up
 * (also a polite message queued behind other speech), short enough that someone browsing the
 * Notifications region later meets the text once, in the toast, not a second time in the region.
 */
const ANNOUNCEMENT_DURATION = 2000;

/** A toast's message for the live regions, composed by its container after it mounts (D13). */
interface Announcement {
  /** The dispatch it belongs to: a replacement (a new `seq`) is announced again. */
  seq: number;
  text: string;
  /** The toast's own `politeness`, else `assertive` for `error` toasts and `polite` for the rest. */
  politeness: Politeness;
}

/**
 * One toast's message in a live region. It is added when the toast is shown (at dispatch, or when
 * a waiting toast appears; a replacement remounts it, so it is read again) and removed after
 * {@link ANNOUNCEMENT_DURATION} or with the toast. Removal is not announced (`aria-relevant` stays
 * at its default, additions and text).
 */
function LiveMessage({ text }: { text: string }) {
  const [present, setPresent] = React.useState(true);
  React.useEffect(() => {
    const handle = setTimeout(() => setPresent(false), ANNOUNCEMENT_DURATION);
    return () => clearTimeout(handle);
  }, []);
  return present ? <div>{text}</div> : null;
}
LiveMessage.displayName = 'LiveMessage';

interface ToastContainerProps {
  entry: ToastEntry;
  timers: ToastTimers;
  onDismiss: (id: string, reason: ToastDismissReason) => void;
  onExited: (id: string) => void;
  getFocusFallback: (from: HTMLElement | null) => HTMLElement | null;
  announce: (id: string, announcement: Announcement) => void;
  registerContainer: (id: string, node: HTMLElement | null) => void;
  /** The container's motion classes: the Toaster's `motion`, resolved for the stack's edge. */
  motionClassName: string;
  /** The Toaster's `slotProps.toast`, merged only when given. */
  part: SlotPart<'div'> | undefined;
}

function isTitlePart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'title' }> {
  return part.kind === 'title';
}

function isBodyPart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'body' }> {
  return part.kind === 'body';
}

function isFooterPart(
  part: ToastPartRegistration,
): part is Extract<ToastPartRegistration, { kind: 'footer' }> {
  return part.kind === 'footer';
}

/** Elements whose text runs on without a break; every other element separates its text. */
const INLINE_ELEMENTS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'cite',
  'code',
  'data',
  'dfn',
  'em',
  'i',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
]);

/** Elements browsers never render as text. */
const NOT_TEXT_ELEMENTS = new Set(['noscript', 'script', 'style', 'template']);

/** Native elements a screen reader names by their `aria-label` rather than by their content. */
const NATIVE_NAMED_BY_LABEL = new Set(['button', 'img', 'input', 'select', 'textarea']);

/** Roles of controls and images, which are named by their `aria-label` rather than by content. */
const ROLES_NAMED_BY_LABEL = new Set([
  'button',
  'checkbox',
  'combobox',
  'img',
  'link',
  'option',
  'radio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
]);

/**
 * Whether `aria-label` replaces the content of `el` (a control, a link or an image); any other
 * element, such as a labelled toolbar or group, is read through its content.
 */
function isNamedByLabel(el: Element): boolean {
  const role = el.getAttribute('role')?.trim().split(/\s+/)[0];
  if (role) return ROLES_NAMED_BY_LABEL.has(role) || role.startsWith('menuitem');
  if (el.localName === 'a') return el.hasAttribute('href');
  return NATIVE_NAMED_BY_LABEL.has(el.localName);
}

/**
 * Whether `el` is left out of the accessible text: the `hidden` attribute, `aria-hidden="true"` and
 * elements that are no text. Text hidden by a style sheet is still read: the spec defines hidden as
 * the attribute and `aria-hidden`, and reading computed styles would make the text depend on CSS.
 */
function isNotRendered(el: Element): boolean {
  return (
    el.getAttribute('aria-hidden') === 'true' ||
    el.hasAttribute('hidden') ||
    NOT_TEXT_ELEMENTS.has(el.localName)
  );
}

/**
 * The text a screen reader reads for `root`'s content (D13): text nodes, an image's `alt` and the
 * `aria-label` of a control; `aria-hidden="true"` and `hidden` subtrees, elements that are no text
 * and elements `skip` accepts are left out; whitespace is collapsed. Fluent reads the raw text
 * content instead, which includes hidden text and misses `alt` text.
 */
function getAccessibleText(root: Element | null, skip?: (el: Element) => boolean): string {
  if (!root) return '';
  const parts: string[] = [];
  const visit = (node: Node, isRoot: boolean): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (!isRoot && skip?.(el)) return;
    if (isNotRendered(el)) return;
    const label = el.getAttribute('aria-label');
    if (label && isNamedByLabel(el)) {
      parts.push(` ${label} `);
      return;
    }
    if (el.localName === 'img') {
      parts.push(` ${el.getAttribute('alt') ?? ''} `);
      return;
    }
    const separate = !INLINE_ELEMENTS.has(el.localName);
    if (separate) parts.push(' ');
    for (const child of Array.from(el.childNodes)) visit(child, false);
    if (separate) parts.push(' ');
  };
  visit(root, true);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * The accessible text of each child of `root` on its own, so adjacent actions that a flex row lays
 * out side by side (two links, two span-rooted buttons) are not read as one word.
 */
function getChildTexts(root: Element | null): string[] {
  if (!root || isNotRendered(root)) return [];
  return Array.from(root.childNodes, (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    return node.nodeType === Node.ELEMENT_NODE ? getAccessibleText(node as Element) : '';
  }).filter(Boolean);
}

/**
 * A toast's announced text after its severity (D13): the title, the body (its subtitle included),
 * then the labels of its actions (the title's `action` and the footer, never the Dismiss button),
 * each action on its own. Content without a title or body part is read whole, without the severity
 * texts.
 */
function composeToastText(
  container: HTMLElement,
  parts: readonly ToastPartRegistration[],
  toast: ToastRegistration | null,
  ownStatusTextId: string,
): string {
  const title = parts.find(isTitlePart);
  const body = parts.find(isBodyPart);
  if (!title && !body) {
    const dismissButton = toast?.getDismissButton() ?? null;
    return getAccessibleText(
      container,
      (el) =>
        el === dismissButton ||
        (el.id !== '' && (el.id === ownStatusTextId || el.id === toast?.statusTextId)),
    );
  }
  const label = title?.getLabel() ?? null;
  // The title row without its text: the `action` slot, whose children are the actions.
  const row = title?.getRow() ?? null;
  const titleActions = row
    ? Array.from(row.children)
        .filter((child) => child !== label)
        .flatMap((slot) => getChildTexts(slot))
    : [];
  return [
    getAccessibleText(label),
    getAccessibleText(body?.getElement() ?? null),
    ...titleActions,
    ...parts.filter(isFooterPart).flatMap((footer) => getChildTexts(footer.getElement())),
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * One toast of the Toaster (D10): a `role="group"` container, focusable by script (no Tab stop),
 * named by the toast's severity text and title and described by its body while a Toast inside
 * has registered them (so no id reference dangles). It provides the per-toast context, pauses the
 * timers and keeps focus when the toast goes. The container is the presence element and a
 * one-cell grid, whose motion opens and closes the track around the content element, its only
 * child (0.15).
 */
function ToastContainer({
  entry,
  timers,
  onDismiss,
  onExited,
  getFocusFallback,
  announce,
  registerContainer,
  motionClassName,
  part,
}: ToastContainerProps) {
  const { id, dismissed } = entry;
  // Mounted through the presence core (D29): a dismissed toast exits, `inert`, and is removed when
  // its exit ends (at once without motion); dispatching its id again revives it.
  const {
    isMounted,
    ref: presenceRef,
    presenceProps,
  } = usePresence(!dismissed, {
    appear: true,
    onExited: () => onExited(id),
  });
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // The last element, for the focus fallback, which may run after the container has unmounted.
  const lastElementRef = React.useRef<HTMLDivElement | null>(null);
  const attach = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (node) lastElementRef.current = node;
      registerContainer(id, node);
    },
    [id, registerContainer],
  );
  // The part's ref goes beside the registration and the presence core's.
  const mergedRef = useMergedRefs<HTMLDivElement>(attach, presenceRef, part?.ref);
  // Focus leaves a dismissed toast in its dismissing commit: `enabled` flipping to `false` moves it
  // in the layout phase, while the inert node is still there; a toast removed with the Toaster
  // moves it after the unmount.
  usePreserveFocus(containerRef, () => getFocusFallback(lastElementRef.current), {
    enabled: !dismissed,
  });
  const titleId = useId('wave-toast-title');
  const ownStatusTextId = useId('wave-toast-status');

  // The registrations of the parts and of the Toast inside, whose layout effects run before this
  // component's: in state for the name and description, in refs for reads after mount.
  const [parts, setParts] = React.useState<readonly ToastPartRegistration[]>([]);
  const partsRef = React.useRef<readonly ToastPartRegistration[]>([]);
  const registerPart = React.useCallback((part: ToastPartRegistration) => {
    partsRef.current = [...partsRef.current, part];
    setParts(partsRef.current);
    return () => {
      partsRef.current = partsRef.current.filter((item) => item !== part);
      setParts(partsRef.current);
    };
  }, []);
  const [toast, setToast] = React.useState<ToastRegistration | null>(null);
  const toastRef = React.useRef<ToastRegistration | null>(null);
  const registerToast = React.useCallback((registration: ToastRegistration) => {
    toastRef.current = registration;
    setToast(registration);
    return () => {
      if (toastRef.current !== registration) return;
      toastRef.current = null;
      setToast(null);
    };
  }, []);

  // `Toast.Close` and the Dismiss button: the Toast's `onDismiss`, then the dismissal (D9, D11).
  const dismiss = useEventCallback(() => {
    toastRef.current?.onDismiss?.();
    onDismiss(id, 'close');
  });
  const context = React.useMemo<ToastContextValue>(
    () => ({ titleId, dismiss, registerPart, registerToast }),
    [titleId, dismiss, registerPart, registerToast],
  );

  const titlePart = parts.find(isTitlePart);
  const bodyPart = parts.find(isBodyPart);
  // Content without a Toast (D10): a visually hidden severity text from the dispatch options,
  // first in the container, while no Toast has registered its own.
  const ownSeverityLabel =
    entry.form === 'content' && toast === null
      ? getStatusLabel(entry.options.status ?? 'info', entry.options.statusLabel)
      : '';
  const severityId = toast ? toast.statusTextId : ownSeverityLabel ? ownStatusTextId : undefined;
  // The timer of each dispatch (D12), started once the content has mounted (its registrations ran
  // first): the dispatch's `timeout`, else none for a toast with an action — people using a screen
  // reader, a switch or voice control need time to reach it — else 5000 ms.
  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (entry.dismissed || !node) return;
    const timeout =
      entry.options.timeout ?? (hasAction(node, toastRef.current) ? 0 : DEFAULT_TIMEOUT);
    timers.start(entry.id, entry.timerSeq, timeout, entry.options);
  }, [entry, timers]);

  // What screen readers hear (D13), once per dispatch after the content has mounted: the severity
  // text of the rendered Toast (else the dispatch options'), then `announcement` or the text the
  // toast renders; `error` is assertive. `toast` re-runs it for a Toast that registers after this
  // commit (content that renders it later); `announce` drops a repeat of the same message.
  React.useLayoutEffect(() => {
    const node = containerRef.current;
    if (entry.dismissed || !node) return;
    const registered = toastRef.current;
    const status = registered?.status ?? entry.options.status ?? 'info';
    const label = registered
      ? registered.statusLabel
      : getStatusLabel(status, entry.options.statusLabel);
    const text =
      entry.form === 'content' && entry.options.announcement !== undefined
        ? entry.options.announcement
        : composeToastText(node, partsRef.current, registered, ownStatusTextId);
    announce(entry.id, {
      seq: entry.seq,
      text: [label, text].filter(Boolean).join(' '),
      politeness:
        entry.options.politeness === 'assertive' || entry.options.politeness === 'polite'
          ? entry.options.politeness
          : status === 'error'
            ? 'assertive'
            : 'polite',
    });
  }, [entry, announce, ownStatusTextId, toast]);

  // A rendered Toast's severity wins over the dispatch options' (D12); an explicit, different
  // `status` in the options warns once. Read from the ref, not the `toast` state, inside the
  // effect: replacing a registered Toast with content that renders none (a replacement by
  // `toastId`) unregisters it by clearing the ref synchronously, while `setToast(null)` only lands
  // on a later render — depending on the state would fire this effect once against the
  // just-unregistered Toast's stale status. `toast` still triggers the effect (without being read
  // directly), so it also re-runs when a Toast registers after this commit (content that renders
  // its Toast later, inside the consumer's own `<Suspense>`) or changes its own `status` without a
  // new dispatch; `entry` alone would never trigger a re-check for either.
  const optionStatus = entry.form === 'content' ? entry.options.status : undefined;
  React.useEffect(() => {
    const toastStatus = toastRef.current?.status;
    if (optionStatus === undefined || toastStatus === undefined || optionStatus === toastStatus) {
      return;
    }
    warnOnce(
      'Toaster:status-conflict',
      `Toaster: the dispatched Toast has status "${toastStatus}" but the dispatch options pass "${optionStatus}"; the Toast's status is used. Remove \`status\` from the options.`,
    );
  }, [entry, optionStatus, toast]);
  // Delete or Backspace on the container or inside it dismisses the toast (D14; Backspace is the
  // delete key of Mac keyboards), except in an editable field and for a key pressed in a portal
  // opened from the toast (its target is outside the container).
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (event.defaultPrevented || !isOwnEvent(event) || isEditableTarget(event.target)) return;
    event.preventDefault();
    onDismiss(id, 'keyboard');
  };

  if (!isMounted) return null;
  const labelledBy = joinIds(severityId, titlePart?.id);
  const className = wcn(
    toasterClassNames.toast,
    'wave:rounded',
    focusRing,
    toastStructure,
    motionClassName,
  );
  return (
    <div
      role="group"
      tabIndex={-1}
      data-wave-toast=""
      aria-labelledby={labelledBy}
      aria-describedby={bodyPart?.id}
      className={className}
      onKeyDown={handleKeyDown}
      {...(part &&
        mergeSlotProps(part, {
          className,
          locked: {
            ...TOAST_PART_LOCKS,
            'aria-labelledby': labelledBy,
            'aria-describedby': bodyPart?.id,
            onKeyDown: handleKeyDown,
          },
        }))}
      {...presenceProps}
      ref={mergedRef}
    >
      {/* The one grid item (the content may be several elements), clipped while it moves. */}
      <div className={toasterClassNames.toastContent}>
        {ownSeverityLabel ? <StatusText label={ownSeverityLabel} id={ownStatusTextId} /> : null}
        <ToastContext.Provider value={context}>
          {entry.form === 'options' ? (
            <ToastRoot
              status={entry.options.status}
              statusLabel={entry.options.statusLabel}
              title={entry.options.title}
              dismissLabel={entry.options.dismissLabel}
              appearance={entry.options.appearance}
              showDismissButton={entry.options.showDismissButton}
            >
              {entry.options.body}
            </ToastRoot>
          ) : (
            entry.content
          )}
        </ToastContext.Provider>
      </div>
    </div>
  );
}
ToastContainer.displayName = 'ToastContainer';

/**
 * Provides {@link useToastController} to its children and shows the dispatched toasts.
 *
 * - **Wrap the app** in `<Toaster>`; components below it call `useToastController()`, and code
 *   outside components (a query-cache callback, a server-event handler) dispatches through a
 *   handle from `createToaster()` bound with `toaster`, which also runs several Toasters side by
 *   side (one handle each).
 * - **Two ways to dispatch:** `dispatchToast(<Toast>…</Toast>)` shows your content, usually a
 *   `Toast` with `Toast.Title`, `Toast.Body` and `Toast.Footer`; `dispatchToast({ title, body })`
 *   builds a toast from text. Both return the toast's id. Content without a `Toast` takes its
 *   severity from the options (`status`, `statusLabel`) and shows no Dismiss button (add a
 *   `Toast.Close`).
 * - The toasts render in a portal (the `toast` layer, above dialogs) inside a region labelled
 *   "Notifications" (override with `aria-label`). The region is allow-listed for modals
 *   (`data-wave-focus-trap-allow`): it stays reachable by Tab and exposed to assistive technology
 *   while a Dialog or Drawer is open, and clicking a toast never dismisses the overlay below.
 * - Two permanent, visually hidden live regions (polite, and assertive for `error`) announce every
 *   toast once per dispatch, read from what it renders after it mounts: the severity text, then
 *   the title, the body and the labels of its actions (never the Dismiss button) or, instead of
 *   those, the dispatch's `announcement`.
 *   The toasts themselves are not live regions. Each message stays in its live region for 2
 *   seconds (or until its toast goes), so browsing the region later meets the text only once.
 *   A toast's `politeness` overrides the status default, and the `announce` prop sends every
 *   message to your own announcer instead of these regions.
 * - **Where:** `position` is a corner or, with `top` and `bottom`, the middle of an edge;
 *   `offset` sets the distance from the edges in pixels; a toast dispatched with its own
 *   `position` stacks there, in the same region. `inline` renders the region where the Toaster is
 *   instead of in a portal.
 * - **Dispatch options:** `politeness`, `position`, `priority` (the order the toasts that wait
 *   beyond `limit` appear in), `pauseOnHover`, `pauseOnWindowBlur` (both on by default, and focus
 *   in the region always pauses) and `onStatusChange` (`queued`, `visible`, `dismissed`,
 *   `unmounted`, with the reason of a dismissal). The controller also has `updateToast` (merge
 *   new options or content into a toast), `pauseToast` and `playToast`.
 * - While an open panel covers the toasts' corner (a modal or non-modal Drawer on the same side,
 *   or at the bottom), the toasts move beside it, or above a bottom one (below it for top toasts),
 *   so they never hide its focused controls (WCAG 2.4.11), and they stay there while the panel
 *   slides out. Without room there (a full-width panel on a narrow screen) they keep their
 *   corner. Toasts with a `position` of their own do not move aside.
 * - Timers pause while the pointer or focus is anywhere in the toast region, a menu or popover
 *   opened from a toast included (someone reading or operating one toast is reading the stack),
 *   and while the window is in the background (it has lost focus, or the page is not shown, as in
 *   a background tab). When a toast that contains focus goes away, focus moves to the next toast
 *   (or the previous one), or back to the element that was focused before focus entered the
 *   toasts once no toast is left.
 * - **Keyboard:** `shortcuts.focus` names a key press that moves focus to the newest toast (use a
 *   modifier, WCAG 2.1.4); Escape in the toast region dismisses every toast and returns focus to
 *   where it was before focus entered the toasts (a tooltip or menu of a toast closes first, and a
 *   Dialog below stays open); Delete or Backspace dismisses the focused toast.
 * - Each toast's dismiss button is named "Dismiss"; pass `dismissLabel` to `dispatchToast` for
 *   other languages.
 * - `limit` caps how many toasts show at once: the others wait in a queue, in dispatch order,
 *   unannounced and without a running timer, and appear as shown toasts go.
 *   `dismissAllToasts()` removes every toast, shown and queued.
 * - **Motion:** a toast slides and fades in from the stack's edge while its place opens; a
 *   dismissed one fades out, then its place closes and the others glide together. It stays in
 *   the document, `inert`, until then; at once under reduced motion. `motion` replaces or turns
 *   off the motion of every toast.
 *
 * @example
 * <Toaster position="bottom-end" limit={3}>
 *   <App />
 * </Toaster>
 */
export const Toaster = ({
  position: positionProp = 'bottom-end',
  limit: limitProp,
  offset,
  inline = false,
  announce: announceProp,
  shortcuts,
  toaster: handle,
  motion,
  slotProps,
  className,
  style,
  children,
  onFocus,
  onBlur,
  onKeyDown,
  onPointerEnter,
  onPointerLeave,
  onPointerOver,
  ref,
  ...rest
}: ToasterProps) => {
  // A position outside the union (untyped code) is the default.
  const position: ToastPosition = Object.hasOwn(positionClasses, positionProp)
    ? positionProp
    : 'bottom-end';
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  // Each toast's message, written by its container after the toast mounts (a layout effect), so
  // the severity is the rendered Toast's and the text what the toast renders.
  const [announcements, setAnnouncements] = React.useState<ReadonlyMap<string, Announcement>>(
    () => new Map(),
  );
  // The app's own announcer (`announce`) is called once per message: what it was last given.
  const customAnnounce = useEventCallback(announceProp);
  const hasCustomAnnounce = announceProp !== undefined;
  const handedOverRef = React.useRef(new Map<string, Announcement>());
  const announce = useEventCallback((id: string, announcement: Announcement) => {
    setAnnouncements((prev) => {
      const current = prev.get(id);
      if (
        current &&
        current.seq === announcement.seq &&
        current.text === announcement.text &&
        current.politeness === announcement.politeness
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, announcement);
      return next;
    });
    const handedOver = handedOverRef.current.get(id);
    if (
      announceProp === undefined ||
      !announcement.text ||
      (handedOver &&
        handedOver.seq === announcement.seq &&
        handedOver.text === announcement.text &&
        handedOver.politeness === announcement.politeness)
    ) {
      return;
    }
    handedOverRef.current.set(id, announcement);
    customAnnounce({
      toastId: id,
      message: announcement.text,
      politeness: announcement.politeness,
    });
  });
  const limit = resolveLimit(limitProp);
  // The distances of the toasts from the window edges, and the position of the toasts that use the
  // Toaster's own (D14: every container's motion slides from the edge its stack sits on).
  const offsets = resolveOffset(offset);
  const horizontalGap = offsets.horizontal ?? EDGE_GAP;
  const verticalGap = offsets.vertical ?? EDGE_GAP;
  const topMotionClassName = useMotionClasses(motion, toastMotion.top);
  const bottomMotionClassName = useMotionClasses(motion, toastMotion.bottom);
  // Waiting toasts are shown here, during render, with the current limit (adjust state while
  // rendering, C-HOOKS): every path that frees a place or raises the limit promotes them, and a
  // lowered limit never hides a shown toast. `promoteQueued` returns the same array once settled.
  const settled = promoteQueued(toasts, limit);
  if (settled !== toasts) setToasts(settled);
  const shownToasts = settled.filter((toast) => toast.shown);
  // The latest entries, for the callbacks and listeners that must not close over a render's.
  const toastsRef = React.useRef<ToastEntry[]>(settled);
  React.useLayoutEffect(() => {
    toastsRef.current = settled;
  });

  // Why each toast was dismissed, for `onStatusChange`: written where the dismissal is requested.
  const reasonsRef = React.useRef(new Map<string, ToastDismissReason>());
  // `onStatusChange` (D-lifecycle): after each commit, every toast whose status differs from the one
  // last reported is reported (`queued`, `visible`, `dismissed`), and so is one that left the list
  // (`unmounted`, after a `dismissed` it never had a place to show). The record outlives StrictMode's
  // simulated remount, so nothing is reported twice.
  const reportedRef = React.useRef(
    new Map<string, { status: ToastStatus; handler: ToastStatusChangeHandler | undefined }>(),
  );
  React.useEffect(() => {
    const reported = reportedRef.current;
    const report = (
      id: string,
      status: ToastStatus,
      handler: ToastStatusChangeHandler | undefined,
    ) => {
      handler?.(status, {
        toastId: id,
        reason: status === 'dismissed' ? reasonsRef.current.get(id) : undefined,
      });
    };
    const present = new Set<string>();
    for (const toast of settled) {
      present.add(toast.id);
      const status: ToastStatus = !toast.shown
        ? 'queued'
        : toast.dismissed
          ? 'dismissed'
          : 'visible';
      const handler = toast.options.onStatusChange;
      const previous = reported.get(toast.id);
      reported.set(toast.id, { status, handler });
      if (previous?.status !== status) report(toast.id, status, handler);
    }
    for (const [id, record] of Array.from(reported)) {
      if (present.has(id)) continue;
      reported.delete(id);
      if (record.status !== 'dismissed') report(id, 'dismissed', record.handler);
      report(id, 'unmounted', record.handler);
      reasonsRef.current.delete(id);
      handedOverRef.current.delete(id);
    }
  }, [settled]);

  // Development diagnostics (C-DEV): emitted from an effect, once per page.
  React.useEffect(() => {
    if (limitProp !== undefined && !(limitProp >= 1)) {
      warnOnce(
        'Toaster:limit',
        `Toaster: \`limit\` must be 1 or more (got ${String(limitProp)}); it counts as 1.`,
      );
    }
  }, [limitProp]);
  const prefix = useId('toast');
  const counterRef = React.useRef(0);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRefs = useMergedRefs(ref, viewportRef);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const dir = useDirection();

  // Beside or above an open panel at the toasts' corner (a Drawer), not over its controls. Measured
  // when a layer opens or closes (synchronously in its layout effect, before paint), on resize,
  // after a transition or animation (a panel that slides in reaches its place only then), when the
  // region's own size changes (the stack's height decides whether it fits above a panel), and when
  // an open panel changes its size, or its classes or style (an open Drawer whose `size` or
  // `position` changes: a move without a resize is no ResizeObserver entry).
  const [panelOffsets, setPanelOffsets] = React.useState<PanelOffsets>(NO_PANEL_OFFSETS);
  React.useLayoutEffect(() => {
    // The region and the panels are observed from `update`, so a region that renders after this
    // effect (its portal waits for hydration) is observed from the next measure: a layer opening
    // runs one. Only elements not observed yet are added (observing one again would report it).
    let observer: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let observed: HTMLElement | null = null;
    let observedPanels = new Set<HTMLElement>();
    // A panel whose layer has closed but that still slides out (a Drawer's exit): the toasts keep
    // clear of it until it is gone, instead of moving back over it as the exit starts.
    let exiting = new Set<HTMLElement>();
    const observePanels = () => {
      const panels = getPanelElements();
      exiting = new Set(
        [...observedPanels].filter(
          (el) =>
            !panels.has(el) && el.isConnected && el.getAttribute('data-presence') === 'exiting',
        ),
      );
      // The exiting panels stay observed, so the end of their exit measures again.
      const next = new Set([...panels, ...exiting]);
      for (const el of observedPanels) if (!next.has(el)) observer?.unobserve(el);
      for (const el of next) if (!observedPanels.has(el)) observer?.observe(el);
      const changed =
        next.size !== observedPanels.size || [...next].some((el) => !observedPanels.has(el));
      observedPanels = next;
      if (!changed || !mutationObserver) return;
      mutationObserver.disconnect();
      for (const el of next) {
        mutationObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      }
    };
    const update = () => {
      const viewport = viewportRef.current;
      if (observer && viewport !== observed) {
        if (observed) observer.unobserve(observed);
        if (viewport) observer.observe(viewport);
        observed = viewport;
      }
      observePanels();
      const next = viewport
        ? getPanelOffsets(
            viewport,
            position,
            { horizontal: horizontalGap, vertical: verticalGap },
            exiting,
          )
        : NO_PANEL_OFFSETS;
      setPanelOffsets((current) =>
        current.inline === next.inline && current.block === next.block ? current : next,
      );
    };
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(() => update());
    if (typeof MutationObserver !== 'undefined') mutationObserver = new MutationObserver(update);
    update();
    const unsubscribe = subscribeLayers(update);
    window.addEventListener('resize', update);
    document.addEventListener('transitionend', update, true);
    document.addEventListener('animationend', update, true);
    return () => {
      unsubscribe();
      observer?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', update);
      document.removeEventListener('transitionend', update, true);
      document.removeEventListener('animationend', update, true);
    };
  }, [position, dir, horizontalGap, verticalGap]);

  const expire = useEventCallback((id: string) => {
    reasonsRef.current.set(id, 'timeout');
    setToasts((prev) => markDismissed(prev, id));
  });
  const [timers] = React.useState(() => createToastTimers(expire));

  // Timers run only while mounted (StrictMode's simulated unmount suspends and resumes them) and
  // pause while the window is in the background: after the window loses focus, and while the page
  // is not shown. The page visibility is read at mount too, so a Toaster that mounts in a
  // background tab waits until the tab is shown. (Focus is not read at mount: `hasFocus()` is also
  // false in an embedded frame nobody clicked yet and in test DOMs.)
  React.useEffect(() => {
    const doc = document;
    let blurred = false;
    const update = () => timers.setInBackground(blurred || doc.visibilityState === 'hidden');
    // Only the window's own blur/focus (element focus events do not bubble to a bubble-phase
    // window listener; anything targeted at a node is ignored).
    const handleBlur = (event: FocusEvent) => {
      if (event.target instanceof Node) return;
      blurred = true;
      update();
    };
    const handleFocus = (event: FocusEvent) => {
      if (event.target instanceof Node) return;
      blurred = false;
      update();
    };
    update();
    timers.setSuspended(false);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    doc.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      doc.removeEventListener('visibilitychange', update);
      timers.setSuspended(true);
    };
  }, [timers]);

  // A new toast waits until the render promotes it; a replaced one keeps its place and whether it
  // is shown (a waiting toast keeps waiting with the new content), and an exiting one is revived.
  const dispatchToast = React.useCallback<ToastController['dispatchToast']>(
    (first: React.ReactNode | ToastOptions, second?: ToastDispatchOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const dispatched: DispatchedToast = isToastOptions(first)
        ? { form: 'options', options: first }
        : { form: 'content', content: first, options: second ?? {} };
      const id = dispatched.options.toastId ?? `${prefix}-${seq}`;
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        const shown = index === -1 ? false : prev[index].shown;
        const entry: ToastEntry = {
          ...dispatched,
          id,
          seq,
          timerSeq: seq,
          priority: resolvePriority(dispatched.options.priority),
          shown,
          dismissed: false,
        };
        if (index === -1) return [...prev, entry];
        const next = prev.slice();
        next[index] = entry;
        return next;
      });
      return id;
    },
    [prefix],
  );

  // A dismissal, with its reason for `onStatusChange`.
  const requestDismiss = React.useCallback(
    (id: string, reason: ToastDismissReason) => {
      reasonsRef.current.set(id, reason);
      timers.remove(id);
      setToasts((prev) => markDismissed(prev, id));
    },
    [timers],
  );
  const dismissToast = React.useCallback(
    (id: string) => requestDismiss(id, 'controller'),
    [requestDismiss],
  );

  const requestDismissAll = React.useCallback(
    (reason: ToastDismissReason) => {
      for (const toast of toastsRef.current) reasonsRef.current.set(toast.id, reason);
      timers.clear();
      setToasts((prev) => markAllDismissed(prev));
    },
    [timers],
  );
  const dismissAllToasts = React.useCallback(
    () => requestDismissAll('controller'),
    [requestDismissAll],
  );

  // Merges the options (and content) of an update into the toast it names; a toast whose timeout
  // or pause options change restarts its timer (a new `timerSeq`), and its text is announced
  // again only if it changed (the container's announcement is keyed by it).
  const updateToast = React.useCallback((update: ToastUpdate) => {
    if (typeof update?.toastId !== 'string') return;
    const current = toastsRef.current.find((toast) => toast.id === update.toastId);
    if (current && !current.dismissed) {
      if (current.form === 'options' && update.content !== undefined) {
        warnOnce(
          'Toaster:update-content',
          'Toaster: `updateToast` was given `content` for a toast built from text options; it is ignored. Update `title` and `body` instead.',
        );
      }
      if (current.form === 'content' && (update.title !== undefined || update.body !== undefined)) {
        warnOnce(
          'Toaster:update-text',
          'Toaster: `updateToast` was given `title` or `body` for a toast dispatched with content; they are ignored. Update `content` instead.',
        );
      }
    }
    counterRef.current += 1;
    const timerSeq = counterRef.current;
    setToasts((prev) => mergeUpdate(prev, update, timerSeq));
  }, []);
  const pauseToast = React.useCallback((id: string) => timers.pause(id), [timers]);
  const playToast = React.useCallback((id: string) => timers.play(id), [timers]);

  // The exit of a dismissed toast ended: remove it and its message (one revived meanwhile stays).
  const removeExited = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.some((t) => t.id === id && t.dismissed)
        ? prev.filter((t) => !(t.id === id && t.dismissed))
        : prev,
    );
    setAnnouncements((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const controller = React.useMemo<ToastController>(
    () => ({
      dispatchToast,
      dismissToast,
      dismissAllToasts,
      updateToast,
      pauseToast,
      playToast,
    }),
    [dispatchToast, dismissToast, dismissAllToasts, updateToast, pauseToast, playToast],
  );

  // A handle from createToaster() (P3-08, D33): bound in a layout effect, so dispatches that waited
  // in its queue show before the first paint, and unbound on unmount (StrictMode binds again and
  // finds the queue taken). A handle bound to another Toaster stays there.
  const [handleOwner] = React.useState(() => ({}));
  React.useLayoutEffect(() => {
    if (!handle) return undefined;
    const binding = bindToasterHandle(handle, handleOwner, controller);
    if (binding.status === 'bound') return binding.unbind;
    if (binding.status === 'taken') {
      warnOnce(
        'Toaster:handle-bound',
        'Toaster: this handle is already bound to another Toaster; a handle binds one Toaster. Create one handle per Toaster.',
      );
    } else {
      warnOnce(
        'Toaster:handle-unknown',
        'Toaster: `toaster` is not a handle from createToaster(), so nothing is bound. Pass the value createToaster() returns.',
      );
    }
    return undefined;
  }, [handle, handleOwner, controller]);

  // Where focus goes when the focused toast is dismissed (in its dismissing commit) or removed with
  // the Toaster: the next toast that is not exiting, else the previous one — that container itself
  // when focus was on the dismissed container (after Delete or the shortcut), else its first
  // tabbable element — else the element focused before focus entered the toasts. Runs possibly
  // after the whole Toaster is gone: never throws.
  const getFocusFallback = React.useCallback((from: HTMLElement | null): HTMLElement | null => {
    const viewport = viewportRef.current;
    const containers = viewport
      ? Array.from(viewport.querySelectorAll<HTMLElement>('[data-wave-toast]'))
      : [];
    const onContainer = !!from && from.ownerDocument.activeElement === from;
    const index = from ? containers.indexOf(from) : -1;
    const isLive = (el: HTMLElement) =>
      el !== from && el.isConnected && el.getAttribute('data-presence') !== 'exiting';
    const next = containers.slice(index + 1).find(isLive);
    const previous = index > 0 ? containers.slice(0, index).reverse().find(isLive) : undefined;
    for (const candidate of [next, previous]) {
      if (!candidate) continue;
      const target = onContainer ? candidate : getFirstTabbable(candidate);
      if (target) return target;
    }
    // Focus leaves the toasts here without a blur of the viewport (the focused node is inert or
    // gone), so the element is forgotten as it is used: a toast focused later from nowhere does not
    // send focus back to it.
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    return previousFocus?.isConnected ? previousFocus : null;
  }, []);

  // Focus can fall to the page body without a blur reaching the viewport: the node that had it
  // (a layer opened from a toast, a button replaced by text) is gone. A move to a real element
  // always sends blur and focus through React, so only a fall to the body is reconciled, whenever
  // the toasts or the layers change: the 'focus' pause ends, and while the region still held it,
  // focus returns to the remembered origin, as it does when a focused toast goes. The origin is
  // forgotten either way.
  const reconcileFocus = useEventCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const doc = viewport.ownerDocument;
    if (doc.activeElement && doc.activeElement !== doc.body) return;
    const held = timers.isPaused('focus');
    timers.setPaused('focus', false);
    const origin = previousFocusRef.current;
    previousFocusRef.current = null;
    if (held && origin && isConnectedAndFocusable(origin)) origin.focus({ preventScroll: true });
  });
  React.useLayoutEffect(() => {
    reconcileFocus();
  }, [settled, reconcileFocus]);
  // A layer's cleanup can notify while its focused node is still connected: look a tick later.
  React.useLayoutEffect(
    () => subscribeLayers(() => queueMicrotask(reconcileFocus)),
    [reconcileFocus],
  );

  // The pointer can leave the region without a leave reaching it: when the node under the pointer
  // is removed (a hovered toast dismissed, timed out or pushed out by the limit, a menu item that
  // closed its menu), the browser's next boundary event is a `pointerover` on the element now under
  // the pointer with no related target, from which React synthesises no leave. So the 'hover' pause
  // also ends on any `pointerover` that did not pass through the region in React's tree, which
  // takes in a portal opened from a toast (D14, as the enter and leave handlers do). The DOM and
  // layer check after it (`isInToastRegion`) is defensive: it keeps the pause for a layer anchored
  // in a toast but rendered outside the Toaster's tree. A document listener in the bubble phase, so
  // React's own listeners (on the root and portal containers, below the document) have marked the
  // event first.
  const regionPointerOverRef = React.useRef<Event | null>(null);
  React.useEffect(() => {
    const handlePointerOver = (event: Event) => {
      const fromRegion = regionPointerOverRef.current === event;
      regionPointerOverRef.current = null;
      if (fromRegion || !timers.isPaused('hover')) return;
      const viewport = viewportRef.current;
      if (viewport && event.target instanceof Node && isInToastRegion(viewport, event.target)) {
        return;
      }
      timers.setPaused('hover', false);
    };
    document.addEventListener('pointerover', handlePointerOver);
    return () => document.removeEventListener('pointerover', handlePointerOver);
  }, [timers]);

  // Every container element, for the shortcut's document listener.
  const containersRef = React.useRef(new Map<string, HTMLElement>());
  const registerContainer = React.useCallback((id: string, node: HTMLElement | null) => {
    if (node) containersRef.current.set(id, node);
    else containersRef.current.delete(id);
  }, []);

  // The focus shortcut (D14): a document listener, so the key works wherever focus is. It focuses
  // the container of the newest toast that is shown and not dismissed and remembers where focus
  // was (unless it is already in the toasts).
  const hasFocusShortcut = typeof shortcuts?.focus === 'function';
  const handleShortcut = useEventCallback((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || !shortcuts?.focus?.(event)) return;
    const newest = findNewestToast(toastsRef.current);
    const target = newest ? containersRef.current.get(newest.id) : undefined;
    if (!target?.isConnected) return;
    event.preventDefault();
    const viewport = viewportRef.current;
    const active = target.ownerDocument.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== target.ownerDocument.body &&
      !(viewport && isInToastRegion(viewport, active))
    ) {
      previousFocusRef.current = active;
    }
    target.focus({ preventScroll: false });
  });
  React.useEffect(() => {
    if (!hasFocusShortcut) return undefined;
    const listener = (event: KeyboardEvent) => handleShortcut(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [hasFocusShortcut, handleShortcut]);

  // Focus entering the toast region from an element outside it: return there when the focused
  // toast goes and after Escape. Focus arriving with no related target keeps what is remembered
  // (the Toaster's own move to the next toast, the window regaining focus). Moves inside the region
  // — a layer opened from a toast included — change nothing, and an element that cannot take focus
  // (inside a closing, inert surface) is never remembered.
  const rememberFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const from = event.relatedTarget;
    if (!(from instanceof HTMLElement) || !isConnectedAndFocusable(from)) return;
    if (isInToastRegion(event.currentTarget, from)) return;
    previousFocusRef.current = from;
  };

  // Focus leaving the region for another element or for `<body>` forgets the element, so a toast
  // focused again later from nowhere never sends focus back to something focused long before.
  // Kept: moves inside the region (a layer opened from a toast included), a removed or dismissed
  // toast (its node is gone or inert; the Toaster moves focus itself) and the window losing focus
  // (the element keeps document focus while another window is active).
  const forgetFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const to = event.relatedTarget;
    if (to instanceof Node && isInToastRegion(viewport, to)) return;
    // A blur from inside a dismissed (exiting, inert) toast: the Toaster has moved focus itself,
    // or a browser's focus fix-up blurs the inert subtree later.
    if (event.target.closest('[data-wave-toast][data-presence="exiting"]')) return;
    if (to === null) {
      const from = event.target;
      if (!from.isConnected) return;
      const active = from.ownerDocument.activeElement;
      if (active && isInToastRegion(viewport, active)) return;
    }
    previousFocusRef.current = null;
  };

  // Escape in the toast region (D14) dismisses every toast and returns focus to where it was
  // before focus entered the toasts. Left alone: a key pressed in a portal opened from a toast
  // (its target is outside the viewport; the portal's own widget handles it) and one that an open
  // Escape-enabled layer anchored in the viewport takes first (a Tooltip on a toast's button, a
  // Menu opened from a toast). Prevented, so the dismiss-layer stack does not route it to a Dialog
  // or Drawer below (the region counts as inside every layer).
  const handleEscape = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (event.defaultPrevented || event.nativeEvent.isComposing || !isOwnEvent(event)) return;
    const viewport = event.currentTarget;
    if (getOpenLayers().some((layer) => layer.escape && viewport.contains(layer.getAnchor()))) {
      return;
    }
    event.preventDefault();
    const origin = previousFocusRef.current;
    previousFocusRef.current = null;
    if (origin?.isConnected) origin.focus({ preventScroll: true });
    requestDismissAll('escape');
  };

  // Each shown toast's message for its first 2 s, while it is not dismissed (a waiting toast is
  // announced when it appears); a replacement is a new dispatch, so it is read again.
  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  for (const toast of shownToasts) {
    if (toast.dismissed) continue;
    const announcement = announcements.get(toast.id);
    if (!announcement || announcement.seq !== toast.seq || !announcement.text) continue;
    // The app's own announcer, when given, reads the message instead of the live regions.
    if (hasCustomAnnounce) continue;
    // Keyed by the text too, so a toast whose text changes (an update) is read again.
    const message = (
      <LiveMessage key={`${announcement.seq}:${announcement.text}`} text={announcement.text} />
    );
    (announcement.politeness === 'assertive' ? assertive : polite).push(message);
  }

  // The region's inline style: its custom distances from the edges and, inline, the toast layer's
  // z-index (a portal gives that), then yours, then the room an open panel takes. Unchanged
  // (`style` itself) when none applies.
  const ownStyle: React.CSSProperties | undefined = (() => {
    const placement = offsetStyle(position, offsets);
    if (!placement && !inline) return undefined;
    return { ...placement, ...(inline && { zIndex: Z_INDEX.toast }) };
  })();
  const viewportStyle =
    panelOffsets.inline > 0 || panelOffsets.block > 0 || ownStyle
      ? ({
          ...ownStyle,
          ...style,
          ...(panelOffsets.inline > 0 && { '--wave-toaster-offset': `${panelOffsets.inline}px` }),
          ...(panelOffsets.block > 0 && {
            '--wave-toaster-offset-block': `${panelOffsets.block}px`,
          }),
        } as React.CSSProperties)
      : style;

  // The toasts that use the Toaster's own position sit in the region; those with a position of
  // their own of another place are stacked in an element of that position inside it.
  const positionOf = (toast: ToastEntry): ToastPosition => {
    const own = toast.options.position;
    return own !== undefined && Object.hasOwn(positionClasses, own) ? own : position;
  };
  const stacks = new Map<ToastPosition, ToastEntry[]>();
  const regionToasts: ToastEntry[] = [];
  for (const toast of shownToasts) {
    const toastPosition = positionOf(toast);
    if (toastPosition === position) {
      regionToasts.push(toast);
      continue;
    }
    const stack = stacks.get(toastPosition);
    if (stack) stack.push(toast);
    else stacks.set(toastPosition, [toast]);
  }
  const renderToast = (toast: ToastEntry) => (
    <ToastContainer
      key={toast.id}
      entry={toast}
      timers={timers}
      onDismiss={requestDismiss}
      onExited={removeExited}
      getFocusFallback={getFocusFallback}
      announce={announce}
      registerContainer={registerContainer}
      motionClassName={
        positionOf(toast).startsWith('top') ? topMotionClassName : bottomMotionClassName
      }
      part={slotProps?.toast}
    />
  );

  return (
    <ToasterContext.Provider value={controller}>
      {children}
      <Portal layer="toast" disabled={inline}>
        <div
          ref={viewportRefs}
          role="region"
          aria-label="Notifications"
          data-wave-focus-trap-allow=""
          data-position={position}
          {...rest}
          style={viewportStyle}
          onFocus={(event) => {
            // Bookkeeping always runs (a consumer's preventDefault() cannot cancel a focus change).
            // Focus in a portal opened from a toast arrives here too (React bubbles focus events
            // through portals) and counts as focus in the region (D14).
            onFocus?.(event);
            rememberFocusOrigin(event);
            timers.setPaused('focus', true);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            forgetFocusOrigin(event);
            const next = event.relatedTarget;
            if (next instanceof Node && isInToastRegion(event.currentTarget, next)) return;
            timers.setPaused('focus', false);
          }}
          onPointerEnter={(event) => {
            onPointerEnter?.(event);
            timers.setPaused('hover', true);
          }}
          onPointerLeave={(event) => {
            onPointerLeave?.(event);
            timers.setPaused('hover', false);
          }}
          onPointerOver={(event) => {
            // Bookkeeping always runs. A portal opened from a toast counts as the region (D14):
            // React bubbles its pointer events here too.
            onPointerOver?.(event);
            regionPointerOverRef.current = event.nativeEvent;
          }}
          onKeyDown={(event) => composeEventHandlers(onKeyDown, handleEscape)(event)}
          className={wcn(
            toasterClassNames.root,
            'wave:fixed wave:flex wave:w-80 wave:max-w-[calc(100vw-2rem)] wave:flex-col wave:gap-2',
            positionClasses[position],
            className,
          )}
        >
          {/* One message per toast for its first 2 s; not atomic, so only the added one is read. */}
          <div role="status" aria-live="polite" aria-atomic="false" className="wave:sr-only">
            {polite}
          </div>
          <div aria-live="assertive" aria-atomic="false" className="wave:sr-only">
            {assertive}
          </div>
          {/* Shown toasts, exiting ones included: getFocusFallback walks the containers in this order. */}
          {regionToasts.map(renderToast)}
          {/* The toasts that chose another position: one fixed stack for each, in the region so the
              pause, focus and keyboard handling are shared. The panel room is the region's alone. */}
          {Array.from(stacks, ([stackPosition, stacked]) => (
            <div
              key={stackPosition}
              data-position={stackPosition}
              className={wcn(
                toasterClassNames.stack,
                'wave:fixed wave:flex wave:w-80 wave:max-w-[calc(100vw-2rem)] wave:flex-col wave:gap-2',
                positionClasses[stackPosition],
              )}
              style={
                {
                  '--wave-toaster-offset': '0px',
                  '--wave-toaster-offset-block': '0px',
                  ...offsetStyle(stackPosition, offsets),
                } as React.CSSProperties
              }
            >
              {stacked.map(renderToast)}
            </div>
          ))}
        </div>
      </Portal>
    </ToasterContext.Provider>
  );
};
Toaster.displayName = 'Toaster';
