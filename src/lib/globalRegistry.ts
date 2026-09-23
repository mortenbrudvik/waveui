const NAMESPACE = '@mortenbrudvik/waveui/';

type GlobalStore = Record<symbol, unknown>;

/**
 * Returns the module singleton registered under `key`, creating it with `create` on first use.
 *
 * The value is stored on `globalThis[Symbol.for('@mortenbrudvik/waveui/' + key)]` (non-enumerable),
 * so an app that evaluates the library twice — the ESM and the CJS build side by side (Next.js
 * server CJS + client ESM, or a dependency that `require`s the package) — still shares one layer
 * stack, focus-trap stack, scroll-lock counter, announcer and warn-once registry.
 *
 * Used by `layers.ts`, `useFocusTrap`, `useScrollLock`, `useAnnounce` and `dev.ts`.
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
