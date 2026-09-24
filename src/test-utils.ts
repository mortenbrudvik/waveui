/**
 * Shared test helpers for WaveUI component tests.
 *
 * Test-only: `tsconfig.json` (the library program) excludes `src/test-utils*`, and nothing in
 * `src/index.ts` exports this module. It is type-checked by `tsconfig.dev.json`.
 *
 * **This JSDoc is the source of truth for the helper signatures and defaults.** The testing guide,
 * `docs/testing-best-practices.md`, shows how the tests in this repository use these helpers, with
 * condensed examples. Where the two disagree, this JSDoc wins.
 *
 * ## Accessibility audits
 * {@link axe} is the one axe-core instance used by {@link testA11y}, the `a11yVariants` loop of
 * {@link testSystemProps}, {@link expectNoA11yViolations} and the Storybook stories gate
 * (`src/__tests__/stories.a11y.test.tsx`). It is
 * `configureAxe({ rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } })`:
 * - components are audited **in isolation**, and the page-level landmark rule `region` ("all page
 *   content should be contained by landmarks") has no meaning for a single component — scanning
 *   `document.body` with the default rule set flags every piece of text outside a landmark;
 * - jsdom cannot compute color contrast: enabled, `color-contrast` fails on its canvas probe
 *   (jsdom prints "Not implemented: HTMLCanvasElement's getContext()") and ends up `incomplete`,
 *   having checked nothing. Contrast is guarded per theme by
 *   `src/styles/__tests__/tokens.test.ts` (spec §4.5).
 *
 * Every other rule stays enabled. {@link expectNoA11yViolations} (and so every audit helper and
 * the stories gate) also fails on **dangling ARIA id references** ({@link findDanglingIdRefs}),
 * which axe files under `incomplete` or accepts as long as one id of a list resolves.
 *
 * Audits scan **`document.body`** (the render result's `baseElement`) by default, so content a
 * component portals out of its render container (Dialog, Drawer, Popover, listboxes, tooltips) is
 * audited too. Pass `scope: 'container'` / `a11yScope: 'container'` to audit only the render
 * container.
 *
 * Before auditing, these helpers let pending updates land inside `act()` — one macrotask, then one
 * animation frame (floating-ui positioning of an open popup, useListbox's microtask publish,
 * Spinner's deferred announce) — so the audit sees the settled DOM and React logs no "not wrapped
 * in act(...)" warning; that wait uses the real timers, so a `requestAnimationFrame` stub holding a
 * frame back cannot stall it. axe-core itself waits on the global `setTimeout`: audit with real
 * timers or `vi.useFakeTimers({ shouldAdvanceTime: true })`. A direct `axe(el)` call settles
 * nothing.
 *
 * ## Environment provided by `src/test-setup.ts`
 * - jest-dom matchers (`@testing-library/jest-dom/vitest`) and vitest-axe's `toHaveNoViolations`.
 * - `Element.prototype.scrollIntoView` is a `vi.fn()` when jsdom lacks it; its calls are cleared
 *   after every test.
 * - `window.matchMedia` answers `matches: false` for every query when jsdom lacks it (it is the
 *   {@link mockMatchMedia} machinery, so a later `mockMatchMedia()` notifies lists created from it).
 * - **No global `ResizeObserver`** — consumers' jsdom has none, so its absence is the default; call
 *   {@link installResizeObserverMock} in tests that need one.
 * - After every test: RTL `cleanup()`, then the warn-once registry is reset (`__resetWarnings()`,
 *   so every test sees first-time dev warnings), then {@link resetMatchMediaMock} (the
 *   {@link mockMatchMedia} answer table is empty again, so a mock set in `beforeAll` is gone
 *   after the file's first test — mock in the test or in `beforeEach`), then two assertions,
 *   whose errors are reported together:
 *   - the **overlay-state release assertion** {@link assertOverlayStateReleased}: if an open
 *     dismiss layer, a focus trap, a scroll lock, modal isolation (`inert`), a `useRestoreFocus`
 *     tracker user or an inline `overflow` on `<html>`/`<body>` outlived the unmounted trees, it
 *     is released and the test **fails** naming it;
 *   - the **body-cleanup assertion** {@link assertEmptyBody}: if `document.body` still has
 *     children (a leaked portal, announcer, toast region or a node a test appended itself), they
 *     are removed and the test **fails** with an error naming them.
 *
 *   A later test therefore never sees another test's leftovers (in a `document.body` audit, or as
 *   a stale layer handling its Escape). Tests that append nodes, register layers or set such
 *   styles themselves undo that in their own `afterEach` (which runs before the setup's).
 *
 * ## Building blocks
 * {@link testSystemProps} registers {@link testForwardRef}, {@link testRestSpread},
 * {@link testClassName}, {@link testPolymorphicAs} (when `polymorphic`), {@link testDisplayName},
 * {@link testA11y} and one axe test per `a11yVariants` entry. The building blocks are exported
 * for tests that need one of them on its own; they are test helpers, not public API.
 *
 * All helpers are generic over the component's props `P` (inferred from the component, never from
 * the config), so `defaultProps`/`a11yVariants` props are checked against the real props — a typo
 * such as `{ checked: true }` on a component that has `pressed` fails the type check
 * (`tsconfig.dev.json`). `data-*` attributes are always accepted.
 *
 * ## Other helpers
 * - {@link renderWithProviders}: renders inside `WaveProvider` with `theme`/`dir` (RTL tests).
 * - {@link testNoImplicitSubmit}: internal `<button>`s are never submit buttons, portaled ones
 *   included, and clicking inside the form never submits it (C-BUTTON-TYPE).
 * - {@link testComposedHandler}: a consumer handler composes with the built-in behaviour and can
 *   suppress it with `preventDefault()` (C-COMPOSE).
 * - {@link testCompoundExposure} (members are components with a `displayName`),
 *   {@link testFocusEvents}, {@link createOverlayTestWrapper}.
 * - {@link asClientReference}: a component as a Server Component delivers it to the client (a
 *   pre-resolved `React.lazy` type), for testing how a compound identifies its parts (R1).
 * - Browser API mocks: {@link installResizeObserverMock}, {@link mockMatchMedia} (its answers
 *   last one test — call it inside the test or in `beforeEach`, never `beforeAll`), {@link mockRect}.
 * - The environment machinery {@link mockMatchMedia}, {@link resetMatchMediaMock},
 *   {@link assertEmptyBody}, {@link assertOverlayStateReleased} and {@link describeElement} is
 *   **defined in `src/test-setup.ts`** and re-exported here — one instance, the one the setup
 *   evaluated — so the setup file imports no component or hook (a broken component module does
 *   not fail every test file).
 * - {@link findDanglingIdRefs}: the ARIA id references that point at no element (part of every
 *   audit).
 * - `vi.mock()` in a test file works as usual, also for the modules the setup imports
 *   (`src/lib/dev`, RTL): the mock applies to the test file's imports and to every module it
 *   loads afterwards; only the setup's own bindings (its after-each `cleanup()` and
 *   `__resetWarnings()`) stay real. Do **not** call `vi.resetModules()` at the start of a test
 *   file: importing this module afterwards evaluates `src/test-setup.ts` a second time, with its
 *   own `mockMatchMedia` answer table and `afterEach` (see `src/test-setup.ts`).
 *
 * Helpers named `test*` register tests through the Vitest globals (`it`, `describe`) when called;
 * call them at module or `describe` level, never inside a test.
 */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { configureAxe } from 'vitest-axe';
