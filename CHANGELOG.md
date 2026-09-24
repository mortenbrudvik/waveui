# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - Unreleased

The full-review release: it addresses the 305 issues found by a review of the whole library (accessibility, theming, packaging, forms, overlays, keyboard support and tests). One is a partial won't-fix: Wave's Tailwind color utility names (`bg-primary`, `text-foreground`, …) stay unprefixed in 0.5, and namespacing them is being considered for 1.0; see the README's "Global effects" for the colliding names and workarounds. **Nothing public was removed.** Renamed props and values keep their 0.4 names as deprecated aliases that warn once in development and will be removed in 1.0. Changes of behaviour, DOM structure and types that are not renames are listed under [Changed](#changed); read them before upgrading if you style Wave's internals or assert its DOM in tests.

### Upgrading from 0.4

1. **Package name.** The npm package has always been `@mortenbrudvik/waveui` (0.4.0 was published under that name), so an npm dependency needs no change. Before 0.5 the repository's `package.json` used the name `waveui`, and the 0.4 guide showed `import { WaveProvider } from 'waveui'`: replace such imports, and a git or local dependency named `waveui`, with `@mortenbrudvik/waveui` (`import { Button } from '@mortenbrudvik/waveui'`).
2. **Styles.** Pick one path:
   - Without Tailwind: keep `import '@mortenbrudvik/waveui/styles'`. It is now precompiled CSS and needs no Tailwind. Make sure every Wave tree is inside a `WaveProvider`: the base styles and the reset of native elements are scoped to it.
   - With Tailwind 4: replace the `./styles` import with `@import 'tailwindcss'; @import '@mortenbrudvik/waveui/tailwind';` in your CSS entry. Never import `./styles` as well.
   - With Tailwind 4 and a prefixed build (such as `prefix(tw)`): import `./styles` instead of `./tailwind`, in your CSS entry and into a cascade layer between Tailwind's `base` and `utilities`: `@layer theme, base, wave, components, utilities; @import 'tailwindcss' prefix(tw); @import '@mortenbrudvik/waveui/styles.css' layer(wave);`. Imported unlayered, Wave's base styles override your utilities inside `WaveProvider`. See the README's "Global effects".
   - 0.4 applied Tailwind's Preflight and `body` styles (Segoe font, 14px, theme colors) to the whole page. If markup outside `WaveProvider` relied on them, import `@mortenbrudvik/waveui/preflight.css` and style `body` yourself.
3. **CSS variables.** Rename overrides of the 0.4 semantic variables (`--primary`, `--primary-foreground`, `--background`, `--foreground`, `--card`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--subtle`, `--success`, `--warning`, `--error`, `--info`, `--severe`, …) to their `--wave-*` names. App CSS that **reads** 0.4 variables must switch to the `--wave-*` names as well: `var(--primary)`, `var(--ring)` (the 0.4 guide showed `outline: 2px solid var(--ring)`), and also the ramp names `var(--brand-*)` and `var(--grey-*)`, which 0.5 reads only as fallbacks and never defines. Until then, `import '@mortenbrudvik/waveui/legacy-tokens.css'` after the Wave styles defines the 0.4 names again (deprecated). Overrides of the 0.4 ramp names (`--brand-*`, `--grey-*`) keep working without any change; reads of them do not.
4. **Tailwind theme values.** 0.4 redefined Tailwind's `--radius-sm` … `--radius-3xl` and `--font-sans` for your whole app. Your own `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` and `rounded-3xl` classes now get Tailwind's default sizes (4, 6, 8, 12, 16 and 24px instead of 2, 4, 6, 8, 12 and 16px), and `font-sans` is Tailwind's stack again; use `font-wave` for Wave's font. Wave's own components look the same (they now use the Tailwind names that match their 0.4 sizes).
5. **Theme classes.** In your own CSS target `.wave-light`, `.wave-dark` and `.wave-high-contrast`; `.dark` and `.high-contrast` still work but are deprecated.
6. **Deprecated props.** Replace them using the [migration table](#migration-table). Each warns once in development. Mind the "fires" column: the new value callbacks fire only on change.
7. **Required fields.** A required `Field` now turns on the browser's constraint validation for the control inside it, not only `aria-required`: native inputs and the library Input, Select, Textarea, Slider, SpinButton and SearchBox while empty, and the choice and picker controls (Checkbox, Switch, RadioGroup, Rating, SwatchPicker, ColorPicker, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) until they are checked, switched on or have a value, also without `name`. `<Field required><Switch /></Field>` therefore blocks the submit while the switch is off. Forms that validate in their submit handler add `noValidate` to the `<form>`.
8. **Tests and custom styles.** Triggers no longer render a wrapper `<span>`, popups render in portals (query them with `screen`), boundary buttons use `aria-disabled`, composite controls put `id`/`aria-*` on their focusable element, PresenceBadge is `role="img"` (was `role="status"`), and the AvatarGroup overflow is a button. See [Changed](#changed).

### Migration table

`onChange` is now reserved for the native DOM change event. Value callbacks are `on<Thing>Change(value)`: single values use `value`/`defaultValue`/`onValueChange`, checked state `checked`/`defaultChecked`/`onCheckedChange`, open state `open`/`defaultOpen`/`onOpenChange`. When both the old and the new name are given, the new value wins and both callbacks are called.

| Component | Deprecated (0.4) | Use instead (0.5) | Fires |
|---|---|---|---|
| Checkbox, Switch | `onChange(checked)` | `onCheckedChange(checked)` | both: on change only |
| RadioGroup, Rating, SearchBox, SpinButton, ColorPicker, SwatchPicker, TagPicker, TimePicker, DatePicker | `onChange(value)` | `onValueChange(value)` | both: on change only |
| Input, Slider | — (`onChange` stays the native event) | `onValueChange(value)` (added next to `onChange`) | every change |
| Combobox, Dropdown | `onOptionSelect(value)` | `onValueChange(value)` | `onOptionSelect`: every option activation, re-selecting included; `onValueChange`: on change only |
| TabList | `selectedValue`, `defaultSelectedValue`, `onTabSelect`, `vertical` | `value`, `defaultValue`, `onValueChange`, `orientation` | `onTabSelect`: every activation; `onValueChange`: on change only |
| Nav | `selectedValue`, `defaultSelectedValue`, `onNavItemSelect` | `value`, `defaultValue`, `onValueChange` | `onNavItemSelect`: every activation; `onValueChange`: on change only |
| Nav.Category | label taken from the first string child | `label` prop | — |
| TeachingPopover | `currentStep`, `defaultCurrentStep` | `activeStep`, `defaultActiveStep` | — |
| List | `selectionMode="multi"` | `selectionMode="multiple"` | — |
| DataGrid | `selectedKeys`, `defaultSelectedKeys` (Set), `onSelectionChange(Set)` | `selectedItems`, `defaultSelectedItems`, `onSelectedItemsChange(string[])` | both: on change |
| DataGrid | `sortColumn`, `sortDirection`, `defaultSortColumn`, `defaultSortDirection` | `sort`, `defaultSort` (`{ columnId, direction }` or `null`) with `onSortChange(sort)` | every header activation |
| Table | `Table.Head`, `Table.HeadCell` (types `TableHeadProps`, `TableHeadCellProps`) | `Table.Header`, `Table.HeaderCell` (flat `TableHeader`, `TableHeaderCell`; types `TableHeaderProps`, `TableHeaderCellProps`). The flat `TableHead` and `TableHeadCell` exports are new in 0.5 and exist only as deprecated aliases. | — |
| Stack | `direction` | `orientation` | — |
| Skeleton | `variant` (`text`, `rectangular` → `rounded`; `circular`) | `shape` | — |
| Text | `weight={400 \| 600 \| 700}` | `weight="regular" \| "semibold" \| "bold"` | — |
| Link | `variant` (type `LinkVariant`) | `appearance` (type `LinkAppearance`), same values | — |
| Tooltip | `variant="dark" \| "light"` | `appearance="inverted" \| "normal"` | — |
| Accordion (single mode) | `openItems`, `defaultOpenItems`, `onOpenItemsChange` | `openItem`, `defaultOpenItem`, `onOpenItemChange` (`string \| null`) | on change only |

**Callback semantics.** Value callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange` and the deprecated `onChange` value aliases) fire only when the value changes. Event callbacks fire on every activation, as in 0.4, also when the current item is activated again: `onTabSelect`, `onNavItemSelect`, `onOptionSelect` (all deprecated), `onPageChange`, `onStepChange` and the new `Tree` `onItemSelect`. The DataGrid `onSortChange(columnId, direction)` form of 0.4 still works while neither `sort` nor `defaultSort` is given.

