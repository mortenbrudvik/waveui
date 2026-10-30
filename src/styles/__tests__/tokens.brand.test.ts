// @vitest-environment node
/**
 * Generated brand ramps against the contrast matrix of `tokens.css` (R7): `createBrandTokens`
 * keeps the default ramp's luminance at every stop, so every pair of the matrix that holds with
 * the default ramp holds with any seed's. This file proves it for many seeds by running the whole
 * matrix of `tokens.test.ts` (`forEachContrastPair`) with the seed's ramp in place of the
 * `--wave-brand-N` declarations of the `:root` constants, in light and dark. High contrast takes
 * no brand (R9): its tokens resolve the same with any ramp.
 */
import { createBrandTokens, type BrandTokens } from '../../lib/brand';
import {
  BRAND_SEEDS,
  BRAND_STOPS,
  CONTRAST_PAIRS,
  TEXT_MATRIX,
  brandMarker,
  brandPairs,
  forEachContrastPair,
  merge,
  relativeLuminance,
  resolveToken,
  resolved,
  rootConstants,
  themeDecls,
  type BrandSide,
  type Decls,
} from './tokensHarness';

/** The `:root` constants with the ramp of `tokens` in place of the `--wave-brand-N` values. */
function constantsWith(tokens: BrandTokens): Decls {
  const ramp = Object.entries(tokens).map(([key, hex]): [string, string] => [
    `--wave-brand-${key.slice('brand'.length)}`,
    hex,
  ]);
  return merge(rootConstants(), new Map(ramp));
}

/** Every pair of the matrix of `theme` under `constants` that is below its threshold. */
function failures(theme: 'light' | 'dark', constants: Decls): string[] {
  const below: string[] = [];
  forEachContrastPair(theme, [constants], ({ fg, bg, threshold, fgValue, bgValue, ratio }) => {
    if (ratio < threshold) {
      below.push(`${fg} ${fgValue} on ${bg} ${bgValue}: ${ratio.toFixed(3)}:1 < ${threshold}:1`);
    }
  });
  return below;
}

describe('forEachContrastPair', () => {
  it('walks every threshold pair and every text token on each of its surfaces', () => {
    const walked: string[] = [];
    forEachContrastPair('light', [rootConstants()], ({ fg, bg, threshold }) => {
      walked.push(`${fg} ${bg} ${threshold}`);
    });
    expect(walked).toEqual([
      ...CONTRAST_PAIRS.map((pair) => pair.join(' ')),
      ...TEXT_MATRIX.flatMap(({ fg, surfaces }) => surfaces.map((bg) => `${fg} ${bg} 4.5`)),
    ]);
  });

  it.each(['light', 'dark', 'high-contrast'] as const)(
    'resolves %s with the :root constants to the values of the token tests',
    (theme) => {
      const differing: string[] = [];
      forEachContrastPair(theme, [rootConstants()], ({ fg, bg, fgValue, bgValue }) => {
        if (fgValue !== resolved(theme, fg)) differing.push(fg);
        if (bgValue !== resolved(theme, bg)) differing.push(bg);
      });
      expect(differing).toEqual([]);
    },
  );

  it.each(['light', 'dark'] as const)('passes the default ramp in %s', (theme) => {
    expect(failures(theme, rootConstants())).toEqual([]);
  });
});

describe('createBrandTokens: generated ramps pass the whole contrast matrix (R7)', () => {
  const cases = BRAND_SEEDS.flatMap((seed) =>
    (['light', 'dark'] as const).map((theme) => ({ seed, theme })),
  );

  it.each(cases)('$seed in $theme', ({ seed, theme }) => {
    expect(failures(theme, constantsWith(createBrandTokens(seed)))).toEqual([]);
  });

  it.each(BRAND_SEEDS)('%s reaches the brand tokens of light and dark', (seed) => {
    const tokens = createBrandTokens(seed);
    const constants = constantsWith(tokens);
    const value = (theme: 'light' | 'dark', token: string) =>
      resolveToken(`--wave-${token}`, [themeDecls(theme), constants]);
    expect(value('light', 'primary')).toBe(tokens.brand80);
    expect(value('light', 'selected')).toBe(tokens.brand160);
    expect(value('dark', 'primary')).toBe(tokens.brand110);
    expect(value('dark', 'ring')).toBe(tokens.brand100);
  });

  it.each(BRAND_SEEDS)('%s leaves every high-contrast token unchanged (R9)', (seed) => {
    const constants = constantsWith(createBrandTokens(seed));
    const group = themeDecls('high-contrast');
    const changed = [...group.keys()].filter(
      (name) =>
        resolveToken(name, [group, constants]) !== resolveToken(name, [group, rootConstants()]),
    );
    expect(changed).toEqual([]);
  });
});

describe('createBrandTokens: the brand pairs of the matrix hold for a sweep of seeds', () => {
  /** HSV colours around the wheel at three saturations and three values, as hex. */
  function wheelSeeds(): string[] {
    const seeds: string[] = [];
    for (let hue = 0; hue < 360; hue += 5) {
      for (const saturation of [1, 0.6, 0.3]) {
        for (const value of [1, 0.6, 0.3]) {
          const channel = (offset: number) => {
            const k = (offset + hue / 60) % 6;
            return Math.round(255 * value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))));
          };
          seeds.push(
            `#${[5, 3, 1].map((offset) => channel(offset).toString(16).padStart(2, '0')).join('')}`,
          );
        }
      }
    }
    return seeds;
  }

  /** Pseudo-random seeds from a fixed linear congruential sequence, so every run checks the same. */
  function randomSeeds(count: number): string[] {
    let state = 20261029;
    const next = () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return Math.floor((state / 2147483648) * 256);
    };
    return Array.from(
      { length: count },
      () =>
        `#${[next(), next(), next()].map((value) => value.toString(16).padStart(2, '0')).join('')}`,
    );
  }

  it('finds the brand pairs through marker colours that no token resolves to', () => {
    const markerValues = new Set(BRAND_STOPS.map(brandMarker));
    for (const theme of ['light', 'dark'] as const) {
      forEachContrastPair(theme, [rootConstants()], ({ fgValue, bgValue }) => {
        expect(markerValues.has(fgValue) || markerValues.has(bgValue)).toBe(false);
      });
    }
    const names = brandPairs().map(({ theme, name }) => `${theme} ${name}`);
    expect(names).toContain('light primary on subtle-selected');
    expect(names).toContain('light selected-pressed on selected-hover');
    expect(names).toContain('dark primary-foreground on primary');
    expect(names).toContain('dark selected-foreground on selected-hover');
  });

  it('holds for a sweep of hues, saturations and values and for pseudo-random seeds', () => {
    const pairs = brandPairs();
    const failing = [...wheelSeeds(), ...randomSeeds(1000)].flatMap((seed) => {
      const tokens = createBrandTokens(seed);
      const luminance = (side: BrandSide) =>
        'stop' in side
          ? relativeLuminance(tokens[`brand${side.stop}` as keyof BrandTokens])
          : side.luminance;
      return pairs.flatMap(({ theme, name, fg, bg, threshold }) => {
        const [light, dark] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
        const ratio = (light + 0.05) / (dark + 0.05);
        return ratio < threshold ? [`${seed} ${theme} ${name}: ${ratio.toFixed(4)}:1`] : [];
      });
    });
    expect(failing).toEqual([]);
  });
});
