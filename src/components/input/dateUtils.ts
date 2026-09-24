/**
 * Date and time helpers shared by `DatePicker` and `TimePicker` (spec §5.6).
 *
 * - Every date these helpers return is a **local-midnight** `Date` (the start of a calendar day in
 *   the runtime's time zone). Comparisons are by calendar day, never by time of day.
 * - The default display format is `Intl.DateTimeFormat(locale, { year: 'numeric', month:
 *   '2-digit', day: '2-digit' })`, and {@link parseDate} is its exact inverse for the same
 *   `locale` (field order from `formatToParts`), so a formatted date always parses back to the
 *   same day. ISO `yyyy-mm-dd` text is accepted too.
 * - Every formatter uses the locale's calendar only when it has the Gregorian months and days of
 *   the grid (Gregorian, or the Buddhist calendar of `th-TH`, whose years are offset); any other
 *   calendar (the Persian default of `fa-IR`, `-u-ca-islamic`, Japanese eras) is replaced by the
 *   Gregorian one, so the text, the heading and the day labels name the day the grid shows.
 * - Pass an explicit `locale` when rendering on the server: the runtime default locale of the
 *   server and the browser may differ, which would change the formatted text between them.
 *
 * Internal module (not exported from the package).
 */

/* ------------------------------------------------------------------ */
/*  Day arithmetic                                                     */
/* ------------------------------------------------------------------ */

/**
 * Builds a local-midnight date without the `new Date(y, …)` two-digit-year mapping (years 0–99
 * would otherwise become 1900–1999).
 */
function makeDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** The start (local midnight) of `date`'s calendar day, as a new `Date`. */
export function startOfDay(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The first day (local midnight) of `date`'s month. */
export function startOfMonth(date: Date): Date {
  return makeDate(date.getFullYear(), date.getMonth(), 1);
}

/** The number of days in the given month (`monthIndex` may be out of range; it is normalized). */
function daysInMonth(year: number, monthIndex: number): number {
  return makeDate(year, monthIndex + 1, 0).getDate();
}

/** `date` plus `amount` calendar days, at local midnight (month/year boundaries included). */
export function addDays(date: Date, amount: number): Date {
  return makeDate(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/**
 * `date` plus `amount` months, at local midnight. The day is clamped to the length of the target
 * month, so Jan 31 + 1 month is Feb 28 (29 in a leap year) and Mar 31 − 1 month is Feb 28/29 —
 * never a day of the following month.
 */
export function addMonths(date: Date, amount: number): Date {
  const target = makeDate(date.getFullYear(), date.getMonth() + amount, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return makeDate(target.getFullYear(), target.getMonth(), day);
}

/** Whether both dates are on the same calendar day. `false` when either is missing. */
export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whether both dates are in the same month of the same year. */
export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Whether `date`'s day lies within `[min, max]`, comparing calendar days (a `max` with a time of
 * day still includes that whole day). Missing bounds are open.
 */
export function isDateInRange(date: Date, min?: Date | null, max?: Date | null): boolean {
  const day = startOfDay(date).getTime();
  if (min && day < startOfDay(min).getTime()) return false;
  if (max && day > startOfDay(max).getTime()) return false;
  return true;
}

/** `date`'s day clamped into `[min, max]` (calendar days), at local midnight. */
export function clampDate(date: Date, min?: Date | null, max?: Date | null): Date {
  const day = startOfDay(date);
  if (min && day.getTime() < startOfDay(min).getTime()) return startOfDay(min);
  if (max && day.getTime() > startOfDay(max).getTime()) return startOfDay(max);
  return day;
}

/**
 * The 42 days (6 weeks) of the calendar grid showing `viewMonth`'s month: the first row starts on
 * `firstDayOfWeek` (0 = Sunday) on or before the 1st.
 */
export function getCalendarDays(viewMonth: Date, firstDayOfWeek: number): Date[] {
  const first = startOfMonth(viewMonth);
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7;
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(first, i - offset));
  return days;
}

/* ------------------------------------------------------------------ */
/*  ISO dates                                                          */
/* ------------------------------------------------------------------ */

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

/** `yyyy-mm-dd` from the **local** calendar fields (the `HiddenInput` form value). */
export function formatISODate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** Builds a date from calendar fields; `null` when they do not name a real day. */
function fromFields(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month - 1)) return null;
  return makeDate(year, month - 1, day);
}

