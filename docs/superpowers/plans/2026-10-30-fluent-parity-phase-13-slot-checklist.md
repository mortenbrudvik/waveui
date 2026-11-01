# Phase 13 slot checklist: the `slotProps` work list (Tasks 12 to 18)

Generated in Task 4 from the data of `src/lib/slotParts.ts` and the class-name registry (`src/lib/classNames.ts`), which `src/__tests__/slotParts.test.ts` checks. The data is the source: when the two differ, `slotParts.ts` wins and this list is stale.

186 constants, 113 with parts, 365 part keys: 171 `slotProps` keys (19 in Task 12, 35 in Task 13, 36 in Task 13b, 14 in Task 14, 9 in Task 15a, 13 in Task 15b, 13 in Task 15c, 5 in Task 15d, 13 in Task 16a, 14 in Task 16b), 65 pending, 100 named slots, 29 exclusions.

**How to read it.** One row per registry constant with parts, in the group of spec §8 that rolls it out. *Pending keys* are the work: each becomes a `slotProps` key of the component, typed `SlotPart<'<element>'>` for the element named in brackets (read from the source; where a part is one of two elements, both are named), and moves from `PENDING_SLOT_PARTS` to `SLOT_PROPS_KEYS` in the same change, which also adds the declaring component's props type to `SlotPropsOwners` in `src/__tests__/slotParts.test.ts` (its type test requires the owner's `slotProps` keys to equal the listed keys, both ways). *Named slots* already reach their part (R2) and get no `slotProps` key; a prop in brackets is the slot or props object whose name differs from the key. *Exclusions* get no key; their reasons are in the table at the end. *Notes* say where a part is rendered by another component than its constant's, or what the rollout must lock.

**Rules behind the data** (also in the JSDoc of `slotParts.ts`): a named slot is a `Slot`/`SlotObject` prop that fills the part's element, or a props object that reaches it (`containerProps`, `errorMessageProps`, `listProps`, `menuButtonProps`, `primaryActionButtonProps`); a motion slot names no part. An exclusion is an element that exists only for layout, motion or measurement (virtual spacers, collapse and presence elements, the dialog's positioner, the carousel's viewport), or the root of another public component you write in its place (R3), also where a shorthand prop generates it. A part class that only a generated member carries, and that a component you write in its place never gets, is pending, not R3 (TagPicker's `tag` and `option`). Changing a classification is a ruling: record it in the spec's section 11 and edit `slotParts.ts` and this list together.

**Splitting.** The controller splits a group with more than 8 components that have pending keys into consecutive tasks of at most 8 (plan, Package D).

## D1 form basics (Task 12)

8 components with pending keys (19 keys). Nothing pending (named slots and exclusions only): `textareaClassNames`, `selectClassNames`, `ratingClassNames`, `ratingItemClassNames`.

**Done in Task 12:** the 19 keys of the column below are `slotProps` keys now (`SLOT_PROPS_KEYS`), each declared by the component named in its row (RadioGroupItem: `RadioGroupItemProps`, the same type as `RadioItemProps`). Input's `slotProps` also declares `root`, which is no part key (R6; `SLOT_PROPS_ROOT_OWNERS`). The conventions every rollout task follows are in the spec, section 11, "Task 12".

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| Switch (`switchClassNames`) | `track` (button), `thumb` (span), `label` (span) | — | — |  |
| Checkbox (`checkboxClassNames`) | `indicator` (button), `label` (span) | — | — |  |
| RadioGroupItem (`radioGroupItemClassNames`) | `indicator` (button), `label` (span) | — | — | `labelClassName` already reaches `label`: define its order against `slotProps.label`, or deprecate it (a Package B inventory row). |
| Input (`inputClassNames`) | `input` (input) | `contentBefore`, `contentAfter`, `errorMessage` (`errorMessageProps`) | — | R6: without content slots `root` and `input` are one `<input>`; `input` applies after `root`. |
| Textarea (`textareaClassNames`) | — | `errorMessage` (`errorMessageProps`) | — |  |
| Select (`selectClassNames`) | — | `errorMessage` (`errorMessageProps`) | — |  |
| SpinButton (`spinButtonClassNames`) | `decrementButton` (button), `input` (input), `incrementButton` (button) | — | — |  |
| Rating (`ratingClassNames`) | — | `icon` (`iconFilled`, `iconOutline`) | `star` |  |
| RatingItem (`ratingItemClassNames`) | — | `icon` (`iconFilled`, `iconOutline`) | — |  |
| RatingDisplay (`ratingDisplayClassNames`) | `star` (span), `value` (span), `count` (span) | `icon` (`iconFilled`, `iconOutline`) | — | `star` reaches only compact's one star, which is no item; the other stars are RatingDisplay.Item roots, which take their props directly (R3). The rollout's JSDoc of `slotProps.star` must say so. |
| Label (`labelClassNames`) | `required` (span) | — | — |  |
| Field (`fieldClassNames`) | `label` (label), `required` (span), `validationMessage` (p), `hint` (p) | `validationMessageIcon` | — | Field's own parts; the control is your child. |

