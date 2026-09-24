import * as React from 'react';
import { cn } from '../../lib/cn';
import { isDev } from '../../lib/dev';
import { getFirstTabbable } from '../../lib/focus';
import { DismissIcon } from '../../lib/icons';
import { focusRing } from '../../lib/styles';
import type { Status } from '../../lib/types';
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
   * Auto-dismiss timeout in milliseconds. The countdown pauses while the pointer is over the toast,
   * while focus is inside it and while the browser window is in the background. `0` (or any value
   * that is not a positive finite number) keeps the toast until it is dismissed.
   * @default 5000
   */
  timeout?: number;
  /**
   * Identifier of the toast. `dispatchToast` returns it (a generated one when omitted). Dispatching
   * again with the id of a toast that is still shown replaces that toast (content and timer).
   */
  toastId?: string;
  /**
   * Visually hidden status text read before the toast (`'Info:'`, `'Success:'`, `'Warning:'`,
   * `'Error:'` by default). Pass a translation for other languages, or `''` to omit it.
   */
  statusLabel?: string;
}

/** The toast API returned by {@link useToastController}. */
export interface ToastController {
  /**
   * Shows a toast and returns its id (`options.toastId`, or a generated one). A toast with the same
   * id is replaced.
   */
  dispatchToast: (options: ToastOptions) => string;
  /** Removes the toast with this id and cancels its timer. Unknown ids are ignored. */
  dismissToast: (id: string) => void;
}