/** Parses `yyyy-mm-dd` (surrounding whitespace allowed) to local midnight; `null` otherwise. */
export function parseISODate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  return fromFields(Number(match[1]), Number(match[2]), Number(match[3]));
}

/* ------------------------------------------------------------------ */
/*  Locale formats                                                     */
/* ------------------------------------------------------------------ */

/** A numeric date field. */
export type DateField = 'year' | 'month' | 'day';

/** How a locale writes the default (numeric) date format. */
export interface LocaleDateFormat {
  /** The order of the fields, e.g. `['day', 'month', 'year']` for `en-GB`. */
  order: DateField[];
  /** A readable pattern with the locale's own separators, e.g. `DD/MM/YYYY`. */
  pattern: string;
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

/**
 * Calendars with the Gregorian months and days, which the grid shows (`getCalendarDays`): a locale
 * whose calendar is one of these keeps it. The Buddhist calendar (default of `th-TH`) only numbers
 * the years differently.
 */
const GRID_CALENDARS = new Set(['gregory', 'buddhist']);

const calendarCache = new Map<string, string>();

/**
 * The calendar every date helper formats `locale` in: the locale's own (its default or a `-u-ca-`
 * extension) when it has the Gregorian months and days, else `'gregory'`. So a Persian default
 * (`fa-IR`, `fa-AF`, `ps-AF`), an explicit `-u-ca-islamic` or the Japanese eras never label the
 * Gregorian grid with other months or years, and the text stays parseable; the locale's digits
 * stay. An invalid locale tag uses the runtime default's.
 */
function getCalendar(locale: string | undefined): string {
  const key = locale ?? '';
  let calendar = calendarCache.get(key);
  if (calendar === undefined) {
    let resolved: string;
    try {
      resolved = new Intl.DateTimeFormat(locale).resolvedOptions().calendar;
    } catch {
      resolved = new Intl.DateTimeFormat().resolvedOptions().calendar;
    }
    calendar = GRID_CALENDARS.has(resolved) ? resolved : 'gregory';
    calendarCache.set(key, calendar);
  }
  return calendar;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * A cached `Intl.DateTimeFormat` in the calendar of {@link getCalendar}; an invalid locale tag falls
 * back to the runtime default.
 */
function getFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const withCalendar = { ...options, calendar: getCalendar(locale) };
    try {
      formatter = new Intl.DateTimeFormat(locale, withCalendar);
    } catch {
      formatter = new Intl.DateTimeFormat(undefined, withCalendar);
    }
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Bidirectional control characters Intl inserts around fields (Arabic, Hebrew locales). */
const BIDI_MARKS = /[\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

interface LocaleInfo extends LocaleDateFormat {
  /** Non-digit characters of the formatted date (allowed between the typed fields). */
  literals: Set<string>;
  /** Locale digit → ASCII digit (for non-Latin numbering systems). */
  digits: Map<string, string>;
  /** Formatted year minus the Gregorian year (e.g. 543 for the Buddhist calendar). */
  yearOffset: number;
  /** Digit count of a formatted year: shorter typed years are rejected (`25` is not 2025). */
  yearLength: number;
}

const infoCache = new Map<string, LocaleInfo>();
const SAMPLE_DATE = makeDate(2001, 10, 23); // 23 Nov 2001: every field distinct

function toAsciiDigits(text: string, digits: Map<string, string>): string {
  let out = '';
  for (const char of text.replace(BIDI_MARKS, '')) out += digits.get(char) ?? char;
  return out;
}

function getLocaleInfo(locale: string | undefined): LocaleInfo {
  const key = locale ?? '';
  const cached = infoCache.get(key);
  if (cached) return cached;

  const digits = new Map<string, string>();
  let numberFormat: Intl.NumberFormat;
  try {
    numberFormat = new Intl.NumberFormat(locale, { useGrouping: false });
  } catch {
    numberFormat = new Intl.NumberFormat(undefined, { useGrouping: false });
  }
  for (let i = 0; i <= 9; i++) digits.set(numberFormat.format(i), String(i));

  const parts = getFormatter(locale, DEFAULT_DATE_OPTIONS).formatToParts(SAMPLE_DATE);
  const order: DateField[] = [];
  const literals = new Set<string>();
  let pattern = '';
  let yearOffset = 0;
  let yearLength = 4;
  for (const part of parts) {
    if (part.type === 'day' || part.type === 'month' || part.type === 'year') {
      order.push(part.type);
      if (part.type === 'year') {
        const year = toAsciiDigits(part.value, digits);
        yearLength = year.length;
        yearOffset = Number(year) - SAMPLE_DATE.getFullYear();
      }
      pattern += part.type === 'day' ? 'DD' : part.type === 'month' ? 'MM' : 'YYYY';
    } else {
      const text = part.value.replace(BIDI_MARKS, '');
      pattern += text;
      for (const char of text) literals.add(char);
    }
  }
  const info: LocaleInfo = {
    order,
    pattern: pattern.trim(),
    literals,
    digits,
    yearOffset,
    yearLength,
  };
  infoCache.set(key, info);
  return info;
}

/**
 * The field order and a readable pattern (`DD/MM/YYYY`, `MM/DD/YYYY`, `DD.MM.YYYY`, …) of the
 * default date format for `locale` (runtime default when omitted).
 */
export function getLocaleDateFormat(locale?: string): LocaleDateFormat {
  const { order, pattern } = getLocaleInfo(locale);
  return { order: [...order], pattern };
}

/**
 * The default DatePicker display text: `Intl.DateTimeFormat(locale, { year: 'numeric', month:
 * '2-digit', day: '2-digit' })` in the grid-compatible calendar of {@link getCalendar} (`fa-IR`:
 * `۲۰۲۵/۰۶/۱۵`, not the Persian `۱۴۰۴/۰۳/۲۵`). {@link parseDate} with the same `locale` reverses it.
 */
export function formatDate(date: Date, locale?: string): string {
  return getFormatter(locale, DEFAULT_DATE_OPTIONS).format(date);
}

/** The numeric fields of `text` in order, or `null` when anything but separators surrounds them. */
function digitGroups(text: string, info: LocaleInfo): string[] | null {
  const normalized = toAsciiDigits(text.trim(), info.digits);
  const groups = normalized.match(/\d+/g);
  if (!groups) return null;
  for (const char of normalized.replace(/\d+/g, '')) {
    if (/\s/.test(char) || info.literals.has(char) || '/.-'.includes(char)) continue;
    return null;
  }
  return groups;
}

/**
 * Parses text typed in the default display format of `locale` — the exact inverse of
 * {@link formatDate} for the same locale — to local midnight. Also accepts single-digit day/month
 * fields, `/`, `.` and `-` separators, and ISO `yyyy-mm-dd`. Returns `null` for anything else:
 * impossible dates (31/02), a year shorter than the locale writes it (`25`), letters or extra
 * fields.
 */
export function parseDate(text: string, locale?: string): Date | null {
  if (!text.trim()) return null;
  const iso = parseISODate(text);
  if (iso) return iso;

  const info = getLocaleInfo(locale);
  if (info.order.length !== 3) return null;
  const groups = digitGroups(text, info);
  if (!groups || groups.length !== 3) return null;

  const values: Partial<Record<DateField, number>> = {};
  for (let i = 0; i < 3; i++) {
    const field = info.order[i];
    if (field === 'year' && groups[i].length < info.yearLength) return null;
    values[field] = Number(groups[i]);
  }
  const date = fromFields(
    (values.year ?? NaN) - info.yearOffset,
    values.month ?? NaN,
    values.day ?? NaN,
  );
  if (!date) return null;

  // Exact inverse: formatting the result must give back the typed numbers (guards calendars
  // whose months or days differ from the Gregorian ones).
  const roundTrip = digitGroups(formatDate(date, locale), info);
  if (!roundTrip || roundTrip.some((group, i) => Number(group) !== Number(groups[i]))) return null;
  return date;
}

/** The 12 long month names of `locale` (January … December). */
export function getMonthNames(locale?: string): string[] {
  const formatter = getFormatter(locale, { month: 'long' });
  return Array.from({ length: 12 }, (_, month) => formatter.format(makeDate(2001, month, 1)));
}

/** A weekday name in both lengths. */
export interface WeekdayName {
  /** Short name for the column header (`Mon`). */
  short: string;
  /** Full name for assistive technology (`Monday`). */
  long: string;
}

/** The seven weekday names of `locale`, starting at `firstDayOfWeek` (0 = Sunday). */
export function getWeekdayNames(locale: string | undefined, firstDayOfWeek = 0): WeekdayName[] {
  const short = getFormatter(locale, { weekday: 'short' });
  const long = getFormatter(locale, { weekday: 'long' });
  // 1 January 2023 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => {
    const day = makeDate(2023, 0, 1 + ((firstDayOfWeek + i) % 7));
    return { short: short.format(day), long: long.format(day) };
  });
}

/** The calendar heading, e.g. `May 2025` / `Mai 2025`. */
export function formatMonthYear(date: Date, locale?: string): string {
  return getFormatter(locale, { month: 'long', year: 'numeric' }).format(date);
}

/** The accessible name of a day cell, e.g. `Monday, May 26, 2025`. */
export function formatDayLabel(date: Date, locale?: string): string {
  return getFormatter(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

const numberFormatCache = new Map<string, Intl.NumberFormat>();

/** The day-of-month number in the locale's digits, without suffixes (`3`, not `3日`). */
export function formatDayNumber(date: Date, locale?: string): string {
  const key = locale ?? '';
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, { useGrouping: false });
    } catch {
      formatter = new Intl.NumberFormat(undefined, { useGrouping: false });
    }
    numberFormatCache.set(key, formatter);
  }
  return formatter.format(date.getDate());
}

