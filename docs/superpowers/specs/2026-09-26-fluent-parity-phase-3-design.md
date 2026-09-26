# WaveUI 0.8.0 — Fluent Parity Phase 3 Design (notifications, color and trees; stable class names)

> Date: 2026-09-26 · Branch: `feat/fluent-parity-phase-3` (from `main` bcbdb51, where 0.7.0 = Phase 2 is merged) · Package: `@mortenbrudvik/waveui` 0.7.0 → **0.8.0**
> Scope: Phase 3 of [`docs/ROADMAP.md`](../../ROADMAP.md): the stable class names P3-00 and the items P3-01 … P3-08 (P3-08, the toaster handle, is the roadmap's revision of 2026-09-26 on `docs/issues-4-7`, 7ba32ec, from GitHub issue #5; that branch merges to `main` before wave A). They close 4 high, 6 medium and 10 low gaps of the Fluent UI v9 comparison and mitigate one more (`buttons-29`, which P13-02 closes; D8) (§7).
> Inputs: the roadmap's Phase 3 section (items, sketches, guards, dependencies; §1 goals and naming; §2 principles; §3 process); the Phase 2 spec [`2026-09-26-fluent-parity-phase-2-design.md`](2026-09-26-fluent-parity-phase-2-design.md), the model for this document, and its §10 implementation notes; the verified gap entries `foundation-37`, `buttons-29`, `toast-*`, `toasttrigger-1`, `toaster-2`, `messagebar-*`, `colorarea-1`, `colorslider-1`, `colorpicker-*`, `alphaslider-1` and `tree-*`; Fluent 9.74.9 read at its source (`react-toast`, `react-message-bar`, `react-color-picker` 9.3.1, `react-tree`, `react-utilities` `SlotClassNames`, `react-conformance`'s static-class test, the RFC `static-classes-on-slots.md`); the WAI-ARIA Authoring Practices (slider, treeview) and React Aria's `useColorArea` model for the 2-D slider. Every API below was checked against the 0.7.0 source it changes: `Toast.tsx`, `MessageBar.tsx`, `MessageBar.status.tsx`, `ColorPicker.tsx`, `colorUtils.ts`, `SwatchPicker.tsx`, `Slider.tsx`, `Tree.tsx`, `Dialog.shared.tsx` (`useModalClosePart`), `usePresence.ts`, `usePreserveFocus.ts`, `useAnnounce.ts`, `lib/layers.ts` (Escape routing and the allow-listed Toaster region), `lib/types.ts`, `cn.ts`, `src/index.ts`, `src/test-utils.ts` (`testClassName`), `src/__tests__/conventions.test.ts`, `scripts/verify-dist.mjs` (server probe, tree-shaking probe, flat names) and `scripts/build-css.mjs`, plus an inventory of every public component, its root element and its inner parts.
> Maintainer rulings (binding, from the design review of 2026-09-26): the release is 0.8.0 with a new `## [0.8.0] - Unreleased` CHANGELOG section; the class names live in one central, server-safe registry (`src/lib/classNames.ts`) enforced by a gate rule, a `testSystemProps` check and a registry test (D2, D7); checks in a multi-select Tree **cascade** (D24); every toast in the Toaster keeps the built-in Dismiss button, rich ones included, with no opt-out in 0.8 (D11). The Phase 2 lead rulings carry over: Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, with an optional `details` argument); APG behaviour first; new surfaces mount through the presence core; no JS animation library, no runtime styles.
> Status: written after the design review of 2026-09-26 (six sections approved one by one), then revised after three reviews of the first draft (API conventions; accessibility and behaviour; the code, sequencing and verification against the 0.7.0 source). Every blocker and major point was applied; §9 lists the points not applied, or applied differently, and why. Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins. Seams that do not line up are resolved by INTEGRATION (§3). Approved by the maintainer on 2026-09-26, with every recommended answer of §8 accepted (roadmap §3, entry criteria); the remaining entry condition is the merge of `docs/issues-4-7` to `main` (§3).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F3-foundation` | the class-name registry `src/lib/classNames.ts` (every constant of Appendix A, including the parts the wave-B packages add), the classes applied to every existing component and part (with the `withPartClass` helper of `Button.slots.tsx` for the variants' icon classes, §1.2), the four enforcement layers (the conventions rule, the `testSystemProps` check, the registry test, the `verify-dist` checks), the entry export, the `id` of the visually hidden status text shared by Toast and MessageBar, the three pending lists that keep every gate green while wave B lands (§0.2 rule 24) | P3-00, plus the shared piece of P3-02 and P3-04 | wave A |
| `P3-toasts` | Toast, its new parts, the Toaster and the toaster handle, in the order P3-02 → P3-01 → P3-03 → P3-08 | P3-01, P3-02, P3-03, P3-08 | wave B |
| `P3-messagebar` | MessageBar, `MessageBar.Title`, `MessageBar.Actions`, the reflow | P3-04 | wave B |
| `P3-color` | `ColorArea`, `ColorSlider` and `AlphaSlider` (which bind to an enclosing ColorPicker), the composable ColorPicker and its picker-only parts (`HexField`, `Swatches`, `Preview`), the HSV conversions, `HsvColor` and `ColorPickerShape`, the public color helpers | P3-05 | wave B |
| `P3-tree` | Tree multi-select and the row content, in the order P3-06 → P3-07, with the `tabStop` option of `useRovingTabIndex` (P3-07) | P3-06, P3-07 | wave B |
| `INTEGRATION` | barrels (and `src/index.ts` for the color helpers), cross-package tests, public type tests, the Server Component regression cases of the new compounds, the story imports of the new modules, emptying the pending lists | — | wave C |
| `DOCS` | CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP | — | wave D |

§3 lists the exact files of each package. File ownership is disjoint within each wave.

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) and the Phase 2 rules 15–17 (no built-in motion, pointer tests, direction) apply unchanged, with F3 in place of F1/F2. In addition:

19. **Wave A is exclusive and touches every component.** `F3-foundation` is the only package of wave A. It may edit every module under `src/components/` to apply the classes (D4) and nothing else in them (no behaviour, markup or style change beyond the added classes and the `StatusText` `id`), `src/index.ts` (the registry export, D2), `src/__tests__/public-types.test.ts` (the registry lines) and any existing test whose exact class assertion the added classes break (§6.4). The lead commits it before wave B starts.
20. **The registry is frozen in wave B.** `src/lib/classNames.ts` has no owner in wave B (read only). Every new component or part created in wave B applies the constant Appendix A defines for it; a missing or wrong key is a change request to the lead, who edits the registry (the same rule as the Phase 2 Menu seam, rule 12).
21. **New compounds attach their own members.** `P3-toasts`, `P3-messagebar`, `P3-color` and `P3-tree` each own their compound module and attach their new parts there (`Toast.Title`, `MessageBar.Actions`, `ColorPicker.HexField`, `Tree.ItemPersonaLayout`), with the flat names re-exported from that module. The flat names reach `dist/index.mjs` only when INTEGRATION extends the barrels, so `F3-foundation` puts `'ColorPicker'`, `'MessageBar'` and `'Toast'` on `verify-dist`'s `PENDING_FLAT_EXPORTS` bridge (sorted; `checkFlatExports` reports them as planned until they become compounds), and `P3-tree` adds `'Tree'`, in its sorted place, in the commit that attaches `Tree.ItemPersonaLayout`: Tree is already a complete compound, which the bridge may not list before then (`checkFlatExports` reports a listed complete compound as an error). That line is the only change `P3-tree` makes to `scripts/verify-dist.mjs`. INTEGRATION empties the list (as Phase 2 did for Toolbar).
22. **Module splits keep one-way imports.** `P3-toasts` splits `Toast.tsx` and `P3-tree` splits `Tree.tsx` as `Menu.tsx` was split in 0.7: the compound module (`Toast.tsx`, `Tree.tsx`) holds the `Object.assign(…)` compound, its component JSDoc (C-DOCS) and the flat re-exports, and nothing imports it; the barrel keeps importing from it, so no barrel change is needed in wave B (D32). The compound module also re-exports every type the untouched barrel imports from it (`ToastProps`, `ToasterProps`, `ToastOptions`, `ToastController`, `ToastPosition` from `./Toast`; `TreeProps`, `TreeItemProps` from `./Tree`), and each package's `tsc` check (rule 8) includes its folder's barrel, so a broken re-export shows.
23. **Screen readers are part of the exit evidence.** jsdom cannot tell how a screen reader speaks a live region, a named group or `aria-checked="mixed"`; §6.3 lists the checks the lead runs with NVDA, JAWS, VoiceOver, TalkBack and Narrator, and each package names in its report the behaviours it could only assert as attributes. One check runs before wave B (the VoiceOver spike of §6.3, which decides a detail of P3-06).
24. **Pending lists keep every gate green between the waves.** Three lists, written by `F3-foundation` (and, for `'Tree'`, rule 21) and emptied by INTEGRATION: `PENDING_FLAT_EXPORTS` (`verify-dist`, rule 21); `PENDING_CLASS_NAMES` (`classNames.test.ts`: the Phase 3 constants and keys that wave B applies; an entry is skipped whether or not it has been applied yet, and the no-element list tolerates `ToastClose` before it exists, §1.4.3); `PENDING_PUBLIC_TYPES` (`public-types.test.ts`: the public type names of §4.3, which become reachable from the entry as soon as a wave-B prop uses them but are exported only in wave C, §1.5). Nothing else may go red between wave B and wave C.
25. **Stories of new modules import module paths in wave B** (Phase 1 rule 2: `stories/ColorArea.stories.tsx` imports `../src/components/input/ColorArea`), because the barrels are INTEGRATION's; INTEGRATION switches them to `'../src'` like every other story.

### 0.3 Design rulings

Binding for every package. Each ruling records why. The D-numbers are this spec's; earlier rulings are cited as "Phase 2 D17".

**Stable class names (P3-00)**

- **D1 — Wave A is one exclusive package, and the registry lists the Phase 3 parts before they exist.** `F3-foundation` applies classes to every component (about sixty modules), so nothing else can run beside it; it also writes the constants of the parts wave B creates (`toastTitleClassNames`, `colorAreaClassNames`, `treeItemPersonaLayoutClassNames`, …), which this spec fixes in Appendix A, so every wave-B package only applies them. *Why:* the roadmap sizes P3-00 L and runs it alone as the phase's foundation; a registry every package edits would break the disjoint file ownership of wave B, and the class names of the new parts are API that the spec, not an agent, decides.
- **D2 — The registry is one server-safe module, `src/lib/classNames.ts`, exported from the entry.** It imports nothing and holds one `export const <name>ClassNames = { … } as const` per public component and part (Appendix A); `src/index.ts` adds `export * from './lib/classNames'`. Components import their constants from it. The roadmap sketch exported the constants from the component modules; that is not done. *Why:* every module under `src/components` gets the `"use client"` banner, and a Server Component that imports a value from such a module receives a client reference that throws on any property access ("Cannot access X.root on the server", the stub `verify-dist`'s react-server probe already installs); `getThemeClassName` lives in `src/lib/theme.ts` for the same reason. A second option, co-located `*.classNames.ts` modules with a banner exception, was rejected at the design review: about sixty-five new files and a filename convention that the build, `verify-dist` and the Claude hook would all have to agree on.
- **D3 — Names.** The root class is `wave-` plus the kebab-cased flat export name (`Button` → `wave-button`, `CardHeader` → `wave-card-header`, `MenuItemCheckbox` → `wave-menu-item-checkbox`); a part class is `<root>__<kebab part key>` (`wave-button__icon`, `wave-tree-item__expand-icon`); the constant is the camel-cased flat name plus `ClassNames` (`cardHeaderClassNames`), with camel-cased part keys and `as const` string literal types. Two classes that exist today keep their names: WaveProvider's root is `wave-root` (`waveProviderClassNames = { root: 'wave-root' }`) and Portal's is `wave-portal` (`portalClassNames`); both are styled scopes of `base.css`. A public component that renders no element of its own gets no constant: Dialog, Popover, Presence and the parts that clone the consumer's element (`Menu.Trigger`, `Popover.Trigger`, `Dialog.Trigger`, `Dialog.Close`, `Drawer.Trigger`, `Drawer.Close`, the new `Toast.Close`). An alias shares its component's constant (`ComboboxOption` and `DropdownOption` use `optionClassNames`; a deprecated alias uses its replacement's). *Why:* Fluent's scheme (`fui-Button`, `fui-Button__icon`, `buttonClassNames`, checked by its conformance test for every component) in WaveUI's spelling; the `__` separator keeps a part class opaque to tailwind-merge, which splits class names on `-` and passes unknown classes through untouched (checked in its v3 source), and to Tailwind's scanner, which generates nothing for them; `wave-root` and `wave-portal` are already consumer-visible scope classes, and renaming them would break every app that targets them.
- **D4 — Where a class goes.** The root class goes on the element that receives the consumer's `className` (Input with slots: the wrapper; `RadioGroup.Item`: the label; Appendix A names the element of every component whose root is not obvious). A part is an element the component renders itself that a prop or slot fills or controls (icon, dismiss or clear button, expand icon, checkmark, secondary text, validation message, hint, badge, image) or that is visible structure (track, thumb, rail, indicator, surface, beak, backdrop, header, body, footer, separator line); hidden inputs, visually hidden text, live regions, column spacers and layout wrappers are not parts. Classes are applied by the component that renders the element — first in its `cn()` call, so the consumer's `className` still comes last and wins — never inside a shared style helper (`buttonClassName()`, `menuItemClasses`, `STATUS_*`, `pickerStyles`), which non-component elements also use. A slot part passes its class in `renderSlot`'s base classes, so it stays when a slot object swaps the element (`icon={{ as: 'img', … }}`). A module names its constants' members literally where it applies them, also when a shared renderer draws the element (`rootClassName={cn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}` passed to `MenuItemRow`), so the gate and the registry test can see them (§1.4). *Why:* one rule consumers can predict ("the stable class sits where my `className` lands"); a helper-applied class would land on internal buttons that are not a `Button`; the part vocabulary is what P13-01's `slotProps` will reuse.
- **D5 — Variants carry the base classes; a nested public component also gets its parent's part class.** A component built as a kind of another public component also carries the base component's root and matching part classes (Fluent's rule, observed in its styles hooks): ToggleButton's root is `wave-button wave-toggle-button`, its icon `wave-button__icon wave-toggle-button__icon`; Appendix A lists every variant (the button family and the Toolbar buttons, the menu item kinds, CounterBadge). A variant that hands its `icon` to Button passes it through `withPartClass(icon, className)` (`Button.slots.tsx`, generalising the `withIconBox` of `Toolbar.parts.tsx`), which wraps it in a slot object carrying the variant's icon class, so Button's own icon span carries both; Button gains no prop. A public component rendered inside another keeps its own classes and also gets the parent's part class: SplitButton's halves are `wave-button wave-split-button__primary-action-button` and `wave-button wave-split-button__menu-button`; Appendix A lists every such case. *Why:* `.wave-button` then styles every button a user sees as a button, and `.wave-split-button__menu-button` reaches one half without a structural selector.
- **D6 — No state classes.** State stays in `data-*` attributes and ARIA (C-CLASS); there is no `wave-button--checked`. *Why:* Fluent has none either, and a second state vocabulary would drift from the attributes the library already guarantees.
- **D7 — Enforcement in four layers.** (1) A conventions-gate rule `class-names`: a component module that assigns the `displayName` of a registered component must apply that constant's `root` (§1.4.1). (2) `testClassName`, which every `testSystemProps` call runs, asserts that the element receiving the consumer's `className` also carries the component's registered root class (§1.4.2): every component test checks it without a per-test change. (3) A registry test, `src/__tests__/classNames.test.ts`: every component-like public export has a constant or is on the no-element list, every constant follows D3's formula (or is one of the two exceptions), no class string repeats, every part key is applied somewhere in `src/components`, every constant is exported from the entry (§1.4.3). (4) `verify-dist`: every export of `dist/lib/classNames.mjs` is exported by `dist/index.mjs` with the same value (ESM and CJS), a Server Component can read the constants from the entry under `--conditions=react-server`, and an import of only `Button` keeps the literal `'wave-button'` and drops `'wave-dialog-content'` (a listed string that occurs in no dist module is an error, so the probe cannot pass vacuously) (§1.4.4). *Why:* the roadmap's exit criterion ("the conventions gate enforces the class-name rule"); a gate alone is a text match, so the runtime check in the component tests proves the class lands on the right element, and the registry test proves nothing is missing.
- **D8 — Stability, and `buttons-29`.** From 0.8 the class names are public API under the roadmap's principle 2: before 1.0 no class is removed; a renamed part, or a part that becomes a compound member of its own (AvatarGroup's `item`, TagPicker's `control` and `group` and DataGrid's `selectionCell` are named after planned members), keeps its old class next to the new one until 1.0 (CHANGELOG "Deprecated"); moving a class to another element is a "Changed" DOM entry; adding a class or a part is no change. `buttons-29` ("headless hooks and static class names are not public") is only half closed by P3-00: P3-00 **mitigates** it and P13-02 (public contexts and recomposition hooks) closes it; the roadmap is updated (§5.5). *Why:* Fluent's RFC treats its static classes as API ("changes to a slot's name, or removing a slot, are breaking changes"), and principle 2 allows no removal before 1.0; closing a gap whose second half remains open would misstate the parity.

**Toasts (P3-01, P3-02, P3-03)**

- **D9 — Toast parts.** `Toast` becomes a compound: `Toast.Title` (an `action` slot at the end of the title row), `Toast.Body` (a `subtitle` below the body), `Toast.Footer` (a row of actions) and `Toast.Close`, with the flat names `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`. The part that makes its child dismiss the toast is **`Toast.Close`**, not the sketch's `Toast.Trigger`; its JSDoc names Fluent's `ToastTrigger`. The status icon is replaced through a new `icon` slot on the `Toast` root (the status-icon slot rule, as `MessageBar.icon`), not through a `media` slot on `Toast.Title` as the sketch had both. The 0.7 `title` prop and plain children keep working and render through the Title and Body part elements (one styling hook for both forms); a `title` prop next to a `Toast.Title` part gives way to the part, with a development warning. All four parts read one per-toast context, which both the `Toast` root and the Toaster's container (D10) provide; outside both, a part's context hook throws in development (`reportMissingContext`, C-CONTEXT), so `Toast.Close` works in dispatched content without a `Toast` too. `Toast.Close` and the Dismiss button behave alike: they call the Toast's `onDismiss` first (when a Toast is there and has one), then the container's dismissal (in the Toaster). A consumer `id` on `Toast.Body` is the id the container's description points at (a generated one otherwise), as `useModalTitle` registers a Dialog title's id. *Why:* in WaveUI a `*.Trigger` part opens a surface (`Dialog.Trigger`, `Menu.Trigger`, `Popover.Trigger`) while `Dialog.Close` and `Drawer.Close` close one, so a dismissing `Toast.Trigger` would read as the opposite of what it does; one icon slot is enough, and it must live on the root because the 0.7 options form has no title part (Fluent's `media` is the intent icon itself); one context for both hosts keeps the parts' behaviour the same wherever the toast renders.
- **D10 — The toast container.** The Toaster renders every toast inside its own container element: `role="group"`, `tabIndex={-1}` (the keyboard shortcut can focus it; it is no Tab stop), `aria-labelledby` = the severity text and the title (the severity text alone while no title is registered) and `aria-describedby` = the body (its subtitle included), each only while a `Toast` inside has registered those parts (through the per-toast context, so a Toast rendered by the app's own wrapper component registers too; never a dangling id), the pause handlers, the Delete key and the presence attributes. Content without a `Toast` gets a visually hidden severity text from the dispatch options inside the container, so its severity is part of its content and name. The `Toast` visual inside the container is no live region (as in 0.7). A `Toast` rendered outside a Toaster stays its own live region and is not labelled (a named live region can have its name read before or after its content). *Why:* Fluent puts its role, labels and focusability on the same internal container (`ToastContainer`), because dispatched content is arbitrary; a context registration works at any depth, where a static scan of the dispatched element would miss a Toast inside the app's own component; naming the toast lets a focused toast announce "Error: Upload failed, group".
- **D11 — Every Toast in the Toaster shows the built-in Dismiss button** (maintainer ruling), the options form as in 0.7 and a dispatched `<Toast>` through the per-toast context, also inside the app's own wrapper component. Content without a `Toast` gets none; `Toast.Close` works inside it. There is no opt-out in 0.8; a `dismiss` slot can add one later without breaking anything (backlog `toaster-9`). *Why:* the 0.7 contract, a pointer path to dismiss a toast that never times out, and the design review's choice.
- **D12 — `dispatchToast` with content.** A second signature `dispatchToast(content: React.ReactNode, options?: ToastDispatchOptions): string` joins 0.7's `dispatchToast(options: ToastOptions): string`; the content signature is declared first and the options signature last, so types derived from the member (`Parameters<ToastController['dispatchToast']>`, which TypeScript takes from the last overload) stay 0.7's. The options form is recognised as `isSlotObject` recognises a slot object (`src/lib/slot.ts`): a plain object (prototype `Object.prototype` or `null`) without `$$typeof`; anything else is content (elements, portals, strings, numbers, arrays and other iterables, thenables). It returns the toast's id, as in 0.7 (Fluent's returns nothing). `ToastDispatchOptions` = `toastId` (as 0.7), `timeout`, `status` and `statusLabel`, and `announcement`. **`timeout`** defaults to 5000 ms, except for a toast with an action: content that renders an interactive element besides its Dismiss button (found after mount) stays until it is dismissed unless the dispatch passes `timeout`. The severity (politeness and the spoken prefix) comes from the `status` and `statusLabel` of the rendered `Toast`; the options' `status` and `statusLabel` apply only to content without a `Toast`, and a rendered `Toast` whose severity differs from a `status` the options pass explicitly warns once in development (`Toaster:status-conflict`). `ToastController['dispatchToast']` becomes an overloaded member (CHANGELOG "Types": a consumer that implements the interface, such as a test double, must accept content too). *Why:* keeps the 0.7 contract (the id) and API, and the derived types; the rendered Toast is what the user sees, so its severity must win, while arbitrary content needs the option (Fluent keeps severity only in the dispatch options); `isValidElement` alone would read a portal as options; a toast whose Undo vanishes after 5 seconds is a time limit people using a screen reader, a switch or voice control often cannot meet (WCAG 2.2.1; the region is the last thing in the page and the shortcut is optional), which is why Material extends a snackbar that has an action.
- **D13 — What screen readers hear.** A toast's text is added once to the Toaster's permanent live regions (0.7): the severity text, the title, the body (its subtitle included), then the labels of the toast's actions (the title's `action` and the footer's controls, never the Dismiss button), read from the rendered elements after the toast mounts (a layout effect of its container) by an accessible-text walk that skips `aria-hidden` and `hidden` subtrees and reads an image's `alt`; content without a title or body part is read whole the same way. `announcement` replaces everything but the severity text (`statusLabel: ''` drops that). `error` is assertive, every other status polite (0.7). Replacing a toast by its `toastId` announces it again (0.7). *Why:* the roadmap's acceptance ("Error: <title> <body>", read once); naming the actions tells people who cannot see the toast that it holds one (and, with D12, that it waits for them), as a MessageBar's content does; Fluent reads the raw `textContent`, which includes hidden text and misses `alt` text; reading the DOM after mount works for any content, where a text walk over React nodes cannot see what components render.
- **D14 — Toaster keyboard and pausing.** `shortcuts?: { focus?: (event: KeyboardEvent) => boolean }` (Fluent's shape): a `keydown` listener on the document; when `focus` returns `true` and a toast is shown, it prevents the default, remembers the focused element and focuses the container of the most recently dispatched toast that is shown and not dismissed. **Escape** in the toast region: the viewport's handler (after the consumer's `onKeyDown`) ignores an event whose target is not inside the viewport in the DOM (C-COMPOSE: an Escape pressed in a Menu, Popover or Dialog opened from a toast bubbles to it through the React tree), and it leaves Escape to the dismiss-layer stack while an open, Escape-enabled layer is anchored inside the viewport (`getOpenLayers()` and the layer's `getAnchor()`: a Tooltip on a toast's button, a Menu opened from a toast), so the first Escape closes that layer and the next one reaches the Toaster. Otherwise it prevents the default (so a Dialog under the toasts stays open: the dismiss-layer stack ignores a prevented Escape), returns focus to where it was before focus entered the toasts (0.7's focus-origin tracking, which the shortcut also sets) and dismisses every toast. **Delete or Backspace** on a focused container or inside it, except in an editable field and except for events whose target is not inside the container in the DOM, dismisses that toast; Backspace joins Fluent's Delete because it is the delete key of Mac keyboards (TagPicker removes a tag with either). **Pausing:** a pointer or focus anywhere in the region pauses every toast's timer (0.7 paused the hovered or focused toast only); a window in the background pauses them too (0.7). No arrow keys between toasts in 0.8 (ROADMAP §8.5). *Why:* the roadmap sketch; WaveUI's widgets consume Escape in the dismiss-layer stack's `document` listener, which runs after React's handlers at the portal containers, so only a DOM-containment check and the layer check keep the toasts from taking an Escape meant for a menu or a tooltip (WCAG 1.4.13 needs the tooltip dismissible in place); Fluent restores focus after Escape only when the toast was reached through its shortcut, and WaveUI already tracks the origin for every entry; the Toaster region counts as inside every dismiss layer (`ALLOW_OUTSIDE_SELECTOR`), so without `preventDefault()` an Escape in a toast would close the Dialog below; someone reading or operating one toast is reading the stack, which should not change under them (Fluent pauses all the toasts of a position on focus); Fluent's arrow navigation is marked as a stopgap in its own source.

- **D33 — The toaster handle** (P3-08). `createToaster(): ToasterHandle` lives in a new server-safe module, `src/lib/toaster.ts` (no React, no DOM; it imports only types), so a module that creates a handle can be imported anywhere, a Server Component included; `ToasterHandle` is the `ToastController` type and nothing more (the binding is internal). `<Toaster toaster={handle}>` binds one Toaster. Dispatches before a Toaster binds wait in the handle's queue; ids are returned at once; a dispatch on the server does nothing; a second Toaster does not take over a bound handle (development warning). *Why:* the roadmap entry (issue #5: query-cache callbacks, server-event handlers and shared helpers cannot call a hook, and an app's own toast store loses what the Toaster adds); a module under `src/components` would be a client reference in a Server Component (D2's reason); a queue loses nothing when a Toaster is still mounting or remounting, where a warning would drop the toast; one handle per Toaster replaces Fluent's string `toasterId` with a value the type system checks.

**MessageBar (P3-04)**

- **D15 — MessageBar parts are found by a static scan.** `MessageBar` becomes a compound with `MessageBar.Title` and `MessageBar.Actions` (flat `MessageBarTitle`, `MessageBarActions`). The bar sorts its children with `flattenChildren` and `isElementOfType` (Server Component references included): the first Title goes first in the text column, after the visually hidden severity text; every Actions part goes to the action area; the rest is the body. A part the scan cannot see (inside the app's own component) renders where it is and warns once (`MessageBar.Title:unscanned`, `MessageBar.Actions:unscanned`), detected through a context the bar provides to the parts it placed. A second Title renders as body content and warns (`MessageBar.Title:multiple`). The parts and their context live in `MessageBar.parts.tsx`, which never imports the compound module (D32). A consumer `id` on `MessageBar.Title` is the id a labelled bar points at (a generated one otherwise), as `useModalTitle` registers a Dialog title's id. *Why:* the bar must place Actions apart from the text (a different row in the multiline layout), which only a partition of its children can do; the scan works on the server (the Menu.Group precedent, Phase 2 D12).
- **D16 — A title labels the bar only when the bar is not a live region.** With the default roles (`alert` for warning and error, `status` otherwise) the bar is a live region, and the title is not wired as its name: it is read once as the first words of the content ("Warning: Update available. A new version is ready to install. Update now, Later"). With a non-live role that the consumer passes (`role="region"` for a notice that stays on the page, or `role="group"`) the title labels the bar through `aria-labelledby` pointing at the severity text and the title, so the severity stays in its name. A consumer `aria-label` or `aria-labelledby` always wins. A bar with `role="region"` and neither a title nor a consumer label warns once (`MessageBar:region-name`: a region is a landmark only with a name). *Why:* a live region with a name from the author can have that name read before or after its content ([a11ysupport.io, role=alert](https://a11ysupport.io/tech/aria/alert_role)), which would read the title twice; `role="region"` needs a name to be a landmark, which the title then provides. The roadmap sketch ("labels the bar through `aria-labelledby`") and Fluent (a non-live `role="group"` bar labelled by its title, announced through a separate announcer) differ; ROADMAP §8.3 records it.
- **D17 — MessageBar layout.** `layout?: 'auto' | 'singleline' | 'multiline'`, default `'auto'`; the root always renders `data-layout` with the layout in use (`singleline` or `multiline`; enumerated, Phase 1 D22). `singleline`: one row, icon · text · actions · Dismiss; the text wraps inside its column and is never clipped. `multiline`: icon · text (wrapping) · Dismiss on the first row, the actions on a row of their own under the text (grid placement); a bar without actions keeps 0.7's row exactly. The DOM order is the same in both layouts, icon, text, actions, Dismiss, so the Tab order is text, actions, Dismiss everywhere and a reflow never moves a focused element (Fluent reorders the DOM between its layouts, which moves the actions or the Dismiss button while one may have focus, and a moved node loses focus). `'auto'` with an Actions part renders the one-row layout on the server and on the first client render, with its text column `whitespace-nowrap` (not clipped); a ResizeObserver on the root then switches it to `multiline` while the text column overflows (`text.scrollWidth > text.clientWidth`), remembering the bar width the text needed (`root.clientWidth + text.scrollWidth − text.clientWidth`), and back to the one-row layout once the bar is at least that wide (Fluent's two-way rule), read through `useSyncExternalStore` (C-HOOKS). `'auto'` without Actions is `multiline`, the 0.7 look, with no observer. *Why:* the roadmap sketch and its acceptance ("SSR renders `singleline` for `auto` until measured"); a clipped (truncating) column never overflows, so measuring it, or the root around it, would never switch, and clipping text fails WCAG 1.4.10 and 1.4.4 at narrow widths and high zoom (Fluent's one-row text is `nowrap` without clipping for the same reason); a bar without actions has nothing to reflow, and measuring it would shift the layout of every 0.7 bar after hydration for no gain.

**Color (P3-05)**

- **D18 — `HsvColor`, `ColorPickerShape` and the public helpers.** `HsvColor = { h: number; s: number; v: number; a?: number }` with Fluent's ranges: `h` 0–360, `s`, `v` and `a` 0–1 (`a` left out means opaque), and `ColorPickerShape = Extract<Shape, 'rounded' | 'square'>` (the shape of ColorPicker and the three standalone parts); both live in `src/lib/types.ts`. A new server-safe module `src/lib/color.ts` exports `hsvToHex(color: HsvColor): string` and `hexToHsv(hex: string): HsvColor | null`. `hsvToHex` wraps `h` into [0, 360), clamps `s`, `v` and `a` to [0, 1] and writes lowercase `#rrggbb`, or `#rrggbbaa` when `a` is below 1 (ColorPicker's format). `hexToHsv` trims and matches case-insensitively (as `parseHexColor`), accepts `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa`, sets `a` only when the input has alpha digits, and returns `null` for anything else. *Why:* Fluent's type, so its recipes port; the standalone parts take `HsvColor`, and an app that keeps a hex string needs a conversion (Fluent ships none and its stories use an external library); a shared subset of `Shape` follows the `Extract<>` rule of `src/lib/types.ts`.
- **D19 — `ColorArea`.** `value`/`defaultValue`/`onValueChange(value: HsvColor)` (C-NAMING; Fluent's `color`/`onChange(event, data)` data carries only the event besides the color, so the second argument is left out in 0.8; the JSDoc names Fluent's props), `shape?: ColorPickerShape`, `labels`, `disabled`, and the value-control props `name`, `form`, `required` (C-FORMS: the hex of the color is submitted, and a form reset restores `defaultValue`; the same for `ColorSlider` and `AlphaSlider`). It edits saturation (x) and brightness (y) at the value's hue; hue and alpha pass through. **Structure:** the root is a `role="group"` holding a field layer (the gradient, `aria-hidden`), the thumb and two visually hidden native `<input type="range">` sliders, "Saturation" and "Brightness", each with `aria-roledescription="2D slider"` and an `aria-valuetext` (D22); the brightness input carries `aria-orientation="vertical"`. The root renders `data-disabled` while disabled. **One Tab stop:** the input used last (saturation at first) has `tabIndex=0`; on devices whose primary pointer is fine (`matchMedia('(pointer: fine)')`, read after mount, so the server renders this desktop model) the other input is `tabIndex=-1` and `aria-hidden`, so desktop screen readers list one 2-D slider; on touch-primary devices both stay exposed, so a touch screen reader can swipe each. **Keys** (the APG slider keys per axis, React Aria's 2-D model; Fluent has only plain arrows): ArrowLeft/ArrowRight move saturation by 1 (mirrored in RTL, through `getArrowIntent`), ArrowUp/ArrowDown brightness by 1, Shift with an arrow by 10, PageUp/PageDown brightness by 10, Home/End saturation to its minimum/maximum; focus (and the Tab stop) follows the axis to the matching input, so the channel that changed is announced. **Pointer:** a primary press (mouse, touch or pen) jumps the thumb to the point and focuses the input that has the Tab stop; dragging continues with pointer capture (`touch-action: none`). **RTL:** the x axis mirrors (saturation grows toward the reading direction's end): the field layer mirrors with `wave-rtl:-scale-x-100` and the thumb is placed with logical utilities. **Thumb:** 24×24 CSS pixels with a two-tone ring (the `background` and `foreground` tokens) that shows on any color, and a two-tone focus indicator (the `ring` outline around a `background` halo), since the one-color ring is the light theme's brand blue, the default color; in forced colors the field keeps its gradient (`forced-color-adjust: none` on the field only) and the ring and focus indicator use system colors. **Naming and routing** (C-ROUTING): the group is named by the consumer's `aria-labelledby` or `aria-label`, else the Field's label (`useFieldControl(…, { labelable: false })`), and keeps `aria-describedby`, `className`, `style`, `data-*` and `ref`; both inputs get `aria-invalid` and `aria-errormessage` (a group supports neither); `required` and `aria-required` go to the hidden input; `autoFocus`, `tabIndex` and `controlRef` go to the saturation input; the consumer's `onKeyDown` runs before the area's keys (C-COMPOSE). **Gradients** are inline custom-property strings built from the value (the only runtime colors, marked `// wave-allow-color:`), read by `bg-(image:--wave-color-area-gradient)`: a raw color in a class is a `raw-color` finding the gate never lets a component suppress. `onValueChange` fires on every step (key or pointer move) that changes the color. Inside a ColorPicker, an uncontrolled `ColorArea` binds to the picker (D21). *Why:* the roadmap's acceptance (arrows by 1, Shift by 10, RTL mirroring, `aria-valuetext` naming the color, forced colors); native range inputs let mobile screen readers adjust the value with swipes, which a `role="slider"` element cannot offer on iOS, while one Tab stop and one exposed slider keep desktop keyboards and screen readers from meeting two (React Aria's model); 24 px meets WCAG 2.5.8 (Fluent's thumb is 20 px); a focus ring must contrast with the color around it (WCAG 2.4.7, 1.4.11); Fluent's area does not mirror, which ROADMAP §8.3 records.
- **D20 — `ColorSlider` and `AlphaSlider`.** `ColorSlider`: `channel?: 'hue' | 'saturation' | 'value'` (default `'hue'`), `orientation?: Orientation` (default `'horizontal'`; C-NAMING, where Fluent has a `vertical` boolean), `value`/`defaultValue`/`onValueChange` (`HsvColor`), `shape`, `labels`, `disabled`, the form props, `controlRef`. One native `<input type="range">` over a gradient rail, with a 24×24 thumb that has the area's two-tone ring and focus indicator: hue 0–360 (step 1), saturation and brightness 0–100 %; the same keys as `ColorArea` on its one axis (arrows by 1, Shift by 10, PageUp/PageDown by 10, Home/End); a horizontal rail mirrors in RTL (`wave-rtl:-scale-x-100` on the rail, the keys through `getArrowIntent`); a vertical slider is a horizontal input rotated a quarter turn in every browser (bottom = minimum, `aria-orientation="vertical"`), because the supported browser floor predates native vertical range inputs; `aria-valuetext` "210°, blue" for hue and "72%" for the others (D22). The root always renders `data-orientation` and `data-channel` (enumerated) and `data-disabled` while disabled. **Naming and routing** (C-ROUTING): the input is named by the consumer's `aria-labelledby` or `aria-label`, else the Field's label, else `labels.<channel>` ("Hue", "Saturation", "Brightness"); the default is passed only without a Field context, since an `aria-label` would beat the Field's `<label for>`; `id`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `autoFocus`, `tabIndex`, focus and key handlers and native input attributes go to the input; the root keeps `className`, `style`, `data-*`, other handlers and `ref`. `AlphaSlider`: `ColorSlider` without `channel`, plus `transparency?: boolean` (the rail, the input's value (100 minus the opacity), the value text and the arrow direction all show transparency; `value.a` still means opacity), `aria-valuetext` "40%", and a CSS-only checkerboard drawn from theme tokens under the rail. The gradients are inline custom-property strings built from the value (as the area's). *Why:* Fluent's props renamed by C-NAMING (`orientation`, `value`); a Field's label must name the control inside it (the Field contract); C-CLASS exposes the enumerated props as attributes (Phase 2 D24); a flipped value keeps what the screen reader says, what the text says and which way the arrows move in agreement; Fluent's checkerboard is a PNG loaded from a CDN, which a library without runtime network requests cannot copy.
- **D21 — ColorPicker becomes a composable container; its value stays a hex string; the standalone parts bind to it.** `value`/`defaultValue`/`onValueChange` keep 0.7's hex contract. Inside, the picker keeps an HSV working color, so hue and saturation survive grey, white and black (hex cannot carry them); a value that changes from outside re-derives it, keeping the hue when the new color has no hue of its own (and the saturation at zero brightness). **Binding:** a `ColorArea`, `ColorSlider` or `AlphaSlider` inside a ColorPicker that is uncontrolled (neither `value` nor `defaultValue`) binds to the picker: it reads and writes the working color, takes the picker's `shape`, `labels` and disabled state, and renders no hidden input of its own (the picker's submits the color; its own `name`, `form` and `required` are ignored there). With its own `value` or `defaultValue` it stays independent. So Fluent's composition works as written: `<ColorPicker><ColorArea /><ColorSlider /><AlphaSlider /></ColorPicker>`. **Picker-only parts** are compound members: `ColorPicker.HexField`, `ColorPicker.Swatches` (the root's `presets`) and `ColorPicker.Preview`, flat `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`; they throw outside a ColorPicker (C-CONTEXT). The sketch's `ColorPicker.Area`, `ColorPicker.HueSlider` and `ColorPicker.AlphaSlider` are not added: members wrapping the standalone parts would duplicate them and leave the standalone parts silently unbound inside a picker. **Without children** the picker renders a `ColorArea` and a hue `ColorSlider` at the top, then 0.7's layout in 0.7's order: the preview and hex row, the hex error, the presets and, with `showOpacity`, the opacity row, whose caption and percentage readout stay and whose slider becomes an `AlphaSlider` (a visual change, CHANGELOG "Visual"; composing the parts is the opt-out). **With children** it renders only them inside its `role="group"` root, within a `null` Field context (the group keeps the Field wiring), with the 0.7 hidden input and form reset; `showOpacity` then does nothing and `presets` feed only `ColorPicker.Swatches` (their JSDoc says so); `children` thus changes meaning (0.7 ignored it: CHANGELOG "Changed"). A value that is not a hex color disables the bound parts until a hex value arrives (0.7 disabled the opacity slider). `ColorPicker.HexField` routes `id`, `aria-*`, `autoFocus`, `tabIndex`, focus and key handlers and native input attributes to its `<input>` and adds `controlRef` (C-ROUTING); its draft is reset through the picker's context by a form reset, a preset pick and a value change from outside (0.7's rules). `shape?: ColorPickerShape` on ColorPicker is inherited by bound parts. `ColorPickerLabels` gains the strings of the bound parts. *Why:* the roadmap sketch keeps the 0.5 layout "plus area and hue slider"; a hex value is the 0.7 contract and what forms submit; the working color is what keeps a hue slider from jumping to red while the user drags saturation to zero; binding the standalone parts is Fluent's model, so a screen ported from Fluent works without hand-rolled wiring (roadmap §1.1 goal 1); keeping 0.7's order below the new controls keeps the 0.7 Tab order of the hex field, presets and opacity.
- **D22 — Color text for assistive technology.** `aria-valuetext` of the area's inputs: "Saturation 72%, Brightness 74%, dark blue" on the saturation input and "Brightness 74%, Saturation 72%, dark blue" on the brightness input (each starts with its own channel, so the value that changed is heard first); of the hue slider: "210°, blue"; of the saturation and brightness sliders: "72%"; of the alpha slider: "40%" (opacity, or transparency with `transparency`). The color name comes from a small built-in English namer (hue families, a lightness and a saturation qualifier, black/white/gray; §2 P3-05 pins its table), which `labels.colorName?: (color: HsvColor) => string` replaces (return `''` to drop it); `labels.valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value' | 'alpha') => string` replaces a whole value text, for languages whose order differs; the channel names come from `labels` too. *Why:* the roadmap's acceptance ("`aria-valuetext` names the color"); a function label has precedents (TagPicker `labels.remove`, AvatarGroup `overflowLabel`, Pagination `getItemAriaLabel`), and word order across languages makes a table of fragments unfit for translation.

**Trees (P3-06, P3-07)**

- **D23 — Selection modes.** `selectionMode?: 'none' | SelectionMode` (the shared `'single' | 'multiple'`), default `'none'`, the 0.7 behaviour; Fluent's `'multiselect'` is not accepted. `'multiple'`: `checkedItems?: readonly string[]`, `defaultCheckedItems?: readonly string[]`, `onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void` with `details = { value, checked, event }` (the item that changed, its new state, the DOM event); through `useControllable`, so it fires only on change and receives a fresh array. `'single'` draws radio indicators for 0.7's `selected`/`onItemSelect` (`aria-selected`), so there is one single-selection API; in `'single'`, `selected` is read as `selected ?? null`, so every item carries `aria-selected` from the first render. A `'single'` tree without `selected` warns once (`Tree:single-without-selected`: the radios need `selected`, updated from `onItemSelect`), and `checkedItems` or `defaultCheckedItems` without `'multiple'` warns once (`Tree:checked-without-multiple`). The root always renders `data-selection-mode` with the mode (enumerated, before `{...rest}`). *Why:* the roadmap sketch; `details` carries what Fluent's `onCheckedChange` data carries besides the aggregate (the value and its new state), so a consumer never has to diff two arrays; `details` is optional through 0.x like every `details` added since 0.6 (D31); a radio that can never fill, or checks that nothing reads, is a mistake worth a warning.
- **D24 — Checks cascade** (maintainer ruling). An item's descendants are the `Tree.Item` elements among its children, recursively: the same scan that forms child groups, collapsed items included (their elements exist as children even while their group is not rendered); a `leaf` item has none, and a nested `Tree` (the 0.4 form) is a tree of its own. An item is checked when its value is listed in the checked items, when an ancestor's value is listed, or when it has descendants and every one of them is checked; mixed when some but not all of its descendants are checked or mixed; else unchecked. Toggling a checked item unchecks it and all its descendants; toggling an unchecked or mixed item checks it and all its descendants. The emitted array lists every checked item in tree order (fully checked parents included, mixed items not), followed by the listed values that match no item, unchanged (so values filtered out of the tree are not lost). A listed parent therefore also checks children that load later. A "Loading…" placeholder is an item like any other: checking its parent lists the placeholder's value too, and once real children replace it that value matches no item and is kept as unmatched; the README tells apps that load lazily to drop it then (a listed parent keeps checking the new children). *Why:* the design review chose the roadmap's cascade; WaveUI knows every item up front from its children, which is why Fluent's nested Tree leaves the cascade to the app ("difficult to manage without knowing the items upfront") and only its flat headless helper computes it; listing fully checked parents lets an app read "Documents is selected" without walking the tree.
- **D25 — Indicators, keys and pointer.** In `'multiple'` the tree carries `aria-multiselectable="true"`; every item `aria-checked="true" | "false" | "mixed"` and `data-checked` (checked) or `data-mixed` (mixed), both boolean attributes before `{...rest}` (the ARIA state after it); the row renders a checkbox between the chevron and the icon: an exposed `role="checkbox"` element with the same `aria-checked` (`mixed` included), `tabIndex={-1}`, labelled by the item's label (`aria-labelledby`), not a roving item, drawn with Checkbox's look and forced-colors recipe (check or mixed glyph). In `'single'` the row draws a decorative radio indicator (`aria-hidden`; the treeitem's `aria-selected` carries the state). Space toggles the focused item in `'multiple'` (in the other modes it activates, as in 0.7); Enter activates as in 0.7 (`onItemSelect`, and a parent toggles its expansion); a click on the checkbox (a 24×24 target) toggles the item's check, a click elsewhere on the row activates it (Fluent's model). So a touch screen reader's double tap on the item activates it, and on the checkbox (reached by swiping) toggles it; voice control reaches both by name. In `'multiple'`, `selected` does not apply (an item carries `aria-checked` or `aria-selected`, never both, APG) and warns once in development (`Tree:selected-with-multiple`). Whether VoiceOver announces `aria-checked` on a treeitem is checked before wave B (§6.3, the spike): if it does not, each item's description also carries a visually hidden state text from a new `labels` prop (`TreeLabels`: `checked`, `mixed`, `unchecked`; §8 Q18). *Why:* APG treeview ("Space toggles the selection state of the focused node"; "either `aria-selected` or `aria-checked`"); a decorative indicator left touch screen readers and voice control only the item's activation, so their users could never change a check (WCAG 4.1.2); an exposed checkbox outside the Tab order is what Fluent renders too (its selector is `tabIndex=-1` and labelled by the item), and ARIA allows interactive content inside a treeitem (not children-presentational); the row click keeps 0.7's activation, so a checkbox tree still navigates.
- **D26 — Row content.** `Tree.Item` gains `actions?: React.ReactNode` (buttons at the end of the row, in the row's own `role="toolbar"` element labelled by the item's label, shown while the row is hovered, the item has focus (`:focus`, not only `:focus-visible`: a toolbar still hidden after a click would be skipped by Tab) or focus is inside the actions, and always in forced colors and on devices without hover; the visibility is CSS only, so the server HTML is stable, and a hidden toolbar is `invisible`, so its buttons take no focus), `aside?: React.ReactNode` (non-interactive content at the end of the row: hidden while the actions show on hover or focus, and shown before them where the actions always show; the item's `aria-describedby` includes it), `iconAfter?: Slot<'span'>` (decorative, after the label; a falsy value renders no span, as `icon`) and `expandIcon?: Slot<'span'>` (replaces the chevron; the optional-indicator slot rule: `null`/`undefined` keep it, `false` or anything that renders nothing hides it, while `aria-expanded` still tells assistive technology). `actions` and `aside` render only when `slotRendersContent` (no empty toolbar). *Why:* the roadmap sketch (`tree-2`, `tree-7`); labelling the toolbar by the item's label adds no built-in string; an aside that is not in the item's description is never spoken, and one that hides whenever the actions show would never appear on touch devices or in forced colors (Fluent hides it only while the actions show on hover or focus).
- **D27 — `navigationMode` changes the keyboard only.** `navigationMode?: 'tree' | 'treegrid'`, default `'tree'`. `'tree'`: Tab from a focused item enters its actions toolbar (one stop, arrow keys inside it), Shift+Tab returns to the item, and the next Tab leaves the tree. `'treegrid'`: "next" (ArrowRight, ArrowLeft in RTL, through `getArrowIntent`) on a collapsed parent expands it (0.7), and otherwise moves focus into the item's actions when it has any (on an expanded parent it no longer moves to the first child; ArrowDown does); "previous" from the first action returns to the item; "next"/"previous" move between the actions without wrapping ("next" on the last action does nothing); ArrowUp/ArrowDown from an action focus the previous or next item; the actions take no Tab stop, so Tab leaves the tree. The roles stay `tree`/`treeitem` in both modes. **Keys and clicks inside the actions belong to them:** the item's handlers ignore events whose target is inside its actions (no activation, check toggle, `*`, expansion or collapse), the tree's typeahead ignores key presses from inside actions, and the toolbar's handler takes only its own keys and leaves a key an action already handles to that action (`defaultPrevented`, or ArrowDown/ArrowUp on an action with `aria-haspopup`, which opens its menu). **Tab stops:** the toolbar's buttons rove with `useRovingTabIndex`, whose new option `tabStop?: boolean` (default `true`; `P3-tree` owns the hook in wave B) leaves every item at `tabIndex=-1` when `false`: the toolbar passes `false` while its item is not the tree's active item in `'tree'` mode, and always in `'treegrid'` mode. *Why:* Fluent's `navigationMode="treegrid"` changes no role either; a real `treegrid` needs rows in one flat list with `aria-level`, which the nested DOM cannot give until the flat tree model (P11-04), so ROADMAP §8.5 records that follow-up; `'treegrid'` overrides APG's "next on an open node moves to its first child", which the keyboard table and the JSDoc state; 0.7's item handlers treat everything in the row as the item's own, so without the rule Enter or Space on an action would activate the item instead (Fluent excludes the actions the same way); the buttons are the consumer's elements, which only the roving hook can stamp, and it always left one item at `0`; the roadmap names the row↔actions movement as the internal helper that P7-03 makes public.
- **D28 — `Tree.ItemPersonaLayout`** (flat `TreeItemPersonaLayout`, Fluent's name; the sketch's `Tree.PersonaLayout` is not used): a layout for an item's label content with `media` (an Avatar or an icon), the name as children and an optional `description` below it. The item is named by the name only and described by the description: the layout registers both ids with its item through the item's context. *Why:* `tree-8`; Fluent's component name fits WaveUI's compound naming (`Tree.Item` → `Tree.ItemPersonaLayout`, as Phase 2 kept `MenuItemCheckbox`), roadmap §1.1 goal 4; a short name keeps announcements and voice commands short; a layout component keeps the item's typeahead and click rules unchanged.

**Across the phase**

- **D29 — No motion, and toasts on the presence core.** No component gets enter or exit motion classes (Phase 10). Every toast in the Toaster mounts through `usePresence` (`appear: true`, so app CSS on `.wave-toaster__toast[data-presence='entering']` runs): a dismissed toast stays mounted, `inert` from the dismissing commit, until its exit ends, which is at once without motion; it no longer counts toward `limit`, is no longer announced and its timer is gone; focus leaves it in the dismissing commit (the layout-effect cleanup, as `Menu.popover.tsx` moves focus out of a closing menu) to the next toast that is not exiting (C-POPUPS); dispatching the id of an exiting toast revives it (a new dispatch, not dismissed). The MessageBar reflow, the color parts and the tree indicators animate nothing (color transitions carry `motion-reduce:` variants, C-MOTION). *Why:* the roadmap names the toast parts among the surfaces that mount through the presence core from the start (P2-00).
- **D30 — Bundles.** No new runtime dependency. `verify-dist` gains: the registry is tree-shaken (an import of only `Button` contains the literal `'wave-button'` and not `'wave-dialog-content'`); the color parts are opt-in modules (an import of only `Button` contains none of `ColorArea`, `ColorSlider`, `AlphaSlider`, `lib/color`); an import of only `Toaster` contains `hooks/usePresence`. The CHANGELOG reports the size change of `dist/styles.css` and of the Button-only, Toaster-only, ColorPicker-only and full-import bundles. *Why:* roadmap principle 6; the class-name strings are the one addition every component carries.
- **D31 — `details` is optional through 0.x.** The `details` parameter of `onCheckedItemsChange` joins the list of `details` parameters announced in 0.x and made required in 1.0 (roadmap P13-03, P14-02). *Why:* Phase 1 D9 and Phase 2 D6.
- **D32 — Module splits.** `P3-toasts` splits `Toast.tsx` into `Toast.tsx` (the compound, its JSDoc, the flat re-exports, and the re-exports of `Toaster`, `useToastController` and the types the barrel imports), `Toast.root.tsx` (the `Toast` visual), `Toast.parts.tsx` (Title, Body, Footer, Close), `Toast.context.ts` (the per-toast and Toaster contexts) and `Toaster.tsx` (the container, controller, timers, live regions and keyboard). `P3-tree` splits `Tree.tsx` into `Tree.tsx` (compound and re-exports), `Tree.core.tsx` (the root and `Tree.Item` together: the item recognises a nested Tree by the root's type and the root's scan recognises items, which two modules could only do through a cycle), `Tree.context.ts`, `Tree.selection.ts` (the pure cascade model: it takes the item and tree types as parameters and walks with `getElementType(…, { suspend: false })`, as walks deeper than the direct children must) and `Tree.itemPersonaLayout.tsx`. `P3-color` adds `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx` and `ColorPicker.parts.tsx` (the picker-only parts and the picker context), and `P3-messagebar` `MessageBar.parts.tsx` (the parts and their context) and `MessageBar.reflow.ts`. MessageBar and ColorPicker keep their roots in their compound modules; their parts modules never import the compound module. Every compound's component docblock sits on its `Object.assign(…)` const (moved from 0.7's root where needed), and a root defined in a sibling module carries none of its own (C-DOCS). *Why:* the 0.7 Menu split (one-way imports, the compound's docblock on its `Object.assign(…)` const); `Toast.tsx` holds 842 lines and `Tree.tsx` 541 before this phase adds to them.

### 0.4 Out of scope for 0.8

Everything else in the roadmap. In particular: motion on any component, MessageBarGroup and the toast, tree and MessageBar motion gaps (`toast-5`, `tree-4`, `messagebargroup-1`; P10-01); per-part class-name documentation and `slotProps` (P13-01); public contexts and recomposition hooks, the other half of `buttons-29` (P13-02); `WaveProvider classNames` (P13-02); the inverted toast (`toast-4`, backlog); a Toast `dismiss` slot, the opt-out of the built-in Dismiss button (`toaster-9`, backlog; D11); arrow keys between toasts (ROADMAP §8.5); a Toaster `limit` queue priority, positions and offsets (`toaster-3`, `toaster-4`, `toaster-6` … `toaster-8`, backlog; `toaster-5` is P3-08's); a public marker for an app-owned region that modals leave usable, which issue #5 also asks for (the internal `data-wave-focus-trap-allow`; P7-02); MessageBar `shape`, `politeness` and context (`messagebar-4` … `messagebar-6`); color swatch kinds and SwatchPicker children (P5-04); RGB and HSL fields as components (a recipe story only, `colorpicker-2`); tree size and appearance (`tree-3`, backlog); per-item open state and open-change details (`tree-5`, `tree-6`); tree checks that do not cascade (ROADMAP §8.5; D24); Shift+Arrow, Shift+Space and Ctrl+A in a multi-select tree (optional in APG; ROADMAP §8.5); real `treegrid` roles (P11-04 follow-up, ROADMAP §8.5; D27); a flat tree model and virtualization (P11-04); and every other backlog gap. A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation

### Wave A — `F3-foundation`

Lands first and alone (§0.2 rule 19). It changes no behaviour: every component gains its stable classes (D4) and nothing else, `StatusText` gains an `id`, and the registry, its enforcement and its export are new. Its exit criteria are §1.7.

### 1.1 `src/lib/classNames.ts` (new, public)

The registry of Appendix A, one constant per public component and compound part, grouped by component folder in Appendix A's order:

```ts
/**
 * Stable class names of Button (P3-00): `root` on the `<button>`, `icon` on the icon box. Style
 * them from your own CSS (`.wave-button`, `.wave-button__icon`); no class is removed before 1.0.
 * State is not a class: use the `data-*` attributes (`[data-pressed]`, `[data-disabled]`).
 */
export const buttonClassNames = {
  root: 'wave-button',
  icon: 'wave-button__icon',
} as const;
```

- **No imports.** The module holds string constants only, so it runs on the server and in a Server Component (D2), and the build gives it no `"use client"` banner (it is under `src/lib`).
- **One JSDoc per constant**, naming the element each key lands on. The module header states the formula (D3), the placement rule (D4), the variant and nesting rule (D5), that there are no state classes (D6) and the stability promise (D8). Comments and JSDoc never contain a Tailwind utility name as a bare word (CLAUDE.md "Styling"): Tailwind reads every word under `src/lib`, and `node scripts/build-css.mjs` fails on a utility that no class string uses. Name elements by role ("the grid element", "the row element") where their tag is a utility word.
- **`as const`** gives every value its literal type (`typeof buttonClassNames.root` is `'wave-button'`), so a consumer can build a typed selector (`` `.${buttonClassNames.icon}` ``).
- **The Phase 3 parts are registered now** (D1): the constants of `Toast.Title`, `Toast.Body`, `Toast.Footer`, the Toaster's `toast` container, `MessageBar.Title`, `MessageBar.Actions`, `ColorArea`, `ColorSlider`, `AlphaSlider`, the three picker-only ColorPicker parts, the new `Tree.Item` parts and `Tree.ItemPersonaLayout`, exactly as Appendix A lists them. The registry test skips them until they are applied (§1.4.3 `PENDING_CLASS_NAMES`).
- **The JSDoc of the module points out** that the public `buttonClassNames` and the internal `buttonClassName()` helper of `buttonStyles.ts` differ by one letter (Appendix A judgement 37).

### 1.2 Applying the classes

Rules for `F3-foundation` (every existing component) and for the wave-B packages (their new parts):

1. **The root class comes first in the root's `cn()`:** `className={cn(buttonClassNames.root, internalClasses, className)}`. A root whose `className` is passed through without `cn()` today (Breadcrumb, `Nav.Category`, Table, DataGrid, `OptionGroup`, `Menu.Group`, `Skeleton.Group`: the inventory found these) switches to `cn(<name>ClassNames.root, className)`; nothing else about it changes.
2. **Variants** (D5) list the base constant first: `cn(buttonClassNames.root, toggleButtonClassNames.root, …)`; their parts likewise (`cn(buttonClassNames.icon, toggleButtonClassNames.icon, …)`). A variant that renders the base component (a `<Button>`) gets the base classes from it and adds only its own; for the icon, which Button draws itself, the variant passes `icon={withPartClass(icon, toggleButtonClassNames.icon)}`. `withPartClass(slot, className)` (new in `Button.slots.tsx`, generalising the `withIconBox` of `Toolbar.parts.tsx`, which switches to it) returns a slot object that renders the given slot with the class added (a slot object keeps its own `as` and props; shorthand content becomes its children; a slot that renders nothing stays nothing), so Button's icon span carries both classes and Button gains no prop.
3. **Parts** carry their class in the element's `cn()`; a slot part passes it in `renderSlot`'s base classes (`renderSlot(icon, 'span', cn(buttonClassNames.icon, 'inline-flex …'), { 'aria-hidden': true })`), so a slot object that swaps the element keeps it; an internal SVG glyph (`lib/icons`) takes it through `className`. A part that is rendered conditionally carries its class whenever it renders.
4. **A nested public component** gets the parent's part class through its `className` prop, merged with any consumer class for that element (`primaryActionButtonProps.className` for SplitButton): `<Button {...primaryActionButtonProps} className={cn(splitButtonClassNames.primaryActionButton, primaryActionButtonProps?.className)} />`.
5. **Where `className` lands elsewhere than `ref`** (Input with slots, `RadioGroup.Item`, the components Appendix A marks), the root class follows `className`.
6. **Nothing else changes** (§0.2 rule 19): no markup, no attribute, no style. The `data-wave-*` markers stay (they are internal query hooks; Appendix A notes which part class now shares an element with one).
7. **Wave-B packages** apply the pre-registered constants to their new elements from the first commit (§0.2 rule 20); a Phase 3 part whose element the design does not produce as registered is a change request.
8. **Literal member access.** A module writes each constant member it applies literally (`toggleButtonClassNames.root`, not `classNames[kind].root`), also when a shared renderer draws the element: the item kinds of the menu pass `rootClassName={cn(menuItemClassNames.root, menuItemCheckboxClassNames.root)}` and their part classes to `MenuItemRow`, and Nav passes its entries' classes to `renderNavEntry`, each from the module that sets the part's `displayName`. The gate rule (§1.4.1) and the registry test (§1.4.3) find the constants by that text.

### 1.3 `StatusText` gains an `id` (`src/components/feedback/MessageBar.status.tsx`)

`StatusText({ label, id }: { label: string; id?: string })` renders `<span id={id} className="sr-only">{`${label} `}</span>` (and nothing for an empty label, as in 0.7). `P3-toasts` points the toast container's `aria-labelledby` at it (D10) and `P3-messagebar` a labelled bar's (D16). Internal; no other change in the module.

### 1.4 Enforcement (D7)

#### 1.4.1 The conventions rule `class-names` (`src/__tests__/conventions.test.ts`)

- A new `RuleId` `'class-names'` with the hint "apply `<name>ClassNames.root` first in the root element's `cn()`, from `src/lib/classNames.ts` (C-CLASS, stable class names)".
- For a source of kind `component`, every `<Identifier>.displayName = '<Name>'` in code (not in a string or comment) whose `<Name>` maps to a registry constant (through `getStableClassNames`, §1.4.2) requires the file's code (outside strings and comments, the lexer's `bare` text) to contain `<constant>.root`; otherwise the rule reports the `displayName` line. A `displayName` that maps to no constant (an internal component such as `ToasterItem` or `MenuItemRow`, a context) is skipped.
- Its fixtures (the gate tests its own rules with inline sources): a module that sets `Button.displayName = 'Button'` without `buttonClassNames.root` fails; with it, it passes; `buttonClassNames.root` inside a comment or a string does not count; an internal `displayName` passes; a `displayName` that differs from its flat name (`'RadioItem'`) is looked up through the alias table.
- The Claude hook needs no change (it runs the gate for the edited component files).

#### 1.4.2 `src/test-utils.ts`

- **`getStableClassNames(displayName: string): { constant: string; root: string; carries: readonly string[] } | undefined`** (test-only; exported for the gate and the helper tests): the registry constant of a component, found as the camel-cased `displayName` plus `ClassNames`, or through `DISPLAY_NAME_ALIASES`, a table of the display names that differ from their flat names (Appendix A lists them); `carries` is every root class the element must carry: the base classes of a variant (D5) and its own, from a `VARIANT_BASES` table that mirrors the roots of Appendix A's "Also carries" column (ToggleButton → Button; `Toolbar.ToggleButton` → Button and ToggleButton; `Menu.ItemCheckbox` → `Menu.Item`; CounterBadge → Badge; `ColorPicker.Swatches` → SwatchPicker; …).
- **`testClassName`** (run by every `testSystemProps`) gains one case, registered only when the component has a constant: *"carries its stable classes on the element that receives className"*. It renders the component with the consumer class it already uses (`wave-test-custom-class`), finds the element that has that class (`document.body.querySelector`, so a portaled or wrapped root is found too) and asserts it has every class of `carries`. It uses no `data-testid`, so a component whose `className` and rest props land on different elements (`RadioGroup.Item`) is checked where `className` lands.
- **`src/__tests__/test-utils.test.tsx`** gains cases: the lookup (flat name, alias, a variant's `carries`, an internal display name that has none), the new `testClassName` case on Button, ToggleButton (both classes), `RadioGroup.Item` (the label) and a component without a constant (no case registered).

#### 1.4.3 `src/__tests__/classNames.test.ts` (new)

- **Completeness.** Every export of `src/index.ts` whose name starts with an uppercase letter and whose value is component-like (a function, or an object with a `$$typeof`), and every compound member reached from one (`Card.Header`), has a registry constant (by its flat name, or shares its alias target's) or is on `NO_ELEMENT` (D3: Dialog, Popover, Presence, the trigger and close parts, `ToastClose` included). The alias table of §1.4.2 and `NO_ELEMENT` are the only exceptions, each entry with a comment naming why; an entry of `NO_ELEMENT` that is not exported yet (`ToastClose` before wave C) is ignored.
- **Formula.** Every constant is named `<camel flat name>ClassNames`; `root` is `wave-<kebab flat name>` (except `waveProviderClassNames.root === 'wave-root'` and `portalClassNames.root === 'wave-portal'`); every other key is camelCase and its value is `<root>__<kebab key>`; no class string occurs twice across the registry; no value is one of the reserved scope classes (`wave-light`, `wave-dark`, `wave-high-contrast`, and `wave-root`/`wave-portal` outside their two owners; Appendix A judgement 36).
- **Export.** Every registry export is exported from the entry with the same value.
- **Server safety.** The registry's source, with its comments removed, contains no `import` or `require`.
- **Applied.** Every value of every constant (the roots and the parts) occurs as the text `<constant>.<key>` in some module under `src/components/` (a raw-source glob, as the gate reads files; a plain text match, since the gate's lexer is not shared, while the gate rule itself checks code only), except the entries of `PENDING_CLASS_NAMES`: `F3-foundation` lists there the Phase 3 constants and keys that wave B applies (§1.1); an entry is skipped whether or not wave B has applied it yet, and INTEGRATION empties the list once wave B has landed (§4.3).

#### 1.4.4 `scripts/verify-dist.mjs`

- **Server probe.** The `index` check of `serverProbeSource` also asserts that `buttonClassNames` is a plain object, not a client reference, and that its `root` is `'wave-button'`; a new check for `lib/classNames.[cm]js` asserts that every export is an object whose values are all strings. A Server Component can therefore read the constants from the package entry (D2).
- **Constants in the entry.** A new check asserts that every export of `lib/classNames.mjs` (and `.cjs`) is exported by `index.mjs` (and `index.cjs`) with the same value: the roadmap's acceptance "`verify-dist` flat names include the constants" (`checkFlatExports` only walks capitalised component exports).
- **Tree shaking.** `probeTreeShaking` gains `keepStrings` and `dropStrings` options: string literals, matched with their quotes (`'wave-button'` or `"wave-button"`), that must, or must not, appear in the unminified bundle code; a listed string that occurs in no module of `dist` is an error, so the probe cannot pass vacuously (as a listed missing module already is). The Button-only probe passes `keepStrings: ['wave-button']` and `dropStrings: ['wave-dialog-content']`, proving the registry is tree-shaken per constant (Rollup drops the unused `const` declarations of an included module).
- **Declarations.** `REQUIRED_DECLARATIONS` gains `buttonClassNames` (the rolled-up `index.d.ts` must declare the constants).
- **Flat-name bridge.** `PENDING_FLAT_EXPORTS = ['ColorPicker', 'MessageBar', 'Toast']` (sorted; §0.2 rule 21: `P3-tree` adds `'Tree'` later); `--final` still requires it empty, which INTEGRATION restores.
- **Tests** (`scripts/__tests__/verify-dist.test.mjs`): the new checks on fixture dists (a constant re-exported from a client module fails the server probe; a registry export missing from the entry fails; a bundle that keeps `'wave-dialog-content'` fails the Button-only probe, and so does a `dropStrings` entry that no dist module contains; a missing `buttonClassNames` declaration fails). The existing cases that assert the complete error list pass the new checks or opt out explicitly; the sorted-list case (`:900-901`) holds for the new list; the case that runs `checkFlatExports` on the real sources (`:1083-1089`) asserts that every bridge entry is reported as planned or pending, not that the list is empty (it stays green when `P3-tree` adds `'Tree'`).

### 1.5 Entry and public types

`src/index.ts` adds, under "Utilities": `export * from './lib/classNames';` (wave A is exclusive, rule 19). `src/__tests__/public-types.test.ts` adds: `expectTypeOf(buttonClassNames.root).toEqualTypeOf<'wave-button'>()`, `expectTypeOf(toggleButtonClassNames).toHaveProperty('icon')`, `expectTypeOf(waveProviderClassNames.root).toEqualTypeOf<'wave-root'>()`, a `@ts-expect-error` assignment to a constant's key (the objects are readonly), and `PENDING_PUBLIC_TYPES`: the type names of §4.3 (`ToastDispatchOptions`, `ToastTitleProps`, …, `TreeCheckedItemsChangeDetails`, `TreeItemPersonaLayoutProps`), which the test's "every named type used in a public signature is exported" walk (`:411-418`) skips until INTEGRATION exports them and empties the list (§0.2 rule 24).

### 1.6 Tests of wave A

- The gate rule and its fixtures (§1.4.1); the helper and its tests (§1.4.2); `src/__tests__/classNames.test.ts` (§1.4.3); the `verify-dist` checks and their tests (§1.4.4); the public types (§1.5).
- `withPartClass` (`Button.slots.test.tsx`): shorthand content, a slot object (its `as` and props kept, the class merged), a slot that renders nothing (stays nothing), and the ToggleButton, MenuButton, CompoundButton, SplitButton and Toolbar button icons carrying both classes.
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
    /** As `ToastOptions.toastId`: dispatching again with the id of a shown or exiting toast replaces it. */
    toastId?: string;
    /**
     * Auto-dismiss timeout in milliseconds, as `ToastOptions.timeout`. A toast that holds an action
     * (an interactive element besides its Dismiss button) stays until it is dismissed unless you
     * pass one: people using a screen reader, a switch or voice control need time to reach it.
     * @default 5000, or no timeout for a toast with an action
     */
    timeout?: number;
    /**
     * Severity of content that renders no `Toast`: the announcement's politeness (`error` is
     * assertive), its spoken prefix and the container's name. A rendered `Toast` uses its own
     * `status`; a different value passed here warns in development.
     * @default 'info'
     */
    status?: Status;
    /** Visually hidden severity text for content that renders no `Toast` (as `Toast.statusLabel`). */
    statusLabel?: string;
    /**
     * Text announced instead of the toast's title, body and action labels (the severity text still
     * comes first), for a toast whose visible text is no good announcement, such as a progress toast.
     */
    announcement?: string;
  }

  export interface ToastController {
    /**
     * Shows a toast and returns its id. `dispatchToast(content, options?)` shows your content,
     * usually a `<Toast>` with parts; `dispatchToast(options)` builds a toast from text (0.5). A
     * plain object is read as options; anything else (an element, a portal, a string) is content.
     * Fluent's `dispatchToast(content, options)` returns nothing.
     */
    dispatchToast: {
      (content: React.ReactNode, options?: ToastDispatchOptions): string;
      (options: ToastOptions): string;
    };
    dismissToast: (id: string) => void;
    dismissAllToasts: () => void;
  }
  ```
  The options signature is last, so `Parameters<ToastController['dispatchToast']>` stays `[options: ToastOptions]` (D12). The `useToastController` and Toaster JSDoc, which describe only the options form in 0.7, are rewritten for both forms.
- **Behaviour** (D12, D13).
  - **Recognition.** `isToastOptions(arg)`: a plain object (`Object.getPrototypeOf(arg)` is `Object.prototype` or `null`) without a `$$typeof` key, the rule of `isSlotObject` (`src/lib/slot.ts`); a portal (`createPortal(…)`, which `isValidElement` does not recognise), an element, a string, a number, an array or other iterable and a thenable are content. The 0.7 form is unchanged; content forms keep `{ content, options }` in the entry.
  - **Rendering.** The toast container (P3-02, D10) renders the entry's content as given, or, for the options form, a `<Toast>` built from the options (its title and body render through `Toast.Title` and `Toast.Body`, P3-02). For content without a `Toast`, the container also renders a visually hidden severity text from the options (D10).
  - **Replacing** by `toastId` replaces the content and the options, announces again and restarts the timer; the toast keeps its place and its focus (0.7); an exiting toast revives (D29).
  - **Timeout.** After mount, the container's layout effect looks for an interactive element other than the Dismiss button (a tabbable element, found with the `lib/focus` queries); when there is one and the dispatch passed no `timeout`, the toast gets no timer (D12). The options form (no actions) keeps 0.7's 5000 ms.
  - **Severity.** The `Toast` rendered inside a container registers its `status` and `statusLabel` with the per-toast context (a layout effect); the container uses the registration, else the options' `status` and `statusLabel`. When the options passed a `status` explicitly and it differs from the Toast's, one development warning from an effect (`Toaster:status-conflict`: "Toaster: the dispatched Toast has status "error" but the dispatch options pass "info"; the Toast's status is used. Remove `status` from the options.").
  - **Announcement** (D13). After the toast mounts, the container's layout effect (which runs after the Toast's registrations) composes the text: the severity text, then `announcement` if given, else the accessible text of the registered title and body elements (the subtitle is inside the body) and then of the toast's actions (the title's `action` and the footer, the Dismiss button excluded); content without a registered title or body contributes its whole accessible text. The accessible text walk skips `aria-hidden` and `hidden` subtrees, reads an image's `alt` and collapses whitespace. The text joins the Toaster's polite or assertive live region for 2 seconds (0.7's `LiveMessage`, keyed by the dispatch). The options form keeps 0.7's text exactly ("Error: Upload failed Try again.").
  - **Timers, `limit`, focus.** As 0.7, with P3-02's presence rules (a dismissed toast no longer counts toward `limit`) and P3-03's keys and region-wide pausing.
- **ARIA.** The container of P3-02. **SSR.** Toasts are dispatched on the client; the Toaster region renders on the server with no toasts (0.7). **RTL.** Nothing new. **Forced colors.** As 0.7 and P3-02. **Motion.** None (D29).
- **Guards** ("severity is spoken by Toast"; "live regions need no provider"; "timers pause on focus inside the toast"): a rich error toast announces "Error: Upload failed The file is too large. Retry" once, in the assertive region, with no provider or announcer mounted; an Undo button inside a rich toast (with an explicit `timeout`) pauses the timers while focused and runs its handler; the 0.7 announcement and timer tests stay green.
- **Files.** `Toaster.tsx`, `Toast.context.ts` (with P3-02).
- **Tests** (`src/components/feedback/__tests__/Toaster.content.test.tsx`): recognition (an element, a portal, a string, a number, an array, a Fragment, `null` and a thenable are content; a plain object and an `Object.create(null)` object are options); the returned ids (given and generated); a toast with an action and no `timeout` keeps no timer, one with `timeout: 3000` dismisses after it, one without an action dismisses after 5000 ms; an Undo button in a rich toast runs its handler, pauses the timers while focused (fake timers) and resumes after blur; the announcement of a rich toast (polite for `success`, assertive for `error`, once; the action labels after the body, never "Dismiss"; `aria-hidden` text skipped; an image's `alt` read; the subtitle included), with `announcement`, and of content without a Toast (options' status and politeness, its whole text, the hidden severity text in the container); a `Toast` inside the app's own wrapper component registers (labelled container, the Dismiss button, the Toast's severity); the status-conflict warning only for an explicit option (asserted); replacing by `toastId` announces again and restarts the timer; StrictMode (one entry and one announcement per dispatch); type tests (`dispatchToast(<Toast />)`, `dispatchToast({ title: 'Saved' })` and `dispatchToast(<span />, { timeout: 0 })` compile; `Parameters<ToastController['dispatchToast']>` equals `[options: ToastOptions]`; `@ts-expect-error` for `dispatchToast({ title: 1 })` and for an unknown option).
- **Stories** (`stories/Toast.stories.tsx`): `RichContent` (an Undo action), `CustomContent` (content without a Toast, with `status`), `ProgressToast` (`announcement`).
- **Docs.** README "Toasts" rewritten around rich content (the roadmap's exit criterion): dispatching a `<Toast>` with parts first, the options form second, severity (the Toast's `status`; the options for other content), what is announced and `announcement`, toasts with actions staying until dismissed (and passing `timeout` deliberately), the Dismiss button (D11); CHANGELOG Added, "Types" (`ToastController['dispatchToast']` is overloaded) and "Changed" (every toast pauses while the pointer or focus is in the region, P3-03).
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
  /** Props a `Toast.Close` puts on its element (and passes to a render-prop child), as `DialogCloseRenderProps`. */
  export interface ToastCloseRenderProps extends React.HTMLAttributes<HTMLElement> {
    onClick: React.MouseEventHandler<HTMLElement>;
    /** A callback ref, so the props spread onto any element type. */
    ref: React.RefCallback<HTMLElement>;
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
  Component JSDoc outlines (each part's ends with "Also exported as `ToastTitle` (import the flat name from React Server Components)", and so on): `Toast` (compound, on the `Object.assign(…)` const; 0.7's docblock moves there and is rewritten): "A notification: status icon, visually hidden severity text, title, body, footer and a Dismiss button. Dispatch it with `useToastController().dispatchToast(<Toast>…</Toast>)` (the Toaster announces it and shows the Dismiss button), or render it yourself (then it is its own live region). Its parts are direct children: `Toast.Title`, `Toast.Body`, `Toast.Footer`; plain children are the body (0.5)." `Toast.Title`: "The title row: the title text (which names the toast) and an optional `action` at its end." `Toast.Body`: "The body text and an optional `subtitle`, which describe the toast." `Toast.Footer`: "A row of actions under the body." `Toast.Close`: "Makes its single child dismiss the toast: it calls the Toast's `onDismiss` (when there is one), then, inside the Toaster, dismisses the toast. Your `onClick` runs first; `preventDefault()` keeps the toast. Works in dispatched content with or without a `Toast`. Fluent's `ToastTrigger`." The `onDismiss` JSDoc lists what calls it: the Dismiss button and `Toast.Close`, not a timeout, Escape, Delete or `dismissToast`.
- **Behaviour** (D9, D10, D11, D29).
  - **Layout** (as 0.7): `[icon] [content column] [Dismiss]`. The root scans its children (`flattenChildren` + `isElementOfType`, Server Component references included) for `Toast.Title`, `Toast.Body` and `Toast.Footer`: when it finds one, the children render in the content column as given; otherwise the `title` prop renders a `Toast.Title` and the children a `Toast.Body` (the 0.5 form; content that renders nothing still gets no body, 0.7). A part the scan cannot see (inside the app's own component) still renders and registers, but a part-less scan wraps it in a body: it warns once (`Toast.Title:unscanned`, `Toast.Body:unscanned`, `Toast.Footer:unscanned`), as MessageBar does (D15). A `title` prop next to a `Toast.Title` part: the part wins, one warning (`Toast:title-twice`).
  - **One per-toast context** (D9) in `Toast.context.ts`: `{ dismiss?, onDismiss?, ids, register… }`, provided by the Toast root and by the Toaster's container (the root reuses the container's ids when it is inside one). Each part reads it; outside both it throws in development (`reportMissingContext('Toast.Title', '<Toast>')`, C-CONTEXT), so `Toast.Close` in dispatched content without a `Toast` finds the container's.
  - **Parts.** `Toast.Title`: `<div class="flex items-start gap-2">` holding the title text in `<span id={titleId} class="min-w-0 flex-1 text-body-2 font-semibold text-foreground">` (Appendix A part `label`) and, when `slotRendersContent(action)`, the `action` slot (`renderSlot(action, 'span', 'shrink-0')`; interactive, not `aria-hidden`). `Toast.Body`: `<div id={bodyId} class="mt-0.5 text-body-1 text-muted-foreground">{children}{subtitle}</div>`, the subtitle (when `slotRendersContent`) inside it as `<div class="mt-1 text-caption-1 text-muted-foreground">`, so it is part of the description and the announcement; `bodyId` is the consumer's `id` on `Toast.Body`, else generated. `Toast.Footer`: `<div class="mt-2 flex flex-wrap gap-2">`. The title's id comes from the per-toast context; each part registers itself with the context in a layout effect (and unregisters). Each carries its Appendix A classes.
  - **`Toast.Close`**: `useTriggerElement(children, mergeProps({ onClick: close, ref }, rest), { componentName: 'Toast.Close', asChild })`, the element rules of `Dialog.Close` (`useModalClosePart`). `close` calls the Toast's `onDismiss` (when a Toast with one is there), then the container's dismissal (inside the Toaster); with neither, it does nothing and warns once (`Toast.Close:no-dismiss`).
  - **`icon`**: `undefined` renders the status icon; any other value goes through `renderSlot(icon, 'span', …, { 'aria-hidden': true })`, and one that renders nothing (`null`, `false`, `''`) shows none (the status-icon rule, `slotRendersContent`).
  - **Dismiss button** (D11): rendered when `onDismiss` is passed or a Toaster container provides a dismissal; it does what `Toast.Close` does.
  - **The container** (D10), rendered by the Toaster for every shown toast: `<div role="group" tabIndex={-1} data-wave-toast="" aria-labelledby={statusId titleId} aria-describedby={bodyId} class={cn(toasterClassNames.toast, focusRing)} {...presenceProps}>`. `aria-labelledby` names the severity text and the title while a title is registered, and the severity text alone while none is; the severity text's id is registered only while that text renders (`statusLabel: ''` renders none). `aria-describedby` only while a body is registered. So no id reference dangles at any commit. For content without a `Toast` the container renders its own visually hidden severity text from the options, first inside it. The 0.7 pause handlers and `usePreserveFocus` (with `enabled: !dismissed`) move from the Toast to the container; `data-wave-toast` moves with them.
  - **Presence** (D29): the container mounts through `usePresence(!dismissed, { appear: true, onExited })`. `dismissToast` marks the entry `dismissed` (its timer removed, its live message gone) instead of removing it; `onExited` removes it; dispatching its id again revives it (a new dispatch number, not dismissed). A dismissed entry does not count toward `limit` (the next queued toast shows at once) and is skipped by the shortcut (P3-03). The container turns `inert` in the dismissing commit, so focus moves out in that commit's layout-effect cleanup (the pattern of `Menu.popover.tsx`): to the next container that is not exiting (`data-presence` other than `exiting`), else the previous one, else the remembered origin (0.7's order); when focus was on the dismissed container itself (after Delete, or the shortcut) it goes to that container, so its name is read and the next Delete acts on it, and otherwise to its first tabbable element (0.7). The focus fallback walks only containers that are not exiting, and the origin tracking ignores a blur from inside a dismissed container.
