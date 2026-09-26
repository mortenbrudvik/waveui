# WaveUI 0.10.0 — Fluent Parity Phase 5 Design (pickers)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-5` (worktree `.claude/worktrees/fluent-parity-phase-5`, from `main` d5a84bd, where 0.7.0 = Phases 1 and 2 is released) · Package: `@mortenbrudvik/waveui` → **0.10.0**. Phase 3 (0.8.0) and Phase 4 (0.9.0) are designed and built at the same time in other sessions, on their own branches; both merge to `main` before this branch, which merges them in before its release (§3.3, wave F).
> Scope: Phase 5 of [`docs/ROADMAP.md`](../../ROADMAP.md): the items P5-01 … P5-05. They close 8 medium and 20 low gaps of the Fluent UI v9 comparison (§7).
> Inputs: the roadmap's Phase 5 section, its goals and naming (§1), principles (§2) and process (§3); the Phase 2 spec [`2026-09-26-fluent-parity-phase-2-design.md`](2026-09-26-fluent-parity-phase-2-design.md), the model for this document; the first drafts of the Phase 3 and Phase 4 specs (their branches, 2026-09-26), read for the merge: P3-00's class-name registry (`src/lib/classNames.ts`, the `class-names` gate rule, the stability promise) and P4-01's input recipe (`CoreSize`, `InputAppearance`, `useInputLook`, `pickerStyles.ts`); the verified gap entries `dropdown-*`, `combobox-*`, `filter-*`, `listbox-*`, `option-*`, `swatchpicker-*`, `colorswatch-*`, `calendar-*` and `datepicker-*`; Fluent read at its source (`microsoft/fluentui` master 8add8c8: `react-combobox` with its `docs/Spec.md`, `react-aria`'s `activedescendant`, `react-tag-picker`, `react-swatch-picker` 9.6.2, `react-calendar-compat`, `react-datepicker-compat`); the WAI-ARIA APG listbox, combobox, grid and date picker dialog patterns. Every API below was checked against the 0.7.0 source it changes: `useListbox.ts`, `useTypeahead.ts`, `useRovingTabIndex.ts`, `Option.tsx`, `Dropdown.tsx`, `Combobox.tsx`, `Combobox.expand.tsx`, `pickerStyles.ts`, `TagPicker.tsx`, `TimePicker.tsx` (a `useListbox` consumer this phase must not change), `List.tsx` (the generic selection typing), `SwatchPicker.tsx`, `colorUtils.ts`, `ColorPicker.tsx` (an `items` consumer), `DatePicker.tsx`, `dateUtils.ts`, `HiddenInput.tsx`, `Button.slots.tsx`, `slot.ts`, `styles.ts`, `aria.ts`, `dev.ts`, `lib/types.ts`, `scripts/verify-dist.mjs` and their tests.
> Maintainer rulings (binding, from the design review of 2026-09-26, six sections approved one by one): (1) the release is 0.10.0 with a new `## [0.10.0] - Unreleased` CHANGELOG section, built in parallel with Phases 3 and 4 and merged after both; P5-01's dependency on P4-01 is resolved in that merge (D1); (2) `useActiveDescendant` is state-based and extracted from `useListbox`, which is rebuilt on it (D3); (3) a multi-select Combobox shows the selected labels while there is no query, and the first edit replaces them (D11); (4) SwatchPicker's grid layout is an APG grid with Fluent's semantics (D20); (5) the month and year pickers are a drill-down in one pane, with no side-by-side layout (D26). The Phase 2 lead rulings carry over: Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, extra data in an optional `details` argument); APG behaviour first.
> Status: first draft, written after the design review of 2026-09-26. To be reviewed three times (API conventions; accessibility and behaviour; the code, sequencing and verification) before the maintainer's approval; §9 records the review points not applied and why. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). The open questions of §8 are answered by the maintainer before wave A starts (roadmap §3, entry criteria).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F5-foundation` | `useActiveDescendant` (new, public); `useListbox` rebuilt on it, with `disabledOptionsFocusable`, `onActiveValueChange`, the standalone mode and its public JSDoc; `Option` (`checkIcon`, the multi-select box) and `OptionGroup` (optional rich `label`, routed names); `ListboxSurface` and `useListboxPopup` made public; `DayOfWeek` and `FirstWeekOfYear` in `src/lib/types.ts`; the entry exports of the listbox primitives; the `verify-dist` flat-name bridge | P5-03 (primitives, Option parts); the shared pieces of P5-01 and P5-02 | wave A |
| `P5-pickers` | Dropdown, Combobox and TagPicker: multi-select, `filter` and `query`, `onActiveOptionChange`, Dropdown `expandIcon` and `renderValue`, `disabledOptionsFocusable` on Dropdown and Combobox, in the order P5-01 → P5-02 → P5-03 | P5-01, P5-02, P5-03 (Dropdown and Combobox parts) | wave B |
| `P5-listbox` | the standalone `Listbox` (`Listbox.Option`, `Listbox.OptionGroup`) and its stories, among them the acceptance story (a custom picker built only on public API) and a `useActiveDescendant` command palette | P5-03 (Listbox) | wave B |
| `P5-swatches` | SwatchPicker children, `layout`, `focusMode`, `spacing`, the `'extra-small'` size; `ColorSwatch`, `ImageSwatch`, `EmptySwatch`, `SwatchPicker.Row`; the internal `useRovingGrid` | P5-04 | wave B |
| `P5-calendar` | `Calendar` (new) and DatePicker rendered on it; the month and year views, week numbers, marked days, custom day content, range selection, "Go to today", DatePicker's close button; the public date helpers in `src/lib/date.ts` | P5-05 | wave B |
| `INTEGRATION` | barrels, the flat names of the new compound members, the cross-package tests (Field, forms, Dialog, Tooltip, Server Components), public type tests, the `verify-dist` flat names and probes | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP, `docs/FLUENT-UI-COMPARISON.md`, the gap report's two missing ids | — | wave D |
| lead | the final gate (wave E) and the merge with Phases 3 and 4 (wave F) | — | waves E, F |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) apply unchanged, with F5 in place of F1. So do the Phase 2 rules 15 (no built-in motion), 16 (pointer tests) and 17 (direction). In addition:

19. **Wave A is exclusive.** `F5-foundation` lands and is committed by the lead before wave B starts. Because it runs alone, it may edit `src/index.ts`, `src/components/input/index.ts` and `src/__tests__/public-types.test.ts` for the listbox primitives (§1.6) and `scripts/verify-dist.mjs` for the bridge (§1.7); every other barrel, public-types and `verify-dist` change is INTEGRATION's.
20. **The listbox seam is frozen in wave B.** The modules, members and types listed in §4.1 keep their names, types and meaning. `useActiveDescendant.ts`, `useListbox.ts`, `useTypeahead.ts` and `Option.tsx` have no owner in wave B (read only); a change is a change request (rule 7) with a failing test.
21. **Compound members.** `P5-listbox` attaches `Listbox.Option` and `Listbox.OptionGroup` (it owns `Listbox.tsx`) and `P5-swatches` attaches `SwatchPicker.Row` (it owns `SwatchPicker.tsx`); each module also exports the flat names (`ListboxOption`, `ListboxOptionGroup`, `SwatchPickerRow`). INTEGRATION adds them to the input barrel in wave C. Until then `verify-dist`'s `PENDING_FLAT_EXPORTS` lists `'SwatchPicker'` (§1.7); `Listbox` needs no entry, because it is not exported before wave C.
22. **Phases 3 and 4 are not anticipated.** Waves A to E build on the 0.7 API of the files they change: no stable class names (P3-00), no `size` or `appearance` (P4-01), no new tokens. Wave F adapts (§3.3). The branch starts from `main` d5a84bd, which has neither phase.
23. **The DatePicker suite is the Calendar's regression suite.** `P5-calendar` moves DatePicker's grid into `Calendar.tsx` without changing a DatePicker test other than the ones §6.4 lists. A DatePicker test that needs another change is reported to the lead with the reason, not edited.
24. **Tailwind words.** JSDoc and comments under `src/components` and `src/lib` never write a Tailwind utility as a bare word (CLAUDE.md "Styling"): the swatch and calendar docs name "the grid layout" and "the row element" where needed, never a bare class name that no class string uses (docs/WAVE-UI-GUIDE.md Pattern 5).

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; Phase 1 and 2 rulings are cited as "Phase 1 D21" and "Phase 2 D11".

