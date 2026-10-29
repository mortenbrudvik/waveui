import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  BRAND_SEEDS,
  relativeLuminance,
  rootConstants,
} from '../../styles/__tests__/tokensHarness';
import {
  createBrandTokens,
  DEFAULT_BRAND_RAMP,
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
 * The stops the themes pair with lighter colours (fills under light text, text and focus rings on
 * light surfaces, the dark selection fills; 140, the light pressed selection, below the hover fill
 * at 150): rounding may only make them darker, and every other stop only lighter.
 */
const DARKER_STOPS: BrandStop[] = [10, 20, 30, 40, 50, 60, 70, 80, 140];

/** Each stop rounded to the unsafe side of the default stop's luminance. */
function unsafeRoundings(tokens: BrandTokens): string[] {
  return STOPS.flatMap((stop) => {
    const hex = tokens[`brand${stop}`];
    const target = relativeLuminance(DEFAULT_BRAND_RAMP[stop]);
    const value = relativeLuminance(hex);
    const unsafe = DARKER_STOPS.includes(stop) ? value > target : value < target;
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
  const violet: BrandRamp = {
    10: '#1a0b2e',
    20: '#26103f',
    30: '#31154f',
    40: '#3d1a60',
    50: '#4a1f72',
    60: '#572584',
    70: '#642b96',
    80: '#7232a9',
    90: '#8a4fc4',
    100: '#A06BDB',
    110: '#ab7be0',
    120: '#b68be5',
    130: '#c4a1eb',
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
