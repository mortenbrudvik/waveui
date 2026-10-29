import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  BRAND_SEEDS,
  brandPairs,
  brandSide,
  relativeLuminance,
  rootConstants,
  themeDecls,
  type BrandPair,
  type BrandSide,
} from '../../styles/__tests__/tokensHarness';
import {
  BRAND_CONTRAST_PAIRS,
  createBrandTokens,
  DEFAULT_BRAND_RAMP,
  ROUNDS_DARKER,
  type BrandRamp,
  type BrandStop,
  type BrandTokens,
} from '../brand';
import type { WaveTokenOverrides } from '../tokens';
import brandSource from '../brand.ts?raw';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const STOPS: BrandStop[] = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160];
const TOKEN_KEYS = STOPS.map((stop) => `brand${stop}` as const);

/** The default ramp as tokens: what `createBrandTokens` returns for an invalid seed. */
const DEFAULT_TOKENS = Object.fromEntries(
  STOPS.map((stop) => [`brand${stop}`, DEFAULT_BRAND_RAMP[stop]]),
) as BrandTokens;

const channels = (hex: string): number[] =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

const hexOf = (rgb: number[]): string =>
  `#${rgb.map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, '0')).join('')}`;

/**
 * The most rounding to a neighbouring 8-bit colour can move the luminance of a colour near `hex`:
 * the luminance step of one unit on every channel (the larger of the steps up and down). A stop
 * rounds on its safe side, so it can sit up to one step from the exact colour, never more.
 */
function roundingTolerance(hex: string): number {
  const rgb = channels(hex);
  const luminance = relativeLuminance(hex);
  const up = relativeLuminance(hexOf(rgb.map((value) => value + 1))) - luminance;
  const down = luminance - relativeLuminance(hexOf(rgb.map((value) => value - 1)));
  return Math.max(up, down);
}

/** Each stop whose luminance is not the default stop's within 8-bit rounding, described. */
function luminanceMisses(tokens: BrandTokens): string[] {
  return STOPS.flatMap((stop) => {
    const hex = tokens[`brand${stop}`];
    const target = relativeLuminance(DEFAULT_BRAND_RAMP[stop]);
    const error = Math.abs(relativeLuminance(hex) - target);
    return error <= roundingTolerance(hex)
      ? []
      : [`${stop}: ${hex} is off the default's luminance by ${error.toExponential(2)}`];
  });
}

/**
 * Each stop rounded to the unsafe side of the default stop's luminance: a stop of `ROUNDS_DARKER`
 * may only round darker, every other stop only lighter.
 */
function unsafeRoundings(tokens: BrandTokens): string[] {
  return STOPS.flatMap((stop) => {
    const hex = tokens[`brand${stop}`];
    const target = relativeLuminance(DEFAULT_BRAND_RAMP[stop]);
    const value = relativeLuminance(hex);
    const unsafe = ROUNDS_DARKER.includes(stop) ? value > target : value < target;
    return unsafe ? [`${stop}: ${hex} at ${value.toFixed(5)} for ${target.toFixed(5)}`] : [];
  });
}

/** Each stop that is not lighter than the one before it. */
function monotonicityBreaks(tokens: BrandTokens): string[] {
  return STOPS.slice(1).flatMap((stop, index) => {
    const previous = tokens[`brand${STOPS[index]}`];
    const hex = tokens[`brand${stop}`];
    return relativeLuminance(hex) > relativeLuminance(previous)
      ? []
      : [`${stop}: ${hex} is not lighter than ${previous}`];
  });
}

