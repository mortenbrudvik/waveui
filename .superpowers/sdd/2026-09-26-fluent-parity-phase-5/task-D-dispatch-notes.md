# Package P5-swatches (D1–D5) — dispatch notes (controller)

Binding spec: `docs/superpowers/specs/2026-09-26-fluent-parity-phase-5-design.md` §2 P5-04 (the whole section) and rulings D18–D23; §0.2 rules 21 (compound members and the bridge), 22 (0.7 styles), 24 (Tailwind words), 25 (stories import module paths), 26 (JSDoc). CLAUDE.md conventions apply in full.

## Shared context
- **Files the package owns:** `src/components/input/SwatchPicker.tsx`, new `SwatchPicker.context.ts` and `SwatchPicker.swatches.tsx` (component-prefixed helpers, module-private except the exported swatch components), new `src/hooks/useRovingGrid.ts` (internal: not exported from any barrel or the entry), their tests, `stories/SwatchPicker.stories.tsx`. `ColorPicker.tsx` renders a SwatchPicker: its tests must stay green, and it is not yours to change (report a needed change).
- **No barrel edits** (wave C exports `ColorSwatch`, `ImageSwatch`, `EmptySwatch`, `SwatchPickerRow`, their props and `SwatchPickerLabels`). Tests and stories import from module paths. `verify-dist`'s `PENDING_FLAT_EXPORTS` already lists `SwatchPicker` (rule 21): once D4 attaches `SwatchPicker.Row`, `integration.test.tsx`'s source-level flat-name case fails for `SwatchPickerRow` until wave C — a known failure, not yours.
- **Colours:** swatch colours are runtime user colours — raw values in component code carry `// wave-allow-color: <reason>`; fixture colours in tests and stories carry `// wave-allow-color: fixture` (C-TOKENS; the conventions gate scans stories too).
- **D18:** swatches read `SwatchPickerContext` (C-CONTEXT: null default, `reportMissingContext(<Swatch>, 'SwatchPicker')`, inert value in production); a swatch's `ref`, `className`, `style`, name and rest props go to its `<button>` in every layout (explicit exception to C-ROUTING's root/control split, so a wrapping Tooltip's ARIA and handlers reach the focused element); duplicated values warn once per value (C-DEV, from an effect).
- **Warnings:** exact messages from the briefs; tests assert the exact set of warn calls and nothing else logged.
- **Test hygiene:** CLAUDE.md Testing (clean output, StrictMode once for value callbacks, RTL tests for directional keys, `asClientReference` for compound parts found in children).
- **Models (ruling R4):** D4 on opus; D1, D2, D3, D5 on sonnet.

## D1
- `items` render through `ColorSwatch` before `children`, in one provider; every 0.7 `SwatchPicker.test.tsx` case passes unchanged except `:198` (spec §6.4). The registry: a `Map<string, number>` in a ref, `register` from a layout effect returning the remover; a count > 1 warns once per value from an effect.

## D2
- D21/D22 as the brief lists. The EmptySwatch arrow guard in the row layout: the root's `onKeyDown` skips the roving handler when `event.target` carries `data-wave-empty-swatch` (D4 must keep it in the row layout). Both `icon` slots are glyphs inside a wired button: decorative, a button unwrapped through `unwrapButtonGlyph` with the brief's keys; `EmptySwatch.icon` follows the optional-indicator rule (C-SLOTS).

## D3
- Read `src/hooks/useRovingTabIndex.ts` first and use its real API (option names, `focusValue`, `getTabIndex`, `containerProps`); adapt the brief's snippet to it rather than the reverse (it is not yours to change — report a needed change). The key handler ignores events whose target is not inside the container in the DOM (C-COMPOSE). Arrow intents through `getArrowIntent(key, { orientation, dir: getDirection(el) })` for Left/Right (C-LOGICAL, RTL test).

## D4
- D20 in full (the brief's list). Implicit rows through `flattenChildren` + `isElementOfType(node, SwatchPickerRow)` (never `child.type ===`), consecutive non-Row nodes grouped, `items` first; tests with `asClientReference(SwatchPickerRow)`. `aria-required` only on the `radiogroup` root; the grid layout and tab mode say "required" through a hidden `<span id>` with `labels.required ?? 'Required'` joined into `aria-describedby` (`joinIds`), a consumer `aria-required` dropped there. `SwatchPicker.Row` is a compound member with the flat name `SwatchPickerRow` exported from the module with its own JSDoc; the compound JSDoc sits only on the exported `Object.assign(…)` const.

## D5
- D19 tab mode in both layouts; stories per the brief (module-path imports, fixture colours marked, every story named, args forwarded); the stories gate for `Components/Input/SwatchPicker`.

## Ruling R22 (git, every task)
Never run `git checkout`, `restore`, `stash`, `reset` or any other git write. To check RED against the committed code, read it with `git show HEAD:<path>` into a scratch file, swap the files with file tools, then restore them.
