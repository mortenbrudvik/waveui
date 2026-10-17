# WaveUI 0.11.0 — Fluent Parity Phase 6 Design (tags, drawers and the app shell)

> Date: 2026-10-17 · Branch: `claude/wonderful-bardeen-570l5v` in the main checkout (no worktree), from `main` 05c4509, where 0.10.0 = Phases 1–5 is released in the CHANGELOG (`## [0.10.0] - 2026-10-17`; the `v0.10.0` tag is not yet pushed) · Package: `@mortenbrudvik/waveui` → **0.11.0**. Phase 6 is not built in parallel with another phase.
> Scope: Phase 6 of [`docs/ROADMAP.md`](../../ROADMAP.md): the items P6-01 … P6-09. They close 18 medium and 22 low gaps of the Fluent UI v9 comparison (§7).
> Inputs: the roadmap's Phase 6 section, its goals and naming (§1), principles (§2) and process (§3); the Phase 5 spec [`2026-09-26-fluent-parity-phase-5-design.md`](2026-09-26-fluent-parity-phase-5-design.md), the model for this document, and the Phase 1–4 specs for the rules and rulings cited by number; the research of 2026-10-17 (nine notes and a completeness critic) against Fluent at its source (`microsoft/fluentui` master f02cfa8: `react-tags`, `react-tag-picker`, `react-drawer`, `react-dialog`, `react-nav`, plus `react-combobox`, `react-aria`, `react-tabster`, `react-toast`); GitHub issues [#4](https://github.com/mortenbrudvik/waveui/issues/4) (Dialog sizes and header actions) and [#6](https://github.com/mortenbrudvik/waveui/issues/6) (a create option for free tagging); the axe-core 4.13 checks the research re-ran in jsdom with the repository's axe (an `option` holding a Dismiss button fails `nested-interactive`; `<li role="separator">` fails `list` and `<li aria-hidden="true">` passes; `role="navigation"` with `aria-modal` fails `aria-allowed-attr`, a named `dialog > nav` passes; `toolbar[aria-required]` fails `aria-allowed-attr`); the WAI-ARIA APG toolbar, listbox, combobox, dialog (modal) and disclosure navigation patterns; WCAG 2.2 (1.4.1, 1.4.11, 2.4.7, 2.4.11, 2.5.3, 2.5.8). Every API below was checked against the 0.10.0 source it changes: `src/lib/types.ts`, `layers.ts`, `classNames.ts`, `icons.tsx`, `polymorphic.ts`, `src/hooks/useDismiss.ts`, `useRovingTabIndex.ts`, `useModalLayer.ts`, `useRestoreFocus.ts`, `useFocusTrap.ts`, `usePresence.ts`, `usePreserveFocus.ts`, `Tag.tsx`, `Avatar.tsx`, `Toolbar.tsx`, `TagPicker.tsx`, `Option.tsx`, `Combobox.expand.tsx`, `pickerStyles.ts`, `SwatchPicker.tsx`, `SwatchPicker.context.ts`, `Accordion.tsx`, `Drawer.tsx`, `Dialog.tsx`, `Dialog.shared.tsx`, `Toaster.tsx`, `Nav.tsx`, `src/styles/tokens.css`, `scripts/verify-dist.mjs`, and the tests that pin them (`types.test.ts`, `layers.test.ts`, `tokens.test.ts`, `icons.test.tsx`, `classNames.test.ts`, `public-types.test.ts`, `integration.test.tsx`, `test-utils.test.tsx`, `verify-dist.test.mjs`, `.storybook/__tests__/exportDocblocks.test.ts`, and the component suites §6.4 names).
> Maintainer rulings: none yet (§8). The Phase 2 lead rulings carry over: Fluent names by default when they fit WaveUI's conventions, else C-NAMING (state callbacks value first, extra data in an optional `details` argument); APG behaviour first.
> Status: Draft for the maintainer's review (2026-10-17). The open questions of §8 are answered by the maintainer before wave A starts (roadmap §3, entry criteria). Implementation contract for parallel agents. Where an item section (§2) and a cross-package contract (§4) disagree, §4 wins; where an item section and §1 disagree about a foundation piece, §1 wins. Seams that do not line up are resolved by INTEGRATION (§3).

---

## 0. How to use this document

### 0.1 Packages and owners

| Key | Scope | Items | Runs in |
|---|---|---|---|
| `F6-foundation` | the shared unions of `src/lib/types.ts` (`ModalType` with `'non-modal'`, `HeadingLevel`, `FocusMode`, `TagSize`, `TagAppearance`, `TagShape`, `SurfaceSize`, `BackdropAppearance`); the `'dialog'` layer kind, Escape `'inside'`, `hasIsolatingModalBelow` and the isolation notification (`layers.ts`, `useDismiss.ts`); every Phase 6 class-name constant and key, the `VARIANT_BASES` entries; the four pending lists and the flat-name bridge; the four tag state tokens and their pairs; the navigation glyph; Toolbar's roving extraction (`Toolbar.navigation.ts`); the `useRovingTabIndex` hand-back fix; the internal Avatar size context; `ListboxSurface listProps`; `PickerExpandButton dimDisabled`; the retypes of SwatchPicker's `focusMode` and `AccordionHeadingLevel` | the shared parts of P6-01 … P6-09 | wave A (exclusive) |
| `P6-tags` | Tag's appearances, sizes, shapes, `disabled`, `selected`, `value` and slots with `tagStyles.ts`; TagGroup (toolbar and list roles, the arrow-key rule, inheritance, Delete and Backspace, `onDismiss`, focus after a removal, selection and forms) with `TagGroup.context.ts`; InteractionTag; the tag seams TagPicker reads (§4.1), in the order P6-01 → P6-02 (dismissal, roving, focus, the seams) → P6-03 → P6-02 (selection, forms) | P6-01, P6-02, P6-03 | wave B |
| `P6-overlays` | Drawer `size`, `bottom`, the header, body and footer parts, scroll-state separators and the Toaster's block offset (the Drawer module split first); `modalType="non-modal"` on Dialog and Drawer, the backdrop and Close-button slots, dim once, Dialog's `large` and `full` sizes and title actions, the trigger toggle; the inline drawer, `unmountOnClose`, presence for every Dialog and Drawer; the drawer panel shell (§4.2), in the order P6-05 → P6-06 → P6-07 → the shell's freeze | P6-05, P6-06, P6-07 | wave B |
| `P6-nav` | the behaviour-neutral Nav split and its seam (§4.3) first; then `Nav.SectionHeader`, `Nav.Divider`, `Nav.AppItem`, `Nav.AppItemStatic`, item `actions` and the list-child check | P6-09 | wave B |
| `P6-tagpicker` | the composable TagPicker (seven parts and flat names), Tag-based tags in a TagGroup list, free tagging with a create option, the default chevron, `clearable`, `overflow="count"`, rich options; on the frozen tag seams | P6-04 | wave C |
| `P6-navdrawer` | NavDrawer (Header, Body with `focusMode`, Footer) on the frozen panel shell and Nav seam; Hamburger; the phase's "App shell" story and its test | P6-08 | wave C |
| `INTEGRATION` | barrels and flat names, story imports, the cross-package tests (Field, Dialog, Toaster, Menu, Tooltip, Server Components), public types, the `verify-dist` probes and fixtures, the four pending lists emptied | — | wave D |
| `DOCS` | `## [0.11.0] - Unreleased` in the CHANGELOG, README, CLAUDE.md, guide, testing guide, ROADMAP, `docs/FLUENT-UI-COMPARISON.md`, the gap report's missing ids | — | wave E |
| lead | commits after every task; the final gate and the real-browser checklist | — | wave F |

§3 lists the exact files of each package. File ownership is disjoint within each wave and between the wave-B and wave-C packages that may run at the same time (D2).

### 0.2 Ground rules for every agent

The Phase 1 ground rules (§0.2 of the Phase 1 spec, rules 1–10: own files only, barrels are INTEGRATION's, TDD, backward compatible, conventions and stories gates, no git write commands, foundation not forked, verification before reporting, wave-B tests use only the foundation and their own files, local argTypes) apply unchanged, with F6 in place of F1, and rule 9 is widened for wave C by rule 31. So do the Phase 2 rules 15 (no built-in motion), 16 (pointer tests) and 17 (direction); the Phase 3 rules 22 (a module split keeps one-way imports, and the compound module re-exports every type the untouched barrel imports from it: `Drawer.tsx`, `Nav.tsx` and `TagPicker.tsx` here) and 23 (screen readers are part of the exit evidence: each package names in its report the behaviours it could assert only as attributes); the Phase 4 rules 14 (a default render is pinned by a class assertion, so no default look changes by accident: Tag, TagGroup, Drawer, Dialog, Nav and TagPicker keep one such test each) and 15 (forced colours, `:has()`, hit areas and real pointers are browser-checklist items: assert classes and attributes); and the Phase 5 rule 23, generalised: an existing component's suite is the regression suite of its rewrite (`Tag.test.tsx`, `Toolbar.test.tsx`, `Drawer.test.tsx`, `Dialog.test.tsx`, `Toast.test.tsx`, `Nav.test.tsx`, `TagPicker.test.tsx`), and it changes only where §6.4 lists; any other change is reported to the lead with the reason, not made. In addition:

27. **Wave A is exclusive.** `F6-foundation` lands and is committed by the lead before wave B starts. Because it runs alone, it edits the files outside its area that its additions and retypes reach, and only for them (§3.1): `src/components/button/Toolbar.tsx` (the extraction), `src/components/data-display/Avatar.tsx` (the context), `src/components/input/Option.tsx` and `src/components/input/index.ts` (`listProps` and its type's export), `src/components/input/Combobox.expand.tsx`, `SwatchPicker.tsx` and `SwatchPicker.context.ts` (the `FocusMode` retype), `src/components/layout/Accordion.tsx` (the alias), `src/components/overlays/__tests__/Dialog.test.tsx` (the `@ts-expect-error` that the widened `ModalType` makes unused, `:2145-2147`), the pending lists and their test lines (§1.5), and `public-types.test.ts`'s `ModalType` lines. Every other barrel, public-types and `verify-dist` change is INTEGRATION's.
28. **Seams freeze per wave.** The foundation's pieces (§4.4) are read only from wave B on. The tag seams (§4.1) freeze when `P6-tags` finishes its step 2, the Nav seam (§4.3) when `P6-nav` finishes its first task, the drawer panel shell, the scroll store and the overlay types (§4.2) when `P6-overlays` finishes its last task; the lead commits each freeze as its own task. A frozen member keeps its name, type and meaning; its owner may add members only through a change request the lead approves. A reader that needs a change files a change request with a failing test (rule 7) and works on. `.storybook/__tests__/exportDocblocks.test.ts:344` pins `NavItem` and `NavSubItem` in `Nav.tsx`: keep them there.
29. **Compound members and the pending lists.** A package that owns a compound module attaches its new parts there and exports their flat names from it with a JSDoc each (`Drawer.tsx`: `DrawerHeader`, …; `Nav.tsx`: `NavSectionHeader`, …; `TagPicker.tsx`: `TagPickerControl`, …; the new `InteractionTag.tsx` and `NavDrawer.tsx` likewise); INTEGRATION adds them to the barrels in wave D. Until then the four lists of §1.5 keep every gate green: `F6-foundation` fills them in wave A; the only wave-B edits are the two pre-placed commented entries of `PENDING_FLAT_EXPORTS` (`'Drawer'` uncommented by `P6-overlays` and `'Nav'` by `P6-nav`, each in the commit that attaches its compound's first new member, and nothing else of `scripts/verify-dist.mjs`); nobody edits `PENDING_CLASS_NAMES`, `PENDING_FLAT_MEMBERS` or `PENDING_PUBLIC_TYPES` in waves B and C (an entry whose part lands before wave D is tolerated, D10); INTEGRATION empties all four. Nothing else may go red between waves (Phase 3 rule 24).
30. **Stories import module paths until INTEGRATION** (Phase 5 rule 25): a story that uses a component or flat name the barrels do not export yet imports it from its module (`import { TagGroup } from '../src/components/data-display/TagGroup'`); members reached through an exported compound (`Drawer.Header`, `Nav.Divider`) come from `'../src'`. INTEGRATION normalises every import to `'../src'` in wave D. A compound's story meta carries no docblock (`exportDocblocks.test.ts` "no compound's story replaces its description"; TagPicker, InteractionTag and NavDrawer become compounds).
31. **Wave C builds on wave B's committed API.** A wave-C package's tests and stories may render the real components and seams that wave B committed (Tag, TagGroup, InteractionTag and the tag seams for `P6-tagpicker`; the panel shell, the scroll store, the inline Drawer, Nav and its parts for `P6-navdrawer`), never the other wave-C package's new API; a case that needs both wave-C packages is INTEGRATION's (§4.6). `NavDrawer.appShell.test.tsx`, which composes the App shell story (an inline Drawer from wave B), stays with `P6-navdrawer`.
32. **Tailwind words** (Phase 5 rule 24). JSDoc, comments, warning texts and non-class strings under `src/components` and `src/lib` never write a Tailwind utility as a bare word that no class string of the library uses: Tailwind scans every word and `node scripts/build-css.mjs` fails on the class it generates. The words already excluded in `src/styles/styles.css:32` (`end`, `inline`, `list-item`, `outline`, `ring`, `shadow`, `start`, `static`, `table`, `visible`, …) are safe; others (`italic`, `truncate`, `uppercase`, `grow`, `isolate`) are rephrased ("the grid layout", "the element that holds the tags"), or, for a real need, added to that list by the lead. The registry JSDoc of §1.3 is written to this rule; a package that adds prose runs `node scripts/build-css.mjs` before reporting. A hook in `src/hooks` may show class examples (`usePresence`).
33. **C-DOCS checklist for this phase.** Every new prop states its `@default` (inherited ones say so: a Tag's `size` "the TagGroup's, else `'medium'`"; NavDrawer's defaults that differ from Drawer's name both); JSDoc that a Phase 6 change makes untrue is updated (Tag's "TagGroup (planned)", `ModalType`'s "joins in a later release", `DialogContentProps.modalType`'s "(`'non-modal'` is planned)", `drawerClassNames.root`'s "while open", `dialogContentClassNames.backdrop`'s "around it", TagPicker's "Phase 3 judgement 7" remarks, the `TagPicker.Option` and `TagPickerOption` cross-references); a compound's component JSDoc sits on its `Object.assign` export only, and a root defined in a sibling module (`DrawerRoot`, `NavRoot`, `TagPickerRoot`) carries none; a prop whose Fluent name differs names it (`value`/`onValueChange` for `selectedValues`/`onTagSelect`, `focusMode` for `tabbable`, `headingLevel` for `as`/`heading`, `actions` for SplitNavItem's slots, `closeButton`, `titleAction` for the `title` form, `allowCreate`/`onOptionCreate`, `overflow="count"`); a ruling that differs from Fluent on purpose says so in one sentence of the JSDoc ("Fluent's … is …"); every flat name has a JSDoc (verify-dist's undocumented-component check). Warning keys and message prefixes of compound parts are dotted (`Drawer.Header:unscanned`, `TagPicker.List:placement`, `InteractionTag.Secondary:button-child`).
34. **Toolchain.** Node 24 is at `/opt/node24/bin` on this machine: every agent runs `export PATH=/opt/node24/bin:$PATH` before `npm`, `npx` or `node` (v24.15.0 and npm 11.12.1 meet `devEngines`: Node `^22.22.2 || ^24.15.0 || >=26.0.0`, npm `>=11.11.0`; the system Node is not used). No `npm install` (rule 6); `node_modules` is present. A focused run is `npx vitest run <files> --reporter=default` (CLAUDE.md "Commands").
35. **Two agents at a time, one working tree.** The lead runs at most two package agents at once (D2), in the main checkout; neither edits a file the other owns (§3.1), neither runs a repo-wide fixer (rule 6), and a test of the other package that fails while it works is reported, not fixed. Each report lists: the barrel requests (§4.5); the 0.10 tests updated, with the reason (§6.4); the pending entries it applied; the screen-reader behaviours it asserted only as attributes (Phase 3 rule 23); failures seen in another package's tests; change requests.

### 0.3 Cross-cutting design rulings

Binding for every package. Each ruling records why. Phase 5 numbered every ruling of its spec here; Phase 6 has about 130, so this section holds D1–D19 and each item section of §2 holds its own reserved range (D19 has the index). Phase 1–5 rulings are cited as "Phase 1 D21", "Phase 2 D4".

- **D1 — One phase, one branch, one release.** Phase 6 is built alone on `claude/wonderful-bardeen-570l5v` in the main checkout (no worktree), from `main` 05c4509; the release is 0.11.0, with a new `## [0.11.0] - Unreleased` CHANGELOG section above `## [0.10.0] - 2026-10-17`, dated only by the release commit. There is no merge wave (Phase 5's wave F), and P4-05 (`theme="system"`) stays out (§0.4). *Why:* the roadmap's entry criteria hold (0.10.0 is on `main` with a green gate); Phase 7's entry is "0.11.0 merged"; no phase runs next to this one.
- **D2 — Six packages in two build waves, two agents at a time.** As §0.1: `F6-foundation` alone (wave A); `P6-tags`, `P6-overlays`, `P6-nav` (wave B); `P6-tagpicker`, `P6-navdrawer` (wave C); INTEGRATION (D); DOCS (E); the lead (F). The machine runs two agents at once on one working tree, so wave C is a dependency stage, not a moment: a wave-C package starts as soon as the wave-B packages it reads are committed and an agent slot is free (`P6-tagpicker` after `P6-tags`; `P6-navdrawer` after `P6-overlays` and `P6-nav`), and may then run next to a wave-B package. The schedule: slot 1 runs `P6-tags` → `P6-nav` → `P6-navdrawer`, slot 2 runs `P6-overlays` → `P6-tagpicker` (five roadmap items of size M each, counting P6-04's L as two and the Nav split and the panel shell as part of their items). INTEGRATION starts when every wave-B and wave-C package is committed. *Why:* the roadmap orders P6-02 after P6-01, P6-03 after P6-02, P6-04 after P6-01 and P6-02, P6-07 after P6-05 and P6-08 after P6-07; the files several items change (`Tag.tsx`, `Drawer.tsx`, `Dialog.tsx`, `Dialog.shared.tsx`, `Toaster.tsx`, `Nav.tsx`) each get one owner (lead memo B; critic C4, C13); two balanced slots shorten the phase without two agents in one file; the cross-cutting research's seven packages (a separate InteractionTag package, Drawer and Dialog in parallel) would split files that one owner must change in sequence.
- **D3 — One sequential overlays package that ends with the panel shell.** `P6-overlays` runs P6-05 → P6-06 → P6-07 → the shell's freeze (D108) and owns every Dialog and Drawer module, `Dialog.shared.tsx`, `useModalLayer.ts`, `useRestoreFocus.ts`, `useFocusTrap.ts`, and the panel offset of `Toaster.tsx` with its suite in `Toast.test.tsx` (lead memo C13, C15). The foundation lands only the layer kind and its Escape rule (§1.2), the types (§1.1) and the registry (§1.3); the cross-cutting research's alternative, a frozen foundation seam in `Dialog.shared.tsx` with a Drawer package and a Dialog package in parallel, is not used. *Why:* all three items change Drawer and Dialog and the shared trigger, close-slot, backdrop, presence and opener code, which is too unsettled to freeze before wave B (critic fix 6); one owner gives the Toaster's one offset function (D84) one author; NavDrawer needs a module-only shell that only the owner of the Drawer modules can build (memo C17).
- **D4 — The foundation is shared, additive and behaviour-neutral.** Wave A lands only what several packages read and no package owns (§1): types, the layer kind, the registry, the pending lists, tokens, the navigation glyph, Toolbar's roving extraction, the `useRovingTabIndex` hand-back fix (a public hook, so a CHANGELOG "Fixed" entry), the internal Avatar size context, `ListboxSurface listProps` and `PickerExpandButton dimDisabled`. Behaviour that belongs to an item is its package's: the focus hooks and `useModalLayer` (`P6-overlays`), the tag contexts (`P6-tags`), the Nav split (`P6-nav`). Between waves A and B a `modalType="non-modal"` Dialog type-checks and still behaves as `modal`, and no layer uses the `'dialog'` kind (nothing ships between waves). *Why:* Phase 5 §1's rule (the foundation changes no behaviour of an existing component); an extraction guarded by its component's unchanged suite cannot drift (`Toolbar.test.tsx`, `Option.test.tsx`, `Avatar.test.tsx`, `Combobox.test.tsx`, `TimePicker.test.tsx`, `SwatchPicker*.test.tsx`, `Accordion.test.tsx`).
- **D5 — Every Dialog and Drawer surface mounts through the presence core (amends Phase 2 D4).** From 0.11, `Dialog.Content` and the drawer panel shell (so Drawer and NavDrawer) mount through `usePresence(open, { unmountOnExit: unmountOnClose })` in both `unmountOnClose` modes and render `data-presence`, with no built-in motion (Phase 2 rule 15; Phase 10 animates them); layers, focus restore, the trap, isolation and scroll lock key on `open`, never on the mount (C-POPUPS, C-MOTION). Phase 2 D4 ("Popover, Tooltip, Dialog, Drawer and the other 0.6 surfaces move onto the core when Phase 10 animates them") is amended for Dialog and Drawer: they move in 0.11. A "Changed (DOM)" entry; D103 has the attributes. *Why:* `unmountOnClose={false}` (P6-07) needs the core's kept-exited state, and two mount paths for one surface would be worse than the synchronous end the core already gives a surface without motion (Phase 2 D2: it unmounts in the same `act()`); a consumer can animate the surfaces with `data-[presence=…]:` classes from 0.11 (memo C21).
- **D6 — Non-modal surfaces get their own layer kind and no new close reason (supersedes Phase 1 D9's plan).** `LayerKind` gains `'dialog'` (a non-modal Dialog, Drawer or NavDrawer: it shields nothing, and the Toaster moves out of its way), and a layer's `escape` becomes `boolean | 'inside'` (§1.2). `ModalOpenChangeReason` and `DismissReason` do not change: a non-modal surface never closes because focus or a press went elsewhere, so `'focus-outside'` does not join the reasons, as Phase 1 D9 and the roadmap's P6-06 sketch planned. Every `kind === 'modal'` check stays as it is (focus-restore validation `isInsideOtherOpenModal`, `layers.ts:319-330`; the restore's last fallback, `useRestoreFocus.ts:456`; `useModalIsolation.ts:75`), and the DatePicker calendar keeps its `'modal'` layer without isolation (`DatePicker.tsx:594`). *Why:* registered as `'modal'`, a non-modal surface would make every element outside it an invalid restore target, so a Menu closing elsewhere on the page would send focus into it; as `'popover'` the Toaster would not avoid a non-modal Drawer; re-keying the checks on isolation (the cross-cutting research's option) would change the DatePicker calendar; Fluent reports no focus-outside close (`Dialog.types.ts:23-38`); memo C14; D88, D90.
- **D7 — The backdrop is the surface's sibling, and every top-level portal child carries the presence attributes.** Dialog: `Portal > [backdrop] + positioner > surface`; Drawer and NavDrawer overlays: `Portal > [backdrop] + panel`. `hidden`, `inert` and `data-presence` go on every top-level child of the portal wrapper (the backdrop and the positioner or panel; an inline panel is its own top level), so a kept-mounted closed overlay leaves no page-blocking scrim. A "Changed (DOM)" entry; a test that reached the backdrop through `parentElement` queries it by its registry constant (§6.4). *Why:* `backdrop={null}` can mean "no backdrop" only when the backdrop is not the centring box; a backdrop's `opacity` or `filter` would reach a nested surface; Phase 10 fades the backdrop and moves the surface separately, so the DOM moves once, in 0.11 (memo C12; D93, D103).
- **D8 — Shared unions live in `src/lib/types.ts`.** `ModalType` widens to `'modal' | 'alert' | 'non-modal'`; new are `HeadingLevel` (`AccordionHeadingLevel` becomes its alias), `FocusMode` (SwatchPicker's `focusMode` is retyped to it), `TagSize`, `TagAppearance`, `TagShape`, `SurfaceSize` (`DrawerSize` and `DialogSize` are it) and `BackdropAppearance`; each reaches the entry through `export type * from './lib/types'` (`src/index.ts:11`) the moment it lands (§1.1). Unions of one component stay in its modules (`DrawerPosition`, `DrawerType`, `TagPickerSize`). *Why:* roadmap principle 1 (one spelling per concept: `Drawer.HeaderTitle` and `Nav.SectionHeader` share `headingLevel`, NavDrawer.Body and SwatchPicker `focusMode`, Tag, TagGroup, InteractionTag and TagPicker's tags the tag unions, Drawer and Dialog the surface sizes); `types.ts` has one owner (memo §C).
- **D9 — The registry is written up front and frozen.** `F6-foundation` writes every Phase 6 constant and key in `src/lib/classNames.ts` (24 constants and 15 keys on existing constants, §1.3), lists each in `PENDING_CLASS_NAMES`, and adds the `VARIANT_BASES` entries (§1.4); in waves B and C the registry is read only, and a missing or wrong key is a change request to the lead, who edits it (Phase 3 rule 20). Phase 3 D8 holds: no class is removed, and TagPicker's 0.8 `wave-tag-picker__control` and `__group` stay on their elements next to the new member roots until 1.0 ("Deprecated"). *Why:* Phase 3 D1 (class names are API the spec decides; a registry every package edits would break disjoint ownership); the `class-names` gate and `testClassName` fire only once a constant exists, so a late constant would skip the check silently.
- **D10 — Four pending lists keep every gate green between the waves, and only the two complete compounds move in wave B.** `F6-foundation` fills `PENDING_CLASS_NAMES` (39 entries), `PENDING_FLAT_MEMBERS` (16) and `PENDING_PUBLIC_TYPES` (23) once, and writes `PENDING_FLAT_EXPORTS` as `['TagPicker']` with two commented entries, `'Drawer'` and `'Nav'` (§1.5). `P6-overlays` uncomments `'Drawer'` in the commit that attaches the first new Drawer member, and `P6-nav` uncomments `'Nav'` in the commit that attaches `Nav.SectionHeader`; neither changes anything else of `scripts/verify-dist.mjs`. Nobody else edits the lists in waves B and C; INTEGRATION empties all four in wave D and restores the empty-bridge assertion of `verify-dist.test.mjs`. *Why:* `checkFlatExports` (`verify-dist.mjs:1024-1083`) fails a listed compound whose flat names all exist ("remove it") and reports every missing flat name of an unlisted one, and `Drawer` and `Nav` are complete compounds in 0.10, so each can be listed only from the commit that attaches its first part (Phase 3 rule 21's `'Tree'` precedent); `TagPicker` is exported and no compound until wave C, which the check tolerates as "planned"; the other three lists tolerate an entry listed early or kept after it lands (checked: `classNames.test.ts:160-164, 242-290`, `integration.test.tsx:204-240`, `public-types.test.ts:434-554`), so writing them once keeps two wave-B packages out of one test file, and two commented lines keep the two that must touch `verify-dist.mjs` on lines of their own.
- **D11 — Seams freeze per wave, and module-only seams stay module-only.** Frozen as §4 lists (rule 28): the foundation's after wave A; the tag seams after `P6-tags`' step 2; the Nav seam after `P6-nav`'s first task; the panel shell, the scroll store and the overlay types after `P6-overlays`' last task. Module-only seams (the contexts, hooks, markers and the shell of §4.1–§4.4) are never exported from a barrel; INTEGRATION adds their names to the "keeps internal helpers out of the public API" list of `integration.test.tsx` (§4.5), and `verify-dist` asserts their absence from `dist/index.*` (§6.2). *Why:* Phase 2 rule 12 and Phase 5 rule 20, per seam; wave C builds on them without reading the research; internal options must not become public props (P7 and P13 publish primitives on purpose, later).
- **D12 — Fluent's names by default, APG behaviour first, every difference recorded.** A prop takes Fluent's name where it fits C-NAMING (`appearance`, `shape`, `media`, `secondaryText`, `dismissible`, `modalType`, `unmountOnClose`, `separator`, `allowCreate`, `onOptionCreate`, `expandIcon`, `secondaryContent`, `Hamburger`), else C-NAMING or an existing WaveUI name wins and the JSDoc names Fluent's (`value`/`defaultValue`/`onValueChange` for `selectedValues`/`defaultSelectedValues`/`onTagSelect`; `focusMode` for `tabbable`; `headingLevel`, Accordion's name, for `as` and `heading`; `actions` for SplitNavItem's button and tooltip slots). Behaviour follows APG where Fluent differs: TagGroup is a toolbar of actions or a list, never a listbox of dismissible chips; `Nav.Divider` is a decorative list item; an overlay NavDrawer is a named dialog around a `<nav>`; a non-modal surface keeps its Tab place after its opener. Every such difference without a gap id joins roadmap §8.3's new "Behaviour differences decided by the Phase 6 spec (0.11.0)" list (§5.5). *Why:* the Phase 2 lead rulings; roadmap §1.1 goals 4 and 5; Phase 5's practice (its §8.3 list).
- **D13 — What 0.11 may change for a 0.10 app, and where it is said.** Nothing public is removed, and every addition is opt-in except the changes this spec lists, each with a CHANGELOG entry and, where an app or its tests must act, an "Upgrading from 0.10" line (§5.1): **DOM** — the backdrop sibling and the Dialog positioner (D7), `data-presence` on Dialog and Drawer (D5), Tag's 1px border, its smaller padding classes and its `data-*` attributes (D20), TagPicker's tags as Tags in a TagGroup and its summary on the root (D68); **look** — TagPicker's default chevron and Tag-based tags (D54, D61), the built-in Drawer header's scroll-reactive line (D82), a stacked modal's transparent backdrop (D94), Tag's Dismiss hover (D22, "Fixed"); **behaviour** — every Dialog and Drawer trigger toggles (D89), Delete and Backspace dismiss a focused tag (D33), TagPicker's focus after a keyboard removal, its exact-match activation and its press toggle (D56, D60, D66), Nav's list-child warning (D114); **types** — `ModalType` and `DrawerPosition` widen (an exhaustive `switch` or `Record` needs the new case), `DrawerProps` and its `ref` widen to `HTMLElement` (D100), `DrawerTriggerRenderProps['aria-haspopup']` becomes optional (D89), `TagPickerOption` is also a value (D64), and Tag's new own props shadow the attributes of the same names (D26). The last is the one narrowing: `TagProps<'li'>['value']` and `TagProps<'button'>['value']` become `string`, and `size`, `shape`, `appearance`, `selected`, `media`, `icon` and `secondaryText` no longer reach an `as` component. It is an exception to roadmap principle 2 ("a type may widen but never narrow"), asked in §8 (Q4) with this as the recommendation, and stated in "Types" and "Upgrading". **Deprecated:** TagPicker's `__control` and `__group` classes, kept until 1.0. *Why:* roadmap principle 2 and §3's rule that a change that is not an addition is listed with what to do; Fluent's names on a polymorphic Tag cannot be added without shadowing, and a one-line `String(n)` fix for a rare `as="li"` value is cheaper than a second spelling of `value` (D26).
- **D14 — One tag family on one table.** Tag, InteractionTag and TagPicker's tags share one size, look and shape table (`tagStyles.ts`: medium 28px, small 24px, extra-small 20px; Avatar media 24, 20 and 16px through the internal Avatar size context), one dismiss rule (a separate Dismiss button named "Dismiss <text>" by `labelInName`, natively disabled with its tag) and one group model: TagGroup is a toolbar of actions or a list of static tags, and `TagPicker.Group` is a TagGroup list. No listbox of tags exists anywhere. *Why:* lead memo C1–C3, C7; the WaveUI strength "each dismiss button is named after its tag"; an `option` cannot hold a Dismiss button (axe `nested-interactive`, re-verified); D21, D28, D30 and D53 hold the details.
- **D15 — NavDrawer is Nav's state on the drawer panel shell.** NavDrawer renders the module-only `DrawerPanel` (D108) with Nav's `useNavRootState` (D112), never the public `Drawer` or the `Nav` compound; an import of only `Nav` holds no drawer code, an import of only `Hamburger` no modal machinery, and an import of only `NavDrawer` neither Drawer's root nor Nav's compound (§6.2). *Why:* Fluent's NavDrawer is Nav state rendered on a Drawer root; wrapping the public components would need private props to switch half of each off, and every later Drawer change would leak into NavDrawer (memo C17, C25; D124, D136).
- **D16 — 74 components become 78.** TagGroup, InteractionTag, NavDrawer and Hamburger are new rows of the README component table; Drawer stays one component with `type` (no `InlineDrawer` or `OverlayDrawer` alias), and the new parts are compound members. `CLAUDE.md:5`, `README.md:3`, `README.md:474` and the guide's catalog heading (`docs/WAVE-UI-GUIDE.md:2038`) say 78 (§5). *Why:* the count is the README table's rows minus `Presence` (75 − 1 = 74 today, counted); the roadmap's `type` prop; aliases are not counted (Option, OptionGroup).
- **D17 — Subsystems stay tree-shakeable.** An import of only `Tag` holds no TagGroup, InteractionTag, Toolbar or listbox code (Tag imports `TagGroup.context.ts` and `Avatar.context.ts`, never `TagGroup.tsx` or `Avatar.tsx`); only `TagGroup` no listbox code; only `Combobox` no TagPicker or tag code; only `Nav` no drawer, modal or roving code; only `Hamburger` no drawer or Nav root; only `NavDrawer` no Drawer root or Nav compound; only `Toaster` no Dialog or Drawer module; the Button-only probe is unchanged (`Dialog.slots.tsx` imports Button, never the reverse). INTEGRATION adds the probes (§6.2). *Why:* roadmap principle 6; each split of this phase (D51, D70, D110, D136) exists partly for these boundaries.
- **D18 — The roadmap's Phase 6 sketches change where this spec decided otherwise.** P6-01: `selected` is a look and `value` TagGroup's key; P6-02: no listbox mode (selection is `aria-pressed` toggles on `InteractionTag.Primary` in the toolbar), a `role="list"` mode, `shape`, `fallbackFocusRef`, forms, and "axe for both roles" becomes "axe for the toolbar and list roles"; P6-03: no `hasSecondaryAction`, the Secondary is named "Dismiss <primary text>"; P6-04: `.Group` is a TagGroup list, focus after a keyboard removal goes to the next tag else the trigger, the root gains `clearable`, `expandIcon` and `overflow`, `labels` gains `clear`, `expand` and `overflowCount`; P6-05: `Drawer.Footer` is a flex row below the body (a Phase 1 D10 deviation for Drawer only), `Drawer.Body` joins, `headingLevel`, the block offset; P6-06: no `'focus-outside'` reason, `closeButton?: Slot<'span'>`, the `'dialog'` layer kind, `backdrop` `appearance`, every trigger toggles; P6-07: presence for every Dialog and Drawer (D5), `hidden`/`inert` on every top-level element, the package ends with the panel shell; P6-08: built on the shell and Nav's state, not on the public Drawer, with `Depends on` P6-05, P6-06, P6-07, P6-09 and P1-24; P6-09: `Nav.Divider` is `<li aria-hidden="true">` (`<li role="separator">` fails axe 4.13's `list` rule, verified), `Nav.SplitItem` becomes `actions` on `Nav.Item` and `Nav.SubItem`, `Nav.AppItemStatic` joins. DOCS writes them into the roadmap (§5.5). *Why:* the roadmap is the plan of record; a sketch the spec changes is corrected in the same release (Phases 3–5).
- **D19 — Rulings live in their sections.** Each §2 section owns a reserved range and states its rulings at its head; unused numbers are not used; a citation is the number alone ("D35", "D108"). *Why:* each item's rulings sit next to the API they decide; one numbering keeps citations unambiguous.

| Range | Section | Used |
|---|---|---|
| D1–D19 | §0.3, cross-cutting | D1–D19 |
| D20–D49 | §2 P6-01 Tag (D20–D29), P6-02 TagGroup (D30–D41), P6-03 InteractionTag (D42–D47) | D20–D47 |
| D50–D69 | §2 P6-04 TagPicker | D50–D68 |
| D70–D109 | §2 P6-05 Drawer parts (D70–D85), P6-06 non-modal surfaces and slots (D86–D99), P6-07 inline, kept mounted and the panel shell (D100–D109) | D70–D109 |
| D110–D139 | §2 P6-09 Nav parts (D110–D123), P6-08 NavDrawer and Hamburger (D124–D139) | D110–D139 |

### 0.4 Out of scope for 0.11

Everything else in the roadmap. In particular:

- **Routed to Phase 7 (P7-01, P7-02, P7-03):** `inline` popups and `positioning` (`tagpicker-10`, Fluent's TagPicker `inline`/`positioning`); per-surface mount nodes (`drw-5`, `dialog-6`); publishing `useModalLayer`, `useDismiss` and the focus utilities (the `modalType` option of D91 is the shape P7-02 publishes); an effective-open context so popups inside a closing kept-mounted surface close with it (D106 warns instead; §8.2 backlog line); Fluent's `inertTrapFocus`.
- **Routed to Phase 10:** every motion: Drawer, Dialog and NavDrawer enter and exit (`drw-4`, `dialog-5`, `nav-8`), Nav item actions' fade, `NavCategoryItem.expandIconMotion`. No component ships enter or exit classes (Phase 2 rule 15); consumers animate Dialog and Drawer with `data-[presence=…]:` classes (D5).
- **Routed to Phase 8 (P8-01):** square Avatars in `rounded` tags, public numeric Avatar sizes, badge sizing in tags (`avatar-1`, `avatar-3`, `avatar-7`).
- **Routed to Phase 9:** a TagGroup + Overflow story (`buttons-23`); Breadcrumb's `focusMode` (P9-02 reuses `FocusMode`).
- **Routed to Phase 13:** public contexts of tags (`buttons-29`, P13-02), `slotProps` for the new parts, the 1.0 notices of the optional `details` arguments (P13-03).
- **Stays in the backlog (§8.2), no ride-along:** Nav `density` (`nav-1`), single-open categories (`nav-2`), Nav callback details (`nav-4`), Dialog title heading level (`dialogtitle-1`: `Dialog.Title` stays an `h2`, D83), Dialog footer action groups and stacking (`dialogactions-1`, `dialogactions-2`), recomposition providers (`recompose-1`); an opt-in light dismiss for non-modal surfaces; a `useNavDrawerToggle` helper for an outer Hamburger (D133).
- **Fluent props not taken:** TagPicker `noPopover`, `TagPickerControl secondaryAction` (`clearable` is the clear-all action), `disableAutoFocus` (D67); InteractionTag `hasSecondaryAction` (D44); NavDrawer `title`, `closeOnSelect`, a Trigger or Close part (D139); a `div` heading for `Drawer.HeaderTitle` and `Nav.SectionHeader` (`headingLevel` picks `h1`–`h6`).
- **Tags, not in 0.11:** `disabledFocusable` on tags, a polymorphic `InteractionTag.Primary`, single selection (`selectionMode`) on TagGroup, TagGroup Field wiring, TagGroup `labels` and announcements, a `details` argument on `onDismiss`.
- **TagPicker, not in 0.11:** `disabled` on `options` entries, a `details` argument or a veto on `onOptionCreate`, a clear-all announcement, the media of registered `TagPicker.Option`s in default tags (D55), locale-aware case folding, virtualization, `onActiveOptionChange` (Phase 5 §0.4 kept).
- **P4-05 (`theme="system"`)** waits for its own design addendum (roadmap status line) and is not part of 0.11.

A package that finds one of them trivially reachable reports it; it does not implement it.

---

## 1. Foundation (F6-foundation, wave A)

Lands first and alone (rule 27), and changes no behaviour of an existing component (D4): every addition is opt-in or unused until wave B, every extraction is guarded by its component's unchanged suite, and the `useRovingTabIndex` fix changes only what a detached container leaves behind. The tasks run in the order of the subsections; the lead commits after each.

### 1.1 `src/lib/types.ts`

```ts
/**
 * How a Dialog or Drawer relates to the page (Fluent's `modalType`). `modal`: a backdrop dims the
 * page, focus stays in the surface, the rest of the page is `inert` and does not scroll. `alert`:
 * modal, for a confirmation that needs an answer (`role="alertdialog"`; a backdrop press does not
 * close it). `non-modal`: the page stays usable (no backdrop, no focus trap, nothing inert, the
 * page scrolls).
 */
export type ModalType = 'modal' | 'alert' | 'non-modal';

/**
 * Size of an overlay surface: Dialog.Content's width cap, a Drawer's width (its height at the
 * bottom). `small`, `medium`, `large`, or `full`, the whole viewport.
 */
export type SurfaceSize = CoreSize | 'full';

/** How a modal surface's backdrop paints the page: `dimmed`, or `transparent` (a modal over another). */
export type BackdropAppearance = 'dimmed' | 'transparent';

/** Level of a heading element, `<h1>` … `<h6>`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * How the keyboard reaches the items of a set: `'tab'`, every item is a Tab stop and the arrow
 * keys do nothing; `'arrow'`, the set is one Tab stop and the arrow keys move between its items.
 */
export type FocusMode = 'tab' | 'arrow';

/** Size of a tag (Fluent's `TagSize`): `extra-small` (20px tall), `small` (24px) or `medium` (28px). */
export type TagSize = Extract<Size, 'extra-small' | 'small' | 'medium'>;

/** Colour scheme of a tag (Fluent's `TagAppearance`): a neutral fill, a border, or a light brand tint. */
export type TagAppearance = 'filled' | 'outline' | 'brand';

/** Corners of a tag (Fluent's `TagShape`): `circular` (a pill) or `rounded` (4px). */
export type TagShape = Extract<Shape, 'rounded' | 'circular'>;
```

1. `ModalType` replaces `:117-118` (its 0.10 JSDoc ends "(`'non-modal'` joins in a later release)"); `ModalOpenChangeReason` (`:114-115`) is unchanged (D6). `SurfaceSize` sits after `CoreSize` (`:47`); the tag unions after `Shape` (`:56`); the others after `ModalType`.
2. **Retypes outside the module** (rule 27): `src/components/layout/Accordion.tsx:20` becomes `/** Heading level of the element that wraps each Accordion trigger: the shared {@link HeadingLevel}. */ export type AccordionHeadingLevel = HeadingLevel;` (a type import from `../../lib/types`); `src/components/input/SwatchPicker.tsx:104` (`focusMode?: 'arrow' | 'tab'`) and `SwatchPicker.context.ts:28` (`focusMode: 'arrow' | 'tab'`) become `FocusMode`, JSDoc unchanged. Same unions, no behaviour change; `public-types.test.ts:1028` (`SwatchPickerProps['focusMode']` equals `'arrow' | 'tab' | undefined`) passes unchanged.
3. **Tests** (`src/lib/__tests__/types.test.ts`): "ModalType is modal or alert" (`:113-116`) becomes "ModalType is modal, alert or non-modal" (`toEqualTypeOf<'modal' | 'alert' | 'non-modal'>()`; the `not.toMatchTypeOf` line is dropped); new cases "SurfaceSize is the core sizes and full" (and `expectTypeOf<CoreSize>().toExtend<SurfaceSize>()`), "BackdropAppearance is dimmed or transparent", "HeadingLevel is 1 to 6, and AccordionHeadingLevel is it", "FocusMode is tab or arrow, and SwatchPicker's focusMode is it", and a `describe('tag vocabulary (Tag, TagGroup, InteractionTag, TagPicker)')` with "TagSize is extra-small, small and medium, a subset of Size", "TagAppearance is filled, outline and brand", "TagShape is the rounded and circular subset of Shape". `src/__tests__/public-types.test.ts:695` becomes the three values, and `:724-726` (`// @ts-expect-error non-modal dialogs are planned …`) becomes a positive assertion (`const nonModal: DialogProps['modalType'] = 'non-modal'`); `src/components/overlays/__tests__/Dialog.test.tsx:2145-2147` likewise (the directive would otherwise be an unused-directive error under `tsconfig.dev.json`). No `PENDING_PUBLIC_TYPES` entry: the entry exports the module's types wholesale.

### 1.2 `src/lib/layers.ts` and `src/hooks/useDismiss.ts`

1. `LayerKind = 'modal' | 'dialog' | 'popover' | 'menu' | 'listbox' | 'tooltip' | 'toast'`. Its JSDoc gains: "`dialog` marks a non-modal Dialog or Drawer: it shields nothing (no isolation), takes Escape only from inside its tree (`escape: 'inside'`), and the Toaster moves out of its way; focus-restore validation and modal isolation do not count it."
2. `LayerRecord.escape: boolean | 'inside'` — "Whether Escape dismisses the layer: always (`true`), never (`false`), or only while the key's target or the focused element is in the layer's tree (`'inside'`)." `UseDismissOptions.escape?: boolean | 'inside'` with the same text and `@default true`; the record's getter (`useDismiss.ts:139-141`) passes the value through. `useDismiss`'s docblock (`:78-92`) adds one sentence for `'inside'`.
3. `findEscapeHandler` (`layers.ts:411-429`): `contains` is defined first, and `isCandidate = (layer) => (layer.escape === true || (layer.escape === 'inside' && contains(layer))) && !isBelowBarrier(layer, barrier)`. Rules 1–3 of its docblock are unchanged; rule 4 (the global topmost candidate) therefore never picks an `'inside'` layer whose tree holds neither the target nor the focused element. The allow-listed toast region counts as inside every layer (unchanged), so an `'inside'` layer still takes Escape typed in the region. `Toaster.tsx:1330` reads `layer.escape` as a truthy check, which keeps its meaning (no change there).
4. New module export (not exported from the entry):
   ```ts
   /**
    * Whether an open layer whose modal isolation is active ({@link registerLayerIsolation}) is
    * stacked below the layer `layerId` (`compareLayers(self, other) > 0`). A `layerId` that is not
    * registered yet (the render that opens it) counts as the topmost layer, so every isolating open
    * layer counts. The layer itself and its descendants never count. Read during render through
    * `useSyncExternalStore(subscribeLayers, …)` (the dim-once rule of Dialog and Drawer).
    */
   export function hasIsolatingModalBelow(layerId: string): boolean;
   ```
5. `registerLayerIsolation` (`:216-228`) calls `notifySubscribers` after it adds the first registration of a layer and after its unregister removes the last one (only when the isolated set changes). *Why:* the dim-once snapshot (D94) reads isolation, which changes without a layer registering (a Drawer and a confirm Dialog opened in one commit register their layers before the Drawer's isolation; a `modalType` switch while open adds or removes isolation alone). The existing subscribers stay correct: `useModalIsolation`'s `reconcile` checks its `active` flag, the focus tracker's refresh and the Toaster's measure are idempotent.
6. **Tests.** `src/lib/__tests__/layers.test.ts`: "an 'inside' layer is no Escape candidate while focus and the target are outside its tree: the global fallback skips it and an escape-enabled layer below takes the key"; "an 'inside' layer takes Escape when focus or the target is inside its tree"; "an 'inside' layer handles Escape from an escape-disabled descendant (the ancestor rule)"; "an 'inside' layer takes Escape typed in the allow-listed toast region"; "isInsideOtherOpenModal ignores a dialog layer"; `hasIsolatingModalBelow` for stacked siblings, a nested modal, no isolating layer, after the lower one unregisters, an unregistered `layerId`, and an isolated descendant above (does not count); "registering and unregistering isolation notifies subscribers once per change". `src/hooks/__tests__/useDismiss.test.tsx`: "escape 'inside': Escape from a page field leaves the layer open, from inside it dismisses with 'escape'"; "kind 'dialog' reaches the record". Every 0.10 case of both files passes unchanged.

### 1.3 `src/lib/classNames.ts`

Every constant and key below is new (24 constants; 15 keys on 7 existing constants), each listed in `PENDING_CLASS_NAMES` (§1.5). Roots are `wave-` plus the kebab-cased flat name and parts `__<kebab key>` (Phase 3 D3, the formula case of `classNames.test.ts`). The JSDoc follows rule 32 (no bare utility word; elements named by role). Placement: each new constant after its family's last constant.

**Tags** (after `tagClassNames`):

```ts
/**
 * Tag: `root` on the rendered element (your `as`, default `<span>`); `media` on the element of the
 * media slot; `icon` on the icon box; `primaryText` on the content span; `secondaryText` on the
 * second line of text; `dismissButton` on the Dismiss button; `dismissIcon` on the icon inside it
 * (what `dismissIcon` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const tagClassNames = {
  root: 'wave-tag',
  media: 'wave-tag__media',                     // new
  icon: 'wave-tag__icon',                       // new
  primaryText: 'wave-tag__primary-text',
  secondaryText: 'wave-tag__secondary-text',    // new
  dismissButton: 'wave-tag__dismiss-button',
  dismissIcon: 'wave-tag__dismiss-icon',
} as const;

/** TagGroup: `root` on the group element (the toolbar or the list). */
export const tagGroupClassNames = { root: 'wave-tag-group' } as const;

/** InteractionTag: `root` on the element that holds its two buttons. */
export const interactionTagClassNames = { root: 'wave-interaction-tag' } as const;

/**
 * InteractionTag.Primary: `root` on its button; `media`, `icon`, `primaryText` and
 * `secondaryText` on the slot elements.
 */
export const interactionTagPrimaryClassNames = {
  root: 'wave-interaction-tag-primary',
  media: 'wave-interaction-tag-primary__media',
  icon: 'wave-interaction-tag-primary__icon',
  primaryText: 'wave-interaction-tag-primary__primary-text',
  secondaryText: 'wave-interaction-tag-primary__secondary-text',
} as const;

/**
 * InteractionTag.Secondary: `root` on its button; `dismissIcon` on the glyph inside it (the
 * default glyph, or the element that wraps the children).
 */
export const interactionTagSecondaryClassNames = {
  root: 'wave-interaction-tag-secondary',
  dismissIcon: 'wave-interaction-tag-secondary__dismiss-icon',
} as const;
```

**TagPicker** (`tagPickerClassNames` gains five keys; six constants after it; no constant for `TagPickerOptionGroup`, which is `OptionGroup` and resolves to `optionGroupClassNames` by its display name, lead memo C29):

```ts
/**
 * TagPicker: `root` on the outer element; `control` on the tag area and `group` on the list of
 * tags (both deprecated, kept until 1.0 next to TagPicker.Control's and TagPicker.Group's own
 * classes); `tag` on each tag; `removeButton` on each tag's remove button; `input` on the
 * `role="combobox"` input; `expandButton` on the expand button and `expandIcon` on its glyph;
 * `clearButton` on the clear button; `listbox` on the `role="listbox"` list; `option` on each
 * Option it renders (which also carries Option's classes); `createOption` on the create option of
 * `allowCreate`; `overflowCount` on the "+N" count of the single-line layout; `surface` on the
 * portaled popup; `emptyMessage` on the "No matches" row.
 */
export const tagPickerClassNames = {
  root: 'wave-tag-picker',
  control: 'wave-tag-picker__control',
  group: 'wave-tag-picker__group',
  tag: 'wave-tag-picker__tag',
  removeButton: 'wave-tag-picker__remove-button',
  input: 'wave-tag-picker__input',
  expandButton: 'wave-tag-picker__expand-button',     // new
  expandIcon: 'wave-tag-picker__expand-icon',         // new
  clearButton: 'wave-tag-picker__clear-button',       // new
  listbox: 'wave-tag-picker__listbox',
  option: 'wave-tag-picker__option',
  createOption: 'wave-tag-picker__create-option',     // new
  overflowCount: 'wave-tag-picker__overflow-count',   // new
  surface: 'wave-tag-picker__surface',
  emptyMessage: 'wave-tag-picker__empty-message',
} as const;

/** TagPicker.Control: `root` on the field that holds the tags, the trigger and the end buttons (it also carries TagPicker's `control` part). */
export const tagPickerControlClassNames = { root: 'wave-tag-picker-control' } as const;
/** TagPicker.Group: `root` on the list of tags (also a TagGroup's root, and TagPicker's `group` part). */
export const tagPickerGroupClassNames = { root: 'wave-tag-picker-group' } as const;
/** TagPicker.Input: `root` on the `role="combobox"` input (it also carries TagPicker's `input` part). */
export const tagPickerInputClassNames = { root: 'wave-tag-picker-input' } as const;
/** TagPicker.Button: `root` on the `role="combobox"` button. */
export const tagPickerButtonClassNames = { root: 'wave-tag-picker-button' } as const;
/** TagPicker.List: `root` on the `role="listbox"` list (it also carries ListboxSurface's `list` and TagPicker's `listbox` parts). */
export const tagPickerListClassNames = { root: 'wave-tag-picker-list' } as const;
/** TagPicker.Option (an Option variant): `root` on the option; `media` on the visual before its text; `secondaryContent` on its second line. */
export const tagPickerOptionClassNames = {
  root: 'wave-tag-picker-option',
  media: 'wave-tag-picker-option__media',
  secondaryContent: 'wave-tag-picker-option__secondary-content',
} as const;
```

The key order of `tagPickerClassNames` above groups the parts by element; an implementation may keep 0.10's order and append the five keys (the order is not API).

**Dialog and Drawer** (keys on `dialogContentClassNames`, `dialogTitleClassNames`, `drawerClassNames`; five constants after `drawerTitleClassNames`):

```ts
/**
 * Dialog.Content: `root` on the surface (`role="dialog"` or `"alertdialog"`, also while kept
 * mounted); `backdrop` on the backdrop behind it; `positioner` on the element that centres the
 * surface (the backdrop's sibling); `titleActions` on the area of header buttons in the top end
 * corner; `titleAction` on the element of the `titleAction` slot; `closeButton` on the built-in
 * Close button (which also carries Button's root); `body` on the scrolling body. The heading of
 * its `title` prop carries Dialog.Title's class.
 */
export const dialogContentClassNames = {
  root: 'wave-dialog-content',
  backdrop: 'wave-dialog-content__backdrop',
  positioner: 'wave-dialog-content__positioner',          // new
  titleActions: 'wave-dialog-content__title-actions',     // new
  titleAction: 'wave-dialog-content__title-action',       // new
  closeButton: 'wave-dialog-content__close-button',
  body: 'wave-dialog-content__body',
} as const;

/** Dialog.Title: `root` on the `<h2>`; `action` on the element of its `action` slot. */
export const dialogTitleClassNames = {
  root: 'wave-dialog-title',
  action: 'wave-dialog-title__action',                    // new
} as const;

/**
 * Drawer: `root` on the panel (the portaled `role="dialog"` element of an overlay drawer, while it
 * is open or kept mounted, or the `<aside>` of an inline one); `backdrop` on the backdrop of a
 * modal or alert overlay drawer; `header` on the built-in header row (absent with a
 * Drawer.Header); `titleAction` on the element of the `titleAction` slot in that row;
 * `closeButton` on every built-in Close button (which also carries Button's root), in the built-in
 * header and in each Drawer.HeaderTitle; `body` on the scrolling body. The heading of its `title`
 * prop carries Drawer.Title's class. The panel carries `data-type`, `data-position` and
 * `data-size`; the body, the header and the footer carry `data-scroll-state`.
 */
export const drawerClassNames = {
  root: 'wave-drawer',
  backdrop: 'wave-drawer__backdrop',
  header: 'wave-drawer__header',
  titleAction: 'wave-drawer__title-action',               // new
  closeButton: 'wave-drawer__close-button',
  body: 'wave-drawer__body',
} as const;

/** Drawer.Title: `root` on its heading (an `<h2>`, or the level `headingLevel` picks); also on the heading of Drawer's `title` prop. */
export const drawerTitleClassNames = { root: 'wave-drawer-title' } as const;   // JSDoc only

/** Drawer.Header: `root` on the header element (it replaces the built-in header row). */
export const drawerHeaderClassNames = { root: 'wave-drawer-header' } as const;
/**
 * Drawer.HeaderTitle: `root` on the title row; `heading` on the heading that names the drawer;
 * `action` on the element of the `action` slot. Its Close button carries Drawer's `closeButton`.
 */
export const drawerHeaderTitleClassNames = {
  root: 'wave-drawer-header-title',
  heading: 'wave-drawer-header-title__heading',
  action: 'wave-drawer-header-title__action',
} as const;
/** Drawer.HeaderNavigation: `root` on the navigation element. */
export const drawerHeaderNavigationClassNames = { root: 'wave-drawer-header-navigation' } as const;
/**
 * Drawer.Body: `root` on the scrolling body while a Drawer.Body gives it its props (the body also
 * carries Drawer's `body`), or on the element of a Drawer.Body rendered inside the body.
 */
export const drawerBodyClassNames = { root: 'wave-drawer-body' } as const;
/** Drawer.Footer: `root` on the footer element. */
export const drawerFooterClassNames = { root: 'wave-drawer-footer' } as const;
```

**Nav, NavDrawer and Hamburger** (keys on `navItemClassNames` and `navSubItemClassNames`, whose JSDoc adds "`actions` on the group of its `actions`"; nine constants after `navSubItemClassNames`):

```ts
// navItemClassNames:    actions: 'wave-nav-item__actions'
// navSubItemClassNames: actions: 'wave-nav-sub-item__actions'

/** Nav.SectionHeader: `root` on the heading element; `listItem` on the list item around it. */
export const navSectionHeaderClassNames = {
  root: 'wave-nav-section-header',
  listItem: 'wave-nav-section-header__list-item',
} as const;
/** Nav.Divider: `root` on its list item (hidden from assistive technology). */
export const navDividerClassNames = { root: 'wave-nav-divider' } as const;
/**
 * Nav.AppItem: `root` on the `<a>` (with `href`) or `<button>`; `listItem` on the list item around
 * it; `icon` on the icon span; `content` on the label span.
 */
export const navAppItemClassNames = {
  root: 'wave-nav-app-item',
  listItem: 'wave-nav-app-item__list-item',
  icon: 'wave-nav-app-item__icon',
  content: 'wave-nav-app-item__content',
} as const;
/** Nav.AppItemStatic: `root` on the `<div>`; `listItem` on the list item around it; `icon`; `content`. */
export const navAppItemStaticClassNames = {
  root: 'wave-nav-app-item-static',
  listItem: 'wave-nav-app-item-static__list-item',
  icon: 'wave-nav-app-item-static__icon',
  content: 'wave-nav-app-item-static__content',
} as const;
/**
 * NavDrawer (a Drawer variant: it also carries Drawer's root, and its backdrop Drawer's backdrop
 * class): `root` on the panel (the portaled `role="dialog"` element of an overlay drawer, the
 * panel element of an inline one); `backdrop` on the backdrop of a modal overlay; `nav` on the
 * navigation landmark that fills the panel.
 */
export const navDrawerClassNames = {
  root: 'wave-nav-drawer',
  backdrop: 'wave-nav-drawer__backdrop',
  nav: 'wave-nav-drawer__nav',
} as const;
/** NavDrawer.Header: `root` on the header row. */
export const navDrawerHeaderClassNames = { root: 'wave-nav-drawer-header' } as const;
/** NavDrawer.Body: `root` on the scrolling body; `list` on its list. */
export const navDrawerBodyClassNames = { root: 'wave-nav-drawer-body', list: 'wave-nav-drawer-body__list' } as const;
/** NavDrawer.Footer: `root` on the footer; `list` on its list. */
export const navDrawerFooterClassNames = { root: 'wave-nav-drawer-footer', list: 'wave-nav-drawer-footer__list' } as const;
/** Hamburger (a Button variant: it also carries Button's root and icon classes): `root` on the `<button>`; `icon` on the icon span. */
export const hamburgerClassNames = { root: 'wave-hamburger', icon: 'wave-hamburger__icon' } as const;
```

No `NO_ELEMENT` entry is added (every Phase 6 component and part renders an element; `TagPickerOptionGroup` resolves through `OptionGroup`). The `drawerTitleClassNames`, `drawerClassNames`, `dialogContentClassNames` and `tagPickerClassNames` JSDoc changes are part of this task (rule 33).

### 1.4 `src/test-utils.ts` (`VARIANT_BASES`) and `src/__tests__/test-utils.test.tsx`

```ts
// VARIANT_BASES gains (base first, Phase 3 D5):
tagPickerOptionClassNames: ['optionClassNames'],
tagPickerGroupClassNames: ['tagGroupClassNames'],
navDrawerClassNames: ['drawerClassNames'],
hamburgerClassNames: ['buttonClassNames'],
```

No `DISPLAY_NAME_ALIASES` entry: every Phase 6 display name camel-cases to its constant (`TagPickerOptionGroup` is `OptionGroup`). InteractionTag carries no Tag class (D46), and NavDrawer's parts carry no Drawer part class (D137). `test-utils.test.tsx` (next to "puts a variant's base roots before its own in carries (VARIANT_BASES)", `:893-926`) gains: "getStableClassNames('TagPickerOption') carries wave-option then wave-tag-picker-option", "getStableClassNames('TagPickerGroup') carries wave-tag-group then wave-tag-picker-group", "getStableClassNames('NavDrawer') carries wave-drawer then wave-nav-drawer", "getStableClassNames('Hamburger') carries wave-button then wave-hamburger"; "points every alias, variant and base at a registry constant" (`:918-925`) passes because §1.3 lands in the same task.

### 1.5 The pending lists and the flat-name bridge

Filled once in wave A (D10; rule 29). Sorted as `[...new Set(list)].sort()` sorts them (each list's own test).

1. **`PENDING_CLASS_NAMES`** (`src/__tests__/classNames.test.ts:160`; its comment becomes "Constants and keys of the Phase 6 parts (spec §1.5), written before the parts exist; INTEGRATION empties the list in wave D"):
   ```ts
   const PENDING_CLASS_NAMES: readonly string[] = [
     'dialogContentClassNames.positioner', 'dialogContentClassNames.titleAction',
     'dialogContentClassNames.titleActions', 'dialogTitleClassNames.action',
     'drawerBodyClassNames', 'drawerClassNames.titleAction', 'drawerFooterClassNames',
     'drawerHeaderClassNames', 'drawerHeaderNavigationClassNames', 'drawerHeaderTitleClassNames',
     'hamburgerClassNames', 'interactionTagClassNames', 'interactionTagPrimaryClassNames',
     'interactionTagSecondaryClassNames', 'navAppItemClassNames', 'navAppItemStaticClassNames',
     'navDividerClassNames', 'navDrawerBodyClassNames', 'navDrawerClassNames',
     'navDrawerFooterClassNames', 'navDrawerHeaderClassNames', 'navItemClassNames.actions',
     'navSectionHeaderClassNames', 'navSubItemClassNames.actions', 'tagClassNames.icon',
     'tagClassNames.media', 'tagClassNames.secondaryText', 'tagGroupClassNames',
     'tagPickerButtonClassNames', 'tagPickerClassNames.clearButton',
     'tagPickerClassNames.createOption', 'tagPickerClassNames.expandButton',
     'tagPickerClassNames.expandIcon', 'tagPickerClassNames.overflowCount',
     'tagPickerControlClassNames', 'tagPickerGroupClassNames', 'tagPickerInputClassNames',
     'tagPickerListClassNames', 'tagPickerOptionClassNames',
   ];
   ```
   (39 entries; Prettier writes one per line.) A whole-constant entry skips both the "names a public component" and the "applied" checks, a key entry the "applied" check (`classNames.test.ts:162-164, 242-290`); nothing fails for an entry that is applied or public early, so the packages leave the list alone (rule 29).
2. **`PENDING_FLAT_MEMBERS`** (`src/__tests__/integration.test.tsx:204`; comment "Flat names of the Phase 6 members (spec §1.5); INTEGRATION empties the list in wave D"): `'DrawerBody'`, `'DrawerFooter'`, `'DrawerHeader'`, `'DrawerHeaderNavigation'`, `'DrawerHeaderTitle'`, `'NavAppItem'`, `'NavAppItemStatic'`, `'NavDivider'`, `'NavSectionHeader'`, `'TagPickerButton'`, `'TagPickerControl'`, `'TagPickerGroup'`, `'TagPickerInput'`, `'TagPickerList'`, `'TagPickerOption'`, `'TagPickerOptionGroup'` (16). `'TagPickerOption'` is listed although the barrel names it today: it exports only the type (`input/index.ts:105`), so the runtime barrel has no such value (`flat in barrel` is false). InteractionTag and NavDrawer need no entry (not exported before wave D).
3. **`PENDING_PUBLIC_TYPES`** (`src/__tests__/public-types.test.ts:434`): `'DialogSize'`, `'DrawerBodyProps'`, `'DrawerFooterProps'`, `'DrawerHeaderNavigationProps'`, `'DrawerHeaderProps'`, `'DrawerHeaderTitleProps'`, `'DrawerModalType'`, `'DrawerSize'`, `'DrawerType'`, `'NavAppItemAnchorProps'`, `'NavAppItemButtonProps'`, `'NavAppItemDynamicProps'`, `'NavAppItemOwnProps'`, `'NavAppItemProps'`, `'NavAppItemStaticProps'`, `'NavDividerProps'`, `'NavSectionHeaderProps'`, `'TagPickerButtonProps'`, `'TagPickerControlProps'`, `'TagPickerGroupProps'`, `'TagPickerInputProps'`, `'TagPickerListProps'`, `'TagPickerOptionProps'` (23; the names a public declaration reaches through the exported `Dialog`, `Drawer`, `Nav` and `TagPicker` before INTEGRATION exports them). The types of TagGroup, InteractionTag, NavDrawer and Hamburger are reachable only from exports of wave D, and the `lib/types` unions are exported at once.
4. **`PENDING_FLAT_EXPORTS`** (`scripts/verify-dist.mjs:108`; its JSDoc gains "Phase 6 (0.11) lists `TagPicker`, and `Drawer` and `Nav` from the commits that attach their first new member"):
   ```js
   export const PENDING_FLAT_EXPORTS = [
     // 'Drawer', // P6-overlays uncomments this line in the commit that attaches Drawer.Header (spec rule 29)
     // 'Nav', // P6-nav uncomments this line in the commit that attaches Nav.SectionHeader (spec rule 29)
     'TagPicker', // exported, and a compound from wave C (P6-tagpicker): planned until then
   ];
   ```
5. **The bridge case of `scripts/__tests__/verify-dist.test.mjs`** (`:1322-1332`, "is closed: the list is empty …") becomes "is open for the Phase 6 compounds only, and the real exports pass outside final mode": the list is sorted, free of duplicates and a subset of `['Drawer', 'Nav', 'TagPicker']`; `checkFlatExports(mod).errors` is `[]`; `checkFlatExports(mod, { final: true }).errors` contains the message that starts `PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs still lists`. The second case (`:1334-1360`, only the bridge's own entries may be planned or pending) is unchanged. INTEGRATION restores the closed-bridge case in wave D.

### 1.6 Tokens: `src/styles/tokens.css` and `src/styles/__tests__/tokens.test.ts`

Four fill states for tags (D22; memo C9), declared in all three theme groups after `--wave-muted-foreground` and `--wave-selected-foreground`, and mapped in `@theme inline` (`--color-muted-hover: var(--wave-muted-hover);` and the three others):

| Token | Light (`:root, .wave-light`) | Dark (`.wave-dark, .dark`) | High contrast (`.wave-high-contrast, .high-contrast`) |
|---|---|---|---|
| `--wave-muted-hover` | `#e0e0e0` | `#424242` | `#333333` |
| `--wave-muted-pressed` | `#d1d1d1` | `#2e2e2e` | `#4d4d4d` |
| `--wave-selected-hover` | `var(--wave-brand-150)` (#cfe4fa) | `var(--wave-brand-40)` (#0c3b5e) | `#005259` |
| `--wave-selected-pressed` | `var(--wave-brand-140)` (#b4d6fa) | `var(--wave-brand-10)` (#061724) | `#006b75` |

Each group gets the comments "Fill states of neutral chips (Tag, InteractionTag; 0.11): `foreground` text only. `muted` → hover → pressed differ by at least 1.15:1." and "Fill states of `selected` (brand tags): `selected-foreground` text only." `tokens.test.ts` (append-only):

- `TOKENS` (resolved values): `'muted-hover': ['#e0e0e0', '#424242', '#333333']`, `'muted-pressed': ['#d1d1d1', '#2e2e2e', '#4d4d4d']`, `'selected-hover': ['#cfe4fa', '#0c3b5e', '#005259']`, `'selected-pressed': ['#b4d6fa', '#061724', '#006b75']`.
- `NOT_TEXT_TOKENS`: `'muted-hover'` and `'muted-pressed'`: "fill state of muted chips (Tag, InteractionTag), with foreground text (CONTRAST_PAIRS)"; `'selected-hover'` and `'selected-pressed'`: "fill state of selected (with selected-foreground)". They are not `TEXT_SURFACES`: `primary` text is 4.08 / 4.15:1 on `muted-hover` (light / dark) and `muted-foreground` 4.48:1 in dark, below the matrix's 4.5:1, and a light grey dark enough to be seen cannot keep every text token at 4.5:1 (`#ebebeb`, the darkest that does, is 1.05:1 from `muted`).
- `BOUND_TEXT_SURFACES['selected-foreground']`: `['selected']` → `['selected', 'selected-hover', 'selected-pressed']` (6.05 / 4.81 / 8.93:1 and 5.23 / 7.50 / 6.25:1).
- `CONTRAST_PAIRS`, each with a comment line (light / dark / high contrast, computed with the file's `contrastRatio` on the values above, checked for this spec):
  - `['ring', 'muted', 3]` — Tag's Dismiss ring on the filled chip and an InteractionTag's ring over its filled neighbour; 0.10 already relies on it and does not assert it (critic §4 #19): 4.72 / 4.18 / 16.21.
  - `['foreground', 'muted-hover', 4.5]` — 11.76 / 10.05 / 12.63; `['foreground', 'muted-pressed', 4.5]` — 10.17 / 13.58 / 8.45.
  - State steps that must be seen (1.15:1, a floor of this phase; 0.10's dismiss hover was 1.05:1): `['muted-hover', 'muted', 1.15]` 1.16 / 1.17 / 1.38; `['muted-pressed', 'muted-hover', 1.15]` 1.16 / 1.35 / 1.49; `['selected-hover', 'selected', 1.15]` 1.16 / 1.38 / 1.40; `['selected-pressed', 'selected-hover', 1.15]` 1.16 / 1.56 / 1.43; `['muted-hover', 'background', 1.15]` (an outline tag's Dismiss circle on the page) 1.32 / 1.45 / 1.66; `['muted-hover', 'input-filled-darker', 1.15]` (outline tags in a `filled-darker` TagPicker) 1.21 / 1.83 / 1.66.
- `TABLED_RATIOS` (two decimals): the eleven pairs above with their values.
- Not added (already asserted): `foreground` and `muted-foreground` on `input-filled-darker` and `input-filled-lighter` (the text matrix lists both fields as `TEXT_SURFACES`); `selected-foreground` on `selected`, `ring` on `selected`, `primary-foreground` on `primary`/`primary-hover`/`primary-pressed`, `ring` on `background`, `card` and the filled fields.

If a pair fails in a theme, stop and file a change request (the token value changes, not the pair). README "All 64 color tokens" becomes 68 (DOCS, §5.2).

### 1.7 `src/lib/icons.tsx` and `src/lib/__tests__/icons.test.tsx`

```tsx
/** Navigation glyph: three bars (Hamburger). */
export const NavigationIcon = /* @__PURE__ */ createIcon({
  name: 'navigation',
  displayName: 'NavigationIcon',
  viewBox: '0 0 20 20',
  defaultSize: 20,
  paint: 'fill',
  content: (
    <path d="M2.75 4.5h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5Zm0 4.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5Zm0 4.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5Z" />
  ),
});
```

Three 1.5px bars, 15.5px wide with round ends, centred at y 5.25, 10 and 14.75. `IconProps.size`'s JSDoc (`:11`) becomes "Default 16 (chevrons 12, the navigation glyph 20)." `icons.test.tsx`'s `ICONS` (25 rows today) gains `['NavigationIcon', 'navigation', 20]` in module order, so "covers every export of the icons module" and every per-icon case (accessibility defaults, `currentColor`, `displayName`, the tree-shaking annotation) cover it. No back-arrow glyph: `Drawer.HeaderNavigation` renders consumer content (P6-05).

### 1.8 `src/components/button/Toolbar.navigation.ts` (new) and `Toolbar.tsx`

```ts
import type { Orientation } from '../../lib/types';
import { useRovingTabIndex, type RovingContainerProps } from '../../hooks/useRovingTabIndex';

/**
 * Every focusable control a toolbar can contain, whatever component renders it (Toolbar,
 * TagGroup, and NavDrawer.Body's arrow mode). Matches that cannot take focus (a `type="hidden"`
 * input, a control CSS hides) are dropped by the roving hook.
 */
export const TOOLBAR_ITEM_SELECTOR =
  'button, [href], input, select, textarea, [role="button"], [tabindex]';

/** Options of {@link useToolbarNavigation}. */
export interface UseToolbarNavigationOptions {
  /** The arrow-key axis: Left/Right (mirrored in RTL) when horizontal, Up/Down when vertical. */
  orientation: Orientation;
}

/**
 * The one roving configuration of an APG toolbar (`buttons-22`), shared by Toolbar and TagGroup:
 * one Tab stop (the last focused control, at first the first enabled one), the arrow keys along
 * `orientation` only, Home and End, wrapping. The caller merges `containerProps.ref` with its own,
 * renders `data-roving-container`, composes its consumer's `onKeyDown` first and `onFocus` with
 * `checkDefaultPrevented: false`. Not spreading `containerProps` detaches the container, and the
 * hook then hands every control its own `tabIndex` back.
 */
export function useToolbarNavigation({ orientation }: UseToolbarNavigationOptions): {
  containerProps: RovingContainerProps;
} {
  const { containerProps } = useRovingTabIndex({
    itemSelector: TOOLBAR_ITEM_SELECTOR,
    manageTabIndex: true,
    tabStop: 'last-focused',
    orientation,
  });
  return { containerProps };
}
```

`Toolbar.tsx` drops its own selector (`:89-94`) and its `useRovingTabIndex` call (`:123-128`) for `const { containerProps } = useToolbarNavigation({ orientation });`; everything else stays (the consumer `onKeyDown` first, `onFocus` with `checkDefaultPrevented: false`, `role ?? 'toolbar'`, `aria-orientation ?? orientation`, the attribute order). The module imports nothing but the hook and the type (so an import of only `Tag` never reaches it, and TagGroup's and NavDrawer's imports pull no Toolbar code). Guard: every `Toolbar.test.tsx` and `Toolbar.parts.test.tsx` case passes unchanged; the Toolbar × TagGroup matrix is P6-tags' (D31).

### 1.9 `src/hooks/useRovingTabIndex.ts`: the hand-back fix

Today the store hands back the stamps it wrote only for elements that move into a nested composite (`release`, `:578-594`); `setContainer(null)` (`:445-453`) disconnects without restoring, so a container that stops being one (a TagGroup switched from toolbar to list, D31; a NavDrawer.Body switched from `'arrow'` to `'tab'`, D131) leaves every control at `tabindex="-1"` but one. The fix:

1. **When the container changes** (`setContainer` with an element other than the current one, `null` included) and **when `manageTabIndex` turns `false`** (`setOptions`), the store first restores every element it stamped inside the current container: the `tabindex` attribute read at its first stamp is put back (or removed when there was none), a `data-roving-value` the hook added (`auto-<n>`) is removed, a value React rendered is left alone, and the element's record is dropped. The elements are found as `release` finds them (`container.querySelectorAll(itemSelector)` against the `stamped` WeakMap), before `this.container` is replaced.
2. The last-focused value and the generated `auto-<n>` values are kept, so a container that attaches again starts where it was.
3. A public hook: a CHANGELOG "Fixed" entry (§5.1).

Tests (`src/hooks/__tests__/useRovingTabIndex.test.tsx`, through probe components): "hands every stamped element its own tabIndex back when the container ref detaches"; "removes the data-roving-value it added and keeps one React rendered"; "removes tabindex from an element that had none"; "hands the elements back when manageTabIndex turns false"; "stamps again when the container attaches again, with the last focused item as the Tab stop"; "StrictMode's ref double call ends stamped". Every 0.10 case passes unchanged (none asserts a stale stamp), and so do the Toolbar, SwatchPicker, Menu, TabList, Tree, RadioGroup and List suites.

### 1.10 `src/components/data-display/Avatar.context.ts` (new) and `Avatar.tsx`

```ts
import * as React from 'react';

/** The box a container gives the Avatars inside it that set no `size` (Tag and InteractionTag media). Internal. */
export interface AvatarSizeContextValue {
  /** The box: 24px (Avatar's `extra-small`), or the internal 20px and 16px boxes. */
  size: 16 | 20 | 24;
}

/** Internal: provided by Tag and InteractionTag.Primary around their `media`; `null` elsewhere. */
export const AvatarSizeContext = React.createContext<AvatarSizeContextValue | null>(null);
AvatarSizeContext.displayName = 'AvatarSizeContext';
```

`Avatar.tsx`: `size = 'medium'` (`:195`) becomes `size: sizeProp`; the visual's size classes are `sizeProp !== undefined ? avatarSizeClasses[sizeProp] : box ? AVATAR_BOX_CLASSES[box.size] : avatarSizeClasses.medium`, with `box = React.useContext(AvatarSizeContext)` and the module constant `AVATAR_BOX_CLASSES = { 24: avatarSizeClasses['extra-small'], 20: 'w-5 h-5 text-[10px]', 16: 'w-4 h-4 text-[10px]' }` (the person glyph stays 60%; with a badge the visual is sized, not the wrapper). An Avatar's own `size` wins; outside the context every Avatar renders its 0.10 classes; Avatar renders no `data-size` (none in 0.10). AvatarGroup and Persona pass `size` and are unchanged. Tests (`Avatar.test.tsx`): "an Avatar without size takes the box of AvatarSizeContext (24, 20, 16px)"; "its own size wins over the context"; "outside the context it keeps the medium classes"; "with a badge the visual is sized, not the wrapper".

**Resolution:** the lead memo placed the context in `Avatar.tsx`; the tags author asked for a module of its own. It is `Avatar.context.ts` (one-way imports, the `SwatchPicker.context.ts` precedent), so Tag and InteractionTag import the context without `Avatar.tsx`, and an import of only `Tag` holds no Avatar code (D17).

### 1.11 `src/components/input/Option.tsx`: `ListboxSurface listProps`

```ts
/** Attributes of the list element that ListboxSurface renders (see `listProps`). */
export type ListboxSurfaceListProps = Omit<
  React.HTMLAttributes<HTMLUListElement>,
  | 'role' | 'id' | 'hidden' | 'tabIndex' | 'className'
  | 'aria-label' | 'aria-labelledby' | 'aria-multiselectable' | 'aria-activedescendant'
> & {
  /** Ref to the `role="listbox"` element (it moves between the picker and the popup). */
  ref?: React.Ref<HTMLUListElement>;
};

// ListboxSurfaceProps gains:
/**
 * Attributes spread onto the list element before the listbox's own (`role`, `id`, `tabIndex`,
 * `aria-multiselectable` and `hidden` win): `data-*` and other `aria-*` attributes, `style`, and
 * handlers, composed before the listbox's own `onMouseDown`. `ref` is merged with the list's.
 * Name the list with `aria-label`/`aria-labelledby` (the props above), not here.
 */
listProps?: ListboxSurfaceListProps;
```

Rendering (`Option.tsx:738-754`): `const { ref: listRefProp, onMouseDown: listMouseDown, ...listRest } = listProps ?? {}`, `const listboxProps = listbox.getListboxProps()`, `const listRef = useMergedRefs(listRefProp, listboxProps.ref)`, then `<ul {...listRest} {...listboxProps} onMouseDown={composeEventHandlers(listMouseDown, listboxProps.onMouseDown)} ref={listRef} aria-label={…} aria-labelledby={…} hidden={…} className={…}>`. Combobox, Dropdown, Listbox, TimePicker and TagPicker (0.10) pass nothing and render the same DOM. `ListboxSurfaceListProps` is exported from `src/components/input/index.ts` next to `ListboxSurfaceProps` (rule 27), with an `expectTypeOf` line in `public-types.test.ts` (the walker requires it). Tests (`Option.test.tsx`): "ListboxSurface spreads listProps onto the list, and its own attributes win"; "listProps.ref receives the list, hidden in place and in the popup"; "composes listProps.onMouseDown before the list's own (its preventDefault keeps focus)"; "a style in listProps reaches the list".

**Resolution:** the lead memo's `listRef` and `listStyle` are replaced by `listProps` (the TagPicker author's request): `TagPicker.List` needs `ref`, `style` and rest props on its `<ul>` (C-REF; `testSystemProps` puts `data-testid` and `aria-label` there), and only `ListboxSurface` renders a list without checks (`OptionCheckContext` is module-private). One additive prop covers the three.

### 1.12 `src/components/input/Combobox.expand.tsx`: `PickerExpandButton dimDisabled`

```ts
// PickerExpandButtonProps gains:
/**
 * The button dims itself while disabled (`disabledStyles`). `false` leaves the dimming to a field
 * that dims as a whole (TagPicker's control) and keeps only the not-allowed cursor.
 * @default true
 */
dimDisabled?: boolean;
```

Its class list (`:108-115`) takes `dimDisabled ? disabledStyles : 'disabled:cursor-not-allowed'` in place of `disabledStyles`. Module-only (no CHANGELOG entry). Tests (new `src/components/input/__tests__/Combobox.expand.test.tsx`): "PickerExpandButton dims itself while disabled by default"; "dimDisabled={false} keeps only the not-allowed cursor"; "passes a className first, so a positioning class of the host stays" (`top-1.5` with the medium box). Combobox and TimePicker pass nothing; their suites are the guard.

**Resolution:** the lead memo's conditional `placement` option is not added: TagPicker keeps its end buttons `absolute` against a `relative` control and centres them on the first row with a `top-*` class through `className` (first in `PickerExpandButton`'s `cn()`, conflicting with nothing in `PICKER_ICON_BUTTON_CLASSES`, `pickerStyles.ts:16-17`; D61). What it needs instead is a button that does not dim twice inside a dimmed control (D66: nested opacities multiply to 0.25).

### 1.13 What the foundation does not do

- No change to `useModalLayer.ts`, `useRestoreFocus.ts`, `useFocusTrap.ts`, `Dialog.shared.tsx`, `Toaster.tsx` (P6-overlays, D3), to the Tag or TagGroup contexts (P6-tags), or to `Nav.tsx` (P6-nav). The cross-cutting research's foundation-owned overlay seam is not used (D3).
- No shared story argTypes in `stories/_helpers.ts`: each package declares the new `size`, `appearance`, `shape`, `type` and `modalType` argTypes in its own stories (Phase 1 rule 10).
- No barrel export but `ListboxSurfaceListProps` (§1.11); no `src/index.ts` change (`export type * from './lib/types'` carries §1.1).
- No internal-helper list entries in `integration.test.tsx` for the module-only exports of wave A (`useToolbarNavigation`, `TOOLBAR_ITEM_SELECTOR`, `AvatarSizeContext`, `hasIsolatingModalBelow`): INTEGRATION adds them with the others (§4.5).

### 1.14 Exit criteria of wave A

With `export PATH=/opt/node24/bin:$PATH`: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (every 0.10 suite passes with only the edits of §1.1, §1.5 and §6.4's foundation list: `types.test.ts`, `public-types.test.ts`, `Dialog.test.tsx:2145-2147`, `classNames.test.ts`, `integration.test.tsx`, `verify-dist.test.mjs`, plus the new cases), `npm run build` (with `node scripts/build-css.mjs` and the non-final `verify-dist`: the bridge lists `'TagPicker'`, reported as planned), `npm run build-storybook`; the conventions gate is clean for the foundation's files (`Toolbar.tsx`, `Toolbar.navigation.ts`, `Avatar.tsx`, `Avatar.context.ts`, `Option.tsx`, `Combobox.expand.tsx`, `SwatchPicker.tsx`, `SwatchPicker.context.ts`, `Accordion.tsx`). The lead commits the package before wave B starts.

### 1.15 Requests reconciled

How the four handoffs' requests to the foundation were settled (the item sections and §4 follow these):

1. **Avatar context location** — `Avatar.context.ts`, not `Avatar.tsx` (§1.10).
2. **`ListboxSurface`** — `listProps` replaces `listRef` and `listStyle`; `ListboxSurfaceListProps` is public and exported in wave A (§1.11).
3. **`PickerExpandButton`** — `dimDisabled` replaces `placement` (§1.12).
4. **`PENDING_FLAT_EXPORTS`** — the overlays and Nav handoffs asked the foundation to list `'Drawer'` and `'Nav'`; that fails `checkFlatExports` while both are complete compounds (D10), so they are commented placeholders that `P6-overlays` and `P6-nav` uncomment in their attaching commits (§1.5.4).
5. **`PENDING_CLASS_NAMES` removals** — the overlays and Nav handoffs had each package remove its entries in wave B; two packages would then edit one test file, so nobody edits the list before INTEGRATION (D10).
6. **Tag token pairs requested by the TagPicker research** — already asserted by the text matrix; not duplicated (§1.6).
7. **`SurfaceSize`** — Drawer and Dialog both use it, so it is in `lib/types` (memo §C's condition holds); `BackdropAppearance` joins it.
8. **Icons** — the navigation glyph only; no back arrow (§1.7).
9. **`FocusMode`** — retyped in `SwatchPicker.tsx` and in `SwatchPicker.context.ts`, which declares the same union (§1.1.2).
10. **Shared argTypes** — none (§1.13).
11. **`TagGroupHostOptions.dimDisabled`** (the TagPicker handoff's request R-T1 to P6-tags) — accepted; `P6-tags` delivers it in its step 2 as part of the frozen host seam (§4.1, T-T7).
12. **Test files a wave-B package must touch outside its folder** — `P6-overlays` edits the two backdrop lookups of `integration.test.tsx` (`:2504`, `:2606`) in its P6-06 task; `P6-nav` edits the `INTERNAL_HELPERS` key of `public-types.test.ts` (`:424-425`) in its first task and adds a row to `exportDocblocks.test.ts` (`:341-345`) in its `Nav.AppItem` task. Each is that file's only wave-B editor (§3.1).

---

## 2. Items

The items in package order: P6-tags (P6-01 → P6-03), P6-tagpicker (P6-04), P6-overlays (P6-05 → P6-07), P6-nav (P6-09) and P6-navdrawer (P6-08).

<!-- §2 item sections of P6-tags (P6-01, P6-02, P6-03). Rulings D20–D47 (reserved range D20–D49). -->

**Order inside P6-tags (lead memo C4).** One package, one working tree, four steps, each green before the next: (1) P6-01, the Tag look, props and slots, with `tagStyles.ts`; (2) P6-02's dismissal half: `TagGroup.context.ts`, `TagGroup` with both roles, the arrow-key rule, inheritance, Delete and Backspace, `onDismiss`, focus after a removal and the host seams of D36; (3) P6-03, InteractionTag; (4) P6-02's selection half: `value`/`defaultValue`/`onValueChange`, D39 and the forms of D40, which need InteractionTag. `Tag.tsx`, `Tag.test.tsx` and `stories/Tag.stories.tsx` are edited in steps 1, 2 and 3; nobody else edits them in wave B. The seams P6-04 reads (§4) are complete after step 2 and frozen from then on.

### P6-01 — Tag `appearance`, `size`, `disabled`, `shape`, slots and selection (P6-tags)

A Tag gets Fluent's three appearances (`filled`, `outline`, `brand`), three sizes (`medium` keeps the 0.10 28px box, `small` 24px, `extra-small` 20px), two shapes (`circular`, the 0.10 pill, stays the default), `disabled` (the Dismiss button natively disabled with the tag), a look-only `selected`, a `value` for TagGroup, and the slots `media` (an Avatar sized for the tag), `icon` and `secondaryText`. The tag itself stays non-interactive and keeps its separate Dismiss button, named after the tag's text only. Every prop is optional and a Tag without them renders the 0.10 box; the one change of construction is a 1px border on every appearance with the padding reduced by 1px. Four state tokens are added for hover and pressed fills, which also fixes the near-invisible 0.10 dismiss hover.

**Closes:** `tag-1` (M), `tag-2` (M), `tag-3` (M), `tag-5` (L), `tag-6` (L), `tag-7` (L).
**Guards:** Tag dismiss buttons are named after their tag, also with `media` and `secondaryText` (`Tag.test.tsx` › "names the dismiss button after the primary text only, with media, icon and secondary text"; the 0.10 suites `dismiss button name (data-display#10)` and `dismiss name from a merged button with a text label …` unchanged).

#### Rulings

- **D20 — The 0.10 Tag is the default.** Every new prop is optional and its default is the 0.10 look: a Tag without them is 28px tall, 12px from its edge to the text (6px after the Dismiss button, 12px without one), `bg-muted text-foreground`, `rounded-full`, `text-body-1`, with a 4px gap. One change of construction: every appearance draws a 1px border (transparent unless `outline` or selected), and every inset shrinks by that pixel, so the outer metrics stay: `py-1` becomes `min-h-7` with `items-center`, `ps-3` becomes `ps-2.75`, `pe-1.5` becomes `pe-1.25`, `pe-3` becomes `pe-2.75`. One test pins the exact default class list and attributes (Phase 4 rule 14). *Why:* principle 2; filled and outline tags of one size get one box (Button's transparent border, `buttonStyles.ts` `buttonAppearanceClasses`); forced colours draw a transparent border, so every tag gets a visible edge there.
- **D21 — Sizes: one table, in `tagStyles.ts`.** `size?: TagSize` (`'extra-small' | 'small' | 'medium'`, default `'medium'`) picks every metric of the table in DOM and classes below: `medium` is the 0.10 28px box (Avatar media 24px), `small` 24px (Avatar 20px), `extra-small` 20px (Avatar 16px). The table lives in `src/components/data-display/tagStyles.ts` (module-only, as `buttonStyles.ts`), and Tag, InteractionTag (D46) and TagPicker's tags (P6-04, through Tag's `size`) all read it. Fluent's medium tag is 32px with a 28px Avatar: recorded in roadmap §8.3 and nominated as an open question (§8), with this ruling as the recommendation. *Why:* lead memo C2; Phase 4 rule 14 and Checkbox D14 (a kept default box); a 28px medium needs no third internal Avatar box (Fluent's 28px Avatar).
- **D22 — Appearances and four state tokens.** Tokens only (C-TOKENS); the look per state is the table in DOM and classes.
  - `filled` (default): `bg-muted text-foreground`, transparent border. `outline`: `bg-transparent text-foreground border-stroke` (decorative: the tag is not a control; Fluent's `colorNeutralStroke1`). `brand`: `bg-selected text-selected-foreground`, transparent border: brand 160 on brand 60 in light, so it follows a custom `--brand-*` ramp, and the pair is asserted (7.03, 6.62, 12.51:1). Selected (D26): `bg-primary text-primary-foreground border-primary`, over every appearance.
  - Four new tokens, in all three theme groups, mapped in `@theme inline`: `--wave-muted-hover` (#e0e0e0 / #424242 / #333333), `--wave-muted-pressed` (#d1d1d1 / #2e2e2e / #4d4d4d), `--wave-selected-hover` (`var(--wave-brand-150)` #cfe4fa / `var(--wave-brand-40)` #0c3b5e / #005259), `--wave-selected-pressed` (`var(--wave-brand-140)` #b4d6fa / `var(--wave-brand-10)` #061724 / #006b75) (light / dark / high contrast). They are fill states that carry only `foreground` (muted) or `selected-foreground` (selected) text: `foreground` reaches 11.76 / 10.05 / 12.63:1 on `muted-hover` and 10.17 / 13.58 / 8.45:1 on `muted-pressed`; `selected-foreground` 6.05 / 4.81 / 8.93:1 on `selected-hover` and 5.23 / 7.50 / 6.25:1 on `selected-pressed`. Each step differs from the fill it leaves by at least 1.15:1 (hover on rest 1.16 / 1.17 / 1.38 and 1.16 / 1.38 / 1.40; pressed on hover 1.16 / 1.35 / 1.49 and 1.16 / 1.56 / 1.43). They are not general text surfaces: `primary` text falls below 4.5:1 on `muted-hover` (4.08 in light, 4.15 in dark) and `muted-foreground` in dark (4.48), so they are classified as fill states, not `TEXT_SURFACES` (§1); a light value dark enough to be seen cannot keep every text token at 4.5:1 (`subtle-pressed` #ebebeb, the darkest grey that does, is 1.05:1 from `muted`).
  - The Dismiss button's hover and pressed fills: `muted-hover`/`muted-pressed` on `filled` and on `outline` tags (an outline tag is transparent, so its circle must show on the page, a card and a filled field: 1.32 / 1.45 / 1.66:1 on `background`, 1.21 / 1.83 / 1.66:1 on `input-filled-darker`), `selected-hover`/`selected-pressed` on `brand` tags, `primary-hover`/`primary-pressed` on selected tags.
  - **Fixed:** 0.10's dismiss hover, `subtle-pressed` on `muted`, is 1.05:1 in light (1.16 in dark): almost invisible. It becomes `muted-hover` (CHANGELOG "Fixed").
  - *Why:* lead memo C9; the brand tint is the token Wave already uses for a brand-tinted state and follows the ramp, where `info-tint` is a fixed hex; P6-02's "darker in dark only" note was wrong, the problem is the ratio (critic C9).
- **D23 — `shape`: `circular` stays the default.** `shape?: TagShape` (`'rounded' | 'circular'`): `circular` is `rounded-full` (the 0.5 pill), `rounded` is `rounded` (4px, Tailwind's default name, C-RADIUS; Fluent's `borderRadiusMedium`). The Dismiss button stays `rounded-full` in both shapes. An Avatar in `media` stays circular in a rounded tag until P8-01 adds Avatar shapes (Fluent maps a rounded tag to a square Avatar). Fluent's default is `rounded`: recorded in roadmap §8.3. *Why:* the roadmap's API sketch ("default `'circular'`, the 0.5 pill"); principle 2.
- **D24 — `disabled`.** `disabled?: boolean` (default `false`; a TagGroup's `disabled` also disables it, D32) dims the tag and natively disables its Dismiss button, whatever `dismissIcon` passes: the tag's `disabled` is spread last, after the merged slot props and in place of `MERGED_DISABLED_FOCUSABLE_PROPS` (`Tag.tsx:493` today), with `aria-disabled`, `data-disabled` and `data-disabled-focusable` removed from the button. So a merged `disabledFocusable` Button, a merged `<button disabled={false}>` and the deprecated `{ disabled: false }` object cannot re-enable it; click, Enter, Space, Delete and Backspace do nothing (a natively disabled button dispatches no click, and React calls no `onClick`), and Tab skips it. The root renders `data-disabled` and no `aria-disabled` (ARIA 1.2 does not allow it on a generic `span`). The root carries the dimming (`opacity-50`, lifted by `has-focus-visible:opacity-100` while a focus ring shows inside, D25) and `forcedColors.disabled`; the Dismiss button then drops its own `disabled:opacity-50` and `aria-disabled:opacity-50`, so nothing is dimmed twice. Disabled wins over the selected look (D26). *Why:* the roadmap's acceptance "the dismiss button disabled with the tag"; Fluent's disabled tag is a natively disabled button; C-DISABLED (the ring lift).
- **D25 — A tag control disabled while it has focus keeps focus until focus leaves it.** Applies to Tag's Dismiss button, `InteractionTag.Primary` and `InteractionTag.Secondary`, whatever disables them (their own `disabled`, the InteractionTag's, the TagGroup's): each control tracks whether it has focus (its own `onFocus`/`onBlur`, events whose target is the control itself, composed with `checkDefaultPrevented: false`); when its effective `disabled` turns `true` during a render in which it has focus, it renders `MERGED_DISABLED_FOCUSABLE_PROPS` (`aria-disabled`, `data-disabled`, `data-disabled-focusable`, `disabled: false`, the click prevented and stopped) instead of the native `disabled`, and keeps that state until it loses focus, when it becomes natively disabled. The state is adjusted during render from the previous `disabled` (C-HOOKS), never in an effect; one internal hook in `TagGroup.context.ts` serves the three controls. While held, Enter, Space, Delete and Backspace do nothing (D33's `.click()` is blocked), the dimmed look lifts while the ring shows, and a toolbar TagGroup keeps the control in its arrow order (`data-disabled-focusable`, `useRovingTabIndex`). *Why:* lead memo ("disabling a Tag or a TagGroup while focus is on its dismiss button must not drop focus to `<body>`"); the HTML focus fixup drops focus from a control that becomes disabled; a rule local to the control works for a standalone Tag, which has no neighbour to move to, and inside a TagGroup and a TagPicker alike; C-DISABLED's focusable-disabled form, which APG allows.
- **D26 — `selected` and `value`.** `selected?: boolean` (default `false`) draws the selected look and sets `data-selected`; it carries no ARIA: a Tag is not interactive, a plain Tag is never selectable (TagGroup selects InteractionTags only, D38), and the JSDoc points to InteractionTag for a pressed state that is announced. The selected look wins over `appearance`, disabled wins over it (both `data-*` attributes still render: they reflect the props). `value?: string` identifies the tag in a TagGroup (`onDismiss`, D34) and renders nothing on the default `<span>`. **Shadowed attributes.** `PolymorphicProps` removes element attributes named like own props, so `disabled` and `value` (and `size`, `shape`, `selected`) are Tag props now: Tag forwards `disabled` to a rendered element that takes it natively (`as` is `'button'`, `'fieldset'`, `'input'`, `'optgroup'`, `'option'`, `'select'` or `'textarea'`) or to a component (`as` is not a string), and `value` likewise (`'button'`, `'data'`, `'input'`, `'li'`, `'meter'`, `'option'`, `'output'`, `'progress'`, `'select'`, `'textarea'`, or a component); never to the default `<span>` or an `<a>`. `TagProps<'li'>['value']` narrows from `string | readonly string[] | number` to `string` (CHANGELOG "Types": pass `String(n)`). `size`, `appearance`, `shape`, `selected`, `media`, `icon` and `secondaryText` are the Tag's and no longer reach an `as` component. *Why:* lead memo C1 (`aria-pressed` on a `span` is not allowed, and on the Dismiss button it would mean the wrong thing); keeps the 0.10 DOM of `<Tag as="button" disabled value="x">`; no invalid attributes on spans and anchors; principle 2 forbids a silent narrowing, hence the Types note.
- **D27 — The slots `media`, `icon` and `secondaryText`, and the layout.**
  - `media?: Slot<'span'>` (an Avatar, usually) and `icon?: Slot<'span'>` are plain content slots: they replace no default glyph, so none of Phase 1 D21's kinds applies, and a value that renders nothing (`slotRendersContent`: `''`, `[]`, `<></>`, a generator of nothing) renders no element and takes no room. `icon` is decorative (`aria-hidden`, rendered in a 20, 16 or 12px box whose `<svg>` fills it). `media` is **not** `aria-hidden` in a Tag: an Avatar names itself, and the JSDoc says to pass `decorative` to an Avatar that repeats the tag's text, as Persona does (lead memo C7). Both together render side by side (media first); the JSDoc says to use one.
  - **Avatar sizing.** Tag renders `media` inside the foundation's internal `AvatarSizeContext` (§4) with the size of the table (24, 20 or 16px). An Avatar without its own `size` takes it; an Avatar with a `size` keeps it; an Avatar in `children` is not resized. With a badge the Avatar's visual is sized, not its wrapper; a `PresenceBadge` is sized by hand (`size="extra-small"`; badge sizing is `avatar-7`, P8-01).
  - `secondaryText?: React.ReactNode` is a second line under the text, its colour inherited (Fluent). Only while it renders content (`materialiseSlotContent` + `slotRendersContent`, as CompoundButton), the primary and secondary text sit in a column wrapper (`<span class="inline-flex min-w-0 flex-col text-start">`, a layout wrapper with no class: Phase 3 judgement 27, Persona's text column); the primary text takes `text-caption-1 leading-3.5` and the secondary `text-caption-2 leading-3` (26px of lines in the 28px box; a small or extra-small tag grows to 28px). Without it the DOM is 0.10's: the primary text is a direct child of the root.
  - **Name guard.** `contentId` stays on the primary text span only, so the Dismiss button's name is `dismissLabel` plus the primary text ("Dismiss Cherry") with every slot set: an Avatar's `role="img"` name, the icon and the secondary text never enter it. A tag whose only content is `media` names its button "Dismiss" (the JSDoc says to give the tag text).
  - The root stays `inline-flex items-center`; long text still wraps and grows the tag, as in 0.10 (Fluent's tags never wrap).
  - *Why:* `tag-6`; Fluent's slot names and order (media, icon, primary text, secondary text, dismiss); the roadmap guard; one layout whose 0.10 markup is unchanged when the new slots are unused, where a two-row grid (the research's alternative) needs explicit rows per present part and distributes a spanning Avatar's height unevenly; Phase 3 judgement 20 (`primaryText`/`secondaryText`).
- **D28 — The Dismiss button stays a separate button.** The tag is not interactive; its Dismiss button is its own `<button type="button">` after the content, named "Dismiss <text>" (0.5 C-SLOTS rule, `labelInName`). Fluent's dismissible Tag is one `<button>` that dismisses on click, Enter, Space, Delete and Backspace, with a decorative dismiss icon: not adopted, recorded in roadmap §8.3. The button gets a 24×24px pointer target at every size: `relative` plus a transparent layer (`before:absolute before:-inset-0.5` on the 20px button, `before:-inset-1` on the 16px one; at `extra-small` it reaches 2px above and below the tag, as Fluent's pseudo-elements do). Its glyph takes the tag's text colour (`text-inherit`, set explicitly: C-NATIVE; 0.10 drew `text-foreground`, which a brand or selected tag cannot keep). Its focus ring is `focusRing`, drawn on the tag's own fill: `outline-primary-foreground` on a selected tag (the default `ring` is the primary fill itself, 1.00:1 in light), and an offset of 0 at `extra-small` (`focus-visible:outline-offset-0`: with 2px of room above and below the 16px button, a 2px offset would put the ring on the page). *Why:* WaveUI strength ("each dismiss button is named after its tag"); a click on a tag's text must not delete it; link chips (`as="a"`) keep working; roadmap principle 3 and WCAG 2.5.8 (today's 20px button has no 24px target); WCAG 2.4.7.
- **D29 — Forced colours.** The transparent border shows as the tag's edge. Selected: `forcedColors.selectedContainer` (a 2px inset Highlight outline), not Fluent's Highlight fill with `forced-color-adjust: none`, which would reach the Avatar, the icon and the Dismiss button (the recipe forbids `selectedLeaf` on containers). Disabled: `forcedColors.disabled` on the root (GrayText text and border); the natively disabled button draws GrayText itself. The Dismiss glyph turns Highlight on hover (`forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]`, Fluent's), since its hover fill becomes Canvas. *Why:* `src/lib/styles.ts` `forcedColors` (container rule); the selected state must not depend on a fill that forced colours remove.

#### API

```ts
// src/lib/types.ts (F6-foundation, §1; exported by `export type * from './lib/types'`)
/** Size of a tag (Fluent's `TagSize`): `extra-small` (20px tall), `small` (24px) or `medium` (28px). */
export type TagSize = Extract<Size, 'extra-small' | 'small' | 'medium'>;
/** Colour scheme of a tag (Fluent's `TagAppearance`): a neutral fill, a border, or a light brand tint. */
export type TagAppearance = 'filled' | 'outline' | 'brand';
/** Corners of a tag (Fluent's `TagShape`): `circular` (a pill) or `rounded` (4px). */
export type TagShape = Extract<Shape, 'rounded' | 'circular'>;

// src/components/data-display/Tag.tsx — TagOwnProps gains (0.10 members keep their types)
export interface TagOwnProps {
  /**
   * Colour scheme: `filled` (a neutral fill), `outline` (a border on the surface behind it) or
   * `brand` (a light brand tint that follows the brand ramp). Inside a TagGroup, the group's
   * `appearance` is the default.
   * @default 'filled'
   */
  appearance?: TagAppearance;
  /**
   * `medium` (28px tall, the 0.10 look), `small` (24px) or `extra-small` (20px); an Avatar in
   * `media` is 24, 20 or 16px. Fluent's medium tag is 32px. Inside a TagGroup, the group's `size`
   * is the default.
   * @default 'medium'
   */
  size?: TagSize;
  /**
   * `circular` (a pill, the 0.10 look) or `rounded` (4px corners). Fluent's default is `rounded`.
   * Inside a TagGroup, the group's `shape` is the default.
   * @default 'circular'
   */
  shape?: TagShape;
  /**
   * Dims the tag and disables its Dismiss button natively (no `onDismiss`, out of the Tab
   * order), whatever `dismissIcon` passes. A disabled TagGroup disables every tag. A Dismiss
   * button that has focus when the tag is disabled keeps it, unavailable, until focus leaves it.
   * Rendered as `data-disabled`. With `as`, an element that takes a native `disabled` (a
   * `<button>`) still receives it; a link is not disabled.
   * @default false
   */
  disabled?: boolean;
  /**
   * Draws the selected look (the brand fill) and sets `data-selected`. A Tag is not interactive,
   * so the state is not announced: for a tag the user selects, use `InteractionTag` (its
   * `InteractionTag.Primary` is a toggle button). Disabled wins over the selected look.
   * @default false
   */
  selected?: boolean;
  /**
   * Identifies the tag in a TagGroup: the value its `onDismiss` receives. Renders nothing on the
   * default `<span>`; with `as`, an element that takes a native `value` (a `<button>`, an `<li>`)
   * still receives it.
   */
  value?: string;
  /**
   * A visual before the text, usually an `Avatar`, which takes the tag's size (24, 20 or 16px)
   * unless it sets its own `size`. Not interactive. It is not hidden from assistive technology:
   * pass `decorative` to an Avatar whose name repeats the tag's text. Use `media` or `icon`, not
   * both.
   */
  media?: Slot<'span'>;
  /** A decorative icon before the text (`aria-hidden`), in a 20, 16 or 12px box. */
  icon?: Slot<'span'>;
  /**
   * A second, smaller line under the text (`secondaryText="Designer"`). It is not part of the
   * Dismiss button's name. A small or extra-small tag grows to 28px to fit it.
   */
  secondaryText?: React.ReactNode;
  /**
   * Whether the tag renders a Dismiss button. `onDismiss` and `dismissIcon` take effect only with
   * it (a development warning says so). Inside a TagGroup, the group's `dismissible` is the
   * default; `dismissible={false}` opts a tag out.
   */
  dismissible?: boolean;
  /**
   * Called when the Dismiss button is activated: a click, Enter, Space, Delete or Backspace (a
   * held key dismisses once). Passing it does not render the button: set `dismissible` too. In a
   * TagGroup the group's `onDismiss(value)` is called after it, and focus moves to the next tag
   * when the tag is removed. A standalone Tag cannot keep focus once you remove it: move focus
   * yourself (see "Focus after dismissal" on {@link Tag}).
   */
  onDismiss?: () => void;
  // dismissIcon, dismissLabel: 0.10 types and JSDoc; dismissLabel's JSDoc adds "TagPicker names
  // the Dismiss buttons of the tags it renders itself with its `labels.remove`."
}
```

The component docblock keeps its 0.10 bullets, adds the look and slot props, replaces "TagGroup (planned) will do this for you" by "In a TagGroup, focus moves to the next tag for you", and keeps the standalone recipe ("move focus to the next tag's Dismiss button, else the previous one, else a nearby control, then remove the tag").

`tagStyles.ts` (new, module-only; class strings stay literal for Tailwind's scanner) holds the table of D21, the looks of D22, the shapes of D23, the Dismiss button classes, the Avatar box per size (`TAG_AVATAR_SIZE: Record<TagSize, 16 | 20 | 24>`, `{ medium: 24, small: 20, 'extra-small': 16 }`) and InteractionTag's button looks (D46). One export is a frozen seam for P6-04 (§4): `tagRootClasses(options: { size: TagSize; appearance: TagAppearance; shape: TagShape }): string`, the root look of a text-only, non-dismissible, unselected, enabled tag (no stable class: Phase 3 D4).

#### Behaviour

| Where | Key / action | Result |
|---|---|---|
| Dismiss button | Tab | reaches it (0.10); skipped while the tag is disabled (D24) |
| Dismiss button | Enter, Space, click | `onDismiss()`, then in a TagGroup the group's `onDismiss(value)` (D34) |
| Dismiss button | Delete, Backspace | the same, through the button's own click (D33; P6-02's half, also outside a TagGroup) |
| Tag root that has focus itself (a link chip, `as="a"`) | Delete, Backspace | clicks the tag's Dismiss button when there is one (D33) |
| Tag root | pointer | nothing (the tag is not a control); the Dismiss button's 24px target extends past its visible circle (D28) |

- **Focus.** The tag has no tab stop of its own (0.10). A control disabled while it has focus keeps it (D25). In a TagGroup, focus after a removal is the group's (D35); a standalone Tag moves no focus when it is removed (0.10), and its Dismiss button unmounting while it has focus (`dismissible` turning `false`) moves focus to the tag's own first focusable element when it has one (a link chip), else nothing.
- **ARIA.** No role on the root (`role="listitem"` in a list TagGroup, D30); no `aria-disabled`, `aria-selected` or `aria-pressed` on it. The Dismiss button: `aria-labelledby="{dismissLabelId or merged text id} {contentId}"` (0.10); under a host's `dismissName` (D36) `aria-label` only. Media is not hidden, the icon is.
- **Events (C-COMPOSE).** The Dismiss button's click and key handlers and the root's key handler ignore events whose target is not inside their element in the DOM (`isOwnEvent`); a merged slot button's handlers run first and `preventDefault()` skips ours (0.10).
- **Announcements.** None.
- **SSR and hydration.** No client-only state beyond 0.10's text-label observation of a merged button (`useSyncExternalStore`, the literal check on the server). The Avatar context is plain React context: an Avatar written in a Server Component and passed as `media` is a client reference rendered under Tag and sized the same.
- **RTL.** Logical classes only (`ps`/`pe`, `me`); no directional glyph.
- **Forced colours.** D29.
- **Reduced motion.** No motion is added (the Dismiss button has no transition, as in 0.10).
- **Development warnings** (from effects, `warnOnce`). Unchanged: `Tag:dismissIcon-button`, the deprecated button-object form (`warnDeprecated('Tag', …)`), `Tag:dismissIcon-name`, `Tag:dismiss-without-dismissible`, whose condition reads the effective value: it warns when the Tag sets no `dismissible`, is not in a TagGroup whose `dismissible` is `true`, and receives `onDismiss` or `dismissIcon` (exact 0.10 message). New: `Tag:nested-button` (D47). No warning for `media` with `icon` or for a text-less dismissible tag (documented).

#### DOM and classes

```html
<span class="wave-tag inline-flex items-center gap-1 min-h-7 border border-transparent rounded-full bg-muted text-body-1 text-foreground ps-px pe-1.25"
      data-size="medium" data-appearance="filled" data-shape="circular" data-wave-tag-item=""
      [data-selected=""] [data-disabled=""] [role="listitem"] [hidden]>   <!-- role and hidden from a TagGroup, D30, D36 -->
  <span class="wave-tag__media inline-flex shrink-0 me-1">…Avatar, 24px…</span>       <!-- media only -->
  <span class="wave-tag__icon inline-flex size-5 shrink-0 items-center justify-center [&>svg]:size-full" aria-hidden="true">…</span>  <!-- icon only -->
  <span class="inline-flex min-w-0 flex-col text-start">                                <!-- secondaryText only: layout wrapper, no class -->
    <span id="tag-content-…" class="wave-tag__primary-text inline-flex items-center gap-1 text-caption-1 leading-3.5">Katri</span>
    <span class="wave-tag__secondary-text text-caption-2 leading-3">Designer</span>
  </span>
  <button type="button" data-wave-tag-dismiss="" aria-labelledby="tag-dismiss-… tag-content-…"
          class="wave-tag__dismiss-button relative inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-inherit before:absolute before:-inset-0.5 …">
    <span id="tag-dismiss-…" class="sr-only">Dismiss</span>
    <svg data-wave-icon="dismiss" aria-hidden="true" class="wave-tag__dismiss-icon" …/>   <!-- 12px -->
  </button>
</span>
```

Metrics per size (`tagStyles.ts`; every inset includes the 1px border):

| | `medium` | `small` | `extra-small` |
|---|---|---|---|
| Height | 28px `min-h-7` | 24px `min-h-6` | 20px `min-h-5` |
| Text | `text-body-1` (14/20) | `text-caption-1` (12/16) | `text-caption-1` |
| Start inset before the text | 12px `ps-2.75` | 8px `ps-1.75` | 8px `ps-1.75` |
| Start inset before an icon | 8px `ps-1.75` | 6px `ps-1.25` | 6px `ps-1.25` |
| Start inset before media | 2px `ps-px` | 2px `ps-px` | 2px `ps-px` |
| End inset after the text | 12px `pe-2.75` | 8px `pe-1.75` | 8px `pe-1.75` |
| End inset after the Dismiss button | 6px `pe-1.25` | 4px `pe-0.75` | 2px `pe-px` |
| Gap between parts | 4px `gap-1` | 4px `gap-1` | 2px `gap-0.5` |
| Media to text | `me-1` (8px) | `me-0.5` (6px) | `me-0.5` (4px) |
| Icon box | 20px `size-5` | 16px `size-4` | 12px `size-3` |
| Avatar in `media` | 24px | 20px | 16px |
| Dismiss button / glyph | 20px `size-5` / 12px | 16px `size-4` / 12px | 16px `size-4` / 10px |
| Dismiss pointer target (24px) | `before:-inset-0.5` | `before:-inset-1` | `before:-inset-1` |
| Dismiss ring offset | 2px (`focusRing`) | 2px | 0 (`focus-visible:outline-offset-0`) |
| With `secondaryText` | primary `text-caption-1 leading-3.5`, secondary `text-caption-2 leading-3` | the same; the tag grows to 28px | the same; 28px |

Look per state (root; Dismiss button hover and active behind the literal gate `not-disabled:not-aria-disabled:hover:`/`…:active:`, C-TOKENS):

| State | Root | Dismiss hover / active | Dismiss ring |
|---|---|---|---|
| `filled` | `border-transparent bg-muted text-foreground` | `bg-muted-hover` / `bg-muted-pressed` | `outline-ring` (on `muted`) |
| `outline` | `border-stroke bg-transparent text-foreground` | `bg-muted-hover` / `bg-muted-pressed` | `outline-ring` (on the surface behind) |
| `brand` | `border-transparent bg-selected text-selected-foreground` | `bg-selected-hover` / `bg-selected-pressed` | `outline-ring` (on `selected`) |
| selected (any appearance) | `border-primary bg-primary text-primary-foreground` + `forcedColors.selectedContainer` | `bg-primary-hover` / `bg-primary-pressed` | `focus-visible:outline-primary-foreground` |
| disabled (wins over selected) | the appearance's colours + `opacity-50 has-focus-visible:opacity-100` + `forcedColors.disabled` | none (native `disabled`) | — (held focus, D25: the default ring) |

Every state: shape class (`rounded-full` / `rounded`); the Dismiss button adds `disabled:cursor-not-allowed`, `aria-disabled:cursor-not-allowed`, `focusRing` and `forced-colors:not-disabled:not-aria-disabled:hover:text-[Highlight]`, and only while the tag is enabled `disabled:opacity-50` and `mergedAriaDisabledClasses` (a merged slot's own `disabled` or `disabledFocusable`). Order in `cn()`: `tagClassNames.root`, base, size, insets, look, shape, then the consumer's `className`.

- **Data attributes** (C-CLASS, before `{...rest}`): root `data-size`, `data-appearance`, `data-shape` (enumerated, always, the resolved value), `data-selected`, `data-disabled` (boolean); internal markers `data-wave-tag-item` on the root and `data-wave-tag-dismiss` on the Dismiss button (always rendered; §4 and Phase 3's marker table). A held Dismiss button (D25) carries `aria-disabled`, `data-disabled`, `data-disabled-focusable`.
- **Stable classes** (`tagClassNames`, registered by the foundation): new keys `media: 'wave-tag__media'` (the media span), `icon: 'wave-tag__icon'` (the icon box), `secondaryText: 'wave-tag__secondary-text'` (the second line), each in `renderSlot`'s base classes, so a slot object keeps it on its element. `root`, `primaryText`, `dismissButton`, `dismissIcon` stay on the same elements. The column wrapper has no class.

#### Built-in text

`dismissLabel` (`'Dismiss'`), unchanged: README "Built-in text" row `Tag | dismissLabel` stays.

#### Tests

`src/components/data-display/__tests__/Tag.test.tsx` (new cases; 0.10 cases kept, §6.4 lists the two that change):
- "renders the 0.10 box by default (D20)": no new prop → `data-size="medium"`, `data-appearance="filled"`, `data-shape="circular"`, `data-wave-tag-item`, no `data-selected`/`data-disabled`, and exactly the classes `wave-tag inline-flex items-center gap-1 min-h-7 border border-transparent bg-muted text-foreground text-body-1 rounded-full ps-2.75 pe-2.75` (dismissible: `pe-1.25`).
- `it.each(['filled', 'outline', 'brand'])` "draws the %s appearance with theme tokens": classes and `data-appearance`; no raw colour.
- "draws the selected look over every appearance, and disabled over selected": `data-selected`, `bg-primary text-primary-foreground border-primary`; with `disabled` both attributes and no selected classes.
- `it.each(sizes)` "sizes the tag, its icon, Avatar and Dismiss button at %s": `data-size`, height, text, insets, icon box, Dismiss box, hit layer, ring offset.
- "draws 4px corners with shape rounded; circular is the default".
- "disabled: the Dismiss button is natively disabled; click, Enter, Space, Delete and Backspace call no onDismiss; Tab skips it; the root has data-disabled and no aria-disabled".
- `it.each` "disabled wins over %s" (a merged `disabledFocusable` Button, a merged `<button disabled={false}>`, the deprecated `{ disabled: false }` object): native `disabled`, no `aria-disabled`/`data-disabled-focusable` on the button.
- "disabled dims the tag once and lifts while a focus ring shows inside": root `opacity-50 has-focus-visible:opacity-100`; the button has no `disabled:opacity-50` then.
- "a Dismiss button disabled while it has focus keeps focus, unavailable, until focus leaves it (D25)": focus it, rerender `disabled`; still focused, `aria-disabled="true"`, `data-disabled-focusable`, not `toBeDisabled()`; Enter, Space, Delete call nothing; Tab away → `toBeDisabled()`; a disabled tag rendered unfocused is natively disabled at once.
- "forwards disabled and value to an as element that takes them, never to the span or an anchor": `as="button"` → `<button disabled value="x">`; default span and `as="a"` render neither.
- "renders media, icon, primary text, secondary text and the Dismiss button in that order".
- "sizes an Avatar in media for the tag; an Avatar's own size wins; an Avatar in children keeps its size" (24/20/16px boxes, read from `avatarSizeClasses` and the foundation's boxes).
- "hides the icon from assistive technology, not the media".
- `it.each(['', [], <></>, emptyGenerator])` "renders no element for media, icon or secondaryText that render nothing".
- "puts the two texts in a column with the two-line type only while secondaryText renders".
- **Guard** "names the dismiss button after the primary text only, with media, icon and secondary text": `media={<Avatar name="Katri Athokas" />}` + "Katri" → "Dismiss Katri"; `secondaryText="Designer"` → "Dismiss Cherry"; with `icon` unchanged; a merged `<button>Remove</button>` with media and secondary text → "Remove Cherry".
- "gives the Dismiss button a 24px pointer target at every size" (`relative`, the `before:` inset class).
- "draws the focus ring on the tag's fill: primary-foreground on a selected tag, offset 0 at extra-small".
- "uses the state tokens for the Dismiss hover of each look (D22)" (the gated classes per appearance and selected).
- "draws an edge, the selected outline, GrayText and a Highlight glyph in forced colours" (classes).
- "uses only logical classes with every slot, in RTL" (`renderWithProviders(…, { dir: 'rtl' })`; the 0.10 RTL test's assertion, see §6.4).
- "renders and hydrates a dismissible tag with an Avatar media and secondary text" (`renderToString` + `hydrateRoot` in its own container, removed in `finally`; identical HTML, no `console.error`).
- "calls onDismiss once per activation in StrictMode".
- Types (`expectTypeOf`, `// @ts-expect-error`): `TagProps['size']` is `TagSize | undefined` (and appearance, shape); `size="large"`, `appearance="tint"`, `shape="square"`, `selected="yes"`, `value={1}` are errors; `media`/`icon` accept `Slot<'span'>`; `TagProps<'button'>['disabled']` is `boolean | undefined`; `TagProps<'li'>['value']` is `string | undefined`; `TagProps` equals `TagProps<'span'>`; an interface extending `TagProps` compiles.
- `testSystemProps` `a11yVariants` gain: each appearance (dismissible), selected, disabled (dismissible and not), media + icon + secondary text, each size.

`src/components/data-display/__tests__/stableClassNames.test.tsx`: "Tag: the media, icon and secondary-text parts" (`tagClassNames.media`/`.icon`/`.secondaryText` on their elements, and on a slot object's element, `icon={{ as: 'img', src, alt: '' }}`).

`src/components/data-display/__tests__/tagStyles.test.ts` (new): "tagRootClasses gives the root look of a text-only tag for every size, appearance and shape" (the size, look and shape classes of the tables above; no stable class; tokens only).

The tokens and their pairs are tested in `src/styles/__tests__/tokens.test.ts` by the foundation (§1).

#### Stories

`stories/Tag.stories.tsx` (`Components/Data Display/Tag`): new `Appearances` (filled, outline, brand, each dismissible), `Sizes` (three sizes × text, icon, media, dismissible), `Shapes`, `Disabled` (dismissible and not), `Selected` (its description says it is a look and links InteractionTag), `WithMedia` (Avatars, one `decorative`, one with `PresenceBadge size="extra-small"`), `SecondaryText`; `WithIcon` uses the `icon` slot (name kept); `size`, `appearance` and `shape` argTypes declared locally (Phase 1 rule 10); every story named; callbacks through `fn()`. `Dismissible`, `CustomDismissIcon` and `AsLink` keep their markup; `FilterGroup` moves onto TagGroup (P6-02).

### P6-02 — TagGroup (P6-tags)

A TagGroup is a set of tags with one keyboard model: by default an APG toolbar (`role="toolbar"`, one Tab stop, arrow keys along `orientation` through the same configuration as Toolbar), or with `role="list"` a list of static tags. It gives its tags their default `size`, `appearance`, `shape`, `dismissible` and `disabled`; reports every dismissal with `onDismiss(value)`; moves focus to the next tag, else the previous one, else `fallbackFocusRef`, when a tag that had focus is removed; and with `value`/`defaultValue`/`onValueChange` selects InteractionTags as `aria-pressed` toggles, with hidden inputs for forms. Delete and Backspace dismiss a focused tag, inside and outside a group. There is no listbox mode. Module-only seams let TagPicker build its tag list on it (§4).

**Closes:** `taggroup-1` (M), `taggroup-2` (M), `taggroup-3` (M), `tag-4` (L). The report has no prose entries for `taggroup-1…3` (section 3 row 8, `docs/research/fluent-ui-v9-comparison.md:372`); the split is inferred: `taggroup-1` focus after a dismiss (certain: Phase 1 P1-15 "mitigates `taggroup-1`"), `taggroup-2` selectable chips, `taggroup-3` the toolbar container with shared look, `disabled` and a group `onDismiss`.
**Guards:** Tag dismiss naming (`TagGroup.test.tsx` › "keeps every Tag's Dismiss button named after its tag, in a toolbar and in a list"); Toolbar and TagGroup share one arrow-axis rule (`TagGroup.test.tsx` › `describe('one arrow-axis rule with Toolbar (buttons-22)')`, and every `Toolbar.test.tsx` case green without an edit after the foundation's extraction).

#### Rulings

- **D30 — Two roles, no listbox mode.** `role` is `'toolbar'` (default) or `'list'`.
  - **Toolbar** (the default, and any role other than `'list'`): one Tab stop and the arrow keys of D31, for tags that are actions (dismissible Tags, InteractionTags, link chips). It renders `aria-orientation` while its role is `toolbar` and `aria-disabled="true"` while disabled.
  - **List** (`role="list"`): every Tag and InteractionTag root gets `role="listitem"` from the context (a consumer `role` on the tag wins; a Tag whose element is interactive or already a list item, `as` `'a'`, `'button'`, `'input'`, `'select'`, `'textarea'` or `'li'`, or a component, gets none: the JSDoc says to wrap a link chip in a `<span role="listitem">`); every control keeps its own Tab stop; no arrow keys; no `aria-orientation` and no `aria-disabled` on the root (axe `aria-allowed-attr` on a list). Delete and Backspace (D33) and the focus move (D35) apply in both roles.
  - No `listbox` mode: an `option` cannot hold a Dismiss button (axe `nested-interactive`, re-verified by the critic with axe 4.13), so selection is `aria-pressed` toggles in the toolbar (D38). `role="listbox"` warns once (`TagGroup:listbox-role`) and keeps the toolbar keyboard. A toolbar whose tags have no control after mount (no element `TOOLBAR_ITEM_SELECTOR` matches, other than hidden inputs) warns once (`TagGroup:static-toolbar`).
  - The roadmap acceptance "axe for both roles" becomes "axe for the toolbar and list roles", and its sketch's "with selection it is `role="listbox"` with APG listbox keys" is replaced (§5 ROADMAP).
  - *Why:* lead memo C1; Fluent's `useTagGroup` defaults to toolbar and selects through `InteractionTagPrimary`'s `aria-pressed`; Fluent's best practice puts non-actionable tags in `role="list"`; a toolbar of plain text misleads; an app that needs a value list uses `Listbox` (P5-03).
- **D31 — One arrow-axis rule with Toolbar.** In toolbar mode TagGroup calls the foundation's `useToolbarNavigation({ orientation })` (`src/components/button/Toolbar.navigation.ts`, §4), the only place that configures `useRovingTabIndex` for toolbars (`TOOLBAR_ITEM_SELECTOR`, `manageTabIndex: true`, `tabStop: 'last-focused'`, `orientation`): Left/Right when horizontal (mirrored in RTL through `getArrowIntent`), Up/Down when vertical, the other axis ignored (`buttons-22`); a wrapping set moves in DOM order; the arrows wrap; Home/End; the Tab stop is the last focused control, at first the first enabled one; natively disabled controls skipped, `data-disabled-focusable` ones kept; keys and focus from portals ignored. It merges `containerProps.ref` with its own, renders `data-roving-container`, composes the consumer's `onKeyDown` first (its `preventDefault()` cancels the roving keys) and `onFocus` with `checkDefaultPrevented: false`, as Toolbar does. In list mode it spreads none of them: the hook's container detaches, and the foundation's `useRovingTabIndex` hand-back fix restores the controls' own `tabIndex` when a group switches from toolbar to list. *Why:* the roadmap guard; Toolbar already works over any focusable descendant (a Dismiss button, a link chip, both InteractionTag buttons); one module keeps the two from drifting; lead memo C28.
- **D32 — What a tag inherits from its TagGroup.** Through `TagGroupContext` (`TagGroup.context.ts`; `null` outside a group, optional membership like `useFieldContext`, no `reportMissingContext`): `size`, `appearance` and `shape` (the tag's own prop, else the group's, else `'medium'`/`'filled'`/`'circular'`); `disabled` (the group's **or** the tag's: a disabled group disables every tag, and `disabled={false}` cannot re-enable one; Fluent's `contextDisabled ? true : disabled`); `dismissible` for Tags only (the Tag's own value when defined, else the group's; `<Tag dismissible={false}>` opts out). An InteractionTag is dismissible exactly when it renders a Secondary. *Why:* Fluent's TagGroup context; one resolution point per prop, as `useInputLook`; lead memo C8 (the group has `shape`).
- **D33 — Delete and Backspace dismiss.** On a Tag's Dismiss button and on an `InteractionTag.Secondary`, Delete and Backspace call `preventDefault()` and `event.currentTarget.click()`; on an `InteractionTag.Primary` and on a Tag root that has focus itself (a link chip) they click the tag's Dismiss control when it has one (found at key time through the tag's ref or the InteractionTag context; nothing happens without one). Ignored when `event.defaultPrevented` (a merged slot button's or the consumer's `onKeyDown` ran first and prevented it), when `event.repeat` (a held key dismisses one tag), with Ctrl, Alt or Meta (Shift is allowed), while composing (`event.nativeEvent.isComposing`), and when the key's target is not the element itself (`event.target !== event.currentTarget`: a key from a Popover opened from a Primary, C-COMPOSE). The same rule applies inside and outside a TagGroup. *Why:* `tag-4` and the roadmap ("Delete/Backspace on the primary triggers the secondary"); Fluent's Tag and InteractionTagSecondary dismiss on both keys; Backspace is the delete key of Mac keyboards (Phase 3 D14); a click keeps every path that already cancels a dismissal (a merged button's `preventDefault()`, `MERGED_DISABLED_FOCUSABLE_PROPS`' blocked click, native `disabled`, D25's held state); without the repeat guard a held key would move to the next tag (D35) and dismiss it too. Outside a TagGroup the keys do what Enter already does, so each control has one rule. Fluent's Tag dismisses on these keys only through a TagGroup's context: nominated as an open question (§8).
- **D34 — `onDismiss(value)` is an event-named callback.** `onDismiss?: (value: string) => void` is called once per dismissal activation (click, Enter, Space, Delete, Backspace), synchronously inside the Dismiss control's click handler: after the Tag's own `onDismiss()` (a Tag cannot cancel it: its `onDismiss` has no event), or after the Secondary's own `onClick` (its `preventDefault()` cancels the group's call, and D39's deselection). No `details` in 0.11 (one can be added later as an optional second argument); the JSDoc names Fluent's `onDismiss(event, { value })`. *Why:* C-NAMING (value first; event-named callbacks fire on every activation, Tree's `onItemSelect(value)` precedent); TagPicker (P6-04) depends on the synchronous timing (§4).
- **D35 — Focus after a removal: next tag, else previous tag, else `fallbackFocusRef`.**
  - **When.** Only when a tag, or a tag's Dismiss control, **unmounts while focus is inside it** (`root.contains(activeElement)` in its layout-effect cleanup, before React removes its nodes): after a dismissal the app carries out, a controlled parent dropping the tag, an asynchronous removal, `dismissible` turning `false` on a focused Dismiss button. No focus moves while the tag stays (a dismissal the app refuses or confirms first). Focus placed elsewhere before the removal commit (in `onDismiss`) or in that commit wins (`usePreserveFocus`'s rule).
  - **Where.** In a microtask after the commit (`usePreserveFocus` on the tag root and on each Dismiss control, unchanged): the candidates, recorded in the cleanup from the group root's `[data-wave-tag-item]` elements that belong to this group (their closest `[data-wave-tag-group]` is this group's root), are the next tags in DOM order, then the previous tags nearest first; when only a Dismiss control went, the same tag comes first. A candidate counts while it is connected, not `hidden` and has an enabled control; the target is its **corresponding control**: when the focused control was a Dismiss control (`[data-wave-tag-dismiss]`) the candidate's Dismiss control if it has an enabled one, else its first focusable control (`FOCUSABLE_SELECTOR` and `isFocusable`, the tag root itself first when it is focusable); otherwise its first focusable control. With no candidate, `fallbackFocusRef.current` when it is connected and focusable; else nothing, and `TagGroup:focus-lost` warns once (from the microtask).
  - Several tags removed in one commit leave the next surviving one; the whole group unmounting leaves `fallbackFocusRef`; StrictMode's simulated unmount moves nothing (`usePreserveFocus` cancels the move on remount). The moved-to control becomes the roving Tab stop (the container's focus handler records it; the restamp that follows the removal must keep it: a named test).
  - A standalone Tag (no group) moves no focus on removal (the README recipe stays for it).
  - The internal order `'next'` (next tags, then the fallback, never a previous tag) exists for TagPicker only (D36).
  - Fluent focuses the next focusable element, else the previous one, synchronously in `onDismiss`, whether or not the app removes the tag, and has no fallback: recorded in roadmap §8.3.
  - *Why:* `taggroup-1`; Phase 1 P1-15's recipe (next, else previous, else a fallback) becomes built-in; moving only when the tag goes covers removals that are not dismissals and leaves a refused dismissal alone; the corresponding-control rule lets repeated Delete or Enter on Dismiss controls clear tags one by one and equals the recipe for plain Tags (one control each); the record is taken in the cleanup because `getFallback` runs after the node is gone (`usePreserveFocus.ts`); lead memo C5.
- **D36 — Host seams for TagPicker (module-only).** `TagGroup.context.ts` exports two contexts no public component reads except TagGroup and Tag, frozen in §4:
  - `TagGroupHostContext` (`{ removalFocus?: 'next-then-previous' | 'next'; hiddenValues?: ReadonlySet<string> }`): the nearest TagGroup reads it and provides `null` below itself (a nested group never inherits it). `removalFocus: 'next'` is D35's TagPicker order; a Tag or InteractionTag whose `value` is in `hiddenValues` renders `hidden` on its root (TagPicker's `overflow="count"`).
  - `TagHostContext` (`{ dismissName?: string; dismissButtonClassName?: string }`), provided by TagPicker around each tag it renders itself: with `dismissName` the Dismiss button is named by `aria-label={dismissName}` alone (no `aria-labelledby`, no hidden `dismissLabel` text, so the tag's `textContent` is its own text); `dismissButtonClassName` is merged after the button's own classes.
  - The markers `data-wave-tag-group` (TagGroup root), `data-wave-tag-item` (every Tag and InteractionTag root) and `data-wave-tag-dismiss` (Tag's Dismiss button, `InteractionTag.Secondary`) are always rendered.
  - *Why:* lead memo C5, C6; `labels.remove` is a function (word order) that a `dismissLabel` prefix cannot express, Tag ignores `aria-label` on its slot, and Phase 3 D8 keeps `wave-tag-picker__remove-button`; internal options must not become public props; a reset context keeps the options from leaking into a nested group.
- **D37 — Values.** `value` is optional on Tag and InteractionTag. A tag without one is reported by its generated id (`useId`, Fluent's default), and in a group with `onDismiss` or a selection that is a development warning (`TagGroup:missing-value`, once): a Tag that is dismissible in a group with `onDismiss`, or an InteractionTag in a group with `onDismiss` or a selection. Tags register their explicit values with the group from a layout effect (duplicate registry as SwatchPicker's, `SwatchPicker.context.ts`); a second tag with the same value warns once per value (`TagGroup:duplicate-value:<value>`, C-DEV). *Why:* uncontrolled groups work without values; C-DEV's value-keyed compounds; CLAUDE.md's list gains TagGroup.
- **D38 — Selection: multiple, InteractionTag only, toolbar toggles.** `value?: readonly string[]`, `defaultValue?: readonly string[]` (default `[]`), `onValueChange?: (value: string[]) => void`, through `useControllable` (fires only on change; once per toggle in StrictMode). The group selects when **any** of the three is passed (`onValueChange` alone selects from `[]`, as Fluent's `onTagSelect` alone does). Only an InteractionTag selects: its Primary toggles its `value` on click, Enter or Space (the consumer's `onClick` first; `preventDefault()` cancels), and renders `aria-pressed` (`"true"`/`"false"`) and `data-selected`; the arrow keys never toggle. The value keeps selection order (`toggleValue` of `pickerValues.ts`); values without a tag are kept. A plain Tag is never selectable (D26). Multiple selection only in 0.11 (single choice is RadioGroup, SwatchPicker or `Toolbar.RadioGroup`; a later `selectionMode` would reuse `SelectionMode`). The JSDoc names Fluent's `selectedValues`, `defaultSelectedValues` and `onTagSelect`. No `details`. *Why:* C-NAMING (state is `value`/`onValueChange`, readonly in and mutable out, the multi-select family's shape, Phase 5 D9); Fluent selects through `InteractionTagPrimary` only; APG toolbars contain toggle buttons; lead memo C1.
- **D39 — Dismissing a selected InteractionTag deselects it.** A dismissal of an InteractionTag whose value is selected calls `onDismiss(value)` and then `onValueChange(withoutValue)`, in the same click; a Secondary `onClick` that calls `preventDefault()` cancels both. *Why:* an uncontrolled selection would otherwise keep, and submit, a value whose tag is gone; Fluent's `TagGroupSelect` story does exactly this by hand. Fluent's TagGroup leaves the selection alone: nominated as an open question (§8).
- **D40 — Forms (C-FORMS).** A TagGroup takes `name`, `form` and `required`: `<HiddenInput type="text" value={value}>` (one input per value) only with `name` or `required`, inside the root (`relative`); `required` is native only (an empty selection blocks submission, and `onInvalid` focuses the group's first tabbable control); no `aria-required` (not allowed on `toolbar` or `list`, axe `aria-allowed-attr`); a form reset restores `defaultValue`, compared by content (`resetValues`/`sameValues`: an unchanged reset reports nothing), through `useFormReset(rootRef, …, form)`; while disabled nothing is submitted. Without a selection (no value prop) the group renders no hidden input even with `name`. TagGroup does not read the Field context in 0.11 (a toolbar has no `aria-invalid` or `aria-required` to wire; backlog). Fluent's TagGroup submits nothing: nominated as an open question (§8). *Why:* WaveUI strength "native forms everywhere" (roadmap §1.2); C-FORMS for value controls.
- **D41 — Layout and the rest.** The root is a `<div>` (not polymorphic, Fluent's root): `relative inline-flex flex-wrap items-center`, with a gap by size (`gap-2` 8px medium, `gap-1.5` 6px small, `gap-1` 4px extra-small, Fluent's column gaps used for rows too; at `extra-small` the 2px hit layers of two rows meet without overlapping); `orientation="vertical"` adds `flex-col items-start`. No `aria-label` default and no warning when unnamed (Toolbar parity; the JSDoc says to name it). No built-in announcements: a toggle is announced from `aria-pressed` on the focused Primary, a dismissal by the focus move (no `labels` prop). Escape is not handled. *Why:* the 0.10 FilterBar story wraps; Fluent's stories add wrapping by hand; the APG toolbar's name is the consumer's.

#### API

```ts
// src/components/data-display/TagGroup.tsx
export interface TagGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /**
   * `'toolbar'`: one Tab stop and arrow keys, for tags that are actions (dismissible tags,
   * InteractionTags, links). `'list'`: a list (every tag gets `role="listitem"`), each control
   * its own Tab stop and no arrow keys, for tags that only display. Another role keeps the
   * toolbar keyboard; `'listbox'` is not supported (an option cannot hold a Dismiss button).
   * Name the group with `aria-label` or `aria-labelledby`.
   * @default 'toolbar'
   */
  role?: React.AriaRole;
  /**
   * Layout and arrow-key axis, as on Toolbar: Left/Right (mirrored in RTL) when horizontal,
   * Up/Down when vertical; a wrapping set moves in DOM order. `aria-orientation` (toolbar role)
   * and `data-orientation`.
   * @default 'horizontal'
   */
  orientation?: Orientation;
  /** Default `size` of its tags (a tag's own wins) and the gap between them. @default 'medium' */
  size?: TagSize;
  /** Default `appearance` of its tags (a tag's own wins). @default 'filled' */
  appearance?: TagAppearance;
  /** Default `shape` of its tags (a tag's own wins). @default 'circular' */
  shape?: TagShape;
  /**
   * Disables every tag: a tag cannot re-enable itself. A control that has focus keeps it,
   * unavailable, until focus leaves it. `aria-disabled` (not with `role="list"`), `data-disabled`.
   * @default false
   */
  disabled?: boolean;
  /**
   * Default `dismissible` of its Tags (a Tag's own value wins). An InteractionTag is dismissible
   * when it has an `InteractionTag.Secondary`.
   * @default false
   */
  dismissible?: boolean;
  /**
   * Called with the tag's `value` on every dismissal: a click, Enter or Space on a Dismiss
   * button, or Delete or Backspace on a tag (Fluent's `onDismiss(event, { value })`). Remove the
   * tag from your state; when it goes, focus moves to the next tag, else the previous one, else
   * `fallbackFocusRef`. Dismissing a selected tag also removes its value from the selection.
   */
  onDismiss?: (value: string) => void;
  /**
   * Where focus goes when the tag that had it is removed and no other tag can take it, for
   * example an "Add" or "Reset filters" button outside the group. WaveUI-only.
   */
  fallbackFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * The selected values (controlled), in selection order: the `value`s of the pressed
   * InteractionTags. Passing `value`, `defaultValue` or `onValueChange` makes the group select
   * (Fluent's `selectedValues`). Plain Tags are never selected.
   */
  value?: readonly string[];
  /** Initially selected values (uncontrolled; Fluent's `defaultSelectedValues`). @default [] */
  defaultValue?: readonly string[];
  /** Called with the new selected values when they change (Fluent's `onTagSelect`). */
  onValueChange?: (value: string[]) => void;
  /** Form field name: one hidden input per selected value (a selecting group only). */
  name?: string;
  /** The id of the form the hidden inputs belong to, when the group is outside it. */
  form?: string;
  /**
   * An empty selection blocks the form's submission (native validation only: a toolbar has no
   * `aria-required`).
   * @default false
   */
  required?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}
export const TagGroup: (props: TagGroupProps) => React.ReactNode; // displayName 'TagGroup'
```

The component docblock covers: the two roles and when to use each; the keyboard (D31, D33); inheritance (D32); focus after a removal and `fallbackFocusRef` (D35); selection through InteractionTags (D38, D39); forms (D40); that Fluent's `selectedValues`/`onTagSelect` are `value`/`onValueChange`; an `@example` of a dismissible filter bar and of selectable chips.

`TagGroup.context.ts` (new, module-only, imports no component; Tag, InteractionTag, TagGroup and TagPicker import it): `TagGroupContext` and `useTagGroupContext()` (internal to P6-tags: mode, resolved look and `disabled`/`dismissible`, `dismiss(value)`, `selecting`, `isSelected(value)`, `toggle(value)`, `register(value)`, the root ref, `fallbackFocusRef`, `removalFocus`, `hiddenValues`); `TagGroupHostContext` and `TagHostContext` with their types (frozen, §4); `useTagGroupItem(rootRef, value)` (registration, the removal record and `usePreserveFocus`, D35, D37); the held-focus hook of D25; the Delete/Backspace key test of D33.

#### Behaviour

| Where | Key / action | Toolbar (default) | `role="list"` |
|---|---|---|---|
| Group | Tab, Shift+Tab | one Tab stop: the last focused control, at first the first enabled one | every enabled control is a Tab stop |
| Control | Left/Right (horizontal), Up/Down (vertical) | previous/next control, wrapping, in DOM order; mirrored in RTL; the other axis does nothing | nothing |
| Control | Home/End | first/last control | nothing |
| Dismiss button, Secondary | Enter, Space, click | dismisses: the tag's own handler, then `onDismiss(value)` (D34) | the same |
| Dismiss button, Secondary, Primary with a Secondary, a focused link-chip root with a Dismiss button | Delete, Backspace | dismisses through the Dismiss control's click; held: once (D33) | the same |
| Primary in a selecting group | Enter, Space, click | toggles its value (`aria-pressed`); arrows never toggle (D38) | the same |
| After a removal of the focused tag | — | next tag's corresponding control, else previous, else `fallbackFocusRef` (D35) | the same |

- **Disabled group.** Every control natively disabled (D32), so a toolbar has no Tab stop; a control that had focus keeps it until it loses it (D25). Toggles and dismissals do nothing; nothing is submitted.
- **Pointer.** Clicks only. A pointer dismissal in Chromium and Firefox focuses the Dismiss button, so the removal moves focus to the next tag (Fluent's Cypress expectation); in Safari a click does not focus a button, so nothing moves.
- **ARIA.** Toolbar: `role="toolbar"`, `aria-orientation`, `aria-disabled` while disabled, the consumer's name. List: `role="list"`, `role="listitem"` on tags (D30). Primaries `aria-pressed` only in a selecting group or with InteractionTag's `selected` (D45). No `aria-selected`, no `option`.
- **Announcements.** None (D41).
- **SSR and hydration.** The server HTML carries the roles, `aria-orientation`, `aria-pressed`, the `data-*` attributes and markers, the hidden inputs and the Dismiss names; the roving `tabIndex` values are stamped after mount (Toolbar parity), so every control is tabbable until hydration. Ids come from `useId`. No child type checks: tags written in a Server Component (client references) behave the same.
- **RTL.** Arrows through `getArrowIntent`; logical classes only.
- **Forced colours, reduced motion.** Nothing of its own (the tags draw theirs); no motion.
- **Development warnings** (from effects or the D35 microtask, `warnOnce`; keys exact):
  - `TagGroup:duplicate-value:<value>` — ``TagGroup: several tags share the value "<value>". Give every tag of a group its own `value`: `onDismiss` and the selection cannot tell them apart.``
  - `TagGroup:missing-value` — ``TagGroup: a tag without `value` is in a group with `onDismiss` or a selection, so it is reported by a generated id. Give every tag a `value`.``
  - `TagGroup:focus-lost` — ``TagGroup: the tag that had focus was removed and no other tag could take focus, so focus fell to the page. Pass `fallbackFocusRef` (for example an "Add" or "Reset filters" button outside the group).``
  - `TagGroup:static-toolbar` — ``TagGroup: this toolbar has tags but no control (no Dismiss button, InteractionTag or link). Pass `role="list"` for tags that only display.``
  - `TagGroup:listbox-role` — ``TagGroup: `role="listbox"` is not supported (an option cannot hold a Dismiss button); the group keeps the toolbar keyboard. Use InteractionTags in the default toolbar for selectable tags, or Listbox for a list of values.``
  - `TagGroup:missing-value` and the duplicate warning do not fire for a group without `onDismiss` and without a selection.

#### DOM and classes

```html
<!-- toolbar (default) -->
<div role="toolbar" aria-label="Filters" aria-orientation="horizontal" [aria-disabled="true"]
     data-orientation="horizontal" data-size="medium" data-appearance="filled" data-shape="circular" [data-disabled=""]
     data-wave-tag-group="" data-roving-container=""
     class="wave-tag-group relative inline-flex flex-wrap items-center gap-2">
  <span class="wave-tag …" data-wave-tag-item="" …>                     <!-- Tag: no role -->
    <span id="tag-content-…" class="wave-tag__primary-text …">Red</span>
    <button type="button" data-wave-tag-dismiss="" tabindex="0" aria-labelledby="…">…</button>   <!-- tabindex stamped after mount -->
  </span>
  <div class="wave-interaction-tag …" data-wave-tag-item="" …>…</div>     <!-- InteractionTag, P6-03 -->
  <input type="hidden" name="filters" value="blue">                      <!-- name, selecting group -->
</div>
<!-- role="list": no aria-orientation, no aria-disabled, no data-roving-container; each tag root role="listitem" -->
```

- **Data attributes** (before `{...rest}`): `data-orientation`, `data-size`, `data-appearance`, `data-shape` (enumerated, always), `data-disabled` (boolean); markers `data-wave-tag-group` (always) and `data-roving-container` (toolbar mode, from the hook).
- **Stable classes:** `tagGroupClassNames = { root: 'wave-tag-group' }` on the root, first in its `cn()` (registered by the foundation; P6-04's `TagPicker.Group` carries it as its variant base).

#### Built-in text

None.

#### Tests

`src/components/data-display/__tests__/TagGroup.test.tsx` (new):
- `testSystemProps(TagGroup, { expectedTag: 'div', displayName: 'TagGroup', defaultProps: { 'aria-label': 'Filters', children: <Tag dismissible>Red</Tag> }, a11yVariants: [dismissible Tags, selecting InteractionTags, InteractionTags with Secondaries, `role="list"` of static tags, disabled, vertical, required with name] })` (the stable-class case included).
- Roles and attributes: "is a named toolbar with aria-orientation and data-orientation" (both values); "renders data-size, data-appearance and data-shape with their defaults"; "renders aria-disabled and data-disabled only while disabled"; "keeps the toolbar keyboard for a consumer role other than list"; "with role list gives every tag role listitem, renders no aria-orientation or aria-disabled, keeps every control a Tab stop and handles no arrow key"; "gives no listitem role to a link chip or a tag with its own role"; "restores the controls' own tabIndex when the role changes from toolbar to list" (needs the foundation's hand-back fix).
- Keyboard (toolbar): "has one Tab stop: the first control, then the last focused one"; "moves and wraps with Left/Right over Dismiss buttons, link chips and both InteractionTag buttons"; "jumps with Home/End"; "uses Up/Down when vertical and ignores Left/Right"; "ignores Up/Down when horizontal"; "mirrors Left/Right in RTL"; "skips disabled tags"; "runs the consumer's onKeyDown first and its preventDefault() cancels the navigation"; "calls the consumer's onFocus".
- **Guard** `describe('one arrow-axis rule with Toolbar (buttons-22)')`: `it.each` over (Toolbar, TagGroup) × (horizontal, vertical) × (ltr, rtl) × (ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End), three controls each: the same focus moves.
- Inheritance (D32): "gives its tags its size, appearance and shape; a tag's own wins"; "disables every tag's controls; a tag's disabled={false} does not re-enable"; "gives Tags its dismissible; dismissible={false} opts out"; "does not warn for onDismiss on a Tag in a dismissible group".
- **Guard** "keeps every Tag's Dismiss button named after its tag, in a toolbar and in a list" ("Dismiss Red", "Dismiss Blue"; with `media` and `secondaryText`).
- `onDismiss` (D33, D34): `it.each(['click', 'Enter', 'Space', 'Delete', 'Backspace'])` "calls onDismiss(value) once on %s, after the Tag's own onDismiss" (StrictMode); "a Secondary onClick that calls preventDefault() cancels it"; "a merged dismissIcon button's onKeyDown preventDefault() cancels Delete"; "ignores a repeated key" (`fireEvent.keyDown(button, { key: 'Delete', repeat: true })`); "ignores Ctrl, Alt and Meta with Delete"; "ignores a key during composition"; "dismisses nothing while disabled".
- Focus after a removal (D35; each removal under `userEvent` or followed by `await act(async () => {})`, and `document.activeElement !== document.body` asserted): "focuses the next tag's Dismiss button after the middle tag goes"; "focuses the previous one after the last tag goes"; "focuses fallbackFocusRef after the only tag goes"; "never drops focus while every tag is dismissed in turn with Enter, Space, Delete and Backspace"; "moves from a Secondary to the next tag's Dismiss control, and from a Primary (Delete) to the next tag's first control"; "moves across Tags and InteractionTags"; "focuses fallbackFocusRef when the group unmounts with its tags"; "warns TagGroup:focus-lost without a fallback" (exact message, nothing else logged); "moves no focus while the app keeps the tag"; "moves after an asynchronous removal (timer) while focused"; "moves no focus when focus was outside the removed tag"; "keeps focus placed in onDismiss"; "lands on the next surviving tag when two tags go in one commit"; "moves no focus on StrictMode's simulated unmount"; "makes the moved-to control the Tab stop (Tab out, Shift+Tab back)"; "moves focus to the same tag's link, else the next tag, when a focused Dismiss button unmounts".
- Held focus (D25): "a control that has focus when the group is disabled keeps it, aria-disabled, until it loses focus"; "Delete and Enter do nothing on a held control".
- Host seams (D36; through the module exports): "orders removal focus next, then fallbackFocusRef, with removalFocus 'next'"; "renders hidden on the tags whose value is in hiddenValues"; "does not pass the host options to a nested TagGroup"; "names a Dismiss button by a host's dismissName with aria-label alone and adds its class" (Tag's `textContent` is its text); "renders the data-wave-tag-group, data-wave-tag-item and data-wave-tag-dismiss markers".
- Selection (D38, D39): "selects InteractionTags from defaultValue (uncontrolled)"; "keeps a controlled value when the parent ignores onValueChange" (separate tasks); "reports values in selection order, once per toggle in StrictMode"; "renders aria-pressed true and false on Primaries and data-selected on the root, Primary and Secondary"; "toggles on Space and Enter, never on an arrow key"; "a Primary onClick that calls preventDefault() cancels the toggle"; "selects from [] with only onValueChange"; "never selects a plain Tag" (no `aria-pressed`); "calls onDismiss and then onValueChange without the value when a selected tag is dismissed"; "ignores an InteractionTag's selected inside a selecting group and warns InteractionTag:selected-in-group".
- Forms (D40): "submits one entry per selected value under name, with form"; "blocks submission while required and empty, and focuses the group's Tab stop"; "restores defaultValue on form reset and reports nothing when unchanged"; "submits nothing while disabled"; "renders no aria-required"; "renders no hidden input without a selection".
- Values (D37): "warns once per duplicated value"; "warns once for a tag without value in a group with onDismiss"; "does not warn in a display-only group".
- Roles' warnings: "warns TagGroup:listbox-role for role listbox"; "warns TagGroup:static-toolbar for a toolbar of static tags, not for a list or a disabled group".
- SSR: "renders a selecting, dismissible group on the server and hydrates it" (`renderToString`: `aria-pressed`, hidden inputs, no `tabindex`; `hydrateRoot` without warnings; `findDanglingIdRefsInHtml` clean).
- Types: `onValueChange`'s parameter is `string[]`; `value` takes `readonly string[]`; `onDismiss` is `(value: string) => void`; `// @ts-expect-error` `size="large"`, `appearance="primary"`, `shape="square"`, `defaultValue="x"`.

`src/components/data-display/__tests__/Tag.test.tsx` (P6-02's cases): "dismisses on Delete and Backspace outside a TagGroup, once per press" (repeat, modifiers and composition ignored); "a merged button's onKeyDown or onClick preventDefault() cancels Delete"; "a merged disabledFocusable Button blocks Delete"; "dismisses a link chip with a Dismiss button on Delete while the link has focus"; "renders data-wave-tag-item and data-wave-tag-dismiss"; the `Tag stories` FilterGroup case rewritten (§6.4).

`src/components/data-display/__tests__/stableClassNames.test.tsx`: "TagGroup: root on the toolbar and on the list element".

#### Stories

`stories/TagGroup.stories.tsx` (`Components/Data Display/TagGroup`, new): `Default` (a dismissible filter bar whose "Reset filters" `disabledFocusable` button is `fallbackFocusRef`), `WithInteractionTags` (each with a Secondary), `Selectable` (filter chips that show the selected values), `SelectableDismissible`, `Sizes`, `Appearances`, `Disabled`, `Vertical`, `StaticList` (`role="list"`), `InAForm` (`name`, `required`, a submit button that prints `FormData`); every group named; callbacks through `fn()`. `stories/Tag.stories.tsx`: `FilterGroup` rebuilt on TagGroup with `fallbackFocusRef` (the roadmap's "replaces the Phase 1 recipe in the stories"); `Dismissible` keeps the standalone recipe. Stories import module paths in wave B (`../src/components/data-display/TagGroup`).

### P6-03 — InteractionTag (P6-tags)

An InteractionTag is a tag with a main action and an optional separate Dismiss action: a `<div>` holding two sibling buttons, `InteractionTag.Primary` (the action, or a toggle in a selecting TagGroup) and `InteractionTag.Secondary` (Dismiss), never one inside the other. It shares Tag's sizes, appearances, shapes and slots (`media`, `icon`, `secondaryText` on the Primary), reads a TagGroup's defaults, and names its Secondary "Dismiss <primary text>" as Tag names its Dismiss button. Delete or Backspace on either button dismisses through the Secondary. Fluent's `hasSecondaryAction` is not needed.

**Closes:** `interactiontag-1` (M).
**Guards:** Tag's naming rule extends to the Secondary (`InteractionTag.test.tsx` › "names the Secondary after the primary text: Dismiss Cherry"); no nested buttons (`InteractionTag.test.tsx` › "never nests a button in a button").

#### Rulings

- **D42 — Two sibling buttons, a compound with flat names.** `InteractionTag` renders a `<div>` (`ref`, `className` and rest props); `InteractionTag.Primary` is a `<button type="button">` (not polymorphic in 0.11: link chips stay `Tag as="a"`; Fluent's Primary is a `button` slot); `InteractionTag.Secondary` is a separate `<button type="button">` after it. Each part's own props, `ref` and `className` go to its button. Standalone, both are Tab stops, Primary first (Fluent: "a dismissible InteractionTag has two focus stops"); in a toolbar TagGroup both join the arrow order (Primary, Secondary, next tag). One module, `InteractionTag.tsx`: the root (a plain comment, no docblock, C-DOCS), the two parts, their context (`InteractionTagContext`, `null` default, `reportMissingContext('InteractionTag.Primary', 'InteractionTag')` and `.Secondary`), `export const InteractionTag = /* @__PURE__ */ Object.assign(InteractionTagRoot, { Primary: InteractionTagPrimary, Secondary: InteractionTagSecondary })` with the component docblock, and the flat names `InteractionTagPrimary`, `InteractionTagSecondary` with a JSDoc each. No child type checks (context, the DOM and CSS `:has()` only), so parts written in a Server Component behave the same. *Why:* `interactiontag-1` (`Tag as="button" dismissible` nests buttons); C-COMPOUND; C-PURE; RSC.
- **D43 — The Secondary's name and content.** Default name `dismissLabel` plus the primary text: `aria-labelledby="{dismissLabelId} {primaryTextId}"` → "Dismiss Cherry", where `primaryTextId` is the Primary's primary-text span (generated by the root, through the context), never the secondary text. Its children render inside the button: children that render nothing (`slotRendersContent`) show the default dismiss glyph (`DismissIcon`, decorative); children with a text label (`hasTextLabel` on the server and the first render, `hasRenderedTextLabel` and `observeTextLabel` after mount, as `Tag.tsx` does) replace `dismissLabel` in the name ("Remove Cherry"); a `<button>` or `Button` child is unwrapped through `unwrapButtonGlyph` (its children become the content, its props are dropped, `InteractionTag.Secondary:button-child` warns once): the Secondary is itself the consumer's button, so this is the glyph rule, while Tag's `dismissIcon` keeps the dismiss merge rule (lead memo C11). A consumer `aria-label` replaces the built-in name (no `aria-labelledby` is rendered), and a consumer `aria-labelledby` replaces ours. `dismissLabel` defaults to `'Dismiss'`. Fluent's order is "{primary} {label}" ("Cherry remove") and needs `aria-labelledby={null}` to use an `aria-label`: recorded in roadmap §8.3. *Why:* WaveUI strength "dismiss buttons are named after their tag"; the roadmap ("named by the primary text plus its own label, per `labelInName`"); WCAG 2.5.3; C-SLOTS.
- **D44 — No `hasSecondaryAction`.** The Primary's square end corners and end padding next to a Secondary come from CSS on the root's named group (`group/interaction-tag`; on the Primary `group-has-[[data-wave-tag-dismiss]]/interaction-tag:rounded-e-none`, `…:border-e-0` and the end inset of D46), the `Menu.items.tsx` precedent; Delete on the Primary finds the Secondary through the context at key time. The JSDoc says Fluent's `hasSecondaryAction` is not needed. *Why:* correct in the server HTML without a registration render; works when the Secondary is wrapped (a Tooltip) or rendered conditionally; Fluent's prop is a styling flag only.
- **D45 — `selected`.** Outside a selecting TagGroup, a boolean `selected` draws the selected look and renders `aria-pressed` on the Primary (`selected={false}` → `"false"`), so a selected look is never colour only (WCAG 1.4.1); `undefined` renders no `aria-pressed`. Inside a selecting group the group's `value` decides, and a defined `selected` warns once (`InteractionTag:selected-in-group`). `data-selected` on the root, the Primary and the Secondary. Fluent's `selected` is look-only and its `aria-pressed` appears only in a selecting group: recorded in roadmap §8.3. *Why:* WCAG 1.4.1; D38.
- **D46 — Look, metrics and states (`tagStyles.ts`).** The Primary uses Tag's table (D21: height, text, start insets by first part, gap, icon box, Avatar size through `AvatarSizeContext`, the two-line type with `secondaryText`), its own end inset (12/8/8px alone; 8px `pe-2`, 6px `pe-1.5`, 4px `pe-1` next to a Secondary, with no end border), and `text-start`. Its `media` is `aria-hidden` (named by its content, lead memo C7). The Secondary is `w-7` (28px), `w-6` (24px), `w-6` (24px) wide, as tall as the Primary (`items-stretch`), with a 12, 12 or 10px glyph, `rounded-s-none`, and its start border as the divider. Both buttons: a 1px border (D20), `transition-colors motion-reduce:transition-none` (C-MOTION), `focusRing` with `relative focus-visible:z-10` (the ring is not covered by the neighbour; Fluent's `zIndex: 1`), and at `extra-small` a vertical hit layer (`before:absolute before:inset-x-0 before:-inset-y-0.5`, 24px tall, not overlapping each other). Fills behind the literal gate: `filled` `bg-muted` → `bg-muted-hover` → `bg-muted-pressed`; `outline` `bg-transparent border-stroke` → `border-stroke-hover bg-subtle-hover` → `bg-subtle-pressed` (Button's `outline`); `brand` `bg-selected text-selected-foreground` → `bg-selected-hover` → `bg-selected-pressed`; selected `bg-primary text-primary-foreground border-primary` → `bg-primary-hover` → `bg-primary-pressed`, with `forcedColors.selectedContainer forced-colors:border-[Highlight]` (Button's pressed treatment). Divider (`border-s-*` of the Secondary): `stroke` for filled, outline and brand, `primary-foreground` when selected (decorative). Disabled: each button natively disabled (D25's hold applies), `disabled:cursor-not-allowed disabled:opacity-50`, `mergedAriaDisabledClasses`, and `forcedColors.disabled` while the InteractionTag is disabled; the root is not dimmed. The Secondary's glyph turns Highlight on hover in forced colours (as Tag's, D29). The InteractionTag's own `shape` default is `'circular'` (Tag's; Fluent: `'rounded'`). *Why:* lead memo C2 (one table); Fluent's InteractionTag does not carry Tag's classes, so neither does WaveUI's (no variant base); the state tokens of D22.
- **D47 — `Tag as="button"` with `dismissible` warns.** A Tag whose element is a `<button>` (`as="button"`, or a Wave `Button` through `getElementType`) and that is effectively dismissible warns once from an effect (`Tag:nested-button`) and still renders (0.10 DOM). *Why:* `interactiontag-1`'s cause (`fluent-ui-v9-comparison.md:373`); the warning points to the component that fixes it.

#### API

```ts
// src/components/data-display/InteractionTag.tsx
/** Props of InteractionTag: the element that holds the Primary and Secondary buttons. */
export interface InteractionTagProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Identifies the tag in a TagGroup: the value `onDismiss` receives and the selection holds.
   * @default a generated id (a development warning in a group that reports values)
   */
  value?: string;
  /** @default the TagGroup's `appearance`, else 'filled' */
  appearance?: TagAppearance;
  /** @default the TagGroup's `size`, else 'medium' */
  size?: TagSize;
  /** `circular` (a pill) or `rounded` (4px). Fluent's default is `rounded`. @default the TagGroup's `shape`, else 'circular' */
  shape?: TagShape;
  /** Disables both buttons natively (a TagGroup's `disabled` too). @default false */
  disabled?: boolean;
  /**
   * Outside a selecting TagGroup: draws the selected look and sets `aria-pressed` on the Primary
   * (`false` renders `aria-pressed="false"`; leave it `undefined` for an action that is not a
   * toggle). Inside a selecting TagGroup the group's `value` decides (a development warning).
   */
  selected?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of InteractionTag.Primary: the tag's main action (or its toggle in a selecting TagGroup). */
export interface InteractionTagPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** A visual before the text (an Avatar, sized for the tag: 24, 20 or 16px). Decorative (`aria-hidden`): the button is named by its text. */
  media?: Slot<'span'>;
  /** A decorative icon before the text (`aria-hidden`), in a 20, 16 or 12px box. */
  icon?: Slot<'span'>;
  /** A second, smaller line under the text. Part of the Primary's name, not of the Secondary's. */
  secondaryText?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

/** Props of InteractionTag.Secondary: the tag's separate Dismiss button. */
export interface InteractionTagSecondaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visually hidden text that names the button with the Primary's text ("Dismiss Cherry"). A text
   * label in the children replaces it ("Remove Cherry"); an `aria-label` replaces the whole name.
   * @default 'Dismiss'
   */
  dismissLabel?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * A tag with a main action and a separate Dismiss button (… component docblock: the two buttons,
 * Tab stops and TagGroup arrow order, the Secondary's name, Delete and Backspace, selection in a
 * TagGroup, `selected` alone, that Fluent's `hasSecondaryAction` is not needed, an @example).
 */
export const InteractionTag = /* @__PURE__ */ Object.assign(InteractionTagRoot, {
  Primary: InteractionTagPrimary,
  Secondary: InteractionTagSecondary,
});
/** Flat name of `InteractionTag.Primary`, for React Server Components. */
export { InteractionTagPrimary };
/** Flat name of `InteractionTag.Secondary`, for React Server Components. */
export { InteractionTagSecondary };
```

`displayName`s: `InteractionTag`, `InteractionTagPrimary`, `InteractionTagSecondary` (flat names; warning keys and messages dotted, C-NAMING). The parts' `disabled` is or-ed with the InteractionTag's (a part cannot re-enable itself).

#### Behaviour

| Where | Key / action | Standalone | In a TagGroup |
|---|---|---|---|
| Primary | Tab | a Tab stop | the toolbar's arrow order (D31) |
| Primary | Enter, Space, click | the consumer's `onClick` | in a selecting group: `onClick`, then toggles its value (D38) |
| Primary | Delete, Backspace | clicks the Secondary when there is one (D33) | the same |
| Secondary | Tab | a Tab stop after the Primary | the arrow order |
| Secondary | Enter, Space, click | the consumer's `onClick` (the dismissal) | `onClick`, then the group's `onDismiss(value)` and D39's deselection |
| Secondary | Delete, Backspace | clicks itself (D33) | the same |
| Either | removal while focused | — | D35 |

- **Focus.** No roving of its own. A button disabled while it has focus keeps it (D25). The Secondary unmounting while it has focus (rendered conditionally) moves focus to the Primary.
- **Events (C-COMPOSE).** The Primary's toggle and key handlers and the Secondary's dismissal and key handlers ignore events whose target is not inside their button in the DOM, so clicks and keys in a Popover opened from a Primary (portal bubbling) neither toggle nor dismiss.
- **ARIA.** Primary: named by its content (media and icon hidden, the primary and secondary text read), `aria-pressed` per D38/D45. Secondary: D43. No roles on the root (`role="listitem"` in a list TagGroup).
- **Announcements.** None.
- **SSR and hydration.** Both names and `aria-pressed` are in the server HTML; the Secondary's text-label check is literal on the server and the first render (no mismatch); ids from `useId`.
- **RTL.** Logical corners and divider (`rounded-s-none`, `rounded-e-*`, `border-s`), logical insets; no directional glyph.
- **Forced colours, reduced motion.** D46.
- **Development warnings:**
  - `InteractionTag:selected-in-group` — ``InteractionTag: `selected` has no effect in a TagGroup that selects (`value`, `defaultValue` or `onValueChange`); the group's `value` decides.``
  - `InteractionTag.Secondary:button-child` — ``InteractionTag.Secondary: its content received a button. A button cannot contain a button: its children became the content of the Dismiss button and its props were dropped. Pass icon content, and handle the dismissal in `onClick` or in the TagGroup's `onDismiss`.``
  - `Tag:nested-button` (D47) — ``Tag: `as="button"` with `dismissible` puts the Dismiss button inside a button. Use InteractionTag instead: `InteractionTag.Primary` for the action, `InteractionTag.Secondary` for Dismiss.``
  - Missing context (C-CONTEXT): `[WaveUI] InteractionTag.Primary must be used within InteractionTag`, `[WaveUI] InteractionTag.Secondary must be used within InteractionTag` (thrown in development; logged once in production, with an inert value).

#### DOM and classes

```html
<div class="wave-interaction-tag group/interaction-tag inline-flex items-stretch"
     data-appearance="filled" data-size="medium" data-shape="circular" data-wave-tag-item=""
     [data-selected=""] [data-disabled=""] [role="listitem"] [hidden]>
  <button type="button" [aria-pressed="true"] [data-selected=""]
          class="wave-interaction-tag-primary relative inline-flex items-center gap-1 min-h-7 border border-transparent rounded-full bg-muted ps-2.75 pe-2.75 text-start text-body-1 text-foreground … group-has-[[data-wave-tag-dismiss]]/interaction-tag:rounded-e-none group-has-[[data-wave-tag-dismiss]]/interaction-tag:border-e-0 group-has-[[data-wave-tag-dismiss]]/interaction-tag:pe-2">
    <span class="wave-interaction-tag-primary__media inline-flex shrink-0 me-1" aria-hidden="true">…</span>
    <span class="wave-interaction-tag-primary__icon inline-flex size-5 shrink-0 items-center justify-center [&>svg]:size-full" aria-hidden="true">…</span>
    <span id="interaction-tag-text-…" class="wave-interaction-tag-primary__primary-text">Cherry</span>
    <!-- with secondaryText: the two texts in a column wrapper (no class), as in Tag -->
  </button>
  <button type="button" data-wave-tag-dismiss="" [data-selected=""] aria-labelledby="interaction-tag-dismiss-… interaction-tag-text-…"
          class="wave-interaction-tag-secondary relative inline-flex w-7 shrink-0 items-center justify-center border border-transparent border-s-stroke rounded-s-none rounded-e-full bg-muted p-0 text-foreground …">
    <span id="interaction-tag-dismiss-…" class="sr-only">Dismiss</span>
    <svg data-wave-icon="dismiss" aria-hidden="true" class="wave-interaction-tag-secondary__dismiss-icon" …/>
  </button>
</div>
```

- **Data attributes** (before `{...rest}`): root `data-appearance`, `data-size`, `data-shape` (enumerated, always), `data-selected`, `data-disabled` (boolean), marker `data-wave-tag-item`; Primary `data-selected`; Secondary `data-selected` and marker `data-wave-tag-dismiss`. A held button (D25) carries `aria-disabled`, `data-disabled`, `data-disabled-focusable`. `data-selected`, not `data-pressed`: the prop is `selected` (C-CLASS).
- **Stable classes** (registered by the foundation): `interactionTagClassNames = { root: 'wave-interaction-tag' }` (the root element); `interactionTagPrimaryClassNames = { root: 'wave-interaction-tag-primary', media: 'wave-interaction-tag-primary__media', icon: 'wave-interaction-tag-primary__icon', primaryText: 'wave-interaction-tag-primary__primary-text', secondaryText: 'wave-interaction-tag-primary__secondary-text' }` (the button and its slot elements); `interactionTagSecondaryClassNames = { root: 'wave-interaction-tag-secondary', dismissIcon: 'wave-interaction-tag-secondary__dismiss-icon' }` (the button; the default `<svg>`, or the span that wraps the children). No Tag classes on them (no variant base; Fluent's InteractionTag does not reuse Tag's). The column wrapper has no class.

#### Built-in text

`InteractionTag.Secondary` `dismissLabel`: `'Dismiss'` (named with the primary text: "Dismiss Cherry"). README "Built-in text" row `InteractionTag.Secondary | dismissLabel`.

#### Tests

`src/components/data-display/__tests__/InteractionTag.test.tsx` (new):
- `testSystemProps` for `InteractionTag` (`div`), `InteractionTagPrimary` (`button`, `wrapper`: an InteractionTag) and `InteractionTagSecondary` (`button`, `wrapper`), with their stable classes; `testNoImplicitSubmit` for both buttons; `testCompoundExposure` (`InteractionTagPrimary === InteractionTag.Primary`, `InteractionTagSecondary === InteractionTag.Secondary`); "renders the same with parts as client references" (`asClientReference(InteractionTagPrimary)` and `…Secondary`: same `renderToString` output and behaviour).
- **Guard** "never nests a button in a button" (`container.querySelector('button button')` is `null`, with every slot and in a TagGroup).
- Names (D43): **guard** "names the Secondary after the primary text: Dismiss Cherry"; "dismissLabel localises it"; "a text label in the children replaces dismissLabel, also when a child component renders it after mount"; "icon children keep Dismiss Cherry"; "a consumer aria-label replaces the name and drops aria-labelledby"; "a consumer aria-labelledby replaces ours"; "leaves the secondary text out of the Secondary's name"; "names the Primary by its text and secondary text, with media and icon hidden".
- Glyph: `it.each([[], <></>, false])` "shows the default glyph for children that render nothing"; "unwraps a button child and warns InteractionTag.Secondary:button-child" (exact message, nothing else logged).
- Keys (D33): "Delete and Backspace on the Secondary click it (its onClick once)"; "Delete and Backspace on the Primary click the Secondary"; "do nothing on a Primary without a Secondary or with a disabled one"; "ignore a repeated key".
- Standalone: "has two Tab stops, Primary then Secondary"; "a boolean selected sets aria-pressed and data-selected; undefined sets none" (D45).
- "disables both buttons natively and sets data-disabled on the root"; "a button disabled while it has focus keeps it until focus leaves it" (D25).
- "renders data-appearance, data-size and data-shape with their defaults (filled, medium, circular)".
- Look (D46): `it.each` appearances and selected: the fill, hover and pressed classes and the divider; sizes: Primary metrics and Secondary width and glyph; "squares the Primary's end next to a Secondary" (the `group-has-…` classes: jsdom has no `:has()`, the class is asserted); "keeps the focus ring above the neighbour" (`focus-visible:z-10`); "gives both buttons a 24px-tall target at extra-small".
- "sizes an Avatar in the Primary's media for the tag" (Avatar context).
- "ignores clicks and keys from a Popover opened from the Primary" (portal: no toggle, no dismissal).
- "moves focus to the Primary when a focused Secondary unmounts".
- Missing context: "throws outside an InteractionTag in development" (`expectThrows('[WaveUI] InteractionTag.Primary must be used within InteractionTag')`, and Secondary); "logs once and renders inert in production" (`vi.stubEnv('NODE_ENV', 'production')`).
- RTL: "uses only logical corner, divider and inset classes" (`renderWithProviders(…, { dir: 'rtl' })`).
- SSR: "renders and hydrates with a text-label child and selected" (no mismatch; `findDanglingIdRefsInHtml` clean).
- StrictMode: "calls the Primary's and Secondary's onClick once per activation".
- Types: `InteractionTagProps['size']` is `TagSize | undefined`; `// @ts-expect-error` `as` on the Primary, `size` on a part, `hasSecondaryAction`.

`src/components/data-display/__tests__/Tag.test.tsx`: "warns Tag:nested-button once for as='button' with dismissible, and not for as='a'" (exact message, nothing else logged).

`src/components/data-display/__tests__/stableClassNames.test.tsx`: "InteractionTag: root, Primary and its slot parts, Secondary and its dismiss icon" (the default `<svg>` and the children's wrapper).

The TagGroup suite holds the integration with TagGroup (D31, D35, D38, D39).

#### Stories

`stories/InteractionTag.stories.tsx` (`Components/Data Display/InteractionTag`, new; the meta has no JSDoc and no `docs.description.component`, `exportDocblocks.test.ts`): `Default` (Primary only), `WithSecondary`, `Selected` (`selected` toggled by the story's state), `WithIcon`, `WithMedia` (Avatars), `SecondaryText`, `Sizes`, `Shapes`, `Appearances`, `Disabled`, `PrimaryOpensPopover` (Fluent's `HasPrimaryAction`: a Popover from the Primary), `CustomDismissContent` (a text "Remove" child); every story named; callbacks through `fn()`.


---

<!-- §2 item section of P6-tagpicker (P6-04). Rulings D50–D68 (reserved range D50–D69; D69 unused). -->

### P6-04 — Composable TagPicker (P6-tagpicker)

`TagPicker` becomes a compound with seven members, `TagPicker.Control`, `.Group`, `.Input`, `.Button`, `.List`, `.Option` and `.OptionGroup`, each also exported under its flat name. Every part renders its default content when it has no children, so the 0.10 call `<TagPicker options={…} />` is exactly "the parts with their defaults", and an app replaces only the part it needs (custom tags with the default options, rich options with the default tags, a button trigger). The root keeps every piece of state (value, query, open, the listbox, forms, announcements, the create option) and always renders its `<div>`. The tags become `Tag`s (P6-01) inside a `TagGroup` with `role="list"` (P6-02), built on the module-only seams P6-tags freezes (§4). New on the root: free tagging through a create option (`allowCreate`, `onOptionCreate`, issue #6), a default chevron (`expandIcon`), a clear-all button (`clearable`), a single-line layout with a "+N" count (`overflow="count"`); the array entries gain `media` and `secondaryContent`. The 0.10 suite is the regression suite: it changes only where §6.4 lists.

**Closes:** `tagpicker-1` (M), `tagpicker-2` (M), `tagpicker-3` (M), `tagpicker-6` (M), `tagpicker-4` (L), `tagpicker-5` (L), `tagpicker-8` (L), `tagpicker-9` (L).
**Guards:** TagPicker filters as you type and announces "No matches" (`TagPicker.test.tsx` › "filters options based on input", "shows "No matches" with aria-expanded false when nothing matches", "announces "No matches" through a status region mounted before the text", unchanged; new `TagPicker.freeTagging.test.tsx` › "never says No matches while the create option shows, in any commit"); hidden inputs and form reset (`TagPicker.test.tsx` › "submits one entry per value", "resets to its default value with the form (also without name)", "reports a reset only when it changes the tags (C-FORMS)", unchanged; new `TagPicker.freeTagging.test.tsx` › "submits a created value and a form reset drops it"); `tagpicker-7`'s sizes and appearances (Phase 4 D12) reach every part (`TagPicker.parts.test.tsx` › `describe('sizes and appearances of the parts')`).

#### Rulings

- **D50 — One component, two forms; the parts are found among the direct children.** Without `children`, TagPicker renders `<TagPicker.Control />` and `<TagPicker.List />`. With `children`, it renders them inside its root `<div>` and looks for a `TagPicker.List` among its **direct children and Fragments** (`flattenChildren` + `isElementOfType`, so a List written in a Server Component, a lazy reference, is found); when none is there it renders a default `TagPicker.List` after the children, so the listbox always exists and the trigger's `aria-controls` never dangles. Each part also renders defaults when it has no children: `Control` → `<TagPicker.Group /><TagPicker.Input />`; `Group` → one `Tag` per selected value (D55); `List` → one `TagPicker.Option` per available entry of `options`. `options` stays the data source of every default, in both forms (`<TagPicker options={…}><TagPicker.Control expandIcon={false} /></TagPicker>` works). A `List` with children switches the listbox to registration mode (D58), and `options` then only names values (tag labels, announcements). The root always renders its `<div>` (Fluent's TagPicker renders none): `className`, `style`, `ref`, `data-size` and `data-appearance` stay on it (Phase 4 D9), it holds the summary, the status region and the hidden inputs whatever the parts are, and it is `useListboxPopup`'s `rootRef`. A List that the root did not find (wrapped in a component of yours, or a second one) warns once (`TagPicker.List:placement`) and still renders. *Why:* principle 2 (the 0.10 call is unchanged); one implementation; a List missing from the parts cannot leave a combobox without its listbox; Fluent also requires its trigger and popover as direct children (`useTagPicker.ts` `childrenToTriggerAndPopover`); render-time detection keeps the server HTML and the first client render identical.
- **D51 — Modules, with one-way imports, and the contexts.** The Toast and Tree precedent; nothing imports `TagPicker.tsx`:
  - `TagPicker.tsx`: the compound `Object.assign(TagPickerRoot, { … })` with the component docblock, the flat re-exports and the type re-exports.
  - `TagPicker.root.tsx`: `TagPickerRoot` (no docblock of its own: C-DOCS, `exportDocblocks.test.ts`), `TagPickerProps`, `TagPickerLabels`, `TagPickerSize`; the state, the listbox, the popup, forms, announcements, the create model and the root render. Imports the parts (it renders the defaults) and the context.
  - `TagPicker.context.ts`: `TagPickerContext` and `useTagPickerContext(part)`, `TagPickerControlContext` and `useTagPickerControlContext(part)`, the context value type. Imports no component.
  - `TagPicker.parts.tsx`: `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOptionGroup` (`= OptionGroup`), the internal default tag, the end buttons and the "+N" chip. Imports the context, `TagPicker.option.tsx`, `TagPicker.overflow.ts`, `Tag`, `TagGroup`, `TagGroup.context.ts`, `tagStyles.ts`, `Option.tsx`, `Combobox.expand.tsx` and `pickerStyles.ts`.
  - `TagPicker.option.tsx`: `TagPickerOption`, both the data interface and the component (D64). Imports `Option` and the listbox helpers, never the context.
  - `TagPicker.overflow.ts`: `useTagOverflow` (D62). `TagPicker.create.ts`: the pure `createOptionText` and `findExactMatch` (D59, D60).
  - **Contexts (C-CONTEXT, C-MEMO).** `TagPickerContext` defaults to `null`; every part's hook calls `reportMissingContext('TagPicker.<Part>', 'TagPicker')` (`[WaveUI] TagPicker.Control must be used within TagPicker` in development; logged once with an inert value in production). `TagPicker.Input` and `TagPicker.Button` also need `TagPickerControlContext` (the field they draw in and the popup's anchor): `[WaveUI] TagPicker.Input must be used within TagPicker.Control`. `TagPicker.Option` needs only a listbox (Option's own check), so it works in a Combobox, a Listbox or a custom picker. Both provider values are `useMemo`'d.
  - *Why:* Phase 3 rule 22 (one-way splits); `TagPicker.tsx` is 784 lines in 0.10 and roughly doubles; the root renders the defaults, so it imports the parts and never the other way round.
- **D52 — Size and appearance stay on the root.** The parts take neither prop (a `// @ts-expect-error` per part) and read the resolved values from the context: `useInputLook` on the root as in 0.9 (own prop, Field `size`, `WaveProvider inputDefaults`, `medium`/`outline`; a `small` from a Field or the provider gives `medium`). No part adds a `data-size` or `data-appearance` of its own; the Tags and the TagGroup render theirs (Tag sizes, D54), and those exist only while tags do, so the integration size cases (`integration.test.tsx` "case 1", "case 2"), which render no tags, keep counting exactly two `[data-size]` carriers and finding the root with `closest('[data-appearance]')` from the input (lead memo C10). *Why:* Phase 4 D6 and D9; one look per picker; Fluent's parts read both from the context too.
- **D53 — `TagPicker.Group` is a TagGroup with `role="list"`.** It renders `TagGroup` with `role="list"` (every Tag root `role="listitem"`, every remove button its own Tab stop, no roving: the 0.10 Tab order), `aria-label` = the Group's own `aria-label`, else `labels.selected` (`'Selected'`, input-pickers#14), `dismissible={!readOnly}`, `disabled` = the picker's, `size`/`appearance` mapped (D54), `shape="rounded"` (the 0.10 corners; a consumer Tag's own `shape` wins), `onDismiss` → removal (D56) and `fallbackFocusRef` = the trigger. Around it the Group provides `TagGroupHostContext` with `{ removalFocus: 'next', hiddenValues, dimDisabled: false }` (§4: `removalFocus` and `hiddenValues` are frozen by P6-tags; `dimDisabled` is this item's request, D66). The Group renders **nothing while no value is selected**, whatever its children (0.10, Fluent's `renderTagPickerGroup`: an empty `role="list"` is not rendered). Consumer Tags inside it are the selected values' tags: each needs `value` (TagGroup's `TagGroup:missing-value` warns without), inherits `dismissible` (leave it unset: a read-only picker then shows no remove buttons) and names its Dismiss button the Tag way ("Dismiss Katri"; the JSDoc says to pass `dismissLabel="Remove"` for TagPicker's wording). Fluent's `role="listbox"` group is not adopted. *Why:* lead memo C1 (an option cannot hold a Dismiss button, axe `nested-interactive`); the 0.5 list named "Selected" and the 0.10 Tab order stay, so the `tags()` helper and most 0.10 tests stay; TagGroup brings focus after a removal, Delete and Backspace with the repeat guard, and Tag's look and slots (`tagpicker-2`); a listbox of chips next to the combobox would read as a second value list.
- **D54 — Tag sizes and looks follow the picker (Fluent's mapping).** Picker `medium` → Tag `extra-small` (20px, `text-caption-1`), `large` → `small` (24px, `text-caption-1`), `extra-large` → `medium` (28px, `text-body-1`); appearance `filled-darker` → Tag `outline` (a `muted` tag is 1.05:1 on `input-filled-darker` in light, #f0f0f0 on #f5f5f5), every other appearance → Tag `filled`. The control's metrics stay those of Phase 4 §2.2 (`gap-1 px-2 py-1.5` and the input's `py-0.5 text-body-1` at medium, etc.); only the 0.10 `tag` column (`px-2 py-0.5 text-body-1`, …) is replaced by Tag's table (`tagStyles.ts`, lead memo C2), so every row keeps its 0.10 height (24, 28, 30px: the input line is the tallest item). A consumer Tag's own `size`/`appearance` wins over the group's. This changes the look of every 0.10 tag (medium: 24px with 14px text → 20px with 12px text): a CHANGELOG "Changed" (look) entry; nominated as an open question (§8) with the height-preserving mapping as the alternative. *Why:* parity (`tagPicker2Tag.ts`); three distinct tag sizes; the input row, not the tag, sets the field's height, so no field grows.
- **D55 — The default tags keep the 0.10 names and part classes.** The Group's default content is, per selected value, `<Tag value={value} className={tagPickerClassNames.tag} media={…}>{label}</Tag>` inside its own `TagHostContext` provider (an internal `TagPickerDefaultTag` component, so the provider value is memoized per tag) with `{ dismissName: labels.remove(label), dismissButtonClassName: tagPickerClassNames.removeButton }` (§4 T-T7): the remove button is named by `aria-label` alone ("Remove Apple", "Fjern Apple" with `labels.remove`), carries `wave-tag-picker__remove-button` next to `wave-tag__dismiss-button`, and holds no visually hidden text, so a tag's `textContent` is its label. The label is D58's. The `options` entry's `media` (D64) is passed only while it renders content (`slotRendersContent`), as the slot object `{ children: media, 'aria-hidden': true }`, so an Avatar there is decorative and takes the tag's Avatar size (24/20/16px through the foundation's `AvatarSizeContext`); `secondaryContent` is not shown in tags. A `TagPicker.Option`'s `media` in a List with children is not copied into the default tags (the store registers labels, not content): render your own Tags in `TagPicker.Group` for that (the people-picker story does). *Why:* `labels.remove` is a function (word order) that Tag's `dismissLabel` prefix cannot express, and Tag ignores an `aria-label` on its slot (`Tag:dismissIcon-name`); Phase 3 D8 keeps `wave-tag-picker__remove-button` and D5 gives a nested public component its parent's part class; the same `media` node is decorative in the option (lead memo C7), and showing it twice to a screen reader in the tag would repeat the label that names the tag.
- **D56 — Focus after a removal: the next tag, else the trigger; a pointer removal focuses the trigger.**
  - **Keyboard** (Enter, Space, Delete or Backspace on a remove button) and a focused tag that unmounts for another reason (a controlled parent drops it, `readOnly` turns on): TagGroup's rule with `removalFocus: 'next'` (§4 T-T5): the next tag's remove button, else its first focusable control, else the trigger (`fallbackFocusRef`), **never a previous tag**. So "Backspace focuses the last tag, a second Backspace removes it" (input-pickers#14) lands on the input after the last tag and the next Backspace focuses again instead of removing another tag.
  - **Pointer:** the Group's root records `event.detail` of every `click` whose target is inside it in the DOM (`onClickCapture`); its `onDismiss` handler, called synchronously inside the remove button's click (§4 T-T3), focuses the trigger first when that click had `detail > 0` (focus placed in `onDismiss` wins over TagGroup's move, T-T5), as 0.10 does for every removal.
  - TagPicker never moves focus while the tag stays (a controlled parent that ignores `onValueChange`): 0.10 focused the input on every removal.
  - The clear button (D61) and a form reset remove tags while focus is elsewhere: no tag move; the clear button focuses the trigger itself.
  - A remove button that is disabled while it has focus keeps it, unavailable, until focus leaves (§4 T-T6), and the control lifts its dimming while the ring shows (D66).
  - Fluent focuses the previous tag (else the trigger) and moves on dismiss whether or not the tag goes: recorded in ROADMAP §8.3; nominated as an open question (§8).
  - *Why:* the input is the next control in reading order after the last tag; the 0.5 safety rule; the 0.10 tests "Backspace on an empty query moves focus to the last tag; a second Backspace removes it", "moves focus to the input when a controlled value drops the focused tag", "removes a tag when its remove button is clicked" and "keeps the list open while a tag is removed with the mouse" stay green unchanged; repeated Delete clears tags one by one from any tag; a click on a tag's remove button keeps the user's place in the input (the 0.10 pointer path).
- **D57 — The keys of the tag list stay 0.10's.** `TagPicker.Group` handles them in an `onKeyDown` on the TagGroup root (consumer's first, `preventDefault()` skips ours; the TagGroup root composes it first, §4 T-T2), for key events whose target is a focusable control of this group in the DOM (C-COMPOSE): the controls are the group's focusable elements in DOM order (`FOCUSABLE_SELECTOR`, `isFocusable`, not `hidden`, whose closest `[data-wave-tag-group]` is this group's root). The previous and next arrow (`getArrowIntent(key, { orientation: 'horizontal', dir: getDirection(target) })`, so mirrored in RTL) move to the previous or next control; the next arrow on the last control focuses the trigger; the previous arrow on the first does nothing (and is not prevented). Escape focuses the trigger and calls `preventDefault()` (an enclosing layer ignores it, 0.5 §5.4). Delete and Backspace are Tag's (D33 of P6-02: the remove button's own click, a held key removes one tag), handled on the button before the root sees them. From the trigger, Backspace with empty text (0.10) and, new, the previous arrow with the caret at the start (`selectionStart === 0 && selectionEnd === 0`, no modifier; Left in LTR, Right in RTL) focus the group's **last** control; on `TagPicker.Button` both keys do the same. Fluent's TagPickerGroup sends ArrowRight from any tag to the trigger, not RTL-aware: not adopted (lead memo, critic §5.2), recorded in ROADMAP §8.3. *Why:* principle 2 (the 0.10 keyboard and its tests); "next on the last tag goes to the input" pairs with "previous at the input's start goes to the last tag" (Fluent `useTagPickerInput.tsx` has the latter); one direction rule for every horizontal key (C-LOGICAL).
- **D58 — Listed options, labels and the default filter.**
  - **Selected options are never listed**, in both forms. The root's navigability predicate, in both modes, is `item => item.value === createValue || (!selected.has(item.value) && (query === '' || filter(item, query)))` (`filter` being the prop, else the default). Data mode (no List children): `items` = the `options` entries that are not selected (0.10), plus the create item last while D59 shows it; the List renders a `TagPicker.Option` per `listbox.items` entry while expanded (0.10's rendering), and the create item as D59's create option. Registration mode (List children): the predicate hides the selected options, so a selected option stays mounted and registered (its label stays known), renders `hidden`, is skipped by the keys, and an `OptionGroup` whose options are all selected hides itself (`Option.tsx` `OptionGroupMembers.allHidden`). `filter` is never called for a selected option or the create option (its 0.10 JSDoc). Consumers do not filter selected options out (the JSDoc says to keep them rendered: their labels name the tags).
  - **The default `filter`** becomes Phase 5 D13's rule for every TagPicker: a case-insensitive substring of `textValue ?? label` (0.10 matched `label` only, which is the same for the array form: its entries have no `textValue`).
  - **A value's label** (tags, the summary, the announcements, the create checks): the registered option's `label` (`listbox.getItem(value)`), else `collectOptionLabels(<the List's children>)` (the server render and the first client render), else the `options` entry's `label`, else the raw value (input-pickers#22).
  - **`TagPicker:unknown-value`** (exact 0.10 message) warns only in the 0.10 configuration: data mode, the default tags rendered by the Group, and `allowCreate` off. With `allowCreate` a value without an option is a created tag; registered options may sit in components of yours whose labels arrive after the first commit; a consumer Tag supplies its own text.
  - **Picks keep the list open** (0.10, D10 of Phase 5); Fluent closes it after a click: recorded in ROADMAP §8.3.
  - *Why:* 0.10 behaviour and its test "does not list already-selected options"; `useListbox`'s consumer contract (display text = `getItem(value)?.label ?? collectOptionLabels(children).get(value)`); a predicate keeps options and their labels registered where filtering them out would lose them; D13 was written for this.
- **D59 — The create option (issue #6).** With `allowCreate`, let `text = query.trim()`. The list ends with a create option while: the picker is interactive (not `disabled`, not `readOnly`), the trigger is `TagPicker.Input`, the list is open, `text !== ''`, and `createOptionText` (`TagPicker.create.ts`) finds no duplicate:
  - no known option label equals `text` ignoring case (`toLowerCase()`, the default filter's folding), listed, filtered out or selected alike. Data mode: the labels of every `options` entry (computed before `useListbox` is called, since the create item is then one of its `items`, after the available entries). Registration mode: the labels of `options`, of `collectOptionLabels(<List children>)`, of the options the listbox lists in this render (`listbox.items`, without the create option) and of the selected values (D58), computed after the call (the create option is a rendered `Option` there, not an item);
  - no selected value equals `text` ignoring case (a created tag has no option);
  - no known option `value` equals `text` exactly (creating must not select another option by its value).
  It is a plain `Option` with a reserved per-picker value (`useId('tagpicker-create')`), `label` and content `labels.create(text)` (default `` `Create "${text}"` ``), `aria-selected="false"`, `data-create`, rendered **after** every option and group, never passed to `filter` (D58's predicate keeps it), always navigable. Since `autoHighlight` is `'first'` while there is text, the first real match (or D60's exact match) stays active and the create option is active, so Enter creates, only when it is alone. **Commit** (Enter while active, or a click): `onOptionCreate(text)`, then `text` is appended to the value (`onValueChange`, once, after `onOptionCreate`), the query resets to `''` (`onQueryChange('')`), the list stays open, and `labels.added(text, count)` is announced — the 0.10 path of an added tag (the deprecated `onChange` fires too). Nothing is created on Tab, blur or close. While it shows, the list counts as expanded (`expanded = open && (listbox.items.length > 0 || showCreate)`), and "No matches" is neither shown nor written to the status region (`noMatches = surfaceOpen && !expanded && !showCreate`), so the status region stays empty during the commit in which a registered create option has not registered yet. A created tag shows its raw text until a controlled parent adds an option for it (then the option's label). Without `allowCreate`, Phase 5 D13's contract stays: a filter that always keeps a synthetic option of yours gives a "Create …" entry. With `TagPicker.Button`, `allowCreate` shows nothing and warns once (`TagPicker:allowCreate-button`). *Why:* the issue's acceptance item by item (`ROADMAP.md:629-630`); one option model for the keyboard, the pointer and screen readers; the value check closes a duplicate the issue did not name; the folding matches the default filter.
- **D60 — The option whose label equals the typed text becomes active.** On every edit of the input's text (its `onChange`, so paste, drop and IME commits count), TagPicker calls `listbox.setActiveValue(findExactMatch(text, known) ?? null)`, where `findExactMatch` returns the first known option in list order (data mode: the `options` entries; registration mode: the options of `collectOptionLabels(<List children>)`, in children order) that is not selected and whose label equals the trimmed text ignoring case; `setActiveValue` drops a value the new filter does not keep, and `null` returns to the `'first'` fallback. So with options "Pineapple, Apple", typing "apple" makes Apple active and Enter adds Apple. A controlled `query` set by the parent does not re-rank (only a user edit does). This applies to every TagPicker, not only with `allowCreate`: a CHANGELOG "Changed" (behaviour) entry; no 0.10 test types an exact label that is not also the first match ("ban", "e", "er" in "makes the first match of a typed filter active…" and "activates no option on open or once the typed text is cleared"). *Why:* the roadmap's "one equal to an existing label … shows no create option, and Enter picks the existing one"; Enter should add what the user typed; TimePicker's ranking precedent (`TimePicker.tsx:694`); `useListbox`'s text-editing key clears the highlight in `keydown`, before `onChange` ranks it.
- **D61 — The end buttons: a default chevron (`expandIcon`) and a clear-all button (`clearable`).**
  - **`expandIcon`** (Phase 1 D21's optional indicator: `null`/`undefined` keep the chevron, `false` or a value that renders nothing hides the button) on the root and on `TagPicker.Control` (the Control's wins when it is not `undefined`). The button is `PickerExpandButton` (`Combobox.expand.tsx`): `<button type="button" tabIndex={-1}>` named `labels.expand` (`'Show options'`), `aria-expanded` = D59's `expanded`, `aria-controls` only while expanded, `onMouseDown` prevented, natively disabled while `disabled || readOnly`; a click toggles the list and focuses the trigger; a `<button>`/`Button` glyph is unwrapped with `TagPicker:expandIcon-button`. It shows by default: a CHANGELOG "Changed" (look) entry, `expandIcon={false}` restores 0.10; nominated as an open question (§8). Fluent's `role="button"` span is not adopted (the family's real, unfocusable `<button>`, Phase 1 D14).
  - **`clearable`** (default `false`): a `<button type="button">` named `labels.clear` (`'Clear selection'`), rendered while a tag is selected and the picker is not `readOnly`, natively disabled while `disabled`, a Tab stop after the trigger (the Phase 1 D14 rules), `onMouseDown` prevented; a click (or Enter, Space) removes every tag (`onValueChange([])` once), resets the query, closes the list and focuses the trigger, since the button goes with the tags (C-DISABLED). Not announced (Phase 5 D41: a clear is not a toggle). Fluent's free `secondaryAction` slot is not added (backlog).
  - **Placement.** Both are rendered by `TagPicker.Control` after its children, absolutely positioned against the control (which becomes `relative`) at the inline end of its **first row**: box, offset and glyph from `pickerStyles.ts` at the picker's CoreSize (`medium` → `medium`, `large` and `extra-large` → `large`): `pickerIconButtonClasses(coreSize, appearance)`, `pickerButtonOffset(coreSize, 1)` for the expand button (the clear button takes position 2 next to it, else 1), and a `top-*` class that centres the box on the first row (`top-1.5` at medium and large, `top-2.25` at extra-large: the control's top padding plus half the row height minus half the box). The control's end padding is `pickerEndPadding(buttons, coreSize)` (`pe-8`/`pe-14` at medium; `pe-10`/`pe-18` at large and extra-large), after its `px-*` in `cn()`. The `top-*` class goes through `PickerExpandButton`'s `className` (first in its `cn()`, conflicting with nothing), so `PickerExpandButton` needs no `placement` option (lead memo §C's conditional extraction is not used). Inside the dimmed control (D66) neither button dims itself: `PickerExpandButton` gets `dimDisabled={!disabled}` (a foundation request, §1) and the clear button carries `disabled:cursor-not-allowed` without the opacity of `disabledStyles`.
  - *Why:* `tagpicker-8`; Phase 1 D14 and D21 (Combobox and TimePicker show a chevron since 0.6, Dropdown since 0.10); Fluent's default chevron and its own example of a secondary action ("All Clear"); Fluent's aside sits on the first row (`alignSelf: flex-start` with the control's minimum height).
- **D62 — `overflow?: 'wrap' | 'count'`** (default `'wrap'`, the 0.10 layout).
  - **Collapsed** = `overflow === 'count'`, focus outside the root (DOM containment, tracked by the root's `onFocus`/`onBlur` with `relatedTarget`) and the list closed. While collapsed the control and the group are one line (`flex-nowrap`; the group `min-w-0 overflow-hidden whitespace-nowrap *:shrink-0`); the tags that do not fit render `hidden` through `hiddenValues` (§4 T-T7; at least the first tag stays, clipped by the group when it alone is too wide), and an `aria-hidden` chip follows the group with `labels.overflowCount(n)` (`+3`), drawn with `tagRootClasses({ size, appearance, shape: 'rounded' })` (§4 T-T9) and `tagPickerClassNames.overflowCount`. Focus entering the root (the trigger, a remove button by Shift+Tab, the clear button) or the list opening shows every tag again, wrapped, and drops the chip.
  - **Measuring** (`useTagOverflow`, `TagPicker.overflow.ts`, Overflow's store pattern: a store class read through `useSyncExternalStore`, connected in a layout effect so the first result renders before paint, one `ResizeObserver` on the control): the available width is the control's `clientWidth` minus its inline paddings, the trigger's computed `min-width`, the chip's width (measured while it renders; 0 before) and the control's `column-gap` per gap; tag widths (`offsetWidth` of each `[data-wave-tag-item]` of the group, by value) are read only while a tag is visible and cached; the visible count is the largest prefix whose widths and gaps fit (at least 1). A new snapshot is published only when the hidden set changes; a chip whose width change alters the count re-measures at most once per trigger. It measures on connect, on a control resize, when the selected values change and when the picker collapses; never while `overflow="wrap"` (no observer is created).
  - **Press on the chip:** `preventDefault()` on `mousedown` and focus the trigger (every tag shows); the list does not change (Fluent's single-line story: a press on its "+N" tag focuses without opening).
  - **Server HTML and first render:** the collapsed one-line classes, every tag, no chip; the browser measures after hydration.
  - Root attributes: `data-overflow` (`wrap` | `count`, always) and `data-collapsed` (boolean, count mode while collapsed).
  - *Why:* `tagpicker-9`; the summary ("Selected: …") already gives assistive technology every tag, so the chip is hidden from it; WaveUI's `Overflow` needs a wrapper per item, which a `role="list"` cannot take (axe `aria-required-children`), so TagPicker measures with its own small store (P9-01 may unify later); C-HOOKS (DOM-derived state through `useSyncExternalStore` and an observer).
- **D63 — `TagPicker.Button`: a select-only trigger.** A `<button type="button" role="combobox">` with `useListbox`'s select-only keys in multi-select mode (Down, Up, Home, End and typeahead open and move; Enter and Space open, or add the active option and keep the list open; Escape, Alt+Up and Tab close; a click toggles; `listbox.onKeyUp` prevents the Space keyup click), `autoHighlight: 'selected'` (the first listed option, since selected ones are not listed), typeahead on. Its content is the placeholder (in `text-muted-foreground`) while no tag is selected, else nothing; it stays the visible click area of the rest of the row (`min-w-15 flex-1`, `text-start`, the input's per-size padding and type), and the control's `inputFocusWithin` shows its focus (`focus:outline-hidden` on the button, C-FOCUS). Backspace and the previous arrow focus the last tag (D57). No query, no filter, no create option. `readOnly` renders `aria-readonly="true"` (allowed on `combobox`); `disabled` is native. The trigger kind reaches the root through `TagPickerControlContext`'s `registerTrigger(kind)`, called from the part's layout effect (`'input'` until then), so `useListbox` switches mode before any key; the server HTML and the first render use `'editable'`, and the Button part drops `aria-autocomplete` from `getComboboxProps()` itself, so both renders match. Not exactly one trigger after mount warns once (`TagPicker:trigger`). Fluent's TagPickerButton hides itself visually (a 1px clip) once a tag is selected: not adopted, recorded in ROADMAP §8.3. *Why:* `tagpicker-5`; a picker for a short fixed list; Dropdown's multi-select model (Phase 5 D10); pointer users keep a target and the field keeps one focus indicator.
- **D64 — `TagPicker.Option`, `TagPicker.OptionGroup` and the rich array entries.**
  - **`TagPicker.Option`** is a variant of `Option` (it renders `Option`; root classes `wave-option wave-tag-picker-option`) with `media?: Slot<'span'>` (before the text, decorative, `aria-hidden`, C-SLOTS icon-like; lead memo C7) and `secondaryContent?: Slot<'span'>` (a second line under the text, `text-caption-1 text-muted-foreground`, part of the option's accessible name, not of its label). It passes `Option` an explicit `label`: its own `label`, else `textValue`, else the text of its string, number and host-element children, read with `collectOptionLabels(<Option value={value}>{children}</Option>)` so the root's server-side labels and the registered label agree; without any of them it uses `value` and warns once (`TagPicker.Option:label`). So the media and the second line never enter the tag's label, the filter or the announcements (Option's own text-content fallback would read the second line). It is marked `markListboxElement(…, 'option')`, so `collectOptionLabels` reads it, and it works in any listbox (Combobox, Listbox, a custom picker). Without `media` and `secondaryContent` it renders exactly `Option`'s DOM.
  - **`TagPicker.OptionGroup` is `OptionGroup`** (as `Combobox.OptionGroup`): the flat `TagPickerOptionGroup = OptionGroup`, display name `OptionGroup`, class `wave-option-group` through the alias rule (lead memo C29: no constant of its own).
  - **`TagPickerOption` entries gain `media` and `secondaryContent`** (`React.ReactNode`): the default options render them through `TagPicker.Option`, the default tags show the entry's `media` (D55), so the array form alone closes `tagpicker-2` and `tagpicker-3`. No `disabled` entry (no gap asks for it).
  - **One name, two meanings.** The 0.5 data interface `TagPickerOption` keeps its name (principle 2), and the flat name of `TagPicker.Option` is the value `TagPickerOption` (C-COMPOUND): TypeScript keeps types and values apart, so `const options: TagPickerOption[]` and `<TagPickerOption value="a">` both work. Both are declared in `TagPicker.option.tsx` (declaration merging needs one module: re-exporting a type and a value of one name from two modules fails with TS2300, checked with `tsc`), and `TagPicker.tsx` re-exports the name once. The interface's JSDoc names the component and the component's names the interface.
  - *Why:* `tagpicker-3`, `tagpicker-4`; Fluent requires `text` for non-string option children for the same reason, uses `useOptionStyles` for its option and `useOptionGroup` for its group; the array form closes `tagpicker-2`/`-3` too without the parts form; a rename of a public 0.5 type would break every app that types its options.
- **D65 — Routing in the parts form (C-ROUTING).** The root computes the Field wiring once (`useFieldControl`, as 0.10) and hands the trigger part, Input or Button, through the context: `id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex` and `autoFocus`. The part's own `id`, `aria-label` and `aria-labelledby` replace the root's; its `aria-describedby` is joined first (`joinIds(part, root and Field, summaryId)`); its handlers run first, then the root's, then the internal ones (`preventDefault()` in either skips the built-in keys). The root's input-only props — `autoComplete` (`'off'`), `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck`, `enterKeyHint`, `onFocus`, `onBlur`, `onKeyDown`, `onKeyUp` (typed on `HTMLInputElement`) and `controlRef` — reach `TagPicker.Input` only; with `TagPicker.Button`, pass handlers and `ref` on the Button (the root's JSDoc says so). The listbox keeps 0.10's name (the root's `aria-label`, else its `aria-labelledby`, else the Field label); a List's own `aria-label`/`aria-labelledby` replace it. *Why:* C-ROUTING; one Field claim per picker; the root's handler types stay sound with a Button trigger.
- **D66 — The control: a press on its empty area toggles; a disabled picker dims once.**
  - **Press.** `TagPicker.Control`'s `onMouseDown` (the consumer's first; ignored when default-prevented, not the primary button, or targeted outside the control in the DOM) acts on a press whose target is not inside a focusable element of the control (`FOCUSABLE_SELECTOR`): it calls `preventDefault()` (focus does not leave the trigger, so no focus-outside dismissal) and, while interactive, toggles the list and focuses the trigger; read-only, it only focuses the trigger; disabled, nothing. The chip is D62's exception. A click on `TagPicker.Input` opens a closed list (Combobox's input rule; it never closes); `TagPicker.Button`'s click toggles (D63); the remove, clear and expand buttons are their own. 0.10 only opened, from a `click` on the control or the input: a press on the empty area of an open picker now closes it (CHANGELOG "Changed" behaviour; Fluent's `useTagPickerControl` toggles the same way; nominated as an open question, §8).
  - **Disabled look.** The control keeps 0.10's `cursor-not-allowed opacity-50` and gains `has-focus-visible:opacity-100` (a held remove button, §4 T-T6, shows an undimmed ring: C-DISABLED); nothing inside dims again: the Group provides `dimDisabled: false` (a request to P6-tags, §4), `PickerExpandButton` gets `dimDisabled={!disabled}` (a foundation request, §1), and the clear button, the chip, the input and the Button trigger carry no opacity of their own. Read-only does not dim the control (0.10); the expand button dims itself then.
  - *Why:* critic §5.1 (Fluent toggles from the control, its group, its aside and its icon); a `mousedown` default would otherwise blur the input, and 0.10's click closed and reopened the list through the focus-outside dismissal; nested opacities multiply (0.25), and the family dims a disabled field once.
- **D67 — What TagPicker does not take from Fluent.** No `disableAutoFocus`: TagPicker activates no option on open, and while text is typed the exact match (D60) or else the first match, Phase 5's `autoHighlight` rule (critic §5.4: a comparison-guide line). No `noPopover` (a popup-less picker; `options={[]}` with `allowCreate` gives free tagging with the create row) and no `secondaryAction` slot (`clearable` covers clear-all): backlog. No `inline` or `positioning` (`tagpicker-10`, P7-01). No blur commit of matching text (Phase 5 D12). No veto in `onOptionCreate` (a controlled parent that ignores the new value vetoes it; a `details` argument can be added later, C-NAMING). Fluent's single `onOptionSelect(event, { value, selectedOptions })` stays `onValueChange(values)` plus `onOptionCreate(text)`. *Why:* each is either covered by an existing WaveUI rule, routed to its own gap or phase, or a Phase 5 decision.
- **D68 — DOM and classes kept, and what changes.** No class is removed (Phase 3 D8): `__control`, `__group`, `__tag`, `__remove-button`, `__input`, `__listbox`, `__option`, `__surface` and `__empty-message` stay on the same elements; `__control` and `__group` sit next to the new member roots `wave-tag-picker-control` and `wave-tag-picker-group` and are "Deprecated, kept until 1.0" (D8's wording); `__input` next to `wave-tag-picker-input`, `__listbox` next to `wave-tag-picker-list`, `__option` next to `wave-tag-picker-option` on the options the List renders from `options`. Phase 3 judgement 7 ("TagPicker's tags are not Tag") is reversed: a tag is `<span class="wave-tag wave-tag-picker__tag" role="listitem">` (0.10 `<div>`), its remove button is Tag's Dismiss button (`aria-label` "Remove …" and both classes), the tag list carries `wave-tag-group` and its markers, the summary moves from the control to the root (it is `hidden`; its id and text are unchanged), the internal marker `data-wave-tagpicker-remove` is dropped (TagGroup's `data-wave-tag-dismiss` replaces it; the Phase 3 marker table is updated), `data-wave-tagpicker-control` stays on the control, and the root renders `data-overflow`. CHANGELOG "Changed" (DOM) and "Deprecated". *Why:* principle 2 and D8 (stable classes are API); internal markers are not.
- D69 is not used.

#### API

```ts
// src/components/input/TagPicker.option.tsx (both meanings of TagPickerOption, D64)

/**
 * One entry of `options`, the array form of TagPicker's options. The component of the same name,
 * `TagPickerOption`, is `TagPicker.Option`, the parts form.
 */
export interface TagPickerOption {
  /** Unique identifier for the option. */
  value: string;
  /** Display label: the option's text, its tag's text, and the text the filter and the announcements use. */
  label: string;
  /**
   * A visual before the label, in the option and in its tag (an Avatar, an icon). Decorative in
   * both: the label names them. An Avatar takes the tag's size (24, 20 or 16px).
   */
  media?: React.ReactNode;
  /** A second line under the label in the option (a role, an e-mail address); tags do not show it. */
  secondaryContent?: React.ReactNode;
}

/** Props of TagPicker.Option: an Option with a visual and a second line. */
export interface TagPickerOptionProps extends OptionProps {
  /** A visual before the text (an Avatar, an icon). Decorative (`aria-hidden`): the text names the option. */
  media?: Slot<'span'>;
  /** A second, smaller line under the text. Part of the option's name, not of its label. */
  secondaryContent?: Slot<'span'>;
  /**
   * The text of the option's tag, the filter and the announcements. Pass it when the children
   * are not plain text (a development warning otherwise).
   * @default `textValue`, else the text of the children, else `value`
   */
  label?: string;
}

/**
 * An option of TagPicker's list (`TagPicker.Option`) … (component docblock: media, the second
 * line, the label rule, works in any listbox, renders Option's DOM without the two slots).
 */
export const TagPickerOption: React.NamedExoticComponent<TagPickerOptionProps>; // displayName 'TagPickerOption'

// src/components/input/TagPicker.root.tsx

export interface TagPickerLabels {
  // remove, selected, summary, added, removed, noMatches: 0.10, unchanged
  /**
   * Text and name of the create option (`allowCreate`), from the trimmed typed text.
   * @default (text) => `Create "${text}"`
   */
  create?: (text: string) => string;
  /** Name of the clear button (`clearable`). @default 'Clear selection' */
  clear?: string;
  /** Name of the expand button at the end of the field. @default 'Show options' */
  expand?: string;
  /**
   * The "+N" text of the single-line layout (`overflow="count"`); hidden from assistive
   * technology, which hears the input's summary of every tag.
   * @default (count) => `+${count}`
   */
  overflowCount?: (count: number) => string;
}

export interface TagPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue' | RoutedHandlers> {
  /**
   * The options, the array form (`{ value, label, media?, secondaryContent? }`). With parts whose
   * `TagPicker.List` has children it only names values (tags, announcements). Changed in 0.11:
   * optional.
   */
  options?: readonly TagPickerOption[];
  /**
   * The parts: `TagPicker.Control` and `TagPicker.List`, directly inside TagPicker (a Fragment is
   * fine). Without children TagPicker renders both with their defaults; without a
   * `TagPicker.List` it renders the default list after the children.
   */
  children?: React.ReactNode;
  /**
   * Lets the user add a tag of their own text: while the trimmed text matches no option label
   * and no selected value (ignoring case) and no option value, the list ends with a create option
   * (`labels.create`); Enter on it or a click adds the text as a tag, calls `onOptionCreate`, and
   * clears the text. Needs `TagPicker.Input` (not `TagPicker.Button`).
   * @default false
   */
  allowCreate?: boolean;
  /**
   * Called with the trimmed text when the user creates a tag, before `onValueChange` reports the
   * new value. Add an option for it if you keep options: until then the tag shows the raw text.
   */
  onOptionCreate?: (text: string) => void;
  /**
   * Shows a clear button at the end of the field while a tag is selected (not while `readOnly`;
   * disabled while `disabled`): it removes every tag (`onValueChange([])`), clears the typed
   * text, closes the list and focuses the input. A Tab stop after the input.
   * @default false
   */
  clearable?: boolean;
  /**
   * The glyph of the expand button at the end of the field (default: a chevron). The button
   * opens and closes the list, keeps focus in the input and is not a Tab stop. `null` or
   * `undefined` keep the chevron; `false`, or a value that renders nothing, hides the button.
   * Decorative: a `<button>` passed here is unwrapped. `TagPicker.Control`'s `expandIcon` wins.
   */
  expandIcon?: Slot<'span'>;
  /**
   * `'wrap'`: the tags wrap onto more lines. `'count'`: while focus is outside the picker and its
   * list is closed, the tags stay on one line and the ones that do not fit give way to "+N"
   * (`labels.overflowCount`); focusing the picker shows them all.
   * @default 'wrap'
   */
  overflow?: 'wrap' | 'count';
  // 0.10 members keep their types. JSDoc changes:
  // - `placeholder`: "Shown by TagPicker.Input or TagPicker.Button while no tag is selected; the
  //   part's own `placeholder` wins. @default 'Select...'"
  // - `filter`: "Called with every listed option, also the options of `TagPicker.List`'s
  //   children, never with a selected option or the create option. … It may keep options that do
  //   not contain the text (`filter={() => true}` for a server-side search); for a create entry,
  //   use `allowCreate`. @default a case-insensitive substring match on the option's
  //   `textValue ?? label`"
  // - `query`, `defaultQuery`, `onQueryChange`: "Not used with TagPicker.Button."
  // - `size`: adds "Its tags are one Tag size smaller: medium → extra-small, large → small,
  //   extra-large → medium."
  // - `onFocus`, `onBlur`, `onKeyDown`, `onKeyUp`, `controlRef`, the text input attributes: "of
  //   TagPicker.Input's `<input>`; with TagPicker.Button, pass them (and `ref`) on the Button."
  // - `readOnly`: adds "the expand button is disabled and the clear button hidden".
  // - `disabled`: adds "the expand and clear buttons are disabled".
}

/** Sizes of TagPicker (Fluent's): medium (the 0.7 look), large and extra-large. */
export type TagPickerSize = Extract<Size, 'medium' | 'large' | 'extra-large'>; // 0.9, unchanged

// src/components/input/TagPicker.parts.tsx

/** Props of TagPicker.Control: the field that holds the tags, the trigger and the end buttons. */
export interface TagPickerControlProps extends React.HTMLAttributes<HTMLDivElement> {
  /** As TagPicker's `expandIcon`; wins over it when it is not `undefined`. */
  expandIcon?: Slot<'span'>;
  /** @default `<TagPicker.Group /><TagPicker.Input />` */
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of TagPicker.Group: the list of selected tags (a TagGroup with `role="list"`). */
export interface TagPickerGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'defaultValue'> {
  /**
   * The tags of the selected values: `Tag`s with a `value` each (leave `dismissible` unset).
   * @default one Tag per selected value, named "Remove <label>" (`labels.remove`)
   */
  children?: React.ReactNode;
  /** @default TagPicker's `labels.selected` ('Selected') */
  'aria-label'?: string;
  ref?: React.Ref<HTMLDivElement>;
}

/** Props of TagPicker.Input: the text field, the combobox. */
export interface TagPickerInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'type' | 'size' | 'disabled' | 'readOnly'
  > {
  /** Shown while no tag is selected. @default TagPicker's `placeholder` */
  placeholder?: string;
  ref?: React.Ref<HTMLInputElement>;
}

/** Props of TagPicker.Button: a trigger without text entry (select-only). */
export interface TagPickerButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'value' | 'type' | 'disabled' | 'children'
  > {
  /** Shown while no tag is selected. @default TagPicker's `placeholder` */
  placeholder?: string;
  ref?: React.Ref<HTMLButtonElement>;
}

/** Props of TagPicker.List: the option list, shown in a popup while open. */
export interface TagPickerListProps
  extends Omit<React.HTMLAttributes<HTMLUListElement>, 'role' | 'id' | 'hidden' | 'tabIndex'> {
  /**
   * `TagPicker.Option`s, `Option`s and `TagPicker.OptionGroup`s. Keep the options of selected
   * values rendered: TagPicker hides them and reads their labels.
   * @default one TagPicker.Option per available entry of TagPicker's `options`
   */
  children?: React.ReactNode;
  /** Merged last onto the `role="listbox"` element (a `max-h-*` replaces the default height). */
  className?: string;
  ref?: React.Ref<HTMLUListElement>;
}

// src/components/input/TagPicker.tsx
/**
 * A multi-select combobox that shows the selection as removable tags. … (component docblock:
 * the array form and the parts form with an @example of each; the defaults rule; the keyboard;
 * free tagging; the end buttons; the single line; routing; size and appearance; SSR; Fluent's
 * `selectedOptions`/`onOptionSelect` are `value`/`onValueChange`; `TagPickerOption` is both the
 * entry type and `TagPicker.Option`'s flat name.)
 */
export const TagPicker = /* @__PURE__ */ Object.assign(TagPickerRoot, {
  Control: TagPickerControl,
  Group: TagPickerGroup,
  Input: TagPickerInput,
  Button: TagPickerButton,
  List: TagPickerList,
  Option: TagPickerOption,
  OptionGroup: TagPickerOptionGroup,
});
export {
  TagPickerControl,
  TagPickerGroup,
  TagPickerInput,
  TagPickerButton,
  TagPickerList,
  TagPickerOption, // the component and the entry interface (D64)
  TagPickerOptionGroup, // `= OptionGroup`, with a JSDoc of its own in TagPicker.parts.tsx
};
export type {
  TagPickerProps,
  TagPickerLabels,
  TagPickerSize,
  TagPickerOptionProps,
  TagPickerControlProps,
  TagPickerGroupProps,
  TagPickerInputProps,
  TagPickerButtonProps,
  TagPickerListProps,
};
```

- Each part's declaration carries its own docblock (verify-dist's undocumented-component check); `TagPickerRoot` carries none. `displayName`s: `TagPicker`, `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOption`; `TagPickerOptionGroup` keeps `OptionGroup`. Warning keys and messages are dotted (`TagPicker.List:placement`).
- `React.ComponentProps<typeof TagPicker>` stays `TagPickerProps` (`Object.assign` keeps the root's signature); `TagPickerProps['options']` widens to optional (CHANGELOG "Types"); `onOptionCreate` has no `details` (it can gain one later as an optional second argument).
- `TagPickerOptionGroup`'s props are `OptionGroupProps` (no new type).

#### Behaviour

| Where | Key / action | Result |
|---|---|---|
| Input | typing, paste, drop | filters (`filter`, default `textValue ?? label`, D58); the option whose label equals the trimmed text becomes active, else the first match (D60); with `allowCreate` the create option comes last, active only when alone (D59) |
| Input | Enter | commits the active option: an option adds a tag, the create option creates; the list stays open; nothing active: not prevented, so a form submits (0.10) |
| Input | Down, Up, Alt+Down, Alt+Up, Tab, Escape | 0.10 (`useListbox` editable): open and move; open; close; close; close; close, then clear the text |
| Input | Backspace with empty text; the previous arrow (Left, Right in RTL) with the caret at the start | focuses the last control of the tag list (D57) |
| Input | click | opens a closed list (D66) |
| Button | Down, Up, Home, End, printable keys | open and move (typeahead) (D63) |
| Button | Enter, Space | open, or add the active option and keep the list open |
| Button | click | toggles |
| Button | Escape, Alt+Up, Tab | close |
| Button | Backspace, the previous arrow | focus the last control of the tag list |
| Remove button | Tab | each is a Tab stop (list mode) |
| Remove button | Enter, Space, Delete, Backspace | removes the tag (Tag D33, a held key removes one); focus → the next tag, else the trigger (D56) |
| Remove button | click | removes the tag; focus → the trigger (D56) |
| Remove button | previous / next arrow (mirrored in RTL) | previous / next control of the list; next on the last → the trigger; previous on the first: nothing (D57) |
| Remove button | Escape | the trigger; consumed (D57) |
| Expand button | click | toggles; focus to the trigger; not a Tab stop (D61) |
| Clear button | Tab; Enter, Space, click | a Tab stop after the trigger; removes every tag, clears the text, closes, focuses the trigger (D61) |
| Control, empty area | press | toggles the list and focuses the trigger; read-only: focuses it only (D66) |
| "+N" chip | press | focuses the trigger, so every tag shows; the list does not change (D62) |
| Option, create option | click | adds, creates; the list stays open; focus stays in the trigger (0.10) |

- **Focus.** The trigger keeps DOM focus while the list is open (`aria-activedescendant`). Removals: D56. A tag control disabled while it has focus keeps it (§4 T-T6). Focus moving between the parts inside the root (trigger ↔ remove buttons ↔ clear button) never dismisses the list (the root is the popup's `rootRef`).
- **Pointer.** `mousedown` on the surface keeps focus in the trigger (`ListboxSurface`); on the expand and clear buttons and on the control's empty area it is prevented (D61, D66). A remove-button click is a pointer removal when `event.detail > 0` (D56).
- **ARIA.** Trigger: `role="combobox"`, `aria-haspopup="listbox"`, `aria-controls` = the list's id, `aria-expanded` = open with options or the create option (D59), `aria-activedescendant` while an option is active, `aria-describedby` += the summary while tags exist, `aria-autocomplete="list"` on the Input only, `aria-readonly` on a read-only Button. List: `role="listbox"`, `aria-multiselectable="true"`, named as in 0.10 (D65). Create option: `role="option"`, `aria-selected="false"`. Tag list: `role="list"` named "Selected", tags `role="listitem"`, remove buttons named "Remove <label>" (default tags) or "Dismiss <text>" (consumer Tags). Control: `role="group"`, `aria-disabled` while disabled (0.10). Chip and the default tags' media: `aria-hidden`.
- **Announcements** (polite, `announceToggle`, 0.10): each tag the user adds (an option or a create: `labels.added(label, count)`) and removes (`labels.removed`); a controlled change, the clear button and a form reset are not announced. "No matches" (`labels.noMatches`) is written to the status region while the open list has text and nothing to show, never while the create option shows (D59). The create option is read by screen readers as the active descendant ("Create "infra"").
- **SSR and hydration.** 0.10's rules hold: an open list is closed in the server HTML and opens after hydration (`useIsClient`), so no ARIA reference dangles (every variant is checked with `findDanglingIdRefsInHtml`); labels come from `collectOptionLabels` and `options` during render; the trigger kind is `'input'` in the server HTML and the first render (D63); count mode renders its one-line classes, every tag and no chip (D62); the create option renders only while the list is open, so never in the server HTML. `renderToString` + `hydrateRoot` warn about nothing for the parts form with preselected registered options, `allowCreate` with `defaultQuery` and `defaultOpen`, `overflow="count"`, and the Button trigger.
- **React Server Components.** Parts written in a Server Component arrive as lazy references: the List is found with `isElementOfType`/`flattenChildren` (D50), `collectOptionLabels` unwraps lazy types, and no part checks a child's type otherwise. The integration RSC suite gets a TagPicker case (handoff).
- **RTL.** Logical classes only (`pe-*`, `end-*`, `text-start`); the tag arrows and the trigger's previous arrow go through `getArrowIntent` with the element's direction; the chip follows the visible tags in inline order.
- **Forced colours.** The control keeps its appearance recipe (`forced-colors:border-[ButtonText]` on the filled and underline looks); the expand and clear buttons use `focusRing` (and draw GrayText when natively disabled); the create option is an Option (`forcedColors.selectedContainer` never applies: it is never selected); tags and the chip take Tag's forced colours; a disabled tag keeps `forcedColors.disabled` under `dimDisabled: false`.
- **Reduced motion.** Only the chevron's rotation moves (`transition-transform motion-reduce:transition-none`, `PickerExpandButton`); no new motion (the listbox surface is not a presence surface).
- **Development warnings** (from effects, `warnOnce`, C-DEV; exact text):

| Key | When | Message |
|---|---|---|
| `TagPicker:unknown-value` | D58's 0.10 configuration only | 0.10's message, unchanged: ``TagPicker: the selected value(s) "kiwi" match no option; the raw value is shown as the tag label.`` |
| `TagPicker:expandIcon-button` | a `<button>`/`Button` glyph (`PickerExpandButton` with `component="TagPicker"`) | ``TagPicker: `expandIcon` received a button element; its children render as the glyph of the built-in expand button and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.`` (or "a slot object that renders a button") |
| `TagPicker:trigger` | after mount, not exactly one `TagPicker.Input`/`TagPicker.Button` registered | ``TagPicker: render exactly one trigger, `TagPicker.Input` or `TagPicker.Button`, inside `TagPicker.Control` (found ${count}).`` |
| `TagPicker:allowCreate-button` | `allowCreate` with the Button trigger | ``TagPicker: `allowCreate` needs `TagPicker.Input`: `TagPicker.Button` has no text to create a tag from, so no create option is offered.`` |
| `TagPicker.List:placement` | a List the root did not find, or a second one | ``TagPicker.List: render one TagPicker.List, directly inside TagPicker (a Fragment is fine). A second list, or one inside a component of your own, splits the options over two lists.`` |
| `TagPicker.Option:label` | no `label`, no `textValue`, no text in the children | ``TagPicker.Option: the option "${value}" has no text label, so its value is used. Pass `label` when its children are not plain text: its tag, the filter and the announcements read it.`` |
| missing context | a part outside TagPicker; a trigger outside TagPicker.Control | `[WaveUI] TagPicker.Control must be used within TagPicker` (each part); `[WaveUI] TagPicker.Input must be used within TagPicker.Control` (and `TagPicker.Button`) |

TagGroup's own warnings apply inside `TagPicker.Group` (`TagGroup:missing-value` for a consumer Tag without `value`, `TagGroup:duplicate-value:<value>`); the deprecated `onChange` keeps its `warnDeprecated` message (and fires for created values).

#### DOM and classes

```html
<!-- simple form, two tags, a chevron and clearable; the parts form renders the same -->
<div class="wave-tag-picker relative" data-size="medium" data-appearance="outline" data-overflow="wrap"> <!-- [data-collapsed] in count mode -->
  <div data-wave-tagpicker-control="" role="group" [aria-disabled="true"]
       class="wave-tag-picker-control wave-tag-picker__control relative flex flex-wrap items-center gap-1 px-2 py-1.5 … pe-14">
    <div role="list" aria-label="Selected" data-wave-tag-group="" data-orientation="horizontal"
         data-size="extra-small" data-appearance="filled" data-shape="rounded"
         class="wave-tag-group wave-tag-picker-group wave-tag-picker__group relative flex flex-wrap items-center gap-1">
      <span role="listitem" data-wave-tag-item="" data-size="extra-small" data-appearance="filled" data-shape="rounded"
            class="wave-tag wave-tag-picker__tag …">                              <!-- [hidden] while collapsed and overflowing -->
        <span class="wave-tag__media …" aria-hidden="true">…</span>                 <!-- the option's media only -->
        <span id="tag-content-…" class="wave-tag__primary-text …">Apple</span>
        <button type="button" data-wave-tag-dismiss="" aria-label="Remove Apple"
                class="wave-tag__dismiss-button … wave-tag-picker__remove-button">…</button>
      </span>
      …
    </div>
    <span aria-hidden="true" class="wave-tag-picker__overflow-count …">+3</span>  <!-- count mode, collapsed, hidden tags -->
    <input type="text" role="combobox" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded="false"
           aria-controls="tagpicker-listbox-…" aria-describedby="… tagpicker-summary-…"
           class="wave-tag-picker-input wave-tag-picker__input min-w-15 flex-1 bg-transparent … focus:outline-hidden py-0.5 text-body-1">
    <!-- or <button type="button" role="combobox" class="wave-tag-picker-button …">Select...</button> -->
    <button type="button" aria-label="Clear selection" class="wave-tag-picker__clear-button top-1.5 absolute … end-7">…</button>
    <button type="button" tabindex="-1" aria-label="Show options" aria-expanded="false"
            class="wave-tag-picker__expand-button top-1.5 absolute … end-1"><span class="wave-tag-picker__expand-icon …" aria-hidden="true"><svg …/></span></button>
  </div>
  <ul role="listbox" aria-multiselectable="true" tabindex="-1" hidden
      class="wave-listbox-surface__list min-h-0 max-h-60 overflow-auto wave-tag-picker-list wave-tag-picker__listbox"> <!-- in the portaled surface (wave-listbox-surface wave-tag-picker__surface) while expanded -->
    <li role="option" class="wave-option … wave-tag-picker-option wave-tag-picker__option">…</li>
    <li role="option" aria-selected="false" data-create="" class="wave-option … wave-tag-picker__option wave-tag-picker__create-option">Create "infra"</li>
  </ul>
  <span id="tagpicker-summary-…" hidden>Selected: Apple, Banana</span>   <!-- while tags exist; moved from the control -->
  <span role="status" class="sr-only"></span>
  <input type="hidden" name="…" value="apple"> …                          <!-- HiddenInput with name or required -->
</div>
```

- **Order inside the root:** the parts (the Control, then the List, or the default List after the children), the summary, the status region, the hidden inputs.
- **`TagPicker.Option` layout,** only while `media` or `secondaryContent` renders content (else Option's 0.10 DOM): inside Option's `wave-option__content` span, a layout wrapper `<span class="flex items-center gap-2">` (no class: Phase 3 judgement 27), the media span (`wave-tag-picker-option__media inline-flex shrink-0`, `aria-hidden`), and a column `<span class="flex min-w-0 flex-col">` with the children and the second line (`wave-tag-picker-option__secondary-content text-caption-1 text-muted-foreground`). An Avatar in an option's media keeps its own size (default `medium`; no context, since options are not tags).
- **The tag list's layout** keeps 0.10's `flex flex-wrap items-center gap-1` at every picker size, passed as TagGroup's `className` (it replaces TagGroup's `inline-flex` and its size gap in `cn()`; TagGroup's `relative` stays).
- **Collapsed layout** (D62): the control `flex-nowrap`, the group `min-w-0 overflow-hidden whitespace-nowrap *:shrink-0` in place of `flex-wrap`.
- **Data attributes** (C-CLASS; before `{...rest}`): root `data-size`, `data-appearance` (0.9), `data-overflow` (enumerated, always), `data-collapsed` (boolean); create option `data-create` (boolean); the control keeps the internal marker `data-wave-tagpicker-control`; TagGroup and Tag render theirs (`data-size`, `data-appearance`, `data-shape`, `data-orientation`, `data-disabled`, the markers `data-wave-tag-group`, `data-wave-tag-item`, `data-wave-tag-dismiss`); options keep Option's (`data-active`, `data-selected`, `data-disabled`). No part adds `data-size` or `data-appearance` (D52).
- **Stable classes** (`src/lib/classNames.ts`, registered by the foundation; each first in its part's `cn()`, written as a literal member access):

| Constant / key | Class | Element | Also carries |
|---|---|---|---|
| `tagPickerClassNames.expandButton` | `wave-tag-picker__expand-button` | the expand button | — |
| `tagPickerClassNames.expandIcon` | `wave-tag-picker__expand-icon` | its glyph span | — |
| `tagPickerClassNames.clearButton` | `wave-tag-picker__clear-button` | the clear button | — |
| `tagPickerClassNames.createOption` | `wave-tag-picker__create-option` | the create option | `wave-option`, `wave-tag-picker__option` |
| `tagPickerClassNames.overflowCount` | `wave-tag-picker__overflow-count` | the "+N" chip | — |
| `tagPickerControlClassNames.root` | `wave-tag-picker-control` | the control | `wave-tag-picker__control` (deprecated, until 1.0) |
| `tagPickerGroupClassNames.root` | `wave-tag-picker-group` | the tag list | `wave-tag-group` (variant base), `wave-tag-picker__group` (deprecated) |
| `tagPickerInputClassNames.root` | `wave-tag-picker-input` | the `<input>` | `wave-tag-picker__input` |
| `tagPickerButtonClassNames.root` | `wave-tag-picker-button` | the Button trigger | — |
| `tagPickerListClassNames.root` | `wave-tag-picker-list` | the `role="listbox"` list | `wave-listbox-surface__list`, `wave-tag-picker__listbox` |
| `tagPickerOptionClassNames.root` | `wave-tag-picker-option` | `TagPicker.Option`'s `<li>` | `wave-option` (variant base); `wave-tag-picker__option` on the ones the List renders from `options` |
| `tagPickerOptionClassNames.media` | `wave-tag-picker-option__media` | the media span | — |
| `tagPickerOptionClassNames.secondaryContent` | `wave-tag-picker-option__secondary-content` | the second line | — |

  The 0.10 keys stay on their elements (D68); the default tags carry `wave-tag` and `wave-tag-picker__tag`, their remove buttons `wave-tag__dismiss-button` and `wave-tag-picker__remove-button`; consumer Tags and consumer `TagPicker.Option`s get no TagPicker part class (Phase 3: the consumer's own elements). `TagPickerOptionGroup` resolves to `optionGroupClassNames` by its display name. Layout wrappers and the summary have no class. The registry's JSDoc names elements by role (no Tailwind word).

#### Built-in text

| Member | English default | Used for |
|---|---|---|
| `labels.create(text)` | `` `Create "${text}"` `` | the create option's text and name |
| `labels.clear` | `'Clear selection'` (Combobox's) | the clear button's name |
| `labels.expand` | `'Show options'` (Combobox's) | the expand button's name |
| `labels.overflowCount(count)` | `` `+${count}` `` | the "+N" chip (hidden from assistive technology) |
| 0.10, unchanged | `remove(label)` "Remove {label}", `selected` "Selected", `summary(labels)` "Selected: a, b", `added`/`removed(label, count)` "{label} added/removed, {count} selected", `noMatches` "No matches"; `placeholder` `'Select...'` | |

Consumer Tags in `TagPicker.Group` use Tag's `dismissLabel` (`'Dismiss'`), not `labels.remove`.

#### Tests

Pointer removals are `user.click` (or `fireEvent.click(button, { detail: 1 })`); keyboard ones are user-event keys or `fireEvent.click(button)` (`detail: 0`), as for Rating's half stars. Every focus assertion after a removal follows a microtask (`await act(async () => {})` or userEvent) and also asserts `document.activeElement !== document.body`.

`src/components/input/__tests__/TagPicker.test.tsx` keeps every 0.10 case except the §6.4 updates, and gains:
- "removes a middle tag with Delete and focuses the next tag's remove button; the last tag hands focus to the input" (Delete on Banana → "Remove Cherry"; Delete on Cherry → the input; each after `await act(async () => {})`, never `document.body`).
- "a pointer click on a remove button focuses the input, also on a middle tag" (`user.click`; `detail > 0`).
- "focuses the next tag when a controlled value drops a focused middle tag".
- "moves no focus when a controlled parent keeps the tag after a removal".
- "keeps focus on a remove button while the picker is disabled under it, then skips it" (§4 T-T6; `aria-disabled`, the control has `has-focus-visible:opacity-100`).
- "dims the disabled field once" (the control `opacity-50`; no `opacity-50` on the tags, the expand button, the clear button or the input).
- "the previous arrow at the start of the text focuses the last tag; not with text before the caret, a selection or a modifier" (and Right in RTL, `renderWithProviders(…, { dir: 'rtl' })`).
- "a press on the control's empty area toggles the list and keeps focus in the input; a press on a tag's text does the same; read-only only focuses; disabled does nothing" (`fireEvent.mouseDown` + `click` on the control element and on a tag's primary text; `defaultPrevented` asserted).
- "a click on the input opens the list and never closes it".
- "the default filter matches textValue before label" (registration mode, `TagPicker.Option textValue`).
- "makes the option whose label equals the typed text active (Pineapple, Apple → apple)"; "ranks a pasted text too" (`user.paste`); "does not re-rank a controlled query set by the parent".
- Expand button: "shows a chevron named Show options, not a Tab stop, with aria-expanded and aria-controls only while expanded"; "toggles the list on click and keeps focus in the input"; "is disabled while disabled or read-only"; `it.each([null, undefined])` "keeps the chevron for %s"; `it.each([false, '', [], <></>])` "hides the button and its padding for %s"; "renders a custom glyph"; "unwraps a button glyph and warns TagPicker:expandIcon-button" (exact message, nothing else logged); "TagPicker.Control's expandIcon wins over the root's"; `it.each(sizes)` "places the end buttons on the first row at size=%s" (box, `end-*`, `top-*`, glyph size, the control's `pe-*`).
- Clear button: "renders no clear button without tags, while read-only, or without clearable"; "is a Tab stop after the input, named Clear selection"; "clears every tag once, the query, closes the list and focuses the input, announcing nothing"; "is natively disabled while disabled"; "labels.clear names it".
- "renders data-overflow='wrap' by default".
- StrictMode: "calls onValueChange once per removal and onOptionCreate once per creation".

`src/components/input/__tests__/TagPicker.parts.test.tsx` (new):
- `testSystemProps` for `TagPickerControl` (`div`), `TagPickerGroup` (`div`, with a selected value), `TagPickerInput` (`input`), `TagPickerButton` (`button`), `TagPickerList` (`ul`), `TagPickerOption` (`li`, inside a TagPicker List) — each with a `wrapper` that renders the TagPicker (and Control) around it: ref, rest props, `className` merging, `displayName`, the root class and the variant bases (`wave-option`, `wave-tag-group`), axe. `testNoImplicitSubmit` for `TagPickerButton`.
- `testCompoundExposure`: the seven flat names equal the members; `TagPickerOptionGroup === OptionGroup`.
- "renders the parts form with the roles, names, ids and classes of the simple form" (the same queries pass for both); "a Control without children renders a Group and an Input"; "a Group without children renders a Tag per selected value"; "a List without children renders the options entries"; "a parts form without a List renders the default list, so aria-controls resolves" (`findDanglingIdRefs` clean).
- "warns TagPicker.List:placement for a List inside a wrapper component, and for a second List" (exact message, nothing else logged).
- "warns TagPicker:trigger for a Control without a trigger and for two triggers" (exact messages).
- `it.each(parts)` "%s throws outside TagPicker in development" (`expectThrows('[WaveUI] TagPicker.Control must be used within TagPicker')`, …) and "logs once and renders inert in production" (`vi.stubEnv('NODE_ENV', 'production')`); "the Input and the Button throw outside TagPicker.Control".
- Rich tags: "renders consumer Tags with Avatar media in the Group; dismissing one calls onValueChange and announces the option's label"; "a consumer Tag is named Dismiss <text>, a default tag Remove <label>"; "a consumer Tag without value warns TagGroup:missing-value" (asserted); "renders no tag list while nothing is selected, whatever the Group's children".
- Registration mode: "hides selected TagPicker.Options and skips them with the keys"; "hides an OptionGroup whose options are all selected"; "never calls filter for a selected option"; "arrows cross groups; a group's heading names it".
- Labels: "shows a registered option's label in the tag in renderToString and after hydration" (`collectOptionLabels`, no mismatch, container removed in `finally`); "options name values when the List has children".
- Button trigger: "is a button combobox without aria-autocomplete, in the server HTML too"; "Down opens, typeahead moves, Enter and Space add and keep the list open, Escape closes, a click toggles"; "shows the placeholder while empty and nothing once a tag is selected"; "Backspace and the previous arrow focus the last tag"; "removing the last tag focuses the Button"; "allowCreate shows no create option and warns TagPicker:allowCreate-button once"; "renders aria-readonly while read-only"; "is labelled by its Field" (`renderWithFieldContext`).
- Routing: "root aria-label, id and aria-describedby reach the Input and the Button"; "the part's own id and aria-label win"; "aria-describedby joins part, root, Field and summary in that order"; "root maxLength, autoComplete and controlRef reach the Input only"; "handlers compose part, then root, then internal; preventDefault() in the part skips the built-in keys"; "the List's own aria-label names the listbox".
- `describe('sizes and appearances of the parts')`: `it.each` picker size × appearance with the parts form and a tag: the tags' and the group's `data-size` and `data-appearance` (D54), the chip's classes, the end buttons' boxes, offsets, `top-*` and glyphs, the control's end padding; "only the root renders data-size and data-appearance among TagPicker's own elements"; types: `// @ts-expect-error` for `size` and `appearance` on each part.
- RTL: "mirrors the tag arrows and the previous arrow at the caret start; the end buttons stay at the inline end" (`{ dir: 'rtl' }`).
- SSR: "renders and hydrates the parts form with preselected registered options, and the Button trigger" (`renderToString`, `findDanglingIdRefsInHtml`, `hydrateRoot`, no `console.error`).

`src/components/input/__tests__/TagPicker.option.test.tsx` (new): "renders media aria-hidden with its class and the second line under the text with its class"; "names the option with its text and second line"; "uses the text alone as the label of the tag, the filter and the announcement"; "its label prop wins"; "warns TagPicker.Option:label once for children without text, and uses the value" (exact message); "renders Option's DOM without media and secondaryContent"; "works in a Combobox"; "renders the same as a client reference" (`asClientReference(TagPickerOption)` in a List: same `renderToString`, same behaviour); "calls onClick once per click in StrictMode"; types: `TagPickerOptionProps` extends `OptionProps`, `media` takes `Slot<'span'>`, `const entry: TagPickerOption = { value, label }` still compiles next to `<TagPickerOption value="a" />`.

`src/components/input/__tests__/TagPicker.freeTagging.test.tsx` (new; the issue's acceptance):
- "type infra: the list shows only Create "infra", it is active, Enter creates" (`onOptionCreate` called once with `'infra'` before `onValueChange([…, 'infra'])`, once each in StrictMode; the tag "infra"; the input cleared through `onQueryChange('')`; the list open; `__getAnnouncerText()` = `infra added, 1 selected`).
- "type a: the create option is last and the first match active; ArrowDown reaches it (aria-activedescendant resolves to it) and Enter creates".
- "a click on the create option creates and keeps focus in the input".
- `it.each(['', '  ', 'APPLE', '<a selected label>', '<a created value in another case>', '<an option value>'])` "shows no create option for %s" and "Enter picks the listed exact match, or does nothing with the match selected".
- "trims the text: '  infra  ' creates 'infra'".
- "never says No matches while the create option shows, in any commit" (status region empty after every `act` in registration mode, where the create option registers one commit later), "and says it again for a selected label's text".
- "submits a created value and a form reset drops it" (hidden inputs, `defaultValue` restored, reported once).
- "labels.create localizes the text and the option's name".
- "with filter={() => true} and async results, the create option follows the current options".
- "offers nothing while disabled or read-only; Tab, blur and close never create".
- "does not warn TagPicker:unknown-value with allowCreate; a controlled parent adding the option renames the tag".
- "a synthetic create option of a filter still works without allowCreate" (Phase 5 D13).
- "has no axe violations with the create option active" (`expectNoA11yViolations(document.body)`, `findDanglingIdRefs` clean).
- "creates with the deprecated onChange too".

`src/components/input/__tests__/TagPicker.create.test.ts` (new, pure): `createOptionText` table (empty and whitespace, trimming, label case folding, selected values, option values exact, a created value) and `findExactMatch` (first in list order, case folding, selected skipped, none).

`src/components/input/__tests__/TagPicker.overflow.test.tsx` (new; `installResizeObserverMock`, `mockRect` and stubbed `offsetWidth`/`clientWidth`/computed styles):
- "collapsed: hides the tags that do not fit (the first always stays) and shows an aria-hidden +N after them"; "renders data-overflow='count' and data-collapsed"; "labels.overflowCount localizes it".
- "focus on the input, a remove button (Shift+Tab) or the clear button, and opening the list, show every tag and drop the chip; leaving collapses again".
- "a press on the chip focuses the input and leaves the list closed" (`defaultPrevented`).
- "re-measures on a resize (the mock's trigger) and on a new tag; measures nothing in wrap mode" (`vi.spyOn(ResizeObserver.prototype, 'observe')` after installing the mock).
- "renders every tag and no chip on the server and hydrates without warnings".
- "keeps the chip after the visible tags in RTL".

`src/components/input/__tests__/stableClassNames.test.tsx`: "TagPicker parts: the member roots next to the 0.8 part classes" (control, group with `wave-tag-group`, input, list, the options from `options`, the default tags and remove buttons, from the constants); "TagPicker: the expand button and its icon, the clear button, the create option and the +N chip"; "TagPicker.Option: root with Option's, media and secondaryContent parts, also on a slot object's element"; "TagPicker.Button: root".

Repo-level cases are INTEGRATION's (handoff).

#### Stories

`stories/TagPicker.stories.tsx` (`Components/Input/TagPicker`; the meta carries no docblock and no `docs.description.component`, since TagPicker is now a compound: `exportDocblocks.test.ts`; TagPicker and its flat names from the module path in wave C, `../src/components/input/TagPicker`, normalised to `../src` by INTEGRATION; `Tag`, `Avatar` and `Field` from `../src`; every picker named; callbacks through `fn()`):
- New: `PeoplePicker` (the acceptance story: the parts form, `TagPicker.Option` with Avatar `media` and `secondaryContent`, consumer Tags with Avatars in `TagPicker.Group`), `ComposedParts` (Control with custom Tags, Input, a List of `TagPicker.Option`s), `OptionGroups`, `ButtonTrigger`, `FreeTagging` (`allowCreate` with `onOptionCreate` adding options), `FreeTaggingWithAsyncSearch`, `Clearable`, `SingleLine` (`overflow="count"`), `ExpandIcon` (a custom glyph and a hidden one), `LocalizedLabels`.
- Changed: `SizesAndAppearances` shows the parts form with tags at every size × appearance (the acceptance's story matrix; the stories axe gate covers the chevron's name).
- Kept: `Default`, `WithPreselected`, `Disabled`, `ReadOnly`, `CustomFilter`, `AsyncSearch`, `Invalid` (`meta`'s `options` in `args` still type-checks: `options` is optional).


---

### P6-05 — Drawer `size`, bottom position, header, body and footer parts (P6-overlays)

The Drawer gains Fluent's four sizes and a bottom position, and the parts of Fluent's drawer layout: `Drawer.Header` (which replaces the built-in header row) with `Drawer.HeaderTitle` (heading, an `action` area and the built-in Close button) and `Drawer.HeaderNavigation` (a `<nav>` row for a Back button or commands), an optional `Drawer.Body` (the scrolling body's props), and `Drawer.Footer`, an action row below the scrolling body that never scrolls. The body reports how far it is scrolled (`data-scroll-state`, mirrored on the header and the footer), which draws their separators. The 0.10 form (`title`, `closeLabel`, children as the body) keeps its DOM and classes. The Toaster learns a block offset, so toasts move above a bottom drawer as they move beside a side one. This is the first task of `P6-overlays`; it also splits `Drawer.tsx` into the modules the next two items and the panel shell (P6-07, D108) edit.

**Closes:** `drw-1` (M), `drw-2` (M), `drw-11` (M; the id is inferred from the report's §5 row 9 and §3 medium #12, recorded in §7), `drw-8` (L), `drw-9` (L), `drw-10` (L). **Guards:** toasts move out of a Drawer's way, beside an `end` drawer and above a `bottom` one (one test each in `Toast.test.tsx` and one with a real Drawer in `integration.test.tsx`); `Drawer.Trigger` and `Drawer.Close` unchanged (the 0.10 suite "Drawer.Trigger and Drawer.Close (overlays#33)" of `Drawer.test.tsx` passes without an edit).

#### Rulings

- **D70 — Drawer modules, imports one way.** `Drawer.tsx` keeps only the compound (`Object.assign`, its JSDoc, the flat re-exports and the type re-exports), as `Menu.tsx` and `Toast.tsx` do; nothing imports it. `Drawer.context.ts` holds the public types (`DrawerPosition`, `DrawerSize`, `DrawerType`, `DrawerModalType`, `DrawerOpenChangeReason`, `DrawerOpenChangeDetails`), the contexts and their hooks, and imports no component. `Drawer.scroll.ts` holds the scroll-state store (D81). `Drawer.panel.tsx` holds the panel shell (D108). `Drawer.parts.tsx` holds `DrawerTrigger`, `DrawerClose`, `DrawerTitle`, `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`, `DrawerFooter` and the internal `DrawerCloseButton`. `Drawer.root.tsx` holds `DrawerRoot` (no docblock, C-DOCS), the child scan, the layout and the development checks. Imports: `root → parts, panel, scroll, context`; `parts → context, scroll`; `panel → context`; never back. *Why:* the three items and the shell edit the root one after another and NavDrawer (P6-08) reads the shell and the scroll store without reading the root; the Menu and Toast splits are the precedent, and `.storybook/__tests__/exportDocblocks.test.ts` already follows a root imported from a sibling module.
- **D71 — Parts are placed by a static scan of the direct children.** `splitChildren` (today `Drawer.tsx:340`) also sorts `Drawer.Header` (into the header area, replacing the built-in header row), `Drawer.Body` (D77) and `Drawer.Footer` (after the body), through `flattenChildren` and `isElementOfType` (Server Component references included), keeping `flattenChildren`'s keys. Several Headers render in the header area in written order, several Footers after the body in written order (MessageBar.Actions precedent, Phase 3 judgement 20). Placed parts render inside `DrawerPartContext` with the value `'placed'`; the body content renders under `'content'`, and every part resets the value to `'content'` for its own children. A Header, Body or Footer that reads `'content'` renders where it is (inside the body) and warns once from an effect (`Drawer.Header:unscanned`, `Drawer.Body:unscanned`, `Drawer.Footer:unscanned`). *Why:* the scan already exists for triggers, runs on the server and recognises lazy references; Phase 3 D15 and P3-02 use the same mechanism and warning shape.
- **D72 — The simple form keeps its 0.10 DOM.** Without a `Drawer.Header` the built-in header is the 0.10 row: the `title` heading and the Close button are its direct children, it carries `wave-drawer__header`, and the Close button keeps `ms-auto` (P6-06's `titleAction` moves `ms-auto` to its own span only when it renders, D98). It is not built from the new parts. *Why:* Phase 3 D8 (moving a class is a "Changed (DOM)" entry); `stableClassNames.test.tsx:92` pins the Close button's parent as the header; consumer CSS such as `.wave-drawer__header > button` keeps working.
- **D73 — `title` and `titleAction` next to a `Drawer.Header`.** The part wins: `title` and `titleAction` render nothing and one warning says so (`Drawer:title-ignored`, §Behaviour), emitted when either renders content (`slotRendersContent`); the panel is then named by the title registry (a `Drawer.HeaderTitle` or `Drawer.Title`). *Why:* the Toast precedent (Phase 3 D9, `Toast:title-twice`); the Drawer cannot inject a heading into the consumer's header; one rule for both props of the `title` form (memo C22).
- **D74 — `Drawer.Footer` is a flex row below the scrolling body, start-aligned.** The panel is a flex column: the header area `shrink-0`, the body `min-h-0 flex-1 overflow-y-auto`, each footer `shrink-0`. The footer's items start at the inline start (`justify-content: flex-start`, Fluent's DrawerFooter), wrap (`flex-wrap`) and keep an 8px gap. This deviates from Phase 1 D10 (the sticky, measured `Dialog.Footer` of P1-21) **for the Drawer only**; `Dialog.Footer` rendered inside a Drawer stays the 0.5 action row (Phase 1 §9), unchanged and unwarned. A form in the body reaches a footer submit button through the native `form` attribute (`<form id="filters">` in the body, `<Button type="submit" form="filters">` in the footer); implicit submission (Enter in a field) still submits, since a submit button associated through `form` is the form's default button. *Why:* a Drawer panel is always the viewport's height, so a sticky footer inside the body would float under short content instead of ending the panel; outside the scrollport no field can scroll under the footer (WCAG 2.4.11) without a measured height or scroll padding; Fluent's structure (DrawerFooter is DrawerBody's sibling); D10's two concerns are met: forms by the `form` attribute, DOM order because the footer always renders after the body (memo C19). The alignment is open question Q-OV2 (§8).
- **D75 — The built-in Close button ends every `Drawer.HeaderTitle`.** Inside a `Drawer.Header`, each `Drawer.HeaderTitle` renders, after its heading and its `action` content, the same internal `DrawerCloseButton` as the built-in header: the Wave `Button` (`appearance="subtle"`, `size="small"`, the dismiss glyph), classes `wave-button` and `drawerClassNames.closeButton`, named by the Drawer's `closeLabel`, reason `'close-button'`, and following the Drawer's `closeButton` slot (D95; `closeButton={null}` hides it in every title row). A `Drawer.Header` without a `Drawer.HeaderTitle` has no built-in Close button (wrap your own in `Drawer.Close`). A `Drawer.HeaderTitle` outside a `Drawer.Header` renders no Close button and warns once (`Drawer.HeaderTitle:outside-header`). *Why:* WaveUI always renders a Close button (Dialog and Drawer since 0.5) and its glyph is not public, so a composed header could not reproduce it; P6-06 defines title actions as "before the built-in Close button in DOM and Tab order", and the Drawer's `action` must mean the same. Fluent renders no Close button (its `action` slot is "for the close button"): §8.3 entry, and open question Q-OV1.
- **D76 — `Drawer.Header`, `Drawer.Body` and `Drawer.Footer` are `<div>`s; `Drawer.HeaderNavigation` is a `<nav>`.** *Why:* a `<header>` or `<footer>` that is not scoped to a sectioning element maps to the banner and contentinfo landmarks (a `role="dialog"` div is no sectioning element), which Fluent cancels with `role="none"`; a `<div>` gives the same accessibility tree without a role override, as `Dialog.Footer` does. The `<nav>` is Fluent's and lets screen-reader users jump to the Back button of a multi-level drawer; its JSDoc advises an `aria-label` when the page has other navigation landmarks.
- **D77 — `Drawer.Body` is an optional props carrier.** A direct-child `Drawer.Body` puts its own props (`className` merged last, `style`, `ref`, `id`, `role`, `tabIndex`, `aria-*`, `data-*`, handlers) on the scrolling body element and renders its children in its place among the body content, in written order. Without one the body is implicit, as in 0.10. With several, the first one's props apply, every one's children render in place, and one warning says so (`Drawer.Body:duplicate`). An unscanned `Drawer.Body` (D71) renders a plain `<div>` with its props and children where it is. The body element carries `wave-drawer__body` and, while a placed `Drawer.Body` provides it, `wave-drawer-body`. *Why:* Fluent's `DrawerBody` (the report's "partial" row); a text-only scroll area can be made keyboard-scrollable (`tabIndex={0} role="region" aria-label`); memo C24. NavDrawer.Body builds on its own element (P6-08 decides; the shell takes raw children).
- **D78 — Sizes on the spacing scale; one size union for Drawer and Dialog.** `size?: DrawerSize` with `DrawerSize = SurfaceSize` (`SurfaceSize = CoreSize | 'full'`, a foundation type in `src/lib/types.ts`, also behind P6-06's `DialogSize`), default `'small'`. Side positions (`start`, `end`, `left`, `right`): width `w-80` (320px), `w-148` (592px), `w-235` (940px) or `w-full`, with `top-0 h-full max-w-full`. `bottom`: height `h-80`, `h-148`, `h-235` or `h-full`, with `inset-x-0 bottom-0 w-full max-h-full`. A width class in `className` (a height class for `bottom`) replaces the size (tailwind-merge, checked: `cn('w-148', 'w-[480px]')` → `w-[480px]`, `cn('h-235', 'h-[50vh]')` → `h-[50vh]`). The maps are module constants of `Drawer.panel.tsx`, keyed by axis, and the inline type reuses them (P6-07). *Why:* Fluent's values and default; rem units scale with the user's font size as 0.10's `w-80` does; `max-w-full`/`max-h-full` give Fluent's "a size larger than the screen acts as `full`"; a fixed element's `w-full` is the viewport without its scrollbar.
- **D79 — `bottom` draws a top border; the panel renders `data-position` and `data-size`.** `bottom` places the panel `inset-x-0 bottom-0 border-t` (its inner edge, like the side positions' 0.6 inner-edge border). Every panel renders `data-position` (`start | end | left | right | bottom`) and `data-size` (`small | medium | large | full`) with the resolved value, before `{...rest}` (Phase 1 D22). *Why:* the 0.6 rule that marks the panel in high contrast and forced colours (`Drawer.tsx:198-202`); C-CLASS; Phase 10 keys the slide direction and Fluent's per-size durations on them. Fluent's bottom drawer has no border: §8.3 entry.
- **D80 — Scroll state and separators.** The body's scroll state is `'none'` (the content fits), `'top'` (at the top, more below), `'middle'`, or `'bottom'` (at the end), with a 1px tolerance: `scrollHeight - clientHeight < 1` → `none`; `scrollTop < 1` → `top`; `scrollTop + clientHeight >= scrollHeight - 1` → `bottom`; else `middle`. It renders as the enumerated `data-scroll-state` on the body, the built-in header, every placed `Drawer.Header` and every `Drawer.Footer` (the parts read it from `DrawerScrollStateContext`). Separators are borders that always exist and only change colour: header `border-b border-transparent data-[scroll-state=middle]:border-border data-[scroll-state=bottom]:border-border`, footer `border-t border-transparent data-[scroll-state=top]:border-border data-[scroll-state=middle]:border-border`, both with `forcedColors.border` (`forced-colors:border-[CanvasText]`), so forced colours draw both lines at all times. No transition in 0.11. *Why:* Fluent's states and visibility rules (`useDrawerBody.ts`, header and footer styles) with a tolerance for fractional offsets (zoom, HiDPI) that Fluent's strict `===` misses; a transparent border never shifts the layout; a mirrored attribute lets each element style itself (the header precedes the body, so no sibling selector reaches it); the colour is the decorative `border` token (no contrast pair, `tokens.test.ts:666`); motion is Phase 10's (Phase 2 rule 15).
- **D81 — How the scroll state is measured.** `useScrollState(element)` (module-only, `Drawer.scroll.ts`) reads the state through `useSyncExternalStore`: `getSnapshot` computes it from the element (a string, so an unchanged value re-renders nothing), `getServerSnapshot` returns `'none'`, and `subscribe(onChange)` installs, for the element held in state through a callback ref, a passive `scroll` listener on it, a `ResizeObserver` on it and on its element children (where `ResizeObserver` exists) and a `MutationObserver` on it (`childList`, `subtree`, `characterData`, `attributes`) whose callback re-observes the children and calls `onChange`. It lives in an internal layout component (`DrawerLayout`, `Drawer.root.tsx`) that receives the header area, the body content and the footers as props, so a change re-renders the header, body and footer elements but not the consumer's content (the same element objects bail out). It adds no `document` listener. *Why:* C-HOOKS ("DOM-derived collections through `useSyncExternalStore` + a Mutation/ResizeObserver"); content can grow without a Drawer render (an Accordion expanding, an image loading) while the body's own box stays the same, so observing only the body (Fluent) misses it; emitting only on change keeps jsdom tests free of act() warnings (every measure is 0 there); `Drawer.test.tsx:1698` pins the document listeners.
- **D82 — The built-in header's line becomes scroll-reactive.** The 0.10 built-in header's permanent `border-b border-border` becomes D80's header separator: invisible while the body is at its top or fits, visible once it is scrolled; always drawn in forced colours. A "Changed (visual)" entry. *Why:* one look for both forms and the intent of `drw-10`; forced colours keep 0.10's permanent line. Open question Q-OV3 (§8) offers the 0.10 line.
- **D83 — Heading levels.** `Drawer.Title` and `Drawer.HeaderTitle` take `headingLevel?: HeadingLevel` (`1 | 2 | 3 | 4 | 5 | 6`, the foundation's shared type, default `2`), which picks the heading element (`h1` … `h6`). The `title` prop heading stays an `h2`; its JSDoc points to `Drawer.HeaderTitle` for another level. `Dialog.Title` stays an `h2` (`dialogtitle-1` stays in the backlog, §8.2). *Why:* closes the "always an h2" half of `drw-8`; Fluent's `heading` slot also allows a `div`, which `headingLevel` cannot express (§8.3 entry); `dialogtitle-1` is not in the phase's scope (§7 counts).
- **D84 — Toasts move above a bottom panel.** `getSidePanelOffset` becomes `getPanelOffsets(viewport, position): { inline: number; block: number }`. It reads every open layer of kind `'modal'` or `'dialog'` (the non-modal kind of P6-06, D90). For each element of such a layer that reaches the toasts' side and their top or bottom edge within `EDGE_GAP` (0.6 rule): when the toasts fit beside it (`width - inlineOffset >= region width + 2 * EDGE_GAP`, `inlineOffset = right ? width - box.left : box.right`) it is an inline candidate; otherwise, when they fit above it for bottom toasts (below it for top toasts) (`height - blockOffset >= region height + 2 * EDGE_GAP`, `blockOffset = top ? box.bottom : height - box.top`) it is a block candidate; otherwise it is ignored (the toasts keep their corner). Each axis takes the maximum over its candidates and is checked again for room (`0` without). `--wave-toaster-offset` (0.6) carries the inline offset and the new `--wave-toaster-offset-block` the block one, each set on the region's style only while it is above 0. Every position class gains `mb-(--wave-toaster-offset-block)` (bottom positions) or `mt-(--wave-toaster-offset-block)` (top positions). The measuring layout effect (`Toaster.tsx:1028-1045`) also measures when the region's own size changes (a `ResizeObserver` on the region, where available), since the stack's height decides whether it fits above. *Why:* the roadmap guard; the rule is geometric, so nothing ties the Toaster to the Drawer, a full-height side panel can never take the block path and a full-width bottom panel never the inline path; a side panel and a bottom panel open together move the toasts on both axes (0.10's single maximum kept the corner then); the 0.6 inline tests stay as they are.
- **D85 — Safe-area insets on overlay panels (memo C20).** An overlay panel pads the insets of the screen edges it touches, with the one formula `max(<padding>, env(safe-area-inset-*))`; the panel's own padding is 0, so it is written `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]`: side panels both; `bottom` panels the bottom one, and the top one too with `size="full"`. Side insets (a landscape notch) are not padded. Inline panels pad nothing. The insets are 0 unless the page sets `viewport-fit=cover`. *Why:* side and bottom panels reach the screen's bottom edge, where the iOS home indicator would cover the footer's buttons; a bottom panel that does not reach the top must not reserve the top inset; side insets need a logical mapping per position for little gain (the `full` Dialog, which covers every edge, pads all four, D96).

#### API

```ts
// src/components/overlays/Drawer.context.ts (re-exported from Drawer.tsx)

/**
 * Side of the screen (an overlay drawer) or of its container (an inline one) the drawer is
 * attached to. `start`/`end` follow the text direction (in a right-to-left layout `end` is the
 * left edge); `left`/`right` are physical sides; `bottom` runs along the bottom edge, as wide as
 * the viewport (or the container).
 */
export type DrawerPosition = 'start' | 'end' | 'left' | 'right' | 'bottom';

/**
 * How much room a Drawer takes: its width at a side, its height at the bottom. `small` 320px,
 * `medium` 592px, `large` 940px; `full` the viewport (an overlay) or the container (inline).
 */
export type DrawerSize = SurfaceSize; // 'small' | 'medium' | 'large' | 'full'

// src/components/overlays/Drawer.root.tsx — DrawerProps (0.10 members unchanged unless shown)
export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /**
   * Side of the screen the drawer is attached to. `start`/`end` follow the text direction;
   * `left`/`right` are physical sides; `bottom` runs along the bottom edge (`size` sets its
   * height). Rendered as `data-position`.
   * @default 'end'
   */
  position?: DrawerPosition;
  /**
   * The panel's width at a side — `small` 320px, `medium` 592px, `large` 940px, `full` the
   * viewport's width — or its height at the bottom (the same values; `full` the viewport's height).
   * It never exceeds the viewport. A width class in `className` (a height class for `bottom`)
   * replaces it. Rendered as `data-size`. Fluent's `size`.
   * @default 'small'
   */
  size?: DrawerSize;
  /**
   * Title displayed in the built-in header; it names the drawer (`aria-labelledby`). Without it,
   * render a `Drawer.HeaderTitle` (in a `Drawer.Header`) or a `Drawer.Title`, or pass
   * `aria-label`/`aria-labelledby`. A title that renders nothing (`''`, `[]`, `true`) counts as
   * none. Ignored, with a development warning, when the children hold a `Drawer.Header`, which
   * replaces the built-in header. The heading is an `<h2>`; for another level use
   * `Drawer.HeaderTitle` with `headingLevel`.
   */
  title?: React.ReactNode;
  /**
   * Accessible name of the built-in Close button (an icon-only button), in the built-in header and
   * in every `Drawer.HeaderTitle`. Localize it with the page's language.
   * @default 'Close'
   */
  closeLabel?: string;
  /**
   * The drawer's content, placed by the Drawer, also from a Fragment and when written in a Server
   * Component: `Drawer.Trigger` children render in place (outside the panel); a `Drawer.Header`
   * replaces the built-in header (the `title` and Close button row); a `Drawer.Body` gives the
   * scrolling body its props; `Drawer.Footer` renders below the scrolling body, outside it,
   * wherever it is written among the children; everything else renders in the scrolling body. A
   * part nested in another element (a `<form>`) or rendered by a component of yours renders where
   * it is, in the body (a development warning says so). [0.10 trigger sentences unchanged, with
   * P6-07's kept-mounted wording.]
   */
  children: React.ReactNode;
  // modalType, backdrop, closeButton, titleAction: P6-06; type, separator, unmountOnClose, the
  // HTMLElement widening of the props and `ref`: P6-07.
}

/** Properties for the DrawerTitle sub-component (0.10, plus `headingLevel`). */
export interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
  /** Level of the heading element (`h1` … `h6`). Fluent's `heading` slot. @default 2 */
  headingLevel?: HeadingLevel;
  ref?: React.Ref<HTMLHeadingElement>;
}

/** Properties for the DrawerHeader sub-component. */
export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `Drawer.HeaderNavigation`, `Drawer.HeaderTitle`, or any content, in the order written. */
  children?: React.ReactNode;
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerHeaderTitle sub-component. */
export interface DrawerHeaderTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The title; any content. The heading names the drawer (`aria-labelledby`). */
  children: React.ReactNode;
  /**
   * Content between the heading and the built-in Close button, such as icon buttons for the
   * drawer's own commands (Fluent's `action`). It comes before the Close button in DOM and Tab
   * order and is interactive (not `aria-hidden`): name icon-only buttons. Renders nothing when it
   * renders no content.
   */
  action?: Slot<'span'>;
  /** Id of the heading element, the element that names the drawer. @default a generated id */
  id?: string;
  /** Level of the heading element (`h1` … `h6`). Fluent's `heading` slot. @default 2 */
  headingLevel?: HeadingLevel;
  /** Ref to the title row (the heading's parent). */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerHeaderNavigation sub-component. */
export interface DrawerHeaderNavigationProps extends React.HTMLAttributes<HTMLElement> {
  /** The navigation controls: a Back button, a Toolbar of commands. */
  children?: React.ReactNode;
  /** Ref to the `<nav>` element. */
  ref?: React.Ref<HTMLElement>;
}

/** Properties for the DrawerBody sub-component. */
export interface DrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content of the scrolling body, rendered in the Body's place among the other content. */
  children?: React.ReactNode;
  /** Ref to the scrolling body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the DrawerFooter sub-component. */
export interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The drawer's actions, typically buttons (wrap closing ones in `Drawer.Close`). */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

// src/components/overlays/Drawer.tsx
export const Drawer = /* @__PURE__ */ Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Close: DrawerClose,
  Title: DrawerTitle,
  Header: DrawerHeader,
  HeaderTitle: DrawerHeaderTitle,
  HeaderNavigation: DrawerHeaderNavigation,
  Body: DrawerBody,
  Footer: DrawerFooter,
});
// Flat names, each with its own JSDoc (verify-dist's undocumented-component check):
export { DrawerTrigger, DrawerClose, DrawerTitle, DrawerHeader, DrawerHeaderTitle,
  DrawerHeaderNavigation, DrawerBody, DrawerFooter };
```

Component JSDoc of the parts (C-DOCS; the exact text is the implementer's, the content is binding):

- **`Drawer.Header`** — the drawer's header, replacing the built-in one (the `title` and Close button row): a `Drawer.HeaderNavigation` row and a `Drawer.HeaderTitle`, or your own content. A direct child of `Drawer` (a Fragment there is fine); elsewhere it renders in the body with a development warning. It draws a line under itself while the body is scrolled away from its top (`data-scroll-state`). Initial focus goes to its first focusable element (a Back button, a title action): give the control that should start `autoFocus`. Fluent's `DrawerHeader`.
- **`Drawer.HeaderTitle`** — a title row for `Drawer.Header`: the heading that names the drawer, your `action` content and the built-in Close button (named by the Drawer's `closeLabel`, hidden by its `closeButton={null}`), in that DOM and Tab order. Render one per header. Outside a `Drawer.Header` it renders without the Close button and warns: use `Drawer.Title` for a heading in the body. Unlike Fluent's `DrawerHeaderTitle`, it renders the Close button itself.
- **`Drawer.HeaderNavigation`** — a `<nav>` row at the top of `Drawer.Header`, for a multi-level drawer's Back button and the drawer's commands. Give it an `aria-label` when the page has other navigation landmarks. Fluent's `DrawerHeaderNavigation`.
- **`Drawer.Body`** — optional: gives the scrolling body your props (`className`, `ref`, `role`, `tabIndex`, `aria-*`, handlers; for example `tabIndex={0} role="region" aria-label="…"` to let the keyboard scroll a body without focusable content). Its children render in its place among the drawer's other content. A direct child of `Drawer`; render one. Fluent's `DrawerBody`.
- **`Drawer.Footer`** — the drawer's action row, below the scrolling body: it never scrolls and never covers a focused field. A direct child of `Drawer` (a Fragment there is fine), rendered after the body wherever it is written; nested in an element (a `<form>`) or rendered by your component it renders where it is, in the body, with a development warning. For a form in the body, give the footer's submit button `form={formId}`. It draws a line above itself while content continues below (`data-scroll-state`). Fluent's `DrawerFooter`.
- The root docblock gains bullets **Size and position** (`size`, `bottom`, `className` overrides), **Layout** (Header, HeaderTitle, HeaderNavigation, Body, Footer; separators) and names the new flat names in its RSC sentence.

#### Behaviour

**Keyboard and focus.** No new keys. Tab order is DOM order: the header area (navigation, title `action`, Close), the body, the footers. Initial focus keeps the focus trap's `'first'` rule: the built-in header's Close button in the simple form; in the composed form the first focusable element of `Drawer.Header` (a Back button, a title action), else the body's. The footer is inside the panel, so trap, isolation and the Tab cycle are unchanged.

| Key | Where | Action |
|---|---|---|
| Tab / Shift+Tab | panel | header area → body → footers, in DOM order (modal: trapped, toasts included, 0.10) |
| Enter / Space | the Close button of the built-in header or of a `Drawer.HeaderTitle` | closes (`details.reason === 'close-button'`) |
| Enter / Space | a `Drawer.Close` child in a footer or header | closes (`'close'`) |
| Enter | a field of a form whose submit button sits in `Drawer.Footer` with `form` | submits the form (implicit submission) |

**Pointer.** Backdrop press, drag-from-panel and nested-layer rules unchanged (`useBackdropPress`; P6-06 moves the backdrop, D93).

**ARIA.** The panel's `aria-labelledby`: the `title` heading when it renders content and no `Drawer.Header` exists, else the first registered title (`useTitleRegistry`). A `Drawer.HeaderTitle` heading registers through `useModalTitle('Drawer.HeaderTitle', 'Drawer', id, ref)`; header headings register before body `Drawer.Title`s (ref callbacks run in DOM order). `Drawer.HeaderNavigation` is a navigation landmark inside the dialog; Header, Body and Footer are generic `<div>`s.

**Content that renders nothing.** A `Drawer.Footer` whose children render nothing (`slotRendersContent`) renders no element. A `Drawer.Header` always replaces the built-in header; when it renders nothing it renders no element, and the drawer has no header (Escape, the backdrop and `Drawer.Close` still close it). A `Drawer.HeaderTitle` `action` that renders nothing renders no span.

**Announcements.** None new.

**SSR and hydration.** Overlay panels render only in the browser (0.10, `Drawer.tsx:373-374`); the scan runs on the server too, but only triggers reach the HTML. `useScrollState`'s server snapshot is `'none'`. Inline drawers (P6-07) render the parts in the server HTML with `data-scroll-state="none"`.

**RTL.** Logical classes only (`start-0`/`end-0`, `border-s`/`border-e`, `gap`, `ms-auto`); the title row and the navigation row mirror with the document. `bottom` is direction-neutral (`inset-x-0` passes the gate, `conventions.test.ts:1407`). A Back arrow is the consumer's glyph (the story mirrors it with `wave-rtl:-scale-x-100`).

**Forced colours.** The inner-edge borders (`bottom`'s `border-t` included) and both separators are drawn at all times (`border-transparent` plus `forcedColors.border`); `bg-background` becomes Canvas.

**Reduced motion.** Nothing animates (D80).

**Development warnings** (effects, `warnOnce`; the `[WaveUI] ` prefix is added by `src/lib/dev.ts`):

| Key | When | Message |
|---|---|---|
| `Drawer.Header:unscanned` | a Header renders under `'content'` | `Drawer.Header is not a direct child of Drawer, so it renders inside the body instead of replacing the header. Make it a direct child (a Fragment there is fine).` |
| `Drawer.Body:unscanned` | a Body renders under `'content'` | `Drawer.Body is not a direct child of Drawer, so its props do not reach the scrolling body and it renders as an element inside it. Make it a direct child (a Fragment there is fine).` |
| `Drawer.Footer:unscanned` | a Footer renders under `'content'` | ``Drawer.Footer is not a direct child of Drawer, so it renders inside the scrolling body instead of below it. Make it a direct child (a Fragment there is fine); a submit button in it can name a form in the body with the `form` attribute.`` |
| `Drawer.Body:duplicate` | the scan finds more than one Body | `Drawer has more than one Drawer.Body: the props of the first one apply to the scrolling body, and the children of every one render in their place. Render one Drawer.Body.` |
| `Drawer.HeaderTitle:outside-header` | a HeaderTitle outside a `Drawer.Header` (`DrawerHeaderContext` false) | `Drawer.HeaderTitle is not inside a Drawer.Header, so it renders in the body without the Close button. Put it in a Drawer.Header, or use Drawer.Title for a heading in the body.` |
| `Drawer:title-ignored` | `title` or `titleAction` renders content and the scan found a Header | ``Drawer: `title` and `titleAction` are ignored because a Drawer.Header is among the children. Put a Drawer.HeaderTitle (with its `action`) in the header instead.`` |
| `Drawer:unnamed` (text changed) | as 0.10 | ``Drawer has no accessible name. Pass `title`, render a Drawer.HeaderTitle or a Drawer.Title inside it, or give it `aria-label` or `aria-labelledby`.`` (`useUnnamedModalWarning`'s `titleName` becomes `'Drawer.HeaderTitle or a Drawer.Title'`) |
| C-CONTEXT | `Drawer.Header`, `.HeaderTitle`, `.HeaderNavigation`, `.Body` or `.Footer` outside a Drawer | `[WaveUI] Drawer.Header must be used within Drawer` (each part its own name; `reportMissingContext`, inert value in production) |

#### DOM and classes

Simple form, open (0.10 DOM; new attributes and separator classes; P6-06 moves the backdrop to a sibling, D93):

```
<div role="dialog" id aria-labelledby tabIndex=-1 data-position="end" data-size="small" …
     class="wave-drawer fixed flex flex-col border-border bg-background text-foreground shadow-64
            end-0 top-0 h-full max-w-full border-s w-80 pt-[env(…top)] pb-[env(…bottom)] {className}">
  <div class="wave-drawer__header flex shrink-0 items-center justify-between gap-2 border-b
              border-transparent p-4 data-[scroll-state=middle]:border-border
              data-[scroll-state=bottom]:border-border forced-colors:border-[CanvasText]"
       data-scroll-state="none">
    <h2 id class="wave-drawer-title text-subtitle-1 font-semibold">Filters</h2>
    <button class="wave-button … wave-drawer__close-button ms-auto text-muted-foreground" aria-label="Close">…</button>
  </div>
  <div class="wave-drawer__body min-h-0 flex-1 overflow-y-auto p-4" data-scroll-state="none">…</div>
</div>
```

Composed form:

```
<div role="dialog" …>
  <div class="wave-drawer-header flex shrink-0 flex-col gap-2 border-b border-transparent p-4
              {header separator variants} forced-colors:border-[CanvasText]" data-scroll-state>
    <nav class="wave-drawer-header-navigation flex items-center gap-1">…</nav>
    <div class="wave-drawer-header-title flex items-start gap-2">
      <h2 id class="wave-drawer-header-title__heading min-w-0 flex-1 text-subtitle-1 font-semibold text-foreground">Title</h2>
      <span class="wave-drawer-header-title__action flex min-h-7 shrink-0 items-center gap-1">…</span>
      <button class="wave-button … wave-drawer__close-button mt-0.5 shrink-0 text-muted-foreground" aria-label="Close">…</button>
    </div>
  </div>
  <div class="wave-drawer__body [wave-drawer-body] min-h-0 flex-1 overflow-y-auto p-4" data-scroll-state>…</div>
  <div class="wave-drawer-footer flex shrink-0 flex-wrap items-center gap-2 border-t border-transparent p-4
              data-[scroll-state=top]:border-border data-[scroll-state=middle]:border-border
              forced-colors:border-[CanvasText]" data-scroll-state>…</div>
</div>
```

| Element | Classes after its stable class | data-* |
|---|---|---|
| overlay panel | `fixed flex flex-col border-border bg-background text-foreground shadow-64` + placement (side: `top-0 h-full max-w-full` + `start-0 border-e` / `end-0 border-s` / `left-0 border-r` / `right-0 border-l`, the physical two with `// wave-allow-physical: the consumer asked for the physical edge`; bottom: `inset-x-0 bottom-0 w-full max-h-full border-t`) + size (side `w-80 / w-148 / w-235 / w-full`; bottom `h-80 / h-148 / h-235 / h-full`) + insets (D85) | `data-position`, `data-size` (enumerated, before `{...rest}`) |
| built-in header | `flex shrink-0 items-center justify-between gap-2 border-b border-transparent p-4` + header separator variants + `forced-colors:border-[CanvasText]` | `data-scroll-state` |
| body | 0.10 `min-h-0 flex-1 overflow-y-auto p-4`, then a placed Body's `className` | `data-scroll-state` |
| `Drawer.Header` | `flex shrink-0 flex-col gap-2 border-b border-transparent p-4` + header separator variants + forced colours | `data-scroll-state` |
| `Drawer.HeaderTitle` | row `flex items-start gap-2`; heading `min-w-0 flex-1 text-subtitle-1 font-semibold text-foreground`; action `flex min-h-7 shrink-0 items-center gap-1`; Close `mt-0.5 shrink-0 text-muted-foreground` (a 24px button centred on the 28px first line) | — |
| `Drawer.HeaderNavigation` | `flex items-center gap-1` (no negative margins: its buttons align with the Close button and the title text) | — |
| `Drawer.Footer` | `flex shrink-0 flex-wrap items-center gap-2 border-t border-transparent p-4` + footer separator variants + forced colours | `data-scroll-state` |
| unscanned `Drawer.Body` | `{className}` only | — |

`data-scroll-state`: `none | top | middle | bottom`, always rendered. `data-position`: `start | end | left | right | bottom`. `data-size`: `small | medium | large | full`.

Stable class names (the foundation registers them, §1; the JSDoc follows the bare-word rule):

| Constant | Keys |
|---|---|
| `drawerHeaderClassNames` | `root: 'wave-drawer-header'` (the placed header) |
| `drawerHeaderTitleClassNames` | `root: 'wave-drawer-header-title'`, `heading: 'wave-drawer-header-title__heading'`, `action: 'wave-drawer-header-title__action'` |
| `drawerHeaderNavigationClassNames` | `root: 'wave-drawer-header-navigation'` |
| `drawerBodyClassNames` | `root: 'wave-drawer-body'` (on the scrolling body while a placed `Drawer.Body` provides its props; on an unscanned Body's own element) |
| `drawerFooterClassNames` | `root: 'wave-drawer-footer'` |

The Close button of a `Drawer.HeaderTitle` carries `buttonClassNames.root` and `drawerClassNames.closeButton` (one hook for "the Drawer's built-in Close button", judgement 13 precedent). A placed Header carries only its own class (MessageBar.Actions precedent); the built-in header keeps `wave-drawer__header`. `drawerClassNames`' JSDoc says that `header` is the built-in row (absent with a `Drawer.Header`) and names `data-position`, `data-size` and `data-scroll-state`.

#### Built-in text

No new string. The Close button of every `Drawer.HeaderTitle` is named by the Drawer's `closeLabel` (default `'Close'`). README built-in text row: "`closeLabel` (the Close button, also the one in each `Drawer.HeaderTitle`)".

#### Tests

New file `src/components/overlays/__tests__/Drawer.parts.test.tsx`:

- **Sizes and positions:** `it.each` of the four sizes × a side position → the width class and `data-size`; default `size` → `w-80`, `data-size="small"`; `bottom` × the four sizes → `h-*`, `w-full`, `inset-x-0`, `bottom-0`, `max-h-full`, `border-t`, no `top-0`/`h-full`; `data-position` for each position, the default `end` included; `className="w-[480px]"` replaces the width and `h-[50vh]` a bottom height; RTL (`renderWithProviders(…, { dir: 'rtl' })`) keeps the logical classes and a `bottom` panel's classes.
- **Forced colours (class level):** the bottom panel's `border-t`; `border-transparent` and `forced-colors:border-[CanvasText]` on the built-in header, a placed Header and a Footer; the inner edge per position (start `border-e`, end `border-s`, left `border-r`, right `border-l`, bottom `border-t`), each without the other edges.
- **Safe-area insets:** side panels carry `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]`; a `bottom` `small` panel only the bottom one; a `bottom` `full` panel both.
- **Routing:** a Header replaces the built-in header (no `drawerClassNames.header`, no Close outside the HeaderTitle); a Footer written before the content renders after the body (DOM order header, body, footer, asserted with `compareDocumentPosition`); parts in a Fragment and in a conditional Fragment; several Footers in written order; body content keeps its state when a Footer appears (an input's typed text survives, `flattenChildren` keys); `asClientReference(DrawerHeader)`, `…(DrawerBody)`, `…(DrawerFooter)` are placed like the plain parts and the closed drawer's `renderToString` is identical.
- **Unscanned:** a Footer inside a `<form>` renders in the body and warns once with the exact message, nothing else logged; a Header and a Body inside a component warn; placed parts do not warn; StrictMode warns once.
- **`Drawer.Body`:** its `className`, `style`, `id`, `role`, `tabIndex`, `aria-label`, `data-*`, `onScroll` and `ref` land on the scrolling body (`drawerClassNames.body` and `drawerBodyClassNames.root` on one element); its children render in place between other content; two Bodies → the first one's props, both children, the exact `Drawer.Body:duplicate` warning; `testSystemProps(Drawer.Body, { wrapper: createOverlayTestWrapper(Drawer, { defaultOpen: true, title: 'Settings' }), expectedTag: 'div', displayName: 'DrawerBody', defaultProps: { children: 'Body' } })`.
- **`Drawer.HeaderTitle`:** names the panel (`getByRole('dialog', { name })`); a consumer `id` lands on the heading and is the `aria-labelledby` target; `headingLevel` 1 … 6 renders `h1` … `h6`, default `h2`; `action` renders between the heading and the Close button in DOM and Tab order (`user.tab()`); an `action` that renders nothing renders no span; the Close button is named by `closeLabel`, closes with `details.reason === 'close-button'` and returns focus to the trigger; outside a Header: no Close button and the exact `outside-header` warning; RTL: the row's classes are logical, DOM order unchanged.
- **`Drawer.HeaderNavigation`:** a `<nav>` (`getByRole('navigation', { name })` with an `aria-label`), `className` and `ref` forwarded; its Back button is first in the Tab order and takes the initial focus.
- **`title` with a Header:** `title` and `titleAction` ignored, the exact `Drawer:title-ignored` warning once, the panel named by the HeaderTitle.
- **Footer:** `Drawer.Close` inside closes (`'close'`) and returns focus; a form in the body with a footer submit `form={id}` submits on click and on Enter in a field (implicit submission; `onSubmit` spy with `preventDefault`), and the footer is not inside the scrolling body; an empty Footer renders no element; `testNoImplicitSubmit(Drawer, { defaultProps: { open: true, 'aria-label': 'Settings', children: <><Drawer.Header><Drawer.HeaderTitle action={<Button>Expand</Button>}>Settings</Drawer.HeaderTitle></Drawer.Header><Drawer.Footer><Drawer.Close><Button>Done</Button></Drawer.Close></Drawer.Footer></> } })` (no `title` next to the Header, so nothing warns).
- **System props of the parts:** `testSystemProps` for `Drawer.Header` (`'div'`), `Drawer.HeaderTitle` (`'div'`), `Drawer.HeaderNavigation` (`'nav'`) and `Drawer.Footer` (`'div'`), with `createOverlayTestWrapper(Drawer, { defaultOpen: true, 'aria-label': 'Settings' })` (no `title`, so no ignored-title warning; the panel stays named); `Drawer.HeaderTitle` and `Drawer.HeaderNavigation` use a wrapper component that renders that Drawer with a `Drawer.Header` around the part.
- **C-COMPOUND / C-REF / misplaced:** `DrawerHeader === Drawer.Header` (and the other four flat names); the props interfaces declare `ref`; each new part outside a Drawer throws `[WaveUI] Drawer.X must be used within Drawer` (`expectThrows`).
- **axe:** open with Header, HeaderNavigation, HeaderTitle with an action, Body and Footer; a `bottom` drawer; inside a page that has its own `<nav>` (the drawer's nav is named).

New file `src/components/overlays/__tests__/Drawer.scroll.test.tsx` (stub `scrollHeight`, `clientHeight` and `scrollTop` with `Object.defineProperty` on the body; `fireEvent.scroll(body)` in `act`):

- fits → `data-scroll-state="none"` on body, built-in header and footer; top → footer line class path (`data-scroll-state="top"` everywhere); middle; bottom; `scrollTop + clientHeight = scrollHeight - 0.4` → `bottom`; content growth through the `MutationObserver` (`await act(async () => {})`) and a child's `ResizeObserver` trigger (`installResizeObserverMock`, `trigger(child)`); a drawer without `ResizeObserver` still measures on scroll; no act() warnings (`--reporter=default` clean); StrictMode; the consumer's content does not re-render on a state change (a render counter in a child component stays at 1); the built-in header mirrors the attribute; `useScrollState(null)` is `'none'`; no `document` listener is added (`vi.spyOn(document, 'addEventListener')` around open and scroll).

`src/components/overlays/__tests__/stableClassNames.test.tsx`: new cases "Drawer.Header, HeaderTitle (heading, action, the Close Button), HeaderNavigation, Body and Footer" reading the constants; the 0.10 Drawer case stays as the D72 guard (P6-06 changes its backdrop line only).

`src/components/feedback/__tests__/Toast.test.tsx` (suite "Toaster: beside an open modal side panel"): `BOTTOM_EDGE = { left: 0, right: 1024, top: 448, bottom: 768 }`; `bottom-end`, `bottom-start`, `bottom-right`, `bottom-left` → `--wave-toaster-offset-block` `320px` and `--wave-toaster-offset` `''`; `top-end` with `BOTTOM_EDGE` → none; `FULL_WIDTH` (a full-viewport panel) → none on both axes; the classes `mb-(--wave-toaster-offset-block)` on bottom positions and `mt-(--wave-toaster-offset-block)` on top ones; RTL `bottom-end` with `BOTTOM_EDGE` → `320px`; a stack that does not fit above (stub the region's `offsetHeight` at 400) keeps the corner; it measures again when the region resizes (`installResizeObserverMock().trigger(region)`) and on window resize; closing the panel clears the variable; an `END_EDGE` panel and a `BOTTOM_EDGE` panel together set both variables. The 0.6 cases stay unchanged.

Guard tests by name: "Drawer.Trigger and Drawer.Close (overlays#33)" (`Drawer.test.tsx`, unchanged); "Dialog.Footer inside a Drawer › is a plain action row at the end of the body …" (unchanged: D74 does not leak the sticky technique); "does not re-register document listeners when the parent re-renders" (unchanged); the integration case "a real bottom and end Drawer move the toasts" (INTEGRATION, §4).

#### Stories

`stories/Drawer.stories.tsx`: `positions` gains `'bottom'`, `args` gain `size: 'small'`, `argTypes` a `size` select. New stories: **Sizes** (a trigger per size), **BottomPosition** (`position: 'bottom'`), **HeaderAndFooter** (`defaultOpen: true` so the stories gate audits the parts: Header with HeaderTitle and an icon-button `action` named "Expand", a body, a Footer with Apply in `Drawer.Close` and Reset), **LongContent** (thirty labelled fields; the separators show; the footer stays), **FormInDrawer** (a form in the body, the footer submit with `form`), **MultipleLevels** (HeaderNavigation with a Back button whose arrow glyph carries `wave-rtl:-scale-x-100`, the level in state, the HeaderTitle following it), **ScrollableTextBody** (`Drawer.Body` with `tabIndex={0} role="region" aria-label`). The existing stories' hand-made action rows (`Drawer.stories.tsx:35-39`, `99-103`) become `Drawer.Footer`. Every story named; glyphs tokens-only.

### P6-06 — Non-modal Dialog and Drawer; backdrop and Close button slots; Dialog sizes and title actions (P6-overlays)

`modalType` gains Fluent's third value, `'non-modal'`, on Dialog and on Drawer (which gets `modalType` for the first time, `'alert'` included): a non-modal surface has no backdrop, traps nothing, makes nothing inert, locks no scroll, takes focus when it opens, keeps its place in the Tab order after the element that opened it, closes on Escape only while focus is inside it, and never closes because the user worked on the page. Its dismiss layer is a new kind, `'dialog'`, so focus restore and isolation elsewhere on the page are unaffected and toasts still move out of a non-modal Drawer's way. The backdrop becomes the surface's sibling (Dialog: backdrop + positioner + surface; Drawer: backdrop + panel) and a slot (`null` removes it; `appearance` picks dimmed or transparent; a modal stacked over another modal dims the page once). The built-in Close button becomes a slot with the dismiss rules of MessageBar's `dismiss`. From issue #4: `Dialog.Content` gains the sizes `large` (940px) and `full` (the whole viewport, with the safe-area insets), and a title-actions area before the Close button (`Dialog.Content titleAction`, `Dialog.Title action`), whose width the titles' end padding follows. Every Dialog and Drawer trigger toggles its surface.

**Closes:** `dialog-2` (M), `drw-6` (M), `dialogsurface-1` (L), `dialogtitle-2` (L); issue #4 (sizes `large` and `full`, `data-size`, header actions). **Guards:** `inert` isolation of modal surfaces unchanged (toasts stay announced): "isolates the page with inert instead of aria-modal while open (§5.8)" (`Dialog.test.tsx`, `Drawer.test.tsx`), "keeps an allow-listed region (toasts) reachable, not inert and clickable (feedback-navigation#50)" (both files), "alert dialogs (modalType="alert") › isolates the page and traps focus as a modal dialog does", the integration suite "a real timeout:0 Toast over an open %s (feedback-navigation#50)", and the new "a confirm Dialog over a Drawer dims the page once and keeps both isolations" (`Dialog.slots.test.tsx`); the dismiss-layer stack: the "layers" suites of both files and `layers.test.ts`, unchanged apart from §6.4.

#### Rulings

- **D86 — One `ModalType` with Fluent's three values, on Dialog and Drawer.** `ModalType = 'modal' | 'alert' | 'non-modal'` (foundation, `src/lib/types.ts`); `DialogModalType` stays its alias and `Drawer` gains `modalType?: DrawerModalType` (`= ModalType`, default `'modal'`). `Dialog.Content` and every overlay Drawer panel render `data-modal-type` with the resolved value (Phase 1 D22; new on the Drawer panel; not rendered on an inline panel, P6-07). A Drawer with `modalType="alert"` is `role="alertdialog"` (a consumer `role` wins), its backdrop press neither closes it nor moves focus (`useBackdropPress(panelRef, false)`), and Escape still closes it, as P1-19 rules for Dialog. *Why:* Phase 1 D9 planned the widening; Fluent's OverlayDrawer takes Dialog's `modalType`; the widening breaks no prop (no `Record<ModalType, …>` or exhaustive switch exists in `src`; only `=== 'alert'` comparisons, `Dialog.tsx:345,381`).
- **D87 — Non-modal behaviour.** With `modalType="non-modal"` (Dialog and overlay Drawer):
  1. no backdrop element, no focus trap, nothing made `inert`, no scroll lock; `role="dialog"`; no `aria-modal` (no type sets it: WaveUI isolates with `inert`);
  2. focus moves in on open with the trap's initial-focus rule, without the trap: an element inside that already has focus (`autoFocus`) keeps it, else the first focusable element (a title action, else the Close button, else body content), else the surface (`tabIndex={-1}`);
  3. Escape closes it only while focus, or the key's target, is in its layer tree (its surface and the layers opened from it): an Escape pressed on the page never reaches it;
  4. presses on the page and focus moving to the page never close it;
  5. its keyboard place follows the opener (`usePopoverTabOrder`, `Popover.shared.tsx:410`, with `getPreviousStop: getTabbableThrough`): Tab from the opener enters it at its first element, Tab past its last element continues after the opener, Shift+Tab from its first element returns to the opener, Shift+Tab from the element after the opener enters it at its last element; with no opener (opened from code while nothing had focus) it keeps the portal's place at the end of the page. The opener is captured when it opens (`useModalOpener`, §API);
  6. focus returns on close only when focus is inside the surface, or was lost to `<body>` from inside it (`requireFocusInside`, D92), with the 0.10 target chain (`finalFocusRef`, the opener, the trigger, a neighbour);
  7. its dismiss layer is registered (D90), so popups opened inside it are its children (Escape order, presses in nested portals count as inside, focus restore into it).
  *Why:* Fluent's non-modal keyboard contract (`Spec.md` 473-479) and its Escape scoping (`DialogNonModal.md`); the ARIA `dialog` role asks to move focus in when the dialog shows and to constrain it only for a modal one; an Escape typed into an unrelated field must not close a window the user is not in; a light-dismissed dialog would be a Popover; WaveUI keeps a popup's Tab place after its trigger (a listed strength since 0.5).
- **D88 — No new close reason (supersedes Phase 1 D9's plan and the roadmap sketch).** A non-modal surface never closes because focus or a press went elsewhere, so `ModalOpenChangeReason` does not gain `'focus-outside'` and the non-modal layer registers neither `outsidePress` nor `focusOutside`. `useModalDismiss` keeps its `focus-outside` development warning (no Dialog or Drawer layer ever receives that reason). *Why:* Fluent reports no such reason; closing when focus leaves defeats a non-modal dialog (working on the page while it stays open); an opt-in light dismiss can come later as an additive prop (§8.2 backlog line). Memo C14.
- **D89 — Every Dialog and Drawer trigger toggles.** A `Dialog.Trigger` or `Drawer.Trigger` click while its surface is open asks it to close: `requestOpen(!open, { reason: 'trigger', event })` in `useModalTriggerPart` (`Dialog.shared.tsx:419-427`). It is observable only where the trigger can be clicked while open: a non-modal surface's trigger, an inline drawer's (P6-07), or a trigger rendered inside its own surface (`Drawer.Trigger:nested` still warns). `useModalTriggerPart` gains the option `popup: 'dialog' | false` (default `'dialog'`): `false` renders no `aria-haspopup` (inline drawers, P6-07); `aria-expanded` and `aria-controls` are unchanged. *Why:* `Popover.Trigger` toggles (`Popover.tsx:577`); a button announced as expanded that does nothing when pressed is a dead control; Fluent's own non-modal drawer story uses a toggle button; Fluent's `DialogTrigger` inside the surface closes it, which this matches. Memo C16. §8.3 entry (Fluent's DialogTrigger never toggles).
- **D90 — Non-modal surfaces register the `'dialog'` layer kind with `escape: 'inside'`.** The foundation adds `LayerKind` `'dialog'` (a non-modal Dialog or Drawer: it shields nothing, takes Escape only from inside its tree, and the Toaster moves out of its way) and widens `LayerRecord.escape`/`UseDismissOptions.escape` to `boolean | 'inside'` (§1). The `kind === 'modal'` checks stay as they are: `isInsideOtherOpenModal` (focus-restore validation, `layers.ts:319-330`), the restore's last fallback (`useRestoreFocus.ts:456`) and `getModalsAboveElements` (`useModalIsolation.ts:75`) never count a `'dialog'` layer; the Toaster counts `'modal'` and `'dialog'` (D84). A non-modal surface opened beside an open modal (not from inside it) is therefore inert until the modal closes (documented). *Why:* registered as `'modal'`, a non-modal surface would make every element outside it an invalid restore target, so a Menu closing elsewhere on the page would send focus into the non-modal dialog; as `'popover'` the Toaster would not avoid a non-modal Drawer; a new kind changes nothing for the six existing kinds (the DatePicker calendar stays `'modal'` without isolation). Memo C14.
- **D91 — `useModalLayer` takes `modalType`.** `UseModalLayerOptions.modalType?: ModalType` (default `'modal'`): `'modal'` composes as in 0.10; `'alert'` as `'modal'` with `outsidePress: false` (Dialog passed it itself in 0.10); `'non-modal'` registers `useDismiss({ kind: 'dialog', escape: 'inside', outsidePress: false, focusOutside: false })`, keeps `useFocusTrap`, `useModalIsolation` and `useScrollLock` disabled, runs the trap's initial focus on open through `useInitialFocus` (a module export of `useFocusTrap.ts` that the trap itself now calls; behaviour-neutral for the trap) and calls `useRestoreFocus` with `requireFocusInside: true`. Every hook stays unconditional (C-HOOKS) and keys on `open` (C-POPUPS). A `modalType` that changes while open applies at once: the trap, isolation and lock follow their `enabled`, and no focus moves. The Tab order of D87.5 stays in the components (it needs the opener). *Why:* one composition for both components; P7-02 publishes `useModalLayer` with this option rather than a second hook.
- **D92 — One strict restore option for surfaces that do not trap focus.** `useRestoreFocus` gains `requireFocusInside?: boolean` (internal hook; default `false`): the restore acts only when focus is inside the surface at close, or was lost to `<body>` from an element inside it (the focus tracker's record of the element that lost focus lies in the container: its recorded `position.path` contains it). Focus anywhere else, or on `<body>` for another reason (nothing had focus, the user pressed a non-focusable spot, a code-driven close), stays where it is. It wins over `onlyIfFocusInside`, which keeps its 0.10 meaning (also restores whenever focus is on `<body>`, `useRestoreFocus.ts:406-413`). Non-modal surfaces (D91) and inline drawers (P6-07, D101) use it; Popover, Menu, TeachingPopover and DatePicker keep theirs. *Why:* a code-driven close of a non-modal or inline surface while focus is on `<body>` must not pull focus to its trigger; a removed control inside the surface still gets a target. Memo C18.
- **D93 — The backdrop is the surface's sibling, and a slot.** Every top-level child of the portal wrapper carries the presence attributes (P6-07, D103). DOM: Dialog `Portal > [backdrop] + positioner > surface`; Drawer `Portal > [backdrop] + panel`. The positioner (`wave-dialog-content__positioner`, `pointer-events-none fixed inset-0 flex items-center justify-center`) is the flex box the 0.10 backdrop was; the surface gains `pointer-events-auto` and keeps every 0.10 class, so the 0.8 full-screen recipe (`m-0 h-dvh max-h-none max-w-none rounded-none border-0`) keeps working. The backdrop (`wave-dialog-content__backdrop` / `wave-drawer__backdrop`, `fixed inset-0`) is `aria-hidden="true"` and renders only for `modal` and `alert`. `backdrop` on `Dialog.Content` and `Drawer`: `undefined` and booleans render the default backdrop; `null` renders none (the page stays inert and scroll-locked, and a press outside the surface still closes a `modal` through the layer stack, never an `alert`); shorthand content renders inside the backdrop element; a slot object's `className` (merged last), `style`, `data-*`, `ref` (merged) and handlers (composed, the consumer's first: a consumer `onMouseDown` that calls `preventDefault()` skips the backdrop-press bookkeeping) go to the backdrop element, its `children` render inside it, and its `appearance` (`'dimmed' | 'transparent'`, Fluent's backdrop `appearance`) overrides D94's automatic choice; `aria-hidden="true"` always wins. On a non-modal surface (and an inline drawer) a given `backdrop` slot (anything but `undefined`, `null` and booleans) is ignored with a warning (`…:backdrop-ignored`). Every mouse press on the backdrop element, its content included, is a backdrop press (`useBackdropPress` drops the `target === currentTarget` check: the surface is no longer inside the backdrop). A "Changed (DOM)" entry. *Why:* Fluent's structure; `null` can mean "none" only when the backdrop is not the centring box; `opacity` or `filter` on a parent backdrop would reach the surface; Phase 10 fades the backdrop independently of the surface's scale or slide, so the DOM moves once, in 0.11, not again in 0.15; the non-modal surface reuses the positioner. Memo C12.
- **D94 — Nested modals dim once.** A `modal` or `alert` surface's backdrop renders `data-appearance="transparent"` (`bg-transparent`) while another isolating modal surface (a modal or alert Dialog or Drawer whose isolation is active) is open below it, nested in its content or opened beside it, and `data-appearance="dimmed"` (`bg-backdrop`) otherwise; `backdrop={{ appearance }}` wins, and a `className` wins over both. Derived during render: `useSyncExternalStore(subscribeLayers, () => open && hasIsolatingModalBelow(layerId) ? 'transparent' : 'dimmed', () => 'dimmed')` (`useBackdropAppearance`, `Dialog.slots.tsx`; `hasIsolatingModalBelow` is the foundation's, §1). When the lower modal closes, the upper one dims (its layer unregisters and notifies). *Why:* `dialogsurface-1`; Fluent's rule (`isNestedDialog`) extended from React nesting to stacking, because WaveUI's documented confirm-dialog pattern renders the confirm Dialog either inside a Drawer's content or next to it (`integration.test.tsx` "confirm Dialog deleting a row inside a Drawer", both layouts); the DatePicker calendar (a `'modal'` layer without isolation) never counts. A "Changed (visual)" entry.
- **D95 — `closeButton` follows the dismiss-slot rules, without the button-object form.** `Dialog.Content` and `Drawer` take `closeButton?: Slot<'span'>` (the roadmap's `| SlotObject<'button'>` is dropped: in MessageBar, SearchBox and Tag that member types the deprecated 0.4 button-object form). The built-in Close button stays a Wave `Button` (`appearance="subtle"`, `size="small"`), with `buttonClassNames.root` plus `dialogContentClassNames.closeButton` or `drawerClassNames.closeButton`, reason `'close-button'`, named by `closeLabel` by default. Rules (MessageBar `dismiss`, `MessageBar.tsx:251-372`, adapted to a Wave Button; one module-only resolver, `ModalCloseButton` in `Dialog.slots.tsx`, serves the built-in header, every `Drawer.HeaderTitle` and `Dialog.Content`):
  1. `null` hides the button (Escape and your own `Dialog.Close`/`Drawer.Close` still close); `undefined` and booleans keep it (`closeButton={cond && <MyIcon />}`);
  2. shorthand content, and a slot object that does not render a button, become the Button's decorative `icon` (`aria-hidden`); content that renders nothing keeps the default glyph (`slotRendersContent`; a slot object whose element wraps the default content keeps it, `slotWrapsDefaultContent`); a slot object's `aria-label`, `aria-labelledby` and `title` name the button, its handlers go to the button (composed, the consumer's first; `preventDefault()` keeps the surface open), everything else goes to the content element;
  3. a `<button>` or Wave `Button` element, or a slot object whose `as` is one, is merged into the built-in Button, never nested, with a one-time warning (`…:closeButton-button-element`): its props go to the Button (`onClick` first, an explicit `type` and its naming attributes win), its children (materialised) become the Button's children, and a Wave `Button`'s `icon`/`iconPosition` and `disabledFocusable` apply while `appearance` and `size` are dropped (`BUTTON_OWN_PROP_KEYS`); its content may name the button: a text label (two letters or digits, `labelInName.ts`; the literal children on the server and the first render, the rendered text after mount through `observeTextLabel`) replaces `closeLabel` (WCAG 2.5.3);
  4. a merged `disabledFocusable` Button makes the Close button focusable, unavailable and inert to clicks (the Button's own handling).
  *Why:* `dialogtitle-2`; one dismiss rule across the library (the 0.5 C-SLOTS naming decision); a new slot does not start with a deprecated form.
- **D96 — Dialog sizes `large` and `full`.** `DialogContentProps.size?: DialogSize` (`= SurfaceSize`), default `'medium'`, rendered as the enumerated `data-size` on the surface before `{...rest}`. `small` `max-w-[400px]`, `medium` `max-w-[600px]`, `large` `max-w-[940px]`, each with 0.10's `w-full m-4 max-h-[calc(100dvh-2rem)]`; `full` adds `m-0 h-dvh max-h-none max-w-none rounded-none border-0` and the safe-area insets with the one formula (memo C20) on its 24px padding: `pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] ps-[max(1.5rem,env(safe-area-inset-left))] pe-[max(1.5rem,env(safe-area-inset-right))] wave-rtl:ps-[max(1.5rem,env(safe-area-inset-right))] wave-rtl:pe-[max(1.5rem,env(safe-area-inset-left))]`, and its title-actions area moves by the same insets (`top-[max(1rem,env(safe-area-inset-top))] end-[max(1rem,env(safe-area-inset-right))] wave-rtl:end-[max(1rem,env(safe-area-inset-left))]`). The body keeps `min-h-0 flex-1 overflow-y-auto`, so long content scrolls under the sticky `Dialog.Footer`; a short body leaves the footer under the content (documented, with the form recipe `flex min-h-full flex-col` and a footer `mt-auto`). Escape, the backdrop (covered: still the press target where the surface does not reach), trap, restore and isolation are unchanged. `sizeClasses` (`Dialog.tsx:298`) widens to `Record<DialogSize, string>`. A `className` still overrides any class of the same variant (checked: `cn('max-w-[600px]', 'max-w-[940px]')` → `max-w-[940px]`; the `full` classes replace `m-4`, `max-h-…`, `rounded-lg`, `border`). *Why:* issue #4 (390px and 2560px acceptance); `large` is Drawer's `large` (one scale), open question Q-OV4; `max()` keeps 24px where there is no inset and never stacks the padding on a notch.
- **D97 — The title-actions area.** `Dialog.Content` renders, after the `title` heading and before the body, an area `wave-dialog-content__title-actions` (`absolute end-4 top-4 flex items-start gap-1`; 0.10's `absolute end-4 top-4` moves from the Close button to it) holding, in DOM and Tab order: `titleAction` (`<span class="wave-dialog-content__title-action inline-flex items-center gap-1">`, only when it renders content), an outlet `<span class="contents">` into which every `Dialog.Title` with an `action` portals its `<span class="wave-dialog-title__action inline-flex items-center gap-1">` (`createPortal` into the outlet element, which `Dialog.Content` holds in state and passes as `ModalSurfaceContextValue.titleActionsOutlet`; React context and events follow the Title), then the Close button. The area is always rendered (empty, it has no size and no content). A `ResizeObserver` (a layout effect, P1-21's technique) measures the area's border-box width and sets `--wave-dialog-title-end-padding` on the surface's style: `${width + 8}px` while the width is above 0, `0px` while the area is empty; without `ResizeObserver` the variable is unset. The `title` heading and every `Dialog.Title` use `pe-[var(--wave-dialog-title-end-padding,2rem)]` (2rem is 0.10's `pe-8`: a 24px Close button and an 8px gap); a consumer `pe-*` still wins (tailwind-merge, checked). A `Dialog.Title` outside a `Dialog.Content` (in a Drawer) renders its `action` right after its heading. Both slots are interactive (not `aria-hidden`) and render nothing when they render no content. Initial focus is the first focusable element: the first title action when there is one, else the Close button (the JSDoc of `modalType`, README and guide say so). *Why:* issue #4 (an expand button next to Close and a title padding that knows about it); one mechanism for the `title` prop form and `Dialog.Title`; the acceptance's DOM and Tab order hold although `Dialog.Title` lives in the body (a plain sibling after the heading would come after Close); the outlet exists in the commit after the surface mounts, the same commit in which the focus trap starts (it waits for the surface held in state), so an action is in the DOM before initial focus.
- **D98 — Drawer counterparts.** The Drawer root gains `modalType` (D86), `backdrop` (D93), `closeButton` (D95; also every `Drawer.HeaderTitle`'s Close, D75) and, for its `title` prop form, `titleAction?: Slot<'span'>`, rendered in the built-in header row between the heading and the Close button: `<span class="wave-drawer__title-action ms-auto flex shrink-0 items-center gap-1">`, and the Close button drops its `ms-auto` while that span renders (it follows the span through the row's gap). `titleAction` is ignored next to a `Drawer.Header` (D73). No measurement: the header is a flex row. *Why:* parity of the two `title` forms; one rule for "actions before Close" with `Drawer.HeaderTitle action`; `stableClassNames.test.tsx:92` still holds (the Close button's parent stays the header).
- **D99 — Modal surfaces are otherwise unchanged.** `inert` isolation instead of `aria-modal` (toasts stay announced), the trap's allow-list, Escape and outside-press routing, focus return and scroll lock behave as in 0.10 for `modal` and `alert`; every 0.10 test of these stays green apart from the DOM lookups of §6.4. *Why:* the roadmap's guards.

#### API

```ts
// src/lib/types.ts (foundation, §1)
/**
 * How a Dialog or Drawer relates to the page. `modal`: a backdrop dims the page, focus stays in
 * the surface, the rest of the page is `inert` and does not scroll. `alert`: modal, for a
 * confirmation that needs an answer (`role="alertdialog"`; a backdrop press does not close it).
 * `non-modal`: the page stays usable (no backdrop, no focus trap, nothing inert, the page
 * scrolls). Fluent's `modalType`.
 */
export type ModalType = 'modal' | 'alert' | 'non-modal';
/** Size of an overlay surface: Dialog.Content's width cap, a Drawer's width or height. */
export type SurfaceSize = CoreSize | 'full';
/** How a modal surface's backdrop paints the page: dimmed, or transparent (a modal above another). */
export type BackdropAppearance = 'dimmed' | 'transparent';

// src/components/overlays/Dialog.tsx
export type DialogSize = SurfaceSize;

export interface DialogProps {
  /**
   * `modal`: the page behind is `inert` and does not scroll; a backdrop press, Escape, the Close
   * button and `Dialog.Close` close it. `alert`: a confirmation that needs an answer —
   * `role="alertdialog"`, and a backdrop press does not close it (Escape still does). `non-modal`:
   * the page stays usable — no backdrop, no focus trap, nothing inert, the page scrolls; Tab and
   * Shift+Tab leave the dialog in the page's order right after the element that opened it, Escape
   * closes it while focus is inside it, and presses on the page never close it. Every type moves
   * focus to the first focusable element on open (a title action, else the built-in Close button);
   * give another element `autoFocus` to start there. `Dialog.Trigger` toggles the dialog. Fluent's
   * `modalType`.
   * @default 'modal'
   */
  modalType?: DialogModalType;
  // open, defaultOpen, onOpenChange, finalFocusRef, children: 0.10; unmountOnClose: P6-07.
}

// The `backdrop` slot type is written inline in DialogContentProps, DrawerProps and DrawerPanelProps
// (no named alias: a named type in a public signature would have to be exported).
export interface DialogContentProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Width cap: 400px (`small`), 600px (`medium`) or 940px (`large`), never wider than the viewport
   * (a 1rem margin). `full` covers the viewport: no margin, radius or border, the viewport's
   * dynamic height, and the safe-area insets as padding (with `viewport-fit=cover`); the body
   * scrolls under the sticky `Dialog.Footer`. Rendered as `data-size`. Fluent has no size.
   * @default 'medium'
   */
  size?: DialogSize;
  /**
   * The backdrop of a modal or alert dialog: a `div` behind the dialog, `aria-hidden`. Shorthand
   * content renders inside it; a slot object's `className` (merged last), `style`, data
   * attributes, `ref` and handlers go to it, and its `appearance` (`'dimmed'` or `'transparent'`)
   * overrides the automatic one: while another modal Dialog or Drawer is open below this one the
   * backdrop is transparent, so the page is dimmed once. `null` renders no backdrop (the page stays
   * inert, and a press outside still closes a modal dialog); a boolean is no slot. Ignored with
   * `modalType="non-modal"` (a development warning says so). Fluent's `backdrop`.
   */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /**
   * Content of the built-in Close button (the dismiss glyph by default). It renders inside the
   * button, decorative (`aria-hidden`), so the button keeps the name `closeLabel`; a slot object's
   * `aria-label`, `aria-labelledby` or `title` names it instead, and its handlers run before the
   * close (`preventDefault()` keeps the dialog open). `null` hides the button (Escape and
   * `Dialog.Close` still close); a boolean is no slot, so `closeButton={cond && <MyIcon />}` keeps
   * the default; content that renders nothing keeps the default glyph. A `<button>` or Wave
   * `Button` passed here is merged into the built-in button, never nested (a development warning
   * says so): its props apply, its text label (`<button>Done</button>`) names the button instead
   * of `closeLabel`, and a Button's `icon`, `iconPosition` and `disabledFocusable` apply while
   * `appearance` and `size` are ignored. Fluent's `DialogTitle` `action` holds Fluent's close
   * button; WaveUI renders its own.
   */
  closeButton?: Slot<'span'>;
  /**
   * Header buttons for the `title` prop form, placed before the built-in Close button in the
   * dialog's top end corner, in DOM and Tab order (an expand toggle, a menu). The title's end
   * padding makes room for them. Interactive: name icon-only buttons. Renders nothing when empty.
   * See also `Dialog.Title`'s `action`.
   */
  titleAction?: Slot<'span'>;
  // title, closeLabel, children, ref: 0.10.
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Header buttons for this title, placed before the built-in Close button in the dialog's top end
   * corner (after `Dialog.Content`'s `titleAction`), not inside the heading, so they never become
   * part of the dialog's name. Outside `Dialog.Content` (in a Drawer) they render right after the
   * heading. Fluent's `DialogTitle` `action`; unlike Fluent's, it is never filled by default (the
   * Close button is the Content's).
   */
  action?: Slot<'span'>;
  // children, ref: 0.10.
}

// src/components/overlays/Drawer.context.ts
export type DrawerModalType = ModalType;

// src/components/overlays/Drawer.root.tsx — DrawerProps additions
/**
 * Overlay drawers: `modal`, `alert` or `non-modal`, as Dialog's `modalType` (an `alert` drawer is
 * `role="alertdialog"`, and a backdrop press does not close it; a `non-modal` drawer has no
 * backdrop and leaves the page usable). Ignored by an inline drawer. Rendered as
 * `data-modal-type`. Fluent's `modalType`.
 * @default 'modal'
 */
modalType?: DrawerModalType;
/** The backdrop of a modal or alert overlay drawer: as `Dialog.Content`'s `backdrop`. */
backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
/** Content of the built-in Close button, in the built-in header and in every `Drawer.HeaderTitle`: as `Dialog.Content`'s `closeButton`; `null` hides them all. */
closeButton?: Slot<'span'>;
/**
 * Header buttons for the `title` prop form, between the heading and the built-in Close button in
 * DOM and Tab order. Ignored, with a development warning, next to a `Drawer.Header` (use the
 * `action` of `Drawer.HeaderTitle`). Interactive: name icon-only buttons.
 */
titleAction?: Slot<'span'>;
```

Internal seams (module-only; frozen for the overlays package itself, §4 lists them):

```ts
// src/hooks/useModalLayer.ts
export interface UseModalLayerOptions extends Omit<UseDismissOptions, 'kind'> {
  container: HTMLElement | null;
  /**
   * `modal` (default) and `alert` register a `modal` layer, trap focus, isolate the page, lock its
   * scroll and restore focus (an `alert` layer ignores outside presses); `non-modal` registers a
   * `dialog` layer (`escape: 'inside'`, no outside press, no focus-outside), traps, isolates and
   * locks nothing, moves focus in on open with the trap's initial-focus rule and restores focus only
   * from inside (`requireFocusInside`).
   */
  modalType?: ModalType;
  initialFocus?: UseFocusTrapOptions['initialFocus'];
  triggerRef?: React.RefObject<HTMLElement | null>;
  finalFocusRef?: React.RefObject<HTMLElement | null>;
}

// src/hooks/useFocusTrap.ts (module export, not public)
/**
 * The trap's initial focus without the trap: in the layout phase of the commit in which
 * `enabled && container` becomes true, does nothing when focus is already inside the container or
 * one of the layer's descendant layers (an `autoFocus` element wins), else focuses
 * `initialFocus` (default: the first tabbable element), else the container. `useFocusTrap` runs
 * the same code when it starts.
 */
export function useInitialFocus(
  container: HTMLElement | null,
  options: { enabled: boolean; layerId?: string; initialFocus?: UseFocusTrapOptions['initialFocus'] },
): void;

// src/hooks/useRestoreFocus.ts — UseRestoreFocusOptions
/**
 * Surfaces that do not trap focus (a non-modal Dialog or Drawer, an inline Drawer): restore only
 * when focus is inside the surface at close, or was lost to `<body>` from an element inside it.
 * Focus elsewhere, or on `<body>` for another reason, stays where it is. Wins over
 * `onlyIfFocusInside`. @default false
 */
requireFocusInside?: boolean;

// src/components/overlays/Dialog.shared.tsx
export interface ModalTriggerState {
  open: boolean;
  requestOpen: ModalRequestOpen;
  trigger: ModalTrigger;
  controlsId: string | undefined;
  /** `'dialog'` renders `aria-haspopup="dialog"`; `false` none (an inline drawer). @default 'dialog' */
  popup?: 'dialog' | false;
}
// useModalTriggerPart: the click handler calls `requestOpen(!open, { reason: 'trigger', event })`.

/**
 * The element a non-modal surface takes its keyboard place after, captured in the insertion phase
 * of the commit in which `enabled` becomes true (before focus moves in): `trigger.focusRef.current`
 * (a focused trigger's focus target, or, with nothing focused, the activated or first trigger),
 * else the focused element when it is not `<body>` and not inside `surface`, else `null`. Cleared
 * when `enabled` becomes false.
 */
export function useModalOpener(
  enabled: boolean,
  trigger: ModalTrigger,
  surface: HTMLElement | null,
): React.RefObject<HTMLElement | null>;

export interface ModalSurfaceContextValue {
  registerTitle: (id: string) => () => void;
  setFooterHeight?: (px: number | null) => void;
  /** The element `Dialog.Title` actions portal into; absent outside `Dialog.Content`. */
  titleActionsOutlet?: HTMLElement | null;
}

// src/components/overlays/Dialog.slots.tsx (new, module-only)
/** The built-in Close button with the `closeButton` slot rules (D95); `null` when hidden. */
export function ModalCloseButton(props: {
  /** `'Dialog.Content'` or `'Drawer'`: the warning key and text. */
  componentName: string;
  closeButton: Slot<'span'> | undefined;
  closeLabel: string;
  /** Asks to close with `'close-button'`. */
  onClose: (event: Event) => void;
  /** The part class and layout classes, after Button's own (`drawerClassNames.closeButton`, …). */
  className: string;
}): React.ReactNode;
/** The backdrop element with the `backdrop` slot rules (D93) and the automatic appearance (D94). */
export function ModalBackdrop(props: {
  backdrop: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance }) | undefined;
  /** The stable class (`dialogContentClassNames.backdrop`, `drawerClassNames.backdrop` [+ a variant's]). */
  className: string;
  layerId: string;
  open: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  presenceProps: PresenceAttributes;
}): React.ReactNode;
export function useBackdropAppearance(layerId: string, open: boolean): BackdropAppearance;
```

#### Behaviour

| | `modal` | `alert` | `non-modal` |
|---|---|---|---|
| role / `data-modal-type` | `dialog` / `modal` | `alertdialog` / `alert` | `dialog` / `non-modal` |
| backdrop | dimmed (transparent while an isolating modal is open below) | same | none (`backdrop` ignored, warning) |
| backdrop press | closes (`outside-press`) | ignored, no blur | — (page presses never close) |
| Escape | routed to it from anywhere (0.10) | same | only from inside its layer tree |
| focus on open | first focusable (trap) | same | first focusable (no trap) |
| Tab | trapped (toasts included) | same | leaves; its place follows the opener |
| page | inert, scroll locked | same | usable, scrolls |
| restore on close | always (0.10 chain) | same | only when focus is inside, or lost to `<body>` from inside |
| trigger click while open | (the trigger is inert) | (inert) | closes (`trigger`) |
| layer | `modal`, isolating | same | `dialog`, `escape: 'inside'` |

**Keyboard (non-modal).**

| Key | Where | Action |
|---|---|---|
| Tab | the opener | enters the surface at its first element |
| Tab | the surface's last element | moves to the element after the opener |
| Shift+Tab | the surface's first element | returns to the opener |
| Shift+Tab | the element after the opener | enters the surface at its last element |
| Escape | focus in the surface or a layer opened from it | closes (`escape`, the innermost layer first); focus returns to the opener |
| Escape | focus on the page | nothing reaches the surface |
| Enter / Space | the trigger, while open | closes (`trigger`); focus stays on the trigger |

**Pointer.** `modal`: a press on the backdrop (or on its content) closes; a drag from the surface does not. `alert`: the press is `preventDefault()`ed (nothing blurs) and ignored. `backdrop={null}`: presses land on the inert page and close a `modal` through the layer stack, not an `alert`. Non-modal: presses anywhere on the page do nothing to it.

**ARIA.** Unchanged naming (`aria-labelledby` to the title). Title actions are outside the heading (never part of the name). The backdrop is `aria-hidden`.

**Announcements.** None (the dialog's name on entry, as 0.10).

**SSR and hydration.** Unchanged: every overlay surface renders only in the browser; `useBackdropAppearance`'s server snapshot is `'dimmed'`; the outlet exists only on the client.

**RTL.** The area at `end-4` mirrors, its DOM order (title action, then Close) is unchanged; `full`'s safe-area classes pair logical utilities with `wave-rtl:` (C-LOGICAL, no physical class); the Drawer header row mirrors natively; the non-modal Tab order is document order.

**Forced colours.** The backdrop keeps its alpha over Canvas (real-browser check); the surface border (0.5) marks a non-modal surface on an undimmed page; `full` drops the border (it fills the screen). Close and title actions are Wave Buttons.

**Reduced motion.** No motion is added (C-MOTION); D93 prepares P10-01.

**Toaster.** Over a non-modal surface nothing is inert, so the region is reached in page order; Escape in the region dismisses the toasts and never closes the surface (the region prevents it, `Toaster.tsx:1320-1338`); a press on a toast closes nothing; a non-modal Drawer at the toasts' side moves them (D84); a centred non-modal Dialog does not; a `full` Dialog leaves them in their corner over it (no room: documented, §9 review focus).

**Development warnings:**

| Key | When | Message |
|---|---|---|
| `Dialog.Content:closeButton-button-element` | `closeButton` renders a `<button>`/`Button` (element or slot object) | ``Dialog.Content: `closeButton` received a button element; its props were merged into the built-in Close button (buttons cannot be nested). Pass icon content instead, e.g. `closeButton={<CloseIcon />}`.`` (with "a slot object that renders a button" for the object form, `UnwrappedButton` of `Button.slots.tsx`) |
| `Drawer:closeButton-button-element` | the same on a Drawer | the same text with `Drawer:` |
| `Dialog.Content:backdrop-ignored` | a `backdrop` slot with `modalType="non-modal"` | ``Dialog.Content: `backdrop` is ignored with `modalType="non-modal"`: a non-modal dialog has no backdrop, so the page behind it stays usable.`` |
| `Drawer:backdrop-ignored` | a `backdrop` slot on a non-modal or inline drawer | ``Drawer: `backdrop` is ignored: a non-modal or inline drawer has no backdrop, so the page around it stays usable.`` |
| `Dialog:focus-outside`, `Drawer:focus-outside`, `Dialog.Content:unnamed` | unchanged | unchanged |

#### DOM and classes

```
Dialog.Content, modal, open:
<Portal layerId>
  <div aria-hidden="true" data-appearance="dimmed" data-presence="entered" onMouseDown
       class="wave-dialog-content__backdrop fixed inset-0 bg-backdrop {backdrop className}"/>
  <div data-presence="entered"
       class="wave-dialog-content__positioner pointer-events-none fixed inset-0 flex items-center justify-center">
    <div role="dialog" id aria-labelledby tabIndex=-1 data-modal-type="modal" data-size="medium"
         data-presence="entered" style="--wave-dialog-title-end-padding: 32px; {style}"
         class="wave-dialog-content pointer-events-auto relative m-4 flex min-w-0 max-h-[calc(100dvh-2rem)]
                w-full flex-col rounded-lg border border-border bg-background p-6 text-foreground shadow-64
                max-w-[600px] {className}">
      [<h2 id class="wave-dialog-title pe-[var(--wave-dialog-title-end-padding,2rem)] text-subtitle-1 font-semibold">…</h2>]
      <div class="wave-dialog-content__title-actions absolute end-4 top-4 flex items-start gap-1">
        [<span class="wave-dialog-content__title-action inline-flex items-center gap-1">{titleAction}</span>]
        <span class="contents"><!-- each Dialog.Title action:
          <span class="wave-dialog-title__action inline-flex items-center gap-1">…</span> --></span>
        [<button class="wave-button … wave-dialog-content__close-button text-muted-foreground" aria-label="Close">…</button>]
      </div>
      <div class="wave-dialog-content__body …">{children}</div>
    </div>
  </div>
</Portal>

Drawer, overlay, modal, open:
<Portal layerId>
  <div aria-hidden="true" data-appearance="dimmed" data-presence onMouseDown class="wave-drawer__backdrop fixed inset-0 bg-backdrop"/>
  <div role="dialog" data-type="overlay" data-position data-size data-modal-type="modal" data-presence … class="wave-drawer fixed …">
    <div class="wave-drawer__header …">
      <h2 …/> [<span class="wave-drawer__title-action ms-auto flex shrink-0 items-center gap-1">{titleAction}</span>]
      <button class="wave-button … wave-drawer__close-button [ms-auto] text-muted-foreground"/>
    </div> …
```

- `data-modal-type` (enumerated): `Dialog.Content` (three values), every overlay Drawer panel (new). `data-size` (enumerated): `Dialog.Content` (new; `small | medium | large | full`). `data-appearance` (enumerated): both backdrops (`dimmed | transparent`). All before `{...rest}`; `data-appearance` before the slot object's props.
- Registry keys the foundation adds (§1): `dialogContentClassNames.positioner = 'wave-dialog-content__positioner'`, `.titleActions = 'wave-dialog-content__title-actions'`, `.titleAction = 'wave-dialog-content__title-action'`; `dialogTitleClassNames.action = 'wave-dialog-title__action'`; `drawerClassNames.titleAction = 'wave-drawer__title-action'`. The JSDoc of `dialogContentClassNames` and `drawerClassNames` ("the backdrop around it") becomes "the backdrop behind it".
- `full` size classes: `m-0 h-dvh max-h-none max-w-none rounded-none border-0` + the six inset classes of D96; the area adds its three inset classes.
- Tokens: none new; `bg-transparent` is allowed (MessageBar's dismiss uses it); no contrast pair.

#### Built-in text

None new: `closeLabel` (`'Close'`) on `Dialog.Content` and `Drawer`. README built-in text row: "`closeLabel` (the Close button; a text label of a button merged into `closeButton` names it instead)".

#### Tests

`src/components/overlays/__tests__/Dialog.nonModal.test.tsx` (new):
1. `role="dialog"`, `data-modal-type="non-modal"`, no `aria-modal`, no backdrop element (`document.querySelector('.' + dialogContentClassNames.backdrop)` is null), the positioner present; the page container is not `inert`; no scroll-lock styles on `<html>`/`<body>`; focus moves to the first tabbable on open (the Close button); an `autoFocus` field keeps it; StrictMode keeps focus inside.
2. A click on a page button calls no `onOpenChange` and the button takes focus; focus on the page plus Escape → still open; focus back inside plus Escape → closes with `escape` and focus returns to the trigger.
3. Tab order: Tab from the trigger enters at the first element; Tab past the last reaches the element after the trigger; Shift+Tab from the first returns to the trigger; Shift+Tab from the element after the trigger enters at the last; a controlled dialog opened from the parent's own button anchors there; opened from code with nothing focused → document order.
4. A controlled parent closing it while focus is in a page field leaves focus there; while focus is on `<body>` leaves it there; the Close button → focus to the trigger; `finalFocusRef` honoured.
5. Trigger toggles: a second trigger click closes (`toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger' }))`), once per change under StrictMode; a controlled parent refusing it keeps it open.
6. Layers: a Popover opened inside closes first on Escape, then the dialog; a Menu on the page closes and returns focus to its own trigger while the non-modal stays open; a modal confirm opened from inside isolates the page (the non-modal included) and returns focus into it.
7. `modalType` changing from `modal` to `non-modal` while open releases inert, trap and lock, and back.
8. axe: open non-modal, with the page around it.

`src/components/overlays/__tests__/Dialog.slots.test.tsx` (new):
1. Backdrop: `aria-hidden="true"`, `data-appearance="dimmed"`, the positioner's previous sibling; a slot object's class (merged last), style, data attribute and `onMouseDown` (composed, consumer first); `{ appearance: 'transparent' }` → `data-appearance="transparent"`, `bg-transparent`; `null` → no backdrop, the page still `inert`, Escape closes, a click on `document.body` closes a modal (`outside-press`) and not an alert; `false` → the default backdrop; shorthand content inside it; a press on that content closes a modal.
2. Dim once: a Dialog opened from a Drawer's content and one rendered beside it → upper `data-appearance="transparent"`, lower `dimmed`; closing the lower one (beside layout) dims the upper; `backdrop={{ appearance: 'dimmed' }}` wins; a DatePicker calendar open below does not make a Dialog transparent. Named guard: "a confirm Dialog over a Drawer dims the page once and keeps both isolations" (the page outside both is `inert`, the Drawer is `inert` while the Dialog is open, toasts are not).
3. `closeButton`: `null` hides it (no button named Close; Escape still closes; initial focus goes to the first body control); content → inside the Button, `aria-hidden`, named `closeLabel`; empty content (`''`, `[]`) → the default glyph; a slot object's `aria-label` names it; an `onClick` calling `preventDefault()` keeps it open, else reason `close-button`; a merged `<button>Done</button>` → named "Done" (literal, and after a translation component renders the text), `closeLabel` dropped, the exact warning; a merged `<Button icon={<X />} disabledFocusable>` → focusable, does not close, no `appearance` class of the merged one; a merged `type="submit"` wins (MessageBar parity) while `testNoImplicitSubmit` keeps the default `type="button"`.
4. Title actions: `titleAction` before Close in DOM (`compareDocumentPosition`) and Tab order, LTR and RTL; a `Dialog.Title action` renders in the area after `titleAction` and before Close, not inside the heading (the dialog's name is the heading text only); initial focus is the first title action; with `installResizeObserverMock` and `mockRect(area, { width: 64 })`, `trigger(area)` sets `--wave-dialog-title-end-padding: 72px`; `closeButton={null}` and no actions → `0px`; without `ResizeObserver` no variable and no error; the titles carry `pe-[var(--wave-dialog-title-end-padding,2rem)]`; StrictMode; axe with actions. Two `Dialog.Title`s with actions keep their mount order. A `Dialog.Title action` in a Drawer renders after its heading.
5. Types (`expectTypeOf`): `DialogProps['modalType']` accepts `'non-modal'`; `DialogContentProps['size']` is `DialogSize`; `closeButton`, `titleAction` are `Slot<'span'> | undefined`; `backdrop` accepts `{ appearance: 'transparent', className: 'x' }`; `// @ts-expect-error` for `size="huge"`, `modalType="none"`, `backdrop={{ appearance: 'blurred' }}`.

`src/components/overlays/__tests__/Dialog.test.tsx` (owned): "responsive sizing (overlays#7)" gains `data-size` per value (default `medium`), `large` → `max-w-[940px]`, `full` → its classes and the six inset classes and the area's three, a consumer class still wins, `full` with a long form and a footer keeps the body scroll-padding variable (the P1-21 assertion), and `it.each` of trap, Escape, inert and restore for `full`; `testSystemProps` gains the a11y variants `size: 'large'`, `size: 'full'` and a non-modal wrapper.

`src/components/overlays/__tests__/Drawer.modalType.test.tsx` (new): the Drawer counterparts of `Dialog.nonModal.test.tsx` 1-7; `alert` (`role="alertdialog"`, `data-modal-type="alert"`, a backdrop press neither closes nor blurs, Escape closes); `data-modal-type="modal"` by default; `backdrop` slot and dim once beside a Dialog; `closeButton={null}` hides the built-in header's Close and every `Drawer.HeaderTitle`'s; `titleAction` between heading and Close with `ms-auto` on its span and none on the Close button; `titleAction` next to a Header → the `title-ignored` warning; a non-modal end Drawer and a Toaster: the toasts move beside it (stubbed rect).

Hooks: `useModalLayer.test.tsx` — `modalType: 'non-modal'` (no trap, no inert, no lock, initial focus, restore only from inside, the layer's kind `'dialog'`), `'alert'` (no outside press); `useRestoreFocus.test.tsx` — a new suite "useRestoreFocus — requireFocusInside": restores with focus inside; leaves focus on a page element; leaves focus on `<body>` when nothing inside lost it; restores when the focused element inside was removed before the close; the unmount path; `onlyIfFocusInside` unchanged (its suite untouched); a page popup's restore target is valid while a `'dialog'` layer is open; `useFocusTrap.test.tsx` — `useInitialFocus` focuses the first tabbable, keeps an inside `autoFocus`, honours `initialFocus`, does nothing while disabled; the trap's 0.10 tests unchanged.

`src/components/feedback/__tests__/Toast.test.tsx`: the stand-in panel takes a `kind` (`'modal'` default); with `kind: 'dialog'` at the end edge the toasts move (`320px`); `FULL_WIDTH` with `'dialog'` keeps the corner.

#### Stories

`stories/Dialog.stories.tsx`: `modalTypes` gains `'non-modal'` (argTypes follow). New stories: **NonModal** (a page with a text field and buttons behind the dialog; the trigger toggles it; `defaultOpen: true` so the gate audits it), **Sizes** (a trigger per size), **FullScreen** (`size="full"` with the long form and a `Dialog.Footer`), **TitleActions** (an expand button in `titleAction`, named "Expand", switching `size` between `large` and `full`: issue #4's case; a `Dialog.Title action` variant), **NoCloseButton** (an alert with `closeButton={null}` and two footer actions), **CustomCloseButton** (a merged `<Button>Done</Button>`), **StackedDialogs** (a confirm Dialog over a Dialog: dim once), **CustomBackdrop** (`backdrop={{ className: … }}` with a token class, and `appearance`). `LargeAndFullScreen` stays as the `className` recipe for custom widths (its JSDoc says so). `stories/Drawer.stories.tsx`: **NonModal** (a details panel with a toggle button and a page that stays usable), **AlertDrawer**, argTypes `modalType`. Every story names its surface (stories axe gate).

### P6-07 — Inline drawer; surfaces that stay mounted; the drawer panel shell (P6-overlays)

`Drawer` gains `type="inline"`: the same panel, header, Close button and parts, rendered in place as an `<aside>` (a complementary landmark named by its title) with none of the modal machinery: no portal, backdrop, dismiss layer, focus trap, isolation or scroll lock; Escape and presses outside never close it; its trigger toggles it without `aria-haspopup`; opening it moves no focus, and closing it returns focus only when focus was inside. It renders in the server HTML. `unmountOnClose={false}` on `Drawer` (both types) and on the `Dialog` root keeps the surface mounted while closed, `hidden` and `inert`, so form state and component state survive. From 0.11 every Dialog and Drawer surface mounts through the presence core in both modes and renders `data-presence` (amending Phase 2 D4), with no built-in motion. The last task of `P6-overlays` is the module-only drawer panel shell (`Drawer.panel.tsx`, D108), on which the Drawer root is built and which NavDrawer (P6-08) reads; its interface is frozen in §4 before wave C.

**Closes:** `drw-7` (M), `drw-3` (L), `dialog-4` (L). **Guards:** `Drawer.Trigger` and `Drawer.Close` work for uncontrolled drawers of both types ("Drawer.Trigger and Drawer.Close (overlays#33)" unchanged for the overlay; `Drawer.inline.test.tsx` cases 4 and 5 for the inline type).

#### Rulings

- **D100 — `type` and `separator` are flat props; the inline panel is an `<aside>`; the element types widen to `HTMLElement`.** `type?: DrawerType` (`'overlay' | 'inline'`, default `'overlay'`) and `separator?: boolean` (default `false`, inline only) sit on `DrawerProps` with every other prop; props that mean nothing for a type are ignored and documented (`modalType`, `backdrop` (with D93's warning) on an inline drawer, `separator` on an overlay one). The inline panel is an `<aside>` named by the drawer's title (`aria-labelledby`), with no `role` and no `tabIndex`; a consumer `role` is allowed from ARIA in HTML's `aside` list (`region`, `search`, `note`, `none`…). `DrawerProps` extends `Omit<React.HTMLAttributes<HTMLElement>, 'title'>` and `ref?: React.Ref<HTMLElement>` (was `HTMLDivElement`): a `RefObject<HTMLDivElement>`, a div ref callback and a div-typed handler still type-check (verified by the research with the repo's `@types/react`). A "Changed (Types)" entry. *Why:* Fluent's flat `Drawer` surface (its union is not discriminated by `type`), which keeps `testSystemProps`, story `args` and a responsive `type` switch simple; the roadmap's in-flow `<aside>` and the report's "conditional `<aside>`" substitute; axe passes a named `<aside>` inside `<main>` (verified); an `<aside>` is an `HTMLElement`, not an `HTMLDivElement`.
- **D101 — Inline behaviour.** No portal, no backdrop, no dismiss layer, no focus trap, no isolation, no scroll lock. Escape never closes it (a widget inside may use the key), and no outside press does; its reasons are `trigger`, `close` and `close-button`. `Drawer.Trigger` toggles it (D89) with `aria-expanded`, `aria-controls` (the panel's id, while open) and no `aria-haspopup` (`popup: false`); the triggers render in place before the panel, so the reading order is button, then panel (APG disclosure). Opening moves no focus (an `autoFocus` element inside takes focus when the panel mounts open, React's mount-time `autoFocus`). Closing restores focus through `useRestoreFocus({ enabled: open && inline, container, triggerRef, finalFocusRef, requireFocusInside: true })` (D92): only when focus is inside the panel, or was lost to `<body>` from inside it, to `finalFocusRef`, else the opener, else the trigger, else a neighbour. The inline restore is called before `useModalLayer` in the shell, and `useModalTriggerSession` after both, in the root. An inline drawer is no layer: toasts keep their corner next to it (documented). *Why:* Fluent's InlineDrawer has no modal behaviour and takes no focus ("handled manually"); APG disclosure semantics; a code-driven collapse while focus is on `<body>` must not pull focus to the trigger; a responsive switch inline → overlay restores before the overlay's trap moves focus in.
- **D102 — `unmountOnClose` on Drawer and on the Dialog root.** `unmountOnClose?: boolean` (default `true`) on `DrawerProps` (both types) and on `DialogProps`, read by `Dialog.Content` through `DialogContext`. `false` keeps the surface mounted while closed, `hidden` and `inert` (out of layout, the Tab order and the accessibility tree, `usePresence.ts:291-297`); kept content mounts with the root, closed (usePresence's `isMounted` is `phase !== 'exited' || !unmountOnExit`, `usePresence.ts:299`), so it exists before the first open. Everything modal keys on `open` (C-POPUPS): no layer, trap, isolation, scroll lock, restore, title-actions measurement or Tab-order listener while closed, and the Toaster ignores a closed one (no open layer). Opening removes `hidden`/`inert` in the opening commit's mutation phase, before the layout effects in which the trap starts, so the initial focus reaches the content; closing makes the surface `inert` (exiting) in the closing commit and restores focus in its layout phase. The DOM state (typed text, checked boxes, `<details>`), the React state of the components inside and their subscriptions survive; `key` on the Drawer or Dialog resets them. *Why:* Fluent places `unmountOnClose` on the Dialog root and on Drawer; the root owns the open state; mounting with the root is usePresence's semantics and what lets a closed inline drawer be in the server HTML.
- **D103 — Every Dialog and Drawer surface mounts through the presence core (amends Phase 2 D4).** `usePresence(open, { unmountOnExit: unmountOnClose })` in `Dialog.Content` and in the drawer panel shell, in both modes. Every top-level child of the portal wrapper carries the presence attributes (memo C12): `data-presence` always, `inert` while exiting and while kept-exited, `hidden` while kept-exited — on the backdrop and the positioner of a Dialog, on the backdrop and the panel of an overlay Drawer, on the `<aside>` of an inline Drawer. The `Dialog.Content` surface (the element that receives `className`) renders `data-presence` as well, and the presence `ref` is on the surface or panel, so a consumer's motion classes there decide when an exit ends. On an element that also takes the consumer's props, the presence attributes come after `{...rest}`, merged as `Presence` does (`inert: presence.inert ?? rest.inert`, `hidden: presence.hidden ?? rest.hidden`). No built-in motion (Phase 2 rule 15); `appear` stays `false`. A "Changed (DOM)" entry: Dialog and Drawer elements carry `data-presence`, and a closed surface without motion unmounts one render after the closing commit (in the same `act()`). Phase 2 D4 ("Dialog, Drawer … move onto the core when Phase 10 animates them") is amended: they move in 0.11, without motion. *Why:* one mount mechanism for both `unmountOnClose` modes, which Phase 10 animates (the roadmap's P6-07 and P2-00 sketches); a hidden panel inside a visible backdrop would leave a page-blocking scrim, so `hidden`/`inert` go on every top-level element; `getAnimations()` on the surface sees only the surface's own motion; Phase 10 fades the backdrop and moves the surface separately and reads the phase on both. Memo C21.
- **D104 — A kept-mounted overlay moves to the top of its stack when it opens.** In the opening commit, before the focus trap starts and before isolation plans (a layout effect declared before `useModalLayer`), a surface with `unmountOnClose={false}` moves its portal wrapper (the `Portal`'s `ref`) to the end of its container when it is not the container's last element child (`container.appendChild(wrapper)`). An unmounting surface is appended when it opens already. *Why:* a portal's z-index is its layer plus its nesting depth (`Portal.tsx:106`), so at equal depth the later wrapper paints above; a kept-mounted confirm Dialog rendered next to a Drawer (not inside its content) was mounted before the Drawer opened and would open under it, behind the isolation it then applies; the closed content is hidden, so the move loses no visible state; React removes a portal child with `removeChild` on the same parent, so a moved wrapper stays consistent; 0.10's "opens later, stacks above" survives the opt-in.
- **D105 — Changing `type` remounts the panel and its content.** An overlay is a portaled `div`, an inline panel an element in place; React cannot move a subtree between them. With focus inside, focus ends on the trigger (overlay → inline: the overlay layer's restore at its unmount) or inside the overlay (inline → overlay: the inline restore, then the trap's initial focus), and no overlay state outlives the switch. *Why:* Fluent swaps element types too (`useDrawer.ts`); the responsive app shell (P6-08) documents it.
- **D106 — Popups left open in a closing kept-mounted surface warn.** With the default `unmountOnClose` they unmount with the content. Kept mounted, a Popover, Menu or nested Dialog that is still open when its surface closes (only after a code-driven close of a controlled surface, or a `Drawer.Close` inside a Popover) stays open over the page. After a close of a kept-mounted surface, an effect schedules one check in a new task (`setTimeout(0)`, so a popup that the closing press itself dismisses does not count); it warns once (`Drawer:open-inside`, `Dialog:open-inside`, `NavDrawer:open-inside` through the shell's `componentName`) when an open layer other than a `'tooltip'` is a descendant of the surface's layer (overlay: `isDescendantLayer`, which follows `parentId` also after the surface's own layer unregistered) or has its anchor (`getAnchor()`) inside the panel (inline). *Why:* a real fix (an effective-open context every surface ANDs with, like Menu's) touches every overlay and belongs with Phase 7's public overlay primitives (§8.2 backlog line).
- **D107 — Server rendering of inline drawers.** The overlay keeps 0.10's gate (`open = openState && isClient`, `Drawer.tsx:374`): nothing in the server HTML, no dangling `aria-controls`. The inline drawer's `open` is the state itself: open, it is in the server HTML (`<aside … data-presence="entered">`, the title, the parts, the content) and its trigger renders `aria-expanded="true"` and `aria-controls` with the aside's id; kept mounted and closed it renders `hidden inert data-presence="exited"`. Hydration needs no extra render and calls no `onOpenChange`. A drawer named by `Drawer.Title` or `Drawer.HeaderTitle` (the title registry, filled from ref callbacks) has no `aria-labelledby` in the server HTML; the `title` prop names it there (documented). *Why:* the roadmap's acceptance; content needed on the server renders inline (C-POPUPS).
- **D108 — The drawer panel shell (module-only, the package's last task).** `Drawer.panel.tsx` exports `DrawerPanel` and `useDrawerOpen` (§API; frozen in §4 before wave C; never exported from a barrel). The shell owns, for both types: the overlay's `Portal` (with its `ref` for D104), the backdrop (`ModalBackdrop`, D93/D94), the panel element (`role="dialog"`/`"alertdialog"` and `tabIndex={-1}` before `{...rest}` for an overlay; nothing for inline), the element parameter of the inline panel (`'aside'` for Drawer, `'div'` for NavDrawer), the placement, size, separator and safe-area classes (D78, D79, D85, D100), the enumerated `data-type`, `data-position`, `data-size`, `data-modal-type` (overlay) and the boolean `data-separator` (inline), presence (D103), the dismiss layer and the modal machinery through `useModalLayer` with `modalType` (D91), the inline restore (D101), the non-modal Tab order (D87.5), the kept-mounted raise (D104), the open-inside check (D106) and the backdrop-ignored warning. It renders its `children` raw: no header, title, Close button, padded body, title registry, `DrawerContext` or `ModalSurfaceContext`. `DrawerRoot` renders the triggers, then `DrawerPanel` with its layout inside (`DrawerContext` for the panel, `ModalSurfaceContext`, the header area, body and footers); NavDrawer renders `DrawerPanel` with its `<nav>`. The component that renders the shell calls `useModalOpenState` and, after rendering it, `useModalTriggerSession(trigger, open)` (its effects run after the shell's), and names the panel (`Drawer:unnamed` stays the Drawer root's). *Why:* NavDrawer needs every piece of the panel machinery and none of Drawer's content structure; a wrapper around the public `Drawer` would need private props to switch half of it off, and every later Drawer change would leak into NavDrawer; P6-07's and P6-08's research both ask for the element as a parameter. Memo C17.
- **D109 — `autoFocus`, forms and scroll position in kept content (documented, no code).** React applies `autoFocus` only when an element mounts, so in a surface kept mounted since it mounted closed it never applies: each open focuses the first focusable element (the trap's `'first'`; Fluent focuses its first focusable element on every open too). Kept content still belongs to its form: a `required` empty field in a closed inline drawer inside a page `<form>` blocks submission without a visible message; overlay content is portaled to `<body>`, outside page forms. `useFormReset` still resets hidden content. The scroll position of a kept body is not promised across `hidden` (`display: none`) until the real-browser check confirms it (§6.3); the usePresence JSDoc and the guide's promise are corrected if an engine resets it. *Why:* each is a property of the platform the docs must state; jsdom lets a hidden element take `autoFocus` focus at mount (verified by the research), so tests never put `autoFocus` in kept content that mounts closed.

#### API

```ts
// src/components/overlays/Drawer.context.ts
/**
 * How a Drawer sits on the page: `overlay`, a panel over the page (in a portal), or `inline`, a
 * panel in the page layout, rendered where the Drawer is. Fluent's `type`.
 */
export type DrawerType = 'overlay' | 'inline';

// src/components/overlays/Drawer.root.tsx — DrawerProps (P6-07 members and changed JSDoc)
export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /**
   * Controlled open state. An overlay drawer's panel renders only in the browser: open, it is
   * closed in the server HTML and opens once it has hydrated. An inline drawer renders in the
   * server HTML: open, or hidden when kept mounted (`unmountOnClose={false}`).
   */
  open?: boolean;
  /** Default open state for uncontrolled usage (the server note of `open` applies). @default false */
  defaultOpen?: boolean;
  /**
   * [0.10 text] An inline drawer asks only with `trigger` (its `Drawer.Trigger` toggles it),
   * `close` and `close-button`: Escape and presses outside it never close it.
   */
  onOpenChange?: (open: boolean, details?: DrawerOpenChangeDetails) => void;
  /**
   * How the drawer sits on the page (Fluent's `type`).
   * - `overlay`: a panel over the page, rendered in a portal while open: modal by default (focus
   *   moves in and stays there, toasts included; the rest of the page is `inert` and does not
   *   scroll; Escape and a backdrop press close it), or `modalType="non-modal"`.
   * - `inline`: a panel in the page layout, rendered where the Drawer is (after its direct
   *   `Drawer.Trigger`s) as an `<aside>`, a complementary landmark named by its title. The page
   *   stays usable around it: no backdrop, no focus trap, no portal, no scroll lock; Escape and
   *   presses outside do not close it. Opening it leaves focus where it is; closing it while focus
   *   is inside returns focus to `finalFocusRef`, else the element that opened it, else the
   *   trigger. `position` and `size` pick its inner edge and its width (its height at the bottom);
   *   where it sits is up to your layout (a flex row of panel and content, for example).
   * Changing `type` remounts the panel and its content.
   * @default 'overlay'
   */
  type?: DrawerType;
  /**
   * Inline drawers: draws a line on the panel's inner edge, the edge facing the page content
   * (`data-separator`). An overlay drawer always draws that edge. In forced colours an inline
   * drawer's inner edge is always drawn. Fluent's `separator`.
   * @default false
   */
  separator?: boolean;
  /**
   * Removes the panel and its content when the drawer closes. `false` keeps them mounted while
   * closed, `hidden` and `inert` (out of the layout, the Tab order and the accessibility tree), so
   * what was typed and the state of the components inside survive closing and opening again; the
   * content then mounts with the Drawer, closed, and an `autoFocus` inside it never applies (each
   * open focuses the first focusable element). An overlay panel still renders only in the
   * browser. Fluent's `unmountOnClose`.
   * @default true
   */
  unmountOnClose?: boolean;
  /**
   * Where focus goes when the drawer closes, if it can take focus. An inline or non-modal drawer
   * moves focus on close only when focus was inside it. [0.10 text]
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** [P6-05 text; "only exists while the drawer is open" becomes "is not rendered (or, kept mounted, is hidden) while the drawer is closed"] */
  children: React.ReactNode;
  /** Ref to the panel: the `role="dialog"` element of an overlay drawer, the `<aside>` of an inline one. */
  ref?: React.Ref<HTMLElement>;
}

/** Props a `Drawer.Trigger` puts on its element (and passes to a render-prop child). */
export interface DrawerTriggerRenderProps extends React.HTMLAttributes<HTMLElement> {
  /** `'dialog'` for an overlay drawer; absent for an inline drawer, which is not a popup. */
  'aria-haspopup'?: 'dialog';
  'aria-expanded': boolean;
  /** The panel's id, while the drawer is open. */
  'aria-controls'?: string;
  onClick: React.MouseEventHandler<HTMLElement>;
  ref: React.RefCallback<HTMLElement>;
}

// src/components/overlays/Dialog.tsx — DialogProps
/**
 * Removes `Dialog.Content` (the surface and everything in it) when the dialog closes. `false`
 * keeps it mounted while closed, `hidden` and `inert`, so a form inside keeps what was typed and
 * the components inside keep their state; the surface then mounts with the Dialog, closed (in
 * the browser only, as an open one), and an `autoFocus` inside it never applies. Fluent's
 * `unmountOnClose`.
 * @default true
 */
unmountOnClose?: boolean;
```

The panel shell (module-only; the frozen contract of §4):

```ts
// src/components/overlays/Drawer.panel.tsx
/**
 * The open state a drawer reports (its triggers' `aria-expanded`, its contexts): an inline
 * drawer's state as it is; an overlay's `false` until the page has hydrated (the portal renders
 * only in the browser).
 */
export function useDrawerOpen(type: DrawerType, openState: boolean): boolean;

/** What the drawer panel shell renders and wires. */
export interface DrawerPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** The public component, for warning keys and texts: `'Drawer'`, `'NavDrawer'`. */
  componentName: string;
  /** `'overlay'`: portal, backdrop, `role="dialog"`, the modal machinery; `'inline'`: in place. */
  type: DrawerType;
  /** The reported open state, from `useDrawerOpen`. */
  open: boolean;
  /** The root's request function (`useModalOpenState`): Escape and the backdrop ask through it. */
  requestOpen: ModalRequestOpen;
  /** Rendered as `data-position`; picks the overlay's edge or the inline panel's inner edge. */
  position: DrawerPosition;
  /** Rendered as `data-size` (always: the component resolves its own default). */
  size: DrawerSize;
  /** Inline only: draw the inner edge (`data-separator`). Ignored by an overlay. */
  separator: boolean;
  /** Overlay only: `modal`, `alert` or `non-modal` (`data-modal-type`). Ignored inline. */
  modalType: ModalType;
  /** `false` keeps the panel mounted while closed, `hidden` and `inert`. */
  unmountOnClose: boolean;
  /** The element of an inline panel: `'aside'` (Drawer) or `'div'` (NavDrawer, whose `<nav>` is the landmark). */
  inlineAs: 'aside' | 'div';
  /** The root's triggers (`useModalTrigger()`), or `inertModalTrigger` for a component without trigger parts. */
  trigger: ModalTrigger;
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** The panel's stable class(es), first in its `cn()`: `drawerClassNames.root` [+ the variant's root]. */
  rootClassName: string;
  /** The backdrop's stable class(es): `drawerClassNames.backdrop` [+ the variant's]. */
  backdropClassName: string;
  /** The `backdrop` slot (overlay `modal`/`alert` only; a slot elsewhere warns). */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /** The panel's id (always set: triggers point `aria-controls` at it). */
  id: string;
  /** Merged with the shell's own ref and the presence ref. */
  ref?: React.Ref<HTMLElement>;
  /** The panel's content, rendered as is: the shell adds no header, Close button or padding. */
  children?: React.ReactNode;
}

/**
 * The drawer panel shell: the panel element of an overlay (in a portal, with its backdrop and the
 * modal or non-modal machinery) or of an inline drawer (in place, with the inline focus restore),
 * on the presence core, with the placement, size, separator and safe-area classes and the
 * `data-type`, `data-position`, `data-size`, `data-modal-type`, `data-separator` and
 * `data-presence` attributes. Returns `null` while unmounted. Its hooks key on `open`.
 */
export const DrawerPanel: (props: DrawerPanelProps) => React.ReactNode; // displayName 'DrawerPanel'
```

#### Behaviour

**Inline keyboard.**

| Key | Where | Action |
|---|---|---|
| Tab / Shift+Tab | the panel | moves through it in DOM order, as through page content (no trap) |
| Enter / Space | `Drawer.Trigger` | toggles the drawer (`trigger`) |
| Enter / Space | the built-in Close button, a `Drawer.HeaderTitle` Close, `Drawer.Close` | closes (`close-button`, `close`); focus returns to the trigger |
| Escape | anywhere | does not close it (a widget inside may use it) |

**Kept mounted (both components, both drawer types).** Closed: the top-level elements are `hidden`, `inert`, `data-presence="exited"`; `queryByRole('dialog')` finds nothing (`{ hidden: true }` does); the trigger has `aria-expanded="false"` and no `aria-controls`. Open: as an unmounting surface, and the trap's initial focus reaches the content. Close: `exiting` (inert) in the closing commit, focus restored in its layout phase, then `exited` (hidden) at once without motion; with motion the layer is already released (Escape reaches the layer below) while the surface waits.

**Presence.** `data-presence` is `entered` while open (`entering` and `exiting` only while a consumer's motion runs); a consumer's `data-[presence=…]:` classes on `Dialog.Content` or on the Drawer animate them (`data-[presence=entering]:starting:` for an enter, each with its `motion-reduce:` variant, C-MOTION). Reduced motion ends every phase at once.

**ARIA.** Inline: an `<aside>` named by `aria-labelledby` (the `title` heading, else the registered title) or the consumer's `aria-label`; no `aria-modal`. Overlay: unchanged. `Drawer:unnamed` also fires for an open unnamed inline drawer.

**SSR and hydration.** D107. Overlay (both modes): nothing in the server HTML; a kept-mounted overlay's hidden surface appears in `<body>` after hydration (the `Portal` renders `null` in both passes: no mismatch).

**RTL.** Inline edges are logical (`border-e` for `start`, `border-s` for `end`); `left`/`right` physical; placement follows DOM order, which a flex row mirrors.

**Forced colours.** An inline panel always draws its inner edge in forced colours (`forcedColors.border`), with or without `separator`. Overlay unchanged.

**Reduced motion.** No motion ships (Phase 2 rule 15); phases end at once.

**Toaster.** An inline drawer is no layer and a closed kept-mounted overlay has none: neither moves toasts.

**Development warnings:**

| Key | When | Message |
|---|---|---|
| `Drawer.Trigger:nested` (text changed) | as 0.10 | ``Drawer.Trigger must be a direct child of Drawer (a Fragment is fine). Inside another element or a component it is rendered as panel content, which is not rendered (or, with `unmountOnClose={false}`, is hidden) while the drawer is closed, so it cannot open the drawer. Make it a direct child, put wrappers such as a Tooltip inside the trigger, or control the Drawer with `open`/`onOpenChange` and open it from your own button.`` |
| `Drawer:unreachable` (text changed) | as 0.10 | ``Drawer has no way to open: a second after mounting it is still uncontrolled (no `open` prop), closed, and has no Drawer.Trigger as a direct child (or in a Fragment there). A Drawer.Trigger rendered by a component or nested in an element is panel content, which is not rendered or is hidden while the drawer is closed. Make the trigger a direct child of Drawer, or control the Drawer with `open`/`onOpenChange`.`` |
| `Drawer:open-inside`, `Dialog:open-inside` (`<componentName>:open-inside` from the shell) | D106 | ``Drawer closed while a popup opened inside it is still open. With `unmountOnClose={false}` the popup stays open over the page: close it first, or keep the default `unmountOnClose`.`` (`Dialog closed while …`, `NavDrawer closed while …`) |

The 0.10 tests of the two changed texts assert only their prefixes (`Drawer.test.tsx:901-903`, `:1005`).

#### DOM and classes

```
Inline, open (in place; triggers first):
{triggers}
<aside id aria-labelledby data-type="inline" data-position="end" data-size="small" [data-separator]
       {...rest} data-presence="entered"
       class="wave-drawer relative flex min-h-0 shrink-0 flex-col max-w-full bg-background text-foreground
              border-transparent data-[separator]:border-border forced-colors:border-[CanvasText]
              border-s w-80 {className}">
  <div class="wave-drawer__header …">…</div>            (P6-05 layout unchanged)
  <div class="wave-drawer__body …">…</div>
</aside>

Inline, closed, kept mounted: the same <aside> with hidden inert data-presence="exited" (server HTML too).
Overlay: P6-06's DOM; the backdrop and the panel carry data-presence (and hidden inert when kept-exited);
the panel adds data-type="overlay".
Dialog.Content: the backdrop and the positioner carry data-presence (and hidden inert when kept-exited),
the surface data-presence.
```

| Element | Attribute | Values | Notes |
|---|---|---|---|
| Drawer panel (both types) | `data-type` | `overlay`, `inline` | new, enumerated, always rendered, before `{...rest}` |
| inline panel | `data-separator` | present / absent | boolean; only with `type="inline"` and `separator` |
| Drawer panel and backdrop, Dialog backdrop, positioner and surface | `data-presence` | `entering`, `entered`, `exiting`, `exited` | enumerated (Phase 2 D3), after `{...rest}` |
| Drawer panel (both types) | `data-position`, `data-size` | P6-05 | |
| overlay Drawer panel | `data-modal-type` | P6-06 | not rendered on an inline panel |

Inline placement: inner edge by position — `start` `border-e`, `end` `border-s`, `left` `border-r`, `right` `border-l` (both with `// wave-allow-physical: the consumer asked for the physical edge`), `bottom` `border-t`; size from D78's maps (side `w-80 | w-148 | w-235 | w-full`; bottom `w-full max-h-full h-80 | h-148 | h-235 | h-full`), where `full` is the container's width (height), capped by `max-w-full`. No `fixed`, `top-0`, `h-full`, `shadow-64`, backdrop, `role`, `tabIndex` or insets. `shrink-0` keeps its width in a flex row; its height comes from the layout (its body scrolls once the container bounds it).

Stable class names: no new constant. `drawerClassNames.root` is on the panel of both types (and of NavDrawer, with its own root, P6-08); `header`, `closeButton`, `body` likewise; `backdrop` only on overlay drawers. The JSDoc of `drawerClassNames` (foundation, §1): "`root` on the panel: the portaled `role="dialog"` element of an overlay drawer, while it is open or kept mounted, or the `<aside>` of an inline one"; `dialogContentClassNames`: "also while kept mounted". Tokens: `border-border` (decorative), `border-transparent`; no new token, no contrast pair.

#### Built-in text

None new; the inline Close button uses `closeLabel` (`'Close'`).

#### Tests

`src/components/overlays/__tests__/Drawer.inline.test.tsx` (new):
1. An `<aside>` in place: inside the render container, no `.wave-portal` wrapper in `document.body`, `getByRole('complementary', { name: 'Details' })`, `data-type="inline"`, no `role="dialog"`, no `aria-modal`, no `tabindex`; the direct trigger precedes it in DOM order.
2. No modal machinery: no backdrop element; a page button stays focusable and clickable while open (no `inert` on siblings); `<html>`/`<body>` keep their scroll styles; Tab from the panel's last tabbable reaches the next page element; `getTopmostLayer()` is `null` while it is open.
3. Opening keeps focus on the trigger; with the default `unmountOnClose` an `autoFocus` field inside takes focus on open.
4. `Drawer.Trigger` toggles: `aria-expanded` false → true → false, `aria-controls` = the aside's id only while open, no `aria-haspopup` attribute; `onOpenChange(true, { reason: 'trigger', event })` then `(false, { reason: 'trigger', … })`; a render-prop child receives no `aria-haspopup` key.
5. The Close button closes (`close-button`) and focus returns to the trigger; `Drawer.Close` (`close`) too; `finalFocusRef` wins; with two triggers, focus returns to the one that opened it.
6. A controlled close while focus is on a page button leaves it there; while focus is on `<body>` leaves it there; while focus is in the panel restores, also when the panel unmounts in the next render.
7. Escape (focus in the panel and on the page) and an outside press never call `onOpenChange`.
8. `separator`: `data-separator` and the `data-[separator]:border-border` class path; `border-transparent` and `forced-colors:border-[CanvasText]` with and without it; the inner edge per position (start `border-e`, end `border-s`, left `border-r`, right `border-l`, bottom `border-t`); `separator` on an overlay renders no `data-separator`.
9. Sizes and positions: `data-size`, `data-position` on the aside; side widths and bottom heights from the shared maps; no inset classes; `className="w-[480px]"` wins.
10. RTL: a `start` inline drawer carries `border-e` and no physical class; the trigger toggles.
11. SSR: `renderToString` of an open (`defaultOpen` and `open`) inline drawer holds `<aside`, the title, the content and `data-presence="entered"`; the trigger has `aria-expanded="true"` and `aria-controls` = the aside's id; `findDanglingIdRefsInHtml(html)` is `[]`; `hydrateRoot` (container appended and removed in `try`/`finally`) logs nothing, reports no recoverable error, calls no `onOpenChange`; the trigger then closes it. A `Drawer.Title`-named inline drawer has its name after hydration.
12. StrictMode: one `onOpenChange` per toggle.
13. axe: open inline (title), named by `aria-label`, with `separator`, inside a `<main>`, two inline drawers (start and end) with different titles, a kept-mounted closed one.
14. Presence: `data-presence="entered"`; with `mockAnimations()` and `data-test-motion` on the aside: `exiting`, `inert`, still mounted, focus already on the trigger; after `finishAll()` unmounted (`hidden` when kept).
15. `Drawer:unnamed` for an unnamed open inline drawer (asserted, nothing else logged).
16. Type switch while open: the content remounts (an input's typed text is gone), no warning; focus inside → the trigger (overlay → inline) / inside the overlay (inline → overlay); the test-setup overlay check passes.
17. `testSystemProps(Drawer, { expectedTag: 'aside', displayName: 'Drawer', defaultProps: { type: 'inline', defaultOpen: true, title: 'Details', children: <p>Content</p> }, conflictingClass: { className: 'w-96', overrides: 'w-80' }, a11yVariants: [{ name: 'separator', props: { separator: true } }] })`.

`src/components/overlays/__tests__/Drawer.keepMounted.test.tsx` and `Dialog.keepMounted.test.tsx` (new; both drawer types where it applies):
1. Default `true`: closed renders nothing (the 0.10 tests keep passing).
2. `false`, never opened: the surface exists with `hidden`, `inert` and `data-presence="exited"` on every top-level element (the backdrop and positioner of a Dialog, the backdrop and panel of an overlay Drawer, the aside), `queryByRole('dialog')` is null and `{ hidden: true }` finds it; no layer (`getTopmostLayer()` null; Escape on the page calls nothing), no isolation, no scroll lock.
3. Form state: type into an input, close (each reason: Escape, the Close button, the backdrop, `.Close`, the trigger for inline), reopen → the value is kept; a component's own state is kept (a SpinButton's typed draft in the Drawer case, a Combobox query in the Dialog case).
4. Reopen: focus moves into the surface again (the first focusable: the Close button), the trap and isolation work, focus returns to the trigger on close.
5. Trigger: `aria-expanded="false"` and no `aria-controls` while kept closed.
6. Presence: an exit motion (`mockAnimations()`) keeps the surface mounted and `inert` while the layer is already released (Escape reaches the layer below), then `hidden`.
7. SSR: a kept overlay → server HTML without the surface, hydration without mismatch, then the hidden surface in `<body>`; a kept inline drawer → the hidden aside in the server HTML.
8. Stacking (D104): a kept-mounted Dialog rendered next to an open Drawer opens as the last child of `document.body` (its wrapper moved), Escape closes the Dialog first, then the Drawer; an unmounting Dialog is not moved twice.
9. StrictMode: one `onOpenChange` per change; no duplicate portal wrapper.
10. Toaster: a kept-mounted closed Drawer at the toasts' side moves no toast.
11. Open-inside (D106): a controlled kept-mounted Drawer closed by its parent while a Popover inside is open warns once with the exact message after `vi.advanceTimersByTime(0)` in `act` (fake timers); a trigger click that closes it while the popover is open (the press dismisses the popover) does not warn; the default `unmountOnClose` does not warn.
12. `autoFocus` (D109): a kept-mounted Dialog that mounted closed focuses its first focusable element on open; the test puts no `autoFocus` inside (the jsdom artefact).

`src/components/overlays/__tests__/Drawer.panel.test.tsx` (new, the shell's contract with raw children, `componentName: 'Test'`):
1. Overlay: a portaled `div` with `role="dialog"` (`alertdialog` with `modalType: 'alert'`), `tabIndex=-1`, the given `id`, `data-type`, `data-position`, `data-size`, `data-modal-type`; the classes start with `rootClassName`'s classes; the backdrop carries `backdropClassName`; no header, Close button or padded body is added; `size` always renders `data-size`.
2. Inline with `inlineAs: 'div'`: a `div` in place, no role, `data-separator` from `separator: true`; with `'aside'` an `<aside>`.
3. The layer: `getTopmostLayer()?.kind` is `'modal'` (`'dialog'` with `non-modal`); a Toaster beside it measures the panel (stubbed rect → `--wave-toaster-offset`).
4. Escape and a backdrop press call `requestOpen(false, { reason, event })`; inline calls nothing.
5. The inline restore with `requireFocusInside`; the non-modal Tab order with an opener; kept mounted (`unmountOnClose: false`) with D104's raise.
6. `trigger: inertModalTrigger`: focus returns to the captured opener.
7. Two shells with different `rootClassName` values (a variant's) carry both roots in order.

`src/components/overlays/__tests__/Drawer.test.tsx` (owned): the second `testSystemProps` block is case 17 above (kept here or in `Drawer.inline.test.tsx`, one place); the 0.10 server and hydration tests are renamed "an overlay drawer …" where the text says "drawer" alone (`:143`, `:149`, `:162`).

`src/components/overlays/__tests__/stableClassNames.test.tsx`: "Drawer (inline): root on the aside, header, title heading, Close Button and body; no backdrop" (reading the constants).

Type tests (`Drawer.test.tsx`): `DrawerType` is `'overlay' | 'inline'`; `DrawerProps['type' | 'separator' | 'unmountOnClose']`; `DialogProps['unmountOnClose']`; `DrawerProps['ref']` is `React.Ref<HTMLElement> | undefined`; a `useRef<HTMLDivElement>(null)` still passes as `ref` (compile-only); `DrawerTriggerRenderProps['aria-haspopup']` is `'dialog' | undefined`.

#### Stories

`stories/Drawer.stories.tsx`: **Inline** (a flex row with an end details pane, `separator`, `Drawer.Trigger` toggling; names), **InlineStart** (a start pane controlled from a page-header button with `aria-expanded` and `aria-controls={id}`), **InlineBottom**, **KeepMounted** (an overlay with a form and `unmountOnClose={false}`: type, close, reopen), **ResponsiveType** (`type` switched by an SSR-safe media hook; the docblock documents the remount; P6-08's app shell builds on it). `stories/Dialog.stories.tsx`: **KeepMounted** (a form keeps its values). Defaults in `args`, `fn()` callbacks, tokens only (C-STORIES). The `TriggerWithTooltip` docblock ("exists only while the drawer is open") becomes "is not rendered while the drawer is closed".


---

### P6-09 — Nav parts (P6-nav)

Nav gains the parts of Fluent's navigation pane: `Nav.SectionHeader` (a heading between groups), `Nav.Divider` (a line between groups), `Nav.AppItem` and `Nav.AppItemStatic` (the app's name and logo at the top), and `actions` on `Nav.Item` and `Nav.SubItem` (Fluent's SplitNavItem: your own pin, toggle and menu buttons beside an item). Every part renders its own `<li>`, so the Nav's lists stay valid, and a development check names a child of a Nav list that is not an `<li>`. The first task of `P6-nav` is a behaviour-neutral split of the 945-line `Nav.tsx` into one-way modules, whose state hook (`useNavRootState`), contexts, roving context and list-child check are the seam `P6-navdrawer` builds NavDrawer on in wave C (frozen in §4). A plain Nav's DOM, classes, warnings and behaviour do not change.

**Closes:** `nav-9` (L), `nav-10` (L), `nav-11` (L), `nav-12` (L), `nav-5` (L). **Guards:** Nav is a real `<nav>` with lists and disabled items (`Nav.test.tsx` "has navigation aria-label", "renders nav items as list items" and the "disabled items" suite, unchanged); the split is behaviour-neutral (`Nav.test.tsx` passes with only the additive edits of §6.4, its Server Component, Suspense and memo tests included); a closed category that holds the current page is still marked (P1-24, Phase 1 D18), also when the current sub-item has `actions`.

#### Rulings

- **D110 — The Nav split: four modules, imports one way (P6-nav's first task).** `Nav.context.ts` holds the contexts (`NavContext`, `NavCategoryValueContext`, the new `NavRovingContext`), their hooks (`useNavContext`, `useNavValue`, `useRecordCategory`), the category store (`NavCategoryStore`, `createCategoryStore`), the part markers and the children walks (D111), the list-child check (D114) and the type `NoAnchorOnlyAttributes`; it imports no component. `Nav.root.tsx` holds `NavProps`, `useNavRootState` (D112) and `NavRoot` (no docblock, C-DOCS; `displayName` `'Nav'`). `Nav.parts.tsx` holds `NavSectionHeader`, `NavDivider`, `NavAppItem`, `NavAppItemStatic` and their props types. `Nav.tsx` stays the compound module: the item types, styles, `renderNavEntry`, `NavCategory`, `NavItem` and `NavSubItem` (whose overload docblocks `.storybook/__tests__/exportDocblocks.test.ts:344` pins there), the `Object.assign`, its JSDoc, the flat re-exports and the type re-exports (`NavProps` from `Nav.root.tsx`, the parts' props from `Nav.parts.tsx`). Imports: `Nav.tsx → Nav.root.tsx, Nav.parts.tsx, Nav.context.ts`; `Nav.root.tsx → Nav.context.ts`; `Nav.parts.tsx → Nav.context.ts`; NavDrawer (P6-08) → `Nav.root.tsx`, `Nav.context.ts`; nothing imports `Nav.tsx` (the barrel aside). The split moves code without changing it: every class string, warning key and text, attribute order and hook order stays, and `Nav.test.tsx`, `stableClassNames.test.tsx` and the integration Nav case pass before any part is added. *Why:* P6-08 needs Nav's state without Nav's `<nav><ul>` and must not import the compound (an import of only `Nav` must hold no NavDrawer code, and the reverse); the Menu, Toast and Tree splits are the precedent (CLAUDE.md Architecture); keeping `NavItem`/`NavSubItem` in `Nav.tsx` keeps the docblock pin and the `exportDocblocks` root detection (`NavRoot` imported from a sibling module, as `MenuRoot`) working without an edit (memo B, C25; critic fix 9).
- **D111 — Parts are recognised by a marker, not by an import.** `markNavPart(component, kind)` (`kind`: `'entry'` for `NavItem` and `NavSubItem`, `'category'` for `NavCategory`) sets a module-private symbol property, called next to each `displayName` in `Nav.tsx`; `getNavPartKind(element)` resolves the element's type with `getElementType(element, { suspend: false })` (lazy client references included, a lazy type still loading is no part) and reads the marker. `containsValue` and `findCategoriesContaining` (moved verbatim from `Nav.tsx:443-518`, with `isPart(child, NavItem, NavSubItem)` → `getNavPartKind(child) === 'entry'` and `isPart(child, NavCategory)` → `=== 'category'`) live in `Nav.context.ts`. *Why:* the walks run in `useNavRootState`'s initializer (`Nav.root.tsx`) and in `NavCategory`, and `Nav.root.tsx` cannot import `Nav.tsx` (a cycle: `Nav.tsx` imports `NavRoot`); `markFieldLabel`/`isFieldLabelElement` (`src/components/input/fieldLabel.ts`) is the precedent of a marker read through `getElementType`; the existing Server Component and Suspense tests of `Nav.test.tsx` (`:114-253`) guard the equivalence.
- **D112 — `useNavRootState` is the one state model of Nav and NavDrawer.** It holds what `NavRoot` holds today (`Nav.tsx:838-898`): the selection through `useControllable`, `select` (sets the value, then calls `onActivate` on every activation), the initial open categories (`defaultOpenCategories`, else `findCategoriesContaining(children, value ?? defaultValue)`, read once in a `useState` initializer), the open categories through `useControllable` (a new array to `onOpenCategoriesChange`), the duplicate-value registry, the category store and the memoised `NavContextValue` (same fields, same `useMemo` dependencies). The caller resolves its own props first: `NavRoot` resolves the deprecated `selectedValue`, `defaultSelectedValue` and `onNavItemSelect` (warnings unchanged) and passes `onNavItemSelect` as `onActivate`; NavDrawer has no deprecated alias. The duplicate warnings take the caller's `componentName`: key `${componentName}:duplicate-item:<value>` and the text of `Nav.tsx:121-126` with `Nav` replaced by it (`Nav:` keeps its 0.10 key and text, `Nav.test.tsx:1624-1649` unchanged). *Why:* one model keeps every Nav rule (P1-24's mark and its server scan, the duplicate warnings, the callback semantics) in a NavDrawer; the state lives above the drawer panel, so a responsive `type` switch, which remounts the panel (D105), keeps the selection and the open categories (critic C25).
- **D113 — `NavRovingContext`: roving bookkeeping for an arrow-key body, absent in a plain Nav.** A module-only `React.createContext<NavRovingContextValue | null>(null)` (`displayName` `'NavRovingContext'`) that `NavDrawer.Body` provides in its arrow mode (P6-08, D130); its one member is `reportCurrentCategory(category, holdsCurrent)`. While it is provided, `renderNavEntry` renders `data-roving-value={value}` on the link or button of every `Nav.Item` and `Nav.SubItem` (after `{...rest}`: bookkeeping wins), and `NavCategory` renders `data-roving-value={'wave-nav-category:' + value}` on its toggle and reports, from a layout effect keyed on `[context, value, containsCurrent]`, whether it is a closed category that holds the current page (`reportCurrentCategory(value, containsCurrent)`, and `(value, false)` in the cleanup). While it is `null` (every plain Nav) nothing new is rendered and nothing is reported: the server HTML of a Nav is the same as 0.10's. `Nav.AppItem` and item `actions` render no `data-roving-value` (the roving hook stamps `auto-<n>` values on them). *Why:* the arrow body's initial Tab stop is the current page, or the closed category that holds it (D130), and `useRovingTabIndex` matches `activeValue` against `data-roving-value`; every value is stable and rendered by React, so the hook never stamps one on an entry or a toggle, the hand-back of a mode switch (D131) leaves nothing stale, and a toggle keeps its value when Enter opens it (were the current value moved from the toggle to the sub-item it reveals, the "last focused" Tab stop would jump to the sub-item while focus stays on the toggle, and Tab would no longer leave the body); critic C25: the seam carries P6-08's `NavRovingContext`.
- **D114 — Every child of a Nav list is an `<li>`; a development check names one that is not.** Each new part renders its own `<li>`. `useNavListChildCheck(list, owner, contents)` (`Nav.context.ts`, frozen for NavDrawer.Body and NavDrawer.Footer, memo C27) runs an effect after every commit of the component that calls it, in development only (`if (!isDev) return`): it walks the list element's child nodes and warns once per owner (`warnOnce`, key `${owner}:list-child`) at the first element child that is not an `<li>`, `<script>` or `<template>`, or the first text node with more than whitespace. `NavRoot` calls it for its `<ul>` (`'Nav'`, `'items'`) and `NavCategory` for its open list (`'Nav.Category'`, `'sub-items'`). Comment nodes, `null`, Fragments and Suspense boundaries render nothing of their own and never warn; a Tooltip wrapped around a `Nav.Item` (its wrapper `<span>` sits in the list) does. *Why:* the roadmap acceptance ("every child an `<li>`") and `nav-5`; a DOM check sees through consumer components, which a static `flattenChildren` scan cannot; a `<template>` is React's placeholder for a streaming Suspense boundary; C-DEV (diagnostics from effects).
- **D115 — `Nav.SectionHeader` is a heading in its own `<li>`, a flat sibling of the items.** `<li class="wave-nav-section-header__list-item"><h{n} class="wave-nav-section-header …">children</h{n}></li>`, where `n` is `headingLevel?: HeadingLevel` (`1 | 2 | 3 | 4 | 5 | 6`, the foundation's shared type, `@default 3`); `className`, `style`, `id`, `ref` and the rest go to the heading; it groups nothing (no wrapper around the items that follow, no `aria-labelledby`). Children that render nothing (`slotRendersContent` false; a generator through `materialiseSlotContent`) render no `<li>` and no heading. It is allowed in a `Nav.Category`'s list. *Why:* Fluent's NavSectionHeader is a flat `h3` sibling (`useNavSectionHeader.ts`); a heading inside a list item is valid and passes axe (verified with axe 4.13), and gives screen-reader users heading navigation without restructuring the Nav; `headingLevel` is WaveUI's name and default (Accordion, `Accordion.tsx:131-136`; Drawer.HeaderTitle, D83); an empty heading fails axe `empty-heading` (verified).
- **D116 — `Nav.Divider` is a decorative `<li aria-hidden="true">`.** `<li aria-hidden="true" class="wave-nav-divider my-1 h-0 border-t border-border forced-colors:border-[CanvasText]">`, with no children (its props omit `children`); it does not render through `Divider` and carries no `wave-divider` (Phase 3 judgement 6, as `Menu.Divider` and `Toolbar.Divider`). *Why:* axe 4.13's `list` rule fails any list child whose explicit role is not `listitem` (`<li role="separator">` fails `list`; `<li aria-hidden="true">` passes, also as a list's only child; verified), so the roadmap's sketch cannot pass the gate (memo D); the Pagination ellipsis is the precedent of a hidden list item (`Pagination.tsx:327-330`); the list's item count then counts destinations only, and `Nav.SectionHeader` carries the structure. Fluent's NavDivider is a `separator`: §8.3.
- **D117 — `Nav.AppItem`: a link with `href`, a button without; never selected.** `<li class="wave-nav-app-item__list-item"><a|button class="wave-nav-app-item …">{icon}<span class="wave-nav-app-item__content">children</span></a|button></li>`, typed like `Nav.Item` by `href`-discriminated overloads (button, link, then dynamic). It has no `value`, no `aria-current` of its own (a consumer's passes through), is not registered with the Nav and has no `opensElsewhere` logic; a click runs only the consumer's `onClick` and the browser default. `icon?: Slot<'span'>` renders `aria-hidden` in a box at least 20px square that grows with its content (a 32px logo or a medium `Avatar` fits), and an icon that renders nothing renders no box. The button branch puts `type="button"` before `{...rest}` and omits `value` from its attributes (so `value` is a type error on every branch: an item turned into an app item does not land `value` on the `<button>`). Both branches carry `disabledStyles` and gate their hover (`not-disabled:not-aria-disabled:hover:`), so a consumer `disabled` button or `aria-disabled` link looks unavailable (the part adds no disabled logic of its own). The look is Fluent's subtitle (`text-subtitle-2`) on Nav.Item's padding and gap. *Why:* Fluent's AppItem (`useAppItem.ts`) has no value or selection; WaveUI's Nav.Item is an `href` union (0.5 P13), and the same typing keeps the two interchangeable; overloads are supported by verify-dist's docblock check and `exportDocblocks.test.ts`.
- **D118 — `Nav.AppItemStatic`: the same layout in a `<div>`, its own constant.** `<li class="wave-nav-app-item-static__list-item"><div class="wave-nav-app-item-static …">{icon}<span class="wave-nav-app-item-static__content">children</span></div></li>`: not focusable, no role, no hover, `cursor-default`. It does not carry `wave-nav-app-item` (it is no variant: another element kind; Fluent's `fui-AppItemStatic` does not carry `fui-AppItem` either). *Why:* the gap row and Fluent name both parts; an AppItem that turns static without `href` or `onClick` would guess intent.
- **D119 — SplitNavItem is `actions` on `Nav.Item` and `Nav.SubItem` (memo C26).** `actions?: React.ReactNode` joins `NavItemOwnProps` (so every Nav.Item and Nav.SubItem branch has it). While it renders content (`slotRendersContent`; a generator through `materialiseSlotContent`, as Tree), the entry's `<li>` holds the link or button, then `<span role="group" aria-labelledby={itemId} data-wave-nav-actions="" class="wave-nav-item__actions …">{actions}</span>` (`wave-nav-sub-item__actions` for a sub-item): siblings, never nested. `itemId` is the consumer's `id`, else `useId('wave-nav-item')` (called always, rendered only while actions render, so the server HTML of an item without actions is unchanged). The actions are the consumer's controls (a `ToggleButton` that pins the page, a `MenuButton` in a `Menu`, each optionally in a `Tooltip relationship="label"`); a click or key on one never selects the item (they are outside the link), and they stay enabled when the item is `disabled` (they act on the page, which can still be pinned or managed). The category walk is unchanged: `actions` is not `children`, and the item still registers and records its category. *Why:* the `Tree.Item` `actions` precedent (Phase 3 D26: one node prop, a set named by the item, no built-in string); Fluent's six fixed slots (three button kinds with unnamed default Pin and More glyphs, three tooltip slots) add API where WaveUI's buttons and tooltips already compose; a prop on the existing parts needs no copy of the three-branch union, no new member and no context that changes a child's markup. The group is `group`, not Tree's `toolbar`: in a Nav each action is its own Tab stop (no arrow keys inside the set), and a toolbar promises arrow keys.
- **D120 — Actions show on hover and focus by opacity, with holds; no motion.** Each direct child of the actions element has opacity 0 until the row (`group/nav-row` on the `<li>`) is hovered or has focus inside it, and is always drawn in forced colours and on devices without hover; a child that is, or holds, a pressed toggle (`aria-pressed="true"`) or an expanded trigger (`aria-expanded="true"`) stays drawn. Classes (each generates a valid rule with the repo's Tailwind 4.3.3, verified; the reveals are (0,2,0) or later in the output than the (0,1,0) hide): `*:opacity-0 group-hover/nav-row:*:opacity-100 group-focus-within/nav-row:*:opacity-100 forced-colors:*:opacity-100 [@media(hover:none)]:*:opacity-100 *:has-[[aria-pressed=true]]:opacity-100 *:has-[[aria-expanded=true]]:opacity-100 [&>[aria-pressed=true]]:opacity-100 [&>[aria-expanded=true]]:opacity-100`. No transition (Phase 2 rule 15; Phase 10 may add Fluent's 150ms fade). *Why:* every Nav entry is a Tab stop, so Shift+Tab from the next row must land on the last action and a focus return (a Menu or Dialog closing) must reach a hidden action: Tree's `invisible` (D26) would take neither, opacity keeps both and `:focus-within` reveals the focused one (Fluent's `hoverAction`, `useSplitNavItemStyles.styles.ts`); a pressed pin is state that must stay visible without hover (Fluent's story does it with a consumer class); Tailwind 4 puts `group-hover` inside `@media (hover: hover)`, so touch needs its own rule (Tree precedent); the `*:has-` pair covers an action wrapped in a Tooltip's span, the `[&>…]` pair a bare button. Open question Q-NAV2 (§8).
- **D121 — With actions, the selected look and the hover move to the row.** The `<li>` of an entry with actions adds `group/nav-row flex items-center transition-colors motion-reduce:transition-none` and, for a selected `Nav.Item`, `bg-subtle-selected border-s-2 border-s-primary`, otherwise (not disabled) `hover:bg-subtle-hover` (an `<li>` cannot be disabled, so the bare variant is right, C-TOKENS); the link or button adds `min-w-0 flex-1`, and a selected `Nav.Item`'s link keeps `text-primary font-semibold` without the background and the indicator. A `Nav.SubItem` row gets only the row hover (sub-items have no selected background). Entries without actions are unchanged. *Why:* Fluent puts the background and hover on the SplitNavItem root and keeps the inner item transparent; a highlight that stopped before the actions would split the row; the 0.10 selected-look tests (`Nav.test.tsx:1416-1420`, `:1429-1439`) stay valid. A consumer `className` on a selected item with actions no longer covers the row: `.wave-nav-item__list-item` is the hook (documented).
- **D122 — The new parts read the Nav context (C-CONTEXT).** Each calls `useNavContext('Nav.SectionHeader' | 'Nav.Divider' | 'Nav.AppItem' | 'Nav.AppItemStatic')`: outside a Nav (or a NavDrawer, which provides it) it throws `[WaveUI] Nav.<Part> must be used within Nav` in development, and in production logs once per message and renders the part as usual. *Why:* each renders an `<li>`, which is invalid outside the Nav's lists; the existing parts behave the same (`Nav.tsx:113-118`).
- **D123 — Server rendering and Server Components.** Every part renders deterministically on the server; the actions group's `aria-labelledby` points at an id in the same HTML (`useId`, stable across server and client). Parts written in a Server Component arrive as lazy client references: the new parts are never classified (only entries and categories are, by marker, D111), and they render the same server HTML and behave the same as plain parts. *Why:* C-COMPOUND; the RSC regression suite (integration).

#### API

```ts
// src/lib/types.ts (F6-foundation)
/** Level of a heading element, `<h1>` … `<h6>`. */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

// src/components/navigation/Nav.context.ts (module-only; frozen members in §4)
/**
 * The attributes only a link has (`target`, `download`, `hrefLang`, `ping`, …). Button items
 * declare them as `undefined`, so they are a type error without `href` (moved from Nav.tsx).
 */
export type NoAnchorOnlyAttributes = {
  [K in Exclude<
    keyof React.AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof React.ButtonHTMLAttributes<HTMLButtonElement>
  >]?: undefined;
};

// src/components/navigation/Nav.tsx — NavItemOwnProps gains (NavSubItemOwnProps = Omit<…, 'icon'> inherits it)
/**
 * Controls beside the item in its row (Fluent's SplitNavItem): a ToggleButton that pins the page,
 * a MenuButton with more commands, each with its own name (a Tooltip with `relationship="label"`
 * names an icon-only one). They render after the item's link or button, never inside it, in a
 * group named by the item; each is a Tab stop after the item, and a click or key on one never
 * selects the item. They are drawn while the row is hovered or has focus, while one of them is
 * pressed or has its popup open, and always in forced colours and on touch screens; otherwise they
 * are transparent and still focusable. They stay enabled when the item is `disabled`. With
 * actions, the selected background and indicator are drawn on the row (the item's list item).
 * Content that renders nothing renders no group. Fluent's `actionButton`, `toggleButton` and
 * `menuButton` slots and their tooltips are your own controls here.
 */
actions?: React.ReactNode;

// src/components/navigation/Nav.tsx — NavCategoryProps.children (JSDoc only)
/** The category's sub-items (`Nav.SubItem`), and `Nav.SectionHeader` and `Nav.Divider`, rendered in its list while it is open. */
children?: React.ReactNode;

// src/components/navigation/Nav.parts.tsx
/** Properties for the NavSectionHeader sub-component. */
export interface NavSectionHeaderProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /**
   * Level of the heading element (`<h1>` … `<h6>`). Pick the level that fits the page's outline.
   * Fluent's NavSectionHeader changes its element through `as`.
   * @default 3
   */
  headingLevel?: HeadingLevel;
  /** The header text. A header whose children render nothing renders nothing at all. */
  children?: React.ReactNode;
  /** Ref to the heading element. */
  ref?: React.Ref<HTMLHeadingElement>;
}

/** Properties for the NavDivider sub-component. */
export interface NavDividerProps extends Omit<React.HTMLAttributes<HTMLLIElement>, 'children'> {
  /** Ref to the divider's list item. */
  ref?: React.Ref<HTMLLIElement>;
}

/** The props of Nav.AppItem that every branch shares. */
export interface NavAppItemOwnProps {
  /**
   * The app's logo or an Avatar, before its name. Rendered with `aria-hidden="true"` in a box at
   * least 20px square that grows with its content. A falsy icon (`''`, `0`) or a list of nothing
   * renders no icon box.
   */
  icon?: Slot<'span'>;
  /** The app's name. */
  children?: React.ReactNode;
}

/** Nav.AppItem rendered as a link (`href` given): anchor attributes, handlers typed on `HTMLAnchorElement`. */
export interface NavAppItemAnchorProps
  extends NavAppItemOwnProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NavAppItemOwnProps> {
  /** URL of the app's start page; renders an `<a>`. Required in this branch, so `href` discriminates the union. */
  href: string;
  /** Ref to the `<a>` element. */
  ref?: React.Ref<HTMLAnchorElement>;
}

/** Nav.AppItem rendered as a button (no `href`): button attributes without `value` (an app item is never selected). */
export interface NavAppItemButtonProps
  extends NavAppItemOwnProps,
    NoAnchorOnlyAttributes,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof NavAppItemOwnProps | 'value'> {
  /** Button app items have no `href`. */
  href?: undefined;
  /** Ref to the `<button>` element. */
  ref?: React.Ref<HTMLButtonElement>;
}

/** Properties for the NavAppItem sub-component: link props with `href`, button props without. */
export type NavAppItemProps = NavAppItemAnchorProps | NavAppItemButtonProps;

/**
 * Nav.AppItem with an `href` known only at run time (`string | undefined`): a link when it is a
 * string, a button otherwise; only the attributes both elements share, handlers of either element.
 */
export interface NavAppItemDynamicProps
  extends NavAppItemOwnProps,
    Omit<React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement>, keyof NavAppItemOwnProps> {
  /** URL of the app's start page; renders an `<a>` when defined, a `<button>` otherwise. */
  href?: string;
  /** Ref to the rendered `<a>` or `<button>` element. */
  ref?: React.Ref<HTMLAnchorElement | HTMLButtonElement>;
}

// Overloads, resolved in order (the component JSDoc sits on the first signature, as NavItem's):
// function NavAppItem(props: NavAppItemButtonProps): React.ReactElement;
// function NavAppItem(props: NavAppItemAnchorProps): React.ReactElement;
// function NavAppItem(props: NavAppItemDynamicProps): React.ReactElement;

/** Properties for the NavAppItemStatic sub-component. */
export interface NavAppItemStaticProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The app's logo or an Avatar (as Nav.AppItem's `icon`). */
  icon?: Slot<'span'>;
  /** The app's name. */
  children?: React.ReactNode;
  /** Ref to the `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

// src/components/navigation/Nav.tsx — the compound
export const Nav = /* @__PURE__ */ Object.assign(NavRoot, {
  Category: NavCategory,
  Item: NavItem,
  SubItem: NavSubItem,
  SectionHeader: NavSectionHeader,
  Divider: NavDivider,
  AppItem: NavAppItem,
  AppItemStatic: NavAppItemStatic,
});
export { NavCategory, NavItem, NavSubItem, NavSectionHeader, NavDivider, NavAppItem, NavAppItemStatic };
export type { NavProps } from './Nav.root';
export type {
  NavSectionHeaderProps, NavDividerProps, NavAppItemOwnProps, NavAppItemAnchorProps,
  NavAppItemButtonProps, NavAppItemProps, NavAppItemDynamicProps, NavAppItemStaticProps,
} from './Nav.parts';
```

Component JSDoc (C-DOCS): each part's on its own definition (`NavAppItem`'s on its first overload). `NavSectionHeader`: "A heading between groups of items (`<h3>` by default, `headingLevel`), in its own list item. It names nothing by itself: place it before the items it introduces. A header whose children render nothing renders nothing. Also exported as `NavSectionHeader`." `NavDivider`: "A line between groups of items, in its own list item, hidden from assistive technology (a list holds only list items; use `Nav.SectionHeader` to name a group). Also exported as `NavDivider`." `NavAppItem`: "The app's name and logo at the top of the navigation: a link with `href` (the app's start page), a button otherwise. It is never selected and never marked as the current page. Typed by overloads like `Nav.Item`. Also exported as `NavAppItem`." `NavAppItemStatic`: "The app's name and logo as plain text (not a link or button). Also exported as `NavAppItemStatic`." The `Nav` export's JSDoc gains a **Structure** bullet ("every child of the Nav, and of a category, is a part or your own `<li>`; a development warning names anything else") and lists the new flat names; it names the Fluent parts that differ (`SplitNavItem` → `actions`, `NavSectionHeader as` → `headingLevel`).

#### Behaviour

**Keyboard.** No new keys.

| Key | Where | Action |
|---|---|---|
| Tab / Shift+Tab | the Nav | every enabled item, category toggle and `Nav.AppItem` is a Tab stop; an item's actions follow it in DOM order (Tab: item → its actions → next row; Shift+Tab reaches the last action of the row above) |
| Enter | `Nav.AppItem` link | follows the link (native) |
| Enter / Space | `Nav.AppItem` button | activates it (native); nothing is selected |
| any key | an action | the action's own (a MenuButton's ArrowDown opens its Menu); never selects the item |

`Nav.SectionHeader`, `Nav.Divider` and `Nav.AppItemStatic` are not focusable.

**Pointer.** Hovering a row draws its actions; clicking an action never selects the item; `Nav.AppItem` navigates or runs `onClick`.

**Focus.** A Menu opened from an action returns focus to its trigger (Menu's rule); the trigger stays drawn while expanded and is focusable while transparent, so every focus return reaches it.

**ARIA.** `Nav.SectionHeader`: `heading` of level `headingLevel` inside a `listitem`. `Nav.Divider`: hidden. `Nav.AppItem`: a link or button named by its text. `Nav.AppItemStatic`: text in a list item. Actions: a `group` named by the item ("Reports, group", then "Pin, toggle button, not pressed"). The Nav's list counts its items, headers and app items, not its dividers.

**Announcements.** None.

**Selection and registry.** Unchanged: `Nav.AppItem`, `Nav.AppItemStatic`, `Nav.SectionHeader` and `Nav.Divider` have no value; items with actions register and record their category as in 0.10.

**SSR and hydration.** D123. `renderToString` of a Nav with every part matches the client render; hydration logs nothing. A plain Nav's server HTML is unchanged by the split and by D113.

**RTL.** Logical utilities only (`px-4`, `pe-2`, `text-start`, `border-s-2`); the actions sit at the row's end (the left in RTL) through DOM order.

**Forced colours.** The actions are always drawn; the divider and the selected row's indicator are borders (`forced-colors:border-[CanvasText]` on the divider); headers are text.

**Reduced motion.** No motion is added (Phase 2 rule 15); `Nav.AppItem` and an actions row carry `transition-colors motion-reduce:transition-none`, as the items do.

**Development warnings** (all from effects through `warnOnce`, C-DEV):

| Key | When | Message |
|---|---|---|
| `Nav:list-child` | a child of the Nav's list is not an `<li>` (D114) | `` Nav: its list holds a <div> element, but a list can hold only <li> elements. Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>. `` (the tag of the first offending element, lower case; for text: `its list holds text`) |
| `Nav.Category:list-child` | the same in an open category's list | `` Nav.Category: its list holds a <div> element, but a list can hold only <li> elements. Use Nav.SubItem, Nav.SectionHeader and Nav.Divider as its children, or wrap your own content in an <li>. `` |
| missing context | a new part outside a Nav | `[WaveUI] Nav.SectionHeader must be used within Nav` (and `Nav.Divider`, `Nav.AppItem`, `Nav.AppItemStatic`), through `reportMissingContext` |
| `Nav:duplicate-item:<value>`, `Nav:duplicate-category:<value>` | unchanged (D112) | unchanged |

No warning for an empty header (it renders nothing) or for unnamed actions (Button and Tooltip warn for themselves).

#### DOM and classes

```html
<nav aria-label="Navigation" class="wave-nav w-60 border-e border-border bg-background py-2">
  <ul class="wave-nav__list m-0 list-none p-0">
    <li class="wave-nav-app-item__list-item">
      <a href="/" class="wave-nav-app-item flex w-full items-center gap-2 px-4 py-2 text-subtitle-2 text-start text-foreground no-underline bg-transparent transition-colors motion-reduce:transition-none not-disabled:not-aria-disabled:hover:bg-subtle-hover {focusRingInset} {disabledStyles}">
        <span aria-hidden="true" class="wave-nav-app-item__icon flex min-h-5 min-w-5 shrink-0 items-center justify-center">…</span>
        <span class="wave-nav-app-item__content flex-1 text-start">Contoso HR</span>
      </a>
    </li>
    <li class="wave-nav-section-header__list-item">
      <h3 class="wave-nav-section-header m-0 px-4 pt-3 pb-1 text-caption-1 font-semibold text-muted-foreground text-start">Employee management</h3>
    </li>
    <li class="wave-nav-item__list-item group/nav-row flex items-center transition-colors motion-reduce:transition-none bg-subtle-selected border-s-2 border-s-primary">
      <a id="wave-nav-item-«r1»" href="/reports" aria-current="page" class="wave-nav-item … text-primary font-semibold min-w-0 flex-1">…Reports</a>
      <span role="group" aria-labelledby="wave-nav-item-«r1»" data-wave-nav-actions="" class="wave-nav-item__actions flex shrink-0 items-center gap-1 pe-2 {reveal classes, D120}">
        <span class="wave-tooltip inline-block"><button type="button" aria-pressed="false" aria-labelledby="…">…</button><span role="tooltip" hidden>Pin</span></span>
        <button type="button" aria-haspopup="menu" aria-expanded="false" aria-label="More options">…</button>
      </span>
    </li>
    <li aria-hidden="true" class="wave-nav-divider my-1 h-0 border-t border-border forced-colors:border-[CanvasText]"></li>
    <li class="wave-nav-app-item-static__list-item">
      <div class="wave-nav-app-item-static flex w-full items-center gap-2 px-4 py-2 text-subtitle-2 text-start text-foreground cursor-default">…</div>
    </li>
  </ul>
</nav>
```

- `className`, `style`, `ref` and the rest go to: the heading (SectionHeader), the `<li>` (Divider), the link or button (AppItem), the `<div>` (AppItemStatic); the `listItem`, `icon` and `content` classes sit outside the `className` target (Phase 3 judgement 12). Every new part's stable class is first in its `cn()` as a literal member access (Phase 3 rules 1 and 8).
- Item `actions`: the reveal classes of D120 on the actions element; the row classes of D121 on the `<li>`; `data-wave-nav-actions` is an internal query marker (no styling hook, not documented as API).
- `data-*` state: none new. No part has a state attribute; `headingLevel` is visible as the tag.

Registry (`src/lib/classNames.ts`, landed by the foundation, D-numbers of §1):

```ts
/** Nav.SectionHeader: `root` on the heading element; `listItem` on the list item around it. */
export const navSectionHeaderClassNames = {
  root: 'wave-nav-section-header',
  listItem: 'wave-nav-section-header__list-item',
} as const;

/** Nav.Divider: `root` on its list item (hidden from assistive technology). */
export const navDividerClassNames = { root: 'wave-nav-divider' } as const;

/**
 * Nav.AppItem: `root` on the `<a>` (with `href`) or `<button>`; `listItem` on the list item around
 * it; `icon` on the icon span; `content` on the label span.
 */
export const navAppItemClassNames = {
  root: 'wave-nav-app-item',
  listItem: 'wave-nav-app-item__list-item',
  icon: 'wave-nav-app-item__icon',
  content: 'wave-nav-app-item__content',
} as const;

/** Nav.AppItemStatic: `root` on the `<div>`; `listItem` on the list item around it; `icon`; `content`. */
export const navAppItemStaticClassNames = {
  root: 'wave-nav-app-item-static',
  listItem: 'wave-nav-app-item-static__list-item',
  icon: 'wave-nav-app-item-static__icon',
  content: 'wave-nav-app-item-static__content',
} as const;

// navItemClassNames gains   actions: 'wave-nav-item__actions'      (JSDoc: "`actions` on the group of its `actions`")
// navSubItemClassNames gains actions: 'wave-nav-sub-item__actions'
```

No `DISPLAY_NAME_ALIASES` or `VARIANT_BASES` entry (the display names `NavSectionHeader`, `NavDivider`, `NavAppItem` and `NavAppItemStatic` camel-case to their constants). JSDoc and warning texts under `src/components` and `src/lib` follow the bare-word rule ("static" and "list-item" are already excluded by `src/styles/styles.css:32`; the texts above use no other utility word).

Tokens: none new. The pairs used are asserted (`muted-foreground` on `background` and `subtle-hover`, `foreground` and `primary` on `subtle-selected`, `ring` on `subtle-selected`); the divider's `border` is decorative.

#### Built-in text

None. The actions group is named by its item and the actions by you; README "Built-in text" gains no row for P6-09.

#### Tests

`src/components/navigation/__tests__/Nav.test.tsx` (owned; the regression suite of the split): unchanged in task 1; then only the additive edits of §6.4 (`testCompoundExposure` and the flat-name case gain the four parts) and new `describe` blocks:
- "renders no data-roving-value outside an arrow body": a plain Nav with items, a marked closed category and an open one has no `data-roving-value` anywhere (D113), neither in the DOM nor in its `renderToString` output, and no item without `actions` renders an `id`.
- "with NavRovingContext": rendered inside `NavRovingContext.Provider` with a `vi.fn()` `reportCurrentCategory` (module import, as `menuHarness.tsx` does for Menu's internals): every entry carries its value and every toggle `wave-nav-category:<value>`, also after it opens; a closed category holding the current sub-item reports `('docs', true)` once (StrictMode included, after the cleanup's `('docs', false)` of the double mount), opening it reports `('docs', false)`, and unmounting it reports `false`; nothing is reported or rendered without the provider.
- "useNavRootState" (a test harness component that calls it with `componentName: 'Test'` and provides `NavContext`): initial open categories from the scan through wrapper elements (and once only), `onActivate` on every activation and `onValueChange` only on change (StrictMode once each), duplicate warnings keyed and worded with `Test:` (asserted exactly), the returned value is the same object across a re-render with unchanged state.

`src/components/navigation/__tests__/Nav.parts.test.tsx` (new):
- `testSystemProps` for `Nav.SectionHeader` (`expectedTag: 'h3'`, `displayName: 'NavSectionHeader'`, `wrapper: NavWrapper`, `defaultProps: { children: 'Benefits' }`, `conflictingClass: { className: 'px-6', overrides: 'px-4' }`), `Nav.Divider` (`'li'`, `{ className: 'my-2', overrides: 'my-1' }`), `Nav.AppItem` button (`'button'`) and link (`'a'`, `defaultProps: { href: '#home', children: 'Contoso HR' }`), `Nav.AppItemStatic` (`'div'`); `testNoImplicitSubmit` for the AppItem button.
- SectionHeader: `getByRole('heading', { level: 3, name: 'Benefits' })` inside a `listitem` of the nav's list; `headingLevel={2}` and `{6}` render `h2` and `h6`; children `''`, `[]`, `<></>` and a generator of nothing render no `<li>` and no heading; inside an open category; `m-0`, `px-4`, `text-start` (C-NATIVE, RTL).
- Divider: an `<li aria-hidden="true">` with `navDividerClassNames.root`; `queryByRole('separator')` is null; the nav list's `listitem`s exclude it; a Nav whose list holds only a divider, and an open category holding only a divider, pass axe; `forced-colors:border-[CanvasText]`; `// @ts-expect-error` for `children`.
- AppItem: with `href` a link named by its text, without a button with `type="button"`; a click (and Enter/Space on the button) never calls `onValueChange` and never sets `aria-current`, also when its `href` equals the current item's; the consumer's `onClick` runs on both branches; a consumer `aria-current="page"` passes through; `icon` is `aria-hidden`, a slot object keeps its `className`, every empty icon of `EMPTY_ICONS` renders no box, the box has `min-h-5 min-w-5` and no `h-5 w-5`; `focusRingInset` and the gated hover classes; a consumer `disabled` renders a natively disabled button with `disabledStyles`; type tests: anchor attributes without `href` are an error, `value` is an error on every branch, `href={maybe}` resolves to `NavAppItemDynamicProps`.
- AppItemStatic: a `<div>` in a `<li>`, no role, not in the Tab order (`userEvent.tab()` skips it), no hover class.
- C-CONTEXT: `it.each` of the four parts outside a Nav → `expectThrows(<Part …/>, '[WaveUI] Nav.<Part> must be used within Nav')`; production (`vi.stubEnv('NODE_ENV', 'production')`): each logs its message once (exact list of four) and renders.
- Server Components: `asClientReference` of each part renders the same `renderToString` output as the plain part and the same behaviour (an AppItem click, the heading role).
- Structure guard: a Nav with every part (AppItem, items, SectionHeader, Divider, a Category holding a SectionHeader and a Divider, AppItemStatic, an item with actions): every element child of each `<ul>` is an `LI` (`Array.from(list.children).every((c) => c.tagName === 'LI')`), with the category open and closed; axe clean in both; the landmark and the `listitem` count.

`src/components/navigation/__tests__/Nav.actions.test.tsx` (new):
- The group renders after the item inside the same `<li>`, never inside the link (`within(link).queryAllByRole('button')` is empty; `link.nextElementSibling` is the group) — for `Nav.Item` (button, link, dynamic branches) and `Nav.SubItem` in an open category.
- Naming: `getByRole('group', { name: 'Reports' })`, also with a consumer `id` (reused, no second id) and with a consumer `aria-label` on the item.
- Tab order: item → each action → next item; `userEvent.tab({ shift: true })` from the next item reaches the last action.
- Clicking an action and pressing Enter and Space on it never select (`onValueChange` not called, `aria-current` unchanged), StrictMode once.
- `actions` that render nothing (`false`, `null`, `[]`, `<></>`, a generator of nothing) render no group and keep 0.10's classes (the selected look on the link, no `group/nav-row`); a generator with content renders its items.
- Row look (D121): with actions, `bg-subtle-selected`, `border-s-2` and `border-s-primary` on the `<li>`, not on the link; the link has `min-w-0 flex-1`; a disabled item's row has no hover class; a sub-item row has only the hover.
- Reveal (D120): the actions element carries each reveal class and no `invisible`; the row carries `group/nav-row`.
- A `ToggleButton` action in a `Tooltip relationship="label"` is named "Pin" and its `aria-pressed` toggles without selecting; a `MenuButton` in a `Menu`: `aria-expanded="true"` while open, Escape closes it and focus returns to the MenuButton; axe with the menu open and closed.
- A disabled item keeps its actions enabled.
- A closed category whose current sub-item has actions is still marked, in the server HTML and after closing.
- SSR: `renderToString` holds the group with `aria-labelledby` pointing at the item's id (`findDanglingIdRefsInHtml(html)` is `[]`); `hydrateRoot` (container appended and removed in `try`/`finally`) logs nothing; an item without actions has no `id` in the server HTML.
- RTL: `pe-2` on the actions and `border-s-2` on the row, no physical class.
- Types: `expectTypeOf<NavItemOwnProps['actions']>().toEqualTypeOf<React.ReactNode | undefined>()`; accepted on the button, link and dynamic branches and on `Nav.SubItem`.

`src/components/navigation/__tests__/Nav.listChild.test.tsx` (new, D114; every `console.warn` spy asserts the exact call list):
- `<Nav><div>Stray</div></Nav>` warns once with the exact `Nav:list-child` message; a text child (`Text`) warns with `holds text`; a `<div>` in an open category warns with the `Nav.Category:` message; a Tooltip around a `Nav.Item` warns (its `<span>`).
- No warning for the parts, a consumer `<li>`, Fragments, `React.Suspense` with `fallback={null}` (pending and resolved), a component that renders `<li>`, `React.Profiler`, whitespace text; exactly once in StrictMode and across re-renders; none in production (`vi.stubEnv`).

`src/components/navigation/__tests__/stableClassNames.test.tsx` (shared by the navigation packages; P6-nav adds in wave B): a new case "Nav parts: section header and its list item, divider, app item (root, list item, icon, content), app item static, the actions of an item and a sub-item", reading every constant (`toHaveClass(navSectionHeaderClassNames.root)` …). The 0.10 Nav case (`:240-277`) is unchanged (it asserts that `nav.firstElementChild` is the list: the `<ul>` stays first).

Integration (INTEGRATION, `src/__tests__/integration.test.tsx`): the Server Component `ssrCase` "Nav (section headers, divider, app item, item actions)" with parts `{ AppItem: NavAppItem, SectionHeader: NavSectionHeader, Divider: NavDivider, Item: NavItem, AppItemStatic: NavAppItemStatic, Category: NavCategory, SubItem: NavSubItem }` and an item whose `actions` hold a Wave `Button`; `serverText: 'role="group"'`; `interact`: an action click selects nothing, the item click selects it. "Nav item actions with Menu and Tooltip": a MenuButton action's Menu (Escape returns focus to it) and a Tooltip-named ToggleButton, from the barrel; axe open and closed.

#### Stories

`stories/Nav.stories.tsx` (title `Components/Navigation/Nav`, args-driven, `fn()` callbacks; the 0.10 stories unchanged): **Sections** (an AppItem with a locally drawn logo, items, two `Nav.SectionHeader`s and a `Nav.Divider` before a footer group: Fluent's Basic layout), **AppItem** (`Nav.AppItem` with an Avatar and `href`, and `Nav.AppItemStatic`), **ItemActions** (rows with a Pin `ToggleButton` in a `Tooltip relationship="label"` (stays drawn while pressed), a "More options" `MenuButton` with a `Menu`, sub-items with actions in a category). Glyphs are drawn in the story file (`stories/Toolbar.stories.tsx` precedent), tokens only. Story imports use module paths in wave B (Phase 5 rule 25).

### P6-08 — NavDrawer and Hamburger (P6-navdrawer)

`NavDrawer` is Nav's state (`useNavRootState`, D112) and a `<nav>` landmark in the drawer panel shell that P6-overlays delivers (`DrawerPanel`, D108, frozen in §4): an overlay (a modal or non-modal dialog around the `<nav>`, in a portal) or an inline panel in the page layout, with three parts rendered in the order written: `NavDrawer.Header` (a row: a Hamburger, the app's name), `NavDrawer.Body` (the scrolling list of Nav parts, with an optional arrow-key mode, `focusMode`) and `NavDrawer.Footer` (a list pinned below the body). `Hamburger` is a Button with the navigation glyph, named "Navigation" by default, that toggles the NavDrawer it sits in and reports it with `aria-expanded` and `aria-controls`; outside a NavDrawer (the page header of an app shell) it is a plain button the app wires. The phase's exit criterion, the "App shell" story (NavDrawer + inline Drawer + Toolbar, responsive from overlay to inline), is this package's (D138).

**Closes:** `nav-6` (M), `nav-13` (L), `nav-3` (L). **Guards:** Nav is a real `<nav>` with lists and disabled items, also inside a NavDrawer (the landmark in both types, the Body and Footer `<ul>`s, disabled items never selected: `NavDrawer.test.tsx` cases 3 and 5); the collapsed-category mark of P1-24 holds in a NavDrawer (case 5, server HTML included); Drawer's `Drawer.Trigger`/`Drawer.Close` suites are untouched (NavDrawer only reads the shell). **Phase exit:** the "App shell" story passes the stories gate and `NavDrawer.appShell.test.tsx`.

#### Rulings

- **D124 — NavDrawer renders the drawer panel shell, not the public Drawer (memo C17).** `NavDrawerRoot` calls `useModalOpenState(open, defaultOpen, onOpenChange)`, `useDrawerOpen(type, openState)` and `useNavRootState({ componentName: 'NavDrawer', … })`, provides `NavContext` and its own contexts, and renders `DrawerPanel` with `componentName: 'NavDrawer'`, `inlineAs: 'div'`, `trigger: inertModalTrigger`, `rootClassName: cn(drawerClassNames.root, navDrawerClassNames.root)`, `backdropClassName: cn(drawerClassNames.backdrop, navDrawerClassNames.backdrop)` and, as its raw children, the `<nav>` that holds the parts; after it, `useModalTriggerSession(inertModalTrigger, open)` (the contract's call order). The shell provides no `DrawerContext`: `Drawer.Close`, `Drawer.Title` and `Drawer.Trigger` inside a NavDrawer throw their C-CONTEXT error (documented: close it with a Hamburger or your own button). *Why:* NavDrawer needs every piece of the panel machinery (portal or in place, presence, layer, trap, isolation, restore, the Toaster's measured layer, the size and placement maps) and none of Drawer's content structure (title, built-in header, Close button, padded body); the shell is frozen for exactly this (D108), so a later Drawer change cannot leak into NavDrawer.
- **D125 — One `<nav>` landmark in the panel; an overlay is also a dialog with the same name.** Overlay: `Portal > [backdrop] + div[role=dialog] > nav`; inline: `div (no role) > nav`. The panel (the shell's element) takes `className`, `style`, `id`, `ref`, `data-*`, handlers and the rest; the `<nav>` fills it (`flex min-h-0 flex-1 flex-col`) and takes the name. `aria-label` (default `'Navigation'`, as Nav), `aria-labelledby` and `aria-describedby` go to the `<nav>` in both types and, in the overlay type, also to the dialog panel; an `aria-labelledby` without `aria-label` drops the default. The inline panel carries no name. *Why:* an overlay NavDrawer is a modal surface and must be a named dialog (APG; WaveUI isolates with `inert`, never `aria-modal`), and `nav` allows no other role, so the dialog cannot be the `<nav>`; Fluent's `role="navigation"` with `aria-modal` on the dialog surface fails axe `aria-allowed-attr` (memo D, verified); `div > nav` and `dialog > nav` with the same name pass axe 4.13, inside and outside `<main>` (verified), while an `aria-label` on the role-less inline `div` is reported (`aria-prohibited-attr`, incomplete; verified); one inner `<nav>` in both types keeps the DOM and the tests identical across a responsive switch. Two navigation landmarks with the same name fail `landmark-unique` (verified by the research): the docs say to rename one.
- **D126 — Defaults: `type 'overlay'`, `position 'start'`, `size 'small'`, `separator true`, `modalType 'modal'`, `unmountOnClose true`.** `type` and `unmountOnClose` follow Drawer and Fluent. `position` defaults to `'start'`, where navigation sits (Fluent's NavDrawer; Drawer keeps `'end'`). `size` defaults to `'small'` (320px) and the panel always renders `data-size` (Phase 1 D22; memo C23): Fluent's unset 260px is `className="w-65"` away (a width class replaces the size, D78) and is recorded in §8.3. `separator` defaults to `true`, so an inline NavDrawer draws the inner edge Nav draws (`border-e`) on the same background (Drawer and Fluent default to `false`; Fluent tints the pane). `modalType?: Extract<ModalType, 'modal' | 'non-modal'>`; an `'alert'` passed at run time (a cast) is treated as `'modal'` (a navigation pane is never an alert). *Why:* each default matches what a navigation pane needs or what Nav already looks like; `'alert'` would make the pane an `alertdialog` that a backdrop press cannot close. The size is open question Q-NAV3 (§8).
- **D127 — Open state and reasons.** `open`/`defaultOpen` (`@default false`)/`onOpenChange(open, details?)` through `useModalOpenState`, typed with `DrawerOpenChangeDetails`. Reasons: `trigger` (a Hamburger inside the drawer, both types, D133), `escape` and `outside-press` (overlay, from the shell's layer; `outside-press` only for `modal`). No `close-button` or `close` (no built-in Close button and no Close part, D139). A controlled drawer stays as it is until `open` changes. An uncontrolled NavDrawer that is closed (at mount, or after its inner Hamburger closed it) can never open again, because a Hamburger inside it is not shown while it is closed: an effect warns once (`NavDrawer:unreachable`). *Why:* C-NAMING; the Drawer's reasons; the dead end is the most likely mistake of an uncontrolled app shell.
- **D128 — Parts render in the order written; Body and Footer render lists.** NavDrawer renders its children inside the `<nav>`, in written order (no scan, no routing: there is no built-in header to replace). `NavDrawer.Header` is a `<div>` row (`flex shrink-0 items-center gap-2 ps-2.5 pe-2 py-2`), `NavDrawer.Body` a scrolling `<div>` (`min-h-0 flex-1 overflow-y-auto py-2`) around a `<ul>`, `NavDrawer.Footer` a `<div>` (`shrink-0 py-2`) around a `<ul>`; both lists run `useNavListChildCheck` (`'NavDrawer.Body'` / `'NavDrawer.Footer'`, `'items'`; memo C27). After every commit of the root an effect (development only) finds the first `<li>` inside the `<nav>` whose parent is not a `<ul>` or `<ol>` (a Nav part in the Header, or written directly in NavDrawer) and warns once (`NavDrawer:loose-items`). Header, Body and Footer are `<div>`s, not `<header>`/`<footer>` (D76's rule; inside a `<nav>` they would map to nothing anyway). The Header's `ps-2.5` puts a medium Hamburger's 20px glyph (centred in its 32px box) in the items' icon column (items `px-4`: 16px − 6px = 10px). *Why:* Fluent renders the parts in order too; the lists keep `nav-5`'s rule in a NavDrawer; a DOM check sees a stray `<li>` that a consumer component renders; an `<li>` outside a list fails axe `listitem` (verified).
- **D129 — Scroll-state separators from the overlays' scroll store.** The root holds the first mounted Body's element in state (the Body registers it from a callback ref) and reads `useScrollState(bodyElement)` (`Drawer.scroll.ts`, contract §4); the Header, the Body and the Footer render the enumerated `data-scroll-state` (`none`, `top`, `middle`, `bottom`; `none` on the server and without a Body), and the Header and the Footer carry `scrollSeparatorClasses.header` / `.footer` (D80: a line under the header while the body is scrolled away from its top, over the footer while more is below; always in forced colours). The state reaches the parts through a separate context, so a change re-renders the three parts and not the Nav items. *Why:* Fluent's NavDrawerHeader and NavDrawerFooter are DrawerHeader and DrawerFooter, whose separators follow the body's scroll; one store for both drawers (contract §4.2, offered for reuse).
- **D130 — `NavDrawer.Body focusMode`: `'tab'` by default; `'arrow'` makes the body one Tab stop.** `focusMode?: FocusMode` (`'tab' | 'arrow'`, the foundation's shared type, also SwatchPicker's), rendered as the enumerated `data-focus-mode` on the body before `{...rest}`. `'tab'`: no roving container; every enabled entry is a Tab stop and the arrow keys do nothing (Nav's model). `'arrow'`: the body element is a roving container — `useRovingTabIndex({ itemSelector: TOOLBAR_ITEM_SELECTOR, manageTabIndex: true, tabStop: 'last-focused', orientation: 'both', loop: true, homeEndKeys: true, typeahead: false, activeValue })`, with `containerProps` spread only in this mode (the hook always runs, C-HOOKS; SwatchPicker's precedent) and the consumer's `onKeyDown` first and `onFocus` composed with `checkDefaultPrevented: false` (Toolbar's composition). The body provides `NavRovingContext` (D113) with a memoised `reportCurrentCategory` that keeps, in state, the closed category that holds the current page (`setState((previous) => holds ? category : previous === category ? null : previous)`), and passes `activeValue = currentCategory !== null ? 'wave-nav-category:' + currentCategory : nav.value || null` (the categories report from layout effects, so the corrected stop is stamped before the first paint). Every focusable element in the body joins the order in DOM order: entries, category toggles, open sub-items, `Nav.AppItem`, item actions and your own controls. Down and Right (Left in RTL) move to the next, Up and Left (Right in RTL) to the previous, wrapping; Home and End go to the first and last; no typeahead. The Tab stop is the last focused element, at first the current page (or the closed category that holds it, D113), else the first enabled element. Disabled entries are skipped (natively disabled buttons; a disabled link has no `href`, so the selector misses it); a `disabledFocusable` control stays reachable; keys typed in a text field, and keys from a portal opened inside the body, are left alone (the hook's rules). The Footer is never an arrow group: its items stay Tab stops. *Why:* `nav-3`; a `<nav>` is no composite role, so screen readers announce no arrow keys and a disclosure navigation's model is Tab (APG), hence the default; APG composites put the Tab stop on the selected item, and a nav's "you are here" is where Tab should land (Fluent starts at the first item); one linear order through rows and their actions is Fluent's Mover order (`useArrowNavigationGroup`), and the horizontal pair keeps the order moving from a control that uses Up and Down itself (a MenuButton action opens its Menu with them, `Menu.trigger.tsx:188-192`); APG's disclosure navigation example takes both pairs; the selector is Toolbar's (`Toolbar.navigation.ts`, the one item rule). Open question Q-NAV1 (§8).
- **D131 — Switching `focusMode` while mounted hands the items back.** From `'arrow'` to `'tab'` the body stops attaching the container, and the foundation's `useRovingTabIndex` hand-back fix (memo C28) restores every stamped element's own `tabindex` and removes the `data-roving-value` the hook added; React removes the values it rendered (D113). *Why:* a responsive app may tie `focusMode` to `type`; without the fix every item but one would keep `tabindex="-1"` (research §2.9); a remount instead would drop focus to `<body>` (C-DISABLED).
- **D132 — `Hamburger` is a Button variant with the navigation glyph and a default name.** `<Button appearance={appearance} size={size} icon={withPartClass(glyph, hamburgerClassNames.icon)} className={cn(hamburgerClassNames.root, className)} …>`: `appearance` defaults to `'subtle'` (neutral glyph, hover fill: Fluent's look; WaveUI's `transparent` is the link-coloured, underlined look), `size` to `'medium'`; not polymorphic (MenuButton's and ToggleButton's precedent). The default glyph is the foundation's `NavigationIcon` at 12, 16, 20, 24 or 28px for `extra-small` … `extra-large`. `icon` is a **required indicator** (C-SLOTS, Phase 1 D21): `null`, `undefined` and a value that renders nothing keep the default glyph, and a value that renders nothing warns once (`Hamburger:icon-empty`); a `<button>`/`Button` element, or a slot object whose `as` is one, is unwrapped through `unwrapButtonGlyph` with a one-time warning (`Hamburger:icon-button`; an unwrapped button whose children render nothing keeps the default and reports only that warning, SplitButton's rule). Without `aria-label`, `aria-labelledby` or `title` and without children that render content, it is named `'Navigation'` (an `aria-label` the Hamburger sets after the props; a Tooltip with `relationship="label"` passes `aria-labelledby`, so its name wins); `Button:icon-only-name` never fires for it. The name never changes with the state (APG: a toggle's name is stable; the state is `aria-expanded`). *Why:* Fluent's Hamburger is a Button with the `Navigation20Filled` glyph (`useHamburger.tsx`), but unnamed, and its docs ask apps to name it: a default name prevents the most common failure (`button-name`); "Navigation" matches the landmark it opens; the InfoButton ("Information") and EmptySwatch ("Add color") precedents for a default `aria-label` (C-NAMING). Open question Q-NAV4 (§8).
- **D133 — Inside a NavDrawer the Hamburger toggles it; outside it is a plain button.** The Hamburger reads `NavDrawerContext` (optional, `React.useContext`, no C-CONTEXT error). Inside (its Header, or anywhere in its tree): `aria-expanded={open}`, `aria-controls={panelId}` (the panel exists: the Hamburger is in it) and no `aria-haspopup` (it is inside the surface); a click calls `requestOpen(!open, { reason: 'trigger', event: event.nativeEvent })` after the consumer's `onClick` (`composeEventHandlers`: `preventDefault()` skips the toggle); these state attributes come after the props and win over a consumer's (the modal triggers' rule, `Dialog.shared.tsx:429-436`). With `disabled` or `disabledFocusable` Button never calls the handler, so nothing toggles. Outside: no state ARIA unless passed; the README recipe and the App shell story wire `aria-expanded`, `aria-controls` (only while the panel is rendered, or always with `unmountOnClose={false}`) and, for an overlay, `aria-haspopup="dialog"`. *Why:* an app shell's main hamburger sits in the page header, outside the drawer's tree, where no context reaches it (WaveUI's precedent for a far toggle is explicit ARIA, `stories/Popover.stories.tsx:215-232`); inside, the only meaning is the toggle, and wiring it saves the step Fluent's docs ask for by hand; a `NavDrawer.Trigger` part would render the button next to the panel, not in the page header. A public helper that returns matching outer-Hamburger and NavDrawer props goes to the backlog (§8.2).
- **D134 — Focus follows the shell, and `finalFocusRef` names the outer Hamburger.** Overlay `modal`: opening moves focus to the first focusable element of the panel (the Header's Hamburger, else the Body's Tab stop), Tab is trapped, and closing returns focus to `finalFocusRef`, else the element that had focus when it opened (the outer Hamburger: `inertModalTrigger` makes the layer capture it), else a neighbour. Overlay `non-modal`: focus moves in on open, Tab and Shift+Tab leave it in the page's order after its opener, Escape closes it only from inside, and focus returns only from inside (D87, D91, D92). Inline: opening moves no focus; closing while focus is inside (the inner Hamburger, an item) returns focus to `finalFocusRef`, else the element that opened it, else a neighbour (D101). The docs and the App shell pass the outer Hamburger as `finalFocusRef`, so an inner Hamburger that closes the drawer hands focus to the one that can open it again, also for an inline drawer that was open from the server (no opener). *Why:* NavDrawer adds no focus logic of its own; the shell's rules are the Drawer's.
- **D135 — Server rendering, hydration and a `type` switch.** Inline: the panel, the `<nav>`, the parts, the current category open (D112's scan) and `aria-current` are in the server HTML; an inner Hamburger renders `aria-expanded="true"` and `aria-controls` with the panel's id (no dangling reference); hydration calls no `onOpenChange`. An arrow body's server HTML has the React-rendered `data-roving-value`s and `data-roving-container`, and no `tabindex` stamps until its effects run (Toolbar's behaviour; no mismatch). Overlay: nothing in the server HTML; an open one opens after hydration. A `type` change remounts the panel and its content (D105) and keeps the selection and the open categories (they live in the root, D112); the body's last-focused Tab stop starts again at the current page. Parts and Nav items written in a Server Component render the same HTML: NavDrawer classifies none of its parts, and the scan recognises items by marker (D111). *Why:* C-POPUPS (content needed on the server renders inline); the roadmap's acceptance; the responsive app shell.
- **D136 — Modules, folder and bundles.** `src/components/navigation/NavDrawer.tsx` holds `NavDrawerRoot` (no docblock), `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`, the compound (`Object.assign`, its JSDoc) and the flat names; `NavDrawer.context.ts` holds `NavDrawerContext` (`{ open, requestOpen, panelId, type }`, default `null`) and `NavDrawerLayoutContext` (`{ scrollState, registerBody }`, default `null`) and imports no runtime module but React (types only from `Dialog.shared` and `Drawer.context`); `Hamburger.tsx` imports `NavDrawer.context.ts`, never `NavDrawer.tsx`. NavDrawer imports `Nav.root.tsx` and `Nav.context.ts`, never `Nav.tsx`; Nav never imports NavDrawer. Both live in the `navigation` folder (Fluent's `react-nav`). *Why:* an import of only `Hamburger` must hold no modal machinery, an import of only `Nav` no drawer code, and an import of only `NavDrawer` neither Drawer's root nor Nav's compound (verify-dist probes, §6.2).
- **D137 — NavDrawer is a Drawer variant; its parts are its own; Hamburger is a Button variant.** The panel carries `wave-drawer wave-nav-drawer` (Phase 3 D5; `VARIANT_BASES` `navDrawerClassNames: ['drawerClassNames']`), the overlay backdrop `wave-drawer__backdrop wave-nav-drawer__backdrop`, the `<nav>` `wave-nav-drawer__nav` (not `wave-nav`: it is no Nav root, and `.wave-nav` sizes a 240px pane); Header, Body and Footer carry only `wave-nav-drawer-header`, `wave-nav-drawer-body` (`__list` on its `<ul>`) and `wave-nav-drawer-footer` (`__list`), not Drawer's part classes (they are not built on Drawer's header, body or footer, and `.wave-drawer__body`'s consumer rules must not hit a nav). Hamburger: `wave-button wave-hamburger` on the `<button>` (`VARIANT_BASES` `hamburgerClassNames: ['buttonClassNames']`), `wave-button__icon wave-hamburger__icon` on the icon span (`withPartClass`). *Why:* Phase 3 D3/D5 (variants carry their base classes); consumer CSS for drawers reaches a NavDrawer's panel, and nothing else.
- **D138 — The "App shell" story is the phase's exit criterion.** `stories/NavDrawer.stories.tsx` › **AppShell**: a bordered frame (`flex h-150 flex-col overflow-hidden rounded-md border border-border bg-background text-foreground`) with a `Toolbar aria-label="App"` (the outer Hamburger with the recipe's ARIA and a `ref`, the app's name, a "Details" `Toolbar.Button` with `aria-expanded`/`aria-controls`), and below it a row (`flex min-h-0 flex-1`) of a `NavDrawer` (`aria-label="Main"`, `finalFocusRef` = the outer Hamburger), a content `<div>` (not a `<main>`: the docs page has one) and a `Drawer` with `position="end"`, `separator`, `title="Details"`. A story-local SSR-safe media hook (`useSyncExternalStore` on `matchMedia('(max-width: 767px)')`, server snapshot `false`) picks the types: narrow → both overlays, wide → both inline. The open states follow the breakpoint through a previous-value state (C-HOOKS: adjusted during render): becoming wide opens the navigation and closes the details, becoming narrow closes both, so a resize never turns an open inline pane into a page-blocking modal. In the overlay type, selecting an item closes the navigation (`onValueChange`), and the Header shows an inner Hamburger (only then: an inline pane would show two). *Why:* the roadmap's exit criterion (NavDrawer + inline Drawer + Toolbar, responsive from overlay to inline); the server default is the wide layout, so the server HTML holds the inline navigation and the switch happens after hydration; jsdom's `matchMedia` stub matches nothing (`src/test-setup.ts`), so the stories gate audits the wide, inline layout, and `NavDrawer.appShell.test.tsx` drives the narrow one through `mockMatchMedia`.
- **D139 — What NavDrawer does not take.** No `title`, `titleAction`, `closeLabel`, `closeButton`, built-in Close button, Trigger or Close part, or `closeOnSelect` (the app closes an overlay in `onValueChange`, as the story does); Nav's deprecated aliases are absent (a new component). It forwards Drawer's `backdrop` slot to the shell (`modal` overlays; elsewhere the shell's `NavDrawer:backdrop-ignored` warning). Density (`nav-1`), single-open categories (`nav-2`) and callback details (`nav-4`) stay in the backlog for Nav and NavDrawer alike. *Why:* the Header's Hamburger is the close control (APG wants one in the Tab sequence: the trap's first stop is it); a navigation pane needs no title; scope (roadmap §8.2).

#### API

```ts
// src/lib/types.ts (F6-foundation)
/**
 * How the keyboard reaches the items of a set: `'tab'`, every item is a Tab stop and the arrow
 * keys do nothing; `'arrow'`, the set is one Tab stop and the arrow keys move between its items.
 */
export type FocusMode = 'tab' | 'arrow';

// src/components/navigation/NavDrawer.tsx
/** Properties for the NavDrawer component. */
export interface NavDrawerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'>,
    Pick<
      NavProps,
      | 'value'
      | 'defaultValue'
      | 'onValueChange'
      | 'openCategories'
      | 'defaultOpenCategories'
      | 'onOpenCategoriesChange'
      | 'currentCategory'
    > {
  /**
   * How the drawer sits on the page (Fluent's `type`).
   * - `overlay`: a panel over the page, rendered in a portal while open (in the browser only: an
   *   open overlay is closed in the server HTML and opens once hydrated). Modal by default: focus
   *   moves in and stays there, the rest of the page is `inert` and does not scroll, and Escape
   *   and a backdrop press close it. It is a dialog with the navigation's name.
   * - `inline`: a panel in the page layout, rendered where the NavDrawer is (also in the server
   *   HTML). The page stays usable around it; Escape and presses outside do nothing; opening it
   *   moves no focus, and closing it while focus is inside returns focus to `finalFocusRef`, else
   *   to the element that opened it.
   * Changing `type` remounts the panel; the selection and the open categories are kept.
   * @default 'overlay'
   */
  type?: DrawerType;
  /** Controlled open state. */
  open?: boolean;
  /** Open state for uncontrolled usage (keep it controlled: a closed uncontrolled NavDrawer cannot be opened again). @default false */
  defaultOpen?: boolean;
  /**
   * Called with the new open state when it changes, with `details.reason`: `trigger` (a Hamburger
   * inside the drawer), `escape` and `outside-press` (the backdrop; overlay only). `details` is
   * typed optional until 1.0. A controlled drawer stays as it is until you update `open`.
   */
  onOpenChange?: (open: boolean, details?: DrawerOpenChangeDetails) => void;
  /**
   * The edge the panel is attached to: an overlay's screen edge, an inline panel's inner edge is
   * the opposite one. `start`/`end` follow the text direction; `left`/`right` are physical sides;
   * `bottom` runs along the bottom edge. Unlike Drawer's (`end`), the default is the start edge,
   * where navigation sits (Fluent's). Rendered as `data-position`.
   * @default 'start'
   */
  position?: DrawerPosition;
  /**
   * The panel's width at a side (its height at the bottom), on Drawer's scale: `small` 320px,
   * `medium` 592px, `large` 940px, `full` the viewport (inline: the container). A width class in
   * `className` replaces it (`className="w-65"` gives Fluent's 260px navigation width). Rendered
   * as `data-size`.
   * @default 'small'
   */
  size?: DrawerSize;
  /**
   * Inline drawers: draws a line on the panel's inner edge (`data-separator`), as Nav does. An
   * overlay always draws that edge; forced colours always draw it.
   * @default true
   */
  separator?: boolean;
  /**
   * Overlay drawers: `modal` (backdrop, focus trapped, page inert and not scrolling) or
   * `non-modal` (no backdrop, no trap, nothing inert; Escape closes it while focus is inside, and
   * its Tab place follows the element that opened it). Ignored by inline drawers. Rendered as
   * `data-modal-type` on an overlay's panel. Fluent's `modalType` (without `alert`).
   * @default 'modal'
   */
  modalType?: Extract<ModalType, 'modal' | 'non-modal'>;
  /**
   * Removes the panel when the drawer closes. `false` keeps it mounted while closed, out of view
   * and `inert`, so its scroll position and the state of what is inside survive, and a Hamburger
   * outside can always point `aria-controls` at it. Fluent's `unmountOnClose`.
   * @default true
   */
  unmountOnClose?: boolean;
  /**
   * Where focus goes when the drawer closes with focus inside it (a modal overlay: whenever it
   * closes). Pass your page's Hamburger, so a Hamburger inside the drawer that closes it hands
   * focus to the one that opens it again.
   */
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** The backdrop of a modal overlay (Drawer's `backdrop` slot: `null` renders none, `appearance` picks the fill). */
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /**
   * Name of the navigation landmark (and of an overlay's dialog). Localize it; rename it when the
   * page has another navigation landmark (two with one name are ambiguous). An `aria-labelledby`
   * replaces the default.
   * @default 'Navigation'
   */
  'aria-label'?: string;
  /** `NavDrawer.Header`, `NavDrawer.Body` and `NavDrawer.Footer`, rendered in the order written. */
  children?: React.ReactNode;
  /** Ref to the panel: the `role="dialog"` element of an overlay drawer, the panel element of an inline one. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerHeader sub-component. */
export interface NavDrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A Hamburger, the app's name, …: any content (Nav items go in the body or the footer). */
  children?: React.ReactNode;
  /** Ref to the header element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerBody sub-component. */
export interface NavDrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * How the keyboard reaches the items. `'tab'`: every item is a Tab stop and the arrow keys do
   * nothing (Nav's model). `'arrow'`: the body is one Tab stop, the last focused element (at first
   * the current page, or the closed category that holds it, else the first item); Down and Right
   * move to the next element and Up and Left to the previous one (Left and Right swap in a
   * right-to-left layout), wrapping, and Home and End go to the ends. Every focusable element in
   * the body joins the order, item actions included. Screen readers do not announce arrow keys in
   * a navigation landmark: prefer `'tab'` unless your users expect an app pane. Rendered as
   * `data-focus-mode`. Fluent's NavDrawer uses arrow keys by default (`tabbable` adds Tab stops).
   * @default 'tab'
   */
  focusMode?: FocusMode;
  /** Nav parts: `Nav.Item`, `Nav.Category`, `Nav.SectionHeader`, … (each renders its own list item). */
  children?: React.ReactNode;
  /** Ref to the scrolling body element. */
  ref?: React.Ref<HTMLDivElement>;
}

/** Properties for the NavDrawerFooter sub-component. */
export interface NavDrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nav parts pinned below the body (Settings, Help); wrap other content in an `<li>`. */
  children?: React.ReactNode;
  /** Ref to the footer element. */
  ref?: React.Ref<HTMLDivElement>;
}

export const NavDrawer = /* @__PURE__ */ Object.assign(NavDrawerRoot, {
  Header: NavDrawerHeader,
  Body: NavDrawerBody,
  Footer: NavDrawerFooter,
});
export { NavDrawerHeader, NavDrawerBody, NavDrawerFooter };

// src/components/navigation/Hamburger.tsx
/** Properties for the Hamburger component. */
export interface HamburgerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Fluent's `transparent` look is WaveUI's `subtle` (WaveUI's `transparent` is link-coloured). @default 'subtle' */
  appearance?: Appearance;
  /** Size: the button's height and the glyph (12, 16, 20, 24 or 28px). @default 'medium' */
  size?: Size;
  /**
   * Replaces the navigation glyph (three bars). Decorative (`aria-hidden`). Unlike Button's `icon`,
   * a Hamburger always shows a glyph: `null`, `undefined` and a value that renders nothing keep
   * the default (the last warns in development). A `<button>` or `Button` passed here is not
   * nested: its children become the glyph and its props are dropped, with a warning.
   */
  icon?: Slot<'span'>;
  /**
   * The button's name. Without `aria-label`, `aria-labelledby`, `title` or a visible label
   * (children), the Hamburger is named "Navigation"; localize it here.
   * @default 'Navigation'
   */
  'aria-label'?: string;
  /** Unavailable but focusable (see `Button.disabledFocusable`): no toggle, no `onClick`. @default false */
  disabledFocusable?: boolean;
  /** Ref to the `<button>`. */
  ref?: React.Ref<HTMLButtonElement>;
}
```

Component JSDoc (C-DOCS). `NavDrawer` (on the export only; names no internal symbol): bullets **Composition** (`NavDrawer.Header`, `.Body`, `.Footer` in the order written; Nav parts inside Body and Footer, which render the lists; anything else in an `<li>`); **Types** (`overlay`/`inline`, the remount on a change, state kept); **Opening and closing** (keep it controlled; a Hamburger inside toggles it; Escape and the backdrop close an overlay; `onOpenChange` reasons; closing an overlay on selection is yours, in `onValueChange`); **Focus** (`finalFocusRef`, the outer Hamburger); **Keyboard** (`NavDrawer.Body focusMode`); **Landmark** (one `<nav>`, default name "Navigation"; an overlay is also a dialog with that name); **Selection** (Nav's `value`/`onValueChange`, `openCategories`, `currentCategory`; Fluent's `selectedValue`/`onNavItemSelect`); **Server Components** (flat names `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`). `Hamburger`: "A button that opens and closes a navigation drawer: a `Button` (`subtle`, icon-only) with the navigation glyph, named "Navigation" by default. Inside a `NavDrawer` (in its header) it toggles that drawer and reports it with `aria-expanded` and `aria-controls`. Elsewhere (your page header) it is a plain button: pass `aria-expanded={open}`, `aria-controls` (while the drawer's panel is rendered) and, for an overlay drawer, `aria-haspopup="dialog"`, and toggle your state in `onClick`. Fluent's `Hamburger`."

#### Behaviour

**Keyboard.**

| Key | Where | Action |
|---|---|---|
| Tab / Shift+Tab | overlay `modal` | trapped in the panel: the Header's Hamburger, the body (its Tab stops, or its one stop), the footer's items |
| Tab / Shift+Tab | overlay `non-modal` | through it in the page's order, after the element that opened it |
| Tab / Shift+Tab | inline | through it as page content |
| Escape | overlay `modal` | closes (`escape`); focus → `finalFocusRef` → the opener → a neighbour |
| Escape | overlay `non-modal`, focus inside | closes (`escape`) |
| Escape | inline | nothing (a widget inside may use it) |
| Enter / Space | a Hamburger inside | toggles the drawer (`trigger`) |
| Enter / Space | entries, toggles | native activation (an item selects or navigates, a category toggles) |
| Down, Right (Left in RTL) | Body, `focusMode="arrow"` | next focusable element, wrapping |
| Up, Left (Right in RTL) | Body, `focusMode="arrow"` | previous focusable element, wrapping |
| Home / End | Body, `focusMode="arrow"` | first / last focusable element |
| arrows | Body, `focusMode="tab"`; Footer | nothing |

**Focus.** D134. Collapsing a category whose sub-item held the arrow body's Tab stop keeps focus on the toggle (Enter was pressed there) and the stop falls back to it.

**Pointer.** Items as Nav; a press on the backdrop closes a `modal` overlay (`outside-press`; a drag that starts inside the panel does not, the shell's rule); touch targets: the Hamburger 32px (medium), items 36px tall.

**ARIA.** Overlay: `role="dialog"` named like the `<nav>` inside it, no `aria-modal` (isolation by `inert`); inline: a role-less panel around the `<nav>`. Inside: Nav's ARIA unchanged. A Hamburger inside: `aria-expanded`, `aria-controls` = the panel id. An arrow body adds no role (a `<nav>` holds a list of links and buttons; the arrow keys are an extra).

**Announcements.** None (state is in `aria-expanded` and `aria-current`).

**SSR and hydration.** D135.

**RTL.** The shell's placement is logical (`start` is the right edge in RTL); the glyph is symmetric (no mirror); in the arrow mode Left moves to the next element and Right to the previous (`getArrowIntent`).

**Forced colours.** The overlay's inner edge and an inline panel's edge (with or without `separator`) are drawn (the shell); the Header and Footer separators are always drawn (D80); the selected item's start border stays; the Hamburger is Button (focus ring, `GrayText` while disabled).

**Reduced motion.** No motion ships (Phase 2 rule 15); presence phases end at once; Phase 10 (P10-01) animates NavDrawer.

**Toaster.** An open overlay NavDrawer is a modal (or `'dialog'`) layer the Toaster measures: toasts at its side move beside it (a `start` drawer moves `bottom-start`/`top-start` toasts); an inline one is page content and moves none (D84, the shell).

**Hamburger.**

| Key / input | Where | Action |
|---|---|---|
| Enter / Space / click | inside a NavDrawer | your `onClick`, then `onOpenChange(!open, { reason: 'trigger', event })` unless you called `preventDefault()` |
| Enter / Space / click | elsewhere | your `onClick` (native button) |
| any | `disabled` / `disabledFocusable` | nothing (Button's rules) |

**Development warnings** (from effects through `warnOnce`):

| Key | When | Message |
|---|---|---|
| `NavDrawer:unreachable` | uncontrolled (`open === undefined`) and closed | `` NavDrawer is closed and nothing can open it: it is uncontrolled (no `open` prop), and a Hamburger inside it cannot be reached while it is closed. Control it with `open` and `onOpenChange`, and open it from a Hamburger (or any button) outside it. `` |
| `NavDrawer:loose-items` | an `<li>` in the `<nav>` outside a `<ul>`/`<ol>` (D128) | `NavDrawer: a list item sits outside NavDrawer.Body and NavDrawer.Footer, the parts that render a list. Move Nav.Item, Nav.Category and the other Nav parts into NavDrawer.Body or NavDrawer.Footer.` |
| `NavDrawer.Body:list-child`, `NavDrawer.Footer:list-child` | D114 | `` NavDrawer.Body: its list holds a <div> element, but a list can hold only <li> elements. Use the Nav parts (Nav.Item, Nav.Category, Nav.SectionHeader, Nav.Divider, Nav.AppItem, Nav.AppItemStatic) as its children, or wrap your own content in an <li>. `` (Footer likewise) |
| `NavDrawer:duplicate-item:<value>`, `NavDrawer:duplicate-category:<value>` | D112 | `NavDrawer: several items share the value "<value>". Nav.Item and Nav.SubItem values must be unique within a NavDrawer; every item with the current value is marked as the current page.` / `NavDrawer: several categories share the value "<value>". Nav.Category values must be unique within a NavDrawer; they open and close together.` |
| `NavDrawer:backdrop-ignored`, `NavDrawer:open-inside` | the shell (D93, D106), with `componentName` | the shell's texts with `NavDrawer` |
| missing context | a part outside a NavDrawer | `[WaveUI] NavDrawer.Header must be used within NavDrawer` (`.Body`, `.Footer`), through `reportMissingContext`; production logs once and renders the part with the inert value |
| `Hamburger:icon-empty` | `icon` renders nothing (not an unwrapped button) | `` Hamburger: `icon` renders nothing, so the default navigation glyph shows. Unlike `Button`, a Hamburger always shows a glyph: pass an icon, or leave `icon` unset. `` |
| `Hamburger:icon-button` | a `<button>`/`Button`, or a slot object whose `as` is one, as `icon` | `` Hamburger: `icon` received ${button}; its children render as the glyph and its props were dropped (buttons cannot be nested). Pass icon content instead, e.g. `icon={<MyIcon />}`. `` (`${button}`: `unwrapButtonGlyph`'s `UnwrappedButton` text) |

`Drawer:unnamed` and `Button:icon-only-name` never fire for a NavDrawer or a default Hamburger.

#### DOM and classes

```
Inline, open (in place; also the server HTML):
<div id={panelId} data-type="inline" data-position="start" data-size="small" data-separator
     {...rest} data-presence="entered"
     class="wave-drawer wave-nav-drawer {the shell's inline classes} border-e w-80 {className}">
  <nav aria-label="Navigation" class="wave-nav-drawer__nav flex min-h-0 flex-1 flex-col">
    <div data-scroll-state="none" class="wave-nav-drawer-header flex shrink-0 items-center gap-2 ps-2.5 pe-2 py-2 {scrollSeparatorClasses.header}">
      <button type="button" aria-label="Navigation" aria-expanded="true" aria-controls={panelId}
              class="wave-button {Button subtle, icon-only medium} wave-hamburger">
        <span aria-hidden="true" class="wave-button__icon inline-flex shrink-0 items-center wave-hamburger__icon">
          <svg data-wave-icon="navigation" width="20" height="20" aria-hidden="true" focusable="false" …/>
        </span>
      </button>
      Contoso HR
    </div>
    <div data-focus-mode="tab" data-scroll-state="top" [data-roving-container]
         class="wave-nav-drawer-body min-h-0 flex-1 overflow-y-auto py-2">
      <ul class="wave-nav-drawer-body__list m-0 list-none p-0">…Nav parts (each an <li>)…</ul>
    </div>
    <div data-scroll-state="top" class="wave-nav-drawer-footer shrink-0 py-2 {scrollSeparatorClasses.footer}">
      <ul class="wave-nav-drawer-footer__list m-0 list-none p-0">…</ul>
    </div>
  </nav>
</div>

Overlay, open (browser only):
<Portal>
  <div aria-hidden="true" data-appearance="dimmed" data-presence="entered" class="wave-drawer__backdrop wave-nav-drawer__backdrop …"/>
  <div role="dialog" id={panelId} tabindex="-1" aria-label="Navigation" data-type="overlay" data-position="start"
       data-size="small" data-modal-type="modal" {...rest} data-presence="entered"
       class="wave-drawer wave-nav-drawer fixed flex flex-col … start-0 border-e w-80 {className}">
    <nav aria-label="Navigation" class="wave-nav-drawer__nav …">…the same parts…</nav>
  </div>
```

| Element | Attribute | Values | Notes |
|---|---|---|---|
| panel | `data-type`, `data-position`, `data-size`, `data-presence`; `data-modal-type` (overlay); `data-separator` (inline, boolean) | the shell's | NavDrawer adds none of its own on the panel |
| `NavDrawer.Body` | `data-focus-mode` | `tab`, `arrow` | new, enumerated, always rendered, before `{...rest}` |
| Header, Body, Footer | `data-scroll-state` | `none`, `top`, `middle`, `bottom` | enumerated, always rendered (D129), before `{...rest}` |
| entries and toggles in an arrow body | `data-roving-value` | D113 | roving bookkeeping, not a styling hook |
| Hamburger | Button's (`data-disabled`, `data-disabled-focusable`) | — | its state is `aria-expanded` (style it with `aria-expanded:`) |

Registry (`src/lib/classNames.ts`, landed by the foundation):

```ts
/**
 * NavDrawer (a Drawer variant: it also carries Drawer's root, and its backdrop Drawer's backdrop
 * class): `root` on the panel (the portaled `role="dialog"` element of an overlay drawer, the
 * panel element of an inline one); `backdrop` on the backdrop of a modal overlay; `nav` on the
 * navigation landmark that fills the panel.
 */
export const navDrawerClassNames = {
  root: 'wave-nav-drawer',
  backdrop: 'wave-nav-drawer__backdrop',
  nav: 'wave-nav-drawer__nav',
} as const;
/** NavDrawer.Header: `root` on the header row. */
export const navDrawerHeaderClassNames = { root: 'wave-nav-drawer-header' } as const;
/** NavDrawer.Body: `root` on the scrolling body; `list` on its list. */
export const navDrawerBodyClassNames = {
  root: 'wave-nav-drawer-body',
  list: 'wave-nav-drawer-body__list',
} as const;
/** NavDrawer.Footer: `root` on the footer; `list` on its list. */
export const navDrawerFooterClassNames = {
  root: 'wave-nav-drawer-footer',
  list: 'wave-nav-drawer-footer__list',
} as const;
/** Hamburger (a Button variant: it also carries Button's root and icon classes): `root` on the `<button>`; `icon` on the icon span. */
export const hamburgerClassNames = { root: 'wave-hamburger', icon: 'wave-hamburger__icon' } as const;
```

Tokens: none new and no contrast pair (`bg-background`, `text-foreground`, `border-border` (decorative), `bg-backdrop` and `shadow-64` from the shell; Hamburger is Button `subtle`). Fluent's tinted pane (`colorNeutralBackground4`) would need a token and pairs for every item state on it: not proposed (§8.3).

Icon (`src/lib/icons.tsx`, the foundation): `NavigationIcon` (`data-wave-icon="navigation"`, 20×20 view box, filled, three 1.5px bars with round ends; default size 20).

#### Built-in text

| Component | Prop | English default |
|---|---|---|
| `NavDrawer` | `aria-label` (the navigation landmark, and an overlay's dialog) | `Navigation` |
| `Hamburger` | `aria-label` (only while it has no other name) | `Navigation` |

No `labels` object (nothing else is spoken).

#### Tests

`src/components/navigation/__tests__/NavDrawer.test.tsx` (new):
1. `testSystemProps(NavDrawer, { expectedTag: 'div', displayName: 'NavDrawer', defaultProps: { type: 'inline', defaultOpen: true, children: <NavDrawer.Body><Nav.Item value="home">Home</Nav.Item></NavDrawer.Body> }, conflictingClass: { className: 'w-96', overrides: 'w-80' }, a11yVariants: [overlay open (`type: 'overlay'`), a non-modal overlay (`type: 'overlay', modalType: 'non-modal'`), an arrow body, `position: 'end'`, a closed category holding the current page, `size: 'medium'`] })`: ref, rest spread, the panel carries `wave-drawer wave-nav-drawer` (VARIANT_BASES), axe.
2. `testCompoundExposure(NavDrawer, ['Header', 'Body', 'Footer'])`; "exports every sub-component under its flat name (C-COMPOUND)"; `testSystemProps` for each part (`expectedTag: 'div'`, wrapper: an open inline NavDrawer; `conflictingClass` Header `{ className: 'ps-4', overrides: 'ps-2.5' }`, Body and Footer `{ className: 'py-4', overrides: 'py-2' }`); `testNoImplicitSubmit(NavDrawer, …)` with a Hamburger and a category inside a form.
3. DOM per type: inline `div > nav[aria-label=Navigation]` with the parts in written order, Body and Footer `<ul>`s whose children are all `LI`; overlay: `getByRole('dialog', { name: 'Navigation' })` containing `getByRole('navigation', { name: 'Navigation' })`, no `aria-modal`; the inline panel has no `aria-label`, `aria-labelledby` or role.
4. Naming: the default; `aria-label` renames the nav and the dialog; `aria-labelledby` pointing at a heading in the Header names both and drops the default `aria-label`; `aria-describedby` on both.
5. Nav through NavDrawer: selecting an item calls `onValueChange` once (StrictMode once), controlled `value`, `openCategories` controlled and uncontrolled, the current category opens initially through `NavDrawer.Body` (the scan through the parts) and stays closed with `defaultOpenCategories={[]}`, the closed-category mark and `currentCategory`, duplicate warnings with the `NavDrawer:` key and text (asserted exactly), disabled items never select; `// @ts-expect-error` for `selectedValue`.
6. Open state: controlled and uncontrolled; overlay `onOpenChange(false, { reason: 'escape', event })` and `'outside-press'` (backdrop), a drag from inside does not close; `modalType: 'non-modal'`: no backdrop, nothing inert, Escape from inside closes, from a page button does not; inline: Escape and an outside press call nothing; StrictMode once; an `'alert'` passed through a cast renders `role="dialog"` and `data-modal-type="modal"`.
7. Focus: an overlay opened from a page button focuses the Header's Hamburger; without a Header, the Body's Tab stop; Tab is trapped; Escape returns focus to the page button; `finalFocusRef` wins; inline: opening keeps focus where it is; the inner Hamburger closing it moves focus to `finalFocusRef`; a controlled close while focus is on a page element leaves it there.
8. Props: `position` default `data-position="start"` with the shell's logical start classes; `size` default `data-size="small"` and `w-80`, `size="medium"` → `w-148`; `separator` default (`data-separator` on an inline panel) and `separator={false}`; `unmountOnClose={false}` keeps a closed panel `hidden` and `inert` with its selection, and an outer `aria-controls` stays valid (`findDanglingIdRefs()` is `[]`); `backdrop={null}` renders no backdrop; `backdrop` on an inline drawer warns `NavDrawer:backdrop-ignored` (asserted).
9. `type` switch while open keeps `value` and the open categories; with focus inside, focus ends where D105 says (on the opener for overlay → inline; inside the overlay for inline → overlay); the test-setup overlay check passes.
10. SSR: inline open `renderToString` holds the `<nav>`, the open current category and `aria-current="page"`; with an inner Hamburger `findDanglingIdRefsInHtml(html)` is `[]`; `hydrateRoot` (container appended and removed in `try`/`finally`) logs nothing and calls no `onOpenChange`; overlay open: nothing in the server HTML, open after hydration.
11. RTL (`renderWithProviders(ui, { dir: 'rtl' })`): the panel's classes are logical (no physical class for `start`).
12. Context: `it.each` of Header, Body, Footer outside → `expectThrows(…, '[WaveUI] NavDrawer.<Part> must be used within NavDrawer')`; production (`vi.stubEnv`) logs each once (exact list) and renders.
13. Warnings: `NavDrawer:unreachable` exact text, once, at mount of an uncontrolled closed drawer and after an inner Hamburger closes an uncontrolled `defaultOpen` one; none for a controlled drawer; `NavDrawer:loose-items` for a `Nav.Item` in the Header and one written directly in NavDrawer (exact text, once); `NavDrawer.Body:list-child` for a `<div>` in the Body; nothing else logged.
14. Server Components: `asClientReference` of Header, Body, Footer and of the Nav items renders the same `renderToString` output and behaves the same (a click selects, the current category opens).
15. Scroll state (D129): stubbed `scrollHeight`/`clientHeight`/`scrollTop` on the body and `fireEvent.scroll` in `act` → `data-scroll-state` on Header, Body and Footer (`top`, `middle`, `bottom`); `none` without a Body and on the server; the separator classes on Header and Footer; a scroll-state change does not re-render a memoised Nav item (a `React.Profiler` count, as `Nav.test.tsx:1676`).
16. Toaster: an open overlay NavDrawer at the start edge moves `bottom-start` toasts beside it (stubbed panel rect; real `Toaster`), and an inline one moves none.

`src/components/navigation/__tests__/NavDrawer.body.test.tsx` (new, the keyboard):
17. `'tab'` (default): every enabled entry tabbable (`userEvent.tab()` through them), arrows move nothing, `data-focus-mode="tab"`, no `data-roving-container`, no `data-roving-value`.
18. `'arrow'`: one Tab stop, on the current page item; on the closed category that holds the current sub-item; on the first enabled element without a current page; Down/Right and Up/Left move and wrap; Home/End; disabled entries skipped; an item's actions and a `Nav.AppItem` join the order; a MenuButton action opens its Menu with Down and Right moves past it; a consumer `<button>` joins; keys typed in a SearchBox inside the body stay the field's; Enter on a category toggles it and keeps focus; the last focused element holds the stop after Tab out and Shift+Tab back; Footer items stay Tab stops; `data-focus-mode="arrow"`.
19. RTL arrow mode: Left moves to the next element, Right to the previous.
20. Switching `focusMode` from `'arrow'` to `'tab'` gives every item its Tab stop back (no `tabindex="-1"` left, no added `data-roving-value`) — depends on the foundation's hand-back fix (D131).
21. Collapsing a category whose sub-item held the stop: focus stays on the toggle, which then holds the stop. Opening the marked category with Enter: focus and the stop stay on the toggle, and Tab then leaves the body (the stable toggle value, D113).
22. SSR of an arrow body: `data-roving-value`s in the server HTML, no `tabindex`; hydration logs nothing; the stop is stamped after mount.
23. axe on an arrow body (overlay and inline).

`src/components/navigation/__tests__/Hamburger.test.tsx` (new):
24. `testSystemProps(Hamburger, { expectedTag: 'button', displayName: 'Hamburger', conflictingClass: { className: 'w-10', overrides: 'w-8' } })`: classes `wave-button wave-hamburger` in that order; the icon span has `buttonClassNames.icon` and `hamburgerClassNames.icon` (read from the constants); `testNoImplicitSubmit(Hamburger)`.
25. Name: default "Navigation"; `aria-label` wins; visible children → no `aria-label` (named by its text); `aria-labelledby` or `title` → no default; in a `Tooltip relationship="label"` named by the tooltip; no `Button:icon-only-name` warning in any case.
26. Look: `subtle` classes by default, `appearance` and `size` pass to Button; the default glyph `svg[data-wave-icon="navigation"]` at 12/16/20/24/28px per size.
27. `icon`: custom content replaces the glyph; `null` and `undefined` keep it; `''`, `[]`, `<></>` keep it and warn once (`Hamburger:icon-empty`, exact); a `Button` and a slot object `{ as: 'button' }` are unwrapped (no nested button) and warn once (`Hamburger:icon-button`, exact, with each `UnwrappedButton` text).
28. Outside a NavDrawer: no `aria-expanded`, `aria-controls` or `aria-haspopup` unless passed; passed ones render; `onClick` is called.
29. Inside a NavDrawer: `aria-expanded` follows `open`, `aria-controls` is the panel id; a click calls `onOpenChange(false, { reason: 'trigger', event })` once (StrictMode); the consumer's `onClick` runs first and `preventDefault()` keeps the drawer open; the drawer's state wins over a consumer `aria-expanded`/`aria-controls`; `disabled` and `disabledFocusable` never toggle; in an overlay, Enter on it closes the drawer and focus returns to the opener.

`src/components/navigation/__tests__/NavDrawer.appShell.test.tsx` (new; composes the `AppShell` story with `composeStories`, the `Pagination.test.tsx:5-6` precedent; uses the Drawer and Toolbar that wave B committed):
30. Wide (no media match): the inline navigation "Main" is open next to the content, the outer Hamburger has `aria-expanded="true"`, `aria-controls` = the panel id and no `aria-haspopup`; no dialog, nothing `inert`, `getTopmostLayer()` is `null`; the "Details" button opens the inline `complementary` "Details" and closes it again; axe.
31. The outer Hamburger closes and reopens the inline navigation; focus stays on it.
32. Narrow (`mockMatchMedia({ '(max-width: 767px)': true })` before the render): no navigation shown; the outer Hamburger has `aria-haspopup="dialog"` and `aria-expanded="false"`; a click opens `getByRole('dialog', { name: 'Main' })` with focus on the inner Hamburger and the page `inert`; Escape closes it and focus returns to the outer Hamburger; selecting an item closes it and focus returns to the outer Hamburger.
33. Resize: wide with focus on a navigation item → narrow (in `act`) closes the navigation, leaves no dialog and nothing `inert`, and focus lands on the outer Hamburger (`finalFocusRef`); narrow → wide opens the inline navigation; StrictMode renders the same.

`src/components/navigation/__tests__/stableClassNames.test.tsx` (P6-navdrawer adds in wave C): "NavDrawer: panel root (with Drawer's), backdrop, nav; header, body and footer with their lists; in both types and in the server HTML" and "Hamburger: root and icon (with Button's)", reading every constant.

Integration (INTEGRATION): the Server Component `ssrCase` "NavDrawer (inline, defaultOpen)" with lazy `Header`, `Body`, `Footer`, `Item`, `Category`, `SubItem` and a `Hamburger` (`serverText: 'data-type="inline"'`; `interact`: a click selects, the inner Hamburger closes it); "Toast over an overlay NavDrawer" (toasts reachable by Tab, announced, beside it); "a Menu opened from a Nav item action in an overlay NavDrawer" (Escape closes the Menu first with focus on its MenuButton, a second Escape closes the drawer; in an arrow body the actions are in the order); "a modal Dialog opened from an inline and from an overlay NavDrawer" (Escape levels, focus return); "a Hamburger in a Tooltip relationship=label inside a Toolbar" (named, one Tab stop).

#### Stories

`stories/NavDrawer.stories.tsx` (title `Components/Navigation/NavDrawer`; no meta docblock: NavDrawer is a compound; `args` defaults `type: 'inline'`, `defaultOpen: true`, `onOpenChange: fn()`, `onValueChange: fn()`; `argTypes` for `type`, `position`, `size`, `modalType`; glyphs drawn in the file; tokens only; module-path imports in wave C): **Default** (inline: Header with the app's name, Body with items, a category, a section header and a divider, Footer with Settings), **Overlay** (controlled, closed at first; a page Hamburger with the recipe's ARIA opens it, the inner one closes it; never open by default, since an open modal makes the docs page inert), **ArrowKeys** (`focusMode="arrow"`, items with actions), **EndPosition**, **KeepMounted** (`unmountOnClose={false}`, a long body whose scroll position survives), **NonModal** (`modalType="non-modal"`), **AppShell** (D138, the exit criterion; a story docblock says to narrow the canvas below 768px, or use Storybook's viewport toolbar, to see the overlay). The AppShell render function forwards `args` to the NavDrawer and composes `args.onOpenChange` and `args.onValueChange` with its own state updates.

`stories/Hamburger.stories.tsx` (title `Components/Navigation/Hamburger`): **Default** (toggles a region with `aria-expanded`/`aria-controls`), **Sizes**, **CustomIcon**, **InNavDrawer**.


---

## 3. Packages and file ownership

### 3.1 Files

Tests and stories of a module belong to its package. INTEGRATION owns every file while it runs (wave D), DOCS the documentation files (wave E), the lead every file in wave F. `__tests__/` is the folder next to the module; component paths are under `src/components/`.

| Package (wave) | Files (edit) | New files | Items |
|---|---|---|---|
| `F6-foundation` (A) | `src/lib/types.ts`, `src/lib/__tests__/types.test.ts`; `src/lib/layers.ts`, `src/lib/__tests__/layers.test.ts`; `src/hooks/useDismiss.ts`, `src/hooks/__tests__/useDismiss.test.tsx`; `src/lib/classNames.ts`; `src/__tests__/classNames.test.ts` (`PENDING_CLASS_NAMES` only); `src/test-utils.ts` (`VARIANT_BASES` only), `src/__tests__/test-utils.test.tsx`; `src/styles/tokens.css`, `src/styles/__tests__/tokens.test.ts`; `src/lib/icons.tsx`, `src/lib/__tests__/icons.test.tsx`; `button/Toolbar.tsx` (the extraction only); `src/hooks/useRovingTabIndex.ts`, `src/hooks/__tests__/useRovingTabIndex.test.tsx`; `data-display/Avatar.tsx`, `data-display/__tests__/Avatar.test.tsx`; `input/Option.tsx`, `input/__tests__/Option.test.tsx`; `input/index.ts` (the `ListboxSurfaceListProps` export only); `input/Combobox.expand.tsx`; `input/SwatchPicker.tsx` and `input/SwatchPicker.context.ts` (the `FocusMode` retype only); `layout/Accordion.tsx` (the alias only); `overlays/__tests__/Dialog.test.tsx` (`:2145-2147` only); `src/__tests__/public-types.test.ts` (the `ModalType` lines, `ListboxSurfaceListProps`, `PENDING_PUBLIC_TYPES`); `src/__tests__/integration.test.tsx` (`PENDING_FLAT_MEMBERS` only); `scripts/verify-dist.mjs` (`PENDING_FLAT_EXPORTS` and its JSDoc only), `scripts/__tests__/verify-dist.test.mjs` (the bridge case only) | `button/Toolbar.navigation.ts`, `data-display/Avatar.context.ts`, `input/__tests__/Combobox.expand.test.tsx` | shared parts of P6-01 … P6-09 |
| `P6-tags` (B) | `data-display/Tag.tsx`, `data-display/__tests__/Tag.test.tsx`, `data-display/__tests__/stableClassNames.test.tsx` (its Tag, TagGroup and InteractionTag cases), `stories/Tag.stories.tsx` | `data-display/tagStyles.ts`, `data-display/TagGroup.context.ts`, `data-display/TagGroup.tsx`, `data-display/InteractionTag.tsx`, `data-display/__tests__/TagGroup.test.tsx`, `data-display/__tests__/InteractionTag.test.tsx`, `data-display/__tests__/tagStyles.test.ts`, `stories/TagGroup.stories.tsx`, `stories/InteractionTag.stories.tsx` | P6-01, P6-02, P6-03 |
| `P6-overlays` (B) | `overlays/Drawer.tsx` (becomes the compound module), `overlays/Dialog.tsx`, `overlays/Dialog.shared.tsx`; `src/hooks/useModalLayer.ts`, `src/hooks/useRestoreFocus.ts`, `src/hooks/useFocusTrap.ts`; `feedback/Toaster.tsx` (`getPanelOffsets`, the position classes, the region `ResizeObserver`, the kind filter and its JSDoc bullet only); `overlays/__tests__/Drawer.test.tsx`, `overlays/__tests__/Dialog.test.tsx`, `overlays/__tests__/stableClassNames.test.tsx`; `src/hooks/__tests__/useModalLayer.test.tsx`, `useRestoreFocus.test.tsx`, `useFocusTrap.test.tsx`; `feedback/__tests__/Toast.test.tsx` (the suite "Toaster: beside an open modal side panel" only); `stories/Drawer.stories.tsx`, `stories/Dialog.stories.tsx`; `scripts/verify-dist.mjs` (the commented `'Drawer'` line only, rule 29); `src/__tests__/integration.test.tsx` (the backdrop lookups `:2504` and `:2606` only, in the P6-06 task) | `overlays/Drawer.context.ts`, `Drawer.root.tsx`, `Drawer.parts.tsx`, `Drawer.panel.tsx`, `Drawer.scroll.ts`, `Dialog.slots.tsx`; `overlays/__tests__/Drawer.parts.test.tsx`, `Drawer.scroll.test.tsx`, `Drawer.modalType.test.tsx`, `Drawer.inline.test.tsx`, `Drawer.keepMounted.test.tsx`, `Drawer.panel.test.tsx`, `Dialog.nonModal.test.tsx`, `Dialog.slots.test.tsx`, `Dialog.keepMounted.test.tsx` | P6-05, P6-06, P6-07 |
| `P6-nav` (B) | `navigation/Nav.tsx`, `navigation/__tests__/Nav.test.tsx`, `navigation/__tests__/stableClassNames.test.tsx` (a "Nav parts" case), `stories/Nav.stories.tsx`; `src/__tests__/public-types.test.ts` (the `INTERNAL_HELPERS` key `Nav.tsx#NoAnchorOnlyAttributes` → `Nav.context.ts#NoAnchorOnlyAttributes` only, first task); `.storybook/__tests__/exportDocblocks.test.ts` (the row `['src/components/navigation/Nav.parts.tsx', ['NavAppItem']]` only, `Nav.AppItem` task); `scripts/verify-dist.mjs` (the commented `'Nav'` line only, rule 29) | `navigation/Nav.context.ts`, `Nav.root.tsx`, `Nav.parts.tsx`; `navigation/__tests__/Nav.parts.test.tsx`, `Nav.actions.test.tsx`, `Nav.listChild.test.tsx` | P6-09 |
| `P6-tagpicker` (C) | `input/TagPicker.tsx` (becomes the compound module), `input/__tests__/TagPicker.test.tsx`, `input/__tests__/stableClassNames.test.tsx` (its TagPicker cases only), `stories/TagPicker.stories.tsx` | `input/TagPicker.root.tsx`, `TagPicker.context.ts`, `TagPicker.parts.tsx`, `TagPicker.option.tsx`, `TagPicker.overflow.ts`, `TagPicker.create.ts`; `input/__tests__/TagPicker.parts.test.tsx`, `TagPicker.option.test.tsx`, `TagPicker.freeTagging.test.tsx`, `TagPicker.create.test.ts`, `TagPicker.overflow.test.tsx` | P6-04 |
| `P6-navdrawer` (C) | `navigation/__tests__/stableClassNames.test.tsx` (its NavDrawer and Hamburger cases) | `navigation/NavDrawer.tsx`, `NavDrawer.context.ts`, `Hamburger.tsx`; `navigation/__tests__/NavDrawer.test.tsx`, `NavDrawer.body.test.tsx`, `NavDrawer.appShell.test.tsx`, `Hamburger.test.tsx`; `stories/NavDrawer.stories.tsx` (with **AppShell**), `stories/Hamburger.stories.tsx` | P6-08 |
| `INTEGRATION` (D) | `data-display/index.ts`, `input/index.ts`, `overlays/index.ts`, `navigation/index.ts`; `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/classNames.test.ts` (empty the list); `scripts/verify-dist.mjs`, `scripts/__tests__/verify-dist.test.mjs` (bridge, probes, `REQUIRED_DECLARATIONS`, fixtures); `.storybook/__tests__/exportDocblocks.test.ts` ("finds the compounds" gains `InteractionTag`, `NavDrawer`, `TagPicker`); the story imports of rule 30; the wave-B and wave-C tests and stories a seam breaks | — | seams |
| `DOCS` (E) | `CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/WAVE-UI-GUIDE.md`, `docs/testing-best-practices.md`, `docs/ROADMAP.md`, `docs/FLUENT-UI-COMPARISON.md`, `docs/research/fluent-ui-v9-comparison.md` (missing ids only) | — | docs |

**Disjointness.**
- *Wave B* (`P6-tags`, `P6-overlays`, `P6-nav`): one shared file, `scripts/verify-dist.mjs`, edited by `P6-overlays` and `P6-nav` on two distinct pre-placed lines (rule 29, D10); the three `stableClassNames.test.tsx` files are per folder (data-display, overlays, navigation); `integration.test.tsx` is `P6-overlays`' alone, `public-types.test.ts` and `exportDocblocks.test.ts` `P6-nav`'s alone. Otherwise disjoint.
- *Wave C* (`P6-tagpicker`, `P6-navdrawer`): disjoint (`input/__tests__/stableClassNames.test.tsx` and `navigation/__tests__/stableClassNames.test.tsx` are different files).
- *Across waves B and C* (D2 lets a wave-C package run next to a wave-B one): `P6-tagpicker` next to `P6-nav` or `P6-overlays` shares no file; `P6-navdrawer` starts after `P6-nav` and `P6-overlays` and runs at most next to `P6-tagpicker`. `P6-nav` and `P6-navdrawer` both edit `navigation/__tests__/stableClassNames.test.tsx`, one after the other.

**Read only in waves B and C:** everything wave A lands (`src/lib/types.ts`, `layers.ts`, `classNames.ts`, `icons.tsx`, `useDismiss.ts`, `useRovingTabIndex.ts`, `Toolbar.navigation.ts`, `Toolbar.tsx`, `Avatar.tsx`, `Avatar.context.ts`, `Option.tsx`, `Combobox.expand.tsx`, `tokens.css`, `src/test-utils.ts`); `src/hooks/usePresence.ts`, `usePreserveFocus.ts`, `useModalIsolation.ts`, `useScrollLock.ts`, `useTriggerElement.ts`, `useListbox.ts`, `useFormReset.ts`, `useControllable.ts`; `motion/Presence.tsx`, `portal/Portal.tsx`, `overlays/Popover.shared.tsx`; `button/Button.tsx`, `Button.slots.tsx`; `input/pickerStyles.ts`, `pickerLabels.ts`, `pickerValues.ts`, `inputLook.ts`, `routedHandlers.ts`; `internal/HiddenInput.tsx`; `src/lib/{slot,children,labelInName,focus,events,dev,styles,aria,direction}.ts`; `src/test-utils-field.tsx`, `src/test-setup.ts`; `stories/_helpers.ts`, `stories/_grids.tsx`, `.storybook/*`. In wave C also every file wave B committed (`Tag.tsx`, `TagGroup*.ts(x)`, `tagStyles.ts`, `InteractionTag.tsx`, `Drawer.*`, `Dialog.*`, `Nav.*`).
**Not edited by anyone, and kept green:** `input/DatePicker.tsx`, `overlays/Popover.tsx`, `TeachingPopover.tsx`, `navigation/Menu.popover.tsx` (consumers of `useRestoreFocus`, `useFocusTrap` and the layer stack: the overlays' hook changes are additive); `input/Combobox.tsx`, `Dropdown.tsx`, `TimePicker.tsx`, `Listbox.tsx` (consumers of `Option.tsx` and `Combobox.expand.tsx`); `input/SwatchPicker.swatches.tsx`, `ColorPicker*.tsx` (the `FocusMode` retype); `data-display/AvatarGroup.tsx`, `Persona.tsx`; `button/Toolbar.parts.tsx`; the 0.10 `TagPicker.tsx` until wave C (it draws its own tags while wave B changes Tag). A package that breaks one of them reports it (rule 7).

### 3.2 Waves

1. **Wave A — `F6-foundation`.** Entry: the maintainer answered §8 and approved the spec. Exit: §1.14; the lead commits.
2. **Wave B — `P6-tags`, `P6-overlays`, `P6-nav`** (two at a time, D2: slot 1 `P6-tags` then `P6-nav`, slot 2 `P6-overlays`).
   - `P6-tags`: step 1 P6-01 (Tag, `tagStyles.ts`); step 2 P6-02's dismissal half (`TagGroup.context.ts`, TagGroup's roles, arrow keys, inheritance, Delete and Backspace, `onDismiss`, focus after a removal, the host seams of §4.1 including `dimDisabled`), **then the tag-seam freeze** (its own commit); step 3 P6-03 (InteractionTag); step 4 P6-02's selection half (`value`, D39, forms).
   - `P6-overlays`: P6-05 (the Drawer module split first, then sizes, `bottom`, the parts, scroll state, the Toaster's block offset; uncomments `'Drawer'` in the commit that attaches `Drawer.Header`); P6-06; P6-07; **the shell freeze** (`Drawer.panel.test.tsx` complete, §4.2 unchanged).
   - `P6-nav`: T1 the split and its seam, with `Nav.test.tsx` green and unedited, **then the Nav-seam freeze**; T2 `Nav.SectionHeader` and `Nav.Divider` (uncomments `'Nav'`); T3 `Nav.AppItem` and `Nav.AppItemStatic` (the `exportDocblocks.test.ts` row); T4 item `actions`; stories.
   - Exit per package: §6.1; its freezes committed; its report (rule 35).
3. **Wave C — `P6-tagpicker`, `P6-navdrawer`.** Entry: `P6-tagpicker` once `P6-tags` is committed (all four steps); `P6-navdrawer` once `P6-overlays` and `P6-nav` are committed. Either may start while a wave-B package still runs (D2). Exit per package: §6.1 and its report.
4. **Wave D — INTEGRATION.** Entry: every wave-B and wave-C package committed. Barrels and flat names (§4.5), story imports (rule 30), the cross-package tests (§4.6), public types (§4.7), the four pending lists emptied and the closed-bridge assertion restored, the `verify-dist` probes and fixtures (§6.2), then the full gate including `node scripts/verify-dist.mjs --final`.
5. **Wave E — DOCS** against the final API (§5); the gate script's CHANGELOG, README and CLAUDE.md checks pass.
6. **Wave F — the lead:** the final gate and the real-browser checklist (§6.3); §6.6.

---

## 4. Cross-package contracts

Frozen as rule 28 says. Every member below keeps its name, type and meaning; additions go through the lead. Module-only members are never exported from a barrel (D11).

### 4.1 The tag seams (P6-tags → P6-tagpicker; frozen after P6-tags' step 2)

**Public behaviour TagPicker relies on** (P6-01, P6-02):

- **T-T1 Tag.** `size`, `appearance`, `shape` (defaults: the nearest TagGroup's, else `'medium'`, `'filled'`, `'circular'`); `disabled` (or-ed with the group's); `value`; `media` (an Avatar without `size` takes 24, 20 or 16px through `AvatarSizeContext`); `dismissible` (default: the group's); `className` and `hidden` on the root. The root always renders `data-size`, `data-appearance`, `data-shape`, and in a `role="list"` group `role="listitem"`. The Dismiss button is a `<button type="button">` with `p-0 bg-transparent` (C-NATIVE), `tagClassNames.dismissButton`, its glyph `tagClassNames.dismissIcon`.
- **T-T2 TagGroup with `role="list"`.** Renders `role="list"` (no `aria-orientation`, no `aria-disabled`, no roving: every control its own Tab stop; no key handling of its own on the root); `aria-label`; `size`, `appearance`, `shape`, `disabled`, `dismissible` as tag defaults; the root renders `data-size`, `data-appearance`, `data-shape`, `data-orientation` (a TagPicker size test that counts `[data-size]` renders no tags, memo C10); `onKeyDown` composed consumer first (`preventDefault()` skips its own keys); `className` after `tagGroupClassNames.root`; `ref` on the root.
- **T-T3 `onDismiss(value: string)`** is called once per activation (click, Enter, Space, Delete, Backspace) of a tag's Dismiss control, synchronously inside that control's click handler, after the Tag's own `onDismiss()`. A Delete or Backspace activation is the button's own `.click()` (`detail === 0`); a pointer click has `detail > 0`.
- **T-T4 Delete and Backspace** on a Dismiss control, a Primary with a Secondary, and a focused link-chip root: ignored when `defaultPrevented`, on `repeat`, with Ctrl, Alt or Meta, while composing, or with a target other than the element itself; otherwise the Dismiss control's click. Handled on the controls, not on the group root.
- **T-T5 Focus after a removal.** Moves only when focus is inside a tag (or its Dismiss control) at the commit that unmounts it; focus placed elsewhere earlier (in `onDismiss`) or in that commit wins; the move runs in a microtask: to the corresponding control of the next tag, then (order `'next-then-previous'`) of the previous tags, then to `fallbackFocusRef` when it is connected and focusable, else nothing and `TagGroup:focus-lost` warns. A Dismiss control that unmounts while focused tries its own tag first.
- **T-T6 Held focus.** A Dismiss button (or an InteractionTag button) disabled while it has focus renders `aria-disabled="true"`, `data-disabled`, `data-disabled-focusable` instead of `disabled` until it loses focus, then the native `disabled`.

**Module-only seams** (`src/components/data-display/TagGroup.context.ts`, which imports no component):

```ts
/** Options a host component (TagPicker.Group) gives the TagGroup it renders; not public props. */
export interface TagGroupHostOptions {
  /**
   * Where focus goes after the tag that had it is removed: `'next-then-previous'` (TagGroup's own
   * order: next tag, else previous, else `fallbackFocusRef`) or `'next'` (next tag, else
   * `fallbackFocusRef`; never a previous tag).
   * @default 'next-then-previous'
   */
  removalFocus?: 'next-then-previous' | 'next';
  /** Values of the tags (Tag or InteractionTag) that render `hidden` (TagPicker's `overflow="count"`). */
  hiddenValues?: ReadonlySet<string>;
  /**
   * Whether a disabled tag dims itself. `false`: the host dims the area that holds the tags as a
   * whole (TagPicker's control), so a disabled Tag drops its own dimming and its focus-ring lift,
   * and an InteractionTag's buttons theirs; the native `disabled`, the not-allowed cursor, the
   * held focus of T-T6 and the forced-colours GrayText stay.
   * @default true
   */
  dimDisabled?: boolean;
}
/** Read by the nearest TagGroup, which passes the options to its tags and provides `null` to its own subtree. */
export const TagGroupHostContext: React.Context<TagGroupHostOptions | null>;

/** What a host component (TagPicker) gives a Tag it renders itself. */
export interface TagHostContextValue {
  /**
   * The whole accessible name of the Tag's Dismiss button: rendered as `aria-label`, with no
   * `aria-labelledby` and no visually hidden `dismissLabel` text (the tag's `textContent` is its
   * own text). The 0.10 `Tag:dismissIcon-name` rule for slot names is unchanged.
   */
  dismissName?: string;
  /** Classes merged after the Dismiss button's own (TagPicker's `removeButton` part class). */
  dismissButtonClassName?: string;
}
/** Read by every Tag below it (TagPicker wraps each default tag in its own provider). */
export const TagHostContext: React.Context<TagHostContextValue | null>;
```

- **T-T7** is the block above. `dimDisabled` is the TagPicker handoff's request R-T1, accepted (D66 needs one dimming per picker; nested opacities multiply to 0.25): `P6-tags` delivers it in step 2 with its test in `TagGroup.test.tsx` › "Host seams" ("a disabled tag keeps full opacity with dimDisabled false and keeps its native disabled and GrayText"). D36's draft lists only `removalFocus` and `hiddenValues`: the review round extends its ruling, its API block and its "Host seams" tests with `dimDisabled` to match this contract (§4 wins meanwhile).
- **T-T8 Markers** (always rendered, internal): `data-wave-tag-group` on every TagGroup root; `data-wave-tag-item` on every Tag and InteractionTag root; `data-wave-tag-dismiss` on every Tag Dismiss button and `InteractionTag.Secondary` (TagPicker's "Backspace in the empty input focuses the last tag" queries the last `[data-wave-tag-dismiss]`). They replace 0.10's `data-wave-tagpicker-remove` (D68).
- **T-T9 `tagStyles.ts`:** `export function tagRootClasses(options: { size: TagSize; appearance: TagAppearance; shape: TagShape }): string` — the root utilities of a text-only, non-dismissible, unselected, enabled tag (D21 table, D22 look, D23 shape), without a stable class (Phase 3 D4), for TagPicker's "+N" chip.

### 4.2 The drawer panel shell (P6-overlays → P6-navdrawer; frozen after P6-overlays' last task)

**`src/components/overlays/Drawer.panel.tsx`** (module-only):

```ts
/** `inline`: `openState`; `overlay`: `openState && useIsClient()` (nothing in the server HTML). */
export function useDrawerOpen(type: DrawerType, openState: boolean): boolean;

export interface DrawerPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Warning keys and texts: `${componentName}:open-inside`, `:backdrop-ignored`, `:focus-outside`. */
  componentName: string;
  type: DrawerType;                      // 'overlay' | 'inline'
  /** From `useDrawerOpen`. */
  open: boolean;
  /** From `useModalOpenState`. */
  requestOpen: ModalRequestOpen;
  /** `data-position`. */
  position: DrawerPosition;
  /** `data-size`, always rendered: the caller resolves its default. */
  size: DrawerSize;
  /** Inline only: `data-separator` and the inner edge's colour. */
  separator: boolean;
  /** Overlay only: `data-modal-type`, the role and the layer kind. */
  modalType: ModalType;
  /** `false`: kept mounted, `hidden` and `inert` while closed. */
  unmountOnClose: boolean;
  /** The inline element (`'aside'` for Drawer, `'div'` for NavDrawer). */
  inlineAs: 'aside' | 'div';
  /** `useModalTrigger()`, or `inertModalTrigger` (the layer and the inline restore capture the opener). */
  trigger: ModalTrigger;
  finalFocusRef?: React.RefObject<HTMLElement | null>;
  /** First in the panel's `cn()`: `cn(drawerClassNames.root, navDrawerClassNames.root)`. */
  rootClassName: string;
  /** First in the backdrop's `cn()`: `cn(drawerClassNames.backdrop, navDrawerClassNames.backdrop)`. */
  backdropClassName: string;
  backdrop?: Slot<'div'> | (SlotObject<'div'> & { appearance?: BackdropAppearance });
  /** The panel id (the `aria-controls` target). */
  id: string;
  /** Merged with the shell's own ref and the presence ref. */
  ref?: React.Ref<HTMLElement>;
  /** Rendered raw. */
  children?: React.ReactNode;
}
export const DrawerPanel: (props: DrawerPanelProps) => React.ReactNode; // displayName 'DrawerPanel'
```

Meaning (binding): the shell renders nothing while unmounted (presence). **Overlay:** a `Portal` (its `ref` used for D104) holding, for `modal` and `alert` with `backdrop !== null`, the backdrop (`aria-hidden`, `data-appearance`, the presence attributes, `onMouseDown`), then the panel `div` with `role="dialog"` (`"alertdialog"` for `alert`) and `tabIndex={-1}` before `{...rest}`, `id`, the enumerated `data-type="overlay"`, `data-position`, `data-size`, `data-modal-type` before `{...rest}`, the presence attributes after it, `onKeyDown` composed (the consumer's first, then the non-modal Tab-order handler), classes `cn(rootClassName, 'fixed flex flex-col border-border bg-background text-foreground shadow-64', placement, size, insets, className)`. **Inline:** the `inlineAs` element in place, no role, no `tabIndex`, `data-type="inline"`, `data-position`, `data-size`, the boolean `data-separator` before `{...rest}`, presence after, classes `cn(rootClassName, 'relative flex min-h-0 shrink-0 flex-col max-w-full bg-background text-foreground border-transparent data-[separator]:border-border forced-colors:border-[CanvasText]', edge, size, className)`. **Hooks**, in this order, all keyed on `open`: `usePresence(open, { unmountOnExit: unmountOnClose })`; the inline restore `useRestoreFocus({ enabled: open && inline, container, triggerRef: trigger.focusRef, finalFocusRef, requireFocusInside: true })`; the kept-mounted raise (D104); `useBackdropPress(panelRef, modalType !== 'alert')`, `useModalDismiss(requestOpen, componentName, afterOutsidePress)` and `useModalLayer({ open: open && overlay, modalType, onDismiss, refs: [panelRef], container: overlay ? panel : null, triggerRef: trigger.focusRef, finalFocusRef })`; `useModalOpener` and `usePopoverTabOrder` (non-modal overlay only); the open-inside check (D106); the backdrop-ignored warning. The overlay's dismiss layer is the one the Toaster measures (`'modal'`, or `'dialog'` for `non-modal`). The shell provides **no** `DrawerContext` (so `Drawer.Close`, `Drawer.Title` and `Drawer.Trigger` inside a NavDrawer throw their C-CONTEXT error), no `ModalSurfaceContext`, no title registry, no Close button and no padding. The caller renders its triggers itself, calls `useModalOpenState`, calls `useModalTriggerSession(trigger, open)` in its own body after rendering the shell (its layout effects run after the shell's), and names the panel (NavDrawer's `aria-label` reaches it through `{...rest}`). A change of `type` remounts the panel and its content (D105).

**`src/components/overlays/Drawer.scroll.ts`** (module-only; optional reuse):

```ts
export type DrawerScrollState = 'none' | 'top' | 'middle' | 'bottom';
/** `'none'` for `null` and on the server; D80's thresholds; listeners and observers per D81. */
export function useScrollState(element: HTMLElement | null): DrawerScrollState;
/** D80's separator classes: the border, its transparent colour, the `data-scroll-state` variants, forced colours. */
export const scrollSeparatorClasses: { readonly header: string; readonly footer: string };
```

**Types** (`src/components/overlays/Drawer.context.ts`, re-exported from `Drawer.tsx`): `DrawerPosition = 'start' | 'end' | 'left' | 'right' | 'bottom'`; `DrawerSize = SurfaceSize`; `DrawerType = 'overlay' | 'inline'`; `DrawerModalType = ModalType`; `DrawerOpenChangeReason = ModalOpenChangeReason` and `DrawerOpenChangeDetails = OpenChangeDetails<DrawerOpenChangeReason>` (unchanged).

**`Dialog.shared.tsx` members NavDrawer reads** (signatures unchanged from 0.10): `useModalOpenState(open, defaultOpen, onOpenChange): [boolean, ModalRequestOpen]`, `useModalTrigger(): ModalTrigger`, `inertModalTrigger`, `useModalTriggerSession(trigger, open)`, `type ModalTrigger`, `type ModalRequestOpen`, `type ModalOpenChangeDetails`. A trigger toggles (`requestOpen(!open, { reason: 'trigger', event })`, D89); NavDrawer's inner Hamburger does the same with its own `'trigger'` reason (D133).

**Layer kinds** (F6-foundation → P6-overlays → every surface): a non-modal Dialog, Drawer or NavDrawer overlay registers `kind: 'dialog'` with `escape: 'inside'`, `outsidePress: false`, `focusOutside: false`; modal and alert surfaces `kind: 'modal'` (alert: `outsidePress: false`). The Toaster's `getPanelOffsets` counts `'modal'` and `'dialog'`; no other `kind === 'modal'` check changes.

### 4.3 The Nav seam (P6-nav → P6-navdrawer; frozen after P6-nav's first task)

**`src/components/navigation/Nav.context.ts`** (module-only; imports no component):

```ts
export type NavValueKind = 'item' | 'category';
export interface NavCategoryStore {
  record(value: string, category: string | null): void;
  forget(value: string, category: string): void;
  get(value: string): string | undefined;
  subscribe(listener: () => void): () => void;
}
export function createCategoryStore(): NavCategoryStore;

/** The context a Nav root provides to its parts (0.10's fields, unchanged). */
export interface NavContextValue {
  /** The selected value (`''` = none). */
  value: string;
  /** Activation: sets the value, then calls the root's `onActivate`. */
  select: (value: string) => void;
  openCategories: readonly string[];
  toggleCategory: (value: string) => void;
  /** Registers a value for the duplicate warnings; returns the unregister function. */
  registerValue: (kind: NavValueKind, value: string) => () => void;
  currentCategory: string | undefined;
  categoryStore: NavCategoryStore;
}
export const NavContext: React.Context<NavContextValue | null>;        // displayName 'NavContext'
export const NavCategoryValueContext: React.Context<string | null>;
/** C-CONTEXT: "[WaveUI] <componentName> must be used within Nav". */
export function useNavContext(componentName: string): NavContextValue;
export function useNavValue(context: NavContextValue, kind: NavValueKind, value: string): void;
export function useRecordCategory(context: NavContextValue, value: string): void;

/** What an arrow-key body (NavDrawer.Body `focusMode="arrow"`) gives the Nav parts inside it. */
export interface NavRovingContextValue {
  /**
   * Called by every Nav.Category from a layout effect keyed on `[context, value, containsCurrent]`:
   * `(value, true)` while it is a closed category that holds the current page, `(value, false)`
   * when it stops being one and in the effect's cleanup. Must be stable (memoised by the provider).
   */
  reportCurrentCategory: (category: string, holdsCurrent: boolean) => void;
}
/**
 * Provided (non-null) inside an arrow-key body: every Nav.Item and Nav.SubItem renders
 * `data-roving-value={value}` on its link or button (after `{...rest}`), and every category toggle
 * `data-roving-value={'wave-nav-category:' + value}` (stable, also while open), and reports as
 * above. `null` (the default, every plain Nav): nothing is rendered or reported.
 */
export const NavRovingContext: React.Context<NavRovingContextValue | null>; // displayName 'NavRovingContext'

export type NavPartKind = 'entry' | 'category';
export function markNavPart<T extends object>(component: T, kind: NavPartKind): T;
/** `getElementType(node, { suspend: false })` and the marker; `null` for anything else. */
export function getNavPartKind(node: React.ReactNode): NavPartKind | null;
/** Never suspends. */
export function containsValue(nodes: React.ReactNode, selected: string): boolean;
/** At any depth. */
export function findCategoriesContaining(nodes: React.ReactNode, selected: string): string[];

/**
 * Development only: after every commit of the calling component, warns once per `owner`
 * (`${owner}:list-child`) at the first child node of `list` that is neither an `<li>`, `<script>`
 * nor `<template>` element nor whitespace text. `contents` picks the advice: `'items'` the Nav
 * parts, `'sub-items'` Nav.SubItem, Nav.SectionHeader and Nav.Divider.
 */
export function useNavListChildCheck(
  list: React.RefObject<HTMLUListElement | null>,
  owner: string,
  contents: 'items' | 'sub-items',
): void;

/** Moved from Nav.tsx, unchanged (the link-only attributes mask of the button branches). */
export type NoAnchorOnlyAttributes = { /* … */ };
```

**`src/components/navigation/Nav.root.tsx`:**

```ts
/** 0.10, unchanged; re-exported from Nav.tsx. */
export interface NavProps { /* … */ }

/** What useNavRootState reads: the root's props with Nav's deprecated aliases already resolved. */
export interface UseNavRootStateOptions {
  /** The public component: the key and text prefix of the duplicate-value warnings. */
  componentName: string;
  /** Controlled selected value (`undefined`: uncontrolled). */
  value: string | undefined;
  /** Initial selected value of an uncontrolled root (`''`: nothing selected). */
  defaultValue: string;
  /** Called with the new value when it changes (`useControllable`). */
  onValueChange: ((value: string) => void) | undefined;
  /** Called on every activation, re-selection included, after the value update (Nav's deprecated `onNavItemSelect`). */
  onActivate?: (value: string) => void;
  openCategories: readonly string[] | undefined;
  defaultOpenCategories: readonly string[] | undefined;
  onOpenCategoriesChange: ((openCategories: string[]) => void) | undefined;
  currentCategory: string | undefined;
  /** Scanned once, at mount, for the categories that contain the selected value (when `defaultOpenCategories` is absent). */
  children: React.ReactNode;
}

/**
 * The state of a Nav root (Nav, NavDrawer). Returns the context value to provide through
 * `NavContext`, memoised: the same object while none of its fields changes.
 */
export function useNavRootState(options: UseNavRootStateOptions): NavContextValue;
export const NavRoot: (props: NavProps) => React.ReactNode; // displayName 'Nav'; no docblock (C-DOCS)
```

Meaning (binding): a plain Nav's DOM, server HTML, classes, warning keys and texts are 0.10's; `useNavRootState({ componentName: 'NavDrawer', … })` warns `NavDrawer:duplicate-item:<value>` and `NavDrawer:duplicate-category:<value>` with D112's texts; the markers are set in `Nav.tsx` next to each `displayName` (`markNavPart(NavItem, 'entry')`, `markNavPart(NavSubItem, 'entry')`, `markNavPart(NavCategory, 'category')`), so `useNavRootState`'s scan recognises items in any root's children, lazy references included. Imports run one way: `Nav.tsx → Nav.root.tsx, Nav.parts.tsx, Nav.context.ts`; `Nav.root.tsx, Nav.parts.tsx → Nav.context.ts`; NavDrawer → `Nav.root.tsx`, `Nav.context.ts`; nothing imports `Nav.tsx` but the barrel.

NavDrawer's own contexts (`NavDrawer.context.ts`: `NavDrawerContext { open, requestOpen, panelId, type }` and `NavDrawerLayoutContext { scrollState, registerBody }`, both `null` by default, importing only React and types) are internal to `P6-navdrawer` (Hamburger reads the first); they are no cross-package seam, but INTEGRATION lists them as internal helpers (§4.5).

### 4.4 Foundation seams (F6-foundation → waves B and C)

- **Types** (`src/lib/types.ts`, §1.1): `ModalType = 'modal' | 'alert' | 'non-modal'`; `SurfaceSize = CoreSize | 'full'`; `BackdropAppearance = 'dimmed' | 'transparent'`; `HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6`; `FocusMode = 'tab' | 'arrow'`; `TagSize`, `TagAppearance`, `TagShape`. Readers: P6-tags and P6-tagpicker (tag unions), P6-overlays (`ModalType`, `SurfaceSize`, `BackdropAppearance`, `HeadingLevel`), P6-nav (`HeadingLevel`), P6-navdrawer (`FocusMode`, `ModalType`).
- **Layers** (`src/lib/layers.ts`, `src/hooks/useDismiss.ts`, §1.2): `LayerKind` with `'dialog'`; `LayerRecord.escape` and `UseDismissOptions.escape: boolean | 'inside'`; `hasIsolatingModalBelow(layerId: string): boolean`; isolation changes notify `subscribeLayers` listeners. Reader: P6-overlays.
- **Registry and variants** (§1.3, §1.4): every constant and key, each applied as a literal member access first in its element's `cn()`; `VARIANT_BASES` for `tagPickerOptionClassNames`, `tagPickerGroupClassNames`, `navDrawerClassNames`, `hamburgerClassNames`.
- **Tokens** (§1.6): the utilities `bg-muted-hover`, `bg-muted-pressed`, `bg-selected-hover`, `bg-selected-pressed`, for `foreground` text (muted) and `selected-foreground` text (selected) only. Readers: P6-tags (and TagPicker's tags through Tag).
- **Icons** (§1.7): `NavigationIcon` (default 20px, `fill`). Reader: P6-navdrawer.
- **`src/components/button/Toolbar.navigation.ts`** (§1.8): `TOOLBAR_ITEM_SELECTOR` and `useToolbarNavigation(options: { orientation: Orientation }): { containerProps: RovingContainerProps }` — exactly Toolbar's 0.10 roving. Readers: P6-tags (TagGroup's toolbar), P6-navdrawer (the selector; NavDrawer.Body calls `useRovingTabIndex` itself with `orientation: 'both'`, `loop: true`, `homeEndKeys: true`, `typeahead: false` and `activeValue`).
- **`useRovingTabIndex` hand-back** (§1.9): when the container changes (to `null` or another element) or `manageTabIndex` turns `false`, every element the hook stamped gets its own `tabindex` back (the attribute read at its first stamp, or none) and loses a `data-roving-value` the hook added; values React rendered stay. Readers: P6-tags (D31, the toolbar → list switch), P6-navdrawer (D131, `'arrow'` → `'tab'`).
- **`AvatarSizeContext`** (`src/components/data-display/Avatar.context.ts`, §1.10): `React.Context<{ size: 16 | 20 | 24 } | null>`; an Avatar without its own `size` takes the box. Readers: P6-tags (Tag, InteractionTag.Primary).
- **`ListboxSurface listProps`** (`Option.tsx`, §1.11; public): `listProps?: ListboxSurfaceListProps`, spread before the listbox's own attributes, `onMouseDown` composed first, `ref` merged. Reader: P6-tagpicker (`TagPicker.List`).
- **`PickerExpandButton dimDisabled`** (`Combobox.expand.tsx`, §1.12; module-only): `dimDisabled?: boolean`, default `true`. Reader: P6-tagpicker.

### 4.5 Barrel and compound requests (INTEGRATION applies)

- `src/components/data-display/index.ts`: `TagGroup`, `InteractionTag`, `InteractionTagPrimary`, `InteractionTagSecondary`; types `TagGroupProps`, `InteractionTagProps`, `InteractionTagPrimaryProps`, `InteractionTagSecondaryProps`.
- `src/components/input/index.ts`: `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOption` (the value: the line `type TagPickerOption` becomes `TagPickerOption`, which exports both meanings; a `type` and a value specifier of one name in one `export { … }` is TS2300), `TagPickerOptionGroup`; types `TagPickerControlProps`, `TagPickerGroupProps`, `TagPickerInputProps`, `TagPickerButtonProps`, `TagPickerListProps`, `TagPickerOptionProps`. (`ListboxSurfaceListProps` is exported in wave A.)
- `src/components/overlays/index.ts`: `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`, `DrawerFooter`; types `DrawerSize`, `DrawerType`, `DrawerModalType`, `DrawerHeaderProps`, `DrawerHeaderTitleProps`, `DrawerHeaderNavigationProps`, `DrawerBodyProps`, `DrawerFooterProps`, `DialogSize`.
- `src/components/navigation/index.ts`: `NavSectionHeader`, `NavDivider`, `NavAppItem`, `NavAppItemStatic`, `NavDrawer`, `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`, `Hamburger`; types `NavSectionHeaderProps`, `NavDividerProps`, `NavAppItemOwnProps`, `NavAppItemAnchorProps`, `NavAppItemButtonProps`, `NavAppItemProps`, `NavAppItemDynamicProps`, `NavAppItemStaticProps`, `NavDrawerProps`, `NavDrawerHeaderProps`, `NavDrawerBodyProps`, `NavDrawerFooterProps`, `HamburgerProps`.
- `src/index.ts`: nothing (`export type * from './lib/types'` carries the new unions).
- **Module-only, never in a barrel** (added to `integration.test.tsx`'s "keeps internal helpers out of the public API" list): `useToolbarNavigation`, `TOOLBAR_ITEM_SELECTOR`, `AvatarSizeContext`, `hasIsolatingModalBelow`; `TagGroupContext`, `useTagGroupContext`, `TagGroupHostContext`, `TagHostContext`, `useTagGroupItem`, `InteractionTagContext`, `tagRootClasses`; `DrawerPanel`, `useDrawerOpen`, `useScrollState`, `scrollSeparatorClasses`, `ModalCloseButton`, `ModalBackdrop`, `useBackdropAppearance`, `useModalOpener`, `useInitialFocus`; `useNavRootState`, `NavContext`, `NavRovingContext`, `useNavListChildCheck`, `markNavPart`, `getNavPartKind`, `NavDrawerContext`, `NavDrawerLayoutContext`; `TagPickerRoot`, `TagPickerContext`, `useTagPickerContext`, `TagPickerControlContext`, `useTagPickerControlContext`, `useTagOverflow`, `createOptionText`, `findExactMatch`.
- **Pending lists:** all four emptied (§1.5); `verify-dist.test.mjs`'s bridge case asserts the closed bridge again (`PENDING_FLAT_EXPORTS` is `[]`, no error in either mode); the `public-types.test.ts` `INTERNAL_HELPERS` entry for `Nav.context.ts#NoAnchorOnlyAttributes` stays (P6-nav moved it).
- **Story imports** (rule 30): `stories/TagGroup.stories.tsx`, `InteractionTag.stories.tsx`, `NavDrawer.stories.tsx`, `Hamburger.stories.tsx`, and every wave-B or wave-C story that imports a flat name or a new module by path (`Tag`, `TagPicker`, `Drawer`, `Dialog`, `Nav`), normalised to `'../src'`.

### 4.6 Integration tests (INTEGRATION, `src/__tests__/integration.test.tsx`)

1. **Server Components** (the `ssrCase` suite; `asClientReference` parts render the same `renderToString` output and behave as plain parts): (a) a TagGroup with Tags and InteractionTags written in a Server Component (same server HTML, hydration, a dismissal moves focus, a toggle selects); (b) InteractionTag's parts as client references; (c) TagPicker with `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerList`, `TagPickerOption` and `TagPickerOptionGroup` references and a preselected registered option (the tag shows the option's label in the server HTML; open, add, remove with Delete, focus to the input); (d) the Drawer case gains `Header`, `HeaderTitle`, `HeaderNavigation`, `Body` and `Footer` (server HTML still only the trigger; it opens, is named by the HeaderTitle, closes through the HeaderTitle's Close and the footer's `Drawer.Close`); (e) a new `Drawer (inline)` case (`<Drawer type="inline" defaultOpen>` with lazy `Trigger`, `Title`, `Close`: the body is in the server HTML, Close closes it and focus lands on the trigger, the trigger reopens and closes it); (f) Nav with section headers, a divider, an app item and item actions; (g) an inline, open NavDrawer with lazy `Header`, `Body`, `Footer`, `Item`, `Category`, `SubItem` and a `Hamburger` (`data-type="inline"` in the server HTML; a click selects; the inner Hamburger closes it).
2. **The real Field** (`fieldCases`): the composable TagPicker (parts form and `TagPicker.Button` form): label, description, error, a required Field blocks submission, `aria-invalid`.
3. **TagGroup and InteractionTag:** a TagGroup in a modal Dialog (Escape closes the Dialog; TagGroup consumes no Escape; the focus move after a removal stays inside the trap); a Popover opened from an `InteractionTag.Primary` in a TagGroup keeps its arrow keys, Delete and Escape and returns focus to the Primary; a Tooltip around an `InteractionTag.Primary` names and describes it; a Tag with an Avatar `media` from the barrel is sized by the context (across the package boundary).
4. **TagPicker in a Dialog** ("pickers inside a Dialog"): a TagPicker parts row (the first Escape closes the list, the second the Dialog); Escape on a remove button returns to the input without closing the Dialog; removing the last tag keeps focus inside the trap.
5. **Toaster and drawers:** a real `Drawer position="bottom"` and `position="end"` in a Toaster (the panel's rectangle stubbed from a `ref` callback) set `--wave-toaster-offset-block` and `--wave-toaster-offset` (the P6-05 guard, one test each); a non-modal end Drawer moves the toasts beside it; an open inline Drawer at the window's end edge leaves bottom-end toasts in their corner; `bottom-start` toasts move clear of an open `start` overlay NavDrawer and come back when it closes.
6. **Non-modal surfaces:** a Toast over a non-modal Dialog and over a non-modal Drawer (the region is not inert, reached by Tab in page order and announced; Escape in the region dismisses the toasts and leaves the surface open; a click on a toast leaves it open); a Menu opened from the page while a non-modal Drawer is open returns focus to its own trigger, and one opened from inside the drawer returns into it; pickers inside a non-modal Dialog (Escape closes only the popup); a SpinButton in a non-modal Dialog commits its typed value when the user clicks the page, and the dialog stays open.
7. **Dim once and slots:** the "confirm Dialog deleting a row inside a Drawer" suite's two layouts render the Dialog's backdrop `data-appearance="transparent"` and the Drawer's `dimmed`, and both isolations hold; a Tooltip around an icon-only `Button` in `titleAction` names and describes it, with the Tab order title action → Close; the class-name case "Dialog.Content's close button and title heading carry their classes" (`:6133`) gains the title-actions area, a title action and `data-size`.
8. **Kept mounted:** a kept-mounted Dialog opened from inside a Drawer stacks above it; one rendered beside an open Drawer opens above it (D104); a SpinButton's typed value survives a kept-mounted Dialog's close and reopen.
9. **NavDrawer:** a Menu from a Nav item action in an overlay NavDrawer (Escape closes the Menu with focus on its MenuButton, a second Escape the drawer with focus on the opener; in an arrow body the actions are in the arrow order); a modal Dialog opened from an inline and from an overlay NavDrawer (Escape levels, focus return); a Hamburger in a `Tooltip relationship="label"` inside a Toolbar (named by the tooltip, one Tab stop).
10. **The barrel test:** `PENDING_FLAT_MEMBERS` empty; "keeps internal helpers out of the public API" with §4.5's list.

### 4.7 Public type tests (INTEGRATION, `src/__tests__/public-types.test.ts`)

Every new exported type in the import list (§4.5), with: `expectTypeOf<TagProps['size']>().toEqualTypeOf<TagSize | undefined>()` and likewise `appearance` and `shape` on `TagProps`, `TagGroupProps` and `InteractionTagProps`; `TagGroupProps['onValueChange']` takes `string[]`, `TagGroupProps['value']` accepts `readonly string[]`, `TagGroupProps['onDismiss']` is `((value: string) => void) | undefined`; `React.ComponentProps<typeof TagPicker>` equals `TagPickerProps`, `TagPickerProps['options']` is optional, `TagPickerLabels` has `create`, `clear`, `expand`, `overflowCount`, the parts take no `size` or `appearance` (`// @ts-expect-error`), `TagPickerOption` is both the entry interface and the component; `expectTypeOf<'bottom'>().toExtend<DrawerPosition>()`, `DrawerSize` and `DialogSize` equal `SurfaceSize`, `DrawerModalType` equals `ModalType`, `DrawerTriggerRenderProps['aria-haspopup']` is `'dialog' | undefined`, `DrawerProps['ref']` is `React.Ref<HTMLElement> | undefined`, the part props' `ref` types; `NavAppItemAnchorProps` and `NavAppItemButtonProps` extend `NavAppItemOwnProps` (the branch block of `:577-580`), `NonNullable<NavDrawerBodyProps['focusMode']>` equals `FocusMode`, `NonNullable<NavDrawerProps['modalType']>` equals `'modal' | 'non-modal'`, `NavDrawerProps['size']` is `DrawerSize | undefined`; `ListboxSurfaceProps['listProps']` is `ListboxSurfaceListProps | undefined` (wave A). The walker then finds every named type of the new public signatures exported, with `PENDING_PUBLIC_TYPES` empty.

---

## 5. CHANGELOG, README, CLAUDE.md and guides (DOCS, wave E)

### 5.1 CHANGELOG

A new `## [0.11.0] - Unreleased` section above `## [0.10.0] - 2026-10-17`, with an intro paragraph ("The sixth Fluent UI v9 parity release: Phase 6 of the roadmap, tags, drawers and the app shell. …") and these subsections (the 0.10 section's shape; the gate script requires Added, Changed, Deprecated and Size):

- **Upgrading from 0.10** (numbered):
  1. **Dialog and Drawer backdrops are the surface's siblings.** A test or a style that reached the backdrop through `dialog.parentElement` or `panel.parentElement` uses `.wave-dialog-content__backdrop` or `.wave-drawer__backdrop` (the Dialog surface now sits in `.wave-dialog-content__positioner`).
  2. **Dialog and Drawer mount through the presence core:** their elements carry `data-presence`, and a closed surface without motion unmounts one render after the closing commit (in the same `act()`). A test that queries a closed kept-mounted surface (`unmountOnClose={false}`) passes `{ hidden: true }`.
  3. **A modal opened over another modal no longer dims the page twice:** its backdrop is transparent; `backdrop={{ appearance: 'dimmed' }}` keeps 0.10's look.
  4. **Every Dialog and Drawer trigger toggles:** a trigger inside its own surface, or the trigger of a non-modal or inline surface, closes it when clicked while open. A render-prop `Drawer.Trigger` that reads `aria-haspopup` accepts `undefined` (inline drawers render none).
  5. **Drawer layout:** a hand-made action row (or a `Dialog.Footer`) at the end of a Drawer's content becomes `Drawer.Footer` to stay in view; a `title` or `titleAction` next to a new `Drawer.Header` is ignored (move it into a `Drawer.HeaderTitle`). A test that asserts `pe-8` on a Dialog title asserts `pe-[var(--wave-dialog-title-end-padding,2rem)]`.
  6. **`ModalType` gains `'non-modal'` and `DrawerPosition` `'bottom'`:** an exhaustive `switch` or a `Record` over either needs the case.
  7. **Tag:** a focused Dismiss button dismisses on Delete and Backspace, also outside a TagGroup. Assertions on Tag's exact class string or padding classes change (`ps-3` → `ps-2.75`, `pe-1.5` → `pe-1.25`, `pe-3` → `pe-2.75`, `py-1` → `min-h-7`; `toHaveClass('bg-muted')` does not). Tag's new own props shadow the attributes of the same names: `as="li" value={3}` becomes `value={String(3)}`, and `size`, `shape`, `appearance`, `selected`, `media`, `icon` and `secondaryText` no longer reach an `as` component; an interface that extends `TagProps` and declares one of them with another type no longer compiles.
  8. **TagPicker:** its tags are Tags in a TagGroup, so tests that assert the 0.10 tag classes (`px-2 py-0.5 text-body-1`), the remove button's `ms-0.5 rounded-sm` or its 12px glyph, query `[data-wave-tagpicker-remove]` or count the picker's buttons (one more: "Show options") change; `expandIcon={false}` keeps the 0.10 field. After a keyboard removal focus is on the next tag, not on the input; a press on the empty area of an open TagPicker closes the list. In the parts form, keep the options of selected values in `TagPicker.List`: TagPicker hides them and reads their labels.
  9. **`import { TagPickerOption }`** now brings the component (`TagPicker.Option`) and the entry type; `import { type TagPickerOption }` keeps only the type.
  10. **Nav:** a Nav whose list holds content that is not an `<li>` (a Divider, a heading, a `<div>`, a Tooltip wrapped around a `Nav.Item`) logs a development warning; use `Nav.Divider` or `Nav.SectionHeader`, or wrap the content in an `<li>`. A test that spies on `console.warn` around such a Nav sees the message.
- **Added** (per item, with the gap ids):
  - **Tag** `appearance` (`filled`, `outline`, `brand`), `size` (`extra-small` 20px, `small` 24px, `medium` 28px), `shape` (`circular`, the default, or `rounded`), `disabled` (dims the tag and disables its Dismiss button), `selected` (a look; InteractionTag is the toggle), `value` (the tag's key in a TagGroup), and the `media` (an Avatar sized 24, 20 or 16px), `icon` and `secondaryText` slots; the Dismiss button stays named after the tag's text and gets a 24×24px target. Closes `tag-1`, `tag-2`, `tag-3`, `tag-5`, `tag-6`, `tag-7`.
  - **TagGroup** (new): a toolbar of tags (one Tab stop, Toolbar's arrow keys) or, with `role="list"`, a list; default `size`, `appearance`, `shape`, `dismissible` and `disabled` for its tags; `onDismiss(value)`; Delete and Backspace dismiss; focus moves to the next tag, else the previous one, else `fallbackFocusRef`, when the focused tag is removed; selectable InteractionTags through `value`/`defaultValue`/`onValueChange` (Fluent's `selectedValues`/`onTagSelect`), with `name`, `form` and `required`. Closes `taggroup-1`, `taggroup-2`, `taggroup-3`, `tag-4`.
  - **InteractionTag** (new) with `InteractionTag.Primary` (the action, or a toggle in a selecting TagGroup; `media`, `icon`, `secondaryText`) and `InteractionTag.Secondary` (a separate Dismiss button named "Dismiss <text>"); flat names `InteractionTagPrimary`, `InteractionTagSecondary`. Closes `interactiontag-1`.
  - **TagPicker** is composable: `TagPicker.Control`, `.Group` (a TagGroup list), `.Input`, `.Button` (a trigger without text entry), `.List`, `.Option` (`media`, `secondaryContent`) and `.OptionGroup`, also as flat names; a part without children renders its defaults, so `<TagPicker options={…} />` is unchanged. Its tags are Tags (an `options` entry's `media` shows in its option and its tag). Free tagging: `allowCreate` and `onOptionCreate(text)` end the list with a create option (`labels.create`, default `Create "{text}"`) while the trimmed text matches no option label or value and no selected value ([#6](https://github.com/mortenbrudvik/waveui/issues/6)). `expandIcon` (a chevron, shown by default; `labels.expand`), `clearable` (`labels.clear`), `overflow="count"` (one line with a "+N" count while focus is outside; `labels.overflowCount`); the previous arrow at the start of the text focuses the last tag; `data-overflow`, `data-collapsed`, `data-create`. Closes `tagpicker-1`, `tagpicker-2`, `tagpicker-3`, `tagpicker-4`, `tagpicker-5`, `tagpicker-6`, `tagpicker-8`, `tagpicker-9`.
  - **`ListboxSurface listProps`** (attributes and a `ref` for the list element) and the type `ListboxSurfaceListProps`.
  - **Drawer** `size` (`small` 320px, the default, `medium` 592px, `large` 940px, `full`) and `position="bottom"` (`size` sets the height); `Drawer.Header`, `Drawer.HeaderTitle` (`action`, `headingLevel`, the built-in Close button), `Drawer.HeaderNavigation`, `Drawer.Body` and `Drawer.Footer` (flat names `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`, `DrawerFooter`); `headingLevel` on `Drawer.Title`; `data-scroll-state` on the body, header and footer, whose separators show while content is scrolled under them; `data-position` and `data-size` on the panel; toasts move above a bottom drawer (`--wave-toaster-offset-block`). Closes `drw-1`, `drw-2`, `drw-8`, `drw-9`, `drw-10`, `drw-11`.
  - **Non-modal surfaces and slots:** `modalType="non-modal"` on Dialog and Drawer, and `modalType` (`modal`, `alert`, `non-modal`) on Drawer with `data-modal-type` on its panel (closes `dialog-2`, `drw-6`); a `backdrop` slot on `Dialog.Content` and Drawer with `appearance`, and a modal over another modal dims the page once (closes `dialogsurface-1`); a `closeButton` slot (`null` hides the built-in Close button; closes `dialogtitle-2`); `Dialog.Content size` `large` (940px) and `full`, with `data-size`, and `Dialog.Content titleAction`, `Dialog.Title action` and Drawer `titleAction` ([#4](https://github.com/mortenbrudvik/waveui/issues/4)).
  - **Inline and kept-mounted surfaces:** Drawer `type` (`overlay`, `inline`) and `separator`, with `data-type` and `data-separator` on the panel (closes `drw-7`); `unmountOnClose` on Drawer and Dialog (closes `drw-3`, `dialog-4`); Dialog and Drawer surfaces carry `data-presence`, so `data-[presence=…]:` classes animate them.
  - **Nav parts:** `Nav.SectionHeader` (`<h3>` by default, `headingLevel`), `Nav.Divider` (hidden from assistive technology), `Nav.AppItem` (a link with `href`, else a button; never selected) and `Nav.AppItemStatic`, with flat names; `actions` on `Nav.Item` and `Nav.SubItem` (Fluent's SplitNavItem). Closes `nav-5`, `nav-9`, `nav-10`, `nav-11`, `nav-12`.
  - **NavDrawer** (new) with `NavDrawer.Header`, `NavDrawer.Body` (`focusMode`: `'tab'`, the default, or `'arrow'`; `data-focus-mode`) and `NavDrawer.Footer` (flat names): Nav in a drawer panel, `type` `overlay` (a named modal or non-modal dialog around a `<nav>`) or `inline`, `position` (default `start`), `size` (default `small`), `separator` (default on), `modalType`, `unmountOnClose`, `finalFocusRef`, `backdrop`, and Nav's value and category props (closes `nav-6`, `nav-3`). **Hamburger** (new): a `subtle` icon-only Button with the navigation glyph, named "Navigation", that toggles the NavDrawer it sits in (closes `nav-13`).
  - **Types** `TagSize`, `TagAppearance`, `TagShape`, `HeadingLevel`, `FocusMode`, `SurfaceSize`, `BackdropAppearance`, `DrawerSize`, `DrawerType`, `DrawerModalType`, `DialogSize`, and every new `*Props` type (§4.5).
  - **Tokens** `muted-hover`, `muted-pressed`, `selected-hover`, `selected-pressed` (utilities `bg-muted-hover`, …).
  - **Stable classes** of the new parts and keys (§1.3, one line listing the roots and keys).
  - **Development warnings**, one line listing the new keys: `Tag:nested-button`, `TagGroup:duplicate-value:<value>`, `TagGroup:missing-value`, `TagGroup:focus-lost`, `TagGroup:static-toolbar`, `TagGroup:listbox-role`, `InteractionTag:selected-in-group`, `InteractionTag.Secondary:button-child`, `TagPicker:trigger`, `TagPicker:allowCreate-button`, `TagPicker:expandIcon-button`, `TagPicker.List:placement`, `TagPicker.Option:label`, the Drawer and Dialog keys of P6-05 … P6-07 (`Drawer:title-ignored`, `Drawer.Header:unscanned`, `Drawer.Body:unscanned`, `Drawer.Body:duplicate`, `Drawer.Footer:unscanned`, `Drawer.HeaderTitle:outside-header`, `Drawer:closeButton-button-element`, `Dialog.Content:closeButton-button-element`, `…:backdrop-ignored`, `Drawer:open-inside`, `Dialog:open-inside`), `Nav:list-child`, `Nav.Category:list-child`, `NavDrawer.Body:list-child`, `NavDrawer.Footer:list-child`, `NavDrawer:loose-items`, `NavDrawer:unreachable`, `NavDrawer:open-inside`, `NavDrawer:backdrop-ignored`, `Hamburger:icon-empty`, `Hamburger:icon-button` (DOCS takes the exact keys from the item sections).
- **Changed**:
  - *Behaviour:* every Dialog and Drawer trigger toggles (D89); Tag's Dismiss button dismisses on Delete and Backspace, also outside a TagGroup, and a held key dismisses one tag (D33); a tag control disabled while it has focus keeps it, unavailable, until focus leaves (D25); TagPicker: a keyboard removal focuses the next tag's remove button, else the input (0.10: the input), a click still focuses the input, and focus does not move while a controlled parent keeps the tag (D56); the option whose label equals the typed text becomes active (D60); a press on the empty area of the field toggles the list (D66); the default `filter` matches `textValue ?? label`, and `TagPicker:unknown-value` warns only for the array form with the default tags and without `allowCreate` (D58); Nav and its categories (and NavDrawer's lists) warn when a list child is not an `<li>` (D114); `Tag` stories' `FilterGroup` is built on TagGroup.
  - *Visual:* TagPicker shows a chevron at the end of the field with end padding for it, and its tags are Tags one size below the picker (20px with 12px text in a medium picker, was 24px with 14px), filled or, on `filled-darker`, outline, with 4px corners and Tag's Dismiss button; a disabled TagPicker dims its field once; a modal over another modal no longer dims the page twice; the built-in Drawer header's line shows only while the body is scrolled away from its top (always in forced colours); overlay drawer panels pad the safe-area insets (with `viewport-fit=cover`); Tag's Dismiss glyph takes the tag's text colour and its hover fill is `muted-hover`.
  - *DOM structure:* the backdrop of Dialog and Drawer is the surface's sibling and `aria-hidden`, and the Dialog surface sits in `wave-dialog-content__positioner`; Dialog and Drawer elements carry `data-presence`; the Dialog's Close button sits in the title-actions area and the titles' end padding follows its width; Tag's root renders `data-size`, `data-appearance`, `data-shape` and the internal markers, has a 1px border (transparent unless `outline` or selected) and 1px smaller padding classes; TagPicker's tag is `<span role="listitem" class="wave-tag wave-tag-picker__tag">` (was a `<div>`), its tag list a TagGroup (`wave-tag-group wave-tag-picker-group wave-tag-picker__group` with its data attributes), its remove button Tag's Dismiss button (still named "Remove …", still `wave-tag-picker__remove-button`), its hidden summary on the root, its field `relative` with the expand button, and `data-wave-tagpicker-remove` is gone.
  - *Types:* `ModalType` gains `'non-modal'` and `DrawerPosition` `'bottom'`; `DialogContentProps['size']` widens to `DialogSize`; `DrawerProps` and its `ref` are typed for `HTMLElement` (div refs and handlers keep compiling); `DrawerTriggerRenderProps['aria-haspopup']` is optional; `TagOwnProps` gains `appearance`, `size`, `shape`, `disabled`, `selected`, `value`, `media`, `icon`, `secondaryText`, which shadow an `as` element's attributes of those names (`TagProps<'li'>['value']` and `TagProps<'button'>['value']` are `string`; D26, §8 Q4); `NavItemOwnProps` gains `actions`; `TagPickerProps['options']` is optional; `TagPickerOption` gains `media` and `secondaryContent` and is also the value of the flat name of `TagPicker.Option`; `TagPickerLabels` gains `create`, `clear`, `expand`, `overflowCount`; `SwatchPickerProps['focusMode']` is typed `FocusMode` and `AccordionHeadingLevel` is `HeadingLevel` (the same unions); `typeof Drawer`, `typeof Nav` and `typeof TagPicker` gain members; `ListboxSurfaceProps` gains `listProps`.
- **Deprecated:** `wave-tag-picker__control` and `wave-tag-picker__group` stay on their elements next to `wave-tag-picker-control` and `wave-tag-picker-group` until 1.0 (Phase 3 D8). A notice that the optional `details` arguments become required in 1.0 (P13-03), unchanged.
- **Fixed:** `useRovingTabIndex` gives every element it stamped its own `tabindex` back when its container detaches or `manageTabIndex` turns off (a TagGroup switched to `role="list"`, a NavDrawer body switched to `focusMode="tab"` kept every item but one out of the Tab order); Tag's Dismiss hover was almost invisible on the default tag (`subtle-pressed` on `muted`, 1.05:1 in light), and is `muted-hover` (1.16:1, with a pressed step); a TagPicker remove button that has focus when the picker is disabled keeps it, unavailable, until focus leaves (focus fell to the page).
- **Size:** against 0.10.0 as published on npm, measured the way 0.8.0 to 0.10.0 were: `dist/styles.css` as built, and minified Vite builds of an entry that imports from `dist/index.mjs`, bare imports external, with `measure-size.mjs` (saved from `docs/superpowers/plans/2026-09-26-fluent-parity-phase-3-d-docs.md:347-409` under `node_modules/.cache/wave-docs/`; 0.10.0 fetched with `npm pack @mortenbrudvik/waveui@0.10.0`). DOCS first checks that the script reproduces 0.10's published rows (`dist/styles.css` 68.0 KiB, Button 10.9 KiB) under Vite 8 (`rollupOptions` is rolldown's legacy spelling). Rows: `dist/styles.css`; only `Button`; only `Tag`; only `TagGroup` (new); only `InteractionTag` (new); only `TagPicker` (0.10: 51.8 KiB, 18.4 KiB gzip; now holds Tag and TagGroup); only `Combobox` (must not grow from Phase 6); only `Dialog` and only `Drawer` (both now hold the presence core); only `Nav`; only `NavDrawer` (new); only `Hamburger` (new); only `Toaster`; everything. Notes: the Button-only and Toaster-only bundles do not change (§6.2), and why the grown rows grew.

### 5.2 README

- **Counts** (D16): `README.md:3` and `:474` say 78 components; the color-token summary (`:212`) says 68.
- **Components** table: rows for `TagGroup` and `InteractionTag` (Data display), `NavDrawer` and `Hamburger` (Navigation); the `Tag`, `TagPicker`, `Dialog`, `Drawer` and `Nav` rows rewritten with their new props and parts (the handoff texts of each package are the source).
- **Server Components:** the compound list (`:371`) gains TagGroup's tags, InteractionTag's parts, TagPicker's parts, the Drawer parts, Nav's new parts and NavDrawer's parts; the SSR bullet (`:373`) gains "An inline `Drawer` or `NavDrawer` renders in the server HTML: open, or hidden when kept mounted"; the flat-name table (`:441-470`) gains `InteractionTag`, `NavDrawer` and `TagPicker` rows and the new `Drawer` and `Nav` members.
- **Usage notes:** "Tags" (`:1636`) leads with TagGroup (a dismissible filter bar with `fallbackFocusRef`; selectable chips with InteractionTag; the look and slots; a short standalone recipe; Fluent's `selectedValues`/`onTagSelect`/`hasSecondaryAction`); a new "TagPicker parts and free tagging" after "Filtering and async search" (the people picker with Avatars, the defaults rule, the direct-children rule for `TagPicker.List`, keeping selected options rendered, routing in the parts form, the create option and a controlled `onOptionCreate` example, the exact-match rule, `clearable`, `overflow="count"`, `TagPicker.Button`), and "Filtering and async search" points to `allowCreate` for a create entry; "Dialogs and triggers" (`:1365-1434`) gains Non-modal, Backdrop, Close button, Title actions, sizes `large` and `full` (with the issue #4 recipe kept), and a pointer to "Drawers"; new "Drawers" (layout and sizes, `bottom`, header, body and footer parts, separators, the `form` attribute, inline drawers, kept mounted, motion hooks) and "Navigation" and "Navigation drawers and app shells" (after "Trees", `:1747`: the parts, actions, the list rule; composition, `type` and the responsive switch, the outer Hamburger recipe with `finalFocusRef`, closing an overlay on selection, landmark naming, `focusMode`, the default width and `className="w-65"`, SSR); "Enter and exit motion" (`:1463-1515`) adds Dialog and Drawer; "Toasts" (`:1572`) says they move beside a side drawer and above a bottom one, modal or not, and keep their corner next to an inline one; "Slots" (`:1793-1818`) adds `closeButton` to the dismiss rule, TagPicker `expandIcon` to the optional indicators, `Hamburger.icon` to the required indicators, the children of `InteractionTag.Secondary` to the glyph rule, the `backdrop` slot, and Tag's `media`/`icon` as content slots; "Sizes" (`:749`) says TagPicker's tags are one Tag size below it; "Routing" (`:859`) adds TagPicker's trigger parts; "Pickers of your own" (`:992`) adds `TagPicker.Option` and `listProps`.
- **Built-in text** (`:1820-1857`): rows `InteractionTag.Secondary` | `dismissLabel` ("Dismiss", with the primary text); `TagPicker` `labels` gains `create(text)` ("Create "{text}""), `clear` ("Clear selection"), `expand` ("Show options"), `overflowCount(count)` ("+{count}"); `Hamburger` | `aria-label` ("Navigation", only while it has no other name); `NavDrawer` | `aria-label` ("Navigation"); the `Dialog.Content`, `Drawer` `closeLabel` row adds "also the Close button of each `Drawer.HeaderTitle`; a text label of a button merged into `closeButton` names it instead".
- **Keyboard support** (`:1859-1894`; "As implemented in 0.10" → 0.11): rows **TagGroup** (one Tab stop, Toolbar's arrow keys along `orientation`, mirrored in RTL, Home/End; Delete or Backspace dismisses; focus after a removal; Space or Enter toggles an InteractionTag in a selecting group; `role="list"`: every control a Tab stop, no arrows), **InteractionTag** (two Tab stops; in a TagGroup both join its arrow order; Delete or Backspace on either dismisses), **Tag** (the Dismiss button: Enter, Space, Delete, Backspace); the "Combobox, TagPicker, TimePicker" row's TagPicker sentence (tag keys, the next tag else the input after a removal, the exact match, the create option, `TagPicker.Button`, the chevron is not a Tab stop, the clear button is); **Dialog, Drawer (non-modal)** (focus moves in; Tab leaves in page order after the opener; Escape from inside; the trigger toggles; focus returns only from inside), **Drawer (inline)** (no trap; the trigger toggles; Escape does not close it; focus returns to the trigger only from inside), the "Dialog, Drawer" row qualified as modal and alert and ordered header → body → footer; **Nav** (every entry a Tab stop, actions after their item), **NavDrawer** (overlay as Drawer; inline as page content; the inner Hamburger toggles), **NavDrawer.Body (`focusMode="arrow"`)** (one Tab stop at the current page; both arrow pairs, wrapping; Home/End; footer items stay Tab stops).
- **Upgrading from 0.10** (new section above "Upgrading from 0.9"): the §5.1 list.

### 5.3 CLAUDE.md

- **What is this** (`:5`): 74 → 78 components. The spec sentence (`:7`) gains "and the 0.11 design, `docs/superpowers/specs/2026-10-17-fluent-parity-phase-6-design.md` (tags, drawers and the app shell; its rulings are behind the 0.11 parts of C-CLASS, C-MOTION, C-POPUPS, C-SLOTS and C-DISABLED below)".
- **Architecture**, component-private helpers: `tagStyles.ts` (the metrics and looks of Tag, InteractionTag and TagPicker's tags; `tagRootClasses`), `TagGroup.context.ts` (the TagGroup context, the module-only host seams `TagGroupHostContext` and `TagHostContext` of TagPicker, the tag item hook with focus after a removal; imports no component), `Avatar.context.ts` (`AvatarSizeContext`), `button/Toolbar.navigation.ts` (`TOOLBAR_ITEM_SELECTOR`, `useToolbarNavigation`: the arrow-axis rule of Toolbar and TagGroup); `InteractionTag.tsx`; the Drawer split sentence ("Drawer is split with one-way imports (nothing imports `Drawer.tsx`): `Drawer.context.ts`, `Drawer.parts.tsx`, `Drawer.root.tsx`, `Drawer.scroll.ts` (`useScrollState`, the separator classes) and `Drawer.panel.tsx` (`DrawerPanel`, the panel shell NavDrawer also renders)"); `Dialog.slots.tsx` (`ModalCloseButton`, `ModalBackdrop`, `useBackdropAppearance`); `Dialog.shared.tsx` adds the trigger toggle with `popup` and `useModalOpener`; the TagPicker split sentence (`TagPicker.root.tsx`, `.context.ts`, `.parts.tsx`, `.option.tsx`, `.overflow.ts`, `.create.ts`); the Nav split sentence (`Nav.context.ts`, `Nav.root.tsx` with `useNavRootState`, `Nav.parts.tsx`; `NavItem`/`NavSubItem` pinned in `Nav.tsx`); `NavDrawer.tsx`, `NavDrawer.context.ts`, `Hamburger.tsx`; `Option.tsx`'s entry "`ListboxSurface` (with `listProps`)"; `Combobox.expand.tsx`'s entry adds `dimDisabled`.
- **Hooks:** internal list: "`useRestoreFocus` (with `onlyIfFocusInside`, `requireFocusInside` and `isHoverClose`)", "`useFocusTrap` (with `useInitialFocus`)", "`useModalLayer` (with `modalType`)"; public `useRovingTabIndex` adds "it hands every element it stamped back when its container detaches or `manageTabIndex` turns off".
- **`src/lib`:** `types` adds `HeadingLevel`, `FocusMode`, `TagSize`, `TagAppearance`, `TagShape`, `SurfaceSize`, `BackdropAppearance` (and `ModalType`'s three values); `layers` adds the `'dialog'` kind, Escape `'inside'` and `hasIsolatingModalBelow`. The "Internals stay module-only" list adds `tagStyles`, `TagGroup.context`, `Avatar.context`, `Toolbar.navigation`, `Drawer.panel`, `Drawer.scroll`, `Dialog.slots`, `Nav.context`, `useNavRootState`, `NavDrawer.context`, `TagPicker.context`, `TagPicker.overflow`, `TagPicker.create`.
- **C-CLASS:** the enumerated examples add `data-type="overlay"`, `data-scroll-state="none"`, `data-appearance="dimmed"`, `data-focus-mode="tab"`, `data-overflow="wrap"`; the boolean ones `data-separator`, `data-collapsed`, `data-create`; the closing sentence adds "Tag, TagGroup and InteractionTag render `data-size`, `data-appearance` and `data-shape` (TagGroup also `data-orientation`); Dialog.Content `data-size`; the Drawer panel `data-type`, `data-position`, `data-size` and, overlay, `data-modal-type`; backdrops `data-appearance`; NavDrawer.Body `data-focus-mode`; drawer headers, bodies and footers `data-scroll-state`".
- **C-MOTION:** "Surfaces added from 0.7, and Dialog and Drawer from 0.11, mount through `usePresence`"; "No component ships enter or exit classes yet (`Menu.Popover`, `Dialog.Content` and `Drawer` accept a consumer's)"; "every top-level element of a portal carries the presence attributes".
- **C-POPUPS:** "Dialog/Drawer use `useModalLayer` only" becomes "Dialog and overlay Drawers (and NavDrawers, through `DrawerPanel`) use `useModalLayer` only, with `modalType`: a non-modal surface registers the `'dialog'` layer kind with `escape: 'inside'` and takes its Tab place after its opener through `usePopoverTabOrder`; an inline Drawer calls `useRestoreFocus` with `requireFocusInside`, and no other modal hook".
- **C-SLOTS:** the dismiss/clear list adds "`Dialog.Content`/`Drawer` `closeButton` (a Wave Button)"; the optional indicators add "TagPicker `expandIcon`"; the required indicators add "`Hamburger.icon`"; the glyph-in-a-wired-button list adds "the children of `InteractionTag.Secondary` (it is itself the button)"; a sentence on `backdrop` ("booleans are no slot, `null` renders none, `appearance` picks the fill"); Tag's `media` and `icon` are content slots.
- **C-DISABLED:** "A tag control disabled while it has focus (Tag's Dismiss button, InteractionTag's buttons) keeps it: `focusableDisabledProps(true, { reachable: true })` until it loses focus, then the native `disabled` (D25). A field that dims as a whole (TagPicker's control) keeps the controls inside it from dimming again (`dimDisabled` of `PickerExpandButton` and of TagGroup's host options)."
- **C-ROUTING:** "A composite with trigger parts (TagPicker) sends them to whichever trigger renders (`TagPicker.Input` or `TagPicker.Button`)."
- **C-DEV:** the value-keyed compounds add TagGroup, and Nav and NavDrawer (one model, `useNavRootState`).
- **C-COMPOUND:** "Nav's walks recognise its items and categories by a marker (`markNavPart`), so a Nav root needs no import of them (the `markFieldLabel` pattern)."
- **Testing:** backdrops are the surface's siblings (query them by their constant, never through `parentElement`); TagGroup's focus after a removal is asserted after a microtask, and a held key is `fireEvent.keyDown(el, { key: 'Delete', repeat: true })`; TagPicker removals: a pointer click has `detail > 0`, a keyboard one `detail: 0`; count mode is measured with `installResizeObserverMock` and stubbed widths; drawer scroll state: stub `scrollHeight`/`clientHeight`/`scrollTop` and `fireEvent.scroll` in `act`; kept-mounted surfaces: `{ hidden: true }` while closed and no `autoFocus` inside; Nav lists: render only parts or `<li>` there; an arrow-key NavDrawer body: assert the stamps after mount, never in the server HTML; responsive app shells: `mockMatchMedia({ '(max-width: 767px)': true })` (`NavDrawer.appShell.test.tsx` composes the AppShell story).

### 5.4 Guide and testing guide

- `docs/WAVE-UI-GUIDE.md`: the catalog heading (`:2038`) says 78 components; the token tables (`:229`, `:281`, `:322`) gain the four fill states and their roles; the built-in text list (`:1541`) gains InteractionTag, TagPicker, Hamburger and NavDrawer; the dismiss-slot rule (`:635`) adds `closeButton` and the Secondary's unwrap; the presence chapter's "Where it is used" (`:444`) adds Dialog and Drawer (both `unmountOnClose` modes); the "Dialog and Drawer" keyboard block (`:1377-1386`) splits modal and alert, non-modal and inline; the ARIA section (`:1433-1442`) adds the non-modal (no isolation, no `aria-modal`) and inline (`<aside>`) structures; focus management (`:1515-1517`) adds `requireFocusInside`; the Navigation accessibility pattern (`:1444-1457`) adds headings in list items, the decorative divider, actions beside the link, and `focusMode`; the Sidebar example (`:1749-1775`) becomes the app-shell pattern (Toolbar with a Hamburger, NavDrawer, inline Drawer, `finalFocusRef`, the breakpoint rule); "Categorize items" (`:2017`) and "Pick multiple items" (`:2010`) add TagGroup, InteractionTag and TagPicker's parts; new pattern notes "Focus after removing an element that has it" (record in a layout cleanup, move in a microtask) and "Compound parts that render defaults" (TagPicker).
- `docs/testing-best-practices.md`: focus after a removal (microtask) and key repeat; a control disabled while focused (rerender while focused, then Tab away); the Toolbar × TagGroup matrix pattern; pointer versus keyboard removals (`detail`); the status region after every `act` (the registration commit of the create option); count-mode measurement; parts-form `testSystemProps` with a `wrapper`; the backdrop lookup by constant; scroll-state stubs; kept-mounted queries and the `autoFocus` artefact; `mockAnimations` with `data-test-motion` on a Dialog surface or a Drawer panel; the title-actions measurement next to the `Dialog.Footer` ResizeObserver recipe (`:442`); the arrow-body recipe (stamps after mount, `data-roving-value` from React); the list-child warning; the App shell recipe (`composeStories` + `mockMatchMedia` in `act`).

### 5.5 ROADMAP

- **Header:** a "**Phase 6 design:**" bullet after the Phase 5 bullet (`:10`), linking this spec ("0.11.0, implemented"); the status line (`:3`) marks Phase 6 released only in the release commit, as for Phase 5.
- **Phase 6 sketches** (D18): P6-01's "`value?` and `selected?` (used by TagGroup)" → "`value?` (TagGroup's key) and `selected?` (a look; InteractionTag carries the pressed state)"; P6-02's "with selection it is `role="listbox"` with APG listbox keys" → "selection is `aria-pressed` toggles on `InteractionTag.Primary` in the toolbar; `role="list"` for static tags; no listbox mode", plus `shape`, `fallbackFocusRef`, `name`/`form`/`required`, deselect on dismiss, and "axe for both roles" → "axe for the toolbar and list roles"; P6-03 drops `hasSecondaryAction` and names the Secondary "Dismiss <primary text>"; P6-04's `.Group` is a TagGroup list, focus after a keyboard removal goes to the next tag else the trigger, the root gains `clearable`, `expandIcon` (also on `TagPicker.Control`) and `overflow`, `labels` gains `clear`, `expand`, `overflowCount`, the create option also hides for a selected value or an option value equal to the text, the option whose label equals the text becomes active, each part renders defaults, the entries gain `media` and `secondaryContent`, the chevron shows by default; P6-05: "a flex row below the body (D74; P1-21's technique stays the Dialog's)", `Drawer.Body`, the Close button of `Drawer.HeaderTitle`, `headingLevel`, the bottom border, `data-position`/`data-size`/`data-scroll-state`, the guard "beside a side Drawer and above a bottom one (`--wave-toaster-offset-block`)", and "Depends on: P1-21" informational; P6-06 drops the `'focus-outside'` reason (D88 supersedes it and Phase 1 D9's plan), types `closeButton?: Slot<'span'>`, says every trigger toggles, names the `'dialog'` layer kind and the backdrop's `appearance`, and dims once for stacked siblings; P6-07: the `<aside>` named by its title after the Drawer's direct triggers, the element types widened to `HTMLElement`, `hidden` and `inert` on every top-level element, presence for every Dialog and Drawer (amends Phase 2 D4), the trigger toggles inline drawers without `aria-haspopup`, kept-mounted overlays move to the top of the stack when they open, inline drawers do not move toasts, the package ends with the panel shell; acceptance adds no dismiss layer, isolation or scroll lock for the inline type and focus returning only from inside; P6-08: "NavDrawer (Nav's state, `useNavRootState`, and a `<nav>` landmark in the drawer panel shell of P6-05 … P6-07, not a public-Drawer wrapper)" with its defaults, `focusMode` (default `'tab'`), the Hamburger's name and wiring, acceptance additions (SSR of an open inline NavDrawer, RTL, a `type` switch keeps the selection and open categories, the outer Hamburger gets focus back through `finalFocusRef`, StrictMode `onOpenChange` once, the stories gate audits the app shell's inline layout) and "Depends on: P6-05, P6-06, P6-07, P6-09, P1-24"; P6-09: `Nav.Divider` is `<li aria-hidden="true">`, `Nav.SplitItem` is `actions` on `Nav.Item` and `Nav.SubItem`, `Nav.AppItemStatic` joins, every list child is an `<li>` (a development check), the first task splits `Nav.tsx`. §6's epic graph is unchanged (6.2 → 6.3 and 1.5 → 6.3 exist).
- **§7** rows: Drawer (`:1133`) "sizes, bottom, header, body and footer parts (P6-05); non-modal and alert (P6-06); inline, kept mounted (P6-07)"; Dialog (`:1138`) adds "backdrop appearance"; Nav (`:1136`) "NavDrawer and Hamburger (P6-08); Nav parts and item actions (P6-09)", with "SplitNavItem (→ `actions`)" in the Fluent column.
- **§8.1 counts** are unchanged: every Phase 6 id closes as planned, none rides along, none becomes an intentional difference (142 high and medium, 333 low with 212 closed by items and 121 in the backlog). The mitigation bullet (`:1164`) says `taggroup-1`, mitigated by P1-15, is closed by P6-02 (0.11), leaving `badge-1` and `buttons-29` mitigated early.
- **§8.2** backlog additions without ids: an opt-in light dismiss for non-modal surfaces (`'outside-press'`/`'focus-outside'`); an effective-open context so popups inside a closing kept-mounted surface close with it (Phase 7); a helper that wires an outer Hamburger to a NavDrawer (`useNavDrawerToggle`); tags: `disabledFocusable`, a polymorphic `InteractionTag.Primary`, TagGroup single selection and Field wiring; TagPicker: `noPopover`, a `secondaryAction` slot, `disabled` option entries, a `details` argument on `onOptionCreate`. P10-01's sketch (`:852`) adds "Nav item actions (fade, Fluent's 150ms)".
- **§8.3** gains "Behaviour differences decided by the Phase 6 spec (0.11.0), with no gap of their own" (D12):
  - Tags: Tag keeps a separate Dismiss button after its content (Fluent: the dismissible Tag is one button; D28); Tag's medium is 28px (Fluent 32px), and Tag and InteractionTag default to `circular` (Fluent `rounded`; D21, D23, D46); a Tag's `selected` is a look only, and an InteractionTag's `selected` outside a selecting TagGroup renders `aria-pressed` (Fluent: a look only; D26, D45); Delete and Backspace dismiss outside a TagGroup too, on a Primary with a Secondary and on a focused link chip, and a held key dismisses one tag (D33); focus moves after a removal only when the focused tag goes, to the corresponding control of the next (else previous) tag, else `fallbackFocusRef` (Fluent: in `onDismiss`, whether or not the tag goes, no fallback; D35); dismissing a selected InteractionTag also deselects it (D39); a selecting TagGroup submits its values with `name` (D40); `InteractionTag.Secondary` is named "Dismiss <text>" and honours a plain `aria-label` (Fluent "<text> <label>"; D43); no `hasSecondaryAction` (D44); a tag control disabled while it has focus keeps focus until it leaves (D25).
  - TagPicker: `TagPicker.Group` is a list whose remove buttons are each a Tab stop (Fluent: a listbox of one-button tags with one Tab stop; D53); after a keyboard removal focus moves to the next tag, else the trigger, never the previous tag, and only when the tag goes (D56); the arrow keys move between tags and the last one returns to the trigger, mirrored in RTL (Fluent: ArrowRight on any tag goes to the trigger; D57); a pick by click keeps the list open (D58); free tagging is a create option at the end of the list (D59); `TagPicker.Button` stays visible as the click area once a tag is selected (D63).
  - Drawers and dialogs: Drawer's `position` defaults to `end` (Fluent `start`, since 0.5); `Drawer.HeaderTitle` renders the built-in Close button (D75); header, body and footer are `<div>`s (Fluent `<header role="none">`/`<footer role="none">`; D76); `Drawer.Footer` renders after the body wherever it is written (D71, D74); scroll state is a `data-scroll-state` attribute (D80); a bottom drawer draws a top border (D79); `headingLevel` cannot make the heading a `div` (D83); a non-modal surface's Tab place follows its opener (D87); Dialog and Drawer triggers toggle (Fluent's `DialogTrigger` never does; D89); the dim-once rule covers modals stacked beside each other (D94); modal and alert dialogs keep a built-in Close button (Fluent: none by default; D95); an inline drawer is an `<aside>` named by its title and returns focus itself (D100, D101); kept-mounted surfaces are `hidden` and `inert` (Fluent: `aria-hidden` and `pointer-events: none`; D102); drawers stay usable uncontrolled with `Drawer.Trigger` (Fluent's OverlayDrawer is controlled only).
  - Navigation: `Nav.Divider` is hidden from assistive technology (Fluent: a separator; D116); SplitNavItem's fixed slots are one `actions` area of your own controls (D119); NavSectionHeader's `as` is `headingLevel` (D115); NavDrawer.Body defaults to Tab stops, its arrow mode starts at the current page and takes both arrow pairs (Fluent: arrow keys by default, Up/Down, the first element; D130); an overlay NavDrawer is a dialog named like the `<nav>` inside it (Fluent: `role="navigation"` with `aria-modal`; D125); NavDrawer's default size is `small` (320px, with `data-size`; Fluent 260px while unset), its `position` defaults to `start` while Drawer keeps `end`, and an inline NavDrawer draws its separator by default on the page background (Fluent: none, on a tinted pane; D126); Hamburger is `subtle`, named "Navigation" and wires itself inside a NavDrawer (Fluent: no name, no wiring; D132, D133).
  - `buttons-22` already lists TagGroup: unchanged.

### 5.6 `docs/FLUENT-UI-COMPARISON.md` and the gap report

- The comparison guide: the "Compared" line and every "WaveUI 0.10" column header → 0.11; the "Related documents" counts (0.6 to 0.11 closed 199 of the 475 gaps; 0.11 closed 40); `:51` drops "TagGroup and a composable TagPicker, InlineDrawer and NavDrawer, non-modal dialogs" from "not in WaveUI yet"; the motion paragraph (`:180`) adds Dialog and Drawer to the surfaces that mount through the core; the Tag, TagGroup and InteractionTag rows and prose (`:533-543`), the TagPicker row and prose (`:503`, `:514`), the Drawer rows and prose (`:576-585`), the Dialog rows (`:607`, `:613`: "pass `closeButton={null}` and keep yours, or drop yours"), the Nav and NavDrawer rows (`:595-596`), §7's rows (`:709-710`), the refs row (`:380`), the callbacks table (`TagGroup onTagSelect(ev, { value, selectedValues })` → `onValueChange(values)`, `TagGroup onDismiss(ev, { value })` → `onDismiss(value)`, `onOptionCreate(text)` with no Fluent counterpart), the slots note (`:389`) and §3.10's forms (TagGroup submits with `name`). Migration notes: `selectedValues`/`defaultSelectedValues` → `value`/`defaultValue`; `hasSecondaryAction` not needed; the Secondary's name order; InteractionTag's default shape; TagPicker's `disableAutoFocus` is not needed (no option is active on open; while typing, the exact match, else the first match), `noPopover` and `secondaryAction` are not in 0.11 (`clearable` is the clear-all action), `inline` and `positioning` come with 0.12, `TagPickerOption text` → `label`; `InlineDrawer`/`OverlayDrawer` → `Drawer type`, OverlayDrawer's controlled-only use against `Drawer.Trigger`, `DialogTrigger action` against the toggle, `backdrop.appearance` keeps Fluent's name, `DrawerHeaderTitle heading` → `headingLevel`; `tabbable` → `focusMode` (inverted default), `selectedValue`/`onNavItemSelect` → `value`/`onValueChange` also on NavDrawer, `role="navigation"` on Fluent's drawer against WaveUI's dialog plus `<nav>`, `NavDivider` → the decorative `Nav.Divider`, `NavSectionHeader as` → `headingLevel`, `AppItem as="a" href` → `Nav.AppItem href`, SplitNavItem's buttons and tooltips → your own Button, ToggleButton, MenuButton and Tooltip in `actions`, Hamburger's defaults, NavDrawer's default width (`className="w-65"` for 260px), `density` not yet.
- The gap report (`docs/research/fluent-ui-v9-comparison.md`, a dated snapshot): only the missing ids are written, as Phase 5 wrote two: prose entries for `taggroup-1`, `taggroup-2` and `taggroup-3` (the split of §7, inferred from §3 row 8, `:372`), and the ids `drw-7` (InlineDrawer) and `drw-11` (DrawerFooter) in §3. No other change.

---

## 6. Verification and exit criteria

### 6.1 Per package

Every package (rule 8, with `export PATH=/opt/node24/bin:$PATH`): `npx vitest run <own test files> --reporter=default` with clean output (no act() warnings, every `[WaveUI]` warning asserted, `assertOverlayStateReleased` and the empty-body check green); the conventions gate for every file it owns (`npx vitest run src/__tests__/conventions.test.ts -t "<file>"`) and the stories gate for its stories (`-t "Components/<Category>/<Name>"`); `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.dev.json --noEmit` filtered to its paths (with its folder's barrel, Phase 3 rule 22); `npx eslint <files>` and `npx prettier --check <files>`; `node scripts/build-css.mjs` when it added JSDoc or strings under `src/components` or `src/lib` (rule 32). Before each seam freeze (rule 28) the owner runs the full `npm test` once. Wave A also meets §1.14.

### 6.2 `verify-dist` probes (INTEGRATION)

Every probe through the generic `probeTreeShaking` and `probeIncludes` (no new helper), each with its unit case in `verify-dist.test.mjs`:

1. **Flat names** (the bridge closed): `DrawerHeader`, `DrawerHeaderTitle`, `DrawerHeaderNavigation`, `DrawerBody`, `DrawerFooter`, `NavSectionHeader`, `NavDivider`, `NavAppItem`, `NavAppItemStatic`, `NavDrawerHeader`, `NavDrawerBody`, `NavDrawerFooter`, `InteractionTagPrimary`, `InteractionTagSecondary`, `TagPickerControl`, `TagPickerGroup`, `TagPickerInput`, `TagPickerButton`, `TagPickerList`, `TagPickerOption`, `TagPickerOptionGroup` exist in `dist/index.mjs` and `dist/index.cjs`, each equal to its dotted member (`TagPickerOptionGroup === OptionGroup`), each with JSDoc in `dist/index.d.ts` (`NavAppItem`'s through its first overload); `TagGroup`, `InteractionTag`, `NavDrawer` and `Hamburger` exported with JSDoc.
2. **Tags:** `TAG_ONLY = { keep: 'Tag', drop: 'TagPicker', dropModules: ['components/data-display/TagGroup.mjs', 'components/data-display/InteractionTag.mjs', 'components/data-display/Avatar.mjs', 'components/button/Toolbar.navigation.mjs', 'hooks/useListbox.mjs'], keepStrings: ['wave-tag'], dropStrings: ['wave-tag-group', 'wave-tag-picker'] }`; `TAGGROUP_ONLY = { keep: 'TagGroup', drop: 'TagPicker', dropModules: ['hooks/useListbox.mjs', 'components/input/Option.mjs'] }`; `INTERACTIONTAG_ONLY = { keep: 'InteractionTag', drop: 'TagGroup' }`.
3. **TagPicker:** `COMBOBOX_ONLY = { keep: 'Combobox', drop: 'TagPicker', dropModules: ['components/input/TagPicker.root.mjs', 'components/input/TagPicker.parts.mjs', 'components/input/TagPicker.option.mjs', 'components/data-display/TagGroup.mjs', 'components/data-display/Tag.mjs'], dropStrings: ['wave-tag-picker-list'] }`; `probeIncludes({ keep: 'TagPicker', modules: ['components/input/TagPicker.parts.mjs', 'components/input/TagPicker.option.mjs', 'components/data-display/Tag.mjs', 'components/data-display/TagGroup.mjs'] })`; `dist/index.d.ts` and `dist/index.d.cts` declare both `interface TagPickerOption` and the value `TagPickerOption`.
4. **Overlays:** `probeIncludes({ keep: 'Dialog', modules: ['hooks/usePresence.mjs'] })` and `{ keep: 'Dialog', drop: 'Drawer', dropModules: ['components/overlays/Drawer.root.mjs', 'components/overlays/Drawer.panel.mjs'] }`; `probeIncludes({ keep: 'Drawer', modules: ['components/overlays/Drawer.panel.mjs', 'hooks/usePresence.mjs'] })` and `{ keep: 'Drawer', drop: 'Dialog' }` (Drawer reaches only `Dialog.shared` and `Dialog.slots`); `{ keep: 'Toaster', drop: 'Drawer', dropModules: ['components/overlays/Dialog.mjs', 'components/overlays/Dialog.shared.mjs', 'components/overlays/Drawer.root.mjs', 'components/overlays/Drawer.panel.mjs'] }` (the offset reads `lib/layers` only). The Button-only probes are unchanged (no Dialog code, no presence core, the opt-in modules dropped).
5. **Navigation:** `NAV_ONLY = { keep: 'Nav', drop: 'NavDrawer', dropModules: ['components/overlays/Drawer.panel.mjs', 'hooks/useModalLayer.mjs', 'hooks/useRovingTabIndex.mjs'], keepStrings: ['wave-nav'], dropStrings: ['wave-nav-drawer', 'wave-hamburger'] }`; `HAMBURGER_ONLY = { keep: 'Hamburger', drop: 'NavDrawer', dropModules: ['components/overlays/Drawer.panel.mjs', 'hooks/useModalLayer.mjs', 'components/navigation/Nav.root.mjs'], keepStrings: ['wave-hamburger'], dropStrings: ['wave-nav-drawer'] }`; `NAV_DRAWER_ONLY = { keep: 'NavDrawer', drop: 'Drawer', dropModules: ['components/overlays/Drawer.root.mjs', 'components/overlays/Drawer.parts.mjs', 'components/navigation/Nav.mjs'] }` and `probeIncludes({ keep: 'NavDrawer', modules: ['components/overlays/Drawer.panel.mjs', 'components/navigation/Nav.root.mjs', 'hooks/usePresence.mjs', 'hooks/useRovingTabIndex.mjs'] })`.
6. **Module-only names** (§4.5's list) are absent from `dist/index.*`.
7. **`"use client"`:** the existing per-module check covers every new module under `src/components` (`Toolbar.navigation`, `Avatar.context`, `tagStyles`, `TagGroup.context`, `Drawer.context`, `Drawer.scroll`, `Nav.context`, `NavDrawer.context`, `TagPicker.context`, `TagPicker.overflow`, `TagPicker.create`, …).
8. **Declarations:** `REQUIRED_DECLARATIONS` gains `TagGroup` and `NavDrawer`, with the fixture `DTS` of `verify-dist.test.mjs` (`:69-77`) and its `it.each` (`:1594-1607`).

### 6.3 Final gate (wave F) and real-browser checklist

The roadmap §3 exit criteria through `/gate` (`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run check:package`, `npm run test:pack`, `npm run build-storybook`), plus the gate script's CHANGELOG, README and CLAUDE.md checks. Real browsers (Chromium, Firefox, Safari where available; NVDA with Firefox or Chrome, JAWS with Chrome, VoiceOver with Safari on macOS and iOS, TalkBack, Narrator where noted; an iPhone and an Android phone), through `/browser-check` in Storybook, since jsdom cannot:

1. **Tag metrics and slots:** the three sizes measure 28, 24 and 20px in every appearance and shape, filled, outline and brand tags of one size share a box, and a 0.10-classed tag lines up with a 0.11 default one; media, icon, text, secondary text and Dismiss order and spacing in LTR and RTL, no gap for absent parts, long text wraps and grows the tag, the two-line layout fits at 100 % and 200 % zoom and with WCAG 1.4.12 text spacing; Avatar media at 24, 20 and 16px centred with a 2px inset, initials legible at 16px, a `PresenceBadge size="extra-small"` in the corner.
2. **Tag targets, rings and states:** Dismiss and InteractionTag buttons have 24×24px targets (a click 2px outside the visible circle hits; two rows of extra-small tags do not overlap targets; touch); focus rings visible on every look (primary-foreground on selected tags, inside the tag at extra-small, the InteractionTag ring above its neighbour, a held disabled control's ring at full opacity); hover and pressed steps visible in light, dark and high contrast for filled, outline (on a page, a card and a `filled-darker` field) and brand tags; a custom `--brand-*` ramp recolours brand, its states and the selected look.
3. **Tag focus and keys:** in Chrome, Firefox and Safari, Enter, Space, Delete and Backspace removals never leave focus on `<body>` and the moved-to control shows its ring; a pointer dismissal focuses the next tag in Chrome and Firefox and moves nothing in Safari; holding Delete dismisses one tag; Backspace on macOS dismisses without history navigation; IME composition in a nearby field is unaffected; disabling a Tag, an InteractionTag or a TagGroup while one of its controls has focus keeps focus (announced unavailable), Tab leaves, and the control is then skipped.
4. **TagGroup:** `:has()` corner squaring of a Primary next to a Secondary and the full radius without one (also when the Secondary renders conditionally), LTR and RTL; a wrapping group (ArrowRight crosses lines in DOM order, wraps at 390px) and a vertical group; the native validation bubble of a `required` empty selecting group points at it and focus lands on its Tab stop (Chromium, Firefox); a Popover opened from an `InteractionTag.Primary` keeps its keys and returns focus; hydration shows no mismatch and the roving Tab stop appears after it.
5. **TagPicker:** the expand and clear buttons sit on the first row of a wrapped field at every size × appearance, LTR and RTL, with 0, 1 and 2 buttons, never over a tag or the typed text; `overflow="count"` hides tags exactly when they no longer fit, "+N" fits, Tab, Shift+Tab into the tags, a click on the chip or the field expands, leaving collapses, without flicker (resize, 200 % zoom, RTL; a very long first tag is clipped); IME (Japanese, Chinese): the Enter that ends a composition does not create, the composed text shows the create option; a double click on a remove button removes one tag and focus lands in the input; Safari's no-focus-on-click path; a press on the field's empty area toggles the list without the input losing focus; 24×24px touch targets; an on-screen keyboard's Enter creates; the people-picker story's Avatars per tag size and in options, the second line wraps, the list as wide as the field; a disabled picker dims once and a held remove button shows an undimmed ring; `TagPicker.Button`'s Space does not toggle twice, its focus underline, typeahead; a server-rendered parts form hydrates without a mismatch and shows the options' labels.
6. **Drawer layout:** widths at 1440px (320, 592, 940px, the viewport) and at 390px (every size fills the width); bottom heights at 1440×900 and 390×844; `full` covers the viewport; `start`, `end`, `left`, `right` in LTR and RTL; separators while scrolling (the header line from the first scrolled pixel, the footer line until the end; `bottom` reached at 110 %, 125 %, 150 % zoom and on a HiDPI screen; content growth switches the footer line on); the footer with a thirty-field form (every focused field above the footer; Enter submits through the footer's `form` button); 200 % and 400 % zoom (footer buttons wrap; a `small` bottom drawer at 320×180 CSS px shows its header, some body and the footer); `scrollbar-gutter` (no jump when the page scrollbar disappears).
7. **Toasts and drawers:** bottom toasts above a bottom drawer and back on close; a tall stack that does not fit keeps the corner; side drawers push them sideways; a non-modal end drawer pushes them; an inline end drawer leaves them (the documented overlap); a `start` overlay NavDrawer pushes `bottom-start` toasts; over a `full` Dialog they keep their corner without hiding the footer's primary button at 390px; window resize.
8. **Safe areas (iOS Safari, `viewport-fit=cover`):** drawer footers above the home indicator (side and bottom), a `small` bottom drawer reserves no top inset; `Dialog size="full"` clears the notch and the home indicator in portrait and landscape and keeps `100dvh` with the toolbar shown and hidden; a NavDrawer overlay at 390×844 (full height, backdrop, Escape, a backdrop tap closes, momentum scrolling, the footer above the home indicator).
9. **Non-modal surfaces:** Tab and Shift+Tab between the opener, the surface and the next control in LTR and RTL, from the browser's own controls, with no Tab cycle; Escape from a page field closes nothing and from inside closes; a Popover or Menu inside closes first; screen readers announce a non-modal dialog on open, browse mode can leave it and nothing on the page is hidden; toasts stay announced.
10. **Modal surfaces:** wheel and touch scrolling of a long dialog body work through the positioner's `pointer-events` layer; a press on the visible backdrop closes, a drag from the surface to the backdrop does not; `backdrop={null}` leaves the page undimmed and not clickable, and a press outside closes a modal, not an alert; dim once for a confirm Dialog over a Drawer in both layouts and three themes; title actions (an expand button and a MenuButton before Close in LTR and RTL, the title wraps clear of them at 200 % zoom and with a long translation, Tab order action → Close → body); a merged "Done" Close button announced and voice-activated.
11. **Inline and kept-mounted surfaces:** an inline start and end drawer in a `flex` row of `h-dvh` keep their widths, `max-w-full` on a narrow viewport, their bodies scroll; closing with the Close button returns focus to the trigger in Chrome, Firefox and Safari, a close while focus is elsewhere leaves it; a kept-mounted closed overlay leaves no scrim and a fully clickable page, Tab and the screen reader never reach hidden content, reopening focuses the first focusable element and isolates, typed text, a checked box and a selected tab survive, and **the body's scroll position** across close and reopen (correct the `usePresence` JSDoc and the guide if an engine resets it); `Dialog.Footer`'s measured height is right on the first frame after reopening; a kept-mounted Dialog rendered next to an open Drawer opens above it; a responsive `type` switch with the drawer open leaves no stuck `inert`, releases the scroll lock, puts focus on the trigger, without a layout flash; an open inline drawer is visible before hydration and a kept-mounted closed one hidden.
12. **Consumer motion:** classes on `Dialog.Content` and a Drawer: the gated enter runs on every open (kept mounted too), the exit holds the surface until its motion ends, reduced motion ends both at once; clicks during an exiting backdrop do not reach the page unexpectedly; Escape reaches the layer below during the exit.
13. **Nav parts:** item actions drawn on hover of the row, on Tab and Shift+Tab focus, while their Menu is open and while a pin is pressed, always on touch (iOS Safari, Android Chrome) and in Windows contrast themes, with no layout shift; focus returns to an action after its Menu closes (Escape and an item click) and after a Dialog opened from it closes; tooltips on icon-only actions open on hover and focus; Voice Control and Dragon on transparent actions (record); section headers announced as level-3 headings and reachable by heading navigation, the list's item count (headers counted, the divider not), the divider silent, the actions inside the group named by the item; WebKit's list semantics on `list-none` lists with header and divider items (VoiceOver), in a Nav and in a NavDrawer.
14. **App shell** (Storybook viewport toolbar): inline ↔ overlay across the breakpoint with no stuck `inert`, scroll lock or backdrop, focus ending on the outer Hamburger, no layout flash on first paint (server default inline); inline at 1440px keeps 320px, the body scrolls on its own, header and footer stay pinned, the separators appear and go, long labels wrap; 400 % zoom and 320px reflow with the switch to the overlay; Storybook's a11y panel at both widths (landmarks, `scrollable-region-focusable`, target size).
15. **NavDrawer keys and screen readers:** the landmark ("Main, navigation"), the overlay ("Main, dialog"), `aria-current="page"`, the Hamburger's expanded or collapsed state and `aria-haspopup="dialog"` on the outer one; the arrow body (Down/Right and Up/Left wrap, mirrored in RTL; Home/End; the inset ring on every element; Tab lands on the current page; Shift+Tab from the footer returns to the last focused element; a MenuButton action opens its Menu with Down and Right moves on) in browse and in focus mode; the Hamburger's glyph in the items' icon column at `medium`; the kept-mounted body's scroll position.
16. **Forced colours** (Windows contrast themes, light and dark): tag edges, the selected outline, disabled GrayText, the Dismiss glyph turning Highlight on hover, the InteractionTag divider and rings; TagPicker's create option, tag edges, chip, glyphs, focus indicators and a disabled picker; both drawer separators always drawn, the panels' inner edges (bottom's top edge), an inline panel's edge with and without `separator`, the backdrop, a non-modal surface's border, Dialog `closeButton` and title actions; the Nav divider, a selected row's indicator, the actions, the AppItem's ring; NavDrawer's inline separator, overlay edge, scroll separators and backdrop; the Hamburger's ring and disabled look; the high-contrast theme (`.wave-high-contrast`) for the NavDrawer separator and the selected look on black.
17. **Screen readers on tags and pickers** (NVDA, JAWS, VoiceOver): "Filters, toolbar"; "Dismiss Red, button"; "Thai, toggle button, pressed / not pressed"; the move after a dismissal; a `role="list"` group as a list of N items; an Avatar media read once (or not, with `decorative`); VoiceOver Chrome's "button group" for a Primary with media; TagPicker's "Create "infra"" as the active option and "infra added, N selected" after Enter, no "No matches" while the create option shows, the tag list as "Selected, list, N items", "Remove …", the chevron "Show options, collapsed/expanded", the Button trigger's name, state and summary, the chip silent; a drawer announced with its HeaderTitle, the HeaderNavigation landmark inside the dialog, header, body and footer create no landmarks, an inline `<aside>` listed as a complementary landmark with its title and a kept-mounted closed one not listed.

### 6.4 Existing tests expected to change (update, do not delete)

- **F6-foundation.**
  - `src/lib/__tests__/types.test.ts` › "ModalType is modal or alert" (`:113-116`): three values, the `not.toMatchTypeOf` line dropped (§1.1).
  - `src/__tests__/public-types.test.ts:695` (`ModalType` equals the three values) and `:724-726` (the `@ts-expect-error` becomes a positive assertion); `:434` (`PENDING_PUBLIC_TYPES` filled); the import list and a line for `ListboxSurfaceListProps`.
  - `src/components/overlays/__tests__/Dialog.test.tsx` › "types modalType with the shared ModalType" (`:2142-2148`): the `@ts-expect-error` becomes a positive assertion.
  - `src/__tests__/classNames.test.ts:160` (`PENDING_CLASS_NAMES` filled, its comment); `src/__tests__/integration.test.tsx:204` (`PENDING_FLAT_MEMBERS` filled, its comment); `scripts/__tests__/verify-dist.test.mjs:1322-1332` (the bridge case, §1.5.5).
  - Append-only: `tokens.test.ts` (`TOKENS`, `NOT_TEXT_TOKENS`, `BOUND_TEXT_SURFACES['selected-foreground']`, `CONTRAST_PAIRS`, `TABLED_RATIOS`), `icons.test.tsx` (the `ICONS` row), `test-utils.test.tsx`, `layers.test.ts`, `useDismiss.test.tsx`, `useRovingTabIndex.test.tsx`, `Avatar.test.tsx`, `Option.test.tsx`. Unchanged guards: `Toolbar.test.tsx`, `Toolbar.parts.test.tsx`, `SwatchPicker*.test.tsx`, `Accordion.test.tsx`, `Combobox.test.tsx`, `TimePicker.test.tsx`, `Dropdown.test.tsx`, `Listbox.test.tsx`, `public-types.test.ts:1028`.
- **P6-tags.**
  - `Tag.test.tsx` › "uses logical padding, so the tag is RTL-safe (feedback-navigation#34)": `toHaveClass('ps-3', 'pe-1.5')` → `toHaveClass('ps-2.75', 'pe-1.25')` (D20); the `/\bp[lr]-/` check stays.
  - `Tag.test.tsx` › `Tag stories` › "FilterGroup focuses the next filter after a dismiss, else the previous one, else "Reset filters"": FilterGroup is built on TagGroup, so one Tab reaches "Remove Red" and ArrowRight "Remove Blue" (0.10: two Tabs); the focus moves, the `aria-disabled` assertions and the restore stay.
  - `Tag.test.tsx` › "focus after a keyboard dismiss (the recipe …)": assertions unchanged (a standalone Tag still moves nothing); its comment points to the README's standalone recipe instead of the story's `FilterBar`.
  - `Tag.test.tsx` › `testSystemProps(Tag, …)`: `a11yVariants` grow; `conflictingClass` unchanged.
  - Kept, to verify: "uses theme tokens for the chip (C-TOKENS)", "%s: iconPosition and disabledFocusable take effect on the dismiss button and never reach the DOM", "dismisses from the keyboard", `stableClassNames.test.tsx` › "Tag: root, primary text, dismiss button and the default dismiss glyph" and "Tag: the dismiss icon part is the element `dismissIcon` renders, or a merged Button icon".
- **P6-overlays.**
  - `Drawer.test.tsx`: the helper `backdrop()` (`:61-66`) queries `drawerClassNames.backdrop` (its users run unchanged); `testCompoundExposure(Drawer, …)` (`:99`) and "exports every sub-component under its flat name (C-COMPOUND)" (`:102`) gain the five parts; "declares ref in every props interface (C-REF)" (`:108`): `DrawerProps['ref']` is `React.Ref<HTMLElement> | undefined`, five new interfaces; "system props" (`:117-131`): `a11yVariants` gain `position: 'bottom'` and `size: 'large'`; "position %s places the panel with %s" (`:327`) and "position %s draws a border on the inner edge only" (`:343`) gain a `bottom` row and `border-t`; "warns in development when the drawer has no accessible name" (`:1183`): the message names `Drawer.HeaderTitle or a Drawer.Title`; "misplaced sub-components (overlays#34)" (`:1211`) gains five rows; "parts written in a Server Component" (`:1727-1820`) gains a case; "renders only the trigger on the server, also when open by default" (`:143`) and its `it.each` (`:149`, `:162`) are renamed "an overlay drawer …".
  - `Dialog.test.tsx`: the helper `backdrop()` (`:67-73`), `backdropOf` in "alert dialogs (modalType="alert")" (`:2055-2060`) and "keeps focus on the field of an alert dialog: the press does not blur it" (`:2260`, `:2272`) query the backdrop by its constant; "keeps its 1rem gap to the viewport as its own margin, not as backdrop padding (issue #4)" (`:417`) and "lets a className remove the gap and lift the caps, for a full-screen dialog (issue #4)" (`:431`) assert no padding on the backdrop and on the positioner; "keeps Dialog.Title clear of the Close button, and the consumer's padding wins" (`:502-521`): `pe-8` → `pe-[var(--wave-dialog-title-end-padding,2rem)]`; "Dialog.Content system props" (`:164-186`): `a11yVariants` gain `size: 'large'`, `size: 'full'` and a non-modal wrapper.
  - `overlays/__tests__/stableClassNames.test.tsx` › "Dialog.Content: surface root, backdrop, the title heading, the Close Button, body and footer" (`:36`, its assertion at `:49`): the surface's parent has `dialogContentClassNames.positioner` and its previous sibling `.backdrop`; "Drawer: panel root while open, backdrop, header, the title heading, the Close Button and body" (`:78`, its assertion at `:86`): `panel.previousElementSibling` has `drawerClassNames.backdrop`; `:92` (the Close button's parent is the header) unchanged.
  - `src/__tests__/integration.test.tsx:2504` ("a Toast over an alert Dialog" › "a backdrop press does not close the alert or move focus; Escape does close it") and `:2606` (`backdropOf`, used at `:2625`, `:2650`, `:2665`, "a SpinButton in a Dialog or Drawer: a backdrop press commits its typed value"): the lookups become `document.querySelector<HTMLElement>('.' + dialogContentClassNames.backdrop)` and the Drawer's constant (no assertion changes).
  - `Toast.test.tsx` › "Toaster: beside an open modal side panel": new cases (the block offset, the non-modal kind, both axes); its 0.6 cases, including "keeps its place when there is no room beside the panel", unchanged.
  - Unchanged on purpose (guards): "Dialog.Footer inside a Drawer › is a plain action row at the end of the body: it does not stick, and nothing warns" (`Drawer.test.tsx:1633`), both files' "does not re-register document listeners when the parent re-renders" and "attaches a stable ref to the panel once across re-renders", the whole "Drawer.Trigger and Drawer.Close (overlays#33)" suite, "isolates the page with inert instead of aria-modal while open (§5.8)" (`Dialog.test.tsx:297`, `Drawer.test.tsx:228`), "keeps an allow-listed region (toasts) reachable, not inert and clickable (feedback-navigation#50)" (`Dialog.test.tsx:1766`, `Drawer.test.tsx:1365`), the integration suite "a real timeout:0 Toast over an open %s (feedback-navigation#50)" (`:1122`), `Toaster.handle.test.tsx:240`, `usePresence.test.tsx`, `Presence.test.tsx`, `Menu.presence.test.tsx`.
- **P6-nav.**
  - `Nav.test.tsx` › `testCompoundExposure(Nav, ['Category', 'Item', 'SubItem'])` (`:91`) gains `SectionHeader`, `Divider`, `AppItem`, `AppItemStatic`; "exports every sub-component under its flat name (C-COMPOUND)" (`:107-111`) gains the four flat names. Every other test, the Server Component, Suspense and memo tests included, passes unchanged before any part lands (the split's regression suite).
  - `public-types.test.ts` › `INTERNAL_HELPERS` (`:424-425`): the key becomes `components/navigation/Nav.context.ts#NoAnchorOnlyAttributes` (same reason text), in the split's commit.
  - `.storybook/__tests__/exportDocblocks.test.ts` › "%s: the definitions behind a wrapper or overloads get their export docblock" (`:341-345`): the row `['src/components/navigation/Nav.parts.tsx', ['NavAppItem']]` is added; the `Nav.tsx` row stays.
  - Unchanged: `navigation/__tests__/stableClassNames.test.tsx` › "Nav: root, list; items (link and button) with list item, icon and content; category; sub-items" (`:240-277`); the integration `ssrCase` "Nav (sub-item defaultValue)" (`:4709-4730`).
- **P6-tagpicker.**
  - `TagPicker.test.tsx` › `describe('sizes and appearances (Phase 4 D12)')` › "keeps the 0.7 classes at medium": the tag asserts `data-size="extra-small"`, `data-appearance="filled"`, `data-shape="rounded"` and `tagClassNames.root` instead of `px-2 py-0.5 text-body-1`; the control keeps `gap-1 px-2 py-1.5 border-input` and gains `pe-8`; the input and root assertions stay. › "an untyped own size (small, or unknown) and appearance render the medium outline defaults": the same tag change. › the `it.each` over `large` and `extra-large`: the tag column becomes the Tag sizes `small` and `medium`. › "keeps the remove button's 0.7 box and glyph at size="%s"" becomes "gives the remove button Tag's Dismiss box and glyph at size="%s"" (per tag size, still `p-0`, `bg-transparent` and `tagPickerClassNames.removeButton`; `ms-0.5` and `rounded-sm` gone).
  - `TagPicker.test.tsx` › `describe('keyboard and announcements (input-pickers#14)')` › "mirrors the tag arrow keys in RTL": the `toHaveClass('ms-0.5')` line goes; the focus assertion stays.
  - `TagPicker.test.tsx` › `testSystemProps(TagPicker, …)`: `a11yVariants` gain clearable with tags, single line, and `allowCreate` open with typed text.
  - `input/__tests__/stableClassNames.test.tsx` › "%s: its list and surface carry ListboxSurface's classes and its own parts (D5)": the table gains a column of the host's extra list roots (`[]` for Dropdown and Combobox, `[tagPickerListClassNames.root]` for TagPicker).
  - Kept, to verify (they pass unchanged under D53–D61): "disables the input and the remove buttons and marks the group aria-disabled", "keeps the remove buttons out of the tab order", "ignores keyboard removal", "gives the remove buttons their own padding and background (C-NATIVE)", "Escape on a tag returns focus to the input and is not seen by a parent layer", "removes a tag when its remove button is clicked", "keeps the list open while a tag is removed with the mouse", "Backspace on an empty query moves focus to the last tag; a second Backspace removes it", "Delete on a focused tag removes it; arrows move between tags and back to the input", "Backspace targets the last rendered tag", "moves focus to the input when a controlled value drops the focused tag", "moves focus from a remove button to the input when readOnly turns on (C-DISABLED)", "localises the remove names, the tag list, the summary, the announcements and "No matches" with labels", "renders a selected value without an option as its raw value and warns once", "makes the first match of a typed filter active, so Enter adds it instead of submitting", "activates no option on open or once the typed text is cleared", "routes readOnly to the input and neither opens nor adds from the mouse or the keyboard", the `filter and query` and `field look` suites, the `tags()` helper; `integration.test.tsx` "case 1" and "case 2" (no tags rendered), the `fieldCases` TagPicker row, "%s: the first Escape closes the listbox, the second the Dialog".
- **P6-navdrawer.** None (its suites are new; `navigation/__tests__/stableClassNames.test.tsx` only gains cases).
- **INTEGRATION.** The integration and public-types tests gain cases (§4.6, §4.7); the four pending lists are emptied; `verify-dist.test.mjs`'s bridge case returns to "is closed", and `:1334-1360`'s member list gains the 0.11 members; `exportDocblocks.test.ts` "finds the compounds" gains `InteractionTag`, `NavDrawer`, `TagPicker`.

### 6.5 Review focus

The plan's risky edge cases, each pinned by a named test of the owning package (the item sections name them):

1. **Layer kind (D6):** every `kind === 'modal'` filter (`layers.ts:323`, `useRestoreFocus.ts:456`, `useModalIsolation.ts:75`) reviewed for `'dialog'`; a Menu on the page restores to its own trigger while a non-modal surface is open; Escape `'inside'` with an escape-disabled descendant, the toast region and the global fallback; the Toaster's measure counts `'dialog'`.
2. **Presence for Dialog and Drawer (D5):** every 0.10 Dialog and Drawer test passes with the synchronous end; StrictMode; SSR renders `entered`; closing-commit focus timing (`inert` in the mutation phase, the restore in the layout phase).
3. **Kept-mounted overlays:** `hidden` on every top-level element (else a page-blocking scrim); no layer, trap, lock, restore or Tab-order listener while closed (`assertOverlayStateReleased`); the raise before the trap and isolation; popups left open inside (the deferred check, D106).
4. **The backdrop move (D7):** consumer CSS such as `.wave-dialog-content__backdrop > *`; the positioner's `pointer-events: none` and scrolling; `useBackdropPress` without its target check; `backdrop={null}` (presses on the inert page, the blur-commit bookkeeping).
5. **Dim once:** synchronous subscriber notifications inside another component's layout effect; the isolation notification of §1.2.5; the DatePicker calendar excluded.
6. **Non-modal Tab order and restore:** a missing or removed opener; a wrapper span resolved to the button; `requireFocusInside` with a removed focused element and on the unmount path; a `modalType` switch while open.
7. **Title actions:** `Dialog.Title action` portal timing against the trap's initial focus; StrictMode's double ref callbacks; two titles; the measured padding (act() warnings, a consumer `style`, no `ResizeObserver`).
8. **The panel shell (D108):** hook order (inline restore → raise → `useModalLayer` → Tab order) and `useModalTriggerSession` in the caller after it; the `isClient` gate for overlays only; a `type` switch releases isolation and the lock in that commit.
9. **Drawer scroll store and parts:** emit only on change, StrictMode reconnects, the MutationObserver's cost, a nested scroll container (`Drawer.Body`); JSX order against DOM order; tailwind-merge on `w-148`/`w-235`/`h-*`, the safe-area classes and the title padding class.
10. **The Toaster's block path:** the region `ResizeObserver`; a drawer whose `size` changes while open; the DatePicker calendar at the window's bottom corner.
11. **Tag removal record (D35):** taken in the tag's layout cleanup; a Tag wrapped in a consumer element; the whole group unmounting; StrictMode; several tags in one commit; the moved-to control ends as the roving Tab stop.
12. **Delete through `.click()` (D33):** it cancels exactly as a pointer click does (merged slot button, `MERGED_DISABLED_FOCUSABLE_PROPS`, native `disabled`, the held state); `repeat`, modifiers, `isComposing`, portal keys.
13. **Tag disabled merge and held focus (D24, D25):** native `disabled` after the merged slot props; no double dimming; the hold adjusted during render, ending on blur, kept in the roving order.
14. **Tag `as` shadowing (D26):** `disabled` and `value` forwarded only to native elements that take them; the Types note; the §8 question.
15. **Host seams (D36, §4.1):** the nearest TagGroup resets `TagGroupHostContext`; `TagHostContext` only around TagPicker's own tags; `dimDisabled` on both seams with the `has-focus-visible` lift.
16. **The Toolbar extraction and the roving hand-back (§1.8, §1.9):** no change to Toolbar's attribute order or composition; the hand-back on detach, on `manageTabIndex` off and in StrictMode; nothing stale after NavDrawer's mode switch.
17. **TagPicker's registration commit (D59):** the create option appears one commit after the text; the status region never says "No matches" in between.
18. **TagPicker's exact match and duplicates (D59, D60):** the keydown reset against `onChange` ranking (paste, drop, IME); a controlled `query` does not re-rank; data mode against registration mode; case folding; the value check.
19. **TagPicker's trigger kind and list detection (D50, D63):** the server HTML and first render use `'editable'`; the mode switch before any key; direct children and Fragments only; a wrapped or second List warns.
20. **TagPicker's pointer against keyboard removal (D56):** `onClickCapture`, `detail`, portal clicks; focus placed in `onDismiss` wins over TagGroup's microtask.
21. **TagPicker's count mode (D62):** no loop between the chip's width and the count; widths cached only while visible; hidden tags out of the Tab order; no observer in wrap mode.
22. **The merged `TagPickerOption` name (D64):** both declarations in one module; the barrel's value export; the rolled-up declarations.
23. **The Nav split (D110, D111):** behaviour-neutral (`Nav.test.tsx` green before any part); one-way imports with no cycle; markers next to each `displayName`; lazy references still recognised; an import of only `Nav` holds no NavDrawer code.
24. **`useNavRootState`'s memo and `data-roving-value` (D112, D113):** "re-rendering Nav with unchanged state does not re-render memoized items" (`Nav.test.tsx:1676`); every value React-owned and stable; the category report corrects the first stamp before paint; the `wave-nav-category:` prefix collision.
25. **Opacity-hidden actions (D120, D121):** the `:focus-within` reveal, the `:has()` holds, the virtual cursor on transparent controls; a selected row's look on the `<li>`.
26. **The list-child check (D114):** no false positive for Suspense, Fragments, StrictMode; stripped in production; a Tooltip around a `Nav.Item` warns.
27. **NavDrawer naming and focus (D125, D134):** no name on the inline panel (axe `aria-prohibited-attr`); the overlay dialog and the `<nav>` share one; `inertModalTrigger`'s opener capture, the inline restore without an opener, `finalFocusRef`; `modalType` clamping and `backdrop` forwarding.
28. **The Hamburger name rule (D132):** label in name, a Tooltip's `aria-labelledby`, `title`; the state attributes win inside a NavDrawer; `aria-controls` pointing at an ancestor.
29. **The App shell breakpoint (D138):** no frame where an open inline pane becomes an open modal; focus on the outer Hamburger after a narrow switch with focus inside.
30. **The bare-word rule (rule 32)** for every new JSDoc and warning text under `src/components` and `src/lib`.

### 6.6 Definition of done for Phase 6

Every item's acceptance criteria (roadmap Phase 6, as §5.5 corrects them) are met and covered by tests; the "App shell" story passes the stories gate and `NavDrawer.appShell.test.tsx`; waves A to E are committed, each freeze of rule 28 as its own commit; the final gate and the real-browser checklist pass; the documents of §5 are complete; this spec's §10 records the implementation notes.

---

## 7. Appendix — gap → item → package

| Gap | Impact | Item | Package |
|---|---|---|---|
| `tag-1` | M | P6-01 | P6-tags |
| `tag-2` | M | P6-01 | P6-tags |
| `tag-3` | M | P6-01 | P6-tags |
| `tag-5` | L | P6-01 | P6-tags |
| `tag-6` | L | P6-01 | P6-tags (F6-foundation: `AvatarSizeContext`) |
| `tag-7` | L | P6-01 | P6-tags |
| `taggroup-1` | M | P6-02 | P6-tags |
| `taggroup-2` | M | P6-02 | P6-tags (id inferred from the report's §3 row 8) |
| `taggroup-3` | M | P6-02 | P6-tags (id inferred from the report's §3 row 8; F6-foundation: `Toolbar.navigation.ts`) |
| `tag-4` | L | P6-02 | P6-tags |
| `interactiontag-1` | M | P6-03 | P6-tags |
| `tagpicker-1` | M | P6-04 | P6-tagpicker |
| `tagpicker-2` | M | P6-04 | P6-tagpicker |
| `tagpicker-3` | M | P6-04 | P6-tagpicker |
| `tagpicker-6` | M | P6-04 | P6-tagpicker (issue #6) |
| `tagpicker-4` | L | P6-04 | P6-tagpicker |
| `tagpicker-5` | L | P6-04 | P6-tagpicker |
| `tagpicker-8` | L | P6-04 | P6-tagpicker (F6-foundation: `dimDisabled`) |
| `tagpicker-9` | L | P6-04 | P6-tagpicker |
| `drw-1` | M | P6-05 | P6-overlays |
| `drw-2` | M | P6-05 | P6-overlays |
| `drw-11` | M | P6-05 | P6-overlays (id inferred from the report's §5 row 9 and §3 medium #12) |
| `drw-8` | L | P6-05 | P6-overlays |
| `drw-9` | L | P6-05 | P6-overlays |
| `drw-10` | L | P6-05 | P6-overlays |
| `dialog-2` | M | P6-06 | P6-overlays (F6-foundation: the `'dialog'` layer kind, `ModalType`) |
| `drw-6` | M | P6-06 | P6-overlays |
| `dialogsurface-1` | L | P6-06 | P6-overlays (F6-foundation: `hasIsolatingModalBelow`) |
| `dialogtitle-2` | L | P6-06 | P6-overlays |
| `drw-7` | M | P6-07 | P6-overlays (id inferred from the roadmap's P6-07 and the report's §5) |
| `drw-3` | L | P6-07 | P6-overlays |
| `dialog-4` | L | P6-07 | P6-overlays |
| `nav-6` | M | P6-08 | P6-navdrawer (on P6-overlays' shell and P6-nav's seam) |
| `nav-13` | L | P6-08 | P6-navdrawer (F6-foundation: `NavigationIcon`) |
| `nav-3` | L | P6-08 | P6-navdrawer (F6-foundation: the roving hand-back) |
| `nav-9` | L | P6-09 | P6-nav |
| `nav-10` | L | P6-09 | P6-nav |
| `nav-11` | L | P6-09 | P6-nav |
| `nav-12` | L | P6-09 | P6-nav |
| `nav-5` | L | P6-09 | P6-nav |

Check: 40 rows; medium `tag-1`, `tag-2`, `tag-3`, `taggroup-1`, `taggroup-2`, `taggroup-3`, `interactiontag-1`, `tagpicker-1`, `tagpicker-2`, `tagpicker-3`, `tagpicker-6`, `drw-1`, `drw-2`, `drw-11`, `dialog-2`, `drw-6`, `drw-7`, `nav-6` = **18 M**; low `tag-5`, `tag-6`, `tag-7`, `tag-4`, `tagpicker-4`, `tagpicker-5`, `tagpicker-8`, `tagpicker-9`, `drw-8`, `drw-9`, `drw-10`, `dialogsurface-1`, `dialogtitle-2`, `drw-3`, `dialog-4`, `nav-13`, `nav-3`, `nav-9`, `nav-10`, `nav-11`, `nav-12`, `nav-5` = **22 L** (the roadmap's 0 H / 18 M / 22 L, `ROADMAP.md:93`). By package: P6-tags 7 M + 4 L, P6-tagpicker 4 M + 4 L, P6-overlays 6 M + 7 L, P6-navdrawer 1 M + 2 L, P6-nav 0 M + 5 L.

Ride-alongs without a gap id: issue [#4](https://github.com/mortenbrudvik/waveui/issues/4) (`Dialog.Content size` `large` and `full`, `data-size`, title actions; P6-06, P6-overlays); the phase's exit story "App shell" (P6-08, P6-navdrawer); the `useRovingTabIndex` hand-back fix (F6-foundation, "Fixed"); Tag's Dismiss hover (P6-01, "Fixed").

Not closed here: `tagpicker-7` (sizes and appearances, closed by P4-01 in 0.9; a guard); `tagpicker-10`, `drw-5`, `dialog-6` (P7-01); `drw-4`, `dialog-5`, `nav-8` (P10-01); `avatar-1`, `avatar-3`, `avatar-7` (P8-01); `buttons-23` (Phase 9); `buttons-29` (P13-02); `buttons-22` (an intentional difference, roadmap §8.3, unchanged); `nav-1`, `nav-2`, `nav-4`, `dialogtitle-1`, `dialogactions-1`, `dialogactions-2`, `recompose-1` (backlog, §8.2); `nav-7`, `dialog-1`, `dialog-3`, `dialogbody-1` (closed in 0.6, guarded).

---

## 8. Open questions for the maintainer

Each is decided in the spec with the recommended answer; the maintainer confirms or picks another option before wave A. A changed answer changes only the ruling named.

1. **Medium tag height** (D21, P6-01). (a) 28px, the 0.10 box (Avatar 24px; Phase 4 rule 14 and Checkbox D14 precedent; no third internal Avatar box); (b) Fluent's 32px (every 0.10 tag grows; Avatar 28px and a third internal box). **Recommended: (a)**, with the difference in §8.3.
2. **Delete and Backspace scope** (D33, P6-02). (a) On every Tag Dismiss button and `InteractionTag.Secondary`, on a Primary with a Secondary and on a focused link chip, inside and outside a TagGroup, one tag per press; (b) only inside a TagGroup (Fluent's effective behaviour; a standalone Tag keeps 0.10's keys); (c) (a) without the Primary and link-chip paths. **Recommended: (a)** (one rule per control; the roadmap asks for the Primary path; a "Changed" entry for 0.10's standalone Tags).
3. **What a selecting TagGroup does beyond toggling** (D39, D40, P6-02). (a) Dismissing a selected InteractionTag also deselects it (`onDismiss(value)`, then `onValueChange(without)`), and the group takes `name`, `form` and `required` (one hidden input per value, native validation only, reset to `defaultValue`); (b) deselect on dismiss, no forms; (c) forms, and the selection left to the app on dismiss; (d) neither (Fluent). **Recommended: (a)** (an uncontrolled selection would otherwise keep and submit a removed tag's value; C-FORMS; "native forms everywhere").
4. **Tag's own props shadow element attributes** (D26, D13; an exception to roadmap principle 2). Fluent's names on the polymorphic Tag (`size`, `shape`, `appearance`, `disabled`, `selected`, `value`, `media`, `icon`, `secondaryText`) remove the element's attributes of those names from `TagProps<C>`. (a) Accept it: `TagProps<'li'>['value']` and `TagProps<'button'>['value']` narrow to `string`, `disabled` and `value` still reach elements that take them natively, the other names no longer reach an `as` component; "Types" and "Upgrading" lines; (b) type `value?: string | number` (TagGroup reports `String(value)`), so `as="li" value={3}` keeps compiling, the other names still shadow; (c) prefix the new props (`tagSize`, …) to avoid any shadowing (against Fluent's names, D12). **Recommended: (a)** (a rare `as` use with a one-line fix; one spelling of `value` across the tag family).
5. **Tag sizes in a TagPicker** (D54, P6-04). (a) Fluent's mapping, one size down: `medium` → `extra-small` (20px, 12px text), `large` → `small` (24px), `extra-large` → `medium` (28px); (b) height-preserving: `medium` → `small`, `large` and `extra-large` → `medium` (two picker sizes look alike); (c) keep 0.10's own tag markup (loses `tagpicker-2`'s Avatar media and TagGroup's focus rule). **Recommended: (a)** (parity, three distinct sizes, no field grows; a "Changed (visual)" entry).
6. **TagPicker's default chevron** (D61, P6-04). (a) Shown by default, `expandIcon={false}` restores 0.10 (Combobox and TimePicker since 0.6, Dropdown since 0.10, Fluent's default); (b) hidden by default, `expandIcon` opts in. **Recommended: (a).**
7. **Focus after a keyboard removal in a TagPicker** (D56, P6-04). (a) The next tag, else the trigger, never the previous tag (keeps "Backspace focuses, a second Backspace removes" safe and the 0.10 tests green); (b) Fluent's: the previous tag, else the trigger (three 0.10 tests change); (c) 0.10's: always the trigger. **Recommended: (a).**
8. **A press on a TagPicker field's empty area** (D66, P6-04). (a) Toggles the list and focuses the trigger (Fluent; consistent with the new chevron); (b) only opens, as 0.10 (a press on an open picker does nothing). **Recommended: (a).**
9. **The Close button in a composed Drawer header** (D75, P6-05). (a) The built-in Close button ends every `Drawer.HeaderTitle`, after `action`, and `closeButton={null}` hides it; (b) Fluent's: a composed header has no built-in Close button, you put one in `action` (with your own glyph); (c) `action` defaults to the Close button and any `action` replaces it. **Recommended: (a)** (WaveUI always renders its Close button and its glyph is not public; it matches `Dialog.Title action`, before Close).
10. **`Drawer.Footer` alignment** (D74, P6-05). (a) Start, Fluent's DrawerFooter (primary first); (b) end, like `Dialog.Footer` and the 0.10 Drawer stories' hand-made rows. **Recommended: (a)** (`justify-end` is one class away; with (b) the §8.3 line goes).
11. **The built-in Drawer header's line** (D82, P6-05). (a) Scroll-reactive like the parts (a "Changed (visual)" entry; always drawn in forced colours); (b) keep 0.10's permanent line in the `title` form, scroll-reactive only in `Drawer.Header`. **Recommended: (a)** (one look, `drw-10`'s intent).
12. **`Dialog.Content size="large"` width** (D96, P6-06). (a) 940px, Drawer's `large` (one scale); (b) 800px; (c) 1152px. **Recommended: (a).**
13. **The keyboard model of `NavDrawer.Body`** (D130, P6-08). (a) `focusMode` defaults to `'tab'`; `'arrow'` starts at the current page and moves with both arrow pairs through every focusable element; (b) `'arrow'` by default (Fluent); (c) `'tab'` by default, `'arrow'` with Up/Down only (Fluent's axis; a MenuButton action keeps Up/Down for its Menu and the order stops there). **Recommended: (a)** (a `<nav>` announces no arrow keys; "you are here" is where Tab should land; Left/Right move past a control that uses Up/Down itself).
14. **How Nav item actions show** (D120, P6-09). (a) On row hover and focus, by opacity, held while pressed or expanded, always on touch and in forced colours (Fluent's look); (b) always drawn; (c) a prop `actionsVisibility?: 'hover' | 'always'` (default `'hover'`). **Recommended: (a)** (hidden actions stay focusable and reachable by Shift+Tab and by focus return; (c) can come later without breaking).
15. **NavDrawer's default width** (D126, memo C23, P6-08). (a) `size` defaults to `'small'` (320px) with `data-size="small"`, and `className="w-65"` gives Fluent's 260px; (b) `size` unset → 260px with no `data-size` (Fluent; an exception to Phase 1 D22); (c) a NavDrawer `small` drawn at 260px (one name, two widths). **Recommended: (a)** (Phase 1 D22 holds; one size scale for every drawer).
16. **Hamburger's defaults** (D132, D133, P6-08). (a) `subtle`, named "Navigation", and wired automatically (`aria-expanded`, `aria-controls`, the toggle) inside a NavDrawer, plain outside; (b) Fluent's: no default name (Button's icon-only warning fires) and no wiring; (c) as (a), named "Toggle navigation". **Recommended: (a)** (an unnamed default fails axe `button-name` in every app that forgets it; "Navigation" matches the landmark it opens; the state is in `aria-expanded`, so the name never changes).

---

## 9. Review notes

Filled by the review round.

## 10. Implementation notes

Filled during implementation.
