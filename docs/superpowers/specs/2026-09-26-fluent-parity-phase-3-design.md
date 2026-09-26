# WaveUI 0.8.0 — Fluent Parity Phase 3 Design (notifications, color and trees; stable class names)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-3` (from `main` bcbdb51, where 0.7.0 = Phase 2 is merged) · Package: `@mortenbrudvik/waveui` 0.7.0 → **0.8.0**
> Scope: Phase 3 of [`docs/ROADMAP.md`](../../ROADMAP.md): the stable class names P3-00 and the items P3-01 … P3-07. They close 4 high, 6 medium and 9 low gaps of the Fluent UI v9 comparison and mitigate one more (`buttons-29`, which P13-02 closes; D8) (§7).
> Inputs: the roadmap's Phase 3 section (items, sketches, guards, dependencies; §1 goals and naming; §2 principles; §3 process); the Phase 2 spec [`2026-09-26-fluent-parity-phase-2-design.md`](2026-09-26-fluent-parity-phase-2-design.md), the model for this document, and its §10 implementation notes; the verified gap entries `foundation-37`, `buttons-29`, `toast-*`, `toasttrigger-1`, `toaster-2`, `messagebar-*`, `colorarea-1`, `colorslider-1`, `colorpicker-*`, `alphaslider-1` and `tree-*`; Fluent 9.74.9 read at its source (`react-toast`, `react-message-bar`, `react-color-picker` 9.3.1, `react-tree`, `react-utilities` `SlotClassNames`, `react-conformance`'s static-class test, the RFC `static-classes-on-slots.md`); the WAI-ARIA Authoring Practices (slider, treeview) and React Aria's `useColorArea` model for the 2-D slider. Every API below was checked against the 0.7.0 source it changes: `Toast.tsx`, `MessageBar.tsx`, `MessageBar.status.tsx`, `ColorPicker.tsx`, `colorUtils.ts`, `SwatchPicker.tsx`, `Slider.tsx`, `Tree.tsx`, `Dialog.shared.tsx` (`useModalClosePart`), `usePresence.ts`, `usePreserveFocus.ts`, `useAnnounce.ts`, `lib/layers.ts` (Escape routing and the allow-listed Toaster region), `lib/types.ts`, `cn.ts`, `src/index.ts`, `src/test-utils.ts` (`testClassName`), `src/__tests__/conventions.test.ts`, `scripts/verify-dist.mjs` (server probe, tree-shaking probe, flat names) and `scripts/build-css.mjs`, plus an inventory of every public component, its root element and its inner parts.
> Maintainer rulings (binding, from the design review of 2026-09-26): the release is 0.8.0 with a new `## [0.8.0] - Unreleased` CHANGELOG section; the class names live in one central, server-safe registry (`src/lib/classNames.ts`) enforced by a gate rule, a `testSystemProps` check and a registry test (D2, D7); checks in a multi-select Tree **cascade** (D24); every toast in the Toaster keeps the built-in Dismiss button, rich ones included, with no opt-out in 0.8 (D11). The Phase 2 lead rulings carry over: Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, with an optional `details` argument); APG behaviour first; new surfaces mount through the presence core; no JS animation library, no runtime styles.
> Status: first draft, written after the design review of 2026-09-26 (six sections approved one by one). To be reviewed three times (API conventions; accessibility and behaviour; the code, sequencing and verification) before the maintainer's approval; §9 records the review points not applied and why. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). The open questions of §8 are answered by the maintainer before wave A starts (roadmap §3, entry criteria).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F3-foundation` | the class-name registry `src/lib/classNames.ts` (every constant of Appendix A, including the parts the wave-B packages add), the classes applied to every existing component and part, the four enforcement layers (the conventions rule, the `testSystemProps` check, the registry test, the `verify-dist` checks), the entry export, the `id` of the visually hidden status text shared by Toast and MessageBar, the `verify-dist` flat-name bridge for the four compounds wave B changes | P3-00, plus the shared piece of P3-02 and P3-04 | wave A |
| `P3-toasts` | Toast, its new parts and the Toaster, in the order P3-02 → P3-01 → P3-03 | P3-01, P3-02, P3-03 | wave B |
| `P3-messagebar` | MessageBar, `MessageBar.Title`, `MessageBar.Actions`, the reflow | P3-04 | wave B |
| `P3-color` | `ColorArea`, `ColorSlider`, `AlphaSlider`, the composable ColorPicker, the HSV conversions, `HsvColor`, the public color helpers | P3-05 | wave B |
| `P3-tree` | Tree multi-select and the row content, in the order P3-06 → P3-07 | P3-06, P3-07 | wave B |
| `INTEGRATION` | barrels, cross-package tests, public type tests, the Server Component regression cases of the new compounds, emptying the flat-name bridge | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP | — | wave D |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) and the Phase 2 rules 15–17 (no built-in motion, pointer tests, direction) apply unchanged, with F3 in place of F1/F2. In addition:

19. **Wave A is exclusive and touches every component.** `F3-foundation` is the only package of wave A. It may edit every module under `src/components/` to apply the classes (D4) and nothing else in them (no behaviour, markup or style change beyond the added classes and the `StatusText` `id`), `src/index.ts` (the registry export, D2), `src/__tests__/public-types.test.ts` (the registry lines) and any existing test whose exact class assertion the added classes break (§6.4). The lead commits it before wave B starts.
20. **The registry is frozen in wave B.** `src/lib/classNames.ts` has no owner in wave B (read only). Every new component or part created in wave B applies the constant Appendix A defines for it; a missing or wrong key is a change request to the lead, who edits the registry (the same rule as the Phase 2 Menu seam, rule 12).
21. **New compounds attach their own members.** `P3-toasts`, `P3-messagebar`, `P3-color` and `P3-tree` each own their compound module and attach their new parts there (`Toast.Title`, `MessageBar.Actions`, `ColorPicker.Area`, `Tree.PersonaLayout`), with the flat names re-exported from that module. The flat names reach `dist/index.mjs` only when INTEGRATION extends the barrels, so `F3-foundation` puts `'Toast'`, `'MessageBar'`, `'ColorPicker'` and `'Tree'` on `verify-dist`'s `PENDING_FLAT_EXPORTS` bridge (§1.6) and INTEGRATION empties it (as Phase 2 did for Toolbar).
22. **Module splits keep one-way imports.** `P3-toasts` splits `Toast.tsx` and `P3-tree` splits `Tree.tsx` as `Menu.tsx` was split in 0.7: the compound module (`Toast.tsx`, `Tree.tsx`) holds the `Object.assign(…)` compound, its component JSDoc (C-DOCS) and the flat re-exports, and nothing imports it; the barrel keeps importing from it, so no barrel change is needed in wave B (D32).
23. **Screen readers are part of the exit evidence.** jsdom cannot tell how a screen reader speaks a live region, a named group or `aria-checked="mixed"`; §6.3 lists the checks the lead runs with NVDA, JAWS and VoiceOver, and each package names in its report the behaviours it could only assert as attributes.

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; earlier rulings are cited as "Phase 2 D17".

**Stable class names (P3-00)**

