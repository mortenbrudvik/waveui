# WaveUI 0.9.0 — Fluent Parity Phase 4 Design (form controls: size, appearance, values and labels)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-4` (worktree `.claude/worktrees/phase-4`, from `main` bcbdb51, where 0.7.0 = Phases 1 and 2 is released) · Package: `@mortenbrudvik/waveui` → **0.9.0**. Phase 3 (0.8.0) is designed and implemented at the same time in another session, on its own branch; it merges to `main` first, and this branch merges it in before its final gate (§3, wave M).
> Scope: Phase 4 of [`docs/ROADMAP.md`](../../ROADMAP.md): the items P4-01 … P4-04. They close 15 medium and 19 low gaps of the Fluent UI v9 comparison (§7).
> Inputs: the roadmap's Phase 4 section, its goals and naming (§1), principles (§2) and process (§3); the Phase 1 spec [`2026-09-25-fluent-parity-phase-1-design.md`](2026-09-25-fluent-parity-phase-1-design.md) (the Field validation context this phase extends, the glyph-slot rules D21 and the data-attribute rule D22) and the Phase 2 spec [`2026-09-26-fluent-parity-phase-2-design.md`](2026-09-26-fluent-parity-phase-2-design.md) (the models for this document, the hover intent and the presence core), with their implementation notes; the verified gap entries `form-basic-*`, `combobox-3`, `dropdown-3`, `tagpicker-7`, `datepicker-8`, `timepicker-7`, `field-5`, `foundation-4` and `infolabel-*`; Fluent 9.74.9 read at microsoft/fluentui commit 8add8c8 (`react-input`, `react-textarea`, `react-select`, `react-spinbutton`, `react-search`, `react-combobox`, `react-tag-picker`, `react-datepicker-compat`, `react-timepicker-compat`, `react-field`, `react-shared-contexts` (`OverridesContext`), `react-checkbox`, `react-switch`, `react-slider`, `react-rating`, `react-infolabel`, `react-label`, `react-popover`, `packages/tokens`). Every API below was checked against the 0.7.0 source it changes: `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `SearchBox.tsx`, `SpinButton.tsx`, `Combobox.tsx`, `Combobox.expand.tsx`, `Dropdown.tsx`, `DatePicker.tsx`, `TimePicker.tsx`, `TagPicker.tsx`, `pickerStyles.ts`, `Checkbox.tsx`, `Switch.tsx`, `Slider.tsx`, `Rating.tsx`, `Field.tsx`, `Label.tsx`, `InfoLabel.tsx`, `WaveProvider.tsx`, `Popover.tsx`, `Popover.shared.tsx`, `useFieldControl.ts`, `useHoverIntent.ts`, `useDismiss.ts`, `useRestoreFocus.ts`, `lib/styles.ts`, `lib/types.ts`, `lib/children.ts`, `lib/dev.ts`, `tokens.css`, `tokens.test.ts`, `test-utils.ts`, `test-utils-field.tsx` and `scripts/verify-dist.mjs`.
> Lead rulings (binding, from the kickoff with the maintainer): (1) the release is 0.9.0 with a new `## [0.9.0] - Unreleased` CHANGELOG section, built in parallel with Phase 3 and merged after it (D1); (2) sizes and appearances are one class recipe over today's markup, with no DOM or `className` routing change and the static 2px focus border kept (D2); (3) the filled appearances follow Fluent's look, a fill without a visible stroke (D4); (4) InfoLabel's label content moves to `children`, with `label` as a deprecated alias (D31); (5) opening the info popup never moves focus (D29); Fluent names by default when they fit WaveUI's conventions, APG behaviour first, as in Phases 1 and 2.
> Status: revised after three reviews of the first draft (API conventions; accessibility and behaviour; the code, sequencing and verification). The blocker and every major point were applied; §9 lists the points not applied, or applied differently, and why, and §8 lists the changes the reviews made to the design the maintainer approved. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). The questions of §8 were answered by the maintainer during the design; any left open are answered before wave A starts (roadmap §3, entry criteria).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F4-foundation` | the shared types (`CoreSize`, `InputAppearance`), the input recipe in `src/lib/styles.ts`, the filled-appearance tokens and their contrast pairs, `FieldContextValue.size`, `WaveProvider inputDefaults` and the `InputDefaults` type, the internal resolver `useInputLook`, the test helpers (`renderWithFieldContext` `size`, `renderWithProviders` `inputDefaults`) and the shared story argTypes | the shared pieces of P4-01 | wave A |
| `P4-text` | Input, Textarea, Select, SearchBox | P4-01 (these four) | wave B |
| `P4-spin` | SpinButton | P4-01 (SpinButton), then P4-02 | wave B |
| `P4-pickers` | Combobox, its expand button, Dropdown, DatePicker, TimePicker, TagPicker, the picker class module | P4-01 (pickers) | wave B |
| `P4-choice` | Checkbox, Switch, Slider | P4-01 (choice controls) | wave B |
| `P4-rating` | Rating, RatingDisplay, the new `RatingItem` | P4-03 | wave B |
| `P4-labels` | Field (`size` and label elements), Label, InfoLabel, the new `InfoButton`, the label marker module | P4-01 (Field), P4-04 | wave B |
| `INTEGRATION` | barrels, cross-package tests (a real Field around every sized control, label elements, provider defaults, the Server Component suite), public type tests, the provider story, the `verify-dist` probe | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP | — | wave D |
| `MERGE` (lead) | merging Phase 3 from `main`, the P3-00 class names of the Phase 4 parts, the shared files | — | wave M |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) apply unchanged, with F4 in place of F1, and so do Phase 2's rules 16 (pointer tests) and 17 (direction). In addition:

11. **Wave A is exclusive.** `F4-foundation` lands and is committed by the lead before wave B starts. It may edit `src/index.ts` for the `InputDefaults` type export and add the matching lines of `src/__tests__/public-types.test.ts` (D7); every other barrel and public-types change stays INTEGRATION's.
12. **One recipe.** Every text control and picker takes its height, type ramp, padding, fill, strokes and corners from the maps of `src/lib/styles.ts` (§1.2) and its size and appearance from `useInputLook` (§1.6). No package re-rolls those classes or reads `FieldContext.size` or the provider defaults itself. A package that needs a class the maps lack files a change request (rule 7).
13. **Phase 3 runs in parallel.** No package merges, rebases or cherry-picks from `main` or from the Phase 3 branch; wave M (§3) does that once, as the lead. No package edits a file outside its ownership to prepare for Phase 3. Before wave M, no package adds the P3-00 stable class names (the gate rule that asks for them does not exist on this branch yet); once wave M has run (it can run after wave A or B), every later package follows P3-00's rule for the components and parts it adds or changes, as the conventions gate then requires. A package that edits a file Phase 3 is known to change (§3.2) says so in its report.
14. **Medium outline is 0.7.** A control rendered without `size` and `appearance`, outside a Field with `size` and a provider with `inputDefaults`, renders exactly the 0.7 classes plus the new data attributes. Each package keeps a test that pins this (a class assertion on the default render), so that no default look changes by accident. The only intended exceptions are the invalid recipe's focused bottom border (D4) and SpinButton's height and input basis (D13, D20).
15. **Forced colors, `:has()`, hit areas and real pointers** cannot be seen in jsdom: assert the classes and attributes, and leave the rest to the real-browser checklist (§6.3).

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; earlier rulings are cited as "Phase 1 D21" or "Phase 2 D18".

**Sequencing and structure**

- **D1 — Phase 4 is built next to Phase 3 and merges after it.** The roadmap's entry criterion ("0.8.0 merged to `main`") is waived by the maintainer: no Phase 4 item depends on a Phase 3 item (roadmap §6: epics 4.1–4.3 depend on 1.2, 1.3 and 2.2 only). The version stays 0.9.0 (Phase 3 is 0.8.0) and the CHANGELOG section is `## [0.9.0] - Unreleased`. Phase 3 merges to `main` first; wave M (§3) merges `main` into this branch, gives the new Phase 4 parts P3-00's stable class names and constants, reconciles the shared files, and re-runs the full gate; only then does this branch merge. DOCS records the parallel run in ROADMAP §3 (§5.5). *Why:* the maintainer runs the two phases in two sessions; the dependency graph has no edge between them; merging second puts the reconciliation on the branch that can see both.
- **D2 — One class recipe over today's markup.** Controls keep their 0.7 structure: a field drawn on the native element itself (Input without slots, Textarea, Select, the text inputs of Combobox, DatePicker and TimePicker, the Dropdown button) or on a wrapper around it (Input with slots, SearchBox, SpinButton, TagPicker). `src/lib/styles.ts` gains size and appearance maps (§1.2); the existing focus and invalid recipes (`inputFocus`, `inputFocusWithin`, `inputInvalid`, `inputInvalidWithin`) already work for every appearance and stay as they are. No control gains or loses an element, and `className`, `style` and `ref` stay where 0.7 puts them. The focus indicator stays the static 2px primary bottom border; Fluent's animated `::after` underline (which needs a wrapper on every control) is not reproduced. *Why:* the maintainer's choice (approach A): no DOM or routing change for 0.7 users, the Button precedent (`buttonStyles.ts` maps plus data attributes), and fewer conflicts with P3-00, which adds classes to the same roots. `form-basic-12` (Input's `className` moving to the wrapper with slots) stays in the backlog.

**Sizes and appearances (P4-01)**

- **D3 — Sizes.** `CoreSize` = `'small' | 'medium' | 'large'` (§1.1): 24, 32 and 40px tall, type ramp `caption-1`, `body-1`, `body-2`, horizontal padding 8, 12 and 16px (the element form, §1.2). `medium` is exactly the 0.7 look. Fluent's large padding is 18px; WaveUI uses 16px, on its 4px grid. Textarea, TagPicker and SpinButton define their own per-size metrics in their own module (§2) from the same heights and type ramp. *Why:* Fluent's field heights and type ramp; the grid rule of CLAUDE.md "Styling"; exact pixel parity is a roadmap non-goal (§1.3).
- **D4 — Appearances.** `InputAppearance` = `'outline' | 'underline' | 'filled-darker' | 'filled-lighter'` (§1.1), with these looks (§1.2 has the classes):
  - `outline`: the 0.7 look (a 1px `input` border, a `stroke-accessible` bottom stroke, 4px corners, the `background` fill).
  - `underline`: only the 1px `stroke-accessible` bottom stroke, square corners, no fill (transparent).
  - `filled-darker` and `filled-lighter`: the fill (`--wave-input-filled-darker`, `--wave-input-filled-lighter`), 4px corners and a 1px border in `--wave-input-filled-stroke`, which is transparent in the light and dark themes (Fluent's look: no visible stroke) and white in WaveUI's high-contrast theme.
  - Forced colors: `underline` and the filled appearances add `forced-colors:border-[ButtonText]` (the `forcedColors.control` recipe), so every appearance keeps a boundary in Windows High Contrast (roadmap acceptance); Fluent has no such rule.
  - Every appearance keeps the 0.7 behaviour for focus (the 2px primary bottom border, `focus:border-b-2 focus:border-b-primary`), disabled (dimmed to 50% opacity; Fluent uses disabled tokens) and hover (no hover colors).
  - The invalid look is the destructive color on every border the appearance draws. While the control is focused, the 2px bottom border is `primary` (the focus indicator) and the other borders stay destructive, so the error stays visible while it is corrected (Fluent hides it until blur). This changes the shared recipes (R8 of the 0.5 spec keeps one recipe for every control): `inputInvalid` becomes `border-destructive` and `inputInvalidWithin` `border-destructive`, dropping 0.7's `focus:border-b-destructive`/`focus-within:border-b-destructive`, so `inputFocus`/`inputFocusWithin` color the focused bottom border. `underline` has no other border, so its focused invalid field shows the focus indicator alone (its message still shows).
  *Why:* the maintainer's choice for the filled look (§8 Q3); a filled field is identified by its fill and its label (the docs say a filled field needs a visible label, since a placeholder is not one, and should sit on a surface other than the page background for `filled-lighter` and on the page background for `filled-darker`, Fluent's guidance); the high-contrast theme is WaveUI's own author theme, where a fill equal to the background would leave no boundary at all; in 0.7 a focused invalid field changed only the bottom border's width (1px to 2px, both destructive), which is the whole focus indicator on a Select or Dropdown, which show no caret (WCAG 2.4.7): the primary bottom border makes focus visible while the destructive sides keep the error visible (a visual change for invalid fields, CHANGELOG "Visual"; recorded in ROADMAP §8.3).