/* ------------------------------------------------------------------ */
/*  Time                                                               */
/* ------------------------------------------------------------------ */

/** TimePicker label style. */
export type TimeFormat = '12h' | '24h';

const TIME_24H = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const TIME_12H = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i;

/**
 * Minutes since midnight of a time string: `HH:mm`, `H:mm`, `HH:mm:ss` (seconds ignored) or a
 * 12-hour time such as `9:00 AM`, `12:30 pm`, `11:59 p.m.`. `NaN` when invalid.
 */
export function timeToMinutes(text: string): number {
  const value = text.trim();
  const twelve = TIME_12H.exec(value);
  const match = twelve ?? TIME_24H.exec(value);
  if (!match) return NaN;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (minutes > 59 || seconds > 59) return NaN;
  if (twelve) {
    if (hours < 1 || hours > 12) return NaN;
    const pm = match[4].toLowerCase() === 'p';
    hours = (hours % 12) + (pm ? 12 : 0);
  } else if (hours > 23) {
    return NaN;
  }
  return hours * 60 + minutes;
}

/** `HH:mm` (24-hour, zero-padded): the TimePicker value format. */
export function minutesToValue(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${pad(hours, 2)}:${pad(minutes % 60, 2)}`;
}

/** Display text of a time: `13:00` (`'24h'`) or `1:00 PM` (`'12h'`). */
export function minutesToTime(minutes: number, format: TimeFormat): string {
  if (format === '24h') return minutesToValue(minutes);
  const hours = Math.floor(minutes / 60) % 24;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${pad(minutes % 60, 2)} ${period}`;
}

