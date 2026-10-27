# Phase 10 (0.15.0) Implementation Plan: motion on components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a default enter and exit motion, replaceable per part (`motion`, `backdropMotion`, `expandIconMotion`, `indeterminateMotion`) and switchable off per app (`WaveProvider motion="none"`), on every overlay and disclosure in scope, and close the twelve gap ids of P10-01 and P10-02.

**Architecture:** Every motion is a literal Tailwind class string in one internal, server-safe module (`src/lib/motion.ts`) keyed on the presence core's `data-presence` phases; a part resolves its classes with `useMotionClasses(slot, recipe, legacyClassName?)` against the provider's `MotionPreference`. Popover, Tooltip, TeachingPopover, Accordion, Tree and Nav move onto `usePresence`; the disclosures collapse through a grid wrapper that is `display: contents` while entered; positioned popups move focus out in the closing commit through a shared `useFocusBeforeClose`. Gates keep motion in that one module (conventions rules, `motion.test.ts`) and out of the Button-only bundle (verify-dist).

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (literal classes; `@tailwindcss/node` in one test), Vitest + React Testing Library + vitest-axe, Vite library build.

**Spec:** `docs/superpowers/specs/2026-10-27-fluent-parity-phase-10-design.md` (rulings D1–D23, §2–§17, Appendix A). Read it and `CLAUDE.md` first; the spec wins where this plan is silent. Work in `.claude/worktrees/fluent-parity-phase-10` (branch `feat/fluent-parity-phase-10`); the `node_modules` junction exists. Run every command in the foreground; do not wait on background monitors. IDE diagnostics about missing jest-dom matchers are stale noise.

## Global Constraints

- Version 0.15.0; CHANGELOG section `## [0.15.0] - Unreleased` above `## [0.14.1]`.
- D2: "Nothing public is removed and every type only widens. With no `motion` prop every surface in scope animates." Existing suites stay green unedited except assertions that walk across a new wrapper element, read a changed class list or the extended `backdrop-ignored` text (spec §13 items 4, 5, 7); every such edit is listed in spec §12 by the task that makes it.
- D3: "Enumerated `data-*` always rendered; one stable class per new element a consumer may target; literal Tailwind class strings only; `motion-reduce:` on every transition and animation; warnings from effects through `warnOnce`."
- D4: "Motion is Tailwind class strings keyed on `data-presence`: the enter's start as `data-[presence=entering]:starting:…`, the exit as `data-[presence=exiting]:…`, timing with `duration-wave-*` and `ease-wave-*`, movement with the individual `translate-*`/`scale-*` properties. No WAAPI, no new keyframes, no runtime styles", except TabList's FLIP custom properties and Carousel's inline `transition-duration`. "**Positioned surfaces never transition `transform`** … never use the bare `transition`, `transition-all` or `transition-transform`."
- §2.2 literal rule: "Every recipe is one string literal per value: no concatenation, template or `cn()` inside the module (components compose at run time)." `src/lib/motion.ts` imports nothing at run time (types only), and its JSDoc "describes each recipe in words … and never writes a class". `data-[presence=…]` classes live only in `src/lib/motion.ts` (the `presence-class` gate rule, Task 1b).
- D5 slot rule: `type MotionSlot = string | { className: string }`; on a part's prop typed `MotionSlot | null`, "`undefined` is the default motion; `null` is no motion (the element still goes through the presence core and every phase ends at once); a value **replaces** the default motion classes with the consumer's." Prop names: `motion`, `backdropMotion`, `expandIconMotion`, `indeterminateMotion`; each JSDoc names the Fluent prop it stands for.
- D6: "`'none'` makes every motion slot below it behave as `null`, and turns off the other motion this phase adds (Nav item actions' reveal); a part's own `motion` value wins over the provider." Nested providers inherit an omitted `motion`.
- §2.3 composition: "A part destructures its motion props so they never reach the DOM, and composes `cn(<stable class>, <base>, <motion classes>, className)`".
- D7: the exiting element is `inert`; "dismiss layers, trap, isolation, scroll lock, positioning and focus restore key on `open`; focus leaves a closing surface in the closing commit." §2.4's five-point surface contract applies to every presence surface of this phase.
- D8: a phase ends at once under `prefers-reduced-motion: reduce`; no component adds media-query logic beyond `motion-reduce:` (TabList reads the internal `usePrefersReducedMotion` only to skip its FLIP).
- D9: Dialog, overlay Drawer and NavDrawer, Menu, Popover, Tooltip, InfoButton and TeachingPopover mount with `appear: true`; in-flow content (inline drawers, Accordion, Tree, Nav, MessageBarGroup bars present at mount) never animates on mount. Toasts keep `appear: true`.
- D19 (Menu.Popover, Dialog.Content, Drawer, NavDrawer only): "a `className` that contains `[presence=` while `motion` is `undefined` turns the default motion off".
- C-CLASS: new class-name keys land in `src/lib/classNames.ts` in the same change as the element, with role-only JSDoc (registry bare-word rule). C-DOCS: every motion prop's JSDoc says what it replaces in words with §3's numbers, the slot rule, the Fluent prop, and `@default` in words; no complete Tailwind utility name in any comment or string of `src/components` or `src/lib` (build-css fails). Component JSDoc that says "no motion ships" is rewritten by the task that adds the motion.
- C-HOOKS: no new `eslint-disable`. C-DEV: warnings through `warnOnce` from effects, keys dotted.
- Each task ends with its focused tests run with `--reporter=default` (no act() warnings, no unasserted `[WaveUI]` warnings), `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, `npm run format:check` and the conventions gate for its files (`npx vitest run src/__tests__/conventions.test.ts -t "<path>"`). Departures from the spec go into spec §12 with their reason.
- Commits: conventional subjects, **no attribution trailer**; the controller commits once per task.

## Review Focus

1. **Reopened during its exit:** a Dialog, Drawer, Menu or Popover closed and opened again before its exit ends must be the same element, `entering`, not `inert`, with its layer, trap and focus active again — not a second surface or a dead one. Pinned in Tasks 2 and 6.
2. **StrictMode with a surface open at mount and focus inside it:** the simulated unmount must not move focus out (the focus-before-close cleanup is skipped on unmount), and a later close moves it exactly once. Pinned in Task 5 (hook test).
3. **Rapid toggle of a collapse:** an Accordion panel (and so Tree and Nav, which share the hook) closed and reopened before its exit ends must keep its element and the state inside it (typed text), drop `inert` and read `data-state="open"`. Pinned in Task 10.
4. **Keyed reorders in MessageBarGroup:** reordering bars, alone or together with a removal, must move the same DOM nodes without a remount or an exit, and keep the exiting bar next to its old neighbour. Pinned in Task 14.
5. **TabList selection changed twice within one frame, or unmounted with a frame pending:** only the latest FLIP pair is written, the earlier frame is cancelled, and nothing sets state after unmount. Pinned in Task 16.

---

## File structure

| File | Change |
|---|---|
| `src/lib/types.ts`, `src/lib/motion.ts` (new), `src/hooks/useMotion.ts` (new), `WaveProvider.tsx`, `src/test-utils.ts` | slot and preference types, recipes and resolver, the motion hooks, the provider prop, `motionClasses` |
| `src/__tests__/conventions.test.ts`, `scripts/claude/hooks.mjs`, `src/lib/__tests__/motion.test.ts` (new), `scripts/verify-dist.mjs`, `scripts/build-css.mjs` | gate rules, recipe checks, dist probes, required utilities |
| `src/hooks/useFocusBeforeClose.ts`, `useCollapsePresence.ts`, `usePresenceGroup.ts` (all new, internal) | focus out of a closing popup; the disclosure collapse; the keyed group |
| `Dialog.tsx`, `Dialog.slots.tsx`, `Drawer.panel.tsx`, `Drawer.root.tsx`, `NavDrawer.tsx`, `Menu.popover.tsx`, `Popover.tsx`, `InfoButton.tsx`, `InfoLabel.tsx`, `Tooltip.tsx`, `TeachingPopover.parts.tsx`, `.root.tsx`, `Accordion.tsx`, `Tree.core.tsx`, `Tree.context.ts`, `Nav.tsx`, `Toaster.tsx`, `MessageBarGroup.tsx` (new), `Carousel.tsx`, `TabList.tsx`, `ProgressBar.tsx` | the surfaces |
| `src/lib/classNames.ts`, barrels, `src/__tests__/*` | keys, exports, integration |
| `stories/*`, `README.md`, `CHANGELOG.md`, `docs/*`, `CLAUDE.md` | stories and docs |

## Recipe strings (`src/lib/motion.ts`)

Exact values from spec §3, each added by the task named in its comment. Every value is one literal on one line (the allow markers cover a line). `DrawerEdge` is a module-local `'start' | 'end' | 'left' | 'right' | 'bottom'`; `SurfaceSize` comes from `./types`.

```ts
// Task 2 — Dialog
dialogMotion = 'transition-[opacity,scale] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:scale-85 data-[presence=exiting]:opacity-0 data-[presence=exiting]:scale-85'
dialogBackdropMotion = 'transition-opacity duration-wave-gentle ease-wave-easy-ease data-[presence=exiting]:duration-wave-normal motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0'

// Task 3 — overlay drawers. drawerMotion[edge] (durations come from drawerDurations[size]):
//   base for every edge: 'transition-[opacity,translate] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0'
//   start  + 'data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full wave-rtl:data-[presence=entering]:starting:translate-x-full wave-rtl:data-[presence=exiting]:translate-x-full'
//   end    + the same with the signs swapped (translate-x-full, wave-rtl: -translate-x-full)
//   left   + 'data-[presence=entering]:starting:-translate-x-full data-[presence=exiting]:-translate-x-full'   // wave-allow-physical: left and right drawers do not mirror
//   right  + 'data-[presence=entering]:starting:translate-x-full data-[presence=exiting]:translate-x-full'     // wave-allow-physical: left and right drawers do not mirror
//   bottom + 'data-[presence=entering]:starting:translate-y-full data-[presence=exiting]:translate-y-full'
// (each record value is written out as one literal: base + its edge part)
drawerDurations = { small: 'duration-wave-gentle', medium: 'duration-wave-slow', large: 'duration-wave-slower', full: 'duration-wave-ultra-slow' }
drawerBackdropMotion[size] = 'transition-opacity <drawerDurations[size]> ease-wave-linear motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0'  (written out per size)

// Task 4 — inline drawers
inlineDrawerStructure = {
  start:  'grid shrink-0 grid-cols-[minmax(0,1fr)] justify-items-end overflow-hidden data-[presence=entered]:contents',
  end:    'grid shrink-0 grid-cols-[minmax(0,1fr)] justify-items-start overflow-hidden data-[presence=entered]:contents',
  left:   'grid shrink-0 grid-cols-[minmax(0,1fr)] [justify-items:right] overflow-hidden data-[presence=entered]:contents', // wave-allow-physical: the consumer asked for the physical left edge
  right:  'grid shrink-0 grid-cols-[minmax(0,1fr)] [justify-items:left] overflow-hidden data-[presence=entered]:contents', // wave-allow-physical: the consumer asked for the physical right edge
  bottom: 'grid shrink-0 grid-rows-[minmax(0,1fr)] items-start overflow-hidden data-[presence=entered]:contents',
}
inlineDrawerMotion = {
  width:  'transition-[grid-template-columns,opacity] ease-wave-decelerate-mid data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:grid-cols-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-cols-[minmax(0,0fr)] data-[presence=exiting]:opacity-0',
  height: the same with grid-template-rows and grid-rows-[minmax(0,0fr)],
}

// Task 5 — positioned popups (one line)  // wave-allow-physical: data-side is the resolved physical side
popupMotion = 'transition-[opacity,translate] duration-wave-normal ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-faster data-[presence=exiting]:ease-wave-accelerate-min motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0 data-[side=top]:data-[presence=entering]:starting:translate-y-1 data-[side=top]:data-[presence=exiting]:translate-y-1 data-[side=bottom]:data-[presence=entering]:starting:-translate-y-1 data-[side=bottom]:data-[presence=exiting]:-translate-y-1 data-[side=left]:data-[presence=entering]:starting:translate-x-1 data-[side=left]:data-[presence=exiting]:translate-x-1 data-[side=right]:data-[presence=entering]:starting:-translate-x-1 data-[side=right]:data-[presence=exiting]:-translate-x-1'

// Task 8 — Tooltip
tooltipMotion = 'transition-opacity duration-wave-faster ease-wave-easy-ease motion-reduce:transition-none data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:opacity-0'

// Task 10 — collapse (spec §2.5, verbatim)
collapseStructure = 'grid grid-rows-[minmax(0,1fr)] overflow-hidden data-[presence=entered]:contents'
collapseMotion = 'transition-[grid-template-rows,opacity] duration-wave-normal ease-wave-easy-ease-max motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:opacity-0 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:opacity-0'

// Task 12 — Nav
expandIconMotion = 'transition-transform duration-wave-fast ease-wave-easy-ease motion-reduce:transition-none'
navActionsRevealMotion = '*:transition *:duration-wave-fast *:ease-wave-easy-ease motion-reduce:*:transition-none'

// Task 13 — toasts
toastStructure = 'grid grid-rows-[minmax(0,1fr)] not-data-[presence=entered]:overflow-hidden'
toastMotion.bottom = 'transition-[grid-template-rows,margin-bottom,opacity,translate] duration-wave-gentle ease-wave-decelerate-mid data-[presence=exiting]:duration-wave-normal data-[presence=exiting]:ease-wave-easy-ease data-[presence=exiting]:[transition-delay:var(--wave-duration-normal),var(--wave-duration-normal),0s,0s] motion-reduce:transition-none data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0 data-[presence=entering]:starting:translate-y-2 data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0'
toastMotion.top = the same with -translate-y-2   (the delay list follows the transition-property order: rows and margin wait one normal duration, opacity and translate none)

// Task 14 — MessageBarGroup
messageBarGroupItemStructure = 'grid grid-rows-[minmax(0,1fr)] items-end overflow-hidden data-[presence=entered]:contents'
messageBarGroupExitMotion = 'transition-[grid-template-rows,margin-bottom,opacity] duration-wave-gentle ease-wave-linear motion-reduce:transition-none data-[presence=exiting]:grid-rows-[minmax(0,0fr)] data-[presence=exiting]:-mb-2 data-[presence=exiting]:opacity-0'
messageBarGroupEnterMotion = 'data-[presence=entering]:starting:grid-rows-[minmax(0,0fr)] data-[presence=entering]:starting:-mb-2 data-[presence=entering]:starting:opacity-0'

// Task 15 — Carousel
carouselSlideMotion = 'transition-transform duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none'
carouselFadeMotion = 'transition-opacity duration-wave-slow ease-wave-easy-ease motion-reduce:transition-none'

// Task 16 — TabList
tabIndicatorMotion = 'after:transition-[translate,scale] after:duration-wave-slow after:ease-wave-decelerate-max motion-reduce:after:transition-none'

// Task 17 — ProgressBar (0.14's list, verbatim)
progressIndeterminateMotion = 'w-2/5 animate-wave-indeterminate wave-rtl:animate-wave-indeterminate-rtl motion-reduce:w-full motion-reduce:translate-x-0 motion-reduce:animate-wave-pulse wave-rtl:motion-reduce:animate-wave-pulse'
```

## Test vocabulary (D17; every task uses these names)

- **Slot table** for a prop and its default recipe `R`, on the element the recipe animates: `undefined` → `expect(el).toHaveClass(...motionClasses(R))`; `null` → no word of `motionClasses(R)` on the element and `data-presence` still rendered; `'my-motion'` and `{ className: 'my-motion' }` → `my-motion` and no word of `R`; `renderWithProviders(ui, { motion: 'none' })` → no word of `R`, and with the part's own `motion="my-motion"` → `my-motion`. (`my-motion` is a test class; tests are not CSS sources.)
- **Presence pair:** with `mockAnimations({ animated })` targeting the presence element, a close keeps the element, `data-presence="exiting"`, `inert` (on it or its presence ancestor), out of the accessibility tree, with layers/trap/focus already released; `await act(async () => { await motion.finishAll(); })` removes it. With `mockMatchMedia({ '(prefers-reduced-motion: reduce)': true })` added, the same close removes it within the same `act`.

---

### Task 1a: Foundation runtime — types, resolver, motion hooks, provider, test helpers (P10-F, §2.1–§2.3, §2.12)

**Files:** Modify `src/lib/types.ts`, `src/components/provider/WaveProvider.tsx`, `src/test-utils.ts`; Create `src/lib/motion.ts`, `src/hooks/useMotion.ts`; Test `src/lib/__tests__/motion.test.ts` (create, first line `// @vitest-environment node`), `src/lib/__tests__/types.test.ts`, `src/hooks/__tests__/useMotion.test.tsx` (create), `src/components/provider/__tests__/WaveProvider.test.tsx`, `src/__tests__/test-utils.test.tsx`.

**Interfaces:**
- Produces (every later task uses these names):

```ts
// src/lib/types.ts — JSDoc verbatim from spec §2.1
export type MotionSlot = string | { className: string };
export type MotionPreference = 'default' | 'none';
// src/lib/motion.ts (internal, server-safe; recipe constants are added by later tasks)
/** Whether a part keeps 0.14's own motion (D19): no slot and a className holding `[presence=`. */
export function usesLegacyMotion(slot: MotionSlot | null | undefined, legacyClassName?: string): boolean;
export function resolveMotion(slot: MotionSlot | null | undefined, recipe: string,
  preference: MotionPreference, legacyClassName?: string): string;
