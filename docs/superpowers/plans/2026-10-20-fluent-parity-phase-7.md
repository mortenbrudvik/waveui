# Phase 7 (0.12.0) Implementation Plan: overlay and focus primitives made public

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish WaveUI's positioning, dismiss, modal-layer, focus and grid-roving machinery as documented public API, with a `positioning` prop on nine popup components.

**Architecture:** The hooks already exist and are used by the built-in components, so publishing is mostly barrel exports plus documented option additions. Behaviour of existing components does not change; their current suites are the regression net. New hooks (`useFocusableGroup`, `useFocusVisible`, `useModalOpen`) are small, SSR-safe and tree-shakeable.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library + vitest-axe, `@floating-ui/react-dom`, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-10-20-fluent-parity-phase-7-design.md` (rulings D1–D15). Read it and `CLAUDE.md` (conventions C-*) first. Work in this worktree; run `npx vitest run <files> --reporter=default` for focused runs.

## Global Constraints

- Version 0.12.0; CHANGELOG section `## [0.12.0] - Unreleased` above `## [0.11.0]`.
- Behaviour-neutral: existing hook and component suites stay unchanged and green (D2). New options default to today's behaviour.
- Every new public symbol: component-grade JSDoc with `@default` (C-DOCS), its option/result types exported from `src/index.ts` (`public-types.test.ts`), named in the barrel. `src/lib` additions are server-safe; `src/hooks` get the `"use client"` banner automatically.
- Warnings only via `src/lib/dev.ts`, from effects (`warnOnce`); never `devWarn` in render (C-DEV).
- No bare Tailwind utility words in `src/lib` or `src/components` comments/strings (CLAUDE.md "Styling").
- Hooks follow C-HOOKS: no ref reads during render, derive state in render, effects for subscriptions.
- Commits: conventional subjects, **no attribution trailer** (project rule), one commit per task.
- Pending lists (`PENDING_PUBLIC_TYPES`, `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs`) keep gates green between tasks; Task 13 empties them.

## Review Focus

1. `positioning={{ offset: 0 }}` (and a negative offset) must apply, not fall back to the component's default offset (zero is falsy).
2. `target` as a `RefObject` whose `.current` is `null`, then set, then swapped: no crash, surface stays hidden until positioned, follows the new element.
3. `useModalOpen` while a Dialog closes through the presence core: false in the closing commit (key on the layer, not the mount), true again on reopen; nested modals stay true until the last closes.
4. Grid roving with ragged rows, an empty or `hidden` row, a `columns` count that does not divide the cell count, and RTL.
5. `useFocusableGroup` with a nested group, an editable input that handles Escape/Enter itself, and a portaled popup opened from inside (keys from it are ignored).

---

## File structure

| File | Change |
|---|---|
| `src/lib/types.ts` | add `PopupPlacement`, `PopupPositioning`; widen `PopupTarget` docs |
| `src/hooks/usePopupPosition.ts` | new options/result members; `resolvePositioning` internal helper |
| `src/components/overlays/Popover.shared.tsx` | `useResolvedTarget` (the TeachingPopover ref logic extracted) |
| Popover, `Menu.popover.tsx`, Tooltip, TeachingPopover, Combobox, Dropdown, TagPicker, DatePicker, TimePicker (+ `Option.tsx` listbox popup) | `positioning` prop |
| `src/lib/layers.ts` | `hasOpenModal`, `modalAllowProps` |
| `src/hooks/useModalOpen.ts` (new) | `useModalOpen` |
| `src/hooks/useFocusVisible.ts` (new) | `useFocusVisible` |
| `src/hooks/useFocusableGroup.ts` (new) | `useFocusableGroup` |
| `src/hooks/useRovingTabIndex.ts`, `useRovingGrid.ts` | `orientation: 'grid'`, `columns` |
| `src/index.ts`, `src/components/table/index.ts` (if it barrels) | exports |
| `scripts/verify-dist.mjs`, `scripts/pack-smoke.mjs` | probes, recipe checks |
| `stories/CustomOverlays.stories.tsx` (new), `src/__tests__/integration.test.tsx` | acceptance story and tests |
| README, `docs/WAVE-UI-GUIDE.md`, CHANGELOG, ROADMAP, CLAUDE.md | docs |

