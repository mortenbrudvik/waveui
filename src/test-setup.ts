/**
 * Vitest setup file (`vitest.config.ts` `setupFiles`), evaluated before every test file.
 *
 * - jest-dom matchers and vitest-axe's `toHaveNoViolations`.
 * - `Element.prototype.scrollIntoView` stub (`vi.fn()`, calls cleared after every test) when jsdom
 *   lacks it (`input-basic#31`).
 * - `window.matchMedia` default stub (nothing matches) when jsdom lacks it — the
 *   {@link mockMatchMedia} machinery below.
 * - **No global `ResizeObserver`**: consumers' jsdom has none; tests call
 *   `installResizeObserverMock()` (`src/test-utils.ts`).
 * - After every test (this hook runs after the test file's own `afterEach` hooks): RTL
 *   `cleanup()`, `__resetWarnings()`, {@link resetMatchMediaMock} (the {@link mockMatchMedia}
 *   answer table is empty again, so a forgotten `restore()` cannot leak into the next test), then
 *   the body-cleanup assertion {@link assertEmptyBody} — leftover `document.body` children are
 *   removed and the test fails with an error naming them.
 *
 * The DOM parts are skipped for test files that opt into `// @vitest-environment node`
 * (`scripts/__tests__`).
 *
 * ## Module graph: this file imports no component
 * The environment machinery ({@link mockMatchMedia}, {@link resetMatchMediaMock},
 * {@link assertEmptyBody}, {@link describeElement}) is defined **here** and re-exported by
 * `src/test-utils.ts`. The setup file and the test file share one module cache, so a test's
 * import of this module (directly or through `src/test-utils.ts`) reuses the instance the setup
 * evaluated: one answer table, shared by the setup's after-each reset and a test's
 * `mockMatchMedia()`, which therefore never replaces the `window.matchMedia` installed here
 * (`src/__tests__/test-utils.test.tsx` asserts both). This file imports only jest-dom, React
 * Testing Library, vitest-axe's matchers and `src/lib/dev` — never `src/test-utils.ts`, a
 * component or a hook — so a broken component module fails only the test files that import it
 * (directly, or through `src/test-utils.ts`, which imports `WaveProvider` for
 * `renderWithProviders`), not every test file of the suite.
 *
 * ## `vi.mock()` in a test file
 * A test file's `vi.mock()` works as usual, also for the modules imported here (`src/lib/dev`,
 * RTL): the mock applies to the test file's own imports and to every module the test loads
 * afterwards (a component or hook calling `warnOnce` gets the mocked one). Only this file's own
 * bindings, taken before the test file ran, stay real: the after-each `cleanup()` and
 * `__resetWarnings()` (which resets the real warn-once registry). No extra step is needed.
 *
 * Do **not** call `vi.resetModules()` at the start of a test file (e.g. inside `vi.hoisted()`):
 * the test's next import of this module, directly or through `src/test-utils.ts`, evaluates it a
 * second time. That second instance has its own `mockMatchMedia` answer table — its first
 * `mockMatchMedia()` replaces `window.matchMedia`, so lists created earlier from the setup's
 * instance are no longer notified — and registers a second `afterEach`. (`vi.resetModules()`
 * inside a test followed by a dynamic import of the module under test, without importing this
 * module again, is fine.)
 *
 * `src/test-utils.ts` documents the helpers and this environment (source of truth).
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { __resetWarnings } from './lib/dev';

expect.extend({ toHaveNoViolations });

// ---------------------------------------------------------------------------
// Body-cleanup assertion
// ---------------------------------------------------------------------------

/**
 * Short description of a node for failure messages — `button#id.class[data-x] "text"` — used by
 * `testNoImplicitSubmit` (`src/test-utils.ts`) and {@link assertEmptyBody}.
 */
