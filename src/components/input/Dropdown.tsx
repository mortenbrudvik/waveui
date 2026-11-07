import * as React from 'react';
import { dropdownClassNames } from '../../lib/classNames';
import { wcn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnOnce } from '../../lib/dev';
import { ChevronDownIcon, DismissIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { mergeSlotProps, ROVING_PART_LOCKS, type SlotPart } from '../../lib/slotProps';
import {
  disabledStyles,
  focusRing,
  inputAppearanceClasses,
  inputFocus,
  inputHeightClasses,
  inputInvalid,
  inputPaddingClasses,
  inputTextClasses,
} from '../../lib/styles';
import type {
  CoreSize,
  InputAppearance,
  MotionSlot,
  PopupPositioningOptions,
} from '../../lib/types';
import { useControllable } from '../../hooks/useControllable';
import { useEventCallback } from '../../hooks/useEventCallback';
import { fieldLocks, useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import {
  collectOptionLabels,
  preventMouseDown,
  useListbox,
  type ListboxItem,
} from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import type { VirtualWindow } from '../../hooks/useVirtualWindow';
import { unwrapButtonGlyph } from '../button/Button.slots';
import { HiddenInput } from '../internal/HiddenInput';
import { showsExpandButton } from './Combobox.expand';
import { PickerClearButton } from './PickerClearButton';
import { useInputLook } from './inputLook';
import { isInvalidLook } from './Input';
import {
  Option,
  OptionGroup,
  PickerListboxSurface,
  useListboxPopup,
  type ListboxGroupRenderState,
  type ListboxOptionRenderState,
} from './Option';
import {
  renderListboxItems,
  renderListboxWindow,
  scrollWindowToItem,
  useDataModeWarnings,
  useItemsAndChildrenWarning,
  useShownListScroll,
} from './Option.data';
import { announceToggle, defaultSelectionLabel, PickerAnnouncer } from './pickerLabels';
import {
  pickerButtonOffset,
  pickerEndPadding,
  pickerGlyphSize,
  pickerIconButtonClasses,
} from './pickerStyles';
import { EMPTY_VALUES, resetValues, toggleValue, toValues } from './pickerValues';
import type { RoutedHandlers } from './routedHandlers';
import { useAppClassName } from '../../hooks/useAppClassName';

/* ------------------------------------------------------------------ */
/*  Dropdown                                                          */
/* ------------------------------------------------------------------ */

/**
 * The Dropdown's built-in texts, for localization. Each member is optional and falls back to its
 * English default.
 */
export interface DropdownLabels {
  /** Name of the clear button (`clearable`).
   * @default 'Clear selection'
   */
  clear?: string;
  /**
   * The text of the selected labels shown in the combobox with `multiselect`, in selection order;
   * values without an option are left out. Replaces the button's joined value text.
   * @default (labels) => labels.join(', ')
   */
  selection?: (labels: string[]) => string;
  /**
   * Announced when a `multiselect` toggle selects an option; `count` is the number of values
   * selected after the change.
   * @default (label, count) => `${label} added, ${count} selected`
   */
  added?: (label: string, count: number) => string;
  /**
   * Announced when a `multiselect` toggle deselects an option; `count` is the number of values
   * selected after the change.
   * @default (label, count) => `${label} removed, ${count} selected`
   */
  removed?: (label: string, count: number) => string;
}

/** Properties for the Dropdown component. */
export interface DropdownProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /**
   * Several options can be selected (Fluent's `multiselect`): the value is an array, options show
   * a checkbox, Enter and Space toggle the highlighted option, a click toggles the clicked
   * option, the list stays open, and each toggle is announced. A non-literal `multiselect={flag}`
   * is a type error: render two elements, one for each mode.
   * @default false
   */
  multiselect?: M;
  /**
   * Controlled selected value (`''` for none), or with `multiselect` the selected values (Fluent's
   * `selectedOptions`).
   */
  value?: M extends true ? readonly string[] : string;
  /**
   * Initial selected value for uncontrolled usage.
   * @default '' (`[]` with `multiselect`)
   */
  defaultValue?: M extends true ? readonly string[] : string;
  /**
   * Called with the new value when it changes (a new array with `multiselect`; Fluent's
   * `onOptionSelect`, under WaveUI's value/onValueChange naming).
   */
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  /**
   * Controlled open state of the listbox. The list renders only in the browser: an open dropdown
   * is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage. A dropdown that starts disabled starts closed. The
   * list renders only in the browser: it is closed in the server HTML and opens once the dropdown
   * has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the listbox opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called after the active (highlighted) option changes — opening, arrow keys, typeahead, the
   * pointer — and with `null` when the list closes. It reports what `aria-activedescendant` points
   * at, from an effect once the change commits. Fluent's `onActiveOptionChange` reports neither the
   * pointer (its options have no hover highlight) nor the close.
   */
  onActiveOptionChange?: (value: string | null) => void;
  /**
   * Keeps disabled options in the arrow-key, Home/End, PageUp/PageDown and typeahead order (the
   * highlighted-by-default option may then be a disabled one too); they still cannot be selected
   * (Enter, Space and a click do nothing and the list stays open), and in single-select mode,
   * reaching one with Tab or Alt+ArrowUp closes the list without selecting it. Unlike Fluent,
   * which always keeps disabled options reachable, WaveUI skips them by default.
   * @default false
   */
  disabledOptionsFocusable?: boolean;
  /**
   * Placeholder text shown when no value is selected. It is not an accessible name: label the
   * Dropdown with a `Field`, `aria-label` or `aria-labelledby`.
   * @default 'Select an option'
   */
  placeholder?: string;
  /**
   * Renders the button's content while a value is selected (the placeholder shows otherwise), in
   * place of the selected label (`labels.selection` with `multiselect`). It receives the raw
   * value(s), never a label; the content must be non-interactive, and its text is the combobox's
   * value, so image-only content leaves the value empty.
   * @default the selected label (`labels.selection` with `multiselect`)
   */
  renderValue?: M extends true
    ? (value: string[]) => React.ReactNode
    : (value: string) => React.ReactNode;
  /**
   * Whether the dropdown is disabled and non-interactive. Turning it on while the listbox is open
   * closes it (`onOpenChange(false)`).
   * @default false
   */
  disabled?: boolean;
  /**
   * Size of the field: `small` (24px tall), `medium` (32px) or `large` (40px). Default: the
   * surrounding Field's `size`, else `WaveProvider inputDefaults.size`, else `'medium'`. The
   * listbox keeps its size; the multi-select value text and clear button follow it.
   */
  size?: CoreSize;
  /**
   * Advanced positioning of the popup (Fluent's `positioning`): `offset`, `fitViewport`,
   * `matchReferenceWidth` and `fallbackPlacements` (tried in order when the requested side has no
   * room). The popup opens below the field.
   * @default `{ matchReferenceWidth: true, fitViewport: true }`
   */
  positioning?: PopupPositioningOptions;
  /**
   * The popup surface's motion. By default it fades in and slides 4px away from the dropdown button, on the
   * side it opened on, over 200 ms with a decelerating curve, and fades out and slides back over
   * 100 ms with an accelerating curve (the list stays in the surface while it exits); under
   * reduced motion it appears and disappears at once. The list does not fade out when its options
   * changed as it closed (a filter reset by the selection), nor does the "No matches" row. `null`
   * turns the motion off (the surface still renders its `data-presence` phases, which then end at
   * once); a class string or `{ className }` replaces the default classes with yours (see
   * `MotionSlot`), also under a `WaveProvider` with `motion="none"`, which otherwise turns the
   * default off. Fluent's popup `surfaceMotion`.
   * @default the fade and slide above
   */
  motion?: MotionSlot | null;
  /**
   * Look of the field: `outline` (a full border), `underline` (a bottom stroke only),
   * `filled-darker` or `filled-lighter` (a fill without a visible stroke: give the field a visible
   * label). Default: `WaveProvider inputDefaults.appearance`, else `'outline'`.
   */
  appearance?: InputAppearance;
  /**
   * Name of the value in form submissions (renders a hidden input; one per value with
   * `multiselect`).
   */
  name?: string;
  /** Id of the form the value belongs to, when the Dropdown is outside it. */
  form?: string;
  /** A value is required to submit the form (native constraint validation). */
  required?: boolean;
  /**
   * Shows a clear button while a value is selected (shown disabled while `disabled`). It clears
   * the value (every value with `multiselect`), closes the list and moves focus to the combobox
   * button. It is a tab stop after it.
   * @default false
   */
  clearable?: boolean;
  /**
   * The glyph at the end of the button (default: a chevron). `null` or `undefined` keep it;
   * `false`, or a value that renders nothing, hides it (the button's end padding follows,
   * together with `clearable`). The default chevron's size and the glyph's offset follow
   * `size`. Decorative content rendered inside the button: a `<button>` or `Button` passed
   * here is not nested (its children become the glyph, with a development warning).
   */
  expandIcon?: Slot<'span'>;
  /**
   * The clear button's name and, with `multiselect`, the selected-labels text and the toggle
   * announcements, for localization. Unset members keep their English defaults.
   */
  labels?: DropdownLabels;
  /**
   * Data mode: the options as data, in list order (`value`, `label`, and optionally `textValue`,
   * `disabled`, `hidden` and `group`; values unique). Adjacent items with the same `group` are
   * drawn as a named group under a header (`renderGroup`), the options of the group counting
   * `aria-posinset` and `aria-setsize` among themselves. The open list renders one option per item that is
   * not `hidden` (see `renderOption`); the closed list renders none. The keys, typeahead, the
   * selection and the button's label text follow `items`, also for a selected item whose option
   * is not rendered. The children are neither read nor rendered: passing both warns once in
   * development. Each option gets `aria-posinset` and `aria-setsize` from its place among the
   * shown items, and keeps one id per value. Without it, the options are the `Option` children.
   */
  items?: readonly ListboxItem[];
  /**
   * Data mode: renders the option of an item, given its state (`selected`, `active`, and `index`
   * among the shown options). Return an `Option`, or an option component of your own on
   * `useListboxOption`, with the item's `value` (and its `disabled`); its position is set for you,
   * and in a windowed list (`virtualWindow`) its height. It is called again only when the item, its
   * state, its position (`aria-posinset` and `aria-setsize`, which new `items` change) or the
   * function itself changes, so pass a stable function in a long list. Ignored without `items`,
   * with a development warning.
   * @default an `Option` with the item's `value`, `label` (also its text), `textValue` and `disabled`
   */
  renderOption?: (item: ListboxItem, state: ListboxOptionRenderState) => React.ReactNode;
  /**
   * Data mode: renders the header of a group of `items` (those with the same `group`, next to
   * each other), given the group's name and its state (`index` among the groups, `size`: its
   * shown options). Return text or a few inline elements: the header is a row of the list, not an
   * option, so nothing in it is reachable, and it is out of the accessibility tree (`aria-hidden`):
   * the group's list is named by its name. In a list with a `virtualWindow` the header is a row of
   * the window (as tall as an option, or measured with `measureItems`) and is not sticky: it
   * scrolls away with its group. It is called again when the group's name, index or size changes
   * or the function itself changes. Ignored without `items`, with a development warning.
   * @default the group's name, as text
   */
  renderGroup?: (group: string, state: ListboxGroupRenderState) => React.ReactNode;
  /**
   * Data mode: renders only the options in view of a long list, plus an overscan, and spacers
   * (`aria-hidden`, `data-virtual-spacer`) as tall as the options they stand for: pass the result
   * of `useVirtualWindow({ itemSize })`, or an object of your own that implements `VirtualWindow`.
   * It needs `items`: without them, or beside `OptionGroup` children, it is ignored with a
   * development warning (a window cannot read the options of children). Items with a `group`
   * are windowed with their headers, which are rows of the window (`itemSize` tall, or measured
   * with `measureItems`) and scroll away with their group: they are not sticky.
   *
   * The open popup's list is the window's scroller, so it needs no height of yours: it scrolls
   * within its own maximum height (15rem, 240 pixels at the default root size, less where the
   * viewport has no room). Every option is exactly `itemSize` tall (the list sets its height,
   * after the option's own `style`), so an option's content must fit in it: the default `Option`
   * with one line of text is 32 pixels tall. With a window that measures its rows (`useVirtualWindow({ itemSize, measureItems: true })`, `itemSize` being the estimate) an option has the height of its content instead, and carries the window's `itemProps`.
   *
   * The window counts the shown options (the items that are not `hidden`). The keys and typeahead
   * move over all of them (Home and End to the first and the last, PageUp and PageDown by ten); the
   * active option stays rendered while it is scrolled away, so `aria-activedescendant` always names
   * an element, and when a key makes it active the list and the window move to it in the same
   * update. Opening the list scrolls the active option (the selected one, by default) to the
   * middle of the list, and again once the popup's positioning has given the list its height (a
   * short viewport) unless it was scrolled first. A closed list renders no option. The browser's
   * scroll anchoring is off on a windowed list (the window lays the options out).
   */
  virtualWindow?: VirtualWindow;
  /** Called when the `<button role="combobox">` receives focus (the root keeps other handlers). */
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  /** Called when the `<button role="combobox">` loses focus. */
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  /**
   * Called on a key press on the `<button role="combobox">`, before the built-in listbox keys;
   * `event.preventDefault()` skips them.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
  /** Called when a key is released on the `<button role="combobox">`. */
  onKeyUp?: React.KeyboardEventHandler<HTMLButtonElement>;
  /**
   * Ref to the `<button role="combobox">`, the focusable control (Fluent UI's `ref`, on its
   * primary element). The root `<div>` is `slotProps.root.ref`.
   */
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Props for the elements the Dropdown draws, by part, merged into each part's own (Fluent UI's
   * `root`, `button`, `clearButton` and `listbox` slot props): your classes after the part's
   * (yours win a conflict), your styles over its styles, your handlers before its handlers
   * (`preventDefault()` in yours skips the Dropdown's handling of the event, its own `on…` prop
   * included), your ref beside its ref, and your ids added to its `aria-labelledby` and
   * `aria-describedby`. Every attribute the Dropdown sets on a part is locked and keeps the
   * Dropdown's value (set it through its own props); you add the attributes it does not set. A
   * part takes no `children`. The options are `Option`s, which take their own props.
   */
  slotProps?: {
    /**
     * The root `<div>` around the combobox button and the clear button (stable class
     * `wave-dropdown`), which the Dropdown's `className`, `style`, `data-*` and other root props
     * reach as well; its `ref` is the way to the root, since the Dropdown's `ref` reaches the
     * button. Your classes come after the Dropdown's `className`, your style over its `style`.
     * Locked: every prop you give the Dropdown itself that reaches the root, `data-size`,
     * `data-appearance`, and `hidden`, `inert` and `aria-hidden` (the Dropdown's own: the root
     * holds the button). Also locked, unset: `role`, `tabIndex` and the roving markers
     * (`data-roving-container`, `data-roving-disabled`, `data-roving-value`, `aria-disabled`), so
     * in a toolbar or another roving container the root is never a control of its own and never
     * hides the control from the arrow order. Your handlers run before the Dropdown's own root
     * handlers (`preventDefault()` in yours skips them). The root passes no click to the button, so
     * your `onClick` is called in every state, as the Dropdown's own `onClick` is. Your ref joins
     * the Dropdown's own, which keeps a press inside the root from dismissing the open list.
     */
    root?: SlotPart<'div'>;
    /**
     * The `<button role="combobox">`, the focusable control (stable class
     * `wave-dropdown__button`; the Dropdown's `ref` reaches it as well). Locked: `type`, `role`,
     * `id`, the naming, Field and listbox wiring (`aria-label`, `aria-invalid`, `aria-required`,
     * `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-haspopup`,
     * `aria-autocomplete`, `aria-errormessage`, `aria-details`), `disabled`, `tabIndex`,
     * `autoFocus`, `name`, `form` and `required` (the value is submitted by the Dropdown's
     * hidden input), `hidden`, `inert` and `aria-hidden` (a focusable control is never hidden).
     * Your handlers run before the Dropdown's: `preventDefault()` in your `onClick` keeps the
     * list as it is, in your `onKeyDown` skips the listbox keys, in your `onPointerDown` keeps
     * the press from focusing the button (WebKit does not focus a clicked `<button>`, so the
     * Dropdown does, with the primary button, and the keys work after a mouse click).
     */
    button?: SlotPart<'button'>;
    /**
     * The `<span>` in the button that shows the selected label(s), `renderValue`'s content or the
     * placeholder (stable class `wave-dropdown__value`). Your `onClick` is not called while the
     * Dropdown is `disabled`, as the button's own is not.
     */
    value?: SlotPart<'span'>;
    /**
     * The clear `<button>`, rendered with `clearable` while a value is selected (stable class
     * `wave-dropdown__clear-button`). Locked: `type`, `aria-label` (`labels.clear`), `disabled`,
     * `tabIndex`, `aria-disabled`, `hidden`, `inert` and `aria-hidden`. Your `onClick` runs
     * before the clear (`preventDefault()` skips it).
     */
    clearButton?: SlotPart<'button'>;
    /**
     * The `<ul role="listbox">`, in the popup while it shows and hidden in place otherwise
     * (stable class `wave-dropdown__listbox`). Locked: `id`, `role`, `tabIndex`, `hidden`,
     * `inert`, `aria-hidden`, `aria-multiselectable`, `aria-activedescendant` and `aria-label`;
     * your `aria-labelledby` ids join the list's name.
     */
    listbox?: SlotPart<'ul'>;
    /**
     * The popup `<div>` around the list, rendered in a portal while it shows (stable class
     * `wave-dropdown__surface`). Locked: `data-side`, `data-align`, `data-state`,
     * `data-presence`, `inert` while it exits, `role`, `id`, `hidden` and `aria-hidden`; your `style` merges, but the position, the size limits and the
     * visibility the positioning sets win.
     */
    surface?: SlotPart<'div'>;
  };
}

