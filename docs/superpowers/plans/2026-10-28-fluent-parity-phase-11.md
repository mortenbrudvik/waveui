# Phase 11 (0.16.0) Implementation Plan: tables and lists at data scale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DataGrid, List, Listbox/Combobox/Dropdown and a new flat Tree correct and fast when most of their data is not rendered: data-scoped selection, headless table hooks, resizable columns, and a built-in fixed-size windowing primitive that the components consume, with 10,000-row, 10,000-option and 5,000-node stories inside the budgets of the spec.

**Architecture:** Pure, server-safe cores in `src/lib` (selection, window layout, column sizing, tree cascade, flat tree); public hooks on them (`useSelection`, `useVirtualWindow`, the table hooks, `useFlatTree`); each windowed component owns focus and calls `virtualWindow.layout(count, { keep })` itself, rendering the entries (items and spacer rows) it gets back; keyboard movement goes by logical index and asks the window to scroll an unmounted target into the range before focusing it.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + React Testing Library + vitest-axe, Vite library build. No new dependency and no new peer.

**Spec:** `docs/superpowers/specs/2026-10-28-fluent-parity-phase-11-design.md` (rulings R1–R20, §1–§17). Read it and `CLAUDE.md` first; the spec wins where this plan is silent. Work in `.claude/worktrees/fluent-parity-phase-11` (branch `feat/fluent-parity-phase-11`); the `node_modules` junction exists. Run every command in the foreground; do not wait on background monitors. IDE diagnostics about missing jest-dom matchers or unresolved modules are stale noise: `npm run typecheck` is the arbiter.

## Global Constraints

- Version 0.16.0; CHANGELOG section `## [0.16.0] - Unreleased` above `## [0.15.0]` (added in Task 21; earlier tasks add nothing there).
- Nothing public is removed and every type only widens. Existing suites stay green unedited **except** assertions that encode "selection is the rendered rows" (spec §5, §14.1); each such edit is listed in spec §16 by the task that makes it, with the reason.
- R1/R2: windowing is built in, headless and **fixed item size**; no dependency, no peer. R3: DataGrid stays a native `<table role="grid">` with spacer rows and `table-layout: fixed`. R4: no `noNativeElements`.
- R5: selection is a set of **string ids** held outside the DOM; select-all adds every selectable id of `items`; deselecting all removes **only the ids of `items`**. R6: ids everywhere, under DataGrid's names (`selectedItems`/`defaultSelectedItems`/`onSelectedItemsChange(selectedItems: string[], details?)`).
- R15: the component that owns focus calls `layout()` and renders the window. R12: the window keeps the focused (and pending-focus) index mounted. R17: resizing and windowing need the `columns` prop with `items`.
- R19: existing types are reused (`DataGridSort | null` with `{ columnId, direction }`, `DataGridColumn<T>`, `SelectionMode`, `SortDirection`). R20: the pure tree cascade moves to `src/lib/treeCascade.ts`.
- C-NAMING: value callbacks are `on<Value>Change(value, details?)`; extra data in a second `details` argument; labels in a `labels` object typed `<Component>Labels` (exported). C-CLASS: enumerated `data-*` attributes always rendered, a stable class from `src/lib/classNames.ts` first in `cn()` for every new public component and part, registered in the same change. C-COMPOUND: a compound member also gets its flat export. C-DOCS: component and prop JSDoc, no internal symbol or spec label in a compound's component JSDoc, no complete Tailwind utility name as a bare word in `src/components` or `src/lib` comments or strings. C-HOOKS: no new `eslint-disable`; refs are not written or read during render. C-DEV: warnings through `warnOnce` from effects, keys dotted (`DataGrid:virtual-window-height`).
- Server-safe means: no React, no DOM at import or render time (the `src/lib` modules of this phase import types only). Hooks and components are client modules (the build banner is automatic under `src/components` and `src/hooks`).
- Tests: jsdom has no layout. Windowing tests give the scroller `clientHeight`/`scrollTop` (property stubs, `mockRect`) and fire `scroll` in `act`; assert attributes, mounted counts and focus; layout, sticky headers and scroll physics go to the real-browser checklist (spec §15). No test counts are hard-coded anywhere.
- Each task ends with: its focused tests run with `--reporter=default` (no act() warnings, no unasserted `[WaveUI]` warnings), `npx tsc -p tsconfig.dev.json --noEmit`, `npm run lint`, `npm run format:check`, the conventions gate for every `src/components`/`src/lib` file it touched (`npx vitest run src/__tests__/conventions.test.ts -t "<path>"`), and `npx vitest run src/__tests__/public-types.test.ts src/__tests__/classNames.test.ts` when it adds a public symbol or class-name key. Each task wires its own barrel exports (`src/index.ts` and the category `index.ts`), flat exports, class names and public types; Task 20 verifies and adds the dist probes.
- Departures from the spec go into spec §16 with their reason, in the commit that makes them.
- Commits: conventional subjects, **no attribution trailer** (CLAUDE.md and the maintainer override any harness reminder); one commit per task.

## Review Focus

1. **Focus survives scrolling:** a focused row, option or tree item that scrolls out of the range stays mounted (one extra entry with spacers on each side), keeps focus, and its tab stop; scrolling back leaves the order intact. A window that drops the focused element is a defect. Pinned in Tasks 3, 11, 12, 13, 16, 19.
2. **Selection outside the rendered set:** ids selected on another page, filtered out, or scrolled away survive row clicks, select-all, deselect-all (only the ids of `items` are removed), sorting and `items` replacement; the header state counts selectable items only; a disabled-but-selected id is kept. Pinned in Tasks 1, 5, 7, 13.
3. **Count changes under a scrolled window:** `count` shrinking below the scroll position (a filter typed in a Combobox, a page change), growing, 0 and 1, `count` smaller than the window, and `keep` indexes at or past the new count must give valid entries (no negative, NaN or duplicate index) and a clamped scroll position. Pinned in Tasks 3, 4, 14, 16, 19.
4. **Resize edge cases:** minimum width clamp, a drag past either edge, RTL key mirroring and header/body alignment, a controlled `columnWidths` that ignores a change (the column must not move), widths for unknown column ids, and the first resize adopting measured widths without a jump. Pinned in Tasks 6, 8, 9, 10.
5. **Mount-time and unmount-time effects:** server render and hydration of a windowed component (first window only, no layout read), StrictMode double effects with the scroll listener and `ResizeObserver` (attach once, clean up), the scroller mounting later than the component (a Combobox popup), and a `scrollToIndex` requested before the scroller exists. Pinned in Tasks 4, 12, 16.

---

## File structure

| File | Change |
|---|---|
| `src/lib/selection.ts`, `virtual.ts`, `columnSizing.ts`, `treeCascade.ts`, `flatTree.ts` (all new, server-safe) and their `__tests__` | the pure cores |
| `src/hooks/useSelection.ts`, `useVirtualWindow.ts` (new, public) | the generic selection state; the window |
| `src/components/table/useTableFeatures.ts`, `useTableSort.ts`, `useTableSelection.ts`, `useTableColumnSizing.ts` (new, public) | the headless table state |
| `src/components/table/DataGrid.tsx`, `useGridNavigation.ts`, `Table.tsx`, `Table.resize.tsx` (new), `Table.shared.tsx` | data-scoped selection, sizing, windowing, the resize handle, navigation by data |
| `src/components/data-display/List.tsx`, `List.registry.ts` | windowing and the selection fix |
| `src/hooks/useListbox.ts`, `useActiveDescendant.ts`, `src/components/input/Combobox.tsx`, `Dropdown.tsx`, `Listbox.tsx`, `Option.tsx` | data mode, windowing, `onScrollToItem` |
| `src/components/layout/Tree.selection.ts` (cascade moved out), `useFlatTree.ts`, `FlatTree.tsx`, `FlatTree.item.tsx`, `FlatTree.context.ts` (new) | the flat tree |
| `src/lib/classNames.ts`, `src/index.ts`, category barrels, `src/__tests__/*`, `scripts/verify-dist.mjs` | keys, exports, probes, budgets, integration |
| `stories/*`, `README.md`, `CHANGELOG.md`, `docs/*`, `CLAUDE.md` | stories and docs |

---

## Package A: CORE

### Task 1: the selection core (`src/lib/selection.ts`)

**Files:** Create `src/lib/selection.ts`, `src/lib/__tests__/selection.test.ts`.

