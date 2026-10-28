/**
 * Stable class names of every public component and part. A root class sits on the element that
 * receives your `className`, and a part class on each element that a prop or slot fills or that
 * draws structure (an icon, a dismiss button, a track, a surface). Style them from your own CSS,
 * or build a typed selector from a constant (`` `.${buttonClassNames.icon}` ``). This module
 * imports nothing and holds string constants only, so a React Server Component can read it.
 *
 * - **Names.** A root is `wave-` plus the kebab-cased flat export name (`Button` → `wave-button`,
 *   `CardHeader` → `wave-card-header`); a part is the root, two underscores and the kebab-cased
 *   part key (`wave-button__icon`); a constant is the camel-cased flat name plus `ClassNames`
 *   (`cardHeaderClassNames`). WaveProvider and Portal keep their existing scope classes,
 *   `wave-root` and `wave-portal`.
 * - **Placement.** A component puts its root class first in its class list, so your `className`
 *   still wins a conflict; a slot part keeps its class when a slot object renders another element
 *   (`icon={{ as: 'img', … }}`).
 * - **Variants and nesting.** A variant also carries the classes of the component it is built on
 *   (ToggleButton's root is `wave-button wave-toggle-button`, its icon
 *   `wave-button__icon wave-toggle-button__icon`), and a public component rendered inside another
 *   also carries the parent's part class (SplitButton's halves are `wave-button` plus
 *   `wave-split-button__primary-action-button` or `wave-split-button__menu-button`).
 * - **No state classes.** State lives in `data-*` attributes and ARIA (`[data-pressed]`,
 *   `[data-disabled]`, `[aria-expanded='true']`).
 * - **Stability.** Before 1.0 no class is removed; a renamed part keeps its old class next to the
 *   new one until then.
 *
 * Not to be confused with the internal `buttonClassName()` helper of `buttonStyles.ts` (one
 * letter shorter), which returns Button's utility classes.
 */

// ---------------------------------------------------------------------------
// button
// ---------------------------------------------------------------------------

/**
 * Button: `root` on the rendered element (`<button>`, or your `as`); `icon` on the icon box.
 * Style them from your own CSS (`.wave-button`, `.wave-button__icon`). State is not a class: use
 * the `data-*` attributes (`[data-pressed]`, `[data-disabled]`).
 */
export const buttonClassNames = {
  root: 'wave-button',
  icon: 'wave-button__icon',
} as const;

/**
 * CompoundButton (also carries Button's root and icon classes): `root` on the rendered element;
 * `icon` on the icon box (Button's icon span in the icon-only layout); `contentContainer` on the
 * text column; `primaryText` on the main line; `secondaryText` on the second line.
 */
export const compoundButtonClassNames = {
  root: 'wave-compound-button',
  icon: 'wave-compound-button__icon',
  contentContainer: 'wave-compound-button__content-container',
  primaryText: 'wave-compound-button__primary-text',
  secondaryText: 'wave-compound-button__secondary-text',
} as const;

/**
 * ToggleButton (also carries Button's root and icon classes): `root` on the `<button>`; `icon` on
 * Button's icon span.
 */
export const toggleButtonClassNames = {
  root: 'wave-toggle-button',
  icon: 'wave-toggle-button__icon',
} as const;

/**
 * SplitButton: `root` on the `role="group"` element; `primaryActionButton` and `menuButton` on its
 * two Buttons (which also carry Button's root); `icon` on the primary half's icon span and
 * `menuIcon` on the menu half's (both also carry Button's icon class).
 */
export const splitButtonClassNames = {
  root: 'wave-split-button',
  primaryActionButton: 'wave-split-button__primary-action-button',
  menuButton: 'wave-split-button__menu-button',
  icon: 'wave-split-button__icon',
  menuIcon: 'wave-split-button__menu-icon',
} as const;

/**
 * MenuButton (also carries Button's root and icon classes): `root` on the `<button>`; `icon` on
 * Button's icon span; `menuIcon` on the default chevron `<svg>`, or on the span of your
 * `menuIcon`.
 */
export const menuButtonClassNames = {
  root: 'wave-menu-button',
  icon: 'wave-menu-button__icon',
  menuIcon: 'wave-menu-button__menu-icon',
} as const;

/** Link: `root` on the rendered element (`<a>`, or your `as`). */
export const linkClassNames = { root: 'wave-link' } as const;

/** Toolbar: `root` on the `role="toolbar"` element (your `as`, default `<div>`). */
export const toolbarClassNames = { root: 'wave-toolbar' } as const;

/**
 * Toolbar.Button (also carries Button's root and icon classes): `root` on the rendered element;
 * `icon` on Button's icon span (the icon box of `vertical`).
 */
export const toolbarButtonClassNames = {
  root: 'wave-toolbar-button',
  icon: 'wave-toolbar-button__icon',
} as const;

/**
 * Toolbar.ToggleButton (also carries the root and icon classes of Button and ToggleButton):
 * `root` on the `<button>`; `icon` on the icon span.
 */
export const toolbarToggleButtonClassNames = {
  root: 'wave-toolbar-toggle-button',
  icon: 'wave-toolbar-toggle-button__icon',
} as const;

/**
 * Toolbar.RadioButton (also carries the root and icon classes of Button and ToggleButton):
 * `root` on the `role="radio"` button; `icon` on the icon span.
 */
export const toolbarRadioButtonClassNames = {
  root: 'wave-toolbar-radio-button',
  icon: 'wave-toolbar-radio-button__icon',
} as const;

/** Toolbar.RadioGroup: `root` on the `role="radiogroup"` element. */
export const toolbarRadioGroupClassNames = { root: 'wave-toolbar-radio-group' } as const;

/** Toolbar.Group: `root` on the group element. */
export const toolbarGroupClassNames = { root: 'wave-toolbar-group' } as const;

/** Toolbar.Divider: `root` on the `role="separator"` element. */
export const toolbarDividerClassNames = { root: 'wave-toolbar-divider' } as const;

// ---------------------------------------------------------------------------
// data-display
// ---------------------------------------------------------------------------

/**
 * Avatar: `root` on the avatar span (with `badge`, on the outer wrapper); `visual` on the circle
 * (the root without `badge`, the inner span with it); `image` on the `<img>` (or the element of
 * your `image` slot); `icon` on the `icon` slot, else on the default person `<svg>`; `initials`
 * on the initials span; `badge` on the `badge` slot.
 */
export const avatarClassNames = {
  root: 'wave-avatar',
  visual: 'wave-avatar__visual',
  image: 'wave-avatar__image',
  icon: 'wave-avatar__icon',
  initials: 'wave-avatar__initials',
  badge: 'wave-avatar__badge',
} as const;

/**
 * AvatarGroup: `root` on the `role="group"` element; `item` on the wrapper around each shown
 * member; `overflowButton` on the "+N" button; `surface` on its popup; `list` on the popup's
 * `<ul>`; `listItem` on each of its `<li>`.
 */
export const avatarGroupClassNames = {
  root: 'wave-avatar-group',
  item: 'wave-avatar-group__item',
  overflowButton: 'wave-avatar-group__overflow-button',
  pie: 'wave-avatar-group__pie',
  surface: 'wave-avatar-group__surface',
  list: 'wave-avatar-group__list',
  listItem: 'wave-avatar-group__list-item',
} as const;

/**
 * AvatarGroup.Item: `root` on the avatar it renders in the group, and on the row (avatar and name)
 * it renders in the overflow list; `name` on the name text of that row.
 */
export const avatarGroupItemClassNames = {
  root: 'wave-avatar-group-item',
  name: 'wave-avatar-group-item__name',
} as const;

/** AvatarGroup.Popover: `root` on the overflow button (which also carries the group's button class). */
export const avatarGroupPopoverClassNames = { root: 'wave-avatar-group-popover' } as const;

/** Badge: `root` on the badge span. */
export const badgeClassNames = { root: 'wave-badge' } as const;

/**
 * CounterBadge (also carries Badge's root): `root` on the badge span (a count it does not show
 * renders no element).
 */
export const counterBadgeClassNames = { root: 'wave-counter-badge' } as const;

/** PresenceBadge: `root` on the `role="img"` span; `icon` on the status glyph `<svg>`. */
export const presenceBadgeClassNames = {
  root: 'wave-presence-badge',
  icon: 'wave-presence-badge__icon',
} as const;

