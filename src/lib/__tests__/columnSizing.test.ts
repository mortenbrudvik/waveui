import { describe, it, expect } from 'vitest';
import {
  clampColumnWidth,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MIN_COLUMN_WIDTH,
  getColumnEntry,
  initialColumnWidth,
  resolveColumnWidths,
  totalWidth,
} from '../columnSizing';

describe('column sizing constants', () => {
  it('start a column at 150 pixels and keep it at 80 or more', () => {
    expect(DEFAULT_COLUMN_WIDTH).toBe(150);
    expect(DEFAULT_MIN_COLUMN_WIDTH).toBe(80);
  });
});

describe('clampColumnWidth', () => {
  it('keeps a width at or above the default minimum', () => {
    expect(clampColumnWidth(200)).toBe(200);
    expect(clampColumnWidth(80)).toBe(80);
    expect(clampColumnWidth(10)).toBe(80);
    expect(clampColumnWidth(-5)).toBe(80);
  });

  it('uses the minWidth of the option', () => {
    expect(clampColumnWidth(100, { minWidth: 120 })).toBe(120);
    expect(clampColumnWidth(100, { minWidth: 40 })).toBe(100);
    expect(clampColumnWidth(30, { minWidth: 40 })).toBe(40);
  });

  it('has no maximum', () => {
    expect(clampColumnWidth(100000)).toBe(100000);
  });

  it('turns a width that is not a finite number into the minimum', () => {
    expect(clampColumnWidth(Number.NaN)).toBe(80);
    expect(clampColumnWidth(Number.NaN, { minWidth: 60 })).toBe(60);
  });
});

describe('resolveColumnWidths', () => {
  it('gives every column the default width without options or widths', () => {
    expect(resolveColumnWidths(['a', 'b'], undefined, undefined)).toEqual({ a: 150, b: 150 });
  });

  it('starts a column at defaultWidth, else idealWidth, else 150', () => {
    const widths = resolveColumnWidths(
      ['both', 'ideal', 'default', 'none'],
      {
        both: { defaultWidth: 220, idealWidth: 300 },
        ideal: { idealWidth: 300 },
        default: { defaultWidth: 220 },
      },
      undefined,
    );
    expect(widths).toEqual({ both: 220, ideal: 300, default: 220, none: 150 });
  });

  it('clamps the initial width to minWidth', () => {
    expect(
      resolveColumnWidths(
        ['a', 'b'],
        { a: { defaultWidth: 50 }, b: { idealWidth: 100, minWidth: 180 } },
        undefined,
      ),
    ).toEqual({ a: 80, b: 180 });
  });

  it('lets a given width override the initial one, clamped', () => {
    expect(
      resolveColumnWidths(
        ['a', 'b', 'c'],
        { a: { defaultWidth: 300 }, b: { minWidth: 100 } },
        { a: 90, b: 20, c: 500 },
      ),
    ).toEqual({ a: 90, b: 100, c: 500 });
  });

  it('keeps the initial width of a column without a given width', () => {
    expect(resolveColumnWidths(['a', 'b'], { b: { defaultWidth: 210 } }, { a: 111 })).toEqual({
      a: 111,
      b: 210,
    });
  });

  it('ignores ids that are not columns, in the options and in the widths', () => {
    const widths = resolveColumnWidths(['a'], { ghost: { defaultWidth: 400 } }, { ghost: 400 });
    expect(widths).toEqual({ a: 150 });
    expect(Object.keys(widths)).toEqual(['a']);
  });

  it('ignores a given width that is not a finite number', () => {
    expect(resolveColumnWidths(['a'], undefined, { a: Number.NaN })).toEqual({ a: 150 });
  });

  it('returns an empty map for no columns', () => {
    expect(resolveColumnWidths([], undefined, { a: 100 })).toEqual({});
  });

  it('never takes an inherited member of the options or the widths for a column', () => {
    const options: Record<string, { minWidth?: number }> = {};
    expect(resolveColumnWidths(['constructor', 'toString'], options, {})).toEqual({
      constructor: 150,
      toString: 150,
    });
  });
});

describe('totalWidth', () => {
  it('sums the widths of the listed columns', () => {
    expect(totalWidth(['a', 'b'], { a: 100, b: 250, c: 999 })).toBe(350);
  });

  it('counts a column without a width as 0, and no column as 0', () => {
    expect(totalWidth(['a', 'x'], { a: 100 })).toBe(100);
    expect(totalWidth([], { a: 100 })).toBe(0);
  });

  it('counts a column named like an inherited member as 0 when it has no width', () => {
    expect(totalWidth(['a', 'constructor', 'toString'], { a: 100 })).toBe(100);
  });
});

describe('getColumnEntry', () => {
  it('returns the own entry of a column and never an inherited member', () => {
    const widths: Record<string, number> = { a: 100 };
    expect(getColumnEntry(widths, 'a')).toBe(100);
    expect(getColumnEntry(widths, 'b')).toBeUndefined();
    expect(getColumnEntry(widths, 'constructor')).toBeUndefined();
    expect(getColumnEntry(widths, 'toString')).toBeUndefined();
    expect(getColumnEntry(undefined, 'a')).toBeUndefined();
  });
});

describe('initialColumnWidth', () => {
  it('is defaultWidth, else idealWidth, else 150, held at the minimum', () => {
    expect(initialColumnWidth()).toBe(150);
    expect(initialColumnWidth({ idealWidth: 120 })).toBe(120);
    expect(initialColumnWidth({ idealWidth: 120, defaultWidth: 200 })).toBe(200);
    expect(initialColumnWidth({ defaultWidth: 50 })).toBe(80);
    expect(initialColumnWidth({ defaultWidth: 90, minWidth: 100 })).toBe(100);
  });
});
