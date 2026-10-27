# WaveUI 0.14.0 — Fluent Parity Phase 9 Design (collections, data grids and guided tours)

> Date: 2026-10-21 · Branch: `feat/fluent-parity-phase-9` in `.claude/worktrees/fluent-parity-phase-9`, from `main` 80606ad (0.13.0) · Package: `@mortenbrudvik/waveui` → **0.14.0**.
> Scope: Phase 9 of [`docs/ROADMAP.md`](../../ROADMAP.md): P9-01 … P9-08 (Overflow, Breadcrumb, DataGrid columns and sorting, selection, static Table parts, List, TeachingPopover actions and parts).
> Status: **draft for the maintainer's approval.** Written without an interview (the maintainer is the only developer and consumer). Choices that are the author's, not the roadmap's, are marked **(my call)**; each has its reason.
> Inputs: the roadmap's Phase 9 section; three read-only surveys of the code at 80606ad against Fluent UI v9 (`react-overflow`/`react-breadcrumb`; `react-table`/`react-list`; `react-teaching-popover`), at Fluent commit `ba08dbe`.

---

## 0. Intent

Phase 9 makes collections and tables work without consumer plumbing: Overflow hides by priority and in groups, Breadcrumb collapses, DataGrid sorts its own rows from typed columns and selects on row click, the static Table gets sortable headers, selection and cell parts, List can be navigated without selecting, and TeachingPopover gets footer actions and composable parts.

**Goals.** Close the gaps of the eight items; every addition is opt-in and an unchanged call renders and behaves as in 0.13 (D2).
**Non-goals.** TeachingPopover focus trap (`teaching-4`: WaveUI follows the APG non-modal dialog), unifying TagPicker's own measuring with Overflow, numeric row ids (`list-5`), selection across unrendered rows (P11-02), a Table `size` prop (`table-1`), a `CarouselCard` part.
**Anti-goals.** A new dependency; a changed default look or markup; a sort or a collapse that happens without an opt-in prop; removing any 0.13 prop or class name.

---

## 1. Rulings (cross-cutting)

- **D1 — One phase, one branch, one release, built sequentially:** P9-01 → P9-02 → P9-03 → P9-04 → P9-05 → P9-06 → P9-07 → P9-08 → INTEGRATION → DOCS. P9-02 needs `asChild` from P9-01, P9-04 and P9-05 share the selection cell and sort glyphs of P9-03, P9-08 builds on P9-07.
- **D2 — Additive.** Every new prop defaults to 0.13 behaviour; the existing suites stay green, edited only where a type widens or a deprecated spelling is asserted.
- **D3 — Conventions.** CLAUDE.md C-* apply: enumerated `data-*` always rendered, boolean ones present or absent; one stable class per new part and flat names for compound members; `labels`/`<thing>Label` for strings; `useControllable` for state; `details` as the second callback argument; warnings from effects; contexts null-default with `reportMissingContext`; literal Tailwind class maps; `wave-rtl:` and `motion-reduce:` where needed.
- **D4 — Value first, `details` second.** New callbacks (`onOverflowChange`, `onSortChange`, `onSelectedItemsChange`) put the value first and an optional `details` object after; typed optional through 0.x. The event-named activation callbacks `onSortClick(event)`, `onAction(event)` and `onFinish()` take the event (or nothing) as their value.
- **D5 — Pure helpers live in `src/lib`** (server-safe, exported from the entry): `createTableColumn`, `partitionBreadcrumbItems`, `truncateBreadcrumbLongName`, `truncateBreadcrumbLongTooltip`, `isTruncatableBreadcrumbContent`. `verify-dist` gets hook probes for them like 0.13's.
- **D6 — Shared internals are module-only:** `Table.shared.tsx` (sort button, sort glyphs, selection control, cell classes shared by `Table` and `DataGrid`), `Overflow.store` split if `Overflow.tsx` passes ~900 lines.

---

## 2. P9-01 — Overflow: priority, pinned items, direction, groups

