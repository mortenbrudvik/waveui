import { useEffect } from 'react';
import { isEditableTarget } from '../lib/events';
import { getGlobalRegistry } from '../lib/globalRegistry';

/** How urgently assistive technology should read a message. */
export type Politeness = 'polite' | 'assertive';

/**
 * Options of {@link announce}. A call with none of `batchId`, `priority` and `deferWhileTyping`
 * keeps the behaviour of a plain call: the message is written at once, and the last call before
 * the next animation frame wins.
 */
export interface AnnounceOptions {
  /**
   * `'polite'` (`role="status"`) or `'assertive'`. Fluent's `polite` (a boolean) and `alert`.
   * @default 'polite'
   */
  politeness?: Politeness;
  /**
   * Names a batch of messages that replace one another: a message waits in the queue until it is
   * read, and a later call with the same `batchId` takes its place, so a counter that changes
   * quickly ("3 results", "5 results") reads only its latest value. Calls without a `batchId` are
   * never replaced by it. Giving one queues the message (see `priority`). Fluent's `batchId`.
   */
  batchId?: string;
  /**
   * Orders queued messages: a message with a higher number is read before the others that wait
   * (the earlier call first among equals). Giving one queues the message: queued messages are
   * written one at a time, 400 ms apart, so each is read before the next replaces it. With
   * `ariaNotify`, a number above 0 is a `high` priority notification. Fluent's `priority`.
   * @default 0
   */
  priority?: number;
  /**
   * Holds the message while the user is typing in a text field: it waits until no text has been
   * entered into an editable element for 700 ms, so the screen reader's echo of the typed
   * characters is not interrupted (a result count announced while someone types a query).
   * Typing is observed while the announcer exists (from the first `announce()` call or
   * `useAnnounce` mount until the last caller unmounts). Giving it queues the message (see
   * `priority`).
   */
  deferWhileTyping?: boolean;
  /**
   * Sends the message through the browser's `ariaNotify` where it exists (it needs no live
   * region and is read in order by the screen reader), and through the live regions elsewhere.
   * A message sent this way is not repeated in a region.
   * @default false
   */
  ariaNotify?: boolean;
}

/** A message waiting in the queue of the calls that gave `batchId`, `priority` or `deferWhileTyping`. */
interface QueuedMessage {
  message: string;
  politeness: Politeness;
  batchId: string | undefined;
  priority: number;
  deferWhileTyping: boolean;
  ariaNotify: boolean;
  /** The order of the calls, so equal priorities keep it. */
  order: number;
}

interface AnnouncerState {
  root: HTMLElement | null;
  regions: Record<Politeness, HTMLElement> | null;
  /** Number of mounted `useAnnounce` callers. */
  users: number;
  /** `false` until one frame has passed since the regions were created. */
  settled: boolean;
  queued: Partial<Record<Politeness, string>>;
  cancelFrame: (() => void) | null;
  /** Messages that wait for their turn (the calls with `batchId`, `priority` or `deferWhileTyping`). */
  queue: QueuedMessage[];
  /** Counts the calls that were queued. */
  order: number;
  /** When the queue may write the next message (`Date.now()`), after the one it wrote. */
  nextAt: number;
  /** The timer that runs the queue again (a gap or a typing pause), or `null`. */
  pumpTimer: ReturnType<typeof setTimeout> | null;
  /** Whether a run of the queue is scheduled for the end of the current task. */
  pumpQueued: boolean;
  /** When text was last entered into an editable element (`Date.now()`), `0` for never. */
  typingAt: number;
  stopTyping: (() => void) | null;
}

const POLITENESS: readonly Politeness[] = ['polite', 'assertive'];

/** The pause between two queued messages, so one is read before the next replaces it. */
const QUEUE_GAP = 400;

/** How long after the last typed text a message that waits for typing to stop is released. */
const TYPING_PAUSE = 700;

const VISUALLY_HIDDEN: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
};

function getState(): AnnouncerState {
  const state = getGlobalRegistry<AnnouncerState>('announcer', () => ({
    root: null,
    regions: null,
    users: 0,
    settled: false,
    queued: {},
    cancelFrame: null,
    queue: [],
    order: 0,
    nextAt: 0,
    pumpTimer: null,
    pumpQueued: false,
    typingAt: 0,
    stopTyping: null,
  }));
  // The state is shared by every copy of the package in the page: one that created it before the
  // queue existed lacks these members.
  state.queue ??= [];
  state.order ??= 0;
  state.nextAt ??= 0;
  state.pumpTimer ??= null;
  state.pumpQueued ??= false;
  state.typingAt ??= 0;
  state.stopTyping ??= null;
  return state;
}

function canUseDom(): boolean {
  return typeof document !== 'undefined' && document.body != null;
}

function requestFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const handle = requestAnimationFrame(() => callback());
    return () => cancelAnimationFrame(handle);
  }
  const handle = setTimeout(callback, 16);
  return () => clearTimeout(handle);
}

function scheduleFlush(state: AnnouncerState): void {
  if (state.cancelFrame) return;
  state.cancelFrame = requestFrame(() => {
    state.cancelFrame = null;
    state.settled = true;
    const regions = state.regions;
    const queued = state.queued;
    state.queued = {};
    if (regions) {
      for (const politeness of POLITENESS) {
        const message = queued[politeness];
        if (message !== undefined) regions[politeness].textContent = message;
      }
    }
    // Messages that waited for the regions to settle are due now.
    pump(state);
  });
}

function removeRegions(state: AnnouncerState): void {
  state.cancelFrame?.();
  state.cancelFrame = null;
  if (state.pumpTimer !== null) clearTimeout(state.pumpTimer);
  state.pumpTimer = null;
  state.pumpQueued = false;
  state.stopTyping?.();
  state.stopTyping = null;
  state.root?.remove();
  state.root = null;
  state.regions = null;
  state.settled = false;
  state.queued = {};
  state.queue = [];
  state.nextAt = 0;
  state.typingAt = 0;
}

/** Records when text is entered into an editable element (an `input` event, IME composition included). */
function trackTyping(state: AnnouncerState): () => void {
  const handleInput = (event: Event) => {
    if (isEditableTarget(event.target)) state.typingAt = Date.now();
  };
  document.addEventListener('input', handleInput, true);
  return () => document.removeEventListener('input', handleInput, true);
}

/** Creates the singleton regions when they do not exist (or were removed from the document). */
function ensureRegions(state: AnnouncerState): Record<Politeness, HTMLElement> {
  if (state.root && state.regions && state.root.isConnected) return state.regions;
  // Regions that were removed from the document come back with the messages that still wait.
  const waiting = state.queue;
  removeRegions(state);
  state.queue = waiting;

  const root = document.createElement('div');
  root.setAttribute('data-wave-announcer', '');
  Object.assign(root.style, VISUALLY_HIDDEN);

  const polite = document.createElement('div');
  polite.setAttribute('role', 'status');
  polite.setAttribute('aria-live', 'polite');
  polite.setAttribute('aria-atomic', 'true');

  const assertive = document.createElement('div');
  assertive.setAttribute('aria-live', 'assertive');
  assertive.setAttribute('aria-atomic', 'true');

  root.append(polite, assertive);
  document.body.appendChild(root);

  state.root = root;
  state.regions = { polite, assertive };
  state.settled = false;
  state.stopTyping = trackTyping(state);
  // Live regions must exist before their content changes: the first write waits one frame.
  scheduleFlush(state);
  return state.regions;
}

/** The part of the `ariaNotify` API that is used (Chromium's `ariaNotify` on a document or element). */
interface AriaNotifyHost {
  ariaNotify?: (message: string, options?: { priority?: 'normal' | 'high' }) => void;
}

/** Sends `message` through `ariaNotify`; `false` where the browser has none. */
function notify(message: string, priority: number): boolean {
  const host = [document, document.body].find(
    (candidate) => typeof (candidate as AriaNotifyHost).ariaNotify === 'function',
  ) as AriaNotifyHost | undefined;
  if (!host?.ariaNotify) return false;
  host.ariaNotify(message, { priority: priority > 0 ? 'high' : 'normal' });
  return true;
}

/**
 * Writes a message to its region (or sends it through `ariaNotify`). A message still waiting for
 * the next frame (regions being created, or a repeat whose region was cleared) is replaced, so
 * the last call wins and the flush never writes an older message; repeating the current message
 * clears the region and writes it again on the next frame.
 */
function write(
  state: AnnouncerState,
  message: string,
  politeness: Politeness,
  wantsNotify: boolean,
  priority: number,
): void {
  if (wantsNotify && notify(message, priority)) return;
  const region = ensureRegions(state)[politeness];
  if (!state.settled || state.queued[politeness] !== undefined) {
    state.queued[politeness] = message;
    return;
  }
  if (region.textContent === message) {
    region.textContent = '';
    state.queued[politeness] = message;
    scheduleFlush(state);
    return;
  }
  region.textContent = message;
}

/** Runs the queue again after `delay` milliseconds. */
function schedulePump(state: AnnouncerState, delay: number): void {
  if (state.pumpTimer !== null) clearTimeout(state.pumpTimer);
  state.pumpTimer = setTimeout(
    () => {
      state.pumpTimer = null;
      pump(state);
    },
    Math.max(0, delay),
  );
}

/**
 * Writes the next queued message once the regions have settled, the gap after the previous one has
 * passed and, for a message that waits for typing to stop, the user has stopped typing: the one
 * with the highest priority, the earliest call among equals.
 */
