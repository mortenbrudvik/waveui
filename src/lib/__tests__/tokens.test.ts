import type * as React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  collectTokenStyle,
  getTokenStyle,
  mergeTokenOverrides,
  tokenVariable,
  type TokenStyle,
  type TokenVariable,
  type WaveTokenName,
  type WaveTokenOverrides,
  type WaveTokens,
} from '../tokens';
import type { WAVE_TOKEN_NAMES } from '../waveTokens';
import tokensSource from '../tokens.ts?raw';
import waveTokensSource from '../waveTokens.ts?raw';
import { rootConstants, themeDecls, THEMES } from '../../styles/__tests__/tokensHarness';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Overrides as a JavaScript caller may pass them (keys and values TypeScript would refuse). */
const loose = (overrides: Record<string, unknown>) => overrides as WaveTokenOverrides;

/** The warning of `getTokenStyle` for a value it skips. */
const VALUE_WARNING = (key: string) =>
  `[WaveUI] getTokenStyle: the value of \`${key}\` is skipped: it must be a finite number, or CSS ` +
  'text without `;`, `{`, `}` and with balanced quotes, brackets and comments.';

/**
 * Strings that end a server-rendered `style` attribute's text in the middle of a construct: an
 * open string, comment, parenthesis or square bracket runs on to the end of the attribute, and a
 * trailing backslash escapes the semicolon after it, so the declarations after it (later tokens,
 * the consumer's `style`) are swallowed, while the client sets each property on its own. A stray
 * closer, which the client refuses in a custom property, is skipped too.
 */
const MALFORMED_VALUES = [
  ['an unclosed single quote', "'Segoe UI, sans-serif"],
  ['an unclosed double quote', '"Segoe UI, sans-serif'],
  ['a string closed by an escaped quote only', "'Segoe UI\\', sans-serif"],
  ['a quote closed by the other quote', '\'Segoe UI", sans-serif'],
  ['a newline inside a string', "'Segoe\nUI', sans-serif"],
  ['a carriage return inside a string', "'Segoe\rUI', sans-serif"],
  ['a form feed inside a string', "'Segoe\fUI', sans-serif"],
  ['an unterminated comment', '#c43e00 /* brand'],
  ['a comment opener closed by its own slash', '#c43e00 /*/'],
  ['an unclosed parenthesis', 'rgba(0, 0, 0, 0.5'],
  ['an unclosed nested parenthesis', 'color-mix(in srgb, var(--wave-brand-80) 80%, #000000'],
  ['a parenthesis closed only inside a string', "rgb(0 0 0 ')'"],
  ['a parenthesis closed only inside a comment', 'rgb(0 0 0 /* ) */'],
  ['a stray closing parenthesis', '#c43e00)'],
  ['a closing parenthesis before its opening one', 'rgb)0 0 0('],
  ['an unclosed square bracket', '[content-start'],
  ['a stray closing square bracket', 'content-start]'],
  ['a parenthesis closed inside a square bracket', 'calc([a)]'],
  ['a square bracket closed inside a parenthesis', '[a (b] c)'],
  ['a square bracket closed only inside a string', "[a ']'"],
  ['a trailing backslash', '#c43e00\\'],
  ['an odd run of trailing backslashes', '#c43e00\\\\\\'],
] as const;

/** Every `--wave-*` declaration of tokens.css: the constants and ramps, then each theme group. */
const TOKENS_CSS_VALUES = [
  ...[...rootConstants()].map(([variable, value]) => [':root', variable, value] as const),
  ...THEMES.flatMap((theme) =>
    [...themeDecls(theme)].map(([variable, value]) => [theme, variable, value] as const),
  ),
].filter(([, variable]) => variable.startsWith('--wave-'));

