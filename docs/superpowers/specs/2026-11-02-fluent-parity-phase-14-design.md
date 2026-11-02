# Fluent parity, Phase 14: 1.0.0, the API freeze (design)

Date: 2026-11-02. Release: 1.0.0, straight to `latest` (no release candidates). Base: `main` at 0.18.1 (`8f35214`). Branch: `feat/fluent-parity-phase-14`. Roadmap item: `docs/ROADMAP.md`, Phase 14 (P14-01 to P14-06), amended here.

This is the design of the first stable release. The maintainer's instruction was: willing to break anything, all three big breaks in, straight to 1.0.0, decide the rest. Every ruling below is mine and carries what it costs if wrong. Research behind it (read-only, with experiments on the repo's Tailwind 4.3.3): namespaced utilities, the ESM-only work map and the `ref` inventory; their findings are quoted where they decide something.

## 1. Intent

WaveUI 1.0 is a clean break that ends the 0.x compromises:

1. **Nothing of WaveUI's styling can collide with an app's** (P14-01): every class the library draws carries a namespace, in its own cascade layer, and its tokens are offered to apps under a namespace too.
2. **`ref` reaches the element a user focuses** on every form control (reverses 0.18's "keep", P14-04), with `slotProps.root` for the wrapper.
3. **The package is ES modules only** (new): `dist/*.mjs` and `index.d.ts`.
4. **Everything 0.x deprecated is removed** (P14-02), and the three small meaning/type changes land: `Image.alt` required (P14-03), Badge `important` is the neutral high-emphasis badge (P14-05), TimePicker `format` follows the locale (P14-06).
5. **The API is frozen**: semver from 1.0.0, "Upgrading to 1.0" complete, a migration codemod for the utilities.

### Non-goals

- New components or features. Phase 14 adds none (the `slotProps.root` parts and the migration codemod are consequences, not features).
- `WaveProvider classNames` (deferred past 1.0, Phase 13 R17) stays deferred.
- A release-candidate series or a 0.19 bridge release (ruled out by the maintainer).
- Re-deciding the Phase 13 mechanisms (`slotProps`, render-function slot children, Field function child, context hooks): they are the 1.0 surface as released in 0.18.

### Anti-goals (a 1.0 that technically works but fails)

- A prefixed sheet that renders a component differently in any of the three engines.
- A consumer that must configure Wave's internals to avoid collisions.
- Silent breakage: every removed or moved API must fail loudly (a type error or a missing export), never behave differently without a message. The exceptions are documented in the CHANGELOG and the guide: the visual `important` badge and the TimePicker default (default changes), a `ref` that moves for an untyped or callback ref (R5), and the styling changes listed in R6.

## 2. Rulings

**R1. Straight to 1.0.0; the "announce first" rule is waived for three breaks.** The roadmap's Phase 14 entry says 1.0 changes nothing that a 0.x release did not announce. The maintainer chose three breaks 0.18 never announced (namespaced utilities, `ref` placement, ESM-only) and chose no 0.19. The rule stands for everything else (P14-02 to P14-06 were all announced in 0.18). *Cost if wrong:* users of those three get no deprecation period; the CHANGELOG, the "Upgrading to 1.0" guide and the codemod are the substitute.

**R2. The deprecation inventory drives P14-02, then retires.** `src/lib/deprecations.ts` (84 rows: 61 `removed`, 4 `default-changes`, 18 `required`, 1 `decided`) is the binding list of what 1.0 does. While the phase runs, `src/__tests__/deprecations.test.tsx` must stay green at every commit: Task B gives each row a `done` flag. A done row has no call site left, its warning case is dropped (a removed prop is passed with `@ts-expect-error`, which proves the type error the anti-goals require), a file it names must not exist any more, and new absence checks cover the entry, the class-name registry and the CSS; the call-site count ignores done rows. The last P14-02 task deletes the file and its test, fixes `integration.test.tsx` (the two references) and `TEST_ONLY_MODULES` of `verify-dist.mjs` and its fixture test, and the CHANGELOG 1.0.0 section restates every row as a "Removed", "Changed" or "Required" line. **`warnDeprecated` and `resolveDeprecatedProp` stay** (C-NAMING needs them for a rename in a 1.x minor); the roadmap's "no callers" holds when the phase ends. Until the inventory retires, a new table in `UPGRADING-TO-1.0.md` must not use the `| Before | After | Announced in | Warns |` header under the four inventory headings. The `decided` row about `ref` is superseded by R5. *Cost if wrong:* a removal missed has no test; mitigated by the row-by-row inversion check before the file is deleted.

**R3. P14-02, P14-03, P14-05, P14-06 are done as announced** (the inventory rows and the 0.18.0 CHANGELOG "Deprecated" list are the spec of each): old names removed; the optional `details` parameter of `onOpenChange`, `onCheckedValuesChange` and `onCheckedItemsChange` becomes required where it exists; `Image.alt: string` required (`StrictImageProps` stays as the alias 0.18 announced; only the optional `alt` is removed; the development warning for a missing `alt` stays for JavaScript callers, worded without "in 1.0"); Badge and CounterBadge `color="important"` renders Fluent's neutral high-emphasis look (`severe` keeps its orange); TimePicker `format` defaults from the locale's hour cycle (an explicit `format` still wins; no `hourCycle` prop, and TimePicker has no `locale` prop: the server render and the first client render use `'12h'`, after mount the default follows the browser's language, and the guide tells SSR apps to pass `format` for a stable output); `useRovingTabIndex`'s positional form and DataGrid's positional `onSortChange` are removed; the `[presence=` className rule that turns a component's default motion off is removed (a `motion` slot value replaces it). *Cost if wrong:* a row misread; each task's reviewer checks its rows against the inventory.

**R4. ESM-only.**
- Output: ES modules only. `package.json`: `exports["."]` is `{ "types": "./dist/index.d.ts", "default": "./dist/index.mjs" }`; `main` is `./dist/index.mjs`; `module` is dropped; the top-level `types` stays (keeps `moduleResolution: node10` type-checking); `sideEffects` unchanged. `dist/index.cjs`, `index.d.cts`, every `.cjs` and `.cjs.map` are gone (dist unpacked size roughly halves).
- Keep the `.mjs` extension (the exports map has no deep JS subpaths; renaming to `.js` touches ~700 literals for no consumer benefit).
- `vite.config.ts`: a single ES output with `lib.formats: ['es']` (Vite 8 otherwise defaults to `['es','umd']`), `copyIndexDtsToDcts` removed. `check:package` uses attw's `--profile esm-only` (`node16` and `strict` fail an ESM-only package by design); publint stays.
- `scripts/verify-dist.mjs`: the CJS checks go (`checkCjsParity`, the CJS probes, `SERVER_SAFE_MODULES`' `.cjs` entries, the `d.cts` declaration check); new `checkRequireEsm` (the entry loads with `require()` on the Node floor and exposes the same names as `import()`: guards against a future top-level await); a guard fails when `dist` holds any `.cjs` or `.d.cts`.
- `scripts/pack-smoke.mjs` and the fixtures: `smoke.cjs` stays as the `require(esm)` consumer; the type fixtures check `.mts` under `node16` and `.cts` under `node20`.
- `lib/globalRegistry` **stays**: no registry entry exists only for CJS-vs-ESM. Each still guards against two ESM copies (duplicate installs, bundler duplicates, hot reload). Only the rationale comments change.
- Node floor stays `>=22.12.0` (`require(esm)`; 22.12.x prints an ExperimentalWarning, 22.13+ is silent).
- Consumer migration text (for the guide): ES modules only; `require()` works on Node 22.12+ and returns the same module as `import`; TypeScript CommonJS files need `module: node20` or `nodenext` (`node16` reports TS1479); Jest in CommonJS mode must transform the package, use its ESM mode, or move to Vitest.
*Cost if wrong:* CJS-only consumers (Jest CJS, old toolchains) break; the guide says how to migrate.

**R5. `ref` reaches the focusable element (supersedes Phase 13 R19).**
- Rule: for a form control or composite whose root is a wrapper around one focusable element, `ref` reaches that element; `className`, `style` and the rest stay on the root; the wrapper's ref is `slotProps.root.ref`.
- **Moves (12):** Checkbox, Switch, SearchBox, SpinButton, Combobox, Dropdown, TimePicker, DatePicker, TagPicker, ColorSlider, AlphaSlider, `ColorPicker.HexField`.
- **Already there:** Input (and its `slotProps.root`), RadioGroup.Item (gains `slotProps.root`, since no ref reaches its `<label>` today), Textarea, Select, Slider, Listbox, swatches.
- **Stays on the container (not form controls with one focus target):** ColorArea (two inputs, one Tab stop), `Table.SelectionCell`, `DataGrid.SelectionCell`, InfoLabel, and every group/collection root (RadioGroup, Rating, SwatchPicker, ColorPicker, Calendar, Tree, FlatTree, List, Nav, TabList, Toolbar, Menu, SplitButton, TagGroup, InteractionTag, Tag, Card, AvatarGroup, Breadcrumb, Pagination, Accordion, Carousel, the table header cells).
- `controlRef` is **removed** from the 12 movers (TypeScript's excess-property and ref-type errors flag every use); it stays on ColorArea, `Table.SelectionCell` and `DataGrid.SelectionCell`.
- Every mover (and RadioGroup.Item) gains a `root` part: `slotProps.root` as Input's (Phase 13 R6): its classes, style, attributes and handlers merge after the component's; the enumerated `data-*` attributes and `hidden` are locked, `inert` and `aria-hidden` unset; a click is blocked while disabled where the root activates the control (Checkbox, Switch, RadioGroup.Item). `SLOT_PROPS_ROOT_OWNERS` becomes a rule ("components whose `ref` reaches a focusable element inside their root") and lists 14 components (Input, the 12 movers and RadioGroup.Item); each D group adds its owners (the ownership type test forces an owner to declare `root`, so they cannot be listed earlier), and `slotParts.test.ts` replaces Switch as its negative example. Rating.Item (two half-star buttons) is on the "stays" list.
- TagPicker's `ref` follows the trigger that renders (`Ref<HTMLInputElement | HTMLButtonElement>`), covering the built-in form and the parts form; its context field `controlRef` is renamed internally (`controlElementRef`) to end the name clash with the removed prop.
- Test infrastructure: `testSystemProps` gains a `ref: 'control'` option and `ControlQuery.tag` (`ref.current` must equal `getByRole(control.role)`; `expectedTag` keeps meaning the root's tag); a `testRootPartRef` helper checks that `slotProps.root.ref` reaches the `data-testid` element.
- Order: the E rows of a mover (the 0.5 `onChange`/`onOptionSelect` renames, SearchBox `dismiss`) land before that mover's D group, since both edit the same files: D and E run serially.
- Behaviour that changes with no code change and is documented (and integration-tested): `Overflow.Item asChild` measures through a mover child's `ref` (now its control); `Presence` reading animations through `ref`; Tooltip, Popover and Menu triggers anchor to the control (their state ARIA and focus target already resolved to it).
*Cost if wrong:* code that holds the wrapper through `ref` (measuring, layout) breaks; `slotProps.root.ref` is the replacement. A mover whose wrapper is intentionally the target (rare) can be reverted per component.

**R6. Namespaced utilities: internals prefixed, tokens offered under `wave`, layers for Tailwind apps.**
- **Internals.** Every utility class a component or `src/lib` recipe writes carries the Tailwind prefix `wave:` (`wave:flex`, `wave:bg-primary`, `wave:not-disabled:not-aria-disabled:hover:bg-primary-hover`, `wave:wave-rtl:-scale-x-100`). `dist/styles.css` is compiled with `prefix(wave)` and an internal, unnamespaced theme file (`src/styles/theme.css`: the `@theme inline reference` mapping `--color-primary: var(--wave-primary)` and the rest, imported only by `scripts/build-css.mjs`), so the sheet emits no theme variables and none of the self-referencing `--wave-shadow-N` that the prefix `wave` would otherwise produce. The spike (§6, Task 1) found `reference` safe, so the prefix is `wave` (not `wv`); the keyframes may stay inside the `reference` block (they are still emitted when an `animate-wave-*` utility uses them). Unprefixed words never generate, so the `@source not inline` list has no work left in the prefixed build; the compile check below has its own allowlist (amended by Task 1).
- **`./styles` stays unlayered** (the plain-stylesheet audience, apps without Tailwind): with the prefix the name collisions are gone, and an unlayered sheet keeps 0.18's robustness against an app's unlayered reset (`*{margin:0}`, normalize, Bootstrap reboot), which a layered sheet would lose. `./preflight.css` stays unlayered too (its universal rules lose to single-class utilities, as today).
- **`./tailwind` layers it.** The entry declares `@layer theme, base, components, utilities;`, imports `./tokens.css` with `layer(theme)` (the token rules and the namespaced theme, below) and the precompiled sheet without the token rules, `dist/components.css` (the `./styles` build minus `tokens.css`; an internal file that only this entry imports, not an export), with `layer(components)`, so in a Tailwind app any of the app's utilities and the app's own unlayered CSS win over Wave in either import order. Across layers specificity no longer matters. (Amended by Task 1: importing the whole `./styles` sheet into `components` would put the token rules there too, and an app's token override in `@layer base` or `@layer theme`, which 0.18 honoured, would lose; the two forms render identically.) The one `!important` Wave has (`[hidden]` in base.css) survives the layer: an important declaration of an earlier layer beats every normal declaration (spike: hidden in every form and engine). The entry also carries the `wave-rtl:` variant and no `@source` of `dist`.
- **Consumer theme keys.** `src/styles/tokens.css` carries the namespaced keys (`--color-wave-*`, `--text-wave-*`, `--shadow-wave-*`, `--font-wave*`, `animate-wave-*`, `duration-wave-*`, `ease-wave-*`, mapped to the `--wave-*` tokens), so an app writes `bg-wave-primary`, `text-wave-body-1`, `shadow-wave-4`; a prefixed app (`prefix(tw)`) writes `tw:bg-wave-primary`. The token rules sit in `@layer theme` and are shipped once (the dist sheet does not repeat them for the `./tailwind` path; `tokens.test.ts`'s pins are rewritten).
- **The custom setup is redefined.** `./tokens` + `./variants` + `@source dist` can no longer style components (an unprefixed app build ignores `wave:` classes, and one build carries one prefix). In 1.0 components always come from `./styles` (or `./tailwind`, which layers it), and `./tokens` plus `./variants` expose the namespaced theme and the `wave-rtl:` variant for the app's own classes. The Tailwind fixture and the README section are rewritten.
- **Tailwind-free token utilities:** `@mortenbrudvik/waveui/utilities.css` (and `./utilities`), in `@layer utilities`, no variants: bg, text, border, ring, fill, stroke, shadow, font and animate utilities of the namespaced keys (~50 KiB minified, ~6.7 KiB gzip). A build-css entry, listed in attw's `--exclude-entrypoints` and pack-smoke's `EXPORTED_SUBPATHS`.
- **`cn`.** Two functions. The **public** `cn` stays unprefixed and learns the namespaced groups (`text-wave-*`, `shadow-wave-*`, `animate-wave-*`, `duration-wave-*`, `ease-wave-*`), so an app's `cn('p-4','p-2')` merges as before. A **module-only** `wcn` (what components, `lib/slot`, `mergeSlotProps` and the hooks that merge recipes call) is tailwind-merge with `prefix: 'wave'` and an `experimentalParseClassName` that parses an unprefixed class as if it carried the prefix (`parseClassName(className.startsWith('wave:') ? className : 'wave:' + className)`, which merges exactly as stripping `wave:` does), so a consumer's unprefixed `p-2` still replaces Wave's `wave:p-4` exactly as in 0.18 (the cascade layer is the second line of defence, not the first). `wcn` knows both the internal scales (`text-body-1`, `shadow-4`) and the namespaced ones (`text-wave-body-1`, `shadow-wave-4`): otherwise a consumer's `text-wave-body-2` reads as a text colour and removes Wave's `wave:text-foreground`. Both `extendTailwindMerge` calls are `/* @__PURE__ */`, so a component import carries only `wcn`'s configuration (amended by Task 1). `tailwind-merge` is pinned to an exact version and a test fails if the parse changes. The `conflictingClass` contract of `testSystemProps` is unchanged.
- **Migration.** `codemod/migrate-1.0.mjs`, shipped in the package (`files`; dependency-free: Node `fs` and regexes; run as `node node_modules/@mortenbrudvik/waveui/codemod/migrate-1.0.mjs <globs>`; added to the lint, format and test globs; allowed by pack-smoke's no-scripts rule), rewrites an app's own classes, `@apply` lines and `var(--color-*)` uses that named Wave's former unprefixed token utilities (`bg-primary`, `text-foreground`, `border-border`, `text-body-1`, `shadow-4`, ...) to the namespaced ones, from the list of Wave's theme keys; the 17 names shared with shadcn (`bg-primary`, `border-border`, `ring-ring`, ...) are rewritten only with `--include-shared`. "Upgrading to 1.0" carries the same table. The stories and the tests of this repository are migrated with it (which tests it).
- **What stays shared or changes, listed as anti-goal exceptions:** Tailwind's `--tw-*` custom properties (version skew between two Tailwind builds); an unlayered reset still beats the layered `./tailwind` form (use `./styles` unlayered, or put the reset in a layer); renamed theme keys; the generic utilities (`flex`, `p-4`) the precompiled sheet used to supply to an app that never defined them; in a Tailwind app an app's bare `bg-*` now also overrides Wave's hover, selected and disabled backgrounds (layer order).
- **Transition (the flip is atomic).** The prefix applies to a whole Tailwind build and to the whole merge function, so the repository cannot be half converted. Package F lands in two steps that are each green: **F1** adds everything that works with the prefix off (the `theme.css` split, `wcn` with a configurable prefix, the migration codemod, the compile check, the namespaced keys in `tokens.css`, `utilities.css`, the `./tailwind` and fixtures rewrite behind the prefix constant) and **F2** is one commit that sets the prefix and runs the AST codemod over `src/components`, `src/lib`, the tests (classified: Wave's own classes are prefixed, a consumer class a test passes in is not; `querySelector('.x')` becomes the escaped `.wave\:x`) and the stories, re-sets the budgets from measurement (R7) and passes every gate. F2 is reviewed by its checks plus samples, not by reading 4,450 changed words.
- **Compile check (replaces a conventions-gate rule).** The conventions gate reads every string word as a class token and cannot tell `'fixed'` (a positioning strategy) from a class. At the flip `scripts/build-css.mjs` reads the words of every string literal of `src/components` and `src/lib` (the TypeScript AST, as `classStringTokens` already does; never Tailwind's scanner, which also reads comments: 67 false alarms in the spike) and fails on any word the unprefixed design system compiles (`candidatesToCss`), or a `group`/`peer` marker, outside the allowlist, which proves every real class is prefixed. The allowlist is not today's `@source not inline` list (amended by Task 1) but the 22 non-class words the spike found: `absolute blur border collapse container filter fixed grid group hidden inline list-item outline relative resize ring rounded select-all static table underline visible`.
- **The src codemod is AST-based**, limited to class contexts (`cn`/`wcn`/`clsx` arguments, `className=`, recipe and `*Classes` maps, `withPartClass`, `src/lib/styles.ts`, `src/lib/motion.ts`), with the compile check as its safety net. It also renames `cn` to `wcn` in `src/hooks` (`useCollapsePresence` merges the motion recipes), prefixes the `group`/`peer` markers (`wave:group/row`), and is followed by `prettier --write` (61 files rewrap). The spike's tool is the one Task 21 moves to `scripts/prefix-codemod.mjs`.
- **Task order.** A spike first (below), then F1 after D and E (fewer conflicts), then F2.
*Cost if wrong:* an XL change that fails the spike is abandoned in favour of the runner-up (theme-key namespacing plus a layered sheet, M/L), at the price of the spike only. If it succeeds, apps pay a one-time migration, and a plain-CSS app whose own class competes with a Wave class by order (not by `cn`) may see a different winner than in 0.18.

**R7. Sizes and budgets.** F2 re-sets every budget from measurement and nothing earlier than F2 touches them: `RECORDED_IMPORTS_0_18` (with the 0.17 budgets it carries for the brand, token, presence and virtual-window probes, `DATA_GRID_BUDGET`, `PRESENCE_BUDGET` and `VIRTUAL_BUDGET`) fold into one `RECORDED_IMPORTS_1_0`, each budget its measured size at F2 plus 512 B minified and 192 B gzip, recorded against a new `BASELINES_0_18_1` (the 0.18.1 measurements) with the growth in the CHANGELOG; the growth of `dist/styles.css` (about 6 bytes per selector) is recorded without a budget. Packages D and E run under the 0.18 budgets; if D's `root` parts exceed a margin the task adds a small, explicit interim allowance as Phase 13 did. The prefix lengthens class strings (about 5 bytes per class word in the minified JS; gzip absorbs most); the removed aliases shrink them. ESM-only changes no import's size. *Cost if wrong:* a budget set too loose hides a later regression; too tight forces a re-base in 1.0.x.

**R8. The release.** `package.json` 1.0.0, CHANGELOG `## [1.0.0]`, ROADMAP status, "Upgrading to 1.0" final, then merge, tag `v1.0.0` and the release workflow publish to `latest`. **Merge, push, tag and publish need the maintainer's explicit go-ahead at that point**: an irreversible release is not covered by "decide the rest".

**R9. Semver commitment.** From 1.0.0 the public API is the entry's exports, the class-name registry (`wave-*` stable classes), the `--wave-*` tokens, the namespaced theme keys, the CSS entries and the documented props; the internals listed as module-only are not. CLAUDE.md states it.

## 3. Work breakdown (the plan expands each)

| Package | Content | Size |
|---|---|---|
| A Utilities spike | A throwaway AST codemod prefixes the closures of Button, Dialog and DataGrid on a scratch copy; a prefixed `dist/styles.css` is built with `theme.css` and `reference`; the pack-smoke fixtures (plain, Tailwind unprefixed with a shadcn-like `@theme`, Tailwind `prefix(tw)`) render them and are screenshotted in Chromium, Firefox and WebKit against 0.18.1 (pixel diff by Playwright screenshot comparison); the `[hidden]` `!important`, the `./tailwind` layered import and `wcn` with `experimentalParseClassName` are proven. Findings go into §6; go/no-go for F | M |
| B Infrastructure | Inventory `done` flag and test adaptation (R2); `testSystemProps` `ref: 'control'` and `testRootPartRef`; the `SLOT_PROPS_ROOT_OWNERS` rule | M |
| C ESM-only | R4: verify-dist, vite, package.json, pack-smoke, fixtures, comments, docs | M |
| D `ref` placement | R5 in four groups: Checkbox/Switch/RadioGroup.Item; SearchBox/SpinButton/HexField/ColorSlider/AlphaSlider; Combobox/Dropdown/TimePicker/DatePicker; TagPicker | L |
| E Removals | R2/R3 in groups taken from the inventory: styles and tokens aliases; value-alias props; callback aliases and required `details`; call forms; `Image.alt`; Badge `important`; TimePicker `format`; retire the inventory | L |
| F1 Utilities preparation | R6 with the prefix off: `theme.css` split, namespaced `tokens.css`, `wcn` and the public `cn`, `utilities.css`, `./tailwind` and fixtures rewrite, the migration codemod, the compile check, `RECORDED_IMPORTS` unchanged | L |
| F2 Utilities flip | One commit: prefix on, AST codemod over `src`, tests and stories, `.storybook` second compile, `verify-storybook`, budgets `RECORDED_IMPORTS_1_0` | XL |
| G Docs and release prep | README, guide, testing guide, UPGRADING-TO-1.0, CHANGELOG 1.0.0, ROADMAP, CLAUDE.md, spec ruling that supersedes Phase 13 R19 | L |

Order: A first (it can abort F), then B, C, D and E (D and E serially, E's rows first), then F1, F2, G. F touches almost every file, so D and E land before it (fewer conflicts); the codemod makes F2 mechanical.

## 4. Exit criteria

- All gates (`/gate`): typecheck, lint, format, tests, build-storybook, build, verify-dist `--final`, check:package, test:pack.
- Real-browser checklist (Chromium, Firefox, WebKit), spec §5.
- The final whole-branch review with the adversarial pass on the prefixed build and the `ref` moves.
- No `warnDeprecated` caller; the inventory file and test retired; CHANGELOG 1.0.0 restates every row.
- The maintainer's explicit go-ahead before merge, tag and publish.

## 5. Real-browser checklist (Chromium, Firefox, WebKit)

1. Button, Dialog, DataGrid, Menu, Tabs and a Tooltip render pixel-comparably to 0.18.1 (screenshots side by side) in light, dark and high contrast, LTR and RTL, with the plain stylesheet.
2. The same components inside a Tailwind app with a shadcn-like `@theme` (`--radius-md`, `--color-primary` redefined): Wave's look is unchanged, the app's `bg-primary` is the app's.
3. The same inside a `prefix(tw)` Tailwind app, and with `./tailwind` imported before and after the app's layers.
4. A consumer `className` overrides a Wave class (`p-2` over the component's padding; `bg-wave-error` over `bg-primary`), with and without Tailwind.
5. Forced colors, `prefers-reduced-motion`, focus rings and hit areas unchanged.
6. `ref` on each of the 12 movers focuses the control; `slotProps.root.ref` is the wrapper; the Field label click focuses it.
7. `require('@mortenbrudvik/waveui')` on Node 22.12 and 24 loads and renders on the server.

## 6. Implementation notes

(To be filled during the build: every place the code deliberately departs from this document, each edit to an existing assertion, the spike's findings and the measured sizes.)

### Task 1, the spike

**Verdict: GO** for Package F with the prefix `wave`. Nothing failed that R6 cannot absorb; four points of R6 were amended (marked "amended by Task 1": the settled prefix, the `./tailwind` form, the `wcn` configuration, the compile check and the codemod scope). No repository file other than this spec changed.

**Method.** Scratch copies of `src`, `scripts`, `package.json` and the configs at 0.18.1 (`8f35214` code, the baseline) and a prefixed copy, both built with the repository's own build (`vite build` with the library config minus declarations and CJS, `scripts/build-css.mjs`). The AST codemod (below) ran over all of `src/components` and `src/lib` (a superset of the closures of Button, Dialog and DataGrid, 60 modules), so `dist/styles.css` and the bundles are the size of the real flip. A test page (Button: 4 appearances × 3 sizes, icon, icon after, disabled, `disabledFocusable`, extra large; Dialog open; DataGrid with sort, multiple selection, a selected row and resizable columns), bundled against each dist, rendered in Chromium 156 (rev 1248), Firefox 157 (rev 1555) and WebKit 27.2 (rev 2370) through playwright-core 1.64.1 (the installed browsers, nothing downloaded), at 960 × 640, in light, dark, high contrast, RTL, forced colors and with a keyboard focus ring, in eight consumer setups: plain `./styles` (0.18.1 and prefixed), the 0.18.1 `./tailwind` app (as the pack-smoke fixture), the 0.18.1 `./tailwind` app with a shadcn-like `@theme` (control), and four prefixed Tailwind apps with the shadcn-like `@theme` (`--color-primary`, `--color-background`, `--color-border`, `--color-ring`, `--radius-sm/md/lg` redefined, its `@layer base` `* { border-border outline-ring/50 }` and `body` rules): `./tailwind` after Tailwind, before Tailwind, in a `prefix(tw)` app, and in form B (below). Pixels compared with Playwright's own screenshot comparator (pixelmatch), strict (threshold 0) and at its default (0.2). Tailwind 4.3.3, tailwind-merge 3.7.0.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | AST codemod, class contexts only | PASS | 4,348 words (1,051 distinct) prefixed in 129 of 235 files of `src/components` and `src/lib` in about 3 s; a second run changes nothing; no word glued to a template substitution, no literal with an escape. `src/hooks`: no class literal, one `cn` → `wcn` rename (`useCollapsePresence`). Diff: 1,932 changed lines in 124 files of `src/components`, 76 in 5 files of `src/lib` (`cn.ts` itself is hand-written) |
| 2 | Compile check on the result (string-literal words) | PASS | 22 unprefixed utility words left, every place read: ARIA roles (`grid`, `group`, `table`), prop values (`outline`, `rounded`, `ring`, `inline`, `static`, `underline`), event names (`blur`, `resize`), style values (`absolute`, `relative`, `fixed`, `hidden`, `visible`, `collapse`), part keys and prose; none is a class |
| 3 | False positives | PASS | Changed literals grouped by context (726 `wcn` arguments, 602 map values, 56 `className=`, recipe constants, `return`s, `renderSlot` bases, two `let` assignments); every unusual context read; single-word map values that are also ARIA or prop words (`rounded`, `grid`, `flex`, `relative`) are in class maps; `variantShapes` (`'rounded'`, a Shape) stayed unprefixed |
| 4 | Prefixed `dist/styles.css` with `prefix(wave)` and `theme.css` `@theme inline reference` | PASS | No Tailwind theme variable and no self-referencing variable emitted; build-css's assertions pass (tokens and base rules shipped, `!important` kept, keyframes, the prefixed `REQUIRED_UTILITIES`, no foreign theme variables, no bare `rtl:`, every `wave-rtl:` class with Wave's variant, no stray class); the same 1,060 classes as 0.18.1 with the prefix stripped, all 1,073 rule bodies byte-identical, in the same order |
| 5 | Control: `@theme inline` without `reference` | as R6 predicts | Emits `:root,:host{--wave-shadow-2:var(--wave-shadow-2)…}` for all six shadows (it happens to precede the token rules, so it is order-dependent breakage, not immediate) |
| 6 | `wcn` and the public `cn` (8 `node:test` cases) | PASS | `wcn('wave:p-4','p-2')` = `p-2`; `wcn('wave:p-4','wave:p-2')` = `wave:p-2`; type ramp, shadow, font family, animate, duration and ease groups (internal and namespaced) conflict correctly; `wave:…:not-disabled:not-aria-disabled:hover:bg-primary` and `hover:bg-error` both kept, the unprefixed gate prefix replaces it; stable and app classes kept; `tw:p-2` (a `prefix(tw)` app) is kept next to `wave:p-4` (tailwind-merge reads `tw` as a variant: the layer decides); public `cn('text-wave-body-1 text-wave-foreground')` keeps both; the strip-only form merges identically; a pinned parse result fails on a tailwind-merge change |
| 7 | Pixels: prefixed vs 0.18.1, 3 engines × 17 screenshots × 6 setup pairs | PASS | 306 of 306 comparisons 0 pixels different at threshold 0 (diff ratio 0): plain vs plain, each prefixed Tailwind app (after, before, `prefix(tw)`, form B) vs the 0.18.1 `./tailwind` app, and the prefixed Tailwind app vs 0.18.1 plain. Controls: 0.18.1 `./tailwind` vs 0.18.1 plain 51/51 identical; 0.18.1 `./tailwind` in the shadcn-like app differs in 49 of 51 (ratio up to 0.44: Wave's buttons turn the app's black and white, the dark grid white), so the comparison sees a collision when there is one |
| 8 | A consumer `p-2` / `bg-wave-error` in a Tailwind app | PASS | Padding 8 px; background `rgb(197, 15, 31)`; the same with `tw:p-2` / `tw:bg-wave-error` in the `prefix(tw)` app (3 engines) |
| 9 | A plain-CSS class (`.app-plain-class{padding:2px 6px}`, unlayered, after Wave) | PASS | 2 px 6 px in every setup and engine |
| 10 | An unlayered app reset against plain `./styles` | PASS | With `*{margin:0;padding:0}` and with `button{padding:0}` Wave's button keeps its 12 px. In the layered `./tailwind` form the reset wins (0 px), as R6 lists; the 0.18.1 `./tailwind` app also gave 0 px |
| 11 | `[hidden]` with a display utility on the element | PASS | `display: none` in every form (unlayered, `components` layer, after an unlayered reset) and engine |
| 12 | `@starting-style` motion | PASS | Opening a Dialog starts opacity and scale transitions from opacity 0, and the backdrop's transition, as in 0.18.1 (3 engines) |
| 13 | `wave-rtl:` | PASS | Switch thumb at 23 px (LTR) and 3 px (RTL), Breadcrumb divider `scale: -1 1` in RTL, as in 0.18.1; through Vite's default CSS pipeline every one of the 17 `wave-rtl:` classes keeps the variant and none is lowered to `:lang()` |
| 14 | The app's own theme in the shadcn-like app | PASS | The app's `bg-primary rounded-md` element is the app's `oklch(0.205 0 0)` and 8 px, Wave's buttons keep `var(--wave-*)` (0.18.1 control: Wave's outline button became the app's `oklch(1 0 0)`) |
| 15 | An app's token override in `@layer base` (`:root{--wave-primary:…}`) | form A FAIL, form B PASS | The whole `./styles` in `components` (form A) ignores it (`#0f6cbd`); form B and 0.18.1 apply it; an unlayered override wins in every form. Hence the amended `./tailwind` |
| 16 | Forced colors | PASS | Identical to 0.18.1. Chromium and Firefox apply a forced palette; WebKit only matches the media query (the `forced-colors:` variants apply, the system colors do not) |
| 17 | Conventions gate on the prefixed `src` | PASS | 330 of 330 files pass unchanged; a file with six prefixed violations (`wave:transition-colors` without `motion-reduce:`, `wave:enabled:`, `wave:rtl:`, `wave:bg-[#…]`, `wave:focus:outline-none`, `wave:ml-2`) gets all six reported: the gate needs no change for the prefix |

**Measured sizes** (`measureImport` of `scripts/verify-dist.mjs`, on builds of the same scratch config; the 0.18.1 figures equal, byte for byte, the release sizes the JSDoc of `RECORDED_IMPORTS_0_18` gives, 0.17.1 plus the release growth):

| Import | 0.18.1 min / gzip | prefixed min / gzip | growth | of it, `wave:` × 5 B | 0.18 budget |
|---|---|---|---|---|---|
| `Button` | 11,079 / 3,865 | 12,024 / 4,018 | +945 / +153 | 145 words, 725 B | 11,591 / 4,057: exceeded |
| `Dialog` | 72,599 / 24,466 | 74,083 / 24,699 | +1,484 / +233 | 251 words, 1,255 B | 73,111 / 24,658: exceeded |
| `WaveProvider` + `Dialog` | 75,147 / 25,458 | 76,655 / 25,682 | +1,508 / +224 | | 75,659 / 25,650: exceeded |
| `DataGrid` | 73,306 / 24,926 | 74,866 / 25,153 | +1,560 / +227 | 265 words, 1,325 B | 73,822 / 25,113: exceeded |
| `MessageBar` | 29,221 / 10,201 | 30,485 / 10,385 | +1,264 / +184 | | 29,697 / 10,380: exceeded |
| `Tree` | 50,383 / 17,271 | 51,376 / 17,462 | +993 / +191 | | 50,899 / 17,452: exceeded |

The rest of each growth (about 220 to 235 B minified) is `wcn`'s configuration (the prefix, the parse function, the namespaced scales). Without `/* @__PURE__ */` on the two `extendTailwindMerge` calls every import carries the public `cn`'s configuration too (+96 B minified, +9 B gzip on Button). Every 0.18 budget is exceeded by the flip, as R7 expects: F2 re-sets them. `dist/styles.css`: 104,654 → 111,284 B (+6,630, +6.3 %; 6.3 B per prefixed rule), gzip 16,654 → 16,871 (+217), brotli 13,775 → 13,913. `dist/components.css` (form B's token-free sheet): 93,988 B, gzip 13,749. A Tailwind app's compiled CSS with the prefixed `./tailwind`: 116,937 B (gzip 18,279) against 117,901 B (18,559) with the 0.18.1 `./tailwind`. The prefix `wv` would save about 2 B per class word and per rule (about 290 B minified on Button, about 2.1 KB on `styles.css`, little after gzip); not needed, since `reference` is safe.

**Settled values.**
- Prefix `wave`; `src/styles/theme.css` holds the unnamespaced mapping as `@theme inline reference` (keyframes inside are emitted on use), imported only by the build.
- The `./tailwind` entry (form B):
  ```css
  @layer theme, base, components, utilities;
  @import './tokens.css' layer(theme);
  @import './variants.css';
  @import '../../dist/components.css' layer(components);
  ```
  `tokens.css` carries the token rules and the namespaced `@theme inline` keys (the spike kept them in a separate file); `dist/components.css` is a second build-css entry, `styles.css` without `tokens.css`. In either import order and in a `prefix(tw)` app it renders identically to 0.18.1.
- `wcn`:
  ```ts
  export const waveMerge = /* @__PURE__ */ extendTailwindMerge({
    prefix: 'wave',
    experimentalParseClassName: ({ className, parseClassName }) =>
      parseClassName(className.startsWith('wave:') ? className : `wave:${className}`),
    extend: {
      classGroups: { duration: [{ duration: DURATION }] },
      theme: {
        ease: EASE,
        text: [...TEXT, ...TEXT.map((v) => `wave-${v}`)],
        shadow: [...SHADOW, ...SHADOW.map((v) => `wave-${v}`)],
        font: FONT,
        animate: ANIMATE,
      },
    },
  });
  ```
  (`TEXT`, `SHADOW`, `DURATION`, `EASE`, `FONT`, `ANIMATE` as in today's `cn.ts`); the public `twMerge` keeps no prefix and lists only the namespaced `text` and `shadow` scales.
- Compile check allowlist: `absolute blur border collapse container filter fixed grid group hidden inline list-item outline relative resize ring rounded select-all static table underline visible` (string-literal words of `src/components` and `src/lib`; `src/hooks`, which the CSS build does not scan, adds only `absolute`, `collapse`, `container`, `fixed`).
- `[hidden]`'s `!important` survives layering.

**What contradicts or extends the spec** (R6 amended where marked):
1. "`./tailwind` imports the same file" cannot hold together with "the token rules … shipped once" and 0.18's token-override behaviour (check 15): a second, token-free sheet is needed.
2. The compile check cannot compile `src` with Tailwind's scanner: the scanner reads comments, and the prefixed `src` then generates 89 unprefixed classes, 67 of them from comments and JSDoc that name a class (`inline-flex`, `px-3`, `text-body-1`). It must read string literals. Its allowlist differs from today's `@source not inline` list in both directions (today's has comment-only words such as `end`, `start`, `lowercase`, `shadow`, `transform`, `sm:inline`, `text-input`, `hover:bg-error!`; it lacks `absolute`, `border`, `fixed`, `grid`, `group`, `hidden`, `relative`, `rounded`, `underline`, which 0.18 also used as classes).
3. Once prefixed, a comment word never generates a class, so the CLAUDE.md rule against bare utility names in `src` comments loses its reason (a comment naming a `wave:` class that no string uses would still be a stray class); Task 25 may restate it.
4. In an app without Tailwind, a consumer's Tailwind class (`p-2`, `bg-wave-error`) still replaces Wave's conflicting class through `wcn` but no longer has CSS (measured: the button loses its padding, 0 px): the generic-utilities item R6 lists. The guide should say: plain CSS classes (check 9) or `utilities.css` for the token utilities. In 0.18.1 `p-2` worked only because the sheet happened to contain it.
5. Tests (Task 22's classification): of the 685 tests of `Button.test.tsx`, `Dialog.test.tsx` and `DataGrid.test.tsx`, 104 fail on the prefixed `src`, every one on a class name (`toHaveClass('bg-primary')`, a `conflictingClass.overrides`, a class selector in `querySelector`, a markup comparison); the behaviour tests pass.
6. After the codemod `prettier --check` reports 61 files (lines get longer): F2 runs `prettier --write`.
7. An app's `var(--color-wave-primary)` in its own CSS makes Tailwind emit `--color-wave-primary: var(--wave-primary)` (as `var(--color-primary)` did in 0.18), so the migration codemod's `var(--color-*)` rewrite works as R6 says.
8. Not tested (one Tailwind version only): the `--tw-*` `@property` skew between an app's Tailwind and Wave's, which R6 lists as shared.

The scratch tools (the codemod, the theme split, the setup builder, the screenshot, comparison and probe drivers, the `wcn` test and the measurements) are in the ignored workspace `.superpowers/sdd/2026-11-02-fluent-parity-phase-14/spike-codemod/`, for Tasks 19 to 23.
