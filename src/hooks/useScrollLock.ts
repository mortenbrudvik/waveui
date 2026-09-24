import { useLayoutEffect } from 'react';
import { getGlobalRegistry } from '../lib/globalRegistry';

/** An inline declaration as it was before the lock (`value` is '' when it was not set). */
interface SavedDeclaration {
  name: string;
  value: string;
  priority: string;
}

/**
 * The longhands of `overflow`. A page may set `overflow-y: scroll` inline to keep its scrollbar:
 * the shorthand alone reads '' then, and setting it replaces (restoring '' removes) the longhands.
 */
const OVERFLOW_LONGHANDS = ['overflow-x', 'overflow-y'];

// The saved styles live in the global registry: another copy of the library (an older version
// too) may unlock what this one locked, so fields are only ever added.
interface SavedStyles {
  scroller: HTMLElement;
  /** The scroller's inline `overflow` shorthand before the lock. */
  overflow: string;
  /** Its inline `overflow-x`/`overflow-y` before the lock (missing when an older copy locked). */
  overflowLonghands?: SavedDeclaration[];
  /** The inline `scrollbar-gutter` of `<html>` before the lock, or `null` when the lock left it. */
  scrollbarGutter: string | null;
  /** The inline `padding-inline-end` of `<body>` before the lock, or `null` when the lock left it. */
  bodyPaddingInlineEnd: string | null;
}

interface ScrollLockState {
  count: number;
  saved: SavedStyles | null;
}

function getState(): ScrollLockState {
  return getGlobalRegistry<ScrollLockState>('scrollLock', () => ({ count: 0, saved: null }));
}

function supportsScrollbarGutter(): boolean {
  const css = (globalThis as { CSS?: { supports?: (property: string, value?: string) => boolean } })
    .CSS;
  if (!css || typeof css.supports !== 'function') return false;
  try {
    return css.supports('scrollbar-gutter', 'stable');
  } catch {
    return false;
  }
}

/** Width of the classic (layout-taking) viewport scrollbar; 0 for overlay scrollbars or no layout. */
function measureScrollbarWidth(): number {
  const html = document.documentElement;
  const clientWidth = html.clientWidth;
  if (!clientWidth) return 0; // no layout (jsdom, display: none)
  return Math.max(0, window.innerWidth - clientWidth);
}

function lock(state: ScrollLockState): void {
  const doc = document;
  const html = doc.documentElement;
  const scroller = (doc.scrollingElement as HTMLElement | null) ?? html;
  const body = doc.body;
  const scrollbarWidth = measureScrollbarWidth();

  // Only what the lock changes is recorded, so unlocking never overwrites styles that something
  // else set on <html>/<body> while the lock was held.
  const saved: SavedStyles = {
    scroller,
    overflow: scroller.style.overflow,
    overflowLonghands: OVERFLOW_LONGHANDS.map((name) => ({
      name,
      value: scroller.style.getPropertyValue(name),
      priority: scroller.style.getPropertyPriority(name),
    })),
    scrollbarGutter: null,
    bodyPaddingInlineEnd: null,
  };

  if (scrollbarWidth > 0) {
    if (supportsScrollbarGutter()) {
      saved.scrollbarGutter = html.style.getPropertyValue('scrollbar-gutter');
      html.style.setProperty('scrollbar-gutter', 'stable');
    } else if (body) {
      saved.bodyPaddingInlineEnd = body.style.paddingInlineEnd;
      const current = Number.parseFloat(getComputedStyle(body).paddingInlineEnd) || 0;
      body.style.paddingInlineEnd = `${current + scrollbarWidth}px`;
    }
  }
  scroller.style.overflow = 'hidden';
  state.saved = saved;
}

function unlock(state: ScrollLockState): void {
  const saved = state.saved;
  state.saved = null;
  if (!saved || typeof document === 'undefined') return;
  const html = document.documentElement;
  // Shorthand first: restoring '' removes the longhands, which are then set again where they were.
  const style = saved.scroller.style;
  style.overflow = saved.overflow;
  for (const { name, value, priority } of saved.overflowLonghands ?? []) {
    if (value) style.setProperty(name, value, priority);
    else style.removeProperty(name);
  }
  if (saved.scrollbarGutter !== null) {
    if (saved.scrollbarGutter) html.style.setProperty('scrollbar-gutter', saved.scrollbarGutter);
    else html.style.removeProperty('scrollbar-gutter');
  }
  if (saved.bodyPaddingInlineEnd !== null && document.body) {
    document.body.style.paddingInlineEnd = saved.bodyPaddingInlineEnd;
  }
}

function acquire(): () => void {
  const state = getState();
  state.count += 1;
  if (state.count === 1) lock(state);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count = Math.max(0, state.count - 1);
    if (state.count === 0) unlock(state);
  };
}

/**
 * Prevents the page behind a modal from scrolling while `enabled` (Dialog, Drawer).
 *
 * Locks are counted in a global registry shared by every copy of the library: the first lock
 * saves the document's inline styles and sets `overflow: hidden` on the document scroller; only
 * the last unlock restores them, so overlays that close out of order (or in the same commit) never
 * leave the page locked or unlocked too early. The scroller's `overflow-x` and `overflow-y` are
 * saved and restored one by one, with their priority (an inline `overflow-y: scroll` that keeps
 * the page's scrollbar survives).
 *
 * The layout stays put when a classic scrollbar disappears: with `scrollbar-gutter: stable` on
 * `<html>` where supported, otherwise by adding the measured scrollbar width to `<body>`'s
 * `padding-inline-end` (the correct side in RTL documents too). Unlocking restores only the
 * styles the lock changed. SSR-safe.
 */
export function useScrollLock(enabled: boolean): void {
  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    return acquire();
  }, [enabled]);
}
