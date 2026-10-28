import { describe, expect, it } from 'vitest';
import {
  computeVirtualLayout,
  scrollOffsetForIndex,
  type ScrollOffsetInput,
  type VirtualEntry,
  type VirtualLayoutInput,
} from '../virtual';

const items = (entries: readonly VirtualEntry[]) =>
  entries.flatMap((entry) => (entry.kind === 'item' ? [entry.index] : []));

const spacers = (entries: readonly VirtualEntry[]) =>
  entries.flatMap((entry) => (entry.kind === 'spacer' ? [entry] : []));

/** A compact picture of the layout: item indexes as numbers, spacers as `[size]`. */
const shape = (entries: readonly VirtualEntry[]) =>
  entries.map((entry) => (entry.kind === 'item' ? entry.index : `[${entry.size}]`));

const totalSize = (entries: readonly VirtualEntry[], itemSize: number) =>
  entries.reduce((sum, entry) => sum + (entry.kind === 'item' ? itemSize : entry.size), 0);

const layout = (overrides: Partial<VirtualLayoutInput> = {}) =>
  computeVirtualLayout({
    count: 100,
    itemSize: 10,
    firstVisible: 20,
    viewportSize: 50,
    overscan: 2,
    ...overrides,
  });

describe('computeVirtualLayout', () => {
  it('renders the visible rows with the overscan and spacers for the rest', () => {
    // visibleCount = 5, start = 18, end = 27 (exclusive).
    expect(shape(layout())).toEqual([
      '[180]',
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      `[${(100 - 1 - 26) * 10}]`,
    ]);
  });

  it('rounds the visible count up to whole rows', () => {
    // 45 / 10 -> 5 rows.
    expect(items(layout({ viewportSize: 45, overscan: 0 }))).toEqual([20, 21, 22, 23, 24]);
    expect(items(layout({ viewportSize: 51, overscan: 0 }))).toEqual([20, 21, 22, 23, 24, 25]);
  });

  it('shows at least one row for an empty or invalid viewport', () => {
    expect(items(layout({ viewportSize: 0, overscan: 0 }))).toEqual([20]);
    expect(items(layout({ viewportSize: Number.NaN, overscan: 0 }))).toEqual([20]);
  });

  it('returns nothing for a count of zero or less', () => {
    expect(
      computeVirtualLayout({
        count: 0,
        itemSize: 10,
        firstVisible: 0,
        viewportSize: 50,
        overscan: 2,
      }),
    ).toEqual([]);
    expect(
      computeVirtualLayout({
        count: -3,
        itemSize: 10,
        firstVisible: 0,
        viewportSize: 50,
        overscan: 2,
      }),
    ).toEqual([]);
    expect(
      computeVirtualLayout({
        count: 0,
        itemSize: 10,
        firstVisible: Number.NaN,
        viewportSize: 50,
        overscan: 2,
        keep: [0],
      }),
    ).toEqual([]);
  });

  it('renders a single row without spacers', () => {
    expect(shape(layout({ count: 1, firstVisible: 0 }))).toEqual([0]);
  });

  it('renders every row, without spacers, when the window is larger than the list', () => {
    expect(shape(layout({ count: 4, firstVisible: 0 }))).toEqual([0, 1, 2, 3]);
    expect(shape(layout({ count: 4, firstVisible: 2, viewportSize: 500 }))).toEqual([0, 1, 2, 3]);
  });

  it('renders every row when the list is exactly the window', () => {
    expect(shape(layout({ count: 5, firstVisible: 0, overscan: 0 }))).toEqual([0, 1, 2, 3, 4]);
  });

  it('has no leading spacer at the top and no trailing spacer at the end', () => {
    expect(shape(layout({ firstVisible: 0 }))).toEqual([0, 1, 2, 3, 4, 5, 6, `[${(99 - 6) * 10}]`]);
    // firstVisible 95: start 93, end min(100, 102) = 100.
    expect(shape(layout({ firstVisible: 95 }))).toEqual(['[930]', 93, 94, 95, 96, 97, 98, 99]);
  });

  it('clamps firstVisible to the last full page, so a shrunk list keeps its rows in view', () => {
    // viewport 480 / itemSize 44 -> 11 rows; the browser shows rows 9..19 of 20 at most.
    const shrunk = { count: 20, itemSize: 44, viewportSize: 480, overscan: 6 };
    const entries = computeVirtualLayout({ ...shrunk, firstVisible: 5000 });
    expect(shape(entries)).toEqual(['[132]', ...Array.from({ length: 17 }, (_, i) => i + 3)]);
    expect(entries).toEqual(computeVirtualLayout({ ...shrunk, firstVisible: 20 - 11 }));
    expect(totalSize(entries, 44)).toBe(20 * 44);
  });

  it('clamps firstVisible to the list', () => {
    expect(layout({ firstVisible: -40 })).toEqual(layout({ firstVisible: 0 }));
    expect(layout({ firstVisible: 5000 })).toEqual(layout({ firstVisible: 99 }));
    expect(items(layout({ firstVisible: 5000 })).at(-1)).toBe(99);
  });

  it('floors a fractional firstVisible and treats NaN as the top', () => {
    expect(layout({ firstVisible: 20.9 })).toEqual(layout({ firstVisible: 20 }));
    expect(layout({ firstVisible: Number.NaN })).toEqual(layout({ firstVisible: 0 }));
  });

  it('works without an overscan', () => {
    expect(shape(layout({ overscan: 0 }))).toEqual([
      '[200]',
      20,
      21,
      22,
      23,
      24,
      `[${(99 - 24) * 10}]`,
    ]);
  });

  it('treats a negative overscan as none', () => {
    expect(layout({ overscan: -5 })).toEqual(layout({ overscan: 0 }));
  });

  describe('keep', () => {
    it('adds an index before the range as its own run, with a gap spacer', () => {
      expect(shape(layout({ overscan: 0, keep: [3] }))).toEqual([
        '[30]',
        3,
        '[160]',
        20,
        21,
        22,
        23,
        24,
        `[${75 * 10}]`,
      ]);
    });

    it('adds an index after the range as its own run', () => {
      expect(shape(layout({ overscan: 0, keep: [60] }))).toEqual([
        '[200]',
        20,
        21,
        22,
        23,
        24,
        '[350]',
        60,
        `[${39 * 10}]`,
      ]);
    });

    it('adds the first and the last index without edge spacers', () => {
      expect(shape(layout({ overscan: 0, keep: [0, 99] }))).toEqual([
        0,
        '[190]',
        20,
        21,
        22,
        23,
        24,
        '[740]',
        99,
      ]);
    });

    it('ignores an index inside the range', () => {
      expect(layout({ keep: [20, 22] })).toEqual(layout());
      expect(layout({ keep: [18, 26] })).toEqual(layout());
    });

    it('joins an index next to the range into the same run', () => {
      expect(layout({ overscan: 0, keep: [19, 25] })).toEqual(
        layout({ overscan: 0, firstVisible: 19, viewportSize: 70 }),
      );
      expect(spacers(layout({ overscan: 0, keep: [19, 25] }))).toHaveLength(2);
    });

    it('sorts and de-duplicates the kept indexes', () => {
      const entries = layout({ overscan: 0, keep: [60, 3, 60, 3, 40] });
      expect(items(entries)).toEqual([3, 20, 21, 22, 23, 24, 40, 60]);
      expect(entries).toEqual(layout({ overscan: 0, keep: [3, 40, 60] }));
    });

    it('makes adjacent kept indexes one run', () => {
      expect(shape(layout({ overscan: 0, keep: [60, 61, 62] }))).toEqual([
        '[200]',
        20,
        21,
        22,
        23,
        24,
        '[350]',
        60,
        61,
        62,
        `[${37 * 10}]`,
      ]);
    });

    it('ignores indexes outside the list and non-integers', () => {
      expect(layout({ keep: [-1, 100, 5000, 3.5, Number.NaN, Number.POSITIVE_INFINITY] })).toEqual(
        layout(),
      );
    });

    it('is not mutated', () => {
      const keep = Object.freeze([60, 3]);
      expect(() => layout({ keep })).not.toThrow();
      expect(keep).toEqual([60, 3]);
    });
  });

  describe('invariants', () => {
    const counts = [1, 2, 5, 7, 100, 10_000];
    const sizes = [1, 10, 36.5];
    const viewports = [0, 40, 320];
    const overscans = [0, 3];
    const keeps: (readonly number[] | undefined)[] = [
      undefined,
      [],
      [0],
      [0, 99],
      [3, 3, 50, 7],
      [-1, 1e9, 2.5],
    ];

    const cases: VirtualLayoutInput[] = [];
    for (const count of counts) {
      for (const itemSize of sizes) {
        for (const viewportSize of viewports) {
          for (const overscan of overscans) {
            for (const keep of keeps) {
              for (const firstVisible of [-5, 0, Math.floor(count / 2), count - 1, count + 7]) {
                cases.push({ count, itemSize, viewportSize, overscan, keep, firstVisible });
              }
            }
          }
        }
      }
    }

    it('sums the item and spacer sizes to count * itemSize', () => {
      for (const input of cases) {
        const entries = computeVirtualLayout(input);
        expect(totalSize(entries, input.itemSize), JSON.stringify(input)).toBeCloseTo(
          input.count * input.itemSize,
          6,
        );
      }
    });

    it('lists ascending, de-duplicated indexes, each within the list', () => {
      for (const input of cases) {
        const indexes = items(computeVirtualLayout(input));
        const invalid = indexes.filter(
          (index, i) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= input.count ||
            (i > 0 && index <= indexes[i - 1]!),
        );
        expect(invalid, JSON.stringify(input)).toEqual([]);
      }
    });

    it('has no zero-size spacer, no two spacers in a row and unique keys', () => {
      for (const input of cases) {
        const entries = computeVirtualLayout(input);
        const message = JSON.stringify(input);
        const keys = spacers(entries).map((spacer) => spacer.key);
        expect(new Set(keys).size, message).toBe(keys.length);
        entries.forEach((entry, i) => {
          if (entry.kind !== 'spacer') return;
          expect(entry.size, message).toBeGreaterThan(0);
          expect(entries[i + 1]?.kind, message).not.toBe('spacer');
        });
      }
    });

    it('always includes the clamped first visible row', () => {
      for (const input of cases) {
        const visibleCount = Math.max(1, Math.ceil(input.viewportSize / input.itemSize));
        const clamped = Math.min(
          Math.max(0, input.firstVisible),
          Math.max(0, input.count - visibleCount),
        );
        expect(items(computeVirtualLayout(input)), JSON.stringify(input)).toContain(clamped);
      }
    });
  });

  describe('spacer keys', () => {
    it('names a spacer after the item that follows it', () => {
      const entries = layout({ overscan: 0, keep: [3, 60] });
      expect(spacers(entries).map((spacer) => spacer.key)).toEqual([
        'spacer-3',
        'spacer-20',
        'spacer-60',
        'spacer-end',
      ]);
    });

    it('names the trailing spacer spacer-end', () => {
      expect(spacers(layout({ firstVisible: 0 })).map((spacer) => spacer.key)).toEqual([
        'spacer-end',
      ]);
    });

    it('keeps a spacer key while the window scrolls but the next item stays', () => {
      const a = spacers(layout({ firstVisible: 20 }))[0]!;
      const b = spacers(layout({ firstVisible: 20, viewportSize: 80 }))[0]!;
      expect(a.key).toBe('spacer-18');
      expect(b.key).toBe(a.key);
    });
  });

  it('returns a small array for a long list', () => {
    const viewportSize = 400;
    const itemSize = 20;
    const overscan = 4;
    const entries = computeVirtualLayout({
      count: 10_000,
      itemSize,
      firstVisible: 5000,
      viewportSize,
      overscan,
    });
    const windowRows = Math.ceil(viewportSize / itemSize) + 2 * overscan;
    expect(entries.length).toBeLessThanOrEqual(windowRows + 4);
    expect(items(entries)).toHaveLength(windowRows);
    expect(totalSize(entries, itemSize)).toBe(10_000 * itemSize);
  });

  it('stays small with kept indexes at both ends', () => {
    const entries = computeVirtualLayout({
      count: 10_000,
      itemSize: 20,
      firstVisible: 5000,
      viewportSize: 400,
      overscan: 4,
      keep: [0, 9999],
    });
    expect(entries.length).toBeLessThanOrEqual(28 + 4 + 2);
  });

  it('uses one row for a non-positive itemSize instead of dividing by zero', () => {
    const entries = computeVirtualLayout({
      count: 5,
      itemSize: 0,
      firstVisible: 2,
      viewportSize: 100,
      overscan: 0,
    });
    expect(entries.every((entry) => entry.kind === 'item' || Number.isFinite(entry.size))).toBe(
      true,
    );
    expect(items(entries)).toContain(2);
  });
});

