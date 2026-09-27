# SDD ledger — plan: docs/superpowers/plans/2026-09-26-fluent-parity-phase-5.md

Spec: docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md (approved 2026-09-26). Branch start (merge base with main): d5a84bd. Plan committed at 00e89a2.
Global constraints file: .superpowers/sdd/2026-09-26-fluent-parity-phase-5/global-constraints.md

## Pre-flight scan

### Task pairs that share a file or an interface

| Tasks | Shared file / interface | Producer → consumer | Finding |
|---|---|---|---|
| A1 → A2 | `useActiveDescendant` API | A1 produces setActiveValue/highlight/first/last/next/prev/move/activeValue/activeDescendantId; A2 consumes them | consistent |
| A2 → A3 → A4 → A5 | `useListbox.ts`, `useListbox.test.tsx` | sequential edits of one module | consistent (sequential) |
| A3 → B3 | `TagPicker.tsx` | A3 renames its `multiple` option (one line); B3 later adds query/filter | consistent (sequential, disjoint lines) |
| A3 → A6, A5 → A6 | `ListboxContextValue` (`select(value,item,event)`, `multiselect`, `mode`, `press`) | Option.tsx reads the option result only | consistent |
| A6 → A7 | `Option.test.tsx` | A6 adds tests; A7 edits the message assertion at :205 | consistent (sequential) |
| A7 → F1 | `src/index.ts`, `input/index.ts`, `verify-dist.mjs`, `verify-dist.test.mjs` | A7 adds the primitives and the bridge; F1 adds the rest and empties the bridge | consistent (sequential) |
| A5, A6 → C1 | standalone mode, `ListboxProvider` | C1 consumes both | consistent |
| B1 → B4 → B5 | `Dropdown.tsx` | sequential | consistent |
| B2 → B3 → B4 → B5 | `Combobox.tsx` | B2 builds on 0.7's `draft` state; B3 converts `draft` to query + editing | CONFLICT: the plan's B2 text (from spec §2 P5-01) says `startEditing` "sets the P5-02 query state", which only B3 creates → Ruling R5 |
| B1, B2, (TagPicker) | multi-select label defaults (`selection`, `added`, `removed`) | the same three defaults would be written in Dropdown, Combobox and (already, 0.7) TagPicker | DRY risk → Ruling R6 |
| D2 → D4 | `SwatchPicker.tsx` root `onKeyDown` | D2 adds the EmptySwatch arrow-key guard; D4 switches the roving hook per layout | D4 must keep D2's guard (carry in D4's dispatch) |
| D3 → D4 | `useRovingGrid` | D3 produces `{ containerProps, getTabIndex }`; D4 consumes | consistent |
| E1 → E2 | `dateUtils.ts` imports from `src/lib/date.ts` | E1 moves helpers; E2 moves the grid | consistent |
| E2 → E3 → E4 → E5 | `Calendar.tsx`, `Calendar.views.tsx`, `DatePicker.tsx` | sequential | consistent |
| C2, D5, E6 → F1 | stories import from module paths; F1 normalises to `../src` | consistent |

### Per-task self-consistency

