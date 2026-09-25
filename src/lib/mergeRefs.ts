import type * as React from 'react';

type RefCleanup = () => void;

/**
 * Writes `value` into a ref: calls a callback ref (returning its React 19 cleanup, if any) or
 * assigns `current` on an object ref. `null`/`undefined` refs are ignored.
 */
export function setRef<T>(
  ref: React.Ref<T> | undefined | null,
  value: T | null,
): void | RefCleanup {
  if (typeof ref === 'function') {
    const cleanup: unknown = ref(value);
    return typeof cleanup === 'function' ? (cleanup as RefCleanup) : undefined;
  }
  if (ref) {
    (ref as React.RefObject<T | null>).current = value;
  }
}

/**
 * Merges several refs into one callback ref (React 19 cleanup-aware).
 *
 * On attach every ref receives the node. The merged callback returns a single cleanup, so React 19
 * calls it on detach instead of calling the ref with `null`; that cleanup runs each callback ref's
 * own cleanup, calls callback refs without a cleanup with `null`, and resets object refs to `null`.
 *
 * The result is a new function on every call: inside components use the `useMergedRefs` hook
 * (also exported from this package), which memoises it, so the refs are not detached and
 * re-attached on every render.
 */
export function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  return (node: T | null) => {
    const cleanups: RefCleanup[] = [];
    for (const ref of refs) {
      if (!ref) continue;
      const cleanup = setRef(ref, node);
      if (cleanup) {
        cleanups.push(cleanup);
      } else if (typeof ref === 'function') {
        cleanups.push(() => {
          ref(null);
        });
      } else {
        cleanups.push(() => {
          setRef(ref, null);
        });
      }
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}
