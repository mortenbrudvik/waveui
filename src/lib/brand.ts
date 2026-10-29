/**
 * Brand ramps: `createBrandTokens` builds the 16 brand tokens from a seed colour, or takes a full
 * ramp, which it checks against the pairs the themes read from it in development. Server-safe and
 * pure: no DOM and no React; its only run-time import is the development warnings. The colour
 * maths (sRGB, linear light, OKLab and OKLCH) is small and local to it.
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
 * selection fills under dark text (30, 50 and 130 are read by no theme; their side is arbitrary).
 * Three stops have pairs on both sides and take the side of the thinner one: 40 rounds darker for
 * the dark selected text on it (4.81:1) against its steps above the dark selection fills at 20 and
 * 10 (1.38 and 1.56); 150 rounds lighter for its step above 140 (1.157) against its step below
 * 160 (1.163); 140 rounds darker for that step against the light selected text at 60 on it
 * (5.23:1). So the pairs whose two stops round the same way (150 and 160, 40 and 20, 10 and 40,
 * 60 and 140) can lose up to one rounding step of contrast, and each has more margin over its
 * floor (1.15 between the states of a fill, 4.5 for text) than that. A test derives the sides
 * from the pairs of tokens.css and keeps this list equal to them.
 */
export const ROUNDS_DARKER: readonly BrandStop[] = [10, 20, 30, 40, 50, 60, 70, 80, 140];

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
 * no darker than it. So rounding never takes contrast from a stop against a colour that does not
 * round the same way (a colour of the theme, or a stop that rounds the other way); two stops that
 * round the same way lose at most one rounding step between them. A grey stays a grey.
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
// Checking a full ramp
// ---------------------------------------------------------------------------------------------

// Colours of the light and dark themes that a checked pair reads a stop against: the values of
// their tokens in tokens.css, which a test keeps equal.
const WHITE = '#ffffff';
const BLACK = '#000000';
const LIGHT_SUBTLE_SELECTED = '#ebebeb';
const LIGHT_SUCCESS = '#107c10';
const DARK_SUBTLE_SELECTED = '#383838';
const DARK_SUCCESS = '#5db55d';

/**
 * A pair the check measures: the token that reads a stop, the stop, the token it is read against,
 * that token's colour (a colour of the theme, or the stop it reads) and the least contrast the
 * pair needs (4.5 for text, 3 for a focus ring, 1.15 between the states of a fill).
 */
type BrandContrastPair = readonly [
  token: string,
  stop: BrandStop,
  against: string,
  colour: string | BrandStop,
  minimum: number,
];

/**
 * Where the light and dark themes read the ramp: every `var(--wave-brand-N)` of their groups in
 * tokens.css, as the pairs the check of a full ramp measures. Of the pairs of the contrast matrix
 * that read a stop, it keeps the one theme colour that bounds each token's stop (the closest in
 * luminance at its minimum: the darkest light surface under the light primary text, the lightest
 * dark surface under the dark primary text, the lightest text on the light selection fill, the
 * darkest text on the dark one, the on-brand text of the fill states), and every pair of two stops
 * those bounds do not already decide. Tests keep it in step with tokens.css and prove that a ramp
 * that passes these pairs passes every pair of the matrix that reads a stop. High contrast reads
 * no stop.
 */
export const BRAND_CONTRAST_PAIRS: Readonly<
  Record<'light' | 'dark', readonly BrandContrastPair[]>
> = {
  light: [
    ['primary', 80, 'subtle-selected', LIGHT_SUBTLE_SELECTED, 4.5],
    ['primary', 80, 'selected', 160, 4.5],
    ['primary-hover', 70, 'primary-foreground', WHITE, 4.5],
    ['primary-pressed', 40, 'primary-foreground', WHITE, 4.5],
    ['selected', 160, 'success', LIGHT_SUCCESS, 4.5],
    ['selected-foreground', 60, 'selected', 160, 4.5],
    ['selected-foreground', 60, 'selected-hover', 150, 4.5],
    ['selected-foreground', 60, 'selected-pressed', 140, 4.5],
    ['selected-hover', 150, 'selected', 160, 1.15],
    ['selected-pressed', 140, 'selected-hover', 150, 1.15],
    ['ring', 80, 'subtle-selected', LIGHT_SUBTLE_SELECTED, 3],
  ],
  dark: [
    ['primary', 110, 'subtle-selected', DARK_SUBTLE_SELECTED, 4.5],
    ['primary-hover', 120, 'primary-foreground', BLACK, 4.5],
    ['primary-pressed', 90, 'primary-foreground', BLACK, 4.5],
    ['selected', 20, 'success', DARK_SUCCESS, 4.5],
    ['selected-foreground', 110, 'selected', 20, 4.5],
    ['selected-foreground', 110, 'selected-hover', 40, 4.5],
    ['selected-foreground', 110, 'selected-pressed', 10, 4.5],
    ['selected-hover', 40, 'selected', 20, 1.15],
    ['selected-pressed', 10, 'selected-hover', 40, 1.15],
    ['ring', 100, 'subtle-selected', DARK_SUBTLE_SELECTED, 3],
    ['ring', 100, 'selected', 20, 3],
  ],
};