---

### Task 1: Settle `useFocusableGroup` Tab rules (D12)

**Files:** Modify `docs/superpowers/specs/2026-10-20-fluent-parity-phase-7-design.md` §4.2.

**Interfaces:** Produces the fixed rule table that Task 10 implements.

- [ ] **Step 1:** Dispatch the `fluent-parity-researcher` agent: "In `microsoft/fluentui` and `microsoft/tabster`, what exactly do `useFocusableGroup` `tabBehavior` `unlimited`, `limited` and `limited-trap-focus` do on Tab, Shift+Tab, Enter, F2 and Escape, and what does the group element's `tabindex` do?"
- [ ] **Step 2:** Replace the intent table in spec §4.2 with the researched rules (one row per mode, columns Enter/F2, Tab, Shift+Tab, Escape); keep WaveUI differences marked.
- [ ] **Step 3:** Commit: `docs: fix useFocusableGroup Tab rules from Fluent's source`.

---

### Task 2: Types and new `usePopupPosition` options

**Files:** Modify `src/lib/types.ts`, `src/hooks/usePopupPosition.ts`; Test `src/hooks/__tests__/usePopupPosition.test.tsx`.

**Interfaces:**
- Produces in `types.ts`: `export interface PopupPlacement { side: PopupSide; align?: PopupAlign }` and `export interface PopupPositioning { offset?: number; fitViewport?: boolean; matchReferenceWidth?: boolean; fallbackPlacements?: readonly PopupPlacement[]; target?: PopupTarget | React.RefObject<HTMLElement | null> }`.
- Produces in the hook: options `fallbackPlacements?: readonly PopupPlacement[]`, `hideWhenDetached?: boolean` (default `false`); an internal export `resolvePositioning(positioning: PopupPositioning | undefined, defaults: { offset?: number; matchReferenceWidth?: boolean; fitViewport?: boolean }): Pick<UsePopupPositionOptions, 'offset' | 'matchReferenceWidth' | 'fitViewport' | 'fallbackPlacements'>` where a defined consumer value (including `0` and `false`) wins over the default.

- [ ] **Step 1:** Write failing tests: `fallbackPlacements maps logical sides to physical ones in RTL`, `fallbackPlacements reaches the flip middleware` (spy on the floating-ui `flip` options through the existing test's mocks), `hideWhenDetached sets visibility hidden in floatingStyles when the anchor is clipped`, `resolvePositioning lets offset 0 and a negative offset win over the default`, `resolvePositioning keeps defaults for undefined values`.
- [ ] **Step 2:** Run `npx vitest run src/hooks/__tests__/usePopupPosition.test.tsx`; expect the new tests to FAIL.
- [ ] **Step 3:** Implement. Map each `PopupPlacement` to a floating-ui placement string with the hook's existing `resolveSide`; add floating-ui's `hide` middleware only when `hideWhenDetached`, and merge `visibility: 'hidden'` into `floatingStyles` when it reports `referenceHidden`.
- [ ] **Step 4:** Run the file again, then `npx tsc -p tsconfig.dev.json --noEmit`; expect PASS.
- [ ] **Step 5:** Commit: `feat(hooks): fallbackPlacements and hideWhenDetached for usePopupPosition`.

---

### Task 3: `onPositioned` and `update()`

**Files:** Modify `src/hooks/usePopupPosition.ts`; Test same file.

**Interfaces:** Produces option `onPositioned?: (info: { placement: string; side: 'top' | 'bottom' | 'left' | 'right'; isPositioned: boolean }) => void` and result member `update(): void`.

- [ ] **Step 1:** Failing tests: `onPositioned fires once when the placement changes and not on every recompute`, `onPositioned runs in StrictMode once per change`, `onPositioned is not called while closed`, `update recomputes the position on demand`, `update is a no-op while closed`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `onPositioned` with `useEventCallback`, called from an effect keyed on `placement` and `isPositioned`; expose floating-ui's `update` (stable via `useCallback`), guarded by `open`.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat(hooks): onPositioned and update() for usePopupPosition`.

---

### Task 4: `useResolvedTarget` and the unified `target`

**Files:** Modify `src/components/overlays/Popover.shared.tsx`, `TeachingPopover.tsx`, `Popover.tsx`, `src/components/navigation/Menu.popover.tsx`; Tests in the existing `Popover`, `Menu` popover and `TeachingPopover` suites.

**Interfaces:**
- Consumes: `PopupPositioning['target']` from Task 2.
- Produces: `useResolvedTarget(target: PopupTarget | React.RefObject<HTMLElement | null> | undefined): { element: HTMLElement | VirtualElement | null; hasTarget: boolean }` in `Popover.shared.tsx`, extracted from TeachingPopover's ref handling (hidden until positioned, re-resolved when the ref's element changes), no behaviour change there.