### Changed

#### Packaging

- The repository's `package.json` is named `@mortenbrudvik/waveui`, the name the npm package has always had (0.4's `package.json` said `waveui`; 0.4.0 was published as `@mortenbrudvik/waveui`).
- The build keeps one module per source file (ESM `.mjs` and CommonJS `.cjs`), so importing one component no longer bundles the whole library. `clsx` and `tailwind-merge` are no longer inlined into `dist`.
- Component and hook modules start with `"use client"`; the entry point, `cn`, the slot helpers and the types stay server-safe (React Server Components).
- CommonJS consumers get `index.d.cts` declarations (fixes TS1479 with the `require` condition).
- New runtime dependency `@floating-ui/react-dom` (popup positioning). `tailwindcss` `^4.1.0` is an optional peer dependency.
- New style entries: `./styles.css`, `./tailwind`, `./tailwind.css`, `./tokens.css`, `./preflight.css`, `./legacy-tokens.css` (see [Added](#added)).
- `repository`, `homepage` and `bugs` point to `github.com/mortenbrudvik/waveui`.

#### Styles

- `./styles` now points to precompiled, **unlayered** `dist/styles.css`: it works without Tailwind and contains no Preflight. It **requires `WaveProvider`**, which scopes the base styles and the native-element reset. Tailwind users import `./tailwind` instead (0.4's `./styles` was Tailwind source without `@source`, so components rendered unstyled).
- Preflight is opt-in (`./preflight.css`). The global `body` rules, the global `*` border color and the global `prefers-reduced-motion` override of 0.4 are gone: base styles apply only inside `.wave-root` and `.wave-portal`, and each component handles reduced motion itself.
- CSS variables are prefixed `--wave-*`. Overrides of the 0.4 ramp names (`--brand-*`, `--grey-*`) keep working (they are read as fallbacks), but Wave no longer defines them, so app CSS that reads them (`var(--brand-80)`) gets nothing. **Overrides of the 0.4 semantic names (`--primary`, `--background`, `--border`, …) no longer affect Wave, and reads of them (`var(--ring)`) resolve to nothing**, unless `./legacy-tokens.css` is imported (deprecated compatibility layer; migration: rename the overrides and reads to `--wave-*`).
- Theme classes are `wave-light`, `wave-dark` and `wave-high-contrast`. WaveProvider still emits the legacy `dark` and `high-contrast` classes next to them, and Wave's CSS still honours them, but they set only `--wave-*` variables (no collision with shadcn/ui-style `--primary` definitions).
- `color-scheme` is set on the theme classes only, never on `:root`.
- The library no longer overrides Tailwind's radius scale or `font-sans`. Wave components use Tailwind's default radius names; their visual radii are unchanged.
- Token values: `muted-foreground` darkens to `#616161` (was `#707070`) for contrast. Light theme: `subtle-pressed` is grey-92 `#ebebeb`, the same as `subtle-selected` (0.4 components used `active:bg-[#e0e0e0]`), so primary and success text on a pressed subtle control reach 4.5:1. Dark theme: `primary` is brand-110 `#62abf5` (was `#479ef5`); primary, destructive and status fills use black foreground text; `destructive`/`error` is `#f48a94` (was `#dc626d`); `success` is `#5db55d` (was `#54b054`), so success text reaches 4.5:1 on `muted` and `subtle-selected`; info text and icons use the new `info-tint-foreground`, `#62abf5` (the `info` fill stays `#479ef5`). High contrast: `selected` is `#003a40` with white text (was `#1aebff`); `destructive`/`error` is `#ff6e6e` (was `#ff6060`), so error text reaches 4.5:1 on the pressed and selected subtle states and on `selected`.
- **Button** (0.4 put `min-w-[96px]` on every Button):
  - An icon-only Button (an `icon` and no rendered label) is square (20, 24, 32, 40 or 48px from extra-small to extra-large) with no minimum width and no horizontal padding. A labelled Button keeps a minimum width, now written `min-w-24` (6rem: 96px at the default 16px root font size, and it follows the root font size like the heights).
  - Every appearance draws a 1px border: transparent for `primary`, `subtle` and `transparent`, the stroke token for `outline` (which already had one). With border-box sizing (inside WaveProvider, with Preflight, and for a native `<button>`) the fixed dimensions are unchanged: the height, the square icon-only size and the minimum width. A content-sized Button of those three appearances whose label makes it wider than the minimum is 2px wider than in 0.4. With content-box sizing (a non-button `as` such as `as="a"` outside WaveProvider and without Preflight) it is also 2px taller.
  - Labels follow the px type ramp: extra-small 10px, small 12px, medium 14px, large 16px, extra-large 18px on a 24px line (0.4: extra-large was 14px, smaller than large). Small, medium and large were rem-based in 0.4: at the default 16px root they are unchanged, but they no longer scale with the root font size.
  - All colors are theme tokens (0.4 used light-theme hex values for hover, pressed and the outline border in every theme). Hover and pressed colors are gated (`not-disabled:not-aria-disabled:hover:` / `not-disabled:not-aria-disabled:active:`): they never apply to a disabled or `aria-disabled` Button, and they now work for `as="a"`. The gate gives them a higher specificity than a bare `hover:` class, so a `className="hover:bg-error"` no longer overrides the built-in hover color as it did in 0.4. Use the same prefix (`not-disabled:not-aria-disabled:hover:bg-error`, which replaces the built-in class) or the important modifier (`hover:bg-error!`, which also applies while the Button is disabled).
  - `Button as="a"` shows no link underline (`no-underline`); the `transparent` appearance still underlines on hover.

#### Behaviour

- **WaveProvider** paints the themed background, text color and font on its root (`bg-background text-foreground font-wave text-body-1`; your `className` wins). An unknown `theme` value falls back to light with a development warning.
- **Triggers.** `Dialog.Trigger` and `Popover.Trigger` no longer render a wrapper `<span>` by default: their props and `className` merge onto the child. `asChild={false}` restores the span, and a child that does not forward `ref` falls back to the span automatically with a development warning. The new `Drawer.Trigger` and `Menu.Trigger` work the same way.
- **Dialog and Drawer** no longer set `aria-modal="true"`; they make the rest of the page `inert` while open, so toasts and live regions stay available. They trap focus including allow-listed toasts, lock page scroll with a counter shared by stacked overlays, and no longer close when a drag that started inside them ends on the backdrop. On close, focus goes to `finalFocusRef` when given. Otherwise it returns, as in 0.4, to the element that had focus when the modal opened: the trigger for a trigger click, but also the parent's own button of a controlled Dialog, or a text field that had focus when a keyboard shortcut opened it (a mounted trigger does not take precedence over it). New in 0.5: when nothing had focus (a modal opened from code, or a click in Safari, which does not focus the clicked button), focus goes to the trigger clicked in this open session, else to the first mounted trigger; when the target is gone, it falls back to a mounted trigger or the overlay below.
- **Portals.** Popover content, the Tooltip visual, open listboxes (Combobox, Dropdown, TagPicker, TimePicker), the DatePicker calendar, `Menu.Popover`, the AvatarGroup overflow popup, the InfoLabel popup and the Toaster region render in a portal (0.4: only Dialog and Drawer). Portaled content inherits the provider's theme and direction. Popups position themselves with flipping and shifting to stay in the viewport.
- **Layered dismissal.** Escape and outside presses close only the topmost layer: Escape in a Dropdown inside a Dialog closes the listbox, not the Dialog. Clicks inside nested portaled overlays count as inside. Clicking a toast never dismisses the overlay below it.
- **Tooltip** always renders a hidden inline `role="tooltip"` description and keeps it in the child's `aria-describedby` (the child's own ids are kept), so the description exists on the server and before the show delay. It can name its child instead (`relationship="label"`). It stays open while hovered, closes with Escape without closing an enclosing overlay, and hides immediately on blur.
- **Popover** closes on Escape and outside presses (not presses inside overlays opened from it), returns focus to its trigger when focus was inside, and is named by `title`, `aria-label`/`aria-labelledby` or else its trigger. A consumer `id` on `Popover.Content` is kept and the trigger's `aria-controls` follows it (0.4: `aria-controls` kept pointing at the generated id).
- **TeachingPopover** is uncontrolled by default (`defaultOpen` `true`): Close, Done and Escape now dismiss it without a controlled `open`. Focus moves into it on open and returns on close; step changes are announced, and Back stays focusable (`aria-disabled`) on the first step.
- **Default positions follow the direction.** `Drawer` defaults to `position="end"` and `Toaster` to `position="bottom-end"`: unchanged in LTR, on the left in RTL (0.4: `right` and `bottom-right`).
- **Boundary buttons** of Pagination (First/Previous/Next/Last) and Carousel (Previous/Next) use `aria-disabled` instead of `disabled`, so focus is not lost. Pagination clamps an out-of-range `currentPage` and reports the clamped page once through `onPageChange`.
- **Carousel** dots are buttons with `aria-current` (no tab roles). Inactive slides are `inert` and `aria-hidden`. `autoPlay` adds a Pause/Start control, pauses on hover and focus, starts stopped for reduced motion, and stops at the last slide without `loop`.
- **DataGrid** rows are no longer individual tab stops: the grid has one Tab stop and the APG grid keyboard model. Sortable headers are buttons. Selectable grids render a selection column header ("Select all rows" in multiple mode), name each row's control after its first cell, and set `aria-multiselectable`. Rows without `rowId` get no selection control (development warning). `columns` renders the header when no `DataGrid.Header` is given.
- **Menu**: the container is no longer a tab stop (roving tab index on the items). **List**: options use a roving tab index; a selectable List whose items have `action`s switches to grid semantics.
- **Checkbox and Switch**: a consumer `onClick` fires once, on the control (0.4 fired it twice when the label text was clicked).
- **Composite controls** (Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) route `id`, `aria-*`, `tabIndex`, `autoFocus`, focus and key handlers (and native input attributes for text fields) to their focusable element. `ref` is unchanged (on the wrapper); the new `controlRef` reaches the focusable element.
- **Checkbox, Switch and RadioItem** with `label` text are named through `aria-labelledby`, which points at that text (its `<span>` now has an `id`), enabled or disabled, so axe's contrast exemption for disabled controls covers the dimmed label. A plain `label="Accept"` keeps the name "Accept". A consumer `aria-label` still names the control alone, and no `aria-labelledby` is added. A consumer `aria-labelledby` comes first and the label text follows: `aria-labelledby="terms-heading"` (text "Terms") with `label="Accept"` gives "Terms Accept", not "Terms". Inside a `Field`, a Checkbox or Switch is named by the Field label followed by its label text. Because `aria-labelledby` takes precedence over `<label>` elements, a `<label htmlFor>` of your own that targets the control no longer adds to its name while the control has `label` text: add that label's `id` to `aria-labelledby` instead.
- **Callbacks.** Value callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange`) skip no-op changes. Event-named callbacks (`onTabSelect`, `onNavItemSelect`, `onOptionSelect`, `onPageChange`, `onStepChange`) still fire on every activation. The deprecated `onChange(value)`/`onChange(checked)` aliases (Checkbox, Switch, RadioGroup, Rating, SearchBox, SpinButton, ColorPicker, SwatchPicker, TagPicker, TimePicker, DatePicker) are change-only like their replacements, so choosing the current radio or star again and pressing a Rating key at an end no longer emit (0.4 did).
- **Rating** cannot be cleared to 0 by keyboard: Left/Down stop at 1 star (APG radio group; 0.4 went down to 0 and emitted `onChange(0)`). A controlled `value={0}` (or a form reset to a `defaultValue` of 0) still clears it.
- **Controlled values.** A controlled value that becomes `undefined` now clears the component to its empty value (0.4 ignored it or crashed). A value that arrives after mount takes over.
- **Field** no longer overwrites a child's `id`, `aria-describedby` or `aria-invalid`, and merges only into its first element child (0.4 cloned every element child and gave each the same id). It leaves a Fragment and a role-less or presentational `div`/`span` wrapper alone (the library control inside is labelled through the Field context); a first child with an explicit widget role (`<div role="radiogroup">`) is named through `aria-labelledby` and no longer receives the id. It no longer puts `aria-required` on a `button`, `meter`, `output`, `progress`, button-type `<input>` or role-less custom element, or on an element whose explicit role does not support it. With `required`, Field now also sets the native `required` attribute on an `<input>` (not button types), `<select>` or `<textarea>` child and on the library Input, Select, Textarea, Slider, SpinButton and SearchBox, so browser constraint validation blocks submitting the form while the field is empty (0.4 set only `aria-required`). The choice and picker controls inside a required Field (Checkbox, Switch, RadioGroup, Rating, SwatchPicker, ColorPicker, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) are required as well: they render their hidden input as a required input even without `name`, so the form does not submit until the control is checked, switched on or has a value, and the browser focuses the control when it blocks the submit. `<Field required><Switch /></Field>` blocks the submit while the switch is off. An explicit `required={false}` on the control opts it out of both the validation and `aria-required`, as the Field's first child or nested deeper. Give the `<form>` `noValidate` to keep 0.4's behaviour and validate in your submit handler. The required asterisk is hidden from assistive technology, and the error message is a `role="alert"` element.
- **Error messages.** `<Input|Select|Textarea error="text">` now renders the message after the control in a sibling `role="alert"` element linked by `aria-describedby` and `aria-errormessage` (pass `error={true}` for the flag-only look; inside a Field that shows its own error nothing changes). Input, Select, Textarea and SearchBox show the error border whenever the control ends up `aria-invalid="true"`, which includes an `error` on the surrounding Field or your own `aria-invalid`, not only their own `error` prop (0.4 drew it only for `error`; SearchBox never).
- **SearchBox** routes `readOnly` and the other native input attributes to its `<input>` (0.4 left them on the wrapper `<div>`, so the input stayed editable); a read-only SearchBox renders no clear button. Clearing moves focus back to the input. `dismiss` content that renders nothing (`false`, `true`, `''`, `[]`, or a Fragment of those) shows the default clear icon (0.4 rendered an empty clear button).
- **Dismiss and clear button names** (WCAG 2.5.3 Label in Name): a `<button>` or `Button` passed as MessageBar `dismiss`, SearchBox `dismiss` or Tag `dismissIcon` that renders a text label (at least two letters or digits, text from child components included) is named by that text. MessageBar and SearchBox drop their default name (MessageBar as in 0.4; SearchBox always said "Clear search" in 0.4), and Tag says the text plus the tag content ("Remove Cherry" instead of "Dismiss Cherry"). An icon or a lone character (`X`, `×`) keeps "Dismiss", "Clear search" or "Dismiss Cherry" (0.4 MessageBar named a `<button>X</button>` "X"). Text hidden only by CSS still counts as the label, so give such buttons an explicit `aria-label`. An `aria-label`, `aria-labelledby` or `title` on a SearchBox slot object now names the clear button (0.4 put it on the hidden content). Tag dismiss buttons are named by `dismissLabel` plus the tag content (0.4: a fixed "Dismiss").
- **Spinner** has the default name "Loading", set one animation frame after mount so it is announced.
- **TabList** selects its first enabled tab when uncontrolled without a default; disabled tabs are skipped by the keyboard.
- **DatePicker** default display format is `Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })` and round-trips with the default parser (pass `locale` when rendering on the server). Typed text is committed on Enter, Alt+ArrowDown or blur only when it was edited; text that is not an available date is kept, marked invalid and reported through `onInvalidInput`. Every emitted date is local midnight.
- **TimePicker**: a complete typed time activates its own option, not an earlier option that merely contains the text (`2:00 PM` commits `14:00`, not `12:00`). Enter or leaving the field commits a complete typed time within the bounds (0.4 discarded it). Erasing the text and pressing Enter or leaving the field clears the value (`onValueChange('')`), as DatePicker does (`onValueChange(null)`). Opening with a value shows every option.
- **Combobox** filters the options in both modes (0.4 filtered only with `freeform`). Without `freeform`, blur and Escape restore the selected option's label and never commit free text. Display text is the option label (0.4 showed the raw value for `value`/`defaultValue`), also in server-rendered HTML.
- **ColorPicker**: the hex text is a draft. Complete 6- and 8-digit values apply while typing (6 digits keep the current opacity); `#rgb`/`#rgba` apply on blur or Enter (`#rgb` keeps the current opacity); surrounding whitespace is dropped. Invalid text is no longer reverted on blur (0.4 discarded it silently): it is kept and flagged (`aria-invalid` plus the `hexError` description) and never reaches `onValueChange`. It stays flagged until it is corrected or cleared, or the value changes elsewhere (a preset, the opacity slider, the parent, a form reset); meanwhile the form submits the last applied color. Enter still submits the form, with the color just applied. The opacity slider edits the value's alpha byte.
- **TagPicker**: Backspace in the empty input moves focus to the last tag, and a second Backspace (or Delete) removes it (0.4 removed the last tag at once). Additions and removals are announced ("Apple added, 2 selected"). A disabled TagPicker's remove buttons leave the tab order. Selected values without a matching option are shown with their raw value.
- **Toasts.** `useToastController` outside `<Toaster>` throws in development (0.4 dropped the toasts silently; the 0.4 guide showed a sibling setup): wrap the app in `<Toaster>`. Toasts are announced through permanent live regions, pause while hovered or focused, and move focus to the next toast (or back) when a focused toast is removed.
- **Button**:
  - The `type="button"` default of a native `<button>`, and the `role="button"`/`tabIndex={0}` defaults of a non-interactive `as` (`div`, `span`, …), also apply when the prop is passed as `undefined` or `null`: a wrapper that forwards `type={type}` no longer drops `type="button"` and submits its form. Any other explicit value still wins (`type="submit"`, `role="link"`, `tabIndex={-1}`). A custom `as` component still gets no `type` default, as in 0.4: pass `type` yourself inside a form.
  - A non-interactive intrinsic `as` gets `role="button"`, a tab stop and Enter (key down) / Space (key up) activation. Space activates only after an unprevented Space key down on the element itself; blur or a `preventDefault()` in your key handlers cancels it.
  - `disabled` reaches the element as the native attribute only for `button` (the default), `input`, `select` and `textarea`. Every other `as` — `a`, `div`, `span` and any custom component, including router links and styled or motion components that render a native `<button>` (0.4 passed `disabled` through to them) — gets `aria-disabled="true"` and `tabIndex={-1}` (after the rest props, so a consumer value cannot re-enable it). Its click is prevented and stopped (ancestor `onClick` handlers do not run, as with a native disabled button), Enter and Space do nothing, and an `<a>` drops its `href` and keeps `role="link"`. A custom component that renders a native `<button>` therefore loses the native `:disabled` state and its own `:disabled` styling; it leaves the tab order but can still take focus from a mouse click. Style such components on `[aria-disabled="true"]`.
  - A consumer `aria-disabled="true"` on an enabled Button shows the disabled look and suppresses hover and pressed colors, but the Button stays focusable and its handlers still run (guard them yourself).
  - The `icon` slot renders with `aria-hidden="true"` (a slot object can override it), so icon text or emoji is no longer part of the accessible name. An icon-only Button without `aria-label`, `aria-labelledby` or `title` logs a development warning (once). An `icon` that renders nothing (`''`, an empty array or Fragment, e.g. from `icon={name && <Icon />}`) counts as no icon.
