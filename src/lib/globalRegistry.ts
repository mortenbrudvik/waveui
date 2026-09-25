const NAMESPACE = '@mortenbrudvik/waveui/';

type GlobalStore = Record<symbol, unknown>;

/**
 * Returns the module singleton registered under `key`, creating it with `create` on first use.
 *
 * The value is stored on `globalThis[Symbol.for('@mortenbrudvik/waveui/' + key)]` (non-enumerable),
 * so an app that evaluates the library twice — the ESM and the CJS build side by side (Next.js
 * server CJS + client ESM, or a dependency that `require`s the package) — still shares one state
 * per key. A change to the value shape stored under a key must stay compatible with the other copy.
 *
 * Keys and their users:
 * - `'layers'` — the dismiss-layer stack (`layers.ts`);
 * - `'traps'` — the focus-trap stack (`useFocusTrap`);
 * - `'scrollLock'` — the scroll-lock counter (`useScrollLock`);
 * - `'inert'` — the elements made inert behind a modal (`useModalIsolation`);
 * - `'restoreFocusTracker'` — the pointer/focus tracker of `useRestoreFocus`;
 * - `'announcer'` — the live-region announcer (`useAnnounce`);
 * - `'orderedSurfaces'` — the open surfaces whose keyboard order `usePopoverTabOrder` manages
 *   (`Popover.shared.tsx`);
 * - `'warnings'` and `'missing-context'` — the warn-once keys and the logged missing-context
 *   texts (`dev.ts`).
 *
 * @param key     Registry name, e.g. `'warnings'` or `'layers'`.
 * @param create  Factory for the initial value; called at most once per realm.
 */
export function getGlobalRegistry<T>(key: string, create: () => T): T {
  const symbol = Symbol.for(NAMESPACE + key);
  const store = globalThis as unknown as GlobalStore;
  if (!Object.prototype.hasOwnProperty.call(store, symbol)) {
    Object.defineProperty(store, symbol, {
      value: create(),
      configurable: true,
      enumerable: false,
      writable: true,
    });
  }
  return store[symbol] as T;
}