import { WaveProvider } from './components/provider/WaveProvider';
import type { WaveDir, WaveTheme } from './components/provider/WaveProvider';
import { describeElement } from './test-setup';

/*
 * The environment machinery lives in `src/test-setup.ts` (a module that imports no component, so
 * the setup never loads `WaveProvider` and friends) and is re-exported here: one instance, shared
 * by the setup's after-each reset and the tests. Their JSDoc is on the declarations there.
 */
export {
  assertEmptyBody,
  assertOverlayStateReleased,
  describeElement,
  mockMatchMedia,
  resetMatchMediaMock,
} from './test-setup';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** Where an axe audit looks: `document.body` (default, portals included) or the render container. */
export type A11yScope = 'document' | 'container';

/** `data-*` attributes, accepted by every helper's props next to the component's own props. */
export type DataAttributes = { [key: `data-${string}`]: string | number | boolean | undefined };

type KnownKeys<P> = {
  [K in keyof P as string extends K ? never : number extends K ? never : K]: P[K];
};

/**
 * The props type the helpers check against. Normally `P` itself. Props inferred from a
 * polymorphic component (F2 `PolymorphicComponent`) carry a string index signature (the generic
 * `as` element's props), which would accept any key; for those, the own props plus every HTML
 * attribute are used instead, so typos are still rejected.
 */
export type ComponentTestProps<P> = string extends keyof P
  ? KnownKeys<P> & React.AllHTMLAttributes<HTMLElement>
  : P;

/** Props a helper renders the component with: any subset of the component's props plus `data-*`. */
export type TestProps<P> = Partial<ComponentTestProps<P>> & DataAttributes;

/** A wrapper component (providers, contexts) rendered around every helper render. */
export type TestWrapper = React.ComponentType<{ children: React.ReactNode }>;

/**
 * `Omit` applied to each member of a union, so a discriminated-union props type keeps its
 * variants (plain `Omit` collapses a union to its common keys).
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Options shared by every building block. */
export interface RenderHelperOptions {
  /** Rendered around the component (e.g. a provider it requires). */
  wrapper?: TestWrapper;
}

/** A consumer class that must win over a conflicting default class (tailwind-merge). */
export interface ConflictingClass {
  /** The consumer class passed as `className`, e.g. `'p-8'`. */
  className: string;
  /** The default class it conflicts with, e.g. `'p-4'` — must be present without `className`. */
  overrides: string;
}

/** The focusable control a composite routes `aria-label`/ARIA props to (C-ROUTING). */
export interface ControlQuery {
  /** Role of the control, queried with `getByRole(role, { name })`. */
  role: string;
}

// ---------------------------------------------------------------------------
// Shared axe instance
// ---------------------------------------------------------------------------

/**
 * The one axe instance used by every helper and by the stories gate:
 * `configureAxe({ rules: { region: { enabled: false }, 'color-contrast': { enabled: false } } })`.
 *
 * Two rules are disabled; all other rules run.
 * - `region`: components are audited in isolation, and landmark rules are page-level.
 * - `color-contrast`: jsdom cannot evaluate it. Its canvas probe fails (jsdom prints
 *   "Not implemented: HTMLCanvasElement's getContext()"), so the rule would only ever land in
 *   `incomplete`, having checked nothing. Contrast is guarded per theme by
 *   `src/styles/__tests__/tokens.test.ts`.
 *
 * Use it directly as `expect(await axe(el)).toHaveNoViolations()`, or through
 * {@link expectNoA11yViolations}, which also checks ARIA id references.
 */
