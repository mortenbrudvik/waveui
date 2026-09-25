import { useCallback, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { setRef } from '../lib/mergeRefs';

type AnyRef<T> = React.Ref<T> | undefined | null;
type RefList<T> = ReadonlyArray<AnyRef<T>>;
type PresentRef<T> = NonNullable<React.Ref<T>>;

interface AttachedRef<T> {
  ref: PresentRef<T>;
  /** Runs the ref's React 19 cleanup, or passes `null` to it (object refs: `current = null`). */
  detach: () => void;
}

interface MergedRefState<T> {
  /**
   * The refs of the render being committed. Recorded in the mutation phase (insertion effect),
   * before React attaches refs in the layout phase, so the ref callback never attaches a ref that is
   * no longer in the list, and never one from a render that was not committed (the first
   * StrictMode invocation, a render discarded by a render-phase update).
   */
  refs: RefList<T>;
  /** The element the merged ref is attached to, or `null`. */
  node: T | null;
  /** The refs `node` is attached to, each with its detach function. */
  attached: AttachedRef<T>[];
}

function sameRefs<T>(a: RefList<T>, b: RefList<T>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** The present refs, each once, in order. */
function presentRefs<T>(refs: RefList<T>): PresentRef<T>[] {
  const result: PresentRef<T>[] = [];
  for (const ref of refs) {
    if (ref && !result.includes(ref)) result.push(ref);
  }
  return result;
}

function attach<T>(ref: PresentRef<T>, node: T): AttachedRef<T> {
  const cleanup = setRef(ref, node);
  return {
    ref,
    detach:
      cleanup ??
      (() => {
        setRef(ref, null);
      }),
  };
}

function detachAll<T>(state: MergedRefState<T>): void {
  const { attached } = state;
  state.attached = [];
  state.node = null;
  for (const entry of attached) entry.detach();
}

/**
 * Merges several refs into one callback ref whose identity never changes (React 19 cleanup-aware,
 * like {@link mergeRefs}, which merges refs without a hook).
 *
 * - The element is attached to every ref when it mounts and detached when it unmounts (object refs
 *   reset to `null`; callback refs get their React 19 cleanup called, or `null`).
 * - Refs that keep their identity across renders (object refs, `useCallback` refs, stable ref
 *   props) receive the node **once**: the element is not detached and re-attached on every render.
 * - Refs may change between renders — also inline callbacks such as
 *   `useMergedRefs(props.ref, (node) => { … })` or a fresh `mergeRefs(…)` result. After each commit
 *   a ref that left the list is detached and a new one is attached to the current element, which is
 *   what React itself does for an inline callback ref (detach + re-attach per render). The hook
 *   never sets state, so an unstable ref cannot cause a render loop.
 * - A ref only receives the element for a render it is part of: an element that appears or is
 *   replaced in the same commit in which the list changes goes straight to the new list, and the
 *   inline refs of renders that were never committed (StrictMode's first invocation, a render
 *   discarded by a render-phase update) never receive it.
 *
 * Attach the returned ref to one element.
 *
 * @example
 * const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
 * const ref = useMergedRefs(props.ref, setSurface);
 * return <div ref={ref} />;
 *
 * @param refs - Object refs, callback refs, `null` or `undefined` (ignored).
 * @returns A stable callback ref that forwards the node to every ref.
 */
export function useMergedRefs<T>(
  ...refs: Array<React.Ref<T> | undefined | null>
): React.RefCallback<T> {
  // Written only in the insertion effect, the ref callback and the layout effect below (C-HOOKS:
  // never during render). The initial `refs` is replaced by the insertion effect before any attach.
  const stateRef = useRef<MergedRefState<T>>({ refs, node: null, attached: [] });

  // Mutation phase of every commit, before React attaches refs (layout phase): record this
  // render's refs for the ref callback.
  useInsertionEffect(() => {
    stateRef.current.refs = refs;
  });

  const mergedRef = useCallback((node: T | null) => {
    const state = stateRef.current;
    detachAll(state);
    if (node === null) return;
    state.node = node;
    state.attached = presentRefs(state.refs).map((ref) => attach(ref, node));
    return () => {
      // Only the element that is still attached detaches (the ref moved to another element first).
      if (state.node === node) detachAll(state);
    };
  }, []);

  // After every commit in which the element stayed: bring the attached refs in line with this
  // render's refs (the ref callback already used them when the element changed).
  useLayoutEffect(() => {
    const state = stateRef.current;
    const { node } = state;
    if (node === null) return;
    const next = presentRefs(refs);
    if (
      sameRefs(
        state.attached.map((entry) => entry.ref),
        next,
      )
    ) {
      return;
    }
    const kept = new Map<PresentRef<T>, AttachedRef<T>>();
    for (const entry of state.attached) {
      if (next.includes(entry.ref)) kept.set(entry.ref, entry);
      else entry.detach();
    }
    state.attached = next.map((ref) => kept.get(ref) ?? attach(ref, node));
  });

  return mergedRef;
}