function pump(state: AnnouncerState): void {
  if (state.queue.length === 0 || !state.regions) return;
  // A message sent through ariaNotify needs no region; the others wait for the first frame.
  if (!state.settled && state.queue.some((item) => !item.ariaNotify)) return;
  const now = Date.now();
  if (now < state.nextAt) {
    schedulePump(state, state.nextAt - now);
    return;
  }
  const typingWait = state.typingAt > 0 ? state.typingAt + TYPING_PAUSE - now : 0;
  let best: QueuedMessage | undefined;
  for (const item of state.queue) {
    if (item.deferWhileTyping && typingWait > 0) continue;
    if (!best || item.priority > best.priority) best = item;
  }
  if (!best) {
    schedulePump(state, typingWait);
    return;
  }
  state.queue = state.queue.filter((item) => item !== best);
  write(state, best.message, best.politeness, best.ariaNotify, best.priority);
  state.nextAt = now + QUEUE_GAP;
  if (state.queue.length > 0) schedulePump(state, QUEUE_GAP);
}

/**
 * Announces `message` to screen readers through a shared, visually hidden live region
 * (`[data-wave-announcer]`, which modal isolation never makes inert).
 *
 * The regions are created on first use — the first `useAnnounce` mount or the first `announce()`
 * call. A message sent while they are being created is written on the next animation frame, so it
 * is not lost; repeating the current message clears the region and writes it again on the next
 * frame, so it is read again. A message sent while one is waiting for that frame replaces it (the
 * last call wins). No-op on the server.
 *
 * The second argument is a `politeness` (`'polite'`, the default, or `'assertive'`) or an
 * {@link AnnounceOptions} object. A call that gives `batchId`, `priority` or `deferWhileTyping`
 * queues its message instead: messages of one batch replace one another, a higher `priority` is
 * read first, queued messages are written 400 ms apart, and one that defers while typing waits
 * until text has not been entered for 700 ms. `ariaNotify` sends the message through the
 * browser's `ariaNotify` where it exists.
 *
 * @param message    The text to read.
 * @param options    `'polite'` (default, `role="status"`), `'assertive'`, or an options object.
 *
 * @example
 * // A result count that changes as someone types: read the latest, after they pause.
 * announce(`${count} results`, { batchId: 'results', deferWhileTyping: true });
 */
export function announce(message: string, options: Politeness | AnnounceOptions = 'polite'): void {
  if (!canUseDom()) return;
  const config: AnnounceOptions = typeof options === 'string' ? { politeness: options } : options;
  const politeness: Politeness = config.politeness === 'assertive' ? 'assertive' : 'polite';
  const state = getState();
  ensureRegions(state);

  const priority =
    typeof config.priority === 'number' && Number.isFinite(config.priority) ? config.priority : 0;
  const queues =
    config.batchId !== undefined || config.priority !== undefined || config.deferWhileTyping;
  if (!queues) {
    write(state, message, politeness, config.ariaNotify === true, priority);
    return;
  }

  state.order += 1;
  const next: QueuedMessage = {
    message,
    politeness,
    batchId: config.batchId,
    priority,
    deferWhileTyping: config.deferWhileTyping === true,
    ariaNotify: config.ariaNotify === true,
    order: state.order,
  };
  // A message of the batch that has not been read yet is replaced by this one.
  state.queue = [
    ...state.queue.filter((item) => next.batchId === undefined || item.batchId !== next.batchId),
    next,
  ].sort((a, b) => b.priority - a.priority || a.order - b.order);
  // Run at the end of this task, so calls made together are ordered by priority.
  if (!state.pumpQueued) {
    state.pumpQueued = true;
    queueMicrotask(() => {
      state.pumpQueued = false;
      pump(state);
    });
  }
}

/**
 * Returns {@link announce} and keeps the shared live regions alive while the caller is mounted
 * (they are created on mount and removed when the last caller unmounts).
 *
 * @example
 * const say = useAnnounce();
 * say(`${label} removed, ${count} selected`);
 */
export function useAnnounce(): (message: string, options?: Politeness | AnnounceOptions) => void {
  useEffect(() => {
    if (!canUseDom()) return;
    const state = getState();
    state.users += 1;
    ensureRegions(state);
    return () => {
      state.users = Math.max(0, state.users - 1);
      if (state.users === 0) removeRegions(state);
    };
  }, []);
  return announce;
}

/** Test helper: the current text of a region (`''` when the regions do not exist). */
export function __getAnnouncerText(politeness: Politeness = 'polite'): string {
  return getState().regions?.[politeness].textContent ?? '';
}

/** Test helper: removes the regions and forgets queued messages and mounted callers. */
export function __resetAnnouncer(): void {
  const state = getState();
  removeRegions(state);
  state.users = 0;
}