export const axe: ReturnType<typeof configureAxe> = configureAxe({
  rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
});

/*
 * The timer functions as they were when this module loaded, before any test stubs or fakes them,
 * so a test that holds a component's frame back (a `requestAnimationFrame` stub, fake timers)
 * cannot stall the settle step below; the held-back update simply stays held back.
 */
const realSetTimeout = globalThis.setTimeout;
const realRequestAnimationFrame = globalThis.requestAnimationFrame;

/**
 * Lets the updates a render leaves pending land inside `act()`: one macrotask (by then every
 * queued microtask and promise chain has run — floating-ui's `computePosition` for an open popup,
 * useListbox's microtask publish), then one animation frame (Spinner's deferred announce). When
 * the callback resolves, `act()` flushes the React work those updates scheduled, a task at a time
 * until none is left. Without this they fire while axe runs, outside `act()`: React logs "An
 * update to X inside a test was not wrapped in act(...)" and the audit races the DOM changes.
 */
async function settlePendingUpdates(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => realSetTimeout(resolve, 0));
    await new Promise<void>((resolve) => realRequestAnimationFrame(() => resolve()));
  });
}

/** The ARIA attributes whose every id {@link findDanglingIdRefs} requires to resolve. */
const ID_REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-describedby',
  'aria-errormessage',
  'aria-labelledby',
] as const;

const ID_REFERENCE_SELECTOR = ID_REFERENCE_ATTRIBUTES.map((attr) => `[${attr}]`).join(',');

/**
 * The dangling ARIA id references of `root` and its descendants: every id in `aria-describedby`,
 * `aria-labelledby`, `aria-errormessage` or `aria-activedescendant` that no element in the
 * element's document (or shadow root) carries. Ids resolve in the whole document, so a reference
 * into a portal counts as resolved when only the render container is checked. Empty values are
 * ignored, and so is `aria-controls` (a closed popup need not be rendered).
 *
 * axe misses most of these: it files a dangling `aria-describedby`/`aria-labelledby`/
 * `aria-errormessage` under `incomplete` (which `toHaveNoViolations` ignores) and accepts an id
 * list as long as one id resolves — the failure modes of Field wiring and C-ROUTING (a control
 * still described by a hint or error that is no longer rendered). {@link expectNoA11yViolations}
 * fails on them.
 *
 * @param root Element to check. Defaults to `document.body`.
 * @returns One line per attribute, e.g.
 *   `input "Email": aria-describedby="hint error" (no element with id "error")`.
 */
export function findDanglingIdRefs(root: Element = document.body): string[] {
  const elements = [root, ...Array.from(root.querySelectorAll(ID_REFERENCE_SELECTOR))];
  const found: string[] = [];
  for (const el of elements) {
    const scope = el.getRootNode();
    if (!(scope instanceof Document || scope instanceof ShadowRoot)) continue; // detached
    for (const attr of ID_REFERENCE_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value === null) continue;
      const missing = value
        .split(/\s+/)
        .filter((id) => id !== '' && scope.getElementById(id) === null);
      if (missing.length === 0) continue;
      const ids = missing.map((id) => `"${id}"`).join(', ');
      found.push(`${describeElement(el)}: ${attr}="${value}" (no element with id ${ids})`);
    }
  }
  return found;
}

/**
 * Audits `root` (default `document.body`, portals included) with the shared {@link axe} instance
 * and fails the test on any violation, and on any dangling ARIA id reference
 * ({@link findDanglingIdRefs}) in `root`.
 *
 * Before the audit it lets pending updates land inside `act()` — one macrotask, then one
 * animation frame (popup positioning, listbox registration, deferred announcements) — so the
 * audit sees the settled DOM and logs no act() warning. That wait uses the real timers, so a
 * `requestAnimationFrame` stub holding a component's frame back cannot stall it. axe-core itself
 * waits on the global `setTimeout`: audit with real timers or
 * `vi.useFakeTimers({ shouldAdvanceTime: true })`, and switch plain fake timers off
 * (`vi.useRealTimers()`) first.
 *
 * @param root Element to audit. Defaults to `document.body`.
 */
