import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { toasterClassNames } from '../../lib/classNames';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { getFirstTabbable } from '../../lib/focus';
import { getOpenLayers, subscribeLayers } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import { useDirection } from '../../hooks/useDirection';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePresence } from '../../hooks/usePresence';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { Portal } from '../portal/Portal';
import { getStatusLabel } from './MessageBar.status';
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
   * waiting beyond the Toaster's `limit` does not count down) and pauses while the pointer is over
   * the toast, while focus is inside it and while the browser window is in the background (it has
   * lost focus, or the page is not shown, as in a background tab, also when the Toaster mounts
   * there). `0` (or any value that is not a positive finite number) keeps the toast until it is
   * dismissed.
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
}

/** The toast API returned by {@link useToastController}. */
export interface ToastController {
  /**
   * Shows a toast and returns its id (`options.toastId`, or a generated one). A toast with the same
   * id is replaced. Beyond the Toaster's `limit`, the toast waits in a queue until it can be shown.
   */
  dispatchToast: (options: ToastOptions) => string;
  /**
   * Dismisses the toast with this id and cancels its timer: a shown toast exits (it stays, inert,
   * until an exit motion of yours ends), a waiting one is removed. Unknown ids are ignored.
   */
  dismissToast: (id: string) => void;
  /**
   * Dismisses every toast and cancels their timers: shown toasts exit (as `dismissToast`), queued
   * ones are removed.
   */
  dismissAllToasts: () => void;
}

interface ToastEntry {
  id: string;
  options: ToastOptions;
  /** Increases with every dispatch, so a replaced toast is announced again. */
  seq: number;
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
}

/**
 * Flags the oldest waiting toasts as shown while fewer than `limit` toasts are shown and not
 * dismissed. Returns `toasts` itself when nothing changes, so the Toaster's render-time update
 * settles.
 */
function promoteQueued(toasts: ToastEntry[], limit: number): ToastEntry[] {
  let active = 0;
  let waiting = false;
  for (const toast of toasts) {
    if (!toast.shown) waiting = true;
    else if (!toast.dismissed) active += 1;
  }
  if (!waiting || active >= limit) return toasts;
  return toasts.map((toast) => {
    if (toast.shown || active >= limit) return toast;
    active += 1;
    return { ...toast, shown: true };
  });
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

/** `limit` as the Toaster applies it: whole toasts, at least 1; `undefined` means no limit. */
function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) return Infinity;
  return limit >= 1 ? Math.floor(limit) : 1;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const INERT_CONTROLLER: ToastController = {
  dispatchToast: (options) => options.toastId ?? '',
  dismissToast: () => {},
  dismissAllToasts: () => {},
};

/** The C-CONTEXT message without the `[WaveUI] ` prefix, which `reportMissingContext` adds. */
const MISSING_TOASTER_MESSAGE =
  'useToastController must be used within <Toaster>. Wrap your app (or the part of it that shows toasts) in <Toaster>: it provides the controller to its children.';

/**
 * Returns the {@link ToastController} of the enclosing `<Toaster>`: `dispatchToast(options)` shows
 * a toast and returns its id, `dismissToast(id)` removes it, `dismissAllToasts()` removes every
 * toast.
 *
 * Must be called inside `<Toaster>`, which provides the controller to its children — wrap the app
 * (or the part of it that shows toasts) in `<Toaster>`; a sibling `<Toaster />` does not work.
 * Outside a Toaster it throws in development; in production it logs an error (once) and returns a
 * controller that does nothing.
 *
 * @example
 * function SaveButton() {
 *   const { dispatchToast } = useToastController();
 *   return <Button onClick={() => dispatchToast({ status: 'success', title: 'Saved' })}>Save</Button>;
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
}

/**
 * Auto-dismiss timers of one Toaster. A timer runs only while its toast is neither hovered nor
 * focused, the window is in the foreground and the Toaster is mounted; otherwise it is suspended
 * and keeps its remaining time. Every method is called from event handlers or effects, never
 * during render.
 */
