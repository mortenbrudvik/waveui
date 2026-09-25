import { useEffect } from 'react';
import { getGlobalRegistry } from '../lib/globalRegistry';

/** How urgently assistive technology should read a message. */
export type Politeness = 'polite' | 'assertive';

interface AnnouncerState {
  root: HTMLElement | null;
  regions: Record<Politeness, HTMLElement> | null;
  /** Number of mounted `useAnnounce` callers. */
  users: number;
  /** `false` until one frame has passed since the regions were created. */
  settled: boolean;
  queued: Partial<Record<Politeness, string>>;
  cancelFrame: (() => void) | null;
}

const POLITENESS: readonly Politeness[] = ['polite', 'assertive'];

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
  return getGlobalRegistry<AnnouncerState>('announcer', () => ({
    root: null,
    regions: null,
    users: 0,
    settled: false,
    queued: {},
    cancelFrame: null,
  }));
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
    if (!regions) return;
    for (const politeness of POLITENESS) {
      const message = queued[politeness];
      if (message !== undefined) regions[politeness].textContent = message;
    }
  });
}

function removeRegions(state: AnnouncerState): void {
  state.cancelFrame?.();
  state.cancelFrame = null;
  state.root?.remove();
  state.root = null;
  state.regions = null;
  state.settled = false;
  state.queued = {};
}

/** Creates the singleton regions when they do not exist (or were removed from the document). */
function ensureRegions(state: AnnouncerState): Record<Politeness, HTMLElement> {
  if (state.root && state.regions && state.root.isConnected) return state.regions;
  removeRegions(state);

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
  // Live regions must exist before their content changes: the first write waits one frame.
  scheduleFlush(state);
  return state.regions;
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
 * @param message    The text to read.
 * @param politeness `'polite'` (default, `role="status"`) or `'assertive'`.
 */
export function announce(message: string, politeness: Politeness = 'polite'): void {
  if (!canUseDom()) return;
  const state = getState();
  const regions = ensureRegions(state);
  const region = regions[politeness];

  // A message still waiting for the next frame (regions being created, or a repeat whose region
  // was cleared) is replaced, so the last call wins and the flush never writes an older message.
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

/**
 * Returns {@link announce} and keeps the shared live regions alive while the caller is mounted
 * (they are created on mount and removed when the last caller unmounts).
 *
 * @example
 * const say = useAnnounce();
 * say(`${label} removed, ${count} selected`);
 */
export function useAnnounce(): (message: string, politeness?: Politeness) => void {
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
