import { describe, it, expect } from 'vitest';
import {
  alphaToOpacity,
  formatHexColor,
  getCheckColors,
  getRelativeLuminance,
  isHexDraft,
  normalizeHexColor,
  opacityToAlpha,
  parseCssColor,
  parseHexColor,
  parseHexInput,
} from '../colorUtils';

describe('parseHexColor', () => {
  it('parses 6- and 8-digit hex colors into a lowercase rgb part and an alpha byte', () => {
    expect(parseHexColor('#0F6CBD')).toEqual({ rgb: '#0f6cbd', alpha: 255 });
    expect(parseHexColor('#0f6cbd80')).toEqual({ rgb: '#0f6cbd', alpha: 128 });
    expect(parseHexColor('#0f6cbd00')).toEqual({ rgb: '#0f6cbd', alpha: 0 });
  });

  it('expands the 3- and 4-digit short forms', () => {
    expect(parseHexColor('#abc')).toEqual({ rgb: '#aabbcc', alpha: 255 });
    expect(parseHexColor('#abc8')).toEqual({ rgb: '#aabbcc', alpha: 0x88 });
  });

  it('trims surrounding whitespace', () => {
    expect(parseHexColor('  #112233 ')).toEqual({ rgb: '#112233', alpha: 255 });
  });

  it('rejects everything that is not a hex color', () => {
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
      expect(parseHexColor(value), value).toBeNull();
    }
  });
});

describe('parseHexInput', () => {
  it('accepts only complete 6- or 8-digit input (what the hex field commits while typing)', () => {
    expect(parseHexInput('#abcdef')).toEqual({ rgb: '#abcdef', alpha: 255 });
    expect(parseHexInput('#abcdef40')).toEqual({ rgb: '#abcdef', alpha: 0x40 });
    expect(parseHexInput('#abc')).toBeNull();
    expect(parseHexInput('#abcd')).toBeNull();
    expect(parseHexInput('#abcde')).toBeNull();
    expect(parseHexInput('#zzz')).toBeNull();
  });
});

describe('isHexDraft', () => {
  it('is true for text that can still become a hex color by typing more', () => {
    for (const text of ['', '#', '#a', '#abc', '#ABCDEF', '#abcdef1', '#abcdef12', 'abc']) {
      expect(isHexDraft(text), text).toBe(true);
    }
  });

  it('ignores surrounding whitespace, like the parsers', () => {
    for (const text of ['#abcdef ', ' #abc', '\tabc\n', '  ']) {
      expect(isHexDraft(text), JSON.stringify(text)).toBe(true);
    }
    expect(parseHexInput('#abcdef ')).toEqual({ rgb: '#abcdef', alpha: 255 });
  });

  it('is false for text that can never become a hex color', () => {
    for (const text of ['#zzz', '#abcdef123', '##abc', '#12 34', 'red']) {
      expect(isHexDraft(text), text).toBe(false);
    }
  });
});

describe('formatHexColor', () => {
  it('omits the alpha byte for opaque colors and appends it otherwise', () => {
    expect(formatHexColor('#0f6cbd')).toBe('#0f6cbd');
    expect(formatHexColor('#0f6cbd', 255)).toBe('#0f6cbd');
    expect(formatHexColor('#0f6cbd', 128)).toBe('#0f6cbd80');
    expect(formatHexColor('#0f6cbd', 0)).toBe('#0f6cbd00');
  });

  it('clamps and rounds the alpha byte', () => {
    expect(formatHexColor('#000000', 300)).toBe('#000000');
    expect(formatHexColor('#000000', -4)).toBe('#00000000');
    expect(formatHexColor('#000000', 15.6)).toBe('#00000010');
  });
});

