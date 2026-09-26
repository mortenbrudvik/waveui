# WaveUI 0.10.0 — Fluent Parity Phase 5 Design (pickers)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-5` (worktree `.claude/worktrees/fluent-parity-phase-5`, from `main` d5a84bd, where 0.7.0 = Phases 1 and 2 is released) · Package: `@mortenbrudvik/waveui` → **0.10.0**. Phase 3 (0.8.0) and Phase 4 (0.9.0) are designed and built at the same time in other sessions, on their own branches; both merge to `main` before this branch, which merges them in before its release (§3.3, wave F).
> Scope: Phase 5 of [`docs/ROADMAP.md`](../../ROADMAP.md): the items P5-01 … P5-05. They close 8 medium and 20 low gaps of the Fluent UI v9 comparison (§7).
> Inputs: the roadmap's Phase 5 section, its goals and naming (§1), principles (§2) and process (§3); the Phase 2 spec [`2026-09-26-fluent-parity-phase-2-design.md`](2026-09-26-fluent-parity-phase-2-design.md), the model for this document; the first drafts of the Phase 3 and Phase 4 specs (their branches, 2026-09-26), read for the merge: P3-00's class-name registry (`src/lib/classNames.ts`, the `class-names` gate rule, the stability promise) and P4-01's input recipe (`CoreSize`, `InputAppearance`, `useInputLook`, `pickerStyles.ts`); the verified gap entries `dropdown-*`, `combobox-*`, `filter-*`, `listbox-*`, `option-*`, `swatchpicker-*`, `colorswatch-*`, `calendar-*` and `datepicker-*`; Fluent read at its source (`microsoft/fluentui` master 8add8c8: `react-combobox` with its `docs/Spec.md`, `react-aria`'s `activedescendant`, `react-tag-picker`, `react-swatch-picker` 9.6.2, `react-calendar-compat`, `react-datepicker-compat`); the WAI-ARIA APG listbox, combobox, grid, radio group and date picker dialog patterns; WCAG 2.2 Understanding 2.5.8. Every API below was checked against the 0.7.0 source it changes: `useListbox.ts`, `useTypeahead.ts`, `useRovingTabIndex.ts`, `Option.tsx`, `Dropdown.tsx`, `Combobox.tsx`, `Combobox.expand.tsx`, `pickerStyles.ts`, `TagPicker.tsx`, `TimePicker.tsx` (a `useListbox` consumer this phase must not change), `List.tsx`, `SwatchPicker.tsx`, `colorUtils.ts`, `ColorPicker.tsx` (an `items` consumer), `DatePicker.tsx`, `dateUtils.ts`, `HiddenInput.tsx`, `Button.slots.tsx`, `slot.ts`, `styles.ts`, `aria.ts`, `dev.ts`, `layers.ts`, `lib/types.ts`, `scripts/verify-dist.mjs` and their tests, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts` and `.storybook/__tests__/exportDocblocks.test.ts`; the prop typing of D9 was checked with `tsc` (§9).
> Maintainer rulings (binding, from the design review of 2026-09-26, six sections approved one by one): (1) the release is 0.10.0 with a new `## [0.10.0] - Unreleased` CHANGELOG section, built in parallel with Phases 3 and 4 and merged after both; P5-01's dependency on P4-01 is resolved in that merge (D1); (2) `useActiveDescendant` is state-based and extracted from `useListbox`, which is rebuilt on it (D3); (3) a multi-select Combobox shows the selected labels while there is no query, and the first edit replaces them (D11); (4) SwatchPicker's grid layout is an APG grid with Fluent's semantics (D20); (5) the month and year pickers are a drill-down in one pane, with no side-by-side layout (D26). The Phase 2 lead rulings carry over: Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, extra data in an optional `details` argument); APG behaviour first.
> Status: approved by the maintainer on 2026-09-26, after three reviews of the first draft (API conventions; accessibility and behaviour; the code, sequencing and verification). Every blocker and major point was applied; §9 lists the points not applied, or applied differently, and why. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). The open questions of §8 are answered by the maintainer before wave A starts (roadmap §3, entry criteria).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F5-foundation` | `useActiveDescendant` (new, public); `useListbox` rebuilt on it, with `details` callbacks, `multiselect` (renamed from `multiple`), `disabledOptionsFocusable`, `onActiveValueChange`, the standalone mode and its public JSDoc; `Option` (`checkIcon`, the multi-select box) and `OptionGroup` (optional rich `label`, routed names); `ListboxProvider` (new), `ListboxSurface` and `useListboxPopup` made public; `DayOfWeek` and `FirstWeekOfYear` in `src/lib/types.ts`; the entry exports of the listbox primitives and `DismissReason`; the tests and checks those exports touch; the `verify-dist` flat-name bridge | P5-03 (primitives, Option parts); the shared pieces of P5-01 and P5-02 | wave A |
| `P5-pickers` | Dropdown, Combobox and TagPicker: multi-select with announcements, `filter` and `query`, `onActiveOptionChange`, Dropdown `expandIcon` and `renderValue`, `disabledOptionsFocusable` on Dropdown and Combobox, in the order P5-01 → P5-02 → P5-03 | P5-01, P5-02, P5-03 (Dropdown and Combobox parts) | wave B |
| `P5-listbox` | the standalone `Listbox` (`Listbox.Option`, `Listbox.OptionGroup`) and its stories, among them the acceptance story (a custom picker built only on public API) and a `useActiveDescendant` command palette | P5-03 (Listbox) | wave B |
| `P5-swatches` | SwatchPicker children, `layout`, `focusMode`, `spacing`, the `'extra-small'` size and `labels`; `ColorSwatch`, `ImageSwatch`, `EmptySwatch`, `SwatchPicker.Row`; the internal `useRovingGrid` | P5-04 | wave B |
| `P5-calendar` | `Calendar` (new) and DatePicker rendered on it; the month and year views, week numbers, marked days, custom day content, range selection, "Go to today", DatePicker's close button; the public date helpers in `src/lib/date.ts` | P5-05 | wave B |
| `INTEGRATION` | barrels, the flat names of the new compound members, story imports, the cross-package tests (Field, forms, Dialog, Popover, Tooltip, Server Components), public type tests, the `verify-dist` flat names, fixtures and probes | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP, `docs/FLUENT-UI-COMPARISON.md`, the gap report's two missing ids | — | wave D |
| lead | the final gate (wave E) and the merge with Phases 3 and 4 (wave F) | — | waves E, F |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) apply unchanged, with F5 in place of F1. So do the Phase 2 rules 15 (no built-in motion), 16 (pointer tests) and 17 (direction). In addition:

19. **Wave A is exclusive.** `F5-foundation` lands and is committed by the lead before wave B starts. Because it runs alone, it edits the few files outside its area that its exports and renames reach (§3.1: `src/index.ts`, `src/components/input/index.ts`, `TagPicker.tsx`'s one `useListbox` line, `DismissReason`'s JSDoc in `src/lib/layers.ts`, the internal-helper list of `integration.test.tsx`, the bridge case of `verify-dist.test.mjs`, the new pairs of `tokens.test.ts`, `public-types.test.ts`'s new lines); every other barrel, public-types and `verify-dist` change is INTEGRATION's.
20. **The listbox seam is frozen in wave B.** The modules, members and types listed in §4.1 keep their names, types and meaning. `useActiveDescendant.ts`, `useListbox.ts`, `useTypeahead.ts` and `Option.tsx` have no owner in wave B (read only); a change is a change request (rule 7) with a failing test. `.storybook/__tests__/exportDocblocks.test.ts` pins the names `OptionImpl` and `OptionGroupImpl` in `Option.tsx`: keep them.
21. **Compound members.** `P5-listbox` attaches `Listbox.Option` and `Listbox.OptionGroup` (it owns `Listbox.tsx`) and `P5-swatches` attaches `SwatchPicker.Row` (it owns `SwatchPicker.tsx`); each module also exports the flat names (`ListboxOption`, `ListboxOptionGroup`, `SwatchPickerRow`) with a JSDoc each (verify-dist's undocumented-component check). INTEGRATION adds them to the input barrel in wave C. Until then `verify-dist`'s `PENDING_FLAT_EXPORTS` lists `'SwatchPicker'` (§1.7), and `integration.test.tsx`'s source-level flat-name case fails for `SwatchPickerRow` once wave B lands: a known failure between waves B and C, which the lead does not count against a package. `Listbox` needs no bridge entry: it is not exported before wave C.
22. **Phases 3 and 4.** Waves A to E build on the 0.7 API of the files they change: no stable class names (P3-00), no `size` or `appearance` (P4-01), no new tokens beyond §1.8's pairs. Wave F adapts (§3.3). If wave F runs before a later wave, every package that starts after it follows P3-00's class-name rule for the parts it adds and P4-01's recipe for the sizes it touches, as the merged gates require.
23. **The DatePicker suite is the Calendar's regression suite.** `P5-calendar` moves DatePicker's grid into the calendar modules without changing a DatePicker test other than the ones §6.4 lists. A DatePicker test that needs another change is reported to the lead with the reason, not edited.
24. **Tailwind words.** JSDoc and comments under `src/components` and `src/lib` never write a Tailwind utility as a bare word (CLAUDE.md "Styling"): the swatch and calendar docs say "the grid layout" and "the row element", never a bare class name that no class string uses (docs/WAVE-UI-GUIDE.md Pattern 5).
25. **Stories import from module paths in wave B** (`import { Listbox } from '../src/components/input/Listbox'`); INTEGRATION normalises them to `../src` in wave C, as Phase 1 did.
26. **C-DOCS checklist.** Every new prop states its `@default` (a swatch's `size` and `shape`: "the picker's"; `CalendarLabels` members: the English text); JSDoc that `disabledOptionsFocusable` makes untrue is updated (`OptionProps.disabled`, `ListboxItem.disabled`, the `useListbox` docblock); `Option`'s docblock names every host; `checkIcon` carries Phase 1 D21's "Unlike …" sentence for a required indicator; a prop whose Fluent name differs names it (`multiselect`/`selectedOptions`, `showMonthPicker`/`isMonthPickerVisible`, `selectionRange`/`dateRangeType`, `onValueChange`/`onSelectDate`, `initialVisibleDate`/`initialPickerDate`, `markedDates`/`getMarkedDays`).

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; Phase 1 and 2 rulings are cited as "Phase 1 D21" and "Phase 2 D11".

- **D1 — Parallel phases and one merge.** Phase 5 is designed and built while Phases 3 and 4 are built in other sessions. The roadmap's entry criterion ("0.9.0 merged to `main`") is waived for the start, not for the merge: this branch merges to `main` only after Phase 4, which carries Phase 3. P5-01 depends on P4-01 for the look only, so the multi-select mode is built on 0.7's Dropdown and Combobox styles and receives P4-01's sizes and appearances in wave F, where the lead also applies P3-00's registry to every part this phase adds (§3.3). *Why:* the maintainer runs the three phases in parallel (2026-09-26); the only code dependency (P5-01 → P4-01) is visual, and resolving it once in a merge is cheaper than sequencing three phases.
- **D2 — APG listbox semantics for multi-select.** `role="listbox"` with `aria-multiselectable="true"`, and options with `aria-selected`, in Dropdown, Combobox, the standalone Listbox and (as in 0.7) TagPicker. Fluent switches a multi-select listbox to `role="menu"` with `menuitemcheckbox` options. Toggles are also announced (D41), since screen readers report `aria-selected` changes of an active descendant unevenly. *Why:* the APG listbox pattern (roadmap principle 5); `useListbox` and TagPicker already render it; a combobox's popup must be a listbox, grid, tree or dialog.
- **D3 — `useActiveDescendant` is state-based and `useListbox` is built on it (maintainer ruling).** The hook keeps the moved-to item in React state, derives `activeValue` and `activeDescendantId` during render and exposes navigation methods. It owns the highlight rules `useListbox` follows in 0.7 (§1.1): a moved-to item is dropped when it leaves `items` or the hook is disabled, and never comes back without a user action; a `fallback` is active while nothing was moved to; the first item becomes active when the items change (opt-in); pointer moves are not scrolled into view. `useListbox` keeps its behaviour and delegates to it. Fluent's `useActiveDescendant` walks the DOM with a TreeWalker and writes `aria-activedescendant` imperatively. *Why:* one model for the library; SSR-safe (nothing reads the DOM during render, and the id is derived, not written); the 0.7 `useListbox` suite (2,460 lines) guards the refactor; P7-03 documents the hook with the focus utilities.
- **D4 — `useListbox` becomes public as a whole.** Its options and result, `useListboxOption`, `ListboxProvider` (D40), `collectOptionLabels`, `markListboxElement`, `ListboxSurface` and `useListboxPopup` are exported with their types, and `DismissReason` with them (`useListboxPopup`'s `onDismiss` names it; P7-01 publishes `useDismiss` with the same type later). The roadmap's "documented stable subset" is this set; the store's `register` and `getIndex` members are documented as the contract of option components. *Why:* a custom picker needs each of them (the acceptance story is built only on public API), and a subset of a result type cannot be published without a wrapper that duplicates it.
- **D5 — The standalone mode.** `useListbox({ mode: 'standalone' })` serves a listbox that holds focus itself. `getListboxProps()` returns `tabIndex: 0`, `aria-activedescendant` and a `ref` (the hook uses the element to take focus on a pointer press, D17), and no mouse-down prevention on the list; ArrowDown, ArrowUp, Home, End, PageUp, PageDown and typeahead move the active option; Space and Enter commit (toggle with `multiselect`), never close, and keep the committed option active; Tab, Escape and Alt+Arrow are not handled; `onOpenChange` is optional and never called; `open` means "the active option is shown" (the Listbox passes its focus state). *Why:* the Listbox needs the registration, groups, labels, typeahead and commit of the pickers; a second hook would duplicate the registry.
- **D6 — Disabled options stay skipped by default; `disabledOptionsFocusable` opts in.** With it, disabled options join every navigation path (arrows, Home, End, PageUp, PageDown, typeahead and the `autoHighlight` fallback) and still never commit: Enter, Space and a click do nothing on them and the list stays open, and Tab and Alt+ArrowUp in single-select select-only mode close without committing. Fluent keeps them reachable always (`option-1`). *Why:* the roadmap's opt-in; the 0.7 default stays (principle 2); APG allows both.
- **D7 — `checkIcon` is a required indicator** (Phase 1 D21). `Option`'s `checkIcon?: Slot<'span'>` replaces the check glyph; `null`, `undefined` and a value that renders nothing keep the default, and a value that renders nothing warns once from an effect (`Option:checkIcon-empty`). The default glyph keeps 0.7's `<svg>` with its classes (a consumer glyph renders through `renderSlot`'s `<span>`), so 0.7 tests and P3-00's `optionClassNames.checkIcon` (on the `<svg>` in 0.8) stay on the same element. Fluent lets `checkIcon={null}` remove it. *Why:* the check is the non-colour sign of the selection (WCAG 1.4.1).
- **D8 — The multi-select box.** In a listbox with `multiselect` whose options draw a check (`showCheck`, which TagPicker turns off), every option draws its check inside a 16px checkbox square: `rounded-xs border`, unchecked `border-stroke-accessible bg-transparent` with `forcedColors.control`, checked `border-primary bg-primary text-primary-foreground` with `forcedColors.selectedLeaf`; the glyph shows only while selected. In multi-select mode the option's `forcedColors.selectedContainer` outline is dropped (the box carries the state, and the Highlight outline would make every selected option look like the active one). Single-select options keep the 0.7 check. `tokens.test.ts` gains the pairs the box needs (§1.8). *Why:* Fluent's look; a list of checkboxes reads as multi-select at a glance; Checkbox's own colours.
- **D9 — Multi-select typing: two overloads.** `DropdownProps<M extends boolean = false>`, `ComboboxProps<M …>` and `ListboxProps<M …>` take `multiselect?: M`; while `M` is `true`, `value` and `defaultValue` are `readonly string[]` and `onValueChange` and `renderValue` receive `string[]`, else the 0.7 string types apply. The exported components are typed with two call signatures, `(props: XProps<true> & { multiselect: true })` first and `(props: XProps)` last, so `<Dropdown multiselect onValueChange={(v) => …}>` types `v` as `string[]`, `<Dropdown value="a" onValueChange={(v) => …}>` types it as `string`, and `React.ComponentProps<typeof Dropdown>` stays `DropdownProps`, exactly as in 0.9 (TypeScript reads the last signature). A non-literal `multiselect={flag}` matches neither signature: render two elements (the value types differ anyway). `DropdownProps` without a type argument is the 0.9 shape and stays extendable by interfaces. The JSDoc names Fluent's `selectedOptions` and `onOptionSelect`. *Why:* a generic root (List's precedent) would turn `ComponentProps<typeof Dropdown>` into `DropdownProps<boolean>`, whose `onValueChange` is a union no string can be passed to (principle 2), and an overload for a boolean `multiselect` placed before the single-select one takes the contextual type away from the common single-select callback (both checked with `tsc`, §9).
- **D10 — Multi-select commits.** Enter, Space and a click toggle the active option and keep the list open (0.7 `useListbox` with `multiselect`); Tab, Escape and Alt+ArrowUp close without committing. The value keeps selection order (checking appends, unchecking removes), and the Dropdown button shows `labels.selection(labels)` (default: the labels joined with `', '`; values without an option are left out, as a single value without an option shows nothing in 0.7); `renderValue` replaces that content. `clearable` clears every value (Fluent disables `clearable` with `multiselect`). A form submits one entry per value, `required` needs one value, and a form reset restores `defaultValue`, compared by content, so an unchanged reset reports nothing. The deprecated `onOptionSelect` is called with the toggled option on every activation. *Why:* Fluent's commits; "clear all" is the obvious meaning of the clear button; TagPicker's form model; the joined text is locale-dependent (Arabic `،`, CJK `、`), so it is built-in text (C-NAMING).
- **D11 — The multi-select Combobox input (maintainer ruling).** While there is no query the input shows `labels.selection(labels)` (D10) and not its placeholder; the first edit replaces the labels:
  1. Focusing the input while the labels show, by keyboard or pointer, selects its whole text (after a pointer press the selection is kept on `mouseup`), so an edit of any kind — typing, paste, cut, IME composition, dictation, autocorrect — replaces the labels natively, without the component rewriting the value during the edit.
  2. An `onChange` while the labels show takes the text the edit inserted as the query: the new value without the part it shares with the labels at its start and its end. This covers a drop and an edit after the user moved the caret into the labels.
  3. A new value equal to the labels (an undo) shows the labels again, with no query.
  4. Backspace and Delete edit the text and never remove a selected value; the options, the clear button and a form reset change the value.
  A toggle clears the query, so the labels show again with the list still open; a close and a blur clear it too. `freeform` is not available with `multiselect` (the first signature has no `freeform`). *Why:* the selection stays visible and is read as the input's value; typing after "Apple, Banana" would filter for text no option has; native replacement keeps IME compositions intact, which rewriting the value inside the keydown that starts one does not; free text cannot be one of several values (free tagging is TagPicker's, `tagpicker-6`).
- **D12 — The query.** Combobox and TagPicker get `query`, `defaultQuery` and `onQueryChange(query)`: the text typed since the last commit, which filters the options. Combobox resets it to `''` where it drops its draft in 0.7 (a commit, a close, a blur, Escape, the clear button, a form reset); TagPicker where it clears its text in 0.7 (a tag added, Escape with text, a form reset). Locking the control (`disabled` or `readOnly`) while text is typed hides the text during render and reports the reset (`onQueryChange('')`) from an effect, as 0.7 reports the close of a locked list (`lockedOpen`): a value callback never runs during render. A controlled non-empty `query` is shown in the input and filters; `''` shows the selected label(s) unless the user is editing, so erased text stays empty. With `freeform` the query props are unused (the text is the value; `onQueryChange` is never called) and a `query` or `defaultQuery` prop warns once (`Combobox:query-freeform`). The typing model does not change: typing never clears the selection, and a blur never selects an option whose text matches (Fluent does both). *Why:* `filter-2`'s async search needs the text; 0.7's draft model is kept (principle 2); C-HOOKS render purity.
- **D13 — `filter`.** `filter?: (option: ListboxItem, query: string) => boolean` on Combobox and TagPicker, called for every option that is not hidden whenever the typed text is non-empty: the query, or a freeform Combobox's text (0.7 filters freeform text too). The default is the 0.7 match: a case-insensitive substring of `textValue ?? label` (TagPicker's options have no `textValue`, so its 0.7 match on `label` is the same). A filter may keep options that do not contain the text: `filter={() => true}` with `onQueryChange` and options of your own gives server-side search, and a filter that always keeps a synthetic option gives a "Create "…"" entry (the 0.10 workaround for GitHub issue #6, before P6-04; keep this contract). Fluent's `useComboboxFilter(query, options, config)` is a render helper whose filter takes a string. *Why:* the option object lets a filter tell the label from `textValue`; `ListboxItem` is public (D4).
- **D14 — `onActiveOptionChange(value: string | null)`** on Dropdown, Combobox and Listbox. It reports every change of the active option (arrows, typeahead, pointer hover, a filter change, opening) and `null` when the list closes (the Listbox: when it loses focus), from an effect after the commit (`useActiveDescendant`'s `onActiveValueChange`). Fluent never reports hover (its options have no hover highlight) and nothing on close. *Why:* one rule, "what `aria-activedescendant` points at"; previews that follow the pointer are a common use.
- **D15 — Dropdown's `expandIcon` and `renderValue`.** `expandIcon?: Slot<'span'>` follows the optional-indicator rule (Phase 1 D21: `null` and `undefined` keep the chevron, `false` or anything that renders nothing hides it) and, as a glyph inside the combobox button, is decorative (`aria-hidden`) and unwraps a button element through `unwrapButtonGlyph` with a one-time warning of its own (`Dropdown:expandIcon-button`: "its children render as the glyph of the combobox button"). The default glyph keeps 0.7's `<svg>` with its classes (a consumer glyph renders in a `<span>` with the same positioning), so 0.7 tests and P3-00's `dropdownClassNames.expandIcon` stay on the same element. Without a glyph the button's end padding and the clear button's offset follow Combobox's count (`pickerEndPadding(Number(showClear) + Number(showExpand))`, the clear button at `end-1`). `renderValue(value)` renders the button's content while a value is selected (the placeholder otherwise); it must be non-interactive, and its text is the combobox's value, so image-only content leaves the value empty (the JSDoc says so). Fluent overrides the `button` slot's children. *Why:* C-SLOTS; a render function covers rich content without a slot on the combobox element.
- **D16 — `OptionGroup` naming.** `label?: ReactNode` (widened, optional; text only: an interactive label is neither reachable nor allowed in a listbox). `aria-label` and `aria-labelledby` passed to `OptionGroup` go to its `role="group"` list (0.7 puts every rest prop on the `role="presentation"` item, where a name is ignored); a defined consumer name wins over the heading's `aria-labelledby`, and an `undefined` one (a forwarding wrapper) does not (Phase 2 D12's rule). A group whose name is empty after mount — no label text (an icon-only label included), no `aria-label`, no `aria-labelledby` — warns once from an effect (`OptionGroup:unnamed`). *Why:* `option-3`; Fluent's `label` slot is optional with the same advice.
- **D17 — The standalone Listbox.** One `<ul role="listbox">` holds focus and `aria-activedescendant` (D5).
  - **Selection** does not follow focus: Space and Enter select (APG allows either, Fluent does the same); in single-select mode the selected option stays selected when selected again (no deselection, unlike List `selectable`); the arrow keys do not wrap (APG; List `selectable` wraps).
  - **Focus.** The active option exists only while the list has focus (the selected option, else the first), so its outline never shows on a list the user is not in; while the list has focus and no option can be active (an empty list, every option hidden, every option disabled without `disabledOptionsFocusable`), the `<ul>` itself shows `focusRing`, so focus is always visible (WCAG 2.4.7).
  - **Pointer press.** An option's `mousedown` prevents the default, focuses the list without scrolling and makes the pressed option active without scrolling, in one update, so the `click` that follows commits the pressed option even when the selected option is scrolled out of view (otherwise focus would scroll the list under the pointer before `mouseup`).
  - **`disabled`** renders `aria-disabled` and `data-disabled`, no `tabIndex` (so neither Tab nor a click focuses it, as a disabled native `<select>`), selects nothing and submits nothing.
  - **Forms.** The hidden inputs render inside the list: `HiddenInput` returns focus to its parent element, so its parent must be the list (a `<ul>` holding `<input>` elements is not conforming HTML; `role="listbox"` removes the list semantics axe's `list` rule checks, and the inputs are hidden, so assistive technology is unaffected). Single-select mode submits a `text`-kind value, multi-select one entry per value.
  - No built-in height. Shift+Arrow range selection and Ctrl+A are not in 0.10.
  *Why:* APG listbox; Fluent parity; a focus-scoped highlight follows APG's visual focus; the pointer rule keeps clicks working in scrolled lists.
- **D18 — SwatchPicker composition.** Swatches are children that read a `SwatchPickerContext` (C-CONTEXT: a swatch outside a picker throws in development and renders inert in production). `items` stays, optional now, and renders `ColorSwatch`es before the children, so `<SwatchPicker items={colors}><EmptySwatch onClick={…} /></SwatchPicker>` works in both layouts (D20). A swatch reads the nearest picker's context, also across a portal (React context crosses portals): swatches in a Popover opened from a picker belong in a SwatchPicker of their own (a ColorPicker has one). The `ref`, `className`, `style`, name and rest props of every swatch go to its `<button>` in every layout: an explicit exception to C-ROUTING's root/control split, because a wrapping Tooltip's ARIA and handlers must reach the element that has focus. Swatch values are unique: a duplicated value warns once per value (C-DEV). *Why:* `swatchpicker-1` (a Tooltip around a swatch); one implementation for both inputs.
- **D19 — `focusMode`.** `'arrow'` (default, 0.7): one tab stop and arrow keys, with the radio group (row layout) or grid (grid layout) semantics of D20. `'tab'`: every enabled swatch is its own tab stop and the arrow keys do nothing, so the widget is a group of toggle buttons: the root is `role="group"`, each swatch a `<button aria-pressed>` (the selected one pressed), rows are visual only (no role), and Space, Enter and a click select (pressing the selected swatch again keeps it selected). Fluent keeps radio or grid roles in its tab mode. *Why:* `swatchpicker-4`; a radio group or grid whose arrow keys do nothing breaks the keyboard contract screen-reader users rely on (APG radio group: one tab stop; APG grid: one element in the tab sequence), while a toggle-button group is what the widget then is; ROADMAP §8.3 names tab mode as the other model of `swatchpicker-5`.
- **D20 — The grid layout (maintainer ruling).** `layout="grid"` (with `focusMode="arrow"`):
  - **Structure.** `role="grid"` → `SwatchPicker.Row` as `role="row"` → each swatch a `<div role="gridcell" aria-selected>` around its `<button>`; the selected swatch's button is also `aria-pressed`, as DatePicker's selected day is, so the state is announced where focus is. The cell wraps the button because a `gridcell` role on the button would replace its button role and does not allow `aria-pressed`. The button carries `data-selected` (C-CLASS: `className` lands there).
  - **Implicit rows.** `items`, and every run of children that are not `SwatchPicker.Row` elements (found with `isElementOfType`/`flattenChildren` among the direct children and Fragments, Server Component references included), render inside an implicit row, so a gridcell never sits outside a row (axe `aria-required-children`, `aria-required-parent`). Rows do not wrap visually (a wrapped row would put swatches above one another that Up and Down do not reach); the consumer sizes them.
  - **Keys.** The arrow keys move focus only. Left and Right go through the cells in reading order, from row to row (mirrored in RTL), and stop at the grid's first and last cell (APG layout grid: "if focus is on the last cell in the grid, focus does not move"). Up and Down go to the enabled cell of the previous or next row nearest to the same column, skipping rows without an enabled cell, and stop at the first and last row. Home and End go to the first and last enabled cell of the row, Ctrl+Home and Ctrl+End to the first and last enabled cell of the grid. Disabled swatches are skipped (they are natively disabled, D21); an EmptySwatch is a cell like the others. Space and Enter select.
  - **Tab stop.** One element in the tab sequence: the last focused cell (`tabStop: 'last-focused'`), starting at the selected swatch, else the first enabled one, so Tab and Shift+Tab leave the grid from any cell (APG grid).
  - **Required.** `grid` does not allow `aria-required` (axe `aria-allowed-attr`), so the grid layout renders none (a consumer's included) and says "required" through a hidden `labels.required` text joined into its `aria-describedby` (D35's rule). `aria-invalid` is global and stays.
  - The row layout keeps the 0.7 radio group (the arrows select and wrap).
  *Why:* the APG grid pattern; a big palette does not report a change on every step; Fluent's semantics.
- **D21 — Swatch kinds.**
  - `ColorSwatch`: `value` and `color`. Its name is `aria-label` (or `aria-labelledby`, from a Tooltip for example); without either it is named by its colour value and warns once (as 0.7's items without `label`). `disabled` is native (out of the keys and the tab order, never selected), dimmed, with a diagonal slash drawn like the check glyph, so the state does not rely on the swatch colour or its opacity. `icon?: Slot<'span'>` shows while the swatch is not selected (the check replaces it while selected). `borderColor?: string` sets the border colour by hand, as in Fluent. `size` and `shape` override the picker's. It keeps 0.7's forced-colours opt-out (the colour is the content) and adds `forced-colors:focus-visible:outline-[Highlight]` and a Highlight selection ring, which an opted-out element would otherwise draw in author colours.
  - `ImageSwatch`: `value`, `src` (a covering background image), `aria-label` (without it, named by its `value` with a warning), `disabled`, `size`, `shape`. Its check and slash are the theme's foreground glyph over a background halo, because an image has no single luminance. It does not opt out of forced colours (a background image stays).
  - `EmptySwatch`: an "add" button, with no value. Its name is `aria-label`, `'Add color'` by default (built-in text, D36); `size`, `shape`, `icon` (default: the plus glyph; the optional-indicator rule), a dashed `border-stroke-accessible` border with `forcedColors.control`, your `onClick`. In the row layout it is a plain `<button>` in the radio group, outside the arrow order (its own tab stop; axe allows a button in a `radiogroup`), and arrow keys pressed on it are not handled (they would otherwise move to and select a radio); in the grid layout it is a `gridcell` in the arrow order, without `aria-selected`.
  - Both `icon` slots are glyphs inside a wired button (C-SLOTS): decorative (`aria-hidden`), and a `<button>` or `Button` passed there is unwrapped through `unwrapButtonGlyph` with a one-time warning (`ColorSwatch:icon-button`, `EmptySwatch:icon-button`).
  - *Why:* `colorswatch-1`, `colorswatch-2`, `imageswatch-1`, `emptyswatch-1`; the roadmap's "not a radio" for EmptySwatch (Fluent's is a radio that can never be checked, which APG does not allow); a button always has a name (axe `button-name`).
- **D22 — Swatch sizes and spacing.** `SwatchPickerSize` gains `'extra-small'` (20px); `'small'`, `'medium'` and `'large'` stay 24, 32 and 40px (Fluent's four sizes are 20, 24, 28 and 32px). `spacing?: 'small' | 'medium'` is a 4px or (default) 8px gap, between swatches and between rows. A 20px swatch is below the roadmap's 24×24px target and passes WCAG 2.5.8 through its spacing exception (a 4px gap keeps 24px circles centred on two neighbours from intersecting; Understanding 2.5.8 names this case); at `spacing="small"` the focus outline's offset shrinks from 4px to 2px, so it does not cover the neighbour. `shape` keeps its `'circular'` default (Fluent: `'square'`; ROADMAP §8.3). *Why:* principle 2; the target-size bar.
- **D23 — The internal grid roving.** `src/hooks/useRovingGrid.ts` (internal) adds D20's vertical, row and grid-end keys to `useRovingTabIndex`, which keeps the reading-order keys (`orientation: 'horizontal'`, `homeEndKeys: false`, `loop: false`, `tabStop: 'last-focused'`); the rows are the container's `[role="row"]` elements, the cells its `[data-roving-value]` elements. Its key handler ignores events whose target is not inside the container in the DOM (C-COMPOSE: keys typed in a Popover opened from an EmptySwatch bubble through the picker in React). P7-03 folds it into `useRovingTabIndex({ orientation: 'grid' })` and moves SwatchPicker onto that. *Why:* the roadmap ("the internal grid roving, which a later item (P7-03) makes public").
- **D24 — `Calendar` is DatePicker's grid, extracted.** `Calendar.tsx` holds an internal `CalendarView` (the header, the three views, the footer and their keys; module export, not in the barrel) and the public `Calendar`, a `role="group"` root with the value state, forms and Field wiring around a `CalendarView`. DatePicker renders `CalendarView` in its dialog with the 0.7 DOM (the `<h2>` heading, the grid labelled by it, focus, keys) plus the new features; the view remounts on every opening, so each opening shows the selected month again, else today's clamped into `minDate`/`maxDate`, as in 0.7. *Why:* `calendar-1`; one grid; the DatePicker suite is the regression suite (rule 23).
- **D25 — Calendar value.** `value` and `defaultValue` (`Date | null`) and `onValueChange(date, details?)`, fired only on change (a value callback; Fluent's `onSelectDate` fires on every click). WaveUI always passes `details = { range: Date[] }` (D29), also for a form reset (the range of the restored value, or `[]` for `null`); it is typed optional through 0.x and required from 1.0, like every `details` argument. Every emitted date is local midnight. Picking the selected day again does nothing; the value becomes `null` only through the parent or a form reset. A controlled value that moves to another month shows that month. *Why:* C-NAMING; DatePicker's 0.7 value semantics.
- **D26 — Month and year pickers: a drill-down (maintainer ruling).**
  - **Views.** `showMonthPicker` (default `true`) turns the day view's heading into a button that shows the month view: a 3×4 grid of the year's months, whose header arrows move by a year and whose heading is a button to the year view. The year view has 12 cells, a decade plus the year before and the year after it (muted and selectable, like outside days); its header arrows move by ten years and its heading is text (the decade formatted with `Intl.DateTimeFormat#formatRange` in `locale`).
  - **Picks and Escape.** A pick drills back down: a year opens its months, a month its days (the focused day keeps its day of the month, clamped into the month and into `minDate`/`maxDate`). Escape in the year view shows the month view, and in the month view the day view, each showing the period it showed before drilling up (Escape cancels the browsing); it is consumed (`preventDefault()`), so a DatePicker stays open until an Escape in the day view.
  - **Focus.** A view change moves focus into the new grid (the focused month, year or day) in the same commit (a layout effect keyed on the view), since the element that had focus (the heading button that becomes text, a picked cell) disappears with the old view: focus never falls to `<body>`. The heading stays `aria-live="polite"`.
  - **The heading button.** Its name is its visible text (`June 2025`), so the dialog's and the grid's names do not change; its hint (`labels.chooseMonth`, `labels.chooseYear`) is a `hidden` element outside the heading, referenced by the button's `aria-describedby`. The heading button, the month and year cells and the footer buttons set their own padding and background and gate their hover (C-NATIVE; `p-0 bg-transparent`, `not-disabled:not-aria-disabled:hover:bg-subtle-hover`), carry `focusRing`, and are at least 32px tall like the navigation buttons.
  - Months and years wholly outside `minDate`/`maxDate` are `aria-disabled` and reachable, as unavailable days are. No side-by-side panes.
  - It is on by default while the footer buttons are opt-in (D32): the month picker closes a medium gap (`datepicker-1`: the year changes only from the keyboard), the footer buttons are conveniences (low gaps), and the heading button is the only new tab stop.
  *Why:* APG has no month or year grid; one pane fits the DatePicker popup; an inner widget that consumes Escape calls `preventDefault()` (C-POPUPS).
