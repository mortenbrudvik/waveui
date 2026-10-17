import * as React from 'react';
import type { DayOfWeek } from '../../lib/types';
import { cn } from '../../lib/cn';
import { focusableDisabledProps, joinIds, preventIfDisabled } from '../../lib/aria';
import { calendarClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { disabledStyles, focusRing } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { CalendarDayGrid, type CalendarDayGridPartClassNames } from './Calendar.views';
import {
  addDays,
  addMonths,
  clampDate,
  formatISODate,
  formatMonthYear,
  getCalendarDays,
  isDateInRange,
  isSameDay,
  isSameMonth,
  isValidLocaleTag,
  startOfDay,
  startOfMonth,
} from './dateUtils';

/**
 * The calendar's built-in texts, for localization. Each member is optional and falls back to its
 * English default. Month and weekday names and the day labels follow `locale`.
 */
export interface CalendarLabels {
  /** Name of the previous-month button.
   * @default 'Previous month'
   */
  previousMonth?: string;
  /** Name of the next-month button.
   * @default 'Next month'
   */
  nextMonth?: string;
  /** Name of the previous-year button of the month view.
   * @default 'Previous year'
   */
  previousYear?: string;
  /** Name of the next-year button of the month view.
   * @default 'Next year'
   */
  nextYear?: string;
  /** Name of the previous-decade button of the year view.
   * @default 'Previous decade'
   */
  previousDecade?: string;
  /** Name of the next-decade button of the year view.
   * @default 'Next decade'
   */
  nextDecade?: string;
  /** Description of the heading button that shows the month view.
   * @default 'Choose a month'
   */
  chooseMonth?: string;
  /** Description of the heading button that shows the year view.
   * @default 'Choose a year'
   */
  chooseYear?: string;
  /** Name of the "Go to today" button.
   * @default 'Go to today'
   */
  goToToday?: string;
  /** Hidden text of the week-number column header.
   * @default 'Week'
   */
  week?: string;
  /** Name of a week-number row header.
   * @default (week) => `Week ${week}`
   */
  weekNumber?: (week: number) => string;
  /** Name of a marked day, built from its default name.
   * @default (dayLabel) => `${dayLabel}, marked`
   */
  markedDay?: (dayLabel: string) => string;
  /**
   * Said in the calendar's description while it is required (its role cannot carry
   * `aria-required`).
   * @default 'Required'
   */
  required?: string;
}

/** Second argument of `Calendar`'s `onValueChange`. */
export interface CalendarValueChangeDetails {
  /** The selected days in order (local midnight): the picked day; `[]` for `null`. */
  range: Date[];
}

/** Properties for the Calendar component. */
export interface CalendarProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Controlled selected day (`null` for none). */
  value?: Date | null;
  /**
   * Initial selected day for uncontrolled usage.
   * @default null
   */
  defaultValue?: Date | null;
  /**
   * Called with the new day (local midnight) when the selected day changes: a pick of another day
   * or a form reset (Fluent's `onSelectDate` fires on every pick). Picking the selected day again
   * does nothing. WaveUI always passes `details`.
   */
  onValueChange?: (date: Date | null, details?: CalendarValueChangeDetails) => void;
  /** Earliest available day (the whole day is included). */
  minDate?: Date;
  /** Latest available day (the whole day is included). */
  maxDate?: Date;
  /** Returns `true` for days that cannot be picked (called with local-midnight dates). */
  disabledDates?: (date: Date) => boolean;
  /**
   * First day of the week (0 = Sunday, 1 = Monday, etc.).
   * @default 0
   */
  firstDayOfWeek?: DayOfWeek;
  /**
   * BCP 47 locale of the month text, the weekday names and the day labels. Pass it when rendering
   * on the server, so the server and the browser render the same text. The grid is Gregorian, as
   * in DatePicker. A tag `Intl` rejects (the POSIX `de_DE`, a typo) falls back to the runtime
   * default locale (development warning).
   * @default the runtime default locale
   */
  locale?: string;
  /**
   * The day marked as today (`aria-current="date"`), and the tab stop when no day is selected in
   * the shown month. Without it, the server HTML and the hydration render mark no day and the
   * browser applies the current date once hydrated: pass it when rendering on the server, so the
   * mark is in the HTML.
   * @default the current date (applied after hydration when not passed)
   */
  today?: Date;
  /**
   * The month shown first when there is no value (Fluent's `initialPickerDate`), clamped into
   * `minDate`/`maxDate` like the value's month and today's.
   * @default today's month
   */
  initialVisibleDate?: Date;
  /** Names of the month buttons and the required hint, for localization. */
  labels?: CalendarLabels;
  /** Form field name: the day is submitted as ISO `yyyy-mm-dd` (hidden input). */
  name?: string;
  /** Id of the `<form>` the value belongs to, when the calendar is outside it. */
  form?: string;
  /**
   * Blocks form submission while no day is selected; the form's report focuses the calendar's
   * tab stop. Said in the description (`labels.required`), as the group cannot carry
   * `aria-required`.
   */
  required?: boolean;
  /** Ref to the root element. */
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * Internal: the stable classes of a calendar view's parts, passed in by the component that
 * renders the view (DatePicker passes its own).
 */
export interface CalendarViewPartClassNames extends CalendarDayGridPartClassNames {
  /** On the row of the month buttons and the heading. */
  header?: string;
  /** On the previous-month button. */
  previousMonthButton?: string;
  /** On the month heading. */
  heading?: string;
  /** On the next-month button. */
  nextMonthButton?: string;
}

/** Internal props of {@link CalendarView}. */
export interface CalendarViewProps {
  /** The selected day, or `null` for none. */
  value: Date | null;
  /** Called with an available day the user picks (click, Enter or Space on a day button). */
  onPick: (date: Date) => void;
  /** Earliest available day (the whole day is included). */
  minDate?: Date;
  /** Latest available day (the whole day is included). */
  maxDate?: Date;
  /** Returns `true` for days that cannot be picked (called with local-midnight dates). */
  disabledDates?: (date: Date) => boolean;
  /** First day of the week (0 = Sunday). */
  firstDayOfWeek: DayOfWeek;
  /** BCP 47 locale of the heading, the weekday names and the day labels. */
  locale?: string;
  /**
   * The day marked as today; `null` while it is unknown (the server HTML and the hydration render
   * of a Calendar without `today`): no day is marked, and the tab stop skips today.
   * @default the current date
   */
  today?: Date | null;
  /** The month shown first when there is no value (else today's, else the clock's). */
  initialVisibleDate?: Date;
  /** Names of the month buttons. */
  labels?: CalendarLabels;
  /** Element of the month heading: `h2` in DatePicker's dialog (its title), else `div`. */
  headingAs: 'h2' | 'div';
  /** Id of the month heading (it labels the grid; DatePicker also labels its dialog with it). */
  headingId: string;
  /** Stable classes of the view's parts. */
  partClassNames?: CalendarViewPartClassNames;
}

// Every button sets its own padding and background (C-NATIVE): an app-wide `button` rule would
// otherwise pad and fill them.
const NAV_BUTTON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover';

/** The 42 grid days as 6 weeks. */
function toWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * Internal: the header (previous-month button, month heading, next-month button) and the day grid
 * of a calendar, with the shown month and the roving day as state. It renders no element of its
 * own (a fragment). It opens on the month of `value`, else `initialVisibleDate`'s, else today's,
 * clamped into `minDate`/`maxDate`, and keeps that month until navigated or until `value` changes
 * to a day of another month, whose month it then shows (DatePicker mounts it with each opening of
 * its dialog).
 */
export const CalendarView = ({
  value,
  onPick,
  minDate,
  maxDate,
  disabledDates,
  firstDayOfWeek,
  locale,
  today: todayProp,
  initialVisibleDate,
  labels,
  headingAs: Heading,
  headingId,
  partClassNames,
}: CalendarViewProps) => {
  const today =
    todayProp === undefined ? startOfDay(new Date()) : todayProp && startOfDay(todayProp);
  const [viewMonth, setViewMonth] = React.useState<Date>(() =>
    // Without a value, an `initialVisibleDate` or a known today the month comes from the clock:
    // on the server, the server's (the Calendar warns after such a hydration render).
    startOfMonth(clampDate(value ?? initialVisibleDate ?? today ?? new Date(), minDate, maxDate)),
  );
  const [focusedDay, setFocusedDay] = React.useState<Date | null>(null);
  const gridRef = React.useRef<HTMLTableElement | null>(null);
  const gridId = useId('calendar-grid');

  // A value that changes to a day of another month shows that month (adjusted during render,
  // C-HOOKS): a controlled value set by the parent, a form reset, or a picked day of the next
  // month.
  const valueIso = value ? formatISODate(value) : '';
  const [seenValueIso, setSeenValueIso] = React.useState(valueIso);
  if (seenValueIso !== valueIso) {
    setSeenValueIso(valueIso);
    if (value && !isSameMonth(value, viewMonth)) {
      setViewMonth(startOfMonth(clampDate(value, minDate, maxDate)));
      setFocusedDay(null);
    }
  }

  const isUnavailable = (date: Date) =>
    !isDateInRange(date, minDate, maxDate) || !!disabledDates?.(startOfDay(date));

  const weeks = React.useMemo(
    () => toWeeks(getCalendarDays(viewMonth, firstDayOfWeek)),
    [viewMonth, firstDayOfWeek],
  );

  // The focused day is derived: the day moved to while it is shown (a pointer-focused day of the
  // previous/next month counts too), else the selected day of the month, else today (clamped into
  // the range; skipped while today is unknown), else the first available day of the month.
  const inView = (date: Date | null | undefined): date is Date =>
    !!date && isSameMonth(date, viewMonth);
  const inGrid = (date: Date | null | undefined): date is Date =>
    !!date && date >= weeks[0][0] && date <= weeks[weeks.length - 1][6];
  const clampedToday = today && clampDate(today, minDate, maxDate);
  const firstInRange = clampDate(viewMonth, minDate, maxDate);
  const focusTarget = inGrid(focusedDay)
    ? focusedDay
    : inView(value)
      ? startOfDay(value)
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

  // Roving focus: while the grid holds focus, focus follows the focused day, also when the month
  // changes under it (the buttons are keyed by position, so the focused one shows another day).
  const viewIso = formatISODate(viewMonth);
  React.useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const active = grid.ownerDocument.activeElement;
    if (!active || !grid.contains(active)) return;
    const button = grid.querySelector<HTMLElement>(`button[data-date="${focusIso}"]`);
    if (button && button !== active) button.focus();
  }, [focusIso, viewIso]);

  return (
    <>
      <div className={cn(partClassNames?.header, 'mb-2 flex items-center justify-between gap-2')}>
        <button
          type="button"
          aria-label={labels?.previousMonth ?? 'Previous month'}
          aria-controls={gridId}
          {...focusableDisabledProps(previousDisabled)}
          onClick={preventIfDisabled(previousDisabled, () => navigateMonth(-1))}
          className={cn(
            partClassNames?.previousMonthButton,
            NAV_BUTTON_CLASSES,
            focusRing,
            disabledStyles,
          )}
        >
          <ChevronLeftIcon className="wave-rtl:-scale-x-100" />
        </button>
        <Heading
          id={headingId}
          aria-live="polite"
          className={cn(partClassNames?.heading, 'text-body-1 font-semibold')}
        >
          {formatMonthYear(viewMonth, locale)}
        </Heading>
        <button
          type="button"
          aria-label={labels?.nextMonth ?? 'Next month'}
          aria-controls={gridId}
          {...focusableDisabledProps(nextDisabled)}
          onClick={preventIfDisabled(nextDisabled, () => navigateMonth(1))}
          className={cn(
            partClassNames?.nextMonthButton,
            NAV_BUTTON_CLASSES,
            focusRing,
            disabledStyles,
          )}
        >
          <ChevronRightIcon className="wave-rtl:-scale-x-100" />
        </button>
      </div>
      <CalendarDayGrid
        ref={gridRef}
        id={gridId}
        headingId={headingId}
        viewMonth={viewMonth}
        weeks={weeks}
        focusTarget={focusTarget}
        value={value}
        today={today}
        firstDayOfWeek={firstDayOfWeek}
        locale={locale}
        isUnavailable={isUnavailable}
        onMoveFocus={moveFocus}
        onDayFocus={handleDayFocus}
        onPick={onPick}
        partClassNames={partClassNames}
      />
    </>
  );
};

