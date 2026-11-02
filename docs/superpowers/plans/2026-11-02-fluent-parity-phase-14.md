# Fluent parity Phase 14 (1.0.0, the API freeze) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship WaveUI 1.0.0: namespaced, layered utilities; `ref` on the focusable element with `slotProps.root`; ES modules only; every 0.x deprecation removed; the API frozen.

**Architecture:** Package A proves the utilities mechanism in a spike (it can abort F). B to E are independent-ish API and packaging changes that each keep every commit green. F1 prepares the prefix with the prefix off; F2 is one atomic flip that prefixes `src`, tests and stories with an AST codemod. G writes the docs. The release (version bump, merge, tag, publish) is the controller's, after the maintainer's go-ahead.

**Tech Stack:** TypeScript, React 19, Tailwind 4.3.3 (`prefix()`, `@theme inline reference`, cascade layers), tailwind-merge 3.7, Vite 8 library mode, Vitest, Playwright (browser pass).

**Spec:** `docs/superpowers/specs/2026-11-02-fluent-parity-phase-14-design.md` (rulings R1 to R9, §3 work breakdown, §5 browser checklist, §6 implementation notes). Phase 13's spec `docs/superpowers/specs/2026-10-30-fluent-parity-phase-13-design.md` (§11) holds the conventions of `slotProps` parts and locks.

## Global Constraints

