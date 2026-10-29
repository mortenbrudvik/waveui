/**
 * Brand ramps: `createBrandTokens` builds the 16 brand tokens from a seed colour, or takes a full
 * ramp. Server-safe and pure: no DOM and no React; its only run-time import is the development
 * warnings. The colour maths (sRGB, linear light, OKLab and OKLCH) is small and local to it.
 */
import { warnOnce } from './dev';

/**
 * A stop of the brand ramp, from 10 (the darkest) to 160 (the lightest) in steps of 10: the stops
 * of Fluent's `BrandVariants` and of the `--wave-brand-N` tokens.
 */
export type BrandStop =
  10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 110 | 120 | 130 | 140 | 150 | 160;

/**
 * A full brand ramp: a hex colour (`#rgb` or `#rrggbb`) for each of the 16 stops, darkest first.
 * The shape of Fluent's `BrandVariants`, which `createLightTheme(brand)` and
 * `createDarkTheme(brand)` take. The themes read the light primary from stop 80 (hover 70, pressed
 * 40, focus ring 80), the light selection from stops 160, 150 and 140 with its text at 60, the
 * dark primary from stop 110 (hover 120, pressed 90, focus ring 100) and the dark selection from
 * stops 20, 40 and 10 with its text at 110. A ramp whose stops have the luminance of the default
 * ramp's keeps the contrast of the light and dark themes; the high-contrast theme reads no stop.
 */
export type BrandRamp = Readonly<Record<BrandStop, string>>;

/**
 * The 16 brand tokens, `brand10` to `brand160`: the overrides of `--wave-brand-10` to
 * `--wave-brand-160`, in the shape `WaveProvider tokens` and `getTokenStyle` take. Where Fluent's
 * `createLightTheme(brand)` builds a whole theme from a `BrandVariants` ramp, Wave applies the
 * ramp as these tokens over its named themes; the high-contrast theme reads none of them.
 */
export type BrandTokens = { [K in `brand${BrandStop}`]: string };

const BRAND_STOPS: readonly BrandStop[] = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
];

/** The index of stop 80 in `BRAND_STOPS`: the stop a seed's chroma and hue describe. */
const SEED_INDEX = 7;

/**
 * The default brand ramp: the fallbacks of the `--wave-brand-N` declarations of `tokens.css`
 * (Fluent's brand ramp), which a test keeps equal.
 */
export const DEFAULT_BRAND_RAMP: BrandRamp = /* @__PURE__ */ Object.freeze({
  10: '#061724',
  20: '#082338',
  30: '#0a2e4a',
  40: '#0c3b5e',
  50: '#0e4775',
  60: '#0f548c',
  70: '#115ea3',
  80: '#0f6cbd',
  90: '#2886de',
  100: '#479ef5',
  110: '#62abf5',
  120: '#77b7f7',
  130: '#96c6fa',
  140: '#b4d6fa',
  150: '#cfe4fa',
  160: '#ebf3fc',
});

/** Under this OKLCH chroma a seed has no visible hue, and its ramp is grey. */
const GREY_CHROMA = 0.005;

/**
 * The stops a generated ramp rounds darker, because the themes pair them with lighter colours:
 * 10 to 80 are fills under light text, text and focus rings on light surfaces, and the dark
 * theme's selection fills under light text; 140, the light theme's pressed selection fill, must
 * stay a visible step below the hover fill at 150. The other stops round lighter: the dark
 * theme's fills under dark text, its text and focus ring on dark surfaces, and the light theme's
 * selection fills under dark text.
 */
const ROUNDS_DARKER: readonly BrandStop[] = [10, 20, 30, 40, 50, 60, 70, 80, 140];

// ---------------------------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------------------------

type Triple = [number, number, number];

/** `#rgb` or `#rrggbb` (any case) as 8-bit channels; `undefined` for anything else. */
function parseHex(value: unknown): Triple | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!match) return undefined;
  const digits = match[1].length === 3 ? match[1].replace(/./g, '$&$&') : match[1];
  return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16)) as Triple;
}

/** An 8-bit sRGB channel in linear light (0 to 1). */
function toLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** A linear channel as an unrounded 8-bit sRGB value. */
function toEncoded(linear: number): number {
  const value = Math.min(1, Math.max(0, linear));
  return 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
}