/** The colour of an HSV hue (degrees) at full saturation and value, as hex: the wheel's edge. */
function fullChromaHex(degrees: number): string {
  const channel = (offset: number) => {
    const k = (offset + degrees / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return hexOf([channel(5), channel(3), channel(1)]);
}

describe('DEFAULT_BRAND_RAMP', () => {
  it('equals the fallbacks of the --wave-brand-N declarations of tokens.css', () => {
    const constants = rootConstants();
    const fromCss = Object.fromEntries(
      STOPS.map((stop) => {
        const match = /^var\(--brand-(\d+), (#[0-9a-f]{6})\)$/.exec(
          constants.get(`--wave-brand-${stop}`) ?? '',
        );
        expect(match?.[1], `--wave-brand-${stop}`).toBe(String(stop));
        return [stop, match?.[2]];
      }),
    );
    expect(DEFAULT_BRAND_RAMP).toEqual(fromCss);
    expect(Object.keys(DEFAULT_BRAND_RAMP)).toEqual(STOPS.map(String));
  });
});

describe('createBrandTokens from a seed', () => {
  it('gives the default ramp for the default seed (each channel within 3)', () => {
    const tokens = createBrandTokens('#0f6cbd');
    const off = STOPS.flatMap((stop) => {
      const generated = channels(tokens[`brand${stop}`]);
      const expected = channels(DEFAULT_BRAND_RAMP[stop]);
      return generated.some((value, index) => Math.abs(value - expected[index]) > 3)
        ? [`${stop}: ${tokens[`brand${stop}`]} for ${DEFAULT_BRAND_RAMP[stop]}`]
        : [];
    });
    expect(off).toEqual([]);
  });

  it('gives exactly the default ramp for the default seed, since it follows its shape', () => {
    expect(createBrandTokens('#0f6cbd')).toEqual(DEFAULT_TOKENS);
  });

  it.each(BRAND_SEEDS)(
    '%s: every stop keeps the default luminance within 8-bit rounding, in order',
    (seed) => {
      const tokens = createBrandTokens(seed);
      expect(luminanceMisses(tokens)).toEqual([]);
      expect(monotonicityBreaks(tokens)).toEqual([]);
    },
  );

  it.each(BRAND_SEEDS)(
    '%s: rounds every stop on its safe side (dark stops never lighter, light never darker)',
    (seed) => {
      expect(unsafeRoundings(createBrandTokens(seed))).toEqual([]);
    },
  );

  it('keeps the default luminances, in order and on the safe side, for 36 hues at full chroma', () => {
    const misses = Array.from({ length: 36 }, (_, index) => fullChromaHex(index * 10)).flatMap(
      (seed) => {
        const tokens = createBrandTokens(seed);
        return [
          ...luminanceMisses(tokens),
          ...monotonicityBreaks(tokens),
          ...unsafeRoundings(tokens),
        ].map((miss) => `${seed} ${miss}`);
      },
    );
    expect(misses).toEqual([]);
  });

  it.each(BRAND_SEEDS)('%s: gives the 16 tokens in order as #rrggbb in lower case', (seed) => {
    const tokens = createBrandTokens(seed);
    expect(Object.keys(tokens)).toEqual(TOKEN_KEYS);
    expect(Object.values(tokens).filter((value) => !/^#[0-9a-f]{6}$/.test(value))).toEqual([]);
  });

  it.each(['#808080', '#000000', '#ffffff', '#7f7f80'])(
    'gives a grey ramp (equal channels) for the grey or near-grey seed %s',
    (seed) => {
      const tokens = createBrandTokens(seed);
      expect(Object.values(tokens).filter((hex) => new Set(channels(hex)).size !== 1)).toEqual([]);
    },
  );

  it('gives black, white and mid grey the same ramp (lightness comes from the default ramp)', () => {
    expect(createBrandTokens('#000000')).toEqual(createBrandTokens('#808080'));
    expect(createBrandTokens('#ffffff')).toEqual(createBrandTokens('#808080'));
  });

  it('takes its hue from the seed: a red seed gives a ramp with red dominant', () => {
    const tokens = createBrandTokens('#c43e00');
    const notRed = STOPS.filter((stop) => {
      const [red, green, blue] = channels(tokens[`brand${stop}`]);
      return !(red > green && red > blue);
    });
    expect(notRed).toEqual([]);
  });

  it('reads three digits and upper case like the six-digit lower-case seed', () => {
    expect(createBrandTokens('#F0F')).toEqual(createBrandTokens('#ff00ff'));
    expect(createBrandTokens('#f0f')).toEqual(createBrandTokens('#ff00ff'));
    expect(createBrandTokens('#C43E00')).toEqual(createBrandTokens('#c43e00'));
  });

  it('is deterministic and returns a new object on each call', () => {
    const first = createBrandTokens('#c43e00');
    const second = createBrandTokens('#c43e00');
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it('does not warn for a valid seed', () => {
    const warn = vi.spyOn(console, 'warn');
    for (const seed of BRAND_SEEDS) createBrandTokens(seed);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('createBrandTokens with an invalid seed', () => {
  const asSeed = (value: unknown) => value as string;

  it.each([
    ['an empty string', '', '""'],
    ['a colour name', 'red', '"red"'],
    ['two digits', '#12', '"#12"'],
    ['four digits', '#1234', '"#1234"'],
    ['eight digits', '#0f6cbdff', '"#0f6cbdff"'],
    ['digits that are not hex', '#gggggg', '"#gggggg"'],
    ['no #', '0f6cbd', '"0f6cbd"'],
    ['surrounding spaces', ' #0f6cbd ', '" #0f6cbd "'],
    ['a functional notation', 'rgb(15, 108, 189)', '"rgb(15, 108, 189)"'],
    ['a number written as a string', String(42), '"42"'],
    ['null written as a string', String(null), '"null"'],
    ['a number', asSeed(0x0f6cbd), 'a number'],
    ['null', asSeed(null), 'null'],
    ['undefined', asSeed(undefined), 'undefined'],
    ['a boolean', asSeed(true), 'a boolean'],
  ])('warns once for %s and returns the default ramp', (_label, seed, shown) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createBrandTokens(seed)).toEqual(DEFAULT_TOKENS);
    expect(createBrandTokens(seed)).toEqual(DEFAULT_TOKENS);
    expect(warn.mock.calls).toEqual([
      [
        `[WaveUI] createBrandTokens: the seed ${shown} is not a #rgb or #rrggbb colour, so the ` +
          'default brand ramp is used.',
      ],
    ]);
  });

  it('returns the default ramp without a warning in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn');
    expect(createBrandTokens('red')).toEqual(DEFAULT_TOKENS);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('createBrandTokens with a full ramp', () => {
  /** A hand-made ramp that passes the contrast check of a full ramp in light and dark. */
  const violet: BrandRamp = {
    10: '#1a0b2e',
    20: '#26103f',
    30: '#31154f',
    40: '#3d1a60',
    50: '#4a1f72',
    60: '#572584',
    70: '#642b96',
    80: '#7232a9',
    90: '#9560d4',
    100: '#A06BDB',
    110: '#bb98ee',
    120: '#c6a8f2',
    130: '#d0b4f4',
    140: '#d3b8f1',
    150: '#e2d0f6',
    160: '#f2e9fb',
  };

  it('returns its colours as tokens, unchanged and without a warning', () => {
    const warn = vi.spyOn(console, 'warn');
    const tokens = createBrandTokens(violet);
    expect(Object.keys(tokens)).toEqual(TOKEN_KEYS);
    expect(tokens).toEqual(Object.fromEntries(STOPS.map((stop) => [`brand${stop}`, violet[stop]])));
    expect(tokens.brand100).toBe('#A06BDB');
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts three-digit stops', () => {
    expect(createBrandTokens({ ...violet, 160: '#fef' }).brand160).toBe('#fef');
  });

  it('warns once for missing and invalid stops and uses the default colour there', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { 30: _missing, ...rest } = violet;
    const ramp = { ...rest, 90: 'violet', 120: 42 } as unknown as BrandRamp;
    const expected = {
      ...Object.fromEntries(STOPS.map((stop) => [`brand${stop}`, violet[stop]])),
      brand30: DEFAULT_BRAND_RAMP[30],
      brand90: DEFAULT_BRAND_RAMP[90],
      brand120: DEFAULT_BRAND_RAMP[120],
    };
    expect(createBrandTokens(ramp)).toEqual(expected);
    expect(createBrandTokens(ramp)).toEqual(expected);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stops 30, 90, ' +
          "120, so the default ramp's colours are used there.",
      ],
    ]);
  });

  it('names a single stop in the singular', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createBrandTokens({ ...violet, 80: '' }).brand80).toBe(DEFAULT_BRAND_RAMP[80]);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stop 80, so ' +
          "the default ramp's colour is used there.",
      ],
    ]);
  });

  it('returns the default ramp for an empty object, with a warning naming every stop', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createBrandTokens({} as BrandRamp)).toEqual(DEFAULT_TOKENS);
    expect(warn.mock.calls).toEqual([
      [
        `[WaveUI] createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stops ${STOPS.join(', ')}, ` +
          "so the default ramp's colours are used there.",
      ],
    ]);
  });
});