/**
 * Tag: `root` on the rendered element (your `as`, default `<span>`); `media` on the element of the
 * media slot; `icon` on the icon box; `primaryText` on the content span; `secondaryText` on the
 * second line of text; `dismissButton` on the Dismiss button; `dismissIcon` on the icon inside it
 * (what `dismissIcon` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const tagClassNames = {
  root: 'wave-tag',
  media: 'wave-tag__media',
  icon: 'wave-tag__icon',
  primaryText: 'wave-tag__primary-text',
  secondaryText: 'wave-tag__secondary-text',
  dismissButton: 'wave-tag__dismiss-button',
  dismissIcon: 'wave-tag__dismiss-icon',
} as const;

/** TagGroup: `root` on the group element (the toolbar or the list). */
export const tagGroupClassNames = { root: 'wave-tag-group' } as const;

/** InteractionTag: `root` on the element that holds its two buttons. */
export const interactionTagClassNames = { root: 'wave-interaction-tag' } as const;

/**
 * InteractionTag.Primary: `root` on its button; `media`, `icon`, `primaryText` and
 * `secondaryText` on the slot elements.
 */
export const interactionTagPrimaryClassNames = {
  root: 'wave-interaction-tag-primary',
  media: 'wave-interaction-tag-primary__media',
  icon: 'wave-interaction-tag-primary__icon',
  primaryText: 'wave-interaction-tag-primary__primary-text',
  secondaryText: 'wave-interaction-tag-primary__secondary-text',
} as const;

/**
 * InteractionTag.Secondary: `root` on its button; `dismissIcon` on the glyph inside it (the
 * default glyph, or the element that wraps the children).
 */
export const interactionTagSecondaryClassNames = {
  root: 'wave-interaction-tag-secondary',
  dismissIcon: 'wave-interaction-tag-secondary__dismiss-icon',
} as const;

/**
 * Persona: `root` on the persona element; `avatar` on the built-in Avatar (which also carries
 * Avatar's root and `visual` classes) or on your `avatar` slot; `badge` on the element that
 * places the badge; `primaryText` on the name; `secondaryText` on the second line.
 */
export const personaClassNames = {
  root: 'wave-persona',
  avatar: 'wave-persona__avatar',
  badge: 'wave-persona__badge',
  primaryText: 'wave-persona__primary-text',
  secondaryText: 'wave-persona__secondary-text',
  tertiaryText: 'wave-persona__tertiary-text',
  quaternaryText: 'wave-persona__quaternary-text',
} as const;

/**
 * Divider: `root` on the `<hr>` of a plain horizontal divider, else on the `role="separator"`
 * element (or your `as`); `line` on each of the two line elements of a labelled divider; `label`
 * on its label span.
 */
export const dividerClassNames = {
  root: 'wave-divider',
  line: 'wave-divider__line',
  label: 'wave-divider__label',
} as const;

/**
 * InfoButton: `root` on the `<button>`; `info` on the `role="note"` popup that shows your `info`
 * (Fluent's `info` slot, the popover surface); `beak` on its arrow.
 */
export const infoButtonClassNames = {
  root: 'wave-info-button',
  info: 'wave-info-button__info',
  beak: 'wave-info-button__beak',
} as const;

/**
 * InfoLabel: `root` on the outer span; `label` on its Label (which also carries Label's root);
 * `infoButton` on its InfoButton (which also carries InfoButton's root); `info` on the popup, the
 * InfoButton's note (which also carries InfoButton's `info`).
 */
export const infoLabelClassNames = {
  root: 'wave-info-label',
  label: 'wave-info-label__label',
  infoButton: 'wave-info-label__info-button',
  info: 'wave-info-label__info',
} as const;

/** Image: `root` on the `<img>`. */
export const imageClassNames = { root: 'wave-image' } as const;

/** List: `root` on the `<ul>` (the `role="grid"` element of a selectable list with actions). */
export const listClassNames = { root: 'wave-list' } as const;

/**
 * List.Item: `root` on the `<li>` (the `role="row"` element of a grid list); `content` on the
 * content element; `action` on the action cell; `checkmark` on the check mark element of an item
 * of a selectable list (the List's `checkmark`, or the item's own).
 */
export const listItemClassNames = {
  root: 'wave-list-item',
  content: 'wave-list-item__content',
  action: 'wave-list-item__action',
  checkmark: 'wave-list-item__checkmark',
} as const;

// ---------------------------------------------------------------------------
// feedback
// ---------------------------------------------------------------------------

/**
 * MessageBar: `root` on the bar; `icon` on the status icon span; `body` on the text column (it
 * holds `MessageBar.Title`); `dismissButton` on the Dismiss button; `dismissIcon` on the icon
 * inside it (what `dismiss` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const messageBarClassNames = {
  root: 'wave-message-bar',
  icon: 'wave-message-bar__icon',
  body: 'wave-message-bar__body',
  dismissButton: 'wave-message-bar__dismiss-button',
  dismissIcon: 'wave-message-bar__dismiss-icon',
} as const;

/** MessageBar.Title: `root` on the title span. */
export const messageBarTitleClassNames = { root: 'wave-message-bar-title' } as const;

/** MessageBar.Actions: `root` on the element that holds the actions. */
export const messageBarActionsClassNames = { root: 'wave-message-bar-actions' } as const;

/**
 * MessageBarGroup: `root` on the element that stacks the bars; `item` on the element around each
 * bar (the element its enter and exit run on).
 */
export const messageBarGroupClassNames = {
  root: 'wave-message-bar-group',
  item: 'wave-message-bar-group__item',
} as const;

/**
 * ProgressBar: `root` on the `role="progressbar"` element (the track); `bar` on the fill; `label`
 * on the label of `showLabel` (a sibling of the root).
 */
export const progressBarClassNames = {
  root: 'wave-progress-bar',
  bar: 'wave-progress-bar__bar',
  label: 'wave-progress-bar__label',
} as const;

/**
 * Spinner: `root` on the outer span; `spinner` on the ring; `label` on the label span (also while
 * only screen readers get it, without `labelVisible`).
 */
export const spinnerClassNames = {
  root: 'wave-spinner',
  spinner: 'wave-spinner__spinner',
  label: 'wave-spinner__label',
} as const;

/** Skeleton: `root` on the placeholder element. */
export const skeletonClassNames = { root: 'wave-skeleton' } as const;

/** Skeleton.Group: `root` on the group element. */
export const skeletonGroupClassNames = { root: 'wave-skeleton-group' } as const;

/**
 * Toast: `root` on the toast; `icon` on the status icon span (or your `icon` slot); `content` on
 * the text column that holds the title, body and footer; `dismissButton` on the Dismiss button.
 */
export const toastClassNames = {
  root: 'wave-toast',
  icon: 'wave-toast__icon',
  content: 'wave-toast__content',
  dismissButton: 'wave-toast__dismiss-button',
} as const;

/**
 * Toast.Title: `root` on the title row (also the one the `title` prop renders); `label` on the
 * title text, which names the toast; `action` on the `action` slot at the row's end.
 */
export const toastTitleClassNames = {
  root: 'wave-toast-title',
  label: 'wave-toast-title__label',
  action: 'wave-toast-title__action',
} as const;

/**
 * Toast.Body: `root` on the body element (also the one plain children render); `subtitle` on the
 * `subtitle` line inside it.
 */
export const toastBodyClassNames = {
  root: 'wave-toast-body',
  subtitle: 'wave-toast-body__subtitle',
} as const;

/** Toast.Footer: `root` on the row of actions. */
export const toastFooterClassNames = { root: 'wave-toast-footer' } as const;

/**
 * Toaster: `root` on the portaled toast region; `toast` on the `role="group"` container the
 * Toaster renders around each toast; `toastContent` on the element inside each container, its
 * only child, which holds the toast's status text and content (0.15).
 */
export const toasterClassNames = {
  root: 'wave-toaster',
  toast: 'wave-toaster__toast',
  toastContent: 'wave-toaster__toast-content',
} as const;

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

/**
 * Input: `root` on the `<input>`, or, with `contentBefore` or `contentAfter` content, on the
 * wrapper that draws the field; `input` on the `<input>` (also when it is the root);
 * `contentBefore` and `contentAfter` on the slot spans; `errorMessage` on the `role="alert"`
 * message after the control.
 */
export const inputClassNames = {
  root: 'wave-input',
  input: 'wave-input__input',
  contentBefore: 'wave-input__content-before',
  contentAfter: 'wave-input__content-after',
  errorMessage: 'wave-input__error-message',
} as const;

