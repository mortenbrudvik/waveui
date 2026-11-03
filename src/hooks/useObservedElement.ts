import * as React from 'react';
import { registerObservedElement } from '../lib/observedElements';

/** What {@link useObservedElement} returns: spread it on the element (or a Wave component). */
export interface ObservedElementProps {
  /** Callback ref that gives the element its observed names while it is mounted. */
  ref: React.RefCallback<HTMLElement>;
}

/**
 * Gives an element a name, other than its `id`, by which {@link useFocusObserved} can focus it:
 * the element is found once it mounts, so a request made before it exists (a list that loads, a
 * panel that opens, a row a window renders) waits for it. An element may have several names and a
 * name may belong to several elements, in which case the most recently mounted one is focused.
 * Fluent's `useObservedElement`, which returns Tabster's DOM attribute; here it returns a callback
 * `ref` in an object, which you spread on the element (`<div {...observed} />`) or on a Wave
 * component, whose `ref` reaches its focusable element, or merge with `useMergedRefs` when the
 * element has a ref already. The name is read from the render, so it can change.
 *
 * The names are registered when the element mounts, never on the server.
 *
 * @example
 * const observed = useObservedElement('first-result');
 * const focusFirstResult = useFocusObserved('first-result');
 * return <Button {...observed}>First</Button>;
 *
 * @param name The name, or names, of the element.
 * @returns `{ ref }` for the element.
 */
export function useObservedElement(name: string | readonly string[]): ObservedElementProps {
  // The ref keeps its identity while the names are the same, so React does not detach and attach
  // it on every render, and an inline array is fine.
  const key = typeof name === 'string' ? JSON.stringify([name]) : JSON.stringify(name);
  const ref = React.useMemo<React.RefCallback<HTMLElement>>(() => {
    const names = JSON.parse(key) as string[];
    return (element) => {
      if (!element) return;
      return registerObservedElement(names, element);
    };
  }, [key]);
  return React.useMemo(() => ({ ref }), [ref]);
}
