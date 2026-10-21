# Phase 9 (0.14.0) Implementation Plan: collections, data grids and guided tours

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Fluent-parity gaps of Overflow, Breadcrumb, DataGrid, the static Table, List and TeachingPopover with opt-in props and parts that leave every 0.13 call unchanged.

**Architecture:** Overflow keeps its one store and replaces the cut loop with a priority loop, adding groups, `asChild` items and hooks. Breadcrumb builds on a pure `partitionBreadcrumbItems`, a `Menu` and (opt-in) Overflow. DataGrid becomes generic over its items with typed columns and built-in stable sorting; the sort button, glyphs and selection control are shared with the static Table through `Table.shared.tsx`. List gets a structural `navigationMode` and `onAction`. TeachingPopover moves its surface hooks into one internal surface used by both the `steps` form and new parts.

**Tech Stack:** React 19, TypeScript, Tailwind 4 (literal class maps only), Vitest + React Testing Library + vitest-axe.

**Spec:** `docs/superpowers/specs/2026-10-21-fluent-parity-phase-9-design.md` (rulings D1–D6, §2–§11). Read it and `CLAUDE.md` (C-* conventions) first. Work in this worktree; `node_modules` is not installed here: create a junction (`New-Item -ItemType Junction -Path <worktree>\node_modules -Target C:\code\packages\wave-ui-react\node_modules`) before the first test run, and remove it link-only (`cmd /c rmdir`) before deleting the worktree.

## Global Constraints

- Version 0.14.0; CHANGELOG section `## [0.14.0] - Unreleased` above `## [0.13.0]`.
- Behaviour-neutral (D2): every new prop defaults to the 0.13 behaviour; existing suites pass unchanged except for type assertions a widened type forces and the one 0.13 assertion each task names.
- C-CLASS: new enumerated props render their resolved value as `data-*` on the element that receives `className`, before `{...rest}`; every new part registers its constant in `src/lib/classNames.ts` in the same change; no class is removed.
- C-TOKENS/C-RADIUS/C-LOGICAL/C-MOTION as in `CLAUDE.md`: literal class maps only, gated hover/pressed, logical utilities and `wave-rtl:`, a `motion-reduce:` variant on every transition, no bare Tailwind words in `src` comments or strings.
- C-SLOTS for `sortIcon`, `aside`, `divider`, `media`, `checkmark`, `icon`, `dismissButton`; C-NAMING: value first, `details` second, `useControllable` for state, deprecated aliases through `resolveDeprecatedProp`/`warnDeprecated`; warning keys dotted.
- C-DEV: warnings from effects with `warnOnce`. C-COMPOUND: every new member also exported flat; `isElementOfType`/`flattenChildren`, never `child.type ===`; test with `asClientReference`.
- New public symbols go through the barrels; every named type in a public signature reaches the entry (`public-types.test.ts`). Pure helpers (`createTableColumn`, `partitionBreadcrumbItems`, `truncateBreadcrumbLongName`, `truncateBreadcrumbLongTooltip`, `isTruncatableBreadcrumbContent`) are in `src/lib`, server-safe.
- Tests: keep output clean (no act() warnings, no unasserted `[WaveUI]` warnings; `await act(async () => {})` after observer-driven updates); pointer and ResizeObserver helpers as in `CLAUDE.md` Testing.
- Commits: conventional subjects, **no attribution trailer** (project rule), one commit per task.

## Review Focus