## D2 pickers (Task 13)

9 components with pending keys (71 keys): **longer than 8, split into consecutive tasks.** Nothing pending (named slots and exclusions only): `listboxClassNames`, `listboxSurfaceClassNames`, `tagPickerOptionClassNames`.

**Done in Task 13 (ruling AB, the first half):** the 35 keys of Combobox, Dropdown, Option, OptionGroup, TagPicker, SearchBox and TimePicker are `slotProps` keys now, each declared by the component named in its row; TagPicker's root declares all nine and its parts read them from its context. DatePicker and Calendar are the second half. The mechanisms (ListboxSurface's internal `parts`, the per-option merge, TagPicker's host part for `removeButton`, SearchBox's `dismiss` against `dismissButton`) are in the spec, section 11, "Task 13". Note: the "+N" chip (`overflowCount`) is rendered by TagPicker.Group, inside TagPicker.Control.

**Done in Task 13b (the second half):** the 36 keys of DatePicker (21) and Calendar (15) are `slotProps` keys now, each declared by the component whose constant names it, under that constant's key names (DatePicker's `previousMonthButton`, `nextMonthButton` and `h2` heading; Calendar's `previousButton`, `nextButton` and `div` heading). Both hand their parts to the calendar view they share, which merges them on the elements that carry their part classes. The mechanism (the view's internal `parts`, the per-cell merge, the shared button and container locks) is in the spec, section 11, "Task 13b".

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| Combobox (`comboboxClassNames`) | `input` (input), `clearButton` (button), `expandButton` (button), `listbox` (ul), `surface` (div), `emptyMessage` (div) | `expandIcon` | `spacer` | `listbox` and `surface` are the ListboxSurface it renders. |
| Dropdown (`dropdownClassNames`) | `button` (button), `value` (span), `clearButton` (button), `listbox` (ul), `surface` (div) | `expandIcon` | `spacer` | `listbox` and `surface` are the ListboxSurface it renders. |
| Listbox (`listboxClassNames`) | — | — | `spacer` |  |
| ListboxSurface (`listboxSurfaceClassNames`) | — | `list` (`listProps`) | — |  |
| Option (`optionClassNames`) | `indicator` (span), `content` (span) | `checkIcon` | — |  |
| OptionGroup (`optionGroupClassNames`) | `label` (div), `list` (ul) | — | — |  |
| TagPicker (`tagPickerClassNames`) | `tag` (span), `removeButton` (button), `expandButton` (button), `clearButton` (button), `option` (li), `createOption` (li), `overflowCount` (span), `surface` (div), `emptyMessage` (div) | `expandIcon` | `control`, `group`, `input`, `listbox` | `tag` and `removeButton` (the default tag's dismiss button) exist only on the default tags (a TagPicker.Group without children), and `option` only on data-mode options and the create option: a Tag or Option you write never carries them, so these keys reach only the generated members. `expandButton`, `clearButton` and `overflowCount` are rendered by TagPicker.Control; `createOption`, `surface` and `emptyMessage` by TagPicker.List. |
| TagPickerOption (`tagPickerOptionClassNames`) | — | `media`, `secondaryContent` | — |  |
| SearchBox (`searchBoxClassNames`) | `input` (input), `dismissButton` (button) | `contentBefore`, `contentAfter`, `dismissIcon` (`dismiss`) | — | `dismissButton`: the `dismiss` slot fills its content; the button-object form is deprecated, but a merged `<button>` element (documented, not deprecated) also reaches the button: the rollout states and tests which wins against `slotProps.dismissButton`. |
| TimePicker (`timePickerClassNames`) | `input` (input), `clearButton` (button), `expandButton` (button), `errorMessage` (p), `listbox` (ul), `option` (li), `checkIcon` (span), `surface` (div), `emptyMessage` (div) | `expandIcon` | — | Its options are internal (no option component). |
| DatePicker (`datePickerClassNames`) | `input` (input), `clearButton` (button), `openCalendarButton` (button), `errorMessage` (p), `surface` (div), `header` (div), `previousMonthButton` (button), `heading` (h2), `headingButton` (button), `nextMonthButton` (button), `grid` (table), `weekday` (th), `weekNumberHeader` (th), `weekNumber` (th), `day` (button), `markedDot` (span), `month` (button), `year` (button), `footer` (div), `todayButton` (button), `closeButton` (button) | — | — | The calendar parts are drawn by the calendar view it shares with Calendar. |
| Calendar (`calendarClassNames`) | `header` (div), `previousButton` (button), `heading` (div), `headingButton` (button), `nextButton` (button), `grid` (table), `weekday` (th), `weekNumberHeader` (th), `weekNumber` (th), `day` (button), `markedDot` (span), `month` (button), `year` (button), `footer` (div), `todayButton` (button) | — | — |  |

## D3 other inputs and the button family (Task 14)

6 components with pending keys (14 keys). Nothing pending (named slots and exclusions only): `swatchPickerClassNames`, `colorSwatchClassNames`, `emptySwatchClassNames`, `buttonClassNames`, `toggleButtonClassNames`, `splitButtonClassNames`, `menuButtonClassNames`.

**Done in Task 14:** the 14 keys of the column below are `slotProps` keys now, each declared by the component named in its row (`ColorPickerHexFieldProps` for the hex field; AlphaSlider declares its own `rail` and `thumb` instead of inheriting ColorSlider's). The rail, field and thumb parts are drawings: the sliders are the range inputs, which are no parts. CompoundButton's button and `icon` stay Button's. The decisions (the area's press through its root, the hex input's locks, CompoundButton's blocked clicks while disabled, its place in the button barrel) are in the spec, section 11, "Task 14".

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| ColorPicker (`colorPickerClassNames`) | `opacityLabel` (span), `opacityValue` (span) | — | — |  |
| ColorPickerHexField (`colorPickerHexFieldClassNames`) | `label` (span), `input` (input), `errorMessage` (span) | — | — |  |
| ColorArea (`colorAreaClassNames`) | `field` (div), `thumb` (span) | — | — |  |
| ColorSlider (`colorSliderClassNames`) | `rail` (div), `thumb` (span) | — | — |  |
| AlphaSlider (`alphaSliderClassNames`) | `rail` (div), `thumb` (span) | — | — |  |
| SwatchPicker (`swatchPickerClassNames`) | — | — | `swatch` |  |
| ColorSwatch (`colorSwatchClassNames`) | — | `icon` | — |  |
| EmptySwatch (`emptySwatchClassNames`) | — | `icon` | — |  |
| Button (`buttonClassNames`) | — | `icon` | — |  |
| CompoundButton (`compoundButtonClassNames`) | `contentContainer` (span), `primaryText` (span), `secondaryText` (span) | `icon` | — | Built on Button: its root and `icon` are Button's. |
| ToggleButton (`toggleButtonClassNames`) | — | `icon` | — |  |
| SplitButton (`splitButtonClassNames`) | — | `primaryActionButton` (`primaryActionButtonProps`), `menuButton` (`menuButtonProps`), `icon`, `menuIcon` | — |  |
| MenuButton (`menuButtonClassNames`) | — | `icon`, `menuIcon` | — |  |

## D4 overlays (Task 15)

21 components with pending keys (40 keys): **longer than 8, split into consecutive tasks.** Nothing pending (named slots and exclusions only): `dialogTitleClassNames`, `teachingPopoverHeaderClassNames`, `teachingPopoverBodyClassNames`.

**Done in Task 15a (the modal, drawer and popover surfaces):** the 9 keys of DialogContent, Drawer, DrawerHeaderTitle, NavDrawer, NavDrawerBody, NavDrawerFooter and PopoverContent are `slotProps` keys now, each declared by the component whose constant names it (no classification change). DrawerPanel, which Drawer and NavDrawer share, draws neither `header` nor `nav`: Drawer's built-in header row merges `slotProps.header` and NavDrawer's root merges `slotProps.nav`, so the panel shell is unchanged. The locks (the hidden state of the parts that hold focusable content, the ids the surfaces' `aria-labelledby` names, the landmark's name, the beak's position) are in the spec, section 11, "Task 15a".

**Done in Task 15b (the menu item kinds):** the 13 keys of MenuItem, MenuItemCheckbox, MenuItemRadio, MenuItemSwitch and MenuItemLink are `slotProps` keys now, each declared by the item kind whose constant names it (no classification change): the checkable kinds omit Menu.Item's `slotProps` and declare their own, so only Menu.Item has `submenuIndicator` and only Menu.ItemSwitch `track` and `thumb`; Menu.ItemLink declares its keys in `MenuItemLinkOwnProps`. The item row they share merges `content` and `shortcut` once for every kind. Every part locks a role and the markers the menu reads from a row (typeahead's label, the check and icon columns) unset; the mechanism and the other locks are in the spec, section 11, "Task 15b".

**Done in Task 15c (the tooltip, the teaching popover and the info parts):** the 13 keys of Tooltip, TeachingPopover, TeachingPopoverCarouselNav, InfoButton and InfoLabel are `slotProps` keys now, each declared by the component whose constant names it (no classification change). TeachingPopover's root declares all five of its keys and its parts read them from its context, in the `steps` form and the parts form alike; the Close button is the Close button shared with Dialog and Drawer, which takes the part as an internal prop (the `dismissButton` slot's merged props are its defaults). InfoLabel's `label` and `infoButton` are the props of the Label and the InfoButton it renders, and its `info` becomes that InfoButton's `info` part (over a `slotProps` passed on through `infoButton`). The locks, the must-run hover bookkeeping of the note and the blocked clicks of the first step's Back are in the spec, section 11, "Task 15c".