describe('createBrandTokens checks a full ramp in development (R8)', () => {
  /** The ramp of generated tokens, to pass back as a `BrandRamp`. */
  const rampOf = (tokens: BrandTokens): BrandRamp =>
    Object.fromEntries(STOPS.map((stop) => [stop, tokens[`brand${stop}`]])) as BrandRamp;

  it('passes the default ramp without a warning', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(createBrandTokens(DEFAULT_BRAND_RAMP)).toEqual(DEFAULT_TOKENS);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once for each light pair that reads stop 80 when stop 80 is light', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ramp: BrandRamp = Object.freeze({ ...DEFAULT_BRAND_RAMP, 80: '#b4d6fa' });
    const expected = { ...DEFAULT_TOKENS, brand80: '#b4d6fa' };
    expect(createBrandTokens(ramp)).toEqual(expected);
    expect(createBrandTokens(ramp)).toEqual(expected);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] createBrandTokens: in the light theme, `primary` on `subtle-selected` (stop 80 ' +
          'on #ebebeb) is 1.26:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the light theme, `primary` on `selected` (stop 80 on ' +
          'stop 160) is 1.34:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the light theme, `ring` on `subtle-selected` (stop 80 on ' +
          '#ebebeb) is 1.26:1; needs 3:1.',
      ],
    ]);
    const readingStop80 = BRAND_CONTRAST_PAIRS.light.filter(
      ([, stop, , colour]) => stop === 80 || colour === 80,
    );
    expect(warn).toHaveBeenCalledTimes(readingStop80.length);
  });

  it('warns only for dark when the ramp fails only in dark', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createBrandTokens({ ...DEFAULT_BRAND_RAMP, 110: '#2886de' });
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] createBrandTokens: in the dark theme, `primary` on `subtle-selected` (stop 110 ' +
          'on #383838) is 3.1:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the dark theme, `selected-foreground` on `selected` (stop ' +
          '110 on stop 20) is 4.24:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the dark theme, `selected-foreground` on `selected-hover` ' +
          '(stop 110 on stop 40) is 3.08:1; needs 4.5:1.',
      ],
    ]);
  });

  it('measures a missing or invalid stop at the default colour it takes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { 80: _missing, ...rest } = DEFAULT_BRAND_RAMP;
    createBrandTokens({ ...rest, 60: '#cfe4fa', 160: 'none' } as unknown as BrandRamp);
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stops 80, 160, ' +
          "so the default ramp's colours are used there.",
      ],
      [
        '[WaveUI] createBrandTokens: in the light theme, `selected-foreground` on `selected` (stop ' +
          '60 on stop 160) is 1.16:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the light theme, `selected-foreground` on ' +
          '`selected-hover` (stop 60 on stop 150) is 1:1; needs 4.5:1.',
      ],
      [
        '[WaveUI] createBrandTokens: in the light theme, `selected-foreground` on ' +
          '`selected-pressed` (stop 60 on stop 140) is 1.15:1; needs 4.5:1.',
      ],
    ]);
  });

  it('logs nothing in production and still returns the ramp unchanged', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn');
    expect(createBrandTokens({ ...DEFAULT_BRAND_RAMP, 80: '#b4d6fa' })).toEqual({
      ...DEFAULT_TOKENS,
      brand80: '#b4d6fa',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(BRAND_SEEDS)('passes the generated ramp of %s without a warning', (seed) => {
    const warn = vi.spyOn(console, 'warn');
    const tokens = createBrandTokens(seed);
    expect(createBrandTokens(rampOf(tokens))).toEqual(tokens);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the pairs the check of a full ramp measures', () => {
  const THEMES = ['light', 'dark'] as const;

  /** A side of a pair of the table: a stop, or a theme colour. */
  const tableSide = (colour: string | BrandStop): BrandSide =>
    typeof colour === 'number'
      ? { stop: colour }
      : { colour, luminance: relativeLuminance(colour) };

  const sameSide = (a: BrandSide, b: BrandSide): boolean =>
    'stop' in a ? 'stop' in b && a.stop === b.stop : !('stop' in b) && a.colour === b.colour;

  it('lists every var(--wave-brand-N) of the light and dark groups of tokens.css, and no other', () => {
    for (const theme of THEMES) {
      const read = [...themeDecls(theme)].flatMap(([name, value]) =>
        [...value.matchAll(/var\(\s*--wave-brand-(\d+)\b/g)].map(
          ([, stop]) => `${name.slice('--wave-'.length)} ${stop}`,
        ),
      );
      const listed = BRAND_CONTRAST_PAIRS[theme].flatMap(([token, stop, against, colour]) => [
        `${token} ${stop}`,
        ...(typeof colour === 'number' ? [`${against} ${colour}`] : []),
      ]);
      expect([...new Set(listed)].sort(), theme).toEqual([...new Set(read)].sort());
    }
  });

  it('reads each stop and theme colour of a pair from tokens.css (the colours stay in step)', () => {
    const wrong = THEMES.flatMap((theme) =>
      BRAND_CONTRAST_PAIRS[theme].flatMap(([token, stop, against, colour]) => {
        const misses: string[] = [];
        if (!sameSide(brandSide(theme, token), { stop })) {
          misses.push(`${theme} ${token} does not read stop ${stop}`);
        }
        if (!sameSide(brandSide(theme, against), tableSide(colour))) {
          misses.push(`${theme} ${against} is not ${colour}`);
        }
        return misses;
      }),
    );
    expect(wrong).toEqual([]);
  });

  it('names a pair of the contrast matrix in each row, at its threshold', () => {
    const pairs = brandPairs();
    const key = (a: string, b: string) => [a, b].sort().join(' and ');
    const strays = THEMES.flatMap((theme) =>
      BRAND_CONTRAST_PAIRS[theme].flatMap(([token, , against, , minimum]) =>
        pairs.some(
          (pair) =>
            pair.theme === theme &&
            pair.threshold === minimum &&
            key(pair.fgToken, pair.bgToken) === key(token, against),
        )
          ? []
          : [`${theme} ${token} on ${against} at ${minimum}`],
      ),
    );
    expect(strays).toEqual([]);
  });

  it('bounds every brand pair of the matrix: a ramp that passes the table passes them all', () => {
    // Each stop's pairs against theme colours confine its luminance to an interval; a brand pair
    // of the matrix that is not in the table must hold for every luminance those intervals allow.
    const allowed = new Map<number, Array<[number, number]>>();
    for (const theme of THEMES) {
      for (const [, stop, , colour, minimum] of BRAND_CONTRAST_PAIRS[theme]) {
        if (typeof colour === 'number') continue;
        const other = relativeLuminance(colour) + 0.05;
        const passing: Array<[number, number]> = [
          [0, other / minimum - 0.05],
          [other * minimum - 0.05, 1],
        ];
        allowed.set(
          stop,
          (allowed.get(stop) ?? [[0, 1]]).flatMap(([low, high]) =>
            passing.flatMap(([from, to]): Array<[number, number]> => {
              const [start, end] = [Math.max(low, from), Math.min(high, to)];
              return start <= end ? [[start, end]] : [];
            }),
          ),
        );
      }
    }
    const range = (side: BrandSide): [number, number] => {
      if (!('stop' in side)) return [side.luminance, side.luminance];
      const intervals = allowed.get(side.stop) ?? [[0, 1]];
      return [
        Math.min(...intervals.map(([low]) => low)),
        Math.max(...intervals.map(([, high]) => high)),
      ];
    };
    const unbounded = brandPairs().flatMap((pair) => {
      const listed = BRAND_CONTRAST_PAIRS[pair.theme].some(([, stop, , colour, minimum]) => {
        const [a, b] = [{ stop }, tableSide(colour)];
        return (
          minimum >= pair.threshold &&
          ((sameSide(a, pair.fg) && sameSide(b, pair.bg)) ||
            (sameSide(a, pair.bg) && sameSide(b, pair.fg)))
        );
      });
      if (listed) return [];
      const [fgLow, fgHigh] = range(pair.fg);
      const [bgLow, bgHigh] = range(pair.bg);
      // The least contrast the intervals allow: their closest ends, or none when they overlap.
      const least =
        fgLow > bgHigh
          ? (fgLow + 0.05) / (bgHigh + 0.05)
          : bgLow > fgHigh
            ? (bgLow + 0.05) / (fgHigh + 0.05)
            : 1;
      return least >= pair.threshold
        ? []
        : [`${pair.theme} ${pair.name}: ${least.toFixed(4)}:1 < ${pair.threshold}:1`];
    });
    expect(unbounded).toEqual([]);
  });
});

describe('the rounding sides of generated ramps agree with tokens.css', () => {
  /** The default ramp's luminance of a side of a brand pair. */
  const defaultLuminance = (side: BrandSide): number =>
    'stop' in side ? relativeLuminance(DEFAULT_BRAND_RAMP[side.stop as BrandStop]) : side.luminance;

  it('rounds each stop the themes read toward the safe side of its thinnest pair', () => {
    const thinnest = new Map<number, { margin: number; darker: boolean; pair: string }>();
    for (const pair of brandPairs()) {
      const [fg, bg] = [defaultLuminance(pair.fg), defaultLuminance(pair.bg)];
      const margin = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) / pair.threshold;
      for (const [side, own, other] of [
        [pair.fg, fg, bg],
        [pair.bg, bg, fg],
      ] as const) {
        if (!('stop' in side)) continue;
        const current = thinnest.get(side.stop);
        if (current && current.margin <= margin) continue;
        thinnest.set(side.stop, {
          margin,
          darker: own < other,
          pair: `${pair.theme} ${pair.name}`,
        });
      }
    }
    // 30, 50 and 130 are read by no theme (ROUNDS_DARKER's comment says so).
    expect(STOPS.filter((stop) => !thinnest.has(stop))).toEqual([30, 50, 130]);
    const wrong = [...thinnest].flatMap(([stop, { margin, darker, pair }]) =>
      ROUNDS_DARKER.includes(stop as BrandStop) === darker
        ? []
        : [
            `${stop} should round ${darker ? 'darker' : 'lighter'} for ${pair} (${margin.toFixed(4)})`,
          ],
    );
    expect(wrong).toEqual([]);
  });

  /** An 8-bit sRGB channel value in linear light. */
  const linear = (code: number): number => {
    const value = code / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  /**
   * The most one 8-bit step on every channel moves the luminance of a colour whose luminance is
   * `luminance`, up or down: a channel's linear value is at most the luminance over the channel's
   * weight, and the higher a channel, the larger its step.
   */
  function oneStep(luminance: number, up: boolean): number {
    return [0.2126, 0.7152, 0.0722].reduce((sum, weight) => {
      const cap = Math.min(1, luminance / weight);
      let code = 0;
      while (code < 255 && linear(code + 1) <= cap) code++;
      const high = up ? Math.min(255, code + 1) : Math.max(1, code);
      return sum + weight * (linear(high) - linear(high - 1));
    }, 0);
  }

  it('keeps each pair whose stops round toward each other above its floor by one step', () => {
    const toward: string[] = [];
    const thin = brandPairs().flatMap((pair: BrandPair) => {
      const [low, high] = [pair.fg, pair.bg].sort(
        (a, b) => defaultLuminance(a) - defaultLuminance(b),
      );
      let [lowLuminance, highLuminance] = [defaultLuminance(low), defaultLuminance(high)];
      // The darker side rounding lighter, or the lighter side rounding darker, moves toward the
      // other side by up to one step.
      const lowMoves = 'stop' in low && !ROUNDS_DARKER.includes(low.stop as BrandStop);
      const highMoves = 'stop' in high && ROUNDS_DARKER.includes(high.stop as BrandStop);
      if (!lowMoves && !highMoves) return [];
      toward.push(`${pair.theme} ${pair.name}`);
      if (lowMoves) lowLuminance += oneStep(lowLuminance, true);
      if (highMoves) highLuminance -= oneStep(highLuminance, false);
      const ratio = (highLuminance + 0.05) / (lowLuminance + 0.05);
      return ratio < pair.threshold
        ? [`${pair.theme} ${pair.name}: ${ratio.toFixed(4)}:1 < ${pair.threshold}:1`]
        : [];
    });
    expect(thin).toEqual([]);
    // The pairs ROUNDS_DARKER's comment names: a theme that starts reading a stop on its other
    // side adds one here.
    expect(toward).toEqual([
      'light selected-hover on selected',
      'light selected-foreground on selected-pressed',
      'dark selected-hover on selected',
      'dark selected-pressed on selected-hover',
    ]);
  });
});

describe('types', () => {
  it('describes the stops, the ramp and the tokens', () => {
    expectTypeOf<BrandStop>().toEqualTypeOf<
      10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160
    >();
    expectTypeOf<BrandRamp>().toEqualTypeOf<Readonly<Record<BrandStop, string>>>();
    expectTypeOf<BrandTokens>().toEqualTypeOf<{ [K in `brand${BrandStop}`]: string }>();
    expectTypeOf(createBrandTokens).toEqualTypeOf<(seed: string | BrandRamp) => BrandTokens>();
  });

  it('gives tokens that WaveProvider takes as overrides', () => {
    expectTypeOf<BrandTokens>().toExtend<WaveTokenOverrides>();
    const overrides: WaveTokenOverrides = {
      ...createBrandTokens('#c43e00'),
      fontFamily: 'Inter',
    };
    expect(overrides.brand80).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('server safety', () => {
  it('imports only the development warnings at run time, and no React or DOM', () => {
    const code = brandSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const imports = [...code.matchAll(/^[ \t]*(import|export)\b[^;]*?from\s+['"][^'"]+['"]/gm)]
      .map(([text]) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => !/^(import|export) type\b/.test(text));
    expect(imports).toEqual(["import { warnOnce } from './dev'"]);
    expect(code).not.toMatch(/\brequire\s*\(|\bimport\s*\(|['"]use client['"]/);
    expect(code).not.toMatch(/\b(react|document|window|navigator|getComputedStyle)\b/i);
  });
});