1. Overflow: items whose widths differ (priority order versus DOM order), `minimumVisible` larger than the item count, an item that changes `priority`/`pinned`/`groupId` while mounted, a group whose members are all pinned, the default case (no priority/pinned) identical to 0.13.
2. DataGrid sorting: a column whose `compare` is not a total order, `items` replaced while sorted and selected, a controlled `sort` for a column without `compare`, rows with equal keys keeping their order in both directions, an empty `items`.
3. Row-click selection: a click on a link, button, input or portaled popup inside a row, a click that ends a text selection, a disabled-selection row with select-all, `selectOnRowClick` with `subtleSelection`.
4. List: `onAction` with `preventDefault()`, Space after typeahead, `navigationMode="items"` on a plain list with `onAction` items, an explicit `navigationMode` that changes while mounted, `disabledSelection` with `onAction`.
5. TeachingPopover: a step action that calls `preventDefault()`, `Trigger` with `target` also set, `Surface` written outside the root, focus return after Finish by a custom action, parts rendered in a Server Component (`asClientReference`).

---

## File structure

| File | Change |
|---|---|
| `src/components/layout/Overflow.tsx` (+ `Overflow.store.ts` if it grows) | priority loop, direction, orientation, groups, hooks, `asChild` |
| `src/lib/breadcrumb.ts`, `src/components/navigation/Breadcrumb.tsx` | partition and truncation helpers; collapse, size, focus mode, divider, responsive collapse |
| `src/lib/table.ts`, `src/components/table/DataGrid.tsx`, `Table.shared.tsx`, `Table.tsx` | `createTableColumn`, generic grid, sorting, selection options, shared sort and selection pieces, static parts |
| `src/components/data-display/List.tsx` | `navigationMode`, `onAction`, `disabledSelection`, `checkmark` |
| `src/components/overlays/TeachingPopover.tsx` (+ `.root.tsx`, `.context.ts`, `.parts.tsx`) | actions, `onFinish`, parts |
| `src/lib/classNames.ts`, `src/lib/icons.tsx`, barrels, `scripts/verify-dist.mjs` | constants, sort arrows, exports, helper probes |
| `stories/*`, `README.md`, `CHANGELOG.md`, `docs/*`, `CLAUDE.md` | stories and docs |

---

### Task 1: Overflow priority, pinned, direction, minimumVisible, orientation, onOverflowChange (P9-01)

**Files:** Modify `Overflow.tsx`; Test `src/components/layout/__tests__/Overflow.test.tsx`.

**Interfaces:** Produces `OverflowProps.overflowDirection?: 'end'|'start'`, `orientation?: Orientation`, `minimumVisible?: number`, `hasHiddenItems?: boolean`, `onOverflowChange?(hiddenItems: string[], details: OverflowChangeDetails)`; `OverflowItemProps` union `{ priority?: number; pinned?: never } | { pinned?: boolean; priority?: never }`; types `OverflowChangeDetails`, `OverflowGroupVisibility`, `OverflowDirection` (group map is `{}` until Task 2).

- [ ] **Step 1:** Failing tests (ResizeObserver mock, stubbed widths): hide order by `priority` (lowest first, equal priorities last-in-DOM first for `end`, first-in-DOM first for `start`); `pinned` never hidden; `minimumVisible`; the default (no priority, no pinned) hides exactly as 0.13 on the existing fixtures and item 0 stays visible; once any item sets `priority`/`pinned` item 0 is hidable; `orientation="vertical"` measures heights; `hasHiddenItems` reserves the button before the first measure; `onOverflowChange(hidden, { visibleItems, groupVisibility })` fires once per change, once in StrictMode, never during render; RTL with `start`.
- [ ] **Step 2:** Run `Overflow.test.tsx`; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement: item registration with metadata (re-measure on change); the victim loop described in spec §2 (hidden ids emitted in DOM order); rename the internal "button covers item 0" flag to `buttonCovers` and keep rendering `data-overflow-pinned` for it; vertical axis swaps width/height, column gap and the sticky edge; `onOverflowChange` through `useEventCallback` from an effect.
- [ ] **Step 4:** Run the Overflow suite, `npx tsc -p tsconfig.dev.json --noEmit`, eslint; all 0.13 Overflow tests pass unchanged.
- [ ] **Step 5:** Commit `feat(layout): Overflow priority, pinned items, direction and orientation`.

### Task 2: Overflow groups, Divider, hooks and asChild (P9-01)

