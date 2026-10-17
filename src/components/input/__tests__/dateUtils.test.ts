import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  clampDate,
  formatDate,
  formatDayLabel,
  formatDecade,
  formatISODate,
  formatMonthShort,
  formatMonthYear,
  formatYear,
  generateTimeOptions,
  getCalendarDays,
  getDecadeStart,
  getDecadeYears,
  getLocaleDateFormat,
  getMonthNames,
  getSelectionRange,
  getWeekdayNames,
  getYearMonths,
  isDateInRange,
  isMonthOutOfRange,
  isSameDay,
  isSameMonth,
  isValidLocaleTag,
  isYearOutOfRange,
  minutesToTime,
  minutesToValue,
  normalizeTimeStep,
  parseDate,
  parseISODate,
  startOfDay,
  startOfMonth,
  timeToMinutes,
} from '../dateUtils';

/** Local calendar fields of a date: TZ-agnostic assertions (never compare against UTC strings). */
function fields(date: Date | null) {
  return date && [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

function isMidnight(date: Date) {
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

describe('dateUtils — day arithmetic', () => {
  it('startOfDay returns a local-midnight copy', () => {
    const input = new Date(2025, 3, 3, 17, 45, 12, 999);
    const result = startOfDay(input);
    expect(fields(result)).toEqual([2025, 4, 3]);
    expect(isMidnight(result)).toBe(true);
    expect(input.getHours()).toBe(17); // not mutated
  });

  it('startOfMonth returns the first day of the month at midnight', () => {
    const result = startOfMonth(new Date(2025, 5, 15, 10));
    expect(fields(result)).toEqual([2025, 6, 1]);
    expect(isMidnight(result)).toBe(true);
  });

  it('addDays crosses month and year boundaries and returns midnight', () => {
    expect(fields(addDays(new Date(2025, 0, 31), 1))).toEqual([2025, 2, 1]);
    expect(fields(addDays(new Date(2025, 0, 1), -1))).toEqual([2024, 12, 31]);
    expect(isMidnight(addDays(new Date(2025, 0, 1, 13), 7))).toBe(true);
  });

  it('addMonths clamps the day to the target month (Jan 31 → Feb 28/29, Mar 31 → Feb)', () => {
    expect(fields(addMonths(new Date(2025, 0, 31), 1))).toEqual([2025, 2, 28]);
    expect(fields(addMonths(new Date(2024, 0, 31), 1))).toEqual([2024, 2, 29]);
    expect(fields(addMonths(new Date(2025, 2, 31), -1))).toEqual([2025, 2, 28]);
    expect(fields(addMonths(new Date(2025, 4, 31), 1))).toEqual([2025, 6, 30]);
    expect(fields(addMonths(new Date(2024, 1, 29), 12))).toEqual([2025, 2, 28]);
    expect(fields(addMonths(new Date(2025, 10, 15), 3))).toEqual([2026, 2, 15]);
    expect(fields(addMonths(new Date(2025, 1, 15), -14))).toEqual([2023, 12, 15]);
  });

  it('isSameDay / isSameMonth ignore the time of day and accept null', () => {
    expect(isSameDay(new Date(2025, 3, 3, 1), new Date(2025, 3, 3, 23))).toBe(true);
    expect(isSameDay(new Date(2025, 3, 3), new Date(2025, 3, 4))).toBe(false);
    expect(isSameDay(null, new Date(2025, 3, 3))).toBe(false);
    expect(isSameDay(null, null)).toBe(false);
    expect(isSameMonth(new Date(2025, 3, 1), new Date(2025, 3, 30))).toBe(true);
    expect(isSameMonth(new Date(2025, 3, 1), new Date(2024, 3, 1))).toBe(false);
  });

  it('clampDate and isDateInRange compare whole days (a max with a time of day includes that day)', () => {
    const min = new Date(2025, 0, 10, 15);
    const max = new Date(2025, 0, 20, 9);
    expect(fields(clampDate(new Date(2025, 0, 1), min, max))).toEqual([2025, 1, 10]);
    expect(fields(clampDate(new Date(2025, 1, 1), min, max))).toEqual([2025, 1, 20]);
    expect(fields(clampDate(new Date(2025, 0, 15), min, max))).toEqual([2025, 1, 15]);
    expect(isMidnight(clampDate(new Date(2025, 0, 15, 12), min, max))).toBe(true);
    expect(fields(clampDate(new Date(2025, 0, 1), undefined, null))).toEqual([2025, 1, 1]);
    expect(isDateInRange(new Date(2025, 0, 20, 23, 59), min, max)).toBe(true);
    expect(isDateInRange(new Date(2025, 0, 10, 0, 0), min, max)).toBe(true);
    expect(isDateInRange(new Date(2025, 0, 21), min, max)).toBe(false);
    expect(isDateInRange(new Date(2025, 0, 9), min, max)).toBe(false);
  });

  it('getCalendarDays returns 6 full weeks starting on firstDayOfWeek', () => {
    const days = getCalendarDays(new Date(2025, 5, 15), 1);
    expect(days).toHaveLength(42);
    expect(fields(days[0])).toEqual([2025, 5, 26]); // Monday before Sun Jun 1
    expect(fields(days[6])).toEqual([2025, 6, 1]);
    expect(days[0].getDay()).toBe(1);
    const sundayFirst = getCalendarDays(new Date(2025, 5, 15), 0);
    expect(fields(sundayFirst[0])).toEqual([2025, 6, 1]);
    expect(days.every(isMidnight)).toBe(true);
  });
});

describe('dateUtils — ISO dates', () => {
  it('formats local calendar fields (no UTC shift)', () => {
    expect(formatISODate(new Date(2025, 3, 3, 23, 30))).toBe('2025-04-03');
    expect(formatISODate(new Date(2025, 11, 31, 0, 5))).toBe('2025-12-31');
  });

  it('parses yyyy-mm-dd to local midnight and rejects impossible dates', () => {
    const date = parseISODate('2025-04-03');
    expect(fields(date)).toEqual([2025, 4, 3]);
    expect(date && isMidnight(date)).toBe(true);
    expect(parseISODate(' 2025-04-03 ')).not.toBeNull();
    expect(parseISODate('2025-02-30')).toBeNull();
    expect(parseISODate('2025-13-01')).toBeNull();
    expect(parseISODate('2025-4-3')).toBeNull();
    expect(parseISODate('03/04/2025')).toBeNull();
  });

  it('keeps years below 100 (no 19xx mapping)', () => {
    expect(fields(parseISODate('0025-04-03'))).toEqual([25, 4, 3]);
    expect(formatISODate(parseISODate('0025-04-03') as Date)).toBe('0025-04-03');
  });
});

describe('dateUtils — locale format and parse', () => {
  it('formats with Intl numeric year and 2-digit month/day for the locale', () => {
    const date = new Date(2025, 3, 3);
    expect(formatDate(date, 'en-GB')).toBe('03/04/2025');
    expect(formatDate(date, 'en-US')).toBe('04/03/2025');
    expect(formatDate(date, 'de-DE')).toBe('03.04.2025');
    expect(formatDate(date)).toBe(
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date),
    );
  });

  it('describes the locale field order and a pattern', () => {
    expect(getLocaleDateFormat('en-GB')).toMatchObject({
      order: ['day', 'month', 'year'],
      pattern: 'DD/MM/YYYY',
    });
    expect(getLocaleDateFormat('en-US')).toMatchObject({
      order: ['month', 'day', 'year'],
      pattern: 'MM/DD/YYYY',
    });
    expect(getLocaleDateFormat('de-DE').pattern).toBe('DD.MM.YYYY');
  });

  it('parses day-first en-GB text: 03/04/2025 is 3 April', () => {
    const date = parseDate('03/04/2025', 'en-GB');
    expect(fields(date)).toEqual([2025, 4, 3]);
    expect(date && isMidnight(date)).toBe(true);
  });

  it('parses month-first en-US text: 03/04/2025 is 4 March', () => {
    expect(fields(parseDate('03/04/2025', 'en-US'))).toEqual([2025, 3, 4]);
  });

  it('is the exact inverse of formatDate for the same locale (round trip)', () => {
    const locales = [
      undefined,
      'en-GB',
      'en-US',
      'de-DE',
      'fr-FR',
      'nb-NO',
      'ja-JP',
      'sv-SE',
      // Non-Latin digits, and default or explicit calendars other than the Gregorian one.
      'ar-EG',
      'fa-IR',
      'fa-AF',
      'ps-AF',
      'th-TH',
      'en-US-u-ca-islamic',
      'en-US-u-ca-persian',
      'en-US-u-ca-hebrew',
      'ja-JP-u-ca-japanese',
      'en-US-u-ca-buddhist',
    ];
    const dates = [
      new Date(2024, 1, 29),
      // The first and the last day of every month of 2025.
      ...Array.from({ length: 12 }, (_, month) => new Date(2025, month, 1)),
      ...Array.from({ length: 12 }, (_, month) => new Date(2025, month + 1, 0)),
    ];
    for (const locale of locales) {
      for (const date of dates) {
        const text = formatDate(date, locale);
        expect(fields(parseDate(text, locale)), `${locale ?? 'default'} ${text}`).toEqual(
          fields(date),
        );
      }
    }
  });

  it('accepts single-digit fields, other separators and ISO text', () => {
    expect(fields(parseDate('3/4/2025', 'en-GB'))).toEqual([2025, 4, 3]);
    expect(fields(parseDate('3.4.2025', 'en-GB'))).toEqual([2025, 4, 3]);
    expect(fields(parseDate('2025-04-03', 'en-US'))).toEqual([2025, 4, 3]);
  });

  it('rejects impossible dates, short years, extra fields and letters', () => {
    expect(parseDate('31/02/2025', 'en-GB')).toBeNull();
    expect(parseDate('03/13/2025', 'en-GB')).toBeNull();
    expect(parseDate('03/04/25', 'en-GB')).toBeNull();
    expect(parseDate('03/04/2025/1', 'en-GB')).toBeNull();
    expect(parseDate('03/April/2025', 'en-GB')).toBeNull();
    expect(parseDate('tomorrow', 'en-GB')).toBeNull();
    expect(parseDate('   ', 'en-GB')).toBeNull();
  });

  it('falls back to the default locale for an invalid locale tag', () => {
    const date = new Date(2025, 3, 3);
    expect(formatDate(date, 'not a locale!!')).toBe(formatDate(date));
    expect(fields(parseDate(formatDate(date), 'not a locale!!'))).toEqual([2025, 4, 3]);
  });

  it('isValidLocaleTag accepts the tags Intl accepts and rejects the ones the fallback replaces', () => {
    for (const tag of ['en-US', 'de-DE', 'EN-us', 'fa-IR', 'en-US-u-ca-islamic', 'pt-BR']) {
      expect(isValidLocaleTag(tag)).toBe(true);
    }
    for (const tag of ['de_DE', 'pt_BR', '', 'not a locale!!', 'x']) {
      expect(isValidLocaleTag(tag)).toBe(false);
      expect(formatDate(new Date(2025, 3, 3), tag)).toBe(formatDate(new Date(2025, 3, 3)));
    }
  });
});

describe('dateUtils — localized names', () => {
  it('month names come from Intl', () => {
    expect(getMonthNames('en-US')[0]).toBe('January');
    expect(getMonthNames('de-DE')[2]).toBe('März');
    expect(getMonthNames('en-US')).toHaveLength(12);
  });

  it('weekday names start at firstDayOfWeek with short and long forms', () => {
    const names = getWeekdayNames('en-US', 1);
    expect(names.map((n) => n.long)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(names[0].short).toBe('Mon');
    expect(getWeekdayNames('de-DE', 0)[0].long).toBe('Sonntag');
  });

  it('formats the month heading and the day label', () => {
    expect(formatMonthYear(new Date(2025, 4, 1), 'en-US')).toBe('May 2025');
    expect(formatMonthYear(new Date(2025, 4, 1), 'de-DE')).toBe('Mai 2025');
    expect(formatDayLabel(new Date(2025, 4, 26), 'en-US')).toBe('Monday, May 26, 2025');
  });
});

describe('dateUtils — calendar systems', () => {
  const june15 = new Date(2025, 5, 15);

  /** What Intl writes for `locale` in the Gregorian calendar. */
  function gregorian(locale: string, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory' }).format(june15);
  }

  it('writes the Gregorian date of the grid when the locale default calendar has other months (fa-IR, ps-AF)', () => {
    // fa-IR defaults to the Persian calendar (15 June 2025 is 1404/03/25 there); the digits stay.
    expect(formatDate(june15, 'fa-IR')).toBe('۲۰۲۵/۰۶/۱۵');
    expect(getLocaleDateFormat('fa-IR')).toMatchObject({
      order: ['year', 'month', 'day'],
      pattern: 'YYYY/MM/DD',
    });
    expect(fields(parseDate('۲۰۲۵/۰۶/۱۵', 'fa-IR'))).toEqual([2025, 6, 15]);
    expect(fields(parseDate('2025/06/15', 'fa-IR'))).toEqual([2025, 6, 15]);
    // Typed numbers are Gregorian too: the Persian date's digits name the year 1404.
    expect(fields(parseDate('۱۴۰۴/۰۳/۲۵', 'fa-IR'))).toEqual([1404, 3, 25]);
    expect(formatDate(june15, 'ps-AF')).toBe('۲۰۲۵-۰۶-۱۵');
  });

  it('names the Gregorian month in the heading, the day label and the month names (fa-IR)', () => {
    const heading = formatMonthYear(june15, 'fa-IR');
    expect(heading).toBe(gregorian('fa-IR', { month: 'long', year: 'numeric' }));
    expect(heading).toContain('۲۰۲۵');
    const label = formatDayLabel(june15, 'fa-IR');
    expect(label).toBe(
      gregorian('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    );
    expect(label).toContain('۱۵');
    expect(label).not.toContain('۱۴۰۴');
    expect(getMonthNames('fa-IR')[5]).toBe(gregorian('fa-IR', { month: 'long' }));
  });

  it('formats an explicit calendar with other months or eras in the Gregorian one', () => {
    expect(formatDate(june15, 'en-US-u-ca-islamic')).toBe('06/15/2025');
    expect(formatDate(june15, 'ja-JP-u-ca-japanese')).toBe('2025/06/15');
    expect(formatMonthYear(june15, 'en-US-u-ca-hebrew')).toBe('June 2025');
    expect(formatDayLabel(june15, 'en-US-u-ca-persian')).toBe('Sunday, June 15, 2025');
  });

  it('keeps the Buddhist year of th-TH, whose months and days are the Gregorian ones', () => {
    expect(formatDate(june15, 'th-TH')).toBe('15/06/2568');
    expect(getLocaleDateFormat('th-TH').pattern).toBe('DD/MM/YYYY');
    expect(fields(parseDate('15/06/2568', 'th-TH'))).toEqual([2025, 6, 15]);
    expect(formatMonthYear(june15, 'th-TH')).toBe(
      new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(june15),
    );
    expect(formatMonthYear(june15, 'th-TH')).toContain('2568');
  });
});

describe('dateUtils — month and year views', () => {
  it('addYears moves by whole years at local midnight, clamping February 29', () => {
    const moved = addYears(new Date(2024, 1, 29, 15, 30), 1);
    expect(fields(moved)).toEqual([2025, 2, 28]);
    expect(isMidnight(moved)).toBe(true);
    expect(fields(addYears(new Date(2025, 5, 15), -10))).toEqual([2015, 6, 15]);
  });

  it('getDecadeStart floors a year to its decade', () => {
    expect(getDecadeStart(2025)).toBe(2020);
    expect(getDecadeStart(2020)).toBe(2020);
    expect(getDecadeStart(2029)).toBe(2020);
    expect(getDecadeStart(2030)).toBe(2030);
  });

  it('getYearMonths lists the 12 months of a year (the 1st, local midnight)', () => {
    const months = getYearMonths(2025);
    expect(months.map(fields)).toEqual(
      Array.from({ length: 12 }, (_, month) => [2025, month + 1, 1]),
    );
    expect(months.every(isMidnight)).toBe(true);
  });

  it('getDecadeYears lists the decade with the year before and the year after it (January 1)', () => {
    const years = getDecadeYears(2020);
    expect(years.map((year) => year.getFullYear())).toEqual([
      2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
    ]);
    expect(years.map(fields)[0]).toEqual([2019, 1, 1]);
    expect(years.every(isMidnight)).toBe(true);
  });

  it('isMonthOutOfRange is true only for a month wholly outside the bounds', () => {
    const min = new Date(2025, 2, 15, 18);
    const max = new Date(2025, 9, 1);
    expect(isMonthOutOfRange(new Date(2025, 1, 1), min, max)).toBe(true);
    expect(isMonthOutOfRange(new Date(2025, 2, 1), min, max)).toBe(false);
    expect(isMonthOutOfRange(new Date(2025, 9, 1), min, max)).toBe(false);
    expect(isMonthOutOfRange(new Date(2025, 10, 1), min, max)).toBe(true);
    expect(isMonthOutOfRange(new Date(1990, 0, 1))).toBe(false);
  });

  it('isYearOutOfRange is true only for a year wholly outside the bounds', () => {
    const min = new Date(2021, 1, 1);
    const max = new Date(2028, 5, 30);
    expect(isYearOutOfRange(2020, min, max)).toBe(true);
    expect(isYearOutOfRange(2021, min, max)).toBe(false);
    expect(isYearOutOfRange(2028, min, max)).toBe(false);
    expect(isYearOutOfRange(2029, min, max)).toBe(true);
    expect(isYearOutOfRange(1900)).toBe(false);
  });

  it('formats the month and year cells and the decade heading in the locale', () => {
    const june = new Date(2025, 5, 1);
    expect(formatMonthShort(june, 'en-US')).toBe('Jun');
    expect(formatMonthShort(new Date(2025, 2, 1), 'de-DE')).toBe('Mär');
    expect(formatYear(june, 'en-US')).toBe('2025');
    expect(formatDecade(2020, 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', { year: 'numeric' }).formatRange(
        new Date(2020, 0, 1),
        new Date(2029, 11, 31),
      ),
    );
    expect(formatDecade(2020, 'en-US')).toMatch(/^2020\s*–\s*2029$/);
  });

  it('writes the years in the locale digits and the grid-compatible calendar (th-TH, fa-IR)', () => {
    const june = new Date(2025, 5, 1);
    // The Buddhist year of th-TH, without its era; the Gregorian year of fa-IR in its digits.
    expect(formatYear(june, 'th-TH')).toBe('2568');
    expect(formatDecade(2020, 'th-TH')).toContain('2563');
    expect(formatYear(june, 'fa-IR')).toBe('۲۰۲۵');
    expect(formatMonthShort(june, 'fa-IR')).toBe(
      new Intl.DateTimeFormat('fa-IR', { month: 'short', calendar: 'gregory' }).format(june),
    );
  });
});

describe('dateUtils — time helpers', () => {
  it('timeToMinutes accepts HH:mm, HH:mm:ss and 12h times', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('9:05')).toBe(545);
    expect(timeToMinutes('23:59')).toBe(1439);
    expect(timeToMinutes('09:30:45')).toBe(570);
    expect(timeToMinutes('9:00 AM')).toBe(540);
    expect(timeToMinutes('12:00 AM')).toBe(0);
    expect(timeToMinutes('12:30 pm')).toBe(750);
    expect(timeToMinutes('1:00PM')).toBe(780);
    expect(timeToMinutes('11:59 p.m.')).toBe(1439);
  });

  it('timeToMinutes rejects invalid times', () => {
    for (const text of ['', '24:00', '9', '9:', '9:60', '13:00 PM', '0:00 AM', 'abc', '9:00:61']) {
      expect(timeToMinutes(text), text).toBeNaN();
    }
  });

  it('minutesToTime / minutesToValue format both clock styles', () => {
    expect(minutesToTime(0, '12h')).toBe('12:00 AM');
    expect(minutesToTime(555, '12h')).toBe('9:15 AM');
    expect(minutesToTime(780, '12h')).toBe('1:00 PM');
    expect(minutesToTime(780, '24h')).toBe('13:00');
    expect(minutesToValue(545)).toBe('09:05');
  });

  it('normalizeTimeStep guards non-finite and non-positive steps and floors fractions', () => {
    expect(normalizeTimeStep(15)).toEqual({ step: 15, valid: true });
    expect(normalizeTimeStep(0)).toEqual({ step: 30, valid: false });
    expect(normalizeTimeStep(-5)).toEqual({ step: 30, valid: false });
    expect(normalizeTimeStep(Number.NaN)).toEqual({ step: 30, valid: false });
    expect(normalizeTimeStep(Number.POSITIVE_INFINITY)).toEqual({ step: 30, valid: false });
    expect(normalizeTimeStep(7.9)).toEqual({ step: 7, valid: true });
    expect(normalizeTimeStep(0.5)).toEqual({ step: 1, valid: true });
  });

  it('generateTimeOptions has inclusive bounds and stops at an off-step max', () => {
    expect(generateTimeOptions(60, '09:00', '11:00', '24h').map((o) => o.value)).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
    expect(generateTimeOptions(45, '09:00', '10:40', '24h').map((o) => o.value)).toEqual([
      '09:00',
      '09:45',
      '10:30',
    ]);
    expect(generateTimeOptions(60, '9:00 AM', '11:00:00', '12h').map((o) => o.label)).toEqual([
      '9:00 AM',
      '10:00 AM',
      '11:00 AM',
    ]);
  });

  it('generateTimeOptions never loops forever and returns [] for invalid bounds', () => {
    expect(generateTimeOptions(0, '00:00', '23:59', '24h')).toHaveLength(48);
    expect(generateTimeOptions(-1, '00:00', '01:00', '24h')).toHaveLength(3);
    expect(generateTimeOptions(30, 'nine', '17:00', '24h')).toEqual([]);
    expect(generateTimeOptions(30, '17:00', '09:00', '24h')).toEqual([]);
  });

  describe('getSelectionRange', () => {
    const day = (n: number) => new Date(2025, 5, n);
    const dates = (range: Date[]) => range.map((d) => d.getDate());

    it("'day' is the day at local midnight, whatever its availability", () => {
      const range = getSelectionRange(new Date(2025, 5, 18, 15, 30), 'day', 0, [1], () => true);
      expect(range).toEqual([day(18)]);
    });

    it("'week' is the seven days from the week start of firstDayOfWeek", () => {
      expect(dates(getSelectionRange(day(18), 'week', 0, [1]))).toEqual([
        15, 16, 17, 18, 19, 20, 21,
      ]);
      expect(dates(getSelectionRange(day(15), 'week', 1, [1]))).toEqual([
        9, 10, 11, 12, 13, 14, 15,
      ]);
    });

    it("'work-week' keeps the workWeekDays of that week, in the order of the week", () => {
      expect(dates(getSelectionRange(day(18), 'work-week', 0, [1, 2, 3, 4, 5]))).toEqual([
        16, 17, 18, 19, 20,
      ]);
      expect(dates(getSelectionRange(day(18), 'work-week', 0, [6, 0]))).toEqual([15, 21]);
      expect(dates(getSelectionRange(day(18), 'work-week', 1, [0, 6]))).toEqual([21, 22]);
      expect(getSelectionRange(day(18), 'work-week', 1, [])).toEqual([]);
    });

    it("'month' is every day of the month, February of a leap year included", () => {
      expect(getSelectionRange(day(18), 'month', 0, [1])).toHaveLength(30);
      expect(getSelectionRange(new Date(2024, 1, 10), 'month', 0, [1])).toHaveLength(29);
      expect(getSelectionRange(new Date(2025, 1, 10), 'month', 0, [1])).toHaveLength(28);
    });

    it('leaves out the days isUnavailable names, in every range mode but day', () => {
      const unavailable = (d: Date) => d.getDate() % 2 === 0;
      expect(dates(getSelectionRange(day(18), 'week', 0, [1], unavailable))).toEqual([
        15, 17, 19, 21,
      ]);
      expect(getSelectionRange(day(18), 'month', 0, [1], unavailable)).toHaveLength(15);
    });

    it('returns local-midnight dates across a month end', () => {
      for (const d of getSelectionRange(new Date(2025, 5, 30, 23, 59), 'week', 0, [1])) {
        expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
      }
    });
  });
});
