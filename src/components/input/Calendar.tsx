import * as React from 'react';
import type { DayOfWeek } from '../../lib/types';
import { cn } from '../../lib/cn';
import { focusableDisabledProps, preventIfDisabled } from '../../lib/aria';
import { ChevronLeftIcon, ChevronRightIcon } from '../../lib/icons';
import { disabledStyles, focusRing } from '../../lib/styles';
import { useId } from '../../hooks/useId';
import { CalendarDayGrid } from './Calendar.views';
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
  startOfDay,
  startOfMonth,
} from './dateUtils';

/** The calendar's built-in button names, for localization. */
export interface CalendarLabels {
  /** Name of the previous-month button.
   * @default 'Previous month'
   */
  previousMonth?: string;
  /** Name of the next-month button.
   * @default 'Next month'
   */
  nextMonth?: string;
}

/**
 * Internal: the stable classes of a calendar view's parts, passed in by the component that
 * renders the view (DatePicker passes its own).
 */
export interface CalendarViewPartClassNames {
  /** On the row of the month buttons and the heading. */
  header?: string;
  /** On the previous-month button. */
  previousMonthButton?: string;
  /** On the month heading. */
  heading?: string;
  /** On the next-month button. */
  nextMonthButton?: string;
  /** On the `role="grid"` table. */
  grid?: string;
  /** On each weekday header cell. */
  weekday?: string;
  /** On each day button. */
  day?: string;
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
 * own (a fragment). It opens on the month of `value`, else today's, clamped into
 * `minDate`/`maxDate`, and keeps that month until navigated: remount it to show the value's month
 * again (DatePicker mounts it with each opening of its dialog).
 */
export const CalendarView = ({
  value,
  onPick,
  minDate,
  maxDate,
  disabledDates,
  firstDayOfWeek,
  locale,
  labels,
  headingAs: Heading,
  headingId,
  partClassNames,
}: CalendarViewProps) => {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = React.useState<Date>(() =>
    startOfMonth(clampDate(value ?? today, minDate, maxDate)),
  );
  const [focusedDay, setFocusedDay] = React.useState<Date | null>(null);
  const gridRef = React.useRef<HTMLTableElement | null>(null);
  const gridId = useId('calendar-grid');

  const isUnavailable = (date: Date) =>
    !isDateInRange(date, minDate, maxDate) || !!disabledDates?.(startOfDay(date));

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

  // Roving focus: while the grid holds focus, focus follows the focused day.
  React.useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const active = grid.ownerDocument.activeElement;
    if (!active || !grid.contains(active)) return;
    const button = grid.querySelector<HTMLElement>(`button[data-date="${focusIso}"]`);
    if (button && button !== active) button.focus();
  }, [focusIso]);

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
