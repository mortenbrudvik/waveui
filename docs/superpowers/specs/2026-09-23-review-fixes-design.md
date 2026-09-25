# WaveUI 0.5.0 — Full-Review Fix Design

> Date: 2026-09-23 · Branch: `fix/full-review` · Package: `@mortenbrudvik/waveui` 0.4.0 → **0.5.0**
> Scope: every issue of the verified full-repo review — **305 issues** (20 critical, 160 important, 125 suggestion) built from 595 verified findings.
> Data: `clusters.json` (issues: `cid`, summary, fix, `member_ids`), `findings.json` (evidence, failure scenario, suggested fix per finding id), `packages.json` (P01–P17 file ownership).
> Status: implementation contract for parallel agents. Where a package brief (§6) and a foundation section (§2–§5) disagree, the foundation section wins. Seams that do not line up are resolved by INTEGRATION.
> Revision 2 (same day): revised after three critiques (coverage, soundness, execution). The main changes are the `useControllable` model, hover-state gating, the axe configuration, the CSS pipeline and cascade strategy, layer/trap/restore/portal semantics, modal isolation for toasts, the split of F6 into three packages, new waves (D0 for Button, E1 INTEGRATION before E2 DOCS), a change-request queue and shared-tree safety rules. §9 maps every critique to its resolution and lists the rejected ones.
> Revision 2.1 (wave A change requests, lead): the spec now matches the landed F2 behaviour.
> - C-FOCUS, §2.1.6 and the `styles.ts` row: `inputFocus` uses `focus:outline-hidden`, never bare `outline-hidden`.
> - C-DEV, C-NAMING, and the `dev.ts`/`renderTrigger` rows: the pure F2 helpers warn at call time through `warnOnce`, and components call `resolveDeprecatedProp` during render.
> - `focus.ts` row and §2.4: named radio groups follow browser Tab order, so `useFocusTrap` computes tabbables at keydown time.
> - `slot.ts` row: void slots stay silent for content that renders nothing.
> - §8: `styles.test.ts` and `types.test.ts` are F2-owned.
> Revision 2.2 (wave B change requests, lead): the spec now matches the landed F3 behaviour.
> - §2.3 `useControllable` (Mode bullet and test list), §7.5 and `table-core#28`: the mode-switch warning goes through `warnOnce(key, message)`. The direction is in the message text ("A component is changing from controlled to uncontrolled." / the reverse), not in console arguments (F2 `warnOnce(key, message)` passes none). Tests assert the `[WaveUI] ` prefix, that the correct direction substring is present and that the reverse is absent.
> - §2.3 `useControllable` ("Two refs, two jobs", test list), C-HOOKS and §9 row 1: the rendered value, mode and uncontrolled latest value are synced in an insertion effect (`useInsertionEffect`, as in `useEventCallback`), not a layout effect, so a child's layout effect in the commit that changed the controlled value sees the committed value and mode.
> - §2.3 Consequences, §6 P01/P05/P15/P16, §7.5, `table-core#3`, `button-provider#15` and `overlays#32`: the separate-interactions test rule for controlled components (`userEvent`, or `await act(async () => {})` between `fireEvent` calls; back-to-back `fireEvent` calls are one task and chain).
> - §2.3 `usePreserveFocus` row, §6 P12, §7.5 and `feedback-navigation#12`: the unmount move runs in a microtask (cancelled on a StrictMode remount, skipped when focus was already placed outside), and `getFallback` must not throw.
> Revision 2.3 (wave C change requests, lead): §2.4 now matches the landed F4 `layers.ts` behaviour.
> - §2.4 `layers.ts` signature block: adds `registerLayerIsolation`, `isBehindIsolatingModal`, `subscribeLayers`, `getOpenLayers`, `getLayer`, `isDescendantLayer` and `getLayerTreeElements`.
> - §2.4 `layers.ts`: new "Modal barrier" bullet. The topmost open isolating modal (Dialog, Drawer) shields the layers stacked below it from outside presses and Escape. A `kind: 'modal'` layer without isolation (the DatePicker calendar) shields nothing. The `useModalIsolation` bullet now says that the hook registers the barrier.
> - §2.4 `useDismiss`: the Escape bullet now gives the four-step dispatch (focus scope, then its subtree, then an ancestor, then the global topmost), with candidates limited to the layers the barrier does not cover. Outside-press step 1 now states the primary-button rule, the barrier exclusion and when a pending press is forgotten. `overlays#1` in Appendix A points to §2.4 for the full rule.
> Revision 2.3, F5 and F6b part (wave C change requests, lead): §2.5, §5.5 and the pipeline sections now match the landed F5 `useListbox` and the F6b scripts.
> - §2.5 `useListbox` signature: `UseListboxOptions.onClearDraft`, `UseListboxResult.getItem` and `onKeyUp`, and the exports `markListboxElement` and `collectOptionLabels`. New "Consumer contract" bullet: `getComboboxProps()` plus both `onKeyDown` and `onKeyUp` on the combobox element, `Option`/`OptionGroup` marked with `markListboxElement`, display text `getItem(value)?.label ?? collectOptionLabels(children).get(value)`, `onClearDraft` for editable consumers, and reorder tests outside StrictMode. The Registration bullet now covers keyed reorders (root commit check plus a `MutationObserver`, so memoized options have no ordering limit). "Where the options live" requires a single container at a time (development warning key `useListbox:single-container`). The keyboard bullet lists editable Alt+ArrowUp/Tab and select-only PageUp/PageDown.
> - §5.5, §6 P05/P06 and Appendix A `input-pickers#1`, `#6`, `#11`: they point to that contract.
> - §3.2 `build-storybook` bullet, §6 F6b and `repo-level#1`: verify-storybook requires every story-only utility found by a reference compile, and passes on `.bg-primary` alone when there is none.
> - §3.1, §3.2 `prepublishOnly`, §6 INTEGRATION, §7.2 and `repo-level#2`: the `PENDING_FLAT_EXPORTS` bridge in `scripts/verify-dist.mjs`. `prepublishOnly` and the final gate run `node scripts/verify-dist.mjs --final`, which fails while the list is not empty. INTEGRATION empties the list.
> - §8: F6b owns its four `scripts/__tests__/*.test.mjs` files (verify-dist, verify-storybook, pack-smoke, vite-config). F6a owns `scripts/__tests__/check-ts-coverage.test.mjs`.
> Revision 2.4 (wave D0 change request from P01, lead): §7.3 now lists the landed Button changes, so DOCS carries them into the CHANGELOG. The Styles bullet covers icon-only square sizing, `min-w-24`, the 1px border on every appearance, the 18px extra-large label, gated hover/pressed and how to override them, and no underline for `as="a"`. The Behaviour bullet covers `null`/`undefined` defaults, disabled semantics for every non-form-control `as` (custom components included), `role="button"` with Enter/Space, a consumer `aria-disabled`, the `aria-hidden` icon slot and the icon-only warning.
> Revision 2.5 (wave D change request from P06, lead): the spec now matches the landed TimePicker ranking (`input-datetime#24`).
> - §5.5: TimePicker does not pass `highlightOnFilter`. It ranks the active option on every edit with `setActiveValue`: a complete typed time activates its own option (nothing when that time is not in the list), and partial text activates the first match. `autoHighlight` is `'selected'` only while there is no draft. `highlightOnFilter` would reset the active option to the first filtered item whenever the filtered set changes, so `12:00 PM` would win over a typed `2:00 PM`.
> - §2.5: the `highlightOnFilter` comment no longer names TimePicker (the option stays in the F5 API, with no 0.5 consumer).
> - §7.3 Behaviour and Appendix A `input-datetime#24`: an exact typed time activates and commits its own option, and erased text clears the value on Enter and on blur, as in DatePicker.
> Revision 2.5, P02 part (wave D change request from P02, lead): §5.1 now matches the landed Field merge (`input-basic#15`, `#16`), and §7.3 lists the landed P02 behaviour changes, so DOCS carries them into the CHANGELOG.
> - §5.1 items 1–2 and the §6 P02 brief: Field merges into its first element child only, in one of three ways. Components, labelable elements and role-less custom elements get the control id (their own id becomes `controlId`). Other elements with a nameable explicit role get `aria-labelledby` and no id. A Fragment and a role-less, presentational or name-prohibited `div`/`span` are left alone. `aria-required` goes only where ARIA allows it, native `required` only on value-taking `input`, `select` and `textarea`, and custom elements get the string `"true"`. The wrapper-component caveat and the documented plain-`<div>` pattern are recorded.
> - §7.3 Behaviour: the Field sentence covers first-child-only merging, left-alone wrappers, `aria-labelledby` for role widgets, `aria-required` placement and the new native `required` (constraint validation now blocks an empty required field). New sentences cover the error border from a resolved `aria-invalid` (Input, Select, Textarea, SearchBox), `readOnly` reaching the SearchBox input with no clear button while read-only, and empty `dismiss` content showing the default icon.
> Revision 2.5, P03/P04/P05/P12 part and the P02 Field decision (wave D change requests, lead): the spec now matches the landed callback-alias, Rating, TagPicker, OptionGroup, ColorPicker and MessageBar behaviour.
> - §1 C-NAMING callback semantics, §7.3 Behaviour, Appendix A `input-basic#29`, `#38`: the deprecated state aliases named `onChange` (every C-NAMING row with an `onChange` alias) are change-only like their replacements. The Rating-only bounds exception is gone: RadioGroup and Rating no longer emit when the current radio or star is chosen again, or when a Rating key is pressed at an end.
> - §7.3 Behaviour, Appendix A `input-pickers#17`: the keyboard cannot clear a Rating to 0 (Left/Down stop at 1 star); a controlled `value={0}` still clears it.
> - §1 C-SLOTS (new naming bullet), §7.3 Behaviour, Appendix A `feedback-navigation#1`: a Label-in-Name exception (WCAG 2.5.3) for the MessageBar dismiss button. A merged `<button>`/Button that renders a text label is named by that text, as in 0.4. SearchBox keeps its 0.4 name "Clear search" and Tag keeps `dismissLabel` plus the tag content (`data-display#10`); these differences are deliberate. (Superseded by the C-SLOTS naming decision below: one rule for all three.)
> - §5.1 items 2 and 5, Appendix A `input-basic#15`: decision that component first children keep receiving `aria-required`. The wrapper-component case uses the documented plain-element pattern, and INTEGRATION's `required` + axe variant of Field > Tooltip > Input uses it too.
> - §5.5, §7.3 DOM structure and Types: the `OptionGroup` structure, its `ref`/rest target (`<li>`) and `OptionGroupProps extends React.LiHTMLAttributes<HTMLLIElement>`.
> - §7.3 Behaviour, Appendix A `input-basic#41`: the ColorPicker hex text is a draft; invalid text is kept and flagged (keep-and-flag test), not reverted.
> - §7.3 Behaviour and DOM structure, Appendix A `input-pickers#14`: the TagPicker tags form a list named "Selected", the input is described by a hidden summary, and Backspace focuses the last tag before removing it.
> Revision 2.5, C-SLOTS naming decision (wave D change request from P12, lead): the Label-in-Name rule of MessageBar is adopted for all three dismiss/clear buttons.
> - §1 C-SLOTS naming bullet (rewritten), §6 P02/P08/P12, §7.3 Behaviour, Appendix A `feedback-navigation#1`, `data-display#1`, `data-display#10`: a merged `<button>`/`Button` whose rendered content has a text label is named by that text in MessageBar and SearchBox, and by that text plus the tag content in Tag ("Remove Cherry"). Decorative slot content keeps the default name; consumer naming attributes win in MessageBar and SearchBox (SearchBox now moves them from a content slot object to the button); Tag keeps ignoring slot naming attributes.
> - The text-label predicate needs at least two letters or digits: a lone `X`/`x`/`×` is a glyph and keeps the default name (P12 adjusts MessageBar, which counted one letter).
> - §2.2 and §8: new F2 helper `src/lib/labelInName.ts` (+ test) for the predicate, the DOM check and the observer, replacing the three local copies once it lands.
> Revision 2.6 (verification round, lead): §2.1.3 now matches the tokens changed after a real-browser axe sweep of every story.
> - §2.1.3 token and pair tables: light `subtle-pressed` #ebebeb, dark `success` #5db55d and `info-tint-foreground` #62abf5, high-contrast `destructive`/`error` #ff6e6e, and the four ratios these change (the `TABLED_RATIOS` of `tokens.test.ts` already use them).
> - §2.1.3 new decision, the text matrix: every text token is at least 4.5:1, unrounded, on every surface it can sit on, in every theme. `tokens.test.ts` checks it and classifies every colour token. The §2.1.1 test row, §4.5 and §7.3 Styles are updated to match.
> Revision 3 (second full review, fix round): a second full-codebase review of the 0.5 branch; its fixes follow these shared rulings.
> - R1: identify compound parts with `getElementType`/`isElementOfType` from `src/lib/children.ts`, never `child.type === Part`, because a part written in a Server Component reaches the client as a lazy reference; test with `asClientReference(Part)`.
> - R2: count, slice or classify direct children through `flattenChildren` (Fragments flattened, consumer keys kept).
> - R3: context hooks report a missing root through `reportMissingContext` (throws in development, logs once per message in production).
> - R4: mirror with Wave's own `wave-rtl:` variant (`:dir(rtl)`, attribute fallback), never Tailwind's `rtl:`/`ltr:`, which also match inside a subtree of the other direction.
> - R5: call `useLayoutEffect` directly; no `useIsomorphicLayoutEffect` alias under the React 19 peer range.
> - R6: array props and hook options the library only reads accept `readonly T[]`; callbacks keep emitting mutable arrays.
> - R7: a localizable built-in string is a `<thing>Label` prop, a group a `<thing>Labels` object (Dialog.Content, Drawer and TeachingPopover `closeLabel`, Toast `dismissLabel`, Carousel `labels`, Stepper `statusLabels`).
> - R8: one `inputInvalid`/`inputInvalidWithin` recipe for the invalid look of every text-entry control and picker.
> - R9: text fields draw their boundary like Input (`border-input` plus the `border-b-stroke-accessible` bottom stroke).
> - R10: a form reset normalizes the default like every other change path and emits only on a real change.
> - R11: every "renders nothing" check uses `slotRendersContent`.
> - R12: value-keyed compounds (TabList, Accordion, Tree, Nav, RadioGroup) warn once per duplicated value.
> - R13: a compound's component JSDoc sits on its exported `Object.assign` const; Storybook autodocs read it through `.storybook/exportDocblocks.ts`, and stories do not repeat it.
> - R14: a test that spies on `console.warn`/`console.error` asserts the expected messages and that nothing else was logged.
> - R15: a handler that reacts to events bubbling through the React tree ignores events whose target is outside `event.currentTarget` in the DOM (portal bubbling).
> - Decisions that change earlier sections:
>   - §1 C-LOGICAL and §4.4: `wave-rtl:` replaces `rtl:`, and bare `rtl:`/`ltr:` are a gate error (`direction-variant`) and a CSS build error. The Appendix A task lines that name `rtl:` classes record the first round; the classes are now `wave-rtl:`.
>   - §1 C-CONTEXT: the production fallback goes through `reportMissingContext` and logs once per message per page.
>   - §1 C-TESTS, C-DOCS and §4.4: axe also disables `color-contrast`, and audits fail on dangling ARIA id references; overlay state that outlives a test fails it; compound JSDoc as in R13.
>   - §2.3 `WaveProvider`: a nested provider inherits `theme`, `dir` and `portalContainer` when it omits them.
>   - §2.3 `useRovingTabIndex`: an AltGr character (single-character Ctrl+Alt) reaches typeahead; CSS-hidden controls and hidden inputs are no items; a nested composite or a control with its own arrow keys holds the tab stop only when nothing else can, and Left/Right move past a select-only combobox.
>   - §2.4 `useDismiss`: the pointerdown snapshot holds only the outside layers, with no `order` watermark (a layer registered later is not in it; one that unregisters is removed).
>   - §2.4 `useFocusTrap`: focus that lands outside is returned in a microtask, so an `autoFocus` element of a surface opened above the trap keeps focus, and focus pulled out again is left there; Tab inside a plain `<Portal>` in the surface is native and wraps at its edges.
>   - §5.1: a first child's own `aria-invalid` now wins over the Field error, as for controls nested deeper (`input-basic`).

---

## 0. How to use this document

### 0.1 Owners

| Key | Scope | Runs in |
|---|---|---|
| `F2-lib` | `src/lib/*` utilities (cn, slot, compose/merge helpers, polymorphic types, icons, focus/direction/aria helpers, dev warnings, global registry) | wave A |
| `F6a-tooling` | dependency installs, package.json metadata/scripts, lockfile, tsconfig ×3, eslint/prettier/.gitignore, `env.d.ts`, `vitest-axe.d.ts`, vitest config | wave A |
| `F3-hooks-provider` | `src/hooks/*` core hooks (incl. `useIsClient`, `useTriggerElement`), `WaveProvider`, WaveProvider stories | wave B |
| `F6t-test-infra` | `test-utils`, `test-setup`, helper tests, conventions gate, `stories/_helpers.ts` | wave B |
| `F1-tokens` | `src/styles/*`, CSS build script | wave B |
| `F4-overlay` | layers, `useDismiss`, focus trap/restore, modal isolation, scroll lock, positioning, `Portal` | wave C |
| `F5-listbox-field` | `useListbox`, `FieldContext`/`useFieldControl`, `HiddenInput`, `useFormReset`, `renderWithFieldContext` | wave C |
| `F6b-pipeline` | vite library config, dist/pack/Storybook verification scripts, `.storybook`, stories axe gate, package.json exports/build scripts | wave C (after F1) |
| `P01-buttons`, stage 1 | P01's `Button.tsx`, `buttonStyles.ts` and their tests; ends with the Button API freeze (§7.1) | wave D0 |
| `P01`…`P17` | the 17 component packages of `packages.json` (component + test + story files); P01 continues with its remaining files | wave D (parallel) |
| `INTEGRATION` | barrels, story import normalisation, cross-package tests, seam fixes; owns every file while it runs | wave E1, then E3 (final gate) |
| `DOCS` | README, CLAUDE.md, CHANGELOG, `docs/`, `stories/designs/` | wave E2 (after INTEGRATION) |

The three F6 packages share the `F6` prefix of revision 1; `package.json` is owned by F6a in wave A and by F6b in wave C (never concurrently).

Every issue is referenced by its `cid` (e.g. `overlays#1`). Appendix A lists all 305 cids with their owners and the exact task of each owner. Read the cluster summary/fix and, when in doubt, the underlying findings (`member_ids`) before implementing.

### 0.2 Ground rules for every agent

1. **Own your files only.** You may read anything. You may edit only files owned by your key (packages.json lists P-files; §8 lists foundation files and ownership changes). New files you create are yours if listed here. If you need an unplanned file, create it inside your own component folder with a component-prefixed name (`SpinButton.utils.ts`, `__tests__/SpinButton.utils.test.ts`) so packages sharing a folder (P02–P06 in `src/components/input/`) cannot collide, and report it.
2. **Barrels are INTEGRATION's.** Never edit `src/index.ts` or `src/components/*/index.ts`. During wave D, stories and tests import **new** symbols from their module path (`import { useOverflowMenu } from '../src/components/layout/Overflow'`); existing symbols keep coming from `'../src'`. INTEGRATION adds the exports and normalises those imports (§5.11). Put the exports you need in your final report ("Barrel requests").
3. **TDD.** Every bug fix starts with a regression test that fails on the current code (red), then the fix (green). Existing tests that encode buggy behaviour are **updated, not deleted** (§7.5 lists the known ones).
4. **Backward compatible.** Renamed props/values keep the old name as a deprecated alias with a development-only warning (`warnDeprecated`, §2.2). No public export, prop or value is removed. Behaviour changes that are not renames are listed in §7.3 and go into the CHANGELOG.
5. **Conventions gate** (F6t, §4.4): no raw colors, no physical utilities, no `focus:outline-none`, no `enabled:` state variant, no `<button` without `type=`, no `transition`/`animate-` class string without a `motion-reduce:` variant, in `src/components` (colors also in `stories/`).
6. **Keep ref-as-prop (React 19)** and `displayName` on every component and sub-component.
7. **Minimal new runtime deps.** The only new runtime dependency is `@floating-ui/react-dom` (§3.4). Everything else is hand-rolled. Only F6a installs packages.
8. **Verification before you report done** (your owned files only; other packages are in flight):
   - `npx vitest run <your test files>` (+ `src/__tests__/conventions.test.ts -t "<your file>"` and `src/__tests__/stories.a11y.test.tsx -t "<your story titles>"` — look only at failures in your files)
   - `npx tsc -p tsconfig.dev.json --noEmit` filtered to your paths
   - `npx eslint <your files>` and `npx prettier --check <your files>`
   - Foundation packages additionally run the full `npx vitest run` and report every failure outside their own files (wave exit criteria, §7.1.2).
9. **Shared working tree safety.** About 26 agents share one tree. Agents never run git write commands (`commit`, `add`, `checkout`, `switch`, `restore`, `reset`, `stash`, `clean`, `merge`, `rebase`), never run `npm install`/`npm ci`/`npm update`, and never run a repo-wide rewrite (`npm run lint:fix`, `npm run format`). Auto-fixers only with explicit own-file paths: `npx eslint --fix <own files>`, `npx prettier --write <own files>`. The lead commits after each package lands, staging only that package's files (`git add <files>`), so every wave and package has a rollback point and failures can be bisected; commit messages follow the repo policy (no AI attribution trailer).
10. **Foundation is not forked.** Never copy or re-implement a foundation hook/utility locally. If a foundation module lacks something, file a change request (§7.1.3) with a failing test and continue with other work.
11. **Lint-compatible hook patterns** (C-HOOKS): use the patterns of §1 C-HOOKS; the only allowed disable form is `// eslint-disable-next-line react-hooks/<rule> -- <reason>` at a site listed there.

### 0.3 Decisions confirmed by the maintainer (2026-09-23)

These close the open questions of revision 2. They are binding for every package.

1. **`@floating-ui/react-dom` is approved** as the only new runtime dependency (§3.4).
2. **`--wave-*` namespacing is approved**: prefixed runtime variables, no global Preflight (scoped reset in `.wave-root`/`.wave-portal`), opt-in deprecated `legacy-tokens.css`. Tailwind utility names stay unprefixed in 0.5 (the `repo-level#7` partial wont-fix of §7.4 stands; namespacing utilities is deferred to 1.0).
3. **C-NAMING is approved in full**: standardized `onValueChange`/`onCheckedChange`/`onOpenChange` vocabulary with every old name kept as a deprecated alias (warn once).
4. **Checkpoint commits are approved**: the lead commits on `fix/full-review` after each package lands (conventional-commit subject, no AI attribution trailer). Agents still never run git write commands.
5. Lead defaults for the remaining open questions: the dark primary `brand-110` and high-contrast `selected` `#003a40` changes are accepted; Dialog/Drawer use sibling `inert` isolation instead of `aria-modal`; `Image.alt` stays optional with a dev warning plus `StrictImageProps`; `ref` stays on the wrapper of composite controls (`controlRef` added); **no** Playwright/browser-mode test dependency is added — contrast is verified by `tokens.test.ts`, and the lead does the per-theme Storybook check of §4.5 at the final gate. 1.0-scope questions (utility namespacing, moving `ref`) are deferred.

---

## 1. Global conventions (apply in every package)

Each convention has an ID; Appendix A notes refer to them.

### C-REF — ref lives in the Props interface
`export interface ButtonProps extends ... { ref?: React.Ref<HTMLButtonElement> }` (sub-components too). Remove the ad-hoc `& { ref?: ... }` intersections from component signatures. Polymorphic components get `ref` through `PolymorphicProps` (§2.2). (`button-provider#27`)

### C-COMPOSE — never let `...rest` silently replace internal handlers
Destructure every handler the component also uses internally and compose it: `onClick={composeEventHandlers(onClick, internalClick)}` — consumer runs first; internal runs unless the consumer called `preventDefault()`. Merge `className` with `cn()` (user last), merge `style`, merge refs with `useMergedRefs`, join id lists with `joinIds`. Internal attributes that must not be overridden (e.g. disabled `tabIndex=-1`) are placed **after** `{...rest}`; defaults that consumers may override (e.g. `type="button"`, `role`) are placed **before** `{...rest}`. (`layout#10`)

### C-CLASS — user classes always win; state via data attributes
Internal state classes go before `className` in `cn()`. Expose interactive state as `data-*` attributes (`data-active`, `data-selected`, `data-disabled`, `data-state="open|closed"`, `data-side`) and style with `data-[active]:…` so consumers can target it. (`input-pickers#20`)

### C-TOKENS — only theme tokens
No `[#hex]`, `rgba(...)`, `white`/`black` color utilities, `stroke="white"`, Tailwind palette colors (`green-600`) or `var(--grey-*)` in components.

**State gating (hover/pressed).** Interactive elements that can be disabled gate hover and pressed styles with the literal prefixes `not-disabled:not-aria-disabled:hover:` and `not-disabled:not-aria-disabled:active:` (Tailwind 4 compiles them to `:not(:disabled):not([aria-disabled="true"]):hover`, verified with tailwindcss 4.2.1). This works for native buttons, `<a>` and role=button elements (Button `as="a"`, Nav/Breadcrumb anchors) and for controls made unavailable with `aria-disabled` (C-DISABLED), which must not change color on hover. The `enabled:` variant compiles to `:enabled`, which never matches `<a>`/`<div>`, so it is **banned** in `src/components` (conventions gate). Class strings stay literal (no runtime prefix concatenation) so Tailwind can scan them.

Mapping table (F1 defines every target token in §2.1):

| Old | New |
|---|---|
| `hover:bg-[#f5f5f5]` | `hover:bg-subtle-hover` (disableable controls: `not-disabled:not-aria-disabled:hover:bg-subtle-hover`) |
| `active:bg-[#e0e0e0]` | `active:bg-subtle-pressed` (disableable controls: `not-disabled:not-aria-disabled:active:bg-subtle-pressed`) |
| `hover:bg-[#f0f0f0]` (rows, menu items, pager) | `hover:bg-subtle-hover` |
| `bg-[#f0f0f0]` selected item/option/nav | `bg-subtle-selected` + non-color indicator |
| `bg-[#f0f0f0]` neutral chip / avatar-icon bg | `bg-muted` |
| `bg-[#f5f5f5]` active option | `bg-subtle-hover` + `outline-2 outline-ring -outline-offset-2` |
| `hover:bg-[#115ea3]`, `hover:bg-[#0e5faa]` | `not-disabled:not-aria-disabled:hover:bg-primary-hover` |
| `active:bg-[#0c3b5e]`, pressed `bg-[#0c3b5e]` | `not-disabled:not-aria-disabled:active:bg-primary-pressed` / `bg-primary-pressed` |
| `border-[#d1d1d1]` | `border-stroke` |
| Switch off track `bg-[#d1d1d1]`, thumb `bg-white` | `bg-transparent border border-stroke-accessible`, thumb `bg-stroke-accessible` |
| checked thumb `bg-white`, glyph `stroke="white"` | `bg-primary-foreground`, `stroke="currentColor"` + `text-primary-foreground` |
| `text-white` on a fill | `text-{primary,success,warning,error,severe,info}-foreground` |
| `text-[#707070]`, `placeholder:text-[#707070]`, `text-[#616161]` | `text-muted-foreground`, `placeholder:text-muted-foreground` |
| `text-[#242424]`, `hover:text-[#242424]` | `text-foreground`, `hover:text-foreground` |
| `bg-[#ebf3fc]` pressed/selected brand tint, Card selected | `bg-selected text-selected-foreground` |
| `bg-[#e8f4fd]` DataGrid selected row | `bg-selected` (row text keeps `text-foreground`; foreground, muted-foreground, primary-as-text and ring are ≥ 4.5 / 3 : 1 on `selected` in every theme, §2.1.3) |
| `bg-[#e0e0e0]` progress track | `bg-track` (the primary fill carries the 3:1 contrast) |
| `bg-[#e0e0e0]` Slider unfilled rail, carousel dots | `bg-stroke-accessible` (the rail/dot itself needs 3:1, input-basic.a11y.18, `layout#25`) |
| `bg-[#e0e0e0]` skeleton; spinner track `border-[#e0e0e0]` | `bg-skeleton`; `border-track` |
| `hover:bg-[#c0c0c0]`, `hover:border-[#c0c0c0]` | `hover:bg-stroke-hover`, `hover:border-stroke-hover` |
| `bg-[#fafafa]`, `odd:bg-[#fafafa]` | `bg-card` |
| `border-[#f0f0f0]` row separators | `border-border` |
| `text-[#f7b538]` / `text-[#c4c4c4]` (Rating) | `text-rating` / `text-stroke-accessible` (outline star) |
| MessageBar/Badge tints `#e0f2e0 #e6f2e6 / #fff8cc #fefce8 / #fde7e9 / #fdf0ec / #ebf3fc` | `bg-{success,warning,error,severe,info}-tint` |
| tint text `#107c10 / #4d2c00 / #c50f1f / #da3b01 / #0f6cbd` | `text-{…}-tint-foreground` |
| `border-l-[#107c10]` etc., Toast `border-l-green-600`, `border-l-yellow-500` | `border-s-{success,warning,error,info}` |
| Tooltip `bg-[#242424] text-white` / `bg-white` | `bg-inverted text-inverted-foreground border border-inverted-border` / `bg-background text-foreground border border-border` |
| `bg-black/40` backdrop, `hover:bg-black/5` | `bg-backdrop`, `hover:bg-subtle-hover` |
| `shadow-[0px_32px_64px_…]` | `shadow-64` |
| SplitButton `border-[rgba(255,255,255,0.3)]` | `border-primary-foreground/30` |
| `accent-[#0f6cbd]` | `accent-primary` |
| `focus-within:border-[#0f6cbd] focus-within:ring-[#0f6cbd]` | `inputFocusWithin` recipe (§2.2 styles) |
| `focus-visible:outline-[#0f6cbd]` | `focus-visible:outline-ring` |
| PresenceBadge `bg-[var(--grey-60)]` etc. | `bg-presence-{available,busy,away,offline,oof}` |
| TeachingPopover primary `bg-[#0f6cbd] text-white hover:bg-[#0e5faa]` | `<Button appearance="primary">` (§5.7) |

Only exception: user-supplied colors (ColorPicker/SwatchPicker swatch fills via inline `style`) and a luminance-chosen black/white check glyph drawn *on* a user swatch (`input-pickers#16`) — computed at runtime with a helper, never a class literal.

### C-RADIUS — use Tailwind's default radius names (no overrides)
F1 removes the radius overrides. The Wave scale maps onto Tailwind defaults: 2px `rounded-xs`, 4px `rounded`/`rounded-sm`, 6px `rounded-md`, 8px `rounded-lg`, 12px `rounded-xl`, 16px `rounded-2xl`, pill `rounded-full`. Required renames: Checkbox `rounded-sm→rounded-xs` (P03); Card, Menu, Popover, TeachingPopover, Table/DataGrid wrappers `rounded-lg→rounded-md` (P11, P13, P16, P17); Dialog `rounded-xl→rounded-lg` (P15); SplitButton `rounded-l/r→rounded-s/e` (P01). Bare `rounded` (50 uses) is unchanged. (`repo-level#7`, `repo-level#8`)

### C-LOGICAL — RTL-safe layout
Use `ms/me/ps/pe/start-*/end-*/border-s/e/rounded-s/e/text-start/end`. Directional glyphs (chevrons, pager arrows, breadcrumb separators) get `wave-rtl:-scale-x-100`, and a `translate-x-*` needs a `wave-rtl:` counterpart: Wave's own variant (`src/styles/variants.css`) matches the element's own direction (`:dir(rtl)`, with a `[dir=rtl]` fallback), while Tailwind's `rtl:`/`ltr:` also match inside a subtree of the other direction and are a gate error (`direction-variant`) and a CSS build error (revision 3, R4). Write the LTR value as the base class and override it with `wave-rtl:`. Horizontal arrow keys go through `getArrowIntent(key, { orientation, dir: getDirection(el) })` (§2.2). A physical utility is allowed only with a same-line comment `// wave-allow-physical: <reason>` (e.g. centring with `left-1/2`). Every directional component gets at least one `dir="rtl"` test via `renderWithProviders(ui, { dir: 'rtl' })`. (`feedback-navigation#34`, `button-provider#28`)

### C-FOCUS — one focus ring
Focusable controls use `focusRing` (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`); cells/rows use `focusRingInset`; text inputs use `inputFocus` / `inputFocusWithin` (bottom border + `focus:outline-hidden`, never `outline-none`); with `inputFocusWithin` on a wrapper, the inner control carries `focus:outline-hidden`. Never use bare `outline-hidden`: in Tailwind 4.2 it also emits `@media (forced-colors: active) { outline: 2px solid transparent }`, which draws a permanent outline on every unfocused input in forced colors. Scoped to `:focus`, that outline is the forced-colors focus indicator. Components replace `focus:outline-none` with `focus:outline-hidden` (P05 TagPicker and others). (`feedback-navigation#24`, `input-basic#9`)

### C-MOTION — reduced motion is per component
There is no global reduced-motion reset any more. Every `transition-transform`/slide/rotation gets `motion-reduce:transition-none`; animations use the tokens `animate-wave-*` with reduced-motion alternates (§2.1.7). Enforced by the conventions gate: a class string containing `transition` (other than `transition-none`) or `animate-` (other than `animate-none`) must also contain a `motion-reduce:` variant, or the line carries `// wave-allow-motion: <reason>` (e.g. a color-only `transition-colors`). Components with transitions today: Switch, Nav, Carousel, TeachingPopover, Stepper, SplitButton, Tree, ToggleButton, Table, TabList, SwatchPicker, Spinner, Skeleton, Rating, RadioGroup, ProgressBar, Pagination, MenuButton, Link, Dropdown, DataGrid, CompoundButton, ColorPicker, Checkbox, Button, Accordion.

### C-DISABLED — controls that disable themselves stay focusable
A control that becomes unavailable as a result of its own activation (Pagination First/Prev/Next/Last, Carousel Prev/Next, TeachingPopover Back) uses `focusableDisabledProps(disabled)` (`aria-disabled="true"` + `data-disabled`) and guards its handlers; native `disabled` is only used when the whole component is disabled by the consumer. Hover/pressed styles use the C-TOKENS state gating, so aria-disabled controls do not react to hover. Focus that would otherwise be lost to `<body>` (SearchBox clear, Toast removal, Popover close, SpinButton bounds) is moved explicitly (`usePreserveFocus`, `useRestoreFocus`, or `tabIndex={-1}` on auxiliary buttons). (`feedback-navigation#29`, `layout#26`, `input-basic#4`, `input-basic#19`)

### C-NAMING — value-callback naming and deprecated aliases
Rule: `onChange` is reserved for the native DOM change event. State callbacks are `on<Thing>Change(value)`; single-value state is `value`/`defaultValue`/`onValueChange`; boolean check state is `checked`/`defaultChecked`/`onCheckedChange`; open state `open`/`defaultOpen`/`onOpenChange`; step index `activeStep`/`defaultActiveStep`/`onStepChange`; orientation `orientation`; color treatment `appearance`; geometry `shape`; weight `TextWeight`. (`input-basic#29`, `feedback-navigation#46`, `layout#16`, `data-display#30`)

| Component | New | Deprecated alias (still works, warns once) |
|---|---|---|
| Checkbox, Switch | `onCheckedChange(checked)` | `onChange(checked)` |
| RadioGroup, Rating, SearchBox, SpinButton, ColorPicker, SwatchPicker, TagPicker, TimePicker, DatePicker | `onValueChange(value)` | `onChange(value)` |
| Input, Slider | `onValueChange(value)` added next to native `onChange` | — |
| Combobox, Dropdown | `onValueChange(value)` | `onOptionSelect(value)` |
| TabList | `value` / `defaultValue` / `onValueChange`, `orientation` | `selectedValue` / `defaultSelectedValue` / `onTabSelect`, `vertical` |
| Nav | `value` / `defaultValue` / `onValueChange` | `selectedValue` / `defaultSelectedValue` / `onNavItemSelect` |
| TeachingPopover | `activeStep` / `defaultActiveStep` | `currentStep` / `defaultCurrentStep` |
| List | `selectionMode: 'multiple'` | `'multi'` |
| DataGrid | `selectedItems` / `defaultSelectedItems` / `onSelectedItemsChange(string[])`; `sort` / `defaultSort` (`{ columnId, direction } \| null`) | `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange(Set)`; `sortColumn`/`sortDirection`/`defaultSortColumn`/`defaultSortDirection` |
| Table | `Table.Header`, `Table.HeaderCell` (+ `TableHeaderProps`, `TableHeaderCellProps`) | `Table.Head`, `Table.HeadCell` |
| Stack | `orientation` | `direction` |
| Skeleton | `shape` | `variant` |
| Text | `weight: 'regular' \| 'semibold' \| 'bold'` | `weight: 400 \| 600 \| 700` |
| Link | `appearance` (same values) | `variant` |
| Tooltip | `appearance: 'inverted' \| 'normal'` | `variant: 'dark' \| 'light'` |
| Nav.Category | `label: ReactNode` | first-string-child label sniffing |

Unchanged on purpose (already fit the rule): Pagination `currentPage`/`onPageChange`, Stepper, Carousel, Accordion, Popover/Dialog/Drawer `open`. Alias semantics: when both names are given the new value wins; both callbacks are invoked; the warning is `warnDeprecated('<Component>', '<old>', '<new>')`. Value/prop aliases are resolved with `resolveDeprecatedProp(component, newValue, oldValue, oldName, newName)` directly during render. It warns during render, once per key (C-DEV), so it needs no effect.

**Callback semantics (backward compatibility).** Value callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange`, `on<Thing>Change` wired through `useControllable`) fire **only when the value changes** (§2.3 no-op suppression). Event-named callbacks that existed in 0.4 fire on **every activation**, exactly as 0.4's `useControllable` did, including re-selecting the current item: `onTabSelect`, `onNavItemSelect`, `onOptionSelect` (deprecated aliases), `onPageChange`, `onStepChange`, and the new `Tree.onItemSelect`. Components call these from the activation handler, not through `useControllable`. Each affected component has a re-selection regression test (P05, P09, P13, P14). The deprecated state aliases named `onChange` (`onChange(checked)` for Checkbox and Switch, `onChange(value)` for RadioGroup through DatePicker in the table above) are value callbacks. The component calls each one from the `useControllable` callback together with its replacement, so it fires only when the value changes, like `onValueChange`/`onCheckedChange`. There is no exception. 0.4 also called them when the current radio or star was chosen again, or when a Rating key was pressed at an end (§7.3); P03 has change-only alias tests (`RadioGroup.test.tsx`, `Rating.test.tsx`).

### C-CONTEXT — no silent no-op contexts
`createContext<T | null>(null)` plus `useXContext(componentName)` that calls `reportMissingContext(componentName, parentName)` (`src/lib/dev.ts`): it throws `"[WaveUI] <Sub> must be used within <Root>"` in development and `console.error`s that text once per message per page in production (revision 3, R3), where the hook returns an inert value. (`overlays#34`)

### C-MEMO — memoized provider values
Every `Context.Provider value` is `React.useMemo`'d (setters from F3 hooks are stable). (`table-core#25`)

### C-IDS — ids from `useId`
DOM ids come from the repo `useId` + a per-instance base; never from user values alone. (`layout#11`)

### C-SLOTS — slot semantics
- `icon`-like props are `Slot<'span'>` rendered with `renderSlot(icon, 'span', base, { 'aria-hidden': true })`. (`data-display#31`, `button-provider#21`)
- **Dismiss/clear slots** (`MessageBar.dismiss`, `Tag.dismissIcon`, `SearchBox.dismiss`) render the slot **content inside** the library's own wired `<button type="button" onClick=… aria-label=…>`; they never replace the button. They are typed `Slot<'span'> | SlotObject<'button'>`: the button-object form (0.4 typing) still compiles, is deprecated, and its button-only props (`type`, `disabled`, handlers) are merged onto the wired button with a dev warning. A slot that is itself a `<button>` element or a Wave `Button` (the natural 0.4 usage) is **not nested**: its props are merged into the wired button with `mergeProps` (handlers composed, consumer `onClick` runs first) and a dev warning recommends passing icon content. (`feedback-navigation#1`, `data-display#1`)
- **Naming the wired dismiss/clear button** (WCAG 2.5.3 Label in Name). One rule for all three components (revision 2.5, C-SLOTS naming decision):
  - *Default name.* MessageBar `aria-label="Dismiss"`; SearchBox `aria-label="Clear search"` (its 0.4 name); Tag `aria-labelledby` = the visually hidden `dismissLabel` (default "Dismiss") plus the tag content ("Dismiss Cherry", `data-display#10`).
  - *Decorative content keeps the default.* Shorthand content and content slot objects render `aria-hidden`, so they never name the button, whatever text they show.
  - *Content rendered as is names the button when it has a text label.* The children of a merged `<button>`/Wave `Button` are exposed (SearchBox also renders the children of the deprecated `{ as: 'button' }` object as is; MessageBar and Tag render button-object content `aria-hidden`). A **text label** is text outside `aria-hidden`/`hidden` subtrees and outside SVG `<title>`/`<desc>`, `<script>`, `<style>` and `<template>`, with **at least two letters or digits** (`\p{L}`/`\p{N}`) in total. A lone character (`X`, `x`, `×`, `+`) is a symbolic glyph (Understanding 2.5.3, symbolic text characters) and keeps the default name, as an icon does. The text label **replaces the default label**: MessageBar and SearchBox omit their `aria-label`, so the text names the button (as in 0.4 MessageBar, where `dismiss={<button>Close</button>}` replaced the built-in button and was named "Close"); Tag's `aria-labelledby` references the rendered content instead of `dismissLabel` ("Remove Cherry"), so the name still identifies the tag. A forced default ("Dismiss" or "Clear search" on a button that shows "Reset") fails 2.5.3 (Level A): a voice-control user saying "click Reset" could not activate it.
  - *When it is checked.* On the literal children for the server render and the first client render (so hydration matches), then on the rendered DOM after mount, through `useSyncExternalStore` subscribed to a `MutationObserver` on the content, so text rendered by child components (translations) and later changes count. Text hidden only by CSS (a responsive `hidden sm:inline` label) still counts as a label, because a computed-style check would not follow media queries; the JSDoc asks for an explicit `aria-label` on such buttons.
  - *Consumer naming wins (MessageBar, SearchBox).* An `aria-label`, `aria-labelledby` or `title` on the merged element or on a slot object names the button: it goes to the button (from a content slot object without making it the deprecated button-object form), the default `aria-label` is dropped and no content check runs. Tag ignores slot naming attributes with a dev warning, because its name must identify the tag the button removes; `dismissLabel` is its naming API, and a merged button's text label still replaces it.
  - *One implementation.* The predicate, the DOM check and the observer are the F2 helper `src/lib/labelInName.ts` (§2.2, wave D change request). Until it lands, MessageBar, SearchBox and Tag carry identical local copies; each switches to the helper when it lands (the lead re-dispatches; INTEGRATION checks that no local copy remains). (`feedback-navigation#1`, `data-display#1`, `data-display#10`)

### C-BUTTON-TYPE — every internal `<button>` has `type="button"`
Placed before `{...rest}` so consumers can override. Tested with `testNoImplicitSubmit` (§4.1), including the Dialog and Drawer close buttons (P15). The conventions gate fails on any JSX `<button` opening tag in `src/components` without a literal `type=` attribute. (`button-provider#1`)

### C-NATIVE — native elements without Preflight
Wave no longer ships Preflight by default. `base.css` (§2.1.6) applies a zero-specificity reset to the native elements Wave renders (`button`, `input`, `select`, `textarea`, `ul`, `ol`, headings, `p`, `fieldset`, `legend`, `table`, `hr`, `img`) **inside `.wave-root` and `.wave-portal` only**, so WaveProvider is required for the precompiled path (documented). Components still set every property they visually depend on with utilities (padding, border width/style/color, background, list-style when they render markers) and must not rely on anything beyond that reset.

### C-ROUTING — composite controls route props to the focusable element
For components whose root is a wrapper (Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TagPicker, DatePicker, TimePicker):
- **To the control** (the element with the widget role): `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `autoFocus`, `tabIndex`, `onFocus`, `onBlur`, `onKeyDown`, `onKeyUp`, (Checkbox/Switch also `onClick`), and native input attributes for text-entry controls (`placeholder`, `autoComplete`, `inputMode`, `maxLength`, `spellCheck`, `enterKeyHint`, `readOnly`).
- **Root keeps**: `className`, `style`, `data-*`, other handlers, and **`ref`** (unchanged for backward compatibility).
- New prop **`controlRef?: React.Ref<El>`** exposes the focusable element.
- Field integration comes from `useFieldControl` (§2.5). (`input-basic#1`)

### C-FORMS — native form participation
Every value control accepts `name`, `form`, `required`, (`value` for checkbox-like) and renders `<HiddenInput>` (§2.5) **when the consumer passes `name` or `required`**, so it appears in `FormData`, honours `required`, and resets with its form (uncontrolled; reset works without a name too, via `useFormReset` on the control). No default names are invented (a RadioGroup without `name` adds nothing to `FormData`). (`input-basic#12`)

### C-POPUPS — every anchored surface
`<Portal>` + `usePopupPosition` + `useDismiss`; add `useRestoreFocus` when focus moves into the surface; Dialog/Drawer use `useModalLayer` (trap + isolation + restore + scroll lock in the right order, §2.4). No inline `absolute top-full` popups remain. Hooks that need the surface element hold it in state via a callback ref (`const [surface, setSurface] = useState<HTMLElement | null>(null)`), never read `ref.current` from an effect keyed on `open`. (`overlays#36`, `overlays#37`, `overlays#1`)

### C-COMPOUND — flat names for sub-components
Compound components keep `Object.assign` dotted access (`Card.Header`) and additionally export every sub-component under a flat `<Parent><Member>` name from the same module (`CardHeader`, `DialogTrigger`, `MenuItem`, `TableRow`, `RadioGroupItem`; existing flat names such as `RadioItem` are kept). React Server Components cannot dot into a client module, so the flat names are what RSC users import; JSDoc notes this. One test per module asserts `CardHeader === Card.Header`. (`repo-level#2`)

### C-HOOKS — lint-compatible patterns (react-hooks v7 rules are errors)
`eslint-plugin-react-hooks` 7 enables `set-state-in-effect`, `set-state-in-render`, `refs`, `purity`, `immutability` and `globals` as errors. Use these patterns instead of setState-in-effect:
- **Derive during render.** Clamped indices (Carousel, TabList, Pagination, TeachingPopover), effective selection (`selected ∩ registered`, DataGrid/List), active option (useListbox), focused day (DatePicker) are computed from props/state during render, never written back by an effect.
- **Adjust state during render on prop change** with a previous-value state: `const [prev, setPrev] = useState(x); if (prev !== x) { setPrev(x); setOther(…); }` (conditional setState in render is allowed by the rule).
- **DOM-derived collections** go through `useSyncExternalStore` with a MutationObserver/ResizeObserver subscription (roving items, overflow membership), or are computed at event time.
- **Mount detection** uses F3 `useIsClient()` (`useSyncExternalStore(noop, () => true, () => false)`), never a `mounted` state flag.
- **Deferred updates** (announce after mount, e.g. Spinner): schedule `requestAnimationFrame`/`queueMicrotask` in the effect and set state in that callback (asynchronous calls are not flagged).
- **Refs** are written in event handlers, ref callbacks, layout effects or insertion effects (the F3 `useEventCallback`/`useControllable` sync, which must be current before any layout effect of the commit), never read during render.
- **Calling consumer callbacks** from effects is fine (`onPageChange` after a clamp).

The only allowed disable form is `// eslint-disable-next-line react-hooks/<rule> -- <reason>`, and only at these sites: (1) `refs` false positives where a cloned element's `props.ref` is merged — F3 `useTriggerElement`, P02 Field child clone; (2) `set-state-in-effect` in F3 `useTriggerElement`'s wrapper fallback (a layout effect detects that the child's ref never attached and switches to the span wrapper once). Any other site needs a change request (§7.1.3).

### C-DEV — development diagnostics
All warnings go through `src/lib/dev.ts` (`devWarn`, `warnOnce`, `warnDeprecated`), are prefixed `[WaveUI]` and are stripped in production (`process.env.NODE_ENV` guard).
- **Component diagnostics** are emitted from effects with `warnOnce`. This applies above all to warnings that read mounted state (DOM nodes, refs, measured layout).
- **Call-time exceptions (during render)**: the pure F2 helpers `resolveDeprecatedProp`/`warnDeprecated`, `resolveSlot`/`renderSlot` and `renderTrigger` warn when they are called. They go through `warnOnce`, which dedupes by key in `getGlobalRegistry('warnings')`, so StrictMode double renders, discarded concurrent renders and re-renders warn once per key.
- **Deprecated aliases** (C-NAMING): components resolve them by calling `resolveDeprecatedProp` directly during render. It warns during render, once per `(component, prop)`, so alias resolution is not wrapped in an effect. A deprecated *callback* alias (e.g. `onChange` next to `onValueChange`) is not resolved to one value, because both callbacks are invoked. The component calls `warnDeprecated` for it when the old prop is present. That call is also safe during render.
- Never call `devWarn` (not deduplicated) during render.

### C-TESTS
- Regression test first; query by role + accessible name; no presence-only (`toBeInTheDocument` as the only assertion) variant tests; no hex-class assertions.
- `testSystemProps` with representative `defaultProps` (real children) and `a11yVariants` for important states; axe runs on `document.body` (portals included) with the shared F6t configuration (`region` disabled — component-in-isolation scope; `color-contrast` disabled — jsdom cannot compute it, §4.5), audits also fail on dangling ARIA id references, and after cleanup `document.body` must be empty and no overlay state (dismiss layer, focus trap, scroll lock, modal isolation, restore-focus tracker) may remain (revision 3).
- Tests exercise only your package plus foundation modules. Composition with another package's component (Menu+MenuButton, Tooltip in Drawer/Table/Card/Overflow, Field around P03–P06 controls, Toast in Dialog, Dropdown in Dialog, Dialog from Popover) is INTEGRATION's (§5.9); use the stand-ins named there (raw `useDismiss`/`Portal` harnesses, `renderWithFieldContext`, trigger-prop objects).
- Timers: `vi.useFakeTimers({ shouldAdvanceTime: true })` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- Stateful components: one StrictMode test that the value callback fires exactly once per interaction.
- Directional components: an RTL test. Popups: open-state axe + dismissal + focus-return tests.
- Type-level contracts: `expectTypeOf` / `// @ts-expect-error` in `__tests__` (type-checked by `tsconfig.dev.json`).
- Tests and stories you own must be type-clean under `tsconfig.dev.json`.

### C-STORIES
- Title `Components/<Category>/<Name>`; Category ∈ {Button, Typography, Input, Data Display, Layout, Feedback, Navigation, Overlays, Table, Provider}.
- Defaults in `args`, `{...args}` spread last, render functions take and forward `args`, no unused `argTypes`.
- Callbacks via `fn()` from `storybook/test`; dismissible stories keep local state.
- Every default story has an accessible name; intentionally unlabeled variants carry `aria-label` + a comment.
- Tokens only: no hex, palette or white/black color utilities in stories either; fixture data (ColorPicker/SwatchPicker swatches, Image placeholders) carries `// wave-allow-color: fixture` (enforced by the conventions gate over `stories/*.stories.tsx`).
- Must pass the stories axe gate (§4.4): structural axe rules in the default (light) theme. Color contrast is verified by `tokens.test.ts` and the per-theme manual check of §4.5, not by jsdom.
- Add Disabled/Invalid stories where missing (`repo-level#37`).

### C-DOCS — JSDoc
Each touched component gets a component-level JSDoc description (feeds Storybook autodocs), and prop JSDoc that matches behaviour (including deprecations: `@deprecated Use \`onValueChange\`.`). A compound's description sits on its exported `Object.assign` const only, where `index.d.ts` keeps it; Storybook reads it through `.storybook/exportDocblocks.ts` (revision 3, R13).

### C-PURE — tree-shakeable compounds
`export const X = /* @__PURE__ */ Object.assign(Root, { … })`.

---

## 2. Foundation design

### 2.1 F1-tokens — tokens, themes and style entries

#### 2.1.1 Files

| File | Role |
|---|---|
| `src/styles/tokens.css` | Runtime tokens (`--wave-*`) per theme, derived vars, z-index vars, `@theme inline` mapping to Tailwind (colors, `font-wave`, type ramp, shadows, animations + keyframes). Exported as `./tokens` (Tailwind source). |
| `src/styles/base.css` (new) | Scoped base for `.wave-root` / `.wave-portal` (font, color; background on `.wave-root` only) and the zero-specificity native-element reset (§2.1.6). Plain CSS, **unlayered**. |
| `src/styles/styles.css` (new) | Build input for the precompiled, **unlayered** `dist/styles.css` (§2.1.8), in this order: `@import "tailwindcss/theme.css" theme(inline); @import "./tokens.css"; @import "./base.css"; @import "tailwindcss/utilities.css" source(none); @source "../components"; @source "../lib"; @source not "../components/**/__tests__";`. `theme(inline)` inlines every Tailwind theme value into the utilities (no `:root { --spacing … }` emitted); `source(none)` disables automatic source detection, so only the explicit sources are scanned; utilities come last so they beat the equal-specificity root rules of base.css. |
| `.storybook/preview.css` (new, F6b) | Storybook-only entry: `@import "../src/styles/styles.css"; @source "../stories";` so story-only utilities exist in Storybook but never in `dist/styles.css`. |
| `src/styles/tailwind.css` (new) | Tailwind-4 consumer entry: `@import "./tokens.css" layer(theme); @import "./base.css" layer(base); @source "../../dist";` — consumers write `@import "tailwindcss"; @import "@mortenbrudvik/waveui/tailwind";`. Here Wave joins the consumer's own layer order (theme, base, components, utilities), so the reset never beats a utility. Tailwind users import **this**, never `./styles`. |
| `src/styles/preflight.css` (new) | `@import "tailwindcss/preflight.css";` → `dist/preflight.css` (opt-in, unlayered like styles.css). |
| `src/styles/legacy-tokens.css` (new) | Opt-in, deprecated 0.4 compatibility layer (§2.1.2): re-declares the 0.4 **semantic** names per theme group (`--primary: var(--wave-brand-80)` …), points the `--wave-*` semantics at them (`--wave-primary: var(--primary)`), and declares the 0.4 ramp names as literal constants for readers. Load it after `./styles`/`./tailwind`. Never in apps that define shadcn-style variables. |
| `src/styles/globals.css` | Kept (not exported) as a full dev entry mirroring the Tailwind consumer path: `@import "tailwindcss"; @import "./tokens.css" layer(theme); @import "./base.css" layer(base);`. |
| `src/styles/animations.css` | Kept as an empty deprecated file (keyframes moved into `@theme`); global `*` reduced-motion override removed. |
| `src/styles/__tests__/tokens.test.ts` (new) | Parses `tokens.css`: every theme declares every token; contrast pairs in §2.1.3 meet their thresholds, compared **unrounded** (compute the WCAG ratio in the test); every text token is 4.5:1 on every surface it can sit on, and every colour token is classified as text, surface or not text (text matrix, §2.1.3); no `--radius-*`/`--font-sans` overrides; keyframes present inside `@theme`; `color-scheme` on the three theme classes and not on `:root`; legacy fallbacks present on ramp tokens; `legacy-tokens.css` has no reference cycle (no `--wave-*` it defines is read back by `tokens.css` through the same legacy name). |
| `scripts/build-css.mjs` (new) | Runs `@tailwindcss/cli` for `styles.css → dist/styles.css` and `preflight.css → dist/preflight.css` (minified), then asserts: required selectors, `@keyframes wave-*`, `--wave-*` vars and the scoped native reset rules are present; no top-level `@layer` block other than Tailwind's `@layer properties` fallback (the output is unlayered); `--spacing:`, `--font-sans:`, `--color-red-500` are absent; no class that occurs only in `stories/` is present (the script diffs class tokens of `stories/*.stories.tsx` against `src/components`/`src/lib`). |

#### 2.1.2 Theme selectors, prefix and legacy aliases (`repo-level#7`, `button-provider#6`, `repo-level#11`)
- Runtime variables are prefixed `--wave-*`. Tailwind utilities are unchanged (`bg-primary` ⇢ `--color-primary: var(--wave-primary)`), so components need no class changes for the rename.
- Light tokens: `:root, .wave-light { … }`. Dark: `.wave-dark, .dark { … }`. High contrast: `.wave-high-contrast, .high-contrast { … }`. The legacy `.dark` / `.high-contrast` selectors are deprecated aliases; they set only `--wave-*` variables, so they no longer collide with shadcn-style `--primary` definitions.
- `color-scheme` is set **only on the theme classes** (`.wave-light { color-scheme: light }`, `.wave-dark, .wave-high-contrast { color-scheme: dark }`), never on `:root`, so a page without WaveProvider keeps its own scrollbars/native-control scheme. WaveProvider always emits a theme class (`wave-light` for light), so provider subtrees and portals get the right scheme (`repo-level#11`).
- Derived variables are re-declared in **every** theme selector group so nested themes re-resolve: `--wave-card-foreground: var(--wave-foreground); --wave-secondary-foreground: var(--wave-foreground); --wave-accent: var(--wave-primary); --wave-accent-foreground: var(--wave-primary-foreground);`.
- Brand and grey ramps are theme-independent constants on `:root` that **read the 0.4 names as fallbacks**: `--wave-brand-80: var(--brand-80, #0f6cbd); --wave-grey-26: var(--grey-26, #424242); …`. The 0.4 ramp names never collided with other libraries, so consumer overrides of `--brand-*`/`--grey-*` keep working without any opt-in. Light/dark primary aliases reference the ramp (`--wave-primary: var(--wave-brand-80)`, dark `var(--wave-brand-110)`), so overriding either ramp name re-themes (`repo-level#15`).
- The 0.4 **semantic** names (`--primary`, `--background`, `--border`, `--ring`, …) are what collided with shadcn/ui, so the default entries neither define nor read them. `legacy-tokens.css` (opt-in, deprecated) restores full 0.4 compatibility — reading **and** overriding the old semantic names — by declaring them per theme group and pointing the `--wave-*` semantics at them; it declares the ramp names as literal constants (`--brand-80: #0f6cbd`) so readers work, and never `var(--wave-brand-*)`, which would create a cycle with the ramp fallbacks. Overriding the 0.4 semantic names without that import no longer affects Wave (listed in §7.3 with the migration step).
- Removed overrides of Tailwind defaults: `--radius-*`, `--radius-DEFAULT`, `--font-sans`. Font family is the runtime token `--wave-font-family` (Segoe UI stack, on `:root`) mapped to `--font-wave: var(--wave-font-family)` in `@theme inline` (utility `font-wave`), applied by WaveProvider/Portal roots.
- Tailwind utility names (`bg-primary`, `border-border`, `text-muted-foreground`, …) are **not** namespaced: they are the documented 0.4 vocabulary used in consumer code and `className` overrides. The remaining collision with another design system that defines the same `--color-*` names is a formal partial wont-fix of `repo-level#7` (§7.4) with documented workarounds.

#### 2.1.3 Token table and computed WCAG 2.2 contrast
Ratios computed with the WCAG relative-luminance formula (script in the scratchpad `arch/cr.cjs`; F1's test recomputes them).

| Token (`--wave-…`) | Light | Dark | High contrast |
|---|---|---|---|
| background | #ffffff | #292929 | #000000 |
| foreground | #242424 | #ffffff | #ffffff |
| card | #fafafa | #333333 | #000000 |
| secondary | #f5f5f5 | #333333 | #000000 |
| muted | #f0f0f0 | #383838 | #1a1a1a |
| muted-foreground | **#616161** (was #707070) | #adadad | #ffffff |
| primary | var(--wave-brand-80) #0f6cbd | **var(--wave-brand-110) #62abf5** (was #479ef5) | #1aebff |
| primary-foreground | #ffffff | **#000000** (was #fff) | #000000 |
| primary-hover | var(--wave-brand-70) #115ea3 | var(--wave-brand-120) #77b7f7 | #6ef3ff |
| primary-pressed | var(--wave-brand-40) #0c3b5e | var(--wave-brand-90) #2886de | #00c4d6 |
| destructive / error | #c50f1f | **#f48a94** (was #dc626d) | **#ff6e6e** (was #ff6060) |
| destructive-foreground / error-foreground | #ffffff | **#000000** | #000000 |
| subtle | transparent | transparent | transparent |
| subtle-hover | #f5f5f5 | #333333 | #1f1f1f |
| subtle-pressed | **#ebebeb** (0.4 hard-coded #e0e0e0) | #2e2e2e | #333333 |
| subtle-selected | #ebebeb | #383838 | #333333 |
| selected | #ebf3fc | #082338 | **#003a40** (dark cyan tint; was #1aebff) |
| selected-foreground | #0f548c | #62abf5 | **#ffffff** |
| border | #e0e0e0 | #666666 | #ffffff |
| stroke | #d1d1d1 | #666666 | #ffffff |
| stroke-hover | #c7c7c7 | #757575 | #ffffff |
| stroke-accessible | #616161 | #adadad | #ffffff |
| input | #d1d1d1 | #666666 | #ffffff |
| ring | #0f6cbd | #479ef5 | #ffff00 |
| success / -foreground | #107c10 / #ffffff | **#5db55d** (was #54b054) / #000000 | #3ff23f / #000000 |
| success-tint / -tint-foreground | #f1faf1 / #0e700e | #052505 / #54b054 | #000000 / #3ff23f |
| warning / -foreground | #fde300 / #242424 | #fde300 / #000000 | #ffff00 / #000000 |
| warning-tint / -tint-foreground | #fffbe6 / #6d5b00 | #463100 / #fde300 | #000000 / #ffff00 |
| error-tint / -tint-foreground | #fdf3f4 / #b10e1c | #3b0509 / #f48a94 | #000000 / #ff6060 |
| severe / -foreground | #da3b01 / #ffffff | #e97548 / #000000 | #ff8c00 / #000000 |
| severe-tint / -tint-foreground | #fdf6f3 / #a52c00 | #411200 / #e97548 | #000000 / #ff8c00 |
| info / -foreground | #0f6cbd / #ffffff | #479ef5 / #000000 | #1aebff / #000000 |
| info-tint / -tint-foreground | #ebf3fc / #0f548c | #082338 / **#62abf5** (revision 2: #479ef5) | #000000 / #1aebff |
| inverted / -foreground / -border | #292929 / #ffffff / transparent | #ffffff / #242424 / transparent | #000000 / #ffffff / #ffffff |
| track | #e0e0e0 | #3d3d3d | #4d4d4d |
| skeleton | #e0e0e0 | #3d3d3d | #333333 |
| rating | #b86e00 | #f7b538 | #ffff00 |
| presence-available / busy / away / offline / oof | #107c10 / #c50f1f / #a67c00 / #616161 / #b4009e | #54b054 / #f48a94 / #f7b538 / #adadad / #d696c8 | #3ff23f / #ff6060 / #ffff00 / #ffffff / #ff80ff |
| presence-glyph | #ffffff | #000000 | #000000 |
| backdrop | rgb(0 0 0 / 0.4) | rgb(0 0 0 / 0.5) | rgb(0 0 0 / 0.8) |

Contrast pairs introduced or changed (threshold: 4.5 text, 3.0 non-text/large):

| Pair | Light | Dark | HC |
|---|---|---|---|
| foreground / background | 15.52 | 14.55 | 21.00 |
| muted-foreground / background | 6.19 | 6.48 | 21.00 |
| muted-foreground / muted | 5.43 | 5.23 | 17.40 |
| muted-foreground / subtle-hover | 5.68 | 5.63 | 16.48 |
| primary-foreground / primary | 5.38 | 8.66 | 14.37 |
| primary-foreground / primary-hover | 6.66 | 9.90 | 15.93 |
| primary-foreground / primary-pressed | 11.65 | 5.56 | 9.87 |
| primary (as text) / background | 5.38 | 6.00 | 14.37 |
| primary (as text) / subtle-hover or card | 4.94 (#f5f5f5) | 5.21 (#333333) | 11.28 |
| primary (as text) / subtle-selected | 4.517 (#ebebeb) | 4.84 (#383838) | 8.65 |
| foreground / subtle-selected | 13.02 | 11.73 | 12.63 |
| selected-foreground / selected | 7.03 | 6.62 | 12.51 |
| foreground / selected | 13.87 | 16.06 | 12.51 |
| muted-foreground / selected | 5.53 | 7.16 | 12.51 |
| primary (as text) / selected | 4.81 | 6.62 | 8.56 |
| ring / selected (3:1) | 4.81 | 5.72 | 11.65 |
| stroke-accessible / background (3:1) | 6.19 | 6.48 | 21.00 |
| primary / track (progress fill, 3:1) | 4.08 | 4.48 | 5.78 |
| error (text) / background | 6.07 | 6.17 | 7.71 |
| error (text) / card | — | 5.36 | — |
| error-foreground / error | 6.07 | 8.91 | 7.71 |
| success-foreground / success | 5.37 | 8.23 | 13.98 |
| warning-foreground / warning | 11.95 | 16.16 | 19.56 |
| severe-foreground / severe | 4.56 | 7.10 | 9.00 |
| info-foreground / info | 5.38 | 7.48 | 14.37 |
| success-tint-foreground / success-tint | 5.89 | 6.06 | 13.98 |
| warning-tint-foreground / warning-tint | 6.42 | 9.51 | 19.56 |
| error-tint-foreground / error-tint | 6.55 | 7.35 | 7.09 |
| severe-tint-foreground / severe-tint | 6.64 | 5.42 | 9.00 |
| info-tint-foreground / info-tint | 7.03 | 6.62 | 14.37 |
| inverted-foreground / inverted | 14.55 | 15.52 | 21.00 |
| rating / background (3:1) | 3.99 | 8.05 | 19.56 |
| presence-away / background (3:1) | 3.82 | 8.05 (#f7b538) | 19.56 |
| presence-glyph / presence-available, busy, away, oof | 5.37 / 6.07 / 3.82 / 6.11 | 7.72 / 8.91 / 11.62 / 9.06 | ≥ 7.09 |
| ring / background (3:1) | 5.38 | 5.18 | 19.56 |

Known limit documented in README: `warning` fill (#fde300) is only a background/accent (1.30:1 vs white); warning icons and text use `warning-tint-foreground`. Selected items still use `text-foreground` + a non-color indicator; primary-as-text on `subtle-selected` and `subtle-pressed` (both #ebebeb) passes but with little margin in light (4.517; success text 4.502). In high contrast, `selected` is a dark cyan tint (#003a40) so white text, cyan primary text and the yellow ring all stay readable on selected rows/cards (revision 1's #1aebff gave white text 1.46:1); selected surfaces in HC also show a `border-primary` indicator. The tokens test compares **unrounded** ratios (revision 1's dark primary-on-card pair was 4.499 and only passed when rounded).

**Text matrix (verification-round decision, lead).** The pair table above lists the pairs the review named, but components put a text token on any surface of its theme. A real-browser axe sweep of every Storybook story in the three themes (rest, interactive and selection states; a one-off run, not a gate, §4.5) found high-contrast `error` text (#ff6060) at 4.27:1 on `subtle-pressed` #333333: the delete action of a pressed, selected List row, a pair no table listed. Rule: **every text token is at least 4.5:1, compared unrounded, on every surface it can sit on, in every theme.** `tokens.test.ts` checks the whole matrix, and it classifies every colour token as text, surface, or not text with a recorded reason, so a new token fails the test until it is classified.
- Surfaces any text can sit on: `background` (popovers, menus, dialogs and toasts use it too), `card`, `secondary`, `muted`, `subtle-hover`, `subtle-pressed`, `subtle-selected`, `selected` and the five status tints (MessageBar renders its title, body, links, actions and dismiss button on the tint).
- Text tokens checked on all of these surfaces: `foreground` (with `card-foreground` and `secondary-foreground`), `muted-foreground`, `primary` (with `accent`), `error` (with `destructive`), `success` (completed Stepper steps), `warning-tint-foreground` and `info-tint-foreground`.
- Text tokens bound to particular surfaces: `selected-foreground` on `selected`, `inverted-foreground` on `inverted`, `success-`/`error-`/`severe-tint-foreground` on their tint and on `background` (Toast), and each fill's `-foreground` on its fill (`primary-foreground` also on `primary-hover` and `primary-pressed`).
- Not text (the reason is recorded in the test; the 3:1 non-text pairs stay in the pair table): the `warning`, `severe` and `info` fills, `primary-hover`/`primary-pressed` as surfaces, `subtle`, `border`, `stroke`, `stroke-hover`, `stroke-accessible`, `input`, `ring`, `track`, `skeleton`, `rating`, `presence-*`, `inverted-border` and `backdrop`.

The matrix changed four values in the token table. Each line gives the lowest failing ratios, before → after:
- light `subtle-pressed` #e0e0e0 → #ebebeb (grey-92, the `subtle-selected` value, so pressed and selected share one grey): primary text 4.08 → 4.52, success text 4.07 → 4.50;
- dark `success` #54b054 → #5db55d: 4.31 → 4.60 on `muted`/`subtle-selected` #383838 (`success-foreground` / `success` 7.72 → 8.23);
- dark `info-tint-foreground` #479ef5 → #62abf5 (brand-110, as dark `primary`): 4.18 → 4.84 on #383838 (`info-tint-foreground` / `info-tint` 5.72 → 6.62);
- high-contrast `destructive`/`error` #ff6060 → #ff6e6e: 4.22 on `selected` #003a40 and 4.27 on `subtle-pressed`/`subtle-selected` #333333 → 4.59 and 4.64 (`error` / `background` and `error-foreground` / `error` 7.09 → 7.71).

Dark `success-tint-foreground` and `presence-available` keep #54b054, and high-contrast `error-tint-foreground` and `presence-busy` keep #ff6060: the tint foregrounds sit only on their tint and the page, and the presence colours are fills under the presence glyph (3:1 pairs above), so both already pass.

#### 2.1.4 Tailwind mapping (`@theme inline`)
`--color-<name>: var(--wave-<name>)` for every token above except the ramps (the ramps are also exposed as `--color-brand-10…160` for designers). Plus: `--font-wave: var(--wave-font-family)`; the existing type ramp `--text-caption-2 … --text-display` (unchanged, now known to `cn`, §2.2); shadows `--shadow-2/4/8/16/28/64`; animations (§2.1.7).

#### 2.1.5 Z-index scale (`overlays#36`)
`:root { --wave-z-overlay: 1000; --wave-z-toast: 1100; --wave-z-tooltip: 1200; }`. Portals add their nesting depth (§2.4) so a surface opened from inside another overlay always stacks above it.

#### 2.1.6 Base (`base.css`) and forced colors (`button-provider#2`, `repo-level#7`, `input-basic#9`)
```css
/* unlayered in dist/styles.css, layer(base) in the ./tailwind entry (§2.1.8); zero specificity except the two root rules */
.wave-root, .wave-portal {
  font-family: var(--wave-font-family);
  color: var(--wave-foreground);
  font-size: 14px; line-height: 20px;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.wave-root { background-color: var(--wave-background); }   /* portals never paint a background */

:where(.wave-root, .wave-portal) :where(*),
:where(.wave-root, .wave-portal) :where(*)::before,
:where(.wave-root, .wave-portal) :where(*)::after { box-sizing: border-box; border-color: var(--wave-border); }

/* native-element reset, limited to what Wave renders (C-NATIVE) */
:where(.wave-root, .wave-portal) :where(button, input, select, textarea) {
  font: inherit; color: inherit; letter-spacing: inherit;
  margin: 0; padding: 0; border: 0 solid; background-color: transparent;
}
:where(.wave-root, .wave-portal) :where(button, [role="button"]) { cursor: pointer; }
:where(.wave-root, .wave-portal) :where(ul, ol) { list-style: none; margin: 0; padding: 0; }
:where(.wave-root, .wave-portal) :where(h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd) { margin: 0; }
:where(.wave-root, .wave-portal) :where(h1, h2, h3, h4, h5, h6) { font-size: inherit; font-weight: inherit; }
:where(.wave-root, .wave-portal) :where(fieldset) { margin: 0; padding: 0; border: 0; min-width: 0; }
:where(.wave-root, .wave-portal) :where(legend) { padding: 0; }
:where(.wave-root, .wave-portal) :where(table) { border-collapse: collapse; text-indent: 0; }
:where(.wave-root, .wave-portal) :where(hr) { height: 0; border: 0 solid; border-top-width: 1px; color: inherit; margin: 0; }
:where(.wave-root, .wave-portal) :where(img, svg, video) { vertical-align: middle; }
```
- The pseudo-element selector is written outside `:where()` (pseudo-elements are invalid inside `:where()/:is()` and forgiving parsing would drop them silently).
- Zero-specificity `:where()`, so any author style wins; `border: 0 solid` resets the UA 2px outset button border so a single `border-b-2` utility only draws the bottom edge.
- No Preflight, no `body` rules, no global `*` rules: everything is scoped to `.wave-root`/`.wave-portal`, so WaveProvider is **required** for the precompiled `./styles` path (documented). Consumer content inside the provider also receives this reset (documented in README "Global effects"; it is a subset of Preflight, which 0.4 applied to the whole page).
- `build-css.mjs` asserts these rules are present in `dist/styles.css`.
- Forced colors are handled per component with the `forcedColors` recipes of §2.2 (Tailwind `forced-colors:` variants with system colors); `focus:outline-hidden` keeps a visible focus outline in forced-colors mode (always `focus:`-scoped, see C-FOCUS).

#### 2.1.7 Motion (`repo-level#6`, `repo-level#12`, `repo-level#13`)
Inside `@theme inline`:
```css
--animate-wave-spin: wave-spin 0.8s linear infinite;
--animate-wave-spin-slow: wave-spin 2.4s linear infinite;
--animate-wave-pulse: wave-pulse 1.5s ease-in-out infinite;
--animate-wave-indeterminate: wave-indeterminate 1.5s ease-in-out infinite;
--animate-wave-indeterminate-rtl: wave-indeterminate-rtl 1.5s ease-in-out infinite;
@keyframes wave-spin { to { transform: rotate(360deg); } }
@keyframes wave-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
@keyframes wave-indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
@keyframes wave-indeterminate-rtl { 0% { transform: translateX(100%); } 100% { transform: translateX(-350%); } }
```
Reduced-motion alternates (applied by P11): Spinner `motion-reduce:animate-wave-spin-slow` (still clearly spinning); indeterminate ProgressBar `motion-reduce:w-full motion-reduce:translate-x-0 motion-reduce:animate-wave-pulse` (full-width pulse — never a static 40 % bar); Skeleton `motion-reduce:animate-none`.

#### 2.1.8 Cascade strategy, sources and browser baseline (`repo-level#1`, `repo-level#7`)
Verified with tailwindcss 4.2.1 (`@tailwindcss/node` compile of the exact entries):
- **`dist/styles.css` (non-Tailwind consumers) is unlayered.** Any unlayered consumer CSS beats *layered* CSS regardless of specificity, so a layered Wave build would be stripped by ordinary resets (`*{padding:0}`, `button{background:none}`, `a{color:…}`, normalize.css, a Bootstrap reboot). Unlayered utilities (specificity 0,1,0) beat those resets (0,0,0 / 0,0,1). Only Tailwind's `@layer properties` fallback (the `@property` polyfill for `--tw-*` variables in old browsers) remains layered; it sets `--tw-*` custom properties only. Consumers who want Wave inside their own layer order write `@import url("@mortenbrudvik/waveui/styles.css") layer(wave);` (documented).
- **Order inside `styles.css`**: theme (inline, emits nothing), tokens, base, utilities last — so a utility on the WaveProvider root (`className="text-lg"`) beats base's `.wave-root { font-size }`.
- **No foreign theme variables**: `theme(inline)` inlines Tailwind's defaults into each utility (`.p-4 { padding: calc(0.25rem * 4) }`), so `dist/styles.css` defines no `--spacing`, `--font-sans`, `--radius-*` or palette variables that could override a Tailwind consumer's theme (asserted by build-css.mjs). Tailwind users still import `./tailwind`, never `./styles` (documented).
- **Sources are pinned**: `source(none)` + explicit `@source` for components and lib (tests excluded). Storybook compiles `.storybook/preview.css`, which adds `@source "../stories"`, so story-only utilities exist in Storybook and never in `dist`. Both directions are asserted (build-css.mjs: story-only class absent; verify-storybook.mjs: present).
- **Tailwind entry** (`./tailwind`): tokens in `layer(theme)`, base in `layer(base)`, so Wave joins the consumer's layer order and the reset never beats a utility.
- **Browser baseline** (Tailwind 4 output): Chrome/Edge 111+, Safari 16.4+, Firefox 128+ (`@property`, `color-mix()`, `:where()`); documented in README.

### 2.2 F2-lib — shared utilities

| File | Exports | Behaviour |
|---|---|---|
| `cn.ts` | `cn(...inputs: ClassValue[]): string`, `twMerge` | `extendTailwindMerge({ extend: { theme: { text: ['caption-2','caption-1','body-1','body-2','subtitle-2','subtitle-1','title-3','title-2','title-1','large-title','display'], shadow: ['2','4','8','16','28','64'], font: ['wave'], animate: ['wave-spin','wave-spin-slow','wave-pulse','wave-indeterminate','wave-indeterminate-rtl'] } } })`. Tests: `cn('text-body-1','text-foreground')` keeps both; `cn('text-body-1','text-sm') === 'text-sm'`; `cn('shadow-4','shadow-8') === 'shadow-8'`; `cn('shadow-4','shadow-lg') === 'shadow-lg'`; token color classes (`bg-subtle-hover`, `border-stroke-accessible`) merge as colors. (`table-core#1`) |
| `slot.ts` | `Slot<T>`, `SlotObject<T>`, `ResolvedSlot`, `resolveSlot`, `renderSlot`, `VOID_ELEMENTS` | `SlotObject<T extends React.ElementType = 'span'> = { as?: React.ElementType; children?: React.ReactNode; className?: string; style?: React.CSSProperties; ref?: React.Ref<unknown> } & Omit<React.ComponentPropsWithoutRef<T>, 'children' \| 'className' \| 'style'>`. `Slot<T> = SlotObject<T> \| React.ReactElement \| string \| number \| bigint \| boolean \| null \| undefined \| Iterable<React.ReactNode>`. `resolveSlot(slot, defaultAs?, baseClassName?, defaultProps?)` / `renderSlot(…same)`; the public `ResolvedSlot` shape stays `{ Component, props, children }` (unchanged from 0.4). `null/undefined/false/true → null`; `isSlotObject` accepts only plain objects — React elements, iterables (`Symbol.iterator in value`: arrays, Sets, generators) and thenables are never treated as slot objects, so they render as children of `defaultAs` (tests for Set and generator slots); slot object → `Component = as ?? defaultAs`, `props = { ...defaultProps, ...rest, className: cn(base, className) }`, `children`; a slot object whose element (`as ?? defaultAs`) is **void** always drops its `children`, with a dev warning only when some item would render (a conditional `children: cond && x` or a list mapped to nothing stays silent); ReactElement with a **void** default tag → the element itself: its own type and props (className merged, defaultProps under its own props, `ref` kept since React 19 carries it in props); a Fragment with a void default tag → `null` + dev warning (a Fragment cannot take the element props); primitive or iterable with a void default tag → `null` + dev warning (component decides, e.g. Avatar treats a string as `src`). **"Renders nothing" rule** (both void cases): no warning for content React renders nothing for: `''`, or an array/Set/generator whose items at any depth are only `null`, `undefined`, booleans or `''` (generators are materialised once and cached, so the check does not consume them). Anything else is wrapped as children of `defaultAs` with `{ ...defaultProps, className: base }`. Warnings are emitted at call time through `warnOnce` (C-DEV). (`table-core#18`, `data-display#3`, `button-provider#21`, `table-core#27`) |
| `types.ts` | existing + `Orientation`, `SelectionMode = 'single' \| 'multiple'`, `TextWeight = 'regular' \| 'semibold' \| 'bold'`, `Shape = 'circular' \| 'square' \| 'rounded'`, `PopupSide = 'top' \| 'bottom' \| 'start' \| 'end' \| 'left' \| 'right'`, `PopupAlign = 'start' \| 'center' \| 'end'`; re-exports `Slot`, `SlotObject`, `ResolvedSlot`, `PolymorphicProps`, `PolymorphicComponent` | (`layout#16`, `data-display#30`, `table-core#33`) |
| `composeEventHandlers.ts` | `composeEventHandlers<E extends { defaultPrevented: boolean }>(theirs?: (e: E) => void, ours?: (e: E) => void, options?: { checkDefaultPrevented?: boolean }): (e: E) => void` | Calls `theirs` first, then `ours` unless `checkDefaultPrevented !== false && e.defaultPrevented`. (`layout#10`) |
| `mergeRefs.ts` | `mergeRefs<T>(...refs: Array<React.Ref<T> \| undefined \| null>): React.RefCallback<T>`, `setRef` | Supports React 19 callback-ref cleanups: the returned callback collects each ref's cleanup and returns one cleanup that runs them (or assigns `null` to object refs / calls non-cleanup callbacks with `null`). (`overlays#35`) |
| `mergeProps.ts` | `mergeProps<A, B>(ours: A, theirs: B, options?: { oursWin?: readonly string[] }): A & B` | `on*` handlers composed (theirs first), `className = cn(ours, theirs)`, `style = { ...ours, ...theirs }`, `aria-describedby`/`aria-labelledby` joined with `joinIds`, `ref` merged; keys in `oursWin` keep our value (triggers pass `['aria-expanded', 'aria-controls', 'aria-haspopup']` so a child's static attribute never overrides live state); other keys: `theirs` wins unless `undefined`. Pure function; components that clone on every render use F3 `useTriggerElement`, which memoises the merged ref. |
| `renderTrigger.tsx` | `type TriggerChildren<P> = React.ReactElement \| ((props: P) => React.ReactNode)`; `renderTrigger<P>(children, triggerProps: P, options: { componentName: string; fallback?: 'span' \| 'button'; asChild?: boolean }): React.ReactNode` | Pure core used by F3 `useTriggerElement` (§2.3) and by Tooltip. Function child → `children(triggerProps)`. `asChild !== false` and a single valid non-Fragment element → `cloneElement(child, mergeProps(triggerProps, child.props, { oursWin: STATE_ARIA }))` (React 19: `ref` is in props). `asChild === false`, or any other child shape → `createElement(fallback ?? 'span', triggerProps, children)` (dev warning only for the non-element case, emitted at call time through `warnOnce`, C-DEV). (`overlays#5`, `overlays#21`, `feedback-navigation#51`) |
| `polymorphic.ts` | `PolymorphicProps<C extends React.ElementType, OwnProps> = OwnProps & { as?: C } & Omit<React.ComponentPropsWithRef<C>, keyof OwnProps \| 'as'>`; `interface PolymorphicComponent<DefaultC extends React.ElementType, OwnProps> { <C extends React.ElementType = DefaultC>(props: PolymorphicProps<C, OwnProps>): React.ReactNode; displayName?: string }` | **OwnProps must contain only component-specific props.** Each polymorphic component declares `XOwnProps` (appearance, size, icon, disabled, …; no `extends ButtonHTMLAttributes`) and `type XProps<C extends React.ElementType = 'button'> = PolymorphicProps<C, XOwnProps>`; if OwnProps inherited the HTML attributes of the default tag, `as="a"` would keep button typing (`formAction` accepted, anchor `onClick` rejected — verified with tsc). Applies to Button, CompoundButton, Link, Text, Toolbar, Card and its parts, Stack, Flex, Grid, Tag, Divider. Type tests: `<Button as="a" href target>` compiles; `<Button as="a" formAction>` fails; `onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {}}` and `type="text/html"` compile with `as="a"`; anchor props on the default button fail; `interface MyProps extends ButtonProps {}` still compiles. (`button-provider#8`) |
| `globalRegistry.ts` | `getGlobalRegistry<T>(key: string, create: () => T): T` | Stores module singletons on `globalThis[Symbol.for('@mortenbrudvik/waveui/' + key)]`, so an app that loads both the ESM and CJS builds (Next.js server CJS + client ESM, a dependency that `require`s the package) shares one layer stack, trap stack, scroll-lock counter, announcer and warn-once registry. Used by `layers.ts`, `useFocusTrap`, `useScrollLock`, `useAnnounce`, `dev.ts`. |
| `icons.tsx` | `IconProps extends React.SVGProps<SVGSVGElement> { size?: number \| string; title?: string }`; `DismissIcon, ChevronDownIcon, ChevronUpIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon, CalendarIcon, ClockIcon, CheckIcon, SubtractIcon, SearchIcon, InfoIcon, SuccessIcon, WarningIcon, ErrorIcon, StarIcon` | `fill`/`stroke` `currentColor`, `aria-hidden="true" focusable="false"` unless `title` given (then `role="img"` + `<title>`), `data-wave-icon="<name>"`, default size 16 (chevrons 12). Internal (not exported from the package). (`input-datetime#22`, `button-provider#20`) |
| `dev.ts` | `isDev`, `devWarn(msg)`, `warnOnce(key, msg)`, `warnDeprecated(component, oldName, newName, extra?)`, `resolveDeprecatedProp<T>(component, newValue, oldValue, oldName, newName): T \| undefined`, `__resetWarnings()` (test-only) | `[WaveUI] ` prefix; no-op in production; the warn-once set lives in `getGlobalRegistry('warnings')`. `warnOnce` is idempotent per key, so it and the helpers built on it (`warnDeprecated`, `resolveDeprecatedProp`) are safe to call during render (C-DEV). `resolveDeprecatedProp` returns `newValue` when defined, else `oldValue`, and warns via `warnDeprecated` whenever `oldValue` is given (also when both are given). |
| `focus.ts` | `FOCUSABLE_SELECTOR`, `isFocusable(el)`, `isTabbable(el)`, `getTabbableElements(container, { includeContainer? })`, `getFirstTabbable`, `getLastTabbable`, `focusElement(el, opts?): boolean`, `isConnectedAndFocusable(el)`, `containsFocus(container)` | jsdom-safe (no layout APIs): excludes `[disabled]`, `input[type=hidden]`, `tabIndex < 0`, elements inside `[inert]`, `[hidden]`, `display:none`/`visibility:hidden` ancestors (computed style), closed `<details>` content except `<summary>`. **Named radio groups** (same `name` and form owner) follow browser Tab order: while focus is on a member, that member is the group's only stop; otherwise the checked radio is the stop (the whole group is skipped when the checked radio cannot take focus); with no checked radio, every tabbable member is included (Tab enters at the first, Shift+Tab at the last, so `getFirstTabbable`/`getLastTabbable` return the browser's entry radio). The result therefore depends on the focused element (`document.activeElement`, or the shadow root's). Callers compute tabbables when they need them, e.g. at `keydown` time, and never cache the list (F4 `useFocusTrap`, §2.4). (`overlays#3`) |
| `direction.ts` | `type Direction = 'ltr' \| 'rtl'`; `getDirection(el?: Element \| null): Direction` (nearest `[dir]` attribute → computed `direction` → `document.dir` → `'ltr'`); `getArrowIntent(key, { orientation: 'horizontal' \| 'vertical' \| 'both'; dir }): 'next' \| 'prev' \| null` | (`table-core#7`, `input-basic#22`) |
| `styles.ts` | `focusRing`, `focusRingInset`, `focusWithinRing`, `inputBase`, `inputFocus`, `inputFocusWithin`, `disabledStyles`, `forcedColors = { selectedLeaf, selectedContainer, control, border, fill, disabled, selected }` (`selected` = deprecated alias of `selectedLeaf`), `motionSafeTransition` | Class-string constants (so Tailwind sees them via `@source ../lib`). `inputFocus = 'focus:outline-hidden focus:border-b-2 focus:border-b-primary'`. It is `focus:`-scoped because Tailwind 4.2's bare `outline-hidden` also emits an always-on forced-colors outline (C-FOCUS). `inputFocusWithin = 'focus-within:border-b-2 focus-within:border-b-primary'`, with `focus:outline-hidden` on the inner control; `forcedColors.selectedLeaf = 'forced-colors:bg-[Highlight] forced-colors:text-[HighlightText] forced-colors:forced-color-adjust-none'` — **leaf indicators only** (Switch thumb, check glyph, progress fill, selected day cell), because `forced-color-adjust` is inherited and would opt every descendant of a row/option/card out of forced colors; `forcedColors.selectedContainer = 'forced-colors:outline-2 forced-colors:outline-[Highlight] forced-colors:-outline-offset-2'` for options, rows and cards (the browser keeps system colors for their content; the outline is the non-color indicator); `control = 'forced-colors:border-[ButtonText]'`, `border = 'forced-colors:border-[CanvasText]'`, `fill = 'forced-colors:bg-[Highlight]'`, `disabled = 'forced-colors:text-[GrayText] forced-colors:border-[GrayText]'`. |
| `aria.ts` | `joinIds(...ids): string \| undefined` (split on whitespace, dedupe, keep order), `focusableDisabledProps(disabled?)`, `preventIfDisabled(disabled, handler?)` | |
| `labelInName.ts` (wave D change request, revision 2.5) | `hasTextLabel(node: React.ReactNode): boolean`, `hasRenderedTextLabel(element: Element): boolean`, `observeTextLabel(element: Element, onChange: () => void): () => void` | The C-SLOTS naming predicate (§1). A text label is text with at least two letters or digits (`\p{L}`/`\p{N}`) in total, outside `aria-hidden="true"`/`hidden` subtrees and SVG `<title>`/`<desc>`, `<script>`, `<style>`, `<template>`. `hasTextLabel` reads literal strings, numbers, elements (skipping `aria-hidden`/`hidden` props and those element types) and arrays/re-iterable collections, never a one-shot iterator (a generator: reading would consume it). `hasRenderedTextLabel` walks the DOM with a `TreeWalker` and stops at two characters. `observeTextLabel` observes `childList`, `subtree`, `characterData` and the `aria-hidden`/`hidden` attributes and returns the disconnect. Consumers (MessageBar, SearchBox, Tag) keep the React glue: `useSyncExternalStore(subscribe, () => target ? hasRenderedTextLabel(target) : literal, () => literal)` with the target held in state through a callback ref (C-HOOKS). Tests: `'X'`, `'×'`, `'+'` and an `aria-hidden` or `hidden` span are not labels; `'OK'`, `['O', 'K']`, `10` and `<b>Close</b>` are; an SVG `<title>` is not; a generator is not read; the DOM check agrees with the literal check on the same markup; the observer fires on text, child and `hidden` changes and stops after disconnect. |

Tests for each file live in `src/lib/__tests__/` as `<file>.test.ts(x)`, including `styles.test.ts` (`input-basic#9`, `feedback-navigation#24`) and `types.test.ts` (`layout#16`, `data-display#30`). All are F2-owned (§8).

### 2.3 F3-hooks-provider

#### `useControllable` (`table-core#3`, `table-core#4`, `table-core#23`, `layout#20`)
```ts
export type SetValue<T> = (valueOrUpdater: T | ((prev: T) => T)) => void;
export function useControllable<T>(controlledValue: T | undefined, defaultValue: T, onChange?: (value: T) => void): [T, SetValue<T>];
```
**Mode (sticky controlled).** `const [wasControlled, setWasControlled] = useState(controlledValue !== undefined); if (controlledValue !== undefined && !wasControlled) setWasControlled(true);` (conditional set-state-in-render — allowed by the lint rule); `isControlled = wasControlled || controlledValue !== undefined`.
- A value that arrives later takes over immediately (a component mounted with `value={undefined}` while data loads).
- A once-controlled value that becomes `undefined` stays controlled and returns the hook's **`defaultValue` argument** — the component's empty value (`[]`, `null`, `''`), never the stale last value and never `undefined` (no crash in array/Set consumers; `value={undefined}` clears a DatePicker/Combobox/Dropdown/TimePicker value or the deprecated DataGrid `sortColumn` exactly as a consumer expects). Components pass `defaultValueProp ?? emptyValue`.
- One dev warning per direction, emitted from an effect through F2 `warnOnce(key, message)` (C-DEV; key `useControllable:<from>-><to>`). `warnOnce` logs a single `[WaveUI] `-prefixed string and passes no extra console arguments, so the direction is part of the message text, in the correct order — `A component is changing from controlled to uncontrolled.` / `A component is changing from uncontrolled to controlled.` — and not separate console arguments `('controlled', 'uncontrolled')` (revision 1 wording, superseded).

**Two refs, two jobs** (the revision-1 single optimistic ref kept a rejected value forever when a controlled parent ignored `onChange` without re-rendering):
- `renderedRef` (and `isControlledRef`) — the value and mode of the last commit (controlled prop in controlled mode, internal state otherwise), written in an insertion effect (`useInsertionEffect`, the pattern `useEventCallback` uses; it runs in the mutation phase before every layout effect of the commit, so a child's layout effect that calls `setValue` in the commit that changed the controlled value sees the committed value and mode — React runs a child's layout effects before its parent's, so a layout-effect sync in the owner would still hold the previous commit's value). Never written by `setValue`. Not run on the server, where `setValue` is never called.
- `pendingRef: { value: T } | null` — **controlled mode only**: the value emitted earlier in the *same* event, so `setValue(v => !v)` twice in one handler chains. It is set inside `setValue` and cleared by a `queueMicrotask` scheduled when it is first set; it is never persisted across events.
- Uncontrolled mode keeps a `latestRef` updated inside `setValue` (optimistic is safe there: nobody can reject an uncontrolled update) and re-synced from state in the insertion effect.

**`setValue(valueOrUpdater)`** (stable identity: `[]` deps, `onChange` read via `useEventCallback`):
```ts
const base = isControlledRef.current
  ? (pendingRef.current ? pendingRef.current.value : renderedRef.current)
  : latestRef.current;
const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(base) : valueOrUpdater;
if (Object.is(next, base)) return;                  // no-op suppression against what the user sees
if (isControlledRef.current) {
  if (!pendingRef.current) queueMicrotask(() => { pendingRef.current = null; });
  pendingRef.current = { value: next };
} else { latestRef.current = next; setInternalValue(next); }
onChange?.(next);                                   // exactly once, from the event path
```
Consequences: a controlled `<ToggleButton pressed={false}>` whose parent ignores the callback emits `true` on every click (never a stale `false`); a rejected Combobox value can be picked again and fires again; `overlays#32`'s "Escape, outside press and Close each call `onOpenChange(false)` once while the parent keeps `open`" holds.

**Separate interactions (test rule for every consumer).** Consumer tests of repeated interactions on a controlled component whose parent ignores the callback must separate the interactions with `userEvent`, or with `await act(async () => {})` between `fireEvent` calls. Back-to-back synchronous `fireEvent` calls run in one task, and the per-event pending value (cleared in a microtask) makes them chain like uncontrolled mode: two `fireEvent.click` calls on `<ToggleButton pressed={false}>` emit `(true)`, `(false)`, not `(true)`, `(true)`. Escape, outside press and Close likewise each call `onOpenChange(false)` only when they are separate tasks (back-to-back in one task, the second and third are no-ops against the pending `false`). This is intended: everything dispatched synchronously within one task — a nested `el.click()`/`el.focus()` from a handler, two clicks from one timer callback — is one interaction and chains in every mode.

Tests (red first): StrictMode `toHaveBeenCalledTimes(1)`; two batched functional updates in one handler; controlled parent that ignores `onChange` — `setValue(false)` in three separate events (each flushed with `act` + a microtask) → `onChange` ×3 (the same value twice in *one* event is correctly suppressed), functional toggle twice in separate events → `(true)`, `(true)`, retrying a rejected value fires again, two `userEvent` clicks (and two `fireEvent` clicks with a microtask between them) → `(true)`, `(true)` while the rendered value stays `false`; controlled parent that accepts → next event sees the new value; events dispatched within one task (a nested focus or click from a handler, two clicks from one timer callback) chain as `(true)`, `(false)` in every mode; a child's layout effect in the commit that changed the controlled value sees that value and mode (functional updater receives it, setting it is a no-op, a value that arrived in that commit is already controlled); sticky mode — value → `undefined` returns the default argument, late value adopted; identity stability; no-op suppression; mode-switch warnings (the message carries the `[WaveUI] ` prefix, contains the correct direction substring, does not contain the reverse one, and is logged once per direction). Event-named callbacks are **not** routed through this hook (C-NAMING callback semantics).

#### `useRovingTabIndex` (`table-core#5`, `#7`, `#29`, `#30`, `layout#13`, `input-basic#14`, `feedback-navigation#47`)
```ts
export interface UseRovingTabIndexOptions {
  activeValue?: string | null;          // selected value; may be absent/'' — no longer required to be an item
  items?: string[];                      // optional explicit order (legacy). Omitted ⇒ DOM order of itemSelector
  orientation?: 'horizontal' | 'vertical' | 'both'; // default 'horizontal'
  loop?: boolean;                        // default true
  dir?: Direction;                       // default getDirection(container) at keydown
  itemSelector?: string;                 // default '[data-roving-value]'
  typeahead?: boolean;                   // default false (uses data-roving-text ?? textContent)
  homeEndKeys?: boolean;                 // default true
  /** Which item holds the tab stop. 'active' (default): the enabled activeValue item, else the first
   *  enabled item — APG Tabs/Radio/Listbox/Tree. 'last-focused': the last focused enabled item, else
   *  'active' — APG Toolbar (and the static Menu). */
  tabStop?: 'active' | 'last-focused';
  /** true ⇒ the hook writes tabIndex 0/-1 onto item elements itself and assigns
   *  data-roving-value="auto-<n>" to items that lack one. For containers that do not render their
   *  items (Toolbar children, Menu items, Tree rows). Default false (items call getTabIndex). */
  manageTabIndex?: boolean;
  onFocusMove?: (value: string, event: React.KeyboardEvent) => void;
}
export interface UseRovingTabIndexResult {
  containerProps: { ref: React.RefCallback<HTMLElement>; 'data-roving-container': ''; onKeyDown: React.KeyboardEventHandler; onKeyDownCapture: React.KeyboardEventHandler; onFocus: React.FocusEventHandler };
  handleKeyDown: (e: React.KeyboardEvent) => void;   // same handlers as containerProps (compat)
  handleKeyDownCapture: (e: React.KeyboardEvent) => void; // typeahead: default-prevents a Space that continues a search before item handlers run (they skip default-prevented events)
  handleFocus: (e: React.FocusEvent) => void;
  getTabIndex: (value: string) => 0 | -1;
  focusedValue: string | null;
  focusValue: (value: string) => void;
  focusFirst: () => void;
  focusLast: () => void;
}
```
- **Item resolution (DOM mode)** happens from the DOM at event time and in the store snapshot: `container.querySelectorAll(itemSelector)` filtered to elements whose nearest `[data-roving-container]` ancestor is this container (items of nested composites are not ours). A nested composite (an element carrying its own `data-roving-container`, or role `radiogroup`/`listbox`/`grid`/`tablist`/`menu`/`tree`/`spinbutton`) counts as **one item** whose focus target is its descendant with `tabindex="0"`; the outer hook never writes `tabindex` inside it (documented limitation: a nested composite keeps its own Tab stop). Elements carrying an author `tabindex="-1"` the hook did not write (tracked in a WeakSet of stamped elements) are excluded — e.g. SpinButton steppers and SplitButton internals keep their tabIndex.
- **Disabled items** (`disabled` property, `aria-disabled="true"`, `data-roving-disabled`) are skipped by navigation and never receive the tab stop.
- **Store instead of setState-in-effect**: the enabled item list is published through `useSyncExternalStore` whose subscription is a MutationObserver on the container (`childList`, `subtree`, attributes `disabled`, `aria-disabled`, `data-roving-disabled`, `data-roving-value`, `tabindex`); `getSnapshot` returns a cached key of enabled values; server snapshot `''`. Items that toggle `disabled` on their own (a RadioItem, a Tab registering through context) update the tab stop without the owner re-rendering. `manageTabIndex` stamping runs in a layout effect and again from the same MutationObserver callback, so children added without an owner re-render and children whose own `tabIndex` prop React rewrites are re-stamped.
- **Tab stop** per `tabStop`: `'active'` → enabled `activeValue` item → first enabled item; `'last-focused'` → last focused enabled item → the `'active'` rule. The last-focused value is recorded in `handleFocus` (event handler, not an effect). A nested composite, or a control that uses the arrow keys itself (text field, select, slider, spin button, editable combobox), holds the stop only when no other item can, so focusing it keeps the stop on the last focused other item. With `manageTabIndex`, a control hidden by CSS inside the container is no item, and an `<input type="hidden">` never is (revision 3).
- **Keys**: ignored when `e.defaultPrevented`, when a modifier (Alt/Ctrl/Meta) is held (except a single character typed with Ctrl+Alt, which is AltGr on Windows: it reaches typeahead only; revision 3), or when the event starts in a text-entry element (`input` of a text-like type, `textarea`, `select`, `[contenteditable]`) or an element with role `slider`/`spinbutton` or an editable `combobox` — so Left/Right in a Toolbar SearchBox move the caret (APG Toolbar). Left/Right move on from a select-only combobox (a Dropdown), which keeps Up/Down, Home and End (revision 3). When the focused value is unknown, arrows start from `e.target.closest(itemSelector)`; if none, next→first, prev→last. RTL: horizontal Left/Right swapped using `getArrowIntent(key, { orientation, dir: getDirection(e.currentTarget) })`; `'both'` handles all four arrows. `preventDefault()` only for handled keys. Typeahead runs only for keys that start on the item itself (or on the container when no item has focus), never for keys from content nested inside an item, such as a row's action button.
- Tests: defaults, `'both'`, `loop=false`, Home/End, RTL, disabled skipping, Fragment/wrapper items, item toggling `disabled` without an owner re-render, nested composite as one item, author `tabindex=-1` untouched, text-entry target ignored, `tabStop` both modes. Stale orphaned JSDoc removed; JSDoc lists real consumers.

#### Other hooks
| File | Signature | Notes |
|---|---|---|
| `useEventCallback.ts` | `useEventCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;` overload `(fn: ((...args: Args) => R) \| undefined): (...args: Args) => R \| undefined` | no `any` (`table-core#31`) |
| `useId.ts` | unchanged API; JSDoc without literal React id format (`table-core#34`) | |
| `useMergedRefs.ts` (new) | `useMergedRefs<T>(...refs): React.RefCallback<T>` | memoised `mergeRefs`; identity stable while the refs are (`overlays#35`) |
| `useAnnounce.ts` (new) | `type Politeness = 'polite' \| 'assertive'`; `announce(message, politeness = 'polite'): void`; `useAnnounce(): (message, politeness?) => void`; `__getAnnouncerText(politeness)` (test helper) | Singleton visually-hidden container (`data-wave-announcer`, inline sr-only styles, exempt from modal isolation) with a polite `role="status"` and an assertive `aria-live="assertive"` region, kept in `getGlobalRegistry('announcer')`. Created on **first use** — the first `useAnnounce` mount or the first `announce()` call, whichever comes first; a message that arrives while the regions are being created is written on the next animation frame so it is not lost (live regions must exist before their content changes). Ref-counted removal on unmount. Repeated identical messages are cleared then re-set on the next frame. SSR no-op. (`input-pickers#14`, `overlays#28`) |
| `usePrefersReducedMotion.ts` (new) | `usePrefersReducedMotion(): boolean` | `matchMedia` via `useSyncExternalStore` with a change listener; `false` when unavailable/SSR (`layout#21`) |
| `useDirection.ts` (new) | `useDirection(): Direction` | WaveProvider `dir`; outside a provider falls back to `getDirection(document.documentElement)` (so `<html dir="rtl">` without a provider places start/end popups correctly); `'ltr'` on the server |
| `useIsClient.ts` (new) | `useIsClient(): boolean` | `useSyncExternalStore(noopSubscribe, () => true, () => false)`: `false` on the server and during hydration, `true` in the first client render otherwise. Replaces every "mounted" state flag (C-HOOKS); used by Portal. |
| `useTriggerElement.tsx` (new) | `useTriggerElement<P>(children: TriggerChildren<P>, triggerProps: P, options: { componentName: string; asChild?: boolean; onResolvedId?: (id: string) => void }): React.ReactNode` | The hook every trigger uses (Dialog/Drawer/Popover/Menu `.Trigger`, `.Close`). Clones a single child via F2 `renderTrigger`, with the merged ref memoised by `useMergedRefs` keyed on the child's own ref (no detach/attach every render, so floating-ui's `setReference` and restore targets are stable). Trigger state ARIA (`aria-expanded`, `aria-controls`, `aria-haspopup`) always wins over the child's props; the child's own `id` wins over the generated one and is reported through `onResolvedId` (the root stores it for `aria-labelledby`). `asChild={false}` renders the 0.4 wrapper `<span>`. **Automatic fallback**: if the cloned child's ref has not received an element by the end of the mount layout effect (a custom component that neither forwards `ref` nor spreads props), the hook switches once to the wrapper span and warns in development — the sanctioned `set-state-in-effect` site of C-HOOKS. (`overlays#5`, `repo-level#30`, `overlays#33`, `feedback-navigation#51`) |
| `usePreserveFocus.ts` (new) | `usePreserveFocus(ref, getFallback: () => HTMLElement \| null \| undefined, options?: { enabled?: boolean }): void` | If `ref.current` contains focus when it unmounts or when `enabled` flips false, focus `getFallback()`. `enabled` → `false`: focus moves in the layout phase. Unmount: the layout-effect cleanup detects that the element contains focus; the move runs in a microtask after the commit, is cancelled if the same instance remounts (StrictMode), and is skipped when focus was already placed outside in the same commit. `getFallback` runs after removal, possibly after the whole tree is gone, so it must not throw (`querySelector` in components, `queryBy*` in tests, never a throwing `getBy*`); a fallback that is not connected is ignored. Tests assert an unmount move only after `await act(async () => {})` or a `userEvent` action. (`feedback-navigation#12`) |
| `useTypeahead.ts` (new) | `useTypeahead({ getItems: () => Array<{ value: string; text: string; disabled?: boolean }>; onMatch: (value: string) => void; timeout?: number }): { onTypeahead(e: KeyboardEvent \| React.KeyboardEvent, currentValue: string \| null): boolean; isSearching(): boolean }` | 500 ms buffer, printable single chars, wraps from the current item, skips disabled. While a search is in progress (`isSearching`), every printable key, Space included, is consumed even without a match, so Space continues the search instead of activating (callers: `useRovingTabIndex` takes it in the capture phase, `useListbox` before its own Space handling) |

#### `WaveProvider` (`button-provider#2`, `#4`, `#6`, `#27`, `#28`, `repo-level#7`, `repo-level#23`)
```ts
export type WaveTheme = 'light' | 'dark' | 'high-contrast';
export type WaveDir = 'ltr' | 'rtl';
export interface WaveProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  theme?: WaveTheme; dir?: WaveDir;
  /** Element portaled overlays render into. @default the enclosing provider's, else document.body */
  portalContainer?: HTMLElement | null;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}
export interface WaveContextValue { theme: WaveTheme; dir: WaveDir; themeClassName: string; portalContainer: HTMLElement | null; hasProvider: boolean; }
export function getThemeClassName(theme: WaveTheme): string; // 'wave-light' | 'wave-dark dark' | 'wave-high-contrast high-contrast'
export function useWaveTheme(): WaveContextValue;
```
Root: `<div ref dir data-wave-theme={theme} className={cn('wave-root', themeClassName, 'bg-background text-foreground font-wave text-body-1', className)}>`. Theme validation uses `Object.hasOwn(map, theme)` (tsconfig `lib` is ES2022 from wave A, F6a) inside an effect with `warnOnce`. The legacy `dark`/`high-contrast` classes stay emitted (deprecated, for consumers' `dark:` variants). Context value memoised. `stories/WaveProvider.stories.tsx` (now owned by F3) drops inline background hacks and shows nesting (dark inside light, light inside dark) and RTL. A nested provider inherits `theme`, `dir` and `portalContainer` from the enclosing one when it omits them; an explicit `portalContainer={null}` means `document.body` (revision 3).

### 2.4 F4-overlay — layers, dismissal, focus, scroll lock, positioning, portal

#### `src/lib/layers.ts` — layer stack
```ts
export const Z_INDEX = { overlay: 'var(--wave-z-overlay, 1000)', toast: 'var(--wave-z-toast, 1100)', tooltip: 'var(--wave-z-tooltip, 1200)' } as const;
export type LayerKind = 'modal' | 'popover' | 'menu' | 'listbox' | 'tooltip' | 'toast';
export interface LayerRecord { id: string; parentId: string | null; kind: LayerKind; order: number; getElements(): Array<HTMLElement | null>; getAnchor(): HTMLElement | null; escape: boolean; outsidePress: boolean | ((e: PointerEvent | MouseEvent) => boolean); focusOutside: boolean; onDismiss(reason: DismissReason, event: Event): void; }
export const ALLOW_OUTSIDE_SELECTOR = '[data-wave-focus-trap-allow]';
export function registerLayer(record: LayerRecord): () => void;
export function registerLayerElement(layerId: string, el: HTMLElement): () => void; // portal wrappers of a layer's descendants
export function compareLayers(a: LayerRecord, b: LayerRecord): number;      // > 0 when a is above b
export function getTopmostLayer(predicate?: (l: LayerRecord) => boolean): LayerRecord | null;
export function isInsideLayerTree(layerId: string, target: Node): boolean; // own elements + registered portal elements + all descendant layers + ALLOW_OUTSIDE_SELECTOR regions
export function isInsideOtherOpenModal(el: Element, exceptLayerId?: string): boolean;
export function registerLayerIsolation(layerId: string): () => void; // ref-counted; useModalIsolation marks its layer as isolating the page (modal barrier)
export function isBehindIsolatingModal(layer: LayerRecord): boolean; // stacked below the topmost open isolating layer
export function subscribeLayers(listener: () => void): () => void; // listener runs synchronously after any register or unregister
export function getOpenLayers(): LayerRecord[]; // bottom to top (a copy); a parent precedes its descendants
export function getLayer(layerId: string): LayerRecord | null;
export function isDescendantLayer(layerId: string, ancestorId: string): boolean; // possibly indirect
// The layer's tree elements, allow-list excluded; includeOwnElements: false (default true) leaves out the layer's own getElements().
export function getLayerTreeElements(
  layerId: string,
  options?: { includeOwnElements?: boolean },
): HTMLElement[];
```
- The registry lives in `getGlobalRegistry('layers')` (one stack even when ESM and CJS copies are both loaded).
- **Topmost** is defined by parentage first (a descendant layer is above its ancestor), then by open order (`order`, a global counter at registration). Registration order alone is not nesting order: a parent and child that open in the same commit register child-first (effects run child-first).
- Targets inside `[data-wave-focus-trap-allow]` (the Toaster viewport) count as inside **every** layer, so pressing a toast's button never dismisses the Dialog/Drawer/Popover under it.
- **Modal barrier**: the topmost open layer registered with `registerLayerIsolation` (Dialog, Drawer, through `useModalIsolation` while it is enabled) is a barrier. The layers stacked below it are left out of the outside-press snapshot and out of every Escape step (`useDismiss`). Those are its ancestors and its older siblings. The layers above it are not affected: its descendants, or a modal opened later. Focus-outside dismissal is not affected. A `kind: 'modal'` layer that does not isolate the page is not a barrier. P06 note: the DatePicker calendar is `kind: 'modal'` with no isolation (§5.4, §5.8), so it shields nothing.
- Depth for z-index is not read from this registry during render (parents register in effects); it comes from `PortalDepthContext` (see Portal).
- One set of document listeners is installed while at least one layer exists.

#### `useDismiss` (`overlays#1`, `#2`, `#41`, `input-pickers#12`, `input-datetime#2`, `repo-level#29`)
```ts
export type DismissReason = 'escape' | 'outside-press' | 'focus-outside';
export interface UseDismissOptions {
  open: boolean;
  onDismiss: (reason: DismissReason, event: Event) => void;
  refs: ReadonlyArray<React.RefObject<HTMLElement | null>>; // content, trigger/anchor, extra ignore targets
  anchorRef?: React.RefObject<HTMLElement | null>;          // trigger; used by focus traps to leave a descendant layer
  kind?: LayerKind;                                         // default 'popover'
  escape?: boolean;                                         // default true
  outsidePress?: boolean | ((event: PointerEvent | MouseEvent) => boolean); // default true
  focusOutside?: boolean;                                   // default false (listboxes: true)
}
export interface DismissLayer { layerId: string; isTopmost(): boolean }
export function useDismiss(options: UseDismissOptions): DismissLayer;
export const DismissLayerContext: React.Context<string | null>;
export function DismissLayerProvider(props: { layerId: string; children: React.ReactNode }): React.ReactElement;
```
- **Escape** (document `keydown`, bubble): ignored if `defaultPrevented` or `isComposing`. Inner widgets that consume Escape without being a layer must `preventDefault()` (C-POPUPS). **Candidates** are the escape-enabled layers that are not below the modal barrier (§2.4 `layers.ts`). `preventDefault()` is called only when a handler is found. The handler is chosen in four steps:
  1. The **focus scope** is the topmost layer whose tree contains `event.target` or `document.activeElement`.
  2. The topmost candidate in that scope's subtree handles Escape. That is the scope itself or an open descendant, so a tooltip or popover opened from the focused dialog closes first. A sibling of the focused layer is not in its subtree.
  3. Otherwise the topmost candidate whose tree contains them handles it (escalation to an ancestor).
  4. Otherwise the global topmost candidate handles it.
- **Outside press** (fixes nested portals, drag-out and popups opened by the same click):
  1. `pointerdown` (document, capture): the snapshot is taken only for a **primary-button** press (a non-primary press clears any pending one). It holds the open layers with `outsidePress` whose tree does **not** contain the target and that are not below the modal barrier (§2.4 `layers.ts`). A layer registered later (opened by that press, or closed and reopened) is not in the snapshot, and a layer that unregisters is removed from it (revision 3: the `order` watermark is gone). That is all of them, not only the topmost; a predicate `outsidePress(e) === false` excludes a layer. A pending press is forgotten in the cases below, so a later programmatic `click()` never completes a stale press:
     - on the next `pointerdown` (which takes its own snapshot or clears it);
     - on `pointercancel` or `contextmenu`;
     - on an Enter or Space `keydown` (a keyboard-activated click follows; other keys, such as held modifiers, keep it);
     - on the next macrotask after a mouse `pointerup`;
     - 1 s after a touch, pen or unknown-device `pointerup` (their click comes from a later gesture task).
  2. `click` (document, bubble — after React has flushed the click's discrete updates): dismiss, parents after children, every snapshotted layer whose tree still does not contain the click target. Layers registered after the pointerdown (a Dropdown opened by this very click) are ignored.
  Consequences: a drag from content to the backdrop does not dismiss; clicks inside nested portaled overlays (descendant layers, portal wrappers registered with `registerLayerElement`) are inside; clicking a Dropdown trigger while a DatePicker calendar is open closes the calendar and leaves the new listbox open; an external toggle that updates `open` in its own onClick is processed before dismissal (Popover external toggle works); toast clicks never dismiss (allow-list).
- **Focus outside** (document `focusin`, capture): each layer with `focusOutside` dismisses when focus lands outside its tree (independent of stacking; the allow-list counts as inside).
- Parentage comes from `DismissLayerContext` (React context survives portals). Components wrap their surface in `DismissLayerProvider` (the `Portal` does it automatically when given `layerId`).
- F4 tests (red first): nested Escape by focus location; parent+child registered in one commit; calendar-like layer + click on a stand-in trigger that opens another layer; drag-out; nested portal click; allow-listed portaled button click keeps the layer open; external toggle; the modal barrier (Escape and presses never reach a layer behind an isolating modal; the modal's descendants are still reached; a non-isolating `kind: 'modal'` layer shields nothing); forgotten presses (non-primary button, pointercancel, contextmenu, Enter/Space, mouse release with no click, the 1 s touch/pen/unknown-device limit). The tests are in `src/lib/__tests__/layers.test.ts` ("Escape dispatch", "outside press") and `src/hooks/__tests__/useDismiss.test.tsx`.

#### Focus utilities
```ts
export interface UseFocusTrapOptions {
  enabled: boolean;
  layerId?: string;              // the modal's layer; descendant layers are recognised through it
  initialFocus?: React.RefObject<HTMLElement | null> | 'first' | 'container' | (() => HTMLElement | null); // default 'first' (falls back to container)
  allowOutsideSelector?: string; // default ALLOW_OUTSIDE_SELECTOR — tabbables inside join the Tab cycle
}
/** Element-based: pass the surface held in state via a callback ref, so the trap re-runs when it appears. */
export function useFocusTrap(container: HTMLElement | null, options: UseFocusTrapOptions): void;

export interface UseRestoreFocusOptions {
  enabled: boolean;                                   // true while open
  container?: HTMLElement | null;                     // the layer surface: candidates inside it are ignored
  triggerRef?: React.RefObject<HTMLElement | null>;   // preferred restore target
  finalFocusRef?: React.RefObject<HTMLElement | null>;// consumer override
  fallback?: () => HTMLElement | null;
  onlyIfFocusInside?: boolean;                        // popovers: restore only if focus was inside the surface (or lost to body)
}
export function useRestoreFocus(options: UseRestoreFocusOptions): void;

export function useModalIsolation(enabled: boolean, options: { layerId: string; container: HTMLElement | null }): void;
export interface UseModalLayerOptions extends Omit<UseDismissOptions, 'kind'> {
  container: HTMLElement | null; initialFocus?: UseFocusTrapOptions['initialFocus'];
  triggerRef?: React.RefObject<HTMLElement | null>; finalFocusRef?: React.RefObject<HTMLElement | null>;
}
export function useModalLayer(options: UseModalLayerOptions): DismissLayer; // Dialog, Drawer
```
- **`useFocusTrap`** (`overlays#3`, `feedback-navigation#50`, `overlays#41`):
  - Initial focus runs synchronously when the container element first appears while enabled (no `requestAnimationFrame` race with a second render), and **does nothing if focus is already inside the container** (an `autoFocus` input wins).
  - Tab/Shift+Tab are handled by a **document bubble-phase** `keydown` listener that skips events whose default is already prevented. React's root listener runs first, so widgets such as `Menu.Popover` (Tab closes and restores to its trigger) or a DatePicker grid can pre-empt the trap — the same `defaultPrevented` protocol as Escape.
  - Target inside the container: cycle over `getTabbableElements(container)` plus allow-listed regions, wrapping at the edges, from the container itself and from a non-tabbable active element.
  - `getTabbableElements`/`getFirstTabbable`/`getLastTabbable` are called **in the keydown handler, never cached** (not at mount, not in state or refs). Named radio groups make the result depend on the focused element (§2.2 `focus.ts`): with focus on a radio, the rest of its group is left out, so that radio is the wrap point when its group ends the container. With no checked radio, Tab wraps to the group's first radio and Shift+Tab to its last. Content can also change while the trap is active. Test: a dialog ending in an unchecked named radio group wraps from the focused radio.
  - Target inside a **descendant layer** (a portaled Popover, Menu, InfoLabel or AvatarGroup popup opened from the dialog): the browser tabs natively inside that layer; when Tab would leave it (at its last tabbable), focus moves to the tabbable that follows the layer's anchor in the dialog's order (Shift+Tab at its first tabbable: the anchor itself). Descendant layers are identified with `isInsideLayerTree(layerId, target)`; their anchors come from `LayerRecord.getAnchor()`.
  - Target inside a plain consumer `<Portal>` rendered in the surface (no layer, no anchor): Tab is native inside it, and leaving it wraps to the first (Shift+Tab: last) element of the cycle (revision 3).
  - `focusin` outside the container, the allow-list and descendant layers returns focus to the last focused element inside. That is decided in a microtask after the `focusin` (revision 3), so an `autoFocus` element of a surface opened above the trap (a stacked or nested dialog, a popover opened from the surface) keeps focus, and focus that another script pulls out again while it is being returned is left there. A trap stack (`getGlobalRegistry('traps')`) makes only the topmost trap active.
  - Tests: disabled last button, tabindex=-1 button, Shift+Tab from the container, autoFocus respected, two links inside a stand-in popover layer anchored in the dialog (Tab moves between them, then to the element after the anchor), a stand-in React handler that prevents Tab default wins.
- **`useRestoreFocus`** (`overlays#9`, `#10`, `#13`, `#27`):
  - The opener is captured when `enabled` flips `false → true` in a **`useInsertionEffect`** — it runs in the mutation phase, before React applies `autoFocus` inside the new surface (commitMount in the layout phase) — preferring `triggerRef.current`, ignoring `body` and any candidate inside `container`.
  - Restores on disable and on unmount-while-enabled. The unmount path schedules the restore in a microtask and cancels it if the same hook instance mounts again, so React 19 StrictMode's simulated unmount does not snap focus back to the trigger right after opening.
  - Target (first valid wins) = `finalFocusRef` → captured opener → `triggerRef` → `fallback()` → when the opener was removed or cannot take focus, its replacement: the nearest remaining tabbable neighbour of its old spot (in the innermost surviving ancestor that holds one: the next, else the previous; then one level up), else the trigger of the overlay it was in (a menu item's menu button), else that trigger's neighbour — only replacements inside the parent layer's tree when the surface is rendered in an open parent layer → the parent layer's container (then the replacements outside it) → the container of the modal layer that stays open. Targets that are disconnected, not focusable, inside `[inert]`/`[aria-hidden=true]`, or inside another open modal layer are skipped. A confirm Dialog rendered in a Drawer's content and one rendered next to the Drawer return focus to the same adjacent row. Uses `preventScroll`.
  - Tests: controlled Dialog without Trigger whose content has an `autoFocus` input restores to the real opener; StrictMode open keeps focus inside; removed opener → fallback; confirm Dialog nested in / next to a Drawer whose Confirm deletes the opener's row → the adjacent row in both layouts (`src/__tests__/integration.test.tsx`).
- **`useScrollLock(enabled)`** (`overlays#11`): ref-counted counter in `getGlobalRegistry('scrollLock')`; on 0→1 saves the scroller's inline styles, sets `overflow: hidden`, and keeps layout stable with `scrollbar-gutter: stable` on `documentElement` when `CSS.supports('scrollbar-gutter: stable')`, otherwise compensates the measured scrollbar width with `padding-inline-end` on `body` (correct for RTL documents whose scrollbar is on the left); restores only on 1→0. SSR-safe.
- **`useModalIsolation`** (`feedback-navigation#50`, `feedback-navigation#12`, `input-pickers#14`, `overlays#28`): replaces `aria-modal` for Dialog/Drawer. While enabled, it walks from the modal's portal wrapper up to `body` and sets `inert` on every sibling that does not contain a kept element. Kept: the modal's own tree (incl. descendant-layer portals, identified via `isInsideLayerTree`), `[data-wave-focus-trap-allow]` (Toaster viewport) and `[data-wave-announcer]`. A MutationObserver on `body` inerts siblings added later unless they belong to a kept tree (descendant layers register their wrapper in the ref callback, before the observer's microtask runs). Previous `inert` states are saved and ref-counted per element so nested modals restore in stack order. While enabled, the hook also calls `registerLayerIsolation(layerId)`, which makes the layer the modal barrier (§2.4 `layers.ts`), and it recomputes its plan through `subscribeLayers` whenever a layer opens or closes. With `aria-modal` gone and the background inert, the toast region and live regions stay in the accessibility tree and keep announcing, while everything else behind the modal is neither focusable, clickable nor browsable.
- **`useModalLayer`**: composes `useDismiss({ kind: 'modal' })`, `useFocusTrap`, `useModalIsolation`, `useScrollLock` and `useRestoreFocus` in the order that works: isolation is removed before focus is restored (an inert opener cannot take focus), the trap is disabled before isolation is removed. Dialog and Drawer use only this hook.

#### Positioning — `usePopupPosition` (`overlays#36`, `#37`, `overlays#30`)
Dependency: `@floating-ui/react-dom` (justification §3.4).
```ts
export interface UsePopupPositionOptions {
  open: boolean;
  side?: PopupSide;            // default 'bottom'; 'start'/'end' resolved with useDirection()
  align?: PopupAlign;          // default 'start'
  offset?: number;             // default 4 (tooltips 8)
  flip?: boolean;              // default true
  shift?: boolean | { padding: number }; // default { padding: 8 }
  matchReferenceWidth?: boolean;         // listboxes
  fitViewport?: boolean;                 // size middleware → max-height/max-width CSS vars
  arrowRef?: React.RefObject<HTMLElement | null>;
  strategy?: 'absolute' | 'fixed';       // default 'fixed'
}
export interface UsePopupPositionResult {
  setReference(el: HTMLElement | null): void; setFloating(el: HTMLElement | null): void;
  floatingStyles: React.CSSProperties; arrowStyles: React.CSSProperties;
  placement: string; side: 'top' | 'bottom' | 'left' | 'right'; isPositioned: boolean;
  floatingProps: { 'data-side': string; 'data-align': string; style: React.CSSProperties };
}
export function usePopupPosition(options: UsePopupPositionOptions): UsePopupPositionResult;
```
`autoUpdate` only while open; `elementResize` only when `ResizeObserver` exists and `layoutShift` only when `IntersectionObserver` exists (jsdom and old browsers do not crash).

#### `Portal` — `src/components/portal/Portal.tsx` (public export)
```ts
export interface PortalProps {
  children: React.ReactNode;
  container?: HTMLElement | null;     // default: WaveProvider.portalContainer ?? document.body
  layer?: 'overlay' | 'toast' | 'tooltip'; // default 'overlay'
  layerId?: string;                   // wraps children in DismissLayerProvider
  disabled?: boolean;                 // render inline (no portal)
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}
export const Portal: (props: PortalProps) => React.ReactNode; // displayName 'Portal'
```
- **Mounting**: `const isClient = useIsClient()` (F3, `useSyncExternalStore`). On the server and during hydration it renders nothing (SSR-safe, no mismatch); in any other client render the portal is rendered **in the first commit** — no "mounted" state flag, no second commit, no set-state-in-effect. Content that must exist on the server or before open (Tooltip/InfoLabel descriptions, closed listboxes) is rendered inline, not in a Portal (§5.3, §5.5).
- **Wrapper**: renders `createPortal(<div ref={registerRef} className="wave-portal {themeClassName} {className}" dir={dir} data-wave-portal data-layer={layer} style={{ position: 'relative', zIndex: 'calc(' + Z_INDEX[layer] + ' + ' + depth + ')' }}>…</div>, container)`. The wrapper is a React-rendered element inside the portal, so it is attached to the container during the mutation phase — before any child layout effect or ref callback runs (focus traps and positioning see connected elements). The wrapper paints no background (§2.1.6).
- **Depth**: from `PortalDepthContext` (default 0; the Portal provides `depth + 1` to its children), never from the layer registry during render — so a child opened in the same commit as its parent (nested `defaultOpen`, a DatePicker with `defaultOpen` inside an open Dialog) still stacks above it.
- **Layer registration**: the wrapper's ref callback registers it with the **parent** layer — the `DismissLayerContext` value seen *outside* the Portal — via `registerLayerElement(parentLayerId, el)` (React 19 ref cleanup unregisters). The Portal's own `layerId` is only provided to its children through `DismissLayerProvider`. This keeps a Dialog backdrop (rendered in the Dialog's own portal, not inside its content surface) outside the Dialog's layer while making a Popover opened from inside the Dialog count as inside the Dialog.
- Portaled content inherits the provider theme, direction and font (fixes dark Dialogs). Tests: nested `defaultOpen` stacking (child z-index > parent), theme class/dir, parent-layer registration, trap initial focus works without rAF, SSR `renderToString` renders nothing and hydrates without warnings.

### 2.5 F5-listbox-field — listbox, Field context, forms

#### `FieldContext` / `useFieldControl` — `src/hooks/useFieldControl.ts` (`input-basic#1`, `#15`, `#16`, `#24`)
```ts
export interface FieldContextValue {
  controlId: string;           // label htmlFor target
  labelId: string | undefined; // <label id>, used for aria-labelledby on non-labelable controls
  hintId: string | undefined; errorId: string | undefined;
  invalid: boolean; required: boolean;
  hasErrorMessage: boolean;    // Field renders the error; controls must not duplicate it
}
export const FieldContext: React.Context<FieldContextValue | null>;
export function useFieldContext(): FieldContextValue | null;
export interface FieldControlProps { id?: string; 'aria-label'?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid']; 'aria-required'?: React.AriaAttributes['aria-required']; required?: boolean; }
export interface UseFieldControlOptions { labelable?: boolean /* default true */; nativeRequired?: boolean /* default false */ }
export function useFieldControl(props: FieldControlProps, options?: UseFieldControlOptions): FieldControlProps; // only defined keys
```
Merge rules: `id = props.id ?? field.controlId`; `aria-labelledby`: if `props['aria-label']` is set → `props['aria-labelledby']`; else if the control is not labelable **or the resolved `id` differs from `field.controlId`** (the control is not Field's first child — e.g. wrapped in a Tooltip or Fragment — or carries its own id, so `<label htmlFor>` does not reach it) → `joinIds(props['aria-labelledby'], field.labelId)`; else `props['aria-labelledby']`. `aria-describedby = joinIds(props['aria-describedby'], field.errorId, field.hintId)`; `aria-invalid = props['aria-invalid'] ?? (field.invalid || undefined)`; `aria-required = props['aria-required'] ?? (field.required || undefined)`; `required = nativeRequired ? props.required ?? (field.required || undefined) : undefined`. Consumer values are merged, never overwritten.

`nativeRequired: true` is passed by every control whose focusable element is a native form control: **Input, Select, Textarea, Slider** (P02) and SpinButton's input (P04), so `<Field required><Input/></Field>` sets the native `required` attribute and constraint validation runs. Controls built on buttons/divs use `HiddenInput` for native validation instead.

**Test helper** (F5, new file `src/test-utils-field.tsx`, excluded from the library build like `test-utils.ts`): `renderWithFieldContext(ui, value?: Partial<FieldContextValue>)` renders `ui` inside a `FieldContext.Provider` plus a real `<label id={labelId} htmlFor={controlId}>`, hint and error elements with the given ids, so P03–P06 test Field consumption without depending on P02's in-flight `Field` (§5.9).

#### `HiddenInput` — `src/components/internal/HiddenInput.tsx` + `useFormReset` (`input-basic#12`)
```ts
export interface HiddenInputProps {
  name?: string; form?: string; disabled?: boolean;
  value: string | readonly string[] | null | undefined; // arrays → one input per value
  /** 'hidden' when not required; when required: 'radio' for single-choice groups (RadioGroup, Rating,
   *  SwatchPicker — correct "select one of these options" message), 'checkbox' for booleans
   *  (Checkbox, Switch), 'text' for free values (pickers, SpinButton). */
  type?: 'hidden' | 'text' | 'checkbox' | 'radio';
  checked?: boolean; required?: boolean;
  onInvalid?: (e: React.FormEvent<HTMLInputElement>) => void; // focus the visible control
}
export function HiddenInput(props: HiddenInputProps): React.ReactElement | null; // null unless `name` or `required` is given
/** Finds the form from the control element: its `form` attribute (by id), else closest('form'). */
export function useFormReset(controlRef: React.RefObject<HTMLElement | null>, onReset: () => void, form?: string): void;
```
- Rendered only when the consumer passes `name` or `required`; components never invent a default name (a RadioGroup inside an existing form adds no field).
- Required inputs are real (non-`hidden`) inputs with `aria-hidden`, `tabIndex={-1}`, `pointer-events: none`, opacity 0, a no-op `onChange`, and are **absolutely positioned inside the control's `relative` root** (`inset-inline-start: 0; bottom: 0; width: 1px; height: 1px`), so the browser's validation bubble and scroll-into-view point at the control. `onInvalid` focuses the visible control.
- Form reset is wired from the control element with `useFormReset(controlRef, …)`, not from `HiddenInput`, so uncontrolled controls without a name still reset.

#### `useListbox` — `src/hooks/useListbox.ts` (derived from TagPicker/TimePicker behaviour) (`input-pickers#1`, `#2`, `#3`, `#11`, `#18`, `#20`, `#26`, `#27`, `#28`)
```ts
export interface ListboxItem { value: string; label: string; textValue?: string; disabled?: boolean }
export interface UseListboxOptions {
  open: boolean;
  onOpenChange: (open: boolean, reason: 'keyboard' | 'select' | 'escape' | 'tab') => void;
  mode: 'editable' | 'select-only';
  multiple?: boolean;
  selectedValues: readonly string[];
  onSelect: (value: string, item: ListboxItem) => void;
  items?: readonly ListboxItem[];            // data mode; omitted ⇒ registration mode (children)
  filter?: (item: ListboxItem) => boolean;   // hides items from navigation and rendering
  loop?: boolean;                            // default false
  typeahead?: boolean;                       // default mode === 'select-only'
  autoHighlight?: 'selected' | 'first' | false; // on open; default 'selected' (falls back to first)
  highlightOnFilter?: boolean;               // editable: first match becomes active whenever the filtered set changes (no 0.5 consumer; TimePicker ranks with setActiveValue, §5.5)
  idPrefix?: string;
  onClearDraft?: () => void;                 // editable: Escape with the list closed and text in the input calls it (and prevents the default)
}
export interface UseListboxResult {
  listboxId: string;
  activeValue: string | null;
  activeDescendantId: string | undefined;    // only while open and active exists
  items: ListboxItem[];                      // navigable items, DOM/data order, filtered
  getItem(value: string): ListboxItem | undefined; // unfiltered lookup (registered options or `items`): the display label
  getOptionId(value: string): string;        // `${listboxId}-opt-${n}`, n assigned at first registration (stable across filtering)
  setActiveValue(value: string | null): void;
  onKeyDown(e: React.KeyboardEvent): void;   // attach to the combobox element
  onKeyUp(e: React.KeyboardEvent): void;     // attach next to onKeyDown: prevents the Space keyup click of a <button> combobox
  getComboboxProps(): { role: 'combobox'; 'aria-expanded': boolean; 'aria-controls': string; 'aria-activedescendant'?: string; 'aria-haspopup': 'listbox'; 'aria-autocomplete'?: 'list' };
  getListboxProps(): { id: string; role: 'listbox'; 'aria-multiselectable'?: true; tabIndex: -1; onMouseDown(e: React.MouseEvent): void /* keeps focus on the combobox */ };
  context: ListboxContextValue;              // provide via <ListboxContext.Provider>
}
export const ListboxContext: React.Context<ListboxContextValue | null>;
export function markListboxElement<C extends object>(component: C, kind: 'option' | 'group'): C; // marks Option/OptionGroup (memo too) for collectOptionLabels
export function collectOptionLabels(children: React.ReactNode): Map<string, string>;
export function useListboxOption(props: { value: string; label?: string; textValue?: string; disabled?: boolean }, ref?: React.Ref<HTMLElement>): {
  id: string; selected: boolean; active: boolean; disabled: boolean; hidden: boolean;
  optionProps: { id: string; role: 'option'; 'aria-selected': boolean; 'aria-disabled'?: true; hidden?: boolean; 'data-active'?: ''; 'data-selected'?: ''; 'data-disabled'?: ''; onClick(e): void; onPointerMove(e): void; ref: React.RefCallback<HTMLElement> };
};
```
- **Registration mode**: each `Option` registers `{ value, label, disabled }` + element in its layout effect into a mutable map **without notifying**; the listbox root's layout effect (which runs after its children's) sorts once by `compareDocumentPosition` and publishes once. Registrations/unregistrations after mount coalesce into one publish per microtask. Duplicate values warn. Options register even when filtered (they render `hidden`), so the selected label is always known. **Keyed reorders** (a sort toggle, re-ranked results) move option elements without registering them again. The root re-checks the DOM order after each of its commits that moved option elements (n − 1 neighbour comparisons, one publish on an inversion). A `MutationObserver` (`childList`, `subtree`) on the closest common ancestor of the options catches moves that render neither the root nor the options, such as memoized options or hoisted elements reordered by a wrapper component. Memoized options therefore have no ordering limit.
- **Where the options live**: while **closed**, consumers render the option list **inline** (next to the combobox, inside the component root) with the `hidden` attribute, so registration happens in the first client commit and no portal root exists per closed picker; while **open**, the same list renders inside the `Portal` surface (it remounts and re-registers; option ids stay stable because the id counter map lives in the listbox root). **All options of a listbox live in a single container at a time**: inline only while closed, portaled only while open, never both, not even to keep the portal mounted for an exit animation. Options split over two containers have `<body>` as their common ancestor, so every DOM mutation on the page would run the O(n) order check, and they register twice (duplicate-value warnings). Development warns once (`warnOnce` key `useListbox:single-container`).
- **SSR / first render**: layout effects do not run on the server, so display text also comes from `collectOptionLabels(children): Map<string, string>` (exported from `useListbox.ts`) — a read-only render-time walk of the elements of components marked with `markListboxElement`. `'option'` elements give `value → label` (label → `textValue` → string children → `value` for an option without children). `'group'` elements and Fragments are walked into. Unmarked components (custom wrappers) are opaque; their options resolve after registration. Consumers use `lb.getItem(value)?.label ?? collectOptionLabels(children).get(value)` (`?? value` for freeform input only). `renderToString(<Dropdown defaultValue="us">…)` and the Combobox equivalent contain "United States" (P05 test; this keeps Dropdown's 0.4 SSR-correct display text).
- **Store**: an internal `ListboxStore` (`useSyncExternalStore`) exposes per-option selectors (`isActive(value)`, `isSelected(value)`, `isHidden(value)`), so moving the highlight re-renders only two options.
- **Keyboard (APG)** — editable: ArrowDown/ArrowUp open (active = selected or first/last) and move; Alt+ArrowDown opens without moving; Enter commits the active option (single: closes; multiple: stays open) — **with the listbox closed, Enter is not prevented** so the surrounding form submits; Alt+ArrowUp closes; Escape closes (and `preventDefault`) — if already closed and text present, it calls `onClearDraft` (and `preventDefault`) so the consumer clears its draft; Tab closes (not prevented); Home/End are left to the text caret. Select-only: ArrowDown/ArrowUp/Home/End/printable typeahead open and position; PageUp/PageDown move by 10 while open; Enter/Space open or commit; Alt+ArrowUp commits and closes; Tab commits the active option and closes (does not `preventDefault`); Escape closes. **Button-based comboboxes** (Dropdown's `<button role="combobox">`): `preventDefault()` on Enter keydown and on Space keydown **and** keyup (through `onKeyDown` and `onKeyUp`, which the consumer attaches), so the native button click (Enter on keydown, Space on keyup) does not toggle the listbox open again after a commit.
- Disabled options are skipped by navigation/typeahead and cannot be committed.
- The active value is **derived during render**: ignored when it is not in the navigable set (falls back per `autoHighlight`), reset on close and after select — no clamping effect (C-HOOKS).
- The active option is scrolled into view (`scrollIntoView({ block: 'nearest' })`) in a layout effect.
- Options expose `data-active/data-selected/data-disabled` (C-CLASS).
- **Consumer contract** (P05 Combobox/Dropdown/TagPicker, P06 TimePicker; the JSDoc of `useListbox` repeats it, and F5's harness in `src/hooks/__tests__/useListbox.test.tsx` shows the wiring):
  - Spread `lb.getComboboxProps()` onto the combobox element and attach **both** `onKeyDown={lb.onKeyDown}` and `onKeyUp={lb.onKeyUp}` to it, composed with the consumer's handlers (C-COMPOSE; `lb.onKeyDown` ignores events a consumer handler already prevented). `onKeyUp` is what stops a `<button role="combobox">` (Dropdown) from toggling the listbox again on the Space keyup click after a keydown commit.
  - Registration mode: `Option = markListboxElement(OptionImpl, 'option')` and `OptionGroup = markListboxElement(OptionGroupImpl, 'group')`; `memo` components can be marked too. `collectOptionLabels` walks only marked components, so without the marks the server render and the first client render have no display text.
  - `OptionImpl` calls `useListboxOption(props, ref)`, spreads `optionProps` onto its `<li>` and composes their `onClick` with the consumer's. The listbox root spreads `lb.getListboxProps()` onto the list and wraps it in `<ListboxContext.Provider value={lb.context}>`.
  - Display text = `lb.getItem(value)?.label ?? collectOptionLabels(children).get(value)`, plus `?? value` for freeform Combobox input only.
  - Editable consumers (Combobox, TagPicker, TimePicker) pass `onClearDraft`, which Escape calls while the list is closed and the input has text.
  - All options live in a single container at a time (inline while closed, portaled while open, never both; see "Where the options live").
  - P05 tests that depend on it: Dropdown Enter/Space commit without re-opening (needs `onKeyUp`); `renderToString` of Dropdown and of Combobox with `defaultValue="us"` containing "United States" (needs the marks); closed Escape clearing the Combobox draft (needs `onClearDraft`).
  - Keyed-reorder tests run **outside** `React.StrictMode`: in StrictMode, React DEV re-runs the effects of moved (keyed-reordered) fibers, so the moved options register again and such a test passes even without order detection.

---

## 3. Packaging and build (F6a-tooling, F6b-pipeline; CSS script by F1)

### 3.1 Vite library config (`repo-level#2`, `#3`, `#4`, `#5`)
```ts
import pkg from './package.json' with { type: 'json' };
const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})];
const external = (id: string) => deps.some((d) => id === d || id.startsWith(`${d}/`)); // react, react/jsx-runtime, react-dom/*, clsx, tailwind-merge, @floating-ui/react-dom
const useClient = (chunk: { facadeModuleId: string | null }) => {
  const id = chunk.facadeModuleId ?? '';
  return /[\\/]src[\\/](components|hooks)[\\/]/.test(id) && !/[\\/]index\.tsx?$/.test(id) ? '"use client";' : '';
};
export default defineConfig({
  plugins: [react(), dts({ rollupTypes: true, tsconfigPath: './tsconfig.json', afterBuild: copyIndexDtsToDcts })],
  build: {
    lib: { entry: 'src/index.ts' },   // no `formats`: Vite ignores it when output is an array (and warns)
    sourcemap: true,
    rolldownOptions: {
      external,
      output: [
        { format: 'es',  preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].mjs', banner: useClient },
        { format: 'cjs', preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].cjs', banner: useClient, exports: 'named' },
      ],
    },
  },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
});
```
- `tailwindcss()` is removed from the library JS build (no CSS in JS); CSS is built by `scripts/build-css.mjs` (F1).
- `'use client'` is emitted only for modules under `src/components` and `src/hooks`, **not** for `index.ts` barrels (a barrel only re-exports; the directive belongs to the modules that use hooks); `src/lib` (e.g. `cn`, slot helpers) stays server-safe.
- **RSC and compound components**: a Server Component cannot dot into a client reference (`Card.Header` throws "Cannot access Header on the server"), so every sub-component is also exported under a flat name (C-COMPOUND). README documents: flat names from Server Components, dotted names in client files.
- If the installed rolldown rejects `preserveModules`, fall back to a multi-entry `lib.entry` built from `src/**/*.{ts,tsx}` (excluding tests and `src/test-utils*`) with the same file naming.
- `scripts/verify-dist.mjs` (new, F6b): asserts the directive per component/hook file and its absence from `dist/lib/cn.*` and every `dist/**/index.*`; that `dist/lib/cn.mjs` imports under `node --conditions=react-server`; that `index.d.ts` and `index.d.cts` exist; that the flat sub-component names are exported from `dist/index.mjs` (the compounds on `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs` are exempt while wave D and INTEGRATION add their flat names; an entry whose flat names all exist fails, so the list only shrinks; `--final`, run by `prepublishOnly` and the final gate §7.2, ignores the list and fails while it is not empty); and tree-shaking, via **Vite's own `build()` API** (a probe entry that imports only `Button` from `dist`, `write: false`) asserting Dialog code is absent — no dependence on the transitive `esbuild`.
- **Storybook separation**: `@storybook/builder-vite` loads `vite.config.ts` plugins, so `.storybook/main.ts` gets a `viteFinal` that adds `@tailwindcss/vite` and removes the `vite:dts` plugin (and its `afterBuild` copy step) — see §3.3.

### 3.2 `package.json` (`repo-level#1`, `#21`, `#5`)
```json
{
  "version": "0.5.0",
  "main": "./dist/index.cjs", "module": "./dist/index.mjs", "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./styles": "./dist/styles.css",
    "./styles.css": "./dist/styles.css",
    "./preflight.css": "./dist/preflight.css",
    "./tailwind": "./src/styles/tailwind.css",
    "./tailwind.css": "./src/styles/tailwind.css",
    "./tokens": "./src/styles/tokens.css",
    "./tokens.css": "./src/styles/tokens.css",
    "./legacy-tokens.css": "./src/styles/legacy-tokens.css",
    "./package.json": "./package.json"
  },
  "files": ["dist", "src/styles", "!src/styles/__tests__"],
  "sideEffects": ["*.css"],
  "peerDependencies": { "react": "^19.0.0", "react-dom": "^19.0.0", "tailwindcss": "^4.1.0" },
  "peerDependenciesMeta": { "tailwindcss": { "optional": true } },
  "dependencies": { "@floating-ui/react-dom": "^2.1.6", "clsx": "^2.1.1", "tailwind-merge": "^3.5.0" },
  "repository": { "type": "git", "url": "git+https://github.com/mortenbrudvik/waveui.git" },
  "homepage": "https://github.com/mortenbrudvik/waveui#readme",
  "bugs": { "url": "https://github.com/mortenbrudvik/waveui/issues" }
}
```
All installs happen once, in **F6a (wave A)**: runtime `@floating-ui/react-dom`; dev `@tailwindcss/cli@^4.2.1`, `@storybook/addon-docs@^10.2.19`, `publint`, `@arethetypeswrong/cli`, `@types/node`. No other agent runs `npm install`. Scripts (F6a writes the tooling scripts in wave A; F6b adds/finalises `build`, `test:pack`, `build-storybook` checks and `prepublishOnly` in wave C):
- `build`: `tsc -p tsconfig.json --noEmit && vite build && node scripts/build-css.mjs && node scripts/verify-dist.mjs` — the library program only, so pre-existing test/story type errors in P-owned files (54 at baseline) cannot block F1/F6b pipeline verification.
- `typecheck`: `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.dev.json --noEmit && tsc -p tsconfig.node.json --noEmit && node scripts/check-ts-coverage.mjs`
- `lint`: `eslint src/ stories/ .storybook/ scripts/`; `format`/`format:check` also cover `.storybook/**` and `scripts/**`
- `check:package`: `publint && attw --pack . --profile node16`
- `test:pack`: `node scripts/pack-smoke.mjs` — packs the tarball, installs it into `scripts/fixtures/plain` (asserts `dist/styles.css` is unlayered — no top-level `@layer` block except `properties` — and contains `.bg-primary`, `.text-body-1`, `--wave-primary`, `@keyframes wave-spin` and the scoped native reset; ESM import + CJS require resolve with types) and `scripts/fixtures/tailwind` (compiles `@import "tailwindcss"; @import "@mortenbrudvik/waveui/tailwind";` with `@tailwindcss/cli` and asserts component classes were generated from `dist` and Wave's base rules sit in `@layer base`).
- `build-storybook` is followed by `node scripts/verify-storybook.mjs` (F6b): the emitted CSS contains `.bg-primary` and every story-only utility, i.e. Storybook is compiled through `preview.css`, not rendered unstyled. Story-only utilities are found by a reference compile of `src/styles/styles.css` with `stories/` as an extra source. The compile runs with the Tailwind CLI, independently of `.storybook/preview.css`, and keeps the Tailwind candidates of `stories/` that no library source uses. When the stories need no utility the library lacks, the check passes on `.bg-primary` alone, so no story has to keep a story-only class alive. It fails again as soon as a story adds a story-only utility that the build lacks.
- `prepublishOnly`: `npm run typecheck && npm run build && node scripts/verify-dist.mjs --final && npm test && npm run check:package && npm run test:pack`. The `verify-dist` run inside `npm run build` is lenient and passes while the `PENDING_FLAT_EXPORTS` bridge (§3.1) is open; `--final` fails until the list is empty.

### 3.3 TypeScript, ESLint, Prettier, git, Storybook (`repo-level#20`, `#22`, `#23`, `#24`, `#36`)
Three TypeScript programs (F6a, wave A; verified problems of revision 1: `Object.hasOwn`/`.at()` fail under `lib: ES2020` with TS2550; `tsconfig.dev.json` inherited the base `exclude` and silently checked **zero** test/story files; `vite.config.ts` needs `@types/node`, which then collides with `src/env.d.ts`'s `declare const process` (TS2451)):
- `tsconfig.json` — library/declaration program: `src` without `**/__tests__`, `src/test-setup.ts`, `src/test-utils*`, stories. `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `target: "ES2022"`.
- `tsconfig.dev.json` (new) — `extends ./tsconfig.json` but declares its **own** `exclude: ["node_modules", "dist", "storybook-static", "coverage"]` (so tests are not excluded by inheritance); `compilerOptions: { noEmit: true, types: ["vitest/globals", "vite/client"] }`; `include: ["src", "stories", ".storybook"]`. jest-dom's vitest matchers come from `src/test-setup.ts` (`import '@testing-library/jest-dom/vitest'`, part of the program), axe matchers from `src/vitest-axe.d.ts` (new, augments vitest's `Assertion` with `toHaveNoViolations()`). No `@types/node` here: the conventions gate reads files with `import.meta.glob(..., { query: '?raw' })` instead of `node:fs`.
- `tsconfig.node.json` (new) — `vite.config.ts`, `vitest.config.ts`, `types: ["node"]`; does not include `src/env.d.ts`, so its `process` declaration stays for the library/dev programs. Scripts stay plain `.mjs` (linted, not type-checked).
- `scripts/check-ts-coverage.mjs` (new, F6a): runs `tsc -p tsconfig.dev.json --listFilesOnly` and fails unless the program contains at least one `src/**/__tests__/*` file, one `stories/*.stories.tsx` file and `.storybook/preview.tsx` — a config that stops checking tests fails `npm run typecheck`.
- ESLint: lint `.storybook/` and `scripts/`; `@typescript-eslint/no-explicit-any: error` outside `*.d.ts`; keep react-hooks v7 recommended rules as errors (C-HOOKS lists the lint-compatible patterns and the only allowed disable sites).
- `.gitignore`: add `coverage/`, `storybook-static/`, `.playwright-mcp/`, `.claude/settings.local.json`.
- Storybook (F6b, wave C): `main.ts` addons `@storybook/addon-a11y`, `@storybook/addon-docs`, and a `viteFinal` that appends `@tailwindcss/vite()` and filters out plugins named `vite:dts` (builder-vite loads `vite.config.ts`'s plugins but not its `build` block, and the library config no longer has the Tailwind plugin). `preview.tsx` imports `./preview.css` (`@import "../src/styles/styles.css"; @source "../stories";` — no Preflight, same as consumers, plus story-only utilities); `globalTypes`/`initialGlobals` for `theme` (light/dark/high-contrast) and `dir` (ltr/rtl) toolbars; decorator `<WaveProvider theme={globals.theme} dir={globals.dir}>`; remove the dead `backgrounds` block; `parameters.a11y.test = 'error'`; `tags: ['autodocs']`.

### 3.4 Dependency justification
`@floating-ui/react-dom` (MIT, ≈3 kB + `@floating-ui/dom` ≈10 kB min, ~5 kB gz) is added because viewport-aware placement (flip/shift/size, arrow, logical sides, scroll/resize/ancestor tracking, transformed containing blocks) is required by 7 components and is error-prone to hand-roll. Everything else (dismiss layers, focus trap, modal isolation, scroll lock, roving, listbox, typeahead, announcer) is hand-rolled. New devDependencies only: `@tailwindcss/cli`, `@storybook/addon-docs`, `publint`, `@arethetypeswrong/cli`, `@types/node` (no `esbuild`: the tree-shake probe uses Vite's API).

---

## 4. Test infrastructure (F6t-test-infra; stories gate by F6b)

### 4.1 `src/test-utils.ts` — typed helpers, no `any`
```ts
export interface TestSystemPropsConfig<P> {
  expectedTag: string;
  displayName: string;
  polymorphic?: boolean;
  a11y?: boolean;                                   // default true
  a11yScope?: 'document' | 'container';             // default 'document' (baseElement) — portals are audited
  defaultProps?: Partial<P>;
  a11yVariants?: Array<{ name: string; props: Partial<P> }>;
  control?: { role: string };                       // C-ROUTING: aria-label must land on getByRole(role, { name })
  conflictingClass?: { className: string; overrides: string }; // user class wins, default removed
  wrapper?: React.ComponentType<{ children: React.ReactNode }>;
}
export function testSystemProps<P extends object>(Component: React.ComponentType<P>, config: TestSystemPropsConfig<P>): void;
export function testForwardRef<P>(…): void;  testRestSpread<P>(…): void;  testClassName<P>(…): void;
export function testPolymorphicAs<P>(…): void; testA11y<P>(Component, props?, options?: { scope? }): void;
export function testDisplayName(Component: { displayName?: string }, name: string): void;
export function testCompoundExposure(Parent: object, names: string[]): void; // also asserts each sub-component has a displayName
export function testFocusEvents<P>(Component, defaultProps?, selector?): void;
export function createOverlayTestWrapper<P>(Root: React.ComponentType<P>, rootProps: P): React.ComponentType<{ children: React.ReactNode }>;
export function testNoImplicitSubmit<P>(Component: React.ComponentType<P>, options?: { defaultProps?: Partial<P>; getTargets?: (container: HTMLElement) => HTMLElement[] }): void;
export function testComposedHandler<P>(Component: React.ComponentType<P>, options: {
  handler: Extract<keyof P, `on${string}`>; defaultProps?: Partial<P>;
  act: (utils: RenderResult & { user: UserEvent }) => Promise<void>;
  assertInternal: (utils: RenderResult) => void;          // internal behaviour still ran
  assertInternalSuppressed?: (utils: RenderResult) => void; // when the consumer calls preventDefault
}): void;
export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions & { theme?: WaveTheme; dir?: WaveDir }): RenderResult;
export function installResizeObserverMock(): { trigger(target?: Element): void; restore(): void };
export function mockMatchMedia(matches: Record<string, boolean>): () => void;
export function mockRect(el: Element, rect: Partial<DOMRect>): void;
export async function expectNoA11yViolations(root?: Element): Promise<void>;
/** The one axe instance used by every helper and by the stories gate. */
export const axe: ReturnType<typeof configureAxe>; // configureAxe({ rules: { region: { enabled: false } } })
```
- **axe configuration** (blocker fix): vitest-axe's default `axe` disables no rules, and `region` ("all page content should be contained by landmarks") fails for any text rendered outside a landmark when the scan context is `document.body` — the execution critique measured that switching the existing helper to `document.body` made 38 existing tests in 28 P-owned files fail, all on `region`, while a `container` scan reports none. Components are audited in isolation, so `region` is disabled once in the shared instance (page-level landmark rules have no meaning for a single component). `testA11y`, the `a11yVariants` loop, `expectNoA11yViolations` and `stories.a11y.test.tsx` all use it; the JSDoc says so. `test-utils.test.tsx` proves a bare `<button>` and `<div><p>Hello</p><Button/></div>` on `document.body` pass.
- `renderWithProviders` and its tests belong to F6t (built on the existing `WaveProvider` `theme`/`dir` props, which F3 keeps).
- `testClassName` renders once without `className`, then asserts every baseline class survives and the custom class is present; with `conflictingClass` it asserts the override wins. Comments describe these as building blocks of `testSystemProps` (`table-core#26`).
- `testRestSpread` asserts `data-testid` on the root; with `control`, asserts `aria-label` produces `getByRole(control.role, { name })` (updates the tests that locked aria-label on wrappers).
- `testCompoundExposure` additionally checks `displayName` (`input-pickers#1`).
- The JSDoc of `test-utils.ts` is the source of truth for helper signatures (`repo-level#26`).

### 4.2 `src/test-setup.ts`
`import '@testing-library/jest-dom/vitest'` + `toHaveNoViolations`; `Element.prototype.scrollIntoView` defined as `vi.fn()` when missing (`input-basic#31`); `window.matchMedia` default stub (`matches: false`) when missing; `afterEach(() => { cleanup(); __resetWarnings(); … })`: after an explicit RTL `cleanup()`, the test **fails if `document.body` still has children** (leftovers are removed first, then the error names them), so a leaked portal, announcer or toast region can never be audited by a later test's `document.body` scan. **No global `ResizeObserver`** — consumers' jsdom lacks it, so absence is the default; tests that need it call `installResizeObserverMock()` (`layout#7`, `layout#9`).

### 4.3 `vitest.config.ts`
Coverage `include` adds `src/components/**/*.ts` (new non-tsx modules) and excludes `src/test-utils*`, `**/*.d.ts`; keep thresholds. (F6a, wave A.)

### 4.4 Repo gates (conventions: F6t; stories axe: F6b)
- `src/__tests__/conventions.test.ts` (F6t): reads sources with `import.meta.glob(['../components/**/*.{ts,tsx}', '!**/__tests__/**'], { query: '?raw', import: 'default', eager: true })` (no `node:fs`, no `@types/node` in the dev program) and `../../stories/*.stories.tsx`; one `it` per file (filter with `-t "<path>"`), reporting `file:line` for:
  - raw colors (`\[#[0-9a-f]{3,8}\]`, `rgba?\(` inside class strings, `(bg|text|border|stroke|fill|ring|outline)-(white|black)`, `stroke="white"`, Tailwind palette colors like `green-600`) — in components **and stories** (stories may mark fixture data with `wave-allow-color: fixture`);
  - physical utilities (`\b-?(ml|mr|pl|pr|left|right)-`, `border-[lr]\b`, `border-[lr]-`, `rounded-[lr]\b`, `rounded-(tl|tr|bl|br)`, `text-(left|right)`, `float-(left|right)`, `origin-(left|right)`, `bg-linear-to-[lr]`, `scroll-[mp][lr]-`, and `-?translate-x-` state classes on a line without a `wave-rtl:` counterpart) unless the line carries `wave-allow-physical`;
  - any class with Tailwind's bare `rtl:`/`ltr:` (or `not-rtl:`/`not-ltr:`) variant (`direction-variant`, revision 3);
  - `focus:outline-none`/`focus-visible:outline-none`, arbitrary `animate-[`, `forwardRef(`;
  - any `enabled:` variant (C-TOKENS state gating);
  - a JSX `<button` opening tag (multi-line aware) without a literal `type=` (C-BUTTON-TYPE);
  - a class string containing `transition` (not `transition-none`) or `animate-` (not `animate-none`) without a `motion-reduce:` variant in the same string, unless the line carries `wave-allow-motion` (C-MOTION).
  It fails until every P package is done (final gate); each P agent runs it filtered to its files.
- `src/__tests__/stories.a11y.test.tsx` (F6b): `setProjectAnnotations(preview)`; a **non-eager** `import.meta.glob('../../stories/*.stories.tsx')` with one `describe` per story file whose tests `await` that file's import, so a syntax/import error in one in-progress story fails only that file's block; `composeStories` renders each story and asserts `toHaveNoViolations` on `document.body` with the shared F6t `axe` instance (`region` and `color-contrast` disabled) and no dangling ARIA id reference. Structural rules only, default (light) theme — jsdom cannot compute contrast (the rule only ever landed in `incomplete`), so it is disabled and contrast is not claimed here (§4.5). Stories may opt out only with `parameters: { a11y: { test: 'todo' } }` and a comment explaining why.
- `src/__tests__/test-utils.test.tsx` (F6t): tests for the new helpers, including `renderWithProviders`, the axe configuration and the body-cleanup assertion.

### 4.5 Contrast verification (`repo-level#23`, `button-provider#3`)
jsdom axe cannot compute color contrast. Contrast is therefore guarded by `src/styles/__tests__/tokens.test.ts`, which recomputes every pair of §2.1.3 **unrounded** for each theme, including the component combinations the review found (foreground, muted-foreground, primary-as-text and ring against `selected`, `subtle-selected`, `card`/`subtle-hover`), and checks the text matrix of §2.1.3: every text token against every surface it can sit on. Component-level combinations are kept on those pairs by C-TOKENS. A per-theme check in the Storybook a11y panel (theme toolbar set to light, dark and high contrast; `color-contrast` enabled) is a documented manual step of the final gate (§7.2). An automated real-browser pass (Vitest browser mode or Playwright over the built Storybook) would add a Playwright dev dependency and browser download; it is listed as an open question rather than silently claimed. In the verification round such a pass was run once, outside the repository and with no new dev dependency: axe-core `color-contrast` in headless Chromium over the built Storybook, every story in the three themes, at rest and in hover, pressed, focus, open and selected states. Its token finding led to the text matrix (§2.1.3). It is not a gate, so the manual per-theme step of §7.2 stays.

---

## 5. Cross-package contracts

### 5.1 Field ↔ every input (P02 provides; P02–P06 consume)
1. `Field` (P02) creates `controlId` (own `id` of a control-id child, item 2 → `htmlFor` → `useId('field')`), `labelId`, `hintId`, `errorId`; renders `<label id={labelId} htmlFor={controlId}>` with an `aria-hidden` asterisk; renders the error with `role="alert"`; provides `FieldContext`.
2. Field merges into its **first** element child only; further element children are rendered unchanged (dev warning when more than one element child is present), and nothing is merged when the first one is left alone. How it merges depends on that child:
   - **Control id.** A component (library control, consumer input, or a wrapper such as Tooltip: Field cannot see inside a component), a labelable intrinsic element (`input`, `select`, `textarea`, `button`, `meter`, `output`, `progress`, whatever its `role`) or a role-less custom element (`<my-text-field>`, possibly form-associated) receives the control id. If it has its own `id`, that id is kept and becomes `controlId`.
   - **`aria-labelledby`.** Any other intrinsic element (custom elements included) with an explicit role that can be named (`<div role="radiogroup">`, `role="group"`) is named through `aria-labelledby`: the label id joined with its own, not added when it has `aria-label` or when the Field has no label. It gets no `id`, because a `<label htmlFor>` cannot name it; a library control inside it keeps the control id.
   - **Left alone.** A Fragment, and a non-labelable intrinsic element (`div`, `span`) without a role or with a presentational (`none`, `presentation`, `generic`) or name-prohibited role (`paragraph`, `code`, …). The library control inside reads `FieldContext`.
   - **Merged values.** Only defined keys are merged, and child values are kept: `id` kept, `aria-describedby` joined (child's, error, hint), `aria-invalid` only added (`true` while the Field has an error and the child sets none; a child's own value, `false` included, is kept and the Field error still describes it — revision 3, as `useFieldControl` already did for nested controls). With `required`, `aria-required` is added (unless the child sets its own) only where ARIA allows it: components (they decide where it goes); `input` other than type `button`/`submit`/`reset`/`image`; `select`; `textarea`; elements whose explicit role supports it (`checkbox`, `combobox`, `listbox`, `radiogroup`, `searchbox`, `spinbutton`, `switch`, `textbox`, `tree`, `treegrid`, `gridcell`, `columnheader`, `rowheader`), where an explicit role decides over the tag. Never on `button`, `meter`, `output`, `progress`, button-type inputs or role-less custom elements (axe `aria-allowed-attr`). Native `required` (unless the child sets its own) is added only to `input` (not button types), `select` and `textarea`; library controls get it through `FieldContext` (`nativeRequired`, item 3). Custom elements receive the string `"true"` for `aria-invalid`/`aria-required` (React renders a boolean `true` on a custom element as an empty attribute).
   - Library controls additionally read `FieldContext`; `joinIds` de-duplicates ids that arrive through both paths. A wrapper component as first child (Tooltip, a layout component) receives the id and the ARIA on its own element, so the library control inside is named only when it has its own `id` (`aria-labelledby`, §2.5), and `aria-required` on the wrapper's element is an axe `aria-allowed-attr` error. The documented pattern (Field JSDoc, README) puts wrapper components inside a plain `<div>`, which Field leaves alone. **Decision (lead, wave D, `input-basic#15`): components keep receiving `aria-required`.** Field cannot tell a wrapper component from a consumer's own input component, and 0.4 gave every child `aria-required`. The asterisk is now `aria-hidden`, so Field's `aria-required` is the only programmatic required signal for a consumer input component, and dropping it would remove that signal without warning. The wrapper case needs the plain-element pattern anyway, because only that pattern labels the control inside correctly. The P02 test 'keeps aria-required on component children (they may render any control)' stays.
3. Library controls call `useFieldControl(props, { labelable, nativeRequired })` and spread the result onto their focusable element. `labelable: true` for `<input>`, `<button>`-based controls (Checkbox, Switch, Dropdown trigger); `labelable: false` (aria-labelledby) for `role=radiogroup` divs (RadioGroup, Rating, SwatchPicker), ColorPicker `role=group`. `nativeRequired: true` for Input, Select, Textarea, Slider (P02) and SpinButton (P04) — the usual `<Field required><Input/></Field>` then sets native `required` (test asserts the attribute and `validity.valueMissing`). When a control is not Field's first child or carries its own id, `aria-labelledby` points at the label (§2.5).
4. Controls with their own `error` message (Input/Select/Textarea) do not render it when `FieldContext.hasErrorMessage` is true.
5. Consumers of the context: P02 Input, Textarea, Select, Slider, SearchBox; P03 Checkbox, Switch, RadioGroup, Rating; P04 SpinButton, ColorPicker, SwatchPicker; P05 Combobox, Dropdown, TagPicker; P06 DatePicker, TimePicker. P02 tests with the real `Field` (it owns it). P03–P06 test context consumption with F5's `renderWithFieldContext` (label → `getByRole(role, { name })`, hint/error → `toHaveAccessibleDescription`, `aria-invalid`, `aria-required`). INTEGRATION repeats these with the real `Field`, plus Field > Tooltip > Input with its own id (naming and description). Its `required` + axe variant wraps the Tooltip in a plain `<div>` (item 2): a component first child receives `aria-required`, which is an axe `aria-allowed-attr` error on Tooltip's wrapper `<span>`.

### 5.2 Menu ↔ MenuButton / SplitButton / Popover (P13 owns Menu; P01 owns buttons)
```tsx
<Menu open? defaultOpen? onOpenChange?>
  <Menu.Trigger><MenuButton>Actions</MenuButton></Menu.Trigger>
  <Menu.Popover side="bottom" align="start">
    <Menu.Item onClick={…}>Edit</Menu.Item>
  </Menu.Popover>
</Menu>

<Menu>
  <Menu.Trigger>{(triggerProps) => <SplitButton menuButtonProps={triggerProps}>Save</SplitButton>}</Menu.Trigger>
  <Menu.Popover>…</Menu.Popover>
</Menu>
```
- `Menu` without `Menu.Trigger`/`Menu.Popover` children keeps today's static inline `role="menu"` behaviour (plus roving fix).
- `Menu.Trigger` uses F3 `useTriggerElement` with `MenuTriggerProps = { id, 'aria-haspopup': 'menu', 'aria-expanded': boolean, 'aria-controls'?: string, onClick, onKeyDown, ref }` (state ARIA always wins; `asChild={false}` opt-out; wrapper fallback for non-forwarding children). Enter/Space/ArrowDown open and focus the first enabled item; ArrowUp opens and focuses the last.
- `Menu.Popover` = `Portal` + `usePopupPosition` + `useDismiss({ kind: 'menu', refs: [trigger, surface], anchorRef: trigger })` + roving (`useRovingTabIndex` DOM mode, vertical, loop, typeahead). Item activation calls `onClick` then closes and restores focus to the trigger (opt-out `Menu.Item persistOnClick`); Escape closes and restores; Tab/Shift+Tab closes and restores focus to the trigger without `preventDefault` so native tabbing continues from the trigger. Inside a Dialog the trap's bubble-phase listener sees the same event after the Menu's React handler; because the menu is a descendant layer anchored at the trigger, the trap moves focus to the element after (Shift+Tab: before) the trigger in the dialog order (§2.4).
- **P01 obligations**: `MenuButton` places `aria-haspopup="menu"`/`aria-expanded={expanded}` **before** `{...props}` and composes handlers so trigger props win; `SplitButton` exposes `menuButtonProps` and `primaryActionButtonProps` (merged with `mergeProps`) and a `menuButtonLabel` (default `'More options'`). P01 tests compose with a minimal local stand-in trigger (props object), not with P13's Menu (parallel isolation); INTEGRATION adds a cross-package composition test.
- `Popover` + `Menu` remains possible but README/guide recommend `Menu.Trigger`.

### 5.3 Triggers and Tooltip attachment (P15, P16, P13)
- `Dialog.Trigger`, `Drawer.Trigger` (new), `Popover.Trigger`, `Menu.Trigger`, `Dialog.Close` (new), `Drawer.Close` (new) are **asChild by default**: no wrapper span; they merge their props onto the single child via F3 `useTriggerElement` and accept a render-prop child. Trigger props include `aria-haspopup` (`dialog`/`menu`), `aria-expanded`, `aria-controls` (only while open), and a ref used as positioning anchor and focus-restore target (stored in the root context). State ARIA from the trigger always wins over the child's props; the child's own `id` wins and is reported to the root (`Popover.Content`'s default `aria-labelledby` uses it).
- **Backward compatibility of triggers** (0.4 wrapped children in a `<span>` that caught the bubbling click): `asChild={false}` renders the 0.4 wrapper span explicitly; and when the child is a custom component that neither forwards `ref` nor spreads props (`<Dialog.Trigger><MyFancyButton/></Dialog.Trigger>`), `useTriggerElement` detects that the ref never attached after mount, switches to the wrapper span automatically and warns in development — so such triggers keep opening their dialog. A component that forwards `ref` but drops `onClick` cannot be detected (documented). Tests: non-forwarding custom child still opens (P15, P16), `asChild={false}` renders the span.
- **Tooltip** keeps its wrapper `<span>` (ref/className/rest target, positioning anchor, hover/focus listener host with composed handlers) and clones its child adding `aria-describedby = joinIds(child's, tooltipId)` (or `aria-labelledby` with `relationship="label"`) permanently. The description is an **inline, always-rendered `<span id={tooltipId} role="tooltip" hidden>`** inside the wrapper (accessible-description computation follows `aria-describedby` into hidden content), so it exists on the server and on the first render and costs no portal. Only the visual surface is portaled (`Portal layer="tooltip"`, `aria-hidden="true"` because it duplicates the description), and only while visible — a table with hundreds of tooltips creates no portal roots. Because triggers forward unknown props to their child, `<Tooltip><Dialog.Trigger><Button/></Dialog.Trigger></Tooltip>` puts the description on the Button (INTEGRATION test). SplitButton routes a root `aria-describedby` to its primary button.
- Non-element children: dev warning + span fallback; never `return null`, never clone a Fragment.

### 5.4 Popup primitive usage (C-POPUPS)
| Component (owner) | Portal layer | Position | Dismiss | Focus |
|---|---|---|---|---|
| Dialog, Drawer (P15) | overlay | — (fixed layout) | `useModalLayer`: `kind:'modal'`, escape, outsidePress (backdrop is outside the content surface) | trap + restore (trigger) + scroll lock + **modal isolation instead of `aria-modal`** (§5.8) |
| Popover (P16) | overlay | side/align props, arrow | escape, outsidePress (+`ignoreOutsideRefs`) | `useRestoreFocus({ onlyIfFocusInside: true })` |
| TeachingPopover (P16) | overlay when `target` given, inline otherwise | side/align, beak | escape (+ outsidePress off) | save/restore focus |
| Tooltip (P16) | tooltip (visual only, while visible) | top/center default, flip/shift | escape only | — (description inline and hidden, §5.3) |
| Menu.Popover (P13) | overlay | bottom-start | escape, outsidePress, focusOutside; `anchorRef` = trigger | first item on open, restore to trigger |
| Combobox, Dropdown, TagPicker (P05) | overlay while open; inline `hidden` list while closed | bottom-start, `matchReferenceWidth`, `fitViewport` | escape, outsidePress, focusOutside | focus stays on combobox (activedescendant) |
| TimePicker (P06) | as listboxes | as listboxes | as listboxes | as listboxes |
| DatePicker calendar (P06) | overlay | bottom-start, flip/shift | `kind:'modal'`-like dialog: escape, outsidePress | `useFocusTrap` (initial = focused day), restore to toggle/input; keeps `aria-modal="true"` (transient popup; no isolation) |
| InfoLabel (P08), AvatarGroup overflow (P07) | overlay | top/bottom | escape, outsidePress | restore to trigger; InfoLabel description inline and hidden |
| Toaster (P12) | toast | fixed viewport | — | `data-wave-focus-trap-allow`: joins trap Tab cycles, counts as inside every layer, never inerted |

Inner widgets that handle Escape themselves (DatePicker grid, TagPicker chips, Tree typeahead reset) call `preventDefault()` so enclosing layers ignore it.

### 5.5 Listbox consumers (P05, P06)
- `Option`/`OptionGroup` move from `Combobox.tsx` to a new `src/components/input/Option.tsx` (P05), re-exported from `Combobox.tsx` (barrels unchanged). `Option = markListboxElement(OptionImpl, 'option')`, where `OptionImpl` calls `useListboxOption(props, ref)` and renders `<li {...optionProps}>` with their `onClick` composed with the consumer's; label = `label` prop → `textValue` → string children → `textContent`. `OptionGroup` = `<li role="presentation"><div id={labelId} role="presentation">…</div><ul role="group" aria-labelledby={labelId}>…</ul></li>`; `ref`, `className` and rest props land on the `<li>` (`OptionGroupProps extends React.LiHTMLAttributes<HTMLLIElement>`, `ref?: React.Ref<HTMLLIElement>`, §7.3); groups with no visible option are hidden. It is exported as `OptionGroup = markListboxElement(OptionGroupImpl, 'group')`. Without the marks `collectOptionLabels` finds no labels (§2.5 consumer contract).
- Combobox: `mode:'editable'`, registration mode, `filter` by draft text in both freeform and non-freeform (Fluent behaviour), draft model (`draft: string | null`), `onClearDraft`. Dropdown: `mode:'select-only'`, typeahead, button key handling of §2.5 (`onKeyDown` **and** `onKeyUp` on the `<button>`). TagPicker: `mode:'editable'`, `multiple`, data mode (`items` from `options` minus selected), `onClearDraft`. TimePicker: `mode:'editable'`, data mode (generated options), `onClearDraft`. It ranks the active option itself on every edit with `setActiveValue`: a complete typed time (`2:00 PM`, `14:00`) activates its own option, and nothing when that time is not in the list (off-grid or out of bounds); partial text activates the first option whose label or value starts with it, else the first that contains it. `autoHighlight` is `'selected'` only while there is no draft and the selected value is in the list, otherwise `false`. It does not pass `highlightOnFilter`: that option resets the active option to the first filtered item in every render where the filtered set changes (§2.5), which would override this ranking (a pasted `2:00 PM` would activate the earlier `12:00 PM`). Every consumer follows the §2.5 consumer contract.
- Rendering: while closed, the option list is rendered inline with `hidden` (registration and ids exist from the first client commit, no portal per closed picker); while open, inside the Portal surface. Never both at once, not even during an exit animation (single container, §2.5). Display text = `lb.getItem(value)?.label ?? collectOptionLabels(children).get(value)` (`?? value` for freeform Combobox input only), so server output and the first client render show the label (`renderToString` tests for Dropdown and Combobox with `defaultValue="us"`).
- Callbacks: `onValueChange` fires on change only; the deprecated `onOptionSelect` fires on every option activation (0.4 semantics, re-selection test).

### 5.6 DatePicker / TimePicker (P06)
- Date math and parsing live in P06's new `src/components/input/dateUtils.ts` (+ tests): `startOfDay`, `addDays`, `addMonths` (day clamped), `isSameDay`, `clampDate`, `formatISODate`, `parseISODate`, `getLocaleDateFormat(locale)`, `formatDate(date, locale)`, `parseDate(text, locale)` (inverse of `formatDate`, local midnight), `getMonthNames(locale)`, `getWeekdayNames(locale, firstDayOfWeek)`. Time helpers (`timeToMinutes` accepting `HH:mm[:ss]` and `h:mm AM`, `minutesToTime`, `generateTimeOptions` with step guard) move to the same file.
- DatePicker: input (editable text, draft model) + toggle button (`aria-haspopup="dialog"`) + calendar dialog (C-POPUPS row above), 2-D roving over day buttons driven by date arithmetic, `locale` prop, `defaultOpen` via `useControllable`.
- Parsing contract: the default parser is the exact inverse of the default formatter **for the same `locale` prop** (so `locale="en-GB"` round-trips day-first). A custom `formatDate` without `parseDate` triggers a dev warning (`warnOnce`) and typed edits are parsed with the default parser for `locale` (documented: supply both). JSDoc recommends an explicit `locale` for SSR, because the runtime default locale may differ between server and client.
- TimePicker: `useListbox` data mode + popup primitives.

### 5.7 Shared visual building blocks
- Icons: F2 `src/lib/icons.tsx` (every package imports from there; local SVG copies are deleted).
- Button appearance/size maps: P01 `src/components/button/buttonStyles.ts`, used only inside P01.
- Other packages that need a button use the **public `Button` component** with its existing stable props (`appearance`, `size`, `icon`, `aria-label`) — allowed for P15 (Dialog/Drawer close), P16 (TeachingPopover actions), P12 (MessageBar/Toast dismiss), P08 (List story buttons), P11 (Card story). Do not import `buttonStyles.ts` from outside P01. `Button.tsx` and `buttonStyles.ts` are rewritten by P01 in **wave D0** before the other packages start; after D0 the Button API is frozen for wave D (changes only via the change-request queue, §7.1.3), so other packages' tests and type checks never see a half-rewritten Button.
- Status icons (Success/Warning/Error/Info) and the visually hidden status text pattern are shared by MessageBar and Toast (P12).

### 5.8 Toasts over modals (P12, P15, F4)
Toaster viewport = `Portal layer="toast"` + `data-wave-focus-trap-allow` + `role="region" aria-label="Notifications"`; permanent polite/assertive live regions inside the Toaster. One coherent model (revision 1 mixed two):
- **Modal isolation replaces `aria-modal`** on Dialog and Drawer (`useModalIsolation`, §2.4). With `aria-modal="true"`, Chrome prunes and VoiceOver ignores everything outside the modal — including the body-level Toaster viewport, its live regions and the `useAnnounce` regions — so an allow-listed toast would be Tab-reachable but invisible to screen readers, and announcements could be lost. Instead, everything outside the modal's tree is made `inert` except the Toaster viewport (`[data-wave-focus-trap-allow]`), the announcer (`[data-wave-announcer]`) and the modal's own descendant layers. The dialog keeps `role="dialog"`, its name and focus trap; the background is non-interactive and absent from the accessibility tree, exactly the modal semantics, while toasts and announcements stay perceivable.
- **Keyboard**: focus traps include the allow-listed region in their Tab cycle.
- **Pointer**: `useDismiss` treats targets inside the allow-list as inside every layer, so clicking a toast's Dismiss or action button never closes the Dialog/Drawer beneath it.
- The DatePicker calendar keeps `aria-modal="true"` (transient popup, no isolation).
- Tests: F4 unit tests with an allow-listed portaled div (Tab reachable, not inert, click does not dismiss); P15 stand-in test; INTEGRATION real Toast inside a Dialog (Tab + mouse click, Dialog stays open, toast not inert).

### 5.9 Parallel-phase isolation rules
- During wave D, packages may import only foundation modules and the stable public props of `Button` (frozen after wave D0, §5.7). InfoLabel (P08) and AvatarGroup overflow (P07) build on F4 primitives, not on P16's Popover. New symbols are imported from module paths, not barrels (§0.2 rule 2).
- Tests must not depend on another package's in-progress work. Every cross-package composition test is INTEGRATION's (`src/__tests__/integration.test.tsx`); owners use the stand-ins below instead:

| Composition (INTEGRATION tests the real thing) | Stand-in used by the owning package |
|---|---|
| Menu.Trigger/Popover + MenuButton / SplitButton (`feedback-navigation#51`) | P01: a local trigger-props object `{ id, 'aria-haspopup': 'menu', 'aria-expanded', 'aria-controls', onClick, onKeyDown, ref }`; P13: a plain `<button>` trigger child |
| Tooltip > Dialog.Trigger > Button (`overlays#5`) | P15/P16: a plain `<button>` and a non-forwarding custom component as trigger children |
| Real Field around P03–P06 controls; Field > Tooltip > Input (`input-basic#1`) | `renderWithFieldContext` (F5) |
| Tooltip inside Overflow, Table, Card, Drawer (`overlays#36`) | none needed — those packages render no popups; P15 only keeps the Drawer body `overflow-y-auto` |
| Toast inside Dialog: Tab, click, AT exposure (`feedback-navigation#50`) | P15: an allow-listed portaled `<div>` with a button (`data-wave-focus-trap-allow`) |
| Dialog opened from Popover.Content (`overlays#41`) | P16: a raw F4 child layer (`Portal` + `useDismiss`) inside Popover.Content; P15: a raw parent-layer harness around a Dialog |
| Dropdown inside Dialog, Escape (`overlays#1`) | P15: a raw `useDismiss` child layer inside a Dialog; P05/P06: the listbox inside a raw parent layer |
| Overflow story showing hidden items in a Menu (`layout#4`) | P10: a plain disclosure list in the story; INTEGRATION switches it to Menu |

### 5.10 Deprecation and dev-warning format
`warnDeprecated('TabList', 'selectedValue', 'value')` → `[WaveUI] TabList: \`selectedValue\` is deprecated and will be removed in 1.0. Use \`value\` instead.` Warnings fire once per (component, prop) per page (reset per test).

### 5.11 Barrel requests (INTEGRATION applies)
INTEGRATION adds every new export after wave D, then normalises story/test imports of new symbols from module paths back to `'../src'`. Additionally every compound module's flat sub-component names (C-COMPOUND) are re-exported from its category barrel.
- `src/index.ts`: `Portal`, `PortalProps`; hooks `useMergedRefs`, `useFieldControl`, `useAnnounce`, `announce`; utilities `composeEventHandlers`, `mergeRefs`; types `SetValue`, `WaveContextValue`, `UseRovingTabIndexResult`, `ResolvedSlot`, `PolymorphicProps`, `PolymorphicComponent`, `FieldContextValue`, `Orientation`, `SelectionMode`, `TextWeight`, `Shape`, `PopupSide`, `PopupAlign` (via `export type * from './lib/types'`), `getThemeClassName`, `useIsClient`. `useTriggerElement`, `useModalLayer`, `useModalIsolation`, `collectOptionLabels` and `HiddenInput` stay internal. Header comment → `@mortenbrudvik/waveui/styles`; remove the transitional comment (`table-core#35`, `repo-level#1`, `table-core#33`).
- `button/index.ts`: new prop types (`SplitButtonMenuButtonProps` if introduced), `ButtonProps` generic keeps its name.
- `input/index.ts`: `RadioGroup` (now with `.Item`), `RadioItem` kept; `HiddenInput` stays internal; new types (`OptionProps` unchanged path).
- `data-display/index.ts`: unchanged names; `StrictImageProps` (`data-display#28`); `ListItem` flat name; new prop types if introduced (e.g. `PersonaProps` unchanged).
- `layout/index.ts`: `AccordionTriggerProps`, `AccordionPanelProps`, `useOverflowMenu`, `useIsOverflowItemVisible`, `TabList.Panels` types if introduced.
- `navigation/index.ts`: `MenuTriggerProps`, `MenuPopoverProps`.
- `feedback/index.ts`: `ToastController`, Skeleton group props (`SkeletonGroupProps`).
- `overlays/index.ts`: `DialogCloseProps`, `DialogTitleProps`, `DrawerTriggerProps`, `DrawerCloseProps`, `DrawerTitleProps`.
- `table/index.ts`: `TableHeaderProps`, `TableHeaderCellProps` (Head variants kept), `DataGridSort`.

---

## 6. Package briefs

Each brief lists the concrete work; the authoritative per-issue task list is Appendix A (search your key). All packages apply C-REF, C-TOKENS, C-LOGICAL, C-FOCUS, C-MOTION, C-CONTEXT, C-MEMO, C-DEV, C-STORIES, C-DOCS, C-TESTS to every owned file even where no cid names them.

### F2-lib (wave A)
All files of §2.2 with tests written first, plus `src/lib/globalRegistry.ts`. Key points of revision 2: `PolymorphicProps`/`PolymorphicComponent` with `extends React.ElementType` constraints and the `XOwnProps` rule; `isSlotObject` excludes elements, iterables and thenables, `ResolvedSlot` shape unchanged; `mergeProps` `oursWin`; `renderTrigger` as the pure core with `asChild`; `forcedColors.selectedLeaf`/`selectedContainer`; `dev.ts` on the global registry. Cids: Appendix B.

### F6a-tooling (wave A, parallel to F2)
Dependency installs (runtime `@floating-ui/react-dom`; dev `@tailwindcss/cli`, `@storybook/addon-docs`, `publint`, `@arethetypeswrong/cli`, `@types/node`), version 0.5.0, repository/homepage/bugs, scripts `typecheck` (three programs + `scripts/check-ts-coverage.mjs`), `lint`, `format`, `check:package`; `tsconfig.json` (lib/target ES2022; excludes `src/test-utils*`), `tsconfig.dev.json` (own `exclude`), `tsconfig.node.json`, `scripts/check-ts-coverage.mjs`, `eslint.config.mjs` (no-explicit-any error, `.storybook`/`scripts` linted, react-hooks v7 errors kept), prettier globs, `.gitignore`, `src/env.d.ts`, `src/vitest-axe.d.ts`, `vitest.config.ts` coverage (§3.2, §3.3, §4.3). Fix type errors in F6a-owned files only. Exit: `npx tsc -p tsconfig.json` and `tsconfig.node.json` clean; `tsconfig.dev.json` errors only in P-owned files (listed in the report); `check-ts-coverage` passes. Cids: Appendix B.

### F3-hooks-provider (wave B)
§2.3 hooks and WaveProvider + WaveProvider stories, all with tests: the two-ref `useControllable` with sticky controlled mode; the store-based `useRovingTabIndex` (`tabStop`, nested composites, text-entry keys, author tabindex); `useIsClient`; `useTriggerElement` (merged ref memoised, state ARIA wins, `asChild={false}`, wrapper fallback); `useDirection` document fallback; `useAnnounce` first-use creation; registries on `getGlobalRegistry`. `renderWithProviders` tests are F6t's. Cids: Appendix B.

### F6t-test-infra (wave B)
§4.1, §4.2, §4.4 conventions gate and `test-utils.test.tsx`: shared `axe` instance (`region` disabled), `document.body` default scope, body-empty assertion after cleanup, typed helpers without `any`, `renderWithProviders`, `testNoImplicitSubmit`, `testComposedHandler`, `installResizeObserverMock`, `mockMatchMedia`, `mockRect`; `stories/_helpers.ts` typed (moved from DOCS). The conventions gate runs per file and is expected red until wave D completes. Exit: full `npx vitest run` green except the conventions gate and the §7.5 handoff list. Cids: Appendix B.

### F1-tokens (wave B, after F6a's CLI install)
Rewrite `tokens.css` per §2.1 (prefix, three themes + legacy selectors, derived vars per theme group, ramps with 0.4 fallbacks, z vars, color-scheme on theme classes only, `@theme inline` colors/font/type/shadows/animations+keyframes, no radius/font-sans overrides, revised dark primary and HC selected); add `base.css` (fixed pseudo-element selector, native reset, no portal background), `styles.css` (unlayered, pinned sources, utilities last), `tailwind.css` (tokens `layer(theme)`, base `layer(base)`), `preflight.css`, `legacy-tokens.css` (bidirectional, cycle-free); empty `animations.css`; keep `globals.css` as dev entry; `scripts/build-css.mjs` with the positive and negative assertions of §2.1.1; `tokens.test.ts` with the unrounded contrast table. Cids: Appendix B.

### F4-overlay (wave C)
§2.4 with thorough tests: layer registry on the global registry with parentage-first topmost, `useDismiss` (Escape by focus location, pointerdown snapshot of all outside layers, allow-list inside), element-based bubble-phase `useFocusTrap` with descendant-layer handling and tabbables computed at keydown time (never cached, radio-group tab stops depend on focus, §2.4), insertion-effect `useRestoreFocus` with StrictMode-safe unmount restore, `useScrollLock` (gutter/logical padding), `useModalIsolation`, `useModalLayer`, `usePopupPosition`, `Portal` (`useIsClient`, React-rendered wrapper, `PortalDepthContext`, parent-layer registration). Tests: nested layers Escape, same-commit parent/child, drag-out, nested portal click, click that opens another layer, external toggle, allow-listed toast click, focus-outside, trap edge cases + allow-list + descendant popover links + pre-empting React handler, autoFocus opener capture, StrictMode, stacked scroll locks closed out of order, isolation incl. nested modals and late-added siblings, positioning flip with mocked rects, Portal theme/dir/depth/SSR. Cids: Appendix B.

### F5-listbox-field (wave C)
§2.5 with tests (registration batching and order incl. OptionGroup, `collectOptionLabels` incl. `renderToString`, filtered index space, disabled skipping, all APG keys for both modes incl. button-combobox Enter/Space and closed-Enter submit, typeahead, activedescendant ids stable across filtering and remounts, derived active value on shrink, scrollIntoView, render-count, FieldContext merge rules incl. id mismatch → `aria-labelledby`, HiddenInput FormData/required radio/checkbox/text, positioning, reset without name), plus `src/test-utils-field.tsx` (`renderWithFieldContext`). Cids: Appendix B.

### F6b-pipeline (wave C, after F1)
§3.1, §3.2 (exports, `files`, `build`, `test:pack`, `prepublishOnly`), §3.3 Storybook (`viteFinal` with `@tailwindcss/vite` and without `vite:dts`, `preview.css`, toolbars, autodocs, `a11y.test='error'`), `scripts/verify-dist.mjs` (directives, barrels without directive, react-server import, d.cts, flat names with the `PENDING_FLAT_EXPORTS` bridge and `--final`, Vite-API tree-shake probe), `scripts/pack-smoke.mjs` + fixtures (unlayered CSS, Tailwind fixture), `scripts/verify-storybook.mjs` (every story-only utility of a reference compile, §3.2), their tests in `scripts/__tests__/` (`verify-dist`, `verify-storybook`, `pack-smoke`, `vite-config`), `src/__tests__/stories.a11y.test.tsx` (non-eager, per-file, shared axe). Exit: `npm run build` (library program only), `npm run build-storybook` + verify-storybook, and `npm run test:pack` succeed on the wave-C tree. Cids: Appendix B.

### P01-buttons (Button, CompoundButton, Link, MenuButton, SplitButton, ToggleButton, Toolbar, Text)
- **Stage 1 (wave D0)**: new `buttonStyles.ts` (base/size/appearance/pressed maps with tokens, hover/active gated with `not-disabled:not-aria-disabled:` — never `enabled:` — extra-large > large) and the rewritten `Button.tsx` (polymorphic `ButtonOwnProps`, non-button `as` disabled semantics, icon slot `aria-hidden`, icon-only warning) with tests, including "`<Button as='a'>` carries the gated hover class" and "no class uses `enabled:`". Report when done; the lead freezes the Button API and starts wave D.
- Stage 2 (wave D): the other buttons use `buttonStyles.ts`; shared chevron from F2 icons.
- `type="button"` everywhere (`testNoImplicitSubmit`); non-button `as` disabled semantics; polymorphic typing for Button, CompoundButton, Link, Text, Toolbar.
- Icon slots `aria-hidden`; icon-only dev warning; CompoundButton secondary text full contrast.
- Link: inline always underlined, `appearance` (alias `variant`), disabled omits href + `role="link"` + aria-disabled after rest.
- SplitButton: `menuButtonProps`, `primaryActionButtonProps`, `menuButtonLabel`, 24×24 chevron target, `rounded-s/e`, aria-describedby → primary; testSystemProps.
- ToggleButton functional updater + tests; MenuButton trigger-prop compatibility (§5.2). Controlled tests follow the separate-interactions rule (§2.3): repeated clicks on `pressed={false}` whose parent ignores the callback are separate `userEvent` clicks (or `fireEvent` calls with `await act(async () => {})` between them) and emit `(true)`, `(true)`; two back-to-back `fireEvent.click` calls are one task and emit `(true)`, `(false)`.
- Toolbar: `orientation` prop → `aria-orientation`; `useRovingTabIndex({ itemSelector: 'button, [href], input, select, textarea, [role="button"], [tabindex]', manageTabIndex: true, tabStop: 'last-focused', orientation })` so arbitrary child controls become one tab stop; Left/Right (Up/Down when vertical), Home/End, disabled controls skipped, RTL mirrored. The hook ignores arrows that start in text-entry children (an Input/SearchBox in the toolbar keeps its caret keys), re-stamps via its MutationObserver, and leaves author `tabindex=-1` elements and nested composites alone. Tests: arrows; Input child caret; a child toggling `disabled` by itself; a child with tabindex=-1 inner buttons.
- MenuButton/SplitButton tests use a local stand-in trigger-props object, never P13's Menu (§5.9).
- Text: `weight` TextWeight (numeric alias), tests per variant.
- Stories: Disabled stories (Toggle/Compound/Menu), Text title fix, token colors, icons labelled.

### P02-field-text (Field, Input, Label, Select, Textarea, Slider, SearchBox)
- Field: FieldContext provider; merge-not-overwrite clone of the first element child (§5.1 item 2); `required` → native `required`; asterisk `aria-hidden`; error `role="alert"`; label/hint/error accept ReactNode; ids from useId.
- Input/Select/Textarea: token placeholder, `border-b-stroke-accessible`, `inputFocus`, `error` message (string → Fragment of control + sibling `role="alert"` message with `errorMessageProps`, root/ref/className unchanged; `true` → flag only; nothing when Field renders the error); `onValueChange` (Input); `useFieldControl(props, { nativeRequired: true })`.
- Slider: `onValueChange(number)`; `useFieldControl(props, { nativeRequired: true })`; unfilled rail `bg-stroke-accessible`.
- SearchBox: C-ROUTING (props/controlRef to input), clear refocuses input, 24px clear target, `dismiss: Slot<'span'> | SlotObject<'button'>` rendered inside the wired button (C-SLOTS), clear button named per the C-SLOTS naming bullet (default "Clear search"; a merged button's text label names it; naming attributes of a slot object go to the button), `onValueChange` (alias `onChange`), logical positions, icons from F2.
- Label: size tests, `weight` TextWeight.
- Stories: Select named, Field with Select/Textarea/Slider, Slider/SearchBox Disabled, Label title.

### P03-choice (Checkbox, Switch, RadioGroup, Rating)
- Checkbox/Switch: C-ROUTING (id/aria/onClick to the button; ref stays on label; `controlRef`), `onCheckedChange`, `name/value/required/form` + HiddenInput (checkbox type), stroke-accessible borders, currentColor glyphs, Switch off/on tokens, forced-colors recipes, RTL thumb (`rtl:` translate), `rounded-xs`.
- RadioGroup: DOM-mode roving (Fragments ok, `tabStop: 'active'`), orientation `'both'`, consumer `name` used (no default name; HiddenInput `type="radio"` only with `name`/`required`), `disabled` group prop, RadioItem conventions (ref, displayName, button props spread, `RadioGroup.Item` + flat `RadioGroupItem`, `RadioItem` kept), FieldContext labelledby, `onValueChange`, tests rewritten (Field consumption via `renderWithFieldContext`).
- Rating: roving focus between radios, RTL arrows, hover preview fix, 24px targets at small sizes, `text-rating`/outline stars, HiddenInput, `onValueChange`, no-op suppression, testSystemProps.
- Stories named.

### P04-spin-color (SpinButton, ColorPicker, SwatchPicker)
- SpinButton: draft text model, decimal rounding, APG keys, `tabIndex=-1` step buttons, focus-within indicator, drop hard-coded "Value", C-ROUTING + FieldContext, HiddenInput, `onValueChange`, Disabled/Invalid stories.
- ColorPicker: opacity derived from value, single commit path, draft hex text, `role="group"`, invalid hex feedback, presets via SwatchPicker with `{color,label}` support, `onValueChange`, HiddenInput. New helper file `src/components/input/colorUtils.ts` (hex parse/normalize/alpha, luminance-based check color).
- SwatchPicker: roving `'both'`, selection ring with offset + contrast-picked check glyph, accessible names (no hard-coded "Color picker"), `onValueChange`, HiddenInput, meaningful shape/size tests.

### P05-listbox (Combobox, Dropdown, TagPicker; new `Option.tsx`)
Adopt `useListbox` + popup primitives (§5.4/§5.5): OptionGroup support, highlight==commit, activedescendant, disabled options, APG keys (Dropdown select-only incl. typeahead and button Enter/Space handling; closed Combobox Enter submits the form), no blur timers, Escape layering (stand-in parent layer in tests), label display via registry → `collectOptionLabels` (SSR `renderToString` tests) and draft model (Combobox), closed list inline and hidden / open list portaled, filtering in both modes, derived active value on async changes, scroll-into-view, memoized options, C-CLASS ordering, C-ROUTING/FieldContext (`renderWithFieldContext`), HiddenInput, `onValueChange` (change-only) with `onOptionSelect` still firing on every activation, flat names (`ComboboxOption`… per C-COMPOUND). Wiring follows the §2.5 consumer contract. The combobox element gets `getComboboxProps()` plus `onKeyDown` **and** `onKeyUp`, composed with the consumer's handlers (C-COMPOSE); `onKeyUp` stops the Dropdown `<button>` from re-toggling on the Space keyup click. `Option`/`OptionGroup` are exported through `markListboxElement`. Display text is `getItem(value)?.label ?? collectOptionLabels(children).get(value)`. Combobox and TagPicker pass `onClearDraft` (closed Escape clears the draft; test). The options live in a single container at a time (inline while closed, portaled while open, never both). TagPicker: disabled state, announcements + tag list semantics, `aria-expanded` accuracy, unknown values rendered, Backspace to last visible tag, tokens, logical classes. Tests: axe open/closed, rewritten rest-spread tests, full keyboard matrix; keyed-reorder tests outside `React.StrictMode` (React DEV re-runs the effects of moved fibers there, which hides a missing order check); controlled retries (a rejected value picked again fires again, repeated open/close on a controlled `open` whose parent ignores the callback) follow the separate-interactions rule of §2.3 (`userEvent`, or `await act(async () => {})` between `fireEvent` calls). Stories: titles, names, Invalid stories.

### P06-datetime (DatePicker, TimePicker; new `dateUtils.ts`)
DatePicker: round-trip default parse/format for the `locale` prop + dirty-flag blur (dev warning for `formatDate` without `parseDate`; JSDoc: pass `locale` for SSR), draft text model, calendar keeps `aria-modal` (no isolation), focused day derived during render, controllable `open` + `defaultOpen`, popup primitives (dialog semantics, trap, restore), grid roving focus with visible distinct focus style, APG keys incl. Space/Home/End/Shift+Page and RTL, month clamp, midnight normalization, month live heading + aria-selected/current, Intl locale strings, disabled-while-open, invalid input feedback + `onInvalidInput`, 24px buttons, initial view clamped to range, HiddenInput, C-ROUTING/FieldContext. TimePicker: `useListbox` data mode wired per the §2.5 consumer contract (`getComboboxProps()` plus composed `onKeyDown`/`onKeyUp` on the input, `onClearDraft`, the label from `getItem`, options in a single container at a time), query separate from label, typed commit, step/bounds validation, off-grid labels, `aria-expanded` accuracy, active/selected distinct styles, HiddenInput. Keyboard-heavy tests with fake timers, locale-independent.

### P07-identity (Avatar, AvatarGroup, Persona, PresenceBadge, Image, Badge, CounterBadge)
Tokens (status fills/foregrounds/tints, presence tokens), Avatar image slot forms + load-failure fallback + `role="img"`/name on the **avatar visual element** (not the badge wrapper, so a PresenceBadge sibling keeps its own name; routed consumer ARIA) + badge wrapper as root + whitespace names + `icon: Slot<'span'>` + `decorative`, AvatarGroup `max !== undefined` + group semantics + labelled overflow (F4 popup), Persona decorative avatar, PresenceBadge glyphs + `role="img"`, Image `alt` dev warning + `StrictImageProps` (type stays optional until 1.0), table-driven variant tests, Image story fix, story titles. Test: Avatar with a busy PresenceBadge exposes both "Jane Doe" and "Busy".

### P08-list-tag (Divider, InfoLabel, List, Tag)
Tag: wired dismiss button with slot content (a `<button>` slot is merged, not nested), `aria-labelledby` dismiss name + `dismissLabel` (a merged button's text label replaces `dismissLabel`: "Remove Cherry", C-SLOTS naming bullet), polymorphic typing (`TagOwnProps`), logical classes. Divider: vertical children, single named separator (aria-hidden lines), polymorphic typing. InfoLabel: button trigger + inline hidden description + F4 popup (keyboard focus opens, pointer focus does not, click toggles/pins, hover delay, Escape), no `title`. List: roving single tab stop (`tabStop: 'active'`), action isolation + grid mode when selectable items have actions (text-entry cells take focus on the cell; Enter/F2 enters, Escape returns), functional toggle, `'multiple'` alias, discriminated single/multi props, effective selection derived as selected ∩ registered, composed handlers, memoized context, flat `ListItem`, tests. Stories: titles, names, `fn()`, token buttons.

### P09-disclosure (Accordion, TabList, Tree)
Accordion: real Trigger/Panel components, heading wrapper (`headingLevel`), useId-based ids, single/multiple unions (`openItem`), composed handlers, C-CONTEXT. TabList: registration via context (Fragments/wrappers), useId ids, disabled tabs skipped (store-based, no owner re-render needed), first enabled tab default (derived), `tabStop: 'active'`, RTL, `orientation` + value/onValueChange aliases (`onTabSelect` keeps firing on re-selection), `TabList.Panels` optional, composed handlers, `useMergedRefs`, memo. Tree: treeitem receives ref/rest, group nested inside the treeitem using the existing div elements (ref type unchanged), APG tree keyboard + typeahead with single tab stop (`tabStop: 'active'`), controlled `expandedItems`/`onExpandedItemsChange`, `onItemSelect` (every activation)/`selected`, logical indent and RTL chevron/keys, `icon: Slot<'span'>`. Flat names for Accordion/TabList/Tree members. Tests: populated testSystemProps, keyboard, RTL, two-instance.

### P10-carousel-overflow (Carousel, Overflow)
Overflow: non-mutating measurement, fit check without reserved space, measured more-button width, DOM order, `overflowButton(count, hiddenIds)`, `useOverflowMenu`, `useIsOverflowItemVisible` (story imports them from the module path and shows hidden items in a plain disclosure list; INTEGRATION switches it to Menu), `useIsOverflowing` content observation + late refs, ResizeObserver guard, observer created once, membership-only updates, `useMergedRefs`, layout-mocked tests. Carousel: autoplay stop/timer stability, rotation control + pause on hover/focus + reduced motion + live region off while rotating, inactive slides `inert`+`aria-hidden`, clamped index, dot semantics (buttons + `aria-current`), 24px dots with 3:1 + non-color cue, `aria-disabled` prev/next, RTL translate/mirroring, remove CarouselContext, fake-timer tests.

### P11-primitives (Card, Flex, Grid, Stack, Skeleton, Spinner, ProgressBar)
Card: selectable control semantics with `selectionControl: 'card' | 'checkbox'` ('card': role=button, tabIndex 0, Enter/Space, aria-pressed when `selected` is defined, dev warning if tabbable descendants exist; 'checkbox': built-in checkbox carries the state, root is not a widget, so footer Buttons pass axe `nested-interactive`), events starting inside nested interactive elements ignored in both modes, focus ring, non-color selected cue, composed handlers, remove CardContext, `rounded-md`, polymorphic typing (`CardOwnProps`), flat `CardHeader`/`CardBody`/`CardFooter`. Flex: `shrink` both states, reverse caveat + dev warning. Stack: `orientation` alias. Grid/Stack/Flex polymorphic typing. Skeleton: `shape` alias, aria-hidden before rest, `Skeleton.Group` busy container, token color, reduced motion. Spinner: single render, overridable role, default "Loading" label set in a `requestAnimationFrame` callback after mount (announced; C-HOOKS deferred pattern), ring aria-hidden, `animate-wave-spin` + slow alternate. ProgressBar: clamped value/aria-valuenow, max ≤ 0 guard, naming (visible label option + dev warning), forced-colors fill, reduced-motion full-width pulse, RTL keyframe, token track. Tests with exact `toHaveClass`. Stories: args, tokens, names, titles.

### P12-messages (MessageBar, Toast/Toaster)
MessageBar: wired dismiss with slot content (`Slot<'span'> | SlotObject<'button'>`; a `<button>` element slot is merged into the wired button with a dev warning, never nested), named per the C-SLOTS naming bullet (a lone character is a glyph, not a text label), `type="button"`, status tint tokens, visually hidden status text (`statusLabel`), icons from F2, logical border. Toast: `dispatchToast` returns id + `toastId`, timer cleanup, `ToastController` type, null context + dev error (§7.3), permanent live regions, pause on hover/focus, focus preservation on removal (F3 `usePreserveFocus`: the unmount move runs in a microtask, so unmount-focus assertions `await act(async () => {})` or use `userEvent` before asserting focus — under fake timers, `userEvent` needs `vi.useFakeTimers({ shouldAdvanceTime: true })` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` (with plain `vi.useFakeTimers()` it hangs), and `queueMicrotask` stays real (Vitest does not fake it by default; never add it to `toFake`); the Toaster's `getFallback` runs after the toast, possibly the whole Toaster, is gone and must return `null` rather than throw — `querySelector`, never a throwing lookup), portaled toast layer with `data-wave-focus-trap-allow` (Tab-reachable in modals, inside every dismiss layer, never inerted) and region label, logical positions, memoized context, testSystemProps + fake-timer suite. Stories: `fn()` + state, titles.

### P13-menu-nav (Menu, Breadcrumb, Nav)
Menu: roving (no container tab stop; `tabStop: 'last-focused'` for the static menu), open/trigger API (§5.2, `useTriggerElement`, `anchorRef`), Popover surface, focus ring + focus background, icon slot aria-hidden, composed handlers, `rounded-md`, C-CONTEXT; tests use a plain `<button>` trigger. Nav: explicit `label` for categories, controllable open categories (auto-open selected), anchor/button prop unions + `disabled`, focus ring (gated hover works on anchors), logical indicator/indent, value/onValueChange aliases (`onNavItemSelect` keeps firing on re-selection), `icon: Slot<'span'>`, memo/C-CONTEXT, href tests. Breadcrumb: no-href rendering (button/span), anchor props, mirrored separator, focus ring, placement tests. Stories: args, titles.

### P14-pagination-stepper (Pagination, Stepper)
Pagination: page clamped during render (consumer notified via `onPageChange` from an effect), `aria-disabled` boundary buttons (focus kept, gated hover), `getItemAriaLabel`, focus ring, mirrored chevrons, token current page, exported `getPaginationRange` with table tests, `onPageChange` still fires when the current page is activated (0.4 semantics). Stepper: context registration (Fragments), shared `activate()` guard, root `<div>` kept (ref type unchanged) with an inner `<ol>`/`<li>` list + `aria-current="step"` + status text, `onStepChange` still fires on re-activation, single step body, logical connector (`ms-[15px]`), token circle, `icon: Slot<'span'>`, C-CONTEXT, comment fix, orientation-complete tests.

### P15-modal (Dialog, Drawer)
Portal + F4 `useModalLayer` (layer, trap with allow-list, modal isolation instead of `aria-modal`, restore with trigger/fallback/`finalFocusRef`, ref-counted scroll lock), click-based backdrop dismissal (backdrop outside the content surface), close buttons `type="button"` with `testNoImplicitSubmit`, triggers via `useTriggerElement` (`asChild={false}` opt-out, wrapper fallback test with a non-forwarding child), stand-in layer tests only (§5.9), responsive Dialog sizing (`max-w`, `max-h`, scroll body, `rounded-lg`), `Dialog.Close`, `Dialog.Title`/`Drawer.Title` + unnamed warning, asChild `Dialog.Trigger`, new `Drawer.Trigger`/`Drawer.Close`, logical Drawer positions, DialogFooter outside-Content warning, token backdrop/shadow/close button (via `Button` or tokens), memo/C-CONTEXT, `useMergedRefs`. Tests: open-state axe, focus, nesting, controlled contract, scroll lock. Controlled close paths (`overlays#32`: Escape, outside press/backdrop and Close each call `onOpenChange(false)` once while the parent keeps `open`) follow the separate-interactions rule of §2.3: each close path is a separate `userEvent` action or is followed by `await act(async () => {})`; back-to-back `fireEvent` calls in one task emit `onOpenChange(false)` only once. Stories: args, Start-position Drawer story.

### P16-popups (Popover, Tooltip, TeachingPopover)
Popover: asChild trigger (`useTriggerElement`, opt-out, wrapper fallback), portal + positioning (side/align/arrow), layered dismissal incl. nested portals (stand-in child layer test) and `ignoreOutsideRefs`, focus restore, default `aria-labelledby` from the resolved trigger id, text resets, `rounded-md`, memo/C-CONTEXT. Tooltip: inline always-rendered hidden `role="tooltip"` description + visual surface portaled only while visible (`aria-hidden`), merged permanent describedby, `relationship`, timer fix, Escape layer + hoverable bridge, flip/shift + wrapping, text resets, `appearance` alias, non-element children fallback, fake-timer tests. TeachingPopover: controllable `open`, `activeStep` alias, clamped index, persistent Back, focus save/restore, step announcements + "Step n of m", optional `target` anchoring with beak, `Button` actions, token colors, `useMergedRefs`. Controlled close-path tests (`overlays#32`) follow the separate-interactions rule of §2.3 (`userEvent`, or `await act(async () => {})` between `fireEvent` calls). Stories: `fn()`, LastStep dismissible, Normal tooltip story.

### P17-table (DataGrid, Table)
DataGrid: APG grid keyboard (new `useGridNavigation.ts`; text-entry widgets are never auto-targeted — the cell takes focus, Enter/F2 enters, Escape returns, arrows inside an edited input move the caret), header from `columns`, selection header cell + working select-all, row selection labels + radio group names + missing rowId handling, sortable header button, overflow-x wrapper + `containerProps` (focusable region only for Table, never for DataGrid), `aria-multiselectable`, effective selection derived as selected ∩ registered, stable callbacks, split sort/selection contexts with per-row subscription, array selection API + `sort` object (aliases), `accent-primary`, C-CONTEXT, composed handlers. Table: `Header`/`HeaderCell` (aliases), CSS striping without context, overflow wrapper. Tests: second sortable column, keyboard, controlled modes, header/cell alignment, composition, render counts. Stories: args, sorted data, no `&nbsp;` header.

### INTEGRATION (wave E1, then the final gate E3)
Runs alone after wave D and **owns every file** while it runs (§7.1.4). Prefers re-dispatching substantive fixes to the owning P/F agent (re-dispatch loop, §7.1.4) and makes only minimal seam edits itself, listing every non-owned file it touched.
- Barrels (§5.11) incl. flat compound names, and empty `PENDING_FLAT_EXPORTS` in `scripts/verify-dist.mjs` as the flat names land (verify-dist fails an entry whose flat names all exist, so the list only shrinks; `node scripts/verify-dist.mjs --final` passes only once the list is empty); header comments; normalise story/test imports of new symbols from module paths back to `'../src'`.
- `src/__tests__/integration.test.tsx` with every composition of the §5.9 table: Menu.Trigger/Popover + MenuButton and SplitButton render-prop; Tooltip > Dialog.Trigger > Button; the real Field around every P03–P06 control and Field > Tooltip > Input with its own id; Tooltip inside Overflow, Table, Card and an open Drawer renders in the portal root; real timeout:0 Toast inside an open Dialog (Tab reachable, not inert, keyboard and mouse dismiss without closing the Dialog); Dialog opened from Popover.Content stays open; Escape in a Dropdown inside a Dialog closes only the listbox. Switch the Overflow story to Menu (`layout#4`).
- Resolve seam breakages, then hand over to DOCS; after DOCS, run the final gate (§7.2). Cids: Appendix B.

### DOCS (wave E2, after INTEGRATION, against the final API)
README (installation for precompiled vs Tailwind entries — Tailwind users import `./tailwind`, never `./styles`; WaveProvider required for `./styles`; cascade note: unlayered, `@import url(...) layer(wave)` to layer it; browser baseline; Preflight opt-in; theming with `--wave-*` token tables per theme generated from `tokens.css`; 0.4 ramp overrides still work, semantic overrides need `legacy-tokens.css`; "Global effects" section with the provider-scoped reset and **every colliding utility name** from §7.4 plus workarounds; RSC section: flat sub-component names from Server Components; keyboard support per component as implemented; sorting is controlled; Combobox wording; Toaster wraps app; `error` prop renders a message; no test counts), CLAUDE.md (conventions C-* summary incl. C-HOOKS and C-COMPOUND, FieldContext and HiddenInput patterns, naming rule and callback semantics, no test counts, the three tsconfig programs), CHANGELOG `## [0.5.0]` (Added/Changed/Deprecated/Fixed/Security-none + migration table from §1 C-NAMING + every §7.3 item + package rename note + CSS variable migration step), `docs/WAVE-UI-GUIDE.md` (lines 17, 487, 496-498, 507, 536, 560-600, 606-616, 695, 737, 806-808, 831-832, 933-953, 1095, the Toaster sibling example, and all keyboard claims), `docs/testing-best-practices.md` (pre-0.4 research banner + pointer to `test-utils.ts`). `stories/_helpers.ts` moved to F6t. Cids: Appendix B.

---

## 7. Execution, compatibility and test changes

### 7.1 Order, gates and coordination

#### 7.1.1 Waves
| Wave | Packages (parallel inside a wave) | Depends on |
|---|---|---|
| A | F2-lib, F6a-tooling | — |
| B | F3-hooks-provider, F6t-test-infra, F1-tokens | F3: F2, F6a (ES2022 lib) · F6t: F2 (`dev.ts`), F6a · F1: F6a (`@tailwindcss/cli`) |
| C | F4-overlay, F5-listbox-field, F6b-pipeline | F4: F2, F3, F6a (`@floating-ui/react-dom`) · F5: F2, F3 · F6b: F1, F3, F6a, F6t (shared axe) |
| D0 | P01-buttons stage 1 (`Button.tsx`, `buttonStyles.ts`, their tests) | all F |
| D | P01 (stage 2) and P02 … P17 | D0 (Button API frozen) |
| E1 | INTEGRATION (owns every file) | all P |
| E2 | DOCS | E1 |
| E3 | INTEGRATION: final gate (§7.2) | E2 |

P06 and P16 carry the most cids; the lead dispatches them first in wave D.

#### 7.1.2 Exit criteria (checked by the lead before the next wave starts)
- The package's own tests, type check (own paths) and lint pass (§0.2 rule 8).
- **Full `npx vitest run` is green** except (a) `src/__tests__/conventions.test.ts` and `src/__tests__/stories.a11y.test.tsx` (red until wave D completes, per file), and (b) the tests listed in the §7.5 handoff table with a named P owner. Every other failure caused by a foundation change is fixed by that foundation package, or — if it is an intentional behaviour change — added to §7.5 by the lead with its P owner before the next wave starts.
- Wave C additionally: `npm run build` (library program only), `npm run build-storybook` + `verify-storybook`, `npm run test:pack` succeed.
- Wave D: every P package green on its own files; the lead then runs the full suite and hands the result to INTEGRATION.

#### 7.1.3 Foundation change requests during wave D
Foundation owners (F2, F3, F4, F5, F6t, and P01 for the frozen Button API) stay on standby during waves D0–D. A P agent that needs a foundation change files a request with the lead: the failing test (as a snippet), the file and the proposed API. Requests are serialized per foundation file; the foundation owner lands the change with tests, the lead commits it and notifies every consumer package listed in Appendix B for that owner. P agents never fork or re-implement foundation code locally (§0.2 rule 10); while a request is pending they continue with other tasks.

#### 7.1.4 Ownership after wave D and the re-dispatch loop
When wave D ends, ownership of **all** files transfers to INTEGRATION, which runs alone. For a failure in a P- or F-owned file, INTEGRATION re-dispatches the fix to the original owner agent (with the failing command and output) whenever it is more than a seam adjustment (import path, export name, type mismatch across a contract); it edits the file itself only for seam adjustments and lists each touched file in its report. DOCS runs after INTEGRATION so it documents the final API; the final gate runs last.

#### 7.1.5 Checkpoints and shared-tree safety
The lead commits (never agents) after each foundation package and after each P package lands, staging only that package's files, so there is a rollback point per package and failures can be bisected; tags `review-fix/wave-A` … `review-fix/wave-E3` mark wave ends. Agents obey §0.2 rule 9 (no git writes, no installs, no repo-wide `--fix`/`--write`).

### 7.2 Final gate (INTEGRATION, wave E3)
`npm ci` → `npm run typecheck` (three programs + ts-coverage check) → `npm run lint` → `npm run format:check` → `npm test` (includes the conventions and stories axe gates) → `npm run test:coverage` thresholds → `npm run build` (vite + CSS + verify-dist) → `node scripts/verify-dist.mjs --final` (the lenient check in `npm run build` passes while `PENDING_FLAT_EXPORTS` is not empty; `--final` does not) → `npm run check:package` → `npm run test:pack` → `npm run build-storybook` + `node scripts/verify-storybook.mjs` → manual per-theme contrast check in the Storybook a11y panel (light, dark, high contrast; §4.5) recorded in the report. Grep that no story/test still uses deprecated names except the dedicated alias tests.

### 7.3 Backward-compatibility notes (CHANGELOG "Changed")
- **Styles**: `./styles` now points to precompiled, unlayered `dist/styles.css` (works without Tailwind; no Preflight; requires WaveProvider for the scoped base and native-element reset). Tailwind users import `./tailwind`. Preflight is opt-in (`./preflight.css`). CSS variables are `--wave-*`. Overrides of the 0.4 ramp names (`--brand-*`, `--grey-*`) keep working (read as fallbacks). **Overrides of the 0.4 semantic names (`--primary`, `--background`, `--border`, …) no longer affect Wave unless `./legacy-tokens.css` is imported** (deprecated compatibility layer; migration step: rename overrides to `--wave-*`). Theme classes `wave-light/wave-dark/wave-high-contrast` (legacy `dark`/`high-contrast` still emitted and honoured). `color-scheme` is set on theme classes only. The library no longer overrides Tailwind radius or `font-sans`; Wave components use Tailwind default radius names (visual values unchanged). `muted-foreground` darkens to #616161 (contrast). Dark theme: primary is brand-110 #62abf5 (was #479ef5); primary/destructive/status fills use black foreground text; dark destructive/error is #f48a94; dark success is #5db55d (was #54b054). High contrast: `selected` is #003a40 with white text (was #1aebff); destructive/error is #ff6e6e (was #ff6060). Pressed subtle controls use `subtle-pressed`, #ebebeb in light (0.4 hard-coded #e0e0e0), the same grey as `subtle-selected` (text contrast, §2.1.3 text matrix). **Button** (0.4 put `min-w-[96px]` on every Button): an icon-only Button (an `icon` and no label) is square (height = width, no horizontal padding) with no minimum width; a labelled Button keeps a minimum width, now written `min-w-24` (6rem: 96px at the default 16px root font size, and it follows the root font size). Every appearance draws a 1px border (`primary`, `subtle` and `transparent` use `border-transparent`; 0.4 drew one only on `outline`), so content-sized Buttons of those three appearances are 2px wider than in 0.4, and also 2px taller where box-sizing is not `border-box` (outside WaveProvider's scoped reset and without Preflight). Labels follow the type ramp (10/12/14/16/18px); `extra-large` is 18px (0.4: 14px, smaller than `large`). Hover and pressed colors are gated (`not-disabled:not-aria-disabled:hover:` / `not-disabled:not-aria-disabled:active:`), which gives them a higher specificity than a bare `hover:` class: a `className` override uses the same gate prefix (`not-disabled:not-aria-disabled:hover:bg-error`, which replaces the built-in class) or the important modifier (`hover:bg-error!`); a bare `hover:bg-error` no longer wins as it did in 0.4. `Button as="a"` shows no link underline (`no-underline`; the `transparent` appearance still underlines on hover).
- **Behaviour**: WaveProvider paints background/foreground/font. `Dialog.Trigger`/`Popover.Trigger` no longer render a wrapper `<span>` by default (props/className merge onto the child); `asChild={false}` restores the span, and a child that does not forward `ref` falls back to the span automatically with a dev warning. Dialog and Drawer drop `aria-modal="true"` and make the rest of the page `inert` while open (toasts and live regions stay available). Popover, the Tooltip visual, listboxes (while open) and the calendar render in a portal. Tooltip always renders a hidden inline description element and keeps `aria-describedby`. Boundary buttons in Pagination and Carousel use `aria-disabled` instead of `disabled`. Carousel dots are buttons with `aria-current` (no tab roles). DataGrid rows are no longer individual tab stops (grid navigation). Menu container is no longer a tab stop. List options use roving tab index. Checkbox/Switch `onClick` now fires on the control once. Composite controls route id/aria-* to the focusable element (`ref` unchanged; new `controlRef`). Value callbacks (`onValueChange`, `onCheckedChange`, `onOpenChange`) skip no-op changes; event-named callbacks (`onTabSelect`, `onNavItemSelect`, `onOptionSelect`, `onPageChange`, `onStepChange`) still fire on every activation; the deprecated `onChange(value)`/`onChange(checked)` aliases are change-only like their replacements, so choosing the current radio or star again and pressing a Rating key at an end no longer emit. Rating cannot be cleared to 0 by keyboard: Left/Down stop at 1 star (APG radio group; 0.4 went down to 0 and emitted `onChange(0)`). A controlled `value={0}` (or a form reset to a `defaultValue` of 0) still clears it. A controlled value that becomes `undefined` now clears to the component's empty value (0.4 ignored it or crashed). Field no longer overwrites child `id`/`aria-describedby`/`aria-invalid`, and merges only into its first element child (0.4 cloned every element child and gave each the same id). It leaves a Fragment and a role-less or presentational `div`/`span` wrapper alone (the library control inside is labelled through `FieldContext`); a first child with an explicit widget role (`<div role="radiogroup">`) is named through `aria-labelledby` and no longer receives the id. It no longer puts `aria-required` on a `button`, `meter`, `output`, `progress`, button-type `<input>` or role-less custom element, or on an element whose explicit role does not support it. With `required`, Field now also sets the native `required` attribute on an `<input>` (not button types), `<select>` or `<textarea>` child and on the library Input, Select, Textarea, Slider, SpinButton and SearchBox, so browser constraint validation blocks submitting the form while the field is empty (0.4 set only `aria-required`). The choice and picker controls inside a required Field (Checkbox, Switch, RadioGroup, Rating, SwatchPicker, ColorPicker, Combobox, Dropdown, TagPicker, DatePicker, TimePicker) render their `HiddenInput` as a required input even without `name` (`required ?? field.required`), so the form does not submit until the control is checked, switched on or has a value (`<Field required><Switch/></Field>` blocks the submit while the switch is off); migration: `noValidate` on forms that validate in their submit handler. PresenceBadge is `role="img"` (0.4: `role="status"`, an implicit live region). AvatarGroup is `role="group"` (development warning without a name), and its overflow `+N` is a `<button>` named "N more" (a new tab stop) that opens a portaled `role="dialog"` popup listing the hidden members (0.4: plain text in a `<span>`). Spinner default name "Loading". TabList selects its first enabled tab when uncontrolled without a default. DatePicker default display format is `Intl.DateTimeFormat(locale, { year: numeric, month: 2-digit, day: 2-digit })` (round-trips with the default parser). **TimePicker**: a complete typed time activates its own option, not an earlier option that merely contains the text (`2:00 PM` commits `14:00`, not `12:00`); Enter or leaving the field commits a complete typed time within the bounds (0.4 discarded it); erasing the text and pressing Enter or leaving the field clears the value (`onValueChange('')`), as DatePicker does (`onValueChange(null)`). `useToastController` outside `<Toaster>` throws in development (the 0.4 guide showed a sibling setup; wrap the app in `<Toaster>`). `<Input|Select|Textarea error="text">` now renders the message as a sibling `role="alert"` element after the control (pass `error={true}` for the flag-only look; inside a Field nothing changes). Input, Select, Textarea and SearchBox show the error border whenever the control ends up `aria-invalid="true"`, which includes an `error` on the surrounding Field or the consumer's own `aria-invalid`, not only with their own `error` prop (0.4 drew it only for `error`; SearchBox never). SearchBox routes `readOnly` and the other native input attributes to its `<input>` (0.4 left them on the wrapper `<div>`, so the input stayed editable), and a read-only SearchBox renders no clear button. SearchBox `dismiss` content that renders nothing (`false`, `true`, `''`, `[]`, or a Fragment of those) shows the default clear icon (0.4 rendered an empty clear button). **ColorPicker**: the hex text is a draft. Complete 6- and 8-digit values apply while typing (6 digits keep the current opacity). `#rgb`/`#rgba` apply on blur or Enter (`#rgb` keeps the current opacity). Surrounding whitespace is dropped. Invalid text is no longer reverted on blur (0.4 discarded it silently): it is kept and flagged (`aria-invalid` plus the `hexError` description) and never reaches `onValueChange`. It stays flagged until it is corrected or cleared, or the value changes elsewhere (a preset, the opacity slider, the parent, a form reset). Meanwhile the form submits the last applied color. Enter still submits the form, with the color just applied. **Dismiss/clear button names** (C-SLOTS naming bullet, WCAG 2.5.3): a `<button>`/`Button` passed as MessageBar `dismiss`, SearchBox `dismiss` or Tag `dismissIcon` that renders a text label (at least two letters or digits, text from child components included) is named by that text: MessageBar and SearchBox drop their default name (MessageBar as in 0.4; SearchBox 0.4 always said "Clear search"), and Tag says the text plus the tag content ("Remove Cherry" instead of "Dismiss Cherry"). An icon or a lone character (`X`, `×`) keeps "Dismiss", "Clear search" or "Dismiss Cherry" (0.4 MessageBar named a `<button>X</button>` "X"). Text hidden only by CSS still counts as the label, so give such buttons an explicit `aria-label`. An `aria-label`, `aria-labelledby` or `title` on a SearchBox slot object now names the clear button (0.4 put it on the hidden content). **TagPicker**: Backspace in the empty input moves focus to the last tag, and a second Backspace (or Delete) removes it (0.4 removed the last tag at once). Additions and removals are announced ("Apple added, 2 selected"). **Button**: the `type="button"` default of a native `<button>` and the `role="button"`/`tabIndex={0}` defaults of a non-interactive `as` also apply when the prop is passed as `undefined` or `null` (a wrapper that forwards `type={type}` no longer drops `type="button"` and submits its form). A non-interactive intrinsic `as` (`div`, `span`, …) gets `role="button"`, a tab stop and Enter (keydown) / Space (keyup) activation. `disabled` reaches the element as the native attribute only for `button`, `input`, `select` and `textarea`; every other `as` — `a`, `div`, `span` and any custom component, including router links and styled/motion components that render a native `<button>` (0.4 passed `disabled` through to them) — gets `aria-disabled="true"` and `tabIndex={-1}` (after the rest props, so a consumer value cannot re-enable it), its click is prevented and stopped (ancestor `onClick` handlers do not run, as with a native disabled button), Enter/Space do nothing, and an `<a>` drops its `href` and keeps `role="link"`. A consumer `aria-disabled` shows the disabled look and suppresses hover/pressed colors, but the Button stays focusable and its handlers still run (the consumer guards them, C-DISABLED). The `icon` slot renders with `aria-hidden="true"` (a slot object can override it), so icon text or emoji is no longer part of the accessible name; an icon-only Button without `aria-label`, `aria-labelledby` or `title` logs a development warning (once).
- **DOM structure**: Avatar with `badge`: `ref`, `className` and rest props now land on the outer wrapper; `role="img"` and the name stay on the avatar visual. `Tree.Item`: `ref`/rest move from the role-less wrapper to the `role="treeitem"` element (still a `div`), and the child group is nested inside it. Stepper keeps its root `<div>` and adds an inner `<ol>`/`<li>` list. Combobox/Dropdown/TagPicker render their hidden option list inline while closed. `OptionGroup` (`Combobox.OptionGroup`, `Dropdown.OptionGroup`, flat `ComboboxOptionGroup`/`DropdownOptionGroup`) renders `<li role="presentation">`, which carries `ref`, `className` and rest props, containing the label `<div role="presentation" id>` and a `<ul role="group" aria-labelledby>` of the options (§5.5, required by the listbox structure). 0.4 rendered `<div role="group" aria-label={label}>` with ref/className/rest on that div; the group is now named through `aria-labelledby`, not `aria-label`. TagPicker renders its tags as a `role="list"` named "Selected", and while tags exist the input is described by a hidden summary ("Selected: Apple, Banana").
- **Types**: `SearchBox.dismiss`, `MessageBar.dismiss` and `Tag.dismissIcon` are `Slot<'span'> | SlotObject<'button'>` (the 0.4 button-object form still compiles, deprecated). `SlotObject` widened. Polymorphic components now type-check `as`-specific props. `Image.alt` stays optional (dev warning); `StrictImageProps` is exported for apps that want it required. `OptionGroupProps` extends `React.LiHTMLAttributes<HTMLLIElement>` and its `ref` is `React.Ref<HTMLLIElement>` (0.4: `React.HTMLAttributes<HTMLDivElement>` and a div ref), so passing a `RefObject<HTMLDivElement>` to `OptionGroup` is a type error.
- **Additive**: flat sub-component exports (`CardHeader`, `DialogTrigger`, …) for React Server Components.
- **Deprecated** (warn once, removal in 1.0): the whole C-NAMING table, `legacy-tokens.css`, the button-object form of dismiss slots.

### 7.4 Wont-fix and reconciliations
One **formal partial wont-fix** (policy: justified by a direct contradiction with a required constraint):
- **`repo-level#7` — utility-name collisions.** Implemented: prefixed runtime variables and theme classes, no radius/font overrides, scoped base and reset, no global reduced-motion override, opt-in Preflight, `color-scheme` on theme classes only, no Tailwind theme variables in `dist/styles.css`, 0.4 ramp overrides kept working. Not implemented: namespacing the Tailwind color utilities. The Wave `@theme` maps `--color-{background, foreground, card, card-foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, destructive-foreground, border, input, ring}` — the same names shadcn/ui uses — plus `success, warning, error, severe, info, subtle, …`. In a shared Tailwind build (`./tailwind`), or next to another stylesheet that defines the same class names, `bg-primary`, `text-muted-foreground`, `border-border`, `ring-ring` (and every `bg-/text-/border-/ring-/outline-/fill-/stroke-/accent-/divide-/placeholder-/from-/via-/to-` utility of those names) resolve to one definition. Justification: those utility names are the documented 0.4 public vocabulary used in consumer code and in `className` overrides of Wave components; renaming them contradicts the backward-compatibility policy (no removals) and would rewrite every class string in 65 components. Workarounds documented by DOCS: apps with another design system build their own Tailwind with `prefix(tw)` (Tailwind v4), so their utilities become `tw:bg-primary` and cannot collide, and import Wave's precompiled `./styles` into a cascade layer below their utilities (`@layer theme, base, wave, components, utilities; @import 'tailwindcss' prefix(tw); @import '@mortenbrudvik/waveui/styles.css' layer(wave);`), because the unlayered `./styles` would otherwise beat the app's layered utilities inside the provider (verified in a real Tailwind 4.2.2 build, wave E2); never import `legacy-tokens.css` in apps with shadcn-style variables. Namespaced utilities are an open question for 1.0.

Reconciled decisions (no wont-fix):
- `overlays#14` vs `overlays#18`: both implemented; the "attribute reverts after unhover" expectation of #14 becomes "the child's own ids are preserved and the tooltip id stays attached to an always-present hidden tooltip description" (permanent description is what #18 requires).
- `table-core#10` / `table-core#21`: APG grid implemented (not role removal), so `aria-multiselectable` applies. Text-entry widgets are never auto-targeted by the grid (they would lose their caret keys).
- `data-display#2`: selectable lists containing actions switch to grid semantics (same text-entry rule); listbox kept otherwise.
- `layout#19`: discriminated unions added while legacy props remain accepted (dev warnings on contradictory states) because of the back-compat policy.
- `layout#35`: a selectable Card is `role="button"` only without interactive content; with actions it uses the built-in checkbox (`selectionControl="checkbox"`) — the finding allows "or render an inner control".
- `data-display#28`: the cluster asks for a required `alt` type. Making a previously optional prop required is a compile-time break for every consumer that omits `alt`, which the backward-compatibility policy rules out for 0.5; the failure the finding describes (a missing alt going unnoticed) is fixed with a development warning, JSDoc, and an exported `StrictImageProps` for apps that want the compile-time check now. The type-level requirement moves to 1.0. (`feedback-navigation#17` likewise uses a dev warning, which the issue allows.)
- `input-datetime#6`: the calendar keeps `aria-modal="true"` as the finding asks; Dialog/Drawer instead use modal isolation (§5.8), because `aria-modal` hides the body-level toast and live regions from screen readers (`feedback-navigation#50`).
- `input-basic#12`: the finding mentions "the consumer's name or the generated one"; a generated default name would add an unexpected field to every existing form, so a hidden input is rendered only with a consumer `name` or `required` (validation and reset do not need a name).
- `feedback-navigation#38`: list semantics via an inner `<ol>` inside the kept root `<div>` (ref type unchanged) rather than turning the root into `<ol>`; the finding's requirement is the list semantics, which both shapes provide.
- Intentionally not assigned to a mechanically-listed package: `table-core#30` (TabList needs no change; hook fix only), `input-datetime#2` (Popover is only cited as a reference), `data-display#1` (SearchBox handled by `feedback-navigation#1`), `overlays#34` (RadioGroup already throws), `overlays#36` (Overflow/Table/Card render no popups; INTEGRATION verifies).

### 7.5 Existing tests expected to change (update, do not delete)
This table doubles as the **handoff list** of §7.1.2: a listed test may be red between the foundation change that breaks it and the named owner's wave-D update. Measured so far: the `useControllable` rewrite turns the 2 Rating bounds tests (`Rating.test.tsx` 78-96) red → P03; with the shared axe configuration (`region` disabled) the switch of `testA11y` to `document.body` is expected to add no failures (the 38 `region` failures measured by the execution critique came from the default rule set). Foundation packages append any further measured breakage here (via the lead) with the owning package.

**Separate interactions (applies to every updated controlled test).** Consumer tests of repeated interactions on a controlled component whose parent ignores the callback must separate the interactions with `userEvent`, or with `await act(async () => {})` between `fireEvent` calls. Back-to-back synchronous `fireEvent` calls run in one task, and the per-event pending value of `useControllable` (cleared in a microtask, §2.3) makes them chain like uncontrolled mode: two `fireEvent.click` calls on `<ToggleButton pressed={false}>` emit `(true)`, `(false)`, not `(true)`, `(true)`. Escape, outside press and Close likewise each call `onOpenChange(false)` only when they are separate tasks. Similarly, the focus move `usePreserveFocus` makes on unmount (Toast removal) runs in a microtask, so it is asserted only after `await act(async () => {})` or a `userEvent` action.

| Test file | Change |
|---|---|
| `button/__tests__/Button.test.tsx` | subtle/transparent substring tests → per-appearance token `toHaveClass`; polymorphic type tests |
| `button/__tests__/ToggleButton.test.tsx` | a11y variant `checked` → `pressed`; controlled tests (separate interactions, above) |
| `button/__tests__/SplitButton.test.tsx` | hand-written ref/className tests → `testSystemProps`; query by name |
| `button/__tests__/MenuButton.test.tsx`, `Link.test.tsx`, `CompoundButton.test.tsx`, `Toolbar.test.tsx` | expanded=false, menuIcon exclusivity, disabled link navigation, `as` disabled, roving toolbar |
| `typography/__tests__/Text.test.tsx` | variant class assertions, weight vocabulary |
| `input/__tests__/Field.test.tsx` | tests without `htmlFor`, merge semantics, aria-required, alert |
| `input/__tests__/SearchBox.test.tsx`, `SpinButton.test.tsx`, `DatePicker.test.tsx`, `TimePicker.test.tsx`, `ColorPicker.test.tsx` | `testSystemProps` `control` option: aria-label asserted on the control (was the wrapper) |
| `input/__tests__/Dropdown.test.tsx` (104-111), `Combobox.test.tsx` (93-100) | rest-spread aria-label → `getByRole('combobox', { name })` |
| `input/__tests__/Checkbox.test.tsx`, `Switch.test.tsx` | label-span class query → accessible name; drop role tautology; `onCheckedChange` |
| `input/__tests__/RadioGroup.test.tsx` | defaultProps with items, real variants, tautological disabled test replaced, arrow tests assert selection |
| `input/__tests__/Rating.test.tsx` (78-96) | bounds no longer emit onChange; testSystemProps |
| `input/__tests__/Label.test.tsx`, `SwatchPicker.test.tsx`, `TagPicker.test.tsx` | observable assertions; aria-controls value; activedescendant |
| `data-display/__tests__/Badge|Avatar|Image|PresenceBadge|CounterBadge|AvatarGroup.test.tsx` | presence-only it.each → class/attribute assertions; Avatar test cast removed |
| `data-display/__tests__/Tag.test.tsx`, `List.test.tsx`, `Divider.test.tsx`, `Persona.test.tsx`, `InfoLabel.test.tsx` | dismissIcon click, roving/tab stops, action isolation, separator naming, InfoLabel button |
| `layout/__tests__/TabList.test.tsx` (157-171), `Accordion.test.tsx` | literal ids → relationship assertions; populated testSystemProps |
| `layout/__tests__/Overflow.test.tsx`, `Carousel.test.tsx`, `Tree.test.tsx`, `Card.test.tsx`, `Flex.test.tsx`, `Stack.test.tsx` | layout mocks; dots/aria-disabled; keyboard; exact classes |
| `feedback/__tests__/Toast.test.tsx`, `MessageBar.test.tsx`, `Spinner.test.tsx`, `Skeleton.test.tsx`, `ProgressBar.test.tsx` | live regions, status tables, fake timers, dismiss slot, role/label defaults |
| `navigation/__tests__/Menu.test.tsx` | container tabIndex=0 → roving first item |
| `navigation/__tests__/Pagination.test.tsx` | boundary `toBeDisabled` → `aria-disabled`; range table |
| `navigation/__tests__/Stepper.test.tsx` (fixture 7-13, 83) | Fragment fixture → direct children; count asserts → per-step state |
| `navigation/__tests__/Nav.test.tsx`, `Breadcrumb.test.tsx` | aria-expanded after toggle; separator placement |
| `overlays/__tests__/Popover.test.tsx` (122-135) | aria-expanded on the button (not the span); portal queries via `screen` |
| `overlays/__tests__/Tooltip.test.tsx` (77-90) | permanent merged describedby via the hidden inline description (`toHaveAccessibleDescription`); visual surface assertions via `data-wave-tooltip-surface`; fake-timer delay tests |
| `layout/__tests__/Tree.test.tsx`, `data-display/__tests__/Avatar.test.tsx`, `navigation/__tests__/Stepper.test.tsx` | ref/rest now on the treeitem; ref/className on the badge wrapper with the name on the visual; inner `<ol>` structure |
| `input/__tests__/Input.test.tsx`, `Select.test.tsx`, `Textarea.test.tsx` | `error` string renders a sibling alert message linked by `aria-describedby`/`aria-errormessage` |
| `overlays/__tests__/Dialog.test.tsx`, `Drawer.test.tsx` (any `aria-modal` assertion) | `aria-modal` absent; background `inert` while open |
| `layout/__tests__/Card.test.tsx` | Clickable card: role=button/keyboard; `selectionControl="checkbox"` variant |
| `overlays/__tests__/TeachingPopover.test.tsx` (115-116, 130) | hex-class dot asserts → aria/labels; Escape without manual focus |
| `overlays/__tests__/Dialog.test.tsx`, `Drawer.test.tsx` | backdrop tests via pointer sequence; portal queries |
| `table/__tests__/DataGrid.test.tsx`, `Table.test.tsx` | row tabIndex/Enter-toggle expectations → grid navigation; header counts |
| `hooks/__tests__/useControllable.test.ts` (41-50), `useRovingTabIndex.test.tsx` (harness 11) | mode-switch warning asserted on the `warnOnce` message text (one string per direction: the `[WaveUI] ` prefix and the correct direction substring are present and the reverse is absent, §2.3; not console arguments, because F2 `warnOnce(key, message)` passes none), spy restored; sticky controlled mode (value → undefined returns the default argument); harness forwards options only when set; `tabStop` default `'active'` |
| `lib/__tests__/cn.test.ts`, `slot.test.ts` | custom scale merges; conflicting-class merges |
| `provider/__tests__/WaveProvider.test.tsx` | class names `wave-*`, no warning for valid themes |

---

## 8. Foundation file ownership (disjoint)

| Package | Wave | Files (existing and new) |
|---|---|---|
| F2-lib | A | `src/lib/cn.ts`, `src/lib/slot.ts`, `src/lib/types.ts`, `src/lib/composeEventHandlers.ts`*, `src/lib/mergeRefs.ts`*, `src/lib/mergeProps.ts`*, `src/lib/renderTrigger.tsx`*, `src/lib/polymorphic.ts`*, `src/lib/icons.tsx`*, `src/lib/dev.ts`*, `src/lib/focus.ts`*, `src/lib/direction.ts`*, `src/lib/styles.ts`*, `src/lib/aria.ts`*, `src/lib/globalRegistry.ts`*, `src/lib/labelInName.ts`* (wave D change request), `src/lib/__tests__/labelInName.test.ts`* (wave D change request), `src/lib/__tests__/cn.test.ts`, `src/lib/__tests__/slot.test.ts`, `src/lib/__tests__/composeEventHandlers.test.ts`*, `src/lib/__tests__/mergeRefs.test.ts`*, `src/lib/__tests__/mergeProps.test.ts`*, `src/lib/__tests__/renderTrigger.test.tsx`*, `src/lib/__tests__/polymorphic.test.ts`*, `src/lib/__tests__/icons.test.tsx`*, `src/lib/__tests__/dev.test.ts`*, `src/lib/__tests__/focus.test.ts`*, `src/lib/__tests__/direction.test.ts`*, `src/lib/__tests__/aria.test.ts`*, `src/lib/__tests__/globalRegistry.test.ts`*, `src/lib/__tests__/styles.test.ts`*, `src/lib/__tests__/types.test.ts`* |
| F6a-tooling | A | `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.dev.json`*, `tsconfig.node.json`*, `scripts/check-ts-coverage.mjs`*, `scripts/__tests__/check-ts-coverage.test.mjs`*, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `src/env.d.ts`, `src/vitest-axe.d.ts`*, `vitest.config.ts` |
| F3-hooks-provider | B | `src/hooks/useControllable.ts`, `src/hooks/useEventCallback.ts`, `src/hooks/useId.ts`, `src/hooks/useRovingTabIndex.ts`, `src/hooks/useMergedRefs.ts`*, `src/hooks/useAnnounce.ts`*, `src/hooks/usePrefersReducedMotion.ts`*, `src/hooks/useDirection.ts`*, `src/hooks/usePreserveFocus.ts`*, `src/hooks/useTypeahead.ts`*, `src/hooks/useIsClient.ts`*, `src/hooks/useTriggerElement.tsx`*, `src/hooks/__tests__/useControllable.test.ts`, `src/hooks/__tests__/useEventCallback.test.ts`, `src/hooks/__tests__/useId.test.ts`, `src/hooks/__tests__/useRovingTabIndex.test.tsx`, `src/hooks/__tests__/useMergedRefs.test.tsx`*, `src/hooks/__tests__/useAnnounce.test.tsx`*, `src/hooks/__tests__/usePrefersReducedMotion.test.tsx`*, `src/hooks/__tests__/useDirection.test.tsx`*, `src/hooks/__tests__/usePreserveFocus.test.tsx`*, `src/hooks/__tests__/useTypeahead.test.tsx`*, `src/hooks/__tests__/useIsClient.test.tsx`*, `src/hooks/__tests__/useTriggerElement.test.tsx`*, `src/components/provider/WaveProvider.tsx`, `src/components/provider/__tests__/WaveProvider.test.tsx`, `stories/WaveProvider.stories.tsx` |
| F6t-test-infra | B | `src/test-utils.ts`, `src/test-setup.ts`, `src/__tests__/test-utils.test.tsx`*, `src/__tests__/conventions.test.ts`*, `stories/_helpers.ts` |
| F1-tokens | B | `src/styles/tokens.css`, `src/styles/globals.css`, `src/styles/animations.css`, `src/styles/base.css`*, `src/styles/styles.css`*, `src/styles/tailwind.css`*, `src/styles/preflight.css`*, `src/styles/legacy-tokens.css`*, `src/styles/__tests__/tokens.test.ts`*, `scripts/build-css.mjs`* |
| F4-overlay | C | `src/lib/layers.ts`*, `src/lib/__tests__/layers.test.ts`*, `src/hooks/useDismiss.ts`*, `src/hooks/useFocusTrap.ts`*, `src/hooks/useRestoreFocus.ts`*, `src/hooks/useScrollLock.ts`*, `src/hooks/usePopupPosition.ts`*, `src/hooks/useModalIsolation.ts`*, `src/hooks/useModalLayer.ts`*, `src/hooks/__tests__/useDismiss.test.tsx`*, `src/hooks/__tests__/useFocusTrap.test.tsx`*, `src/hooks/__tests__/useRestoreFocus.test.tsx`*, `src/hooks/__tests__/useScrollLock.test.tsx`*, `src/hooks/__tests__/usePopupPosition.test.tsx`*, `src/hooks/__tests__/useModalIsolation.test.tsx`*, `src/hooks/__tests__/useModalLayer.test.tsx`*, `src/components/portal/Portal.tsx`*, `src/components/portal/__tests__/Portal.test.tsx`* |
| F5-listbox-field | C | `src/hooks/useFieldControl.ts`*, `src/hooks/useListbox.ts`*, `src/hooks/useFormReset.ts`*, `src/hooks/__tests__/useFieldControl.test.tsx`*, `src/hooks/__tests__/useListbox.test.tsx`*, `src/hooks/__tests__/useFormReset.test.tsx`*, `src/components/internal/HiddenInput.tsx`*, `src/components/internal/__tests__/HiddenInput.test.tsx`*, `src/test-utils-field.tsx`* |
| F6b-pipeline | C | `vite.config.ts`, `scripts/verify-dist.mjs`*, `scripts/pack-smoke.mjs`*, `scripts/fixtures/**`*, `scripts/verify-storybook.mjs`*, `scripts/__tests__/verify-dist.test.mjs`*, `scripts/__tests__/verify-storybook.test.mjs`*, `scripts/__tests__/pack-smoke.test.mjs`*, `scripts/__tests__/vite-config.test.mjs`*, `.storybook/main.ts`, `.storybook/preview.tsx`, `.storybook/preview.css`*, `src/__tests__/stories.a11y.test.tsx`*, `package.json` (`package.json` sequentially after F6a) |

`*` = new file. New files inside component packages: P01 `src/components/button/buttonStyles.ts`; P04 `src/components/input/colorUtils.ts` (+ `__tests__/colorUtils.test.ts`); P05 `src/components/input/Option.tsx` (+ `__tests__/Option.test.tsx`); P06 `src/components/input/dateUtils.ts` (+ `__tests__/dateUtils.test.ts`); P17 `src/components/table/useGridNavigation.ts` (+ `__tests__/useGridNavigation.test.tsx`); INTEGRATION `src/__tests__/integration.test.tsx`.

Ownership changes versus `packages.json`: `src/components/button/index.ts` and `src/components/typography/index.ts` move from P01 to INTEGRATION (all barrels are INTEGRATION's); `stories/WaveProvider.stories.tsx` moves from DOCS (fallback) to F3; `stories/_helpers.ts` moves from DOCS to F6t (wave B), because P-owned stories import it and are type-checked from wave A on; `scripts/**`, `.prettierrc.json`, `.prettierignore`, `src/env.d.ts` move from DOCS (fallback) to F1/F6a/F6b as listed; `src/components/provider/**` is F3; new `src/components/portal/**` is F4, `src/components/internal/**` and `src/test-utils-field.tsx` are F5; `package.json` is F6a in wave A and F6b in wave C; after wave D every file is INTEGRATION's (§7.1.4), and DOCS' files pass to DOCS for wave E2.

---

## 9. Critique resolution log (revision 2)

Three critiques reviewed revision 1: **coverage** (C), **soundness** (S) and **execution** (E). Every blocker and major item is resolved in the sections named below; minor items are resolved too, except where "Rejected critiques" explains otherwise. Duplicate items raised by several lenses are listed once.

| # | Lens · severity | Critique (short) | Resolution |
|---|---|---|---|
| 1 | C/S/E · blocker | `useControllable` optimistic ref keeps a rejected controlled value (stale toggles, swallowed retries, `overlays#32` fails) | §2.3: rendered-value ref (synced in an insertion effect, before every layout effect of the commit; never written by `setValue`) + controlled-only per-event pending value cleared in a microtask + uncontrolled latest ref; required ignoring-parent tests; `table-core#3`, `button-provider#15` |
| 2 | S · major | Controlled → `undefined` resurrects stale state / stops following props | §2.3 sticky controlled mode returning the `defaultValue` argument; `table-core#4`; §7.3 |
| 3 | E · major | Global no-op suppression changes event-named callbacks | §1 C-NAMING "Callback semantics": event-named callbacks fire on every activation (0.4); value callbacks change-only; re-select tests (`table-core#3`, `input-basic#29`, `feedback-navigation#46`); §7.3 |
| 4 | C/E · blocker+major | `enabled:hover` never matches `<a>`/role=button and still matches aria-disabled | §1 C-TOKENS state gating `not-disabled:not-aria-disabled:` (verified compile), `enabled:` banned by the conventions gate, P01 `as="a"` test; `button-provider#3`, `#9`, `#10`; C-DISABLED |
| 5 | C/E · blocker | `document.body` axe scope fails `region` everywhere | §4.1 shared `configureAxe` instance with `region` disabled used by every helper and the stories gate; §4.2 body-empty-after-cleanup assertion; helper tests; exit criteria §7.1.2; `table-core#20` |
| 6 | C/S/E · major+minor | `styles.css` layer order, layered output vs consumer resets, Tailwind theme vars leaking, unpinned sources, `__tests__` published | §2.1.1 (order, `theme(inline)`, `source(none)`, `@source not`), §2.1.8 (unlayered output, consumer-side `layer()` import, baseline), §3.2 `files`, build-css/pack-smoke assertions; `repo-level#1` |
| 7 | S/E · major | Storybook loses Tailwind and story-only classes; dts plugin runs in Storybook | §3.1/§3.3 `viteFinal` adds `@tailwindcss/vite`, drops `vite:dts`; `.storybook/preview.css` with `@source "../stories"`; `scripts/verify-storybook.mjs`; `repo-level#1` |
| 8 | S · major | `base.css` pseudo-elements inside `:where()`; no Preflight replacement | §2.1.6 fixed selector + scoped native-element reset, background only on `.wave-root`; §1 C-NATIVE; WaveProvider required for `./styles` (documented) |
| 9 | C/E · major | `repo-level#7` partial fix undocumented as wont-fix; 0.4 variable overrides silently break | §2.1.2 ramp tokens read 0.4 names as fallbacks; bidirectional, cycle-free `legacy-tokens.css`; §7.4 formal partial wont-fix with colliding-name list and workarounds; §7.3 migration step; open question |
| 10 | C/S · major | Toasts over modals: outside press closes the Dialog; `aria-modal` hides toasts/live regions | §2.4 allow-list inside every layer + `useModalIsolation`/`useModalLayer`; §5.8 one model (isolation instead of `aria-modal`); `useAnnounce` first-use creation; `feedback-navigation#50`, `#12`, `input-pickers#14` |
| 11 | C · major | Grid auto-targets text inputs; wrapper region adds a second Tab stop | `table-core#10`, `table-core#15`, `data-display#2`; P17/P08 briefs; §7.4 |
| 12 | C · major | Selectable Card with nested buttons (nested-interactive, double activation) | `layout#35` `selectionControl` card/checkbox, nested-interactive event filter, dev warning, axe variant; P11 brief; §7.4 |
| 13 | C · major | Registration-mode labels unknown on SSR/first render | §2.5 `collectOptionLabels`, inline closed list, batched registration; `input-pickers#6`, `#1`; `renderToString` tests; §5.5 |
| 14 | C · major | Avatar `role="img"` on the badge wrapper hides PresenceBadge | `data-display#19`, `#21`, `#15`; P07 brief |
| 15 | C · major | asChild triggers break non-forwarding custom children | §5.3 + F3 `useTriggerElement`: `asChild={false}` opt-out, automatic wrapper fallback with dev warning, test; §7.3; `overlays#5`, `#33` |
| 16 | C/E · major | Wave-D tasks test other packages' in-flight work; F3/F6 `renderWithProviders` clash | §5.9 stand-in table; all compositions moved to INTEGRATION; `renderWithProviders` to F6t; F5 `renderWithFieldContext`; P01 stand-in; module-path imports (§0.2 rule 2) |
| 17 | S/C · major+minor | Roving: tab-stop priority vs APG, stale item list, nested composites, text-entry arrows, React-owned tabIndex | §2.3 `tabStop` option, MutationObserver store, nested composite = one item, author tabindex excluded, text-entry/slider/spinbutton ignored, restamping; `button-provider#12`, `table-core#5`, `layout#13`, `feedback-navigation#47` |
| 18 | S · major | Portal renders in a second commit; depth from registry is wrong for same-commit nesting | §2.4 Portal: `useIsClient`, React-rendered wrapper in the first commit, `PortalDepthContext`, element-based hooks (C-POPUPS); `overlays#36` |
| 19 | S · major | Outside press only checks topmost after React flushed the click; Escape ignores focus location | §2.4 layers (parentage-first order) + `useDismiss` pointerdown snapshot of all outside layers (no watermark since revision 3), Escape by focus location; `overlays#1`, `#2` |
| 20 | S · major | Focus trap capture phase pre-empts widgets; popovers in dialogs break Tab | §2.4 `useFocusTrap(element)` bubble phase, defaultPrevented protocol, descendant-layer anchor handling; `overlays#3`; §5.2 |
| 21 | S · major | Restore captures autoFocus element; StrictMode snaps focus back | §2.4 insertion-effect capture, microtask restore cancelled on remount, initial focus respects focus already inside; `overlays#9`, `#10`, `#27` |
| 22 | S/E · major+minor | TS configs: ES2020 lib, inherited `exclude`, missing `@types/node`, `process` clash, jest types | §3.3 three programs, own `exclude`, ES2022 in wave A, `check-ts-coverage.mjs`; `repo-level#20`, `button-provider#4`, `#8` |
| 23 | S/E · major+minor | Mandated patterns violate react-hooks v7 lint rules | §1 C-HOOKS patterns, `useIsClient`, deferred-update pattern, single disable form with an explicit site list; §0.2 rule 11 |
| 24 | S · major | `PolymorphicProps` with HTML-inheriting OwnProps keeps button typing for `as="a"` | §2.2 `XOwnProps` rule, `ElementType` constraints, anchor `onClick`/`type` type tests; `button-provider#8` |
| 25 | S · major | HC `selected` unreadable; dark primary-on-card 4.499 | §2.1.3 dark primary brand-110, HC selected #003a40/#fff, new pairs vs selected, unrounded comparisons; §7.3 |
| 26 | S · major | `'use client'` on barrels; dotted compounds unusable from RSC | §3.1 barrels excluded; §1 C-COMPOUND flat exports; `repo-level#2` (compound owners, verify-dist) |
| 27 | E · major | F1↔F6 wave inversion; `build` red on test/story type errors | F6 split into F6a (A), F6t (B), F6b (C); F1 to wave B; `build` = library program only (§3.2, §7.1.1) |
| 28 | E · major | Stories cannot import new symbols until barrels land | §0.2 rule 2 module-path imports; INTEGRATION normalises (§5.11) |
| 29 | E · major | Shared Button changes under other packages' feet | Wave D0 + Button API freeze (§5.7, §7.1.1, P01 brief) |
| 30 | E · major | No foundation change process in wave D | §7.1.3 change-request queue; §0.2 rule 10 (no forks) |
| 31 | E · major | No checkpoints; repo-wide mutating commands | §0.2 rule 9; §7.1.5 lead-only commits per package, wave tags |
| 32 | E · major | INTEGRATION cannot edit P files; DOCS before INTEGRATION | §7.1.4 ownership transfer + re-dispatch loop; order E1 INTEGRATION → E2 DOCS → E3 gate |
| 33 | C · minor | nativeRequired not specified for library inputs | §2.5, §5.1, `input-basic#16` |
| 34 | C · minor | Input `error` DOM shape and docs owner | `input-basic#24` (Fragment + `errorMessageProps`, DOCS owner), §7.3 |
| 35 | C · minor | MessageBar button slot nests buttons | §1 C-SLOTS merge rule and `Slot<'span'> \| SlotObject<'button'>` typing; `feedback-navigation#1`, `data-display#1`, `table-core#18`; §7.3 |
| 36 | C · minor | Missing §7.3 entries (Stepper, Tree, Avatar, Toaster, Input error) | §7.3 "DOM structure" and "Behaviour"; Stepper keeps root `<div>` + inner `<ol>` (`feedback-navigation#38`); Tree keeps `div` elements (`layout#30`) |
| 37 | C · minor | No gate for `<button>` without `type` | C-BUTTON-TYPE + conventions rule; P15 close buttons in `button-provider#1` |
| 38 | C/S/E · minor | Contrast not verifiable in jsdom; gate wording; Slider rail | §4.5, C-STORIES wording, C-TOKENS slider row; `repo-level#23`; open question for a browser pass |
| 39 | C · minor | Hex in stories not gated | conventions over `stories/` with fixture allow-comment; `repo-level#38` (P14 added) |
| 40 | C · minor | InfoLabel focus-then-click closes; describedby to unmounted content | `data-display#13` interaction rules + inline hidden description |
| 41 | C · minor | DatePicker custom formatter without parser; SSR locale | §5.6 parsing contract; `input-datetime#1`, `input-basic#31` |
| 42 | C/S · minor | C-MOTION and physical-utility gates incomplete | §1 C-MOTION, §4.4 regexes; `repo-level#12`, `feedback-navigation#34` |
| 43 | C · minor | Portal registration target and portal background ambiguous | §2.4 Portal (parent-layer registration), §2.1.6 (no portal background); `button-provider#2`, `overlays#41` |
| 44 | C · minor | Hundreds of permanent tooltip portals; dangling describedby | §5.3 inline hidden description, visual portaled only while visible; `overlays#18`, `#14` |
| 45 | S · minor | Trigger ref churn; child ARIA overriding live state; id mismatch | F3 `useTriggerElement`, F2 `mergeProps` `oursWin`, resolved id to context; `overlays#12` |
| 46 | S/E · minor | Iterable/thenable slots mis-parsed; `ResolvedSlot` shape | §2.2 slot row; `table-core#18`, `#33` |
| 47 | S · minor | `forced-color-adjust-none` inherits | §2.2 `selectedLeaf`/`selectedContainer`; `input-basic#9` |
| 48 | S · minor | Label lost when the control's id ≠ `controlId` | §2.5 merge rule; `input-basic#1` (INTEGRATION Field > Tooltip > Input) |
| 49 | S · minor | Button-combobox Enter/Space re-toggle; editable Enter; per-option publish; closed portals | §2.5 keyboard and registration bullets; `input-pickers#11`, `#1`, `#6` |
| 50 | S · minor | Module singletons duplicated across ESM/CJS | §2.2 `globalRegistry.ts`, used by layers/traps/scroll lock/announcer/warnings |
| 51 | S/E · minor | HiddenInput validation message/position, reset without name, default RadioGroup name | §2.5 HiddenInput, C-FORMS; `input-basic#12`; §7.4 |
| 52 | S · minor | Global color-scheme; direction without provider; RTL scrollbar compensation | §2.1.2, `useDirection` fallback, `useScrollLock` gutter/logical padding; `repo-level#11`, `overlays#11`, `#37` |
| 53 | S/E · minor | `lib.formats` ignored, transitive esbuild, unpublished-tests, uninstalled tools | §3.1 (no formats, Vite-API probe), §3.2 (`files`, installs in F6a); `repo-level#3`, `#5` |
| 54 | E · minor | Wave exit criteria | §7.1.2 full-suite criterion + §7.5 handoff list |
| 55 | E · minor | Eager stories glob | §4.4 non-eager per-file blocks; `repo-level#24` |
| 56 | E · minor | Ownership details (`_helpers.ts`, `renderWithProviders`, shared input folder) | §8, §0.2 rule 1 (component-prefixed new files) |
| 57 | E · minor | Package sizing (split P06, P16) | Rejected — see below; mitigated by dispatch order (§7.1.1) |

### Rejected critiques (and partial rejections)
- **Split P06 into DatePicker/TimePicker and P16 into Tooltip vs Popover+TeachingPopover (E, minor) — rejected.** The two halves of each package share files and contracts that would become new seams: P06's time helpers live in `dateUtils.ts` next to the date helpers (§5.6) and both pickers share the draft-text model, the listbox/popup wiring and one test style; P16's three components share the positioning/layer/restore harness and TeachingPopover's `target` anchoring reuses Popover's surface. Splitting would add a shared-file owner inside `src/components/input/` (already shared by five packages) and require re-mapping about 87 assignments, while the wave-D critical path is bounded by the foundation waves and the D0 freeze. Mitigation: P06 and P16 are dispatched first in wave D (§7.1.1).
- **Namespace the colliding Tailwind utilities (C major, option a) — rejected in favour of option b** (formal partial wont-fix of `repo-level#7`, §7.4): renaming `bg-primary` & co. removes the documented 0.4 utility vocabulary that consumers use in their own markup and in `className` overrides, which the backward-compatibility policy forbids, and rewrites every class string in 65 components. Workarounds are documented; 1.0 namespacing is an open question.
- **Render the Toaster and announcer into the topmost modal (S major, option a) — not chosen**; option b (drop `aria-modal`, inert the background) is used because moving the toast viewport between portals would remount toasts (losing focus inside a toast and hover/focus timer state) every time a modal opens or closes.
- **Pack-smoke fixture that measures computed padding/colour under a `*{padding:0}` reset (C major) — replaced** by a static assertion that `dist/styles.css` is unlayered: jsdom does not implement the cascade for these selectors reliably and a real browser would add Playwright. The cascade rule itself guarantees the outcome (unlayered `.p-4`, specificity 0,1,0, beats `*` at 0,0,0 and `button` at 0,0,1).
- **Typecheck sentinel file containing a deliberate `// @ts-expect-error` (E major) — replaced** by `scripts/check-ts-coverage.mjs`: a sentinel inside an excluded file is never type-checked, so it cannot detect the very misconfiguration it targets; listing the program's files can.
- **INTEGRATION-0 step converting category barrels to `export *` (E major, first option) — rejected**; the alternative (module-path imports during wave D, normalised by INTEGRATION) is used, because `export *` would publish internal helpers (`getPaginationRange`, `collectOptionLabels`, `HiddenInput`) as public API, and removing them later would be a breaking removal.
- **Automatic trigger wrapper based on "intrinsic element or known library component" (C major, one option) — replaced** by ref-attachment detection in `useTriggerElement`: a hard-coded list of known components cannot cover consumer components that do forward props, while an unattached ref reliably identifies the non-forwarding case. The `asChild={false}` opt-out and the dev warning are adopted as recommended.
- **Capture the restore target during render (S major, first option) — not chosen**; `useInsertionEffect` (the critique's second option) is used, because reading `document.activeElement` during render is impure and can run for renders that never commit.
- **Named `wave.*` cascade layers for `dist/styles.css` (S major, one option) — not chosen**; the unlayered output (the critique's other option) is used because any unlayered consumer reset would beat layered Wave styles; consumers who want layering can import the file with `layer(wave)` themselves (§2.1.8).
- **Type-check the `scripts/` in `tsconfig.node.json` (S major, part) — not adopted**: scripts stay plain `.mjs` and are linted; only the Vite/Vitest configs form the node program.
- **Roving: the outer hook takes over a nested composite's tab stop (S major, implied) — partially adopted**: nested composites count as one item and are never stamped, but keep their own Tab stop (documented limitation), because an outer hook writing `tabindex` inside an inner roving group would fight the inner hook.
- **A real-browser contrast pass (C/S minor) — deferred, not rejected**: recorded as a limitation with a manual per-theme gate step (§4.5, §7.2) and an open question, because it needs a Playwright dev dependency the policy asks to justify.

---

## Appendix A — Issue → owner → task (all 305 cids)

Generated from the revised assignment table (revision 2). Format: **cid** [severity/category] title — owners — task.

### button-provider

- **button-provider#1** [critical/bug] ToggleButton, MenuButton, CompoundButton, SplitButton's menu chevron and MessageBar's dismiss button render bare <button> elements with no type, so they submit any…
  - Owners: `P01-buttons`, `P12-messages`, `P15-modal`, `F6t-test-infra`
  - Task: F6t: add testNoImplicitSubmit(Component, {defaultProps, getTargets}) to test-utils (renders inside <form onSubmit=spy>, clicks every internal button, asserts spy not called) and a conventions rule that fails on a JSX `<button` opening tag without a literal `type=` in src/components (C-BUTTON-TYPE). P01: put type='button' BEFORE {...props} on ToggleButton, MenuButton, SplitButton chevron (and primary half), CompoundButton (type only when rendered element is 'button'); regression test per component via testNoImplicitSubmit (red first). P12: MessageBar dismiss button gets type='button' (also covered by the wired-dismiss rewrite); regression test. P15: Dialog and Drawer close buttons (Dialog.tsx:191, Drawer.tsx:149) get type='button'; testNoImplicitSubmit over an open Dialog and an open Drawer rendered inside a form.
- **button-provider#2** [critical/a11y] WaveProvider never sets text color or background on its themed wrapper, so text inside the dark and high-contrast themes inherits the light-theme #242424 and is…
  - Owners: `F3-hooks-provider`, `F1-tokens`, `P01-buttons`, `P15-modal`, `DOCS`
  - Task: F1: base.css sets font, font-size and colour on `.wave-root, .wave-portal` and paints `background-color: var(--wave-background)` on `.wave-root` only (portal wrappers never paint a background; surfaces paint their own); every theme class re-declares tokens so nested roots re-inherit (§2.1.6). F3: WaveProvider root = cn('wave-root', getThemeClassName(theme), 'bg-background text-foreground font-wave text-body-1', className); test that a dark provider root carries these classes and that user className wins; update stories/WaveProvider.stories.tsx to drop inline background hacks. P15: Dialog/Drawer render through <Portal> (themed wrapper) so portaled content inherits the provider theme; test that Dialog content inside <WaveProvider theme='dark'> is inside an element with class wave-dark. P01: Text keeps color inherited (no default color class); test that Text inside a dark provider has no text-color utility and the provider root has text-foreground. DOCS: README theming section: provider paints bg/fg, nested providers, portals inherit theme, WaveProvider is required for the precompiled ./styles path (scoped base and native-element reset).
- **button-provider#3** [critical/styling] The Button-family appearance and pressed maps hard-code light-theme hex hover, active, pressed and border colors, so labels vanish or fall below AA in the dark and…
  - Owners: `F1-tokens`, `P01-buttons`, `P02-field-text`, `P03-choice`, `P04-spin-color`, `P05-listbox`, `P06-datetime`, `P07-identity`, `P08-list-tag`, `P09-disclosure`, `P10-carousel-overflow`, `P11-primitives`, `P12-messages`, `P13-menu-nav`, `P14-pagination-stepper`, `P15-modal`, `P16-popups`, `P17-table`, `F6t-test-infra`
  - Task: F1: add the state/status token set of §2.1.3 (primary-hover/pressed, subtle-hover/pressed/selected, selected(+fg), stroke, stroke-hover, stroke-accessible, status fg/tint/tint-fg, inverted, track, skeleton, rating, backdrop, presence-*) to every theme group with the tabled contrast ratios (asserted unrounded by tokens.test, including foreground, muted-foreground, primary-as-text and ring against selected in every theme) and expose via @theme inline. F6t: conventions test fails on raw hex/rgba/white/black/palette color utilities in src/components and stories (fixture allow-comment), and on any `enabled:` variant in src/components (C-TOKENS state gating). Every P package: replace every raw color utility and SVG stroke/fill literal in owned components using the §1 C-TOKENS mapping; gate hover/active styling of interactive elements with the literal prefixes `not-disabled:not-aria-disabled:hover:` / `not-disabled:not-aria-disabled:active:` (works for <a>, role=button divs and aria-disabled controls; never `enabled:`); update tests that asserted hex classes (TeachingPopover dots, MessageBar status classes, …) to assert tokens or semantics. P01 additionally moves the button maps into src/components/button/buttonStyles.ts (button-provider#20) and tests that `<Button as='a'>` carries the gated hover class and that no class uses the `enabled:` variant. P02: Slider unfilled rail uses bg-stroke-accessible (3:1 non-text, input-basic.a11y.18); progress-style tracks keep bg-track.
- **button-provider#4** [important/bug] WaveProvider logs 'unknown theme "light"' on every render of its own default theme because the validity check tests truthiness of an empty-string class.
  - Owners: `F3-hooks-provider`
  - Task: F3: validate with `Object.hasOwn(themeClassMap, theme)` (lib ES2022 lands with F6a in wave A) inside a useEffect (warnOnce per theme value); regression test: console.warn spy expects 0 calls for 'light','dark','high-contrast' (incl. StrictMode) and 1 for 'neon'.
- **button-provider#6** [important/bug] A nested <WaveProvider theme="light"> inside a dark or high-contrast provider stays dark because light maps to no class and light tokens exist only on :root.
  - Owners: `F1-tokens`, `F3-hooks-provider`
  - Task: F1: light tokens declared on `:root, .wave-light` (plus per-theme re-declarations of derived vars like --wave-card-foreground). F3: getThemeClassName('light') returns 'wave-light'; test nested <WaveProvider theme='light'> inside dark renders class wave-light.
- **button-provider#8** [important/type-design] The documented `as` prop on Button, CompoundButton, Link, Card, Text and other components is typed as React.ElementType, but the props never change with it, so…
  - Owners: `F2-lib`, `P01-buttons`, `P08-list-tag`, `P11-primitives`, `F6a-tooling`
  - Task: F2: src/lib/polymorphic.ts: `PolymorphicProps<C extends React.ElementType, OwnProps>` and `PolymorphicComponent<DefaultC extends React.ElementType, OwnProps>` (§2.2). Every polymorphic component declares an `XOwnProps` interface with ONLY component-specific props (appearance, size, icon, disabled, …; no HTML-attribute inheritance) and `XProps<C extends React.ElementType = DefaultTag> = PolymorphicProps<C, XOwnProps>`; the 0.4 name (`ButtonProps`) stays valid as the default-tag type and stays extendable by interfaces (type test). P01: Button, CompoundButton, Link, Text, Toolbar. P08: Tag, Divider. P11: Card (+Header/Body/Footer), Stack, Flex, Grid. Type tests in __tests__ (`expectTypeOf`/@ts-expect-error): `<Button as='a' href target>` compiles; `<Button as='a' formAction>` fails; `onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {}}` and `type='text/html'` compile with as='a'; anchor props on the default button fail. F6a: tsconfig.dev.json (own `exclude`, not inherited) type-checks tests and stories, verified by scripts/check-ts-coverage.mjs inside `npm run typecheck`.
- **button-provider#9** [important/a11y] Button and CompoundButton rendered with a non-button `as` pass `disabled` through verbatim, so they look disabled but stay focusable, clickable and announced as enabled.
  - Owners: `P01-buttons`
  - Task: P01: when the rendered element is not a native button and disabled: omit `disabled`, set aria-disabled='true', tabIndex=-1 (after rest so it cannot be re-enabled), guard onClick/onKeyDown with preventDefault; when `as` is a non-interactive element (not a/button/input) add role='button', tabIndex=0 and Enter/Space activation. Same in CompoundButton. Hover/pressed classes use the `not-disabled:not-aria-disabled:hover:` / `not-disabled:not-aria-disabled:active:` gating (C-TOKENS), so `as='a'` keeps hover feedback and aria-disabled renders change nothing on hover. Regression tests for as='a' disabled (not focusable, click prevented, aria-disabled), as='div' (role button, Enter/Space fire onClick) and the gated class on as='a'.
- **button-provider#10** [important/a11y] Primary buttons in the dark theme have 2.81:1 label contrast because --primary is set to Fluent's link color #479ef5 while --primary-foreground stays white.
  - Owners: `F1-tokens`, `P01-buttons`
  - Task: F1: dark theme --wave-primary = var(--wave-brand-110) #62abf5 with --wave-primary-foreground #000000 (8.66:1), hover var(--wave-brand-120) #77b7f7 (9.90:1), pressed var(--wave-brand-90) #2886de (5.56:1); primary used as text is >= 4.5:1 on background (6.00), card/subtle-hover (5.21) and subtle-selected (4.84); ring stays #479ef5. P01: primary appearance uses bg-primary/text-primary-foreground + not-disabled:not-aria-disabled:hover:bg-primary-hover and not-disabled:not-aria-disabled:active:bg-primary-pressed (no hard-coded white); test asserts classes.
- **button-provider#11** [important/a11y] Primary CompoundButton secondary text uses white at 80% opacity at 12px, which reaches only about 4.04:1 in light and about 2.3:1 in dark.
  - Owners: `P01-buttons`
  - Task: P01: CompoundButton secondary text on primary uses full-opacity text-primary-foreground (no /80); test asserts the class and absence of opacity modifier.
- **button-provider#12** [important/a11y] Toolbar sets role="toolbar" but implements no roving tabindex, arrow-key navigation or aria-orientation.
  - Owners: `P01-buttons`, `F3-hooks-provider`
  - Task: F3: useRovingTabIndex DOM mode (§2.3): items resolved from the DOM at event time (itemSelector; only elements whose nearest [data-roving-container] is this container; a nested composite counts as one item; author tabindex=-1 elements such as SpinButton steppers are excluded), enabled set published through a MutationObserver-backed useSyncExternalStore store, `manageTabIndex` stamping re-run from the MutationObserver (childList + tabindex/disabled/aria-disabled attributes), `tabStop: 'last-focused'` option, arrow keys ignored when the event starts in a text-entry field, select, slider or spinbutton. P01: Toolbar gets `orientation` (aria-orientation) and uses the hook with itemSelector 'button, [href], input, select, textarea, [role="button"], [tabindex]', `manageTabIndex: true`, `tabStop: 'last-focused'`; Left/Right (Up/Down when vertical) + Home/End, disabled skipped, RTL mirrored; one tab stop. Tests: arrow navigation; an Input child keeps Left/Right for its caret; a child that toggles disabled by itself (no Toolbar re-render) is skipped, then re-included; a child with tabindex=-1 inner buttons keeps them untouched.
- **button-provider#13** [important/a11y] SplitButton's menu chevron has no props, ref or slot pass-through, so consumers cannot localize its 'More options' label, expose aria-expanded or aria-controls, open…
  - Owners: `P01-buttons`
  - Task: P01: SplitButton gets `primaryActionButtonProps` and `menuButtonProps` (both ButtonHTMLAttributes & {ref}) merged with mergeProps onto the two halves, plus `menuButtonLabel` (default 'More options'); aria-describedby received on the root is routed to the primary button; compatible with Menu.Trigger render-prop (§5.2). Tests: aria-expanded/aria-controls/onKeyDown/ref land on the chevron; custom label.
- **button-provider#14** [important/a11y] Inline Link variant is underlined only on hover, so it differs from body text only by color (2.88:1), and the subtle variant cannot be told apart from body text at all.
  - Owners: `P01-buttons`
  - Task: P01: Link appearance 'inline' is always underlined (thicker on hover/focus); JSDoc documents standalone/subtle usage limits; test asserts `underline` class for inline.
- **button-provider#15** [important/test-gap] ToggleButton controlled mode is tested only with pressed={false}; there is no test for pressed={true}, controlled rerender or disabled clicks.
  - Owners: `P01-buttons`, `F3-hooks-provider`
  - Task: F3: useControllable (§2.3): controlled functional updaters receive the last rendered controlled value (plus a pending value from the same event), and a parent that ignores onChange never leaves a stale value behind. P01: ToggleButton uses setPressed(p => !p); tests: pressed={true} renders aria-pressed=true and click calls onPressedChange(false); rerender pressed false->true updates aria-pressed; disabled click does not call onPressedChange; controlled pressed={false} whose parent ignores the callback: two clicks emit (true), (true) while aria-pressed stays false. Separate-interactions rule (§2.3): consumer tests of repeated interactions on a controlled component whose parent ignores the callback must separate the interactions with userEvent, or with `await act(async () => {})` between fireEvent calls. Back-to-back synchronous fireEvent calls run in one task, and the per-event pending value (cleared in a microtask) makes them chain like uncontrolled mode: two fireEvent.click calls on ToggleButton pressed={false} emit (true), (false), not (true), (true).
- **button-provider#16** [important/test-quality] Text's variant tests only assert that the element exists, so the variant-to-class mapping and the body-1 default are untested.
  - Owners: `P01-buttons`
  - Task: P01: Text tests assert toHaveClass(`text-${variant}`) in the it.each, 'defaults to body-1', and variant + color className (e.g. text-body-1 + text-primary) keeps both (depends on F2 cn fix).
- **button-provider#17** [important/test-gap] Disabled Link test asserts only that onClick was not called, not that navigation is prevented, and does not guard against a consumer tabIndex re-enabling focus.
  - Owners: `P01-buttons`
  - Task: P01: disabled Link: tabIndex=-1 and aria-disabled placed AFTER rest spread; test that fireEvent.click returns false (default prevented) and that a consumer tabIndex={0} cannot re-enable focus.
- **button-provider#18** [suggestion/a11y] A disabled Link keeps its href, so it can still be opened by middle-click, the context menu or drag-to-tab, and AT still exposes a destination.
  - Owners: `P01-buttons`
  - Task: P01: disabled Link omits href, sets role='link' + aria-disabled='true'; test href absent when disabled and restored when re-enabled.
- **button-provider#19** [suggestion/styling] The 'extra-large' button size uses text-sm (14px), smaller than 'large' (text-base, 16px), and the slip is copy-pasted into all five size maps.
  - Owners: `P01-buttons`
  - Task: P01: extra-large size uses text-body-2/text-lg equivalent larger than large (single shared size map in buttonStyles.ts); test extra-large font class differs from large.
- **button-provider#20** [suggestion/simplification] Button-family sizeClasses/appearanceClasses tables and the chevron SVG are duplicated across five components instead of shared.
  - Owners: `P01-buttons`, `F2-lib`
  - Task: F2: shared ChevronDownIcon/DismissIcon in src/lib/icons.tsx. P01: new src/components/button/buttonStyles.ts exporting buttonBaseClasses, buttonSizeClasses, buttonAppearanceClasses, buttonPressedClasses, buttonClassName({appearance,size,disabled,iconOnly}) used by Button, ToggleButton, MenuButton, SplitButton, CompoundButton; ToggleButton/MenuButton compose <Button> where practical.
- **button-provider#21** [suggestion/a11y] Button-family icon slots are not aria-hidden, so decorative glyph or emoji icons become part of the button's accessible name.
  - Owners: `F2-lib`, `P01-buttons`, `P13-menu-nav`
  - Task: F2: renderSlot gains 4th arg defaultProps (merged under the slot object's own props). P01: icon and menuIcon slots render with {'aria-hidden': true} default; dev warning (warnOnce) when a button has icon, no text children and no aria-label/aria-labelledby/title; ToggleButton story icons get labels. P13: Menu.Item icon and Breadcrumb icon slots aria-hidden by default. Tests: icon text not part of accessible name.
- **button-provider#22** [suggestion/a11y] SplitButton's chevron target is below 24x24 CSS px at the extra-small and small sizes and abuts the primary button, failing WCAG 2.5.8.
  - Owners: `P01-buttons`
  - Task: P01: SplitButton chevron gets min-w-6 min-h-6 (px increased at extra-small/small) so the target is >=24x24; test asserts the classes per size.
- **button-provider#23** [suggestion/test-gap] SplitButton's test comment misstates where rest props go, and the suite skips testSystemProps, leaving no displayName, rest-spread or axe coverage.
  - Owners: `P01-buttons`
  - Task: P01: delete the misleading comment and hand-written ref/className tests; call testSystemProps(SplitButton, {expectedTag:'div', displayName:'SplitButton', defaultProps:{children:'Save'}, a11yVariants:[{name:'disabled',props:{disabled:true}}]}); query buttons by accessible name.
- **button-provider#24** [suggestion/test-quality] ToggleButton's 'checked' a11y variant passes a nonexistent `checked` prop, so the pressed state is never axe-checked.
  - Owners: `P01-buttons`, `F6t-test-infra`
  - Task: F6t: type a11yVariants/defaultProps as Partial<React.ComponentProps<typeof Component>> (generic helpers, no any). P01: ToggleButton variant becomes {name:'pressed', props:{pressed:true}}.
- **button-provider#25** [suggestion/test-gap] MenuButton tests never assert aria-expanded="false" for expanded={false}, and never check that a custom menuIcon replaces the default chevron.
  - Owners: `P01-buttons`
  - Task: P01: MenuButton tests: expanded={false} -> aria-expanded='false'; custom menuIcon renders exactly one icon and no default svg; menuIcon={false} hides chevron (supported value).
- **button-provider#26** [suggestion/test-quality] Button's 'subtle' and 'transparent' appearance tests both assert only bg-transparent, so they cannot tell the two appearances apart.
  - Owners: `P01-buttons`
  - Task: P01: replace substring className tests with an it.each over all appearances asserting each distinguishing token class via toHaveClass (text-primary for transparent, text-foreground for subtle, etc.).
- **button-provider#27** [suggestion/type-design] Public hook signatures return unexported types, and component `ref` is added by an ad-hoc intersection rather than being part of the exported Props interfaces.
  - Owners: `F3-hooks-provider`, `P01-buttons`, `P02-field-text`, `P03-choice`, `P04-spin-color`, `P05-listbox`, `P06-datetime`, `P07-identity`, `P08-list-tag`, `P09-disclosure`, `P10-carousel-overflow`, `P11-primitives`, `P12-messages`, `P13-menu-nav`, `P14-pagination-stepper`, `P15-modal`, `P16-popups`, `P17-table`, `INTEGRATION`
  - Task: F3: export WaveContextValue, SetValue, UseRovingTabIndexResult (and new hook result types) from their source files. P12: export ToastController (return type of useToastController). Every P package: apply C-REF — move `ref?: React.Ref<El>` into each exported XxxProps interface (sub-components included) and drop the ad-hoc `& { ref?: ... }` intersections. INTEGRATION: add the new type exports to src/index.ts and category barrels.
- **button-provider#28** [suggestion/test-gap] No automated RTL coverage: only WaveProvider's dir attribute is tested, and nothing prevents new physical (left/right) utilities in components.
  - Owners: `F6t-test-infra`, `F3-hooks-provider`
  - Task: F6t: conventions test (src/__tests__/conventions.test.ts) fails on physical utilities (ml-/mr-/pl-/pr-/left-/right-/border-l/r/rounded-l/r/rounded-tl…/text-left/right/float-left/right/origin-left/right/bg-linear-to-l/r/scroll-m|p l/r, and translate-x state classes without an rtl: counterpart) in src/components (allow-comment `wave-allow-physical: <reason>`); renderWithProviders(ui, { theme, dir }) in test-utils with its tests in src/__tests__/test-utils.test.tsx (built on the existing WaveProvider theme/dir props). F3: WaveProvider dir test kept; useDirection falls back to the document direction outside a provider (test with <html dir='rtl'>). (Storybook dir toolbar is repo-level#23; per-component RTL fixes are under feedback-navigation#34 and the component clusters.)

### table-core

- **table-core#1** [critical/bug] cn() uses stock twMerge, so the theme's custom font-size tokens (text-body-1, text-title-1, ...) are treated as text colours and dropped by any later text-colour…
  - Owners: `F2-lib`, `P01-buttons`, `DOCS`
  - Task: F2: cn built on extendTailwindMerge with theme.text = custom type ramp, theme.shadow = ['2','4','8','16','28','64'], theme.font=['wave'], theme.animate=wave-* (§2.2); cn tests: cn('text-body-1','text-foreground') keeps both; cn('text-body-1','text-sm') === 'text-sm'; cn('shadow-4','shadow-8') === 'shadow-8'; cn('shadow-4','shadow-lg') === 'shadow-lg'. P01: Text/CompoundButton regression tests that a typography token survives a following color class. DOCS: CLAUDE.md + guide 'last class wins' statement now true; mention custom scales.
- **table-core#2** [critical/bug] In a selectable DataGrid, DataGrid.Row's onKeyDown acts on Enter/Space bubbling up from any descendant, so buttons, links, menu triggers and text inputs inside cells…
  - Owners: `P17-table`
  - Task: P17: row and header keyboard handling only acts when e.target === e.currentTarget (moot once the APG grid model lands, keep the guard in the cell/row handlers); tests: Enter/Space on a nested button and in a nested input neither toggle selection nor preventDefault.
- **table-core#3** [important/bug] useControllable's setValue works out the next value inside the setInternalValue updater: onChange fires twice or during render (StrictMode, batched updates), and in…
  - Owners: `F3-hooks-provider`, `P01-buttons`, `P04-spin-color`, `P05-listbox`, `P08-list-tag`, `P09-disclosure`, `P14-pagination-stepper`, `P15-modal`, `P17-table`, `DOCS`, `INTEGRATION`
  - Task: F3: rewrite useControllable (§2.3): sticky controlled mode; uncontrolled updates chain through a latest-value ref; controlled updaters and the no-op check use the last rendered controlled value, plus a per-event pending value cleared in a microtask (never persisted); onChange called once from the event path, skipped only when Object.is(next, base); stable setValue. Tests: StrictMode toHaveBeenCalledTimes(1); two batched functional updates; controlled parent that ignores onChange: setValue(false) in three separate events → onChange ×3, functional toggle twice in separate events → (true), (true), retrying a rejected value fires again. Consumers (P01 ToggleButton, P04 ColorPicker, P05 Combobox freeform, P08 List, P09 TabList, P15 Dialog, P17 DataGrid) each add one StrictMode test that the value callback fires exactly once per interaction and remove workarounds; repeated interactions in their controlled tests follow the separate-interactions rule (§2.3: userEvent, or `await act(async () => {})` between fireEvent calls). Event-named callbacks keep the 0.4 'fire on every activation' semantics and are called from the activation handler, not through useControllable (C-NAMING callback semantics): P14 Pagination onPageChange and Stepper onStepChange fire when the current page/step is activated again (regression tests); TabList/Nav/Combobox/Dropdown aliases are covered by feedback-navigation#46 and input-basic#29. DOCS: fix WAVE-UI-GUIDE.md:487. INTEGRATION: export type SetValue.
- **table-core#4** [important/bug] useControllable fixes controlled vs uncontrolled mode at mount, so a value that arrives later is ignored and overwritten, and a controlled value that becomes…
  - Owners: `F3-hooks-provider`, `P05-listbox`, `P08-list-tag`, `P17-table`
  - Task: F3: controlled mode is sticky: isControlled = wasEverControlled || value !== undefined (conditional set-state-in-render flag; lint-compatible). A late-arriving value takes over; a once-controlled value that becomes undefined returns the hook's defaultValue argument (the component's empty value: [], null, '') — never the stale last value and never undefined — and setValue keeps calling onChange without internal state. One dev warning per direction with correct argument order. Tests for both directions asserting the returned value. P05 TagPicker, P08 List, P17 DataGrid (incl. the deprecated sortColumn alias): regression tests that rerendering a controlled value -> undefined clears to the empty value without crashing and that a late-arriving value is honoured.
- **table-core#5** [important/bug] useRovingTabIndex ignores arrow keys when activeValue is not one of the items, so RadioGroup and TabList with no selection or default cannot be navigated with arrows.
  - Owners: `F3-hooks-provider`, `P03-choice`, `P09-disclosure`
  - Task: F3: useRovingTabIndex `tabStop: 'active'` (default): the tab stop is the enabled activeValue item, else the first enabled item (APG Tabs/Radio); 'last-focused' is opt-in (Toolbar). When the focused value is unknown, arrows start from the event target's item, else index 0/last. P03 RadioGroup and P09 TabList: tests with no value/defaultValue: Tab reaches the first item, ArrowDown/Right moves to the second; P09 additionally defaults the uncontrolled selection to the first enabled tab when defaultValue is ''/undefined (derived during render, no effect; panel shown).
- **table-core#7** [important/a11y] useRovingTabIndex always maps ArrowRight to next and ArrowLeft to previous, so under WaveProvider dir='rtl' horizontal TabList and RadioGroup move focus and selection…
  - Owners: `F3-hooks-provider`, `P09-disclosure`, `P03-choice`
  - Task: F3: useRovingTabIndex resolves direction per keydown via getDirection(e.currentTarget) (or explicit `dir` option) and swaps ArrowLeft/ArrowRight in horizontal/both orientation for rtl; hook tests under dir=rtl. P09 TabList and P03 RadioGroup: RTL keyboard tests via renderWithProviders({dir:'rtl'}).
- **table-core#10** [important/a11y] DataGrid always renders role='grid' but implements none of the APG grid keyboard model: every row and its checkbox is a separate Tab stop and arrow keys do nothing.
  - Owners: `P17-table`
  - Task: P17: implement the APG Grid keyboard model in src/components/table/useGridNavigation.ts: single roving tab stop across cells; a cell's focus target is its only focusable widget when that widget is NOT a text-entry control (input text/search/email/url/tel/password/number, textarea, select, contenteditable) — otherwise the cell itself; Arrow/Home/End/Ctrl+Home/Ctrl+End/PageUp/PageDown in navigation mode; Enter/F2 enters the cell's widget(s) (interaction mode: grid keys are ignored, so arrows move the caret), Escape returns focus to the cell; widgets inside cells tabIndex=-1 except the active target; rows lose tabIndex=0; tests for each key, the single Tab stop, and that Left/Right inside an edited cell input move the caret, not the cell.
- **table-core#11** [important/api-design] DataGrid's documented `columns` prop and exported DataGridColumn type are discarded (`columns: _columns`), so consumers who follow the typed API get a grid with no…
  - Owners: `P17-table`, `INTEGRATION`, `DOCS`
  - Task: P17: when `columns` is passed and no DataGrid.Header child is present, render Header/HeaderCell (+selection header cell) from columns (id->columnId, label, sortable); tests; stories show both styles and actually sort their data via onSortChange. Remove dead code or wire toggleAll (table-core#12). INTEGRATION: keep DataGridColumn export. DOCS: README says sorting is controlled (consumer reorders rows).
- **table-core#12** [important/a11y] With selection on, DataGrid adds a selection <td> to body rows but no <th> to the header, so every column header points at the wrong column, and the context's…
  - Owners: `P17-table`
  - Task: P17: DataGrid.Header renders a leading selection columnheader when selectionMode != 'none': multiple -> labelled 'Select all rows' checkbox (indeterminate when partial) wired to a corrected toggleAll over registered row ids; single -> visually hidden 'Selection' text. Tests: columnheader count equals row cell count in each mode; select-all toggles; stories drop the &nbsp; header cell.
- **table-core#13** [important/a11y] DataGrid selection controls are named 'Select row ${rowId}' from an internal key, single-mode radios have no shared name, and rows without rowId render a 'Select row…
  - Owners: `P17-table`
  - Task: P17: DataGrid.Row gets `selectionLabel` (string) / aria-labelledby default to its first cell (useId per row); single-mode radios share a useId name; rows without rowId render no selection control + dev warning. Tests for names, radio grouping, missing rowId.
- **table-core#14** [important/a11y] A sortable DataGrid.HeaderCell makes the <th> itself focusable with click and key handlers but no button role, and `sortable` without `columnId` gives a focusable…
  - Owners: `P17-table`
  - Task: P17: sortable header renders <button type='button'> inside the <th> (aria-sort stays on th, th has no tabIndex/handlers); `sortable` without columnId is treated as not sortable + dev warning; tests.
- **table-core#15** [important/a11y] Table and DataGrid wrap the <table> in an overflow-hidden div that consumers cannot override, so wide tables lose columns with no scrollbar.
  - Owners: `P17-table`
  - Task: P17: Table and DataGrid wrapper becomes overflow-x-auto; expose `containerProps` (className/style/aria-label) for the wrapper. Only the non-interactive Table's wrapper becomes a focusable named region (role='region', tabIndex=0, aria-labelledby caption or aria-label) when scrollable; DataGrid's wrapper gets no tabIndex (its roving cell stop already satisfies scrollable-region-focusable, and a second Tab stop is avoided). Rows/headers get the inset focus ring (focusRingInset); rounded-lg -> rounded-md (C-RADIUS).
- **table-core#18** [important/type-design] SlotObject<T> declares only as/children/className/style with `as?: T`, so TypeScript rejects the documented `as` override and the arbitrary HTML attributes that…
  - Owners: `F2-lib`, `P02-field-text`, `DOCS`
  - Task: F2: SlotObject<T> = {as?, children?, className?, style?} & Omit<ComponentPropsWithoutRef<T>, 'children'|'className'|'style'>; Slot accepts Iterable<ReactNode>; isSlotObject excludes React elements, iterables (Symbol.iterator) and thenables, so Sets, arrays and generators render as children and a Promise is passed through as a node; `true` renders nothing; type tests for {src,alt} on Slot<'img'> and {as:'div'} on Slot<'span'>; runtime tests for Set and generator slots. P02: SearchBox `dismiss` typed `Slot<'span'> | SlotObject<'button'>` (the button-object form is deprecated but still compiles; its button-only props merge onto the wired clear button with a dev warning); content renders inside the wired clear button. DOCS: README/guide slot wording matches.
- **table-core#19** [important/test-gap] DataGrid and Table tests miss keyboard selection, single-mode replacement, controlled selection/sort round-trips, sort-state transitions, and any DataGrid axe or…
  - Owners: `P17-table`, `F3-hooks-provider`
  - Task: P17: add a second sortable column and tests: Space sorting, column switch resets ascending, aria-sort after clicks, non-sortable header, controlled sort/selection round-trips, keyboard selection, nested controls not toggling, handler composition; testSystemProps(DataGrid) with header+body fixture and a11yVariants (selection single/multiple, sorted); Table defaultProps gets Header + striped variant. F3: useControllable StrictMode + functional-updater tests (shared with table-core#3).
- **table-core#20** [important/test-gap] No overlay test runs axe in the open state, and the shared testA11y helper scans `container`, so it passes without checking anything for portaled Dialog and Drawer.
  - Owners: `F6t-test-infra`, `P15-modal`, `P16-popups`
  - Task: F6t: one shared `axe` instance built with configureAxe({ rules: { region: { enabled: false } } }) (component-in-isolation scope; landmark rules are page-level) used by testA11y, the a11yVariants loop, expectNoA11yViolations and the stories gate; testA11y scans document.body by default (option a11yScope:'container'|'document') so portaled content is audited; test-setup runs RTL cleanup and fails the test if document.body still has children afterwards (no portal leftovers audited by later tests); test-utils.test proves that a bare <button> and <div><p>Hello</p><Button/></div> on body pass. P15: open-state axe tests for Dialog (with and without title+aria-label) and Drawer. P16: open-state axe tests for Popover, TeachingPopover and a visible Tooltip.
- **table-core#21** [suggestion/a11y] The multi-select DataGrid does not set aria-multiselectable='true' on its role='grid' element.
  - Owners: `P17-table`
  - Task: P17: aria-multiselectable={selectionMode==='multiple' || undefined} on the grid; test.
- **table-core#22** [suggestion/bug] Uncontrolled DataGrid and List keep the ids of removed rows or items selected and keep reporting them in onSelectionChange.
  - Owners: `P17-table`, `P08-list-tag`
  - Task: P17: rows register ids via context; the effective selection is derived during render as selected ∩ registered row ids (no pruning effect, C-HOOKS); toggle and select-all compute from the effective set, so the next change emits a pruned value; test removing a selected row (select-all state and the next onSelectedItemsChange payload exclude it). P08: List does the same for items (register values); test removing a selected item.
- **table-core#23** [suggestion/performance] useControllable's setValue gets a new identity on every render when onChange is inline, which re-subscribes Popover/Dialog/Drawer document listeners and invalidates…
  - Owners: `F3-hooks-provider`, `P16-popups`, `P15-modal`, `P17-table`
  - Task: F3: setValue identity stable ([] deps; latest onChange via useEventCallback; value via ref); test identity across rerenders with inline onChange. P16/P15: overlay listeners come from useDismiss/useFocusTrap (stable registration keyed on `open` only); test listener count does not change across parent re-renders (spy on document.addEventListener). P17: onSortChange/onSelectionChange read through useEventCallback; ctx memo deps stable.
- **table-core#24** [suggestion/performance] DataGrid keeps sort and selection state in one context, so toggling one row or clicking a sort header re-renders every row.
  - Owners: `P17-table`
  - Task: P17: split DataGridSortContext and a selection store (useSyncExternalStore with per-row selector `isSelected(rowId)`), so toggling a row re-renders only that row and sort clicks re-render only header cells; render-count test with React Profiler or a render spy.
- **table-core#25** [suggestion/performance] Table, List, Accordion, Tree, Nav, RadioGroup, TabList, Popover and Dialog pass a new object literal to their context providers on every render, re-rendering every…
  - Owners: `P17-table`, `P08-list-tag`, `P09-disclosure`, `P13-menu-nav`, `P03-choice`, `P16-popups`, `P15-modal`, `P10-carousel-overflow`, `P12-messages`
  - Task: Each owner applies C-MEMO: wrap every context provider value in React.useMemo (stable setters from F3). P17: Table drops the striped context and stripes via `[&>tbody>tr:nth-child(odd)]` classes on the table (or data attribute). P10: delete the unused CarouselContext. P08 List, P09 Accordion/Tree/TabList, P13 Nav, P03 RadioGroup, P16 Popover, P15 Dialog, P12 Toaster: memoize.
- **table-core#26** [suggestion/test-quality] The shared testClassName helper only checks that 'my-custom-class' is present, so it verifies neither that default classes survive nor that user classes win on…
  - Owners: `F6t-test-infra`
  - Task: F6t: testClassName renders once without className and asserts every baseline class survives with className; optional config `conflictingClass: { className: 'p-8', overrides: 'p-4' }` asserts user class wins and default is gone; reword helper comments (building blocks, not public API).
- **table-core#27** [suggestion/test-quality] Slot className merge tests use non-conflicting classes, so they cannot catch a reversed cn() merge order in resolveSlot/renderSlot.
  - Owners: `F2-lib`
  - Task: F2: slot tests with conflicting classes: resolveSlot({className:'px-2'},'span','px-4').props.className === 'px-2'; same for renderSlot.
- **table-core#28** [suggestion/test-quality] useControllable tests can't catch a reversed controlled/uncontrolled warning, leave the uncontrolled-to-controlled branch and controlled prop updates untested, and…
  - Owners: `F3-hooks-provider`
  - Task: F3: warning test asserts the warnOnce message text names the direction in the right order (toHaveBeenCalledWith(expect.stringContaining('A component is changing from controlled to uncontrolled.')) with the reverse substring absent, plus the `[WaveUI] ` prefix) and the reverse case (§2.3: one warnOnce string per direction, not console arguments, because F2 warnOnce(key, message) passes no extra console arguments); spy restored in afterEach; rerender({value:'b'}) -> result[0]==='b'.
- **table-core#29** [suggestion/test-quality] The useRovingTabIndex test harness hard-codes orientation and loop, so the hook's own defaults, 'both' orientation, start-boundary clamping, preventDefault and the…
  - Owners: `F3-hooks-provider`
  - Task: F3: test harness forwards orientation/loop only when set; tests for hook defaults, 'both', loop=false start boundary + Home/End, preventDefault on handled keys (fireEvent.keyDown returns false) but not Tab, activeValue resync then arrow.
- **table-core#30** [suggestion/comments] useRovingTabIndex carries an orphaned JSDoc block (lines 3-14) with a wrong @returns and a false Toolbar consumer claim, and the name `enabledItems` suggests…
  - Owners: `F3-hooks-provider`
  - Task: F3: delete the orphaned JSDoc block, fix @returns, remove the Toolbar claim until P01 actually uses it (then re-add), rename enabledItems (hook now filters disabled items itself).
- **table-core#31** [suggestion/type-design] useEventCallback accepts `fn: T | undefined` but casts its wrapper `as T`, so its declared return type is wrong when fn is undefined.
  - Owners: `F3-hooks-provider`
  - Task: F3: useEventCallback<Args extends unknown[], R>(fn: ((...args: Args) => R) | undefined): (...args: Args) => R | undefined (overload returning (...args)=>R when fn is required); no `any`; type tests.
- **table-core#32** [suggestion/api-design] Table and DataGrid give equivalent sub-components different names (Head/HeadCell vs Header/HeaderCell).
  - Owners: `P17-table`, `INTEGRATION`
  - Task: P17: Table exposes Header/HeaderCell (TableHeaderProps/TableHeaderCellProps) with Head/HeadCell kept as deprecated aliases (warnDeprecated on first render); tests for both names. INTEGRATION: export the new prop types.
- **table-core#33** [suggestion/packaging] ResolvedSlot, the return type of the public resolveSlot, is not exported from the package entry.
  - Owners: `INTEGRATION`, `F2-lib`
  - Task: F2: ResolvedSlot keeps its public shape `{ Component, props, children }` (unchanged) and stays exported from src/lib/slot.ts and re-exported from src/lib/types.ts. INTEGRATION: add ResolvedSlot to the type exports in src/index.ts.
- **table-core#34** [suggestion/comments] useId's JSDoc and the guide show the React 18 ':r0:' ID format, but React 19.2 produces '_r_0_'.
  - Owners: `F3-hooks-provider`, `DOCS`
  - Task: F3: useId JSDoc says `button-<react id>` without a literal format. DOCS: WAVE-UI-GUIDE.md:507 same fix.
- **table-core#35** [suggestion/docs] src/index.ts and WAVE-UI-GUIDE.md still refer to the old 'waveui' package name, and CHANGELOG has no entry for the rename to @mortenbrudvik/waveui.
  - Owners: `INTEGRATION`, `DOCS`
  - Task: INTEGRATION: src/index.ts header comment -> '@mortenbrudvik/waveui/styles'; remove the transitional re-export comment. DOCS: guide lines 17/737 use @mortenbrudvik/waveui; CHANGELOG 0.5.0 notes the package rename.

### input-basic

- **input-basic#1** [critical/a11y] Field labels, errors and consumer aria-labels never reach the focusable control of composite inputs (SpinButton, SearchBox, Checkbox, Switch, RadioGroup, Rating,…
  - Owners: `F5-listbox-field`, `P02-field-text`, `P03-choice`, `P04-spin-color`, `P05-listbox`, `P06-datetime`, `F6t-test-infra`, `INTEGRATION`
  - Task: F5: FieldContext + useFieldControl (§2.5) returning merged id/aria-labelledby/aria-describedby/aria-invalid/aria-required/required; aria-labelledby=field.labelId is added whenever the resolved id differs from field.controlId (control not the first child, or carrying its own id), so the control is always named; plus the test helper renderWithFieldContext(ui, value) in src/test-utils-field.tsx. P02: Field provides FieldContext (and merge-clones native children); SearchBox routes id/aria-*/name/autoComplete/etc. to the <input> (C-ROUTING); P02 tests use the real Field. P03: Checkbox/Switch route to the role=checkbox/switch button, RadioGroup/Rating to the radiogroup (aria-labelledby strategy). P04: SpinButton routes to the input and drops hard-coded aria-label='Value'; ColorPicker/SwatchPicker label their group. P05: Combobox/Dropdown/TagPicker route to the combobox element. P06: DatePicker/TimePicker route to the input. P03–P06 test Field consumption with renderWithFieldContext (label via controlId/labelId, hint, error, required), never the in-flight real Field (§5.9); every package queries getByRole(role,{name}). F6t: testSystemProps `control: {role}` option so testRestSpread asserts aria-label on the control and data-testid on the root. INTEGRATION: the real <Field> around every P03–P06 control (label name, description, invalid, required) and Field > Tooltip > Input carrying its own id.
- **input-basic#2** [critical/bug] SpinButton parses and clamps on every keystroke, so users can't clear the field, type negatives or decimals, or enter multi-digit values when min is larger than the…
  - Owners: `P04-spin-color`
  - Task: P04: SpinButton keeps a draft string while editing; parse/clamp/commit on blur and Enter; revert (and aria-invalid while invalid) when unparseable; resync draft when value changes externally; typing tests (min=10 type 50, '1.5', '-3', clear+blur, non-numeric).
- **input-basic#3** [important/bug] SpinButton increment/decrement accumulate floating-point error with decimal steps (e.g. 0.30000000000000004).
  - Owners: `P04-spin-color`
  - Task: P04: round to max(decimals(step), decimals(value)) before clamping; tests step=0.1 up/down and reaching a decimal max disables increment.
- **input-basic#4** [important/a11y] SpinButton's role=spinbutton input ignores ArrowUp/Down, Home/End and PageUp/PageDown, and its +/- buttons take focus and then drop it when they become disabled.
  - Owners: `P04-spin-color`
  - Task: P04: input onKeyDown: ArrowUp/Down ±step, PageUp/PageDown ±(step*10 or `largeStep` prop), Home/End min/max when finite, preventDefault; +/- buttons keep their accessible names but get tabIndex={-1} so focus stays on the spinbutton; keyboard tests incl. clamping.
- **input-basic#5** [important/a11y] SpinButton's text input removes the outline and shows no replacement focus indicator.
  - Owners: `P04-spin-color`
  - Task: P04: wrapper gets focus-within:border-b-2 focus-within:border-b-primary (inputFocusWithin recipe) and the input uses focus:outline-hidden (never bare outline-hidden, C-FOCUS); test asserts classes.
- **input-basic#7** [important/a11y] Unchecked Checkbox/Radio borders and the off-state Switch track and thumb use #d1d1d1 (--input), about 1.5:1 against their surroundings and below WCAG 1.4.11's 3:1.
  - Owners: `F1-tokens`, `P03-choice`, `P02-field-text`
  - Task: F1: --wave-stroke-accessible (#616161 / #adadad / #ffffff; 6.19:1 / 6.48:1 / 21:1). P03: Checkbox and Radio borders border-stroke-accessible; Switch off = transparent track with border-stroke-accessible and bg-stroke-accessible thumb. P02: Input/Select/Textarea keep border-input sides with border-b-stroke-accessible; tests assert classes.
- **input-basic#8** [important/a11y] Checkbox's checkmark and indeterminate glyphs and Switch's checked thumb are hard-coded white on bg-primary and ignore --primary-foreground, about 1.46:1 in high…
  - Owners: `P03-choice`, `F1-tokens`, `P07-identity`, `P14-pagination-stepper`
  - Task: F1: status foreground tokens (success/warning/error/severe/info -foreground, presence-glyph). P03: Checkbox glyphs stroke='currentColor' with text-primary-foreground; checked Switch thumb bg-primary-foreground. P07: Badge/CounterBadge/Avatar/PresenceBadge use *-foreground tokens instead of text-white/bg-white. P14: Pagination current page and Stepper active circle use text-primary-foreground.
- **input-basic#9** [important/a11y] There is no forced-colors (Windows High Contrast) support, so the Switch state, ProgressBar fill, DatePicker focused day and input focus styles disappear.
  - Owners: `F2-lib`, `P03-choice`, `P11-primitives`, `P06-datetime`, `P05-listbox`, `DOCS`
  - Task: F2: forcedColors recipes in src/lib/styles.ts split into leaf indicators (`forcedColors.selectedLeaf` with forced-color-adjust-none: Switch thumb, check glyph, progress fill, selected day cell) and containers (`forcedColors.selectedContainer`: Highlight border/outline indicator, never forced-color-adjust-none, because that property inherits to descendants); `focus:outline-hidden` focus recipes (never bare `outline-hidden`, C-FOCUS). P03: Switch forced-colors border ButtonText, checked track Highlight, thumb HighlightText; Checkbox/Radio checked Highlight (leaf). P11: ProgressBar fill forced-colors:bg-[Highlight] (leaf) + track border. P06: DatePicker focused/selected day use outline + Highlight (leaf). P05: TagPicker focus uses outline not ring; options use the container recipe; all replace focus:outline-none with focus:outline-hidden. DOCS: guide forced-colors section describes what is implemented.
- **input-basic#11** [important/bug] RadioGroup finds items only among its direct children, so RadioItems inside a Fragment or wrapper leave no radio in the tab order.
  - Owners: `P03-choice`
  - Task: P03: RadioGroup stops scanning children; uses useRovingTabIndex DOM mode ([data-roving-value] on each RadioItem button, disabled skipped) so RadioItems inside Fragments/wrappers work; test with Fragment- and wrapper-wrapped items.
- **input-basic#12** [important/bug] Checkbox, Switch, RadioGroup and the other custom value controls can't take part in native forms: there are no name/value/required/form props and no hidden input, and…
  - Owners: `F5-listbox-field`, `P03-choice`, `P04-spin-color`, `P05-listbox`, `P06-datetime`, `DOCS`
  - Task: F5: <HiddenInput> + useFormReset (§2.5): rendered only when the consumer passes `name` or `required`; required single-choice groups use a required `type='radio'` input (correct validation message), booleans `checkbox`, free values `text`; the input is absolutely positioned inside the control's relative root so the validation bubble points at the control; useFormReset(controlRef, onReset) finds the form from the control element (`form` attribute, else closest('form')), so uncontrolled controls without a name still reset. P03: Checkbox/Switch/RadioGroup/Rating accept name, value, required, form and render HiddenInput; RadioGroup has no default name (its useId stays internal, so existing forms get no extra FormData field); form reset restores defaults. P04: SpinButton, SwatchPicker, ColorPicker same. P05: Combobox, Dropdown, TagPicker (one input per value). P06: DatePicker (ISO yyyy-mm-dd), TimePicker (HH:mm). Each: FormData test, reset test (also without name), required test; P03 adds a test that a RadioGroup without name adds nothing to FormData. DOCS: CLAUDE.md documents the pattern.
- **input-basic#13** [important/convention] RadioItem breaks the component conventions: no ref, no displayName, props that don't extend native button attributes, and no RadioGroup.Item attachment.
  - Owners: `P03-choice`, `INTEGRATION`
  - Task: P03: RadioItem takes ref, props extend Omit<ButtonHTMLAttributes,'value'|'onChange'> spread onto the role=radio button (className stays on the label, `labelClassName` optional), displayName 'RadioItem'; RadioGroup = Object.assign(Root,{Item: RadioItem}); RadioGroup gains disabled and name via context. INTEGRATION: keep RadioItem named export, export new types.
- **input-basic#14** [suggestion/a11y] RadioGroup handles only one arrow axis based on orientation, whereas the APG radio pattern uses all four arrow keys.
  - Owners: `P03-choice`, `F3-hooks-provider`
  - Task: F3: 'both' orientation supported. P03: RadioGroup passes orientation 'both' (orientation prop only drives layout + aria-orientation); tests Left/Right in vertical and Up/Down in horizontal.
- **input-basic#15** [important/bug] Field overwrites the child's own id, aria-describedby and aria-invalid (sometimes with undefined), and its tests would pass even without id or aria-required injection.
  - Owners: `P02-field-text`
  - Task: P02: Field merges instead of overwriting: controlId = child.props.id ?? htmlFor ?? fieldId (label uses it), describedby = joinIds(child's, error/hint), aria-invalid = child's ?? (error ? true : undefined) (revision 3: the child's own value wins), aria-required only when required; only defined keys passed to cloneElement; only first element child receives id (dev warning for >1). Tests without htmlFor (getByLabelText), aria-required, toHaveAccessibleDescription, preserved child id/describedby. Decision (wave D, lead): component first children keep receiving aria-required, and wrapper components go inside a plain element (§5.1 item 2).
- **input-basic#16** [suggestion/a11y] Field's required prop sets only aria-required, not native required, and its visual asterisk is read aloud by screen readers.
  - Owners: `P02-field-text`
  - Task: P02: asterisk aria-hidden; Field injects native `required` for intrinsic form-control children and via FieldContext.required for library controls; Input, Select, Textarea and Slider call useFieldControl(props, { nativeRequired: true }) so `<Field required><Input/></Field>` sets the native attribute; tests incl. Field + library Input asserting `required` and native validity (validity.valueMissing).
- **input-basic#17** [suggestion/a11y] Field's validation error message isn't a live region, so screen readers don't announce it when it appears.
  - Owners: `P02-field-text`
  - Task: P02: error message rendered with role='alert' (hint stays plain); test that error text is in an alert and linked via aria-describedby.
- **input-basic#18** [suggestion/bug] A consumer onClick on Checkbox or Switch fires twice when the label text is clicked, because rest props are spread onto the wrapping <label>.
  - Owners: `P03-choice`
  - Task: P03: consumer onClick routed to the inner control (composed with toggle) not the label; test label-text click fires onClick once.
- **input-basic#19** [important/a11y] Clearing SearchBox unmounts the focused clear button, so keyboard focus falls to <body>.
  - Owners: `P02-field-text`
  - Task: P02: SearchBox keeps an internal input ref (useMergedRefs with controlRef) and focuses it in handleClear; test focus after clearing.
- **input-basic#20** [suggestion/a11y] SearchBox's 16x16 clear button and Rating's small and extra-small stars are below the WCAG 2.5.8 24px minimum target size.
  - Owners: `P02-field-text`, `P03-choice`
  - Task: P02: SearchBox clear button h-6 w-6 (icon 16px) with pe-9 input padding. P03: Rating small/extra-small stars get padding/gap so each target >=24x24. Tests assert classes.
- **input-basic#22** [suggestion/a11y] Rating and horizontal RadioGroup don't mirror ArrowLeft/ArrowRight under dir='rtl'.
  - Owners: `P03-choice`, `F2-lib`
  - Task: F2: getDirection/getArrowIntent helpers. P03: Rating (and RadioGroup via F3 hook) swap Left/Right under rtl; tests with dir=rtl.
- **input-basic#23** [suggestion/bug] Rating's hover preview gets stuck if the control becomes disabled while hovered, so the stars no longer match the value.
  - Owners: `P03-choice`
  - Task: P03: displayValue = disabled ? value : (hovered || value); clear hovered when disabled becomes true; onMouseLeave always resets; test.
- **input-basic#24** [important/a11y] The error string on Input, Select and Textarea is documented as a message but is never rendered or announced; only the border turns red.
  - Owners: `P02-field-text`, `DOCS`
  - Task: P02: Input/Select/Textarea: `error` accepts string | boolean. A non-empty string (when no FieldContext.hasErrorMessage) renders a Fragment: the control (root, ref and className unchanged) followed by a sibling `<span id role='alert'>` message (text-caption-1 text-error) whose id is joined into aria-describedby and aria-errormessage; `errorMessageProps` (className/id/…) customises the message element; `error={true}` keeps the flag-only 0.4 look. Inside a Field that renders the error nothing is duplicated. Listed in §7.3/CHANGELOG (visible message + extra sibling node). JSDoc, stories and tests (toHaveAccessibleDescription) updated. DOCS: README/guide text about `error` (input-basic.docs.15): a string renders a message, use Field for layout, `true` for flag-only.
- **input-basic#29** [suggestion/api-design] Value-change callbacks are inconsistent: onChange is the native event on Input and Slider but the value on SearchBox, and other controls each use a different name…
  - Owners: `P02-field-text`, `P03-choice`, `P04-spin-color`, `P05-listbox`, `P06-datetime`, `P10-carousel-overflow`, `F2-lib`, `DOCS`
  - Task: C-NAMING: onChange = native event only; value callbacks are onValueChange/onCheckedChange/onOpenChange; old names kept as deprecated aliases via F2 warnDeprecated (value aliases via resolveDeprecatedProp called directly during render, which warns once per key, C-DEV; no effect needed). Value callbacks fire only on change (useControllable), and so do the deprecated value aliases named onChange, which are called from the same useControllable callback; deprecated event-named aliases keep 0.4 semantics (every activation). P02: SearchBox onValueChange (onChange alias), Slider and Input gain onValueChange(value) alongside native onChange. P03: Checkbox/Switch onCheckedChange, RadioGroup/Rating onValueChange. P04: SpinButton/ColorPicker/SwatchPicker onValueChange. P05: Combobox/Dropdown onValueChange (change-only) with the `onOptionSelect` alias still firing on every option activation, including re-selecting the current option (regression test); TagPicker onValueChange. P06: DatePicker/TimePicker onValueChange. P10: Carousel already compliant (no change beyond docs/test). DOCS: rule in CLAUDE.md + migration table in CHANGELOG, including the change-only vs every-activation difference. Each: test that the alias still works and warns once.
- **input-basic#30** [important/test-gap] The Combobox, Dropdown and TagPicker test suites never run axe and lack keyboard, disabled-option, OptionGroup and controlled-mode tests, and their rest-spread tests…
  - Owners: `P05-listbox`, `P04-spin-color`
  - Task: P05: testSystemProps/testA11y for all three suites (closed, open listbox via a11yVariants with defaultOpen/open, TagPicker with a selected tag); rest-spread tests rewritten to getByRole('combobox',{name}); keyboard (ArrowUp/Down/Enter/Space/Escape/Home/End), aria-activedescendant, disabled options, OptionGroup, freeform filter+Enter, controlled label, disabled TagPicker remove buttons. P04: ColorPicker preset keeps opacity test.
- **input-basic#31** [important/test-gap] DatePicker and TimePicker keyboard paths and open-state accessibility are untested, and TimePicker's ArrowDown path would throw in jsdom because scrollIntoView isn't…
  - Owners: `P06-datetime`, `F6t-test-infra`
  - Task: F6t: test-setup stubs Element.prototype.scrollIntoView (vi.fn). P06: DatePicker grid keyboard tests (arrows, Page, Shift+Page, Home/End, Enter/Space, Escape, focus assertions), TimePicker listbox keyboard tests with aria-activedescendant, blur parsing with a day-first locale (`locale='en-GB'`: typing 03/04/2025 commits 3 April; format/parse round-trip) and with a custom formatDate but no parseDate (dev warning; the default parser for `locale` is used), maxDate, controlled open; axe on open calendar and listbox.
- **input-basic#32** [important/test-gap] An already-open DatePicker calendar stays interactive when disabled becomes true, and the disabled test checks only the closed state.
  - Owners: `P06-datetime`
  - Task: P06: popup rendered only when open && !disabled; day buttons disabled when picker disabled; selectDate returns early when disabled; test rerendering an open picker as disabled -> no grid, no onValueChange.
- **input-basic#33** [suggestion/test-quality] DatePicker's 'selects a date on click' test depends on the real clock and makes weak assertions, and onOpenChange is never asserted.
  - Owners: `P06-datetime`
  - Task: P06: pin the month with defaultValue/vi.setSystemTime, assert exact getTime(), onOpenChange(false), grid closes and input shows formatted date (uncontrolled); clear test asserts input empties.
- **input-basic#34** [suggestion/test-gap] firstDayOfWeek is untested, and the day-of-week header test checks only that the labels exist, not their order or alignment with the grid.
  - Owners: `P06-datetime`
  - Task: P06: firstDayOfWeek={1} test asserts columnheader order Mo..Su and first-row dates; header labels come from Intl (input-datetime#19) so assert via abbr/aria.
- **input-basic#35** [suggestion/test-quality] TimePicker's filter test passes even if filtering is removed.
  - Owners: `P06-datetime`
  - Task: P06: filter test asserts exact option list and absence of '2:00 PM'; '13:' with 12h format; no-match case renders no listbox and aria-expanded=false.
- **input-basic#36** [important/test-quality] RadioGroup's axe checks never render a RadioItem, and its 'disabled' a11y variant uses a prop RadioGroup doesn't have.
  - Owners: `P03-choice`
  - Task: P03: RadioGroup testSystemProps defaultProps with two RadioItems + aria-label; a11yVariants with a disabled item and a selected value; radios queried by name.
- **input-basic#37** [suggestion/test-quality] RadioGroup's roving-tabindex tests are weak: the disabled-exclusion test is tautological, and the arrow-key tests never assert selection state.
  - Owners: `P03-choice`
  - Task: P03: replace tautological disabled test with no-default + disabled first item (second item tabindex 0, receives Tab); arrow tests assert aria-checked='true' and tabindex='0' on the new item.
- **input-basic#38** [suggestion/test-quality] Rating tests skip testSystemProps, expect a spurious onChange at the bounds, and don't cover the hover preview or ArrowUp/ArrowDown.
  - Owners: `P03-choice`
  - Task: P03: testSystemProps for Rating and RatingDisplay; bounds tests assert unchanged aria-checked and NO onValueChange or deprecated onChange (no-op suppressed; the alias is change-only, C-NAMING); hover/unhover and ArrowUp/Down tests.
- **input-basic#39** [suggestion/test-quality] SearchBox's controlled-value and clear tests use assertions too weak to catch regressions.
  - Owners: `P02-field-text`
  - Task: P02: toHaveBeenCalledWith('fixedx'); clear test asserts empty input and removed clear button; controlled clear test asserts onValueChange('') and onClear.
- **input-basic#40** [suggestion/test-quality] Label, Switch and Checkbox tests contain assertions that can't fail: the Label size variants, the Switch role check and the Checkbox label-span class query.
  - Owners: `P02-field-text`, `P03-choice`
  - Task: P02: Label size tests assert text-caption-1/text-body-1/text-body-2. P03: delete Switch role tautology; Checkbox label query replaced by toHaveAccessibleName.
- **input-basic#41** [important/test-quality] ColorPicker's hex-input tests check only the local text, so they would pass if the color were never committed, and the revert test types the wrong string.
  - Owners: `P04-spin-color`
  - Task: P04: hex input tests assert onValueChange('#abcdef') and preview/preset state; keep-and-flag test: '#zzz' typed over a select-all never reaches onValueChange, is flagged while typing (aria-invalid plus the hexError description) and stays flagged after blur, as input-pickers#24 requires (no silent discard, WCAG 3.3.1).
- **input-basic#42** [suggestion/test-quality] SwatchPicker's shape and size tests pass even when the props are ignored.
  - Owners: `P04-spin-color`
  - Task: P04: shape/size tests assert observable classes (rounded-none, w-6...); add radiogroup keyboard test and controlled click test (value stays until parent updates).
- **input-basic#43** [suggestion/test-quality] TagPicker's ARIA test checks only that aria-controls exists, not what it references, and aria-activedescendant and aria-expanded are unverified.
  - Owners: `P05-listbox`
  - Task: P05: assert aria-controls equals listbox id, aria-activedescendant equals first option id after ArrowDown, aria-expanded='false' when every option is selected.

### input-pickers

- **input-pickers#1** [critical/bug] Combobox and Dropdown ignore Options nested in OptionGroup, so grouped options can't be clicked, reached by keyboard or shown as selected.
  - Owners: `F5-listbox-field`, `P05-listbox`, `F6t-test-infra`
  - Task: F5: useListbox children mode: Options register via ListboxContext (useListboxOption) in DOM order, nested OptionGroup included; registrations made during a commit are collected without notifying and published once from the listbox root's layout effect (which runs after its children's); later additions/removals coalesce into one publish per microtask; keyed reorders (memoized options included) re-sort through the root's commit check and a MutationObserver on the options' common ancestor; all options live in a single container at a time (dev warning key useListbox:single-container). P05: Option/OptionGroup move to new src/components/input/Option.tsx (re-exported from Combobox.tsx); Option calls useListboxOption(props, ref) and spreads optionProps (onClick composed with the consumer's) inside the root's <ListboxContext.Provider value={listbox.context}> (no cloneElement); they are exported as Option = markListboxElement(OptionImpl, 'option') and OptionGroup = markListboxElement(OptionGroupImpl, 'group') (§2.5 consumer contract); OptionGroup renders <li role='presentation'><div id role='presentation'>label</div><ul role='group' aria-labelledby>..</ul></li>; remove unused ComboboxContext; click and ArrowDown+Enter tests for grouped options in Combobox and Dropdown; Dropdown trigger shows grouped option label; keyed-reorder tests run outside React.StrictMode (React DEV re-runs the effects of moved fibers there). F6t: testCompoundExposure also asserts displayName on each sub-component.
- **input-pickers#2** [critical/bug] Combobox (with freeform filtering) and Dropdown (with any non-Option child) highlight one option while Enter/Space commits a different one.
  - Owners: `F5-listbox-field`, `P05-listbox`, `P06-datetime`
  - Task: F5: one navigable option list (registered/filtered/rendered) drives bounds, highlight (by value) and Enter commit; the active value is derived against that list during render and reset on close/select (no clamping effect). P05: Combobox and Dropdown use it; tests: type 'be', ArrowDown, Enter selects 'b'; Dropdown with conditional non-Option child keeps highlight == committed. P06: TimePicker migrates to useListbox (items mode) keeping its filter-aware behavior; regression test.
- **input-pickers#3** [critical/a11y] Combobox, Dropdown and TimePicker never set aria-activedescendant or give options ids, so screen readers never hear which option is keyboard-highlighted.
  - Owners: `F5-listbox-field`, `P05-listbox`, `P06-datetime`, `DOCS`
  - Task: F5: stable option ids from getOptionId(value) = `${listboxId}-opt-${n}` where n is a per-listbox counter assigned the first time a value registers (stable across filtering), activeDescendantId only while open. P05: Combobox/Dropdown/TagPicker set aria-activedescendant on the combobox element; P06: TimePicker same; tests assert it follows ArrowDown and clears on close. DOCS: README Combobox description ('filterable combobox with autocomplete') and guide aria-activedescendant section accurate.
- **input-pickers#6** [critical/bug] Combobox shows the raw option value instead of its label whenever the value comes from `value` or `defaultValue`.
  - Owners: `F5-listbox-field`, `P05-listbox`
  - Task: F5: `collectOptionLabels(children)` — a read-only render-time walk of the elements of components marked with markListboxElement(component, 'option' | 'group') (label → textValue → string children), recursing into group elements and Fragments — used for display text whenever the registry does not know a value yet (server render, first client render, hydration). P05: Option/OptionGroup are exported through markListboxElement (without the marks the renderToString tests fail); Combobox and Dropdown display text = listbox.getItem(value)?.label ?? collectOptionLabels(children).get(value) ?? (freeform only) raw value, for initial, controlled and committed values; closed listboxes render inline and hidden, and only the open surface is portaled, never both (§5.5). Tests: value='us', defaultValue='us', stateful controlled wrapper, and renderToString of Dropdown and of Combobox with defaultValue='us' containing 'United States'.
- **input-pickers#7** [important/bug] Controlled Combobox keeps showing an option label the parent rejected, and resetting to the same value doesn't clear it.
  - Owners: `P05-listbox`
  - Task: P05: Combobox draft model: `draft: string | null` set only while typing, cleared on commit/blur/Escape; otherwise input shows label of current value, so a rejected or same-value controlled commit re-syncs; tests with a parent that ignores onValueChange and one that resets to ''.
- **input-pickers#8** [important/bug] Non-freeform Combobox lets the user type text that neither filters the list nor updates or reverts the selection, while still announcing aria-autocomplete="list".
  - Owners: `P05-listbox`, `DOCS`
  - Task: P05: Combobox filters in both modes (Fluent behavior): typing filters options, aria-autocomplete='list'; non-freeform blur/Escape restores the selected label (draft cleared) and never commits free text; tests. DOCS: README/JSDoc wording.
- **input-pickers#11** [important/a11y] Dropdown lacks the APG select-only combobox keys: ArrowUp doesn't open it, there is no Home/End or typeahead, and the active option isn't synced to the selection on open.
  - Owners: `P05-listbox`, `F5-listbox-field`
  - Task: F5: useListbox mode 'select-only' implements APG select-only keys (ArrowUp/Down/Home/End/typeahead open and position, Alt+ArrowUp commit+close, Tab commits active, activeIndex starts at selected on open and resets on close); for button-based comboboxes it calls preventDefault on Enter keydown and on Space keydown and keyup (the keyup through UseListboxResult.onKeyUp), so the native button click does not toggle the listbox again; in editable mode Enter with the listbox closed is not prevented (forms still submit). P05: Dropdown uses it, attaching both onKeyDown and onKeyUp (composed with the consumer's, C-COMPOSE) to its <button>; tests per key, including Enter/Space not reopening after a commit and Enter in a closed Combobox submitting its form.
- **input-pickers#12** [important/bug] Combobox, Dropdown and TagPicker never clear their blur timer on refocus, so the listbox closes while the input still has focus.
  - Owners: `P05-listbox`, `F4-overlay`
  - Task: F4: useDismiss focusOutside option (focusin outside layer + its descendant layers). P05: Combobox/Dropdown/TagPicker drop all blur timers; close via useDismiss (focus outside, outside press, Escape); TagPicker remove-button flow keeps list open; tests (no fake-timer dependence).
- **input-pickers#13** [important/bug] A disabled TagPicker still lets keyboard users tab to its tag remove buttons and use them, which changes the value.
  - Owners: `P05-listbox`
  - Task: P05: disabled TagPicker: remove buttons disabled, addTag/removeTag/keydown return early, aria-disabled on the combobox wrapper group; keyboard test that remove buttons are not tabbable.
- **input-pickers#14** [important/a11y] TagPicker adds and removes tags (including Backspace deletion) without any announcement, and the selected chips aren't exposed as a group linked to the input.
  - Owners: `P05-listbox`, `F3-hooks-provider`
  - Task: F3: useAnnounce/announce: announcer regions (data-wave-announcer, exempt from modal isolation) are created on first use — hook mount or the first announce() call — and a message written while the regions are being created is set on the next animation frame, so an early announce() is not lost. P05: TagPicker renders the selected tags as a role='list' named 'Selected'; the input's aria-describedby points to a hidden summary element 'Selected: <label>, <label>' (present only while tags exist), so the description does not read every 'Remove …' button name; announces 'X added, n selected' / 'X removed, n selected'; Backspace on empty query moves focus to the last chip first (second Backspace/Delete removes); tests with announcer spy. The strings 'Selected', 'Selected: …', 'Remove <label>', 'No matches' and the announcements are hard-coded English, as in 0.4 and the rest of the library; localisation props are a candidate for a later item, not 0.5 scope.
- **input-pickers#15** [important/bug] ColorPicker keeps opacity as separate local state, so the slider, the preview and the emitted color disagree.
  - Owners: `P04-spin-color`
  - Task: P04: opacity derived from the value alpha byte; single commit(hexRgb, opacity) path; preset compare on color.slice(0,7); non-hex values normalized or rejected with dev warning; tests for preset keeps opacity, 9-char default value, 'red' input.
- **input-pickers#16** [important/a11y] ColorPicker's selected preset has no visible indicator by default because its primary-colored border sits on a primary-colored swatch, and SwatchPicker's white…
  - Owners: `P04-spin-color`
  - Task: (No new token needed: ring-foreground/ring-offset-background exist after F1.) P04: selected preset/swatch shows ring-2 ring-offset-2 ring-foreground ring-offset-background plus a check glyph colored by luminance (black/white chosen via a small luminance helper, not tokens: allowed exception documented in C-TOKENS for user-supplied swatch colors); test selected indicator present and not color-only.
- **input-pickers#17** [important/a11y] SwatchPicker, the ColorPicker presets and Rating use role=radiogroup without useRovingTabIndex, so every swatch is a Tab stop and arrow keys don't work (Rating never…
  - Owners: `P04-spin-color`, `P03-choice`, `F3-hooks-provider`
  - Task: F3: useRovingTabIndex DOM mode with orientation 'both' and tabStop 'active'. P04: SwatchPicker uses it (select on focus move, RTL-aware); ColorPicker renders its presets through SwatchPicker (no duplicated markup). P03: Rating moves focus between radios (roving; container not a tab stop), arrows select, and Left/Down stop at 1 star (the keyboard never clears the rating; §7.3); keyboard tests for all three.
- **input-pickers#18** [important/a11y] Combobox, Dropdown and TagPicker never scroll the keyboard-active option into view in their scrollable listboxes.
  - Owners: `F5-listbox-field`, `P05-listbox`, `P06-datetime`
  - Task: F5: useListbox scrolls the active option into view ({block:'nearest'}) in a layout effect when activeValue changes. P05/P06: rely on it (remove TimePicker's ad-hoc scroll); test scrollIntoView called with the active option.
- **input-pickers#20** [suggestion/convention] Combobox and Dropdown apply their selected/active classes after the consumer's Option className, so the consumer's classes lose.
  - Owners: `P05-listbox`, `F5-listbox-field`
  - Task: F5: options expose data-active/data-selected/data-disabled attributes. P05: state classes placed before props.className in cn(), styling keyed on data attributes (data-[active]:bg-subtle-hover etc.); test consumer bg class wins when active.
- **input-pickers#21** [suggestion/a11y] TagPicker reports aria-expanded="true" while no listbox is rendered.
  - Owners: `P05-listbox`
  - Task: P05: TagPicker expanded = isOpen && filteredOptions.length > 0 for aria-expanded and rendering; optional 'No matches' role=status row; test.
- **input-pickers#22** [suggestion/error-handling] TagPicker hides selected values that aren't in `options`, and Backspace can remove one of those hidden values.
  - Owners: `P05-listbox`
  - Task: P05: unknown selected values render as tags labelled by the raw value (dev warning once); Backspace targets the last rendered tag; tests.
- **input-pickers#23** [suggestion/a11y] ColorPicker presets and SwatchPicker swatches are announced by their hex codes, and SwatchPicker hard-codes an English 'Color picker' group name.
  - Owners: `P04-spin-color`
  - Task: P04: ColorPicker presets accept (string | {color,label})[]; SwatchItem.label documented as required-for-a11y (dev warning when missing); SwatchPicker radiogroup name from aria-label/aria-labelledby/FieldContext (default removed; dev warning if unnamed); tests on accessible names.
- **input-pickers#24** [suggestion/a11y] ColorPicker's root has no role, so a consumer's aria-label is ignored, and invalid hex input is thrown away without an error.
  - Owners: `P04-spin-color`
  - Task: P04: ColorPicker root role='group' (aria-label/labelledby apply, FieldContext labelledby); hex input aria-invalid + error hint via aria-describedby while invalid; tests.
- **input-pickers#25** [suggestion/bug] ColorPicker's hex text field keeps a preset or typed color that the controlled parent rejected, so it disagrees with the preview and aria-checked.
  - Owners: `P04-spin-color`
  - Task: P04: hex text is a draft over `color`; blur/preset click resets draft so a rejected controlled change shows the real value; test with rejecting parent.
- **input-pickers#26** [suggestion/bug] Dropdown's activeIndex and TagPicker's focusIndex are never clamped or reset when the option list changes, so Enter does nothing and aria-activedescendant points at a…
  - Owners: `P05-listbox`, `F5-listbox-field`
  - Task: F5: the active value is derived during render — ignored when it is not in the navigable set (falls back per autoHighlight) — and reset on close/select, without a clamping effect (C-HOOKS). P05: Dropdown/TagPicker tests with shrinking async options (Enter still works, activedescendant points to an existing id).
- **input-pickers#27** [suggestion/performance] Combobox, Dropdown and TimePicker clone and re-render every option on each arrow key or keystroke.
  - Owners: `F5-listbox-field`, `P05-listbox`, `P06-datetime`
  - Task: F5: ListboxStore with useSyncExternalStore selectors so moving the highlight re-renders only the old and new option. P05/P06: options rendered as memoized rows reading the store (no cloneElement per keystroke); render-count test (spy) proving only 2 options re-render on ArrowDown.
- **input-pickers#28** [important/bug] Combobox and Dropdown let keyboard users highlight and commit disabled options that clicking correctly blocks.
  - Owners: `F5-listbox-field`, `P05-listbox`
  - Task: F5: disabled options skipped by navigation/typeahead; Enter/Space on a disabled option is a no-op. P05: tests for click and keyboard on <Option disabled> in Combobox and Dropdown.

### input-datetime

- **input-datetime#1** [critical/bug] DatePicker's default formatDate/parseDate pair does not round-trip, and every blur re-parses the input text even when unedited, which corrupts or shifts the selected…
  - Owners: `P06-datetime`
  - Task: P06: new src/components/input/dateUtils.ts: default format = Intl.DateTimeFormat(locale, {year:'numeric', month:'2-digit', day:'2-digit'}) and default parse is its exact inverse for the same `locale` prop (field order from formatToParts; ISO yyyy-mm-dd also accepted); parse returns local-midnight dates; blur parses only when the draft was edited; no commit when same day; dev warning (warnOnce) when formatDate is given without parseDate (the default parser for `locale` is used; documented); JSDoc recommends passing `locale` explicitly for SSR so server and client output match. Locale/timezone-independent tests (vi.setSystemTime, TZ-agnostic assertions) for blur, Enter, min/max boundaries and the en-GB day-first round-trip.
- **input-datetime#2** [critical/bug] DatePicker and TimePicker close their popups only through an uncancelled 200 ms input-blur timer, so the calendar closes right after opening and never closes on…
  - Owners: `P06-datetime`, `P05-listbox`, `F4-overlay`
  - Task: F4: useDismiss (Escape, outside press, focus outside). P06: DatePicker/TimePicker remove blur timers; calendar opens from the toggle while input focused and stays open; closes on outside press/Escape; TimePicker clear keeps list closed/open correctly. P05: same replacement in Combobox/Dropdown/TagPicker (tracked with input-pickers#12). Tests: open-from-focused-input, Escape, outside click, TimePicker clear (no fake timers needed).
- **input-datetime#4** [important/bug] DatePicker calendar keyboard navigation does nothing when opened through the controlled open prop, and month buttons desync the focused day.
  - Owners: `P06-datetime`
  - Task: P06: effective focused day derived during render (focusedDay in viewMonth -> selected in view -> today in view -> first of month), no seeding effect (C-HOOKS); navigateMonth moves the focused day by the same delta; tests opening via controlled open then arrows/Enter/Escape (Escape calls onOpenChange(false)).
- **input-datetime#5** [important/a11y] DatePicker keeps DOM focus on the <table role=grid>, so screen readers never announce which day is keyboard-focused.
  - Owners: `P06-datetime`
  - Task: P06: roving focus on day buttons: focused day button tabIndex 0 and .focus() when focusedDay changes while the grid contains focus; table loses tabIndex; gridId referenced by the dialog/aria-controls; tests assert document.activeElement is the day button.
- **input-datetime#6** [important/a11y] DatePicker calendar popup lacks APG dialog semantics, an expanded state on its trigger, and focus management on open.
  - Owners: `P06-datetime`, `F4-overlay`
  - Task: F4: Portal, usePopupPosition, useDismiss, useFocusTrap (element-based, bubble phase), useRestoreFocus. P06: toggle gets aria-haspopup='dialog' aria-expanded aria-controls; popup role='dialog' aria-modal='true' (the calendar is a transient popup and keeps aria-modal; Dialog/Drawer use modal isolation instead, §5.8) aria-labelledby=month heading; on open the focused day is focused as soon as the surface exists; Tab trapped; Escape on the dialog closes and restores focus to the toggle; tests.
- **input-datetime#7** [important/a11y] DatePicker does not expose the current month, the selected date or today to assistive technology.
  - Owners: `P06-datetime`
  - Task: P06: month heading has id + aria-live='polite'; grid aria-labelledby heading; <td role=gridcell> aria-selected on selected day; aria-current='date' on today; tests.
- **input-datetime#8** [important/a11y] The DatePicker focused-day indicator looks like the 'today' marker and disappears on the selected day.
  - Owners: `P06-datetime`
  - Task: P06: focus indicator = focus-visible:outline-2 outline-offset-2 outline-ring (distinct from today's border), applied to selected days too; test class on focused selected day.
- **input-datetime#10** [important/a11y] The TimePicker active-option highlight is nearly invisible and looks the same as the selected state.
  - Owners: `P06-datetime`
  - Task: P06: active option data-[active]:outline-2 outline-ring -outline-offset-2 + bg-subtle-hover; selected option shows a check icon + font-semibold + bg-subtle-selected; test both states distinguishable (classes/aria).
- **input-datetime#11** [important/bug] DatePicker compares and emits dates with a time of day, so Enter on the initial 'today' fails with maxDate={new Date()} and keyboard and mouse selections emit…
  - Owners: `P06-datetime`
  - Task: P06: isDateDisabled normalizes the candidate to local midnight; focusedDay seeded with a midnight copy; every emitted date is start-of-day; tests with maxDate={new Date()} Enter on today and keyboard vs mouse emitting equal getTime().
- **input-datetime#12** [important/bug] DatePicker PageUp/PageDown roll month-end days into the wrong month, skipping February.
  - Owners: `P06-datetime`
  - Task: P06: addMonths(date, delta) in dateUtils clamps the day to the target month length; PageUp/PageDown (and Shift variants) use it; tests Jan 31 -> Feb 28/29 and Mar 31 -> Feb.
- **input-datetime#13** [important/bug] DatePicker's effect-based inputText sync keeps parent-rejected values on screen, ignores value changes while open, and wipes in-progress typing on any parent re-render.
  - Owners: `P06-datetime`
  - Task: P06: draftText: string | null model (render formatDate(selected) when null; reset after every commit attempt); any remaining sync keyed on selectedDate?.getTime(); formatDate read via useEventCallback; tests: rejected blur/Enter/Clear re-shows controlled value, external value change while open, inline formatDate does not wipe typing.
- **input-datetime#14** [important/a11y] DatePicker silently discards unparseable or out-of-range typed dates without any error indication.
  - Owners: `P06-datetime`
  - Task: P06: unparseable/out-of-range typed text is kept, input aria-invalid=true, error hint rendered and linked via aria-describedby (or FieldContext), new `onInvalidInput?(text, reason)` callback; tests.
- **input-datetime#15** [important/a11y] The DatePicker and TimePicker clear and calendar icon buttons are 16x16 px, below the WCAG 2.2 24x24 minimum target size.
  - Owners: `P06-datetime`
  - Task: P06: calendar/clear buttons h-6 w-6 (16px icon centred), spaced >=24px apart, input pe- padding adjusted (logical); tests assert classes.
- **input-datetime#17** [suggestion/a11y] DatePicker arrow keys are not mirrored in RTL, and the month chevrons point the wrong way.
  - Owners: `P06-datetime`, `F2-lib`
  - Task: F2: getDirection. P06: ArrowLeft/Right deltas swapped in rtl; month chevrons rtl:-scale-x-100; tests under dir=rtl.
- **input-datetime#18** [suggestion/a11y] The DatePicker grid is missing APG keys: Space to select, Home/End, and Shift+PageUp/PageDown.
  - Owners: `P06-datetime`
  - Task: P06: Space = Enter; Home/End = start/end of week per firstDayOfWeek; Shift+PageUp/PageDown = ±12 months with clamp; tests.
- **input-datetime#19** [suggestion/a11y] DatePicker month names, weekday headers and day-cell labels are hardcoded English and ignore locale.
  - Owners: `P06-datetime`
  - Task: P06: `locale?: string` prop; month names, weekday short (visible) + long (abbr/aria-label) and day-cell labels via Intl.DateTimeFormat; tests with locale 'de-DE' and default.
- **input-datetime#20** [suggestion/api-design] DatePicker calls onOpenChange(false) even when the calendar is already closed.
  - Owners: `P06-datetime`
  - Task: P06: open state via useControllable (no-op changes suppressed) so onOpenChange never fires when unchanged; test blur/Enter with closed calendar emits no onOpenChange.
- **input-datetime#21** [suggestion/simplification] DatePicker hand-rolls controlled/uncontrolled open state instead of using useControllable and has no defaultOpen prop.
  - Owners: `P06-datetime`, `F3-hooks-provider`
  - Task: F3: fixed useControllable. P06: DatePicker open uses useControllable(openProp, defaultOpen ?? false, onOpenChange) and adds defaultOpen; test.
- **input-datetime#22** [suggestion/simplification] Clear and close X icons are copy-pasted across DatePicker, TimePicker, SearchBox, Dialog and others, with inconsistent glyphs and missing aria-hidden.
  - Owners: `F2-lib`, `P06-datetime`, `P02-field-text`, `P15-modal`, `P12-messages`, `P08-list-tag`, `P05-listbox`, `P16-popups`
  - Task: F2: src/lib/icons.tsx exports DismissIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleLeft/RightIcon, CalendarIcon, ClockIcon, CheckIcon, SearchIcon, InfoIcon, status icons (Success/Warning/Error/Info) — all aria-hidden by default, currentColor, size prop. Each owner replaces its local copies: P06 (DatePicker, TimePicker), P02 (SearchBox), P15 (Dialog, Drawer), P12 (MessageBar, Toast), P08 (Tag, InfoLabel), P05 (TagPicker, Dropdown chevron), P16 (TeachingPopover).
- **input-datetime#23** [important/bug] Opening a TimePicker that already has a value shows only the options that match the current label.
  - Owners: `P06-datetime`
  - Task: P06: separate `query` state set only by typing, reset to '' on open (all options shown), selected option scrolled into view; test defaultValue='09:00' step=60 opens with 24 options and 9:00 AM aria-selected.
- **input-datetime#24** [important/bug] TimePicker discards a typed time when the user presses Enter or tabs away.
  - Owners: `P06-datetime`
  - Task: P06: every edit sets the active option with `lb.setActiveValue` (§5.5: a complete typed time activates its own option, never an earlier substring match such as 12:00 PM for 2:00 PM; partial text activates the first match; no `highlightOnFilter`); Enter commits active or a valid typed HH:mm/12h time within bounds; blur commits a valid exact typed time; erased text clears the value on Enter and on blur (as DatePicker); tests.
- **input-datetime#25** [important/bug] TimePicker never validates step, minTime or maxTime: step <= 0 hangs the page in an infinite loop, and 'HH:mm:ss' or 12h bounds silently produce an empty list.
  - Owners: `P06-datetime`
  - Task: P06: guard step (non-finite or <=0 -> dev console.error + fallback 30; floor to integer >=1), timeToMinutes accepts HH:mm[:ss] and 12h 'h:mm AM', invalid bounds -> dev error + empty list with 'No times available' status; story control min=1; tests for step=0, inclusive bounds, off-step max, invalid bounds.
- **input-datetime#28** [suggestion/bug] TimePicker displays off-grid or out-of-range values in raw 24h 'HH:mm' even when format is '12h'.
  - Owners: `P06-datetime`
  - Task: P06: displayLabel falls back to minutesToTime(timeToMinutes(value), format) for off-grid/out-of-range values; test '09:15' step 30 renders '9:15 AM'.
- **input-datetime#29** [suggestion/a11y] TimePicker reports aria-expanded=true when the filter matches nothing and no listbox is rendered.
  - Owners: `P06-datetime`
  - Task: P06: aria-expanded = open && options.length > 0 (or render a 'No matching times' row + role=status); test.

### data-display

- **data-display#1** [critical/bug] Tag: setting `dismissIcon` swaps out the whole dismiss button for a plain span, so `onDismiss` never fires and the control can't be focused and has no name.
  - Owners: `P08-list-tag`, `F2-lib`
  - Task: F2: widened SlotObject and mergeProps. P08: Tag always renders its wired <button type='button' onClick={onDismiss} aria-labelledby=...>; the dismissIcon slot renders only its content inside it (C-SLOTS); a slot that is itself a <button> element or a Wave Button is merged into the wired button with mergeProps (no nested button) and a dev warning recommends icon content; type `Slot<'span'> | SlotObject<'button'>` (the deprecated object form still compiles). Tests: a custom dismissIcon click calls onDismiss once and the button keeps its name; a <button> slot yields exactly one button.
- **data-display#2** [critical/a11y] Selectable List: `action` controls inside a role="option" item can't be activated from the keyboard, toggle selection when clicked, and are hidden from assistive tech.
  - Owners: `P08-list-tag`
  - Task: P08: List item handlers ignore events that start inside the action container (closest('[data-list-action]')) or any nested interactive element; selectable lists that contain actions render in grid mode (role='grid', rows with aria-selected, gridcells for content/action; Up/Down rows, Left/Right into actions), following the P17 text-entry rule (a cell whose widget is a text-entry control takes focus on the cell, Enter/F2 enters it, Escape returns); lists without actions stay listbox. Tests: clicking/Enter/Space on an action runs it and does not toggle selection; Left/Right inside an inline input move the caret; axe passes (no nested-interactive).
- **data-display#3** [important/bug] Avatar: the `image` slot throws for element and string values because they get wrapped as children of a void `<img>`, and the object form's type rejects `src`/`alt`.
  - Owners: `F2-lib`, `P07-identity`
  - Task: F2: resolveSlot/renderSlot: for void default tags (img,input,br,hr,...) a ReactElement slot is returned as the element itself (className merged) and primitives are never passed as children (dev warning, except for content that renders nothing; void slot objects always drop children and warn only when an item would render, §2.2). P07: Avatar image slot accepts string (treated as src), element and {src,alt,...}; remove the test cast; tests for all three forms.
- **data-display#4** [important/bug] Avatar: when `src` fails to load, users see the browser's broken-image glyph on a transparent circle instead of falling back to initials or the icon.
  - Owners: `P07-identity`
  - Task: P07: Avatar tracks image load failure (onError -> failed; reset when src changes) and falls back to image slot/initials/icon with background; test firing error on the img.
- **data-display#7** [important/a11y] Selectable List makes every option its own Tab stop instead of using one roving tab stop as the APG Listbox pattern expects.
  - Owners: `P08-list-tag`, `F3-hooks-provider`
  - Task: F3: roving DOM mode (tabStop 'active'). P08: selectable List has one tab stop (selected or first enabled), ArrowUp/Down/Home/End move focus, typeahead for >7 items; tests single Tab stop.
- **data-display#8** [important/test-gap] List tests don't cover arrow/Home/End navigation, wrap-around, Space selection or Tab behaviour, and axe only runs on an empty, non-selectable List.
  - Owners: `P08-list-tag`
  - Task: P08: userEvent tests for ArrowDown/Up wrap, Home/End, Space toggling, single Tab stop; a11yVariants selectable single/multiple with aria-label and children; selectable stories get aria-label.
- **data-display#10** [important/a11y] Tag: every dismiss button has the same fixed English `aria-label="Dismiss"`, with no mention of the tag it removes and no way to localize it.
  - Owners: `P08-list-tag`
  - Task: P08: dismiss button aria-labelledby=`${dismissLabelId} ${contentId}` with a visually hidden `dismissLabel` (default 'Dismiss'); test accessible name 'Dismiss Cherry' and custom label. A merged `<button>`/`Button` whose content has a text label replaces `dismissLabel` in the name (`aria-labelledby` = rendered content + tag content, "Remove Cherry"; C-SLOTS naming bullet).
- **data-display#11** [important/bug] Divider: the vertical orientation silently discards `children`, so a vertical divider never shows its label.
  - Owners: `P08-list-tag`
  - Task: P08: vertical Divider with children renders flex-col (two border-s segments around the content), role='separator' aria-orientation='vertical'; test.
- **data-display#12** [important/a11y] Divider with a label renders three unnamed separators (the wrapper plus two `<hr>`s), and the label text is not exposed as the separator's name.
  - Owners: `P08-list-tag`
  - Task: P08: labelled Divider: wrapper role='separator' aria-labelledby=label id; inner lines are aria-hidden divs (no <hr>); test single named separator.
- **data-display#13** [important/a11y] InfoLabel: the info text only appears as a native `title` tooltip on mouse hover, so sighted keyboard and touch users can't read it.
  - Owners: `P08-list-tag`, `F4-overlay`
  - Task: F4: Portal/usePopupPosition/useDismiss. P08: InfoLabel trigger is <button type='button' aria-label={infoButtonLabel ?? 'Information'} aria-expanded aria-describedby={descId}>; the info content is always rendered in an inline `hidden` element with id descId (description available from the first render, SSR-safe); the visual popup (non-modal, aria-hidden because it duplicates the description) is portaled only while open. Interaction: keyboard focus (focus not preceded by a pointerdown on the trigger) opens; pointer-initiated focus does not open; click toggles, and a click while the popup is open because of hover or focus pins it instead of closing it; hover opens after a delay and the content is hoverable; Escape dismisses. No title attribute, no role=img. Tests: mouse click opens (not open-then-closed), keyboard Tab focus opens, Escape closes, touch tap toggles, description present while closed.
- **data-display#15** [important/a11y] PresenceBadge shows status by colour alone: busy and DND look identical, and the away and offline dots are below 3:1 against white.
  - Owners: `P07-identity`, `F1-tokens`
  - Task: F1: presence tokens (--wave-presence-available/busy/away/offline/oof, --wave-presence-glyph) with ratios in §2.1.3. P07: PresenceBadge renders a distinct glyph per status (check, dash bar, clock, X, hollow ring for offline, arrow for oof) with a background-colored ring, role='img' + aria-label; busy and dnd distinguishable; it stays a sibling of the Avatar's role=img visual (data-display#19) so both names are exposed; tests per status.
- **data-display#16** [important/test-quality] Badge variant tests (and similar tests for Avatar, Image, PresenceBadge, CounterBadge and AvatarGroup) only assert `toBeInTheDocument()`, so the appearance, color and…
  - Owners: `P07-identity`
  - Task: P07: rewrite presence-only it.each blocks in Badge/Avatar/Image/PresenceBadge/CounterBadge/AvatarGroup tests to table-driven assertions of one distinguishing class or attribute per variant; delete ones with no observable difference.
- **data-display#17** [important/test-gap] AvatarGroup: `max={0}` is treated as falsy so every avatar shows, and the overflow test never checks that the extra avatars are hidden.
  - Owners: `P07-identity`
  - Task: P07: AvatarGroup uses `max !== undefined`; tests assert hidden avatars absent, exact-fit boundary and max={0}.
- **data-display#19** [suggestion/a11y] Avatar in initials or icon mode has no role or accessible name, so screen readers read the raw letters ('J D') or nothing at all instead of the person's name.
  - Owners: `P07-identity`
  - Task: P07: Avatar with name and no image: role='img' and aria-label={name} go on the avatar visual element (the root when there is no badge; the inner avatar span when a badge is present), never on the badge wrapper, so a PresenceBadge sibling keeps its own role='img' name; initials aria-hidden; icon mode aria-hidden unless aria-label given; consumer aria-label/aria-labelledby/role route to the visual element. Tests: Avatar with badge={<PresenceBadge status='busy'/>} exposes both an img named 'Jane Doe' and an img named 'Busy'.
- **data-display#21** [suggestion/test-gap] Avatar with `badge` leaves ref, className and rest props on the inner span instead of the outer wrapper it returns, and this path has no tests.
  - Owners: `P07-identity`
  - Task: P07: with badge, the outer wrapper is the root (ref, className, rest — except the ARIA props routed to the visual per data-display#19); the inner avatar span is internal; testSystemProps run with badge set; replace the `.relative` query with a behavioural assertion; listed in §7.3/CHANGELOG (ref/className target moves to the wrapper when a badge is set).
- **data-display#22** [suggestion/test-gap] Avatar renders an empty brand-coloured circle when `name` is whitespace only, and the getInitials edge cases are untested.
  - Owners: `P07-identity`
  - Task: P07: branch on getInitials(name) being non-empty; it.each table for getInitials edge cases incl. whitespace-only -> icon fallback.
- **data-display#23** [suggestion/bug] List `toggleItem` builds the next selection from the render-time `selectedItems` snapshot, so two toggles in the same batch overwrite each other.
  - Owners: `P08-list-tag`, `F3-hooks-provider`
  - Task: F3: functional updaters receive the current value and chain within a batch. P08: toggleItem uses setSelectedItems(prev => ...) and drops selectedItems from deps; test two toggles in one act().
- **data-display#24** [suggestion/test-gap] List selection is only tested at initial render: controlled updates on click, defaultSelectedItems, multi-select deselect and items without a value are never exercised.
  - Owners: `P08-list-tag`
  - Task: P08: tests: controlled click leaves aria-selected until rerender and calls onSelectionChange(['a']); defaultSelectedItems; multi deselect; value-less item not selectable but onClick still called.
- **data-display#26** [suggestion/a11y] AvatarGroup has no group semantics, and its '+N' overflow text has no context for screen-reader users.
  - Owners: `P07-identity`
  - Task: P07: AvatarGroup root role='group' (consumer aria-label; dev warning when missing); the overflow indicator is a <button type='button'> (aria-label `${n} more`, overridable via `overflowLabel`) with aria-expanded that toggles a popup listing the hidden members' names, built on F4 Portal/usePopupPosition/useDismiss; tests for names, keyboard toggle, Escape.
- **data-display#27** [suggestion/a11y] Persona announces the person's name twice: once from the avatar's alt text or initials, then again from the visible name.
  - Owners: `P07-identity`
  - Task: P07: Persona passes `decorative` (new Avatar prop -> alt='' / aria-hidden root, no role img) to its Avatar; test Persona name announced once.
- **data-display#28** [suggestion/a11y] Image lets `alt` be omitted, even though its tests say alt is required.
  - Owners: `P07-identity`
  - Task: P07: `alt` stays optional at the type level for backward compatibility (§7.4); Image emits a dev warning (warnOnce) when `alt` is undefined, JSDoc documents alt='' for decorative images, and an exported `StrictImageProps` (alt: string required) gives apps the compile-time check today; the required type is scheduled for 1.0. Tests: warning when alt is missing, none for alt=''; type test that StrictImageProps rejects a missing alt.
- **data-display#29** [suggestion/test-quality] Persona tests check absence with a class selector and don't cover badge/status precedence or presence sizing.
  - Owners: `P07-identity`
  - Task: P07: Persona absence asserted by content; tests for badge precedence over status and presence size mapping.
- **data-display#30** [suggestion/api-design] Selection APIs are inconsistent: List uses `'multi'` where DataGrid and Accordion use `'multiple'`, and selections are arrays in some components but a Set in DataGrid.
  - Owners: `P08-list-tag`, `P17-table`, `P09-disclosure`, `P05-listbox`, `F2-lib`
  - Task: F2: shared SelectionMode = 'single' | 'multiple' type. P08: List selectionMode accepts 'multiple' ('multi' deprecated alias). P17: DataGrid adds array-based selectedItems/defaultSelectedItems/onSelectedItemsChange (Set-based selectedKeys/defaultSelectedKeys/onSelectionChange deprecated aliases, also accepting arrays). P09: Accordion already uses 'multiple' + arrays (adopt shared type only). P05: TagPicker already arrays (no change beyond shared naming onValueChange).
- **data-display#31** [suggestion/api-design] The `icon` prop is a Slot on Button, Menu, Breadcrumb and MessageBar but a plain ReactNode on Avatar, Tree, Nav and Stepper.
  - Owners: `P07-identity`, `P09-disclosure`, `P13-menu-nav`, `P14-pagination-stepper`, `P01-buttons`, `P12-messages`
  - Task: C-SLOTS: every `icon` prop is Slot<'span'> rendered with renderSlot(icon,'span',base,{'aria-hidden':true}). P07 Avatar, P09 Tree.Item, P13 Nav items, P14 Stepper.Step convert from ReactNode (plain nodes still work). P01 and P12 already use Slot: ensure aria-hidden default and consistent base classes.

### layout

- **layout#1** [critical/bug] Overflow's measurement pass writes visible/static styles onto React-owned item elements, and React never re-hides items that stay overflowed.
  - Owners: `P10-carousel-overflow`
  - Task: P10: measurement never mutates live styles: widths cached while items are visible (or measured with save/restore of el.style.cssText); hiding via data-overflow-hidden attribute + class always re-applied by React; layout-mocked regression test (stub offsetWidth/clientWidth).
- **layout#2** [important/bug] Overflow always reserves a hardcoded 60px for the more button, so items that fit in the container are hidden.
  - Owners: `P10-carousel-overflow`
  - Task: P10: if total width <= container width hide nothing; otherwise reserve the measured more-button width; never hide the first item in both paths; tests.
- **layout#3** [important/bug] Overflow picks items to hide in Map registration order rather than DOM order, so dynamic lists hide the wrong items.
  - Owners: `P10-carousel-overflow`
  - Task: P10: iterate items in DOM order (compareDocumentPosition sort or container.children walk); test with an item mounted later rendered first.
- **layout#4** [important/api-design] Overflow's overflowButton receives only a count, and hidden ids are not exposed, so consumers cannot build a menu for overflowed items.
  - Owners: `P10-carousel-overflow`, `INTEGRATION`
  - Task: P10: overflowButton?: (count, hiddenIds: string[]) => ReactNode (ids in DOM order); export useOverflowMenu() ({hiddenIds, count}) and useIsOverflowItemVisible(id); the story imports the new hooks from the module path and renders the hidden items in a plain disclosure list (no Menu while P13 is in flight). INTEGRATION: export the new hooks/types and switch the story to Menu.Trigger/Menu.Popover.
- **layout#6** [important/bug] useIsOverflowing only re-checks on the element's own resize, so it goes stale when content changes and never observes a ref that mounts later.
  - Owners: `P10-carousel-overflow`
  - Task: P10: useIsOverflowing also observes children (ResizeObserver on children + MutationObserver childList/subtree) and accepts a callback ref / re-subscribes when ref.current changes; tests with content growth and late-mounted element.
- **layout#7** [suggestion/error-handling] Overflow and useIsOverflowing call `new ResizeObserver` without a feature check and throw where it is unavailable, including consumers' jsdom tests.
  - Owners: `P10-carousel-overflow`
  - Task: P10: guard `typeof ResizeObserver === 'undefined'` (one-shot calculate + window resize listener fallback); test with ResizeObserver deleted.
- **layout#8** [suggestion/performance] Overflow recreates its ResizeObserver and re-measures every item, forcing layout, on every parent render because the effect depends on `children`.
  - Owners: `P10-carousel-overflow`
  - Task: P10: container observed once (deps [calculateOverflow]); reads batched before writes / cached widths; setHiddenIds only when membership changes; test observer not recreated on parent rerender and no state update when unchanged.
- **layout#9** [important/test-quality] Overflow tests never stub layout: the 'no overflow' test actually runs with items overflowed, and the overflowButton test asserts nothing about the button.
  - Owners: `P10-carousel-overflow`, `F6t-test-infra`
  - Task: F6t: installResizeObserverMock() test helper with on-demand trigger. P10: tests stub widths per case; fit case asserts no aria-hidden items and no button; overflow case asserts '+N' and aria-hidden on the correct items; useIsOverflowing true case.
- **layout#10** [important/bug] TabList, Card and other components set an internal onClick/onKeyDown before spreading `...rest`, so a consumer's handler silently replaces selection and keyboard…
  - Owners: `F2-lib`, `P09-disclosure`, `P11-primitives`, `P03-choice`, `P08-list-tag`, `P13-menu-nav`, `P17-table`, `P16-popups`, `P15-modal`, `F6t-test-infra`
  - Task: F2: composeEventHandlers + mergeProps. F6t: testComposedHandler helper (consumer handler runs, internal behavior still runs, consumer preventDefault suppresses internal). Owners apply C-COMPOSE at every listed site and add composition tests: P09 Tab onClick, TabList onKeyDown, Accordion trigger; P11 Card onClick/onKeyDown (events starting inside nested interactive elements are ignored, layout#35); P03 RadioGroup onKeyDown, Rating; P08 List/ListItem; P13 Menu/MenuItem onKeyDown/onClick; P17 DataGrid row/header; P16 TeachingPopover onKeyDown, Popover.Trigger and Tooltip handlers (asChild merge keeps consumer onClick/className); P15 Dialog.Trigger merge.
- **layout#11** [important/a11y] Accordion and TabList build DOM ids from item values instead of useId, so two instances (or values that sanitize alike) produce duplicate ids and mislabelled panels.
  - Owners: `P09-disclosure`
  - Task: P09: AccordionRoot/TabListRoot create a base id with useId and share via context; ids derived by one helper `${baseId}-trigger-${index}` (index from registration order); tests assert aria-controls/aria-labelledby relationships (not literal ids) and two-instance uniqueness.
- **layout#12** [important/a11y] TabList sorts children by `child.type === Tab`, so a Tab inside a Fragment or wrapper (e.g. Tooltip) renders outside role=tablist and cannot be reached by keyboard.
  - Owners: `P09-disclosure`
  - Task: P09: tabs register via context (DOM order) instead of child.type checks; all non-panel children render inside the tablist; optional TabList.Panels container; tests with Fragment- and Tooltip-wrapped tabs (role=tab inside tablist, keyboard reachable).
- **layout#13** [important/bug] TabList arrow, Home and End keys move to and select disabled tabs because disabled Tabs are not filtered from the roving list.
  - Owners: `P09-disclosure`, `F3-hooks-provider`
  - Task: F3: the hook skips disabled/aria-disabled items and tracks the enabled set through its MutationObserver-backed store, so a Tab that toggles disabled by itself updates the tab stop without a TabList re-render. P09: disabled tabs skipped by Arrow/Home/End, click on a disabled tab does not select, the tab stop falls back when the selected tab is disabled; tests incl. a Tab whose disabled prop flips from its own state.
- **layout#14** [suggestion/test-quality] The TabList test 'ArrowDown/ArrowUp navigates in vertical mode' never presses ArrowUp, and nothing checks that Left/Right are ignored in vertical mode.
  - Owners: `P09-disclosure`
  - Task: P09: vertical test presses ArrowDown then ArrowUp; ArrowRight ignored in vertical orientation.
- **layout#16** [suggestion/api-design] TabList, Divider, Stack, Text/Label and Skeleton use different prop names and value types for the same concepts (orientation, weight, appearance/variant/shape).
  - Owners: `F2-lib`, `P09-disclosure`, `P11-primitives`, `P01-buttons`, `P16-popups`, `P02-field-text`, `P08-list-tag`, `P03-choice`, `P14-pagination-stepper`, `P07-identity`, `P04-spin-color`
  - Task: F2: shared types Orientation, TextWeight ('regular'|'semibold'|'bold'), Shape. P09: TabList `orientation` (vertical deprecated alias). P11: Stack `orientation` (direction deprecated alias), Skeleton `shape` (variant deprecated alias). P01: Text weight accepts TextWeight (400/600/700 deprecated aliases); Link `appearance` (variant deprecated alias). P16: Tooltip `appearance: 'inverted'|'normal'` (variant 'dark'/'light' deprecated alias). P02: Label weight adopts TextWeight (adds 'bold'). P08 Divider, P03 RadioGroup, P14 Stepper, P07 Image, P04 SwatchPicker: import the shared Orientation/Shape types (no API change). Alias tests + warnOnce.
- **layout#17** [important/api-design] Accordion.Trigger and Accordion.Panel are never mounted: AccordionItem keeps only their children, so className, handlers, aria-*, data-* and ref are silently dropped.
  - Owners: `P09-disclosure`, `INTEGRATION`
  - Task: P09: Accordion.Trigger/Panel are real components reading item context; their props merge onto the button/region (cn className, composed onClick, ref); plain-text children of Item still rendered; tests for className/onClick/ref/data-*. INTEGRATION: export AccordionTriggerProps/AccordionPanelProps.
- **layout#18** [important/a11y] Accordion header buttons are not wrapped in a heading element, and consumers have no way to add one.
  - Owners: `P09-disclosure`
  - Task: P09: headingLevel prop (Accordion default 3, overridable per Item) wraps the trigger button in <h{n} className='m-0'>; test getByRole('heading',{level:3}) contains the button.
- **layout#19** [suggestion/type-design] Accordion, List and DataGrid model mode-dependent props as independent optionals, allowing contradictory states such as single mode with several open items.
  - Owners: `P09-disclosure`, `P08-list-tag`, `P17-table`
  - Task: Discriminated unions with back-compat: P09 Accordion `type:'multiple'` -> openItems/defaultOpenItems/onOpenItemsChange; `type?:'single'` -> openItem/defaultOpenItem/onOpenItemChange (string|null) with openItems still accepted (deprecated, dev warning when >1). P08 List single -> selectedItem? plus legacy selectedItems (warn when >1 in single). P17 DataGrid single controlled `sort?: {columnId, direction} | null` + defaultSort + onSortChange(sort) (sortColumn/sortDirection deprecated aliases; mixed control warned). Type tests.
- **layout#20** [important/bug] Carousel autoplay without loop calls onValueChange with the same index forever on the last slide, and restarts its interval on every parent re-render.
  - Owners: `P10-carousel-overflow`, `F3-hooks-provider`
  - Task: F3: useControllable skips no-op onChange. P10: autoplay stops at the last slide when !loop; interval effect deps [autoPlay, interval, loop, total, paused] with index read from a ref and setter via useEventCallback; fake-timer tests: advance, wrap, stop at end, single slide no-op, cleanup, parent rerenders do not reset timer.
- **layout#21** [important/a11y] Carousel autoPlay has no pause/stop control, does not pause on focus, hover or reduced motion, and announces every rotation politely (WCAG 2.2.2).
  - Owners: `P10-carousel-overflow`, `F3-hooks-provider`
  - Task: F3: usePrefersReducedMotion. P10: rotation toggle button is the first focusable element (Pause/Play labels, `autoPlayLabels` prop), pauses on focusin/mouseenter, resumes on leave unless user stopped, aria-live='off' while rotating ('polite' when paused/manual), default paused under reduced motion; tests.
- **layout#22** [important/a11y] Inactive Carousel slides are neither aria-hidden nor inert, so Tab reaches off-screen controls and scrolls the viewport out of sync with activeIndex.
  - Owners: `P10-carousel-overflow`
  - Task: P10: inactive slides aria-hidden + inert; test Tab cannot reach controls in inactive slides.
- **layout#23** [suggestion/bug] Carousel never clamps activeIndex to the slide count, so removed slides or an out-of-range value show empty space and a wrong announcement.
  - Owners: `P10-carousel-overflow`
  - Task: P10: render from an index clamped during render (no resync effect, C-HOOKS); uncontrolled interactions start from the clamped index; tests removing slides and out-of-range value.
- **layout#24** [important/a11y] Carousel dots use role=tab/tablist without tabpanels, aria-controls, roving tabindex or arrow keys, which promises a tabs interaction that does not exist.
  - Owners: `P10-carousel-overflow`
  - Task: P10: pick one model: dots become plain buttons (no tab roles) with aria-label 'Slide n of m' and aria-current='true' on the active one inside a role='group' labelled 'Choose slide'; tests.
- **layout#25** [important/a11y] Carousel dots are 8x8px targets, inactive dots have about 1.3:1 contrast, and the active dot differs only by color.
  - Owners: `P10-carousel-overflow`, `F1-tokens`
  - Task: F1: stroke-accessible token. P10: dots get >=24x24 hit area (padding/::before), inactive dots border/bg stroke-accessible (>=3:1), active dot wider pill (non-color cue); tests assert classes.
- **layout#26** [important/a11y] Carousel Previous/Next use the native `disabled` attribute at the ends, which drops keyboard focus to <body>.
  - Owners: `P10-carousel-overflow`
  - Task: P10: prev/next use aria-disabled + guarded handlers (C-DISABLED) instead of disabled; test focus stays on Next at the last slide.
- **layout#27** [important/a11y] Carousel always translates the track by a negative percentage, so under dir='rtl' every slide after the first is blank and the controls are not mirrored.
  - Owners: `P10-carousel-overflow`, `F2-lib`
  - Task: F2: getDirection. P10: translateX sign flips in rtl (read dir from useDirection/getDirection), prev/next placement and chevrons mirrored (rtl:-scale-x-100); RTL test asserts transform sign.
- **layout#29** [suggestion/test-quality] Carousel navigation tests check only the onValueChange arguments, never the resulting live-region text, selected dot or Prev/Next state.
  - Owners: `P10-carousel-overflow`
  - Task: P10: navigation tests assert live-region text, current dot (aria-current), prev/next aria-disabled, exposed slide (not aria-hidden); loop Prev at index 0.
- **layout#30** [important/bug] Tree.Item spreads `...rest` and ref onto a role-less wrapper that also contains the child group, so parent handlers fire for child clicks and ARIA props miss the…
  - Owners: `P09-disclosure`
  - Task: P09: Tree.Item ref/rest/handlers go on the role=treeitem element (composed with toggle); the child role=group is nested inside the treeitem using the existing div elements (div[role=treeitem] > row + div[role=group]; element and ref types unchanged, the outer role-less wrapper disappears); Tree gains onItemSelect (fires on every activation) / selected / current + expandedItems/defaultExpandedItems/onExpandedItemsChange (useControllable). Tests: parent onClick not fired for child clicks, aria props land on the treeitem; §7.3 lists the DOM change.
- **layout#31** [important/a11y] Tree lacks the APG tree keyboard model (every item is a Tab stop, no Up/Down/Home/End/parent-child/typeahead), and its existing key handling is untested.
  - Owners: `P09-disclosure`, `F3-hooks-provider`
  - Task: F3: roving DOM mode + typeahead. P09: Tree implements APG tree keys over visible treeitems (Up/Down/Home/End, Right expand/first child, Left collapse/parent, Enter/Space activate/toggle, * optional, typeahead), single tab stop; userEvent tests including leaf rows.
- **layout#32** [important/bug] Tree loses all visual nesting in RTL because it indents with physical `pl-4`, and its chevron and ArrowRight/ArrowLeft behavior are not mirrored.
  - Owners: `P09-disclosure`
  - Task: P09: indentation via ps-4 (or inline-start padding by depth), collapsed chevron rtl:-scale-x-100, ArrowRight/Left swapped in rtl; RTL tests.
- **layout#34** [important/test-gap] Layout a11y tests run axe on empty Accordion/TabList and default-only Card, skip axe and displayName for Tree/Overflow, and cover no keyboard, RTL or multi-instance…
  - Owners: `P09-disclosure`, `P10-carousel-overflow`, `P11-primitives`, `P12-messages`
  - Task: P09: testSystemProps with populated defaultProps + a11yVariants (open accordion item, selected tab with panel, expanded tree) and testSystemProps/testDisplayName for Tree; keyboard/RTL/two-instance tests. P10: testSystemProps for Overflow (+Carousel variants: autoplay paused, hidden slides). P11: Card a11yVariant {onSelect, selected:true}; unlabeled ProgressBar variants. P12: fake-timer Toaster tests and MessageBar dismiss-slot test.
- **layout#35** [critical/a11y] A selectable Card (onSelect) is a clickable div with no role, tabIndex or Enter/Space handling, and its `selected` state is only visual.
  - Owners: `P11-primitives`
  - Task: P11: a Card with onSelect gets `selectionControl?: 'card' | 'checkbox'` (default 'card'). 'card': root role='button', tabIndex=0, Enter/Space activation (composed with consumer onKeyDown), aria-pressed={selected} when `selected` is defined, focusRing; a dev warning (effect, warnOnce) fires when the card contains tabbable descendants and points to 'checkbox'. 'checkbox': the root is not a widget (no role/tabIndex); Card renders a built-in checkbox (native input, labelled by `selectLabel` or aria-labelledby the header) carrying `selected`; pointer clicks on non-interactive card areas still toggle. In both modes click and keydown events that start inside a nested interactive element (closest('button, a[href], input, select, textarea, [role=button], [tabindex]') !== root) are ignored. Non-color selected cue (check glyph + 2px border). Tests: keyboard selection; inner Button click and Enter do not select; axe variant in 'checkbox' mode with a footer Button passes; Clickable story updated; JSDoc documents both patterns.
- **layout#36** [suggestion/simplification] CardContext is provided with `{ selected }` but nothing consumes it.
  - Owners: `P11-primitives`
  - Task: P11: remove CardContext and its Provider.
- **layout#39** [suggestion/api-design] Flex's `shrink` prop is a no-op: `true` emits the default `flex-shrink: 1`, and `false` cannot produce `shrink-0`.
  - Owners: `P11-primitives`
  - Task: P11: shrink={false} -> shrink-0, shrink={true} -> shrink (explicit), JSDoc; tests for both.
- **layout#40** [suggestion/docs] Flex's reverse `direction` and `wrap` values reorder content visually but not in the DOM, and the JSDoc has no focus-order caveat.
  - Owners: `P11-primitives`
  - Task: P11: JSDoc caveat on reverse direction/wrap (visual only; reorder DOM for focusable content) + dev warning when reverse is used and the container has focusable descendants (checked in effect).

### feedback-navigation

- **feedback-navigation#1** [important/bug] MessageBar's `dismiss` slot replaces the built-in button with an unwired button that never calls onDismiss and has no accessible name or type.
  - Owners: `P12-messages`, `F2-lib`, `P08-list-tag`, `P02-field-text`
  - Task: C-SLOTS dismiss semantics: slot content renders INSIDE the library's wired <button type='button' onClick={onDismiss} aria-label>; a slot that is itself a <button> element or a Wave Button is merged into the wired button (mergeProps, handlers composed) with a dev warning instead of being nested. F2: widened SlotObject + mergeProps. P12: MessageBar always renders its wired dismiss button, named per the C-SLOTS naming bullet (a merged button that renders a text label is named by that text, WCAG 2.5.3); `dismiss` typed `Slot<'span'> | SlotObject<'button'>` (deprecated button-object form compiles; listed in §7.3); tests: a custom slot click calls onDismiss once, has a name and type=button; a <button onClick> slot yields exactly one button and both handlers run. P08: Tag same (data-display#1). P02: SearchBox already correct; align typing and add a test. All three apply the C-SLOTS naming bullet (revision 2.5): tests that a merged button's text label names the button (Tag: text + tag content), that a lone `X`/`×`, an icon and `aria-hidden` text keep the default name, that text rendered later by a child component is followed, and that the server render uses the literal children. F2: `src/lib/labelInName.ts` replaces the local copies.
- **feedback-navigation#4** [suggestion/a11y] MessageBar and Toast show status severity only through icons and color, so screen-reader users cannot tell success from info or warning from error.
  - Owners: `P12-messages`
  - Task: P12: MessageBar and Toast render visually hidden status text before content ('Success:', 'Warning:', 'Error:', 'Info:'), overridable via `statusLabel` prop (i18n); icons aria-hidden; tests toHaveAccessibleName/contains status text.
- **feedback-navigation#6** [suggestion/a11y] Skeleton forces aria-hidden after the rest spread, and the library offers no busy or loading semantics for skeleton regions.
  - Owners: `P11-primitives`
  - Task: P11: aria-hidden placed before {...rest}; new Skeleton.Group (attached via Object.assign) renders a container with aria-busy='true', role='status' is NOT used; it carries a visually hidden `label` (default 'Loading') and keeps items decorative; tests.
- **feedback-navigation#7** [important/api-design] useToastController exposes dismissToast(id), but dispatchToast returns void and ToastOptions has no id, so consumers can never dismiss a toast from code; dismissToast…
  - Owners: `P12-messages`, `INTEGRATION`
  - Task: P12: dispatchToast(options & {toastId?}): string returns the id; same id replaces an existing toast; dismissToast clears and deletes its timer; export type ToastController; tests dispatch timeout 0 -> dismiss via returned id removes only that toast; vi.getTimerCount()===0 after. INTEGRATION: export ToastController type.
- **feedback-navigation#8** [important/error-handling] useToastController silently drops every toast when called outside a wrapping <Toaster>, and the guide documents exactly that setup (a self-closing sibling).
  - Owners: `P12-messages`, `DOCS`
  - Task: P12: ToasterContext default null; useToastController throws a descriptive error (dev) / console.error + no-op (prod) outside <Toaster>; test; listed in §7.3 (the 0.4 guide showed a sibling setup that now throws in development). DOCS: guide and README show <Toaster> wrapping the app.
- **feedback-navigation#11** [important/a11y] Each toast mounts as a brand-new role=status live region inside a plain Toaster div, so success, info and warning toasts are often never announced.
  - Owners: `P12-messages`
  - Task: P12: Toaster renders two permanent live regions (polite, assertive) from first render; each toast's announcement text is written into them (per-toast role/aria-live removed from the visual toast); tests assert regions exist before dispatch and receive text.
- **feedback-navigation#12** [important/a11y] Toasts auto-dismiss after a fixed 5 s with no pause on hover or focus, and focus drops to <body> when a focused toast is removed.
  - Owners: `P12-messages`, `F3-hooks-provider`, `F4-overlay`
  - Task: F3: usePreserveFocus helper (§2.3 row: enabled → false moves focus in the layout phase; on unmount the layout-effect cleanup detects focus inside, the move runs in a microtask after the commit, is cancelled if the same instance remounts (StrictMode) and is skipped when focus was already placed outside in the same commit; getFallback runs after removal, possibly after the whole tree is gone, so it must not throw). F4: targets inside [data-wave-focus-trap-allow] count as inside every layer for outside press and focus-outside, and are never inerted by modal isolation. P12: timers pause on pointerenter/focusin within a toast (and window blur), resume on leave/focusout with remaining time; before removing a toast containing focus, focus moves to the next toast or the previously focused element; Toaster viewport is portaled (F4 layer 'toast'), is a labelled region (aria-label 'Notifications') carrying data-wave-focus-trap-allow, and is reachable by Tab (also while a modal is open); fake-timer tests. Toast unmount-focus assertions `await act(async () => {})` or use userEvent before asserting focus (the move runs in a microtask), and the Toaster's getFallback must return null rather than throw (querySelector, never a throwing lookup).
- **feedback-navigation#13** [important/test-gap] Toaster's core behavior has no tests: the default 5000 ms auto-dismiss, custom and zero timeouts, removing one toast via Dismiss, and clearing timers on unmount.
  - Owners: `P12-messages`
  - Task: P12: fake-timer tests: default 5000ms (present at 4999, gone at 5000), timeout 1000, timeout 0 persists 60s, dismiss one of two toasts, unmount clears timers and logs nothing.
- **feedback-navigation#14** [important/test-quality] Toast's per-status test only checks that the toast renders, so the error toast's role="alert"/aria-live="assertive" mapping is never verified.
  - Owners: `P12-messages`
  - Task: P12: table-driven status tests assert the announcement goes to the assertive region for error and polite for others (after feedback-navigation#11) and the status text/glyph.
- **feedback-navigation#15** [suggestion/convention] Toast tests hand-write a subset of the system-prop checks instead of calling testSystemProps, so Toast and Toaster get no axe or displayName coverage and Toaster's…
  - Owners: `P12-messages`
  - Task: P12: testSystemProps(Toast, {displayName:'Toast', defaultProps:{title:'Saved'}, a11yVariants:[dismissible error]}) and testSystemProps(Toaster, {displayName:'Toaster'}); position mapping test (logical positions).
- **feedback-navigation#16** [important/bug] ProgressBar passes the raw value to aria-valuenow and divides by max without guarding max <= 0 or NaN, so it reports out-of-range values and draws a full bar when max…
  - Owners: `P11-primitives`
  - Task: P11: ProgressBar computes clamped = clamp(value,0,max) once for width and aria-valuenow; max<=0 or non-finite -> 0% (dev warning); tests value 150, -5, max 0, NaN.
- **feedback-navigation#17** [suggestion/a11y] ProgressBar has no accessible name unless `label` is passed, and the stories and axe tests ship and accept unnamed progressbars.
  - Owners: `P11-primitives`
  - Task: P11: ProgressBar naming: new `showLabel?: boolean` renders `label` visibly above the bar and wires it via useId + aria-labelledby (otherwise aria-label), dev warning when no label/aria-label/aria-labelledby; stories fixed; axe variants for unlabeled determinate/indeterminate expect the warning and labelled variants pass.
- **feedback-navigation#19** [suggestion/simplification] Spinner duplicates its whole render for the labelVisible branch and sets role="status" after the rest spread, so consumers cannot override the role.
  - Owners: `P11-primitives`
  - Task: P11: Spinner single return; role before rest (overridable); label class switches sr-only vs visible; decorative ring aria-hidden; tests role override.
- **feedback-navigation#20** [suggestion/a11y] A Spinner without `label` renders an empty role="status" region that tells screen-reader users nothing.
  - Owners: `P11-primitives`
  - Task: P11: label defaults to 'Loading' (localizable prop); the status region mounts empty and its text is set in a requestAnimationFrame callback scheduled from an effect (C-HOOKS deferred pattern) so it is announced; tests: default name, text present after the frame.
- **feedback-navigation#21** [suggestion/test-quality] Skeleton, Flex and Stack tests use substring className assertions (`toContain('rounded')`, `toContain('flex')`) that still pass when the behavior they name breaks.
  - Owners: `P11-primitives`
  - Task: P11: Skeleton/Flex/Stack tests use toHaveClass exact tokens with not.toHaveClass counterparts.
- **feedback-navigation#23** [important/a11y] Menu makes its role="menu" container the tab stop without roving tabindex or aria-activedescendant, so keyboard and screen-reader users land on an empty menu with no…
  - Owners: `P13-menu-nav`, `F3-hooks-provider`
  - Task: F3: roving DOM mode with typeahead. P13: Menu container not a tab stop; first enabled item tabIndex 0 (roving), focused on open; Arrow/Home/End/typeahead skip disabled; tests.
- **feedback-navigation#24** [suggestion/a11y] Nav, Menu, Pagination, Breadcrumb and Stepper have no focus-visible styling and fall back to the browser's default outline instead of the library's themed focus ring.
  - Owners: `P13-menu-nav`, `P14-pagination-stepper`, `F2-lib`
  - Task: F2: focusRing / focusRingInset constants. P13: Nav items/categories, Breadcrumb links/buttons and Menu items get the shared focus-visible ring; MenuItem focus:bg-subtle-hover matches hover. P14: Pagination buttons and Stepper step buttons get the ring. Tests assert classes.
- **feedback-navigation#25** [important/test-gap] Navigation tests never exercise key keyboard accessibility behavior (Menu Enter/Space/Home/End, Stepper Enter/Space, Pagination focus retention) and run axe on…
  - Owners: `P13-menu-nav`, `P14-pagination-stepper`
  - Task: P13: Menu Enter/Space (incl. disabled), Home/End (disabled first/last), ArrowUp from items[1], wrap from items[0]; Nav testSystemProps defaultProps with Item + Category and expanded variant. P14: Stepper Enter/Space; Pagination focus retention after reaching page 1.
- **feedback-navigation#26** [important/bug] Pagination never clamps currentPage to [1, totalPages], so an out-of-range page renders a phantom button marked aria-current or leaves Previous/Next enabled but doing…
  - Owners: `P14-pagination-stepper`
  - Task: P14: page = clamp(currentPage, 1, totalPages) used for range, aria-current, prev/next state; onPageChange(page) when clamping changes the value (effect, once); dev warning for NaN/non-integer totalPages (treated as floor, NaN -> render nothing); tests.
- **feedback-navigation#29** [important/a11y] Pagination's First, Previous, Next and Last buttons become natively disabled while they have focus, so keyboard focus drops to the document body.
  - Owners: `P14-pagination-stepper`
  - Task: P14: boundary buttons use aria-disabled (C-DISABLED) and stay focusable; native disabled only for whole-control `disabled`; test focus remains on First after activating it. Existing 'disabled at boundary' tests switch from toBeDisabled to aria-disabled.
- **feedback-navigation#30** [suggestion/a11y] Pagination's button accessible names ('First page', 'Page N', 'Next page', etc.) are hard-coded English with no prop to localize them.
  - Owners: `P14-pagination-stepper`
  - Task: P14: `getItemAriaLabel?(type: 'first'|'previous'|'page'|'next'|'last', page: number, selected: boolean) => string` with English defaults; root aria-label override documented; test custom labels.
- **feedback-navigation#31** [important/bug] NavCategory takes its button label from only the first string child and renders every non-string child into the sub-list <ul>, so label content is lost, toggles can…
  - Owners: `P13-menu-nav`
  - Task: P13: NavCategory `label: ReactNode` prop rendered in the button; children = sub-items rendered unchanged in the <ul>; string-sniffing path kept as deprecated fallback when label is absent (warnDeprecated); tests with element label and interpolated text.
- **feedback-navigation#32** [important/api-design] Nav categories are always collapsed on mount and have no default or controlled open state, so a sub-item matching selectedValue is hidden on first render.
  - Owners: `P13-menu-nav`
  - Task: P13: openCategories/defaultOpenCategories/onOpenCategoriesChange via useControllable; uncontrolled default opens categories containing the selected value; tests.
- **feedback-navigation#33** [suggestion/type-design] Nav.Item, Nav.SubItem and Breadcrumb.Item render an <a> when given href, but their props don't accept anchor attributes (target, rel, download), and Nav items can't…
  - Owners: `P13-menu-nav`
  - Task: P13: Nav.Item/SubItem and Breadcrumb.Item props become discriminated unions on href (AnchorHTMLAttributes vs ButtonHTMLAttributes); Nav items honor `disabled` (aria-disabled for anchors, disabled for buttons, handleClick guarded); type + behaviour tests.
- **feedback-navigation#34** [important/styling] Nav, Pagination, Breadcrumb and the vertical Stepper use physical left/right utilities and unmirrored chevrons, so under dir="rtl" they lay out wrongly and their…
  - Owners: `P14-pagination-stepper`, `P13-menu-nav`, `P03-choice`, `P02-field-text`, `P06-datetime`, `P07-identity`, `P16-popups`, `P08-list-tag`, `P05-listbox`, `P09-disclosure`, `P12-messages`, `F6t-test-infra`
  - Task: C-LOGICAL: replace physical utilities with logical ones (ms/me/ps/pe/start/end/border-s/e/rounded-s/e/text-start/end) and mirror directional icons with rtl:-scale-x-100. F6t: conventions test enforces it (physical margin/padding/inset/border/radius/text-align/float/origin/gradient-direction/scroll-margin utilities and translate-x state classes without an rtl: counterpart). P14: Pagination chevrons mirrored, Stepper connector ms-[15px]. P13: Nav border-s-2 indicator, ps-11, text-start, border-e; Breadcrumb separator mirrored; Menu shortcut ms-4. P03: Switch thumb translate uses rtl: variants (rtl:-translate-x-*). P02: SearchBox/Input/Select icon positions start/end, padding ps/pe. P06: DatePicker/TimePicker. P07: AvatarGroup overlap -ms-*, Avatar/Persona. P16: Popover beak/placement, TeachingPopover close button end-3. P08: Tag. P05: Dropdown/TagPicker. P09: TabList vertical border-e. P12: MessageBar/Toast ms-auto, border-s. Each adds at least one dir=rtl class assertion test.
- **feedback-navigation#35** [important/test-gap] The href (anchor) branch of Nav.Item and Nav.SubItem, and the call-through to the consumer's onClick, are never tested.
  - Owners: `P13-menu-nav`
  - Task: P13: href tests for Nav.Item/SubItem: renders link, click calls onValueChange(value) and consumer onClick, aria-current='page' moves; button-branch consumer onClick test.
- **feedback-navigation#36** [important/bug] Stepper assigns step indices with React.Children.toArray and cloneElement, so steps wrapped in a Fragment or a wrapper component all become index 0, and the shared…
  - Owners: `P14-pagination-stepper`
  - Task: P14: Steps register via context (registration order / useId-keyed descendant list) instead of cloneElement index; `index` prop kept as optional override; fixture changed to direct children; tests with Fragment-wrapped and conditional steps numbered 1..n.
- **feedback-navigation#37** [important/bug] Stepper's Step calls the consumer's onClick even for disabled or linear-blocked steps, while Enter/Space activation skips onClick entirely, and neither path is tested.
  - Owners: `P14-pagination-stepper`
  - Task: P14: shared activate(e) used by click and Enter/Space: returns early when !isClickable (disabled or linear-blocked) before calling consumer onClick and onStepChange; tests both orientations.
- **feedback-navigation#38** [critical/a11y] Stepper exposes no current, completed or error state to assistive technology: there is no aria-current and no list semantics, and completed or error icons replace the…
  - Owners: `P14-pagination-stepper`
  - Task: P14: Stepper keeps its root <div> (ref type unchanged) and renders an inner <ol> (list semantics) with one <li> per step; each Step keeps its own root element (ref/className unchanged) inside that <li>; aria-current='step' on the active step's interactive element, visually hidden 'Completed:'/'Error:' status text, step number kept in the accessible name; tests via getByRole('button',{current:'step'}) and within() per step.
- **feedback-navigation#39** [suggestion/test-gap] Stepper's separately written vertical layout and its linear-mode aria-disabled and tabIndex state are untested.
  - Owners: `P14-pagination-stepper`
  - Task: P14: click/keyboard/disabled tests run for both orientations; linear test asserts aria-disabled='true' and tabindex -1 on unreachable steps, tabindex 0 on reachable.
- **feedback-navigation#40** [important/a11y] Breadcrumb.Item without href renders an unfocusable <a> with no link role that is still styled as a link, and the tests use that case without checking it (the…
  - Owners: `P13-menu-nav`
  - Task: P13: Breadcrumb.Item without href renders <button type='button'> when onClick is given, else <span> (dev warning for non-current items without href/onClick); `as`/asChild-style link support for routers via renderTrigger-like `asChild`; tests for no-href rendering and separator placement per listitem.
- **feedback-navigation#41** [suggestion/test-quality] Navigation tests run testSystemProps only on the root components and never pass consumer handlers alongside the internal ones, so sub-component contracts and handler…
  - Owners: `P14-pagination-stepper`, `P13-menu-nav`
  - Task: P13: testForwardRef/testRestSpread/testClassName/testDisplayName on Menu.Item, Nav.Item/SubItem/Category, Breadcrumb.Item plus composition tests (consumer onKeyDown/onClick + internal). P14: same for Stepper.Step; replace count-based assertions with per-step state and ellipsis positions.
- **feedback-navigation#42** [important/test-gap] Stepper's step-change tests only check the onStepChange callback, so the uncontrolled UI update, controlled activeStep mode and the completed override are untested.
  - Owners: `P14-pagination-stepper`
  - Task: P14: after click assert step 2 current and step 1 completed (uncontrolled); controlled test: callback fires but active stays until rerender; controlled linear reachability follows the prop.
- **feedback-navigation#43** [important/test-quality] Pagination's range algorithm is only tested by counting at least two aria-hidden ellipses, so siblingCount, boundaryCount, gap filling and near-edge cases are never…
  - Owners: `P14-pagination-stepper`
  - Task: P14: export getPaginationRange from Pagination.tsx (named, internal-stable) and unit-test it table-driven ((20,10), (8,4), sibling/boundary 2, near edges, gap-of-2 fill); plus one rendered-sequence test.
- **feedback-navigation#44** [suggestion/test-quality] Pagination's edge-case tests are vacuous or missing: the disabled test passes with zero buttons, and the totalPages<1 path and First/Last navigation are untested.
  - Owners: `P14-pagination-stepper`
  - Task: P14: disabled test asserts button count first; totalPages={0} renders nothing; First/Last click tests and boundary aria-disabled.
- **feedback-navigation#45** [suggestion/test-quality] NavCategory tests never check that aria-expanded changes to true or false after toggling.
  - Owners: `P13-menu-nav`
  - Task: P13: assert aria-expanded true/false after each toggle; keyboard Enter/Space toggle test.
- **feedback-navigation#46** [suggestion/api-design] Stepper and TeachingPopover, and Nav/TabList versus Combobox/Dropdown/RadioGroup, use different prop names for the same step-index and single-selection concepts.
  - Owners: `P14-pagination-stepper`, `P16-popups`, `P09-disclosure`, `P13-menu-nav`
  - Task: C-NAMING: step index = activeStep/defaultActiveStep/onStepChange; single selection = value/defaultValue/onValueChange. Value callbacks fire only on change; deprecated event-named aliases keep 0.4 semantics and fire on every activation (called from the activation handler). P14: Stepper already compliant (onStepChange keeps firing on re-activation, table-core#3). P16: TeachingPopover activeStep/defaultActiveStep (currentStep/defaultCurrentStep deprecated aliases). P09: TabList value/defaultValue/onValueChange (selectedValue/defaultSelectedValue/onTabSelect deprecated; onTabSelect still fires when the selected tab is activated again — regression test). P13: Nav value/defaultValue/onValueChange (selectedValue/defaultSelectedValue/onNavItemSelect deprecated; onNavItemSelect still fires on re-selecting the current item — regression test). Alias tests with warnOnce.
- **feedback-navigation#47** [suggestion/simplification] Menu and List carry near-duplicate DOM-query arrow-key navigation that has drifted apart, and Tree has a third variant, so tab-stop behavior is inconsistent.
  - Owners: `P13-menu-nav`, `P08-list-tag`, `P09-disclosure`, `F3-hooks-provider`
  - Task: F3: useRovingTabIndex DOM mode (items without string values get generated data-roving-value ids) + typeahead + tabStop option. P13 Menu (tabStop 'last-focused' for the static menu; first item on open for Menu.Popover), P08 List ('active'), P09 Tree ('active': selected item else first) drop their bespoke querySelectorAll navigation and use the hook (Tree adds hierarchy keys on top); single tab stop in all three.
- **feedback-navigation#48** [suggestion/simplification] Stepper duplicates its full step markup, keyboard handler and label logic for the vertical and horizontal orientations, and passes the index through an untyped…
  - Owners: `P14-pagination-stepper`
  - Task: P14: single step body with orientation-dependent layout classes; index via per-step context (no cloneElement cast); remove duplicated handlers.
- **feedback-navigation#49** [suggestion/comments] A Stepper comment says the step index comes from a data attribute, but the parent actually injects it as a prop with cloneElement.
  - Owners: `P14-pagination-stepper`
  - Task: P14: delete the stale data-attribute comment (lines 74-75); comment matches the new registration mechanism.
- **feedback-navigation#50** [important/a11y] Toasts shown over an open Dialog or Drawer can be seen and clicked but not reached by keyboard, and the modal's focus trap, which only acts at the edges, lets focus…
  - Owners: `P12-messages`, `P15-modal`, `F4-overlay`, `INTEGRATION`
  - Task: F4: Portal layers + z scale (--wave-z-toast above overlays); useFocusTrap allow-list `[data-wave-focus-trap-allow]` whose tabbables join the Tab cycle; useDismiss treats targets inside the allow-list as inside every layer; modal isolation (§2.4) never inerts allow-listed regions or the announcer; unit tests with an allow-listed portaled div. P12: Toaster viewport portaled with layer 'toast' and data-wave-focus-trap-allow. P15: Dialog/Drawer use useModalLayer (trap + isolation inherit the allow-list); stand-in test: an allow-listed portaled div with a button is reachable by Tab from inside the open Dialog, is not inert, and clicking it does not close the Dialog. INTEGRATION: a real timeout:0 Toast dispatched inside an open Dialog is reachable by Tab, exposed to AT (not inert, no aria-modal pruning), and dismissable by keyboard and by mouse without closing the Dialog.
- **feedback-navigation#51** [important/a11y] Menu has no open/trigger API, so no supported composition (MenuButton, SplitButton, Popover) gives a working APG menu button: focus doesn't move into the menu, arrow…
  - Owners: `P13-menu-nav`, `P01-buttons`, `P16-popups`, `DOCS`, `F2-lib`, `F3-hooks-provider`, `F4-overlay`, `INTEGRATION`
  - Task: F2: renderTrigger/mergeProps. F3: useTriggerElement (asChild + render-prop + wrapper fallback). F4: Portal/usePopupPosition/useDismiss/useRestoreFocus. P13: Menu gains open/defaultOpen/onOpenChange (useControllable), Menu.Trigger (merges aria-haspopup='menu', aria-expanded, aria-controls, id, composed onClick, Enter/Space/ArrowDown -> open+focus first, ArrowUp -> open+focus last), Menu.Popover (portaled role=menu surface); item select closes + restores focus to the trigger (Menu.Item `persistOnClick` opt-out), Escape closes + restores, Tab closes (focus continues from the trigger; the dialog focus trap cooperates, §2.4); static <Menu> without Trigger unchanged; P13 tests use a plain <button> trigger child. P01: MenuButton passes through aria-expanded/aria-controls/handlers (props after internal defaults, composed handlers); SplitButton menuButtonProps usable via the Menu.Trigger render-prop; P01 tests use a local stand-in trigger-props object, never P13's Menu (§5.2). P16: Popover remains usable for custom popups; docs point menu buttons to Menu.Trigger. DOCS: guide/README menu-button pattern. INTEGRATION: MenuButton and SplitButton composed with the real Menu.

### overlays

- **overlays#1** [critical/bug] Dialog, Drawer and Popover close on any document-level Escape, so dismissing a nested Dropdown/Combobox/Popover/picker also closes every enclosing overlay.
  - Owners: `F4-overlay`, `P15-modal`, `P16-popups`, `P05-listbox`, `P06-datetime`, `INTEGRATION`
  - Task: F4: layered useDismiss on a globalThis-keyed registry: Escape goes to the topmost escape-enabled layer whose tree contains the event target or document.activeElement (fallback: the global topmost; the full four-step rule and the modal barrier are in §2.4, which wins); topmost = a descendant above its ancestor, then open order; events with defaultPrevented/isComposing are ignored; a handled Escape calls preventDefault; parentage via DismissLayerContext (portals keep React context). P15 Dialog/Drawer and P16 Popover/Tooltip/TeachingPopover register layers. P05 and P06 listboxes/calendar register layers and preventDefault when they consume Escape. Owner tests use stand-ins only (§5.9): P15 a raw useDismiss child layer inside a Dialog (Escape closes only the child); P05/P06 a listbox inside a raw parent layer (Escape closes only the listbox). INTEGRATION: Escape in a real Dropdown inside a real Dialog closes only the listbox, a second Escape closes the Dialog.
- **overlays#2** [important/bug] Dialog and Drawer backdrop onClick closes the overlay after a drag that starts inside the content and on clicks inside nested portaled children.
  - Owners: `P15-modal`, `F4-overlay`
  - Task: F4: outside press: at pointerdown (capture) every open layer with outsidePress whose tree does not contain the target is recorded (not only the topmost); on the following click (bubble) each recorded layer whose tree still does not contain the click target is dismissed; layers registered after the pointerdown are ignored (a popup opened by that very click survives); targets inside [data-wave-focus-trap-allow] are inside. F4 test: a calendar-like layer is open, a click on a stand-in trigger opens a second layer → the first closes, the second stays open. P15: backdrop dismissal uses it (the Dialog layer's elements are the content surface only; the backdrop is outside); tests: drag from content to backdrop does not close; a click inside a nested portaled stand-in layer does not close the outer; a plain backdrop click closes.
- **overlays#3** [important/a11y] Dialog and Drawer focus trap counts disabled, hidden and tabindex=-1 elements, so Tab and Shift+Tab can escape the modal.
  - Owners: `P15-modal`, `F4-overlay`, `F2-lib`
  - Task: F2: getTabbableElements (excludes disabled, type=hidden, tabindex<0, inert/hidden/display:none ancestors; named radio groups follow browser Tab order — the focused member while focus is in the group, else the checked radio, else every tabbable member — so the result depends on the focused element, §2.2). F4: useFocusTrap(element, options) — element-based (surface held in state via callback ref); tabbables computed in the keydown handler, never cached (§2.4); initial focus synchronously once the element exists unless focus is already inside (autoFocus respected); Tab handled by a document bubble-phase listener that skips defaultPrevented events (React handlers such as Menu.Popover's Tab run first); wraps at the edges, from the container itself and from a non-tabbable active element; focus inside a descendant layer (portaled Popover/Menu opened from the dialog) tabs natively inside that layer, and leaving it moves focus to the tabbable after the layer's anchor (Shift+Tab: the anchor itself); focusin outside → back in; trap stack (topmost active). P15: Dialog and Drawer use it via useModalLayer (duplicated trap deleted); tests with a disabled last button, a tabindex=-1 button, Shift+Tab from the container, and two links inside a stand-in popover layer anchored in the dialog.
- **overlays#5** [important/a11y] Dialog.Trigger and Popover.Trigger render a wrapper span, so aria-expanded/aria-controls and an outer Tooltip's aria-describedby land on the span instead of the…
  - Owners: `P16-popups`, `P15-modal`, `P01-buttons`, `F2-lib`, `F3-hooks-provider`
  - Task: F2: renderTrigger/mergeProps (pure core; `oursWin` keys). F3: useTriggerElement(children, triggerProps, options) hook: single intrinsic/forwarding child → cloneElement with merged props (merged ref memoised with useMergedRefs keyed on the child's ref; trigger state ARIA — aria-expanded, aria-controls, aria-haspopup — always wins; the child's own id wins and is reported to the root context), render-prop children, `asChild={false}` renders the 0.4 wrapper <span> (opt-out), and automatic fallback: if the cloned child's ref has not attached after mount the trigger re-renders with the wrapper span and warns in development. P16: Popover.Trigger asChild: aria-haspopup='dialog', aria-expanded, aria-controls only while open, id for labelling, composed onClick, ref (anchor). P15: Dialog.Trigger (and new Drawer.Trigger) same with aria-haspopup='dialog' + aria-expanded. P01: SplitButton root routes aria-describedby to the primary button. Tests: a non-forwarding custom child still opens (wrapper fallback + warning); asChild={false} renders the span; Popover.test.tsx asserts on getByRole('button'); axe open state.
- **overlays#7** [important/a11y] Dialog has a fixed 400/600px width with no max-width, max-height or scrolling, so content is clipped at 320px width and 400% zoom.
  - Owners: `P15-modal`
  - Task: P15: Dialog width w-full max-w-[600px]/max-w-[400px], max-h-[calc(100dvh-2rem)] with overflow-y-auto body, backdrop p-4; rounded-xl -> rounded-lg (C-RADIUS); test classes; story at narrow viewport.
- **overlays#8** [suggestion/a11y] Dialog and Drawer render unnamed role=dialog elements when title is omitted, with no development warning.
  - Owners: `P15-modal`
  - Task: P15: dev warning when Dialog/Drawer content has none of title, aria-label, aria-labelledby; new Dialog.Title (and Drawer.Title) registering its id in context for aria-labelledby; `title` accepts ReactNode; tests.
- **overlays#9** [important/a11y] Dialog and Drawer never restore focus when unmounted while open, and restore to document.activeElement rather than the trigger.
  - Owners: `P15-modal`, `F4-overlay`
  - Task: F4: useRestoreFocus captures the opener in an insertion effect when `enabled` flips true (before React applies autoFocus inside the new surface), preferring triggerRef, ignoring body and candidates inside the layer; restores on close and on unmount-while-open (scheduled in a microtask and cancelled if the same instance re-mounts, so React 19 StrictMode does not snap focus back after opening). P15: Dialog.Trigger/Drawer.Trigger register the trigger ref in context; tests: a conditionally unmounted open dialog restores focus to the opener; a controlled Dialog without Trigger whose content has an autoFocus input restores to the real opener; opening under StrictMode keeps focus inside; Safari-like case where activeElement was body uses the trigger.
- **overlays#10** [important/a11y] Dialog and Drawer restore focus to an opener that has been removed or sits behind another modal, dropping focus to <body>.
  - Owners: `P15-modal`, `F4-overlay`
  - Task: F4: restore target validated (isConnected, focusable, not inside an inert/aria-hidden subtree or another open modal layer) else finalFocusRef / fallback callback / parent layer container; useModalLayer removes modal isolation before restoring focus. P15: Dialog/Drawer expose `finalFocusRef` (returnFocus) prop; tests for a removed opener.
- **overlays#11** [important/bug] Dialog and Drawer body scroll lock is saved/restored per instance and not reference-counted, so stacked overlays leave body scroll stuck or prematurely unlocked.
  - Owners: `P15-modal`, `F4-overlay`
  - Task: F4: useScrollLock with a ref-counted counter in a globalThis registry; on 0→1 sets overflow hidden on the document scroller and keeps layout stable with `scrollbar-gutter: stable` where supported, else compensates the measured scrollbar width with padding-inline-end (RTL-correct); restores only on 1→0. P15: Dialog/Drawer use it (via useModalLayer); tests open/close/unmount and stacked out-of-order close leave the document styles restored.
- **overlays#12** [suggestion/a11y] Popover.Content renders role="dialog" with no accessible name.
  - Owners: `P16-popups`
  - Task: P16: Popover.Content defaults aria-labelledby to the trigger's resolved id (the child's own id when present, as reported by useTriggerElement) unless aria-label/aria-labelledby is given; optional `title`; dev warning if neither is available; axe on open state.
- **overlays#13** [important/a11y] Popover does not return focus to its trigger when dismissed from inside, so focus falls to <body>.
  - Owners: `P16-popups`, `F4-overlay`
  - Task: F4: useRestoreFocus. P16: trigger element stored in context; when the popover closes while focus is inside (or via Escape), focus returns to the trigger; tests for inner Close button and Escape.
- **overlays#14** [important/a11y] Tooltip overwrites the child's existing aria-describedby and removes it entirely while the tooltip is hidden.
  - Owners: `P16-popups`
  - Task: P16: aria-describedby = joinIds(child's own, tooltipId) at all times; tooltipId belongs to the always-present inline `hidden` role='tooltip' element next to the trigger (overlays#18), so the reference never dangles; tests: the child's own id survives while hidden and while visible; after unhover both ids remain.
- **overlays#17** [important/bug] Tooltip show() does not clear a pending timer, so hover followed by focus can leave an orphaned timeout that re-shows the tooltip after it was dismissed.
  - Owners: `P16-popups`
  - Task: P16: show() clears any pending timer first; fake-timer regression test enter -> focus -> leave -> blur leaves tooltip hidden.
- **overlays#18** [important/a11y] Tooltip creates its element and aria-describedby only after the show delay, so screen readers miss the description on focus.
  - Owners: `P16-popups`
  - Task: P16: the description is an inline, always-rendered `<span id role='tooltip' hidden>` inside the Tooltip wrapper (SSR-safe, no portal per instance); only the visual surface is portaled (Portal layer='tooltip', aria-hidden because it duplicates the description) and only while visible, so hundreds of tooltips create no portal roots; describedby permanent; the delay only affects the visual. Tests: toHaveAccessibleDescription immediately on focus; no portal node while hidden.
- **overlays#19** [important/a11y] Tooltip fails WCAG 1.4.13: it cannot be dismissed with Escape and disappears when the pointer moves onto it.
  - Owners: `P16-popups`, `F4-overlay`
  - Task: F4: useDismiss escape-only layer. P16: visible tooltip registers an Escape layer (closes tooltip only, stops the enclosing overlay from closing); hide delayed ~100ms and cancelled on tooltip pointerenter (hoverable), no gap (offset handled by positioning with a transparent hover bridge); tests.
- **overlays#20** [suggestion/a11y] Tooltip only supports the description relationship, so it cannot name icon-only buttons.
  - Owners: `P16-popups`
  - Task: P16: relationship?: 'description' | 'label' (default description); 'label' sets aria-labelledby=tooltipId (merged) on the child; tests icon-only Button gets name from tooltip.
- **overlays#21** [suggestion/bug] Tooltip renders nothing for text/multiple children without a warning, and puts aria-describedby on a Fragment child.
  - Owners: `P16-popups`, `F2-lib`
  - Task: F2: renderTrigger fallback. P16: non-element/Fragment/multiple children -> dev warning and render inside the wrapper span with aria-describedby on the span (never return null, never clone a Fragment); tests.
- **overlays#22** [important/test-quality] Tooltip tests never exercise the delay prop or the keyboard focus/blur path.
  - Owners: `P16-popups`
  - Task: P16: fake-timer tests assert no tooltip at delay-1 and visible at delay; Tab-to/Tab-away path.
- **overlays#25** [important/api-design] TeachingPopover has no internal open state, so Close, Done and Escape do nothing unless the consumer controls `open` (inconsistent with the other overlays).
  - Owners: `P16-popups`, `P06-datetime`, `P09-disclosure`
  - Task: P16: TeachingPopover open via useControllable(open, defaultOpen ?? true, onOpenChange); Close/Done/Escape call setOpen(false) + onDismiss; focus restored on close. P06: DatePicker defaultOpen (input-datetime#21). P09: Tree expandedItems/onExpandedItemsChange controlled API (layout#30). Tests for uncontrolled dismissal.
- **overlays#26** [suggestion/bug] TeachingPopover renders step 0 content for an out-of-range currentStep while isFirst/isLast use the raw index, so it shows Back, no active dot, and never reaches Done.
  - Owners: `P16-popups`
  - Task: P16: index = clamp(activeStep, 0, steps.length-1) drives content, isFirst/isLast and dots; dev warning when out of range; tests assert rendered heading after Next/Back, controlled + out-of-range; dot tests assert aria-current/'Step n of m' not hex.
- **overlays#27** [important/a11y] TeachingPopover drops focus to <body> when the Back button unmounts on step 1 or when dismissed, after which Escape no longer works.
  - Owners: `P16-popups`, `F4-overlay`
  - Task: P16: Back stays rendered with aria-disabled on the first step (C-DISABLED; the gated hover classes do not react); Escape handled by the useDismiss layer (document-level, works regardless of focus); the opener is captured on open (insertion effect) and focus restored on close/unmount (useRestoreFocus); tests.
- **overlays#28** [important/a11y] TeachingPopover step changes are silent to screen readers, and step progress is conveyed only by colored aria-hidden dots.
  - Owners: `P16-popups`, `F3-hooks-provider`
  - Task: F3: useAnnounce. P16: visually hidden 'Step n of m' in the heading, focus moves to heading (tabIndex -1) or title announced politely after step change; current dot distinguishable by shape/size; tests.
- **overlays#29** [important/test-quality] TeachingPopover Escape test focuses the dialog manually, masking the auto-focus behavior Escape depends on.
  - Owners: `P16-popups`
  - Task: P16: Escape test without manual focus; assert focus on mount and after open false->true; Escape calls onDismiss once.
- **overlays#30** [suggestion/api-design] TeachingPopover cannot be anchored to a target; it renders in normal flow and shifts page layout when shown or dismissed.
  - Owners: `P16-popups`, `F4-overlay`
  - Task: F4: usePopupPosition. P16: TeachingPopover `target?: RefObject<HTMLElement> | HTMLElement | null` + side/align; when target given, surface is portaled and positioned with a beak (arrow middleware); without target keeps inline rendering (back-compat); tests/story.
- **overlays#31** [important/test-gap] Dialog, Drawer, Popover and TeachingPopover lack tests for initial focus, Tab trapping, focus return, nested Escape and axe on the open state.
  - Owners: `P15-modal`, `P16-popups`
  - Task: P15: userEvent tests for Dialog and Drawer: initial focus, Tab/Shift+Tab wrap (disabled last button), focus return on Escape/Close/backdrop, nested Escape with a stand-in child layer, axe open. P16: Popover focus return, TeachingPopover Back focus, axe open states for Popover/TeachingPopover/Tooltip.
- **overlays#32** [important/test-gap] Overlay tests do not assert the controlled contract or onOpenChange(false) on any close path.
  - Owners: `P16-popups`, `P15-modal`
  - Task: P16/P15: for each overlay render with open + spy; Escape, outside press and Close each call onOpenChange(false) exactly once while the overlay stays open; controlled-closed Popover trigger calls onOpenChange(true) without opening. Separate-interactions rule (§2.3): the close paths must be separate tasks — userEvent actions, or `await act(async () => {})` between fireEvent calls. Back-to-back synchronous fireEvent calls run in one task, and the per-event pending value (cleared in a microtask) makes them chain like uncontrolled mode, so the second and third close in one task are no-ops against the pending false and onOpenChange(false) fires only once in total.
- **overlays#33** [suggestion/api-design] Drawer supports defaultOpen but has no Trigger or imperative API, so uncontrolled Drawers can never open or reopen.
  - Owners: `P15-modal`, `INTEGRATION`
  - Task: P15: Drawer.Trigger and Drawer.Close (asChild via useTriggerElement, `asChild={false}` opt-out) sharing context with the root (compound API like Dialog), plus flat names DrawerTrigger/DrawerClose (C-COMPOUND); uncontrolled open/reopen tests. INTEGRATION: export the new sub-components and prop types.
- **overlays#34** [suggestion/error-handling] Compound sub-components (Dialog, Popover, Accordion, Tree, Nav, DataGrid, Stepper, Overflow) silently fall back to no-op default contexts when used outside their root.
  - Owners: `P15-modal`, `P16-popups`, `P09-disclosure`, `P13-menu-nav`, `P17-table`, `P14-pagination-stepper`, `P10-carousel-overflow`
  - Task: C-CONTEXT: createContext<T|null>(null) + useXContext(componentName) that throws in dev naming the parent (console.error + inert fallback in prod). P15 Dialog/Drawer, P16 Popover, P09 Accordion/Tree, P13 Nav/Menu, P17 DataGrid, P14 Stepper, P10 Overflow; one test per context that a misplaced sub-component throws (dev).
- **overlays#35** [important/simplification] Merged-ref boilerplate is duplicated in seven places, and TeachingPopover's inline copy re-attaches its ref on every render.
  - Owners: `F2-lib`, `F3-hooks-provider`, `P16-popups`, `P15-modal`, `P03-choice`, `P09-disclosure`, `P10-carousel-overflow`
  - Task: F2: mergeRefs (React 19 cleanup-aware). F3: useMergedRefs (memoized; also used inside useTriggerElement so cloned triggers do not re-attach their ref every render). P16 TeachingPopover, P15 Dialog/Drawer, P03 RadioGroup, P09 TabList, P10 Overflow (2 copies) replace inline merges; test the ref receives the node once (no re-attach per render).
- **overlays#36** [important/bug] Popover, Tooltip and picker popups are not portaled, so a Drawer body's overflow-y-auto clips them or grows its scroll area; positioning and z-index are hand-rolled…
  - Owners: `F4-overlay`, `P15-modal`, `P16-popups`, `P05-listbox`, `P06-datetime`, `INTEGRATION`
  - Task: F4: Portal (React-rendered themed wrapper created in the first client commit via useIsClient, PortalDepthContext depth) + usePopupPosition (@floating-ui/react-dom) + --wave-z-* scale. P16 Popover and the Tooltip visual, P05 listboxes (while open), P06 calendar/time list render their surfaces through Portal + usePopupPosition; P15 Drawer body keeps overflow-y-auto (popups are no longer clipped). INTEGRATION: a real Tooltip inside Overflow, Table, Card and an open Drawer renders its surface in the portal root (not a descendant of the clipping container). Overflow, Table and Card render no popups themselves, so P10/P11/P17 have no task here (§5.9).
- **overlays#37** [important/bug] Tooltip, Popover, DatePicker and the picker listboxes have no viewport collision handling, so surfaces near the top, right or bottom edges open off-screen.
  - Owners: `F4-overlay`, `P16-popups`, `P06-datetime`, `P05-listbox`
  - Task: F4: usePopupPosition side/align (logical start/end resolved with useDirection, which falls back to the document direction without a provider), offset, flip, shift(padding 8), size(matchReferenceWidth), arrow; guards ResizeObserver/IntersectionObserver absence. P16: Tooltip/Popover get side/align props; tooltip text wraps (max-w-60 whitespace-normal). P06: calendar/time list positioned with flip/shift. P05: listboxes bottom-start with flip and matched width. Tests assert the placement data attribute switches when mocked rects collide.
- **overlays#38** [suggestion/styling] Tooltip and Popover surfaces inherit the host's typography and color (e.g. uppercase semibold in header cells, muted text in Accordion panels).
  - Owners: `P16-popups`
  - Task: P16: Tooltip surface gets normal-case tracking-normal font-normal text-start text-caption-1; Popover.Content text-foreground + same resets (portaling removes inheritance too); tests assert classes.
- **overlays#40** [suggestion/api-design] Drawer and Toaster positions are physical-only ('left'|'right', 'bottom-right'), forcing RTL apps to branch on direction at every call site.
  - Owners: `P15-modal`, `P12-messages`
  - Task: P15: Drawer position 'start'|'end' (default 'end'), 'left'|'right' kept as physical values; start-0/end-0; close button ms-auto. P12: Toaster positions 'top-start'|'top-end'|'bottom-start'|'bottom-end' (default 'bottom-end'), physical values kept; tests under rtl.
- **overlays#41** [important/bug] Popover's document mousedown outside-check treats a portaled Dialog or Drawer inside Popover.Content as outside, unmounting it on the first click.
  - Owners: `F4-overlay`, `P16-popups`, `P15-modal`, `INTEGRATION`
  - Task: F4: outside press and focus-outside treat targets inside descendant layers as inside; a Portal registers its wrapper with the PARENT layer (the DismissLayerContext value outside it) and provides its own layerId only to its children. P16: Popover content provides its layer context; test with a raw F4 child layer (Portal + useDismiss) inside Popover.Content: clicks inside it keep the Popover open. P15: Dialog/Drawer register as child layers of the enclosing layer; test with a raw parent-layer harness around a Dialog. INTEGRATION: a real Dialog opened from Popover.Content stays open and the Popover does not close on the first click inside the Dialog.

### repo-level

- **repo-level#1** [critical/packaging] The published './styles' entry (src/styles/globals.css) is raw Tailwind 4 source with no `@source`, so consumers who follow the README Quick Start get no component…
  - Owners: `F1-tokens`, `F6a-tooling`, `F6b-pipeline`, `DOCS`, `INTEGRATION`
  - Task: F1: src/styles/styles.css (precompiled input, §2.1.1/§2.1.8: `@import 'tailwindcss/theme.css' theme(inline)` and `@import 'tailwindcss/utilities.css' source(none)` without layer(), explicit `@source '../components'`, `@source '../lib'`, `@source not '../components/**/__tests__'`, then tokens + base), src/styles/tailwind.css (Tailwind-4 source entry with @source '../../dist'), preflight.css, scripts/build-css.mjs -> dist/styles.css + dist/preflight.css, asserting: required selectors, keyframes, --wave vars and the scoped native reset are present; no top-level @layer block except Tailwind's `properties` fallback; `--spacing`, `--font-sans`, `--color-red-500` and every story-only class are absent. F6a: installs @tailwindcss/cli (dev) and declares the optional peer tailwindcss ^4.1. F6b: package.json exports ('./styles' -> dist/styles.css, './tailwind', './tokens', './preflight.css', './legacy-tokens.css'), `files` excludes src/styles/__tests__, build runs build-css, .storybook/preview.css (`@import '../src/styles/styles.css'; @source '../stories';`) with viteFinal adding @tailwindcss/vite, packaging smoke test (pack; plain fixture asserting the CSS is unlayered and contains .bg-primary/.text-body-1/--wave-primary/@keyframes wave-spin, ESM+CJS resolve with types; Tailwind fixture compiling ./tailwind and generating component classes from dist), scripts/verify-storybook.mjs (emitted Storybook CSS contains .bg-primary and every story-only utility, found by a reference Tailwind compile of src/styles/styles.css with stories/ as an extra source, independently of .storybook/preview.css; with no story-only utility the check passes on .bg-primary alone, and it fails again as soon as a story adds one that the build lacks, §3.2). DOCS: README setup for both paths (Tailwind users import ./tailwind, never ./styles), cascade note (unlayered; `@import url(...) layer(wave)` to layer it yourself), browser baseline, WaveProvider required for ./styles. INTEGRATION: src/index.ts style comment.
- **repo-level#2** [important/packaging] The published bundle has no 'use client' directive, so importing anything from the package (even `cn`) in a React Server Component fails.
  - Owners: `F6b-pipeline`, `INTEGRATION`, `DOCS`, `P03-choice`, `P05-listbox`, `P08-list-tag`, `P09-disclosure`, `P10-carousel-overflow`, `P11-primitives`, `P13-menu-nav`, `P14-pagination-stepper`, `P15-modal`, `P16-popups`, `P17-table`
  - Task: F6b: rolldown output.banner adds '"use client";' to every emitted chunk whose facade module is under src/components or src/hooks, except index.ts barrels; scripts/verify-dist.mjs asserts the directive per file, its absence from dist/lib/cn.* and every dist/**/index.*, imports dist/lib/cn.mjs under `node --conditions=react-server`, and checks that the flat sub-component names exist in dist/index.mjs (the compounds on PENDING_FLAT_EXPORTS are exempt until their flat names land; `node scripts/verify-dist.mjs --final`, run by prepublishOnly and the final gate §7.2, fails while the list is not empty). Compound owners (C-COMPOUND): export every sub-component under a flat `<Parent><Member>` name from its module (CardHeader, DialogTrigger, MenuItem, TableRow, RadioGroupItem, …; existing flat names such as RadioItem are kept) alongside the dotted form, so Server Components can import them; JSDoc notes that dotted access needs a client file. P03 RadioGroup, P05 Combobox/Dropdown, P08 List, P09 Accordion/TabList/Tree, P10 Carousel/Overflow, P11 Card/Skeleton, P13 Menu/Nav/Breadcrumb, P14 Stepper, P15 Dialog/Drawer, P16 Popover, P17 Table/DataGrid; one test per module that each flat export === the dotted member. INTEGRATION: re-export the flat names from the barrels and empty PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs as they land. DOCS: README RSC section (flat names from Server Components, dotted names in client files).
- **repo-level#3** [important/build] The single-module Vite build defeats tree-shaking, so importing one component ships the whole library.
  - Owners: `F6b-pipeline`
  - Task: F6b: preserveModules + preserveModulesRoot 'src' with per-format entryFileNames ('[name].mjs' / '[name].cjs') in a rolldownOptions.output array (build.lib keeps only `entry`; `formats` is dropped because Vite ignores it when output is an array); sideEffects ['*.css']; compound Object.assign calls annotated /* @__PURE__ */ (P packages keep the annotation when they touch those lines); verify-dist's tree-shake probe uses Vite's own build API (a probe entry importing only Button from dist; assert Dialog code is absent) — no esbuild dependency.
- **repo-level#4** [suggestion/packaging] clsx and tailwind-merge are inlined into dist and also declared as runtime dependencies, so consumers install unused copies and can end up with duplicate tailwind-merge.
  - Owners: `F6b-pipeline`
  - Task: F6b: externals derived from Object.keys(pkg.dependencies ?? {}) + peerDependencies with subpath matching (react/jsx-runtime, react-dom/client, @floating-ui/react-dom).
- **repo-level#5** [important/packaging] package.json exports give CommonJS TypeScript consumers ESM-typed declarations for the `require` condition, which causes TS1479.
  - Owners: `F6a-tooling`, `F6b-pipeline`
  - Task: F6a: installs publint and @arethetypeswrong/cli and adds `check:package` (publint + attw --pack). F6b: emit dist/index.d.cts (copy of the rolled-up index.d.ts in the dts afterBuild) and nest types under the import/require conditions.
- **repo-level#6** [important/packaging] The './tokens' export has no @keyframes, so Spinner, Skeleton and indeterminate ProgressBar never animate for consumers who import only tokens.
  - Owners: `F1-tokens`, `P11-primitives`
  - Task: F1: @keyframes wave-spin, wave-pulse, wave-indeterminate, wave-indeterminate-rtl inside @theme with --animate-wave-spin/-spin-slow/-pulse/-indeterminate/-indeterminate-rtl so './tokens' and './tailwind' emit them. P11: Spinner/Skeleton/ProgressBar use animate-wave-* utilities (no arbitrary animate-[...]).
- **repo-level#7** [important/packaging] Importing the library styles changes the consumer's whole app: it overrides Tailwind's built-in radius and font scales, uses unprefixed shadcn-style variable names,…
  - Owners: `F1-tokens`, `F3-hooks-provider`, `DOCS`, `P03-choice`, `P11-primitives`, `P13-menu-nav`, `P15-modal`, `P16-popups`, `P17-table`, `P01-buttons`
  - Task: F1: runtime vars prefixed --wave-*; theme classes .wave-light/.wave-dark/.wave-high-contrast (legacy .dark/.high-contrast deprecated aliases setting only --wave-* vars); color-scheme only on the theme classes (never on :root); no radius/font-sans overrides; base rules scoped to .wave-root/.wave-portal; no global reduced-motion override; Preflight opt-in; ramp and grey tokens read the 0.4 names as fallbacks (`--wave-brand-80: var(--brand-80, #0f6cbd)`) so 0.4 ramp overrides keep working; opt-in legacy-tokens.css re-declares the 0.4 semantic names per theme and points the --wave-* semantics at them (read + write compatibility, deprecated). Formal partial wont-fix (§7.4): Tailwind utility names (bg-primary, border-border, …) are not namespaced because they are the documented 0.4 vocabulary. F3: WaveProvider applies wave-root + font-wave. C-RADIUS component renames: P03 Checkbox rounded-sm->rounded-xs; P11 Card rounded-lg->rounded-md; P13 Menu rounded-lg->rounded-md; P15 Dialog rounded-xl->rounded-lg; P16 Popover/TeachingPopover rounded-lg->rounded-md; P17 Table/DataGrid rounded-lg->rounded-md; P01 SplitButton rounded-l/r->rounded-s/e. DOCS: README 'Global effects' section listing every colliding utility name (§7.4) with the workarounds (Tailwind v4 `prefix(tw)` on the app's own Tailwind build plus Wave's precompiled ./styles; never import legacy-tokens.css in apps with shadcn-style variables) and the CHANGELOG migration step for 0.4 variable overrides.
- **repo-level#8** [suggestion/styling] tokens.css defines `--radius-DEFAULT`, a Tailwind v3 key that v4 ignores, so bare `rounded` uses Tailwind's 0.25rem instead of the intended 4px.
  - Owners: `F1-tokens`
  - Task: F1: remove --radius-DEFAULT (bare `rounded` stays Tailwind's 0.25rem = Wave 4px at default root size); tokens test asserts it is absent.
- **repo-level#11** [suggestion/styling] `.dark` and `.high-contrast` do not set `color-scheme`, so native selects, range tracks, checkboxes and scrollbars keep light UA chrome in dark surfaces.
  - Owners: `F1-tokens`, `P17-table`
  - Task: F1: color-scheme: light on .wave-light, dark on .wave-dark and .wave-high-contrast — never on :root, so a page without WaveProvider keeps its own color-scheme. P17: DataGrid native checkboxes/radios use accent-primary (no hex).
- **repo-level#12** [important/a11y] Under prefers-reduced-motion, the global animation reset turns the indeterminate ProgressBar into a static 40% bar that looks like real progress, and freezes Spinner…
  - Owners: `F1-tokens`, `P11-primitives`, `F6t-test-infra`
  - Task: F1: remove the global `*` reduced-motion override (C-MOTION); add --animate-wave-spin-slow. F6t: conventions rule — a class string containing `transition` (other than transition-none) or `animate-` (other than animate-none) must also contain a `motion-reduce:` variant, or the line carries `wave-allow-motion: <reason>`. P11: indeterminate ProgressBar under motion-reduce: full-width fill with animate-wave-pulse (clearly indeterminate, not 40%); Spinner motion-reduce:animate-wave-spin-slow; Skeleton motion-reduce:animate-none; tests assert motion-reduce classes.
- **repo-level#13** [suggestion/styling] In RTL, the indeterminate ProgressBar sweeps left to right, against the direction the determinate fill grows.
  - Owners: `F1-tokens`, `P11-primitives`
  - Task: F1: @keyframes wave-indeterminate-rtl (translateX(100%) -> translateX(-350%)). P11: ProgressBar indeterminate uses rtl:animate-wave-indeterminate-rtl; test class.
- **repo-level#15** [important/docs] README and guide token documentation is wrong and describes customization that does not work: `--color-*` overrides and `--brand-*` have no effect, and the listed…
  - Owners: `DOCS`, `F1-tokens`
  - Task: F1: light --wave-primary: var(--wave-brand-80), hover var(--wave-brand-70), pressed var(--wave-brand-40); dark --wave-primary: var(--wave-brand-110), hover var(--wave-brand-120), pressed var(--wave-brand-90), so overriding --wave-brand-* (or the 0.4 --brand-* names, read as fallbacks) re-themes. DOCS: README/guide token tables generated from tokens.css (script or hand-checked) listing --wave-* names with per-theme values; brand customization section correct; dark pairing guidance matches ratios; forced-colors text matches implementation; package name fixed.
- **repo-level#16** [important/docs] The guide's "Common UI Patterns" examples break when copied: Dialog.Footer is placed outside Dialog.Content, and the Skeleton, ProgressBar and Field/Input examples…
  - Owners: `DOCS`, `P15-modal`, `P02-field-text`
  - Task: DOCS: fix guide examples (Footer inside Content, Skeleton width/height, ProgressBar value 60, Field error, Input onValueChange or e.target.value). P15: DialogFooter dev warning when rendered outside Dialog.Content (context flag); test. P02: Input gains onValueChange(value: string) (C-NAMING) so the natural example works; test.
- **repo-level#18** [important/docs] The guide, hook JSDoc and CHANGELOG document APG keyboard navigation for Tree, DataGrid, Carousel and Toolbar that none of these components implement.
  - Owners: `DOCS`, `F3-hooks-provider`
  - Task: DOCS (runs after INTEGRATION, against the final API): guide/cheat sheet/CHANGELOG describe keyboard support as implemented in 0.5.0 (Tree, DataGrid, Carousel, Toolbar now implemented by P09/P17/P10/P01; verify each claim against the final tests). F3: useRovingTabIndex JSDoc lists actual consumers.
- **repo-level#20** [important/build] tsconfig.json excludes tests, test utilities, stories and .storybook from type-checking, hiding more than 80 type errors, including a consumer-facing Button `as="a"`…
  - Owners: `F6a-tooling`, `F6t-test-infra`
  - Task: F6a: three TypeScript programs — tsconfig.json (library: src without tests and test helpers, lib ES2022), tsconfig.dev.json (extends it but declares its own `exclude: ['node_modules','dist','storybook-static','coverage']` so tests are not excluded by inheritance; includes src incl. tests, stories, .storybook; types vitest/globals + vite/client; jest-dom and vitest-axe augmentations come from src/test-setup.ts and src/vitest-axe.d.ts), tsconfig.node.json (vite/vitest configs and scripts with @types/node; excludes src/env.d.ts); `typecheck` runs all three plus scripts/check-ts-coverage.mjs (asserts the dev program contains test, story and .storybook files); `build` runs `tsc -p tsconfig.json` only. Fix errors in F6a-owned files. F6t: stories/_helpers.ts typed (ArgTypes satisfies; orientation/appearance vocabulary). Every P package leaves its owned tests/stories type-clean (C-TESTS).
- **repo-level#21** [important/packaging] The repository, homepage and bugs URLs in package.json point to github.com/waveui/wave-ui-react instead of the actual mortenbrudvik/waveui repo.
  - Owners: `F6a-tooling`
  - Task: F6a: repository git+https://github.com/mortenbrudvik/waveui.git, homepage https://github.com/mortenbrudvik/waveui#readme, bugs https://github.com/mortenbrudvik/waveui/issues.
- **repo-level#22** [suggestion/build] .gitignore is missing the generated and tool directories (coverage/, storybook-static/, .playwright-mcp/, .claude/settings.local.json) that show up as untracked.
  - Owners: `F6a-tooling`
  - Task: F6a: .gitignore adds coverage/, storybook-static/, .playwright-mcp/, .claude/settings.local.json.
- **repo-level#23** [suggestion/test-gap] Storybook hard-codes `<WaveProvider theme="light">` with no theme or direction toolbar, and uses a dead SB7 backgrounds config, so dark, high-contrast and RTL…
  - Owners: `F6b-pipeline`, `F6t-test-infra`, `F3-hooks-provider`
  - Task: F6b: .storybook/preview.tsx globalTypes/initialGlobals theme (light/dark/high-contrast) and dir (ltr/rtl) toolbars read by the WaveProvider decorator; remove the SB7 backgrounds block. F6t: conventions test fails on raw colors in src/components and stories. F3: WaveProvider stories show nesting without inline background hacks. Dark/HC contrast regressions are guarded by tokens.test (every pair of §2.1.3, including foreground/muted/primary/ring against selected); jsdom axe cannot compute contrast, so a per-theme check in the Storybook a11y panel (theme toolbar) is a documented manual step of the final gate (§4.5); a real-browser pass is an open question.
- **repo-level#24** [important/test-gap] Storybook's a11y addon runs in warn-only 'todo' mode with no story test runner, so 21 axe violations across 10 story files ship unnoticed.
  - Owners: `F6b-pipeline`
  - Task: F6b: parameters.a11y.test = 'error' in preview; src/__tests__/stories.a11y.test.tsx uses a non-eager import.meta.glob with one describe per story file that awaits its import inside the test (a broken story file fails only its own block), composeStories with the preview annotations, and the shared F6t axe instance (region disabled) on document.body; structural rules only, default light theme (contrast is covered by tokens.test, §4.5); stories may opt out only with parameters.a11y.test='todo' plus a comment. All P packages keep their stories passing this gate.
- **repo-level#25** [suggestion/docs] The hard-coded test counts in CLAUDE.md and the README (928) are stale; the suite now has 1127 tests in 71 files.
  - Owners: `DOCS`
  - Task: DOCS: remove hard-coded test counts from CLAUDE.md and README ('Run all unit tests (Vitest)').
- **repo-level#26** [suggestion/docs] docs/testing-best-practices.md is stale and contradicts the implemented helpers in src/test-utils.ts: signatures, defaults, component lists and test counts.
  - Owners: `DOCS`, `F6t-test-infra`
  - Task: DOCS: testing-best-practices.md marked as pre-0.4 research at the top, signatures/lists updated to the F6t helpers (or replaced by pointers), counts removed. F6t: test-utils JSDoc is the source of truth (documents every helper/config field, including the axe configuration and the body-cleanup assertion).
- **repo-level#27** [suggestion/a11y] Canonical stories show form controls with no accessible name (Checkbox, Switch, Select, Dropdown, ProgressBar, selectable List), which consumers will copy.
  - Owners: `P02-field-text`, `P03-choice`, `P11-primitives`, `P08-list-tag`, `P05-listbox`
  - Task: C-STORIES: every default story has an accessible name. P02 Select stories (aria-label or Field), P03 Checkbox/Switch label, P11 ProgressBar label, P08 List selectable aria-label, P05 Dropdown aria-label/Field; unlabeled variants carry aria-label + comment. Verified by the F6b stories a11y gate.
- **repo-level#29** [important/bug] Popover's document mousedown outside-dismiss makes any external toggle impossible, so the Controlled story's 'External Toggle' can never close the popover.
  - Owners: `P16-popups`
  - Task: P16: outside press is click-confirmed (F4 §2.4: pointerdown snapshot of every outside layer, dismissal on the following click, layers opened by that click ignored) and Popover accepts `ignoreOutsideRefs?: RefObject<HTMLElement>[]`; the Controlled story's external toggle passes its ref; test: an external toggle closes an open popover in one click.
- **repo-level#30** [important/api-design] Dialog has no Dialog.Close and does not export its context, so the uncontrolled stories' footer Cancel/Confirm/OK buttons cannot close the dialog.
  - Owners: `P15-modal`, `INTEGRATION`
  - Task: P15: Dialog.Close (asChild; default renders children as-is, merges onClick -> setOpen(false)); uncontrolled stories use it for footer buttons; test. INTEGRATION: export DialogCloseProps.
- **repo-level#32** [suggestion/bug] The Image story's placeholder SVGs are double-encoded (`%23` becomes `%2523`), so all six Image stories render solid black boxes.
  - Owners: `P07-identity`
  - Task: P07: Image story placeholder uses literal '#' characters encoded once (encodeURIComponent of the full SVG) with token-free neutral fills documented as fixture data; stories render visible rects.
- **repo-level#33** [suggestion/docs] Storybook Controls do nothing on many stories: key props are hard-coded after `{...args}`, or render functions ignore args.
  - Owners: `P11-primitives`, `P13-menu-nav`, `P15-modal`, `P16-popups`, `P17-table`, `P09-disclosure`, `P14-pagination-stepper`
  - Task: C-STORIES: defaults in `args`, `{...args}` spread last, render functions take and forward args, unused argTypes removed. P11 Grid/Flex, P13 Nav/Menu/Breadcrumb, P15 Drawer/Dialog, P16 Popover, P17 Table/DataGrid, P09 Tree, P14 Stepper.
- **repo-level#34** [suggestion/docs] Callback stories use no-ops or alert() instead of actions, and the TeachingPopover LastStep story is frozen with no story able to dismiss it.
  - Owners: `P16-popups`, `P12-messages`, `P08-list-tag`
  - Task: C-STORIES: callbacks use fn() from 'storybook/test'; dismissible stories keep local state that hides the element. P16: TeachingPopover LastStep uses defaultActiveStep and a dismissible open state. P12: MessageBar/Toast onDismiss via fn() + state. P08: Tag uses fn() not alert().
- **repo-level#35** [suggestion/docs] The Storybook sidebar mixes two title conventions ('Components/Input' vs 'Input', 'Layout' vs 'Components/Layout', and so on).
  - Owners: `P01-buttons`, `P02-field-text`, `P04-spin-color`, `P05-listbox`, `P07-identity`, `P08-list-tag`, `P09-disclosure`, `P10-carousel-overflow`, `P11-primitives`, `P12-messages`, `P13-menu-nav`
  - Task: C-STORIES titles = 'Components/<Category>/<Name>' with Category in {Button, Typography, Input, Data Display, Layout, Feedback, Navigation, Overlays, Table, Provider}. Fix: P01 Text ('Components/Typography/Text'); P02 Label; P04 ColorPicker, SwatchPicker; P05 Combobox, Dropdown; P07 Avatar, AvatarGroup, Badge, CounterBadge, Image, Persona, PresenceBadge; P08 Divider, InfoLabel, List, Tag; P09 Accordion, TabList, Tree; P10 Carousel; P11 Card, Flex, Grid, Stack; P12 Toast; P13 Nav.
- **repo-level#36** [suggestion/docs] Storybook generates no autodocs pages, so prop JSDoc and argTypes never become documentation.
  - Owners: `F6a-tooling`, `F6b-pipeline`
  - Task: F6a: installs @storybook/addon-docs (dev). F6b: tags: ['autodocs'] in preview.tsx and @storybook/addon-docs in main.ts addons; component-level JSDoc is added by each P package as it touches components (C-DOCS).
- **repo-level#37** [suggestion/docs] Stories are missing key states (disabled and invalid variants, Tooltip light) and include duplicates (Tooltip DarkVariant, Drawer RightPosition).
  - Owners: `P16-popups`, `P15-modal`, `P02-field-text`, `P04-spin-color`, `P01-buttons`, `P05-listbox`, `P06-datetime`
  - Task: C-STORIES missing states: P02 Slider/SearchBox Disabled, Field with Select/Textarea/Slider; P04 SpinButton Disabled + Invalid; P01 ToggleButton/CompoundButton/MenuButton Disabled; P05 Combobox/Dropdown/TagPicker Invalid (Field error); P06 DatePicker/TimePicker Invalid; P16 Tooltip: replace DarkVariant with Normal (light) story; P15 Drawer RightPosition -> Start position story.
- **repo-level#38** [suggestion/convention] Stories use raw hex colors and hand-styled buttons instead of tokens and library components, breaking the CLAUDE.md no-raw-hex rule and becoming illegible in dark mode.
  - Owners: `P11-primitives`, `P08-list-tag`, `P10-carousel-overflow`, `P14-pagination-stepper`, `F3-hooks-provider`, `F6t-test-infra`
  - Task: C-STORIES tokens. F6t: the conventions test also scans stories/*.stories.tsx for raw colors (hex, palette, white/black utilities) with `wave-allow-color: fixture` for fixture data (ColorPicker/SwatchPicker swatches, Image placeholders). P11 Card FullComposition uses <Button>, Flex/Grid/Stack demo boxes use bg-muted/border-border; P08 List delete buttons <Button appearance='subtle'> with text-error; P10 Carousel slides/Overflow buttons token classes; P14 Stepper story (line 107 `bg-primary text-white`) uses text-primary-foreground; F3 WaveProvider stories token classes.
- **repo-level#39** [suggestion/docs] DatePicker does not clamp its initial view month to minDate/maxDate, so the 2025-only WithMinMax story opens on a month where every day is disabled.
  - Owners: `P06-datetime`
  - Task: P06: initial viewMonth clamped into [minDate, maxDate]; story range computed relative to today; test with a range excluding today opens inside the range.

---

## Appendix B — Per-owner issue index

| Owner | # | Cids |
|---|---|---|
| `F1-tokens` | 16 | button-provider#2, button-provider#3, button-provider#6, button-provider#10, input-basic#7, input-basic#8, data-display#15, layout#25, repo-level#1, repo-level#6, repo-level#7, repo-level#8, repo-level#11, repo-level#12, repo-level#13, repo-level#15 |
| `F2-lib` | 25 | button-provider#8, button-provider#20, button-provider#21, table-core#1, table-core#18, table-core#27, table-core#33, input-basic#9, input-basic#22, input-basic#29, input-datetime#17, input-datetime#22, data-display#1, data-display#3, data-display#30, layout#10, layout#16, layout#27, feedback-navigation#1, feedback-navigation#24, feedback-navigation#51, overlays#3, overlays#5, overlays#21, overlays#35 |
| `F3-hooks-provider` | 39 | button-provider#2, button-provider#4, button-provider#6, button-provider#12, button-provider#15, button-provider#27, button-provider#28, table-core#3, table-core#4, table-core#5, table-core#7, table-core#19, table-core#23, table-core#28, table-core#29, table-core#30, table-core#31, table-core#34, input-basic#14, input-pickers#14, input-pickers#17, input-datetime#21, data-display#7, data-display#23, layout#13, layout#20, layout#21, layout#31, feedback-navigation#12, feedback-navigation#23, feedback-navigation#47, feedback-navigation#51, overlays#5, overlays#28, overlays#35, repo-level#7, repo-level#18, repo-level#23, repo-level#38 |
| `F4-overlay` | 20 | input-pickers#12, input-datetime#2, input-datetime#6, data-display#13, feedback-navigation#12, feedback-navigation#50, feedback-navigation#51, overlays#1, overlays#2, overlays#3, overlays#9, overlays#10, overlays#11, overlays#13, overlays#19, overlays#27, overlays#30, overlays#36, overlays#37, overlays#41 |
| `F5-listbox-field` | 12 | input-basic#1, input-basic#12, input-pickers#1, input-pickers#2, input-pickers#3, input-pickers#6, input-pickers#11, input-pickers#18, input-pickers#20, input-pickers#26, input-pickers#27, input-pickers#28 |
| `F6a-tooling` | 7 | button-provider#8, repo-level#1, repo-level#5, repo-level#20, repo-level#21, repo-level#22, repo-level#36 |
| `F6t-test-infra` | 17 | button-provider#1, button-provider#3, button-provider#24, button-provider#28, table-core#20, table-core#26, input-basic#1, input-basic#31, input-pickers#1, layout#9, layout#10, feedback-navigation#34, repo-level#12, repo-level#20, repo-level#23, repo-level#26, repo-level#38 |
| `F6b-pipeline` | 8 | repo-level#1, repo-level#2, repo-level#3, repo-level#4, repo-level#5, repo-level#23, repo-level#24, repo-level#36 |
| `P01-buttons` | 32 | button-provider#1, button-provider#2, button-provider#3, button-provider#8, button-provider#9, button-provider#10, button-provider#11, button-provider#12, button-provider#13, button-provider#14, button-provider#15, button-provider#16, button-provider#17, button-provider#18, button-provider#19, button-provider#20, button-provider#21, button-provider#22, button-provider#23, button-provider#24, button-provider#25, button-provider#26, button-provider#27, table-core#1, table-core#3, data-display#31, layout#16, feedback-navigation#51, overlays#5, repo-level#7, repo-level#35, repo-level#37 |
| `P02-field-text` | 22 | button-provider#3, button-provider#27, table-core#18, input-basic#1, input-basic#7, input-basic#15, input-basic#16, input-basic#17, input-basic#19, input-basic#20, input-basic#24, input-basic#29, input-basic#39, input-basic#40, input-datetime#22, layout#16, feedback-navigation#1, feedback-navigation#34, repo-level#16, repo-level#27, repo-level#35, repo-level#37 |
| `P03-choice` | 30 | button-provider#3, button-provider#27, table-core#5, table-core#7, table-core#25, input-basic#1, input-basic#7, input-basic#8, input-basic#9, input-basic#11, input-basic#12, input-basic#13, input-basic#14, input-basic#18, input-basic#20, input-basic#22, input-basic#23, input-basic#29, input-basic#36, input-basic#37, input-basic#38, input-basic#40, input-pickers#17, layout#10, layout#16, feedback-navigation#34, overlays#35, repo-level#2, repo-level#7, repo-level#27 |
| `P04-spin-color` | 22 | button-provider#3, button-provider#27, table-core#3, input-basic#1, input-basic#2, input-basic#3, input-basic#4, input-basic#5, input-basic#12, input-basic#29, input-basic#30, input-basic#41, input-basic#42, input-pickers#15, input-pickers#16, input-pickers#17, input-pickers#23, input-pickers#24, input-pickers#25, layout#16, repo-level#35, repo-level#37 |
| `P05-listbox` | 38 | button-provider#3, button-provider#27, table-core#3, table-core#4, input-basic#1, input-basic#9, input-basic#12, input-basic#29, input-basic#30, input-basic#43, input-pickers#1, input-pickers#2, input-pickers#3, input-pickers#6, input-pickers#7, input-pickers#8, input-pickers#11, input-pickers#12, input-pickers#13, input-pickers#14, input-pickers#18, input-pickers#20, input-pickers#21, input-pickers#22, input-pickers#26, input-pickers#27, input-pickers#28, input-datetime#2, input-datetime#22, data-display#30, feedback-navigation#34, overlays#1, overlays#36, overlays#37, repo-level#2, repo-level#27, repo-level#35, repo-level#37 |
| `P06-datetime` | 46 | button-provider#3, button-provider#27, input-basic#1, input-basic#9, input-basic#12, input-basic#29, input-basic#31, input-basic#32, input-basic#33, input-basic#34, input-basic#35, input-pickers#2, input-pickers#3, input-pickers#18, input-pickers#27, input-datetime#1, input-datetime#2, input-datetime#4, input-datetime#5, input-datetime#6, input-datetime#7, input-datetime#8, input-datetime#10, input-datetime#11, input-datetime#12, input-datetime#13, input-datetime#14, input-datetime#15, input-datetime#17, input-datetime#18, input-datetime#19, input-datetime#20, input-datetime#21, input-datetime#22, input-datetime#23, input-datetime#24, input-datetime#25, input-datetime#28, input-datetime#29, feedback-navigation#34, overlays#1, overlays#25, overlays#36, overlays#37, repo-level#37, repo-level#39 |
| `P07-identity` | 20 | button-provider#3, button-provider#27, input-basic#8, data-display#3, data-display#4, data-display#15, data-display#16, data-display#17, data-display#19, data-display#21, data-display#22, data-display#26, data-display#27, data-display#28, data-display#29, data-display#31, layout#16, feedback-navigation#34, repo-level#32, repo-level#35 |
| `P08-list-tag` | 30 | button-provider#3, button-provider#8, button-provider#27, table-core#3, table-core#4, table-core#22, table-core#25, input-datetime#22, data-display#1, data-display#2, data-display#7, data-display#8, data-display#10, data-display#11, data-display#12, data-display#13, data-display#23, data-display#24, data-display#30, layout#10, layout#16, layout#19, feedback-navigation#1, feedback-navigation#34, feedback-navigation#47, repo-level#2, repo-level#27, repo-level#34, repo-level#35, repo-level#38 |
| `P09-disclosure` | 30 | button-provider#3, button-provider#27, table-core#3, table-core#5, table-core#7, table-core#25, data-display#30, data-display#31, layout#10, layout#11, layout#12, layout#13, layout#14, layout#16, layout#17, layout#18, layout#19, layout#30, layout#31, layout#32, layout#34, feedback-navigation#34, feedback-navigation#46, feedback-navigation#47, overlays#25, overlays#34, overlays#35, repo-level#2, repo-level#33, repo-level#35 |
| `P10-carousel-overflow` | 27 | button-provider#3, button-provider#27, table-core#25, input-basic#29, layout#1, layout#2, layout#3, layout#4, layout#6, layout#7, layout#8, layout#9, layout#20, layout#21, layout#22, layout#23, layout#24, layout#25, layout#26, layout#27, layout#29, layout#34, overlays#34, overlays#35, repo-level#2, repo-level#35, repo-level#38 |
| `P11-primitives` | 26 | button-provider#3, button-provider#8, button-provider#27, input-basic#9, layout#10, layout#16, layout#34, layout#35, layout#36, layout#39, layout#40, feedback-navigation#6, feedback-navigation#16, feedback-navigation#17, feedback-navigation#19, feedback-navigation#20, feedback-navigation#21, repo-level#2, repo-level#6, repo-level#7, repo-level#12, repo-level#13, repo-level#27, repo-level#33, repo-level#35, repo-level#38 |
| `P12-messages` | 21 | button-provider#1, button-provider#3, button-provider#27, table-core#25, input-datetime#22, data-display#31, layout#34, feedback-navigation#1, feedback-navigation#4, feedback-navigation#7, feedback-navigation#8, feedback-navigation#11, feedback-navigation#12, feedback-navigation#13, feedback-navigation#14, feedback-navigation#15, feedback-navigation#34, feedback-navigation#50, overlays#40, repo-level#34, repo-level#35 |
| `P13-menu-nav` | 25 | button-provider#3, button-provider#21, button-provider#27, table-core#25, data-display#31, layout#10, feedback-navigation#23, feedback-navigation#24, feedback-navigation#25, feedback-navigation#31, feedback-navigation#32, feedback-navigation#33, feedback-navigation#34, feedback-navigation#35, feedback-navigation#40, feedback-navigation#41, feedback-navigation#45, feedback-navigation#46, feedback-navigation#47, feedback-navigation#51, overlays#34, repo-level#2, repo-level#7, repo-level#33, repo-level#35 |
| `P14-pagination-stepper` | 27 | button-provider#3, button-provider#27, table-core#3, input-basic#8, data-display#31, layout#16, feedback-navigation#24, feedback-navigation#25, feedback-navigation#26, feedback-navigation#29, feedback-navigation#30, feedback-navigation#34, feedback-navigation#36, feedback-navigation#37, feedback-navigation#38, feedback-navigation#39, feedback-navigation#41, feedback-navigation#42, feedback-navigation#43, feedback-navigation#44, feedback-navigation#46, feedback-navigation#48, feedback-navigation#49, overlays#34, repo-level#2, repo-level#33, repo-level#38 |
| `P15-modal` | 34 | button-provider#1, button-provider#2, button-provider#3, button-provider#27, table-core#3, table-core#20, table-core#23, table-core#25, input-datetime#22, layout#10, feedback-navigation#50, overlays#1, overlays#2, overlays#3, overlays#5, overlays#7, overlays#8, overlays#9, overlays#10, overlays#11, overlays#31, overlays#32, overlays#33, overlays#34, overlays#35, overlays#36, overlays#40, overlays#41, repo-level#2, repo-level#7, repo-level#16, repo-level#30, repo-level#33, repo-level#37 |
| `P16-popups` | 42 | button-provider#3, button-provider#27, table-core#20, table-core#23, table-core#25, input-datetime#22, layout#10, layout#16, feedback-navigation#34, feedback-navigation#46, feedback-navigation#51, overlays#1, overlays#5, overlays#12, overlays#13, overlays#14, overlays#17, overlays#18, overlays#19, overlays#20, overlays#21, overlays#22, overlays#25, overlays#26, overlays#27, overlays#28, overlays#29, overlays#30, overlays#31, overlays#32, overlays#34, overlays#35, overlays#36, overlays#37, overlays#38, overlays#41, repo-level#2, repo-level#7, repo-level#29, repo-level#33, repo-level#34, repo-level#37 |
| `P17-table` | 26 | button-provider#3, button-provider#27, table-core#2, table-core#3, table-core#4, table-core#10, table-core#11, table-core#12, table-core#13, table-core#14, table-core#15, table-core#19, table-core#21, table-core#22, table-core#23, table-core#24, table-core#25, table-core#32, data-display#30, layout#10, layout#19, overlays#34, repo-level#2, repo-level#7, repo-level#11, repo-level#33 |
| `DOCS` | 23 | button-provider#2, table-core#1, table-core#3, table-core#11, table-core#18, table-core#34, table-core#35, input-basic#9, input-basic#12, input-basic#24, input-basic#29, input-pickers#3, input-pickers#8, feedback-navigation#8, feedback-navigation#51, repo-level#1, repo-level#2, repo-level#7, repo-level#15, repo-level#16, repo-level#18, repo-level#25, repo-level#26 |
| `INTEGRATION` | 20 | button-provider#27, table-core#3, table-core#11, table-core#32, table-core#33, table-core#35, input-basic#1, input-basic#13, layout#4, layout#17, feedback-navigation#7, feedback-navigation#50, feedback-navigation#51, overlays#1, overlays#33, overlays#36, overlays#41, repo-level#1, repo-level#2, repo-level#30 |

Totals: 305 issues (20 critical, 160 important, 125 suggestion); every issue has at least one owner; no issue is fully wont-fix; one formal partial wont-fix (`repo-level#7` utility-name namespacing, §7.4).
