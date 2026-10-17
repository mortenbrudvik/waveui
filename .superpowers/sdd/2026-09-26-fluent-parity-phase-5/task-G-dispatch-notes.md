# Wave D — DOCS (G1–G4) — dispatch notes (controller)

Binding spec: `docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md` §5 (5.1 CHANGELOG, 5.2 README, 5.3 CLAUDE.md, 5.4 guides, 5.5 ROADMAP, 5.6 comparison and gap report) and §10 (implementation notes). The plan's wave D (docs/superpowers/plans/2026-09-26-fluent-parity-phase-5.md ≈2123-2139) names one commit per task. Git ruling R22: never run `git checkout`, `restore`, `stash`, `reset` or any other git write; the lead commits.

## State of the branch
- `main` has 0.8.0 released (Phase 3, merged into this branch: 5b63233, then the release commit 44a9b41 via the merge after wave C). Phase 4 (0.9.0) is **not** on main yet; it merges in wave F (I1), which then re-merges the documents and remeasures sizes against 0.9.0.
- The CHANGELOG therefore gains `## [0.10.0] - Unreleased` directly above the dated 0.8.0 section. Write "Upgrading from 0.9" as the spec says (0.9 will sit between them after wave F); where a statement depends on Phase 4 code that is not on this branch, keep it to what this branch does.
- Docs never hard-code test counts (CLAUDE.md). Never write a bare Tailwind utility name in `src` comments (does not apply to Markdown docs).

## Rulings and notes made during implementation (spec §10 and, where user-visible, the CHANGELOG)
Add each to spec §10 (implementation notes, the existing format there) if it is not already recorded; the ones marked CHANGELOG also go into the 0.10.0 section (Changed → Behaviour/DOM/Types as fits).
- R25: a disabled swatch that is selected keeps its selected state (aria-checked, check mark, ring) under the slash; it stays unreachable. (§10)
- D2 borderColor: a swatch's `borderColor` is applied through a `--wave-swatch-border` custom property so the forced-colours edge wins; the unselected hover border replaces the custom colour. (§10; CHANGELOG DOM note if swatches existed in 0.8 with borderColor — check)
- P3A DOM: the Dropdown, Combobox and TagPicker popups render through the shared listbox surface and carry `wave-listbox-surface` and `wave-listbox-surface__list` in addition to their own stable classes. (§10; CHANGELOG DOM)
- R27: CalendarView takes an internal part-class map; DatePicker keeps its own stable classes and the standalone Calendar uses `calendarClassNames`. (§10)
- R29: a DatePicker whose value changes while its calendar is open now shows the new value's month (0.8 kept the old month); the month and year views follow it too, and an out-of-range year is clamped to the bounds. (§10; CHANGELOG Behaviour)
- R30: DatePicker has stable class keys for every calendar part it renders, including the heading button and the month and year cells (beyond the keys §3.3 listed). (§10; CHANGELOG Added under stable classes)
- R31: in the year view, arrow keys stay on the 12-year page while the target year is on it; PageUp/PageDown move a decade. (§10; README keyboard rows)
- Calendar/DatePicker Escape: Escape in the month or year view steps back one view (header and footer alike); only the day view's Escape closes a DatePicker. (§10 if not already under D26; README keyboard rows; CHANGELOG Behaviour for DatePicker)
- `DatePickerLabels` now extends `CalendarLabels` (adds `close`); DatePicker ignores the inherited `required`. (CHANGELOG Types)
- The forced-colours marked-day dot and the Safari focus edge case are on the H1 real-browser checklist, not docs.
- Earlier rulings R1–R24 are already in spec §10; check, do not duplicate.

## Size report (G1)
Spec §5.1 asks for sizes measured with `npm run build` and the probes' reported sizes against 0.7.0 (the plan predates 0.8.0; measure against the latest released baseline available on this branch, 0.8.0, and say so; wave F remeasures against 0.9.0).

## G2 additions (from G1)
- README links into the CHANGELOG at ≈1505, 1521 and 1536 now point one version too new after the 0.10.0 section shifted the numbered anchors: they become `#changed-1`, `#changed-2`, `#changed-3` (verify each target heading).

## G3 additions (from G2)
- CLAUDE.md "What is this?" still says 68 components; README now says 73 (verify the count against README's component list and update CLAUDE.md to match).
- Once the guide gains its "Building a custom picker" section, add a README link to it from the "Listbox and custom pickers" usage note (G3 may edit that one README line).

## G4 additions (from G3 review, task-G3-review.md) — apply on the merged tree
- WAVE-UI-GUIDE.md ≈600 and ≈1472: add Listbox, SwatchPicker and Calendar to the compound list and the `labels` list as they apply (check which are compounds and which take `labels`).
- WAVE-UI-GUIDE.md ≈869/872 (Pattern 11 example): `expanded` is a local variable, not a `listbox` member; `onKeyUp` is a no-op in standalone mode — fix the prose/example.
- testing-best-practices.md ≈714-716 and CLAUDE.md ≈214: the scrollIntoView advice should mention the component tests' `vi.spyOn` form as well as the hook tests' replace-and-restore; fix the "that pointer" wording.