/** The WCAG relative luminance of a linear colour. */
function luminance([r, g, b]: Triple): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A linear sRGB colour in OKLab (lightness, a, b). */
function toOklab([r, g, b]: Triple): Triple {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** An OKLCH colour (hue in radians) in linear sRGB, which may lie outside the gamut. */
function fromOklch(lightness: number, chroma: number, hue: number): Triple {
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** A linear sRGB colour as OKLCH chroma and hue (radians). */
function chromaAndHue(rgb: Triple): [chroma: number, hue: number] {
  const [, a, b] = toOklab(rgb);
  return [Math.hypot(a, b), Math.atan2(b, a)];
}

function inGamut(rgb: Triple): boolean {
  return rgb.every((channel) => channel >= -1e-9 && channel <= 1 + 1e-9);
}

/** `chroma` at this lightness and hue, reduced by bisection until the colour fits sRGB. */
function fitChroma(lightness: number, chroma: number, hue: number): number {
  if (inGamut(fromOklch(lightness, chroma, hue))) return chroma;
  let low = 0;
  let high = chroma;
  for (let step = 0; step < 32; step++) {
    const middle = (low + high) / 2;
    if (inGamut(fromOklch(lightness, middle, hue))) low = middle;
    else high = middle;
  }
  return low;
}

/** The colour of this hue and (at most) this chroma whose luminance is `target`, by bisection. */
function colourAtLuminance(target: number, chroma: number, hue: number): Triple {
  const colourAt = (lightness: number): Triple =>
    fromOklch(lightness, fitChroma(lightness, chroma, hue), hue).map((channel) =>
      Math.min(1, Math.max(0, channel)),
    ) as Triple;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2;
    if (luminance(colourAt(middle)) < target) low = middle;
    else high = middle;
  }
  return colourAt((low + high) / 2);
}

/**
 * A linear colour as `#rrggbb`, rounded on the safe side: of the 8-bit colours at most one step
 * from it on each channel, the one nearest `target` in luminance that is no lighter (`darker`) or
 * no darker than it. So rounding never takes contrast from a stop against the colours the themes
 * pair it with; a grey stays a grey.
 */
function toHex(rgb: Triple, target: number, grey: boolean, darker: boolean): string {
  const rounded = rgb.map((channel) => Math.round(toEncoded(channel)));
  const offsets = [0, -1, 1];
  let best = rounded;
  let bestRank = Infinity;
  for (const red of offsets) {
    for (const green of grey ? [red] : offsets) {
      for (const blue of grey ? [red] : offsets) {
        const candidate = rounded.map((channel, index) =>
          Math.min(255, Math.max(0, channel + [red, green, blue][index])),
        );
        const value = luminance(candidate.map(toLinear) as Triple);
        // A colour past the target on the unsafe side ranks after every other (one step below
        // the rounded colour is always on the dark side, one above on the light side).
        const rank =
          Math.abs(value - target) + ((darker ? value > target : value < target) ? 1 : 0);
        if (rank < bestRank) {
          best = candidate;
          bestRank = rank;
        }
      }
    }
  }
  return `#${best.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------------------------
// Ramps
// ---------------------------------------------------------------------------------------------

/**
 * The shape of the default ramp, per stop: its luminance, its chroma as a share of stop 80's, and
 * its hue's offset from stop 80's (radians). Computed on first use.
 */
let defaultShape: { luminance: number[]; chroma: number[]; hue: number[] } | undefined;

function getDefaultShape(): NonNullable<typeof defaultShape> {
  if (defaultShape) return defaultShape;
  const colours = BRAND_STOPS.map(
    (stop) => (parseHex(DEFAULT_BRAND_RAMP[stop]) as Triple).map(toLinear) as Triple,
  );
  const [seedChroma, seedHue] = chromaAndHue(colours[SEED_INDEX]);
  defaultShape = { luminance: [], chroma: [], hue: [] };
  for (const colour of colours) {
    const [chroma, hue] = chromaAndHue(colour);
    defaultShape.luminance.push(luminance(colour));
    defaultShape.chroma.push(chroma / seedChroma);
    defaultShape.hue.push(hue - seedHue);
  }
  return defaultShape;
}

function toTokens(colourOf: (stop: BrandStop, index: number) => string): BrandTokens {
  const tokens: Partial<BrandTokens> = {};
  BRAND_STOPS.forEach((stop, index) => {
    tokens[`brand${stop}`] = colourOf(stop, index);
  });
  return tokens as BrandTokens;
}

function rampFromSeed([red, green, blue]: Triple): BrandTokens {
  const [chroma, hue] = chromaAndHue([toLinear(red), toLinear(green), toLinear(blue)]);
  const shape = getDefaultShape();
  const grey = chroma < GREY_CHROMA;
  return toTokens((stop, index) => {
    const target = shape.luminance[index];
    const colour: Triple = grey
      ? [target, target, target]
      : colourAtLuminance(target, chroma * shape.chroma[index], hue + shape.hue[index]);
    return toHex(colour, target, grey, ROUNDS_DARKER.includes(stop));
  });
}

function rampFromStops(ramp: BrandRamp): BrandTokens {
  const invalid: BrandStop[] = [];
  const tokens = toTokens((stop) => {
    const value: unknown = ramp[stop];
    if (typeof value === 'string' && parseHex(value)) return value;
    invalid.push(stop);
    return DEFAULT_BRAND_RAMP[stop];
  });
  if (invalid.length > 0) {
    const several = invalid.length > 1;
    warnOnce(
      'createBrandTokens:ramp',
      `createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stop${several ? 's' : ''} ` +
        `${invalid.join(', ')}, so the default ramp's colour${several ? 's are' : ' is'} used there.`,
    );
  }
  return tokens;
}