interface ToastEntry {
  id: string;
  options: ToastOptions;
  /** Increases with every dispatch, so a replaced toast is announced again. */
  seq: number;
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const ToasterContext = React.createContext<ToastController | null>(null);
ToasterContext.displayName = 'ToasterContext';

const INERT_CONTROLLER: ToastController = {
  dispatchToast: (options) => options.toastId ?? '',
  dismissToast: () => {},
};

const MISSING_TOASTER_MESSAGE =
  '[WaveUI] useToastController must be used within <Toaster>. Wrap your app (or the part of it that shows toasts) in <Toaster>: it provides the controller to its children.';

let missingToasterReported = false;

/**
 * Production fallback: logs the missing `<Toaster>` once per page rather than on every render of
 * the calling component (`warnOnce` is a no-op in production).
 */
function reportMissingToaster(): void {
  if (missingToasterReported) return;
  missingToasterReported = true;
  console.error(MISSING_TOASTER_MESSAGE);
}

/**
 * Returns the {@link ToastController} of the enclosing `<Toaster>`: `dispatchToast(options)` shows
 * a toast and returns its id, `dismissToast(id)` removes it.
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
  if (isDev) throw new Error(MISSING_TOASTER_MESSAGE);
  reportMissingToaster();
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
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * The visual of a single notification: status icon, visually hidden status text, title, body and an
 * optional dismiss button. Usually rendered by `<Toaster>` through `useToastController()`.
 *
 * A Toast is not a live region itself: the Toaster announces its toasts through permanent live
 * regions. A Toast rendered on its own is not announced.
 */
export const Toast = ({
  status = 'info',
  title,
  statusLabel,
  onDismiss,
  className,
  children,
  ref,
  ...rest
}: ToastProps) => {
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <div
      ref={ref}
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
        {hasBody ? (
          <div className="mt-0.5 text-body-1 text-muted-foreground">{children}</div>
        ) : null}
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
          aria-label="Dismiss"
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
 * focused, the window has focus and the Toaster is mounted; otherwise it is suspended and keeps its
 * remaining time. Every method is called from event handlers or effects, never during render.
 */
interface ToastTimers {
  /** (Re)starts the timer of `id`; a timeout that is not a positive finite number means none. */
  start(id: string, timeout: number): void;
  /** Cancels the timer of `id` and forgets its pause state. */
  remove(id: string): void;
  pause(id: string, reason: PauseReason): void;
  resume(id: string, reason: PauseReason): void;
  setWindowBlurred(blurred: boolean): void;
  /** `true` while the Toaster is unmounted (including StrictMode's simulated unmount). */
  setSuspended(suspended: boolean): void;
}

function createToastTimers(onExpire: (id: string) => void): ToastTimers {
  const timers = new Map<string, RunningTimer>();
  const pauses = new Map<string, Set<PauseReason>>();
  let windowBlurred = false;
  let suspended = false;

  const sync = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    const canRun = !suspended && !windowBlurred && !(pauses.get(id)?.size ?? 0);
    if (canRun && timer.handle === null) {
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => {
        timers.delete(id);
        pauses.delete(id);
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
    start(id, timeout) {
      stop(id);
      if (!(timeout > 0) || !Number.isFinite(timeout)) return;
      timers.set(id, { handle: null, remaining: timeout, startedAt: 0 });
      sync(id);
    },
    remove(id) {
      stop(id);
      pauses.delete(id);
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
    setWindowBlurred(blurred) {
      windowBlurred = blurred;
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

type ToastPosition =
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
  /** Ref to the toast region (the portaled `<div role="region">`). */
  ref?: React.Ref<HTMLDivElement>;
}

const positionClasses: Record<ToastPosition, string> = {
  'top-start': 'top-4 start-4',
  'top-end': 'top-4 end-4',
  'bottom-start': 'bottom-4 start-4',
  'bottom-end': 'bottom-4 end-4',
  'top-right': 'top-4 right-4', // wave-allow-physical: explicit physical position value
  'top-left': 'top-4 left-4', // wave-allow-physical: explicit physical position value
  'bottom-right': 'bottom-4 right-4', // wave-allow-physical: explicit physical position value
  'bottom-left': 'bottom-4 left-4', // wave-allow-physical: explicit physical position value
};

/** The text written into the live region for a toast ("Error: Upload failed Try again."). */
function getAnnouncement({ status = 'info', statusLabel, title, body }: ToastOptions): string {
  return [getStatusLabel(status, statusLabel), title, body].filter(Boolean).join(' ');
}

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
 *   toast; the toasts themselves are not live regions.
 * - Timers pause while a toast is hovered or focused and while the window is in the background.
 *   When a toast that contains focus goes away, focus moves to the next toast, or back to the
 *   element that was focused before focus entered the toasts (kept across the moves between
 *   toasts and while another window is active; forgotten once focus has returned to it, and when
 *   focus leaves the toasts for another element or for the page body).
 *
 * @example
 * <Toaster position="bottom-end">
 *   <App />
 * </Toaster>
 */
export const Toaster = ({
  position = 'bottom-end',
  className,
  children,
  onFocus,
  onBlur,
  ref,
  ...rest
}: ToasterProps) => {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  const prefix = useId('toast');
  const counterRef = React.useRef(0);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRefs = useMergedRefs(ref, viewportRef);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  const [timers] = React.useState(() =>
    createToastTimers((id) =>
      setToasts((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev)),
    ),
  );

  // Timers run only while mounted (StrictMode's simulated unmount suspends and resumes them) and
  // pause while the window is in the background.
  React.useEffect(() => {
    timers.setSuspended(false);
    // Only the window's own blur/focus (element focus events do not bubble to a bubble-phase
    // window listener; anything targeted at a node is ignored).
    const handleBlur = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) timers.setWindowBlurred(true);
    };
    const handleFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) timers.setWindowBlurred(false);
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      timers.setSuspended(true);
    };
  }, [timers]);

  const dispatchToast = React.useCallback(
    (options: ToastOptions): string => {
      counterRef.current += 1;
      const seq = counterRef.current;
      const id = options.toastId ?? `${prefix}-${seq}`;
      const entry: ToastEntry = { id, options, seq };
      setToasts((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index === -1) return [...prev, entry];
        const next = prev.slice();
        next[index] = entry;
        return next;
      });
      timers.start(id, options.timeout ?? DEFAULT_TIMEOUT);
      return id;
    },
    [prefix, timers],
  );

  const dismissToast = React.useCallback(
    (id: string) => {
      timers.remove(id);
      setToasts((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev));
    },
    [timers],
  );

  const controller = React.useMemo<ToastController>(
    () => ({ dispatchToast, dismissToast }),
    [dispatchToast, dismissToast],
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

  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  for (const toast of toasts) {
    const message = <div key={toast.seq}>{getAnnouncement(toast.options)}</div>;
    (toast.options.status === 'error' ? assertive : polite).push(message);
  }

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
          {/* One message per shown toast; not atomic, so only the added message is read. */}
          <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
            {polite}
          </div>
          <div aria-live="assertive" aria-atomic="false" className="sr-only">
            {assertive}
          </div>
          {toasts.map((toast, index) => (
            <ToasterItem
              key={toast.id}
              entry={toast}
              index={index}
              timers={timers}
              onDismiss={dismissToast}
              getFocusFallback={getFocusFallback}
            />
          ))}
        </div>
      </Portal>
    </ToasterContext.Provider>
  );
};
Toaster.displayName = 'Toaster';
