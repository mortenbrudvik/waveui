import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated } from '../../lib/dev';
import { disabledStyles, inputBase, inputFocus, inputInvalid } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { collectOptionLabels, useListbox, type ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { isInvalidLook } from './Input';
import { ListboxSurface, Option, OptionGroup, useListboxPopup } from './Option';

export { Option, OptionGroup } from './Option';
export type { OptionProps, OptionGroupProps } from './Option';

/* ------------------------------------------------------------------ */
/*  Combobox                                                          */
/* ------------------------------------------------------------------ */

type RoutedHandlers = 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Properties for the Combobox component. */
export interface ComboboxProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /** Controlled selected value (`''` for none). */
  value?: string;
  /**
   * Initial selected value for uncontrolled usage.
   * @default ''
   */
  defaultValue?: string;
  /**
   * Called with the new value when it changes: an option is selected, or (with `freeform`) the
   * text changes. Not called when the current option is selected again.
   */
  onValueChange?: (value: string) => void;
  /**
   * Called on every option activation, also when the current option is selected again (and, with
   * `freeform`, on every text change).
   * @deprecated Use `onValueChange`.
   */
  onOptionSelect?: (value: string) => void;
  /** Controlled open state of the listbox. */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the listbox opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
  /**
   * Whether the combobox is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /**
   * Whether the typed text is itself the value. Without it, typing only filters the options (the
   * first match becomes active, so Enter selects it) and the input shows the selected option's
   * label again when the listbox closes or loses focus. With it, the input shows typed text as
   * typed (also when it equals an option's value), a selected option's label, and a controlled
   * `value` as soon as the parent sets it (a parent that normalizes or rejects the text).
   * @default false
   */
  freeform?: boolean;
  /** Name of the value in form submissions (renders a hidden input). */
  name?: string;
  /** Id of the form the value belongs to, when the Combobox is outside it. */
  form?: string;
  /**
   * A value is required to submit the form (native constraint validation). Like a native readonly
   * input, a `readOnly` Combobox does not block submission.
   */
  required?: boolean;
  /**
   * The `autocomplete` attribute of the `<input role="combobox">`. Browser autofill is off unless
   * you set it (for example `'on'`).
   * @default 'off'
   */
  autoComplete?: string;
  /** The maximum length of the typed text (`maxlength` of the `<input role="combobox">`). */
  maxLength?: number;
  /**
   * The value cannot be changed: the input is read-only and the listbox neither opens (click,
   * keyboard, a controlled `open`) nor commits; Escape is left to the page. Turning it (or
   * `disabled`) on while the listbox is open closes it (`onOpenChange(false)`).
   */
  readOnly?: boolean;
  /** Called when the `<input role="combobox">` receives focus (the root keeps other handlers). */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Called when the `<input role="combobox">` loses focus. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /**
   * Called on a key press in the `<input role="combobox">`, before the built-in listbox keys;
   * `event.preventDefault()` skips them.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Called when a key is released in the `<input role="combobox">`. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Ref to the `<input role="combobox">` (the focusable element). */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

function matchesText(item: ListboxItem, text: string): boolean {
  return (item.textValue ?? item.label).toLowerCase().includes(text.toLowerCase());
}

const ComboboxRoot = (props: ComboboxProps) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    onOptionSelect,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder,
    disabled = false,
    freeform = false,
    name,
    form,
    required,
    autoComplete = 'off',
    autoCapitalize,
    autoCorrect,
    maxLength,
    readOnly,
    inputMode,
    spellCheck,
    enterKeyHint,
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

  if (onOptionSelect !== undefined) warnDeprecated('Combobox', 'onOptionSelect', 'onValueChange');

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  const validates = isRequired && !readOnly;
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
  // The error look follows the resolved state: the consumer's `aria-invalid` or the Field's (R8).
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);

  const [value, setValue] = useControllable(valueProp, defaultValue ?? '', onValueChange);
  const [openState, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const interactive = !disabled && !readOnly;
  const open = openState && interactive;
  // Text typed since the last commit, the filter; `null` shows the committed value's label
  // (input-pickers#7). Freeform: the input shows the value, and the draft follows that text.
  const [draft, setDraft] = React.useState<string | null>(null);
  // Locking the control (readOnly/disabled) while typing drops the draft, so the input shows the
  // committed value again (adjust-during-render pattern, C-HOOKS).
  const [wasInteractive, setWasInteractive] = React.useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) setDraft(null);
  }
  // Locking also closes the list itself, not only the derived `open`, so unlocking does not reopen
  // it without a user action. The close is reported through onOpenChange (a consumer callback from
  // an effect, C-HOOKS); a controlled `open` that stays true is still not shown while locked.
  const lockedOpen = !interactive && openState;
  React.useEffect(() => {
    if (lockedOpen) setOpen(false);
  }, [lockedOpen, setOpen]);

  // Freeform: the value the user typed last. While the value still equals it, the input shows it
  // as typed, even when it equals an option's value (not that option's label).
  const [typedValue, setTypedValue] = React.useState<string | null>(null);

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const labels = React.useMemo(() => collectOptionLabels(children), [children]);
  const filter = React.useMemo(
    () => (draft ? (item: ListboxItem) => matchesText(item, draft) : undefined),
    [draft],
  );

  const commitText = (text: string) => {
    setTypedValue(text);
    setValue(text);
    onOptionSelect?.(text);
  };

  const close = () => {
    setOpen(false);
    setDraft(null);
  };

  // APG: Escape on a closed listbox clears the textbox. Freeform: the text is the value, so it is
  // cleared. Otherwise only a typed filter is dropped (the input shows the selected label again);
  // without one there is nothing to clear and Escape is left to the page.
  let clearDraft: (() => void) | undefined;
  if (freeform) {
    clearDraft = () => {
      setDraft(null);
      commitText('');
    };
  } else if (draft) {
    clearDraft = () => setDraft(null);
  }

  const listbox = useListbox({
    open,
    onOpenChange: (next) => {
      if (next) setOpen(true);
      else close();
    },
    mode: 'editable',
    selectedValues: value ? [value] : [],
    onSelect: (next) => {
      setValue(next);
      onOptionSelect?.(next);
      setDraft(null);
      setTypedValue(null);
    },
    filter,
    // Typing a filter makes its first match active (like Fluent's Combobox), so Enter selects what
    // the list shows instead of submitting the form. Nothing is active on open or with the text
    // cleared. Freeform: the text is the value, so Enter keeps it unless the user moved to an
    // option.
    autoHighlight: !freeform && draft ? 'first' : false,
    idPrefix: 'combobox-listbox',
    onClearDraft: clearDraft,
  });

  // The input text. Freeform: the value as typed while it is the value the user typed last, else
  // the label of the option with that value, else the value itself — so the text follows a
  // controlled parent that normalizes or rejects what was typed while the input still has focus.
  // Otherwise: the typed filter, else the selected option's label.
  const optionLabel = value ? (listbox.getItem(value)?.label ?? labels.get(value)) : undefined;
  let inputText: string;
  if (freeform) inputText = value === typedValue ? value : (optionLabel ?? value);
  else inputText = draft ?? optionLabel ?? '';
  // Freeform: the filter follows the text (adjust-during-render pattern, C-HOOKS; the text does not
  // depend on the filter, so this settles in one pass).
  if (freeform && draft !== null && draft !== inputText) setDraft(inputText);

  const expanded = open && listbox.items.length > 0;
  // The popup shows the list, or "No matches" for a draft.
  const surfaceOpen = open && (expanded || !!draft);
  const noMatches = surfaceOpen && !expanded;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen,
    onDismiss: close,
    rootRef,
    anchorRef: inputRef,
  });

  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);
  const inputMergedRef = useMergedRefs<HTMLInputElement>(inputRef, controlRef, setReference);

  useFormReset(
    inputRef,
    () => {
      setValue(defaultValue ?? '');
      setDraft(null);
      setTypedValue(null);
    },
    form,
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && open && !surfaceOpen && !event.nativeEvent.isComposing) {
      // Open with nothing shown (no options): close as a closed list would handle Escape — clear
      // the text if there is any, otherwise leave the key to an enclosing layer (overlays#1).
      close();
      if (clearDraft && event.currentTarget.value !== '') {
        event.preventDefault();
        clearDraft();
      }
      return;
    }
    listbox.onKeyDown(event);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    setDraft(text);
    if (!open) setOpen(true);
    if (freeform) commitText(text);
  };

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  return (
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
      <input
        type="text"
        autoComplete={autoComplete}
        {...fieldProps}
        {...listbox.getComboboxProps()}
        aria-expanded={expanded}
        aria-errormessage={ariaErrorMessage}
        aria-details={ariaDetails}
        ref={inputMergedRef}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        inputMode={inputMode}
        spellCheck={spellCheck}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        value={inputText}
        onChange={handleChange}
        onClick={() => {
          if (!open && interactive) setOpen(true);
        }}
        // Read-only: no listbox keys at all (they would open, commit or clear the value).
        onKeyDown={composeEventHandlers(onKeyDown, readOnly ? undefined : handleKeyDown)}
        onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
        onFocus={onFocus}
        onBlur={composeEventHandlers(onBlur, () => setDraft(null), {
          checkDefaultPrevented: false,
        })}
        className={cn(
          inputBase,
          'border-b-stroke-accessible',
          inputFocus,
          disabledStyles,
          invalidLook && inputInvalid,
        )}
      />
      {/* Mounted before its text: a live region added together with its text is not announced by
          every screen reader. The row in the popup is the visible copy. */}
      <span role="status" className="sr-only">
        {noMatches && 'No matches'}
      </span>
      <ListboxSurface
        listbox={listbox}
        layerId={layerId}
        surfaceRef={surfaceRef}
        floatingProps={floatingProps}
        open={open}
        expanded={expanded}
        emptyContent={
          draft ? (
            <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
              No matches
            </div>
          ) : undefined
        }
        aria-label={fieldProps['aria-label']}
        aria-labelledby={listLabelledBy}
      >
        {children}
      </ListboxSurface>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={value}
        type="text"
        // Like a native readonly input, a read-only Combobox is barred from constraint validation
        // (the user could not fix it); its value is still submitted.
        required={validates}
        onInvalid={() => inputRef.current?.focus()}
      />
    </div>
  );
};
ComboboxRoot.displayName = 'Combobox';

