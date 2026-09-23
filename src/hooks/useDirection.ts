import { useSyncExternalStore } from 'react';
import { getDirection, type Direction } from '../lib/direction';
import { useWaveTheme } from '../components/provider/WaveProvider';

function subscribeToDocumentDirection(notify: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ['dir'] });
  }
  return () => observer.disconnect();
}

function getDocumentDirection(): Direction {
  return getDirection(document.body ?? document.documentElement);
}

function getServerDirection(): Direction {
  return 'ltr';
}

/** Inside a provider the document is not read: no observer, a constant snapshot. */
function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * The writing direction for the caller: the `dir` of the nearest {@link WaveProvider}; outside a
 * provider the document's direction (`<html dir="rtl">`, updated when it changes); `'ltr'` on the
 * server. Only callers outside a provider observe the document.
 *
 * Use it during render (placement of start/end popups, directional glyphs). Keyboard handlers
 * resolve direction at event time with `getDirection(event.currentTarget)` instead.
 */
export function useDirection(): Direction {
  const { dir, hasProvider } = useWaveTheme();
  const documentDirection = useSyncExternalStore(
    hasProvider ? subscribeToNothing : subscribeToDocumentDirection,
    hasProvider ? getServerDirection : getDocumentDirection,
    getServerDirection,
  );
  return hasProvider ? dir : documentDirection;
}
