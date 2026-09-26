/**
 * Vitest setup file (`vitest.config.ts` `setupFiles`), evaluated before every test file.
 *
 * - jest-dom matchers (`@testing-library/jest-dom/matchers`) and vitest-axe's `toHaveNoViolations`,
 *   typed by `src/vitest-axe.d.ts`.
 * - `Element.prototype.scrollIntoView` stub (`vi.fn()`, calls cleared after every test) when jsdom
 *   lacks it (`input-basic#31`).
 * - `window.matchMedia` default stub (nothing matches) when jsdom lacks it — the
 *   {@link mockMatchMedia} machinery below.
 * - **No global `ResizeObserver`**: consumers' jsdom has none; tests call
 *   `installResizeObserverMock()` (`src/test-utils.ts`).
 * - After every test (this hook runs after the test file's own `afterEach` hooks): RTL
 *   `cleanup()`, `__resetWarnings()`, {@link resetMatchMediaMock} (the {@link mockMatchMedia}
 *   answer table is empty again, so a forgotten `restore()` cannot leak into the next test), then
 *   the overlay-state release assertion {@link assertOverlayStateReleased} (open dismiss layers,
 *   focus traps, scroll locks, modal isolation, restore-focus tracker users, the inline styles of
 *   a scroll lock on `<html>`/`<body>`) and the body-cleanup assertion {@link assertEmptyBody}
 *   (leftover `document.body` children). Both always run: what they find is released or removed,
 *   and the test fails with one error naming all of it.
 *
 * The DOM parts are skipped for test files that opt into `// @vitest-environment node`
 * (`scripts/__tests__`).
 *
 * ## Module graph: this file imports no component
 * The environment machinery ({@link mockMatchMedia}, {@link resetMatchMediaMock},
 * {@link assertEmptyBody}, {@link assertOverlayStateReleased}, {@link describeElement}) is defined
 * **here** and re-exported by `src/test-utils.ts`. The setup file and the test file share one
 * module cache, so a test's
 * import of this module (directly or through `src/test-utils.ts`) reuses the instance the setup
 * evaluated: one answer table, shared by the setup's after-each reset and a test's
 * `mockMatchMedia()`, which therefore never replaces the `window.matchMedia` installed here
 * (`src/__tests__/test-utils.test.tsx` asserts both). This file imports only jest-dom, React
 * Testing Library, vitest-axe's matchers and `src/lib/dev` — never `src/test-utils.ts`, a
 * component or a hook — so a broken component module fails only the test files that import it
 * (directly, or through `src/test-utils.ts`, which imports `WaveProvider` for
 * `renderWithProviders`), not every test file of the suite. The overlay registries are read off
 * `globalThis` for the same reason (see {@link assertOverlayStateReleased}).
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
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { act, cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { __resetWarnings } from './lib/dev';

// jest-dom's matchers are registered from its `/matchers` entry, not through its `/vitest` entry:
// that entry's type augmentation (`Assertion<T>`) does not merge with Vitest 5's `Assertion<R, T>`.
// `src/vitest-axe.d.ts` types both matcher sets on Vitest's `Matchers<R, T>`.
expect.extend(jestDomMatchers);
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
// Overlay-state release assertion
// ---------------------------------------------------------------------------

type Registry = Record<string, unknown>;

const registryKey = (key: string) => Symbol.for(`@mortenbrudvik/waveui/${key}`);

/**
 * The registry `getGlobalRegistry(key)` (`src/lib/globalRegistry.ts`) keeps on `globalThis`, or
 * `undefined` while nothing has created it. Read directly: `getGlobalRegistry` would create a
 * missing registry, and only its owning module knows the initial shape (this file imports no hook).
 */
function peekRegistry(key: string): Registry | undefined {
  const value: unknown = Reflect.get(globalThis, registryKey(key));
  return typeof value === 'object' && value !== null ? (value as Registry) : undefined;
}

/** Entries of an array, `Map` or `Set` field of a registry (0 for anything else). */
function sizeOf(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value instanceof Map || value instanceof Set ? value.size : 0;
}

/** Calls `holder.remove()` (installed document listeners) when there is one. */
function removeListeners(holder: unknown): void {
  const remove: unknown =
    typeof holder === 'object' && holder !== null ? Reflect.get(holder, 'remove') : undefined;
  if (typeof remove === 'function') remove.call(holder);
}

const count = (n: number, noun: string, plural = `${noun}s`) => `${n} ${n === 1 ? noun : plural}`;

interface RegistryCheck {
  key: string;
  /** What the registry still holds after cleanup (empty when it was released). */
  leaks(registry: Registry): string[];
  /** Undoes what the registry installed outside itself (document listeners, attributes). */
  release(registry: Registry): void;
}

/**
 * The overlay registries of `src/lib/layers.ts` and the overlay hooks, read by shape.
 * `src/__tests__/test-utils.test.tsx` drives the real hooks through this check, so a changed
 * shape fails there.
 */