/** The Dropdown component's type: a multi-select signature, then the single-select one. */
export interface DropdownComponent {
  (props: DropdownProps<true> & { multiselect: true }): React.ReactNode;
  (props: DropdownProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}

/** The labels read from the children in data mode, where none are read. */
const NO_LABELS: ReadonlyMap<string, string> = new Map<string, string>();

/** The handlers the value part drops while the Dropdown is disabled: it does not open then. */
const BLOCK_CLICK = ['onClick'] as const;

const DropdownRoot = (props: DropdownProps<boolean>) => {
  const appClassName = useAppClassName(dropdownClassNames.root);

  const {
    multiselect = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    open: openProp,
    defaultOpen,
    onOpenChange,
    onActiveOptionChange,
    disabledOptionsFocusable = false,
    placeholder = 'Select an option',
    renderValue,
    disabled = false,
    size: sizeProp,
    positioning,
    motion,
    appearance: appearanceProp,
    name,
    form,
    required,
    clearable = false,
    expandIcon,
    labels,
    items,
    renderOption,
    renderGroup,
    virtualWindow,
    autoFocus,
    tabIndex,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
    'aria-errormessage': ariaErrorMessage,
    'aria-details': ariaDetails,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    className,
    style,
    children,
    ref,
    slotProps,
    ...rest
  } = props;

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required matches
    // `isRequired`.
    'aria-required': ariaRequired ?? required,
  });
  // The error look follows the resolved state: the consumer's `aria-invalid` or the Field's.
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);
  const { size, appearance } = useInputLook(sizeProp, appearanceProp);

  const [value, setValue] = useControllable<string | readonly string[]>(
    valueProp,
    defaultValue ?? (multiselect ? EMPTY_VALUES : ''),
    (next) => {
      // The two call signatures make `onValueChange` a union of incompatible functions from here:
      // the root itself is written against the wider, internal shape (D9).
      (onValueChange as ((value: string | string[]) => void) | undefined)?.(
        typeof next === 'string' ? next : [...next],
      );
    },
  );
  // Normalised for the listbox, the display text and the clear/reset logic: a single value is its
  // own one-element array, and a `value` passed as `null`/`undefined` from JavaScript (bypassing
  // the type system) is none rather than a crash, as 0.7 did for the single-select string.
  const values = toValues(value);

  // A dropdown that starts disabled never shows its list, so it starts closed (no close to report
  // later).
  const [openState, setOpen] = useControllable(
    openProp,
    (defaultOpen ?? false) && !disabled,
    onOpenChange,
  );
  const open = openState && !disabled;
  // Disabling also closes the list itself, not only the derived `open`, so enabling it again does
  // not reopen it without a user action. The close is reported through onOpenChange (a consumer
  // callback from an effect, C-HOOKS); a controlled `open` that stays true is not shown meanwhile.
  const lockedOpen = disabled && openState;
  React.useEffect(() => {
    if (lockedOpen) setOpen(false);
  }, [lockedOpen, setOpen]);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);

  // Data mode reads every label from `items` (listbox.getItem), so the children are not walked.
  const dataMode = items !== undefined;
  const optionLabels = React.useMemo<ReadonlyMap<string, string>>(
    () => (dataMode ? NO_LABELS : collectOptionLabels(children)),
    [dataMode, children],
  );
  useItemsAndChildrenWarning('Dropdown', items, children);
  useDataModeWarnings('Dropdown', { items, renderOption, renderGroup, virtualWindow, children });
  // A window renders data mode only.
  const activeWindow = dataMode ? virtualWindow : undefined;

  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    multiselect,
    disabledOptionsFocusable,
    items,
    selectedValues: values,
    onSelect: (next, details) => {
      if (!multiselect) {
        setValue(next);
        return;
      }
      const { values: updated, added } = toggleValue(values, next);
      setValue(updated);
      // The committed option's label: the item useListbox passed in `details` (its own result,
      // `listbox`, cannot be read from inside the options object passed to it), else the label
      // read from `children` before the option registered, else the raw value. Announces a
      // toggle the user made (D41): never a controlled change, a clear or a form reset, none of
      // which reach this callback.
      announceToggle(
        labels,
        details.item.label ?? optionLabels.get(next) ?? next,
        added,
        updated.length,
      );
    },
    onActiveValueChange: onActiveOptionChange,
    // An active option that the window does not render (an adapter that keeps nothing): scrolled
    // to by its index among the shown options, the window's count.
    onScrollToItem: activeWindow
      ? (index, target) => scrollWindowToItem(activeWindow, index, target)
      : undefined,
    idPrefix: 'dropdown-listbox',
  });

  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    positioning,
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: buttonRef,
  });

  // The root part's ref joins the root's own (the popup's dismissal reads it) through a merged ref
  // set after the part's props, so an inline part ref never detaches the root's own.
  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, slotProps?.root?.ref);
  // The consumer's `ref` joins the button's own, the popup's positioning reference included: an
  // inline `ref` that changes on every render is swapped alone, and the reference stays attached.
  const buttonMergedRef = useMergedRefs<HTMLButtonElement>(
    buttonRef,
    ref,
    setReference,
    slotProps?.button?.ref,
  );
  // The window scrolls the shown list only, which mounts with the popup (C-POPUPS: the window
  // holds it in state); the closed list in place is another, hidden element.
  const listScrollRef = useMergedRefs<HTMLUListElement>(
    expanded ? activeWindow?.scrollRef : undefined,
  );
  useShownListScroll(expanded, activeWindow, listbox.items, listbox.activeValue, values);

  useFormReset(
    buttonRef,
    () => {
      if (!multiselect) {
        setValue(defaultValue ?? '');
        return;
      }
      // Compared by content (C-FORMS), so a reset that keeps the same values reports nothing.
      setValue((current) => resetValues(current, defaultValue));
    },
    form,
  );

  const labelOf = (v: string) => listbox.getItem(v)?.label ?? optionLabels.get(v);
  const shownLabels = values.map(labelOf).filter((label): label is string => label !== undefined);
  const displayText = multiselect
    ? shownLabels.length > 0
      ? (labels?.selection ?? defaultSelectionLabel)(shownLabels)
      : ''
    : (shownLabels[0] ?? '');

  // D15: the optional-indicator rule (Phase 1 D21) shared with Combobox's expand button, and the
  // glyph slot rule shared with SplitButton, MenuButton `menuIcon` and Combobox/TimePicker
  // `expandIcon` (C-SLOTS).
  const showExpand = showsExpandButton(expandIcon);
  const { glyph: expandGlyph, button: expandIconButton } = unwrapButtonGlyph(expandIcon);
  React.useEffect(() => {
    if (expandIconButton) {
      warnOnce(
        'Dropdown:expandIcon-button',
        `Dropdown: \`expandIcon\` received ${expandIconButton}; its children render as the ` +
          'glyph of the combobox button and its props were dropped (buttons cannot be nested). ' +
          'Pass icon content instead, e.g. `expandIcon={<MyIcon />}`.',
      );
    }
  }, [expandIconButton]);

  // D15: `renderValue` replaces the button's content while a value is selected, given the raw
  // value(s) — never a label — so it is called only while `values` holds any (never for `''`/
  // `[]`); without it, the selected label(s) computed above show as in 0.7.
  const hasValue = values.length > 0;
  const showValue = renderValue ? hasValue : displayText !== '';
  const valueNode = !hasValue
    ? undefined
    : renderValue
      ? (renderValue as (value: string | string[]) => React.ReactNode)(
          multiselect ? [...values] : (values[0] ?? ''),
        )
      : displayText;

  // WebKit (Safari) does not focus a `<button>` that a mouse press clicks, so the opened list would
  // have no keyboard focus (Home, End, PageDown and typeahead do nothing): the press focuses it,
  // as Chromium and Firefox do on mousedown. A programmatic focus after a pointer press shows no
  // focus ring.
  const focusOnPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const button = event.currentTarget;
    if (button.ownerDocument.activeElement !== button) button.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open && !expanded && !event.nativeEvent.isComposing) {
      // Open with nothing shown (no options): close, but leave Escape to an enclosing layer
      // (overlays#1) instead of consuming it for an invisible list.
      setOpen(false);
      return;
    }
    listbox.onKeyDown(event);
  };

  // The button disappears with the value, so focus moves to the combobox explicitly (C-DISABLED).
  // An event callback, so the part props merged during render hold no function that reads a ref.
  const handleClear = useEventCallback(() => {
    setValue(multiselect ? EMPTY_VALUES : '');
    setOpen(false);
    buttonRef.current?.focus();
  });

  const showClear = clearable && hasValue;
  // The expand glyph's inline-end offset per size (P4-01), shared by the chevron and a consumer
  // glyph.
  const expandOffset = size === 'small' ? 'wave:end-2' : 'wave:end-3';

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  // What every option of data mode is drawn from, besides its item.
  const optionsState = {
    selected: new Set(values),
    activeValue: listbox.activeValue,
    renderOption,
    renderGroup,
  };

  const rootProps = mergeSlotProps(slotProps?.root, {
    className: wcn(
      dropdownClassNames.root,
      'wave:relative wave:inline-flex wave:flex-col',
      appClassName,
      className,
    ),
    style,
    locked: {
      'data-size': size,
      'data-appearance': appearance,
      // In a toolbar or another roving container the root holds a control of its arrow order: a
      // part makes it no composite that hides the control, no item and no second tab stop.
      ...ROVING_PART_LOCKS,
      // The Dropdown's own root props, after the data attributes as in 0.18, and over the part's;
      // the root holds the button, so only they hide it or take it out of reach.
      ...rest,
      hidden: rest.hidden,
      inert: rest.inert,
      'aria-hidden': rest['aria-hidden'],
    },
  });

  return (
    <div {...rootProps} ref={rootMergedRef}>
      {multiselect && <PickerAnnouncer />}
      <div className="wave:relative wave:flex wave:items-center">
        <button
          // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot change it).
          type="button"
          {...mergeSlotProps(slotProps?.button, {
            className: wcn(
              dropdownClassNames.button,
              // Every padding is set here (C-NATIVE), not left to an app-wide `button` rule. The
              // end padding keeps the text clear of the chevron (and of the clear button while it
              // shows).
              'wave:relative wave:flex wave:w-full wave:items-center wave:justify-between wave:py-0 wave:text-start',
              inputHeightClasses[size],
              inputPaddingClasses[size],
              inputTextClasses[size],
              inputAppearanceClasses[appearance],
              'wave:text-foreground',
              pickerEndPadding(Number(showClear) + Number(showExpand), size),
              inputFocus,
              disabledStyles,
              invalidLook && inputInvalid,
            ),
            locked: {
              type: 'button',
              ...fieldProps,
              // The routed naming and Field attributes, set only through the Dropdown's own props.
              ...fieldLocks(fieldProps),
              // The combobox props carry these only while set (an active option, an editable
              // combobox): a part sets neither.
              'aria-activedescendant': undefined,
              'aria-autocomplete': undefined,
              ...listbox.getComboboxProps(),
              'aria-expanded': expanded,
              'aria-errormessage': ariaErrorMessage,
              'aria-details': ariaDetails,
              disabled,
              autoFocus,
              tabIndex,
              onClick: () => setOpen((current) => !current),
              onPointerDown: focusOnPress,
              onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
              onKeyUp: composeEventHandlers(onKeyUp, listbox.onKeyUp),
              onFocus,
              onBlur,
              // The control's own: the hidden input submits the value, and a focusable control is
              // never hidden.
              name: undefined,
              form: undefined,
              hidden: undefined,
              inert: undefined,
              'aria-hidden': undefined,
            },
          })}
          ref={buttonMergedRef}
        >
          <span
            {...mergeSlotProps(slotProps?.value, {
              className: wcn(
                dropdownClassNames.value,
                'wave:truncate',
                !showValue && 'wave:text-muted-foreground',
              ),
              // Inside the natively disabled button, a click on the span still reaches its own
              // handlers: a disabled Dropdown calls none of yours there.
              blockHandlers: disabled ? BLOCK_CLICK : undefined,
            })}
          >
            {showValue ? valueNode : placeholder}
          </span>
          {showExpand &&
            (expandGlyph != null && slotRendersContent(expandGlyph) ? (
              renderSlot(
                expandGlyph,
                'span',
                wcn(
                  dropdownClassNames.expandIcon,
                  'wave:absolute wave:inline-flex wave:transition-transform wave:motion-reduce:transition-none',
                  expandOffset,
                  expanded && 'wave:rotate-180',
                ),
                { 'aria-hidden': true },
              )
            ) : (
              <ChevronDownIcon
                size={pickerGlyphSize(size, 'chevron')}
                className={wcn(
                  dropdownClassNames.expandIcon,
                  'wave:absolute wave:transition-transform wave:motion-reduce:transition-none',
                  expandOffset,
                  expanded && 'wave:rotate-180',
                )}
              />
            ))}
        </button>
        {showClear && (
          <PickerClearButton
            fallbackRef={buttonRef}
            // The literal marks C-BUTTON-TYPE; the merged props lock the type (a part cannot change it).
            type="button"
            {...mergeSlotProps(slotProps?.clearButton, {
              className: wcn(
                dropdownClassNames.clearButton,
                pickerIconButtonClasses(size, appearance),
                // Before the chevron while it shows, else at the end.
                pickerButtonOffset(size, showExpand ? 2 : 1),
                focusRing,
                disabledStyles,
              ),
              locked: {
                type: 'button',
                'aria-label': labels?.clear ?? 'Clear selection',
                disabled,
                tabIndex: undefined,
                'aria-disabled': undefined,
                'data-disabled': undefined,
                'data-disabled-focusable': undefined,
                hidden: undefined,
                inert: undefined,
                'aria-hidden': undefined,
                // Keeps focus on the combobox while the pointer clears it.
                onMouseDown: preventMouseDown,
                onClick: handleClear,
              },
            })}
          >
            <DismissIcon size={pickerGlyphSize(size, 'icon')} />
          </PickerClearButton>
        )}
      </div>
      <PickerListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        // A windowed list is laid out by the window: the browser's scroll anchoring only fights it.
        listClassName={wcn(
          dropdownClassNames.listbox,
          activeWindow && 'wave:[overflow-anchor:none]',
        )}
        surfaceClassName={dropdownClassNames.surface}
        motion={motion}
        aria-label={fieldProps['aria-label']}
        aria-labelledby={listLabelledBy}
        listProps={activeWindow ? { ref: listScrollRef } : undefined}
        parts={{ list: slotProps?.listbox, surface: slotProps?.surface }}
      >
        {/* Data mode: the options of the shown items while the list shows (labels come from
            `items`, so a closed list needs none), or the window's; the children are ignored. */}
        {!dataMode
          ? children
          : expanded &&
            (activeWindow
              ? renderListboxWindow(
                  listbox.items,
                  activeWindow,
                  optionsState,
                  dropdownClassNames.spacer,
                )
              : renderListboxItems(listbox.items, optionsState))}
      </PickerListboxSurface>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={multiselect ? values : (values[0] ?? '')}
        type="text"
        required={isRequired}
        onInvalid={() => buttonRef.current?.focus()}
      />
    </div>
  );
};
DropdownRoot.displayName = 'Dropdown';

