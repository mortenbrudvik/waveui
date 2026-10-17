import * as React from 'react';
import type { DayOfWeek, FirstWeekOfYear } from '../../lib/types';
import { cn } from '../../lib/cn';
import { focusableDisabledProps, joinIds, preventIfDisabled } from '../../lib/aria';
import { calendarClassNames } from '../../lib/classNames';
import { warnOnce } from '../../lib/dev';
import { isOwnEvent } from '../../lib/events';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { disabledStyles, focusRing } from '../../lib/styles';
import { useControllable } from '../../hooks/useControllable';
import { useFieldContext, useFieldControl } from '../../hooks/useFieldControl';
import { useFormReset } from '../../hooks/useFormReset';
import { useId } from '../../hooks/useId';
import { useIsClient } from '../../hooks/useIsClient';
import { useMergedRefs } from '../../hooks/useMergedRefs';
import { HiddenInput } from '../internal/HiddenInput';
import { makeDate } from '../../lib/date';
import {
  CalendarDayGrid,
  CalendarPickerGrid,
  type CalendarDayGridPartClassNames,
} from './Calendar.views';
import {
  addDays,
  addMonths,
  clampDate,
  formatDecade,
  formatISODate,
  formatMonthShort,
  formatMonthYear,
  formatYear,
  getCalendarDays,
  getDecadeStart,
  getDecadeYears,
  getSelectionRange,
  getYearMonths,
  isDateInRange,
  isDayUnavailable,
  isMonthOutOfRange,
  isSameDay,
  isSameMonth,
  isValidLocaleTag,
  isYearOutOfRange,
  startOfDay,
  startOfMonth,
  type CalendarSelectionRange,
} from './dateUtils';

/**
 * The built-in texts of the calendar, for localization: the names of the navigation buttons in
 * the day, month and year views, the hints of the heading button, the "Go to today" button, the
 * week-number column and the marked days, and (Calendar only) the required hint. Each member is
 * optional and falls back to its English default. Month and weekday names and the day labels follow
 * `locale`. DatePicker's labels extend this type.
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
   * Said in the calendar's description while it is required (`required`, a required Field, or a
   * consumer `aria-required` alone), since its role cannot carry `aria-required`.
   * @default 'Required'
   */
  required?: string;
}