**Done in Task 15d (the Toast family, the last of D4):** the 5 keys of Toast, ToastTitle, ToastBody and Toaster are `slotProps` keys now, each declared by the component whose constant names it (no classification change): Toast `content` and `dismissButton`, ToastTitle `label`, ToastBody `subtitle`, and Toaster `toast`, the container it draws around every toast. Every part merges only when given, so a toast without `slotProps` allocates no lock object. The locks (the container's role, tab stop, marker, phase and name and description wiring, the title's id, the text parts' name and hidden state, the Dismiss button's type, name, click and disabled state) and the handler rulings (the container's Delete is locked and cancellable; the region's timer pause is not on a part and always runs) are in the spec, section 11, "Task 15d".

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| DialogContent (`dialogContentClassNames`) | `titleActions` (div), `body` (div) | `backdrop`, `titleAction`, `closeButton` | `positioner` | `titleActions` holds the `titleAction` slot, the Dialog.Title actions and the Close button. |
| DialogTitle (`dialogTitleClassNames`) | — | `action` | — |  |
| Drawer (`drawerClassNames`) | `header` (div) | `backdrop`, `titleAction`, `closeButton` | `collapse`, `body` | `header` is the built-in header row (absent with a Drawer.Header). |
| DrawerHeaderTitle (`drawerHeaderTitleClassNames`) | `heading` (h2, by headingLevel) | `action` | — |  |
| NavDrawer (`navDrawerClassNames`) | `nav` (nav) | `backdrop` | `collapse` | A Drawer variant: `nav` is the landmark inside the panel. NavDrawer is in D4 (DrawerPanel) while Nav's lists are in D5, so the Nav list wiring is touched in two tasks. |
| NavDrawerBody (`navDrawerBodyClassNames`) | `list` (ul) | — | — |  |
| NavDrawerFooter (`navDrawerFooterClassNames`) | `list` (ul) | — | — |  |
| PopoverContent (`popoverContentClassNames`) | `beak` (div), `title` (h2) | — | — | `title` is the heading of the `title` prop. |
| MenuItem (`menuItemClassNames`) | `content` (span), `shortcut` (span), `submenuIndicator` (svg) | `icon` | `checkmark` | The variants (checkbox, radio, switch, link) also carry these parts. |
| MenuItemCheckbox (`menuItemCheckboxClassNames`) | `content` (span), `shortcut` (span) | `checkmark`, `icon` | — |  |
| MenuItemRadio (`menuItemRadioClassNames`) | `content` (span), `shortcut` (span) | `checkmark`, `icon` | — |  |
| MenuItemSwitch (`menuItemSwitchClassNames`) | `content` (span), `shortcut` (span), `track` (span), `thumb` (span) | `icon` | — |  |
| MenuItemLink (`menuItemLinkClassNames`) | `content` (span), `shortcut` (span) | `icon` | — |  |
| Tooltip (`tooltipClassNames`) | `content` (span) | — | — | `content` is the portaled surface; the `motion` slot gives it motion classes only. |
| TeachingPopover (`teachingPopoverClassNames`) | `beak` (div), `closeButton` (button), `dot` (span), `backButton` (button), `nextButton` (button) | `primaryButton` (`primaryAction`), `secondaryButton` (`secondaryAction`) | `title`, `body`, `footer` | `closeButton` is rendered by TeachingPopover.Header (its `dismissButton` slot fills its content); `backButton`, `nextButton` and `dot` by the footers; `beak` by the surface. |
| TeachingPopoverHeader (`teachingPopoverHeaderClassNames`) | — | `icon` | — |  |
| TeachingPopoverBody (`teachingPopoverBodyClassNames`) | — | `media` | — |  |
| TeachingPopoverCarouselNav (`teachingPopoverCarouselNavClassNames`) | `button` (button), `indicator` (span) | — | — |  |
| InfoButton (`infoButtonClassNames`) | `info` (div), `beak` (div) | — | — | `info` is the portaled note; the `motion` slot gives it motion classes only. |
| InfoLabel (`infoLabelClassNames`) | `label` (label), `infoButton` (button), `info` (div) | — | — | After InfoButton (moved from D1): `label` is its Label, `infoButton` its InfoButton, `info` the InfoButton's note (portaled), so the last two are drawn by InfoButton's parts; its `motion` slot reaches the note's motion only. |
| Toast (`toastClassNames`) | `content` (div), `dismissButton` (button) | `icon` | — |  |
| ToastTitle (`toastTitleClassNames`) | `label` (span) | `action` | — |  |
| ToastBody (`toastBodyClassNames`) | `subtitle` (div) | — | — |  |
| Toaster (`toasterClassNames`) | `toast` (div) | — | `toastContent` | `toast` is the focusable group around each toast and its presence element (the `motion` slot). |