/** Textarea: `root` on the `<textarea>`; `errorMessage` on the message after it, as Input's. */
export const textareaClassNames = {
  root: 'wave-textarea',
  errorMessage: 'wave-textarea__error-message',
} as const;

/** Select: `root` on the `<select>`; `errorMessage` on the message after it, as Input's. */
export const selectClassNames = {
  root: 'wave-select',
  errorMessage: 'wave-select__error-message',
} as const;

/**
 * Field: `root` on the field element; `label` on the `<label>`; `required` on the asterisk;
 * `validationMessage` on the message; `validationMessageIcon` on its icon; `hint` on the hint.
 */
export const fieldClassNames = {
  root: 'wave-field',
  label: 'wave-field__label',
  required: 'wave-field__required',
  validationMessage: 'wave-field__validation-message',
  validationMessageIcon: 'wave-field__validation-message-icon',
  hint: 'wave-field__hint',
} as const;

/** Label: `root` on the `<label>`; `required` on the asterisk. */
export const labelClassNames = {
  root: 'wave-label',
  required: 'wave-label__required',
} as const;

/**
 * Checkbox: `root` on the `<label>`; `indicator` on the `role="checkbox"` button (the box);
 * `label` on the label text.
 */
export const checkboxClassNames = {
  root: 'wave-checkbox',
  indicator: 'wave-checkbox__indicator',
  label: 'wave-checkbox__label',
} as const;

/** RadioGroup: `root` on the `role="radiogroup"` element. */
export const radioGroupClassNames = { root: 'wave-radio-group' } as const;

/**
 * RadioGroup.Item: `root` on the `<label>` (where `className` lands; `ref` and the other props go
 * to the radio); `indicator` on the `role="radio"` button; `label` on the label text.
 */
export const radioGroupItemClassNames = {
  root: 'wave-radio-group-item',
  indicator: 'wave-radio-group-item__indicator',
  label: 'wave-radio-group-item__label',
} as const;

/**
 * Switch: `root` on the `<label>`; `track` on the `role="switch"` button; `thumb` on its thumb;
 * `label` on the label text.
 */
export const switchClassNames = {
  root: 'wave-switch',
  track: 'wave-switch__track',
  thumb: 'wave-switch__thumb',
  label: 'wave-switch__label',
} as const;

/**
 * SearchBox: `root` on the element that draws the field; `contentBefore` on the span that holds
 * the search icon or your slot; `input` on the `<input type="search">`; `contentAfter` on the span
 * that holds your slot; `dismissButton` on the clear button; `dismissIcon` on the icon inside it
 * (what `dismiss` renders, a merged Button's icon span, else the default `<svg>`).
 */
export const searchBoxClassNames = {
  root: 'wave-search-box',
  contentBefore: 'wave-search-box__content-before',
  input: 'wave-search-box__input',
  contentAfter: 'wave-search-box__content-after',
  dismissButton: 'wave-search-box__dismiss-button',
  dismissIcon: 'wave-search-box__dismiss-icon',
} as const;

/** Slider: `root` on the `<input type="range">` (its rail and thumb are pseudo-elements). */
export const sliderClassNames = { root: 'wave-slider' } as const;

/**
 * SpinButton: `root` on the outer element; `decrementButton` on the − button; `input` on the
 * `role="spinbutton"` input; `incrementButton` on the + button.
 */
export const spinButtonClassNames = {
  root: 'wave-spin-button',
  decrementButton: 'wave-spin-button__decrement-button',
  input: 'wave-spin-button__input',
  incrementButton: 'wave-spin-button__increment-button',
} as const;

/**
 * Option (also Combobox.Option, Dropdown.Option and Listbox.Option): `root` on the `role="option"`
 * element; `indicator` on the checkbox square of a multi-select list; `checkIcon` on the check
 * `<svg>`, or on the span of your `checkIcon` (inside the square in a multi-select list);
 * `content` on the content span.
 */
export const optionClassNames = {
  root: 'wave-option',
  indicator: 'wave-option__indicator',
  checkIcon: 'wave-option__check-icon',
  content: 'wave-option__content',
} as const;

/**
 * OptionGroup (also Combobox.OptionGroup, Dropdown.OptionGroup and Listbox.OptionGroup): `root`
 * on the group's entry in the list; `label` on its heading (rendered only for a `label`); `list`
 * on the `role="group"` list of its options.
 */
export const optionGroupClassNames = {
  root: 'wave-option-group',
  label: 'wave-option-group__label',
  list: 'wave-option-group__list',
} as const;

/** Listbox: `root` on the `role="listbox"` list (its options carry Option's classes). */
export const listboxClassNames = { root: 'wave-listbox' } as const;

/**
 * ListboxSurface: `root` on the portaled popup around the list, while it shows the list or the
 * empty content; `list` on the `role="listbox"` list, also while it renders in place inside your
 * picker. In Combobox, Dropdown and TagPicker these elements also carry the picker's own
 * `surface` and `listbox` classes.
 */
export const listboxSurfaceClassNames = {
  root: 'wave-listbox-surface',
  list: 'wave-listbox-surface__list',
} as const;

/**
 * Combobox: `root` on the outer element; `input` on the `role="combobox"` input; `clearButton` on
 * the clear button; `expandButton` on the expand button and `expandIcon` on its glyph; `listbox`
 * on the `role="listbox"` list; `surface` on its portaled popup; `emptyMessage` on the
 * "No matches" row.
 */
export const comboboxClassNames = {
  root: 'wave-combobox',
  input: 'wave-combobox__input',
  clearButton: 'wave-combobox__clear-button',
  expandButton: 'wave-combobox__expand-button',
  expandIcon: 'wave-combobox__expand-icon',
  listbox: 'wave-combobox__listbox',
  surface: 'wave-combobox__surface',
  emptyMessage: 'wave-combobox__empty-message',
} as const;

/**
 * Dropdown: `root` on the outer element; `button` on the `role="combobox"` button; `value` on the
 * value or placeholder span; `expandIcon` on the chevron `<svg>`; `clearButton` on the clear
 * button; `listbox` on the `role="listbox"` list; `surface` on its portaled popup.
 */
export const dropdownClassNames = {
  root: 'wave-dropdown',
  button: 'wave-dropdown__button',
  value: 'wave-dropdown__value',
  expandIcon: 'wave-dropdown__expand-icon',
  clearButton: 'wave-dropdown__clear-button',
  listbox: 'wave-dropdown__listbox',
  surface: 'wave-dropdown__surface',
} as const;

/**
 * TagPicker: `root` on the outer element; `control` on the tag area and `group` on the list of
 * tags (both deprecated, kept until 1.0 next to TagPicker.Control's and TagPicker.Group's own
 * classes); `tag` on each tag; `removeButton` on each tag's remove button; `input` on the
 * `role="combobox"` input; `expandButton` on the expand button and `expandIcon` on its glyph;
 * `clearButton` on the clear button; `listbox` on the `role="listbox"` list; `option` on each
 * Option it renders (which also carries Option's classes); `createOption` on the create option of
 * `allowCreate`; `overflowCount` on the "+N" count of the single-line layout; `surface` on the
 * portaled popup; `emptyMessage` on the "No matches" row.
 */
export const tagPickerClassNames = {
  root: 'wave-tag-picker',
  control: 'wave-tag-picker__control',
  group: 'wave-tag-picker__group',
  tag: 'wave-tag-picker__tag',
  removeButton: 'wave-tag-picker__remove-button',
  input: 'wave-tag-picker__input',
  expandButton: 'wave-tag-picker__expand-button',
  expandIcon: 'wave-tag-picker__expand-icon',
  clearButton: 'wave-tag-picker__clear-button',
  listbox: 'wave-tag-picker__listbox',
  option: 'wave-tag-picker__option',
  createOption: 'wave-tag-picker__create-option',
  overflowCount: 'wave-tag-picker__overflow-count',
  surface: 'wave-tag-picker__surface',
  emptyMessage: 'wave-tag-picker__empty-message',
} as const;

/**
 * TagPicker.Control: `root` on the field that holds the tags, the trigger and the end buttons (it
 * also carries TagPicker's `control` part).
 */
export const tagPickerControlClassNames = { root: 'wave-tag-picker-control' } as const;

/**
 * TagPicker.Group: `root` on the list of tags (also a TagGroup's root, and TagPicker's `group`
 * part).
 */
export const tagPickerGroupClassNames = { root: 'wave-tag-picker-group' } as const;

/**
 * TagPicker.Input: `root` on the `role="combobox"` input (it also carries TagPicker's `input`
 * part).
 */
