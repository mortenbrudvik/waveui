import { useSyncExternalStore } from 'react';

function subscribe(): () => void {
  return () => {};
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * `false` on the server and during hydration, `true` in every other client render — including the
 * first render of a component mounted on the client, so no second commit is needed.
 *
 * Use it instead of a "mounted" state flag set in an effect (C-HOOKS), e.g. to render a portal
 * only on the client: `if (!useIsClient()) return null;`.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