/** Second argument of `Calendar`'s `onValueChange`. */
export interface CalendarValueChangeDetails {
  /**
   * The selected days in order (local midnight): the picked day, or with `selectionRange` its
   * week, work week or month (the days that are not available left out); `[]` for `null`.
   */
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
  /**
   * Turns the month text into a button that shows the month view (the 12 months of the year),
   * whose heading, the year, is a button to the year view (a decade with the year before and
   * after it). A picked year shows its months and a picked month its days; Escape goes back a
   * level to the period shown before. Fluent's `isMonthPickerVisible`, here as a drill-down in one
   * pane.
   * @default true
   */
  showMonthPicker?: boolean;
  /**
   * Adds a leading column of week numbers: a row header per week (`Week 23`, from
   * `labels.weekNumber`) under a header cell named `labels.week`. The numbers follow
   * `firstDayOfWeek` and `firstWeekOfYear`; the column is not focusable and the keys skip it.
   * @default false
   */
  showWeekNumbers?: boolean;
  /**
   * Which week is week 1 of a year. ISO 8601 is `'first-four-day-week'` with `firstDayOfWeek={1}`.
   * @default 'first-day'
   */
  firstWeekOfYear?: FirstWeekOfYear;
  /**
   * Adds a footer button that shows today's month in the day view and focuses today without
   * selecting it. It is disabled while today is outside `minDate`/`maxDate`.
   * @default false
   */
  showGoToToday?: boolean;
  /**
   * Days that draw a dot under the number (in the text colour of the day) and say "marked" in
   * their name (`labels.markedDay`); also `data-marked` on the day's button (Fluent's
   * `getMarkedDays`). Called with local-midnight dates.
   */
  markedDates?: (date: Date) => boolean;
  /**
   * Replaces the content inside a day's button, which keeps its role, state and keys;
   * `defaultContent` is the day number. The content must be non-interactive (no buttons or links),
   * and the button's name does not follow it: set the name with `dayLabel`. The marked-day dot is
   * drawn next to the content.
   */
  renderDay?: (date: Date, defaultContent: React.ReactNode) => React.ReactNode;
  /**
   * The accessible name of a day, from its default name (the date in words, `Monday, June 2,
   * 2025`, with `labels.markedDay` applied for a marked day). Use it to say what `renderDay` shows.
   */
  dayLabel?: (date: Date, defaultLabel: string) => string;
  /**
   * What a pick selects: the day, or its week, work week (`workWeekDays`) or month. The value is
   * the picked day, `details.range` the selected days, and every day of the range is
   * `aria-selected`, `aria-pressed` and `data-selected`. Days that are not available are left
   * out. Fluent's `dateRangeType`.
   * @default 'day'
   */
  selectionRange?: CalendarSelectionRange;
  /**
   * The days of `selectionRange="work-week"` (0 = Sunday), within the week that starts on
   * `firstDayOfWeek`.
   * @default [1, 2, 3, 4, 5]
   */
  workWeekDays?: readonly DayOfWeek[];
  /**
   * Names of the navigation buttons, the heading button's hints, the "Go to today" button, the
   * week-number column, the marked days and the required hint, for localization.
   */
  labels?: CalendarLabels;
  /** Form field name: the day is submitted as ISO `yyyy-mm-dd` (hidden input). */
  name?: string;
  /** Id of the `<form>` the value belongs to, when the calendar is outside it. */
  form?: string;
  /**
   * Blocks form submission while no day is selected; the form's report focuses the calendar's
   * tab stop. Said in the description (`labels.required`), as the group cannot carry
   * `aria-required`. A consumer `aria-required` alone also shows that hint (assistive technology
   * only: it does not block submission).
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
  /** On the row of the navigation buttons and the heading. */
  header?: string;
  /** On the previous button (previous month, year or decade). */
  previousMonthButton?: string;
  /** On the heading (the month, the year or the decade). */
  heading?: string;
  /** On the heading's button, which shows the month or the year view. */
  headingButton?: string;
  /** On the next button (next month, year or decade). */
  nextMonthButton?: string;
  /** On each month button of the month view. */
  month?: string;
  /** On each year button of the year view. */
  year?: string;
  /** On the row of the footer buttons. */
  footer?: string;
  /** On the "Go to today" button. */
  todayButton?: string;
  /** On the "Close" button. */
  closeButton?: string;
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
  /**
   * The heading is a button that shows the month view, whose heading shows the year view.
   * @default true
   */
  showMonthPicker?: boolean;
  /** Adds a leading column of week numbers to the day view. @default false */
  showWeekNumbers?: boolean;
  /** Which week is week 1 of a year. @default 'first-day' */
  firstWeekOfYear?: FirstWeekOfYear;
  /** Returns `true` for days that draw a dot and are named "marked". */
  markedDates?: (date: Date) => boolean;
  /** Replaces the content of a day button. */
  renderDay?: (date: Date, defaultContent: React.ReactNode) => React.ReactNode;
  /** The accessible name of a day, from its default name. */
  dayLabel?: (date: Date, defaultLabel: string) => string;
  /**
   * What a pick selects (the day, or its week, work week or month): the days drawn selected. The
   * parent receives only the picked day.
   * @default 'day'
   */
  selectionRange?: CalendarSelectionRange;
  /** The days of the `'work-week'` range. @default [1, 2, 3, 4, 5] */
  workWeekDays?: readonly DayOfWeek[];
  /** Adds a footer button that shows today's month and focuses today. @default false */
  showGoToToday?: boolean;
  /** Adds a footer "Close" button that calls this (DatePicker closes its dialog). */
  onClose?: () => void;
  /** Name of the "Close" button. @default 'Close' */
  closeLabel?: string;
  /** Names of the navigation buttons, the heading button's hints and the footer buttons. */
  labels?: CalendarLabels;
  /** Element of the heading: `h2` in DatePicker's dialog (its title), else `div`. */
  headingAs: 'h2' | 'div';
  /** Id of the heading (it labels the grid; DatePicker also labels its dialog with it). */
  headingId: string;
  /** Stable classes of the view's parts. */
  partClassNames?: CalendarViewPartClassNames;
}

// Every button sets its own padding and background (C-NATIVE): an app-wide `button` rule would
// otherwise pad and fill them.
const NAV_BUTTON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded bg-transparent p-0 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover';