**Interfaces — Produces** (pure, server-safe; sets are never mutated, new sets returned):
```ts
export function toggleId(selected: ReadonlySet<string>, id: string, mode: SelectionMode, options?: { allowEmpty?: boolean }): Set<string>;
export function selectAllIds(selected: ReadonlySet<string>, selectableIds: readonly string[]): Set<string>;
export function clearIds(selected: ReadonlySet<string>, universe: readonly string[]): Set<string>;   // only ids of `universe` (R5)
export function summarizeSelection(selected: ReadonlySet<string>, universe: readonly string[], selectableIds?: readonly string[]): { all: boolean; some: boolean; none: boolean };
```
`SelectionMode` is the existing union from `src/lib/types.ts`. `toggleId`: multiple toggles; single selects the id and, when it is already selected, keeps it unless `options.allowEmpty` (callers whose current behaviour deselects pass `true`: read DataGrid's and List's single-mode click today and match them; the hooks of Task 2 and Task 5 default to `false`). `summarizeSelection`: `all` = `selectableIds` (default `universe`) is non-empty and every one is selected; `some` = an id of `universe` is selected and not `all`; else `none`.

- [ ] **Step 1 (tests, written first, run to see them fail):** `selection.test.ts` cases: toggle adds and removes in multiple mode and returns a new set (the argument is unchanged); single mode replaces the selection with the id, keeps a selected id selected, and clears it with `allowEmpty`; `selectAllIds` adds only the given ids and keeps foreign ones; `clearIds` removes the ids of the universe and **keeps ids outside it** (assert with a foreign id); `summarizeSelection` for empty universe (`none`, not `all`), all selectable selected, some, none, a selected **disabled** id (in `universe`, not in `selectableIds`) counts toward `some` but not `all`, a selected foreign id counts toward nothing; duplicate ids in the arrays are harmless; a 10,000-id universe finishes in one expression (no assertion on time).
- [ ] **Step 2:** implement the four functions; no imports except the `SelectionMode` type.
- [ ] **Step 3:** run the focused tests, `tsc -p tsconfig.dev.json`, lint, format, the conventions gate for `src/lib/selection.ts`.
- [ ] **Step 4: Commit** `feat(selection): pure selection core`.

### Task 2: `useSelection` (public hook)

**Files:** Create `src/hooks/useSelection.ts`, `src/hooks/__tests__/useSelection.test.tsx`; modify `src/index.ts` (export `useSelection`, `UseSelectionOptions`, `UseSelectionResult`).

**Interfaces — Consumes:** Task 1; `useControllable`, `useEventCallback`. **Produces** (spec §3.2):
```ts
export interface UseSelectionOptions { selectionMode: SelectionMode; selectedItems?: readonly string[]; defaultSelectedItems?: readonly string[]; onSelectedItemsChange?: (selectedItems: string[], details?: UseSelectionChangeDetails) => void; }
export interface UseSelectionChangeDetails { event?: Event; id?: string }
export interface UseSelectionResult { selectionMode: SelectionMode; selectedItems: ReadonlySet<string>; isSelected(id: string): boolean; toggle(id: string, event?: Event): void; select(id: string, event?: Event): void; deselect(id: string, event?: Event): void; toggleAll(universe: readonly string[], event?: Event): void; clear(event?: Event): void; }
```
`toggleAll(universe)` selects every id of `universe` when not all are selected, else removes only the ids of `universe` (Task 1). The callback fires only on a real change, with a new mutable array.

- [ ] **Step 1 (tests first):** controlled and uncontrolled; controlled value wins and a parent that ignores the callback leaves state unchanged; the callback fires once per change and not for a no-op (toggle in single mode on the selected id, `select` of a selected id); StrictMode once-only (`renderWithProviders` in `<React.StrictMode>`); `toggleAll` with a foreign id kept; `clear` empties; `selectedItems` is referentially stable between renders without a change; `// @ts-expect-error` type cases (`selectionMode` required, callback gets `string[]`).
- [ ] **Step 2:** implement on `useControllable` (the value is `readonly string[]`, the exposed set is memoised on it).
- [ ] **Step 3:** run the verification list (add `public-types.test.ts`).
- [ ] **Step 4: Commit** `feat(hooks): useSelection`.

### Task 3: the window layout core (`src/lib/virtual.ts`)

**Files:** Create `src/lib/virtual.ts`, `src/lib/__tests__/virtual.test.ts`.

**Interfaces — Produces** (pure, server-safe):
```ts
export type VirtualEntry = { kind: 'item'; index: number } | { kind: 'spacer'; size: number; key: string };
export interface VirtualLayoutInput { count: number; itemSize: number; firstVisible: number; viewportSize: number; overscan: number; keep?: readonly number[] }
export function computeVirtualLayout(input: VirtualLayoutInput): readonly VirtualEntry[];
export function scrollOffsetForIndex(input: { index: number; align: 'auto' | 'start' | 'center' | 'end'; itemSize: number; count: number; scrollTop: number; viewportSize: number }): number;
```
Definitions (tests pin them): `visibleCount = ceil(viewportSize / itemSize)` (at least 1); `start = max(0, firstVisible - overscan)`; `end = min(count, firstVisible + visibleCount + overscan)` (exclusive); `firstVisible` is clamped to `[0, max(0, count - 1)]` first. Entries in order: a leading spacer of `firstIndex * itemSize` when that is above 0, item entries, a spacer of `gap * itemSize` between two non-adjacent index runs, a trailing spacer of `(count - 1 - lastIndex) * itemSize` when above 0. Indexes in `keep` that are integers in `[0, count)` and outside `[start, end)` are added as their own runs (sorted, de-duplicated); others are ignored. Spacer keys are `spacer-<index of the next item>` (`spacer-end` for the trailing one), stable for React. `count <= 0` returns `[]`. `scrollOffsetForIndex` returns the clamped `scrollTop` that puts the row at the requested alignment (`auto`: the minimum movement that makes it fully visible, the current `scrollTop` when it already is).

- [ ] **Step 1 (tests first):** the sum of item and spacer sizes equals `count * itemSize` in every case (property check over a table of inputs); count 0, 1, smaller than the window, exactly the window; `firstVisible` negative, NaN-free for `count` 0, and past the end; overscan 0; `keep` before, after and inside the range, duplicated, out of range, and with a non-integer (ignored); no duplicate index and ascending order; no zero-size spacer; keys unique; `scrollOffsetForIndex` for each `align`, at the first and last index, with `count * itemSize` smaller than the viewport (0), and `auto` when the row is already visible; a 10,000-count layout returns a small array (assert length ≤ window + 4).
- [ ] **Step 2:** implement; no imports.
- [ ] **Step 3:** run the verification list (conventions gate for `src/lib/virtual.ts`).
- [ ] **Step 4: Commit** `feat(virtual): pure window layout core`.

### Task 4: `useVirtualWindow` (public hook)

**Files:** Create `src/hooks/useVirtualWindow.ts`, `src/hooks/__tests__/useVirtualWindow.test.tsx`; modify `src/index.ts` (export `useVirtualWindow`, `VirtualWindow`, `VirtualEntry`, `UseVirtualWindowOptions`).

**Interfaces — Consumes:** Task 3. **Produces** (spec §3.3):
```ts
export interface UseVirtualWindowOptions { itemSize: number; overscan?: number /* @default 6 */; initialViewportSize?: number /* @default 480 */ }
export interface VirtualWindow { itemSize: number; scrollRef: React.RefCallback<HTMLElement>; layout(count: number, options?: { keep?: readonly number[] }): readonly VirtualEntry[]; scrollToIndex(index: number, options?: { align?: 'auto' | 'start' | 'center' | 'end' }): void }
export function useVirtualWindow(options: UseVirtualWindowOptions): VirtualWindow;
```
State is `{ firstVisible, viewportSize }`; it changes only when the first visible row (a row boundary) or the measured viewport changes; scrolling is read in a passive `scroll` listener batched with `requestAnimationFrame`; the viewport is observed with a `ResizeObserver` (feature-detected: absent means the initial size stays). A measured size of 0 (jsdom) uses `initialViewportSize`. `layout` is a pure function of the hook's state and its arguments (it reads no DOM). `scrollToIndex` sets `scrollTop` on the attached scroller (via `scrollOffsetForIndex`) and, if the scroller is not attached yet, remembers the request and applies it when `scrollRef` attaches. `scrollRef` attaches once per element (a stable callback), detaches listeners and the observer on `null`, and reads the initial `scrollTop` and size on attach. `itemSize` and `overscan` changing take effect on the next render.