**Files:** Modify `Overflow.tsx`, `src/lib/classNames.ts`, `src/components/layout/index.ts`; Test `Overflow.test.tsx`.

**Interfaces:** Produces `OverflowItem groupId?`, `OverflowItem asChild?`, `Overflow.Divider`/`OverflowDivider` (`groupId`), `useIsOverflowGroupVisible(groupId): OverflowGroupVisibility`, `useHasHiddenItems(): boolean`, `overflowDividerClassNames.root`; `groupVisibility` in `onOverflowChange` details.

- [ ] **Step 1:** Failing tests: a group is `visible`/`hidden`/`overflow` (mixed); `Overflow.Divider` hides with its group; both hooks update with the store and throw outside an Overflow in development; `asChild` merges onto a single `<li>` child (axe passes for `<ol>` > `<li>`), ref and handlers composed, hidden attributes land on the child; the default wrapper `<div>` unchanged; compound exposure, `asClientReference` for `OverflowDivider` and `OverflowItem`; a Toolbar + Overflow composition.
- [ ] **Step 2:** Run; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement groups in the store snapshot (a new object only when it changes), the divider, the hooks (context additions only: `groupVisibility`, `direction`, `hasHiddenItems`), `asChild` via the trigger-element merge.
- [ ] **Step 4:** Run Overflow suite, class-name and conventions gates for the file, tsc, eslint.
- [ ] **Step 5:** Commit `feat(layout): Overflow groups, divider, hooks and asChild items`.

### Task 3: Breadcrumb helpers (P9-02)

**Files:** Create `src/lib/breadcrumb.ts`, `src/lib/__tests__/breadcrumb.test.ts`; Modify `src/index.ts`.

**Interfaces:** Produces `partitionBreadcrumbItems<T>({ items: readonly T[]; maxDisplayedItems?: number; overflowIndex?: number }): { startDisplayedItems: T[]; overflowItems?: T[]; endDisplayedItems?: T[] }`, `PartitionBreadcrumbItemsOptions<T>`, `PartitionBreadcrumbItemsResult<T>`, `truncateBreadcrumbLongName(content: string, maxLength = 30)`, `truncateBreadcrumbLongTooltip(content: string, maxLength = 80)`, `isTruncatableBreadcrumbContent(content: string, maxLength: number)`.

- [ ] **Step 1:** Failing table tests of Fluent's rules (hides `length - max` from `overflowIndex`; index at or past max becomes `max - 1`; `0`/missing max is 6; fewer items than max gives no overflow; empty list) and truncation (`.trim().slice(0, n) + '...'`, exactly-at-limit text untouched).
- [ ] **Step 2:** Run; FAIL (module missing).
- [ ] **Step 3:** Implement, export from the entry (server-safe: imports nothing).
- [ ] **Step 4:** Run tests, `public-types`, tsc, eslint.
- [ ] **Step 5:** Commit `feat(lib): partitionBreadcrumbItems and the truncation helpers`.

### Task 4: Breadcrumb collapse, size, focus mode and divider (P9-02)

**Files:** Modify `Breadcrumb.tsx`, `src/lib/classNames.ts`; Test `Breadcrumb.test.tsx`.

**Interfaces:** Consumes Task 3. Produces `BreadcrumbProps.maxDisplayedItems?`, `overflowIndex?` (default 1), `overflowLabel?` (default `"More items"`), `size?: CoreSize` (`data-size`), `focusMode?: FocusMode` (`data-focus-mode`), `divider?: Slot<'span'>`; `breadcrumbOverflowClassNames`.

