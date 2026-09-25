/**
 * Theme names and theme classes. A server-safe module (the build puts `"use client"` only on
 * component and hook modules), so a React Server Component can call {@link getThemeClassName},
 * e.g. `<html className={getThemeClassName('dark')}>` in a Next.js `app/layout.tsx`.
 * `WaveProvider` re-exports both.
 */

/** Supported visual themes for the Wave design system. */
export type WaveTheme = 'light' | 'dark' | 'high-contrast';

const themeClassMap: Record<WaveTheme, string> = {
  light: 'wave-light',
  // The legacy `dark` / `high-contrast` classes stay emitted (deprecated) for consumers' `dark:`
  // variants and 0.4 selectors.
  dark: 'wave-dark dark',
  'high-contrast': 'wave-high-contrast high-contrast',
};

/** Every {@link WaveTheme}, in declaration order. */
export const WAVE_THEMES = Object.keys(themeClassMap) as readonly WaveTheme[];

/** Whether `theme` is a {@link WaveTheme} (untyped callers can pass anything). */
export function isWaveTheme(theme: unknown): theme is WaveTheme {
  return typeof theme === 'string' && Object.hasOwn(themeClassMap, theme);
}

/**
 * The classes that select a theme's tokens: `'wave-light'`, `'wave-dark dark'` or
 * `'wave-high-contrast high-contrast'`. Unknown values fall back to the light classes. Safe to call
 * from a React Server Component.
 *
 * @param theme - A {@link WaveTheme}.
 */
export function getThemeClassName(theme: WaveTheme): string {
  return isWaveTheme(theme) ? themeClassMap[theme] : themeClassMap.light;
}
