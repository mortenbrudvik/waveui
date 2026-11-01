import type * as ClassNames from './classNames';

/**
 * The completeness data of `slotProps` (Phase 13, R1 to R7): for every part key of the class-name
 * registry (`src/lib/classNames.ts`, each key of a constant but `root`), how a consumer reaches
 * the part's element. `src/__tests__/slotParts.test.ts` requires each part key in exactly one of
 * the four lists below, so a part the registry gains, or one a rollout forgets, fails the gate:
 *
 * - `SLOT_PROPS_KEYS`: a `slotProps` key of the component that declares it. Empty before the
 *   rollout; each rollout task moves its components' keys here from `PENDING_SLOT_PARTS` and adds
 *   each declaring component's props type to `SlotPropsOwners` in the gate's test file, whose
 *   type test requires the owner's `slotProps` keys to equal the keys listed here, both ways
 *   (`root` aside, which is no part key: only the owners `SLOT_PROPS_ROOT_OWNERS` names declare
 *   it, and they must).
 * - `NAMED_SLOT_PARTS`: the part already has a named slot prop, so it gets no `slotProps` key
 *   (R2). The rule: a `Slot` or `SlotObject` prop that fills the part's element, named as the key
 *   (`icon` fills `icon`) or, where the name differs, noted above the entry (`dismiss` fills
 *   `dismissIcon`); a props object that reaches the part counts too (`containerProps`,
 *   `errorMessageProps`, `listProps`, `menuButtonProps`). A motion slot names no part: it gives an
 *   element its motion classes only, so a part with a motion slot is pending, and an element that
 *   exists only for its motion is an exclusion.
 * - `SLOT_PART_EXCLUSIONS`: no `slotProps` key, for the stated reason (R3, R4): an element that
 *   exists only for layout, motion or measurement (a virtual spacer, a collapse element, the
 *   dialog's positioner, the carousel's viewport), or the root of another public component that
 *   you write in its place to give it props (R3: TagPicker's parts, a Rating.Item, a
 *   DataGrid.SelectionCell), also where a shorthand prop (`options`, `max`, `steps`, `items`)
 *   generates it. A part class that only a generated member carries, and that a component you
 *   write in its place never gets, is pending, not R3 (TagPicker's `tag` and `option`).
 * - `PENDING_SLOT_PARTS`: not decided by a rollout task yet; empty once the rollout is done.
 *
 * The lists are keyed by registry constant (`switchClassNames`), and an exclusion's `component`
 * names one too, so a typo is a type error as well as a gate failure. The data serves the gate
 * only: the package entry does not export it. This module imports types only, so it stays
 * server-safe. It supersedes the part list of the Phase 3 spec's Appendix A (R4).
 */

/** A constant of the class-name registry (`switchClassNames`). */
export type ClassNameConstant = keyof typeof ClassNames;

/** The part keys of a registry constant: each of its keys but `root`. */
export type SlotPartKey<C extends ClassNameConstant> = Exclude<
  keyof (typeof ClassNames)[C],
  'root'
>;

/** Part keys by registry constant. */
export type SlotPartLists = { readonly [C in ClassNameConstant]?: readonly SlotPartKey<C>[] };

/** A part key that gets no `slotProps` key, and why. */
export type SlotPartExclusion = {
  [C in ClassNameConstant]: {
    /** The registry constant of the part (`listClassNames`). */
    readonly component: C;
    /** The part key. */
    readonly key: SlotPartKey<C>;
    /** One line: why the element takes no consumer props through `slotProps`. */
    readonly reason: string;
  };
}[ClassNameConstant];

/**
 * The `slotProps` keys of each component (R1), filled by the rollout tasks. `as const` keeps each
 * key a literal, for the type test of its owner; `satisfies` still checks every constant and key.
 */
