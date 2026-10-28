# Phase 11 (0.16.0): tables and lists at data scale

Status: design, written 2026-10-28 on `feat/fluent-parity-phase-11` from `main` at `47fe6dd` (0.15.0). The maintainer opted out of the brainstorm questions ("skip the questions, just start"), so every design call below is the author's and is marked **Ruling**; each states what it costs if wrong. The roadmap entry is `docs/ROADMAP.md`, Phase 11 (P11-01 to P11-04). Inputs: a survey of WaveUI's code (which parts assume every row is mounted) and a read of Fluent UI v9's source at `microsoft/fluentui@32c88c8` and `fluentui-contrib`.

## 1. Intent

A data grid, list, listbox or tree must stay **correct and fast when most of its data is not rendered**: 10,000 rows, 10,000 options, 5,000 tree nodes. Correct means selection, select-all, sorting, keyboard movement and screen-reader positions follow the **data**, not the elements that happen to be mounted. Fast means the DOM holds a window of the data (a screenful plus overscan), not all of it.

Today they do not. The survey found one root cause behind the gaps: state is derived from mounted DOM or mounted registrations.

- DataGrid's select-all and header state come from the rows that registered (`getRegistered()`); a row click prunes every id that is not mounted; `useGridNavigation` walks `table.rows`, so Ctrl+End means "last mounted row", and the active cell falls back to row 0 when its row unmounts.
- List prunes unmounted values on every toggle and its order sync needs every item to be a direct child.
- Listbox, Combobox and Dropdown register options as they mount, sorted by DOM order, so keyboard movement, typeahead and the selected label only know mounted options.
- Tree is nested JSX; levels, set sizes and positions do not exist, and arrow keys query sibling DOM.
- Nothing sets `aria-rowcount`, `aria-rowindex`, `aria-setsize` or `aria-posinset`.

### Goals

1. **Headless table state** (P11-01): `useTableFeatures` with sort, selection and column-sizing plugins, and a generic `useSelection`, whose state survives rows unmounting.
2. **Data-scoped DataGrid selection** (P11-02): with `items`, select-all and the header checkbox cover every item; ids of filtered, paged or off-screen rows stay selected.
3. **Resizable columns** (P11-03): mouse, touch and keyboard, left to right and right to left, controlled or not.
4. **Windowing** (P11-04): a small built-in `useVirtualWindow` and a `virtualWindow` prop on DataGrid, List, Listbox, Combobox, Dropdown and the new `FlatTree`, with keyboard movement, typeahead and ARIA positions computed from the data.
5. Stories and tests for a 10,000-row DataGrid, a 10,000-option Combobox and a 5,000-node tree, within the budgets of §11.

### Non-goals

- Variable row heights, horizontal virtualization, infinite scrolling and data fetching (the window renders what `items` holds).
- A div-rendered `Table` (`noNativeElements`, gap `table-2`): see R4.
- Windowing of the static `Table`, TagPicker, TimePicker, Menu, Tabs or Overflow.
- Real `treegrid` roles for `Tree navigationMode="treegrid"` (Phase 3 spec D27 stays).
- A dependency on any virtualization library, and a peer dependency (R1).
- The 0.15 follow-ups (flipped-popup slide, TabList reselection, toast shadow, Nav bundle, motion on the remaining popups): separate releases.

### Anti-goals

- Windowing that breaks keyboard or screen-reader use: a window that drops the focused row, announces wrong positions, or makes Ctrl+End stop at the window edge is worse than no windowing.
- Any cost for apps that do not use it: a Button-only, MessageBar-only or Tree-only import stays as small as in 0.15 (the new modules are separate and tree-shaken, §11).
- A silent behaviour change of selection for grids that pass `items` without telling the maintainer: it is listed under "Upgrading from 0.15" (§14).

## 2. Rulings