## D5 navigation (Task 16)

16 components with pending keys (48 keys): **longer than 8, split into consecutive tasks.** Nothing pending (named slots and exclusions only): `tabListTabClassNames`, `flatTreeClassNames`, `hamburgerClassNames`, `breadcrumbItemClassNames`, `accordionPanelClassNames`, `toolbarButtonClassNames`, `toolbarToggleButtonClassNames`, `toolbarRadioButtonClassNames`.

**Done in Task 16a (the trees, ruling AJ's first part):** the 13 keys of TreeItem, TreeItemPersonaLayout and FlatTreeItem are `slotProps` keys now (no classification change). Tree.Item and Tree.ItemPersonaLayout declare their own constants' keys; FlatTree.Item is the tree's own row, never written by hand, so FlatTree declares `flatTreeItemClassNames`' four keys and hands them to every item through its context (ruling AK; `SlotPropsOwners` maps the constant to `FlatTreeProps`). Every part merges only when given, so an item without `slotProps` allocates nothing more. The locks (a role, a tab index and the tree's markers on every part; the label's and aside's ids, the checkbox's wiring, the toolbar's), the must-run focus bookkeeping of the actions and the blocked clicks of a disabled flat item are in the spec, section 11, "Task 16a".

**Done in Task 16b (the Nav family):** the 14 keys of Nav, NavCategory, NavItem, NavSubItem, NavSectionHeader, NavAppItem and NavAppItemStatic are `slotProps` keys now (no classification change). Each component declares its own constant's keys; Nav.Item and Nav.SubItem declare theirs in every branch of their props (`NavItemOwnProps`, `NavSubItemOwnProps`, which drops the label's `content`), and Nav.AppItem in `NavAppItemOwnProps`. The link or button of an entry and an app item is its root, which takes its own props, and is no part. Every per-entry part merges only when given, so an entry without `slotProps` allocates nothing more. The locks (a role, a tab index and a roving container's marker on every part; the hidden state of the parts that hold an entry or its name; the toggle's state, the list's id, the actions' wiring), the toggle's handling of a prevented click and the blocked clicks of a disabled entry are in the spec, section 11, "Task 16b".

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| TabListTab (`tabListTabClassNames`) | — | `icon` | — |  |
| TreeItem (`treeItemClassNames`) | `row` (div), `indicator` (span), `label` (span), `aside` (span), `actions` (span), `group` (div) | `expandIcon`, `icon`, `iconAfter` | `collapse` | `actions` is the row's toolbar of actions; `group` the nested items' `role="group"`. |
| TreeItemPersonaLayout (`treeItemPersonaLayoutClassNames`) | `media` (span), `main` (span), `description` (span) | — | — |  |
| FlatTree (`flatTreeClassNames`) | — | — | `spacer` |  |
| FlatTreeItem (`flatTreeItemClassNames`) | `row` (div), `expandIcon` (svg), `indicator` (span), `label` (span) | — | — | FlatTree.Item is never written by hand: FlatTree declares these keys and hands them to every item (ruling AK). |
| Nav (`navClassNames`) | `list` (ul) | — | — | NavDrawer, NavDrawer.Body and NavDrawer.Footer are in D4, so the Nav list wiring is touched in two tasks. |
| NavCategory (`navCategoryClassNames`) | `button` (button), `label` (span), `list` (ul) | `icon`, `expandIcon` | `collapse` |  |
| NavItem (`navItemClassNames`) | `listItem` (li), `content` (span), `actions` (span) | `icon` | — |  |
| NavSubItem (`navSubItemClassNames`) | `listItem` (li), `actions` (span) | — | — |  |
| NavSectionHeader (`navSectionHeaderClassNames`) | `listItem` (li) | — | — |  |
| NavAppItem (`navAppItemClassNames`) | `listItem` (li), `content` (span) | `icon` | — |  |
| NavAppItemStatic (`navAppItemStaticClassNames`) | `listItem` (li), `content` (span) | `icon` | — |  |
| Hamburger (`hamburgerClassNames`) | — | `icon` | — |  |
| Breadcrumb (`breadcrumbClassNames`) | `list` (ol, or the Overflow div), `listItem` (li), `overflowButton` (button) | `divider` | — | `list` with `overflow="auto"` is the Overflow it renders. |
| BreadcrumbItem (`breadcrumbItemClassNames`) | — | `icon` | — |  |
| Pagination (`paginationClassNames`) | `list` (ol), `listItem` (li), `firstButton` (button), `previousButton` (button), `pageButton` (button), `nextButton` (button), `lastButton` (button), `ellipsis` (span) | — | — |  |
| Stepper (`stepperClassNames`) | `list` (ol) | — | — |  |
| StepperStep (`stepperStepClassNames`) | `listItem` (li), `button` (div), `indicator` (span), `label` (span), `description` (span), `connector` (div) | `icon` | — |  |
| AccordionTrigger (`accordionTriggerClassNames`) | `heading` (h1 to h6, by headingLevel), `expandIcon` (svg) | — | — | `heading` is the element around the button. |
| AccordionPanel (`accordionPanelClassNames`) | — | — | `collapse` |  |
| Overflow (`overflowClassNames`) | `overflowButton` (div) | — | — | The measured wrapper around what the `overflowButton` render prop returns. |
| ToolbarButton (`toolbarButtonClassNames`) | — | `icon` | — |  |
| ToolbarToggleButton (`toolbarToggleButtonClassNames`) | — | `icon` | — |  |
| ToolbarRadioButton (`toolbarRadioButtonClassNames`) | — | `icon` | — |  |

## D6 layout and data display (Task 17)

12 components with pending keys (30 keys): **longer than 8, split into consecutive tasks.** Nothing pending (named slots and exclusions only): `cardPreviewClassNames`, `personaClassNames`, `carouselItemClassNames`, `listClassNames`.

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| Card (`cardClassNames`) | `checkmark` (svg) | `checkbox`, `floatingAction` | — |  |
| CardHeader (`cardHeaderClassNames`) | `text` (div), `title` (div), `subtitle` (div) | `image`, `action` | — |  |
| CardPreview (`cardPreviewClassNames`) | — | `logo` | — |  |
| Avatar (`avatarClassNames`) | `visual` (span) | `image`, `icon`, `initials`, `badge` | — | `visual` is the root itself without `badge` (one element, as Input's R6). |
| AvatarGroup (`avatarGroupClassNames`) | `item` (span), `pie` (span), `surface` (div), `list` (ul), `listItem` (li) | — | `overflowButton` | `surface`, `list` and `listItem` are rendered by AvatarGroup.Popover (built in, or yours); `pie` only with `layout="pie"`. |
| AvatarGroupItem (`avatarGroupItemClassNames`) | `name` (span) | — | — |  |
| Persona (`personaClassNames`) | — | `avatar`, `badge`, `primaryText`, `secondaryText`, `tertiaryText`, `quaternaryText` | — |  |
| PresenceBadge (`presenceBadgeClassNames`) | `icon` (svg) | — | — |  |
| Carousel (`carouselClassNames`) | `autoPlayButton` (button), `track` (div), `slide` (div), `previousButton` (button), `nextButton` (button), `picker` (div), `pickerButton` (button), `pickerIndicator` (span) | — | `viewport` | `track` is the moving element (inline transform, drag handlers, roving container): lock them. |
| CarouselItem (`carouselItemClassNames`) | — | `thumbnail` | — |  |
| List (`listClassNames`) | — | — | `spacer` |  |
| ListItem (`listItemClassNames`) | `content` (span, div in a grid list), `action` (span, div in a grid list) | `checkmark` | — |  |
| Divider (`dividerClassNames`) | `line` (div), `label` (span) | — | — |  |
| Tag (`tagClassNames`) | `primaryText` (span), `secondaryText` (span), `dismissButton` (button) | `media`, `icon`, `dismissIcon` | — | `dismissButton`: the `dismissIcon` slot fills its content, and a merged `<button>` or `Button` element (documented, not deprecated) also reaches the button: the rollout states and tests which wins against `slotProps.dismissButton`. |
| InteractionTagPrimary (`interactionTagPrimaryClassNames`) | `primaryText` (span), `secondaryText` (span) | `media`, `icon` | — |  |
| InteractionTagSecondary (`interactionTagSecondaryClassNames`) | `dismissIcon` (span, or the default svg) | — | — | Its children are the glyph: the span wraps them. |

## D7 table, feedback and typography (Task 18)

9 components with pending keys (14 keys): **longer than 8, split into consecutive tasks.** Nothing pending (named slots and exclusions only): `tableClassNames`, `dataGridClassNames`, `messageBarGroupClassNames`.

| Component | Pending keys (element) | Named slots (prop) | Exclusions | Notes |
|---|---|---|---|---|
| Table (`tableClassNames`) | — | `container` (`containerProps`) | — |  |
| TableHeaderCell (`tableHeaderCellClassNames`) | `button` (button) | `sortIcon`, `aside` | — |  |
| TableSelectionCell (`tableSelectionCellClassNames`) | `control` (input) | — | — |  |
| TableCellLayout (`tableCellLayoutClassNames`) | `content` (div), `main` (span) | `media`, `description` | — |  |
| DataGrid (`dataGridClassNames`) | — | `container` (`containerProps`) | `spacer` |  |
| DataGridHeader (`dataGridHeaderClassNames`) | `selectAllCheckbox` (input) | — | `selectionCell` |  |
| DataGridHeaderCell (`dataGridHeaderCellClassNames`) | `button` (button), `resizeHandle` (div) | `sortIcon` | — | `resizeHandle` is the Table.ResizeHandle it renders with resizable columns. |
| DataGridRow (`dataGridRowClassNames`) | `selectionControl` (input) | — | `selectionCell` |  |
| MessageBar (`messageBarClassNames`) | `body` (div), `dismissButton` (button) | `icon`, `dismissIcon` (`dismiss`) | — | `dismissButton`: the `dismiss` slot fills its content; the button-object form is deprecated, but a merged `<button>` element (documented, not deprecated) also reaches the button: the rollout states and tests which wins against `slotProps.dismissButton`. |
| MessageBarGroup (`messageBarGroupClassNames`) | — | — | `item` |  |
| ProgressBar (`progressBarClassNames`) | `bar` (div), `label` (span) | — | — |  |
| Spinner (`spinnerClassNames`) | `spinner` (span), `label` (span) | — | — |  |

## Exclusions

The reasons, as `SLOT_PART_EXCLUSIONS` holds them.

| Part | Reason |
|---|---|
| `avatarGroupClassNames.overflowButton` | the root of AvatarGroup.Popover, built in or yours as a child, which takes its props directly (R3) |
| `listClassNames.spacer` | a virtual spacer: stands in for the items a windowed list does not render, sized by the window |
| `messageBarGroupClassNames.item` | a presence element: holds a bar while it enters and exits, with MessageBarGroup's `motion` slot; the bar inside takes its own props |
| `toasterClassNames.toastContent` | a motion element: the one item of a toast's container, clipped while the toast moves; the toast inside takes its own props |
| `listboxClassNames.spacer` | a virtual spacer: stands in for the options a windowed list does not render, sized by the window |
| `comboboxClassNames.spacer` | a virtual spacer: stands in for the options a windowed list does not render, sized by the window |
| `dropdownClassNames.spacer` | a virtual spacer: stands in for the options a windowed list does not render, sized by the window |
| `tagPickerClassNames.control` | the root of TagPicker.Control, which takes its props directly in the parts form (R3) |
| `tagPickerClassNames.group` | the root of TagPicker.Group, which takes its props directly in the parts form (R3) |
| `tagPickerClassNames.input` | the root of TagPicker.Input, which takes its props directly in the parts form (R3) |
| `tagPickerClassNames.listbox` | the root of TagPicker.List, which takes its props directly in the parts form (R3) |
| `swatchPickerClassNames.swatch` | the root of each ColorSwatch, ImageSwatch or EmptySwatch, which takes its props directly as your child; `items` is the shorthand (R3) |
| `ratingClassNames.star` | the root of each Rating.Item, generated from `max` or yours as children, which takes its props directly (R3) |
| `accordionPanelClassNames.collapse` | a collapse element: opens and closes the panel's space, with the panel's `motion` slot; the region inside takes your props |
| `treeItemClassNames.collapse` | a collapse element: opens and closes the space of the item's group, with Tree's `motion` slot |
| `flatTreeClassNames.spacer` | a virtual spacer: stands in for the items a windowed tree does not render, sized by the window |
| `carouselClassNames.viewport` | the clipping element around the track, measured for `groupSize="auto"` |
| `menuItemClassNames.checkmark` | Menu.Item draws no check column: the class is carried by the column of Menu.ItemCheckbox and Menu.ItemRadio, which their `checkmark` slot fills |
| `navCategoryClassNames.collapse` | a collapse element: opens and closes the space of the category's list, with Nav.Category's `motion` slot |
| `navDrawerClassNames.collapse` | a collapse element: opens and closes an inline drawer's space, with NavDrawer's `motion` slot; the panel inside is the root |
| `dialogContentClassNames.positioner` | places the surface in the viewport and lets presses through to the backdrop or the page; the surface's own margin, in `className`, sets the gap |
| `drawerClassNames.collapse` | a collapse element: opens and closes an inline drawer's space, with Drawer's `motion` slot; the panel inside is the root |
| `drawerClassNames.body` | the scrolling body takes the props of a Drawer.Body child (R3) |
| `teachingPopoverClassNames.title` | the root of TeachingPopover.Title, which takes its props directly in the children form (R3) |
| `teachingPopoverClassNames.body` | the root of TeachingPopover.Body, which takes its props directly in the children form (R3) |
| `teachingPopoverClassNames.footer` | the root of TeachingPopover.Footer or TeachingPopover.CarouselFooter, which take their props directly in the children form (R3) |
| `dataGridClassNames.spacer` | a virtual spacer row: stands in for the rows a windowed grid does not render, sized by the window |
| `dataGridHeaderClassNames.selectionCell` | the root of DataGrid.SelectionCell, which takes its props directly as your child of the header row (R3) |
| `dataGridRowClassNames.selectionCell` | the root of DataGrid.SelectionCell, which takes its props directly as your child of the row (R3); `selectionCellProps` reaches the automatic one |