- **D27 — Keys that stay APG.** Day view: PageUp and PageDown go to the previous and next month, Shift+PageUp and Shift+PageDown to the previous and next year, keeping the day of the month (the last day when the month is shorter), as APG's date picker example does (Fluent's compat Calendar reverses the direction and uses Ctrl); Enter and Space select; focus roves on the day buttons (Fluent: `aria-activedescendant` on the table). The grid always shows six weeks (Fluent: four to six, a steady height here). ROADMAP §8.3 records the direction, the modifier and the six weeks. *Why:* principle 5; 0.7 behaviour.
- **D28 — Today and SSR.** `today?: Date` (default: the current date) marks today (`aria-current="date"`, `data-today`), anchors "Go to today" and is a tab-stop candidate. Without it, the server HTML and the hydration render treat today as unknown everywhere: no day is marked, the tab stop is the selected day when it is in the shown month, else the first available day of the month, and "Go to today" renders enabled; the browser applies today after hydration (`useIsClient`). The month shown first is the value's, else `initialVisibleDate`'s, else today's, clamped into `minDate`/`maxDate`; without any of them it comes from the server's clock on the server, the one documented clock dependency: after a hydration render without `today`, `initialVisibleDate` or `value`, a development warning (`Calendar:hydration-date`) asks for one. *Why:* the roadmap's "SSR with `locale`" acceptance; React 19 reports a hydration attribute mismatch and does not patch it.
- **D29 — Range selection.** `selectionRange?: 'day' | 'week' | 'work-week' | 'month'` (default `'day'`) and `workWeekDays?: readonly DayOfWeek[]` (default Monday to Friday, within the week that starts on `firstDayOfWeek`). A pick selects the range around the picked day, without its unavailable days; `value` is the picked day and `details.range` the selected days in order. Every day of the range is `aria-selected` (its cell), `aria-pressed` (its button), `data-selected` and drawn selected; the grid carries no `aria-multiselectable` (one selection, as Fluent). DatePicker does not take `selectionRange` (its input holds one date). *Why:* `datepicker-2`; Fluent's `dateRangeType` with WaveUI names.
- **D30 — Week numbers.** `showWeekNumbers` adds a leading column: each week row starts with `<th scope="row" aria-label={labels.weekNumber(n)}>n</th>` (`Week 23`), under a header cell with an `aria-hidden` `#` and a visually hidden `labels.week` (`Week`), the weekday headers' pattern (an `aria-label` alone on an empty header fails axe's `empty-table-header`); not focusable, skipped by the keys. `firstWeekOfYear?: FirstWeekOfYear` (`'first-day' | 'first-full-week' | 'first-four-day-week'`, default `'first-day'`, the default of Fluent's code; ISO 8601 is `'first-four-day-week'` with `firstDayOfWeek={1}`). *Why:* `datepicker-3`.
- **D31 — Marked days and custom content.** `markedDates(date)` draws a dot under the number in `currentColor` (so it follows the day's text colour when selected, in a range and in forced colours), sets `data-marked` and appends `labels.markedDay` to the day's name (`Monday, June 2, 2025, marked`). `renderDay(date, defaultContent)` replaces the content inside the day button, which keeps its role, state and keys; the button's `aria-label` overrides its content, so `dayLabel?: (date: Date, defaultLabel: string) => string` sets the name (a "3 events" badge is announced only through it), and the content must be non-interactive (axe `nested-interactive`). Fluent: `getMarkedDays(start, end)` and an imperative `customDayCellRef`. *Why:* `datepicker-6`; a render function is React's idiom and cannot break the cell's ARIA; WCAG 1.3.1.
- **D32 — "Go to today" and Close.** `showGoToToday` adds a footer button that shows today's month in the day view and focuses today without selecting it; it is natively `disabled` when today is outside `minDate`/`maxDate` (it never disables itself by its own activation, so C-DISABLED's focusable form is not needed). DatePicker's `showCloseButton` adds a footer "Close" button that closes as Escape does. Both default to `false`. *Why:* `datepicker-4`; opt-in keeps 0.7 popups unchanged.
- **D33 — The public date helpers live in `src/lib/date.ts`.** `addDays`, `addMonths`, `isSameDay`, `startOfWeek` and `getWeekNumber`, server-safe: every module under `src/components` gets a `"use client"` banner, and a Server Component cannot call a client reference. `dateUtils.ts` imports them. All return local-midnight dates (Fluent's keep the time of day). `DayOfWeek` and `FirstWeekOfYear` join `src/lib/types.ts`, and DatePicker's `firstDayOfWeek` is typed `DayOfWeek` (the same union). *Why:* `calendar-2`; React Server Components.
- **D34 — The Calendar heading element.** `CalendarView` renders the month text in an `<h2>` for DatePicker (a dialog title, 0.7) and in a `<div>` for the standalone Calendar (a component cannot know the page's heading levels); both are `aria-live="polite"` and label the grid. *Why:* the 0.7 DatePicker semantics and tests; no wrong heading level in a page.
- **D35 — Calendar forms and Field.** `name`, `form` and `required` render DatePicker's ISO `yyyy-mm-dd` hidden input, which resets with its form (to `defaultValue`). The root `role="group"` takes the Field's label (`aria-labelledby`, `labelable: false`), description and `aria-invalid` (a global attribute, allowed on `group`). `aria-required` is not allowed on `group` or `grid` and is not rendered; the required state is said instead by a hidden `labels.required` text (`Required`) joined into the root's `aria-describedby`, since Field's asterisk is `aria-hidden` and the control's attribute is its only other signal (WCAG 1.3.1, 3.3.2). A required Calendar's `invalid` event focuses the tab stop of the current view. *Why:* C-FORMS; axe `aria-allowed-attr`.
- **D36 — Built-in text.** New strings are members of a `labels` object with English defaults (C-NAMING) and rows of the README "Built-in text" table:
  - `DropdownLabels` and `ComboboxLabels` gain `selection` (`(labels) => labels.join(', ')`), `added` (`(label, count) => \`${label} added, ${count} selected\``) and `removed` (`(label, count) => \`${label} removed, ${count} selected\``), TagPicker's announcements.
  - `ListboxLabels` (new, exported): `added` and `removed` as above.
  - `SwatchPickerLabels` (new, exported): `required` (`'Required'`), used where the root's role cannot carry `aria-required` (the grid layout, tab mode).
  - `CalendarLabels` (new, exported): `previousMonth` (`'Previous month'`), `nextMonth` (`'Next month'`), `previousYear` (`'Previous year'`), `nextYear` (`'Next year'`), `previousDecade` (`'Previous decade'`), `nextDecade` (`'Next decade'`), `chooseMonth` (`'Choose a month'`), `chooseYear` (`'Choose a year'`), `goToToday` (`'Go to today'`), `week` (`'Week'`), `weekNumber` (`(week) => \`Week ${week}\``), `markedDay` (`(dayLabel) => \`${dayLabel}, marked\``), `required` (`'Required'`).
  - `DatePickerLabels` extends `CalendarLabels` (its 0.7 `previousMonth` and `nextMonth` keep their types) and adds `close` (`'Close'`).
  - `EmptySwatch`'s `aria-label` defaults to `'Add color'`.
  *Why:* C-NAMING; the README table.
- **D37 — Bundles.** `Calendar` without DatePicker pulls in no listbox code, and `Listbox` pulls in no calendar code; `verify-dist` gains the two probes (§6.2). The Button-only probe is unchanged. *Why:* principle 6 (tree-shakeable subsystems).
- **D38 — One spelling in the listbox family: `multiselect`.** Dropdown, Combobox and Listbox take Fluent's `multiselect` (the roadmap's P5-01 name), and `useListbox`'s 0.7 option `multiple` is renamed `multiselect` before it becomes public, with `ListboxContextValue.multiselect` and `UseListboxOptionResult.multiselect`; wave A updates TagPicker's call. List keeps its 0.5 `selectionMode` (another widget: items with real focus and actions), and the Listbox JSDoc contrasts the two. *Why:* principle 1 (no new spelling of one concept inside a family); a boolean flag discriminates the D9 signatures; renaming is free while the hook is internal.
- **D39 — `useListbox`'s callbacks carry `details`.** `onOpenChange?: (open: boolean, details?: OpenChangeDetails<ListboxOpenChangeReason>) => void` and `onSelect: (value: string, details?: ListboxSelectDetails) => void` with `ListboxSelectDetails = { item: ListboxItem; event: Event }`, in place of 0.7's positional `reason` and `item`; WaveUI always passes them (every commit and open change comes from a key or a click). `ListboxContextValue.select(value, item, event)` passes the click's event. No 0.7 component reads the second argument. *Why:* C-NAMING (extra data in a second `details` argument), goal 4; principle 2 freezes the shape once public.
- **D40 — `ListboxProvider`, not the raw context.** A `ListboxProvider` component (`value: ListboxContextValue`, `children`) provides a listbox's context to its options, for custom pickers that render their list without `ListboxSurface`; `ListboxContext` stays internal. *Why:* a React context object is component-like with capitalised `Provider` and `Consumer` members, so exporting it would demand flat names (`ListboxContextProvider`) from `verify-dist` and `integration.test.tsx`, and registry constants from P3-00's completeness test; Fluent exports `ListboxProvider` too.
- **D41 — Multi-select toggles are announced.** Dropdown, Combobox and Listbox in multi-select mode announce each toggle made by the user through `useAnnounce` (polite): `labels.added(label, count)` or `labels.removed(label, count)`, `count` being the number of values after the change; a controlled change, a clear and a form reset are not announced. *Why:* screen readers report `aria-selected` changes of an active descendant unevenly (Fluent moved to `menuitemcheckbox` after user testing); TagPicker, WaveUI's multi-select picker, announces every change.
- **D42 — Public names of the listbox pieces.** 0.7's `ListboxOptionProps` (the attributes `useListboxOption` returns for an option element) becomes `ListboxOptionElementProps`, so it is not mistaken for the props of the new `ListboxOption` component (which are `OptionProps`); `ListboxPopup` becomes `UseListboxPopupResult`. `ListboxSurface` gains `listClassName` (merged last onto the list `<ul>`, so `max-h-*` replaces its 0.7 `max-h-60`) and `surfaceClassName` (merged last onto the portaled surface). *Why:* every flat part pairs with `<FlatName>Props`; a custom picker must size its list; both types were internal, so no alias is needed.

### 0.4 Out of scope for 0.10

Everything else in the roadmap. In particular: `size` and `appearance` (P4-01; wave F inherits them, D1) and stable class names (P3-00; wave F applies them); Listbox range selection with Shift+Arrow and Ctrl+A; `aria-checked` in place of `aria-selected` for multi-select options (APG allows it; D2 keeps `aria-selected`); TagPicker parts, free tagging, groups, a button trigger and a clear-all action (`tagpicker-1` … `tagpicker-9`; only its `filter` and `query` are in this phase); virtualization (`combobox-7`); `positioning`, inline popups and per-instance mount nodes (`combobox-5`, `dropdown-5`, `datepicker-9`; P7-01); the swatch `details` argument (Fluent's `selectedSwatch`), `renderSwatchPickerGrid`, a `columnCount` for `items`, swatch `disabledFocusable` and an automatic contrast border; a side-by-side month picker (D26), Fluent's `daysToSelectInDayView`, a `restrictedDates` array (the `disabledDates` predicate covers it), four-to-six-week sizing (D27) and a selection live region; Calendar `disabled`, `readOnly` and a controllable visible month; `onActiveOptionChange` on TagPicker; editable comboboxes clearing the highlight on caret keys, and Fluent's removal of `aria-activedescendant` during caret moves (an NVDA and JAWS workaround; backlog); every TimePicker change (its `useListbox` behaviour must not change); every other backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation (F5-foundation, wave A)

Lands first and alone (§0.2 rule 19). It changes no behaviour of an existing component: `useListbox` is rebuilt without a visible change, and every addition is opt-in. Its 0.7 suite changes only where §6.4 says (the renamed option, the `details` arguments, the error message).

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
   * @default null
   */
  fallback?: string | null;
  /** `next()` and `prev()` wrap at the ends. @default false */
  loop?: boolean;
  /**
   * Whenever `items` changes while the hook is enabled (compared by content), its first item
   * becomes active — also when the change comes with enabling (the keystroke that opens a
   * filtered list). Enabling with unchanged items keeps the fallback. It wins over a move made in
   * the same update. @default false
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
  /**
   * Moves to `value`, or back to the fallback with `null`. The value is kept as it is; the next
   * render drops it when it is not in that render's `items` or the hook is disabled, clearing any
   * earlier move. Scrolled into view unless `scroll` is `false`.
   */
  setActiveValue: (value: string | null, options?: { scroll?: boolean }) => void;
  /** Moves to `value` for pointer movement, not scrolled into view; ignored while disabled, when `value` is not in `items` or is already active. */
  highlight: (value: string) => void;
  first: () => void;
  last: () => void;
  /** The item after the active one (the first when none is active); wraps with `loop`. */
  next: () => void;
  /** The item before the active one (the last when none is active); wraps with `loop`. */
  prev: () => void;
  /** Moves `delta` items (PageDown: `move(10)`), clamped at the ends, never wrapping; from no active item, a positive delta goes to the first item and a negative one to the last. */
  move: (delta: number) => void;
}

export function useActiveDescendant(options: UseActiveDescendantOptions): UseActiveDescendantResult;
```

1. **State and derivation.** One state value, the moved-to item. During render (adjust-during-render, C-HOOKS) it is dropped while `enabled` is `false` or when it is not in `items`, so it does not come back when the item returns; `activeValue` is `enabled ? (moved ?? (fallback in items ? fallback : null)) : null`. These are 0.7 `useListbox`'s rules (its lines 876–907). A value set by a method is stored unconditionally: TimePicker (which must not change) calls `setActiveValue` for the items of the next render (`TimePicker.tsx:651`) and while its list is closed (`:704`), and its tests (`TimePicker.test.tsx:511-531`) rely on the value surviving the update that re-enables the hook with new items.
2. **`activateFirstOnChange`** is 0.7's `highlightOnFilter`: while the option is on (and only then, so a render without it adds no render-phase update: `useListbox.test.tsx` counts renders), the hook tracks `{ enabled, items }` by content in every render, disabled ones included, and moves to `items[0]` when the items changed while enabled or in the render that enables it; it overrides a move made in the same update (0.7 line 896). One difference from 0.7, recorded here because the option becomes public: 0.7 compared the navigable set with its disabled options, the hook compares `items` (the options it can move to), so a disabled option entering or leaving the filtered set no longer moves the highlight to the first item (0.7 did), and an option disabled or enabled while the list is open now does (0.7 kept the highlight). No WaveUI component uses the option. (Corrected during Task A2 from a probe of both implementations.)
3. **Methods.** Stable identities (`useEventCallback`), reading the latest render. `next()`, `prev()` and `move()` start from `activeValue` (the fallback counts, as 0.7's `step()` does). A method called while disabled stores its value, which survives only when the same update enables the hook (0.7's `openWith`: "move, then open" in one event).
4. **Scrolling.** A layout effect keyed on `activeValue` only (reading the latest `getId` and `getElement`) scrolls `getElement(value) ?? document.getElementById(getId(value))` into view (`{ block: 'nearest' }`), except when the value came from `highlight` or from `setActiveValue(value, { scroll: false })`. 0.7 lines 1102–1113.
5. **`onActiveValueChange`.** A passive effect keyed on `activeValue` calls the latest callback when the value differs from the last reported one (initially `null`), so StrictMode's repeated mount effects report once.
6. **Server.** Nothing reads the DOM during render; an enabled hook with a fallback puts the id in the server HTML.

Tests (`src/hooks/__tests__/useActiveDescendant.test.tsx`, through a probe component): the derivation (fallback; a fallback outside `items` ignored; disabled gives `null` and forgets the moved-to item); a moved-to item that leaves `items` is dropped and does not return with it; a value set for the next render's items survives (TimePicker's case), and an invalid one clears an earlier move; `activateFirstOnChange` while enabled, on the enabling render with changed items, not on enabling with the same items, winning over a move in the same update, and no extra render without the option; `next`/`prev` from the fallback and from nothing, `loop`, `move` clamping and from nothing; a move in the same update as enabling survives; `setActiveValue` scrolls, `highlight` and `{ scroll: false }` do not (`scrollIntoView` spy), `getElement` wins over the id lookup; `onActiveValueChange` sequence (open, move, close) and StrictMode once; `renderToString` of an enabled hook with a fallback contains the id; method identities stable across renders.

### 1.2 `src/hooks/useListbox.ts`

1. **Built on `useActiveDescendant`.** `items`: the navigation values (below); `getId`: `getOptionId`; `enabled`: `open`; `fallback`: the `autoHighlight` value (0.7's computation); `loop`; `activateFirstOnChange`: `highlightOnFilter`; `getElement`: the store's element lookup (bound); `onActiveValueChange` passed through. 0.7's `step()`, `activeRaw`, `filterTrack` and the scroll effect are removed. `highlight` keeps 0.7's guards (line 944). Every 0.7 option and key behaves as before.
2. **`multiselect`** (D38): the 0.7 option `multiple` renamed; `ListboxContextValue.multiselect` and `UseListboxOptionResult.multiselect` are new members (D8). Wave A changes TagPicker's call (`multiple: true` → `multiselect: true`, one line).
3. **`details` callbacks** (D39): `onOpenChange?(open, details?)` with `OpenChangeDetails<ListboxOpenChangeReason>` and `onSelect(value, details?)` with `ListboxSelectDetails`, from the key or click event; `ListboxContextValue.select(value, item, event)`.
4. **`disabledOptionsFocusable?: boolean`** (default `false`, D6). The navigation values are the navigable items (not hidden, not filtered out) with the disabled ones, instead of the enabled ones; typeahead receives them as enabled; the `autoHighlight` fallback may be a disabled option. `commit` still ignores a disabled item (a click, Enter and Space do nothing and keep the list open), and Tab and Alt+ArrowUp in single-select select-only mode commit only an enabled active option, else close (`onOpenChange(false, { reason: 'tab' | 'keyboard', event })`).
5. **`onActiveValueChange?: (value: string | null) => void`** (D14).
6. **`mode: 'standalone'`** (D5). `UseListboxOptions.mode` becomes `'editable' | 'select-only' | 'standalone'`; `typeahead` defaults to `mode !== 'editable'` (0.7: `mode === 'select-only'`, the same for the two 0.7 modes). In standalone mode: ArrowDown and ArrowUp move (from nothing: the first or last option), Home and End go to the first and last, PageUp and PageDown move ten, typeahead moves (Space continues a search typed within 500 ms, as in select-only mode); Enter and Space commit the active option (`onSelect`), keep it active and never call `onOpenChange`; Tab, Escape and Alt+Arrow return before any `preventDefault()`. `getListboxProps()` returns `tabIndex: 0`, `aria-activedescendant` and a `ref`, and no `onMouseDown`; `useListboxOption` adds the pointer-press `onMouseDown` of D17 to its option props (the context's `press(value)`). `getComboboxProps()` is not used in this mode (its JSDoc says so).
7. **Types.** `onOpenChange` becomes optional. `ListboxListProps` changes to `tabIndex: 0 | -1`, `onMouseDown?` (absent in standalone mode), and `'aria-activedescendant'?: string` and `ref?` (standalone mode only). `ListboxContextValue` gains `multiselect`, `mode` and `press(value)`; `UseListboxOptionResult` gains `multiselect`. `ListboxOptionProps` becomes `ListboxOptionElementProps` (D42). These types were internal until now, so nothing narrows for a consumer; the CHANGELOG lists them under "Types" anyway.
8. **Public JSDoc.** Every exported symbol of the module gets consumer-facing JSDoc (C-DOCS, rule 26): the hook's own docblock keeps its behaviour list and "Consumer contract", loses the internal spec references ("spec §2.5", "input-pickers#…") and documents that `highlightOnFilter` sets `activateFirstOnChange` and that its `filter(item)` is the navigability predicate a component builds from its query.
9. **The missing-context message** names every root: `reportMissingContext(componentName, 'a listbox (Listbox, Combobox, Dropdown or a ListboxProvider)')`. Three assertions change (§6.4).

Tests (added to `useListbox.test.tsx`): the `details` arguments (reason and event for each open change; item and event for each commit); `disabledOptionsFocusable` on each path (arrows, Home/End, PageUp/PageDown, typeahead, the fallback; Enter, Space and a click on a disabled active option keep the list open and commit nothing; Tab and Alt+ArrowUp close without committing), with the 0.7 default unchanged; standalone mode (its keys, commits in single and multi-select mode, the committed option stays active, `onOpenChange` never called, Tab and Escape not prevented, the listbox props, the pointer press activating the pressed option without scrolling); `onActiveValueChange` (open, arrows, hover, filter, close; StrictMode once); `multiselect` in the context and the option result.

### 1.3 `src/components/input/Option.tsx`

1. **`checkIcon?: Slot<'span'>`** on `OptionProps` (D7). The default renders 0.7's `<CheckIcon>` with its 0.7 classes; a consumer glyph renders through `renderSlot(checkIcon, 'span', <0.7 classes>, { 'aria-hidden': true })`; a value that renders nothing (`slotRendersContent`) renders the default and warns once from an effect: `Option:checkIcon-empty`, "Option: `checkIcon` renders nothing, so the default check shows: a selected option must show its state. Pass a glyph, or leave it unset.". The column stays in every option while `showCheck` is on (0.7: the glyph is `invisible` while not selected).
2. **The multi-select box** (D8): while `multiselect` and `showCheck`, the check column is a 16px box `<span aria-hidden="true" data-wave-option-box>` with the glyph inside (visible only while selected), and the option drops `forcedColors.selectedContainer`.
3. **`OptionGroup`** (D16): `label?: React.ReactNode`; the heading `<div>` renders only with a label; `aria-label` and `aria-labelledby` from the props go to the `<ul role="group">` (the other rest props stay on the `<li role="presentation">`, as in 0.7), a defined one winning over the heading's `aria-labelledby`; an unnamed group warns once from an effect (`OptionGroup:unnamed`).
4. **`ListboxProvider`** (new, D40): `export interface ListboxProviderProps { value: ListboxContextValue; children?: React.ReactNode }`; `ListboxProvider` renders the context provider, with a `displayName` and consumer JSDoc.
5. **`ListboxSurface` and `useListboxPopup`** become public (D4) with consumer-facing JSDoc; their 0.7 behaviour does not change. `ListboxSurface` gains `listClassName` and `surfaceClassName` (D42); `ListboxSurfaceProps` documents `showCheck`, `emptyContent` and the single-container rule; `UseListboxPopupOptions.onDismiss` keeps `(reason: DismissReason)`; `ListboxPopup` becomes `UseListboxPopupResult`.
6. **The `Option` docblock** names its hosts: Listbox, Combobox, Dropdown, and custom pickers through `ListboxSurface` or a `ListboxProvider`. `OptionImpl` and `OptionGroupImpl` keep their names (rule 20).

Tests (added to `Option.test.tsx`): `checkIcon` replaces the glyph (selected and not), `null` and `undefined` keep the 0.7 `<svg>` and its classes, `false`, `''` and `[]` keep it and warn once (asserted); the multi-select box under a context with `multiselect` (unchecked and checked classes, `aria-hidden`, the glyph only while selected, no Highlight outline), and none with `showCheck` off; a group with a `ReactNode` label is labelled by its heading, a consumer `aria-label` wins over it and an `undefined` one does not, a group without a label routes `aria-label` to `role="group"` and has no heading element; an unnamed group and an icon-only label warn once; `ListboxProvider` provides options outside `ListboxSurface`; `listClassName` replaces the list's maximum height; a minimal custom picker (an inline component on `useListbox`, `useListboxPopup` and `ListboxSurface`) opens, positions, closes on an outside press and on Escape, and hands Escape to an enclosing layer while it shows nothing (0.7's overlays#1).

### 1.4 `src/hooks/useTypeahead.ts`

No change: `useListbox` passes the disabled flag it wants typeahead to see (§1.2.4). Listed so no package edits it.

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

### 1.6 Entry exports and the tests that pin them (wave A exclusive, rule 19)

- `src/index.ts`, under "Hooks": `useActiveDescendant` with `UseActiveDescendantOptions` and `UseActiveDescendantResult`; `useListbox`, `useListboxOption`, `collectOptionLabels`, `markListboxElement` with `ListboxItem`, `ListboxOpenChangeReason`, `ListboxSelectDetails`, `UseListboxOptions`, `UseListboxResult`, `ListboxComboboxProps`, `ListboxListProps`, `ListboxStore`, `ListboxContextValue`, `UseListboxOptionProps`, `ListboxOptionElementProps`, `UseListboxOptionResult` and `ListboxElementKind`; under "Utilities": the type `DismissReason` from `./lib/layers` (its JSDoc reworded for consumers: "Why a popup layer is dismissed"). `ListboxContext` is not exported (D40).
- `src/components/input/index.ts`: `ListboxProvider`, `ListboxProviderProps`, `ListboxSurface`, `ListboxSurfaceProps`, `useListboxPopup`, `UseListboxPopupOptions`, `UseListboxPopupResult` (from `./Option`).
- `src/__tests__/public-types.test.ts`: the new names in its import list and `expectTypeOf` lines (`UseActiveDescendantResult['activeDescendantId']` is `string | undefined`; `UseListboxOptions['mode']` includes `'standalone'`; `ListboxListProps['tabIndex']` is `0 | -1`; `DismissReason` is `'escape' | 'outside-press' | 'focus-outside'`); its walker then finds every named type of the new public signatures exported.
- `src/__tests__/integration.test.tsx`: the "keeps internal helpers out of the public API" list loses `useListbox`, `collectOptionLabels`, `markListboxElement`, `useListboxPopup` and `ListboxSurface` and gains `ListboxContext`.

### 1.7 `scripts/verify-dist.mjs` and its test

`PENDING_FLAT_EXPORTS = ['SwatchPicker']` (rule 21: `SwatchPicker` is exported and gains its `Row` member in wave B, before INTEGRATION exports `SwatchPickerRow`; `checkFlatExports` reports it as planned in wave A and pending in wave B, neither an error). `scripts/__tests__/verify-dist.test.mjs`'s bridge case (lines 1082–1093) changes with it: it asserts no errors on the real exports and `SwatchPicker` planned or pending; INTEGRATION restores the empty-bridge assertion (§4.3).

### 1.8 `src/styles/__tests__/tokens.test.ts`

New `CONTRAST_PAIRS` for the multi-select box (D8), 3:1 non-text in all three themes: `stroke-accessible` on `subtle-hover` and on `subtle-selected` (the unchecked box on the active and the selected row), `primary` on `subtle-selected` (the checked box on a selected row). If a pair fails in a theme, stop and file a change request (the box's colours change, not the pair).

### 1.9 Exit criteria of wave A

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (every 0.7 picker test passes: Dropdown, Combobox, TagPicker, TimePicker, List, and `useListbox` with only the §6.4 edits; `integration.test.tsx` and `verify-dist.test.mjs` with §1.6 and §1.7), `npm run build`, `node scripts/verify-dist.mjs` (with the bridge) and `npm run build-storybook` pass; the conventions gate is clean for the foundation's files. The lead commits the package before wave B starts.

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
   * checkbox, Enter, Space and a click toggle an option and keep the list open, and each toggle is
   * announced. A non-literal `multiselect={flag}` is a type error: render two elements.
   * @default false
   */
  multiselect?: M;
  /** Controlled value: the selected option's value (`''` for none), or with `multiselect` the selected values (Fluent's `selectedOptions`). */
  value?: M extends true ? readonly string[] : string;
  /** @default '' (`[]` with `multiselect`) */
  defaultValue?: M extends true ? readonly string[] : string;
  /** Called with the new value when it changes (a new array with `multiselect`). */
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  // … 0.7 props, `labels` with the D36 members, and P5-02/P5-03 below
}

/** The Dropdown component's type: a multi-select signature, then the single-select one. */
export interface DropdownComponent {
  (props: DropdownProps<true> & { multiselect: true }): React.ReactNode;
  (props: DropdownProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}
// ComboboxProps<M> and ComboboxComponent likewise; ComboboxProps<true> has no `freeform`.
```

- **Roots.** `DropdownRoot(props: DropdownProps<boolean>)`, exported as `Object.assign(DropdownRoot, { Option, OptionGroup }) as DropdownComponent` (D9). Inside, the value is normalised to `readonly string[]` for `useListbox` (`multiselect`, `selectedValues`). `DropdownComponent` and `ComboboxComponent` are exported types (they appear in a public signature).
- **Dropdown with `multiselect`** (D10): the button text, `clearable`, forms, reset and the deprecated `onOptionSelect` as D10 says; each toggle announced (D41). The value array is compared by content where 0.7 compares strings (the reset, the clear button's visibility: `value.length > 0`).
- **Combobox with `multiselect`** (D11, D10, D41): the input shows `draft ?? labels.selection(selectedLabels)`, with no `placeholder` while a value is selected; the focus selection, the inserted-text query and the undo rule of D11; a commit through Enter or a click clears the query (the labels show again) and keeps the list open; the `autoHighlight` rule of 0.7 applies (`'first'` while a query filters, else none). `readOnly` shows the labels and edits nothing. `clearable` clears every value, drops the query, closes the list and focuses the input (0.7's clear, with `[]`).
- **Unknown values** (no option has them) are left out of the displayed text and still submitted, as in 0.7 (a single unknown value shows no text).

Tests (in `Dropdown.test.tsx` and `Combobox.test.tsx`):
- Dropdown: toggling with Enter, Space and a click keeps the list open, `aria-multiselectable`, `aria-selected` per option and the box; each toggle announced (`added`, `removed`, counts; not for a clear, a reset or a controlled change); Tab, Escape and Alt+ArrowUp close without committing; the button text in selection order through `labels.selection`, the placeholder for `[]`; `clearable` clears all and focuses the button; a form submits one entry per value (`FormData.getAll`), `required` blocks an empty submit and focuses the button, a reset restores `defaultValue` and reports nothing when unchanged; the deprecated `onOptionSelect` fires per toggle; StrictMode: one `onValueChange` per toggle; controlled with a parent that ignores the callback (separate tasks).
- Combobox: the labels in the input and no placeholder while values are selected; Tab and a click into the input select its whole text; typing, `user.paste`, Backspace, Delete, cut and a composition (`compositionstart`/`compositionend` with its `input`) over the selected labels start a query without changing the value; an `input` event that inserts text into the middle of the labels (a drop) queries only the inserted text; a value equal to the labels shows them again; a toggle clears the query and keeps the list open; blur and close show the labels again; announcements as Dropdown; `clearable`; forms and reset as Dropdown; `readOnly`; "No matches" still announced once per query; StrictMode once.
- Types (`expectTypeOf`, `// @ts-expect-error`, checked by `tsconfig.dev.json`): `<Dropdown multiselect onValueChange={(v) => …} />` types `v` as `string[]`; `<Dropdown value="a" onValueChange={(v) => …} />` types it as `string`; `React.ComponentProps<typeof Dropdown>` equals `DropdownProps`; `<Dropdown multiselect value="a" />`, `<Dropdown multiselect={flag} />` and `<Combobox multiselect freeform />` are errors; `interface X extends DropdownProps {}` compiles.

Stories: "Multiselect" for Dropdown and Combobox (in a Field, with `clearable`); a story `render` typed for the multi-select signature (`StoryObj<DropdownProps<true>>`).

### P5-02 — Custom filtering, a controllable query and `onActiveOptionChange` (P5-pickers)

**Closes:** `filter-1` (M), `filter-2` (M), `combobox-6` (L), `dropdown-6` (L). **Guards:** Combobox and TagPicker filter as you type and announce "No matches" by default (the 0.7 tests stay green).

```ts
// ComboboxProps<M> and TagPickerProps
/**
 * Whether an option matches the typed text (the query, or a freeform Combobox's text). Called for
 * every option that is not hidden while the text is non-empty; it may keep options that do not
 * contain the text.
 * @default a case-insensitive substring match on the option's `textValue`, else its `label`
 */
filter?: (option: ListboxItem, query: string) => boolean;
/** Controlled typed text (the query that filters). Combobox: not used with `freeform`. */
query?: string;
/** @default '' */
defaultQuery?: string;
/** Called with the new query when it changes, `''` when it resets (a commit, a close, a blur, Escape, …). Combobox: never called with `freeform`. */
onQueryChange?: (query: string) => void;

// DropdownProps<M> and ComboboxProps<M>
/** Called after the active (highlighted) option changes — arrow keys, typeahead, the pointer, a filter change, opening — and with `null` when the list closes. */
onActiveOptionChange?: (value: string | null) => void;
```

- **Combobox.** 0.7's `draft: string | null` becomes `[query, setQuery] = useControllable(queryProp, defaultQuery ?? '', onQueryChange)` plus an `editing` flag; `draft = editing || query !== '' ? query : null`. Every 0.7 `setDraft(null)` in an event handler becomes "stop editing and set `''`", every `setDraft(text)` "edit and set `text`"; the lock reset of 0.7 (an adjust-during-render update, `Combobox.tsx:245-249`) becomes a render-time mask plus an effect that stops editing and reports `''` (D12). With `freeform` the query state is unused (0.7's draft follows the text) and a `query` or `defaultQuery` prop warns once from an effect (`Combobox:query-freeform`).
- **TagPicker.** `useState('')` becomes `useControllable(queryProp, defaultQuery ?? '', onQueryChange)`; its 0.7 resets stay where they are, and its lock reset (`TagPicker.tsx:328-332`) follows Combobox's.
- **The filter** is adapted for `useListbox` on the effective text (the query, or the freeform text): `text ? (item) => (filter ?? defaultFilter)(item, text) : undefined`, memoised on the text and the prop. `defaultFilter` is the 0.7 `matchesText` (module-private in each component).
- **`onActiveOptionChange`** is `useListbox`'s `onActiveValueChange` (D14).

Tests: a custom filter (prefix match) changes the list and "No matches"; `filter={() => true}` shows every option for any query; a filter that always keeps a synthetic "Create" option shows it for any query (issue #6's case); the filter receives `ListboxItem`s (with `textValue`), never hidden options, and applies to freeform text; the controlled query: shown, filters, `onQueryChange` on typing and on each reset path (commit, close, blur, Escape, clear, form reset), a parent that keeps a non-empty query after a close keeps it shown; locking while typing with a controlled query reports `''` once and logs nothing; uncontrolled `defaultQuery`; `''` after erasing keeps the input empty while editing; the freeform warning (asserted) and no `onQueryChange` with freeform; TagPicker's query resets (tag added, Escape, reset, lock) and no reset on blur (0.7); `onActiveOptionChange` on arrows, typeahead (Dropdown), hover, filtering, opening and `null` on close, StrictMode once. An async-search case: `filter={() => true}`, options replaced after a fake-timer delay, the first new option active while typing (0.7's rule), "No matches" only for an empty result.

Stories: "Custom filter" (prefix and accent-insensitive: `label.normalize('NFD').replace(/\p{Diacritic}/gu, '')`), "Async search" (a debounced fake fetch with `filter={() => true}` that keeps the previous results while loading, so "No matches" is not announced before they arrive), "Active option preview" (`onActiveOptionChange`).

### P5-03 — Public listbox primitives, a standalone Listbox, and the Option and Dropdown parts

**Closes:** `listbox-2` (M), `listbox-1` (L), `dropdown-4` (L), `option-1` (L), `option-2` (L), `option-3` (L). **Guards:** hidden inputs and form reset on every picker; Combobox and TagPicker filtering and "No matches".

Owners: `F5-foundation` (the primitives, `Option`, `OptionGroup`, `ListboxProvider`, §1); `P5-pickers` (Dropdown `expandIcon`, `renderValue`, `disabledOptionsFocusable`; Combobox `disabledOptionsFocusable`); `P5-listbox` (the Listbox).

**Dropdown and Combobox parts (P5-pickers).**

```ts
// DropdownProps<M>
/** The glyph at the end of the button (default: a chevron). `null` or `undefined` keep it; `false`, or a value that renders nothing, hides it. Decorative: a `<button>` passed here is unwrapped. */
expandIcon?: Slot<'span'>;
/**
 * Renders the button's content while a value is selected (the placeholder shows otherwise). The
 * content must be non-interactive; its text is the combobox's value.
 * @default the selected label (`labels.selection` with `multiselect`)
 */
renderValue?: M extends true ? (value: string[]) => React.ReactNode : (value: string) => React.ReactNode;
// DropdownProps<M> and ComboboxProps<M>
/** Keeps disabled options in the arrow-key and typeahead order (they still cannot be selected). @default false */
disabledOptionsFocusable?: boolean;
```

- `expandIcon` reuses `showsExpandButton` for the optional-indicator rule and `unwrapButtonGlyph` for buttons (D15); the glyph keeps 0.7's rotation classes and `aria-hidden`. Tests: default (0.7 `<svg>` and classes, `Dropdown.test.tsx:1133-1135` unchanged), custom glyph, `null`, `false` (end padding and clear offset), `''`, a `<button>` (unwrapped, warned), rotation while expanded.
- `renderValue`: called with the value (a copy with `multiselect`) while one is selected; not called for `''`/`[]`. Tests: rich content in the button, its text is the combobox's value text, the placeholder when empty, multi-select arrays.
- `disabledOptionsFocusable`: passed to `useListbox`. Tests: a disabled option is reached by the arrows and typeahead, Enter on it commits nothing and keeps the list open.

**The standalone Listbox (P5-listbox, `src/components/input/Listbox.tsx`).**

```ts
export interface ListboxLabels {
  /** @default (label, count) => `${label} added, ${count} selected` */
  added?: (label: string, count: number) => string;
  /** @default (label, count) => `${label} removed, ${count} selected` */
  removed?: (label: string, count: number) => string;
}

export interface ListboxProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLUListElement>,
  'onChange' | 'defaultValue'
> {
  /** Several options can be selected (Fluent's `multiselect`; List's `selectionMode="multiple"` is the other widget); Space and Enter toggle an option. @default false */
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
  /** The multi-select announcements, for localization. */
  labels?: ListboxLabels;
  name?: string;
  form?: string;
  required?: boolean;
  ref?: React.Ref<HTMLUListElement>;
}

export interface ListboxComponent {
  (props: ListboxProps<true> & { multiselect: true }): React.ReactNode;
  (props: ListboxProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}

export const Listbox = /* @__PURE__ */ Object.assign(ListboxRoot, { Option, OptionGroup }) as ListboxComponent;
/** Flat name of `Listbox.Option` for React Server Components. */
export const ListboxOption = Option;
/** Flat name of `Listbox.OptionGroup` for React Server Components. */
export const ListboxOptionGroup = OptionGroup;
```

- **Behaviour:** D17 and D41, on `useListbox({ mode: 'standalone', open: focused && !disabled, multiselect, selectedValues, onSelect, disabledOptionsFocusable, onActiveValueChange })`.
- **The `<ul>`:** consumer props first (`{...rest}`), then `getListboxProps()` and the attributes that must win (`role`, `tabIndex`, `aria-activedescendant`, `aria-multiselectable`, `ref` merged); its `id` is the consumer's (or the Field's control id), else the hook's `listboxId` (option ids keep the hook's prefix). The Field wiring comes from `useFieldControl(…, { labelable: false })`: labelled by the Field's label, described by its message and hint, `aria-invalid` and `aria-required` (both allowed on `listbox`). It composes `listbox.onKeyDown` and `onKeyUp` with the consumer's, tracks focus with composed `onFocus`/`onBlur` (ignoring focus events from outside its DOM, C-COMPOSE), provides the context through `ListboxProvider`, draws `focusRing` while it has focus and no active option, and renders `HiddenInput` (single: `type="text"`; multi-select: one entry per value; `required`; `onInvalid` focuses the list) inside itself, with `relative` for its required input. `disabled`: `aria-disabled`, `data-disabled`, no `tabIndex`, commits ignored, the hidden input disabled.
- **Naming:** an unnamed Listbox (no `aria-label`, `aria-labelledby` or Field label) warns once (`Listbox:unnamed`).
- **Docs:** the component docblock says when to use List `selectable` (real focus on each item, item actions, rich rows) and when Listbox (the picker option model: active descendant, typeahead, groups).

Tests (`__tests__/Listbox.test.tsx`): `testSystemProps` (ref on the `<ul>`, rest spread, `className` merging, `displayName`, axe); `testCompoundExposure` (`ListboxOption === Listbox.Option`, `ListboxOptionGroup === Listbox.OptionGroup`); the focus model (no active option before focus; the selected, else the first, on focus; `null` on blur; the ring on an empty, all-hidden and all-disabled list); the pointer press (the pressed option becomes active without `scrollIntoView` and the click selects it, with the selected option out of view: `mockRect` and a scroll spy); keys (arrows without wrap, Home/End, PageUp/PageDown, typeahead, Space and Enter select in single mode and toggle in multi-select mode, re-selecting changes nothing; Tab and Escape not prevented); selection does not follow focus; announcements (D41); `disabled` (no `tabIndex`, a click does not focus it); `disabledOptionsFocusable`; groups (a label and a label-less group); forms (the value kinds, `required` blocks submit and focuses the list, reset); `renderWithFieldContext` (label, description, invalid, required); `onValueChange` and `onActiveOptionChange` once in StrictMode; RTL (no horizontal keys, nothing mirrors); `renderToString` (no `aria-activedescendant` before focus) and hydration without warnings; the unnamed warning (asserted); the type tests of D9.

Stories (`stories/Listbox.stories.tsx`, title `Components/Input/Listbox`): Default, Multiselect, Groups, Disabled options (skipped and focusable), In a Field, "Custom picker" (the P5-03 acceptance story: a font picker built only on the package entry's `useListbox`, `useListboxPopup`, `ListboxSurface` and `Option`), "Command palette" (a text input driving `useActiveDescendant` over a filtered list, without `useListbox`).

### P5-04 — SwatchPicker children, grid layout, focus modes and swatch kinds (P5-swatches)

**Closes:** `swatchpicker-1` (M), `swatchpicker-2` (L), `swatchpicker-3` (L), `swatchpicker-4` (L), `colorswatch-1` (L), `colorswatch-2` (L), `imageswatch-1` (L), `emptyswatch-1` (L). **Guards:** the hidden input and form reset of SwatchPicker (0.7 tests unchanged apart from §6.4); ColorPicker's presets (a SwatchPicker with `items`; `ColorPicker.test.tsx` stays green without an edit).

```ts
export type SwatchPickerSize = Extract<Size, 'extra-small' | 'small' | 'medium' | 'large'>;

export interface SwatchPickerLabels {
  /** Said where the picker's role cannot carry `aria-required` (the grid layout, tab mode). @default 'Required' */
  required?: string;
}

export interface SwatchPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Swatches rendered as `ColorSwatch`es before `children` (optional since 0.10). */
  items?: readonly SwatchItem[];
  /** `'row'`: a radio group whose arrow keys select. `'grid'`: rows of cells (`SwatchPicker.Row`) whose arrow keys move focus in two dimensions; Space and Enter select. @default 'row' */
  layout?: 'row' | 'grid';
  /** `'arrow'`: one tab stop and arrow keys. `'tab'`: every swatch is a tab stop in a group of toggle buttons, and the arrow keys do nothing. @default 'arrow' */
  focusMode?: 'arrow' | 'tab';
  /** Gap between swatches and between rows: 4px or 8px. @default 'medium' */
  spacing?: 'small' | 'medium';
  /** @default 'medium' (20, 24, 32 or 40px) */
  size?: SwatchPickerSize;
  labels?: SwatchPickerLabels;
  // … 0.7: value, defaultValue, onValueChange, onChange (deprecated), shape, name, required, form, ref
}

export interface SwatchPickerRowProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

export interface ColorSwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'color'> {
  value: string;
  /** CSS colour of the swatch (a runtime user colour). */
  color: string;
  /** Decorative glyph shown while the swatch is not selected. */
  icon?: Slot<'span'>;
  /** CSS colour of the swatch's border, for a colour close to the page background. */
  borderColor?: string;
  /** @default the picker's */
  size?: SwatchPickerSize;
  /** @default the picker's */
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}

export interface ImageSwatchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  /** URL of the image (drawn as a covering background image). */
  src: string;
  /** @default the picker's */
  size?: SwatchPickerSize;
  /** @default the picker's */
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}

export interface EmptySwatchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** @default 'Add color' */
  'aria-label'?: string;
  /** Decorative glyph. @default a plus glyph */
  icon?: Slot<'span'>;
  /** @default the picker's */
  size?: SwatchPickerSize;
  /** @default the picker's */
  shape?: Shape;
  ref?: React.Ref<HTMLButtonElement>;
}
```

- **Modules.** `SwatchPicker.tsx` (root, `SwatchPicker.Row`, `items`, implicit rows, the context provider); `SwatchPicker.context.ts` (the context, its hook with `reportMissingContext`, the value registry for duplicate warnings); `SwatchPicker.swatches.tsx` (`ColorSwatch`, `ImageSwatch`, `EmptySwatch`, their shared button, the check and slash glyphs); `src/hooks/useRovingGrid.ts` (D23). The check glyph is 0.7's `SwatchCheck` (luminance-picked over a halo, `getCheckColors`); the slash is an inline SVG line drawn the same way, not a new `lib/icons` export.
- **Root.** `role="radiogroup"` (row layout, arrow mode), `role="grid"` (grid layout, arrow mode) or `role="group"` (tab mode); it renders `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing` before `{...rest}` (enumerated, always rendered, C-CLASS); `aria-required` only on `radiogroup` (D20, D35: elsewhere the `labels.required` hint); `HiddenInput` stays inside it (0.7). `SwatchPicker.Row` is `role="row"` in the grid layout and a full-width line without a role in the row layout and in tab mode.
- **Swatch.** Row layout: `<button type="button" role="radio" aria-checked data-roving-value data-selected …>` (0.7). Grid layout: `<div role="gridcell" aria-selected><button type="button" aria-pressed={selected || undefined} data-roving-value data-selected …></div>`. Tab mode: `<button type="button" aria-pressed={selected} data-selected …>`. The button carries `ref`, `className`, `style` merged with the swatch's colour, the name and every rest prop in every layout (D18); the cell only `role` and `aria-selected`. A click selects through the context (C-COMPOSE: the consumer's `onClick` first). The focus outline's offset is 4px, 2px at `spacing="small"` (D22).
- **Keys.** Row + arrow: 0.7's `useRovingTabIndex` (`orientation: 'both'`, selecting on focus move), with arrow keys that start on an EmptySwatch ignored. Grid + arrow: `useRovingGrid` (D20, D23), selecting nothing on focus move. Tab mode: no key handler; every enabled swatch has `tabIndex={0}`. Swatches read their `tabIndex` from the context.
- **Warnings.** Duplicate values warn once per value (`SwatchPicker:duplicate-value:<value>`); `items` without `label` keep 0.7's warning (`SwatchPicker:item-label`, exactly one, `SwatchPicker.test.tsx:364-387`) and render their `ColorSwatch` with the colour as its `aria-label`, so the swatch's own warning does not fire; a `ColorSwatch` or `ImageSwatch` without a name warns once per kind (`ColorSwatch:unnamed`, `ImageSwatch:unnamed`).

Tests (`SwatchPicker.test.tsx`, which keeps its 0.7 cases apart from §6.4, and the new `SwatchPicker.swatches.test.tsx` and `src/hooks/__tests__/useRovingGrid.test.tsx`): children and `items` together (order, one radio group); `testCompoundExposure` (`SwatchPickerRow === SwatchPicker.Row`); a Tooltip (0.7 component) around a `ColorSwatch` names and describes the button in every layout; grid ARIA (grid, rows, cells, `aria-selected`, `aria-pressed`, implicit rows for `items` and loose children, among them D18's `items` plus EmptySwatch example) and axe in both layouts and tab mode, open and selected states, with `required` and inside a required Field (`renderWithFieldContext`: the hint, no `aria-required`); grid keys (reading order across rows, stopping at the grid's ends, Up/Down to the nearest enabled cell of the column, skipping rows without one, Home/End, Ctrl+Home/End, disabled cells skipped) and the same in RTL; the grid's tab stop follows focus (Tab and Shift+Tab leave from an unselected swatch); Space and Enter select in the grid, arrows do not; a Popover opened from an EmptySwatch keeps its arrow keys (`useRovingGrid` ignores them); tab mode in both layouts (`role="group"`, `aria-pressed`, every enabled swatch tabbable, arrows inert); disabled swatches (skipped, not selectable, the slash); `icon` (decorative, a button unwrapped and warned) and the check; `borderColor`; per-swatch `size` and `shape`; `ImageSwatch`'s background, check and fallback name; `EmptySwatch` in both layouts (its default name; out of the radio group's arrows, arrows pressed on it ignored; in the grid's arrows; its `onClick`); forced-colours classes of each kind; a swatch outside a picker throws (`expectThrows`) and renders inert in production (`vi.stubEnv`); duplicate and unnamed warnings (asserted); forms and reset in every layout; `testSystemProps` for each swatch kind and for `SwatchPicker.Row`.

Stories: "Swatch children with tooltips", "Grid layout", "Tab focus mode", "Swatch kinds" (image, empty, disabled, icon, border, per-swatch size and shape), "Sizes and spacing"; the 0.7 stories keep working.

### P5-05 — Calendar, month and year pickers, week numbers, marked days, ranges and date helpers (P5-calendar)

**Closes:** `calendar-1` (M), `datepicker-1` (M), `calendar-2` (L), `datepicker-2` (L), `datepicker-3` (L), `datepicker-4` (L), `datepicker-5` (L), `datepicker-6` (L). **Guards:** first-class DatePicker (keep-and-flag, hidden input, form reset): its 0.7 suite passes with only the §6.4 updates.

```ts
export interface CalendarLabels {
  /** @default 'Previous month' */ previousMonth?: string;
  /** @default 'Next month' */ nextMonth?: string;
  /** @default 'Previous year' */ previousYear?: string;
  /** @default 'Next year' */ nextYear?: string;
  /** @default 'Previous decade' */ previousDecade?: string;
  /** @default 'Next decade' */ nextDecade?: string;
  /** @default 'Choose a month' */ chooseMonth?: string;
  /** @default 'Choose a year' */ chooseYear?: string;
  /** @default 'Go to today' */ goToToday?: string;
  /** @default 'Week' */ week?: string;
  /** @default (week) => `Week ${week}` */ weekNumber?: (week: number) => string;
  /** @default (dayLabel) => `${dayLabel}, marked` */ markedDay?: (dayLabel: string) => string;
  /** @default 'Required' */ required?: string;
}

/** Second argument of `Calendar`'s `onValueChange`. */
export interface CalendarValueChangeDetails {
  /** The selected days in order (local midnight): the picked day, or its week, work week or month (`selectionRange`); `[]` for `null`. */
  range: Date[];
}

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: Date | null;
  /** @default null */
  defaultValue?: Date | null;
  /** Called with the new day when it changes (Fluent's `onSelectDate`, which fires on every pick). WaveUI always passes `details`. */
  onValueChange?: (date: Date | null, details?: CalendarValueChangeDetails) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: (date: Date) => boolean;
  /** @default 0 */
  firstDayOfWeek?: DayOfWeek;
  /** @default the runtime default locale (pass it when rendering on the server) */
  locale?: string;
  /** @default the current date (applied after hydration when not passed) */
  today?: Date;
  /** The month shown first when there is no value (Fluent's `initialPickerDate`). @default today's month */
  initialVisibleDate?: Date;
  /** The heading drills into month and year views (Fluent's `isMonthPickerVisible`). @default true */
  showMonthPicker?: boolean;
  /** @default false */
  showWeekNumbers?: boolean;
  /** @default 'first-day' */
  firstWeekOfYear?: FirstWeekOfYear;
  /** @default false */
  showGoToToday?: boolean;
  /** Days that draw a dot and say "marked" (Fluent's `getMarkedDays`). */
  markedDates?: (date: Date) => boolean;
  /** Replaces the content of a day button; must be non-interactive, and mirrored in `dayLabel`. */
  renderDay?: (date: Date, defaultContent: React.ReactNode) => React.ReactNode;
  /** The accessible name of a day. @default the date in words (`Monday, June 2, 2025`), with `labels.markedDay` for a marked day */
  dayLabel?: (date: Date, defaultLabel: string) => string;
  /** Selects the day, or its week, work week or month (Fluent's `dateRangeType`). @default 'day' */
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
// firstWeekOfYear, showGoToToday, markedDates, renderDay, dayLabel (forwarded to the calendar), and
/** Adds a Close button to the calendar's footer; it closes the calendar as Escape does. @default false */
showCloseButton?: boolean;
// firstDayOfWeek?: DayOfWeek (the 0.7 union, named)
export interface DatePickerLabels extends CalendarLabels {
  // 0.7: clear, openCalendar, invalidDate, outOfRange, unavailableDate
  /** @default 'Close' */
  close?: string;
}
```

- **Modules.** `Calendar.tsx`: the public `Calendar` and the internal `CalendarView` (header, view state, footer, focus, Escape levels); `Calendar.views.tsx`: the day, month and year grids; `dateUtils.ts`: the internal helpers the views need (the range of a day, the decade of a year, `addYears`, week numbers per row, the month, year and decade formatters in the grid-compatible calendar of `getCalendar`); `src/lib/date.ts`: the public helpers (D33).
- **`CalendarView` internal props:** everything of `CalendarProps` that is not forms or Field, plus `headingAs: 'h2' | 'div'`, `headingId` (DatePicker labels its dialog with it), `onPick(date)` (DatePicker commits and closes), and `onClose` with `closeLabel` (DatePicker's footer Close button, D32). The grid of the current view is marked `data-wave-calendar-grid`, so DatePicker's focus trap finds its tab stop (`[data-wave-calendar-grid] button[tabindex="0"]`, 0.7's query moved). 0.7's roving layout effect (focus follows the focused day while the grid has focus) moves into the view. Wave F adds a part-class pass-through (§3.3); nothing anticipates it before (rule 22).
- **Views, keys and focus:** D26 and D27. Month view: Left/Right ±1 (mirrored in RTL), Up/Down ±4, Home/End to the row's ends, PageUp/PageDown to the previous and next year (same month), Enter and Space pick. Year view: the same with PageUp/PageDown ±10 years. Month cells show the locale's short month names and are named `January 2025`; year cells show and are named by the year in the locale's digits (the Buddhist years of `th-TH`, as 0.7's formatters). The value's month and year are `aria-selected` (cell) and `aria-pressed` (button); today's month and year are `aria-current="date"` (D28's rule for today applies). The header's previous and next buttons are `focusableDisabledProps(…)` when the previous or next month, year or decade is wholly outside `minDate`/`maxDate` (0.7's rule for months). Every new button carries the 0.7 day and navigation buttons' classes (`p-0`, `bg-transparent`, the gated `bg-subtle-hover`: `DatePicker.test.tsx:161-190` checks every button of the dialog).
- **Standalone Calendar:** a `role="group"` root (`relative`) that holds the value (`useControllable`, compared by day as DatePicker's `commitDate`), the Field wiring and required hint (D35), `HiddenInput` and `useFormReset`, and renders `CalendarView` with `headingAs="div"`. Tab order: the previous button, the heading button, the next button, the grid (one stop), the footer. An invalid `locale` warns once (`Calendar:invalid-locale:<locale>`, DatePicker's check; `CalendarView` itself does not warn, so a DatePicker warns once); a hydration render without a date warns (D28).
- **DatePicker:** renders `CalendarView` with `headingAs="h2"` in its dialog; 0.7's view state (`viewMonth`, `focusedDay`, `openSeen`, `toWeeks`, the grid keys, `NAV_BUTTON_CLASSES`, `DAY_CLASSES`) moves into the calendar modules; `showCloseButton` renders the footer button through `onClose`, which calls the same `close` as Escape; its labels pass through.
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
- `src/lib/__tests__/date.test.ts`: local midnight for times of day and across DST changes (assertions compare calendar fields, no time zone assumed); `addMonths` clamping; `startOfWeek` for every `firstDayOfWeek`; `getWeekNumber` for the three rules at year boundaries (ISO: 2021-01-01 is week 53, 2026-12-31 is week 53, 2027-01-04 is week 1; `'first-day'` and `'first-full-week'` with Sunday and Monday weeks).
- `__tests__/Calendar.test.tsx`: `testSystemProps`; the day view's keys (the 0.7 DatePicker grid cases, run on the standalone Calendar); the drill-down (heading button name and description outside the heading, the month and year views' keys, picks, Escape levels showing the period before drilling up and consumed, focus after each view change and `document.activeElement` never `<body>`, `aria-live`, the decade heading); disabled months and years reachable; `today` (marked with the prop; without it, no mark, the clock-free tab stop and an enabled "Go to today" until hydration, then applied; `renderToString` and `hydrateRoot` under different `vi.setSystemTime` dates without warnings; the hydration warning); `initialVisibleDate` and the clamp into `minDate`/`maxDate`; a controlled value moving to another month shows it; week numbers (row headers and the header cell pass axe, names, skipped by the keys, the three rules); `markedDates` (the dot in `currentColor`, `data-marked`, the name suffix); `renderDay` and `dayLabel`; every `selectionRange` (the range's `aria-selected`, `aria-pressed` and `data-selected`, unavailable days left out, `details.range`), `workWeekDays`; "Go to today" (focuses today, selects nothing, disabled outside the range); `onValueChange` only on change with `details`, also on a reset, StrictMode once; forms and reset (`required` focuses the tab stop); `renderWithFieldContext` (label, description, `aria-invalid`, the required hint); RTL (horizontal keys mirrored in every view; the chevrons mirror); axe in each view.
- `DatePicker.test.tsx`: its 0.7 cases (§6.4) plus the forwarded props and `showCloseButton` (closes, focus returns as with Escape); Escape in the month view stays in the dialog.
- `dateUtils.test.ts`: the new internal helpers.

Stories (`stories/Calendar.stories.tsx`, title `Components/Input/Calendar`): Default, Localized (with `today` for SSR), Week numbers (ISO), Marked days, Custom day content (with `dayLabel`), Week selection, Go to today, In a Field; `stories/DatePicker.stories.tsx` gains "Month and year picker", "Week numbers" and "Close button".

---

## 3. Packages and file ownership

### 3.1 Files

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D), the lead every file in waves E and F. Paths without a folder are in `src/components/input/`; `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F5-foundation` (wave A) | `src/hooks/useListbox.ts`, `src/hooks/__tests__/useListbox.test.tsx`, `Option.tsx`, `__tests__/Option.test.tsx`, `src/lib/types.ts`, `src/lib/__tests__/types.test.ts`, `src/lib/layers.ts` (`DismissReason`'s JSDoc only), `src/styles/__tests__/tokens.test.ts` (§1.8 pairs only), `TagPicker.tsx` (the `multiselect` rename of its `useListbox` call only), `src/index.ts` and `index.ts` (§1.6 only), `src/__tests__/public-types.test.ts` and `src/__tests__/integration.test.tsx` (§1.6 only), `scripts/verify-dist.mjs` and `scripts/__tests__/verify-dist.test.mjs` (§1.7 only) | `src/hooks/useActiveDescendant.ts`, `src/hooks/__tests__/useActiveDescendant.test.tsx` | P5-03 (shared), P5-01/P5-02 (shared) |
| `P5-pickers` (wave B) | `Dropdown.tsx`, `Combobox.tsx`, `TagPicker.tsx`, their tests, `stories/{Dropdown,Combobox,TagPicker}.stories.tsx` | — | P5-01, P5-02, P5-03 (parts) |
| `P5-listbox` (wave B) | — | `Listbox.tsx`, `__tests__/Listbox.test.tsx`, `stories/Listbox.stories.tsx` | P5-03 (Listbox) |
| `P5-swatches` (wave B) | `SwatchPicker.tsx`, `__tests__/SwatchPicker.test.tsx`, `stories/SwatchPicker.stories.tsx` | `SwatchPicker.context.ts`, `SwatchPicker.swatches.tsx`, `__tests__/SwatchPicker.swatches.test.tsx`, `src/hooks/useRovingGrid.ts`, `src/hooks/__tests__/useRovingGrid.test.tsx` | P5-04 |
| `P5-calendar` (wave B) | `DatePicker.tsx`, `dateUtils.ts`, `__tests__/DatePicker.test.tsx`, `__tests__/dateUtils.test.ts`, `stories/DatePicker.stories.tsx` | `Calendar.tsx`, `Calendar.views.tsx`, `__tests__/Calendar.test.tsx`, `src/lib/date.ts`, `src/lib/__tests__/date.test.ts`, `stories/Calendar.stories.tsx` | P5-05 |
| `INTEGRATION` (wave C) | `src/index.ts`, `index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, the new stories' imports (rule 25), the wave-B tests and stories a seam breaks | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md`, `docs/FLUENT-UI-COMPARISON.md`, `docs/research/fluent-ui-v9-comparison.md` | — | docs |

Disjointness check (wave B): the four packages share no file. Read only in wave B: `useActiveDescendant.ts`, `useListbox.ts`, `useTypeahead.ts`, `useRovingTabIndex.ts`, `Option.tsx`, `Combobox.expand.tsx` (Dropdown imports `showsExpandButton`), `pickerStyles.ts`, `colorUtils.ts`, `HiddenInput.tsx`, `src/lib/*`, `src/test-utils*.tsx`, `stories/_helpers.ts`, `.storybook/*`. Not edited by anyone, and kept green: `TimePicker.tsx` and its tests (a `useListbox` consumer), `ColorPicker.tsx` and its tests (an `items` consumer of SwatchPicker), `List.tsx` and its tests. A package that breaks one of them reports it (rule 7).

### 3.2 Files Phases 3 and 4 change

From their first drafts (2026-09-26); both may still change. **Phase 3:** every component file (P3-00: the class of each root and part from `src/lib/classNames.ts`; the `class-names` gate rule; a `testSystemProps` case; `src/__tests__/classNames.test.ts`, whose completeness check requires a registry constant, an alias or a `NO_ELEMENT` entry for every exported component and compound member), `ColorPicker.tsx` and the new colour components (P3-05: `ColorPicker.Swatches` renders a SwatchPicker with a per-swatch part class), Toast, MessageBar and Tree files, `src/lib/types.ts`, tokens, the integration, public-types and `verify-dist` files, the documentation. **Phase 4:** `src/lib/types.ts` (`CoreSize`, `InputAppearance`), `src/lib/styles.ts` (the input recipe), tokens and `tokens.test.ts`, `useFieldControl.ts` (Field `size`), `WaveProvider.tsx` (`inputDefaults`), `inputLook.ts` (new), `Combobox.tsx`, `Combobox.expand.tsx`, `Dropdown.tsx` (its chevron's size per size), `DatePicker.tsx` (its `ICON_BUTTON_CLASSES` and `pe-8`/`pe-14` move onto `pickerStyles.ts`) and `DatePicker.test.tsx` (its invalid-class assertions), `TimePicker.tsx`, `TagPicker.tsx`, `pickerStyles.ts`, Input, Textarea, Select, SearchBox, SpinButton, Checkbox, Switch, Slider, Rating, Field, Label, InfoLabel, their tests and stories, the documentation. Its listboxes and the DatePicker calendar do not change with size or appearance.

### 3.3 Waves

1. **Wave A:** `F5-foundation`. Exit: §1.9.
2. **Wave B:** `P5-pickers`, `P5-listbox`, `P5-swatches` and `P5-calendar` in parallel. Each reports its barrel requests (§4.3), the 0.7 tests it updated with the reason (§6.4), any failure it saw in another package's test and any change request. The known failure of rule 21 does not count.
3. **Wave C:** INTEGRATION: barrels and flat names (§4.3), story imports (rule 25), the cross-package tests (§4.4), public types (§4.5), the `verify-dist` probes and fixtures (§6.2), the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave E (lead):** the final gate and the real-browser checklist (§6.3).
6. **Wave F (lead), once Phase 4 is on `main`:** at the first wave boundary after Phase 4's merge commit reaches `main` (never inside a package's run), and in any case before this branch merges. Packages that start after it follow rule 22's last sentence.
   1. `git merge main` into `feat/fluent-parity-phase-5` (a merge commit, no rebase).
   2. Resolve the conflicts: component files keep every change (P3-00's classes, P4-01's recipe, this phase's features); shared files take the union (types, tokens and their pairs, barrels, tests, probes, documents). Known conflicts: `Dropdown.tsx` (P4-01's chevron sizes against D15's slot), `DatePicker.tsx` and `DatePicker.test.tsx` (P4-01's button and padding move against the calendar extraction), `TagPicker.tsx` and `Combobox.tsx` (P4-01's recipe against P5-01/P5-02), `SwatchPicker.tsx` (P3-00's `swatch` part class against the rewrite).
   3. **P3-00 for this phase's parts.** Register constants in `src/lib/classNames.ts` in P3-00's scheme for `Listbox`, `Calendar` (its root and parts: the header, the previous and next buttons, the heading and its button, the grid, weekday and week-number header cells, days, months, years, the footer, "Go to today"), `ColorSwatch`, `ImageSwatch` and `EmptySwatch` (root, `icon`), `SwatchPickerRow`; aliases for `ListboxOption` and `ListboxOptionGroup` (to `optionClassNames` and `optionGroupClassNames`, as `ComboboxOption`); `NO_ELEMENT` entries for `ListboxProvider` (it renders no element) and for `ListboxSurface` if P3-00's completeness test asks for one; the keys this phase gives existing components (Option's multi-select box, DatePicker's footer and Close button, Dropdown's multi-select value text). Keep 0.8's promise: `datePickerClassNames.header`, `previousMonthButton`, `heading`, `nextMonthButton`, `grid`, `weekday` and `day` stay on the same elements, now rendered by `CalendarView` (DatePicker passes them in through a part-class prop, P3-00 rule 4); `swatchPickerClassNames.swatch` is on every swatch in a picker, children included, and P3-05's `ColorPicker.Swatches` part class survives; `optionClassNames.checkIcon` and `dropdownClassNames.expandIcon` stay on the default `<svg>` (D7, D15) and land on a consumer glyph's `<span>`; the hosts' `__listbox` and `__surface` classes reach the elements `ListboxSurface` renders through its public `listClassName` and `surfaceClassName` (D42; Phase 3's internal props become these). Run the conventions gate and `classNames.test.ts`.
   4. **P4-01.** The multi-select modes take their component's size and appearance with nothing to add; Dropdown's `expandIcon` glyph takes P4-01's per-size glyph size and offset (`pickerGlyphSize`, the button table); Listbox and Calendar take no size (like the pickers' listboxes and the DatePicker calendar in P4-01).
   5. Documents: the CHANGELOG keeps `## [0.10.0] - Unreleased` above `## [0.9.0]` above `## [0.8.0]`; README sections merged ("Upgrading from 0.9" after "Upgrading from 0.8"); ROADMAP status lines and §8.3 lists; CLAUDE.md; the comparison guide; the size report measured against 0.9.0.
   6. The full gate (§6.3).

---

## 4. Cross-package contracts

### 4.1 The listbox seam (F5-foundation → P5-pickers, P5-listbox)

- `useActiveDescendant(options)`: §1.1's options and result.
- `useListbox(options)`: 0.7's options with `multiselect` in place of `multiple`, the `details` callbacks, `disabledOptionsFocusable`, `onActiveValueChange` and `mode: 'standalone'`, with `onOpenChange` optional; 0.7's result, with `ListboxListProps` as §1.2.7 says; `ListboxContextValue` with `multiselect`, `mode`, `press(value)` and `select(value, item, event)`; `UseListboxOptionResult.multiselect`; `ListboxOptionElementProps`.
- `Option` (`checkIcon`), `OptionGroup` (`label?: ReactNode`, routed names), `ListboxProvider`, `ListboxSurface` (`listClassName`, `surfaceClassName`), `useListboxPopup` (`UseListboxPopupResult`): §1.3. The multi-select box follows the context; no package passes it a prop.
- The announcements (D41) are each component's own (`useAnnounce`); the foundation provides nothing for them.

### 4.2 Types (F5-foundation → P5-calendar)

`DayOfWeek` and `FirstWeekOfYear` from `src/lib/types.ts` (§1.5). `P5-calendar` owns `src/lib/date.ts` and imports them.

### 4.3 Barrel and compound requests (INTEGRATION applies)

- `src/components/input/index.ts`: `Listbox`, `ListboxOption`, `ListboxOptionGroup`, `ListboxProps`, `ListboxLabels`, `ListboxComponent`; `DropdownComponent`, `ComboboxComponent`; `SwatchPickerRow`, `SwatchPickerRowProps`, `SwatchPickerLabels`, `ColorSwatch`, `ColorSwatchProps`, `ImageSwatch`, `ImageSwatchProps`, `EmptySwatch`, `EmptySwatchProps`; `Calendar`, `CalendarProps`, `CalendarLabels`, `CalendarValueChangeDetails`.
- `src/index.ts`: `addDays`, `addMonths`, `isSameDay`, `startOfWeek`, `getWeekNumber` and `GetWeekNumberOptions` from `./lib/date` (under "Utilities"; the other module exports stay internal).
- `scripts/verify-dist.mjs`: `PENDING_FLAT_EXPORTS = []` once `SwatchPickerRow` is exported, and `verify-dist.test.mjs`'s bridge case asserts the empty list again; the server probe's `index` check gains a branch that calls `addDays` from the entry under `react-server` and gets a `Date` (a plain function, not a client reference); `REQUIRED_DECLARATIONS` gains `useActiveDescendant` and `Calendar`; the fixture `index.*` files and declarations of `verify-dist.test.mjs` (lines 71–77, 383, 585–700) gain them.
- `CalendarView` and `ListboxContext` stay module exports (not in a barrel); `public-types.test.ts`'s walker must not report them (neither appears in a public signature).

### 4.4 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

1. The real Field around a Listbox (label, message and hint, a required Field blocks an empty submit, the error state) and around a Calendar (the group labelled and described, the required hint, `aria-invalid`), and around a grid-layout SwatchPicker (axe clean with a required Field).
2. A multi-select Dropdown and Combobox in a `<form>`: `FormData.getAll(name)` has one entry per value; a reset restores `defaultValue` and reports nothing when unchanged.
3. A Listbox in a Dialog: the list takes focus from Tab, its keys work, Escape closes the Dialog (the list does not consume it).
4. A Tooltip with `relationship="label"` around a `ColorSwatch`, in both layouts and in tab mode: the button is named by it and shows it on focus.
5. A Popover opened from an `EmptySwatch` in a grid-layout picker: arrow keys inside the Popover do not move the grid's focus, and a ColorPicker inside it keeps its own swatches.
6. A DatePicker in a Dialog: Escape in the month view shows the day view, the next Escape closes the DatePicker and returns focus, a third closes the Dialog.
7. The Server Component suite: `Listbox` with `ListboxOption` and `ListboxOptionGroup` as client references (`asClientReference`) renders the same `renderToString` output and behaves as the plain parts; `SwatchPicker` with `SwatchPickerRow`, `ColorSwatch`, `ImageSwatch` and `EmptySwatch` references likewise (implicit rows included); a `Calendar` with `today` renders and hydrates without warnings.
8. The custom picker of the Listbox story, written against the package entry only (`useListbox`, `useListboxPopup`, `ListboxSurface`, `ListboxProvider`, `Option`): opens, filters, selects and submits.

### 4.5 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

Every new exported type in the import list; `React.ComponentProps<typeof Dropdown>`, `…<typeof Combobox>` and `…<typeof Listbox>` equal `DropdownProps`, `ComboboxProps` and `ListboxProps` (the single-select shapes); `DropdownProps` without a type argument has `value?: string`; `ComboboxProps<true>` has no `freeform`; `SwatchPickerSize` includes `'extra-small'`; `OptionGroupProps['label']` is `React.ReactNode`; `SwatchPickerProps['items']` is optional; `CalendarProps['onValueChange']` takes an optional `CalendarValueChangeDetails`; `DatePickerLabels` extends `CalendarLabels`; the date helpers' signatures.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.10.0] - Unreleased` section above the previous one (in wave F, above `## [0.9.0]`), with:

- **Upgrading from 0.9** (numbered): DatePicker's calendar heading is a button (the month picker, on by default; `showMonthPicker={false}` keeps a static heading), so the dialog's Tab order gains a stop and tests that count Tab presses change; the `Option` context error names every listbox; `OptionGroup`'s `aria-label`/`aria-labelledby` land on its group list; SwatchPicker's root renders `data-layout`, `data-focus-mode`, `data-size`, `data-shape` and `data-spacing`, and its `items` are optional; a multi-select `Dropdown` or `Combobox` needs a literal `multiselect` (a boolean variable matches neither signature).
- **Added:** per item (the multi-select pickers and their announcements, `filter`, `query`, `onActiveOptionChange`, `expandIcon`, `renderValue`, `disabledOptionsFocusable`, `checkIcon`, rich optional group labels, `Listbox`, the public listbox primitives, `ListboxProvider` and `useActiveDescendant`, `DismissReason`, the swatch kinds, `layout`, `focusMode`, `spacing`, `'extra-small'`, SwatchPicker `labels`, `Calendar`, the month and year views, week numbers, marked days, `renderDay`, `dayLabel`, ranges, "Go to today", `showCloseButton`, `today`, `initialVisibleDate`, the date helpers, `DayOfWeek`, `FirstWeekOfYear`), each with the gap ids it closes.
- **Changed:**
  - *Behaviour:* the DatePicker heading button (above); OptionGroup's routed names.
  - *DOM:* the heading button and its hint element; SwatchPicker's root attributes; an Option's check column in a multi-select list.
  - *Types:* `SwatchPickerSize` gains `'extra-small'` (a `Record<SwatchPickerSize, …>` of yours needs the key, as Phase 1 D23's `BadgeColor`); `OptionGroupProps['label']` is an optional `ReactNode` (code reading it as a `string` narrows first); `SwatchPickerProps['items']` is optional; `typeof SwatchPicker` gains `Row`; `DropdownProps`, `ComboboxProps` gain a type parameter (defaulting to the 0.9 shape) and the components two call signatures (`DropdownComponent`, `ComboboxComponent`); DatePicker's `firstDayOfWeek` is `DayOfWeek` (the same union); the members of the newly public listbox interfaces (consumers implementing `ListboxContextValue` or `ListboxStore` will see later additions listed here).
- **Deprecated:** nothing new. A notice that Calendar's `onValueChange` `details` becomes required in 1.0, as every optional `details` (P13-03).
- **Size:** `dist/styles.css`, the Button-only and full-import probes, measured against the previous release.

### 5.2 README

"Components" (Listbox, Calendar, `ColorSwatch`, `ImageSwatch`, `EmptySwatch`); usage notes "Multi-select pickers", "Filtering and async search", "Listbox and custom pickers" (List vs Listbox; building a picker on `useListbox`), "Swatches" (children, the grid layout, focus modes, kinds), "Calendar" (the views, week numbers, ranges, SSR and `today`); "Built-in text" (every D36 row); "Keyboard support" (Listbox; the multi-select pickers; the swatch grid and tab mode; the calendar's month and year views and Escape levels); "Hooks and utilities" (`useActiveDescendant`, the listbox primitives, `ListboxProvider`, `ListboxSurface`, `useListboxPopup`, `DismissReason`, the date helpers); "Upgrading from 0.9".

### 5.3 CLAUDE.md

"Architecture": the new modules (`Listbox.tsx`, `Calendar.tsx` and `Calendar.views.tsx`, `SwatchPicker.context.ts` and `SwatchPicker.swatches.tsx`, `src/lib/date.ts`); the public hooks list gains `useActiveDescendant`, `useListbox` and `useListboxOption` (with the listbox types); the internal list gains `useRovingGrid` and loses `useListbox`; the "Internals stay module-only" list loses `collectOptionLabels`, `useListbox` and `ListboxSurface` and gains `CalendarView` and `ListboxContext`; `Option.tsx`'s entry says `ListboxProvider`, `ListboxSurface` and `useListboxPopup` are public; `Combobox.expand.tsx`'s entry says Dropdown imports `showsExpandButton`; C-SLOTS names the new glyph slots (`checkIcon` required; Dropdown `expandIcon`, swatch `icon` optional); C-DEV's value-keyed list gains SwatchPicker and Listbox. No convention changes.

### 5.4 Guide and testing guide

`docs/WAVE-UI-GUIDE.md`: "Building a custom picker" (`useListbox`, `ListboxSurface`, `useListboxPopup`, `ListboxProvider`, `Option`, `markListboxElement` for option components of your own) and "Active-descendant widgets" (`useActiveDescendant`). `docs/testing-best-practices.md`: testing an active-descendant widget (assert `aria-activedescendant` and the option's `data-active`, never DOM focus on the option).

### 5.5 ROADMAP

§8.3 gains "Behaviour differences decided by a phase spec (Phase 5, 0.10.0)": multi-select listboxes keep APG's `aria-multiselectable` and announce toggles (D2, D41); typing never clears a Combobox selection and a blur selects nothing (D12); Alt+ArrowDown and Alt+ArrowUp open or close without moving the highlight, and Home and End in an editable combobox move the caret; `onActiveOptionChange` reports pointer hover (D14); SwatchPicker's tab mode is a group of toggle buttons, and its grid stops at its ends (D19, D20); the calendar's PageUp/PageDown direction, Shift modifier and six-week grid (D27); SwatchPicker's `circular` default shape (D22). The `swatchpicker-5` entry says tab mode covers "every swatch a tab stop". The status line marks Phase 5 released when 0.10.0 ships (not in this phase).

### 5.6 `docs/FLUENT-UI-COMPARISON.md` and the gap report

The comparison guide (new on `main`, d5a84bd): §5.3's Combobox, Dropdown, Listbox, SwatchPicker and Calendar rows and migration notes (multi-select `value` arrays and a literal `multiselect`; `useComboboxFilter` vs `filter`; swatch children; Calendar); §3.9's SwatchPicker keyboard row (`focusMode` shipped); §2 and §7's "not in WaveUI yet" rows for these items removed; the "Related documents" counts. `docs/research/fluent-ui-v9-comparison.md` gets rows with ids for `imageswatch-1` and `emptyswatch-1` in §4.3's low-impact list (the roadmap cites them; the report's §3 lists the two components without ids); no other change to the report (a dated snapshot).

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

`npx vitest run <own test files> --reporter=default` with clean output (no act() warnings, every `[WaveUI]` warning asserted); the conventions and stories gates for the package's files; `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.dev.json --noEmit` filtered to its paths; `npx eslint` and `npx prettier --check` on its files. Wave A also runs its §1.9 exit criteria.

### 6.2 `verify-dist` probes (INTEGRATION)

- The Button-only tree-shaking probe is unchanged.
- Two exclusion probes through `probeTreeShaking` (no new helper): `{ keep: 'Calendar', drop: 'Dropdown', dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'] }` and `{ keep: 'Listbox', drop: 'Calendar' }` (D37).
- The server probe of §4.3 (`addDays` is callable under `react-server`).
- The flat names of §4.3, each with a JSDoc (the undocumented-component check); `--final` requires the bridge empty.

### 6.3 Final gate (wave E) and real-browser checklist

The roadmap §3 exit criteria through `/gate` (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`), plus the CHANGELOG, README and CLAUDE.md checks of the gate script. Real browsers (Chromium, Firefox, Safari where available; NVDA with Firefox or Chrome, JAWS where available, VoiceOver with Safari; an Android phone with Gboard and an iPhone), checked through `/browser-check` in Storybook, since jsdom cannot:

1. The multi-select Combobox: Tab and a click select the labels; typing, a context-menu paste, drag-and-drop text, dictation, autocorrect and IME composition (Japanese or Chinese; Gboard's composing) replace or extend them as D11 says; Backspace and undo.
2. Multi-select toggles in Dropdown, Combobox and Listbox are announced once each (NVDA, JAWS, VoiceOver).
3. The Listbox: a click focuses it and selects, also with the selected option scrolled out of view; the active option scrolls into view; a screen reader announces the active option and the selection (single and multiple); the ring on an empty list.
4. The swatch grid: the arrow keys in LTR and RTL; Tab out of the grid from an unselected swatch; a Tooltip on hover and focus; the selected state announced on the focused swatch (`aria-pressed`); tab mode read as toggle buttons; the required hint.
5. The Calendar: the heading announced after each view change; focus lands on the right cell and never on `<body>`; Escape levels in a DatePicker; week numbers read as row headers; a range read as selected days; the Field's error and hint announced when focus enters a standalone Calendar.
6. Forced colours (Windows high contrast): the multi-select option boxes and the active option, the swatch slash, check, focus outline and selection ring of each kind, the EmptySwatch border, the calendar's selected, today, marked and disabled cells in every view.
7. A server-rendered Calendar hydrates without warnings in a browser whose time zone and date differ from the server's, with and without `today`.

### 6.4 Existing tests expected to change (update, do not delete)

- **F5-foundation.**
  - `Option.test.tsx:205`, `useListbox.test.tsx:2365` and `:2389`: the missing-context message names every listbox (§1.2.9).
  - `useListbox.test.tsx`: `multiple:` becomes `multiselect:`; assertions of `onOpenChange` and `onSelect` calls gain the `details` argument (`expect.objectContaining({ reason })`, the item).
  - `integration.test.tsx:189-222`: the internal-helper list (§1.6).
  - `verify-dist.test.mjs:1082-1093`: the bridge case (§1.7).
- **P5-calendar, `DatePicker.test.tsx`.**
  - The tests that count Tab presses inside the dialog or list its tabbable elements (`:724-740`, `:1730-1751`) gain the heading button between the previous- and next-month buttons.
  - Queries by `role: 'heading'` and the month name, the `aria-live` check, the grid's `aria-labelledby` and the dialog and grid names (`:643-651`) stay as they are (the button's name is the heading text and its hint is outside the heading).
  - The every-button class checks (`:161-190`) pass because the new buttons carry the same classes.
  - Any other change is reported (rule 23).
- **P5-swatches, `SwatchPicker.test.tsx`.**
  - `:198`: `expectTypeOf<SwatchPickerProps['items']>()` becomes the optional type.
  - Assertions of the root's exact attribute list, if any, change for the new `data-*` attributes.
- **P5-pickers.** None expected: the default chevron and check keep their 0.7 elements and classes (`Dropdown.test.tsx:1133-1135`, `Option.test.tsx:163-164`).
- **INTEGRATION.** The integration and public-types tests only gain cases, apart from restoring the bridge assertion.

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

**Answered 2026-09-26:** the maintainer approved the spec with each recommendation below (`showGoToToday` `false`; `'first-day'`; tab mode as a toggle-button group; announcements on; wave F at the first wave boundary after Phase 4 is on `main`).

1. **`showGoToToday` default** — `false` (D32: 0.9 popups unchanged) or Fluent's `true`? Recommendation: `false`.
2. **Week numbering default** — `'first-day'` (D30: Fluent's code) or `'first-four-day-week'` (ISO 8601, the European norm)? Recommendation: `'first-day'` for parity; the JSDoc shows the ISO setting.
3. **SwatchPicker tab mode** — a group of `aria-pressed` toggle buttons (D19: APG-consistent, since a radio group or grid whose arrows do nothing breaks its keyboard contract) or Fluent's radio and grid roles with inert arrows? Recommendation: the toggle-button group.
4. **Multi-select announcements** — announce every toggle in Dropdown, Combobox and Listbox (D41, as TagPicker does) or rely on `aria-selected` alone (Fluent's approach needed menu semantics)? Recommendation: announce.
5. **Wave F timing** — merge Phases 3 and 4 in as soon as Phase 4 is on `main` (at the next wave boundary, as §3.3 says; later packages then follow P3-00 and P4-01), or only after wave E? Recommendation: as soon as possible, so the final gate runs once on the merged tree.

---

## 9. Review notes

Three reviews of the first draft (4ed587c): API conventions (3 blockers, 12 majors, 16 minors), accessibility and behaviour (4 blockers, 12 majors, 13 minors, with axe-core 4.13 runs), and the code, sequencing and verification (4 blockers, 8 majors, 10 minors, with `tsc` and `checkFlatExports` runs). Findings shared by two or three reviews were applied once. Every blocker and major was applied except as noted below; the minors were applied except as noted.

Applied differently or not applied:

- **The overload order of D9.** The conventions review proposed three signatures (`multiselect: true`, a `boolean` one, then the single-select one last). A `tsc` probe showed that a `boolean` signature before the single-select one takes the contextual type away from `<Dropdown value="a" onValueChange={(v) => …}>` (implicit `any`), the most common use, while the generic root of the first draft turns `ComponentProps<typeof Dropdown>` into a union no string can be passed to. Two signatures (multi-select first, single-select last) keep both the inference and `ComponentProps`; a non-literal `multiselect` is a type error, documented.
- **D11's mechanism.** The first draft emptied the input in the keydown of a text-editing key (`isTextEditingKey`, now not exported). Two reviews showed it misses edits without a key (a context-menu paste, a drop, dictation, Android keyboards) and can break an IME composition. The selection-on-focus plus inserted-text rule replaces it; the keydown path is dropped rather than kept as an optimisation, so there is one mechanism.
- **Tab mode (D19).** Of the two fixes the accessibility review offered (keep the arrow keys working in tab mode, or a toggle-button group), the group was chosen: keeping arrows in tab mode would make it the arrow mode with more tab stops. §8 asks the maintainer to confirm.
- **`aria-checked` for multi-select options** (the accessibility review's alternative to announcements): not taken; D2 keeps `aria-selected` and D41 announces (§0.4).
- **`aria-multiselectable` in range modes** (D29): not set, as Fluent; a real-browser check reads ranges (§6.3 item 5).
- **Keeping `highlightOnFilter`'s exact 0.7 comparison** (with disabled options): not kept; the difference is recorded in §1.1.2, since no component uses the option.
- **Unifying `highlightOnFilter` and `activateFirstOnChange`, and the hook's `filter(item)` and the components' `filter(option, query)`**: not renamed; each name belongs to its layer, and the `useListbox` JSDoc maps them (§1.2.8).
- **A pending allowance in `integration.test.tsx`'s flat-name case** for the bridge: not added; its failure between waves B and C is documented as known (rule 21), as short-lived as the bridge.

## 10. Implementation notes

(Written during implementation.)