Current: one `OverflowStore` with a `ResizeObserver` on the container and items, cutting at the first item (never index 0) whose end passes the room (`Overflow.tsx:277-290`); hidden items get `display:none`, `aria-hidden`, `inert`, `data-overflow-hidden`; `data-overflow-pinned` marks "the button covers item 0" (`:293`).

- **Store.** Keep the one store. Items register `{ priority, pinned, groupId }` with their element. The cut loop becomes: start with every item visible; while content plus the button overflows the room and a hidable item exists and the visible count exceeds `minimumVisible`, hide the next victim. Pinned items are never victims; the others hide in ascending `priority`; equal priorities hide last-in-DOM first for `overflowDirection="end"` and first-in-DOM first for `"start"`. The emitted `hidden` ids stay in DOM order.
- **D3.1 (my call) — the legacy "item 0 is never hidden" stays the default** while no item sets `priority` or `pinned`; once any item does, only `pinned` protects. The default case then equals 0.13's output exactly (a test pins it against the 0.13 fixtures). The internal name of the old "button covers item 0" flag becomes `buttonCovers`; `data-overflow-pinned` is still rendered for it.
- **Root props:** `overflowDirection?: 'end' | 'start'` (default `'end'`), `orientation?: Orientation` (default `'horizontal'`; Fluent's `overflowAxis`; **(my call)** the name follows C-NAMING, vertical swaps width for height, the column gap and the button's sticky edge), `minimumVisible?: number` (default `0`), `hasHiddenItems?: boolean` (reserves the button before the first measure), `onOverflowChange?: (hiddenItems: string[], details?: OverflowChangeDetails) => void` (`details` always passed, typed optional through 0.x per D4) with `OverflowChangeDetails = { visibleItems: string[]; groupVisibility: Record<string, OverflowGroupVisibility> }`, `OverflowGroupVisibility = 'visible' | 'hidden' | 'overflow'` (all members shown, all hidden, mixed). Fired from an effect when the hidden set changes, once per change in StrictMode.
- **Item props:** `priority?: number` (higher overflows later, default 0) **or** `pinned?: boolean` (a discriminated union, as Fluent), `groupId?: string`, `asChild?: boolean` (**(my call) shipped:** merges the item's props onto its single element child through `useTriggerElement`'s merge, so `<li>`, Toolbar buttons and `role="list"` parents work; the default stays the wrapper `<div>`).
- **New:** `Overflow.Divider` (`OverflowDivider`, `groupId`; hidden with its group), hooks `useIsOverflowGroupVisible(groupId)` and `useHasHiddenItems()`; types `OverflowChangeDetails`, `OverflowGroupVisibility`, `OverflowDirection`. `useIsOverflowing`, `useOverflowMenu` and `useIsOverflowItemVisible` keep their signatures.
- **Tests:** ResizeObserver mock with stubbed widths: priority order, pinned, `start`, `minimumVisible`, groups and dividers, vertical, reorder (existing), RTL, StrictMode once, `asChild` markup (a `<li>` in an `<ol>` passes axe), the 0.13 default pinned against fixtures; a Toolbar + Overflow story with grouped dividers.

## 3. P9-02 — Breadcrumb