- **Link**: `inline` links are always underlined; a disabled link drops its `href`, keeps `role="link"` and gets `aria-disabled` and `tabIndex={-1}` that a consumer value cannot override.
- **Nav**: activating a disabled item never selects it; a disabled item whose value is the current value still shows as current (`aria-current="page"`). Categories containing the selected item start open. Breadcrumb.Item and Nav button items (no `href`) no longer render a `rel` attribute.
- **Breadcrumb.Item** without `href` renders a `<button type="button">` when it has `onClick`, plain text otherwise (0.4: an unfocusable `<a>` styled as a link). Its text and current-page spans no longer render button-only or link-only attributes (`disabled`, `type`, `form*`, `name`, `value`, `target`, `rel`, `download`, `hrefLang`, `ping`, `media`, `referrerPolicy`); a development warning fires for `disabled` on a text or current item.
- **Card** with `onSelect` is keyboard-operable: `role="button"` with Enter/Space and `aria-pressed` (default `selectionControl="card"`), or a built-in checkbox (`selectionControl="checkbox"`) for cards with actions. Clicks and keys inside nested interactive elements never select the card.
- **Stepper** exposes the active step with `aria-current="step"` and announces completed and error steps; `onClick` of a disabled or unreachable step is not called.
- **Table and DataGrid** scroll horizontally in their wrapper (0.4: `overflow-hidden` clipped wide tables); a horizontally scrolling Table wrapper is a focusable named region.
- **Avatar** in initials or icon mode is a named image (`role="img"`, `aria-label={name}`); without a name it is decorative. A failed image falls back to the icon or initials.
- **PresenceBadge** is a named image (`role="img"`, named by its status: "Available", "Busy", …) instead of `role="status"` (0.4), which made every badge an implicit live region. Tests that query a badge with `getByRole('status')` use `getByRole('img', { name: 'Available' })`.
- **AvatarGroup** is a group (`role="group"`); name it with `aria-label` or `aria-labelledby` (a development warning asks for one). With `max`, the overflow `+N` is a `<button>` named "N more" (`overflowLabel`) instead of plain text in a `<span>`: it is a new tab stop and opens a popup (`role="dialog"`, portaled) that lists the hidden members' names. Tests find it with `getByRole('button', { name: '2 more' })`.
- **Persona** makes its avatar decorative, so the name is announced once.
- **InfoLabel** shows its information in a popup on hover, keyboard focus or click (a toggletip), linked as the button's description (0.4: a native `title`).
- **Divider** with a label is one separator named by the label; a vertical divider shows its label.
- **ProgressBar** clamps `value` to `0…max` (also for `aria-valuenow`), guards `max <= 0`, warns without a name, and pulses at full width for reduced motion.
- **Skeleton** placeholders are `aria-hidden` by default, and a consumer `aria-hidden` now overrides it (0.4 forced it after the rest props); `Skeleton.Group` marks the loading region busy.