- [ ] **Step 1:** Failing tests: no props renders the 0.13 trail; with `maxDisplayedItems` the middle items collapse into a `…` Menu button named "More items" (localizable) holding `Menu.ItemLink`s for items with `href` and `Menu.Item`s otherwise; the current item and the first item are never hidden; an unmappable item warns once (`Breadcrumb:overflow-item`); sizes set `data-size` and text steps; `focusMode="arrow"` is one Tab stop with arrows (RTL tested) across links and the overflow button; `divider` replaces the chevron, `false` hides it, `null` keeps it, RTL mirror only on the default; axe; no import cycle (Menu never imports Breadcrumb).
- [ ] **Step 2:** Run; expect FAIL on the new cases only.
- [ ] **Step 3:** Implement on `flattenChildren` + `isElementOfType`; `useRovingTabIndex` for arrow mode.
- [ ] **Step 4:** Run Breadcrumb suite, conventions, tsc, eslint.
- [ ] **Step 5:** Commit `feat(navigation): Breadcrumb overflow menu, size, focus mode and divider`.

### Task 5: Breadcrumb responsive collapse (P9-02)

**Files:** Modify `Breadcrumb.tsx`; Test `Breadcrumb.test.tsx`.

**Interfaces:** Consumes Tasks 2 and 4. Produces `BreadcrumbProps.overflow?: 'none' | 'auto'` (default `'none'`, `data-overflow`).

- [ ] **Step 1:** Failing tests (ResizeObserver mock): `overflow="auto"` hides middle items first (lowest priority, from the start side), never the first or the current item; the Overflow button is the "More items" menu listing exactly the hidden items; resizing wider restores them in order; `<li>` markup passes axe; `none` renders no Overflow.
- [ ] **Step 2:** Run; FAIL on the new cases only.
- [ ] **Step 3:** Implement the trail as Overflow `asChild` items with priorities and `pinned` on the current item.
- [ ] **Step 4:** Run suite, tsc, eslint.
- [ ] **Step 5:** Commit `feat(navigation): Breadcrumb responsive collapse through Overflow`.

### Task 6: DataGrid typed columns and item rendering (P9-03)

**Files:** Create `src/lib/table.ts`; Modify `DataGrid.tsx`, `src/index.ts`; Test `DataGrid.test.tsx`, `src/lib/__tests__/table.test.ts`.

**Interfaces:** Produces `createTableColumn<T>(o: { columnId: string; label?: React.ReactNode; compare?: (a: T, b: T) => number; renderCell?: (item: T) => React.ReactNode; renderHeaderCell?: () => React.ReactNode; sortable?: boolean }): DataGridColumn<T>`; `DataGridColumn<T = unknown>` (`columnId`, deprecated `id`, `label: ReactNode`, `compare`, `renderCell`, `renderHeaderCell`, `sortable` default `compare !== undefined`); generic `DataGrid<T>` with `items?`, `getRowId?: (item: T) => string`, `columns?: readonly DataGridColumn<T>[]`; `DataGrid.Body` accepts `(item: T, index: number) => ReactNode` as children.

- [ ] **Step 1:** Failing tests: `items`+`columns` render header, rows and cells through `renderCell`; row ids from `getRowId`, default the item's index; `DataGrid.Body` render function; a ReactNode label and `renderHeaderCell`; `id` alias warns once; JSX-composed grids unchanged (existing suite); `expectTypeOf` for the generic column and that a 0.13 `DataGridColumn[]` still compiles; `createTableColumn` defaults.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement; a row-id context gives `DataGrid.Row` its `rowId`; rows memoised by id.
- [ ] **Step 4:** Run DataGrid suite (including the 0.13 no-re-render-on-sort test), `public-types`, tsc, eslint.
- [ ] **Step 5:** Commit `feat(table): DataGrid typed columns, items and createTableColumn`.

### Task 7: DataGrid built-in sorting, sortIcon and details (P9-03)

**Files:** Modify `DataGrid.tsx`; Create `Table.shared.tsx`; Modify `src/lib/icons.tsx`; Test `DataGrid.test.tsx`.