- **`partitionBreadcrumbItems<T>({ items, maxDisplayedItems = 6, overflowIndex = 1 }): { startDisplayedItems, overflowItems?, endDisplayedItems? }`** with Fluent's rules (hides `items.length - maxDisplayedItems` from `overflowIndex`; an index at or past the max becomes `max - 1`; `0` or missing max falls back to 6), in `src/lib`.
- **Props (D1 of the survey, my call: props that render, plus the helper):** `maxDisplayedItems?: number` (default: no collapse) and `overflowIndex?: number` (default `1`) collapse middle items into a "…" `Menu` button (`overflowLabel?: string`, default `"More items"`) holding one `Menu.ItemLink` per hidden item (a `Breadcrumb.Item` with `href`, else a `Menu.Item` with its `onClick`; an item that cannot be mapped warns once, `Breadcrumb:overflow-item`). The current item is never hidden: the partition keeps the last `current` item and the first item.
- **Responsive collapse (my call: opt-in):** `overflow?: 'none' | 'auto'` (default `'none'`). `'auto'` renders the trail as Overflow items (`asChild` `<li>`s): the first item high priority, the current item `pinned`, middle items lowest priority hiding from the start side, and the overflow menu is the Overflow button.
- **`size?: CoreSize`** (`data-size`; text and icon steps in a literal map), **`focusMode?: FocusMode`** (`'tab'` default, `'arrow'` = one Tab stop with `useRovingTabIndex` over links and the overflow button, RTL via `getArrowIntent`, `data-focus-mode`), **`divider?: Slot<'span'>`** (optional-indicator rule: `null`/`undefined` keep the chevron, `false` or empty content hides it; the RTL mirror stays on the default chevron only).
- **Truncation:** `truncateBreadcrumbLongName(content, maxLength = 30)`, `truncateBreadcrumbLongTooltip(content, maxLength = 80)` (Fluent's typo corrected, no alias), `isTruncatableBreadcrumbContent`; a Tooltip story.
- **Import rule:** `Breadcrumb` imports `Menu`; `Menu` never imports `Breadcrumb` (checked by the conventions import tests).
- **Tests:** the default trail unchanged; partition table tests; current never hidden; menu named and localizable; axe; RTL; arrow mode; `asChild` responsive collapse with the mock.

## 4. P9-03 — DataGrid columns, rendering and sorting

- **Columns:** `DataGridColumn<T = unknown>` gains `columnId` (`id` stays as a deprecated alias via `resolveDeprecatedProp`), `label: ReactNode`, `compare?: (a: T, b: T) => number`, `renderCell?: (item: T) => ReactNode`, `renderHeaderCell?: () => ReactNode`, `sortable?: boolean` (default `compare !== undefined`). `createTableColumn<T>({...})` is a defaulting helper in `src/lib`; columns with functions cannot cross a Server Component boundary (documented).
- **Items:** `DataGrid<T>` is generic (`items?: readonly T[]`, `getRowId?: (item: T) => string`, `columns?: readonly DataGridColumn<T>[]`); with `items` and `columns` the grid renders header, rows and cells; `DataGrid.Body` also takes a render function child `(item, index) => ReactNode`; a row-id context gives `DataGrid.Row` its `rowId` from `getRowId` (default: the item's index in `items`, stringified). JSX-composed grids keep working untouched.
- **Built-in sorting (my call: also when `sort` is controlled):** the grid sorts `items` itself whenever `items` is set and the effective sort column (controlled `sort`, else its own state from `defaultSort`) has `compare`: `slice().sort` (stable), descending negates `compare` (never `reverse()`). A server-sorted grid omits `compare`. `sortIcon?: Slot<'span'>` on header cells (decorative, `unwrapButtonGlyph`, `null`/`false` hides). `aria-sort` stays on the header.
- **Callbacks:** `onSortChange(sort, details?: { event })` and `onSelectedItemsChange(items, details?: { event })` (the legacy positional `onSortChange(columnId, direction)` and the deprecated sort props keep their rules, selected by the absence of `items`/`sort`/`defaultSort` as today).
- **Row ids stay strings** (`list-5` is a non-goal). Selection stays "selected ∩ rendered rows" (P11-02).
- **Tests:** stable sort, descending, `aria-sort`, controlled+compare, `renderHeaderCell`, type tests for the generic column (`expectTypeOf`), the no-re-render-on-sort test (0.13) intact, StrictMode once; README "Sorting and selecting in a DataGrid" rewritten.

## 5. P9-04 — Row-click selection and appearance

- **`selectOnRowClick?: boolean`** (default `false`, no later change planned): a click on the row toggles it; the row's `onClick` composes consumer-first (`preventDefault()` cancels); clicks on interactive or portaled descendants, on header rows and clicks that end a text selection never toggle (List's `isForeignEvent` and interactive selector move to a shared module). The Space handler stays.
- **`selectionAppearance?: 'brand' | 'neutral' | 'none'`** (default `'brand'` = today; `neutral` uses the subtle selected token; `none` no row fill; `data-selection-appearance` on the table) and **`subtleSelection?: boolean`** (unchecked selection cells hidden until row hover or focus-within; always shown in forced colors and on coarse pointers; `motion-reduce` on the fade; **(my call)** the header select-all is revealed on grid hover or focus-within, unlike Fluent).
- **`DataGrid.Row selectionCellProps?: { disabled?, invisible?, className?, 'aria-label'? }`**: `disabled` is a natively disabled input (not a grid focus target, row click ignored, select-all skips the row, **my call**).
- **`DataGrid.SelectionCell`** (`DataGridSelectionCell`) exported: in a header row it is select-all, in a body row the row toggle; the header's automatic selection slot skips a header that already holds one (a marker, as Nav's `markNavPart`).
- **Tests:** keyboard selection unchanged, click on a button inside a row does not toggle, appearance data attributes, axe per appearance, `aria-multiselectable` and per-row names intact.