- **D1 — Wave A is one exclusive package, and the registry lists the Phase 3 parts before they exist.** `F3-foundation` applies classes to every component (about sixty modules), so nothing else can run beside it; it also writes the constants of the parts wave B creates (`toastTitleClassNames`, `colorAreaClassNames`, `treePersonaLayoutClassNames`, …), which this spec fixes in Appendix A, so every wave-B package only applies them. *Why:* the roadmap sizes P3-00 L and runs it alone as the phase's foundation; a registry every package edits would break the disjoint file ownership of wave B, and the class names of the new parts are API that the spec, not an agent, decides.
- **D2 — The registry is one server-safe module, `src/lib/classNames.ts`, exported from the entry.** It imports nothing and holds one `export const <name>ClassNames = { … } as const` per public component and part (Appendix A); `src/index.ts` adds `export * from './lib/classNames'`. Components import their constants from it. The roadmap sketch exported the constants from the component modules; that is not done. *Why:* every module under `src/components` gets the `"use client"` banner, and a Server Component that imports a value from such a module receives a client reference that throws on any property access ("Cannot access X.root on the server", the stub `verify-dist`'s react-server probe already installs); `getThemeClassName` lives in `src/lib/theme.ts` for the same reason. A second option, co-located `*.classNames.ts` modules with a banner exception, was rejected at the design review: about sixty-five new files and a filename convention that the build, `verify-dist` and the Claude hook would all have to agree on.
- **D3 — Names.** The root class is `wave-` plus the kebab-cased flat export name (`Button` → `wave-button`, `CardHeader` → `wave-card-header`, `MenuItemCheckbox` → `wave-menu-item-checkbox`); a part class is `<root>__<kebab part key>` (`wave-button__icon`, `wave-tree-item__expand-icon`); the constant is the camel-cased flat name plus `ClassNames` (`cardHeaderClassNames`), with camel-cased part keys and `as const` string literal types. Two classes that exist today keep their names: WaveProvider's root is `wave-root` (`waveProviderClassNames = { root: 'wave-root' }`) and Portal's is `wave-portal` (`portalClassNames`); both are styled scopes of `base.css`. A public component that renders no element of its own gets no constant: Dialog, Popover, Presence and the parts that clone the consumer's element (`Menu.Trigger`, `Popover.Trigger`, `Dialog.Trigger`, `Dialog.Close`, `Drawer.Trigger`, `Drawer.Close`, the new `Toast.Close`). An alias shares its component's constant (`ComboboxOption` and `DropdownOption` use `optionClassNames`; a deprecated alias uses its replacement's). *Why:* Fluent's scheme (`fui-Button`, `fui-Button__icon`, `buttonClassNames`, checked by its conformance test for every component) in WaveUI's spelling; the `__` separator keeps a part class opaque to tailwind-merge, which splits class names on `-` and passes unknown classes through untouched (checked in its v3 source), and to Tailwind's scanner, which generates nothing for them; `wave-root` and `wave-portal` are already consumer-visible scope classes, and renaming them would break every app that targets them.
- **D4 — Where a class goes.** The root class goes on the element that receives the consumer's `className` (Input with slots: the wrapper; `RadioGroup.Item`: the label; Appendix A names the element of every component whose root is not obvious). A part is an element the component renders itself that a prop or slot fills or controls (icon, dismiss or clear button, expand icon, checkmark, secondary text, validation message, hint, badge, image) or that is visible structure (track, thumb, rail, indicator, surface, beak, backdrop, header, body, footer, separator line); hidden inputs, visually hidden text, live regions, column spacers and layout wrappers are not parts. Classes are applied by the component that renders the element — first in its `cn()` call, so the consumer's `className` still comes last and wins — never inside a shared style helper (`buttonClassName()`, `menuItemClasses`, `STATUS_*`, `pickerStyles`), which non-component elements also use. A slot part passes its class in `renderSlot`'s base classes, so it stays when a slot object swaps the element (`icon={{ as: 'img', … }}`). *Why:* one rule consumers can predict ("the stable class sits where my `className` lands"); a helper-applied class would land on internal buttons that are not a `Button`; the part vocabulary is what P13-01's `slotProps` will reuse.
- **D5 — Variants carry the base classes; a nested public component also gets its parent's part class.** A component built as a kind of another public component also carries the base component's root and matching part classes (Fluent's rule, observed in its styles hooks): ToggleButton's root is `wave-button wave-toggle-button`, its icon `wave-button__icon wave-toggle-button__icon`; Appendix A lists every variant (the button family and the Toolbar buttons, the menu item kinds, and the ones the inventory confirms). A public component rendered inside another keeps its own classes and also gets the parent's part class: SplitButton's halves are `wave-button wave-split-button__primary-action-button` and `wave-button wave-split-button__menu-button`; Appendix A lists every such case. *Why:* `.wave-button` then styles every button a user sees as a button, and `.wave-split-button__menu-button` reaches one half without a structural selector.
- **D6 — No state classes.** State stays in `data-*` attributes and ARIA (C-CLASS); there is no `wave-button--checked`. *Why:* Fluent has none either, and a second state vocabulary would drift from the attributes the library already guarantees.
- **D7 — Enforcement in four layers.** (1) A conventions-gate rule `class-names`: a component module that assigns the `displayName` of a registered component must apply that constant's `root` (§1.4.1). (2) `testClassName`, which every `testSystemProps` call runs, asserts that the element receiving the consumer's `className` also carries the component's registered root class (§1.4.2): every component test checks it without a per-test change. (3) A registry test, `src/__tests__/classNames.test.ts`: every component-like public export has a constant or is on the no-element list, every constant follows D3's formula (or is one of the two exceptions), no class string repeats, every part key is applied somewhere in `src/components`, every constant is exported from the entry (§1.4.3). (4) `verify-dist`: the constants exist in the ESM and CJS builds, a Server Component can read them from the entry under `--conditions=react-server`, and an import of only `Button` keeps `wave-button` and drops `wave-dialog` (§1.4.4). *Why:* the roadmap's exit criterion ("the conventions gate enforces the class-name rule"); a gate alone is a text match, so the runtime check in the component tests proves the class lands on the right element, and the registry test proves nothing is missing.
- **D8 — Stability, and `buttons-29`.** From 0.8 the class names are public API: renaming or removing one, or moving it to another element, is a breaking change (CHANGELOG "Changed"); adding a part is not. `buttons-29` ("headless hooks and static class names are not public") is only half closed by P3-00: P3-00 **mitigates** it and P13-02 (public contexts and recomposition hooks) closes it; the roadmap is updated (§5.5). *Why:* Fluent's RFC states it for its static classes ("changes to a slot's name, or removing a slot, are breaking changes"); closing a gap whose second half remains open would misstate the parity.

**Toasts (P3-01, P3-02, P3-03)**

- **D9 — Toast parts.** `Toast` becomes a compound: `Toast.Title` (an `action` slot at the end of the title row), `Toast.Body` (a `subtitle` below the body), `Toast.Footer` (a row of actions) and `Toast.Close`, with the flat names `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`. The part that makes its child dismiss the toast is **`Toast.Close`**, not the sketch's `Toast.Trigger`; its JSDoc names Fluent's `ToastTrigger`. The status icon is replaced through a new `icon` slot on the `Toast` root (the status-icon slot rule, as `MessageBar.icon`), not through a `media` slot on `Toast.Title` as the sketch had both. The 0.7 `title` prop and plain children keep working and render through the Title and Body part elements (one styling hook for both forms); a `title` prop next to a `Toast.Title` part gives way to the part, with a development warning. *Why:* in WaveUI a `*.Trigger` part opens a surface (`Dialog.Trigger`, `Menu.Trigger`, `Popover.Trigger`) while `Dialog.Close` and `Drawer.Close` close one, so a dismissing `Toast.Trigger` would read as the opposite of what it does; one icon slot is enough, and it must live on the root because the 0.7 options form has no title part (Fluent's `media` is the intent icon itself).
- **D10 — The toast container.** The Toaster renders every toast inside its own container element: `role="group"`, `tabIndex={-1}` (the keyboard shortcut can focus it; it is no Tab stop), `aria-labelledby` = the severity text and the title and `aria-describedby` = the body, both only while a `Toast` inside has registered those parts (through a per-toast context, so a Toast rendered by the app's own wrapper component registers too; never a dangling id), the pause handlers, the Delete key and the presence attributes. The `Toast` visual inside it is no live region (as in 0.7). A `Toast` rendered outside a Toaster stays its own live region and is not labelled (a named live region can have its name read before or after its content). *Why:* Fluent puts its role, labels and focusability on the same internal container (`ToastContainer`), because dispatched content is arbitrary; a context registration works at any depth, where a static scan of the dispatched element would miss a Toast inside the app's own component; naming the toast lets a focused toast announce "Error: Upload failed, group".
- **D11 — Every Toast in the Toaster shows the built-in Dismiss button** (maintainer ruling), the options form as in 0.7 and a dispatched `<Toast>` through the per-toast context, also inside the app's own wrapper component. Content without a `Toast` gets none; `Toast.Close` works inside it. There is no opt-out in 0.8; a `dismiss` slot can add one later without breaking anything (backlog `toaster-9`). *Why:* the 0.7 contract, a pointer path to dismiss a toast that never times out, and the design review's choice.
- **D12 — `dispatchToast` with content.** A second signature `dispatchToast(content: React.ReactNode, options?: ToastDispatchOptions): string` sits next to 0.7's `dispatchToast(options: ToastOptions): string`. The options form is recognised as a plain object: not `null`, not a React element, not an array or other iterable, not a thenable; anything else is content. It returns the toast's id, as in 0.7 (Fluent's returns nothing). `ToastDispatchOptions` = `toastId`, `timeout` (both as 0.7), `status` and `statusLabel`, and `announcement`. The severity (politeness and the spoken prefix) comes from the `status` and `statusLabel` of the rendered `Toast`; the options' `status` and `statusLabel` apply only to content without a `Toast`, and a rendered `Toast` whose severity differs from them warns once in development (`useToastController:status-conflict`). `ToastController['dispatchToast']` becomes an overloaded member (CHANGELOG "Types": a consumer that implements the interface, such as a test double, must accept content too). *Why:* keeps the 0.7 contract (the id) and API; the rendered Toast is what the user sees, so its severity must win, while arbitrary content needs the option (Fluent keeps severity only in the dispatch options); a plain-object test is exact, because a plain object is never valid React content.
- **D13 — What screen readers hear.** A toast's text is added once to the Toaster's permanent live regions (0.7): the severity text, then the title, then the body, read from the rendered title and body elements after the toast mounts (a layout effect of its container); content without a title or body part is read whole. `announcement` replaces the title and body text; the severity still leads (`statusLabel: ''` drops it). `error` is assertive, every other status polite (0.7). Replacing a toast by its `toastId` announces it again (0.7). Button labels ("Undo", "Dismiss") are not read. *Why:* the roadmap's acceptance ("Error: <title> <body>", read once); Fluent reads the toast's whole text content, button labels included, which repeats what the user reaches anyway; reading the DOM after mount works for any content, where a text walk over React nodes cannot see what components render.
- **D14 — Toaster keyboard.** `shortcuts?: { focus?: (event: KeyboardEvent) => boolean }` (Fluent's shape): a `keydown` listener on the document; when `focus` returns `true` and a toast is shown, it prevents the default, remembers the focused element and focuses the container of the most recently dispatched shown toast. Escape inside the toast region, unless a widget inside consumed it (`defaultPrevented`), prevents the default (so a Dialog under the toasts stays open: the dismiss-layer stack ignores a prevented Escape), dismisses every toast and returns focus to where it was before focus entered the toasts (0.7's focus-origin tracking, which the shortcut also sets). Delete or Backspace on a focused toast or inside it, except in an editable field, dismisses that toast, and focus moves as for any dismissal (0.7: the next toast, else the previous one, else the origin); Backspace joins Fluent's Delete because it is the delete key of Mac keyboards (TagPicker removes a tag with either). No arrow keys between toasts in 0.8 (ROADMAP §8.5). *Why:* the roadmap sketch; Fluent restores focus after Escape only when the toast was reached through its shortcut, and WaveUI already tracks the origin for every entry; the Toaster region counts as inside every dismiss layer (`ALLOW_OUTSIDE_SELECTOR`), so without `preventDefault()` an Escape in a toast would close the Dialog below; Fluent's arrow navigation is marked as a stopgap in its own source.

**MessageBar (P3-04)**

- **D15 — MessageBar parts are found by a static scan.** `MessageBar` becomes a compound with `MessageBar.Title` and `MessageBar.Actions` (flat `MessageBarTitle`, `MessageBarActions`). The bar sorts its children with `flattenChildren` and `isElementOfType` (Server Component references included): the first Title goes first in the text column, after the visually hidden severity text; every Actions part goes to the action area; the rest is the body. A part the scan cannot see (inside the app's own component) renders where it is and warns once (`MessageBar.Title:unscanned`, `MessageBar.Actions:unscanned`), detected through a context the bar provides to the parts it placed. A second Title renders as body content and warns (`MessageBar.Title:multiple`). *Why:* the bar must place Actions apart from the text (a different row in the multiline layout), which only a partition of its children can do; the scan works on the server (the Menu.Group precedent, Phase 2 D12).
- **D16 — A title labels the bar only when the bar is not a live region.** With the default roles (`alert` for warning and error, `status` otherwise) the bar is a live region, and the title is not wired as its name: it is read once as the first words of the content ("Warning: Update available. A new version is ready to install. Update now, Later"). With a non-live role that the consumer passes (`role="region"` for a notice that stays on the page, or `role="group"`) the title labels the bar through `aria-labelledby` pointing at the severity text and the title, so the severity stays in its name. A consumer `aria-label` or `aria-labelledby` always wins. *Why:* a live region with a name from the author can have that name read before or after its content ([a11ysupport.io, role=alert](https://a11ysupport.io/tech/aria/alert_role)), which would read the title twice; `role="region"` needs a name to be a landmark, which the title then provides. The roadmap sketch ("labels the bar through `aria-labelledby`") and Fluent (a non-live `role="group"` bar labelled by its title, announced through a separate announcer) differ; ROADMAP §8.3 records it.
- **D17 — MessageBar layout.** `layout?: 'auto' | 'singleline' | 'multiline'`, default `'auto'`; the root always renders `data-layout` with the layout in use (`singleline` or `multiline`; enumerated, Phase 1 D22). `singleline`: one row, icon · text (no wrapping, an ellipsis if it must truncate) · actions · Dismiss. `multiline`: icon · text (wrapping) · Dismiss on the first row, the actions on a row of their own under the text (grid placement); a bar without actions keeps 0.7's row exactly. The DOM order is the same in both layouts, icon, text, actions, Dismiss, so the Tab order is text, actions, Dismiss everywhere and a reflow never moves a focused element (Fluent reorders the DOM between its layouts, which moves the actions or the Dismiss button while one may have focus, and a moved node loses focus). `'auto'` with an Actions part renders `singleline` on the server and on the first client render, then a ResizeObserver switches it to `multiline` while the single line overflows (`clientWidth < scrollWidth`), remembering the width it needed, and back to `singleline` once the bar is at least that wide (Fluent's two-way rule), read through `useSyncExternalStore` (C-HOOKS). `'auto'` without Actions is `multiline`, the 0.7 look, with no observer. *Why:* the roadmap sketch and its acceptance ("SSR renders `singleline` for `auto` until measured"); a bar without actions has nothing to reflow, and measuring it would shift the layout of every 0.7 bar after hydration for no gain.

**Color (P3-05)**

- **D18 — `HsvColor` and the public helpers.** `HsvColor = { h: number; s: number; v: number; a?: number }` with Fluent's ranges: `h` 0–360, `s`, `v` and `a` 0–1 (`a` left out means opaque); it lives in `src/lib/types.ts`. A new server-safe module `src/lib/color.ts` exports `hsvToHex(color: HsvColor): string` (lowercase `#rrggbb`, or `#rrggbbaa` below full opacity: ColorPicker's format) and `hexToHsv(hex: string): HsvColor | null` (the formats ColorPicker accepts; `null` for anything else). *Why:* Fluent's type, so its recipes port; the standalone parts take `HsvColor`, and an app that keeps a hex string needs a conversion (Fluent ships none and its stories use an external library).
- **D19 — `ColorArea`.** `value`/`defaultValue`/`onValueChange(value: HsvColor)` (C-NAMING; Fluent's `color`/`onChange(event, data)` data carries only the event besides the color, so the second argument is left out in 0.8), `shape?: 'rounded' | 'square'`, `labels`, and the value-control props `name`, `form`, `required` (C-FORMS: the hex of the color is submitted, and a form reset restores `defaultValue`; the same for `ColorSlider` and `AlphaSlider`). It edits saturation (x) and brightness (y) at the value's hue; hue and alpha pass through. The root is a `role="group"` (named by the consumer's `aria-label`/`aria-labelledby`) holding two visually hidden native `<input type="range">` sliders, "Saturation" and "Brightness", with `aria-roledescription="2D slider"` and an `aria-valuetext` naming both channels and the color (D22). Keys (the APG slider keys per axis, React Aria's 2-D model; Fluent has only plain arrows): ArrowLeft/ArrowRight move saturation by 1 (mirrored in RTL, through `getArrowIntent`), ArrowUp/ArrowDown brightness by 1, Shift with an arrow by 10, PageUp/PageDown brightness by 10, Home/End saturation to its minimum/maximum; focus follows the axis to the matching hidden input, so the channel that changed is announced. A primary pointer press (mouse, touch or pen) jumps the thumb to the point and focuses the saturation input; dragging continues with pointer capture (`touch-action: none`). In RTL the x axis mirrors (saturation grows toward the reading direction's end). The thumb is 24×24 CSS pixels with a two-tone ring (the `background` and `foreground` tokens) that shows on any color; in forced colors the color field keeps its gradient (`forced-color-adjust: none` on it only) and the ring is drawn in system colors. `onValueChange` fires on every step (key or pointer move) that changes the color. *Why:* the roadmap's acceptance (arrows by 1, Shift by 10, RTL mirroring, `aria-valuetext` naming the color, forced colors); native range inputs let mobile screen readers adjust the value with swipes, which a `role="slider"` element cannot offer on iOS; 24 px meets WCAG 2.5.8 (Fluent's thumb is 20 px); Fluent's area does not mirror, which ROADMAP §8.3 records.
- **D20 — `ColorSlider` and `AlphaSlider`.** `ColorSlider`: `channel?: 'hue' | 'saturation' | 'value'` (default `'hue'`), `orientation?: Orientation` (default `'horizontal'`; C-NAMING, where Fluent has a `vertical` boolean), `value`/`defaultValue`/`onValueChange` (`HsvColor`), `shape`, `labels`. One native `<input type="range">` over a gradient rail, with a 24×24 thumb: hue 0–360 (step 1), saturation and brightness 0–100 %; the same keys as `ColorArea` on its one axis (arrows by 1, Shift by 10, PageUp/PageDown by 10, Home/End); a horizontal rail mirrors in RTL; `aria-valuetext` "210°, blue" for hue and "72%" for the others. `AlphaSlider`: `ColorSlider` without `channel`, plus `transparency?: boolean` (the rail and the value text show transparency instead of opacity; `a` still means opacity), `aria-valuetext` "40%", and a CSS-only checkerboard drawn from theme tokens under the rail. The gradients are inline CSS custom properties built from the value (the only runtime colors, marked `// wave-allow-color:`). *Why:* Fluent's props renamed by C-NAMING (`orientation`, `value`); Fluent's checkerboard is a PNG loaded from a CDN, which a library without runtime network requests cannot copy.
- **D21 — ColorPicker becomes a composable container; its value stays a hex string.** `value`/`defaultValue`/`onValueChange` keep 0.7's hex contract. Inside, the picker keeps an HSV working color, so hue and saturation survive grey, white and black (hex cannot carry them); a value that changes from outside re-derives it, keeping the hue when the new color has no hue of its own (and the saturation at zero brightness). Without children the picker renders 0.7's layout plus a `ColorPicker.Area` and a hue `ColorPicker.Slider` at the top, and with `showOpacity` its opacity row (its visible caption and percentage readout kept) takes a `ColorPicker.AlphaSlider` as its slider (a visual change, CHANGELOG "Visual"; composing the parts is the opt-out). A value that is not a hex color disables the area and the sliders until a hex value arrives (0.7 disabled the opacity slider), through the standalone parts' `disabled` prop. The parts render inside a `null` Field context and own no hidden input: the picker's group takes the Field wiring and its one hidden input submits the color (0.7). With children it renders only them inside its `role="group"` root, with the 0.7 hidden input, Field wiring and form reset; the parts read and write the picker's color through a context (C-CONTEXT). The parts are `ColorPicker.Area`, `ColorPicker.Slider` (`channel`, default `'hue'`; it replaces the sketch's `HueSlider`, so saturation and brightness sliders fit too), `ColorPicker.AlphaSlider`, `ColorPicker.HexField`, `ColorPicker.Swatches` (the root's `presets`) and `ColorPicker.Preview` (not in the sketch; needed to rebuild the default layout), with the flat names `ColorPickerArea`, …; each binds a standalone component (or, for the hex field, preview and swatches, the 0.7 pieces) to the picker. `shape?: 'rounded' | 'square'` on ColorPicker is inherited by its parts; the standalone parts take their own. `ColorPickerLabels` gains the strings of the new parts. *Why:* the roadmap sketch keeps the 0.5 layout "plus area and hue slider"; a hex value is the 0.7 contract and what forms submit; the working color is what keeps a hue slider from jumping to red while the user drags saturation to zero.
- **D22 — Color text for assistive technology.** `aria-valuetext` of the area's inputs: "Saturation 72%, Brightness 74%, dark blue" (both channels on both inputs, then the color name); of the hue slider: "210°, blue"; of the saturation and brightness sliders: "72%"; of the alpha slider: "40%" (opacity, or transparency with `transparency`). The color name comes from a small built-in English namer (hue families, a lightness and a saturation qualifier, black/white/gray; §2 P3-05 pins its table), which `labels.colorName?: (color: HsvColor) => string` replaces (return `''` to drop it); the channel names come from `labels` too. *Why:* the roadmap's acceptance ("`aria-valuetext` names the color"); a function label has precedents (TagPicker `labels.remove`, AvatarGroup `overflowLabel`), and word order across languages makes a table of fragments unfit for translation.

**Trees (P3-06, P3-07)**

- **D23 — Selection modes.** `selectionMode?: 'none' | SelectionMode` (the shared `'single' | 'multiple'`), default `'none'`, the 0.7 behaviour; Fluent's `'multiselect'` is not accepted. `'multiple'`: `checkedItems?: readonly string[]`, `defaultCheckedItems?: readonly string[]`, `onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void` with `details = { value, checked, event }` (the item that changed, its new state, the DOM event); through `useControllable`, so it fires only on change and receives a fresh array. `'single'` draws radio indicators for 0.7's `selected`/`onItemSelect` (`aria-selected`), so there is one single-selection API. The root always renders `data-selection-mode` with the mode (enumerated). *Why:* the roadmap sketch; `details` carries what Fluent's `onCheckedChange` data carries besides the aggregate (the value and its new state), so a consumer never has to diff two arrays; `details` is optional through 0.x like every `details` added since 0.6 (D31).
- **D24 — Checks cascade** (maintainer ruling). An item's descendants are the `Tree.Item` elements among its children, recursively: the same scan that forms child groups, collapsed items included (their elements exist as children even while their group is not rendered); a `leaf` item has none, and a nested `Tree` (the 0.4 form) is a tree of its own. An item is checked when its value is listed in the checked items, when an ancestor's value is listed, or when every descendant is checked; mixed when some but not all descendants are checked or mixed; else unchecked. Toggling a checked item unchecks it and all its descendants; toggling an unchecked or mixed item checks it and all its descendants. The emitted array lists every checked item in tree order (fully checked parents included, mixed items not), followed by the listed values that match no item, unchanged (so values filtered out of the tree are not lost). A listed parent therefore also checks children that load later (a "Loading…" placeholder replaced by real items). *Why:* the design review chose the roadmap's cascade; WaveUI knows every item up front from its children, which is why Fluent's nested Tree leaves the cascade to the app ("difficult to manage without knowing the items upfront") and only its flat headless helper computes it; listing fully checked parents lets an app read "Documents is selected" without walking the tree.
- **D25 — Indicators, keys and pointer.** In `'multiple'` the tree carries `aria-multiselectable="true"`; every item `aria-checked="true" | "false" | "mixed"` and `data-checked` (checked) or `data-mixed` (mixed), both boolean attributes; the row draws a checkbox indicator between the chevron and the icon: a decorative `aria-hidden` span with Checkbox's look and forced-colors recipe (check or mixed glyph), not a nested control. In `'single'` the row draws a radio indicator. Space toggles the focused item in `'multiple'` (in the other modes it activates, as in 0.7); Enter activates as in 0.7 (`onItemSelect`, and a parent toggles its expansion); a click on the indicator (a 24×24 target) toggles the item's check, a click elsewhere on the row activates it (Fluent's model). In `'multiple'`, `selected` does not apply (an item carries `aria-checked` or `aria-selected`, never both, APG) and warns once in development (`Tree:selected-with-multiple`). *Why:* APG treeview ("Space toggles the selection state of the focused node"; "either `aria-selected` or `aria-checked`"); a nested focusable Checkbox (Fluent's selector slot) is interactive content inside a treeitem and a second focus target; the row click keeps 0.7's activation, so a checkbox tree still navigates.
- **D26 — Row content.** `Tree.Item` gains `actions?: React.ReactNode` (buttons at the end of the row, in a `role="toolbar"` labelled by the item's label, shown while the row is hovered or the item or its actions have focus, and always in forced colors and on devices without hover; the visibility is CSS only, so the server HTML is stable, and a hidden toolbar is `invisible`, so its buttons take no focus), `aside?: React.ReactNode` (non-interactive content at the end of the row, hidden while the actions show: Fluent's rule), `iconAfter?: Slot<'span'>` (decorative, after the label) and `expandIcon?: Slot<'span'>` (replaces the chevron; the optional-indicator slot rule: `null`/`undefined` keep it, `false` or anything that renders nothing hides it, while `aria-expanded` still tells assistive technology). *Why:* the roadmap sketch (`tree-2`, `tree-7`); labelling the toolbar by the item's label adds no built-in string.
- **D27 — `navigationMode` changes the keyboard only.** `navigationMode?: 'tree' | 'treegrid'`, default `'tree'`. `'tree'`: Tab from a focused item enters its actions toolbar (one stop, arrow keys inside it), Shift+Tab returns to the item, and the next Tab leaves the tree. `'treegrid'`: "next" (ArrowRight, ArrowLeft in RTL, through `getArrowIntent`) on a collapsed parent expands it (0.7), and otherwise moves focus into the item's actions when it has any (on an expanded parent it no longer moves to the first child; ArrowDown does); "previous" from the first action returns to the item; "next"/"previous" move between the actions without wrapping; ArrowUp/ArrowDown from an action focus the previous or next item; the actions take no Tab stop, so Tab leaves the tree. The roles stay `tree`/`treeitem` in both modes. *Why:* Fluent's `navigationMode="treegrid"` changes no role either; a real `treegrid` needs rows in one flat list with `aria-level`, which the nested DOM cannot give until the flat tree model (P11-04), so ROADMAP §8.5 records that follow-up; the roadmap names the row↔actions movement as the internal helper that P7-03 makes public.
- **D28 — `Tree.PersonaLayout`** (flat `TreePersonaLayout`): a layout for an item's label content with `media` (an Avatar or an icon), the name as children and an optional `description` below it; the item stays named by its whole label (name and description). *Why:* `tree-8`; a layout component keeps the item's naming, typeahead and click rules unchanged.

**Across the phase**

- **D29 — No motion, and toasts on the presence core.** No component gets enter or exit motion classes (Phase 10). Every toast in the Toaster mounts through `usePresence` (`appear: true`, so a consumer's enter classes run): a dismissed toast stays mounted, `inert`, until its exit ends, which is at once without motion; it no longer counts toward `limit`, is no longer announced and its timer is gone; focus leaves it in the dismissing commit (C-POPUPS). The MessageBar reflow, the color parts and the tree indicators animate nothing (color transitions carry `motion-reduce:` variants, C-MOTION). *Why:* the roadmap names the toast parts among the surfaces that mount through the presence core from the start (P2-00).
- **D30 — Bundles.** No new runtime dependency. `verify-dist` gains: the registry is tree-shaken (an import of only `Button` contains `wave-button` and not `wave-dialog`); the color parts are opt-in modules (an import of only `Button` contains none of `ColorArea`, `ColorSlider`, `AlphaSlider`, `lib/color`); an import of only `Toaster` contains `hooks/usePresence`. The CHANGELOG reports the size change of `dist/styles.css` and of the Button-only, Toaster-only, ColorPicker-only and full-import bundles. *Why:* roadmap principle 6; the class-name strings are the one addition every component carries.
- **D31 — `details` is optional through 0.x.** The `details` parameter of `onCheckedItemsChange` joins the list of `details` parameters announced in 0.x and made required in 1.0 (roadmap P13-03, P14-02). *Why:* Phase 1 D9 and Phase 2 D6.
- **D32 — Module splits.** `P3-toasts` splits `Toast.tsx` into `Toast.tsx` (the compound, its JSDoc, the flat re-exports, and the re-export of `Toaster` and `useToastController`), `Toast.root.tsx` (the `Toast` visual), `Toast.parts.tsx` (Title, Body, Footer, Close), `Toast.context.ts` (the per-toast and Toaster contexts) and `Toaster.tsx` (the container, controller, timers, live regions and keyboard). `P3-tree` splits `Tree.tsx` into `Tree.tsx` (compound and re-exports), `Tree.root.tsx`, `Tree.item.tsx`, `Tree.context.ts`, `Tree.selection.ts` (the pure cascade model) and `Tree.personaLayout.tsx`. `P3-color` adds `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx` and `ColorPicker.parts.tsx`, and `P3-messagebar` `MessageBar.parts.tsx` and `MessageBar.reflow.ts`. Nothing imports a compound module; its root is defined in a sibling module and carries no docblock of its own (C-DOCS). *Why:* the 0.7 Menu split (one-way imports, the compound's docblock on its `Object.assign(…)` const); `Toast.tsx` holds 842 lines and `Tree.tsx` 541 before this phase adds to them.

### 0.4 Out of scope for 0.8

Everything else in the roadmap. In particular: motion on any component, MessageBarGroup and the toast, tree and MessageBar motion gaps (`toast-5`, `tree-4`, `messagebargroup-1`; P10-01); per-part class-name documentation and `slotProps` (P13-01); public contexts and recomposition hooks, the other half of `buttons-29` (P13-02); `WaveProvider classNames` (P13-02); the inverted toast (`toast-4`, backlog); a Toast `dismiss` slot, the opt-out of the built-in Dismiss button (`toaster-9`, backlog; D11); arrow keys between toasts (ROADMAP §8.5); a Toaster `limit` queue priority, positions and offsets (`toaster-3` … `toaster-8`, backlog); MessageBar `shape`, `politeness` and context (`messagebar-4` … `messagebar-6`); color swatch kinds and SwatchPicker children (P5-04); RGB and HSL fields as components (a recipe story only, `colorpicker-2`); tree size and appearance (`tree-3`, backlog); per-item open state and open-change details (`tree-5`, `tree-6`); tree checks that do not cascade (ROADMAP §8.5; D24); Shift+Arrow, Shift+Space and Ctrl+A in a multi-select tree (optional in APG; ROADMAP §8.5); real `treegrid` roles (P11-04 follow-up, ROADMAP §8.5; D27); a flat tree model and virtualization (P11-04); and every other backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation

### Wave A — `F3-foundation`

Lands first and alone (§0.2 rule 19). It changes no behaviour: every component gains its stable classes (D4) and nothing else, `StatusText` gains an `id`, and the registry, its enforcement and its export are new. Its exit criteria are §1.7.

### 1.1 `src/lib/classNames.ts` (new, public)

The registry of Appendix A, one constant per public component and compound part, grouped by component folder in Appendix A's order:

```ts
/**
 * Stable class names of Button (P3-00): `root` on the `<button>`, `icon` on the icon box. Style
 * them from your own CSS (`.wave-button`, `.wave-button__icon`); they never change within a major
 * version. State is not a class: use the `data-*` attributes (`[data-pressed]`, `[data-disabled]`).
 */
export const buttonClassNames = {
  root: 'wave-button',
  icon: 'wave-button__icon',
} as const;
```

- **No imports.** The module holds string constants only, so it runs on the server and in a Server Component (D2), and the build gives it no `"use client"` banner (it is under `src/lib`).
- **One JSDoc per constant**, naming the element each key lands on. The module header states the formula (D3), the placement rule (D4), the variant and nesting rule (D5), that there are no state classes (D6) and the stability promise (D8). Comments and JSDoc never contain a Tailwind utility name as a bare word (CLAUDE.md "Styling"): Tailwind reads every word under `src/lib`, and `node scripts/build-css.mjs` fails on a utility that no class string uses. Name elements by role ("the grid element", "the row element") where their tag is a utility word.
- **`as const`** gives every value its literal type (`typeof buttonClassNames.root` is `'wave-button'`), so a consumer can build a typed selector (`` `.${buttonClassNames.icon}` ``).
- **The Phase 3 parts are registered now** (D1): the constants of `Toast.Title`, `Toast.Body`, `Toast.Footer`, the Toaster's `toast` container, `MessageBar.Title`, `MessageBar.Actions`, `ColorArea`, `ColorSlider`, `AlphaSlider`, the six ColorPicker parts, the new `Tree.Item` parts and `Tree.PersonaLayout`, exactly as Appendix A lists them. The registry test skips them until they are applied (§1.4.3 `PENDING_CLASS_NAMES`).

### 1.2 Applying the classes

Rules for `F3-foundation` (every existing component) and for the wave-B packages (their new parts):

1. **The root class comes first in the root's `cn()`:** `className={cn(buttonClassNames.root, internalClasses, className)}`. A root whose `className` is passed through without `cn()` today (Breadcrumb, Nav, Table, DataGrid, `OptionGroup`, `Menu.Group`, `Skeleton.Group`: the inventory found these) switches to `cn(<name>ClassNames.root, className)`; nothing else about it changes.
2. **Variants** (D5) list the base constant first: `cn(buttonClassNames.root, toggleButtonClassNames.root, …)`; their parts likewise (`cn(buttonClassNames.icon, toggleButtonClassNames.icon, …)`). A variant that renders the base component (a `<Button>`) gets the base classes from it and adds only its own.
3. **Parts** carry their class in the element's `cn()`; a slot part passes it in `renderSlot`'s base classes (`renderSlot(icon, 'span', cn(buttonClassNames.icon, 'inline-flex …'), { 'aria-hidden': true })`), so a slot object that swaps the element keeps it; an internal SVG glyph (`lib/icons`) takes it through `className`. A part that is rendered conditionally carries its class whenever it renders.
4. **A nested public component** gets the parent's part class through its `className` prop, merged with any consumer class for that element (`primaryActionButtonProps.className` for SplitButton): `<Button {...primaryActionButtonProps} className={cn(splitButtonClassNames.primaryActionButton, primaryActionButtonProps?.className)} />`.
5. **Where `className` lands elsewhere than `ref`** (Input with slots, `RadioGroup.Item`, the components Appendix A marks), the root class follows `className`.
6. **Nothing else changes** (§0.2 rule 19): no markup, no attribute, no style. The `data-wave-*` markers stay (they are internal query hooks; Appendix A notes which part class now shares an element with one).
7. **Wave-B packages** apply the pre-registered constants to their new elements from the first commit (§0.2 rule 20); a Phase 3 part whose element the design does not produce as registered is a change request.

### 1.3 `StatusText` gains an `id` (`src/components/feedback/MessageBar.status.tsx`)

`StatusText({ label, id }: { label: string; id?: string })` renders `<span id={id} className="sr-only">{`${label} `}</span>` (and nothing for an empty label, as in 0.7). `P3-toasts` points the toast container's `aria-labelledby` at it (D10) and `P3-messagebar` a labelled bar's (D16). Internal; no other change in the module.

### 1.4 Enforcement (D7)

#### 1.4.1 The conventions rule `class-names` (`src/__tests__/conventions.test.ts`)

- A new `RuleId` `'class-names'` with the hint "apply `<name>ClassNames.root` first in the root element's `cn()`, from `src/lib/classNames.ts` (C-CLASS, stable class names)".
- For a source of kind `component`, every `<Identifier>.displayName = '<Name>'` in code (not in a string or comment) whose `<Name>` maps to a registry constant (through `getStableClassNames`, §1.4.2) requires the file's code (outside strings and comments, the lexer's `bare` text) to contain `<constant>.root`; otherwise the rule reports the `displayName` line. A `displayName` that maps to no constant (an internal component such as `ToasterItem` or `MenuItemRow`, a context) is skipped.
- Its fixtures (the gate tests its own rules with inline sources): a module that sets `Button.displayName = 'Button'` without `buttonClassNames.root` fails; with it, it passes; `buttonClassNames.root` inside a comment or a string does not count; an internal `displayName` passes; a `displayName` that differs from its flat name (`'RadioItem'`) is looked up through the alias table.
- The Claude hook needs no change (it runs the gate for the edited component files).

#### 1.4.2 `src/test-utils.ts`

- **`getStableClassNames(displayName: string): { constant: string; root: string; carries: readonly string[] } | undefined`** (test-only; exported for the gate and the helper tests): the registry constant of a component, found as the camel-cased `displayName` plus `ClassNames`, or through `DISPLAY_NAME_ALIASES`, a table of the display names that differ from their flat names (Appendix A lists them); `carries` is every root class the element must carry: the base classes of a variant (D5) and its own, from a `VARIANT_BASES` table that mirrors the roots of Appendix A's "Also carries" column (ToggleButton → Button; `Toolbar.ToggleButton` → Button and ToggleButton; `Menu.ItemCheckbox` → `Menu.Item`; CounterBadge → Badge; the ColorPicker parts → their standalone components; …).
- **`testClassName`** (run by every `testSystemProps`) gains one case, registered only when the component has a constant: *"carries its stable classes on the element that receives className"*. It renders the component with the consumer class it already uses (`wave-test-custom-class`), finds the element that has that class (`document.body.querySelector`, so a portaled or wrapped root is found too) and asserts it has every class of `carries`. It uses no `data-testid`, so a component whose `className` and rest props land on different elements (`RadioGroup.Item`) is checked where `className` lands.
- **`src/__tests__/test-utils.test.tsx`** gains cases: the lookup (flat name, alias, a variant's `carries`, an internal display name that has none), the new `testClassName` case on Button, ToggleButton (both classes), `RadioGroup.Item` (the label) and a component without a constant (no case registered).

#### 1.4.3 `src/__tests__/classNames.test.ts` (new)

- **Completeness.** Every export of `src/index.ts` whose name starts with an uppercase letter and whose value is component-like (a function, or an object with a `$$typeof`), and every compound member reached from one (`Card.Header`), has a registry constant (by its flat name, or shares its alias target's) or is on `NO_ELEMENT` (D3: Dialog, Popover, Presence, the trigger and close parts). The alias table of §1.4.2 and `NO_ELEMENT` are the only exceptions, each entry with a comment naming why.
- **Formula.** Every constant is named `<camel flat name>ClassNames`; `root` is `wave-<kebab flat name>` (except `waveProviderClassNames.root === 'wave-root'` and `portalClassNames.root === 'wave-portal'`); every other key is camelCase and its value is `<root>__<kebab key>`; no class string occurs twice across the registry; no value is one of the reserved scope classes (`wave-light`, `wave-dark`, `wave-high-contrast`, and `wave-root`/`wave-portal` outside their two owners; Appendix A judgement 36).
- **Export.** Every registry export is exported from the entry with the same value.
- **Server safety.** The registry's source contains no `import` or `require`.
- **Applied.** Every value of every constant (the roots and the parts) occurs as `<constant>.<key>` in the code of some module under `src/components/` (a raw-source glob, as the gate reads files), except the entries of `PENDING_CLASS_NAMES`: `F3-foundation` lists there the Phase 3 constants and keys that wave B applies (§1.1), and INTEGRATION empties it once wave B has landed (§4.3).

#### 1.4.4 `scripts/verify-dist.mjs`

- **Server probe.** The `index` check of `serverProbeSource` also asserts that `buttonClassNames` is a plain object, not a client reference, and that its `root` is `'wave-button'`; a new check for `lib/classNames.[cm]js` asserts that every export is an object whose values are all strings. A Server Component can therefore read the constants from the package entry (D2).
- **Tree shaking.** `probeTreeShaking` gains `keepStrings` and `dropStrings` options (string literals that must, or must not, appear in the unminified bundle code); the Button-only probe passes `keepStrings: ['wave-button']` and `dropStrings: ['wave-dialog']`, proving the registry is tree-shaken per constant (Rollup drops the unused `const` declarations of an included module).
- **Declarations.** `REQUIRED_DECLARATIONS` gains `buttonClassNames` (the rolled-up `index.d.ts` must declare the constants).
- **Flat-name bridge.** `PENDING_FLAT_EXPORTS = ['Toast', 'MessageBar', 'ColorPicker', 'Tree']` (§0.2 rule 21); `--final` still requires it empty, which INTEGRATION restores.
- **Tests** (`scripts/__tests__/verify-dist.test.mjs`): the new checks on fixture dists (a constant re-exported from a client module fails the server probe; a bundle that keeps `wave-dialog` fails the Button-only probe; a missing `buttonClassNames` declaration fails), and the cases that assert the complete error list or an empty bridge pass the new probes or `pendingFlatExports: []` explicitly (as Phase 2 §6.4 did).

### 1.5 Entry and public types

`src/index.ts` adds, under "Utilities": `export * from './lib/classNames';` (wave A is exclusive, rule 19). `src/__tests__/public-types.test.ts` adds: `expectTypeOf(buttonClassNames.root).toEqualTypeOf<'wave-button'>()`, `expectTypeOf(toggleButtonClassNames).toHaveProperty('icon')`, `expectTypeOf(waveProviderClassNames.root).toEqualTypeOf<'wave-root'>()`, and a `@ts-expect-error` assignment to a constant's key (the objects are readonly).

### 1.6 Tests of wave A

- The gate rule and its fixtures (§1.4.1); the helper and its tests (§1.4.2); `src/__tests__/classNames.test.ts` (§1.4.3); the `verify-dist` checks and their tests (§1.4.4); the public types (§1.5).
- Every component test keeps passing with the new `testClassName` case; a `testSystemProps` call whose root is not where `className` lands (§6.4 lists the ones the inventory found) is fixed in the test's config, not by moving the class.
- The existing tests that compare a complete class string, class list or markup string are updated for the added classes (§6.4); none is deleted.
- `StatusText`'s `id`: a unit case in `MessageBar.test.tsx` (rendered through a bar with a status label; the span carries the id).
- `node scripts/build-css.mjs` passes (no utility generated from the registry's words).

### 1.7 Exit criteria of wave A

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (with the Phase 3 entries of `PENDING_CLASS_NAMES` skipped), `npm run build` and `node scripts/verify-dist.mjs` (with the bridge) pass; the conventions gate reports no `class-names` violation; every existing component test passes unchanged apart from the exact-class updates of §6.4; Storybook builds (`npm run build-storybook`). The lead commits the package before wave B starts.

---

## 2. Items

Each item gives: gaps closed, public API (with JSDoc outline and `data-*` state), behaviour (keyboard per APG, focus, ARIA, SSR, RTL, forced colors, motion), files, tests, guards, stories, docs notes and compatibility. "Docs" lines are input for DOCS (§5), which writes the final text. Wave-B tests follow §0.2 rule 9: they render only the foundation, 0.7 APIs and their own package's new APIs; combinations of two wave-B packages are INTEGRATION cases (§4.4).

### P3-00 — Stable class names for components and parts (F3-foundation)

- **Closes:** `foundation-37` (M). **Mitigates:** `buttons-29` (L), closed by P13-02 (D8).
- **API.** The registry `src/lib/classNames.ts` (§1.1): one exported `as const` constant per public component and part, as Appendix A lists them, exported from the package entry. No component prop changes.
- **Behaviour.** D3–D6 and §1.2: every root and part carries its class; variants carry their base classes; nested public components carry their parent's part class; no state classes.
- **SSR.** The classes are strings in the server HTML; the constants are readable in a Server Component (D2, §1.4.4). **RTL, forced colors, motion.** Nothing changes.
- **Guards** (roadmap "no runtime styles"; "`cn()` keeps the consumer's `className` last"): the registry adds classes only (no `style`, no runtime CSS: the Button-only probe and the existing no-runtime-style tests stay green); `testClassName`'s existing cases ("keeps its default classes when a className is added", "lets a conflicting consumer className win") stay green next to the new one.
- **Files.** §3, `F3-foundation`.
- **Tests.** §1.6.
- **Stories.** None of its own; the stories gate renders every component with its classes.
- **Docs.** README: a new "Styling hooks" section (the formula, an example of `.wave-button__icon` in app CSS and of a typed selector from `buttonClassNames`, variants and nested components, no state classes (use `data-*`), the stability promise, readable in Server Components; the per-part tables come with P13-01) and a line in "React Server Components"; CHANGELOG Added and "DOM" (every root and part gains a class); CLAUDE.md C-CLASS and Architecture (§5.3).
- **Compatibility.** Additive. The class attribute of every component gains classes (an app's test that compares a complete class string changes; CHANGELOG "Upgrading").
- **Size.** L.

### P3-01 — `dispatchToast` with React content (P3-toasts, after P3-02)

- **Closes:** `toast-1` (H).
- **API** (`Toaster.tsx`; the types re-exported from `Toast.tsx`):
  ```ts
  /** Options of `dispatchToast(content, options)`, the form that shows your own React content. */
  export interface ToastDispatchOptions {
    /** As `ToastOptions.toastId`: dispatching again with the id of a shown toast replaces it. */
    toastId?: string;
    /** As `ToastOptions.timeout`. @default 5000 */
    timeout?: number;
    /**
     * Severity of content that renders no `Toast`: sets the announcement's politeness (`error` is
     * assertive) and its spoken prefix. A rendered `Toast` uses its own `status`; a different value
     * here warns in development.
     * @default 'info'
     */
    status?: Status;
    /** Visually hidden severity text for content that renders no `Toast` (as `Toast.statusLabel`). */
    statusLabel?: string;
    /**
     * Text announced instead of the toast's title and body (the severity text still comes first),
     * for a toast whose visible text is no good announcement, such as a progress toast.
     */
    announcement?: string;
  }

  export interface ToastController {
    /**
     * Shows a toast and returns its id. `dispatchToast(options)` builds a toast from text (0.5);
     * `dispatchToast(content, options?)` shows your content, usually a `<Toast>` with parts. A plain
     * object is read as options; anything else is content.
     */
    dispatchToast: {
      (options: ToastOptions): string;
      (content: React.ReactNode, options?: ToastDispatchOptions): string;
    };
    dismissToast: (id: string) => void;
    dismissAllToasts: () => void;
  }
  ```
- **Behaviour** (D12, D13).
  - **Recognition.** `isToastOptions(arg)`: `typeof arg === 'object' && arg !== null && !React.isValidElement(arg) && !(Symbol.iterator in arg) && typeof arg.then !== 'function'`. The 0.7 form is unchanged; content forms keep `{ content, options }` in the entry.
  - **Rendering.** The toast container (P3-02, D10) renders the entry's content as given, or, for the options form, a `<Toast>` built from the options (its title and body render through `Toast.Title` and `Toast.Body`, P3-02).
  - **Replacing** by `toastId` replaces the content and the options, announces again and restarts the timer; the toast keeps its place and its focus (0.7).
  - **Severity.** The `Toast` rendered inside a container registers its `status` and `statusLabel` with the per-toast context (a layout effect); the container uses the registration, else the options' `status` and `statusLabel`. When both exist and differ, one development warning from an effect (`useToastController:status-conflict`: "useToastController: the dispatched Toast has status "error" but the options say "info"; the Toast's status is used. Remove `status` from the options.").
  - **Announcement.** After the toast mounts, the container's layout effect (which runs after the Toast's registrations) composes the text: the severity text, then `announcement` if given, else the `textContent` of the registered title and body elements; content without a registered title or body contributes its whole `textContent` (the Dismiss button has no text of its own, so none is read). Whitespace is collapsed. The text joins the Toaster's polite or assertive live region for 2 seconds (0.7's `LiveMessage`, keyed by the dispatch). The options form keeps 0.7's text exactly ("Error: Upload failed Try again.").
  - **Timers, `limit`, focus.** As 0.7, with P3-02's presence rules (a dismissed toast no longer counts toward `limit`) and P3-03's keys.
- **ARIA.** The container of P3-02. **SSR.** Toasts are dispatched on the client; the Toaster region renders on the server with no toasts (0.7). **RTL.** Nothing new. **Forced colors.** As 0.7 and P3-02. **Motion.** None (D29).
- **Guards** ("severity is spoken by Toast"; "live regions need no provider"; "timers pause on focus inside the toast"): a rich error toast announces "Error: Upload failed The file is too large." once, in the assertive region, with no provider or announcer mounted; an Undo button inside a rich toast pauses its timer while focused and runs its handler; the 0.7 announcement and timer tests stay green.
- **Files.** `Toaster.tsx`, `Toast.context.ts` (with P3-02).
- **Tests** (`src/components/feedback/__tests__/Toaster.content.test.tsx`): recognition (an element, a string, a number, an array, a Fragment and `null` are content; a plain object is options; an object with `then` is content); the returned ids (given and generated); an Undo button in a rich toast runs its handler, pauses the timer while focused (fake timers) and resumes after blur; the announcement of a rich toast (polite for `success`, assertive for `error`, once), with `announcement`, and of content without a Toast (options' status and politeness, its whole text); a `Toast` inside the app's own wrapper component registers (labelled container, the Dismiss button, the Toast's severity); the status-conflict warning (asserted); replacing by `toastId` announces again and restarts the timer; StrictMode (one entry and one announcement per dispatch); type tests (`dispatchToast(<Toast />)`, `dispatchToast({ title: 'Saved' })` and `dispatchToast(<span />, { timeout: 0 })` compile; `@ts-expect-error` for `dispatchToast({ title: 1 })` and for an unknown option).
- **Stories** (`stories/Toast.stories.tsx`): `RichContent` (an Undo action), `CustomContent` (content without a Toast, with `status`), `ProgressToast` (`announcement`).
- **Docs.** README "Toasts" rewritten around rich content (the roadmap's exit criterion): dispatching a `<Toast>` with parts first, the options form second, severity (the Toast's `status`; the options for other content), what is announced and `announcement`, the Dismiss button (D11); CHANGELOG Added and "Types" (`ToastController['dispatchToast']` is overloaded).
- **Compatibility.** Additive; a test double that implements `ToastController` must accept content too (CHANGELOG "Types").
- **Size.** M. **Depends on:** P3-02.

### P3-02 — Toast parts, `Toast.Close` and the toast container (P3-toasts, first)

- **Closes:** `toast-2` (M), `toasttrigger-1` (L), `toast-3` (L).
- **API** (`Toast.root.tsx`, `Toast.parts.tsx`; the compound and flat names in `Toast.tsx`):
  ```ts
  export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
    /** As 0.7. @default 'info' */
    status?: Status;
    /**
     * Title text (the 0.5 form; renders as a `Toast.Title`). A `Toast.Title` among the children wins
     * over it (development warning).
     */
    title?: string;
    /** As 0.7. */
    statusLabel?: string;
    /**
     * Replaces the status icon (decorative, `aria-hidden`). Only `undefined` keeps the default;
     * `null`, or anything that renders nothing, shows no icon (the status-icon slot rule, as
     * `MessageBar.icon`). Fluent's `ToastTitle` `media`.
     */
    icon?: Slot<'span'>;
    /**
     * Called when the Dismiss button is activated; passing it renders the button. Inside the Toaster
     * every Toast shows the button and it dismisses the toast (your `onDismiss` runs first).
     */
    onDismiss?: () => void;
    /** As 0.7. @default 'Dismiss' */
    dismissLabel?: string;
    ref?: React.Ref<HTMLDivElement>;
  }

  /** Properties for the ToastTitle sub-component. */
  export interface ToastTitleProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Content at the end of the title row, such as a link or a button (often in `Toast.Close`). */
    action?: Slot<'span'>;
    ref?: React.Ref<HTMLDivElement>;
  }
  /** Properties for the ToastBody sub-component. */
  export interface ToastBodyProps extends React.HTMLAttributes<HTMLDivElement> {
    /** A secondary line under the body text. */
    subtitle?: React.ReactNode;
    ref?: React.Ref<HTMLDivElement>;
  }
  /** Properties for the ToastFooter sub-component. */
  export interface ToastFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    ref?: React.Ref<HTMLDivElement>;
  }
  /** Properties for the ToastClose sub-component (as `DialogCloseProps`). */
  export interface ToastCloseProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
    /** The element that dismisses the toast; a single element gets a composed `onClick`, a function the props. */
    children: React.ReactNode | ((props: ToastCloseRenderProps) => React.ReactNode);
    /** `false` renders a wrapper `<span>` that dismisses on click. @default true */
    asChild?: boolean;
    ref?: React.Ref<HTMLElement>;
  }
  ```
  Component JSDoc outlines (each part's ends with "Also exported as `ToastTitle` (import the flat name from React Server Components)", and so on): `Toast` (compound, on the `Object.assign(…)` const): "A notification: status icon, visually hidden severity text, title, body, footer and a Dismiss button. Dispatch it with `useToastController().dispatchToast(<Toast>…</Toast>)` (the Toaster announces it and shows the Dismiss button), or render it yourself (then it is its own live region). Its parts are direct children: `Toast.Title`, `Toast.Body`, `Toast.Footer`; plain children are the body (0.5)." `Toast.Title`: "The title row: the title text (which names the toast) and an optional `action` at its end." `Toast.Body`: "The body text and an optional `subtitle` (the toast is described by it)." `Toast.Footer`: "A row of actions under the body." `Toast.Close`: "Makes its single child dismiss the toast: inside the Toaster that toast, on a Toast you render yourself its `onDismiss`. Your `onClick` runs first; `preventDefault()` keeps the toast. Fluent's `ToastTrigger`."
- **Behaviour** (D9, D10, D11, D29).
  - **Layout** (as 0.7): `[icon] [content column] [Dismiss]`. The root scans its children (`flattenChildren` + `isElementOfType`, Server Component references included) for `Toast.Title`, `Toast.Body` and `Toast.Footer`: when it finds one, the children render in the content column as given; otherwise the `title` prop renders a `Toast.Title` and the children a `Toast.Body` (the 0.5 form; content that renders nothing still gets no body, 0.7). A part the scan cannot see (inside the app's own component) still renders and registers, but a part-less scan wraps it in a body: it warns once (`Toast.Title:unscanned`, `Toast.Body:unscanned`, `Toast.Footer:unscanned`), as MessageBar does (D15). A `title` prop next to a `Toast.Title` part: the part wins, one warning (`Toast:title-twice`).
  - **Parts.** `Toast.Title`: `<div class="flex items-start gap-2">` holding `<span id={titleId} class="min-w-0 flex-1 text-body-2 font-semibold text-foreground">{children}</span>` and the `action` slot (`renderSlot(action, 'span', 'shrink-0')`; interactive, not `aria-hidden`). `Toast.Body`: `<div id={bodyId} class="mt-0.5 text-body-1 text-muted-foreground">{children}</div>` plus, when given, the subtitle `<div class="mt-1 text-caption-1 text-muted-foreground">`. `Toast.Footer`: `<div class="mt-2 flex flex-wrap gap-2">`. The ids come from the per-toast context (created by the Toaster's container) or, outside a Toaster, from the Toast root's `useId`; each part registers itself with the context in a layout effect (and unregisters). Each carries its Appendix A classes.
  - **`Toast.Close`**: `useTriggerElement(children, mergeProps({ onClick: dismiss, ref }, rest), { componentName: 'Toast.Close', asChild })`, the element rules of `Dialog.Close` (`useModalClosePart`). `dismiss` is the container's inside a Toaster, else the Toast's `onDismiss`; with neither, it does nothing and warns once (`Toast.Close:no-dismiss`). Outside a `Toast` its context hook throws in development (C-CONTEXT: "Toast.Close must be used within <Toast>").
  - **`icon`**: `undefined` renders the status icon; any other value goes through `renderSlot(icon, 'span', …, { 'aria-hidden': true })`, and one that renders nothing (`null`, `false`, `''`) shows none (the status-icon rule, `slotRendersContent`).
  - **Dismiss button** (D11): rendered when `onDismiss` is passed or a Toaster container provides a dismissal; in the Toaster it calls `onDismiss` (if any) and then dismisses the toast.
  - **The container** (D10), rendered by the Toaster for every shown toast: `<div role="group" tabIndex={-1} data-wave-toast="" aria-labelledby={statusId titleId} aria-describedby={bodyId} class={cn(toasterClassNames.toast, focusRing)} {...presenceProps}>`; `aria-labelledby` only while a title is registered (the severity text id first, registered only while the severity text renders, so `statusLabel: ''` leaves it out), `aria-describedby` only while a body is registered, so no id reference dangles at any commit. The 0.7 pause handlers and `usePreserveFocus` move from the Toast to the container; `data-wave-toast` moves with them (the focus fallback walks the containers).
  - **Presence** (D29): the container mounts through `usePresence(!dismissed, { appear: true, onExited })`. `dismissToast` marks the entry `dismissed` (its timer removed, its live message gone) instead of removing it; `onExited` removes it. A dismissed entry does not count toward `limit` (the next queued toast shows at once) and is skipped by the shortcut (P3-03). Focus leaves a dismissed container in the dismissing commit (a layout effect of the container when `dismissed` becomes `true` and focus is inside it: the next toast, else the previous, else the remembered origin, 0.7's order), before the container turns `inert`.
- **Keyboard.** `Toast.Close`'s child activates as any button (Enter, Space); the rest is P3-03.
- **ARIA.** The container's group name ("Error: Upload failed") and description; a Toast outside a Toaster stays a live region without a name (D10); the title's `action` and the footer's buttons are ordinary controls in the toast's Tab order.
- **SSR.** A Toast rendered in the app (not dispatched) renders its parts on the server, with `useId` ids; hydration logs nothing.
- **RTL.** Logical layout (the Dismiss button at the end). **Forced colors.** Text in system colors; the container's focus ring shows when the shortcut focuses it. **Motion.** None; the presence core ends every phase at once without motion classes. An app can animate toasts from its own CSS on the container's stable class (`.wave-toaster__toast[data-presence='exiting']`), with a `prefers-reduced-motion` query of its own.
- **Guards** ("toasts stay reachable over modals and move out of a Drawer's way"; "focus moves to the next toast when a focused toast is dismissed"): the 0.7 tests of the allow-listed region and of the side-panel offset stay green with the container level; a new test dismisses a focused toast under `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` and asserts focus on the next toast before the exit ends, and the exiting container `inert`.
- **Files.** `Toast.tsx`, `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx` (D32).
- **Tests** (`__tests__/Toast.parts.test.tsx`, and `__tests__/Toast.test.tsx` updated, §6.4): each part's markup and classes; `testSystemProps` for `Toast.Title`, `Toast.Body`, `Toast.Footer` (`expectedTag: 'div'`, inside a Toast as `wrapper`); `testCompoundExposure(Toast, …)`; flat names (`ToastTitle === Toast.Title`, …) and `asClientReference` parts (same `renderToString` and behaviour); the `icon` rule (default, `null`, `''`); the scan (direct, Fragment, Server Component reference) and the unscanned warning (asserted); `Toast:title-twice` (asserted); `Toast.Close` in the Toaster (the toast leaves), standalone (calls `onDismiss`), a consumer `onClick` with `preventDefault()` (the toast stays), a Fragment child, a render-prop child, outside a Toast (`expectThrows`), without a dismissal (the warning); the container's role, `tabIndex`, name and description only after registration (`findDanglingIdRefs` at every step); axe for each layout (title and body; title with an action; footer; custom content) in the Toaster (open) and standalone; presence (under `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })`, a dismissed toast is `data-presence="exiting"` and `inert`, does not count toward `limit`, and unmounts after `finishAll()`; reduced motion mocked both ways); focus moves in the dismissing commit; StrictMode (one registration per part).
- **Stories** (`stories/Toast.stories.tsx`): `Parts` (Title, Body, Footer), `TitleAction` (`Toast.Close` around an Undo button), `CustomIcon`, `Standalone` (a Toast with parts rendered in the page).
- **Docs.** README "Toasts" (the parts, `Toast.Close`, `icon`, what names a toast); "React Server Components" table (`ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`); CHANGELOG Added and "DOM" (the container level, `role="group"`, `data-wave-toast` on it, the 0.5 title and body now render as the part elements, `data-presence` on the container).
- **Compatibility.** Additive API; `typeof Toast` gains static members (CHANGELOG "Types"); DOM changes listed above.
- **Size.** M. **Depends on:** P2-00.

### P3-03 — Toaster keyboard access (P3-toasts, last)

- **Closes:** `toaster-2` (M).
- **API** (`Toaster.tsx`):
  ```ts
  /** Keyboard shortcuts of a Toaster (Fluent's shape). */
  export interface ToasterShortcuts {
    /**
     * Returns `true` for the key press that moves focus to the most recently dispatched toast, for
     * example `(event) => event.ctrlKey && event.key === 'm'`.
     */
    focus?: (event: KeyboardEvent) => boolean;
  }
  // ToasterProps gains:
  /** Keyboard shortcuts; Escape and Delete need none (see the component docs). */
  shortcuts?: ToasterShortcuts;
  ```
- **Behaviour** (D14).
  - **Shortcut.** A `keydown` listener on the document (an effect of the Toaster, removed on unmount), which ignores events already `defaultPrevented` and key presses while composing. When `shortcuts.focus(event)` returns `true` and a toast is shown, it prevents the default, remembers the focused element as the focus origin (unless focus is already in the region) and focuses the container of the shown, not dismissed toast with the highest dispatch number (`preventScroll`: false; the toast region is fixed).
  - **Escape** in the region (the viewport's `onKeyDown`), unless `defaultPrevented` or composing: prevents the default, moves focus to the remembered origin (when it is still connected; without one, focus ends on the page body, as when 0.7 removes the last focused toast), then dismisses every toast. Because the event is prevented, the dismiss-layer stack does not route it to a Dialog or Drawer below (the region counts as inside every layer, `ALLOW_OUTSIDE_SELECTOR`).
  - **Delete and Backspace** on a container, or on a descendant that is not an editable field (`isEditableTarget`), unless `defaultPrevented`: prevents the default and dismisses that toast; focus moves as for any dismissal (P3-02). Backspace joins Delete because it is the delete key of Mac keyboards (TagPicker removes a tag with either).
  - Focus on a container pauses its timer (0.7's focus pause, now on the container).
- **Keyboard table** (README): Toaster row: the app's shortcut focuses the newest toast; Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus; Delete or Backspace dismisses the focused toast.
- **ARIA.** Nothing new. **SSR/RTL/forced colors/motion.** Nothing new.
- **Guards** (the dismiss-layer stack routes Escape by focus; timers pause on focus): Escape in a toast while a modal (the `useModalLayer` harness of `Dialog.test.tsx`) is open leaves the modal open and dismisses the toasts; the shortcut's focus pauses the toast's timer. The case with a real Dialog is INTEGRATION's (§4.4 #2).
- **Files.** `Toaster.tsx`.
- **Tests** (`__tests__/Toaster.keyboard.test.tsx`): the shortcut focuses the newest toast's container, remembers the origin and prevents the default; with no toast, or a predicate returning `false`, nothing happens; a `defaultPrevented` key press is ignored; Escape dismisses every toast and returns focus to the origin (entered by Tab, by a click, by the shortcut); a prevented Escape (an inner widget) does nothing; Delete and Backspace dismiss the focused toast and move focus to the next; Delete in an input inside a toast edits the input; StrictMode (one listener: one focus move per shortcut); unmount removes the listener.
- **Stories** (`stories/Toast.stories.tsx`): `KeyboardShortcut` (Ctrl+M, named in the story text).
- **Docs.** README keyboard table and "Toasts"; CHANGELOG Added, and "Changed" (behaviour): Escape inside the toast region no longer closes a Dialog or Drawer below; it dismisses the toasts.
- **Compatibility.** Additive, plus the Escape change above.
- **Size.** S. **Depends on:** P1-18 (`dismissAllToasts`).

### P3-04 — `MessageBar.Title`, `MessageBar.Actions` and reflow (P3-messagebar)

- **Closes:** `messagebar-2` (M), `messagebar-1` (L), `messagebar-3` (L).
- **API** (`MessageBar.tsx` compound; parts in `MessageBar.parts.tsx`):
  ```ts
  // MessageBarProps gains:
  /**
   * How the text and the actions share the bar. `'singleline'`: one row (the text does not wrap).
   * `'multiline'`: the text wraps and the actions get a row of their own under it. `'auto'`: one row
   * while it fits, measured after mount (the server renders one row); a bar without
   * `MessageBar.Actions` is `'multiline'`, the 0.7 look.
   * @default 'auto'
   */
  layout?: 'auto' | 'singleline' | 'multiline';

  /** Properties for the MessageBarTitle sub-component. */
  export interface MessageBarTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
    ref?: React.Ref<HTMLSpanElement>;
  }
  /** Properties for the MessageBarActions sub-component. */
  export interface MessageBarActionsProps extends React.HTMLAttributes<HTMLDivElement> {
    ref?: React.Ref<HTMLDivElement>;
  }
  ```
  JSDoc outlines: `MessageBar` (on the compound const) gains: "Parts, as direct children: `MessageBar.Title` (a semibold lead-in, read first after the severity) and `MessageBar.Actions` (buttons after the text on one row, or below it with `layout="multiline"`). The built-in Dismiss button stays the bar's own. With its default roles the bar is a live region and the title is read as the start of its content; give the bar `role="region"` (a notice that stays on the page) and the title names it." `MessageBar.Title`: "The bar's title, read right after the severity text. Names the bar when the bar has a non-live `role` (`region`, `group`). Must be a direct child of MessageBar." `MessageBar.Actions`: "The bar's actions (Retry, Learn more): after the text on one row, on their own row under it in the multiline layout. Must be a direct child of MessageBar."
- **Behaviour** (D15, D16, D17).
  - **Partition.** The scan of D15 during render; the parts render with a context that marks them as placed (`MessageBarPartContext`, default `null`); a part that renders without it warns once from an effect (`MessageBar.Title:unscanned`: "MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child."), and a part outside any MessageBar throws in development (C-CONTEXT).
  - **Text column.** `StatusText` (with `id` when the bar is labelled, §1.3), then the title (`<span id={titleId} class="font-semibold">` and a space), then the body. Screen readers read "Warning: Update available A new version is ready to install." and then the actions' labels (they are inside the live region), once.
  - **Labelling** (D16): `aria-labelledby={joinIds(statusTextId, titleId)}` only when the bar's resolved role is not `alert` or `status` (a consumer `role`) and a title is placed; the severity text id only while that text renders (an empty `statusLabel` renders none, so it is left out); a consumer `aria-label` or `aria-labelledby` wins (then the bar adds none).
  - **Layouts** (D17): the root renders `data-layout` (`singleline` | `multiline`); the DOM order is icon, text column, actions, Dismiss in both. `singleline`: a `flex items-center` row; the text column `min-w-0 flex-1 truncate` (no wrapping); the actions `flex shrink-0 gap-2`; the Dismiss button last. `multiline` with actions: a grid, `[icon] [text] [Dismiss]` on the first row and the actions on the second, in the text column's track (`row-start-2 col-start-2`). `multiline` without actions: 0.7's row unchanged (its classes, the Dismiss button's `ms-auto`, no added element). Classes only; no inline style.
  - **Reflow** (`MessageBar.reflow.ts`, internal): `useMessageBarReflow(element, enabled)` returns `'singleline' | 'multiline'` through `useSyncExternalStore`: the store holds `{ reflowing, singleLineWidth }` per bar; its subscription observes the root with a ResizeObserver (`box: 'border-box'`) while `enabled` (`layout === 'auto'` with an Actions part); the observer callback switches to multiline when `clientWidth < scrollWidth` (remembering `scrollWidth`) and back when `clientWidth >= singleLineWidth`; `getServerSnapshot` and the first client snapshot are `singleline`. The root element is held in state through a callback ref (C-POPUPS rule for elements read in effects).
- **Keyboard.** Tab follows the DOM in both layouts: links in the text, the actions, the Dismiss button. Nothing else.
- **ARIA.** D16; the Actions container has no role (a group of ordinary buttons; the bar is already the grouping).
- **SSR.** `'auto'` with Actions renders `singleline` on the server; hydration logs nothing; `'auto'` without Actions renders `multiline` everywhere.
- **RTL.** Logical classes only; the Dismiss button and actions sit at the end. **Forced colors.** Unchanged (text and buttons in system colors). **Motion.** None (the reflow does not animate).
- **Guards** ("severity is spoken by MessageBar"): the severity text stays the first text of the bar, read once (a content-order assertion for titled bars); for a bar with `role="region"` the accessible name is "Warning: Update available" (the severity stays in the name of a titled bar, the roadmap's wording).
- **Files.** `MessageBar.tsx`, `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, their tests, `stories/MessageBar.stories.tsx`.
- **Tests** (`__tests__/MessageBar.parts.test.tsx`, `__tests__/MessageBar.reflow.test.tsx`, `MessageBar.test.tsx` updated for `data-layout`): the partition (direct children, Fragments, `asClientReference` parts; the body keeps the rest in order); the unscanned and multiple-title warnings (asserted); parts outside a bar (`expectThrows`); `data-layout` per layout; the one DOM order of both layouts, and focus on an action kept through a reflow; a bar without actions renders 0.7's markup plus `data-layout` (the 0.7 `icon={null}` and RTL `ms-auto` assertions stay); `'auto'` without Actions (multiline, no ResizeObserver created: `installResizeObserverMock` records none); `'auto'` with Actions (singleline first; an overflowing `mockRect`/`scrollWidth` plus an observer callback switches to multiline; growing back switches back); explicit layouts never observe; SSR (`renderToString` singleline) and hydration without warnings; labelling (default roles: no `aria-labelledby`, content order "Warning: Update available …"; `role="region"`: name "Warning: Update available"; a consumer `aria-label` wins); axe for each status with a title and actions, both layouts; RTL render; `testSystemProps` for both parts; flat names and `testCompoundExposure`; StrictMode (one observer); type tests (`layout` union; `@ts-expect-error` `layout="wrap"`).
- **Stories** (`stories/MessageBar.stories.tsx`): `WithTitle`, `WithActions`, `Multiline`, `Reflow` (in a resizable container), `RegionNotice` (`role="region"`).
- **Docs.** README: a MessageBar usage note (title, actions, layouts, the labelling rule); "React Server Components" table (`MessageBarTitle`, `MessageBarActions`); CHANGELOG Added and "DOM" (`data-layout` on every bar).
- **Compatibility.** Additive; `data-layout` is new DOM; `typeof MessageBar` gains static members.
- **Size.** M. **Depends on:** none (the `StatusText` `id` comes from F3).

### P3-05 — ColorArea, ColorSlider, AlphaSlider and a composable ColorPicker (P3-color)

- **Closes:** `colorarea-1` (H), `colorslider-1` (H), `colorpicker-1` (M), `alphaslider-1` (L), `colorpicker-2` (L), `colorpicker-3` (L).
- **API.**
  ```ts
  // src/lib/types.ts
  /** A color in HSV (Fluent's `HsvColor`): `h` 0–360, `s`, `v` and `a` 0–1; no `a` means opaque. */
  export interface HsvColor { h: number; s: number; v: number; a?: number; }

  // src/lib/color.ts (public, server-safe)
  /** `#rrggbb`, or `#rrggbbaa` below full opacity (lowercase; ColorPicker's value format). */
  export function hsvToHex(color: HsvColor): string;
  /** The HSV color of a hex string (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), or `null`. */
  export function hexToHsv(hex: string): HsvColor | null;

  // src/components/input/ColorArea.tsx
  export interface ColorAreaLabels {
    /** Name of the horizontal slider. @default 'Saturation' */
    saturation?: string;
    /** Name of the vertical slider. @default 'Brightness' */
    brightness?: string;
    /** Role description of both sliders. @default '2D slider' */
    roleDescription?: string;
    /** Names the color at the end of the value text; return `''` to leave it out. @default an English namer ("dark blue") */
    colorName?: (color: HsvColor) => string;
  }
  export interface ColorAreaProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
    value?: HsvColor;
    /** @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`) */
    defaultValue?: HsvColor;
    /** Called with the new color on every step (key or pointer move) that changes it. */
    onValueChange?: (value: HsvColor) => void;
    /** `'square'` removes the corner radius (the thumb stays round). @default 'rounded' */
    shape?: 'rounded' | 'square';
    labels?: ColorAreaLabels;
    /** Form field name: the color is submitted as hex (`hsvToHex`). */
    name?: string;
    form?: string;
    /** Marks the hidden input required (a color is always set, so it never blocks). */
    required?: boolean;
    /** Unavailable: both inputs natively disabled, pointer presses ignored, dimmed. @default false */
    disabled?: boolean;
    ref?: React.Ref<HTMLDivElement>;
  }

  // src/components/input/ColorSlider.tsx
  export interface ColorSliderLabels {
    /** @default 'Hue' */ hue?: string;
    /** @default 'Saturation' */ saturation?: string;
    /** @default 'Brightness' */ brightness?: string;
    /** As `ColorAreaLabels.colorName` (the hue slider's value text). */
    colorName?: (color: HsvColor) => string;
  }
  export interface ColorSliderProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
    /** The channel the slider edits. @default 'hue' */
    channel?: 'hue' | 'saturation' | 'value';
    /** @default 'horizontal' */
    orientation?: Orientation;
    value?: HsvColor;
    defaultValue?: HsvColor;
    onValueChange?: (value: HsvColor) => void;
    shape?: 'rounded' | 'square';
    labels?: ColorSliderLabels;
    name?: string;
    form?: string;
    required?: boolean;
    /** Unavailable: the input natively disabled, dimmed. @default false */
    disabled?: boolean;
    /** Ref to the `<input type="range">` (C-ROUTING). */
    controlRef?: React.Ref<HTMLInputElement>;
    ref?: React.Ref<HTMLDivElement>;
  }

  // src/components/input/AlphaSlider.tsx
  export interface AlphaSliderLabels {
    /** @default 'Opacity' */ opacity?: string;
    /** @default 'Transparency' */ transparency?: string;
  }
  export interface AlphaSliderProps extends Omit<ColorSliderProps, 'channel' | 'labels'> {
    /** Show transparency (100% = fully transparent) instead of opacity; `value.a` is still opacity. @default false */
    transparency?: boolean;
    labels?: AlphaSliderLabels;
  }

  // ColorPicker.tsx (0.7 props unchanged) gains:
  /** `'square'` removes the corner radius of the area, the rails and the preview. Inherited by the parts. @default 'rounded' */
  shape?: 'rounded' | 'square';
  /** The picker's parts, to compose your own layout; without children the picker renders its default layout. */
  children?: React.ReactNode;
  // ColorPickerLabels gains: area ('Saturation and brightness', the area's group name), saturation,
  // brightness, roleDescription, hue, transparency, colorName (as above).

  // ColorPicker.parts.tsx: ColorPickerAreaProps, ColorPickerSliderProps, ColorPickerAlphaSliderProps
  // (the standalone props without value, defaultValue, onValueChange, shape, labels, name, form and
  // required, which the picker owns), ColorPickerHexFieldProps, ColorPickerSwatchesProps,
  // ColorPickerPreviewProps (HTML attributes of their root and a ref).
  ```
- **Behaviour** (D18–D22).
  - **Conversions** (`src/lib/color.ts`, also used by `colorUtils.ts`): `hsvToRgb`, `rgbToHsv` (internal) and the public `hsvToHex`/`hexToHsv`; `hexToHsv` of an achromatic color returns `h: 0` and of black `s: 0`, and the ColorPicker keeps its working hue and saturation instead (D21). Rounding: a round trip `hexToHsv(hsvToHex(c))` of any hex string returns the same hex.
  - **`ColorArea`** (D19): the root `<div role="group" class="relative touch-none select-none …">` with the color field (the hue as an inline custom property `--wave-color-area-hue`; the gradients `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, var(--wave-color-area-hue))` as arbitrary-value classes marked `// wave-allow-color: color-space gradient`, with `wave-rtl:` counterparts `to left`), the thumb (`size-6 rounded-full`, positioned with `--wave-color-area-x` and `--wave-color-area-y` through logical `start-*`/`bottom-*` utilities and a `wave-rtl:` translate counterpart, filled with the color through `--wave-color-area-color`, ring `border-2 border-background` plus a `foreground` outer ring; it shows the focus ring while either input has focus: `has-[:focus-visible]` on the root), and two visually hidden `<input type="range" min={0} max={100} step={1}>` for saturation and brightness (`aria-roledescription`, `aria-valuetext`, `aria-label` from `labels`). The root's `onKeyDown` handles the keys of D19 (prevented, so the native range handling never runs) and focuses the input of the axis that changed; each input's `onChange` handles the events assistive technology sends (a VoiceOver swipe). `onPointerDown` (primary button, any pointer type) calls `setPointerCapture`, sets the color from the point (x mirrored in RTL), focuses the saturation input (`preventScroll`); `onPointerMove` while captured updates it; `onLostPointerCapture` ends the drag. Field: `useFieldControl(…, { labelable: false })` names the group (C-ROUTING: the group keeps `aria-label`/`aria-labelledby`). Forms: `<HiddenInput type="text" value={hsvToHex(value)} …>` with `name` or `required` (C-FORMS), `useFormReset` restores `defaultValue`.
  - **`ColorSlider`** (D20): the root `<div class="relative …">` with the rail (the gradient as inline custom properties: hue `red → yellow → lime → cyan → blue → magenta → red`; saturation from gray to the full color at the value's hue and brightness; brightness from black to the color), the thumb (`size-6`, positioned by `--wave-color-slider-position` along the axis, logical in horizontal and mirrored by `wave-rtl:`), and one native `<input type="range">` covering the rail (`absolute inset-0 opacity-0`), so pointer dragging is native; `aria-orientation` for vertical; `aria-valuetext` (D22); the keys of D20 handled in the input's `onKeyDown` (prevented) with `getArrowIntent` for the horizontal axis. Vertical rails are native vertical range inputs where the engine has them (`writing-mode: vertical-lr; direction: rtl`, bottom = minimum) and a rotated input otherwise; the real-browser checklist covers both (§6.3). C-ROUTING: `id`, `aria-label(ledby)`, `aria-describedby`, `aria-invalid`, `aria-required`, `autoFocus`, `tabIndex`, focus and key handlers go to the input; `controlRef`. Field: `useFieldControl` on the input. Forms as `ColorArea`.
  - **`AlphaSlider`** (D20): as `ColorSlider` with the channel `a` (0–100 %), the rail `transparent → the opaque color` over the checkerboard (a CSS pattern of two neutral tokens, `background` and `muted`, or the pair whose contrast `tokens.test.ts` can assert at 1.5:1 or more in all three themes; no image), and `transparency` flipping the rail and the value text.
  - **ColorPicker** (D21): the context provides `{ color: string, hsv: HsvColor, setHsv(next, event), shape, labels, invalid, errorMessageId, … }` (C-MEMO); `setHsv` updates the working color and calls `setColor(hsvToHex(next))` through `useControllable` (so `onValueChange` fires only when the hex changes). The working color is re-derived during render from a previous-value state when the hex `value` changes from outside and differs from `hsvToHex(hsv)`, keeping the hue (when the new color is achromatic) and the saturation (when it is black). Without children the picker renders `Area`, hue `Slider`, the opacity row (with `showOpacity`: 0.7's caption, an `AlphaSlider` and 0.7's percentage readout), then the 0.7 preview and hex row and the hex error, then `Swatches`; with children it renders them. The parts render the standalone components inside `<FieldContext.Provider value={null}>` (as 0.7 does for the presets) and without `name` or `required`, so the picker's group keeps the Field wiring and its one hidden input; while the value is not a hex color they are `disabled` (the 0.7 opacity rule, now for the area and every slider). `ColorPicker.HexField` holds the 0.7 hex draft logic and Field routing unchanged (moved from the root); `ColorPicker.Swatches` the 0.7 presets logic (`presets` still on the root; picking keeps the opacity); `ColorPicker.Preview` the 0.7 preview. The hidden input's `onInvalid` focuses the hex input when there is one, else the first focusable element of the picker. Parts outside a ColorPicker throw in development (C-CONTEXT).
  - **Color namer** (D22; internal `colorName.ts`): black when `v < 0.15`; with `s < 0.1`: white when `v > 0.93`, "dark gray" below 0.4, "light gray" above 0.75, else "gray"; otherwise a hue family (`h` in degrees: red below 15 and from 345, orange to 45, yellow to 70, green to 165, cyan to 195, blue to 255, purple to 290, magenta to 320, pink to 345), prefixed by "dark" when `v < 0.5` or "light" when `v > 0.85` and `s < 0.5`, then by "grayish" when `s < 0.35` (not with "light") or "vivid" when `s > 0.85` and `v > 0.85`: "dark grayish blue", "light pink", "vivid red", "blue". Pinned examples: `#0f6cbd` → "blue", `#d13438` → "red", `#242424` → "black", `#ffffff` → "white", `#808080` → "gray".
- **Keyboard** (README table): `ColorArea`: Left/Right saturation (mirrored in RTL), Up/Down brightness, Shift + arrow by 10, Page Up/Page Down brightness by 10, Home/End saturation minimum/maximum; `ColorSlider`/`AlphaSlider`: the arrows of their axis by 1, Shift by 10, Page Up/Page Down by 10, Home/End.
- **ARIA.** D19, D20, D22; the area is a named group of two sliders; each slider named, role-described (area only) and value-texted.
- **SSR.** Everything renders on the server (input values, the inline custom properties); hydration logs nothing; no DOM measurement before a pointer press.
- **RTL.** The area's x axis and horizontal rails mirror (the gradients by `wave-rtl:` classes, the keys by `getArrowIntent`, the pointer math by `getDirection`); RTL tests.
- **Forced colors.** The color field, the rails and the preview keep their colors (`forced-color-adjust: none` on those elements only); the thumbs draw their ring in `CanvasText`/`Canvas`; the focus ring stays visible.
- **Motion.** None (thumbs move without transitions).
- **Guards** ("hidden inputs and form reset on every value control"; "WCAG contrast of the thumb and checkerboard pairs asserted"): the 0.7 ColorPicker form and reset tests stay green; the three standalone parts submit hex and reset; `tokens.test.ts` asserts the thumb ring pair (`background`/`foreground`, 3:1 or more) and the checkerboard pair in all three themes.
- **Files.** `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx`, `ColorPicker.tsx`, `ColorPicker.parts.tsx`, `colorName.ts`, `colorUtils.ts`, `src/lib/color.ts`, `src/lib/types.ts` (`HsvColor`), their tests, `src/styles/__tests__/tokens.test.ts` (the pairs), the stories (§3).
- **Tests** (`src/lib/__tests__/color.test.ts`, `__tests__/colorName.test.ts`, `__tests__/ColorArea.test.tsx`, `__tests__/ColorSlider.test.tsx`, `__tests__/AlphaSlider.test.tsx`, `__tests__/ColorPicker.parts.test.tsx`, `ColorPicker.test.tsx` updated): conversions (round trips over a table, achromatic and black inputs); the namer table; `ColorArea`: every key (Shift, Page, Home/End), RTL mirroring, focus following the axis, the pointer (jump, capture, drag, touch and pen pointer types, RTL mirrored; `mockRect` for the field), `onValueChange` only on change and once per change in StrictMode, controlled and uncontrolled, the value text and `labels` (a `colorName` override, `''`), Field naming, forms (hex submitted, reset), `disabled` (both inputs disabled, a pointer press ignored, no `onValueChange`), `testSystemProps`, axe, SSR and hydration; `ColorSlider`: each channel's range, value text and gradient custom properties, vertical (`aria-orientation`, Up/Down), RTL, routing (`controlRef`, `aria-label` on the input), forms; `AlphaSlider`: opacity and `transparency`; ColorPicker: the default layout (area, hue slider, alpha slider with `showOpacity`, hex row, presets), the working color (dragging saturation to zero and back keeps the hue; a gray `value` from outside keeps the hue), a value that is not hex (the area and every slider disabled, as 0.7's opacity slider), the parts' Field isolation (no second element with the Field's control id, no second required input), composition (only the children render; each part bound; a part outside a picker `expectThrows`), `shape` inheritance, the 0.7 hex, preset, opacity, Field and form tests (updated where the layout changed, §6.4); flat names, `testCompoundExposure(ColorPicker, …)`, `asClientReference` parts; type tests (`HsvColor`, the unions, `@ts-expect-error` `channel="alpha"`).
- **Stories**: `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` (titles `Components/Input/<Name>`: default, controlled, square, vertical, transparency), `stories/ColorPicker.stories.tsx` (+ `Composed`, `CustomLayout`, `RgbAndHslFields` (the `colorpicker-2` recipe: SpinButtons around a controlled hex value through `hexToHsv`/`hsvToHex`), `InPopover` (a picker in a Popover with Apply/Cancel), `Square`).
- **Docs.** README: a "Color" usage note (the parts, hex versus `HsvColor`, the helpers, the keys, `labels.colorName`); "Built-in text" (the new strings); keyboard table; "React Server Components" table (`ColorPickerArea`, `ColorPickerSlider`, `ColorPickerAlphaSlider`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`); CHANGELOG Added, "Visual" (the default layout gains the area and the hue slider; the opacity row becomes an alpha slider with a checkerboard) and "Types" (`HsvColor` and the new prop types).
- **Compatibility.** Additive API. The default ColorPicker layout changes visibly; its opacity slider keeps its accessible name ("Opacity", `labels.opacity`) and role; `typeof ColorPicker` gains static members.
- **Size.** L. **Depends on:** none.

### P3-06 — Tree multi-select with checkboxes and a mixed state (P3-tree, first)

- **Closes:** `tree-1` (H).
- **API** (`Tree.root.tsx`; the compound and flat names in `Tree.tsx`):
  ```ts
  // TreeProps gains:
  /**
   * How items are selected. `'none'`: activation only (0.7; `selected` highlights one item).
   * `'single'`: a radio indicator on every item for `selected`/`onItemSelect`. `'multiple'`: a
   * checkbox on every item, bound to `checkedItems`; checking an item checks its descendants, and a
   * parent shows checked, mixed or unchecked from them.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /** Controlled checked items (`selectionMode="multiple"`); see the cascade rule in the component docs. */
  checkedItems?: readonly string[];
  /** Initially checked items (uncontrolled). @default [] */
  defaultCheckedItems?: readonly string[];
  /** Called with every checked item (in tree order) when a check changes; `details` names the item. */
  onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void;

  /** The second argument of `onCheckedItemsChange`. */
  export interface TreeCheckedItemsChangeDetails {
    /** The item that was toggled. */
    value: string;
    /** Its new state (a toggle never leaves it mixed). */
    checked: boolean;
    /** The DOM event of the toggle: a keyboard event for Space, a mouse event for a click. */
    event: Event;
  }
  ```
- **Behaviour** (D23, D24, D25).
  - **Model** (`Tree.selection.ts`, pure): `collectItems(children)` scans the root's children recursively into `{ value, children }` nodes (`flattenChildren` + `isElementOfType(child, TreeItem)`, Server Component references included; a nested `Tree` and a `leaf` item's children are not descended); `computeCheckStates(nodes, listed)` returns a `Map<string, 'checked' | 'mixed' | 'unchecked'>` by the rule of D24; `toggleCheck(nodes, listed, value)` returns the new array in tree order plus the unmatched listed values. The root memoizes the scan per `children` and the states per `children` and list (C-MEMO) and provides a state lookup and `toggle(value, event)` through the Tree context.
  - **Rendering.** The root renders `data-selection-mode` always, and `aria-multiselectable="true"` in `'multiple'`. Every item in `'multiple'` renders `aria-checked` (`true`/`false`/`mixed`, after `{...rest}` so a consumer cannot contradict it), `data-checked` or `data-mixed`, and the indicator: `<span aria-hidden class="…">` after the chevron slot, a 16 px box in Checkbox's tokens (checked and mixed fill `primary`, the glyph `primary-foreground`, unchecked `stroke-accessible` border) and Checkbox's forced-colors recipe, inside a 24×24 hit area. In `'single'` the indicator is a radio circle (the selected item's filled), and `aria-selected` stays as 0.7. In `'none'` nothing changes.
  - **Keys and pointer.** In `'multiple'`, Space toggles the focused item (a Space that continues a typeahead search stays typeahead, 0.7's capture rule), Enter activates (0.7); a click on the indicator toggles and does not activate; a click elsewhere on the row activates (0.7). In `'single'`, activation selects as 0.7 (`onItemSelect`); the indicator click activates too.
  - **`selected` in `'multiple'`** is ignored for ARIA and the look, with one development warning from an effect (`Tree:selected-with-multiple`: "Tree: `selected` has no effect with selectionMode=\"multiple\"; use `checkedItems`, and `current` for the item the user is on.").
- **Keyboard** (README Tree row): Space toggles a checkbox tree's focused item; the rest as 0.7 (Enter activates, `*` expands siblings, typeahead).
- **ARIA.** `aria-multiselectable` on the tree; `aria-checked` (with `mixed`) on items; never `aria-selected` and `aria-checked` together (APG).
- **SSR.** The states render in the server HTML (`defaultCheckedItems`, `checkedItems`); hydration logs nothing.
- **RTL.** The indicator sits after the chevron at the start side by DOM order. **Forced colors.** Checkbox's recipe (checked and mixed visible without color). **Motion.** None.
- **Guards** ("Tree `*` key and `current` unchanged"): the 0.7 tests stay green; a checkbox tree test presses `*` and renders `current`.
- **Files.** `Tree.tsx`, `Tree.root.tsx`, `Tree.item.tsx`, `Tree.context.ts`, `Tree.selection.ts` (D32), their tests, `stories/Tree.stories.tsx`.
- **Tests** (`__tests__/Tree.selection.test.ts`, `__tests__/Tree.multiselect.test.tsx`, `Tree.test.tsx` updated for `data-selection-mode`): the model (listed leaves, listed parents checking descendants, listed ancestors, mixed propagating through three levels, the toggle down and up, the emitted order, unmatched values kept, `leaf` items, a nested Tree excluded, collapsed items counted); the component: `aria-multiselectable`, `aria-checked` with `mixed`, `data-checked`/`data-mixed`, Space toggles with `details` (`{ value, checked, event }`), Enter activates without toggling, the indicator click toggles, the row click activates, controlled (a parent that ignores the callback keeps the state) and uncontrolled, once per change in StrictMode, the warning for `selected` (asserted), single mode (radio indicators, `aria-selected`), none mode unchanged (only `data-selection-mode="none"` is new), typeahead with Space, `*` and `current`, SSR and hydration, RTL render, axe for each mode (with a mixed parent), forced-colors classes; type tests (`selectionMode` union, `@ts-expect-error` `'multiselect'`, the `details` type).
- **Stories**: `MultiSelect` (a file tree), `ControlledChecks`, `SingleSelect`, `LazyChildren` (a checked parent whose children load later).
- **Docs.** README: a "Trees" usage note (the modes, the cascade rule and the checked list, keys, `details`); keyboard table; CHANGELOG Added, "DOM" (`data-selection-mode` on every Tree), and the notice that `details` of `onCheckedItemsChange` becomes required in 1.0.
- **Compatibility.** Additive; `data-selection-mode` is new DOM.
- **Size.** M. **Depends on:** none.

### P3-07 — Tree row actions, aside and treegrid navigation (P3-tree, second)

- **Closes:** `tree-2` (M), `tree-7` (L), `tree-8` (L).
- **API** (`Tree.item.tsx`, `Tree.root.tsx`, `Tree.personaLayout.tsx`):
  ```ts
  // TreeItemProps gains:
  /**
   * Buttons at the end of the row (a toolbar named by the item's label). Shown while the row is
   * hovered or the item or its actions have focus, and always in forced colors and without hover
   * (touch). Tab reaches them from the focused item (`navigationMode="tree"`), or the arrow keys do
   * (`"treegrid"`).
   */
  actions?: React.ReactNode;
  /** Non-interactive content at the end of the row, such as a count or a badge; hidden while the actions show. */
  aside?: React.ReactNode;
  /** Icon after the label (decorative, `aria-hidden`). */
  iconAfter?: Slot<'span'>;
  /**
   * Replaces the expand chevron (decorative). `null`/`undefined` keep the chevron; `false`, or
   * anything that renders nothing, hides it (`aria-expanded` still reports the state). Not rotated.
   */
  expandIcon?: Slot<'span'>;

  // TreeProps gains:
  /**
   * `'tree'`: Tab from a focused item enters its actions. `'treegrid'`: the "next" arrow (ArrowRight,
   * ArrowLeft in RTL) moves into an item's actions and "previous" returns; the roles stay `tree` and
   * `treeitem`. @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';

  /** Properties for the TreePersonaLayout sub-component. */
  export interface TreePersonaLayoutProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** The person's picture, usually an Avatar (size 32 fits a row). */
    media?: React.ReactNode;
    /** A second line under the name. */
    description?: React.ReactNode;
    ref?: React.Ref<HTMLSpanElement>;
  }
  ```
  JSDoc outline of `Tree.PersonaLayout`: "Lays out an item's label as a person: `media`, the name (children) and a `description` under it. Use it as a Tree.Item's label content; the item is named by the whole label. Also exported as `TreePersonaLayout`."
- **Behaviour** (D26, D27, D28).
  - **Row layout:** `[chevron | expandIcon | spacer] [indicator] [icon] [label, flex-1] [iconAfter] [aside | actions]`; every piece carries its Appendix A class.
  - **Actions:** `<span role="toolbar" aria-labelledby={labelId} aria-orientation="horizontal">` with the visibility of D26 as classes on the row (`group/row`): hidden (`invisible`) by default, visible on `group-hover/row:`, when the item has focus (`group-focus-visible/…` through the treeitem's own focus: `[&:focus>[data-tree-row]_[data-tree-actions]]:visible`), when focus is inside the actions (`group-focus-within/…` on the row), under `forced-colors:` and `[@media(hover:none)]:`; the aside takes the complementary classes (hidden whenever the actions are visible). The toolbar's buttons rove with `useRovingTabIndex({ orientation: 'horizontal', loop: navigationMode === 'tree' })`; their tab stop is `0` only while the item is the tree's active item (focused, or focus inside its actions) in `'tree'` mode, and `-1` otherwise and always in `'treegrid'` mode, so the tree keeps one tab stop plus the focused row's actions. The tree's roving hook skips the toolbar's buttons (a nested composite, 0.7 rule).
  - **Keys** (D27): in `'tree'` mode, Tab from the focused item reaches its toolbar (the browser's order, the toolbar being the next tabbable), arrows move inside it, Shift+Tab returns to the item, Tab leaves the tree. In `'treegrid'` mode, the item's key handler takes "next" (`getArrowIntent`): a collapsed parent expands (0.7), otherwise, when the item has actions, focus moves to its first action; the toolbar's handler takes "previous" on the first action (focus returns to the item), "next"/"previous" between actions (no wrapping), ArrowUp/ArrowDown (focus the previous or next visible item through the tree's `focusValue`), Home/End (the first or last action). Without actions, `'treegrid'` behaves as `'tree'`.
  - **`expandIcon`** (the optional-indicator rule, C-SLOTS): the default chevron keeps 0.7's rotation and mirroring; a custom icon is rendered as given (not rotated), `aria-hidden`.
  - **`Tree.PersonaLayout`:** `<span class="flex items-center gap-2">` with the media (`shrink-0`), and a column with the name and the description (`text-caption-1 text-muted-foreground`); typeahead matches the label text, which starts with the name.
- **Keyboard** (README Tree row): the treegrid keys above; in `'tree'` mode, Tab into the focused item's actions.
- **ARIA.** The toolbar named by the item's label; roles unchanged (D27); the actions' buttons named by their own labels (an icon-only button needs an `aria-label`, as everywhere).
- **SSR.** CSS-only visibility; the server HTML renders the actions (hidden by class). **RTL.** "next"/"previous" through `getArrowIntent`; an RTL test. **Forced colors.** Actions always visible; focus rings visible. **Motion.** None.
- **Guards** ("Tree `*` key and `current`"): `*` still expands the siblings of an item with actions; the 0.7 tests stay green.
- **Files.** `Tree.item.tsx`, `Tree.root.tsx`, `Tree.context.ts`, `Tree.personaLayout.tsx`, `Tree.tsx` (the new member), their tests, `stories/Tree.stories.tsx`.
- **Tests** (`__tests__/Tree.actions.test.tsx`, `__tests__/Tree.personaLayout.test.tsx`): the row order and classes; the toolbar's role, name and visibility classes (hover, focus, focus within, forced colors, no hover); `'tree'` mode (Tab from the focused item to its first action, the other rows' actions at `tabIndex=-1`, arrows inside the toolbar with wrapping, Shift+Tab back); `'treegrid'` mode (next expands a collapsed parent, moves into the actions of an expanded parent or a leaf, previous returns, up and down from an action, no wrapping, Home/End, Tab leaves the tree); RTL (ArrowLeft is next); the aside's complementary classes; `iconAfter`; `expandIcon` (`null`, `undefined`, `false`, `''`; `aria-expanded` kept); `Tree.PersonaLayout` (parts, name includes the description, typeahead by the name); a MenuButton in the actions opens its menu and Escape returns focus to it (with the 0.7 Menu); axe with actions and persona rows; `testSystemProps` for `Tree.PersonaLayout`; flat name and `asClientReference`; StrictMode.
- **Stories**: `RowActions`, `TreegridNavigation`, `AsideContent`, `CustomExpandIcon`, `PersonaRows`.
- **Docs.** README "Trees" (actions, aside, `navigationMode`, `Tree.PersonaLayout`); keyboard table; "React Server Components" table (`TreePersonaLayout`); CHANGELOG Added.
- **Compatibility.** Additive; `typeof Tree` gains `PersonaLayout`.
- **Size.** M. **Depends on:** P3-06 (the module split and the row layout).

---

## 3. Packages and file ownership

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D). Paths without a folder are in `src/components/feedback/` (Toast, MessageBar), `src/components/input/` (color) and `src/components/layout/` (Tree); `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F3-foundation` (wave A) | every module under `src/components/` that renders a registered component or part (classes only, §1.2), `MessageBar.status.tsx` (`StatusText` `id`), `src/index.ts` (the registry export only), `src/test-utils.ts`, `src/__tests__/test-utils.test.tsx`, `src/__tests__/conventions.test.ts`, `src/__tests__/public-types.test.ts` (the registry lines only), `scripts/verify-dist.mjs` (§1.4.4), `scripts/__tests__/verify-dist.test.mjs`, `__tests__/MessageBar.test.tsx` (the `StatusText` case), the existing tests of §6.4 (their class assertions only) | `src/lib/classNames.ts`, `src/__tests__/classNames.test.ts` | P3-00 |
| `P3-toasts` (wave B) | `Toast.tsx`, `__tests__/Toast.test.tsx`, `stories/Toast.stories.tsx` | `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx`, `__tests__/Toast.parts.test.tsx`, `__tests__/Toaster.content.test.tsx`, `__tests__/Toaster.keyboard.test.tsx` | P3-02, P3-01, P3-03 |
| `P3-messagebar` (wave B) | `MessageBar.tsx`, `__tests__/MessageBar.test.tsx`, `stories/MessageBar.stories.tsx` | `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, `__tests__/MessageBar.parts.test.tsx`, `__tests__/MessageBar.reflow.test.tsx` | P3-04 |
| `P3-color` (wave B) | `ColorPicker.tsx`, `colorUtils.ts`, `__tests__/ColorPicker.test.tsx`, `__tests__/colorUtils.test.ts`, `src/lib/types.ts` (`HsvColor` only), `src/lib/__tests__/types.test.ts` (its type test), `src/styles/__tests__/tokens.test.ts` (the thumb and checkerboard pairs), `stories/ColorPicker.stories.tsx` | `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx`, `ColorPicker.parts.tsx`, `colorName.ts`, `src/lib/color.ts`, `src/lib/__tests__/color.test.ts`, `__tests__/ColorArea.test.tsx`, `__tests__/ColorSlider.test.tsx`, `__tests__/AlphaSlider.test.tsx`, `__tests__/ColorPicker.parts.test.tsx`, `__tests__/colorName.test.ts`, `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` | P3-05 |
| `P3-tree` (wave B) | `Tree.tsx`, `__tests__/Tree.test.tsx`, `stories/Tree.stories.tsx` | `Tree.root.tsx`, `Tree.item.tsx`, `Tree.context.ts`, `Tree.selection.ts`, `Tree.personaLayout.tsx`, `__tests__/Tree.selection.test.ts`, `__tests__/Tree.multiselect.test.tsx`, `__tests__/Tree.actions.test.tsx`, `__tests__/Tree.personaLayout.test.tsx` | P3-06, P3-07 |
| `INTEGRATION` (wave C) | `src/components/feedback/index.ts`, `src/components/input/index.ts`, `src/components/layout/index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/classNames.test.ts` (empties `PENDING_CLASS_NAMES`), `scripts/verify-dist.mjs` (empties `PENDING_FLAT_EXPORTS`; the color and Toaster probes of D30), `scripts/__tests__/verify-dist.test.mjs`, `stories/_helpers.ts`, the 0.7 tests a wave-B change breaks that no wave-B package owns | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` | — | docs |

Disjointness check (wave B): the four packages share no file. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read only in wave B (F3 wrote them); `src/lib/types.ts`, `src/lib/color.ts` and `tokens.test.ts` belong to `P3-color` alone; the barrels are untouched until wave C, because every compound module keeps its path (D32, rule 22). Inside `P3-toasts` the items run P3-02 → P3-01 → P3-03 (the content form renders through the container of P3-02, and the keys act on it); inside `P3-tree` P3-06 → P3-07 (the row layout and the split come first). `P3-color` is the critical path of wave B (L); the lead commits it at a checkpoint after the standalone parts pass, so INTEGRATION can start the color cases while the ColorPicker composition finishes.

Waves:
1. **Wave A:** `F3-foundation`. Exit: §1.7.
2. **Wave B:** the four packages in parallel. Each reports its barrel requests, the 0.7 tests it updated (with the reason), any failure of another package's test it saw, and any change request (a registry key, §0.2 rule 20). Between wave B and wave C, `verify-dist` passes only with the bridge (rule 21) and `classNames.test.ts` only with the pending list (§1.4.3).
3. **Wave C:** INTEGRATION: the barrels (§4.3), the pending lists emptied, the probes of D30, the cross-package tests (§4.4), public types (§4.5), the Server Component regression cases, the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave E (lead):** the final gate and the real-browser and screen-reader checklist (§6.3), and the per-theme Storybook check of the new stories (light, dark, high contrast, RTL).

---

## 4. Cross-package contracts

### 4.1 Class names (F3-foundation → every package)

- The registry is frozen in wave B (§0.2 rule 20). Every new element a wave-B package creates for a registered part carries exactly the class Appendix A names for it, applied by the rules of §1.2 (first in `cn()`, through `renderSlot`'s base classes for slots, the base classes for variants, the parent's part class on a nested public component).
- The new `testClassName` case runs for every new part a package tests with `testSystemProps`; a part it cannot test that way (`Toast.Close`, which renders no element) needs no constant.
- A package that needs a key Appendix A lacks, or finds an element that meets the part rule and has no key, files a change request; the lead edits the registry and tells the other packages.

### 4.2 The severity text (F3-foundation → P3-toasts, P3-messagebar)

- `StatusText` takes an `id` (§1.3). `P3-toasts` gives it the id the container's `aria-labelledby` names first (D10); `P3-messagebar` the id of a labelled bar (D16). Neither changes `MessageBar.status.tsx`.

### 4.3 Barrels, compound members and pending lists (INTEGRATION applies)

- `src/components/feedback/index.ts`: `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `MessageBarTitle`, `MessageBarActions`; types `ToastTitleProps`, `ToastBodyProps`, `ToastFooterProps`, `ToastCloseProps`, `ToastCloseRenderProps`, `ToastDispatchOptions`, `ToasterShortcuts`, `MessageBarTitleProps`, `MessageBarActionsProps`. The barrel keeps importing `Toast`, `Toaster` and `useToastController` from `./Toast` (D32).
- `src/components/input/index.ts`: `ColorArea`, `ColorSlider`, `AlphaSlider`, `ColorPickerArea`, `ColorPickerSlider`, `ColorPickerAlphaSlider`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`; types `ColorAreaProps`, `ColorAreaLabels`, `ColorSliderProps`, `ColorSliderLabels`, `AlphaSliderProps`, `AlphaSliderLabels` and the six part prop types.
- `src/components/layout/index.ts`: `TreePersonaLayout`; types `TreePersonaLayoutProps`, `TreeCheckedItemsChangeDetails`.
- `src/index.ts`: `hsvToHex`, `hexToHsv` from `./lib/color` (`HsvColor` is public through `export type * from './lib/types'`; the registry since wave A).
- With the barrels extended, INTEGRATION empties `PENDING_FLAT_EXPORTS` (verify-dist) and `PENDING_CLASS_NAMES` (`classNames.test.ts`), adds the probes of D30 that need the wave-B modules (the color modules dropped from the Button-only bundle; `hooks/usePresence.mjs` in the Toaster-only bundle), and runs `node scripts/verify-dist.mjs --final`.

### 4.4 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

1. **A Menu in a toast** (the roadmap's reason for 0.7 as Phase 3's entry): a dispatched `<Toast>` whose title `action` is a MenuButton with a Menu. The menu opens from the toast; while focus is in the menu (a portal), the toast's timer stays paused (React focus events bubble through the portal to the container's pause handlers, which count them, unlike the C-COMPOSE rule for activation handlers); Escape closes only the menu (the Menu consumes it) and focus returns to the MenuButton; a second Escape dismisses the toasts and returns focus to the origin.
2. **A toast over a modal Dialog:** the toast's Undo button is reachable by Tab while the Dialog is open (0.7's allow-list); Escape in the toast dismisses the toasts, leaves the Dialog open and returns focus into it; Delete on a focused toast dismisses only that toast.
3. **`Toast.Close` around a `Button` and a `Link`** in a title action and in a footer (the composed `onClick` reaches the Button; `preventDefault()` in the Button's `onClick` keeps the toast).
4. **A MenuButton in `MessageBar.Actions`:** the menu opens and Escape returns focus to the MenuButton; the bar's content reads "Warning: <title> <body>" once, the actions' labels after it.
5. **ColorPicker in a Field** (composed: `Area`, `Slider`, `HexField`): the group named by the Field's label, the hex input described by the Field's error; a form submit with `name` carries the hex; a form reset restores the default and keeps the working hue; a standalone ColorSlider in a Field (its input named by the label, C-ROUTING).
6. **ColorPicker in a Popover** (the `InPopover` recipe): dragging the area does not dismiss the popover (the press starts inside the surface); Escape closes the popover and returns focus to its trigger (the color parts consume no Escape).
7. **A Tree with a MenuButton in its actions**, `navigationMode="treegrid"`: ArrowRight reaches the action, Enter opens the menu, Escape returns focus to the action, ArrowLeft returns to the item; a checkbox Tree in a Dialog: Space toggles, Escape closes the Dialog.
8. **Class names across compounds:** a Toolbar with a `Toolbar.ToggleButton` (`wave-toolbar`; `wave-button wave-toggle-button wave-toolbar-toggle-button`), a SplitButton's halves, a `Dialog.Content`'s close button and a Persona's Avatar carry the classes Appendix A names; a Menu in a toast carries both components' classes.
9. **The Server Component regression suite:** every new compound member (`ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `MessageBarTitle`, `MessageBarActions`, the six ColorPicker parts, `TreePersonaLayout`) through `asClientReference`: the same `renderToString` output and behaviour as the dotted parts; a server render that reads `buttonClassNames.root` from the entry.

### 4.5 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

`expectTypeOf` for every new member exported from the package entry, including: `ToastController['dispatchToast']` callable with `(options: ToastOptions)` and with `(content: ReactNode, options?: ToastDispatchOptions)`, returning `string`; `ToastDispatchOptions` members; `ToastProps['icon']` equal to `Slot<'span'> | undefined`; `typeof Toast.Title` equal to `typeof ToastTitle` (and the other members of the four compounds); `ToasterProps['shortcuts']`; `MessageBarProps['layout']` equal to `'auto' | 'singleline' | 'multiline' | undefined`; `HsvColor` members; `hsvToHex` and `hexToHsv` signatures; `ColorAreaProps['value']` equal to `HsvColor | undefined`; `ColorSliderProps['channel']` and `['orientation']`; `AlphaSliderProps['transparency']`; `ColorPickerProps['shape']` equal to `'rounded' | 'square' | undefined`; `ColorPickerLabels['colorName']`; `TreeProps['selectionMode']` equal to `'none' | SelectionMode | undefined`; `TreeProps['onCheckedItemsChange']` accepting a one-argument callback and `setState`; `TreeCheckedItemsChangeDetails` members; `TreeItemProps['actions' | 'aside' | 'iconAfter' | 'expandIcon']`; `TreeProps['navigationMode']`; `TreePersonaLayoutProps`; the literal types of a few registry constants; `@ts-expect-error` for `layout="wrap"`, `channel="alpha"`, `selectionMode="multiselect"`, `navigationMode="grid"` and an assignment to `buttonClassNames.root`.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

A new `## [0.8.0] - Unreleased` section above `## [0.7.0] - 2026-09-26`:

- **Intro:** the third Fluent-parity release (Phase 3 of the roadmap: notifications, color and trees, and stable class names); it closes 4 high, 6 medium and 9 low gaps and mitigates `buttons-29` (ids in backticks); nothing public removed or narrowed; read "Upgrading from 0.7" before upgrading if tests assert Wave's DOM, class strings or console output.
- **Upgrading from 0.7** (numbered):
  1. Every component root and named part carries a stable class (`wave-button`, `wave-button__icon`, …); assertions on a complete class string change.
  2. A toast in the Toaster renders inside a container (`role="group"`, `tabIndex="-1"`, named by its title, `data-wave-toast` and `data-presence` on it); the 0.5 title and body render as the `Toast.Title` and `Toast.Body` elements.
  3. Escape inside the toast region dismisses the toasts; it no longer closes a Dialog or Drawer below.
  4. Every MessageBar renders `data-layout`; a bar without actions looks as before.
  5. Every Tree renders `data-selection-mode`.
  6. The default ColorPicker gains a color area and a hue slider; with `showOpacity` its opacity slider becomes an alpha slider (still named "Opacity").
  7. `ToastController['dispatchToast']` is overloaded: a test double that implements it must accept content too.
- **Added** (by component, each with its gap ids): stable class names and the registry (P3-00); `dispatchToast` with React content (P3-01); Toast parts, `Toast.Close` and `icon` (P3-02); Toaster `shortcuts`, Escape and Delete (P3-03); `MessageBar.Title`, `MessageBar.Actions`, `layout` (P3-04); `ColorArea`, `ColorSlider`, `AlphaSlider`, the composable ColorPicker, `shape`, `HsvColor`, `hsvToHex`, `hexToHsv` (P3-05); Tree `selectionMode`, `checkedItems` with the cascade (P3-06); Tree `actions`, `aside`, `iconAfter`, `expandIcon`, `navigationMode`, `Tree.PersonaLayout` (P3-07); the new public types.
- **Changed:**
  - Behaviour: Escape in the toast region (P3-03).
  - Visual: the default ColorPicker layout and its opacity row (P3-05).
  - DOM: the stable classes; the toast container; `data-layout`; `data-selection-mode`; `data-presence` on toast containers (enumerated attributes always present, boolean ones present or absent, Phase 1 D22).
  - Types: `ToastController['dispatchToast']` is overloaded; `typeof Toast`, `typeof MessageBar`, `typeof ColorPicker` gain static members and `typeof Tree` gains `PersonaLayout`.
- **Deprecated:** nothing new. Notice: the `details` parameter of `onCheckedItemsChange` becomes required in 1.0, like `onOpenChange`'s and `onCheckedValuesChange`'s.
- **Size:** `dist/styles.css`, an import of only `Button`, of only `Toaster`, of only `ColorPicker` and of everything, against 0.7.0, measured as 0.7 did.

### 5.2 README

- "Components": the Toast row (rich content, parts, keyboard), the MessageBar row (title, actions, layout), the ColorPicker row (composable) and new rows for `ColorArea`, `ColorSlider` and `AlphaSlider`, the Tree row (multi-select, actions, persona rows).
- New "Styling hooks" section (P3-00).
- "React Server Components": the flat-name table gains the Toast, MessageBar, ColorPicker and Tree parts; a line that the class-name constants and the color helpers are readable in Server Components.
- "Toasts" rewritten around rich content (the roadmap's exit criterion; P3-01 … P3-03).
- New usage notes: "Message bars" (P3-04), "Color" (P3-05), "Trees" (P3-06, P3-07).
- "Keyboard support": the Toaster row, `ColorArea`, `ColorSlider`/`AlphaSlider`, the Tree row (Space toggles checks; the treegrid keys; Tab into a row's actions).
- "Hooks and utilities": `hsvToHex`, `hexToHsv`; the class-name constants.
- "Built-in text": the labels of `ColorArea`, `ColorSlider`, `AlphaSlider` and ColorPicker's new labels (with their defaults, and `colorName` as a function).
- "Upgrading from 0.7": a short list pointing to the CHANGELOG.

### 5.3 CLAUDE.md

- "What is this?": 68 components (with `ColorArea`, `ColorSlider`, `AlphaSlider`); "User docs": add this spec.
- Architecture: `src/lib/classNames.ts` (the class-name registry, server-safe, public) and `src/lib/color.ts` (public HSV helpers); component-private helpers add `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx`, `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, `ColorPicker.parts.tsx`, `colorName.ts`, `Tree.root.tsx`, `Tree.item.tsx`, `Tree.context.ts`, `Tree.selection.ts`, `Tree.personaLayout.tsx` (with the one-way import rule of the Menu split).
- C-CLASS: "Every public component and part carries its stable class from `src/lib/classNames.ts` (`wave-<name>`, `wave-<name>__<part>`), first in its `cn()`, on the element that receives `className`; variants carry their base classes, and a nested public component its parent's part class; no state classes. A new component or part registers its constant in the same change; the conventions gate (`class-names`) and `testSystemProps` enforce it."
- Testing: the `testClassName` stable-class case and `getStableClassNames`; `mockAnimations({ animated })` for the toast container; ResizeObserver reflow tests; pointer-capture tests.

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md`: a new pattern "Stable class names" (registering and applying a constant, the part rule, variants, the gate); the accessibility chapter: the 2-D slider (ColorArea), the checkbox tree with its cascade, the toast container and its keys, a MessageBar's live-region naming.
- `docs/testing-best-practices.md`: the stable-class case of `testClassName`; testing toasts (content dispatch, the live regions, presence through `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })`, the shortcut); testing the MessageBar reflow (`installResizeObserverMock`, `scrollWidth`); testing the color parts (pointer capture, `mockRect`, RTL); the cascade model's pure tests.

### 5.5 ROADMAP

- Status line: Phase 3 implemented on `feat/fluent-parity-phase-3`, unreleased; link this spec.
- Phase 3 entries: note where the spec changed the sketches (D2 the registry in `src/lib`; D8 `buttons-29` mitigated; D9 `Toast.Close` and `icon` on the root; D16 the MessageBar title names only a non-live bar; D17 `'auto'` without actions; D21 `ColorPicker.Slider` and `Preview`; D27 `navigationMode` keyboard-only).
- P13-02 closes `buttons-29` (moved from P3-00); the release overview table and its totals follow (Phase 3: 4 / 6 / 9; Phase 13 gains one low gap).
- P11-04: revisit real `treegrid` roles with the flat model. P13-01: the part keys of Appendix A are the `slotProps` keys.
- §8.3 "Intentional differences", Phase 3: a toast's severity comes from the rendered Toast (Fluent: the dispatch options only); every toast in the Toaster shows the Dismiss button (the opt-out stays `toaster-9`); a MessageBar's title does not name a live-region bar; ColorArea mirrors in RTL; tree checks cascade (Fluent's nested Tree keeps them independent); `navigationMode` keeps the tree roles (as Fluent); Backspace also dismisses a focused toast.
- §8.5 follow-ups: arrow keys between toasts; a non-cascading mode for tree checks; Shift+Arrow, Shift+Space and Ctrl+A in a multi-select tree; real treegrid roles with the flat model.

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

The checks of Phase 1 §0.2 rule 8 with clean output (no act() warnings; every `[WaveUI]` warning asserted). Every new behaviour has a test that failed first. The conventions gate (with the `class-names` rule from wave A on) and the stories gate are green for the package's files.

### 6.2 `verify-dist` probes and sizes

| Check | Gate | Where |
|---|---|---|
| An import of only `Button` contains no Dialog code (0.5) | fails `verify-dist` | `probeTreeShaking` |
| An import of only `Button` contains neither `hooks/usePresence` nor `components/motion/Presence` (0.7) | fails `verify-dist` | `probeTreeShaking` `dropModules` |
| An import of only `Menu` contains `hooks/usePresence` (0.7) | fails `verify-dist` | `probeIncludes` |
| The presence closure within its budget (0.7) | fails `verify-dist` | `probeSizeBudget` |
| An import of only `Button` contains `'wave-button'` and not `'wave-dialog'` (D30; F3) | fails `verify-dist` | `probeTreeShaking` `keepStrings`/`dropStrings` |
| The constants are plain objects under `--conditions=react-server`, read from the entry (D2; F3) | fails `verify-dist` | `checkServerImport` |
| `buttonClassNames` is declared in `index.d.ts` (F3) | fails `verify-dist` | `checkDeclarations` |
| An import of only `Button` contains none of `ColorArea`, `ColorSlider`, `AlphaSlider`, `lib/color` (D30; INTEGRATION) | fails `verify-dist` | `probeTreeShaking` `dropModules` |
| An import of only `Toaster` contains `hooks/usePresence` (D29; INTEGRATION) | fails `verify-dist` | `probeIncludes` |
| Every compound exports its flat names; `PENDING_FLAT_EXPORTS` is empty | fails `verify-dist --final` | `checkFlatExports` |
| `dist/styles.css`, Button-only, Toaster-only, ColorPicker-only and full-import sizes against 0.7.0 | reported in the CHANGELOG | measured once for the release |

Expectations to check in the report: every component bundle grows by its class-name strings only (no other registry constant is included); `dist/styles.css` grows by the new components' utilities (the stable classes generate no CSS); the Button-only bundle contains no color, toast or tree code.

### 6.3 Final gate (wave E)

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final` (with the §6.2 probes and both pending lists empty), `npm run check:package`, `npm run test:pack`, `npm run build-storybook`; the stories axe gate and the conventions gate green; the lead checks every new story in the light, dark and high-contrast themes and in RTL. The lead bumps `package.json` to 0.8.0 at release time, not in this phase's packages.

**Real-browser and screen-reader checklist.** jsdom has no layout, no hit testing, no ResizeObserver, no pointer capture and no screen reader, so the lead checks these in Storybook (Chrome, Firefox and Safari; NVDA with Chrome, JAWS with Edge, VoiceOver with Safari on macOS and iOS) and names each result as exit evidence in the wave E report:
1. **Class names:** the stable classes appear in the DOM of a sample of stories, and in the Tailwind fixture's build (`test:pack`) no utility is generated for them.
2. **Toasts:** a rich toast is announced once ("Success: Email sent Your message was delivered."), an error toast assertively; the shortcut focuses the newest toast and the screen reader announces its group name; Escape returns focus to where it was; Delete and Backspace dismiss; Escape in a toast over a Dialog leaves the Dialog open; the timer stays paused while a menu opened from the toast has focus.
3. **MessageBar:** a titled alert is read once, title included, with the default role; a `role="region"` bar appears in the landmarks list with the name "Warning: <title>"; `'auto'` switches to multiline and back as the window narrows and widens, with no jump on load.
4. **Color:** dragging the area and the sliders with a mouse, with touch (Android Chrome, iOS Safari) and with a pen; VoiceOver on iOS adjusts saturation and brightness with swipes; NVDA reads "Saturation 72%, Brightness 74%, dark blue, 2D slider"; RTL mirrors the area and the horizontal rails; vertical sliders work in Chrome and Edge (with and without native vertical range inputs), Firefox and Safari; Windows High Contrast shows the thumb rings and the focus ring; the checkerboard is visible in all three themes.
5. **Trees:** NVDA, JAWS and VoiceOver announce a parent's mixed state; Space toggles; row actions show on hover, on focus, on touch and in forced colors; the treegrid arrows reach the actions and back; the toolbar is announced with the item's name.

### 6.4 Existing tests expected to change (update, do not delete)

From a read of every test, story and script test at bcbdb51. There are no snapshot files and no story `play` functions; stories reach these components only through the axe gate.

- **`F3-foundation` (wave A), exact class comparisons** (24 assertions in 6 files). They compare a rendered class list with the style helper's (`buttonClassName(…)`) or with a literal string; they become the helper's classes plus the registry classes the element carries (read from the constants, not written as literals): `Drawer.test.tsx:1649` (a `Dialog.Footer`'s complete class string); `MenuButton.test.tsx:540-541`; `CompoundButton.test.tsx:229-231` (the icon-only CompoundButton against the icon-only Button: they now differ by CompoundButton's own class); `ToggleButton.test.tsx:415, 426, 437, 452, 466, 548, 575, 589, 593, 611`; `Toolbar.test.tsx:853-856, 876, 879, 882`; `Toolbar.parts.test.tsx:229, 403, 443, 998`.
- **`F3-foundation`, checked and unchanged:** the equality checks that render the same tree on both sides (Badge `severe` against `important`; about twenty `renderToString` plain-against-lazy comparisons in the component suites and `integration.test.tsx`); the exact comparisons of lib helpers and fixtures (`slot`, `mergeProps`, `renderTrigger`, `buttonStyles`, `children`, `useMergedRefs`, `useAnnounce`); `testClassName`'s own fixture tests; `test-utils.test.tsx:746-769`, whose `Chip` fixture has no registry constant, so the new case is not registered and the list of eight test names stays; the `pick()`-based fixtures (the new case's name matches none of them). The `testSystemProps` calls with a `wrapper` (25) and those whose `className` lands on an inner or portaled element (Nav items, Table, DataGrid, TabList, `Dialog.Content`, Drawer, Toaster, Tooltip, Avatar with a badge, the static Menu, WaveProvider through the alias table) need no config change: the new case finds the element that received the consumer class.
- **`P3-toasts` (wave B):**
  - `Toast.test.tsx:537-538` asserts that a toast has no `role`: it becomes `role="group"` on the container (D10).
  - The `getToasts()` helper (`Toast.test.tsx:66-67`, 76 call sites) now returns the containers: the counts stay valid (one marker per toast, and a dismissed toast unmounts in the same `act()` without motion); the pointer events fired at a toast (`:1002-1006`, `:1017`, `:1169-1176`, `:1757-1761`) stay valid because the pause handlers move to the container; the exact texts at `:844-849` stay valid because the container and the parts add no text.
  - `bodyAfter` (`Toast.test.tsx:103`, used at `:113`, `:118`, `:128`) reads the title element's next sibling: the title text now sits in a span inside `Toast.Title`, so the helper finds the body from the title row (or by its stable class).
  - Unchanged, and to be kept so: the exact timer counts (`vi.getTimerCount()`, 17 places; the presence core schedules no timer without motion), the six focus-move checks (the containers stay direct children of the viewport and `tabIndex="-1"` keeps the first tabbable element on the Dismiss button), `integration.test.tsx:1025` (`[data-wave-toast] *`).
- **`P3-messagebar` (wave B):** nothing breaks if a bar without actions keeps 0.7's markup (D17): `MessageBar.test.tsx:169` (no `aria-hidden` element with `icon={null}`) and `:1352` (the Dismiss button's `ms-auto` in RTL) pin it.
- **`P3-color` (wave B), `ColorPicker.test.tsx`:** the slider queries are all named ("Opacity", and "Deckkraft" with `labels`), so the AlphaSlider's input keeps `labels.opacity` as its name. `:433-437` assert the focus ring on the opacity input: it moves to the AlphaSlider's thumb, the input being transparent. The value checks (`toHaveValue('50')`, the "50%" readout at `:449-450`, the 0–100 values at `:458`, `:460`, `:475`, `:492`, `:511`, `:591`, `:913`, `fireEvent.change` at `:473-474` and `:521-522`, `toBeDisabled()` for a value that is not hex at `:520`) stay valid by design (a 0–100 input that handles native change events, the kept readout, the invalid-value rule of D21). The Field-isolation counts (`:641`, `:652`, `:763`, `:849`) and `integration.test.tsx:767`, `:780`, `:805`, `:2227`, `:2242`, `:2262` (`getByRole('group', { name: 'Preference' })`) stay valid because the parts render in a `null` Field context, own no hidden input, and the area's group is named by `labels.area`, not by the Field. The axe runs of `ColorPicker.test.tsx:42-54`, `:244`, `:718`, `:739`, `:767`, `integration.test.tsx:771`, `:786`, `:2233`, `:2248` and the ColorPicker stories audit the new parts (named, so no change).
- **`P3-tree` (wave B):** nothing breaks; the absence checks on items (`Tree.test.tsx:135`, `:147`, `:425-427`, `:622`, `:628`, `:641`) hold because `'none'` adds nothing to items.
- **Scripts:** no script test is affected (synthetic fixtures); `build-css`'s class checks are unaffected (Tailwind generates nothing for `wave-*` words; the only `wave` definition is the `wave-rtl` variant).

### 6.5 Definition of done for Phase 3

Every item's tests pass; the gap ids of §7 are closed (and `buttons-29` recorded as mitigated); the §6.2 probes pass; the CHANGELOG 0.8.0 section, README, CLAUDE.md and guides are updated; `docs/ROADMAP.md` marks Phase 3 as released when 0.8.0 ships; this spec gains a §10 "Implementation notes" recording where the code deliberately differs from it.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `foundation-37` | medium | P3-00 | F3-foundation |
| `buttons-29` | low | P3-00 (mitigates; closed by P13-02, D8) | F3-foundation |
| `toast-1` | high | P3-01 | P3-toasts |
| `toast-2` | medium | P3-02 | P3-toasts |
| `toasttrigger-1` | low | P3-02 (`Toast.Close`) | P3-toasts |
| `toast-3` | low | P3-02 (`icon`) | P3-toasts |
| `toaster-2` | medium | P3-03 | P3-toasts |
| `messagebar-2` | medium | P3-04 | P3-messagebar |
| `messagebar-1` | low | P3-04 | P3-messagebar |
| `messagebar-3` | low | P3-04 | P3-messagebar |
| `colorarea-1` | high | P3-05 | P3-color |
| `colorslider-1` | high | P3-05 | P3-color |
| `colorpicker-1` | medium | P3-05 | P3-color |
| `alphaslider-1` | low | P3-05 | P3-color |
| `colorpicker-2` | low | P3-05 (recipe story) | P3-color |
| `colorpicker-3` | low | P3-05 (`shape`) | P3-color |
| `tree-1` | high | P3-06 | P3-tree |
| `tree-2` | medium | P3-07 | P3-tree |
| `tree-7` | low | P3-07 | P3-tree |
| `tree-8` | low | P3-07 | P3-tree |

Totals: 4 high, 6 medium and 9 low gaps closed, and 1 low gap mitigated (the roadmap's 4 / 6 / 10, with `buttons-29` moved to P13-02, D8). Every gap id the roadmap assigns to P3-00 … P3-07 appears exactly once above and in its item's "Closes" or "Mitigates" line.

---

## 8. Open questions for the maintainer

Each with the spec's recommended answer, which the rulings above already assume. The three questions of the design review (the registry approach, the tree cascade, the Dismiss button on rich toasts) are answered and recorded as maintainer rulings in the header.

1. **`Toast.Close` instead of the sketch's `Toast.Trigger` (D9).** *Recommended:* `Toast.Close`: WaveUI's `*.Trigger` parts open surfaces and `Dialog.Close`/`Drawer.Close` close them; the JSDoc names Fluent's `ToastTrigger`.
2. **A MessageBar title names the bar only with a non-live role (D16)**, where the sketch and Fluent always label the bar. *Recommended:* yes: a named live region can have its name read with its content, reading the title twice; `role="region"` gets the name it needs.
3. **`layout="auto"` renders multiline for a bar without actions (D17).** *Recommended:* yes: such a bar has nothing to reflow, and measuring it would shift every 0.7 bar after hydration.
4. **The default ColorPicker gains an area and a hue slider (D21)**, a visible change for 0.7 users, as the roadmap sketch says. *Recommended:* yes, with composing the parts as the opt-out (CHANGELOG "Visual").
5. **`ColorPicker.Slider` with `channel` instead of `HueSlider`, and an added `ColorPicker.Preview` (D21).** *Recommended:* yes: one part covers the three channels, and the preview is needed to rebuild the default layout.
6. **Public `hsvToHex` and `hexToHsv` (D18).** *Recommended:* yes: the standalone parts take `HsvColor`, and apps usually store hex.
7. **A built-in English color namer, replaceable through `labels.colorName` (D22).** *Recommended:* yes: the roadmap's acceptance asks that the value text names the color; a function label translates where a table of fragments cannot.
8. **`ColorArea` mirrors its x axis in RTL (D19)**, which Fluent's does not. *Recommended:* yes (C-LOGICAL, native range inputs, the roadmap's acceptance), recorded in ROADMAP §8.3.
9. **`buttons-29` recorded as mitigated by P3-00 and closed by P13-02 (D8).** *Recommended:* yes: class names are only half of that gap.
10. **Variants carry their base classes (D5)**, so `.wave-button` also matches ToggleButton, MenuButton and the Toolbar buttons. *Recommended:* yes (Fluent's behaviour; one hook styles every button).
11. **The standalone color parts accept `name`, `form` and `required` and submit hex (C-FORMS).** *Recommended:* yes: the roadmap's guard ("hidden inputs and form reset on every value control").
12. **Backspace dismisses a focused toast as well as Delete (D14).** *Recommended:* yes: Backspace is the delete key of Mac keyboards, and TagPicker removes a tag with either.
13. **`selected` is ignored in a checkbox tree, with a development warning (D25).** *Recommended:* yes: an item carries `aria-checked` or `aria-selected`, never both (APG).
14. **`navigationMode="treegrid"` changes the keyboard only (D27).** *Recommended:* yes (as Fluent); real treegrid roles wait for the flat tree model (P11-04).
15. **A row's `aside` hides while its actions show, also where the actions always show (touch, forced colors) (D26, Fluent's rule).** *Recommended:* yes in 0.8; showing both when there is room can come later without breaking anything.
16. **Escape inside the toast region no longer reaches a Dialog below (D14)**, a behaviour change for 0.7. *Recommended:* yes: the Escape belongs to the toasts the user is in; the Dialog closes with the next Escape once focus is back in it.
17. **One DOM order for both MessageBar layouts (D17)**: icon, text, actions, Dismiss, so the multiline layout reaches the Dismiss button (drawn at the top end) after the actions (drawn below the text), where Fluent reorders the DOM to follow the visual order. *Recommended:* yes: a reflow of an `'auto'` bar would otherwise move the focused action or Dismiss button, and a moved node loses focus; "content, actions, Dismiss" is a natural order in both layouts.

---

## Appendix A — Class-name registry

The contract of `src/lib/classNames.ts` (D1–D5): every constant, where its root class goes, its parts and the classes an element also carries. Built from a read of every component module at bcbdb51 plus the approved Phase 3 design; **0.8** marks elements of this phase that do not exist yet (they are on `PENDING_CLASS_NAMES` until their package lands). In the Parts column the suffix is appended to the row's root class (`wave-tag` + `__dismiss-icon`); "Also carries" lists classes added next to the element's own (variants, D5; nested public components).

**How the part keys were chosen**, in order: the element's own WaveUI prop or slot (including slots the roadmap already plans); the key such a prop gives the same kind of element elsewhere (one vocabulary); Fluent UI v9's slot name; a plain noun. A button or control named by a `labels` key or a `*Label` prop takes that key plus the element (`clearButton`, `selectAllCheckbox`); noun keys stay bare (`star`, `slide`). A part keeps its class when it renders outside the `className` target; a part that is the root in one layout carries both classes there. A glyph is a part when a prop or planned slot controls it, when it is an indicator beside other content, or when it is the component's only visual; the class then goes on its `<svg>`, with no wrapper added.

**Display names that differ from their flat names** (the alias table of §1.4.2): `RadioItem` → `radioGroupItemClassNames`, `Step` → `stepperStepClassNames`, `Tab` → `tabListTabClassNames`, `TabPanel` → `tabListPanelClassNames`, `TabPanels` → `tabListPanelsClassNames`, `TableHead` → `tableHeaderClassNames`, `TableHeadCell` → `tableHeaderCellClassNames`. Every other public component's constant is its camel-cased display name plus `ClassNames`.

### button

| Constant | Root class | Root element (where `className` goes) | Parts (key `suffix` — element, controlling prop) | Also carries |
|---|---|---|---|---|
| `buttonClassNames` | `wave-button` | the rendered element (`<button>`, or `as`) | `icon` `__icon` — icon `<span>` (`icon`) | — |
| `compoundButtonClassNames` | `wave-compound-button` | the rendered element (rendered through Button) | `icon` `__icon` — icon box `<span>` (`icon`; Button's icon span in the icon-only layout)<br>`contentContainer` `__content-container` — text column `<span data-wave-compound-content>`<br>`primaryText` `__primary-text` — main line `<span>` (children)<br>`secondaryText` `__secondary-text` — second line `<span>` (`secondaryText`) | root `wave-button`; `icon` `wave-button__icon` |
| `toggleButtonClassNames` | `wave-toggle-button` | the `<button>` (through Button) | `icon` `__icon` — Button's icon `<span>` (`icon`) | root `wave-button`; `icon` `wave-button__icon` |
| `splitButtonClassNames` | `wave-split-button` | `role="group"` `<div>` | `primaryActionButton` `__primary-action-button` — primary half, a Button (`primaryActionButtonProps`)<br>`menuButton` `__menu-button` — menu half, a Button (`menuButtonProps`, `menuButtonLabel`)<br>`icon` `__icon` — the primary half's icon `<span>` (`icon`)<br>`menuIcon` `__menu-icon` — the menu half's icon `<span>`: chevron or glyph (`menuIcon`) | both halves `wave-button`; `icon`, `menuIcon` `wave-button__icon` |
| `menuButtonClassNames` | `wave-menu-button` | the `<button>` (through Button) | `icon` `__icon` — Button's icon `<span>` (`icon`)<br>`menuIcon` `__menu-icon` — default chevron `<svg>`, else the glyph's `<span>` (`menuIcon`) | root `wave-button`; `icon` `wave-button__icon` |
| `linkClassNames` | `wave-link` | the rendered element (`<a>`, or `as`) | — | — |
| `toolbarClassNames` | `wave-toolbar` | `role="toolbar"` element (`as`, default `<div>`) | — | — |
| `toolbarButtonClassNames` | `wave-toolbar-button` | the rendered element (through Button) | `icon` `__icon` — Button's icon `<span>` (`icon`; the icon box with `vertical`) | root `wave-button`; `icon` `wave-button__icon` |
| `toolbarToggleButtonClassNames` | `wave-toolbar-toggle-button` | the `<button>` (through ToggleButton) | `icon` `__icon` — icon `<span>` (`icon`) | root `wave-button wave-toggle-button`; `icon` `wave-button__icon wave-toggle-button__icon` |
| `toolbarRadioButtonClassNames` | `wave-toolbar-radio-button` | the `<button role="radio">` (through ToggleButton) | `icon` `__icon` — icon `<span>` (`icon`) | root `wave-button wave-toggle-button`; `icon` `wave-button__icon wave-toggle-button__icon` |
| `toolbarRadioGroupClassNames` | `wave-toolbar-radio-group` | `role="radiogroup"` `<div>` | — | — |
| `toolbarGroupClassNames` | `wave-toolbar-group` | `<div>` | — | — |
| `toolbarDividerClassNames` | `wave-toolbar-divider` | `role="separator"` `<div>` | — | — |

### data-display

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `avatarClassNames` | `wave-avatar` | the avatar `<span>`; with `badge`, the outer wrapper `<span>` | `visual` `__visual` — the circle: the root without `badge`, the inner `<span>` with it<br>`image` `__image` — `<img>`, or the image slot's element (`image`, `src`)<br>`icon` `__icon` — `icon` slot `<span>`, else the default person `<svg>` (`icon`)<br>`initials` `__initials` — initials `<span>` (`name`; planned `initials` slot, P8-01)<br>`badge` `__badge` — badge slot `<span>` (`badge`) | — |
| `avatarGroupClassNames` | `wave-avatar-group` | `role="group"` `<div>` | `item` `__item` — wrapper `<span>` around each visible member (planned `AvatarGroup.Item`, P8-02)<br>`overflowButton` `__overflow-button` — "+N" `<button>` (`overflowLabel`)<br>`surface` `__surface` — portaled `role="dialog"` popup<br>`list` `__list` — its `<ul>`<br>`listItem` `__list-item` — each `<li>` (a hidden member, or `unnamedMemberLabel`) | — |
| `badgeClassNames` | `wave-badge` | `<span>` | — | — |
| `counterBadgeClassNames` | `wave-counter-badge` | `<span>` (nothing renders for a hidden count) | — | root `wave-badge` |
| `presenceBadgeClassNames` | `wave-presence-badge` | `role="img"` `<span>` | `icon` `__icon` — status glyph `<svg>` (`status`) | — |
| `tagClassNames` | `wave-tag` | the rendered element (`as`, default `<span>`) | `primaryText` `__primary-text` — content `<span>` (children)<br>`dismissButton` `__dismiss-button` — wired `<button>` (`dismissible`, `onDismiss`, `dismissLabel`)<br>`dismissIcon` `__dismiss-icon` — the icon inside it: the element `dismissIcon` renders, a merged Button's `icon` `<span>`, else the default `<svg>` | — |
| `personaClassNames` | `wave-persona` | `<div>` | `avatar` `__avatar` — the built-in Avatar, or the `avatar` slot `<span>` (`avatar`, `src`, `name`)<br>`badge` `__badge` — positioning `<span>` around the badge (`badge`, `status`)<br>`primaryText` `__primary-text` — name `<span>` (`name`; planned `primaryText` slot, P8-03)<br>`secondaryText` `__secondary-text` — `<span>` (`secondaryText`) | `avatar` (built-in) `wave-avatar wave-avatar__visual` |
| `dividerClassNames` | `wave-divider` | `<hr>` (plain horizontal), `<div role="separator">` (vertical or labelled), or `as` | `line` `__line` — each of the two line `<div>`s of a labelled divider<br>`label` `__label` — label `<span>` (children) | — |
| `infoLabelClassNames` | `wave-info-label` | `<span>` | `infoButton` `__info-button` — info `<button>` (`infoButtonLabel`)<br>`info` `__info` — portaled popup `<div data-wave-infolabel-surface>` (`info`) | — |
| `imageClassNames` | `wave-image` | `<img>` | — | — |
| `listClassNames` | `wave-list` | `<ul>`; `<div role="grid">` for a selectable list with actions | — | — |
| `listItemClassNames` | `wave-list-item` | `<li>`; `<div role="row">` in grid mode | `content` `__content` — content `<span>` / `<div role="gridcell">` (children)<br>`action` `__action` — action cell `[data-list-action]` (`action`) | — |

### feedback

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `messageBarClassNames` | `wave-message-bar` | `<div>` (`role="status"`/`"alert"`, or the consumer's) | `icon` `__icon` — status icon `<span>` (`icon`)<br>`body` `__body` — text column `<div>` (children; holds `MessageBar.Title`)<br>`dismissButton` `__dismiss-button` — wired `<button>` (`onDismiss`, `dismiss`)<br>`dismissIcon` `__dismiss-icon` — the icon inside it: the element `dismiss` renders, a merged Button's `icon` `<span>`, else the default `<svg>` | — |
| `messageBarTitleClassNames` **0.8** | `wave-message-bar-title` | inline `<span>` | — | — |
| `messageBarActionsClassNames` **0.8** | `wave-message-bar-actions` | the action container `<div>` | — | — |
| `progressBarClassNames` | `wave-progress-bar` | the `role="progressbar"` `<div>` (the track; also with `showLabel`) | `bar` `__bar` — fill `<div>`<br>`label` `__label` — visible label `<span>` (`label` + `showLabel`; a sibling of the root inside a wrapper that has no class) | — |
| `spinnerClassNames` | `wave-spinner` | `<span>` (`role="status"` by default) | `spinner` `__spinner` — ring `<span data-wave-spinner-ring>`<br>`label` `__label` — `<span data-wave-spinner-label>` (`label`; visually hidden without `labelVisible`) | — |
| `skeletonClassNames` | `wave-skeleton` | `<div>` | — | — |
| `skeletonGroupClassNames` | `wave-skeleton-group` | `<div>` | — | — |
| `toastClassNames` | `wave-toast` | `<div>` | `icon` `__icon` — status icon `<span>` (`status`; the 0.8 `icon` slot)<br>`content` `__content` — text column `<div>` (holds title, body, footer)<br>`dismissButton` `__dismiss-button` — wired `<button>` (`onDismiss`, `dismissLabel`) | — |
| `toastTitleClassNames` **0.8** | `wave-toast-title` | the title row (also what the `title` prop renders) | `action` `__action` — the `action` slot at the row's end (`action`) | — |
| `toastBodyClassNames` **0.8** | `wave-toast-body` | the body element (also what 0.5 children and `body` render) | `subtitle` `__subtitle` — (`subtitle`) | — |
| `toastFooterClassNames` **0.8** | `wave-toast-footer` | the action row | — | — |
| `toasterClassNames` | `wave-toaster` | portaled `role="region"` viewport | `toast` `__toast` — **0.8** `role="group"` container around each toast | — |

### input

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `inputClassNames` | `wave-input` | the `<input>`; with `contentBefore`/`contentAfter` content, the bordered wrapper `<span>` | `input` `__input` — the `<input>` (also the root when there is no slot content)<br>`contentBefore` `__content-before` — slot `<span>` (`contentBefore`)<br>`contentAfter` `__content-after` — slot `<span>` (`contentAfter`)<br>`errorMessage` `__error-message` — `role="alert"` `<span>` after the control (`error`, `errorMessageProps`) | — |
| `textareaClassNames` | `wave-textarea` | `<textarea>` | `errorMessage` `__error-message` — as Input's | — |
| `selectClassNames` | `wave-select` | `<select>` (the chevron is a background image) | `errorMessage` `__error-message` — as Input's | — |
| `fieldClassNames` | `wave-field` | `<div>` | `label` `__label` — `<label>` (`label`)<br>`required` `__required` — asterisk `<span>` (`required`)<br>`validationMessage` `__validation-message` — message `<p>` (`validationMessage`, `error`)<br>`validationMessageIcon` `__validation-message-icon` — its icon `<span>` (`validationMessageIcon`)<br>`hint` `__hint` — `<p>` (`hint`) | — |
| `labelClassNames` | `wave-label` | `<label>` | `required` `__required` — asterisk `<span>` (`required`) | — |
| `checkboxClassNames` | `wave-checkbox` | `<label>` | `indicator` `__indicator` — the `role="checkbox"` `<button>` (the box)<br>`label` `__label` — `<span>` (`label`) | — |
| `radioGroupClassNames` | `wave-radio-group` | `role="radiogroup"` `<div>` | — | — |
| `radioGroupItemClassNames` | `wave-radio-group-item` | `<label>` (`className`; `ref` and the other props go to the radio) | `indicator` `__indicator` — `role="radio"` `<button>`<br>`label` `__label` — `<span>` (`label`, `labelClassName`) | — |
| `switchClassNames` | `wave-switch` | `<label>` | `track` `__track` — `role="switch"` `<button>`<br>`thumb` `__thumb` — `<span>`<br>`label` `__label` — `<span>` (`label`) | — |
| `searchBoxClassNames` | `wave-search-box` | `<div>` (draws the field) | `contentBefore` `__content-before` — `<span>` holding the search icon or the slot (`contentBefore`)<br>`input` `__input` — `<input type="search">`<br>`contentAfter` `__content-after` — `<span>` holding the slot (`contentAfter`)<br>`dismissButton` `__dismiss-button` — clear `<button>` (`dismiss`, `onClear`)<br>`dismissIcon` `__dismiss-icon` — the icon inside it: the element `dismiss` renders, a merged Button's `icon` `<span>`, else the default `<svg>` | — |
| `sliderClassNames` | `wave-slider` | `<input type="range">` | — (rail and thumb are pseudo-elements) | — |
| `spinButtonClassNames` | `wave-spin-button` | `<div>` | `decrementButton` `__decrement-button` — − `<button>` (`labels.decrement`)<br>`input` `__input` — `<input role="spinbutton">`<br>`incrementButton` `__increment-button` — + `<button>` (`labels.increment`) | — |
| `optionClassNames` | `wave-option` | `<li role="option">` | `checkIcon` `__check-icon` — check `<svg>` (planned `checkIcon` slot, P5-03)<br>`content` `__content` — `<span>` (children) | — |
| `optionGroupClassNames` | `wave-option-group` | `<li role="presentation">` | `label` `__label` — heading `<div>` (`label`)<br>`list` `__list` — `<ul role="group">` of its options | — |
| `comboboxClassNames` | `wave-combobox` | `<div>` | `input` `__input` — `<input role="combobox">`<br>`clearButton` `__clear-button` — (`clearable`, `labels.clear`)<br>`expandButton` `__expand-button` — (`labels.expand`)<br>`expandIcon` `__expand-icon` — glyph `<span>` in it (`expandIcon`)<br>`listbox` `__listbox` — `<ul role="listbox">` (inline and `hidden` while closed)<br>`surface` `__surface` — portaled `<div data-wave-listbox-surface>`<br>`emptyMessage` `__empty-message` — "No matches" row in the popup (`labels.noMatches`) | — |
| `dropdownClassNames` | `wave-dropdown` | `<div>` | `button` `__button` — `<button role="combobox">`<br>`value` `__value` — value or placeholder `<span>` (`placeholder`)<br>`expandIcon` `__expand-icon` — chevron `<svg>` (planned `expandIcon` slot, P5-03)<br>`clearButton` `__clear-button` — (`clearable`, `labels.clear`)<br>`listbox` `__listbox` — `<ul role="listbox">`<br>`surface` `__surface` — portaled `<div data-wave-listbox-surface>` | — |
| `tagPickerClassNames` | `wave-tag-picker` | `<div>` | `control` `__control` — tag area `<div role="group" data-wave-tagpicker-control>`<br>`group` `__group` — `role="list"` of tags (`labels.selected`)<br>`tag` `__tag` — each `role="listitem"` `<div>`<br>`removeButton` `__remove-button` — each tag's `<button>` (`labels.remove`)<br>`input` `__input` — `<input role="combobox">`<br>`listbox` `__listbox` — `<ul role="listbox">`<br>`option` `__option` — each Option it renders (`options`)<br>`surface` `__surface` — portaled `<div data-wave-listbox-surface>`<br>`emptyMessage` `__empty-message` — "No matches" row (`labels.noMatches`) | `option` `wave-option` (its text `<span>` `wave-option__content`) |
| `timePickerClassNames` | `wave-time-picker` | `<div>` | `input` `__input` — `<input role="combobox">`<br>`clearButton` `__clear-button` — (`clearable`, `labels.clear`)<br>`expandButton` `__expand-button` — (`labels.expand`)<br>`expandIcon` `__expand-icon` — glyph `<span>` (`expandIcon`)<br>`errorMessage` `__error-message` — `role="alert"` `<p>` (`labels.invalidTime`, `labels.outOfRange`)<br>`listbox` `__listbox` — `<ul role="listbox">` (`labels.list`)<br>`option` `__option` — each `<li role="option">`<br>`checkIcon` `__check-icon` — each option's check column `<span>`<br>`surface` `__surface` — portaled popup `<div>`<br>`emptyMessage` `__empty-message` — status row in the popup (`labels.noTimes`, `labels.noMatches`) | — |
| `datePickerClassNames` | `wave-date-picker` | `<div>` | `input` `__input` — text `<input>`<br>`clearButton` `__clear-button` — (`clearable`, `labels.clear`)<br>`openCalendarButton` `__open-calendar-button` — calendar toggle (`labels.openCalendar`)<br>`errorMessage` `__error-message` — `role="alert"` `<p>` (`labels.invalidDate`, `outOfRange`, `unavailableDate`)<br>`surface` `__surface` — portaled `role="dialog"` calendar<br>`header` `__header` — month navigation row `<div>`<br>`previousMonthButton` `__previous-month-button` — (`labels.previousMonth`)<br>`heading` `__heading` — month `<h2>`<br>`nextMonthButton` `__next-month-button` — (`labels.nextMonth`)<br>`grid` `__grid` — the calendar's `role="grid"` element<br>`weekday` `__weekday` — each weekday header cell<br>`day` `__day` — each day `<button>` | — |
| `swatchPickerClassNames` | `wave-swatch-picker` | `role="radiogroup"` `<div>` | `swatch` `__swatch` — each `role="radio"` `<button>` (`items`) | — |
| `colorPickerClassNames` | `wave-color-picker` | `role="group"` `<div>` | `opacityLabel` `__opacity-label` — the default layout's opacity caption `<span>` (`showOpacity`, `labels.opacity`)<br>`opacityValue` `__opacity-value` — its percentage readout `<span>` (the members below carry their own classes) | — |
| `colorPickerAreaClassNames` **0.8** | `wave-color-picker-area` | the ColorArea it renders | `thumb` `__thumb` | root `wave-color-area`; `thumb` `wave-color-area__thumb` |
| `colorPickerSliderClassNames` **0.8** | `wave-color-picker-slider` | the ColorSlider it renders | `rail` `__rail`<br>`thumb` `__thumb` | root `wave-color-slider`; `wave-color-slider__rail`, `wave-color-slider__thumb` |
| `colorPickerAlphaSliderClassNames` **0.8** | `wave-color-picker-alpha-slider` | the AlphaSlider it renders | `rail` `__rail`<br>`thumb` `__thumb` | root `wave-alpha-slider`; `wave-alpha-slider__rail`, `wave-alpha-slider__thumb` |
| `colorPickerHexFieldClassNames` **0.8** | `wave-color-picker-hex-field` | the field's outer element (0.7: the `<label>` around caption and input) | `label` `__label` — caption `<span>` (`labels.hex`)<br>`input` `__input` — hex `<input>` (`labels.hexInput`)<br>`errorMessage` `__error-message` — error `<span>` (`labels.hexError`) | — |
| `colorPickerSwatchesClassNames` **0.8** | `wave-color-picker-swatches` | the SwatchPicker it renders (0.7: the presets SwatchPicker) | `swatch` `__swatch` | root `wave-swatch-picker`; `swatch` `wave-swatch-picker__swatch` |
| `colorPickerPreviewClassNames` **0.8** | `wave-color-picker-preview` | preview `<div>` (0.7 `data-color-preview`) | — | — |
| `colorAreaClassNames` **0.8** | `wave-color-area` | the area element (`role="group"`) | `thumb` `__thumb` (the two hidden range inputs are not parts) | — |
| `colorSliderClassNames` **0.8** | `wave-color-slider` | the slider element | `rail` `__rail`<br>`thumb` `__thumb` (the native input is not a part) | — |
| `alphaSliderClassNames` **0.8** | `wave-alpha-slider` | the slider element | `rail` `__rail`<br>`thumb` `__thumb` | — |
| `ratingClassNames` | `wave-rating` | `role="radiogroup"` `<div>` | `star` `__star` — each `role="radio"` `<button>` (`labels.star`)<br>`icon` `__icon` — its star `<svg>` (planned `icon` slot, P4-03) | — |
| `ratingDisplayClassNames` | `wave-rating-display` | `role="img"` `<div>` | `star` `__star` — each star `<span>` (the outer span of a partly filled star)<br>`icon` `__icon` — the star `<svg>`s (planned `icon`, P4-03)<br>`value` `__value` — value `<span>` (`showValue`, `compact`)<br>`count` `__count` — `<span>` (`count`) | — |

### layout

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `cardClassNames` | `wave-card` | the rendered element (`as`, default `<div>`) | `checkbox` `__checkbox` — built-in `<input type="checkbox">` (`selectionControl="checkbox"`, `selectLabel`; planned `checkbox` slot, P8-05)<br>`checkmark` `__checkmark` — corner check `<svg>` of a selected card (`selected`) | — |
| `cardHeaderClassNames` | `wave-card-header` | the rendered element | `title` `__title` — `<div>` (`title`)<br>`subtitle` `__subtitle` — `<div>` (`subtitle`) | — |
| `cardBodyClassNames` | `wave-card-body` | the rendered element | — | — |
| `cardFooterClassNames` | `wave-card-footer` | the rendered element | — | — |
| `accordionClassNames` | `wave-accordion` | `<div>` | — | — |
| `accordionItemClassNames` | `wave-accordion-item` | `<div>` | — | — |
| `accordionTriggerClassNames` | `wave-accordion-trigger` | the `<button>` | `heading` `__heading` — the `<h1>`–`<h6>` around the button (`headingLevel`; the Item renders it when a wrapper surrounds the Trigger)<br>`expandIcon` `__expand-icon` — chevron `<svg>` | — |
| `accordionPanelClassNames` | `wave-accordion-panel` | `role="region"` `<div>` (the plain `<div>` of a misplaced Panel) | — | — |
| `tabListClassNames` | `wave-tab-list` | the `role="tablist"` `<div>` (inside a wrapper with no class that also holds the panels) | — | — |
| `tabListTabClassNames` | `wave-tab-list-tab` | `role="tab"` `<button>` | — | — |
| `tabListPanelClassNames` | `wave-tab-list-panel` | `role="tabpanel"` `<div>` | — | — |
| `tabListPanelsClassNames` | `wave-tab-list-panels` | `<div>` | — | — |
| `treeClassNames` | `wave-tree` | `role="tree"` `<div>` | — | — |
| `treeItemClassNames` | `wave-tree-item` | `role="treeitem"` `<div>` | `row` `__row` — the row `<div data-tree-row>`<br>`expandIcon` `__expand-icon` — the chevron (and the **0.8** `expandIcon` slot)<br>`indicator` `__indicator` — **0.8** drawn checkbox or radio (selection modes)<br>`icon` `__icon` — `<span>` (`icon`)<br>`label` `__label` — `<span data-tree-label>` (children)<br>`iconAfter` `__icon-after` — **0.8** (`iconAfter`)<br>`aside` `__aside` — **0.8** (`aside`)<br>`actions` `__actions` — **0.8** the row's own toolbar element (`actions`; not the public Toolbar, D26)<br>`group` `__group` — `role="group"` `<div>` of nested items | — |
| `treePersonaLayoutClassNames` **0.8** | `wave-tree-persona-layout` | its root `<span>` | `media` `__media` — (`media`)<br>`main` `__main` — the name (children)<br>`description` `__description` — (`description`) | — |
| `carouselClassNames` | `wave-carousel` | `role="region"` `<div>` (a plain `<div>` without slides) | `autoPlayButton` `__auto-play-button` — Pause/Start `<button>` (`autoPlay`, `autoPlayLabels`)<br>`track` `__track` — moving `<div>` of slides<br>`slide` `__slide` — each `role="group"` slide wrapper (`labels.slide`)<br>`previousButton` `__previous-button` — (`labels.previous`)<br>`nextButton` `__next-button` — (`labels.next`)<br>`picker` `__picker` — `role="group"` of picker buttons (`labels.picker`)<br>`pickerButton` `__picker-button` — each picker `<button>` (`labels.slide`)<br>`pickerIndicator` `__picker-indicator` — its dot `<span>` | — |
| `carouselItemClassNames` | `wave-carousel-item` | `<div>` | — | — |
| `overflowClassNames` | `wave-overflow` | `<div>` | `overflowButton` `__overflow-button` — `<div data-overflow-button>` around what `overflowButton` renders | — |
| `overflowItemClassNames` | `wave-overflow-item` | `<div>` | — | — |
| `stackClassNames` | `wave-stack` | the rendered element | — | — |
| `flexClassNames` | `wave-flex` | the rendered element | — | — |
| `gridClassNames` | `wave-grid` | the rendered element | — | — |

### navigation

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `breadcrumbClassNames` | `wave-breadcrumb` | `<nav>` | `list` `__list` — `<ol>`<br>`listItem` `__list-item` — each `<li>` around an item<br>`divider` `__divider` — separator `<svg data-wave-breadcrumb-separator>` (planned `divider` slot, P9-02) | — |
| `breadcrumbItemClassNames` | `wave-breadcrumb-item` | `<a>`, `<button>`, `<span>` (text, current), or the `asChild` element | `icon` `__icon` — `<span>` (`icon`) | — |
| `menuClassNames` | `wave-menu` | the static menu's `role="menu"` `<div>` (a popup menu renders none) | — | — |
| `menuItemClassNames` | `wave-menu-item` | `role="menuitem"` `<div>` | `checkmark` `__checkmark` — check column `<span data-menu-checkmark>` (only the checkable variants render it)<br>`icon` `__icon` — `<span data-menu-icon>` (`icon`)<br>`content` `__content` — label `<span>` (children)<br>`shortcut` `__shortcut` — `<span>` (`shortcut`)<br>`submenuIndicator` `__submenu-indicator` — chevron `<svg>` of a submenu trigger item | — |
| `menuItemCheckboxClassNames` | `wave-menu-item-checkbox` | `role="menuitemcheckbox"` `<div>` | `checkmark` `__checkmark` — check column (`checkmark`)<br>`icon` `__icon`, `content` `__content`, `shortcut` `__shortcut` — as `Menu.Item` | root `wave-menu-item`; parts `wave-menu-item__checkmark`/`__icon`/`__content`/`__shortcut` |
| `menuItemRadioClassNames` | `wave-menu-item-radio` | `role="menuitemradio"` `<div>` | as `Menu.ItemCheckbox` | root `wave-menu-item`; parts as `Menu.ItemCheckbox` |
| `menuItemSwitchClassNames` | `wave-menu-item-switch` | `role="menuitemcheckbox"` `<div>` | `icon` `__icon`, `content` `__content`, `shortcut` `__shortcut` — as `Menu.Item`<br>`track` `__track` — switch `<span data-menu-switch>`<br>`thumb` `__thumb` — its thumb `<span>` | root `wave-menu-item`; `icon`/`content`/`shortcut` `Menu.Item`'s |
| `menuItemLinkClassNames` | `wave-menu-item-link` | the `role="menuitem"` link (`<a>`, or `as`) | `icon` `__icon`, `content` `__content`, `shortcut` `__shortcut` — as `Menu.Item` | root `wave-menu-item`; parts `Menu.Item`'s |
| `menuDividerClassNames` | `wave-menu-divider` | `role="separator"` `<div>` | — | — |
| `menuPopoverClassNames` | `wave-menu-popover` | portaled `role="menu"` `<div>` | — | — |
| `menuGroupClassNames` | `wave-menu-group` | `role="group"` `<div>` | — | — |
| `menuGroupHeaderClassNames` | `wave-menu-group-header` | `<div>` | — (column spacers are not parts) | — |
| `menuSplitGroupClassNames` | `wave-menu-split-group` | `role="group"` `<div>` | — | — |
| `navClassNames` | `wave-nav` | `<nav>` | `list` `__list` — its `<ul>` | — |
| `navCategoryClassNames` | `wave-nav-category` | `<li>` | `button` `__button` — toggle `<button>`<br>`icon` `__icon` — `<span>` (`icon`)<br>`label` `__label` — `<span>` (`label`)<br>`expandIcon` `__expand-icon` — chevron `<svg>` (planned slot, P10-01)<br>`list` `__list` — `<ul>` of sub-items | — |
| `navItemClassNames` | `wave-nav-item` | `<a>` (with `href`) or `<button>` | `listItem` `__list-item` — the `<li>` it renders around the root<br>`icon` `__icon` — `<span>` (`icon`)<br>`content` `__content` — label `<span>` (children) | — |
| `navSubItemClassNames` | `wave-nav-sub-item` | `<a>` or `<button>` | `listItem` `__list-item` — its `<li>` | — |
| `paginationClassNames` | `wave-pagination` | `<nav>` | `list` `__list` — `<ol>`<br>`listItem` `__list-item` — each `<li>`<br>`firstButton` `__first-button`, `previousButton` `__previous-button`, `pageButton` `__page-button`, `nextButton` `__next-button`, `lastButton` `__last-button` — the buttons (`getItemAriaLabel` item types)<br>`ellipsis` `__ellipsis` — "…" `<span>` | — |
| `stepperClassNames` | `wave-stepper` | `role="group"` `<div>` | `list` `__list` — `<ol role="list">` | — |
| `stepperStepClassNames` | `wave-stepper-step` | the step's root `<div>` (inside its `<li>`) | `listItem` `__list-item` — the `<li>`<br>`button` `__button` — `role="button"` `<div>`<br>`indicator` `__indicator` — circle `<span>`<br>`icon` `__icon` — `icon` slot `<span>` inside it (`icon`)<br>`label` `__label` — `<span>` (`label`)<br>`description` `__description` — `<span>` (`description`)<br>`connector` `__connector` — `<div data-wave-stepper-connector>` | — |

### overlays

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `dialogContentClassNames` | `wave-dialog-content` | the surface (`role="dialog"`/`"alertdialog"`) | `backdrop` `__backdrop` — fixed backdrop `<div>` around the surface (planned `backdrop` slot, P6-06)<br>`closeButton` `__close-button` — built-in Close Button (`closeLabel`; planned `closeButton` slot, P6-06)<br>`body` `__body` — scrolling body `<div>` (children) | `closeButton` `wave-button`; the `title` prop's `<h2>` `wave-dialog-title` |
| `dialogTitleClassNames` | `wave-dialog-title` | `<h2>` | — | — |
| `dialogFooterClassNames` | `wave-dialog-footer` | `<div>` | — | — |
| `popoverContentClassNames` | `wave-popover-content` | portaled `role="dialog"` surface | `beak` `__beak` — `<div data-wave-popover-arrow>`<br>`title` `__title` — `<h2>` (`title`) | — |
| `tooltipClassNames` | `wave-tooltip` | the wrapper `<span>` around the child | `content` `__content` — portaled `<span data-wave-tooltip-surface>` (`content`) | — |
| `drawerClassNames` | `wave-drawer` | the portaled panel (`role="dialog"`), while open | `backdrop` `__backdrop` — fixed backdrop `<div>`<br>`header` `__header` — header row `<div>` (title and Close)<br>`closeButton` `__close-button` — Close Button (`closeLabel`)<br>`body` `__body` — scrolling body `<div>` (children) | `closeButton` `wave-button`; the `title` prop's `<h2>` `wave-drawer-title` |
| `drawerTitleClassNames` | `wave-drawer-title` | `<h2>` | — | — |
| `teachingPopoverClassNames` | `wave-teaching-popover` | the `role="dialog"` surface (portaled with `target`) | `beak` `__beak` — `<div data-wave-teaching-popover-arrow>` (`target`)<br>`closeButton` `__close-button` — Close Button (`closeLabel`)<br>`title` `__title` — `<h3>` (`steps[].title`)<br>`body` `__body` — `<div>` (`steps[].body`)<br>`footer` `__footer` — bottom row `<div>`<br>`dot` `__dot` — each `<span data-wave-teaching-popover-dot>`<br>`backButton` `__back-button` — Back Button (`labels.back`)<br>`nextButton` `__next-button` — Next/Done Button (`labels.next`, `labels.done`) | `closeButton`, `backButton`, `nextButton` `wave-button` |

### table

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `tableClassNames` | `wave-table` | the `<table>` element | `container` `__container` — scroll wrapper `<div>` (`containerProps`) | — |
| `tableHeaderClassNames` | `wave-table-header` | `<thead>` | — | — |
| `tableHeaderCellClassNames` | `wave-table-header-cell` | `<th>` | — | — |
| `tableBodyClassNames` | `wave-table-body` | `<tbody>` | — | — |
| `tableRowClassNames` | `wave-table-row` | `<tr>` | — | — |
| `tableCellClassNames` | `wave-table-cell` | `<td>` | — | — |
| `dataGridClassNames` | `wave-data-grid` | the grid element (`role="grid"` on the native table) | `container` `__container` — wrapper `<div>` (`containerProps`) | — |
| `dataGridHeaderClassNames` | `wave-data-grid-header` | `<thead>` | `selectionCell` `__selection-cell` — the selection column's cell in each header row (planned `DataGrid.SelectionCell`, P9-04)<br>`selectAllCheckbox` `__select-all-checkbox` — its `<input type="checkbox">` (`labels.selectAll`) | — |
| `dataGridHeaderCellClassNames` | `wave-data-grid-header-cell` | `<th>` | `button` `__button` — sort `<button>` (`sortable`)<br>`sortIcon` `__sort-icon` — direction `<svg>` (planned `sortIcon` slot, P9-03) | — |
| `dataGridBodyClassNames` | `wave-data-grid-body` | `<tbody>` | — | — |
| `dataGridRowClassNames` | `wave-data-grid-row` | `<tr>` | `selectionCell` `__selection-cell` — selection `<td>` (selectable grids)<br>`selectionControl` `__selection-control` — its checkbox or radio `<input>` (`selectionLabel`) | — |
| `dataGridCellClassNames` | `wave-data-grid-cell` | `<td role="gridcell">` | — | — |

### typography, provider, portal, motion

| Constant | Root class | Root element | Parts | Also carries |
|---|---|---|---|---|
| `textClassNames` | `wave-text` | the rendered element (`as`, default `<span>`) | — | — |
| `waveProviderClassNames` | `wave-root` (existing) | the themed `<div>` | — | — |
| `portalClassNames` | `wave-portal` (existing) | the portal wrapper `<div>` (it also takes Portal's `className`) | — | — |

### Public components rendered inside another (D5, second clause)

They carry their own classes plus the parent's part class: SplitButton's two halves; the Buttons that `Dialog.Content`, Drawer and TeachingPopover render; the Options that TagPicker renders; Persona's built-in Avatar; the ColorPicker members, which render the standalone color parts and SwatchPicker (variants of them in 0.8). Not embedded: the consumer's own elements (AvatarGroup members, the `Menu.SplitGroup` halves, Combobox and Dropdown options); TagPicker's tags (not Tag) and DataGrid's selection inputs (not Checkbox); the content of a part wrapper (Persona's `status` PresenceBadge, the Toast inside the Toaster's container); Portal wrappers.

### No constant

- `Dialog`, `Popover`, `Presence`: they render no element of their own (context providers; Presence clones its child).
- `MenuTrigger`, `PopoverTrigger`, `DialogTrigger`, `DialogClose`, `DrawerTrigger`, `DrawerClose`, `ToastClose` (**0.8**): they clone their child (judgement 28 covers their wrapper span).
- `RadioItem` → `radioGroupItemClassNames`; `ComboboxOption`, `DropdownOption` → `optionClassNames`; `ComboboxOptionGroup`, `DropdownOptionGroup` → `optionGroupClassNames`; `TableHead` (deprecated; renders TableHeader) → `tableHeaderClassNames`; `TableHeadCell` (deprecated) → `tableHeaderCellClassNames`.
- Not components: `useToastController`, `useWaveTheme`, `getThemeClassName`, `useIsOverflowing`, `useOverflowMenu`, `useIsOverflowItemVisible`.

### Judgement calls

**Variants and embedding**

1. ToggleButton, CompoundButton, MenuButton and `Toolbar.Button` render Button, and `Toolbar.ToggleButton` and `Toolbar.RadioButton` render ToggleButton, so each carries the classes of every component it renders through, on its root and on its icon.
2. `Menu.ItemCheckbox`, `ItemRadio`, `ItemSwitch` and `ItemLink` do not render `Menu.Item`, but they share its element kind, `menuItemClasses` and `MenuItemRow`, so they are variants and carry `wave-menu-item` plus the matching part classes.
3. `menuItemClassNames` lists `checkmark` although a plain `Menu.Item` renders only a hidden placeholder there, so `.wave-menu-item__checkmark` matches the check column of every checkable item.
4. CounterBadge carries `wave-badge` (the same pill and Badge's shared color map). PresenceBadge does not: it has its own presence tokens, ring and glyph (Fluent builds it on Badge).
5. SplitButton's menu half is a plain Button in WaveUI (Fluent uses a MenuButton), so it carries `wave-button` only.
6. None of these renders through the other component or shares its styles, so none carries its classes: `Toolbar.Divider` and `Menu.Divider` (no `wave-divider`); `Nav.SubItem` (no `wave-nav-item`); TimePicker's options (no `wave-option`); `Menu.Popover` (no `wave-menu`; to style every menu list, target `.wave-menu, .wave-menu-popover`).
7. TagPicker's tags are `<div role="listitem">`, not Tag, and DataGrid's selection controls are native inputs, not Checkbox, so neither carries those components' classes.
8. AvatarGroup's members and the `Menu.SplitGroup` halves are the consumer's elements: AvatarGroup's class goes on its own wrapper `<span>` (`item`), and SplitGroup's children get nothing.
9. Persona's `badge` class is on the positioning span that holds either the `badge` slot or the PresenceBadge rendered from `status`; that PresenceBadge keeps only `wave-presence-badge`. The Toast inside the Toaster keeps only `wave-toast`; its 0.8 container carries `wave-toaster__toast`.
10. Portal wrappers that components render keep only `wave-portal`. Compound members that a root renders itself keep only their own member classes (`Accordion.Item`'s fallback Trigger and Panel, DataGrid's header generated from `columns`).

**Where classes land**

11. Two elements carry two classes in one layout: Avatar `visual` names the circle in both layouts (the root without `badge`, the inner span with one); Input `input` names the `<input>` also when the input is the root (P13-01's `root`/`input`).
12. These parts sit outside the `className` target but keep their part class: `Dialog.Content`'s and Drawer's `backdrop`; `AccordionTrigger`'s `heading`; `NavItem`'s, `NavSubItem`'s and `StepperStep`'s `listItem`; Table's and DataGrid's `container`; ProgressBar's `label`; the sibling `errorMessage` of Input, Select and Textarea.
13. The heading that `Dialog.Content`'s and Drawer's `title` prop renders carries `wave-dialog-title`/`wave-drawer-title` instead of a separate part (the rule of Toast's `title` prop rendering through `Toast.Title`). `Popover.Content` has no Title part, so its heading is the `title` part.
14. Drawer's root class goes on the panel, which exists only while the drawer is open; the triggers it renders in place are the consumer's. Menu's root class exists only on the static menu.
15. DataGrid's selection column is split by section: `DataGrid.Header` owns a header row's selection cell and the select-all checkbox (also when a `DataGrid.Row` inside the header renders that cell); `DataGrid.Row` owns the body selection cell and its control.

**Key names**

16. Tag, MessageBar and SearchBox share one dismiss vocabulary: `dismissButton` for the wired button and `dismissIcon` for what the slot renders inside it (or the default glyph). MessageBar and SearchBox name their slot `dismiss`, but C-SLOTS makes that slot the button's content, the same element as Tag's `dismissIcon`.
17. The built-in Close Buttons named by `closeLabel` (`Dialog.Content`, Drawer, TeachingPopover) are `closeButton`, after Dialog's planned slot (P6-06), apart from the inline `dismissButton` family.
18. Every expand chevron is `expandIcon` (Combobox, TimePicker, Dropdown, AccordionTrigger, NavCategory, TreeItem), after the existing and planned `expandIcon` slots; the submenu chevron is Fluent's `submenuIndicator`.
19. Check glyphs are `checkmark` in menus and on Card (Menu's `checkmark` prop); in listbox options they are `checkIcon` (Option's planned slot, P5-03), and TimePicker's options follow Option.
20. Children wrappers use three keys: `content` (menu items, Fluent's MenuItem name; Option, ListItem, NavItem, Toast's text column), `primaryText` (wrappers paired with a `secondaryText` line: Tag, Persona, CompoundButton) and `label` (wrappers a `label` prop fills, or that are their item's `aria-labelledby` target: Divider, TreeItem, StepperStep).
21. So TreeItem's text span is `label`, not TreeItemLayout's `main`; `Tree.PersonaLayout` keeps Fluent's `main` next to its Fluent-named `media` and `description`.
22. TreeItem's drawn selection box is `indicator` (the Checkbox and Radio key, and P3-06's wording), not Fluent's `selector`.
23. Toast's text column is `content`, not `body`, so it cannot be confused with `Toast.Body` (`wave-toast-body`); MessageBar's text column is `body`, after Fluent's MessageBarBody.
24. InfoLabel's popup is `info` and Tooltip's surface is `content`, after the props that fill them (also Fluent's slot names); every other internal popup is `surface`.
25. Keys taken from planned slots: Avatar `initials` (P8-01), Persona `primaryText` (P8-03), AvatarGroup `item` (P8-02); Option `checkIcon` and Dropdown `expandIcon` (P5-03); Card `checkbox` (P8-05); Breadcrumb `divider` (P9-02, although its marker says "separator"); Rating and RatingDisplay `icon` (P4-03); DataGrid `sortIcon` (P9-03) and `selectionCell` (P9-04); TagPicker `control` and `group` (after TagPicker.Control and TagPicker.Group, P6-04), its popup list staying `listbox` like the other pickers.

**Exclusions**

26. A glyph that is the whole, uncontrolled content of a button part gets no class (style it through the button's class): Toast's dismiss glyph, the clear buttons, SpinButton's steps, the Carousel, Pagination and DatePicker navigation, InfoLabel's info glyph, the Checkbox check, the radio dot and the swatch check.
27. Layout wrappers get no class: the picker rows around the input and its buttons; Field's horizontal column; TabList's outer wrapper around the tablist and panels; ProgressBar's `showLabel` wrapper; Persona's avatar and text columns, and Stepper's text column; TeachingPopover's dot and action rows; `DataGrid.HeaderCell`'s content span when the column is not sortable; RatingDisplay's clipping span. CompoundButton's text column is kept (Fluent's `contentContainer` slot, and an existing marker).
28. Trigger and close parts get no constant. With `asChild={false}`, or the automatic fallback for a child that does not forward its ref, they render a wrapper `<span>` that takes the part's forwarded `className`; in the default mode the element is the consumer's.
29. Spinner's `label` keeps its class while it is visually hidden (without `labelVisible`): it is the same element in both states.
30. SearchBox's `contentBefore` and `contentAfter` sit on the wrapper spans that hold the default search icon or the slot (Fluent's `contentBefore`); Input's sit on the slot span itself, which has no wrapper.

**Settled by the spec**

31. `Tree.Item` `actions` renders its own toolbar element, not the public Toolbar (its tab stop follows the tree's active item and `navigationMode`, which the public Toolbar cannot do; D26), so it carries no `wave-toolbar`. `ColorPicker.HexField` keeps 0.7's own caption and input (not the public Input or Label), so it carries neither `wave-input` nor `wave-label`.
32. AlphaSlider does not carry `wave-color-slider`: it is a sibling component, not a ColorSlider channel, even where the two share internal code.
33. The default layout's opacity row keeps its caption and percentage readout (D21): `colorPickerClassNames` has `opacityLabel` and `opacityValue`, applied by F3 to the 0.7 elements.
34. `Toast.Title` has no `media` slot (D9); the status icon is the Toast root's `icon` part.
35. InfoLabel's `label` text renders as a bare text node, so it has no class until P4-04 renders a `<label>`.
36. No component or part produces the reserved scope classes `wave-root`, `wave-portal`, `wave-light`, `wave-dark` or `wave-high-contrast`, except the two roots that own them (D3); the registry test checks it.
37. The internal `buttonClassName()` of `buttonStyles.ts` differs from the public `buttonClassNames` by one letter. It is not renamed in 0.8 (internal; `integration.test.tsx` pins that it stays private); the registry module's JSDoc points out the difference.

### Existing marker attributes

The `data-wave-*` markers stay (§1.2 rule 6); the class that now lands on the same element:

| Marker | Element | Class that lands there |
|---|---|---|
| `data-wave-theme` | WaveProvider root | `wave-root` (root, unchanged) |
| `data-wave-portal` | Portal wrapper | `wave-portal` (root, unchanged) |
| `data-wave-focus-trap-allow` | Toaster viewport (the only element that sets it) | `wave-toaster` (root) |
| `data-wave-toast` | 0.7: the Toast root rendered by the Toaster; 0.8: the toast container (D10) | 0.7 `wave-toast`; 0.8 `wave-toaster__toast` (the focus fallback reads the marker on the viewport's direct children, so it moves with the container) |
| `data-wave-compound-content` | CompoundButton text column | `wave-compound-button__content-container` |
| `data-wave-spinner-ring` | Spinner ring | `wave-spinner__spinner` |
| `data-wave-spinner-label` | Spinner label | `wave-spinner__label` |
| `data-wave-stepper-connector` | step connector | `wave-stepper-step__connector` |
| `data-wave-breadcrumb-separator` | separator `<svg>` | `wave-breadcrumb__divider` |
| `data-wave-listbox-surface` | listbox popup | `wave-combobox__surface`, `wave-dropdown__surface` or `wave-tag-picker__surface`, by host |
| `data-wave-infolabel-surface` | InfoLabel popup | `wave-info-label__info` |
| `data-wave-tagpicker-control` | TagPicker tag area | `wave-tag-picker__control` |
| `data-wave-tagpicker-remove` | tag remove button | `wave-tag-picker__remove-button` |
| `data-wave-popover-arrow` | `Popover.Content` beak | `wave-popover-content__beak` |
| `data-wave-teaching-popover-arrow` | TeachingPopover beak | `wave-teaching-popover__beak` |
| `data-wave-teaching-popover-dot` | step dot | `wave-teaching-popover__dot` |
| `data-wave-tooltip-surface` | tooltip surface | `wave-tooltip__content` |
| `data-wave-hidden-input` | HiddenInput | none (never a part) |
| `data-wave-announcer` | `useAnnounce`'s global live region | none (not a component element) |
| `data-wave-icon` | every internal glyph `<svg>` | where the `<svg>` itself is the part: `wave-menu-button__menu-icon`, `wave-avatar__icon`, `wave-presence-badge__icon`, `wave-option__check-icon`, `wave-card__checkmark`, `wave-dropdown__expand-icon`, `wave-accordion-trigger__expand-icon`, `wave-tree-item__expand-icon`, `wave-nav-category__expand-icon`, `wave-menu-item__submenu-indicator`, `wave-breadcrumb__divider`, `wave-rating__icon`, `wave-rating-display__icon`, and the default dismiss glyphs `wave-tag__dismiss-icon`, `wave-message-bar__dismiss-icon`, `wave-search-box__dismiss-icon`; anywhere else the glyph sits inside a part or is excluded |

Internal structural markers that coincide with parts: `data-tree-row` → `wave-tree-item__row`; `data-tree-label` → `wave-tree-item__label`; `data-menu-checkmark` → `wave-menu-item__checkmark`; `data-menu-icon` → `wave-menu-item__icon`; `data-menu-switch` → `wave-menu-item-switch__track`; `data-menu-split-group` → `wave-menu-split-group` (root); `data-list-action` → `wave-list-item__action`; `data-selection-cell` → `wave-data-grid-header__selection-cell` / `wave-data-grid-row__selection-cell`; `data-overflow-button` → `wave-overflow__overflow-button`; `data-carousel-rotation` → `wave-carousel__auto-play-button`; `data-color-preview` → `wave-color-picker-preview` (0.8 root); `data-menu-column-space` → none (a placeholder).