/** Flat name of `Dropdown.Option` for React Server Components. */
export const DropdownOption = Option;
/** Flat name of `Dropdown.OptionGroup` for React Server Components. */
export const DropdownOptionGroup = OptionGroup;

/**
 * A select-only combobox (APG): a button that opens a listbox of `Option`s. Enter, Space,
 * ArrowDown/ArrowUp, Home/End and typing a character open it and move the highlight
 * (`aria-activedescendant`); Enter/Space select, Tab selects the highlighted option and moves on,
 * Escape closes. The button's chevron (see `expandIcon`) turns while the list is open, and
 * `renderValue` replaces its content while a value is selected. `clearable` adds a clear button,
 * a tab stop after the combobox button; both sit in a wrapper `<div>` inside the root.
 *
 * `multiselect` turns the value into an array (Fluent's `selectedOptions`): options draw a
 * checkbox; Enter and Space toggle the highlighted option, a click toggles the clicked option, and
 * the list stays open (Tab, Escape and Alt+ArrowUp close without committing); the button shows the
 * selected labels in selection order (`labels.selection`, replacing the placeholder while any are
 * selected, values without an option left out) and every toggle the user makes is announced
 * (`labels.added`/`labels.removed`, never for a controlled change, a clear or a form reset).
 * `clearable` then clears every value. A non-literal `multiselect={flag}` is a type error: render
 * two elements, one for each mode.
 *
 * **Data mode**: `items` passes the options as data instead of children. The open list renders an
 * option per item (`renderOption` draws it, an `Option` with the item's label by default) and the
 * closed list none; the keys, typeahead and the button's text follow the data, and each option
 * carries `aria-posinset` and `aria-setsize`. A long list takes a `virtualWindow` (from
 * `useVirtualWindow({ itemSize })`): the open list then renders only the options in view, plus an
 * overscan, with spacers for the others, every option `itemSize` tall; the active option stays
 * rendered, and opening scrolls it to the middle of the list.
 *
 * The `<button>` receives `ref`, `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`
 * and `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp`. `className`, `style`, other `aria-*` attributes
 * and the remaining props stay on the root `<div>` (`slotProps.root.ref` reaches it). Inside a
 * `Field` the button is labelled and described by it — otherwise give it an `aria-label`. It
 * shows the error look whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field`
 * error). With `name`/`required` the value takes part in form submission (one hidden input per
 * value with `multiselect`), validation and reset (a `multiselect` reset is compared by content,
 * so restoring the same values reports nothing). The open listbox renders in a portal; while
 * closed it stays in the DOM, hidden.
 *
 * **Size and appearance**: `size` resolves from its own prop, then the surrounding `Field`'s
 * `size`, then `WaveProvider inputDefaults.size`, else `'medium'`; `appearance` from its own prop,
 * then `WaveProvider inputDefaults.appearance`, else `'outline'`; both render as `data-size` and
 * `data-appearance` on the root `<div>`. The listbox keeps its size.
 *
 * Sub-components: `Dropdown.Option`, `Dropdown.OptionGroup`. React Server Components import the
 * flat names `DropdownOption` / `DropdownOptionGroup` (dotted access needs a client file).
 */
export const Dropdown = /* @__PURE__ */ Object.assign(DropdownRoot, {
  Option,
  OptionGroup,
}) as DropdownComponent;
