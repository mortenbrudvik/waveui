import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  readCss,
  rootConstants,
  stripComments,
  themeDecls,
  THEMES,
} from '../../styles/__tests__/tokensHarness';
import { tokenVariable, type WaveTokenName, type WaveTokens } from '../tokens';
import { chartPalette, WAVE_TOKEN_NAMES, waveTokens } from '../waveTokens';

/** `--wave-palette-red-tint` → `paletteRedTint`: the camelCase name a variable must have. */
const camelCaseOf = (variable: string): string =>
  variable.slice('--wave-'.length).replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());

const isWaveVariable = (name: string): boolean => name.startsWith('--wave-');

/** Every `--wave-*` variable that the constants, the ramps and the three theme groups declare. */
function declaredVariables(): Set<string> {
  const declared = new Set<string>();
  const groups = [rootConstants(), ...THEMES.map((theme) => themeDecls(theme))];
  for (const decls of groups) {
    for (const name of decls.keys()) if (isWaveVariable(name)) declared.add(name);
  }
  return declared;
}

describe('WAVE_TOKEN_NAMES: parity with tokens.css', () => {
  const declared = declaredVariables();
  const byVariable = new Map(WAVE_TOKEN_NAMES.map((name) => [tokenVariable(name), name]));

  it('reads the declarations of tokens.css', () => {
    expect(declared.has('--wave-primary')).toBe(true);
    expect(declared.has('--wave-brand-80')).toBe(true);
    expect(declared.has('--wave-grey-98')).toBe(true);
    expect(declared.has('--wave-duration-ultra-slow')).toBe(true);
    expect(declared.has('--wave-palette-steel-tint-foreground')).toBe(true);
    expect(declared.has('--wave-shadow-64')).toBe(true);
  });

  it('has a name for every declared variable', () => {
    expect([...declared].filter((variable) => !byVariable.has(variable))).toEqual([]);
  });

  it('declares the variable of every name', () => {
    expect(WAVE_TOKEN_NAMES.filter((name) => !declared.has(tokenVariable(name)))).toEqual([]);
  });

  it('names every variable in camelCase, so the conversion round-trips', () => {
    expect(
      WAVE_TOKEN_NAMES.filter(
        (name) => !/^[a-z][A-Za-z0-9]*$/.test(name) || camelCaseOf(tokenVariable(name)) !== name,
      ),
    ).toEqual([]);
    expect(
      [...declared].filter((variable) => tokenVariable(camelCaseOf(variable)) !== variable),
    ).toEqual([]);
  });

  it('has no duplicate names', () => {
    expect(
      WAVE_TOKEN_NAMES.filter((name, index) => WAVE_TOKEN_NAMES.indexOf(name) !== index),
    ).toEqual([]);
  });

  it('leaves no --wave-* declaration of tokens.css outside the groups it reads', () => {
    const everywhere = new Set(
      [...stripComments(readCss('tokens.css')).matchAll(/(--wave-[\w-]+)\s*:/g)].map(
        ([, variable]) => variable,
      ),
    );
    expect([...everywhere].filter((variable) => !declared.has(variable))).toEqual([]);
  });
});

describe('waveTokens', () => {
  it('maps every name to the var() of its variable, in the order of the names', () => {
    expect(Object.keys(waveTokens)).toEqual([...WAVE_TOKEN_NAMES]);
    expect(
      WAVE_TOKEN_NAMES.filter((name) => waveTokens[name] !== `var(${tokenVariable(name)})`),
    ).toEqual([]);
    expect(waveTokens.primary).toBe('var(--wave-primary)');
    expect(waveTokens.brand80).toBe('var(--wave-brand-80)');
    expect(waveTokens.paletteRedTintForeground).toBe('var(--wave-palette-red-tint-foreground)');
  });

  it('is frozen and read-only', () => {
    expect(Object.isFrozen(waveTokens)).toBe(true);
    expect(() => {
      // @ts-expect-error waveTokens is read-only
      waveTokens.primary = 'var(--wave-primary)';
    }).toThrow(TypeError);
  });

  it('types each value as its literal var()', () => {
    expectTypeOf(waveTokens.primary).toEqualTypeOf<'var(--wave-primary)'>();
    expectTypeOf(waveTokens.primaryForeground).toEqualTypeOf<'var(--wave-primary-foreground)'>();
    expectTypeOf(waveTokens.brand160).toEqualTypeOf<'var(--wave-brand-160)'>();
    expectTypeOf(
      waveTokens.paletteRedTintForeground,
    ).toEqualTypeOf<'var(--wave-palette-red-tint-foreground)'>();
    expectTypeOf(waveTokens.zOverlay).toEqualTypeOf<'var(--wave-z-overlay)'>();
    expectTypeOf(waveTokens.shadow16).toEqualTypeOf<'var(--wave-shadow-16)'>();
    expectTypeOf(waveTokens).toExtend<WaveTokens>();
    expectTypeOf<keyof typeof waveTokens>().toEqualTypeOf<WaveTokenName>();
  });
});

describe('chartPalette', () => {
  // Chosen with a colour-vision simulation (Machado 2009 at full severity, OKLab ΔE ×100): every
  // two neighbours stay apart in the light and dark themes; the numbers are in the JSDoc (spec §3).
  const ORDER = [
    'paletteBlue',
    'palettePurple',
    'paletteBrown',
    'paletteTeal',
    'paletteRed',
    'paletteNavy',
    'palettePumpkin',
    'paletteSteel',
    'paletteGold',
    'paletteLavender',
    'paletteForest',
    'paletteMagenta',
  ];

  it('lists the 12 palette fills in the order that keeps neighbouring series apart', () => {
    expect(chartPalette).toEqual(ORDER);
  });

  it('holds token names, each a fill and none twice, and every fill of the palette', () => {
    const names: readonly string[] = WAVE_TOKEN_NAMES;
    expect(chartPalette.filter((name) => !names.includes(name))).toEqual([]);
    expect(chartPalette.filter((name) => !/^palette[A-Z][a-z]+$/.test(name))).toEqual([]);
    expect(new Set(chartPalette).size).toBe(chartPalette.length);
    expect(names.filter((name) => /^palette[A-Z][a-z]+$/.test(name)).sort()).toEqual(
      [...chartPalette].sort(),
    );
  });

  it('is frozen, and typed as token names', () => {
    expect(Object.isFrozen(chartPalette)).toBe(true);
    expectTypeOf(chartPalette).toEqualTypeOf<readonly WaveTokenName[]>();
    expect(chartPalette.map((name) => waveTokens[name])[0]).toBe('var(--wave-palette-blue)');
  });
});