// The heading's button keeps the heading's text style, set on itself (C-NATIVE).
const HEADING_BUTTON_CLASSES =
  'flex h-8 items-center justify-center rounded bg-transparent p-0 px-2 text-body-1 font-semibold text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover';

// The footer's text buttons (C-NATIVE: their own padding and background).
const FOOTER_BUTTON_CLASSES =
  'flex h-8 items-center justify-center rounded bg-transparent p-0 px-3 text-body-1 text-foreground not-disabled:not-aria-disabled:hover:bg-subtle-hover';

/** The days of `'work-week'` unless `workWeekDays` says otherwise (Monday to Friday). */
const DEFAULT_WORK_WEEK_DAYS: readonly DayOfWeek[] = [1, 2, 3, 4, 5];

/** The 42 grid days as 6 weeks. */
function toWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** The years of the year view of the decade starting at `decade` (the year before and after it). */
function inDecadeGrid(year: number, decade: number): boolean {
  return year >= decade - 1 && year <= decade + 10;
}

/** `year` clamped into the years of `[min, max]` (as `clampDate` clamps a day). */
function clampYear(year: number, min?: Date, max?: Date): number {
  if (min && year < min.getFullYear()) return min.getFullYear();
  if (max && year > max.getFullYear()) return max.getFullYear();
  return year;
}

/** Which grid a calendar view shows. */
type CalendarViewKind = 'day' | 'month' | 'year';

