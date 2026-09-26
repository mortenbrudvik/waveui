/**
 * Conversions between HSV colors and hex strings (spec P3-05, D18). Server-safe: no React and no
 * DOM, so the helpers run in a Server Component and during server rendering.
 *
 * Public: `hsvToHex` and `hexToHsv`, exported from the package entry. The other exports are
 * internal helpers of the color components (not exported from the package).
 */
import type { HsvColor } from './types';

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** @internal The channels of a hex color as bytes (0–255). */
export interface HexBytes {
  r: number;
  g: number;
  b: number;
  /** The alpha byte; 255 when the input has no alpha digits. */
  alpha: number;
  /** Whether the input has alpha digits (`#rgba`, `#rrggbbaa`). */
  hasAlpha: boolean;
}

/**
 * @internal Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (surrounding whitespace ignored, any
 * case), else `null`. The one hex grammar of the library: `colorUtils.parseHexColor` reads it too.
 */
export function parseHexBytes(value: string): HexBytes | null {
  const match = HEX_COLOR.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const long =
    digits.length <= 4
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  const byte = (index: number) => parseInt(long.slice(index, index + 2), 16);
  const hasAlpha = long.length === 8;
  return { r: byte(0), g: byte(2), b: byte(4), alpha: hasAlpha ? byte(6) : 255, hasAlpha };
}

/** @internal `h` wrapped into [0, 360); a hue that is not finite reads as 0. */
export function wrapHue(h: number): number {
  return Number.isFinite(h) ? ((h % 360) + 360) % 360 : 0;
}

/** @internal `value` clamped to [0, 1]; `NaN` or `undefined` reads as `fallback`. */
export function clampUnit(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

/** @internal An HSV color, normalized first, as sRGB channels from 0 to 255 (unrounded). */
export function hsvToRgb(color: HsvColor): { r: number; g: number; b: number } {
  const h = wrapHue(color.h) / 60;
  const s = clampUnit(color.s, 0);
  const v = clampUnit(color.v, 0);
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 1) rgb = [c, x, 0];
  else if (h < 2) rgb = [x, c, 0];
  else if (h < 3) rgb = [0, c, x];
  else if (h < 4) rgb = [0, x, c];
  else if (h < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
}

/** @internal sRGB channels (0–255) as a hue in degrees and saturation and brightness from 0 to 1. */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function toHexByte(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0');
}

/**
 * The hex string of an HSV color: lowercase `#rrggbb`, or `#rrggbbaa` when `a` is below 1
 * (ColorPicker's value format). The hue wraps into [0, 360); saturation, brightness and alpha are
 * clamped to [0, 1]; a channel that is not a number reads as 0 (alpha: as left out, so opaque).
 *
 * @example hsvToHex({ h: 208, s: 0.92, v: 0.74 }) // '#0f6cbd'
 */
export function hsvToHex(color: HsvColor): string {
  const { r, g, b } = hsvToRgb(color);
  const alpha = Math.round(clampUnit(color.a, 1) * 255);
  const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  return alpha === 255 ? hex : hex + toHexByte(alpha);
}

/**
 * The HSV color of a hex string: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (surrounding whitespace
 * ignored, any case). `a` is set only when the input has alpha digits. Returns `null` for anything
 * else (named colors, `rgb()`, a missing `#`). `hsvToHex(hexToHsv(x))` gives `x` back in
 * ColorPicker's normal form.
 *
 * @example hexToHsv('#ff000080') // { h: 0, s: 1, v: 1, a: 0.50196… }
 */
export function hexToHsv(hex: string): HsvColor | null {
  const bytes = parseHexBytes(hex);
  if (!bytes) return null;
  const { h, s, v } = rgbToHsv(bytes.r, bytes.g, bytes.b);
  return bytes.hasAlpha ? { h, s, v, a: bytes.alpha / 255 } : { h, s, v };
}