describe('tokenVariable', () => {
  it.each([
    ['primary', '--wave-primary'],
    ['primaryForeground', '--wave-primary-foreground'],
    ['brand80', '--wave-brand-80'],
    ['brand160', '--wave-brand-160'],
    ['paletteRedTintForeground', '--wave-palette-red-tint-foreground'],
    ['fontFamilyMonospace', '--wave-font-family-monospace'],
    ['shadow16', '--wave-shadow-16'],
    ['zOverlay', '--wave-z-overlay'],
    ['durationUltraFast', '--wave-duration-ultra-fast'],
  ])('%s is %s', (name, variable) => {
    expect(tokenVariable(name)).toBe(variable);
  });

  it('has a type-level twin that spells out the same variables', () => {
    expectTypeOf<TokenVariable<'primary'>>().toEqualTypeOf<'--wave-primary'>();
    expectTypeOf<TokenVariable<'primaryForeground'>>().toEqualTypeOf<'--wave-primary-foreground'>();
    expectTypeOf<TokenVariable<'brand80'>>().toEqualTypeOf<'--wave-brand-80'>();
    expectTypeOf<TokenVariable<'brand160'>>().toEqualTypeOf<'--wave-brand-160'>();
    expectTypeOf<
      TokenVariable<'paletteRedTintForeground'>
    >().toEqualTypeOf<'--wave-palette-red-tint-foreground'>();
    expectTypeOf<
      TokenVariable<'fontFamilyMonospace'>
    >().toEqualTypeOf<'--wave-font-family-monospace'>();
    expectTypeOf<TokenVariable<'shadow16'>>().toEqualTypeOf<'--wave-shadow-16'>();
    expectTypeOf<TokenVariable<'zOverlay'>>().toEqualTypeOf<'--wave-z-overlay'>();
    expectTypeOf<
      TokenVariable<'durationUltraFast'>
    >().toEqualTypeOf<'--wave-duration-ultra-fast'>();
  });
});

