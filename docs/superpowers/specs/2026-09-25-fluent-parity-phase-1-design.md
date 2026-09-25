# WaveUI 0.6.0 — Fluent Parity Phase 1 Design (quick wins)

> Date: 2026-09-25 · Branch: `feat/fluent-parity` · Package: `@mortenbrudvik/waveui` 0.5.0 → **0.6.0**
> Scope: Phase 1 of [`docs/ROADMAP.md`](../../ROADMAP.md): the foundation item P1-00 and the 25 items P1-01 … P1-25. They close 34 medium and 14 low gaps of the Fluent UI v9 comparison and mitigate two more (`taggroup-1`, `badge-1`).
> Inputs: [`docs/research/fluent-ui-v9-comparison.md`](../../research/fluent-ui-v9-comparison.md) (section 7 "Quick wins") and its gap list (ids such as `buttons-3`). Every API below was checked against the 0.5.0 source it changes.
> Status: implementation contract for parallel agents, revised after three reviews (§8 lists the review points not applied and why). Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). Implemented in 0.6.0; §9 records where the code deliberately differs from the text above, and wins where they disagree.

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F1-foundation` | shared types, the `focusableDisabledProps` option, roving and Field context changes, the Field test harness, the contrast pairs, and Badge's new colors with the shared color module (D23) | P1-00, P1-13 | wave A |
| `P1-buttons` | `src/components/button/*`, in the order P1-05 → P1-01 → P1-04 → P1-02, P1-03 | P1-01 … P1-05 | wave B |
| `P1-form` | Field, Checkbox, Switch, RadioGroup, Slider, Rating, one expression of ColorPicker | P1-06 … P1-10 | wave B |
| `P1-pickers` | Combobox, Dropdown, TimePicker, a shared picker class module | P1-11, P1-12 | wave B |
| `P1-display` | CounterBadge, Tag | P1-14, P1-15 | wave B |
| `P1-feedback` | Spinner, ProgressBar, Toast/Toaster | P1-16 … P1-18 | wave B |
| `P1-overlays` | Dialog, Drawer, Tooltip | P1-19 … P1-22 | wave B |
| `P1-navigation` | Menu, Nav, TabList | P1-23 … P1-25 | wave B |
| `INTEGRATION` | barrels, cross-package tests, public type tests, story import normalisation | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP status | — | wave D |

§3 lists the exact files of each package. File ownership is disjoint.

### 0.2 Ground rules for every agent

The 0.5 ground rules (`2026-09-23-review-fixes-design.md` §0.2) apply unchanged. In short:

1. **Own your files only.** Read anything; edit only the files §3 gives your package. An unplanned file goes in your component folder with a component-prefixed name and is reported.
2. **Barrels are INTEGRATION's.** Never edit `src/index.ts` or `src/components/*/index.ts`. Stories and tests import new symbols from their module path during wave B; list the exports you need under "Barrel requests" in your report.
3. **TDD.** Every behaviour starts with a failing test. Existing tests that encode the old behaviour are **updated, not deleted** (§6.3 lists the known ones).
4. **Backward compatible.** Nothing public is removed or narrowed. Behaviour, DOM and type changes that are not additions are listed in §5 and go into the CHANGELOG.
5. **Conventions gate and stories gate** stay green for your files (`src/__tests__/conventions.test.ts -t "<file>"`, `src/__tests__/stories.a11y.test.tsx -t "<story title>"`).
6. **No git write commands, no `npm install`, no repo-wide fixers.** Auto-fixers only on your own paths. The lead commits per package (conventional-commit subject, no AI attribution trailer).
7. **Foundation is not forked.** If F1 lacks something, file a change request with a failing test and continue with other work.
8. **Verification before you report done:** `npx vitest run <your test files> --reporter=default` (clean output: no act() warnings, every `[WaveUI]` warning asserted, R14), the conventions and stories gates for your files, `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.dev.json --noEmit` filtered to your paths, `npx eslint <your files>`, `npx prettier --check <your files>`.
9. **Wave-B tests use only F1 and your own files.** A wave-B test never renders another wave-B package's new API (Field `validationState`, `MenuButton disabledFocusable`, …): it uses `renderWithFieldContext` or a plain element with the same attributes instead. The case with the real component goes to INTEGRATION (§4.5), which runs after every package has landed.
10. **Stories declare new argTypes locally** (in the story file). Only F1 edits `stories/_helpers.ts` (the Badge colors, wave A); INTEGRATION may move local argTypes into it in wave C.

### 0.3 Design rulings

Binding for every package. Each ruling records why.

- **D1 — Badge `important` is not remapped in 0.6.** 0.6 adds `severe` (the orange look `important` has today) and `subtle`. `important` keeps its 0.5 look through 0.x; its JSDoc, the CHANGELOG "Deprecated" section and the README say it becomes Fluent's neutral high-emphasis color in 1.0 (ROADMAP P14-05) and that `severe` keeps the orange look. **No runtime warning in 0.6:** a consumer who wants the future neutral meaning could not silence it. The last 0.x minor before 1.0 adds a one-time development warning (ROADMAP P13-03, 0.18.0). *Why:* the remap changes what existing code shows without a type error; the roadmap's compatibility rule allows meaning changes only in 1.0.
- **D2 — `disabledFocusable` semantics.** The control renders `aria-disabled="true"`, `data-disabled=""` and `data-disabled-focusable=""` instead of the native `disabled` attribute and stays in the tab order. Activation (click, Enter, Space, implicit form submission) is prevented; the consumer's `onClick` is not called and the click does not reach ancestor click handlers (as for a native disabled button). Hover and pressed colors are off (the existing `not-aria-disabled` gate); focus, hover and pointer events other than activation still reach the element, so a Tooltip works. With both `disabled` and `disabledFocusable`, `disabledFocusable` wins (Fluent parity). A consumer `aria-disabled="true"` **without** `disabledFocusable` keeps its 0.5 meaning (look only, handlers run) — `disabledFocusable` is the supported way. *Why:* APG recommends focusable disabled items in toolbars and for self-disabling controls; changing the meaning of a consumer `aria-disabled` would change 0.5 behaviour silently.
- **D3 — `data-disabled-focusable` joins the roving order.** `useRovingTabIndex` treats an item with `data-disabled-focusable` as enabled (reachable by arrows, Home/End, typeahead; may hold the tab stop). The attribute only exempts an item from the `aria-disabled` check: `data-roving-disabled` (a composite's own marker) and native `disabled` still win, and every other `aria-disabled` item is still skipped. The order is fixed in §1.3. *Why:* Toolbar (buttons-21) needs it; keying it on a dedicated attribute leaves every existing composite (Menu, TabList, Tree, RadioGroup) unchanged.
- **D4 — A Link (or `Button as="a"`) without `href` keeps its `<a>` element and gets button semantics** (`role="button"`, `tabIndex={0}`, Enter on key down, Space on key up), instead of Fluent's switch to `<button type="button">`. The same applies to a non-interactive intrinsic `as` (`span`, `div`). *Why:* `LinkProps` types `ref` and event handlers for `HTMLAnchorElement`; rendering a `<button>` would make those types lie, break callback refs typed for anchors and change the element consumers' CSS targets. The ARIA result is equivalent.
- **D5 — Field keeps `error` and adds Fluent's validation API.** New `validationState`, `validationMessage`, `validationMessageIcon`. `error` stays (not deprecated): it is the shorthand for an error message and matches the control-level `error` of Input, Select and Textarea (a WaveUI strength). When `error` is set (renders content or is `true`) it wins, and a development warning fires if `validationMessage` or a non-error `validationState` is also set. *Why:* Fluent names by default (lead ruling) without breaking the 0.5 API.
- **D6 — The Field hint stays visible while a message shows**, rendered after the message (Fluent order), and error messages get an icon by default. Both are visible changes (CHANGELOG "Changed"); `validationMessageIcon={null}` restores the 0.5 look of the message. *Why:* the 0.5 behaviour hid a password-rules hint exactly when the rule was broken (form-basic-5).
- **D7 — Tooltip's controlled state uses C-NAMING:** `open`/`defaultOpen`/`onOpenChange`, not Fluent's `visible`/`onVisibleChange`. The JSDoc names the Fluent equivalent. Tooltip's `onOpenChange` has no `details` argument in 0.6: under D9 a later optional `details?: OpenChangeDetails<…>` (reasons such as `'hover' | 'focus' | 'escape' | 'blur' | 'leave'`) is a non-breaking addition, so it waits for a request instead of widening Phase 1. *Why:* C-NAMING fixes open-state names for every overlay; Fluent names apply only where they fit the conventions.
- **D8 — TabList `selectTabOnFocus` keeps the 0.5 default.** Fluent's prop name, WaveUI default `true` (automatic activation, as in 0.5); Fluent's default is `false`. *Why:* backward compatibility; the name makes ported Fluent code with an explicit value behave identically.
- **D9 — Dialog and Drawer close reasons go in a second, optional `details` argument:** `onOpenChange?: (open: boolean, details?: DialogOpenChangeDetails) => void`. The first argument stays the value (C-NAMING); a `(open) => void` handler still type-checks. WaveUI always passes `details`; the parameter is typed optional through 0.x so that code which *calls* the prop (a wrapper forwarding `props.onOpenChange?.(false)`, a custom Cancel button) keeps compiling. It becomes required in 1.0 (ROADMAP P14-02); handlers written with `details?.reason` keep compiling then. Shared types live in `src/lib/types.ts` (§1.1): `OpenChangeDetails<R>` (`{ reason: R; event: Event }`), `ModalOpenChangeReason = 'trigger' | 'close' | 'close-button' | 'escape' | 'outside-press'` (the last two are `DismissReason` members of `src/lib/layers.ts`; `'focus-outside'` joins when non-modal surfaces ship) and `ModalType = 'modal' | 'alert'` (`'non-modal'` joins in 0.11, ROADMAP P6-06; widening). Menu, Popover and Tooltip reuse `OpenChangeDetails` later. *Why:* Fluent's `(event, data)` order would break every 0.5 handler, and a required parameter would narrow what callers may do (ROADMAP principle 2).
- **D10 — `Dialog.Footer` is made sticky inside the scrolling body instead of being hoisted out of it.** The footer stays where the consumer rendered it (a `<form>` wrapping content and footer keeps working), sticks to the bottom of the scroll area with an opaque background, and the body's `scroll-padding-bottom` follows the footer's measured height so a focused field is never hidden behind it (WCAG 2.4.11). *Why:* hoisting only direct children would miss the most common case (a form around body and footer) and would change DOM order.
- **D11 — TimePicker adopts DatePicker's keep-and-flag model** for rejected text: kept, `aria-invalid`, an error message, `onInvalidInput` once per edit. Blur no longer reverts invalid text (CHANGELOG "Changed"). Its message labels have DatePicker's shapes: `invalidTime(format)` mirrors `invalidDate(pattern)`, and `outOfRange(min, max)` takes the same `string | undefined` bounds. *Why:* consistency with DatePicker and with the 0.5 ColorPicker hex ruling; a silent revert loses the user's input; localizers get one shape for both pickers.
- **D12 — RatingDisplay shows its value only on request** (`showValue`), while Fluent renders it by default. *Why:* no visual change for 0.5 users; `compact` and `count` imply the value text.
- **D13 — CounterBadge shares Badge's palette** (`color?: BadgeColor`, a superset of Fluent's four CounterBadge colors) through one color module, so `important` means the same in both until 1.0. A Badge or CounterBadge with `aria-label` or `aria-labelledby` gets `role="img"` by default, before `{...rest}` (a naming attribute on a role-less `<span>` is not announced and fails axe); both components follow the same rule.
- **D14 — Combobox and TimePicker show a chevron by default** (Fluent parity, combobox-4; TimePicker is a combobox too, so the family looks alike in one release): an APG "open" button with `tabIndex={-1}` that toggles the list and keeps focus in the input. `expandIcon` follows the indicator rule of D21 (`false` hides it, `null` keeps it). The clear button of Combobox and Dropdown is a real tab stop, as DatePicker's, TimePicker's and SearchBox's are, and follows their visibility rule: rendered while `clearable`, a value is set and the picker is not `readOnly`; while `disabled` it renders natively disabled (DatePicker.tsx, TimePicker.tsx). *Why:* a combobox with no visual affordance was the reported gap; the tab stop and visibility rules follow the existing WaveUI pickers.
- **D15 — ProgressBar `color="warning"` fills with the `severe` token (dark orange, Fluent's choice)**, because the `warning` fill (#fde300) is 1.02:1 against the light track. Every fill is asserted at 3:1 against `track` in `tokens.test.ts` (estimated from the 0.5 token values: success about 4.1/4.3/5.6, error about 4.6/4.6/3.1, severe about 3.5/3.7/3.6 in light/dark/high contrast; F1 records the exact ratios).
- **D16 — Spinner `appearance="inverted"` draws in `currentColor`** (arc `currentColor`, track `currentColor` at 30%, visible label `currentColor`), so it matches any surface it sits on: the on-brand text inside a primary Button, the inverted foreground on an inverted surface. No new tokens.
- **D17 — Queued toasts do not exist for users yet:** with `limit`, a toast beyond it is not rendered, not announced and its timer does not run until it becomes visible. Lowering `limit` never hides a toast already shown.
- **D18 — A collapsed Nav category that contains the current page gets `aria-current="true"`** (not Fluent's `"page"`): the toggle button is not the page's link. It also gets the selected look and `data-contains-current`. The hint prop for sub-items Nav cannot find is `currentCategory`, not Fluent's `selectedCategoryValue`: 0.5 deprecated Nav's `selected*` prefix (`selectedValue` → `value`), and Fluent's prop is controllable state (with `defaultSelectedCategoryValue`) while this one is a one-way hint, so the Fluent name would promise behaviour it does not have. The JSDoc names the Fluent prop.
- **D19 — Menu.Trigger ignores activation from an `aria-disabled="true"` element** (click, Enter, Space, ArrowDown, ArrowUp), so a `disabledFocusable` MenuButton or SplitButton never opens its menu. The check looks at the event's target and its ancestors up to and including the element that carries the handlers, so it also works when `Menu.Trigger` falls back to a wrapper `<span>` (`asChild={false}`, or a child that does not attach the ref), where `currentTarget` is the span and not the disabled button inside it. This is Fluent's MenuTrigger behaviour and completes D2 for keys Button itself does not block.
- **D20 — Choice-control labels become `ReactNode`, `children` still are not the label.** Checkbox, Switch and `RadioGroup.Item` widen `label` to `React.ReactNode` (non-breaking); children stay unrendered and now warn in development instead of being dropped silently. *Why:* `label` is already the documented API; making children a second label source would conflict with it.
- **D21 — One rule per kind of default-glyph slot** (written into CLAUDE.md C-SLOTS by DOCS, §5.3; later phases use it for every new slot):
  - *Optional indicator glyphs* (`MenuButton.menuIcon` in 0.5; Combobox and TimePicker `expandIcon` in 0.6; Dropdown, TagPicker and Tree `expandIcon` later): `null`/`undefined` keep the default glyph; `false` or any value that renders nothing (`true`, `''`, an empty array or Fragment) hides it.
  - *Required indicator glyphs* (`SplitButton.menuIcon`): the menu half always shows an indicator. `null`/`undefined` keep the default; a value that renders nothing also keeps it and logs a one-time development warning from an effect (`SplitButton:menuIcon-empty`). The JSDoc says: "Unlike `MenuButton.menuIcon`, a value that renders nothing does not hide the indicator."
  - *Status icons* (`MessageBar.icon` in 0.5; Field `validationMessageIcon` in 0.6; Toast `icon` later): only `undefined` keeps the default; `null` or a value that renders nothing shows no icon.
  - Glyph slots that render inside a wired button (`expandIcon`) are decorative content (`aria-hidden`). A `<button>` or `Button` element passed there is never nested: its children become the glyph, its props are dropped, and a one-time development warning names the slot. (Dismiss and clear slots keep the 0.5 merge rule of C-SLOTS.)
  *Why:* three slots added in one release read `false` and `null` in three ways in the first draft; the MenuButton rule already exists and is the one to extend.
- **D22 — `data-*` state attributes:** enumerated ones are always rendered with the resolved value (`data-orientation="vertical"`, `data-appearance="primary"`, `data-color="brand"`, `data-label-position="after"`, `data-validation-state="none"`, `data-modal-type="modal"`, `data-state="shown"`), as Stepper's `data-orientation` already is; boolean ones are present (`=""`) or absent (`data-dot`, `data-compact`, `data-contains-current`, `data-disabled-focusable`). Written into CLAUDE.md C-CLASS by DOCS. *Why:* consumers can only write `[data-orientation=vertical]` selectors when the attribute is always there.
- **D23 — F1 implements P1-13 (Badge `severe` and `subtle`).** `Badge.tsx` types its color map as `Record<BadgeColor, …>`, so widening `BadgeColor` in `src/lib/types.ts` without the map breaks the library program. F1 therefore owns both halves: the union in `types.ts`, the new shared `Badge.colors.ts` and the Badge changes of P1-13 (with its tests, stories and the `badgeColors` list of `stories/_helpers.ts`). P1-display keeps CounterBadge (P1-14, which imports the color module F1 has landed) and Tag. *Why:* one owner for both halves of one change keeps every wave green, no file is owned by two packages, and P1-14's dependency on P1-13 is met before wave B starts.

### 0.4 Out of scope for 0.6

Everything else in the roadmap. In particular: sizes and appearances of inputs (P4-01), Menu checkable items and submenus (Phase 2), the presence core (P2-00), rich toasts (Phase 3), TagGroup (P6-02, which closes `taggroup-1`), non-modal dialogs and drawer sizes (P6-05, P6-06), motion on components (Phase 10), Tooltip `onOpenChange` details (D7), and every backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation (F1-foundation, wave A) — P1-00 and P1-13

Lands first; every wave-B package builds on it. P1-00 changes no behaviour for existing consumers. F1 also implements P1-13 (Badge `severe` and `subtle`, specified in §2 with the other items), because widening `BadgeColor` and Badge's color map must land together (D23).

### 1.1 `src/lib/types.ts`

```ts
/** Where an icon renders relative to a label: the inline start (`before`) or end (`after`). */
export type IconPosition = 'before' | 'after';