interface ToastTimers {
  /**
   * Starts the timer of the shown toast `id` for its dispatch `seq`, once: a call with the `seq`
   * already started does nothing, a new `seq` (the toast was replaced) restarts it. A timeout that
   * is not a positive finite number means none. The pause state of `id` is kept: a replaced toast
   * that is hovered or focused stays paused.
   */
  start(id: string, seq: number, timeout: number): void;
  /** Cancels the timer of `id` and forgets its pause state. */
  remove(id: string): void;
  /** Cancels every timer and forgets every pause state. */
  clear(): void;
  pause(id: string, reason: PauseReason): void;
  resume(id: string, reason: PauseReason): void;
  /** `true` while the window has lost focus or the page is not shown (a background tab). */
  setInBackground(inBackground: boolean): void;
  /** `true` while the Toaster is unmounted (including StrictMode's simulated unmount). */
  setSuspended(suspended: boolean): void;
}

function createToastTimers(onExpire: (id: string) => void): ToastTimers {
  const timers = new Map<string, RunningTimer>();
  const pauses = new Map<string, Set<PauseReason>>();
  /** The dispatch (`seq`) whose timer was started last, per toast. */
  const started = new Map<string, number>();
  let inBackground = false;
  let suspended = false;

  const sync = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    const canRun = !suspended && !inBackground && !(pauses.get(id)?.size ?? 0);
    if (canRun && timer.handle === null) {
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => {
        timers.delete(id);
        pauses.delete(id);
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
    start(id, seq, timeout) {
      if (started.get(id) === seq) return;
      started.set(id, seq);
      stop(id);
      if (!(timeout > 0) || !Number.isFinite(timeout)) return;
      timers.set(id, { handle: null, remaining: timeout, startedAt: 0 });
      sync(id);
    },
    remove(id) {
      stop(id);
      pauses.delete(id);
      started.delete(id);
    },
    clear() {
      for (const id of Array.from(timers.keys())) stop(id);
      pauses.clear();
      started.clear();
    },
    pause(id, reason) {
      let reasons = pauses.get(id);
      if (!reasons) {
        reasons = new Set();
        pauses.set(id, reasons);
      }
      reasons.add(reason);
      sync(id);
    },
    resume(id, reason) {
      pauses.get(id)?.delete(reason);
      sync(id);
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
 * Corner of the viewport a {@link Toaster} shows its toasts in (`ToasterProps.position`).
 * `start`/`end` follow the writing direction; `left`/`right` are physical.
 */
export type ToastPosition =
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left';

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
  /** Ref to the toast region (the portaled `<div role="region">`). */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Corner placement. The margin on the toasts' side is `--wave-toaster-offset`, which the Toaster
 * sets while a modal panel covers that side (see {@link getSidePanelOffset}); unset, it is `0`.
 */
const positionClasses: Record<ToastPosition, string> = {
  'top-start': 'top-4 start-4 ms-(--wave-toaster-offset)',
  'top-end': 'top-4 end-4 me-(--wave-toaster-offset)',
  'bottom-start': 'bottom-4 start-4 ms-(--wave-toaster-offset)',
  'bottom-end': 'bottom-4 end-4 me-(--wave-toaster-offset)',
  'top-right': 'top-4 right-4 mr-(--wave-toaster-offset)', // wave-allow-physical: explicit physical position value
  'top-left': 'top-4 left-4 ml-(--wave-toaster-offset)', // wave-allow-physical: explicit physical position value
  'bottom-right': 'bottom-4 right-4 mr-(--wave-toaster-offset)', // wave-allow-physical: explicit physical position value
  'bottom-left': 'bottom-4 left-4 ml-(--wave-toaster-offset)', // wave-allow-physical: explicit physical position value
};

/** The toasts' distance from the window edges (`*-4`), also the tolerance for "at the edge". */
const EDGE_GAP = 16;

/** Whether the toasts sit at the right edge of the window (`end` is the right in LTR). */
function isOnRightSide(position: ToastPosition, viewport: HTMLElement): boolean {
  const inline = position.slice(position.indexOf('-') + 1);
  if (inline === 'right' || inline === 'left') return inline === 'right';
  const rtl = getDirection(viewport) === 'rtl';
  return inline === 'end' ? !rtl : rtl;
}

/**
 * How far the toasts move away from their side while an open modal surface (a Drawer panel) covers
 * their corner, so they never hide the panel's controls (WCAG 2.4.11 Focus Not Obscured): the
 * surface's width from that side of the window, which leaves the usual gap between toasts and
 * panel. A surface counts when it reaches the toasts' side and their top or bottom edge (a centered
 * Dialog does not). `0` when no such surface is open, or when the toasts would not fit beside it
 * (a full-width panel on a phone): then they keep their corner.
 */
function getSidePanelOffset(viewport: HTMLElement, position: ToastPosition): number {
  const modals = getOpenLayers().filter((layer) => layer.kind === 'modal');
  if (modals.length === 0) return 0;
  const doc = viewport.ownerDocument;
  const view = doc.defaultView;
  if (!view) return 0;
  // The box fixed elements are placed in: the window without its scrollbars.
  const width = doc.documentElement.clientWidth || view.innerWidth;
  const height = doc.documentElement.clientHeight || view.innerHeight;
  const right = isOnRightSide(position, viewport);
  const top = position.startsWith('top');

  let offset = 0;
  for (const layer of modals) {
    for (const el of layer.getElements()) {
      if (!el?.isConnected) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      const onSide = right ? box.right >= width - EDGE_GAP : box.left <= EDGE_GAP;
      const onEdge = top ? box.top <= EDGE_GAP : box.bottom >= height - EDGE_GAP;
      if (onSide && onEdge) offset = Math.max(offset, right ? width - box.left : box.right);
    }
  }
  if (offset <= 0 || width - offset < viewport.offsetWidth + 2 * EDGE_GAP) return 0;
  return Math.ceil(offset);
}

/** The text written into the live region for a toast ("Error: Upload failed Try again."). */
function getAnnouncement({ status = 'info', statusLabel, title, body }: ToastOptions): string {
  return [getStatusLabel(status, statusLabel), title, body].filter(Boolean).join(' ');
}

/**
 * How long a toast's text stays in the live region: long enough for screen readers to pick it up
 * (also a polite message queued behind other speech), short enough that someone browsing the
 * Notifications region later meets the text once, in the toast, not a second time in the region.
 */
const ANNOUNCEMENT_DURATION = 2000;

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
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
  getFocusFallback: (from: HTMLElement | null) => HTMLElement | null;
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

/**
 * One toast of the Toaster (D10): a `role="group"` container, focusable by script (no Tab stop),
 * named by the toast's severity text and title and described by its body while a Toast inside
 * has registered them (so no id reference dangles). It provides the per-toast context, pauses the
 * timers and keeps focus when the toast goes.
 */
function ToastContainer({
  entry,
  timers,
  onDismiss,
  onExited,
  getFocusFallback,
}: ToastContainerProps) {
  const { id, options, dismissed } = entry;
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
  const attach = React.useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node) lastElementRef.current = node;
  }, []);
  const mergedRef = useMergedRefs<HTMLDivElement>(attach, presenceRef);
  // Focus leaves a dismissed toast in its dismissing commit: `enabled` flipping to `false` moves it
  // in the layout phase, while the inert node is still there; a toast removed with the Toaster
  // moves it after the unmount.
  usePreserveFocus(containerRef, () => getFocusFallback(lastElementRef.current), {
    enabled: !dismissed,
  });
  const titleId = useId('wave-toast-title');

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
    onDismiss(id);
  });
  const context = React.useMemo<ToastContextValue>(
    () => ({ titleId, dismiss, registerPart, registerToast }),
    [titleId, dismiss, registerPart, registerToast],
  );

  const titlePart = parts.find(isTitlePart);
  const bodyPart = parts.find(isBodyPart);
  if (!isMounted) return null;
  return (
    <div
      ref={mergedRef}
      role="group"
      tabIndex={-1}
      data-wave-toast=""
      aria-labelledby={joinIds(toast?.statusTextId, titlePart?.id)}
      aria-describedby={bodyPart?.id}
      className={cn(toasterClassNames.toast, 'rounded', focusRing)}
      {...presenceProps}
      onPointerEnter={() => timers.pause(id, 'hover')}
      onPointerLeave={() => timers.resume(id, 'hover')}
      onFocus={() => timers.pause(id, 'focus')}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        timers.resume(id, 'focus');
      }}
    >
      <ToastContext.Provider value={context}>
        <ToastRoot
          status={options.status}
          statusLabel={options.statusLabel}
          title={options.title}
          dismissLabel={options.dismissLabel}
        >
          {options.body}
        </ToastRoot>
      </ToastContext.Provider>
    </div>
  );
}
ToastContainer.displayName = 'ToastContainer';