export const tagPickerInputClassNames = { root: 'wave-tag-picker-input' } as const;

/** TagPicker.Button: `root` on the `role="combobox"` button. */
export const tagPickerButtonClassNames = { root: 'wave-tag-picker-button' } as const;

/**
 * TagPicker.List: `root` on the `role="listbox"` list (it also carries ListboxSurface's `list` and
 * TagPicker's `listbox` parts).
 */
export const tagPickerListClassNames = { root: 'wave-tag-picker-list' } as const;

/**
 * TagPicker.Option (an Option variant): `root` on the option; `media` on the visual before its
 * text; `secondaryContent` on its second line.
 */
export const tagPickerOptionClassNames = {
  root: 'wave-tag-picker-option',
  media: 'wave-tag-picker-option__media',
  secondaryContent: 'wave-tag-picker-option__secondary-content',
} as const;

/**
 * TimePicker: `root` on the outer element; `input` on the `role="combobox"` input; `clearButton`
 * on the clear button; `expandButton` on the expand button and `expandIcon` on its glyph;
 * `errorMessage` on the `role="alert"` message; `listbox` on the `role="listbox"` list; `option`
 * on each option; `checkIcon` on each option's check column; `surface` on the portaled popup;
 * `emptyMessage` on its status row.
 */
export const timePickerClassNames = {
  root: 'wave-time-picker',
  input: 'wave-time-picker__input',
  clearButton: 'wave-time-picker__clear-button',
  expandButton: 'wave-time-picker__expand-button',
  expandIcon: 'wave-time-picker__expand-icon',
  errorMessage: 'wave-time-picker__error-message',
  listbox: 'wave-time-picker__listbox',
  option: 'wave-time-picker__option',
  checkIcon: 'wave-time-picker__check-icon',
  surface: 'wave-time-picker__surface',
  emptyMessage: 'wave-time-picker__empty-message',
} as const;

/**
 * DatePicker: `root` on the outer element; `input` on the text input; `clearButton` on the clear
 * button; `openCalendarButton` on the calendar button; `errorMessage` on the `role="alert"`
 * message; `surface` on the portaled `role="dialog"` calendar; `header` on its month row;
 * `previousMonthButton` and `nextMonthButton` on the navigation buttons (by a month, and in the
 * month and year views by a year and a decade); `heading` on the `<h2>` (the month, year or
 * decade); `headingButton` on its button to the month and year views; `grid` on the calendar's
 * `role="grid"` element of every view; `weekday` on each weekday header cell; `weekNumberHeader`
 * on the header cell of the week-number column and `weekNumber` on each week's row header
 * (`showWeekNumbers`); `day`, `month` and `year` on each day, month and year button; `markedDot`
 * on the dot inside a marked day's button; `footer` on the row of the footer buttons
 * (`showGoToToday`, `showCloseButton`), with `todayButton` on "Go to today" and `closeButton` on
 * "Close".
 */
export const datePickerClassNames = {
  root: 'wave-date-picker',
  input: 'wave-date-picker__input',
  clearButton: 'wave-date-picker__clear-button',
  openCalendarButton: 'wave-date-picker__open-calendar-button',
  errorMessage: 'wave-date-picker__error-message',
  surface: 'wave-date-picker__surface',
  header: 'wave-date-picker__header',
  previousMonthButton: 'wave-date-picker__previous-month-button',
  heading: 'wave-date-picker__heading',
  headingButton: 'wave-date-picker__heading-button',
  nextMonthButton: 'wave-date-picker__next-month-button',
  grid: 'wave-date-picker__grid',
  weekday: 'wave-date-picker__weekday',
  weekNumberHeader: 'wave-date-picker__week-number-header',
  weekNumber: 'wave-date-picker__week-number',
  day: 'wave-date-picker__day',
  markedDot: 'wave-date-picker__marked-dot',
  month: 'wave-date-picker__month',
  year: 'wave-date-picker__year',
  footer: 'wave-date-picker__footer',
  todayButton: 'wave-date-picker__today-button',
  closeButton: 'wave-date-picker__close-button',
} as const;

/**
 * Calendar: `root` on the `role="group"` element; `header` on the row of the navigation buttons
 * and the heading; `previousButton` and `nextButton` on the navigation buttons (by a month, a
 * year or a decade); `heading` on the month, year or decade text (a `<div>`, which labels the
 * grid); `headingButton` on the heading's button to the month and year views; `grid` on the
 * `role="grid"` element of every view; `weekday` on each weekday header cell; `weekNumberHeader`
 * on the header cell of the week-number column and `weekNumber` on each week's row header
 * (`showWeekNumbers`); `day`, `month` and `year` on each day, month and year button; `markedDot`
 * on the dot inside a marked day's button; `footer` on the row of the footer buttons, with
 * `todayButton` on "Go to today" (`showGoToToday`).
 */
export const calendarClassNames = {
  root: 'wave-calendar',
  header: 'wave-calendar__header',
  previousButton: 'wave-calendar__previous-button',
  heading: 'wave-calendar__heading',
  headingButton: 'wave-calendar__heading-button',
  nextButton: 'wave-calendar__next-button',
  grid: 'wave-calendar__grid',
  weekday: 'wave-calendar__weekday',
  weekNumberHeader: 'wave-calendar__week-number-header',
  weekNumber: 'wave-calendar__week-number',
  day: 'wave-calendar__day',
  markedDot: 'wave-calendar__marked-dot',
  month: 'wave-calendar__month',
  year: 'wave-calendar__year',
  footer: 'wave-calendar__footer',
  todayButton: 'wave-calendar__today-button',
} as const;

/**
 * SwatchPicker: `root` on the picker element (`role="radiogroup"`, or `role="grid"` in the grid
 * layout); `swatch` on the button of every swatch in it (`items`, and the `ColorSwatch`,
 * `ImageSwatch` and `EmptySwatch` children, next to their own classes).
 */
export const swatchPickerClassNames = {
  root: 'wave-swatch-picker',
  swatch: 'wave-swatch-picker__swatch',
} as const;

/**
 * SwatchPicker.Row: `root` on the row element (`role="row"` in the grid layout), also on the rows
 * the picker adds around `items` and loose swatches.
 */
export const swatchPickerRowClassNames = { root: 'wave-swatch-picker-row' } as const;

/**
 * ColorSwatch (also the swatches of SwatchPicker's `items`; carries SwatchPicker's `swatch`):
 * `root` on the swatch `<button>`, where `className` lands in every layout; `icon` on the span of
 * your `icon`.
 */
export const colorSwatchClassNames = {
  root: 'wave-color-swatch',
  icon: 'wave-color-swatch__icon',
} as const;

/** ImageSwatch (carries SwatchPicker's `swatch`): `root` on the swatch `<button>`. */
export const imageSwatchClassNames = { root: 'wave-image-swatch' } as const;

/**
 * EmptySwatch (carries SwatchPicker's `swatch`): `root` on the `<button>`; `icon` on the span of
 * its glyph (the plus, or your `icon`).
 */
export const emptySwatchClassNames = {
  root: 'wave-empty-swatch',
  icon: 'wave-empty-swatch__icon',
} as const;

/**
 * ColorPicker: `root` on the `role="group"` element; `opacityLabel` on the caption and
 * `opacityValue` on the percentage of the default layout's opacity row. Its color area and
 * sliders carry their own classes (ColorArea, ColorSlider, AlphaSlider).
 */
export const colorPickerClassNames = {
  root: 'wave-color-picker',
  opacityLabel: 'wave-color-picker__opacity-label',
  opacityValue: 'wave-color-picker__opacity-value',
} as const;

/**
 * ColorPicker.HexField: `root` on the field's outer element; `label` on the caption; `input` on
 * the hex `<input>`; `errorMessage` on the error text.
 */
export const colorPickerHexFieldClassNames = {
  root: 'wave-color-picker-hex-field',
  label: 'wave-color-picker-hex-field__label',
  input: 'wave-color-picker-hex-field__input',
  errorMessage: 'wave-color-picker-hex-field__error-message',
} as const;

/**
 * ColorPicker.Swatches (also carries SwatchPicker's root): `root` on the SwatchPicker it renders;
 * its swatches keep SwatchPicker's own `swatch` class.
 */
export const colorPickerSwatchesClassNames = { root: 'wave-color-picker-swatches' } as const;

/** ColorPicker.Preview: `root` on the preview swatch. */
export const colorPickerPreviewClassNames = { root: 'wave-color-picker-preview' } as const;