/**
 * Internal: the header (the previous button, the heading, the next button), the grid and the
 * optional footer (Go to today, Close) of a calendar, in one of three views: the days of a month, the months of a year (the month view) and
 * the years of a decade (the year view). It renders no element of its own (a fragment). It opens
 * on the day view of the month of `value`, else `initialVisibleDate`'s, else today's, clamped into
 * `minDate`/`maxDate`, and keeps that month until navigated or until `value` changes to a day of
 * another month, whose month it then shows (DatePicker mounts it with each opening of its dialog).
 *
 * With `showMonthPicker`, the day view's heading is a button to the month view, and the month
 * view's heading a button to the year view; a picked year shows its months and a picked month its
 * days. Escape in the year and month views goes back one level to the period shown before (and is
 * consumed, also on the footer's buttons). Each view change moves focus into the new grid in the
 * same commit. The day view can add a week-number column, a dot and a name suffix for marked
 * days, custom day content, and a range around the picked day (`selectionRange`); the footer has
 * "Go to today" (`showGoToToday`) and a Close button (`onClose`).
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
  showMonthPicker = true,
  showWeekNumbers,
  firstWeekOfYear,
  markedDates,
  renderDay,
  dayLabel,
  selectionRange = 'day',
  workWeekDays = DEFAULT_WORK_WEEK_DAYS,
  showGoToToday = false,
  onClose,
  closeLabel,
  labels,
  headingAs: Heading,
  headingId,
  partClassNames,
}: CalendarViewProps) => {
  const today =
    todayProp === undefined ? startOfDay(new Date()) : todayProp && startOfDay(todayProp);
  const [viewState, setView] = React.useState<CalendarViewKind>('day');
  // Without the month picker the headings are no buttons: only the day view exists.
  const view = showMonthPicker ? viewState : 'day';
  if (viewState !== view) setView(view);
  // Day view: the shown month and the day moved to.
  const [viewMonth, setViewMonth] = React.useState<Date>(() =>
    // Without a value, an `initialVisibleDate` or a known today the month comes from the clock:
    // on the server, the server's (the Calendar warns after such a hydration render).
    startOfMonth(clampDate(value ?? initialVisibleDate ?? today ?? new Date(), minDate, maxDate)),
  );
  const [focusedDay, setFocusedDay] = React.useState<Date | null>(null);
  // Month view: the shown year and the month moved to. Year view: the first year of the shown
  // decade and the year moved to. Each view keeps its state while a higher view is shown, so
  // Escape shows the period it showed before.
  const [monthViewYear, setMonthViewYear] = React.useState(() => viewMonth.getFullYear());
  const [focusedMonth, setFocusedMonth] = React.useState<Date | null>(null);
  const [decade, setDecade] = React.useState(() => getDecadeStart(viewMonth.getFullYear()));
  const [focusedYear, setFocusedYear] = React.useState<number | null>(null);
  const gridRef = React.useRef<HTMLTableElement | null>(null);
  /** Set by a view change: the next layout effect moves focus into the new grid. */
  const focusGridRef = React.useRef(false);
  /** Bumped by "Go to today": the next layout effect moves focus to the focused day. */
  const [focusRequest, setFocusRequest] = React.useState(0);
  const gridId = useId('calendar-grid');
  const hintId = useId('calendar-heading-hint');

  // A value that changes to a day of another month shows that month (adjusted during render,
  // C-HOOKS): a controlled value set by the parent, a form reset, or a picked day of the next
  // month.
  const valueIso = value ? formatISODate(value) : '';
  const [seenValueIso, setSeenValueIso] = React.useState(valueIso);
  if (seenValueIso !== valueIso) {
    setSeenValueIso(valueIso);
    if (value) {
      if (!isSameMonth(value, viewMonth)) {
        setViewMonth(startOfMonth(clampDate(value, minDate, maxDate)));
        setFocusedDay(null);
      }
      // The month and year views follow the value too, to its year and its decade.
      const year = clampYear(value.getFullYear(), minDate, maxDate);
      setMonthViewYear(year);
      setFocusedMonth(null);
      setDecade(getDecadeStart(year));
      setFocusedYear(null);
    }
  }

  const isUnavailable = (date: Date) => isDayUnavailable(date, minDate, maxDate, disabledDates);

  // The days drawn selected: the range around the value (its available days).
  const selectedDays = new Set(
    value
      ? getSelectionRange(value, selectionRange, firstDayOfWeek, workWeekDays, isUnavailable).map(
          formatISODate,
        )
      : [],
  );

  const weeks = React.useMemo(
    () => toWeeks(getCalendarDays(viewMonth, firstDayOfWeek)),
    [viewMonth, firstDayOfWeek],
  );

  /* ---- day view ----------------------------------------------------- */

  // The focused day is derived: the day moved to while it is shown (a pointer-focused day of the
  // previous/next month counts too), else the selected day of the month, else today (clamped into
  // the range; skipped while today is unknown), else the first day of the month in range (it may
  // be unavailable: unavailable days are focusable).
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

  /* ---- month view --------------------------------------------------- */

  const minMonth = minDate && startOfMonth(minDate);
  const maxMonth = maxDate && startOfMonth(maxDate);
  const clampMonth = (month: Date) => clampDate(startOfMonth(month), minMonth, maxMonth);
  const inMonthView = (date: Date | null | undefined): date is Date =>
    !!date && date.getFullYear() === monthViewYear;
  const firstMonthInRange = clampMonth(makeDate(monthViewYear, 0, 1));
  const monthTarget = inMonthView(focusedMonth)
    ? focusedMonth
    : inMonthView(value)
      ? startOfMonth(value)
      : inMonthView(clampedToday)
        ? startOfMonth(clampedToday)
        : inMonthView(firstMonthInRange)
          ? firstMonthInRange
          : makeDate(monthViewYear, 0, 1);

  /** A key moves the focused month; the shown year follows it. */
  const moveMonthFocus = (next: Date) => {
    const target = clampMonth(next);
    setFocusedMonth(target);
    setMonthViewYear(target.getFullYear());
  };

  const navigateYear = (delta: number) => {
    const nextYear = monthViewYear + delta;
    const moved = clampMonth(addMonths(monthTarget, delta * 12));
    setMonthViewYear(nextYear);
    setFocusedMonth(moved.getFullYear() === nextYear ? moved : null);
  };

  /* ---- year view ---------------------------------------------------- */

  const firstYearInRange = clampYear(decade, minDate, maxDate);
  const yearTarget =
    focusedYear !== null && inDecadeGrid(focusedYear, decade)
      ? focusedYear
      : value && inDecadeGrid(value.getFullYear(), decade)
        ? value.getFullYear()
        : clampedToday && inDecadeGrid(clampedToday.getFullYear(), decade)
          ? clampedToday.getFullYear()
          : inDecadeGrid(firstYearInRange, decade)
            ? firstYearInRange
            : decade;

  /**
   * A key moves the focused year. The arrows keep the decade while the year is in its grid (the
   * year before and after it included), PageUp/PageDown show the previous and next decade; a
   * year the bounds clamp outside that grid shows its own decade.
   */
  const moveYearFocus = (next: number, preferredDecade: number) => {
    const target = clampYear(next, minDate, maxDate);
    setFocusedYear(target);
    setDecade(inDecadeGrid(target, preferredDecade) ? preferredDecade : getDecadeStart(target));
  };

  const navigateDecade = (delta: number) => {
    const nextDecade = decade + delta * 10;
    const moved = clampYear(yearTarget + delta * 10, minDate, maxDate);
    setDecade(nextDecade);
    setFocusedYear(inDecadeGrid(moved, nextDecade) ? moved : null);
  };

  /* ---- view changes ------------------------------------------------- */

  const changeView = (next: CalendarViewKind) => {
    focusGridRef.current = true;
    setView(next);
  };

  /** "Go to today": today's month in the day view, today focused; nothing is selected. */
  const goToToday = () => {
    const target = clampDate(today ?? startOfDay(new Date()), minDate, maxDate);
    setViewMonth(startOfMonth(target));
    setFocusedDay(target);
    setFocusRequest((request) => request + 1);
    changeView('day');
  };

  /** The day view's heading button: the months of the focused day's year, its month focused. */
  const showMonths = () => {
    setFocusedDay(focusTarget);
    setMonthViewYear(focusTarget.getFullYear());
    setFocusedMonth(startOfMonth(focusTarget));
    changeView('month');
  };

  /** The month view's heading button: the decade of the focused month, its year focused. */
  const showYears = () => {
    setFocusedMonth(monthTarget);
    setDecade(getDecadeStart(monthTarget.getFullYear()));
    setFocusedYear(monthTarget.getFullYear());
    changeView('year');
  };

  /** A picked month shows its days; the focused day keeps its day of the month, clamped. */
  const pickMonth = (month: Date) => {
    const monthsAway =
      (month.getFullYear() - focusTarget.getFullYear()) * 12 +
      (month.getMonth() - focusTarget.getMonth());
    const day = clampDate(addMonths(focusTarget, monthsAway), minDate, maxDate);
    setViewMonth(month);
    setFocusedDay(isSameMonth(day, month) ? day : null);
    changeView('day');
  };

  /** A picked year shows its months; the focused month keeps its month, clamped. */
  const pickYear = (yearDate: Date) => {
    const year = yearDate.getFullYear();
    const month = clampMonth(makeDate(year, monthTarget.getMonth(), 1));
    setMonthViewYear(year);
    setFocusedMonth(month.getFullYear() === year ? month : null);
    changeView('month');
  };

  // Escape goes back one level (C-POPUPS: an inner widget that consumes Escape prevents its
  // default, so a DatePicker stays open); the day view leaves it to the surroundings.
  const handleEscape = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || view === 'day' || !isOwnEvent(event)) return;
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    event.preventDefault();
    changeView(view === 'year' ? 'month' : 'day');
  };

  /* ---- focus -------------------------------------------------------- */

  const periodKey =
    view === 'day' ? formatISODate(viewMonth) : view === 'month' ? monthViewYear : decade;
  const cellKey =
    view === 'day' ? focusIso : view === 'month' ? formatISODate(monthTarget) : yearTarget;

  // Roving focus: while the grid holds focus, focus follows the focused cell, also when the
  // period changes under it (the buttons are keyed by position, so the focused one shows another
  // cell). A view change moves focus into the new grid in the same commit, since the element that
  // had it (the heading button that becomes text, a picked cell) may be gone.
  const headerRef = React.useRef<HTMLDivElement | null>(null);
  /** Whether focus last rested in the header or the grid (a removed element fires no event). */
  const viewHadFocusRef = React.useRef(false);
  React.useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      viewHadFocusRef.current =
        !!target && (!!gridRef.current?.contains(target) || !!headerRef.current?.contains(target));
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
  const previousViewRef = React.useRef(view);
  React.useLayoutEffect(() => {
    const viewChanged = previousViewRef.current !== view;
    previousViewRef.current = view;
    const requested = focusGridRef.current;
    focusGridRef.current = false;
    const grid = gridRef.current;
    if (!grid) return;
    const active = grid.ownerDocument.activeElement;
    // A view change the props made (the month picker turned off) removed the element that had
    // focus: focus then moves into the new grid, if the view had focus and it now rests on
    // nothing. A calendar that did not have focus keeps it where it is.
    const lost =
      viewChanged && viewHadFocusRef.current && (!active || active === grid.ownerDocument.body);
    if (!requested && !lost && (!active || !grid.contains(active))) return;
    const button = grid.querySelector<HTMLElement>('button[tabindex="0"]');
    if (button && button !== active) button.focus();
  }, [view, periodKey, cellKey, focusRequest]);

  /* ---- render ------------------------------------------------------- */

  let previousLabel: string;
  let nextLabel: string;
  let previousDisabled: boolean;
  let nextDisabled: boolean;
  let navigate: (delta: number) => void;
  let headingText: string;
  if (view === 'day') {
    previousLabel = labels?.previousMonth ?? 'Previous month';
    nextLabel = labels?.nextMonth ?? 'Next month';
    previousDisabled = !!minDate && addDays(viewMonth, -1) < startOfDay(minDate);
    nextDisabled = !!maxDate && addMonths(viewMonth, 1) > startOfDay(maxDate);
    navigate = navigateMonth;
    headingText = formatMonthYear(viewMonth, locale);
  } else if (view === 'month') {
    previousLabel = labels?.previousYear ?? 'Previous year';
    nextLabel = labels?.nextYear ?? 'Next year';
    previousDisabled = isYearOutOfRange(monthViewYear - 1, minDate, maxDate);
    nextDisabled = isYearOutOfRange(monthViewYear + 1, minDate, maxDate);
    navigate = navigateYear;
    headingText = formatYear(makeDate(monthViewYear, 0, 1), locale);
  } else {
    previousLabel = labels?.previousDecade ?? 'Previous decade';
    nextLabel = labels?.nextDecade ?? 'Next decade';
    // A decade is wholly outside when its last year is before minDate or its first after maxDate.
    previousDisabled =
      isYearOutOfRange(decade - 1, minDate, undefined) ||
      isYearOutOfRange(decade - 10, undefined, maxDate);
    nextDisabled =
      isYearOutOfRange(decade + 10, undefined, maxDate) ||
      isYearOutOfRange(decade + 19, minDate, undefined);
    navigate = navigateDecade;
    headingText = formatDecade(decade, locale);
  }

  // Unknown today (before hydration) leaves the button enabled; the clock decides once it is known.
  const todayOutOfRange = !!today && !isDateInRange(today, minDate, maxDate);

  const headingButtonTarget = showMonthPicker && view !== 'year' ? view : null;
  const hint =
    view === 'day'
      ? (labels?.chooseMonth ?? 'Choose a month')
      : (labels?.chooseYear ?? 'Choose a year');

  let grid: React.ReactNode;
  if (view === 'day') {
    grid = (
      <CalendarDayGrid
        ref={gridRef}
        id={gridId}
        headingId={headingId}
        viewMonth={viewMonth}
        weeks={weeks}
        focusTarget={focusTarget}
        selectedDays={selectedDays}
        today={today}
        firstDayOfWeek={firstDayOfWeek}
        locale={locale}
        showWeekNumbers={showWeekNumbers}
        firstWeekOfYear={firstWeekOfYear}
        markedDates={markedDates}
        renderDay={renderDay}
        dayLabel={dayLabel}
        labels={labels}
        isUnavailable={isUnavailable}
        onMoveFocus={moveFocus}
        onDayFocus={handleDayFocus}
        onPick={onPick}
        partClassNames={partClassNames}
      />
    );
  } else if (view === 'month') {
    const months = getYearMonths(monthViewYear);
    grid = (
      <CalendarPickerGrid
        ref={gridRef}
        id={gridId}
        headingId={headingId}
        cells={months.map((month) => ({
          date: month,
          text: formatMonthShort(month, locale),
          label: formatMonthYear(month, locale),
          selected: !!value && isSameMonth(month, value),
          current: !!today && isSameMonth(month, today),
          outside: false,
          unavailable: isMonthOutOfRange(month, minDate, maxDate),
        }))}
        focusIndex={monthTarget.getMonth()}
        onMoveFocus={(delta) => moveMonthFocus(addMonths(monthTarget, delta))}
        onPage={(direction) => moveMonthFocus(addMonths(monthTarget, direction * 12))}
        onCellFocus={(month) => {
          if (!isSameMonth(month, monthTarget)) setFocusedMonth(month);
        }}
        onPick={pickMonth}
        onKeyDown={handleEscape}
        partClassNames={{ grid: partClassNames?.grid, cell: partClassNames?.month }}
      />
    );
  } else {
    const years = getDecadeYears(decade);
    grid = (
      <CalendarPickerGrid
        ref={gridRef}
        id={gridId}
        headingId={headingId}
        cells={years.map((yearDate) => {
          const year = yearDate.getFullYear();
          return {
            date: yearDate,
            text: formatYear(yearDate, locale),
            selected: value?.getFullYear() === year,
            current: today?.getFullYear() === year,
            outside: year < decade || year > decade + 9,
            unavailable: isYearOutOfRange(year, minDate, maxDate),
          };
        })}
        focusIndex={yearTarget - (decade - 1)}
        onMoveFocus={(delta) => moveYearFocus(yearTarget + delta, decade)}
        onPage={(direction) => moveYearFocus(yearTarget + direction * 10, decade + direction * 10)}
        onCellFocus={(yearDate) => {
          if (yearDate.getFullYear() !== yearTarget) setFocusedYear(yearDate.getFullYear());
        }}
        onPick={pickYear}
        onKeyDown={handleEscape}
        partClassNames={{ grid: partClassNames?.grid, cell: partClassNames?.year }}
      />
    );
  }

  return (
    <>
      <div
        ref={headerRef}
        className={cn(partClassNames?.header, 'mb-2 flex items-center justify-between gap-2')}
        onKeyDown={handleEscape}
      >
        <button
          type="button"
          aria-label={previousLabel}
          aria-controls={gridId}
          {...focusableDisabledProps(previousDisabled)}
          onClick={preventIfDisabled(previousDisabled, () => navigate(-1))}
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
          {headingButtonTarget ? (
            // Named by its text, so the grid and a DatePicker's dialog keep their names; the hint
            // is outside the heading, which names them.
            <button
              type="button"
              aria-describedby={hintId}
              onClick={headingButtonTarget === 'day' ? showMonths : showYears}
              className={cn(partClassNames?.headingButton, HEADING_BUTTON_CLASSES, focusRing)}
            >
              {headingText}
            </button>
          ) : (
            headingText
          )}
        </Heading>
        {headingButtonTarget && (
          <span id={hintId} hidden>
            {hint}
          </span>
        )}
        <button
          type="button"
          aria-label={nextLabel}
          aria-controls={gridId}
          {...focusableDisabledProps(nextDisabled)}
          onClick={preventIfDisabled(nextDisabled, () => navigate(1))}
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
      {grid}
      {(showGoToToday || onClose) && (
        <div
          className={cn(partClassNames?.footer, 'mt-2 flex items-center justify-end gap-2')}
          onKeyDown={handleEscape}
        >
          {showGoToToday && (
            <button
              type="button"
              // Natively disabled, since it never disables itself by its own activation.
              disabled={todayOutOfRange}
              onClick={goToToday}
              className={cn(
                partClassNames?.todayButton,
                FOOTER_BUTTON_CLASSES,
                focusRing,
                disabledStyles,
              )}
            >
              {labels?.goToToday ?? 'Go to today'}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={cn(
                partClassNames?.closeButton,
                FOOTER_BUTTON_CLASSES,
                focusRing,
                disabledStyles,
              )}
            >
              {closeLabel ?? 'Close'}
            </button>
          )}
        </div>
      )}
    </>
  );
};

