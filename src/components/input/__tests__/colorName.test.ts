import { describe, it, expect } from 'vitest';
import { hexToHsv } from '../../../lib/color';
import { getColorName } from '../colorName';

describe('getColorName (D22)', () => {
  it.each([
    ['#0f6cbd', 'blue'],
    ['#d13438', 'red'],
    ['#242424', 'black'],
    ['#ffffff', 'white'],
    ['#808080', 'gray'],
  ])('names %s "%s" (the pinned examples)', (hex, name) => {
    expect(getColorName(hexToHsv(hex)!)).toBe(name);
  });

  it.each([
    [0, 'red'],
    [30, 'orange'],
    [60, 'yellow'],
    [120, 'green'],
    [180, 'cyan'],
    [220, 'blue'],
    [270, 'purple'],
    [300, 'magenta'],
    [330, 'pink'],
    [350, 'red'],
  ])('names the family of hue %s "%s"', (h, name) => {
    expect(getColorName({ h, s: 0.6, v: 0.7 })).toBe(name);
  });

  it.each([
    [14.9, 'red'],
    [15, 'orange'],
    [44.9, 'orange'],
    [45, 'yellow'],
    [69.9, 'yellow'],
    [70, 'green'],
    [164.9, 'green'],
    [165, 'cyan'],
    [194.9, 'cyan'],
    [195, 'blue'],
    [254.9, 'blue'],
    [255, 'purple'],
    [289.9, 'purple'],
    [290, 'magenta'],
    [319.9, 'magenta'],
    [320, 'pink'],
    [344.9, 'pink'],
    [345, 'red'],
  ])('hue %s is "%s" (the family bounds)', (h, name) => {
    expect(getColorName({ h, s: 0.6, v: 0.7 })).toBe(name);
  });

  it('adds the lightness qualifier, then the saturation qualifier', () => {
    expect(getColorName({ h: 220, s: 0.3, v: 0.4 })).toBe('dark grayish blue');
    expect(getColorName({ h: 220, s: 0.6, v: 0.3 })).toBe('dark blue');
    expect(getColorName({ h: 220, s: 0.3, v: 0.7 })).toBe('grayish blue');
    expect(getColorName({ h: 330, s: 0.4, v: 0.9 })).toBe('light pink');
    expect(getColorName({ h: 220, s: 0.3, v: 0.9 })).toBe('light blue');
    expect(getColorName({ h: 0, s: 0.9, v: 0.9 })).toBe('vivid red');
  });

  it('names grays by brightness below 10 % saturation, and black below 15 % brightness', () => {
    expect(getColorName({ h: 200, s: 0.05, v: 0.3 })).toBe('dark gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.6 })).toBe('gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.8 })).toBe('light gray');
    expect(getColorName({ h: 200, s: 0.05, v: 0.95 })).toBe('white');
    expect(getColorName({ h: 200, s: 1, v: 0.1 })).toBe('black');
  });

  it('reads out-of-range and non-finite channels as hsvToHex does', () => {
    expect(getColorName({ h: -10, s: 2, v: 2 })).toBe('vivid red');
    expect(getColorName({ h: Number.NaN, s: Number.NaN, v: Number.NaN })).toBe('black');
  });
});
