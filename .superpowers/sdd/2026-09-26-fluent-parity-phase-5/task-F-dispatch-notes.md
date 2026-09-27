# Wave C — INTEGRATION (F1–F3) — dispatch notes (controller)

Binding spec: `docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md` §4 (4.3 exports, 4.4 integration tests, 4.5 public types), §6.2 (verify-dist probes), §10 (implementation notes: where the code deliberately differs from the spec's letter). CLAUDE.md applies in full. Git ruling R22: never run `git checkout`, `restore`, `stash`, `reset` or any other git write.

## F1 — barrels, flat names, story imports, the empty bridge
- The brief's `index.ts` is `src/components/input/index.ts`; `src/index.ts` gains the date helpers (§4.3).
- `PENDING_FLAT_EXPORTS = []` and reword its docblock in `scripts/verify-dist.mjs` (≈75-90) back to "The list is empty: …" with the Phase 5 history in one clause (A7 review M5); restore `verify-dist.test.mjs`'s bridge case to the 0.7 form (empty list, clean `checkFlatExports`, `final: true` clean).
- Stories: every `../src/components/...`/`../src/hooks/...` import of the new names becomes `../src` (Listbox, Calendar, SwatchPicker stories; check Dropdown, Combobox, TagPicker, DatePicker stories too).
- Known failures that must disappear here: `integration.test.tsx`'s source-level flat-name case (`SwatchPickerRow`) and `public-types.test.ts`'s `DropdownComponent`/`ComboboxComponent`/`ListboxComponent` reports.

## F2 — verify-dist probes, fixtures, server probe, declarations
- As the brief says; additionally (A7 review M6): give `verify-dist.test.mjs`'s `checkServerImport > treats "use client" modules as client references` test a `30_000` timeout like its siblings (it timed out once at 10.6 s under load).

## F3 — integration and public-type tests; the full gate
- §4.4's eight cases. Item 8 per ruling R24: "the custom picker of the Listbox story" is the editable font picker of `stories/Listbox.stories.tsx` ("Custom picker": an `<input>` combobox on `useListbox({ mode: 'editable' })` filtering through `filter`, `useListboxPopup`, `ListboxSurface`, a plain hidden input submitting the font) — write it in the test against the package entry only (`import { … } from '../index'`), and assert it opens, filters, selects and submits (`FormData`).
- §4.5 with §10's corrections: `ComboboxProps<true>['freeform']` is `undefined` (a `never`-typed member, ruling R18 — not an absent key); `ComboboxProps` stays extendable by a generic interface (`interface W<M extends boolean = false> extends ComboboxProps<M> {}` compiles).
- The full gate, each command separately (the sandbox may refuse `&&` chains): `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`. Known possible flake: a Tooltip act() warning from `Popover.test.tsx` under full-suite load (ledger, A2) — if it appears, rerun that file alone and report both runs; do not change Popover or Tooltip.