describe('collectTokenStyle', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty map', {}],
    ['a map of undefined values', { primary: undefined, brand80: undefined }],
  ])('gives no style for %s', (_label, overrides) => {
    expect(collectTokenStyle(overrides)).toEqual({ style: undefined, invalid: [] });
  });

  it('applies a string as it is', () => {
    expect(collectTokenStyle({ primary: '#c43e00' })).toEqual({
      style: { '--wave-primary': '#c43e00' },
      invalid: [],
    });
  });

  it('turns a number into its string', () => {
    expect(collectTokenStyle({ zOverlay: 2000, durationFast: 0 })).toEqual({
      style: { '--wave-z-overlay': '2000', '--wave-duration-fast': '0' },
      invalid: [],
    });
  });

  it('skips an undefined value and keeps the order of the input', () => {
    const { style } = collectTokenStyle({
      ring: '#ffff00',
      primary: undefined,
      brand80: '#c43e00',
      primaryForeground: '#ffffff',
    });
    expect(Object.entries(style ?? {})).toEqual([
      ['--wave-ring', '#ffff00'],
      ['--wave-brand-80', '#c43e00'],
      ['--wave-primary-foreground', '#ffffff'],
    ]);
  });

  it('applies a camelCase name that is not a token as well (no check against the token list)', () => {
    expect(collectTokenStyle(loose({ primry: 'red' })).style).toEqual({ '--wave-primry': 'red' });
  });

  it('skips a key that is not a camelCase identifier and lists it, without a warning', () => {
    const warn = vi.spyOn(console, 'warn');
    expect(
      collectTokenStyle(
        loose({
          'primary-foreground': '#ffffff',
          PrimaryHover: '#000000',
          '--wave-ring': '#ffff00',
          '80brand': '#c43e00',
          primary: '#c43e00',
          'brand 80': '#c43e00',
        }),
      ),
    ).toEqual({
      style: { '--wave-primary': '#c43e00' },
      invalid: [
        { key: 'primary-foreground', reason: 'name' },
        { key: 'PrimaryHover', reason: 'name' },
        { key: '--wave-ring', reason: 'name' },
        { key: '80brand', reason: 'name' },
        { key: 'brand 80', reason: 'name' },
      ],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['null', null],
    ['a boolean', true],
    ['an object', { value: '#c43e00' }],
  ])('skips a value that is %s and lists it, without a warning', (_label, value) => {
    const warn = vi.spyOn(console, 'warn');
    expect(collectTokenStyle(loose({ primary: value, ring: '#ffff00' }))).toEqual({
      style: { '--wave-ring': '#ffff00' },
      invalid: [{ key: 'primary', reason: 'value' }],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  // A server render writes a custom property's value into the `style` attribute as text, so a
  // semicolon would end the declaration and start one of the caller's (and a brace would end the
  // block); no token value needs either.
  it.each([
    ['a semicolon', 'red;background:url(x)'],
    ['a trailing semicolon', '#c43e00;'],
    ['an opening brace', '{ color: red'],
    ['a closing brace', 'red } body { color: red'],
    ['a semicolon inside parentheses', 'rgba(0, 0, 0; 0.5)'],
  ])('skips a string with %s and lists it, without a warning', (_label, value) => {
    const warn = vi.spyOn(console, 'warn');
    expect(collectTokenStyle({ brand80: value, ring: '#ffff00' })).toEqual({
      style: { '--wave-ring': '#ffff00' },
      invalid: [{ key: 'brand80', reason: 'value' }],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a font stack with quoted names',
      'fontFamily',
      '\'Segoe UI\', "Helvetica Neue", -apple-system, sans-serif',
    ],
    [
      'a shadow with colour functions and commas',
      'shadow8',
      '0 0 2px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.14)',
    ],
    ['a timing curve', 'curveEasyEase', 'cubic-bezier(0.33, 0, 0.67, 1)'],
    ['a duration', 'durationFast', '150ms'],
    ['a reference to another token', 'primary', 'var(--wave-brand-70)'],
    ['a colour mix', 'primaryHover', 'color-mix(in srgb, #c43e00 80%, #000000)'],
    [
      'a font stack with a parenthesis in a quoted name',
      'fontFamily',
      "'Segoe UI', 'Segoe UI Web (West European)', sans-serif",
    ],
    ['an escaped quote inside a string', 'fontFamily', '\'Wave\\\'s Sans\', "A \\"B\\"", serif'],
    ['a quote of the other kind inside a string', 'fontFamily', '"Wave\'s Sans", \'A "B"\''],
    ['a line continuation inside a string', 'fontFamily', "'Segoe\\\nUI', sans-serif"],
    ['a comment opener inside a string', 'fontFamily', "'/* Wave', sans-serif"],
    ['a balanced comment', 'primary', "#c43e00 /* brand (it's orange) */"],
    ['a backslash before the end of a comment', 'primary', '#c43e00 /* a \\*/'],
    ['an escaped backslash at the end', 'fontFamily', 'Wave\\\\'],
    ['an escaped parenthesis', 'fontFamily', 'Wave\\)Sans'],
    ['a fallback in a reference', 'primary', 'var(--x, #fff)'],
    ['balanced square brackets', 'fontFamily', '[content-start] repeat(2, [col] 1fr) [end]'],
    ['brackets inside a string and a comment', 'fontFamily', "'[(' /* ]) */, sans-serif"],
    [
      'nested functions and a division',
      'shadow2',
      '0 0 calc(4px / 2) color-mix(in srgb, var(--wave-brand-80) 50%, rgb(0 0 0 / 0.5))',
    ],
  ] as const)('applies %s as it is', (_label, key, value) => {
    expect(collectTokenStyle({ [key]: value } as WaveTokenOverrides)).toEqual({
      style: { [tokenVariable(key)]: value },
      invalid: [],
    });
  });

  it.each(MALFORMED_VALUES)(
    'skips a string with %s and lists it, without a warning',
    (_, value) => {
      const warn = vi.spyOn(console, 'warn');
      expect(collectTokenStyle({ fontFamily: value, ring: '#ffff00' })).toEqual({
        style: { '--wave-ring': '#ffff00' },
        invalid: [{ key: 'fontFamily', reason: 'value' }],
      });
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it('reads the declarations of tokens.css', () => {
    const variables = TOKENS_CSS_VALUES.map(([, variable]) => variable);
    expect(variables).toContain('--wave-font-family');
    expect(variables).toContain('--wave-shadow-64');
    expect(variables).toContain('--wave-curve-easy-ease');
    expect(new Set(TOKENS_CSS_VALUES.map(([group]) => group))).toEqual(
      new Set([':root', ...THEMES]),
    );
  });

  it.each(TOKENS_CSS_VALUES)('applies the value of tokens.css (%s %s) as it is', (_, __, value) => {
    expect(collectTokenStyle({ primary: value })).toEqual({
      style: { '--wave-primary': value },
      invalid: [],
    });
  });

  it('gives no style when every entry is invalid, and lists each one', () => {
    expect(collectTokenStyle(loose({ 'brand-80': '#c43e00', primary: Number.NaN }))).toEqual({
      style: undefined,
      invalid: [
        { key: 'brand-80', reason: 'name' },
        { key: 'primary', reason: 'value' },
      ],
    });
  });

  it('skips an undefined value before it checks the key', () => {
    expect(collectTokenStyle(loose({ 'brand-80': undefined }))).toEqual({
      style: undefined,
      invalid: [],
    });
  });

  it('returns a new object and leaves the input alone', () => {
    const overrides: WaveTokenOverrides = { primary: '#c43e00', zOverlay: 5 };
    const { style } = collectTokenStyle(overrides);
    expect(style).not.toBe(overrides);
    expect(overrides).toEqual({ primary: '#c43e00', zOverlay: 5 });
  });
});

describe('getTokenStyle', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty map', {}],
    ['a map of undefined values', { primary: undefined }],
    ['a string', { brand80: '#c43e00' }],
    ['a number', { zTooltip: 3000 }],
    ['several entries', { ring: '#ffff00', primary: undefined, brand80: '#c43e00', zToast: 2 }],
  ])('gives the style of collectTokenStyle for %s, without a warning', (_label, overrides) => {
    const warn = vi.spyOn(console, 'warn');
    expect(getTokenStyle(overrides)).toEqual(collectTokenStyle(overrides).style);
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives the style of an example', () => {
    expect(getTokenStyle({ brand80: '#c43e00', zOverlay: 2000 })).toEqual({
      '--wave-brand-80': '#c43e00',
      '--wave-z-overlay': '2000',
    });
  });

  it('warns once for a key that is not a camelCase identifier', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides = loose({ 'primary-foreground': '#ffffff', primary: '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(warn.mock.calls).toEqual([
      [
        '[WaveUI] getTokenStyle: `primary-foreground` is not a token name, so it is skipped. ' +
          'Token names are the CSS variable in camelCase without its `--wave-` prefix ' +
          '(`primaryForeground` for `--wave-primary-foreground`).',
      ],
    ]);
  });

  it('warns once for a value that is not a finite number or a string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides = loose({ zOverlay: Number.NaN, primary: '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('zOverlay')]]);
  });

  it('warns once for a string with a semicolon or a brace, and skips it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides: WaveTokenOverrides = { brand80: 'red;background:url(x)', primary: '#c43e00' };
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle({ ring: 'red }' })).toBeUndefined();
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('brand80')], [VALUE_WARNING('ring')]]);
  });

  it('warns once per key for an unbalanced string, and skips it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides: WaveTokenOverrides = {
      fontFamily: "'Segoe UI, sans-serif",
      shadow2: 'rgba(0, 0, 0, 0.12',
      primary: '#c43e00',
    };
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle(overrides)).toEqual({ '--wave-primary': '#c43e00' });
    expect(getTokenStyle({ ring: '#ffff00\\' })).toBeUndefined();
    expect(warn.mock.calls).toEqual([
      [VALUE_WARNING('fontFamily')],
      [VALUE_WARNING('shadow2')],
      [VALUE_WARNING('ring')],
    ]);
  });

  it('gives no style for a map whose only value carries a declaration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getTokenStyle({ brand80: 'red;background:url(x)' })).toBeUndefined();
    expect(warn.mock.calls).toEqual([[VALUE_WARNING('brand80')]]);
  });

  it('warns for each invalid entry, a bad key and a bad value, once each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const overrides = loose({ Primary: '#c43e00', ring: null });
    expect(getTokenStyle(overrides)).toBeUndefined();
    expect(getTokenStyle(overrides)).toBeUndefined();
    expect(warn.mock.calls).toEqual([
      [expect.stringMatching(/^\[WaveUI\] getTokenStyle: `Primary` is not a token name, /)],
      [VALUE_WARNING('ring')],
    ]);
  });
});