export function describeElement(node: Node): string {
  if (!(node instanceof Element)) {
    const text = (node.textContent ?? '').trim();
    return `${node.nodeName.toLowerCase()} "${text.slice(0, 40)}"`;
  }
  let label = node.tagName.toLowerCase();
  if (node.id) label += `#${node.id}`;
  for (const cls of Array.from(node.classList).slice(0, 3)) label += `.${cls}`;
  for (const attr of Array.from(node.attributes)) {
    if (attr.name.startsWith('data-') || attr.name === 'role') {
      label += attr.value ? `[${attr.name}="${attr.value}"]` : `[${attr.name}]`;
    }
  }
  const name = node.getAttribute('aria-label') ?? (node.textContent ?? '').trim();
  if (name) label += ` "${name.slice(0, 40)}"`;
  return label;
}

const COMMENT_NODE = 8;
const TEXT_NODE = 3;

function isLeftover(node: Node): boolean {
  if (node.nodeType === COMMENT_NODE) return false;
  if (node.nodeType === TEXT_NODE) return (node.textContent ?? '').trim() !== '';
  return true;
}

/**
 * The body-cleanup assertion that this file runs after every test (after RTL `cleanup()`):
 * removes every child node of `document.body`, then throws an error naming the leftovers
 * (elements and non-blank text; comments and whitespace do not count) when there were any. So a
 * leaked portal, announcer or toast region fails the test that leaked it, and a later test's
 * `document.body` audit never sees it.
 */
export function assertEmptyBody(): void {
  const nodes = Array.from(document.body.childNodes);
  const leftovers = nodes.filter(isLeftover);
  for (const node of nodes) node.remove();
  if (leftovers.length > 0) {
    const names = leftovers.map(describeElement).join(', ');
    throw new Error(
      `document.body is not empty after cleanup: ${names}. ` +
        'A portal, live region or node outlived its test (removed now so later audits of ' +
        'document.body do not see it). Unmount it or remove it in the test file’s afterEach.',
    );
  }
}

// ---------------------------------------------------------------------------
// matchMedia machinery
// ---------------------------------------------------------------------------

type MediaListener = (event: MediaQueryListEvent) => void;
type MediaListenerObject = { handleEvent(event: MediaQueryListEvent): void };

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, '').toLowerCase();
}

class MockMediaQueryList {
  readonly media: string;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;
  private readonly listeners = new Set<MediaListener | MediaListenerObject>();
  private readonly lookup: (query: string) => boolean;
  private last: boolean;

  constructor(media: string, lookup: (query: string) => boolean) {
    this.media = media;
    this.lookup = lookup;
    this.last = lookup(media);
  }

  get matches(): boolean {
    return this.lookup(this.media);
  }

  addEventListener(type: string, listener: MediaListener | MediaListenerObject | null): void {
    if (type === 'change' && listener) this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: MediaListener | MediaListenerObject | null): void {
    if (type === 'change' && listener) this.listeners.delete(listener);
  }

  /** Deprecated MediaQueryList API, still used by some libraries. */
  addListener(listener: MediaListener | null): void {
    if (listener) this.listeners.add(listener);
  }

  removeListener(listener: MediaListener | null): void {
    if (listener) this.listeners.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of Array.from(this.listeners)) {
      if (typeof listener === 'function') listener(event as MediaQueryListEvent);
      else listener.handleEvent(event as MediaQueryListEvent);
    }
    this.onchange?.call(this as unknown as MediaQueryList, event as MediaQueryListEvent);
    return true;
  }

  /** Whether anything still observes this list (listeners or `onchange`). */
  isObserved(): boolean {
    return this.listeners.size > 0 || this.onchange !== null;
  }

  /** Takes the current answer as the last one seen, without dispatching. */
  settle(): void {
    this.last = this.matches;
  }

  /** Dispatches `change` when the answer differs from the last one seen. */
  sync(): void {
    const matches = this.matches;
    if (matches === this.last) return;
    this.last = matches;
    const event = new Event('change');
    Object.defineProperties(event, {
      matches: { value: matches },
      media: { value: this.media },
    });
    this.dispatchEvent(event);
  }
}

interface MatchMediaState {
  fn: (query: string) => MediaQueryList;
  values: Map<string, boolean>;
  lists: Set<MockMediaQueryList>;
}

let matchMediaState: MatchMediaState | null = null;

