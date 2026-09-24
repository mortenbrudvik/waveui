import * as React from 'react';
import { cn } from '../../lib/cn';
import { joinIds } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { isDev, warnDeprecated } from '../../lib/dev';
import { CheckIcon, DismissIcon } from '../../lib/icons';
import { disabledStyles, focusRing, forcedColors, inputBase, inputFocus } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useDismiss } from '../../hooks/useDismiss';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { ListboxContext, useListbox, useListboxOption } from '../../hooks/useListbox';
import type { ListboxItem } from '../../hooks/useListbox';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { HiddenInput } from '../internal/HiddenInput';
import { Portal } from '../portal/Portal';
import {
  DEFAULT_TIME_STEP,
  generateTimeOptions,
  minutesToTime,
  minutesToValue,
  normalizeTimeStep,
  timeToMinutes,
} from './dateUtils';

/* ------------------------------------------------------------------ */
/*  Option                                                             */
/* ------------------------------------------------------------------ */

const OPTION_CLASSES =
  'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-body-1 text-foreground hover:bg-subtle-hover data-[active]:bg-subtle-hover data-[active]:outline-2 data-[active]:outline-ring data-[active]:-outline-offset-2 data-[selected]:bg-subtle-selected data-[selected]:font-semibold';

interface TimePickerOptionProps {
  value: string;
  label: string;
}

/**
 * One time option. Memoized: it re-renders only when its own active/selected state changes (read
 * from the listbox store), so moving the highlight renders two options, not the whole list.
 */
const TimePickerOption = React.memo(function TimePickerOption({
  value,
  label,
}: TimePickerOptionProps) {
  const { selected, optionProps } = useListboxOption<HTMLLIElement>({ value, label });
  return (
    <li {...optionProps} className={cn(OPTION_CLASSES, selected && forcedColors.selectedContainer)}>
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {selected ? <CheckIcon size={12} /> : null}
      </span>
      {label}
    </li>
  );
});
TimePickerOption.displayName = 'TimePickerOption';

/* ------------------------------------------------------------------ */
/*  TimePicker                                                         */
/* ------------------------------------------------------------------ */