describe('normalizeHexColor', () => {
  it('writes every hex form as a lowercase #rrggbb, or #rrggbbaa when not opaque', () => {
    expect(normalizeHexColor('#0F6CBD')).toBe('#0f6cbd');
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc');
    expect(normalizeHexColor('#abc8')).toBe('#aabbcc88');
    expect(normalizeHexColor('#0f6cbdFF')).toBe('#0f6cbd');
    expect(normalizeHexColor('#0F6CBD80')).toBe('#0f6cbd80');
    expect(normalizeHexColor(' #112233 ')).toBe('#112233');
  });

  it('returns null for anything that is not a hex color', () => {
    for (const value of ['red', '', '#12345', 'rgb(0,0,0)']) {
      expect(normalizeHexColor(value), value).toBeNull();
    }
  });
});

describe('opacity conversions', () => {
  it('maps the alpha byte to a whole percentage and back without drift', () => {
    expect(alphaToOpacity(255)).toBe(100);
    expect(alphaToOpacity(128)).toBe(50);
    expect(alphaToOpacity(0)).toBe(0);
    expect(opacityToAlpha(100)).toBe(255);
    expect(opacityToAlpha(50)).toBe(128);
    expect(opacityToAlpha(0)).toBe(0);
    for (let percent = 0; percent <= 100; percent++) {
      expect(alphaToOpacity(opacityToAlpha(percent)), String(percent)).toBe(percent);
    }
  });

  it('clamps out-of-range opacity', () => {
    expect(opacityToAlpha(140)).toBe(255);
    expect(opacityToAlpha(-3)).toBe(0);
  });
});

describe('parseCssColor', () => {
  it('parses hex colors', () => {
    expect(parseCssColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor('#f008')).toEqual({ r: 255, g: 0, b: 0, a: 0x88 / 255 });
  });

  it('parses rgb()/rgba() in comma and space syntax', () => {
    expect(parseCssColor('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseCssColor('rgba(0,0,0,0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(parseCssColor('rgb(0 128 255 / 25%)')).toEqual({ r: 0, g: 128, b: 255, a: 0.25 });
    expect(parseCssColor('rgb(100% 0% 50%)')).toEqual({ r: 255, g: 0, b: 127.5, a: 1 });
  });

  it('returns null for colors it cannot resolve without a browser (named colors, other spaces)', () => {
    expect(parseCssColor('red')).toBeNull();
    expect(parseCssColor('hsl(0 100% 50%)')).toBeNull();
    expect(parseCssColor('var(--brand)')).toBeNull();
  });
});

describe('getRelativeLuminance', () => {
  it('follows the WCAG relative-luminance formula', () => {
    expect(getRelativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(getRelativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(getRelativeLuminance('#0f6cbd')).toBeCloseTo(0.1452, 3);
    expect(getRelativeLuminance('red')).toBeNull();
  });
});

describe('getCheckColors', () => {
  const BLACK = '#000000';
  const WHITE = '#ffffff';

  it('draws a black glyph on light swatches and a white one on dark swatches', () => {
    expect(getCheckColors('#ffffff')).toEqual({ glyph: BLACK, halo: WHITE });
    expect(getCheckColors('#ffb900')).toEqual({ glyph: BLACK, halo: WHITE });
    expect(getCheckColors('rgb(250, 250, 210)')).toEqual({ glyph: BLACK, halo: WHITE });
    expect(getCheckColors('#0f6cbd')).toEqual({ glyph: WHITE, halo: BLACK });
    expect(getCheckColors('#242424')).toEqual({ glyph: WHITE, halo: BLACK });
  });

  it('picks the glyph with the higher contrast ratio against the swatch', () => {
    // #767676: black 4.62:1 vs white 4.54:1 → black.
    expect(getCheckColors('#767676').glyph).toBe(BLACK);
    // #707070: black 4.24:1 vs white 4.95:1 → white.
    expect(getCheckColors('#707070').glyph).toBe(WHITE);
  });

  it('falls back to a black glyph with a white halo for colors it cannot parse', () => {
    expect(getCheckColors('rebeccapurple')).toEqual({ glyph: BLACK, halo: WHITE });
  });
});