describe('mergeTokenOverrides', () => {
  const parent: WaveTokenOverrides = { primary: '#c43e00', ring: '#c43e00' };

  it('inherits the parent for undefined', () => {
    expect(mergeTokenOverrides(parent, undefined)).toBe(parent);
  });

  it('clears everything for null', () => {
    const merged = mergeTokenOverrides(parent, null);
    expect(merged).toEqual({});
    expect(merged).not.toBe(parent);
    expect(parent).toEqual({ primary: '#c43e00', ring: '#c43e00' });
  });

  it('merges key by key, the own value winning and a new key appended', () => {
    const merged = mergeTokenOverrides(parent, { ring: '#ffff00', brand80: '#c43e00' });
    expect(Object.entries(merged)).toEqual([
      ['primary', '#c43e00'],
      ['ring', '#ffff00'],
      ['brand80', '#c43e00'],
    ]);
    expect(parent).toEqual({ primary: '#c43e00', ring: '#c43e00' });
  });

  it('inherits a key whose own value is undefined, and adds no key for it', () => {
    const merged = mergeTokenOverrides(parent, {
      primary: undefined,
      ring: '#ffff00',
      zOverlay: undefined,
    });
    expect(merged).toEqual({ primary: '#c43e00', ring: '#ffff00' });
    expect('zOverlay' in merged).toBe(false);
  });

  it('keeps a `__proto__` key as an own entry, which the style then reports', () => {
    const own = JSON.parse('{ "__proto__": "#c43e00", "ring": "#ffff00" }') as WaveTokenOverrides;
    const merged = mergeTokenOverrides(parent, own);
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.keys(merged)).toEqual(['primary', 'ring', '__proto__']);
    expect(collectTokenStyle(merged).invalid).toEqual([{ key: '__proto__', reason: 'name' }]);
  });

  it('gives an empty own map the parent content in a new object', () => {
    const merged = mergeTokenOverrides(parent, {});
    expect(merged).toEqual(parent);
    expect(merged).not.toBe(parent);
  });
});