## 6. P9-05 — Static Table parts

- **`Table.HeaderCell`:** `sortable?`, `sortDirection?: 'ascending' | 'descending'` (**my call: no `'none'`**, absent means unsorted; `aria-sort="none"` is rendered while `sortable`), `onSortClick?(event)`, `sortIcon?: Slot<'span'>`, `aside?: Slot<'span'>`. A sortable header renders a `<button>` inside the `<th>`, no grid semantics. New `SortArrowUpIcon/SortArrowDownIcon` icons in `src/lib/icons.tsx` replace DataGrid's inline triangle; the glyph carries `data-direction`.
- **`Table.SelectionCell`:** a `<td>` with the grid's native input: `type: 'checkbox' | 'radio'`, `checked: boolean | 'mixed'`, `defaultChecked`, `onCheckedChange(checked, details?)` through `useControllable`, `name`, `subtle`, `invisible`; control props go to the input (C-ROUTING). `Table` stays stateless: no selection store.
- **`Table.CellLayout`:** `media?: Slot<'span'>` (a fixed 32 px `AvatarSizeContext`), main text, `description?`, `truncate?`, `appearance?: 'primary'`.
- **`Table.CellActions`:** a div at logical `end-0`, hidden until row hover, focus-within, forced colors or a coarse pointer; `visible` keeps it shown; an opaque row-matching background (**my call**, verified in the browser pass); `Table.Row` and `DataGrid.Row` get `group/table-row`, cells `relative`. The zebra stripe keeps its zero-specificity rule.
- Flat names and one stable class per part; RTL placement test; axe.

## 7. P9-06 — List

- **`navigationMode?: 'none' | 'items' | 'composite'`**: unset keeps 0.13's automatic mode (selectable → items, selectable with actions → grid). An explicit value pins the structure (explicit `composite` avoids the item remount when actions appear). `items` on a plain list gives roving tab stop, arrows, Home/End and typeahead; `items` with selection and actions warns and acts as `composite`. A plain or composite list has no `aria-selected`.
- **`List.Item onAction?: (event) => void`:** click and Enter run it; Space runs it on a non-selectable item and toggles selection in a selectable one. Order: consumer `onClick`, `onAction`, then selection unless `onAction` called `preventDefault()` (the key handler no longer pre-prevents). A development warning for `onAction` on an item that is not navigable.
- **`disabledSelection?: boolean`:** blocks toggling, `aria-disabled` only when there is no `onAction`, `data-disabled-selection`, stays in the arrow order (C-DISABLED).
- **`checkmark?: Slot<'span'>`** per item **and** a List-level `checkmark?: boolean` (**my call**, opt-in, avoids repetition); decorative, logical margin, forced-colors classes; the default look is unchanged.
- Tests: APG listbox/grid keys, typeahead, RTL composite, the existing selectable-list suites unchanged.

## 8. P9-07 — TeachingPopover footer actions

