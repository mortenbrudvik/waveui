import * as React from 'react';

/*
 * The scroll state of a drawer's scrolling body, which draws the separators of its header and
 * footer. Imports no component; the root, the parts and NavDrawer read it.
 */

/**
 * How far a scrolling body is scrolled: `none` (the content fits), `top` (at the top, more below),
 * `middle`, or `bottom` (at the end). Rendered as `data-scroll-state`.
 */
export type DrawerScrollState = 'none' | 'top' | 'middle' | 'bottom';

/**
 * Below this distance (px) an overflow or a scroll offset counts as none: zoom and high-density
 * screens give fractional offsets, so the end of the content can sit a fraction of a pixel away.
 */
const SCROLL_TOLERANCE = 1;

/** The scroll state of `element`, with a 1px tolerance on each threshold. */
function getScrollState(element: HTMLElement): DrawerScrollState {
  const { scrollTop, scrollHeight, clientHeight } = element;
  if (scrollHeight - clientHeight < SCROLL_TOLERANCE) return 'none';
  if (scrollTop < SCROLL_TOLERANCE) return 'top';
  if (scrollTop + clientHeight >= scrollHeight - SCROLL_TOLERANCE) return 'bottom';
  return 'middle';
}

/**
 * Calls `onChange` whenever the scroll state of `element` may have changed: a scroll (a passive
 * listener on the element), a size change of the element or of one of its element children (a
 * `ResizeObserver`, where it exists), and a change of its content (a `MutationObserver`, which
 * also observes the children it adds). Content can grow without a render of its own (an
 * Accordion expanding, an image loading) while the element's box stays the same, which observing
 * only the element would miss. Adds no `document` listener. Returns the unsubscribe function.
 */
function subscribeScrollState(element: HTMLElement, onChange: () => void): () => void {
  element.addEventListener('scroll', onChange, { passive: true });
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onChange());
  const observeBoxes = () => {
    if (!resizeObserver) return;
    resizeObserver.disconnect();
    resizeObserver.observe(element);
    for (const child of Array.from(element.children)) resizeObserver.observe(child);
  };
  observeBoxes();
  const mutationObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          observeBoxes();
          onChange();
        });
  mutationObserver?.observe(element, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  });
  return () => {
    element.removeEventListener('scroll', onChange);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
  };
}

/** The server snapshot: nothing is measured on the server. */
const getServerSnapshot = (): DrawerScrollState => 'none';

/**
 * The scroll state of `element` (held in state through a callback ref), read through
 * `useSyncExternalStore`: the component re-renders only when the state changes. `'none'` for
 * `null` and on the server.
 */
export function useScrollState(element: HTMLElement | null): DrawerScrollState {
  const subscribe = React.useCallback(
    (onChange: () => void) => (element ? subscribeScrollState(element, onChange) : () => {}),
    [element],
  );
  const getSnapshot = React.useCallback(
    (): DrawerScrollState => (element ? getScrollState(element) : 'none'),
    [element],
  );
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The separators of a drawer's header (`header`: a line under it while the body is scrolled away
 * from its top) and footer (`footer`: a line above it while content continues below). Each is a
 * border that always exists and only changes colour with the element's `data-scroll-state`, so it
 * never shifts the layout; forced colors draw both lines at all times. Literal strings, so the
 * module makes no call at load and the CSS build sees every class.
 */
export const scrollSeparatorClasses = {
  header:
    'border-b border-transparent data-[scroll-state=middle]:border-border data-[scroll-state=bottom]:border-border forced-colors:border-[CanvasText]',
  footer:
    'border-t border-transparent data-[scroll-state=top]:border-border data-[scroll-state=middle]:border-border forced-colors:border-[CanvasText]',
} as const satisfies { readonly header: string; readonly footer: string };
