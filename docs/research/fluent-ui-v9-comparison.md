# Fluent UI React v9 vs WaveUI: component and feature comparison

- **Comparison date:** 2026-09-25
- **Fluent UI:** `@fluentui/react-components` 9.74.9, published to npm on 2026-09-23. The source was read from microsoft/fluentui master at `d279227` (2026-09-24).
- **WaveUI:** `@mortenbrudvik/waveui` 0.5.0. It uses React 19 and Tailwind CSS 4 and follows the Fluent 2 design language. It is not Microsoft's library.
- **Method:**
  1. Built a Fluent inventory from the published `dist/index.d.ts` files, the react-components barrel and npm registry data.
  2. Compared ten component families against the WaveUI source.
  3. Checked every gap claim a second time against both codebases. The impacts in this report are those second-pass ratings.

## 1. Summary

### Coverage of the Fluent inventory (76 entries)

| Fluent status | Entries | Equivalent | Partial | Different approach | Missing | Not comparable |
|---|---|---|---|---|---|---|
| Stable | 64 | 2 | 56 | 3 | 3 | 0 |
| Preview | 3 | 0 | 0 | 0 | 3 | 0 |
| Compat | 4 | 0 | 2 | 1 | 1 | 0 |
| Deprecated | 3 | 0 | 1 | 1 | 1 | 0 |
| Unconfirmed (private scaffolds) | 2 | 0 | 0 | 0 | 0 | 2 |
| **Total** | **76** | **2** | **59** | **5** | **8** | **2** |

- **Stable (64):** 63 of these ship in `@fluentui/react-components`. The 64th is Charts, which is the separate package `@fluentui/react-charts`.
  - Equivalent: Image and Portal.
  - Missing: InteractionTag, TagGroup and Charts.
  - Different approach:
    - Listbox/Option/OptionGroup: WaveUI's standalone equivalent is List `selectable`.
    - ColorPicker: WaveUI uses a hex, preset and opacity model.
    - TeachingPopover: WaveUI drives it from a `steps` array.
- **Preview (3), all missing:** MenuGrid, the motion components and the headless components.
- **Compat (4):**
  - DatePicker and TimePicker are partial. Both are first-class components in WaveUI.
  - The standalone Calendar is missing.
  - The v8/v0 migration shims do not apply, because WaveUI has no older API to bridge.
- **Deprecated (3):**
  - The legacy InfoButton/InfoLabel maps to InfoLabel (partial).
  - Alert maps to MessageBar and Toast (different approach).
  - Virtualizer is missing. Fluent moved it to `@fluentui-contrib/react-virtualizer` 1.0.0.
- **Private scaffolds (2):** the native Calendar preview and ComponentSelector are 0.0.0 packages with no implementation.
- **Why so few components are "equivalent":** one retained gap is enough to mark a component partial, even a missing size or slot option. At the sub-component level, 18 parts match fully. Examples are MenuTrigger, DialogTrigger, PopoverTrigger, NavItem, CardFooter, TableHeader and DataGridHeader.

### Gap verification

The second pass checked 476 gap claims:
- 394 were confirmed.
- 81 were adjusted, meaning the facts or the impact were corrected.
- 1 was refuted and dropped. DialogSurface does not add `aria-describedby` automatically in Fluent's current source either.

That leaves 475 gaps: 7 high, 135 medium and 333 low. Some gaps appear in two families: Field validation (forms and feedback) and positioning (overlays and foundation).

| Family | Gaps | High | Medium | Low |
|---|---|---|---|---|
| Buttons and actions | 29 | 0 | 8 | 21 |
| Form inputs | 47 | 0 | 16 | 31 |
| Pickers | 63 | 2 | 22 | 39 |
| Data display | 64 | 0 | 24 | 40 |
| Feedback | 48 | 1 | 9 | 38 |
| Layout and disclosure | 57 | 1 | 17 | 39 |
| Navigation | 36 | 3 | 7 | 26 |
| Overlays | 52 | 0 | 9 | 43 |
| Table | 32 | 0 | 9 | 23 |
| Foundation | 47 | 0 | 14 | 33 |
| **Total** | **475** | **7** | **135** | **333** |

### Most important gaps

1. **Menu:**
   - No submenus (high).
   - No checkbox or radio menu items and no `checkedValues` state (high).
   - No link items, groups or context menu (medium).
   - File: `src/components/navigation/Menu.tsx`
2. **ColorPicker:** no 2-D ColorArea and no hue ColorSlider (both high). Users can only type a hex value or pick a preset. File: `src/components/input/ColorPicker.tsx`
3. **Toast:**
   - Toasts sent through the Toaster accept only a title string and a body string, so there is no Undo action, link or progress bar (high).
   - No Title/Body/Footer parts, no `limit` and no keyboard access (medium).
   - File: `src/components/feedback/Toast.tsx`
4. **Tree:** no multi-select with checkboxes and a mixed state (high). File: `src/components/layout/Tree.tsx`
5. **Dialog and Drawer (medium):**
   - Dialog has no alert or non-modal type, `onOpenChange` gives no close reason, and the footer scrolls out of view.
   - Drawer has no inline type, no bottom position, no sizes, no pinned footer and no non-modal type.
6. **Size and appearance variants (medium):** none of the text inputs or pickers have them. This covers Input, Textarea, Select, SpinButton, SearchBox, Combobox, Dropdown, TagPicker, DatePicker and TimePicker. They are all fixed at 32 px with an outline style.
7. **Dropdown and Combobox (medium):**
   - Neither supports multi-select or has a clear button.
   - Combobox has no chevron.
   - Filtering cannot be customised.
8. **Tags (medium):**
   - There is no TagGroup and no InteractionTag.
   - Tag has no appearance, size or disabled options.
   - Dismissing a tag with the keyboard drops focus to `<body>`.
9. **Motion (medium, foundation):** overlays and disclosures open and close with no animation, and there is no public presence or motion API.
10. **DataGrid and overlay primitives (medium):**
    - DataGrid has no built-in sorting, no column resizing and no virtualization, and its selection covers only rendered rows.
    - The positioning, dismiss, focus-trap and grid-navigation primitives are all internal.

## 2. Component coverage matrix

Bold rows are the inventory entries counted in section 1. The other rows are Fluent sub-components or APIs.

### Buttons and actions
Packages: react-button 9.11.1, react-link 9.8.5, react-toolbar 9.8.5.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Button** | stable | `Button` | partial |
| **CompoundButton** | stable | `CompoundButton` | partial |
| **ToggleButton** | stable | `ToggleButton` (`pressed`, `onPressedChange`) | partial |
| **MenuButton** | stable | `MenuButton` | partial |
| **SplitButton** | stable | `SplitButton` | partial |
| **Link** | stable | `Link` | partial |
| **Toolbar** | stable | `Toolbar` (any focusable descendants) | partial |
| ToolbarButton | stable | `Button` inside `Toolbar` | different approach |
| ToolbarToggleButton | stable | `ToggleButton` inside `Toolbar` | different approach |
| ToolbarRadioGroup + ToolbarRadioButton | stable | none | missing |
| ToolbarGroup | stable | any wrapper element | different approach |
| ToolbarDivider | stable | `Divider orientation="vertical"` | partial |
| Headless hooks and class names (`useButton_unstable`, `buttonClassNames`) | stable exports | none (finished components only) | different approach |

### Form inputs
Packages: react-field 9.5.5, react-label 9.4.5, react-input 9.8.7, react-textarea 9.7.7, react-checkbox 9.6.5, react-radio 9.6.6, react-switch 9.7.6, react-select 9.5.6, react-slider 9.6.6, react-spinbutton 9.6.7, react-search 9.4.7, react-rating 9.4.6.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Field** | stable | `Field` | partial |
| FieldContextProvider, useFieldContext_unstable, useFieldControlProps_unstable | stable exports | `useFieldControl` (the Field context itself is internal) | partial |
| **Label** | stable | `Label` | partial |
| **Input** | stable | `Input` | partial |
| **Textarea** | stable | `Textarea` | partial |
| **Checkbox** | stable | `Checkbox` | partial |
| **RadioGroup / Radio** | stable | `RadioGroup` + `RadioGroup.Item` | partial |
| RadioGroupProvider + context hooks | stable exports | none (module-private) | missing |
| **Switch** | stable | `Switch` | partial |
| **Select** | stable | `Select` | partial |
| **Slider** | stable | `Slider` | partial |
| sliderCSSVars | stable export | theme tokens + className | different approach |
| **SpinButton** | stable | `SpinButton` | partial |
| **SearchBox** | stable | `SearchBox` | partial |
| **Rating** | stable | `Rating` | partial |
| RatingItem / RatingItemProvider | stable exports | none | missing |
| **RatingDisplay** | stable | `RatingDisplay` | partial |

### Pickers
Packages: react-combobox 9.17.7, react-tag-picker 9.10.5, react-color-picker 9.3.1, react-swatch-picker 9.6.2. Compat packages: react-datepicker-compat 0.6.39, react-calendar-compat 0.4.7, react-timepicker-compat 0.4.41.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Combobox** | stable | `Combobox` + `Combobox.Option` / `Combobox.OptionGroup` | partial |
| **Dropdown** | stable | `Dropdown` + `Dropdown.Option` / `Dropdown.OptionGroup` | partial |
| **Listbox / Option / OptionGroup** | stable | `Option` / `OptionGroup` inside Combobox and Dropdown only (partial); List `selectable` stands in for a standalone listbox | different approach |
| useComboboxFilter / useTagPickerFilter | stable exports | filtering built into Combobox, TagPicker, TimePicker | different approach |
| **TagPicker** (+ Control, Group, Input, Button, List, Option, OptionGroup) | stable | `TagPicker` (`options` array) | partial |
| **ColorPicker** | stable | `ColorPicker` (preview, hex field, preset swatches, opacity) | different approach |
| ColorArea | stable | none | missing |
| ColorSlider | stable | none | missing |
| AlphaSlider | stable | ColorPicker `showOpacity` | partial |
| **SwatchPicker** (+ SwatchPickerRow, renderSwatchPickerGrid) | stable | `SwatchPicker` | partial |
| ColorSwatch | stable | `items` entries of SwatchPicker | partial |
| ImageSwatch | stable | none | missing |
| EmptySwatch | stable | none | missing |
| **DatePicker** | compat | `DatePicker` (first-class) | partial |
| **Calendar** (+ CalendarDay, CalendarMonth, CalendarYear, date utilities) | compat | none (grid only inside DatePicker) | missing |
| **TimePicker** | compat | `TimePicker` (first-class) | partial |
| **Calendar (native v9 preview)** | private 0.0.0 scaffold | none | not comparable |

### Data display
Packages: react-avatar 9.11.8, react-badge 9.5.6, react-persona 9.7.10, react-image 9.4.5, react-divider 9.7.5, react-text 9.6.20, react-tags 9.9.7, react-list 9.6.19, react-infolabel 9.4.27.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Avatar** | stable | `Avatar` | partial |
| **AvatarGroup** (+ AvatarGroupItem, AvatarGroupPopover, partitionAvatarGroupItems) | stable | `AvatarGroup` (`max`) | partial |
| **Badge** | stable | `Badge` | partial |
| **CounterBadge** | stable | `CounterBadge` | partial |
| **PresenceBadge** | stable | `PresenceBadge` | partial |
| **Persona** | stable | `Persona` | partial |
| **Image** | stable | `Image` | equivalent |
| **Divider** | stable | `Divider` | partial |
| **Text + typography presets** | stable | `Text` (`variant` covers the ramp) | partial |
| **Tag** | stable | `Tag` | partial |
| **InteractionTag** (+ Primary, Secondary) | stable | none | missing |
| **TagGroup** | stable | none | missing |
| **List** | stable | `List` + `List.Item` | partial |
| **InfoLabel / InfoButton** | stable | `InfoLabel` | partial |
| **InfoButton / InfoLabel (legacy react-infobutton 9.0.1-beta.1)** | deprecated | `InfoLabel` | partial |