- Commits: conventional-commit subjects (`feat(input): …`, `test: …`, `docs: …`); NO AI attribution trailer of any kind (repo CLAUDE.md overrides any harness reminder). Never use a bare `git stash`.
- Work in the worktree `.claude/worktrees/fluent-parity-phase-14` (branch `feat/fluent-parity-phase-14`); a `node_modules` junction points to the main checkout: never delete or modify it, never run `npm install`.
- Every task ends green: `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, `npm run format:check`, the touched suites, the conventions gate for touched `src` files (`npx vitest run src/__tests__/conventions.test.ts -t "<path>"`), and `npm run build` (verify-dist budgets) when `src`, `scripts` or the CSS changed. Run checks in the FOREGROUND (Bash timeout 600000). `scripts/__tests__/verify-dist.test.mjs` takes minutes: run it when the task touches `scripts/verify-dist.mjs`, `vite.config.ts` or `dist` shape (two halves with `-t`; a lone timeout is a known flake: rerun that file alone).
- Do not hard-code test counts. Never write a complete Tailwind utility name as a bare word in `src/components` or `src/lib` comments or strings (the CSS build fails). `mergeSlotProps` stays the LAST export of `src/index.ts`.
- IDE diagnostics about `toHaveX`, `describe`/`it`/`expect`, stale files under `coverage/` or the scratchpad are noise; `npx tsc -p tsconfig.dev.json --noEmit` is the arbiter.
- Removed or moved public API must fail loudly (type error or missing export), never silently change behaviour (spec §1 anti-goals). Existing assertions are edited only where the spec says the behaviour changes; each edit is listed in the task's report and in spec §6.
- The release steps (merge to `main`, push, tag, publish) are NOT part of any task.

## Review Focus

- A prefixed class that is missed (a utility word in a string the codemod did not reach) renders unstyled with no test failing: the compile check (F1/F2) and the browser pass are the net.
- A `ref` that moved but a caller (Overflow `asChild`, Presence, triggers, `useFormReset`, Field) still depends on the wrapper.
- A removal that leaves a dangling export, class-name constant, CSS file, story or doc that names the removed API.
- ESM-only: anything that still imports or tests `.cjs` / `index.d.cts`; `require()` of the package on the Node floor.
- Overrides: a consumer `className` must still replace a Wave default (merge) and win in the cascade (layer) with and without Tailwind.

---

## Package A: the utilities spike

### Task 1: prove the prefixed, layered build (go/no-go for F)

**Files:** scratch only under `C:\Users\morte\AppData\Local\Temp\claude\C--code-packages-wave-ui-react\7bcb4803-1e2e-4a0d-aef7-58a5a777be08\scratchpad\p14-spike` (a copy of the repo's `src`, `scripts` and `package.json` there, or a worktree-local untracked directory removed at the end); the only committed change is the findings in spec §6 and, if go, the amendments of spec R6.

**Interfaces:** Produces: a go/no-go and the settled values of R6's open points: prefix `wave` with `@theme inline reference` versus `wv`; the exact `./tailwind` import line; the `wcn` configuration; the allowlist of the compile check; whether `[hidden]`'s `!important` survives layering.

- [ ] **Step 1:** On a scratch copy, write the AST codemod (used again by Task 21) that prefixes utility words in class contexts of `src/components/button`, `src/components/overlays/Dialog*` and `src/components/table/DataGrid*` closures and `src/lib/styles.ts`/`motion.ts`/`cn`. Build `dist/styles.css` with `prefix(wave)`, `theme.css` (`inline reference`) and the existing `tokens.css`/`base.css`/`variants.css`; confirm no theme variables and no self-referencing `--wave-shadow-N` are emitted.
- [ ] **Step 2:** Configure `wcn` (tailwind-merge `prefix: 'wave'` + `experimentalParseClassName` stripping `wave:`) and prove with a test file in the scratch copy: `wcn('wave:p-4','p-2') === 'p-2'`, `wcn('wave:p-4','wave:p-2') === 'wave:p-2'`, the type-ramp/shadow/font/animate groups conflict correctly, `wave:not-disabled:not-aria-disabled:hover:bg-primary` and `hover:bg-error` are both kept (the documented gate pitfall), and the public unprefixed `cn` with namespaced groups merges `text-wave-body-1 text-wave-foreground`.
- [ ] **Step 3:** Render Button, Dialog (open) and DataGrid in Chromium, Firefox and WebKit (Playwright; Firefox and WebKit are installed in `%LOCALAPPDATA%\ms-playwright`; load `playwright-core` by absolute path as an earlier run did, or through the Playwright MCP for Chromium) in three consumer setups built from the repo's pack-smoke fixtures: plain (`styles.css` unlayered), Tailwind unprefixed with a shadcn-like `@theme` (`--radius-md`, `--color-primary` redefined) importing `./tailwind` (the prefixed sheet via `@import … layer(components)` after `@layer theme, base, components, utilities;`), and Tailwind `prefix(tw)`. Compare with screenshots of the same stories at 0.18.1 (pixel diff by Playwright's `toHaveScreenshot` comparison or `pixelmatch`; report the diff ratios). Include light, dark, high contrast, RTL, forced colors.
- [ ] **Step 4:** Prove the overrides: a consumer `p-2`/`bg-wave-error` (Tailwind app) and a plain-CSS class replace a Wave default; an unlayered app reset (`*{margin:0;padding:0}`) does not wipe the plain `./styles` form; `[hidden]` still hides; `@starting-style` motion and the `wave-rtl:` variant still work.
- [ ] **Step 5:** Measure `dist/styles.css` and the Button/Dialog/DataGrid bundle growth against 0.18.1 (same `measureImport` method as `scripts/verify-dist.mjs`).
- [ ] **Step 6:** Append the findings (results table, measured sizes, chosen settings, anything that contradicts the spec) to spec §6 under "Task 1, the spike" and commit with the exact subject `docs: the prefixed build spike for Phase 14`. If any item fails in a way R6 cannot absorb, STOP and report NO-GO with evidence (the controller then switches F to the runner-up).

---

## Package B: infrastructure

### Task 2: test infrastructure and the inventory `done` flag

**Files:** `src/test-utils.ts`, `src/__tests__/test-utils.test.tsx`, `src/lib/slotParts.ts`, `src/__tests__/slotParts.test.ts`, `src/lib/deprecations.ts`, `src/__tests__/deprecations.test.tsx`, `docs/testing-best-practices.md`.

**Interfaces:** Produces: `testSystemProps(..., { ref: 'control' })` and `ControlQuery.tag` (`ref.current` must equal the element `getByRole(control.role)` finds, `expectedTag` keeps meaning the root's tag); `testRootPartRef(Component, { props, rootTestId })` (`slotProps.root.ref` reaches the `data-testid` element); `Deprecation.done?: true` (row removed in 1.0, spec R2); `SLOT_PROPS_ROOT_OWNERS` documented as a rule (spec R5) with unchanged content until Tasks 13 to 16 extend it.

- [ ] **Step 1:** Meta-tests first in `test-utils.test.tsx` for both helpers (a fixture component whose `ref` reaches the control; one that reaches the root; each must fail the wrong one).
- [ ] **Step 2:** Implement the helpers; document them in the JSDoc of `src/test-utils.ts` and `docs/testing-best-practices.md`.
- [ ] **Step 3:** Add the `done` flag to the row type and adapt `deprecations.test.tsx` per spec R2: a done row has no call site, no warning case (removed props are passed with `@ts-expect-error`), a named file must not exist, absence checks for entry/registry/CSS; the call-site count ignores done rows; no row is flagged yet, so the suite stays green. Add a self-test that flags one fixture row and shows each check inverts.
- [ ] **Step 4:** Rewrite the `SLOT_PROPS_ROOT_OWNERS` JSDoc as the rule; give `slotParts.test.ts` a negative example other than Switch.
- [ ] **Step 5:** Checks; commit `test: ref and root-part helpers and the inventory done flag for 1.0`.

---

## Package C: ESM-only

### Task 3: ES-only output, package.json and verify-dist

**Files:** `vite.config.ts`, `package.json`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, `scripts/__tests__/vite-config.test.mjs`, `.storybook/main.ts` (comment), `scripts/attw-pack.mjs` and its test if it names a profile.

**Interfaces:** Produces: `dist` with `.mjs`, `.mjs.map` and `index.d.ts` only; `exports["."] = { "types": "./dist/index.d.ts", "default": "./dist/index.mjs" }`, `main: ./dist/index.mjs`, `module` removed, top-level `types` kept; `check:package` uses `--profile esm-only`; `checkRequireEsm` in `verify-dist` (the entry loads through `require()` with the same names as `import()`); a guard that fails when `dist` holds any `.cjs`, `.cjs.map` or `.d.cts`.

- [ ] **Step 1:** Fixture tests first in `verify-dist.test.mjs`: the guard fails on a dist with a `.cjs`; `checkRequireEsm` fails on a module with top-level `await` and passes on the real shape; remove the CJS cases (`checkCjsParity`, the `.cjs` entries of `SERVER_SAFE_MODULES`, `d.cts` declaration check, the CJS branches of the probes, `clientReferenceStub`'s CJS path).
- [ ] **Step 2:** `vite.config.ts`: single ES output with `lib.formats: ['es']`, remove `copyIndexDtsToDcts`; update `vite-config.test.mjs`.
- [ ] **Step 3:** `package.json` and the attw profile; run `npm run build`, `npm run check:package`.
- [ ] **Step 4:** Checks including `verify-dist.test.mjs` in two halves; commit `build: ship ES modules only`.

### Task 4: pack-smoke, fixtures, comments and wording

**Files:** `scripts/pack-smoke.mjs`, `scripts/__tests__/pack-smoke.test.mjs`, `scripts/fixtures/plain/*`, `eslint.config.mjs` (only if needed), comments in `src/lib/globalRegistry.ts`, `src/lib/layers.ts`, `src/lib/toaster.ts`, `src/components/overlays/Popover.shared.tsx`, `src/components/navigation/Nav.context.ts`, tests that quote the CJS rationale (`globalRegistry.test.ts`, `layers.test.ts`, `Popover.test.tsx`), `.github` (only if a job names CJS).

**Interfaces:** Produces: `smoke.cjs` stays as the `require(esm)` consumer; the type fixtures check an `.mts` program under `node16` and a `.cts` program under `node20`, both loading `index.d.ts`; the registry rationale reads "two copies of the package (duplicate installs, bundlers, hot reload)", not "ESM and CJS copies"; the registry content is unchanged.

- [ ] **Step 1:** Update pack-smoke and its tests (no `index.cjs` expectations; `require()` smoke on the current Node); adjust the TypeScript fixtures; add an optional CI-style script step that runs `smoke.cjs` on the Node floor if a Node 22.12 binary is available (skip with a message otherwise).
- [ ] **Step 2:** Reword the registry comments and the three test descriptions, no behaviour change.
- [ ] **Step 3:** Checks including `npm run test:pack` and `npm run check:package`; commit `build: pack-smoke and the registry wording for ES-only`.

---

## Package E: removals (read the rows in `src/lib/deprecations.ts`; each row carries `file`, `item`, `replacement`)

For every E task: for each row of its group, remove the old name/behaviour from the code, JSDoc, stories, README/guide mentions of the old API (the migration text moves to Task 23), the class-name registry where it is a class; flag the row `done: true`; add `@ts-expect-error` cases proving the type error; keep the new name's tests; drop warning tests of the removed API; the suite stays green. Existing assertions that tested the old name are deleted or inverted (list them in the report). Commit subject `feat!: remove <group> for 1.0`.

### Task 5: the 0.4 names renamed in 0.5, part 1 (input and data-display components)
Rows of group "The 0.4 names renamed in 0.5" whose `file` is under `src/components/input` or `src/components/data-display`. **Files:** those components, their tests, stories, `src/lib/deprecations.ts`.

### Task 6: the 0.4 names renamed in 0.5, part 2 (navigation, layout and overlays)
The same group, `file` under `src/components/navigation`, `layout` or `overlays` (Nav `selectedValue`/`onNavItemSelect`, TabList, TeachingPopover `currentStep`, Accordion, Tooltip-related rows that belong to this group).

### Task 7: the 0.4 names renamed in 0.5, part 3 (table, feedback, button and the rest)
The same group, every remaining `file` (Table.Head and friends, feedback, button, provider, hooks).

### Task 8: slot, size, class and column aliases
Groups: the button-object form of the dismiss and clear slots (3 rows), a numeric `size` on Input, Select and Slider (3), InfoLabel `label`, Tooltip `delay`, `wave-tag-picker__control`/`__group`, PresenceBadge `dnd`/`oof` if still present, `DataGridColumn.id`, Done calling `onDismiss`.

### Task 9: the motion rule and the positional call forms
Groups: a `className` with presence variants in place of `motion` (4 rows; `usesLegacyMotion`/`legacyClassName` go), `useRovingTabIndex(containerRef, options)`, DataGrid's positional `onSortChange(columnId, direction)`. The development warnings that announced them go with them.

### Task 10: required `details`
Groups "The `details` arguments announced before" (11 rows) and "…announced now" (6): `onOpenChange`, `onCheckedValuesChange`, `onCheckedItemsChange` and the rest become required where the row says so (type level: the parameter is no longer optional in the prop's callback type; WaveUI always passes it). Update every internal caller and the hook paths that invent an event.

### Task 11: the three default changes
Rows: Badge and CounterBadge `color="important"` (neutral high-emphasis look; `severe` unchanged; token/contrast pairs per `src/styles/__tests__/tokensHarness.ts`), `Image.alt` required (`StrictImageProps` stays as the alias, spec R3; keep the missing-`alt` development warning worded without "in 1.0"), TimePicker `format` (spec R3: `'12h'` on the server and first client render, then the browser language's hour cycle; an explicit `format` wins; tests with mocked `Intl`/`navigator.language`).

### Task 12: styles and token aliases
Rows: `legacy-tokens.css` (file, export `./legacy-tokens.css`, attw and pack-smoke lists), `animations.css`, the `.dark` and `.high-contrast` theme classes (tokens.css selectors, `getThemeClassName`, `verify-storybook`'s check, `.storybook` decorators, tests, README). Update `scripts/build-css.mjs` assertions and the Tailwind/plain fixtures that import them.

---

## Package D: `ref` on the focusable element (spec R5)

Common to Tasks 13 to 16: for each component, in a failing-test-first order: (1) `ref.current` is the control (`testSystemProps` with `ref: 'control'`), (2) `slotProps.root.ref` is the wrapper (`testRootPartRef`), (3) `controlRef` is removed (`@ts-expect-error` + a typed-ref mismatch), (4) a `root` part exists with the full part test set of Phase 13 (className/style/`data-*`/handlers land, enumerated `data-*` and `hidden` locked, `inert`/`aria-hidden` unset, click blocked while disabled where the root activates the control, markup identical without `slotProps` except the intended ref move), (5) the internal `rootRef` (dismiss, positioning) stays on the root and is merged with `slotProps.root.ref`, (6) inline refs per render leave form reset, HiddenInput `onInvalid` focus, popup positioning and dismiss, SearchBox's clear-then-focus working, (7) StrictMode attaches once and detaches on unmount, (8) inside a Field `ref.current.id === label.htmlFor`, (9) the owner is added to `SLOT_PROPS_ROOT_OWNERS` and `SlotPropsOwners`, (10) JSDoc, README/guide part tables, stories (`stories/_mountedOptions.tsx` `listOf` accepts the combobox itself). Existing `ref`/`controlRef` assertions are edited only for the move (list each). Commit subject `feat!: ref reaches the <control> of <components>`.

### Task 13: Checkbox, Switch, RadioGroup.Item
Root parts are `<label>`s; a click on the root `<label>` activates the button, so a `root` part's `onClick` plus the `disabledFocusable` `stopPropagation` path must still give one toggle per click (test it). RadioGroup.Item only gains `slotProps.root` (its `ref` already reaches the radio button).

### Task 14: SearchBox, SpinButton, ColorPicker.HexField, ColorSlider, AlphaSlider
SearchBox's root `onMouseDown` stays composed; SpinButton's props are a union (both forms); AlphaSlider's props derive from ColorSlider's; HexField is a part inside ColorPicker (form handling stays the picker's); sliders inside ColorPicker and standalone.

### Task 15: Combobox, Dropdown, TimePicker, DatePicker
Highest risk: the internal `rootRef` feeding the popup's dismiss and outside presses stays on the root; `ref` joins the control's merged ref with `setReference` (an inline ref re-attaches the floating reference as an inline `controlRef` did); generic `<M>` props of Combobox; the two windowed stories.

### Task 16: TagPicker
`ref` follows the trigger that renders (`registerTrigger`): `Ref<HTMLInputElement | HTMLButtonElement>`; reaches TagPicker.Button for the first time; the built-in form (no children) and the parts form; rename the context field `controlRef` to `controlElementRef`; TagPicker's own useFormReset(rootRef) stays internal.

### Task 17: integration and the behaviours that change with no code change
Integration tests in `src/__tests__/integration.test.tsx`: `Overflow.Item asChild` measuring through a mover child, `Presence` with a mover child, Tooltip/Popover/Menu triggers anchoring to a mover's control, a Field around each mover (`ref.current.id === label.htmlFor`); `public-types.test.ts` `ref`/`root` type assertions; flip `docs/FLUENT-UI-COMPARISON.md` §4.3. Commit `test: ref placement integration for 1.0`.

### Task 18: retire the inventory
All rows are `done`: delete `src/lib/deprecations.ts` and `src/__tests__/deprecations.test.tsx`, fix `integration.test.tsx` references and `TEST_ONLY_MODULES` in `scripts/verify-dist.mjs` (and its fixture test); keep `warnDeprecated`/`resolveDeprecatedProp`. Assert with a grep-style test that no removed name remains in `src`. Commit `chore: retire the 1.0 inventory`.

---

## Package F: utilities

### Task 19: F1a, the theme split, namespaced tokens and the two merge functions (prefix still off)

**Files:** `src/styles/theme.css` (new, internal: the unnamespaced `@theme inline reference` mapping moved out of `tokens.css`), `src/styles/tokens.css` (namespaced keys), `src/styles/__tests__/*`, `src/lib/cn.ts`, `src/lib/__tests__/cn.test.ts`, `scripts/build-css.mjs` (imports `theme.css`), `package.json` (`tailwind-merge` pinned exact).

**Interfaces:** Produces: public `cn` (unprefixed, knows `text-wave-*`, `shadow-wave-*`, `animate-wave-*`, `duration-wave-*`, `ease-wave-*`); module-only `wcn` with a `UTILITY_PREFIX` constant (empty in this task) that, when set, uses `prefix: 'wave'` plus an `experimentalParseClassName` that parses an unprefixed class as if it carried `wave:`, knows both the internal scales (`text-body-1`, `shadow-4`) and the namespaced ones (`text-wave-body-1`), and has `/* @__PURE__ */` on both merge configs (reference: `.superpowers/sdd/2026-11-02-fluent-parity-phase-14/spike-codemod/`); a test that fails if tailwind-merge's parsing changes; the token rules in `@layer theme`.

- [ ] Tests first (`cn.test.ts`: namespaced groups, `wcn` with a test-only prefix, the gate pitfall kept); then the CSS split; `tokens.test.ts` pins rewritten; `build-css` still produces the same `dist/styles.css` bytes with the prefix off (assert by hash before/after). Commit `feat(styles): namespaced theme keys and the prefix-aware merge`.

### Task 20: F1b, entries: `./tailwind`, `utilities.css`, the custom setup

**Files:** `src/styles/tailwind.css`, `src/styles/utilities.css` (new), `scripts/build-css.mjs`, `package.json` (`exports`: `./utilities` and `./utilities.css`, drop `./legacy-tokens.css` if Task 12 did not), `scripts/attw-pack.mjs` (`--exclude-entrypoints`), `scripts/pack-smoke.mjs` (`EXPORTED_SUBPATHS`, the Tailwind fixture), `scripts/fixtures/tailwind/*`, README setup sections.

**Interfaces:** Produces: a second build-css entry `dist/components.css` (the prefixed utilities and base without the token rules; spike Task 1 amendment) and `./tailwind` = `@layer theme, base, components, utilities; @import './tokens.css' layer(theme); @import './variants.css'; @import '../../dist/components.css' layer(components);` (the whole `./styles` sheet is NOT imported: it would put the token rules in the components layer); `utilities.css` in `@layer utilities` (bg, text, border, ring, fill, stroke, shadow, font, animate of the namespaced keys, no variants; ~50 KiB min); the custom setup redefined (spec R6): `./tokens` + `./variants` expose the namespaced theme and the `wave-rtl:` variant, components come from `./styles`/`./tailwind`. With the prefix still off these entries work on the unprefixed sheet, so the fixtures build; Task 21 flips them.

- [ ] Fixture tests first (pack-smoke builds plain, Tailwind and custom fixtures and asserts the generated CSS contains `bg-wave-primary` etc.); implement; checks including `npm run test:pack`; commit `feat(styles): the ./tailwind layered entry and utilities.css`.

### Task 21: F1c, the migration codemod and the AST codemod tool and compile check

**Files:** `codemod/migrate-1.0.mjs` (new, shipped; `package.json` `files`), `codemod/__tests__/*` (in the test glob), `scripts/prefix-codemod.mjs` (the AST tool from Task 1, repo-internal), `scripts/build-css.mjs` (compile check), lint/format/test globs, pack-smoke's no-scripts rule.

**Interfaces:** Produces: `node codemod/migrate-1.0.mjs [--include-shared] <globs>` rewriting an app's classes, `@apply` lines and `var(--color-*)` uses that named Wave's former unprefixed token utilities to the namespaced ones (list generated from the theme keys; the 17 names shared with shadcn only with `--include-shared`); `scripts/prefix-codemod.mjs <paths>` prefixing utility words in class contexts of `src` (AST-based: `cn`/`wcn`/`clsx` arguments, `className=`, recipe and `*Classes` maps, `withPartClass`, `lib/styles.ts`, `lib/motion.ts`), idempotent; a build-css compile check: compile `src` unprefixed and fail on any generated class outside the allowlist, active only when `UTILITY_PREFIX` is set. Per the spike the check reads string literals (not Tailwind's scanner, which also reads comments), and the allowlist is the 22 words `absolute blur border collapse container filter fixed grid group hidden inline list-item outline relative resize ring rounded select-all static table underline visible`; the AST tool is `.superpowers/sdd/2026-11-02-fluent-parity-phase-14/spike-codemod/prefix-codemod.mjs` (it also renames `cn` to `wcn` in `src/hooks/useCollapsePresence`, prefixes the `group`/`peer` markers, and has a `--check` mode).

- [ ] Tests first for both codemods on fixture inputs (false-positive cases: `'fixed'`, `'hidden'`, `'grid'` strings stay); implement; checks; commit `feat(codemod): the 1.0 utilities migration and the prefix tool`.

### Task 22: F2, the flip (one atomic commit)

**Files:** `src/**` (components, lib, hooks), every test and story, `.storybook/preview.css` and `preview.tsx` (a second, unprefixed consumer-style compile for stories), `scripts/verify-storybook.mjs`, `scripts/build-css.mjs` assertions (`REQUIRED_UTILITIES`, `wave-rtl` check, every utility starts with `wave:`, no theme variables), `scripts/verify-dist.mjs` (`RECORDED_IMPORTS_1_0`, `BASELINES_0_18_1`, folding the other budgets, spec R7), `scripts/fixtures`, `src/styles/styles.css`.

**Interfaces:** Produces: `UTILITY_PREFIX = 'wave'` (or `wv` per Task 1); every component class prefixed (`prefix-codemod`), tests classified (Wave's own classes prefixed; a consumer class a test passes in stays unprefixed; `querySelector('.x')` becomes `.wave\:x`); stories migrated with `migrate-1.0` and compiled through the unprefixed consumer-style sheet; budgets re-set from measurement.

- [ ] Run the codemods; fix what the compile check, the conventions gate, the tests and the stories a11y gate report; re-set the budgets; `dist/styles.css` growth recorded. Run EVERY gate (`/gate` equivalent: typecheck, lint, format, whole suite, build-storybook, build, verify-dist, check:package, test:pack). Report the diff size, the unprefixed leftovers found and fixed, the measured sizes table. Commit `feat!: namespace every utility the library draws`.

### Task 23: F3, the consumer browser pass of the flipped build

Repeat Task 1 Steps 3 and 4 on the real build (the pack-smoke fixtures), plus Menu, Tabs, Tooltip, TagPicker, DatePicker; fix nothing in this task (report FAILs with reproduction); the controller dispatches a fix. Evidence under `.playwright-mcp/`; report in `task-23-report.md`; no commit unless a fix is requested.

---

## Package G: docs

### Task 24: README, guide and testing guide
**Files:** `README.md` (requirements, install, styles, theming, the `ref`/`root` section, token utilities, ES-only note, removal of the "Global effects" workaround), `docs/WAVE-UI-GUIDE.md` (Customization chapter `ref` rows and part tables for the 13 new `root` parts, Pattern 5 and any chapter on utilities/tokens), `docs/testing-best-practices.md`. Every code sample type-checks against `src/index.ts` (throwaway file in the scratchpad). Commit `docs: 1.0 usage, ref and root parts, namespaced utilities`.

### Task 25: UPGRADING-TO-1.0, CHANGELOG 1.0.0, ROADMAP, CLAUDE.md, spec
**Files:** `docs/UPGRADING-TO-1.0.md` (final: ES-only text from the spec, ref move, utilities migration with the codemod, every removal row restated, default changes), `CHANGELOG.md` (`## [1.0.0] - Unreleased`: Upgrading from 0.18, Added, Changed, Removed, Size table with growth, known limits), `docs/ROADMAP.md` (Phase 14 "Built as", P14-01..06 closed, P14-04 superseded, status line left for the release commit), `CLAUDE.md` (the architecture, conventions C-REF/C-ROUTING/C-FORMS, C-TOKENS/Styling for the prefix and layers, Testing, ES-only, the semver commitment of spec R9, `RECORDED_IMPORTS_1_0`), spec §6 (implementation notes, rulings, edited assertions), the gap-id lines. The version in `package.json` stays 0.18.1 (the controller's release commit sets 1.0.0). Commit `docs: the 1.0.0 release notes and project docs`.

---

## After the last task (controller)

Final whole-branch review (most capable model, with an adversarial pass on the prefixed build, the `ref` moves and the `wcn` merge), one fix dispatch and one scoped re-review, the exit gate (`/gate`), the real-browser pass (spec §5, three engines), then `superpowers:finishing-a-development-branch`. The release (`package.json` 1.0.0, CHANGELOG date, merge, tag `v1.0.0`, publish) needs the maintainer's explicit go-ahead.

---

## Plan rulings

1. Tasks are sequential; Task 1 gates F (NO-GO switches F to theme-key namespacing plus a layered sheet).
2. E before D (E's rows touch the same files), F1 after D and E, F2 atomic.
3. The inventory (`src/lib/deprecations.ts`) is the checklist of Package E; Task 18 retires it.
4. Size budgets are untouched until Task 22 (a small interim allowance only if a D task exceeds a margin, recorded in spec §6).