**Interfaces:** Consumes Task 6. Produces built-in stable sorting; `DataGrid.HeaderCell sortIcon?: Slot<'span'>`; `onSortChange(sort, details?: { event })`, `onSelectedItemsChange(items, details?: { event })`; internal `SortArrowUp/Down` icons and the shared sort button in `Table.shared.tsx`.

- [ ] **Step 1:** Failing tests: with `items` and `compare` the rows sort ascending/descending (descending negates `compare`, equal keys keep their order both ways); also when `sort` is controlled; a column without `compare` never sorts and the consumer's order stands; `aria-sort` on the header; `sortIcon` custom, `null`/`false` hides; `details.event` present and callbacks once in StrictMode; the legacy positional `onSortChange(columnId, direction)` and deprecated sort props still work (existing tests); no re-render storm (existing).
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement `slice().sort`; move the sort button and glyph rendering into `Table.shared.tsx` and replace the inline triangle with the arrow icons.
- [ ] **Step 4:** Run suite, tsc, eslint; update the README DataGrid example that used `reverse()` later in Task 17.
- [ ] **Step 5:** Commit `feat(table): DataGrid built-in sorting, sort icon and callback details`.

### Task 8: Table.HeaderCell sortable (P9-05)

**Files:** Modify `Table.tsx`, `Table.shared.tsx`, `src/lib/classNames.ts`, barrels; Test `Table.test.tsx`.

**Interfaces:** Produces `Table.HeaderCell sortable?`, `sortDirection?: 'ascending'|'descending'`, `onSortClick?(event)`, `sortIcon?: Slot<'span'>`, `aside?: Slot<'span'>`.

- [ ] **Step 1:** Failing tests: a sortable header renders a `<button>` inside `<th>` with `aria-sort` (`none` while no direction); clicking calls `onSortClick`; the glyph shows only with a direction, carries `data-direction`, is decorative; `aside` renders outside the button; a plain header is unchanged; axe; RTL.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement with the shared button; `unwrapButtonGlyph` for `sortIcon`.
- [ ] **Step 4:** Run suites, class-name gate, tsc, eslint.
- [ ] **Step 5:** Commit `feat(table): sortable Table.HeaderCell`.

### Task 9: DataGrid row-click selection and appearance (P9-04)

**Files:** Modify `DataGrid.tsx`, `Table.shared.tsx`, a shared event module; Test `DataGrid.test.tsx`.

**Interfaces:** Produces `selectOnRowClick?`, `selectionAppearance?: 'brand'|'neutral'|'none'` (`data-selection-appearance`), `subtleSelection?` (`data-subtle-selection`), `DataGrid.Row selectionCellProps?: { disabled?, invisible?, className?, 'aria-label'? }`, `DataGrid.SelectionCell` (`DataGridSelectionCell`).

- [ ] **Step 1:** Failing tests: a row click toggles only with `selectOnRowClick`; clicks on a button, link, input, a portaled popup, a header row and a click that ends a text selection never toggle; consumer `onClick` first, `preventDefault()` cancels; appearances set the data attribute and classes (`none` has no fill); subtle selection classes (hover/focus-within reveal, forced-colors and coarse-pointer always shown, `motion-reduce`); `selectionCellProps.disabled` is a native-disabled input, ignored by row click and select-all; `DataGrid.SelectionCell` is select-all in a header and the row toggle in a row, and the automatic header slot skips a header that holds one; keyboard selection and `aria-multiselectable` unchanged; axe per appearance; compound exposure.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement; move List's foreign-event and interactive-selector helpers to a shared module used by both; mark `SelectionCell` like Nav's part marker.
- [ ] **Step 4:** Run DataGrid and List suites, tsc, eslint.
- [ ] **Step 5:** Commit `feat(table): DataGrid row-click selection, selection appearance and SelectionCell`.

### Task 10: Table.SelectionCell, CellLayout and CellActions (P9-05)

**Files:** Modify `Table.tsx`, `Table.shared.tsx`, `src/lib/classNames.ts`, barrels; Test `Table.test.tsx`.

