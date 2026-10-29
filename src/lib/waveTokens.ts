/**
 * The typed token object and the chart palette. Server-safe. No component imports this module:
 * the provider converts token names with a rule, so the list of names reaches only the bundles
 * that use `waveTokens` or `chartPalette`.
 */
import { tokenVariable } from './tokens';
import type { TokenVariable, WaveTokenName } from './tokens';

/**
 * The name of every `--wave-*` variable of `tokens.css`, in camelCase, in the file's groups and
 * order. A test parses `tokens.css` and fails when a variable is missing here or a name has none.
 */
export const WAVE_TOKEN_NAMES = [
  // Theme-independent constants: font families
  'fontFamily',
  'fontFamilyMonospace',
  'fontFamilyNumeric',
  // z-index layers
  'zOverlay',
  'zToast',
  'zTooltip',
  // Motion: durations and curves (Fluent's motion tokens)
  'durationUltraFast',
  'durationFaster',
  'durationFast',
  'durationNormal',
  'durationGentle',
  'durationSlow',
  'durationSlower',
  'durationUltraSlow',
  'curveAccelerateMax',
  'curveAccelerateMid',
  'curveAccelerateMin',
  'curveDecelerateMax',
  'curveDecelerateMid',
  'curveDecelerateMin',
  'curveEasyEaseMax',
  'curveEasyEase',
  'curveLinear',
  // Brand ramp
  'brand10',
  'brand20',
  'brand30',
  'brand40',
  'brand50',
  'brand60',
  'brand70',
  'brand80',
  'brand90',
  'brand100',
  'brand110',
  'brand120',
  'brand130',
  'brand140',
  'brand150',
  'brand160',
  // Neutral grey ramp
  'grey2',
  'grey4',
  'grey6',
  'grey8',
  'grey10',
  'grey12',
  'grey14',
  'grey16',
  'grey20',
  'grey24',
  'grey26',
  'grey30',
  'grey34',
  'grey38',
  'grey40',
  'grey44',
  'grey50',
  'grey60',
  'grey68',
  'grey74',
  'grey78',
  'grey82',
  'grey86',
  'grey88',
  'grey90',
  'grey92',
  'grey94',
  'grey96',
  'grey98',
  // Every theme group (light, dark, high contrast) declares the rest. Surfaces and text
  'background',
  'foreground',
  'card',
  'secondary',
  'muted',
  'mutedForeground',
  'mutedHover',
  'mutedPressed',
  // Primary (brand)
  'primary',
  'primaryForeground',
  'primaryHover',
  'primaryPressed',
  // Destructive / error
  'destructive',
  'destructiveForeground',
  'error',
  'errorForeground',
  // Subtle (transparent) controls and selection
  'subtle',
  'subtleHover',
  'subtlePressed',
  'subtleSelected',
  'selected',
  'selectedForeground',
  'selectedHover',
  'selectedPressed',
  // Strokes
  'border',
  'stroke',
  'strokeHover',
  'strokeAccessible',
  'input',
  'inputFilledDarker',
  'inputFilledStroke',
  'ring',
  // Status
  'success',
  'successForeground',
  'successTint',
  'successTintForeground',
  'warning',
  'warningForeground',
  'warningTint',
  'warningTintForeground',
  'errorTint',
  'errorTintForeground',
  'severe',
  'severeForeground',
  'severeTint',
  'severeTintForeground',
  'info',
  'infoForeground',
  'infoTint',
  'infoTintForeground',
  // Inverted surfaces (tooltips)
  'inverted',
  'invertedForeground',
  'invertedBorder',
  // Tracks, placeholders, rating, presence, backdrop (the file declares the backdrop after the
  // palette)
  'track',
  'skeleton',
  'rating',
  'presenceAvailable',
  'presenceBusy',
  'presenceAway',
  'presenceOffline',
  'presenceOof',
  'presenceGlyph',
  'backdrop',
  // Persona palette: per hue the fill, its text, the tint, the tint's text and the border
  'paletteRed',
  'paletteRedForeground',
  'paletteRedTint',
  'paletteRedTintForeground',
  'paletteRedBorder',
  'palettePumpkin',
  'palettePumpkinForeground',
  'palettePumpkinTint',
  'palettePumpkinTintForeground',
  'palettePumpkinBorder',
  'paletteGold',
  'paletteGoldForeground',
  'paletteGoldTint',
  'paletteGoldTintForeground',
  'paletteGoldBorder',
  'paletteForest',
  'paletteForestForeground',
  'paletteForestTint',
  'paletteForestTintForeground',
  'paletteForestBorder',
  'paletteTeal',
  'paletteTealForeground',
  'paletteTealTint',
  'paletteTealTintForeground',
  'paletteTealBorder',
  'paletteBlue',
  'paletteBlueForeground',
  'paletteBlueTint',
  'paletteBlueTintForeground',
  'paletteBlueBorder',
  'paletteNavy',
  'paletteNavyForeground',
  'paletteNavyTint',
  'paletteNavyTintForeground',
  'paletteNavyBorder',
  'paletteLavender',
  'paletteLavenderForeground',
  'paletteLavenderTint',
  'paletteLavenderTintForeground',
  'paletteLavenderBorder',
  'palettePurple',
  'palettePurpleForeground',
  'palettePurpleTint',
  'palettePurpleTintForeground',
  'palettePurpleBorder',
  'paletteMagenta',
  'paletteMagentaForeground',
  'paletteMagentaTint',
  'paletteMagentaTintForeground',
  'paletteMagentaBorder',
  'paletteBrown',
  'paletteBrownForeground',
  'paletteBrownTint',
  'paletteBrownTintForeground',
  'paletteBrownBorder',
  'paletteSteel',
  'paletteSteelForeground',
  'paletteSteelTint',
  'paletteSteelTintForeground',
  'paletteSteelBorder',
  // Elevation
  'shadow2',
  'shadow4',
  'shadow8',
  'shadow16',
  'shadow28',
  'shadow64',
  // Derived (re-declared per theme so nested themes re-resolve them)
  'cardForeground',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'inputFilledLighter',
] as const;

