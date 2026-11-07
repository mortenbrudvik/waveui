import * as React from 'react';
import { focusObservedElement, type ObservedElementRequest } from '../lib/observedElements';

/** Options of {@link useFocusObserved}. */
export interface UseFocusObservedOptions {
  /**
   * Milliseconds the request waits for the element: it focuses the element as soon as one has the
   * name and takes focus, and resolves `false` when the time is up. `0` makes one attempt, now.
   * Fluent's option of the same name.
   * @default 1000
   */
  timeout?: number;
  /**
   * Whether the browser scrolls the element into view when it takes focus (the `preventScroll`
   * option of `HTMLElement.focus`, inverted for readability).
   * @default true
   */
  scrollIntoView?: boolean;
}

/**
 * Returns the function that focuses the element named by {@link useObservedElement}, waiting for
 * it when it is not there yet (a request is retried while the element exists but cannot take
 * focus, and when an element gets the name), for `timeout` milliseconds. Fluent's
 * `useFocusObserved`. Call the function from an event handler or an effect; its result is a
 * request with `result` (a promise of whether focus moved) and `cancel()`. A request still waiting
 * when the component unmounts is cancelled. The function keeps its identity while `name`,
 * `timeout` and `scrollIntoView` do, so it can be an effect's dependency.
 *
 * @example
 * const focusFirst = useFocusObserved('first-result');
 * React.useEffect(() => {
 *   if (loaded) focusFirst();
 * }, [loaded, focusFirst]);
 *
 * @param name    The observed name to focus.
 * @param options See {@link UseFocusObservedOptions}.
 * @returns A function that starts a focus request.
 */
export function useFocusObserved(
  name: string,
  options: UseFocusObservedOptions = {},
): () => ObservedElementRequest<boolean> {
  const { timeout = 1000, scrollIntoView = true } = options;
  const pending = React.useRef(new Set<ObservedElementRequest<boolean>>());

  React.useEffect(() => {
    const requests = pending.current;
    return () => {
      for (const request of requests) request.cancel();
      requests.clear();
    };
  }, []);

  return React.useCallback(() => {
    const request = focusObservedElement(name, timeout, { preventScroll: !scrollIntoView });
    pending.current.add(request);
    void request.result.then(() => pending.current.delete(request));
    return request;
  }, [name, timeout, scrollIntoView]);
}
