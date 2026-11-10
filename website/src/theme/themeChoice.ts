/**
 * The reader's theme and direction choice. The logic here is mirrored, hand-minified, by
 * `THEME_INIT_SCRIPT` (themeInit.ts), which runs before first paint; a test evaluates both on the
 * same inputs. The static markup is light and left to right.
 */
import type { WaveDir, WaveTheme } from '../../../src';

/** The site's theme: the library's own union, so the story runtime and this module agree. */
export type SiteTheme = WaveTheme;
/** The site's direction: the library's own union. */
export type SiteDir = WaveDir;

export interface SiteChoice {
  theme: SiteTheme;
  dir: SiteDir;
}

/**
 * What the reader picked for the theme: one of the themes, or `'system'`, which follows the
 * operating system (forced colors, then a dark color scheme, then light) and changes with it. The
 * page always carries a resolved {@link SiteTheme}; only the stored choice and the Theme control
 * hold the preference.
 */
export type ThemePreference = 'system' | SiteTheme;

/** The choice as stored: the theme preference (System included) and the direction. */
export interface StoredChoice {
  theme: ThemePreference;
  dir: SiteDir;
}

/** The storage key of the choice; the value is JSON `{ theme, dir }`. */
export const STORAGE_KEY = 'waveui-docs:choice';

const THEMES: readonly SiteTheme[] = ['light', 'dark', 'high-contrast'];
const DIRS: readonly SiteDir[] = ['ltr', 'rtl'];

function readStored(storage: Pick<Storage, 'getItem'> | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function systemTheme(matches: (query: string) => boolean): SiteTheme {
  const test = (query: string): boolean => {
    try {
      return matches(query);
    } catch {
      return false;
    }
  };
  if (test('(forced-colors: active)')) return 'high-contrast';
  return test('(prefers-color-scheme: dark)') ? 'dark' : 'light';
}

/**
 * The theme a preference gives now: a theme as it is, `'system'` as the system's (a `matches` that
 * throws counts as no match).
 */
export function resolveTheme(
  preference: ThemePreference,
  matches: (query: string) => boolean,
): SiteTheme {
  return preference === 'system' ? systemTheme(matches) : preference;
}

/**
 * The preference stored: its theme if that is one of the themes or `'system'`, else System, which
 * is also what a reader who never chose gets. A storage that throws or holds something else counts
 * as empty.
 */
export function readThemePreference(storage: Pick<Storage, 'getItem'> | null): ThemePreference {
  const { theme } = readStored(storage);
  return THEMES.find((candidate) => candidate === theme) ?? 'system';
}

/**
 * The choice to apply: each field of the stored choice if it is valid (a stored `'system'` is not
 * a theme, so it counts as none), else the system's theme (forced colors, then a dark color scheme,
 * then light) and left to right. A storage that throws
 * or holds something else counts as empty, and so does a `matches` that throws.
 */
export function resolveInitialChoice(
  storage: Pick<Storage, 'getItem'> | null,
  matches: (query: string) => boolean,
): SiteChoice {
  const stored = readStored(storage);
  const theme = THEMES.find((candidate) => candidate === stored.theme) ?? systemTheme(matches);
  const dir = DIRS.find((candidate) => candidate === stored.dir) ?? 'ltr';
  return { theme, dir };
}

/**
 * The choice the page carries: `<html>`'s `wave-*` theme class (light when it has none) and its
 * `dir`. Browser code, for the islands: read it in an effect, never during render, so the first
 * client render matches the server's light, left-to-right markup.
 */
export function readDocumentChoice(doc: Document = document): SiteChoice {
  const html = doc.documentElement;
  return {
    theme: THEMES.find((theme) => html.classList.contains(`wave-${theme}`)) ?? 'light',
    dir: html.dir === 'rtl' ? 'rtl' : 'ltr',
  };
}

/** Remember the choice. A missing or failing storage is ignored. */
export function saveChoice(storage: Pick<Storage, 'setItem'> | null, choice: StoredChoice): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ theme: choice.theme, dir: choice.dir }));
  } catch {
    // Storage may be blocked or full: the choice then lasts for the page only.
  }
}