- **Keyboard.** `Toast.Close`'s child activates as any button (Enter, Space); the rest is P3-03.
- **ARIA.** The container's group name ("Error: Upload failed") and description; a Toast outside a Toaster stays a live region without a name (D10); the title's `action` and the footer's buttons are ordinary controls in the toast's Tab order.
- **SSR.** A Toast rendered in the app (not dispatched) renders its parts on the server, with `useId` ids; hydration logs nothing.
- **RTL.** Logical layout (the Dismiss button at the end). **Forced colors.** Text in system colors; the container's focus ring shows when the shortcut focuses it. **Motion.** None; the presence core ends every phase at once without motion classes. An app can animate toasts from its own CSS on the container's stable class (`.wave-toaster__toast[data-presence='exiting']`), with a `prefers-reduced-motion` query of its own.
- **Guards** ("toasts stay reachable over modals and move out of a Drawer's way"; "focus moves to the next toast when a focused toast is dismissed"): the 0.7 tests of the allow-listed region and of the side-panel offset stay green with the container level; a new test dismisses a focused toast under `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })` and asserts focus on the next toast before the exit ends, and the exiting container `inert`.
- **Files.** `Toast.tsx`, `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx` (D32).
- **Tests** (`__tests__/Toast.parts.test.tsx`, and `__tests__/Toast.test.tsx` updated, §6.4): each part's markup and classes (the title's `label` part); `testSystemProps` for `Toast.Title`, `Toast.Body`, `Toast.Footer` (`expectedTag: 'div'`, inside a Toast as `wrapper`); `testCompoundExposure(Toast, …)`; flat names (`ToastTitle === Toast.Title`, …) and `asClientReference` parts (same `renderToString` and behaviour); the `icon` rule (default, `null`, `''`); the scan (direct, Fragment, Server Component reference) and the unscanned warning (asserted); `Toast:title-twice` (asserted); a part outside both a Toast and a container (`expectThrows`); `Toast.Close` in the Toaster (the Toast's `onDismiss` first, then the toast leaves), in dispatched content without a Toast (the toast leaves), standalone (calls `onDismiss`), a consumer `onClick` with `preventDefault()` (the toast stays), a Fragment child, a render-prop child, without a dismissal (the warning); a consumer `id` on `Toast.Body` is the described id; the subtitle inside the body; the container's role, `tabIndex`, name (severity and title; the severity alone without a title; none of a dangling id with `statusLabel: ''`) and description only after registration (`findDanglingIdRefs` at every step); axe for each layout (title and body; title with an action; footer; custom content) in the Toaster (open) and standalone; presence (under `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })`, a dismissed toast is `data-presence="exiting"` and `inert`, does not count toward `limit`, and unmounts after `finishAll()`; re-dispatching its id revives it; reduced motion mocked both ways); focus moves in the dismissing commit to the next container that is not exiting, also when two toasts exit at once; StrictMode (one registration per part).
- **Stories** (`stories/Toast.stories.tsx`): `Parts` (Title, Body, Footer), `TitleAction` (`Toast.Close` around an Undo button), `CustomIcon`, `Standalone` (a Toast with parts rendered in the page).
- **Docs.** README "Toasts" (the parts, `Toast.Close`, `icon`, what names a toast); "React Server Components" table (`ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`); CHANGELOG Added and "DOM" (the container level, `role="group"`, `data-wave-toast` on it, the 0.5 title and body now render as the part elements, `data-presence` on the container).
- **Compatibility.** Additive API; `typeof Toast` gains static members (CHANGELOG "Types"); DOM changes listed above.
- **Size.** M. **Depends on:** P2-00.

### P3-03 — Toaster keyboard access (P3-toasts, third)

- **Closes:** `toaster-2` (M).
- **API** (`Toaster.tsx`):
  ```ts
  /** Keyboard shortcuts of a Toaster (Fluent's shape). */
  export interface ToasterShortcuts {
    /**
     * Returns `true` for the key press that moves focus to the most recently dispatched toast, for
     * example `(event) => event.altKey && event.shiftKey && event.code === 'KeyN'`. Use a modifier
     * (or let people change or turn off the shortcut): a single-character shortcut fails WCAG 2.1.4.
     */
    focus?: (event: KeyboardEvent) => boolean;
  }
  // ToasterProps gains:
  /** Keyboard shortcuts; Escape, Delete and Backspace need none (see the component docs). */
  shortcuts?: ToasterShortcuts;
  ```
- **Behaviour** (D14).
  - **Shortcut.** A `keydown` listener on the document (an effect of the Toaster, removed on unmount), which ignores events already `defaultPrevented` and key presses while composing. When `shortcuts.focus(event)` returns `true` and a toast is shown, it prevents the default, remembers the focused element as the focus origin (unless focus is already in the region) and focuses the container of the shown, not dismissed toast with the highest dispatch number (`preventScroll`: false; the toast region is fixed).
  - **Escape** in the region (the viewport's `onKeyDown`, composed after the consumer's), unless `defaultPrevented` or composing, and only when its target is inside the viewport in the DOM (`isOwnEvent`, C-COMPOSE; an Escape pressed in a Menu, Popover or Dialog opened from a toast reaches the viewport through the React tree and is left alone), and only while no open, Escape-enabled dismiss layer is anchored inside the viewport (`getOpenLayers().some(layer => layer.escape && viewport.contains(layer.getAnchor()))`: a Tooltip shown on a toast's button, a Menu opened from a toast), which the dismiss-layer stack closes first: it prevents the default, moves focus to the remembered origin (when it is still connected; without one, focus ends on the page body, as when 0.7 removes the last focused toast), then dismisses every toast. Because the event is prevented, the dismiss-layer stack does not route it to a Dialog or Drawer below (the region counts as inside every layer, `ALLOW_OUTSIDE_SELECTOR`).
  - **Delete and Backspace** on a container, or on a descendant that is not an editable field (`isEditableTarget`), unless `defaultPrevented`, and only when the target is inside the container in the DOM (a key pressed in a Menu or Dialog opened from the toast is left alone): prevents the default and dismisses that toast; focus moves as for any dismissal (P3-02: to the next container, when focus was on the container). Backspace joins Delete because it is the delete key of Mac keyboards (TagPicker removes a tag with either).
  - **Pausing** (D14): the viewport's pointer and focus handlers pause every toast's timer while the pointer or focus is anywhere in the region (focus in a portal opened from a toast counts, as React focus events bubble through portals; activation handlers keep the C-COMPOSE rule), and resume them when both have left; a window in the background pauses them too (0.7).
- **Keyboard table** (README): Toaster row: the app's shortcut focuses the newest toast; Tab and Shift+Tab move through the toasts' controls; Escape dismisses every toast and returns focus (after closing a tooltip or menu of the toast first); Delete or Backspace dismisses the focused toast.
- **ARIA.** Nothing new. **SSR/RTL/forced colors/motion.** Nothing new.
- **Guards** (the dismiss-layer stack routes Escape by focus; timers pause on focus): Escape in a toast while a modal (the `useModalLayer` harness of `Dialog.test.tsx`) is open leaves the modal open and dismisses the toasts; the shortcut's focus pauses the timers. The cases with a real Dialog, Menu and Tooltip are INTEGRATION's (§4.4 #1, #2).
- **Files.** `Toaster.tsx`.
- **Tests** (`__tests__/Toaster.keyboard.test.tsx`): the shortcut focuses the newest toast's container, remembers the origin and prevents the default; with no toast, or a predicate returning `false`, nothing happens; a `defaultPrevented` key press is ignored; Escape dismisses every toast and returns focus to the origin (entered by Tab, by a click, by the shortcut); a prevented Escape does nothing; an Escape whose target is outside the viewport (a portaled element rendered from a toast) does nothing; an Escape while an Escape-enabled layer is anchored in the viewport (a `useDismiss` harness anchored on a toast's button) closes only that layer, and the next Escape dismisses the toasts; Delete and Backspace dismiss the focused toast and move focus to the next container; Delete in an input inside a toast edits the input; Delete in a portaled element rendered from a toast keeps the toast; the pointer or focus in one toast pauses every toast, and leaving the region resumes them (fake timers); StrictMode (one listener: one focus move per shortcut); unmount removes the listener.
- **Stories** (`stories/Toast.stories.tsx`): `KeyboardShortcut` (Alt+Shift+N, named in the story text).
- **Docs.** README keyboard table and "Toasts" (the shortcut needs a modifier, WCAG 2.1.4); CHANGELOG Added, and "Changed" (behaviour): Escape inside the toast region no longer closes a Dialog or Drawer below, it dismisses the toasts; every toast pauses while the pointer or focus is in the region.
- **Compatibility.** Additive, plus the two behaviour changes above.
- **Size.** S. **Depends on:** P1-18 (`dismissAllToasts`).

### P3-04 — `MessageBar.Title`, `MessageBar.Actions` and reflow (P3-messagebar)

- **Closes:** `messagebar-2` (M), `messagebar-1` (L), `messagebar-3` (L).
- **API** (`MessageBar.tsx` compound; parts in `MessageBar.parts.tsx`):
  ```ts
  // MessageBarProps gains:
  /**
   * How the text and the actions share the bar. `'singleline'`: the actions sit on the text's row
   * (the text wraps inside its column; it is never cut off). `'multiline'`: the actions get a row of
   * their own under the text. `'auto'`: the actions stay on the text's row while the text fits on
   * one line, measured after mount (the server renders one row), and move below it otherwise; a bar
   * without `MessageBar.Actions` is `'multiline'`, the 0.7 look.
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
  - **Partition.** The scan of D15 during render; the parts render with a context that marks them as placed (`MessageBarPartContext`, default `null`, in `MessageBar.parts.tsx`); a part that renders without it warns once from an effect (`MessageBar.Title:unscanned`: "MessageBar.Title is not a direct child of MessageBar, so it is not placed first in the text. Make it a direct child."), and a part outside any MessageBar throws in development (C-CONTEXT).
  - **Text column.** `StatusText` (with `id` when the bar is labelled, §1.3), then the title (`<span id={titleId} class="font-semibold">` and a space; `titleId` is the consumer's `id` on the Title, else generated), then the body. Screen readers read "Warning: Update available A new version is ready to install." and then the actions' labels (they are inside the live region), once.
  - **Labelling** (D16): `aria-labelledby={joinIds(statusTextId, titleId)}` only when the bar's resolved role is not `alert` or `status` (a consumer `role`) and a title is placed; the severity text id only while that text renders (an empty `statusLabel` renders none, so it is left out); a consumer `aria-label` or `aria-labelledby` wins (then the bar adds none). A `role="region"` bar with neither a title nor a consumer label warns once from an effect (`MessageBar:region-name`).
  - **Layouts** (D17): the root renders `data-layout` (`singleline` | `multiline`, before `{...rest}`); the DOM order is icon, text column, actions, Dismiss in both. The one-row layout: a `flex items-start` row; the text column `min-w-0 flex-1` (it wraps; never clipped); the actions `flex shrink-0 gap-2`; the Dismiss button last. While `'auto'` measures it, the text column is `whitespace-nowrap` (still not clipped). `multiline` with actions: a grid, `[icon] [text] [Dismiss]` on the first row and the actions on the second, in the text column's track (`row-start-2 col-start-2`). `multiline` without actions: 0.7's row unchanged (its classes, the Dismiss button's `ms-auto`, no added element). Classes only; no inline style.
  - **Reflow** (`MessageBar.reflow.ts`, internal): `useMessageBarReflow(root, text, enabled)` returns `'singleline' | 'multiline'` through `useSyncExternalStore`: the store holds `{ reflowing, neededWidth }` per bar; its subscription observes the root with a ResizeObserver (`box: 'border-box'`) while `enabled` (`layout === 'auto'` with an Actions part); in the one-row layout the callback switches to multiline when the text column overflows (`text.scrollWidth > text.clientWidth`), remembering `root.clientWidth + text.scrollWidth − text.clientWidth`, and while multiline it switches back when `root.clientWidth >= neededWidth`; `getServerSnapshot` and the first client snapshot are `singleline`. The root and text elements are held in state through callback refs (C-POPUPS rule for elements read in effects).
- **Keyboard.** Tab follows the DOM in both layouts: links in the text, the actions, the Dismiss button. Nothing else.
- **ARIA.** D16; the Actions container has no role (a group of ordinary buttons; the bar is already the grouping).
- **SSR.** `'auto'` with Actions renders `singleline` on the server; hydration logs nothing; `'auto'` without Actions renders `multiline` everywhere.
- **RTL.** Logical classes only; the Dismiss button and actions sit at the end. **Forced colors.** Unchanged (text and buttons in system colors). **Motion.** None (the reflow does not animate).
- **Guards** ("severity is spoken by MessageBar"): the severity text stays the first text of the bar, read once (a content-order assertion for titled bars); for a bar with `role="region"` the accessible name is "Warning: Update available" (the severity stays in the name of a titled bar, the roadmap's wording).
- **Files.** `MessageBar.tsx`, `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, their tests, `stories/MessageBar.stories.tsx`.
- **Tests** (`__tests__/MessageBar.parts.test.tsx`, `__tests__/MessageBar.reflow.test.tsx`, `MessageBar.test.tsx` updated for `data-layout`): the partition (direct children, Fragments, `asClientReference` parts; the body keeps the rest in order); the unscanned and multiple-title warnings (asserted); parts outside a bar (`expectThrows`); `data-layout` per layout; the one DOM order of both layouts, and focus on an action kept through a reflow; a bar without actions renders 0.7's markup plus `data-layout` (the 0.7 `icon={null}` and RTL `ms-auto` assertions stay); `'auto'` without Actions (multiline, no observation: a spy on `ResizeObserver.prototype.observe`, installed after `installResizeObserverMock`, records none, the technique of `usePopupPosition.test.tsx`); `'auto'` with Actions (the one-row layout first; a text column whose stubbed `scrollWidth` exceeds its `clientWidth`, plus the mock's `trigger`, switches to multiline; a root that grows to the needed width switches back); explicit layouts never observe; the one-row text column never carries clipping classes (explicit `'singleline'`: it wraps); SSR (`renderToString` one row) and hydration without warnings; labelling (default roles: no `aria-labelledby`, content order "Warning: Update available …"; `role="region"`: name "Warning: Update available"; a consumer `id` on the Title is the labelling id; a consumer `aria-label` wins; the `MessageBar:region-name` warning, asserted); axe for each status with a title and actions, both layouts; RTL render; `testSystemProps` for both parts; flat names and `testCompoundExposure`; StrictMode (one `observe` call, spied); type tests (`layout` union; `@ts-expect-error` `layout="wrap"`).
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
  /** The shape of ColorPicker and its color parts (a subset of `Shape`). */
  export type ColorPickerShape = Extract<Shape, 'rounded' | 'square'>;

  // src/lib/color.ts (public, server-safe)
  /** Lowercase `#rrggbb`, or `#rrggbbaa` when `a` is below 1 (ColorPicker's value format). Wraps `h`, clamps `s`, `v` and `a`. */
  export function hsvToHex(color: HsvColor): string;
  /** The HSV color of `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (trimmed, any case; `a` only when the input has alpha digits), or `null`. */
  export function hexToHsv(hex: string): HsvColor | null;

  // src/components/input/ColorArea.tsx
  export interface ColorAreaLabels {
    /** Name of the horizontal slider. @default 'Saturation' */
    saturation?: string;
    /** Name of the vertical slider (the `value` channel). @default 'Brightness' */
    brightness?: string;
    /** Role description of both sliders. @default '2D slider' */
    roleDescription?: string;
    /** Names the color at the end of each value text; return `''` to leave it out. @default an English namer ("dark blue") */
    colorName?: (color: HsvColor) => string;
    /** Replaces a whole value text, for languages whose order differs. */
    valueText?: (color: HsvColor, channel: 'saturation' | 'value') => string;
  }
  export interface ColorAreaProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
    /** The color (Fluent's `color`). Inside a ColorPicker, leave `value` and `defaultValue` out to bind to the picker. */
    value?: HsvColor;
    /** @default the brand blue, `{ h: 208, s: 0.92, v: 0.74 }` (`#0f6cbd`) */
    defaultValue?: HsvColor;
    /** Called with the new color on every step (key or pointer move) that changes it (Fluent's `onChange`). */
    onValueChange?: (value: HsvColor) => void;
    /** `'square'` removes the corner radius (the thumb stays round). @default 'rounded' */
    shape?: ColorPickerShape;
    labels?: ColorAreaLabels;
    /** Unavailable: both inputs natively disabled, pointer presses ignored, dimmed. @default false */
    disabled?: boolean;
    /** Form field name: the color is submitted as hex (`hsvToHex`). Ignored while bound to a ColorPicker. */
    name?: string;
    form?: string;
    /** Marks the hidden input required (a color is always set, so it never blocks). */
    required?: boolean;
    /** Ref to the saturation `<input type="range">` (C-ROUTING). */
    controlRef?: React.Ref<HTMLInputElement>;
    ref?: React.Ref<HTMLDivElement>;
  }

  // src/components/input/ColorSlider.tsx
  export interface ColorSliderLabels {
    /** @default 'Hue' */ hue?: string;
    /** @default 'Saturation' */ saturation?: string;
    /** Names the `channel="value"` slider. @default 'Brightness' */ brightness?: string;
    /** As `ColorAreaLabels.colorName` (the hue slider's value text). */
    colorName?: (color: HsvColor) => string;
    /** Replaces the value text. */
    valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string;
  }
  export interface ColorSliderProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'onChange'> {
    /** The channel the slider edits. @default 'hue' */
    channel?: 'hue' | 'saturation' | 'value';
    /** `'vertical'` draws the rail bottom to top (Fluent's `vertical`). @default 'horizontal' */
    orientation?: Orientation;
    /** As `ColorAreaProps.value` (binds inside a ColorPicker without `value` and `defaultValue`). */
    value?: HsvColor;
    /** @default the brand blue, as `ColorArea` */
    defaultValue?: HsvColor;
    onValueChange?: (value: HsvColor) => void;
    /** @default 'rounded' */
    shape?: ColorPickerShape;
    labels?: ColorSliderLabels;
    /** @default false */
    disabled?: boolean;
    name?: string;
    form?: string;
    required?: boolean;
    /** Ref to the `<input type="range">` (C-ROUTING). */
    controlRef?: React.Ref<HTMLInputElement>;
    ref?: React.Ref<HTMLDivElement>;
  }

  // src/components/input/AlphaSlider.tsx
  export interface AlphaSliderLabels {
    /** @default 'Opacity' */ opacity?: string;
    /** @default 'Transparency' */ transparency?: string;
    /** Replaces the value text. */
    valueText?: (color: HsvColor, transparency: boolean) => string;
  }
  export interface AlphaSliderProps extends Omit<ColorSliderProps, 'channel' | 'labels'> {
    /** Show transparency (100% = fully transparent) instead of opacity; `value.a` is still opacity (Fluent's `transparency`). @default false */
    transparency?: boolean;
    labels?: AlphaSliderLabels;
  }

  // ColorPicker.tsx (0.7 props unchanged) gains:
  /** `'square'` removes the corner radius of the area, the rails and the preview; bound parts inherit it. @default 'rounded' */
  shape?: ColorPickerShape;
  /**
   * Your own layout: bound `ColorArea`, `ColorSlider` and `AlphaSlider`, and the parts
   * `ColorPicker.HexField`, `ColorPicker.Swatches` and `ColorPicker.Preview`. Without children the
   * picker renders its default layout. With children, `showOpacity` does nothing and `presets` feed
   * only `ColorPicker.Swatches`.
   */
  children?: React.ReactNode;
  // ColorPickerLabels gains: area ('Saturation and brightness', the name of a bound area's group),
  // saturation, brightness, roleDescription, hue, transparency, colorName and valueText (as above).

  // ColorPicker.parts.tsx (picker-only parts; flat names ColorPickerHexField, ColorPickerSwatches, ColorPickerPreview)
  /** Properties for the ColorPickerHexField sub-component. `id`, `aria-*`, `autoFocus`, `tabIndex`, focus and key handlers go to the `<input>` (C-ROUTING). */
  export interface ColorPickerHexFieldProps extends React.HTMLAttributes<HTMLElement> {
    /** Ref to the hex `<input>`. */
    controlRef?: React.Ref<HTMLInputElement>;
    /** Ref to the field's outer element. */
    ref?: React.Ref<HTMLLabelElement>;
  }
  /** Properties for the ColorPickerSwatches sub-component: the picker's `presets` as a SwatchPicker. */
  export interface ColorPickerSwatchesProps
    extends Omit<SwatchPickerProps, 'items' | 'value' | 'defaultValue' | 'onValueChange' | 'onChange' | 'name' | 'form' | 'required'> {}
  /** Properties for the ColorPickerPreview sub-component. */
  export interface ColorPickerPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
    ref?: React.Ref<HTMLDivElement>;
  }
  ```
  JSDoc outlines: `ColorArea`: "A 2-D color field: saturation left to right (mirrored in right-to-left layouts) and brightness bottom to top, at the value's hue. Arrows move by 1 %, Shift with an arrow by 10, Page Up and Page Down brightness by 10, Home and End saturation to 0 and 100. One Tab stop; assistive technology gets two sliders (one exposed at a time on desktop). Inside a ColorPicker, leave `value` and `defaultValue` out and it binds to the picker. Fluent's `ColorArea`, with `value`/`onValueChange` for its `color`/`onChange`." `ColorSlider`: "A slider for one channel of an HSV color: hue (the default), saturation or brightness (`channel="value"`), horizontal (mirrored in right-to-left layouts) or vertical. Binds inside a ColorPicker as `ColorArea` does." `AlphaSlider`: "A slider for a color's opacity over a checkerboard; `transparency` shows transparency instead. Binds inside a ColorPicker as `ColorArea` does." `ColorPicker` (compound const; 0.7's docblock moves there and is rewritten): "A color picker whose value is a hex string. Without children: a color area and a hue slider, then a preview and a hex field, preset swatches and, with `showOpacity`, an opacity slider. With children: your layout of `ColorArea`, `ColorSlider` and `AlphaSlider` (which bind to the picker when uncontrolled) and `ColorPicker.HexField`, `ColorPicker.Swatches`, `ColorPicker.Preview`." `ColorPicker.HexField`: "The hex text field of the picker (0.7's draft rules). Also exported as `ColorPickerHexField`." `ColorPicker.Swatches`: "The picker's `presets` as swatches; picking one keeps the opacity." `ColorPicker.Preview`: "A swatch of the picker's current color (decorative)."
- **Behaviour** (D18–D22).
  - **Conversions** (`src/lib/color.ts`, used by `colorUtils.ts` too): `hsvToRgb` and `rgbToHsv` (internal) and the public `hsvToHex`/`hexToHsv` with the contracts of D18. Rounding: `hsvToHex(hexToHsv(x))` returns `x` in ColorPicker's normal form for every accepted hex string.
  - **Binding** (D21): `ColorArea`, `ColorSlider` and `AlphaSlider` read an optional picker context (`useColorPickerContext()`, default `null`; the context lives in `ColorPicker.parts.tsx`, which never imports `ColorPicker.tsx`); with a picker and neither `value` nor `defaultValue`, the part reads the working color, writes it through the picker's `setHsv`, takes the picker's `shape`, `labels` and disabled state, names a bound area's group with `labels.area`, and renders no hidden input.
  - **`ColorArea`** (D19): the root `<div role="group" class="relative touch-none select-none …">` holds the field layer (`aria-hidden`; its background is the inline custom property `--wave-color-area-gradient`, a string marked `// wave-allow-color: color-space gradient`, read by `bg-(image:--wave-color-area-gradient)`, and it mirrors with `wave-rtl:-scale-x-100`), the thumb (`size-6 rounded-full`, placed with `--wave-color-area-x`/`--wave-color-area-y` through logical `start-*`/`bottom-*` utilities and a `wave-rtl:` translate counterpart, filled through `--wave-color-area-color`, the two-tone ring, and the two-tone focus indicator while either input has focus: `group-has-[:focus-visible]`), and two visually hidden `<input type="range" min={0} max={100} step={1}>`. The Tab stop follows D19 (a `useSyncExternalStore` read of `matchMedia('(pointer: fine)')`, with the fine-pointer model as the server snapshot). The root's `onKeyDown` (after the consumer's) handles the keys of D19, prevents them (so the native range handling never runs) and moves focus and the Tab stop to the input of the axis that changed; each input's `onChange` handles the events assistive technology sends (a VoiceOver swipe). `onPointerDown` (primary button, any pointer type; ignored while disabled) calls `setPointerCapture`, sets the color from the point (x mirrored in RTL through `getDirection`), and focuses the input that has the Tab stop (`preventScroll`); `onPointerMove` while captured updates it; `onLostPointerCapture` ends the drag. Field, routing and forms as D19 (`HiddenInput` with the hex of the color when `name` or `required` is given and the part is not bound; `useFormReset` restores `defaultValue`).
  - **`ColorSlider`** (D20): the root `<div class="relative …" data-orientation data-channel>` holds the rail (its gradient in the inline custom property `--wave-color-slider-gradient`: hue `red → yellow → lime → cyan → blue → magenta → red`, saturation from gray to the full color at the value's hue and brightness, brightness from black to the color; mirrored with `wave-rtl:-scale-x-100` when horizontal), the thumb (`size-6`, placed along the axis by `--wave-color-slider-position`, the two-tone ring and focus indicator), and one native `<input type="range">` covering the rail (`absolute inset-0 opacity-0`), so pointer dragging is native; vertical rotates the input a quarter turn in every browser and sets `aria-orientation="vertical"`. The keys of D20 are handled in the input's `onKeyDown` (prevented), with `getArrowIntent` for the horizontal axis. The name follows D20's order (the `labels` default only without a Field context).
  - **`AlphaSlider`** (D20): as `ColorSlider` with the channel `a` (0–100 %); the rail is `transparent → the opaque color` over the checkerboard (a CSS pattern of two neutral tokens, `background` and `muted`, or the pair whose contrast `tokens.test.ts` can assert at 1.5:1 or more in all three themes; no image); with `transparency` the input's value is 100 minus the opacity, and the rail, the value text and the arrow direction follow it.
  - **ColorPicker** (D21): the context provides `{ hsv, color, setHsv(next, event?), shape, labels, disabled, draftResetKey, invalid, errorMessageId, … }` (C-MEMO); `setHsv` updates the working color and calls `setColor(hsvToHex(next))` through `useControllable` (so `onValueChange` fires only when the hex changes). The working color is re-derived during render from a previous-value state when the hex `value` changes from outside and differs from `hsvToHex(hsv)`, keeping the hue (when the new color is achromatic) and the saturation (when it is black). `disabled` is `true` while the value is not a hex color. Without children the picker renders `ColorArea` and a hue `ColorSlider` (bound), then 0.7's preview and hex row, the hex error, the presets and the opacity row (with `showOpacity`: 0.7's caption, a bound `AlphaSlider`, 0.7's readout), all inside `<FieldContext.Provider value={null}>` (as 0.7 does for the presets); with children it renders them inside the same `null` Field context. The hidden input's `onInvalid` focuses the hex input when there is one, else the first focusable element of the picker.
  - **Picker-only parts**: `ColorPicker.HexField` holds 0.7's hex draft logic and Field routing unchanged, routes its props to the `<input>` and takes `controlRef` (C-ROUTING); it clears its draft when the context's `draftResetKey` changes (incremented by a form reset, a preset pick and a value change from outside, 0.7's three rules). `ColorPicker.Swatches` renders 0.7's presets `SwatchPicker` with its class (`className`; its swatches carry SwatchPicker's own part class), picking keeps the opacity. `ColorPicker.Preview` renders 0.7's preview. Outside a ColorPicker each throws in development (C-CONTEXT).
  - **Color namer** (D22; internal `colorName.ts`): black when `v < 0.15`; with `s < 0.1`: white when `v > 0.93`, "dark gray" below 0.4, "light gray" above 0.75, else "gray"; otherwise a hue family (`h` in degrees: red below 15 and from 345, orange to 45, yellow to 70, green to 165, cyan to 195, blue to 255, purple to 290, magenta to 320, pink to 345), prefixed by "dark" when `v < 0.5` or "light" when `v > 0.85` and `s < 0.5`, then by "grayish" when `s < 0.35` (not with "light") or "vivid" when `s > 0.85` and `v > 0.85`: "dark grayish blue", "light pink", "vivid red", "blue". Pinned examples: `#0f6cbd` → "blue", `#d13438` → "red", `#242424` → "black", `#ffffff` → "white", `#808080` → "gray".
- **Keyboard** (README table): `ColorArea`: Left/Right saturation (mirrored in RTL), Up/Down brightness, Shift + arrow by 10, Page Up/Page Down brightness by 10, Home/End saturation minimum/maximum, one Tab stop; `ColorSlider`/`AlphaSlider`: the arrows of their axis by 1, Shift by 10, Page Up/Page Down by 10, Home/End.
- **ARIA.** D19, D20, D22: the area is a named group of two sliders (one exposed on desktop), each named, role-described and value-texted; the brightness input `aria-orientation="vertical"`; a slider named by the consumer, the Field or `labels`.
- **SSR.** Everything renders on the server (input values, the inline custom properties, the desktop Tab-stop model); hydration logs nothing; no DOM measurement before a pointer press.
- **RTL.** The area's field and horizontal rails mirror (`wave-rtl:` classes), the keys through `getArrowIntent`, the pointer math through `getDirection`; RTL tests.
- **Forced colors.** The field, the rails and the preview keep their colors (`forced-color-adjust: none` on those elements only); the thumbs draw their ring and focus indicator in system colors (`CanvasText`/`Canvas`/`Highlight`).
- **Motion.** None (thumbs move without transitions).
- **Guards** ("hidden inputs and form reset on every value control"; "WCAG contrast of the thumb and checkerboard pairs asserted"): the 0.7 ColorPicker form and reset tests stay green; the three standalone parts submit hex and reset (and render no hidden input while bound); `tokens.test.ts` asserts, in all three themes, the thumb ring pair (`background`/`foreground`, 3:1 or more), the focus-indicator pair (`background`/`ring`, 3:1 or more; the halo keeps the ring visible on the brand blue, the default color) and the checkerboard pair.
- **Files.** `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx`, `ColorPicker.tsx`, `ColorPicker.parts.tsx`, `colorName.ts`, `colorUtils.ts`, `src/lib/color.ts`, `src/lib/types.ts` (`HsvColor`, `ColorPickerShape`), their tests, `src/styles/__tests__/tokens.test.ts` (the pairs), the stories (§3).
- **Tests** (`src/lib/__tests__/color.test.ts`, `__tests__/colorName.test.ts`, `__tests__/ColorArea.test.tsx`, `__tests__/ColorSlider.test.tsx`, `__tests__/AlphaSlider.test.tsx`, `__tests__/ColorPicker.parts.test.tsx`, `ColorPicker.test.tsx` updated): the conversions (round trips over a table; wrapping and clamping; `a` only for alpha input; achromatic and black inputs); the namer table; `ColorArea`: every key (Shift, Page, Home/End), RTL mirroring, focus and the Tab stop following the axis, one tabbable input and one exposed input with a fine pointer and two exposed inputs with `mockMatchMedia` reporting a coarse one, `aria-orientation` on the brightness input, the value texts (each starting with its own channel; `labels.colorName`, `''`, `labels.valueText`), the pointer (jump, capture, drag, touch and pen pointer types, RTL mirrored; `mockRect` for the field; `setPointerCapture`, `releasePointerCapture` and `hasPointerCapture` stubbed on `Element.prototype` in a `beforeEach`, since jsdom has none), `onValueChange` only on change and once per change in StrictMode, controlled and uncontrolled, the naming order (consumer, Field, none), routing (`aria-invalid` and `aria-errormessage` on both inputs; `controlRef` on the saturation input), forms (hex submitted, reset), `disabled` (both inputs disabled, `data-disabled`, a pointer press ignored, no `onValueChange`), the gradient read from the custom property (no color literal in a class: the conventions gate passes), `testSystemProps`, axe, SSR and hydration; `ColorSlider`: each channel's range, value text and gradient property, `data-orientation` and `data-channel` always, vertical (`aria-orientation`, Up/Down), RTL, the naming order (a Field's label wins over "Hue"; "Hue" without a Field), routing (`controlRef`; `aria-errormessage` and `aria-details` on the input), forms; `AlphaSlider`: opacity and `transparency` (the input value flipped, the text and the arrow direction in agreement); binding: a Fluent composition `<ColorPicker><ColorArea /><ColorSlider /><AlphaSlider /></ColorPicker>` edits the picker's value, bound parts inherit `shape`, `labels` and disabled, render no hidden input and ignore `name`, and a part with its own `value` inside a picker stays independent; ColorPicker: the default layout (area and hue slider, then 0.7's order), the working color (dragging saturation to zero and back keeps the hue; a gray `value` from outside keeps the hue), a value that is not hex (the bound parts disabled, as 0.7's opacity slider), the parts' Field isolation (no second element with the Field's control id, no second required input), composition (only the children render; `showOpacity` ignored with children), `HexField` routing and `controlRef`, its draft reset by a form reset, a preset pick and an outside change, `shape` inheritance, the 0.7 hex, preset, opacity, Field and form tests (updated where the layout changed, §6.4); flat names, `testCompoundExposure(ColorPicker, …)`, `asClientReference` parts; type tests (`HsvColor`, `ColorPickerShape`, the unions, `@ts-expect-error` `channel="alpha"`).
- **Stories**: `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` (titles `Components/Input/<Name>`: default, controlled, square, vertical, transparency; importing module paths in wave B, §0.2 rule 25), `stories/ColorPicker.stories.tsx` (+ `Composed` (Fluent's composition with bound parts), `CustomLayout`, `RgbAndHslFields` (the `colorpicker-2` recipe: SpinButtons around a controlled hex value through `hexToHsv`/`hsvToHex`), `InPopover` (a picker in a Popover with Apply/Cancel), `Square`).
- **Docs.** README: a "Color" usage note (the parts and the binding rule, hex versus `HsvColor`, the helpers, the keys, `labels.colorName` and `labels.valueText`); "Built-in text" (the new strings); keyboard table; "React Server Components" table (`ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`); CHANGELOG Added, "Visual" (the default layout gains the area and the hue slider; the opacity row's slider becomes an alpha slider with a checkerboard), "Changed" (`children` of ColorPicker now renders a custom layout; 0.7 ignored it), "DOM" (`data-orientation`, `data-channel`, `data-disabled` on the color parts) and "Types" (`HsvColor`, `ColorPickerShape` and the new prop types).
- **Compatibility.** Additive API. The default ColorPicker layout changes visibly; its opacity slider keeps its accessible name ("Opacity", `labels.opacity`), its role and its 0–100 values; `children` changes meaning; `typeof ColorPicker` gains static members.
- **Size.** L. **Depends on:** none.

### P3-06 — Tree multi-select with checkboxes and a mixed state (P3-tree, first)

- **Closes:** `tree-1` (H).
- **API** (`Tree.core.tsx`; the compound and flat names in `Tree.tsx`):
  ```ts
  // TreeProps gains:
  /**
   * How items are selected. `'none'`: activation only (0.7; `selected` highlights one item).
   * `'single'`: a radio indicator on every item for `selected`/`onItemSelect`. `'multiple'`: a
   * checkbox on every item, bound to `checkedItems`; checking an item checks its descendants, and a
   * parent shows checked, mixed or unchecked from them. Fluent's `'multiselect'` is `'multiple'`.
   * @default 'none'
   */
  selectionMode?: 'none' | SelectionMode;
  /** Controlled checked items (`selectionMode="multiple"`); see the cascade rule in the component docs. */
  checkedItems?: readonly string[];
  /** Initially checked items (uncontrolled). @default [] */
  defaultCheckedItems?: readonly string[];
  /**
   * Called with every checked item (in tree order) when a check changes (Fluent's `onCheckedChange`).
   * WaveUI always passes `details`; it is typed optional until 1.0.
   */
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
  Only if the VoiceOver spike of §6.3 finds that VoiceOver does not announce `aria-checked` on a treeitem (§8 Q18), `TreeProps` also gains `labels?: TreeLabels` with `checked` (default `'checked'`), `mixed` (`'partially checked'`) and `unchecked` (`'not checked'`), the visually hidden state text each item's `aria-describedby` then points at. The Tree compound's docblock (0.7: "Enter/Space activate", and its list of flat names) is rewritten for the modes and the new member.
- **Behaviour** (D23, D24, D25).
  - **Model** (`Tree.selection.ts`, pure): `collectItems(children, types)` scans the root's children recursively into `{ value, children }` nodes: `flattenChildren` plus `getElementType(child, { suspend: false })` compared with the item type it is given, Server Component references included; a nested `Tree` (the tree type it is given) and a `leaf` item's children are not descended. `computeCheckStates(nodes, listed)` returns a `Map<string, 'checked' | 'mixed' | 'unchecked'>` by the rule of D24; `toggleCheck(nodes, listed, value)` returns the new array in tree order plus the unmatched listed values. The root memoizes the scan per `children` and the states per `children` and list (C-MEMO) and provides a state lookup and `toggle(value, event)` through the Tree context.
  - **Rendering.** The root renders `data-selection-mode` always (before `{...rest}`), and `aria-multiselectable="true"` in `'multiple'`. Every item in `'multiple'` renders `aria-checked` (`true`/`false`/`mixed`, after `{...rest}` so a consumer cannot contradict it) and `data-checked` or `data-mixed` (before `{...rest}`), and its checkbox: `<span role="checkbox" aria-checked tabIndex={-1} aria-labelledby={labelId} class="wave-tree-item__indicator …">` after the chevron slot, a 16 px box in Checkbox's tokens (checked and mixed fill `primary`, the glyph `primary-foreground`, unchecked `stroke-accessible` border) and Checkbox's forced-colors recipe, inside a 24×24 hit area; it carries no `data-roving-value`, so the roving hook never stops on it. In `'single'` the indicator is a decorative radio circle (`aria-hidden`; the selected item's filled), and every item carries `aria-selected` (`selected ?? null`). In `'none'` nothing changes.
  - **Keys and pointer.** In `'multiple'`, Space toggles the focused item (a Space that continues a typeahead search stays typeahead, 0.7's capture rule), Enter activates (0.7); a click on the checkbox toggles and does not activate (the item's click handler ignores clicks whose target is inside the checkbox); a click elsewhere on the row activates (0.7). In `'single'`, activation selects as 0.7 (`onItemSelect`); the radio indicator's click activates too.
  - **Warnings** (from effects): `Tree:selected-with-multiple` ("Tree: `selected` has no effect with selectionMode=\"multiple\"; use `checkedItems`, and `current` for the item the user is on."), `Tree:single-without-selected`, `Tree:checked-without-multiple`.
- **Keyboard** (README Tree row): Space toggles a checkbox tree's focused item; the rest as 0.7 (Enter activates, `*` expands siblings, typeahead).
- **ARIA.** `aria-multiselectable` on the tree; `aria-checked` (with `mixed`) on items and on their checkboxes; never `aria-selected` and `aria-checked` together on an item (APG).
- **SSR.** The states render in the server HTML (`defaultCheckedItems`, `checkedItems`); hydration logs nothing.
- **RTL.** The indicator sits after the chevron at the start side by DOM order. **Forced colors.** Checkbox's recipe (checked and mixed visible without color). **Motion.** None.
- **Guards** ("Tree `*` key and `current` unchanged"): the 0.7 tests stay green; a checkbox tree test presses `*` and renders `current`.
- **Files.** `Tree.tsx`, `Tree.core.tsx`, `Tree.context.ts`, `Tree.selection.ts` (D32), their tests, `stories/Tree.stories.tsx`.
- **Tests** (`__tests__/Tree.selection.test.ts`, `__tests__/Tree.multiselect.test.tsx`, `Tree.test.tsx` updated for `data-selection-mode`): the model (listed leaves, listed parents checking descendants, listed ancestors, a leaf is checked only when listed or under a listed ancestor, mixed propagating through three levels, the toggle down and up, the emitted order, unmatched values kept, a placeholder item's value, `leaf` items, a nested Tree excluded, collapsed items counted); the component: `aria-multiselectable`, `aria-checked` with `mixed` on the item and its checkbox, `data-checked`/`data-mixed`, the checkbox (`role="checkbox"`, `tabIndex=-1`, named by the item's label, skipped by ArrowDown), Space toggles with `details` (`{ value, checked, event }`), Enter activates without toggling, the checkbox click toggles without activating, the row click activates, controlled (a parent that ignores the callback keeps the state) and uncontrolled, once per change in StrictMode, the three warnings (asserted), single mode (radio indicators, `aria-selected` on every item, also with `selected={null}`), none mode unchanged (only `data-selection-mode="none"` is new), typeahead with Space, `*` and `current`, SSR and hydration, RTL render, axe for each mode (with a mixed parent), forced-colors classes; type tests (`selectionMode` union, `@ts-expect-error` `'multiselect'`, the `details` type).
- **Stories**: `MultiSelect` (a file tree), `ControlledChecks`, `SingleSelect`, `LazyChildren` (a checked parent whose children load later).
- **Docs.** README: a "Trees" usage note (the modes, the cascade rule and the checked list, the placeholder advice, keys, `details`); keyboard table; CHANGELOG Added, "DOM" (`data-selection-mode` on every Tree), and the notice that `details` of `onCheckedItemsChange` becomes required in 1.0.
- **Compatibility.** Additive; `data-selection-mode` is new DOM.
- **Size.** M. **Depends on:** none.

### P3-07 — Tree row actions, aside and treegrid navigation (P3-tree, second)

- **Closes:** `tree-2` (M), `tree-7` (L), `tree-8` (L).
- **API** (`Tree.core.tsx`, `Tree.itemPersonaLayout.tsx`, `src/hooks/useRovingTabIndex.ts`):
  ```ts
  // TreeItemProps gains:
  /**
   * Buttons at the end of the row (a toolbar named by the item's label). Shown while the row is
   * hovered or the item or its actions have focus, and always in forced colors and without hover
   * (touch). Tab reaches them from the focused item (`navigationMode="tree"`), or the arrow keys do
   * (`"treegrid"`). Keys and clicks on them never activate or check the item.
   */
  actions?: React.ReactNode;
  /**
   * Non-interactive content at the end of the row, such as a count or a badge. It describes the item
   * (`aria-describedby`); it hides while the actions show on hover or focus.
   */
  aside?: React.ReactNode;
  /** Icon after the label (decorative, `aria-hidden`; a falsy value renders nothing, as `icon`). */
  iconAfter?: Slot<'span'>;
  /**
   * Replaces the expand chevron (decorative). `null`/`undefined` keep the chevron; `false`, or
   * anything that renders nothing, hides it (`aria-expanded` still reports the state). Not rotated.
   */
  expandIcon?: Slot<'span'>;

  // TreeProps gains:
  /**
   * `'tree'`: Tab from a focused item enters its actions. `'treegrid'`: the "next" arrow (ArrowRight,
   * ArrowLeft in RTL) moves into an item's actions and "previous" returns; on an expanded parent
   * "next" no longer moves to the first child (ArrowDown does). The roles stay `tree` and `treeitem`
   * (Fluent's `navigationMode`). @default 'tree'
   */
  navigationMode?: 'tree' | 'treegrid';

  // UseRovingTabIndexOptions (the public hook) gains:
  /** `false` leaves every item at `tabIndex=-1` (a composite that is reached by arrow keys only). @default true */
  tabStop?: boolean;

  /** Properties for the TreeItemPersonaLayout sub-component (Fluent's `TreeItemPersonaLayout`). */
  export interface TreeItemPersonaLayoutProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** The person's picture, usually an Avatar (size 32 fits a row). */
    media?: React.ReactNode;
    /** A second line under the name; it describes the item. */
    description?: React.ReactNode;
    ref?: React.Ref<HTMLSpanElement>;
  }
  ```
  JSDoc outline of `Tree.ItemPersonaLayout`: "Lays out an item's label as a person: `media`, the name (children) and a `description` under it. Use it as a Tree.Item's label content: the item is named by the name and described by the description. Also exported as `TreeItemPersonaLayout` (Fluent's name)."
- **Behaviour** (D26, D27, D28).
  - **Row layout:** `[chevron | expandIcon | spacer] [checkbox | radio] [icon] [label, flex-1] [iconAfter] [aside] [actions]`; every piece carries its Appendix A class; `iconAfter`, `aside` and `actions` render only when they render content (`slotRendersContent`; `iconAfter` renders nothing for a falsy value, as `icon`).
  - **Actions:** `<span role="toolbar" aria-labelledby={labelId} aria-orientation="horizontal" data-tree-actions="">`, hidden (`invisible`) by default and visible on the row's hover (`group-hover/row:`), while the treeitem has focus (`:focus`, through a selector on the treeitem, not `:focus-visible`), while focus is inside the toolbar (`focus-within:`), under `forced-colors:` and under `[@media(hover:none)]:`. The aside shows by default, hides while the actions show on hover or focus, and shows (before them) where they always show; the treeitem's `aria-describedby` joins the consumer's with the aside's id.
  - **Tab stops:** the toolbar's buttons rove with `useRovingTabIndex({ orientation: 'horizontal', loop: navigationMode === 'tree', tabStop })`, where `tabStop` is `true` only in `'tree'` mode while the item is the tree's active item (focused, or focus inside its actions). The tree's roving hook skips the toolbar's buttons (a nested composite, 0.7).
  - **Isolation** (D27): the item's key and click handlers (0.7's `isOwnKeyEvent` and `isOwnClick`) ignore events whose target is inside its `[data-tree-actions]`; the tree's typeahead ignores key presses from inside actions. A click on the aside is a click on the row (it activates, as the label does).
  - **Keys** (D27): in `'tree'` mode, Tab from the focused item reaches its toolbar (the next tabbable element), arrows move inside it, Shift+Tab returns to the item, Tab leaves the tree. In `'treegrid'` mode, the item's handler takes "next" (`getArrowIntent`): a collapsed parent expands (0.7), otherwise, when the item has actions, focus moves to its first action (the toolbar's `focusValue`); the toolbar's handler takes "previous" on the first action (focus returns to the item), "next"/"previous" between actions without wrapping ("next" on the last action does nothing, prevented), ArrowUp/ArrowDown (focus the previous or next visible item through the tree's `focusValue`) and Home/End (the first or last action), and leaves any of these keys to an action that handles it (`defaultPrevented`, or ArrowUp/ArrowDown on an action with `aria-haspopup`). Without actions, `'treegrid'` behaves as `'tree'`.
  - **`expandIcon`** (the optional-indicator rule, C-SLOTS): the default chevron keeps 0.7's rotation and mirroring; a custom icon is rendered as given (not rotated), `aria-hidden`.
  - **`Tree.ItemPersonaLayout`** (D28): `<span class="flex items-center gap-2">` with the media (`shrink-0`, when it renders content), and a column with the name (`<span id={nameId}>`) and the description (`<span id={descriptionId} class="text-caption-1 text-muted-foreground">`, when it renders content); it registers both ids with its item (the Tree item context), and the item's `aria-labelledby` becomes the name (a consumer `aria-label`/`aria-labelledby` still wins) and its `aria-describedby` joins the description. Typeahead matches the label text, which starts with the name.
- **Keyboard** (README Tree row): the treegrid keys above (and that `'treegrid'` replaces APG's "next on an open node moves to its first child"); in `'tree'` mode, Tab into the focused item's actions.
- **ARIA.** The toolbar named by the item's label; roles unchanged (D27); the aside and a persona's description in the item's description; the actions' buttons named by their own labels (an icon-only button needs an `aria-label`, as everywhere).
- **SSR.** CSS-only visibility; the server HTML renders the actions (hidden by class). **RTL.** "next"/"previous" through `getArrowIntent`; an RTL test. **Forced colors.** Actions and aside always visible; focus rings visible. **Motion.** None.
- **Guards** ("Tree `*` key and `current`"): `*` still expands the siblings of an item with actions (and does nothing when pressed on an action); the 0.7 tests stay green.
- **Files.** `Tree.core.tsx`, `Tree.context.ts`, `Tree.itemPersonaLayout.tsx`, `Tree.tsx` (the new member), `src/hooks/useRovingTabIndex.ts` and `src/hooks/__tests__/useRovingTabIndex.test.tsx` (the `tabStop` option), `scripts/verify-dist.mjs` (the `'Tree'` bridge line only, §0.2 rule 21), their tests, `stories/Tree.stories.tsx`.
- **Tests** (`__tests__/Tree.actions.test.tsx`, `__tests__/Tree.itemPersonaLayout.test.tsx`, `useRovingTabIndex.test.tsx`): the row order and classes; the toolbar's role, name and visibility classes (hover, `:focus`, focus within, forced colors, no hover), and no toolbar for `actions={[]}`; the aside's complementary classes and its place in the description; `'tree'` mode (Tab from the focused item to its first action, the other rows' actions at `tabIndex=-1`, arrows inside the toolbar with wrapping, Shift+Tab back); `'treegrid'` mode (next expands a collapsed parent, moves into the actions of an expanded parent or a leaf, previous returns, up and down from an action, no wrapping and nothing on "next" at the last action, Home/End, Tab leaves the tree, every action at `tabIndex=-1`); isolation (Enter, Space and a click on an action run only the action: no `onItemSelect`, no check toggle, no expansion, in both modes and in `'multiple'`; `*` and a letter pressed on an action do nothing to the tree; ArrowDown on a MenuButton action opens its menu, with the 0.7 Menu); RTL (ArrowLeft is next); `iconAfter` (a falsy value renders nothing); `expandIcon` (`null`, `undefined`, `false`, `''`; `aria-expanded` kept); `Tree.ItemPersonaLayout` (the item named by the name only, described by the description, typeahead by the name); `useRovingTabIndex` with `tabStop: false` (every item at `-1`, arrow keys still move) and the default (0.7 unchanged); axe with actions and persona rows; `testSystemProps` for `Tree.ItemPersonaLayout`; flat name and `asClientReference`; StrictMode.
- **Stories**: `RowActions`, `TreegridNavigation`, `AsideContent`, `CustomExpandIcon`, `PersonaRows`.
- **Docs.** README "Trees" (actions, aside, `navigationMode`, `Tree.ItemPersonaLayout`); keyboard table; "React Server Components" table (`TreeItemPersonaLayout`); "Hooks and utilities" (`useRovingTabIndex`'s `tabStop`); CHANGELOG Added.
- **Compatibility.** Additive; `typeof Tree` gains `ItemPersonaLayout`; `UseRovingTabIndexOptions` gains an optional member.
- **Size.** M. **Depends on:** P3-06 (the module split and the row layout).

### P3-08 — A toaster handle: dispatching from outside React components (P3-toasts, last)

- **Closes:** `toaster-5` (L).
- **Source.** Added to the roadmap from GitHub issue #5 on `docs/issues-4-7` (7ba32ec), after the design review of the other items; its design here awaits the maintainer's approval with the rest of the spec (§8 Q19, Q20).
- **API** (`src/lib/toaster.ts`, server-safe and public; the Toaster prop in `Toaster.tsx`):
  ```ts
  /**
   * A toast controller that code outside React components can call (a query-cache callback, a
   * server-event handler, a shared helper). Bind it to one Toaster with `<Toaster toaster={handle}>`;
   * toasts dispatched through it render there. One handle per Toaster is also how an app runs
   * several Toasters (Fluent's `toasterId`).
   */
  export interface ToasterHandle extends ToastController {}
  /** Creates a handle. It touches no DOM, so a module-scope handle is safe during server rendering. */
  export function createToaster(): ToasterHandle;

  // ToasterProps gains:
  /** Binds this Toaster to a handle from `createToaster()`: toasts dispatched through the handle render here. */
  toaster?: ToasterHandle;
  ```
  The binding is internal: a module-private `WeakMap` from handle to its state, read by the Toaster through an internal export of `src/lib/toaster.ts` (not in the barrel), so `ToasterHandle` exposes nothing but the controller.
- **Behaviour.**
  - **The handle** is a plain object (no React, no DOM; its module imports only types) whose `dispatchToast` (both forms, recognised as P3-01 does), `dismissToast` and `dismissAllToasts` forward to the bound Toaster's controller.
  - **Ids.** `dispatchToast` returns `toastId`, or an id the handle generates (a per-handle prefix and counter, unique across handles and distinct from the Toaster's own ids), which it passes to the Toaster as the `toastId`, so the id is known before any Toaster binds.
  - **Before a Toaster binds,** dispatches wait in the handle's queue in dispatch order; `dismissToast` removes a waiting toast and `dismissAllToasts` empties the queue; when a Toaster binds, it takes the queue in order. (Recommended over a development warning, §8 Q19: an app that dispatches while its Toaster is still mounting, or remounting, loses nothing.)
  - **On the server** (`typeof window === 'undefined'`), a dispatch returns its id and does nothing, so a module-scope handle never carries toasts from one request to the next.
  - **Binding.** `<Toaster toaster={handle}>` binds in a layout effect and unbinds on unmount; StrictMode's simulated unmount rebinds without duplicating toasts (they live in the Toaster's state; the queue was already taken). A handle already bound to another mounted Toaster is not taken over: the second Toaster does not bind and warns once (`Toaster:handle-bound`: "Toaster: this handle is already bound to another Toaster; a handle binds one Toaster. Create one handle per Toaster."). After its Toaster unmounts, the handle queues again.
  - **`useToastController()`** inside a bound Toaster returns the same controller as before; the hook and the handle share the Toaster's toasts, `limit` and timers.
  - **Content context.** A handle's toast renders inside the bound Toaster, so React context in its content (a router for a link) comes from the Toaster's ancestors.
- **ARIA, RTL, forced colors, motion.** Nothing new: a handle's toast is a Toaster toast. **SSR.** `createToaster()` at module scope and `renderToString` of a page with a bound Toaster render no toast and throw nothing.
- **Guards** ("live regions need no provider"; "Toaster timers pause on hover, focus, blur and hidden tabs"; "toasts stay reachable over modals and move out of a Drawer's way"): a handle-dispatched toast runs the same assertions as a hook-dispatched one (announced once, paused, reachable over a modal, moved beside a Drawer).
- **Files.** `src/lib/toaster.ts` (new), `Toaster.tsx`, `src/lib/__tests__/toaster.test.ts` (new), `__tests__/Toaster.handle.test.tsx` (new).
- **Tests** (`src/lib/__tests__/toaster.test.ts`: the handle without React; `__tests__/Toaster.handle.test.tsx`): a toast dispatched from a plain function (no React context) is shown, announced once, timed (fake timers), paused on hover and focus, and dismissed through `handle.dismissToast`; dispatches before binding wait and show in order once a Toaster binds; `dismissToast` of a waiting id removes it and `dismissAllToasts` empties the queue; ids are returned at once and are unique across two handles; two handles bound to two Toasters stay independent (region, position, `limit`); unmounting a Toaster unbinds its handle (the next dispatch waits; a new Toaster takes it); StrictMode binds once and duplicates nothing; a second Toaster on a bound handle warns (asserted) and does not bind; content that reads a test context (standing in for a router) sees the value provided above the Toaster; a node-environment test file (`// @vitest-environment node`) dispatches through a module-scope handle and gets an id with nothing queued, and `renderToString` of a page with a bound Toaster renders no toast; type tests (`ToasterHandle` assignable to `ToastController`; `ToasterProps['toaster']`).
- **Stories** (`stories/Toast.stories.tsx`): `FromOutsideReact` (a module-scope handle; a button's click handler calls a plain function that dispatches).
- **Docs.** README "Toasts": dispatching from code outside components with `createToaster()`, which replaces the bridge-component recipe that `docs/issues-4-7` adds, and several Toasters with one handle each; "React Server Components" (the handle's module is server-safe; a dispatch on the server does nothing); "Hooks and utilities" (`createToaster`); CHANGELOG Added.
- **Compatibility.** Additive.
- **Size.** S. **Depends on:** P3-01 (the controller type the handle implements).

---

## 3. Packages and file ownership

Disjoint within each wave. Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave C), DOCS the documentation files (wave D). Paths without a folder are in `src/components/feedback/` (Toast, MessageBar), `src/components/input/` (color) and `src/components/layout/` (Tree); `__tests__/` is the folder next to them.

| Package | Files (edit) | New files | Items |
|---|---|---|---|
| `F3-foundation` (wave A) | every module under `src/components/` that renders a registered component or part (classes only, §1.2), `src/components/button/Button.slots.tsx` (`withPartClass`) and `Toolbar.parts.tsx` (`withIconBox` switches to it), `MessageBar.status.tsx` (`StatusText` `id`), `src/index.ts` (the registry export only), `src/test-utils.ts`, `src/__tests__/test-utils.test.tsx`, `src/__tests__/conventions.test.ts`, `src/__tests__/public-types.test.ts` (the registry lines and `PENDING_PUBLIC_TYPES` only), `scripts/verify-dist.mjs` (§1.4.4), `scripts/__tests__/verify-dist.test.mjs`, `src/components/button/__tests__/Button.slots.test.tsx`, `__tests__/MessageBar.test.tsx` (the `StatusText` case), the existing tests of §6.4 (their class assertions only) | `src/lib/classNames.ts`, `src/__tests__/classNames.test.ts` | P3-00 |
| `P3-toasts` (wave B) | `Toast.tsx`, `__tests__/Toast.test.tsx`, `stories/Toast.stories.tsx` | `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx`, `src/lib/toaster.ts`, `src/lib/__tests__/toaster.test.ts`, `__tests__/Toast.parts.test.tsx`, `__tests__/Toaster.content.test.tsx`, `__tests__/Toaster.keyboard.test.tsx`, `__tests__/Toaster.handle.test.tsx` | P3-02, P3-01, P3-03, P3-08 |
| `P3-messagebar` (wave B) | `MessageBar.tsx`, `__tests__/MessageBar.test.tsx`, `stories/MessageBar.stories.tsx` | `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, `__tests__/MessageBar.parts.test.tsx`, `__tests__/MessageBar.reflow.test.tsx` | P3-04 |
| `P3-color` (wave B) | `ColorPicker.tsx`, `colorUtils.ts`, `__tests__/ColorPicker.test.tsx`, `__tests__/colorUtils.test.ts`, `src/lib/types.ts` (`HsvColor` and `ColorPickerShape` only), `src/lib/__tests__/types.test.ts` (their type tests), `src/styles/__tests__/tokens.test.ts` (the thumb, focus-indicator and checkerboard pairs), `stories/ColorPicker.stories.tsx` | `ColorArea.tsx`, `ColorSlider.tsx`, `AlphaSlider.tsx`, `ColorPicker.parts.tsx`, `colorName.ts`, `src/lib/color.ts`, `src/lib/__tests__/color.test.ts`, `__tests__/ColorArea.test.tsx`, `__tests__/ColorSlider.test.tsx`, `__tests__/AlphaSlider.test.tsx`, `__tests__/ColorPicker.parts.test.tsx`, `__tests__/colorName.test.ts`, `stories/ColorArea.stories.tsx`, `stories/ColorSlider.stories.tsx`, `stories/AlphaSlider.stories.tsx` | P3-05 |
| `P3-tree` (wave B) | `Tree.tsx`, `__tests__/Tree.test.tsx`, `stories/Tree.stories.tsx`, `src/hooks/useRovingTabIndex.ts` and `src/hooks/__tests__/useRovingTabIndex.test.tsx` (the `tabStop` option only), `scripts/verify-dist.mjs` (the `'Tree'` entry of `PENDING_FLAT_EXPORTS` only, rule 21) | `Tree.core.tsx`, `Tree.context.ts`, `Tree.selection.ts`, `Tree.itemPersonaLayout.tsx`, `__tests__/Tree.selection.test.ts`, `__tests__/Tree.multiselect.test.tsx`, `__tests__/Tree.actions.test.tsx`, `__tests__/Tree.itemPersonaLayout.test.tsx` | P3-06, P3-07 |
| `INTEGRATION` (wave C) | `src/index.ts` (`hsvToHex`, `hexToHsv`, `createToaster` and `ToasterHandle`), `src/components/feedback/index.ts`, `src/components/input/index.ts`, `src/components/layout/index.ts`, `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts` (empties `PENDING_PUBLIC_TYPES`), `src/__tests__/classNames.test.ts` (empties `PENDING_CLASS_NAMES`), `scripts/verify-dist.mjs` (empties `PENDING_FLAT_EXPORTS`; the color, Toaster and handle probes of D30 and §6.2), `scripts/__tests__/verify-dist.test.mjs`, `stories/_helpers.ts`, the stories of the new modules (their imports switch to `'../src'`, rule 25), the 0.7 tests a wave-B change breaks that no wave-B package owns | — | seams |
| `DOCS` (wave D) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md` | — | docs |

Disjointness check (wave B): the four packages share no file. `src/lib/classNames.ts` and `MessageBar.status.tsx` are read only in wave B (F3 wrote them); `src/lib/types.ts`, `src/lib/color.ts` and `tokens.test.ts` belong to `P3-color` alone, `src/lib/toaster.ts` to `P3-toasts`, and `useRovingTabIndex.ts` and the one bridge line of `scripts/verify-dist.mjs` to `P3-tree`; the barrels are untouched until wave C, because every compound module keeps its path and re-exports the types the barrels import (D32, rule 22). Inside `P3-toasts` the items run P3-02 → P3-01 → P3-03 → P3-08 (the content form renders through the container of P3-02, the keys act on it, and the handle forwards to the controller of P3-01); inside `P3-tree` P3-06 → P3-07 (the row layout and the split come first). `P3-color` is the critical path of wave B (L); the lead commits it at a checkpoint after the standalone parts pass, so INTEGRATION can start the color cases while the ColorPicker composition finishes.

**Branches to merge first.** `docs/issues-4-7` (the roadmap's P3-08 and the README's toast recipes, which DOCS rewrites) merges to `main` before wave A. `fix/dialog-surface-margin` (in progress in another session) changes the class strings of `Dialog.Content`'s backdrop and surface and opens the CHANGELOG's `## [0.8.0] - Unreleased` section: if it merges first, F3 rebases onto it (a two-line merge in `Dialog.tsx`) and DOCS adds this phase's entries to that section (§5.1).

Waves:
1. **Wave A:** `F3-foundation`. Exit: §1.7. The lead runs the VoiceOver spike of §6.3 meanwhile.
2. **Wave B:** the four packages in parallel. Each reports its barrel requests, the 0.7 tests it updated (with the reason), any failure of another package's test it saw, and any change request (a registry key, §0.2 rule 20). Between wave B and wave C, nothing is red: `verify-dist`, `classNames.test.ts` and `public-types.test.ts` pass through their pending lists (rule 24).
3. **Wave C:** INTEGRATION: the barrels and `src/index.ts` (§4.3), the pending lists emptied, the probes of D30 and §6.2, the story imports, the cross-package tests (§4.4), public types (§4.5), the Server Component regression cases, the full gate.
4. **Wave D:** DOCS against the final API (§5).
5. **Wave E (lead):** the final gate and the real-browser and screen-reader checklist (§6.3), and the per-theme Storybook check of the new stories (light, dark, high contrast, RTL).

---

## 4. Cross-package contracts

### 4.1 Class names (F3-foundation → every package)

- The registry is frozen in wave B (§0.2 rule 20). Every new element a wave-B package creates for a registered part carries exactly the class Appendix A names for it, applied by the rules of §1.2 (first in `cn()`, through `renderSlot`'s base classes for slots, through `withPartClass` for a variant's icon, the parent's part class on a nested public component, literal member access).
- The new `testClassName` case runs for every new part a package tests with `testSystemProps`; a part that renders no element (`Toast.Close`) needs no constant.
- The pending lists tolerate wave B (rule 24): `PENDING_CLASS_NAMES` skips a Phase 3 entry whether or not it is applied yet; `NO_ELEMENT` ignores `ToastClose` until it is exported.
- A package that needs a key Appendix A lacks, or finds an element that meets the part rule and has no key, files a change request; the lead edits the registry and tells the other packages.

### 4.2 The severity text (F3-foundation → P3-toasts, P3-messagebar)

- `StatusText` takes an `id` (§1.3). `P3-toasts` gives it the id the container's `aria-labelledby` names first (D10); `P3-messagebar` the id of a labelled bar (D16). Neither changes `MessageBar.status.tsx`.

### 4.3 Barrels, entry, compound members and pending lists (INTEGRATION applies)

- `src/components/feedback/index.ts`: `ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `MessageBarTitle`, `MessageBarActions`; types `ToastTitleProps`, `ToastBodyProps`, `ToastFooterProps`, `ToastCloseProps`, `ToastCloseRenderProps`, `ToastDispatchOptions`, `ToasterShortcuts`, `MessageBarTitleProps`, `MessageBarActionsProps`. The barrel keeps importing `Toast`, `Toaster`, `useToastController` and the 0.7 types from `./Toast` (D32).
- `src/components/input/index.ts`: `ColorArea`, `ColorSlider`, `AlphaSlider`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`; types `ColorAreaProps`, `ColorAreaLabels`, `ColorSliderProps`, `ColorSliderLabels`, `AlphaSliderProps`, `AlphaSliderLabels`, `ColorPickerHexFieldProps`, `ColorPickerSwatchesProps`, `ColorPickerPreviewProps`.
- `src/components/layout/index.ts`: `TreeItemPersonaLayout`; types `TreeItemPersonaLayoutProps`, `TreeCheckedItemsChangeDetails` (and `TreeLabels` if the VoiceOver spike adds it, §8 Q18).
- `src/index.ts`: `hsvToHex`, `hexToHsv` from `./lib/color`; `createToaster` and the type `ToasterHandle` from `./lib/toaster`. `HsvColor` and `ColorPickerShape` are public through `export type * from './lib/types'`; the registry since wave A; `useRovingTabIndex`'s `tabStop` through its existing options type.
- With the barrels extended, INTEGRATION empties the three pending lists (rule 24), adds the probes of D30 and §6.2 that need the wave-B modules (the color modules dropped from the Button-only bundle; `hooks/usePresence.mjs` in the Toaster-only bundle; the handle's module readable under `react-server`), switches the new stories to `'../src'` (rule 25) and runs `node scripts/verify-dist.mjs --final`.

### 4.4 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

1. **A Menu in a toast** (the roadmap's reason for 0.7 as Phase 3's entry): a dispatched `<Toast>` whose title `action` is a MenuButton with a Menu. The menu opens from the toast; while focus is in the menu (a portal), the toasts' timers stay paused (React focus events bubble through the portal to the viewport's pause handlers, which count them); Escape closes only the menu (its target is outside the viewport, and the menu's layer is anchored inside it: D14) and focus returns to the MenuButton; a second Escape dismisses the toasts and returns focus to the origin; Delete and Backspace on a menu item keep the toast.
2. **A toast over a modal Dialog:** the toast's Undo button is reachable by Tab while the Dialog is open (0.7's allow-list); Escape in the toast dismisses the toasts, leaves the Dialog open and returns focus into it; Delete on a focused toast dismisses only that toast; Delete in a Dialog opened from a toast keeps the toast.
3. **A Tooltip on a toast's button:** with the tooltip shown, Escape hides only the tooltip (WCAG 1.4.13); the next Escape dismisses the toasts. A Popover opened from a toast: Escape in it closes only the popover.
4. **`Toast.Close` around a `Button` and a `Link`** in a title action and in a footer (the composed `onClick` reaches the Button; `preventDefault()` in the Button's `onClick` keeps the toast).
5. **The toaster handle** (P3-08): a module-scope `createToaster()` handle bound to a Toaster inside a test context provider (standing in for a router): a plain function dispatches a `<Toast>` whose Link reads the context; it is shown, announced once and dismissed through the handle; a Toaster with a second handle in the same page stays independent.
6. **A MenuButton in `MessageBar.Actions`:** the menu opens and Escape returns focus to the MenuButton; the bar's content reads "Warning: <title> <body>" once, the actions' labels after it.
7. **ColorPicker in a Field** (composed: `ColorArea`, `ColorSlider`, `ColorPicker.HexField`, bound): the group named by the Field's label, the hex input described by the Field's error; a form submit with `name` carries the hex; a form reset restores the default and keeps the working hue; a standalone ColorSlider in a Field (its input named by the Field's label, not "Hue", C-ROUTING).
8. **ColorPicker in a Popover** (the `InPopover` recipe): dragging the area does not dismiss the popover (the press starts inside the surface); Escape closes the popover and returns focus to its trigger (the color parts consume no Escape).
9. **A Tree with a MenuButton in its actions**, `navigationMode="treegrid"`: ArrowRight reaches the action, ArrowDown on it opens the menu (not the next item), Escape returns focus to the action, ArrowLeft returns to the item; Enter on the action never activates the item; a checkbox Tree in a Dialog: Space toggles, Escape closes the Dialog.
10. **Class names across compounds:** a Toolbar with a `Toolbar.ToggleButton` (`wave-toolbar`; `wave-button wave-toggle-button wave-toolbar-toggle-button`, and its icon's three classes through `withPartClass`), a SplitButton's halves, a `Dialog.Content`'s close button and a Persona's Avatar carry the classes Appendix A names; a Menu in a toast carries both components' classes.
11. **The Server Component regression suite:** every new compound member (`ToastTitle`, `ToastBody`, `ToastFooter`, `ToastClose`, `MessageBarTitle`, `MessageBarActions`, `ColorPickerHexField`, `ColorPickerSwatches`, `ColorPickerPreview`, `TreeItemPersonaLayout`) through `asClientReference`: the same `renderToString` output and behaviour as the dotted parts; a server render that reads `buttonClassNames.root` from the entry; a module that creates a toaster handle, imported by a server render.

### 4.5 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

`expectTypeOf` for every new member exported from the package entry, including: `ToastController['dispatchToast']` callable with `(options: ToastOptions)` and with `(content: ReactNode, options?: ToastDispatchOptions)`, returning `string`, and `Parameters<ToastController['dispatchToast']>` equal to `[options: ToastOptions]` (0.7's); `ToastDispatchOptions` members; `ToastProps['icon']` equal to `Slot<'span'> | undefined`; `ToastCloseRenderProps`; `typeof Toast.Title` equal to `typeof ToastTitle` (and the other members of the four compounds); `ToasterProps['shortcuts']` and `ToasterProps['toaster']`; `ToasterHandle` assignable to `ToastController` and `createToaster()` returning it; `MessageBarProps['layout']` equal to `'auto' | 'singleline' | 'multiline' | undefined`; `HsvColor` members; `ColorPickerShape` equal to `'rounded' | 'square'`; `hsvToHex` and `hexToHsv` signatures; `ColorAreaProps['value']` equal to `HsvColor | undefined`; `ColorSliderProps['channel']` and `['orientation']`; `AlphaSliderProps['transparency']`; `ColorPickerProps['shape']` equal to `ColorPickerShape | undefined`; `ColorPickerLabels['colorName']` and `['valueText']`; `TreeProps['selectionMode']` equal to `'none' | SelectionMode | undefined`; `TreeProps['onCheckedItemsChange']` accepting a one-argument callback and `setState`; `TreeCheckedItemsChangeDetails` members; `TreeItemProps['actions' | 'aside' | 'iconAfter' | 'expandIcon']`; `TreeProps['navigationMode']`; `TreeItemPersonaLayoutProps`; `UseRovingTabIndexOptions['tabStop']`; the literal types of a few registry constants; `@ts-expect-error` for `layout="wrap"`, `channel="alpha"`, `selectionMode="multiselect"`, `navigationMode="grid"`, `shape="circular"` on ColorPicker and an assignment to `buttonClassNames.root`.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave D)

### 5.1 CHANGELOG

The `## [0.8.0] - Unreleased` section above `## [0.7.0] - 2026-09-26`: DOCS creates it, or adds to it when an earlier merge opened it (`fix/dialog-surface-margin` adds one with a "Changed" entry for the Dialog surface's margin; §3):

- **Intro:** the third Fluent-parity release (Phase 3 of the roadmap: notifications, color and trees, and stable class names); it closes 4 high, 6 medium and 10 low gaps and mitigates `buttons-29` (ids in backticks); nothing public removed or narrowed; read "Upgrading from 0.7" before upgrading if tests assert Wave's DOM, class strings or console output.
- **Upgrading from 0.7** (numbered):
  1. Every component root and named part carries a stable class (`wave-button`, `wave-button__icon`, …); assertions on a complete class string change.
  2. A toast in the Toaster renders inside a container (`role="group"`, `tabIndex="-1"`, named by its severity and title, `data-wave-toast` and `data-presence` on it); the 0.5 title and body render as the `Toast.Title` and `Toast.Body` elements.
  3. Escape inside the toast region dismisses the toasts (after closing a tooltip or menu of a toast); it no longer closes a Dialog or Drawer below.
  4. Every toast pauses while the pointer or focus is anywhere in the toast region (0.7 paused the hovered or focused toast only).
  5. A toast dispatched with content that holds an action stays until it is dismissed unless the dispatch passes a `timeout` (the options form is unchanged).
  6. Every MessageBar renders `data-layout`; a bar without actions looks as before.
  7. Every Tree renders `data-selection-mode`.
  8. The default ColorPicker gains a color area and a hue slider; with `showOpacity` its opacity slider becomes an alpha slider (still named "Opacity", 0–100); `children` of ColorPicker now render a custom layout (0.7 ignored them).
  9. `ToastController['dispatchToast']` is overloaded: a test double that implements it must accept content too.
- **Added** (by component, each with its gap ids): stable class names and the registry (P3-00); `dispatchToast` with React content (P3-01); Toast parts, `Toast.Close` and `icon` (P3-02); Toaster `shortcuts`, Escape, Delete and Backspace (P3-03); `createToaster` and `<Toaster toaster>` (P3-08); `MessageBar.Title`, `MessageBar.Actions`, `layout` (P3-04); `ColorArea`, `ColorSlider`, `AlphaSlider`, the composable ColorPicker (`ColorPicker.HexField`, `ColorPicker.Swatches`, `ColorPicker.Preview`), `shape`, `HsvColor`, `ColorPickerShape`, `hsvToHex`, `hexToHsv` (P3-05); Tree `selectionMode`, `checkedItems` with the cascade (P3-06); Tree `actions`, `aside`, `iconAfter`, `expandIcon`, `navigationMode`, `Tree.ItemPersonaLayout`, and `useRovingTabIndex`'s `tabStop` (P3-07); the new public types.
- **Changed:**
  - Behaviour: Escape in the toast region; region-wide pausing; toasts with actions stay (P3-01, P3-03); ColorPicker `children` (P3-05).
  - Visual: the default ColorPicker layout and its opacity row (P3-05).
  - DOM: the stable classes; the toast container; `data-layout`; `data-selection-mode`; `data-orientation`, `data-channel` and `data-disabled` on the color parts; `data-presence` on toast containers (enumerated attributes always present, boolean ones present or absent, Phase 1 D22).
  - Types: `ToastController['dispatchToast']` is overloaded (derived `Parameters<>` unchanged); `typeof Toast`, `typeof MessageBar` and `typeof ColorPicker` gain static members and `typeof Tree` gains `ItemPersonaLayout`; `UseRovingTabIndexOptions` gains `tabStop`.
- **Deprecated:** nothing new. Notice: the `details` parameter of `onCheckedItemsChange` becomes required in 1.0, like `onOpenChange`'s and `onCheckedValuesChange`'s. The stable class names are covered by the 0.x promise: none is removed before 1.0 (D8).
- **Size:** `dist/styles.css`, an import of only `Button`, of only `Toaster`, of only `ColorPicker` and of everything, against 0.7.0, measured as 0.7 did.

### 5.2 README

- "Components": the Toast row (rich content, parts, keyboard, the toaster handle), the MessageBar row (title, actions, layout), the ColorPicker row (composable) and new rows for `ColorArea`, `ColorSlider` and `AlphaSlider`, the Tree row (multi-select, actions, persona rows).
- New "Styling hooks" section (P3-00): the formula, an example in app CSS and a typed selector, variants and nested components, no state classes (use `data-*`), the stability promise, readable in Server Components; per-part tables come with P13-01.
- "React Server Components": the flat-name table gains the Toast, MessageBar, ColorPicker and Tree parts; a line that the class-name constants, the color helpers and `createToaster` are readable in Server Components.
- "Toasts" rewritten around rich content (the roadmap's exit criterion; P3-01 … P3-03, P3-08): dispatching a `<Toast>` with parts; the options form; severity; what is announced; toasts with actions and `timeout`; the Dismiss button; the keyboard (a shortcut with a modifier, WCAG 2.1.4); dispatching from code outside components with `createToaster()` (replacing the bridge-component recipe of `docs/issues-4-7`) and several Toasters.
- New usage notes: "Message bars" (P3-04: title, actions, layouts, the labelling rule), "Color" (P3-05: the binding rule, hex versus `HsvColor`, the helpers, the keys, `labels.colorName`/`valueText`), "Trees" (P3-06, P3-07: the modes, the cascade rule and the checked list, lazy placeholders, the actions and the two navigation modes).
- "Keyboard support": the Toaster row, `ColorArea`, `ColorSlider`/`AlphaSlider`, the Tree row (Space toggles checks; the treegrid keys and their difference from APG; Tab into a row's actions).
- "Hooks and utilities": `hsvToHex`, `hexToHsv`, `createToaster`, `useRovingTabIndex`'s `tabStop`; the class-name constants.
- "Built-in text": the labels of `ColorArea`, `ColorSlider`, `AlphaSlider` and ColorPicker's new labels (with their defaults, and `colorName`/`valueText` as functions); `TreeLabels` if the spike adds it.
- "Upgrading from 0.7": a short list pointing to the CHANGELOG.

### 5.3 CLAUDE.md

- "What is this?": 68 components (with `ColorArea`, `ColorSlider`, `AlphaSlider`); "User docs": add this spec.
- Architecture: `src/lib/classNames.ts` (the class-name registry, server-safe, public), `src/lib/color.ts` (public HSV helpers) and `src/lib/toaster.ts` (the toaster handle); component-private helpers add `Toast.root.tsx`, `Toast.parts.tsx`, `Toast.context.ts`, `Toaster.tsx`, `MessageBar.parts.tsx`, `MessageBar.reflow.ts`, `ColorPicker.parts.tsx`, `colorName.ts`, `Tree.core.tsx`, `Tree.context.ts`, `Tree.selection.ts`, `Tree.itemPersonaLayout.tsx` (with the one-way import rule of the Menu split), and `withPartClass` in `Button.slots.tsx`; `useRovingTabIndex` gains `tabStop`.
- C-CLASS: "Every public component and part carries its stable class from `src/lib/classNames.ts` (`wave-<name>`, `wave-<name>__<part>`), first in its `cn()`, on the element that receives `className`, written as a literal member access (`buttonClassNames.root`); variants carry their base classes (a variant's icon through `withPartClass`), and a nested public component its parent's part class; no state classes; no class removed before 1.0. A new component or part registers its constant in the same change; the conventions gate (`class-names`) and `testSystemProps` enforce it."
- C-COMPOSE: the region-wide pause handlers of the Toaster count portal focus on purpose (the one exception to the portal rule, named there).
- Testing: the `testClassName` stable-class case and `getStableClassNames`; the pending lists of `verify-dist`, `classNames.test.ts` and `public-types.test.ts`; `mockAnimations({ animated })` for the toast container; ResizeObserver reflow tests (spy on `ResizeObserver.prototype.observe`); `setPointerCapture` stubs for the color area.

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md`: a new pattern "Stable class names" (registering and applying a constant, the part rule, variants and `withPartClass`, literal member access, the gate); the accessibility chapter: the 2-D slider (ColorArea's one Tab stop and two sliders), the checkbox tree with its cascade and its exposed checkbox, the toast container, its keys and its region-wide pause, a MessageBar's live-region naming.
- `docs/testing-best-practices.md`: the stable-class case of `testClassName`; testing toasts (content dispatch, the live regions, presence through `mockAnimations({ animated: (el) => el.hasAttribute('data-wave-toast') })`, the shortcut, the handle); testing the MessageBar reflow (`installResizeObserverMock` with a spy on `observe`, stubbed `scrollWidth`/`clientWidth`); testing the color parts (pointer capture stubs, `mockRect`, RTL, `mockMatchMedia` for the pointer type); the cascade model's pure tests.

### 5.5 ROADMAP

- Status line: Phase 3 implemented on `feat/fluent-parity-phase-3`, unreleased; link this spec.
- Phase 3 entries: note where the spec changed the sketches: D2 the registry in `src/lib`; D8 `buttons-29` mitigated; D9 `Toast.Close` and `icon` on the root; D12 toasts with actions stay; D16 the MessageBar title names only a non-live bar; D17 `'auto'` measures the text and never clips; D21 the standalone color parts bind to the picker, `ColorPicker.Preview` added and no `Area`/`HueSlider`/`AlphaSlider` members; D25 an exposed checkbox; D27 `navigationMode` keyboard-only; D28 `Tree.ItemPersonaLayout`; D33 the handle's queue. P3-00's acceptance "verify-dist flat names include the constants" is met by the entry check of §1.4.4.
- P13-02 closes `buttons-29` (moved from P3-00); the release overview table and its totals follow (Phase 3: 4 / 6 / 10 with P3-08; Phase 13 gains one low gap).
- P13-03 and P14-02: the `details` parameter of `onCheckedItemsChange` joins their lists.
- P11-04: revisit real `treegrid` roles with the flat model. P13-01: the part keys of Appendix A are the `slotProps` keys.
- §8.3 "Intentional differences", Phase 3: a toast's severity comes from the rendered Toast (Fluent: the dispatch options only); every toast in the Toaster shows the Dismiss button (the opt-out stays `toaster-9`); toasts with actions stay until dismissed unless a timeout is passed; all toasts pause while the region has the pointer or focus; a MessageBar's title does not name a live-region bar, and one DOM order serves both layouts; ColorArea mirrors in RTL; tree checks cascade (Fluent's nested Tree keeps them independent); `navigationMode` keeps the tree roles (as Fluent); Backspace also dismisses a focused toast.
- §8.5 follow-ups: arrow keys between toasts; a non-cascading mode for tree checks; Shift+Arrow, Shift+Space and Ctrl+A in a multi-select tree; real treegrid roles with the flat model.

---

## 6. Verification and exit criteria

### 6.1 Per package (waves A and B)

The checks of Phase 1 §0.2 rule 8 with clean output (no act() warnings; every `[WaveUI]` warning asserted), with the package's folder barrel inside its `tsc` filter (rule 22). Every new behaviour has a test that failed first. The conventions gate (with the `class-names` rule from wave A on) and the stories gate are green for the package's files.

### 6.2 `verify-dist` probes and sizes

| Check | Gate | Where |
|---|---|---|
| An import of only `Button` contains no Dialog code (0.5) | fails `verify-dist` | `probeTreeShaking` |
| An import of only `Button` contains neither `hooks/usePresence` nor `components/motion/Presence` (0.7) | fails `verify-dist` | `probeTreeShaking` `dropModules` |
| An import of only `Menu` contains `hooks/usePresence` (0.7) | fails `verify-dist` | `probeIncludes` |
| The presence closure within its budget (0.7) | fails `verify-dist` | `probeSizeBudget` |
| An import of only `Button` contains the literal `'wave-button'` and not `'wave-dialog-content'`; a listed string absent from every dist module is an error (D30; F3) | fails `verify-dist` | `probeTreeShaking` `keepStrings`/`dropStrings` |
| Every export of `lib/classNames` is exported by the entry with the same value, ESM and CJS (D7; F3) | fails `verify-dist` | a new entry check |
| The constants are plain objects under `--conditions=react-server`, read from the entry (D2; F3) | fails `verify-dist` | `checkServerImport` |
| `buttonClassNames` is declared in `index.d.ts` (F3) | fails `verify-dist` | `checkDeclarations` |
| An import of only `Button` contains none of `ColorArea`, `ColorSlider`, `AlphaSlider`, `lib/color`, `lib/toaster` (D30; INTEGRATION) | fails `verify-dist` | `probeTreeShaking` `dropModules` |
| An import of only `Toaster` contains `hooks/usePresence` (D29; INTEGRATION) | fails `verify-dist` | `probeIncludes` |
| `lib/toaster` loads under `--conditions=react-server` and `createToaster()` returns a handle whose dispatch returns an id (D33; INTEGRATION) | fails `verify-dist` | `checkServerImport` (a module check) |
| Every compound exports its flat names; `PENDING_FLAT_EXPORTS` is empty | fails `verify-dist --final` | `checkFlatExports` |
| `dist/styles.css`, Button-only, Toaster-only, ColorPicker-only and full-import sizes against 0.7.0 | reported in the CHANGELOG | measured once for the release |

Expectations to check in the report: every component bundle grows by its class-name strings only (no other registry constant is included); `dist/styles.css` grows by the new components' utilities (the stable classes generate no CSS); the Button-only bundle contains no color, toast or tree code.

### 6.3 Final gate (wave E), and one check before wave B

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final` (with the §6.2 probes and the three pending lists empty), `npm run check:package`, `npm run test:pack`, `npm run build-storybook`; the stories axe gate and the conventions gate green; the lead checks every new story in the light, dark and high-contrast themes and in RTL. The lead bumps `package.json` to 0.8.0 at release time, not in this phase's packages.

**The VoiceOver spike, before wave B.** During wave A the lead builds a throwaway page with a checkbox treeitem (`role="treeitem"`, `aria-checked` true, false and `mixed`, inside `role="tree"` with `aria-multiselectable`) and checks VoiceOver with Safari on macOS and iOS: if VoiceOver announces the state (and "mixed" or an equivalent), P3-06 ships as specified; if it does not, P3-06 adds `TreeLabels` and the visually hidden state text of §2 P3-06 (§8 Q18). The result goes into the wave A report.

**Real-browser and screen-reader checklist.** jsdom has no layout, no hit testing, no ResizeObserver, no pointer capture and no screen reader, so the lead checks these in Storybook (Chrome, Firefox and Safari; NVDA with Chrome, JAWS with Edge, Narrator with Edge, VoiceOver with Safari on macOS and iOS, TalkBack with Chrome on Android; Voice Control on macOS or iOS and Dragon on Windows) and names each result as exit evidence in the wave E report:
1. **Class names:** the stable classes appear in the DOM of a sample of stories, and in the Tailwind fixture's build (`test:pack`) no utility is generated for them.
2. **Toasts:** a rich toast is announced once ("Success: Email sent Your message was delivered. Undo"), an error toast assertively; the shortcut focuses the newest toast and the screen reader announces its group name; Escape returns focus to where it was; Escape with a tooltip shown on a toast's button hides only the tooltip; Delete and Backspace dismiss (also with JAWS's virtual cursor on, where the keys may be taken by the screen reader: record it); Escape in a toast over a Dialog leaves the Dialog open; the timers stay paused while a menu opened from a toast has focus; a toast with an action stays and can be reached with TalkBack, VoiceOver iOS, Voice Control and Dragon ("click Undo"); toasts that stay never hide a focused element of the page (WCAG 2.4.11); with an app's exit classes and reduced motion off, focus never lands on an exiting toast.
3. **MessageBar:** a titled alert is read once, title included, with the default role; a `role="region"` bar appears in the landmarks list with the name "Warning: <title>"; `'auto'` switches to multiline and back as the window narrows and widens, with no jump on load; at 320 px width, 400 % zoom and with WCAG 1.4.12 text spacing no text is cut off (also with explicit `'singleline'`).
4. **Color:** dragging the area and the sliders with a mouse, with touch (Android Chrome, iOS Safari) and with a pen; desktop screen readers list one 2-D slider and Tab stops on the area once; VoiceOver on iOS and TalkBack adjust saturation and brightness with swipes (record the step size) and reach both 1 px hidden inputs (if VoiceOver iOS cannot, lay the inputs over the field with `opacity: 0` and `pointer-events: none`, a change the lead approves); NVDA reads "Saturation 72%, Brightness 74%, dark blue, 2D slider"; RTL mirrors the area and the horizontal rails; vertical sliders (the rotated input) work in Chrome, Edge, Firefox and Safari; the thumbs' two-tone focus indicator is visible at the default brand blue in all three themes; Windows High Contrast shows the thumb rings and the focus indicator; the checkerboard is visible in all three themes.
5. **Trees:** NVDA, JAWS, Narrator (the Toggle pattern), VoiceOver and TalkBack announce a parent's mixed state on the item and on its checkbox; whether NVDA says "not selected" on every item of the `aria-multiselectable` tree (record it); Space toggles; a double tap (VoiceOver iOS, TalkBack) on the checkbox toggles and on the item activates, also on an expanded parent whose activation point may fall inside its child group; Voice Control and Dragon reach the checkbox by name; row actions show on hover, on focus, on touch and in forced colors, and the aside shows beside them where they always show; the treegrid arrows reach the actions and back; JAWS and NVDA in focus mode on an action; the toolbar is announced with the item's name; forced colors draw the checkbox and radio indicators; at 320 px width and 400 % zoom the rows reflow without hiding their actions.
6. **The toaster handle:** a toast dispatched from a plain module function in the story is announced and behaves like a hook-dispatched one; a server-rendered page with a module-scope handle carries no toast.

### 6.4 Existing tests expected to change (update, do not delete)

From a read of every test, story and script test at bcbdb51. There are no snapshot files and no story `play` functions; stories reach these components only through the axe gate.

- **`F3-foundation` (wave A), exact class comparisons** (24 assertions in 6 files). They compare a rendered class list with the style helper's (`buttonClassName(…)`) or with a literal string; they become the helper's classes plus the registry classes the element carries (read from the constants, not written as literals): `Drawer.test.tsx:1649` (a `Dialog.Footer`'s complete class string); `MenuButton.test.tsx:540-541`; `CompoundButton.test.tsx:229-231` (the icon-only CompoundButton against the icon-only Button: they now differ by CompoundButton's own class); `ToggleButton.test.tsx:415, 426, 437, 452, 466, 548, 575, 589, 593, 611`; `Toolbar.test.tsx:853-856, 876, 879, 882`; `Toolbar.parts.test.tsx:229, 403, 443, 998`.
- **`F3-foundation`, checked and unchanged:** the equality checks that render the same tree on both sides (Badge `severe` against `important`; about twenty `renderToString` plain-against-lazy comparisons in the component suites and `integration.test.tsx`); the exact comparisons of lib helpers and fixtures (`slot`, `mergeProps`, `renderTrigger`, `buttonStyles`, `children`, `useMergedRefs`, `useAnnounce`); `testClassName`'s own fixture tests; `test-utils.test.tsx:746-769`, whose `Chip` fixture has no registry constant, so the new case is not registered and the list of eight test names stays; the `pick()`-based fixtures (the new case's name matches none of them). The `testSystemProps` calls with a `wrapper` (25) and those whose `className` lands on an inner or portaled element (Nav items, Table, DataGrid, TabList, `Dialog.Content`, Drawer, Toaster, Tooltip, Avatar with a badge, the static Menu, WaveProvider through the alias table) need no config change: the new case finds the element that received the consumer class.
- **`P3-toasts` (wave B):**
  - `Toast.test.tsx:537-538` asserts that a toast has no `role`: it becomes `role="group"` on the container (D10).
  - The `getToasts()` helper (`Toast.test.tsx:66-67`, 76 call sites) now returns the containers: the counts stay valid (one marker per toast, and a dismissed toast unmounts in the same `act()` without motion); the pointer events fired at a toast (`:1002-1006`, `:1017`, `:1169-1176`, `:1757-1761`) stay valid because the pause handlers move to the container; the exact texts at `:844-849` stay valid because the container and the parts add no text.
  - `bodyAfter` (`Toast.test.tsx:103`, used at `:113`, `:118`, `:128`) reads the title element's next sibling: the title text now sits in a span inside `Toast.Title`, so the helper finds the body from the title row (or by its stable class).
  - Pausing becomes region-wide (D14): the hover and focus tests (`:1002-1006`, `:1017`, `:1169-1176`, `:1757-1761`) still pause the toast they touch (the pointer and focus events reach the viewport's handlers); a 0.7 case that asserts another toast keeps counting down while one is hovered or focused changes to assert that every toast pauses.
  - Unchanged, and to be kept so: the exact timer counts (`vi.getTimerCount()`, 17 places; the presence core schedules no timer without motion), the six focus-move checks (the containers stay direct children of the viewport and `tabIndex="-1"` keeps the first tabbable element on the Dismiss button), `integration.test.tsx:1025` (`[data-wave-toast] *`).
- **`P3-messagebar` (wave B):** nothing breaks if a bar without actions keeps 0.7's markup (D17): `MessageBar.test.tsx:169` (no `aria-hidden` element with `icon={null}`) and `:1352` (the Dismiss button's `ms-auto` in RTL) pin it.
- **`P3-color` (wave B), `ColorPicker.test.tsx`:** the slider queries are all named ("Opacity", and "Deckkraft" with `labels`), so the AlphaSlider's input keeps `labels.opacity` as its name. `:433-437` assert the focus ring on the opacity input: it moves to the AlphaSlider's thumb, the input being transparent. The value checks (`toHaveValue('50')`, the "50%" readout at `:449-450`, the 0–100 values at `:458`, `:460`, `:475`, `:492`, `:511`, `:591`, `:913`, `fireEvent.change` at `:473-474` and `:521-522`, `toBeDisabled()` for a value that is not hex at `:520`) stay valid by design (a 0–100 input that handles native change events, the kept readout, the invalid-value rule of D21). The Field-isolation counts (`:641`, `:652`, `:763`, `:849`) and `integration.test.tsx:767`, `:780`, `:805`, `:2227`, `:2242`, `:2262` (`getByRole('group', { name: 'Preference' })`) stay valid because the parts render in a `null` Field context, own no hidden input, and the area's group is named by `labels.area`, not by the Field. The axe runs of `ColorPicker.test.tsx:42-54`, `:244`, `:718`, `:739`, `:767`, `integration.test.tsx:771`, `:786`, `:2233`, `:2248` and the ColorPicker stories audit the new parts (named, so no change).
- **`P3-tree` (wave B):** nothing breaks; the absence checks on items (`Tree.test.tsx:135`, `:147`, `:425-427`, `:622`, `:628`, `:641`) hold because `'none'` adds nothing to items.
- **`P3-tree` (wave B), `useRovingTabIndex.test.tsx`:** the 0.7 cases stay (the default `tabStop: true` changes nothing).
- **`F3-foundation`, `Toolbar.parts.test.tsx`:** the `vertical` icon-box cases now see `withIconBox` built on `withPartClass`; the box keeps its classes, and the icon span gains the Toolbar button's and Button's icon classes (the exact-class assertions listed above).
- **Scripts:** `scripts/__tests__/verify-dist.test.mjs` changes in wave A (§1.4.4): the sorted-list case (`:900-901`) holds for `['ColorPicker', 'MessageBar', 'Toast']`, and the case that runs `checkFlatExports` on the real sources (`:1083-1089`) asserts that every bridge entry is reported as planned or pending instead of an empty list; the complete-error-list cases pass the new checks or opt out explicitly. `build-css`'s class checks are unaffected (Tailwind generates nothing for `wave-*` words; the only `wave` definition is the `wave-rtl` variant).

### 6.5 Definition of done for Phase 3

Every item's tests pass; the gap ids of §7 are closed (and `buttons-29` recorded as mitigated); the §6.2 probes pass; the §6.3 checklist results are in the wave E report (and the spike's in wave A's); the CHANGELOG 0.8.0 section, README, CLAUDE.md and guides are updated; `docs/ROADMAP.md` marks Phase 3 as released when 0.8.0 ships; this spec gains a §10 "Implementation notes" recording where the code deliberately differs from it.

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
| `toaster-5` | low | P3-08 (one handle per Toaster) | P3-toasts |
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

Totals: 4 high, 6 medium and 10 low gaps closed, and 1 low gap mitigated (the roadmap's 4 / 6 / 11 on `docs/issues-4-7`, with `buttons-29` moved to P13-02, D8). Every gap id the roadmap assigns to P3-00 … P3-08 appears exactly once above and in its item's "Closes" or "Mitigates" line.

---

## 8. Open questions for the maintainer

Each with the spec's recommended answer, which the rulings above already assume. **Answered on 2026-09-26: the maintainer accepted every recommended answer below.** The three questions of the design review (the registry approach, the tree cascade, the Dismiss button on rich toasts) are answered and recorded as maintainer rulings in the header. Questions 5, 18–24 come from the reviews of the first draft and change or extend a section approved at the design review, or cover P3-08, which the roadmap gained afterwards; they need the maintainer's explicit answer.

1. **`Toast.Close` instead of the sketch's `Toast.Trigger` (D9).** *Recommended:* `Toast.Close`: WaveUI's `*.Trigger` parts open surfaces and `Dialog.Close`/`Drawer.Close` close them; the JSDoc names Fluent's `ToastTrigger`.
2. **A MessageBar title names the bar only with a non-live role (D16)**, where the sketch and Fluent always label the bar. *Recommended:* yes: a named live region can have its name read with its content, reading the title twice; `role="region"` gets the name it needs.
3. **`layout="auto"` renders multiline for a bar without actions (D17).** *Recommended:* yes: such a bar has nothing to reflow, and measuring it would shift every 0.7 bar after hydration.
4. **The default ColorPicker gains an area and a hue slider (D21)**, a visible change for 0.7 users, as the roadmap sketch says. *Recommended:* yes, with composing the parts as the opt-out (CHANGELOG "Visual").
5. **The standalone color parts bind to an enclosing ColorPicker, and the picker gets no `ColorPicker.Area`, `.HueSlider` or `.AlphaSlider` members (D21)**; `ColorPicker.HexField`, `.Swatches` and an added `.Preview` are its parts. This replaces the design review's `ColorPicker.Area`/`.Slider`/`.AlphaSlider` members. *Recommended:* yes: it is Fluent's composition, so a screen ported from Fluent works as written, and members that wrapped the standalone parts would duplicate them and leave them silently unbound inside a picker.
6. **Public `hsvToHex` and `hexToHsv` (D18).** *Recommended:* yes: the standalone parts take `HsvColor`, and apps usually store hex.
7. **A built-in English color namer, replaceable through `labels.colorName`, and whole value texts through `labels.valueText` (D22).** *Recommended:* yes: the roadmap's acceptance asks that the value text names the color; function labels translate where a table of fragments cannot.
8. **`ColorArea` mirrors its x axis in RTL (D19)**, which Fluent's does not. *Recommended:* yes (C-LOGICAL, native range inputs, the roadmap's acceptance), recorded in ROADMAP §8.3.
9. **`buttons-29` recorded as mitigated by P3-00 and closed by P13-02 (D8).** *Recommended:* yes: class names are only half of that gap.
10. **Variants carry their base classes (D5)**, so `.wave-button` also matches ToggleButton, MenuButton and the Toolbar buttons. *Recommended:* yes (Fluent's behaviour; one hook styles every button).
11. **The standalone color parts accept `name`, `form` and `required` and submit hex (C-FORMS)**, ignored while bound to a picker. *Recommended:* yes: the roadmap's guard ("hidden inputs and form reset on every value control").
12. **Backspace dismisses a focused toast as well as Delete (D14).** *Recommended:* yes: Backspace is the delete key of Mac keyboards, and TagPicker removes a tag with either.
13. **`selected` is ignored in a checkbox tree, with a development warning, and `'single'` without `selected` warns (D23, D25).** *Recommended:* yes: an item carries `aria-checked` or `aria-selected`, never both (APG), and radios that can never fill are a mistake.
14. **`navigationMode="treegrid"` changes the keyboard only (D27)**, and replaces APG's "next on an open node moves to its first child". *Recommended:* yes (as Fluent); real treegrid roles wait for the flat tree model (P11-04); the keyboard table says so.
15. **One DOM order for both MessageBar layouts (D17)**: icon, text, actions, Dismiss, where Fluent reorders the DOM to follow the visual order. *Recommended:* yes: a reflow of an `'auto'` bar would otherwise move the focused action or Dismiss button, and a moved node loses focus.
16. **Escape inside the toast region no longer reaches a Dialog below (D14)**, a behaviour change for 0.7. *Recommended:* yes: the Escape belongs to the toasts the user is in; the Dialog closes with the next Escape once focus is back in it.
17. **An explicit `layout="singleline"` never clips its text (D17)**; it wraps inside its column, where Fluent's single line does not wrap. *Recommended:* yes: clipped text fails WCAG 1.4.10 and 1.4.4 at narrow widths and high zoom.
18. **The checkbox of a multi-select tree is an exposed `role="checkbox"` (outside the Tab order, labelled by the item), not a decorative indicator (D25); and if the VoiceOver spike (§6.3) finds that VoiceOver does not announce `aria-checked` on a treeitem, each item also carries a visually hidden state text from a new `TreeLabels` (`checked`, `mixed`, `unchecked`).** *Recommended:* yes to both: a decorative indicator leaves touch screen readers and voice control no way to change a check (WCAG 4.1.2); Fluent's checkbox is exposed the same way; the state text costs a redundant word for NVDA and JAWS only when VoiceOver needs it.
19. **P3-08: dispatches through an unbound handle wait in its queue (D33)**, rather than warning and dropping them. *Recommended:* queue: a Toaster that is still mounting or remounting loses nothing, and `dismissToast` can still remove a waiting toast.
20. **P3-08 joins this phase (from `docs/issues-4-7`), in `P3-toasts` after P3-03, with `createToaster` in the server-safe `src/lib/toaster.ts`, and that branch merges to `main` before wave A (§3).** *Recommended:* yes: the handle implements P3-01's controller, so it belongs to the same package, and a module under `src/components` would be a client reference in a Server Component.
21. **A toast dispatched with content that holds an action stays until it is dismissed unless the dispatch passes a `timeout` (D12)**, where 0.7's options form (which has no actions) keeps 5 s and Fluent times out every toast. *Recommended:* yes: an Undo that vanishes after 5 s is a time limit people using a screen reader, a switch or voice control often cannot meet (WCAG 2.2.1); Material extends snackbars with actions for the same reason.
22. **The pointer or focus anywhere in the toast region pauses every toast (D14)**, where 0.7 paused the hovered or focused toast only. *Recommended:* yes: someone reading or operating one toast is reading the stack, which should not change under them (Fluent pauses a position's toasts on focus).
23. **The announcement of a toast includes its action labels (D13)**, where the design review's draft left button labels out. *Recommended:* yes: it tells people who cannot see the toast that an action exists (and, with Q21, that it waits for them); the Dismiss button stays out.
24. **`Tree.ItemPersonaLayout` (flat `TreeItemPersonaLayout`, Fluent's name) instead of the sketch's `Tree.PersonaLayout` (D28)**, naming the item by the person's name and describing it by the description. *Recommended:* yes: Fluent's name fits WaveUI's compound naming (roadmap §1.1 goal 4), and a short name keeps announcements and voice commands short.

---

## 9. Review notes

Three reviews of the first draft (API conventions against CLAUDE.md and the earlier specs; accessibility and behaviour against APG, ARIA, WCAG, screen-reader data and the 0.7 overlay machinery; the code, sequencing and verification against the 0.7.0 source and scripts) were applied to this spec. Their blockers were: the Toaster's Escape and Delete handlers taking keys from portaled widgets (all three reviews; D14); row actions activating their tree item (two reviews; D27); the tree's decorative indicator leaving touch screen readers and voice control without a way to check an item (D25); the flat-name bridge listing the already complete `Tree` (rule 21); and `Tree.PersonaLayout` dropping Fluent's name (D28). All were applied. The points below were rejected, in full or in part, or applied in another form than proposed.

1. **The visually hidden state text of a checkbox tree** (for VoiceOver, which a September 2026 prototype test found not to announce `aria-checked` on a treeitem) is **made conditional** on the spike of §6.3 instead of shipping unconditionally: one prototype is thin evidence, and the text adds a redundant word for NVDA and JAWS, which announce the state. The exposed checkbox, the other half of the proposal, is applied unconditionally (D25; §8 Q18).
2. **Uncontrolled single selection** (`defaultSelected` through `useControllable`) for `selectionMode="single"` is **not added**; the review's other option is taken: `selected ?? null` and a development warning when `'single'` has no `selected` (D23). The roadmap keeps one single-selection API, 0.5's controlled `selected`/`onItemSelect`; an uncontrolled form can come later without breaking anything.
3. **Standalone color parts inside a ColorPicker**: of the review's two options (bind them to the picker, or warn and point to the members), **binding** is applied, and the members `ColorPicker.Area`, `.Slider` and `.AlphaSlider` of the design review are dropped rather than kept as aliases (D21; §8 Q5): aliases would need flat-name exports that duplicate `ColorArea` and friends under a second name.
4. **Planned-member part keys** (AvatarGroup `item`, TagPicker `control` and `group`, DataGrid `selectionCell`) **stay registered now**, instead of being registered when their members land; D8's rule (the old class stays next to the new member's until 1.0) covers the later change, and the parts are styled today.
5. **The MessageBar reflow**: the review of the code proposed keeping truncation for an explicit `layout="singleline"`; the accessibility review's rule is applied instead: no layout clips text (D17; §8 Q17). `'auto'` measures the text column, as the code review proposed.
6. **The tab stop of a tree row's actions** uses a new option of the public `useRovingTabIndex` (`tabStop`), owned by `P3-tree` in wave B, rather than a stamping effect local to the Tree: the buttons are the consumer's elements, which the roving hook already stamps, and a local effect would duplicate its bookkeeping.
7. **`ColorPicker.Swatches`' swatch class**: instead of a new class channel on SwatchPicker (a file no wave-B package owns), the member-level `swatch` part is dropped; the swatches keep SwatchPicker's own part class, which the picker's root reaches (`.wave-color-picker-swatches .wave-swatch-picker__swatch`).
8. **The gate's lexer is not shared** with the registry test: the "applied" check of `classNames.test.ts` is a plain text match (comments count), while the gate rule, which uses the lexer, checks every component module's root in code. A shared lexer module was the review's other option; the text match is enough once the gate guarantees the roots.
9. **Focus after a dismissal** follows the review for Delete (the next toast's container) but keeps 0.7's rule for a dismissal from the Dismiss button (the next toast's first tabbable element, its Dismiss button), which the 0.7 focus tests pin and which keeps a keyboard user's position in the same control.
10. **The Button-only string probe**: the review proposed `'wave-dialog-content'`; it is applied, together with the other review's point that strings must match as quoted literals and must exist somewhere in `dist` (§1.4.4).
11. **Laying the ColorArea's hidden inputs over the field** (for VoiceOver iOS's touch exploration) is left to the real-browser check (§6.3 #4), which decides it with the lead, instead of being specified now: jsdom cannot show whether 1 px inputs are reachable, and the overlay changes pointer handling.
12. **P3-08** (the toaster handle) was added to the roadmap after the design review, on `docs/issues-4-7`, and was not reviewed by the three reviews; its design follows the roadmap entry and D33, and the maintainer answers §8 Q19 and Q20.

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
| `toastTitleClassNames` **0.8** | `wave-toast-title` | the title row (also what the `title` prop renders) | `label` `__label` — the title text `<span>` that names the toast (children)<br>`action` `__action` — the `action` slot at the row's end (`action`) | — |
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
| `colorPickerHexFieldClassNames` **0.8** | `wave-color-picker-hex-field` | the field's outer element (0.7: the `<label>` around caption and input) | `label` `__label` — caption `<span>` (`labels.hex`)<br>`input` `__input` — hex `<input>` (`labels.hexInput`)<br>`errorMessage` `__error-message` — error `<span>` (`labels.hexError`) | — |
| `colorPickerSwatchesClassNames` **0.8** | `wave-color-picker-swatches` | the SwatchPicker it renders (0.7: the presets SwatchPicker), through its `className` | — (the swatches keep SwatchPicker's own `wave-swatch-picker__swatch`) | root `wave-swatch-picker` |
| `colorPickerPreviewClassNames` **0.8** | `wave-color-picker-preview` | preview `<div>` (0.7 `data-color-preview`) | — | — |
| `colorAreaClassNames` **0.8** | `wave-color-area` | the area element (`role="group"`) | `field` `__field` — the gradient layer (`aria-hidden`)<br>`thumb` `__thumb` (the two hidden range inputs are not parts) | — |
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
| `treeItemClassNames` | `wave-tree-item` | `role="treeitem"` `<div>` | `row` `__row` — the row `<div data-tree-row>`<br>`expandIcon` `__expand-icon` — the chevron (and the **0.8** `expandIcon` slot)<br>`indicator` `__indicator` — **0.8** the exposed `role="checkbox"` (`'multiple'`) or the decorative radio (`'single'`)<br>`icon` `__icon` — `<span>` (`icon`)<br>`label` `__label` — `<span data-tree-label>` (children)<br>`iconAfter` `__icon-after` — **0.8** (`iconAfter`)<br>`aside` `__aside` — **0.8** (`aside`)<br>`actions` `__actions` — **0.8** the row's own toolbar element (`actions`; not the public Toolbar, D26)<br>`group` `__group` — `role="group"` `<div>` of nested items | — |
| `treeItemPersonaLayoutClassNames` **0.8** | `wave-tree-item-persona-layout` | its root `<span>` | `media` `__media` — (`media`)<br>`main` `__main` — the name (children)<br>`description` `__description` — (`description`) | — |
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

They carry their own classes plus the parent's part class: SplitButton's two halves; the Buttons that `Dialog.Content`, Drawer and TeachingPopover render; the Options that TagPicker renders; Persona's built-in Avatar; the SwatchPicker that `ColorPicker.Swatches` renders. The `ColorArea`, `ColorSlider` and `AlphaSlider` that a ColorPicker renders in its default layout, or that an app composes into one, carry only their own classes (they are the standalone components, bound; D21). Not embedded: the consumer's own elements (AvatarGroup members, the `Menu.SplitGroup` halves, Combobox and Dropdown options); TagPicker's tags (not Tag) and DataGrid's selection inputs (not Checkbox); the content of a part wrapper (Persona's `status` PresenceBadge, the Toast inside the Toaster's container); Portal wrappers.

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
21. So TreeItem's text span is `label`, not TreeItemLayout's `main`; `Tree.ItemPersonaLayout` keeps Fluent's `main` next to its Fluent-named `media` and `description`.
22. TreeItem's selection checkbox or radio is `indicator` (the Checkbox and Radio key, and P3-06's wording), not Fluent's `selector`.
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

31. `Tree.Item` `actions` renders its own toolbar element, not the public Toolbar (its tab stop follows the tree's active item and `navigationMode`, which the public Toolbar cannot do; D26, D27), so it carries no `wave-toolbar`. `ColorPicker.HexField` keeps 0.7's own caption and input (not the public Input or Label), so it carries neither `wave-input` nor `wave-label`. The picker has no area or slider members (D21), so no `wave-color-picker-area` or `…-slider` classes exist; `.wave-color-picker .wave-color-area` reaches a picker's area.
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