// src/hooks/useMotion.ts (internal)
export function useMotionPreference(): MotionPreference;          // useWaveTheme().motion
export function useMotionClasses(slot: MotionSlot | null | undefined, recipe: string,
  legacyClassName?: string): string;                                // resolveMotion(…, useMotionPreference(), …)
// WaveProvider
WaveProviderProps.motion?: MotionPreference;   // @default the enclosing provider's, else 'default'
WaveContextValue.motion: MotionPreference;     // DEFAULT_CONTEXT.motion = 'default'
// src/test-utils.ts
export function motionClasses(recipe: string): string[];          // split on whitespace, empty words dropped
RenderWithProvidersOptions.motion?: MotionPreference;             // passed to the WaveProvider
```

- [ ] **Step 1: Failing tests.**
  - `motion.test.ts` "resolveMotion": `(null, 'r', 'default')` → `''`; `('a b', 'r', 'none')` → `'a b'`; `({ className: 'a' }, 'r', 'default')` → `'a'`; `('', 'r', 'default')` → `''`; `(undefined, 'r', 'none')` → `''`; `(undefined, 'r', 'default', 'p-4 data-[presence=exiting]:opacity-0')` → `''`; `(undefined, 'r', 'default', 'p-4')` → `'r'`; `('x', 'r', 'default', 'data-[presence=exiting]:opacity-0')` → `'x'`. "usesLegacyMotion": true only for `undefined` with a `[presence=` className.
  - `types.test.ts`: `expectTypeOf<'x'>().toExtend<MotionSlot>()`, `{ className: 'x' }` extends it; `// @ts-expect-error` on assigning `{}` to `MotionSlot` and `'reduced'` to `MotionPreference`.
  - `useMotion.test.tsx`: `'default'` outside a provider; `'none'` under `<WaveProvider motion="none">`; a nested provider without `motion` inherits `'none'`; a nested `motion="default"` re-enables; `useMotionClasses(undefined, 'r')` → `'r'` and `''` under `'none'`; own value wins under `'none'`.
  - `WaveProvider.test.tsx`: `useWaveTheme().motion` is `'default'` without a provider and with one; the context object keeps its identity across a re-render with equal props; `motion` never reaches the root element's attributes.
  - `test-utils.test.tsx`: `motionClasses('  a  b ')` → `['a', 'b']`, `motionClasses('')` → `[]`; `renderWithProviders(ui, { motion: 'none' })` makes `useMotionPreference()` read `'none'`.
- [ ] **Step 2:** Run `npx vitest run src/lib/__tests__/motion.test.ts src/lib/__tests__/types.test.ts src/hooks/__tests__/useMotion.test.tsx src/components/provider src/__tests__/test-utils.test.tsx --reporter=default`; expect FAIL on the new cases only.
- [ ] **Step 3: Implement.** Types with spec §2.1's JSDoc (ellipsis forms only); `src/lib/motion.ts` with a module JSDoc in words and the two functions (order of §2.2: `null` → `''`; a value → its classes; `'none'` → `''`; legacy → `''`; else `recipe`); `useMotion.ts`; WaveProvider resolves `motion = motionProp ?? parent.motion`, adds it to the memoised value and its deps, and documents it (Fluent's `MotionBehaviourProvider` `'skip'`, not exported by `@fluentui/react-components`; inherited like `theme`); the two test-utils additions with JSDoc.
- [ ] **Step 4:** Run the Step 2 command, `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, the conventions gate for `src/components/provider/WaveProvider.tsx`, `npx vitest run src/__tests__/public-types.test.ts` (`MotionSlot`/`MotionPreference` reach the entry through `export type * from './lib/types'`); expect PASS.
- [ ] **Step 5: Commit** `feat(lib): motion slot types, the motion resolver and WaveProvider motion`.

### Task 1b: Foundation gates and probe machinery (P10-F, §2.8–§2.10)

**Files:** Modify `src/__tests__/conventions.test.ts`, `scripts/claude/hooks.mjs`, `scripts/__tests__/claude-hooks.test.mjs`, `src/lib/__tests__/motion.test.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, `package.json` + `package-lock.json` (devDependency).

