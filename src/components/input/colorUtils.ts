/**
 * Color helpers for ColorPicker, SwatchPicker and the HSV color parts: hex parsing and
 * normalisation (on the grammar of `src/lib/color.ts`), the alpha byte ↔ opacity percentage, and
 * the luminance-picked check glyph drawn on a user-supplied swatch.
 *
 * Internal (not exported from the package). Pure functions, no DOM access, so they run on the
 * server and in tests.
 */
import { clampUnit, hsvToHex, parseHexBytes, wrapHue } from '../../lib/color';
import { getArrowIntent, type Direction } from '../../lib/direction';
import type { HsvColor } from '../../lib/types';
import { getColorName } from './colorName';

/** A parsed hex color: the `#rrggbb` part (lowercase) and the alpha byte (0–255). */
export interface HexColor {
  /** `#rrggbb`, lowercase. */
  rgb: string;
  /** Alpha byte, 0 (transparent) … 255 (opaque). */
  alpha: number;
}

/** An sRGB color with 0–255 channels and a 0–1 alpha. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Colors of the selected-swatch check glyph: the glyph and the halo drawn under it. */
export interface CheckColors {
  glyph: string;
  halo: string;
}

// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const BLACK = '#000000';
// wave-allow-color: luminance-picked check glyph on a user swatch (C-TOKENS exception, input-pickers#16)
const WHITE = '#ffffff';

const HEX_INPUT = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;
const HEX_DRAFT = /^#?[0-9a-f]{0,8}$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHexByte(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, '0');
}

/**
 * Parses a hex color (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, case-insensitive, surrounding
 * whitespace ignored). Returns `null` for anything else (named colors, `rgb()`, a missing `#`).
 *
 * @example parseHexColor('#0F6CBD80') // { rgb: '#0f6cbd', alpha: 128 }
 */
export function parseHexColor(value: string): HexColor | null {
  const bytes = parseHexBytes(value);
  return bytes
    ? {
        rgb: `#${toHexByte(bytes.r)}${toHexByte(bytes.g)}${toHexByte(bytes.b)}`,
        alpha: bytes.alpha,
      }
    : null;
}

/**
 * Parses text typed into a hex field: only complete `#rrggbb` / `#rrggbbaa` values are accepted,
 * so the short forms a user passes through while typing (`#abc`) are never committed.
 */
export function parseHexInput(text: string): HexColor | null {
  return HEX_INPUT.test(text.trim()) ? parseHexColor(text) : null;
}

/**
 * Whether typed text can still become a hex color by typing more characters (an optional `#`
 * followed by at most 8 hex digits; surrounding whitespace ignored, like the parsers). `false`
 * means the text is invalid whatever follows.
 */
export function isHexDraft(text: string): boolean {
  return HEX_DRAFT.test(text.trim());
}

/**
 * Formats `#rrggbb` plus an alpha byte: `#rrggbb` when opaque (`alpha` 255, the default),
 * `#rrggbbaa` otherwise. The alpha byte is rounded and clamped to 0–255.
 */
export function formatHexColor(rgb: string, alpha = 255): string {
  const byte = Math.round(clamp(alpha, 0, 255));
  return byte === 255 ? rgb : rgb + toHexByte(byte);
}

/**
 * A hex color in the one form ColorPicker reports: `#rrggbb` in lower case, or `#rrggbbaa` when
 * the alpha byte is not 255 (short forms expanded, surrounding whitespace dropped). Returns `null`
 * for anything {@link parseHexColor} rejects.
 *
 * @example normalizeHexColor('#ABC') // '#aabbcc'
 * @example normalizeHexColor('#0f6cbdff') // '#0f6cbd'
 */
export function normalizeHexColor(value: string): string | null {
  const parsed = parseHexColor(value);
  return parsed ? formatHexColor(parsed.rgb, parsed.alpha) : null;
}

/** Alpha byte (0–255) → whole opacity percentage (0–100). */
export function alphaToOpacity(alpha: number): number {
  return Math.round((clamp(alpha, 0, 255) / 255) * 100);
}

/** Opacity percentage (0–100) → alpha byte (0–255). Inverse of {@link alphaToOpacity}. */
export function opacityToAlpha(opacity: number): number {
  return Math.round((clamp(opacity, 0, 100) / 100) * 255);
}

function parseChannel(token: string): number | null {
  const percent = token.endsWith('%');
  const n = Number(percent ? token.slice(0, -1) : token);
  if (!Number.isFinite(n)) return null;
  return clamp(percent ? (n / 100) * 255 : n, 0, 255);
}