export async function expectNoA11yViolations(root?: Element): Promise<void> {
  await settlePendingUpdates();
  const target = root ?? document.body;
  const results = await axe(target);
  expect(results).toHaveNoViolations();
  const dangling = findDanglingIdRefs(target);
  expect(
    dangling.length,
    `ARIA id references that point at no element:\n${dangling.join('\n')}\n`,
  ).toBe(0);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type AnyProps = Record<string, unknown>;

function renderComponent<P>(
  Component: React.ComponentType<P>,
  props: object,
  options: RenderHelperOptions = {},
): RenderResult {
  const element = React.createElement(
    Component as unknown as React.ComponentType<AnyProps>,
    props as AnyProps,
  );
  return render(element, { wrapper: options.wrapper });
}

/** Audits a helper's render with {@link expectNoA11yViolations} (pending updates settled first). */
async function auditRender(utils: RenderResult, scope: A11yScope = 'document'): Promise<void> {
  const target = scope === 'container' ? utils.container : utils.baseElement;
  await expectNoA11yViolations(target);
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/**
 * Registers `forwards ref to DOM element`: a `ref` passed to the component receives the element
 * that carries `data-testid`, and that element's tag is `expectedTag`.
 *
 * @param Component   The component under test.
 * @param expectedTag Tag name of the root element (e.g. `'button'`).
 * @param props       Props every render needs (e.g. `{ children: 'Save' }`).
 * @param options     `wrapper` rendered around the component.
 */
export function testForwardRef<P extends object>(
  Component: React.ComponentType<P>,
  expectedTag: string,
  props: TestProps<NoInfer<P>> = {},
  options: RenderHelperOptions = {},
): void {
  it('forwards ref to DOM element', () => {
    const ref = React.createRef<HTMLElement>();
    renderComponent(Component, { ...props, ref, 'data-testid': 'ref-test' }, options);
    const el = screen.getByTestId('ref-test');
    expect(ref.current).toBe(el);
    expect(el.tagName.toLowerCase()).toBe(expectedTag.toLowerCase());
  });
}

/**
 * Registers `spreads rest props to DOM element`: `data-testid` lands on an element of the
 * component, and `aria-label`
 * - without `control`: lands on that same (root) element;
 * - with `control` (composite controls, C-ROUTING): names the focusable control —
 *   `getByRole(control.role, { name })` resolves — and is **not** left on a root that is not the
 *   control. `data-testid` must stay on the root: the element carrying it contains the control
 *   and, when no `wrapper` is given, is the component's outermost element
 *   (`container.firstElementChild`). So a composite that routes *every* rest prop, `data-testid`
 *   included, to the control fails. With a `wrapper` (whose own DOM is unknown) only the
 *   containment is checked; {@link testForwardRef} still ties `data-testid` to the `ref` element.
 *
 * @param Component The component under test.
 * @param props     Props every render needs.
 * @param options   `control` role and `wrapper`.
 */
export function testRestSpread<P extends object>(
  Component: React.ComponentType<P>,
  props: TestProps<NoInfer<P>> = {},
  options: RenderHelperOptions & { control?: ControlQuery } = {},
): void {
  it('spreads rest props to DOM element', () => {
    const { container } = renderComponent(
      Component,
      { ...props, 'data-testid': 'spread-test', 'aria-label': 'test-label' },
      options,
    );
    const root = screen.getByTestId('spread-test');
    if (!options.control) {
      expect(root).toHaveAttribute('aria-label', 'test-label');
      return;
    }
    const { role } = options.control;
    const control = screen.getByRole(role, { name: 'test-label' });
    expect(
      root.contains(control),
      `data-testid must stay on the root that contains the ${role}, not be routed away from it`,
    ).toBe(true);
    if (!options.wrapper) {
      expect(
        root,
        `data-testid must land on the component's root element, not on the ${role} or another inner element`,
      ).toBe(container.firstElementChild);
    }
    if (control !== root) {
      expect(
        root,
        `aria-label must be routed to the ${role}, not left on the root`,
      ).not.toHaveAttribute('aria-label');
    }
  });
}

/**
 * Registers the className merge contract (CLAUDE.md: user classes always win):
 * - `keeps its default classes when a className is added`: renders once without `className`,
 *   then with a non-conflicting consumer class, and asserts every class of the first render is
 *   still present next to the consumer class (a component doing `className ?? defaults` fails);
 * - with `conflictingClass` — `lets a conflicting consumer className win over the default`:
 *   `overrides` must be a default class; with `className` the consumer class is present and the
 *   default is gone (a component doing `cn(className, defaults)` fails).
 *
 * Both renders read the element carrying `data-testid`, which must be the element that receives
 * `className`.
 *
 * @param Component The component under test.
 * @param props     Props every render needs.
 * @param options   `conflictingClass` and `wrapper`.
 */
export function testClassName<P extends object>(
  Component: React.ComponentType<P>,
  props: TestProps<NoInfer<P>> = {},
  options: RenderHelperOptions & { conflictingClass?: ConflictingClass } = {},
): void {
  const customClass = 'wave-test-custom-class';

  it('keeps its default classes when a className is added', () => {
    const baseline = renderComponent(Component, { ...props, 'data-testid': 'class-test' }, options);
    const defaults = Array.from(screen.getByTestId('class-test').classList);
    baseline.unmount();

    renderComponent(
      Component,
      { ...props, className: customClass, 'data-testid': 'class-test' },
      options,
    );
    const el = screen.getByTestId('class-test');
    expect(el).toHaveClass(customClass);
    const dropped = defaults.filter((cls) => !el.classList.contains(cls));
    expect(dropped, 'default classes dropped when a className was added').toEqual([]);
  });

  const conflicting = options.conflictingClass;
  if (conflicting) {
    it('lets a conflicting consumer className win over the default', () => {
      const baseline = renderComponent(
        Component,
        { ...props, 'data-testid': 'class-test' },
        options,
      );
      expect(
        screen.getByTestId('class-test'),
        `conflictingClass.overrides "${conflicting.overrides}" must be a default class of the component`,
      ).toHaveClass(conflicting.overrides);
      baseline.unmount();

      renderComponent(
        Component,
        { ...props, className: conflicting.className, 'data-testid': 'class-test' },
        options,
      );
      const el = screen.getByTestId('class-test');
      expect(el, `consumer class "${conflicting.className}" was dropped`).toHaveClass(
        conflicting.className,
      );
      expect(
        el,
        `default "${conflicting.overrides}" survived next to "${conflicting.className}"`,
      ).not.toHaveClass(conflicting.overrides);
    });
  }
}

/**
 * Registers ``renders as a different element via `as` prop``: `as="section"` renders a
 * `<section>` carrying `data-testid`.
 */
export function testPolymorphicAs<P extends object>(
  Component: React.ComponentType<P>,
  props: TestProps<NoInfer<P>> = {},
  options: RenderHelperOptions = {},
): void {
  it('renders as a different element via `as` prop', () => {
    renderComponent(Component, { ...props, as: 'section', 'data-testid': 'as-test' }, options);
    expect(screen.getByTestId('as-test').tagName.toLowerCase()).toBe('section');
  });
}

/**
 * Registers `has no accessibility violations`: renders the component and audits it with
 * {@link expectNoA11yViolations} (the shared {@link axe} instance and the dangling ARIA id
 * reference check).
 *
 * @param Component The component under test.
 * @param props     Props for the render (use real, representative content).
 * @param options   `scope`: `'document'` (default — `document.body`, portals included) or
 *                  `'container'`; `wrapper`.
 */
export function testA11y<P extends object>(
  Component: React.ComponentType<P>,
  props: TestProps<NoInfer<P>> = {},
  options: RenderHelperOptions & { scope?: A11yScope } = {},
): void {
  it('has no accessibility violations', async () => {
    await auditRender(renderComponent(Component, props, options), options.scope);
  });
}

/** Registers `has displayName "<name>"`. */
export function testDisplayName(Component: { displayName?: string }, name: string): void {
  it(`has displayName "${name}"`, () => {
    expect(Component.displayName).toBe(name);
  });
}

function isComponentLike(value: unknown): boolean {
  if (typeof value === 'function') return true;
  // React.memo / lazy / forwardRef objects.
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

function displayNameOf(value: unknown): unknown {
  if ((typeof value === 'function' || typeof value === 'object') && value !== null) {
    const own: unknown = Reflect.get(value, 'displayName');
    if (own !== undefined) return own;
    const inner: unknown = Reflect.get(value, 'type'); // React.memo(Component)
    if ((typeof inner === 'function' || typeof inner === 'object') && inner !== null) {
      return Reflect.get(inner, 'displayName');
    }
  }
  return undefined;
}

/**
 * Registers, inside `describe('compound component exposure')`, one `exposes <name> sub-component`
 * test per name: `Parent[name]` is a component (function or memo/forwardRef object) with a
 * non-empty `displayName`.
 *
 * @param Parent The compound root (a component with statics, e.g. `Card`) or any object.
 * @param names  The member names, e.g. `['Header', 'Body', 'Footer']`.
 */
export function testCompoundExposure(Parent: object, names: readonly string[]): void {
  describe('compound component exposure', () => {
    for (const name of names) {
      it(`exposes ${name} sub-component`, () => {
        const member: unknown = Reflect.get(Parent, name);
        expect(isComponentLike(member), `${name} is not a component`).toBe(true);
        const displayName = displayNameOf(member);
        expect(typeof displayName, `${name} has no displayName`).toBe('string');
        expect(displayName, `${name} has an empty displayName`).not.toBe('');
      });
    }
  });
}

/**
 * Registers `describe('focus events')` with `calls onFocus` and `calls onBlur`: clicks the element
 * matched by `selector` (default: the container's first element child), then tabs away.
 *
 * @param Component    The component under test.
 * @param defaultProps Props every render needs.
 * @param selector     CSS selector of the focusable element inside the container.
 * @param options      `wrapper`.
 */
export function testFocusEvents<P extends object>(
  Component: React.ComponentType<P>,
  defaultProps: TestProps<NoInfer<P>> = {},
  selector?: string,
  options: RenderHelperOptions = {},
): void {
  const target = (container: HTMLElement): Element => {
    const el = selector ? container.querySelector(selector) : container.firstElementChild;
    if (!el) throw new Error(`testFocusEvents: no element matches ${selector ?? ':first-child'}`);
    return el;
  };

  describe('focus events', () => {
    it('calls onFocus', async () => {
      const onFocus = vi.fn();
      const user = userEvent.setup();
      const { container } = renderComponent(Component, { ...defaultProps, onFocus }, options);
      await user.click(target(container));
      expect(onFocus).toHaveBeenCalled();
    });

    it('calls onBlur', async () => {
      const onBlur = vi.fn();
      const user = userEvent.setup();
      const { container } = renderComponent(Component, { ...defaultProps, onBlur }, options);
      await user.click(target(container));
      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });
}

// ---------------------------------------------------------------------------
// testSystemProps
// ---------------------------------------------------------------------------

/**
 * Configuration of {@link testSystemProps}. `P` is the component's props (inferred from the
 * component).
 */
export interface TestSystemPropsConfig<P> {
  /** Tag name of the element that receives `ref`, `data-testid` and `className` (e.g. `'button'`). */
  expectedTag: string;
  /** Expected `Component.displayName`. */
  displayName: string;
  /** Whether the component supports the `as` prop (registers {@link testPolymorphicAs}). @default false */
  polymorphic?: boolean;
  /** Whether to register the axe tests. @default true */
  a11y?: boolean;
  /**
   * What the axe tests audit: `'document'` (`document.body`, portaled content included) or
   * `'container'` (the render container only). @default 'document'
   */
  a11yScope?: A11yScope;
  /** Props every render needs — representative, real content (e.g. `{ children: 'Save' }`). */
  defaultProps?: TestProps<P>;
  /**
   * Extra axe runs for important states, each rendered with `{ ...defaultProps, ...props }`,
   * e.g. `{ name: 'pressed', props: { pressed: true } }`. Props are type-checked against `P`.
   */
  a11yVariants?: Array<{ name: string; props: TestProps<P> }>;
  /**
   * Composite controls (C-ROUTING): the role of the focusable control that `aria-label` must
   * name. {@link testRestSpread} then asserts `getByRole(control.role, { name })`, that
   * `aria-label` is not left on the root, and that `data-testid` stays on the root (the element
   * that contains the control; without `wrapper`, the outermost rendered element).
   */
  control?: ControlQuery;
  /**
   * A consumer class that must win over a conflicting default class, e.g.
   * `{ className: 'p-8', overrides: 'p-4' }` (see {@link testClassName}).
   */
  conflictingClass?: ConflictingClass;
  /** Wrapper rendered around every render (providers the component requires). */
  wrapper?: TestWrapper;
}

/**
 * Registers every cross-cutting system-prop test for a component: {@link testForwardRef},
 * {@link testRestSpread} (with `control`), {@link testClassName} (with `conflictingClass`),
 * {@link testPolymorphicAs} (when `polymorphic`), {@link testDisplayName}, {@link testA11y} and one
 * `has no accessibility violations (<name>)` test per `a11yVariants` entry — all audited with
 * {@link expectNoA11yViolations} on `a11yScope` (default `document.body`).
 *
 * @example
 * testSystemProps(ToggleButton, {
 *   expectedTag: 'button',
 *   displayName: 'ToggleButton',
 *   defaultProps: { children: 'Bold' },
 *   a11yVariants: [{ name: 'pressed', props: { pressed: true } }],
 * });
 */
export function testSystemProps<P extends object>(
  Component: React.ComponentType<P>,
  config: TestSystemPropsConfig<NoInfer<P>>,
): void {
  const props: TestProps<NoInfer<P>> = config.defaultProps ?? {};
  const renderOptions: RenderHelperOptions = { wrapper: config.wrapper };

  testForwardRef(Component, config.expectedTag, props, renderOptions);
  testRestSpread(Component, props, { ...renderOptions, control: config.control });
  testClassName(Component, props, {
    ...renderOptions,
    conflictingClass: config.conflictingClass,
  });
  if (config.polymorphic) {
    testPolymorphicAs(Component, props, renderOptions);
  }
  testDisplayName(Component, config.displayName);

  if (config.a11y !== false) {
    testA11y(Component, props, { ...renderOptions, scope: config.a11yScope });
    for (const variant of config.a11yVariants ?? []) {
      it(`has no accessibility violations (${variant.name})`, async () => {
        const utils = renderComponent(Component, { ...props, ...variant.props }, renderOptions);
        await auditRender(utils, config.a11yScope);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Forms and handlers
// ---------------------------------------------------------------------------

/** Options of {@link testNoImplicitSubmit}. */
export interface NoImplicitSubmitOptions<P> {
  /** Props every render needs (e.g. `{ open: true }` for an overlay). */
  defaultProps?: TestProps<P>;
  /**
   * The elements to check. Receives the render container (the `<form>` is inside it; with a
   * `wrapper`, not necessarily its first child). Default: every `<button>` in `document.body`
   * (portaled content included). Leave out buttons the test itself supplies as `type="submit"`.
   */
  getTargets?: (container: HTMLElement) => HTMLElement[];
  /** Wrapper rendered around the form. */
  wrapper?: TestWrapper;
}

/**
 * Registers `does not submit an enclosing form` (C-BUTTON-TYPE): renders the component inside
 * `<form onSubmit={spy}>` and checks every target (default: every `<button>` in
 * `document.body`, portaled content included):
 * - every `<button>` target must not be a submit button (`button.type !== 'submit'`, i.e. it
 *   carries `type="button"`). This is what catches **portaled** buttons (Dialog, Drawer, Popover
 *   content): a button portaled to `document.body` has no form owner, so clicking it can never
 *   submit this form. It still submits any form it is rendered in, such as a consumer form
 *   inside the dialog. A typeless button inside the form is reported the same way, even when its
 *   click handler happens to call `preventDefault()`, because implicit submission (Enter in a
 *   text field) activates it.
 * - every target inside the `<form>` is then clicked, and the test fails naming the first one
 *   whose click submitted the form (e.g. a `role="button"` element that calls `requestSubmit()`).
 *   Targets outside the form are not clicked: a click cannot submit this form, and dismissing
 *   an overlay would disconnect the remaining targets.
 *
 * Targets removed by an earlier click are skipped. The test fails when there is nothing to
 * check.
 *
 * @example
 * // Overlays always portal: open them, and every portaled button is checked.
 * testNoImplicitSubmit(Dialog, {
 *   defaultProps: { open: true, children: <Dialog.Content title="Edit">Body</Dialog.Content> },
 * });
 */
export function testNoImplicitSubmit<P extends object>(
  Component: React.ComponentType<P>,
  options: NoImplicitSubmitOptions<NoInfer<P>> = {},
): void {
  it('does not submit an enclosing form', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    const formRef = React.createRef<HTMLFormElement>();
    const form = React.createElement(
      'form',
      { ref: formRef, onSubmit, 'aria-label': 'Test form' },
      React.createElement(
        Component as unknown as React.ComponentType<AnyProps>,
        (options.defaultProps ?? {}) as AnyProps,
      ),
    );
    const { container, baseElement } = render(form, { wrapper: options.wrapper });
    const formElement = formRef.current;
    if (!formElement) throw new Error('testNoImplicitSubmit: the <form> did not render');
    const targets = options.getTargets
      ? options.getTargets(container)
      : Array.from(baseElement.querySelectorAll('button'));
    expect(targets.length, 'no <button> elements found to check').toBeGreaterThan(0);

    for (const target of targets) {
      const inForm = formElement.contains(target);
      if (target instanceof HTMLButtonElement) {
        expect(
          target.type,
          inForm
            ? `${describeElement(target)} has no type="button": it submits the enclosing form`
            : `${describeElement(target)} is outside the form (portaled) and has no type="button": it submits any form it is rendered in`,
        ).not.toBe('submit');
      }
    }
    for (const target of targets) {
      if (!target.isConnected || !formElement.contains(target)) continue;
      const label = describeElement(target);
      await user.click(target);
      expect(onSubmit, `clicking ${label} submitted the enclosing form`).not.toHaveBeenCalled();
    }
  });
}

/** Options of {@link testComposedHandler}. */
export interface ComposedHandlerOptions<P> {
  /** The consumer handler prop to pass, e.g. `'onClick'` or `'onKeyDown'`. */
  handler: Extract<keyof P, `on${string}`>;
  /** Props every render needs. */
  defaultProps?: TestProps<P>;
  /** Performs the interaction that triggers both the consumer handler and the built-in behaviour. */
  act: (utils: RenderResult & { user: UserEvent }) => Promise<void>;
  /** Asserts that the built-in behaviour ran (e.g. the tab is selected). */
  assertInternal: (utils: RenderResult) => void | Promise<void>;
  /**
   * Asserts that the built-in behaviour did **not** run after the consumer handler called
   * `event.preventDefault()`. When given, a second test is registered.
   */
  assertInternalSuppressed?: (utils: RenderResult) => void | Promise<void>;
  /** Wrapper rendered around the component. */
  wrapper?: TestWrapper;
}

/**
 * Registers the C-COMPOSE contract for one handler prop:
 * - `composes a consumer <handler> with the built-in behaviour`: a consumer handler is called and
 *   the internal behaviour still runs (`...rest` must not silently replace internal handlers);
 * - with `assertInternalSuppressed` — `a consumer <handler> that calls preventDefault() suppresses
 *   the built-in behaviour`.
 *
 * @example
 * testComposedHandler(TabList, {
 *   handler: 'onKeyDown',
 *   defaultProps: { children: tabs },
 *   act: async ({ user }) => { screen.getByRole('tab', { name: 'One' }).focus(); await user.keyboard('{ArrowRight}'); },
 *   assertInternal: () => expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus(),
 *   assertInternalSuppressed: () => expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus(),
 * });
 */
export function testComposedHandler<P extends object>(
  Component: React.ComponentType<P>,
  options: ComposedHandlerOptions<NoInfer<P>>,
): void {
  const handler = String(options.handler);

  const runWith = async (consumer: (event: { preventDefault(): void }) => void) => {
    const spy = vi.fn(consumer);
    const utils = renderComponent(
      Component,
      { ...options.defaultProps, [handler]: spy },
      { wrapper: options.wrapper },
    );
    await options.act({ ...utils, user: userEvent.setup() });
    expect(spy, `the consumer ${handler} was not called`).toHaveBeenCalled();
    return utils;
  };

  it(`composes a consumer ${handler} with the built-in behaviour`, async () => {
    const utils = await runWith(() => {});
    await options.assertInternal(utils);
  });

  const assertSuppressed = options.assertInternalSuppressed;
  if (assertSuppressed) {
    it(`a consumer ${handler} that calls preventDefault() suppresses the built-in behaviour`, async () => {
      const utils = await runWith((event) => event.preventDefault());
      await assertSuppressed(utils);
    });
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Options of {@link renderWithProviders}: RTL render options plus the `WaveProvider` props. */
export interface RenderWithProvidersOptions extends RenderOptions {
  /** `WaveProvider` theme. @default 'light' (the provider default) */
  theme?: WaveTheme;
  /** `WaveProvider` direction — use `'rtl'` for the RTL test of directional components. @default 'ltr' */
  dir?: WaveDir;
}

/**
 * Renders `ui` inside `<WaveProvider theme dir>` (the provider's existing `theme`/`dir` props).
 * A `wrapper` option is rendered inside the provider. Returns the usual RTL result; `rerender`
 * keeps the providers.
 *
 * @example
 * renderWithProviders(<Pagination totalPages={5} />, { dir: 'rtl' });
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const { theme, dir, wrapper: InnerWrapper, ...renderOptions } = options;
  function Providers({ children }: { children: React.ReactNode }) {
    const inner = InnerWrapper ? React.createElement(InnerWrapper, null, children) : children;
    return React.createElement(WaveProvider, { theme, dir, children: inner });
  }
  return render(ui, { ...renderOptions, wrapper: Providers });
}

/**
 * Returns `component` the way React Flight hands a client component written in a Server Component
 * to the client: as a `React.lazy` element type (`{ $$typeof: Symbol.for('react.lazy'), _payload,
 * _init }`) whose chunk has already loaded. So `<Lazy />.type !== component`, while the lazy
 * resolves synchronously to `component`: `renderToString` and the first client render show the
 * component (props and `ref` included) without suspending, and `getElementType` from
 * `src/lib/children.ts` unwraps it to `component`.
 *
 * Use it to test a compound that identifies its parts (R1): render the tree once with the plain
 * part types and once with `asClientReference(Part)`, and assert the same `renderToString` output
 * and the same behaviour. The return type is the component's own type, so JSX props stay checked.
 *
 * @example
 * const Tab = asClientReference(TabList.Tab);
 * const html = renderToString(<TabList><Tab value="a">A</Tab></TabList>);
 * expect(html).toBe(renderToString(<TabList><TabList.Tab value="a">A</TabList.Tab></TabList>));
 */
export function asClientReference<T extends React.JSXElementConstructor<never>>(component: T): T {
  type LoadedModule = { default: React.ComponentType<object> };
  const loaded = {
    then(onFulfilled: (module: LoadedModule) => void) {
      onFulfilled({ default: component as unknown as React.ComponentType<object> });
    },
  };
  return React.lazy(() => loaded as unknown as Promise<LoadedModule>) as unknown as T;
}

/**
 * Creates a wrapper that renders `Root` with `rootProps` around its children — for rendering an
 * overlay's sub-components in isolation. `rootProps` are `Root`'s props without `children` (the
 * wrapper supplies them); a discriminated-union props type keeps its variants
 * ({@link DistributiveOmit}).
 *
 * @example
 * const DialogWrapper = createOverlayTestWrapper(Dialog, { open: true, onOpenChange: () => {} });
 * render(<Dialog.Content>Content</Dialog.Content>, { wrapper: DialogWrapper });
 */
export function createOverlayTestWrapper<P extends object>(
  Root: React.ComponentType<P>,
  rootProps: NoInfer<DistributiveOmit<P, 'children'>> & { children?: React.ReactNode },
): React.ComponentType<{ children: React.ReactNode }> {
  function OverlayTestWrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Root as unknown as React.ComponentType<AnyProps>, {
      ...(rootProps as AnyProps),
      children,
    });
  }
  OverlayTestWrapper.displayName = 'OverlayTestWrapper';
  return OverlayTestWrapper;
}

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

/** Handle returned by {@link installResizeObserverMock}. */
export interface ResizeObserverMock {
  /**
   * Calls, inside `act()`, the callback of every observer observing `target` (with one entry for
   * it), or — without `target` — every observer with an entry per observed element. Entries use
   * the element's `getBoundingClientRect()` size (see {@link mockRect}). Nothing fires unless
   * triggered: real observers never call back synchronously inside `observe()`.
   */
  trigger(target?: Element): void;
  /** Removes the mock (restores the previous `ResizeObserver`, normally none). */
  restore(): void;
}

function toEntry(target: Element): ResizeObserverEntry {
  const rect = target.getBoundingClientRect();
  const size: ResizeObserverSize = { inlineSize: rect.width, blockSize: rect.height };
  return {
    target,
    contentRect: rect,
    borderBoxSize: [size],
    contentBoxSize: [size],
    devicePixelContentBoxSize: [size],
  };
}

/**
 * Installs a controllable `ResizeObserver` on `globalThis`/`window` (jsdom has none, and
 * `src/test-setup.ts` deliberately installs none). Call `restore()` when done (e.g. in
 * `afterEach`).
 *
 * @example
 * const ro = installResizeObserverMock();
 * render(<Overflow>…</Overflow>);
 * mockRect(container, { width: 120 });
 * ro.trigger(container);
 * ro.restore();
 */
export function installResizeObserverMock(): ResizeObserverMock {
  const observers = new Set<MockResizeObserver>();

  class MockResizeObserver implements ResizeObserver {
    readonly targets = new Set<Element>();
    readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      observers.add(this);
    }
    observe(target: Element): void {
      this.targets.add(target);
    }
    unobserve(target: Element): void {
      this.targets.delete(target);
    }
    disconnect(): void {
      this.targets.clear();
    }
  }

  const hosts: object[] = [globalThis];
  if (typeof window !== 'undefined' && (window as object) !== globalThis) hosts.push(window);
  const previous = hosts.map((host) => Object.getOwnPropertyDescriptor(host, 'ResizeObserver'));
  for (const host of hosts) {
    Object.defineProperty(host, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
  }

  return {
    trigger(target) {
      act(() => {
        for (const observer of Array.from(observers)) {
          const observed = Array.from(observer.targets).filter((t) => !target || t === target);
          if (observed.length > 0) observer.callback(observed.map(toEntry), observer);
        }
      });
    },
    restore() {
      observers.clear();
      hosts.forEach((host, i) => {
        const descriptor = previous[i];
        if (descriptor) Object.defineProperty(host, 'ResizeObserver', descriptor);
        else Reflect.deleteProperty(host, 'ResizeObserver');
      });
    },
  };
}

/**
 * Gives `el` a layout box (jsdom reports zeros): stubs `getBoundingClientRect()` with a full rect
 * built from `rect` (`x`/`left`, `y`/`top`, `width`, `height`; `right`/`bottom` derived when not
 * given) and defines `offsetWidth`/`clientWidth` = `width`, `offsetHeight`/`clientHeight` =
 * `height`. Calling it again replaces the previous values. `scrollWidth`/`scrollHeight` are left
 * alone (stub them separately to simulate overflowing content).
 */
export function mockRect(el: Element, rect: Partial<DOMRect>): void {
  const x = rect.x ?? rect.left ?? 0;
  const y = rect.y ?? rect.top ?? 0;
  const width = rect.width ?? (rect.right !== undefined ? rect.right - x : 0);
  const height = rect.height ?? (rect.bottom !== undefined ? rect.bottom - y : 0);
  const full = {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  };
  const domRect = { ...full, toJSON: () => full } as DOMRect;

  const define = (name: string, value: unknown) =>
    Object.defineProperty(el, name, { configurable: true, value });
  define('getBoundingClientRect', () => domRect);
  define('offsetWidth', width);
  define('clientWidth', width);
  define('offsetHeight', height);
  define('clientHeight', height);
}
