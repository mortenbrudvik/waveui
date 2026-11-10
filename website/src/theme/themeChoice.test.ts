// @vitest-environment jsdom
/**
 * The theme choice is tested twice over: the module logic on its own, and the pre-paint script
 * evaluated in jsdom on the same inputs, so the two cannot drift apart.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readThemePreference,
  resolveInitialChoice,
  resolveTheme,
  saveChoice,
  STORAGE_KEY,
} from './themeChoice';
import { EXAMPLE_PREVIEW_SCRIPT, THEME_INIT_SCRIPT } from './themeInit';

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

describe('the System preference', () => {
  const dark = '(prefers-color-scheme: dark)';

  it('a stored "system" follows the system, and keeps its direction', () => {
    const stored = JSON.stringify({ theme: 'system', dir: 'rtl' });
    expect(resolveInitialChoice(storageOf(stored), only(dark))).toEqual({
      theme: 'dark',
      dir: 'rtl',
    });
    expect(resolveInitialChoice(storageOf(stored), none)).toEqual({ theme: 'light', dir: 'rtl' });
  });

  it('resolveTheme gives a fixed theme as it is and System as the system’s', () => {
    expect(resolveTheme('dark', none)).toBe('dark');
    expect(resolveTheme('light', only(dark))).toBe('light');
    expect(resolveTheme('system', only(dark))).toBe('dark');
    expect(resolveTheme('system', only('(forced-colors: active)'))).toBe('high-contrast');
    expect(resolveTheme('system', none)).toBe('light');
    expect(
      resolveTheme('system', () => {
        throw new Error('no matchMedia');
      }),
    ).toBe('light');
  });

  it('readThemePreference is the stored theme, else System', () => {
    for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
      expect(readThemePreference(storageOf(JSON.stringify({ theme, dir: 'ltr' })))).toBe(theme);
    }
    // Nothing stored, a storage that throws, and anything invalid all follow the system.
    for (const raw of [null, '{not json', 'null', '42', '"dark"', '{}', '{"theme":"sepia"}']) {
      expect(readThemePreference(storageOf(raw)), String(raw)).toBe('system');
    }
    expect(readThemePreference(throwingStorage)).toBe('system');
    expect(readThemePreference(null)).toBe('system');
  });

  it('saveChoice stores System as "system"', () => {
    const setItem = vi.fn();
    saveChoice({ setItem }, { theme: 'system', dir: 'rtl' });
    expect(setItem).toHaveBeenCalledExactlyOnceWith(
      STORAGE_KEY,
      JSON.stringify({ theme: 'system', dir: 'rtl' }),
    );
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
    {
      name: 'stored system, dark scheme',
      stored: '{"theme":"system","dir":"rtl"}',
      matches: only(dark),
    },
    { name: 'stored system, nothing', stored: '{"theme":"system","dir":"ltr"}', matches: none },
  ];

  it.each(cases)('agrees with resolveInitialChoice: $name', ({ stored, matches }) => {
    stubEnvironment({ stored, matches });
    run();
    const expected = resolveInitialChoice(storageOf(stored), matches);
    expect(html.className).toBe(`wave-${expected.theme}`);
    expect(html.getAttribute('dir')).toBe(expected.dir);
  });
});

describe('EXAMPLE_PREVIEW_SCRIPT', () => {
  const html = document.documentElement;
  const run = () => (0, eval)(EXAMPLE_PREVIEW_SCRIPT);

  /** An example's static preview root, as the server renders it: light and left to right. */
  const previewRoot = () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-example-preview', '');
    wrapper.innerHTML =
      '<div dir="ltr" data-wave-theme="light" class="wave-root wave-light wave:bg-background"></div>';
    document.body.append(wrapper);
    return wrapper.firstElementChild as HTMLElement;
  };

  afterEach(() => {
    document.body.innerHTML = '';
    html.className = '';
    html.removeAttribute('dir');
  });

  it('is a small, import-free string', () => {
    expect(typeof EXAMPLE_PREVIEW_SCRIPT).toBe('string');
    expect(new TextEncoder().encode(EXAMPLE_PREVIEW_SCRIPT).length).toBeLessThan(600);
    expect(EXAMPLE_PREVIEW_SCRIPT).not.toMatch(/\bimport\b/);
  });

  it('gives each static preview the page’s theme and direction, and keeps its other classes', () => {
    html.className = 'wave-dark';
    html.dir = 'rtl';
    const [a, b] = [previewRoot(), previewRoot()];
    run();
    for (const root of [a, b]) {
      expect([...root.classList].sort()).toEqual(['wave-dark', 'wave-root', 'wave:bg-background']);
      expect(root.getAttribute('data-wave-theme')).toBe('dark');
      expect(root.getAttribute('dir')).toBe('rtl');
    }
  });

  it('follows the page’s direction alone, and its theme alone', () => {
    html.className = 'wave-light';
    html.dir = 'rtl';
    const rtl = previewRoot();
    run();
    expect(rtl.getAttribute('dir')).toBe('rtl');
    expect(rtl.classList.contains('wave-light')).toBe(true);

    html.className = 'wave-high-contrast';
    html.dir = 'ltr';
    const contrast = previewRoot();
    run();
    expect(contrast.classList.contains('wave-high-contrast')).toBe(true);
    expect(contrast.classList.contains('wave-light')).toBe(false);
    expect(contrast.getAttribute('data-wave-theme')).toBe('high-contrast');
  });

  it('leaves a light, left-to-right page’s previews as the server rendered them', () => {
    html.className = 'wave-light';
    html.dir = 'ltr';
    const root = previewRoot();
    const before = root.outerHTML;
    run();
    expect(root.outerHTML).toBe(before);
  });

  it('touches nothing outside the previews, and throws nothing on a page without any', () => {
    html.className = 'wave-dark';
    html.dir = 'rtl';
    const outside = document.createElement('div');
    outside.className = 'wave-root wave-light';
    outside.setAttribute('data-wave-theme', 'light');
    document.body.append(outside);
    expect(run).not.toThrow();
    expect(outside.className).toBe('wave-root wave-light');
    expect(outside.getAttribute('data-wave-theme')).toBe('light');
    expect(outside.hasAttribute('dir')).toBe(false);
  });
});