/**
 * The brand tokens of a brand colour or of a full ramp, to pass as `WaveProvider tokens` (alone or
 * spread with other overrides) or to `getTokenStyle`. Wave's counterpart of Fluent's
 * `createLightTheme(brand)` and `createDarkTheme(brand)`, which take a full `BrandVariants` ramp;
 * Wave also builds the ramp from one colour. The high-contrast theme ignores the brand: its colours
 * are fixed.
 *
 * From a seed (`#rgb` or `#rrggbb`, any case, with the `#`), each stop keeps the **luminance of the
 * default ramp's stop** and takes its hue and colourfulness from the seed: the seed's OKLCH chroma
 * and hue, shaped per stop like the default ramp (less colourful toward both ends, the hue
 * drifting a few degrees as the default's does), reduced where the colour would leave sRGB, and
 * rounded to a neighbouring 8-bit colour on the side that keeps its contrast. Contrast depends
 * only on luminance, so every text, fill, stroke and focus-ring pair of the light and dark themes
 * keeps the contrast it has with the default ramp, whatever the seed. The cost: the seed sets hue
 * and colourfulness, not lightness, so the primary fill (stop 80) is the seed's hue at the
 * default's lightness, and a light seed gives a darker button than itself. For a brand whose exact
 * colours matter, pass a full `BrandRamp`. The default seed `#0f6cbd` gives the default ramp, and
 * a grey seed (black, white or any grey) a grey ramp.
 *
 * A full `BrandRamp` is returned as tokens with its colours unchanged; a stop that is missing or
 * not a hex colour takes the default ramp's colour, with a development warning. Any other seed
 * returns the default ramp, with a development warning.
 *
 * Pure and server-safe; it returns a new object on each call, so compute it once (at module scope,
 * or memoised) rather than on every render.
 *
 * @example
 * const brand = createBrandTokens('#c43e00');
 * <WaveProvider tokens={brand}>…</WaveProvider>
 *
 * @example
 * <WaveProvider tokens={{ ...createBrandTokens('#c43e00'), fontFamily: 'Inter, sans-serif' }}>
 */
export function createBrandTokens(seed: string | BrandRamp): BrandTokens {
  if (typeof seed === 'object' && seed !== null) return rampFromStops(seed);
  const rgb = parseHex(seed);
  if (rgb) return rampFromSeed(rgb);
  const shown =
    typeof seed === 'string'
      ? `"${seed}"`
      : seed === null || seed === undefined
        ? String(seed)
        : `a ${typeof seed}`;
  warnOnce(
    'createBrandTokens:seed',
    `createBrandTokens: the seed ${shown} is not a #rgb or #rrggbb colour, so the default brand ` +
      'ramp is used.',
  );
  return toTokens((stop) => DEFAULT_BRAND_RAMP[stop]);
}