/**
 * Validation state of a Field message: `error` (invalid; `role="alert"`), `warning`
 * (`role="alert"`, not invalid), `success`, or `none` (a neutral message).
 */
export type ValidationState = 'none' | 'error' | 'warning' | 'success';

/**
 * Where a label renders relative to its control or indicator. Components accept a subset,
 * derived with `Extract<LabelPosition, …>` (never `Exclude<>`, so a later value does not widen
 * them silently): Checkbox `'before' | 'after'`, Switch `'before' | 'after' | 'above'`.
 */
export type LabelPosition = 'before' | 'after' | 'above' | 'below';

/** Second argument of an `onOpenChange` callback: why the open state changes, and the event. */
export interface OpenChangeDetails<R extends string = string> {
  /** What asked for the change. */
  reason: R;
  /** The DOM event behind the request. */
  event: Event;
}

/**
 * Why a Dialog or Drawer asks to open or close: `trigger` (its Trigger part), `close` (a
 * `.Close` part), `close-button` (the built-in Close button), `escape`, `outside-press` (the
 * backdrop). The last two are `DismissReason` values of the dismiss-layer stack.
 */
export type ModalOpenChangeReason = 'trigger' | 'close' | 'close-button' | 'escape' | 'outside-press';

/** How a modal surface blocks the page (`'non-modal'` joins in a later release). */
export type ModalType = 'modal' | 'alert';
```

`BadgeColor` is widened here too, by P1-13 (§2, D23). `src/index.ts` already re-exports every type of this module (`export type * from './lib/types'`), so the new types are public without barrel changes. `types.test.ts` gets `expectTypeOf` checks for the new unions and interface, and a check that `Exclude<DismissReason, 'focus-outside'>` (imported from `src/lib/layers.ts`) is assignable to `ModalOpenChangeReason`, so the two cannot drift apart.

### 1.2 `src/lib/aria.ts`

One helper with an option, instead of a second helper with a near-anagram name:

```ts
export interface FocusableDisabledProps {
  'aria-disabled'?: true;
  'data-disabled'?: '';
  /** Only with `reachable: true`. */
  'data-disabled-focusable'?: '';
}

export interface FocusableDisabledOptions {
  /**
   * Also renders `data-disabled-focusable`, which keeps the control in a roving container's
   * arrow-key order (D3): for the `disabledFocusable` prop of buttons, links and choice controls.
   * Leave it off for controls that disable themselves through their own activation (C-DISABLED),
   * which a composite must skip.
   * @default false
   */
  reachable?: boolean;
}

/**
 * `aria-disabled` and `data-disabled` for a focusable disabled control, plus
 * `data-disabled-focusable` with `{ reachable: true }`. Returns `{}` when `disabled` is falsy.
 * Guard handlers with {@link preventIfDisabled}.
 */