- [ ] **Step 1 (tests first):** a harness component renders `layout(count)` entries as `<div data-index>`; with `clientHeight` stubbed to 440 and `itemSize` 44 it renders the first window (count of items = visible + overscan, spacer after); setting `scrollTop` and firing `scroll` in `act` (with `requestAnimationFrame` run) moves the window; **a scroll that stays inside one row does not re-render the harness** (render counter); `ResizeObserver` mock (`installResizeObserverMock`) growing the viewport widens the window; `scrollToIndex(5000, { align: 'start' })` sets `scrollTop` to `5000 * itemSize`, one before `scrollRef` attaches is applied on attach; `keep` keeps an out-of-range index mounted with spacers; `count` shrinking below the scroll position gives valid entries (Review Focus 3); `renderToString` with the default size renders the first window and no DOM read; StrictMode double effects attach one scroll listener and clean up (spy `addEventListener`/`removeEventListener` counts balance after unmount); unmounting with a frame pending sets no state (no act warning).
- [ ] **Step 2:** implement with `useState`, `useEventCallback`, a callback ref and a layout effect for the observer; no ref reads during render (C-HOOKS).
- [ ] **Step 3:** run the verification list.
- [ ] **Step 4: Commit** `feat(hooks): useVirtualWindow`.

---

## Package B: HEADLESS TABLE STATE (P11-01)

### Task 5: `useTableFeatures`, `useTableSort`, `useTableSelection`

**Files:** Create `src/components/table/useTableFeatures.ts`, `useTableSort.ts`, `useTableSelection.ts`, `src/components/table/__tests__/useTableFeatures.test.tsx`, `useTableFeatures.types.test.ts`; modify `src/components/table/index.ts`, `src/index.ts`.

**Interfaces — Consumes:** Tasks 1–2; `createTableColumn`/`DataGridColumn<T>` (`src/lib/table.ts`), `DataGridSort`, `SortDirection`. **Produces** (spec §4):
```ts
export interface TableRow<T> { item: T; rowId: string; index: number }
export type TableFeaturePlugin<T> = /* an opaque, stable descriptor returned by the plugin hooks; applied in array order */ …;
export interface TableFeaturesState<T> { items: readonly T[]; columns: readonly DataGridColumn<T>[]; getRowId: (item: T, index: number) => string; getRows(): readonly TableRow<T>[]; sort: TableSortState; selection: TableSelectionState; columnSizing: TableColumnSizingState }
export function useTableFeatures<T>(options: { items: readonly T[]; columns: readonly DataGridColumn<T>[]; getRowId?: (item: T, index: number) => string }, plugins?: readonly TableFeaturePlugin<T>[]): TableFeaturesState<T>;
export function useTableSort<T>(options?: { sort?: DataGridSort | null; defaultSort?: DataGridSort | null; onSortChange?: (sort: DataGridSort, details?: { event: Event }) => void }): TableFeaturePlugin<T>;
export function useTableSelection<T>(options: { selectionMode: SelectionMode; selectedItems?: readonly string[]; defaultSelectedItems?: readonly string[]; onSelectedItemsChange?: (selectedItems: string[], details?: { event?: Event; id?: string }) => void; isDisabled?: (item: T, index: number) => boolean }): TableFeaturePlugin<T>;
```
`TableSortState`: `{ value: DataGridSort | null; setColumnSort(columnId, direction, event?); toggleColumnSort(columnId, event?); getSortDirection(columnId): SortDirection | undefined }`. `TableSelectionState`: `{ selectionMode; selectedItems: ReadonlySet<string>; allRowsSelected: boolean; someRowsSelected: boolean; isRowSelected(id); toggleRow(id, event?); selectRow; deselectRow; toggleAllRows(event?); clearRows(event?) }`. `TableColumnSizingState` is declared in Task 6 and inert here (a `widths` map that is empty, setters that do nothing). Behaviour: `getRows()` returns rows in the order the plugins give (sorted when `useTableSort` is present), **referentially stable** while `items`, `getRowId`, the sort value and `columns` are unchanged; `allRowsSelected`/`someRowsSelected` are over every selectable item of `items` (R5); `toggleAllRows` selects every selectable id, or removes only the ids of `items`. The plugin hooks hold their state at the call site and return stable descriptors; `useTableFeatures` applies them without calling hooks in a loop or disabling a lint rule (the plugin array length changing between renders is a development warning once and the new array is applied). The comparator looks the column up once per sort. `getRowId` defaults to the index as a string. Duplicate row ids warn once (`useTableFeatures:duplicate-row-id`).