/** Flat name of `Combobox.Option` for React Server Components. */
export const ComboboxOption = Option;
/** Flat name of `Combobox.OptionGroup` for React Server Components. */
export const ComboboxOptionGroup = OptionGroup;

/**
 * An editable combobox: a text input with a filterable listbox of `Option`s (APG combobox with
 * list autocomplete). Typing filters the options; ArrowDown/ArrowUp move the highlight
 * (`aria-activedescendant`), Enter selects, Escape closes. Without `freeform` the text is only a
 * filter: its first match becomes active while typing, and the input shows the selected option's
 * label again when the listbox closes. With `freeform` the text itself is the value. Text that
 * matches no option shows "No matches", announced through a status region.
 *
 * The `<input>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`,
 * `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text input attributes `autoComplete`,
 * `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck` and `enterKeyHint`.
 * `ref`, `className`, `style`, other `aria-*` attributes and the remaining props stay on the root
 * `<div>`. Inside a `Field` the input is labelled and described by it. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission, validation and reset. The open
 * listbox renders in a portal; while closed it stays in the DOM, hidden.
 *
 * Sub-components: `Combobox.Option`, `Combobox.OptionGroup`. React Server Components import the
 * flat names `ComboboxOption` / `ComboboxOptionGroup` (dotted access needs a client file).
 */
export const Combobox = /* @__PURE__ */ Object.assign(ComboboxRoot, {
  Option,
  OptionGroup,
});
