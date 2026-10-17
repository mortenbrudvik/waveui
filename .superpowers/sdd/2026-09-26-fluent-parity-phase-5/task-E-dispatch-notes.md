# Package P5-calendar (E1–E6) — dispatch notes (controller)

Binding spec: `docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md` §2 P5-05 (the whole section, with its types and test lists) and rulings D24–D37; §0.2 rules 22, 23 (the DatePicker suite is the Calendar's regression suite), 24, 25, 26; §6.4 (the only DatePicker tests that may change). CLAUDE.md conventions apply in full.

## Shared context
- **Files the package owns:** `src/lib/date.ts` (new, server-safe: `src/lib` modules get no `"use client"` banner), `src/components/input/dateUtils.ts`, `DatePicker.tsx`, new `Calendar.tsx` and `Calendar.views.tsx`, their tests, `stories/Calendar.stories.tsx` (new) and `stories/DatePicker.stories.tsx`. `src/lib/types.ts` already has `DayOfWeek` and `FirstWeekOfYear` (wave A; read-only).
- **No barrel or entry edits** (wave C exports `Calendar`, its props, labels and details types, and the date helpers). Tests and stories import from module paths (rule 25).
- **Rule 23:** a DatePicker test other than those §6.4 lists never changes; if one needs a change, stop and report it with the reason.
- **Test hygiene:** CLAUDE.md Testing — clean output; exact warning assertions; StrictMode once for `onValueChange`; RTL tests for directional keys; a test that appends its own container (`renderToString` + `hydrateRoot`) removes it in `try`/`finally`; fake timers per the Testing section.
- **Models (ruling R4):** E2 and E4 on opus; E1, E3, E5, E6 on sonnet (the controller may upgrade E3/E5 if a first attempt struggles).

## E1
- The brief's code; `dateUtils.ts` imports and re-exports what its importers use (DatePicker, TimePicker keep their imports). JSDoc on every exported helper (they become public in wave C) with `@default` where a parameter has one, and the D33 note that every helper returns local midnight.

## E2
- A pure move: the DatePicker suite passes with no test edited (rule 23). `CalendarView` is a module export of `Calendar.tsx` (internal, not in any barrel); `Calendar.views.tsx` holds the day grid. The focus trap's `initialFocus` query and the deletion of 0.7's `openSeen` reset as the brief says; the view remounts on every opening (D24).

## E3
- D24, D25, D28, D35 in full; `useIsClient` for today (D28: server HTML and the hydration render treat today as unknown; the `Calendar:hydration-date` warning after a hydration render without `today`, `initialVisibleDate` or `value`); the root `role="group"` takes the Field's label (`labelable: false`), description and `aria-invalid`, never `aria-required` (the hidden `labels.required` hint joined into `aria-describedby`); `HiddenInput` ISO `yyyy-mm-dd`, reset to `defaultValue`; `CalendarView headingAs="div"` (D34).

## E4
- D26/D27 as the brief lists; focus moves into the new grid in the same commit as the view change (a layout effect keyed on the view), never to `<body>`; Escape in the month and year views calls `preventDefault()` (C-POPUPS); only the §6.4 DatePicker Tab-order tests change.

## E5
- D29–D32 as the brief lists; `renderDay` content must be non-interactive and `dayLabel` sets the name (JSDoc says so); `markedDates` dot in `currentColor`; "Go to today" natively `disabled` outside the bounds (not C-DISABLED's focusable form).

## E6
- Stories per the brief (module-path imports for Calendar; every story named; args forwarded; fixed `today` where a story shows today, so snapshots and the a11y gate are stable).

## Ruling R22 (git, every task)
Never run `git checkout`, `restore`, `stash`, `reset` or any other git write. To check RED against the committed code, read it with `git show HEAD:<path>` into a scratch file, swap the files with file tools, then restore them.

## After the Phase 3 merge (ruling R26, spec rule 22)
Every part the calendar tasks add (Calendar root, CalendarView header, heading button, the day, month and year grids and cells, week-number cells, the marked-day dot, the footer buttons) follows P3-00: a stable class name from the registry in `src/lib/classNames.ts`, its registry constant and JSDoc, and a case in `src/components/input/__tests__/stableClassNames.test.tsx`. DatePicker already has its Phase 3 classes: the extraction (E2) moves them with the markup unchanged, and Phase 3's DatePicker stable-class tests count as part of the regression suite (rule 23).

## E4 additions (from E3's review)
- Calendar JSDoc "Server rendering": `today`, `initialVisibleDate` or a value fix the month; only `today` marks the day in the server HTML — reword so the first sentence does not overpromise.
- The fallback tab stop is the first day in range (it may be an unavailable day, focusable by design): align the JSDoc wording ("first day in range").
- `required`/`labels.required` JSDoc: a consumer `aria-required` alone also shows the Required hint (ARIA only, not native validation).
- Add a StrictMode form-reset test: `onValueChange` once with the restored range.

## E5 additions (from E3's review)
- Widen the `labels` prop JSDoc as E4/E5 use more members; `DatePickerLabels extends CalendarLabels` with `close` (D36); `CalendarValueChangeDetails.range` JSDoc gains the `selectionRange` wording.

## E5 additions (from E4's review, task-E4-review.md)
- M1: DatePicker JSDoc: Escape steps back from the month/year view first (closes only from the day view); mention the heading button.
- M2: add a test: minDate after maxDate in different years — arrow keys in the year/month views never hang (pin the current behaviour).
- M3: a controlled value that moves while the month view is open: decide with R29 (the shared view shows the value's month) — the month view follows the new year; add the test.
- M4: `showMonthPicker` turned off while the month or year view is open returns to the day view (derive during render, C-HOOKS); test it, focus not on body.
- M5: add a StrictMode drill-down test (focus in the grid, no duplicate callbacks) and tests pinning the Escape handler's IME (isComposing), already-defaultPrevented and own-event guards.
- M6: move the two DatePicker checks (dialog name with the heading button, Escape in the month view keeps the dialog open) from Calendar.test.tsx to DatePicker.test.tsx as additions (new tests are allowed; existing ones outside §6.4 stay unchanged).
