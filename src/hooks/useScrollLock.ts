import { useEffect, useLayoutEffect } from 'react';
import { getGlobalRegistry } from '../lib/globalRegistry';

const useIsomorphicLayoutEffect = typeof document !== 'undefined' ? useLayoutEffect : useEffect;

interface SavedStyles {
  scroller: HTMLElement;
  overflow: string;
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
  saved.scroller.style.overflow = saved.overflow;
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
 * leave the page locked or unlocked too early.
 *
 * The layout stays put when a classic scrollbar disappears: with `scrollbar-gutter: stable` on
 * `<html>` where supported, otherwise by adding the measured scrollbar width to `<body>`'s
 * `padding-inline-end` (the correct side in RTL documents too). Unlocking restores only the
 * styles the lock changed. SSR-safe.
 */
export function useScrollLock(enabled: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    return acquire();
  }, [enabled]);
}