export function focusableDisabledProps(
  disabled?: boolean,
  options?: FocusableDisabledOptions,
): FocusableDisabledProps;
```

Existing callers (Pagination, Carousel, TeachingPopover) pass no option and are unchanged. Tests in `aria.test.ts`: the three attribute sets (disabled, disabled + reachable, enabled).

### 1.3 `src/hooks/useRovingTabIndex.ts` (D3)

- `isDisabledElement(el)` checks, in this order: `data-roving-disabled` (not `"false"`) → skip; native `disabled` property or `:disabled` → skip; `data-disabled-focusable` present → keep (reachable); `aria-disabled="true"` → skip; otherwise keep. (0.5 checks `aria-disabled` before native `disabled`; both skip, so moving the native check up changes nothing for existing items.)
- JSDoc of `UseRovingTabIndexOptions` and of the hook: "Items marked `data-disabled-focusable` (the `disabledFocusable` prop of WaveUI buttons, links and choice controls) stay reachable and may hold the tab stop: APG allows focusable disabled items."
- `data-disabled-focusable` joins `OBSERVED_ATTRIBUTES`, so toggling it restamps tab indexes.
- Tests (`useRovingTabIndex.test.tsx`): arrows land on a `data-disabled-focusable` + `aria-disabled` item; Home/End and typeahead include it; it can hold the tab stop (`tabStop: 'last-focused'` and `'active'`); a natively disabled item with the attribute is still skipped; an item with both `data-roving-disabled` and `data-disabled-focusable` is still skipped; toggling the attribute is observed.

### 1.4 `src/hooks/useFieldControl.ts`

```ts
export interface FieldContextValue {
  // … 0.5 members unchanged …
  /**
   * The Field's validation state (`validationState`, or `'error'` from `error`). Absent in
   * contexts built before 0.6: read it as `invalid ? 'error' : 'none'`.
   */
  validationState?: ValidationState;
  /**
   * The id of the rendered validation message in any state (error, warning, success, neutral).
   * `errorId` is set only while that message is an error.
   */
  validationMessageId?: string;
}
```

- `useFieldControl` builds `aria-describedby` from the consumer's ids, then `field.validationMessageId ?? field.errorId`, then `field.hintId` (deduplicated). `aria-invalid` still comes from `field.invalid`, which Field sets only for the error state.
- Tests (`useFieldControl.test.tsx`): a warning message describes the control without `aria-invalid`; a 0.5-shaped context (no new members) behaves as before.

### 1.5 `src/test-utils-field.tsx`

The harness renders what Field renders, in Field's order, so wave-B packages can test every validation state without the real Field (§0.2 rule 9):

- `FIELD_TEST_IDS.messageId = 'wave-test-field-message'`; `FIELD_TEST_TEXT.message = 'Field message'`.
- `RenderWithFieldContextOptions.message?: React.ReactNode` (default `FIELD_TEST_TEXT.message`).
- `resolveFieldTestContext` passes `validationState` and `validationMessageId` through. Defaults: `validationState` = `'error'` when `errorId` is given, else `undefined`; `invalid` = `hasErrorMessage` = (`validationState ?? (errorId ? 'error' : undefined)`) `=== 'error'` (so a `'warning'` context is not invalid); `validationMessageId` stays `undefined` unless given (a context with only `errorId` keeps its 0.5 shape).
- `FieldHarness` renders, after the control: the error `<p id={errorId} role="alert">` (when `errorId` is set); then, when `validationMessageId` is set and differs from `errorId`, `<p id={validationMessageId} role={state === 'error' || state === 'warning' ? 'alert' : undefined}>{message}</p>`; then the hint `<p id={hintId}>` (the message before the hint, as Field renders them from 0.6; 0.5 rendered the hint first).
- JSDoc updated (it is the source of truth for helper signatures). The helper tests in `src/__tests__/test-utils.test.tsx` cover: a warning context renders the message element and describes a control without `aria-invalid`; a success context renders it without `role`; the element order; a 0.5-shaped call (`{ errorId }`) resolves as before.

### 1.6 `src/styles/__tests__/tokens.test.ts` (D15)

Add the non-text pairs `['success', 'track', 3]`, `['error', 'track', 3]`, `['severe', 'track', 3]` next to `['primary', 'track', 3]`, and their tabled ratios (light, dark, high contrast) next to `['primary', 'track', [4.08, 4.48, 5.78]]`. Estimates: success about 4.1/4.3/5.6, error about 4.6/4.6/3.1, severe about 3.5/3.7/3.6; record the values the test computes. If a pair fails in a theme, stop and file a change request (the ProgressBar color map of P1-17 then changes, not the token). Add the text pairs of the Field messages (P1-06), which sit on the page and on cards: `['warning-tint-foreground', 'background', 4.5]`, `['warning-tint-foreground', 'card', 4.5]`, `['success-tint-foreground', 'background', 4.5]`, `['success-tint-foreground', 'card', 4.5]` (estimates on `background`: warning 6.7/11.2/19.6, success 6.3/5.3/14.0; `error` and `muted-foreground` on both surfaces are asserted already). No token value changes. Badge `subtle` and `severe` use pairs the matrix already asserts (`foreground`/`background`, `muted-foreground`/`background`, `severe-foreground`/`severe`, `severe-tint-foreground`/`severe-tint`).

### 1.7 Exit criteria of wave A

Full `npx vitest run` green (report any failure outside F1's files to the lead); `npm run typecheck` clean (the library program included: the `BadgeColor` widening lands with Badge's map, D23); the lead commits F1 before wave B starts.

---

## 2. Items

Each item gives: gaps closed, public API (with JSDoc outline and `data-*` state), behaviour (keyboard, focus, ARIA, SSR, RTL, forced colors, motion), files, tests, stories, docs notes and compatibility. "Docs" lines are input for the DOCS package (§3), which writes the final text.

### P1-01 — `iconPosition` on the button family (P1-buttons)

- **Closes:** `buttons-2`.
- **API.** `iconPosition?: IconPosition` on `ButtonOwnProps`, `ToggleButtonProps`, `CompoundButtonOwnProps` (P1-02) and `SplitButtonProps` (P1-03, primary half). Not on MenuButton (its end holds the menu indicator; Fluent omits it too).
  ```ts
  /**
   * Where the icon renders: before the label (the inline start) or after it (the inline end, e.g.
   * an "open in new window" glyph). Follows the writing direction through DOM order. Has no effect
   * on an icon-only button.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  ```
- **Behaviour.** Button renders `{label}{icon}` instead of `{icon}{label}` for `'after'`; the `gap-1.5` rule, icon-only detection and the icon-only name warning are unchanged. No new `data-*` (not state).
- **RTL.** Logical by DOM order; no physical classes.
- **Files.** `Button.tsx`, `ToggleButton.tsx` (typing only; it spreads to Button).
- **Tests** (`Button.test.tsx`, `ToggleButton.test.tsx`): the `aria-hidden` icon span is the last child for `'after'` and the first for `'before'`; icon-only with `'after'` renders one child and keeps the square sizing; under `renderWithProviders(ui, { dir: 'rtl' })` the DOM order is the same; type test `expectTypeOf<ButtonProps['iconPosition']>().toEqualTypeOf<IconPosition | undefined>()`; `@ts-expect-error` for `iconPosition="end"`.
- **Stories.** `Button.stories.tsx`: `IconAfter` ("Open in new window" with a trailing icon). `ToggleButton.stories.tsx`: add `iconPosition` to an existing icon story's args.
- **Docs.** README "Buttons": one bullet. CHANGELOG Added.
- **Compatibility.** Additive.

### P1-02 — Typed `icon` on CompoundButton (P1-buttons)

- **Closes:** `buttons-6`.
- **API.**
  ```ts
  export interface CompoundButtonOwnProps {
    secondaryText?: React.ReactNode;
    appearance?: Appearance;
    size?: Size;
    disabled?: boolean;
    /**
     * Marks the button unavailable but keeps it focusable and in the tab order (for a Tooltip
     * that explains why, or a toolbar). Renders `aria-disabled="true"`, `data-disabled` and
     * `data-disabled-focusable` instead of the native `disabled` attribute; clicks, Enter, Space
     * and implicit form submission are prevented, and your `onClick` is not called. Wins over
     * `disabled` when both are set. In a `Toolbar` it stays in the arrow-key order.
     * @default false
     */
    disabledFocusable?: boolean;
    /**
     * Icon shown beside the two lines of text, in a 40px box (32px at `small`, 24px at
     * `extra-small`) whose SVG fills it. Decorative (`aria-hidden`). A CompoundButton with only an
     * icon (no label, no `secondaryText`) is an icon-only button: it looks and is checked like an
     * icon-only `Button` and needs `aria-label`, `aria-labelledby` or `title`.
     */
    icon?: Slot<'span'>;
    /**
     * Where the icon renders: before the text column (the inline start) or after it (the inline
     * end). Follows the writing direction through DOM order. Has no effect without an icon or on
     * an icon-only button.
     * @default 'before'
     */
    iconPosition?: IconPosition;
  }
  ```
- **Behaviour and DOM.** Two layouts, chosen by what renders (`slotRendersContent` of `children` and `secondaryText`):
  - **With text** (children or `secondaryText` renders content): the text lines are wrapped in `<span data-wave-compound-content="" class="flex min-w-0 flex-col items-start">`. The root classes become `h-auto items-center justify-start gap-3 text-start` plus the size padding (the 0.5 `flex-col items-start` moves to the wrapper), so a CompoundButton without an icon looks as in 0.5. With an icon, CompoundButton renders the icon itself (`renderSlot(icon, 'span', 'inline-flex shrink-0 items-center justify-center [&>svg]:size-full ' + iconBox[size], { 'aria-hidden': true })`) before or after the wrapper, and passes no `icon` to Button.
  - **Icon-only** (neither renders content): no wrapper and none of the compound layout or padding classes (`h-auto`, `gap-3`, `justify-start`, `paddingClasses[size]`); `icon` and `iconPosition` go to Button, so Button's icon-only detection (`hasLabel` is false only without a wrapper), square sizing and name warning apply unchanged.
  - `iconBox`: `extra-small` `size-6`, `small` `size-8`, `medium`/`large`/`extra-large` `size-10`.
- **Files.** `CompoundButton.tsx`.
- **Tests** (`CompoundButton.test.tsx`): icon beside the wrapper in both positions; the accessible name is the main text plus the secondary text; icon-only renders no wrapper and has the same size classes as an icon-only `Button` of the same `size`, warns without a name (spy asserted) and is named with `aria-label`; `testSystemProps` still passes (polymorphic, `as="a"`); RTL DOM order; axe with an icon.
- **Stories.** `CompoundButton.stories.tsx`: `WithIcon`, `IconAfter`.
- **Docs.** CHANGELOG Added; CHANGELOG Changed (DOM): "CompoundButton wraps its text lines in a `span[data-wave-compound-content]`".
- **Compatibility.** Additive; DOM change noted.

### P1-03 — SplitButton `icon`, `iconPosition`, `menuIcon` (P1-buttons)

- **Closes:** `buttons-13`.
- **API** (on `SplitButtonProps`):
  ```ts
  /** Icon of the primary action, decorative (`aria-hidden`). For an icon-only primary action pass
   *  `primaryActionButtonProps={{ 'aria-label': '…' }}`. */
  icon?: Slot<'span'>;
  /**
   * Where the primary action's icon renders: before its label (the inline start) or after it.
   * Has no effect on an icon-only primary action. The menu half is not affected.
   * @default 'before'
   */
  iconPosition?: IconPosition;
  /**
   * Replaces the chevron of the menu half (decorative, `aria-hidden`). The menu half always shows
   * an indicator: `null` and `undefined` keep the default chevron, and so does a value that renders
   * nothing (`false`, `''`, an empty array), which also logs a development warning. Unlike
   * `MenuButton.menuIcon`, a value that renders nothing does not hide the indicator.
   */
  menuIcon?: Slot<'span'>;
  /**
   * Makes both halves unavailable but focusable (see `Button.disabledFocusable`): each half
   * renders `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable`, stays in the tab
   * order, and neither `onClick` nor the menu opens. A half's own `disabledFocusable` (in
   * `primaryActionButtonProps`/`menuButtonProps`) affects only that half. For each half,
   * focusable-disabled wins over natively disabled: the half is focusable-disabled when the root's
   * or its own `disabledFocusable` is set; otherwise it is natively disabled when the root's or its
   * own `disabled` is set.
   * @default false
   */
  disabledFocusable?: boolean;
  ```
  `SplitButtonMenuButtonProps` (and the primary alias) gain `disabledFocusable?: boolean` with a JSDoc that points to this rule.
- **Behaviour.** The primary Button gets `icon`/`iconPosition`. The menu Button's `icon` is `slotRendersContent(menuIcon) ? menuIcon : <ChevronDownIcon />` (the 0.5 hard-coded chevron could not be replaced); when `menuIcon` is neither nullish nor renders content, an effect calls `warnOnce('SplitButton:menuIcon-empty', …)` (D21). Sizing rules (`menuButtonSizeClasses`) unchanged; the menu half keeps its 24px target and its `aria-label`.
- **Guards** (WaveUI strength "SplitButton routes props to the right half"): the 0.5 routing tests of `SplitButton.test.tsx` stay green unchanged.
- **Files.** `SplitButton.tsx`.
- **Tests** (`SplitButton.test.tsx`): custom `menuIcon` rendered `aria-hidden` inside the menu half; `menuIcon={null}` keeps the chevron without a warning; `menuIcon={false}` keeps the chevron and warns once (spy asserted), the opposite of `MenuButton` with the same value (asserted side by side); `icon` on the primary half with both positions; icon-only primary named through `primaryActionButtonProps`; `disabledFocusable` cascades (both halves focusable, `aria-disabled`, no `onClick`/`onMenuClick`); a half's own `disabledFocusable` affects only it; root `disabled` + a half's `disabledFocusable` makes that half focusable-disabled and the other natively disabled.
- **Stories.** `SplitButton.stories.tsx`: `WithIcon`, `CustomMenuIcon`.
- **Docs.** CHANGELOG Added.
- **Compatibility.** Additive.

### P1-04 — `disabledFocusable` on the button family and Link; Toolbar reachability (P1-buttons)

- **Closes:** `buttons-3`, `buttons-17`, `buttons-21`.
- **API.** `disabledFocusable?: boolean` on `ButtonOwnProps`, `CompoundButtonOwnProps`, `ToggleButtonProps`, `MenuButtonProps`, `SplitButtonProps` (P1-03) and `LinkOwnProps`.
  ```ts
  /**
   * Marks the button unavailable but keeps it focusable and in the tab order: for toolbar items, a
   * button that disables itself when activated, or a disabled button that needs a Tooltip. Renders
   * `aria-disabled="true"`, `data-disabled` and `data-disabled-focusable` instead of the native
   * `disabled` attribute. Clicks, Enter, Space and implicit form submission are prevented; your
   * `onClick` is not called and the click does not reach ancestor click handlers. Hover and pressed
   * colors are off. Wins over `disabled` when both are set. In a `Toolbar` it stays in the
   * arrow-key order.
   * @default false
   */
  disabledFocusable?: boolean;
  ```
- **Order.** P1-buttons implements P1-05 (the `Button.semantics.ts` extraction) first; this item builds on it.
- **Behaviour** (D2):
  - Native `<button>` (and `input`/`select`/`textarea` as `as`): no `disabled` attribute; enforced (after `{...rest}`) `focusableDisabledProps(true, { reachable: true })` (`aria-disabled={true}`, `data-disabled=""`, `data-disabled-focusable=""`); `onClick` replaced by a handler that calls `preventDefault()` and `stopPropagation()`; `onKeyDown`: Enter and Space call `preventDefault()` and are not forwarded, other keys are forwarded to the consumer's `onKeyDown` (so Menu.Trigger's arrow keys still reach it; D19 blocks them there); `onKeyUp`: Space `preventDefault()` and not forwarded.
  - `a`: `href` dropped (enforced `undefined`), `role` default `'link'` when an `href` was given, else `'button'` (P1-05); `tabIndex` default `0`; same handlers.
  - `div`, `span` and other non-interactive intrinsic tags: `role="button"` and `tabIndex={0}` defaults kept; same handlers.
  - Custom `as` components: the ARIA and data attributes and the handlers; no `tabIndex` default (the component decides).
  - Every disabled Button (native or not) now also renders `data-disabled=""` (C-CLASS; additive).
  - ToggleButton: destructures `disabledFocusable`, includes it in `disabledLook` (0.5: `disabled || aria-disabled`), so `getPressedLayer(appearance, disabledLook)` gives a pressed and focusable-disabled button the disabled pressed look, and passes it to Button; the toggle never runs (its composed `onClick` is replaced). MenuButton: passes through to Button. SplitButton: see P1-03.
  - Link: same rules through the shared semantics module (P1-05); `as="button"` uses the focusable variant instead of the native `disabled`.
  - Toolbar: no code change needed beyond D3; its JSDoc bullet "Disabled controls are skipped" becomes "Natively disabled controls are skipped; `disabledFocusable` ones stay in the arrow-key order (APG)".
- **Forced colors.** `buttonDisabledClasses` already applies for `aria-disabled` (the disabled look includes `forcedColors.disabled`).
- **Files.** `Button.tsx`, `Button.semantics.ts` (new, P1-05), `CompoundButton.tsx`, `ToggleButton.tsx` (code: `disabledLook`), `MenuButton.tsx`, `SplitButton.tsx`, `Link.tsx`, `Toolbar.tsx` (JSDoc).
- **Tests.**
  - `Button.test.tsx`: Tab reaches it; `aria-disabled`, both data attributes, no `disabled`; click, Enter, Space do not call `onClick` and do not bubble to a parent `onClick`; `type="submit"` inside a form: neither the click nor implicit submission (Enter in a text field of the form) submits; hover classes gated (class assertion of the gate, no hex); `disabled` + `disabledFocusable` is focusable; `as="a" href` drops `href` and is focusable; `as="div"`; custom `as` receives the attributes; a Tooltip around it opens on focus (`userEvent.tab()`); `data-disabled` on a plain disabled Button.
  - `ToggleButton.test.tsx`: no toggle, `onPressedChange` not called (StrictMode); `pressed` + `disabledFocusable` renders the disabled pressed layer classes (the same as `pressed` + `disabled`).
  - `MenuButton.test.tsx`, `CompoundButton.test.tsx`, `Link.test.tsx`: attributes and prevented activation.
  - `Toolbar.test.tsx`: ArrowRight lands on a `disabledFocusable` Button between two enabled ones; Home/End include it; a natively disabled one is still skipped; RTL.
- **Guards** (WaveUI strengths "Toolbar works over any focusable descendant", "five sizes on every button", "fully typed polymorphic `as`"): the 0.5 Toolbar tests with arbitrary focusable descendants, the size matrix and the polymorphic type tests stay green unchanged.
- **Stories.** `Button.stories.tsx`: `DisabledFocusable` (with a Tooltip explaining why). `Toolbar.stories.tsx`: extend `WithDisabledControl` with a `disabledFocusable` control and update its description. `Link.stories.tsx`: `DisabledFocusable`.
- **Docs.** README "Buttons": a `disabledFocusable` bullet next to the `disabled` bullets (and the `aria-disabled` bullet points to it); keyboard table Toolbar row: "`disabledFocusable` controls stay reachable". CLAUDE.md C-DISABLED: add the `disabledFocusable` rule (D2, D3). CHANGELOG Added; Changed (DOM): `data-disabled` on disabled Buttons.
- **Compatibility.** Additive; `data-disabled` is a new attribute on disabled Buttons.
- **Size.** M (seven components on the P1-05 module, plus the roving change in F1).

### P1-05 — Link (and Button `as="a"`) without `href` is operable (P1-buttons)

- **Closes:** `buttons-15`, `buttons-5`.
- **API.** None.
- **Behaviour** (D4). A new component-private module `src/components/button/Button.semantics.ts` holds the activation logic Button has in 0.5 (`Button.tsx` lines 196–265: defaults, enforced attributes, Space arming through `useEventCallback` refs, Enter on key down, blur disarm, disabled handling) plus `disabledFocusable`. Button and Link both use it:
  ```ts
  /** Intrinsic elements whose native `disabled` attribute makes them unavailable. */
  export const NATIVE_DISABLED_ELEMENTS: ReadonlySet<string>;

  /** Whether an intrinsic element needs button semantics: not interactive by itself, or an
   *  `<a>` whose `href` is `undefined` or `null`. `tag` is `null` for a custom component. */
  export function needsButtonSemantics(tag: string | null, href: unknown): boolean;

  export interface ButtonSemanticsOptions {
    /** The rendered intrinsic tag, or `null` for a custom `as` component (no role, tab stop or
     *  key handling is added to it; the disabled attributes and handlers are). */
    tag: string | null;
    /** The consumer's `href` (decides link or button semantics for an `<a>`). */
    href: unknown;
    disabled: boolean;
    /** Wins over `disabled` (D2). */
    disabledFocusable: boolean;
    /** The consumer's handlers; the returned handlers compose or replace them. */
    onClick?: React.MouseEventHandler<HTMLElement>;
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
    onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
    onBlur?: React.FocusEventHandler<HTMLElement>;
  }

  export interface ButtonSemantics {
    /** Defaults the consumer may override: spread before `{...rest}` (`type`, `role`, `tabIndex`). */
    defaults: Record<string, unknown>;
    /** Attributes the consumer must not override: spread after `{...rest}` (`disabled`,
     *  `aria-disabled`, `data-disabled`, `data-disabled-focusable`, `href: undefined`,
     *  `tabIndex: -1` for a disabled non-native element). */
    enforced: Record<string, unknown>;
    /** Only the handlers that exist, so a custom `as` component keeps its own defaults. */
    handlers: {
      onClick?: React.MouseEventHandler<HTMLElement>;
      onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
      onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
      onBlur?: React.FocusEventHandler<HTMLElement>;
    };
  }

  /** Defaults, enforced attributes and composed handlers for Button and Link. */
  export function useButtonSemantics(options: ButtonSemanticsOptions): ButtonSemantics;
  ```
  - An intrinsic `a` whose `href` is `undefined` or `null`, or a non-interactive intrinsic tag (`span`, `div`, …), gets `role="button"` and `tabIndex={0}` as defaults (the consumer's values win, C-COMPOSE), Enter activates on key down, Space arms on key down and activates on key up (native button behaviour, moving focus cancels it).
  - With `href` (any string, `''` included) nothing changes: a link.
  - Disabled (not focusable), non-native element: `tabIndex={-1}`, `aria-disabled`, `data-disabled`; clicks are prevented **and stopped** (a natively disabled button dispatches no click to ancestors), Enter and Space are prevented and not forwarded. The role default of a disabled `<a>` is `'link'` when an `href` was given and `'button'` without one.
  - Link keeps `as="button"` → `type="button"` default, and never adds a role or tab stop to a custom `as`.
  - **Link adopts Button's disabled semantics.** 0.5 Link (`Link.tsx` lines 108–118) only called `preventDefault()` on click, let Enter/Space through, and gave a disabled `<a>` `role="link"` whatever the `href`. From 0.6 a disabled Link stops the click from reaching ancestors, blocks Enter and Space, and a disabled Link without `href` has `role="button"`. `<Button as="a" disabled>` without `href` also changes from `role="link"` to `role="button"`. Both are listed in §5.1 "Changed".
- **Files.** `Button.semantics.ts` (new), `Button.tsx`, `Link.tsx`.
- **Tests.** `Button.semantics.test.ts` (new): the predicate table and the returned `defaults`/`enforced`/`handlers` per tag × state. `Link.test.tsx`: `<Link onClick>text</Link>` is `getByRole('button', { name: 'text' })`, reachable by Tab, Enter and Space call `onClick` once each (StrictMode), Space does not scroll (default prevented), a consumer `role="link"`/`tabIndex={-1}` wins, `<Link href="/">` has no role or tabIndex attribute; `as="span"` gets button semantics; a disabled Link: the click does not reach a parent `onClick`, Enter/Space call nothing, `role="link"` with `href` and `role="button"` without; axe. `Button.test.tsx`: `as="a"` without `href` gets the same semantics; with `href` unchanged; `as="a" disabled` without `href` has `role="button"`.
- **Stories.** `Link.stories.tsx`: `AsButton` ("Show more" without `href`).
- **Docs.** README "Buttons" (the `as` bullet) and a Link note; CHANGELOG Changed (behaviour): "A Link without `href`, `Link as="span"` and `Button as="a"` without `href` get `role="button"`, a tab stop and Enter/Space activation" and "A disabled Link no longer lets its click reach ancestors or Enter/Space through; a disabled Link or `Button as="a"` without `href` has `role="button"`".
- **Compatibility.** Behaviour changes (improvements); element types and TypeScript types unchanged.
- **Size.** M (a shared semantics module adopted by two components).

### P1-06 — Field validation state, message icon, hint with message, horizontal orientation (P1-form)

- **Closes:** `form-basic-1`, `form-basic-3`, `form-basic-5`, `field-1`, `field-4`, `form-basic-2`, `field-2`, `field-3`.
- **API** (additions to `FieldProps`):
  ```ts
  /**
   * Validation state of `validationMessage`: `error` marks the control invalid (`aria-invalid`) and
   * announces the message (`role="alert"`); `warning` announces it without marking the control
   * invalid; `success` and `none` show it without announcing. Default: `'error'` when
   * `validationMessage` renders content, else `'none'`. Ignored while `error` is set.
   */
  validationState?: ValidationState;
  /**
   * Message below the control, styled and announced by `validationState`; it describes the control
   * (`aria-describedby`). `error` is the shorthand for an error message and wins over this prop.
   */
  validationMessage?: React.ReactNode;
  /**
   * Icon before the message. Default: an error, warning or success glyph per state; none for
   * `'none'`. `null` (or content that renders nothing) shows no icon. Decorative (`aria-hidden`).
   */
  validationMessageIcon?: Slot<'span'>;
  /**
   * `vertical`: the label above the control. `horizontal`: the label in a start column (a third
   * of the width) beside the control; the message and the hint stay below the control.
   * @default 'vertical'
   */
  orientation?: Orientation;
  ```
  `error` JSDoc gains "Shorthand for `validationState="error"` with this message; wins over `validationMessage` and `validationState` (development warning when both are set)". `hint` JSDoc: "shown below the control, after any validation message" (no longer "when no error message is shown").
- **Resolution** (D5):
  ```
  usesError  = error === true || slotRendersContent(error)
  state      = usesError ? 'error' : validationState ?? (slotRendersContent(validationMessage) ? 'error' : 'none')
  message    = usesError ? (slotRendersContent(error) ? error : undefined) : validationMessage
  hasMessage = slotRendersContent(message)
  invalid    = state === 'error'
  ```
  Development warning from an effect (C-DEV), key `Field:error-and-validation`: "Field: `error` and `validationMessage`/`validationState` are both set; `error` wins. Use one of them." when `usesError` and (`validationMessage` renders content or `validationState` is set to something other than `'error'`).
- **Rendering** (D6):
  - Message: `<p key={'message-' + state} id={messageId} role={state === 'error' || state === 'warning' ? 'alert' : undefined} data-validation-state={state} className="mt-1 flex items-start gap-1 text-caption-1 <color>">{icon}<span>{message}</span></p>`; `messageId` is `<fieldId>-error` for the error state (the 0.5 id) and `<fieldId>-message` otherwise; the key re-inserts the element when the state changes, so a new alert is announced.
  - Colors: error `text-error`, warning `text-warning-tint-foreground`, success `text-success-tint-foreground`, none `text-muted-foreground`. Icons: `ErrorIcon`, `WarningIcon`, `SuccessIcon` from `src/lib/icons.tsx` at 12px (`size={12}`, `mt-0.5 shrink-0`, `currentColor`), rendered through `renderSlot(icon, 'span', …, { 'aria-hidden': true })` when `validationMessageIcon` is given.
  - Hint: rendered whenever it renders content, **after** the message (`<p key="hint" id={hintId} …>` unchanged classes).
  - Root: `data-validation-state` (always, `"none"` included) and `data-orientation` (always, `"vertical"` or `"horizontal"`), per D22.
  - Horizontal: root `flex flex-row items-start gap-x-3`; the label gets `mb-0 basis-1/3 shrink-0 pt-1.5` (aligns with the text of a 32px control); the control and the messages are wrapped in `<div className="flex min-w-0 flex-1 flex-col">`. Without a label the wrapper takes the full width.
- **Context.** `FieldContextValue`: `invalid` = `state === 'error'`, `validationState` = `state`, `errorId` = `messageId` only for the error state, `validationMessageId` = `messageId` whenever a message renders, `hasErrorMessage` = error state with a message (controls with their own `error` keep showing it next to a Field warning). `mergeIntoFirstChild` joins the child's `aria-describedby` with `validationMessageId` and `hintId`, and injects `aria-invalid` only for the error state.
- **ColorPicker.** Its hex input builds `aria-describedby` itself (`ColorPicker.tsx`, `fieldInvalid && field?.errorId`) instead of through `useFieldControl`. That one expression becomes `field?.validationMessageId ?? (fieldInvalid ? field?.errorId : undefined)`, so a Field warning or success message describes the hex input too. Nothing else in ColorPicker changes.
- **Keyboard/focus.** Unchanged. **SSR.** Unchanged (no client-only state). **RTL.** Logical flex order; the icon precedes the text in DOM. **Forced colors.** Text in system colors; icons `currentColor`. **Motion.** None.
- **Guards** (WaveUI strengths "a required `Field` blocks submission natively", "control-level `error` on Input, Select and Textarea"): the 0.5 required-Field submission tests and the Input/Select/Textarea `error` tests stay green; a new test shows an Input `error` next to a Field warning (both messages describe the input).
- **Files.** `Field.tsx`, `ColorPicker.tsx` (that expression only).
- **Tests** (`Field.test.tsx`):
  - Each state: role (`alert` for error and warning only), `aria-invalid` only for error (on an Input, a Checkbox, a Combobox and a native `<input>` first child), `aria-describedby` contains the message and the hint in that order, the default icon is present and `aria-hidden`, axe.
  - `validationMessage` without `validationState` is an error; `validationState="error"` without a message marks the control invalid without a message element.
  - `error` wins over `validationMessage`/`validationState`, with the asserted warning (R14); `error={true}` unchanged.
  - The hint stays visible with an error (update the 0.5 test that asserted it was hidden).
  - `validationMessageIcon={null}` renders no icon; a custom icon renders instead.
  - Changing the state from warning to error re-inserts the message element (a new node).
  - `orientation="horizontal"`: `data-orientation="horizontal"` (and `"vertical"` by default), label first in DOM, the control still named by the label (`getByRole('textbox', { name })`), the message and hint inside the column wrapper; RTL render keeps the DOM order.
  - `renderWithFieldContext` with `validationState="warning"` for a custom control.
  - `ColorPicker.test.tsx`: inside a Field with a warning message, the hex input is described by it.
- **Stories.** `Field.stories.tsx`: `ValidationStates` (error, warning, success, none), `HintWithMessage`, `Horizontal` (a settings form), `CustomMessageIcon`.
- **Docs.** README "Forms and `Field`": validation states, `error` as the shorthand, the hint rule, orientation. CLAUDE.md "Field wiring": `FieldContextValue.validationState`/`validationMessageId` and the rule that only `error` sets `aria-invalid`. Testing guide: the new `renderWithFieldContext` options. CHANGELOG Added and Changed (hint visible with a message; error messages show an icon by default; message ids for non-error states).
- **Compatibility.** Additive API; two visible behaviour changes (D6).
- **Size.** M (validation model, layout and context changes).

### P1-07 — Rich labels for Checkbox, Switch and Radio; `labelPosition` for Checkbox and Switch (P1-form)

- **Closes:** `form-basic-16`, `form-basic-19`, `form-basic-22`, `form-basic-17`, `form-basic-25`.
- **API.**
  - Checkbox, Switch, `RadioGroup.Item`: `label?: React.ReactNode` (was `string`).
    ```ts
    /**
     * Label next to the control (any phrasing content, links included, but no other form
     * controls). It names the control through `aria-labelledby`, after a consumer or Field
     * `aria-labelledby`; a consumer `aria-label` names it instead. Clicking its text toggles the
     * control; clicking a link inside it follows the link.
     */
    label?: React.ReactNode;
    ```
  - Checkbox: `labelPosition?: CheckboxLabelPosition` with `export type CheckboxLabelPosition = Extract<LabelPosition, 'before' | 'after'>` (default `'after'`). Switch: `labelPosition?: SwitchLabelPosition` with `export type SwitchLabelPosition = Extract<LabelPosition, 'before' | 'after' | 'above'>` (default `'after'`). `Extract<>` keeps both closed when `LabelPosition` has `'below'` (for Radio, Spinner and Persona later). `RadioGroup.Item` gets no `labelPosition` in 0.6 (Radio's Fluent values are `'after' | 'below'`; backlog `form-basic-20`).
    ```ts
    /** Where the label renders: after the control (default), before it, or (Switch) above it. The
     *  DOM order follows the visual order.
     *  @default 'after' */
    labelPosition?: …;
    ```
- **Behaviour.**
  - The label span renders when `slotRendersContent(label)` (R11; `0` is content).
  - `labelPosition="before"`: the label span is rendered **before** the control in the DOM; `"above"` (Switch): root `flex-col items-start gap-1`, label first. Root `data-label-position` with the resolved value, `"after"` included (D22).
  - `children` are still not rendered (D20). A development warning from an effect, keys `Checkbox:children`, `Switch:children`, `RadioItem:children`: "`<Name>`: children are not rendered. Pass the label in `label`."
  - Naming, `aria-labelledby` order and the axe exemption rationale of 0.5 are unchanged.
- **RTL.** Logical (DOM order). **SSR.** Unchanged. **Forced colors.** Unchanged.
- **Files.** `Checkbox.tsx`, `Switch.tsx`, `RadioGroup.tsx`.
- **Tests** (`Checkbox.test.tsx`, `Switch.test.tsx`, `RadioGroup.test.tsx`): a label containing a `Link` names the control ("I agree to the terms"), clicking the label text toggles, clicking the link does not toggle; `labelPosition="before"` puts the label span before the control and keeps the name; Switch `"above"`; `data-label-position="after"` by default; `label={0}` renders "0"; the children warning is asserted (R14); axe for each position; type tests (`label` accepts a ReactNode; `@ts-expect-error` for Checkbox `labelPosition="above"` and `"below"`, Switch `"below"`).
- **Guards** (WaveUI strength "hidden inputs with `name`/`form`/`required` and form reset on every value control"): the 0.5 form tests of the three controls stay green unchanged.
- **Stories.** `Checkbox.stories.tsx`: `RichLabel`, `LabelBefore`. `Switch.stories.tsx`: `LabelPositions` (settings-list layout). `RadioGroup.stories.tsx`: `LabelWithSubtext`.
- **Docs.** CHANGELOG Added and Changed (children warn).
- **Compatibility.** Type widening (non-breaking); new development warning.

### P1-08 — `disabledFocusable` on Switch and Checkbox; `aria-disabled` routed (P1-form)

- **Closes:** `form-basic-24`.
- **API.** `disabledFocusable?: boolean` on Switch and Checkbox (JSDoc as P1-04, adapted: "the switch cannot be toggled and is not submitted with its form").
- **Behaviour.**
  - The `role="switch"`/`role="checkbox"` button gets `focusableDisabledProps(true, { reachable: true })` instead of `disabled`; its `onClick` becomes a handler that calls `preventDefault()` and neither toggles nor calls the consumer's `onClick`. Native Enter/Space activation goes through that click.
  - Root look: `cursor-not-allowed opacity-50` as for `disabled`. Forced colors: the disabled recipes (`forcedColors.disabled`, the GrayText thumb/glyph) apply.
  - `HiddenInput` is `disabled` (not submitted, not validated), as for `disabled`.
  - A consumer `aria-disabled` is destructured and routed to the control button (C-ROUTING; in 0.5 it landed on the root `<label>`). Without `disabledFocusable` it only sets the attribute (D2).
- **Files.** `Switch.tsx`, `Checkbox.tsx`.
- **Tests:** Tab reaches it; click, Space and Enter do not toggle; `onCheckedChange` and `onClick` not called (StrictMode); not in `FormData`; `aria-disabled` routed to the control (and absent from the root label); inside a required Field it does not block submission; axe.
- **Stories.** `Switch.stories.tsx` and `Checkbox.stories.tsx`: `DisabledFocusable`.
- **Docs.** CHANGELOG Added; Changed (routing of a consumer `aria-disabled`).
- **Compatibility.** Additive; routing fix.

### P1-09 — Slider progress fill (P1-form)

- **Closes:** `form-basic-29`.
- **API.** None.
- **Structural changes** (0.5 Slider has none of these: it passes `ref` straight through, attaches `onChange` only when a handler is given, and has no form-reset handling):
  - An internal `inputRef`, merged with the consumer's `ref` through `useMergedRefs`.
  - An `onChange` (React's input event) handler is always attached, composed with the consumer's `onChange` (consumer first, C-COMPOSE) and still calling `onValueChange`.
  - `useFormReset(inputRef, updateFill, props.form)`.
- **Behaviour.**
  - The input's style carries `--wave-slider-progress: <p>%`, `p = (value - min) / (max - min) * 100` clamped to 0–100 (`min` default 0, `max` default 100; `max <= min` gives 0). It is merged after the consumer's `style` for this key only.
  - Controlled: `p` is computed from `value` during render; a layout effect keyed on `value`, `min`, `max` and `step` then reads the element's own value (the browser snaps an off-grid `value` to `step`) and writes the variable from it when it differs, so the fill always matches the thumb.
  - Uncontrolled: computed from `defaultValue` (else the native default, `min + (max - min) / 2`) during render, then written to the element's style (`style.setProperty`) from the change handler and, after a form reset, from `useFormReset`'s callback in the next microtask (the reset event fires before the value is restored). The same layout effect writes the value read from the element once on mount (native step snapping).
  - WebKit track: `[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-primary)_var(--wave-slider-progress),var(--color-stroke-accessible)_var(--wave-slider-progress))]` and the `wave-rtl:` variant with `to_left`. Firefox: `[&::-moz-range-progress]:h-1 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary` (Firefox mirrors it itself).
  - Forced colors: the filled part in `Highlight`, the rest in `CanvasText` (a `forced-colors:` gradient with system colors in `Slider.tsx`; `forcedColors.rangeInput` in `src/lib/styles.ts` is not changed).
  - Disabled: the 0.5 `opacity-50` applies to the fill too.
- **SSR.** The server HTML carries the variable from `value`/`defaultValue`/midpoint, so the fill does not jump on hydration.
- **Files.** `Slider.tsx`.
- **Tests** (`Slider.test.tsx`): the variable for controlled values (0, 25, 100, custom `min`/`max`, `max <= min`); a controlled `value={33}` with `step={10}` ends with the variable of the snapped value; an uncontrolled slider updates on `fireEvent.input`/`change` without any handler passed; the consumer's `onChange` and `onValueChange` still fire once; the consumer's `ref` still receives the input; a form reset restores it (after `await act(async () => {})`), also with `form` pointing at an outside form; the consumer's `style` keys are kept; the class strings contain the gradient, the `wave-rtl:` variant and the Firefox progress (no hex assertions); `renderToString` contains the variable.
- **Stories.** `Slider.stories.tsx`: the default story shows the fill; add `RightToLeft`.
- **Docs.** CHANGELOG Changed (visual): "Slider draws the part of the rail up to the thumb in the primary color".
- **Compatibility.** Visual change only.

### P1-10 — RatingDisplay value text, count, compact and localizable name (P1-form)

- **Closes:** `form-basic-43`, `form-basic-44`, `form-basic-45`, `form-basic-47`.
- **API** (additions to `RatingDisplayProps`, all in `Rating.tsx`):
  ```ts
  /** Built-in texts of RatingDisplay, for localization. */
  export interface RatingDisplayLabels {
    /** Accessible name. `formattedValue` is `value` formatted with `locale` (as shown).
     *  @default (value, max, formattedValue) => `Rating: ${formattedValue} out of ${max}` */
    rating?: (value: number, max: number, formattedValue: string) => string;
    /** Count part of the name. @default (count, formatted) => count === 1 ? '1 rating' : `${formatted} ratings` */
    count?: (count: number, formattedCount: string) => string;
  }
  /** Shows the value as text after the stars, formatted with `locale` (up to one decimal). @default false */
  showValue?: boolean;
  /** Number of ratings: shown as "(1,160)" after the value with the locale's digit grouping, and added to the accessible name ("…, 1,160 ratings"). */
  count?: number;
  /** One filled star followed by the value (and the count) instead of `max` stars. Implies `showValue`. @default false */
  compact?: boolean;
  /** BCP 47 locale of the value and count formatting (runtime default when omitted; pass it when rendering on the server). */
  locale?: string;
  /** Built-in texts, for localization. */
  labels?: RatingDisplayLabels;
  ```
- **Behaviour.** The root stays `role="img"` named `labels.rating(value, max, formattedValue)` plus `", " + labels.count(count, formatted)` when `count` is given (so with `locale="de-DE"` the default name says "Rating: 4,5 out of 5", matching the visible text); a consumer `aria-label` still wins. The value text shows when `showValue || compact || count !== undefined`, formatted with `Intl.NumberFormat(locale, { maximumFractionDigits: 1 })`; the count with `Intl.NumberFormat(locale)`, wrapped in parentheses. Text sizes: `extra-small`/`small` `text-caption-1`, `medium` `text-body-1`, `large`/`extra-large` `text-body-2`; value `font-semibold text-foreground ms-1`, count `text-muted-foreground ms-1`. `compact` renders one fully filled star. `data-compact` (boolean, D22) on the root when compact.
- **SSR.** With `locale`, server and client format identically (test with `renderToString` and `hydrateRoot`, no mismatch warning).
- **RTL.** Logical margins; the star fill direction logic of 0.5 is unchanged.
- **Files.** `Rating.tsx`.
- **Tests** (`Rating.test.tsx`): value text formatting (`en-US` 4.5, `de-DE` "4,5"), count grouping (`en-US` "(1,160)", `de-DE` "(1.160)"), the name with count, the default name with `locale="de-DE"` ("Rating: 4,5 out of 5, 1.160 ratings"), `labels` overrides, compact renders one star and the value, no text by default (0.5 look), SSR hydration without warnings, axe.
- **Guards** (WaveUI strength "fractional RatingDisplay"): the 0.5 fractional fill tests stay green unchanged.
- **Stories.** `Rating.stories.tsx`: `DisplayWithValueAndCount`, `DisplayCompact`, `DisplayLocalized` (`lang="nb"` on the wrapper).
- **Docs.** README "Built-in text": a RatingDisplay row (`labels`: `rating(value, max, formattedValue)`, `count(count, formatted)`). CHANGELOG Added.
- **Compatibility.** Additive.

### P1-11 — Combobox and Dropdown `clearable`; Combobox and TimePicker chevron (P1-pickers)

- **Closes:** `combobox-2`, `combobox-4`, `dropdown-2`.
- **API.**
  - Combobox:
    ```ts
    /**
     * Shows a clear button while a value is selected (not while `readOnly`; while `disabled` it is
     * shown disabled, as in DatePicker and TimePicker). It clears the value
     * (`onValueChange('')`), drops typed text, closes the list and moves focus to the input. It is
     * a tab stop after the input.
     * @default false
     */
    clearable?: boolean;
    /**
     * The glyph of the expand button at the end of the input (default: a chevron). The button
     * opens and closes the list without moving focus out of the input and is not a tab stop
     * (Alt+ArrowDown opens the list from the keyboard). `null` or `undefined` keep the chevron;
     * `false`, or a value that renders nothing, hides the button. Decorative content rendered
     * inside the built-in button: a `<button>` or `Button` passed here is not nested (its children
     * become the glyph, with a development warning).
     */
    expandIcon?: Slot<'span'>;
    ```
    `ComboboxLabels` gains `clear?: string` (`@default 'Clear selection'`) and `expand?: string` (`@default 'Show options'`, the expand button's name).
  - TimePicker: `expandIcon?: Slot<'span'>` (the same JSDoc) and `TimePickerLabels.expand?: string` (`@default 'Show times'`). Its `clearable` and `labels.clear` exist since 0.5.
  - Dropdown: `clearable?: boolean` (JSDoc as Combobox without the `readOnly` clause, which Dropdown does not have: "Shows a clear button while a value is selected (shown disabled while `disabled`). It clears the value, closes the list and moves focus to the combobox button. It is a tab stop after it.") and `labels?: DropdownLabels` with `clear?: string` (`@default 'Clear selection'`). New exported type `DropdownLabels` (a `labels` object like every other picker's; §8 note 3).
- **Shared classes.** A new component-private module `src/components/input/pickerStyles.ts` exports `PICKER_ICON_BUTTON_CLASSES`, a copy of DatePicker's private `ICON_BUTTON_CLASSES` (24×24px target, C-NATIVE padding and background, the gated hover). Combobox, Dropdown and TimePicker import it; DatePicker is not changed in 0.6 (it may switch to the module when a later package owns it).
- **Behaviour.**
  - Combobox DOM: the `<input>` moves into a wrapper `<div className="relative flex items-center">` (the root keeps `ref`, `className`, `style`, the rest props and the status span, ListboxSurface and HiddenInput). Input padding `pe-8` with the chevron, `pe-14` with chevron and clear button, `pe-8` with only the clear button.
  - Expand button (D14, D21): rendered unless `expandIcon` is `false` or renders nothing. `<button type="button" tabIndex={-1} aria-label={labels.expand} aria-expanded={expanded} aria-controls={expanded ? listboxId : undefined} disabled={disabled || readOnly}>`, positioned `absolute end-1` with `PICKER_ICON_BUTTON_CLASSES`, `onMouseDown` `preventDefault()` (focus stays in the input), `onClick` toggles the list and focuses the input; the glyph rotates while expanded (`transition-transform motion-reduce:transition-none`, `rotate-180`).
  - Clear button (D14 visibility rule): rendered while `clearable && value !== '' && !readOnly`; `<button type="button" aria-label={labels.clear} disabled={disabled}>` with `DismissIcon`, `absolute end-7` (or `end-1` without the chevron), `onMouseDown` `preventDefault()` (the input's blur does not commit a draft first). `onClick` sets the state directly: `setValue('')`, `setTypedValue(null)`, `setDraft(null)`, `setOpen(false)`, then focuses the input (the button disappears with the value, so focus is moved explicitly, C-DISABLED). It does not go through `commitText('')`, which calls the deprecated `onOptionSelect` in freeform mode: clearing is not an option activation.
  - Dropdown DOM: the `<button role="combobox">` moves into `<div className="relative flex items-center">`; the combobox button gets `pe-14` while the clear button shows; the clear button sits at `absolute end-7`, the chevron stays inside the combobox button. Clearing calls `setValue('')`, closes the list (`setOpen(false)`) and focuses the combobox button. The local `const labels = useMemo(() => collectOptionLabels(children))` (Dropdown.tsx) is renamed `optionLabels` (Combobox's name) so the new `labels` prop does not collide with it.
  - TimePicker DOM: its input wrapper exists; the expand button is added at `absolute end-1` with the same element and handlers as Combobox's, the 0.5 clear button moves to `end-7` while the chevron shows, and the input padding follows the Combobox rule.
  - All three: the values are submitted and reset as before (`HiddenInput` value `''` after clearing).
- **Keyboard.** Tab order: input (or combobox button) → clear button → next control. The expand button is skipped by Tab (APG). Escape behaviour unchanged.
- **RTL.** Logical (`end-*`, `pe-*`). **Forced colors.** Icons in `currentColor`; the icon buttons keep the focus ring. **SSR.** No client-only parts added.
- **Guards** (WaveUI strengths "Combobox and TagPicker filter as you type and announce 'No matches'", "hidden inputs … and form reset on every picker", "first-class TimePicker"): the 0.5 filtering, status and form tests of the three pickers stay green unchanged.
- **Files.** `Combobox.tsx`, `Dropdown.tsx`, `TimePicker.tsx`, `pickerStyles.ts` (new).
- **Tests** (`Combobox.test.tsx`, `Dropdown.test.tsx`, `TimePicker.test.tsx`): the chevron toggles the list and focus stays in the input; it is not reached by Tab; `aria-expanded`/`aria-controls` follow the list; `expandIcon={false}` removes it and `expandIcon={null}` keeps it (D21); custom content; a `<button>` passed as `expandIcon` is not nested (one `button` element, the warning asserted); clear appears only with a value, not while read-only, and disabled while disabled; clearing emits `onValueChange('')` once (StrictMode, separate tasks per CLAUDE.md), closes the list, focuses the control, empties the hidden input; freeform clears the typed text without calling `onOptionSelect`; Tab order; labels localize every name; RTL classes; axe open and closed. Update 0.5 tests that assumed the input is a direct child of the root or counted buttons.
- **Stories.** `Combobox.stories.tsx`: `Clearable`, `WithoutExpandIcon`. `Dropdown.stories.tsx`: `Clearable`. `TimePicker.stories.tsx`: the default story shows the chevron.
- **Docs.** README "Built-in text" (Combobox `clear`, `expand`; TimePicker `expand`; Dropdown `labels.clear`); keyboard table (the chevron is not a tab stop, the clear button is). CHANGELOG Added; Changed (visual and DOM): Combobox and TimePicker show a chevron by default; Combobox wraps its input; Dropdown wraps its button.
- **Compatibility.** Additive API; visible and DOM change for Combobox, TimePicker and Dropdown (D14).
- **Size.** M (DOM changes to three pickers).

### P1-12 — TimePicker invalid input (P1-pickers)

- **Closes:** `timepicker-1`.
- **API.**
  ```ts
  /** Why typed text was not accepted (see {@link TimePickerProps.onInvalidInput}). */
  export type TimePickerInvalidReason = 'unparseable' | 'out-of-range';

  /**
   * Called when edited text is not accepted on Enter or blur (once per edit): it is not a time
   * (`'unparseable'`) or lies outside `minTime`/`maxTime` (`'out-of-range'`). The text stays in the
   * input, which is marked `aria-invalid` and described by an error message (left to the
   * surrounding `Field` when it shows an error). Enter reports it again when pressed again.
   */
  onInvalidInput?: (text: string, reason: TimePickerInvalidReason) => void;
  ```
  `TimePickerLabels` gains, with DatePicker's shapes (D11):
  ```ts
  /** Message for text that is not a time. `format` is the display pattern (`'HH:mm'` or
   *  `'h:mm AM'`). @default (format) => `Enter a time in the format ${format}.` */
  invalidTime?: (format: string) => string;
  /** Message for a time outside `minTime`/`maxTime`, shown in the display format; a missing bound
   *  is `undefined`. @default "Enter a time between {min} and {max}." ("Enter a time on or after
   *  {min}." or "Enter a time on or before {max}." with one bound; DatePicker's wording) */
  outOfRange?: (min: string | undefined, max: string | undefined) => string;
  ```
- **Behaviour** (D11, mirrors DatePicker):
  - `commitDraft` returns the reason: empty text clears (unchanged); unparseable → `'unparseable'`; a time outside the bounds (or any time while the bounds are invalid) → `'out-of-range'`.
  - Enter with rejected text: `preventDefault()` (no submit, unchanged), keep the text, set the invalid state, call `onInvalidInput`. Blur with rejected text: keep the text (0.5 reverted it), set the state, report once per edit (not again if Enter already reported this edit).
  - Editing the text clears the state; so do selecting an option, the clear button, Escape reverting the text, a new `value` from the parent, a form reset and the picker becoming disabled or read-only.
  - While invalid: the input has `aria-invalid="true"` and `aria-describedby` includes the error message `<p id role="alert" className="mt-1 text-caption-1 text-error">`, unless `field?.hasErrorMessage` (then the Field's error describes it, as in DatePicker).
- **Files.** `TimePicker.tsx`.
- **Tests** (`TimePicker.test.tsx`): keep-and-flag on Enter and on blur; `onInvalidInput` reasons and once-per-edit (StrictMode); message text from `labels` (`invalidTime` receives the display pattern; `outOfRange` receives `undefined` for a missing bound); out-of-range message shows the bounds in 12h and 24h formats; each clearing path; Field error suppresses the own message (tested with `renderWithFieldContext`, §0.2 rule 9); axe while invalid. Update the 0.5 tests that expected a revert on blur (§6.3).
- **Stories.** `TimePicker.stories.tsx`: `ValidationFeedback` (with `minTime`/`maxTime`).
- **Docs.** README "Built-in text" TimePicker row (`invalidTime(format)`, `outOfRange(min, max)`); keyboard table Combobox/TagPicker/TimePicker row ("other text is kept and flagged"). CHANGELOG Added; Changed (behaviour): "TimePicker keeps rejected text on blur and flags it instead of reverting it".
- **Compatibility.** Behaviour change (D11).

### P1-13 — Badge `severe` and `subtle`; `important` deprecation path (F1-foundation, wave A)

- **Closes:** `badge-2`. **Mitigates:** `badge-1` (closed in 1.0 by ROADMAP P14-05).
- **API.** `BadgeColor` in `src/lib/types.ts` adds `'severe' | 'subtle'`; F1 changes that declaration together with the color map (D23):
  ```ts
  /** Semantic colors of Badge and CounterBadge. */
  export type BadgeColor =
    | 'brand'
    | 'success'
    | 'warning'
    | 'danger'
    | 'important'
    | 'informative'
    | 'severe'
    | 'subtle';
  ```
  `BadgeProps.color` JSDoc lists every color:
  ```ts
  /**
   * Semantic color: `brand`, `danger`, `important`, `informative`, `severe`, `subtle`, `success`,
   * `warning`. `severe` is dark orange. `subtle` is the page background with foreground text, for
   * colored surfaces. `important` renders the severe (orange) colors in 0.x, as in 0.5; in 1.0 it
   * becomes Fluent's neutral high-emphasis color (near black in the light theme) — use `severe` to
   * keep the orange look.
   * @default 'brand'
   */
  color?: BadgeColor;
  ```
- **Behaviour.** The color map moves to a new module `src/components/data-display/Badge.colors.ts` (component-private, shared with CounterBadge, D13):
  - `severe`: filled `bg-severe text-severe-foreground`, tint `bg-severe-tint text-severe-tint-foreground`, border `border-severe` (today's `important`).
  - `subtle`: filled `bg-background text-foreground`, tint `bg-background text-muted-foreground border border-border`, border `border-border`.
  - `important`: unchanged in 0.6.
  - The root always gets `data-color` and `data-appearance` with the resolved values (C-CLASS, D22; additive).
  - Naming (D13): when `aria-label` or `aria-labelledby` is given and `role` is not, the root gets `role="img"` (a default before `{...rest}`, so a consumer `role` wins).
- **Forced colors.** Unchanged (text in system colors; the outline border stays visible).
- **Files.** `Badge.tsx`, `Badge.colors.ts` (new), `src/lib/types.ts` (the `BadgeColor` declaration), `stories/_helpers.ts` (`badgeColors` list), all in F1.
- **Tests** (`Badge.test.tsx`): every color × appearance renders its token classes (no hex assertions); `data-color`/`data-appearance` with the defaults (`brand`, `filled`); `role="img"` with `aria-label` and none without, a consumer `role` wins; axe in all three themes for the new colors (`renderWithProviders(ui, { theme })`) and for a named badge; type test for the union.
- **Stories.** `Badge.stories.tsx`: add `severe` and `subtle` to the color matrix (`COLORS` and `stories/_helpers.ts` `badgeColors`); a note story "Important in 1.0".
- **Docs.** CHANGELOG Added; Changed: "A Badge with `aria-label`/`aria-labelledby` gets `role="img"`"; **Deprecated:** "Badge `color="important"` keeps its orange look through 0.x and becomes Fluent's neutral high-emphasis color in 1.0. Use `color="severe"` for orange." README: a short Badge note under Usage notes.
- **Guards** (WaveUI strength "WCAG contrast asserted for every token pair in all three themes"): no new token; the pairs the new colors use are asserted already (§1.6).
- **Compatibility.** Additive; deprecation notice only (D1); `role="img"` only with a naming attribute.

### P1-14 — CounterBadge `dot`, `color`, `showZero` (P1-display)

- **Closes:** `counterbadge-1`, `counterbadge-2`, `counterbadge-3`.
- **API.**
  ```ts
  export interface CounterBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Number to show. Nothing renders for 0 (unless `showZero`) or less. @default 0 */
    count?: number;
    /** @default 99 */
    overflowCount?: number;
    /** @default 'filled' */
    appearance?: 'filled' | 'outline';
    /** Semantic color (Badge's palette; `important` follows Badge, see its JSDoc). @default 'brand' */
    color?: BadgeColor;
    /**
     * A 6px dot without a number (an "unread" indicator); `count`, `overflowCount` and `showZero`
     * are ignored. Name it with `aria-label` when nothing else conveys its meaning.
     * @default false
     */
    dot?: boolean;
    /** Shows "0" for a count of 0; negative counts still render nothing. @default false */
    showZero?: boolean;
    ref?: React.Ref<HTMLSpanElement>;
  }
  ```
- **Behaviour.**
  - Renders nothing when `!dot && (count < 0 || (count === 0 && !showZero))`.
  - Colors from `Badge.colors.ts`: filled → the color's `filled` classes; outline → `bg-transparent border` plus the color's border and, for `brand`, `text-primary` (0.5 look), otherwise `text-foreground`.
  - Dot: `h-1.5 w-1.5 min-w-0 p-0` with no text; `data-dot` (boolean, D22); forced colors `forced-colors:forced-color-adjust-none forced-colors:bg-[CanvasText]` so it stays visible.
  - The root always gets `data-color` and `data-appearance` with the resolved values (D22), as Badge.
  - Naming (D13): when `aria-label` or `aria-labelledby` is given and `role` is not, the root gets `role="img"` (default before `{...rest}`), as Badge.
- **Files.** `CounterBadge.tsx`.
- **Tests** (`CounterBadge.test.tsx`): `count` optional; `showZero`; negative counts; dot has no text and ignores `count`; colors × appearances; `data-color`/`data-appearance` defaults; `role="img"` with a name and none without; axe for a named dot and a plain count; forced-colors class on the dot.
- **Stories.** `CounterBadge.stories.tsx`: `Dot`, `Colors`, `ShowZero`.
- **Docs.** CHANGELOG Added; Changed: "A CounterBadge with `aria-label`/`aria-labelledby` gets `role="img"`".
- **Compatibility.** Additive (`count` becomes optional; the role default applies only with a naming attribute).

### P1-15 — Tag: focus after a keyboard dismiss (P1-display)

- **Closes:** none. **Mitigates:** `taggroup-1` (closed by ROADMAP P6-02, TagGroup).
- **API.** None.
- **Behaviour.** Documentation and stories only:
  - `stories/Tag.stories.tsx`: `FilterGroup` keeps the filters in state; after a dismiss it focuses the next tag's dismiss button, else the previous one, else a "Reset filters" button outside the group (`requestAnimationFrame` after the state update, or a ref map). `DismissibleTag` no longer swaps the tag for an unfocused "Restore tag" button; a separate "Restore" button outside the tag restores it.
  - `Tag.tsx` JSDoc (component level): a "Focus after dismissal" paragraph: "A tag cannot keep focus once you remove it. When `onDismiss` removes the tag, move focus to the next tag's dismiss button (else the previous one, else a sensible element nearby); TagGroup (planned) will do this for you."
- **Files.** `Tag.tsx` (JSDoc only), `stories/Tag.stories.tsx`, `Tag.test.tsx`.
- **Tests** (`Tag.test.tsx`): a test component implementing the documented recipe: dismissing the middle tag with Enter focuses the next dismiss button; dismissing the last focuses the previous; dismissing the only tag focuses the fallback; focus never ends on `<body>`.
- **Guards** (WaveUI strength "Tag dismiss buttons are named after their tag"): the recipe queries the dismiss buttons by their 0.5 names ("Dismiss <tag>"), so a naming regression fails it.
- **Docs.** README: a "Tags" usage note with the recipe. CHANGELOG Fixed (stories).
- **Compatibility.** None.

### P1-16 — Spinner `appearance="inverted"` and `delay` (P1-feedback)

- **Closes:** `spinner-1`, `spinner-2`.
- **API.**
  ```ts
  /** Color treatment of a {@link Spinner}. */
  export type SpinnerAppearance = 'primary' | 'inverted';

  /**
   * `primary`: a primary arc on the track color. `inverted`: drawn in the current text color (a
   * 30% track), for brand or inverted surfaces such as a primary Button.
   * @default 'primary'
   */
  appearance?: SpinnerAppearance;
  /**
   * Milliseconds to wait before the ring and the label appear, so a fast load does not flash the
   * spinner. The status region is mounted (empty) at once and announces the label once shown.
   * A non-finite or negative value means 0.
   * @default 0
   */
  delay?: number;
  ```
- **Behaviour.**
  - Inverted (D16): ring `border-current/30 border-t-current` instead of `border-track border-t-primary`; a visible label `text-current` instead of `text-muted-foreground`. `forcedColors.ringArc` unchanged. Root `data-appearance` always, with the resolved value (`"primary"` or `"inverted"`, D22).
  - Delay: `const [shown, setShown] = useState(delay <= 0)`; while not shown the root renders (with its role) but neither the ring nor label text; the root's `data-state` is `"delayed"` until shown, then `"shown"` (always rendered, D22); an effect starts `setTimeout(() => setShown(true), delay)` (state set in the callback, C-HOOKS) and clears it on unmount or when `delay` changes. The 0.5 one-frame announcement deferral starts when the spinner is shown.
  - Motion: unchanged (the ring keeps `motion-reduce:animate-wave-spin-slow`).
- **SSR.** With `delay > 0` the server HTML has the empty region and no ring; the client's first render matches.
- **Files.** `Spinner.tsx`.
- **Guards** (WaveUI strength "live regions need no provider"): the 0.5 announcement tests stay green; a delayed spinner still announces through its own status region.
- **Tests** (`Spinner.test.tsx`): inverted classes and `data-appearance` (`"primary"` by default); `data-state` `"delayed"` then `"shown"`; delay with fake timers (`vi.useFakeTimers({ shouldAdvanceTime: true })`, `act` around `advanceTimersByTime`): nothing before, the ring after, the label announced one frame later; unmount during the delay leaves no timer; `renderToString` with a delay has no ring; a primary `Button` containing an inverted Spinner passes axe.
- **Stories.** `Spinner.stories.tsx`: `Inverted` (inside a primary Button and on an inverted surface), `Delayed`.
- **Docs.** CHANGELOG Added.
- **Compatibility.** Additive.

### P1-17 — ProgressBar `color` and Field integration (P1-feedback)

- **Closes:** `progress-1`, `progress-2`.
- **API.**
  ```ts
  /** Color of a {@link ProgressBar}'s fill. */
  export type ProgressBarColor = 'brand' | 'success' | 'warning' | 'error';

  /**
   * Color of the fill. Inside a `Field` it follows the Field's validation state (error, warning,
   * success) unless you set it.
   * @default 'brand'
   */
  color?: ProgressBarColor;
  ```
  `label` JSDoc: "…Inside a `Field`, the Field's label names the bar when neither `label` nor a consumer name is given."
- **Behaviour.**
  - Fill classes: brand `bg-primary`, success `bg-success`, warning `bg-severe` (D15), error `bg-error`; `forcedColors.selectedLeaf` unchanged (Highlight). The bar always gets `data-color` with the resolved color (D22).
  - Field: `const fieldProps = useFieldControl({ id, 'aria-describedby': rest['aria-describedby'] }, { labelable: false })`. The call passes no name props, so with `labelable: false` `fieldProps['aria-labelledby']` is exactly the Field's `labelId` (or absent). ProgressBar uses `fieldProps.id` and `fieldProps['aria-describedby']` (the consumer's ids, then the Field's message and hint), and takes `fieldProps['aria-labelledby']` **only when the bar has no name of its own**, so the Field label never joins or overrides one:

    | Consumer `aria-label` / `aria-labelledby` | `label` | `showLabel` | Rendered name attribute |
    |---|---|---|---|
    | given | any | any | the consumer's (0.5) |
    | none | text | `false` | `aria-label={label}` (0.5) |
    | none | text | `true` | `aria-labelledby` = the bar's own label id (0.5) |
    | none | none | — | `aria-labelledby` = the Field's `labelId` (inside a Field with a label), else none (0.5 development warning) |

  - The resolved color is `color ?? fieldColor`, where the Field's `validationState` `error`/`warning`/`success` map to the same names.
  - `aria-invalid` and `aria-required` (which Field merges into a first child) are destructured and not rendered: they are not allowed on `role="progressbar"`.
  - The development name warning does not fire when the Field supplies the name.
- **Files.** `ProgressBar.tsx`.
- **Tests** (`ProgressBar.test.tsx`; the Field cases use `renderWithFieldContext(ui, { validationState: 'warning', validationMessageId: FIELD_TEST_IDS.messageId, hintId: FIELD_TEST_IDS.hintId })`, §0.2 rule 9 — the real `Field` case is INTEGRATION §4.5 #4): the fill class per color; `data-color="brand"` by default; one test per row of the naming table (the accessible name and the exact `aria-label`/`aria-labelledby` attributes); inside the Field context: described by message and hint, warning fill, no `aria-invalid`/`aria-required` on the bar, no warning logged; outside a Field unchanged (0.5 tests pass); explicit `color` wins over the Field; axe in each state.
- **Stories.** `ProgressBar.stories.tsx`: `Colors`, `InField`.
- **Docs.** README "Forms and `Field`": ProgressBar reads the Field. CHANGELOG Added; Changed (behaviour inside a Field).
- **Compatibility.** Additive; inside a Field the bar is now named, described and colored.

### P1-18 — Toaster `limit` and `dismissAllToasts` (P1-feedback)

- **Closes:** `toaster-1`, `toastctl-1`.
- **API.**
  ```ts
  // ToasterProps
  /**
   * Most toasts shown at once. Further toasts wait in a queue (in dispatch order) and appear when
   * a shown toast goes; a queued toast is not announced and its timer does not run until then.
   * Lowering it never hides a toast that is already shown. A value below 1 counts as 1
   * (development warning); `Infinity` means no limit.
   * @default Infinity
   */
  limit?: number;

  // ToastController
  /** Removes every toast, shown and queued, and cancels their timers. */
  dismissAllToasts: () => void;
  ```
- **Behaviour** (D17).
  - Each entry gets a `shown` flag. The removal paths (dismiss, dismiss-all and the timeout callback that `createToastTimers` receives once, in `useState`) only remove entries; none of them needs `limit`.
  - **Promotion happens in one place, during render, with the current `limit`:** `const settled = promoteQueued(toasts, limit)` flags the oldest queued entries as shown while fewer than `limit` are shown, and returns the same array when nothing changes. When it returns a new array, the Toaster calls `setToasts(settled)` during render (React's "adjust state while rendering" update, the previous-value pattern of C-HOOKS; guarded by the identity check, so it settles in one extra render). Every path — dispatch, dismiss, dismiss-all, timeout, a rising `limit` — therefore promotes, and lowering `limit` never un-flags a shown toast. No ref is read during render, and no `setState` runs in an effect body.
  - An effect only syncs the timer store with the shown set, starting the timers of newly shown toasts (`timers.start` moves out of `dispatchToast` for every toast, limited or not). `LiveMessage`s render only for shown toasts, so a toast is announced when it appears.
  - `ToasterItem` receives its index **within the shown list** (the viewport renders only shown toasts, and `getFocusFallback` walks the rendered children).
  - Re-dispatching a queued id replaces its options in place (it stays queued); a shown id behaves as in 0.5. `dismissToast(id)` on a queued toast removes it silently.
  - `dismissAllToasts` removes all entries and timers; `usePreserveFocus` then returns focus to the element focused before the toasts (existing rule). The inert production controller gets a no-op `dismissAllToasts`.
- **Guards** (WaveUI strengths "Toaster timers pause on hover, focus, blur and hidden tabs", "toasts stay reachable over modals and move out of a Drawer's way", "severity is spoken by Toast"): the 0.5 pause, modal and drawer-offset tests stay green unchanged.
- **Files.** `Toast.tsx`.
- **Tests** (`Toast.test.tsx`, fake timers): `limit={2}` with three dispatches renders two and announces two; dismissing one shows and announces the third, whose timer starts then; a queued toast's timeout does not elapse while queued; a toast without `limit`, whose timer now starts in the effect, still expires after exactly `timeout` (advance `timeout - 1`: shown; advance 1: gone); lowering `limit` keeps shown toasts; raising it promotes queued ones; re-dispatching a queued id; `dismissAllToasts` clears shown and queued and restores focus; focus moves to the right neighbour when a focused toast is dismissed while others are queued (the shown-list index); StrictMode; the `limit < 1` warning asserted.
- **Stories.** `Toast.stories.tsx`: `Limit` (a burst of five with `limit={3}`), `DismissAll`.
- **Docs.** README "Toasts": `limit` and `dismissAllToasts`. CHANGELOG Added; Types: "`ToastController` has a new member `dismissAllToasts`; code that implements the interface (test doubles) must add it".
- **Compatibility.** Additive; a new member on a public interface.
- **Size.** M (the toast queue and timer start move).

### P1-19 — Dialog `modalType="alert"` (P1-overlays)

- **Closes:** `dialog-1`.
- **API.**
  ```ts
  /** How a {@link Dialog} blocks the page (the shared `ModalType` of `src/lib/types.ts`, §1.1;
   *  Drawer reuses it when it gains `modalType`). */
  export type DialogModalType = ModalType;

  // DialogProps
  /**
   * `modal`: a backdrop press, Escape, the Close button and `Dialog.Close` close it. `alert`: a
   * confirmation that needs an answer — `role="alertdialog"`, and a backdrop press does not close
   * it (Escape still does). Initial focus goes to the first focusable element, the built-in Close
   * button; give the least destructive action `autoFocus` to focus it instead. (`'non-modal'` is
   * planned.)
   * @default 'modal'
   */
  modalType?: DialogModalType;
  ```
- **Behaviour.** `DialogContext` carries `modalType`. `Dialog.Content`: `role` default `'alertdialog'` for alert (before `{...rest}`, so a consumer `role` wins), `data-modal-type` always with the resolved value (`"modal"` or `"alert"`, D22), `useModalLayer({ …, outsidePress: modalType !== 'alert' })`. Focus trap, `inert` isolation, scroll lock and focus restore unchanged.
- **Guards** (WaveUI strengths "`inert` isolation instead of `aria-modal`, so toasts stay announced", "Dialog `finalFocusRef` and a documented focus-return chain"): the 0.5 isolation and focus-return tests stay green; INTEGRATION §4.5 #5 covers a Toaster over an alert dialog.
- **Files.** `Dialog.tsx`.
- **Tests** (`Dialog.test.tsx`): `getByRole('alertdialog', { name })`; `data-modal-type="modal"` by default; a backdrop click does not call `onOpenChange` and keeps focus inside; Escape closes (reason `escape`, P1-20); a consumer `role` wins; axe open; type test (`DialogModalType` equals `ModalType`).
- **Stories.** `Dialog.stories.tsx`: `AlertDialog` (delete confirmation).
- **Docs.** README "Dialogs and triggers": alert dialogs. CHANGELOG Added.
- **Compatibility.** Additive.

### P1-20 — Dialog and Drawer `onOpenChange` details (P1-overlays)

- **Closes:** `dialog-3`.
- **API** (D9). The shared types come from `src/lib/types.ts` (F1, §1.1): `OpenChangeDetails<R>` and `ModalOpenChangeReason`. Public aliases: `DialogOpenChangeReason = ModalOpenChangeReason` and `DialogOpenChangeDetails = OpenChangeDetails<ModalOpenChangeReason>` (in `Dialog.tsx`), `DrawerOpenChangeReason`, `DrawerOpenChangeDetails` (in `Drawer.tsx`, the same types).
  ```ts
  /**
   * Called with the new open state when it changes. `details.reason` tells how — `trigger`,
   * `close` (a `.Close` part), `close-button` (the built-in Close button), `escape` or
   * `outside-press` (the backdrop) — so a controlled dialog can refuse only some ways of closing
   * (for example keep a form with unsaved changes open on `outside-press`); `details.event` is the
   * DOM event behind the request. WaveUI always passes `details`; it is typed optional until 1.0
   * so that code which calls this prop itself keeps compiling.
   */
  onOpenChange?: (open: boolean, details?: DialogOpenChangeDetails) => void;
  ```
  Drawer likewise.
- **Behaviour.** Fires only on change (unchanged, through `useControllable`).
  - The root's context replaces the bare `setOpen` with `requestOpen(next: boolean, details: DialogOpenChangeDetails)`: it writes `details` to a ref (a ref written from event paths, C-HOOKS), calls `setOpen(next)`, and clears the ref right after `setOpen` returns. `useControllable` calls its `onChange` synchronously inside `setOpen`, and that `onChange` reads the ref and calls `onOpenChange(next, details)`; clearing it afterwards means a later change from a path that passes no details can never report a stale reason. Every internal call site goes through `requestOpen` (a grep of `setOpen(` in the three files is part of the review).
  - `ModalTriggerState` (`Dialog.shared.tsx`) replaces `setOpen` with `requestOpen`. `useModalTriggerPart` and `useModalClosePart` take the click event and pass `event.nativeEvent`: `requestOpen(true, { reason: 'trigger', event })`, `requestOpen(false, { reason: 'close', event })`. The built-in Close button passes `'close-button'`.
  - `useModalLayer`'s `onDismiss(reason: DismissReason, event)` is mapped with an exhaustive `switch`: `'escape'` and `'outside-press'` pass through; `'focus-outside'` cannot reach a modal (the layer kind is `'modal'`), so that branch is a development assertion and is ignored.
  - A controlled parent that ignores a request keeps the surface open (unchanged).
- **Files.** `Dialog.shared.tsx`, `Dialog.tsx`, `Drawer.tsx`.
- **Tests** (`Dialog.test.tsx`, `Drawer.test.tsx`): each reason with a native `Event` (`expect.objectContaining({ reason: 'escape', event: expect.any(Event) })`); StrictMode fires once per change; a controlled dialog that ignores `outside-press` stays open while Escape closes it; a request after a trigger click, then an Escape, reports `escape` (no stale reason); type tests: a `(open: boolean) => void` handler is accepted, `props.onOpenChange?.(false)` compiles, `details` is `DialogOpenChangeDetails | undefined` and `details.reason` is the union. Update every 0.5 assertion `toHaveBeenCalledWith(false)` (§6.3).
- **Stories.** `Dialog.stories.tsx`: `UnsavedChanges` (refuses `outside-press` while dirty).
- **Docs.** README "Dialogs and triggers": the details argument. CHANGELOG Added; Changed (tests): "`onOpenChange` of Dialog and Drawer receives a second argument; assertions such as `toHaveBeenCalledWith(false)` need `expect.anything()` for it". Deprecated-style note: "`details` becomes a required parameter in 1.0; read it as `details?.reason` until then".
- **Compatibility.** Additive at the type level for handlers and for code that calls the prop (the parameter is optional); test assertions on the exact call arguments need updating.

### P1-21 — Dialog footer stays in view (P1-overlays)

- **Closes:** `dialogbody-1`.
- **API.** None.
- **Behaviour** (D10).
  - `Dialog.Footer`: classes `sticky -bottom-1 z-10 -mx-1 -mb-1 mt-6 flex justify-end gap-2 bg-background px-1 pb-2 pt-3`. The scrolling body is `p-1` (`Dialog.tsx`, the body `div`), and a sticky element's constraint rectangle is the scrollport inset by the container's padding, so `bottom-0` would stop 4px above the scrollport edge and content would scroll visibly through that strip; `-bottom-1` with `-mb-1 pb-2` makes the footer cover the body's bottom padding. The `-mx-1 px-1` covers the body's focus-ring inset, `pt-3` separates it from content scrolling under it; a short dialog looks as in 0.5 apart from `pt-3`. It keeps its place in the DOM.
  - It measures its height with a `ResizeObserver` created in a layout effect (the observer's first callback, delivered before the next paint, supplies the first value; `setState` happens only in that callback, C-HOOKS) and reports it through `ModalSurfaceContext` (`setFooterHeight?: (px: number | null) => void`, a new optional member; `null` on unmount). `Dialog.Content` sets the CSS variable `--wave-dialog-footer-height` to that height in px on the scrolling body's `style` and gives the body `scroll-pb-(--wave-dialog-footer-height)`, so focusing a field under the footer scrolls it above the footer (WCAG 2.4.11).
  - Inside a `<form>` that wraps content and footer it still sticks (sticky positioning is limited by the form's box, which spans the content). The footer must be the last child of such a wrapper.
  - Drawer ignores `setFooterHeight` in 0.6 (it has no footer part yet; ROADMAP P6-05).
- **Forced colors.** `bg-background` becomes Canvas; content scrolls under it without showing through.
- **Files.** `Dialog.tsx`, `Dialog.shared.tsx`.
- **Tests** (`Dialog.test.tsx`, `installResizeObserverMock`): footer classes include `sticky` and `-bottom-1`; the body's style variable follows a mocked footer height; a footer inside a `<form>` inside `Dialog.Content`; DOM order unchanged; the outside-content warning still fires; axe.
- **Stories.** `Dialog.stories.tsx`: `LongContent` (a form with 20 fields and a sticky footer). The lead's Storybook check (§6.2) scrolls it to the end and confirms that no content shows below the footer in the three themes.
- **Docs.** README "Dialogs and triggers": the footer stays in view. CHANGELOG Changed (visual): "`Dialog.Footer` sticks to the bottom of the dialog body while the content scrolls".
- **Compatibility.** Visual change.

### P1-22 — Tooltip controlled open state (P1-overlays)

- **Closes:** `tooltip-1`.
- **API** (D7):
  ```ts
  /**
   * Controlled open state (Fluent's `visible`). The tooltip still asks to open on hover and focus
   * (after `delay`) and to close on leave, blur and Escape through `onOpenChange`. The surface
   * renders only in the browser: an open tooltip is closed in the server HTML and opens once it
   * has hydrated.
   */
  open?: boolean;
  /** Initial open state for uncontrolled usage. @default false */
  defaultOpen?: boolean;
  /** Called with the new open state when it changes (Fluent's `onVisibleChange`). No `details`
   *  argument yet (D7). */
  onOpenChange?: (open: boolean) => void;
  ```
- **Behaviour.** `const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange)`; `show`/`hide`/`scheduleHide` call `setOpen` instead of the 0.5 internal state; the rendered state is `open && isClient` (`useIsClient`). A controlled `open={true}` shows the surface without hover and registers the Escape layer; a controlled `open={false}` never shows it, while hover and focus still request `true`. The description element (`role="tooltip"`, `hidden`) is unchanged, so the relationship works on the server.
- **Files.** `Tooltip.tsx`.
- **Guards** (WaveUI strength "Tooltip text in the server HTML"): the 0.5 SSR test of the `hidden` description stays green unchanged.
- **Tests** (`Tooltip.test.tsx`): controlled `open` shows the surface without hover and Escape calls `onOpenChange(false)`; hover calls `onOpenChange(true)` once after `delay` (fake timers, StrictMode); a controlled `false` blocks showing; `defaultOpen` shows after hydration (`renderToString` has no surface; `hydrateRoot` without warnings, then the surface); axe open.
- **Stories.** `Tooltip.stories.tsx`: `Controlled`.
- **Docs.** CHANGELOG Added.
- **Compatibility.** Additive.

### P1-23 — Menu fits the viewport; triggers respect `aria-disabled` (P1-navigation)

- **Closes:** `menu-3`.
- **API.** None (`Menu.Popover` JSDoc: "A menu taller than the space available scrolls inside the viewport").
- **Behaviour.**
  - `Menu.Popover` calls `usePopupPosition({ open, side, align, offset, fitViewport: true })`; the surface classes add `overflow-y-auto overscroll-contain`. Moving focus with the keys scrolls the focused item into view (native `focus()`).
  - `Menu.Trigger` (D19): the click and key handlers return early, without `preventDefault()`, when `isDisabledTrigger(event)` is true: the event's `target` or one of its ancestors up to and including `event.currentTarget` has `aria-disabled="true"` (`(event.target as Element).closest('[aria-disabled="true"]')`, accepted only when `event.currentTarget.contains` it). This covers the trigger element itself (`asChild`) and the focusable element inside a wrapper `<span>` (`asChild={false}`, or the automatic fallback of `useTriggerElement`).
- **Guards** (WaveUI strength "the dismiss-layer stack (Escape routed by focus, nested portals count as inside)"): the 0.5 Escape-routing and nested-portal tests stay green unchanged.
- **Files.** `Menu.tsx`.
- **Tests** (`Menu.test.tsx`): the surface has `overflow-y-auto` and a `max-height` style while open; a plain `<button aria-disabled="true">` inside `Menu.Trigger` (the real `MenuButton disabledFocusable` case is INTEGRATION §4.5 #2, §0.2 rule 9) does not open on click, Enter, Space, ArrowDown or ArrowUp and keeps focus, both as the child (`asChild`) and inside the wrapper span (`asChild={false}`); an enabled trigger is unchanged; axe for a 40-item menu.
- **Stories.** `Menu.stories.tsx`: `LongMenu` (40 items).
- **Docs.** README "Menus": long menus scroll; a `disabledFocusable` trigger does not open its menu. CHANGELOG Changed (behaviour): long menus fit the viewport and scroll; `Menu.Trigger` ignores `aria-disabled` triggers.
- **Compatibility.** Behaviour changes (improvements).

### P1-24 — Nav: a collapsed category shows it contains the current page (P1-navigation)

- **Closes:** `nav-7`.
- **API.**
  ```ts
  // NavProps
  /**
   * The `value` of the category that contains the current item, for sub-items Nav cannot find by
   * itself (rendered by your own component inside a closed category). Usually not needed: Nav
   * finds sub-items among a category's children (through Fragments and wrapper elements) and
   * remembers the category of the current sub-item once it has been shown. A hint, not state:
   * unlike Fluent's `selectedCategoryValue` it has no default or change callback.
   */
  currentCategory?: string;
  ```
- **Behaviour** (D18).
  - A **closed** `Nav.Category` "contains the current item" when `currentCategory === value`, or the static scan finds a `Nav.SubItem` with the current value among its children (the `findCategoriesContaining` scan that opens categories on first render), or the Nav remembers this category for the current value. For the last case a new category context tells each `Nav.SubItem` its category; a mounted sub-item records `{ value, category }` in a small store owned by the Nav from a layout effect (a store call, not `setState`), and categories read it with `useSyncExternalStore` (the TabList registry pattern, C-HOOKS). An entry outlives the sub-item's unmount, so closing the category keeps the mark; it is used only while its `value` is current.
  - Such a category's toggle button gets `aria-current="true"`, `data-contains-current=""` (boolean, D22) and the selection indicator of `Nav.Item` (the same classes behind `data-[contains-current]:`). An open category does not (its sub-item shows the current page).
- **SSR.** The static scan works on the server.
- **RTL.** The indicator uses the existing logical classes.
- **Guards** (WaveUI strength "Nav is a real `<nav>` with lists and disabled items"): the 0.5 structure and disabled-item tests stay green; the new category context adds no element.
- **Files.** `Nav.tsx`.
- **Tests** (`Nav.test.tsx`): server-rendered closed category marked (`renderToString`); selecting a sub-item and then closing its category marks it; a sub-item rendered by a component is marked only with `currentCategory`; open categories are not marked; changing the current value to a top-level item clears the mark; axe.
- **Stories.** `Nav.stories.tsx`: `CollapsedCurrent`.
- **Docs.** CHANGELOG Added.
- **Compatibility.** Additive (new attributes and look on collapsed categories).
- **Size.** M (a category context and a `useSyncExternalStore` store).

### P1-25 — TabList manual activation (P1-navigation)

- **Closes:** `tab-3`.
- **API** (D8):
  ```ts
  /**
   * Whether moving focus with the arrow keys, Home and End also selects the tab (automatic
   * activation, as in 0.5). With `false`, the keys only move focus and Enter, Space or a click
   * selects the focused tab (manual activation, for panels that are slow to show). Fluent's
   * default is `false`.
   * @default true
   */
  selectTabOnFocus?: boolean;
  ```
- **Behaviour.** `useRovingTabIndex({ …, onFocusMove: selectTabOnFocus ? (next) => select(next) : undefined })`. The tab stop stays on the selected tab (`tabStop: 'active'`), so Tab away and back returns to it (APG). Enter and Space activate the focused tab button natively. `onTabSelect` (deprecated) fires on activation only.
- **RTL.** Unchanged (`getArrowIntent` in the roving hook).
- **Guards** (WaveUI strength "TabList panels (`TabList.Panel`/`TabList.Panels`)"): the 0.5 panel tests stay green; with manual activation the shown panel follows the selected tab, not the focused one (a new test).
- **Files.** `TabList.tsx`.
- **Tests** (`TabList.test.tsx`): with `false`, ArrowRight moves focus without changing `aria-selected` or calling `onValueChange`; Enter and Space select (once in StrictMode); Tab out and Shift+Tab back lands on the selected tab; RTL arrows; vertical orientation; the default stays automatic (0.5 tests unchanged).
- **Stories.** `TabList.stories.tsx`: `ManualActivation`.
- **Docs.** Keyboard table TabList row: "with `selectTabOnFocus={false}`, arrows only move focus". CHANGELOG Added.
- **Compatibility.** Additive.

---

## 3. Packages and file ownership

Disjoint. Tests and stories of a component belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS owns the documentation files (wave D). No file appears in two rows. F1 runs alone in wave A and includes P1-13, so the `BadgeColor` widening and Badge's color map land together (D23).

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F1-foundation` (wave A) | `src/lib/types.ts`, `src/lib/aria.ts`, `src/hooks/useRovingTabIndex.ts`, `src/hooks/useFieldControl.ts`, `src/test-utils-field.tsx`, `src/lib/__tests__/aria.test.ts`, `src/lib/__tests__/types.test.ts`, `src/hooks/__tests__/useRovingTabIndex.test.tsx`, `src/hooks/__tests__/useFieldControl.test.tsx`, `src/__tests__/test-utils.test.tsx` (field-helper cases), `src/styles/__tests__/tokens.test.ts`; for P1-13: `src/components/data-display/Badge.tsx`, `src/components/data-display/__tests__/Badge.test.tsx`, `stories/Badge.stories.tsx`, `stories/_helpers.ts` (the `badgeColors` list) | `src/components/data-display/Badge.colors.ts` | P1-00, P1-13 |
| `P1-buttons` | `src/components/button/{Button,CompoundButton,SplitButton,ToggleButton,MenuButton,Link,Toolbar}.tsx`, `src/components/button/buttonStyles.ts` (only if a class map must change), their tests in `src/components/button/__tests__/`, `stories/{Button,CompoundButton,SplitButton,ToggleButton,MenuButton,Link,Toolbar}.stories.tsx` | `src/components/button/Button.semantics.ts`, `src/components/button/__tests__/Button.semantics.test.ts` | P1-01 … P1-05 |
| `P1-form` | `src/components/input/{Field,Checkbox,Switch,RadioGroup,Slider,Rating,ColorPicker}.tsx` (ColorPicker: one expression, P1-06), their tests in `src/components/input/__tests__/`, `stories/{Field,Checkbox,Switch,RadioGroup,Slider,Rating}.stories.tsx` | — | P1-06 … P1-10 |
| `P1-pickers` | `src/components/input/{Combobox,Dropdown,TimePicker}.tsx`, their tests in `src/components/input/__tests__/`, `stories/{Combobox,Dropdown,TimePicker}.stories.tsx` | `src/components/input/pickerStyles.ts` | P1-11, P1-12 |
| `P1-display` | `src/components/data-display/{CounterBadge,Tag}.tsx` (Tag: JSDoc only), their tests in `src/components/data-display/__tests__/`, `stories/{CounterBadge,Tag}.stories.tsx` | — | P1-14, P1-15 |
| `P1-feedback` | `src/components/feedback/{Spinner,ProgressBar,Toast}.tsx`, their tests in `src/components/feedback/__tests__/`, `stories/{Spinner,ProgressBar,Toast}.stories.tsx` | — | P1-16 … P1-18 |
| `P1-overlays` | `src/components/overlays/{Dialog,Dialog.shared,Drawer,Tooltip}.tsx`, their tests in `src/components/overlays/__tests__/`, `stories/{Dialog,Drawer,Tooltip}.stories.tsx` | — | P1-19 … P1-22 |
| `P1-navigation` | `src/components/navigation/{Menu,Nav}.tsx`, `src/components/layout/TabList.tsx`, their tests in `src/components/navigation/__tests__/` and `src/components/layout/__tests__/`, `stories/{Menu,Nav,TabList}.stories.tsx` | — | P1-23 … P1-25 |
| `INTEGRATION` (wave C) | `src/index.ts`, `src/components/*/index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, story import normalisation and argTypes moves (any `stories/*.stories.tsx`, `stories/_helpers.ts`), `scripts/verify-dist.mjs` (only if a flat-name check needs it) | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` (status line) | — | docs |

Inside `P1-buttons` the items run in the order P1-05 (the semantics module) → P1-01 → P1-04 → P1-02, P1-03: P1-04 builds on the module, and P1-02/P1-03 need `disabledFocusable` on Button. Splitting the package would put `Button.tsx` in two packages (§8).

Waves:
1. **Wave A:** F1-foundation. Exit: §1.7.
2. **Wave B:** the seven component packages in parallel. Each reports its barrel requests, the 0.5 tests it updated (with the reason) and any change request. Wave-B tests follow §0.2 rule 9, so each package can make its own tests pass without the others. The full suite is expected to fail in one known place between wave B and wave C: `src/__tests__/integration.test.tsx` (the Drawer `onOpenChange` assertion, §6.3), which only INTEGRATION may edit.
3. **Wave C:** INTEGRATION: barrels (§4.4), the cross-package tests (§4.5), `public-types.test.ts` additions, story import normalisation, the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave E (lead):** the final gate (§6) and the per-theme Storybook check of the new stories.

---

## 4. Cross-package contracts

### 4.1 `disabledFocusable` (P1-buttons, P1-form, P1-navigation, F1)

- The attribute set is exactly `aria-disabled="true"`, `data-disabled=""`, `data-disabled-focusable=""`, from `focusableDisabledProps(true, { reachable: true })` (F1). Nothing else in 0.6 renders `data-disabled-focusable`; self-disabling controls keep calling `focusableDisabledProps(disabled)` without the option.
- `useRovingTabIndex` treats `data-disabled-focusable` items as enabled unless they are natively disabled or marked `data-roving-disabled` (F1, D3); Toolbar relies on it.
- `Menu.Trigger` ignores activation from an `aria-disabled="true"` element at or inside the trigger (P1-navigation, D19); Button blocks Enter and Space itself and forwards other keys (P1-buttons, D2).

### 4.2 Field validation (F1, P1-form, P1-feedback, P1-pickers)

- `FieldContextValue.validationState` and `.validationMessageId` are provided by Field (P1-form) and read by `useFieldControl` (F1), ColorPicker's hex input (P1-form) and ProgressBar (P1-feedback). `invalid` is `true` only for the error state.
- Controls that show their own error (`Input` `error`, DatePicker and TimePicker rejected text) keep using `hasErrorMessage` (error state with a message only).
- Wave-B packages test Field consumption only through `renderWithFieldContext` (§1.5); the real Field around other packages' controls is INTEGRATION §4.5 #3 and #4.

### 4.3 Shared modules

- `Badge.colors.ts` is private to `src/components/data-display/`; F1 creates it with Badge (P1-13), and in wave B CounterBadge (P1-display) imports it; no other package does.
- `pickerStyles.ts` is private to `src/components/input/`; Combobox, Dropdown and TimePicker import it (all P1-pickers).
- The open-change types (`OpenChangeDetails`, `ModalOpenChangeReason`, `ModalType`) live in `src/lib/types.ts` (F1); P1-overlays only aliases them.

### 4.4 Barrel requests (INTEGRATION applies)

- `src/components/input/index.ts`: types `TimePickerInvalidReason`, `DropdownLabels`, `RatingDisplayLabels`, `CheckboxLabelPosition`, `SwitchLabelPosition`.
- `src/components/feedback/index.ts`: types `SpinnerAppearance`, `ProgressBarColor`.
- `src/components/overlays/index.ts`: types `DialogModalType`, `DialogOpenChangeReason`, `DialogOpenChangeDetails`, `DrawerOpenChangeReason`, `DrawerOpenChangeDetails`.
- `IconPosition`, `ValidationState`, `LabelPosition`, `OpenChangeDetails`, `ModalOpenChangeReason`, `ModalType` and the widened `BadgeColor` are public through `export type * from './lib/types'` (no change).
- No new components or compound parts, so no new flat names for `verify-dist`.

### 4.5 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

These are the cases that need two wave-B packages at once (§0.2 rule 9); they are the only place where the real components meet.

1. Toolbar with Button, `Button disabledFocusable`, ToggleButton: arrows reach the focusable-disabled button, Enter does nothing, a Tooltip on it opens on focus.
2. `Menu.Trigger` around `MenuButton disabledFocusable` and around a `SplitButton disabledFocusable` menu half, each as the child and with `asChild={false}`: no opening by click, Enter, Space, ArrowDown or ArrowUp.
3. `Field` with `validationState="warning"` around Input, Checkbox, Combobox, ColorPicker and a native `<input>`: described by the message and the hint, never `aria-invalid`; with `error`: `aria-invalid` on each.
4. `<Field label hint validationState="warning" validationMessage>` around ProgressBar: named by the label, described by message and hint, warning fill, no `aria-invalid`/`aria-required`, no warning logged; the same with `validationState="error"`; axe.
5. `Dialog modalType="alert"` with a `Toaster`: a toast stays reachable and announced while the alert is open; a backdrop press does not close the alert.
6. `Dialog` with a `<form>` wrapping 20 fields and a `Dialog.Footer`: focusing the last field keeps it above the footer (scroll-padding variable present).
7. Update the existing Drawer + Tooltip case (`onOpenChange` asserted with `toHaveBeenCalledWith(false)`): expect `(false, expect.objectContaining({ reason: 'escape' }))`.

### 4.6 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

`expectTypeOf` for every new prop and union exported from the package entry, including: `ButtonProps<'a'>['disabledFocusable']`, `CompoundButtonProps['icon']`, `FieldProps['validationState']`, `CheckboxProps['label']` accepting a ReactNode, `CheckboxLabelPosition` equal to `'before' | 'after'`, `CounterBadgeProps['count']` optional, `DialogProps['onOpenChange']` accepting `(open: boolean) => void` and callable with one argument, `DialogOpenChangeDetails['reason']` equal to `ModalOpenChangeReason`, `NavProps['currentCategory']`, `ToastController['dismissAllToasts']`, and `@ts-expect-error` for invalid values (`iconPosition="end"`, Checkbox `labelPosition="above"`, Switch `labelPosition="below"`, `modalType="non-modal"`).

---

## 5. CHANGELOG, README and CLAUDE.md (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.6.0] - Unreleased` section above `## [0.5.0] - Unreleased`:

- **Intro:** the first Fluent-parity release (link `docs/ROADMAP.md`); nothing public removed or narrowed; list of behaviour changes to read before upgrading.
- **Added** (by component): P1-01 … P1-25 APIs, each with the gap it closes.
- **Changed:**
  - Behaviour: the Field hint shows next to a message; Field error messages show an icon; TimePicker keeps and flags rejected text; a Link or `Button as="a"` without `href` (and `Link as="span"`) is a focusable button; a disabled Link no longer lets its click reach ancestors or Enter/Space through, and a disabled Link or `Button as="a"` without `href` has `role="button"` (was `link`); `Menu.Trigger` ignores `aria-disabled` triggers; long menus scroll inside the viewport; a consumer `aria-disabled` on Switch and Checkbox goes to the control; ProgressBar inside a Field is named, described and colored by it; a Badge or CounterBadge with a name gets `role="img"`; Checkbox, Switch and `RadioGroup.Item` warn about unrendered `children`; `SplitButton` warns about a `menuIcon` that renders nothing; toast timers start when the toast is shown (no visible difference without `limit`).
  - Visual: Slider progress fill; Combobox and TimePicker chevron; sticky `Dialog.Footer`; collapsed Nav categories marked.
  - DOM: CompoundButton text wrapper; Combobox and Dropdown control wrappers; `data-disabled` on disabled Buttons; new `data-*` state attributes, enumerated ones always present with their value (`data-validation-state`, `data-orientation`, `data-label-position`, `data-color`, `data-appearance`, `data-modal-type`, `data-state` on Spinner) and boolean ones present or absent (`data-dot`, `data-compact`, `data-contains-current`, `data-disabled-focusable`); Field message ids `<fieldId>-message` for non-error states.
  - Types: `label` of Checkbox, Switch and `RadioGroup.Item` widened to `ReactNode`; `CounterBadgeProps.count` optional; `BadgeColor` adds `severe` and `subtle`; `ToastController.dismissAllToasts` (implementers must add it); `FieldContextValue` optional members; `onOpenChange` of Dialog and Drawer has a second, optional `details` argument (handlers and callers keep compiling; test assertions such as `toHaveBeenCalledWith(false)` need `expect.anything()`); `focusableDisabledProps` takes an optional second argument (internal).
- **Deprecated:** Badge `color="important"` (D1 wording). Notice: the `details` parameter of Dialog and Drawer `onOpenChange` becomes required in 1.0 (read it as `details?.reason`).
- **Size:** the size report of `dist/styles.css` and the two `verify-dist` probes (Button-only, full import) against 0.5.0.

### 5.2 README

- "Buttons": `iconPosition`, `disabledFocusable` (next to the `disabled` bullets; the `aria-disabled` bullet points to it), anchors without `href`, the SplitButton `menuIcon` rule.
- "Forms and `Field`": validation states and `validationMessage`, `error` as the shorthand, the hint rule, `orientation`, ProgressBar in a Field, rich choice labels and `labelPosition`.
- "Menus": long menus; `disabledFocusable` triggers.
- "Dialogs and triggers": `modalType="alert"`, `onOpenChange` details, the sticky footer.
- "Toasts": `limit`, `dismissAllToasts`.
- New short notes: Badge colors (`severe`, `subtle`, the `important` notice) and Tags (the focus recipe of P1-15).
- "Built-in text": Combobox (`clear`, `expand`), TimePicker (`expand`, `invalidTime(format)`, `outOfRange(min, max)`), Dropdown (`labels.clear`), RatingDisplay (`labels.rating(value, max, formattedValue)`, `labels.count`).
- "Keyboard support": Toolbar (`disabledFocusable`), TabList (`selectTabOnFocus`), Combobox/TagPicker/TimePicker (chevron not a tab stop, clear button is; TimePicker keeps and flags rejected text), Menu (triggers with `aria-disabled`).
- "Upgrading": a short "from 0.5 to 0.6" list pointing to the CHANGELOG "Changed" section.

### 5.3 CLAUDE.md

- "User docs": add `docs/ROADMAP.md` and this spec.
- C-DISABLED: "`disabledFocusable` (button family, Link, Switch, Checkbox) renders `focusableDisabledProps(true, { reachable: true })` (`aria-disabled`, `data-disabled`, `data-disabled-focusable`), stays in the tab order, prevents activation without calling the consumer's handler, and stays in roving containers' arrow order; self-disabling controls call `focusableDisabledProps(disabled)` without the option (skipped by roving)."
- C-NAMING: "Fluent's names are the default when they fit these rules (`disabledFocusable`, `iconPosition`, `validationState`, `modalType`, `selectTabOnFocus`); extra callback data goes in a second `details` argument (`onOpenChange(open, details?)` with `OpenChangeDetails<R>` from `lib/types`), typed optional through 0.x and required from 1.0."
- C-SLOTS: the default-glyph rule of D21 (optional indicators: nullish keeps the default, renders-nothing hides; required indicators never hide and warn; status icons: only `undefined` keeps the default; a `<button>` in a glyph slot is unwrapped, never nested).
- C-CLASS: the rule of D22 (enumerated `data-*` always rendered with the resolved value, boolean ones present or absent).
- "Field wiring": `FieldContextValue.validationState`/`validationMessageId`; only the error state sets `aria-invalid`; describe with `validationMessageId ?? errorId` then `hintId` (done by `useFieldControl`).

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md`: Pattern 8 (Composite Controls and Field) gets the validation states; the Accessibility chapter's keyboard patterns get manual tab activation and focusable disabled toolbar items.
- `docs/testing-best-practices.md`: `renderWithFieldContext` `validationState`/`validationMessageId`/`message`; asserting `onOpenChange` details; the wave rule that cross-package cases live in the integration suite.

---

## 6. Verification and exit criteria

### 6.1 Per package (wave B)

The checks of §0.2 rule 8, with clean output. Every new behaviour has a test that failed first.

### 6.2 Final gate (wave E)

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`; the stories axe gate and the conventions gate green; the lead checks every new story in the light, dark and high-contrast themes and in RTL (the Dialog `LongContent` story scrolled to the end, P1-21). The lead bumps `package.json` to 0.6.0 at release time, not in this phase's packages.

### 6.3 Existing tests expected to change (update, do not delete)

- `Field.test.tsx`: the hint was hidden while an error showed — it now stays visible. Error messages now contain an `aria-hidden` icon and wrap their text in a `<span>`: assertions that compare the `<p>`'s children or markup change; assertions on its text content or accessible description do not. The root now always has `data-orientation` and `data-validation-state`: exact attribute snapshots change.
- `TimePicker.test.tsx`: rejected text reverted on blur — now kept and flagged; counts of `button` elements (the chevron).
- `Combobox.test.tsx`, `Dropdown.test.tsx`: assumptions that the control is the root's direct child, or counts of `button` elements.
- `CompoundButton.test.tsx`: DOM structure of the text lines.
- `Link.test.tsx`, `Button.test.tsx`: a Link or `as="a"` without `href` had no role or tab stop; a disabled Link's click reached ancestors; a disabled `<a>` without `href` had `role="link"`.
- `Dialog.test.tsx`, `Drawer.test.tsx`: `onOpenChange` assertions without the details argument.
- `src/__tests__/integration.test.tsx` (INTEGRATION, wave C): the Drawer + Tooltip case asserts `onOpenChange` with `toHaveBeenCalledWith(false)` (about line 609); it fails from the moment P1-overlays lands until INTEGRATION updates it (§3, §4.5 #7).
- `Menu.test.tsx`: exact `style` assertions on the surface (now with `max-height`).
- `Toast.test.tsx`: timer start moved from dispatch to the show effect (timings of existing tests unchanged when there is no `limit`).
- `Switch.test.tsx`, `Checkbox.test.tsx`: tests that passed `aria-disabled` and looked for it on the root label; exact attribute snapshots (`data-label-position`).
- `Badge.test.tsx`, `CounterBadge.test.tsx`, `Spinner.test.tsx`, `ProgressBar.test.tsx`: exact attribute snapshots (the new always-present `data-*`).
- `Toolbar.stories.tsx` description of `WithDisabledControl`.

### 6.4 Definition of done for Phase 1

Every item's tests pass; the gap ids of §7 are closed; the CHANGELOG 0.6.0 section, README, CLAUDE.md and guides are updated; `docs/ROADMAP.md` marks Phase 1 as released when 0.6.0 ships.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `buttons-2` | medium | P1-01 | P1-buttons |
| `buttons-6` | medium | P1-02 | P1-buttons |
| `buttons-13` | medium | P1-03 | P1-buttons |
| `buttons-3` | medium | P1-04 | P1-buttons |
| `buttons-17` | low | P1-04 | P1-buttons |
| `buttons-21` | low | P1-04 | P1-buttons (+ F1 roving) |
| `buttons-15` | medium | P1-05 | P1-buttons |
| `buttons-5` | low | P1-05 | P1-buttons |
| `form-basic-1` | medium | P1-06 | P1-form |
| `form-basic-3` | medium | P1-06 | P1-form |
| `form-basic-5` | medium | P1-06 | P1-form |
| `field-1` | medium | P1-06 | P1-form |
| `field-4` | medium | P1-06 | P1-form |
| `form-basic-2` | low | P1-06 | P1-form |
| `field-2` | low | P1-06 | P1-form |
| `field-3` | low | P1-06 | P1-form |
| `form-basic-16` | medium | P1-07 | P1-form |
| `form-basic-19` | medium | P1-07 | P1-form |
| `form-basic-22` | medium | P1-07 | P1-form |
| `form-basic-17` | low | P1-07 | P1-form |
| `form-basic-25` | low | P1-07 | P1-form |
| `form-basic-24` | low | P1-08 | P1-form |
| `form-basic-29` | medium | P1-09 | P1-form |
| `form-basic-43` | medium | P1-10 | P1-form |
| `form-basic-44` | medium | P1-10 | P1-form |
| `form-basic-45` | low | P1-10 | P1-form |
| `form-basic-47` | low | P1-10 | P1-form |
| `combobox-2` | medium | P1-11 | P1-pickers |
| `combobox-4` | medium | P1-11 | P1-pickers |
| `dropdown-2` | medium | P1-11 | P1-pickers |
| `timepicker-1` | medium | P1-12 | P1-pickers |
| `badge-2` | medium | P1-13 | F1-foundation |
| `counterbadge-1` | medium | P1-14 | P1-display |
| `counterbadge-2` | medium | P1-14 | P1-display |
| `counterbadge-3` | low | P1-14 | P1-display |
| `spinner-1` | medium | P1-16 | P1-feedback |
| `spinner-2` | low | P1-16 | P1-feedback |
| `progress-1` | medium | P1-17 | P1-feedback |
| `progress-2` | medium | P1-17 | P1-feedback |
| `toaster-1` | medium | P1-18 | P1-feedback |
| `toastctl-1` | low | P1-18 | P1-feedback |
| `dialog-1` | medium | P1-19 | P1-overlays |
| `dialog-3` | medium | P1-20 | P1-overlays |
| `dialogbody-1` | medium | P1-21 | P1-overlays |
| `tooltip-1` | medium | P1-22 | P1-overlays |
| `menu-3` | medium | P1-23 | P1-navigation |
| `nav-7` | medium | P1-24 | P1-navigation |
| `tab-3` | medium | P1-25 | P1-navigation |
| `taggroup-1` | medium | mitigated by P1-15 (closed by P6-02) | P1-display |
| `badge-1` | medium | mitigated by P1-13 (closed by P14-05) | F1-foundation |

Totals: 34 medium and 14 low gaps closed; 2 medium gaps mitigated.

---

## 8. Review notes

Three reviews of the first draft (API conventions, roadmap sequencing, Phase 1 against the code) were applied to this spec and to `docs/ROADMAP.md`, except for the points below, which were rejected in full or in part.

1. **Dropdown `labels` instead of `clearLabel`** (partly rejected). C-NAMING allows a single `<thing>Label` prop for one string, but every other picker names its clear button through `labels.clear` (Combobox, DatePicker, TimePicker, TagPicker), and ROADMAP P5-01/P5-03 add more Dropdown strings. `labels` keeps the family in one shape. The other parts of that point were applied: no `readOnly` in Dropdown's JSDoc, one clear-button visibility rule for all pickers (D14), and the TimePicker chevron (P1-11).
2. **A `<button>` passed to `expandIcon` is unwrapped, not merged** (partly rejected). The expand button's name, state and focus behaviour (`aria-label`, `aria-expanded`, `aria-controls`, `tabIndex={-1}`) all belong to the component, so the props of a consumer button have nowhere to go. The merge rule of C-SLOTS stays for dismiss and clear slots, whose content can name the button. The rest of the slot rule was applied (D21).
3. **P1-buttons is not split into two packages.** P1-01…P1-03 and P1-04/P1-05 all edit `Button.tsx`, so a split would need `Button.tsx` owned by two packages or a sequenced hand-over inside wave B. The package keeps one owner and states its internal order instead (§3).
4. **Toaster promotion without `limitRef`** (the mechanism differs from both proposals). Reading a ref inside a `setToasts` updater is a render-time ref read (C-HOOKS), and the timeout path has no event from which to pass `limit`. P1-18 promotes during render instead, with the "adjust state while rendering" pattern, which sees the current `limit` on every path.
5. **The duplicate gap id `nav-1` is not renamed in the gap list.** This revision may only edit `docs/ROADMAP.md` and this spec. The roadmap keeps writing the table gap as `table/nav-1` (its §8.1 explains the notation) and asks for a unique id (`table-nav-1`) when the gap list is next regenerated.
6. **Phase 6 is not split into two releases.** The review's alternative was taken: the tree epic moved to 0.8.0 together with the high gap `tree-1`, so 0.11.0 keeps tags, drawers and the app shell (9 items, none of them L apart from the composable TagPicker) without adding a release.

---

## 9. Implementation notes

Where the 0.6.0 code deliberately differs from §0–§5, and why. The package reports of the implementation and of the verification fix round record the evidence; the CHANGELOG describes each change for users.

- **P1-19, `modalType` JSDoc.** The text in P1-19 is the implemented one. The first wording ("Put the least destructive action first or give it `autoFocus`") was wrong: initial focus goes to the first focusable element, which is always the built-in Close button, so the order of the consumer's buttons does not decide it.
- **P1-19 and P1-20, backdrop press and focus.** Only a press that cannot close the surface keeps focus without a blur (the alert dialog: `preventDefault()` on the backdrop's `mousedown`). A press that closes the surface moves focus to `<body>` first, as in 0.5, so the focused control's blur-time commit runs before the surface unmounts (a SpinButton's or picker's typed value). A controlled parent that refuses `outside-press` gets focus back on the field the press blurred, in a microtask, unless it moved focus elsewhere (`useBackdropPress` in `Dialog.shared.tsx`).
- **P1-21, `Dialog.Footer` outside `Dialog.Content`.** The sticky classes apply only where the surface reserves the footer's height (`setFooterHeight` in the surface context, that is inside `Dialog.Content`). Inside a Drawer, or outside any surface, the footer is the 0.5 action row `mt-6 flex justify-end gap-2`, without a new warning.
- **P1-06, horizontal Field alignment.** The label keeps `pt-1.5`, which centres its first line on a 32px row. The control column's first child gets `py-1.5` when it holds a checkbox, a switch or a labelled radio (`[&>:first-child:has([role=checkbox],[role=switch],label>[role=radio])]:py-1.5`), so a 20px-row control gets a 32px first row like an Input, also when its own label wraps. A `flex min-h-8 items-center` label was rejected: it split the required asterisk from the text and did not align wrapped labels. Rating and Slider are not padded.
- **P1-07, choice-control alignment.** The Checkbox, Switch and `RadioGroup.Item` roots are `items-start` (the Switch `above` layout is `flex-col gap-1`), and a labelled box or radio gets `mt-px`, so the indicator lines up with the first line of a label that wraps instead of its middle. Arrow keys, Home and End pressed on a link inside a `RadioGroup.Item` label are not handled by the group.
- **P1-14, CounterBadge dot colors.** `Badge.colors.ts` has a `dot` fill and a `dotBorder` ring per color. A dot has no text, so each dot keeps 3:1 on `background` in every theme (asserted in `tokens.test.ts`): `informative` uses `muted-foreground` and `warning` uses `warning-tint-foreground` instead of their count fills (`muted`, `warning`), which are about 1.1–1.3:1 on the light page; `subtle` stays the page color, for colored surfaces. A `color` outside the palette (untyped code) renders as `brand`, and `CounterBadgeProps.color` narrows the inherited `color?: string` like ProgressBar's.
- **D13, empty names.** Badge and CounterBadge add `role="img"` only for an `aria-label` or `aria-labelledby` that is not empty or whitespace only.
- **P1-17, ProgressBar id.** The bar passes `id ?? (field ? ownId : undefined)` to `useFieldControl`: inside a Field it never claims the Field's control id (the `<label htmlFor>` stays with an Input next to it in a wrapper); as the Field's first child it keeps the id Field passes it; outside a Field it renders no id, as in 0.5.
- **P1-23, Menu size limit.** The limits are the classes `max-h-(--wave-popup-available-height) max-w-(--wave-popup-available-width)` on the surface, and the `maxHeight`/`maxWidth` keys of the positioning style are not spread, so a consumer `max-h-*`/`max-w-*` class replaces the limit through `cn`. P1-23's "a `max-height` style" test is met by the class.
- **P1-24, Nav category recording.** Besides sub-items, `Nav.Item` records its category (`null` at the top level), and a closed `Nav.Category` whose children statically hold the current value records itself from a layout effect and forgets the entry on cleanup while the entry still names it. So an item moved into another category marks only that category.
- **P1-03 and D21, button glyphs.** SplitButton and MenuButton `menuIcon` unwrap a `<button>`/`Button` (element, or slot object whose `as` is one) like `expandIcon`, through the shared `unwrapButtonGlyph` of `src/components/button/Button.slots.tsx`, which `PickerExpandButton` uses too. Only the button's children become the glyph; its `icon` prop is dropped.
- **C-SLOTS, a Button merged into a dismiss or clear slot.** The Button's own props (`BUTTON_OWN_PROP_KEYS`, checked against `ButtonOwnProps` by the compiler) never reach the wired `<button>`: `icon` and `iconPosition` become content, and `disabledFocusable` is honoured (spread last, it wins over `disabled`, SearchBox's own included).
- **D2, the disabled look.** A focusable disabled control goes back to full opacity while it shows its focus ring, because `opacity` dims the ring below 3:1: `aria-disabled:focus-visible:opacity-100` on the button family, Link, the merged dismiss and clear buttons and `disabledStyles` (self-disabling Pagination, Carousel and DatePicker month buttons, and the DatePicker's unavailable calendar days), and `has-focus-visible:opacity-100` on the dimmed root of Checkbox, Switch, `RadioGroup.Item`, SearchBox and Input (with slots), which lifts for any focus ring inside it (the control's, a link's in a label, a focusable clear button or slot content). Disabled color tokens without opacity (Fluent's approach) are left for a later phase.
- **P1-12 and D14, TimePicker and DatePicker focus.** Enter and leaving the input both close TimePicker's list, whether they commit or reject the text, and Tab closes a list that shows only a status text. Tab from erased text while the clear button shows commits the empty value in the keydown (`flushSync`), before the browser moves focus, so Tab goes on to the next tab stop (DatePicker's calendar button) instead of to the clear button that the commit removes.
- **The `wave-rtl:` variant.** It selects `&:where(:nth-child(n of :dir(rtl)))` under `@supports selector(:nth-child(n of :dir(rtl)))`, with the `[dir='rtl']` attribute fallback otherwise, because Lightning CSS (Vite's default minifier) rewrites a bare `:dir(rtl)` to a `:lang()` list for targets below Chrome 120 but keeps it inside `:nth-child(… of …)`. `scripts/verify-storybook.mjs` and `scripts/pack-smoke.mjs` (Vite builds of both fixtures) fail on a rewrite.
- **§4.5, integration cases.** Also in the integration suite: a SpinButton in a Dialog and in a Drawer whose typed value a backdrop press commits (a refused press too); the component tests keep the mechanism with a plain `<input onBlur>`.
- **§4.6, public types.** `public-types.test.ts` pins every new member exported from the entry, including the label members (`TimePickerLabels.expand`/`invalidTime`, `DropdownLabels.clear`, `RatingDisplayLabels.count`) and the literal unions `LabelPosition` and `ModalOpenChangeReason`.
- **§5.1, size report.** There are no `verify-dist` size probes: its tree-shaking probe is unminified and prints no sizes. The CHANGELOG's size table was measured once for the release with a script outside the repository (minified Vite builds of an entry that imports `dist/index.mjs`, bare imports external), in KiB.
