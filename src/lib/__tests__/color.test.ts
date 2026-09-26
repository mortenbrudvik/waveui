import { describe, it, expect } from 'vitest';
import {
  clampUnit,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  parseHexBytes,
  rgbToHsv,
  wrapHue,
} from '../color';

describe('hsvToHex (D18)', () => {
  it.each([
    [{ h: 0, s: 0, v: 0 }, '#000000'],
    [{ h: 0, s: 0, v: 1 }, '#ffffff'],
    [{ h: 0, s: 1, v: 1 }, '#ff0000'],
    [{ h: 60, s: 1, v: 1 }, '#ffff00'],
    [{ h: 120, s: 1, v: 1 }, '#00ff00'],
    [{ h: 180, s: 1, v: 1 }, '#00ffff'],
    [{ h: 240, s: 1, v: 1 }, '#0000ff'],
    [{ h: 300, s: 1, v: 1 }, '#ff00ff'],
    [{ h: 0, s: 1, v: 0.5 }, '#800000'],
    [{ h: 208, s: 0.92, v: 0.74 }, '#0f6cbd'],
  ])('%o is %s', (color, hex) => {
    expect(hsvToHex(color)).toBe(hex);
  });

  it('writes the alpha byte only below full opacity', () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.5 })).toBe('#ff000080');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0 })).toBe('#ff000000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 0.999 })).toBe('#ff0000');
  });

  it('wraps the hue and clamps saturation, brightness and alpha', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 720, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: -30, s: 1, v: 1 })).toBe('#ff0080');
    expect(hsvToHex({ h: 0, s: 1.5, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: -1, v: 2 })).toBe('#ffffff');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: 1.4 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: -1 })).toBe('#ff000000');
  });

  it('reads a channel that is not a number as 0, and such an alpha as left out', () => {
    expect(hsvToHex({ h: Number.NaN, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: Number.POSITIVE_INFINITY, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToHex({ h: 0, s: Number.NaN, v: 1 })).toBe('#ffffff');
    expect(hsvToHex({ h: 0, s: 1, v: Number.NaN })).toBe('#000000');
    expect(hsvToHex({ h: 0, s: 1, v: 1, a: Number.NaN })).toBe('#ff0000');
  });
});

describe('hexToHsv (D18)', () => {
  it('reads the hue in degrees and saturation and brightness from 0 to 1, without alpha', () => {
    expect(hexToHsv('#ff0000')).toStrictEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00ff00')).toStrictEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000ff')).toStrictEqual({ h: 240, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toStrictEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#808080')).toStrictEqual({ h: 0, s: 0, v: 128 / 255 });
  });

  it('trims, ignores case and expands the short forms (as parseHexColor)', () => {
    expect(hexToHsv(' #F00 ')).toStrictEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#FF0000')).toStrictEqual({ h: 0, s: 1, v: 1 });
  });

  it('sets alpha only when the input has alpha digits', () => {
    expect(hexToHsv('#ff000080')).toStrictEqual({ h: 0, s: 1, v: 1, a: 128 / 255 });
    expect(hexToHsv('#f008')).toStrictEqual({ h: 0, s: 1, v: 1, a: 0x88 / 255 });
    expect(hexToHsv('#ff0000ff')).toStrictEqual({ h: 0, s: 1, v: 1, a: 1 });
    expect(hexToHsv('#ff0000')).not.toHaveProperty('a');
  });

  it('returns null for anything that is not a hex color', () => {
    for (const value of [
      'red',
      '',
      '#',
      '#12',
      '#12345',
      '#1234567',
      '#zzzzzz',
      '112233',
      'rgb(0,0,0)',
    ]) {
      expect(hexToHsv(value), value).toBeNull();
    }
  });

  it("round-trips every accepted hex string to ColorPicker's normal form", () => {
    for (const [input, normal] of [
      ['#ABC', '#aabbcc'],
      ['#abc8', '#aabbcc88'],
      ['#0F6CBDFF', '#0f6cbd'],
      [' #112233 ', '#112233'],
      ['#0f6cbd80', '#0f6cbd80'],
      ['#000000', '#000000'],
      ['#ffffff', '#ffffff'],
    ] as const) {
      expect(hsvToHex(hexToHsv(input)!), input).toBe(normal);
    }
  });

  it('round-trips a sweep of 8-bit colors and every alpha byte exactly', () => {
    const byte = (n: number) => n.toString(16).padStart(2, '0');
    for (let r = 0; r <= 255; r += 15) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 51) {
          const color = `#${byte(r)}${byte(g)}${byte(b)}`;
          expect(hsvToHex(hexToHsv(color)!), color).toBe(color);
        }
      }
    }
    for (let alpha = 0; alpha < 255; alpha++) {
      const color = `#0f6cbd${byte(alpha)}`;
      expect(hsvToHex(hexToHsv(color)!), color).toBe(color);
    }
  });
});

describe('internal helpers', () => {
  it('parseHexBytes reads the bytes and whether alpha digits were given', () => {
    expect(parseHexBytes('#0F6CBD80')).toEqual({
      r: 15,
      g: 108,
      b: 189,
      alpha: 128,
      hasAlpha: true,
    });
    expect(parseHexBytes('#abc')).toEqual({
      r: 0xaa,
      g: 0xbb,
      b: 0xcc,
      alpha: 255,
      hasAlpha: false,
    });
    expect(parseHexBytes('0f6cbd')).toBeNull();
  });

  it('wrapHue wraps into [0, 360) and clampUnit clamps to [0, 1]', () => {
    expect([0, 360, 361, -30, 720, Number.NaN].map((h) => wrapHue(h))).toEqual([
      0, 0, 1, 330, 0, 0,
    ]);
    expect(clampUnit(0.5, 0)).toBe(0.5);
    expect(clampUnit(1.5, 0)).toBe(1);
    expect(clampUnit(-1, 0)).toBe(0);
    expect(clampUnit(Number.POSITIVE_INFINITY, 0)).toBe(1);
    expect(clampUnit(Number.NaN, 1)).toBe(1);
    expect(clampUnit(undefined, 1)).toBe(1);
  });

  it('hsvToRgb and rgbToHsv are inverse on a primary', () => {
    expect(hsvToRgb({ h: 240, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 });
    expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 1, v: 1 });
  });
});
