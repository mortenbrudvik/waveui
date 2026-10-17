import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysInMonth,
  getWeekNumber,
  isSameDay,
  makeDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../date';

const fields = (d: Date) => [
  d.getFullYear(),
  d.getMonth() + 1,
  d.getDate(),
  d.getHours(),
  d.getMinutes(),
];

describe('date helpers', () => {
  it('return local midnight', () => {
    expect(fields(addDays(new Date(2025, 2, 30, 23, 30), 1))).toEqual([2025, 3, 31, 0, 0]);
    expect(fields(addMonths(new Date(2025, 0, 31, 12), 1))).toEqual([2025, 2, 28, 0, 0]);
    expect(fields(addMonths(new Date(2024, 0, 31), 1))).toEqual([2024, 2, 29, 0, 0]);
    expect(fields(startOfWeek(new Date(2025, 5, 12, 15), 1))).toEqual([2025, 6, 9, 0, 0]);
  });

  it('addDays crosses month and year boundaries in both directions', () => {
    expect(fields(addDays(new Date(2025, 11, 31), 1))).toEqual([2026, 1, 1, 0, 0]);
    expect(fields(addDays(new Date(2025, 0, 1, 9), -1))).toEqual([2024, 12, 31, 0, 0]);
  });

  it('addMonths accepts negative amounts and clamps the day', () => {
    expect(fields(addMonths(new Date(2025, 2, 31), -1))).toEqual([2025, 2, 28, 0, 0]);
    expect(fields(addMonths(new Date(2024, 2, 31), -1))).toEqual([2024, 2, 29, 0, 0]);
    expect(fields(addMonths(new Date(2025, 0, 15), -2))).toEqual([2024, 11, 15, 0, 0]);
    expect(fields(addMonths(new Date(2025, 10, 30), 3))).toEqual([2026, 2, 28, 0, 0]);
    expect(fields(addMonths(new Date(2025, 5, 10), -18))).toEqual([2023, 12, 10, 0, 0]);
  });

  it('makeDate maps years 0-99 literally and rolls fields over', () => {
    const early = makeDate(25, 5, 1);
    expect(early.getFullYear()).toBe(25);
    expect(fields(early).slice(1)).toEqual([6, 1, 0, 0]);
    expect(makeDate(99, 0, 1).getFullYear()).toBe(99);
    expect(fields(makeDate(2025, 12, 1))).toEqual([2026, 1, 1, 0, 0]);
    expect(fields(makeDate(2025, 0, 0))).toEqual([2024, 12, 31, 0, 0]);
  });

  it('daysInMonth, startOfDay and startOfMonth', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2025, 1)).toBe(28);
    expect(daysInMonth(2025, 11)).toBe(31);
    expect(daysInMonth(2025, 12)).toBe(31); // out of range: January 2026
    expect(fields(startOfDay(new Date(2025, 5, 12, 23, 59)))).toEqual([2025, 6, 12, 0, 0]);
    expect(fields(startOfMonth(new Date(2025, 5, 12, 23, 59)))).toEqual([2025, 6, 1, 0, 0]);
  });

  it('compare calendar days', () => {
    expect(isSameDay(new Date(2025, 5, 1, 1), new Date(2025, 5, 1, 23))).toBe(true);
    expect(isSameDay(new Date(2025, 5, 1), new Date(2025, 5, 2))).toBe(false);
    expect(isSameDay(new Date(2025, 5, 1), null)).toBe(false);
    expect(isSameDay(undefined, new Date(2025, 5, 1))).toBe(false);
  });

  // 2025-06-12 is a Thursday.
  it.each([
    [0, 8],
    [1, 9],
    [2, 10],
    [3, 11],
    [4, 12],
    [5, 6],
    [6, 7],
  ] as const)('startOfWeek for firstDayOfWeek %i is June %i', (first, dayOfMonth) => {
    const day = startOfWeek(new Date(2025, 5, 12, 18), first);
    expect(day.getDay()).toBe(first);
    expect(fields(day)).toEqual([2025, 6, dayOfMonth, 0, 0]);
  });

  it('startOfWeek defaults to Sunday and stays on a week start', () => {
    expect(fields(startOfWeek(new Date(2025, 5, 12)))).toEqual([2025, 6, 8, 0, 0]);
    expect(fields(startOfWeek(new Date(2025, 5, 9, 8), 1))).toEqual([2025, 6, 9, 0, 0]);
  });

  it('numbers ISO weeks (first-four-day-week, Monday)', () => {
    const iso = { firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' } as const;
    expect(getWeekNumber(new Date(2021, 0, 1), iso)).toBe(53);
    expect(getWeekNumber(new Date(2026, 11, 31), iso)).toBe(53);
    expect(getWeekNumber(new Date(2027, 0, 4), iso)).toBe(1);
    expect(getWeekNumber(new Date(2025, 11, 29), iso)).toBe(1);
  });

  it('numbers first-day and first-full-week weeks', () => {
    expect(getWeekNumber(new Date(2025, 0, 1))).toBe(1); // first-day, Sunday
    expect(getWeekNumber(new Date(2025, 0, 4))).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 5))).toBe(2);
    expect(getWeekNumber(new Date(2025, 0, 4), { firstWeekOfYear: 'first-full-week' })).toBe(52); // Jan 5 2025 is the first Sunday
    expect(getWeekNumber(new Date(2025, 0, 5), { firstWeekOfYear: 'first-full-week' })).toBe(1);
  });

  it('numbers weeks across a year boundary for each rule', () => {
    // 2024-12-29 (Sunday) starts the week that holds 2025-01-01.
    expect(getWeekNumber(new Date(2024, 11, 28))).toBe(52);
    expect(getWeekNumber(new Date(2024, 11, 29))).toBe(1);
    expect(getWeekNumber(new Date(2024, 11, 31))).toBe(1);
    // first-full-week: days before the first Sunday of 2025 close 2024 (week 52 in 2024's count).
    const full = { firstWeekOfYear: 'first-full-week' } as const;
    expect(getWeekNumber(new Date(2024, 11, 31), full)).toBe(52);
    expect(getWeekNumber(new Date(2024, 11, 28), full)).toBe(51);
    expect(getWeekNumber(new Date(2024, 11, 29), full)).toBe(52);
    expect(getWeekNumber(new Date(2025, 0, 1), full)).toBe(52);
    expect(getWeekNumber(new Date(2025, 0, 12), full)).toBe(2);
    // ISO: Thursday-rule edges. 2024-12-30 is Monday of ISO week 1 of 2025.
    const iso = { firstDayOfWeek: 1, firstWeekOfYear: 'first-four-day-week' } as const;
    expect(getWeekNumber(new Date(2024, 11, 29), iso)).toBe(52);
    expect(getWeekNumber(new Date(2024, 11, 30), iso)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 5), iso)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 6), iso)).toBe(2);
    expect(getWeekNumber(new Date(2020, 11, 31), iso)).toBe(53);
    expect(getWeekNumber(new Date(2021, 0, 4), iso)).toBe(1);
  });

  it('numbers Monday weeks for first-day and first-full-week', () => {
    // 2025-01-01 is a Wednesday; 2024-01-01 was a Monday.
    const firstDay = { firstDayOfWeek: 1, firstWeekOfYear: 'first-day' } as const;
    expect(getWeekNumber(new Date(2024, 11, 29), firstDay)).toBe(52);
    expect(getWeekNumber(new Date(2024, 11, 30), firstDay)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 1), firstDay)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 5), firstDay)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 6), firstDay)).toBe(2);
    const full = { firstDayOfWeek: 1, firstWeekOfYear: 'first-full-week' } as const;
    expect(getWeekNumber(new Date(2024, 11, 29), full)).toBe(52);
    expect(getWeekNumber(new Date(2024, 11, 30), full)).toBe(53);
    expect(getWeekNumber(new Date(2025, 0, 1), full)).toBe(53);
    expect(getWeekNumber(new Date(2025, 0, 5), full)).toBe(53);
    expect(getWeekNumber(new Date(2025, 0, 6), full)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 12), full)).toBe(1);
    expect(getWeekNumber(new Date(2025, 0, 13), full)).toBe(2);
  });

  it('ignores the time of day when numbering weeks', () => {
    expect(getWeekNumber(new Date(2025, 0, 5, 23, 59))).toBe(getWeekNumber(new Date(2025, 0, 5)));
  });
});
