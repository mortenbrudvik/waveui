# WaveUI 0.8.0 Phase 3 — Implementation Plan (index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship WaveUI 0.8.0, Fluent parity Phase 3: stable class names on every component and part (P3-00), rich toasts with parts, keyboard access and a toaster handle (P3-01 … P3-03, P3-08), MessageBar title, actions and reflow (P3-04), ColorArea, ColorSlider, AlphaSlider and a composable ColorPicker (P3-05), and multi-select trees with row actions (P3-06, P3-07).

**Architecture:** Five waves, as the spec's §3 sets them. Wave A (one exclusive package) adds the server-safe class-name registry `src/lib/classNames.ts`, applies it to every existing component and enforces it in four layers. Wave B runs four packages with disjoint files (toasts, MessageBar, color, tree), each keeping every gate green through four pending lists. Wave C wires the barrels, empties the pending lists and adds the cross-package tests; wave D writes the documentation; wave E is the lead's final gate and real-browser and screen-reader checklist.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (`cn` = clsx + tailwind-merge), Vitest + React Testing Library + jsdom + vitest-axe, Storybook 10

**Spec:** `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` (approved 2026-09-26; every recommended answer of §8 accepted). Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins.

**Commits:** one per task, made by the session that executes the task. When wave-B packages run in parallel in one checkout, only the lead runs git write commands (spec §0.2 rule 6): a package agent stops at the commit step and reports its file list.

## Global Constraints

