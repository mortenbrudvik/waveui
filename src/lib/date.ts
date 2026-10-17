import type { DayOfWeek, FirstWeekOfYear } from './types';

/**
 * Calendar helpers on `Date`.
 *
 * Every helper that returns a date returns **local midnight** (the start of a calendar day in the
 * runtime's time zone) and drops the time of day of its input; Fluent's helpers keep it. Server-safe.
 */

/**
 * Local midnight of the given calendar fields. `monthIndex` and `day` may be out of range (they roll
 * over), and years 0–99 are not mapped to 1900–1999. Module-internal.
 */
export function makeDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The number of days in the given month (`monthIndex` may be out of range). Module-internal. */
export function daysInMonth(year: number, monthIndex: number): number {
  return makeDate(year, monthIndex + 1, 0).getDate();
}

/** The start (local midnight) of `date`'s calendar day. Module-internal. */
export function startOfDay(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The first day (local midnight) of `date`'s month. Module-internal. */
export function startOfMonth(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), 1);
}

/**
 * `date` plus `amount` calendar days (negative to go back), at local midnight; the time of day is
 * dropped.
 */
export function addDays(date: Date, amount: number): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/**
 * `date` plus `amount` months (negative to go back), at local midnight; the time of day is dropped.
 * The day is clamped to the length of the target month: January 31 plus one month is February 28
 * (29 in a leap year), never a day of the following month.
 */
export function addMonths(date: Date, amount: number): Date {
  const target = makeDate(date.getFullYear(), date.getMonth() + amount, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return makeDate(target.getFullYear(), target.getMonth(), day);
}

/** Whether both dates are on the same calendar day (time of day ignored); `false` when either is missing. */
export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The first day of `date`'s week, at local midnight; the time of day is dropped.
 *
 * @param firstDayOfWeek The weekday weeks start on (0 is Sunday).
 * @default 0
 */
export function startOfWeek(date: Date, firstDayOfWeek: DayOfWeek = 0): Date {
  const offset = (date.getDay() - firstDayOfWeek + 7) % 7;
  return addDays(date, -offset);
}

/** Options of {@link getWeekNumber}. */
export interface GetWeekNumberOptions {
  /**
   * The weekday weeks start on (0 is Sunday).
   * @default 0
   */
  firstDayOfWeek?: DayOfWeek;
  /**
   * Which week is week 1 of a year.
   * @default 'first-day'
   */
  firstWeekOfYear?: FirstWeekOfYear;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  );
}

function weekOneStart(year: number, firstDayOfWeek: DayOfWeek, rule: FirstWeekOfYear): Date {
  const january1 = makeDate(year, 0, 1);
  const weekStart = startOfWeek(january1, firstDayOfWeek);
  const daysBefore = daysBetween(weekStart, january1);
  if (rule === 'first-day') return weekStart;
  if (rule === 'first-full-week') return daysBefore === 0 ? weekStart : addDays(weekStart, 7);
  return 7 - daysBefore >= 4 ? weekStart : addDays(weekStart, 7);
}

/**
 * The week number (1–53) of `date`'s calendar day (time of day ignored): days before a year's week
 * 1 belong to the previous year's last week, and days in the next year's week 1 are week 1. ISO 8601
 * is `{ firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' }`.
 *
 * @param options Defaults to Sunday weeks, week 1 being the week of January 1.
 * @default `{ firstDayOfWeek: 0, firstWeekOfYear: 'first-day' }`
 */
export function getWeekNumber(date: Date, options: GetWeekNumberOptions = {}): number {
  const { firstDayOfWeek = 0, firstWeekOfYear = 'first-day' } = options;
  const day = startOfDay(date);
  const year = day.getFullYear();
  if (day >= weekOneStart(year + 1, firstDayOfWeek, firstWeekOfYear)) return 1;
  const start = weekOneStart(year, firstDayOfWeek, firstWeekOfYear);
  const from = day < start ? weekOneStart(year - 1, firstDayOfWeek, firstWeekOfYear) : start;
  return Math.floor(daysBetween(from, day) / 7) + 1;
}