#### DOM structure

- Avatar with `badge`: `ref`, `className` and rest props now land on the outer wrapper; `role="img"` and the name stay on the avatar visual.
- `Tree.Item`: `ref` and rest props move from the role-less wrapper to the `role="treeitem"` element (still a `div`), and the child group is nested inside it.
- Stepper keeps its root `<div>` and adds an inner `<ol>`/`<li>` list.
- Combobox, Dropdown and TagPicker render their option list inline and `hidden` while closed, and in a portal while open.
- `OptionGroup` (`Combobox.OptionGroup`, `Dropdown.OptionGroup`, flat `ComboboxOptionGroup`/`DropdownOptionGroup`) renders `<li role="presentation">`, which carries `ref`, `className` and rest props, containing the label `<div role="presentation" id>` and a `<ul role="group" aria-labelledby>` of the options. 0.4 rendered `<div role="group" aria-label={label}>` with ref, className and rest props on that div; the group is now named through `aria-labelledby`.
- TagPicker renders its tags as a `role="list"` named "Selected", and while tags exist the input is described by a hidden summary ("Selected: Apple, Banana").
- The Popover root no longer renders 0.4's `<div class="relative inline-block">` around trigger and content: it renders only its children, and `Popover.Content` is portaled with fixed positioning. Layouts that relied on the wrapper's inline-block box or positioning context change.
- The Tooltip wrapper `<span>` was `relative inline-block` and is now `inline-block` (the visual is portaled, so the positioning context is gone). It always contains the hidden `role="tooltip"` description element.
- The TeachingPopover step dots were `role="group" aria-label="Steps"` and are now `aria-hidden` decoration; the heading carries a visually hidden "step n of m".
- Input, Select and Textarea with a string `error` render an extra sibling `<span role="alert">` after the control (`ref` and `className` stay on the control).
- The Toaster region is portaled (0.4 rendered it in place).

