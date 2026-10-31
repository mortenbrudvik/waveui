# Upgrading to 1.0

> **Draft.** 0.18 announces everything that 1.0 changes, and this guide lists it. Phase 14 of the [roadmap](ROADMAP.md) makes the changes and completes the guide; until 1.0 is released, nothing below changes.

1.0 is the API freeze of `@mortenbrudvik/waveui`: it removes what 0.x deprecated, changes a few defaults and meanings, makes the optional `details` arguments required and records the choices 0.x deferred. Semantic versioning applies from then on. Every item was announced in a 0.x release, named in the "Announced in" column, and the [CHANGELOG](../CHANGELOG.md) restates them all under 0.18.0, "Deprecated".

Each replacement in the tables already works in 0.x, next to the old form. You can move to it at your own pace, and an app that uses no old form upgrades to 1.0 without code changes.

## Before you upgrade

1. Upgrade to 0.18 first, the last 0.x minor: it adds the last development warnings.
2. Run your app and your tests as a development build and replace every use that warns ([Finding the uses](#finding-the-uses)). Each warning names its replacement.
3. Look for the uses that no warning reports: the rows whose "Warns" column says "no".
4. Upgrade to 1.0 and run your type check: the old props are gone from the types, and the `details` arguments are required.

## Finding the uses

**Development warnings.** Each row marked "Warns: yes" logs a warning once in a development build (any build whose `process.env.NODE_ENV` is not `'production'`), with the `[WaveUI]` prefix. A renamed prop, value or call form reads ``[WaveUI] Checkbox: `onChange` is deprecated and will be removed in 1.0. Use `onCheckedChange` instead.``; the others say what changes and what to pass instead (``[WaveUI] Badge: color="important" changes meaning in 1.0 (neutral, high emphasis); pass color="severe" to keep the orange look.``). Search a development console or a test run's output for `[WaveUI]` lines that mention 1.0, and for ``Image: `alt` is missing``, the one that does not. A production build logs none of them.

The warnings added in 0.18 (Badge and CounterBadge `important`, the positional `useRovingTabIndex` and `onSortChange`, and a `className` with presence variants) read `process.env.NODE_ENV` written out, so a production bundle drops them with their text. Imported without a bundler, where `process` does not exist (an unbundled ESM import in a browser), they are skipped, while the older warnings still log; run a bundled development build to see them all.

**Editors.** A deprecated prop carries `@deprecated` in its JSDoc, so editors strike it through. A deprecated value does not (a numeric `size`, `selectionMode="multi"`, `status="dnd"`, a numeric Text `weight`, `color="important"`): it warns, or search for it.

**What no code can detect.** Search your code for the rows marked "Warns: no":

- CSS: imports of `legacy-tokens.css` or `animations.css`, the selectors `.dark` and `.high-contrast` (and a class-based `dark:` variant keyed on `.dark`), and the classes `wave-tag-picker__control` and `wave-tag-picker__group`.
- Behaviour: a TeachingPopover whose `onDismiss` must also run when Done is pressed, and a TimePicker without `format` whose users need 12-hour times.
- Types: code that calls a callback prop listed under [Arguments and props that become required](#arguments-and-props-that-become-required) itself (a wrapper that forwards it, a test that invokes it). WaveUI always passes `details`; code that calls the prop passes it too in 1.0.

## Removed in 1.0

Each item is removed without an alias. Its replacement works in 0.x, so you can switch before upgrading; given both, the new prop wins and both callbacks are called.

| Before | After | Announced in | Warns |
|---|---|---|---|
| Checkbox `onChange(checked)` | `onCheckedChange(checked)` | 0.5 | yes |
| Switch `onChange(checked)` | `onCheckedChange(checked)` | 0.5 | yes |
| RadioGroup `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| Rating `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SearchBox `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SpinButton `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| ColorPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| SwatchPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| TagPicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| TimePicker `onChange(value)` | `onValueChange(value)` | 0.5 | yes |
| DatePicker `onChange(date)` | `onValueChange(date)` | 0.5 | yes |
| Combobox `onOptionSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| Dropdown `onOptionSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| TabList `selectedValue` | `value` | 0.5 | yes |
| TabList `defaultSelectedValue` | `defaultValue` | 0.5 | yes |
| TabList `vertical` | `orientation="vertical"` | 0.5 | yes |
| TabList `onTabSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| Nav `selectedValue` | `value` | 0.5 | yes |
| Nav `defaultSelectedValue` | `defaultValue` | 0.5 | yes |
| Nav `onNavItemSelect(value)` | `onValueChange(value)` (called on change only) | 0.5 | yes |
| `Nav.Category` without `label` (its text children are the label) | `label`, with only the sub-items as children | 0.5 | yes |
| TeachingPopover `currentStep` | `activeStep` | 0.5 | yes |
| TeachingPopover `defaultCurrentStep` | `defaultActiveStep` | 0.5 | yes |
| List `selectionMode="multi"` | `selectionMode="multiple"` | 0.5 | yes |
| DataGrid `selectedKeys` (a `Set`) | `selectedItems` (an array) | 0.5 | yes |
| DataGrid `defaultSelectedKeys` (a `Set`) | `defaultSelectedItems` (an array) | 0.5 | yes |
| DataGrid `onSelectionChange(Set)` | `onSelectedItemsChange(selectedItems)` (an array) | 0.5 | yes |
| DataGrid `sortColumn` | `sort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `sortDirection` | `sort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `defaultSortColumn` | `defaultSort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| DataGrid `defaultSortDirection` | `defaultSort` (`{ columnId, direction }` or `null`) | 0.5 | yes |
| `Table.Head` (flat `TableHead`, type `TableHeadProps`) | `Table.Header` (flat `TableHeader`, type `TableHeaderProps`) | 0.5 | yes |
| `Table.HeadCell` (flat `TableHeadCell`, type `TableHeadCellProps`) | `Table.HeaderCell` (flat `TableHeaderCell`, type `TableHeaderCellProps`) | 0.5 | yes |
| Stack `direction` | `orientation` (same values) | 0.5 | yes |
| Skeleton `variant` | `shape` (`circular` stays; `text` and `rectangular` take the default shape) | 0.5 | yes |
| Text numeric `weight` (`400`, `600`, `700`) | `weight="regular"`, `"semibold"`, `"bold"` | 0.5 | yes |
| Link `variant` (type `LinkVariant`) | `appearance` (type `LinkAppearance`), same values | 0.5 | yes |
| Tooltip `variant="dark"` and `variant="light"` | `appearance="inverted"` and `appearance="normal"` | 0.5 | yes |
| Accordion `openItems` in single mode | `openItem` (`string` or `null`) | 0.5 | yes |
| Accordion `defaultOpenItems` in single mode | `defaultOpenItem` (`string` or `null`) | 0.5 | yes |
| Accordion `onOpenItemsChange` in single mode | `onOpenItemChange(value)` | 0.5 | yes |
| MessageBar `dismiss` with button props (`{ as: "button", onClick, … }`) | icon content in `dismiss`, and `onDismiss` | 0.5 | yes |
| SearchBox `dismiss` with button props (`{ as: "button", onClick, … }`) | icon content in `dismiss`, and `onClear` | 0.5 | yes |
| Tag `dismissIcon` with button props (`{ onClick, type, disabled, … }`) | icon content in `dismissIcon`, and `onDismiss` | 0.5 | yes |
| `@mortenbrudvik/waveui/legacy-tokens.css` (the 0.4 variable names) | the `--wave-*` variables | 0.5 | no |
| The theme classes `dark` and `high-contrast` in your CSS | `wave-dark` and `wave-high-contrast` | 0.5 | no |
| `src/styles/animations.css` (empty since 0.5) | nothing: drop the import | 0.18 | no |
| Tooltip `delay` | `openDelay` | 0.7 | yes |
| Input numeric `size` (or a string of digits) | `htmlSize` | 0.9 | yes |
| Select numeric `size` (or a string of digits) | `htmlSize` | 0.9 | yes |
| Slider numeric `size` | nothing: it has no effect, remove it | 0.9 | yes |
| InfoLabel `label` | `children` | 0.9 | yes |
| The classes `wave-tag-picker__control` and `wave-tag-picker__group` | `wave-tag-picker-control` and `wave-tag-picker-group` | 0.11 | no |
| PresenceBadge `status` `'dnd'` and `'oof'` | `'do-not-disturb'` and `'out-of-office'` | 0.13 | yes |
| `DataGridColumn.id` | `columnId` | 0.14 | yes |
| `useRovingTabIndex(containerRef, options)` | `useRovingTabIndex(options)` and its `containerProps` | 0.18 | yes |
| DataGrid `onSortChange(columnId, direction)` (no `items`, `sort` or `defaultSort`) | `onSortChange(sort, details)`, with `items`, `sort` or `defaultSort` | 0.18 | yes |
| `Menu.Popover` `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| `Dialog.Content` `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| Drawer `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |
| NavDrawer `className` with presence variants, without `motion` | the classes in `motion` | 0.18 | yes |

Notes on some rows:

- **Value callbacks.** `onValueChange`, `onCheckedChange` and `onOpenItemChange` fire only when the value changes. `onOptionSelect`, `onTabSelect` and `onNavItemSelect` fire on every activation, also of the item already selected, and their replacements do not.
- **The theme classes.** `WaveProvider` stops adding `dark` and `high-contrast`, and Wave's styles stop selecting them. A Tailwind `dark:` variant of your own that keys on the class (`@custom-variant dark (&:where(.dark, .dark *));`) keys on `.wave-dark` instead.
- **The dismiss and clear slots.** Only the button-object form goes. A `<button>` or `Button` element passed to MessageBar `dismiss`, SearchBox `dismiss` or Tag `dismissIcon` stays: its props are merged into the built-in button, which keeps its label and wiring.
- **A `className` with presence variants.** Through 0.x, a `className` on `Menu.Popover`, `Dialog.Content`, Drawer or NavDrawer that holds presence variants (classes keyed on `data-[presence=…]`, the motion of 0.14) turns the part's default motion off. In 1.0 the `className` is a plain class list, so the default motion and your classes would both apply: pass your motion classes as `motion="…"`, which replaces the default.

## Defaults and meanings that change

Nothing is removed here, but the same code looks or behaves differently in 1.0.

| Before | After | Announced in | Warns |
|---|---|---|---|
| Badge `color="important"` (orange) | `color="severe"` for the orange look | 0.6 | yes |
| CounterBadge `color="important"` (orange) | `color="severe"` for the orange look | 0.6 | yes |
| TeachingPopover's Done calls `onFinish`, then `onDismiss` | Done calls `onFinish` only: handle Done there | 0.14 | no |
| TimePicker without `format` (12-hour times) | the locale's hour cycle; `format="12h"` keeps 12-hour times | 0.18 | no |

- **Badge and CounterBadge `important`** render the severe orange through 0.x, as in 0.5, and Fluent's neutral high-emphasis color (near black in the light theme) in 1.0. Use `severe` for the orange look. An app that wants the 1.0 color keeps `important`: it stays orange, and warns, until 1.0.
- **TimePicker `format`** stays `'12h'` or `'24h'` when you give it. Without it, 1.0 shows the times in the locale's hour cycle (12-hour in `en-US`, 24-hour in many other locales). TimePicker has no `hourCycle` prop.

## Arguments and props that become required

WaveUI always passes `details`, so a handler you give receives it today; only code that calls one of these props itself must pass it in 1.0. Read it as `details?.reason` (or the field you need) until then, and drop the `?` after upgrading.

| Before | After | Announced in | Warns |
|---|---|---|---|
| Dialog `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.6 | no |
| Drawer `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.6 | no |
| Menu and Toolbar `onCheckedValuesChange(checkedValues, details?)` | `onCheckedValuesChange(checkedValues, details)` | 0.7 | no |
| Tree `onCheckedItemsChange(checkedItems, details?)` | `onCheckedItemsChange(checkedItems, details)` | 0.8 | no |
| Calendar `onValueChange(date, details?)` | `onValueChange(date, details)` | 0.10 | no |
| `useListbox` `onOpenChange(open, details?)` and `onSelect(value, details?)` | `onOpenChange(open, details)` and `onSelect(value, details)` | 0.10 | no |
| NavDrawer `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.11 | no |
| Overflow `onOverflowChange(hiddenItems, details?)` | `onOverflowChange(hiddenItems, details)` | 0.14 | no |
| DataGrid `onSortChange(sort, details?)` | `onSortChange(sort, details)` | 0.14 | no |
| DataGrid `onSelectedItemsChange(selectedItems, details?)` | `onSelectedItemsChange(selectedItems, details)` | 0.14 | no |
| `Table.SelectionCell` `onCheckedChange(checked, details?)` | `onCheckedChange(checked, details)` | 0.14 | no |
| AvatarGroup `onOpenChange(open, details?)` | `onOpenChange(open, details)` | 0.18 | no |
| DataGrid and `useTableColumnSizing` `onColumnWidthsChange(widths, details?)` | `onColumnWidthsChange(widths, details)` | 0.18 | no |
| `Table.ResizeHandle` `onResize(width, details?)` | `onResize(width, details)` | 0.18 | no |
| `useTableSort` `onSortChange(sort, details?)` | `onSortChange(sort, details)` | 0.18 | no |
| `useSelection` `onSelectedItemsChange(selectedItems, details?)` | `onSelectedItemsChange(selectedItems, details)` | 0.18 | no |
| `useFlatTree` (FlatTree) `onCheckedItemsChange(checkedItems, details?)` | `onCheckedItemsChange(checkedItems, details)` | 0.18 | no |
| Image without `alt` (`ImageProps.alt` optional) | `alt` required (`alt=""` for a decorative image); `StrictImageProps` an alias | 0.18 | yes |

`StrictImageProps`, the `ImageProps` with a required `alt`, gives you the 1.0 check at compile time now.

## Decided: no change

0.x deferred these choices; they are decided, and 1.0 changes nothing for them.

| Before | After | Announced in | Warns |
|---|---|---|---|
| `ref` on the root, `controlRef` on the focusable element, `slotProps.<part>.ref` on parts | no change: 1.0 moves no `ref` | 0.18 | no |

**Ref placement.** `ref` stays on a component's root element, the one that receives `className`, also on composite controls whose focusable element sits inside a wrapper (Checkbox, Switch, SearchBox, SpinButton and the pickers). `controlRef` reaches that focusable element, and every part reaches its own element through `slotProps.<part>.ref`. Fluent puts `ref` on the primary element instead; code ported from Fluent passes `controlRef` where it passed `ref` to such a control.

## Where the list comes from

The tables are the inventory `src/lib/deprecations.ts`, and `src/__tests__/deprecations.test.tsx` keeps it in step with the code, the CHANGELOG and this guide: each alias that warns through `warnDeprecated` has a row, each row's warning fires, each row is announced in the CHANGELOG section of its version, and each row is a line of a table above. Phase 14 updates the inventory, the guide and the test as it makes the changes.