| # | Ruling (author's call) | Why | Costs if wrong |
|---|---|---|---|
| R1 | **Built-in, headless, fixed-size windowing** (`useVirtualWindow`), behind an interface (`VirtualWindow`) that an adapter for `@tanstack/react-virtual` or `react-window` can also implement. No new dependency or peer. | Fluent's own `Virtualizer` was deprecated and its DataGrid virtualization is an external fixed-height package; both show the cost of owning a measuring virtualizer. A fixed-size window is about 150 lines of math, needs no measuring and covers the three acceptance stories. The interface keeps variable sizes and library adapters open. | A maintainer who wants a library finds the adapter recipe (guide) instead of a ready package; or a ~150-line module to remove. |
| R2 | **Fixed item size only** in 0.16. | Variable sizes need measuring, anchoring and scroll correction; the roadmap's acceptance does not need them. | Apps with tall variable rows cannot window until 0.17+. |
| R3 | **DataGrid stays a native `<table role="grid">`** with spacer rows and `table-layout: fixed`. | Native table layout aligns header and body columns with no width syncing and no scrollbar-width correction; the roadmap guard says the same. Fluent has no precedent (its virtual grid is divs). | Sticky-header and spacer-row quirks in some engine: caught by the browser pass (§15), fallback is a `<div>` grid in 0.17. |
| R4 | **`Table noNativeElements` (gap `table-2`) is deferred.** | R3's spacer technique virtualizes native tables, so div rendering is no longer needed for windowing; it is a large separate change to five parts. | Gap `table-2` stays open; add it later without breaking anything. |
| R5 | Selection state is **a set of string ids held by the hook or the component**, independent of rendered rows. Select-all selects every selectable item of `items`; deselecting all removes **only the ids of `items`**; ids outside `items` (filtered out, another page) are kept. | Fluent's toggle-all clears foreign ids; paging and filtering apps need the opposite. | Apps expecting "clear everything" call `clearRows()`/`clear()` explicitly. |
| R6 | **Selection values are row ids everywhere**, under DataGrid's existing names: the hooks use `selectedItems`/`defaultSelectedItems`/`onSelectedItemsChange(selectedItems: string[], details?)`, exactly the type of DataGrid today (`readonly string[]` in, `string[]` out). No item objects are ever emitted. (A first draft of this spec wrongly had the callback emit objects; the builder check caught it against `DataGrid.tsx:255-271`.) | Matches Fluent's and the roadmap's names, and a 0.15 `selectedItems={sel} onSelectedItemsChange={setSel}` pair keeps working unchanged. | None beyond the names; a consumer needing objects maps ids through its own `items`. |
| R7 | **Plugins are state hooks that return pure plugin functions**: `useTableFeatures(options, [useTableSort(o), useTableSelection(o)])`. | Keeps Fluent's call shape and passes `react-hooks` (Fluent runs hooks inside a reduce and disables the rule). Each plugin hook is called in source order at the call site. | If plugins must be conditional, the consumer wraps the condition in the option, not the call. |
| R8 | DataGrid is **not rebuilt on `useTableFeatures`**. DataGrid and the hooks share the pure cores (`lib/selection.ts`, sort comparison) instead. | Re-basing a 2,400-line component on new hooks is a risk with no user gain. | Duplicated glue (about 100 lines) between DataGrid and the hooks. |
| R9 | Column-width state is `columnWidths`/`defaultColumnWidths`/`onColumnWidthsChange(widths, details)`; the roadmap's `onColumnResize` becomes a `details` field, not a second callback. | C-NAMING (value callbacks are `on<Value>Change`), and a controlled map is what persisting widths needs (Fluent has none, issue workaround via `idealWidth`). | Rename or add an alias. |
| R10 | The resize handle is a **focusable `role="separator"` widget of the header cell** (reached like the sort button), not hidden behind a consumer-built menu. | Fluent's keyboard mode is only reachable through a consumer-written context menu; a separator with `aria-valuenow` is the window-splitter pattern. | Header cells gain one more widget in the grid's cell navigation. |
| R11 | **No auto-fit of columns to the container** in 0.16 (Fluent's `autoFitColumns`). Columns start at their `defaultWidth`, `idealWidth` or 150, never below `minWidth` (80); the table is at least as wide as their sum and fills a wider container proportionally. | Auto-fit was Fluent's bug source (#35923). | Apps wanting exact fit set widths themselves. |
| R12 | The window **keeps the focused row mounted** even when it scrolls out of range (an extra entry with a spacer on each side). | The alternative drops focus to `<body>` when the row unmounts. | A second spacer segment in the layout math (already in `VirtualEntry`). |
| R13 | `List`, `Listbox`, `Combobox`, `Dropdown` get windowing through the same `virtualWindow` prop; **`Combobox`/`Dropdown`/`Listbox` gain a data mode** (`items`, `renderOption`), `List` stays children-based with `count` and per-item `index`. TagPicker and TimePicker are out. | `useListbox` already has a data mode (TimePicker uses it); children-scanning cannot know unmounted options. | Apps keep the children form (every option mounted, as today). |
| R14 | `useFlatTree` (a headless model) and `FlatTree` are **new**; the nested `Tree` is unchanged. | The nested Tree's selection forest needs the whole element tree; a flat model is the only shape that windows. | Two tree components to document. |
| R15 | **The component that owns focus calls `layout()` and renders the window**; a consumer never renders a window by hand. So windowed `List` takes a children **function** `(index) => ReactNode`, `FlatTree` a `renderItem(visibleItem)`, `Combobox`/`Dropdown`/`Listbox` a `renderOption(item, state)`. | `keep` (the focused or target index) is known only to the component; a consumer-rendered window cannot keep it mounted. The `VirtualWindow` interface stays as in §3.3. | List loses the children-array form when windowed (the unwindowed form is unchanged). |
| R16 | **The resize handle is an auxiliary grid widget**: `data-grid-auxiliary`, ignored by `useGridNavigation` when it decides a cell's target widget, so a sortable header's target stays the sort button and Enter still sorts. **F2** on a header cell (or its target widget) moves focus to the separator; in that interaction mode the arrows resize. | Counting the separator as a second widget would make every sortable, resizable header lose Enter-to-sort (it would become its own target, needing Enter twice). | One extra key to learn; the separator is also reachable by Tab inside interaction mode. |
| R17 | `resizableColumns` and `virtualWindow` **require the `columns` prop** (with `items`). Hand-written `DataGrid.HeaderCell`s with a `DataGrid.Body` render function ignore them, with a development warning once. | The `<colgroup>`, the spacer `colSpan` and the width map need the column list; scanning children for it is fragile. | Such grids cannot resize or window; they can move to `columns`. |
| R18 | Table width after a resize: an **unresized** grid is `width: 100%` with `min-width` = the sum; once any width is state (a resize, or controlled/default `columnWidths`), the table is **exactly the sum** (no `100%`), so the dragged edge follows the pointer and slack appears at the end like a spreadsheet. | Spreading slack over fixed columns makes the dragged edge drift from the pointer. | Resized grids no longer fill a wide container; a consumer can set a last column's width to fill. |
| R19 | The hooks reuse the **existing types**: sort state is `DataGridSort | null` (`{ columnId, direction }`), `onSortChange(sort, details?)`, columns are `DataGridColumn<T>` from `createTableColumn` (`src/lib/table.ts`). | Public type shapes are hard to rename; the grid and the hooks then share one vocabulary. | Fluent's `{ sortColumn, sortDirection }` shape is not offered. |
| R20 | The pure check-state cascade (`TreeNode`, `computeCheckStates`, `toggleCheck`, `CheckState`) **moves from `Tree.selection.ts` to `src/lib/treeCascade.ts`** (server-safe); `Tree.selection.ts` keeps `collectItems` and re-exports the names. | `FlatTree`'s model must reuse the cascade without importing a React-using component module. The Tree-only bundle changes by that one moved module only (budget in §11). | A few bytes of re-export in the Tree bundle. |

## 3. Core primitives

### 3.1 Selection core: `src/lib/selection.ts` (server-safe, pure)

The model every selecting component shares (R5):

- `toggleId(selected, id, mode)`; single mode selects and never deselects through `toggle` (as native radio groups), multiple mode toggles.
- `setAll(selected, universe, selectableIds)`: adds every selectable id of the universe.
- `clearAll(selected, universe)`: removes only the ids of the universe.
- `summarize(selected, universe, selectableIds)` returns `{ all, some, none }` over the universe.
- `universe` is the ordered array of row ids of `items`; `selectableIds` excludes ids a row has disabled (§5.2). Cost: O(n) per call; memoised on identity of `items` and the selected set.

### 3.2 `useSelection` (public hook)

```ts
useSelection(options: {
  selectionMode: SelectionMode;                       // 'single' | 'multiple'
  selectedItems?: readonly string[]; defaultSelectedItems?: readonly string[];   // row ids (R6)
  onSelectedItemsChange?: (selectedItems: string[], details?: { event?: Event; id?: string }) => void;
}): { selectedItems: ReadonlySet<string>; isSelected(id): boolean; toggle(id, event?): void;
      select(id, event?): void; deselect(id, event?): void;
      toggleAll(universe: readonly string[], event?): void; clear(event?): void; selectionMode }
```

Built on `useControllable`; fires only on change; StrictMode-safe.

### 3.3 `useVirtualWindow` and `VirtualWindow` (public)

```ts
useVirtualWindow(options: {
  itemSize: number;                 // px, fixed (R2)
  overscan?: number;                // items rendered beyond each edge. @default 6
  initialViewportSize?: number;     // px assumed before the first measure and on the server. @default 480
  scrollPaddingStart?: number;      // px pinned over the top of the rows (a sticky header). @default 0
}): VirtualWindow

interface VirtualWindow {
  itemSize: number;
  scrollRef: React.RefCallback<HTMLElement>;                     // the scrolling element
  layout(count: number, options?: { keep?: readonly number[] }): readonly VirtualEntry[];
  scrollToIndex(index: number, options?: { align?: 'auto' | 'start' | 'center' | 'end' }): void;
}
type VirtualEntry = { kind: 'item'; index: number } | { kind: 'spacer'; size: number; key: string };
```

- `layout(count, { keep })` is **pure in render**: from the hook's state (scroll offset, viewport size) and `count` it returns the entries to render, in order: a leading spacer, the item entries `[first - overscan, last + overscan]` clamped, any `keep` index outside that range as its own item entry with spacers between, a trailing spacer. Spacer size is `gap * itemSize`. Because the count is an argument, a component whose count is internal (a filtered Combobox) passes its own.
- State is `{ firstVisible, viewportSize }`, updated from a passive `scroll` listener batched in `requestAnimationFrame`, and a `ResizeObserver` on the scroller. **State changes only when `firstVisible` (a row boundary) or the viewport size changes**, so scrolling re-renders once per row, not per pixel.
- `scrollToIndex` sets `scrollTop` (clamped); `align: 'auto'` scrolls the minimum that shows the row. Components that move focus to an unmounted row call it and focus after the commit that mounts the row (§7.3).
- `scrollPaddingStart` is the height of content pinned at the top of the scroller over the rows (DataGrid's sticky header, §7.1). `scrollToIndex` aligns in the area below it: it passes `viewportSize - scrollPaddingStart` (at least `itemSize`) as the viewport and leaves the row offsets as they are, which is exact for a sticky header (row `i` is the first row below the header when `scrollTop = i * itemSize`, and the largest offset is `count * itemSize - (viewport - header)`). The first visible row and `layout` do not use it (the extra `header / itemSize` rows of the window are overscan). A value that is not finite, or negative, counts as 0.
- Server and first render: viewport = `initialViewportSize`, offset 0, so the server HTML holds the first window. No layout read at render.
- jsdom: no layout, so `clientHeight` is 0; the hook uses the initial size when the measured size is 0. Tests set `clientHeight` and `scrollTop` and fire `scroll`.
- Adapter recipe (guide, no code shipped): an object implementing `VirtualWindow` from `@tanstack/react-virtual`'s `getVirtualItems()` and `scrollToIndex`.

## 4. Headless table state (P11-01)

```ts
useTableFeatures<T>({ items, columns, getRowId? }, plugins?: TableFeaturePlugin<T>[]): TableFeaturesState<T>
```

- `columns`: `DataGridColumn<T>[]` from the existing `createTableColumn` (`src/lib/table.ts`; R19).
- `getRowId` defaults to the index as a string.
- State: `{ items, columns, getRowId, getRows(): TableRowData<T>[], selection, sort, columnSizing }`. `getRows()` returns `{ item, rowId, index }` **in the order the plugins give** (sorted when the sort plugin is present), memoised on its inputs. Feature slots hold inert defaults without their plugin.
- `useTableSort({ sort?, defaultSort?, onSortChange?(sort, details?) })` with the existing `DataGridSort | null` (`{ columnId, direction }`) and `{ event }` details (R19): `sort: { value: DataGridSort | null, setColumnSort(columnId, direction, e?), toggleColumnSort(columnId, e?), getSortDirection(columnId) }`. Sorting is a stable `slice().sort` by `column.compare`; the comparator looks the column up once, not per comparison (Fluent searches `columns` inside the comparator).
- `useTableSelection({ selectionMode, selectedItems?, defaultSelectedItems?, onSelectedItemsChange?, isDisabled?(item, index) })` (ids, R6): `selection: { selectedItems, allRowsSelected, someRowsSelected, isRowSelected(id), toggleRow(id, e?), selectRow, deselectRow, toggleAllRows(e?), clearRows(e?), selectionMode }`. `allRowsSelected` and `someRowsSelected` are over **every selectable item of `items`**, so they hold while rows are unmounted (R5).
- `useTableColumnSizing(options)`: §6.3.
- Plugin hooks hold their state at the call site (R7); the function they return is pure, applied by `useTableFeatures` in array order. Same plugin twice is a development warning.
- The static `Table` stays stateless (Phase 9 §6); the hooks are for tables a consumer builds from its parts.

Acceptance: a story of the static `Table` with sorting, selection and column sizing from the hooks; type tests for the plugin generics (`T` flows to `getRows`, `isDisabled` and the column ids).

## 5. DataGrid selection that follows the data (P11-02)

### 5.1 Behaviour (only for a grid given `items`)

- Selection state is the id set; rows are views of it. A row click, Space and the selection cell change one id and **never prune ids that are not mounted**.
- The header checkbox reflects the data: checked when every selectable item of `items` is selected, mixed when some are, unchecked otherwise. Select-all selects every selectable item (R5); the next toggle clears only the ids of `items`.
- `onSelectedItemsChange(selectedItems: string[], details?)` keeps today's signature (ids, `{ event }`); it now reports **every** selected id, including ids whose rows are not mounted or not in `items` (today they are "left out of the reported selection and of the select-all state, so the next change drops them", which is what changes).
- A selected id with no item (filtered out, another page, or restored from storage by id) is kept and reported.
- Single mode: the selected id is the one id; changing `items` does not clear it; the "only the first one whose row is rendered" rule of the 0.14 prop JSDoc becomes "the first id".
- A grid built from `DataGrid.Row` children (no `items`) keeps today's semantics (the rows are all mounted).

### 5.2 Per-row facts on the data side

Row facts that live on a mounted row (`DataGrid.SelectionCell disabled`) cannot be read for an unmounted row, so select-all could not skip disabled rows. New prop `isSelectionDisabled?: (item: T, index: number) => boolean`. In the `items` form it is the source of truth for select-all; a mounted row's own `disabled` still applies to its cell and must agree (development warning once on a mismatch).

### 5.3 Store

The selection store keeps its per-row subscription (O(1) select-all notification, the 1000-row cost test stays) but is fed the **universe** (`rowIds`, selectable ids) from `items` instead of the rendered registrations; registration remains only for rendering concerns (the selection label from the first cell, the cell's disabled state). The header state is read from the universe summary.

### 5.4 ARIA and tests

`aria-multiselectable` stays on the grid. A paging story (client-side pages of 20 over 200 items) shows ids selected on page 1 staying selected on page 2 and the header reflecting the page. Tests: select-all over unmounted rows, click on a row with off-screen selection, filtered items, `isSelectionDisabled` skipping, mixed state, the callback reporting ids that are not in `items`.

## 6. Resizable columns (P11-03)

### 6.1 Props (DataGrid)

| Prop | Meaning |
|---|---|
| `resizableColumns?: boolean` | Header cells get a resize handle; `@default false` |
| `columnSizingOptions?: Record<string, { minWidth?: number; idealWidth?: number; defaultWidth?: number }>` | Per column; `minWidth` `@default 80`; initial width `defaultWidth ?? idealWidth ?? 150`, never below `minWidth` (R11) |
| `columnWidths?` / `defaultColumnWidths?` | `Record<string, number>`: controlled / initial widths in px |
| `onColumnWidthsChange?: (widths: Record<string, number>, details: { columnId: string; width: number; event: Event }) => void` | Every step of a drag or key press (R9) |

Labels: `labels.resizeColumn` ("Resize column"), `labels.columnWidth(width)` for `aria-valuetext` ("N pixels"); both in `DataGridLabels`.

### 6.2 Mechanism

- Resizing and windowing need the `columns` prop with `items` (R17).
- The table renders a `<colgroup>` with one `<col>` per column and `table-layout: fixed`; each `<col>` carries its width as inline `width` (a width is runtime data, not a theme value), inside the horizontal scroller. Header and body align by construction, windowed or not (R3).
- Table width (R18): an **unresized** grid (no `columnWidths`, `defaultColumnWidths` or resize yet) is `width: 100%` with `min-width` = the sum of the initial widths, so the browser spreads a wider container; on the first resize the grid measures the rendered header cells and adopts those as the state, so the first drag does not jump. From then on (and whenever `columnWidths` or `defaultColumnWidths` is given) the table is **exactly the sum of the widths**, so the dragged edge follows the pointer and slack shows after the last column.
- The selection cell column keeps its fixed width and has no handle. The last column has a handle (it resizes within the scroller).
- Cells in a sized grid truncate (`overflow-hidden text-ellipsis whitespace-nowrap`) unless the column's cells set otherwise; the Phase 9 `Table.CellLayout truncate` behaviour applies.

### 6.3 `useTableColumnSizing` and `Table.ResizeHandle` (static Table, hook-4 and trh-1)

```ts
useTableColumnSizing({ columnSizingOptions?, columnWidths?, defaultColumnWidths?, onColumnWidthsChange? }):
  { columnWidths, getColumnWidth(id), setColumnWidth(id, width, event?), getTableProps(), getColumnProps(id), getResizeHandleProps(id) }
```

`getTableProps()` returns the table style (`tableLayout`, `minWidth`), `getColumnProps(id)` the `<col>` style, `getResizeHandleProps(id)` the props of `Table.ResizeHandle`.

`Table.ResizeHandle` (new part, `Table.HeaderCell`'s `aside` slot): props `width`, `minWidth`, `maxWidth?`, `onResize(width, details)`, `label`, `valueText`. It is the same component DataGrid renders.

### 6.4 Handle behaviour

- **Pointer** (mouse, touch, pen): `pointerdown` with `setPointerCapture`, `pointermove` batched in `requestAnimationFrame`, `pointerup`/`pointercancel` release; the header cells get `pointer-events: none` during the drag only through a data attribute on the grid, not inline styles. Primary button only. Double click resets to the column's `idealWidth`/default.
- **Keyboard** (R10, R16): the handle is `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` (px), `aria-valuemin`, `aria-valuemax` (when a max is set), `aria-valuetext`, `aria-label`, and carries `data-grid-auxiliary`. `useGridNavigation` ignores auxiliary widgets when it picks a cell's target, so a sortable header's target stays the sort button (Enter sorts as before) and a non-sortable resizable header has no target widget (the cell itself is the target). **F2** on a header cell, or on its target widget, enters interaction mode on the separator (focus moves to it); there the grid's own keys are off and the handle takes ArrowLeft/ArrowRight (20 px; Shift 5 px; ArrowRight grows in LTR and ArrowLeft in RTL via `getArrowIntent`), Home (the minimum) and End (the maximum, only when set); Enter, Space and Escape return focus to the header cell; Tab in interaction mode moves between the cell's widgets as for any cell. Without `data-grid-auxiliary` widgets the hook behaves exactly as in 0.15.
- Forced colors: the handle line uses a system color; visible on hover and focus-visible.
- Reduced motion: nothing animates.

## 7. Windowing the DataGrid (P11-04, part 1)

### 7.1 Prop and rendering

`virtualWindow?: VirtualWindow` (from `useVirtualWindow({ itemSize })`). Only with `items`. When set:

- The grid's scroll container is the element `virtualWindow.scrollRef` is attached to (the grid's own scroll wrapper). Its height comes from the consumer (a class or style on the grid); a missing height is a development warning once (the window would render every row).
- `DataGrid.Body` renders `layout(items.length, { keep })` entries: item rows through the existing memoised row, spacers as `<tr aria-hidden="true" data-virtual-spacer style="height: Npx"><td colSpan={columns} /></tr>`. Each item row gets `style="height: itemSize px"` (enforcing the fixed size) and `overflow` handling per §6.2.
- `keep` holds the row index of the grid's active cell (R12) and of a pending focus request.
- The header is sticky inside the scroller.

### 7.2 ARIA

With a window: `aria-rowcount` = `items.length + headerRowCount`; the header row `aria-rowindex="1"`; item row `aria-rowindex = index + headerRowCount + 1` where `index` is the position in the **sorted** order; `aria-colcount` is not needed (columns are all rendered). Without a window these attributes are absent (no change for existing grids).

### 7.3 Keyboard by the data

`useGridNavigation` gains a **model** option (module-internal use by DataGrid; the public hook keeps its DOM behaviour when it is absent):

```ts
{ rowCount: number; headerRowCount: number; scrollToRow(index): void; isMounted(index): boolean; activeCell: { rowId, columnIndex } | null }
```

- Up/Down/PageUp/PageDown/Home-of-grid (Ctrl+Home)/End-of-grid (Ctrl+End) compute the **target row index from the data** (page = visible rows), then, if that row is not mounted, `scrollToRow(index)` and focus the cell in the commit that mounts it (a pending-focus ref resolved in a layout effect). Left/Right/Home/End within a row use the DOM as today.
- The active cell is **identified by row id and column**, not by element. While its row is outside the range it is kept mounted (R12), so the tab stop and focus are never lost. The roving `sync` fallback to row 0 does not apply to a windowed grid.
- Typeahead over unmounted rows is not offered in the grid (as today, none exists in `useGridNavigation`).
- The mutation observer that restamps tab indexes still observes the table; spacer rows have no cells.

### 7.4 Tests

Mounted-row count with 10,000 items (asserted ≤ the budget of §11); Ctrl+End focuses the last row (asserted by `aria-rowindex`); PageDown from the middle; a focused row kept mounted after scrolling away and back; sorting while windowed keeps `aria-rowindex` in sorted order; select-all with a window; RTL; `renderToString` holds the first window only.

## 8. Windowing List (P11-04, part 2)

- `List` takes `virtualWindow` and `count` (R15): its children are a **function** `(index: number) => ReactNode` returning a `List.Item`; `List` calls `layout(count, { keep })` (keeping the focused index and a pending-focus target), renders the items and the spacers (`<li aria-hidden="true" role="presentation">`), attaches `scrollRef`, and provides each item's `index` through context (so `List.Item` needs no `index` prop). The unwindowed array-children form is unchanged.
- Selection no longer prunes unmounted values: with `count` set the registry's `prune` is skipped and selection is `selectedValues` as given (the data-scoped rule of R5, without select-all, which List does not have).
- Items get `aria-setsize={count}` and `aria-posinset={index + 1}` in a windowed list.
- The registry's order sync (`syncOrder`) uses the context `index` instead of DOM order, and tolerates spacer elements.
- Roving: in `items` and `composite` modes, Home/End/PageUp/PageDown compute the target index from `count`, call `scrollToIndex`, and focus the item in the commit that mounts it; Up/Down at the window edge likewise; the focused item is kept mounted. Typeahead matches the mounted items' labels only (documented limit).

## 9. Windowing Listbox, Combobox and Dropdown (P11-04, part 3)

- `Listbox`, `Combobox` and `Dropdown` accept **data mode**: `items?: readonly ListboxItem[]` (the public type from `useListbox`: `value`, `label`, `disabled`) and `renderOption?: (item, state) => ReactNode` (`@default` `<Option value text>`). With `items`, children are not scanned: keyboard movement, the active descendant, typeahead, the selected label(s) and the Combobox filter all come from `items` (the existing `useListbox` data mode, which TimePicker already uses). Option ids stay stable per value (`getIndex`).
- `virtualWindow` (data mode only): the options list attaches `scrollRef` (for the popup, the `ListboxSurface` scroller, attached when the popup mounts); only `layout(filteredItems.length, { keep: [activeIndex] })` entries render, spacers as `<div role="presentation" aria-hidden="true">`.
- Options in data mode get `aria-setsize` and `aria-posinset` from the data (also without a window, harmless and correct).
- `useActiveDescendant` gets an `onScrollToItem?(index)` hook; data-mode pickers pass `virtualWindow.scrollToIndex`, so ArrowDown to an unmounted option scrolls it into the window, then `aria-activedescendant` points at it once mounted. Home/End/PageUp/PageDown use the data length.
- Filtering: the Combobox filters `items` by the typed text over labels (the existing predicate); the window's count is the filtered length. Multi-select toggle announcements, the clear button and `freeform` behave as today.
- Not in scope: TagPicker, TimePicker, option groups in windowed lists (a development warning once: groups need `OptionGroup` structure that a flat window cannot honour in 0.16).

## 10. `useFlatTree` and `FlatTree` (P11-04, part 4)

### 10.1 Model: `src/lib/flatTree.ts` (server-safe, pure) and `useFlatTree` (public)

```ts
useFlatTree(items: readonly FlatTreeItemData[], options?: {
  expandedItems?, defaultExpandedItems?, onExpandedItemsChange?,         // Tree's names and shapes
  checkedItems?, defaultCheckedItems?, onCheckedItemsChange?(checkedItems, details?),
  selectionMode?                                                        // 'none' | SelectionMode, as Tree
}): FlatTreeModel
interface FlatTreeItemData { value: string; parentValue?: string; itemType?: 'leaf' | 'branch'; label?: string; disabled?: boolean }
```

- `items` is flat; parents may appear anywhere (the model indexes by `parentValue`; unknown parents are a development warning once, cycles are rejected with a warning).
- `FlatTreeModel`: `visibleItems: readonly VisibleFlatItem[]` (only items under expanded branches, in tree order, each `{ item, level, position, setSize, parentValue, hasChildren, expanded, checked }`), `getItem(value)`, `expand(value)`, `collapse(value)`, `toggle(value)`, `getTreeProps()`; checked state comes from the pure cascade, which moves to `src/lib/treeCascade.ts` (R20) and is fed a `TreeNode` forest built from the flat data, not from elements.
- Computed once per change of `items`/expanded set, memoised; visible list generation descends only into expanded branches (O(visible)).

### 10.2 Component

`FlatTree` (root, `role="tree"`) takes `model`, `virtualWindow?`, `aria-label(ledby)`, `renderItem?(item: VisibleFlatItem) => ReactNode` (the item's content; `@default` its label; R15) and the selection props of the nested `Tree` with the same meaning: `selected`/`onItemSelect(value)` (single selection and activation: `aria-selected`, radio-like), `current`, and, with `selectionMode="multiple"`, the model's `checkedItems` trio (`aria-checked`, the cascade). `FlatTree` owns the window: it calls `layout(visibleItems.length, { keep })`, and renders one `FlatTree.Item` per entry as **flat `role="treeitem"` siblings** with `aria-level`, `aria-setsize`, `aria-posinset`, `aria-expanded` (branches), plus the expand chevron (mirrored in RTL) and the checkbox/radio as the nested Tree's items have. Stable class names for the new parts register in `classNames`.

Keyboard (all from the model, scrolling when the target is not mounted, as in §7.3): Up/Down, Home/End, Right (expand or first child), Left (collapse or parent), `*` (expand siblings), Enter/Space (select or toggle check), typeahead over visible labels. The focused item is kept mounted (R12).

The nested `Tree` is unchanged. Fluent's `FlatTree` is the same idea; its virtualized story loses focus and breaks VoiceOver (issues closed stale), which is why the focus-keeping and the position attributes are part of the contract here.

## 11. Budgets

### Render budgets (counted in tests; timed in the browser pass)

- Mounted rows: a DataGrid of 10,000 items in a 480 px scroller with 44 px rows and overscan 6 mounts **at most 30 body rows** (11 visible + 12 overscan + 1 kept + margin) and two spacers; a 10,000-option Combobox at most 30 options; a 5,000-node tree at most 40 items. Asserted in tests by counting elements.
- Scrolling re-renders the host once per row boundary, not per scroll event (test counts renders).
- Browser (Chromium, desktop, no throttling), recorded in §16 by the browser pass: first render of the 10,000-row story ≤ 200 ms of script; sort of 10,000 rows ≤ 150 ms to paint; select-all of 10,000 ≤ 100 ms to paint; a key-held scroll through the grid stays at 60 fps without long tasks over 50 ms.

### Bundle budgets (`verify-dist`)

- `lib/virtual` (the layout math) and the `useVirtualWindow` module: **first measure, then +25%**, with a ceiling of 2 KiB minified and gzipped, like `PRESENCE_BUDGET`.
- Button-only and MessageBar-only imports stay byte-identical to 0.15; a Tree-only import changes only by the moved cascade module (R20; measured, within ±1% of 0.15); a DataGrid-only import may grow by the selection core, column sizing and window support, measured first and fixed at +25% (recorded in §16). Inclusion probes: an import of only `useVirtualWindow` holds no component; an import of only `useSelection` holds no table code. Exclusion probes: DataGrid-only holds no `FlatTree`; `FlatTree`-only holds no DataGrid.

## 12. Packages and order

A. **CORE:** `lib/selection.ts`, `useSelection`, `lib/virtual.ts`, `useVirtualWindow`, types, tests, probes.
B. **HOOKS** (P11-01): `useTableFeatures`, `useTableSort`, `useTableSelection`, `useTableColumnSizing`; the static-Table story.
C. **GRID SELECTION** (P11-02): data-scoped DataGrid selection, `isSelectionDisabled`, paging story.
D. **RESIZE** (P11-03): column sizing in DataGrid, `Table.ResizeHandle`, labels, stories.
E. **GRID WINDOW** (P11-04a): `virtualWindow` on DataGrid, ARIA, navigation model, the 10,000-row story.
F. **LIST** (P11-04b): List windowing and the selection fix.
G. **LISTBOX** (P11-04c): data mode and windowing for Listbox, Combobox, Dropdown; the 10,000-option story.
H. **FLAT TREE** (P11-04d): `useFlatTree`, `FlatTree`, the 5,000-node story.
I. **INTEGRATION and DOCS:** barrels, flat exports, class names, public types, verify-dist probes and budgets, stories gate, CHANGELOG 0.16.0, README, guide, ROADMAP, CLAUDE.md, testing guide.

Order A, B, C, D, E, F, G, H, I; D and E may swap. Each package ends green on its own and could be released alone; if the schedule forces a cut, G and H slip to 0.16.x (**Ruling:** the cut line is after F; cost: Combobox and Tree windowing arrive a minor later).

## 13. Testing

- Pure cores (`lib/selection`, `lib/virtual`, `lib/flatTree`): table tests with edge cases (empty, one item, count smaller than the window, `keep` inside and outside the range, repeated ids, foreign selected ids).
- jsdom has no layout: tests give the scroller `clientHeight` and `scrollTop` (`mockRect` and property stubs) and fire `scroll` in `act`. Asserted facts are attributes, mounted counts and focus; scroll physics, sticky headers and layout go to the browser checklist.
- Every windowed component: mounted-count budget, keyboard to an unmounted target, focus kept after scrolling away, ARIA positions, RTL, `renderToString` (first window), StrictMode once-only callbacks, axe on the story (spacers must pass `aria-required-children`/`aria-hidden-focus`).
- Existing suites pass unedited except assertions that encoded "selection is rendered rows" (each edit recorded in §16).

## 14. Upgrading from 0.15 (for the CHANGELOG)

1. **DataGrid with `items`: selection follows the data.** Select-all covers every selectable item, not only rendered rows; a click on a row no longer drops selected ids that are not rendered, and `onSelectedItemsChange` now reports them (ids, same signature); the header checkbox reflects all items. Grids built from `DataGrid.Row` children are unchanged.
2. A DataGrid with `isSelectionDisabled` disables select-all for those items; without it, `items` rows are all selectable unless their rendered row says otherwise.
3. New: windowing (`useVirtualWindow`, `virtualWindow` on DataGrid, List, Listbox, Combobox, Dropdown), `FlatTree`, the table hooks, resizable columns.
4. Windowed grids need a bounded height and a fixed row height; both are enforced or warned.

## 15. Real-browser checklist (Chromium, Firefox, WebKit)

1. DataGrid 10,000 rows: scroll with the wheel, scrollbar drag and held arrow keys; no blank rows, no jumping; sticky header stays.
2. Ctrl+End, Ctrl+Home, PageDown, PageUp: the right row gets focus and scrolls into view; a focused row scrolled away stays focused and mounted; focus ring visible.
3. Select-all, then deselect one, then sort: header mixed, selection kept, counts right.
4. Column resize by mouse, touch emulation, keyboard; left to right and right to left; the table scrolls horizontally when the sum exceeds the container; header and body stay aligned while windowed; forced colors handle visible.
5. Combobox 10,000: open, scroll, type to filter, arrow past the window, Home/End, select, reopen at the selected option.
6. Tree 5,000: expand a large branch, collapse, Right/Left/Home/End, typeahead, checked cascade, focus kept.
7. Spacer rows: no extra scrollbar, no jump when the window changes size (`table-layout: fixed`, WebKit and Firefox).
8. 200% zoom and a narrow viewport: the scroller still bounds the height; resize handles stay reachable.
9. Screen reader (manual): row and column positions announced ("row 5000 of 10001"), the selected state, the resize separator value.
10. Render budgets (§11): timings recorded.

## 16. Implementation notes

(Empty. Each package appends here every deliberate departure from this spec and every existing test assertion it had to edit, with the reason.)

- **Task 2, `useSelection`:** `toggleAll` does nothing in `single` mode (spec §3.2 is silent; a select-all has no meaning for one id, and `selectAllIds` would break the one-id invariant). `UseSelectionChangeDetails` is a named exported type of the public signature. `selectedItems` keeps its set by content, so a controlled parent that passes a new array of the same ids every render gets the same set.
- **Task 3, `computeVirtualLayout`:** `firstVisible` is clamped to `[0, max(0, count - visibleCount)]`, not to `[0, max(0, count - 1)]` as the task brief said. A real scroller cannot put a row past the last full page at the top (the browser caps `scrollTop` at `count * itemSize - viewport`); with the looser clamp, a list that shrinks under a scrolled window (a filter, a page change) while the hook still holds a large `firstVisible` returned a window that started too late (viewport 480, itemSize 44, overscan 6, firstVisible 5000, count 20 gave rows 13..19 where the browser shows 9..19, leaving rows 9..12 blank until the next scroll event). With the tighter clamp `end` always reaches `count`.
- **Task 4, `useVirtualWindow`:** (1) `scrollToIndex` bounds the offset by the **rendered content** (the scroller's `scrollHeight` in whole rows), not by a `count`: the hook only sees a count inside `layout()`, which runs during render, where C-HOOKS forbids recording it, and a window passed to a child component (a `virtualWindow` prop) is laid out in the child's render anyway. The browser bounds `scrollTop` by the same content, so the result is what the spec's "clamped" asks; a scroller with no layout (jsdom, a hidden one) has no end bound, only the start. (2) `scrollToIndex` also moves the window state in the same update (from the offset it set), so the commit after the call renders the target row, as §7.3 needs; the later `scroll` event finds the state unchanged. (3) The viewport height is read on attach, from the `ResizeObserver`, and also in every scroll frame, so without a `ResizeObserver` a resize is picked up at the next scroll (the brief had the attach-time size stay). (4) An `itemSize` that is not a positive finite number warns once (`useVirtualWindow:item-size`) and counts as 1, the core's own fallback, so the window's `itemSize` and its spacers agree. (5) **Lint rule for every consumer (Tasks 12, 13, 16, 19): never write `ref={virtualWindow.scrollRef}` in JSX.** The React Compiler's `react-hooks/refs` types a member read in the JSX `ref` position (or a variable assigned from one) as a ref, then reports that read and every call on the object during render, so `virtualWindow.layout(count)` fails too; the member's name plays no part (probed: a destructured `scrollRef` passes, a `scroller` member written in `ref=` fails). Merge the callback with the element's own refs (`useMergedRefs(ownRef, virtualWindow.scrollRef)`) or destructure it first (`const { scrollRef } = virtualWindow`); `virtualWindow.layout(count)` is then called as is, and `npm run lint` passes. The hook's JSDoc says so, and the test harness takes the window as a prop in the merged form. (6) **`scrollPaddingStart`** (option, `@default 0`; §3.3), added for DataGrid's sticky header inside the scroller (§7.1): `scrollToIndex` aligns in the area below the header (the viewport less the padding, at least one row), and its content bound leaves the header out (`floor((scrollHeight - scrollPaddingStart) / itemSize)` rows), so the largest offset is the browser's own `scrollHeight - clientHeight`; a value that is not finite, or negative, counts as 0.
- **Task 5, the table hooks:** (1) **The row type is `TableRowData<T>`, not `TableRow<T>`** (§4, controller ruling; §4 and plan Task 5 now say `TableRowData<T>`): `TableRow` is already public, the flat name of `Table.Row`; a type of that name is a duplicate identifier next to it, or, through the barrels' `export *`, silently shadows the component (probed with `tsc`). `TableRowData` is Fluent v9's name for the same `{ item, rowId }`. (2) **A plugin is an opaque descriptor, not a bare function** (R7 said "pure plugin functions"; the brief said "opaque, stable descriptor"). Inside, a plugin has a row order (`sortRows`, the sort only) and a state fill (`extend`); `useTableFeatures` keeps the row order apart, so a selection change leaves `getRows()` the same array, and both stay behind memos with one dependency per feature slot (see "fix round 1" below; no hook in a loop, no lint disable). The public type is `TableFeaturePlugin<T>` with a `unique symbol` brand typed `(item: T) => void`: a plugin cannot be written by hand, and `T` is contravariant, so a plugin that reads no item (`useTableSort()` called alone is `TableFeaturePlugin<unknown>`) fits every table, while a selection whose `isDisabled` reads a `Person` fits only tables of `Person`; called inside the array, the plugin hooks infer `T` from `items`. (3) **`toggleAllRows` works over the selectable ids**: all of them selected removes them, else adds them; a selected disabled row keeps its state, as DataGrid's select-all does today (Review Focus 2), instead of "removes the ids of `items`". Ids outside `items` are kept either way (R5); `clearRows` empties everything. The single-row functions do not read `isDisabled`. (4) `TableColumnSizingState.columnWidths` is `Readonly<Record<string, number>>` (Ruling A had `Record<string, number>`): it is output state; Task 6 may return any `Record`. Without a plugin, the selection slot reports `selectionMode: 'multiple'` with nothing selected, and every inert function does nothing. (5) The sort finds its column by `columnId` only (the deprecated `id` of `DataGridColumn` is not read; `createTableColumn` always sets `columnId`). `onSortChange` gets `{ event }` only when the change was given an event, else `undefined` (`DataGridSortChangeDetails.event` is required). (6) Development warnings: `useTableFeatures:duplicate-plugin` (two plugins for one feature, the case "a plugin used twice"), `useTableFeatures:plugin-count` and `useTableFeatures:duplicate-row-id`, each once. (7) `src/index.ts` is not edited: it re-exports the table barrel (`export * from './components/table'`), which now exports the three hooks and their types.
- **Task 5, fix round 1 (unstable plugin options):** the first version kept the plugin array in a "previous-value" state compared by element and set it during render; a plugin that changes identity on every render (an inline `isDisabled`, and in Task 6 inline `columnSizingOptions`) made every render pass set the state again, so the first re-render threw "Too many re-renders". Now `useTableFeatures` picks one plugin per feature slot (`sort`, `selection`, `columnSizing`) during render and keys its memos on those three variables (fixed dependency lists, no state set during render). **What an unstable option costs:** a plugin object that changes identity makes the state (`TableFeaturesState`, with its `selection` summary, an O(n) pass over `items`) be recomputed on that render, nothing more; `getRows()` keeps its array, because the rows depend only on `items`, `getRowId`, `columns` and the sort plugin's `sortRows`, which `useTableSort` memoises on the sort value alone (an inline `onSortChange` or `defaultSort` keeps even the sort plugin's identity: `useControllable` holds the callback). With stable options the state, and its `selection` and `sort`, keep their identity across unrelated renders. **Departure from §4 "applied in array order":** each plugin fills its own slot and reads no other, so the order of the array does not matter; when a feature is given twice the last plugin of it is used (no longer both sorts applied in turn), and the duplicate warning says so.

- **Task 6, `useTableColumnSizing`:** (1) **The widths in `columnWidths` and in the `onColumnWidthsChange` map are every column's width** (initial widths filled in), not only the stored ones: a persisted map is complete, and the table width is the sum of it. The state is resolved from `state.columns` inside the plugin's `extend`, so a column added later gets its initial width. (2) **`setColumnWidth` ignores an id that is not a column and a width that is not a finite number** (no callback, no state). (3) **`details.event` is required, as the brief says**, so a programmatic `setColumnWidth(id, width)` without an event passes a new `Event('resize')`. (4) **The first width taken as state is a change even when it equals the initial width** (it flips `isSized`, and the callback fires); once sized, setting the width a column already has is not a change. (5) `ResizeHandleProps` of the brief is `TableResizeHandleBindings` (Ruling B), declared in `useTableFeatures.ts` next to `TableColumnSizingState`, which gained `getResizeHandleProps`; `TableColumnWidthsChangeDetails` is a named exported type of `onColumnWidthsChange`. The core `src/lib/columnSizing.ts` stays module-only except the type `ColumnSizingOption`. (6) `getColumnWidth(id)` is `undefined` for an unknown id, while `getColumnProps(id)` and `getResizeHandleProps(id)` describe it with its options' initial width and minimum (150 and 80 without options). (7) The selection column of the features story is a `<col>` outside the plugin's sum; with `table-layout: fixed` the browser widens the table to the sum of its `<col>`s, so the story's sized table is the sum plus that column.

## 17. Risks

1. **Spacer rows and sticky header in native tables** differ across engines (§15.7). Mitigation: the browser pass early, before the List/Listbox/Tree packages; fallback is div rendering in 0.17.
2. **`useGridNavigation` is 680 lines of DOM walking** and public; the model option must not change its behaviour without it.
3. **Behaviour change of selection** for `items` grids (§14.1) can surprise an app that relied on pruning. Mitigation: documented first in the CHANGELOG; no flag.
4. **The Combobox popup mounts its scroller after opening**; `scrollRef` and the initial `scrollToIndex` for the selected option must wait for it.
5. **Keeping the focused row mounted** adds a second spacer segment; a test per component pins it.
6. **Phase size.** Nine packages; the cut line after F is in §12.