#### Types

- `SearchBox.dismiss`, `MessageBar.dismiss` and `Tag.dismissIcon` are `Slot<'span'> | SlotObject<'button'>` (the 0.4 button-object form still compiles; deprecated).
- `SlotObject` is widened: every attribute of the slot's element is accepted (`{ src, alt }` on an image slot), `as` takes any element type, and slots accept iterables (arrays, `Set`, generators).
- Polymorphic components type-check `as`-specific props: `<Button as="a" href target>` compiles, while `<Button as="a" formAction>` and anchor props on the default button are errors. `ButtonProps` is now `ButtonProps<C extends React.ElementType = 'button'>`; plain `ButtonProps` is still the 0.4 default-tag type, extendable by interfaces, with `ref: React.Ref<HTMLButtonElement>`. The same applies to CompoundButton, Link, Text, Toolbar, Card and its parts, Stack, Flex, Grid, Tag and Divider, which also export their `*OwnProps`.
- `ref` is declared in every Props interface (0.4 added it through an intersection on the component).
- `Image.alt` stays optional (development warning when missing); `StrictImageProps` is exported for apps that want it required at compile time.
- `OptionGroupProps` extends `React.LiHTMLAttributes<HTMLLIElement>` and its `ref` is `React.Ref<HTMLLIElement>` (0.4: `React.HTMLAttributes<HTMLDivElement>` and a div ref), so passing a `RefObject<HTMLDivElement>` to `OptionGroup` is a type error.
- `AccordionProps` (single/multiple union), `DataGridProps` (sort-API union), `NavItemProps`, `NavSubItemProps` and `BreadcrumbItemProps` (link/button unions) are union types; 0.4 had interfaces. `interface X extends NavItemProps {}` no longer compiles (TS2312): extend a branch (`AccordionSingleProps`/`AccordionMultipleProps`, `DataGridBaseProps`, `NavItemButtonProps`/`NavItemAnchorProps`, `BreadcrumbItemAnchorProps`/`BreadcrumbItemButtonProps`) or intersect (`type X = NavItemProps & { … }`). `React.ComponentProps<typeof Nav.Item>` (and of `Nav.SubItem` and `Breadcrumb.Item`) resolves to the last overload (`*DynamicProps`).
- Nav.Item and Nav.SubItem handler typing: with a string `href`, unannotated handlers are typed on `HTMLAnchorElement` (0.4: `HTMLButtonElement` for every item), so a 0.4 handler that reads a button-only member such as `e.currentTarget.form` no longer compiles on a link item. With `href={maybe}` (`string | undefined`), handlers are typed on `HTMLAnchorElement | HTMLButtonElement`, and `href={maybe}` combined with `target` is a type error. Items without `href` keep `HTMLButtonElement`. Handlers already typed as `React.MouseEventHandler<HTMLButtonElement>` still compile on link items (React handler types are bivariant). Breadcrumb.Item handlers, typed on `HTMLElement` in 0.4, are now typed on the rendered element; existing handlers still compile.
- Routed handlers are typed on the focusable element: Checkbox and Switch `onClick`, `onFocus`, `onBlur`, `onKeyDown` and `onKeyUp` on `HTMLButtonElement` (0.4: the `<label>`); Combobox and TagPicker focus and key handlers on `HTMLInputElement`, Dropdown's on `HTMLButtonElement`; SearchBox and SpinButton native input props and handlers on `HTMLInputElement` (0.4: `HTMLDivElement`).
- `ListProps` takes the `selectionMode` literal as a type parameter (`ListProps<M>`), which makes the single-mode props type errors with `selectionMode="multiple"`; plain `ListProps` accepts every mode.

### Added