/** The WCAG relative luminance of a `#rgb` or `#rrggbb` colour; `undefined` for anything else. */
function luminanceOf(value: unknown): number | undefined {
  const rgb = parseHex(value);
  return rgb && luminance(rgb.map(toLinear) as Triple);
}

/**
 * The development check of a full ramp (R8): warns once per pair of `BRAND_CONTRAST_PAIRS` whose
 * contrast is below its minimum, naming the theme, the tokens, the stops and the ratio (rounded
 * down, so a failing ratio never reads as its minimum). Advisory: it never throws, never changes
 * the ramp, and skips a stop that is not a hex colour.
 */
export function checkBrandRamp(ramp: BrandRamp): void {
  for (const [theme, pairs] of Object.entries(BRAND_CONTRAST_PAIRS)) {
    for (const [token, stop, against, colour, minimum] of pairs) {
      const own = luminanceOf(ramp[stop]);
      const other = luminanceOf(typeof colour === 'number' ? ramp[colour] : colour);
      if (own === undefined || other === undefined) continue;
      const ratio = (Math.max(own, other) + 0.05) / (Math.min(own, other) + 0.05);
      if (ratio >= minimum) continue;
      warnOnce(
        `createBrandTokens:contrast:${theme}:${token}:${against}`,
        `createBrandTokens: in the ${theme} theme, \`${token}\` on \`${against}\` (stop ${stop} on ` +
          `${typeof colour === 'number' ? `stop ${colour}` : colour}) is ` +
          `${Math.floor(ratio * 100) / 100}:1; needs ${minimum}:1.`,
      );
    }
  }
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
  // The colours the tokens take, checked below: the ramp's, or the default's where it has none.
  const used = {} as Record<BrandStop, string>;
  const tokens = toTokens((stop) => {
    const value: unknown = ramp[stop];
    if (typeof value === 'string' && parseHex(value)) return (used[stop] = value);
    invalid.push(stop);
    return (used[stop] = DEFAULT_BRAND_RAMP[stop]);
  });
  if (invalid.length > 0) {
    const several = invalid.length > 1;
    warnOnce(
      'createBrandTokens:ramp',
      `createBrandTokens: the ramp has no #rgb or #rrggbb colour at the stop${several ? 's' : ''} ` +
        `${invalid.join(', ')}, so the default ramp's colour${several ? 's are' : ' is'} used there.`,
    );
  }
  // The mode is read here as `lib/dev` reads it, written out so a bundler replaces it: a
  // production bundle then drops the check and its table. Without a bundler and without
  // `process` (an unbundled import in a browser), the read throws and the check is skipped.
  try {
    if (process.env.NODE_ENV !== 'production') checkBrandRamp(used);
  } catch {
    // No `process`: see above.
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
 * keeps, to within 8-bit rounding, the contrast it has with the default ramp, and stays above the
 * floor the themes are held to (4.5:1 for text, 3:1 for strokes, graphics and focus rings, 1.15:1
 * between the states of a fill), whatever the seed. The cost: the seed sets hue and
 * colourfulness, not lightness, so the primary fill (stop 80) is the seed's hue at the default's
 * lightness, and a light seed gives a darker button than itself. For a brand whose exact colours
 * matter, pass a full `BrandRamp`. The default seed `#0f6cbd` gives the default ramp, and a grey
 * seed (black, white or any grey) a grey ramp.
 *
 * A full `BrandRamp` is returned as tokens with its colours unchanged; a stop that is missing or
 * not a hex colour takes the default ramp's colour, with a development warning. In development the
 * ramp is also checked against the pairs the light and dark themes read from it (the primary
 * colour as text and as a fill under its text, the hover and pressed fills, the selection fills
 * and their text, the focus ring): each pair below its minimum (4.5:1 for text, 3:1 for the focus
 * ring, 1.15:1 between the states of a fill) logs one warning naming the theme, the tokens, the
 * stops and the ratio. The check is advisory: the ramp applies as given. Any other seed returns
 * the default ramp, with a development warning.
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
