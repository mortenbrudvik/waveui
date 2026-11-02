/**
 * The 1.0 inventory (Phase 13, R18 to R22): one row per change that 1.0 makes to the public API.
 * `src/__tests__/deprecations.test.tsx` keeps it in step with the code, the CHANGELOG and
 * `docs/UPGRADING-TO-1.0.md`, so an alias, a warning or an announcement cannot be added or dropped
 * on one side only. The data serves that test: the package entry does not export it, and the
 * module imports nothing, so it stays server-safe.
 */

/**
 * What 1.0 does to a row: `'removed'` (a prop, value, export, call form, class, file or rule goes
 * away), `'default-changes'` (a default, a meaning or a behaviour changes, nothing is removed),
 * `'required'` (an optional argument or prop becomes required) or `'decided'` (a choice that 0.x
 * deferred, recorded with no change).
 */
export type DeprecationKind = 'removed' | 'default-changes' | 'required' | 'decided';

interface DeprecationFields {
  /** Stable id, kebab-case, unique in the inventory. */
  readonly id: string;
  /**
   * The bold title of the 0.18.0 CHANGELOG "Deprecated" line that restates the row with the rest
   * of its group; that line names `sinceVersion`.
   */
  readonly group: string;
  /** What an app writes today: the "Before" column of `docs/UPGRADING-TO-1.0.md`. */
  readonly item: string;
  /** What to write instead: the "After" column of `docs/UPGRADING-TO-1.0.md`. */
  readonly replacement: string;
  /** The release whose CHANGELOG section announced the change first, as `'0.<minor>'`. */
  readonly sinceVersion: string;
  /** What 1.0 does. */
  readonly kind: DeprecationKind;
  /** Text of the CHANGELOG section of `sinceVersion` that announces the row. */
  readonly changelogAnchor: string;
  /**
   * The repository file (a path from its root) that holds the item: for a row that warns, the
   * module that calls the warning (or names its component for a shared warning helper).
   */
  readonly file: string;
  /**
   * Set (`true`) by the task that makes the row's change in the code (Phase 14, R2): the old form
   * is gone, not only announced. While no row is flagged the inventory describes 0.18; each flag
   * moves the row from "must still warn" to "must be absent", and the test checks the one or the
   * other. A done row has no call of `warnDeprecated` or `resolveDeprecatedProp` left, no warning
   * case, no development warning that announces it (a `warnOnce` of the row's key), and its
   * `absent` lists what else must be gone. The rows and the flag retire together with this file
   * (the last removal task of Phase 14).
   */
  readonly done?: true;
  /**
   * What a done row's removal deletes besides code inside a module; every entry is checked absent.
   * Left out for a row that only removes a prop, a value or a call form (the type error that
   * proves it is a `@ts-expect-error` case in the component's own tests).
   */
  readonly absent?: DeprecationAbsence;
}

/** What the removal of a {@link Deprecation done} row leaves nowhere in the package. */
export interface DeprecationAbsence {
  /** The row's `file` itself is deleted (a stylesheet, a module): it must not exist. */
  readonly file?: true;
  /** Names the package entry (`src/index.ts`) must not export any more (values; types are not checked). */
  readonly exports?: readonly string[];
  /** Classes (`wave-…`) that no value of the stable class-name registry may hold any more. */
  readonly classNames?: readonly string[];
  /** Text (a selector, a custom property) that no stylesheet of `src/styles` may hold any more. */
  readonly css?: readonly string[];
}

/**
 * A row of the inventory. A row that warns names the warn-once key of its development warning:
 * `deprecated:<component>:<old name>` when it warns through `warnDeprecated` or
 * `resolveDeprecatedProp` (the key `warnDeprecated` builds), else the key of its own `warnOnce`.
 */
export type Deprecation = DeprecationFields &
  (
    | { readonly warns: true; readonly warningKey: string }
    | { readonly warns: false; readonly warningKey?: undefined }
  );

// The groups: the bold titles of the 0.18.0 "Deprecated" lines.
const RENAMED_IN_0_5 = 'The 0.4 names renamed in 0.5';
const BUTTON_OBJECT_SLOTS = 'The button-object form of the dismiss and clear slots';
const IMPORTANT_COLOR = 'Badge and CounterBadge `color="important"`';
const NUMERIC_SIZE = 'A numeric `size` on Input, Select and Slider';
const PRESENCE_CLASS_NAME = 'A `className` with presence variants in place of `motion`';
const DETAILS_BEFORE = 'The `details` arguments announced before';
const DETAILS_NOW = 'The `details` arguments announced now';

// Anchors shared by several rows: the 0.5 migration table, the other CHANGELOG lines.
const ON_CHECKED_CHANGE_ROW = '| Checkbox, Switch | `onChange(checked)` |';
const ON_VALUE_CHANGE_ROW =
  '| RadioGroup, Rating, SearchBox, SpinButton, ColorPicker, SwatchPicker, TagPicker, TimePicker, DatePicker | `onChange(value)` |';
