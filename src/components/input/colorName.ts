/**
 * The built-in English color namer of the color parts' value texts (spec P3-05, D22): "blue",
 * "dark grayish blue", "light pink", "vivid red", "black". `labels.colorName` replaces it.
 * Internal (not exported from the package).
 */
import { clampUnit, wrapHue } from '../../lib/color';
import type { HsvColor } from '../../lib/types';

/** Hue families by the degree they end before (red also covers 345 and above). */
const HUE_FAMILIES: ReadonlyArray<readonly [endsBefore: number, family: string]> = [
  [15, 'red'],
  [45, 'orange'],
  [70, 'yellow'],
  [165, 'green'],
  [195, 'cyan'],
  [255, 'blue'],
  [290, 'purple'],
  [320, 'magenta'],
  [345, 'pink'],
  [360, 'red'],
];

/**
 * An English name of `color` for assistive technology: "black" below 15 % brightness; "white" or a
 * gray below 10 % saturation; otherwise a hue family, prefixed by "dark" (brightness below 50 %)
 * or "light" (brightness above 85 % with saturation below 50 %), then by "grayish" (saturation
 * below 35 %, never with "light") or "vivid" (saturation and brightness above 85 %).
 */
export function getColorName(color: HsvColor): string {
  const h = wrapHue(color.h);
  const s = clampUnit(color.s, 0);
  const v = clampUnit(color.v, 0);
  if (v < 0.15) return 'black';
  if (s < 0.1) {
    if (v > 0.93) return 'white';
    if (v < 0.4) return 'dark gray';
    if (v > 0.75) return 'light gray';
    return 'gray';
  }
  const family = HUE_FAMILIES.find(([endsBefore]) => h < endsBefore)?.[1] ?? 'red';
  const lightness = v < 0.5 ? 'dark' : v > 0.85 && s < 0.5 ? 'light' : '';
  const saturation =
    s < 0.35 && lightness !== 'light' ? 'grayish' : s > 0.85 && v > 0.85 ? 'vivid' : '';
  return [lightness, saturation, family].filter(Boolean).join(' ');
}
