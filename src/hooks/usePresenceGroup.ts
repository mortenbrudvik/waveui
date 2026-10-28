import { cloneElement, isValidElement, useCallback, useState } from 'react';
import type * as React from 'react';
import { flattenChildren } from '../lib/children';

/** One child of the group: shown, or kept while it exits. */
export interface PresenceGroupEntry {
  /** The child's key among the group's flattened children (`flattenChildren`), e.g. `.$id`. */
  key: string;
  /** The child: its latest element while shown, the last one it had while it exits. */
  element: React.ReactElement;
  /** `false` from the render that removed the child until its item reports the end of its exit. */
  visible: boolean;
  /** `false` for the children of the group's first render, else the group's `appear`. */
  appear: boolean;
}

/** Returned by {@link usePresenceGroup}. */
export interface UsePresenceGroupResult {
  /** The keyed children, shown ones in their order and removed ones kept where they were. */
  entries: readonly PresenceGroupEntry[];
  /** Non-element children and elements without a key of the consumer's, in order (rendered after the entries, unanimated). */
  skipped: readonly React.ReactNode[];
  /** Drops the entry of `key` once its exit has ended (call it from its item's `onExited`). */
  onExited: (key: string) => void;
}

interface GroupState {
  /** The children the entries were merged from. */
  children: React.ReactNode;
  entries: readonly PresenceGroupEntry[];
}

/**
 * Whether the child of a flattened key has a key of the consumer's. `React.Children.toArray` keys
 * a child `.` plus its path through nested arrays, joined by `:`: a key of the consumer's is
 * `$…` (where `:` is escaped), an index is a number (`.1:$id` is a keyed element of an array next
 * to other children, `.0` a child without a key). `flattenChildren` joins a Fragment's key and its
 * children's with `/`, so the child's own segment starts after the last `/.` (a consumer's key may
 * hold a `/`).
 */
function hasConsumerKey(key: string): boolean {
  const own = key.slice(key.lastIndexOf('/.') + 1);
  return own.slice(Math.max(own.lastIndexOf(':'), 0) + 1).startsWith('$');
}

/** The keyed elements of `children`, and the rest, each in its order. */
function partitionChildren(children: React.ReactNode): {
  keyed: Array<{ key: string; element: React.ReactElement }>;
  skipped: React.ReactNode[];
} {
  const keyed: Array<{ key: string; element: React.ReactElement }> = [];
  const skipped: React.ReactNode[] = [];
  for (const { key, node } of flattenChildren(children)) {
    if (isValidElement(node) && hasConsumerKey(key)) keyed.push({ key, element: node });
    // Keyed by its flattened key, unique across Fragments (its own key repeats in each one).
    else skipped.push(isValidElement(node) ? cloneElement(node, { key }) : node);
  }
  return { keyed, skipped };
}

/**
 * The entries after a change of the children: the keyed children in their order, shown with
 * their new elements (an entry that exits is shown again), a new key appearing with `appear`; then
 * each previous entry that is no longer among them, not shown, right after the entry that
 * preceded it before (already placed by then, being kept or shown), or first.
 */
function mergeEntries(
  previous: readonly PresenceGroupEntry[],
  next: ReadonlyArray<{ key: string; element: React.ReactElement }>,
  appear: boolean,
): PresenceGroupEntry[] {
  const previousByKey = new Map(previous.map((entry) => [entry.key, entry]));
  const nextKeys = new Set(next.map(({ key }) => key));
  const merged: PresenceGroupEntry[] = next.map(({ key, element }) => ({
    key,
    element,
    visible: true,
    appear: previousByKey.get(key)?.appear ?? appear,
  }));
  previous.forEach((entry, index) => {
    if (nextKeys.has(entry.key)) return;
    const kept = entry.visible ? { ...entry, visible: false } : entry;
    const before =
      index === 0 ? -1 : merged.findIndex(({ key }) => key === previous[index - 1].key);
    merged.splice(before + 1, 0, kept);
  });
  return merged;
}

/**
 * Keyed children of a group, with removed ones kept until their exit ends. The caller renders each
 * entry as an item that calls `usePresence(entry.visible, { appear: entry.appear, onExited })`,
 * its `onExited` calling the result's `onExited(entry.key)`, and renders `skipped` after them.
 *
 * - **Children** go through `flattenChildren` (Fragments flattened, consumer keys kept). An
 *   element with a key of the consumer's is an entry, also inside a Fragment or an array; any
 *   other child (text, a number, an element without a key) is in `skipped`, as given (an element
 *   with its flattened key, so the list renders without duplicate keys).
 * - **Merging**, derived during render from the previous entries: the keyed children in their
 *   order, shown; a removed child kept, not shown, right after the child that preceded it (a run
 *   of removed children in its order), or first; a key that comes back while it exits is shown
 *   again with its new element, so its item, and the state inside it, stay. A reorder moves the
 *   entries without removing any. An entry is dropped when its item reports the end of its exit.
 * - **Appearing.** The children of the group's first render (on the server, when hydrating and in
 *   a client render) never appear; a child added later appears with `options.appear`.
 *
 * @param children - The group's children.
 * @param options - `appear`: whether a child added after the first render appears.
 */
export function usePresenceGroup(
  children: React.ReactNode,
  options: { appear: boolean },
): UsePresenceGroupResult {
  const { appear } = options;
  const { keyed, skipped } = partitionChildren(children);
  const [state, setState] = useState<GroupState>(() => ({
    children,
    entries: keyed.map(({ key, element }) => ({ key, element, visible: true, appear: false })),
  }));

  // Changes of the children, derived during render (C-HOOKS: a previous-value state).
  let { entries } = state;
  if (children !== state.children) {
    entries = mergeEntries(state.entries, keyed, appear);
    setState({ children, entries });
  }

  const onExited = useCallback((key: string) => {
    setState((current) => {
      const exited = current.entries.find((entry) => entry.key === key && !entry.visible);
      if (!exited) return current;
      return { ...current, entries: current.entries.filter((entry) => entry !== exited) };
    });
  }, []);

  return { entries, skipped, onExited };
}