- [ ] **Step 1:** Failing tests: `Popover accepts a RefObject target`, `Menu.Popover accepts a RefObject target`, `TeachingPopover accepts a VirtualElement target`, `a RefObject with a null current keeps the surface hidden without throwing`, `swapping the ref's element repositions to the new element`.
- [ ] **Step 2:** Run the three suites; expect the new tests to FAIL and the old ones to pass.
- [ ] **Step 3:** Extract the helper from TeachingPopover (its suite must pass untouched), then use it in Popover and `Menu.popover.tsx`; widen their `target` prop types and JSDoc (remove the "a ref cannot be observed" sentence; remove the P7-01 note on `PopupTarget` in `types.ts`).
- [ ] **Step 4:** Run the three suites; expect PASS.
- [ ] **Step 5:** Commit: `feat(overlays): one target type for Popover, Menu.Popover and TeachingPopover`.

---

### Task 5: `positioning` prop on Popover, Menu.Popover, Tooltip, TeachingPopover

**Files:** Modify the four components; Tests in their suites.

**Interfaces:** Consumes `PopupPositioning`, `resolvePositioning`, `useResolvedTarget`. Produces prop `positioning?: PopupPositioning` on each, JSDoc naming Fluent's `positioning` prop; the existing top-level `target` stays; setting both it and `positioning.target` warns once (dotted key `Popover:positioning-target`) and the top-level one wins.

- [ ] **Step 1:** Per component, failing tests: `positioning.offset reaches the popup position` (Popover default 8, Tooltip 8, TeachingPopover 12, Menu.Popover its default), `positioning.offset 0 applies`, `positioning.fitViewport limits the surface` (Popover; assert the max-size styles), `positioning.target positions against the target`, `both target props warn once and the top-level wins`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Pass `resolvePositioning(positioning, { offset: <current> })` into each `usePopupPosition` call; keep `side`/`align` top-level.
- [ ] **Step 4:** Run the four suites plus `npx vitest run src/__tests__/conventions.test.ts -t "overlays"`; expect PASS.
- [ ] **Step 5:** Commit: `feat(overlays): positioning prop on Popover, Menu.Popover, Tooltip and TeachingPopover`.

---

### Task 6: `positioning` prop on Combobox, Dropdown, TagPicker, DatePicker, TimePicker

**Files:** Modify `src/components/input/Option.tsx` (the listbox popup shared by Combobox, Dropdown, TagPicker), `DatePicker.tsx`, `TimePicker.tsx`, `Combobox.tsx`, `Dropdown.tsx`, `TagPicker.root.tsx`; Tests in their suites.

**Interfaces:** Consumes Task 2/5 pieces. Produces the same `positioning` prop; listbox defaults (`matchReferenceWidth: true`, `fitViewport: true`) remain unless the consumer sets them.

- [ ] **Step 1:** Failing tests per component: `positioning.offset reaches the listbox position`, `positioning.matchReferenceWidth false lets the listbox size itself`, `fallbackPlacements are tried in order` (jsdom: assert the options reaching the hook through a `usePopupPosition` spy in one shared test file), DatePicker/TimePicker `positioning.offset applies`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Thread the prop through `ListboxSurface` options (internal) to the hook call at `Option.tsx:621`; same for the other two.
- [ ] **Step 4:** Run the five suites and the Field integration test; expect PASS.
- [ ] **Step 5:** Commit: `feat(input): positioning prop on the pickers`.

