import * as React from 'react';
import { cn } from '../../lib/cn';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { getFirstTabbable } from '../../lib/focus';
import { DismissIcon } from '../../lib/icons';
import { getOpenLayers, subscribeLayers } from '../../lib/layers';
import { materialiseSlotContent, slotRendersContent } from '../../lib/slot';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
import { useDirection } from '../../hooks/useDirection';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { Portal } from '../portal/Portal';
import {
  STATUS_BORDER,
  STATUS_ICON_COLOR,
  StatusIcon,
  StatusText,
  getStatusLabel,
} from './MessageBar.status';

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
   * again with the id of a toast that is still shown replaces that toast (content and timer); with
   * the id of a toast that waits beyond the Toaster's `limit`, it replaces its options and the toast
   * keeps its place in the queue.
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
   * Removes the toast with this id (shown or waiting) and cancels its timer. Unknown ids are
   * ignored.
   */
  dismissToast: (id: string) => void;
  /** Removes every toast, shown and queued, and cancels their timers. */
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
}

/**
 * Flags the oldest waiting toasts as shown while fewer than `limit` are shown. Returns `toasts`
 * itself when nothing changes, so the Toaster's render-time update settles.
 */
function promoteQueued(toasts: ToastEntry[], limit: number): ToastEntry[] {
  let shownCount = 0;
  for (const toast of toasts) if (toast.shown) shownCount += 1;
  if (shownCount >= limit || shownCount === toasts.length) return toasts;
  return toasts.map((toast) => {
    if (toast.shown || shownCount >= limit) return toast;
    shownCount += 1;
    return { ...toast, shown: true };
  });
}

/** `limit` as the Toaster applies it: whole toasts, at least 1; `undefined` means no limit. */
function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) return Infinity;
  return limit >= 1 ? Math.floor(limit) : 1;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const ToasterContext = React.createContext<ToastController | null>(null);
ToasterContext.displayName = 'ToasterContext';

/**
 * `true` for the toasts the Toaster renders in its region, which its live regions announce. A
 * Toast rendered anywhere else (also as app content inside `<Toaster>`) is a live region itself.
 */
const ToasterRegionContext = React.createContext(false);
ToasterRegionContext.displayName = 'ToasterRegionContext';

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
/*  Toast (individual notification)                                   */
/* ------------------------------------------------------------------ */

/** Properties for the Toast component. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status level controlling the toast color, icon and status text.
   * @default 'info'
   */
  status?: Status;
  /** Title text displayed in the toast. */
  title?: string;
  /**
   * Visually hidden status text read before the toast (`'Info:'`, `'Success:'`, `'Warning:'`,
   * `'Error:'` by default). Pass a translation for other languages, or `''` to omit it.
   */
  statusLabel?: string;
  /** Called when the dismiss button is activated. Passing it renders the dismiss button. */
  onDismiss?: () => void;
  /**
   * Accessible name of the dismiss button. Pass a translation for other languages.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The visual of a single notification: status icon, visually hidden status text, title, body and an
 * optional dismiss button. Usually rendered by `<Toaster>` through `useToastController()`.
 *
 * - **In a Toaster** (dispatched with `useToastController()`): not a live region itself; the
 *   Toaster announces it through its permanent live regions.
 * - **On its own** (your own container, an inline notice): a live region, as in 0.4 —
 *   `role="status"` with `aria-live="polite"`, or `role="alert"` with `aria-live="assertive"` for
 *   `error` (override with `role`/`aria-live`). A live region that is added together with its
 *   text is not announced by every screen reader, so render the Toast in advance and change its
 *   content, or dispatch it through a Toaster.
 */