### Feedback
Packages: react-message-bar 9.7.7, react-toast 9.8.4, react-progress 9.5.6, react-spinner 9.8.6, react-skeleton 9.7.6. Deprecated: react-alert 9.0.2-beta.1.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **MessageBar** (+ Body, Title, Actions) | stable | `MessageBar` (single component) | partial |
| MessageBarGroup | stable | none | missing |
| **Toast** (Toast, ToastTitle, ToastBody, ToastFooter) | stable | `Toast` (single component) | partial |
| Toaster | stable | `Toaster` | partial |
| useToastController | stable | `useToastController` (dispatch and dismiss only) | partial |
| ToastTrigger | stable | none | missing |
| **ProgressBar** | stable | `ProgressBar` | partial |
| **Spinner** | stable | `Spinner` | partial |
| **Skeleton** (container) | stable | `Skeleton.Group` | partial |
| SkeletonItem | stable | `Skeleton` | partial |
| **Alert** | deprecated | `MessageBar` / `Toast` | different approach |

### Layout and disclosure
Packages: react-card 9.7.3, react-accordion 9.12.4, react-carousel 9.9.14, react-tabs 9.12.5, react-tree 9.16.8, react-overflow 9.9.4, react-drawer 9.13.4.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Card** | stable | `Card` | partial |
| CardHeader | stable | `Card.Header` | partial |
| CardPreview | stable | none | missing |
| CardFooter | stable | `Card.Footer` | equivalent |
| **Accordion** | stable | `Accordion` | partial |
| AccordionItem | stable | `Accordion.Item` | equivalent |
| AccordionHeader | stable | `Accordion.Trigger` | partial |
| AccordionPanel | stable | `Accordion.Panel` | partial |
| **Carousel** | stable | `Carousel` + `Carousel.Item` | partial |
| CarouselViewport / CarouselSlider | stable | built-in track | different approach |
| CarouselCard | stable | `Carousel.Item` | equivalent |
| CarouselNav / CarouselNavButton | stable | built-in dot picker | different approach |
| CarouselNavImageButton | stable | none | missing |
| CarouselNavContainer / CarouselButton | stable | built-in Previous/Next controls | partial |
| CarouselAutoplayButton | stable | `autoPlay` + built-in Pause/Start control | equivalent |
| **TabList** | stable | `TabList` | partial |
| Tab | stable | `TabList.Tab` | partial |
| **Tree / FlatTree** | stable | `Tree` + `Tree.Item` | partial |
| TreeItem | stable | `Tree.Item` | partial |
| TreeItemLayout | stable | built-in row of `Tree.Item` | different approach |
| TreeItemPersonaLayout | stable | none | missing |
| FlatTree + useHeadlessFlatTree_unstable, flattenTree_unstable | stable | none | missing |
| TreeRootReset | stable | built into `Tree` | equivalent |
| **Overflow** | stable | `Overflow` | partial |
| OverflowItem | stable | `Overflow.Item` | partial |
| OverflowDivider (+ groupId, useIsOverflowGroupVisible) | stable | none | missing |
| OverflowReorderObserver | stable | built into `Overflow` | equivalent |
| Overflow hooks (useOverflowMenu, useIsOverflowItemVisible) | stable | same-named hooks | equivalent |
| **Drawer** | stable | `Drawer` (modal) | partial |
| OverlayDrawer | stable | `Drawer` | partial |
| InlineDrawer | stable | none | missing |
| DrawerHeader / DrawerHeaderTitle | stable | built-in header + `Drawer.Title` | partial |
| DrawerHeaderNavigation | stable | none | missing |
| DrawerBody | stable | built-in scrolling body | partial |
| DrawerFooter | stable | none | missing |
| Providers and recomposition hooks | stable exports | internal | different approach |

### Navigation
Packages: react-menu 9.25.6, react-nav 9.4.7, react-breadcrumb 9.4.6. Preview: react-menu-grid-preview 0.5.8.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Menu** | stable | `Menu` | partial |
| MenuTrigger | stable | `Menu.Trigger` | equivalent |
| MenuPopover + MenuList | stable | `Menu.Popover` (surface and list in one); static inline `Menu` | different approach |
| MenuItem | stable | `Menu.Item` | partial |
| Nested submenus | stable | none | missing |
| MenuItemCheckbox (+ checkedValues) | stable | none | missing |
| MenuItemRadio | stable | none | missing |
| MenuItemSwitch | stable | none | missing |
| MenuItemLink | stable | none | missing |
| MenuDivider | stable | `Menu.Divider` | equivalent |
| MenuGroup + MenuGroupHeader | stable | none | missing |
| MenuSplitGroup | stable | none | missing |
| MenuProvider / MenuListProvider + hooks | stable exports | internal contexts | partial |
| **MenuGrid** (+ Row, Cell, Item, Group, GroupHeader) | preview | none | missing |
| **Nav** | stable | `Nav` | partial |
| NavDrawer (+ Header, Body, Footer) | stable | none | missing |
| NavCategory + NavCategoryItem + NavSubItemGroup | stable | `Nav.Category` | different approach |
| NavItem | stable | `Nav.Item` | equivalent |
| NavSubItem | stable | `Nav.SubItem` | equivalent |
| NavSectionHeader | stable | none | missing |
| NavDivider | stable | none | missing |
| AppItem / AppItemStatic | stable | none | missing |
| SplitNavItem | stable | none | missing |
| Hamburger | stable | none (`Button` + own icon) | missing |
| **Breadcrumb** | stable | `Breadcrumb` | partial |
| BreadcrumbItem + BreadcrumbButton | stable | `Breadcrumb.Item` | different approach |
| BreadcrumbDivider | stable | automatic separator | different approach |
| partitionBreadcrumbItems (overflow) | stable utility | none | missing |
| Breadcrumb truncation helpers | stable utility | none | missing |

### Overlays
Packages: react-dialog 9.18.5, react-popover 9.14.9, react-tooltip 9.10.7, react-teaching-popover 9.7.7, react-portal 9.8.16.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Dialog** | stable | `Dialog` | partial |
| DialogTrigger | stable | `Dialog.Trigger` + `Dialog.Close` | equivalent |
| DialogSurface | stable | `Dialog.Content` | partial |
| DialogBody | stable | scrolling body inside `Dialog.Content` | different approach |
| DialogTitle | stable | `Dialog.Title` / `title` prop | partial |
| DialogContent | stable | children of `Dialog.Content` (same name, different meaning) | different approach |
| DialogActions | stable | `Dialog.Footer` | partial |
| DialogProvider / PopoverProvider + use*_unstable, render*_unstable | stable exports | none | missing |
| **Popover** | stable | `Popover` | partial |
| PopoverTrigger | stable | `Popover.Trigger` | equivalent |
| PopoverSurface | stable | `Popover.Content` | partial |
| **Tooltip** | stable | `Tooltip` | partial |
| **TeachingPopover** | stable | `TeachingPopover` (`steps` array) | different approach |
| TeachingPopoverTrigger | stable | none (`open` + `target`) | missing |
| TeachingPopoverSurface | stable | built-in surface | equivalent |
| TeachingPopoverHeader | stable | built-in Close button and heading | partial |
| TeachingPopoverTitle | stable | `steps[i].title` | partial |
| TeachingPopoverBody | stable | `steps[i].body` | partial |
| TeachingPopoverFooter | stable | built-in Back/Next/Done | partial |
| TeachingPopoverCarousel + CarouselCard | stable | `steps` + `activeStep` | different approach |
| TeachingPopoverCarouselNav + NavButton | stable | decorative step dots | partial |
| TeachingPopoverCarouselPageCount | stable | visually hidden "step n of m" | partial |
| TeachingPopoverCarouselFooter | stable | built-in footer row | partial |
| **Portal** | stable | `Portal` + WaveProvider `portalContainer` | equivalent |

### Table
Package: react-table 9.19.22.

| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **Table** | stable | `Table` | partial |
| TableHeader | stable | `Table.Header` | equivalent |
| TableHeaderCell | stable | `Table.HeaderCell` | partial |
| TableBody | stable | `Table.Body` | equivalent |
| TableRow | stable | `Table.Row` | partial |
| TableCell | stable | `Table.Cell` | equivalent |
| TableSelectionCell | stable | none (only inside DataGrid) | missing |
| TableCellLayout | stable | none | missing |
| TableCellActions | stable | none | missing |
| TableResizeHandle | stable | none | missing |
| Table contexts (TableContextProvider, useTableRowIdContext, ...) | stable exports | internal DataGrid contexts | missing |
| **DataGrid** | stable | `DataGrid` | partial |
| DataGridHeader | stable | `DataGrid.Header` | equivalent |
| DataGridHeaderCell | stable | `DataGrid.HeaderCell` | partial |
| DataGridBody | stable | `DataGrid.Body` | different approach |
| DataGridRow | stable | `DataGrid.Row` | partial |
| DataGridCell | stable | `DataGrid.Cell` + automatic focus targets | different approach |
| DataGridSelectionCell | stable | internal selection cells | partial |
| createTableColumn / TableColumnDefinition | stable | `DataGridColumn` type | partial |
| useTableFeatures | stable | none | missing |
| useTableSort | stable | DataGrid `sort` / `defaultSort` / `onSortChange` | missing |
| useTableSelection | stable | DataGrid `selectedItems` props | missing |
| useTableColumnSizing_unstable | stable package, unstable API | none | missing |
| Keyboard navigation helpers (useTableCompositeNavigation) | stable | internal `useGridNavigation` | partial |
| Virtualization (documented pattern; contrib react-data-grid-react-window 1.4.2) | pattern / contrib | none | missing |