- **Style entries**: `./tailwind` (Tailwind 4 source entry), `./preflight.css` (opt-in Preflight), `./legacy-tokens.css` (deprecated 0.4 variable names), and the aliases `./styles.css`, `./tailwind.css`, `./tokens.css`.
- **Tokens**: the `--wave-*` token set with new tokens `primary-hover`, `primary-pressed`, `error-foreground`, `subtle-hover`, `subtle-pressed`, `subtle-selected`, `selected`, `selected-foreground`, `stroke`, `stroke-hover`, `stroke-accessible`, status `*-foreground`, `*-tint` and `*-tint-foreground` colors, `inverted`, `inverted-foreground`, `inverted-border`, `track`, `skeleton`, `rating`, `presence-*` and `backdrop`; brand utilities (`bg-brand-80`, …); `font-wave`; `animate-wave-spin-slow` and `animate-wave-indeterminate-rtl`; stacking variables `--wave-z-overlay`, `--wave-z-toast`, `--wave-z-tooltip`. Contrast is asserted per theme by `tokens.test.ts`.
- **Theming**: theme classes `wave-light`, `wave-dark`, `wave-high-contrast`; `getThemeClassName(theme)`; `WaveProvider` `portalContainer`; `useWaveTheme()` also returns `themeClassName`, `portalContainer` and `hasProvider`.
- **Flat sub-component exports** for React Server Components: `CardHeader`, `DialogTrigger`, `MenuItem`, `TableRow`, `RadioGroupItem`, … (every `Parent.Member` is also exported as `ParentMember`).
- **`Portal`** component (themed portal wrapper with stacking layers).
- **Hooks and utilities**: `useMergedRefs`, `useIsClient`, `useFieldControl` (with `FieldContextValue`, `FieldControlProps`, `UseFieldControlOptions`), `useAnnounce` and `announce`, `composeEventHandlers`, `mergeRefs`, `useOverflowMenu`, `useIsOverflowItemVisible`. `useControllable` returns a third element (`isControlled`) and its setter accepts updaters (`SetValue<T>`). `useRovingTabIndex` accepts an options object (`useRovingTabIndex({ … })` returning `containerProps`), with `tabStop`, `manageTabIndex`, `itemSelector`, `typeahead`, `homeEndKeys`, `dir`, `focusValue`/`focusFirst`/`focusLast`; the 0.4 call shape still works.
- **Types**: `ResolvedSlot`, `PolymorphicProps`, `PolymorphicComponent`, `SetValue`, `WaveContextValue`, `UseRovingTabIndexResult`, `RovingContainerProps`, `Politeness`, `Orientation`, `SelectionMode`, `TextWeight`, `Shape`, `PopupSide`, `PopupAlign`, `FieldControlIdClaim`, `TooltipAppearance`, `ToastPosition`, `SearchBoxInputProps` and `SpinButtonInputProps` (the props routed to the `<input>`), `AccordionBaseProps`, `BreadcrumbItemOwnProps`, `NavItemOwnProps`, `NavSubItemOwnProps`, the `*OwnProps` of polymorphic components, and the new sub-component prop types.
- **Forms**: `name`, `form` and `required` (and `value` for Checkbox/Switch) on Checkbox, Switch, RadioGroup, Rating, SpinButton (`name`, `form`), SwatchPicker, ColorPicker, Combobox, Dropdown, TagPicker, DatePicker and TimePicker; they render a hidden input (only with `name`, or when they are required by their own `required` or a required `Field`), take part in `FormData`, native validation and form reset.
- **`controlRef`** on Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker and TimePicker.
- **Components**:
  - Accordion: `openItem`/`defaultOpenItem`/`onOpenItemChange` (single mode), `headingLevel` (root and item); `Accordion.Trigger` and `Accordion.Panel` props reach their elements.
  - Avatar: `decorative`; the `image` slot accepts a URL, an element or `{ src, alt }`. AvatarGroup: an overflow popup listing the hidden members, `overflowLabel`, `unnamedMemberLabel`.
  - Breadcrumb.Item: `asChild` (router links) and link/button props.
  - Card: `selectionControl`, `selectLabel`.
  - Carousel: `autoPlayLabels` and a Pause/Start control.
  - Checkbox, Switch: `onCheckedChange`.
  - ColorPicker: `onValueChange`, `labels`, `{ color, label }` presets.
  - Combobox: `onValueChange`, `open`/`defaultOpen`/`onOpenChange`, `readOnly` (the input is read-only and the listbox neither opens nor commits; Escape is left to the page), `autoComplete`, `maxLength`.
  - DataGrid: `selectedItems`/`defaultSelectedItems`/`onSelectedItemsChange`, `sort`/`defaultSort`, `containerProps`, `DataGrid.Row` `selectionLabel`.
  - DatePicker: `onValueChange`, `defaultOpen`, `locale`, `onInvalidInput`, `readOnly`, `autoComplete`.
  - Dialog: `finalFocusRef`, `Dialog.Title`, `Dialog.Close`, `Dialog.Trigger` `asChild` and render-prop children.
  - Drawer: `finalFocusRef`, `Drawer.Trigger`, `Drawer.Title`, `Drawer.Close`, logical `position` values `start`/`end`.
  - Dropdown: `onValueChange`, `open`/`defaultOpen`/`onOpenChange`, typeahead.
  - InfoLabel: `infoButtonLabel`.
  - Input: `onValueChange`; Input, Select, Textarea: `errorMessageProps`.
  - Link: `appearance`.
  - List: `selectedItem`/`defaultSelectedItem`/`onSelectedItemChange` (single mode), item actions with grid semantics.
  - Menu: `open`/`defaultOpen`/`onOpenChange`, `Menu.Trigger`, `Menu.Popover` (`side`, `align`, `offset`), `Menu.Item` `persistOnClick`.
  - MessageBar, Toast: `statusLabel` (visually hidden severity text).
  - Nav: `value`/`defaultValue`/`onValueChange`, `openCategories`/`defaultOpenCategories`/`onOpenCategoriesChange`, `Nav.Category` `label`, `disabled` and anchor props on items.
  - Option: `label`, `textValue`; `OptionGroup` works in Combobox and Dropdown.
  - Pagination: `getItemAriaLabel` (localized button names).
  - Popover: `side`, `align`, `ignoreOutsideRefs`; `Popover.Content` `title` and `id`; `Popover.Trigger` `asChild`.
  - ProgressBar: `showLabel`.
  - RadioGroup: `onValueChange`, `disabled`, `RadioGroup.Item`; RadioItem `labelClassName`.
  - Rating, SwatchPicker: `onValueChange`.
  - SearchBox: `onValueChange`.
  - Skeleton: `shape`, `Skeleton.Group`.
  - Slider: `onValueChange(number)`.
  - SpinButton: `onValueChange`, `largeStep`.
  - SplitButton: `menuButtonProps`, `primaryActionButtonProps`, `menuButtonLabel`.
  - Stack: `orientation`. Stepper.Step: `index`.
  - TabList: `value`/`defaultValue`/`onValueChange`, `orientation`, `TabList.Panels`.
  - Tag: `dismissLabel`.
  - TagPicker: `onValueChange`, `open`/`defaultOpen`/`onOpenChange`, `readOnly` (routed to the input; tags show without remove buttons and the option list neither opens nor adds or removes tags; Escape is left to the page), `autoComplete`, `maxLength`.
  - TeachingPopover: `activeStep`/`defaultActiveStep`, `defaultOpen`/`onOpenChange`, `target` (anchored with a beak), `side`, `align`.
  - Text, Label: `weight` (`TextWeight`).
  - TimePicker: `onValueChange`, `readOnly`, `autoComplete`, `maxLength`.
  - Toast: `dispatchToast` returns the toast id; `toastId` (replace a toast) and `statusLabel` options; `ToastController` type; logical Toaster positions `top-start`, `top-end`, `bottom-start`, `bottom-end`.
  - Toolbar: `orientation`, roving tab stop and arrow keys.
  - Tooltip: `appearance`, `relationship`, `side`, `align`.
  - Tree: `expandedItems`/`onExpandedItemsChange`, `onItemSelect`, `selected`, `current`.