**Interfaces:**
- Consumes Task 1a (`src/lib/motion.ts` exists).
- Produces: gate rule ids `presence-class` and `starting-gate`; a source kind `'recipe'` (every component rule except `class-names`) applied to `src/lib/motion.ts` in a describe `conventions gate: src/lib/motion.ts` whose test is named `src/lib/motion.ts`; `isConventionsTarget('src/lib/motion.ts') === true`. In `motion.test.ts`, helpers later tasks extend: `recipeEntries()` (every string or record-of-string export as `[name, value]`; functions skipped; any other kind fails check 7), `COMPOSED_DURATIONS: Record<string, string>` (recipe name → the record its durations come from; empty until Task 3). In verify-dist:

```js
export const MOTION_RECIPE_MIN = 0; // Task 2 sets 2, Task 18 the release count
/** Every string value of dist/lib/motion.mjs's exports (one level into records), imported by file URL. */
export async function motionRecipeLiterals(dist, { min = MOTION_RECIPE_MIN } = {}) // → { literals: string[], errors: string[] }
// probeTreeShaking(dist, { …existing, dropSubstrings = [] }) and probeIncludes(dist, { keep, modules, strings = [], substrings = [] })
```

- [ ] **Step 1: Failing tests.**
  - Conventions fixtures: `presence-class` flags `cn('data-[presence=exiting]:opacity-0')`, `'not-data-[presence=entered]:overflow-hidden'` and `'group-data-[presence=exiting]/row:hidden'` in a component source, and none in kind `'recipe'`; `starting-gate` flags `'starting:opacity-0'` and `'data-[presence=exiting]:starting:opacity-0'`, passes `'data-[presence=entering]:starting:opacity-0'` and `'data-[side=top]:data-[presence=entering]:starting:translate-y-1'`; kind `'recipe'` runs `motion` and `translate-x` (a `translate-x-1` line without marker is flagged) but not `class-names`; the motion.ts source list is found and non-empty.
  - `claude-hooks.test.mjs`: `isConventionsTarget('src/lib/motion.ts')` true, `src/lib/cn.ts` false.
  - `motion.test.ts` (each check as a pure helper with a failing fixture string, then applied to `recipeEntries()`): (1) every word compiles — `'duration-wave-gentel'` reported; (2) a value with a transition word has a `duration-wave-*` and an `ease-wave-*` utility (variants stripped), recipes in `COMPOSED_DURATIONS` checked per `value + ' ' + durations[size]` — `'transition-opacity motion-reduce:transition-none'` reported; (3) a transition word needs a `motion-reduce:`-variant `transition-none`, an `animate-*` word a `motion-reduce:`-variant `animate-*` — `'transition-opacity duration-wave-fast ease-wave-easy-ease'` reported; (4) every word with the `starting` variant has `data-[presence=entering]` — `'starting:opacity-0'` reported; (7) a number export reported.
  - `verify-dist.test.mjs` on fixture dists: a recipe literal of `lib/motion.mjs` inside the Button-only bundle is reported; a `[presence=` string in the bundle is reported through `dropSubstrings` and the same text in a comment is not; `motionRecipeLiterals` reports fewer than `min` literals and a value with none of the markers; `probeIncludes` with `strings`/`substrings` reports a missing literal and a missing fragment.