describe('the token types', () => {
  it('names, the token object, overrides and the style', () => {
    expectTypeOf<WaveTokenName>().toEqualTypeOf<(typeof WAVE_TOKEN_NAMES)[number]>();
    expectTypeOf<'primary'>().toExtend<WaveTokenName>();
    expectTypeOf<'brand80'>().toExtend<WaveTokenName>();
    expectTypeOf<'paletteSteelTintForeground'>().toExtend<WaveTokenName>();
    expectTypeOf<'primry'>().not.toExtend<WaveTokenName>();

    expectTypeOf<WaveTokens>().toEqualTypeOf<{ readonly [K in WaveTokenName]: string }>();
    expectTypeOf<WaveTokenOverrides>().toEqualTypeOf<{
      [K in WaveTokenName]?: string | number;
    }>();
    expectTypeOf<TokenStyle>().toExtend<React.CSSProperties>();
    expectTypeOf<{ '--wave-primary': string; color: string }>().toExtend<TokenStyle>();
    expectTypeOf(getTokenStyle).toEqualTypeOf<
      (overrides: WaveTokenOverrides | null | undefined) => TokenStyle | undefined
    >();

    // @ts-expect-error a misspelled token name
    const typo: WaveTokenOverrides = { primry: '#c43e00' };
    // @ts-expect-error a token value is a string or a number
    const flag: WaveTokenOverrides = { primary: true };
    expect([typo, flag]).toHaveLength(2);
  });
});

/**
 * The import and re-export statements of a module's source (comments removed): each with its
 * specifier, whether it is type-only (`import type …`, `export type … from`) and its text on one
 * line. A side-effect import (`import './x'`) is a run-time import.
 */
function importStatements(
  source: string,
): { specifier: string; typeOnly: boolean; text: string }[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const statement =
    /^[ \t]*(?:(?:import|export)\s+(type\s+)?[\w*{}\s,$]+?\s+from\s+|import\s+)['"]([^'"]+)['"]/gm;
  return [...code.matchAll(statement)].map(([text, type, specifier]) => ({
    specifier,
    typeOnly: type !== undefined,
    text: text.trim().replace(/\s+/g, ' '),
  }));
}

describe('server safety', () => {
  it('tokens.ts imports only types and the development warnings at run time', () => {
    const statements = importStatements(tokensSource);
    expect(statements.length).toBeGreaterThan(0);
    expect(
      statements.filter(({ typeOnly, specifier }) => !typeOnly && specifier !== './dev'),
    ).toEqual([]);
    expect(tokensSource).not.toMatch(/\brequire\s*\(|\bimport\s*\(|['"]use client['"]/);
  });

  it('waveTokens.ts imports only tokenVariable at run time', () => {
    expect(
      importStatements(waveTokensSource)
        .filter(({ typeOnly }) => !typeOnly)
        .map(({ text }) => text),
    ).toEqual(["import { tokenVariable } from './tokens'"]);
    expect(waveTokensSource).not.toMatch(/\brequire\s*\(|\bimport\s*\(|['"]use client['"]/);
  });
});
