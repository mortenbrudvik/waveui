import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { DismissIcon } from '../../lib/icons';
import { focusRing, inputFocusWithin, inputInvalidWithin } from '../../lib/styles';
import { useAnnounce } from '../../hooks/useAnnounce';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useListbox, type ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePreserveFocus } from '../../hooks/usePreserveFocus';
import { HiddenInput } from '../internal/HiddenInput';
import { isInvalidLook } from './Input';
import { ListboxSurface, Option, useListboxPopup } from './Option';

/** Represents a single selectable tag option. */
export interface TagPickerOption {
  /** Unique identifier for the option. */
  value: string;
  /** Display label for the option. */
  label: string;
}

type RoutedHandlers = 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp';

/** Properties for the TagPicker component. */
export interface TagPickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | RoutedHandlers
> {
  /** Available options to choose from. */
  options: readonly TagPickerOption[];
  /** Controlled array of selected option values (`[]` for none). */
  value?: readonly string[];
  /**
   * Initial selected values for uncontrolled usage; a form reset restores them.
   * @default []
   */
  defaultValue?: readonly string[];
  /**
   * Called with the new selection when it changes: a tag is added or removed, or a form reset
   * restores different tags.
   */
  onValueChange?: (value: string[]) => void;
  /**
   * Called with the new selection when it changes: a tag is added or removed, or a form reset
   * restores different tags.
   * @deprecated Use `onValueChange`.
   */
  onChange?: (value: string[]) => void;
  /** Controlled open state of the option list. */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the option list opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Placeholder text shown when no tags are selected.
   * @default 'Select...'
   */
  placeholder?: string;
  /**
   * Whether the tag picker is disabled: nothing can be added or removed, and the remove buttons
   * leave the tab order.
   * @default false
   */
  disabled?: boolean;
  /** Name of the values in form submissions (one hidden input per value). */
  name?: string;
  /** Id of the form the values belong to, when the TagPicker is outside it. */
  form?: string;
  /**
   * At least one tag is required to submit the form (native constraint validation). Like a native
   * readonly input, a `readOnly` TagPicker does not block submission.
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
   * The selection cannot be changed: the input is read-only, the tags have no remove buttons, and
   * the option list neither opens (click, keyboard, a controlled `open`) nor adds tags; Escape is
   * left to the page. Turning it (or `disabled`) on while the list is open closes it
   * (`onOpenChange(false)`); a focused remove button hands focus to the input.
   */
  readOnly?: boolean;
  /** Called when the `<input role="combobox">` receives focus (the root keeps other handlers). */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Called when the `<input role="combobox">` loses focus. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /**
   * Called on a key press in the `<input role="combobox">`, before the built-in listbox and tag
   * keys; `event.preventDefault()` skips them.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Called when a key is released in the `<input role="combobox">`. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Ref to the `<input role="combobox">` (the focusable element). */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root `<div>`. */
  ref?: React.Ref<HTMLDivElement>;
}

const EMPTY: readonly string[] = [];

/** Whether two selections hold the same values in the same order. */
function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

interface TagRemoveButtonProps {
  label: string;
  disabled: boolean;
  onClick: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>;
  /** The element that receives focus when this button unmounts while focused (the input). */
  getFallback: () => HTMLElement | null;
}

/**
 * A tag's remove button. When it unmounts while focused (`readOnly` turned on, or a controlled
 * value dropped its tag), focus moves to the input instead of falling to `<body>` (C-DISABLED).
 */