/**
 * ColorArea: `root` on the `role="group"` element; `field` on the gradient layer; `thumb` on the
 * thumb (the two range inputs are not parts).
 */
export const colorAreaClassNames = {
  root: 'wave-color-area',
  field: 'wave-color-area__field',
  thumb: 'wave-color-area__thumb',
} as const;

/** ColorSlider: `root` on the slider element; `rail` on the gradient rail; `thumb` on the thumb. */
export const colorSliderClassNames = {
  root: 'wave-color-slider',
  rail: 'wave-color-slider__rail',
  thumb: 'wave-color-slider__thumb',
} as const;

/** AlphaSlider: `root` on the slider element; `rail` on the rail; `thumb` on the thumb. */
export const alphaSliderClassNames = {
  root: 'wave-alpha-slider',
  rail: 'wave-alpha-slider__rail',
  thumb: 'wave-alpha-slider__thumb',
} as const;

/**
 * Rating: `root` on the `role="radiogroup"` element; `star` on each star (a RatingItem: the
 * `role="radio"` button, or with `step={0.5}` the span around its two radios); `icon` on each
 * star glyph (the default `<svg>`, or the span of your `iconFilled`/`iconOutline`).
 */
export const ratingClassNames = {
  root: 'wave-rating',
  star: 'wave-rating__star',
  icon: 'wave-rating__icon',
} as const;

/**
 * RatingItem (also Rating.Item, RatingDisplay.Item and RatingDisplayItem): `root` on the star
 * element (the `role="radio"` button in a Rating, the span around its two radios with
 * `step={0.5}`, the star span in a RatingDisplay), which also carries its rating's `star` class;
 * `icon` on each glyph it draws (the default `<svg>`, or the span of an `iconFilled`/`iconOutline`
 * glyph), which also carries its rating's `icon` class.
 */
export const ratingItemClassNames = {
  root: 'wave-rating-item',
  icon: 'wave-rating-item__icon',
} as const;

/**
 * RatingDisplay: `root` on the `role="img"` element; `star` on each star span (a RatingItem, and
 * the one star of `compact`); `icon` on the star glyphs; `value` on the value span; `count` on the
 * count span.
 */
export const ratingDisplayClassNames = {
  root: 'wave-rating-display',
  star: 'wave-rating-display__star',
  icon: 'wave-rating-display__icon',
  value: 'wave-rating-display__value',
  count: 'wave-rating-display__count',
} as const;

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

/**
 * Card: `root` on the rendered element (your `as`, default `<div>`); `checkbox` on the built-in
 * selection checkbox; `checkmark` on the corner check `<svg>` of a selected card.
 */
export const cardClassNames = {
  root: 'wave-card',
  checkbox: 'wave-card__checkbox',
  checkmark: 'wave-card__checkmark',
  floatingAction: 'wave-card__floating-action',
} as const;

/** Card.Header: `root` on the rendered element; `title` on the title; `subtitle` on the subtitle. */
export const cardHeaderClassNames = {
  root: 'wave-card-header',
  image: 'wave-card-header__image',
  text: 'wave-card-header__text',
  title: 'wave-card-header__title',
  subtitle: 'wave-card-header__subtitle',
  action: 'wave-card-header__action',
} as const;

/** Card.Preview: `root` on the rendered element; `logo` on the logo over its bottom start corner. */
export const cardPreviewClassNames = {
  root: 'wave-card-preview',
  logo: 'wave-card-preview__logo',
} as const;

/** Card.Body: `root` on the rendered element. */
export const cardBodyClassNames = { root: 'wave-card-body' } as const;

/** Card.Footer: `root` on the rendered element. */
export const cardFooterClassNames = { root: 'wave-card-footer' } as const;

/** Accordion: `root` on the accordion element. */
export const accordionClassNames = { root: 'wave-accordion' } as const;

/** Accordion.Item: `root` on the item element. */
export const accordionItemClassNames = { root: 'wave-accordion-item' } as const;

/**
 * Accordion.Trigger: `root` on the `<button>`; `heading` on the heading element around it (`<h1>`
 * to `<h6>`, from `headingLevel`); `expandIcon` on the chevron `<svg>`.
 */
export const accordionTriggerClassNames = {
  root: 'wave-accordion-trigger',
  heading: 'wave-accordion-trigger__heading',
  expandIcon: 'wave-accordion-trigger__expand-icon',
} as const;

/**
 * Accordion.Panel: `root` on the `role="region"` element; `collapse` on the element around it
 * (the element that opens and closes the region's space, 0.15).
 */
export const accordionPanelClassNames = {
  root: 'wave-accordion-panel',
  collapse: 'wave-accordion-panel__collapse',
} as const;

/** TabList: `root` on the `role="tablist"` element. */
export const tabListClassNames = { root: 'wave-tab-list' } as const;

/** TabList.Tab: `root` on the `role="tab"` button. */
export const tabListTabClassNames = {
  root: 'wave-tab-list-tab',
  icon: 'wave-tab-list-tab__icon',
} as const;

/** TabList.Panel: `root` on the `role="tabpanel"` element. */
export const tabListPanelClassNames = { root: 'wave-tab-list-panel' } as const;

/** TabList.Panels: `root` on the element around the panels. */
export const tabListPanelsClassNames = { root: 'wave-tab-list-panels' } as const;

/** Tree: `root` on the `role="tree"` element. */
export const treeClassNames = { root: 'wave-tree' } as const;

/**
 * Tree.Item: `root` on the `role="treeitem"` element; `row` on its row; `expandIcon` on the
 * chevron (or your `expandIcon`); `indicator` on the checkbox of a multi-select tree or the radio
 * of a single-select one; `icon` on the icon span; `label` on the label span; `iconAfter` on the
 * icon after the label; `aside` on the aside content; `actions` on the row's actions toolbar;
 * `group` on the `role="group"` element of its nested items; `collapse` on the element around
 * that group (the element that opens and closes the group's space, 0.15).
 */
export const treeItemClassNames = {
  root: 'wave-tree-item',
  row: 'wave-tree-item__row',
  expandIcon: 'wave-tree-item__expand-icon',
  indicator: 'wave-tree-item__indicator',
  icon: 'wave-tree-item__icon',
  label: 'wave-tree-item__label',
  iconAfter: 'wave-tree-item__icon-after',
  aside: 'wave-tree-item__aside',
  actions: 'wave-tree-item__actions',
  group: 'wave-tree-item__group',
  collapse: 'wave-tree-item__collapse',
} as const;

/**
 * Tree.ItemPersonaLayout: `root` on the layout span; `media` on the picture; `main` on the name;
 * `description` on the description line.
 */
export const treeItemPersonaLayoutClassNames = {
  root: 'wave-tree-item-persona-layout',
  media: 'wave-tree-item-persona-layout__media',
  main: 'wave-tree-item-persona-layout__main',
  description: 'wave-tree-item-persona-layout__description',
} as const;

/**
 * Carousel: `root` on the `role="region"` element; `autoPlayButton` on the pause and start
 * button; `viewport` on the clipping element around the track; `track` on the moving element
 * around the slides; `slide` on each slide wrapper;
 * `previousButton` and `nextButton` on the arrow buttons; `picker` on the `role="group"` of
 * picker buttons; `pickerButton` on each of them; `pickerIndicator` on each button's dot.
 */
export const carouselClassNames = {
  root: 'wave-carousel',
  autoPlayButton: 'wave-carousel__auto-play-button',
  viewport: 'wave-carousel__viewport',
  track: 'wave-carousel__track',
  slide: 'wave-carousel__slide',
  previousButton: 'wave-carousel__previous-button',
  nextButton: 'wave-carousel__next-button',
  picker: 'wave-carousel__picker',
  pickerButton: 'wave-carousel__picker-button',
  pickerIndicator: 'wave-carousel__picker-indicator',
} as const;

/** Carousel.Item: `root` on the item element; `thumbnail` on the image in its picker button. */
export const carouselItemClassNames = {
  root: 'wave-carousel-item',
  thumbnail: 'wave-carousel-item__thumbnail',
} as const;

/** Carousel.Button: `root` on the button element. */
export const carouselButtonClassNames = { root: 'wave-carousel-button' } as const;

/**
 * Overflow: `root` on the overflow element; `overflowButton` on the element around what
 * `overflowButton` renders.
 */
export const overflowClassNames = {
  root: 'wave-overflow',
  overflowButton: 'wave-overflow__overflow-button',
} as const;