function toValueMap(matches: Record<string, boolean>): Map<string, boolean> {
  return new Map(Object.entries(matches).map(([query, value]) => [normalizeQuery(query), value]));
}

function notifyMediaLists(state: MatchMediaState): void {
  act(() => {
    for (const list of Array.from(state.lists)) list.sync();
  });
}

/**
 * Makes `window.matchMedia(query).matches` answer from `matches` (queries compared ignoring
 * whitespace and case; unlisted queries answer `false`). Returns a function that restores the
 * previous answers. Re-exported by `src/test-utils.ts`.
 *
 * This file installs the machinery with `{}` (nothing matches) when jsdom lacks `matchMedia`. A
 * call while it is installed replaces the answer table and — inside `act()` — dispatches `change`
 * (listeners, legacy `addListener` and `onchange`) on every list created earlier whose answer
 * changed, so a mounted component observing a media query re-renders; restoring notifies again.
 *
 * The answers last **one test**: after every test this file calls {@link resetMatchMediaMock},
 * which empties the answer table again. So a forgotten `restore()` does not leak, and a mock set
 * in `beforeAll` is gone after the first test of the file — call `mockMatchMedia()` inside the
 * test or in `beforeEach`. Call the returned `restore()` inside the test when something mounted
 * must see the change back.
 *
 * @example
 * beforeEach(() => {
 *   mockMatchMedia({ '(prefers-reduced-motion: reduce)': true });
 * });
 *
 * it('stops auto-play when reduced motion is preferred', () => {
 *   render(<Carousel autoPlay>…</Carousel>);
 *   …
 * });
 */
export function mockMatchMedia(matches: Record<string, boolean>): () => void {
  const installed =
    matchMediaState !== null &&
    typeof window !== 'undefined' &&
    window.matchMedia === matchMediaState.fn;

  if (installed && matchMediaState) {
    const state = matchMediaState;
    const previousValues = state.values;
    state.values = toValueMap(matches);
    notifyMediaLists(state);
    return () => {
      state.values = previousValues;
      notifyMediaLists(state);
    };
  }

  const state: MatchMediaState = {
    values: toValueMap(matches),
    lists: new Set(),
    fn: (query: string) => {
      const list = new MockMediaQueryList(
        query,
        (q) => state.values.get(normalizeQuery(q)) ?? false,
      );
      state.lists.add(list);
      return list as unknown as MediaQueryList;
    },
  };
  const previousDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const previousState = matchMediaState;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: state.fn,
  });
  matchMediaState = state;
  return () => {
    if (previousDescriptor) Object.defineProperty(window, 'matchMedia', previousDescriptor);
    else Reflect.deleteProperty(window, 'matchMedia');
    matchMediaState = previousState;
  };
}

/**
 * Resets the installed {@link mockMatchMedia} machinery between tests (called by this file after
 * every test, after RTL `cleanup()`): the answer table becomes `{}` (nothing matches), lists
 * nothing observes any more are dropped, and the remaining lists take the reset answers as their
 * last-seen value **without** dispatching `change` (their components are unmounted). A later
 * `mockMatchMedia()` therefore notifies them relative to `false`. Does nothing when the machinery
 * is not installed. Re-exported by `src/test-utils.ts`.
 */
export function resetMatchMediaMock(): void {
  const state = matchMediaState;
  if (!state) return;
  state.values = new Map();
  for (const list of Array.from(state.lists)) {
    if (list.isObserved()) list.settle();
    else state.lists.delete(list);
  }
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

const scrollIntoViewStub =
  !hasDom || typeof Element.prototype.scrollIntoView === 'function' ? null : vi.fn();
if (scrollIntoViewStub) {
  Element.prototype.scrollIntoView = scrollIntoViewStub;
}

if (hasDom && typeof window.matchMedia !== 'function') {
  mockMatchMedia({});
}

afterEach(() => {
  cleanup();
  __resetWarnings();
  scrollIntoViewStub?.mockClear();
  resetMatchMediaMock();
  if (hasDom) assertEmptyBody();
});