**Interfaces:** Produces `Table.SelectionCell` (`type`, `checked: boolean|'mixed'`, `defaultChecked`, `onCheckedChange(checked, details?)`, `name`, `subtle`, `invisible`), `Table.CellLayout` (`media`, `description`, `truncate`, `appearance`), `Table.CellActions` (`visible`); flat names and constants; `group/row` on `Table.Row` and `DataGrid.Row`.

- [ ] **Step 1:** Failing tests: the cell renders the grid's native input (checkbox or radio, `mixed` sets indeterminate), controlled and uncontrolled, control props reach the input (C-ROUTING), StrictMode once; `CellLayout` media/description/truncate classes and the fixed avatar size context; `CellActions` hidden until row hover/focus-within, `visible`, forced-colors and coarse pointer, logical `end-0` (RTL), keeps the striped row rule; axe; compound exposure and `asClientReference`.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement on the shared control.
- [ ] **Step 4:** Run table suites, gates, tsc, eslint.
- [ ] **Step 5:** Commit `feat(table): Table.SelectionCell, CellLayout and CellActions`.

### Task 11: List navigation mode, onAction, disabledSelection and checkmark (P9-06)

**Files:** Modify `List.tsx`, `List.registry.ts`; Test `List.test.tsx`.

**Interfaces:** Produces `List navigationMode?: 'none'|'items'|'composite'`, `List checkmark?: boolean`, `List.Item onAction?(event)`, `disabledSelection?`, `checkmark?: Slot<'span'>`, `data-disabled-selection`.

- [ ] **Step 1:** Failing tests: unset mode behaves as 0.13 (all existing suites); `items` on a plain list gives roving tab stop, arrows, Home/End and typeahead and no `aria-selected`; `composite` pins the grid structure with no item remount when actions appear; `items` with selection and actions warns and acts as composite; `onAction` on click and Enter, Space on a non-selectable item, order consumer `onClick` → `onAction` → selection unless `preventDefault()`; a warning for `onAction` on a non-navigable item; `disabledSelection` blocks toggling, `aria-disabled` only without `onAction`, stays in the arrow order; `checkmark` per item and List-level, decorative, forced colors; RTL composite; axe.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement; stop pre-preventing in the option key handler so `onAction` runs first.
- [ ] **Step 4:** Run List suites, tsc, eslint.
- [ ] **Step 5:** Commit `feat(data-display): List navigation mode, onAction, disabledSelection and checkmark`.

### Task 12: TeachingPopover footer actions and onFinish (P9-07)

**Files:** Modify `TeachingPopover.tsx`, `src/lib/classNames.ts`; Test `TeachingPopover.test.tsx`.

**Interfaces:** Produces `TeachingPopoverStep primaryAction?/secondaryAction?`, root `primaryAction?/secondaryAction?`, `footerLayout?: 'horizontal'|'vertical'` (`data-layout`), `onFinish?()`, constants `primaryButton`, `secondaryButton`.

- [ ] **Step 1:** Failing tests: a single-step tip with a "Learn more" secondary and a "Got it" primary; step actions replace Next/Done and Back on that step only, root actions are defaults; a consumer `onClick` runs first and `preventDefault()` keeps the popover open; Done calls `onFinish` and `onDismiss` (documented), Close and Escape only `onDismiss`; vertical layout; the whole 0.13 focus block (initial focus, return, Back self-disabling) green unedited; axe.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement `finish()`.
- [ ] **Step 4:** Run suite, tsc, eslint.
- [ ] **Step 5:** Commit `feat(overlays): TeachingPopover footer actions and onFinish`.

### Task 13: TeachingPopover split, context, Surface and Trigger (P9-08)

**Files:** Create `TeachingPopover.root.tsx`, `TeachingPopover.context.ts`, `TeachingPopover.parts.tsx`; Modify `TeachingPopover.tsx`, barrels, classNames; Test `TeachingPopover.test.tsx`.

