# Phase 13 (0.18.0) Implementation Plan: customization surface and 1.0 notices

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let apps style and extend WaveUI components without forking them (structural `slotProps` on every component part, render-function slot children, a native-props helper, Field's function child, narrow public hooks for Field, RadioGroup, Menu, MessageBar and DataGrid), and announce everything 1.0 will change (runtime warnings, CHANGELOG deprecations, an inventory test, the "Upgrading to 1.0" draft).

**Architecture:** Pure, server-safe helpers in `src/lib` (`slotProps`, `nativeProps`, `slotParts` exclusions); one `renderSlot` change gives every existing slot render-function children; components declare a `slotProps` object keyed by the class-name registry's part keys and spread `mergeSlotProps` on each part; a registry-driven completeness gate makes the rollout mechanical; public context hooks are narrow views over the existing internal contexts; an inventory test ties the deprecation table to the code.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + React Testing Library + vitest-axe, Vite library build. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-30-fluent-parity-phase-13-design.md` (rulings R1–R24, §1–§12). Read it and `CLAUDE.md` first; the spec wins where this plan is silent. Work in `.claude/worktrees/fluent-parity-phase-13` (branch `feat/fluent-parity-phase-13`); the `node_modules` junction exists. Run every command in the foreground. IDE diagnostics about missing jest-dom matchers or unresolved modules are stale noise: `npm run typecheck` is the arbiter.

## Global Constraints

- Version 0.18.0; CHANGELOG section `## [0.18.0] - Unreleased` above `## [0.17.1]` (created in Task 6 with its "Deprecated" subsection, completed in Task 22; other tasks add nothing there). The release commit dates it and bumps the version.
- Nothing public is removed; every type only widens (`FieldProps['children']`, `SlotObject['children']`). **No behaviour change for a component whose consumer passes no `slotProps`**: markup byte-identical (a test per rolled-out component, R5/§3.2). Existing suites stay green unedited except assertions that pin the exact props of a changed type; each edit is listed in spec §11 by the task that makes it.
- R1/R2: one `slotProps` object per component keyed by the registry's part keys; existing named slots are not duplicated. R5: className consumer-last, style merged, `on*` handlers consumer-first and cancellable (`composeEventHandlers`), refs merged, locked attributes win, no `children` on structural parts. R4/R7: exclusions are data with a reason; the gate checks every registry key. R11: public contexts are wrapper functions and narrow views, never the context objects; required hooks call `reportMissingContext`; optional ones (Field) return `null`.
- C-NAMING: `slotProps`, `Props` suffixes; C-CLASS: no new class names (the registry already has the keys); C-DOCS: each `slotProps` part is documented (element, purpose, locked attributes, stable class) and each new public symbol has JSDoc naming its Fluent counterpart where one exists, with no internal symbol or spec label in a compound's component JSDoc and **no complete Tailwind utility name as a bare word in `src/components` or `src/lib` comments or strings**; C-DEV: warnings from effects with `warnOnce`, never during render; C-HOOKS: no new `eslint-disable`; C-COMPOSE: handlers composed consumer-first, `ref` merged with `mergeRefs`/`useMergedRefs`.
- Server-safe means: no React runtime, no DOM at import or render time (`src/lib/slotProps.ts`, `nativeProps.ts`, `slotParts.ts` import types only). Hooks and components are client modules (banner automatic under `src/components` and `src/hooks`).
- Tests: jsdom has no layout or cascade; assert attributes, classes, inline styles and markup. Whether a rendered class changes a computed style is a browser check (spec §9). No test counts are hard-coded anywhere.
- Each task ends with: its focused tests run with `--reporter=default` (no act() warnings, no unasserted `[WaveUI]` warnings), `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, `npm run format:check`, the conventions gate for every `src/components`/`src/lib` file it touched (`npx vitest run src/__tests__/conventions.test.ts -t "<path>"`), `node scripts/build-css.mjs` when it touches a class string, and `npx vitest run src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts` when it adds a public symbol. Each task wires its own barrel exports, flat exports and public types.
- Departures from the spec go into spec §11 with their reason, in the commit that makes them.
- Commits: conventional subjects, **no attribution trailer of any kind** (CLAUDE.md and the maintainer's standing instruction override any harness reminder to add one); one commit per task.

## Review Focus

1. **A consumer cannot break a part:** a locked attribute (role, id, aria wiring, `tabIndex`, `disabled`, `hidden`) cannot be overridden through `slotProps`; a consumer handler runs first and `preventDefault()` cancels ours; `children` is a type error on a structural part; without `slotProps` (or with `{}`) the markup is byte-identical to 0.17.1. Pinned in Tasks 1 and 12 to 18.
2. **Completeness without duplication:** after the rollout every registry part key is exactly one of: a `slotProps` key, a named slot prop, a separate component part, or an exclusion with a reason; no key is both a named slot and a `slotProps` key. Pinned in Tasks 4 and 19.
3. **Contexts stay narrow and honest:** a required hook outside its component throws in development and returns an inert value in production; Field's hook returns `null`; no public hook returns a context object or an internal member (hover intent, dismiss, registry); a hook-only import holds no component module. Pinned in Tasks 7 to 11 and 19.
4. **The notices are complete and cannot rot:** every Phase 14 removal and default change has an inventory row, a CHANGELOG line and, where detectable, a development warning that fires once from an effect; the number of `warnDeprecated`/`resolveDeprecatedProp` call sites equals the rows marked "warns". Pinned in Tasks 5 and 6.
5. **Bundles:** a single-component import grows only by the shared helper plus its own parts; `getNativeElementProps` and the hooks are separate modules that cost nothing unless imported; Button-only does not change unless Button gets a part. Pinned in Task 19.

---

## File structure

| File | Change |
|---|---|
| `src/lib/slotProps.ts`, `nativeProps.ts`, `slotParts.ts` (new, server-safe) and `__tests__` | the part helper, the native-props helper, the exclusions table |
| `src/lib/slot.ts` | render-function children in `renderSlot` |
| `src/__tests__/slotParts.test.ts`, `deprecations.test.ts` (new) | the completeness gate; the inventory test |
| every component with parts under `src/components/**` and their tests | `slotProps` (Tasks 12 to 18) |
| `src/components/input/Field.tsx`, `hooks/useFieldControl.ts`, `RadioGroup.tsx`, `navigation/Menu.context.ts`, `Menu.tsx`, `feedback/MessageBar.tsx`, `table/DataGrid.*` | the context hooks and the Field function child (Tasks 7 to 11) |
| `src/components/data-display/Badge.tsx`, `CounterBadge.tsx`, `hooks/useRovingTabIndex.ts`, `table/DataGrid.tsx`, `lib/motion.ts` | the four development warnings (Task 5) |
| `src/lib/classNames.ts`, `src/index.ts`, barrels, `src/__tests__/*`, `scripts/verify-dist.mjs` | exports, probes, budgets, integration |
| `stories/*`, `README.md`, `CHANGELOG.md`, `docs/UPGRADING-TO-1.0.md` (new), `docs/WAVE-UI-GUIDE.md`, `docs/ROADMAP.md`, `CLAUDE.md`, `docs/testing-best-practices.md` | stories and docs |

---

## Package A: CORE

### Task 1: the part helper (`src/lib/slotProps.ts`)

**Files:** Create `src/lib/slotProps.ts`, `src/lib/__tests__/slotProps.test.ts`; modify `src/index.ts`, `src/__tests__/public-types.test.ts`.

**Produces** (spec §3.1; server-safe, imports `cn`, `composeEventHandlers`, `mergeRefs` and types only):
```ts
export type SlotPart<E extends keyof React.JSX.IntrinsicElements> =
  Omit<React.ComponentPropsWithRef<E>, 'children' | 'className' | 'style'> & { className?: string; style?: React.CSSProperties } & { [K in `data-${string}`]?: string | number | boolean | undefined };
export interface SlotPartOwn { className?: string; style?: React.CSSProperties; ref?: React.Ref<any>; defaults?: Record<string, unknown>; locked?: Record<string, unknown> }
export function mergeSlotProps(part: SlotPart<any> | undefined, own: SlotPartOwn): Record<string, unknown>;
```
Rules (R5): result = `{ ...own.defaults, ...part-without-className/style/ref/handlers, <composed handlers>, className: cn(own.className, part.className), style: { ...own.style, ...part.style } (omitted when both empty), ref: merged, ...own.locked }`. For every key starting `on` followed by a capital where both sides are functions: `composeEventHandlers(part[key], own.defaults?.[key] ?? own.locked?.[key])` (consumer first, `preventDefault()` skips ours); a handler only on one side passes through; a locked handler is still composed (the consumer's runs first), never replaced. `part` undefined returns `{ ...own.defaults, className, style, ref, ...own.locked }` and **nothing else**. A function-valued part prop that is not a handler is replaced like any attribute. `ref`: both present → `mergeRefs(own.ref, part.ref)`; one present → it.

- [ ] **Step 1 (tests first):** no part and `{}` give identical output (markup equality input); className order (`own` then consumer); style keys (consumer wins, empty omitted); handler order (consumer first, `preventDefault` skips ours, both-sided locked handler composed, handler only on the consumer side); ref merge (callback and object refs, either side alone); a default is overridden by the consumer; a locked attribute is not (role, id, `tabIndex`, `disabled`, `hidden`, `aria-*`); `data-*` passes; `children`/`as` in a part is a type error and ignored at run time (`// @ts-expect-error` + a runtime test that it is not forwarded); `expectTypeOf` for `SlotPart<'span'>` and `SlotPart<'input'>` (an `input` part accepts `placeholder`, a `span` part does not); no runtime import except `cn`/`composeEventHandlers`/`mergeRefs` (read the import lines); `renderToString` safe. RED.
- [ ] **Step 2:** implement; export `SlotPart` (type), `mergeSlotProps` and `SlotPartOwn` from the entry; update `public-types.test.ts`. **Step 3:** verification list. **Step 4:** record the minified+gzip size of the module (build, then the probe style of `verify-dist`) in the report; target at most 0.4 KiB gzip.
- [ ] **Step 5: Commit** `feat(slots): mergeSlotProps and the SlotPart type`.

### Task 2: render-function children on slot objects

**Files:** Modify `src/lib/slot.ts`, `src/lib/__tests__/slot.test.ts`; the slot-family component tests only to add one case each.

**Produces** (spec R8, §3.3): `export type SlotRenderFunction<Props> = (Component: React.ElementType<Props>, props: Omit<Props, 'as'>) => React.ReactNode;` and `SlotObject<E>['children']` widened to `React.ReactNode | SlotRenderFunction<...>`. `renderSlot` (and `resolveSlot` where it builds the object) calls the function with the element type (the tag after `as`) and the fully merged props (default props, slot props, merged className, ref), wrapping the result in a Fragment; a function counts as content for `slotRendersContent`/`materialiseSlotContent`/`slotWrapsDefaultContent`. A function child on a slot whose component wraps default content (dismiss/clear) is passed the default content through `props.children`.

- [ ] **Step 1 (tests first):** `renderSlot` with a function child: receives `'span'` and merged props (className contains the base and the slot class; `aria-hidden` kept; `ref` present), result rendered; `as` changes `Component`; a function returning `null` renders nothing and counts as "renders nothing" for the optional-indicator rule; one case each through a real icon slot (Button `icon`), a dismiss slot (Tag `dismissIcon`), a media slot (Avatar or Table.CellLayout `media`), `Dialog.Content closeButton` and `backdrop`, and a motion-free `Nav.Category expandIcon`; the existing slot suites pass unedited. RED.
- [ ] **Step 2:** implement; export `SlotRenderFunction` from the entry; update `public-types.test.ts`. **Step 3:** verification list, `npx vitest run src/lib src/components/button src/components/overlays src/components/data-display`.
- [ ] **Step 4: Commit** `feat(slots): render-function children for slot objects`.

### Task 3: `getNativeElementProps`

**Files:** Create `src/lib/nativeProps.ts`, `src/lib/__tests__/nativeProps.test.ts`; modify `src/index.ts`, `src/__tests__/public-types.test.ts`.

**Produces** (R9, server-safe, own module):
```ts
export function getNativeElementProps<P extends Record<string, unknown>, E extends keyof React.JSX.IntrinsicElements>(tag: E, props: P, excludedNames?: readonly (keyof P & string)[]): Partial<React.JSX.IntrinsicElements[E]> & { [K in `data-${string}`]?: unknown };
```
Keeps: the global attributes (id, className, style, title, lang, dir, hidden, role, tabIndex, draggable, contentEditable, spellCheck, translate, accessKey, slot, inert, popover), every `on*` event handler, `data-*` and `aria-*`, `ref` and `key`; plus per-tag extras for `a`, `button`, `div`, `img`, `input`, `label`, `li`, `ol`, `option`, `select`, `span`, `table`, `tbody`/`thead`/`tfoot`, `tr`, `th`, `td`, `textarea`, `ul`; an unknown tag gets the global set; `excludedNames` removes keys; keys not in the lists (component-only props) are dropped.

- [ ] **Step 1 (tests first):** per supported tag, a table test: valid attributes kept (input: `type`, `value`, `checked`, `placeholder`, `required`, `min`, `max`, `step`, `pattern`, `form`, `name`; a: `href`, `target`, `rel`, `download`; button: `type`, `disabled`, `form*`; img: `src`, `alt`, `loading`...), a component-only prop dropped (`appearance`, `slotProps`, `onValueChange`), `data-*`/`aria-*` kept, `excludedNames`, `ref` kept; the global set for an unknown tag; `expectTypeOf` for the return type; `renderToString`/server-safe (no React import); a test that the lists contain no key that React warns about on its tag (render each tag with every kept key set and assert no console output). RED.
- [ ] **Step 2:** implement; export from the entry with a JSDoc naming Fluent's `getIntrinsicElementProps`; public types. **Step 3:** verification list; size probe (own module: report the minified+gzip).
- [ ] **Step 4: Commit** `feat(slots): getNativeElementProps`.

### Task 4: exclusions, the completeness gate and the checklist

**Files:** Create `src/lib/slotParts.ts`, `src/__tests__/slotParts.test.ts`, `docs/superpowers/plans/2026-10-30-fluent-parity-phase-13-slot-checklist.md`; modify `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` (one-line pointer at Appendix A).

**Produces:** `SLOT_PART_EXCLUSIONS: readonly { component: string; key: string; reason: string }[]` (server-safe, tests-only consumer) and the test (R7): for every `*ClassNames` constant in `src/lib/classNames.ts` (import the module), each non-`root` key must be exactly one of (a) a `slotProps` key of its component, discovered through a machine-readable map `SLOT_PROPS_KEYS: Record<constantName, readonly string[]>` exported from `slotParts.ts` and filled by each rollout task (empty at the start), (b) a named slot prop (a map `NAMED_SLOT_PARTS: Record<constantName, readonly string[]>`, generated now by scanning `Slot<`/`SlotObject<`/`MotionSlot` props whose names match part keys, reviewed by hand), (c) a separate-component part (the constant belongs to the part's own component: keys of a constant whose name is a compound part's are checked against `Parts.<Name>`), (d) an exclusion with a reason, or (e) listed in `PENDING_SLOT_PARTS: Record<constantName, readonly string[]>` (the pending list; must shrink to empty at Task 19). A key in both (a) and (b) fails (R2). The test also fails on an exclusion whose key no longer exists, on a pending key that is already resolved, and on an unknown constant.

- [ ] **Step 1 (tests first):** write the gate against the empty maps (everything pending would be 363 entries, so first generate): **Step 2:** write a throwaway script in the scratchpad (never in the repo) that reads the registry and the sources and produces the initial `NAMED_SLOT_PARTS`, `SLOT_PART_EXCLUSIONS` (virtual spacers, motion collapse elements, positioners, viewports, measuring probes, each with a one-line reason; justify every entry against the component source) and `PENDING_SLOT_PARTS` (everything else); commit them as data in `slotParts.ts`. **Step 3:** write the checklist markdown from the same data: per group D1 to D7 (spec §8) a table of component, key list, element, and the exclusions, which is the work list of Tasks 12 to 18; the controller splits a group into consecutive tasks of at most 8 components when its list is longer. **Step 4:** the gate passes with the pending list full. Add the pointer to Appendix A ("superseded by the registry and `src/__tests__/slotParts.test.ts`"). **Step 5:** verification list; the gate's failure messages name the component and key.
- [ ] **Step 6: Commit** `test(slots): the completeness gate for slot parts`.

---

## Package B: NOTICES (P13-03)

### Task 5: the four development warnings

**Files:** Modify `src/components/data-display/Badge.tsx`, `CounterBadge.tsx`, `src/hooks/useRovingTabIndex.ts`, `src/components/table/DataGrid.tsx`, `src/lib/motion.ts` (the `[presence=` compatibility rule's caller: find where `usesLegacyMotion` is consulted), their tests.

**Produces** (spec §6.1; each from an effect with `warnOnce`, never during render; keys prefixed with the component):
- Badge and CounterBadge `color="important"` (Badge.tsx ~59–66, CounterBadge.tsx ~73–84): `Badge:color:important` — "color=\"important\" changes meaning in 1.0 (neutral, high emphasis); pass color=\"severe\" to keep the orange look." (own message; **not** `warnDeprecated`'s "removed in 1.0" wording).
- `useRovingTabIndex(ref, options)` positional form (hooks/useRovingTabIndex.ts ~946): `warnDeprecated('useRovingTabIndex', 'positional arguments', 'the options object')` (check the actual signature and the 0.x replacement in the CHANGELOG before writing the message).
- DataGrid positional `onSortChange` (DataGrid.tsx ~923): `warnDeprecated('DataGrid', 'onSortChange(columnId, direction)', 'onSortChange(sort, details?)')` — check the code for what "positional" means and fire only for that shape.
- The `[presence=` className compatibility rule (`usesLegacyMotion`): one warning per part kind (`Menu.Popover`, `Dialog.Content`, Drawer, NavDrawer) naming the replacement (`motion`).

- [ ] **Step 1 (tests first):** each warning fires **once** (a second render and a second instance add none), from an effect (nothing logged during render: render with a console spy and assert before `act` flushes effects where possible, or assert via `renderToString` that the server path logs nothing), only in development (`vi.stubEnv('NODE_ENV','production')` logs nothing), and does not fire for the supported form; the exact message text is asserted and nothing else is logged; the supported forms' existing tests pass unedited. RED. **Step 2:** implement. **Step 3:** verification list; the stories a11y gate for Badge and DataGrid.
- [ ] **Step 4: Commit** `feat: development warnings for what 1.0 changes or removes`.

### Task 6: the inventory, the CHANGELOG announcements and the 1.0 guide draft

**Files:** Create `src/__tests__/deprecations.test.ts`, `src/lib/deprecations.ts` (the data table, tests-only consumer, server-safe), `docs/UPGRADING-TO-1.0.md`; modify `CHANGELOG.md`, `docs/ROADMAP.md`, `README.md`.

**Produces** (spec §6.2, §6.3, R18–R22):
- `DEPRECATIONS: readonly { id; item; sinceVersion; kind: 'removed' | 'default-changes' | 'required'; warns: boolean; warningKey?: string; changelogAnchor: string; replacement: string; file: string }[]`: one row per removal and default change Phase 14 makes, built from `scratchpad/p13-contexts-deprecations-survey.md`'s 52 rows reconciled with P14-02 (R21: add every row the roadmap omits: the tag-picker legacy classes, the Slider numeric `size`, and any row the survey marks "not named by P14-02"), plus the default changes (TimePicker `format`, R20), the required `details` parameters (including the six that were never announced: AvatarGroup `onOpenChange`; `onColumnWidthsChange`; `Table.ResizeHandle onResize`; `useTableSort`, `useSelection`, `useTableColumnSizing`; FlatTree and `useFlatTree` `onCheckedItemsChange`), `Image.alt` required, Badge `important`, and the ref decision (R19, kind `decided`, nothing removed).
- The test: every row's `changelogAnchor` text exists in `CHANGELOG.md`; every row with `warns: true` has its warning exercised (the test imports the cases from the component tests' helpers or renders the minimal case itself) and fires once; **the number of `warnDeprecated`/`resolveDeprecatedProp` call sites in non-test `src` equals the count of rows with `warns: true` and `kind: 'removed'`** (grep the sources at test time with `import.meta.glob` raw imports), so a new alias without a row fails; no row names a file that does not exist.
- `CHANGELOG.md`: `## [0.18.0] - Unreleased` (intro placeholder sentence, completed in Task 22) with `### Deprecated` listing the announcements of spec §6.2, one line per row group, each line naming the version that announced it and the 0.x replacement.
- `docs/UPGRADING-TO-1.0.md`: the migration table (one row per `DEPRECATIONS` row: before, after, announced in), the default changes, the decided items (ref placement: no change), how to find warnings in development; linked from README (a "1.0 notices" pointer) and the CHANGELOG.
- `docs/ROADMAP.md`: P14-02's scope completed (R21), P14-04 closed as "decided: keep, announced in 0.18" (R19), P14-06 reworded (R20: `format`, not `hourCycle`), Phase 13's "Built as" placeholder deferred to Task 22.

- [ ] **Step 1 (tests first):** write the test and the table skeleton; RED (CHANGELOG and warnings missing). **Step 2:** fill the table from the survey (verify each row's file and line against the code, fixing stale survey line numbers), write the CHANGELOG, the guide draft and the ROADMAP corrections; the call-site count assertion must pass. **Step 3:** verification list plus `node scripts/check-release.mjs v0.18.0` (expected to fail only on version and "Unreleased"; report the exact output).
- [ ] **Step 4: Commit** `docs: announce what 1.0 changes, with an inventory that cannot rot`.

---

## Package C: CONTEXTS (P13-02)

### Task 7: Field's function child, `FieldContextProvider` and `useFieldContext`

**Files:** Modify `src/components/input/Field.tsx`, `src/hooks/useFieldControl.ts`, `src/index.ts`, tests `Field.test.tsx`, `src/__tests__/integration.test.tsx`; stories `Field.stories.tsx`.

**Produces** (R10, R12): `FieldProps['children']: React.ReactNode | ((props: FieldControlProps) => React.ReactNode)`; `export interface FieldControlProps { id?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; 'aria-required'?: boolean }` (read what `useFieldControl` returns for a labelable control and match its keys exactly); a function child is called with those props computed as Field already computes them for its clone, and its result is rendered inside the provider **without cloning**; element children are unchanged (the existing clone path and its tests untouched). `FieldContextProvider` (a wrapper function component taking `{ value: FieldContextValue; children }`, the `ListboxProvider` pattern: the context object stays internal) and `useFieldContext(): FieldContextValue | null` exported from the entry; the existing internal `useFieldContext` is the same function.

- [ ] **Step 1 (tests first):** a function child receives the five props (label `for`/`aria-labelledby` wiring, `aria-describedby` joined with the hint and validation message ids, `aria-invalid` only in the error state, `aria-required` when required); a plain third-party `<input>` rendered by the function is labelled (RTL `getByLabelText`), described, and invalid; the first control claims `id`, a second control in the same Field does not (the existing rule); a function child under `validationState="warning"` has no `aria-invalid`; element children unchanged; `useFieldContext()` returns `null` outside a Field and the value inside; `FieldContextProvider` makes a custom control see a test value; StrictMode; RSC `renderToString`; types (`expectTypeOf` for the function child). RED.
- [ ] **Step 2:** implement; story **Field with a function child** (a native `<input>` and a third-party-like control) in `stories/Field.stories.tsx`; docs JSDoc naming Fluent's render-function child. **Step 3:** verification list, stories a11y `-t "Field"`.
- [ ] **Step 4: Commit** `feat(field): function child, FieldContextProvider and useFieldContext`.

### Task 8: RadioGroup context and `useRadioGroupItem`

**Files:** Modify `src/components/input/RadioGroup.tsx` (+ a `RadioGroup.context.ts` if the file is large), `src/index.ts`, tests, `stories/RadioGroup.stories.tsx`.

**Produces** (R13): `useRadioGroupContext(): { value: string | undefined; disabled: boolean; select(value: string): void }` (required, `reportMissingContext('useRadioGroupContext', 'RadioGroup')`, inert value in production) and `useRadioGroupItem(value: string, options?: { disabled?: boolean }): { props: { role: 'radio'; 'aria-checked': boolean; 'aria-disabled'?: boolean; tabIndex: number; 'data-roving-value': string; onClick: ...; onKeyDown: ...; }; checked: boolean; disabled: boolean }` — the exact prop set the built-in `RadioGroup.Item` spreads on its radio element so the group's roving scan (`data-roving-value`, `role`) and arrow navigation work for a custom element; `RadioGroup.Item` itself is rebuilt on the hook only if that is a no-op refactor (otherwise leave it).

- [ ] **Step 1 (tests first):** the context value inside a group; throw in development and inert value in production outside; `useRadioGroupItem` returns the documented props; a custom card using them is reachable by arrow keys (LTR and RTL via `renderWithProviders(ui, { dir: 'rtl' })`), Space selects, `aria-checked` tracks, a disabled card is skipped, the group's `onValueChange` fires once (StrictMode); the built-in items are unchanged (existing suite unedited). RED.
- [ ] **Step 2:** implement; story **Custom radio card**. **Step 3:** verification list, stories a11y `-t "RadioGroup"`.
- [ ] **Step 4: Commit** `feat(radio): useRadioGroupContext and useRadioGroupItem for custom items`.

### Task 9: Menu hooks

**Files:** Modify `src/components/navigation/Menu.context.ts` (or the smallest module that owns the values), `Menu.tsx` re-exports, `src/index.ts`, tests, `stories/Menu.stories.tsx`.

**Produces** (R14): `useMenuContext(): { open: boolean; close(): void; isSubmenu: boolean }` and `useMenuListContext(): { hasIcons: boolean; hasCheckmarks: boolean }`, both required (`reportMissingContext`), built from the existing internal contexts without exposing them (a mapper function, memoised); `close()` closes the menu the way an item activation does (innermost submenu first, focus returned as the built-in item does). Determine whether `Menu.Item` supports `asChild`; if it does not, the custom item story composes `Menu.Item` with its `as`/render form that exists, and the spec §11 note records which. **No new internal is frozen**: assert in a test that the returned objects have exactly those keys.

- [ ] **Step 1 (tests first):** values inside a menu (open state, `isSubmenu` inside a submenu, `hasIcons`/`hasCheckmarks` from the list), missing-provider behaviour, `close()` closes and returns focus to the trigger (`honourInert()` then focus assertion per the repo's overlay-focus rule), the exact key sets, a custom item reached by arrows and typeahead and closing on Enter, StrictMode, `asClientReference`. RED.
- [ ] **Step 2:** implement; story **Custom menu item**. **Step 3:** verification list, stories a11y `-t "Menu"`.
- [ ] **Step 4: Commit** `feat(menu): useMenuContext and useMenuListContext`.

### Task 10: MessageBar hook

**Files:** Modify `src/components/feedback/MessageBar.tsx`, `MessageBar.parts.tsx`, `src/index.ts`, tests, `stories/MessageBar.stories.tsx`.

**Produces** (R15): `useMessageBarContext(): { intent: 'info' | 'success' | 'warning' | 'error'; layout: 'singleline' | 'multiline' }` (required; the **resolved** layout, after the auto-reflow decision of `useMessageBarReflow`, so a child can adapt to the layout actually rendered). MessageBar's existing context (placement only) gains the two members internally; the public hook returns exactly those two.

- [ ] **Step 1 (tests first):** intent per prop and default, layout `multiline` when `layout="multiline"` and after a mocked reflow to multiline (`installResizeObserverMock`, stubbed widths, then `trigger`), missing-provider behaviour, exact key set, a custom action reading both, `MessageBarGroup` bars each get their own, re-render only on change (memoised value). RED.
- [ ] **Step 2:** implement; story **MessageBar with an intent-aware action**. **Step 3:** verification list; MessageBar-only import size recorded (the probe) for Task 19.
- [ ] **Step 4: Commit** `feat(message-bar): useMessageBarContext`.

### Task 11: DataGrid hooks

**Files:** Modify `src/components/table/DataGrid.context.ts` (or a new `DataGrid.hooks.ts`), `DataGrid.tsx`, `src/components/table/index.ts`, `src/index.ts`, tests, `stories/DataGrid.stories.tsx`.

**Produces** (R16): `useDataGridSort(): { sort: DataGridSort | null; setSort(sort: DataGridSort | null): void }`, `useDataGridSelection(): { selectedItems: readonly string[]; isSelected(id: string): boolean; toggle(id: string): void }`, `useDataGridRowId(): string` (inside a `DataGrid.Row`), all required, built from the existing `DataGridSortContext`, `DataGridContext` (selection) and `DataGridRowIdContext` (give the last the same missing-provider report). `toggle` goes through the grid's own selection handler so `onSelectedItemsChange` fires once with `details`; `setSort` goes through `onSortChange` the same way (respecting controlled mode).

- [ ] **Step 1 (tests first):** each hook inside a grid and row (controlled and uncontrolled), missing-provider behaviour for all three, `toggle` honours `selectionMode` and disabled selection, `setSort` fires `onSortChange` once, exact key sets, a custom cell story smoke, windowed grid (`virtualWindow`) still reports selection outside the window, StrictMode. RED.
- [ ] **Step 2:** implement; story **DataGrid with a custom cell**. **Step 3:** verification list, stories a11y `-t "DataGrid"`.
- [ ] **Step 4: Commit** `feat(data-grid): useDataGridSort, useDataGridSelection and useDataGridRowId`.

---

## Package D: ROLLOUT (P13-01)

Tasks 12 to 18 share one recipe. **Per task:** work through the group's rows of `docs/superpowers/plans/2026-10-30-fluent-parity-phase-13-slot-checklist.md` (made in Task 4); the controller splits a group whose list exceeds 8 components into consecutive tasks of at most 8 (a ledger ruling). **For each component:**

1. In `src/lib/slotParts.ts` move the component's keys from `PENDING_SLOT_PARTS` to `SLOT_PROPS_KEYS` (the gate fails until the component declares them).
2. Add `slotProps?: { <part>?: SlotPart<'<element>'> ... }` to the Props interface with JSDoc per part (the element, its purpose, its **locked attributes**, the stable class from the registry), `@default` none; destructure it; spread `mergeSlotProps(slotProps?.<part>, { className: cn(<xClassNames.part>, <existing classes>), ref, defaults, locked })` on each part element, preserving the existing class order and all existing attributes (**the markup without `slotProps` must stay byte-identical**).
3. Input special case (R6): `root` and `input` both apply to the single element when there are no content slots, `input` after `root`.
4. Tests in the component's test file, one `describe('slotProps')`: markup identical with `undefined` and `{}` (compare `container.innerHTML`); for each part: className/style/`data-*` land on the element and the stable class stays; a ref reaches it; a consumer handler runs first and `preventDefault()` cancels the internal one (parts with handlers); a locked attribute cannot be overridden (try `role`, `id`, `tabIndex`, `disabled` as relevant); `// @ts-expect-error` for `children` on a structural part; the part is absent when the component does not render it (no crash); StrictMode once-only callbacks; RTL where the component is directional.
5. Types: `expectTypeOf<Props['slotProps']>()` has exactly the part keys.

Common to every rollout task: focused suites for the group's components, the conventions gate for every touched file, `npx vitest run src/__tests__/slotParts.test.ts`, the stories a11y gate for the group (`-t "Components/<Category>"`), `npm run build` + a size line per component (single-import minified+gzip before and after, recorded in the report), commit `feat(<category>): slotProps for <components>`.

### Task 12: D1 form basics
Switch, Checkbox, RadioGroup/Radio items, Input, Textarea, Select, Slider, SpinButton, Rating/RatingDisplay, Label/InfoLabel, Field's parts (the rows of the checklist's group D1).

### Task 13: D2 pickers
Combobox, Dropdown, Listbox/Option parts, TagPicker, SearchBox, TimePicker, DatePicker, Calendar (group D2; split if the list exceeds 8).

### Task 14: D3 other inputs
ColorPicker parts, swatch pickers, ToggleButton/SplitButton/Menu button family, and every remaining input constant (group D3; split by the 8-component rule).

### Task 15: D4 overlays
Dialog, Drawer/NavDrawer, Popover, Menu popover and items, Tooltip, TeachingPopover, InfoButton, Toast/Toaster (group D4). **After this task** the controller re-sets the `WaveProvider + Dialog` budget from the measured figure plus a stated margin as a ledger ruling (R23).

### Task 16: D5 navigation
TabList, Tree/FlatTree, Nav, Breadcrumb, Pagination, Stepper, Accordion, Overflow, Toolbar, Link-like parts (group D5; split by the 8 rule).

### Task 17: D6 layout and data display
Card, Avatar, AvatarGroup, Persona, Carousel, List, Image, Badge/CounterBadge, Divider, Stack-like layout parts (group D6; split by the 8 rule).

### Task 18: D7 table, feedback, typography
Table (static parts), DataGrid, MessageBar, Spinner, ProgressBar, Skeleton, Text and the rest (group D7). **Then** the pending list in `slotParts.ts` must be empty except documented cut-line entries (spec §8); if the cut line is taken, the controller records the ruling and the remaining keys stay in `PENDING_SLOT_PARTS` with a `// 0.18.x` note, and Task 19 keeps the pending allowance.

---

## Package E: INTEGRATION and DOCS

### Task 19: integration, dist probes and budgets

**Files:** Modify `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/slotParts.test.ts` (empty the pending list), `scripts/verify-dist.mjs` (+ `scripts/__tests__`).

**Produces:** (a) integration: Server Component regressions (`renderToString` with `asClientReference` parts) for a component with `slotProps` per category, `mergeSlotProps`, `getNativeElementProps`, `useFieldContext` (null outside), a Field with a function child around a native input, a `RadioGroup` of custom cards, a `Menu` with a custom item, a `MessageBar` with an aware child, a `DataGrid` with a custom cell; the barrel test lists the new flat names; (b) `verify-dist`: new flat names; **hook-only and helper-only probes** following `HOOK_PROBES_0_17` (`getNativeElementProps`-only holds no component module; `mergeSlotProps`-only holds no component module; each new hook-only import holds its component's context module only as the hook's closure needs, and no `Dialog`/`Menu` popover code), **exclusion probes** (a Button-only import holds neither `slotProps` helper nor any hook of this phase unless Button gained a part; a Dialog-only import holds no DataGrid hook), the budgets: `RECORDED_IMPORTS_0_18` holds the 0.17.1 baselines and the measured single-import growth recorded per component class with the allowance stated in spec §5 (shared helper ≤ 0.4 KiB gzip, per rolled-out component ≤ 150 B gzip, Button-only unchanged unless noted), and the re-set `WaveProvider + Dialog` budget (R23); `MODULE_ONLY_NAMES` gains `SLOT_PART_EXCLUSIONS`, `SLOT_PROPS_KEYS`, `NAMED_SLOT_PARTS`, `PENDING_SLOT_PARTS`, `DEPRECATIONS` if they appear in `dist` (they are tests-only modules: assert they are absent from `dist`); (c) the pending list is empty (or carries the recorded cut-line entries).

- [ ] **Step 1:** write the tests and probes (RED where a probe cannot yet pass). **Step 2:** make them pass (fix imports that leak a hook or helper into a component bundle). **Step 3:** `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run test:pack`. **Step 4:** record the measured sizes in spec §11. If a budget is exceeded, STOP and report; do not raise a budget on your own.
- [ ] **Step 5: Commit** `test: integration, dist probes and bundle budgets for 0.18`.

### Task 20: the customization docs

**Files:** `README.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`.

- [ ] **Step 1: README** "Slots" chapter rewritten (the exit criterion): the three mechanisms side by side (named slots for leaves, `slotProps` for structure, render-function children), the merge rules (R5) in one table, locked attributes principle, `getNativeElementProps`, Field's function child, the context hooks with one example each, the `ref`/`controlRef` decision (R19), what is not customizable (exclusions) and why; a "1.0 notices" pointer. **Step 2: guide** a "Customization" chapter (numbered after "Charts with WaveUI"; renumber later chapters and every cross-reference, as Phase 12 did: grep before and after) with a part table per component group generated from the checklist (component, part key, element, locked attributes), the recomposition recipes (custom radio card, menu item, MessageBar child, DataGrid cell), and the Fluent comparison table of spec §2.2. **Step 3: testing guide** a section on testing `slotProps` and the context hooks. **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`; every code sample type-checks against `src/index.ts` (a throwaway script in the scratchpad). 
- [ ] **Step 5: Commit** `docs: slotProps, slot render functions and the context hooks`.

### Task 21: release notes and project docs

**Files:** `CHANGELOG.md`, `docs/ROADMAP.md`, `CLAUDE.md`, spec §11.

- [ ] **Step 1: CHANGELOG** complete the `## [0.18.0] - Unreleased` section: intro (the thirteenth parity release: customization surface and 1.0 notices), "Upgrading from 0.17" first (spec §10 in words), Added (`slotProps` per component, render-function slot children, `getNativeElementProps`, Field function child, `FieldContextProvider`/`useFieldContext`, the context hooks, the warnings), Changed, Deprecated (kept from Task 6), Fixed (none), Size (measured), the gap ids closed (`foundation-34`, `foundation-35`, `foundation-36`, `foundation-38`, `foundation-39`, `form-basic-7`, `form-basic-8`, `form-basic-21`, `field-6`, `api-1`, `menu-17`, `messagebar-6`, `ctx-1`, `buttons-29`) with the departures stated (single `slotProps` object versus Fluent's prop per part; narrow hooks versus contexts; `WaveProvider classNames` deferred; Field context optional). **Step 2: ROADMAP** Phase 13 "Built as" in the style of Phase 12's, the post-1.0 list gains `WaveProvider classNames` (R17), the status line is left for the release commit. **Step 3: CLAUDE.md** the design pointer, Architecture bullets (`lib/slotProps`, `nativeProps`, `slotParts`, the new hooks, the completeness gate), C-COMPOSE (slotProps merge rules), C-SLOTS (the three mechanisms), C-CONTEXT (optional versus required hooks), the testing section (the gate, the inventory test), no hard-coded test counts. **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`, `npm run build-storybook`; clean.
- [ ] **Step 5: Commit** `docs: customization surface and 1.0 notices for 0.18`.

### After the last task (controller)

Final whole-branch review (most capable model, with an adversarial pass on `mergeSlotProps` and the locked-attribute lists), one fix dispatch and one scoped re-review, the exit gate (`/gate`), the real-browser pass over spec §9 (all three engines), then `superpowers:finishing-a-development-branch`. Release only on the maintainer's explicit go-ahead.

---

## Plan rulings

1. **Tasks are sequential and each wires its own exports**; the gate's pending list is what keeps the build green while the rollout lands.
2. **Spec packages A to E map to Tasks 1 to 21**: A is 1 to 4, B 5 to 6, C 7 to 11, D 12 to 18 (a group splits into several tasks by the 8-component rule), E 19 to 21.
3. **B before C and D**: the notices are the one deliverable Phase 14 depends on; they land early so a schedule cut cannot drop them.
4. **The cut line (spec §8) is after Task 15** (overlays): D5 to D7 may become 0.18.x; B, C and A cannot be cut.
5. **The checklist is data**: Tasks 12 to 18 do not decide what to cover; the gate and the checklist from Task 4 do.
6. **No component is refactored for its own sake**: a rollout task changes only what `slotProps` needs.
