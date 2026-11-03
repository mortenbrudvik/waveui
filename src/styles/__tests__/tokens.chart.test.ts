// @vitest-environment node
/**
 * The chart series colours (`--wave-chart-1` to `--wave-chart-10`) as a set. Each colour is 3:1
 * on the page and on a card (the contrast matrix of `tokens.test.ts` asserts it per pair); this
 * file asserts what no pair test can: that the ten stay apart from each other in the light and
 * dark themes, for full colour vision and under simulated colour-vision deficiencies (Machado
 * 2009 at full severity, in linear sRGB; the distance is OKLab ΔE × 100, the measure
 * `chartPalette`'s documentation uses). `chartPalette`'s 12 persona fills have a worst pair of
 * about 3.2; these ten were chosen to keep every pair at 7 or more, and the first five at 9 or
 * more, so a chart with few series reads best.
 */
import { describe, expect, it } from 'vitest';
import { chartSeries, waveTokens } from '../../lib/waveTokens';
import { tokenVariable } from '../../lib/tokens';
import { CHART_SERIES, contrastRatio, resolved, type ThemeName } from './tokensHarness';

type Rgb = [number, number, number];
type Vision = 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia';

const MACHADO: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const VISIONS: Vision[] = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'];

const toLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

function hexToLinear(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((at) => toLinear(parseInt(value.slice(at, at + 2), 16) / 255)) as Rgb;
}

function oklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** The colour as seen with `vision`, as OKLab. */
function seen(hex: string, vision: Vision): Rgb {
  const linear = hexToLinear(hex);
  if (vision === 'normal') return oklab(linear);
  const matrix = MACHADO[vision];
  const simulated = matrix.map(
    (row) => row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2],
  );
  return oklab(simulated.map((channel) => Math.min(1, Math.max(0, channel))) as Rgb);
}

/** OKLab distance × 100 of two colours under `vision`. */
function distance(a: string, b: string, vision: Vision): number {
  const [l1, a1, b1] = seen(a, vision);
  const [l2, a2, b2] = seen(b, vision);
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** The smallest distance of any two of `colours` under any vision, with the pair that holds it. */
function worstPair(colours: string[]): {
  distance: number;
  pair: [number, number];
  vision: Vision;
} {
  let worst: { distance: number; pair: [number, number]; vision: Vision } = {
    distance: Infinity,
    pair: [0, 0],
    vision: 'normal',
  };
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      for (const vision of VISIONS) {
        const value = distance(colours[i], colours[j], vision);
        if (value < worst.distance) worst = { distance: value, pair: [i + 1, j + 1], vision };
      }
    }
  }
  return worst;
}

const seriesOf = (theme: ThemeName): string[] => CHART_SERIES.map((name) => resolved(theme, name));

describe('chartSeries', () => {
  it('lists chart1 to chart10 in order, as the tokens of tokens.css', () => {
    expect(chartSeries).toEqual(CHART_SERIES.map((name) => name.replace('-', '')));
    expect(chartSeries.map((name) => tokenVariable(name))).toEqual(
      CHART_SERIES.map((name) => `--wave-${name}`),
    );
    expect(chartSeries.map((name) => waveTokens[name])[0]).toBe('var(--wave-chart-1)');
    expect(Object.isFrozen(chartSeries)).toBe(true);
  });
});

describe('tokens.css — chart series as a set (1.1)', () => {
  it.each(['light', 'dark'] as const)(
    '%s: ten distinct colours, each at least 3:1 on the page and on a card',
    (theme) => {
      const colours = seriesOf(theme);
      expect(new Set(colours).size).toBe(10);
      const page = resolved(theme, 'background');
      const card = resolved(theme, 'card');
      const below = colours.flatMap((colour, index) =>
        [page, card]
          .filter((surface) => contrastRatio(colour, surface) < 3)
          .map((surface) => `chart-${index + 1} ${colour} on ${surface}`),
      );
      expect(below).toEqual([]);
    },
  );

  it.each(['light', 'dark'] as const)(
    '%s: every pair of the ten differs by at least 7 for full colour vision, protanopia, deuteranopia and tritanopia',
    (theme) => {
      const worst = worstPair(seriesOf(theme));
      expect(
        worst.distance,
        `chart-${worst.pair[0]} and chart-${worst.pair[1]} under ${worst.vision}`,
      ).toBeGreaterThanOrEqual(7);
    },
  );

  it.each(['light', 'dark'] as const)(
    '%s: the first five (a chart with few series) differ by at least 9',
    (theme) => {
      const worst = worstPair(seriesOf(theme).slice(0, 5));
      expect(
        worst.distance,
        `chart-${worst.pair[0]} and chart-${worst.pair[1]} under ${worst.vision}`,
      ).toBeGreaterThanOrEqual(9);
    },
  );

  it.each(['light', 'dark'] as const)(
    '%s: the first three differ by at least 15, the first colour is blue and none is grey',
    (theme) => {
      const colours = seriesOf(theme);
      expect(worstPair(colours.slice(0, 3)).distance).toBeGreaterThanOrEqual(15);
      // Blue: the blue channel leads the red and green ones.
      const [r, g, b] = hexToLinear(colours[0]);
      expect(b).toBeGreaterThan(Math.max(r, g));
      for (const colour of colours) {
        const [l, a, bAxis] = seen(colour, 'normal');
        expect(Math.hypot(a, bAxis) / Math.max(l, 0.01), colour).toBeGreaterThan(0.08);
      }
    },
  );

  it('high contrast draws every series white, as the palette does: a second encoding tells them apart', () => {
    expect(seriesOf('high-contrast')).toEqual(Array(10).fill('#ffffff'));
  });

  it('measures what the documentation says about the persona palette (a check of the measure)', () => {
    // chartPalette's twelve fills: the worst pair is far below the ten series' floor.
    const palette = [
      'blue',
      'purple',
      'brown',
      'teal',
      'red',
      'navy',
      'pumpkin',
      'steel',
      'gold',
      'lavender',
      'forest',
      'magenta',
    ].map((hue) => resolved('light', `palette-${hue}`));
    expect(worstPair(palette).distance).toBeLessThan(5);
    expect(worstPair(seriesOf('light')).distance).toBeGreaterThan(worstPair(palette).distance * 2);
  });
});
