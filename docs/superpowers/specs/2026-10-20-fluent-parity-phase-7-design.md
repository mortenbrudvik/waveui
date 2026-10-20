# WaveUI 0.12.0 — Fluent Parity Phase 7 Design (overlay and focus primitives made public)

> Date: 2026-10-20 · Branch: `feat/fluent-parity-phase-7` in `.claude/worktrees/fluent-parity-phase-7`, from `main` 7e58742 (0.11.0 merged) · Package: `@mortenbrudvik/waveui` → **0.12.0**.
> Scope: Phase 7 of [`docs/ROADMAP.md`](../../ROADMAP.md): P7-01, P7-02, P7-03, plus two small additions that a real consumer needs (D9, D10).
> Status: **draft for the maintainer's approval.** Written without an interview: the maintainer is the only developer and the only consumer, and asked to proceed from the roadmap. Choices that are the author's, not the maintainer's, are marked **(my call)**.
> Inputs: the roadmap's Phase 7 section; the Phase 6 spec for form, rulings and gates; the code at 7e58742; the one consumer, `C:\code\prototypes\taskboard` (on waveui 0.7.0).

---

## 0. Intent

### 0.1 Why

The machinery behind WaveUI's overlays (positioning, the dismiss-layer stack, the modal layer, focus trap, grid roving) is internal. An app that needs a surface WaveUI does not ship (a command palette, a full-screen overlay, a custom popup) cannot join the layer stack: Escape order, outside presses and toasts would not know about it.

Taskboard already shows the cost, in two places:

- `apps/web/src/components/toast.tsx` hand-writes `data-wave-focus-trap-allow=""` on its own notification region, copying an attribute that is an internal contract (`ALLOW_OUTSIDE_SELECTOR` in `src/lib/layers.ts:64`). That is roadmap issue #5.
- `apps/web/src/app/shortcuts.tsx` asks "is a dialog open?" with `document.querySelector('[inert] .wave-root') !== null`, a guess at how isolation is implemented.

Phase 7 makes those contracts public and documented, so the next such workaround is not needed.

### 0.2 Goals

1. Public `usePopupPosition`, `useDismiss`, `DismissLayerProvider`, `useModalLayer`, `useFocusTrap`, `useRestoreFocus`, with documented options (P7-01, P7-02).
2. A `positioning` prop on the nine popup components for the advanced options (P7-01).
3. A documented, stable way to mark an app-owned region that modals leave usable (P7-02).
4. Grid roving, focusable groups, focus finders, the focus-ring recipes and a keyboard-navigation hook (P7-03).
5. A "Custom overlays" guide chapter and a `verify-dist` tree-shaking probe per new hook.

### 0.3 Non-goals and anti-goals

- No new component. Phase 7 adds hooks, a prop, and exports.
- No motion (Phase 10), no `inline` popups or per-surface mount nodes (`drw-5`, `dialog-6`: Phase 6 routed them here only as "publish the hooks"; the mount node stays in the backlog, §7).
- No change to how Dialog, Drawer, Popover, Menu or Toaster behave. **Anti-goal:** a public hook whose first use by the library's own components is a rewrite. The components already use these hooks; publishing must be an export plus documentation plus the additions listed here, with the existing test suites unchanged and green.
- No `inertTrapFocus`, no `useFocusableGroup` inside List or DataGrid beyond what P7-03 says (§4).
- Not P4-05 (`theme="system"`).

---

## 1. Rulings