// Object.fromEntries types its result as a record of strings; the names give it its keys.
function createWaveTokens() {
  return Object.freeze(
    Object.fromEntries(WAVE_TOKEN_NAMES.map((name) => [name, `var(${tokenVariable(name)})`])),
  ) as typeof waveTokens;
}

/**
 * Every design token as the CSS value that reads it: `waveTokens.primary` is
 * `'var(--wave-primary)'`, typed as that literal. Use it where a style is written in JavaScript
 * (an inline style, a CSS-in-JS rule, the colours of an SVG chart), so the value follows the theme
 * and the provider's token overrides. The counterpart of Fluent's `tokens` object
 * (`tokens.colorBrandBackground`), with Wave's names: the CSS variable in camelCase without its
 * `--wave-` prefix. A canvas library cannot read a CSS variable: resolve the value with
 * `getComputedStyle` on an element inside the provider, and again when the theme changes.
 * Frozen and server-safe; no component imports it.
 *
 * @example
 * <span style={{ color: waveTokens.primary, boxShadow: waveTokens.shadow8 }} />
 */
export const waveTokens: { readonly [K in WaveTokenName]: `var(${TokenVariable<K>})` } =
  /* @__PURE__ */ createWaveTokens();

/**
 * The 12 palette fills as token names, in the order a categorical chart gives them to its series:
 * neighbouring series stay apart, and the first six are the most distinct. Read each colour
 * through `waveTokens` (`waveTokens[chartPalette[index]]`), so the series follow the theme. A
 * chart with more than six series, or one shown in high contrast (where every palette fill is
 * white), needs a second encoding: a pattern, a marker shape or a direct label. Frozen and
 * server-safe.
 *
 * @example
 * const color = waveTokens[chartPalette[index % chartPalette.length]];
 */
export const chartPalette: readonly WaveTokenName[] = /* @__PURE__ */ Object.freeze([
  'paletteBlue',
  'palettePumpkin',
  'paletteForest',
  'paletteMagenta',
  'paletteGold',
  'palettePurple',
  'paletteTeal',
  'paletteRed',
  'paletteSteel',
  'paletteBrown',
  'paletteLavender',
  'paletteNavy',
]);
