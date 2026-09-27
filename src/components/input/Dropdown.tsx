import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { ChevronDownIcon, DismissIcon } from '../../lib/icons';
import { renderSlot, slotRendersContent } from '../../lib/slot';
import type { Slot } from '../../lib/slot';
import { disabledStyles, focusRing, inputFocus, inputInvalid } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { collectOptionLabels, useListbox } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { unwrapButtonGlyph } from '../button/Button.slots';
import { HiddenInput } from '../internal/HiddenInput';
import { showsExpandButton } from './Combobox.expand';
import { isInvalidLook } from './Input';
import { ListboxSurface, Option, OptionGroup, useListboxPopup } from './Option';
import { announceToggle, defaultSelectionLabel, PickerAnnouncer } from './pickerLabels';
import { PICKER_ICON_BUTTON_CLASSES, pickerEndPadding } from './pickerStyles';
import { EMPTY_VALUES, resetValues, toggleValue, toValues } from './pickerValues';
import type { RoutedHandlers } from './routedHandlers';

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
   * Called on every option activation, also when the current option is selected again (every
   * toggle with `multiselect`).
   * @deprecated Use `onValueChange`.
   */
  onOptionSelect?: (value: string) => void;
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
   * together with `clearable`). Decorative content rendered inside the button: a `<button>` or
   * `Button` passed here is not nested (its children become the glyph, with a development
   * warning).
   */
  expandIcon?: Slot<'span'>;
  /**
   * The clear button's name and, with `multiselect`, the selected-labels text and the toggle
   * announcements, for localization. Unset members keep their English defaults.
   */
  labels?: DropdownLabels;
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
  /** Ref to the `<button role="combobox">` (the focusable element). */
  controlRef?: React.Ref<HTMLButtonElement>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

/** The Dropdown component's type: a multi-select signature, then the single-select one. */
export interface DropdownComponent {
  (props: DropdownProps<true> & { multiselect: true }): React.ReactNode;
  (props: DropdownProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}

const DropdownRoot = (props: DropdownProps<boolean>) => {
  const {
    multiselect = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    onOptionSelect,
    open: openProp,
    defaultOpen,
    onOpenChange,
    onActiveOptionChange,
    disabledOptionsFocusable = false,
    placeholder = 'Select an option',
    renderValue,
    disabled = false,
    name,
    form,
    required,
    clearable = false,
    expandIcon,
    labels,
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
    controlRef,
    className,
    children,
    ref,
    ...rest
  } = props;

  if (onOptionSelect !== undefined) warnDeprecated('Dropdown', 'onOptionSelect', 'onValueChange');

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

  const optionLabels = React.useMemo(() => collectOptionLabels(children), [children]);

  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'select-only',
    multiselect,
    disabledOptionsFocusable,
    selectedValues: values,
    onSelect: (next, details) => {
      if (!multiselect) {
        // 0.7 order: the value callback first, the deprecated one after.
        setValue(next);
        onOptionSelect?.(next);
        return;
      }
      const { values: updated, added } = toggleValue(values, next);
      setValue(updated);
      onOptionSelect?.(next);
      // The committed option's label: the item useListbox passed in `details` (its own result,
      // `listbox`, cannot be read from inside the options object passed to it), else the label
      // read from `children` before the option registered, else the raw value. Announces a
      // toggle the user made (D41): never a controlled change, a clear or a form reset, none of
      // which reach this callback.
      announceToggle(
        labels,
        details?.item.label ?? optionLabels.get(next) ?? next,
        added,
        updated.length,
      );
    },
    onActiveValueChange: onActiveOptionChange,
    idPrefix: 'dropdown-listbox',
  });

  const expanded = open && listbox.items.length > 0;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen: expanded,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: buttonRef,
  });

  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);
  const buttonMergedRef = useMergedRefs<HTMLButtonElement>(buttonRef, controlRef, setReference);

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
  const handleClear = () => {
    setValue(multiselect ? EMPTY_VALUES : '');
    setOpen(false);
    buttonRef.current?.focus();
  };

  const showClear = clearable && hasValue;

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  return (
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
      {multiselect && <PickerAnnouncer />}
      <div className="relative flex items-center">
        <button
          type="button"
          {...fieldProps}
          {...listbox.getComboboxProps()}
          aria-expanded={expanded}
          aria-errormessage={ariaErrorMessage}
          aria-details={ariaDetails}
          ref={buttonMergedRef}
          disabled={disabled}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
          onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
          onFocus={onFocus}
          onBlur={onBlur}
          className={cn(
            // Every padding is set here (C-NATIVE), not left to an app-wide `button` rule. The end
            // padding keeps the text clear of the chevron (and of the clear button while it shows).
            'relative flex h-8 w-full items-center justify-between rounded border border-input border-b-stroke-accessible bg-background px-3 py-0 text-start text-body-1 text-foreground',
            pickerEndPadding(Number(showClear) + Number(showExpand)),
            inputFocus,
            disabledStyles,
            invalidLook && inputInvalid,
          )}
        >
          <span className={cn('truncate', !showValue && 'text-muted-foreground')}>
            {showValue ? valueNode : placeholder}
          </span>
          {showExpand &&
            (expandGlyph != null && slotRendersContent(expandGlyph) ? (
              renderSlot(
                expandGlyph,
                'span',
                cn(
                  'absolute end-3 inline-flex transition-transform motion-reduce:transition-none',
                  expanded && 'rotate-180',
                ),
                { 'aria-hidden': true },
              )
            ) : (
              <ChevronDownIcon
                className={cn(
                  'absolute end-3 transition-transform motion-reduce:transition-none',
                  expanded && 'rotate-180',
                )}
              />
            ))}
        </button>
        {showClear && (
          <button
            type="button"
            aria-label={labels?.clear ?? 'Clear selection'}
            disabled={disabled}
            // Keeps focus on the combobox while the pointer clears it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            className={cn(
              PICKER_ICON_BUTTON_CLASSES,
              showExpand ? 'end-7' : 'end-1',
              focusRing,
              disabledStyles,
            )}
          >
            <DismissIcon />
          </button>
        )}
      </div>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        aria-label={fieldProps['aria-label']}
        aria-labelledby={listLabelledBy}
      >
        {children}
      </ListboxSurface>
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
 * The `<button>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`
 * and `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp`. `ref`, `className`, `style`, other `aria-*`
 * attributes and the remaining props stay on the root `<div>`. Inside a `Field` the button is
 * labelled and described by it — otherwise give it an `aria-label`. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission (one hidden input per value with
 * `multiselect`), validation and reset (a `multiselect` reset is compared by content, so restoring
 * the same values reports nothing). The open listbox renders in a portal; while closed it stays
 * in the DOM, hidden.
 *
 * Sub-components: `Dropdown.Option`, `Dropdown.OptionGroup`. React Server Components import the
 * flat names `DropdownOption` / `DropdownOptionGroup` (dotted access needs a client file).
 */
export const Dropdown = /* @__PURE__ */ Object.assign(DropdownRoot, {
  Option,
  OptionGroup,
}) as DropdownComponent;
