/**
 * Color helpers for ColorPicker and SwatchPicker: hex parsing/normalisation, the alpha byte ↔
 * opacity percentage, and the luminance-picked check glyph drawn on a user-supplied swatch.
 *
 * Internal (not exported from the package). Pure functions, no DOM access, so they run on the
 * server and in tests.
 */

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

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
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

function fromDigits(digits: string): HexColor {
  const long =
    digits.length <= 4
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  const lower = long.toLowerCase();
  return {
    rgb: `#${lower.slice(0, 6)}`,
    alpha: lower.length === 8 ? parseInt(lower.slice(6, 8), 16) : 255,
  };
}

/**
 * Parses a hex color (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`, case-insensitive, surrounding
 * whitespace ignored). Returns `null` for anything else (named colors, `rgb()`, a missing `#`).
 *
 * @example parseHexColor('#0F6CBD80') // { rgb: '#0f6cbd', alpha: 128 }
 */
export function parseHexColor(value: string): HexColor | null {
  const match = HEX_COLOR.exec(value.trim());
  return match ? fromDigits(match[1]) : null;
}

/**
 * Parses text typed into a hex field: only complete `#rrggbb` / `#rrggbbaa` values are accepted,
 * so the short forms a user passes through while typing (`#abc`) are never committed.
 */
export function parseHexInput(text: string): HexColor | null {
  const match = HEX_INPUT.exec(text.trim());
  return match ? fromDigits(match[1]) : null;
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