**Interfaces:** Produces `TeachingPopover.Trigger`, `TeachingPopover.Surface`, the context (null default, `reportMissingContext`), an internal `TeachingSurface` holding the surface hooks; flat names.

- [ ] **Step 1:** Failing tests: the existing suite unchanged and green after the move; `Trigger` toggles, sets `aria-expanded`/`aria-haspopup="dialog"` and is the target when `target` is unset; `defaultOpen` is `false` when a `Trigger` is a direct child; `Surface` receives `rest`/`ref`/`className` like the root does; `Surface` outside the root warns (`TeachingPopover.Surface:placement`); parts outside throw in development; RSC flat names with `asClientReference`.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Move without reordering effects; one state for both forms.
- [ ] **Step 4:** Run suite and conventions import tests, tsc, eslint.
- [ ] **Step 5:** Commit `feat(overlays): TeachingPopover Surface and Trigger parts`.

### Task 14: TeachingPopover Header, Title, Body and Footer (P9-08)

**Files:** Modify `TeachingPopover.parts.tsx`, classNames, barrels; Test `TeachingPopover.test.tsx`.

**Interfaces:** Produces `Header` (`icon`, `dismissButton` slots, dismiss merge rules), `Title` (`as`, hidden step position), `Body` (`media`), `Footer`; defaults from the current step when no children.

- [ ] **Step 1:** Failing tests: parts with no children render the step's defaults and match the `steps` form's markup; a `dismissButton` Button merges onto the wired close button and keeps `labelInName`; `Title` `as`; `media`; custom children replace defaults; compound exposure, `asClientReference`, axe.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run suite, gates, tsc, eslint.
- [ ] **Step 5:** Commit `feat(overlays): TeachingPopover Header, Title, Body and Footer parts`.

### Task 15: TeachingPopover carousel parts (P9-08)

**Files:** Modify `TeachingPopover.parts.tsx`, classNames, barrels; Test `TeachingPopover.test.tsx`.

**Interfaces:** Produces `Carousel`, `CarouselNav` (interactive page buttons, opt-in), `CarouselPageCount` (render function `(current, total)`), `CarouselFooter` (`layout: 'offset'|'centered'`, `initialStepText`, `finalStepText`).

- [ ] **Step 1:** Failing tests: a three-step tour built entirely from parts advances and finishes; `CarouselNav` buttons name their page, mark `aria-current`, are Tab stops, and jump to a step; the 0.13 decorative dots are unchanged without it; `CarouselPageCount` text and render function; `CarouselFooter` texts at the first and last step; focus handling intact; RSC flat names; axe.
- [ ] **Step 2:** Run; FAIL on new cases only.
- [ ] **Step 3:** Implement on the shared context.
- [ ] **Step 4:** Run suite, tsc, eslint.
- [ ] **Step 5:** Commit `feat(overlays): TeachingPopover carousel parts`.

### Task 16: INTEGRATION — barrels, registry, public types, dist probes

**Files:** Modify `src/index.ts`, layout/navigation/table/data-display/overlays barrels, `src/lib/classNames.ts` (any missing), `src/__tests__/integration.test.tsx`, `public-types.test.ts`, `classNames.test.ts`, `scripts/verify-dist.mjs` and `scripts/__tests__/verify-dist.test.mjs`.