/** Overflow.Item: `root` on the item element. */
export const overflowItemClassNames = { root: 'wave-overflow-item' } as const;

/** Overflow.Divider: `root` on the divider element. */
export const overflowDividerClassNames = { root: 'wave-overflow-divider' } as const;

/** Stack: `root` on the rendered element. */
export const stackClassNames = { root: 'wave-stack' } as const;

/** Flex: `root` on the rendered element. */
export const flexClassNames = { root: 'wave-flex' } as const;

/** Grid: `root` on the rendered element. */
export const gridClassNames = { root: 'wave-grid' } as const;

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------

/**
 * Breadcrumb: `root` on the `<nav>`; `list` on the trail's list element (its `<ol>`, or with
 * `overflow="auto"` the Overflow's `role="list"` element); `listItem` on each `<li>`; `divider` on
 * each separator (the default chevron `<svg>`, or the `<span>` of a custom `divider`);
 * `overflowButton` on the "…" `<button>` that opens the menu of the collapsed items, with
 * `maxDisplayedItems` and with `overflow="auto"`. With `overflow="auto"` the "…" list item is the
 * Overflow's button wrapper, not an `<li>`, so it carries no `listItem` class.
 */
export const breadcrumbClassNames = {
  root: 'wave-breadcrumb',
  list: 'wave-breadcrumb__list',
  listItem: 'wave-breadcrumb__list-item',
  divider: 'wave-breadcrumb__divider',
  overflowButton: 'wave-breadcrumb__overflow-button',
} as const;

/**
 * Breadcrumb.Item: `root` on the link, button or text span it renders (or your `asChild`
 * element); `icon` on the icon span.
 */
export const breadcrumbItemClassNames = {
  root: 'wave-breadcrumb-item',
  icon: 'wave-breadcrumb-item__icon',
} as const;

/** Menu: `root` on the `role="menu"` element of a static menu (a popup menu has Menu.Popover's). */
export const menuClassNames = { root: 'wave-menu' } as const;

/**
 * Menu.Item: `root` on the `role="menuitem"` element; `checkmark` on the check column; `icon` on
 * the icon span; `content` on the label span; `shortcut` on the shortcut span;
 * `submenuIndicator` on the chevron `<svg>` of a submenu trigger.
 */
export const menuItemClassNames = {
  root: 'wave-menu-item',
  checkmark: 'wave-menu-item__checkmark',
  icon: 'wave-menu-item__icon',
  content: 'wave-menu-item__content',
  shortcut: 'wave-menu-item__shortcut',
  submenuIndicator: 'wave-menu-item__submenu-indicator',
} as const;

/**
 * Menu.ItemCheckbox (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitemcheckbox"` element; `checkmark`, `icon`, `content` and `shortcut` as on
 * Menu.Item.
 */
export const menuItemCheckboxClassNames = {
  root: 'wave-menu-item-checkbox',
  checkmark: 'wave-menu-item-checkbox__checkmark',
  icon: 'wave-menu-item-checkbox__icon',
  content: 'wave-menu-item-checkbox__content',
  shortcut: 'wave-menu-item-checkbox__shortcut',
} as const;

/**
 * Menu.ItemRadio (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitemradio"` element; `checkmark`, `icon`, `content` and `shortcut` as on Menu.Item.
 */
export const menuItemRadioClassNames = {
  root: 'wave-menu-item-radio',
  checkmark: 'wave-menu-item-radio__checkmark',
  icon: 'wave-menu-item-radio__icon',
  content: 'wave-menu-item-radio__content',
  shortcut: 'wave-menu-item-radio__shortcut',
} as const;

/**
 * Menu.ItemSwitch (also carries Menu.Item's root, `icon`, `content` and `shortcut` classes):
 * `root` on the `role="menuitemcheckbox"` element; `icon`, `content` and `shortcut` as on
 * Menu.Item; `track` on the switch; `thumb` on its thumb.
 */
export const menuItemSwitchClassNames = {
  root: 'wave-menu-item-switch',
  icon: 'wave-menu-item-switch__icon',
  content: 'wave-menu-item-switch__content',
  shortcut: 'wave-menu-item-switch__shortcut',
  track: 'wave-menu-item-switch__track',
  thumb: 'wave-menu-item-switch__thumb',
} as const;

/**
 * Menu.ItemLink (also carries Menu.Item's root and matching part classes): `root` on the
 * `role="menuitem"` link (`<a>`, or your `as`); `icon`, `content` and `shortcut` as on Menu.Item.
 */
export const menuItemLinkClassNames = {
  root: 'wave-menu-item-link',
  icon: 'wave-menu-item-link__icon',
  content: 'wave-menu-item-link__content',
  shortcut: 'wave-menu-item-link__shortcut',
} as const;

/** Menu.Divider: `root` on the `role="separator"` element. */
export const menuDividerClassNames = { root: 'wave-menu-divider' } as const;

/** Menu.Popover: `root` on the portaled `role="menu"` element. */
export const menuPopoverClassNames = { root: 'wave-menu-popover' } as const;

/** Menu.Group: `root` on the `role="group"` element. */
export const menuGroupClassNames = { root: 'wave-menu-group' } as const;

/** Menu.GroupHeader: `root` on the header element. */
export const menuGroupHeaderClassNames = { root: 'wave-menu-group-header' } as const;

/** Menu.SplitGroup: `root` on the `role="group"` element. */
export const menuSplitGroupClassNames = { root: 'wave-menu-split-group' } as const;

/** Nav: `root` on the `<nav>`; `list` on its `<ul>`. */
export const navClassNames = {
  root: 'wave-nav',
  list: 'wave-nav__list',
} as const;

/**
 * Nav.Category: `root` on its `<li>`; `button` on the toggle button; `icon` on the icon span;
 * `label` on the label span; `expandIcon` on the chevron `<svg>` (or on the span of your
 * `expandIcon`); `list` on the `<ul>` of its sub-items; `collapse` on the element around that
 * list (the element that opens and closes the list's space, 0.15).
 */
export const navCategoryClassNames = {
  root: 'wave-nav-category',
  button: 'wave-nav-category__button',
  icon: 'wave-nav-category__icon',
  label: 'wave-nav-category__label',
  expandIcon: 'wave-nav-category__expand-icon',
  list: 'wave-nav-category__list',
  collapse: 'wave-nav-category__collapse',
} as const;

/**
 * Nav.Item: `root` on the `<a>` (with `href`) or `<button>`; `listItem` on the `<li>` around it;
 * `icon` on the icon span; `content` on the label span; `actions` on the group of its `actions`.
 */
export const navItemClassNames = {
  root: 'wave-nav-item',
  listItem: 'wave-nav-item__list-item',
  icon: 'wave-nav-item__icon',
  content: 'wave-nav-item__content',
  actions: 'wave-nav-item__actions',
} as const;

/**
 * Nav.SubItem: `root` on the `<a>` or `<button>`; `listItem` on the `<li>` around it; `actions` on
 * the group of its `actions`.
 */
export const navSubItemClassNames = {
  root: 'wave-nav-sub-item',
  listItem: 'wave-nav-sub-item__list-item',
  actions: 'wave-nav-sub-item__actions',
} as const;

/** Nav.SectionHeader: `root` on the heading element; `listItem` on the list item around it. */
export const navSectionHeaderClassNames = {
  root: 'wave-nav-section-header',
  listItem: 'wave-nav-section-header__list-item',
} as const;

/** Nav.Divider: `root` on its list item (hidden from assistive technology). */
export const navDividerClassNames = { root: 'wave-nav-divider' } as const;

/**
 * Nav.AppItem: `root` on the `<a>` (with `href`) or `<button>`; `listItem` on the list item around
 * it; `icon` on the icon span; `content` on the label span.
 */
export const navAppItemClassNames = {
  root: 'wave-nav-app-item',
  listItem: 'wave-nav-app-item__list-item',
  icon: 'wave-nav-app-item__icon',
  content: 'wave-nav-app-item__content',
} as const;

/**
 * Nav.AppItemStatic: `root` on the `<div>`; `listItem` on the list item around it; `icon` on the
 * icon span; `content` on the label span.
 */
export const navAppItemStaticClassNames = {
  root: 'wave-nav-app-item-static',
  listItem: 'wave-nav-app-item-static__list-item',
  icon: 'wave-nav-app-item-static__icon',
  content: 'wave-nav-app-item-static__content',
} as const;