- **D1 — One phase, one branch, one release, built sequentially.** P7-01 → P7-02 → P7-03 → INTEGRATION → DOCS, in the worktree above, by one agent at a time. No parallel waves: the three items touch overlapping files (`src/index.ts`, `layers.ts`, the hooks' tests) and the sole maintainer reviews serially. The CHANGELOG gets `## [0.12.0] - Unreleased` above `## [0.11.0]`. *(my call)*
- **D2 — Publishing is additive and behaviour-neutral.** Every hook keeps its present signature as the subset; new options default to today's behaviour. The existing suites for the hooks and the components stay unchanged. Where an option name changes (none planned), the old name stays as a deprecated alias (C-NAMING).
- **D3 — Public hooks follow the library's conventions (C-HOOKS, C-DOCS, C-DEV).** Each gets component-grade JSDoc with `@default`, an options and a result interface exported from the entry, and `"use client"` through the existing `src/hooks` banner. `src/lib` additions stay server-safe.
- **D4 — Stable, pre-1.0.** The new surface may change before 1.0 through the usual deprecation path; the README says so once in "Hooks and utilities". *(my call)*
- **D5 — `positioning` carries advanced options only.** `side` and `align` stay the top-level way to place a surface (roadmap ruling). `PopupPositioning` = `{ offset?, fitViewport?, matchReferenceWidth?, fallbackPlacements?, target? }`. The hook options `shift`, `flip`, `strategy`, `hideWhenDetached` and `onPositioned` are hook-only in 0.12; adding them to the prop later is non-breaking. *(roadmap, with the hook-only line my call)*
- **D6 — One `target` type.** `PopupTarget` (an element held in state, or a `VirtualElement`) plus `React.RefObject<HTMLElement | null>`, everywhere. `Menu.Popover` and `Popover` gain `RefObject`; `TeachingPopover` gains `VirtualElement` (both widen, neither breaks). The RefObject form resolves at layout time with the existing "hidden until the target is positioned against" behaviour of TeachingPopover.
- **D7 — `fallbackPlacements` is a list of `{ side, align? }`.** The type is exported as `PopupPlacement`; `side` and `align` are the existing unions, so logical sides (`start`/`end`) mirror in RTL as they do today. *(my call; Fluent uses placement strings)*
- **D8 — The Escape order, outside-press and toast behaviours are the contract.** A custom surface built on the public hooks must behave as the built-ins: topmost layer first on Escape, a press inside the Toaster or an allowed region closes nothing, focus return goes to the opener. P7-01 and P7-02 acceptance stories prove it (§3.1, §3.2).
- **D9 — The allow-region contract is public (P7-02, issue #5).** The attribute `data-wave-focus-trap-allow` is documented as public and does not change (taskboard keeps working). A server-safe export `modalAllowProps` (`{ 'data-wave-focus-trap-allow': '' }`) is added for spread, and the README documents what the attribute does: the region's content counts as inside every dismiss layer, its tabbables join every focus trap's Tab cycle, and modal isolation never makes it `inert`. *(name my call)*
- **D10 — A "modal open" query is public (ride-along, from taskboard).** `useModalOpen(): boolean` (true while any `modal`-kind layer is open; a `useSyncExternalStore` over `subscribeLayers`, `false` on the server) and the non-hook `hasOpenModal(): boolean`. It replaces guessing from `[inert]`. Size S; the maintainer may strike it. *(my call; not in the roadmap)*
- **D11 — Grid roving is `useRovingTabIndex({ orientation: 'grid' })`.** The internal `useRovingGrid` (SwatchPicker) becomes a thin wrapper over it and stays internal. Rows come from `role="row"` elements (today's rule), or from an optional `columns` count for a flat list of cells. Home/End per row, Ctrl+Home/End for the grid, Up/Down to the same index else the nearest enabled cell: exactly today's `useRovingGrid` rules, so SwatchPicker's tests are the regression suite.
- **D12 — `useFocusableGroup` semantics are fixed against Fluent before code (§4.2).** `tabBehavior: 'unlimited' | 'limited' | 'limited-trap-focus'`, Enter or F2 enters, Escape leaves. The Tab rules of each mode are tabster's groupper rules, read from its docs and Fluent's hook; §4.2 states them.
- **D13 — `useFocusVisible()` returns a boolean.** True while the last input was the keyboard. One module-level store with ref-counted document listeners, `false` on the server and before the first interaction. It does not replace CSS `:focus-visible`; it exists for logic that needs the mode (a roving item that shows a ring in script-driven widgets). *(my call)*
- **D14 — Style recipes are exported as constants.** `focusRing`, `focusRingInset`, `inputFocus` (and `inputFocusWithin`, which `inputFocus` pairs with) are exported from the entry. A pack-smoke check proves their classes exist in `dist/styles.css` and in the Tailwind fixture's output, so a consumer who uses them gets the focus look without extra configuration.
- **D15 — `useGridNavigation` is exported as it is.** It is the static Table's navigation; its options and result types are exported with it (`UseGridNavigationOptions`, `UseGridNavigationResult`, `GridNavigationHandlers`). DataGrid and Table keep using it.

---

## 2. Packages and order

| Step | Content | Touches |
|---|---|---|
| 0 | Plan task: research Fluent's focusable-group Tab rules (D12) | notes only |
| 1 | **P7-01** positioning options, `positioning` prop, exports | `usePopupPosition.ts`, nine components, `lib/types.ts`, `index.ts` |
| 2 | **P7-02** exports, `modalAllowProps`, `useModalOpen`, `hasOpenModal` | `index.ts`, `lib/layers.ts` (additions only), hooks docs |
| 3 | **P7-03** grid orientation, `useFocusableGroup`, `useFocusVisible`, finder and recipe exports | `useRovingTabIndex.ts`, `useRovingGrid.ts`, `lib/focus.ts`, new hooks, `index.ts` |
| 4 | INTEGRATION: barrels, public-types list, `verify-dist` probes, pack-smoke checks, integration stories | `index.ts`, `scripts/`, `src/__tests__/` |
| 5 | DOCS: CHANGELOG, README "Hooks and utilities", the "Custom overlays" guide chapter, ROADMAP status, CLAUDE.md hooks list | docs |
| 6 | Lead: gate (`/gate`), real-browser checklist (§6), commit per step | — |

Each step ends green on its focused tests and the conventions gate; the full gate runs at step 6. Commits per step, conventional subjects, no attribution trailer (project rule).

---

## 3. P7-01 and P7-02: overlay hooks

### 3.1 `usePopupPosition` (P7-01)

Already exported internally with `open`, `side`, `align`, `offset`, `flip`, `shift`, `matchReferenceWidth`, `fitViewport`, `arrowRef`, `strategy` and a result with `setReference`, `setFloating`, `floatingStyles`, `arrowStyles`, `placement`, `side`, `isPositioned`, `floatingProps`. Additions:

- `fallbackPlacements?: readonly PopupPlacement[]` (D7), passed to the flip middleware.
- `hideWhenDetached?: boolean` (default `false`): when the anchor is clipped out of view, the surface hides (`visibility: hidden` through `floatingStyles`, so layout and focus are unaffected). Uses floating-ui's `hide` middleware.
- `onPositioned?(info: { placement: string; side; isPositioned: boolean }): void`, called after each computed position changes the placement (not every scroll tick). Called from an effect, never during render.
- Result gains `update(): void`, the imperative recompute (floating-ui's `update`), a no-op while closed.

The `positioning` prop (D5, `PopupPositioning`) goes on Popover, `Menu.Popover`, Tooltip, TeachingPopover, Combobox, Dropdown, TagPicker, DatePicker and TimePicker, each forwarding to its existing `usePopupPosition` call. Popover also gets `fitViewport` through it (Fluent's `autoSize`). Where a component already hard-codes an option (listboxes: `matchReferenceWidth`), the consumer's value wins, merged after the default. JSDoc of each prop names Fluent's `positioning` prop.

*Tests:* hook tests for each new option (fake `getBoundingClientRect` via `mockRect`; jsdom has no layout, so assert the middleware inputs and the style output); one `positioning` test per component (offset reaches the style; `target` as element, `VirtualElement` and `RefObject`); RTL for logical `fallbackPlacements`; StrictMode "onPositioned once per change".

*Acceptance story:* "Custom popup on public hooks": a menu-like surface built only from the exports sits correctly, closes on Escape topmost-first with a Popover opened over it, ignores a press in a Toaster, and returns focus to its trigger.

### 3.2 Modal layer, trap, restore (P7-02)

Exports: `useModalLayer`, `useFocusTrap`, `useInitialFocus` (it is part of the same contract), `useRestoreFocus`, `useDismiss` with `DismissLayerProvider` and `DismissLayerContext` (already in `useDismiss.ts`), `Portal layerId` (already a prop), and their option and result types. `useModalIsolation` and `useScrollLock` stay internal: `useModalLayer` is the documented way to get them.

- `modalAllowProps` and the documented attribute (D9). `ALLOW_OUTSIDE_SELECTOR` stays internal.
- `useModalOpen` / `hasOpenModal` (D10), in `src/hooks/` and `src/lib/layers.ts` respectively (the non-hook form is server-safe and returns `false` without a document).
- README "Hooks and utilities" gains a short section for each; the guide's new chapter ("Custom overlays") shows a command palette over a Dialog and under a Toaster, and an app-owned notification region using `modalAllowProps`.

*Tests:* an integration test (in `integration.test.tsx`) with a command-palette fixture on `useModalLayer`: opens over a Dialog, Escape closes it first, then the Dialog; a Toaster stays hit-testable and in the Tab cycle; a region with `modalAllowProps` stays non-`inert`, reachable by Tab, and a press in it closes no layer; `useModalOpen` flips with a Dialog in StrictMode (renders once per change, no act warnings); SSR `renderToString` returns `false`. The leak check in `src/test-setup.ts` already covers layers, traps, locks and isolation.

*Guard:* `inert` isolation instead of `aria-modal` stays (toasts keep being announced).

---

## 4. P7-03: focus navigation

### 4.1 Grid roving

`useRovingTabIndex({ orientation: 'grid', columns? })` (D11). Result unchanged. Without `role="row"` rows and without `columns`, grid mode behaves like `'both'` and warns once in development. `useRovingGrid` delegates; SwatchPicker's, DataGrid's own and Toolbar's suites must pass untouched. RTL test: Left/Right mirrored across rows.

### 4.2 `useFocusableGroup`

Settled from the sources (Task 1): Fluent's `useFocusableGroup` is a thin wrapper over tabster's *groupper* (`microsoft/tabster`, `docs/docs/groupper.md`; Fluent's `react-tabster/src/hooks/useFocusableGroup.ts`). A group element is itself focusable (`tabindex` 0).

`useFocusableGroup({ tabBehavior })` returns `{ groupProps }` to spread on the group element: `ref`, `tabIndex: 0`, `onKeyDown`, `onBlur` and `data-focusable-group` (the `ref`, `onBlur` and key handlers are WaveUI's addition: the limited modes stamp the inner tab stops and need the container and the focus-leave signal).

| Mode | Enter / F2 on the group | Tab / Shift+Tab | Escape from inside |
|---|---|---|---|
| `unlimited` (default) | not intercepted: no Enter is needed | the inner elements are reachable by Tab as usual; the group is one more tab stop | not intercepted |
| `limited` | focus the first tabbable inside; the inner tab stops come back | before entering, the group is one tab stop (its inner tabbables are skipped); once inside, Tab moves between the inner tabbables and past the last one leaves the group; Shift+Tab before the first returns to the group | focus the group; the inner tabbables are skipped again |
| `limited-trap-focus` | same | like `limited`, but Tab past the last inner tabbable wraps to the first and Shift+Tab before the first wraps to the last, until Escape | same |

Skipping is done by setting `tabindex="-1"` on the group's tabbable descendants while the group is not entered (the original value is kept in `data-focusable-group-tabindex` and restored on entering; a `MutationObserver` stamps content added later). Leaving by focus moving outside (`blur` to an element outside the group) counts as leaving. Keys whose target is not inside the group in the DOM (a portaled popup opened from it) and keys that belong to a nested group are ignored (C-COMPOSE); a key a descendant already handled (`defaultPrevented`, such as an input that consumes Escape) is left alone. Differences from Fluent: none planned; tabster's `delegated` option and the `GroupperMoveFocusEvent` are not taken.

Tests: each mode's rules, nested groups, a consuming input, a portaled popup, StrictMode, `renderToString`; RTL irrelevant (no horizontal keys).

### 4.3 Exports

- Finders from `src/lib/focus.ts`: `getTabbableElements`, `getFirstTabbable`, `getLastTabbable` (D3: server-safe, they do nothing without a document).
- Recipes (D14), `useGridNavigation` and its types (D15), `useFocusVisible` (D13).
- The guide's focus chapter documents these and `useActiveDescendant` (public since P5-03).

*Guards:* Toolbar works over any focusable descendant; DataGrid's automatic cell focus targets; the `useRovingTabIndex` hand-back rules (CLAUDE.md) hold for `'grid'`.

---

## 5. Gates and bookkeeping

- `src/__tests__/public-types.test.ts`: every named type of the new signatures reaches the entry (`UsePopupPositionOptions`, `UsePopupPositionResult`, `PopupPositioning`, `PopupPlacement`, `UseDismissOptions`, `DismissLayer`, `UseModalLayerOptions`, `UseFocusTrapOptions`, `UseInitialFocusOptions`, `UseRestoreFocusOptions`, `UseFocusableGroupOptions`, `UseFocusableGroupResult`, the grid-navigation types). `PENDING_PUBLIC_TYPES` and `PENDING_FLAT_EXPORTS` hold the gates green while a step lands, and step 4 empties them.
- `scripts/verify-dist.mjs`: a probe per new hook that an import of only that hook pulls no component, no `Dialog`, no `Menu` and no floating-ui when the hook does not use it (`useFocusVisible`, `useFocusableGroup`, the finders; `usePopupPosition` may pull floating-ui and nothing else).
- `src/lib/classNames.ts`: no component is added, so no constant.
- Tailwind words: JSDoc examples avoid bare utility words (`src/hooks` is not scanned by the CSS build, `src/lib` is, so lib comments follow the rule).
- Count of components stays 78. README table unchanged; "Hooks and utilities" grows.

---

## 6. Real-browser checklist (lead, `/browser-check`)

1. Custom popup story: flips at the viewport edge with `fallbackPlacements`, hides with `hideWhenDetached` when its scroll container clips the anchor, `fitViewport` on a Popover limits its height.
2. Command palette over a Dialog: Escape order, backdrop press, focus return, Tab cycle includes a toast and a `modalAllowProps` region.
3. SwatchPicker and a `columns` grid: arrow keys, Home/End, Ctrl+Home/End in LTR and RTL.
4. `useFocusableGroup` in each mode with a screen reader pass on NVDA if available (note the result in the PR).
5. Taskboard: bump it to the built tarball, replace the hand-written attribute with `modalAllowProps` and the `[inert]` query with `useModalOpen`, and run its checks. Optional, outside this repository; not a gate.

---

## 7. Backlog this phase leaves

Per-surface mount nodes (`drw-5`, `dialog-6`); an effective-open context so popups inside a closing kept-mounted surface close with it; Fluent's `inertTrapFocus`; `shift`, `flip`, `strategy` on the `positioning` prop; light dismiss for non-modal surfaces; `useFocusableGroup` inside List and DataGrid.

## 8. Calls to check while reading

D1 (sequential, one worktree), D4 (pre-1.0 stability note), D5 (hook-only options), D7 (`fallbackPlacements` shape), D9 (`modalAllowProps` name), D10 (`useModalOpen` / `hasOpenModal`, not in the roadmap), D13 (`useFocusVisible` returns a boolean), and the decision to leave D12's Tab rules to a research task.