const ON_OPTION_SELECT_ROW = '| Combobox, Dropdown | `onOptionSelect(value)` |';
const TAB_LIST_ROW =
  '| TabList | `selectedValue`, `defaultSelectedValue`, `onTabSelect`, `vertical` |';
const NAV_ROW = '| Nav | `selectedValue`, `defaultSelectedValue`, `onNavItemSelect` |';
const TEACHING_POPOVER_ROW = '| TeachingPopover | `currentStep`, `defaultCurrentStep` |';
const DATA_GRID_SELECTION_ROW =
  '| DataGrid | `selectedKeys`, `defaultSelectedKeys` (Set), `onSelectionChange(Set)` |';
const DATA_GRID_SORT_ROW =
  '| DataGrid | `sortColumn`, `sortDirection`, `defaultSortColumn`, `defaultSortDirection` |';
const TABLE_HEAD_ROW = '| Table | `Table.Head`, `Table.HeadCell`';
const ACCORDION_ROW =
  '| Accordion (single mode) | `openItems`, `defaultOpenItems`, `onOpenItemsChange` |';
const BUTTON_OBJECT_ANCHOR =
  'The button-object form of the dismiss and clear slots (`MessageBar.dismiss`, `SearchBox.dismiss`, `Tag.dismissIcon`';
const NUMERIC_SIZE_ANCHOR =
  '**A numeric `size` on Input, Select and Slider**: use `htmlSize` on Input and Select';
const PRESENCE_CLASS_NAME_ANCHOR =
  'a `className` that holds presence variants keeps turning the default motion off';
const DIALOG_DRAWER_DETAILS_ANCHOR =
  'the `details` parameter of the Dialog and Drawer `onOpenChange` becomes required in 1.0';
const LISTBOX_DETAILS_ANCHOR =
  "the `details` parameter of Calendar `onValueChange`, and of `useListbox`'s `onOpenChange` and `onSelect`, becomes required in 1.0";
const DETAILS_0_14_ANCHOR =
  'the optional `details` arguments added in 0.14 (`onOverflowChange`, `onSortChange`, `onSelectedItemsChange`, `Table.SelectionCell` `onCheckedChange`) become required';
const DETAILS_NOW_ANCHOR = 'will require the `details` argument in 1.0';

// Files named by several rows.
const DATA_GRID = 'src/components/table/DataGrid.tsx';
const TAB_LIST = 'src/components/layout/TabList.tsx';
const NAV_ROOT = 'src/components/navigation/Nav.root.tsx';
const TEACHING_POPOVER_ROOT = 'src/components/overlays/TeachingPopover.root.tsx';
const ACCORDION = 'src/components/layout/Accordion.tsx';
const TOOLTIP = 'src/components/overlays/Tooltip.tsx';
const TABLE = 'src/components/table/Table.tsx';