const OVERLAY_REGISTRIES: RegistryCheck[] = [
  {
    key: 'layers',
    leaks(layers) {
      const found: string[] = [];
      const stack = Array.isArray(layers.stack) ? (layers.stack as unknown[]) : [];
      if (stack.length > 0) {
        const kinds = stack.map((layer) => String(Reflect.get(Object(layer), 'kind')));
        found.push(`${count(stack.length, 'open dismiss layer')} (${kinds.join(', ')})`);
      } else if (layers.listeners) {
        found.push('the document listeners of an empty dismiss-layer stack');
      }
      const isolated = sizeOf(layers.isolated);
      if (isolated > 0) found.push(count(isolated, 'isolating modal'));
      const elements = sizeOf(layers.elements);
      if (elements > 0) found.push(`portal elements registered with ${count(elements, 'layer')}`);
      const subscribers = sizeOf(layers.subscribers);
      if (subscribers > 0) found.push(count(subscribers, 'layer-stack subscriber'));
      return found;
    },
    release: (layers) => removeListeners(layers.listeners),
  },
  {
    key: 'traps',
    leaks(traps) {
      const n = sizeOf(traps.traps);
      if (n > 0) return [count(n, 'focus trap')];
      return traps.listeners ? ['the document listeners of an empty focus-trap stack'] : [];
    },
    release: (traps) => removeListeners(traps.listeners),
  },
  {
    key: 'scrollLock',
    leaks: (lock) =>
      typeof lock.count === 'number' && lock.count > 0 ? [count(lock.count, 'scroll lock')] : [],
    release: () => {},
  },
  {
    key: 'inert',
    leaks(inert) {
      if (!(inert.entries instanceof Map) || inert.entries.size === 0) return [];
      const names = Array.from(inert.entries.keys(), (el) =>
        el instanceof Node ? describeElement(el) : String(el),
      );
      return [
        `${count(names.length, 'element')} made inert by modal isolation (${names.join(', ')})`,
      ];
    },
    release(inert) {
      if (!(inert.entries instanceof Map)) return;
      for (const [el, entry] of inert.entries) {
        if (el instanceof Element && !Reflect.get(Object(entry), 'original')) {
          el.removeAttribute('inert');
        }
      }
    },
  },
  {
    key: 'restoreFocusTracker',
    leaks: (tracker) =>
      typeof tracker.users === 'number' && tracker.users > 0
        ? [count(tracker.users, 'useRestoreFocus focus tracker user')]
        : [],
    release(tracker) {
      if (typeof tracker.uninstall === 'function') tracker.uninstall();
    },
  },
];

const OVERFLOW_PROPERTIES = ['overflow', 'overflow-x', 'overflow-y'];

/**
 * The inline styles `useScrollLock` sets on `<html>` and `<body>`: `overflow` on the document
 * scroller, and the scrollbar compensation (`scrollbar-gutter` on `<html>` where supported, else
 * `padding-inline-end` on `<body>`).
 */
const LOCK_STYLES = [
  ['html', '<html>', [...OVERFLOW_PROPERTIES, 'scrollbar-gutter']],
  ['body', '<body>', [...OVERFLOW_PROPERTIES, 'padding-inline-end']],
] as const;

/**
 * The overlay-state release assertion that this file runs after every test (after RTL
 * `cleanup()`, before {@link assertEmptyBody}). Once every tree is unmounted, nothing may still
 * hold:
 * - an open dismiss layer (`useDismiss`, `registerLayer`), the layer stack's document listeners,
 *   an isolating modal, portal elements registered with a layer or a layer-stack subscriber;
 * - a focus trap (`useFocusTrap`) or the trap stack's document listeners;
 * - a scroll lock (`useScrollLock`), or an inline style it sets: `overflow` on `<html>`/`<body>`,
 *   `scrollbar-gutter` on `<html>` or `padding-inline-end` on `<body>`;
 * - an element made inert by modal isolation (`useModalIsolation`), or any `inert` attribute;
 * - a `useRestoreFocus` user of the shared focus tracker.
 *
 * Leaks are released — document listeners removed, `inert` attributes and those inline styles
 * removed, and each leaked registry dropped from `globalThis` so its owner creates a fresh one —
 * and then the assertion throws an error naming them. So a component that skips an overlay hook's
 * cleanup fails the test that leaked it, and later tests start clean. Registries nothing created
 * are not created here. Re-exported by `src/test-utils.ts`.
 */
export function assertOverlayStateReleased(): void {
  const leaks: string[] = [];
  for (const check of OVERLAY_REGISTRIES) {
    const registry = peekRegistry(check.key);
    if (!registry) continue;
    const found = check.leaks(registry);
    if (found.length === 0) continue;
    leaks.push(...found);
    check.release(registry);
    Reflect.deleteProperty(globalThis, registryKey(check.key));
  }
  for (const el of Array.from(document.querySelectorAll('[inert]'))) {
    leaks.push(`inert attribute on ${describeElement(el)}`);
    el.removeAttribute('inert');
  }
  for (const [tag, name, properties] of LOCK_STYLES) {
    const el = tag === 'html' ? document.documentElement : document.body;
    for (const property of properties) {
      const value = el.style.getPropertyValue(property);
      if (!value) continue;
      const what = property.startsWith('overflow') ? 'overflow' : property;
      leaks.push(`inline ${what} on ${name} (${property}: ${value})`);
      el.style.removeProperty(property);
    }
  }
  if (leaks.length > 0) {
    throw new Error(
      `overlay state outlived its test: ${leaks.join('; ')}. ` +
        'Released now so later tests start clean. A component skipped the cleanup of an overlay ' +
        'hook (useDismiss, useFocusTrap, useScrollLock, useModalIsolation, useRestoreFocus), or ' +
        'the test registered or set one itself and did not release it.',
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
  if (!hasDom) return;
  // Both checks always run (each releases what it finds); their errors are reported together.
  const errors: string[] = [];
  for (const check of [assertOverlayStateReleased, assertEmptyBody]) {
    try {
      check();
    } catch (error) {
      errors.push((error as Error).message);
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
});
