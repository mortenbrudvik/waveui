import * as React from 'react';
import { cn } from '../../lib/cn';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { DismissIcon } from '../../lib/icons';
import type { Slot } from '../../lib/slot';
import { disabledStyles, focusRing, inputBase, inputFocus, inputInvalid } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { collectOptionLabels, useListbox, type ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { PickerExpandButton, showsExpandButton } from './Combobox.expand';
import { isInvalidLook } from './Input';
import { ListboxSurface, Option, OptionGroup, useListboxPopup } from './Option';
import { announceToggle, defaultSelectionLabel, PickerAnnouncer } from './pickerLabels';
import { PICKER_ICON_BUTTON_CLASSES, pickerEndPadding } from './pickerStyles';
import { EMPTY_VALUES, resetValues, toggleValue, toValues } from './pickerValues';
import type { RoutedHandlers } from './routedHandlers';

export { Option, OptionGroup } from './Option';
export type { OptionProps, OptionGroupProps } from './Option';

/* ------------------------------------------------------------------ */
/*  Combobox                                                          */
/* ------------------------------------------------------------------ */

/**
 * The Combobox's built-in texts, for localization. Each member is optional and falls back to its
 * English default.
 */
export interface ComboboxLabels {
  /** Status text (announced, and shown in the popup) when the typed text matches no option.
   * @default 'No matches'
   */
  noMatches?: string;
  /** Name of the clear button (`clearable`).
   * @default 'Clear selection'
   */
  clear?: string;
  /** Name of the expand button at the end of the input.
   * @default 'Show options'
   */
  expand?: string;
  /**
   * The text of the selected labels the input shows with `multiselect` while no text is typed, in
   * selection order; values without an option are left out.
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

/** Properties for the Combobox component. */
export interface ComboboxProps<M extends boolean = false> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /**
   * Several options can be selected (Fluent's `multiselect`): the value is an array, options show
   * a checkbox, Enter and a click toggle an option and keep the list open, and each toggle is
   * announced. While no text is typed the input shows the selected labels, selected whenever the
   * input gains focus or they return to it, so typing replaces them with text that filters the
   * options. Not available with `freeform`. A non-literal `multiselect={flag}` is a type error:
   * render two elements, one for each mode.
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
   * Called with the new value when it changes: an option is selected (toggled with `multiselect`,
   * which passes a new array), or (with `freeform`) the text changes. Without `multiselect` it is
   * not called when the current option is selected again; with it, activating a selected option
   * deselects it, which is a change. Fluent's `onOptionSelect`, under WaveUI's value/onValueChange
   * naming.
   */
  onValueChange?: M extends true ? (value: string[]) => void : (value: string) => void;
  /**
   * Called on every option activation, also when the current option is selected again (every
   * toggle with `multiselect`; with `freeform`, every text change).
   * @deprecated Use `onValueChange`.
   */
  onOptionSelect?: (value: string) => void;
  /**
   * Controlled open state of the listbox. The list renders only in the browser: an open combobox
   * is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage. A combobox that starts disabled or read-only
   * starts closed. The list renders only in the browser: it is closed in the server HTML and opens
   * once the combobox has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the listbox opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Placeholder text shown when no value is selected; with `multiselect`, whenever the input shows
   * no selected labels (no value is selected, or no selected value has an option).
   */
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
   * `value` as soon as the parent sets it (a parent that normalizes or rejects the text). Not
   * available with `multiselect` (a type error there): free text cannot be one of several values.
   * @default false
   */
  freeform?: M extends true ? never : boolean;
  /**
   * Name of the value in form submissions (renders a hidden input; one per value with
   * `multiselect`).
   */
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
  /**
   * The maximum length of the typed text (`maxlength` of the `<input role="combobox">`). With
   * `multiselect` the input has no limit while it shows the selected labels, so the limit applies
   * to the typed query only.
   */
  maxLength?: number;
  /**
   * The value cannot be changed: the input is read-only and the listbox neither opens (click,
   * keyboard, a controlled `open`) nor commits; Escape is left to the page. Turning it (or
   * `disabled`) on while the listbox is open closes it (`onOpenChange(false)`).
   */
  readOnly?: boolean;
  /**
   * Shows a clear button while a value is selected (not while `readOnly`; while `disabled` it is
   * shown disabled, as in DatePicker and TimePicker). It clears the value
   * (`onValueChange('')`; every value with `multiselect`, `onValueChange([])`), drops typed text,
   * closes the list and moves focus to the input. It is a tab stop after the input.
   * @default false
   */
  clearable?: boolean;
  /**
   * The glyph of the expand button at the end of the input (default: a chevron). The button
   * opens and closes the list without moving focus out of the input and is not a tab stop
   * (Alt+ArrowDown opens the list from the keyboard). `null` or `undefined` keep the chevron;
   * `false`, or a value that renders nothing, hides the button. Decorative content rendered
   * inside the built-in button: a `<button>` or `Button` passed here is not nested (its children
   * become the glyph, with a development warning).
   */
  expandIcon?: Slot<'span'>;
  /**
   * The built-in texts (the "No matches" status, the names of the clear and expand buttons and,
   * with `multiselect`, the selected-labels text and the toggle announcements), for localization.
   * Unset members keep their English defaults.
   */
  labels?: ComboboxLabels;
  /**
   * Called when the `<input role="combobox">` receives focus (the root keeps other handlers).
   * With `multiselect`, a focus while the input shows the selected labels then selects them;
   * `event.preventDefault()` skips that.
   */
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

/** The Combobox component's type: a multi-select signature, then the single-select one. */
export interface ComboboxComponent {
  (props: ComboboxProps<true> & { multiselect: true }): React.ReactNode;
  (props: ComboboxProps): React.ReactNode;
  displayName?: string;
  Option: typeof Option;
  OptionGroup: typeof OptionGroup;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * The text an edit inserted into `before`, given the new value `after`: `after` without the part
 * it shares with `before` at its start and at its end. The shared parts end and begin between
 * characters, never inside a surrogate pair (a character outside the BMP, such as an emoji).
 */
export function insertedText(before: string, after: string): string {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before[start] === after[start]) start += 1;
  if (start > 0 && isHighSurrogate(after.charCodeAt(start - 1))) start -= 1;
  let end = 0;
  while (end < max - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end += 1;
  }
  if (end > 0 && isLowSurrogate(after.charCodeAt(after.length - end))) end -= 1;
  return after.slice(start, after.length - end);
}

/**
 * The text an edit put in place of the range `start`–`end` of `before` (the selection when the
 * edit began), given the new value `after`; `undefined` when `after` does not keep the text around
 * that range, so the edit replaced something else (a character erased next to a collapsed caret).
 */
function replacedText(
  before: string,
  after: string,
  start: number,
  end: number,
): string | undefined {
  const kept = before.length - end;
  if (
    start > end ||
    end > before.length ||
    after.length < start + kept ||
    !after.startsWith(before.slice(0, start)) ||
    !after.endsWith(before.slice(end))
  ) {
    return undefined;
  }
  return after.slice(start, after.length - kept);
}

/**
 * An edit a `beforeinput` event announced: its `inputType`, and the selection it replaces, recorded
 * before the edit changes it. `range` is `null` where the edit does not replace the selection: a
 * drop inserts at the drop point, and an undo or a redo restores earlier text.
 */
interface AnnouncedEdit {
  inputType: string;
  range: readonly [number, number] | null;
}

/** The edits that restore earlier text: D11 rule 3 applies to them (R17). */
const HISTORY_EDITS: ReadonlySet<string> = new Set(['historyUndo', 'historyRedo']);

/** Whether `element` is the focused element of its document or shadow root (a document reports a
 * shadow root's host instead). */
function hasFocus(element: Element): boolean {
  const root = element.getRootNode() as Node & { activeElement?: Element | null };
  return root.activeElement === element;
}

function matchesText(item: ListboxItem, text: string): boolean {
  return (item.textValue ?? item.label).toLowerCase().includes(text.toLowerCase());
}

const ComboboxRoot = (props: ComboboxProps<boolean>) => {
  const {
    multiselect = false,
    value: valueProp,
    defaultValue,
    onValueChange,
    onOptionSelect,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder,
    disabled = false,
    freeform: freeformProp = false,
    name,
    form,
    required,
    autoComplete = 'off',
    autoCapitalize,
    autoCorrect,
    maxLength,
    readOnly,
    clearable = false,
    expandIcon,
    labels,
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

  // The multi-select signature has no `freeform` (D11); passed anyway from JavaScript, it is
  // ignored there, with a warning.
  const freeform = freeformProp && !multiselect;
  const freeformIgnored = freeformProp && multiselect;
  React.useEffect(() => {
    if (freeformIgnored) {
      warnOnce(
        'Combobox:freeform-multiselect',
        'Combobox: `freeform` is not available with `multiselect`: a multi-select Combobox ' +
          'selects options only.',
      );
    }
  }, [freeformIgnored]);

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
  // The selected values, for the listbox and the multi-select paths: a single value is its own
  // one-element array, and a `value` passed as `null` from JavaScript (bypassing the type system)
  // is none rather than a crash, as 0.7 did for the single-select string.
  const values = toValues(value);
  // The single-select value as 0.7 read it.
  const single = multiselect ? '' : (value as string);

  const interactive = !disabled && !readOnly;
  // A combobox that starts disabled or read-only never shows its list, so it starts closed (no
  // close to report later).
  const [openState, setOpen] = useControllable(
    openProp,
    (defaultOpen ?? false) && interactive,
    onOpenChange,
  );
  const open = openState && interactive;
  // Text typed since the last commit, the filter; `null` shows the committed value's label
  // (input-pickers#7), or the selected labels with `multiselect`. Freeform: the input shows the
  // value, and the draft follows that text.
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

  const optionLabels = React.useMemo(() => collectOptionLabels(children), [children]);
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
    multiselect,
    selectedValues: values,
    onSelect: (next, details) => {
      if (!multiselect) {
        // 0.7 order: the value callback first, the deprecated one after.
        setValue(next);
        onOptionSelect?.(next);
        setDraft(null);
        setTypedValue(null);
        return;
      }
      const { values: updated, added } = toggleValue(values, next);
      setValue(updated);
      onOptionSelect?.(next);
      // The toggled option's label: the item useListbox passed in `details` (its own result,
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
      // A toggle clears the query, so the labels show again, selected (R18); the list stays open
      // (D11).
      setDraft(null);
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

  const labelOf = (v: string) => listbox.getItem(v)?.label ?? optionLabels.get(v);
  // Multi-select: the selected labels in selection order, values without an option left out
  // (D10), joined by `labels.selection`.
  let labelsText = '';
  if (multiselect) {
    const shown = values.map(labelOf).filter((label): label is string => label !== undefined);
    if (shown.length > 0) labelsText = (labels?.selection ?? defaultSelectionLabel)(shown);
  }
  // Multi-select: while no text is typed, the input shows the selected labels (D11); without any
  // (no value, or no selected value with an option) it shows its placeholder, as a Dropdown does.
  const showingLabels = multiselect && draft === null && labelsText !== '';

  // The input text. Multi-select: the typed query, else the selected labels. Freeform: the value
  // as typed while it is the value the user typed last, else the label of the option with that
  // value, else the value itself — so the text follows a controlled parent that normalizes or
  // rejects what was typed while the input still has focus. Otherwise: the typed filter, else the
  // selected option's label.
  const optionLabel = single ? labelOf(single) : undefined;
  let inputText: string;
  if (multiselect) inputText = draft ?? labelsText;
  else if (freeform) inputText = single === typedValue ? single : (optionLabel ?? single);
  else inputText = draft ?? optionLabel ?? '';
  // Freeform: the filter follows the text (adjust-during-render pattern, C-HOOKS; the text does not
  // depend on the filter, so this settles in one pass).
  if (freeform && draft !== null && draft !== inputText) setDraft(inputText);

  const expanded = open && listbox.items.length > 0;
  const noMatchesText = labels?.noMatches ?? 'No matches';
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
      if (multiselect) {
        // Compared by content (C-FORMS), so a reset that keeps the same values reports nothing.
        setValue((current) => resetValues(current, defaultValue));
      } else {
        setValue(defaultValue ?? '');
      }
      setDraft(null);
      setTypedValue(null);
    },
    form,
  );

  // D11 rule 1: focusing the input while it shows the labels (Tab, a click, a Field label) selects
  // them, so an edit of any kind replaces them natively, without the value being rewritten during
  // the edit. A pointer press sets the caret on its mouseup, which would drop that selection, so
  // the mouseup of the press that focused the input is prevented (only that one: a later press in
  // the focused input places the caret as usual). The ref is written in handlers only (C-HOOKS).
  const pointerFocusRef = React.useRef(false);
  const handleMouseDown = (event: React.MouseEvent<HTMLInputElement>) => {
    pointerFocusRef.current = showingLabels && !hasFocus(event.currentTarget);
  };
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    if (showingLabels) event.currentTarget.select();
  };
  const handleMouseUp = (event: React.MouseEvent<HTMLInputElement>) => {
    if (!pointerFocusRef.current) return;
    pointerFocusRef.current = false;
    event.preventDefault();
  };
  // Rule 1 also holds whenever the labels return to the focused input (R18): a toggle, a close
  // from the keyboard, a controlled change or a form reset writes them with the caret at their
  // end, so they are selected again here. A press that moves the caret into them changes neither
  // dependency, so the caret stays and rule 2 takes what is typed there.
  React.useLayoutEffect(() => {
    const input = inputRef.current;
    if (showingLabels && input && hasFocus(input)) input.select();
  }, [showingLabels, labelsText]);

  // Multi-select: the edit a `beforeinput` announced (the last moment before an edit of any kind,
  // with the selection it replaces still in place; React has no event for it), for the change
  // that follows.
  const announcedEditRef = React.useRef<AnnouncedEdit | null>(null);
  React.useEffect(() => {
    const input = inputRef.current;
    if (!multiselect || !input) return;
    const record = (event: InputEvent) => {
      const { inputType } = event;
      const { selectionStart, selectionEnd } = input;
      announcedEditRef.current = {
        inputType,
        range:
          inputType === 'insertFromDrop' ||
          HISTORY_EDITS.has(inputType) ||
          selectionStart === null ||
          selectionEnd === null
            ? null
            : [selectionStart, selectionEnd],
      };
    };
    input.addEventListener('beforeinput', record);
    return () => input.removeEventListener('beforeinput', record);
  }, [multiselect]);

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
    // The edit the last `beforeinput` announced, if this change is that edit. A change nothing
    // announced (autofill, an extension, a script) has none, and neither has one after an edit
    // that was announced and then not made (cancelled, or blocked).
    const announced = announcedEditRef.current;
    announcedEditRef.current = null;
    const edit =
      announced && announced.inputType === (event.nativeEvent as { inputType?: string }).inputType
        ? announced
        : null;
    if (!multiselect) {
      setDraft(text);
    } else if (text === labelsText && (edit === null || HISTORY_EDITS.has(edit.inputType))) {
      // D11 rule 3, for an undo or a redo (R17): text equal to the labels shows them again, with
      // no query. Any other edit that leaves their text, typed or pasted, is a query.
      setDraft(null);
    } else if (showingLabels) {
      // D11 rule 2: the query is the text the edit inserted into the labels. With the selection
      // the edit replaced (all of the labels after a focus, rule 1), that is the text now in its
      // place, however much of it looks like the labels (R16); without one (a drop, an undo or a
      // redo, an edit the input did not announce), the new value without the part it shares with
      // the labels at its start and its end. Backspace and Delete leave an empty query and never
      // remove a value (rule 4).
      const range = edit?.range;
      setDraft(
        (range && replacedText(labelsText, text, range[0], range[1])) ??
          insertedText(labelsText, text),
      );
    } else {
      setDraft(text);
    }
    if (!open) setOpen(true);
    if (freeform) commitText(text);
  };

  // The expand button opens and closes the list like the input's own keys; focus stays in (or
  // returns to) the input.
  const handleExpandClick = () => {
    if (!interactive) return;
    if (open) close();
    else setOpen(true);
    inputRef.current?.focus();
  };

  // Clearing is not an option activation: the state is set directly, not through `commitText`
  // (which calls the deprecated `onOptionSelect` in freeform mode). The button disappears with the
  // value, so focus moves to the input explicitly (C-DISABLED).
  const handleClear = () => {
    setValue(multiselect ? EMPTY_VALUES : '');
    setTypedValue(null);
    setDraft(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const showExpand = showsExpandButton(expandIcon);
  // Read-only comboboxes offer no clear action (the value cannot change).
  const showClear = clearable && (multiselect ? values.length > 0 : single !== '') && !readOnly;

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  return (
    <div {...rest} ref={rootMergedRef} className={cn('relative inline-flex flex-col', className)}>
      {multiselect && <PickerAnnouncer />}
      <div className="relative flex items-center">
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
          // Multi-select: the selected labels take the placeholder's place (D11).
          placeholder={multiselect && labelsText !== '' ? undefined : placeholder}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          // Multi-select: no limit while the labels show, so typing into them (the caret moved
          // there) is never blocked; the limit applies to the typed query only.
          maxLength={showingLabels ? undefined : maxLength}
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
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          // Read-only: no listbox keys at all (they would open, commit or clear the value).
          onKeyDown={composeEventHandlers(onKeyDown, readOnly ? undefined : handleKeyDown)}
          onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
          onFocus={composeEventHandlers(onFocus, handleFocus)}
          onBlur={composeEventHandlers(onBlur, () => setDraft(null), {
            checkDefaultPrevented: false,
          })}
          className={cn(
            inputBase,
            'border-b-stroke-accessible',
            inputFocus,
            disabledStyles,
            invalidLook && inputInvalid,
            pickerEndPadding(Number(showClear) + Number(showExpand)),
          )}
        />
        {showClear && (
          <button
            type="button"
            aria-label={labels?.clear ?? 'Clear selection'}
            disabled={disabled}
            // Keeps focus in the input, so its blur does not act on a draft before the clear.
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
        {showExpand && (
          <PickerExpandButton
            component="Combobox"
            expandIcon={expandIcon}
            label={labels?.expand ?? 'Show options'}
            expanded={expanded}
            listboxId={listbox.listboxId}
            disabled={disabled || !!readOnly}
            onToggle={handleExpandClick}
          />
        )}
      </div>
      {/* Mounted before its text: a live region added together with its text is not announced by
          every screen reader. The row in the popup is the visible copy. */}
      <span role="status" className="sr-only">
        {noMatches && noMatchesText}
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
              {noMatchesText}
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
        value={multiselect ? values : single}
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
 * matches no option shows "No matches" (`labels.noMatches`), announced through a status region.
 * The expand button at the end of the input (a chevron, see `expandIcon`) opens and closes the
 * list without taking focus from the input and is not a tab stop; `clearable` adds a clear button,
 * a tab stop after the input. Both sit with the input in a wrapper `<div>` inside the root.
 *
 * `multiselect` turns the value into an array (Fluent's `selectedOptions`): options draw a
 * checkbox; Enter and a click toggle an option and keep the list open (Tab, Escape and
 * Alt+ArrowUp close without committing), and every toggle the user makes is announced
 * (`labels.added`/`labels.removed`, never for a controlled change, a clear or a form reset).
 * While no text is typed the input shows the selected labels in selection order
 * (`labels.selection`, values without an option left out) instead of the placeholder. Focusing
 * the input selects them, and so does their return to the focused input (a toggle, a close, a
 * form reset), so typing, pasting or composing text replaces them with a query that filters the
 * options; text inserted into them queries only what was inserted, an undo or a redo back to them
 * shows them again, and a toggle, a close or a blur clears the query. Backspace and Delete only
 * edit the text: the options, the clear button (which clears every value) and a form reset change
 * the value. `freeform` is not available with `multiselect`, and a non-literal
 * `multiselect={flag}` is a type error: render two elements, one for each mode.
 *
 * The `<input>` receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 * `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`, `autoFocus`,
 * `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text input attributes `autoComplete`,
 * `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`, `spellCheck` and `enterKeyHint`.
 * `ref`, `className`, `style`, other `aria-*` attributes and the remaining props stay on the root
 * `<div>`. Inside a `Field` the input is labelled and described by it. It shows the error look
 * whenever it ends up `aria-invalid` (its own `aria-invalid` or a `Field` error). With
 * `name`/`required` the value takes part in form submission (one hidden input per value with
 * `multiselect`), validation and reset (a `multiselect` reset is compared by content, so restoring
 * the same values reports nothing). The open listbox renders in a portal; while closed it stays
 * in the DOM, hidden.
 *
 * Sub-components: `Combobox.Option`, `Combobox.OptionGroup`. React Server Components import the
 * flat names `ComboboxOption` / `ComboboxOptionGroup` (dotted access needs a client file).
 */
export const Combobox = /* @__PURE__ */ Object.assign(ComboboxRoot, {
  Option,
  OptionGroup,
}) as ComboboxComponent;