- **D1 — Parallel phases and one merge.** Phase 5 is designed and built while Phases 3 and 4 are built in other sessions. The roadmap's entry criterion ("0.9.0 merged to `main`") is waived for the start, not for the merge: this branch merges to `main` only after Phase 4, which carries Phase 3. P5-01 depends on P4-01 for the look only, so the multi-select mode is built on 0.7's Dropdown and Combobox styles and receives P4-01's sizes and appearances in wave F, where the lead also applies P3-00's registry to every part this phase adds (§3.3). *Why:* the maintainer runs the three phases in parallel (2026-09-26); the only code dependency (P5-01 → P4-01) is visual, and resolving it once in a merge is cheaper than sequencing three phases.
- **D2 — APG listbox semantics for multi-select.** `role="listbox"` with `aria-multiselectable="true"`, and options with `aria-selected`, in Dropdown, Combobox, the standalone Listbox and (as in 0.7) TagPicker. Fluent switches a multi-select listbox to `role="menu"` with `menuitemcheckbox` options. *Why:* the APG listbox pattern (roadmap principle 5); `useListbox` and TagPicker already render it; a combobox's popup must be a listbox, grid, tree or dialog.
- **D3 — `useActiveDescendant` is state-based and `useListbox` is built on it (maintainer ruling).** The hook keeps the moved-to item in React state, derives `activeValue` and `activeDescendantId` during render and exposes navigation methods. It owns the highlight rules `useListbox` follows in 0.7: a moved-to item is dropped when it leaves `items` or the hook is disabled and never comes back without a user action; a `fallback` is active while nothing was moved to; the first item becomes active when the items change (opt-in); pointer moves are not scrolled into view. `useListbox` keeps its API and delegates to it. Fluent's `useActiveDescendant` walks the DOM with a TreeWalker and writes `aria-activedescendant` imperatively. *Why:* one model for the library; SSR-safe (nothing reads the DOM during render, and the id is derived, not written); the 0.7 `useListbox` suite (2,460 lines) guards the refactor; P7-03 documents the hook with the focus utilities.
- **D4 — `useListbox` becomes public as a whole.** Its options and result, `useListboxOption`, `ListboxContext`, `collectOptionLabels`, `markListboxElement`, `ListboxSurface` and `useListboxPopup` are exported with their types. The roadmap's "documented stable subset" is this set; the store's `register` and `getIndex` members are documented as the contract of option components. *Why:* a custom picker needs each of them (the acceptance story is built only on public API), and a subset of a result type cannot be published without a wrapper that duplicates it.
- **D5 — The standalone mode.** `useListbox({ mode: 'standalone' })` serves a listbox that holds focus itself. `getListboxProps()` returns `tabIndex: 0` and `aria-activedescendant`, and no mouse-down prevention (a click focuses the list); ArrowDown, ArrowUp, Home, End, PageUp, PageDown and typeahead move the active option; Space and Enter commit (toggle with `multiple`), never close, and keep the committed option active; Tab, Escape and Alt+Arrow are not handled; `onOpenChange` is optional and never called; `open` means "the active option is shown" (the Listbox passes its focus state). *Why:* the Listbox needs the registration, groups, labels, typeahead and commit of the pickers; a second hook would duplicate the registry.
- **D6 — Disabled options stay skipped by default; `disabledOptionsFocusable` opts in.** With it, disabled options join every navigation path (arrows, Home, End, PageUp, PageDown, typeahead and the `autoHighlight` fallback) and still never commit: Enter, Space and a click do nothing on them and the list stays open, and Tab and Alt+ArrowUp in single-select select-only mode close without committing. Fluent keeps them reachable always (`option-1`). *Why:* the roadmap's opt-in; the 0.7 default stays (principle 2); APG allows both.
- **D7 — `checkIcon` is a required indicator** (Phase 1 D21). `Option`'s `checkIcon?: Slot<'span'>` replaces the check glyph; `null`, `undefined` and a value that renders nothing keep the default, and a value that renders nothing warns once from an effect (`Option:checkIcon-empty`). Fluent lets `checkIcon={null}` remove it. *Why:* the check is the non-colour sign of the selection (WCAG 1.4.1).
- **D8 — The multi-select box.** In a listbox with `multiple`, every option draws its check inside a 16px checkbox square: `rounded-xs border`, unchecked `border-stroke-accessible bg-transparent` with `forcedColors.control`, checked `border-primary bg-primary text-primary-foreground` with `forcedColors.selected`; the glyph shows only while selected. Single-select options keep the 0.7 check. The option learns the mode from the listbox context (`multiple`, §1.2). *Why:* Fluent's look; a list of checkboxes reads as multi-select at a glance; Checkbox's own colours.
- **D9 — Generic multi-select typing** (List's precedent, 0.5). `DropdownProps<M extends boolean = false>`, `ComboboxProps<M …>` and `ListboxProps<M …>` take `multiselect?: M`; while `M` is `true`, `value` and `defaultValue` are `readonly string[]` and `onValueChange` and `renderValue` receive `string[]`, else the 0.7 string types apply. The roots are generic functions (`<M extends boolean = false>(props: DropdownProps<M>)`), so `multiselect` infers `M = true` at the call site. Without a type argument the props keep the 0.7 shape and stay extendable by interfaces. A non-literal `multiselect={flag}` makes `M` `boolean` and the value types unions (the JSDoc says so). The JSDoc names Fluent's `selectedOptions` and `onOptionSelect`. *Why:* a discriminated union type alias could not be extended by an interface (principle 2); List does the same with `selectionMode`.
- **D10 — Multi-select commits.** Enter, Space and a click toggle the active option and keep the list open (0.7 `useListbox` `multiple`); Tab, Escape and Alt+ArrowUp close without committing. The value keeps selection order (checking appends, unchecking removes), and the Dropdown button shows the labels in that order joined with `', '` (values without an option are left out, as a single value without an option shows nothing in 0.7); `renderValue` replaces that text. `clearable` clears every value (Fluent disables `clearable` with `multiselect`). A form submits one entry per value, `required` needs one value, and a form reset restores `defaultValue`, compared by content, so an unchanged reset reports nothing. The deprecated `onOptionSelect` is called with the toggled option on every activation. *Why:* Fluent's commits; "clear all" is the obvious meaning of the clear button; TagPicker's form model.
- **D11 — The multi-select Combobox input (maintainer ruling).** While there is no query the input shows the selected labels (joined as in D10); the first edit replaces them. A text-editing key (`isTextEditingKey`, §1.2: a character, Backspace, Delete, the cut, paste, undo and redo shortcuts, and IME `Process`/`Unidentified`) pressed while the labels show first empties the input (`flushSync`), so the key edits an empty text. A toggle clears the query, so the labels show again with the list still open; a close and a blur clear it too. `freeform` is not available with `multiselect` (`never` in the multi-select props). *Why:* the selection stays visible and is read as the input's value; typing after "Apple, Banana" would filter for text no option has; free text cannot be one of several values (free tagging is TagPicker's, `tagpicker-6`).
- **D12 — The query.** Combobox and TagPicker get `query`, `defaultQuery` and `onQueryChange(query)`: the text typed since the last commit, which filters the options. Combobox resets it to `''` where it drops its draft in 0.7 (a commit, a close, a blur, Escape, the clear button, a form reset, locking); TagPicker where it clears its text in 0.7 (a tag added, Escape with text, locking, a form reset). A controlled non-empty `query` is shown in the input and filters; `''` shows the selected label(s) unless the user is editing, so erased text stays empty. With `freeform` the query props are ignored (the text is the value) and a development warning says so once (`Combobox:query-freeform`). The typing model does not change: typing never clears the selection, and a blur never selects an option whose text matches (Fluent does both). *Why:* `filter-2`'s async search needs the text; 0.7's draft model is kept (principle 2).
- **D13 — `filter`.** `filter?: (option: ListboxItem, query: string) => boolean` on Combobox and TagPicker, called only for a non-empty query, for every option that is not hidden. The default is the 0.7 match: a case-insensitive substring of `textValue ?? label` (TagPicker's options have no `textValue`, so its 0.7 match on `label` is the same). `filter={() => true}` with `onQueryChange` and options of your own gives server-side search. Fluent's `useComboboxFilter(query, options, config)` is a render helper whose filter takes a string. *Why:* the option object lets a filter tell the label from `textValue`; `ListboxItem` is public (D4).
- **D14 — `onActiveOptionChange(value: string | null)`** on Dropdown, Combobox and Listbox. It reports every change of the active option (arrows, typeahead, pointer hover, a filter change, opening) and `null` when the list closes (the Listbox: when it loses focus), from an effect after the commit (`useActiveDescendant`'s `onActiveValueChange`). Fluent never reports hover (its options have no hover highlight) and nothing on close. *Why:* one rule, "what `aria-activedescendant` points at"; previews that follow the pointer are a common use.
- **D15 — Dropdown's `expandIcon` and `renderValue`.** `expandIcon?: Slot<'span'>` follows the optional-indicator rule (Phase 1 D21: `null` and `undefined` keep the chevron, `false` or anything that renders nothing hides it) and, as a glyph inside the combobox button, is decorative and unwraps a button element through `unwrapButtonGlyph` with a one-time warning (C-SLOTS). `renderValue(value)` renders the button's content while a value is selected (the placeholder otherwise); the combobox's accessible value is that content's text. Fluent overrides the `button` slot's children. *Why:* C-SLOTS; a render function covers rich content without a slot on the combobox element.
- **D16 — `OptionGroup` naming.** `label?: ReactNode` (widened, optional). With a label the group is `aria-labelledby` its heading (0.7); without one, `aria-label` and `aria-labelledby` passed to `OptionGroup` go to its `role="group"` list (0.7 puts every rest prop on the `role="presentation"` item, where a name is ignored), and a group with no name warns once (`OptionGroup:unnamed`). *Why:* `option-3`; Fluent's `label` slot is optional with the same advice.
- **D17 — The standalone Listbox.** One `<ul role="listbox" tabIndex=0>` holds focus and `aria-activedescendant` (D5). Selection does not follow focus: Space and Enter select (APG allows either, Fluent does the same). No wrap. The active option exists only while the list has focus (the selected option, else the first), so its outline never shows on a list the user is not in; a click selects and focuses the list. `disabled` renders `aria-disabled`, leaves the tab order (as a disabled native `<select>`), selects nothing and submits nothing. No built-in height. The hidden inputs render inside the list, because `HiddenInput` returns focus to its parent element (`role="listbox"` replaces the list semantics axe's `list` rule checks). Shift+Arrow range selection and Ctrl+A are not in 0.10. *Why:* APG listbox; Fluent parity; a focus-scoped highlight follows APG's visual focus.
- **D18 — SwatchPicker composition.** Swatches are children that read a `SwatchPickerContext` (C-CONTEXT: a swatch outside a picker throws in development and renders inert in production). `items` stays, optional now, and renders `ColorSwatch`es before the children, so `<SwatchPicker items={colors}><EmptySwatch …/></SwatchPicker>` works. The `ref` of every swatch is its `<button>` in both layouts. Swatch values are unique: a duplicated value warns once per value (C-DEV). *Why:* `swatchpicker-1` (a Tooltip around a swatch); one implementation for both inputs; focus, names and a Tooltip's props belong on the button.
- **D19 — `focusMode`.** `'arrow'` (default, 0.7): one tab stop and arrow keys. `'tab'`: every enabled swatch is a tab stop, the arrow keys do nothing, and Space, Enter and a click select, in both layouts. *Why:* `swatchpicker-4`; ROADMAP §8.3 already names it as the other model of `swatchpicker-5`.
- **D20 — The grid layout (maintainer ruling).** `layout="grid"`: `role="grid"` → `SwatchPicker.Row` as `role="row"` → each swatch a `<div role="gridcell" aria-selected>` around its `<button>` (a `<button>` cannot take `role="gridcell"`: axe `aria-allowed-role`); the selected swatch's button is also `aria-pressed`, as DatePicker's selected day is, so the state is announced where focus is. The arrow keys move focus only: Left and Right go through the rows in reading order and wrap at the ends (mirrored in RTL), Up and Down go to the same column of the previous or next row (clamped to that row's length, no wrap), Home and End to the row's ends, Ctrl+Home and Ctrl+End to the grid's ends; Space and Enter select. One tab stop: the selected swatch, else the first enabled one. `items` in grid layout render as one row. The row layout keeps the 0.7 radio group (the arrows select). *Why:* the APG grid pattern; a big palette does not report a change on every step; Fluent's semantics.
- **D21 — Swatch kinds.**
  - `ColorSwatch`: `value` and `color`. Its name is `aria-label` (or `aria-labelledby`, from a Tooltip for example); without either it is named by its colour value and warns once (as 0.7's items without `label`). `disabled` is native (out of the keys and the tab order, never selected), dimmed, with a diagonal slash drawn like the check glyph, so the state does not rely on the swatch colour or its opacity. `icon?: Slot<'span'>` shows while the swatch is not selected; the check replaces it while selected. `borderColor?: string` sets the border colour by hand, as in Fluent. `size` and `shape` override the picker's.
  - `ImageSwatch`: `value`, `src` (a covering background image), `aria-label` (warning without), `disabled`, `size`, `shape`. Its check and slash are the theme's foreground glyph over a background halo, because an image has no single luminance.
  - `EmptySwatch`: an "add" button, with no value. `aria-label` (warning without), `size`, `shape`, `icon` (default: the plus glyph; the optional-indicator rule), a dashed border, your `onClick`. In the row layout it is a plain `<button>` in the radio group, outside the arrow order (its own tab stop; axe allows a button in a `radiogroup`); in the grid layout it is a `gridcell` in the arrow order, without `aria-selected`.
  - *Why:* `colorswatch-1`, `colorswatch-2`, `imageswatch-1`, `emptyswatch-1`; the roadmap's "not a radio" for EmptySwatch (Fluent's is a radio that can never be checked, which APG does not allow).
- **D22 — Swatch sizes and spacing.** `SwatchPickerSize` gains `'extra-small'` (20px); `'small'`, `'medium'` and `'large'` stay 24, 32 and 40px (Fluent's four sizes are 20, 24, 28 and 32px). `spacing?: 'small' | 'medium'` is a 4px or (default) 8px gap. `shape` keeps its `'circular'` default (Fluent: `'square'`; ROADMAP §8.3). *Why:* principle 2.
- **D23 — The internal grid roving.** `src/hooks/useRovingGrid.ts` (internal) adds D20's vertical and row keys to `useRovingTabIndex`, which keeps the reading-order keys (`orientation: 'horizontal'`, `homeEndKeys: false`); the rows are the container's `[role="row"]` elements, the cells its `[data-roving-value]` elements. P7-03 folds it into `useRovingTabIndex({ orientation: 'grid' })` and moves SwatchPicker onto that. *Why:* the roadmap ("the internal grid roving, which a later item (P7-03) makes public").
- **D24 — `Calendar` is DatePicker's grid, extracted.** `Calendar.tsx` holds an internal `CalendarView` (the header, the three views, the footer and their keys; module export, not in the barrel) and the public `Calendar`, a `role="group"` root with the value state, forms and Field wiring around a `CalendarView`. DatePicker renders `CalendarView` in its dialog with the 0.7 DOM (the `<h2>` heading, the grid labelled by it, focus, keys) plus the new features; the view remounts on every opening, so each opening shows the selected (or first visible) month again, as in 0.7. *Why:* `calendar-1`; one grid; the DatePicker suite is the regression suite (rule 23).
- **D25 — Calendar value.** `value` and `defaultValue` (`Date | null`) and `onValueChange(date, details?)`, fired only on change (a value callback; Fluent's `onSelectDate` fires on every click); `details = { range: Date[] }` (D29). Every emitted date is local midnight. Picking the selected day again does nothing; the value becomes `null` only through the parent or a form reset. *Why:* C-NAMING; DatePicker's 0.7 value semantics.
- **D26 — Month and year pickers: a drill-down (maintainer ruling).** `showMonthPicker` (default `true`) turns the day view's heading into a button that shows the month view: a 3×4 grid of the year's months, whose header arrows move by a year and whose heading is a button to the year view. The year view has 12 cells, a decade plus the year before and the year after it (muted and selectable, like outside days); its header arrows move by ten years and its heading is text. A pick drills back down: a year opens its months, a month its days (the focused day keeps its day of the month, clamped into the month and into `minDate`/`maxDate`). Escape in the month or year view goes up one level and is consumed (`preventDefault()`), so a DatePicker stays open until an Escape in the day view. A view change moves focus into the new grid (the focused month, year or day), and the heading stays `aria-live="polite"`. The heading button's name is its visible text (`June 2025`), so the dialog's and the grid's names do not change; its hint (`labels.chooseMonth`, `labels.chooseYear`) is its `aria-describedby`. Months and years wholly outside `minDate`/`maxDate` are `aria-disabled` and reachable, as unavailable days are. No side-by-side panes. *Why:* APG has no month or year grid; one pane fits the DatePicker popup; an inner widget that consumes Escape calls `preventDefault()` (C-POPUPS).
- **D27 — Keys that stay APG.** Day view: PageUp and PageDown go to the previous and next month, Shift+PageUp and Shift+PageDown to the previous and next year (Fluent's compat Calendar reverses them and uses Ctrl); a paged day keeps its day of the month, clamped (APG's wording keeps the weekday; WaveUI 0.7 and Fluent clamp); Enter and Space select; focus roves on the day buttons (Fluent: `aria-activedescendant` on the table). The grid always shows six weeks (Fluent: four to six). ROADMAP §8.3 records them. *Why:* principle 5; 0.7 behaviour.
- **D28 — Today and SSR.** `today?: Date` (default: the current date) marks today (`aria-current="date"`, `data-today`) and anchors "Go to today". Without it, the server HTML and the hydration render mark no day, and the browser marks today after hydration (`useIsClient`), so the markup never depends on the server's clock. The month shown first is the value's, else `initialVisibleDate`'s, else today's (the server's today on the server: the JSDoc says to pass `today` or `initialVisibleDate` when rendering on the server near the end of a month). *Why:* the roadmap's "SSR with `locale`" acceptance; a hydration mismatch is a React error.
- **D29 — Range selection.** `selectionRange?: 'day' | 'week' | 'work-week' | 'month'` (default `'day'`) and `workWeekDays?: readonly DayOfWeek[]` (default Monday to Friday, within the week that starts on `firstDayOfWeek`). A pick selects the range around the picked day, without its unavailable days; `value` is the picked day and `details.range` the selected days in order. Every day of the range is `aria-selected` (its cell), `aria-pressed` (its button) and drawn selected; the grid carries no `aria-multiselectable` (one selection). DatePicker does not take `selectionRange` (its input holds one date). *Why:* `datepicker-2`; Fluent's `dateRangeType` with WaveUI names.
- **D30 — Week numbers.** `showWeekNumbers` adds a leading column: a `<th scope="row">` per week with its number, named `labels.weekNumber(n)` (`Week 23`), under a header cell named `labels.week` (`Week`); it is not focusable and the keys skip it. `firstWeekOfYear?: FirstWeekOfYear` (`'first-day' | 'first-full-week' | 'first-four-day-week'`, default `'first-day'`, the default of Fluent's code; ISO 8601 is `'first-four-day-week'` with `firstDayOfWeek={1}`). *Why:* `datepicker-3`.
- **D31 — Marked days and custom content.** `markedDates(date)` draws a dot under the number and appends `labels.markedDay` to the day's name (`Monday, June 2, 2025, marked`). `renderDay(date, defaultContent)` replaces the content inside the day button, which keeps its role, state, name and keys. Fluent: `getMarkedDays(start, end)` and an imperative `customDayCellRef`. *Why:* `datepicker-6`; a render function is React's idiom and cannot break the cell's ARIA.
- **D32 — "Go to today" and Close.** `showGoToToday` adds a footer button that shows today's month in the day view and focuses today without selecting it; it is natively `disabled` when today is outside `minDate`/`maxDate`. DatePicker's `showCloseButton` adds a footer "Close" button that closes as Escape does. Both default to `false`. *Why:* `datepicker-4`; opt-in keeps 0.7 popups unchanged.
- **D33 — The public date helpers live in `src/lib/date.ts`.** `addDays`, `addMonths`, `isSameDay`, `startOfWeek` and `getWeekNumber`, server-safe: every module under `src/components` gets a `"use client"` banner, and a Server Component cannot call a client reference. `dateUtils.ts` imports them. All return local-midnight dates (Fluent's keep the time of day). `DayOfWeek` and `FirstWeekOfYear` join `src/lib/types.ts`, and DatePicker's `firstDayOfWeek` is typed `DayOfWeek` (the same union). *Why:* `calendar-2`; React Server Components.
- **D34 — The Calendar heading element.** `CalendarView` renders the month text in an `<h2>` for DatePicker (a dialog title, 0.7) and in a `<div>` for the standalone Calendar (a component cannot know the page's heading levels); both are `aria-live="polite"` and label the grid. *Why:* the 0.7 DatePicker semantics and tests; no wrong heading level in a page.
- **D35 — Calendar forms and Field.** `name`, `form` and `required` render DatePicker's ISO `yyyy-mm-dd` hidden input, which resets with its form (to `defaultValue`). The root `role="group"` takes the Field's label (`aria-labelledby`, `labelable: false`) and description; `aria-invalid` and `aria-required` are not rendered (not allowed on `group` or `grid`), so validity is native (the hidden input) and the Field's message. A required Calendar's `invalid` event focuses the tab stop of the current view. *Why:* C-FORMS; axe `aria-allowed-attr`.
- **D36 — Built-in text.** New strings are members of a `labels` object with English defaults (C-NAMING). `CalendarLabels` (new, exported): `previousMonth` (`'Previous month'`), `nextMonth` (`'Next month'`), `previousYear` (`'Previous year'`), `nextYear` (`'Next year'`), `previousDecade` (`'Previous decade'`), `nextDecade` (`'Next decade'`), `chooseMonth` (`'Choose a month'`), `chooseYear` (`'Choose a year'`), `goToToday` (`'Go to today'`), `week` (`'Week'`), `weekNumber` (`(week) => \`Week ${week}\``), `markedDay` (`(dayLabel) => \`${dayLabel}, marked\``). `DatePickerLabels` extends `CalendarLabels` (its 0.7 `previousMonth` and `nextMonth` keep their types) and adds `close` (`'Close'`). Listbox, the swatch kinds and the multi-select pickers add no built-in text (an EmptySwatch's name is the consumer's, D21). *Why:* C-NAMING; the README "Built-in text" table.
- **D37 — Bundles.** `Calendar` without DatePicker pulls in no listbox code, and `Listbox` pulls in no calendar code; `verify-dist` gains the two probes (§6.2). The Button-only probe is unchanged. *Why:* principle 6 (tree-shakeable subsystems).

### 0.4 Out of scope for 0.10

Everything else in the roadmap. In particular: `size` and `appearance` (P4-01; wave F inherits them, D1) and stable class names (P3-00; wave F applies them); Listbox range selection with Shift+Arrow and Ctrl+A; TagPicker parts, free tagging, groups, a button trigger and a clear-all action (`tagpicker-1` … `tagpicker-9`; only its `filter` and `query` are in this phase); virtualization (`combobox-7`); `positioning`, inline popups and per-instance mount nodes (`combobox-5`, `dropdown-5`, `datepicker-9`; P7-01); the swatch `details` argument (Fluent's `selectedSwatch`), `renderSwatchPickerGrid`, a `columnCount` for `items`, swatch `disabledFocusable` and an automatic contrast border; a side-by-side month picker (D26), Fluent's `daysToSelectInDayView`, a `restrictedDates` array (the `disabledDates` predicate covers it), four-to-six-week sizing (D27) and a selection live region; Calendar `disabled`, `readOnly` and a controllable visible month; `onActiveOptionChange` on TagPicker; editable comboboxes clearing the highlight on caret keys, and Fluent's removal of `aria-activedescendant` during caret moves (an NVDA and JAWS workaround; backlog); every TimePicker change (its `useListbox` behaviour must not change); every other backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation (F5-foundation, wave A)

Lands first and alone (§0.2 rule 19). It changes no behaviour of an existing component: `useListbox` is rebuilt without a visible change (its 0.7 suite passes unedited, apart from the error message of §1.2.8), and every addition is opt-in.

### 1.1 `src/hooks/useActiveDescendant.ts` (new, public)

```ts
/** Options of {@link useActiveDescendant}. */
export interface UseActiveDescendantOptions {
  /** The values that can become active, in navigation order. */
  items: readonly string[];
  /** The DOM id of an item's element: the `aria-activedescendant` target. */
  getId: (value: string) => string;
  /**
   * While `false`, no item is active and the moved-to item is forgotten (a closed popup, an
   * unfocused list). A move made in the same update that enables the hook is kept.
   * @default true
   */
  enabled?: boolean;
  /**
   * The active item while none was moved to, or after the moved-to item left `items` (the
   * selected option, for example). Ignored when it is not in `items`.
   */
  fallback?: string | null;
  /** `next()` and `prev()` wrap at the ends. @default false */
  loop?: boolean;
  /**
   * Whenever `items` changes while the hook is enabled (compared by content), its first item
   * becomes active — also when the change comes with enabling (the keystroke that opens a
   * filtered list). Enabling with unchanged items keeps the fallback. @default false
   */
  activateFirstOnChange?: boolean;
  /** The element of an item, for scrolling it into view. @default document.getElementById(getId(value)) */
  getElement?: (value: string) => HTMLElement | null;
  /** Called after the active item changed (from an effect), `null` included. */
  onActiveValueChange?: (value: string | null) => void;
}

/** Result of {@link useActiveDescendant}. The methods have stable identities. */
export interface UseActiveDescendantResult {
  /** The moved-to item, else the fallback; `null` while disabled. Derived during render. */
  activeValue: string | null;
  /** `getId(activeValue)`, or `undefined`: spread as `aria-activedescendant`. */
  activeDescendantId: string | undefined;
  /** Moves to `value` (ignored when it is not in `items`); `null` returns to the fallback. Scrolled into view. */
  setActiveValue: (value: string | null) => void;
  /** Moves to `value` for pointer movement: ignored while disabled, and not scrolled into view. */
  highlight: (value: string) => void;
  first: () => void;
  last: () => void;
  /** The item after the active one (the first when none is active); wraps with `loop`. */
  next: () => void;
  /** The item before the active one (the last when none is active); wraps with `loop`. */
  prev: () => void;
  /** Moves `delta` items (PageDown: `move(10)`), clamped at the ends (never wraps). */
  move: (delta: number) => void;
}

export function useActiveDescendant(options: UseActiveDescendantOptions): UseActiveDescendantResult;
```

1. **State and derivation.** One state value, the moved-to item. During render (adjust-during-render, C-HOOKS) it is dropped while `enabled` is `false` or when it is not in `items`, so it does not come back when the item returns; `activeValue` is `enabled ? (moved ?? (fallback in items ? fallback : null)) : null`. These are 0.7 `useListbox`'s rules, moved verbatim (its lines 876–907).
2. **`activateFirstOnChange`** is 0.7's `highlightOnFilter`: the hook tracks `{ enabled, items }` by content in every render, disabled ones included, and moves to `items[0]` when the items changed while enabled or in the render that enables it.
3. **Methods.** Stable identities (`useEventCallback`), reading the latest render. `next()`, `prev()` and `move()` start from `activeValue` (the fallback counts, as 0.7's `step()` does). A method called while disabled sets the moved-to item, which survives only when the same update enables the hook (0.7's `openWith`: "move, then open" in one event).
4. **Scrolling.** A layout effect keyed on `activeValue` scrolls `getElement(value) ?? document.getElementById(getId(value))` into view (`{ block: 'nearest' }`), except when the value came from `highlight` (the list would move under the pointer). 0.7 lines 1102–1113.
5. **`onActiveValueChange`.** A passive effect keyed on `activeValue` calls the latest callback when the value differs from the last reported one (initially `null`), so StrictMode's repeated mount effects report once.
6. **Server.** Nothing reads the DOM during render; an enabled hook with a fallback puts the id in the server HTML.

Tests (`src/hooks/__tests__/useActiveDescendant.test.tsx`, through a probe component): the derivation (fallback; a fallback outside `items` ignored; disabled gives `null` and forgets the moved-to item); a moved-to item that leaves `items` is dropped and does not return with it; `activateFirstOnChange` while enabled, on the enabling render with changed items, and not on enabling with the same items; `next`/`prev` from the fallback and from nothing, `loop`, `move` clamping; a move in the same update as enabling survives; `setActiveValue` scrolls and `highlight` does not (`scrollIntoView` spy), `getElement` wins over the id lookup; `onActiveValueChange` sequence (open, move, close) and StrictMode once; `renderToString` of an enabled hook with a fallback contains the id; method identities stable across renders.

### 1.2 `src/hooks/useListbox.ts`

1. **Built on `useActiveDescendant`.** `items`: the navigation values (below); `getId`: `getOptionId`; `enabled`: `open`; `fallback`: the `autoHighlight` value (0.7's computation); `loop`; `activateFirstOnChange`: `highlightOnFilter`; `getElement`: the store's element lookup; `onActiveValueChange` passed through. 0.7's `step()`, `activeRaw`, `filterTrack` and the scroll effect are removed. Every 0.7 option and key behaves as before: `useListbox.test.tsx` passes without an edit other than item 8.
2. **`disabledOptionsFocusable?: boolean`** (default `false`, D6). The navigation values are the navigable items (not hidden, not filtered out) with the disabled ones, instead of the enabled ones; typeahead receives them as enabled; the `autoHighlight` fallback may be a disabled option. `commit` still ignores a disabled item (a click, Enter and Space do nothing and keep the list open), and Tab and Alt+ArrowUp in single-select select-only mode commit only an enabled active option, else close (`onOpenChange(false, 'tab' | 'keyboard')`).
3. **`onActiveValueChange?: (value: string | null) => void`** (D14).
4. **`mode: 'standalone'`** (D5). `UseListboxOptions.mode` becomes `'editable' | 'select-only' | 'standalone'`; `typeahead` defaults to `mode !== 'editable'` (0.7: `mode === 'select-only'`, the same for the two 0.7 modes). In standalone mode: ArrowDown and ArrowUp move (from nothing: the first or last option), Home and End go to the first and last, PageUp and PageDown move ten, typeahead moves (Space continues a search typed within 500 ms, as in select-only mode); Enter and Space commit the active option (`onSelect`), keep it active and never call `onOpenChange`; Tab, Escape and Alt+Arrow are not handled. `getListboxProps()` returns `tabIndex: 0` and `aria-activedescendant`, and no `onMouseDown`. `getComboboxProps()` is not used in this mode (its JSDoc says so).
5. **Types.** `onOpenChange` becomes optional. `ListboxListProps` changes to `tabIndex: 0 | -1`, `onMouseDown?` (absent in standalone mode) and `'aria-activedescendant'?: string` (standalone mode only). `ListboxContextValue` gains `multiple: boolean` and `UseListboxOptionResult` gains `multiple: boolean` (D8). These types were internal until now, so nothing narrows for a consumer; the CHANGELOG lists them under "Types" anyway.
6. **Public JSDoc.** Every exported symbol of the module gets consumer-facing JSDoc (C-DOCS): the hook's own docblock keeps its behaviour list and "Consumer contract" and loses the internal spec references ("spec §2.5", "input-pickers#…").
7. **`isTextEditingKey(event)`**: 0.7's module-private `editsText`, exported from the module under this name for Combobox (D11). It is not exported from the package entry.
8. **The missing-context message** names every root: `reportMissingContext(componentName, 'a listbox (Listbox, Combobox, Dropdown or a ListboxContext provider)')`. Three assertions change (§6.4).

Tests (added to `useListbox.test.tsx`): `disabledOptionsFocusable` on each path (arrows, Home/End, PageUp/PageDown, typeahead, the fallback; Enter, Space and a click on a disabled active option keep the list open and commit nothing; Tab and Alt+ArrowUp close without committing), with the 0.7 default unchanged; standalone mode (its keys, commits in single and multiple mode, the committed option stays active, `onOpenChange` never called, Tab and Escape not prevented, the listbox props); `onActiveValueChange` (open, arrows, hover, filter, close; StrictMode once); `multiple` in the context and the option result.

### 1.3 `src/components/input/Option.tsx`

1. **`checkIcon?: Slot<'span'>`** on `OptionProps` (D7), rendered through `renderSlot(checkIcon ?? <CheckIcon />, 'span', …, { 'aria-hidden': true })` in the check column; a value that renders nothing (`slotRendersContent`) renders the default and warns once from an effect: `Option:checkIcon-empty`, "Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.". The column stays in every option while `showCheck` is on (0.7: the glyph is `invisible` while not selected).
2. **The multi-select box** (D8): while `multiple`, the check column is a 16px box `<span aria-hidden="true" data-wave-option-box>` with the glyph inside (visible only while selected). The option's `forcedColors.selectedContainer` outline stays.
3. **`OptionGroup`** (D16): `label?: React.ReactNode`; the heading `<div>` renders only with a label; `aria-label` and `aria-labelledby` from the props go to the `<ul role="group">` (the other rest props stay on the `<li role="presentation">`, as in 0.7); a group without a label, `aria-label` or `aria-labelledby` warns once from an effect (`OptionGroup:unnamed`).
4. **`ListboxSurface` and `useListboxPopup`** become public (D4) with consumer-facing JSDoc; their 0.7 behaviour does not change. The result type `ListboxPopup` is renamed `UseListboxPopupResult` (it was internal); `ListboxSurfaceProps` documents `showCheck`, `emptyContent` and the single-container rule.
5. **The `Option` docblock** names its hosts: Listbox, Combobox, Dropdown, and custom pickers through `ListboxSurface` or a `ListboxContext` provider.

Tests (added to `Option.test.tsx`): `checkIcon` replaces the glyph (selected and not), `null` and `undefined` keep it, `false`, `''` and `[]` keep it and warn once (asserted); the multi-select box (unchecked and checked classes, `aria-hidden`, the glyph only while selected) under a context with `multiple`; a group with a `ReactNode` label is labelled by its heading; a group without a label routes `aria-label` to `role="group"` and has no heading element; an unnamed group warns once; a minimal custom picker (an inline component on `useListbox`, `useListboxPopup` and `ListboxSurface`) opens, positions, closes on an outside press and on Escape, and hands Escape to an enclosing layer while it shows nothing (0.7's overlays#1).

### 1.4 `src/hooks/useTypeahead.ts`

No change: `useListbox` passes the disabled flag it wants typeahead to see (item 1.2.2). Listed so no package edits it.

### 1.5 `src/lib/types.ts`

```ts
/** A day of the week, as `Date.prototype.getDay()` numbers them: 0 is Sunday, 6 is Saturday. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Which week is week 1 of a year: the week of January 1 (`'first-day'`), the first week that lies
 * wholly in the year (`'first-full-week'`), or the first week with at least four days in the year
 * (`'first-four-day-week'`, ISO 8601 when weeks start on Monday).
 */
export type FirstWeekOfYear = 'first-day' | 'first-full-week' | 'first-four-day-week';
```

`src/index.ts` re-exports every type of the module (`export type * from './lib/types'`). `types.test.ts` gets `expectTypeOf` checks for both.

### 1.6 Entry exports (wave A exclusive, rule 19)

- `src/index.ts`, under "Hooks": `useActiveDescendant` with `UseActiveDescendantOptions` and `UseActiveDescendantResult`; `useListbox`, `useListboxOption`, `ListboxContext`, `collectOptionLabels`, `markListboxElement` with `ListboxItem`, `ListboxOpenChangeReason`, `UseListboxOptions`, `UseListboxResult`, `ListboxComboboxProps`, `ListboxListProps`, `ListboxStore`, `ListboxContextValue`, `UseListboxOptionProps`, `ListboxOptionProps`, `UseListboxOptionResult` and `ListboxElementKind`. `isTextEditingKey` is not exported.
- `src/components/input/index.ts`: `ListboxSurface`, `useListboxPopup`, `ListboxSurfaceProps`, `UseListboxPopupOptions`, `UseListboxPopupResult` (from `./Option`).
- `src/__tests__/public-types.test.ts`: the new names in its import list and `expectTypeOf` lines for the hook options and results (`UseActiveDescendantResult['activeDescendantId']` is `string | undefined`; `UseListboxOptions['mode']` includes `'standalone'`; `ListboxListProps['tabIndex']` is `0 | -1`).

### 1.7 `scripts/verify-dist.mjs`

`PENDING_FLAT_EXPORTS = ['SwatchPicker']` (rule 21: `SwatchPicker` is exported and gains its `Row` member in wave B, before INTEGRATION exports `SwatchPickerRow`; until then the bridge reports it as planned). INTEGRATION empties it (§4.3). `scripts/__tests__/verify-dist.test.mjs` needs no change (its cases pass `pendingFlatExports` explicitly).

### 1.8 Exit criteria of wave A

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (every 0.7 picker test passes unchanged: Dropdown, Combobox, TagPicker, TimePicker, List, and `useListbox` apart from §6.4), `npm run build`, `node scripts/verify-dist.mjs` (with the bridge) and `npm run build-storybook` pass; the conventions gate is clean for the foundation's files. The lead commits the package before wave B starts.

---

## 2. Items

Each item lists what it closes, its API, its behaviour and its tests. "Guards" name the WaveUI strengths (roadmap §1.2) the item touches and the tests that keep them.

### P5-01 — Multi-select Dropdown and Combobox (P5-pickers)

**Closes:** `dropdown-1` (M), `combobox-1` (M). **Guards:** hidden inputs and form reset on every picker; Combobox announces "No matches" (their 0.7 tests stay green, and multi-select cases are added).

```ts
export interface DropdownProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /**
   * Several options can be selected (Fluent's `multiselect`): the value is an array, options show a
   * checkbox, and Enter, Space and a click toggle an option and keep the list open.
   * @default false
   */
  multiselect?: M;
  /** Controlled value: the selected option's value (`''` for none), or with `multiselect` the selected values (Fluent's `selectedOptions`). */
  value?: M extends true ? readonly string[] : string;
  /** @default '' (`[]` with `multiselect`) */
  defaultValue?: M extends true ? readonly string[] : string;
  /** Called with the new value when it changes (a new array with `multiselect`). */
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  // … 0.7 props, and P5-02/P5-03 below
}
// ComboboxProps<M> likewise, plus: freeform?: M extends true ? never : boolean;
```

- **Roots.** `const DropdownRoot = <M extends boolean = false>(props: DropdownProps<M>) => …` (and Combobox); `Object.assign` keeps the generic call signature. Inside, the value is normalised to `readonly string[]` for `useListbox` (`multiple: multiselect`, `selectedValues`).
- **Dropdown with `multiselect`** (D10): the button text, `clearable`, forms, reset and the deprecated `onOptionSelect` as D10 says. The value array is compared by content where 0.7 compares strings (the reset, the clear button's visibility: `value.length > 0`).
- **Combobox with `multiselect`** (D11, D10): the input shows `draft ?? joinedLabels` (the placeholder shows while nothing is selected and nothing is typed). `handleKeyDown` runs, before `useListbox`'s keys, `if (multiselect && draft === null && isTextEditingKey(event)) flushSync(() => startEditing(''))`, where `startEditing` sets the P5-02 query state to editing. A commit through Enter or a click clears the query (the labels show again) and keeps the list open; the `autoHighlight` rule of 0.7 applies (`'first'` while a query filters, else none). `readOnly` shows the labels and edits nothing. `clearable` clears every value, drops the query, closes the list and focuses the input (0.7's clear, with `[]`).
- **Unknown values** (no option has them) are left out of the joined text and still submitted, as in 0.7 (a single unknown value shows no text).

Tests (in `Dropdown.test.tsx` and `Combobox.test.tsx`):
- Dropdown: toggling with Enter, Space and a click keeps the list open, `aria-multiselectable`, `aria-selected` per option and the box look; Tab, Escape and Alt+ArrowUp close without committing; the button text in selection order, the placeholder for `[]`; `clearable` clears all and focuses the button; a form submits one entry per value (`FormData.getAll`), `required` blocks an empty submit and focuses the button, a reset restores `defaultValue` and reports nothing when unchanged; the deprecated `onOptionSelect` fires per toggle; StrictMode: one `onValueChange` per toggle; controlled with a parent that ignores the callback (separate tasks).
- Combobox: the labels in the input; a character, Backspace, Delete, paste and an IME `Process` key while the labels show start an empty query (`user.keyboard`, `user.paste`); caret keys keep the labels; a toggle clears the query and keeps the list open; blur and close show the labels again; `clearable`; forms and reset as Dropdown; `readOnly`; "No matches" still announced once per query; StrictMode once.
- Types (`expectTypeOf`, `// @ts-expect-error`, checked by `tsconfig.dev.json`): `<Dropdown multiselect onValueChange={(v) => …} />` types `v` as `string[]`; `<Dropdown value="a" />` still compiles and `DropdownProps` without a type argument has `value?: string`; `<Dropdown multiselect value="a" />` and `<Combobox multiselect freeform />` are errors; `interface X extends DropdownProps {}` compiles.

Stories: "Multiselect" for Dropdown and Combobox (in a Field, with `clearable`).

### P5-02 — Custom filtering, a controllable query and `onActiveOptionChange` (P5-pickers)

**Closes:** `filter-1` (M), `filter-2` (M), `combobox-6` (L), `dropdown-6` (L). **Guards:** Combobox and TagPicker filter as you type and announce "No matches" by default (the 0.7 tests stay green).

```ts
// ComboboxProps<M> and TagPickerProps
/**
 * Whether an option matches the typed text. Called for a non-empty query only.
 * @default a case-insensitive substring match on the option's `textValue`, else its `label`
 */
filter?: (option: ListboxItem, query: string) => boolean;
/** Controlled typed text (the query that filters). Combobox: ignored with `freeform`. */
query?: string;
/** @default '' */
defaultQuery?: string;
/** Called with the new query when it changes, `''` when it resets (a commit, a close, a blur, Escape, …). */
onQueryChange?: (query: string) => void;

// DropdownProps<M> and ComboboxProps<M>
/** Called after the active (highlighted) option changes — arrow keys, typeahead, the pointer, a filter change — and with `null` when the list closes. */
onActiveOptionChange?: (value: string | null) => void;
```

- **Combobox.** 0.7's `draft: string | null` becomes `[query, setQuery] = useControllable(queryProp, defaultQuery ?? '', onQueryChange)` plus an `editing` flag; `draft = editing || query !== '' ? query : null`. Every 0.7 `setDraft(null)` becomes "stop editing and set `''`", every `setDraft(text)` "edit and set `text`". With `freeform` the query state is unused (0.7's draft follows the value) and a `query` or `defaultQuery` prop warns once from an effect (`Combobox:query-freeform`).
- **TagPicker.** `useState('')` becomes `useControllable(queryProp, defaultQuery ?? '', onQueryChange)`; its 0.7 resets stay where they are.
- **The filter** is adapted for `useListbox`: `query ? (item) => (filter ?? defaultFilter)(item, query) : undefined`, memoised on the query and the prop. `defaultFilter` is the 0.7 `matchesText` (module-private in each component).
- **`onActiveOptionChange`** is `useListbox`'s `onActiveValueChange` (D14).

Tests: a custom filter (prefix match) changes the list and "No matches"; `filter={() => true}` shows every option for any query; the filter receives `ListboxItem`s (with `textValue`) and never hidden options; the controlled query: shown, filters, `onQueryChange` on typing and on each reset path (commit, close, blur, Escape, clear, form reset), a parent that keeps a non-empty query after a close keeps it shown; uncontrolled `defaultQuery`; `''` after erasing keeps the input empty while editing; the freeform warning (asserted); TagPicker's query resets (tag added, Escape, reset) and no reset on blur (0.7); `onActiveOptionChange` on arrows, typeahead (Dropdown), hover, filtering, opening and `null` on close, StrictMode once. An async-search case: `filter={() => true}`, options replaced after a fake-timer delay, the first new option active while typing (0.7's rule), "No matches" only for an empty result.

Stories: "Custom filter" (prefix and accent-insensitive: `label.normalize('NFD').replace(/\p{Diacritic}/gu, '')`), "Async search" (a debounced fake fetch with `filter={() => true}`), "Active option preview" (`onActiveOptionChange`).

### P5-03 — Public listbox primitives, a standalone Listbox, and the Option and Dropdown parts

**Closes:** `listbox-2` (M), `listbox-1` (L), `dropdown-4` (L), `option-1` (L), `option-2` (L), `option-3` (L). **Guards:** hidden inputs and form reset on every picker; Combobox and TagPicker filtering and "No matches".

Owners: `F5-foundation` (the primitives, `Option`, `OptionGroup`, §1); `P5-pickers` (Dropdown `expandIcon`, `renderValue`, `disabledOptionsFocusable`; Combobox `disabledOptionsFocusable`); `P5-listbox` (the Listbox).

**Dropdown and Combobox parts (P5-pickers).**

```ts
// DropdownProps<M>
/** The glyph at the end of the button (default: a chevron). `null` or `undefined` keep it; `false`, or a value that renders nothing, hides it. Decorative: a `<button>` passed here is unwrapped. */
expandIcon?: Slot<'span'>;
/** Renders the button's content while a value is selected (the placeholder shows otherwise). @default the selected labels, joined with ', ' */
renderValue?: M extends true ? (value: string[]) => React.ReactNode : (value: string) => React.ReactNode;
// DropdownProps<M> and ComboboxProps<M>
/** Keeps disabled options in the arrow-key and typeahead order (they still cannot be selected). @default false */
disabledOptionsFocusable?: boolean;
```

- `expandIcon` reuses `showsExpandButton` for the optional-indicator rule and `unwrapButtonGlyph` for buttons (warning key `Dropdown:expandIcon-button`, as Combobox's); the glyph keeps 0.7's rotation classes and `aria-hidden`. Tests: default, custom glyph, `null`, `false`, `''`, a `<button>` (unwrapped, warned), rotation while expanded.
- `renderValue`: called with the value (a copy with `multiselect`) while one is selected; not called for `''`/`[]`. Tests: rich content in the button, its text is the combobox's value text, the placeholder when empty, multi-select arrays.
- `disabledOptionsFocusable`: passed to `useListbox`. Tests: a disabled option is reached by the arrows and typeahead, Enter on it commits nothing and keeps the list open.

**The standalone Listbox (P5-listbox, `src/components/input/Listbox.tsx`).**

```ts
export interface ListboxProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLUListElement>,
  'onChange' | 'defaultValue'
> {
  /** Several options can be selected; Space and Enter toggle an option. @default false */
  multiselect?: M;
  value?: M extends true ? readonly string[] : string;
  /** @default '' (`[]` with `multiselect`) */
  defaultValue?: M extends true ? readonly string[] : string;
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  /** Called after the active option changes, and with `null` when the list loses focus. */
  onActiveOptionChange?: (value: string | null) => void;
  /** Not focusable, nothing can be selected, and nothing is submitted. @default false */
  disabled?: boolean;
  /** @default false */
  disabledOptionsFocusable?: boolean;
  name?: string;
  form?: string;
  required?: boolean;
  ref?: React.Ref<HTMLUListElement>;
}

export const Listbox = /* @__PURE__ */ Object.assign(ListboxRoot, { Option, OptionGroup });
export const ListboxOption = Option;
export const ListboxOptionGroup = OptionGroup;
```

- **Behaviour:** D17, on `useListbox({ mode: 'standalone', open: focused && !disabled, multiple, selectedValues, onSelect, disabledOptionsFocusable, onActiveValueChange })`. The `<ul>` spreads `getListboxProps()` and the Field wiring (`useFieldControl(…, { labelable: false })`: labelled by the Field's label, described by its message and hint, `aria-invalid` and `aria-required` from it, all allowed on `listbox`), composes `listbox.onKeyDown` and `onKeyUp` with the consumer's, tracks focus with `onFocus`/`onBlur` (composed), provides `listbox.context`, and renders `HiddenInput` (one entry per value; `required`; `onInvalid` focuses the list) inside itself, with `relative` for its required input. `disabled`: `aria-disabled`, `tabIndex={-1}`, commits ignored, the hidden input disabled. In single-select mode, Space or Enter on the selected option changes nothing (no callback; there is no deselection).
- **Naming:** an unnamed Listbox (no `aria-label`, `aria-labelledby` or Field label) warns once (`Listbox:unnamed`).
- **Docs:** the component docblock says when to use List `selectable` (real focus on each item, item actions, rich rows) and when Listbox (the picker option model: active descendant, typeahead, groups).

Tests (`__tests__/Listbox.test.tsx`): `testSystemProps` (ref on the `<ul>`, rest spread, `className` merging, `displayName`, axe); focus model (no active option before focus; the selected, else the first, on focus; `null` on blur; a click selects and focuses); keys (arrows without wrap, Home/End, PageUp/PageDown, typeahead, Space and Enter select in single mode, toggle in multi mode; Tab and Escape not prevented); selection does not follow focus; `disabled`; `disabledOptionsFocusable`; groups (a label and a label-less group); forms (one entry per value, `required` blocks submit and focuses the list, reset); `renderWithFieldContext` (label, description, invalid, required); `onValueChange` and `onActiveOptionChange` once in StrictMode; RTL (no horizontal keys, nothing mirrors); `renderToString` (no `aria-activedescendant` before focus) and hydration without warnings; the unnamed warning (asserted).

Stories (`stories/Listbox.stories.tsx`, title `Components/Input/Listbox`): Default, Multiselect, Groups, Disabled options (skipped and focusable), In a Field, "Custom picker" (the P5-03 acceptance story: a font picker built only on the package entry's `useListbox`, `useListboxPopup`, `ListboxSurface` and `Option`), "Command palette" (a text input driving `useActiveDescendant` over a filtered list, without `useListbox`).

### P5-04 — SwatchPicker children, grid layout, focus modes and swatch kinds (P5-swatches)

**Closes:** `swatchpicker-1` (M), `swatchpicker-2` (L), `swatchpicker-3` (L), `swatchpicker-4` (L), `colorswatch-1` (L), `colorswatch-2` (L), `imageswatch-1` (L), `emptyswatch-1` (L). **Guards:** the hidden input and form reset of SwatchPicker (0.7 tests unchanged); ColorPicker's presets (a SwatchPicker with `items`; `ColorPicker.test.tsx` stays green without an edit).

```ts
export type SwatchPickerSize = Extract<Size, 'extra-small' | 'small' | 'medium' | 'large'>;

export interface SwatchPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Swatches rendered as `ColorSwatch`es before `children` (optional since 0.10). */
  items?: readonly SwatchItem[];
  /** `'row'`: a radio group whose arrow keys select. `'grid'`: rows of cells (`SwatchPicker.Row`) whose arrow keys move focus in two dimensions; Space and Enter select. @default 'row' */
  layout?: 'row' | 'grid';
  /** `'arrow'`: one tab stop and arrow keys. `'tab'`: every swatch is a tab stop and the arrow keys do nothing. @default 'arrow' */
  focusMode?: 'arrow' | 'tab';
  /** Gap between swatches: 4px or 8px. @default 'medium' */
  spacing?: 'small' | 'medium';
  /** @default 'medium' (20, 24, 32 or 40px) */
  size?: SwatchPickerSize;
  // … 0.7: value, defaultValue, onValueChange, onChange (deprecated), shape, name, required, form, ref
}

export interface SwatchPickerRowProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export interface ColorSwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'color'> {
  value: string;
  /** CSS colour of the swatch (a runtime user colour). */
  color: string;
  /** Glyph shown while the swatch is not selected. */
  icon?: Slot<'span'>;
  /** CSS colour of the swatch's border, for a colour close to the page background. */
  borderColor?: string;
  size?: SwatchPickerSize;
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}

export interface ImageSwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  /** URL of the image (drawn as a covering background image). */
  src: string;
  size?: SwatchPickerSize;
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}

export interface EmptySwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** @default a plus glyph */
  icon?: Slot<'span'>;
  size?: SwatchPickerSize;
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}
```

- **Modules.** `SwatchPicker.tsx` (root, `SwatchPicker.Row`, `items`, the context provider); `SwatchPicker.context.ts` (the context, its hook with `reportMissingContext`, the value registry for duplicate warnings); `SwatchPicker.swatches.tsx` (`ColorSwatch`, `ImageSwatch`, `EmptySwatch`, their shared button, the check and slash glyphs); `src/hooks/useRovingGrid.ts` (D23). The check glyph is 0.7's `SwatchCheck` (luminance-picked over a halo, `getCheckColors`); the slash is an inline SVG line drawn the same way, not a new `lib/icons` export.
- **Root.** `role="radiogroup"` (row) or `role="grid"` (grid); it renders `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing` before `{...rest}` (enumerated, always rendered, C-CLASS); `HiddenInput` stays inside it (0.7). `SwatchPicker.Row` is `role="row"` in the grid layout and a full-width line (no role) in the row layout.
- **Swatch.** Row layout: `<button type="button" role="radio" aria-checked data-roving-value data-selected …>` (0.7). Grid layout: `<div role="gridcell" aria-selected><button type="button" aria-pressed={selected || undefined} data-roving-value …></div>`. The button carries `ref`, `className`, `style` merged with the swatch's colour, the name and every rest prop, in both layouts; the cell only `role` and `aria-selected`. A click selects through the context (C-COMPOSE: the consumer's `onClick` first).
- **Keys.** Row + arrow: 0.7's `useRovingTabIndex` (`orientation: 'both'`, selecting on focus move). Grid + arrow: `useRovingGrid` (D20, D23), selecting nothing on focus move. Tab mode: no key handler; every enabled swatch has `tabIndex={0}`. Swatches read their `tabIndex` from the context.
- **Duplicate values** warn once per value (`SwatchPicker:duplicate-value:<value>`); `items` without `label` keep 0.7's warning (`SwatchPicker:item-label`) and render their `ColorSwatch` named by the colour; a `ColorSwatch`, `ImageSwatch` or `EmptySwatch` without a name warns once per kind (`ColorSwatch:unnamed`, …).

Tests (`SwatchPicker.test.tsx`, which keeps its 0.7 cases, and the new `SwatchPicker.swatches.test.tsx` and `src/hooks/__tests__/useRovingGrid.test.tsx`): children and `items` together (order, one radio group); a Tooltip (0.7 component) around a `ColorSwatch` names and describes the button in both layouts; grid ARIA (grid, rows, cells, `aria-selected`, `aria-pressed`) and axe in both layouts, open and selected states; grid keys (reading order with wrap, Up/Down in the column with clamping and no wrap, Home/End, Ctrl+Home/End) and the same in RTL; Space and Enter select in the grid, arrows do not; tab mode in both layouts (every enabled swatch tabbable, arrows inert); disabled swatches (skipped, not selectable, the slash); `icon` and the check; `borderColor`; per-swatch `size` and `shape`; `ImageSwatch`'s background and check; `EmptySwatch` in both layouts (out of the radio group's arrows; in the grid's arrows; its `onClick`); a swatch outside a picker throws (`expectThrows`) and renders inert in production (`vi.stubEnv`); duplicate and unnamed warnings (asserted); forms and reset in both layouts; `testSystemProps` for each swatch kind and for `SwatchPicker.Row`.

Stories: "Swatch children with tooltips", "Grid layout", "Tab focus mode", "Swatch kinds" (image, empty, disabled, icon, border, per-swatch size and shape), "Sizes and spacing"; the 0.7 stories keep working.

### P5-05 — Calendar, month and year pickers, week numbers, marked days, ranges and date helpers (P5-calendar)

**Closes:** `calendar-1` (M), `datepicker-1` (M), `calendar-2` (L), `datepicker-2` (L), `datepicker-3` (L), `datepicker-4` (L), `datepicker-5` (L), `datepicker-6` (L). **Guards:** first-class DatePicker (keep-and-flag, hidden input, form reset): its 0.7 suite passes with only the §6.4 updates.

```ts
export interface CalendarLabels {
  previousMonth?: string; // 'Previous month'
  nextMonth?: string; // 'Next month'
  previousYear?: string; // 'Previous year'
  nextYear?: string; // 'Next year'
  previousDecade?: string; // 'Previous decade'
  nextDecade?: string; // 'Next decade'
  chooseMonth?: string; // 'Choose a month'
  chooseYear?: string; // 'Choose a year'
  goToToday?: string; // 'Go to today'
  week?: string; // 'Week'
  weekNumber?: (week: number) => string; // (week) => `Week ${week}`
  markedDay?: (dayLabel: string) => string; // (label) => `${label}, marked`
}

/** Second argument of `Calendar`'s `onValueChange`. */
export interface CalendarValueChangeDetails {
  /** The selected days in order (local midnight): the picked day, or its week, work week or month (`selectionRange`). */
  range: Date[];
}

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: Date | null;
  /** @default null */
  defaultValue?: Date | null;
  onValueChange?: (date: Date | null, details?: CalendarValueChangeDetails) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: (date: Date) => boolean;
  /** @default 0 */
  firstDayOfWeek?: DayOfWeek;
  locale?: string;
  /** @default the current date (marked only after hydration when not passed) */
  today?: Date;
  initialVisibleDate?: Date;
  /** @default true */
  showMonthPicker?: boolean;
  /** @default false */
  showWeekNumbers?: boolean;
  /** @default 'first-day' */
  firstWeekOfYear?: FirstWeekOfYear;
  /** @default false */
  showGoToToday?: boolean;
  markedDates?: (date: Date) => boolean;
  renderDay?: (date: Date, defaultContent: React.ReactNode) => React.ReactNode;
  /** @default 'day' */
  selectionRange?: 'day' | 'week' | 'work-week' | 'month';
  /** @default [1, 2, 3, 4, 5] */
  workWeekDays?: readonly DayOfWeek[];
  labels?: CalendarLabels;
  name?: string;
  form?: string;
  required?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

// DatePickerProps gains: today, initialVisibleDate, showMonthPicker, showWeekNumbers,
// firstWeekOfYear, showGoToToday, markedDates, renderDay (forwarded to the calendar), and
/** Adds a Close button to the calendar's footer; it closes the calendar as Escape does. @default false */
showCloseButton?: boolean;
// firstDayOfWeek?: DayOfWeek (the 0.7 union, named)
export interface DatePickerLabels extends CalendarLabels {
  // 0.7: clear, openCalendar, invalidDate, outOfRange, unavailableDate
  /** @default 'Close' */
  close?: string;
}
```

- **Modules.** `Calendar.tsx`: the public `Calendar` and the internal `CalendarView` (header, view state, footer, focus, Escape levels); `Calendar.views.tsx`: the day, month and year grids; `dateUtils.ts`: the internal helpers the views need (the range of a day, the decade of a year, `addYears`, week numbers per row, the month and year formatters in the grid-compatible calendar of `getCalendar`); `src/lib/date.ts`: the public helpers (D33).
- **`CalendarView` internal props:** everything of `CalendarProps` that is not forms or Field, plus `headingAs: 'h2' | 'div'`, `headingId` (DatePicker labels its dialog with it) and `onPick(date)` (DatePicker commits and closes). The grid of the current view is marked `data-wave-calendar-grid`, so DatePicker's focus trap finds its tab stop (`[data-wave-calendar-grid] button[tabindex="0"]`, 0.7's query moved). 0.7's roving layout effect (focus follows the focused day while the grid has focus) moves into the view.
- **Views, keys and focus:** D26 and D27. Month view: Left/Right ±1 (mirrored in RTL), Up/Down ±4, Home/End to the row's ends, PageUp/PageDown to the previous and next year (same month), Enter and Space pick. Year view: the same with PageUp/PageDown ±10 years. Month cells show the locale's short month names and are named `January 2025`; year cells show and are named by the year in the locale's digits (the Buddhist years of `th-TH`, as 0.7's formatters). The value's month and year are `aria-selected` (cell) and `aria-pressed` (button); today's month and year are `aria-current="date"`. The header's previous and next buttons are `focusableDisabledProps(…)` when the previous or next month, year or decade is wholly outside `minDate`/`maxDate` (0.7's rule for months).
- **Standalone Calendar:** a `role="group"` root (`relative`) that holds the value (`useControllable`, compared by day as DatePicker's `commitDate`), the Field wiring (D35), `HiddenInput` and `useFormReset`, and renders `CalendarView` with `headingAs="div"`. Tab order: the previous button, the heading button, the next button, the grid (one stop), the footer.
- **DatePicker:** renders `CalendarView` with `headingAs="h2"` in its dialog; 0.7's view state (`viewMonth`, `focusedDay`, `openSeen`, `toWeeks`, the grid keys, `NAV_BUTTON_CLASSES`, `DAY_CLASSES`) moves into the calendar modules; `showCloseButton` renders a footer button that calls the same `close` as Escape; its labels pass through.
- **Date helpers (`src/lib/date.ts`):**

  ```ts
  export function addDays(date: Date, amount: number): Date;
  /** Clamps the day to the target month (January 31 + 1 month is February 28, or 29). */
  export function addMonths(date: Date, amount: number): Date;
  export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean;
  /** The first day of `date`'s week. @param firstDayOfWeek @default 0 */
  export function startOfWeek(date: Date, firstDayOfWeek?: DayOfWeek): Date;
  export interface GetWeekNumberOptions {
    /** @default 0 */
    firstDayOfWeek?: DayOfWeek;
    /** @default 'first-day' */
    firstWeekOfYear?: FirstWeekOfYear;
  }
  /** The week number of `date` (1–53): days before a year's week 1 belong to the previous year's last week, and days in the next year's week 1 are week 1. */
  export function getWeekNumber(date: Date, options?: GetWeekNumberOptions): number;
  ```

  Every returned date is local midnight, and the module imports nothing (server-safe). `dateUtils.ts` imports them (with its internal `startOfDay`, `startOfMonth`, `makeDate` and `daysInMonth` moved to `src/lib/date.ts` as module exports that the package entry does not export).

Tests:
- `src/lib/__tests__/date.test.ts`: local midnight for times of day and across DST changes (a fixed `TZ` in the test environment is not assumed: assertions compare calendar fields); `addMonths` clamping; `startOfWeek` for every `firstDayOfWeek`; `getWeekNumber` for the three rules at year boundaries (ISO: 2021-01-01 is week 53, 2026-12-31 is week 53, 2027-01-04 is week 1; `'first-day'` and `'first-full-week'` with Sunday and Monday weeks).
- `__tests__/Calendar.test.tsx`: `testSystemProps`; the day view's keys (the 0.7 DatePicker grid cases, run on the standalone Calendar); the drill-down (heading button name and description, the month and year views' keys, picks, Escape levels consumed, focus after each view change, `aria-live`); disabled months and years reachable; `today` marking (with the prop; without it only after hydration); `initialVisibleDate`; week numbers (row headers, names, skipped by the keys, the three rules); `markedDates` (dot and name suffix); `renderDay` (content replaced, name and state kept); every `selectionRange` (the range's `aria-selected` and `aria-pressed`, unavailable days left out, `details.range`), `workWeekDays`; "Go to today" (focuses today, selects nothing, disabled outside the range); `onValueChange` only on change, StrictMode once; forms and reset (`required` focuses the tab stop); `renderWithFieldContext`; RTL (horizontal keys mirrored in every view; the chevrons mirror); `renderToString` with `locale` and `today` and hydration without warnings; axe in each view.
- `DatePicker.test.tsx`: its 0.7 cases (§6.4) plus the forwarded props and `showCloseButton` (closes, focus returns as with Escape); Escape in the month view stays in the dialog.
- `dateUtils.test.ts`: the new internal helpers.

Stories (`stories/Calendar.stories.tsx`, title `Components/Input/Calendar`): Default, Localized (with `today` for SSR), Week numbers (ISO), Marked days, Custom day content, Week selection, Go to today, In a Field; `stories/DatePicker.stories.tsx` gains "Month and year picker", "Week numbers" and "Close button".

---

## 3. Packages and file ownership

### 3.1 Files

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D), the lead every file in waves E and F. Paths without a folder are in `src/components/input/`; `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F5-foundation` (wave A) | `src/hooks/useListbox.ts`, `src/hooks/__tests__/useListbox.test.tsx`, `Option.tsx`, `__tests__/Option.test.tsx`, `src/lib/types.ts`, `src/lib/__tests__/types.test.ts`, `src/index.ts` and `index.ts` (§1.6 only), `src/__tests__/public-types.test.ts` (§1.6 only), `scripts/verify-dist.mjs` (§1.7 only) | `src/hooks/useActiveDescendant.ts`, `src/hooks/__tests__/useActiveDescendant.test.tsx` | P5-03 (shared), P5-01/P5-02 (shared) |
| `P5-pickers` (wave B) | `Dropdown.tsx`, `Combobox.tsx`, `TagPicker.tsx`, their tests, `stories/{Dropdown,Combobox,TagPicker}.stories.tsx` | — | P5-01, P5-02, P5-03 (parts) |
| `P5-listbox` (wave B) | — | `Listbox.tsx`, `__tests__/Listbox.test.tsx`, `stories/Listbox.stories.tsx` | P5-03 (Listbox) |
| `P5-swatches` (wave B) | `SwatchPicker.tsx`, `__tests__/SwatchPicker.test.tsx`, `stories/SwatchPicker.stories.tsx` | `SwatchPicker.context.ts`, `SwatchPicker.swatches.tsx`, `__tests__/SwatchPicker.swatches.test.tsx`, `src/hooks/useRovingGrid.ts`, `src/hooks/__tests__/useRovingGrid.test.tsx` | P5-04 |
| `P5-calendar` (wave B) | `DatePicker.tsx`, `dateUtils.ts`, `__tests__/DatePicker.test.tsx`, `__tests__/dateUtils.test.ts`, `stories/DatePicker.stories.tsx` | `Calendar.tsx`, `Calendar.views.tsx`, `__tests__/Calendar.test.tsx`, `src/lib/date.ts`, `src/lib/__tests__/date.test.ts`, `stories/Calendar.stories.tsx` | P5-05 |
| `INTEGRATION` (wave C) | `src/index.ts`, `index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, the wave-B tests and stories a seam breaks | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md`, `docs/FLUENT-UI-COMPARISON.md`, `docs/research/fluent-ui-v9-comparison.md` | — | docs |

Disjointness check (wave B): the four packages share no file. Read only in wave B: `useActiveDescendant.ts`, `useListbox.ts`, `useTypeahead.ts`, `useRovingTabIndex.ts`, `Option.tsx`, `Combobox.expand.tsx` (Dropdown imports `showsExpandButton`), `pickerStyles.ts`, `colorUtils.ts`, `HiddenInput.tsx`, `src/lib/*`, `src/test-utils*.tsx`, `stories/_helpers.ts`. Not edited by anyone, and kept green: `TimePicker.tsx` and its tests (a `useListbox` consumer), `ColorPicker.tsx` and its tests (an `items` consumer of SwatchPicker), `List.tsx` and its tests. A package that breaks one of them reports it (rule 7).

### 3.2 Files Phases 3 and 4 change

From their first drafts (2026-09-26); both may still change. **Phase 3:** every component file (P3-00: the class of each root and part from `src/lib/classNames.ts`; the `class-names` gate rule; a `testSystemProps` case; `src/__tests__/classNames.test.ts`, whose completeness check requires a registry constant for every exported component), `ColorPicker.tsx` and the new color components (P3-05: `ColorPicker.Swatches` renders a SwatchPicker), Toast, MessageBar and Tree files, `src/lib/types.ts`, tokens, the integration, public-types and `verify-dist` files, the documentation. **Phase 4:** `src/lib/types.ts` (`CoreSize`, `InputAppearance`), `src/lib/styles.ts` (the input recipe), tokens, `useFieldControl.ts` (Field `size`), `WaveProvider.tsx` (`inputDefaults`), `inputLook.ts` (new), `Combobox.tsx`, `Combobox.expand.tsx`, `Dropdown.tsx`, `DatePicker.tsx`, `TimePicker.tsx`, `TagPicker.tsx`, `pickerStyles.ts`, Input, Textarea, Select, SearchBox, SpinButton, Checkbox, Switch, Slider, Rating, Field, Label, InfoLabel, their tests and stories, the documentation. Its listboxes and the DatePicker calendar do not change with size or appearance.

### 3.3 Waves

1. **Wave A:** `F5-foundation`. Exit: §1.8.
2. **Wave B:** `P5-pickers`, `P5-listbox`, `P5-swatches` and `P5-calendar` in parallel. Each reports its barrel requests (§4.3), the 0.7 tests it updated with the reason (§6.4), any failure it saw in another package's test and any change request.
3. **Wave C:** INTEGRATION: barrels and flat names (§4.3), the cross-package tests (§4.4), public types (§4.5), the `verify-dist` probes (§6.2), the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave E (lead):** the final gate and the real-browser checklist (§6.3).
6. **Wave F (lead), once Phase 4 is on `main`:** at the first wave boundary after Phase 4's merge commit reaches `main` (never inside a package's run), and in any case before this branch merges:
   1. `git merge main` into `feat/fluent-parity-phase-5` (a merge commit, no rebase).
   2. Resolve the conflicts: component files keep every change (P3-00's classes, P4-01's recipe, this phase's features); shared files take the union (types, barrels, tests, probes, documents).
   3. **P3-00 for this phase's parts.** Register constants in `src/lib/classNames.ts` in P3-00's scheme for `Listbox`, `Calendar` (its root and parts: the header, the previous and next buttons, the heading and its button, the grid, weekday and week-number header cells, days, months, years, the footer, "Go to today"), `ColorSwatch`, `ImageSwatch` and `EmptySwatch` (root, `icon`), `SwatchPickerRow`, and `ListboxSurface` (or its `NO_ELEMENT` entry, as P3-00's completeness test decides); add the keys this phase gives existing components (Option's multi-select box, DatePicker's footer and Close button, the multi-select value text). Keep 0.8's promise: `datePickerClassNames.header`, `previousMonthButton`, `heading`, `nextMonthButton`, `grid`, `weekday` and `day` stay on the same elements, now rendered by `CalendarView` (DatePicker passes them in, P3-00 rule 4); `swatchPickerClassNames.swatch` is on every swatch in a picker, children included; `optionClassNames.checkIcon` lands on the `checkIcon` slot and `dropdownClassNames.expandIcon` on Dropdown's. Run the conventions gate and `classNames.test.ts`.
   4. **P4-01.** The multi-select modes take their component's size and appearance with nothing to add; Dropdown's `expandIcon` glyph takes P4-01's per-size glyph size and offset (`pickerGlyphSize`, the button table); Listbox and Calendar take no size (like the pickers' listboxes and the DatePicker calendar in P4-01).
   5. Documents: the CHANGELOG keeps `## [0.10.0] - Unreleased` above `## [0.9.0]` above `## [0.8.0]`; README sections merged ("Upgrading from 0.9" after "Upgrading from 0.8"); ROADMAP status lines; CLAUDE.md; the comparison guide; the size report measured against 0.9.0.
   6. The full gate (§6.3).

---

## 4. Cross-package contracts

### 4.1 The listbox seam (F5-foundation → P5-pickers, P5-listbox)

- `useActiveDescendant(options)`: §1.1's options and result.
- `useListbox(options)`: 0.7's options plus `disabledOptionsFocusable`, `onActiveValueChange` and `mode: 'standalone'`, with `onOpenChange` optional; 0.7's result, with `ListboxListProps` as §1.2.5 says; `ListboxContextValue.multiple` and `UseListboxOptionResult.multiple`.
- `isTextEditingKey(event: React.KeyboardEvent): boolean` from `src/hooks/useListbox.ts` (module export).
- `Option` (`checkIcon`), `OptionGroup` (`label?: ReactNode`, routed names), `ListboxSurface`, `useListboxPopup` (`UseListboxPopupResult`): §1.3. The multi-select box follows the context; no package passes it a prop.

### 4.2 Types (F5-foundation → P5-calendar)

`DayOfWeek` and `FirstWeekOfYear` from `src/lib/types.ts` (§1.5). `P5-calendar` owns `src/lib/date.ts` and imports them.

### 4.3 Barrel and compound requests (INTEGRATION applies)

- `src/components/input/index.ts`: `Listbox`, `ListboxOption`, `ListboxOptionGroup`, `ListboxProps`; `SwatchPickerRow`, `SwatchPickerRowProps`, `ColorSwatch`, `ColorSwatchProps`, `ImageSwatch`, `ImageSwatchProps`, `EmptySwatch`, `EmptySwatchProps`; `Calendar`, `CalendarProps`, `CalendarLabels`, `CalendarValueChangeDetails`.
- `src/index.ts`: `addDays`, `addMonths`, `isSameDay`, `startOfWeek`, `getWeekNumber` and `GetWeekNumberOptions` from `./lib/date` (under "Utilities"; the other module exports stay internal).
- `scripts/verify-dist.mjs`: `PENDING_FLAT_EXPORTS = []` once `SwatchPickerRow` is exported; the server probe calls `addDays` from the entry under `react-server` and gets a `Date` (a plain function, not a client reference); `REQUIRED_DECLARATIONS` gains `useActiveDescendant` and `Calendar`.
- `CalendarView` and `isTextEditingKey` stay module exports (not in a barrel); `src/__tests__/public-types.test.ts`'s walker must not report them (neither appears in a public signature).

### 4.4 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

1. The real Field around a Listbox (label, message and hint, a required Field blocks an empty submit, the error state) and around a Calendar (the group labelled and described, required).
2. A multi-select Dropdown and Combobox in a `<form>`: `FormData.getAll(name)` has one entry per value; a reset restores `defaultValue` and reports nothing when unchanged.
3. A Listbox in a Dialog: the list takes focus from Tab, its keys work, Escape closes the Dialog (the list does not consume it).
4. A Tooltip with `relationship="label"` around a `ColorSwatch`, in both layouts: the button is named by it and shows it on focus.
5. A DatePicker in a Dialog: Escape in the month view shows the day view, the next Escape closes the DatePicker and returns focus, a third closes the Dialog.
6. The Server Component suite: `Listbox` with `ListboxOption` and `ListboxOptionGroup` as client references (`asClientReference`) renders the same `renderToString` output and behaves as the plain parts; `SwatchPicker` with `SwatchPickerRow`, `ColorSwatch` and `EmptySwatch` references likewise; a `Calendar` with `today` renders and hydrates without warnings.
7. The custom picker of the Listbox story, written against the package entry only (`useListbox`, `useListboxPopup`, `ListboxSurface`, `Option`): opens, filters, selects and submits.

### 4.5 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

Every new exported type in the import list; `DropdownProps`, `ComboboxProps` and `ListboxProps` without a type argument have `value?: string`; `ComboboxProps<true>['freeform']` is `undefined` (`never` optional); `SwatchPickerSize` includes `'extra-small'`; `OptionGroupProps['label']` is `React.ReactNode`; `CalendarProps['onValueChange']` takes an optional `CalendarValueChangeDetails`; `DatePickerLabels` extends `CalendarLabels`; the date helpers' signatures.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.10.0] - Unreleased` section above the previous one (in wave F, above `## [0.9.0]`), with:

- **Upgrading from 0.9** (numbered): DatePicker's calendar heading is a button (the month picker, on by default; `showMonthPicker={false}` keeps a static heading), so the dialog's Tab order gains a stop and tests that count Tab presses change; the `Option` context error names every listbox; `OptionGroup`'s `aria-label`/`aria-labelledby` land on its group list; `ListboxContextValue` and `UseListboxOptionResult` gained `multiple`; SwatchPicker's root renders `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing`, and its `items` are optional; `React.ComponentProps<typeof Dropdown>` (and Combobox's) is now `DropdownProps<boolean>`, whose value types are unions (use `DropdownProps` for the single-value shape).
- **Added:** per item (the multi-select pickers, `filter`, `query`, `onActiveOptionChange`, `expandIcon`, `renderValue`, `disabledOptionsFocusable`, `checkIcon`, rich optional group labels, `Listbox`, the public listbox primitives and `useActiveDescendant`, the swatch kinds, `layout`, `focusMode`, `spacing`, `'extra-small'`, `Calendar`, the month and year views, week numbers, marked days, `renderDay`, ranges, "Go to today", `showCloseButton`, `today`, `initialVisibleDate`, the date helpers, `DayOfWeek`, `FirstWeekOfYear`), each with the gap ids it closes.
- **Types:** the members added to the public listbox interfaces; the generic prop interfaces.
- **Size:** `dist/styles.css`, the Button-only and full-import probes, measured against the previous release.

### 5.2 README

"Components" (Listbox, Calendar, `ColorSwatch`, `ImageSwatch`, `EmptySwatch`); usage notes "Multi-select pickers", "Filtering and async search", "Listbox and custom pickers" (List vs Listbox; building a picker on `useListbox`), "Swatches" (children, the grid layout, focus modes, kinds), "Calendar" (the views, week numbers, ranges, SSR and `today`); "Built-in text" (the `CalendarLabels` rows and DatePicker's `close`); "Keyboard support" (Listbox; the multi-select pickers; the swatch grid and tab mode; the calendar's month and year views and Escape levels); "Hooks and utilities" (`useActiveDescendant`, the listbox primitives, `ListboxSurface`, `useListboxPopup`, the date helpers); "Upgrading from 0.9".

### 5.3 CLAUDE.md

"Architecture": the new modules (`Listbox.tsx`, `Calendar.tsx` and `Calendar.views.tsx`, `SwatchPicker.context.ts` and `SwatchPicker.swatches.tsx`, `src/lib/date.ts`); the public hooks list gains `useActiveDescendant`, `useListbox` and `useListboxOption` (with the listbox types); the internal list gains `useRovingGrid` and loses `useListbox`; the internals line keeps `CalendarView` and `isTextEditingKey`; `Option.tsx`'s entry says `ListboxSurface` and `useListboxPopup` are public. No convention changes.

### 5.4 Guide and testing guide

`docs/WAVE-UI-GUIDE.md`: "Building a custom picker" (`useListbox`, `ListboxSurface`, `useListboxPopup`, `Option`, `markListboxElement` for option components of your own) and "Active-descendant widgets" (`useActiveDescendant`). `docs/testing-best-practices.md`: testing an active-descendant widget (assert `aria-activedescendant` and the option's `data-active`, never DOM focus on the option).

### 5.5 ROADMAP

§8.3 gains "Behaviour differences decided by a phase spec (Phase 5, 0.10.0)": multi-select listboxes keep APG's `aria-multiselectable` (D2); typing never clears a Combobox selection and a blur selects nothing (D12); Alt+ArrowDown and Alt+ArrowUp open or close without moving the highlight, and Home and End in an editable combobox move the caret; `onActiveOptionChange` reports pointer hover (D14); the calendar's PageUp/PageDown direction and Shift modifier, day-of-month paging and six-week grid (D27); SwatchPicker's `circular` default shape (D22). The status line marks Phase 5 released when 0.10.0 ships (not in this phase).

### 5.6 `docs/FLUENT-UI-COMPARISON.md` and the gap report

The comparison guide (new on `main`, d5a84bd): §5.3's Combobox, Dropdown, Listbox, SwatchPicker and Calendar rows and migration notes (multi-select `value` arrays; `useComboboxFilter` vs `filter`; swatch children; Calendar); §3.9's SwatchPicker keyboard row (`focusMode` shipped); §2 and §7's "not in WaveUI yet" rows for these items removed; the "Related documents" counts. `docs/research/fluent-ui-v9-comparison.md` gets rows with ids for `imageswatch-1` and `emptyswatch-1` in §4.3's low-impact list (the roadmap cites them; the report's §3 lists the two components without ids); no other change to the report (a dated snapshot).

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

`npx vitest run <own test files> --reporter=default` with clean output (no act() warnings, every `[WaveUI]` warning asserted); the conventions and stories gates for the package's files; `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.dev.json --noEmit` filtered to its paths; `npx eslint` and `npx prettier --check` on its files. Wave A also runs its §1.8 exit criteria.

### 6.2 `verify-dist` probes (INTEGRATION)

- The Button-only tree-shaking probe is unchanged.
- An import of only `Calendar` contains none of `hooks/useListbox`, `components/input/Option` and `components/input/Dropdown`; an import of only `Listbox` contains no `components/input/Calendar` (D37).
- The server probe of §4.3 (`addDays` is callable under `react-server`).
- The flat names of §4.3; `--final` requires the bridge empty.

### 6.3 Final gate (wave E) and real-browser checklist

The roadmap §3 exit criteria through `/gate` (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`), plus the CHANGELOG, README and CLAUDE.md checks of the gate script. Real browsers (Chromium, Firefox, Safari where available; NVDA with Firefox or Chrome, VoiceOver with Safari), checked through `/browser-check` in Storybook, since jsdom cannot:

1. The multi-select Combobox: typing, paste, drag-and-drop text and IME composition (Japanese or Chinese) over the labels; Backspace on the labels.
2. The Listbox: a click focuses it and selects; the active option scrolls into view; a screen reader announces the active option and the selection (single and multiple).
3. The swatch grid: the arrow keys in LTR and RTL; a Tooltip on hover and focus; the selected state announced on the focused swatch (`aria-pressed`).
4. The Calendar drill-down: the heading announced after each view change; focus lands on the right cell; Escape levels in a DatePicker; week numbers read as row headers.
5. Forced colours (Windows high contrast): the multi-select option boxes, the swatch slash and check, the calendar's selected, today, marked and disabled cells in every view.
6. A server-rendered Calendar (`renderToString` in a Storybook-free fixture, or the pack-smoke fixture) hydrates without warnings in a browser whose time zone differs from the server's, with and without `today`.

### 6.4 Existing tests expected to change (update, do not delete)

- `Option.test.tsx:205`, `useListbox.test.tsx:2365` and `:2389` (F5-foundation): the missing-context message names every listbox (§1.2.8).
- `DatePicker.test.tsx` (P5-calendar): tests that count Tab presses inside the dialog or list its tabbable elements gain the heading button between the previous- and next-month buttons; queries by `role: 'heading'` and the month name, the `aria-live` check and the grid's `aria-labelledby` stay as they are (the button's name is the heading text). Any other change is reported (rule 23).
- `SwatchPicker.test.tsx` (P5-swatches): only assertions of the root's exact attribute list, if any, for the new `data-*` attributes.
- No other 0.7 test is expected to change; `public-types.test.ts` and `integration.test.tsx` only gain cases.

### 6.5 Definition of done for Phase 5

Every item's acceptance criteria (roadmap Phase 5) are met and covered by tests; waves A to E are committed; the final gate and the real-browser checklist pass; wave F is merged and its gate passes; the documents of §5 are complete; this spec's §10 records the implementation notes.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `dropdown-1` | M | P5-01 | P5-pickers |
| `combobox-1` | M | P5-01 | P5-pickers |
| `filter-1` | M | P5-02 | P5-pickers |
| `filter-2` | M | P5-02 | P5-pickers |
| `combobox-6` | L | P5-02 | F5-foundation (`onActiveValueChange`), P5-pickers |
| `dropdown-6` | L | P5-02 | F5-foundation, P5-pickers |
| `listbox-2` | M | P5-03 | F5-foundation (primitives, exports) |
| `listbox-1` | L | P5-03 | P5-listbox |
| `dropdown-4` | L | P5-03 | P5-pickers |
| `option-1` | L | P5-03 | F5-foundation (`disabledOptionsFocusable`), P5-pickers, P5-listbox |
| `option-2` | L | P5-03 | F5-foundation |
| `option-3` | L | P5-03 | F5-foundation |
| `swatchpicker-1` | M | P5-04 | P5-swatches |
| `swatchpicker-2` | L | P5-04 | P5-swatches |
| `swatchpicker-3` | L | P5-04 | P5-swatches |
| `swatchpicker-4` | L | P5-04 | P5-swatches |
| `colorswatch-1` | L | P5-04 | P5-swatches |
| `colorswatch-2` | L | P5-04 | P5-swatches |
| `imageswatch-1` | L | P5-04 | P5-swatches |
| `emptyswatch-1` | L | P5-04 | P5-swatches |
| `calendar-1` | M | P5-05 | P5-calendar |
| `datepicker-1` | M | P5-05 | P5-calendar |
| `calendar-2` | L | P5-05 | P5-calendar |
| `datepicker-2` | L | P5-05 | P5-calendar |
| `datepicker-3` | L | P5-05 | P5-calendar |
| `datepicker-4` | L | P5-05 | P5-calendar |
| `datepicker-5` | L | P5-05 | P5-calendar |
| `datepicker-6` | L | P5-05 | P5-calendar |

8 medium and 20 low gaps. Not closed here: `swatchpicker-5` and `datepicker-7` (intentional differences, ROADMAP §8.3), `combobox-5`, `dropdown-5` and `datepicker-9` (P7-01), `combobox-7` (backlog), the other `tagpicker-*` gaps (Phase 6).

---

## 8. Open questions for the maintainer

1. **`showGoToToday` default** — `false` (D32: 0.9 popups unchanged) or Fluent's `true`? Recommendation: `false`.
2. **Week numbering default** — `'first-day'` (D30: Fluent's code) or `'first-four-day-week'` (ISO 8601, the European norm)? Recommendation: `'first-day'` for parity; the JSDoc shows the ISO setting.
3. **`EmptySwatch` name** — no built-in text (D21: the consumer's `aria-label`, warning without) or a built-in `'Add color'` label? Recommendation: none; what the button adds is the app's.
4. **Wave F timing** — merge Phases 3 and 4 in as soon as Phase 4 is on `main` (at the next wave boundary, as §3.3 says), or only after wave E? Recommendation: as soon as possible, so the final gate runs once on the merged tree.

---

## 9. Review notes

(Written after the three reviews.)

## 10. Implementation notes

(Written during implementation.)
