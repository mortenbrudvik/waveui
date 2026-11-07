import { getGlobalRegistry } from './globalRegistry';
import { focusElement } from './focus';

/**
 * A focus request that may still be waiting for its element: `result` resolves `true` when the
 * element was focused, and `false` when the timeout passed first or the request was cancelled.
 * Fluent's `ObservedElementAsyncRequest` (its `diagnostics` member is left out).
 */
export interface ObservedElementRequest<T> {
  /** Settles once with the outcome of the request. */
  result: Promise<T>;
  /** Stops waiting: `result` resolves `false` (when it has not settled yet). */
  cancel: () => void;
}

/** The elements by observed name, most recently registered last, and who waits for a change. */
interface ObservedState {
  elements: Map<string, Set<HTMLElement>>;
  listeners: Set<() => void>;
}

// Shared by two copies of the package in one app (an element named by one copy is found by the
// other); only fields are ever added.
function getState(): ObservedState {
  return getGlobalRegistry<ObservedState>('observedElements', () => ({
    elements: new Map(),
    listeners: new Set(),
  }));
}

/** How often a request retries while its element exists but does not take focus yet. */
const RETRY_MS = 50;

/**
 * Gives `element` the observed `names` (an element may have several, and a name may name several
 * elements: the most recently registered one that is still connected is the one found).
 * Returns the function that takes the names away again. Client-only: call it from a ref callback
 * or an effect.
 */
export function registerObservedElement(
  names: readonly string[],
  element: HTMLElement,
): () => void {
  const state = getState();
  for (const name of names) {
    let set = state.elements.get(name);
    if (!set) {
      set = new Set();
      state.elements.set(name, set);
    }
    // Registered again: moved to the end, the most recent.
    set.delete(element);
    set.add(element);
  }
  for (const listener of [...state.listeners]) listener();
  return () => {
    for (const name of names) {
      const set = state.elements.get(name);
      if (!set) continue;
      set.delete(element);
      if (set.size === 0) state.elements.delete(name);
    }
  };
}

/**
 * The element observed under `name`: the most recently registered one that is still connected, or
 * `null`. Fluent's (Tabster's) `getElement`.
 */
export function getObservedElement(name: string): HTMLElement | null {
  const set = getState().elements.get(name);
  if (!set) return null;
  let found: HTMLElement | null = null;
  for (const element of set) {
    if (element.isConnected) found = element;
  }
  return found;
}

/**
 * Focuses the element observed under `name`, waiting for it for up to `timeout` milliseconds: the
 * attempt is repeated when an element gets that name, and every 50 ms while the element exists but
 * does not take focus (it is not connected, not focusable yet or hidden), until focus moved to it
 * or the time is up. With a `timeout` of `0` there is one attempt, now. Client-only (it needs the
 * DOM when it runs, not when it is imported).
 */
export function focusObservedElement(
  name: string,
  timeout: number,
  options?: FocusOptions,
): ObservedElementRequest<boolean> {
  const state = getState();
  let settle: (focused: boolean) => void = () => {};
  const result = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  let done = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let expire: ReturnType<typeof setTimeout> | undefined;

  const finish = (focused: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(retry);
    clearTimeout(expire);
    state.listeners.delete(attempt);
    settle(focused);
  };

  function attempt() {
    if (done) return;
    if (focusElement(getObservedElement(name), options)) {
      finish(true);
      return;
    }
    clearTimeout(retry);
    retry = setTimeout(attempt, RETRY_MS);
  }

  attempt();
  if (!done) {
    if (timeout > 0) {
      state.listeners.add(attempt);
      expire = setTimeout(() => finish(false), timeout);
    } else {
      finish(false);
    }
  }
  return { result, cancel: () => finish(false) };
}