/**
 * NavDrawer (a Drawer variant: it also carries Drawer's root, and its backdrop Drawer's backdrop
 * class, and its collapse element Drawer's collapse class): `root` on the panel (the portaled
 * `role="dialog"` element of an overlay drawer, the panel element of an inline one); `backdrop` on
 * the backdrop of a modal overlay; `collapse` on the element around an inline drawer's panel;
 * `nav` on the navigation landmark that fills the panel.
 */
export const navDrawerClassNames = {
  root: 'wave-nav-drawer',
  backdrop: 'wave-nav-drawer__backdrop',
  collapse: 'wave-nav-drawer__collapse',
  nav: 'wave-nav-drawer__nav',
} as const;

/** NavDrawer.Header: `root` on the header row. */
export const navDrawerHeaderClassNames = { root: 'wave-nav-drawer-header' } as const;

/** NavDrawer.Body: `root` on the scrolling body; `list` on its list. */
export const navDrawerBodyClassNames = {
  root: 'wave-nav-drawer-body',
  list: 'wave-nav-drawer-body__list',
} as const;

/** NavDrawer.Footer: `root` on the footer; `list` on its list. */
export const navDrawerFooterClassNames = {
  root: 'wave-nav-drawer-footer',
  list: 'wave-nav-drawer-footer__list',
} as const;

/**
 * Hamburger (a Button variant: it also carries Button's root and icon classes): `root` on the
 * `<button>`; `icon` on the icon span.
 */
export const hamburgerClassNames = {
  root: 'wave-hamburger',
  icon: 'wave-hamburger__icon',
} as const;

/**
 * Pagination: `root` on the `<nav>`; `list` on its `<ol>`; `listItem` on each `<li>`;
 * `firstButton`, `previousButton`, `pageButton`, `nextButton` and `lastButton` on its buttons;
 * `ellipsis` on each "…" span.
 */
export const paginationClassNames = {
  root: 'wave-pagination',
  list: 'wave-pagination__list',
  listItem: 'wave-pagination__list-item',
  firstButton: 'wave-pagination__first-button',
  previousButton: 'wave-pagination__previous-button',
  pageButton: 'wave-pagination__page-button',
  nextButton: 'wave-pagination__next-button',
  lastButton: 'wave-pagination__last-button',
  ellipsis: 'wave-pagination__ellipsis',
} as const;

/** Stepper: `root` on the `role="group"` element; `list` on its `<ol>`. */
export const stepperClassNames = {
  root: 'wave-stepper',
  list: 'wave-stepper__list',
} as const;

/**
 * Stepper.Step: `root` on the step's element inside its `<li>`; `listItem` on the `<li>`; `button`
 * on the `role="button"` element; `indicator` on the circle; `icon` on the `icon` slot inside it;
 * `label` on the label; `description` on the description; `connector` on the line to the next
 * step.
 */
export const stepperStepClassNames = {
  root: 'wave-stepper-step',
  listItem: 'wave-stepper-step__list-item',
  button: 'wave-stepper-step__button',
  indicator: 'wave-stepper-step__indicator',
  icon: 'wave-stepper-step__icon',
  label: 'wave-stepper-step__label',
  description: 'wave-stepper-step__description',
  connector: 'wave-stepper-step__connector',
} as const;

// ---------------------------------------------------------------------------
// overlays
// ---------------------------------------------------------------------------

/**
 * Dialog.Content: `root` on the surface (`role="dialog"` or `"alertdialog"`, also while kept
 * mounted); `backdrop` on the backdrop behind it; `positioner` on the element that centres the
 * surface (the backdrop's sibling); `titleActions` on the area of header buttons in the top end
 * corner; `titleAction` on the element of the `titleAction` slot; `closeButton` on the built-in
 * Close button (which also carries Button's root); `body` on the scrolling body. The heading of
 * its `title` prop carries Dialog.Title's class.
 */
export const dialogContentClassNames = {
  root: 'wave-dialog-content',
  backdrop: 'wave-dialog-content__backdrop',
  positioner: 'wave-dialog-content__positioner',
  titleActions: 'wave-dialog-content__title-actions',
  titleAction: 'wave-dialog-content__title-action',
  closeButton: 'wave-dialog-content__close-button',
  body: 'wave-dialog-content__body',
} as const;

/** Dialog.Title: `root` on the `<h2>`; `action` on the element of its `action` slot. */
export const dialogTitleClassNames = {
  root: 'wave-dialog-title',
  action: 'wave-dialog-title__action',
} as const;

/** Dialog.Footer: `root` on the footer element. */
export const dialogFooterClassNames = { root: 'wave-dialog-footer' } as const;

/**
 * Popover.Content: `root` on the portaled `role="dialog"` surface; `beak` on the arrow; `title`
 * on the `<h2>` of `title`.
 */
export const popoverContentClassNames = {
  root: 'wave-popover-content',
  beak: 'wave-popover-content__beak',
  title: 'wave-popover-content__title',
} as const;

/** Tooltip: `root` on the span around your child; `content` on the portaled tooltip. */
export const tooltipClassNames = {
  root: 'wave-tooltip',
  content: 'wave-tooltip__content',
} as const;

/**
 * Drawer: `root` on the panel (the portaled `role="dialog"` element of an overlay drawer, while it
 * is open or kept mounted, or the `<aside>` of an inline one); `backdrop` on the backdrop of a
 * modal or alert overlay drawer; `collapse` on the element around an inline drawer's panel (its
 * only child), which carries the presence phases and the motion of an inline drawer; `header` on
 * the built-in header row (absent with a Drawer.Header); `titleAction` on the element of the
 * `titleAction` slot in that row; `closeButton` on every built-in Close button (which also
 * carries Button's root), in the built-in header and in each Drawer.HeaderTitle; `body` on the
 * scrolling body. The heading of its `title` prop carries Drawer.Title's class. The panel carries
 * `data-type`, `data-position` and `data-size`; the body, the header and the footer carry
 * `data-scroll-state`.
 */
export const drawerClassNames = {
  root: 'wave-drawer',
  backdrop: 'wave-drawer__backdrop',
  collapse: 'wave-drawer__collapse',
  header: 'wave-drawer__header',
  titleAction: 'wave-drawer__title-action',
  closeButton: 'wave-drawer__close-button',
  body: 'wave-drawer__body',
} as const;

/**
 * Drawer.Title: `root` on its heading (an `<h2>`, or the level `headingLevel` picks); also on the
 * heading of Drawer's `title` prop.
 */
export const drawerTitleClassNames = { root: 'wave-drawer-title' } as const;

/** Drawer.Header: `root` on the header element (it replaces the built-in header row). */
export const drawerHeaderClassNames = { root: 'wave-drawer-header' } as const;

/**
 * Drawer.HeaderTitle: `root` on the title row; `heading` on the heading that names the drawer;
 * `action` on the element of the `action` slot. Its Close button carries Drawer's `closeButton`.
 */
export const drawerHeaderTitleClassNames = {
  root: 'wave-drawer-header-title',
  heading: 'wave-drawer-header-title__heading',
  action: 'wave-drawer-header-title__action',
} as const;

/** Drawer.HeaderNavigation: `root` on the navigation element. */
export const drawerHeaderNavigationClassNames = { root: 'wave-drawer-header-navigation' } as const;

/**
 * Drawer.Body: `root` on the scrolling body while a Drawer.Body gives it its props (the body also
 * carries Drawer's `body`), or on the element of a Drawer.Body rendered inside the body.
 */
export const drawerBodyClassNames = { root: 'wave-drawer-body' } as const;

/** Drawer.Footer: `root` on the footer element. */
export const drawerFooterClassNames = { root: 'wave-drawer-footer' } as const;

/**
 * TeachingPopover: `root` on the `role="dialog"` surface (also when TeachingPopover.Surface
 * renders it); `beak` on the arrow; `closeButton`, `backButton` and `nextButton` on its buttons
 * (which also carry Button's root; `backButton` also on the first step's button that a
 * TeachingPopover.CarouselFooter's `initialStepText` names); `primaryButton` and `secondaryButton`
 * on the buttons that a `primaryAction` and a `secondaryAction` render in place of Next/Done and
 * Back; `title` on the step title (an `<h3>`, or the element of TeachingPopover.Title's `as`);
 * `body` on the step body; `footer` on the bottom row (TeachingPopover.Footer's, or
 * TeachingPopover.CarouselFooter's); `dot` on each decorative step dot.
 */