CalendarView.displayName = 'CalendarView';

// The Calendar's parts carry its own stable classes (the view's keys name the day view's buttons).
const CALENDAR_PART_CLASS_NAMES: CalendarViewPartClassNames = {
  header: calendarClassNames.header,
  previousMonthButton: calendarClassNames.previousButton,
  heading: calendarClassNames.heading,
  nextMonthButton: calendarClassNames.nextButton,
  grid: calendarClassNames.grid,
  weekday: calendarClassNames.weekday,
  day: calendarClassNames.day,
};

/**
 * A month calendar for picking one day, without a text input: the grid of DatePicker's dialog,
 * placed in the page (APG date picker grid).
 *
 * - **Structure**: a `role="group"` root, named with `aria-label`/`aria-labelledby` or by a
 *   surrounding `Field`, around the previous-month button, the month text (a polite live region
 *   that labels the grid), the next-month button and a `role="grid"` table of six weeks. The
 *   month text is no heading, since a component cannot know the page's heading levels.
 * - **Keyboard**: one tab stop in the grid, the focused day (the selected day of the shown month,
 *   else today, else the first available day). Arrow keys move by day and week (mirrored in RTL),
 *   PageUp/PageDown by month, Shift+PageUp/PageDown by year (the day is clamped to the month),
 *   Home/End to the start and end of the week; Enter, Space and a click pick the day. Unavailable
 *   days (`minDate`, `maxDate`, `disabledDates`) stay focusable and are `aria-disabled`.
 * - **Value**: `onValueChange` fires only when the day changes, with local midnight and `details`;
 *   picking the selected day again does nothing. A value that moves to another month shows that
 *   month. The selected day is `aria-selected` on its gridcell and `aria-pressed` on its button;
 *   today is `aria-current="date"`.
 * - **Forms and Field**: `name`/`required` add a hidden input (ISO `yyyy-mm-dd`) that resets with
 *   its form (to `defaultValue`); a required calendar that the form reports missing focuses its
 *   tab stop. Inside a `Field` the group takes the label, the description and `aria-invalid`; it
 *   says "required" in its description (`labels.required`), since a group cannot carry
 *   `aria-required`.
 * - **Server rendering**: pass `locale`, and `today` (or `initialVisibleDate`, or a value) so the
 *   server and the browser render the same month and mark the same day. Without `today` the
 *   server HTML marks no day and the browser marks today once hydrated; without any date the
 *   month shown first comes from the server's clock (development warning).
 *
 * @example
 * <Calendar aria-label="Due date" defaultValue={new Date(2025, 5, 12)} onValueChange={setDue} />
 */