- **D5 — Tokens.** Three new tokens, declared in every theme group (§1.3): `--wave-input-filled-darker` (light `#f5f5f5`, dark `#141414`, high contrast `#000000`: Fluent's `colorNeutralBackground3`), `--wave-input-filled-lighter` (derived: `var(--wave-background)` in every theme, Fluent's `colorNeutralBackground1`) and `--wave-input-filled-stroke` (`transparent`, `transparent`, `#ffffff`), mapped to the utilities `bg-input-filled-darker`, `bg-input-filled-lighter` and `border-input-filled-stroke`. The two fills are text surfaces in `tokens.test.ts` (every text token keeps 4.5:1 on them), and the focus border (`primary`), the invalid border (`destructive`) and the focus ring of the buttons inside a field (`ring`) keep 3:1 against them. *Why:* no existing token is Fluent's dark `#141414`; `filled-lighter` is the page background in both of Fluent's themes, so deriving it follows a re-themed background; the stroke token gives the high-contrast theme a boundary without a component rule.
- **D6 — One resolution order for every text control and picker.** `size`: the control's own prop, then the surrounding Field's `size`, then `WaveProvider inputDefaults.size`, then the control's default (`medium`). `appearance`: the control's own prop, then `inputDefaults.appearance`, then `outline`. A Field or provider size outside a control's union is skipped (TagPicker has no `small`, so a small Field gives it its default, `medium`). The ten controls are Input, Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker and TagPicker; the choice controls (Checkbox, Switch, Slider) take neither the Field size nor the provider defaults, because their unions differ. One internal hook resolves it (§1.6). *Why:* the roadmap's "the default size of the text inputs and pickers inside it"; Fluent is inconsistent (SpinButton and TagPicker ignore the Field size, and only Input, Select, Textarea and SpinButton read the provider's appearance), and WaveUI's ten controls should behave alike.
- **D7 — `WaveProvider inputDefaults`.** `inputDefaults?: InputDefaults`, with the exported type `InputDefaults = { size?: CoreSize; appearance?: InputAppearance }`. A nested provider merges its own defined keys over the enclosing provider's (`<WaveProvider inputDefaults={{ size: 'small' }}>` inside an app with `appearance: 'filled-darker'` gives small filled-darker fields); omitting the prop inherits the enclosing value. `WaveContextValue` gains `inputDefaults: InputDefaults` (`{}` outside a provider), so `useWaveTheme()` returns it. *Why:* `foundation-4` (Fluent's `OverridesContext.inputDefaultAppearance`), widened to `size` as the roadmap sketches; the provider already inherits `theme`, `dir` and `portalContainer` the same way.
- **D8 — Field `size`.** `size?: CoreSize` on Field sets its label's type ramp (`caption-1`, `body-1`, `body-2`), and in the horizontal layout the label's top padding, so its first line stays centred on a 24, 32 or 40px control, and the padding that lines a Checkbox, Switch or RadioGroup row up with the label. The message and the hint stay `caption-1` (Fluent). `FieldContextValue.size` is the Field's own `size` prop (absent when it is unset), so the controls inside fall through to the provider defaults (D6); the Field's own label uses the prop, else `inputDefaults.size`, else `medium`. The Field root always renders `data-size` with that resolved value. *Why:* `form-basic-4`/`field-5`; passing the resolved `medium` down would hide the provider's size from every control inside a Field.
- **D9 — State attributes.** Every text control and picker renders `data-size` and `data-appearance` with the resolved values, always (Phase 1 D22), on the element that receives `className`: the `<input>`, `<textarea>` or `<select>` of Input (without slots), Textarea and Select; the wrapper of Input with slots; the root of SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker and TagPicker. Checkbox, Switch and Slider render `data-size` (Checkbox also `data-shape`); Rating and RatingDisplay render `data-color`; InfoButton renders `data-size`. They go before `{...rest}` (C-CLASS). *Why:* consumers style variants with `[data-appearance=underline]` selectors; the attribute sits where the consumer's `className` goes, so both target the same element.
- **D10 — The native `size` attribute.** `InputProps` and `SelectProps` extend the native attributes, so they inherited the numeric HTML `size` (Input: the width in characters; Select: the number of visible rows). Both now omit it and declare `size?: CoreSize | number` and `htmlSize?: number`. A number keeps its 0.7 meaning (it renders the native attribute, and the design size resolves as if `size` were unset) and is a deprecated value alias of `htmlSize`, resolved during render with `resolveDeprecatedProp('Input', htmlSize, numericSize, 'size={number}', 'htmlSize')` (and `'Select'`): `htmlSize` wins, and the numeric form warns once whenever it is present. The `size` prop carries no `@deprecated` tag (editors would strike through every `size="large"`); its JSDoc describes the numeric form in prose, as SearchBox's `dismiss` JSDoc does for its button-object form. `SliderProps` inherited the numeric `size` too, which a range input ignores: `size?: SliderSize | number`, where a number renders nothing, is a type error from 1.0, and is reported once from an effect (`Slider:size-number`, "Slider: a numeric `size` has no effect (a range input ignores the native attribute) and is removed in 1.0; remove it."). *Why:* roadmap principle 2 (a type may widen, never narrow): every 0.7 call keeps compiling and rendering as before; C-NAMING's value aliases; Fluent drops the native attribute from the prop name the same way; Slider's number had no effect to replace.
- **D11 — Picker buttons per size.** The icon buttons at the end of Combobox, DatePicker and TimePicker (clear, expand, calendar), and Dropdown's clear button, follow one table (§2.2, P4-pickers owns it in `pickerStyles.ts`): 20, 24 and 32px boxes at small, medium and large; every one keeps a 24×24px target that overlaps no other button's (the small 20px box extends its hit area 2px on every side with a transparent `before:` layer, and the second small button sits 4px from the first, so the two layers meet without overlapping); glyphs one step larger at large. On `filled-darker` the buttons' hover fill is `subtle-pressed`, since `subtle-hover` equals the light fill. SearchBox's clear button (a flex item, not positioned) takes the same box and layer and adds `relative`, so the layer is sized by the button and not by the field (§2.1). Listboxes and the calendar popup do not change with size. *Why:* WCAG 2.5.8 at every size (the roadmap's accessibility bar; overlapping areas count for neither target); a 24px box in a 24px field would paint its hover fill over the field's borders; Fluent's listbox is size-invariant too.
- **D12 — TagPicker sizes.** `size?: TagPickerSize` with `TagPickerSize = Extract<Size, 'medium' | 'large' | 'extra-large'>` (Fluent's union; default `medium`, the 0.7 look). A Field or provider `small` falls back to `medium` (D6). The selected tags scale with the picker (§2.2). *Why:* `tagpicker-7`; Fluent's TagPicker has no small size.
- **D13 — SpinButton sizes.** SpinButton takes all three `CoreSize` values (Fluent stops at `medium`) and keeps its flanking step buttons. The root takes the size's height, like every other field (24, 32 or 40px, borders included); the input and the buttons fill it (`h-full`), and the buttons take a per-size width (`w-6`, `w-8`, `w-10`). In 0.7 the root had no height and its 32px children made it 34px tall, 2px taller than every other field: at `medium` it now matches them (an exception to §0.2 rule 14, CHANGELOG "Visual"). In `outline` the buttons keep their 1px separators; in the other appearances they have none. *Why:* the roadmap puts SpinButton in the `CoreSize` list; a large form should not have one control that cannot follow its size; buttons as tall as the root would overflow its inner box and paint their hover fill over its borders; Fluent's stacked chevrons would be a layout change with no gap behind it.
- **D14 — Choice-control sizes.** Checkbox `size?: CheckboxSize` (`Extract<Size, 'medium' | 'large'>`: an 18px box, the 0.7 look, and a 22px box with a 16px glyph) and `shape?: CheckboxShape` (`Extract<Shape, 'square' | 'circular'>`, default `square`: 2px corners, or round); Switch `size?: SwitchSize` (`Extract<Size, 'small' | 'medium'>`: a 32×16 track with a 10px thumb, or the 0.7 40×20 track with a 14px thumb); Slider `size?: SliderSize` (`Extract<Size, 'small' | 'medium'>`: a 16px thumb on a 2px rail, or the 0.7 20px thumb on a 4px rail). WaveUI's medium checkbox (18px) is 2px larger than Fluent's (16px), so large adds the same 4px. The small Switch keeps a 24px-tall target with a transparent `before:` layer (`before:-inset-y-1`, the button is already `relative`), and the small Slider's input is 24px tall (`h-6`, the rail centred in it). *Why:* `form-basic-18`, `form-basic-23`, `form-basic-31`; Fluent's unions; no visual change at the defaults; WCAG 2.5.8 without relying on the spacing exception.

**SpinButton values (P4-02)**

- **D15 — `displayValue`.** `displayValue?: string` is the text shown for the value while the input is not being edited, and its `aria-valuetext` (a consumer `aria-valuetext` wins). While the input has focus and is editable (not `readOnly`, not disabled), it shows the plain number instead (`String(value)`), so typing edits "1", not "$1.00", and WaveUI's strict number parsing keeps working; `aria-valuetext` stays `displayValue`. When the switch happens while the whole text was selected (Tab selects a field's text, as does a consumer `onFocus` that calls `select()`), the whole new text is selected again, so typing still replaces the value. It applies only while `value` is controlled (Fluent): an uncontrolled SpinButton ignores it and warns once from an effect (`SpinButton:displayValue-uncontrolled`). *Why:* `form-basic-32`; Fluent lets the user edit the formatted text and leaves parsing to the app (`onChange` data), which cannot work with WaveUI's strict parser and its invalid-text flag; an uncontrolled value would make the text lie as soon as it changes.
- **D16 — `allowEmpty` types.** `SpinButtonProps` stays an interface with its 0.7 value members (`value?: number`, `defaultValue?: number`, `onValueChange?: (value: number) => void`, the deprecated `onChange`) and gains `allowEmpty?: false`. A second interface, `SpinButtonAllowEmptyProps`, has `allowEmpty: true`, `value?: number | null`, `defaultValue?: number | null`, `onValueChange?: (value: number | null) => void` and `onChange?: never` (the deprecated alias is not offered in the new mode, and declaring it `never` keeps `onChange` readable on the union, so a 0.7 wrapper that destructures it from `React.ComponentProps<typeof SpinButton>` still compiles). Every other member lives in the exported `SpinButtonBaseProps`, which both extend. The component accepts `SpinButtonProps | SpinButtonAllowEmptyProps`. The `allowEmpty` JSDoc says that it takes the literal `true` (a `boolean` variable fits neither member; branch the JSX, or spread `{ allowEmpty: true, value }`). *Why:* code that writes `interface MyProps extends SpinButtonProps` keeps compiling (an interface cannot extend a union type alias); `null` type-checks only where it is handled (the roadmap's discriminated union); a new mode needs no deprecated alias.
- **D17 — The empty value.** With `allowEmpty`: `defaultValue` defaults to `null`; clearing the text and committing it (blur or Enter) sets the value to `null` (`onValueChange(null)`), uncontrolled too; an empty value shows `''` (or `displayValue`), omits `aria-valuenow`, submits `''` through the hidden input and is restored by a form reset when it is the default. While `required` (its own, or a required Field's), an empty value blocks submission through the hidden input, which carries `required` (a text input whose value is `''` while empty; its `onInvalid` focuses the spinbutton, as the pickers do): the visible input's own `required` cannot, because it may show a `displayValue` for the empty value. Stepping from an empty value starts at 0 and then clamps: with `min={1}` both ArrowUp and ArrowDown give 1, the first valid value (Fluent starts from `min` when it is set, so its ArrowUp gives 2; recorded in ROADMAP §8.3). While focused and editable, an empty value shows `''` (never `String(null)`). The step buttons are enabled while the value is empty (unless disabled or read-only). Without `allowEmpty`, clearing still reverts to the last value (0.7). *Why:* `form-basic-33`; Fluent types `null` but its uncontrolled logic never produces it; ARIA: a spinbutton without a current value omits `aria-valuenow`.
- **D18 — Press-and-hold.** A step never happens on the down-event alone (WCAG 2.5.2, Pointer Cancellation):
  - A primary-button `pointerdown` on an enabled step button, of any pointer type (mouse, touch, pen), starts a 300 ms timer. A press released before it fires steps once, on its `click`.
  - When the timer fires while the button is still pressed, the press becomes a hold: it steps at once, then again after 300 ms, and the interval eases linearly from 300 ms to 80 ms over the first 1000 ms of holding and stays at 80 ms (Fluent's `DEFAULT_SPIN_DELAY_MS`, `MIN_SPIN_DELAY_MS`, `MAX_SPIN_TIME_MS`). The `click` that ends a hold adds no step.
  - A hold (and a pending timer) stops on `pointerup`, `pointercancel`, `pointerleave` of the button, when the value reaches the button's bound, when the window loses focus, when the control becomes disabled or read-only, and on unmount. The button releases the implicit pointer capture of touch and pen on `pointerdown` (`releasePointerCapture`), so `pointerleave` fires when the finger slides off.
  - A `click` without a press (`detail === 0`: a screen reader activating the button, `element.click()`) steps once. Whether a pointer `click` ended a hold is read from a flag that every `pointerdown` resets, so a hold that ended without a click (the button disabled at the bound, a touch long press) cannot swallow a later click.
  - The step buttons still never take focus (the 0.7 `onMouseDown` `preventDefault` stays; `pointerdown` is not cancelled, which would suppress that `mousedown`), and they suppress the long-press context menu (`contextmenu` prevented), the iOS callout (`[-webkit-touch-callout:none]`), text selection (`select-none`) and double-tap zoom (`touch-manipulation`).
  - Keyboard auto-repeat is the operating system's key repeat (Fluent).
  *Why:* `form-basic-34`; stepping on `pointerdown` would change the value when a finger that starts a scroll lands on a step button, before `pointercancel` arrives (Fluent listens to mouse events only, and its touch steps come from `click`); Fluent's timings are tuned (the 300 ms first delay does not mistake a trackpad tap for a hold); touch users benefit most from holding.
- **D19 — `precision`.** `precision?: number` (a whole number of decimals, 0–20) rounds every committed value, typed or stepped (`Number(value.toFixed(precision))`), and so the displayed number; it does not pad (`precision={2}` shows `1`, not `1.00`: padding is `displayValue`'s job). Without it the 0.7 rule stays: steps round to the decimals of `step`, of the delta and of the current value; typed values are kept as typed. *Why:* `form-basic-35`.
- **D20 — The input fills the root.** The inner input becomes `flex-auto min-w-0` with its per-size width as the flex basis (`w-10`, `w-12` (0.7), `w-14`; `flex-auto` keeps the width as the basis, where `flex-1` would set it to 0): an unsized SpinButton keeps its 0.7 width (114px at medium: two 32px buttons, a 48px input and the 1px borders), and a root you size (`className="w-full"`) grows the input instead of leaving blank space inside the border. `flex-auto` is an intended exception to §0.2 rule 14. *Why:* `form-basic-37`; no default width changes, so no layout shifts for 0.7 users.
- **D21 — Shift+Home and Shift+End** keep their native text-selection behaviour; Home and End without Shift still jump to finite bounds (Fluent's guard). *Why:* a small fix in a file this phase rewrites; Shift+Home selects to the start of the text in every text field.

**Rating (P4-03)**

- **D22 — Half stars.** `step?: 0.5 | 1` (default `1`) on Rating. With `step={1}` the DOM is unchanged: one `<button role="radio">` per star (the 24×24px target). With `step={0.5}` each star is one pointer target (a `<span>` of the same size and padding) holding two visually hidden radios (`<button type="button" role="radio">`), the half value (n − 0.5) first, then the full value (n), named by `labels.star(value, max)` ("2.5 stars", "3 stars"). The radios lie transparent over their halves (`absolute inset-y-0 w-1/2`, `start-0` and `end-0`, `opacity-0 pointer-events-none`), so screen-reader touch exploration and magnifiers find them where they are drawn, while the star stays the single pointer target.
  - A pointer click or tap on the star (`detail > 0`, its target not a radio) chooses by the pointer's position over it: the half from the inline start (the start half mirrors under `dir="rtl"`, read with `getDirection`), else the full value; the chosen radio then takes focus (`preventScroll`), so the keyboard continues from it.
  - A click on a radio (Space or Enter on the focused radio, a screen reader's activation, `radio.click()`) chooses that radio's own value; the star ignores such a click as it bubbles (its target is a radio), so the pointer-position rule never decides a keyboard activation.
  - A mouse moving over the star previews the half or full value by position.
  - The star draws the focus ring of either radio (`has-focus-visible:` classes on the star). *Why:* `form-basic-39`; the roadmap's guard (one 24×24px pointer target per star, the half chosen by position, two visually hidden radios); two 12px-wide targets would fail WCAG 2.5.8; keeping `step={1}` untouched keeps every 0.7 test and selector valid.
- **D23 — Keys move by `step`.** Right/Up add `step`, Left/Down subtract it (Left/Right mirrored in RTL), Home chooses `step` (the smallest value) and End `max`; from an empty rating, Right/Up/Home choose `step`. The 0.7 rules stay: keys never wrap, never clear the rating, and emit nothing at the ends. A controlled `value` off the step grid checks no radio and is drawn by rounding down to the step; the keys snap it to the grid (next: `floor(value / step) · step + step`; previous: `ceil(value / step) · step − step`, so 2.7 goes to 3 or 2.5), and the tab stop is the radio of `floor(value / step) · step` (the first radio below `step`). *Why:* the APG radio-group keys at the grain the rating offers; the APG's own rating example wraps, and WaveUI's 0.4 decision not to wrap is kept and recorded in ROADMAP §8.3.
- **D24 — `color`.** `color?: RatingColor` on Rating and RatingDisplay, `RatingColor = 'neutral' | 'brand' | 'marigold'`, default `'marigold'`: filled stars use `text-rating` (marigold, the 0.7 look), `text-primary` (brand) or `text-foreground` (neutral); unfilled stars keep the 3:1 `text-stroke-accessible` outline in every color. The root renders `data-color`. Both props interfaces extended `React.HTMLAttributes<HTMLDivElement>`, whose `color?: string` is the presentational HTML attribute (it did nothing on a `<div>`): they now omit it and declare `color?: RatingColor`, a type narrowing, as ProgressBar's and CounterBadge's `color` were in 0.6 (CHANGELOG "Types" and the intro say so). A string outside the union from untyped code renders as `marigold`, in the classes and in `data-color` (CounterBadge's precedent). *Why:* `form-basic-41`, `form-basic-46`; Fluent's default is `neutral` and colors the outline in the hue, but WaveUI keeps its 0.7 look as the default and one outline token (recorded in ROADMAP §8.3).
- **D25 — Icons.** `iconFilled?: Slot<'span'>` and `iconOutline?: Slot<'span'>` on Rating, RatingDisplay and RatingItem (an item's own pair wins over its group's). They are required indicators (Phase 1 D21): `null`, `undefined` and a value that renders nothing keep the default star, and a value that renders nothing also warns once (`Rating:iconFilled-empty`, `Rating:iconOutline-empty`, with `RatingDisplay:` and `Rating.Item:` keys for those components). Setting only one of the two warns once (`Rating:icon-pair`, likewise), because a custom filled glyph beside the default outline star mixes shapes. At `step={1}` the glyph renders inside the wired `<button role="radio">`, so the glyph-slot rule of C-SLOTS applies in every mode: a `<button>` or `Button` element (or a slot object whose `as` is one) is unwrapped through `unwrapButtonGlyph`, its children become the glyph, and a one-time warning names the slot (`Rating:iconFilled-button`, likewise). Every one of these warnings is emitted from an effect (C-DEV). There is no single `icon` (Fluent's RatingDisplay has one, recoloured for unfilled stars): filled and unfilled must differ by shape, not by color alone (WCAG 1.4.1). A partly filled star clips the filled glyph over the outline glyph from the inline start (the 0.7 RatingDisplay technique), and RatingDisplay keeps its continuous fill (4.6 fills 60% of the fifth star; Fluent rounds to halves). The glyphs are decorative (`aria-hidden`) and sized by the star size. *Why:* `form-basic-40`, `form-basic-46`; the JSDoc names Fluent's `icon`.
- **D26 — `RatingItem`.** A new public component that renders one star (`value`, the star's full value) from the context of its Rating or RatingDisplay: as a radio button (step 1), a star with two hidden radios (step 0.5), or a display star.
  - Exports (C-COMPOUND, as `Option` is attached to Combobox and Dropdown): Rating and RatingDisplay become `/* @__PURE__ */ Object.assign(…)` compounds with an `Item` member (`Rating.Item === RatingDisplay.Item === RatingItem`), and `RatingItem` is exported flat for Server Components. Their component JSDoc moves to the assigned consts (C-DOCS). Warning keys and messages of the part use `Rating.Item:`.
  - Children: Rating and RatingDisplay render their `children` instead of the `max` generated stars when `children` renders content (`slotRendersContent`); pass one `RatingItem` per value from 1 to `max` (`max` still sets the key range and the star names). A `compact` RatingDisplay shows its one star and ignores `children`. In 0.7 both ignored `children` (CHANGELOG "DOM").
  - Values (C-DEV): the items register their values through the context; a value used twice warns once per value, from an effect (`Rating.Item:duplicate:<value>`, as `useListbox` does), and so does a value that is not a whole number from 1 to `max` (`Rating.Item:value:<value>`) and a set of children that leaves a value from 1 to `max` without an item (`Rating.Item:missing`).
  - Context (C-CONTEXT, C-MEMO): the value is memoized; outside a root the part calls `reportMissingContext('Rating.Item', 'a rating (Rating or RatingDisplay)')` (it throws in development; in production it logs once and renders an empty display star from an inert value).
  - Attributes (C-ROUTING, C-COMPOSE): `RatingItemProps` omits `role`, `aria-checked`, `aria-label`, `aria-labelledby`, `tabIndex`, `children` and `onChange` (the radios are named by `labels.star` and roved by the root); `className`, `style`, `data-*`, the other attributes, the handlers and `ref` go to the star element (the radio button at step 1, the star `<span>` at step 0.5 and in RatingDisplay), with the consumer's handlers first and the item's `role`, `aria-checked` and roving `tabIndex` written after `{...rest}`.
  - Fluent's `RatingItemProvider` (items rendered standalone) is not added: the public contexts are roadmap P13-02's.
  *Why:* `form-basic-42` (per-item icons and styling); the compound convention for a part of two roots; a duplicated value would give two checked radios behind one roving value.

**Labels (P4-04)**

- **D27 — Label.** `required?: boolean | React.ReactNode`: `true` shows the 0.7 decorative `*`; other content replaces it (checked with `slotRendersContent`, rendered through `materialiseSlotContent`), inside the same `aria-hidden` span; a value that renders nothing shows no indicator. The JSDoc says the content must not be focusable (it sits in an `aria-hidden` span). `size` is typed `CoreSize` (the same union as 0.7). *Why:* `form-basic-9` (Fluent's `required` slot); the indicator stays decorative because the control carries `aria-required`.
- **D28 — `InfoButton`.** A new public component: a `<button>` with the info glyph, named by `aria-label` (redeclared with `@default 'Information'`), which shows `info: React.ReactNode` (required) in a popup.
  - Props: `InfoButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>` (the glyph is built in); `type` stays a prop with the default `type="button"` written before `{...rest}`, as MenuButton does (`testNoImplicitSubmit`); `size?: CoreSize` sets the glyph (12, 16 or 20px); `openOnHover?: boolean` (default `true`, D29). The roadmap sketched `openOn?: 'click' | 'hover-focus'`; 0.7 fixed the hover vocabulary (C-NAMING: `openOnHover`), so the prop takes that name.
  - Structure: the button is the root element (it takes `ref`, `className`, `style` and the rest); the hidden description (D30) and the portaled note are rendered next to it in a Fragment, never inside it (a link in a `<button>` would be invalid, and the note's clicks and focus would reach the button's handlers). The button box is 24×24px at every size, with negative block margins so it never grows the line it sits in, and renders `data-size`.
  - The note: a portaled, positioned `role="note"` surface with the Popover beak, placed above the button and centred (the 0.7 placement), styled as the 0.7 popup except that its width is capped at `min(20rem, 100vw − 1rem)` (0.7's `max-w-xs` plus the positioning padding overflowed a 320px viewport, WCAG 1.4.10), marked `data-wave-infolabel-surface` (the 0.7 marker, kept) and `data-state={open ? 'open' : 'closed'}` (the 0.7 `data-state="open"`, and `closed` while it exits, as `Menu.Popover`). It is labelled like the button: `aria-labelledby` repeats the button's own `aria-labelledby` ids when it has them (InfoLabel: the label and the button, so "Password Information"), else points at the button ("Information"). It mounts through the presence core (C-MOTION: surfaces added from 0.7; `data-presence`, `inert` while exiting; no built-in motion).
  - ARIA on the button: `aria-expanded`, and `aria-controls` while the note is open; no `aria-haspopup` (a note is none of the popup kinds the attribute names).
  - Machinery: the overlay hooks Popover uses (`useHoverIntent`, `useDismiss`, `usePopupPosition`, `useRestoreFocus`, `usePopoverTabOrder`, `PopoverBeak`), not `Popover` itself, whose trigger always renders `aria-haspopup="dialog"`.
  *Why:* `infolabel-4` (Fluent's standalone InfoButton), `infolabel-1` (rich content), `infolabel-5` (the arrow and click-only opening, below).
- **D29 — InfoButton behaviour.** With `openOnHover` (the default): a mouse resting on the button opens the popup after 250 ms, and it closes 250 ms after the pointer has left both the button and the note, with the safe zone (Phase 2 D18; touch and pen never hover); keyboard focus opens it too, as hovering's keyboard counterpart, while focus that comes from a pointer press does not (0.7); a click pins it, and a click on a pinned popup closes it. With `openOnHover={false}`: only a click (and so Enter and Space) toggles it. The JSDoc of `openOnHover` says that it also covers keyboard focus and that a click always toggles.
  - **Opening never moves focus** (lead ruling): focus stays on the button. Tab from the open button enters the first tabbable element of the note, Tab past its last element continues after the button, and Shift+Tab from its first element returns to the button. The Tab from the button is handled by the button's own `onKeyDown` (composed after the consumer's), as Popover's trigger does, because `usePopoverTabOrder`'s document listener runs after a modal's focus trap, which wraps the Tab first when the button is the trap's last element; `usePopoverTabOrder` handles the Tabs inside the note.
  - **Who owns an open note.** It is pinned by a click; it is focus-owned while it was opened by keyboard focus, or while it was opened by hover and the button has since received keyboard focus (0.7: a hover-opened popup becomes focus-owned when the button takes keyboard focus). The hover close (`canClose`) applies only to a note that is neither pinned nor focus-owned: pointer movement never closes a note that keyboard focus opened or keeps (WCAG 1.4.13, persistent). This is a deliberate exception to Phase 2's rule that focus on the trigger never blocks a hover close: here keyboard focus on the button is itself an opener.
  - **Closing.** Escape (focus returns to the button when it was inside), a press outside, focus moving outside both the button and the note (the dismiss layer's `focusOutside`; the button's own blur closes nothing, since Tab moves focus from the button into the note), and, for a note that is neither pinned nor focus-owned, the hover close (which moves no focus, Phase 2 note 9).
  - **Dismissed stays dismissed.** Focus that the component moves itself (the focus restore after Escape or after an outside press on a spot that takes no focus) never opens the note; after a dismissal, keyboard focus opens it again only once focus has left both the button and the note (hover's rule: after a dismissal, hover reopens only once the pointer has left the button).
  *Why:* the 0.7 behaviour is kept as the default; Tab reaching the note is what makes rich content usable from the keyboard without a click; Fluent moves focus into the note on open, which would make the two modes behave differently and take a screen-reader user away from the form; a restore that reopened the note would make Escape look broken, and in a Dialog each Escape would reopen it before the next one reached the Dialog.
- **D30 — One copy of `info`.** While the note is not mounted, InfoButton renders `info` in a `hidden` element that describes the button (`aria-describedby`), so the text is in the server HTML and is announced when the button takes focus (0.7); while the note is mounted, `info` renders in an unnamed wrapper inside the note (`<div id>{info}</div>`), which describes the button, and the hidden copy is not rendered. `info` is never in the document twice. The button's `aria-controls` points at the note itself; `aria-describedby` never does, because the note is named (D28) and Firefox describes with a referenced element's name when it has one ("Password Information" instead of the info text). *Why:* rich content (a link with an id, a component with effects) must not render twice; the 0.7 description is kept in every state.
- **D31 — InfoLabel.** InfoLabel becomes a real label with an info button after it:
  - Label content: `children` (Fluent, and `Label`); `label` is a deprecated alias (`resolveDeprecatedProp('InfoLabel', children, label, 'label', 'children')`: the new prop wins, the old one warns once), widened from `string` to `React.ReactNode` and optional.
  - `info` widens from `string` to `React.ReactNode`; `infoButtonLabel` (default `"Information"`), `openOnHover` and `size` reach the InfoButton.
  - Props: `InfoLabelProps` declares the label props it routes (`Pick<LabelProps, 'htmlFor' | 'required' | 'size' | 'weight' | 'disabled'>`, since span attributes have none of them), `openOnHover`, `infoButtonLabel`, `info`, `children`, and `label` with `@deprecated Use \`children\`.`
  - A `Label` renders the `<label>`: `id`, `htmlFor`, `required`, `size`, `weight` and `disabled` go to it; `className`, `style`, `ref`, `data-*` and every other attribute stay on the root `<span>`. `id` moving from the root to the `<label>` is a DOM change (CHANGELOG). The label text now takes Label's own type ramp and color (`text-foreground`, muted while `disabled`), where 0.7's text inherited the root's `text-body-1` and the parent's color: a root `className` that changes the text size or color no longer reaches it (CHANGELOG "Visual"; pass `size`, or style through a `className` on a `Label` of your own).
  - The button is named "‹label text› ‹infoButtonLabel›" through `aria-labelledby="<label id> <button id>"` (Fluent's technique: the button's own id reads its `aria-label`), so rich label content works and `infoButtonLabel` localizes the second part. The label gets a generated id when it has none. The roadmap sketched "Information about ‹label›", which needs the label's plain text; the order is recorded in ROADMAP (§5.5).
  - `disabled` dims the label only; the info button stays usable (Fluent).
  - No `controlRef`: InfoLabel is a label, not a form control (C-ROUTING's composite controls route a control's naming and validation props); its info button is an auxiliary control, and a layout that needs the button's element uses InfoButton next to a `Label`.
  *Why:* `infolabel-2` and the roadmap's P4-04; the maintainer's choice for `children` (§8 Q4); `aria-labelledby` must point at the `<label>` text only.
- **D32 — Label elements in Field.** Field's `label` also accepts a `Label` or `InfoLabel` element. Field recognizes it by a marker the two components carry (`src/components/input/fieldLabel.ts`, §2 P4-04), not by importing them, so a Field-only bundle never includes InfoButton's overlay code; the check uses `getElementType`, so an element created in a Server Component (a lazy client reference) is recognized. Field renders that element in place of its own `<label>`. It always gives it `htmlFor={controlId}`: an element's own `htmlFor` is read like Field's `htmlFor` prop (the control id when the child has no id of its own: `controlId = targetId ?? htmlFor ?? element.props.htmlFor ?? fieldId`), and when it differs from the resolved control id Field warns once from an effect (`Field:label-htmlFor`), since a label pointing elsewhere would leave the control unnamed. It gives it, each only when the element does not set it: `id` (the Field's label id; an element's own `id` becomes the label id Field uses), `required` (the Field's), `size` (the Field's resolved label size, D8) and `weight="semibold"` (the look of Field's own label); Field's layout classes are merged into its `className` (the element's classes last). Field does not render its own `*` for it (the element renders its `required`). The control is named by the label text alone, since the info button sits outside the `<label>`; a group control (RadioGroup) gets `aria-labelledby` pointing at that `<label>`. Every other `label` value renders as in 0.7. *Why:* `form-basic-6`, `infolabel-3`; a `<label>` inside Field's `<label>` would be invalid and would name the control with the info button's name; the marker keeps the bundle probe of §6.2 green.

### 0.4 Out of scope for 0.9

Everything else in the roadmap. In particular: Fluent's animated focus underline and its disabled and hover colors (D2, D4); DatePicker's legacy `underlined` and `borderless` props (Fluent compat); Radio sizes (Fluent has none); `form-basic-12` (Input's `className` moving to its wrapper), Textarea `resize` and `onValueChange` (`form-basic-13`, `-15`), the Select icon slot and `onValueChange` (`form-basic-27`, `-28`) and a vertical Slider (`form-basic-30`), which stay in the backlog; InfoButton's controlled open state and popover props; Fluent's `RatingItemProvider` and the public contexts (P13-02, D26); Rating wrap-around (D23); motion on InfoButton's note (Phase 10); the P3-00 class names before wave M (§0.2 rule 13). A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation (F4-foundation, wave A)

Lands first; every wave-B package builds on it. It changes no behaviour for existing consumers (§0.2 rule 14).

### 1.1 `src/lib/types.ts`

```ts
/**
 * The three-step size of text inputs, pickers, Field and Label (Fluent's field sizes): `small`
 * (24px tall), `medium` (32px) and `large` (40px).
 */
export type CoreSize = Extract<Size, 'small' | 'medium' | 'large'>;

/**
 * Look of a text input or picker: `outline` (a full border), `underline` (a bottom stroke only),
 * `filled-darker` or `filled-lighter` (a fill without a visible stroke).
 */
export type InputAppearance = 'outline' | 'underline' | 'filled-darker' | 'filled-lighter';
```

`src/index.ts` already re-exports every type of this module (`export type * from './lib/types'`). `types.test.ts` gets `expectTypeOf` checks: `CoreSize` equals `'small' | 'medium' | 'large'`, `CoreSize` extends `Size`, and `InputAppearance` has its four members.

### 1.2 `src/lib/styles.ts` — the input recipe

Plain literals (Tailwind's scanner reads them), composed with `cn()` before the consumer's `className`:

```ts
/** Height of a text control or picker per size. */
export const inputHeightClasses: Readonly<Record<CoreSize, string>> = {
  small: 'h-6',
  medium: 'h-8',
  large: 'h-10',
};

/** Type ramp of a text control or picker per size. */
export const inputTextClasses: Readonly<Record<CoreSize, string>> = {
  small: 'text-caption-1',
  medium: 'text-body-1',
  large: 'text-body-2',
};

/** Horizontal padding of a text control drawn on its own element, per size. */
export const inputPaddingClasses: Readonly<Record<CoreSize, string>> = {
  small: 'px-2',
  medium: 'px-3',
  large: 'px-4',
};

/**
 * Fill, strokes and corners of each appearance, for a field drawn on its own element or on a
 * wrapper. Compose `inputFocus`/`inputInvalid` (or the `…Within` forms) after it: they recolor the
 * borders the appearance draws.
 */
export const inputAppearanceClasses: Readonly<Record<InputAppearance, string>> = {
  outline: 'rounded border border-input border-b-stroke-accessible bg-background',
  underline:
    'rounded-none border-0 border-b border-b-stroke-accessible bg-transparent forced-colors:border-[ButtonText]',
  'filled-darker':
    'rounded border border-input-filled-stroke bg-input-filled-darker forced-colors:border-[ButtonText]',
  'filled-lighter':
    'rounded border border-input-filled-stroke bg-input-filled-lighter forced-colors:border-[ButtonText]',
};
```

- `inputFocus` and `inputFocusWithin` are unchanged. `inputInvalid` becomes `'border-destructive'` and `inputInvalidWithin` `'border-destructive'` (D4: the focused bottom border is the focus indicator's `primary`, the other borders stay destructive); their JSDoc says they apply to every appearance (`border-destructive` recolors every border the appearance draws: all four for `outline` and the filled ones, the bottom one for `underline`) and that the focus recipe colors the focused bottom border.
- `inputBase` stays, unchanged, with `@deprecated Compose inputHeightClasses, inputTextClasses, inputPaddingClasses and inputAppearanceClasses.` (internal; kept so that Phase 3 code that may import it still compiles after wave M). No Phase 4 control uses it.
- `hitAreaLayer = 'before:absolute before:-inset-0.5'`: extends a 20px control's pointer target to 24px with a transparent layer 2px beyond each edge (D11). Its JSDoc says the element must be positioned: the picker buttons are `absolute`, and a static element (SearchBox's clear button) adds `relative` itself; the recipe does not include `relative`, because `cn()` would then replace the picker buttons' `absolute`. (Tailwind 4's `before:` variant already sets `content`.) P4-text and P4-pickers both use it.
- `styles.test.ts` (the existing recipe tests, extended): the four maps have an entry per union member; `medium` + `outline` compose to the 0.7 classes (`h-8`, `px-3`, `text-body-1`, `rounded border border-input border-b-stroke-accessible bg-background`); `cn(inputAppearanceClasses.underline, inputInvalid)` keeps `border-0 border-b` and `border-destructive`; `cn(inputAppearanceClasses['filled-darker'], inputInvalid)` resolves the border color to `border-destructive`; `cn(inputAppearanceClasses.outline, inputFocus, inputInvalid)` keeps `focus:border-b-primary` next to `border-destructive`.

### 1.3 `src/styles/tokens.css` and `tokens.test.ts` (D5)

- In `:root, .wave-light`: `--wave-input-filled-darker: #f5f5f5;` and `--wave-input-filled-stroke: transparent;` with the strokes; `--wave-input-filled-lighter: var(--wave-background);` in the derived block. In `.wave-dark, .dark`: `#141414`, `transparent` and the derived line. In `.wave-high-contrast, .high-contrast`: `#000000`, `#ffffff` and the derived line. A comment names Fluent's `colorNeutralBackground3` and `colorNeutralBackground1`.
- In `@theme inline`: `--color-input-filled-darker`, `--color-input-filled-lighter`, `--color-input-filled-stroke`.
- `tokens.test.ts`: the three tokens in the per-theme value table `TOKENS` with their resolved values (`'input-filled-darker': ['#f5f5f5', '#141414', '#000000']`, `'input-filled-lighter': ['#ffffff', '#292929', '#000000']`, `'input-filled-stroke': ['transparent', 'transparent', '#ffffff']`), and `input-filled-lighter` also in `DERIVED` (the classification test reads `TOKENS`); both fills join `TEXT_SURFACES` (the page's text tokens keep 4.5:1 on them: foreground and placeholder text, and every other surface text token); `input-filled-stroke` joins `NOT_TEXT_TOKENS` ("filled input border: transparent except in high contrast"), and its 3:1 against `background` is asserted in the high-contrast theme only, through the theme-scoped `TABLED_MINIMUMS` (or a new theme-scoped list): `CONTRAST_PAIRS` run in all three themes and cannot compare `transparent` (`inverted-border`, the other transparent stroke, has no pair); `CONTRAST_PAIRS` gain `['primary', 'input-filled-darker', 3]`, `['destructive', 'input-filled-darker', 3]`, `['ring', 'input-filled-darker', 3]` and the same three for `input-filled-lighter`, with their tabled ratios. If a pair fails in a theme, stop and file a change request (the token changes, not the pair).
- `legacy-tokens.css` is not touched (no 0.4 names).

### 1.4 `src/hooks/useFieldControl.ts`

```ts
export interface FieldContextValue {
  // … 0.6 members unchanged …
  /**
   * The Field's own `size` prop, when set: the default size of the text inputs and pickers inside
   * it (their own `size` wins). Absent when the Field has no `size` (the controls then fall back to
   * `WaveProvider inputDefaults`) and in contexts built before 0.9.
   */
  size?: CoreSize;
}
```

`useFieldControl` is unchanged (size is not an attribute). `useFieldControl.test.tsx`: a context with `size` passes through the hook unchanged (no attribute).

### 1.5 `src/components/provider/WaveProvider.tsx` (D7)

```ts
/** Default size and appearance of the text inputs and pickers in a subtree. */
export interface InputDefaults {
  /** Default `size` of Input, Textarea, Select, SearchBox, SpinButton and the pickers. */
  size?: CoreSize;
  /** Default `appearance` of the same controls. */
  appearance?: InputAppearance;
}

export interface WaveProviderProps {
  // … unchanged …
  /**
   * Default `size` and `appearance` of the text inputs and pickers in the subtree (their own
   * props and a Field's `size` win). A nested provider merges its keys over the enclosing
   * provider's.
   * @default the enclosing WaveProvider's defaults, else none (`medium`, `outline`)
   */
  inputDefaults?: InputDefaults;
}

export interface WaveContextValue {
  // … unchanged …
  /** The merged input defaults of the providers above (`{}` outside a provider). */
  inputDefaults: InputDefaults;
}
```

- Merge: `{ ...parent.inputDefaults, ...definedKeys(inputDefaults) }`, memoized on the two primitive values (a new object literal each render must not re-render every input). An explicit `undefined` key does not override the parent.
- Tests (`WaveProvider.test.tsx`): the context value's exact shape gains `inputDefaults: {}` (existing test updated, §6.4); nesting merges per key; `useWaveTheme()` outside a provider returns `inputDefaults: {}`; a re-render with an equal inline object keeps the context value's identity.
- `src/index.ts` exports the `InputDefaults` type next to `WaveProviderProps` (wave A exclusive, §0.2 rule 11); `public-types.test.ts` gets its `expectTypeOf` lines (§4.9 lists the rest).

### 1.6 `src/components/input/inputLook.ts` — `useInputLook` (internal)

```ts
/** Options of {@link useInputLook}. */
export interface InputLookOptions<S extends Size> {
  /** The sizes the control supports. A Field or provider size outside them is skipped. @default CoreSize's */
  sizes?: readonly S[];
  /** @default 'medium' */
  defaultSize?: S;
}

/**
 * The size and appearance a text control or picker renders (D6): its own props, then the Field's
 * `size`, then `WaveProvider inputDefaults`, then the defaults (`medium`, `outline`).
 *
 * @internal Not exported from the package.
 */
export function useInputLook<S extends Size = CoreSize>(
  size: S | undefined,
  appearance: InputAppearance | undefined,
  options?: InputLookOptions<S>,
): { size: S; appearance: InputAppearance };
```

- Reads `useFieldContext()?.size` and `useWaveTheme().inputDefaults`. No state, no effect.
- Tests (`input/__tests__/inputLook.test.tsx`, through a probe component): each step of both chains; a Field `small` skipped for `sizes: ['medium', 'large', 'extra-large']` (then the provider's size when it fits, else the default); a provider `appearance` under a Field; a 0.6-shaped Field context (no `size`).

### 1.7 Test helpers

- `src/test-utils-field.tsx`: `resolveFieldTestContext` passes `size` through when given (`if (value.size !== undefined) resolved.size = value.size;`); the JSDoc example shows `{ size: 'small' }`. The harness renders nothing new.
- `src/test-utils.ts`: `RenderWithProvidersOptions.inputDefaults?: InputDefaults`, passed to the `WaveProvider` it renders.
- `src/__tests__/test-utils.test.tsx`: a context with `size` resolves with it; `renderWithProviders(ui, { inputDefaults })` provides them.

### 1.8 `stories/_helpers.ts`

`coreSizeArgType` (`small`, `medium`, `large`, `satisfies readonly CoreSize[]`) and `inputAppearanceArgType` (the four appearances, `satisfies readonly InputAppearance[]`), in the style of the existing `sizeArgType` and `appearanceArgType`. Wave-B packages use them (and declare component-specific unions such as `TagPickerSize` locally, Phase 1 rule 10).

### 1.9 Exit criteria of wave A

Full `npx vitest run` green (report any failure outside F4's files to the lead); `npm run typecheck` clean; `npm run lint` clean for F4's files; the conventions gate green for `inputLook.ts`; the lead commits F4 before wave B starts.

---

## 2. Items

Each item lists its behaviour, its files (§3 is authoritative) and its tests. Every package also keeps the default-render test of §0.2 rule 14, a StrictMode "callback fires once" test for each new state path, and the stories gate for its stories.

### P4-01 — `size` and `appearance` for inputs and pickers; sizes for choice controls; Field `size`; provider defaults

**Closes:** `form-basic-10`, `form-basic-11`, `combobox-3`, `dropdown-3`, `tagpicker-7`, `datepicker-8`, `timepicker-7` (M); `form-basic-14`, `form-basic-26`, `form-basic-36`, `form-basic-38`, `form-basic-4`, `field-5`, `foundation-4`, `form-basic-31`, `form-basic-18`, `form-basic-23` (L). **Guards:** control-level `error` on Input, Select and Textarea; hidden inputs and form reset on every picker; a required `Field` blocks submission natively (their existing tests stay green, and each package adds one case at a non-default size and appearance).

Common to every text control and picker (§1.2, §1.6, D6, D9): props `size?: CoreSize` (TagPicker: `TagPickerSize`) and `appearance?: InputAppearance`, each with a JSDoc that states the resolution order and the pixel sizes; `useInputLook` resolves them; the field classes come from the maps; `data-size` and `data-appearance` render before `{...rest}`.

#### 2.1 Text controls (P4-text: Input, Textarea, Select, SearchBox)

- **Input.** `InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>`, plus `size?: CoreSize | number`, `htmlSize?: number` (the native `size`, the visible width in characters) and `appearance?: InputAppearance`.
  - Numeric `size` (D10): rendered as the native `size` attribute unless `htmlSize` is set, warns once through `warnDeprecated`, and the design size resolves as if unset. The component JSDoc and the `size` JSDoc say so.
  - Element form (no slots): `cn(inputHeightClasses[size], inputPaddingClasses[size], inputTextClasses[size], 'w-full', inputAppearanceClasses[appearance], 'text-foreground placeholder:text-muted-foreground', inputFocus, 'disabled:cursor-not-allowed disabled:opacity-50', invalidLook && inputInvalid, className)`.
  - Wrapper form (slots): the wrapper takes `inputHeightClasses` + `inputTextClasses` + `inputAppearanceClasses` + `inputFocusWithin` (+ `inputInvalidWithin`, the disabled classes, `className`); the slot spans and the inner input pad per size: `ps-1.5`/`pe-1.5` and `px-1.5` (small), `ps-2`/`pe-2` and `px-2` (medium, 0.7), `ps-3`/`pe-3` and `px-3` (large); the inner input takes the size's type ramp.
  - `data-size`/`data-appearance` on the `<input>` (element form) or the wrapper (slots).
- **Textarea.** `size?: CoreSize`, `appearance?: InputAppearance` (all four: Fluent's Textarea has no `underline`, WaveUI keeps one union so a provider default applies everywhere; §8 Q9). Per size, in `Textarea.tsx`: `min-h-16 px-2 py-1` + `text-caption-1` (small), `min-h-20 px-3 py-2` + `text-body-1` (medium, 0.7), `min-h-24 px-4 py-2.5` + `text-body-2` (large). The `underline` appearance keeps `resize-y` and square corners.
- **Select.** As Input for `size`, `htmlSize` (the native number of visible rows) and the numeric alias (D10). Per size: `inputHeightClasses` + `inputTextClasses`, and in `Select.tsx` the paddings and the chevron (two token-colored gradient halves, as in 0.7):
  - small: `ps-2 pe-6`, `bg-[size:4px_4px,4px_4px] bg-[position:right_12px_center,right_8px_center] wave-rtl:bg-[position:left_8px_center,left_12px_center]`;
  - medium (0.7): `ps-3 pe-8`, `bg-[size:5px_5px,5px_5px] bg-[position:right_16px_center,right_11px_center] wave-rtl:bg-[position:left_11px_center,left_16px_center]`;
  - large: `ps-4 pe-10`, `bg-[size:6px_6px,6px_6px] bg-[position:right_20px_center,right_14px_center] wave-rtl:bg-[position:left_14px_center,left_20px_center]`.
  The appearance's fill (`bg-*` color) and the chevron (`bg-[image:…]`) are different utilities and combine; forced colors keep the native arrow (0.7).
- **SearchBox.** Wrapper form, like Input with slots: the root takes the height, type ramp and appearance; the search-icon span and the `contentAfter` span pad per size as Input's slots; the input pads `px-1.5`, `px-2` (0.7) or `px-3`. The search glyph is 12, 16 (0.7) or 20px. The clear button follows D11: `size-5` with `hitAreaLayer` (§1.2), `relative` (the layer's containing block; without it the layer would cover the whole field) and a 12px glyph (small), the 0.7 `h-6 w-6` with a 16px glyph (medium), `size-8` with a 20px glyph (large); its end margin is `me-1` at every size (0.7), so the small layer stays inside the field.

Tests (per control, in its test file): the default render pins the 0.7 classes and renders `data-size="medium" data-appearance="outline"`; each size and appearance renders its classes and attributes; `renderWithFieldContext(ui, { size: 'large' })` gives `large`, and an own `size` wins over it; `renderWithProviders(ui, { inputDefaults: { size: 'small', appearance: 'underline' } })` gives both, and an own prop wins; invalid (own `error` and a Field error) at `underline` and `filled-darker` keeps `border-destructive`; Input and Select: a numeric `size` renders the native attribute, resolves the design size to `medium` and warns exactly once with the `resolveDeprecatedProp` message; `htmlSize` alone renders the attribute and does not warn; with both, `htmlSize` wins and the numeric form still warns; `@ts-expect-error` rejects `size="huge"`; Input with slots: the wrapper carries the classes and attributes; SearchBox: the clear button's size classes and its 24px hit-area layer at small.

Stories: a "Sizes and appearances" story for each control (a grid of `size` × `appearance`, each field named, `filled-lighter` shown on a surface other than the page background), using the shared argTypes; the theme and direction toolbars cover the themes and RTL.

#### 2.2 Pickers (P4-pickers: Combobox, Dropdown, DatePicker, TimePicker, TagPicker)

`pickerStyles.ts` (owned by P4-pickers) replaces the fixed button classes with per-size metrics (D11):

| Size | Button box | Hit area | 1st button (`end-*`) | 2nd button | Text end padding (1 / 2 buttons) | Chevron glyph | Other glyphs (clear, calendar) |
|---|---|---|---|---|---|---|---|
| small | `size-5` (20px) | 24px: `hitAreaLayer` (§1.2) | `end-1` | `end-7` | `pe-7` / `pe-13` | 12px | 12px |
| medium (0.7) | `h-6 w-6` (24px, the 0.7 literal classes) | the box | `end-1` | `end-7` | `pe-8` / `pe-14` | 12px | 16px |
| large | `size-8` (32px) | the box | `end-1` | `end-9` | `pe-10` / `pe-18` | 16px | 20px |

Medium keeps the 0.7 strings literally (existing tests assert `h-6 w-6`); the other sizes add their box after it in `cn()`, which replaces `h-6 w-6` with `size-5` or `size-8`.

- At small the two buttons' 24px layers meet without overlapping: the first spans 2–26px from the inline end, the second 26–50px.
- `pickerIconButtonClasses(size, appearance)` returns the 0.7 `PICKER_ICON_BUTTON_CLASSES` with the size's box (and, at small, the hit-area layer) and, for `filled-darker`, the `subtle-pressed` hover fill (D11); `pickerButtonOffset(size, position)` returns the `end-*` class of the first or second button; `pickerEndPadding(buttons, size = 'medium')` keeps its 0.7 results at medium; `pickerGlyphSize(size, 'chevron' | 'icon')` returns the pixel size. `PICKER_ICON_BUTTON_CLASSES` stays as the medium value (other modules may read it).
- **Combobox, DatePicker, TimePicker:** the `<input>` draws the field (element form): `inputHeightClasses` + `inputPaddingClasses` + `inputTextClasses` + `inputAppearanceClasses` + `inputFocus` + `disabledStyles` + the invalid look + `pickerEndPadding(buttons, size)`; `w-full` and the text and placeholder colors as in 0.7. Their clear, expand and calendar buttons use the table. `PickerExpandButton` (in `Combobox.expand.tsx`) takes `size`. DatePicker's local copy of the button classes (`ICON_BUTTON_CLASSES`) and its hand-written `pe-14`/`pe-8` move onto `pickerStyles.ts`. The root (`className`, `data-size`, `data-appearance`) is the wrapper `<div>`, as in 0.7.
- **Dropdown:** the button draws the field: `inputHeightClasses` + `inputPaddingClasses` + `inputTextClasses` + `inputAppearanceClasses` + `pickerEndPadding(showClear ? 2 : 1, size)` + the 0.7 focus, disabled and invalid classes. The chevron glyph (inside the button) is 12, 12 or 16px at `end-2`, `end-3` (0.7) or `end-3`; the clear button uses the table's second position.
- **TagPicker** (D12): `size?: TagPickerSize` (exported type), `appearance?: InputAppearance`; `useInputLook(size, appearance, { sizes: ['medium', 'large', 'extra-large'] })`. The control (the `data-wave-tagpicker-control` wrapper) takes the appearance, `inputFocusWithin` and the invalid look; per size:
  - medium (0.7): control `gap-1 px-2 py-1.5`; tags `px-2 py-0.5 text-body-1`; input `py-0.5 text-body-1`;
  - large: control `gap-1.5 px-2.5 py-2`; tags `px-2 py-1 text-body-1`; input `py-1 text-body-1`;
  - extra-large: control `gap-1.5 px-3 py-2.5`; tags `px-2.5 py-1 text-body-2`; input `py-1 text-body-2`.
  The tag remove buttons keep their 0.7 box and glyph. `data-size` and `data-appearance` go on the root (where `className` goes).
- Listboxes (options, groups, the "No matches" row) and the DatePicker calendar do not change with size or appearance.

Tests: as §2.1 for each picker (the default render pins the 0.7 classes, including `pe-8`, `pe-14`, `end-1`, `end-7`); the button metrics at small and large (box, offset, end padding, glyph size, the hit-area layer at small); TagPicker: `size="extra-large"` classes, a Field `small` giving `medium` and a Field `large` giving `large` (`renderWithFieldContext`), `@ts-expect-error` for `size="small"`; the `expandIcon` rule (Phase 1 D21) at every size; RTL: the buttons stay at the inline end (`end-*`) under `renderWithProviders(ui, { dir: 'rtl' })`.

Stories: "Sizes and appearances" for Combobox, Dropdown, DatePicker, TimePicker and TagPicker (TagPicker with selected tags at each size).

#### 2.3 Choice controls (P4-choice: Checkbox, Switch, Slider)

- **Checkbox** (D14): `size?: CheckboxSize` (default `medium`), `shape?: CheckboxShape` (default `square`), exported types. medium: the 0.7 `h-[18px] w-[18px]` box, 12px glyph, `mt-px` beside a label; large: `h-[22px] w-[22px]`, 16px glyph, `-mt-px` beside a label (a 22px box on a 20px line). `square`: `rounded-xs` (0.7); `circular`: `rounded-full`. The label text stays `text-body-1`. `data-size` and `data-shape` on the root `<label>`.
- **Switch** (D14): `size?: SwitchSize` (default `medium`). medium: the 0.7 track and thumb; small: track `h-[16px] w-[32px]`, thumb `h-[10px] w-[10px]`, off `translate-x-[2px] wave-rtl:-translate-x-[2px]`, on `translate-x-[18px] wave-rtl:-translate-x-[18px]`, `mt-0.5` beside a label (a 16px track on a 20px line), and a 24px-tall target through `before:absolute before:inset-x-0 before:-inset-y-1` on the (already `relative`) switch button. `data-size` on the root.
- **Slider** (D10, D14): `SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>`, plus `size?: SliderSize | number` (a number: deprecated, no effect, warns once). medium: the 0.7 20px thumb, 4px rail and `-mt-2`; small: thumb `h-4 w-4`, rail and Firefox progress `h-0.5`, WebKit thumb `-mt-1.75` (half of 16 − 2), and the input `h-6` (a 24px-tall target, the rail centred in it). The forced-colors recipes are unchanged. `data-size` on the `<input>`.
- None of the three reads the Field size or the provider defaults (D6).

Tests: default renders pin the 0.7 classes; each size (and Checkbox shape) renders its classes and attributes; RTL: the small Switch thumb's `wave-rtl:` translate; Slider: a numeric `size` warns once and renders no attribute, `@ts-expect-error` for `size="large"`; Checkbox `@ts-expect-error` for `size="small"` and `shape="rounded"`.

Stories: sizes (and shapes) for each, with labels.

#### 2.4 Field `size` (P4-labels)

- `FieldProps.size?: CoreSize` (D8). The label's type ramp: `text-caption-1`, `text-body-1` (0.7), `text-body-2`. Horizontal layout: the label's top padding `pt-1`, `pt-1.5` (0.7) or `pt-2.25`, and the short-row padding of the first child (`SHORT_ROW_FIRST_CHILD`) `py-0.5`, `py-1.5` (0.7) or `py-2.5`. The root renders `data-size` (resolved: own, else `inputDefaults.size`, else `medium`). The context carries the own prop only.
- Tests (`Field.test.tsx`, without other wave-B packages' new props: a probe component reads `useFieldContext()`): the context has `size` only when the prop is set; the label classes per size, from the prop and from `renderWithProviders(…, { inputDefaults: { size: 'large' } })`; the horizontal paddings per size; the root's `data-size` (and the existing exact attribute sets updated, §6.4).

### P4-02 — SpinButton `displayValue`, empty value, press-and-hold, `precision` (P4-spin)

**Closes:** `form-basic-32`, `form-basic-33`, `form-basic-34` (M); `form-basic-35`, `form-basic-37` (L). **Guards:** SpinButton follows APG (`largeStep` = 10 steps); the 0.7 invalid-text flag, clamping and step rounding.

P4-spin first applies P4-01 to SpinButton (as §2.1: `size?: CoreSize`, `appearance?: InputAppearance`, `useInputLook`; the root takes `inputHeightClasses`, `inputTextClasses` and the appearance classes with `inputFocusWithin` and the invalid look; the input and the step buttons are `h-full`, the buttons `w-6`, `w-8` or `w-10` with 12, 12 or 16px glyphs; their `border-e`/`border-s` separators (`border-input`) render only in `outline`, D13), then the value features.

- **Types** (D16): `SpinButtonBaseProps` (every 0.7 member except the value members, plus `displayValue`, `precision`, `size`, `appearance`), `SpinButtonProps extends SpinButtonBaseProps` (`allowEmpty?: false`, the 0.7 `value`, `defaultValue`, `onValueChange` and deprecated `onChange`), `SpinButtonAllowEmptyProps extends SpinButtonBaseProps` (`allowEmpty: true`, `value?: number | null`, `defaultValue?: number | null`, `onValueChange?: (value: number | null) => void`). The component is typed `(props: SpinButtonProps | SpinButtonAllowEmptyProps) => React.ReactNode`. The JSDoc of `allowEmpty` explains the modes; the JSDoc of `displayValue` names Fluent's prop and the editing rule.
- **Behaviour:** D15 (`displayValue`), D17 (empty values), D18 (press-and-hold), D19 (`precision`), D20 (width: input `flex-auto min-w-0` with `w-10`, `w-12` (0.7) or `w-14`), D21 (Shift+Home/End).
- **Tests** (`SpinButton.test.tsx`):
  - `displayValue`: shown and used as `aria-valuetext` while blurred; the plain number while focused and editable (and `displayValue` again after blur); after focusing with the whole text selected, the whole plain number is selected; shown while focused but `readOnly`; a consumer `aria-valuetext` wins; uncontrolled: ignored, one warning (asserted exactly).
  - `allowEmpty`: default empty (`''`, no `aria-valuenow`); clearing and committing on blur and on Enter emits `null` once (StrictMode); stepping from empty with `min={1}` gives 1 both ways; buttons enabled while empty; `required` + empty: the hidden input is `valueMissing`, `form.checkValidity()` is `false`, the submit is blocked and focus goes to the spinbutton, also when a `displayValue` is shown for the empty value; the hidden input submits `''`; a form reset restores `null`; without `allowEmpty` clearing still reverts (0.7 test kept); type tests (`null` accepted only with `allowEmpty`, `onValueChange` parameter types, `interface X extends SpinButtonProps` compiles, `onChange` readable on the component's props union, a `boolean` `allowEmpty` rejected).
  - Press-and-hold (fake timers, `pointerType` mouse, touch and pen): a press released before 300 ms steps once, on its click, and not at `pointerdown`; a `pointercancel` before 300 ms steps never (a scroll that starts on the button); a held press steps at 300 ms, then the interval shrinks and reaches 80 ms after 1000 ms more (assert the step count at chosen times with 20 ms margins); the click that ends a hold adds no step; a hold stops at `pointerup`, `pointercancel`, `pointerleave`, the bound (the button disables), window `blur`, `disabled` becoming true; after a hold that ended at the bound without a click, `fireEvent.click` (`detail: 0`) still steps once; `fireEvent.click` without a press steps once; a secondary-button press does nothing; `releasePointerCapture` is called for touch; `contextmenu` on a step button is prevented; focus stays on the input throughout.
  - `precision`: typed `1.234` with `precision={2}` commits `1.23`; steps round to it; without it the 0.7 rounding stays (0.7 tests kept).
  - Width and height (classes only; jsdom has no layout): the default render has the `w-12` input with `flex-auto min-w-0`, the `w-8` buttons with `h-full`, and the root's `h-8` (D13, D20).
  - Shift+Home/Shift+End: not prevented, no value change; Home/End without Shift unchanged.
  - Sizes and appearances as §2.1 (the separators only in `outline`).
- **Stories:** `displayValue` (a controlled currency value), `allowEmpty`, `precision`, a full-width SpinButton, sizes and appearances.

### P4-03 — Rating half values, icons, colors and items (P4-rating)

**Closes:** `form-basic-39` (M); `form-basic-40`, `form-basic-41`, `form-basic-46`, `form-basic-42` (L). **Guards:** Rating has 24px targets, RTL keys, `disabled`/`required`: half stars keep one 24×24px pointer target per star, the half is chosen by the pointer position over it, and the two radios per star are visually hidden (D22).

- **Props:** Rating gains `step?: 0.5 | 1`, `color?: RatingColor` (omitting the inherited HTML `color`, D24), `iconFilled?: Slot<'span'>`, `iconOutline?: Slot<'span'>` and renders `children` when they render content (D26); RatingDisplay gains `color`, `iconFilled`, `iconOutline` and `children`; `RatingItemProps extends Omit<React.HTMLAttributes<HTMLElement>, 'role' | 'aria-checked' | 'aria-label' | 'aria-labelledby' | 'tabIndex' | 'children' | 'onChange'>` with `value: number`, `iconFilled?`, `iconOutline?` and `ref?: React.Ref<HTMLElement>` (routing as D26). `RatingColor` is exported. Rating and RatingDisplay become compounds (`Object.assign(…, { Item: RatingItem })`, D26). The `labels.star` JSDoc says it names half values too ("2.5 stars").
- **Structure:** Rating and RatingDisplay provide one internal context (value, hover value, `step`, `max`, `size`, `color`, the icon pair, `labels`, `disabled`, the roving and pick functions, whether the root is interactive); `RatingItem` renders from it (D22, D25, D26). Splitting the module (for example `Rating.item.tsx` next to `Rating.tsx`) is the package's choice; the public names come from `Rating.tsx`.
- **Behaviour:** D22 (half stars), D23 (keys), D24 (`color`), D25 (icons), D26 (`RatingItem` and children). The hidden input submits `String(value)` ("2.5"); `required` and form reset as in 0.7; `disabled` disables every radio and ignores the pointer (0.7).
- **Tests** (`Rating.test.tsx`; pointer positions through `mockRect` on the star and `fireEvent.click`/`pointerMove` with `clientX`):
  - `step={1}`: the 0.7 DOM and every 0.7 test unchanged; `data-color="marigold"` added (exact attribute sets updated, §6.4).
  - `step={0.5}`: two radios per star with their names, each over its half (`start-0`/`end-0`, `pointer-events-none`); a pointer click (`detail: 1`) at 25% of star 3 chooses 2.5 and focuses the "2.5 stars" radio; at 75% chooses 3; under `dir="rtl"` the halves swap; Space and Enter on the focused "3 stars" radio, and `radio.click()`, choose 3 in both directions (the position rule does not apply); hover preview of halves, cleared on leave; keys move by 0.5 (Home 0.5, End `max`, from empty Right gives 0.5, no wrap, no clear); a controlled 2.7 goes to 3 with Right and 2.5 with Left, and its tab stop is the "2.5 stars" radio; the focus-ring classes on the star; each star is one 24×24px target (its box classes); `onValueChange` once per change in StrictMode; the hidden input's value; axe.
  - `color`: the filled class per color; unfilled `text-stroke-accessible`; `data-color`.
  - Icons: custom pair rendered (filled and outline) and `aria-hidden`; one of the pair warns once (exact message); an empty slot keeps the star and warns; an item's own pair wins; RatingDisplay partial fills clip the custom filled glyph over the outline glyph (4.6 → 60%).
  - `RatingItem`: children replace the generated stars (with per-item icons); `RatingItem === Rating.Item === RatingDisplay.Item` (`testCompoundExposure`); a duplicated value, a value outside 1…`max` and a missing value each warn once (exact messages); outside a Rating it throws in development and logs once in production, rendering an empty display star (`expectThrows`, `vi.stubEnv`); `testSystemProps(RatingItem, …)` inside a Rating wrapper; `asClientReference(RatingItem)` children render and behave the same (C-COMPOUND); a `<button>` passed as `iconFilled` is unwrapped with its warning.
  - `color`: a string outside the union (untyped) renders `marigold` in the classes and in `data-color`.
- **Stories:** half stars, colors, custom icons (a "heart" pair), `RatingItem` children, RatingDisplay colors and icons.

### P4-04 — InfoLabel in Field; rich info; standalone InfoButton (P4-labels)

**Closes:** `infolabel-1`, `infolabel-2`, `infolabel-3`, `form-basic-6` (M); `infolabel-4`, `infolabel-5`, `form-basic-9` (L). **Guards:** Popover keeps the trigger's Tab order and names itself (InfoButton's note follows the same Tab-order and naming rules).

- **`src/components/input/fieldLabel.ts` (new, internal):** `FIELD_LABEL = Symbol.for('wave.fieldLabel')`; `markFieldLabel(component)` (sets the marker as a static property, next to `displayName`); `isFieldLabelElement(node): node is React.ReactElement<FieldLabelElementProps>` (`getElementType(node)`, then the marker); `FieldLabelElementProps` = `id`, `htmlFor`, `required`, `size`, `weight`, `className`. Label and InfoLabel call `markFieldLabel`.
- **Label** (D27): `required?: boolean | React.ReactNode`, `size?: CoreSize`; the marker.
- **InfoButton** (D28–D30): `src/components/data-display/InfoButton.tsx`; `InfoButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>` with `info: React.ReactNode`, `size?: CoreSize`, `openOnHover?: boolean`, the redeclared `'aria-label'?: string` (`@default 'Information'`) and `ref?: React.Ref<HTMLButtonElement>`; `type="button"` before `{...rest}`. The component returns a Fragment: the button, the hidden description while the note is not mounted, and the portaled note. Consumer handlers (`onClick`, `onFocus`, `onBlur`, `onKeyDown`, `onPointerEnter`, …) compose consumer-first (C-COMPOSE); `aria-describedby` joins the consumer's ids with the info element's id (`joinIds`). The glyph box: `size-6` with `-my-1` (small), `-my-0.5` (medium) or `-my-px` (large). Opening, closing, Tab order, focus restore and the one-copy rule as D29 and D30; the surface is held in state through a callback ref (C-POPUPS), and layers, focus restore and positioning key on `open`, never on the presence mount.
- **InfoLabel** (D31): renders `<span>` root (`inline-flex items-center gap-0`, `className`, `style`, `ref`, the rest) > `Label` (`id`, `htmlFor`, `required`, `size`, `weight`, `disabled`, the label content) + `InfoButton` (`info`, `aria-label={infoButtonLabel}`, `aria-labelledby` = the label id and its own id, `openOnHover`, `size`). The 24px button box provides the 4px gap to the 16px glyph at medium (hence `gap-0`). The marker. The 0.7 `data-wave-infolabel-surface` marker stays on the note.
- **Field** (D32): the label-element path; everything else as 0.7.
- **Tests:**
  - `Label.test.tsx`: `required` with content (rendered inside the `aria-hidden` span), with `''` (nothing), `true` (`*`); `size` classes unchanged.
  - `InfoButton.test.tsx`: `testSystemProps` (button, `displayName`, axe) and `testNoImplicitSubmit`; name "Information" and a consumer `aria-label`; no `aria-haspopup`; `aria-expanded`/`aria-controls`; the Fragment structure (the description and the note are not inside the button); hover opening after 250 ms and the hover close with the safe zone (fake timers, `mockRect`); touch never hover-opens; keyboard focus opens, a pointer press waits for the click; click pins and closes a pinned popup; `openOnHover={false}`: focus and hover do nothing, a click toggles; the note's `data-state` (`open`, then `closed` while it exits with `mockAnimations`); focus stays on the button when it opens; Tab from the open button enters a link in the note, also inside a modal focus trap where the button is the trap's last element; Tab past the note continues after the button and closes it; Shift+Tab returns to the button; a note opened by keyboard focus stays open when a mouse passes over the button and leaves (fake timers past `closeDelay`), and so does a hover-opened note once the button takes keyboard focus; Escape from a link in the note closes it, returns focus to the button, and the note does not reopen until focus has left both; an outside press on a spot that takes no focus closes it without reopening; the one-copy rule (closed: one hidden copy describing the button; open: an unnamed wrapper inside the note describes it, the button's description equals the info text, `aria-controls` points at the note, and no hidden copy renders; `renderToString` of the closed button contains the info text once); the note's `role="note"`, labelling, beak, `data-presence` and width cap; open-state axe; `findDanglingIdRefs` open and closed; StrictMode: one open per activation.
  - `InfoLabel.test.tsx` (updated, §6.4): `children` as the label; `label` still works and warns once (exact message), and `children` wins over it; `htmlFor`, `required`, `size`, `weight`, `disabled` reach the `<label>`; `id` on the `<label>`; the button named "Password Information" and with `infoButtonLabel="Info"` "Password Info"; rich `info` with a link reachable by Tab; `disabled` dims only the label; SSR and hydration without warnings.
  - `Field.test.tsx`: a `Label` element and an `InfoLabel` element as `label` render without a nested `<label>`, receive `id`, `htmlFor`, `required`, `size`, `weight="semibold"` and the layout classes (vertical and horizontal); their own `id`, `htmlFor` and `weight` win; the Field renders no second `*`; a native `<input>` child is named by the label text only (`toHaveAccessibleName('Email')`); a `<div role="radiogroup">` child gets `aria-labelledby` to the `<label>`; `asClientReference(InfoLabel)` and `asClientReference(Label)` elements are recognized.
- **Stories:** InfoLabel with rich `info` (a "Learn more" link), `openOnHover={false}`, sizes, required, inside a Field (vertical and horizontal); InfoButton next to a heading (the button outside the `<h*>`, named with `aria-labelledby` = the heading's id and its own id, so several such buttons are not all "Information"); Label with a custom required indicator; Field sizes.

---

## 3. Packages and file ownership

### 3.1 Files

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D), the lead every file in waves M and E. Paths without a folder are in `src/components/input/`; `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F4-foundation` (wave A) | `src/lib/types.ts`, `src/lib/__tests__/types.test.ts`, `src/lib/styles.ts`, `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts`, `src/hooks/useFieldControl.ts`, `src/hooks/__tests__/useFieldControl.test.tsx`, `src/components/provider/WaveProvider.tsx`, `src/components/provider/__tests__/WaveProvider.test.tsx`, `src/index.ts` (`InputDefaults` only), `src/__tests__/public-types.test.ts` (`InputDefaults`, `CoreSize`, `InputAppearance` lines only), `src/test-utils.ts`, `src/test-utils-field.tsx`, `src/__tests__/test-utils.test.tsx`, `src/lib/__tests__/styles.test.ts`, `stories/_helpers.ts` | `inputLook.ts`, `__tests__/inputLook.test.tsx` | P4-01 (shared) |
| `P4-text` (wave B) | `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `SearchBox.tsx`, their tests, `stories/{Input,Textarea,Select,SearchBox}.stories.tsx` | — | P4-01 |
| `P4-spin` (wave B) | `SpinButton.tsx`, `__tests__/SpinButton.test.tsx`, `stories/SpinButton.stories.tsx` | — | P4-01, P4-02 |
| `P4-pickers` (wave B) | `Combobox.tsx`, `Combobox.expand.tsx`, `Dropdown.tsx`, `DatePicker.tsx`, `TimePicker.tsx`, `TagPicker.tsx`, `pickerStyles.ts`, their tests, `stories/{Combobox,Dropdown,DatePicker,TimePicker,TagPicker}.stories.tsx` | `__tests__/pickerStyles.test.ts` (if none exists) | P4-01 |
| `P4-choice` (wave B) | `Checkbox.tsx`, `Switch.tsx`, `Slider.tsx`, their tests, `stories/{Checkbox,Switch,Slider}.stories.tsx` | — | P4-01 |
| `P4-rating` (wave B) | `Rating.tsx`, `__tests__/Rating.test.tsx`, `stories/Rating.stories.tsx` | `Rating.item.tsx` and its test (optional, §2 P4-03) | P4-03 |
| `P4-labels` (wave B) | `Field.tsx`, `Label.tsx`, `src/components/data-display/InfoLabel.tsx`, their tests, `stories/{Field,Label,InfoLabel}.stories.tsx` | `fieldLabel.ts`, `__tests__/fieldLabel.test.tsx`, `src/components/data-display/InfoButton.tsx`, `src/components/data-display/__tests__/InfoButton.test.tsx`, `stories/InfoButton.stories.tsx` | P4-01 (Field), P4-04 |
| `INTEGRATION` (wave C) | `src/index.ts`, `src/components/input/index.ts`, `src/components/data-display/index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `stories/WaveProvider.stories.tsx`, `stories/_helpers.ts`, `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs`, the wave-B tests and stories a seam breaks | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` | — | docs |

Disjointness check (wave B): the six packages share no file. `inputLook.ts`, `src/lib/styles.ts`, the token files, `useFieldControl.ts`, `WaveProvider.tsx`, the test helpers and `stories/_helpers.ts` are read only in wave B (rule 7 for changes). `Combobox.expand.tsx` and `pickerStyles.ts` belong to P4-pickers only; `Input.tsx` exports `isInvalidLook` (imported by P4-pickers, P4-spin, SearchBox and ColorPicker) and `useControlErrorMessage` (imported by Select and Textarea): P4-text keeps both signatures.

### 3.2 Files Phase 3 is expected to change

From the roadmap's Phase 3 items (its spec is written in parallel and may add more): every component root and part (P3-00's stable class names, with a new conventions-gate rule), so every file of P4-text, P4-spin, P4-pickers, P4-choice, P4-rating and P4-labels; `ColorPicker.tsx` and new color components in `src/components/input/` and its barrel (P3-05); Toast, MessageBar and Tree files (no Phase 4 overlap); `src/lib/types.ts`, `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts` (P3-05 contrast pairs); `src/components/provider/WaveProvider.tsx` (P3-00, which F4-foundation also edits); `src/__tests__/conventions.test.ts` (P3-00); `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `scripts/verify-dist.mjs`, `stories/_helpers.ts`; the six documentation files.

### 3.3 Waves

1. **Wave A:** `F4-foundation`. Exit: §1.9.
2. **Wave B:** the six component packages in parallel. Each reports its barrel requests (§4.7), the 0.7 tests it updated with the reason (§6.4), any failure of another package's test it saw, and any change request. Between wave B and wave C the full suite is expected to fail in two known places, both fixed by INTEGRATION: `src/__tests__/public-types.test.ts` ("exports every named type…"), as soon as a package adds a named type to a public signature (`CheckboxSize`, `SpinButtonBaseProps`, …), since the barrels are INTEGRATION's; and the InfoLabel cases of `src/__tests__/integration.test.tsx` (they query the button by the name "Information" and pass `label=`, which now warns).
3. **Wave C:** INTEGRATION: barrels (§4.7), the cross-package tests (§4.8), public types (§4.9), the provider story, the `verify-dist` probe (§6.2), the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave M (lead), whenever Phase 3 is on `main`:** at the first wave boundary after Phase 3's merge commit reaches `main` (after A, B, C or D; never inside a package's run), and in any case before wave E:
   1. `git merge main` into `feat/fluent-parity-phase-4` (a merge commit, no rebase: the branch's history stays reviewable).
   2. Resolve the conflicts: component roots keep both changes (P3-00's class and constant, and this phase's classes and attributes); the shared files take the union (tokens and their pairs, types, barrels, tests, probes, argTypes).
   3. Give every component and part added or changed by this phase the P3-00 stable class name and constant its gate rule asks for: `InfoButton`, `RatingItem`, and any new part the rule covers (the InfoButton note, the half-star box), in P3-00's naming scheme; export the new constants from the barrels with their flat names and `public-types.test.ts` lines (P3-00's acceptance: `verify-dist` flat names include the constants); check how P3-00's rule classifies this phase's helper modules (`inputLook.ts`, `fieldLabel.ts`, a `Rating.item.tsx`); run the conventions gate for all Phase 4 files.
   4. Documents: the CHANGELOG keeps `## [0.9.0] - Unreleased` above `## [0.8.0] - …`; README sections merged ("Upgrading from 0.8" follows Phase 3's "Upgrading from 0.7"); ROADMAP status lines for both phases; CLAUDE.md conventions merged.
   5. The full gate (§6.3).
   6. If wave M runs before wave B or C, the later packages follow P3-00's rule for what they add (§0.2 rule 13).
6. **Wave E (lead):** the final gate and the real-browser checklist (§6.3), the per-theme Storybook check of the new stories (light, dark, high contrast, RTL), and the size report against 0.8.0 (§5.1; measured here, after wave M, since wave M may run early). This branch merges to `main` after Phase 3 and wave M, never before (D1). The lead bumps `package.json` to 0.9.0 at release time, not in this phase's packages.

---

## 4. Cross-package contracts

### 4.1 The recipe (F4-foundation → every text control and picker)

- Heights, type ramp, element-form padding and appearance come from `inputHeightClasses`, `inputTextClasses`, `inputPaddingClasses` and `inputAppearanceClasses`; focus and invalid from the 0.7 recipes. A control's own per-size metrics (Textarea heights, Select chevron, SearchBox and Input slot paddings, SpinButton buttons, picker buttons, TagPicker tags) live in its own module, derived from the same three sizes.
- The appearance classes go after the size classes and before the focus, invalid, disabled and consumer classes in `cn()`.
- `medium` + `outline` renders the 0.7 classes (§0.2 rule 14).

### 4.2 Resolution (F4-foundation → P4-text, P4-spin, P4-pickers, P4-labels)

- `useInputLook(size, appearance, options)` is the only reader of `FieldContext.size` and `inputDefaults` for the ten controls. Field reads `inputDefaults.size` itself, for its label only (D8).
- `FieldContextValue.size` is the Field's own prop (absent when unset); `WaveContextValue.inputDefaults` is always an object.
- Choice controls, Rating and InfoButton do not read either.

### 4.3 The native `size` (P4-text, P4-choice)

- Input and Select: `size?: CoreSize | number`, `htmlSize?: number`; a number warns once (`warnDeprecated('Input' | 'Select', 'size={number}', 'htmlSize')`) and keeps rendering the native attribute; `htmlSize` wins; the design size resolves without it.
- Slider: `size?: SliderSize | number`; a number warns once and renders nothing.

### 4.4 Picker metrics (P4-pickers)

`pickerStyles.ts` is the single source of the button box, hit area, offsets, end padding and glyph sizes (§2.2 table); `PickerExpandButton` takes `size`; the medium results equal 0.7's.

### 4.5 Label elements (P4-labels)

- `fieldLabel.ts`: `markFieldLabel`, `isFieldLabelElement`, `FieldLabelElementProps`. Label and InfoLabel are marked; Field imports neither.
- InfoLabel routes `id`, `htmlFor`, `required`, `size`, `weight`, `disabled` to its `Label`; Field sets them only when the element does not (D32).

### 4.6 InfoButton (P4-labels)

- The one-copy rule (D30), the Tab order (D29), `role="note"`, no `aria-haspopup`, the presence mount (D28), and focus never moving on open. InfoLabel composes InfoButton; nothing else in this phase does.

### 4.7 Barrel requests (INTEGRATION applies)

- `src/components/input/index.ts`: `RatingItem`, and the types `RatingItemProps`, `RatingColor`, `TagPickerSize`, `CheckboxSize`, `CheckboxShape`, `SwitchSize`, `SliderSize`, `SpinButtonBaseProps`, `SpinButtonAllowEmptyProps`.
- `src/components/data-display/index.ts`: `InfoButton`, `InfoButtonProps`.
- `src/index.ts`: the same through the category barrels (flat names; `verify-dist` checks them automatically); `InputDefaults` is already exported from wave A; `CoreSize` and `InputAppearance` through `export type * from './lib/types'`.

### 4.8 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

The cases that need two wave-B packages at once (Phase 1 rule 9), and the real-Field cases:

1. A real `Field size="small"` and `size="large"` around each of Input, Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, DatePicker, TimePicker and TagPicker: each renders `data-size` from the Field (TagPicker: `small` → `medium`, `large` → `large`); the label's type ramp and the horizontal label padding match; an own `size` wins.
2. `WaveProvider inputDefaults={{ size: 'small', appearance: 'filled-darker' }}` around a Field without `size`: its Input, Combobox and TagPicker are small (TagPicker: medium) and filled-darker; a Field `size="large"` inside wins over the provider's size; a nested provider with `{ appearance: 'underline' }` keeps the outer size and changes the appearance; own props win; Checkbox, Switch and Slider inside stay medium.
3. `Field` with `label={<InfoLabel info={<>Use 12 characters. <a href="#rules">Rules</a></>}>Password</InfoLabel>}` and `required` around Input: the input's name is "Password"; the info button's name is "Password Information" and its description the info text; one `*`; Tab order: the info button (keyboard focus opens the note), then the link inside the note, then the input; Escape in the note returns focus to the button; axe open and closed.
4. `Field` with `label={<Label weight="regular">Plan</Label>}` around RadioGroup: the group's `aria-labelledby` points at the `<label>`, which renders regular weight; no nested `<label>`.
5. A required Field around `SpinButton allowEmpty`: an empty value blocks `requestSubmit()` and the input reports `valueMissing`; a value submits through the hidden input.
6. A required Field around `Rating step={0.5}`: a pointer choice of 3.5 submits "3.5"; a form reset restores the default.
7. InfoButton inside a modal Dialog: the note opens over it (a nested layer), Escape closes the note first, then the Dialog; focus returns to the info button, then to the Dialog's trigger.
8. The Server Component suite: `RatingItem` children written as client references (`asClientReference(RatingItem)`) render and choose as plain items; `InfoButton`'s flat name; a Field `label` that is `asClientReference(InfoLabel)` is recognized as a label element (same `renderToString` output as the plain element, no nested `<label>`).
9. Guards at a non-default look: a required Field blocks submission of an empty `Input size="large" appearance="underline"`; Input `error` renders its message at `size="small" appearance="filled-darker"`; a Combobox with `name` resets with its form at `size="large"`.

### 4.9 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

`expectTypeOf` for every new member exported from the package entry, including: `InputProps['size']` equal to `CoreSize | number | undefined` and `InputProps['htmlSize']`; the same for `SelectProps`; `TextareaProps['size']` equal to `CoreSize | undefined`; `…['appearance']` equal to `InputAppearance | undefined` on the ten controls; `TagPickerProps['size']` equal to `TagPickerSize | undefined`; `CheckboxProps['size' | 'shape']`, `SwitchProps['size']`, `SliderProps['size']` (with `number`); `FieldProps['size']`; `FieldContextValue['size']` optional; `WaveProviderProps['inputDefaults']` and `WaveContextValue['inputDefaults']`; `SpinButtonProps['value']` equal to `number | undefined`, `SpinButtonAllowEmptyProps['value']` equal to `number | null | undefined`, and `React.ComponentProps<typeof SpinButton>` equal to their union; `RatingProps['step']` equal to `0.5 | 1 | undefined`, `RatingProps['color']` equal to `RatingColor | undefined`; `InfoLabelProps['info']` equal to `React.ReactNode`, `InfoLabelProps['label']` optional (deprecated), `InfoLabelProps['htmlFor' | 'required' | 'size' | 'weight' | 'disabled' | 'openOnHover']`; `InfoButtonProps['openOnHover']` equal to `boolean | undefined`; `SpinButtonAllowEmptyProps['onChange']` equal to `undefined` (`never`) and `onChange` readable on `React.ComponentProps<typeof SpinButton>`; `typeof Rating.Item` and `typeof RatingDisplay.Item` equal to `typeof RatingItem`; `RatingProps['color']` rejecting `'red'`; `LabelProps['required']` equal to `boolean | React.ReactNode | undefined`; `@ts-expect-error` for `Input size="huge"`, `TagPicker size="small"`, `Checkbox size="small"`, `Switch size="large"`, `SpinButton value={null}` without `allowEmpty`, `Rating step={0.25}`, `InfoButton` without `info`.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.9.0] - Unreleased` section above the latest section on the branch (above `## [0.8.0] - …` after wave M):

- **Intro:** the Fluent-parity release for form controls (Phase 4 of the roadmap: size, appearance, values and labels); it closes 15 medium and 19 low gaps (ids in backticks); nothing public removed, and no public type narrowed except the `color` attribute that Rating and RatingDisplay inherit (see Types); read "Changed" before upgrading if tests assert Wave's DOM or console output.
- **Upgrading from 0.8** (numbered, as 0.6 and 0.7 did):
  1. Every text control, picker and choice control, Field, Rating and RatingDisplay render new data attributes (`data-size`, `data-appearance`, `data-shape`, `data-color`); exact attribute assertions change. Nothing changes visually at the defaults.
  2. A numeric `size` on Input and Select is deprecated: use `htmlSize` (it still works and warns once in development); on Slider it has no effect and warns.
  3. InfoLabel: the label is now a `<label>` (pass `htmlFor` to point it at a control); `id` moves from the root to the label; the label content moves to `children` (`label` still works and warns once); the info button is named "‹label› Information"; the popup is a `role="note"` with a beak that can hold links, and it is no longer `aria-hidden`.
  4. SpinButton: it is 32px tall like the other fields (0.7: 34px); a sized root now widens the input (the default width is unchanged); a step button steps on click, and holding it repeats; Shift+Home and Shift+End select text instead of jumping to the bounds.
  5. Field renders a `Label` or `InfoLabel` element passed as `label` itself (0.7 wrapped it in a second `<label>`).
  6. A focused invalid field draws its focused bottom border in the focus color; the other borders stay red (0.7: all red).
  7. `RatingProps.color` and `RatingDisplayProps.color` are `RatingColor`: they narrow the `color?: string` inherited from `React.HTMLAttributes` (the presentational HTML attribute, which does nothing on a `<div>`); a string outside the union from untyped code renders as `marigold`. `Rating` and `RatingDisplay` gain the static member `Item`, and both render their `children` (0.7 ignored them).
- **Added** (by component, each with its gap ids): sizes and appearances with the tokens and the provider defaults (P4-01), Field `size`; SpinButton `displayValue`, `allowEmpty`, press-and-hold, `precision` (P4-02); Rating `step`, `color`, icons, `RatingItem` (P4-03); InfoButton, InfoLabel label props and rich `info`, Label custom required indicator, label elements in Field (P4-04); the new public types.
- **Changed:** behaviour (the InfoLabel popup's focusable content and Tab path; a SpinButton step button steps on click and repeats while held); visual (the focused invalid field's bottom border; SpinButton's 32px height; the InfoLabel popup's beak and width cap, the 24px info-button box, and its label text taking Label's type ramp and color); DOM (the data attributes; InfoLabel's `<label>`, its `id`, the note; the hidden description only while the note is closed; the Rating half-star structure with `step={0.5}`; Rating and RatingDisplay rendering `children`; Slider no longer rendering a numeric `size` attribute); types (`InputProps`, `SelectProps` and `SliderProps` omit the native `size` and declare their own; `RatingProps` and `RatingDisplayProps` narrow the inherited `color`; `typeof Rating` and `typeof RatingDisplay` gain `Item`; `WaveContextValue` gains `inputDefaults`; `InfoLabelProps.label` optional and `info` widened; `SpinButtonProps` gains `allowEmpty?: false` and has a sibling `SpinButtonAllowEmptyProps`).
- **Deprecated:** a numeric `size` on Input, Select and Slider (removed in 1.0, P14-02); InfoLabel `label` (use `children`; removed in 1.0).
- **Fixed:** SpinButton Shift+Home/End.
- **Size:** `dist/styles.css` and the Button-only, Input-only, Field-only and full-import sizes against 0.8.0 (measured in wave E, as 0.6 and 0.7 did).

### 5.2 README

- "Components": the rows of Input, Textarea, Select, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker, TimePicker (`size`, `appearance`), Checkbox, Switch, Slider (sizes), Field (`size`, label elements), Label (custom required indicator), Rating (half stars, colors, icons, `RatingItem`), InfoLabel (a real label, rich `info`, `openOnHover`), a new InfoButton row; the Provider row (`inputDefaults`).
- New usage note "Sizes and appearances": the unions and pixel sizes, the resolution order, `WaveProvider inputDefaults`, the filled appearances' guidance (`filled-darker` on the page background, `filled-lighter` on a surface other than the page background; no visible stroke, so a filled field needs a visible label, since a placeholder is not one; a boundary in forced colors and in the high-contrast theme), `htmlSize`, the `data-size`/`data-appearance` attributes for styling, and the choice-control sizes.
- "Forms and Field": Field `size`; `label={<InfoLabel …>}` and `label={<Label …>}`; the control is named by the label text alone.
- New notes for SpinButton (`displayValue`, `allowEmpty`, holding a step button, `precision`, full-width) and Rating (half stars, colors, icons, `RatingItem` children).
- "React Server Components" flat-name table: `RatingItem`, `InfoButton`.
- "Keyboard support": SpinButton (holding a step button with the pointer; Shift+Home/End select text); Rating (arrows move by `step`); InfoButton (keyboard focus opens it unless `openOnHover={false}`; Tab enters the note; Escape closes).
- "Built-in text": InfoButton's "Information" (`aria-label`; InfoLabel's `infoButtonLabel`); Rating's star names for half values (`labels.star`).
- "Theming": the "Color tokens" table and the token name list gain the three input tokens; the `useWaveTheme()` description gains `inputDefaults`.
- "Upgrading from 0.8": a short list pointing to the CHANGELOG.

### 5.3 CLAUDE.md

- "User docs": add this spec.
- Architecture: `src/components/input/inputLook.ts` (`useInputLook`) and `fieldLabel.ts` in the component-private helpers; `data-display/InfoButton.tsx`; `Popover.shared.tsx` is also used by InfoButton; `src/lib/styles.ts` lists the input maps; `src/lib/types.ts` lists `CoreSize` and `InputAppearance`.
- A convention line (in "Styling" or a new bullet under C-CLASS): text controls and pickers take `size?: CoreSize` and `appearance?: InputAppearance` from the recipe of `src/lib/styles.ts` and resolve them with `useInputLook` (own prop → Field `size` → `WaveProvider inputDefaults` → `medium`/`outline`); `data-size`, `data-appearance`, `data-shape` and `data-color` are enumerated attributes.
- C-NAMING: a component whose props extend native attributes with a numeric `size` that has an effect (Input, Select) omits it, adds `htmlSize`, and keeps a number as a deprecated value alias; where the native attribute has no effect (Slider) the number is only reported.
- Architecture: `pickerStyles.ts` lists `pickerIconButtonClasses`, `pickerButtonOffset`, `pickerEndPadding(buttons, size)` and `pickerGlyphSize`; Rating and RatingDisplay are compounds with `Item` (`RatingItem`).
- Testing: `renderWithFieldContext(ui, { size })`, `renderWithProviders(ui, { inputDefaults })`; press-and-hold tests (fake timers, pointer types); Rating half-star pointer tests (`mockRect`, `clientX`).

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md`: the color chapter's token table gains the three input tokens, and the `useWaveTheme()` shape gains `inputDefaults`; in the component-architecture chapter, a pattern for the input recipe (the maps, the two forms, the resolution hook, the data attributes); in the accessibility chapter, the SpinButton press-and-hold and empty value, Rating half stars (one target, two radios), and InfoButton's note (Tab path, focus staying on the button, the one-copy description).
- `docs/testing-best-practices.md`: resolution-order tests with the two helpers; press-and-hold with fake timers and pointer types; pointer positions for half stars; the InfoButton Tab path.

### 5.5 ROADMAP

- Status line: Phase 4 implemented on `feat/fluent-parity-phase-4` in parallel with Phase 3, unreleased; link this spec.
- §3 entry criteria: a phase that depends on no item of the phase before it may be designed and implemented in parallel with it, on its own branch; it merges after that phase, with that phase merged into its branch first and its gate run again (Phase 4 ran next to Phase 3).
- Phase 4 entries: note where the spec changed the sketches (D10 Slider's numeric `size`; D13 SpinButton `large` and its 32px height; D16 the interfaces instead of one union; D20 no default width change; D25 no single `icon`; D26 `RatingItem` as `Rating.Item`/`RatingDisplay.Item` without a provider; D28 InfoButton not on `Popover`, and `openOnHover` instead of the sketched `openOn` (the 0.7 hover vocabulary); D31 `children`, and the button named "‹label› Information" instead of the sketched "Information about ‹label›", which needs the label's plain text; D32 the marker).
- §8.3 "Intentional differences": a focused invalid field keeps its error color on the other borders (D4; Fluent hides it until blur); `displayValue` shows the plain number while editing (D15); press-and-hold for every pointer type, the first step on click (D18); Rating keys do not wrap (D23); `marigold` is the default color and unfilled stars keep one outline token (D24); no single `icon` (D25); InfoButton keeps focus on the button (D29); large fields pad 16px (D3); Textarea takes `underline` (§8 Q9).
- Backlog: `form-basic-12` stays (D2).

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

The checks of Phase 1 §0.2 rule 8 with clean output (no act() warnings; every `[WaveUI]` warning asserted). Every new behaviour has a test that failed first. The conventions gate and the stories gate are green for the package's files.

### 6.2 `verify-dist` probe (INTEGRATION)

| Check | Gate | Where |
|---|---|---|
| An import of only `Button` contains no Dialog code (0.5) and no presence core (0.7) | fails `verify-dist` | `probeTreeShaking` (unchanged) |
| An import of only `Field` contains no `InfoButton` module (D32) | fails `verify-dist` | `probeTreeShaking` with `keep: 'Field'`, `drop: 'InfoButton'` and `dropModules: ['components/data-display/InfoButton.mjs']` (the probe checks the listed modules exist, so `drop` alone could pass without checking anything) |
| Every new export has its flat name | fails `verify-dist --final` | `checkFlatExports` |
| `dist/styles.css`, Button-only, Input-only, Field-only and full-import sizes against 0.8.0 | reported in the CHANGELOG | measured once, in wave E |

Expectations to check in the report: the Input-only bundle grows by `inputLook.ts`, the recipe maps and WaveProvider's context module; `dist/styles.css` grows by the three tokens and the new size and appearance classes.

### 6.3 Final gate (waves M and E)

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`; the stories axe gate and the conventions gate green (after wave M, with P3-00's class-name rule); the lead checks every new story in the light, dark and high-contrast themes and in RTL (`/gate` runs the gate, `/browser-check` the checklist).

**Real-browser checklist** (jsdom has no forced colors, `:has()` layout, hit testing or real pointers). The lead checks these in Storybook in Chrome, Firefox and Safari, with Windows High Contrast and a touch device where noted, and names each result as exit evidence in the wave E report:
1. Every appearance at every size in the three themes and RTL; the `underline` and filled appearances keep a boundary in Windows High Contrast (and the filled ones in the high-contrast theme); focus and invalid borders on each appearance.
2. The small picker buttons and SearchBox's small clear button: the 24px hit area around the 20px box is clickable, the two picker buttons' areas do not overlap, a press on the text does not reach a button, and the hover fill stays inside the field's borders; the small Switch's 24px-tall target and the small Slider's 24px-tall input.
3. SpinButton press-and-hold with a mouse and on a touch device (no context menu, no text selection, the easing to 80 ms); `displayValue` switching to the number on focus, and a screen reader (NVDA or VoiceOver) reading `displayValue` as the value text.
4. Rating half stars: the pointer's half chosen in LTR and RTL, hover preview, the focus ring on the star when a hidden radio has focus.
5. InfoButton: hover opening and the safe zone, Tab into a link in the note and out again, Escape, the beak's placement near viewport edges, a screen reader reading "‹label› Information" and the description.

### 6.4 Existing tests expected to change (update, do not delete)

- `WaveProvider.test.tsx` (F4-foundation): the two runtime `toEqual` assertions of the context value and the type-level `toEqualTypeOf` of `WaveContextValue` gain `inputDefaults` (the last one fails the typecheck otherwise).
- `SpinButton.test.tsx` (P4-spin): assertions of the 0.7 `h-8 w-8` step buttons and the `h-8 w-12` input (D13, D20).
- `useFieldControl.test.tsx`, `test-utils.test.tsx` (F4-foundation): context shapes with `size` (new cases only where a shape is asserted exactly).
- Every test that asserts the invalid recipe's `focus:border-b-destructive` or `focus-within:border-b-destructive` class (the recipe tests, and the invalid-look assertions of the text controls and pickers): the focused bottom border is now the focus recipe's `primary` (D4); each owning package updates its own.
- `Input.test.tsx`, `Textarea.test.tsx`, `Select.test.tsx`, `SearchBox.test.tsx` (P4-text); `SpinButton.test.tsx` (P4-spin); `Combobox.test.tsx`, `Dropdown.test.tsx`, `DatePicker.test.tsx`, `TimePicker.test.tsx`, `TagPicker.test.tsx` (P4-pickers); `Checkbox.test.tsx`, `Switch.test.tsx`, `Slider.test.tsx` (P4-choice); `Rating.test.tsx` (P4-rating); `Field.test.tsx` (P4-labels): exact attribute sets gain the data attributes; class assertions at the defaults stay as they are.
- `InfoLabel.test.tsx` (P4-labels): the DOM (a `<label>`, `id` on it, the note instead of the `aria-hidden` popup, the beak, the description only while closed), the button's name ("‹label› Information" where tests queried "Information"), the `label` prop's warning in tests that keep using it.
- `src/__tests__/integration.test.tsx` and the stories gate (INTEGRATION): InfoLabel and Field compositions, exact attribute sets.
- `ColorPicker.test.tsx`, `RadioGroup.test.tsx`, `SwatchPicker.test.tsx`, `ProgressBar.test.tsx` (it renders Field): expected to stay green (they render none of the changed controls' defaults differently); a failure is reported to the lead, not fixed by a wave-B package.
- The 0.7 suites assert no exact attribute sets (no `getAttributeNames` or `outerHTML` equality), so the new data attributes break nothing by themselves; the real breakages are the invalid recipe, SpinButton's geometry, WaveProvider's shape, InfoLabel's DOM and name, and the two between-waves failures of §3.3.

### 6.5 Definition of done for Phase 4

Every item's tests pass; the gap ids of §7 are closed; the §6.2 probe passes; wave M is done (Phase 3 merged, P3-00's class names on the Phase 4 parts, the gate green); the CHANGELOG 0.9.0 section, README, CLAUDE.md and guides are updated; `docs/ROADMAP.md` marks Phase 4 as released when 0.9.0 ships; this spec's §10 records where the code deliberately differs from it.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `form-basic-10` | medium | P4-01 | F4-foundation (recipe) + P4-text (Input) |
| `form-basic-11` | medium | P4-01 | F4-foundation (recipe) + P4-text (Input) |
| `combobox-3` | medium | P4-01 | P4-pickers |
| `dropdown-3` | medium | P4-01 | P4-pickers |
| `tagpicker-7` | medium | P4-01 | P4-pickers |
| `datepicker-8` | medium | P4-01 | P4-pickers |
| `timepicker-7` | medium | P4-01 | P4-pickers |
| `form-basic-14` | low | P4-01 | P4-text (Textarea) |
| `form-basic-26` | low | P4-01 | P4-text (Select) |
| `form-basic-36` | low | P4-01 | P4-spin |
| `form-basic-38` | low | P4-01 | P4-text (SearchBox) |
| `form-basic-4` | low | P4-01 | F4-foundation (context) + P4-labels (Field) |
| `field-5` | low | P4-01 | P4-labels (Field; the duplicate of `form-basic-4`) |
| `foundation-4` | low | P4-01 | F4-foundation (`inputDefaults`) |
| `form-basic-31` | low | P4-01 | P4-choice (Slider) |
| `form-basic-18` | low | P4-01 | P4-choice (Checkbox) |
| `form-basic-23` | low | P4-01 | P4-choice (Switch) |
| `form-basic-32` | medium | P4-02 | P4-spin |
| `form-basic-33` | medium | P4-02 | P4-spin |
| `form-basic-34` | medium | P4-02 | P4-spin |
| `form-basic-35` | low | P4-02 | P4-spin |
| `form-basic-37` | low | P4-02 | P4-spin |
| `form-basic-39` | medium | P4-03 | P4-rating |
| `form-basic-40` | low | P4-03 | P4-rating |
| `form-basic-41` | low | P4-03 | P4-rating |
| `form-basic-46` | low | P4-03 | P4-rating |
| `form-basic-42` | low | P4-03 | P4-rating |
| `infolabel-1` | medium | P4-04 | P4-labels |
| `infolabel-2` | medium | P4-04 | P4-labels |
| `infolabel-3` | medium | P4-04 | P4-labels |
| `form-basic-6` | medium | P4-04 | P4-labels |
| `infolabel-4` | low | P4-04 | P4-labels |
| `infolabel-5` | low | P4-04 | P4-labels (`openOnHover={false}` and the beak; the portal stays, D28) |
| `form-basic-9` | low | P4-04 | P4-labels |

Totals: 0 high, 15 medium and 19 low gaps (the roadmap's 0 / 15 / 19). Every gap id the roadmap assigns to P4-01 … P4-04 appears exactly once above and in its item's "Closes" line.

---

## 8. Questions for the maintainer

Answered during the design (the rulings above apply them):

1. **Sequencing (D1).** Phase 3 is under way in another session. *Answer:* build Phase 4 in parallel on its own branch, keep 0.9.0, merge Phase 3 in when it lands (wave M), then merge.
2. **The recipe (D2).** Approach A (a class recipe over today's markup), B (always wrap, like Fluent) or C (data-attribute variants)? *Answer:* A.
3. **Filled appearances (D4).** Fluent's look (no visible stroke) or a 3:1 bottom stroke? *Answer:* Fluent's look, with a boundary in forced colors and in the high-contrast theme, and guidance in the docs.
4. **InfoLabel's label content (D31).** `children` with `label` deprecated, or keep `label`? *Answer:* `children`.
5. **Focus on opening the info popup (D29).** Keep it on the button, or move it into the note (Fluent)? *Answer:* keep it on the button.
6. **Sections 1–5 of the design** (scope and packages; P4-01; P4-02 and P4-03; P4-04; tests, docs and verification). *Answer:* approved.

Changed by the reviews after the design was approved (the rulings apply them; to confirm with the spec review):

- **`openOnHover` instead of `openOn` (D28, D29).** The design used the roadmap's `openOn?: 'click' | 'hover-focus'`; 0.7 fixed the hover vocabulary (`openOnHover`, C-NAMING), so the prop is `openOnHover?: boolean` (default `true`: hover and keyboard focus open it; `false`: only a click). The behaviour is the approved one.
- **A focused invalid field (D4).** The design kept 0.7's destructive bottom border while focused; the focused bottom border is now the focus color and the other borders stay destructive, because in 0.7 the only focus cue of an invalid Select or Dropdown was the border growing from 1px to 2px (WCAG 2.4.7). The error stays visible while it is corrected, except on `underline`, which has no other border.
- **SpinButton geometry and pressing (D13, D18).** It becomes 32px tall at medium like every other field (0.7: 34px), and a step button steps on click (the up-event, WCAG 2.5.2); holding it repeats from 300 ms.
- **Rating (D24, D26).** `Rating.Item` and `RatingDisplay.Item` (compound members) next to the flat `RatingItem`; `color` narrows the `color` HTML attribute the props inherited, as ProgressBar and CounterBadge did in 0.6.
- **InfoButton and InfoLabel details (D28–D31).** Keyboard focus keeps a note open against pointer movement; a focus restore never reopens it; the note's description comes from an unnamed wrapper; InfoLabel's label text takes Label's type ramp and color.

Open, with the spec's recommendation (the rulings assume it):

7. **SpinButton `large` (D13)**, beyond Fluent's two sizes. *Recommended:* yes; a large form should not have one control that cannot follow its size.
8. **Exported size aliases** (`TagPickerSize`, `CheckboxSize`, `CheckboxShape`, `SwitchSize`, `SliderSize`, `RatingColor`). *Recommended:* export them, as `SwatchPickerSize` and `CheckboxLabelPosition` are, since the public-types rule asks for every named type in a public signature.
9. **Textarea `underline`**, which Fluent's Textarea lacks. *Recommended:* keep the one `InputAppearance` union, so a provider default applies to every control (recorded in ROADMAP §8.3).
10. **InfoButton's placement**: the 0.7 top-centre placement, or Fluent's above-start? *Recommended:* the 0.7 placement (no visual change beyond the beak).

---

## 9. Review notes

Three reviews of the first draft (API conventions against CLAUDE.md; accessibility and behaviour against APG, WCAG 2.2 and the 0.7 overlay machinery; the code, sequencing and verification against the 0.7 source, Tailwind 4.3, tailwind-merge 3.7 and the scripts) were applied to this spec. The one blocker (SearchBox's small clear button, whose hit layer would have covered the whole field) and every major point were applied; several points were raised by two reviews. The points below were rejected, in full or in part, or applied in another form than proposed.

1. **A `controlRef` on InfoLabel** is **not added**: InfoLabel is a label, not a form control, so C-ROUTING's composite-control rule does not apply; a layout that needs the info button's element uses InfoButton next to a `Label` (D31).
2. **Slider's numeric `size`** is reported by a diagnostic `warnOnce` from an effect (`Slider:size-number`), not by `warnDeprecated`, whose message ("Use `x` instead") would name a replacement for something that never had an effect.
3. **The focused invalid look** is applied through the shared recipe for every appearance (D4), not with an extra `focusRing` on an `underline` Dropdown as one review offered: with the recipe change, a focused `underline` field shows the focus indicator alone, which is visible.
4. **The filled appearances' missing boundary** (WCAG 1.4.11) stays, as the maintainer decided (§8 Q3); the mitigations are applied: the docs require a visible label and name the right surfaces (the first draft's "a darker surface" was wrong in the dark theme, where `card` is lighter than `background`), `ring` joins the contrast pairs, and the picker buttons hover with `subtle-pressed` on `filled-darker`.
5. **SpinButton's geometry**: of the two options the reviews gave (keep the content-sized 26/34/42px root, or give the root the field height and fill it), the second is taken (D13), so every field of a size has one height; the 2px change at medium is an exception to §0.2 rule 14 and is in the CHANGELOG.
6. **Stepping from an empty SpinButton** keeps "0, then clamp" (the first valid value), where Fluent starts from `min`; the first draft's attribution to Fluent was wrong and is removed, and the difference goes into ROADMAP §8.3.
7. **A required empty SpinButton** is validated through the hidden input's `required` (one review's first option); showing no `displayValue` for an empty value (its second option) was not needed.
8. **Touch press-and-hold leaving the button**: `releasePointerCapture` on `pointerdown`, not hit-testing on `pointermove` (both were offered).
9. **The shared hit-area recipe** (`hitAreaLayer`, §1.2) is applied without `relative`, as the other review warned: `cn()` would replace the picker buttons' `absolute`.
10. **The step grid of Rating**: the keys snap an off-grid controlled value to the grid (applied); a development warning for a controlled value off the grid was not added (the keys and the tab stop now handle it).

---

## 10. Implementation notes

Added during implementation, recording where the 0.9.0 code deliberately differs from §0–§5 and why (as Phase 1 §9 and Phase 2 §10); they win where they disagree.