- `primaryAction?` / `secondaryAction?` on a step and on the root (the step's wins): the primary replaces Next/Done, the secondary replaces Back on that step; content or a Button-like slot; the click composes consumer-first and then runs the step's normal action unless `preventDefault()` was called. `footerLayout?: 'horizontal' | 'vertical'` (`data-layout`).
- **`onFinish?: () => void`.** Done calls `finish()` (close, then `onFinish`). **(my call)** `onDismiss` is still also called on Done in 0.14 (documented, to be dropped in 1.0 with a JSDoc note) so no 0.13 caller breaks; Close and Escape call only `onDismiss`.
- New class names `primaryButton`, `secondaryButton` (the existing `backButton`/`nextButton` stay on Back, Next and Done). The 0.5 focus handling (initial focus, return, Back as a self-disabling control) is untouched; its tests stay green unedited.

## 9. P9-08 — TeachingPopover parts

- **Split** `TeachingPopover.tsx` (compound) / `.root.tsx` / `.context.ts` / `.parts.tsx`; the surface hooks move into one internal `TeachingSurface` used by the root (when no `Surface` child exists) and by `TeachingPopover.Surface`, so `rest`, `ref` and `className` reach the same element in both forms.
- **Parts:** `Trigger` (as `PopoverTrigger`, the target when `target` is unset), `Surface`, `Header` (`icon`, `dismissButton` slots, C-SLOTS dismiss rules), `Title` (`as`, hidden step position), `Body` (`media` slot), `Footer`, `Carousel`, `CarouselNav` (interactive page buttons, **opt-in**), `CarouselPageCount` (visible count, render function), `CarouselFooter` (`layout: 'offset' | 'centered'`, `initialStepText`, `finalStepText`). Parts render their default content from the current step when they have no children (Pattern 15); `steps` stays the single source of count and content, so there is no `CarouselCard` **(my call)**.
- **`defaultOpen`** stays `true` unless a `Trigger` is a direct child (then `false`, documented). A part outside the root throws in development (`reportMissingContext`).
- Flat names, `asClientReference` and RSC cases in the integration suite; a multi-step tour built from parts; axe.

---

## 10. Packages, gates and bookkeeping

| Step | Content | Main files |
|---|---|---|
| 1 | P9-01 | `Overflow.tsx` (+ store split) |
| 2 | P9-02 | `Breadcrumb.tsx`, `src/lib/breadcrumb.ts` |
| 3 | P9-03 | `DataGrid.tsx`, `src/lib/table.ts`, `Table.shared.tsx` |
| 4 | P9-04 | `DataGrid.tsx` |
| 5 | P9-05 | `Table.tsx`, `Table.shared.tsx` |
| 6 | P9-06 | `List.tsx` |
| 7 | P9-07 | `TeachingPopover.tsx` |
| 8 | P9-08 | `TeachingPopover.*.tsx` |
| 9 | INTEGRATION | barrels, `public-types`, class names, `verify-dist` helper probes, integration + RSC cases |
| 10 | DOCS | stories, CHANGELOG `[0.14.0]`, README (DataGrid section rewritten), guide, ROADMAP, CLAUDE.md |
| 11 | Lead | `/gate`, final review, real-browser checklist (Overflow resize, Breadcrumb collapse, DataGrid sort and row click, subtle selection, CellActions, List modes, tour from parts), release |

Gates as 0.13: conventions, class-names, public types, stories a11y, `verify-dist --final`, `test:pack`, clean test output.

## 11. Where this spec departs from the roadmap's sketch

| Sketch | Spec | Why |
|---|---|---|
| DataGrid sorts only with no controlled `sort` | also with a controlled `sort`, when `items` and `compare` exist | the grid never needs the consumer to reorder rows it was given; a server-sorted grid omits `compare` |
| `Table.HeaderCell sortDirection` includes `'none'` | `'ascending' \| 'descending'` or absent | Fluent has no `'none'`; `aria-sort="none"` is rendered while sortable |
| Breadcrumb responsive collapse | opt-in `overflow="auto"` | changes markup and needs `asChild` items |
| List `checkmark` per item | per item and List-level boolean | no repetition; opt-in |
| `onFinish` separate from `onDismiss` | Done calls both in 0.14 | no 0.13 caller breaks |
| `truncateBreadcrumLongTooltip` (Fluent) | `truncateBreadcrumbLongTooltip` | Fluent's typo, no alias |