- Toolchain: Node `^22.22.2 || ^24.15.0 || >=26.0.0`, npm >= 11.11 (devEngines). No new runtime dependency (spec D30).
- Branch and worktree: `feat/fluent-parity-phase-3` in `.claude/worktrees/fluent-parity-phase-3`. Never a bare `git stash`; never `checkout -b` in the main checkout.
- Commits: conventional-commit subjects (`feat(feedback): …`); no AI attribution trailer; one commit per task.
- File ownership (spec §3): only your package's files. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read-only after wave A; the barrels and `src/index.ts` belong to INTEGRATION (wave C), except the registry export of Task A1.
- Conventions (CLAUDE.md, binding): C-REF (ref in props; `displayName` on every component and part), C-COMPOSE (consumer handlers first; `cn(<stable class>, <internal>, className)`; ignore events whose target is not DOM-inside `currentTarget`), C-CLASS (enumerated `data-*` always rendered, boolean ones present or absent, before `{...rest}`), C-TOKENS (theme tokens only; runtime colors only as inline custom-property values marked `// wave-allow-color: <reason>`), C-LOGICAL (logical utilities; the `wave-rtl:` variant only; horizontal arrows through `getArrowIntent`), C-FOCUS, C-MOTION (every `transition*`/`animate-*` string has a same-kind `motion-reduce:` variant; no component ships enter or exit motion, D29), C-DISABLED, C-NAMING, C-CONTEXT, C-MEMO, C-IDS, C-SLOTS, C-BUTTON-TYPE, C-NATIVE, C-ROUTING, C-FORMS, C-POPUPS, C-COMPOUND, C-PURE, C-HOOKS, C-DEV (`warnOnce` from effects; dotted keys such as `Toast.Title:unscanned`), C-DOCS, C-STORIES.
- Stable classes (spec §1.2): every element of a registered part carries exactly its Appendix A class, first in its `cn()` (or in `renderSlot`'s base classes), written as a literal member access (`toastTitleClassNames.root`); no state classes.
- Never write a Tailwind utility name as a bare word in comments or strings under `src/components` or `src/lib` (the CSS build fails on it).
- Tests: a test fails before its code exists (TDD); clean output (no act() warnings; every `[WaveUI]` warning asserted); never hard-code test counts; query by role and accessible name.
- Per task: the focused Vitest runs, `npx tsc -p tsconfig.json --noEmit`, `npx tsc -p tsconfig.dev.json --noEmit`, ESLint on the touched files with `--max-warnings 0`, and the conventions and stories gate filters for the touched components and stories.
- Phase level: `package.json` stays at 0.7.0 during the phase; the lead bumps it to 0.8.0 at release time (spec §6.3). Nothing public is removed or narrowed (roadmap principle 2).

## Review Focus

Phase-wide inputs and conditions the spec implies but none of its listed tests exercises, most likely first. Each package plan pins them with a test in the named task (and lists five of its own).

1. **A controlled component whose parent ignores the callback.** A ColorPicker whose parent never updates `value`, and a checkbox Tree whose parent never updates `checkedItems`, keep showing the controlled state after a drag, a key press or a toggle (no thumb drift, no stale check). → Tasks C10 (the working color re-derives whenever `hsvToHex(hsv)` differs from the value, a lead refinement of D21), C5, C7 and R3.
2. **Out-of-range and non-finite colors.** `hsvToHex` and the color parts receive `h` 360, -30 or 720, `s` 1.5, or `NaN`: hue wraps, the rest clamps, `aria-valuenow` stays inside its range, a key steps from the clamped value, and no inline custom property contains `NaN`. → Tasks C1, C4, C5, C6, C7.
3. **Parts that change after mount.** A toast re-dispatched by `toastId` with a different part set relabels its container without a dangling id at any commit; a MessageBar whose Actions appear or disappear, or whose `layout` changes, attaches and detaches its observer with no stale multiline state; children added under a listed Tree parent render checked. → Tasks T7, M4, R3.
4. **Parts whose content renders nothing.** `<Toast.Footer>{canUndo && <Button/>}</Toast.Footer>` with `canUndo` false is no action (the 5 s timeout stays), `<MessageBar.Actions>{false}</MessageBar.Actions>` is no Actions part (0.7 look, no observer), and Tree `actions={[]}` renders no toolbar. → Tasks T8, M1 and M4, R6.
5. **Duplicates.** Two items with the same `value` in a checkbox Tree (no crash, each value once in the emitted array, the existing duplicate warning); two dispatches with the same `toastId` in one tick (one toast, the second replaces the first). → Tasks R3, T7 and T10.

## File map

| Wave | Package | Plan file | Tasks | Spec |
|---|---|---|---|---|
| A | F3-foundation | [`2026-09-26-fluent-parity-phase-3-a-foundation.md`](2026-09-26-fluent-parity-phase-3-a-foundation.md) | A1–A17 | §0.2 rules 19–25, §1, P3-00, Appendix A |
| B | P3-toasts | [`2026-09-26-fluent-parity-phase-3-b-toasts.md`](2026-09-26-fluent-parity-phase-3-b-toasts.md) | T1–T16 | P3-02, P3-01, P3-03, P3-08 |
| B | P3-messagebar | [`2026-09-26-fluent-parity-phase-3-b-messagebar.md`](2026-09-26-fluent-parity-phase-3-b-messagebar.md) | M1–M5 | P3-04 |
| B | P3-color | [`2026-09-26-fluent-parity-phase-3-b-color.md`](2026-09-26-fluent-parity-phase-3-b-color.md) | C1–C12 | P3-05 |
| B | P3-tree | [`2026-09-26-fluent-parity-phase-3-b-tree.md`](2026-09-26-fluent-parity-phase-3-b-tree.md) | R1–R9 | P3-06, P3-07 |
| C | INTEGRATION | [`2026-09-26-fluent-parity-phase-3-c-integration.md`](2026-09-26-fluent-parity-phase-3-c-integration.md) | I1–I7 | §4.3–§4.5, §6.2 |
| D | DOCS | [`2026-09-26-fluent-parity-phase-3-d-docs.md`](2026-09-26-fluent-parity-phase-3-d-docs.md) | D1–D6 | §5 |
| E | lead | this file | E1–E3 | §6.3, §6.5 |

Each package file carries its own header, constraints, review focus, file structure and tasks, so an executor needs only its package file plus the spec. The files each package creates and edits are listed in its "File Structure" section and in spec §3.

## Order and parallelism

```
Task 0 (entry) ─▶ Wave A: A1 ─▶ A2 ─▶ A3 ─▶ A4 (button; the other folders' tests assert Button's classes on
                          the Buttons they render) ─▶ A5 … A12 (any order) ─▶ A13 ─▶ A14 ─▶ A15 ─▶ A16 ─▶ A17
                          (the lead runs the VoiceOver spike of A17 while A1–A16 run)
Wave B (after A17 is committed; the four packages share no file):
   T1 (split) ─▶ T2–T6 (P3-02) ─▶ T7–T10 (P3-01) ─▶ T11–T13 (P3-03) ─▶ T14 (P3-08) ─▶ T15 (stories) ─▶ T16 (gate, report)
   M1 ─▶ M2 ─▶ M3 ─▶ M4 ─▶ M5
   C1 ─▶ C2 ─▶ C3 ─▶ C4 ─▶ C5 ─▶ C6 ─▶ C7 ─▶ C8 ─▶ [checkpoint commit] ─▶ C9 ─▶ C10 ─▶ C11 ─▶ C12
   R1 ─▶ R2 ─▶ R3 (uses the spike result) ─▶ R4 ─▶ R5 ─▶ R6 ─▶ R7 ─▶ R8 ─▶ R9
Wave C (after all four wave-B packages): I1 ─▶ I2 ─▶ I3 ─▶ I4 ─▶ I5 ─▶ I6 ─▶ I7
Wave D (after I7): D1 … D6 (any order)
Wave E (after wave D): E1 ─▶ E2 ─▶ E3
```

- **Within a package** the tasks run in order: each consumes the previous one's interfaces.
- **Wave B in one session:** run the packages one after another (color first: it is the critical path, spec §3), or dispatch the four packages to parallel agents in the same checkout; then only the lead commits (spec §0.2 rule 6) and each agent reports its files. Between wave B and wave C nothing is red: `verify-dist`, `classNames.test.ts`, `public-types.test.ts` and the barrel test of `integration.test.tsx` pass through their pending lists (spec §0.2 rule 24; the fourth list, `PENDING_FLAT_MEMBERS`, is a plan addition in Task A16).
- **Change requests:** a wave-B package that needs a registry key Appendix A lacks stops and asks the lead, who edits `src/lib/classNames.ts` and tells the other packages (spec §0.2 rule 20). Same for a seam between packages: INTEGRATION resolves it in wave C.
- **Reports:** each package ends with a report: its barrel requests (spec §4.3), the 0.7 tests it changed and why, failures it saw in another package's tests, change requests, spec deviations for §10, and the behaviours it could only assert as attributes (spec §0.2 rule 23).

---

### Task 0: Entry conditions (lead)

**Files:** none changed by this task besides merges.

**Interfaces:**
- Consumes: `main` with `docs/issues-4-7` (7ba32ec: the roadmap's P3-08 and the README toast recipes) and `fix/dialog-surface-margin` (ae6bdb0, 177bfb1, 59f2760: the `Dialog.Content` surface margin and body colour, and the CHANGELOG's `## [0.8.0] - Unreleased` section) merged. Both landed on `main` (2e1c729, 1aa79b7), and `main` was merged into the phase branch at planning time (7bd688d).
- Produces: `feat/fluent-parity-phase-3` containing current `main`, green baseline.

- [ ] **Step 1: Confirm both entry branches are in the phase branch**

Run:
```bash
git merge-base --is-ancestor docs/issues-4-7 HEAD && echo "issues-4-7 in" || echo "issues-4-7 MISSING"
git merge-base --is-ancestor fix/dialog-surface-margin HEAD && echo "dialog fix in" || echo "dialog fix MISSING"
git merge-base --is-ancestor main HEAD && echo "main in" || echo "main has new commits"
```
Expected: `issues-4-7 in`, `dialog fix in`, `main in` (true since 7bd688d). With a `MISSING` line the maintainer merges that branch into `main` from the main checkout (spec §3 "Branches to merge first"; the maintainer's decision, not an agent's); then Step 2.

- [ ] **Step 2: Bring newer `main` commits into the phase branch (only if Step 1 printed "main has new commits")**

Run (in the worktree): `git merge --no-ff main -m "chore: merge main into feat/fluent-parity-phase-3"`
Expected: a clean merge (before wave A the branch adds only the spec and the plans under `docs/superpowers/`). If `src/components/overlays/Dialog.tsx` changed again, re-check Task A10's anchors; if `CHANGELOG.md` changed, re-check Task D1 Step 1's expectations.

- [ ] **Step 3: Baseline**

Run: `npm ci` (only if `package-lock.json` changed in a merge or `node_modules` is missing), then `npm run typecheck`, `npm run lint`, `npm test`.
Expected: all pass on the merged tree. A failure here is not Phase 3's: report it to the maintainer before wave A starts.

---

### Task E1: Final gate (lead, wave E)

**Files:** none (verification); fixes go back to the owning package's files.

**Interfaces:**
- Consumes: waves A–D committed.
- Produces: the wave E report's gate section.

- [ ] **Step 1: Run the full gate** (spec §6.3)

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
node scripts/verify-dist.mjs --final
npm run check:package
npm run test:pack
npm run build-storybook
```

Expected: every command exits 0. `verify-dist --final` passes only with `PENDING_FLAT_EXPORTS` (`scripts/verify-dist.mjs`) empty and every §6.2 probe; the other three pending lists (`PENDING_CLASS_NAMES` in `src/__tests__/classNames.test.ts`, `PENDING_PUBLIC_TYPES` in `src/__tests__/public-types.test.ts`, `PENDING_FLAT_MEMBERS` in `src/__tests__/integration.test.tsx`) must be `[]` too (grep them).

- [ ] **Step 2: Check the output is clean**

Run: `npx vitest run --reporter=default 2>&1 | grep -E "act\(|\[WaveUI\]" | head -20`
Expected: no line that is not inside an asserted spy (every `[WaveUI]` warning a test expects is asserted, so the grep prints nothing unexpected; inspect any line it prints).

- [ ] **Step 3: Run the repository's exit-gate runner**

Run: `node scripts/claude/gate.mjs` (the `/gate` skill's runner, about four minutes; spec §6.3 and ROADMAP §3)
Expected: every criterion passes (CHANGELOG top section, exceptions without a reason, act() and `[WaveUI]` warnings, documents changed).

- [ ] **Step 4: Record sizes for the CHANGELOG**

Follow Task D1's "Size" step (it names the measurement 0.7.0 used) and give DOCS the numbers if D1 left them to the release.

### Task E2: Real-browser and screen-reader checklist (lead, wave E)

**Files:** none; results go into the wave E report.

**Interfaces:**
- Consumes: Storybook (`npm run dev`, port 6006) with the phase's stories.
- Produces: exit evidence per spec §6.3 items 1–6 and §0.2 rule 23.

- [ ] **Step 1: Per-theme and RTL check of every new story**

In Storybook, open every story added or changed in this phase (Toast, MessageBar, ColorArea, ColorSlider, AlphaSlider, ColorPicker, Tree) in the light, dark and high-contrast themes and in RTL (toolbar). Record for each: text readable, focus rings visible, nothing clipped, RTL mirrored where the spec says (ColorArea field, horizontal rails, tree arrows, Dismiss and actions at the end).

- [ ] **Step 2: Run the checklist of spec §6.3** (Chrome, Firefox, Safari; NVDA + Chrome, JAWS + Edge, Narrator + Edge, VoiceOver + Safari on macOS and iOS, TalkBack + Chrome on Android; Voice Control, Dragon)

Record a result (pass, fail with a note, or not available) for each numbered item:
1. Class names in the DOM of a sample of stories; no utility generated for them in the Tailwind fixture (`npm run test:pack` output).
2. Toasts: announcement once ("Success: Email sent Your message was delivered. Undo"), error assertive; the shortcut focuses the newest toast and its group name is read; Escape returns focus; Escape with a tooltip shown hides only the tooltip; Delete and Backspace dismiss (JAWS virtual cursor noted); Escape over a Dialog leaves it open; timers paused while a toast's menu has focus; a toast with an action stays and is reachable with TalkBack, VoiceOver iOS, Voice Control and Dragon; a staying toast never hides a focused element (WCAG 2.4.11); with an app's exit classes, focus never lands on an exiting toast.
3. MessageBar: a titled alert read once with the title; a `role="region"` bar listed as "Warning: <title>" landmark; `'auto'` switches and returns as the window narrows and widens without a jump on load; at 320 px, 400 % zoom and WCAG 1.4.12 spacing nothing is cut off (also explicit `'singleline'`).
4. Color: mouse, touch and pen dragging; one 2-D slider listed and one Tab stop on desktop; VoiceOver iOS and TalkBack adjust both channels (step size noted) and reach both hidden inputs (if not: the overlay option of spec §9 point 11, for the lead to approve); NVDA reads "Saturation 72%, Brightness 74%, dark blue, 2D slider"; RTL mirroring; vertical sliders in Chrome, Edge, Firefox and Safari; the two-tone focus indicator visible at the brand blue in all three themes; Windows High Contrast rings and focus indicator; the checkerboard visible in all three themes.
5. Trees: mixed state announced on item and checkbox by NVDA, JAWS, Narrator, VoiceOver and TalkBack; whether NVDA says "not selected" on items (noted); Space toggles; double tap on checkbox toggles and on item activates (also expanded parents); Voice Control and Dragon reach the checkbox by name; row actions visible on hover, focus, touch and forced colors, the aside beside them where they always show; treegrid arrows into and out of the actions; JAWS and NVDA focus mode on an action; the toolbar announced with the item's name; forced colors draw the indicators; rows reflow at 320 px and 400 % zoom without hiding actions.
6. Toaster handle: a toast dispatched from a plain module function is announced and behaves like a hook-dispatched one; a server-rendered page with a module-scope handle carries no toast.

- [ ] **Step 3: Triage**

A failure that is a defect goes back to the owning package's files as a fix commit (`fix(<folder>): …`) with a test where jsdom can express it; a failure that needs a design change goes to the maintainer before release.

### Task E3: Spec implementation notes and release readiness (lead, wave E)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md` (new §10 at the end)
- Modify: `docs/ROADMAP.md` (status line, only when 0.8.0 ships)

**Interfaces:**
- Consumes: every package report (spec deviations), the wave A report (VoiceOver spike), the E1 and E2 results.
- Produces: the spec's §10 "Implementation notes" (spec §6.5).

- [ ] **Step 1: Write §10 "Implementation notes"**

Append to the spec a `## 10. Implementation notes` section with one numbered entry per place where the code deliberately differs from the spec or refines it, each with its reason. The plans already decided the entries below (keep, reword or drop each as the code turns out), grouped by package; then add every deviation the package reports list.

*Across the phase*
1. A fourth pending list, `PENDING_FLAT_MEMBERS` in `src/__tests__/integration.test.tsx` (Task A16, emptied by Task I1): the barrel test would otherwise go red between wave B and wave C, breaking §0.2 rule 24.
2. Per-folder DOM class tests (`src/components/<folder>/__tests__/stableClassNames.test.tsx`, Tasks A4–A12) were added to §1.6: they assert every part class on the element Appendix A names, which the registry's text match cannot prove.
3. `docs/FLUENT-UI-COMPARISON.md`, added to `main` after the spec (b02eaf3), is revised for 0.8 (Task D6); the CHANGELOG sizes have one owner, Task D1, which measures both columns with one script (0.7.0 from its npm package).
4. The VoiceOver spike's result and whether `TreeLabels` shipped (§8 Q18), recorded in the "Wave A report" section of the wave A plan.

*F3-foundation (wave A)*
5. The registry test finds a component's constant by its flat name, then by its `displayName`, so the alias table stays the only exception list (`ComboboxOption` resolves through `'Option'`); it also checks that every public `displayName` resolves, that every constant names a public component (the pending Phase 3 constants excepted) and that `cn()` keeps every stable class.
6. `StatusText`'s `id` is unit-tested by rendering it directly (MessageBar passes no id until P3-04).
7. Class application details: `defaultDismissContent(className?)` in Tag and MessageBar (the default glyph carries the dismiss-icon class only as the button's own content); the beak class enters `PopoverBeak` through `className` at its call sites; the `className` pass-through roots switched to `cn()` are `TableBody`, `DataGridBody` and `SkeletonGroup` (Table already used `cn()`); shared renderers gained internal class inputs (`useControlErrorMessage`, `ListboxSurface`, `PickerExpandButton`, `MenuItemRow`, `SelectableMenuItem`, Nav's `renderNavEntry` and `renderIcon`, Pagination's `renderNavButton`); a plain `Menu.Item`'s column placeholder stays unclassed (`menuItemClassNames.checkmark` is on the checkable items' check column); a few extra elements carry their part or root class (RatingDisplay's compact star, a Carousel without slides, a misplaced Accordion panel, the heading an `Accordion.Item` renders around a wrapped trigger, both TimePicker lists).

*P3-toasts*
8. Focus leaves a dismissed toast in the dismissing commit's layout phase through `usePreserveFocus`'s `enabled` flip (a focus move in the mutation phase is undone by React's selection restore); name registration follows `useTitleRegistry`, and "no dangling id at any commit" holds after every update.
9. The timer starts in the container's layout effect (the action check needs the mounted content); focus-origin tracking treats open layers anchored inside the viewport as part of the region and remembers focusable elements only (so a Menu in a toast keeps the origin).
10. A `title` prop next to Body or Footer parts without a Title part still renders a Title.
11. `isToastOptions` lives in the server-safe `src/lib/toaster.ts`, shared by the handle and the Toaster; an extra warning `Toaster:handle-unknown`; `ToasterHandle extends ToastController {}` carries a reasoned `eslint-disable-next-line @typescript-eslint/no-empty-object-type`; the test harness `__tests__/toasterHarness.tsx` and the node-environment file `src/lib/__tests__/toaster.server.test.tsx` are added.

*P3-messagebar*
12. The multiline layout stacks the text column and the actions inside a layout wrapper between the icon and the Dismiss button (present in both layouts whenever actions render), instead of a root grid; the DOM order and the look are the same, and a missing icon or Dismiss button leaves no empty track.
13. A Title or Actions part whose children render nothing is left out (`slotRendersContent`); several Actions parts render side by side.
14. The `'auto'` measurement also runs before paint after every one-row commit, re-measures on text changes through a MutationObserver, follows window resizes where there is no ResizeObserver, and measures a resize one animation frame later (no ResizeObserver loop error); the StrictMode test asserts one active observer.
15. A title names the bar for any consumer role except the live-region roles and `none`, `presentation` or `generic`.

*P3-color*
16. The picker re-derives its working color whenever the normalized value differs from `hsvToHex(hsv)`, not only after the value changed, so a controlled parent that ignores `onValueChange` keeps the thumbs at its value (the lead's refinement of D21).
17. The exposure model reads `(pointer: coarse)`: every device that is not touch-primary gets the desktop model (a device with no pointer too), which is also the server's and the test environment's default.
18. The checkerboard uses `stroke` on `background`: `muted` on `background` fails 1.5:1 in all three themes.
19. `aria-required` is never set on a slider input (ARIA gives `slider` none); `required` goes to the hidden input.
20. `ColorArea`'s consumer `tabIndex` applies to whichever input holds the Tab stop; the hex error renders inside `ColorPicker.HexField`'s label, under the input (the default row aligns to the top so it does not shift); the picker-only parts were extracted (C9) before the working color and the new default layout (C10); `ColorPicker.Swatches` ignores the picker's `shape`; the picker has no `disabled` prop, so bound parts are disabled only by an invalid value; AlphaSlider renders no `data-channel`; the invalid-value warning names the area and sliders.

*P3-tree*
21. `useRovingTabIndex`'s `tabStop` gains the value `'none'` instead of the spec's `tabStop?: boolean`: 0.7 already exports `tabStop?: 'active' | 'last-focused'`.
22. The tree's roving hook selects `[role="treeitem"]` only: a nested composite counts as one item of the enclosing arrow order, so each row toolbar would have sat between two tree items.
23. Each item computes its own check state from its own children (the child-group rule) and the checked list; the top-level items register their subtrees with the root, which orders a toggle's emitted list. The rule and output are the spec's, the states render on the server, and a component that renders a top-level item (which 0.7 supports) cascades too.
24. Row layout: the end cell takes `ms-auto`, the label `min-w-0` only when content follows it, and the aside and actions share one grid cell (side by side under forced colors or without hover); a hidden custom `expandIcon` keeps the spacer; pressing the checkbox moves focus to its item; no `data-navigation-mode` (keys only, nothing to style); a persona row's checkbox and toolbar are named by the person's name (D25 with D28).

*INTEGRATION and DOCS*
25. `verify-dist` also checks that `lib/color` and the entry's color helpers load under react-server (the README promises them in Server Components), and exports its list of opt-in modules (`OPT_IN_MODULES`); the barrel test's compound floor rises from 19 to 22.
26. No `#### Packaging` heading in the 0.8.0 CHANGELOG section (the new `verify-dist` checks are under "Size", as in 0.7), which keeps the older `#packaging` links valid; README's CHANGELOG links renumbered after the Dialog fix are corrected.

- [ ] **Step 2: Check the definition of done** (spec §6.5)

Confirm and record: every item's tests pass (E1); every gap id of spec §7 is named in the CHANGELOG 0.8.0 section (`buttons-29` as mitigated); the §6.2 probes pass; the §6.3 results are in the wave E report and the spike's in wave A's; CHANGELOG, README, CLAUDE.md and the guides are updated (wave D); §10 exists.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-26-fluent-parity-phase-3-design.md
git commit -m "docs(spec): phase 3 implementation notes"
```

- [ ] **Step 4: Release (maintainer)**

At release time the lead bumps `package.json` to 0.8.0, dates the CHANGELOG section, marks Phase 3 released in `docs/ROADMAP.md`, and follows `docs/RELEASING.md` (`node scripts/check-release.mjs v0.8.0 --registry`; the tag runs the release workflow). Not part of this phase's packages.