- [ ] **Step 2:** Run `npx vitest run src/__tests__/conventions.test.ts src/lib/__tests__/motion.test.ts scripts/__tests__/verify-dist.test.mjs scripts/__tests__/claude-hooks.test.mjs --reporter=default`; expect FAIL on the new cases only.
- [ ] **Step 3: Implement.**
  - `npm install --save-dev --package-lock-only @tailwindcss/node@^4.3.3` (it is only a hoisted dependency of `@tailwindcss/cli` today; `--package-lock-only` leaves the shared `node_modules` alone).
  - The compile check: `__unstable__loadDesignSystem(css, { base: repoRoot })` from `@tailwindcss/node` with `css` = `@import 'tailwindcss/theme.css' theme(inline); @import './src/styles/tokens.css'; @import './src/styles/variants.css'; @import 'tailwindcss/utilities.css';` (as build-css builds), then `designSystem.candidatesToCss(words)`: a `null` is a word that yields no rule.
  - Gate: extend `RuleId`, `HINTS`, the header doc and `scanSource` (classes from `classTokens`; a variant containing `[presence=`; a `starting` variant without `data-[presence=entering]`); glob `'../lib/motion.ts'` raw.
  - verify-dist: recipe markers are `[presence=`, `transition`, `animate-` and `duration-wave-` (the last because `drawerDurations` values hold none of the other three; the spec lists three, so this awaits the controller's ruling); `dropSubstrings` bundles the same entry again with `bundleImport(distRoot, [keep], { minify: true })` (comments dropped, strings kept) and reports each fragment the code contains; `probeIncludes` `strings` match quoted literals in the plain bundle, `substrings` the minified one. **Do not wire the real dist yet:** `lib/motion.mjs` and `hooks/useMotion.mjs` are emitted only once a component imports them (Task 2), and the non-vacuity rule would fail `npm run build`.
- [ ] **Step 4:** Run the Step 2 command, `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`; expect PASS.
- [ ] **Step 5: Commit** `test: motion gate rules, recipe checks and dist motion probes`.

### Task 2: Dialog surface and backdrop (P10-DLG, §4.1, risks 7 and 8, D16, positive probe)

**Files:** Modify `src/lib/motion.ts`, `src/components/overlays/Dialog.tsx`, `Dialog.slots.tsx`, `src/lib/__tests__/motion.test.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, `scripts/build-css.mjs`, `src/styles/__tests__/tokens.test.ts`; Test create `src/components/overlays/__tests__/Dialog.motion.test.tsx`.

**Interfaces:**
- Consumes Task 1a (`useMotionClasses`, `motionClasses`), Task 1b (`motionRecipeLiterals`, `dropSubstrings`, `probeIncludes` options).
- Produces `dialogMotion`, `dialogBackdropMotion`; `DialogContentProps.motion?: MotionSlot | null` (Fluent's `Dialog surfaceMotion`), `backdropMotion?: MotionSlot | null` (Fluent's `DialogSurface backdropMotion`; JSDoc: a replacement longer than the surface's motion is cut off when the surface unmounts, D16); `ModalBackdropProps.motionClassName?: string` (after the base classes, before the slot's `className`) — Task 3 uses it; `useBackdropAppearance` holds its last open value while closed.

- [ ] **Step 1: Failing tests** (`Dialog.motion.test.tsx`; presence element `(el) => el.getAttribute('role') === 'dialog'`):
  - Slot table for `motion` on the surface (`dialogMotion`) and `backdropMotion` on the element with `dialogContentClassNames.backdrop` (`dialogBackdropMotion`).
  - D19: `className="p-8 data-[presence=exiting]:opacity-0"` → no `dialogMotion` word, both consumer classes kept; plus `motion="my-motion"` → `my-motion` applies.
  - `modalType="non-modal"` with `backdropMotion` → the `Dialog.Content:backdrop-ignored` warning, asserted exactly and nothing else logged; its new text: ``Dialog.Content: `backdrop` and `backdropMotion` are ignored with `modalType="non-modal"`: a non-modal dialog has no backdrop, so the page behind it stays usable.`` (the existing assertion of the old text is updated and listed in spec §12).
  - Presence pair after Escape: surface still mounted, positioner `inert`, `screen.queryByRole('dialog')` null and `getByRole('dialog', { hidden: true })` found, `hasOpenModal()` false, no scroll-lock inline style on `<html>`/`<body>`, trigger focused before `finishAll`; reduced motion removes it at once.
  - `defaultOpen` on a client render → `data-presence="entering"`, `entered` after `finishAll`.
  - Stacked dialogs: closing the upper one keeps its backdrop `data-appearance="transparent"` while exiting (risk 7).
  - With `installResizeObserverMock`, title area 40px → `--wave-dialog-title-end-padding: 48px`; still `48px` while exiting (risk 8).
  - `<StrictMode>`: `onOpenChange` once on an Escape close.
  - **Review Focus 1:** Escape, then the trigger again before `finishAll`: `getByRole('dialog')` is the same node, `entering`, positioner not `inert`, `hasOpenModal()` true, focus inside the dialog.
  - `unmountOnClose={false}`: exits, then `hidden` after `finishAll`.
  - `motion.test.ts` check 6: `dialogBackdropMotion`'s exit duration class equals `dialogMotion`'s (the `data-[presence=exiting]:duration-*` word, else the plain one).
- [ ] **Step 2:** Run `npx vitest run src/components/overlays/__tests__/Dialog src/lib/__tests__/motion.test.ts --reporter=default`; FAIL on new cases.
- [ ] **Step 3: Implement.** Recipes; `usePresence(open, { appear: true, unmountOnExit: unmountOnClose })`; surface `cn(dialogContentClassNames.root, base, sizeClasses[size], useMotionClasses(motion, dialogMotion, className), className)`; `ModalBackdrop motionClassName={useMotionClasses(backdropMotion, dialogBackdropMotion)}`; `backdropIgnored` also when `backdropMotion !== undefined`, message names `backdropMotion`; `useBackdropAppearance` returns a previous-value state updated only while `open`; `useTitleActionsWidth(open || exiting ? titleActionsArea : null)` with `exiting = presenceProps['data-presence'] === 'exiting'`; rewrite the Dialog.Content JSDoc's motion paragraph (default motion in words, slots, D7's click-through and scroll-lock consequences).
- [ ] **Step 4: Wire the dist probes and run the build.** verify-dist: `MOTION_RECIPE_MIN = 2`; the Button/Presence probe gets `dropModules: [PRESENCE_MODULE, 'lib/motion.mjs', 'hooks/useMotion.mjs']`, `dropStrings: (await motionRecipeLiterals(distRoot)).literals` (its errors pushed) and `dropSubstrings: ['[presence=']`; a positive control `probeIncludes(distRoot, { keep: 'Dialog', modules: ['lib/motion.mjs', 'hooks/useMotion.mjs'], strings: [the two Dialog literals, read from the module], substrings: ['[presence='] })`. The test fixture dist gains a `lib/motion.mjs` with `Math.max(MOTION_RECIPE_MIN, 2)` generated recipe literals and a `hooks/useMotion.mjs`, imported by the fixture Dialog, so the end-to-end fixture cases stay green when Task 18 raises the minimum. build-css: `REQUIRED_UTILITIES` gains `duration-wave-gentle` and `data-[presence=exiting]:opacity-0` (and the end-to-end fixture sources in `tokens.test.ts` gain them). Run `npm run build`, `npx vitest run scripts/__tests__/verify-dist.test.mjs src/styles/__tests__/tokens.test.ts`, the Step 2 command, the gate for `Dialog.tsx`, `Dialog.slots.tsx`, `src/lib/motion.ts`, tsc, lint; expect PASS.
- [ ] **Step 5: Commit** `feat(overlays): Dialog surface and backdrop motion`.

### Task 3: Overlay Drawer and NavDrawer (P10-DRW-O, §4.2)

**Files:** Modify `src/lib/motion.ts`, `src/lib/__tests__/motion.test.ts`, `src/components/overlays/Drawer.panel.tsx`, `Drawer.root.tsx`, `src/components/navigation/NavDrawer.tsx`; Test create `src/components/overlays/__tests__/Drawer.motion.test.tsx`, `src/components/navigation/__tests__/NavDrawer.motion.test.tsx`.

**Interfaces:**
- Consumes Task 2 (`ModalBackdrop motionClassName`, the held backdrop appearance).
- Produces `drawerMotion`, `drawerDurations`, `drawerBackdropMotion`; `DrawerPanelProps.motion?`, `backdropMotion?` (`MotionSlot | null`; the D108 contract extended); `DrawerProps`/`NavDrawerProps` `motion?`, `backdropMotion?` (Fluent's `OverlayDrawer surfaceMotion`/`backdropMotion`), passed to `DrawerPanel`.

- [ ] **Step 1: Failing tests:** `it.each` over the five positions × four sizes: the overlay panel has `motionClasses(drawerMotion[position])` and `drawerDurations[size]`, the backdrop `motionClasses(drawerBackdropMotion[size])`; the same class lists under `{ dir: 'rtl' }`; slot tables for `motion` and `backdropMotion`; D19 with the Drawer's and the NavDrawer's `className`; presence pair (presence element `role="dialog"`): `inert`, `hasOpenModal()` false, trigger focused before `finishAll`; reduced motion; `defaultOpen` client render `entering`; `unmountOnClose={false}` exits then `hidden`; non-modal or inline with `backdropMotion` → the `<componentName>:backdrop-ignored` warning with the new text ``Drawer: `backdrop` and `backdropMotion` are ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.`` (`NavDrawer:` for NavDrawer; asserted exactly; the old assertions are updated and listed in spec §12); NavDrawer without `size` uses `drawerDurations.small`. `motion.test.ts`: `COMPOSED_DURATIONS.drawerMotion = 'drawerDurations'`; check 6 per size (`drawerBackdropMotion[size]`'s duration word equals `drawerDurations[size]`).
- [ ] **Step 2:** Run `npx vitest run src/components/overlays/__tests__/Drawer src/components/navigation/__tests__/NavDrawer src/lib/__tests__/motion.test.ts --reporter=default`; FAIL on new cases.
- [ ] **Step 3: Implement.** Overlay `usePresence(open, { appear: overlay, unmountOnExit: unmountOnClose })`; panel `cn(rootClassName, OVERLAY_PANEL_CLASSES, getOverlayPanelClasses(position, size), useMotionClasses(motion, `${drawerMotion[position]} ${drawerDurations[size]}`, className), className)`; backdrop `motionClassName` from `drawerBackdropMotion[size]`; `backdropIgnored` also for `backdropMotion`; JSDoc of Drawer and NavDrawer (sizes' durations in words).
- [ ] **Step 4:** Step 2 command, gate for the three component files and `src/lib/motion.ts`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(overlays): overlay drawers slide from their edge`.

### Task 4: Inline Drawer and NavDrawer collapse (P10-DRW-I, §4.3, D13)

**Files:** Modify `src/lib/motion.ts`, `src/lib/__tests__/motion.test.ts`, `src/lib/classNames.ts` (`drawerClassNames.collapse: 'wave-drawer__collapse'`, `navDrawerClassNames.collapse: 'wave-nav-drawer__collapse'`, JSDoc by role), `Drawer.panel.tsx`, `Drawer.root.tsx`, `NavDrawer.tsx`; Test create `src/components/overlays/__tests__/Drawer.inline.motion.test.tsx`, extend `NavDrawer.motion.test.tsx`.

**Interfaces:**
- Consumes Task 3 (`drawerDurations`, the panel's motion props), Task 1a (`usesLegacyMotion`).
- Produces `inlineDrawerStructure`, `inlineDrawerMotion`; `DrawerPanelProps.collapseClassName: string` (Drawer passes `drawerClassNames.collapse`, NavDrawer `cn(drawerClassNames.collapse, navDrawerClassNames.collapse)`).

- [ ] **Step 1: Failing tests:** per position, the element with `drawerClassNames.collapse` has `motionClasses(inlineDrawerStructure[position])`, `inlineDrawerMotion[axis]` and `drawerDurations[size]` (axis `height` at `bottom`), and its only child is the `<aside>` with the consumer's `id`, `className`, `ref` and `data-type="inline"`; `size="full"` has the structure and no `inlineDrawerMotion` word; kept mounted and closed: wrapper and aside both `hidden`; D19 legacy (`className` with `data-[presence=exiting]:…`): no motion words on the wrapper, and `mockAnimations({ animated: (el) => el.tagName === 'ASIDE' })` holds the exit on the aside; presence pair on the wrapper (aside `inert` while exiting); slot table on the wrapper; `renderToString` of an open inline drawer has `data-presence="entered"` on both elements and `hydrateRoot` logs nothing (container removed in `finally`); NavDrawer's wrapper carries both collapse classes. `motion.test.ts`: `COMPOSED_DURATIONS.inlineDrawerMotion = 'drawerDurations'`.
- [ ] **Step 2:** Run the new file, `NavDrawer.motion.test.tsx`, `Drawer.inline.test.tsx`, `src/lib/__tests__/motion.test.ts`, `src/__tests__/classNames.test.ts`; FAIL on new cases.
- [ ] **Step 3: Implement.** Inline markup `<div ref={legacy ? undefined : presenceRef} {...presenceProps} className={cn(collapseClassName, inlineDrawerStructure[position], size === 'full' ? '' : motionClasses)}>` around the unchanged panel, which also spreads `presenceProps` and takes `presenceRef` only when `usesLegacyMotion(motion, className)`; default motion `${inlineDrawerMotion[axis]} ${drawerDurations[size]}`; no `appear` inline.
- [ ] **Step 4:** Step 2 runs, the gate for the three component files and `src/lib/motion.ts`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(overlays): inline drawers collapse their space`.

### Task 5: Menu.Popover and useFocusBeforeClose (P10-MENU, §6.1, D20)

**Files:** Create `src/hooks/useFocusBeforeClose.ts`, `src/hooks/__tests__/useFocusBeforeClose.test.tsx`; Modify `src/lib/motion.ts`, `src/lib/__tests__/motion.test.ts`, `src/components/navigation/Menu.popover.tsx`; Test create `src/components/navigation/__tests__/Menu.motion.test.tsx`.

**Interfaces:**
- Produces `popupMotion` (Tasks 6, 7, 9 use it) and:

```ts
export interface UseFocusBeforeCloseOptions {
  /** The surface's open state. */
  open: boolean;
  /** The surface element, read in the closing commit. */
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** The preferred opener, read in an insertion effect of the commit that opens the surface;
   *  when it returns no candidate, the focused element is taken (never <body>, <html> or an
   *  element inside the surface). */
  captureOpener: () => HTMLElement | null;
  /** Focus targets at close, in order; receives the captured opener. The first connected,
   *  focusable one outside the surface takes focus. */
  candidates: (opener: HTMLElement | null) => ReadonlyArray<HTMLElement | null | undefined>;
}
export function useFocusBeforeClose(options: UseFocusBeforeCloseOptions): void;
```

  Moved from `Menu.popover.tsx:298-421` with its effect order: the unmount-tracking layout effect first, then the `open`-keyed layout effect whose cleanup moves focus (`preventScroll`) when the surface still contains focus and the component is not unmounting. Menu.Popover calls it where that code was (after `useRestoreFocus` and the surface registration), with `captureOpener: () => (openOnContext ? null : triggerFocusRef.current)` and `candidates: (opener) => [openOnContext ? contextOpener.current : null, opener, getReturnFocus()]`.
- Produces `MenuPopoverProps.motion?: MotionSlot | null` (Fluent's `Menu surfaceMotion`).

- [ ] **Step 1: Failing tests.** Hook: a close with focus inside moves focus to the first valid candidate inside the closing `act` (asserted before any microtask); a disconnected or inside-the-surface candidate is skipped; focus outside the surface at close moves nothing; an unmount while open moves nothing; the opener is the focused element when `captureOpener` returns `null`; a Dialog opened by an element of the surface in the same update as the close records the trigger (closing the Dialog focuses the trigger); **Review Focus 2:** under `<StrictMode>` with `open` true at mount and focus inside, nothing moves at mount and one close moves focus once. Menu: slot table on `role="menu"`; D19 with the `ExitMotion` story's classes keeps them and drops `popupMotion`; `data-side` rendered; a submenu chain closed by an item: both menus `exiting` and `inert`, both their layers released, focus on the root trigger; `defaultOpen` client render `entering`; reduced motion. `motion.test.ts` check 5 for `popupMotion`: no `transition`, `transition-all` or `transition-transform` word, and its `transition-[…]` lists `translate`.
- [ ] **Step 2:** Run the two new files and `src/lib/__tests__/motion.test.ts`; FAIL on new cases.
- [ ] **Step 3: Implement** the hook, the recipe, `usePresence(open, { appear: true })`, classes `cn(menuPopoverClassNames.root, menuPopoverClasses, useMotionClasses(motion, popupMotion, className), className)`; JSDoc of `Menu.Popover` (default motion; 0.14's className form still honoured).
- [ ] **Step 4:** Run Step 2 plus `Menu.presence.test.tsx`, `Menu.contextMenu.test.tsx` and `npx vitest run src/__tests__/integration.test.tsx -t "menus and commands across components|a Dialog opened as its Popover or Menu closes"` — all green unedited; gate for `Menu.popover.tsx` and `src/lib/motion.ts`, tsc, lint.
- [ ] **Step 5: Commit** `feat(navigation): Menu.Popover motion; focus before close as a shared hook`.

### Task 6: Popover.Content onto the presence core (P10-POP, §6.2, D22)

**Files:** Modify `src/components/overlays/Popover.tsx`; Test create `src/components/overlays/__tests__/Popover.motion.test.tsx`.

**Interfaces:** Consumes `popupMotion`, `useFocusBeforeClose` (Task 5). Produces `PopoverContentProps.motion?: MotionSlot | null` (Fluent's `Popover surfaceMotion`); the content renders `data-presence`, `data-state` (`open`/`closed`) and `inert` while exiting.

- [ ] **Step 1: Failing tests:** slot table on `role="dialog"`; `data-state` `open`, then `closed` while exiting; **Review Focus 1:** close and reopen before `finishAll` → same node, `entering`, not `inert`, `data-state="open"`; risk 2: a button in the content that closes the Popover and opens a Dialog in one update → closing the Dialog focuses the Popover's trigger; an `openOnHover` hover close during the exit leaves focus on an outside button; a context popover's position style is unchanged between open and exiting; `findDanglingIdRefs()` empty while exiting; reduced motion; the trigger's `aria-controls` absent from the closing commit on.
- [ ] **Step 2:** Run the new file; FAIL.
- [ ] **Step 3: Implement.** In `PopoverContent`: `usePresence(open, { appear: true })` (presence ref merged into `elementRef`), `if (!isMounted) return null` replaces `if (!open) return null`, `{...presenceProps}` and `data-state` on the surface, classes `cn(popoverContentClassNames.root, base, useMotionClasses(motion, popupMotion), className)`. In the Popover root, right after its `useRestoreFocus`: `useFocusBeforeClose({ open, surfaceRef, captureOpener: () => (openOnContext ? null : triggerFocusRef.current), candidates: (opener) => [openOnContext ? contextOpener.current : null, opener, resolveFocusTarget()] })`. JSDoc.
- [ ] **Step 4:** Step 2 plus `Popover.test.tsx`, `Popover.shared.test.tsx`, gate for `Popover.tsx`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(overlays): Popover.Content mounts through the presence core with motion`.

### Task 7: InfoButton note and InfoLabel (P10-INFO, §6.3)

**Files:** Modify `src/components/data-display/InfoButton.tsx`, `InfoLabel.tsx`; Test create `src/components/data-display/__tests__/InfoButton.motion.test.tsx`.

**Interfaces:** Consumes `popupMotion`, `useFocusBeforeClose`. Produces `InfoButtonProps.motion?: MotionSlot | null` (the note) and `InfoLabelProps.motion?`, passed to its InfoButton.

- [ ] **Step 1: Failing tests:** slot table on `role="note"`; `<InfoLabel motion="my-motion">` puts it on the note; content `<span data-testid="info">` is in the document exactly once while closed, open, exiting and after; the note `inert` while exiting; Escape with focus on a link in the note focuses the button within the closing `act`; reduced motion.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** `usePresence(open, { appear: true })`, note classes `cn(infoButtonClassNames.info, noteClassName, base, useMotionClasses(motion, popupMotion))`, `useFocusBeforeClose({ open, surfaceRef: noteRef, captureOpener: () => buttonRef.current, candidates: () => [buttonRef.current] })`; JSDoc ("ships no motion of its own" rewritten).
- [ ] **Step 4:** Step 2 plus `InfoButton.test.tsx`, `InfoLabel.test.tsx`, gate for both files, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(data-display): InfoButton note motion`.

### Task 8: Tooltip onto the presence core (P10-TIP, §6.4)

**Files:** Modify `src/lib/motion.ts`, `src/lib/__tests__/motion.test.ts`, `src/components/overlays/Tooltip.tsx`; Test create `src/components/overlays/__tests__/Tooltip.motion.test.tsx`.

**Interfaces:** Produces `tooltipMotion`; `TooltipProps.motion?: MotionSlot | null` (the portaled surface; WaveUI's addition, Fluent's Tooltip has no motion); the surface renders `data-presence`, `data-state` and `inert` while exiting, still `aria-hidden`.

- [ ] **Step 1: Failing tests:** slot table on `[data-wave-tooltip-surface]`; unhover → `exiting`, hover again before `finishAll` → the same node `entering`; the hidden `role="tooltip"` copy has the same text in every phase, and `renderToString` holds it with no surface; reduced motion; `motion.test.ts` check 5 for `tooltipMotion` (no `transition`, `transition-all` or `transition-transform`; it lists only opacity).
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3: Implement** `usePresence(visible, { appear: true })`; the portal renders while `isMounted`; presence ref merged into `surfaceElementRef`; `{...presenceProps}` and `data-state={visible ? 'open' : 'closed'}` on the surface; `cn(tooltipClassNames.content, surfaceClasses, appearanceClasses[appearance], useMotionClasses(motion, tooltipMotion))`; the Escape layer stays on `visible`.
- [ ] **Step 4:** Step 2 plus `Tooltip.test.tsx`, the integration Tooltip blocks (`-t "Tooltip"`), gate, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(overlays): Tooltip mounts through the presence core and fades`.

### Task 9: TeachingPopover onto the presence core (P10-TEACH, §6.5, risk 1)

**Files:** Modify `src/components/overlays/TeachingPopover.parts.tsx`, `TeachingPopover.root.tsx`, `TeachingPopover.tsx` (JSDoc); Test create `src/components/overlays/__tests__/TeachingPopover.motion.test.tsx`.

**Interfaces:** Consumes `popupMotion`, `useFocusBeforeClose`. Produces `motion?: MotionSlot | null` on the root (for the surface it renders) and on `TeachingPopover.Surface`; the internal `TeachingSurface` takes `motion`; the root's `TeachingPopover:surface-props` condition and text include `motion`.

- [ ] **Step 1: Failing tests:** an anchored popover (target with `mockRect`) exiting keeps no `visibility: hidden` in its inline style (risk 1); Done and Close leave the surface `exiting` with focus already on the Trigger; reopening during the exit starts at step 1 on the same node; an inline popover (no target) exits in place with only the fade; slot table on the root and on a `Surface`; the root's `motion` next to a `Surface` warns `TeachingPopover:surface-props`, whose list now reads ``(`className`, `style`, `ref`, `onKeyDown`, `motion` and the other element props)`` (asserted exactly); `data-state`; reduced motion.
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3: Implement** `usePresence(shown, { appear: true })` replacing `if (!shown || !step) return null` (render while `isMounted`, the last `step` held while exiting); a previous-value state of `anchorReady` updated while `shown`, used for the visibility style while closed (the layer, restore, tab order and initial focus keep `visible`); `useFocusBeforeClose({ open: visible, surfaceRef, captureOpener: () => triggerFocusRef.current, candidates: () => [triggerFocusRef.current, targetRef.current] })`; `data-state`; classes add `useMotionClasses(motion, popupMotion)` before `className`.
- [ ] **Step 4:** Step 2 plus `TeachingPopover.test.tsx` (0.14.1's reopen case green unedited), gate for the three files, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(overlays): TeachingPopover motion; visible through its exit`.

### Task 10: Accordion panel collapse (P10-ACC, §5.1, §2.5)

**Files:** Modify `src/lib/motion.ts`, `src/lib/classNames.ts` (`accordionPanelClassNames.collapse: 'wave-accordion-panel__collapse'`), `src/components/layout/Accordion.tsx`, `scripts/build-css.mjs` + `src/styles/__tests__/tokens.test.ts` (`REQUIRED_UTILITIES` gains `data-[presence=entered]:contents`); Create `src/hooks/useCollapsePresence.ts`, `src/hooks/__tests__/useCollapsePresence.test.tsx`; Test create `src/components/layout/__tests__/Accordion.motion.test.tsx`.

**Interfaces:**
- Produces `collapseStructure`, `collapseMotion`, `AccordionPanelProps.motion?: MotionSlot | null` (Fluent's `AccordionPanel collapseMotion`) and, for Tasks 11 and 12:

```ts
export interface UseCollapsePresenceOptions {
  motion: MotionSlot | null | undefined;
  /** The part that may hold focus when it collapses. */
  partRef: React.RefObject<HTMLElement | null>;
  /** Where that focus goes: the disclosure's own trigger. */
  getTrigger: () => HTMLElement | null | undefined;
}
export interface UseCollapsePresenceResult {
  isMounted: boolean;
  phase: PresencePhase;
  wrapperRef: React.RefCallback<HTMLElement>;
  presenceProps: PresenceAttributes;
  /** collapseStructure plus the resolved motion; the caller puts its stable class first. */
  className: string;
}
export function useCollapsePresence(open: boolean, options: UseCollapsePresenceOptions): UseCollapsePresenceResult;
// usePresence(open) (no appear), useMotionClasses(motion, collapseMotion),
// usePreserveFocus(partRef, getTrigger, { enabled: open }); callers destructure the result.
```

- [ ] **Step 1: Failing tests.** Hook: className composition, provider `'none'`, focus inside the part moves to the trigger in the closing commit. Accordion: an open panel's wrapper (`accordionPanelClassNames.collapse`) has `motionClasses(collapseStructure)` and `collapseMotion`, `data-presence="entered"`, and the region (every 0.14 prop and attribute) as its only child; a misplaced panel has no wrapper; presence pair on the wrapper: region `data-state="closed"`, trigger `aria-expanded="false"` while exiting; single mode: opening B while A exits (A `exiting`, B `entering`); focus in A's region at close lands on A's trigger in the closing `act`; reduced motion; `renderToString` of an open item has the wrapper `entered` and `hydrateRoot` logs nothing; `findDanglingIdRefs()` empty while exiting; slot table; **Review Focus 3:** close and reopen before `finishAll` → the same region node, an uncontrolled input inside keeps its typed text, wrapper `entering`, no `inert`, `data-state="open"`.
- [ ] **Step 2:** Run the two new files; FAIL.
- [ ] **Step 3: Implement** the hook and the markup `[div.wave-accordion-panel__collapse] > [div role="region"]` (`cn(accordionPanelClassNames.collapse, collapse.className)`), region `data-state={item.isOpen ? 'open' : 'closed'}`, `partRef` merged into the region's ref, `getTrigger` → the element with `item.triggerId` in the region's document (null when gone); the misplaced path renders as in 0.14; JSDoc; `REQUIRED_UTILITIES`.
- [ ] **Step 4:** Step 2 plus `Accordion.test.tsx`, `classNames.test.ts`, `node scripts/build-css.mjs`, `tokens.test.ts`, gate for `Accordion.tsx` and `src/lib/motion.ts`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(layout): Accordion panels collapse`.

### Task 11: Tree groups collapse (P10-TREE, §5.2)

**Files:** Modify `src/components/layout/Tree.core.tsx`, `Tree.context.ts`, `src/lib/classNames.ts` (`treeItemClassNames.collapse: 'wave-tree-item__collapse'`); Test create `src/components/layout/__tests__/Tree.motion.test.tsx`.

**Interfaces:** Consumes `useCollapsePresence` (Task 10). Produces `TreeProps.motion?: MotionSlot | null` (Fluent's `Tree collapseMotion`, every nested group); `TreeContextValue.motion: MotionSlot | null | undefined` (`INERT_CONTEXT.motion = undefined`).

- [ ] **Step 1: Failing tests:** the wrapper around `role="group"`; a chevron click with focus on a child collapses and focuses the parent `role="treeitem"`, which holds `tabIndex=0`; while the group exits ArrowDown from the parent skips its items and typeahead does not land in them; collapsing a parent leaves an inner group's wrapper `entered` (no second exit); checking a parent in `selectionMode="multiple"` while its group exits gives the same `aria-checked` values as 0.14; slot table through `Tree motion`; reduced motion; server HTML of an expanded tree has the wrapper `entered`; the chevron keeps its transition classes under provider `'none'`.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** `useCollapsePresence(hasChildren && isExpanded, { motion: ctx.motion, partRef: <a new ref on the group element>, getTrigger: () => <the item's own role="treeitem" element> })`, rendering `[div.wave-tree-item__collapse] > [div role="group"]` while `isMounted`; `Tree` passes `motion` into its memoised context value.
- [ ] **Step 4:** Step 2 plus every `Tree*.test.tsx`, `classNames.test.ts`, gate for both files, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(layout): Tree groups collapse`.

### Task 12: Nav categories, expand icon and item actions (P10-NAV, §5.3)

**Files:** Modify `src/lib/motion.ts`, `src/lib/classNames.ts` (`navCategoryClassNames.collapse: 'wave-nav-category__collapse'`), `src/components/navigation/Nav.tsx`; Test create `src/components/navigation/__tests__/Nav.motion.test.tsx`.

**Interfaces:** Consumes `useCollapsePresence`, `useMotionPreference`. Produces `expandIconMotion`, `navActionsRevealMotion` (imported into `Nav.tsx` under aliases, since `expandIconMotion` is also a prop name); `NavCategoryProps.motion?` (Fluent's `NavSubItemGroup collapseMotion`), `expandIcon?: Slot<'span'>` (optional-indicator rule; a custom glyph is not turned), `expandIconMotion?: MotionSlot | null` (Fluent's `NavCategoryItem expandIconMotion`).

- [ ] **Step 1: Failing tests:** `li > button, div.wave-nav-category__collapse > ul.wave-nav-category__list`; presence pair (list `inert` while exiting, `aria-controls` gone at close); focus in the list at close goes to the category button; in a `NavDrawer.Body focusMode="arrow"` the exiting list's items leave the arrow order; `expandIcon`: `undefined` and `null` → the default chevron, `rotate-180` while open; `false` and `''` → none; a custom node → a span with `navCategoryClassNames.expandIcon`, never `rotate-180`; `expandIconMotion` slot table on the chevron (`null` keeps `rotate-180`, drops the transition); the actions group has `navActionsRevealMotion`'s words, none under provider `'none'`; RTL chevron classes unchanged.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** the collapse with `partRef: listRef` (the existing ref) and `getTrigger` returning the category button (a new ref on it); the expand icon (default chevron `cn(expandIcon class, 'shrink-0', iconMotion, isOpen && 'rotate-180')`, custom glyph through `renderSlot(expandIcon, 'span', cn(expandIcon class, 'inline-flex shrink-0', iconMotion), { 'aria-hidden': true })`); `cn(stable.actions, actionsClasses, preference === 'none' ? undefined : navActionsReveal)` and the `actionsClasses` comment rewritten.
- [ ] **Step 4:** Step 2 plus every `Nav*.test.tsx` and `NavDrawer*.test.tsx`, `classNames.test.ts`, gate, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(navigation): Nav categories collapse; expandIcon and its motion`.

### Task 13: Toast containers (P10-TOAST, §7, D14)

**Files:** Modify `src/lib/motion.ts`, `src/lib/classNames.ts` (`toasterClassNames.toastContent: 'wave-toaster__toast-content'`), `src/components/feedback/Toaster.tsx`; Test create `src/components/feedback/__tests__/Toaster.motion.test.tsx`.

**Interfaces:** Produces `toastStructure`, `toastMotion`; `ToasterProps.motion?: MotionSlot | null` (every toast container; Fluent has no slot here); `ToastContainerProps.motionClassName: string`.

- [ ] **Step 1: Failing tests:** `it.each` over the eight positions: the container (`[data-wave-toast]`) has `motionClasses(toastStructure)` and `toastMotion[top-* ? 'top' : 'bottom']`; the container's only child is `.wave-toaster__toast-content`, holding the status text and the Toast; slot table through `Toaster motion`; `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` still holds a dismissed toast `exiting`; reduced motion; the timer still starts at mount.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** the edge from `position`, `useMotionClasses(motion, toastMotion[edge])` in the Toaster, the container `cn(toasterClassNames.toast, 'rounded', focusRing, toastStructure, motionClassName)` and the content wrapper; JSDoc (README's "Wave ships no toast motion" is Task 19's).
- [ ] **Step 4:** Step 2 plus every `Toast*.test.tsx` (`Toast.parts.test.tsx`'s reduced-motion case unedited), the integration toast blocks (`-t "toast"`), `classNames.test.ts`, gate, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(feedback): toast containers slide, fade and collapse`.

### Task 14: MessageBarGroup and the keyed presence group (P10-MBG, §8, §2.6, D21)

**Files:** Create `src/hooks/usePresenceGroup.ts`, `src/hooks/__tests__/usePresenceGroup.test.tsx`, `src/components/feedback/MessageBarGroup.tsx`, `src/components/feedback/__tests__/MessageBarGroup.test.tsx`; Modify `src/lib/motion.ts`, `src/lib/classNames.ts` (`messageBarGroupClassNames = { root: 'wave-message-bar-group', item: 'wave-message-bar-group__item' }`), `src/__tests__/classNames.test.ts` (`PENDING_CLASS_NAMES = ['messageBarGroupClassNames']`: no entry export until Task 18).

**Interfaces:**
- Produces the three MBG recipes and:

```ts
export interface PresenceGroupEntry { key: string; element: React.ReactElement; visible: boolean; appear: boolean }
export interface UsePresenceGroupResult {
  entries: readonly PresenceGroupEntry[];
  /** Non-element children and elements without a key of the consumer's, in order (rendered after the entries, unanimated). */
  skipped: readonly React.ReactNode[];
  onExited: (key: string) => void;
}
export function usePresenceGroup(children: React.ReactNode, options: { appear: boolean }): UsePresenceGroupResult;
// MessageBarGroup.tsx — MessageBarGroupProps verbatim from spec §8
export const MessageBarGroup: (props: MessageBarGroupProps) => React.ReactNode; // displayName 'MessageBarGroup'
```

  A child is keyed when the last `/`-segment of its `flattenChildren` key starts with `.$`. The merge (derived during render from a previous-value state): the new keyed children in their order, `visible: true`, `appear: false` on the group's first render else `options.appear`; each previous entry missing from them is kept with `visible: false` right after the nearest entry that preceded it before and is still present (else first); a missing key that returns is `visible` again with the new element.
- Root `<div data-animate={animate} {...rest} className={cn(messageBarGroupClassNames.root, 'flex flex-col gap-2', className)}>`; internal `MessageBarGroupItem` (`usePresence(entry.visible, { appear: entry.appear, onExited })`, `usePreserveFocus(itemRef, nextBarFocus, { enabled: entry.visible })` where `nextBarFocus` is `getFirstTabbable` of the next sibling item (selected through `messageBarGroupClassNames.item`) that is not `exiting`, else of the previous one), wrapper `cn(messageBarGroupClassNames.item, messageBarGroupItemStructure, motionClassName)`; default motion `messageBarGroupExitMotion`, plus `messageBarGroupEnterMotion` with `animate="both"`; `skipped.length > 0` warns once from an effect: key `MessageBarGroup:children`, text ``MessageBarGroup: every child should be an element with a key of its own (a MessageBar with `key={id}`); other children render after the bars, without motion.``

- [ ] **Step 1: Failing tests.** Hook (spec §2.6 list): first-render children do not appear; added ones do with `appear`; removal keeps the entry with `mockAnimations` until `finishAll`, then drops it; a middle removal keeps the order; re-adding during exit makes it visible again; reduced motion removes at once; StrictMode `onExited` once; Fragment children flattened; `renderToString` renders every child `entered`. MessageBarGroup (spec §8 list): `testSystemProps(MessageBarGroup, …)`; bars at mount `entered` with the wrapper's structure; a removed bar `inert` until `finishAll`; `both` vs `exit-only` (an added bar `entering` vs `entered`); a middle removal's order; re-adding a key during exit; focus on a dismissed bar's button moves to the next bar's first tabbable element, else the previous one's; the children warning asserted exactly for a text child and a keyless element; reduced motion; StrictMode; `renderToString` + hydration clean; axe with three bars. **Review Focus 4:** reorder `[a, b, c]` → `[c, a, b]` keeps the same three wrapper nodes, all `entered`, in the new DOM order; `[a, b, c]` → `[c, a]` keeps `b` exiting right after `a`, no other node replaced.
- [ ] **Step 2:** Run both pairs of new files; FAIL.
- [ ] **Step 3: Implement** as above; component JSDoc (Fluent's MessageBarGroup, `animate`, keys, focus, the standalone-component ruling D21 in words).
- [ ] **Step 4:** Step 2 plus `classNames.test.ts`, gate for `MessageBarGroup.tsx` and `src/lib/motion.ts`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(feedback): MessageBarGroup with exit and enter motion`.

### Task 15: Carousel motion and motionDuration (P10-CAR, §9.1)

**Files:** Modify `src/lib/motion.ts`, `src/components/layout/Carousel.tsx`, `src/__tests__/public-types.test.ts` (`PENDING_PUBLIC_TYPES = ['CarouselMotion']` until Task 18); Test create `src/components/layout/__tests__/Carousel.motion.test.tsx`. `Carousel.drag.ts` stays unchanged: under fade the root ignores `drag.offsetPx`.

**Interfaces:** Produces `carouselSlideMotion`, `carouselFadeMotion`; `export type CarouselMotion = 'slide' | 'fade'`; `CarouselProps.motion?: CarouselMotion | null` (`@default 'slide'`), `motionDuration?: number` (`@default 300`, milliseconds; JSDoc warns that Fluent's `duration` is Embla's unitless 20–60); `data-motion` (`slide | fade | none`) on the root, at both render sites.

- [ ] **Step 1: Failing tests:** `data-motion="slide"` by default, `fade`, `none` with `null`, `none` under provider `'none'`, `fade` with an explicit `motion="fade"` under `'none'`; the track has `carouselSlideMotion`'s words and no longer 0.14's 300 ms and ease-in-out classes; fade: the track is a grid with no transform style, every slide shares the first grid cell, inactive slides `opacity-0`, `inert` and `aria-hidden`, each slide `carouselFadeMotion`; `motionDuration={450}` → inline `transition-duration: 450ms` on the track (slide) or each slide (fade), none at 300; `motion="fade"` with `groupSize={2}` (and `"auto"`) falls back to slide (`data-motion="slide"`) and warns once from an effect: key `Carousel:fade-group`, text ``Carousel: `motion="fade"` needs one slide per page; with `groupSize` above 1 or `"auto"` the slides slide.``; a drag past the threshold under fade pages with no transform; `expectTypeOf<CarouselMotion>()`; the existing reduced-motion autoplay cases green unedited.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** (resolution: own value, else `'none'` under the provider's `'none'`, else `'slide'`; fade only with one-slide pages).
- [ ] **Step 4:** Step 2 plus `Carousel.test.tsx`, `public-types.test.ts`, gate, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(layout): Carousel motion and motionDuration`.

### Task 16: TabList sliding indicator (P10-TAB, §9.2, R12)

**Files:** Modify `src/lib/motion.ts`, `src/components/layout/TabList.tsx`; Test create `src/components/layout/__tests__/TabList.motion.test.tsx`.

**Interfaces:** Produces `tabIndicatorMotion`; `TabListProps.motion?: MotionSlot | null` (the indicator's transition, `appearance="transparent"` only; Fluent has no opt-out); TabList context gains `indicator: { value: string; offset: number; scale: number } | null` and `indicatorMotion: string`.

- Selected transparent tab classes (one line each, `// wave-allow-physical: the FLIP offset is measured in physical pixels`): horizontal `relative border-b-2 border-b-transparent after:absolute after:inset-x-0 after:-bottom-0.5 after:border-b-2 after:border-b-primary after:origin-left after:translate-x-[var(--wave-tab-indicator-offset,0px)] after:scale-x-[var(--wave-tab-indicator-scale,1)] forced-colors:after:border-[Highlight]`; vertical `relative border-s-2 border-s-transparent after:absolute after:inset-y-0 after:-start-0.5 after:border-s-2 after:border-s-primary after:origin-top after:translate-y-[var(--wave-tab-indicator-offset,0px)] after:scale-y-[var(--wave-tab-indicator-scale,1)] forced-colors:after:border-[Highlight]`.
- FLIP: a layout effect in the root keyed on the selected value reads the previous value from a ref, finds both tabs among the tablist's `[role="tab"]` elements by their `data-roving-value` (compared as strings, no selector built from the value), and sets `indicator` to `{ value, offset: prev.left − next.left, scale: prev.width / next.width }` (vertical: top and height); skipped on the first render, when the previous tab is gone or the new width is 0, when `indicatorMotion` is `''` (`null`, provider `'none'`), under `usePrefersReducedMotion()`, and for other appearances. An effect keyed on `indicator` schedules `requestAnimationFrame(() => setIndicator(null))` and cancels it in its cleanup. The selected Tab renders the two custom properties merged into its `style` (consumer `style` destructured) and omits `indicatorMotion` while `indicator?.value === value`, else adds it.

- [ ] **Step 1: Failing tests** (`mockRect` on the tabs, `requestAnimationFrame` replaced by a spy that stores the callback): selecting B (A at left 0 width 60, B at left 80 width 100) writes `--wave-tab-indicator-offset: -80px` and `--wave-tab-indicator-scale: 0.6` on B and no `tabIndicatorMotion` word; running the frame removes both and adds the words; nothing on mount, with `motion={null}`, under provider `'none'`, under reduced motion; vertical uses top and height; `{ dir: 'rtl' }` writes the same physical numbers; a consumer `style={{ minWidth: '10px' }}` is kept; the forced-colours class is present; axe; **Review Focus 5:** two selections before the frame → the first frame cancelled, the properties for the latest pair; unmount with a frame pending → `cancelAnimationFrame` called, no state update after unmount.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** as above; JSDoc of TabList (`motion`, the indicator markup).
- [ ] **Step 4:** Step 2 plus `TabList.test.tsx` (assertions of the selected tab's border classes change: list them in spec §12), gate for `TabList.tsx` and `src/lib/motion.ts`, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(layout): TabList sliding indicator`.

### Task 17: ProgressBar indeterminateMotion (P10-PROG, §9.3)

**Files:** Modify `src/lib/motion.ts`, `src/components/feedback/ProgressBar.tsx`; Test `src/components/feedback/__tests__/ProgressBar.test.tsx`.

**Interfaces:** Produces `progressIndeterminateMotion`; `ProgressBarProps.indeterminateMotion?: MotionSlot | null` (Fluent's name; `null` and provider `'none'` draw a static full-width bar).

- [ ] **Step 1: Failing tests:** the indeterminate bar's class list equals 0.14's word for word; `null` → `w-full` and no `animate-` word; `indeterminateMotion="w-2/5"` → `w-2/5` only; `{ className }` form; provider `'none'` → static full; a determinate bar keeps its inline width and no motion words.
- [ ] **Step 2:** Run it; FAIL.
- [ ] **Step 3: Implement** `cn(progressBarClassNames.bar, 'h-full rounded-full', fillColorClasses[resolvedColor], forcedColors.selectedLeaf, isIndeterminate && cn('w-full', useMotionClasses(indeterminateMotion, progressIndeterminateMotion)))` (the hook called unconditionally); JSDoc.
- [ ] **Step 4:** Step 2, gate, tsc, lint; PASS.
- [ ] **Step 5: Commit** `feat(feedback): ProgressBar indeterminateMotion`.

### Task 18: INTEGRATION — exports, probes, compositions (§11 row 18)

**Files:** Modify `src/components/feedback/index.ts` (`MessageBarGroup`, `MessageBarGroupProps`), `src/components/layout/index.ts` (`CarouselMotion`), `src/__tests__/classNames.test.ts`, `src/__tests__/public-types.test.ts`, `src/__tests__/integration.test.tsx`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, spec §12. (`MotionSlot` and `MotionPreference` already reach the entry through `export type * from './lib/types'`.)

- [ ] **Step 1: Failing tests.**
  - Barrel: `MessageBarGroup` exported; the `PENDING_CLASS_NAMES`, `PENDING_PUBLIC_TYPES` and `PENDING_FLAT_MEMBERS` lists empty.
  - verify-dist: `MOTION_RECIPE_MIN` equals the number of literals `motionRecipeLiterals` finds in the built dist; positive controls `keep: 'Accordion'` (`strings`: `collapseStructure`, `collapseMotion`) and `keep: 'MessageBarGroup'` (`modules`: `hooks/usePresenceGroup.mjs`, `lib/motion.mjs`); the MessageBar-only probe `{ keep: 'MessageBar', drop: 'MessageBarGroup', dropModules: ['hooks/usePresence.mjs', 'hooks/usePresenceGroup.mjs'] }`; `MODULE_ONLY_NAMES` gains (sorted) `PresenceGroupEntry`, `UseCollapsePresenceOptions`, `UseCollapsePresenceResult`, `UseFocusBeforeCloseOptions`, `UsePresenceGroupResult`, `resolveMotion`, `useCollapsePresence`, `useFocusBeforeClose`, `useMotionClasses`, `useMotionPreference`, `usePresenceGroup`, `usesLegacyMotion` and every recipe constant name (spec §16 Q1: internal in 0.15).
  - `integration.test.tsx` (spec §11): a Popover button and a Menu item each closing their surface and opening a Dialog in one update while the surface exits → closing the Dialog focuses the trigger; two stacked Dialogs, the upper closing keeps `data-appearance="transparent"`; a Toast over an exiting Dialog stays operable; an Accordion in a Dialog closing with focus in its panel → focus on its trigger, the Dialog still open; `WaveProvider motion="none"` around one of each surface → no element carries a word of any motion recipe (the `*Structure` constants excepted), a part's own `motion` still applies, a nested `motion="default"` re-enables; Server Component cases: `MessageBarGroup` with `asClientReference(MessageBar)` children (same `renderToString`, hydration clean), Accordion, Tree and Nav with open parts (wrappers `entered` in the HTML, hydration clean), `asClientReference` for `AccordionPanel`, `NavCategory` and `TreeItem`.
- [ ] **Step 2:** Run `npx vitest run src/__tests__ scripts/__tests__/verify-dist.test.mjs --reporter=default`; FAIL.
- [ ] **Step 3:** Exports, list emptying, probes, `MOTION_RECIPE_MIN`; fix any export JSDoc verify-dist reports (C-DOCS).
- [ ] **Step 4:** `npm run build`, `node scripts/verify-dist.mjs --final` (exit 0), `npm test`; PASS.
- [ ] **Step 5: Commit** `feat: export MessageBarGroup and CarouselMotion; motion probes and integration cases`.

### Task 19: DOCS — stories and documentation (§11 DOCS)

**Files:** stories of Dialog, Drawer, NavDrawer, Menu, Popover, InfoButton, Tooltip, TeachingPopover, Accordion, Tree, Nav, Toast, MessageBar, Carousel, TabList, ProgressBar, and `stories/Presence.stories.tsx`; `README.md`, `docs/WAVE-UI-GUIDE.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `CLAUDE.md`, `docs/testing-best-practices.md`, spec §12.

- [ ] **Step 1: Stories.** A `Motion` story per surface with the default, `null` and a replacement (defaults in `args`, `fn()` callbacks, named, tokens only); `MessageBar.stories.tsx` shows the group with `exit-only` and `both`; `Presence.stories.tsx` gains `ProviderMotionNone`; Menu's `ExitMotion` moves its classes to `motion`. Run `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Dialog|Drawer|NavDrawer|Menu|Popover|InfoButton|Tooltip|TeachingPopover|Accordion|Tree|Nav|Toast|MessageBar|Carousel|TabList|ProgressBar|Presence"`.
- [ ] **Step 2: CHANGELOG** `## [0.15.0] - Unreleased`: Upgrading from 0.14 (spec §13 items 1–13), Added, Changed, Deprecated (none), Fixed (risks 1, 2, 7, 8), Size (`lib/motion.mjs`, `dist/styles.css`, the Button-only and full-import probes against 0.14).
- [ ] **Step 3: README, guide, roadmap, CLAUDE.md, testing guide.** README "Enter and exit motion" rewritten around the defaults, a MessageBarGroup section, the props in each component section, the provider prop, Carousel and TabList notes, and every "no motion ships" line replaced (Menu, Dialog, Drawer, Toast sections). Guide chapter 6 "Component motion" (the §3 table with class strings, slot rules, provider, the collapse wrapper and `display: contents`, reduced motion, tuning through the tokens, the precompiled-CSS limit of replacements, D7's exit consequences) and Pattern 9. ROADMAP: Phase 10 built as, the spec linked, §8.5 follow-ups (risks 6 and 9, the deferred popups). CLAUDE.md: the 0.15 design reference in "What is this?", Architecture (`lib/motion`, `useMotion`, `useFocusBeforeClose`, `useCollapsePresence`, `usePresenceGroup`, `MessageBarGroup`), C-MOTION (motion ships from `lib/motion.ts`, `data-[presence=…]` classes only there, the slot rule, the collapse wrapper, the gate now scans `src/lib/motion.ts`), C-NAMING (motion slot names and the ruling), C-CLASS (`data-animate`, `data-motion`, the new part keys), Testing (collapse wrappers in `mockAnimations`, `renderWithProviders(ui, { motion })`, `motionClasses`). Testing guide: a motion section. No hard-coded test counts.
- [ ] **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`, `npm run build-storybook`; clean.
- [ ] **Step 5: Commit** `docs: motion stories, guide, README, CHANGELOG, roadmap and CLAUDE.md for 0.15`.

### Task 20: Lead — gate, browser pass, release (controller only)

**Files:** none (fixes as the gate, the review and the browser pass find them, each with a failing test first).

- [ ] **Step 1:** `/gate` (`node scripts/claude/gate.mjs --base main`); expect "Gate PASSED" and clean test output.
- [ ] **Step 2:** Final whole-branch review by a fresh most-capable reviewer with the Review Focus section and `wave-conventions-reviewer`; fix Critical and Important findings.
- [ ] **Step 3:** Real-browser pass of spec §14 items 1–14 in Storybook (`/browser-check`), Chromium, Firefox and WebKit. If an engine does not start the exit from `display: contents` (item 5), apply spec §2.5's fallback (drop `data-[presence=entered]:contents` from `collapseStructure`, `inlineDrawerStructure` and `messageBarGroupItemStructure`, and from `REQUIRED_UTILITIES`) and record it in spec §12.
- [ ] **Step 4:** Release per `docs/RELEASING.md` (version 0.15.0, dated CHANGELOG, `node scripts/check-release.mjs v0.15.0 --registry`, `chore(release): 0.15.0`, merge `--no-ff`, push, tag `v0.15.0`) **only on the maintainer's go-ahead**.

---

## Plan rulings (controller, 2026-10-27)

- **Ruling 1 — probe and build-css sequencing.** Spec §11 puts the verify-dist Button-only probe and §2.11's `REQUIRED_UTILITIES` in P10-F, but Vite emits `lib/motion.mjs` and `hooks/useMotion.mjs` only once a component imports them, Rollup drops unused recipe exports, and build-css cannot require classes no library source has yet. Accepted: Task 1b lands the machinery with fixture tests only; the real probes and each required utility are wired by the task that first has the code (Task 2: the Button-only motion probe, the Dialog positive control, `duration-wave-gentle` and `data-[presence=exiting]:opacity-0`; Task 10: `data-[presence=entered]:contents`; Task 18: the remaining probes); `MOTION_RECIPE_MIN` is 0 (Task 1b), 2 (Task 2), then the release count (Task 18).
- **Ruling 2 — recipe markers.** `motionRecipeLiterals` accepts `duration-wave-` as a fourth marker beside `[presence=`, `transition` and `animate-`, so the `drawerDurations` values pass the "is a recipe" check.
- **Ruling 3 — `motion.test.ts` checks.** Check 2 runs on `drawerMotion` and `inlineDrawerMotion` composed with each `drawerDurations[size]` (`COMPOSED_DURATIONS`); check 5's "lists `translate`" applies to `popupMotion` only (`tooltipMotion` is fade-only), while "no `transition`, `transition-all` or `transition-transform`" applies to both.
- **Ruling 4 — `usePresenceGroup` result.** The result gains `skipped: readonly React.ReactNode[]` (non-element children and elements without a consumer key, in order); MessageBarGroup renders them after the bars, without motion, and warns once (`MessageBarGroup:children`).
- **Ruling 5 — `@tailwindcss/node`.** Task 1b keeps its step: `npm install --save-dev --package-lock-only @tailwindcss/node@^4.3.3` declares as a devDependency what the toolchain already resolves (hoisted from `@tailwindcss/cli` and `@tailwindcss/vite`), so the compile check of `motion.test.ts` does not rely on hoisting. Cost if wrong: one devDependency to drop.
- **Ruling 6 — the plan's own calls beyond the spec, accepted as written.**
  - 6a. The Drawer and NavDrawer `backdrop-ignored` warnings also name `backdropMotion`, as Dialog's does (Task 3); the existing exact-text assertions change and are listed in spec §12.
  - 6b. `isConventionsTarget` in `scripts/claude/hooks.mjs` also matches `src/lib/motion.ts`, so the stop check runs the gate on it (Task 1b).
  - 6c. The internal hook `src/hooks/useCollapsePresence.ts` (`usePresence` + `useMotionClasses` + `usePreserveFocus`) is shared by Accordion, Tree and Nav (Tasks 10–12).
  - 6d. `RenderWithProvidersOptions.motion` is an option of the existing helper, not a new helper (Task 1a; spec §2.12 stands).
  - 6e. §6.1's "integration case 8" is read as the integration blocks "menus and commands across components" and "a Dialog opened as its Popover or Menu closes", which stay green unedited (Task 5).