| Task | Finding |
|---|---|
| A1 | tests and code agree (the "same update" test rewritten during plan self-review) |
| A2 | pure refactor; tests unchanged by design |
| A3 | new tests sketched as comments with exact expected call lists: implementer writes them in full |
| A4 | tests sketched with exact key sequences and expectations |
| A5 | harness references "the file's existing option built on useListboxOption": implementer confirms it exists in useListbox.test.tsx, else writes one |
| A6 | tests reference the file's listbox harness (`renderInListbox`, `option()`): implementer adapts to Option.test.tsx's helpers |
| A7 | consistent |
| B1 | consistent; label defaults → R6 |
| B2 | the undo rule's snippet says "while the labels show", D11 rule 3 applies to any value equal to the labels → Ruling R7; editing helpers → R5 |
| B3 | consistent (freeform path keeps 0.7's draft) |
| B4, B5 | consistent |
| C1 | consistent; `press` on a disabled list: `ul.focus()` without tabindex is a no-op, and `onSelect` guards `disabled` |
| C2 | consistent |
| D1 | warning-order assertion relaxed during plan self-review |
| D2 | consistent |
| D3 | consistent |
| D4 | must keep D2's guard (see pairs) |
| D5 | consistent |
| E1 | consistent (week-number cases checked by hand) |
| E2–E6 | consistent |
| F1–F3, G1–G4, H1, I1 | consistent |

## Rulings

- Ruling R1: implementers do not commit; the controller commits each task's files after the implementer reports DONE, before the review package — the project rule (ROADMAP §3 "Agents never run git write commands; the lead commits"; plan Global Constraints) wins over the implementer template's "Commit your work" — cost if wrong: none (only who runs `git commit`).
- Ruling R2: wave B runs sequentially (package by package, each package's tasks in order) in this one worktree, not in parallel — the skill forbids parallel implementers in one tree (edits, hooks and test runs would interleave) — cost if wrong: wall-clock only.
- Ruling R3: task briefs are cut from the plan by line range (the skill's `task-brief` only matches numeric task ids; this plan uses A1 … I1); review packages are written with plain `git log`/`git diff` into the workspace (the sandbox refuses the helper scripts) — cost if wrong: none.
- Ruling R4: models — implementers `sonnet` by default, `opus` for design-heavy tasks (A2, A5, B2, C1, D4, E2, E4); task reviewers `sonnet`, `opus` for large or subtle diffs; re-reviews `sonnet`; the final whole-branch review `opus` — cost if wrong: time or cost, not quality (reviews catch misses).
- Ruling R5: B2 implements the multi-select Combobox on 0.7's `draft` state (`setDraft(text)` starts editing, `setDraft(null)` stops); B3 then maps those calls onto the query and editing state — the plan's B2 text refers to the P5-02 query state, which does not exist until B3 — cost if wrong: B3 rewrites a few calls it rewrites anyway.
- Ruling R6: B1 creates `src/components/input/pickerLabels.ts` (module-private, not exported from the package) with `defaultSelectionLabel`, `defaultAddedLabel` and `defaultRemovedLabel`; Dropdown, Combobox and Listbox use it (B2, C1), and B3 switches TagPicker's 0.7 copies to it — avoids three copies of the same defaults (C-NAMING defaults stay identical) — cost if wrong: one small extra file (Phase 1 rule 1 allows an unplanned component-prefixed helper in the component folder, reported).
- Ruling R7: D11's undo rule applies to any change whose text equals the labels text, also while a query is shown (an undo after typing restores the labels) — spec D11 rule 3 has no "while the labels show" condition; the plan's snippet does — cost if wrong: a user who types exactly the labels text gets the labels (no query), which is the intended display anyway.

## Progress
Task A1: dispatched (base 00e89a2, implementer aac002d8ee90ad97c, sonnet)
Note (docs session, main at 1aa79b7): before wave D (G1-G4) edits docs/ROADMAP.md, README.md or CHANGELOG.md, merge main into this branch first; a new top CHANGELOG section shifts numbered anchors (e.g. #changed -> #changed-1 for 0.7.0): renumber any link the 0.10.0 section adds or shifts.
Ruling R8: A1 tests capture the hook result with a resultRef + useImperativeHandle and count renders through an onRender vi.fn() prop, not the plan snippet's module-scope variables mutated during render — eslint-plugin-react-hooks 7 (react-hooks/immutability, react-hooks/globals) rejects the snippet with no test-file exemption; useListbox.test.tsx already uses this pattern; scenarios and assertions unchanged — cost if wrong: none (test plumbing only).
Task A1: implemented, committed 73b0c95 (DONE_WITH_CONCERNS: R8); review package review-A1.diff
Task A1: review (opus) — Needs fixes: 2 Important (plan-mandated), 4 Minor.
Ruling R9: useActiveDescendant.move(delta) never wraps (step with loop=false), as spec §1.1 documents; loop applies to next()/prev() only; A2 routes ArrowDown/ArrowUp through ad.next()/ad.prev() and PageUp/PageDown through ad.move(±10), which reproduces 0.7 (±1 wraps with loop, ±10 clamps) — cost if wrong: none for useListbox; a consumer calling move(±1) expecting wrap gets clamping, as documented.
Task A1: minor (deferred): setActiveValue(v, {scroll:false}) can leave a stale noScrollRef marker when the next render drops v without changing activeValue (useActiveDescendant.ts:148-153,172-177)
Task A1: minor (deferred): turning activateFirstOnChange on later compares against the last render in which it was on (spec rule); say so in its JSDoc (:24-31)
Task A1: minor (deferred): untested: highlight guards (disabled, not in items, already active), scroll keyed on activeValue only (rerender without a move), prev wrap/clamp without loop, identities of methods other than next
Task A1: minor (deferred): JSDoc @example builds DOM ids from data (C-IDS prefers a useId prefix); getElement @default hides the id-lookup fallback when getElement returns null
Task A1: fix round 1/5 (2 addressed, 0 open; commits 73b0c95..dedf217)
Task A1: minor (deferred): step()'s Math.abs(delta) === 1 guard is now redundant (move always passes loop=false) — possible simplification
Task A1: complete (commits 00e89a2..dedf217, review clean)
Task A2: dispatched (base dedf217, implementer a8e858133879feeef, opus; carries R9)
Ruling R10: spec §1.1.2 corrected (commit after 64a7a0a): with activateFirstOnChange comparing items, a disabled option entering/leaving the filtered set no longer moves the highlight, while an option disabled/enabled while open now does (the draft said the reverse); found by the A2 implementer's 8-case probe of 0.7 vs new — cost if wrong: documentation only.
Task A2: implemented, committed 64a7a0a (DONE_WITH_CONCERNS: R10; highlightOnFilter JSDoc reworded to match); review package review-A2.diff
Observation: full-suite run printed one Tooltip act() warning from Popover.test.tsx (passes alone twice; no import path to useListbox) — possible load flake; watch at the final gate.
Task A2: review (opus) — Approved, 0 Critical/Important, 4 Minor.
Task A2: minor (deferred): useListbox.ts:374 comment wording ("passed on detached, hence an arrow")
Task A2: minor (deferred → A7 JSDoc pass): highlightOnFilter JSDoc lacks @default false (useListbox.ts:86-91)
Task A2: minor (→ A4 dispatch): no useListbox-level test pins R10 (items = enabled values: a disabled option entering the filtered set keeps the highlight; one disabled while open moves it)
Task A2: minor (deferred → final gate): Tooltip act() warning in Popover.test.tsx under full-suite load (flake; /gate fails on act() warnings)
Task A2: complete (commits dedf217..64a7a0a, review clean)
Task A3: dispatched (base edf9016, implementer abb7dbdb2cf0db25e, sonnet)
Task A3: implemented, committed 64c7712 (DONE; typeahead open path reads the key event via a ref set in onKeyDown; test titles renamed multiple→multiselect); review package review-A3.diff
Task A3: review (sonnet) — Approved, 0 Critical/Important, 3 Minor.
Ruling R11: accept the three 0.7 test-title renames multiple→multiselect (useListbox.test.tsx:1688,2055,2071) — inert text naming the renamed option; reverting would leave titles naming an option that no longer exists — cost if wrong: none.
Task A3: minor (deferred): multiselect test asserts toHaveBeenLastCalledWith per render, not the full call list (useListbox.test.tsx:2386)
Task A3: minor (deferred): the `if (!open && event)` guard in typeahead onMatch is belt-and-braces; a one-line comment would say so (useListbox.ts:946)
Task A3: complete (commits edf9016..64c7712, review clean)
Task A4: dispatched (base 64c7712, sonnet; carries the R10 listbox-level test from A2 minors)
Task A4: implemented, committed 7e82850 (DONE_WITH_CONCERNS: used the file's key()/fireEvent helpers like sibling tests; fixed a third JSDoc sentence, UseListboxResult.items); lib tsc verified clean; review package review-A4.diff
Task A4: review (sonnet) — Needs fixes: 1 Important (stale setActiveValue JSDoc), 2 Minor.
Task A4: minor (deferred): the A4 report describes the click guard imprecisely (useListboxOption's own `if (disabled) return` blocks the click first) — no code impact
Task A4: minor (deferred): redundant phrasing "close without committing instead of committing them" (useListbox.ts:100-101)
Task A4: fix round 1/5 (1 addressed, 0 open; commits 7e82850..0232fcf)
Task A4: minor (→ A7 JSDoc pass): useListbox docblock "Active option" bullet (useListbox.ts:797-800) still says a disabled highlight is always dropped; add "unless disabledOptionsFocusable"
Task A4: complete (commits 64c7712..0232fcf, review clean)
Task A5: dispatched (base 0232fcf, opus)
Task A5: interrupted at the usage limit — implementer stopped while still reading, no edits (worktree clean at 0232fcf). Next session: re-dispatch A5 as-is (brief task-A5-brief.md, base 0232fcf, opus, same dispatch context).
Task A6: brief written (task-A6-brief.md, plan lines 716-863); not dispatched
Task A5: re-dispatched (base 0232fcf, opus)
Ruling R12: A6 adds only the two stroke-accessible contrast pairs; primary on subtle-selected is already asserted at 4.5 (tokens.test.ts ~425), stricter than the box's 3:1, so no duplicate entry at 3 (the existing entry's comment names D8's box) — spec §1.8 wants the 3:1 guarantee, which the stricter pair gives — cost if wrong: none.
Note: A6 brief assumes a renderInListbox/option() harness Option.test.tsx lacks; dispatch notes (task-A6-dispatch-notes.md) tell the implementer to build it on useListbox + ListboxProvider.
Task A5: implemented, committed 08ec503 (DONE_WITH_CONCERNS: onOpenChange dropped once in standalone mode instead of guarding openWith/commit/commitOrClose only; press activates only navigable options; OptionImpl spreads optionProps after consumer props, so a consumer onMouseDown is replaced in standalone mode (→ A6: compose); press ignores the mouse button); both tsc programs verified clean; review package review-A5.diff
Task A5: review dispatched (opus, review-A5.diff)
Task A5: review (opus) — Approved, 0 Critical/Important, 6 Minor; deviations 1 (one onOpenChange gate) and 2 (press checks navigability) judged sound; real-browser batching of focus + press → C1 checklist.
Ruling R13: take A5 minors 1 (a press on a non-navigable option of an unfocused list lets the fallback scroll into view: pin it with scroll:false while unfocused), 2 (dev warnOnce from press when the list element is unknown: the hook ref was dropped) and 5 (tests: multiselect press+click; ArrowLeft/Right unhandled) in a fix round before A6 — useListbox.ts is frozen from wave B (rule 20), so seam fixes now avoid change requests later — cost if wrong: one short fix round.
Task A5: minor (→ A7 JSDoc pass): useListbox docblock "Consumer contract (Combobox, Dropdown, TagPicker, TimePicker)" header (useListbox.ts:885) should name the Listbox
Task A5: minor (deferred): option handlers (new onMouseDown, 0.7 onClick/onPointerMove) have no portal guard (C-COMPOSE); options hold non-interactive content, low risk
Task A5: minor (→ C1 real-browser check): press ignores the mouse button (right/middle press focuses and activates, no commit); decide event.button === 0 there
Task A5: fix round 1/5 dispatched (R13: minors 1, 2, 5; base 08ec503; resumed implementer)
Task A5: fix round 1 implemented, committed 70d9d89 (DONE; side effect accepted: after a press on a non-navigable option of an unfocused list the fallback is stored as a move, so an outside selection change does not move the highlight until the list blurs, as after any arrow move); both tsc programs verified clean; review package review-A5-fix1.diff
Task A5: fix round 1/5 (3 addressed, 0 open; commits 08ec503..70d9d89; re-review sonnet: clean)
Task A5: complete (commits 0232fcf..70d9d89, review clean)
Task A6: dispatched (base 70d9d89, opus; notes task-A6-dispatch-notes.md incl. the A5 onMouseDown composition)
Task A6: implemented, committed c240b6c (DONE; deviations: heading renders when slotRendersContent(label); the unnamed-group check reads the accessible text (skips aria-hidden, counts aria-label/alt); the check runs after every commit until it fires; concern: a custom picker must close on Escape without calling listbox.onKeyDown while nothing is shown (JSDoc of useListboxPopup says so) → wave D guide (G3)); both tsc programs verified clean; review package review-A6.diff
Wave B briefs extracted (task-B1..B5, C1..C2, D1..D5, E1..E6; plan headings are ####); A7 brief + task-A7-dispatch-notes.md ready
Task A6: review (opus) — Approved, 0 Critical/Important, 6 Minor; deviations 1-2 and 4 accepted, 3 acceptable but heavier than D16 needs.
Ruling R14: take all six A6 minors in a fix round before A7 — Option.tsx is frozen from wave B (rule 20): M1 split the unnamed-group test so the aria-hidden skip is pinned; M2 scope the outline drop to multiselect && showCheck (spec §1.3.2 wording; the brief's snippet dropped it for every multi-select list, leaving showCheck={false} lists without a forced-colours sign); M3 key the unnamed-group effect on its inputs and skip the DOM walk when props name the group; M4 JSDoc: IME guard in the Escape pattern, aria-expanded={expanded} after getComboboxProps(); M5 a disabled option's box follows the row (currentColor border and glyph, no primary fill; forced colours GrayText on Canvas, Checkbox's recipe) — D8 is silent and a vivid box on a muted row contradicts the disabled look; M6 JSDoc: emptyContent false/'' shows an empty surface (0.7 behaviour kept) — cost if wrong: one fix round; M5's look is revisitable in wave F with P4-01.
Task A6: note (→ G3 custom-picker guide): the Escape hand-off (close on Escape without listbox.onKeyDown while nothing is shown, outside an IME composition) and aria-expanded={expanded}
Task A6: fix round 1/5 dispatched (R14: M1-M6; base c240b6c; resumed implementer)
Task A6: fix round 1 implemented, committed 268db28 (DONE; accepted: a blank consumer aria-labelledby does not count as a name; the disabled glyph keeps Checkbox's disabledGlyph opt-out on the leaf); both tsc programs verified clean; review package review-A6-fix1.diff
Task A6: fix round 1/5 (6 addressed, 0 open; commits c240b6c..268db28; re-review sonnet: clean)
Task A6: complete (commits 70d9d89..268db28, review clean)
Task A7: dispatched (base 268db28, opus; notes task-A7-dispatch-notes.md)
Task A7: implemented, committed b90746c (DONE; wave A exit gate passed: typecheck, lint, format:check, npm test (152 files, 9900 passed + 2 expected fails, clean output), build (bridge open line), verify-dist, build-storybook); public-types walker needed no extra exports; review package review-A7.diff
Task A7: minor (→ F2, INTEGRATION owns verify-dist tests): checkServerImport client-reference test in verify-dist.test.mjs timed out once at 10.6 s under load (passes alone and in the full suite): give it a 30 s timeout like its siblings
Task A7: note (→ final review): useListbox JSDoc already describes wave B's filter(option, query) mapping and the Listbox (the file is frozen from wave B)
Task A7: review (opus) — Needs fixes: 1 Important (I1: setActiveValue JSDoc says a non-navigable value is ignored; it is stored and dropped in the next render, clearing an earlier move, while a value navigable in the same update is kept (TimePicker) — JSDoc fix, no code change), 6 Minor.
Task A7: fix round 1/5 dispatched (I1 + M1-M4, JSDoc only in useListbox.ts; resumed implementer)
Task A7: minor (→ F1/F3, INTEGRATION): verify-dist.mjs PENDING_FLAT_EXPORTS docblock (≈75-81) names SwatchPicker; reword when wave C empties the list
Task A7: note (→ G3, DOCS): CLAUDE.md "Internals stay module-only" list still names useListbox, collectOptionLabels, ListboxSurface (public since A7)
Task A7: fix round 1 implemented, committed 4055373 (DONE; JSDoc only; the controller also refreshed the internal comment above useActiveDescendant(...) (navigable options, disabledOptionsFocusable, standalone press), noted by the implementer); prettier clean; review package review-A7-fix1.diff
Task A7: fix round 1/5 (5 addressed, 0 open; commits b90746c..4055373; re-review sonnet: clean; its out-of-scope note (docblock "not navigable and enabled") fixed by the controller in 3d2a900)
Task A7: complete (commits 268db28..3d2a900, review clean)
Wave A: complete (00e89a2..3d2a900); exit gate passed at b90746c (later commits JSDoc only)
Task B1: dispatched (base 3d2a900, sonnet; notes task-B1-dispatch-notes.md; R6 pickerLabels.ts)
Task B1: implemented, committed eaaf40d (DONE; story renders <Dropdown {...args} multiselect> to satisfy the overloads); both tsc programs verified clean
Known inter-wave failure (rule 21 class): public-types.test.ts flags DropdownComponent (then ComboboxComponent, ListboxComponent, …) as used but not exported until INTEGRATION exports them (spec §4.3, wave C) — not counted against wave B packages
Task B1: review dispatched (opus, review-B1.diff)
Task B1: review (opus) — Needs fixes: 1 Important (plan-mandated tests: D41 negatives vacuous or timing-dependent (announcer regions settle a frame later), form test asserts neither required nor reset-by-content, close test presses only Alt+ArrowUp, spec-listed tests missing), 7 Minor.
Ruling R15: B1 fix round takes Important 1 and M1-M7: restore 0.7's single-select order (onValueChange before onOptionSelect); mount the announcer only with multiselect (single-select Dropdown DOM unchanged from 0.7, principle 2) — B2 and C1 follow; the story in a Field (spec §2 P5-01); module-private sameValues/toggleValue helpers (src/components/input/pickerValues.ts) for B2/C1 (TagPicker may switch in B3); wording; value={null} tolerated as in 0.7; the duplicate-value warn asserted at the end. Not taken: functional updates for two toggles in one task (TagPicker has the same limitation; CLAUDE.md Testing requires separate tasks; a pure updater cannot announce) — cost if wrong: one fix round.
Task B1: fix round 1/5 dispatched (resumed implementer)
Task B1: fix round 1 implemented, committed cf4ec47 (DONE; all 8 findings; mutation-proven negatives; pickerValues.ts + test added); both tsc programs verified clean; review package review-B1-fix1.diff
Task B1: fix round 1/5 (8 addressed, 0 open; commits eaaf40d..cf4ec47; re-review sonnet: clean)
Task B1: minor (deferred): no order test for the multi-select branch (onValueChange before onOptionSelect); no test for multiselect changing at runtime on a live Dropdown (announcer child mount/unmount)
Task B1: complete (commits 3d2a900..cf4ec47, review clean)
Task B2: dispatched (base cf4ec47, opus; notes task-B2-dispatch-notes.md incl. R5, R7, R15)
Dispatch notes ready: task-B1..B5, C1, D (shared D1-D5), E (shared E1-E6)
Task B2: implemented, committed af01f3b (DONE_WITH_CONCERNS: beforeinput records the replaced selection (insertedText fallback for drops); ComboboxProps became a type alias (docgen restates freeform); onMouseDown/onMouseUp stay on the root; open: IME composition right after a toggle ends at its first update; maxLength counts the labels; freeform+multiselect from JS ignored silently; known public-types ComboboxComponent failure); both tsc programs verified clean; review package review-B2.diff
Ruling R16: D11 rule 2's intent ("the text the edit inserted") wins over its prefix/suffix mechanism, which returns '' when the typed text matches an end of the labels (typing "a" over "Apple, Banana"): the replaced selection is recorded on beforeinput, insertedText stays the fallback for drops and unknown selections — spec is the authority on intent; its mechanism is a means — cost if wrong: the beforeinput path must hold in real browsers (→ H1 real-browser checklist: typing a first/last letter of the labels, paste, IME composition over the labels).
Task B2: review (opus) — Needs fixes: 3 Important (I1 rule-1 selection lost when the labels return to a focused input (toggle, keyboard close, controlled change, reset): IME rewrite, maxLength blocks typing; I2 plan-mandated R7: a typed query equal to the labels is dropped and Enter submits the form; I3 ComboboxProps must stay an interface: the alias breaks generic extends (TS2312)), 6 Minor.
Ruling R17 (amends R7): D11 rule 3 applies to undo/redo edits (beforeinput inputType historyUndo/historyRedo) and to changes with no recorded beforeinput; any other edit whose text equals the labels is a query — D11 names the intent "(an undo)"; R7 read the mechanism too widely (the review probe: typing the one selected label then Enter submits the form) — cost if wrong: an undo in a browser without beforeinput inputType (none current) treats an equal text as a query.
Ruling R18: D11 rule 1 extended — whenever the labels return to a focused input (a toggle, a keyboard close, a controlled change, a reset), the whole labels text is selected again (a layout effect), so every edit replaces them natively; ComboboxProps stays an interface with freeform?: M extends true ? never : boolean; freeform with multiselect from JavaScript warns once (Combobox:freeform-multiselect); the placeholder shows when no selected value has an option (as Dropdown) — cost if wrong: re-selection may be announced by screen readers (→ H1 checklist).
Pending spec §10 notes (lead, before wave D): R16, R17, R18.
Task B2: fix round 1/5 dispatched (I1-I3, M1-M6; resumed implementer)
Task B2: fix round 1 implemented, committed 6f725aa (DONE; I1-I3, M1-M6; accepted: a paste over the labels is not clamped to maxLength (no limit while the labels show; clamping would rewrite mid-composition)); both tsc programs verified clean; review package review-B2-fix1.diff; re-review on opus (large, subtle fix diff across Combobox, Dropdown and the helpers)
Task B2: fix round 1/5 (9 addressed, 0 open; commits af01f3b..6f725aa; re-review opus: clean, 2 Minor notes)
Task B2: controller follow-up df519f2: toValues keeps a truthy non-string value from JavaScript as 0.7 did (re-review note 1, with a test); the Multiselect story hides the freeform control (out-of-scope note); verified: pickerValues/Dropdown/Combobox 342 pass, Combobox stories gate 9 pass, both tsc clean
Task B2: minor (deferred → H1 checklist): a pasted query longer than maxLength over the labels counts as a user edit; once the limit returns, Chromium's TooLong blocks Enter-submission with no active option (a submit click is unaffected)
Pending spec §10 notes (lead, before wave D): add M3's placeholder rule (D11 said "no placeholder while a value is selected"; now: while the labels text is non-empty) and ComboboxProps<true>['freeform'] is never (spec :311 says "has no freeform")
Task B2: complete (commits cf4ec47..df519f2, review clean)
Ruling R19: B3 runs on opus (R4 said sonnet) — B2 left Combobox's input with beforeinput, undo and re-selection machinery that B3's draft-to-query mapping must preserve — cost if wrong: model cost only.
Task B3: dispatched (base df519f2, opus; notes task-B3-dispatch-notes.md incl. R5, R6, R16-R18)
Spec §10 implementation notes written and committed 3079618 (R9, R13, R14, R12, D16 check, custom-picker duties, R15 plumbing, R16-R18, freeform never, placeholder) — landed while B3 runs; B3's review base is 3079618 (not df519f2)
Task B3: implemented, committed a5e96f3 (DONE_WITH_CONCERNS, all accepted: a picker that starts locked drops defaultQuery silently (as defaultOpen); setEditing(false) in the render-time previous-value block (set-state-in-effect rejects the effect); freeform toggled at runtime with a controlled query hits useControllable's mode-switch warning (edge, unhandled); React's render-phase warning logs once per module (the readOnly lock test proves it alone); TagPicker uses announceToggle/sameValues/EMPTY_VALUES); both tsc programs verified clean; review package review-B3.diff (base 3079618)
Task B3: note (→ G3 guide): server-side search keeps the selected value as a hidden option so the input keeps its label (the Async search stories do)
Task B3: review (opus) — Approved, 0 Critical/Important, 5 Minor (all five named risks backed by tests and scratch probes).
Ruling R20: the lock reset of the query (D12) is reported only on a lock transition (unlocked → locked while text is typed); a picker that mounts locked keeps a controlled query (hidden while locked, shown on unlock) and reports nothing — D12 names locking "while text is typed", a transition; the mount-time report wiped a query a parent restored (the review probe: URL state while disabled={loading}) — cost if wrong: a parent that expects a mount-time reset keeps a hidden query until unlock.
Task B3: fix round 1/5 dispatched (R20 + M2 query JSDoc + M3 lock-test name/controlled + M4a TagPicker async search test + M4b inline-filter highlight test + M5 filter JSDoc sentence; resumed implementer)
Task B3: fix round 1 implemented, committed c61f4fc (DONE; R20 lock transition via previous-value state; notes: TagPicker's filter JSDoc fits its model (a selected value without an option shows its raw value and warns; keep selected options in options); the render-phase guard is carried by the first lock test per file (React warns once per component per module)); both tsc programs verified clean; review package review-B3-fix1.diff
Task B3: fix round 1/5 (5 addressed, 0 open; commits a5e96f3..c61f4fc; re-review sonnet: clean)
Task B3: minor (deferred): no StrictMode test for the lock-transition report itself; LockState declared in both Combobox.tsx and TagPicker.tsx; the disabled/readOnly lock it.each variants catch a render-phase regression only in isolation (React warns once per pair per module)
Pending spec §10 notes (lead): R20 (the query lock reset only on a lock transition; a locked mount keeps a controlled query)
Task B3: complete (commits 3079618..c61f4fc, review clean)
Task B4: dispatched (base c61f4fc, sonnet; notes task-B4-dispatch-notes.md)
Task B4: implemented, committed 2923e66 (DONE; pass-through; multiselect tests render <Dropdown multiselect>/<Combobox multiselect> directly (the shared helpers type the single-select signature)); both tsc programs verified clean; review package review-B4.diff
Task B4: review (sonnet) — Needs fixes: 1 Important (plan-mandated: the JSDoc omits opening among the triggers), 1 Minor (the filter-change test used toHaveBeenCalledWith).
Task B4: fix round 1/5 by the controller, committed 0b00d8d: opening added to both JSDocs; also corrected "Fluent has no equivalent" (Fluent v9 has onActiveOptionChange; it reports neither hover nor the close, D14); exact call list in the test; verified: the 10 onActiveOptionChange tests pass, both tsc clean — trivial doc/assertion change, no subagent re-review (ruling R21: the controller may fix and verify a doc-only or single-assertion finding itself — cost if wrong: a wording slip reaches the final review)
Task B4: complete (commits c61f4fc..0b00d8d)
Task B5: dispatched (base 0b00d8d, sonnet; notes task-B5-dispatch-notes.md)
Task B5: implemented, committed 2f98d1c (DONE; incident: the implementer ran `git checkout -- <file>` twice to check RED against the old code and restored its work (verified by the controller: only its 5 files changed, eslint/tsc clean, Dropdown+Combobox 385 pass); no Combobox disabled-options story (notes named Dropdown only)); review package review-B5.diff
Ruling R22: every later dispatch states: never run git checkout, restore, stash, reset or any other git write; to check RED against the committed code, read it with `git show HEAD:<path>` into a scratch file and swap files with file tools, then restore — R1 forbids git writes and a checkout discards uncommitted work — cost if wrong: none.
Task B5: review (sonnet) — Approved, 0 Critical/Important, 3 Minor.
Task B5: minor (deferred): disabledOptionsFocusable picker tests cover the arrows only, not typeahead; no expectTypeOf for renderValue's conditional type; renderValue returning null and with a value without an option untested
Task B5: complete (commits 0b00d8d..2f98d1c, review clean)
Package P5-pickers: complete (B1-B5, 3d2a900..2f98d1c)
Task C1: dispatched (base 2f98d1c, opus; notes task-C1-dispatch-notes.md incl. R15, R22)
Task C1: implemented, committed c88da35 (DONE; deviations: keys from a portal inside the list ignored; focus tracking runs even when a consumer handler calls preventDefault; the list sets m-0 list-none px-0 overflow-y-auto (C-NATIVE); checkValidity wrapped in act); both tsc programs verified clean; review package review-C1.diff
Gate hole (→ F1/F3, INTEGRATION owns .storybook tests): .storybook/__tests__/exportDocblocks.test.ts skips compounds exported as `Object.assign(…) as X` (Dropdown, Combobox, Listbox since B1/B2/C1) — the C-DOCS check no longer covers them; fix the gate to unwrap the `as` cast (autodocs already do, .storybook/exportDocblocks.ts)
Task C1: H1 items: a list focused before hydration ignores keys until refocused; a focused list that becomes disabled may keep a stale focus state without a blur; options of a disabled list keep their pointer cursor and hover background
Gate hole fixed by the controller, committed f73cb4d: exportDocblocks.test.ts unwraps casts/satisfies/parentheses; Dropdown, Combobox and Listbox now checked (all pass); a guard test asserts they are found — landed while C1's review runs (C1's review base stays 2f98d1c..c88da35; the next C1 fix diff starts from f73cb4d)
Task C1: review (opus) — Needs fixes: 1 Important (plan-mandated: focus state follows only focus events: a server-rendered autoFocus list has dead keys after hydration; a list re-enabled after losing focus without a blur shows an active option unfocused; reviewer-verified fix: a layout effect keyed on [disabled] syncing focused from the root node's activeElement), 7 Minor.
Ruling R23: a blur while the list stays its root node's activeElement (a window switch) keeps the Listbox focused, so the keyboard position survives Alt+Tab as in a native select size list and the APG examples — D17's "active option only while the list has focus" is about focus moving elsewhere in the page — cost if wrong: the active option's outline stays while the window is inactive.
Task C1: fix round 1/5 dispatched (I1 + M1 disabled look, M2 consumer aria-disabled, M3 JSDoc, M4 R23, M5 client autoFocus, M6 tests; base f73cb4d; resumed implementer)
Task C1: minor (→ final review): a usePickerValue hook in pickerValues.ts could own the multi-select glue copied in Listbox, Dropdown and Combobox (useControllable with the D9 cast, toggle-and-announce, reset)
Pending spec §10 notes (lead): R23 (a window switch keeps the Listbox focused), the Listbox focus sync from the DOM at mount and on disable (hydration, a lost focus without a blur), client-side autoFocus
Task C1: fix round 1 implemented, committed 3c70f25 (DONE; accepted refinement: no focus() while hydrating (the browser applies the server autofocus; a user focus move before hydration is kept); a jsdom autofocus reflection patch confined to one test); both tsc programs verified clean; review package review-C1-fix1.diff
H1 item (C1): a browser that drops focus without a blur while the Listbox is enabled (an ancestor becomes display:none) leaves the focus state stale until the next focus event
Task C1: fix round 1/5 (7 addressed, 0 open; commits f73cb4d..3c70f25; re-review sonnet: clean)
Task C1: minor (deferred): the jsdom autofocus patch is applied a few lines before its try (restored in finally)
Task C1: complete (commits 2f98d1c..3c70f25, review clean)
Task C2: dispatched (base 3c70f25, sonnet; notes task-C2-dispatch-notes.md)
Task C2: implemented, committed 061b8f4 (DONE; notes: CommandPalette aria-expanded is true (its list is always shown); only the Groups story gives the list a height); dev tsc verified clean; review package review-C2.diff
Task C2: review (sonnet) — Approved, 0 Critical/Important, 2 Minor; flagged spec §4.4 item 8 (the custom picker of the Listbox story opens, filters, selects and submits) vs the select-only button font picker the brief prescribed.
Ruling R24: the acceptance story's custom picker becomes an editable font picker: an <input> combobox (mode: 'editable') whose typed text filters the fonts through useListbox's filter, a plain <input type="hidden" name> submits the choice, the two custom-picker duties kept, still only package-entry names — spec §4.4 wins over §2 and the plan where they disagree (the spec's own rule), and wave C's integration test (F3) writes this picker against the entry — cost if wrong: one story reworked.
Task C2: fix round 1/5 dispatched (R24 + M1 placeholder text-body-1 + M2 a comment on the palette's announcements; resumed implementer)
Task C2: fix round 1 implemented, committed 0a25cb6 (DONE; the editable FontPicker filters, selects and submits; hand-tested end to end; eslint/tsc clean); review package review-C2-fix1.diff
Task C2: fix round 1/5 (3 addressed, 0 open; commits 061b8f4..0a25cb6; re-review sonnet: clean, 1 Minor)
Task C2: controller follow-up da44cf8 (R21): the custom picker's onDismiss also clears its draft (re-review Minor; the integration test copies this picker); stories gate 8 pass, eslint/tsc clean
Task C2: complete (commits 3c70f25..da44cf8)
Package P5-listbox: complete (C1-C2, 2f98d1c..da44cf8)
Task D1: dispatched (base da44cf8, sonnet; notes task-D-dispatch-notes.md)
Spec §10 notes added, committed 517f6eb (R20, R23 + the Listbox focus sync and client autoFocus, R24) — landed while D1 runs; D1's review base is 517f6eb
Task D1: implemented, committed ad2a739 (DONE; notes: ColorSwatchProps leaves icon/borderColor/size/shape/disabled to D2; the production-inert half of the context test added; no wave-allow-color comments in test files (not scanned)); both tsc programs verified clean; review package review-D1.diff (base 517f6eb)
Task D1: review (sonnet) — Needs fixes: 1 Important (no rerender/StrictMode test for the duplicate-value registry, which D2-D5 build on; RadioGroup and TabList test theirs), 1 Minor ("(D18)" in two public JSDoc comments).
Task D1: fix round 1/5 dispatched (resumed implementer)
PAUSED by the user (2026-09-27). Task D1 fix round 1 was stopped near its end (its last step: re-running tests to confirm an act() warning was gone); uncommitted edits in src/components/input/SwatchPicker.swatches.tsx, SwatchPicker.tsx and __tests__/SwatchPicker.swatches.test.tsx (base ad2a739). To resume: SendMessage the D1 implementer to finish verification and append its "Fix round 1" report, then commit, re-review, and continue with D2 (notes task-D-dispatch-notes.md). Remaining after D: E1-E6 (task-E-dispatch-notes.md), wave C F1-F3 (task-F-dispatch-notes.md), wave D G1-G4, wave E H1 (task-H1-dispatch-notes.md), wave F I1 (after Phase 4 is on main), final review.
D1 fix round committed by the controller after the pause, 56566ec (verified: SwatchPicker/swatches/ColorPicker 145 pass clean, eslint, both tsc); the fix round's re-review is still owed. Branch pushed to origin (feat/fluent-parity-phase-5, upstream set) at the user's request.