---

### Task 7: Modal-open query and the allow-region export

**Files:** Modify `src/lib/layers.ts`; Create `src/hooks/useModalOpen.ts`, `src/hooks/__tests__/useModalOpen.test.tsx`; extend `src/lib/__tests__/layers.test.ts`.

**Interfaces:**
- Produces in `layers.ts` (server-safe): `export function hasOpenModal(): boolean` (true while a registered layer of kind `'modal'` is open; `false` without layers or on the server) and `export const modalAllowProps: { readonly 'data-wave-focus-trap-allow': '' }`.
- Produces `export function useModalOpen(): boolean` using `useSyncExternalStore(subscribeLayers, hasOpenModal, () => false)`.

- [ ] **Step 1:** Failing tests: `hasOpenModal is false with no layers`, `hasOpenModal is true while a modal layer is registered and ignores popover/dialog kinds`, `useModalOpen flips with a Dialog and renders once per change in StrictMode`, `useModalOpen is false in renderToString`, `useModalOpen is false in the closing commit of a presence Dialog and true after reopen`, `nested modals stay true until the last closes`, `modalAllowProps spread keeps a region non-inert, tabbable in a Dialog's cycle, and a press in it closes no layer` (the last in Task 9's integration test if easier).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement as the Interfaces say; JSDoc on `modalAllowProps` states the three effects (counts as inside every dismiss layer, its tabbables join every focus trap, never made inert).
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat: useModalOpen, hasOpenModal and modalAllowProps`.

---

### Task 8: Barrel exports for the overlay hooks and types

**Files:** Modify `src/index.ts`, `src/__tests__/public-types.test.ts` (INTERNAL_HELPERS if needed), `scripts/verify-dist.mjs`; Test `src/__tests__/integration.test.tsx` barrel test.

**Interfaces:** Consumes everything above. Exports: `usePopupPosition`, `useDismiss`, `DismissLayerProvider`, `DismissLayerContext`, `useModalLayer`, `useFocusTrap`, `useInitialFocus`, `useRestoreFocus`, `useModalOpen`, `hasOpenModal`, `modalAllowProps`, and the types `UsePopupPositionOptions`, `UsePopupPositionResult`, `PopupPlacement`, `PopupPositioning`, `UseDismissOptions`, `DismissLayer`, `UseModalLayerOptions`, `UseFocusTrapOptions`, `UseInitialFocusOptions`, `UseRestoreFocusOptions`. `useModalIsolation` and `useScrollLock` stay internal and appear in the "keeps internal helpers out of the public API" list.

- [ ] **Step 1:** Failing tests: extend the barrel test to assert each name above is exported from `src/index.ts` and the two internals are not; `public-types` expects the new types.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/integration.test.tsx src/__tests__/public-types.test.ts`; expect FAIL.
- [ ] **Step 3:** Add the exports (`export type *` from `lib/types` already covers the lib types); add each hook name to `PENDING_FLAT_EXPORTS` only if `verify-dist` fails before Task 13.
- [ ] **Step 4:** Run the same command plus `npm run typecheck`; expect PASS.
- [ ] **Step 5:** Commit: `feat: export the overlay hooks and their types`.

---

### Task 9: Custom-overlay acceptance story and integration test

**Files:** Create `stories/CustomOverlays.stories.tsx`; Modify `src/__tests__/integration.test.tsx`, `src/__tests__/stories.a11y.test.tsx` only through the story.

**Interfaces:** Consumes the public hooks only (import from `'../src'`): a `CommandPalette` fixture on `useModalLayer` + `Portal layerId` + `usePopupPosition`-free centered layout; a `CustomPopup` fixture on `usePopupPosition` + `useDismiss`; an `AppRegion` with `{...modalAllowProps}`.

- [ ] **Step 1:** Failing integration tests: `custom popup built on public hooks closes topmost-first with a Popover opened over it`, `a press inside a Toaster or a modalAllowProps region closes no layer`, `command palette over a Dialog: Escape closes the palette first, then the Dialog, and focus returns to each opener`, `command palette keeps a Toaster and an allow region in its Tab cycle and leaves them non-inert`.
- [ ] **Step 2:** Run; expect FAIL (fixtures missing).
- [ ] **Step 3:** Write the fixtures in the story file (title `Components/Overlays/Custom overlays`, args and `fn()` per C-STORIES, tokens only, accessible names); import them in the test via the story's CSF exports.
- [ ] **Step 4:** Run the integration file and `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Custom overlays"`; expect PASS.
- [ ] **Step 5:** Commit: `test: custom overlays on the public hooks`.

---

### Task 10: Grid orientation in `useRovingTabIndex`

**Files:** Modify `src/hooks/useRovingTabIndex.ts`, `src/hooks/useRovingGrid.ts`; Tests `useRovingTabIndex.test.tsx`; `useRovingGrid.test.tsx` and SwatchPicker suites must pass untouched.

**Interfaces:** Produces options `orientation?: 'horizontal' | 'vertical' | 'both' | 'grid'` and `columns?: number` (rows from `role="row"` elements when present; otherwise consecutive groups of `columns` items; neither ⇒ behaves as `'both'` and `warnOnce('useRovingTabIndex:grid-rows', …)` from an effect). `useRovingGrid({ activeValue })` keeps its signature and delegates.

- [ ] **Step 1:** Failing tests (reuse `useRovingGrid.test.tsx` cases against the new option): `grid: Left/Right cross rows`, `Up/Down keep the index else the nearest enabled cell`, `Home/End per row and Ctrl+Home/End for the grid`, `columns count rows without role=row`, `a columns count that does not divide the cells leaves a short last row`, `an empty or hidden row is skipped`, `ragged rows`, `RTL mirrors Left/Right`, `grid without rows or columns warns once and acts as both`, `StrictMode`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Move the grid key logic of `useRovingGrid.ts` into the hook's keydown path under `orientation === 'grid'`; reduce `useRovingGrid.ts` to a wrapper. Keep the hand-back rules.
- [ ] **Step 4:** Run `npx vitest run src/hooks/__tests__ src/components/input/__tests__/SwatchPicker*.test.tsx src/components/table`; expect PASS.
- [ ] **Step 5:** Commit: `feat(hooks): grid orientation for useRovingTabIndex`.

---

### Task 11: `useFocusableGroup`

**Files:** Create `src/hooks/useFocusableGroup.ts`, `src/hooks/__tests__/useFocusableGroup.test.tsx`.

**Interfaces:** Produces `export interface UseFocusableGroupOptions { tabBehavior?: 'unlimited' | 'limited' | 'limited-trap-focus' }` (default `'unlimited'`), `export interface UseFocusableGroupResult { groupProps: { tabIndex: 0; onKeyDown: React.KeyboardEventHandler<HTMLElement>; 'data-focusable-group': '' } }` and `export function useFocusableGroup(options?: UseFocusableGroupOptions): UseFocusableGroupResult`. Rules per mode come from the spec §4.2 table as fixed by Task 1. Uses `getTabbableElements`/`getFirstTabbable` from `src/lib/focus.ts`, ignores keys whose target is not inside `event.currentTarget` in the DOM (C-COMPOSE), and leaves Enter/Escape to an editable target (`isEditableTarget`).

- [ ] **Step 1:** Failing tests, one block per mode: `Enter moves focus to the first tabbable`, `F2 does too`, `Escape returns focus to the group`, the mode's Tab/Shift+Tab rule from the table, `a hidden or inert tabbable is skipped`, `an input inside keeps its own Enter and Escape`, `keys from a portaled popup are ignored`, `nested groups: Escape leaves only the innermost`, `StrictMode`, `renderToString output has tabindex 0`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement with `useEventCallback` for the handler; no listeners on `document`.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit: `feat(hooks): useFocusableGroup`.

---

### Task 12: `useFocusVisible`

**Files:** Create `src/hooks/useFocusVisible.ts`, `src/hooks/__tests__/useFocusVisible.test.tsx`.

**Interfaces:** Produces `export function useFocusVisible(): boolean` via `useSyncExternalStore` over a module-level store: `keydown` (non-modifier-only keys) sets true, `pointerdown`/`mousedown`/`touchstart` set false; listeners added on the first subscriber and removed on the last; server and hydration snapshot `false`.

- [ ] **Step 1:** Failing tests: `false before any interaction`, `true after a key press, false after a pointer press`, `a lone modifier key does not switch it`, `one listener set for many subscribers and none after the last unmount` (spy on `document.addEventListener`/`removeEventListener`), `renderToString and hydration give false without a mismatch warning`, `StrictMode`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS (the post-test leak check in `test-setup.ts` must stay clean).
- [ ] **Step 5:** Commit: `feat(hooks): useFocusVisible`.

---

### Task 13: Exports of the focus utilities; probes and pack checks

**Files:** Modify `src/index.ts`, `scripts/verify-dist.mjs`, `scripts/pack-smoke.mjs`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`.

**Interfaces:** Exports `useFocusableGroup`, `useFocusVisible`, `useGridNavigation`, `getTabbableElements`, `getFirstTabbable`, `getLastTabbable`, `focusRing`, `focusRingInset`, `inputFocus`, `inputFocusWithin`, and types `UseFocusableGroupOptions`, `UseFocusableGroupResult`, `UseGridNavigationOptions`, `UseGridNavigationResult`, `GridNavigationHandlers`. `useRovingGrid` stays internal.

- [ ] **Step 1:** Failing tests: barrel test names above; `verify-dist` probe cases: an import of only `useFocusVisible`, only `useFocusableGroup`, only the finders pulls no component, no floating-ui; an import of only `usePopupPosition` pulls floating-ui and no component; the pack-smoke Tailwind and plain fixtures contain the `focusRing` classes in their CSS output.
- [ ] **Step 2:** Run the barrel tests; expect FAIL.
- [ ] **Step 3:** Add the exports and the probes; empty `PENDING_FLAT_EXPORTS`/`PENDING_PUBLIC_TYPES` of any Phase 7 entries.
- [ ] **Step 4:** Run `npm run build` then `node scripts/verify-dist.mjs --final` and `npm run test:pack`; expect exit 0.
- [ ] **Step 5:** Commit: `feat: export the focus utilities; dist probes for the new hooks`.

---

### Task 14: Documentation

**Files:** Modify `README.md` ("Hooks and utilities", a note that the hooks are stable pre-1.0 per D4), `docs/WAVE-UI-GUIDE.md` (new chapter "Custom overlays"; focus chapter lists the new hooks and `useActiveDescendant`), `CHANGELOG.md`, `docs/ROADMAP.md` (Phase 7 status, status header line), `CLAUDE.md` (hooks list: the newly public hooks; the 0.12 design doc reference).

**Interfaces:** none.

- [ ] **Step 1:** CHANGELOG `## [0.12.0] - Unreleased`: Added (each hook, `positioning`, `modalAllowProps`, `useModalOpen`, grid orientation), Changed (`target` accepts the other forms), nothing removed.
- [ ] **Step 2:** Guide chapter: command palette over a Dialog and under a Toaster, an app-owned region with `modalAllowProps`, a custom popup; code taken from the Task 9 story.
- [ ] **Step 3:** Update the README and CLAUDE.md lists; ROADMAP marks Phase 7 "implemented".
- [ ] **Step 4:** `npm run format:check` and `npm run lint`; expect clean.
- [ ] **Step 5:** Commit: `docs: CHANGELOG, README, guide, roadmap and CLAUDE.md for 0.12`.

---

### Task 15: Gate and browser check

**Files:** none.

- [ ] **Step 1:** Run `/gate`; expect all criteria pass. Fix and re-run on failure.
- [ ] **Step 2:** Run `/browser-check` on the spec §6 items 1–4 in Storybook; record results in the PR description.
- [ ] **Step 3:** Open the PR from `feat/fluent-parity-phase-7` (title `feat: Phase 7 (0.12.0): overlay and focus primitives made public`); no attribution trailer in commits.
- [ ] **Step 4 (optional, outside this repo):** bump taskboard to the packed tarball, replace its hand-written attribute with `modalAllowProps` and its `[inert]` query with `useModalOpen`, run its `npm run check`.