/** Every change of 1.0, grouped as the 0.18.0 CHANGELOG restates them. */
export const DEPRECATIONS: readonly Deprecation[] = [
  // The 0.4 names of the 0.5 migration table: removed, each through warnDeprecated or
  // resolveDeprecatedProp.
  {
    id: 'checkbox-onchange',
    group: RENAMED_IN_0_5,
    item: 'Checkbox `onChange(checked)`',
    replacement: '`onCheckedChange(checked)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Checkbox:onChange',
    changelogAnchor: ON_CHECKED_CHANGE_ROW,
    file: 'src/components/input/Checkbox.tsx',
    done: true,
  },
  {
    id: 'switch-onchange',
    group: RENAMED_IN_0_5,
    item: 'Switch `onChange(checked)`',
    replacement: '`onCheckedChange(checked)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Switch:onChange',
    changelogAnchor: ON_CHECKED_CHANGE_ROW,
    file: 'src/components/input/Switch.tsx',
    done: true,
  },
  {
    id: 'radiogroup-onchange',
    group: RENAMED_IN_0_5,
    item: 'RadioGroup `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:RadioGroup:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/RadioGroup.tsx',
    done: true,
  },
  {
    id: 'rating-onchange',
    group: RENAMED_IN_0_5,
    item: 'Rating `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Rating:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/Rating.tsx',
    done: true,
  },
  {
    id: 'searchbox-onchange',
    group: RENAMED_IN_0_5,
    item: 'SearchBox `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:SearchBox:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/SearchBox.tsx',
    done: true,
  },
  {
    id: 'spinbutton-onchange',
    group: RENAMED_IN_0_5,
    item: 'SpinButton `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:SpinButton:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/SpinButton.tsx',
    done: true,
  },
  {
    id: 'colorpicker-onchange',
    group: RENAMED_IN_0_5,
    item: 'ColorPicker `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:ColorPicker:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/ColorPicker.tsx',
    done: true,
  },
  {
    id: 'swatchpicker-onchange',
    group: RENAMED_IN_0_5,
    item: 'SwatchPicker `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:SwatchPicker:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/SwatchPicker.tsx',
    done: true,
  },
  {
    id: 'tagpicker-onchange',
    group: RENAMED_IN_0_5,
    item: 'TagPicker `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TagPicker:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/TagPicker.root.tsx',
    done: true,
  },
  {
    id: 'timepicker-onchange',
    group: RENAMED_IN_0_5,
    item: 'TimePicker `onChange(value)`',
    replacement: '`onValueChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TimePicker:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/TimePicker.tsx',
    done: true,
  },
  {
    id: 'datepicker-onchange',
    group: RENAMED_IN_0_5,
    item: 'DatePicker `onChange(date)`',
    replacement: '`onValueChange(date)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DatePicker:onChange',
    changelogAnchor: ON_VALUE_CHANGE_ROW,
    file: 'src/components/input/DatePicker.tsx',
    done: true,
  },
  {
    id: 'combobox-onoptionselect',
    group: RENAMED_IN_0_5,
    item: 'Combobox `onOptionSelect(value)`',
    replacement: '`onValueChange(value)` (called on change only)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Combobox:onOptionSelect',
    changelogAnchor: ON_OPTION_SELECT_ROW,
    file: 'src/components/input/Combobox.tsx',
    done: true,
  },
  {
    id: 'dropdown-onoptionselect',
    group: RENAMED_IN_0_5,
    item: 'Dropdown `onOptionSelect(value)`',
    replacement: '`onValueChange(value)` (called on change only)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Dropdown:onOptionSelect',
    changelogAnchor: ON_OPTION_SELECT_ROW,
    file: 'src/components/input/Dropdown.tsx',
    done: true,
  },
  {
    id: 'tablist-selectedvalue',
    group: RENAMED_IN_0_5,
    item: 'TabList `selectedValue`',
    replacement: '`value`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TabList:selectedValue',
    changelogAnchor: TAB_LIST_ROW,
    file: TAB_LIST,
    done: true,
  },
  {
    id: 'tablist-defaultselectedvalue',
    group: RENAMED_IN_0_5,
    item: 'TabList `defaultSelectedValue`',
    replacement: '`defaultValue`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TabList:defaultSelectedValue',
    changelogAnchor: TAB_LIST_ROW,
    file: TAB_LIST,
    done: true,
  },
  {
    id: 'tablist-vertical',
    group: RENAMED_IN_0_5,
    item: 'TabList `vertical`',
    replacement: '`orientation="vertical"`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TabList:vertical',
    changelogAnchor: TAB_LIST_ROW,
    file: TAB_LIST,
    done: true,
  },
  {
    id: 'tablist-ontabselect',
    group: RENAMED_IN_0_5,
    item: 'TabList `onTabSelect(value)`',
    replacement: '`onValueChange(value)` (called on change only)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TabList:onTabSelect',
    changelogAnchor: TAB_LIST_ROW,
    file: TAB_LIST,
    done: true,
  },
  {
    id: 'nav-selectedvalue',
    group: RENAMED_IN_0_5,
    item: 'Nav `selectedValue`',
    replacement: '`value`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Nav:selectedValue',
    changelogAnchor: NAV_ROW,
    file: NAV_ROOT,
    done: true,
  },
  {
    id: 'nav-defaultselectedvalue',
    group: RENAMED_IN_0_5,
    item: 'Nav `defaultSelectedValue`',
    replacement: '`defaultValue`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Nav:defaultSelectedValue',
    changelogAnchor: NAV_ROW,
    file: NAV_ROOT,
    done: true,
  },
  {
    id: 'nav-onnavitemselect',
    group: RENAMED_IN_0_5,
    item: 'Nav `onNavItemSelect(value)`',
    replacement: '`onValueChange(value)` (called on change only)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Nav:onNavItemSelect',
    changelogAnchor: NAV_ROW,
    file: NAV_ROOT,
    done: true,
  },
  {
    id: 'nav-category-text-label',
    group: RENAMED_IN_0_5,
    item: '`Nav.Category` without `label` (its text children are the label)',
    replacement: '`label`, with only the sub-items as children',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Nav.Category:text children as the label',
    changelogAnchor: '| Nav.Category | label taken from the first string child |',
    file: 'src/components/navigation/Nav.tsx',
    done: true,
  },
  {
    id: 'teachingpopover-currentstep',
    group: RENAMED_IN_0_5,
    item: 'TeachingPopover `currentStep`',
    replacement: '`activeStep`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TeachingPopover:currentStep',
    changelogAnchor: TEACHING_POPOVER_ROW,
    file: TEACHING_POPOVER_ROOT,
    done: true,
  },
  {
    id: 'teachingpopover-defaultcurrentstep',
    group: RENAMED_IN_0_5,
    item: 'TeachingPopover `defaultCurrentStep`',
    replacement: '`defaultActiveStep`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:TeachingPopover:defaultCurrentStep',
    changelogAnchor: TEACHING_POPOVER_ROW,
    file: TEACHING_POPOVER_ROOT,
    done: true,
  },
  {
    id: 'list-selectionmode-multi',
    group: RENAMED_IN_0_5,
    item: 'List `selectionMode="multi"`',
    replacement: '`selectionMode="multiple"`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:List:selectionMode="multi"',
    changelogAnchor: '| List | `selectionMode="multi"` |',
    file: 'src/components/data-display/List.tsx',
    done: true,
  },
  {
    id: 'datagrid-selectedkeys',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `selectedKeys` (a `Set`)',
    replacement: '`selectedItems` (an array)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:selectedKeys',
    changelogAnchor: DATA_GRID_SELECTION_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-defaultselectedkeys',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `defaultSelectedKeys` (a `Set`)',
    replacement: '`defaultSelectedItems` (an array)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:defaultSelectedKeys',
    changelogAnchor: DATA_GRID_SELECTION_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-onselectionchange',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `onSelectionChange(Set)`',
    replacement: '`onSelectedItemsChange(selectedItems)` (an array)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:onSelectionChange',
    changelogAnchor: DATA_GRID_SELECTION_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-sortcolumn',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `sortColumn`',
    replacement: '`sort` (`{ columnId, direction }` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:sortColumn',
    changelogAnchor: DATA_GRID_SORT_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-sortdirection',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `sortDirection`',
    replacement: '`sort` (`{ columnId, direction }` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:sortDirection',
    changelogAnchor: DATA_GRID_SORT_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-defaultsortcolumn',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `defaultSortColumn`',
    replacement: '`defaultSort` (`{ columnId, direction }` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:defaultSortColumn',
    changelogAnchor: DATA_GRID_SORT_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'datagrid-defaultsortdirection',
    group: RENAMED_IN_0_5,
    item: 'DataGrid `defaultSortDirection`',
    replacement: '`defaultSort` (`{ columnId, direction }` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:defaultSortDirection',
    changelogAnchor: DATA_GRID_SORT_ROW,
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'table-head',
    group: RENAMED_IN_0_5,
    item: '`Table.Head` (flat `TableHead`, type `TableHeadProps`)',
    replacement: '`Table.Header` (flat `TableHeader`, type `TableHeaderProps`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Table:Table.Head',
    changelogAnchor: TABLE_HEAD_ROW,
    file: TABLE,
    done: true,
    absent: { exports: ['TableHead'] },
  },
  {
    id: 'table-headcell',
    group: RENAMED_IN_0_5,
    item: '`Table.HeadCell` (flat `TableHeadCell`, type `TableHeadCellProps`)',
    replacement: '`Table.HeaderCell` (flat `TableHeaderCell`, type `TableHeaderCellProps`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Table:Table.HeadCell',
    changelogAnchor: TABLE_HEAD_ROW,
    file: TABLE,
    done: true,
    absent: { exports: ['TableHeadCell'] },
  },
  {
    id: 'stack-direction',
    group: RENAMED_IN_0_5,
    item: 'Stack `direction`',
    replacement: '`orientation` (same values)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Stack:direction',
    changelogAnchor: '| Stack | `direction` |',
    file: 'src/components/layout/Stack.tsx',
    done: true,
  },
  {
    id: 'skeleton-variant',
    group: RENAMED_IN_0_5,
    item: 'Skeleton `variant`',
    replacement: '`shape` (`circular` stays; `text` and `rectangular` take the default shape)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Skeleton:variant',
    changelogAnchor: '| Skeleton | `variant`',
    file: 'src/components/feedback/Skeleton.tsx',
    done: true,
  },
  {
    id: 'text-numeric-weight',
    group: RENAMED_IN_0_5,
    item: 'Text numeric `weight` (`400`, `600`, `700`)',
    replacement: '`weight="regular"`, `"semibold"`, `"bold"`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Text:weight={400}',
    changelogAnchor: '| Text | `weight={400 \\| 600 \\| 700}` |',
    file: 'src/components/typography/Text.tsx',
    done: true,
  },
  {
    id: 'link-variant',
    group: RENAMED_IN_0_5,
    item: 'Link `variant` (type `LinkVariant`)',
    replacement: '`appearance` (type `LinkAppearance`), same values',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Link:variant',
    changelogAnchor: '| Link | `variant` (type `LinkVariant`) |',
    file: 'src/components/button/Link.tsx',
    done: true,
  },
  {
    id: 'tooltip-variant',
    group: RENAMED_IN_0_5,
    item: 'Tooltip `variant="dark"` and `variant="light"`',
    replacement: '`appearance="inverted"` and `appearance="normal"`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Tooltip:variant',
    changelogAnchor: '| Tooltip | `variant="dark" \\| "light"` |',
    file: TOOLTIP,
    done: true,
  },
  {
    id: 'accordion-openitems',
    group: RENAMED_IN_0_5,
    item: 'Accordion `openItems` in single mode',
    replacement: '`openItem` (`string` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Accordion:openItems',
    changelogAnchor: ACCORDION_ROW,
    file: ACCORDION,
    done: true,
  },
  {
    id: 'accordion-defaultopenitems',
    group: RENAMED_IN_0_5,
    item: 'Accordion `defaultOpenItems` in single mode',
    replacement: '`defaultOpenItem` (`string` or `null`)',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Accordion:defaultOpenItems',
    changelogAnchor: ACCORDION_ROW,
    file: ACCORDION,
    done: true,
  },
  {
    id: 'accordion-onopenitemschange',
    group: RENAMED_IN_0_5,
    item: 'Accordion `onOpenItemsChange` in single mode',
    replacement: '`onOpenItemChange(value)`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Accordion:onOpenItemsChange',
    changelogAnchor: ACCORDION_ROW,
    file: ACCORDION,
    done: true,
  },

  // The button-object form of the dismiss and clear slots. A `<button>` or `Button` element passed
  // there stays: it is merged into the built-in button for good.
  {
    id: 'messagebar-dismiss-button-object',
    group: BUTTON_OBJECT_SLOTS,
    item: 'MessageBar `dismiss` with button props (`{ as: "button", onClick, … }`)',
    replacement: 'icon content in `dismiss`, and `onDismiss`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'MessageBar:dismiss-button-object',
    changelogAnchor: BUTTON_OBJECT_ANCHOR,
    file: 'src/components/feedback/MessageBar.tsx',
    done: true,
  },
  {
    id: 'searchbox-dismiss-button-object',
    group: BUTTON_OBJECT_SLOTS,
    item: 'SearchBox `dismiss` with button props (`{ as: "button", onClick, … }`)',
    replacement: 'icon content in `dismiss`, and `onClear`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey: 'SearchBox:dismiss-button-object',
    changelogAnchor: BUTTON_OBJECT_ANCHOR,
    file: 'src/components/input/SearchBox.tsx',
    done: true,
  },
  {
    id: 'tag-dismissicon-button-object',
    group: BUTTON_OBJECT_SLOTS,
    item: 'Tag `dismissIcon` with button props (`{ onClick, type, disabled, … }`)',
    replacement: 'icon content in `dismissIcon`, and `onDismiss`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: true,
    warningKey:
      'deprecated:Tag:dismissIcon={{ onClick, type, disabled, … }} (button props on the slot object)',
    changelogAnchor: BUTTON_OBJECT_ANCHOR,
    file: 'src/components/data-display/Tag.tsx',
    done: true,
  },

  // Style entries and theme classes, which no code can detect.
  {
    id: 'legacy-tokens-css',
    group: '`legacy-tokens.css`',
    item: '`@mortenbrudvik/waveui/legacy-tokens.css` (the 0.4 variable names)',
    replacement: 'the `--wave-*` variables',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: false,
    changelogAnchor: '`@mortenbrudvik/waveui/legacy-tokens.css` (the 0.4 CSS variable names)',
    file: 'src/styles/legacy-tokens.css',
  },
  {
    id: 'theme-classes-dark-high-contrast',
    group: 'The `dark` and `high-contrast` theme classes',
    item: 'The theme classes `dark` and `high-contrast` in your CSS',
    replacement: '`wave-dark` and `wave-high-contrast`',
    sinceVersion: '0.5',
    kind: 'removed',
    warns: false,
    changelogAnchor:
      'The `dark` and `high-contrast` theme classes (use `wave-dark`, `wave-high-contrast`)',
    file: 'src/lib/theme.ts',
  },
  {
    id: 'animations-css',
    group: '`animations.css`',
    item: '`src/styles/animations.css` (empty since 0.5)',
    replacement: 'nothing: drop the import',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: false,
    changelogAnchor: '`src/styles/animations.css`, empty since 0.5',
    file: 'src/styles/animations.css',
  },

  // Badge and CounterBadge `important`: a meaning that changes (each warns through `warnOnce`).
  {
    id: 'badge-important',
    group: IMPORTANT_COLOR,
    item: 'Badge `color="important"` (orange)',
    replacement: '`color="severe"` for the orange look',
    sinceVersion: '0.6',
    kind: 'default-changes',
    warns: true,
    warningKey: 'Badge:color:important',
    changelogAnchor: '**Badge `color="important"`** keeps its orange (severe) look through 0.x',
    file: 'src/components/data-display/Badge.tsx',
  },
  {
    id: 'counterbadge-important',
    group: IMPORTANT_COLOR,
    item: 'CounterBadge `color="important"` (orange)',
    replacement: '`color="severe"` for the orange look',
    sinceVersion: '0.6',
    kind: 'default-changes',
    warns: true,
    warningKey: 'CounterBadge:color:important',
    changelogAnchor: "CounterBadge's `important` follows Badge.",
    file: 'src/components/data-display/CounterBadge.tsx',
  },

  // Aliases of 0.7 to 0.14.
  {
    id: 'tooltip-delay',
    group: 'Tooltip `delay`',
    item: 'Tooltip `delay`',
    replacement: '`openDelay`',
    sinceVersion: '0.7',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Tooltip:delay',
    changelogAnchor: '**Tooltip `delay`**: use `openDelay`',
    file: TOOLTIP,
    done: true,
  },
  {
    id: 'input-numeric-size',
    group: NUMERIC_SIZE,
    item: 'Input numeric `size` (or a string of digits)',
    replacement: '`htmlSize`',
    sinceVersion: '0.9',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Input:size={number}',
    changelogAnchor: NUMERIC_SIZE_ANCHOR,
    file: 'src/components/input/Input.tsx',
    done: true,
  },
  {
    id: 'select-numeric-size',
    group: NUMERIC_SIZE,
    item: 'Select numeric `size` (or a string of digits)',
    replacement: '`htmlSize`',
    sinceVersion: '0.9',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:Select:size={number}',
    changelogAnchor: NUMERIC_SIZE_ANCHOR,
    file: 'src/components/input/Select.tsx',
    done: true,
  },
  {
    id: 'slider-numeric-size',
    group: NUMERIC_SIZE,
    item: 'Slider numeric `size`',
    replacement: 'nothing: it has no effect, remove it',
    sinceVersion: '0.9',
    kind: 'removed',
    warns: true,
    warningKey: 'Slider:size-number',
    changelogAnchor: NUMERIC_SIZE_ANCHOR,
    file: 'src/components/input/Slider.tsx',
    done: true,
  },
  {
    id: 'infolabel-label',
    group: 'InfoLabel `label`',
    item: 'InfoLabel `label`',
    replacement: '`children`',
    sinceVersion: '0.9',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:InfoLabel:label',
    changelogAnchor: '**InfoLabel `label`**: use `children`',
    file: 'src/components/data-display/InfoLabel.tsx',
    done: true,
  },
  {
    id: 'tagpicker-legacy-classes',
    group: '`wave-tag-picker__control` and `wave-tag-picker__group`',
    item: 'The classes `wave-tag-picker__control` and `wave-tag-picker__group` (`tagPickerClassNames.control` and `tagPickerClassNames.group`)',
    replacement:
      '`wave-tag-picker-control` and `wave-tag-picker-group` (`tagPickerControlClassNames.root` and `tagPickerGroupClassNames.root`)',
    sinceVersion: '0.11',
    kind: 'removed',
    warns: false,
    changelogAnchor:
      '`wave-tag-picker__control` and `wave-tag-picker__group` stay on their elements',
    file: 'src/lib/classNames.ts',
    done: true,
    absent: { classNames: ['wave-tag-picker__control', 'wave-tag-picker__group'] },
  },
  {
    id: 'presencebadge-dnd-oof',
    group: "PresenceBadge `'dnd'` and `'oof'`",
    item: "PresenceBadge `status` `'dnd'` and `'oof'` (type `DeprecatedPresenceStatus`)",
    replacement: "`'do-not-disturb'` and `'out-of-office'`",
    sinceVersion: '0.13',
    kind: 'removed',
    warns: true,
    warningKey: "deprecated:PresenceBadge:status 'dnd'",
    changelogAnchor:
      "**`PresenceStatus` `'dnd'` and `'oof'`:** use `'do-not-disturb'` and `'out-of-office'`",
    file: 'src/components/data-display/PresenceBadge.tsx',
    done: true,
  },
  {
    id: 'datagridcolumn-id',
    group: '`DataGridColumn.id`',
    item: '`DataGridColumn.id`',
    replacement: '`columnId`',
    sinceVersion: '0.14',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:columns[].id',
    changelogAnchor: '**`DataGridColumn.id`:** use `columnId`',
    file: DATA_GRID,
    done: true,
  },
  {
    id: 'teachingpopover-done-ondismiss',
    group: 'Done calling `onDismiss`',
    item: "TeachingPopover's Done calls `onFinish`, then `onDismiss`",
    replacement: 'Done calls `onFinish` only: handle Done there',
    sinceVersion: '0.14',
    kind: 'default-changes',
    warns: false,
    changelogAnchor: 'Done stops calling `onDismiss` in 1.0 (use `onFinish`)',
    file: TEACHING_POPOVER_ROOT,
    done: true,
  },

  // Call forms and a rule that 0.18 announces, each with a development warning.
  {
    id: 'userovingtabindex-positional',
    group: '`useRovingTabIndex(containerRef, options)`',
    item: '`useRovingTabIndex(containerRef, options)`',
    replacement: '`useRovingTabIndex(options)` and its `containerProps`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:useRovingTabIndex:useRovingTabIndex(containerRef, options)',
    changelogAnchor: 'the 0.4 call shape of `useRovingTabIndex` is removed',
    file: 'src/hooks/useRovingTabIndex.ts',
  },
  {
    id: 'datagrid-positional-onsortchange',
    group: "DataGrid's positional `onSortChange`",
    item: 'DataGrid `onSortChange(columnId, direction)` without `items`, `sort` or `defaultSort` (type `DataGridLegacySortProps`)',
    replacement: '`onSortChange(sort, details)`, with `items`, `sort` or `defaultSort`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'deprecated:DataGrid:onSortChange(columnId, direction)',
    changelogAnchor: 'the 0.4 callback form of a grid without `items`, `sort` or `defaultSort`',
    file: DATA_GRID,
  },
  {
    id: 'menu-popover-legacy-motion',
    group: PRESENCE_CLASS_NAME,
    item: '`Menu.Popover` `className` with presence variants, without `motion`',
    replacement: 'the classes in `motion`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'Menu.Popover:legacy-motion',
    changelogAnchor: PRESENCE_CLASS_NAME_ANCHOR,
    file: 'src/components/navigation/Menu.popover.tsx',
  },
  {
    id: 'dialog-content-legacy-motion',
    group: PRESENCE_CLASS_NAME,
    item: '`Dialog.Content` `className` with presence variants, without `motion`',
    replacement: 'the classes in `motion`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'Dialog.Content:legacy-motion',
    changelogAnchor: PRESENCE_CLASS_NAME_ANCHOR,
    file: 'src/components/overlays/Dialog.tsx',
  },
  {
    id: 'drawer-legacy-motion',
    group: PRESENCE_CLASS_NAME,
    item: 'Drawer `className` with presence variants, without `motion`',
    replacement: 'the classes in `motion`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'Drawer:legacy-motion',
    changelogAnchor: PRESENCE_CLASS_NAME_ANCHOR,
    file: 'src/components/overlays/Drawer.root.tsx',
  },
  {
    id: 'navdrawer-legacy-motion',
    group: PRESENCE_CLASS_NAME,
    item: 'NavDrawer `className` with presence variants, without `motion`',
    replacement: 'the classes in `motion`',
    sinceVersion: '0.18',
    kind: 'removed',
    warns: true,
    warningKey: 'NavDrawer:legacy-motion',
    changelogAnchor: PRESENCE_CLASS_NAME_ANCHOR,
    file: 'src/components/navigation/NavDrawer.tsx',
  },

  // Optional `details` arguments that become required (types only). WaveUI passes `details` on
  // every change it makes from an event; three paths pass none in 0.x and pass it in 1.0, with an
  // event of their own where none is given: `useTableSort` and `useFlatTree` called without an
  // event, and a form reset of `Table.SelectionCell`.
  {
    id: 'details-dialog-onopenchange',
    group: DETAILS_BEFORE,
    item: 'Dialog `onOpenChange(open, details?)`',
    replacement: '`onOpenChange(open, details)`',
    sinceVersion: '0.6',
    kind: 'required',
    warns: false,
    changelogAnchor: DIALOG_DRAWER_DETAILS_ANCHOR,
    file: 'src/components/overlays/Dialog.tsx',
  },
  {
    id: 'details-drawer-onopenchange',
    group: DETAILS_BEFORE,
    item: 'Drawer `onOpenChange(open, details?)`',
    replacement: '`onOpenChange(open, details)`',
    sinceVersion: '0.6',
    kind: 'required',
    warns: false,
    changelogAnchor: DIALOG_DRAWER_DETAILS_ANCHOR,
    file: 'src/components/overlays/Drawer.root.tsx',
  },
  {
    id: 'details-oncheckedvalueschange',
    group: DETAILS_BEFORE,
    item: 'Menu and Toolbar `onCheckedValuesChange(checkedValues, details?)`',
    replacement: '`onCheckedValuesChange(checkedValues, details)`',
    sinceVersion: '0.7',
    kind: 'required',
    warns: false,
    changelogAnchor:
      'the `details` parameter of `onCheckedValuesChange` (Menu, Toolbar) becomes required in 1.0',
    file: 'src/lib/types.ts',
  },
  {
    id: 'details-tree-oncheckeditemschange',
    group: DETAILS_BEFORE,
    item: 'Tree `onCheckedItemsChange(checkedItems, details?)`',
    replacement: '`onCheckedItemsChange(checkedItems, details)`',
    sinceVersion: '0.8',
    kind: 'required',
    warns: false,
    changelogAnchor:
      'the `details` parameter of Tree `onCheckedItemsChange` becomes required in 1.0',
    file: 'src/components/layout/Tree.core.tsx',
  },
  {
    id: 'details-calendar-onvaluechange',
    group: DETAILS_BEFORE,
    item: 'Calendar `onValueChange(date, details?)`',
    replacement: '`onValueChange(date, details)`',
    sinceVersion: '0.10',
    kind: 'required',
    warns: false,
    changelogAnchor: LISTBOX_DETAILS_ANCHOR,
    file: 'src/components/input/Calendar.tsx',
  },
  {
    id: 'details-uselistbox',
    group: DETAILS_BEFORE,
    item: '`useListbox` `onOpenChange(open, details?)` and `onSelect(value, details?)`',
    replacement: '`onOpenChange(open, details)` and `onSelect(value, details)`',
    sinceVersion: '0.10',
    kind: 'required',
    warns: false,
    changelogAnchor: LISTBOX_DETAILS_ANCHOR,
    file: 'src/hooks/useListbox.ts',
  },
  {
    id: 'details-navdrawer-onopenchange',
    group: DETAILS_BEFORE,
    item: 'NavDrawer `onOpenChange(open, details?)`',
    replacement: '`onOpenChange(open, details)`',
    sinceVersion: '0.11',
    kind: 'required',
    warns: false,
    changelogAnchor: '`onOpenChange(open, details?)` of Dialog, Drawer and NavDrawer included',
    file: 'src/components/navigation/NavDrawer.tsx',
  },
  {
    id: 'details-overflow-onoverflowchange',
    group: DETAILS_BEFORE,
    item: 'Overflow `onOverflowChange(hiddenItems, details?)`',
    replacement: '`onOverflowChange(hiddenItems, details)`',
    sinceVersion: '0.14',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_0_14_ANCHOR,
    file: 'src/components/layout/Overflow.tsx',
  },
  {
    id: 'details-datagrid-onsortchange',
    group: DETAILS_BEFORE,
    item: 'DataGrid `onSortChange(sort, details?)`',
    replacement: '`onSortChange(sort, details)`',
    sinceVersion: '0.14',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_0_14_ANCHOR,
    file: DATA_GRID,
  },
  {
    id: 'details-datagrid-onselecteditemschange',
    group: DETAILS_BEFORE,
    item: 'DataGrid `onSelectedItemsChange(selectedItems, details?)`',
    replacement: '`onSelectedItemsChange(selectedItems, details)`',
    sinceVersion: '0.14',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_0_14_ANCHOR,
    file: DATA_GRID,
  },
  {
    id: 'details-selectioncell-oncheckedchange',
    group: DETAILS_BEFORE,
    item: '`Table.SelectionCell` `onCheckedChange(checked, details?)` (no `details` on a form reset)',
    replacement: '`onCheckedChange(checked, details)`, a form reset included',
    sinceVersion: '0.14',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_0_14_ANCHOR,
    file: TABLE,
  },
  {
    id: 'details-avatargroup-onopenchange',
    group: DETAILS_NOW,
    item: 'AvatarGroup `onOpenChange(open, details?)`',
    replacement: '`onOpenChange(open, details)`',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/components/data-display/AvatarGroup.tsx',
  },
  {
    id: 'details-oncolumnwidthschange',
    group: DETAILS_NOW,
    item: 'DataGrid and `useTableColumnSizing` `onColumnWidthsChange(widths, details?)`',
    replacement: '`onColumnWidthsChange(widths, details)`',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/components/table/useTableColumnSizing.ts',
  },
  {
    id: 'details-resizehandle-onresize',
    group: DETAILS_NOW,
    item: '`Table.ResizeHandle` `onResize(width, details?)`',
    replacement: '`onResize(width, details)`',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/components/table/Table.resize.tsx',
  },
  {
    id: 'details-usetablesort-onsortchange',
    group: DETAILS_NOW,
    item: '`useTableSort` `onSortChange(sort, details?)` (no `details` when `setColumnSort` or `toggleColumnSort` gets no event)',
    replacement: '`onSortChange(sort, details)`, also without an event',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/components/table/useTableSort.ts',
  },
  {
    id: 'details-useselection-onselecteditemschange',
    group: DETAILS_NOW,
    item: '`useSelection` `onSelectedItemsChange(selectedItems, details?)`',
    replacement: '`onSelectedItemsChange(selectedItems, details)`',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/hooks/useSelection.ts',
  },
  {
    id: 'details-useflattree-oncheckeditemschange',
    group: DETAILS_NOW,
    item: '`useFlatTree` (FlatTree) `onCheckedItemsChange(checkedItems, details?)` (no `details` when `setChecked` gets no event)',
    replacement: '`onCheckedItemsChange(checkedItems, details)`, also without an event',
    sinceVersion: '0.18',
    kind: 'required',
    warns: false,
    changelogAnchor: DETAILS_NOW_ANCHOR,
    file: 'src/components/layout/useFlatTree.ts',
  },

  // The other changes that 0.18 announces.
  {
    id: 'image-alt-required',
    group: '`Image.alt`',
    item: 'Image without `alt` (`ImageProps.alt` optional)',
    replacement: '`alt` required (`alt=""` for a decorative image); `StrictImageProps` an alias',
    sinceVersion: '0.18',
    kind: 'required',
    warns: true,
    warningKey: 'Image:alt',
    changelogAnchor: 'required in 1.0 (`alt=""` for a decorative image)',
    file: 'src/components/data-display/Image.tsx',
  },
  {
    id: 'timepicker-format-default',
    group: 'TimePicker `format`',
    item: 'TimePicker without `format` (12-hour times)',
    replacement: 'the locale\'s hour cycle; `format="12h"` keeps 12-hour times',
    sinceVersion: '0.18',
    kind: 'default-changes',
    warns: false,
    changelogAnchor: "in 1.0 it follows the locale's hour cycle",
    file: 'src/components/input/TimePicker.tsx',
  },
  {
    id: 'ref-placement',
    group: 'Ref placement: no change',
    item: '`ref` on the root, `controlRef` on the focusable element, `slotProps.<part>.ref` on parts',
    replacement: 'no change: 1.0 moves no `ref`',
    sinceVersion: '0.18',
    kind: 'decided',
    warns: false,
    changelogAnchor: '1.0 moves no `ref`',
    file: 'docs/superpowers/specs/2026-10-30-fluent-parity-phase-13-design.md',
  },
];