/** The TimePicker step fallback for invalid values. */
export const DEFAULT_TIME_STEP = 30;

/**
 * Guards a TimePicker `step`: a non-finite or non-positive step falls back to
 * {@link DEFAULT_TIME_STEP} (`valid: false`, so the component can report it); fractions are
 * floored to a whole number of minutes, at least 1.
 */
export function normalizeTimeStep(step: number): { step: number; valid: boolean } {
  if (!Number.isFinite(step) || step <= 0) return { step: DEFAULT_TIME_STEP, valid: false };
  return { step: Math.max(1, Math.floor(step)), valid: true };
}

/** One generated TimePicker option. */
export interface TimeOption {
  /** `HH:mm`. */
  value: string;
  /** Display text in the requested format. */
  label: string;
}

/**
 * The options from `minTime` to `maxTime` (inclusive) every `step` minutes. The step is guarded
 * with {@link normalizeTimeStep} (the loop always terminates); invalid or reversed bounds give
 * `[]`.
 */
export function generateTimeOptions(
  step: number,
  minTime: string,
  maxTime: string,
  format: TimeFormat,
): TimeOption[] {
  const increment = normalizeTimeStep(step).step;
  const min = timeToMinutes(minTime);
  const max = timeToMinutes(maxTime);
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) return [];
  const options: TimeOption[] = [];
  for (let minutes = min; minutes <= max; minutes += increment) {
    options.push({ value: minutesToValue(minutes), label: minutesToTime(minutes, format) });
  }
  return options;
}