function parseAlpha(token: string | undefined): number | null {
  if (token === undefined) return 1;
  const percent = token.endsWith('%');
  const n = Number(percent ? token.slice(0, -1) : token);
  if (!Number.isFinite(n)) return null;
  return clamp(percent ? n / 100 : n, 0, 1);
}

const RGB_FUNCTION = /^rgba?\(\s*([^)]*)\)$/i;

/**
 * Parses the CSS colors that can be resolved without a browser: hex colors and `rgb()`/`rgba()`
 * (comma or space syntax, numbers or percentages, optional alpha). Returns `null` for named
 * colors, other color spaces and variables.
 */
export function parseCssColor(value: string): RgbaColor | null {
  const text = value.trim();
  const hex = parseHexColor(text);
  if (hex) {
    const n = parseInt(hex.rgb.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: hex.alpha / 255 };
  }
  const match = RGB_FUNCTION.exec(text);
  if (!match) return null;
  const [channelsPart, alphaPart]: Array<string | undefined> = match[1].split('/');
  const tokens = (channelsPart ?? '')
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let alphaToken: string | undefined = alphaPart?.trim();
  if (alphaToken === undefined && tokens.length === 4) alphaToken = tokens.pop();
  if (tokens.length !== 3) return null;
  const [r, g, b] = tokens.map(parseChannel);
  const a = parseAlpha(alphaToken);
  if (r === null || g === null || b === null || a === null) return null;
  return { r, g, b, a };
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG 2.x relative luminance (0 = black … 1 = white) of a color {@link parseCssColor} understands,
 * or `null`. Alpha is ignored (the swatch is treated as opaque).
 */
export function getRelativeLuminance(color: string): number | null {
  const parsed = parseCssColor(color);
  if (!parsed) return null;
  return 0.2126 * linearize(parsed.r) + 0.7152 * linearize(parsed.g) + 0.0722 * linearize(parsed.b);
}

/**
 * Colors of the check glyph drawn on a selected swatch (`input-pickers#16`): black or white,
 * whichever has the higher WCAG contrast ratio against the swatch color, with the other one as a
 * halo under it so the glyph stays visible on any color. Colors that cannot be parsed without a
 * browser (named colors, `hsl()`, variables) get a black glyph with a white halo.
 *
 * This is the one runtime-computed exception to the token rule (C-TOKENS): the glyph sits on a
 * consumer-supplied color, not on a theme surface.
 */
export function getCheckColors(color: string): CheckColors {
  const luminance = getRelativeLuminance(color);
  if (luminance === null) return { glyph: BLACK, halo: WHITE };
  const onBlack = (luminance + 0.05) / 0.05;
  const onWhite = 1.05 / (luminance + 0.05);
  return onBlack >= onWhite ? { glyph: BLACK, halo: WHITE } : { glyph: WHITE, halo: BLACK };
}

// ---------------------------------------------------------------------------------------------
// The HSV color parts: ColorArea, ColorSlider and AlphaSlider (spec P3-05)
// ---------------------------------------------------------------------------------------------

/** The channels of an HSV color that a part edits or names in a value text. */
export type ColorChannel = 'hue' | 'saturation' | 'value' | 'alpha';

/** Which way a rail runs: left to right (mirrored in right-to-left layouts), or bottom to top. */
export type RailOrientation = 'horizontal' | 'vertical';

/** The modifier keys of a key press. */
export interface KeyModifiers {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * A hue as a part shows it: 0–360 kept as given (360 is the end of a hue rail), any other finite
 * hue wrapped into [0, 360), and a hue that is not finite as 0.
 */
export function displayHue(h: number): number {
  return Number.isFinite(h) && h >= 0 && h <= 360 ? h : wrapHue(h);
}

/**
 * A color as a part shows it: the hue for display, saturation and brightness clamped to [0, 1]
 * (not a number: 0) and alpha clamped to [0, 1] (left out or not a number: 1).
 */
export function displayColor(color: HsvColor): Required<HsvColor> {
  return {
    h: displayHue(color.h),
    s: clampUnit(color.s, 0),
    v: clampUnit(color.v, 0),
    a: clampUnit(color.a, 1),
  };
}

/** A 0–1 channel as the whole percentage the range inputs and value texts use. */
export function toPercent(value: number): number {
  return Math.round(value * 100);
}

/** A 0–1 position as a CSS percentage with at most two decimals, for an inline custom property. */
export function toPosition(value: number): string {
  return `${Math.round(value * 10000) / 100}%`;
}

/** Whether two colors have the same channels (a missing alpha equals 1). */
export function sameColor(a: HsvColor, b: HsvColor): boolean {
  return a.h === b.h && a.s === b.s && a.v === b.v && (a.a ?? 1) === (b.a ?? 1);
}

/**
 * The value a rail (a range from 0 to `max`) moves to for a key press, or `null` for a key it
 * leaves alone: ArrowUp and ArrowDown by 1; ArrowRight and ArrowLeft by 1 toward the reading
 * direction's end and start (so mirrored in right-to-left layouts); Shift with an arrow, Page Up
 * and Page Down by 10; Home and End to 0 and `max`. A key with Alt, Ctrl or Meta belongs to the
 * browser. The result is clamped to the range.
 */
export function railKeyTarget(
  key: string,
  modifiers: KeyModifiers,
  dir: Direction,
  current: number,
  max: number,
): number | null {
  if (modifiers.altKey || modifiers.ctrlKey || modifiers.metaKey) return null;
  const step = modifiers.shiftKey ? 10 : 1;
  let next: number;
  switch (key) {
    case 'ArrowUp':
      next = current + step;
      break;
    case 'ArrowDown':
      next = current - step;
      break;
    case 'ArrowRight':
    case 'ArrowLeft':
      next =
        current +
        (getArrowIntent(key, { orientation: 'horizontal', dir }) === 'next' ? step : -step);
      break;
    case 'PageUp':
      next = current + 10;
      break;
    case 'PageDown':
      next = current - 10;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = max;
      break;
    default:
      return null;
  }
  return Math.min(max, Math.max(0, next));
}

const toward = (orientation: RailOrientation) =>
  orientation === 'vertical' ? 'to top' : 'to right';

/** The field of a ColorArea at hue `h`: white to the pure hue left to right, black toward the bottom. */
export function colorAreaGradient(h: number): string {
  const hue = hsvToHex({ h, s: 1, v: 1 });
  // wave-allow-color: the saturation and brightness field of the user's color (runtime gradient)
  return `linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, ${hue})`;
}

// wave-allow-color: the hue spectrum of a hue rail (runtime gradient data, not a theme color)
const HUE_SPECTRUM = '#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000';

/**
 * The rail of a ColorSlider: the hue spectrum, gray to the full color at the color's brightness
 * (saturation), or black to the color at full brightness (brightness).
 */
export function colorSliderGradient(
  channel: 'hue' | 'saturation' | 'value',
  color: Required<HsvColor>,
  orientation: RailOrientation,
): string {
  const direction = toward(orientation);
  if (channel === 'hue') return `linear-gradient(${direction}, ${HUE_SPECTRUM})`;
  if (channel === 'saturation') {
    const gray = hsvToHex({ h: color.h, s: 0, v: color.v });
    const full = hsvToHex({ h: color.h, s: 1, v: color.v });
    return `linear-gradient(${direction}, ${gray}, ${full})`;
  }
  const bright = hsvToHex({ h: color.h, s: color.s, v: 1 });
  // wave-allow-color: the brightness rail runs from black to the color (runtime gradient)
  return `linear-gradient(${direction}, #000000, ${bright})`;
}

/** The rail of an AlphaSlider: transparent to the opaque color, or the reverse with `transparency`. */
export function alphaSliderGradient(
  color: Required<HsvColor>,
  transparency: boolean,
  orientation: RailOrientation,
): string {
  const opaque = hsvToHex({ h: color.h, s: color.s, v: color.v });
  const direction = toward(orientation);
  return transparency
    ? `linear-gradient(${direction}, ${opaque}, transparent)`
    : `linear-gradient(${direction}, transparent, ${opaque})`;
}

/**
 * The value text of one of ColorArea's inputs: its own channel first, then the other one, then
 * the color's name ("Saturation 72%, Brightness 40%, dark blue"). `colorName` replaces the namer
 * (`''` leaves the name out); `valueText` replaces the whole text.
 */
export function areaValueText(
  color: Required<HsvColor>,
  channel: 'saturation' | 'value',
  labels: {
    saturation: string;
    brightness: string;
    colorName?: (color: HsvColor) => string;
    valueText?: (color: HsvColor, channel: 'saturation' | 'value') => string;
  },
): string {
  if (labels.valueText) return labels.valueText(color, channel);
  const saturation = `${labels.saturation} ${toPercent(color.s)}%`;
  const brightness = `${labels.brightness} ${toPercent(color.v)}%`;
  const channels =
    channel === 'saturation' ? `${saturation}, ${brightness}` : `${brightness}, ${saturation}`;
  const name = (labels.colorName ?? getColorName)(color);
  return name ? `${channels}, ${name}` : channels;
}

/** The value text of a ColorSlider: "210°, blue" for hue, "72%" for saturation and brightness. */
export function sliderValueText(
  color: Required<HsvColor>,
  channel: 'hue' | 'saturation' | 'value',
  labels: {
    colorName?: (color: HsvColor) => string;
    valueText?: (color: HsvColor, channel: 'hue' | 'saturation' | 'value') => string;
  },
): string {
  if (labels.valueText) return labels.valueText(color, channel);
  if (channel !== 'hue') return `${toPercent(channel === 'saturation' ? color.s : color.v)}%`;
  const degrees = `${Math.round(color.h)}°`;
  const name = (labels.colorName ?? getColorName)(color);
  return name ? `${degrees}, ${name}` : degrees;
}

/** The value text of an AlphaSlider: the opacity ("40%"), or the transparency with `transparency`. */
export function alphaValueText(
  color: Required<HsvColor>,
  transparency: boolean,
  valueText?: (color: HsvColor, transparency: boolean) => string,
): string {
  if (valueText) return valueText(color, transparency);
  const opacity = toPercent(color.a);
  return `${transparency ? 100 - opacity : opacity}%`;
}

/**
 * The thumb of ColorArea, ColorSlider and AlphaSlider (decorative; the focused input is what
 * assistive technology reads): 24 px, filled from `--wave-color-thumb`, with a two-tone edge (a
 * `background` border inside a `foreground` ring) that shows on any color. Forced colors keep the
 * fill and draw the edge in system colors. Each part adds its own focus classes, keyed on its
 * named group, and its part class.
 */
export const COLOR_THUMB_CLASSES =
  'pointer-events-none absolute size-6 rounded-full border-2 border-background bg-(--wave-color-thumb) ring-1 ring-foreground forced-colors:forced-color-adjust-none forced-colors:border-[Canvas] forced-colors:ring-[CanvasText]';

/** The root of a horizontal ColorSlider or AlphaSlider (24 px, as tall as the thumb). */
export const RAIL_ROOT_HORIZONTAL = 'h-6 w-full items-center';
/** The root of a vertical one: a size container, so the turned input can be as long as it is tall. */
export const RAIL_ROOT_VERTICAL = 'h-40 w-6 flex-col items-center [container-type:size]';
/** The drawn rail, inset by half a thumb at both ends (a horizontal one mirrors in right-to-left layouts). */
export const RAIL_TRACK_HORIZONTAL = 'mx-3 h-3 flex-1 wave-rtl:-scale-x-100';
export const RAIL_TRACK_VERTICAL = 'my-3 w-3 flex-1';
/** The rail's gradient, read from the inline `--wave-color-slider-gradient` property. */
export const RAIL_GRADIENT = 'bg-(image:--wave-color-slider-gradient)';
/**
 * The native range input of a rail: over the whole slider and invisible, with its own thumb as
 * wide as the drawn one, so a press lands on the value under the drawn thumb.
 */
export const RAIL_INPUT_CLASSES =
  'absolute m-0 cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:size-6';
export const RAIL_INPUT_HORIZONTAL = 'inset-0 size-full';
/** Turned a quarter, so its start (the minimum) is at the bottom; it carries `dir="ltr"`. */
export const RAIL_INPUT_VERTICAL =
  'start-1/2 top-1/2 h-6 w-[100cqh] -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2 -rotate-90';
/** The box the thumb moves in: the rail's length, so its center meets the native thumb's. */
export const THUMB_TRACK_HORIZONTAL = 'pointer-events-none absolute inset-x-3 inset-y-0';
export const THUMB_TRACK_VERTICAL = 'pointer-events-none absolute inset-x-0 inset-y-3';
/** The thumb's place along the rail, read from the inline `--wave-color-slider-position` property. */
export const THUMB_POSITION_HORIZONTAL =
  'start-(--wave-color-slider-position) top-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 -translate-y-1/2';
export const THUMB_POSITION_VERTICAL =
  'bottom-(--wave-color-slider-position) start-1/2 -translate-x-1/2 wave-rtl:translate-x-1/2 translate-y-1/2';
