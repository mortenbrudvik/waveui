import * as React from 'react';
import { joinIds } from '../../lib/aria';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { toasterClassNames } from '../../lib/classNames';
import { reportMissingContext, warnOnce } from '../../lib/dev';
import { getDirection } from '../../lib/direction';
import { isEditableTarget, isOwnEvent } from '../../lib/events';
import { getFirstTabbable, getTabbableElements, isConnectedAndFocusable } from '../../lib/focus';
import { getOpenLayers, isInsideLayerTree, subscribeLayers } from '../../lib/layers';
import { focusRing } from '../../lib/styles';
import { bindToasterHandle, isToastOptions } from '../../lib/toaster';
import type { ToasterHandle } from '../../lib/toaster';
import type { Status } from '../../lib/types';
import { useDirection } from '../../hooks/useDirection';
import { useEventCallback } from '../../hooks/useEventCallback';
import { useId } from '../../hooks/useId';
import { useMergedRefs } from '../../hooks/useMergedRefs';
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
   * until an exit motion of yours ends), a waiting one is removed. Unknown ids are ignored.
   */
  dismissToast: (id: string) => void;
  /**
   * Dismisses every toast and cancels their timers: shown toasts exit (as `dismissToast`), queued
   * ones are removed.
   */
  dismissAllToasts: () => void;
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
}

/**
 * Auto-dismiss timers of one Toaster. A timer runs only while neither the pointer nor focus is in
 * the toast region (D14), the window is in the foreground and the Toaster is mounted; otherwise it
 * is suspended and keeps its remaining time. Every method is called from event handlers or
 * effects, never during render.
 */
interface ToastTimers {
  /**
   * Starts the timer of the shown toast `id` for its dispatch `seq`, once: a call with the `seq`
   * already started does nothing, a new `seq` (the toast was replaced) restarts it. A timeout that
   * is not a positive finite number means none. A toast replaced while the region is paused stays
   * paused.
   */
  start(id: string, seq: number, timeout: number): void;
  /** Cancels the timer of `id`. */
  remove(id: string): void;
  /** Cancels every timer; the region's pause is kept. */
  clear(): void;
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
  /** Why the region pauses every timer. */
  const pauses = new Set<PauseReason>();
  /** The dispatch (`seq`) whose timer was started last, per toast. */
  const started = new Map<string, number>();
  let inBackground = false;
  let suspended = false;