CalendarView.displayName = 'CalendarView';

// The Calendar's parts carry its own stable classes (the view's keys name the day view's buttons;
// the navigation buttons of every view share them).
const CALENDAR_PART_CLASS_NAMES: CalendarViewPartClassNames = {
  header: calendarClassNames.header,
  previousMonthButton: calendarClassNames.previousButton,
  heading: calendarClassNames.heading,
  headingButton: calendarClassNames.headingButton,
  nextMonthButton: calendarClassNames.nextButton,
  grid: calendarClassNames.grid,
  weekday: calendarClassNames.weekday,
  day: calendarClassNames.day,
  month: calendarClassNames.month,
  year: calendarClassNames.year,
  weekNumberHeader: calendarClassNames.weekNumberHeader,
  weekNumber: calendarClassNames.weekNumber,
  markedDot: calendarClassNames.markedDot,
  footer: calendarClassNames.footer,
  todayButton: calendarClassNames.todayButton,
};

/**
 * A month calendar for picking one day, without a text input: the grid of DatePicker's dialog,
 * placed in the page (APG date picker grid).
 *
 * - **Structure**: a `role="group"` root, named with `aria-label`/`aria-labelledby` or by a
 *   surrounding `Field`, around the previous-month button, the month text (a polite live region
 *   that labels the grid), the next-month button and a `role="grid"` table of six weeks, with an
 *   optional leading column of week numbers (`showWeekNumbers`, `firstWeekOfYear`) and an
 *   optional footer button, "Go to today" (`showGoToToday`), which shows today's month and focuses
 *   today without selecting it. The month text is no heading, since a component cannot know the
 *   page's heading levels.
 * - **Month and year views** (`showMonthPicker`, on by default): the month text is a button
 *   (named by that text, its hint `labels.chooseMonth`) that shows the 12 months of the year; their
 *   heading, the year, is a button to the year view, a decade with the year before and after it
 *   (muted). The header buttons move by a year, then by a decade. A picked year shows its months
 *   and a picked month its days (the focused day keeps its day of the month, clamped); Escape
 *   goes back a level to the period shown before. Each view change moves focus into the new
 *   grid. Months and years wholly outside `minDate`/`maxDate` stay focusable, `aria-disabled`.
 * - **Keyboard**: one tab stop in the grid, the focused day (the selected day of the shown month,
 *   else today, else the first day of the month in range, which may be unavailable). Arrow keys
 *   move by day and week (mirrored in RTL), PageUp/PageDown by month, Shift+PageUp/PageDown by
 *   year (the day is clamped to the month), Home/End to the start and end of the week; Enter,
 *   Space and a click pick the day. Unavailable days (`minDate`, `maxDate`, `disabledDates`) stay
 *   focusable and are `aria-disabled`. In the month and year views the arrows move by a cell and a
 *   row of four, Home/End to the row's ends, PageUp/PageDown by a year (months) or ten (years).
 * - **Value**: `onValueChange` fires only when the day changes, with local midnight and `details`;
 *   picking the selected day again does nothing. A value that moves to another month shows that
 *   month. The selected day is `aria-selected` on its gridcell and `aria-pressed` on its button;
 *   today is `aria-current="date"`. With `selectionRange` a pick selects the day's week, work
 *   week (`workWeekDays`) or month: every available day of it is drawn and marked selected, the
 *   value is the picked day, and `details.range` lists the selected days in order.
 * - **Marked days and custom content**: `markedDates` draws a dot in the text colour under the
 *   number, sets `data-marked` and says "marked" in the day's name; `renderDay` replaces the
 *   content of the day button (non-interactive content only) and `dayLabel` sets its name.
 * - **Forms and Field**: `name`/`required` add a hidden input (ISO `yyyy-mm-dd`) that resets with
 *   its form (to `defaultValue`); a required calendar that the form reports missing focuses its
 *   tab stop. Inside a `Field` the group takes the label, the description and `aria-invalid`; it
 *   says "required" in its description (`labels.required`), since a group cannot carry
 *   `aria-required`.
 * - **Server rendering**: pass `locale`, and `today`, `initialVisibleDate` or a value, so the
 *   server and the browser render the same month. Only `today` marks a day in the server HTML:
 *   without it the server HTML marks none and the browser marks today once hydrated. Without any
 *   of the three the month shown first comes from the server's clock (development warning).
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
  showMonthPicker = true,
  showWeekNumbers,
  firstWeekOfYear,
  showGoToToday,
  markedDates,
  renderDay,
  dayLabel,
  selectionRange = 'day',
  workWeekDays,
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
  const isUnavailable = (date: Date) => isDayUnavailable(date, minDate, maxDate, disabledDates);
  const [value, setValue] = useControllable<Date | null>(valueProp, defaultValue ?? null, (next) =>
    onValueChange?.(next, {
      range: next
        ? getSelectionRange(
            next,
            selectionRange,
            firstDayOfWeek,
            workWeekDays ?? DEFAULT_WORK_WEEK_DAYS,
            isUnavailable,
          )
        : [],
    }),
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
        showMonthPicker={showMonthPicker}
        showWeekNumbers={showWeekNumbers}
        firstWeekOfYear={firstWeekOfYear}
        showGoToToday={showGoToToday}
        markedDates={markedDates}
        renderDay={renderDay}
        dayLabel={dayLabel}
        selectionRange={selectionRange}
        workWeekDays={workWeekDays}
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