export const SLOT_PROPS_KEYS = {
  inputClassNames: ['input'],
  fieldClassNames: ['label', 'required', 'validationMessage', 'hint'],
  labelClassNames: ['required'],
  checkboxClassNames: ['indicator', 'label'],
  radioGroupItemClassNames: ['indicator', 'label'],
  switchClassNames: ['track', 'thumb', 'label'],
  spinButtonClassNames: ['decrementButton', 'input', 'incrementButton'],
  ratingDisplayClassNames: ['star', 'value', 'count'],
  searchBoxClassNames: ['input', 'dismissButton'],
  optionClassNames: ['indicator', 'content'],
  optionGroupClassNames: ['label', 'list'],
  comboboxClassNames: [
    'input',
    'clearButton',
    'expandButton',
    'listbox',
    'surface',
    'emptyMessage',
  ],
  dropdownClassNames: ['button', 'value', 'clearButton', 'listbox', 'surface'],
  tagPickerClassNames: [
    'tag',
    'removeButton',
    'expandButton',
    'clearButton',
    'option',
    'createOption',
    'overflowCount',
    'surface',
    'emptyMessage',
  ],
  timePickerClassNames: [
    'input',
    'clearButton',
    'expandButton',
    'errorMessage',
    'listbox',
    'option',
    'checkIcon',
    'surface',
    'emptyMessage',
  ],
  datePickerClassNames: [
    'input',
    'clearButton',
    'openCalendarButton',
    'errorMessage',
    'surface',
    'header',
    'previousMonthButton',
    'heading',
    'headingButton',
    'nextMonthButton',
    'grid',
    'weekday',
    'weekNumberHeader',
    'weekNumber',
    'day',
    'markedDot',
    'month',
    'year',
    'footer',
    'todayButton',
    'closeButton',
  ],
  calendarClassNames: [
    'header',
    'previousButton',
    'heading',
    'headingButton',
    'nextButton',
    'grid',
    'weekday',
    'weekNumberHeader',
    'weekNumber',
    'day',
    'markedDot',
    'month',
    'year',
    'footer',
    'todayButton',
  ],
  colorPickerClassNames: ['opacityLabel', 'opacityValue'],
  colorPickerHexFieldClassNames: ['label', 'input', 'errorMessage'],
  colorAreaClassNames: ['field', 'thumb'],
  colorSliderClassNames: ['rail', 'thumb'],
  alphaSliderClassNames: ['rail', 'thumb'],
  compoundButtonClassNames: ['contentContainer', 'primaryText', 'secondaryText'],
  dialogContentClassNames: ['titleActions', 'body'],
  drawerClassNames: ['header'],
  drawerHeaderTitleClassNames: ['heading'],
  navDrawerClassNames: ['nav'],
  navDrawerBodyClassNames: ['list'],
  navDrawerFooterClassNames: ['list'],
  popoverContentClassNames: ['beak', 'title'],
  menuItemClassNames: ['content', 'shortcut', 'submenuIndicator'],
  menuItemCheckboxClassNames: ['content', 'shortcut'],
  menuItemRadioClassNames: ['content', 'shortcut'],
  menuItemSwitchClassNames: ['content', 'shortcut', 'track', 'thumb'],
  menuItemLinkClassNames: ['content', 'shortcut'],
  tooltipClassNames: ['content'],
  teachingPopoverClassNames: ['beak', 'closeButton', 'dot', 'backButton', 'nextButton'],
  teachingPopoverCarouselNavClassNames: ['button', 'indicator'],
  infoButtonClassNames: ['info', 'beak'],
  infoLabelClassNames: ['label', 'infoButton', 'info'],
  toastClassNames: ['content', 'dismissButton'],
  toastTitleClassNames: ['label'],
  toastBodyClassNames: ['subtitle'],
  toasterClassNames: ['toast'],
  treeItemClassNames: ['row', 'indicator', 'label', 'aside', 'actions', 'group'],
  treeItemPersonaLayoutClassNames: ['media', 'main', 'description'],
  flatTreeItemClassNames: ['row', 'expandIcon', 'indicator', 'label'],
  navClassNames: ['list'],
  navCategoryClassNames: ['button', 'label', 'list'],
  navItemClassNames: ['listItem', 'content', 'actions'],
  navSubItemClassNames: ['listItem', 'actions'],
  navSectionHeaderClassNames: ['listItem'],
  navAppItemClassNames: ['listItem', 'content'],
  navAppItemStaticClassNames: ['listItem', 'content'],
  breadcrumbClassNames: ['list', 'listItem', 'overflowButton'],
  paginationClassNames: [
    'list',
    'listItem',
    'firstButton',
    'previousButton',
    'pageButton',
    'nextButton',
    'lastButton',
    'ellipsis',
  ],
  stepperClassNames: ['list'],
  stepperStepClassNames: ['listItem', 'button', 'indicator', 'label', 'description', 'connector'],
  accordionTriggerClassNames: ['heading', 'expandIcon'],
  overflowClassNames: ['overflowButton'],
} as const satisfies SlotPartLists;

