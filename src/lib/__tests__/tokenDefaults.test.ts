import { describe, expect, it } from 'vitest';
import { rootConstants } from '../../styles/__tests__/tokensHarness';
import { resetTokenStyle } from '../tokenDefaults';
import { tokenVariable, type WaveTokenOverrides } from '../tokens';
import { WAVE_TOKEN_NAMES } from '../waveTokens';

/** Every token name as an override, so that the reset returns its whole table. */
const EVERYTHING = Object.fromEntries(
  WAVE_TOKEN_NAMES.map((name) => [name, 'x']),
) as WaveTokenOverrides;

/** A declaration's value as `resetTokenStyle` writes it: one line, single spaces. */
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

describe('resetTokenStyle (the reset of tokens={null})', () => {
  it('holds exactly the :root block of tokens.css, with its values', () => {
    const table = resetTokenStyle(EVERYTHING) ?? {};
    const declared = Object.fromEntries(
      [...rootConstants()]
        .filter(([name]) => name.startsWith('--wave-'))
        .map(([name, value]) => [name, oneLine(value)]),
    );
    expect(table).toEqual(declared);
    expect(Object.keys(table).length).toBeGreaterThan(60);
  });

  it('holds no token that a theme declares', () => {
    const table = resetTokenStyle(EVERYTHING) ?? {};
    for (const name of ['primary', 'background', 'shadow4', 'paletteRedTint']) {
      expect(table[tokenVariable(name) as keyof typeof table]).toBeUndefined();
    }
  });

  it('resets only the theme-independent tokens that were overridden, in the inherited order', () => {
    expect(
      resetTokenStyle({ primary: '#fff', zToast: 5, brand80: '#c43e00', fontFamily: 'Inter' }),
    ).toEqual({
      '--wave-z-toast': '1100',
      '--wave-brand-80': '#0f6cbd',
      '--wave-font-family':
        "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
    });
    expect(Object.keys(resetTokenStyle({ zToast: 1, brand80: '#000' }) ?? {})).toEqual([
      '--wave-z-toast',
      '--wave-brand-80',
    ]);
  });

  it('returns undefined when nothing theme-independent was overridden', () => {
    expect(resetTokenStyle({})).toBeUndefined();
    expect(resetTokenStyle({ primary: '#fff', shadow2: 'none' })).toBeUndefined();
    expect(resetTokenStyle({ brand80: undefined })).toBeUndefined();
  });

  it('is not fooled by an inherited object property or an unknown key', () => {
    const odd = {
      constructor: 'x',
      toString: 'x',
      hasOwnProperty: 'x',
    } as unknown as WaveTokenOverrides;
    expect(resetTokenStyle(odd)).toBeUndefined();
  });
});