  const sync = (id: string) => {
    const timer = timers.get(id);
    if (!timer) return;
    const canRun = !suspended && !inBackground && pauses.size === 0;
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
      started.delete(id);
    },
    clear() {
      for (const id of Array.from(timers.keys())) stop(id);
      started.clear();
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
  /** Keyboard shortcuts; Escape, Delete and Backspace need none (see the component docs). */
  shortcuts?: ToasterShortcuts;
  /**
   * Binds this Toaster to a handle from `createToaster()`: toasts dispatched through the handle
   * render here. A handle binds one Toaster: a second Toaster given a bound handle does not bind
   * (development warning), and does not take the handle over when the first unmounts; the handle
   * queues again until a Toaster binds it.
   */
  toaster?: ToasterHandle;
  /** Ref to the toast region (the portaled `<div role="region">`). */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Corner placement. The margin on the toasts' side is `--wave-toaster-offset`, and the margin on
 * their top or bottom edge `--wave-toaster-offset-block`, which the Toaster sets while a modal or
 * non-modal panel covers that side or that edge (see {@link getPanelOffsets}); unset, each is `0`.
 */
const positionClasses: Record<ToastPosition, string> = {
  'top-start': 'top-4 start-4 ms-(--wave-toaster-offset) mt-(--wave-toaster-offset-block)',
  'top-end': 'top-4 end-4 me-(--wave-toaster-offset) mt-(--wave-toaster-offset-block)',
  'bottom-start': 'bottom-4 start-4 ms-(--wave-toaster-offset) mb-(--wave-toaster-offset-block)',
  'bottom-end': 'bottom-4 end-4 me-(--wave-toaster-offset) mb-(--wave-toaster-offset-block)',
  'top-right': 'top-4 right-4 mr-(--wave-toaster-offset) mt-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'top-left': 'top-4 left-4 ml-(--wave-toaster-offset) mt-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'bottom-right': 'bottom-4 right-4 mr-(--wave-toaster-offset) mb-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
  'bottom-left': 'bottom-4 left-4 ml-(--wave-toaster-offset) mb-(--wave-toaster-offset-block)', // wave-allow-physical: explicit physical position value
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

/** How far the toasts move away from their corner, per axis, in px (`0`: they stay). */
interface PanelOffsets {
  /** Away from the toasts' side (`--wave-toaster-offset`). */
  inline: number;
  /** Away from their top or bottom edge (`--wave-toaster-offset-block`). */
  block: number;
}

/** No panel at the toasts' corner: they keep it. */
const NO_PANEL_OFFSETS: PanelOffsets = { inline: 0, block: 0 };

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
function getPanelOffsets(viewport: HTMLElement, position: ToastPosition): PanelOffsets {
  const panels = getOpenLayers().filter(
    (layer) => layer.kind === 'modal' || layer.kind === 'dialog',
  );
  if (panels.length === 0) return NO_PANEL_OFFSETS;
  const doc = viewport.ownerDocument;
  const view = doc.defaultView;
  if (!view) return NO_PANEL_OFFSETS;
  // The box fixed elements are placed in: the window without its scrollbars.
  const width = doc.documentElement.clientWidth || view.innerWidth;
  const height = doc.documentElement.clientHeight || view.innerHeight;
  const right = isOnRightSide(position, viewport);
  const top = position.startsWith('top');
  // Whether the toasts fit in what an offset leaves of the window's width or height.
  const fitsInline = (offset: number) => width - offset >= viewport.offsetWidth + 2 * EDGE_GAP;
  const fitsBlock = (offset: number) => height - offset >= viewport.offsetHeight + 2 * EDGE_GAP;

  let inline = 0;
  let block = 0;
  for (const layer of panels) {
    for (const el of layer.getElements()) {
      if (!el?.isConnected) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      const onSide = right ? box.right >= width - EDGE_GAP : box.left <= EDGE_GAP;
      const onEdge = top ? box.top <= EDGE_GAP : box.bottom >= height - EDGE_GAP;
      if (!onSide || !onEdge) continue;
      const inlineOffset = right ? width - box.left : box.right;
      const blockOffset = top ? box.bottom : height - box.top;
      if (fitsInline(inlineOffset)) inline = Math.max(inline, inlineOffset);
      else if (fitsBlock(blockOffset)) block = Math.max(block, blockOffset);
    }
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
  /** `error` toasts are announced assertively, every other status politely. */
  assertive: boolean;
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
  onDismiss: (id: string) => void;
  onExited: (id: string) => void;
  getFocusFallback: (from: HTMLElement | null) => HTMLElement | null;
  announce: (id: string, announcement: Announcement) => void;
  registerContainer: (id: string, node: HTMLElement | null) => void;
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
 * timers and keeps focus when the toast goes.
 */
function ToastContainer({
  entry,
  timers,
  onDismiss,
  onExited,
  getFocusFallback,
  announce,
  registerContainer,
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
  const mergedRef = useMergedRefs<HTMLDivElement>(attach, presenceRef);
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
    onDismiss(id);
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
    timers.start(entry.id, entry.seq, timeout);
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
      assertive: status === 'error',
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
    onDismiss(id);
  };

  if (!isMounted) return null;
  return (
    <div
      ref={mergedRef}
      role="group"
      tabIndex={-1}
      data-wave-toast=""
      aria-labelledby={joinIds(severityId, titlePart?.id)}
      aria-describedby={bodyPart?.id}
      className={cn(toasterClassNames.toast, 'rounded', focusRing)}
      {...presenceProps}
      onKeyDown={handleKeyDown}
    >
      {ownSeverityLabel ? <StatusText label={ownSeverityLabel} id={ownStatusTextId} /> : null}
      <ToastContext.Provider value={context}>
        {entry.form === 'options' ? (
          <ToastRoot
            status={entry.options.status}
            statusLabel={entry.options.statusLabel}
            title={entry.options.title}
            dismissLabel={entry.options.dismissLabel}
          >
            {entry.options.body}
          </ToastRoot>
        ) : (
          entry.content
        )}
      </ToastContext.Provider>
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
 * - While an open panel covers the toasts' corner (a Drawer on the same side, or at the bottom),
 *   the toasts move beside it, or above a bottom one (below it for top toasts), so they never hide
 *   its focused controls (WCAG 2.4.11). Without room there (a full-width panel on a narrow screen)
 *   they keep their corner.
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
 *
 * @example
 * <Toaster position="bottom-end" limit={3}>
 *   <App />
 * </Toaster>
 */
export const Toaster = ({
  position = 'bottom-end',
  limit: limitProp,
  shortcuts,
  toaster: handle,
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
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);
  // Each toast's message, written by its container after the toast mounts (a layout effect), so
  // the severity is the rendered Toast's and the text what the toast renders.
  const [announcements, setAnnouncements] = React.useState<ReadonlyMap<string, Announcement>>(
    () => new Map(),
  );
  const announce = React.useCallback((id: string, announcement: Announcement) => {
    setAnnouncements((prev) => {
      const current = prev.get(id);
      if (
        current &&
        current.seq === announcement.seq &&
        current.text === announcement.text &&
        current.assertive === announcement.assertive
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(id, announcement);
      return next;
    });
  }, []);
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

  // Beside or above an open panel at the toasts' corner (a Drawer), not over its controls. Measured
  // when a layer opens or closes (synchronously in its layout effect, before paint), on resize,
  // after a transition or animation (a panel that slides in reaches its place only then), and when
  // the region's own size changes (the stack's height decides whether it fits above a panel).
  const [panelOffsets, setPanelOffsets] = React.useState<PanelOffsets>(NO_PANEL_OFFSETS);
  React.useLayoutEffect(() => {
    // The region is observed from `update`, so a region that renders after this effect (its portal
    // waits for hydration) is observed from the next measure: a layer opening runs one.
    let observer: ResizeObserver | null = null;
    let observed: HTMLElement | null = null;
    const update = () => {
      const viewport = viewportRef.current;
      if (observer && viewport !== observed) {
        if (observed) observer.unobserve(observed);
        if (viewport) observer.observe(viewport);
        observed = viewport;
      }
      const next = viewport ? getPanelOffsets(viewport, position) : NO_PANEL_OFFSETS;
      setPanelOffsets((current) =>
        current.inline === next.inline && current.block === next.block ? current : next,
      );
    };
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(() => update());
    update();
    const unsubscribe = subscribeLayers(update);
    window.addEventListener('resize', update);
    document.addEventListener('transitionend', update, true);
    document.addEventListener('animationend', update, true);
    return () => {
      unsubscribe();
      observer?.disconnect();
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
        const entry: ToastEntry = { ...dispatched, id, seq, shown, dismissed: false };
        if (index === -1) return [...prev, entry];
        const next = prev.slice();
        next[index] = entry;
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
    () => ({ dispatchToast, dismissToast, dismissAllToasts }),
    [dispatchToast, dismissToast, dismissAllToasts],
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

  // The latest entries and every container element, for the shortcut's document listener.
  const toastsRef = React.useRef<ToastEntry[]>(settled);
  React.useLayoutEffect(() => {
    toastsRef.current = settled;
  });
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
    dismissAllToasts();
  };

  // Each shown toast's message for its first 2 s, while it is not dismissed (a waiting toast is
  // announced when it appears); a replacement is a new dispatch, so it is read again.
  const polite: React.ReactNode[] = [];
  const assertive: React.ReactNode[] = [];
  for (const toast of shownToasts) {
    if (toast.dismissed) continue;
    const announcement = announcements.get(toast.id);
    if (!announcement || announcement.seq !== toast.seq || !announcement.text) continue;
    const message = <LiveMessage key={announcement.seq} text={announcement.text} />;
    (announcement.assertive ? assertive : polite).push(message);
  }

  const viewportStyle =
    panelOffsets.inline > 0 || panelOffsets.block > 0
      ? ({
          ...style,
          ...(panelOffsets.inline > 0 && { '--wave-toaster-offset': `${panelOffsets.inline}px` }),
          ...(panelOffsets.block > 0 && {
            '--wave-toaster-offset-block': `${panelOffsets.block}px`,
          }),
        } as React.CSSProperties)
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
              announce={announce}
              registerContainer={registerContainer}
            />
          ))}
        </div>
      </Portal>
    </ToasterContext.Provider>
  );
};
Toaster.displayName = 'Toaster';