/**
 * Provides {@link useToastController} to its children and shows the dispatched toasts.
 *
 * - **Wrap the app** in `<Toaster>`; components below it call `useToastController()`.
 * - The toasts render in a portal (the `toast` layer, above dialogs) inside a region labelled
 *   "Notifications" (override with `aria-label`). The region is allow-listed for modals
 *   (`data-wave-focus-trap-allow`): it stays reachable by Tab and exposed to assistive technology
 *   while a Dialog or Drawer is open, and clicking a toast never dismisses the overlay below.
 * - Two permanent, visually hidden live regions (polite, and assertive for `error`) announce every
 *   toast; the toasts themselves are not live regions. Each message stays in its live region for
 *   2 seconds (or until its toast goes), so browsing the region later meets the text only once.
 * - While an open modal panel covers the toasts' corner (a Drawer on the same side), the toasts
 *   move beside it, so they never hide its focused controls (WCAG 2.4.11). Without room beside it
 *   (a full-width panel on a narrow screen) they keep their corner.
 * - Timers pause while a toast is hovered or focused and while the window is in the background
 *   (it has lost focus, or the page is not shown, as in a background tab).
 *   When a toast that contains focus goes away, focus moves to the next toast (or the previous one
 *   when the last toast goes), or back to the element that was focused before focus entered the
 *   toasts once no toast is left (kept across the moves between toasts and while another window
 *   is active; forgotten once focus has returned to it, and when focus leaves the toasts for
 *   another element or for the page body).
 * - Each toast's dismiss button is named "Dismiss"; pass `dismissLabel` to `dispatchToast` for
 *   other languages.
 * - `limit` caps how many toasts show at once: the others wait in a queue, in dispatch order,
 *   unannounced and without a running timer, and appear as shown toasts go.
 *   `dismissAllToasts()` removes every toast, shown and queued.
 *
 * @example
 * <Toaster position="bottom-end" limit={3}>
 *   <App />
 * </Toaster>
 */
