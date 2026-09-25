import * as React from 'react';
import { flushSync } from 'react-dom';
import { cn } from '../../lib/cn';
import { focusableDisabledProps, joinIds, preventIfDisabled } from '../../lib/aria';
import { composeEventHandlers } from '../../lib/composeEventHandlers';
import { warnDeprecated, warnOnce } from '../../lib/dev';
import { getArrowIntent, getDirection } from '../../lib/direction';
import { FOCUSABLE_SELECTOR } from '../../lib/focus';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, DismissIcon } from '../../lib/icons';
import {
  disabledStyles,
  focusRing,
  forcedColors,
  inputBase,
  inputFocus,
  inputInvalid,
} from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useDismiss } from '../../hooks/useDismiss';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { usePopupPosition } from '../../hooks/usePopupPosition';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import { HiddenInput } from '../internal/HiddenInput';
import { Portal } from '../portal/Portal';
import {
  addDays,
  addMonths,
  clampDate,
  formatDate as formatLocaleDate,
  formatDayLabel,
  formatDayNumber,
  formatISODate,
  formatMonthYear,
  getCalendarDays,
  getLocaleDateFormat,
  getWeekdayNames,
  isDateInRange,
  isSameDay,
  isSameMonth,
  isValidLocaleTag,
  parseDate as parseLocaleDate,
  startOfDay,
  startOfMonth,
} from './dateUtils';
import { isInvalidLook } from './Input';
import type { RoutedHandlers } from './routedHandlers';

/** Why typed text was not accepted (see {@link DatePickerProps.onInvalidInput}). */
export type DatePickerInvalidReason = 'unparseable' | 'out-of-range' | 'disabled';

/**
 * The DatePicker's built-in button names and error texts, for localization. Each member is
 * optional and falls back to its English default. Month and weekday names and the day labels
 * follow `locale`.
 */
export interface DatePickerLabels {
  /** Name of the clear button.
   * @default 'Clear date'
   */
  clear?: string;
  /** Name of the button that opens the calendar.
   * @default 'Open calendar'
   */
  openCalendar?: string;
  /** Name of the calendar's previous-month button.
   * @default 'Previous month'
   */
  previousMonth?: string;
  /** Name of the calendar's next-month button.
   * @default 'Next month'
   */
  nextMonth?: string;
  /**
   * Error text for typed text that is not a date. `pattern` is the default format of `locale`
   * written with English field letters (`'MM/DD/YYYY'`, `'DD.MM.YYYY'`), or `undefined` with a
   * custom `parseDate` (its format is unknown to the picker).
   * @default (pattern) => pattern ? `Enter a date in the format ${pattern}.` : 'Enter a valid date.'
   */
  invalidDate?: (pattern: string | undefined) => string;
  /**
   * Error text for a typed date outside `minDate`/`maxDate`. The bounds are passed as the input
   * shows dates (`formatDate`); a bound that is not set is `undefined`.
   * @default (min, max) => `Enter a date between ${min} and ${max}.` (only `min`: `Enter a date on
   * or after ${min}.`; only `max`: `Enter a date on or before ${max}.`)
   */
  outOfRange?: (min: string | undefined, max: string | undefined) => string;
  /** Error text for a typed date that `disabledDates` excludes.
   * @default 'This date is not available.'
   */
  unavailableDate?: string;
}

const defaultInvalidDateLabel = (pattern: string | undefined) =>
  pattern ? `Enter a date in the format ${pattern}.` : 'Enter a valid date.';

const defaultOutOfRangeLabel = (min: string | undefined, max: string | undefined) => {
  if (min !== undefined && max !== undefined) return `Enter a date between ${min} and ${max}.`;
  if (min !== undefined) return `Enter a date on or after ${min}.`;
  return `Enter a date on or before ${max}.`;
};