/**
 * The constants whose component's `slotProps` also declares `root`, which is no part key: Input
 * alone (R6), whose `root` and `input` are one `<input>` without content slots and the wrapper
 * and the input with them. The owners' type test allows `root` exactly for these.
 */
export const SLOT_PROPS_ROOT_OWNERS = [
  'inputClassNames',
] as const satisfies readonly ClassNameConstant[];

/** The parts that a named slot prop already fills (R2); see the module's JSDoc for the rule. */
export const NAMED_SLOT_PARTS: SlotPartLists = {
  buttonClassNames: ['icon'],
  compoundButtonClassNames: ['icon'],
  toggleButtonClassNames: ['icon'],
  // `primaryActionButtonProps` fills `primaryActionButton`; `menuButtonProps` fills `menuButton`.
  splitButtonClassNames: ['primaryActionButton', 'menuButton', 'icon', 'menuIcon'],
  menuButtonClassNames: ['icon', 'menuIcon'],
  toolbarButtonClassNames: ['icon'],
  toolbarToggleButtonClassNames: ['icon'],
  toolbarRadioButtonClassNames: ['icon'],
  avatarClassNames: ['image', 'icon', 'initials', 'badge'],
  tagClassNames: ['media', 'icon', 'dismissIcon'],
  interactionTagPrimaryClassNames: ['media', 'icon'],
  personaClassNames: [
    'avatar',
    'badge',
    'primaryText',
    'secondaryText',
    'tertiaryText',
    'quaternaryText',
  ],
  listItemClassNames: ['checkmark'],
  // `dismiss` fills `dismissIcon`.
  messageBarClassNames: ['icon', 'dismissIcon'],
  toastClassNames: ['icon'],
  toastTitleClassNames: ['action'],
  // `errorMessageProps` fills `errorMessage`.
  inputClassNames: ['contentBefore', 'contentAfter', 'errorMessage'],
  // `errorMessageProps` fills `errorMessage`.
  textareaClassNames: ['errorMessage'],
  // `errorMessageProps` fills `errorMessage`.
  selectClassNames: ['errorMessage'],
  fieldClassNames: ['validationMessageIcon'],
  // `dismiss` fills `dismissIcon`.
  searchBoxClassNames: ['contentBefore', 'contentAfter', 'dismissIcon'],
  optionClassNames: ['checkIcon'],
  // `listProps` fills `list`.
  listboxSurfaceClassNames: ['list'],
  comboboxClassNames: ['expandIcon'],
  dropdownClassNames: ['expandIcon'],
  tagPickerClassNames: ['expandIcon'],
  tagPickerOptionClassNames: ['media', 'secondaryContent'],
  timePickerClassNames: ['expandIcon'],
  colorSwatchClassNames: ['icon'],
  emptySwatchClassNames: ['icon'],
  // `iconFilled` and `iconOutline` fill `icon`.
  ratingClassNames: ['icon'],
  // `iconFilled` and `iconOutline` fill `icon`.
  ratingItemClassNames: ['icon'],
  // `iconFilled` and `iconOutline` fill `icon`.
  ratingDisplayClassNames: ['icon'],
  cardClassNames: ['checkbox', 'floatingAction'],
  cardHeaderClassNames: ['image', 'action'],
  cardPreviewClassNames: ['logo'],
  tabListTabClassNames: ['icon'],
  treeItemClassNames: ['expandIcon', 'icon', 'iconAfter'],
  carouselItemClassNames: ['thumbnail'],
  breadcrumbClassNames: ['divider'],
  breadcrumbItemClassNames: ['icon'],
  menuItemClassNames: ['icon'],
  menuItemCheckboxClassNames: ['checkmark', 'icon'],
  menuItemRadioClassNames: ['checkmark', 'icon'],
  menuItemSwitchClassNames: ['icon'],
  menuItemLinkClassNames: ['icon'],
  navCategoryClassNames: ['icon', 'expandIcon'],
  navItemClassNames: ['icon'],
  navAppItemClassNames: ['icon'],
  navAppItemStaticClassNames: ['icon'],
  navDrawerClassNames: ['backdrop'],
  hamburgerClassNames: ['icon'],
  stepperStepClassNames: ['icon'],
  dialogContentClassNames: ['backdrop', 'titleAction', 'closeButton'],
  dialogTitleClassNames: ['action'],
  drawerClassNames: ['backdrop', 'titleAction', 'closeButton'],
  drawerHeaderTitleClassNames: ['action'],
  // `primaryAction` fills `primaryButton`; `secondaryAction` fills `secondaryButton`.
  teachingPopoverClassNames: ['primaryButton', 'secondaryButton'],
  teachingPopoverHeaderClassNames: ['icon'],
  teachingPopoverBodyClassNames: ['media'],
  // `containerProps` fills `container`.
  tableClassNames: ['container'],
  tableHeaderCellClassNames: ['sortIcon', 'aside'],
  tableCellLayoutClassNames: ['media', 'description'],
  // `containerProps` fills `container`.
  dataGridClassNames: ['container'],
  dataGridHeaderCellClassNames: ['sortIcon'],
};