function TagRemoveButton({
  label,
  disabled,
  onClick,
  onKeyDown,
  getFallback,
}: TagRemoveButtonProps) {
  const ref = React.useRef<HTMLButtonElement | null>(null);
  usePreserveFocus(ref, getFallback);
  return (
    <button
      ref={ref}
      type="button"
      data-wave-tagpicker-remove=""
      disabled={disabled}
      aria-label={`Remove ${label}`}
      className={cn(
        'ms-0.5 inline-flex rounded-sm text-muted-foreground not-disabled:not-aria-disabled:hover:text-foreground disabled:cursor-not-allowed',
        focusRing,
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <DismissIcon size={12} />
    </button>
  );
}

/**
 * A multi-select combobox that shows the selected values as removable tags. Typing filters the
 * options and makes the first match active; ArrowDown/ArrowUp move the highlight
 * (`aria-activedescendant`), Enter adds the highlighted option and keeps the list open (with no
 * typed text and nothing highlighted, Enter is left to the surrounding form), Escape closes the
 * list (and then clears the typed text). Backspace in the empty input moves focus to the last tag;
 * Backspace or Delete there removes it. Additions and removals are announced ("Cherry removed, 2
 * selected"), and so is "No matches" for text that matches no option.
 *
 * The tags form a list named "Selected"; the input is described by a summary of the selected
 * labels ("Selected: Apple, Banana"). The `<input>` receives `id`, `aria-label`,
 * `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, `aria-errormessage`,
 * `aria-details`, `tabIndex`, `autoFocus`, `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text
 * input attributes `autoComplete`, `autoCapitalize`, `autoCorrect`, `maxLength`, `inputMode`,
 * `spellCheck` and `enterKeyHint`. `ref`, `className`, `style`, other `aria-*` attributes and the
 * remaining props stay on the root `<div>`. Inside a `Field` the input is labelled and described
 * by it. The tag area shows the error look whenever the input ends up `aria-invalid` (its own
 * `aria-invalid` or a `Field` error). With `name`/`required` the values take part in form
 * submission, validation and reset. Selected values without a matching option are shown with
 * their raw value.
 */
export const TagPicker = (props: TagPickerProps) => {
  const {
    options,
    value: valueProp,
    defaultValue,
    onValueChange,
    onChange,
    open: openProp,
    defaultOpen,
    onOpenChange,
    placeholder = 'Select...',
    disabled = false,
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
    ref,
    ...rest
  } = props;

  if (onChange !== undefined) warnDeprecated('TagPicker', 'onChange', 'onValueChange');

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  // Like a native readonly input, a read-only TagPicker is barred from constraint validation (the
  // user could not fix it); its values are still submitted.
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

  const [selected, setSelected] = useControllable<readonly string[]>(
    valueProp,
    defaultValue ?? EMPTY,
    (next) => {
      // The props are read only; the callbacks receive an array of their own.
      const list = [...next];
      onValueChange?.(list);
      onChange?.(list);
    },
  );
  const [openState, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  const interactive = !disabled && !readOnly;
  const open = openState && interactive;
  const [query, setQuery] = React.useState('');
  // Locking the control (readOnly/disabled) while typing drops the typed text (adjust-during-render
  // pattern, C-HOOKS).
  const [wasInteractive, setWasInteractive] = React.useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) setQuery('');
  }
  // Locking also closes the list itself, not only the derived `open`, so unlocking does not reopen
  // it without a user action. The close is reported through onOpenChange (a consumer callback from
  // an effect, C-HOOKS); a controlled `open` that stays true is still not shown while locked.
  const lockedOpen = !interactive && openState;
  React.useEffect(() => {
    if (lockedOpen) setOpen(false);
  }, [lockedOpen, setOpen]);
  const announce = useAnnounce();

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const summaryId = useId('tagpicker-summary');

  const labelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) if (!map.has(option.value)) map.set(option.value, option.label);
    return map;
  }, [options]);
  const labelOf = (value: string) => labelByValue.get(value) ?? value;

  const available = React.useMemo<ListboxItem[]>(() => {
    const chosen = new Set(selected);
    return options
      .filter((option) => !chosen.has(option.value))
      .map((option) => ({ value: option.value, label: option.label }));
  }, [options, selected]);
  const filter = React.useMemo(
    () =>
      query
        ? (item: ListboxItem) => item.label.toLowerCase().includes(query.toLowerCase())
        : undefined,
    [query],
  );

  // Unknown values render as tags labelled by the raw value (input-pickers#22).
  const unknownValues = selected.filter((value) => !labelByValue.has(value)).join('\u0000');
  React.useEffect(() => {
    if (!unknownValues) return;
    warnOnce(
      'TagPicker:unknown-value',
      `TagPicker: the selected value(s) ${unknownValues
        .split('\u0000')
        .map((v) => `"${v}"`)
        .join(', ')} match no option; the raw value is shown as the tag label.`,
    );
  }, [unknownValues]);

  const getInput = () => inputRef.current;
  const focusInput = () => inputRef.current?.focus();

  const addTag = (value: string) => {
    if (!interactive || selected.includes(value)) return;
    const next = [...selected, value];
    setSelected(next);
    setQuery('');
    announce(`${labelOf(value)} added, ${next.length} selected`);
  };

  const removeTag = (value: string) => {
    if (!interactive) return;
    const next = selected.filter((v) => v !== value);
    setSelected(next);
    announce(`${labelOf(value)} removed, ${next.length} selected`);
    focusInput();
  };

  const listbox = useListbox({
    open,
    onOpenChange: (next) => setOpen(next),
    mode: 'editable',
    multiple: true,
    selectedValues: selected,
    onSelect: (value) => addTag(value),
    items: available,
    filter,
    // Typing a filter makes its first match active (as in Combobox), so Enter adds what the list
    // shows instead of submitting the form. Nothing is active on open or with the text cleared.
    autoHighlight: query ? 'first' : false,
    idPrefix: 'tagpicker-listbox',
    onClearDraft: query ? () => setQuery('') : undefined,
  });

  // aria-expanded only while a listbox with options is shown (input-pickers#21).
  const expanded = open && listbox.items.length > 0;
  // The popup shows the options, or "No matches" for a query.
  const surfaceOpen = open && (expanded || query !== '');
  const noMatches = surfaceOpen && !expanded;
  const { layerId, setReference, surfaceRef, floatingProps } = useListboxPopup({
    open,
    surfaceOpen,
    onDismiss: () => setOpen(false),
    rootRef,
    anchorRef: inputRef,
  });

  const rootMergedRef = useMergedRefs<HTMLDivElement>(rootRef, ref);
  const inputMergedRef = useMergedRefs<HTMLInputElement>(inputRef, controlRef);

  useFormReset(
    inputRef,
    () => {
      // Compared by content (R10): an inline default is a new array on every render, and a reset
      // that keeps the same tags reports nothing.
      const initial = defaultValue ?? EMPTY;
      setSelected((current) => (sameTags(current, initial) ? current : [...initial]));
      setQuery('');
    },
    form,
  );

  /** The tags' remove buttons, found from an element inside the component (no ref read). */
  const removeButtons = (from: Element) =>
    Array.from(
      from
        .closest('[data-wave-tagpicker-control]')
        ?.querySelectorAll<HTMLButtonElement>('[data-wave-tagpicker-remove]') ?? [],
    );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Read-only: no listbox keys at all (they would open the list, add or remove tags).
    if (!interactive) return;
    if (event.key === 'Escape' && open && !surfaceOpen && !event.nativeEvent.isComposing) {
      // Open with nothing shown (every option selected, no query): close, but leave Escape to an
      // enclosing layer (overlays#1) instead of consuming it for an invisible list.
      setOpen(false);
      return;
    }
    if (event.key === 'Backspace' && query === '' && selected.length > 0) {
      // First Backspace moves to the last tag; Backspace/Delete there removes it (input-pickers#14).
      event.preventDefault();
      removeButtons(event.currentTarget).at(-1)?.focus();
      return;
    }
    listbox.onKeyDown(event);
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: string) => {
    if (!interactive) return;
    const buttons = removeButtons(event.currentTarget);
    const index = buttons.indexOf(event.currentTarget);
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeTag(value);
      return;
    }
    if (event.key === 'Escape') {
      // Consumed here, so an enclosing layer ignores it (spec §5.4).
      event.preventDefault();
      focusInput();
      return;
    }
    const intent = getArrowIntent(event.key, {
      orientation: 'horizontal',
      dir: getDirection(event.currentTarget),
    });
    if (intent === 'prev' && index > 0) {
      event.preventDefault();
      buttons[index - 1].focus();
    } else if (intent === 'next') {
      event.preventDefault();
      if (index < buttons.length - 1) buttons[index + 1].focus();
      else focusInput();
    }
  };

  const listLabelledBy =
    fieldProps['aria-label'] === undefined
      ? (fieldProps['aria-labelledby'] ?? field?.labelId)
      : fieldProps['aria-labelledby'];

  return (
    <div {...rest} ref={rootMergedRef} className={cn('relative', className)}>
      <div
        ref={setReference}
        data-wave-tagpicker-control=""
        role="group"
        aria-disabled={disabled || undefined}
        className={cn(
          'flex flex-wrap items-center gap-1 rounded border border-input border-b-stroke-accessible bg-background px-2 py-1.5',
          inputFocusWithin,
          invalidLook && inputInvalidWithin,
          disabled && 'cursor-not-allowed opacity-50',
        )}
        onClick={(event) => {
          if (disabled || (event.target as Element).closest('button')) return;
          focusInput();
          if (!open && interactive) setOpen(true);
        }}
      >
        {selected.length > 0 && (
          <div role="list" aria-label="Selected" className="flex flex-wrap items-center gap-1">
            {selected.map((value) => {
              const label = labelOf(value);
              return (
                <div
                  key={value}
                  role="listitem"
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-body-1 text-foreground"
                >
                  {label}
                  {!readOnly && (
                    <TagRemoveButton
                      label={label}
                      disabled={disabled}
                      onClick={() => removeTag(value)}
                      onKeyDown={(event) => handleTagKeyDown(event, value)}
                      getFallback={getInput}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          // Describes the input. The list itself would read every "Remove …" button name too.
          <span id={summaryId} hidden>
            {`Selected: ${selected.map(labelOf).join(', ')}`}
          </span>
        )}
        <input
          type="text"
          autoComplete={autoComplete}
          {...fieldProps}
          {...listbox.getComboboxProps()}
          aria-expanded={expanded}
          aria-describedby={joinIds(
            fieldProps['aria-describedby'],
            selected.length > 0 ? summaryId : undefined,
          )}
          aria-errormessage={ariaErrorMessage}
          aria-details={ariaDetails}
          ref={inputMergedRef}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={selected.length === 0 ? placeholder : ''}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          inputMode={inputMode}
          spellCheck={spellCheck}
          enterKeyHint={enterKeyHint}
          autoFocus={autoFocus}
          tabIndex={tabIndex}
          value={query}
          onChange={(event) => {
            if (!interactive) return;
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onKeyDown={composeEventHandlers(onKeyDown, handleInputKeyDown)}
          onKeyUp={composeEventHandlers(onKeyUp, listbox.onKeyUp)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="min-w-15 flex-1 bg-transparent py-0.5 text-body-1 text-foreground placeholder:text-muted-foreground focus:outline-hidden"
        />
      </div>
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
        showCheck={false}
        emptyContent={
          query !== '' ? (
            <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
              No matches
            </div>
          ) : undefined
        }
        aria-label={fieldProps['aria-label']}
        aria-labelledby={listLabelledBy}
      >
        {expanded &&
          listbox.items.map((item) => (
            <Option key={item.value} value={item.value} label={item.label}>
              {item.label}
            </Option>
          ))}
      </ListboxSurface>
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={selected}
        type="text"
        required={validates}
        onInvalid={focusInput}
      />
    </div>
  );
};
TagPicker.displayName = 'TagPicker';