/** Properties for the DatePicker component. */
export interface DatePickerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'placeholder' | RoutedHandlers
> {
  /** Controlled selected date (`null` for none). Emitted dates are always local midnight. */
  value?: Date | null;
  /**
   * Initial date for uncontrolled usage.
   * @default null
   */
  defaultValue?: Date | null;
  /** Called with the new date (local midnight) or `null` whenever the selected day changes. */
  onValueChange?: (date: Date | null) => void;
  /**
   * @deprecated Use `onValueChange`. Still called with the new date (warns once in development).
   */
  onChange?: (date: Date | null) => void;
  /**
   * Formats the selected date for the input. Supply `parseDate` as its inverse: without it, typed
   * text is parsed with the default parser for `locale` (development warning).
   * @default Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }),
   * in the Gregorian calendar when the locale's own has other months (see `locale`)
   */
  formatDate?: (date: Date) => string;
  /**
   * Parses typed text into a date (`null` when it is not one); the result is normalized to local
   * midnight. The default is the exact inverse of the default format for `locale` and also
   * accepts ISO `yyyy-mm-dd`.
   */
  parseDate?: (text: string) => Date | null;
  /**
   * BCP 47 locale of the default format/parse, the month and weekday names and the day labels
   * (runtime default when omitted). Pass it explicitly when rendering on the server, so the server
   * and the browser format the same text. The grid is Gregorian: a locale calendar with other
   * months or eras (the Persian default of `fa-IR`, `-u-ca-islamic`, `-u-ca-japanese`) is replaced
   * by the Gregorian one in the locale's language and digits; the Buddhist years of `th-TH` stay.
   * A tag `Intl` rejects (the POSIX `de_DE`, a typo) falls back to the runtime default locale
   * (development warning).
   */
  locale?: string;
  /** Earliest selectable day (the whole day is included). */
  minDate?: Date;
  /** Latest selectable day (the whole day is included). */
  maxDate?: Date;
  /** Returns `true` for days that cannot be selected (called with local-midnight dates). */
  disabledDates?: (date: Date) => boolean;
  /**
   * Placeholder text shown when no date is selected.
   * @default 'Select a date'
   */
  placeholder?: string;
  /**
   * Whether the date picker is disabled and non-interactive (the calendar is not shown).
   * @default false
   */
  disabled?: boolean;
  /**
   * Makes the input read-only: the calendar does not open and the value cannot change. Turning it
   * (or `disabled`) on while the user is typing drops the typed text.
   */
  readOnly?: boolean;
  /**
   * Whether to show a clear button when a date is selected (not shown while `readOnly`). Tab from
   * erased text clears the value before focus moves, so focus goes on to the calendar button, past
   * the clear button that disappears with it.
   * @default false
   */
  clearable?: boolean;
  /**
   * First day of the week (0 = Sunday, 1 = Monday, etc.).
   * @default 0
   */
  firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Controlled open state of the calendar. The calendar renders only in the browser: an open
   * picker is closed in the server HTML and opens once it has hydrated.
   */
  open?: boolean;
  /**
   * Initial open state for uncontrolled usage. A picker that starts disabled or read-only starts
   * closed. The calendar renders only in the browser: it is closed in the server HTML and opens
   * once the picker has hydrated.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when the calendar opens or closes (only when the state changes). */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called when typed text is not accepted on Enter, Alt+ArrowDown or blur (once per edit): it
   * cannot be parsed (`'unparseable'`), lies outside `minDate`/`maxDate` (`'out-of-range'`) or is
   * excluded by `disabledDates` (`'disabled'`). The text stays in the input, which is marked
   * `aria-invalid` and described by an error message (left to the surrounding `Field` when it
   * shows an error). Enter reports it again when pressed again.
   */
  onInvalidInput?: (text: string, reason: DatePickerInvalidReason) => void;
  /**
   * Names of the clear, calendar and month buttons and the error texts of rejected typed text, for
   * localization. Unset members keep their English defaults.
   */
  labels?: DatePickerLabels;
  /** Form field name: the date is submitted as ISO `yyyy-mm-dd` (hidden input). */
  name?: string;
  /** Id of the `<form>` the value belongs to, when the picker is outside it. */
  form?: string;
  /**
   * Blocks form submission while no date is selected; sets `aria-required` on the input. Like a
   * native readonly input, a `readOnly` DatePicker does not block submission.
   */
  required?: boolean;
  /** Native `autocomplete` of the input. @default 'off' */
  autoComplete?: string;
  /** Focus handler of the text input (the root keeps the other handlers). */
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Blur handler of the text input. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Key handler of the text input; `preventDefault()` skips the picker's own keys. */
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Key handler of the text input. */
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Ref to the text input; `ref` stays on the root. */
  controlRef?: React.Ref<HTMLInputElement>;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

// Every button sets its own padding and background (C-NATIVE): an app-wide `button` rule would
// otherwise pad and fill them.
const ICON_BUTTON_CLASSES =
  'absolute flex h-6 w-6 items-center justify-center rounded bg-transparent p-0 text-muted-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover not-disabled:not-aria-disabled:hover:text-foreground';

const NAV_BUTTON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover';

const DAY_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-caption-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover data-[outside]:text-muted-foreground data-[today]:border data-[today]:border-primary data-[today]:font-semibold data-[selected]:bg-primary data-[selected]:font-semibold data-[selected]:text-primary-foreground not-disabled:not-aria-disabled:data-[selected]:hover:bg-primary-hover aria-disabled:cursor-not-allowed aria-disabled:line-through aria-disabled:opacity-50';

/** The 42 grid days as 6 weeks. */
function toWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * A date input with a calendar dialog (APG date picker dialog).
 *
 * - **Typing**: the input accepts the default display format of `locale` (`Intl` numeric
 *   year/month/day, e.g. `03/04/2025` for `en-GB`, `04/03/2025` for `en-US`) and ISO
 *   `yyyy-mm-dd`. Text is committed on Enter, on Alt+ArrowDown (before the calendar opens) or when
 *   the field loses focus — only when it was edited, and only when it names a different day. Text
 *   that is not an available date is kept, the input is marked invalid and an error message
 *   describes it (`onInvalidInput`, reported once per edit) until the text is edited or replaced
 *   (a day picked in the calendar, the clear button, a form reset, a new day from the parent).
 * - **Calendar**: the toggle (`aria-haspopup="dialog"`) or Alt+ArrowDown in the input opens a
 *   modal dialog labelled by the month heading. Focus moves to the selected day (else today, else
 *   the first available day of the month) and Tab stays inside. Arrow keys move by day/week
 *   (mirrored in RTL), PageUp/PageDown by month, Shift+PageUp/PageDown by year (the day is clamped
 *   to the month), Home/End to the start/end of the week, Enter/Space select. Escape closes and
 *   returns focus to where the calendar was opened from (the toggle, or the input after
 *   Alt+ArrowDown); a press outside closes it too. Unavailable days stay focusable
 *   (`aria-disabled`); a day focused by pointer becomes the starting point of the arrow keys. The
 *   selected day is `aria-selected` on its gridcell and `aria-pressed` on its focusable button, so
 *   the state is announced when focus lands on it; today is `aria-current="date"`.
 * - The calendar closes when the picker becomes disabled or read-only (uncontrolled `open`: it
 *   stays closed when the picker is enabled again), and the text typed until then is dropped.
 * - `clearable` shows a clear button while a date is selected (not while read-only). Tab from
 *   erased text clears the value first, so focus moves on to the calendar button instead of to the
 *   clear button that disappears.
 * - Every emitted date is local midnight. The calendar opens on the month of the selected date or
 *   today, clamped into `minDate`/`maxDate`.
 * - The input (`controlRef`) receives `id`, `aria-label`, `aria-labelledby`, `aria-describedby`,
 *   `aria-invalid`, `aria-required`, `aria-errormessage`, `aria-details`, `tabIndex`,
 *   `autoFocus`, `onFocus`/`onBlur`/`onKeyDown`/`onKeyUp` and the text input attributes
 *   `autoComplete`, `autoCapitalize`, `autoCorrect`, `inputMode`, `spellCheck` and
 *   `enterKeyHint`. `ref`, `className`, `style`, other `aria-*` attributes and the remaining props
 *   stay on the root `<div>`. Inside a `Field`, the input is labelled and described by it.
 * - `name`/`required` add a hidden input for native forms (ISO `yyyy-mm-dd`); the value resets
 *   with its form.
 * - The built-in button names and error texts are English; `labels` localizes them.
 * - Pass `locale` explicitly when rendering on the server (see `locale`). The calendar renders only
 *   in the browser: an open calendar (`defaultOpen`, `open`) is closed in the server HTML and opens
 *   once the picker has hydrated.
 */
export const DatePicker = (props: DatePickerProps) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange,
    onChange,
    formatDate: formatDateProp,
    parseDate: parseDateProp,
    locale,
    minDate,
    maxDate,
    disabledDates,
    placeholder = 'Select a date',
    disabled = false,
    readOnly,
    clearable = false,
    firstDayOfWeek = 0,
    open: openProp,
    defaultOpen,
    onOpenChange,
    onInvalidInput,
    labels,
    name,
    form,
    required,
    autoComplete = 'off',
    autoCapitalize,
    autoCorrect,
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

  if (onChange !== undefined) warnDeprecated('DatePicker', 'onChange', 'onValueChange');

  const hasCustomFormat = formatDateProp !== undefined;
  const hasCustomParse = parseDateProp !== undefined;
  React.useEffect(() => {
    if (hasCustomFormat && !hasCustomParse) {
      warnOnce(
        'DatePicker:formatDate-without-parseDate',
        'DatePicker: `formatDate` is set without `parseDate`. Typed dates are parsed with the ' +
          'default parser for `locale` (its numeric format or yyyy-mm-dd), which may not read ' +
          'your format; pass `parseDate` as the inverse of `formatDate`.',
      );
    }
  }, [hasCustomFormat, hasCustomParse]);
  React.useEffect(() => {
    if (locale !== undefined && !isValidLocaleTag(locale)) {
      warnOnce(
        `DatePicker:invalid-locale:${locale}`,
        `DatePicker: \`locale\` "${locale}" is not a valid BCP 47 language tag (use hyphens, as ` +
          'in "en-US"). The runtime default locale formats and parses the dates instead, so the ' +
          'server and the browser may render different text.',
      );
    }
  }, [locale]);

  const [selectedDate, setSelectedDate] = useControllable<Date | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      onValueChange?.(next);
      onChange?.(next);
    },
  );
  const interactive = !disabled && !readOnly;
  const [openState, setOpen] = useControllable<boolean>(
    openProp,
    // A picker that starts disabled or read-only never shows its calendar, so it starts closed
    // (no close to report later).
    (defaultOpen ?? false) && interactive,
    onOpenChange,
  );
  // The calendar lives in a portal, which renders only in the browser: until then (the server
  // HTML, hydration) the picker reports it closed, so no reference names a missing element.
  const isClient = useIsClient();
  const isOpen = openState && interactive && isClient;
  const openControlled = openProp !== undefined;

  // A calendar hidden because the picker became disabled or read-only is closed for good
  // (uncontrolled), so enabling the picker again does not bring it back and take focus.
  // onOpenChange(false) reports it; a controlled `open` stays the parent's.
  React.useEffect(() => {
    if (!interactive && openState && !openControlled) setOpen(false);
  }, [interactive, openState, openControlled, setOpen]);

  const format = (date: Date) =>
    formatDateProp ? formatDateProp(date) : formatLocaleDate(date, locale);
  const parse = (text: string) =>
    parseDateProp ? parseDateProp(text) : parseLocaleDate(text, locale);

  /* ---- draft text and validation ---------------------------------- */

  /** Typed text; `null` shows the formatted selected date (draft model). */
  const [draft, setDraft] = React.useState<string | null>(null);
  const [invalid, setInvalid] = React.useState<DatePickerInvalidReason | null>(null);

  // Adjusted during render (C-HOOKS). Locking the picker (readOnly/disabled) while the user types
  // drops the typed text and its error, so no later blur commits it (the value cannot change).
  const [wasInteractive, setWasInteractive] = React.useState(interactive);
  if (wasInteractive !== interactive) {
    setWasInteractive(interactive);
    if (!interactive) {
      setDraft(null);
      setInvalid(null);
    }
  }
  // A selected day the parent changes replaces rejected text (commits clear it themselves), so the
  // input never shows an error next to a valid value. Text the user is still typing stays.
  const selectedDay = selectedDate ? formatISODate(selectedDate) : '';
  const [seenDay, setSeenDay] = React.useState(selectedDay);
  if (seenDay !== selectedDay) {
    setSeenDay(selectedDay);
    if (invalid !== null) {
      setDraft(null);
      setInvalid(null);
    }
  }

  const isUnavailable = (date: Date) =>
    !isDateInRange(date, minDate, maxDate) || !!disabledDates?.(startOfDay(date));

  /** Commits a day (or `null`); nothing is emitted when it is the same day. */
  const commitDate = (next: Date | null) => {
    const normalized = next ? startOfDay(next) : null;
    const unchanged = normalized ? isSameDay(normalized, selectedDate) : selectedDate === null;
    if (!unchanged) setSelectedDate(normalized);
    setDraft(null);
    setInvalid(null);
  };

  /** Validates and commits the typed text; `false` when it was rejected (the text is kept). */
  const commitDraft = (text: string): boolean => {
    if (!text.trim()) {
      commitDate(null);
      return true;
    }
    const parsed = parse(text);
    let reason: DatePickerInvalidReason | null = null;
    if (!parsed || Number.isNaN(parsed.getTime())) reason = 'unparseable';
    else if (!isDateInRange(parsed, minDate, maxDate)) reason = 'out-of-range';
    else if (disabledDates?.(startOfDay(parsed))) reason = 'disabled';
    if (reason || !parsed) {
      const rejected = reason ?? 'unparseable';
      setInvalid(rejected);
      onInvalidInput?.(text, rejected);
      return false;
    }
    commitDate(parsed);
    return true;
  };

  /* ---- calendar view and focused day ------------------------------- */

  const today = startOfDay(new Date());
  const initialView = () => startOfMonth(clampDate(selectedDate ?? today, minDate, maxDate));
  const [viewMonth, setViewMonth] = React.useState<Date>(initialView);
  const [focusedDay, setFocusedDay] = React.useState<Date | null>(null);

  /** Opened with Alt+ArrowDown in the input: Escape returns focus there instead of the toggle. */
  const [openedFromInput, setOpenedFromInput] = React.useState(false);

  // Every opening shows the selected (or current) month again: adjusted during render (C-HOOKS).
  const [openSeen, setOpenSeen] = React.useState(isOpen);
  if (openSeen !== isOpen) {
    setOpenSeen(isOpen);
    if (isOpen) {
      setViewMonth(initialView());
      setFocusedDay(null);
    }
  }
  // A closed calendar forgets where it was opened from. This also drops an Alt+ArrowDown whose
  // opening a controlled parent declined (it renders in the same update, still closed), so a later
  // opening by the parent returns focus to the toggle, not the input.
  if (openedFromInput && !isOpen) setOpenedFromInput(false);

  const weeks = React.useMemo(
    () => toWeeks(getCalendarDays(viewMonth, firstDayOfWeek)),
    [viewMonth, firstDayOfWeek],
  );

  // The focused day is derived: the day moved to while it is shown (a pointer-focused day of the
  // previous/next month counts too), else the selected day of the month, else today (clamped into
  // the range), else the first available day of the month.
  const inView = (date: Date | null | undefined): date is Date =>
    !!date && isSameMonth(date, viewMonth);
  const inGrid = (date: Date | null | undefined): date is Date =>
    !!date && date >= weeks[0][0] && date <= weeks[weeks.length - 1][6];
  const clampedToday = clampDate(today, minDate, maxDate);
  const firstInRange = clampDate(viewMonth, minDate, maxDate);
  const focusTarget = inGrid(focusedDay)
    ? focusedDay
    : inView(selectedDate)
      ? startOfDay(selectedDate)
      : inView(clampedToday)
        ? clampedToday
        : inView(firstInRange)
          ? firstInRange
          : viewMonth;
  const focusIso = formatISODate(focusTarget);

  const moveFocus = (next: Date) => {
    const target = clampDate(next, minDate, maxDate);
    setFocusedDay(target);
    if (!isSameMonth(target, viewMonth)) setViewMonth(startOfMonth(target));
  };

  const navigateMonth = (delta: number) => {
    const nextView = addMonths(viewMonth, delta);
    const moved = clampDate(addMonths(focusTarget, delta), minDate, maxDate);
    setViewMonth(nextView);
    // From a day of the previous/next month the moved day may fall outside the new month: the
    // focused day is then derived again (selected, today or the first day of the month).
    setFocusedDay(isSameMonth(moved, nextView) ? moved : null);
  };

  /** Pointer (or assistive technology) focus on a day makes it the roving day; the month stays. */
  const handleDayFocus = (day: Date) => {
    if (!isSameDay(day, focusTarget)) setFocusedDay(day);
  };

  const previousDisabled = !!minDate && addDays(viewMonth, -1) < startOfDay(minDate);
  const nextDisabled = !!maxDate && addMonths(viewMonth, 1) > startOfDay(maxDate);

  const weekdays = React.useMemo(
    () => getWeekdayNames(locale, firstDayOfWeek),
    [locale, firstDayOfWeek],
  );

  /* ---- elements, popup primitives ---------------------------------- */

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement | null>(null);
  const gridRef = React.useRef<HTMLTableElement | null>(null);
  const surfaceRef = React.useRef<HTMLDivElement | null>(null);
  /** Where focus goes when the calendar closes (`null`: back to the toggle). */
  const restoreTargetRef = React.useRef<HTMLElement | null>(null);
  const [surface, setSurface] = React.useState<HTMLDivElement | null>(null);
  const inputRefs = useMergedRefs<HTMLInputElement>(controlRef, inputRef);

  const dialogId = useId('datepicker-dialog');
  const headingId = useId('datepicker-heading');
  const gridId = useId('datepicker-grid');
  const errorId = useId('datepicker-error');

  const close = (restoreTo: HTMLElement | null) => {
    restoreTargetRef.current = restoreTo;
    setOpen(false);
  };

  const { layerId } = useDismiss({
    open: isOpen,
    onDismiss: (reason, event) => {
      // An outside press on another control hands focus to it (the trap held it until now);
      // otherwise focus returns to where the calendar was opened from.
      const target =
        reason === 'outside-press' && event.target instanceof Element
          ? event.target.closest<HTMLElement>(FOCUSABLE_SELECTOR)
          : null;
      close(target ?? (openedFromInput ? inputRef.current : null));
    },
    refs: [surfaceRef, toggleRef],
    anchorRef: toggleRef,
    kind: 'modal',
  });

  const { setReference, setFloating, floatingProps } = usePopupPosition({
    open: isOpen,
    side: 'bottom',
    align: 'start',
  });
  const surfaceRefs = useMergedRefs<HTMLDivElement>(surfaceRef, setSurface, setFloating);

  useFocusTrap(surface, {
    enabled: isOpen,
    layerId,
    initialFocus: () => gridRef.current?.querySelector<HTMLElement>('button[tabindex="0"]') ?? null,
  });

  useRestoreFocus({
    enabled: isOpen,
    container: surface,
    triggerRef: toggleRef,
    finalFocusRef: restoreTargetRef,
    onlyIfFocusInside: true,
  });

  // A new opening starts without a restore target (the toggle returns focus to itself, Escape to
  // where the calendar was opened from).
  React.useLayoutEffect(() => {
    if (isOpen) restoreTargetRef.current = null;
  }, [isOpen]);

  // Roving focus: while the grid holds focus, focus follows the focused day.
  React.useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const active = grid.ownerDocument.activeElement;
    if (!active || !grid.contains(active)) return;
    const button = grid.querySelector<HTMLElement>(`button[data-date="${focusIso}"]`);
    if (button && button !== active) button.focus();
  }, [focusIso]);

  /* ---- forms and Field --------------------------------------------- */

  const field = useFieldContext();
  const isRequired = required ?? field?.required ?? false;
  // Like a native readonly input, a read-only picker is barred from constraint validation (the
  // user could not fix it); its value is still submitted.
  const validates = isRequired && !readOnly;
  const showOwnError = invalid !== null && !field?.hasErrorMessage;
  const fieldProps = useFieldControl({
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': joinIds(ariaDescribedBy, showOwnError ? errorId : undefined),
    'aria-invalid': invalid !== null ? true : ariaInvalid,
    // An explicit `required={false}` wins over a required Field, so aria-required matches
    // `isRequired`.
    'aria-required': ariaRequired ?? required,
  });
  const invalidLook = isInvalidLook(false, fieldProps['aria-invalid']);

  // Through the commit path: the default is emitted as local midnight, and only when it names
  // another day; the typed text and its error are dropped.
  useFormReset(inputRef, () => commitDate(defaultValue ?? null), form);

  // Read-only pickers offer no clear action (the value cannot change).
  const showClear = clearable && !readOnly && selectedDate !== null;

  /* ---- handlers ---------------------------------------------------- */

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!interactive) return;
    setDraft(event.target.value);
    setInvalid(null);
  };

  const handleInputKeyDown = composeEventHandlers(
    onKeyDown,
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Keys that belong to an IME composition (its confirming Enter) are left to the IME.
      if (!interactive || event.nativeEvent.isComposing) return;
      if (event.key === 'Enter' && draft !== null) {
        // An edit is committed instead of submitting the form; untouched text lets Enter submit.
        event.preventDefault();
        commitDraft(draft);
      } else if (
        event.key === 'Tab' &&
        !event.shiftKey &&
        showClear &&
        draft !== null &&
        !draft.trim()
      ) {
        // Erased text clears the value, and with it the clear button, the next tab stop. It is
        // settled before Tab moves focus (the blur would settle it while focus moves to that
        // button), so focus moves on to the calendar button instead of dropping to <body> with
        // the clear button (C-DISABLED).
        flushSync(() => commitDraft(draft));
      } else if (event.key === 'ArrowDown' && event.altKey && !isOpen) {
        event.preventDefault();
        // The edit is committed first, so the calendar opens on the typed month; rejected text is
        // kept and reported once (the blur that follows does not report it again).
        if (draft !== null && invalid === null) commitDraft(draft);
        setOpenedFromInput(true);
        setOpen(true);
      }
    },
  );

  const handleInputBlur = composeEventHandlers(onBlur, () => {
    // Text already rejected (Enter, Alt+ArrowDown) is kept without being reported again.
    if (interactive && draft !== null && invalid === null) commitDraft(draft);
  });

  const handleToggle = () => {
    if (!interactive) return;
    restoreTargetRef.current = null;
    setOpenedFromInput(false);
    setOpen(!isOpen);
  };

  const handleClear = () => {
    if (!interactive) return;
    commitDate(null);
    inputRef.current?.focus();
  };

  // The clear button keeps focus on the input: its blur would otherwise commit (or reject) the
  // edited text just before the clear, emitting twice for one click.
  const handleClearMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const selectDate = (day: Date) => {
    if (!interactive || isUnavailable(day)) return;
    commitDate(day);
    close(inputRef.current);
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.nativeEvent.isComposing) return;
    // Consumed here, so enclosing layers (a Dialog around the picker) ignore it.
    event.preventDefault();
    close(openedFromInput ? inputRef.current : null);
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const weekOffset = (focusTarget.getDay() - firstDayOfWeek + 7) % 7;
    let next: Date;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const intent = getArrowIntent(event.key, {
          orientation: 'horizontal',
          dir: getDirection(event.currentTarget),
        });
        next = addDays(focusTarget, intent === 'next' ? 1 : -1);
        break;
      }
      case 'ArrowDown':
        next = addDays(focusTarget, 7);
        break;
      case 'ArrowUp':
        next = addDays(focusTarget, -7);
        break;
      case 'PageDown':
        next = addMonths(focusTarget, event.shiftKey ? 12 : 1);
        break;
      case 'PageUp':
        next = addMonths(focusTarget, event.shiftKey ? -12 : -1);
        break;
      case 'Home':
        next = addDays(focusTarget, -weekOffset);
        break;
      case 'End':
        next = addDays(focusTarget, 6 - weekOffset);
        break;
      default:
        // Enter and Space activate the focused day button natively (click).
        return;
    }
    event.preventDefault();
    moveFocus(next);
  };

  /* ---- render ------------------------------------------------------ */

  const inputText = draft ?? (selectedDate ? format(selectedDate) : '');

  let errorMessage = '';
  if (invalid === 'unparseable') {
    errorMessage = (labels?.invalidDate ?? defaultInvalidDateLabel)(
      hasCustomParse ? undefined : getLocaleDateFormat(locale).pattern,
    );
  } else if (invalid === 'out-of-range' && (minDate || maxDate)) {
    errorMessage = (labels?.outOfRange ?? defaultOutOfRangeLabel)(
      minDate ? format(startOfDay(minDate)) : undefined,
      maxDate ? format(startOfDay(maxDate)) : undefined,
    );
  } else if (invalid === 'disabled') {
    errorMessage = labels?.unavailableDate ?? 'This date is not available.';
  }

  return (
    <div {...rest} ref={ref} className={cn('relative inline-flex flex-col', className)}>
      <div ref={setReference} className="relative flex items-center">
        <input
          ref={inputRefs}
          type="text"
          {...fieldProps}
          aria-errormessage={ariaErrorMessage}
          aria-details={ariaDetails}
          value={inputText}
          onChange={handleInputChange}
          onFocus={onFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onKeyUp={onKeyUp}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
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
            invalidLook && inputInvalid,
            showClear ? 'pe-14' : 'pe-8',
          )}
        />
        {showClear && (
          <button
            type="button"
            aria-label={labels?.clear ?? 'Clear date'}
            disabled={disabled}
            onMouseDown={handleClearMouseDown}
            onClick={handleClear}
            className={cn(ICON_BUTTON_CLASSES, 'end-7', focusRing, disabledStyles)}
          >
            <DismissIcon />
          </button>
        )}
        <button
          ref={toggleRef}
          type="button"
          aria-label={labels?.openCalendar ?? 'Open calendar'}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? dialogId : undefined}
          disabled={disabled || readOnly}
          onClick={handleToggle}
          className={cn(ICON_BUTTON_CLASSES, 'end-1', focusRing, disabledStyles)}
        >
          <CalendarIcon />
        </button>
      </div>
      {showOwnError && (
        <p id={errorId} role="alert" className="mt-1 text-caption-1 text-error">
          {errorMessage}
        </p>
      )}
      <HiddenInput
        name={name}
        form={form}
        disabled={disabled}
        value={selectedDate ? formatISODate(selectedDate) : ''}
        type="text"
        required={validates}
        onInvalid={() => inputRef.current?.focus()}
      />
      {isOpen && (
        <Portal layerId={layerId}>
          <div
            ref={surfaceRefs}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            {...floatingProps}
            data-state="open"
            onKeyDown={handleDialogKeyDown}
            className="rounded-md border border-border bg-background p-3 text-foreground shadow-16"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={labels?.previousMonth ?? 'Previous month'}
                aria-controls={gridId}
                {...focusableDisabledProps(previousDisabled)}
                onClick={preventIfDisabled(previousDisabled, () => navigateMonth(-1))}
                className={cn(NAV_BUTTON_CLASSES, focusRing, disabledStyles)}
              >
                <ChevronLeftIcon className="wave-rtl:-scale-x-100" />
              </button>
              <h2 id={headingId} aria-live="polite" className="text-body-1 font-semibold">
                {formatMonthYear(viewMonth, locale)}
              </h2>
              <button
                type="button"
                aria-label={labels?.nextMonth ?? 'Next month'}
                aria-controls={gridId}
                {...focusableDisabledProps(nextDisabled)}
                onClick={preventIfDisabled(nextDisabled, () => navigateMonth(1))}
                className={cn(NAV_BUTTON_CLASSES, focusRing, disabledStyles)}
              >
                <ChevronRightIcon className="wave-rtl:-scale-x-100" />
              </button>
            </div>
            <table
              ref={gridRef}
              id={gridId}
              role="grid"
              aria-labelledby={headingId}
              onKeyDown={handleGridKeyDown}
              className="border-collapse"
            >
              <thead>
                <tr>
                  {weekdays.map((weekday) => (
                    <th
                      key={weekday.long}
                      scope="col"
                      abbr={weekday.long}
                      aria-label={weekday.long}
                      className="h-8 w-8 text-center text-caption-1 font-normal text-muted-foreground"
                    >
                      <span aria-hidden="true">{weekday.short}</span>
                      <span className="sr-only">{weekday.long}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, row) => (
                  // Rows and cells are keyed by position, so the focused button survives a
                  // month change and focus stays in the grid while it moves to the new day.
                  <tr key={row}>
                    {week.map((day, column) => {
                      const iso = formatISODate(day);
                      const isSelected = isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, today);
                      const isFocused = iso === focusIso;
                      const unavailable = isUnavailable(day);
                      return (
                        <td key={column} role="gridcell" aria-selected={isSelected} className="p-0">
                          {/* Focus rests on the button, and screen readers do not reliably
                              announce the gridcell's aria-selected from inside it: the selected
                              day's button is also pressed. */}
                          <button
                            type="button"
                            tabIndex={isFocused ? 0 : -1}
                            aria-label={formatDayLabel(day, locale)}
                            aria-pressed={isSelected || undefined}
                            aria-current={isToday ? 'date' : undefined}
                            {...focusableDisabledProps(unavailable)}
                            data-date={iso}
                            data-selected={isSelected ? '' : undefined}
                            data-today={isToday ? '' : undefined}
                            data-outside={isSameMonth(day, viewMonth) ? undefined : ''}
                            onFocus={() => handleDayFocus(day)}
                            onClick={() => selectDate(day)}
                            className={cn(
                              DAY_CLASSES,
                              focusRing,
                              isSelected && forcedColors.selectedLeaf,
                            )}
                          >
                            {formatDayNumber(day, locale)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Portal>
      )}
    </div>
  );
};

DatePicker.displayName = 'DatePicker';
