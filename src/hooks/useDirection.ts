import { useCallback, useSyncExternalStore } from 'react';
import { getDirection, type Direction } from '../lib/direction';
import { useWaveTheme } from '../components/provider/WaveProvider';

/**
 * One MutationObserver per document, shared by every subscriber (ref-counted): it watches every
 * `dir` attribute of the document (`<html>`, WaveProvider roots, `dir` sections, the elements
 * themselves) and invalidates the cached directions before it notifies the subscribers.
 */
interface SharedDirectionObserver {
  observer: MutationObserver;
  listeners: Set<() => void>;
}

const sharedObservers = new Map<Document, SharedDirectionObserver>();

/**
 * Bumped whenever a shared observer reports a `dir` change (and when an observer starts, since
 * nothing watched the document before). A cached direction is valid only for the version it was
 * read at.
 */
let cacheVersion = 0;
const directionCache = new WeakMap<Element, { version: number; direction: Direction }>();

function noopUnsubscribe(): void {}

function subscribeToDirectionChanges(doc: Document, notify: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return noopUnsubscribe;
  let shared = sharedObservers.get(doc);
  if (!shared) {
    const listeners = new Set<() => void>();
    const observer = new MutationObserver(() => {
      cacheVersion += 1;
      for (const listener of Array.from(listeners)) listener();
    });
    observer.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['dir'],
      subtree: true,
    });
    cacheVersion += 1;
    shared = { observer, listeners };
    sharedObservers.set(doc, shared);
  }
  const current = shared;
  // A wrapper per subscription, so two subscriptions with the same callback are counted twice.
  const listener = () => notify();
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && sharedObservers.get(doc) === current) {
      current.observer.disconnect();
      sharedObservers.delete(doc);
    }
  };
}

/**
 * `getDirection(el)`, cached per element while the shared observer of its document runs (that is,
 * while anything subscribes), so a render does not walk `getComputedStyle` up the ancestors.
 * Without an observer, or for a detached element, it is read directly.
 */
function readDirection(el: Element): Direction {
  if (!el.isConnected || !sharedObservers.has(el.ownerDocument)) return getDirection(el);
  const cached = directionCache.get(el);
  if (cached && cached.version === cacheVersion) return cached.direction;
  const direction = getDirection(el);
  directionCache.set(el, { version: cacheVersion, direction });
  return direction;
}

function getDocumentDirection(): Direction {
  return readDirection(document.body ?? document.documentElement);
}

function getServerDirection(): Direction {
  return 'ltr';
}

/**
 * The writing direction for the caller.
 *
 * - **Without an element** (`useDirection()`): the `dir` of the nearest {@link WaveProvider};
 *   outside a provider the document's direction (`<html dir="rtl">`, updated when it changes).
 *   Callers inside a provider do not read or observe the document.
 * - **With an element** (`useDirection(el)`): the direction that applies to that element — its own
 *   `dir`, else the nearest ancestor's (an RTL section inside an LTR provider and the reverse), else
 *   the computed direction (`getDirection(el)`). It updates when any `dir` attribute of the
 *   element's document changes, including a WaveProvider root. While `el` is `null` (before the
 *   element mounts) and on the server it falls back to the provider or document direction, as
 *   without an element.
 * - `'ltr'` on the server outside a provider.
 *
 * All callers that observe the document share one ref-counted MutationObserver per document
 * (`dir` attributes, whole subtree). An element's direction is cached until that observer reports
 * a `dir` change, so re-renders do not read computed styles. Changes the observer cannot see are
 * not picked up until the next `dir` change: moving the element under a different `dir` ancestor,
 * or a stylesheet `direction` change without a `dir` attribute.
 *
 * Use it during render (placement of start/end popups, slide offsets, directional glyphs). Keyboard
 * handlers resolve direction at event time with `getDirection(event.currentTarget)` instead.
 *
 * @param el - The rendered element whose direction applies (typically from a callback ref kept in
 *   state), or `null`/omitted for the provider or document direction.
 *
 * @example
 * const [root, setRoot] = React.useState<HTMLDivElement | null>(null);
 * const dir = useDirection(root);
 * return <div ref={setRoot} style={{ transform: `translateX(${dir === 'rtl' ? '' : '-'}${index * 100}%)` }} />;
 */
export function useDirection(el?: Element | null): Direction {
  const { dir, hasProvider } = useWaveTheme();
  const element = el ?? null;

  const subscribe = useCallback(
    (notify: () => void): (() => void) => {
      if (element) return subscribeToDirectionChanges(element.ownerDocument, notify);
      if (hasProvider || typeof document === 'undefined') return noopUnsubscribe;
      return subscribeToDirectionChanges(document, notify);
    },
    [element, hasProvider],
  );

  const getSnapshot = useCallback((): Direction => {
    if (element) return readDirection(element);
    return hasProvider ? dir : getDocumentDirection();
  }, [element, hasProvider, dir]);

  const getServerSnapshot = useCallback(
    (): Direction => (hasProvider ? dir : getServerDirection()),
    [hasProvider, dir],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