- [ ] **Step 1:** Failing tests: barrel lists every new name and flat equality (`OverflowDivider`, `TeachingPopover` parts, `Table.SelectionCell` …); `public-types` for the new types; `HOOK_PROBES_0_14` for `createTableColumn`, `partitionBreadcrumbItems` and the truncation helpers (module present, no component, no React) with fixture modules in `verify-dist.test.mjs` (the 0.13 `withPhase8Modules` pattern); integration compositions: a Breadcrumb with a Tooltip on a truncated name, an Overflow of Toolbar buttons with grouped dividers, a DataGrid with `items`, sort, row-click selection and a Menu in a cell, a Table with sortable headers and `CellActions`, a List in `composite` mode with `onAction` inside a Dialog, a tour from parts with a Trigger, Server Component cases (`asClientReference`) for each new compound member.
- [ ] **Step 2:** Run `npx vitest run src/__tests__ scripts/__tests__/verify-dist.test.mjs`; expect FAIL.
- [ ] **Step 3:** Add exports and probes; fix JSDoc on every exported part (verify-dist C-DOCS).
- [ ] **Step 4:** `npm run build`, `node scripts/verify-dist.mjs --final`, the files above; expect PASS and exit 0.
- [ ] **Step 5:** Commit `feat: export the Phase 9 parts and helpers; dist probes`.

### Task 17: Stories and documentation

**Files:** Modify stories of Overflow, Breadcrumb, DataGrid, Table, List, TeachingPopover; `README.md`, `docs/WAVE-UI-GUIDE.md`, `CHANGELOG.md`, `docs/ROADMAP.md`, `CLAUDE.md`.

- [ ] **Step 1:** Stories (defaults in `args`, `fn()` callbacks, accessible names, tokens only): Overflow priority and groups, Toolbar + Overflow; Breadcrumb collapse, responsive, sizes, arrow focus, divider, truncation with Tooltip; DataGrid typed columns and built-in sorting, row-click selection, appearances and subtle selection; Table sortable headers, SelectionCell, CellLayout, CellActions; List modes and `onAction`; TeachingPopover actions and a tour from parts. Run `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Overflow|Breadcrumb|DataGrid|Table|List|TeachingPopover"`.
- [ ] **Step 2:** CHANGELOG `## [0.14.0] - Unreleased` (Added, Changed, Deprecated: the `DataGridColumn.id` alias; Size; "Upgrading from 0.13": `DataGridColumn` and `DataGrid` become generic, `label` widens to ReactNode, `onSortChange` gains `details`, Done calls `onFinish` as well as `onDismiss`).
- [ ] **Step 3:** README: component rows, usage notes (Overflow priority and groups, Breadcrumb collapse, "Sorting and selecting in a DataGrid" rewritten for built-in sorting with the `reverse()` example fixed, Table parts, List modes, TeachingPopover parts), hooks/utilities rows, "Upgrading from 0.13". Guide catalog entries; CLAUDE.md architecture (new modules, the 0.14 design reference); ROADMAP "Built as" note recording spec §11.
- [ ] **Step 4:** `npm run format:check`, `node scripts/build-css.mjs`, `npx eslint --max-warnings 0 stories src scripts`; expect clean.
- [ ] **Step 5:** Commit `docs: stories, CHANGELOG, README, guide, roadmap and CLAUDE.md for 0.14`.

### Task 18: Gate, review, browser check and release

**Files:** none (fixes as the gate and review find them).

- [ ] **Step 1:** `node scripts/claude/gate.mjs --base main`; expect "Gate PASSED" and clean test output.
- [ ] **Step 2:** Final whole-branch review by a fresh most-capable reviewer with the Review Focus section; fix Critical and Important findings in one pass, each with a failing test first.
- [ ] **Step 3:** Real-browser pass in Storybook (port 6007): Overflow resize and groups, Breadcrumb collapse at several widths, DataGrid sort and row click, subtle selection and forced colors, CellActions background over striped rows, List modes, a tour from parts with focus return. Record findings; fix or ledger.
- [ ] **Step 4:** Release as `docs/RELEASING.md` says (version 0.14.0, dated CHANGELOG, `check-release.mjs v0.14.0 --registry`, `chore(release): 0.14.0`, merge `--no-ff` into main, push, tag `v0.14.0`, watch the Release run, verify `npm view` dist-tags and attestations). Merge, push and tag only when the maintainer says to release.
- [ ] **Step 5:** Remove the `node_modules` junction (link only), then the worktree and the merged branch.