export const teachingPopoverClassNames = {
  root: 'wave-teaching-popover',
  beak: 'wave-teaching-popover__beak',
  closeButton: 'wave-teaching-popover__close-button',
  title: 'wave-teaching-popover__title',
  body: 'wave-teaching-popover__body',
  footer: 'wave-teaching-popover__footer',
  dot: 'wave-teaching-popover__dot',
  backButton: 'wave-teaching-popover__back-button',
  nextButton: 'wave-teaching-popover__next-button',
  primaryButton: 'wave-teaching-popover__primary-button',
  secondaryButton: 'wave-teaching-popover__secondary-button',
} as const;

/**
 * TeachingPopover.Surface: `root` on the `role="dialog"` surface it renders, which also carries
 * TeachingPopover's `root`; the content of the current step it shows without children carries
 * TeachingPopover's part classes.
 */
export const teachingPopoverSurfaceClassNames = { root: 'wave-teaching-popover-surface' } as const;

/**
 * TeachingPopover.Header: `root` on the header element (also the one the `steps` form renders
 * around its Close button); `icon` on the element of its `icon` slot. Its Close button carries
 * TeachingPopover's `closeButton`.
 */
export const teachingPopoverHeaderClassNames = {
  root: 'wave-teaching-popover-header',
  icon: 'wave-teaching-popover-header__icon',
} as const;

/**
 * TeachingPopover.Title: `root` on the heading (also the one the `steps` form renders), which
 * also carries TeachingPopover's `title`.
 */
export const teachingPopoverTitleClassNames = { root: 'wave-teaching-popover-title' } as const;

/**
 * TeachingPopover.Body: `root` on the body element (also the one the `steps` form renders), which
 * also carries TeachingPopover's `body`; `media` on the element of its `media` slot.
 */
export const teachingPopoverBodyClassNames = {
  root: 'wave-teaching-popover-body',
  media: 'wave-teaching-popover-body__media',
} as const;

/**
 * TeachingPopover.Footer: `root` on the footer element (also the one the `steps` form renders),
 * which also carries TeachingPopover's `footer`.
 */
export const teachingPopoverFooterClassNames = { root: 'wave-teaching-popover-footer' } as const;

/**
 * TeachingPopover.Carousel: `root` on the element that holds the step content and the carousel
 * footer.
 */
export const teachingPopoverCarouselClassNames = {
  root: 'wave-teaching-popover-carousel',
} as const;

/**
 * TeachingPopover.CarouselNav: `root` on the `role="group"` element of the step buttons; `button`
 * on each step button; `indicator` on the dot inside it.
 */
export const teachingPopoverCarouselNavClassNames = {
  root: 'wave-teaching-popover-carousel-nav',
  button: 'wave-teaching-popover-carousel-nav__button',
  indicator: 'wave-teaching-popover-carousel-nav__indicator',
} as const;

/** TeachingPopover.CarouselPageCount: `root` on the element of the visible step count. */
export const teachingPopoverCarouselPageCountClassNames = {
  root: 'wave-teaching-popover-carousel-page-count',
} as const;

/**
 * TeachingPopover.CarouselFooter: `root` on the footer element, which also carries
 * TeachingPopover's `footer`. Its buttons carry TeachingPopover's button classes, and its
 * decorative step dots TeachingPopover's `dot`.
 */
export const teachingPopoverCarouselFooterClassNames = {
  root: 'wave-teaching-popover-carousel-footer',
} as const;

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

/** Table: `root` on the `<table>`; `container` on the scroll wrapper around it. */
export const tableClassNames = {
  root: 'wave-table',
  container: 'wave-table__container',
} as const;

/** Table.Header (and the deprecated Table.Head): `root` on the `<thead>`. */
export const tableHeaderClassNames = { root: 'wave-table-header' } as const;

/**
 * Table.HeaderCell (and the deprecated Table.HeadCell): `root` on the `<th>`; `button` on the sort
 * button of a sortable header; `sortIcon` on its direction glyph (the default arrow `<svg>`, or the
 * `<span>` of a `sortIcon` slot); `aside` on the aside `<span>`, outside the button.
 */
export const tableHeaderCellClassNames = {
  root: 'wave-table-header-cell',
  button: 'wave-table-header-cell__button',
  sortIcon: 'wave-table-header-cell__sort-icon',
  aside: 'wave-table-header-cell__aside',
} as const;

/** Table.Body: `root` on the `<tbody>`. */
export const tableBodyClassNames = { root: 'wave-table-body' } as const;

/** Table.Row: `root` on the `<tr>`. */
export const tableRowClassNames = { root: 'wave-table-row' } as const;

/** Table.Cell: `root` on the `<td>`. */
export const tableCellClassNames = { root: 'wave-table-cell' } as const;

/** Table.SelectionCell: `root` on the `<td>`; `control` on its checkbox or radio. */
export const tableSelectionCellClassNames = {
  root: 'wave-table-selection-cell',
  control: 'wave-table-selection-cell__control',
} as const;

/**
 * Table.CellLayout: `root` on the layout element; `media` on the media `<span>`; `content` on the
 * column that holds the text; `main` on the main text; `description` on the description line.
 */
export const tableCellLayoutClassNames = {
  root: 'wave-table-cell-layout',
  media: 'wave-table-cell-layout__media',
  content: 'wave-table-cell-layout__content',
  main: 'wave-table-cell-layout__main',
  description: 'wave-table-cell-layout__description',
} as const;

/** Table.CellActions: `root` on the element that holds the actions. */
export const tableCellActionsClassNames = { root: 'wave-table-cell-actions' } as const;

/**
 * Table.ResizeHandle: `root` on the separator element that resizes a column (placed in the `aside`
 * of a header cell).
 */
export const tableResizeHandleClassNames = { root: 'wave-table-resize-handle' } as const;

/** DataGrid: `root` on the grid element (`role="grid"`); `container` on the wrapper around it. */
export const dataGridClassNames = {
  root: 'wave-data-grid',
  container: 'wave-data-grid__container',
} as const;

/**
 * DataGrid.Header: `root` on the `<thead>`; `selectionCell` on the selection column's cell of
 * each header row; `selectAllCheckbox` on its checkbox.
 */
export const dataGridHeaderClassNames = {
  root: 'wave-data-grid-header',
  selectionCell: 'wave-data-grid-header__selection-cell',
  selectAllCheckbox: 'wave-data-grid-header__select-all-checkbox',
} as const;

/**
 * DataGrid.HeaderCell: `root` on the `<th>`; `button` on the sort button; `sortIcon` on its
 * direction glyph (the default arrow `<svg>`, or the `<span>` of a `sortIcon` slot).
 */
export const dataGridHeaderCellClassNames = {
  root: 'wave-data-grid-header-cell',
  button: 'wave-data-grid-header-cell__button',
  sortIcon: 'wave-data-grid-header-cell__sort-icon',
} as const;

/** DataGrid.Body: `root` on the `<tbody>`. */
export const dataGridBodyClassNames = { root: 'wave-data-grid-body' } as const;

/**
 * DataGrid.Row: `root` on the `<tr>`; `selectionCell` on its selection cell; `selectionControl`
 * on the checkbox or radio in it.
 */
export const dataGridRowClassNames = {
  root: 'wave-data-grid-row',
  selectionCell: 'wave-data-grid-row__selection-cell',
  selectionControl: 'wave-data-grid-row__selection-control',
} as const;

/** DataGrid.Cell: `root` on the `role="gridcell"` cell. */
export const dataGridCellClassNames = { root: 'wave-data-grid-cell' } as const;

/**
 * DataGrid.SelectionCell: `root` on the cell, which also carries the selection cell part of its
 * row (`dataGridRowClassNames.selectionCell`) or header (`dataGridHeaderClassNames.selectionCell`);
 * its control carries `dataGridRowClassNames.selectionControl` or
 * `dataGridHeaderClassNames.selectAllCheckbox`.
 */
export const dataGridSelectionCellClassNames = { root: 'wave-data-grid-selection-cell' } as const;

// ---------------------------------------------------------------------------
// typography, provider, portal
// ---------------------------------------------------------------------------

/** Text: `root` on the rendered element (your `as`, default `<span>`). */
export const textClassNames = { root: 'wave-text' } as const;

/** WaveProvider: `root` on the themed element (the existing `wave-root` scope class). */
export const waveProviderClassNames = { root: 'wave-root' } as const;

/**
 * Portal: `root` on the portal wrapper (the existing `wave-portal` scope class; the wrapper also
 * takes your `className`).
 */
export const portalClassNames = { root: 'wave-portal' } as const;