export const Toaster = ({
  position = 'bottom-end',
  limit: limitProp,
  className,
  style,
  children,
  onFocus,
  onBlur,
  ref,
  ...rest
}: ToasterProps) => {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const limit = resolveLimit(limitProp);
  // Waiting toasts are shown here, during render, with the current limit (adjust state while
  // rendering, C-HOOKS): every path that frees a place or raises the limit promotes them, and a
  // lowered limit never hides a shown toast. `promoteQueued` returns the same array once settled.
  const settled = promoteQueued(toasts, limit);
  if (settled !== toasts) setToasts(settled);
  const shownToasts = settled.filter((toast) => toast.shown);

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

  // Beside an open modal panel on the toasts' side (a Drawer), not over its controls. Measured when
  // a layer opens or closes (synchronously in its layout effect, before paint), on resize, and
  // after a transition or animation (a panel that slides in reaches its place only then).
  const [sideOffset, setSideOffset] = React.useState(0);
  React.useLayoutEffect(() => {
    const update = () => {
      const viewport = viewportRef.current;
      setSideOffset(viewport ? getSidePanelOffset(viewport, position) : 0);
    };
    update();
    const unsubscribe = subscribeLayers(update);
    window.addEventListener('resize', update);
    document.addEventListener('transitionend', update, true);
    document.addEventListener('animationend', update, true);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', update);
      document.removeEventListener('transitionend', update, true);
      document.removeEventListener('animationend', update, true);
    };
  }, [position, dir]);

  const [timers] = React.useState(() =>
    createToastTimers((id) => setToasts((prev) => markDismissed(prev, id))),
  );

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

  // Starts the timer of every newly shown toast, and restarts it for a shown toast dispatched again
  // (a new `seq`); `timers.start` ignores a dispatch it has already started. A dismissed toast has
  // none.
  React.useEffect(() => {
    for (const toast of toasts) {
      if (toast.shown && !toast.dismissed) {
        timers.start(toast.id, toast.seq, toast.options.timeout ?? DEFAULT_TIMEOUT);
      }
    }
  }, [toasts, timers]);

  // A new toast waits until the render promotes it; a replaced one keeps its place and whether it
  // is shown (a waiting toast keeps waiting with the new options), and an exiting one is revived.
  const dispatchToast = React.useCallback(
    (options: ToastOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const id = options.toastId ?? `${prefix}-${seq}`;
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return [...prev, { id, options, seq, shown: false, dismissed: false }];
        const next = prev.slice();
        next[index] = { id, options, seq, shown: prev[index].shown, dismissed: false };
        return next;
      });
      return id;
    },
    [prefix],
  );

  const dismissToast = React.useCallback(
    (id: string) => {
      timers.remove(id);
      setToasts((prev) => markDismissed(prev, id));
    },
    [timers],
  );

  const dismissAllToasts = React.useCallback(() => {
    timers.clear();
    setToasts((prev) => markAllDismissed(prev));
  }, [timers]);

  // The exit of a dismissed toast ended: remove it (one revived meanwhile stays).
  const removeExited = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.some((t) => t.id === id && t.dismissed)
        ? prev.filter((t) => !(t.id === id && t.dismissed))
        : prev,
    );
  }, []);

  const controller = React.useMemo<ToastController>(
    () => ({ dispatchToast, dismissToast, dismissAllToasts }),
    [dispatchToast, dismissToast, dismissAllToasts],
  );

  // Where focus goes when the focused toast is dismissed (in its dismissing commit) or removed with
  // the Toaster: the next toast that is not exiting, else the previous one — that container itself
  // when focus was on the dismissed container (after Delete or the shortcut), else its first
  // tabbable element — else the element focused before focus entered the toasts. Runs possibly
  // after the whole Toaster is gone: never throws.
  const getFocusFallback = React.useCallback((from: HTMLElement | null): HTMLElement | null => {
    const viewport = viewportRef.current;
    const containers = viewport
      ? Array.from(viewport.children).filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement && el.hasAttribute('data-wave-toast'),
        )
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

  // Focus entering the toasts from an element outside: return there when the focused toast goes.
  // Focus that arrives with no related target keeps what is remembered: that is the Toaster's own
  // move to the next toast in the dismissing commit (the dismissed container is still there, inert,
  // when focus leaves it) or the window regaining focus. Moves between toasts change nothing.
  const rememberFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
      previousFocusRef.current = from;
    }
  };

  // Focus leaving the toasts for another element or for `<body>` forgets the element, so a toast
  // focused again later from nowhere never sends focus back to something focused long before.
  // Kept: moves between toasts, a dismissed toast (its container is still there, inert, when the
  // Toaster moves focus itself; it is removed only once its exit ends) and the window losing focus
  // (the element keeps document focus while another window is active).
  const forgetFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const to = event.relatedTarget;
    if (to instanceof Node && viewport.contains(to)) return;
    // A blur from inside a dismissed (exiting, inert) toast: the Toaster has moved focus itself,
    // or a browser's focus fix-up blurs the inert subtree later.
    if (event.target.closest('[data-wave-toast][data-presence="exiting"]')) return;
    if (to === null) {
      const from = event.target;
      if (!from.isConnected) return;
      const active = from.ownerDocument.activeElement;
      if (active && viewport.contains(active)) return;
    }
    previousFocusRef.current = null;
  };

  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  // Only shown toasts are announced (a waiting toast is announced when it appears), and a
  // dismissed one no longer is.
  for (const toast of shownToasts) {
    if (toast.dismissed) continue;
    const message = <LiveMessage key={toast.seq} text={getAnnouncement(toast.options)} />;
    (toast.options.status === 'error' ? assertive : polite).push(message);
  }

  const viewportStyle =
    sideOffset > 0
      ? ({ ...style, '--wave-toaster-offset': `${sideOffset}px` } as React.CSSProperties)
      : style;

  return (
    <ToasterContext.Provider value={controller}>
      {children}
      <Portal layer="toast">
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
            onFocus?.(event);
            rememberFocusOrigin(event);
          }}
          onBlur={(event) => {
            onBlur?.(event);
            forgetFocusOrigin(event);
          }}
          className={cn(
            toasterClassNames.root,
            'fixed flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2',
            positionClasses[position],
            className,
          )}
        >
          {/* One message per toast for its first 2 s; not atomic, so only the added one is read. */}
          <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
            {polite}
          </div>
          <div aria-live="assertive" aria-atomic="false" className="sr-only">
            {assertive}
          </div>
          {/* Shown toasts, exiting ones included: getFocusFallback walks the containers in this order. */}
          {shownToasts.map((toast) => (
            <ToastContainer
              key={toast.id}
              entry={toast}
              timers={timers}
              onDismiss={dismissToast}
              onExited={removeExited}
              getFocusFallback={getFocusFallback}
            />
          ))}
        </div>
      </Portal>
    </ToasterContext.Provider>
  );
};
Toaster.displayName = 'Toaster';