- **Keyboard support** (APG patterns): Toolbar, Tree, DataGrid, selectable List, Menu (popup and static), Dropdown (select-only combobox with typeahead), Combobox/TagPicker/TimePicker (editable combobox with `aria-activedescendant`), DatePicker calendar grid, SpinButton, RadioGroup/SwatchPicker/Rating (roving radio groups), TabList (RTL-aware). See the README keyboard table.
- **Forced colors** (Windows High Contrast): the state and selection indicators of Switch, Checkbox, RadioGroup, SwatchPicker, ProgressBar, DatePicker, TimePicker, listbox options, List, Tree, Card, DataGrid, Pagination, Stepper, Carousel and PresenceBadge stay visible, every Button appearance keeps an edge, and text inputs keep a focus outline.
- **Development and tooling**: `npm run typecheck` checks three programs (library, tests and stories, Vite/Vitest configs); `npm run check:package` (publint, are-the-types-wrong); `npm run test:pack` (tarball smoke test in plain and Tailwind fixtures); `scripts/verify-dist.mjs` (directives, flat names, tree-shaking, React Server Component import); a conventions gate (no raw colors, physical utilities, `focus:outline-none`, `enabled:`, untyped `<button>`, unreduced motion); an axe gate over every story; Storybook theme and direction toolbars and autodocs.

### Deprecated

Everything below will be removed in 1.0. Deprecated props, values and slot forms warn once in development.