/** The parts that get no `slotProps` key, each with its reason (R3, R4). */
export const SLOT_PART_EXCLUSIONS: readonly SlotPartExclusion[] = [
  {
    component: 'avatarGroupClassNames',
    key: 'overflowButton',
    reason:
      'the root of AvatarGroup.Popover, built in or yours as a child, which takes its props directly (R3)',
  },
  {
    component: 'listClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer: stands in for the items a windowed list does not render, sized by the window',
  },
  {
    component: 'messageBarGroupClassNames',
    key: 'item',
    reason:
      "a presence element: holds a bar while it enters and exits, with MessageBarGroup's `motion` slot; the bar inside takes its own props",
  },
  {
    component: 'toasterClassNames',
    key: 'toastContent',
    reason:
      "a motion element: the one item of a toast's container, clipped while the toast moves; the toast inside takes its own props",
  },
  {
    component: 'listboxClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer: stands in for the options a windowed list does not render, sized by the window',
  },
  {
    component: 'comboboxClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer: stands in for the options a windowed list does not render, sized by the window',
  },
  {
    component: 'dropdownClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer: stands in for the options a windowed list does not render, sized by the window',
  },
  {
    component: 'tagPickerClassNames',
    key: 'control',
    reason: 'the root of TagPicker.Control, which takes its props directly in the parts form (R3)',
  },
  {
    component: 'tagPickerClassNames',
    key: 'group',
    reason: 'the root of TagPicker.Group, which takes its props directly in the parts form (R3)',
  },
  {
    component: 'tagPickerClassNames',
    key: 'input',
    reason: 'the root of TagPicker.Input, which takes its props directly in the parts form (R3)',
  },
  {
    component: 'tagPickerClassNames',
    key: 'listbox',
    reason: 'the root of TagPicker.List, which takes its props directly in the parts form (R3)',
  },
  {
    component: 'swatchPickerClassNames',
    key: 'swatch',
    reason:
      'the root of each ColorSwatch, ImageSwatch or EmptySwatch, which takes its props directly as your child; `items` is the shorthand (R3)',
  },
  {
    component: 'ratingClassNames',
    key: 'star',
    reason:
      'the root of each Rating.Item, generated from `max` or yours as children, which takes its props directly (R3)',
  },
  {
    component: 'accordionPanelClassNames',
    key: 'collapse',
    reason:
      "a collapse element: opens and closes the panel's space, with the panel's `motion` slot; the region inside takes your props",
  },
  {
    component: 'treeItemClassNames',
    key: 'collapse',
    reason:
      "a collapse element: opens and closes the space of the item's group, with Tree's `motion` slot",
  },
  {
    component: 'flatTreeClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer: stands in for the items a windowed tree does not render, sized by the window',
  },
  {
    component: 'carouselClassNames',
    key: 'viewport',
    reason: 'the clipping element around the track, measured for `groupSize="auto"`',
  },
  {
    component: 'menuItemClassNames',
    key: 'checkmark',
    reason:
      'Menu.Item draws no check column: the class is carried by the column of Menu.ItemCheckbox and Menu.ItemRadio, which their `checkmark` slot fills',
  },
  {
    component: 'navCategoryClassNames',
    key: 'collapse',
    reason:
      "a collapse element: opens and closes the space of the category's list, with Nav.Category's `motion` slot",
  },
  {
    component: 'navDrawerClassNames',
    key: 'collapse',
    reason:
      "a collapse element: opens and closes an inline drawer's space, with NavDrawer's `motion` slot; the panel inside is the root",
  },
  {
    component: 'dialogContentClassNames',
    key: 'positioner',
    reason:
      "places the surface in the viewport and lets presses through to the backdrop or the page; the surface's own margin, in `className`, sets the gap",
  },
  {
    component: 'drawerClassNames',
    key: 'collapse',
    reason:
      "a collapse element: opens and closes an inline drawer's space, with Drawer's `motion` slot; the panel inside is the root",
  },
  {
    component: 'drawerClassNames',
    key: 'body',
    reason: 'the scrolling body takes the props of a Drawer.Body child (R3)',
  },
  {
    component: 'teachingPopoverClassNames',
    key: 'title',
    reason:
      'the root of TeachingPopover.Title, which takes its props directly in the children form (R3)',
  },
  {
    component: 'teachingPopoverClassNames',
    key: 'body',
    reason:
      'the root of TeachingPopover.Body, which takes its props directly in the children form (R3)',
  },
  {
    component: 'teachingPopoverClassNames',
    key: 'footer',
    reason:
      'the root of TeachingPopover.Footer or TeachingPopover.CarouselFooter, which take their props directly in the children form (R3)',
  },
  {
    component: 'dataGridClassNames',
    key: 'spacer',
    reason:
      'a virtual spacer row: stands in for the rows a windowed grid does not render, sized by the window',
  },
  {
    component: 'dataGridHeaderClassNames',
    key: 'selectionCell',
    reason:
      'the root of DataGrid.SelectionCell, which takes its props directly as your child of the header row (R3)',
  },
  {
    component: 'dataGridRowClassNames',
    key: 'selectionCell',
    reason:
      'the root of DataGrid.SelectionCell, which takes its props directly as your child of the row (R3); `selectionCellProps` reaches the automatic one',
  },
];