/** Properties for the TimePicker component. */
export interface TimePickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'placeholder'
> {
  /** Controlled selected time in `HH:mm` (24-hour) format; `''` for no time. */
  value?: string;
  /**
   * Initial time for uncontrolled usage (`HH:mm`).
   * @default ''
   */
  defaultValue?: string;
  /** Called with the new `HH:mm` value (`''` when cleared) whenever the selected time changes. */
  onValueChange?: (value: string) => void;
  /**
   * @deprecated Use `onValueChange`. Still called with the new value (warns once in development).
   */
  onChange?: (value: string) => void;
  /**
   * Time display format of the input and the options.
   * @default '12h'
   */
  format?: '12h' | '24h';
  /**
   * Minutes between options. A non-finite or non-positive value falls back to 30 (development
   * error); fractions are floored.
   * @default 30
   */
  step?: number;
  /**
   * Earliest time (inclusive): `HH:mm`, `HH:mm:ss` or `h:mm AM`.
   * @default '00:00'
   */
  minTime?: string;
  /**
   * Latest time (inclusive): `HH:mm`, `HH:mm:ss` or `h:mm AM`. Invalid or reversed bounds give no
   * options (development error, "No times available").
   * @default '23:59'
   */
  maxTime?: string;
  /**
   * Placeholder text shown when no time is selected.
   * @default 'Select a time'
   */
  placeholder?: string;
  /**
   * Whether the time picker is disabled and non-interactive.
   * @default false
   */
  disabled?: boolean;
  /** Makes the input read-only: the list does not open and the value cannot change. */
  readOnly?: boolean;
  /**
   * Whether to show a clear button when a time is selected (not shown while `readOnly`).
   * @default false
   */
  clearable?: boolean;
  /** Form field name: the `HH:mm` value is submitted under it (hidden input). */
  name?: string;
  /** Id of the `<form>` the value belongs to, when the picker is outside it. */
  form?: string;
  /** Blocks form submission while no time is selected; sets `aria-required` on the input. */
  required?: boolean;
  /** Native `autocomplete` of the input. @default 'off' */
  autoComplete?: string;
  /** Native `maxlength` of the input. */
  maxLength?: number;
  /** Ref to the text input (the `role="combobox"` element); `ref` stays on the root. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

function displayTime(value: string, format: '12h' | '24h'): string {
  const minutes = timeToMinutes(value);
  return Number.isNaN(minutes) ? value : minutesToTime(minutes, format);
}

/** Whether an option matches the (trimmed, lower-case) typed text: by label or `HH:mm` value. */
function matchesQuery(item: ListboxItem, text: string): boolean {
  return item.label.toLowerCase().includes(text) || item.value.includes(text);
}

/** Whether an option's label or `HH:mm` value starts with the (trimmed, lower-case) typed text. */
function startsWithQuery(item: ListboxItem, text: string): boolean {
  return item.label.toLowerCase().startsWith(text) || item.value.startsWith(text);
}

/**
 * A time input with a filterable list of times (APG editable combobox with list autocomplete).
 *
 * - Type to filter (by label or `HH:mm` value). A complete typed time (`2:00 PM`, `14:00`) makes
 *   its own option active — not an earlier one that merely contains the text, such as `12:00 PM`
 *   — and partial text makes the first option that starts with it active (`2:00 p` -> `2:00 PM`),
 *   else the first one that contains it; Enter commits the active option. Enter or leaving the
 *   field also commits a complete typed time that is not in the list (`9:15 AM`, `14:45`) when it
 *   lies within `minTime`/`maxTime`, and erased text clears the value (as the clear button does);
 *   Enter never submits the form with edited text. Other typed text is reverted on blur. Escape on
 *   a closed list reverts any edit, erased text included, to the selected time.
 * - Click the input, ArrowDown/ArrowUp or type to open; the list opens with every option and the
 *   selected one (when it is in the list) active and scrolled into view. Without one, no option is
 *   active until ArrowDown/ArrowUp or typing, so Enter lets the surrounding form submit. Escape,
 *   Tab, an outside press or focus leaving closes it. Typed text kept after Escape closed the list
 *   still filters it when it reopens: a click resumes the option typing made active,
 *   ArrowDown/ArrowUp start at the first/last match.
 * - Keys of an IME composition (its confirming Enter included) are left to the IME.
 * - `clearable` shows a clear button while a time is selected (not while read-only).
 * - The value is `HH:mm` (24-hour) whatever the display `format`; values off the `step` grid or
 *   outside the bounds are still displayed in `format`.
 * - Labelling props (`id`, `aria-*`), focus/key handlers and native input attributes go to the
 *   input (`controlRef`); `ref`, `className`, `style` and other props stay on the root. Inside a
 *   `Field`, the input is labelled and described by it.
 * - `name`/`required` add a hidden input for native forms (`HH:mm`); the value resets with its form.
 */
export const TimePicker = (props: TimePickerProps) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    onChange,
    format = '12h',
    step = DEFAULT_TIME_STEP,
    minTime = '00:00',
    maxTime = '23:59',
    placeholder = 'Select a time',
    disabled = false,
    readOnly,
    clearable = false,
    name,
    form,
    required,
    autoComplete = 'off',
    maxLength,
    enterKeyHint,
    inputMode,
    spellCheck,
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

  if (onChange !== undefined) warnDeprecated('TimePicker', 'onChange', 'onValueChange');

  const [selectedValue, setSelectedValue] = useControllable<string>(
    valueProp,
    defaultValue ?? '',
    (next) => {
      onValueChange?.(next);
      onChange?.(next);
    },
  );

  /* ---- options, step and bounds ---------------------------------- */

  const stepValid = normalizeTimeStep(step).valid;
  const minMinutes = timeToMinutes(minTime);
  const maxMinutes = timeToMinutes(maxTime);
  const boundsValid =
    !Number.isNaN(minMinutes) && !Number.isNaN(maxMinutes) && minMinutes <= maxMinutes;
  const allOptions = React.useMemo(
    () => generateTimeOptions(step, minTime, maxTime, format),
    [step, minTime, maxTime, format],
  );

  React.useEffect(() => {
    if (isDev && !stepValid) {
      console.error(
        `[WaveUI] TimePicker: \`step\` must be a positive number of minutes (received ${String(step)}); ` +
          `using ${DEFAULT_TIME_STEP}.`,
      );
    }
  }, [step, stepValid]);

  React.useEffect(() => {
    if (isDev && !boundsValid) {
      console.error(
        `[WaveUI] TimePicker: \`minTime\`/\`maxTime\` must be times such as "09:00", "09:00:00" or ` +
          `"9:00 AM" with minTime <= maxTime (received "${minTime}" / "${maxTime}"); no times are available.`,
      );
    }
  }, [minTime, maxTime, boundsValid]);

  /* ---- open state, draft text and query -------------------------- */

  const interactive = !disabled && !readOnly;
  const [open, setOpen] = React.useState(false);
  // A picker that becomes disabled/read-only while open closes (own state: adjusted during render).
  if (open && !interactive) setOpen(false);
  /** Typed text; `null` shows the selected time's label (draft model). */
  const [draft, setDraft] = React.useState<string | null>(null);
  /**
   * Filter text: the typed text only, never the selected time's label, so opening without an edit
   * shows every option. Typed text kept while the list is closed (Escape) keeps filtering it, so
   * a reopened list shows what the input says.
   */
  const query = draft ?? '';

  const openList = () => {
    if (!interactive || open) return;
    setOpen(true);
  };
  const closeList = () => setOpen(false);

  const filter = React.useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return undefined;
    return (item: ListboxItem) => matchesQuery(item, text);
  }, [query]);

  /**
   * The option that typing `text` makes active. A complete time (`2:00 PM`, `14:00`) activates its
   * own option, never another one that merely contains the text (`12:00 PM`); when it is not in
   * the list (off-grid or out of bounds) nothing is active, so Enter commits the typed time or
   * nothing. Partial text activates the first option whose label or value starts with it (`2:00 p`
   * -> `2:00 PM`, `2` -> `2:00 AM`, not `12:00 AM`), else the first option that contains it.
   */
  const getTypedActiveValue = (text: string): string | null => {
    const needle = text.trim().toLowerCase();
    if (!needle) return null;
    const minutes = timeToMinutes(text);
    if (!Number.isNaN(minutes)) {
      const exact = minutesToValue(minutes);
      return allOptions.some((item) => item.value === exact) ? exact : null;
    }
    const match =
      allOptions.find((item) => startsWithQuery(item, needle)) ??
      allOptions.find((item) => matchesQuery(item, needle));
    return match?.value ?? null;
  };

  // Opening without typing activates the selected option only when it is in the list. An empty,
  // off-grid or out-of-range value activates nothing (ArrowDown/ArrowUp start at the first/last
  // option), so Enter on a freshly opened list commits nothing and the surrounding form submits.
  const selectedInList =
    selectedValue !== '' && allOptions.some((item) => item.value === selectedValue);

  const selectedValues = React.useMemo(
    () => (selectedValue ? [selectedValue] : []),
    [selectedValue],
  );

  const commitValue = (next: string) => {
    setSelectedValue(next);
    setDraft(null);
  };

  /**
   * Commits the typed text: erased text clears the value, a complete time within the bounds selects
   * it; `false` for any other text (it is kept).
   */
  const commitDraft = (text: string): boolean => {
    if (!text.trim()) {
      commitValue('');
      return true;
    }
    const minutes = timeToMinutes(text);
    if (Number.isNaN(minutes) || !boundsValid || minutes < minMinutes || minutes > maxMinutes) {
      return false;
    }
    commitValue(minutesToValue(minutes));
    return true;
  };

  const clearDraft = () => setDraft(null);

  // The listbox counts as open only while it shows options: with no match nothing is displayed,
  // so `aria-expanded` is false and Escape reverts the typed text instead of closing an empty list.
  const hasMatches = React.useMemo(
    () => (filter ? allOptions.some(filter) : allOptions.length > 0),
    [allOptions, filter],
  );
  const expanded = open && hasMatches;

  const lb = useListbox({
    open: expanded,
    onOpenChange: (next) => (next ? openList() : closeList()),
    mode: 'editable',
    selectedValues,
    onSelect: (next) => commitValue(next),
    items: allOptions,
    filter,
    // Typing sets the active option itself (getTypedActiveValue in handleInputChange), so an exact
    // typed time wins over an earlier substring match; highlightOnFilter would force the first one.
    autoHighlight: draft === null && selectedInList ? 'selected' : false,
    idPrefix: 'timepicker-listbox',
    // Escape on a closed list reverts typed text (erased text: handleKeyDown); without a draft it is
    // left to enclosing layers.
    onClearDraft:
      draft !== null
        ? () => {
            clearDraft();
            closeList();
          }
        : undefined,
  });

  const displayLabel = selectedValue
    ? (lb.getItem(selectedValue)?.label ?? displayTime(selectedValue, format))
    : '';
  const statusMessage =
    open && !hasMatches
      ? allOptions.length === 0
        ? 'No times available'
        : 'No matching times'
      : '';

  /* ---- elements, dismissal, positioning --------------------------- */

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  const rootRefs = useMergedRefs<HTMLDivElement>(ref, rootRef);
  const inputRefs = useMergedRefs<HTMLInputElement>(controlRef, inputRef);

  const { layerId } = useDismiss({
    open,
    onDismiss: closeList,
    refs: [surfaceRef, rootRef],
    anchorRef: inputRef,
    kind: 'listbox',
    focusOutside: true,
  });

  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open,
    side: 'bottom',
    align: 'start',
    matchReferenceWidth: true,
    fitViewport: true,
  });
  const surfaceRefs = useMergedRefs<HTMLDivElement>(surfaceRef, setFloating);

  /* ---- forms and Field ------------------------------------------- */

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    // An explicit `required={false}` wins over a required Field (`false || undefined` would not).
    'aria-required': ariaRequired ?? required,
  });

  useFormReset(
    inputRef,
    () => {
      setSelectedValue(defaultValue ?? '');
      clearDraft();
      closeList();
    },
    form,
  );

  /* ---- handlers --------------------------------------------------- */

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!interactive) return;
    const text = event.target.value;
    setDraft(text);
    if (!open) setOpen(true);
    // Every edit re-ranks the highlight (it opens the list in the same update when closed).
    lb.setActiveValue(getTypedActiveValue(text));
  };

  const handleKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      // Enter commits the active option: the exact typed time, the first match of partial text,
      // or the option moved to with the arrow keys.
      lb.onKeyDown(event);
      // Keys that belong to an IME composition (its confirming Enter) are left to the IME, as
      // useListbox leaves them.
      if (event.defaultPrevented || event.nativeEvent.isComposing) return;
      if (event.key === 'Escape' && draft === '' && displayLabel !== '') {
        // Erased text: useListbox calls onClearDraft only while the input has text, so Escape on a
        // closed list restores the selected time here (an open list was closed above). With nothing
        // to restore, Escape is left to enclosing layers.
        event.preventDefault();
        clearDraft();
        closeList();
        return;
      }
      if (event.key === 'Enter' && draft !== null) {
        // Edited text is committed (a complete time within the bounds; erased text clears) or kept,
        // never submitted with the form; untouched text lets Enter submit.
        event.preventDefault();
        if (commitDraft(draft)) closeList();
      }
    },
  );
  const handleKeyUp = composeEventHandlers(onKeyUp, lb.onKeyUp);

  const handleInputClick = () => {
    if (!interactive || open) return;
    openList();
    // Typed text kept after Escape resumes where typing left it: its matches (the filter) and the
    // option typing made active, so Enter commits the same time as before the list closed.
    if (draft !== null) lb.setActiveValue(getTypedActiveValue(draft));
  };

  const handleBlur = composeEventHandlers(onBlur, () => {
    if (draft !== null && !commitDraft(draft)) clearDraft();
  });

  const handleClear = () => {
    if (!interactive) return;
    commitValue('');
    inputRef.current?.focus();
  };

  /* ---- render ---------------------------------------------------- */

  const listboxLabelledBy = joinIds(ariaLabelledBy, field?.labelId);
  const renderListbox = (hidden: boolean) => (
    <ul
      {...lb.getListboxProps()}
      aria-labelledby={listboxLabelledBy}
      aria-label={listboxLabelledBy ? undefined : (ariaLabel ?? 'Times')}
      hidden={hidden || undefined}
      className="max-h-60 min-h-0 overflow-auto py-1 focus:outline-hidden"
    >
      {lb.items.map((item) => (
        <TimePickerOption key={item.value} value={item.value} label={item.label} />
      ))}
    </ul>
  );

  // Read-only pickers offer no clear action (the value cannot change).
  const showClear = clearable && !readOnly && selectedValue !== '';
  // aria-controls must name a listbox that is actually mounted. The closed list is inline only
  // while options exist; the open list is mounted only while something matches.
  const listboxMounted = (!open && allOptions.length > 0) || (open && hasMatches);

  return (
    <ListboxContext.Provider value={lb.context}>
      <div {...rest} ref={rootRefs} className={cn('relative inline-flex flex-col', className)}>
        <div ref={setReference} className="relative flex items-center">
          <input
            ref={inputRefs}
            type="text"
            {...lb.getComboboxProps()}
            aria-controls={listboxMounted ? lb.listboxId : undefined}
            {...fieldProps}
            aria-errormessage={ariaErrorMessage}
            aria-details={ariaDetails}
            value={draft ?? displayLabel}
            onChange={handleInputChange}
            onClick={handleInputClick}
            onFocus={onFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete={autoComplete}
            maxLength={maxLength}
            enterKeyHint={enterKeyHint}
            inputMode={inputMode}
            spellCheck={spellCheck}
            autoFocus={autoFocus}
            tabIndex={tabIndex}
            className={cn(
              inputBase,
              'border-b-stroke-accessible',
              inputFocus,
              disabledStyles,
              showClear && 'pe-8',
            )}
          />
          {showClear && (
            <button
              type="button"
              aria-label="Clear time"
              disabled={disabled}
              // Keeps focus (and an open list) on the input while the pointer clears it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className={cn(
                'absolute end-1 flex h-6 w-6 items-center justify-center rounded text-muted-foreground',
                'not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground',
                focusRing,
                disabledStyles,
              )}
            >
              <DismissIcon />
            </button>
          )}
        </div>
        {!open && allOptions.length > 0 && renderListbox(true)}
        <span role="status" className="sr-only">
          {statusMessage}
        </span>
        <HiddenInput
          name={name}
          form={form}
          disabled={disabled}
          value={selectedValue}
          type="text"
          required={isRequired}
          onInvalid={() => inputRef.current?.focus()}
        />
        {open && (
          <Portal layerId={layerId}>
            <div
              ref={surfaceRefs}
              {...floatingProps}
              data-state="open"
              className="flex flex-col overflow-hidden rounded border border-border bg-background shadow-8"
            >
              {hasMatches ? (
                renderListbox(false)
              ) : (
                <div aria-hidden="true" className="px-3 py-1.5 text-body-1 text-muted-foreground">
                  {statusMessage}
                </div>
              )}
            </div>
          </Portal>
        )}
      </div>
    </ListboxContext.Provider>
  );
};

TimePicker.displayName = 'TimePicker';