### Foundation components
| Fluent component | Status | WaveUI equivalent | Verdict |
|---|---|---|---|
| **FluentProvider** | stable | `WaveProvider` | partial |
| **Motion components** (Collapse, Fade, Scale, Slide, Blur, Rotate, Stagger; 0.15.9) | preview | none | missing |
| **Headless components** (0.3.1) | preview | none | missing |
| **Charts** (`@fluentui/react-charts` 9.3.27, separate package) | stable | none | missing |
| **Virtualizer** (core 9.0.0-alpha.116; contrib 1.0.0) | deprecated | none | missing |
| **Migration shims** (v8 to v9, v0 to v9) | compat | not applicable (Stack, Flex, Grid are WaveUI's counterparts to StackShim, FlexShim, GridShim) | different approach |
| **ComponentSelector** | private 0.0.0 scaffold | none | not comparable |

## 3. Missing components, ranked by impact

The table includes top-level components, sub-components and public APIs that have no WaveUI counterpart. Impact is the verifier's rating.

### High impact

| # | Fluent component | Status | What it is | Why it matters |
|---|---|---|---|---|
| 1 | Nested submenus (react-menu) | stable | A MenuItem that opens a child Menu on ArrowRight (ArrowLeft in RTL) or on hover, with an indicator and a pointer safe zone. | Cascading command menus such as "Move to" or "Sort by" cannot be built. `Menu.tsx` only handles vertical arrow keys. |
| 2 | MenuItemCheckbox + `checkedValues` | stable | Toggle items (`role="menuitemcheckbox"`, `aria-checked`) with a checked-values state held on Menu. | View-option menus. Overriding `role` by hand is possible but undocumented and gives no checkmark and no state. |
| 3 | MenuItemRadio | stable | Single-choice menu items that share `checkedValues`. | "Sort by" and "View as" menus. |
| 4 | ColorArea | stable | A 2-D saturation/value area with keyboard, pointer and touch input. | Without it, an arbitrary colour can only be typed as hex or picked from presets. |
| 5 | ColorSlider | stable | A hue, saturation or value channel slider. | Needed alongside ColorArea to choose a hue visually. The only slider in ColorPicker controls opacity. |

### Medium impact

| # | Fluent component | Status | What it is | Why it matters |
|---|---|---|---|---|
| 6 | InlineDrawer | stable | A side or bottom panel that sits in the page layout, with sizes, a separator and motion. | App shells need it for a collapsible nav or a details pane. The verifier lowered it from high because a plain conditional `<aside>` is a workable substitute. |
| 7 | NavDrawer (+ Header, Body, Footer) | stable | Nav inside an inline or overlay drawer. Its body is an arrow-key navigation group. | This is the main responsive app-shell pattern, and it depends on InlineDrawer. WaveUI's `Drawer` is modal only. |
| 8 | TagGroup | stable | A `role="toolbar"` container with arrow keys, shared size, appearance and disabled, a group `onDismiss`, focus moved after a dismiss, and `selectedValues` / `onTagSelect`. | In WaveUI, dismissing a tag with the keyboard drops focus to `<body>` (`stories/Tag.stories.tsx`), and tags cannot act as selectable filter chips. |
| 9 | InteractionTag (+ Primary, Secondary) | stable | A tag with a main-action button plus a separate dismiss button. | `Tag as="button"` combined with `dismissible` would nest one button inside another. |
| 10 | MenuItemLink | stable | A menu item rendered as `<a href>`. | Navigation menus lose `href`, open-in-new-tab and the browser's link context menu. |
| 11 | MenuGroup + MenuGroupHeader | stable | Labelled item groups (`role="group"`). | Fluent requires them when checkbox and radio items are mixed. A hand-made group works in WaveUI but is undocumented. |
| 12 | DrawerFooter | stable | A footer pinned below the scrolling body. | Apply and Cancel buttons scroll out of view. The workaround is a sticky class. |
| 13 | ToolbarRadioGroup + ToolbarRadioButton | stable | A button-styled exclusive choice (`role="radio"`) inside a toolbar. | This is the one toolbar item type WaveUI cannot compose. A `role="radiogroup"` wrapper counts as a nested composite and gets no arrow keys (`src/hooks/useRovingTabIndex.ts`). |
| 14 | CarouselNavImageButton | stable | A carousel nav button that shows a thumbnail of its slide. | Image galleries. WaveUI only has dots (`Carousel.tsx`). |
| 15 | FlatTree + useHeadlessFlatTree_unstable, flattenTree_unstable | stable | A flat, data-driven tree model that supports virtualization and reordering. | Large trees. WaveUI keeps every visible item in the DOM (`Tree.tsx`). |
| 16 | Calendar (+ CalendarDay, CalendarMonth, CalendarYear) | compat | An always-visible calendar with range types, week numbers and marked days. | Scheduling and dashboard UIs. WaveUI's grid only exists inside the DatePicker popup (`DatePicker.tsx`). |
| 17 | ToastTitle / ToastBody / ToastFooter | stable | Toast layout parts with action, media, subtitle and footer slots. | Needed for toasts that carry actions (see the Toast gap in 4.5). |
| 18 | MessageBarActions | stable | An action area separate from the dismiss button, laid out to follow the bar's reflow. | Actions such as Retry or Learn more end up in the text column (`MessageBar.tsx`). |
| 19 | TableResizeHandle (+ useTableColumnSizing_unstable) | stable | Column resizing with mouse, touch and keyboard (20 px steps, 5 px with Shift). | Data-heavy grids. |
| 20 | useTableFeatures | stable | Headless table state with sort, selection and sizing plugins. | Custom tables and virtualization need state that lives outside the rendered rows. |
| 21 | partitionBreadcrumbItems (+ Overflow priority and divider) | stable | Collapses the middle breadcrumb items into a "..." menu. | Deep hierarchies. WaveUI's `Overflow` hides items from the end, so the current page would go first, and it has no priority setting. |
| 22 | Listbox primitives (ListboxProvider, useListboxContext_unstable, base hooks) | stable | Building blocks for custom pickers; Fluent's TagPicker is built on them. | `useListbox` and `ListboxSurface` are internal (`src/hooks/useListbox.ts`). |
| 23 | Motion core (createPresenceComponent, createMotionComponent, PresenceGroup, motionTokens) | stable | A presence and motion API built on the Web Animations API. | Needed for any enter or exit animation (see section 5). |
| 24 | Virtualizer | deprecated in core; stable in `@fluentui-contrib/react-virtualizer` 1.0.0 | Windowed rendering. | Long lists, grids and trees (see section 5). |
| 25 | Charts (`@fluentui/react-charts` 9.3.27) | stable, separate package | More than 20 D3-based chart types with legends and callouts. | Dashboards. Fluent also ships this outside react-components. |

### Low impact

| Fluent component | Status | What it is and why it matters |
|---|---|---|
| MenuItemSwitch | stable | A switch-styled checkbox item. Depends on the checkbox-item model. |
| MenuSplitGroup | stable | A main action and a submenu trigger in one row. Depends on submenus. |
| MenuGrid | preview | A grid-shaped menu. Preview only. |
| NavSectionHeader | stable | A heading (`h3` by default) between nav groups. In WaveUI the consumer adds one inside an `<li>`. |
| NavDivider | stable | A divider inside the nav list. `Divider` cannot be a direct child of Nav's `<ul>`. |
| AppItem / AppItemStatic | stable | An app-identity item at the top of the nav. |
| SplitNavItem | stable | A nav item with inline action, toggle and menu buttons. |
| Hamburger | stable | A nav toggle button. `Button` plus an icon works. |
| Breadcrumb truncation helpers | stable | Truncate names at 30 characters and tooltips at 80. Tooltip plus `truncate` works. |
| MessageBarTitle | stable | A semibold title that labels the bar. The consumer can wire `aria-labelledby` (the verifier lowered this from medium). |
| MessageBarGroup | stable | A stacking container with enter/exit motion. |
| ToastTrigger | stable | Makes any button inside a toast dismiss it. Only matters once toasts accept custom content. |
| CardPreview | stable | Edge-to-edge media with a logo slot. WaveUI's Card root has no padding, so media already reaches the edges. |
| TreeItemPersonaLayout | stable | A persona row layout for tree items. |
| OverflowDivider + groupId | stable | Hides dividers together with their group. |
| DrawerHeaderNavigation | stable | A back/close navigation area for multi-level drawers. |
| TeachingPopoverTrigger | stable | A trigger part. The `target` prop covers tips that open on their own. |
| ImageSwatch | stable | Image or pattern swatches. Gradients do not work in WaveUI either, because swatches set `backgroundColor`. |
| EmptySwatch | stable | An "add colour" placeholder swatch. |
| RatingItem / RatingItemProvider | stable | Per-item icons and styling. |
| RadioGroupProvider + context hooks | stable | Let custom visuals such as radio cards join a group. |
| FieldContextProvider / useFieldContext_unstable | stable | Read or provide raw Field state. `useFieldControl` covers wiring a control. |
| Standalone Listbox | stable | A listbox with options and groups outside a combobox. List `selectable` covers most uses. |
| Standalone InfoButton | stable | An info button without a label, for example next to a heading. |
| TableSelectionCell | stable | A pre-styled selection cell. A `Checkbox` (with `indeterminate`) inside `Table.Cell` works. |
| TableCellLayout | stable | A media, description and primary-text cell layout. Persona or flex markup works. |
| TableCellActions | stable | Actions revealed on hover or focus. Tailwind `group` classes work. |
| Table contexts, DataGridSelectionCell export, useTableSort, useTableSelection | stable | Hooks for extensions and programmatic control. DataGrid's controlled props cover the common cases. |
| DialogProvider / PopoverProvider + use*_unstable / render*_unstable | stable exports | Hooks for rebuilding components. |
| Motion components | preview 0.15.9 | Collapse, Fade, Scale, Slide and Stagger. |
| Headless components | preview 0.3.1 | Its README says it is not production-ready. |

## 4. Feature gaps in existing components

This section covers only confirmed and adjusted gaps, highest impact first. Missing sub-components are in section 3, and foundation gaps are in section 5. Low-impact gaps are listed in collapsed blocks.

### 4.1 Buttons and actions
29 gaps: 0 high, 8 medium, 21 low. ToolbarRadioGroup (medium) is in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Button family | No `disabledFocusable`. A consumer `aria-disabled` keeps the button focusable, but its handlers still run. The internal `focusableDisabledProps` helper is not exported. SplitButton halves are also affected. | `src/components/button/Button.tsx`, `src/lib/aria.ts` | buttons-3 |
| medium | Button family | No `iconPosition`: the icon always comes before the label. A trailing icon has to go in children, with `aria-hidden` and the gap added by hand. | `src/components/button/Button.tsx` | buttons-2 |
| medium | CompoundButton | No typed `icon` slot and no `iconPosition`, so its signature icon-beside-two-lines layout is not available. | `src/components/button/CompoundButton.tsx` | buttons-6 |
| medium | SplitButton | No `icon`, `iconPosition` or `menuIcon`. The chevron is set after the consumer's props, so it cannot be replaced. | `src/components/button/SplitButton.tsx` | buttons-13 |
| medium | ToggleButton | No opt-in accessible checked style (`isAccessible`). Outside forced colours, the pressed state is only a tint or colour change. | `src/components/button/buttonStyles.ts` | buttons-8 |
| medium | Link | Without `href` it stays an `<a>` with no role and no tab stop. Fluent renders `<button type="button">`. | `src/components/button/Link.tsx` | buttons-15 |
| medium | Toolbar | No `checkedValues` or `onCheckedValueChange`. Grouped toggle state, such as formatting or alignment, has to be wired by hand. | `src/components/button/Toolbar.tsx` | buttons-19 |

<details><summary>Low-impact gaps</summary>

- **Button** (`Button.tsx`, `buttonStyles.ts`, `src/lib/types.ts`):
  - No `shape` prop in the button family. The workaround is `className`; on SplitButton, use `rounded-s-full` and `rounded-e-full` on the two halves (buttons-1).
  - There is no `secondary` appearance name, because WaveUI's `outline` is Fluent's `secondary`. There is also no bordered variant with a transparent background (buttons-4).
  - `as="a"` without `href` gets no role and no tab stop, and Space does not activate anchors (buttons-5).
- **CompoundButton:** `secondaryText` is a plain node, not a slot (buttons-7).
- **ToggleButton and MenuButton:**
  - ToggleButton uses `pressed` naming where Fluent uses `checked` (buttons-9).
  - ToggleButton always writes `aria-pressed`, even with `role="checkbox"` (buttons-10).
  - Neither is polymorphic at the type level (buttons-11).
- **MenuButton:** `aria-expanded` is absent unless `expanded` is set or Menu.Trigger sets it (buttons-12).
- **SplitButton:** the menu half is named with a fixed English "More options" instead of falling back to the primary label (buttons-14).
- **Link:**
  - It uses a single appearance enum whose default, `inline`, is always underlined. Fluent uses `appearance` plus a boolean `inline`, and its LinkContextProvider exists only in `@fluentui/react-link` (buttons-16).
  - No `disabledFocusable` (buttons-17).
  - No inverted or brand background colours (buttons-18).
- **Toolbar** (`Toolbar.tsx`, `src/hooks/useRovingTabIndex.ts`, `src/components/layout/Overflow.tsx`, `src/components/data-display/Divider.tsx`):
  - No `size` (buttons-20).
  - Arrow keys skip disabled and `aria-disabled` items (buttons-21).
  - The arrow axis follows `orientation`; Fluent moves on both axes (buttons-22).
  - No `groupId` overflow grouping and no Toolbar plus Overflow story (buttons-23).
  - No ToolbarButton defaults and no vertical icon-over-label layout (buttons-24).
  - Toggle items are not bound to toolbar state (buttons-25).
  - No ToolbarGroup (buttons-27).
  - No divider that follows the toolbar's orientation (buttons-28).
- **Headless hooks and static class names** are not public (buttons-29).
</details>

### 4.2 Form inputs
47 gaps: 0 high, 16 medium, 31 low.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Field | Only `error` exists. There is no warning, success or neutral `validationState`. | `src/components/input/Field.tsx` | form-basic-1 |
| medium | Field | No `orientation="horizontal"`. Adding `flex-row` through className also moves the hint and the error. | `src/components/input/Field.tsx` | form-basic-3 |
| medium | Field | The hint is hidden while an error is shown; Fluent shows both. | `src/components/input/Field.tsx` | form-basic-5 |
| medium | Field | The label is fixed inside Field's own `<label>`, so InfoLabel cannot serve as a Field label. | `src/components/input/Field.tsx`, `src/components/data-display/InfoLabel.tsx` | form-basic-6 |
| medium | Input | No `appearance` (underline, filled-darker, filled-lighter). | `src/components/input/Input.tsx` | form-basic-10 |
| medium | Input | No `size`. The height is fixed at 32 px, which is Fluent's medium. | `src/components/input/Input.tsx` | form-basic-11 |
| medium | Checkbox | `label` accepts only a string, and `children` are silently dropped. An external `<label htmlFor>` still names the checkbox and toggles it on click. | `src/components/input/Checkbox.tsx` | form-basic-16 |
| medium | RadioGroup item | `label` accepts only a string. Labels with subtext need external markup. | `src/components/input/RadioGroup.tsx` | form-basic-19 |
| medium | Switch | No `labelPosition` (before or above), which settings lists need. | `src/components/input/Switch.tsx` | form-basic-22 |
| medium | Slider | The rail shows no filled progress. | `src/components/input/Slider.tsx` | form-basic-29 |
| medium | SpinButton | No `displayValue` for formatted text such as "$1.00". | `src/components/input/SpinButton.tsx` | form-basic-32 |
| medium | SpinButton | The value cannot be empty (null); clearing the field reverts to the last value. | `src/components/input/SpinButton.tsx` | form-basic-33 |
| medium | SpinButton | Holding a step button does not keep stepping. | `src/components/input/SpinButton.tsx` | form-basic-34 |
| medium | Rating | Whole stars only; no `step={0.5}`. | `src/components/input/Rating.tsx` | form-basic-39 |
| medium | RatingDisplay | No visible value text. | `src/components/input/Rating.tsx` | form-basic-43 |
| medium | RatingDisplay | No `count` (number of ratings). | `src/components/input/Rating.tsx` | form-basic-44 |

<details><summary>Low-impact gaps</summary>

- **Field** (`Field.tsx`, `src/hooks/useFieldControl.ts`):
  - No validation message icon (form-basic-2).
  - No `size` (form-basic-4).
  - No render-function children, although cloning the child covers wrappers that forward props (form-basic-7).
  - No public Field context (form-basic-8).
- **Label:** the required indicator is always `*` (form-basic-9).
- **Input:** className moves from the `<input>` to the wrapper once slot content appears (form-basic-12).
- **Textarea** (`Textarea.tsx`):
  - Resizing is fixed to vertical (form-basic-13).
  - No appearance or size (form-basic-14).
  - No `onValueChange` (form-basic-15).
- **Checkbox:**
  - No `labelPosition` (form-basic-17).
  - No circular shape or large size (form-basic-18).
- **RadioGroup:**
  - No `horizontal-stacked` layout (form-basic-20).
  - The context is not public (form-basic-21).
- **Switch:**
  - No small size (form-basic-23).
  - No `disabledFocusable`, and a consumer `aria-disabled` lands on the root label (form-basic-24).
  - The label is string-only, although an external label works (form-basic-25).
- **Select** (`Select.tsx`):
  - No appearance or size (form-basic-26).
  - No icon slot (form-basic-27).
  - No `onValueChange` (form-basic-28).
- **Slider:**
  - No vertical orientation (form-basic-30).
  - No small size (form-basic-31).
- **SpinButton:**
  - Decimals cannot be capped (form-basic-35).
  - No appearance or size (form-basic-36).
  - The inner input is fixed at 48 px wide (form-basic-37).
- **SearchBox:** no appearance or size (form-basic-38).
- **Rating:**
  - No custom icons (form-basic-40).
  - No `color` prop (form-basic-41).
  - RatingItem is covered in section 3 (form-basic-42).
- **RatingDisplay:**
  - No `compact` mode (form-basic-45).
  - No colour or icon options (form-basic-46).
  - Its accessible name is hard-coded English and is missing from the README localisation table (form-basic-47).
</details>

### 4.3 Pickers
63 gaps: 2 high, 22 medium, 39 low. 18 of them are measured against Fluent compat packages (DatePicker, Calendar, TimePicker). ColorArea and ColorSlider (high), plus Calendar, ImageSwatch and EmptySwatch, are in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Dropdown | Single value only; there is no select-only checkbox multi-select. The verifier lowered this from high because List `selectable` and native `Select multiple` exist. | `src/components/input/Dropdown.tsx` | dropdown-1 |
| medium | Combobox | Single value only. `useListbox` already supports `multiple`, and TagPicker covers typed multi-select. | `src/components/input/Combobox.tsx`, `src/hooks/useListbox.ts` | combobox-1 |
| medium | Combobox | No `clearable`, so a non-freeform selection cannot be cleared. DatePicker and TimePicker already have `clearable`. | `src/components/input/Combobox.tsx` | combobox-2 |
| medium | Dropdown | No clear button. | `src/components/input/Dropdown.tsx` | dropdown-2 |
| medium | Combobox | No expand chevron, so nothing visually marks it as a combobox. | `src/components/input/Combobox.tsx` | combobox-4 |
| medium | Combobox, Dropdown, TagPicker | No `size` or `appearance`. | `Combobox.tsx`, `Dropdown.tsx`, `TagPicker.tsx` | combobox-3, dropdown-3, tagpicker-7 |
| medium | Filtering | Fixed case-insensitive substring match. Prefix, fuzzy and accent-insensitive matching are not possible. | `Combobox.tsx`, `TagPicker.tsx` | filter-1 |
| medium | Filtering | The typed query is internal in non-freeform Combobox and in TagPicker, so async search needs workarounds. A freeform Combobox can use `onValueChange`. | `Combobox.tsx`, `TagPicker.tsx` | filter-2 |
| medium | Listbox primitives | `useListbox`, `ListboxContext` and `ListboxSurface` are internal, so apps cannot build their own pickers on them. | `src/hooks/useListbox.ts`, `src/index.ts` | listbox-2 |
| medium | TagPicker | Takes an `options` array instead of composable parts. | `src/components/input/TagPicker.tsx` | tagpicker-1 |
| medium | TagPicker | Tags are text only: no Avatar and no secondary text. | `TagPicker.tsx` | tagpicker-2 |
| medium | TagPicker | Options are plain labels: no media and no secondary content. | `TagPicker.tsx` | tagpicker-3 |
| medium | TagPicker | Users cannot create their own tags (free tagging). | `TagPicker.tsx` | tagpicker-6 |
| medium | DatePicker (vs compat) | No month or year picker. Changing the year takes Shift+PageUp/PageDown, which only works from the keyboard. | `src/components/input/DatePicker.tsx` | datepicker-1 |
| medium | DatePicker (vs compat) | No size or appearance. | `DatePicker.tsx` | datepicker-8 |
| medium | TimePicker (vs compat) | Invalid typed text stays after Enter and silently reverts on blur. There is no callback and no `aria-invalid`, although DatePicker has `onInvalidInput`. | `src/components/input/TimePicker.tsx` | timepicker-1 |
| medium | TimePicker (vs compat) | No size, appearance or popup placement options. | `TimePicker.tsx` | timepicker-7 |
| medium | ColorPicker | Fixed layout with a hex string value; its parts cannot be rearranged or reused. | `src/components/input/ColorPicker.tsx` | colorpicker-1 |
| medium | SwatchPicker | Takes an `items` array, so swatches cannot be wrapped, for example in a Tooltip showing the colour name. | `src/components/input/SwatchPicker.tsx` | swatchpicker-1 |

<details><summary>Low-impact gaps</summary>

- **Combobox and Dropdown** (`Option.tsx`, `Dropdown.tsx`):
  - No `inlinePopup`, `positioning` or per-instance mount node (combobox-5, dropdown-5).
  - No `onActiveOptionChange` (combobox-6, dropdown-6).
  - No documented virtualization pattern; Fluent's own story relies on the unstable Virtualizer (combobox-7).
  - Dropdown's chevron is fixed, and its trigger shows only the option's label text (dropdown-4).
- **Option and OptionGroup** (`Option.tsx`):
  - Disabled options are skipped by the keyboard, whereas Fluent keeps them reachable (option-1).
  - No `checkIcon` slot (option-2).
  - The group `label` is a required string (option-3).
- **Listbox:** no standalone listbox with groups. List `selectable` covers most needs (listbox-1).
- **TagPicker:**
  - No option groups (tagpicker-4).
  - No button trigger (tagpicker-5).
  - No chevron and no secondary action such as clear-all (tagpicker-8).
  - No single-line layout with a "+N" count (tagpicker-9).
  - The portaled popup position is fixed (tagpicker-10).
- **DatePicker (vs compat):**
  - No range types (datepicker-2).
  - No week numbers (datepicker-3).
  - No "Go to today" or close button (datepicker-4).
  - No `today` or `initialPickerDate` (datepicker-5).
  - No marked days or custom cells (datepicker-6).
  - It does not open when the input is clicked. This follows the APG date picker dialog pattern (datepicker-7).
  - No popup placement options (datepicker-9).
- **Calendar (vs compat):** the date utilities in `dateUtils.ts` are internal (calendar-2).
- **TimePicker (vs compat):**
  - No seconds (timepicker-2).
  - The format defaults to 12-hour whatever the locale (timepicker-3).
  - No custom format or parse functions (timepicker-4).
  - No mode that restricts input to listed times (timepicker-5).
  - The value is a string rather than a Date (timepicker-6).
- **ColorPicker:**
  - No RGB fields. Fluent has none built in either; its story composes them (colorpicker-2).
  - No `shape` (colorpicker-3).
- **AlphaSlider:** the opacity slider exists only inside ColorPicker, with no transparency mode and no vertical layout (alphaslider-1).
- **SwatchPicker:**
  - No grid layout with 2-D navigation (swatchpicker-2).
  - No extra-small size and no spacing option (swatchpicker-3).
  - No `focusMode="tab"` (swatchpicker-4).
  - Arrow keys also select, following the APG radio pattern; Fluent's arrows only move focus (swatchpicker-5).
- **ColorSwatch:**
  - No disabled swatches (colorswatch-1).
  - No icon, contrast border, or per-swatch size and shape (colorswatch-2).
</details>

### 4.4 Data display
64 gaps: 0 high, 24 medium, 40 low. InteractionTag and TagGroup (4 medium gaps, including focus loss after a keyboard dismiss and selectable tags) are in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Avatar | Always circular; there is no square shape for groups, apps or bots. | `src/components/data-display/Avatar.tsx` | avatar-1 |
| medium | Avatar | No colour options (neutral, brand, colorful hashing or the 30 named colours). Initials are always brand-coloured, where Fluent defaults to neutral. | `Avatar.tsx` | avatar-2 |
| medium | Avatar | 5 sizes (24 to 56 px) against Fluent's 14 (16 to 128 px). | `Avatar.tsx` | avatar-3 |
| medium | Avatar | Initials take the first character of the first and last word, so "Jane Doe (Contoso)" becomes "J(". There is no handling for brackets, phone numbers, non-Latin scripts or RTL. | `Avatar.tsx` | avatar-4 |
| medium | AvatarGroup | Overlapping stack only; no `spread` layout, which is Fluent's default. | `src/components/data-display/AvatarGroup.tsx` | avatargroup-1 |
| medium | Badge | `important` uses the orange severe tokens, while Fluent's `important` is near-black neutral. | `src/components/data-display/Badge.tsx` | badge-1 |
| medium | Badge | No `severe` or `subtle` colour, although the severe tokens already exist. | `src/lib/types.ts` | badge-2 |
| medium | CounterBadge | No `dot` indicator. | `src/components/data-display/CounterBadge.tsx` | counterbadge-1 |
| medium | CounterBadge | Always brand-coloured; no `color`. | `CounterBadge.tsx` | counterbadge-2 |
| medium | Persona | No third or fourth text line. | `src/components/data-display/Persona.tsx` | persona-1 |
| medium | Persona | No `textPosition` (before or below the avatar). | `Persona.tsx` | persona-2 |
| medium | Tag | No `appearance` (filled, outline, brand). | `src/components/data-display/Tag.tsx` | tag-1 |
| medium | Tag | No `size`. | `Tag.tsx` | tag-2 |
| medium | Tag | No `disabled`. | `Tag.tsx` | tag-3 |
| medium | List | Only selectable lists get roving focus and arrow keys, so a list you can navigate but not select is not possible. | `src/components/data-display/List.tsx` | list-1 |
| medium | List | No `onAction` separate from selection; Enter and Space both toggle selection. | `List.tsx` | list-2 |
| medium | List | No per-item `disabledSelection`. | `List.tsx` | list-3 |
| medium | InfoLabel | `info` accepts only a string, and the popup cannot hold focusable content such as links. | `src/components/data-display/InfoLabel.tsx` | infolabel-1 |
| medium | InfoLabel | The label is a `<span>`: no `htmlFor`, `required`, `size` or `disabled`. | `InfoLabel.tsx` | infolabel-2 |
| medium | InfoLabel in Field | No clean pattern; the info button ends up inside Field's `<label>`. | `src/components/input/Field.tsx` | infolabel-3 |

<details><summary>Low-impact gaps</summary>

- **Avatar:**
  - No active/inactive state (avatar-5).
  - No initials slot (avatar-6).
  - The badge is not sized automatically and not merged into the avatar's accessible name (avatar-7).
- **AvatarGroup:**
  - No pie layout (avatargroup-2).
  - The group size does not reach its members (avatargroup-3).
  - No AvatarGroupItem or AvatarGroupPopover parts and no partition helper (avatargroup-4).
  - The overflow list shows names only, not avatars (avatargroup-5).
  - The overflow trigger always shows an uncapped "+N", with no icon indicator and no controlled open state (avatargroup-6).
- **Badge:**
  - No ghost appearance (badge-3).
  - No shape option (badge-4).
  - No icon slot (badge-5).
  - No tiny or dot sizes (badge-6).
- **CounterBadge:**
  - No `showZero` (counterbadge-3).
  - No ghost appearance, shape or size (counterbadge-4).
- **PresenceBadge** (`PresenceBadge.tsx`, `src/lib/types.ts`):
  - No blocked or unknown status (presence-1).
  - No `outOfOffice` modifier (presence-2).
  - Uses `dnd`/`oof` names, and the status is required (presence-3).
  - The icon cannot be overridden (presence-4).
- **Persona:**
  - No text alignment option (persona-3).
  - No `presenceOnly` (persona-4).
  - `name` is required and the text lines are not slots (persona-5).
  - No `huge` size, and the text does not scale with size (persona-6).
- **Divider:** no appearance (divider-1), no inset (divider-2) and no `alignContent` (divider-3).
- **Text** (`src/components/typography/Text.tsx`):
  - No truncate or wrap props, although the `truncate` and `whitespace-nowrap` classes are in `dist/styles.css` (text-1).
  - No italic, underline or strikethrough props. `.underline` is in the stylesheet; `.italic` and `.line-through` are not (text-2).
  - No monospace or numeric font (text-3).
  - No medium weight (text-4).
  - No align or block props (text-5).
  - No preset components such as Body1Strong (text-6).
- **Tag:**
  - No Delete/Backspace dismissal. In Fluent this only works inside a TagGroup (tag-4).
  - Always pill-shaped (tag-5).
  - No media, icon or secondary-text slots (tag-6).
  - No `selected` or `value` (tag-7).
- **List:**
  - No checkbox checkmark slot (list-4).
  - The selection API differs: string values only, and the root element is fixed (list-5).
  - Behaviour under virtualization is unverified (list-6).
- **InfoLabel:** it opens on focus, hover and click, portaled and without an arrow. Fluent's InfoButton opens on click only, inline, with an arrow (infolabel-5). The standalone InfoButton is covered in section 3 (infolabel-4).
</details>

### 4.5 Feedback
48 gaps: 1 high, 9 medium, 38 low.
- Six of these (field-1 to field-6) repeat Field gaps from 4.2, including field-1 and field-4 at medium.
- MessageBarActions and the Toast layout parts (medium) are in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| **high** | Toast | `dispatchToast` accepts only `title: string` and `body?: string`, so toasts shown through the Toaster cannot hold an Undo button, a link, a progress bar or any other markup. | `src/components/feedback/Toast.tsx` | toast-1 |
| medium | Toaster | No `limit` or queue; every toast is shown at once. | `Toast.tsx` | toaster-1 |
| medium | Toaster | No keyboard shortcut to reach the toasts, no Escape to dismiss them all and no Delete on a focused toast. | `Toast.tsx` | toaster-2 |
| medium | ProgressBar | The fill is always `bg-primary`; no `color` (success, warning, error). | `src/components/feedback/ProgressBar.tsx` | progress-1 |
| medium | ProgressBar | Does not read the Field context: inside a Field it stays unnamed and ignores the Field's error. | `ProgressBar.tsx`, `src/components/input/Field.tsx` | progress-2 |
| medium | Spinner | No `appearance="inverted"`. The ring cannot be recoloured through props, so it blends into a primary Button. | `src/components/feedback/Spinner.tsx` | spinner-1 |

<details><summary>Low-impact gaps</summary>

- **MessageBar** (`MessageBar.tsx`):
  - No title part. The consumer can wire `aria-labelledby` (messagebar-1).
  - No automatic reflow layout (messagebar-3).
  - Always rounded, though `rounded-none` works (messagebar-4).
  - The bar is its own live region and there is no politeness prop, although a consumer `role` overrides it. Fluent announces only when an AriaLiveAnnouncer is mounted (messagebar-5).
  - No public context (messagebar-6).
  - MessageBarGroup is covered in section 3.
- **Toast:**
  - No media or icon override (toast-3).
  - No inverted appearance, although the inverted tokens exist (toast-4).
  - No enter/exit motion (toast-5).
- **Toaster:**
  - The offset is fixed at 16 px (toaster-3).
  - No centred positions and no per-toast position (toaster-4).
  - The Toaster must wrap the components that call it; there is no `toasterId` (toaster-5).
  - Always portaled (toaster-6).
  - No per-toast politeness and no custom announce function (toaster-7).
  - No priority (toaster-8).
  - The defaults differ: a 5000 ms timeout, pausing always on and a Dismiss button always present (toaster-9).
- **useToastController:**
  - No `dismissAllToasts`, though ids are returned (toastctl-1).
  - Updating a toast replaces its options instead of merging them (toastctl-2).
  - No pause or play (toastctl-3).
  - No `onStatusChange` (toastctl-4).
  - ToastTrigger is covered in section 3.
- **ProgressBar:**
  - No thickness option (progress-3).
  - No square shape (progress-4).
  - `max` defaults to 100, not 1 (progress-5).
  - The indeterminate animation cannot be replaced (progress-6).
- **Spinner:**
  - No `delay` (spinner-2).
  - No `labelPosition` (spinner-3).
  - 5 sizes (12 to 48 px) against Fluent's 8 (16 to 44 px), and the same size names map to different pixel sizes (spinner-4).
  - The label is string-only and there is no size context (spinner-5).
- **Skeleton** (`Skeleton.tsx`):
  - Pulse animation only, no shimmer (skeleton-1).
  - No translucent appearance (skeleton-2).
  - No group-level size or shape (skeleton-3).
  - A bare Skeleton is 0 px tall (skeletonitem-1).
- **Field (duplicates of 4.2):** field-2, field-3, field-5 and field-6.
- **announce():** no `batchId` or `priority` options (announce-1; `src/hooks/useAnnounce.ts`).
</details>

### 4.6 Layout and disclosure
57 gaps: 1 high, 17 medium, 39 low. FlatTree, CarouselNavImageButton, InlineDrawer and DrawerFooter (4 medium) are in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| **high** | Tree | No multi-select: no checkboxes, no `aria-checked` and no mixed state. Single selection through `selected` is covered. Putting a Checkbox in the label would nest interactive content. | `src/components/layout/Tree.tsx` | tree-1 |
| medium | Tree | No row actions or aside content, and no treegrid navigation into them. | `Tree.tsx` | tree-2 |
| medium | Card | One fixed look; no `appearance` (filled-alternative, outline, subtle). | `src/components/layout/Card.tsx` | card-1 |
| medium | Card.Header | No image (avatar or icon) slot and no action (menu) slot. | `Card.tsx` | card-8 |
| medium | Carousel | Exactly one full-width slide per view; no `groupSize`. | `src/components/layout/Carousel.tsx` | car-1 |
| medium | Carousel | No drag or swipe. | `Carousel.tsx` | car-2 |
| medium | Carousel | One fixed overlay control layout; no inline layouts and no standalone previous/next buttons. | `Carousel.tsx` | car-9 |
| medium | TabList | One underline style; no subtle or pill appearances. | `src/components/layout/TabList.tsx` | tab-1 |
| medium | TabList | Automatic activation only: moving focus with the arrow keys always selects the tab. | `TabList.tsx` | tab-3 |
| medium | Overflow | Always hides items from the end; no `overflowDirection="start"`. | `src/components/layout/Overflow.tsx` | ovf-1 |
| medium | Overflow.Item | No `priority` or `pinned`. | `Overflow.tsx` | ovf-5 |
| medium | Drawer | No bottom position. | `src/components/overlays/Drawer.tsx` | drw-1 |
| medium | Drawer | Fixed 320 px width; no size presets. | `Drawer.tsx` | drw-2 |
| medium | Drawer | Always modal; no non-modal or alert type. | `Drawer.tsx` | drw-6 |

<details><summary>Low-impact gaps</summary>

- **Card:**
  - No size (card-2).
  - No horizontal orientation (card-3).
  - No `disabled` (card-4).
  - Selection is controlled only, and `onSelect()` passes no data (card-5).
  - No Enter/Escape focus group for inner content (card-6).
  - The built-in checkbox cannot be replaced, and there is no floating action slot (card-7).
  - CardPreview is covered in section 3 (card-9).
- **Accordion** (`Accordion.tsx`):
  - Single mode is always collapsible; calling preventDefault in the trigger's onClick is a workaround (acc-1).
  - String values only, and the callbacks pass only the new state (acc-2).
  - No header size (acc-3).
  - The chevron is fixed at the end (acc-4).
  - No leading icon slot and no inline header (acc-5).
  - No collapse motion (acc-6).
- **Carousel:**
  - Fixed 300 ms slide and no fade option (car-3).
  - No appearance (car-4).
  - `onValueChange(index)` does not say what caused the change (car-5).
  - No arrow-key focus group across cards (car-6).
  - The picker is a button group with `aria-current`, where Fluent uses a tablist. Both are valid APG variants (car-7).
- **TabList:**
  - No size (tab-2).
  - No disabled state for the whole list (tab-4).
  - No sliding indicator (tab-5).
  - No Tab icon slot and no icon-only layout (tab-6).
- **Tree:**
  - No appearance or size (tree-3).
  - No collapse motion (tree-4).
  - `onExpandedItemsChange` passes only the list (tree-5).
  - No per-item controlled open state (tree-6).
  - No `iconAfter` and no custom expand icon (tree-7).
  - TreeItemPersonaLayout is covered in section 3 (tree-8).
- **Overflow:**
  - Horizontal only (ovf-2).
  - No `minimumVisible` or `hasHiddenItems` (ovf-3).
  - Renders its own wrapper elements and has no `onOverflowChange` (ovf-4).
  - Groups and OverflowDivider are covered in section 3 (ovf-6).
- **Drawer:**
  - Always unmounts on close (drw-3).
  - No motion (drw-4).
  - A per-drawer mount node is only possible through a nested WaveProvider (drw-5).
  - The header row is fixed, and Drawer.Title is always an h2 in the body (drw-8).
  - No separators that react to scrolling (drw-10).
  - DrawerHeaderNavigation is covered in section 3 (drw-9).
- **Recomposition:** component contexts and state hooks are internal (api-1).
</details>

### 4.7 Navigation
36 gaps: 3 high, 7 medium, 26 low.
- The three high gaps are submenus, checkbox items and radio items.
- MenuItemLink, MenuGroup, NavDrawer and Breadcrumb overflow (medium) are also in section 3.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Menu | No context menu at the pointer and no anchoring to a custom target; a controlled Menu without a trigger has no anchor. | `src/components/navigation/Menu.tsx` | menu-1 |
| medium | Menu.Popover | Long menus are not kept inside the viewport. `usePopupPosition` supports `fitViewport`, but Menu does not use it. | `Menu.tsx`, `src/hooks/usePopupPosition.ts` | menu-3 |
| medium | Nav.Category | A collapsed category does not show that it contains the current page. | `src/components/navigation/Nav.tsx` | nav-7 |

<details><summary>Low-impact gaps</summary>

- **Menu:**
  - No hover opening (menu-2).
  - No inline rendering and no per-menu mount node (menu-4).
  - `onOpenChange(open)` gives no reason, and there is no `closeOnScroll` (menu-5).
  - No icon-column alignment; `icon={<span />}` works as a workaround (menu-6).
  - No `subText` (menu-7).
  - `shortcut` accepts only a string (menu-8).
  - Disabled items are skipped by the keyboard, whereas Fluent keeps them focusable (menu-9).
  - The contexts are internal (menu-17).
  - MenuItemSwitch, MenuSplitGroup and MenuGrid are covered in section 3 (menu-13, menu-16, menu-18).
- **Nav:**
  - No density option (nav-1).
  - No single-open categories (nav-2).
  - Every item is a Tab stop. Fluent's arrow-key group exists only in NavDrawerBody (nav-3).
  - The callbacks pass no event and no parent category (nav-4).
  - The `<ul>` wrapper means any added header or divider needs its own `<li>` (nav-5).
  - Fixed chevron and no collapse motion (nav-8).
  - NavSectionHeader, NavDivider, AppItem, SplitNavItem and Hamburger are covered in section 3 (nav-9 to nav-13).
- **Breadcrumb:**
  - No size (bc-1).
  - No arrow-key focus mode (bc-2).
  - The separator cannot be changed. Fluent's styled divider also forces its chevron (bc-3).
  - The truncation helpers are covered in section 3 (bc-5).
</details>

### 4.8 Overlays
52 gaps: 0 high, 9 medium, 43 low.
- One claim was refuted and dropped: automatic `aria-describedby` on the dialog surface, which Fluent's current source does not set either.
- The positioning gaps are also covered in section 5.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Dialog | No alert mode. `role="alertdialog"` can be passed, but clicking the backdrop always dismisses. `useModalLayer` already forwards `outsidePress`; Dialog just does not expose it. The verifier lowered this from high. | `src/components/overlays/Dialog.tsx`, `src/hooks/useModalLayer.ts` | dialog-1 |
| medium | Dialog | No non-modal type. | `Dialog.tsx`, `useModalLayer.ts` | dialog-2 |
| medium | Dialog | `onOpenChange(open)` gives no reason (Escape, backdrop or trigger), so a form with unsaved changes cannot block only the backdrop close. | `Dialog.tsx` | dialog-3 |
| medium | Dialog.Footer | Rendered inside the scrolling body, so the actions scroll out of view when the content is long. | `Dialog.tsx` | dialogbody-1 |
| medium | Popover | No `openOnHover` or `mouseLeaveDelay`. | `src/components/overlays/Popover.tsx` | popover-1 |
| medium | Tooltip | No controlled `visible` or `onVisibleChange`. | `src/components/overlays/Tooltip.tsx` | tooltip-1 |
| medium | TeachingPopover | A single component driven by a `steps` array; no composable parts. | `src/components/overlays/TeachingPopover.tsx` | teaching-1 |
| medium | TeachingPopover | The footer is fixed to Back, Next and Done; no custom primary and secondary actions such as "Learn more" and "Got it". | `TeachingPopover.tsx` | teachingfooter-1 |
| medium | Positioning | `usePopupPosition`, `useDismiss`, `useFocusTrap` and `useModalLayer` are internal (see section 5). | `src/index.ts` | positioning-1 |

<details><summary>Low-impact gaps</summary>

- **Dialog:**
  - Always unmounts when closed (dialog-4).
  - No motion (dialog-5).
  - A per-dialog mount node is only possible through a nested WaveProvider (dialog-6).
  - The backdrop cannot be customised, and nested dialogs dim the page twice (dialogsurface-1).
  - The title is always an h2 (dialogtitle-1).
  - The Close button is always rendered (dialogtitle-2).
  - The footer has no start/end groups and no full-width option (dialogactions-1), and does not stack on narrow viewports (dialogactions-2).
  - No recomposition providers or hooks (recompose-1).
- **Popover:**
  - No context-menu opening (popover-2).
  - A custom target is only possible through a render-prop trigger inside the Popover (popover-3).
  - No `trapFocus` (popover-4).
  - No inline rendering and no `closeOnScroll` (popover-5).
  - `onOpenChange` passes no event (popover-6).
  - No appearance or size (popoversurface-1).
  - The arrow is always drawn, whereas Fluent's default is no arrow (popoversurface-2).
  - Focus stays on the trigger when the popover opens, which is a design choice (popoversurface-3).
  - The surface is always `role="dialog"` (popoversurface-4).
- **Tooltip:**
  - No `relationship="inaccessible"` (tooltip-2).
  - The hide delay is fixed at 100 ms (tooltip-3).
  - No arrow (tooltip-4).
  - The offset and target are fixed (tooltip-5).
  - The surface cannot be styled through props (tooltip-6).
  - The child is always wrapped in an inline-block span (tooltip-7).
  - Several behaviours are missing: only one tooltip visible at a time, hiding when the document is hidden or the anchor is clipped, and suppression on triggers whose popup is expanded (tooltip-8).
- **TeachingPopover:**
  - No brand or inverted appearance (teaching-2).
  - Few popover options (teaching-3).
  - Non-modal, whereas Fluent traps focus by default (teaching-4).
  - Finishing the tour and dismissing it look the same (teaching-5).
  - No trigger part (teachingtrigger-1).
  - No header icon or dismiss slot (teachingheader-1).
  - The title is a string rendered as h3 (teachingtitle-1).
  - No media slot (teachingbody-1).
  - The step dots are not interactive (teachingnav-1).
  - No visible page count (teachingpagecount-1).
  - The footer layout is fixed, and Back cannot act as "Not now" on the first step (teachingcarouselfooter-1).
- **Positioning:** no virtual targets, no per-component offset, no autoSize on Popover, no advanced placement options, no imperative ref, no hiding when the anchor is clipped, and no safe zone (positioning-2 to positioning-8; see section 5).
</details>

### 4.9 Table
32 gaps: 0 high, 9 medium, 23 low.
- TableResizeHandle and useTableFeatures (medium) are in section 3.
- Virtualization (medium) is covered in sections 3 and 5.

| Impact | Component | Gap | WaveUI file | Ref |
|---|---|---|---|---|
| medium | Table | No sortable header on the static Table. Sorting exists only in DataGrid, which brings grid semantics with it. | `src/components/table/Table.tsx` | thc-1 |
| medium | DataGrid | Sorting is controlled only: the consumer must reorder the rows, and columns have no `compare` function. | `src/components/table/DataGrid.tsx` | dg-2 |
| medium | DataGrid | Columns cannot be resized. | `DataGrid.tsx` | dg-3 |
| medium | DataGrid | Selection and select-all cover only rendered rows. Ids of rows that are not rendered are dropped on the next change, which breaks filtering and paging. | `DataGrid.tsx` | dg-6 |
| medium | DataGrid.Row | Clicking a row does not toggle its selection; only the checkbox or radio, or Space, does. | `DataGrid.tsx` | dgr-1 |
| medium | DataGrid columns | `DataGridColumn` is `{ id, label: string, sortable }`: no compare function, no cell renderer and no ReactNode header. | `DataGrid.tsx` | col-1 |

<details><summary>Low-impact gaps</summary>

- **Table:**
  - No density `size`; a descendant selector on the root works (table-1).
  - No div/flex rendering mode (table-2).
  - The header cell has no aside, sortIcon or button slots (thc-2).
  - The row has no appearance option (tr-1).
  - No subtle or invisible selection indicator (tsc-2).
  - TableSelectionCell, TableCellLayout (including truncate), TableCellActions and the table contexts are covered in section 3 (tsc-1, tcl-1, tcl-2, tca-1, ctx-1).
- **DataGrid:**
  - Rows are composed in JSX instead of generated by `items`/`columns` render functions (dg-1).
  - No `focusMode` (dg-4).
  - No subtle selection and no selection appearance options (dg-5).
  - The callbacks pass no event, and row ids are strings only (dg-7).
  - The sort icon is fixed (dghc-1).
  - The body takes no row render function (dgb-1).
  - The selection cell cannot be customised per row (dgr-2).
  - Individual cells cannot opt out of arrow navigation (dgc-1).
  - The selection cells are not exported (dgsc-1).
- **Headless:**
  - No sort or selection hooks outside DataGrid (hook-2, hook-3).
  - No column-sizing hook (hook-4).
  - `useGridNavigation` is not public for use with the static Table (nav-1).
</details>

## 5. Foundation and utilities comparison

47 gaps: 0 high, 14 medium, 33 low.

| Area | Fluent UI v9 | WaveUI 0.5.0 | Verdict |
|---|---|---|---|
| Provider | FluentProvider (react-provider 9.22.21): theme object, `dir`, `targetDocument`, `applyStylesToPortals`, `overrides_unstable`, `customStyleHooks_unstable` | WaveProvider: named theme (light, dark, high-contrast), `dir`, `portalContainer`; nested providers inherit omitted props | partial |
| Theming and tokens | react-theme 9.2.2 on `@fluentui/tokens` 1.0.0-alpha.24. Theme factories from a 16-shade BrandVariants ramp; 184 colour tokens; 35 palette families; spacing, radius, stroke and z-index tokens; stronger shadows in dark themes | `--wave-*` tokens in `src/styles/tokens.css`: 3 themes with 61 semantic colour tokens each, plus brand (10 to 160) and grey ramps. Rebrand by overriding `--wave-brand-*`. WCAG contrast asserted in `tokens.test.ts` | partial |
| Typography | 17 typography styles; font tokens including monospace, numeric and medium weight | 11-step ramp (`text-caption-2` to `text-display`) matching Fluent's sizes; `font-wave`; weights regular, semibold, bold | partial |
| Styling engine | Griffel atomic CSS-in-JS; opt-in raw modules with class prefixing since 9.67.0 | Tailwind CSS 4 + `cn()` (tailwind-merge); precompiled unlayered `dist/styles.css`, or a Tailwind entry point | different approach |
| Motion | react-motion 9.16.4 (stable): presence and motion factories, motion slots on Dialog, Drawer, Popover, Menu, Accordion and Tree, `motionTokens`. Motion components are preview (0.15.9) | CSS `animate-wave-*` for spinner, progress, skeleton, carousel, switch and chevrons, each with a required `motion-reduce` variant. No enter/exit animation | missing |
| Positioning | react-positioning 9.23.3: public `usePositioning`, virtual targets, autoSize, fallback positions, `positioningRef`, `useSafeZoneArea` | Internal `usePopupPosition` (floating-ui). Public props: `side`/`align`, `offset` on Menu.Popover, `target` on TeachingPopover | partial |
| Focus management | react-tabster 9.26.18: arrow groups including grid, focusable groups, modal attributes, focus restore, focus finders, focus-indicator helpers | Public `useRovingTabIndex` (linear, typeahead, RTL, nested composites). Focus trap, restore, isolation and tabbable helpers are internal | partial |
| Announcements | AriaLiveAnnouncer / useAnnounce with `batchId` and `priority`, `useTypingAnnounce`, `ariaNotify`. Does nothing unless the announcer provider is mounted | `announce()` / `useAnnounce`; no provider needed, works outside React | partial |
| Slots and customization | Every part is a slot; `*ClassNames` constants; `customStyleHooks_unstable`; `use*_unstable` / `render*_unstable` hooks | Slots only for icon, content and dismiss-like props; `className`, `data-*` state attributes, a few `*Props` escape hatches | partial |
| Utility hooks | react-utilities 9.26.7 (`useSelection`, `useTimeout`, `useAnimationFrame`, scrollbar helpers) | `useId`, `useIsClient`, `useMergedRefs`, `useEventCallback`, `composeEventHandlers`, public `useControllable` | partial |
| Portal | react-portal 9.8.16 + PortalMountNodeProvider (element or ShadowRoot) | `Portal` + `portalContainer`; named stacking layers, nesting depth, `disabled` renders inline | equivalent |
| Virtualization | Deprecated in core (react-virtualizer 9.0.0-alpha.116); stable home is `@fluentui-contrib/react-virtualizer` 1.0.0 (2026-03-03); contrib data grid 1.4.2 | None. DataGrid, List, Tree and Combobox assume every item is mounted | missing |
| Icons | `@fluentui/react-icons` 2.0.341 (separate package, about 174 MB unpacked); `bundleIcon`; icon direction context | 26 internal glyphs in `src/lib/icons.tsx`, not exported. Icon slots accept any node; the guide recommends `@fluentui/react-icons` | different approach |
| SSR / RSC | Needs RendererProvider + SSRProvider + FluentProvider, plus `renderToStyleElements` in the document head | Only the stylesheet import. `"use client"` banners on component modules, flat names for compound parts | equivalent |
| RTL | `dir` per provider; Griffel flips styles; icon direction context | Direction resolved per element; logical utilities; `wave-rtl:` variant; `getArrowIntent` for arrow keys | equivalent |
| High contrast | Forced-colours support; Fluent's docs call high-contrast themes legacy | High-contrast theme plus forced-colours recipes, with contrast pairs tested | equivalent |
| Charts | `@fluentui/react-charts` 9.3.27: separate D3 package with more than 20 chart types | None | missing |
| Headless components | react-headless-components-preview 0.3.1 (README: not production-ready) | None; restyling goes through className | missing (preview) |

**Medium foundation gaps:**
- **Theme object (foundation-1).** The theme is a closed name union. Token overrides in a subtree do not reach that subtree's portaled overlays, whereas Fluent merges a nested `PartialTheme` and applies it to portals. Files: `src/lib/theme.ts`, `src/components/provider/WaveProvider.tsx`, `src/components/portal/Portal.tsx`
- **Token breadth (foundation-6).** No categorical palette. Spacing, radius, stroke and z-index come from Tailwind defaults. File: `src/styles/tokens.css`
- **Style isolation (foundation-9).** Unprefixed utility names such as `bg-primary` clash with shadcn/ui and app Tailwind builds. The README describes a workaround and says namespaced utilities are being considered for 1.0. File: `README.md`
- **Enter/exit animation (foundation-13).** Dialog, Drawer, Popover, Menu, Accordion and Tree mount and unmount instantly. Files: `src/components/overlays/Dialog.tsx`, `src/components/layout/Accordion.tsx`
- **Presence and motion primitives (foundation-14).** No public API. File: `src/index.ts`
- **Custom or virtual anchors (foundation-18).** Menus cannot open at the pointer for context menus. Files: `Popover.tsx`, `Menu.tsx`
- **Positioning and dismiss hooks (foundation-20).** Both are internal. Files: `src/hooks/usePopupPosition.ts`, `src/hooks/useDismiss.ts`
- **2-D grid navigation (foundation-23).** `useRovingTabIndex` has none. File: `src/hooks/useRovingTabIndex.ts`
- **Focusable groups (foundation-24).** No reusable hook where Enter goes into a group and Escape leaves it. This exists only inside List and DataGrid.
- **Focus trap, modal isolation and focus restore (foundation-25).** All internal, so custom modal surfaces cannot join WaveUI's modal layer. Files: `src/hooks/useFocusTrap.ts`, `useModalIsolation.ts`, `useRestoreFocus.ts`
- **Structural slots (foundation-34).** Inner parts are not slots. File: `src/lib/slot.ts`
- **Stable class names (foundation-37).** Components have no identifying class, and only 19 `data-wave-*` part markers exist. File: `src/components/button/Button.tsx`
- **Virtualization (foundation-45).** None.
- **Charts (foundation-46).** None.

<details><summary>Low-impact foundation gaps</summary>

- **Provider:**
  - No `targetDocument` for iframes or child windows (foundation-2).
  - No switch to stop portals inheriting provider styles (foundation-3).
  - No provider-level component defaults. These would have nothing to set anyway, because WaveUI inputs have no appearance prop (foundation-4).
- **Theming:**
  - No theme factory from a brand ramp (foundation-5).
  - Shadows are the same in every theme (foundation-7).
  - No typed JS token object (foundation-8).
- **Styling:** the precompiled stylesheet contains only the utilities WaveUI itself uses (foundation-10).
- **Typography:**
  - No monospace or numeric font (foundation-11).
  - No medium weight (foundation-12).
- **Motion:**
  - No motion slots (foundation-15).
  - No motion tokens, and the easing reference values in `docs/WAVE-UI-GUIDE.md` do not match Fluent's `motionTokens` (foundation-16).
  - No motion components, which are preview in Fluent (foundation-17).
- **Positioning:**
  - Advanced placement options are not exposed (foundation-19).
  - No imperative positioning ref (foundation-21).
  - No safe zone, since WaveUI has no submenus (foundation-22).
- **Focus:**
  - The focus finders are internal (foundation-26).
  - The focus-ring recipes are not exported (foundation-27).
  - No keyboard-navigation mode or focus-visible hooks (foundation-28).
  - No observed elements (foundation-29).
- **ARIA:**
  - No announcement ids or priority (foundation-30).
  - No typing-aware announcements (foundation-31).
  - No `ariaNotify` (foundation-32).
  - Active-descendant and ARIA-button hooks are internal (foundation-33).
- **Slots and customization:**
  - No render-function slot children (foundation-35).
  - No native-prop partition helpers (foundation-36).
  - No app-wide style hooks (foundation-38).
  - No recomposition hooks (foundation-39).
- **Utility hooks:**
  - No generic `useSelection` (foundation-40).
  - No timer, animation-frame or scrollbar helpers (foundation-41).
- **RTL:** icons passed in by the consumer are not mirrored automatically (foundation-42).
- **Portal:** no ShadowRoot mount node, and dismiss listeners attach to the global document (foundation-43).
- **Icons:** WaveUI's built-in glyphs are not exported (foundation-44).
- **Headless components:** preview in Fluent (foundation-47).
</details>

## 6. What WaveUI has that Fluent does not

**Components and APIs Fluent v9 does not ship**
- **Pagination.** Ellipsis ranges, First/Last buttons, clamping, localisable labels and boundary buttons that stay focusable. Fluent has only community discussions (#32967, #31198). File: `src/components/navigation/Pagination.tsx`
- **Stepper.** Linear mode, completed and error states, vertical layout and localisable status text. Fluent has only open requests (#14299, #31558). File: `src/components/navigation/Stepper.tsx`
- **Stack, Flex and Grid.** Layout primitives with token gaps and a polymorphic `as`. Fluent v9 has only the StackShim, FlexShim and GridShim migration shims.
- **TabList.Panel and TabList.Panels.** Panels wired to their tabs in both directions, with a consistent default on the server and support for code-split panels. Fluent's TabList has no panels.
- **Drawer.Trigger and Drawer.Close.** Allow uncontrolled use. Fluent's OverlayDrawer is controlled only, and its `defaultOpen` is deprecated.
- **Public hooks.** `useIsOverflowing` for detecting truncated text, and `useControllable`. Fluent's `useControllableState` is not re-exported.
- **Control-level `error`.** Input, Select and Textarea accept an `error` prop plus `errorMessageProps`. In Fluent, errors go through Field only.
- **First-class date and time pickers.** DatePicker and TimePicker are in the main package; Fluent ships them only as compat packages.

**Forms**
- **Native form participation everywhere.** Pickers and custom controls render a hidden input with `name`, `form` and `required`, and reset with their form. In Fluent 9.x, Dropdown, TagPicker, SwatchPicker and ColorPicker render no hidden input, and Combobox would submit the displayed text rather than the value.
- **Required Field.** A required Field makes custom controls (Checkbox, Switch, RadioGroup, Rating, the pickers) block form submission natively.
- **Filtering.** Combobox and TagPicker filter as the user types and announce "No matches". In Fluent this is opt-in.
- **SearchBox clear button.** A real tab stop named "Clear search"; Fluent's is a `span` with `tabIndex=-1`.
- **SpinButton defaults.** Follows APG more closely, for example `largeStep` moves ten steps.
- **Rating.**
  - 24 px targets at every size.
  - Arrow keys mirrored in RTL.
  - `disabled`, `required` and form support.
  - RatingDisplay fills fractional values to the percent.

**Accessibility defaults**
- **Announcements.**
  - MessageBar and Toast speak a localisable severity label.
  - Live regions need no provider. Fluent's `useAnnounce` does nothing unless an AriaLiveAnnouncer is mounted.
- **Toaster.**
  - Timers pause on hover, focus, window blur and a hidden tab by default. In Fluent, pausing on hover and on window blur is opt-in.
  - Toasts stay reachable over modals and move out of the way of a Drawer.
- **Accordion.** Triggers sit in real headings, panels are labelled regions, and triggers set `aria-controls` by default.
- **Tag.** Each dismiss button is named after its tag (for example "Dismiss Cherry").
- **Persona.** The name is announced once.
- **Avatar.** Detects image failures that happened before hydration.
- **Nav.** Renders a real `<nav>` landmark with list semantics and supports disabled items.
- **Carousel.** Full APG rotation control, which starts paused under reduced motion.
- **Development warnings** for unnamed controls, duplicate values and components used in the wrong place.

**Overlays**
- **Dismiss-layer stack.** Escape is routed by where focus is, and clicks in nested portals count as inside their parent.
- **Portal stacking.** Named layers (overlay, toast, tooltip) plus nesting depth.
- **Tooltip.** Its text is in the server HTML before hydration; Fluent renders no tooltip during SSR.
- **Popover.** Keeps the trigger's inline Tab order and is named automatically from its title or trigger.
- **Dialog.**
  - Offers `finalFocusRef` and a documented chain for returning focus.
  - Makes the rest of the page inert instead of using `aria-modal`, so toasts are still announced.

**Buttons, data and layout**
- **Buttons.**
  - Five sizes on every button.
  - Fully typed polymorphic `as` on Button, CompoundButton, Link, Toolbar, Text and Divider.
  - ToggleButton has `onPressedChange`.
  - SplitButton routes its props to the right half.
- **Toolbar.** Works as a generic APG toolbar over any focusable descendant.
- **DataGrid.**
  - Uses a native `<table role="grid">` with grouped-header support (colSpan and rowSpan).
  - Detects each cell's focus target automatically.
  - Sets `aria-multiselectable` and names each selection control after its row.
- **Table.** Has `striped` and a scroll region that becomes focusable when it overflows.
- **Tree.** Supports the APG `*` key and `current`.
- **Card.** Offers two selection patterns and ignores events from nested controls and portals.
- **Overflow.** Handles reordering without extra setup.

**Foundation**
- **Styling and SSR.** No runtime styles: no CSP nonce setup and no SSR style extraction. Fluent needs an extra SSR setup step.
- **RTL.** Direction is resolved per element, so LTR islands inside RTL pages are handled.
- **Contrast testing.** WCAG contrast is asserted for every token pair in all three themes.
- **Event handler composition.** `composeEventHandlers` lets the consumer cancel the internal handler; Fluent's `mergeCallbacks` always calls both.
- **Dependencies.** Few runtime dependencies: `@floating-ui/react-dom`, `clsx` and `tailwind-merge`.

## 7. Recommendations: prioritized roadmap

Size scale:
- **S:** a contained change to one or two components.
- **M:** a new sub-component, or a feature spanning several components.
- **L:** a new subsystem that touches many components.

No time estimates are implied. New work should follow the repository conventions (C-LOGICAL, C-MOTION, C-FORMS and so on). For example, Fluent's TableCellActions uses a physical `right: 0`, which a WaveUI version would replace with `end-0`.

### Quick wins

| # | Item | Addresses | Size |
|---|---|---|---|
| 1 | Dialog: expose alert mode (`useModalLayer` already forwards `outsidePress`), pass a reason to `onOpenChange`, and move `Dialog.Footer` out of the scrolling body | dialog-1, dialog-3, dialogbody-1 | S |
| 2 | Menu.Popover: enable `fitViewport` so long menus stay inside the viewport | menu-3 | S |
| 3 | Buttons: add `iconPosition`, a typed `icon` on CompoundButton, and `icon`/`menuIcon` on SplitButton | buttons-2, buttons-6, buttons-13 | S |
| 4 | Add `disabledFocusable` to Button, Link and Switch using the existing `focusableDisabledProps`, and keep such items reachable in Toolbar | buttons-3, buttons-17, buttons-21, form-basic-24 | S |
| 5 | Link: render `<button type="button">` when there is no `href` and no `as` | buttons-15 | S |
| 6 | Badge: add `severe` and `subtle` and remap `important` to neutral (a breaking change that needs a CHANGELOG entry); CounterBadge: add `dot`, `color` and `showZero` | badge-1, badge-2, counterbadge-1 to counterbadge-3 | S |
| 7 | Field: keep the hint visible with the error, add `orientation="horizontal"`, add `validationState` warning/success with icons | form-basic-1 to form-basic-3, form-basic-5 | S |
| 8 | Combobox and Dropdown: add `clearable` (as DatePicker and TimePicker already do), and add a chevron to Combobox | combobox-2, combobox-4, dropdown-2 | S |
| 9 | TimePicker: add `onInvalidInput`, `aria-invalid` and an error message, matching DatePicker | timepicker-1 | S |
| 10 | Spinner: add `appearance="inverted"` and `delay`. ProgressBar: add `color` and read the Field context | spinner-1, spinner-2, progress-1, progress-2 | S |
| 11 | Slider progress fill; Switch and Checkbox `labelPosition`; ReactNode labels on Checkbox, Radio and Switch | form-basic-16, form-basic-17, form-basic-19, form-basic-22, form-basic-25, form-basic-29 | S |
| 12 | Tooltip: controlled `visible` and `onVisibleChange` | tooltip-1 | S |
| 13 | TabList: manual activation mode | tab-3 | S |
| 14 | RatingDisplay: `count`, visible value text and `compact` | form-basic-43 to form-basic-45 | S |
| 15 | Toaster: `limit` with a queue, plus `dismissAll` | toaster-1, toastctl-1 | S |
| 16 | Nav: mark a collapsed category that contains the current page | nav-7 | S |
| 17 | Tag: move focus in the stories and docs after a keyboard dismiss, until TagGroup exists | taggroup-1 | S |

### High-value additions

| # | Item | Addresses | Size |
|---|---|---|---|
| 1 | Menu checkbox and radio items with a `checkedValues` model, plus MenuGroup/MenuGroupHeader and MenuItemLink | menu-11, menu-12, menu-14, menu-15 | M |
| 2 | Menu submenus: ArrowRight/ArrowLeft (RTL-aware), nested dismiss layers, then hover opening | menu-10, menu-2 | M |
| 3 | Toast rich content: `dispatchToast` takes ReactNode content, Toast.Title/Body/Footer parts, ToastTrigger, keyboard access to the Toaster | toast-1, toast-2, toasttrigger-1, toaster-2 | M |
| 4 | `size` and `appearance` for all text inputs and pickers through the shared input style recipe | form-basic-10, form-basic-11, form-basic-14, form-basic-26, form-basic-36, form-basic-38, combobox-3, dropdown-3, tagpicker-7, datepicker-8, timepicker-7 | M |
| 5 | ColorArea and a hue ColorSlider inside ColorPicker | colorarea-1, colorslider-1 | M |
| 6 | Tree multi-select with checkboxes and a mixed state | tree-1 | M |
| 7 | Dropdown and Combobox multi-select (`useListbox` already supports `multiple`) | dropdown-1, combobox-1 | M |
| 8 | TagGroup and InteractionTag; Tag `appearance`, `size` and `disabled` | taggroup-1 to taggroup-3, interactiontag-1, tag-1 to tag-3 | M |
| 9 | Drawer: `size`, `position="bottom"`, Drawer.Footer and a non-modal type; then an inline type and NavDrawer | drw-1, drw-2, drw-6, drw-7, drw-11, nav-6 | M |
| 10 | Popover `openOnHover` and custom or virtual targets; Menu context menus | popover-1, popover-3, menu-1, foundation-18 | M |
| 11 | Make the overlay primitives public: positioning, dismiss, modal layer/focus trap, focusable group, grid roving | positioning-1, foundation-20, foundation-23 to foundation-25 | M |
| 12 | Carousel: `groupSize`, drag and swipe, thumbnail nav, inline control layout | car-1, car-2, car-8, car-9 | M |
| 13 | Avatar: shape, colour (including colorful hashing), a wider size range and better initials | avatar-1 to avatar-4 | M |
| 14 | Overflow `priority`, `pinned` and start direction; then Breadcrumb overflow | ovf-1, ovf-5, bc-4 | M |
| 15 | DataGrid: column `compare` with built-in sorting, ReactNode column labels, toggle selection on row click | dg-2, col-1, dgr-1 | M |
| 16 | SpinButton: `displayValue`, null value, press-and-hold | form-basic-32 to form-basic-34 | M |
| 17 | List: navigation mode without selection, `onAction`, `disabledSelection` | list-1 to list-3 | M |
| 18 | InfoLabel: rich info content, Label features, use as a Field label | infolabel-1 to infolabel-3, form-basic-6 | M |
| 19 | TeachingPopover: custom footer actions, then composable parts | teachingfooter-1, teaching-1 | M |
| 20 | Standalone Calendar exported from the DatePicker grid; DatePicker month/year picker | calendar-1, datepicker-1 | M |
| 21 | TagPicker: rich tags and options, free tagging, custom filter and a controllable query | tagpicker-2, tagpicker-3, tagpicker-6, filter-1, filter-2 | M |
| 22 | Public listbox primitives for custom pickers | listbox-2 | M |

### Larger projects

| # | Item | Addresses | Size |
|---|---|---|---|
| 1 | Motion system: a presence primitive and motion tokens, then enter/exit on Dialog, Drawer, Popover, Menu, Accordion and Tree, keeping `motion-reduce` variants | foundation-13 to foundation-16, dialog-5, drw-4, acc-6, tree-4 | L |
| 2 | Tables at data scale: a headless table state layer, selection scoped to the data rather than rendered rows, resizable columns with keyboard support, and virtualization for DataGrid, List, Tree and Combobox | hook-1, dg-3, dg-6, trh-1, virt-1, tree-9, foundation-45 | L |
| 3 | Theming API: theme overrides that reach portals, a brand-ramp generator, broader token families, and shadows that differ per theme | foundation-1, foundation-5 to foundation-7 | L |
| 4 | Customization surface: stable component and part class names, slots for structural parts, and namespaced utilities to avoid collisions | foundation-9, foundation-34, foundation-37 | L |
| 5 | Charts: better to document how to pair an existing chart library with the `--wave-*` tokens than to build charts. Fluent also ships charts as a separate package | foundation-46 | L (if built) |

### Candidates to defer
These are preview-only or low in value: the MenuGrid equivalent, headless components, the full set of Fluent motion components beyond the presence core, and the ShadowRoot and `targetDocument` support.