- [ ] **Step 1 (tests first):** sort asc/desc/toggle cycle (matches DataGrid's cycle: read its `toggle` order), stable sort for equal keys, controlled vs uncontrolled sort, `onSortChange` once per change; selection with 10,000 items where only 20 rows are ever read: `allRowsSelected` true after `toggleAllRows` and still true after the consumer renders a different slice; a selected id absent from `items` is kept and not counted; `isDisabled` rows are skipped by select-all and a selected disabled id leaves `allRowsSelected` true when every selectable id is selected; single mode; `getRows` identity stable across an unrelated re-render and changes with `items`; a plugin used twice warns; StrictMode once-only callbacks; types: `T` flows to `getRows()[0].item`, `isDisabled`'s parameter, and `columnId` string; plugins array is optional.
- [ ] **Step 2:** implement; export from the table barrel and `src/index.ts` with every type used in a signature.
- [ ] **Step 3:** run the verification list.
- [ ] **Step 4: Commit** `feat(table): useTableFeatures with sort and selection plugins`.

### Task 6: column sizing core, `useTableColumnSizing`, and the static-Table story

**Files:** Create `src/lib/columnSizing.ts`, `src/lib/__tests__/columnSizing.test.ts`, `src/components/table/useTableColumnSizing.ts`, `src/components/table/__tests__/useTableColumnSizing.test.tsx`, `stories/TableFeatures.stories.tsx`; modify the table barrel and `src/index.ts`.

**Interfaces — Produces** (spec §6.1, §6.3, R11, R18). Pure core:
```ts
export interface ColumnSizingOption { minWidth?: number; idealWidth?: number; defaultWidth?: number }
export const DEFAULT_COLUMN_WIDTH = 150; export const DEFAULT_MIN_COLUMN_WIDTH = 80;
export function resolveColumnWidths(columnIds: readonly string[], options: Record<string, ColumnSizingOption> | undefined, widths: Record<string, number> | undefined): Record<string, number>; // initial = defaultWidth ?? idealWidth ?? 150, clamped to minWidth; given widths override, clamped; unknown ids ignored
export function clampColumnWidth(width: number, option?: ColumnSizingOption): number;
export function totalWidth(columnIds: readonly string[], widths: Record<string, number>): number;
```
Hook:
```ts
export interface UseTableColumnSizingOptions { columnSizingOptions?: Record<string, ColumnSizingOption>; columnWidths?: Record<string, number>; defaultColumnWidths?: Record<string, number>; onColumnWidthsChange?: (widths: Record<string, number>, details: { columnId: string; width: number; event: Event }) => void }
export function useTableColumnSizing<T>(options?: UseTableColumnSizingOptions): TableFeaturePlugin<T>;   // plugin form, fills `columnSizing` of useTableFeatures
// state: { columnWidths; isSized: boolean; getColumnWidth(id); setColumnWidth(id, width, event?); getTableProps(): { style }; getColumnProps(id): { style }; getResizeHandleProps(id): ResizeHandleProps }
```
`isSized` is true once any width is state (a `setColumnWidth`, `columnWidths` or `defaultColumnWidths` given); `getTableProps()` returns `tableLayout: 'fixed'` and either `{ width: '100%', minWidth: sum }` (not sized) or `{ width: sum }` (sized, R18). `getColumnProps(id)` returns `{ style: { width } }`. `setColumnWidth` clamps to `minWidth` (no maximum in 0.16) and fires `onColumnWidthsChange` once per call with the new map and `details`; a controlled `columnWidths` that ignores the change leaves the width unchanged. `ResizeHandleProps` is the prop object of `Table.ResizeHandle` (Task 9); declare its type here as `{ width: number; minWidth: number; onResize(width: number, details: { event: Event }): void }`.

- [ ] **Step 1 (tests first):** core: defaults, `idealWidth` and `defaultWidth` precedence, clamp, unknown ids ignored, controlled override, total; hook: not-sized vs sized table props, a resize flips `isSized`, controlled value ignored by the parent, callback once per call (StrictMode), min clamp, `getColumnProps` for an unknown id returns the default width.
- [ ] **Step 2:** implement; **Step 3:** the story `Components/Table/Features`: a static `Table` built from `useTableFeatures` with `useTableSort`, `useTableSelection` and `useTableColumnSizing`, a `<colgroup>`, sortable headers, a select-all checkbox (checked/mixed from `allRowsSelected`/`someRowsSelected`), 200 rows (`args` defaults, callbacks via `fn()`, accessible names). The story uses a plain header; Task 8 adds the resize handle to it.
- [ ] **Step 4:** run the verification list plus `npx vitest run src/__tests__/stories.a11y.test.tsx -t "Table"`.
- [ ] **Step 5: Commit** `feat(table): useTableColumnSizing and the table features story`.

---

## Package C: DATA-SCOPED GRID SELECTION (P11-02)

### Task 7: DataGrid selection follows the data

**Files:** Modify `src/components/table/DataGrid.tsx` (the `SelectionStore` at `createSelectionStore`, `toggleRow`, `toggleAll`, the header cell's state, the single-mode resolution, the prop JSDoc of `selectedItems`/`onSelectedItemsChange`), `src/components/table/__tests__/DataGrid.test.tsx`; create `stories/DataGridPaging.stories.tsx` content inside `stories/DataGrid.stories.tsx` (a `Paging` story).

**Interfaces — Consumes:** Task 1. **Produces:** new prop `isSelectionDisabled?: (item: T, index: number) => boolean` on DataGrid (spec §5.2) and the behaviour of spec §5.1, §5.3 **only when `items` is given**; a grid built from `DataGrid.Row` children keeps today's semantics exactly.

Behaviour to implement: the selected ids live in the root state as today, but (a) a row click, Space and the selection cell change one id and never prune ids that are not mounted; (b) `onSelectedItemsChange` reports every selected id; (c) the store receives the **universe** (row ids in `items` order, and the selectable subset after `isSelectionDisabled` and any mounted row's `disabled`) from the `itemRows` the root already builds, and the header state is `summarizeSelection(selected, universe, selectable)`; select-all selects every selectable id, deselect-all removes only the ids of `items` (Task 1); (d) the store keeps its per-row subscription so select-all stays O(1) in notifications (the existing 1000-row cost test stays green); registration remains only for the selection label and the mounted row's disabled flag; (e) single mode keeps the id (spec §5.1); (f) a mounted row whose `DataGrid.SelectionCell disabled` disagrees with `isSelectionDisabled` warns once (`DataGrid:selection-disabled-mismatch`).

- [ ] **Step 1 (tests first, RED):** with 100 `items` and a mocked rendering of only some rows (render a grid with `items` of 100 and click row 3 then select-all): select-all selects all 100 ids (assert `onSelectedItemsChange` called with 100 ids, not the mounted count); header `aria-checked`/mixed from the data; a row click keeps selected ids of unmounted/filtered rows (re-render with `items` filtered to 10 after selecting ids outside it; click a row; assert the outside ids are still reported); deselect-all after filtering removes only the filtered ids; `isSelectionDisabled` rows are skipped by select-all and a selected one stays selected; the mismatch warning (asserted text); single mode keeps the id after `items` changes and replaces on click; the children form (`DataGrid.Row`) tests unchanged and green; the 1000-row cost test unchanged and green.
- [ ] **Step 2:** GREEN: implement; update the JSDoc of the three props (the paragraph about ids of rows that are not rendered is rewritten) and the component docs.
- [ ] **Step 3:** edit the existing assertions that encode the old behaviour (search the DataGrid suite for "not rendered", "left out", "dropped"); list each in spec §16 with the reason.
- [ ] **Step 4:** the `Paging` story: 200 items, pages of 20 with Previous/Next buttons, ids selected on page 1 stay selected on page 2, a live "N selected" readout (a status region), select-all on the page's header.
- [ ] **Step 5:** run the verification list plus the DataGrid suite and `stories.a11y.test.tsx -t "DataGrid"`.
- [ ] **Step 6: Commit** `feat(datagrid): selection follows the data`.

---

## Package D: RESIZABLE COLUMNS (P11-03)

### Task 8: `Table.ResizeHandle`

**Files:** Create `src/components/table/Table.resize.tsx`, `src/components/table/__tests__/TableResizeHandle.test.tsx`; modify `Table.tsx` (compound member + flat `TableResizeHandle`), `src/lib/classNames.ts` (`tableClassNames.resizeHandle`), barrels, `stories` (a `ResizeHandle` story in the Features story).

**Interfaces — Produces** (spec §6.3, §6.4):
```ts
export interface TableResizeHandleProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onResize'> {
  width: number; minWidth?: number; maxWidth?: number;
  onResize: (width: number, details: { event: Event }) => void;
  onReset?: (details: { event: Event }) => void;     // double click
  onLeave?: () => void;                              // Enter, Space, Escape
  /** @default 'Resize column' */ label?: string;
  /** Builds `aria-valuetext`. @default (w) => `${w} pixels` */ valueText?: (width: number) => string;
  ref?: React.Ref<HTMLDivElement>;
}
```
It renders `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` (only when `maxWidth` is set), `aria-valuetext`, `aria-label`, `tabIndex={-1}`, `data-grid-auxiliary=""`, and `data-dragging` (boolean) while a pointer drag runs; stable class `tableClassNames.resizeHandle`. Pointer: `pointerdown` (primary button, `setPointerCapture`) starts a drag reading the width at the start; `pointermove` batched in `requestAnimationFrame` calls `onResize(startWidth ± delta)` with the delta mirrored in RTL (`getDirection`); `pointerup`/`pointercancel`/`lostpointercapture` end it; the cursor and hit area are classes, the line uses a system color in forced colors and shows on hover and `focus-visible` (C-FOCUS: `focusRing`). Double click calls the optional `onReset?: (details: { event: Event }) => void` (Task 9 passes the column's initial width). Keyboard: ArrowLeft/ArrowRight ±20 px, Shift ±5 px, direction through `getArrowIntent(key, { orientation: 'horizontal', dir: getDirection(el) })` (ArrowRight grows in LTR, ArrowLeft in RTL), Home sets `minWidth`, End sets `maxWidth` when set; Enter, Space and Escape call the optional `onLeave?: () => void` (Task 10 returns focus to the header cell); every handled key calls `preventDefault()` and `stopPropagation()` so the grid does not also move.

- [ ] **Step 1 (tests first):** attributes (`aria-valuenow` follows `width`, `aria-valuemax` absent without `maxWidth`, `aria-label` default and override, `aria-valuetext` default and custom); pointer drag with the pointer-capture stubs (`Element.prototype.setPointerCapture` etc., `pointerType` mouse, touch, pen, `isPrimary: true`): a 40 px move calls `onResize` with `width + 40` (LTR) and `width - 40` under `dir: 'rtl'`, rAF batching (several moves, one call per frame), no call below `minWidth` (the component clamps), a non-primary button ignored; keyboard step sizes and RTL mirroring with `user.keyboard`, Shift step, Home/End, Enter/Space/Escape call `onLeave` and do not bubble; double click calls `onReset`; `data-dragging` present only during a drag; `testSystemProps` (ref, rest spread, className merge, displayName `TableResizeHandle`), axe, `testCompoundExposure` (`Table.ResizeHandle === TableResizeHandle`), the stable class.
- [ ] **Step 2:** implement; compound member with `/* @__PURE__ */`; JSDoc on the member (C-DOCS), no spec labels.
- [ ] **Step 3:** run the verification list (+ `public-types`, `classNames`, `stableClassNames` table test).
- [ ] **Step 4: Commit** `feat(table): Table.ResizeHandle`.

### Task 9: DataGrid column sizing

**Files:** Modify `src/components/table/DataGrid.tsx` (props, labels, colgroup, header handle, table style, truncation), `__tests__/DataGrid.test.tsx` (new `DataGrid.resize.test.tsx` beside it for this task), `src/lib/classNames.ts` if a `colgroup` key is not wanted (columns are `<col>` elements and need no class); stories.

**Interfaces — Consumes:** Tasks 6, 8. **Produces** (spec §6.1, §6.2, R9, R17, R18): props `resizableColumns?: boolean`, `columnSizingOptions`, `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange`; `DataGridLabels` gains `resizeColumn?: string` and `columnWidth?: (width: number) => string` (defaults "Resize column", "N pixels"). Requires `columns` with `items`: without them the props are ignored and one warning is emitted (`DataGrid:resizable-columns-require-columns`).

Behaviour: the table renders `<colgroup>` with one `<col>` per column (the selection cell's column keeps its existing fixed width and gets no handle) and the style from `useTableColumnSizing`'s `getTableProps()`/`getColumnProps()` (the grid uses the Task 6 core directly, not the plugin); each header cell of a column gets a `Table.ResizeHandle` in its `aside` slot (the last column too) with `onResize` wired to `setColumnWidth(columnId, width, event)` and `onReset` to the column's initial width; on the **first** resize of an unsized grid the grid reads each header cell's `getBoundingClientRect().width`, adopts the measured widths as the state (`isSized` becomes true) and then applies the change, so there is no jump (R18); cells of a sized grid truncate (`overflow-hidden text-ellipsis whitespace-nowrap`) unless the cell sets otherwise; `data-resizing` boolean on the grid while a handle drags (so the header cells ignore pointer events through a data-attribute variant, not inline styles); the header cell's sort button keeps working beside the handle.

- [ ] **Step 1 (tests first):** `<colgroup>` with the right number of `<col>` and widths from options/defaults/controlled; `table-layout` and the table width rule before and after a resize (R18); a drag through the handle fires `onColumnWidthsChange(widths, { columnId, width, event })` once per frame with the full map; controlled `columnWidths` that the parent does not update leaves the `<col>` unchanged; the first resize adopts measured widths (stub `getBoundingClientRect` on the header cells) without changing the other columns' rendered widths; min clamp; RTL (`dir: 'rtl'`) pointer and key directions; the selection column has no handle; `resizableColumns` without `columns` warns once (asserted); labels override; a sortable resizable header: clicking the sort button still sorts and the handle is not a sort target; axe on the story.
- [ ] **Step 2:** implement; update the DataGrid component JSDoc and the props JSDoc (C-DOCS), naming Fluent's `resizableColumns`/`columnSizingOptions`/`onColumnResize` and the `(widths, details)` shape.
- [ ] **Step 3:** story `Resizable` (args: `resizableColumns` true, default widths; a controlled variant that persists to a state readout); RTL decorator variants are provided by the toolbar, not new stories.
- [ ] **Step 4:** run the verification list plus `stories.a11y.test.tsx -t "DataGrid"`.
- [ ] **Step 5: Commit** `feat(datagrid): resizable columns`.

### Task 10: grid navigation for the resize handle (auxiliary widget, F2)

**Files:** Modify `src/components/table/useGridNavigation.ts`, `src/components/table/__tests__/useGridNavigation.test.tsx`, `DataGrid.tsx` (the header cell wiring).

**Interfaces — Produces** (spec §6.4, R16): the grid navigation ignores any widget with `data-grid-auxiliary` when it picks a cell's **target widget**; auxiliary widgets keep `tabindex="-1"` in navigation mode and take part in interaction mode (Tab order within the cell). **F2** on a cell, or on its target widget, when the cell contains an auxiliary widget, enters interaction mode and focuses the first auxiliary widget; Escape, and the handle's `onLeave` (Enter/Space/Escape), return focus to the cell (or, for a cell whose target is a widget, to that widget) and end interaction mode. Without an auxiliary widget the hook behaves exactly as in 0.15 (its whole suite is unedited and green). `DataGrid` passes `onLeave` to its handles.

- [ ] **Step 1 (tests first, in `useGridNavigation.test.tsx`, a small harness grid):** a header cell with a sort button and an auxiliary `separator`: the target is the button (Enter on it activates it), F2 moves focus to the separator, arrow keys then do not move between cells, Escape returns to the button and navigation mode; a cell with only an auxiliary widget: the cell is the target and F2 and Enter both focus the separator; Tab in interaction mode moves between the button and the separator; a grid without auxiliary widgets behaves as before (reuse an existing case unedited); then in `DataGrid.resize.test.tsx`: full path with the real handle (F2, ArrowRight ×2 → 40 px in LTR, mirrored in RTL, Enter returns focus to the header cell).
- [ ] **Step 2:** implement the rule in the widget collection and the F2 branch in the key handler; document the rule in the hook's JSDoc.
- [ ] **Step 3:** run the verification list (the whole `useGridNavigation` and DataGrid suites).
- [ ] **Step 4: Commit** `feat(datagrid): keyboard resize through an auxiliary header widget`.

---

## Package E: WINDOWING THE DATAGRID (P11-04a)

### Task 11: `useGridNavigation` by logical row (the `model` option)

**Files:** Modify `src/components/table/useGridNavigation.ts` and its test file.

**Interfaces — Produces** (spec §7.3): option `model?: GridNavigationModel`:
```ts
export interface GridNavigationModel { rowCount: number; headerRowCount: number; scrollToRow(index: number): void }
```
Row elements in a windowed grid carry `data-row-index` (0-based item index, stamped by DataGrid in Task 12). With a `model`: Up/Down/PageUp/PageDown and Ctrl+Home/Ctrl+End compute the **target row index from the model** (`rowCount`, `pageSize`) instead of the mounted rows; if the target row is mounted focus moves there, else the hook calls `model.scrollToRow(index)` and focuses the cell (same column) in the commit that mounts the row (a pending-focus request resolved in a layout effect that runs after the DOM changes — a `MutationObserver` already observes the table). Left/Right/Home/End within a row are unchanged. The hook's result gains `activeRowIndex: number | null` (the `data-row-index` of the row holding the tab stop, updated on focus moves; `null` for header rows or no stamp) so the owner can keep that row mounted; **the `sync` fallback to row 0 does not apply when the active cell's row index is still in the model's range** (the tab stop stays on the pending target; if no row with that index is mounted the first mounted row takes the tab stop until it mounts). Without `model` nothing changes (its suite is unedited and green).

- [ ] **Step 1 (tests first):** a harness table renders rows `start..end` of 1000 with `data-row-index`, spacer `<tr aria-hidden>` rows and a `scrollToRow` spy that re-renders the harness with a new window: Ctrl+End calls `scrollToRow(999)` once, then focuses the cell in row 999 after the re-render (assert by `data-row-index` of `document.activeElement.closest('tr')`); PageDown from row 10 targets row 20 (`pageSize` 10); Ctrl+Home from the middle; ArrowDown at the last mounted row targets the next index and focuses it after the scroll; ArrowUp at index 0 and ArrowDown at the last index do nothing; `activeRowIndex` follows focus; a harness that unmounts the active row (window moves away) keeps exactly one `tabindex="0"` cell in the grid and does not reset to row 0 when the row's index is in range; header-row keys (ArrowDown from the header to the first data row index 0); no-`model` behaviour covered by the existing suite.
- [ ] **Step 2:** implement; keep the DOM-walking code path for no-`model`.
- [ ] **Step 3:** run the verification list (the whole `useGridNavigation` suite, DataGrid suite).
- [ ] **Step 4: Commit** `feat(datagrid): grid navigation by logical row`.

### Task 12: DataGrid `virtualWindow`

**Files:** Modify `src/components/table/DataGrid.tsx`, `src/lib/classNames.ts` (`dataGridClassNames.spacer`), `__tests__/DataGrid.test.tsx` (new `DataGrid.virtual.test.tsx` beside it), `stories/DataGrid.stories.tsx` (a `TenThousandRows` story with a "Mounted rows: N of 10,000" readout).

**Interfaces — Consumes:** Tasks 4, 9 (sizing is independent of windowing), 11. **Produces** (spec §7.1, §7.2, R15, R17): prop `virtualWindow?: VirtualWindow` (requires `items` and `columns`; otherwise ignored with one warning `DataGrid:virtual-window-requires-items`).

Behaviour: `virtualWindow.scrollRef` is merged onto the grid's scroll wrapper (the element of `containerProps`, merged with the consumer's ref); `DataGrid.Body` renders `virtualWindow.layout(sortedRows.length, { keep: [activeRowIndex, pendingIndex] })` — item entries as the existing memoised row with `data-row-index`, `aria-rowindex = index + headerRowCount + 1` (position in the **sorted** order), `style={{ height: virtualWindow.itemSize }}`; spacer entries as `<tr aria-hidden="true" data-virtual-spacer class={dataGridClassNames.spacer} style={{ height: size }}><td colSpan={columnCount} /></tr>`; the table gets `aria-rowcount = items.length + headerRowCount` and the header row `aria-rowindex="1"` (only with a window); the header is sticky inside the scroller; `useGridNavigation` receives the model (`rowCount = items.length`, `scrollToRow = virtualWindow.scrollToIndex(index, { align: 'auto' })`); the grid warns once (`DataGrid:virtual-window-height`) when the scroller has no bounded height after mount (`scrollHeight > clientHeight` is false while the window has fewer entries than `count` — the check runs in an effect and only when `clientHeight > 0`); select-all, sorting and selection work on all `items` (Task 7), not on the window.

- [ ] **Step 1 (tests first):** 10,000 items, `clientHeight` 480, `itemSize` 44: at most 30 body `tr[data-row-index]` and two spacers (budget of spec §11), first row `aria-rowindex="2"`, table `aria-rowcount="10001"`; spacers `aria-hidden`; a scroll to the middle changes which rows are mounted and keeps the sum of heights constant; sorting by a column keeps `aria-rowindex` in sorted order and the first window shows the sorted head; **Ctrl+End** focuses the last row (`aria-rowindex="10001"`) and Ctrl+Home returns; PageDown/PageUp targets; a focused cell scrolled away stays mounted (scroll far, assert the focused row is still in the DOM with the spacer segments around it, Review Focus 1) and focus returns to the same row on scrolling back; select-all with the window selects 10,000 ids and the header is checked; deselect one → mixed; `renderToString` holds the first window and no rows past it; RTL; StrictMode; without `virtualWindow` no `aria-rowcount`/`aria-rowindex` (existing tests unedited); with `resizableColumns` (Task 9) the `<colgroup>` and spacer `colSpan` are right; axe on the story under jsdom (spacers must not violate `aria-required-children`/`aria-hidden-focus` — if axe objects, fix the markup, do not opt out).
- [ ] **Step 2:** implement; update the DataGrid JSDoc (prop `virtualWindow` with the height and fixed-row-height requirement, in words).
- [ ] **Step 3:** story: args `itemSize` 44, a 480 px container (class on `containerProps`), sortable columns, selection, the readout counts the mounted `tr[data-row-index]` rows in a layout effect of the story and sets state.
- [ ] **Step 4:** run the verification list plus `stories.a11y.test.tsx -t "DataGrid"`.
- [ ] **Step 5: Commit** `feat(datagrid): windowed rows`.

### Checkpoint (controller, not a task): early real-browser spike

After Task 12 the controller runs the spec §15 items 1, 2, 3, 4 and 7 for the DataGrid in Chromium, Firefox and WebKit (a browser-pass agent, as in Phase 10) **before Task 13 starts**: spacer rows, `table-layout: fixed` and a sticky header across engines are the plan's largest risk (spec §17.1). A failure is ruled on (fix in a new task, or the `<div>` grid fallback of R3) before any more windowing is built.

---

## Package F: WINDOWING LIST (P11-04b)

### Task 13: List windowing and selection that keeps unmounted values

**Files:** Modify `src/components/data-display/List.tsx`, `List.registry.ts`, `__tests__/List.test.tsx` (new `List.virtual.test.tsx`), `stories/List.stories.tsx`.

**Interfaces — Consumes:** Task 4. **Produces** (spec §8, R15): props `virtualWindow?: VirtualWindow` and `count?: number` on `List`; with both, `children` may be a function `(index: number) => React.ReactNode` (a `List.Item`); `List` calls `layout(count, { keep })` (the focused index, the pending-focus index), renders the entries (spacers as `<li aria-hidden="true" role="presentation" data-virtual-spacer style>`), attaches `scrollRef`, and provides each rendered item's index through context; `List.Item` in a windowed list gets `aria-setsize={count}` and `aria-posinset={index + 1}` and `data-index`. With `count` set (windowed), selection is the given `selectedValues` as is: the registry's `prune` is skipped and the `selected ∩ registered` intersection is not applied (Review Focus 2); unwindowed lists keep today's behaviour exactly. The registry's `syncOrder` uses the context index and tolerates spacer elements; roving container `itemSelector` still matches only items. A windowed list with array children, or a function child without `virtualWindow`/`count`, warns once (`List:virtual-window-children`).

- [ ] **Step 1 (tests first):** 10,000-count list renders at most 40 `li` items plus spacers; `aria-setsize`/`aria-posinset`; selected values outside the window survive a toggle and are reported by `onSelectedValuesChange` (the exact callback name is the list's existing one — read `List.tsx`); the unwindowed prune behaviour test stays unedited; the focused item stays mounted after scrolling away (Review Focus 1); `renderToString` first window only; RTL not applicable beyond logical properties (assert none added); warnings asserted; StrictMode.
- [ ] **Step 2:** implement; **Step 3:** story `Windowed` (10,000 items, selection readout).
- [ ] **Step 4:** run the verification list plus `stories.a11y.test.tsx -t "List"`.
- [ ] **Step 5: Commit** `feat(list): windowed lists and selection that keeps unmounted values`.

### Task 14: List keyboard by index

**Files:** Modify `src/components/data-display/List.tsx`, `List.virtual.test.tsx`.

**Interfaces — Produces** (spec §8): in `items` and `composite` navigation modes of a windowed list, Home/End/PageUp/PageDown and Up/Down at the window edge compute the target index from `count`, call `virtualWindow.scrollToIndex(index, { align: 'auto' })` when the target is not mounted, and focus the item in the commit that mounts it (a pending index resolved in a layout effect); typeahead matches the mounted items' labels only (stated in the prop JSDoc); the `useRovingTabIndex` tab stop is kept on the focused item; a focus-loss restore uses the item's index, not a DOM index.

- [ ] **Step 1 (tests first):** End focuses item 9999 (`aria-posinset="10000"`), Home returns, PageDown moves a page, ArrowDown from the last mounted item focuses the next index after the scroll, `none` mode is untouched, typeahead on mounted labels; a list whose `count` shrinks while focus is on a now-missing index moves the tab stop to the last item without throwing (Review Focus 3).
- [ ] **Step 2:** implement; **Step 3:** run the verification list.
- [ ] **Step 4: Commit** `feat(list): keyboard movement by index in windowed lists`.

---

## Package G: WINDOWING LISTBOX, COMBOBOX, DROPDOWN (P11-04c)

### Task 15: data mode for Listbox, Combobox and Dropdown

**Files:** Modify `src/hooks/useListbox.ts`, `useActiveDescendant.ts`, `src/components/input/Combobox.tsx`, `Dropdown.tsx`, `Listbox.tsx`, `Option.tsx`, their tests (new `*.data.test.tsx` files beside them), stories.

**Interfaces — Produces** (spec §9, R13, R15): props `items?: readonly ListboxItem[]` and `renderOption?: (item: ListboxItem, state: { selected: boolean; active: boolean; index: number }) => React.ReactNode` on the three components. With `items`, children are not scanned: the options list renders from `items` (default `<Option value text disabled>` from the item), keyboard movement, the active descendant, typeahead, the selected label(s) in the control and the Combobox filter all come from `items` through the existing `useListbox` data mode; option ids stay stable per value (`getIndex`); every option gets `aria-setsize` and `aria-posinset` from the data. `useActiveDescendant` gains `onScrollToItem?: (index: number) => void`, called instead of `scrollIntoView` for a target whose element is not mounted. Passing both `items` and option children warns once (`Combobox:items-and-children`, same for the others) and `items` wins. TagPicker and TimePicker are untouched.

- [ ] **Step 1 (tests first):** each of the three renders 500 `items` without children: selecting by click, by keyboard and by typeahead works; the selected label shows when the selected option's item exists in `items` but nothing is mounted (closed state); Combobox filter narrows the options and `aria-activedescendant` points at a mounted option; `aria-setsize`/`aria-posinset`; `renderOption` receives state; both-sources warning (asserted); unchanged children-form suites stay green unedited; StrictMode; axe; `collectOptionLabels` is not called in data mode (spy).
- [ ] **Step 2:** implement; **Step 3:** a `DataMode` story per component (500 items).
- [ ] **Step 4:** run the verification list plus the three component suites and `useListbox`/`useActiveDescendant` suites.
- [ ] **Step 5: Commit** `feat(pickers): data mode for Listbox, Combobox and Dropdown`.

### Task 16: windowed options and the 10,000-option story

**Files:** Modify `Combobox.tsx`, `Dropdown.tsx`, `Listbox.tsx`, `src/components/input/Option.tsx` (if the surface needs the scroller ref), their `*.data.test.tsx`, stories.

**Interfaces — Consumes:** Tasks 4, 15. **Produces** (spec §9): prop `virtualWindow?: VirtualWindow` (data mode only; without `items` it is ignored with one warning). The options list's scroller gets `virtualWindow.scrollRef` when it mounts (for the popup, the `ListboxSurface` scroller after opening; the ref callback attaches late — Review Focus 5); the list renders `layout(filteredItems.length, { keep: [activeIndex] })` entries (spacers as `<div role="presentation" aria-hidden="true" data-virtual-spacer style>`); `onScrollToItem` passes `virtualWindow.scrollToIndex(index, { align: 'auto' })`; opening scrolls the selected option into the window (`align: 'center'`); the filtered length is the window's count (Review Focus 3: typing a filter while scrolled deep returns a valid window and a clamped scroll position); Home/End/PageUp/PageDown use the filtered length; option groups with a window warn once (`Combobox:virtual-window-groups`).

- [ ] **Step 1 (tests first):** 10,000 items, scroller `clientHeight` 250, `itemSize` 32: at most 30 options mounted (budget of spec §11); ArrowDown past the window scrolls (`scrollToIndex` spy through a wrapping `VirtualWindow`) and `aria-activedescendant` points at a mounted option afterwards; End → the last item (`aria-posinset="10000"`); typing narrows `aria-setsize`; opening with a selected value deep in the list mounts it; the popup mounting after the component (the `scrollToIndex` requested before the scroller exists is applied on attach); closing and reopening; a keep index past a shrunken count is ignored; the Dropdown and Listbox variants; StrictMode; axe on the stories.
- [ ] **Step 2:** implement; **Step 3:** stories `TenThousandOptions` for Combobox (with the mounted-count readout), Dropdown and Listbox.
- [ ] **Step 4:** run the verification list plus `stories.a11y.test.tsx -t "Combobox|Dropdown|Listbox"`.
- [ ] **Step 5: Commit** `feat(pickers): windowed options`.

---

## Package H: FLAT TREE (P11-04d)

### Task 17: move the tree cascade to `src/lib/treeCascade.ts` and the flat model

**Files:** Create `src/lib/treeCascade.ts`, `src/lib/flatTree.ts`, `src/lib/__tests__/treeCascade.test.ts`, `src/lib/__tests__/flatTree.test.ts`; modify `src/components/layout/Tree.selection.ts` (re-export, keep `collectItems`), its existing tests stay unedited.

**Interfaces — Produces:** `treeCascade.ts` exports `TreeNode`, `CheckState`, `computeCheckStates`, `toggleCheck` (moved verbatim, no React import); `Tree.selection.ts` re-exports them and keeps `collectItems`. `flatTree.ts` (R14, spec §10.1):
```ts
export interface FlatTreeItemData { value: string; parentValue?: string; itemType?: 'leaf' | 'branch'; label?: string; disabled?: boolean }
export interface VisibleFlatItem { item: FlatTreeItemData; level: number; position: number; setSize: number; parentValue: string | undefined; hasChildren: boolean; expanded: boolean; index: number }
export interface FlatTreeIndex { byValue: Map<string, FlatTreeNodeRecord>; roots: readonly string[]; issues: readonly FlatTreeIssue[] }
export function buildFlatTreeIndex(items: readonly FlatTreeItemData[]): FlatTreeIndex;      // issues: unknown-parent, cycle, duplicate-value
export function visibleFlatItems(index: FlatTreeIndex, expanded: ReadonlySet<string>): readonly VisibleFlatItem[];   // descends only into expanded branches
export function flatTreeForest(index: FlatTreeIndex): TreeNode[];                           // for the cascade
```
Items whose parent is unknown are roots plus an issue; a cycle is cut at the repeated value plus an issue; duplicate values keep the first plus an issue; `level` is 1-based, `position` 1-based among siblings in the order of `items`; a branch is an item with children or `itemType: 'branch'`.

- [ ] **Step 1 (tests first):** moved cascade: the existing `Tree.selection` pure tests are copied or re-pointed so they run against `lib/treeCascade.ts`; flat model: order, levels, positions and set sizes on a 3-level fixture, collapse hides descendants, an expanded id whose item is missing is ignored, unknown parent / cycle / duplicate issues, 5,000 items with 1% expanded produce a small visible list quickly (assert length, not time), `flatTreeForest` feeds `computeCheckStates` and gives the same states as the nested equivalent for a fixture.
- [ ] **Step 2:** implement; **Step 3:** run the verification list (all `Tree` suites unedited and green; conventions gate for the touched files).
- [ ] **Step 4: Commit** `feat(tree): pure flat tree model and the shared cascade`.

### Task 18: `useFlatTree`

**Files:** Create `src/components/layout/useFlatTree.ts`, `src/components/layout/__tests__/useFlatTree.test.tsx`; modify barrels and `src/index.ts` (+ types).

**Interfaces — Consumes:** Task 17, `useControllable`. **Produces** (spec §10.1):
```ts
export interface UseFlatTreeOptions { expandedItems?: readonly string[]; defaultExpandedItems?: readonly string[]; onExpandedItemsChange?: (expandedItems: string[]) => void; checkedItems?: readonly string[]; defaultCheckedItems?: readonly string[]; onCheckedItemsChange?: (checkedItems: string[], details?: TreeCheckedItemsChangeDetails) => void; selectionMode?: 'none' | SelectionMode }
export interface FlatTreeModel { visibleItems: readonly (VisibleFlatItem & { checked?: CheckState })[]; getItem(value: string): VisibleFlatItem | undefined; expand(value): void; collapse(value): void; toggle(value): void; isExpanded(value): boolean; setChecked(value: string, checked: boolean, event?: Event): void; getTreeProps(): { selectionMode: … } }
export function useFlatTree(items: readonly FlatTreeItemData[], options?: UseFlatTreeOptions): FlatTreeModel;
```
`TreeCheckedItemsChangeDetails` is the nested Tree's existing type (read `Tree.core.tsx` around its `onCheckedItemsChange`; export it if it is not public already). State via `useControllable`; the index is memoised on `items` identity; `visibleItems` on the index and expanded set; checked states from `computeCheckStates` over `flatTreeForest`; the issues of Task 17 are warned once from an effect (`useFlatTree:unknown-parent`, `:cycle`, `:duplicate-value`).

- [ ] **Step 1 (tests first):** expand/collapse/toggle callbacks once per change (StrictMode); controlled vs uncontrolled; checked cascade (parent mixed, child toggles, select-all of children checks the parent); `visibleItems` identity stable without a change; `items` replaced keeps expanded ids that still exist; warnings asserted; types.
- [ ] **Step 2:** implement; **Step 3:** run the verification list.
- [ ] **Step 4: Commit** `feat(tree): useFlatTree`.

### Task 19: `FlatTree`

**Files:** Create `src/components/layout/FlatTree.tsx`, `FlatTree.item.tsx`, `FlatTree.context.ts`, `src/components/layout/__tests__/FlatTree.test.tsx`, `FlatTree.virtual.test.tsx`; modify `src/lib/classNames.ts` (`flatTreeClassNames`: `root`, `item`, `itemLayout`/`label`/`chevron`/`checkbox` as the nested Tree's parts name theirs — mirror `treeClassNames`), barrels, `src/index.ts`, `stories/FlatTree.stories.tsx`.

**Interfaces — Consumes:** Tasks 4, 18. **Produces** (spec §10.2, R15):
```ts
export interface FlatTreeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'|'onSelect'> {
  model: FlatTreeModel; virtualWindow?: VirtualWindow;
  renderItem?: (item: VisibleFlatItem) => React.ReactNode;   // @default the item's label
  selected?: string | null; current?: string | null; onItemSelect?: (value: string) => void;
  ref?: React.Ref<HTMLDivElement>;
}
// FlatTree.Item is the internal row (exported as a member for stable class and docs; props: item, children)
```
Root `role="tree"` (named by `aria-label`/`aria-labelledby`; development warning once when neither: `FlatTree:name`), `aria-multiselectable` in multiple mode. It calls `virtualWindow.layout(model.visibleItems.length, { keep })` when a window is given (else renders all visible items), and renders one `FlatTree.Item` per entry as **flat `role="treeitem"` siblings** (`aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` on branches, `aria-selected` in single mode, `aria-checked` in multiple mode, `data-index`), an expand chevron (mirrored with `wave-rtl:`), the checkbox/radio like the nested Tree's items, spacers as `<div role="none" aria-hidden="true" data-virtual-spacer style>`. Keyboard (from the model, scrolling when the target is not mounted, as in Tasks 11/14; the focused item is kept mounted): Up/Down, Home/End, Right (expand a collapsed branch, else focus the first child), Left (collapse an expanded branch, else focus the parent), `*` (expand all siblings), Enter and Space (select in single mode / toggle the check in multiple; activate calls `onItemSelect`), typeahead over the visible items' labels; roving tab stop on the focused item (`useRovingTabIndex` is NOT used: the tab stop follows the model's current value, because the DOM holds a window); Tab leaves the tree. `FlatTree.displayName`, compound members and flat names (`FlatTreeItem`) per C-COMPOUND.

- [ ] **Step 1 (tests first):** markup and ARIA for a small tree (levels, set sizes, positions, expanded, selected/checked), single and multiple modes, chevron RTL mirror class, key behaviour (each key listed above) in LTR and RTL (Left/Right mirrored via `getArrowIntent`), `onItemSelect`, `onExpandedItemsChange` once; **virtual file:** 5,000 flat items with a branch of 4,000 expanded, `clientHeight` 400, `itemSize` 28: at most 40 items mounted (budget); End focuses the last visible item and scrolls; Home returns; Right on the last mounted branch expands it and keeps focus; focus is kept on an item scrolled out of range (Review Focus 1); collapsing a branch while scrolled deep clamps the window (Review Focus 3); typeahead; `renderToString` first window; `testSystemProps`, `testCompoundExposure`, `asClientReference` regression added in Task 20's integration; axe.
- [ ] **Step 2:** implement; docs JSDoc on the exported `Object.assign` const (C-DOCS), no internal symbol names.
- [ ] **Step 3:** story `Components/Layout/FlatTree`: `Default` (small), `TenThousand`/`FiveThousandNodes` with the readout, `Checkable`.
- [ ] **Step 4:** run the verification list plus `stories.a11y.test.tsx -t "FlatTree"`, `public-types`, `classNames`.
- [ ] **Step 5: Commit** `feat(tree): FlatTree`.

---

## Package I: INTEGRATION and DOCS

### Task 20: integration, dist probes and budgets

**Files:** Modify `src/__tests__/integration.test.tsx`, `src/__tests__/public-types.test.ts`, `src/__tests__/classNames.test.ts` (only to drop pending entries), `scripts/verify-dist.mjs` (+ `scripts/__tests__`), `src/test-utils.ts` if a shared window helper is added.

**Produces:** (a) integration: every new compound/flat name has an RSC regression (`FlatTree`, `FlatTreeItem`, `TableResizeHandle` in the barrel test; `renderToString` of a windowed DataGrid, List, Combobox and FlatTree with `asClientReference` parts), Field around Combobox in data mode, DataGrid with `useTableFeatures` state driving a static Table; (b) `verify-dist`: new flat names checked; new `HOOK_PROBES_0_16` (an import of only `useVirtualWindow` or only `useSelection` holds no component or table code); `EXCLUSION` probes (DataGrid-only holds no `FlatTree`; `FlatTree`-only holds no DataGrid; Button-only and MessageBar-only imports unchanged); `VIRTUAL_BUDGET` (minified+gzip bytes of the `useVirtualWindow` import, measured first and set to +25%, ceiling 2 KiB, spec §11) and a recorded measurement of the DataGrid-only and Tree-only imports (Tree-only within ±1% of 0.15); `MODULE_ONLY_NAMES` gains the module-only seams (`computeVirtualLayout`, `resolveColumnWidths`, `buildFlatTreeIndex`, … — anything not exported from the entry); `PENDING_FLAT_EXPORTS` stays empty.

- [ ] **Step 1:** write the tests and probes (RED where a probe cannot yet pass), **Step 2:** make them pass (fix imports that leak across modules — e.g. a table module importing `FlatTree`), **Step 3:** `npm run build`, `node scripts/verify-dist.mjs --final`, `npm run test:pack`.
- [ ] **Step 4:** record the measured sizes in spec §16.
- [ ] **Step 5: Commit** `test: integration, dist probes and bundle budgets for 0.16`.

### Task 21: docs, stories gate, release notes

**Files:** `CHANGELOG.md`, `README.md`, `docs/WAVE-UI-GUIDE.md`, `docs/ROADMAP.md`, `CLAUDE.md`, `docs/testing-best-practices.md`, spec §16, stories.

- [ ] **Step 1: CHANGELOG** `## [0.16.0] - Unreleased` above 0.15.0: Upgrading from 0.15 (spec §14 items 1–4, in words, first: the DataGrid selection change), Added (hooks, windowing, `virtualWindow`, data mode, `FlatTree`, resizable columns, `Table.ResizeHandle`, labels), Changed, Deprecated (none), Fixed (dg-6 and the List prune, with their ids), Size (the budgets measured in Task 20).
- [ ] **Step 2: README** a "Large data" section (windowing recipe with `useVirtualWindow`, the height and fixed-row-height requirements, data mode, `FlatTree`), the new props in each component's section, the new hooks in the hooks table; **guide** a chapter "Data at scale" (the data-first contract, the adapter recipe for `@tanstack/react-virtual` as an object implementing `VirtualWindow`, keyboard model, the limits: fixed size, no groups in windowed pickers, typeahead over mounted items in List, no `noNativeElements`), a Pattern entry; **ROADMAP**: Phase 11 "Built as", gap ids closed (`hook-1`, `hook-2`, `hook-3`, `hook-4`, `foundation-40`, `dg-3`, `dg-6`, `trh-1`, `virt-1`, `foundation-45`, `tree-9`, `list-6`, `combobox-7`) and `table-2` left open with R4's reason; the follow-ups list (variable sizes, TagPicker/TimePicker windowing, static Table windowing, `noNativeElements`); **CLAUDE.md**: the 0.16 design reference in "What is this?", Architecture (`lib/selection`, `lib/virtual`, `lib/columnSizing`, `lib/treeCascade`, `lib/flatTree`, the hooks, `Table.resize`, `FlatTree*`), C-NAMING (`virtualWindow`, `items`/`renderOption`/`renderItem`, `columnWidths`), C-CLASS (`data-row-index`, `data-virtual-spacer`, `data-grid-auxiliary`, `data-resizing`, `data-dragging`, new part keys), Testing (windowing tests: stubs for `clientHeight`/`scrollTop`, the mounted-count budget, `keep`); **testing guide**: a windowing section. No hard-coded test counts.
- [ ] **Step 3:** `npm run format:check`, `node scripts/build-css.mjs`, `npm run lint`, `npm run build-storybook`; clean.
- [ ] **Step 4: Commit** `docs: windowing, data-scoped selection and resizable columns for 0.16`.

### After the last task (controller)

Final whole-branch review (most capable model), one fix dispatch and one scoped re-review for its findings, the exit gate (`/gate`), the full real-browser pass over spec §15 (all three engines, with the timings recorded in spec §16), then `superpowers:finishing-a-development-branch`. Release only on the maintainer's explicit go-ahead.

---

## Plan rulings

1. **Tasks are sequential and each wires its own exports.** The pending lists of earlier phases are not used: a task that adds a public symbol exports it, registers its class names and public types in the same commit, so every task ends green. (Cost if wrong: a task that forgets fails its own `public-types`/`classNames` run at once, which is the intent.)
2. **The spec's package A–I map to Tasks 1–21**; package D splits into Tasks 8–10 and package E into Tasks 11–12 so that the navigation change is reviewed alone.
3. **`useGridNavigation`'s `model` and auxiliary-widget rules stay behind opt-in** (a `model` option; `data-grid-auxiliary` on an element), so the 0.15 suite is the regression net for everyone else.
4. **The cut line (spec §12) is after Task 14**: if the phase must shrink, Tasks 15–19 become 0.16.x. The early browser checkpoint after Task 12 may also change the plan (spec §17.1).
5. **No auto-fit, no maximum width, no double-click-to-autofit** in 0.16 (spec R11); double click resets to the column's initial width.
6. **Plan defects found during execution are ruled by the controller against the spec** and recorded in the SDD ledger; spec §16 receives the departures.
