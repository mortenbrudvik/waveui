import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  clampDate,
  formatDate,
  formatDayLabel,
  formatISODate,
  formatMonthYear,
  generateTimeOptions,
  getCalendarDays,
  getLocaleDateFormat,
  getMonthNames,
  getWeekdayNames,
  isDateInRange,
  isSameDay,
  isSameMonth,
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
    const locales = [undefined, 'en-GB', 'en-US', 'de-DE', 'fr-FR', 'nb-NO', 'ja-JP', 'sv-SE'];
    const dates = [new Date(2025, 0, 1), new Date(2025, 3, 3), new Date(2024, 1, 29)];
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
});