export const Toast = ({
  status = 'info',
  title,
  statusLabel,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
  ref,
  ...rest
}: ToastProps) => {
  const inToasterRegion = React.useContext(ToasterRegionContext);
  // Content that renders nothing (`''`, `[]`, `<></>`) gets no body element; a generator is read
  // once by the check and its items render.
  const body = materialiseSlotContent(children);
  const hasBody = slotRendersContent(body);
  const liveRegion: React.HTMLAttributes<HTMLDivElement> = inToasterRegion
    ? {}
    : status === 'error'
      ? { role: 'alert', 'aria-live': 'assertive' }
      : { role: 'status', 'aria-live': 'polite' };
  return (
    <div
      ref={ref}
      {...liveRegion}
      {...rest}
      className={cn(
        'flex items-start gap-3 rounded border border-s-4 border-border bg-background p-3 text-foreground shadow-4',
        STATUS_BORDER[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 inline-flex shrink-0', STATUS_ICON_COLOR[status])}
      >
        <StatusIcon status={status} />
      </span>
      <div className="min-w-0 flex-1">
        <StatusText label={getStatusLabel(status, statusLabel)} />
        {title ? <div className="text-body-2 font-semibold text-foreground">{title}</div> : null}
        {hasBody ? <div className="mt-0.5 text-body-1 text-muted-foreground">{body}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={() => onDismiss()}
          className={cn(
            'inline-flex shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-muted-foreground',
            'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
            'not-disabled:not-aria-disabled:active:bg-subtle-pressed',
            focusRing,
          )}
          aria-label={dismissLabel}
        >
          <DismissIcon />
        </button>
      ) : null}
    </div>
  );
};
Toast.displayName = 'Toast';

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
   * Lowering it never hides a toast that is already shown. A value below 1 counts as 1
   * (development warning); `Infinity` means no limit.
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

interface ToasterItemProps {
  entry: ToastEntry;
  index: number;
  timers: ToastTimers;
  onDismiss: (id: string) => void;
  getFocusFallback: (index: number) => HTMLElement | null;
}

/** One toast of the Toaster: pause handlers and focus preservation on removal. */
function ToasterItem({ entry, index, timers, onDismiss, getFocusFallback }: ToasterItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  usePreserveFocus(ref, () => getFocusFallback(index));
  const { id, options } = entry;
  return (
    <Toast
      ref={ref}
      data-wave-toast=""
      status={options.status}
      statusLabel={options.statusLabel}
      title={options.title}
      dismissLabel={options.dismissLabel}
      onDismiss={() => onDismiss(id)}
      onPointerEnter={() => timers.pause(id, 'hover')}
      onPointerLeave={() => timers.resume(id, 'hover')}
      onFocus={() => timers.pause(id, 'focus')}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        timers.resume(id, 'focus');
      }}
    >
      {options.body}
    </Toast>
  );
}
ToasterItem.displayName = 'ToasterItem';

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
    createToastTimers((id) =>
      setToasts((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev)),
    ),
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
  // (a new `seq`); `timers.start` ignores a dispatch it has already started.
  React.useEffect(() => {
    for (const toast of toasts) {
      if (toast.shown) timers.start(toast.id, toast.seq, toast.options.timeout ?? DEFAULT_TIMEOUT);
    }
  }, [toasts, timers]);

  // A new toast waits until the render promotes it; a replaced one keeps its place and whether it
  // is shown (a waiting toast keeps waiting with the new options).
  const dispatchToast = React.useCallback(
    (options: ToastOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const id = options.toastId ?? `${prefix}-${seq}`;
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return [...prev, { id, options, seq, shown: false }];
        const next = prev.slice();
        next[index] = { id, options, seq, shown: prev[index].shown };
        return next;
      });
      return id;
    },
    [prefix],
  );

  const dismissToast = React.useCallback(
    (id: string) => {
      timers.remove(id);
      setToasts((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev));
    },
    [timers],
  );

  const dismissAllToasts = React.useCallback(() => {
    timers.clear();
    setToasts((prev) => (prev.length === 0 ? prev : []));
  }, [timers]);

  const controller = React.useMemo<ToastController>(
    () => ({ dispatchToast, dismissToast, dismissAllToasts }),
    [dispatchToast, dismissToast, dismissAllToasts],
  );

  // Runs after the removed toast is gone (possibly after the whole Toaster): never throws.
  const getFocusFallback = React.useCallback((index: number): HTMLElement | null => {
    const viewport = viewportRef.current;
    const remaining = viewport
      ? Array.from(viewport.children).filter(
          (el): el is HTMLElement =>
            el instanceof HTMLElement && el.hasAttribute('data-wave-toast'),
        )
      : [];
    for (const toast of [remaining[index], remaining[index - 1]]) {
      const target = toast?.isConnected ? getFirstTabbable(toast) : null;
      if (target) return target;
    }
    // Focus leaves the toasts here without a blur of the viewport (the focused node is gone), so
    // the element is forgotten as it is used: a toast focused later from nowhere does not send
    // focus back to it.
    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    return previous?.isConnected ? previous : null;
  }, []);

  // Focus entering the toasts from an element outside: return there when the focused toast goes.
  // Focus that arrives with no related target keeps what is remembered: that is the Toaster's own
  // move to the next toast after a removal (focus passed through `<body>` while the removed node
  // was gone) or the window regaining focus. Moves between toasts change nothing.
  const rememberFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const from = event.relatedTarget;
    if (from instanceof HTMLElement && !event.currentTarget.contains(from)) {
      previousFocusRef.current = from;
    }
  };

  // Focus leaving the toasts for another element or for `<body>` forgets the element, so a toast
  // focused again later from nowhere never sends focus back to something focused long before.
  // Kept: moves between toasts, a removed toast (its node is gone; the Toaster moves focus itself)
  // and the window losing focus (the element keeps document focus while another window is active).
  const forgetFocusOrigin = (event: React.FocusEvent<HTMLDivElement>) => {
    const viewport = event.currentTarget;
    const to = event.relatedTarget;
    if (to instanceof Node && viewport.contains(to)) return;
    if (to === null) {
      const from = event.target;
      if (!from.isConnected) return;
      const active = from.ownerDocument.activeElement;
      if (active && viewport.contains(active)) return;
    }
    previousFocusRef.current = null;
  };

  // Only shown toasts are announced: a waiting toast is announced when it appears.
  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  for (const toast of shownToasts) {
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
          <ToasterRegionContext.Provider value={true}>
            {/* The index within the rendered (shown) toasts, which getFocusFallback walks. */}
            {shownToasts.map((toast, index) => (
              <ToasterItem
                key={toast.id}
                entry={toast}
                index={index}
                timers={timers}
                onDismiss={dismissToast}
                getFocusFallback={getFocusFallback}
              />
            ))}
          </ToasterRegionContext.Provider>
        </div>
      </Portal>
    </ToasterContext.Provider>
  );
};
Toaster.displayName = 'Toaster';