export const Calendar = ({
  value: valueProp,
  defaultValue,
  onValueChange,
  minDate,
  maxDate,
  disabledDates,
  firstDayOfWeek = 0,
  locale,
  today: todayProp,
  initialVisibleDate,
  labels,
  name,
  form,
  required,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  className,
  ref,
  ...rest
}: CalendarProps) => {
  const [value, setValue] = useControllable<Date | null>(valueProp, defaultValue ?? null, (next) =>
    onValueChange?.(next, { range: next ? [next] : [] }),
  );

  /** Commits a day (or `null`) as local midnight; nothing is emitted when it is the same day. */
  const commit = (next: Date | null) => {
    const normalized = next ? startOfDay(next) : null;
    const unchanged = normalized ? isSameDay(normalized, value) : value === null;
    if (!unchanged) setValue(normalized);
  };

  // Today is unknown in the server HTML and the hydration render (the two clocks may name
  // different days); the browser applies it once hydrated.
  const isClient = useIsClient();
  const today = todayProp ?? (isClient ? new Date() : null);

  React.useEffect(() => {
    if (locale !== undefined && !isValidLocaleTag(locale)) {
      warnOnce(
        `Calendar:invalid-locale:${locale}`,
        `Calendar: \`locale\` "${locale}" is not a valid BCP 47 language tag (use hyphens, as in ` +
          '"en-US"). The runtime default locale formats the dates instead, so the server and the ' +
          'browser may render different text.',
      );
    }
  }, [locale]);
  const hasDate = todayProp !== undefined || initialVisibleDate !== undefined || value !== null;
  React.useEffect(() => {
    // Effects run only in the browser, where `isClient` is false after a hydration render alone.
    if (!isClient && !hasDate) {
      warnOnce(
        'Calendar:hydration-date',
        'Calendar: rendered on the server without `today`, `initialVisibleDate` or `value`, so ' +
          "the month shown first comes from the server's clock and the browser may show another " +
          'month. Pass `today` or `initialVisibleDate`.',
      );
    }
  }, [isClient, hasDate]);

  const field = useFieldContext();
  const {
    'aria-required': fieldAriaRequired,
    'aria-describedby': fieldDescribedBy,
    ...fieldProps
  } = useFieldControl(
    {
      id,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      // An explicit `required={false}` wins over a required Field, so the hint matches
      // `isRequired`.
      'aria-required': ariaRequired ?? required,
    },
    { labelable: false },
  );
  const isRequired = required ?? field?.required ?? false;
  // `group` does not allow aria-required (a consumer's included): the description says it.
  const requiredHintId = useId('calendar-required');
  const showRequiredHint = fieldAriaRequired !== undefined && String(fieldAriaRequired) !== 'false';

  const headingId = useId('calendar-heading');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = useMergedRefs<HTMLDivElement>(ref, rootRef);

  useFormReset(rootRef, () => commit(defaultValue ?? null), form);

  const focusTabStop = () => {
    rootRef.current
      ?.querySelector<HTMLElement>('[data-wave-calendar-grid] button[tabindex="0"]')
      ?.focus();
  };

  return (
    <div
      role="group"
      {...fieldProps}
      aria-describedby={joinIds(fieldDescribedBy, showRequiredHint && requiredHintId)}
      className={cn(
        calendarClassNames.root,
        'relative inline-flex flex-col text-foreground',
        className,
      )}
      {...rest}
      ref={mergedRef}
    >
      <CalendarView
        value={value}
        onPick={commit}
        minDate={minDate}
        maxDate={maxDate}
        disabledDates={disabledDates}
        firstDayOfWeek={firstDayOfWeek}
        locale={locale}
        today={today}
        initialVisibleDate={initialVisibleDate}
        labels={labels}
        headingAs="div"
        headingId={headingId}
        partClassNames={CALENDAR_PART_CLASS_NAMES}
      />
      {showRequiredHint && (
        <span id={requiredHintId} hidden>
          {labels?.required ?? 'Required'}
        </span>
      )}
      <HiddenInput
        type="text"
        name={name}
        form={form}
        value={value ? formatISODate(value) : ''}
        required={isRequired}
        onInvalid={focusTabStop}
      />
    </div>
  );
};

Calendar.displayName = 'Calendar';