describe('scrollOffsetForIndex', () => {
  const base: Omit<ScrollOffsetInput, 'index' | 'align'> = {
    count: 100,
    itemSize: 10,
    scrollTop: 300,
    viewportSize: 50,
  };
  const offset = (
    index: number,
    align: 'auto' | 'start' | 'center' | 'end',
    rest: Partial<typeof base> = {},
  ) => scrollOffsetForIndex({ ...base, ...rest, index, align });

  it('puts the row at the start', () => {
    expect(offset(40, 'start')).toBe(400);
  });

  it('puts the row at the end', () => {
    // row 40 spans 400..410; its bottom meets the viewport bottom at 410 - 50.
    expect(offset(40, 'end')).toBe(360);
  });

  it('centers the row', () => {
    // top 400 + half a row (5) - half the viewport (25).
    expect(offset(40, 'center')).toBe(380);
  });

  it('clamps at the first index', () => {
    expect(offset(0, 'start')).toBe(0);
    expect(offset(0, 'center')).toBe(0);
    expect(offset(0, 'end')).toBe(0);
    expect(offset(0, 'auto')).toBe(0);
  });

  it('clamps at the last index to the end of the content', () => {
    // content 1000, viewport 50: the largest offset is 950.
    expect(offset(99, 'start')).toBe(950);
    expect(offset(99, 'center')).toBe(950);
    expect(offset(99, 'end')).toBe(950);
    expect(offset(99, 'auto')).toBe(950);
  });

  it('clamps an index outside the list to the first or last row', () => {
    expect(offset(-5, 'start')).toBe(0);
    expect(offset(500, 'start')).toBe(950);
  });

  it('returns 0 when the content is smaller than the viewport', () => {
    for (const align of ['auto', 'start', 'center', 'end'] as const) {
      expect(offset(2, align, { count: 3, viewportSize: 500, scrollTop: 40 })).toBe(0);
    }
  });

  it('returns 0 for an empty list', () => {
    expect(offset(0, 'start', { count: 0 })).toBe(0);
  });

  describe('auto', () => {
    it('keeps the current offset when the row is fully visible', () => {
      // viewport 300..350: rows 30 to 34.
      expect(offset(30, 'auto')).toBe(300);
      expect(offset(32, 'auto')).toBe(300);
      expect(offset(34, 'auto')).toBe(300);
    });

    it('moves the minimum up to a row above', () => {
      expect(offset(25, 'auto')).toBe(250);
      expect(offset(29, 'auto')).toBe(290);
    });

    it('moves the minimum down to a row below', () => {
      // row 35 spans 350..360: the bottom edge goes to the viewport bottom.
      expect(offset(35, 'auto')).toBe(310);
      expect(offset(60, 'auto')).toBe(560);
    });

    it('moves for a row that is only partly visible', () => {
      expect(offset(30, 'auto', { scrollTop: 305 })).toBe(300);
      expect(offset(35, 'auto', { scrollTop: 305 })).toBe(310);
    });
  });
});