- Every old name of the [migration table](#migration-table).
- `@mortenbrudvik/waveui/legacy-tokens.css` (the 0.4 CSS variable names).
- The `dark` and `high-contrast` theme classes (use `wave-dark`, `wave-high-contrast`).
- The button-object form of the dismiss and clear slots (`MessageBar.dismiss`, `SearchBox.dismiss`, `Tag.dismissIcon` with `{ as: 'button', onClick, … }` or other button props): pass icon content and use `onDismiss`/`onClear`. A `<button>` or `Button` element passed there is merged into the built-in button with a development warning.

### Fixed

Highlights, grouped by area:

- **Theming**: text is readable in the dark and high-contrast themes (WaveProvider paints the foreground and background); nested light providers inside dark ones work; `WaveProvider` no longer warns about its own default theme; every component uses theme tokens, so Button, Checkbox, Switch, Rating, badges, MessageBar, Toast, Tooltip and the pickers keep their contrast in every theme; native controls get the right `color-scheme`.
- **Packaging**: `./styles` produces styled components without any setup beyond `WaveProvider`; importing the package (even `cn`) in a React Server Component no longer fails; tree-shaking works; `./tokens` includes the animation keyframes; CommonJS types resolve.
- **`cn`** keeps Wave's type-ramp classes next to a text color (`cn('text-body-1', 'text-foreground')`) and merges the `shadow-*` scale, so a consumer class replaces the conflicting class of the same variant instead of dropping an unrelated one (classes behind a different variant, such as the gated hover colors, are kept; see Button under [Styles](#styles)).
- **Forms**: no internal button submits an enclosing form (`type="button"` everywhere); Field labels, hints, errors and consumer `aria-label`s reach the focusable element of composite controls; Field keeps a child's own ids; RadioGroup finds items inside Fragments and wrappers; value controls participate in native forms.
- **Inputs**: SpinButton accepts typed negatives, decimals and multi-digit values, rounds decimal steps (`0.1 + 0.2` is `0.3`), supports the APG keys and keeps focus on the input; SearchBox keeps focus after clearing; 24×24px minimum targets for SearchBox clear, Rating stars, DatePicker and TimePicker buttons and SplitButton's chevron.
- **Pickers**: Combobox and Dropdown handle options inside `OptionGroup`, commit the highlighted option, skip disabled options, scroll the active option into view and expose it with `aria-activedescendant`; Dropdown supports ArrowUp, Home/End and typeahead; the listboxes no longer close while the input has focus; ColorPicker opacity, preview and emitted value agree, and the selected preset and swatch are visible on any color; switching Combobox or TagPicker to `readOnly` or `disabled` while typing drops the typed text.
- **Dates and times**: DatePicker's default format and parse round-trip and blur no longer rewrites an unedited date; the calendar closes on Escape and outside presses, is a labelled dialog with keyboard navigation from the focused day (Space, Home/End, Shift+PageUp/PageDown, RTL), clamps month changes to the month's last day, opens on a month inside `minDate`/`maxDate`, and localizes month and weekday names; TimePicker validates `step`, `minTime` and `maxTime` (a `step` of 0 no longer hangs the page) and displays off-grid values in the chosen format.
- **Overlays**: Escape and outside presses close only the topmost overlay; focus traps skip disabled, hidden and `tabindex="-1"` elements; closing returns focus to the element that opened the overlay, or to a trigger when that element is gone or nothing had focus (also after unmounting while open); stacked overlays share the scroll lock; Dialog is responsive (max width and height, scrolling body); unnamed dialogs warn in development; `Dialog.Footer` warns when rendered outside `Dialog.Content`; Popover's external toggles work; a Dialog opened from `Popover.Content` stays open; popups flip and shift at the viewport edges and are no longer clipped by scroll containers.
- **Tooltip** keeps the child's own `aria-describedby`, has its description ready on focus, is dismissible with Escape, stays open while hovered, and clears its show timer.
- **Navigation**: Menu opens from its trigger with focus on the first item and closes on selection, Escape and Tab with focus returned; Nav category labels accept any content and are not lost; Stepper numbers steps inside Fragments and wrappers and exposes its state; Pagination and Carousel keep focus at their boundaries; focus rings on Nav, Menu, Pagination, Breadcrumb and Stepper; RTL layout and mirrored chevrons for Nav, Pagination, Breadcrumb, Stepper, Tree, Carousel, DatePicker, Switch and the indeterminate ProgressBar.
- **Data display**: Tag's `dismissIcon` no longer replaces the working dismiss button; Avatar handles image failures, whitespace names and element/string `image` slots; PresenceBadge statuses are distinguishable without color; AvatarGroup honours `max={0}`; selectable List actions work from the keyboard and never toggle selection; List and DataGrid drop removed items from the reported selection.
- **Layout**: Overflow measures without mutating React-owned elements, hides items in DOM order, reserves the real width of the overflow button, keeps that button visible when the first item is wider than the row (it sticks to the row's end, covers the end of that item and gets `data-overflow-pinned`), and tolerates missing `ResizeObserver`; TabList and Accordion ids are unique per instance; TabList finds tabs inside Fragments and wrappers; Accordion triggers sit in headings; Flex `shrink` works; Carousel auto-play stops at the last slide instead of emitting the same index forever.
- **Feedback**: MessageBar's `dismiss` slot keeps the working dismiss button; MessageBar and Toast announce the severity; `dismissToast(id)` works and clears the toast's timer; ProgressBar and Spinner are named; the indeterminate ProgressBar is a full-width pulse for reduced motion instead of a static 40% bar.
- **Button**: `extra-large` is 18px, larger than `large` (0.4: 14px); CompoundButton's secondary text keeps full contrast; Toolbar implements its keyboard pattern.
- **Stories**: every story has an accessible name, uses theme tokens and passes axe; the Image placeholders render.

### Security

- None.

## [0.4.0] - 2026-03-17

### Changed (Breaking)

- **React**: Peer dependency narrowed from `^18.0.0 || ^19.0.0` to `^19.0.0` — React 18 support dropped
- **Node.js**: Minimum version raised from `>=18.0.0` to `>=20.19.0`
- **tailwind-merge**: Upgraded from v2 to v3 (runtime dependency, affects consumers)

### Changed (Infrastructure)

- **Vite** 6 → 8 (build now uses Rolldown; `rolldownOptions` replaces `rollupOptions`)
- **@vitejs/plugin-react** 4 → 6 (Oxc replaces Babel)
- **Vitest** 3 → 4
- **Tailwind CSS** 3 → 4 (CSS-first config via `@theme inline` in `tokens.css`; deleted `tailwind.config.ts` and `postcss.config.js`)
- **Storybook** 8 → 10
- **jsdom** 25 → 29
- **@types/react** and **@types/react-dom** upgraded to v19

### Refactored

- All 65 components: removed `React.forwardRef` wrappers, adopted React 19 ref-as-prop pattern
- Removed dead `PolymorphicProps` type from `src/lib/types.ts`

### Added

- **Testing overhaul**: Unified test helpers in `src/test-utils.ts` — `testSystemProps()`, `testCompoundExposure()`, `testFocusEvents()`, `testDisplayName()`, `createOverlayTestWrapper()`
- **vitest-axe** for automated axe-core accessibility testing
- **@vitest/coverage-v8** for test coverage reporting (`npm run test:coverage`)

### Removed

- `tailwind.config.ts` (replaced by `@theme inline` in CSS)
- `postcss.config.js` (replaced by `@tailwindcss/vite` plugin)
- `autoprefixer` and `postcss` dev dependencies

## [0.3.0] - 2026-03-17

### Added

**7 New Components** completing the layout, navigation, and input categories:

- **Inputs & Forms** (2):
  - DatePicker — Interactive calendar-based date picker with validation, min/max constraints, and customizable formatting
  - TimePicker — Dropdown time picker with searchable options, customizable intervals, and 12h/24h format support

- **Layout** (3):
  - Grid — CSS Grid layout component with customizable columns, rows, gaps, and alignment properties
  - Stack — Flexbox-based stacking layout with vertical/horizontal direction and semantic spacing
  - Flex — Low-level flexbox layout with full direction, wrapping, grow/shrink control

- **Navigation** (2):
  - Stepper — Multi-step process indicator with horizontal/vertical layouts, linear navigation, and completion tracking
  - Pagination — Page navigation with ellipsis support, customizable boundaries, and previous/next controls

**154 New Unit Tests**: Comprehensive test coverage for all 7 new components (928 total tests).

**7 New Storybook Stories**: Interactive stories with controls for all new components (65 total story files).

### Changed

- Total component count: 58 → 65
- Total test count: 774 → 928
- Version bump: 0.2.0 → 0.3.0

## [0.2.0] - 2026-03-05

### Added

**16 New Components** completing the Wave UI component catalog:

- **Tier 1 — Core** (6):
  - Image — Styled image with fit modes (none, center, contain, cover), shape (circular, rounded, square), shadow, block/inline
  - Label — Form label with required indicator, disabled styling, size variants
  - Combobox — Type-to-filter input with dropdown listbox, Option/OptionGroup sub-components
  - Dropdown — Non-editable selection dropdown with custom popup, shares Option/OptionGroup with Combobox
  - Toast/Toaster — Imperative notification system with useToastController hook, auto-dismiss, status variants
  - Tree — Hierarchical expandable list with TreeItem, icons, keyboard navigation

- **Tier 2 — Enhanced** (5):
  - DataGrid — Enhanced Table with sorting, single/multi selection, keyboard nav, aria-sort support
  - Overflow — ResizeObserver-based overflow detection with OverflowItem and useIsOverflowing hook
  - TagPicker — Combobox-style multi-select with dismissible tags, filterable dropdown
  - Rating/RatingDisplay — Star-based rating input with hover preview, keyboard nav, read-only display variant
  - TeachingPopover — Step-based onboarding popover with dot indicators, Back/Next/Done navigation

- **Tier 3 — Specialized** (5):
  - Carousel — Content slider with prev/next buttons, dot indicators, autoPlay, loop support
  - SwatchPicker — Color swatch grid with radiogroup pattern, size/shape variants
  - Nav — Sidebar navigation with NavCategory (collapsible), NavItem, NavSubItem
  - List — Vertical list with single/multi-select, keyboard navigation, action slots
  - ColorPicker — Hex input with preset color swatches and optional opacity slider

> Correction (0.5.0): the keyboard navigation listed above for Tree and DataGrid was limited to a few keys, and DataGrid sorting reported the sort without reordering rows. The WAI-ARIA keyboard models of Tree, DataGrid, List, Toolbar and the pickers ship in 0.5.0; DataGrid sorting is controlled (the consumer reorders the rows).

**220 New Unit Tests**: Comprehensive test coverage for all 16 new components (774 total tests).

**16 New Storybook Stories**: Interactive stories with controls for all new components (58 total story files).

### Changed

- Total component count: 42 → 58
- Total test count: 554 → 774
- Library bundle: ESM + CJS with full TypeScript declarations

## [0.1.0] - 2026-03-04

### Added

**42 Components** implementing Wave UI design tokens (inspired by Fluent UI 2 design language):

- **Buttons & Actions** (7): Button, CompoundButton, ToggleButton, SplitButton, MenuButton, Link, Toolbar
- **Inputs & Forms** (10): Input, Textarea, Select, Checkbox, Switch, RadioGroup, SearchBox, Slider, SpinButton, Field
- **Data Display** (9): Avatar, AvatarGroup, Badge, CounterBadge, PresenceBadge, Tag, InfoLabel, Persona, Divider
- **Typography** (1): Text (11 Wave UI variants)
- **Layout** (3): Card, Accordion, TabList
- **Feedback** (4): MessageBar, ProgressBar, Skeleton, Spinner
- **Navigation** (2): Breadcrumb, Menu
- **Overlays** (4): Dialog, Drawer, Popover, Tooltip
- **Data** (1): Table
- **Provider** (1): WaveProvider (light, dark, high-contrast themes + RTL)

**3 Hooks**: useControllable, useId, useEventCallback

**Slot System**: Flexible slot pattern for customizable sub-elements across all components.

**554 Unit Tests**: Comprehensive test coverage for all components using Vitest and React Testing Library.

**Storybook Documentation**: 42 story files with interactive controls, variant demonstrations, and composed usage examples.

**Design System**:
- Segoe UI typography with 11 size variants
- 4px base unit spacing grid
- Wave UI color tokens (light, dark, high-contrast)
- Dual-layer shadow system
- Full accessibility support (ARIA attributes, keyboard navigation, focus management)