/** The parts no rollout task has covered yet (R7); empty once the rollout is done. */
export const PENDING_SLOT_PARTS: SlotPartLists = {
  avatarClassNames: ['visual'],
  avatarGroupClassNames: ['item', 'pie', 'surface', 'list', 'listItem'],
  avatarGroupItemClassNames: ['name'],
  presenceBadgeClassNames: ['icon'],
  tagClassNames: ['primaryText', 'secondaryText', 'dismissButton'],
  interactionTagPrimaryClassNames: ['primaryText', 'secondaryText'],
  interactionTagSecondaryClassNames: ['dismissIcon'],
  dividerClassNames: ['line', 'label'],
  listItemClassNames: ['content', 'action'],
  messageBarClassNames: ['body', 'dismissButton'],
  progressBarClassNames: ['bar', 'label'],
  spinnerClassNames: ['spinner', 'label'],
  cardClassNames: ['checkmark'],
  cardHeaderClassNames: ['text', 'title', 'subtitle'],
  carouselClassNames: [
    'autoPlayButton',
    'track',
    'slide',
    'previousButton',
    'nextButton',
    'picker',
    'pickerButton',
    'pickerIndicator',
  ],
  tableHeaderCellClassNames: ['button'],
  tableSelectionCellClassNames: ['control'],
  tableCellLayoutClassNames: ['content', 'main'],
  dataGridHeaderClassNames: ['selectAllCheckbox'],
  dataGridHeaderCellClassNames: ['button', 'resizeHandle'],
  dataGridRowClassNames: ['selectionControl'],
};
