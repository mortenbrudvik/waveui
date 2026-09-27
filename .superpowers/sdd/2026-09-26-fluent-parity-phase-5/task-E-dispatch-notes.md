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
