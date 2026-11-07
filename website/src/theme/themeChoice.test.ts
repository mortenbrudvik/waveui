// @vitest-environment jsdom
/**
 * The theme choice is tested twice over: the module logic on its own, and the pre-paint script
 * evaluated in jsdom on the same inputs, so the two cannot drift apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveInitialChoice, saveChoice, STORAGE_KEY } from './themeChoice';
import { THEME_INIT_SCRIPT } from './themeInit';

const none = () => false;
const only = (query: string) => (q: string) => q === query;
const storageOf = (value: string | null) => ({ getItem: () => value });
const throwingStorage = {
  getItem(): string {
    throw new Error('blocked');
  },
};

describe('resolveInitialChoice', () => {
  it('stored choice wins', () => {
    const stored = JSON.stringify({ theme: 'dark', dir: 'rtl' });
    expect(resolveInitialChoice(storageOf(stored), only('(forced-colors: active)'))).toEqual({
      theme: 'dark',
      dir: 'rtl',
    });
  });

  it('forced-colors selects high-contrast when nothing is stored', () => {
    const matches = (q: string) =>
      q === '(forced-colors: active)' || q === '(prefers-color-scheme: dark)';
    expect(resolveInitialChoice(storageOf(null), matches)).toEqual({
      theme: 'high-contrast',
      dir: 'ltr',
    });
  });

  it('prefers-color-scheme: dark selects dark', () => {
    expect(resolveInitialChoice(storageOf(null), only('(prefers-color-scheme: dark)'))).toEqual({
      theme: 'dark',
      dir: 'ltr',
    });
  });

  it('default is light and ltr', () => {
    expect(resolveInitialChoice(null, none)).toEqual({ theme: 'light', dir: 'ltr' });
    expect(resolveInitialChoice(storageOf(null), none)).toEqual({ theme: 'light', dir: 'ltr' });
  });

  it('a storage that throws on read falls back to the system choice', () => {
    expect(resolveInitialChoice(throwingStorage, only('(prefers-color-scheme: dark)'))).toEqual({
      theme: 'dark',
      dir: 'ltr',
    });
  });

  it('an invalid stored value is ignored', () => {
    const system = only('(prefers-color-scheme: dark)');
    for (const raw of ['{not json', 'null', '42', '"dark"', '[]', '{}']) {
      expect(resolveInitialChoice(storageOf(raw), system)).toEqual({ theme: 'dark', dir: 'ltr' });
    }
    // Each field is validated on its own.
    expect(
      resolveInitialChoice(storageOf(JSON.stringify({ theme: 'sepia', dir: 'rtl' })), system),
    ).toEqual({ theme: 'dark', dir: 'rtl' });
    expect(
      resolveInitialChoice(storageOf(JSON.stringify({ theme: 'light', dir: 'up' })), system),
    ).toEqual({ theme: 'light', dir: 'ltr' });
  });

  it('a matches function that throws counts as no match', () => {
    const matches = () => {
      throw new Error('no matchMedia');
    };
    expect(resolveInitialChoice(null, matches)).toEqual({ theme: 'light', dir: 'ltr' });
  });
});

describe('saveChoice', () => {
  it('writes the choice as JSON under the storage key', () => {
    const setItem = vi.fn();
    saveChoice({ setItem }, { theme: 'high-contrast', dir: 'rtl' });
    expect(setItem).toHaveBeenCalledExactlyOnceWith(
      STORAGE_KEY,
      JSON.stringify({ theme: 'high-contrast', dir: 'rtl' }),
    );
    expect(STORAGE_KEY).toBe('waveui-docs:choice');
  });

  it('a storage that throws on write is ignored', () => {
    const storage = {
      setItem() {
        throw new Error('quota');
      },
    };
    expect(() => saveChoice(storage, { theme: 'dark', dir: 'ltr' })).not.toThrow();
    expect(() => saveChoice(null, { theme: 'dark', dir: 'ltr' })).not.toThrow();
  });
});

describe('THEME_INIT_SCRIPT', () => {
  const html = document.documentElement;
  const run = () => (0, eval)(THEME_INIT_SCRIPT);

  /** Stub the globals the script reads: storage and `matchMedia`. */
  function stubEnvironment(options: {
    stored?: string | null;
    storageThrows?: boolean;
    matches?: (query: string) => boolean;
    matchMediaThrows?: boolean;
    noMatchMedia?: boolean;
  }) {
    const storage = {
      getItem: () => {
        if (options.storageThrows) throw new Error('blocked');
        return options.stored ?? null;
      },
    };
    vi.stubGlobal('localStorage', storage);
    if (options.noMatchMedia) {
      vi.stubGlobal('matchMedia', undefined);
    } else {
      vi.stubGlobal('matchMedia', (query: string) => {
        if (options.matchMediaThrows) throw new Error('matchMedia failed');
        return { matches: (options.matches ?? none)(query) };
      });
    }
  }

  beforeEach(() => {
    html.className = 'wave-light';
    html.removeAttribute('dir');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    html.className = '';
    html.removeAttribute('dir');
  });

  it('is a small, import-free string', () => {
    expect(typeof THEME_INIT_SCRIPT).toBe('string');
    expect(new TextEncoder().encode(THEME_INIT_SCRIPT).length).toBeLessThan(600);
    expect(THEME_INIT_SCRIPT).not.toMatch(/\bimport\b/);
  });

  it('the init script evaluated in jsdom sets html class and dir from storage', () => {
    stubEnvironment({ stored: JSON.stringify({ theme: 'dark', dir: 'rtl' }) });
    run();
    expect(html.className).toBe('wave-dark');
    expect(html.getAttribute('dir')).toBe('rtl');
  });

  it('replaces the default class and keeps other classes', () => {
    html.className = 'site wave-light other';
    stubEnvironment({ stored: JSON.stringify({ theme: 'high-contrast', dir: 'ltr' }) });
    run();
    expect([...html.classList].sort()).toEqual(['other', 'site', 'wave-high-contrast']);
    run();
    expect([...html.classList].sort()).toEqual(['other', 'site', 'wave-high-contrast']);
  });

  it('the init script with blocked storage still sets the system choice and throws nothing', () => {
    stubEnvironment({ storageThrows: true, matches: only('(prefers-color-scheme: dark)') });
    expect(run).not.toThrow();
    expect(html.className).toBe('wave-dark');
    expect(html.getAttribute('dir')).toBe('ltr');
  });

  it('without matchMedia or when it throws, the script falls back to light', () => {
    stubEnvironment({ noMatchMedia: true });
    expect(run).not.toThrow();
    expect(html.className).toBe('wave-light');
    stubEnvironment({ matchMediaThrows: true });
    expect(run).not.toThrow();
    expect(html.className).toBe('wave-light');
  });

  const dark = '(prefers-color-scheme: dark)';
  const forced = '(forced-colors: active)';
  const cases: { name: string; stored: string | null; matches: (q: string) => boolean }[] = [
    { name: 'stored dark rtl', stored: '{"theme":"dark","dir":"rtl"}', matches: only(forced) },
    { name: 'stored light', stored: '{"theme":"light","dir":"ltr"}', matches: only(dark) },
    { name: 'forced colors', stored: null, matches: (q) => q === forced || q === dark },
    { name: 'dark scheme', stored: null, matches: only(dark) },
    { name: 'nothing', stored: null, matches: none },
    { name: 'invalid json', stored: '{nope', matches: only(dark) },
    { name: 'json null', stored: 'null', matches: only(dark) },
    { name: 'json string', stored: '"dark"', matches: only(forced) },
    { name: 'wrong theme', stored: '{"theme":"sepia","dir":"rtl"}', matches: only(dark) },
    { name: 'wrong dir', stored: '{"theme":"dark","dir":"up"}', matches: none },
    { name: 'empty object', stored: '{}', matches: only(forced) },
  ];

  it.each(cases)('agrees with resolveInitialChoice: $name', ({ stored, matches }) => {
    stubEnvironment({ stored, matches });
    run();
    const expected = resolveInitialChoice(storageOf(stored), matches);
    expect(html.className).toBe(`wave-${expected.theme}`);
    expect(html.getAttribute('dir')).toBe(expected.dir);
  });
});
