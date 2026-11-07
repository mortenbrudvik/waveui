// @vitest-environment node
/**
 * Contract tests for the style entries in `src/styles` (spec §2.1). They need no DOM, and they
 * load the build scripts (scripts/build-css.mjs and the entry guard it shares with
 * scripts/verify-dist.mjs), which run in Node: the file runs in the node environment.
 *
 * The CSS files are read as raw text and parsed with the small parser below. That parser is not a
 * general CSS parser: it covers what these files use (rules, at-rules, nested `@theme`/`@keyframes`
 * blocks and declarations). jsdom cannot compute colour contrast (§4.5), so this file is the
 * contrast gate: it resolves every token per theme and recomputes the WCAG 2.2 contrast ratios of
 * the §2.1.3 table **unrounded**.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  BOUND_TEXT_SURFACES,
  CONTRAST_PAIRS,
  CSS_FILE_NAMES,
  NOT_TEXT_TOKENS,
  PALETTE_HUES,
  SURFACE_TEXT_TOKENS,
  TEXT_MATRIX,
  TEXT_SURFACES,
  THEMES,
  THEME_GROUPS,
  PROVIDER_SELECTORS,
  contrastRatio,
  declarations,
  declsMatching,
  merge,
  normalizeSelector,
  parseFile,
  readCss,
  resolveToken,
  resolved,
  rootConstants,
  ruleWithSelectors,
  selectorList,
  stripComments,
  styleRules,
  themeDecls,
  tokensNodes,
  type CssNode,
  type Decls,
  type ThemeName,
} from './tokensHarness';

// ---------------------------------------------------------------------------------------------
// Expected values (spec §2.1.3)
// ---------------------------------------------------------------------------------------------

/** Token → [light, dark, high contrast], resolved values. */
const TOKENS: Record<string, [string, string, string]> = {
  background: ['#ffffff', '#292929', '#000000'],
  foreground: ['#242424', '#ffffff', '#ffffff'],
  card: ['#fafafa', '#333333', '#000000'],
  'card-foreground': ['#242424', '#ffffff', '#ffffff'],
  secondary: ['#f5f5f5', '#333333', '#000000'],
  'secondary-foreground': ['#242424', '#ffffff', '#ffffff'],
  muted: ['#f0f0f0', '#383838', '#1a1a1a'],
  'muted-foreground': ['#616161', '#adadad', '#ffffff'],
  'muted-hover': ['#e0e0e0', '#424242', '#333333'],
  'muted-pressed': ['#d1d1d1', '#2e2e2e', '#4d4d4d'],
  primary: ['#0f6cbd', '#62abf5', '#1aebff'],
  'primary-foreground': ['#ffffff', '#000000', '#000000'],
  'primary-hover': ['#115ea3', '#77b7f7', '#6ef3ff'],
  'primary-pressed': ['#0c3b5e', '#2886de', '#00c4d6'],
  accent: ['#0f6cbd', '#62abf5', '#1aebff'],
  'accent-foreground': ['#ffffff', '#000000', '#000000'],
  destructive: ['#c50f1f', '#f48a94', '#ff6e6e'],
  'destructive-foreground': ['#ffffff', '#000000', '#000000'],
  error: ['#c50f1f', '#f48a94', '#ff6e6e'],
  'error-foreground': ['#ffffff', '#000000', '#000000'],
  subtle: ['transparent', 'transparent', 'transparent'],
  'subtle-hover': ['#f5f5f5', '#333333', '#1f1f1f'],
  'subtle-pressed': ['#ebebeb', '#2e2e2e', '#333333'],
  'subtle-selected': ['#ebebeb', '#383838', '#333333'],
  selected: ['#ebf3fc', '#082338', '#003a40'],
  'selected-foreground': ['#0f548c', '#62abf5', '#ffffff'],
  'selected-hover': ['#cfe4fa', '#0c3b5e', '#005259'],
  'selected-pressed': ['#b4d6fa', '#061724', '#006b75'],
  border: ['#e0e0e0', '#666666', '#ffffff'],
  stroke: ['#d1d1d1', '#666666', '#ffffff'],
  'stroke-hover': ['#c7c7c7', '#757575', '#ffffff'],
  'stroke-accessible': ['#616161', '#adadad', '#ffffff'],
  input: ['#d1d1d1', '#666666', '#ffffff'],
  'input-filled-darker': ['#f5f5f5', '#141414', '#000000'],
  'input-filled-lighter': ['#ffffff', '#292929', '#000000'],
  'input-filled-stroke': ['transparent', 'transparent', '#ffffff'],
  ring: ['#0f6cbd', '#479ef5', '#ffff00'],
  success: ['#107c10', '#5db55d', '#3ff23f'],
  'success-foreground': ['#ffffff', '#000000', '#000000'],
  'success-tint': ['#f1faf1', '#052505', '#000000'],
  'success-tint-foreground': ['#0e700e', '#54b054', '#3ff23f'],
  warning: ['#fde300', '#fde300', '#ffff00'],
  'warning-foreground': ['#242424', '#000000', '#000000'],
  'warning-tint': ['#fffbe6', '#463100', '#000000'],
  'warning-tint-foreground': ['#6d5b00', '#fde300', '#ffff00'],
  'error-tint': ['#fdf3f4', '#3b0509', '#000000'],
  'error-tint-foreground': ['#b10e1c', '#f48a94', '#ff6060'],
  severe: ['#da3b01', '#e97548', '#ff8c00'],
  'severe-foreground': ['#ffffff', '#000000', '#000000'],
  'severe-tint': ['#fdf6f3', '#411200', '#000000'],
  'severe-tint-foreground': ['#a52c00', '#e97548', '#ff8c00'],
  info: ['#0f6cbd', '#479ef5', '#1aebff'],
  'info-foreground': ['#ffffff', '#000000', '#000000'],
  'info-tint': ['#ebf3fc', '#082338', '#000000'],
  'info-tint-foreground': ['#0f548c', '#62abf5', '#1aebff'],
  inverted: ['#292929', '#ffffff', '#000000'],
  'inverted-foreground': ['#ffffff', '#242424', '#ffffff'],
  'inverted-border': ['transparent', 'transparent', '#ffffff'],
  track: ['#e0e0e0', '#3d3d3d', '#4d4d4d'],
  skeleton: ['#e0e0e0', '#3d3d3d', '#333333'],
  rating: ['#b86e00', '#f7b538', '#ffff00'],
  'presence-available': ['#107c10', '#54b054', '#3ff23f'],
  'presence-busy': ['#c50f1f', '#f48a94', '#ff6060'],
  'presence-away': ['#a67c00', '#f7b538', '#ffff00'],
  'presence-offline': ['#616161', '#adadad', '#ffffff'],
  'presence-oof': ['#b4009e', '#d696c8', '#ff80ff'],
  'presence-glyph': ['#ffffff', '#000000', '#000000'],
  // Persona palette: the fill and its text (0.13); the tint, its text and the border (0.17; the
  // border resolves to the fill).
  'palette-red': ['#c50f1f', '#f48a94', '#ffffff'],
  'palette-red-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-red-tint': ['#eeb7bc', '#760913', '#000000'],
  'palette-red-tint-foreground': ['#a30c1a', '#f48a94', '#ffffff'],
  'palette-red-border': ['#c50f1f', '#f48a94', '#ffffff'],
  'palette-pumpkin': ['#b5470a', '#f2a46b', '#ffffff'],
  'palette-pumpkin-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-pumpkin-tint': ['#e9c8b6', '#6d2b06', '#000000'],
  'palette-pumpkin-tint-foreground': ['#953b08', '#f2a46b', '#ffffff'],
  'palette-pumpkin-border': ['#b5470a', '#f2a46b', '#ffffff'],
  'palette-gold': ['#8a6200', '#f7b538', '#ffffff'],
  'palette-gold-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-gold-tint': ['#dcd0b3', '#533b00', '#000000'],
  'palette-gold-tint-foreground': ['#745300', '#f7b538', '#ffffff'],
  'palette-gold-border': ['#8a6200', '#f7b538', '#ffffff'],
  'palette-forest': ['#107c10', '#6fcf6f', '#ffffff'],
  'palette-forest-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-forest-tint': ['#b7d8b7', '#0a4a0a', '#000000'],
  'palette-forest-tint-foreground': ['#0d660d', '#6fcf6f', '#ffffff'],
  'palette-forest-border': ['#107c10', '#6fcf6f', '#ffffff'],
  'palette-teal': ['#0a6b6b', '#4cc2c2', '#ffffff'],
  'palette-teal-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-teal-tint': ['#b6d3d3', '#064040', '#000000'],
  'palette-teal-tint-foreground': ['#096060', '#4cc2c2', '#ffffff'],
  'palette-teal-border': ['#0a6b6b', '#4cc2c2', '#ffffff'],
  'palette-blue': ['#0f6cbd', '#479ef5', '#ffffff'],
  'palette-blue-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-blue-tint': ['#b7d3eb', '#094171', '#000000'],
  'palette-blue-tint-foreground': ['#0c599c', '#6ab1f7', '#ffffff'],
  'palette-blue-border': ['#0f6cbd', '#479ef5', '#ffffff'],
  'palette-navy': ['#103a73', '#7fa7e0', '#ffffff'],
  'palette-navy-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-navy-tint': ['#b7c4d5', '#0a2345', '#000000'],
  'palette-navy-tint-foreground': ['#103a73', '#7fa7e0', '#ffffff'],
  'palette-navy-border': ['#103a73', '#7fa7e0', '#ffffff'],
  'palette-lavender': ['#6a5cb8', '#b4a7f0', '#ffffff'],
  'palette-lavender-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-lavender-tint': ['#d2ceea', '#40376e', '#000000'],
  'palette-lavender-tint-foreground': ['#594e9b', '#b4a7f0', '#ffffff'],
  'palette-lavender-border': ['#6a5cb8', '#b4a7f0', '#ffffff'],
  'palette-purple': ['#5c2e91', '#c8a6f0', '#ffffff'],
  'palette-purple-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-purple-tint': ['#cec0de', '#371c57', '#000000'],
  'palette-purple-tint-foreground': ['#5c2e91', '#c8a6f0', '#ffffff'],
  'palette-purple-border': ['#5c2e91', '#c8a6f0', '#ffffff'],
  'palette-magenta': ['#b4009e', '#ec8fdc', '#ffffff'],
  'palette-magenta-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-magenta-tint': ['#e9b3e2', '#6c005f', '#000000'],
  'palette-magenta-tint-foreground': ['#950083', '#ec8fdc', '#ffffff'],
  'palette-magenta-border': ['#b4009e', '#ec8fdc', '#ffffff'],
  'palette-brown': ['#8e562e', '#d4a373', '#ffffff'],
  'palette-brown-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-brown-tint': ['#ddccc0', '#55341c', '#000000'],
  'palette-brown-tint-foreground': ['#7d4b28', '#d4a373', '#ffffff'],
  'palette-brown-border': ['#8e562e', '#d4a373', '#ffffff'],
  'palette-steel': ['#4f7391', '#9fb8cc', '#ffffff'],
  'palette-steel-foreground': ['#ffffff', '#000000', '#000000'],
  'palette-steel-tint': ['#cad5de', '#2f4557', '#000000'],
  'palette-steel-tint-foreground': ['#405d76', '#9fb8cc', '#ffffff'],
  'palette-steel-border': ['#4f7391', '#9fb8cc', '#ffffff'],
  // Chart series (1.1): ten categorical colours made for charts, white in high contrast.
  'chart-1': ['#0183fc', '#8abdfe', '#ffffff'],
  'chart-2': ['#958506', '#ead32e', '#ffffff'],
  'chart-3': ['#5e0ebc', '#9c72ff', '#ffffff'],
  'chart-4': ['#a1000a', '#fe584d', '#ffffff'],
  'chart-5': ['#047c5b', '#3ba882', '#ffffff'],
  'chart-6': ['#904f9b', '#bf7bc9', '#ffffff'],
  'chart-7': ['#a05402', '#ff902c', '#ffffff'],
  'chart-8': ['#00556f', '#8edeff', '#ffffff'],
  'chart-9': ['#872550', '#ffa8c5', '#ffffff'],
  'chart-10': ['#729066', '#9dbc90', '#ffffff'],
  backdrop: ['rgb(0 0 0 / 0.4)', 'rgb(0 0 0 / 0.5)', 'rgb(0 0 0 / 0.8)'],
};

/** Derived variables every theme group re-declares so nested themes re-resolve them (§2.1.2). */
const DERIVED: Record<string, string> = {
  'card-foreground': 'var(--wave-foreground)',
  'secondary-foreground': 'var(--wave-foreground)',
  accent: 'var(--wave-primary)',
  'accent-foreground': 'var(--wave-primary-foreground)',
  'input-filled-lighter': 'var(--wave-background)',
};

/** Primary aliases that reference the brand ramp (repo-level#15, button-provider#10). */
const RAMP_ALIASES: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    primary: 'var(--wave-brand-80)',
    'primary-hover': 'var(--wave-brand-70)',
    'primary-pressed': 'var(--wave-brand-40)',
  },
  dark: {
    primary: 'var(--wave-brand-110)',
    'primary-hover': 'var(--wave-brand-120)',
    'primary-pressed': 'var(--wave-brand-90)',
  },
};

const BRAND_RAMP: Record<string, string> = {
  10: '#061724',
  20: '#082338',
  30: '#0a2e4a',
  40: '#0c3b5e',
  50: '#0e4775',
  60: '#0f548c',
  70: '#115ea3',
  80: '#0f6cbd',
  90: '#2886de',
  100: '#479ef5',
  110: '#62abf5',
  120: '#77b7f7',
  130: '#96c6fa',
  140: '#b4d6fa',
  150: '#cfe4fa',
  160: '#ebf3fc',
};

const GREY_RAMP: Record<string, string> = {
  2: '#050505',
  4: '#0a0a0a',
  6: '#0f0f0f',
  8: '#141414',
  10: '#1a1a1a',
  12: '#1f1f1f',
  14: '#242424',
  16: '#292929',
  20: '#333333',
  24: '#3d3d3d',
  26: '#424242',
  30: '#4d4d4d',
  34: '#575757',
  38: '#616161',
  40: '#666666',
  44: '#707070',
  50: '#808080',
  60: '#999999',
  68: '#adadad',
  74: '#bdbdbd',
  78: '#c7c7c7',
  82: '#d1d1d1',
  86: '#dbdbdb',
  88: '#e0e0e0',
  90: '#e6e6e6',
  92: '#ebebeb',
  94: '#f0f0f0',
  96: '#f5f5f5',
  98: '#fafafa',
};

/** The 0.4 semantic names (they collide with shadcn/ui; Wave neither defines nor reads them). */
const LEGACY_SEMANTIC_NAMES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'subtle',
  'border',
  'input',
  'ring',
  'success',
  'warning',
  'error',
  'info',
  'severe',
];

/**
 * Ratios printed in §2.1.3 (rounded to two decimals there), plus the success, error and severe
 * progress fills on the track (recorded to two decimals in 0.6) and the unchecked multi-select
 * Option box on its rows (recorded to two decimals in 0.10). The unrounded ratio must match
 * them, so an edited token value cannot silently drift from the documented table.
 */
const TABLED_RATIOS: Array<[string, string, [number | null, number | null, number | null]]> = [
  ['foreground', 'background', [15.52, 14.55, 21.0]],
  ['muted-foreground', 'background', [6.19, 6.48, 21.0]],
  ['muted-foreground', 'muted', [5.43, 5.23, 17.4]],
  ['muted-foreground', 'subtle-hover', [5.68, 5.63, 16.48]],
  ['primary-foreground', 'primary', [5.38, 8.66, 14.37]],
  ['primary-foreground', 'primary-hover', [6.66, 9.9, 15.93]],
  ['primary-foreground', 'primary-pressed', [11.65, 5.56, 9.87]],
  ['primary', 'background', [5.38, 6.0, 14.37]],
  ['primary', 'subtle-hover', [4.94, 5.21, 11.28]],
  ['primary', 'subtle-selected', [4.52, 4.84, 8.65]],
  ['foreground', 'subtle-selected', [13.02, 11.73, 12.63]],
  ['selected-foreground', 'selected', [7.03, 6.62, 12.51]],
  ['foreground', 'selected', [13.87, 16.06, 12.51]],
  ['muted-foreground', 'selected', [5.53, 7.16, 12.51]],
  ['primary', 'selected', [4.81, 6.62, 8.56]],
  ['ring', 'selected', [4.81, 5.72, 11.65]],
  ['stroke-accessible', 'background', [6.19, 6.48, 21.0]],
  ['stroke-accessible', 'subtle-hover', [5.68, 5.63, 16.48]],
  ['stroke-accessible', 'subtle-selected', [5.2, 5.23, 12.63]],
  ['primary', 'input-filled-darker', [4.94, 7.6, 14.37]],
  ['destructive', 'input-filled-darker', [5.56, 7.82, 7.71]],
  ['ring', 'input-filled-darker', [4.94, 6.56, 19.56]],
  ['primary', 'input-filled-lighter', [5.38, 6.0, 14.37]],
  ['destructive', 'input-filled-lighter', [6.07, 6.17, 7.71]],
  ['ring', 'input-filled-lighter', [5.38, 5.18, 19.56]],
  ['stroke', 'background', [1.53, 2.53, 21.0]],
  ['primary', 'track', [4.08, 4.48, 5.78]],
  ['success', 'track', [4.07, 4.26, 5.63]],
  ['error', 'track', [4.59, 4.61, 3.1]],
  ['severe', 'track', [3.45, 3.67, 3.62]],
  ['error', 'background', [6.07, 6.17, 7.71]],
  ['error', 'card', [null, 5.36, null]],
  ['error-foreground', 'error', [6.07, 8.91, 7.71]],
  ['success-foreground', 'success', [5.37, 8.23, 13.98]],
  ['warning-foreground', 'warning', [11.95, 16.16, 19.56]],
  ['severe-foreground', 'severe', [4.56, 7.1, 9.0]],
  ['info-foreground', 'info', [5.38, 7.48, 14.37]],
  ['success-tint-foreground', 'success-tint', [5.89, 6.06, 13.98]],
  ['warning-tint-foreground', 'warning-tint', [6.42, 9.51, 19.56]],
  ['error-tint-foreground', 'error-tint', [6.55, 7.35, 7.09]],
  ['severe-tint-foreground', 'severe-tint', [6.64, 5.42, 9.0]],
  ['info-tint-foreground', 'info-tint', [7.03, 6.62, 14.37]],
  ['inverted-foreground', 'inverted', [14.55, 15.52, 21.0]],
  ['rating', 'background', [3.99, 8.05, 19.56]],
  ['presence-away', 'background', [3.82, 8.05, 19.56]],
  ['presence-glyph', 'presence-available', [5.37, 7.72, null]],
  ['presence-glyph', 'presence-busy', [6.07, 8.91, null]],
  ['presence-glyph', 'presence-away', [3.82, 11.62, null]],
  ['presence-glyph', 'presence-oof', [6.11, 9.06, null]],
  ['ring', 'background', [5.38, 5.18, 19.56]],
  // The tag fill states (0.11): the ten tag pairs of CONTRAST_PAIRS, and selected-foreground on
  // the selected hover and pressed fills (checked by the text matrix).
  ['ring', 'muted', [4.72, 4.18, 16.21]],
  ['foreground', 'muted-hover', [11.76, 10.05, 12.63]],
  ['foreground', 'muted-pressed', [10.17, 13.58, 8.45]],
  ['muted-hover', 'muted', [1.16, 1.17, 1.38]],
  ['muted-pressed', 'muted-hover', [1.16, 1.35, 1.49]],
  ['selected-hover', 'selected', [1.16, 1.38, 1.4]],
  ['selected-pressed', 'selected-hover', [1.16, 1.56, 1.43]],
  ['muted-hover', 'background', [1.32, 1.45, 1.66]],
  ['muted-hover', 'card', [1.26, 1.26, 1.66]],
  ['muted-hover', 'input-filled-darker', [1.21, 1.83, 1.66]],
  ['selected-foreground', 'selected-hover', [6.05, 4.81, 8.93]],
  ['selected-foreground', 'selected-pressed', [5.23, 7.5, 6.25]],
];

/**
 * §4.5: foreground, muted-foreground, primary-as-text (4.5:1) and ring (3:1) against `selected`,
 * `subtle-selected`, `card` and `subtle-hover`.
 */
const SECTION_4_5_FOREGROUNDS: Array<[string, number]> = [
  ['foreground', 4.5],
  ['muted-foreground', 4.5],
  ['primary', 4.5],
  ['ring', 3],
];
const SECTION_4_5_SURFACES = ['selected', 'subtle-selected', 'card', 'subtle-hover'];
const SECTION_4_5_MATRIX = SECTION_4_5_FOREGROUNDS.flatMap(([fg, threshold]) =>
  SECTION_4_5_SURFACES.map((bg): [string, string, number] => [fg, bg, threshold]),
);

/**
 * Pairs §2.1.3 prints as a lower bound (`≥ 7.09`) rather than a ratio: the high-contrast presence
 * glyph on each presence fill. Also the high-contrast filled-input stroke against its own
 * background (Phase 4 D5), since `CONTRAST_PAIRS` runs in every theme and cannot compare
 * `transparent`.
 */
type MinimumPair = [theme: ThemeName, fg: string, bg: string, minimum: number];
const TABLED_MINIMUMS = ['presence-available', 'presence-busy', 'presence-away', 'presence-oof']
  .map((fill): MinimumPair => ['high-contrast', 'presence-glyph', fill, 7.09])
  .concat([['high-contrast', 'input-filled-stroke', 'background', 3] satisfies MinimumPair]);

// ---------------------------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------------------------

/** The `@theme` blocks of a style file, in order. */
function themeBlocks(name: string): CssNode[] {
  return parseFile(name).filter((node) => /^@theme\b/.test(node.prelude) && node.children);
}

/** The `@theme` block of a style file that declares `key`. */
function themeBlockDeclaring(name: string, key: string): CssNode {
  const block = themeBlocks(name).find((node) => declarations(node.children ?? []).has(key));
  if (!block || !block.children) {
    throw new Error(`src/styles/${name} has no @theme block declaring ${key}`);
  }
  return block;
}

/** The namespaced theme keys apps use (`--color-wave-*`, `--text-wave-*`, …), in tokens.css. */
function themeBlock(): CssNode {
  return themeBlockDeclaring('tokens.css', '--color-wave-background');
}

/** The unnamespaced theme that Wave's own utilities compile against: theme.css (internal). */
function internalThemeBlock(): CssNode {
  return themeBlockDeclaring('theme.css', '--color-background');
}

function allRules(nodes: CssNode[]): CssNode[] {
  return nodes.flatMap((node) =>
    node.children === null ? [] : [node, ...allRules(node.children)],
  );
}

// ---------------------------------------------------------------------------------------------
// tokens.css
// ---------------------------------------------------------------------------------------------

describe('tokens.css — theme groups (repo-level#7, button-provider#6)', () => {
  it.each(THEMES)('declares the %s theme group with the documented selectors', (theme) => {
    expect(ruleWithSelectors(tokensNodes(), THEME_GROUPS[theme])).toBeDefined();
  });

  it.each(THEMES)('every token is declared directly in the %s group', (theme) => {
    const decls = themeDecls(theme);
    const missing = Object.keys(TOKENS).filter((token) => !decls.has(`--wave-${token}`));
    expect(missing).toEqual([]);
  });

  it.each(THEMES)('every %s token resolves to the value of the §2.1.3 table', (theme) => {
    const column = THEMES.indexOf(theme);
    const actual = Object.fromEntries(
      Object.keys(TOKENS).map((token) => [token, resolved(theme, token)]),
    );
    const expected = Object.fromEntries(
      Object.entries(TOKENS).map(([token, values]) => [token, values[column]]),
    );
    expect(actual).toEqual(expected);
  });

  const nestings = THEMES.flatMap((outer) =>
    THEMES.filter((inner) => inner !== outer).map((inner) => ({ outer, inner })),
  );

  it.each(nestings)(
    'a $inner provider nested in a $outer one resolves every $inner token (button-provider#6)',
    ({ outer, inner }) => {
      const html = declsMatching(tokensNodes(), [':root']);
      const outerScope = declsMatching(tokensNodes(), PROVIDER_SELECTORS[outer]);
      const innerScope = declsMatching(tokensNodes(), PROVIDER_SELECTORS[inner]);
      const column = THEMES.indexOf(inner);
      for (const [token, values] of Object.entries(TOKENS)) {
        expect(resolveToken(`--wave-${token}`, [innerScope, outerScope, html]), token).toBe(
          values[column],
        );
      }
    },
  );

  it.each(THEMES)('re-declares the derived variables in the %s group', (theme) => {
    const decls = themeDecls(theme);
    for (const [token, value] of Object.entries(DERIVED)) {
      expect(decls.get(`--wave-${token}`)).toBe(value);
    }
  });

  it('light and dark primary states reference the brand ramp (repo-level#15, button-provider#10)', () => {
    for (const theme of ['light', 'dark'] as const) {
      const decls = themeDecls(theme);
      for (const [token, value] of Object.entries(RAMP_ALIASES[theme])) {
        expect(decls.get(`--wave-${token}`)).toBe(value);
      }
    }
  });

  it('light and dark selected fill states reference the brand ramp, so a re-brand moves them (0.11)', () => {
    const SELECTED_STATES: Record<'light' | 'dark', Record<string, string>> = {
      light: {
        'selected-hover': 'var(--wave-brand-150)',
        'selected-pressed': 'var(--wave-brand-140)',
      },
      dark: {
        'selected-hover': 'var(--wave-brand-40)',
        'selected-pressed': 'var(--wave-brand-10)',
      },
    };
    for (const theme of ['light', 'dark'] as const) {
      const decls = themeDecls(theme);
      for (const [token, value] of Object.entries(SELECTED_STATES[theme])) {
        expect(decls.get(`--wave-${token}`), `${theme} ${token}`).toBe(value);
      }
    }
  });

  it('keeps the dark focus ring at #479ef5 while the dark primary moves to brand-110', () => {
    expect(resolved('dark', 'ring')).toBe('#479ef5');
    expect(resolved('dark', 'primary')).toBe('#62abf5');
    expect(resolved('dark', 'primary-foreground')).toBe('#000000');
  });

  it('prefixes every runtime variable with --wave- and never defines a 0.4 semantic name', () => {
    const names = allRules(tokensNodes())
      .filter((rule) => !rule.prelude.startsWith('@'))
      .flatMap((rule) => [...declarations(rule.children ?? []).keys()])
      .filter((name) => name.startsWith('--'));
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !name.startsWith('--wave-'))).toEqual([]);
  });

  it('reads no 0.4 name, semantic or ramp: the ramps hold no fallbacks (removed in 1.0)', () => {
    const source = stripComments(readCss('tokens.css'));
    const reads = [...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((name) => !name.startsWith('--wave-'))).toEqual([]);
    for (const name of LEGACY_SEMANTIC_NAMES) {
      expect(source).not.toMatch(new RegExp(`var\\(\\s*--${name}\\s*[,)]`));
    }
  });

  it('selects the themes by the wave-* classes only: no .dark or .high-contrast (removed in 1.0)', () => {
    const selectors = allRules(tokensNodes())
      .filter((rule) => !rule.prelude.startsWith('@'))
      .flatMap((rule) => selectorList(rule.prelude));
    expect(selectors).toContain('.wave-dark');
    expect(selectors).toContain('.wave-high-contrast');
    expect(
      selectors.filter((selector) => /\.(dark|high-contrast)(?![\w-])/.test(selector)),
    ).toEqual([]);
  });
});

describe('tokens.css — per-theme shadows (0.17)', () => {
  const LEVELS = ['2', '4', '8', '16', '28', '64'] as const;
  /** [ambient blur, key offset, key blur] of each level; the alphas differ per theme. */
  const GEOMETRY: Record<(typeof LEVELS)[number], [string, string, string]> = {
    '2': ['2px', '1px', '2px'],
    '4': ['2px', '2px', '4px'],
    '8': ['2px', '4px', '8px'],
    '16': ['2px', '8px', '16px'],
    '28': ['8px', '14px', '28px'],
    '64': ['8px', '32px', '64px'],
  };
  /** The 0.16 `--shadow-N` literals, byte for byte: the light values. */
  const LIGHT_0_16: Record<(typeof LEVELS)[number], string> = {
    '2': '0 0 2px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.14)',
    '4': '0 0 2px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.14)',
    '8': '0 0 2px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.14)',
    '16': '0 0 2px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.14)',
    '28': '0 0 8px rgba(0, 0, 0, 0.12), 0 14px 28px rgba(0, 0, 0, 0.14)',
    '64': '0 0 8px rgba(0, 0, 0, 0.12), 0 32px 64px rgba(0, 0, 0, 0.14)',
  };
  const AMBIENT = { light: '0.12', dark: '0.24', 'high-contrast': '0.24' } as const;
  const KEY = { light: '0.14', dark: '0.28', 'high-contrast': '0.28' } as const;

  function shadow(level: (typeof LEVELS)[number], ambient: string, key: string): string {
    const [ambientBlur, keyOffset, keyBlur] = GEOMETRY[level];
    return `0 0 ${ambientBlur} rgba(0, 0, 0, ${ambient}), 0 ${keyOffset} ${keyBlur} rgba(0, 0, 0, ${key})`;
  }

  function alphas(value: string): number[] {
    return [...value.matchAll(/rgba\(0, 0, 0, ([\d.]+)\)/g)].map((match) => Number(match[1]));
  }

  it('builds the light values from the same geometry as the 0.16 literals', () => {
    for (const level of LEVELS) {
      expect(shadow(level, AMBIENT.light, KEY.light)).toBe(LIGHT_0_16[level]);
    }
  });

  it.each(THEMES)('declares the six shadow tokens directly in the %s group', (theme) => {
    const decls = themeDecls(theme);
    const missing = LEVELS.filter((level) => !decls.has(`--wave-shadow-${level}`));
    expect(missing).toEqual([]);
  });

  it('keeps the light values equal to the 0.16 literals', () => {
    const decls = themeDecls('light');
    for (const level of LEVELS) {
      expect(decls.get(`--wave-shadow-${level}`), `shadow-${level}`).toBe(LIGHT_0_16[level]);
    }
  });

  it.each(['dark', 'high-contrast'] as const)(
    'gives %s the light offsets and blurs with the ambient 0.24 and key 0.28 alphas',
    (theme) => {
      const decls = themeDecls(theme);
      for (const level of LEVELS) {
        expect(decls.get(`--wave-shadow-${level}`), `shadow-${level}`).toBe(
          shadow(level, AMBIENT[theme], KEY[theme]),
        );
      }
    },
  );

  it.each(['dark', 'high-contrast'] as const)(
    'every %s ambient and key alpha is greater than the light one',
    (theme) => {
      for (const level of LEVELS) {
        const light = alphas(themeDecls('light').get(`--wave-shadow-${level}`) ?? '');
        const other = alphas(themeDecls(theme).get(`--wave-shadow-${level}`) ?? '');
        expect(light, `light shadow-${level}`).toHaveLength(2);
        expect(other, `${theme} shadow-${level}`).toHaveLength(2);
        expect(other[0], `${theme} ambient ${level}`).toBeGreaterThan(light[0]);
        expect(other[1], `${theme} key ${level}`).toBeGreaterThan(light[1]);
      }
    },
  );

  it('declares the shadows in no theme-independent constant rule', () => {
    const names = [...rootConstants().keys()].filter((name) => name.startsWith('--wave-shadow-'));
    expect(names).toEqual([]);
  });

  it('maps --shadow-wave-N (apps) and --shadow-N (internal) to the runtime tokens, no literal shadow', () => {
    const blocks = {
      'tokens.css': themeBlocks('tokens.css'),
      'theme.css': [internalThemeBlock()],
    };
    const namespaced = declarations(themeBlock().children ?? []);
    const internal = declarations(internalThemeBlock().children ?? []);
    for (const level of LEVELS) {
      expect(namespaced.get(`--shadow-wave-${level}`), `--shadow-wave-${level}`).toBe(
        `var(--wave-shadow-${level})`,
      );
      expect(internal.get(`--shadow-${level}`), `--shadow-${level}`).toBe(
        `var(--wave-shadow-${level})`,
      );
    }
    for (const [file, nodes] of Object.entries(blocks)) {
      const literals = nodes
        .flatMap((node) => [...declarations(node.children ?? []).entries()])
        .filter(
          ([name, value]) =>
            name.startsWith('--shadow') && !/^var\(--wave-shadow-\d+\)$/.test(value),
        );
      expect(literals, file).toEqual([]);
    }
  });

  it.each(THEMES)('resolves every shadow token in a nested %s theme', (theme) => {
    const scope = declsMatching(tokensNodes(), PROVIDER_SELECTORS[theme]);
    const html = declsMatching(tokensNodes(), [':root']);
    for (const level of LEVELS) {
      const value = resolveToken(`--wave-shadow-${level}`, [scope, html]);
      expect(value, `${theme} shadow-${level}`).toBe(
        shadow(level, AMBIENT[theme], KEY[theme]).toLowerCase(),
      );
    }
  });
});

describe('tokens.css — palette tints, tint foregrounds and borders (0.17)', () => {
  const ROLES = ['tint', 'tint-foreground', 'border'] as const;
  const NAMES = PALETTE_HUES.flatMap((hue) => ROLES.map((role) => `--wave-palette-${hue}-${role}`));

  /** HSL hue (degrees) and saturation of a 6-digit hex colour. */
  function hueAndSaturation(hex: string): { hue: number; saturation: number } {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
    const [r, g, b] = [0, 2, 4].map(
      (offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255,
    );
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (delta === 0) return { hue: 0, saturation: 0 };
    const sector =
      max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return { hue: sector * 60, saturation: delta / (1 - Math.abs(max + min - 1)) };
  }

  it.each(THEMES)('declares the 36 tokens of the 12 hues directly in the %s group', (theme) => {
    expect(NAMES).toHaveLength(36);
    const decls = themeDecls(theme);
    expect(NAMES.filter((name) => !decls.has(name))).toEqual([]);
  });

  it.each(THEMES)('declares every %s border as its fill, so the border moves with it', (theme) => {
    const decls = themeDecls(theme);
    for (const hue of PALETTE_HUES) {
      expect(decls.get(`--wave-palette-${hue}-border`), hue).toBe(`var(--wave-palette-${hue})`);
    }
  });

  it('collapses every hue to black and white in high contrast (R15)', () => {
    const decls = themeDecls('high-contrast');
    for (const hue of PALETTE_HUES) {
      expect(decls.get(`--wave-palette-${hue}-tint`), `${hue} tint`).toBe('#000000');
      expect(decls.get(`--wave-palette-${hue}-tint-foreground`), `${hue} tint foreground`).toBe(
        '#ffffff',
      );
      expect(resolved('high-contrast', `palette-${hue}-border`), `${hue} border`).toBe('#ffffff');
    }
  });

  it.each(THEMES)(
    '%s: the strong fill of every hue is at least 3:1 on background (a chart series)',
    (theme) => {
      const page = resolved(theme, 'background');
      const below = PALETTE_HUES.map((hue) => ({ hue, fill: resolved(theme, `palette-${hue}`) }))
        .map(({ hue, fill }) => ({ hue, fill, ratio: contrastRatio(fill, page) }))
        .filter(({ ratio }) => ratio < 3)
        .map(({ hue, fill, ratio }) => `${hue} ${fill} on ${page}: ${ratio.toFixed(3)}:1`);
      expect(below).toEqual([]);
    },
  );

  it.each(['light', 'dark'] as const)(
    '%s: every tint and tint foreground keeps the hue of its fill and is no grey',
    (theme) => {
      const off = PALETTE_HUES.flatMap((hue) => {
        const fill = hueAndSaturation(resolved(theme, `palette-${hue}`));
        return (['tint', 'tint-foreground'] as const).flatMap((role) => {
          const value = resolved(theme, `palette-${hue}-${role}`);
          const { hue: angle, saturation } = hueAndSaturation(value);
          const distance = Math.abs(angle - fill.hue);
          const drift = Math.min(distance, 360 - distance);
          return drift <= 10 && saturation >= 0.2
            ? []
            : [
                `${hue}-${role} ${value}: ${drift.toFixed(1)}° off, saturation ${saturation.toFixed(2)}`,
              ];
        });
      });
      expect(off).toEqual([]);
    },
  );

  it.each(THEMES)(
    'every colour token of the %s group is in the contrast tables (none skips classification)',
    (theme) => {
      const unlisted = [...themeDecls(theme).keys()]
        .filter((name) => !name.startsWith('--wave-shadow-'))
        .filter((name) => !(name.replace(/^--wave-/, '') in TOKENS));
      expect(unlisted).toEqual([]);
    },
  );
});

describe('tokens.css — ramps, font and z-index (repo-level#7, repo-level#15)', () => {
  it('declares the brand ramp on :root as literal colors (no 0.4 fallback, removed in 1.0)', () => {
    const constants = rootConstants();
    for (const [step, hex] of Object.entries(BRAND_RAMP)) {
      expect(constants.get(`--wave-brand-${step}`)).toBe(hex);
    }
  });

  it('declares the grey ramp on :root as literal colors (no 0.4 fallback, removed in 1.0)', () => {
    const constants = rootConstants();
    for (const [step, hex] of Object.entries(GREY_RAMP)) {
      expect(constants.get(`--wave-grey-${step}`)).toBe(hex);
    }
  });

  it('keeps the ramps theme-independent (declared only on :root)', () => {
    for (const theme of THEMES) {
      const rampNames = [...themeDecls(theme).keys()].filter((name) =>
        /^--wave-(brand|grey)-\d+$/.test(name),
      );
      expect(rampNames).toEqual([]);
    }
  });

  it('ignores an override of a 0.4 ramp name on :root (removed in 1.0: override --wave-brand-*)', () => {
    const consumer: Decls = new Map([
      ['--brand-80', '#6b2fa0'],
      ['--brand-110', '#c89ef0'],
    ]);
    const root = merge(rootConstants(), consumer);
    expect(resolveToken('--wave-primary', [themeDecls('light'), root])).toBe('#0f6cbd');
    expect(resolveToken('--wave-accent', [themeDecls('light'), root])).toBe('#0f6cbd');
    expect(resolveToken('--wave-primary', [themeDecls('dark'), root])).toBe('#62abf5');
  });

  it('re-themes when a consumer overrides a --wave-brand-* token', () => {
    const root = merge(rootConstants(), new Map([['--wave-brand-80', '#6b2fa0']]));
    expect(resolveToken('--wave-primary', [themeDecls('light'), root])).toBe('#6b2fa0');
  });

  it('declares the font family and the z-index scale on :root (overlays#36)', () => {
    const constants = rootConstants();
    expect(constants.get('--wave-font-family')).toMatch(/^'Segoe UI'/);
    expect(constants.get('--wave-z-overlay')).toBe('1000');
    expect(constants.get('--wave-z-toast')).toBe('1100');
    expect(constants.get('--wave-z-tooltip')).toBe('1200');
  });

  it('declares the monospace and numeric font stacks once, on :root only (0.17)', () => {
    const constants = rootConstants();
    expect(constants.get('--wave-font-family-monospace')).toBe(
      "Consolas, 'Courier New', Courier, monospace",
    );
    expect(constants.get('--wave-font-family-numeric')?.replace(/\s+/g, ' ')).toBe(
      "Bahnschrift, 'Segoe UI', 'Segoe UI Web (West European)', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif",
    );
    for (const theme of THEMES) {
      const names = [...themeDecls(theme).keys()].filter((name) =>
        name.startsWith('--wave-font-family'),
      );
      expect(names, `${theme} group`).toEqual([]);
    }
    const source = stripComments(readCss('tokens.css'));
    for (const name of ['--wave-font-family-monospace', '--wave-font-family-numeric']) {
      expect(source.split(`${name}:`).length - 1, name).toBe(1);
    }
  });
});

/** Fluent's motion tokens (react-motion 9.16.4): name → value, declared on the bare `:root`. */
const MOTION_TOKENS: Record<string, string> = {
  '--wave-duration-ultra-fast': '50ms',
  '--wave-duration-faster': '100ms',
  '--wave-duration-fast': '150ms',
  '--wave-duration-normal': '200ms',
  '--wave-duration-gentle': '250ms',
  '--wave-duration-slow': '300ms',
  '--wave-duration-slower': '400ms',
  '--wave-duration-ultra-slow': '500ms',
  '--wave-curve-accelerate-max': 'cubic-bezier(0.9, 0.1, 1, 0.2)',
  '--wave-curve-accelerate-mid': 'cubic-bezier(1, 0, 1, 1)',
  '--wave-curve-accelerate-min': 'cubic-bezier(0.8, 0, 0.78, 1)',
  '--wave-curve-decelerate-max': 'cubic-bezier(0.1, 0.9, 0.2, 1)',
  '--wave-curve-decelerate-mid': 'cubic-bezier(0, 0, 0, 1)',
  '--wave-curve-decelerate-min': 'cubic-bezier(0.33, 0, 0.1, 1)',
  '--wave-curve-easy-ease-max': 'cubic-bezier(0.8, 0, 0.2, 1)',
  '--wave-curve-easy-ease': 'cubic-bezier(0.33, 0, 0.67, 1)',
  '--wave-curve-linear': 'cubic-bezier(0, 0, 1, 1)',
};

describe('motion tokens', () => {
  it("declares the 8 durations and 9 curves with Fluent's values on the :root constants", () => {
    expect(Object.keys(MOTION_TOKENS)).toHaveLength(17);
    const constants = rootConstants();
    const actual = Object.fromEntries(
      Object.keys(MOTION_TOKENS).map((name) => [name, constants.get(name)]),
    );
    expect(actual).toEqual(MOTION_TOKENS);
  });

  it('declares each variable once, never in a theme group (theme-independent)', () => {
    const source = stripComments(readCss('tokens.css'));
    for (const name of Object.keys(MOTION_TOKENS)) {
      // A declaration is the name followed by a colon (a `var(--name)` read is not one).
      expect(source.match(new RegExp(`${name}\\s*:`, 'g')), name).toHaveLength(1);
    }
    for (const theme of THEMES) {
      const motion = [...themeDecls(theme).keys()].filter((name) => name in MOTION_TOKENS);
      expect(motion).toEqual([]);
    }
  });

  it('maps each to its Tailwind utility (duration-wave-*, ease-wave-*) in @theme inline', () => {
    const decls = declarations(themeBlock().children ?? []);
    for (const name of Object.keys(MOTION_TOKENS)) {
      const duration = /^--wave-duration-(.+)$/.exec(name);
      const curve = /^--wave-curve-(.+)$/.exec(name);
      const themeName = duration
        ? `--transition-duration-wave-${duration[1]}`
        : `--ease-wave-${curve![1]}`;
      expect(decls.get(themeName), themeName).toBe(`var(${name})`);
    }
  });
});

describe('tokens.css — color-scheme (repo-level#11)', () => {
  function colorSchemeFor(selector: string): string[] {
    return styleRules(tokensNodes())
      .filter((rule) => selectorList(rule.prelude).includes(selector))
      .map((rule) => declarations(rule.children ?? []).get('color-scheme'))
      .filter((value): value is string => value !== undefined);
  }

  it('sets color-scheme on the three theme classes', () => {
    expect(colorSchemeFor('.wave-light')).toEqual(['light']);
    expect(colorSchemeFor('.wave-dark')).toEqual(['dark']);
    expect(colorSchemeFor('.wave-high-contrast')).toEqual(['dark']);
  });

  it('never sets color-scheme on :root', () => {
    expect(colorSchemeFor(':root')).toEqual([]);
  });
});

describe('tokens.css — contrast (WCAG 2.2, unrounded; button-provider#3, #10, input-basic#7, #8, data-display#15, layout#25)', () => {
  const cases = THEMES.flatMap((theme) =>
    CONTRAST_PAIRS.map(([fg, bg, threshold]) => ({ theme, fg, bg, threshold })),
  );

  it.each(cases)('$theme: $fg on $bg is at least $threshold:1', ({ theme, fg, bg, threshold }) => {
    const ratio = contrastRatio(resolved(theme, fg), resolved(theme, bg));
    expect(ratio).toBeGreaterThanOrEqual(threshold);
  });

  it.each(TABLED_RATIOS)('%s on %s matches the ratios printed in §2.1.3', (fg, bg, ratios) => {
    THEMES.forEach((theme, column) => {
      const tabled = ratios[column];
      if (tabled === null) return;
      const ratio = contrastRatio(resolved(theme, fg), resolved(theme, bg));
      expect(Math.abs(ratio - tabled)).toBeLessThanOrEqual(0.005 + 1e-9);
    });
  });

  it.each(TABLED_MINIMUMS)(
    '%s: %s on %s meets the §2.1.3 lower bound of %s:1 (unrounded)',
    (theme, fg, bg, minimum) => {
      expect(contrastRatio(resolved(theme, fg), resolved(theme, bg))).toBeGreaterThanOrEqual(
        minimum,
      );
    },
  );

  it('covers every §4.5 component combination in the threshold pairs', () => {
    const listed = new Set(CONTRAST_PAIRS.map((pair) => pair.join(' ')));
    expect(SECTION_4_5_MATRIX.filter((pair) => !listed.has(pair.join(' ')))).toEqual([]);
  });

  it('lists the pairs of the color parts: thumb edge, focus indicator and checkerboard (P3-05)', () => {
    const listed = new Map(CONTRAST_PAIRS.map(([fg, bg, threshold]) => [`${fg} ${bg}`, threshold]));
    // The thumbs' two-tone edge and their focus indicator (the ring outline around a background
    // halo) reuse pairs that other components already need.
    expect(listed.get('foreground background')).toBeGreaterThanOrEqual(3);
    expect(listed.get('ring background')).toBeGreaterThanOrEqual(3);
    // AlphaSlider's checkerboard: stroke squares on the background (muted fails in every theme).
    expect(listed.get('stroke background')).toBe(1.5);
  });

  describe('text matrix: every text token on every surface it can sit on (WCAG 1.4.3)', () => {
    const matrixCases = THEMES.flatMap((theme) =>
      TEXT_MATRIX.map(({ fg, surfaces }) => ({ theme, fg, surfaces })),
    );

    it.each(matrixCases)(
      '$theme: $fg is at least 4.5:1 on each of its surfaces',
      ({ theme, fg, surfaces }) => {
        const text = resolved(theme, fg);
        const below = surfaces
          .map((bg) => ({ bg, value: resolved(theme, bg) }))
          .map(({ bg, value }) => ({ bg, value, ratio: contrastRatio(text, value) }))
          .filter(({ ratio }) => ratio < 4.5)
          .map(({ bg, value, ratio }) => `${fg} ${text} on ${bg} ${value}: ${ratio.toFixed(3)}:1`);
        expect(below).toEqual([]);
      },
    );

    it('classifies every colour token as text, a matrix surface, or excluded with a reason', () => {
      const classified = new Set([
        ...Object.keys(SURFACE_TEXT_TOKENS),
        ...TEXT_SURFACES,
        ...Object.keys(BOUND_TEXT_SURFACES),
        ...Object.values(BOUND_TEXT_SURFACES).flat(),
        ...Object.keys(NOT_TEXT_TOKENS),
      ]);
      expect(Object.keys(TOKENS).filter((token) => !classified.has(token))).toEqual([]);
      // Nothing is both excluded and checked as text, and every name is a real token.
      const text = [...Object.keys(SURFACE_TEXT_TOKENS), ...Object.keys(BOUND_TEXT_SURFACES)];
      expect(text.filter((token) => token in NOT_TEXT_TOKENS)).toEqual([]);
      expect([...classified].filter((token) => !(token in TOKENS))).toEqual([]);
    });
  });

  it('compares unrounded: a 4.499:1 pair fails although it rounds to 4.50', () => {
    // Revision 1's dark primary (#479ef5) on card (#333333): 4.499, which only passed when rounded.
    const ratio = contrastRatio('#479ef5', '#333333');
    expect(ratio.toFixed(2)).toBe('4.50');
    expect(ratio).toBeLessThan(4.5);
  });
});

describe('tokens.css — Tailwind mapping (@theme inline)', () => {
  function themeDeclarations(): Decls {
    return declarations(themeBlock().children ?? []);
  }

  function internalDeclarations(): Decls {
    return declarations(internalThemeBlock().children ?? []);
  }

  it('uses @theme inline for the namespaced keys and @theme inline reference internally', () => {
    expect(themeBlock().prelude).toMatch(/^@theme\s+inline$/);
    // `reference`: a build with Tailwind's prefix emits none of the internal keys (spec R6).
    expect(themeBlocks('theme.css').map((node) => node.prelude)).toEqual([
      '@theme inline reference',
    ]);
  });

  it('maps every token to a --color-wave-* key for apps and a --color-* key internally', () => {
    const decls = themeDeclarations();
    const internal = internalDeclarations();
    for (const token of Object.keys(TOKENS)) {
      expect(decls.get(`--color-wave-${token}`), token).toBe(`var(--wave-${token})`);
      expect(internal.get(`--color-${token}`), token).toBe(`var(--wave-${token})`);
    }
  });

  it('exposes the brand ramp as --color-wave-brand-* (and --color-brand-* internally)', () => {
    const decls = themeDeclarations();
    const internal = internalDeclarations();
    for (const step of Object.keys(BRAND_RAMP)) {
      expect(decls.get(`--color-wave-brand-${step}`)).toBe(`var(--wave-brand-${step})`);
      expect(internal.get(`--color-brand-${step}`)).toBe(`var(--wave-brand-${step})`);
    }
  });

  it('maps font-wave to the runtime font token and keeps the type ramp and shadows', () => {
    for (const [decls, ns] of [
      [themeDeclarations(), 'wave-'],
      [internalDeclarations(), ''],
    ] as const) {
      expect(decls.get('--font-wave')).toBe('var(--wave-font-family)');
      expect(decls.get('--font-wave-mono')).toBe('var(--wave-font-family-monospace)');
      expect(decls.get('--font-wave-numeric')).toBe('var(--wave-font-family-numeric)');
      expect(decls.get(`--text-${ns}body-1`)).toBe('14px');
      expect(decls.get(`--text-${ns}body-1--line-height`)).toBe('20px');
      expect(decls.get(`--text-${ns}display`)).toBe('68px');
      for (const size of ['2', '4', '8', '16', '28', '64']) {
        expect(decls.has(`--shadow-${ns}${size}`)).toBe(true);
      }
    }
  });

  it('does not override Tailwind radius or font-sans defaults (repo-level#7, repo-level#8)', () => {
    for (const name of ['tokens.css', 'theme.css']) {
      const source = stripComments(readCss(name));
      expect(source, name).not.toMatch(/--radius/);
      expect(source, name).not.toMatch(/--font-sans/);
    }
  });

  it('declares the animation tokens (repo-level#6, repo-level#12, repo-level#13)', () => {
    const decls = themeDeclarations();
    expect(decls.get('--animate-wave-spin')).toBe('wave-spin 0.8s linear infinite');
    expect(decls.get('--animate-wave-spin-slow')).toBe('wave-spin 2.4s linear infinite');
    expect(decls.get('--animate-wave-pulse')).toBe('wave-pulse 1.5s ease-in-out infinite');
    expect(decls.get('--animate-wave-indeterminate')).toBe(
      'wave-indeterminate 1.5s ease-in-out infinite',
    );
    expect(decls.get('--animate-wave-indeterminate-rtl')).toBe(
      'wave-indeterminate-rtl 1.5s ease-in-out infinite',
    );
  });

  it('declares every keyframe inside @theme, so ./tokens and ./tailwind emit them (repo-level#6)', () => {
    const keyframes = (themeBlock().children ?? [])
      .filter((node) => node.prelude.startsWith('@keyframes'))
      .map((node) => node.prelude.replace(/^@keyframes\s+/, ''));
    expect(keyframes.sort()).toEqual(
      ['wave-indeterminate', 'wave-indeterminate-rtl', 'wave-pulse', 'wave-spin'].sort(),
    );
    const outside = tokensNodes().filter((node) => node.prelude.startsWith('@keyframes'));
    expect(outside).toEqual([]);
  });

  it('mirrors the indeterminate keyframes for RTL (repo-level#13)', () => {
    const rtl = (themeBlock().children ?? []).find(
      (node) => node.prelude === '@keyframes wave-indeterminate-rtl',
    );
    const steps = (rtl?.children ?? []).map((step) => [
      step.prelude,
      declarations(step.children ?? []).get('transform'),
    ]);
    expect(steps).toEqual([
      ['0%', 'translateX(100%)'],
      ['100%', 'translateX(-350%)'],
    ]);
  });
});

describe('the namespaced theme keys (1.0, spec R6): parity with the internal theme', () => {
  /** The prefixes of a namespaced key: the Wave namespace sits right after the theme namespace. */
  const NAMESPACED = /^--(?:color|text|shadow|font|transition-duration|ease|animate)-wave(?:-|$)/;

  /** The internal key a namespaced key stands for (`--color-wave-primary` → `--color-primary`). */
  function internalKey(key: string): string {
    return key.replace(/^--(color|text|shadow)-wave-/, '--$1-');
  }

  /** The declarations (not the keyframes) of a block. */
  function keys(block: CssNode): Decls {
    return declarations(block.children ?? []);
  }

  /** The keyframes of a block, each as its name and its serialised steps. */
  function keyframes(block: CssNode): Map<string, string> {
    const text = (nodes: CssNode[]): string =>
      nodes
        .map((node) =>
          node.children === null ? `${node.prelude};` : `${node.prelude}{${text(node.children)}}`,
        )
        .join('');
    return new Map(
      (block.children ?? [])
        .filter((node) => node.prelude.startsWith('@keyframes'))
        .map((node) => [node.prelude, text(node.children ?? [])]),
    );
  }

  it('namespaces every key apps get: --color-wave-*, --text-wave-*, --shadow-wave-* and the rest', () => {
    const plain = [...keys(themeBlock()).keys()].filter((key) => !NAMESPACED.test(key));
    expect(plain).toEqual([]);
  });

  it('maps every namespaced key one to one to an internal key, with the same value', () => {
    const namespaced = keys(themeBlock());
    const internal = keys(internalThemeBlock());
    const asInternal = new Map([...namespaced].map(([key, value]) => [internalKey(key), value]));
    expect(asInternal.size).toBe(namespaced.size);
    expect(Object.fromEntries(asInternal)).toEqual(Object.fromEntries(internal));
    // The order follows too, so the two files read side by side.
    expect([...asInternal.keys()]).toEqual([...internal.keys()]);
  });

  it('declares the same keyframes in both', () => {
    const namespaced = keyframes(themeBlock());
    expect([...namespaced.keys()]).toEqual([
      '@keyframes wave-spin',
      '@keyframes wave-pulse',
      '@keyframes wave-indeterminate',
      '@keyframes wave-indeterminate-rtl',
    ]);
    expect(Object.fromEntries(namespaced)).toEqual(
      Object.fromEntries(keyframes(internalThemeBlock())),
    );
  });

  it('reads only --wave-* tokens that tokens.css declares; the literals are the type ramp and the animations', () => {
    const declared = new Set([
      ...rootConstants().keys(),
      ...THEMES.flatMap((theme) => [...themeDecls(theme).keys()]),
    ]);
    for (const block of [themeBlock(), internalThemeBlock()]) {
      for (const [key, value] of keys(block)) {
        const read = [...value.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
        if (/^--(text|animate)-/.test(key)) {
          expect(read, key).toEqual([]);
          continue;
        }
        expect(value, key).toMatch(/^var\(--wave-[\w-]+\)$/);
        expect(
          read.filter((name) => !declared.has(name)),
          key,
        ).toEqual([]);
      }
    }
  });

  it('declares one @theme block in tokens.css, with no unnamespaced key (the transitional block went with the precompiled ./tailwind)', () => {
    // The unnamespaced keys of 0.x (`bg-primary`, `text-body-1`, `shadow-4`) are theme.css's
    // only: `./tailwind` imports the precompiled dist/components.css and generates nothing from
    // dist, so an app's Tailwind build gets the namespaced keys alone (spec R6 of Phase 14).
    expect(themeBlocks('tokens.css').map((node) => node.prelude)).toEqual(['@theme inline']);
    const plain = [
      ...declarations(themeBlocks('tokens.css').flatMap((node) => node.children ?? [])),
    ]
      .map(([key]) => key)
      .filter((key) => !NAMESPACED.test(key));
    expect(plain).toEqual([]);
    expect(stripComments(readCss('tokens.css'))).not.toMatch(/--color-background\s*:/);
  });
});

// ---------------------------------------------------------------------------------------------
// base.css, reduced motion (button-provider#2, repo-level#7, repo-level#12)
// ---------------------------------------------------------------------------------------------

describe('base.css — scoped base (button-provider#2, repo-level#7)', () => {
  function baseNodes(): CssNode[] {
    return parseFile('base.css');
  }

  it('sets font, size and colour on .wave-root and .wave-portal', () => {
    const rule = ruleWithSelectors(baseNodes(), ['.wave-root', '.wave-portal']);
    const decls = declarations(rule?.children ?? []);
    expect(decls.get('font-family')).toBe('var(--wave-font-family)');
    expect(decls.get('color')).toBe('var(--wave-foreground)');
    expect(decls.get('font-size')).toBe('14px');
    expect(decls.get('line-height')).toBe('20px');
  });

  it('paints the background on .wave-root only, never on portal wrappers', () => {
    const root = declarations(ruleWithSelectors(baseNodes(), ['.wave-root'])?.children ?? []);
    expect(root.get('background-color')).toBe('var(--wave-background)');
    const portalBackgrounds = styleRules(baseNodes())
      .filter((rule) => selectorList(rule.prelude).some((s) => /^\.wave-portal\b/.test(s)))
      .flatMap((rule) => [...declarations(rule.children ?? []).keys()])
      .filter((name) => name.startsWith('background'));
    expect(portalBackgrounds).toEqual([]);
  });

  it('scopes every rule to .wave-root / .wave-portal (no global, body or * rules)', () => {
    const selectors = styleRules(baseNodes()).flatMap((rule) => selectorList(rule.prelude));
    expect(selectors.length).toBeGreaterThan(0);
    const unscoped = selectors.filter(
      (selector) =>
        !/^\.wave-(root|portal)$/.test(selector) &&
        !selector.startsWith(':where(.wave-root, .wave-portal) '),
    );
    expect(unscoped).toEqual([]);
  });

  it('keeps pseudo-elements outside :where() (they are invalid inside it)', () => {
    const selectors = styleRules(baseNodes()).flatMap((rule) => selectorList(rule.prelude));
    expect(selectors.filter((selector) => /:where\([^)]*::/.test(selector))).toEqual([]);
    const boxSizing = styleRules(baseNodes()).find(
      (rule) => declarations(rule.children ?? []).get('box-sizing') === 'border-box',
    );
    expect(selectorList(boxSizing?.prelude ?? '')).toEqual([
      ':where(.wave-root, .wave-portal) :where(*)',
      ':where(.wave-root, .wave-portal) :where(*)::before',
      ':where(.wave-root, .wave-portal) :where(*)::after',
    ]);
    expect(declarations(boxSizing?.children ?? []).get('border-color')).toBe('var(--wave-border)');
  });

  /** Every rule of §2.1.6, with its exact declarations: selector list → declarations. */
  const SCOPE = ':where(.wave-root, .wave-portal)';
  const BASE_RULES: Array<[string[], Record<string, string>]> = [
    [
      ['.wave-root', '.wave-portal'],
      {
        'font-family': 'var(--wave-font-family)',
        color: 'var(--wave-foreground)',
        'font-size': '14px',
        'line-height': '20px',
        '-webkit-font-smoothing': 'antialiased',
        '-moz-osx-font-smoothing': 'grayscale',
      },
    ],
    [['.wave-root'], { 'background-color': 'var(--wave-background)' }],
    [
      [`${SCOPE} :where(*)`, `${SCOPE} :where(*)::before`, `${SCOPE} :where(*)::after`],
      { 'box-sizing': 'border-box', 'border-color': 'var(--wave-border)' },
    ],
    // Native-element reset (C-NATIVE).
    [
      [`${SCOPE} :where(button, input, select, textarea)`],
      {
        font: 'inherit',
        color: 'inherit',
        'letter-spacing': 'inherit',
        margin: '0',
        padding: '0',
        border: '0 solid',
        'background-color': 'transparent',
      },
    ],
    [[`${SCOPE} :where(button, [role="button"])`], { cursor: 'pointer' }],
    [[`${SCOPE} :where(ul, ol)`], { 'list-style': 'none', margin: '0', padding: '0' }],
    [[`${SCOPE} :where(h1, h2, h3, h4, h5, h6, p, figure, blockquote, dl, dd)`], { margin: '0' }],
    [
      [`${SCOPE} :where(h1, h2, h3, h4, h5, h6)`],
      { 'font-size': 'inherit', 'font-weight': 'inherit' },
    ],
    [[`${SCOPE} :where(fieldset)`], { margin: '0', padding: '0', border: '0', 'min-width': '0' }],
    [[`${SCOPE} :where(legend)`], { padding: '0' }],
    [[`${SCOPE} :where(table)`], { 'border-collapse': 'collapse', 'text-indent': '0' }],
    [
      [`${SCOPE} :where(hr)`],
      { height: '0', border: '0 solid', 'border-top-width': '1px', color: 'inherit', margin: '0' },
    ],
    [[`${SCOPE} :where(img, svg, video)`], { 'vertical-align': 'middle' }],
    // Preflight's `hidden` rule: without it a component's display utility (`inline-flex`) beats
    // the user-agent `[hidden] { display: none }` rule, and `hidden` does nothing.
    [[`${SCOPE} :where([hidden]:not([hidden='until-found']))`], { display: 'none !important' }],
  ];

  it.each(
    BASE_RULES.map(([selectors, decls]) => [selectors.join(', '), selectors, decls] as const),
  )('declares exactly the §2.1.6 declarations on %s (C-NATIVE)', (_, selectors, expected) => {
    const rule = ruleWithSelectors(baseNodes(), selectors);
    expect(rule, 'rule is missing').toBeDefined();
    expect(Object.fromEntries(declarations(rule?.children ?? []))).toEqual(expected);
  });

  it('has no rule beyond the §2.1.6 list', () => {
    const wanted = BASE_RULES.map(([selectors]) =>
      selectors.map(normalizeSelector).sort().join('|'),
    );
    const actual = styleRules(baseNodes()).map((rule) =>
      selectorList(rule.prelude).sort().join('|'),
    );
    expect(actual.sort()).toEqual([...wanted].sort());
  });

  it('is unlayered and has no global reduced-motion override', () => {
    const source = stripComments(readCss('base.css'));
    expect(source).not.toMatch(/@layer/);
    expect(source).not.toMatch(/prefers-reduced-motion/);
  });

  it('uses !important only to let the hidden attribute beat display utilities', () => {
    const important = styleRules(baseNodes()).flatMap((rule) =>
      [...declarations(rule.children ?? [])]
        .filter(([, value]) => value.includes('!important'))
        .map(([name]) => `${selectorList(rule.prelude).join(', ')} { ${name} }`),
    );
    expect(important).toEqual([
      ":where(.wave-root, .wave-portal) :where([hidden]:not([hidden='until-found'])) { display }",
    ]);
  });
});

describe('reduced motion (repo-level#12)', () => {
  it('no style entry carries a global `*` reduced-motion reset', () => {
    expect(CSS_FILE_NAMES).toContain('tokens.css');
    for (const name of CSS_FILE_NAMES) {
      expect(stripComments(readCss(name)), name).not.toMatch(/prefers-reduced-motion/);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Entries (repo-level#1, repo-level#7)
// ---------------------------------------------------------------------------------------------

function statements(name: string): string[] {
  return parseFile(name)
    .filter((node) => node.children === null)
    .map((node) => node.prelude.replace(/\s+/g, ' ').replace(/"/g, "'"));
}

/**
 * styles.css as an unprefixed project writes it, 0.x's form: the real file without Wave's utility
 * prefix. The fixtures of the prefix-independent assertions use it (a fixture project without
 * src/lib/cn.ts runs none of the prefix gates); the real entries are compiled prefixed below.
 */
function unprefixedStylesCss(): string {
  const css = readCss('styles.css');
  if (css.split(' prefix(wave)').length !== 2)
    throw new Error('styles.css: no single prefix(wave)');
  return css.replace(' prefix(wave)', '').replaceAll('wave:', '');
}

/**
 * Tailwind utilities that no component uses as a class, but whose names occur in the library
 * sources as words of comments, identifiers or non-class strings. Through 0.x styles.css excluded
 * them (`@source not inline()`), so the unlayered precompiled file never restyled an app's own
 * `.collapse`, `.container` or `.table`; with Wave's utility prefix (1.0) no unprefixed word
 * generates, and none of them ships in either form.
 */
const EXCLUDED_WORDS = [
  'blur',
  'collapse',
  'container',
  'end',
  'filter',
  'hover:bg-error!',
  'inline',
  'list-item',
  'lowercase',
  'not-disabled:not-aria-disabled:hover:bg-error',
  'outline',
  'ring',
  'select-all',
  'shadow',
  'sm:inline',
  'start',
  'static',
  'table',
  'text-input',
  'transform',
  'visible',
];

describe('style entries (repo-level#1)', () => {
  it('styles.css builds the unlayered, prefixed precompiled CSS with pinned sources, utilities last', () => {
    expect(statements('styles.css')).toEqual([
      "@import 'tailwindcss/theme.css' theme(inline) prefix(wave)",
      "@import './theme.css'",
      "@import './tokens.css'",
      "@import './base.css'",
      "@import './variants.css'",
      "@import 'tailwindcss/utilities.css' source(none)",
      "@source '../components'",
      "@source '../lib'",
      "@source not '../components/**/__tests__'",
      "@source not '../lib/**/__tests__'",
      "@source inline('wave:animate-wave-spin wave:animate-wave-spin-slow wave:animate-wave-pulse wave:animate-wave-indeterminate wave:animate-wave-indeterminate-rtl')",
    ]);
    expect(parseFile('styles.css').filter((node) => node.children !== null)).toEqual([]);
    expect(readCss('styles.css')).not.toMatch(/layer\(/);
  });

  it('theme.css is internal: only the build input styles.css imports it, no export names it', () => {
    const importers = CSS_FILE_NAMES.filter((name) =>
      statements(name).some((statement) => /^@import '\.\/theme\.css'/.test(statement)),
    );
    expect(importers).toEqual(['styles.css']);
    expect(statements('theme.css')).toEqual([]);
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };
    const targets = Object.entries(manifest.exports).flatMap(([subpath, target]) => [
      subpath,
      ...(typeof target === 'string' ? [target] : Object.values(target as object).map(String)),
    ]);
    expect(targets.filter((value) => value.includes('theme.css'))).toEqual([]);
  });

  it('tailwind.css declares the layer order, layers tokens, base and the precompiled utilities, defines wave-rtl and scans nothing', () => {
    // The corrected form of spec §6, Task 1 (Phase 14): tokens in `theme` and base in `base`, so
    // an app's layered token overrides and `@layer base` element styles win over Wave's, and the
    // components' precompiled utilities alone (dist/components.css) in `components`.
    expect(statements('tailwind.css')).toEqual([
      '@layer theme, base, components, utilities',
      "@import './tokens.css' layer(theme)",
      "@import './base.css' layer(base)",
      "@import './variants.css'",
      "@import '../../dist/components.css' layer(components)",
    ]);
    expect(parseFile('tailwind.css').filter((node) => node.children !== null)).toEqual([]);
    expect(stripComments(readCss('tailwind.css'))).not.toMatch(/@source/);
  });

  it('utilities.css is the build input of dist/utilities.css: the token keys as a reference, Tailwind utilities unlayered, no sources', () => {
    // scripts/build-css.mjs appends the `@source inline()` list it generates from tokens.css.
    // Unlayered (ruling BL): a layered class would lose to the base styles of styles.css.
    expect(statements('utilities.css')).toEqual([
      "@import './tokens.css' reference",
      "@import 'tailwindcss/utilities.css' source(none)",
    ]);
    expect(parseFile('utilities.css').filter((node) => node.children !== null)).toEqual([]);
  });

  it('preflight.css is an opt-in, unlayered Preflight entry', () => {
    expect(statements('preflight.css')).toEqual(["@import 'tailwindcss/preflight.css'"]);
  });

  it('globals.css is the dev entry mirroring the Tailwind consumer path', () => {
    // For the app's own classes: an unprefixed build compiles none of the components' prefixed
    // classes, so it imports no internal theme.css (its keys would give the app `bg-primary`).
    expect(statements('globals.css')).toEqual([
      "@import 'tailwindcss'",
      "@import './tokens.css' layer(theme)",
      "@import './base.css' layer(base)",
      "@import './variants.css'",
    ]);
    expect(parseFile('globals.css').filter((node) => node.children !== null)).toEqual([]);
  });

  it('variants.css defines wave-rtl by the element direction, with the [dir] fallback (C-LOGICAL)', () => {
    // `:dir(rtl)` follows the element's own direction, so an LTR subtree of an RTL page is not
    // mirrored; browsers without `:dir()` (Chrome and Edge before 120) get Tailwind's attribute
    // match. `:nth-child(n of S)` matches exactly the elements S matches; there, Lightning CSS
    // (Vite's default CSS minifier) keeps `:dir(rtl)` instead of rewriting it to a `:lang()` list
    // for targets below Chrome 120 (scripts/__tests__/pack-smoke.test.mjs builds it with Vite).
    // Tailwind's own `rtl` variant is never redefined.
    expect(parseFile('variants.css')).toEqual([
      {
        prelude: '@custom-variant wave-rtl',
        children: [
          {
            prelude: '@supports selector(:nth-child(n of :dir(rtl)))',
            children: [
              {
                prelude: '&:where(:nth-child(n of :dir(rtl)))',
                children: [{ prelude: '@slot', children: null }],
              },
            ],
          },
          {
            prelude: '@supports not selector(:nth-child(n of :dir(rtl)))',
            children: [
              {
                prelude: "&:where([dir='rtl'], [dir='rtl'] *)",
                children: [{ prelude: '@slot', children: null }],
              },
            ],
          },
        ],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// scripts/build-css.mjs — the dist gate's own assertions (repo-level#1)
// ---------------------------------------------------------------------------------------------

interface SourceText {
  content: string;
  extension: string;
}

/** A Tailwind scanner source, as an `@source` directive registers it. */
interface SourceEntry {
  base: string;
  pattern: string;
  negated: boolean;
}

interface StorySources {
  stories: (SourceText | SourceEntry)[];
  library: (SourceText | SourceEntry)[];
  /** Extra library class names (the style entries' `@source inline()` and selector classes). */
  libraryClasses?: Iterable<string>;
}

interface StyleEntries {
  stylesCss: string;
  tokensCss: string;
  baseCss: string;
}

/** The part of scripts/build-css.mjs these tests use (a plain `.mjs` module without typings). */
interface BuildCss {
  assertStylesCss(
    css: string,
    options: { tokensCss: string; baseCss: string; storySources?: StorySources },
  ): string[];
  assertPreflightCss(css: string): string[];
  assertComponentsCss(
    css: string,
    options: { stylesCss?: string; tokensCss: string; baseCss: string },
  ): string[];
  assertUtilitiesCss(
    css: string,
    options: { tokensCss: string; baseCss?: string; stylesCss?: string },
  ): string[];
  componentsSource(stylesCss: string): string;
  namespacedUtilities(tokensCss: string): string[];
  utilitiesSource(utilitiesCss: string, tokensCss: string): string;
  OUTPUTS: string[];
  parseCss(css: string): CssNode[];
  selectorClasses(css: string): Set<string>;
  selectorList(prelude: string): string[];
  expandBraces(pattern: string): string[];
  styleEntryClasses(entries: StyleEntries): Set<string>;
  sourceEntries(css: string, base: string): SourceEntry[];
  storyOnlyClasses(css: string, sources: StorySources): string[];
  classStringTokens(sources: (SourceText | SourceEntry)[]): Set<string>;
  strayClasses(css: string, sources: Omit<StorySources, 'stories'>): string[];
  missingDirectionVariant(css: string, classes: Iterable<string>): string[];
  loweredDirectionClasses(css: string): string[];
  collectStorySources(projectRoot: string): Required<StorySources>;
  main(argv: string[], options?: { projectRoot?: string }): number;
}

/** The entry-script guard every gate script starts through (scripts/verify-dist.mjs). */
interface EntryGuard {
  entryStatus(metaUrl: string, argv1: string | undefined): 'main' | 'mismatch' | 'imported';
}

const BUILD_CSS_PATH = join(import.meta.dirname, '..', '..', '..', 'scripts', 'build-css.mjs');

async function loadBuildCss(): Promise<BuildCss> {
  // A computed specifier: the module has no type declarations, the interface above types it.
  return (await import(/* @vite-ignore */ pathToFileURL(BUILD_CSS_PATH).href)) as BuildCss;
}

const VERIFY_DIST_PATH = join(dirname(BUILD_CSS_PATH), 'verify-dist.mjs');

async function loadEntryGuard(): Promise<EntryGuard> {
  return (await import(/* @vite-ignore */ pathToFileURL(VERIFY_DIST_PATH).href)) as EntryGuard;
}

/**
 * The report of a passing build-css run whose outputs are in `dir` (a regular expression source:
 * `'dist'`, or `String.raw\`\S+\`` for any directory): every output with its size, in order. With
 * `compileCheckPassed` (a project whose src/lib/cn.ts sets `UTILITY_PREFIX` to `wave`: this
 * repository, or the copy of the real style entries), the line of the passed compile check comes
 * first; a fixture project without src/lib/cn.ts prints none.
 */
function passingReport(dir: string, { compileCheckPassed = false } = {}): RegExp {
  const file = (name: string) => `${dir}\\/${name.replace('.', '\\.')} \\([\\d.]+ kB\\)`;
  const check = compileCheckPassed
    ? 'build-css: compile check passed \\(prefix wave: \\d+ class words in \\d+ files, ' +
      '\\d+ allowlisted pairs\\)\\n'
    : '';
  return new RegExp(
    `^${check}build-css: ${file('styles.css')}, ${file('components.css')}, ` +
      `${file('utilities.css')} and ${file('preflight.css')} OK$`,
  );
}

type Specificity = [number, number, number];

/**
 * The specificity of one complex selector (Selectors Level 4): `:where()` counts nothing, `:is()`,
 * `:not()` and `:has()` their most specific argument, any other functional pseudo-class one class
 * (its argument ignored), and the legacy one-colon pseudo-elements a minifier writes
 * (`:before`) an element.
 */
function specificity(selector: string): Specificity {
  let text = selector.replace(/\\./g, 'x');
  const total: Specificity = [0, 0, 0];
  const add = ([a, b, c]: Specificity) => {
    total[0] += a;
    total[1] += b;
    total[2] += c;
  };
  for (let match = /::?([\w-]+)\(/.exec(text); match; match = /::?([\w-]+)\(/.exec(text)) {
    let end = match.index + match[0].length;
    for (let depth = 1; depth > 0; end++) {
      if (text[end] === '(') depth++;
      else if (text[end] === ')') depth--;
    }
    const name = match[1];
    if (['is', 'not', 'has'].includes(name)) {
      const args = selectorList(text.slice(match.index + match[0].length, end - 1));
      add(args.map(specificity).reduce((a, b) => (compareSpecificity(a, b) >= 0 ? a : b)));
    } else if (name !== 'where') {
      add(match[0].startsWith('::') ? [0, 0, 1] : [0, 1, 0]);
    }
    text = text.slice(0, match.index) + text.slice(end);
  }
  for (const [token] of text.matchAll(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+|[a-z][\w-]*/gi)) {
    if (token.startsWith('#')) add([1, 0, 0]);
    else if (token.startsWith('.') || token.startsWith('[')) add([0, 1, 0]);
    else if (token.startsWith('::')) add([0, 0, 1]);
    else if (token.startsWith(':')) {
      add(/^:(before|after|first-line|first-letter)$/.test(token) ? [0, 0, 1] : [0, 1, 0]);
    } else add([0, 0, 1]);
  }
  return total;
}

function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * A utilities.css that passes the gate for `tokensCss`: every class `namespacedUtilities`
 * generates, unlayered, with Tailwind's `properties` fallback and the keyframes of tokens.css's
 * `@theme` block.
 */
async function utilitiesCssFor(tokensCss: string): Promise<string> {
  const { namespacedUtilities, parseCss } = await loadBuildCss();
  const text = (nodes: CssNode[]): string =>
    nodes
      .map((node) =>
        node.children === null ? `${node.prelude};` : `${node.prelude}{${text(node.children)}}`,
      )
      .join('');
  const keyframes = parseCss(tokensCss)
    .filter((node) => /^@theme\b/.test(node.prelude))
    .flatMap((node) => node.children ?? [])
    .filter((node) => node.prelude.startsWith('@keyframes'));
  return (
    '@layer properties{@supports ((-webkit-hyphens:none)){*,:before,:after{--tw-ring-color:initial}}}' +
    namespacedUtilities(tokensCss)
      .map((name) => `.${name}{color:red}`)
      .join('') +
    '@property --tw-ring-color{syntax:"*";inherits:false}' +
    text(keyframes)
  );
}

describe('scripts/build-css.mjs — gate assertions (repo-level#1)', () => {
  const GATE_TOKENS = [
    ':root, .wave-light { --wave-primary: #0f6cbd; --wave-foreground: #242424; }',
    '.wave-light { color-scheme: light; }',
    '@theme inline { --color-primary: var(--wave-primary); }',
  ].join('\n');
  const GATE_BASE = [
    '.wave-root, .wave-portal { color: var(--wave-foreground); }',
    '.wave-root { background-color: var(--wave-background); }',
    ":where(.wave-root, .wave-portal) :where(button, [role='button']) { cursor: pointer; }",
    ':where(.wave-root, .wave-portal) :where(ul, ol) { list-style: none; margin: 0; }',
    ":where(.wave-root, .wave-portal) :where([hidden]:not([hidden='until-found'])) { display: none !important; }",
  ].join('\n');
  const UTILITIES = [
    '.bg-primary{background-color:var(--wave-primary)}',
    '.text-body-1{font-size:14px;line-height:20px}',
    ...['spin', 'spin-slow', 'pulse', 'indeterminate', 'indeterminate-rtl'].map(
      (name) => `.animate-wave-${name}{animation:var(--animate-wave-${name})}`,
    ),
    // The representatives of the motion recipes (lib/motion, 0.15).
    '.duration-wave-gentle{--tw-duration:var(--wave-duration-gentle);transition-duration:var(--wave-duration-gentle)}',
    String.raw`.data-\[presence\=exiting\]\:opacity-0[data-presence=exiting]{opacity:0}`,
    String.raw`.data-\[presence\=entered\]\:contents[data-presence=entered]{display:contents}`,
  ];
  /** The library class string that uses the motion representatives of {@link UTILITIES}. */
  const MOTION_CLASSES =
    'duration-wave-gentle data-[presence=exiting]:opacity-0 data-[presence=entered]:contents';
  const KEYFRAMES = ['wave-spin', 'wave-pulse', 'wave-indeterminate', 'wave-indeterminate-rtl'].map(
    (name) => `@keyframes ${name}{to{opacity:1}}`,
  );
  /** A minified stylesheet shaped like the Tailwind CLI output, satisfying every assertion. */
  const GATE_CSS = [
    '@layer properties{@supports ((-webkit-hyphens:none)){*,:before,:after{--tw-x:0}}}',
    ':root,.wave-light{--wave-primary:#0f6cbd;--wave-foreground:#242424}',
    '.wave-light{color-scheme:light}',
    '.wave-root,.wave-portal{color:var(--wave-foreground)}',
    '.wave-root{background-color:var(--wave-background)}',
    ':where(.wave-root,.wave-portal) :where(button,[role=button]){cursor:pointer}',
    ':where(.wave-root,.wave-portal) :where(ul,ol){list-style:none;margin:0}',
    ':where(.wave-root,.wave-portal) :where([hidden]:not([hidden=until-found])){display:none!important}',
    ...UTILITIES,
    ...KEYFRAMES,
  ].join('');

  async function gate(css: string, storySources?: StorySources): Promise<string[]> {
    const { assertStylesCss } = await loadBuildCss();
    return assertStylesCss(css, { tokensCss: GATE_TOKENS, baseCss: GATE_BASE, storySources });
  }

  it('passes a stylesheet that satisfies every assertion', async () => {
    expect(await gate(GATE_CSS)).toEqual([]);
  });

  it('fails on a rule of the theme classes 1.0 removed (.dark, .high-contrast)', async () => {
    const removed = ':where(.dark,.high-contrast) .wave-light{--wave-primary:#0f6cbd}';
    expect(await gate(GATE_CSS + removed)).toEqual([
      'styles.css: selects the theme classes 1.0 removed (.dark, .high-contrast); the themes are ' +
        '.wave-light, .wave-dark and .wave-high-contrast',
    ]);
    // The wave-* classes, and Tailwind's media-based dark variant, are not those classes.
    const kept = String.raw`.wave-dark{color-scheme:dark}@media (prefers-color-scheme:dark){.dark\:bg-primary{background-color:var(--wave-primary)}}`;
    expect(await gate(GATE_CSS + kept)).toEqual([]);
  });

  describe('escaped characters in class names', () => {
    // Tailwind escapes the quotes of `after:content-['*']` and `data-[state='open']:…`; an escaped
    // quote outside a string must not open one (it would swallow every rule after it).
    const ESCAPED_QUOTES = [
      String.raw`.after\:content-\[\'\*\'\]:after{--tw-content:"*";content:var(--tw-content)}`,
      String.raw`.data-\[state\=\'open\'\]\:bg-primary[data-state=open]{background-color:var(--wave-primary)}`,
    ].join('');

    it('keeps parsing the rules after a class with escaped quotes', async () => {
      const css = GATE_CSS.replace(UTILITIES[0], `${ESCAPED_QUOTES}${UTILITIES[0]}`);
      expect(await gate(css)).toEqual([]);
      const { selectorClasses } = await loadBuildCss();
      expect([...selectorClasses(css)]).toEqual(
        expect.arrayContaining([
          "after:content-['*']",
          "data-[state='open']:bg-primary",
          'bg-primary',
          'animate-wave-indeterminate-rtl',
        ]),
      );
    });

    it('keeps parsing the rules after a string with an escaped quote and a brace', async () => {
      // The escaped quote does not close the string, so its `}` does not close the rule.
      const css = GATE_CSS.replace(
        UTILITIES[0],
        String.raw`.x{--tw-content:"a\"}b"}${UTILITIES[0]}`,
      );
      expect(await gate(css)).toEqual([]);
      const { selectorClasses } = await loadBuildCss();
      expect([...selectorClasses(css)]).toEqual(
        expect.arrayContaining(['x', 'bg-primary', 'animate-wave-indeterminate-rtl']),
      );
    });

    it('splits selector lists after escaped brackets, parentheses and quoted strings', async () => {
      const { selectorList } = await loadBuildCss();
      expect(
        selectorList(
          String.raw`.content-\[\'\(\'\]:after,.wave-root,[title=")"],.a\,b,.wave-portal`,
        ),
      ).toEqual([
        String.raw`.content-\[\'\(\'\]:after`,
        '.wave-root',
        '[title=")"]',
        String.raw`.a\,b`,
        '.wave-portal',
      ]);
      const grouped = GATE_CSS.replace(
        '.wave-root,.wave-portal{color:',
        String.raw`.content-\[\'\(\'\]:after,.wave-root,.wave-portal{color:`,
      );
      expect(await gate(grouped)).toEqual([]);
    });

    it('reads no class names out of quoted strings or keyframe selectors', async () => {
      const { selectorClasses } = await loadBuildCss();
      const css = `[href$='.pdf'],.x[title=".y"]{color:red}@keyframes k{33.3%{opacity:1}}`;
      expect([...selectorClasses(css)]).toEqual(['x']);
    });
  });

  it('rejects layered output other than the `properties` fallback', async () => {
    const layered = GATE_CSS.replace(UTILITIES[0], `@layer utilities{${UTILITIES[0]}}`);
    expect(await gate(layered)).toContainEqual(expect.stringMatching(/layered output.*utilities/));
    const statement = `@layer theme,base,components,utilities;${GATE_CSS}`;
    expect(await gate(statement)).toContainEqual(expect.stringMatching(/layered output.*theme/));
  });

  it('rejects an unprocessed Tailwind directive or @import', async () => {
    expect(await gate(`@import "tailwindcss";${GATE_CSS}`)).toContainEqual(
      expect.stringMatching(/unprocessed directive "@import/),
    );
    expect(await gate(`${GATE_CSS}.x{@apply flex}`)).toContainEqual(
      expect.stringMatching(/unprocessed directive "@apply/),
    );
  });

  it('rejects a missing keyframe or animate-wave-* utility', async () => {
    expect(await gate(GATE_CSS.replace(KEYFRAMES[1], ''))).toEqual([
      'styles.css: missing @keyframes wave-pulse',
    ]);
    expect(await gate(GATE_CSS.replace(UTILITIES[3], ''))).toEqual([
      'styles.css: missing utility .animate-wave-spin-slow',
    ]);
  });

  it('rejects a stylesheet without the motion recipes’ representatives (lib/motion)', async () => {
    const [duration, exit, entered] = UTILITIES.slice(-3);
    expect(
      await gate(GATE_CSS.replace(duration, '').replace(exit, '').replace(entered, '')),
    ).toEqual([
      'styles.css: missing utility .duration-wave-gentle',
      'styles.css: missing utility .data-[presence=exiting]:opacity-0',
      'styles.css: missing utility .data-[presence=entered]:contents',
    ]);
  });

  it('rejects a .wave-portal rule that paints a background', async () => {
    const painted = `${GATE_CSS}.wave-portal{background:var(--wave-background)}`;
    expect(await gate(painted)).toEqual(['styles.css: .wave-portal paints a background']);
  });

  it.each([
    [':root{--spacing:.25rem}', '--spacing:'],
    [':root{--font-sans:ui-sans-serif}', '--font-sans:'],
    [':root{--color-red-500:oklch(63.7% .237 25.331)}', '--color-red-500'],
    [':root{--radius-lg:.5rem}', '--radius-'],
  ])('rejects the leaked Tailwind theme variable in %s', async (leak, needle) => {
    expect(await gate(`${leak}${GATE_CSS}`)).toEqual([`styles.css: contains "${needle}"`]);
  });

  it('rejects a missing base rule, a missing property, a lost !important and a missing --wave-* variable', async () => {
    const withoutRule = GATE_CSS.replace(
      ':where(.wave-root,.wave-portal) :where(ul,ol){list-style:none;margin:0}',
      '',
    );
    expect(await gate(withoutRule)).toEqual([
      'styles.css: missing rule ":where(.wave-root,.wave-portal) :where(ul,ol)" from base.css',
    ]);
    const withoutProperty = GATE_CSS.replace('{list-style:none;margin:0}', '{margin:0}');
    expect(await gate(withoutProperty)).toEqual([
      'styles.css: ":where(.wave-root,.wave-portal) :where(ul,ol)" (base.css) lacks list-style',
    ]);
    const withoutImportant = GATE_CSS.replace('{display:none!important}', '{display:none}');
    expect(await gate(withoutImportant)).toEqual([
      'styles.css: ":where(.wave-root,.wave-portal) :where([hidden]:not([hidden=until-found]))" (base.css) lacks !important on display',
    ]);
    const withoutVar = GATE_CSS.replace(';--wave-foreground:#242424', '');
    expect(await gate(withoutVar)).toEqual([
      'styles.css: ":root" (tokens.css) lacks --wave-foreground',
      'styles.css: ".wave-light" (tokens.css) lacks --wave-foreground',
      'styles.css: missing --wave-foreground',
    ]);
  });

  describe('story-only classes', () => {
    const CSS = '.w-1{width:4px}.w-10{width:40px}.opacity-5{opacity:.05}.opacity-50{opacity:.5}';
    const library: SourceText[] = [
      { content: "export const x = cn('w-10', { 'opacity-50': on });", extension: 'ts' },
    ];

    it('reports a story-only class that is a substring of a library class', async () => {
      const { storyOnlyClasses } = await loadBuildCss();
      const stories: SourceText[] = [
        { content: '<div className="w-1 opacity-5 w-10 opacity-50" />', extension: 'tsx' },
      ];
      expect(storyOnlyClasses(CSS, { stories, library })).toEqual(['opacity-5', 'w-1']);
    });

    it('ignores story classes the library also uses and story classes absent from dist', async () => {
      const { storyOnlyClasses } = await loadBuildCss();
      const stories: SourceText[] = [
        { content: '<div className="w-10 opacity-50 w-96" />', extension: 'tsx' },
      ];
      expect(storyOnlyClasses(CSS, { stories, library })).toEqual([]);
    });

    it('extracts variant and arbitrary-variant candidates the way Tailwind does', async () => {
      const { storyOnlyClasses } = await loadBuildCss();
      const css = String.raw`.hover\:w-1:hover{width:4px}.\[\&\>svg\]\:size-4>svg{width:16px}`;
      const stories: SourceText[] = [
        { content: '<b className="hover:w-1 [&>svg]:size-4" />', extension: 'tsx' },
      ];
      expect(storyOnlyClasses(css, { stories, library })).toEqual(['[&>svg]:size-4', 'hover:w-1']);
      const both: SourceText[] = [
        ...library,
        { content: "cn('hover:w-1', '[&>svg]:size-4')", extension: 'ts' },
      ];
      expect(storyOnlyClasses(css, { stories, library: both })).toEqual([]);
    });

    it('fails the gate when a story-only class shipped', async () => {
      const { selectorClasses } = await loadBuildCss();
      const css = `${GATE_CSS}.w-1{width:4px}.w-10{width:40px}`;
      const stories: SourceText[] = [{ content: '<i className="w-1 w-10" />', extension: 'tsx' }];
      // Every class of the passing stylesheet counts as a library class here.
      const libraryClasses = selectorClasses(GATE_CSS);
      expect(await gate(css, { stories, library, libraryClasses })).toEqual([
        'styles.css: contains story-only classes: w-1',
      ]);
    });

    it('treats the given library class names as library candidates', async () => {
      const { storyOnlyClasses } = await loadBuildCss();
      const stories: SourceText[] = [
        { content: '<i className="w-1 opacity-5" />', extension: 'tsx' },
      ];
      expect(storyOnlyClasses(CSS, { stories, library, libraryClasses: ['w-1'] })).toEqual([
        'opacity-5',
      ]);
    });

    it('fails the gate on a story-only class that a style entry only names in a comment', async () => {
      // tokens.css names the motion-reduce:* classes in a comment; that must not exempt them.
      const { styleEntryClasses } = await loadBuildCss();
      const libraryClasses = styleEntryClasses({
        stylesCss: unprefixedStylesCss(),
        tokensCss: readCss('tokens.css'),
        baseCss: readCss('base.css'),
      });
      const css =
        `${GATE_CSS}.wave-dark{color-scheme:dark}` +
        String.raw`@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}`;
      const stories: SourceText[] = [
        { content: '<i className="motion-reduce:animate-none wave-dark" />', extension: 'tsx' },
      ];
      const utilities: SourceText[] = [
        { content: "cn('bg-primary text-body-1')", extension: 'ts' },
        { content: `const fade = '${MOTION_CLASSES}';`, extension: 'ts' },
      ];
      expect(await gate(css, { stories, library: utilities, libraryClasses })).toEqual([
        'styles.css: contains story-only classes: motion-reduce:animate-none',
      ]);
    });
  });

  describe('classes that no library class string uses', () => {
    const COMPONENT = [
      '/** Keeps its container; mirror the chevron with `rtl:-scale-x-100`. */',
      "const visible = items.filter((item) => item.visibility !== 'collapse');",
      "window.addEventListener('blur', onBlur);",
      "export const box = cn('flex p-4', open && `bg-primary ${tone}`);",
      'export const el = <i className="w-10 hover:bg-primary" data-x={`size-4 ${a} h-2`}>shadow</i>;',
    ].join('\n');
    const TOKENS = [
      'bg-primary',
      'blur',
      'collapse',
      'flex',
      'h-2',
      'hover:bg-primary',
      'p-4',
      'size-4',
      'w-10',
    ];

    it('takes the words of string literals, never of comments, identifiers or JSX text', async () => {
      const { classStringTokens } = await loadBuildCss();
      expect([...classStringTokens([{ content: COMPONENT, extension: 'tsx' }])].sort()).toEqual(
        TOKENS,
      );
    });

    it('reads no class string out of a file that is not JavaScript or TypeScript', async () => {
      const { classStringTokens } = await loadBuildCss();
      const notes: SourceText = { content: "Pads a card with 'w-96'.", extension: 'md' };
      expect([...classStringTokens([notes])]).toEqual([]);
    });

    it('reports shipped classes that only comments, identifiers or other files name', async () => {
      const { strayClasses } = await loadBuildCss();
      const css =
        '.flex{display:flex}.p-4{padding:1rem}.container{width:100%}.visible{visibility:visible}' +
        '.shadow{box-shadow:0 0 1px}.w-96{width:24rem}.wave-dark{color-scheme:dark}' +
        // A word of a non-class string cannot be told apart from a class: styles.css excludes
        // such words (`@source not inline()`), this check does not catch them.
        '.collapse{visibility:collapse}';
      const library: SourceText[] = [
        { content: COMPONENT, extension: 'tsx' },
        { content: 'Pads a card with `w-96`.', extension: 'md' },
      ];
      expect(strayClasses(css, { library, libraryClasses: ['wave-dark'] })).toEqual([
        'container',
        'shadow',
        'visible',
        'w-96',
      ]);
    });

    it('fails the gate on a shipped class that only a comment names', async () => {
      const { selectorClasses } = await loadBuildCss();
      const css = `${GATE_CSS}.container{width:100%}.w-10{width:40px}`;
      const library: SourceText[] = [
        { content: "/* keeps its container */ cn('w-10')", extension: 'ts' },
      ];
      expect(
        await gate(css, { stories: [], library, libraryClasses: selectorClasses(GATE_CSS) }),
      ).toEqual([
        'styles.css: contains classes that no class string of src/components or src/lib uses ' +
          '(words of comments, identifiers or other files; exclude them in src/styles/styles.css ' +
          'with @source not inline()): container',
      ]);
    });
  });

  describe('the wave-rtl direction variant (C-LOGICAL)', () => {
    const NATIVE = String.raw`@supports selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:-1 1}}`;
    const FALLBACK = String.raw`@supports not selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}}`;
    /** The same class as Lightning CSS rewrites `:dir(rtl)` for targets below Chrome 120. */
    const LOWERED = String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:is(:lang(ae),:lang(ar),:lang(he),:lang(yi))){scale:-1 1}}`;

    it('accepts a class compiled for :dir(rtl) and for the [dir=rtl] fallback', async () => {
      const { missingDirectionVariant } = await loadBuildCss();
      expect(missingDirectionVariant(NATIVE + FALLBACK, ['wave-rtl:-scale-x-100'])).toEqual([]);
    });

    it('accepts the variant as esbuild and cssnano print it (no space before :dir)', async () => {
      const { missingDirectionVariant } = await loadBuildCss();
      const minified = (NATIVE + FALLBACK).replaceAll('n of :dir', 'n of:dir');
      expect(minified).not.toContain('n of :dir');
      expect(missingDirectionVariant(minified, ['wave-rtl:-scale-x-100'])).toEqual([]);
    });

    it('reads the nested rules of an unminified build', async () => {
      const { missingDirectionVariant } = await loadBuildCss();
      const nested = String.raw`
        .group-hover\:wave-rtl\:ms-3 {
          &:is(:where(.group):hover *) {
            @supports selector(:nth-child(n of :dir(rtl))) {
              &:where(:nth-child(n of :dir(rtl))) { margin-inline-start: .75rem; }
            }
            @supports not selector(:nth-child(n of :dir(rtl))) {
              &:where([dir="rtl"], [dir="rtl"] *) { margin-inline-start: .75rem; }
            }
          }
        }`;
      expect(missingDirectionVariant(nested, ['group-hover:wave-rtl:ms-3'])).toEqual([]);
    });

    it('reports a class without either form, and one compiled like Tailwind rtl:', async () => {
      const { missingDirectionVariant } = await loadBuildCss();
      const name = 'wave-rtl:-scale-x-100';
      expect(missingDirectionVariant(NATIVE, [name])).toEqual([name]);
      expect(missingDirectionVariant(FALLBACK, [name])).toEqual([name]);
      expect(missingDirectionVariant('', [name])).toEqual([name]);
      const tailwindRtl = String.raw`.wave-rtl\:-scale-x-100:where(:dir(rtl),[dir=rtl],[dir=rtl] *){scale:-1 1}`;
      expect(missingDirectionVariant(tailwindRtl, [name])).toEqual([name]);
    });

    it('reports a bare :where(:dir(rtl)) branch, which CSS minifiers rewrite to :lang()', async () => {
      const { missingDirectionVariant } = await loadBuildCss();
      const name = 'wave-rtl:-scale-x-100';
      const bare = String.raw`@supports selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where(:dir(rtl)){scale:-1 1}}@supports not selector(:dir(rtl)){.wave-rtl\:-scale-x-100:where([dir=rtl],[dir=rtl] *){scale:-1 1}}`;
      expect(missingDirectionVariant(bare, [name])).toEqual([name]);
      expect(missingDirectionVariant(LOWERED + FALLBACK, [name])).toEqual([name]);
    });

    it('lists the wave-rtl classes whose direction a CSS minifier rewrote to :lang()', async () => {
      const { loweredDirectionClasses } = await loadBuildCss();
      expect(loweredDirectionClasses(NATIVE + FALLBACK)).toEqual([]);
      const nested = String.raw`.hover\:wave-rtl\:ps-2{&:hover{@supports selector(:dir(rtl)){&:where(:is(:lang(ar),:lang(he))){padding-inline-start:.5rem}}}}`;
      // A rule of the app that selects by language is not a rewritten wave-rtl class.
      const own = String.raw`.quote:lang(ar){font-style:normal}`;
      expect(loweredDirectionClasses(LOWERED + nested + own + FALLBACK)).toEqual([
        'hover:wave-rtl:ps-2',
        'wave-rtl:-scale-x-100',
      ]);
    });

    it('fails the gate for a wave-rtl class of a library class string that did not compile', async () => {
      const { selectorClasses } = await loadBuildCss();
      const library: SourceText[] = [
        { content: "cn('wave-rtl:-scale-x-100', 'hover:wave-rtl:ps-2')", extension: 'ts' },
      ];
      const sources = { stories: [], library, libraryClasses: selectorClasses(GATE_CSS) };
      expect(await gate(GATE_CSS + NATIVE, sources)).toEqual([
        "styles.css: not compiled with Wave's wave-rtl variant " +
          '(:where(:nth-child(n of :dir(rtl))) under @supports selector(:nth-child(n of ' +
          ':dir(rtl))) and the [dir=rtl] fallback; is src/styles/variants.css imported?): ' +
          'hover:wave-rtl:ps-2 wave-rtl:-scale-x-100',
      ]);
      const compiled: SourceText[] = [{ content: "cn('wave-rtl:-scale-x-100')", extension: 'ts' }];
      expect(await gate(GATE_CSS + NATIVE + FALLBACK, { ...sources, library: compiled })).toEqual(
        [],
      );
    });

    it("fails the gate for a shipped class with Tailwind's bare rtl: or ltr: variant", async () => {
      const bare = String.raw`.rtl\:-scale-x-100:where(:dir(rtl),[dir=rtl],[dir=rtl] *){scale:-1 1}.hover\:ltr\:ms-2:hover:where(:dir(ltr),[dir=ltr],[dir=ltr] *){margin-inline-start:.5rem}.not-rtl\:pe-2:not(:where(:dir(rtl),[dir=rtl],[dir=rtl] *)){padding-inline-end:.5rem}`;
      expect(await gate(GATE_CSS + NATIVE + FALLBACK + bare)).toEqual([
        "styles.css: contains classes with Tailwind's bare rtl:/ltr: variant, which also " +
          "matches inside a subtree of the opposite direction (use Wave's wave-rtl: variant): " +
          'hover:ltr:ms-2 not-rtl:pe-2 rtl:-scale-x-100',
      ]);
    });
  });

  describe('library classes of the style entries', () => {
    it('takes @source inline() candidates and theme/base selector classes, never comment words', async () => {
      const { styleEntryClasses } = await loadBuildCss();
      const classes = styleEntryClasses({
        stylesCss: [
          '/* motion-reduce:animate-none is named in a comment */',
          "@import './tokens.css';",
          "@source '../components';",
          "@source not inline('w-1');",
          "@source inline('animate-wave-spin {hover:,}bg-primary-{hover,pressed} m-{0..8..4}');",
        ].join('\n'),
        tokensCss: [
          '/* .border-b-2 */',
          ':root, .wave-light { --wave-primary: #0f6cbd; }',
          '.wave-dark, .wave-high-contrast { color-scheme: dark; }',
          '@theme inline { --color-primary: var(--wave-primary);',
          '  @keyframes wave-pulse { 33.3% { opacity: 1; } } }',
        ].join('\n'),
        baseCss:
          '/* underline */ :where(.wave-root, .wave-portal) :where(ul) { border: 0 solid; display: flex; }',
      });
      expect([...classes].sort()).toEqual(
        [
          'animate-wave-spin',
          'bg-primary-hover',
          'bg-primary-pressed',
          'hover:bg-primary-hover',
          'hover:bg-primary-pressed',
          'm-0',
          'm-4',
          'm-8',
          'wave-dark',
          'wave-high-contrast',
          'wave-light',
          'wave-portal',
          'wave-root',
        ].sort(),
      );
    });

    it('includes the real safelist and theme classes but no class named only in a comment', async () => {
      const { styleEntryClasses } = await loadBuildCss();
      const classes = [
        ...styleEntryClasses({
          stylesCss: readCss('styles.css'),
          tokensCss: readCss('tokens.css'),
          baseCss: readCss('base.css'),
        }),
      ];
      for (const name of ['wave:animate-wave-spin-slow', 'wave:animate-wave-indeterminate-rtl']) {
        expect(classes).toContain(name);
      }
      for (const name of ['wave-light', 'wave-dark', 'wave-high-contrast', 'wave-root']) {
        expect(classes).toContain(name);
      }
      for (const name of ['motion-reduce:animate-none', 'motion-reduce:animate-wave-pulse']) {
        expect(classes).not.toContain(name);
      }
      expect(classes).not.toContain('border');
    });

    it.each([
      ['bg-primary', ['bg-primary']],
      ['{hover:,}bg-x', ['hover:bg-x', 'bg-x']],
      ['{hover:,}bg-x-{a,b}', ['hover:bg-x-a', 'bg-x-a', 'hover:bg-x-b', 'bg-x-b']],
      ['p-{1..3}', ['p-1', 'p-2', 'p-3']],
      ['m-{0..8..4}', ['m-0', 'm-4', 'm-8']],
      ['w-{3..1}', ['w-3', 'w-2', 'w-1']],
      [
        'bg-red-{50,{100..300..100},950}',
        ['bg-red-50', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-950'],
      ],
      ["content-['{a,b}']", ["content-['a']", "content-['b']"]],
      // Only the quotes protect this comma (Tailwind's segment() skips quoted strings).
      ['{a,"b,c"}', ['a', '"b,c"']],
      [String.raw`{a,"b\",c"}`, ['a', String.raw`"b\",c"`]],
    ])('expands %s the way Tailwind expands @source inline()', async (pattern, expected) => {
      const { expandBraces } = await loadBuildCss();
      expect(expandBraces(pattern)).toEqual(expected);
    });

    it('rejects unbalanced braces', async () => {
      const { expandBraces } = await loadBuildCss();
      expect(() => expandBraces('bg-{a,b')).toThrow(/not balanced/);
    });
  });

  describe('library sources of the style entries', () => {
    it('registers each @source path as Tailwind does, never inline() or a commented path', async () => {
      const { sourceEntries } = await loadBuildCss();
      const css = [
        "/* @source '../stories'; */",
        "@source '../components';",
        '@source not "../components/**/__tests__";',
        "@source inline('w-1');",
        "@source not inline('w-2');",
      ].join('\n');
      expect(sourceEntries(css, '/p/src/styles')).toEqual([
        { base: '/p/src/styles', pattern: '../components', negated: false },
        { base: '/p/src/styles', pattern: '../components/**/__tests__', negated: true },
      ]);
    });

    it('reads src/components and src/lib without their tests from the real styles.css', async () => {
      const { sourceEntries } = await loadBuildCss();
      expect(sourceEntries(readCss('styles.css'), 'base')).toEqual([
        { base: 'base', pattern: '../components', negated: false },
        { base: 'base', pattern: '../lib', negated: false },
        { base: 'base', pattern: '../components/**/__tests__', negated: true },
        { base: 'base', pattern: '../lib/**/__tests__', negated: true },
      ]);
    });
  });

  describe('main() end to end on a fixture project', () => {
    /**
     * A project laid out like this repository: copies of the real style entries, a component, a
     * component test, a non-TypeScript library file and stories. `dist/` is written per test.
     */
    let project = '';

    function write(path: string, content: string) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), content);
    }

    /** Minified CSS of parsed (comment-free) nodes. */
    function serialize(nodes: CssNode[]): string {
      return nodes
        .map((node) =>
          node.children === null
            ? `${node.prelude};`
            : `${node.prelude}{${serialize(node.children)}}`,
        )
        .join('');
    }

    /**
     * The real tokens.css and base.css as the CLI emits them (the `@theme` block compiled away,
     * its keyframes at the top level), the required utilities and the given extra rules.
     */
    function shippedCss(extra: string): string {
      const isTheme = (node: CssNode) => /^@theme\b/.test(node.prelude);
      const tokens = parseFile('tokens.css');
      const keyframes = tokens
        .filter(isTheme)
        .flatMap((node) => node.children ?? [])
        .filter((node) => node.prelude.startsWith('@keyframes'));
      return (
        serialize([...tokens.filter((node) => !isTheme(node)), ...parseFile('base.css')]) +
        UTILITIES.join('') +
        serialize(keyframes) +
        extra
      );
    }

    /**
     * dist/styles.css as {@link shippedCss} and dist/components.css as the CLI emits it from the
     * same sources: the same CSS without the rules of tokens.css and base.css.
     */
    function writeDist(extra: string) {
      const isTheme = (node: CssNode) => /^@theme\b/.test(node.prelude);
      const keyframes = parseFile('tokens.css')
        .filter(isTheme)
        .flatMap((node) => node.children ?? [])
        .filter((node) => node.prelude.startsWith('@keyframes'));
      write('dist/styles.css', shippedCss(extra));
      write('dist/components.css', UTILITIES.join('') + serialize(keyframes) + extra);
    }

    /** Runs main() and returns its exit code and everything it printed. */
    async function run(argv: string[]): Promise<{ code: number; output: string }> {
      const { main } = await loadBuildCss();
      const printed: unknown[][] = [];
      const error = vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
      const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
      try {
        const code = main(argv, { projectRoot: project });
        return { code, output: printed.map((args) => args.join(' ')).join('\n') };
      } finally {
        error.mockRestore();
        log.mockRestore();
      }
    }

    beforeAll(async () => {
      project = mkdtempSync(join(tmpdir(), 'wave-build-css-project-'));
      // An unprefixed project (no src/lib/cn.ts, so no prefix gate): styles.css without the prefix.
      write('src/styles/styles.css', unprefixedStylesCss());
      for (const name of ['tokens.css', 'base.css']) {
        write(`src/styles/${name}`, readCss(name));
      }
      write('dist/utilities.css', await utilitiesCssFor(readCss('tokens.css')));
      write(
        'src/components/Box.tsx',
        "/** Keeps its container. */\nexport const box = cn('bg-primary text-body-1');\n" +
          "export const wide = cn('w-20');\n" +
          `export const fade = '${MOTION_CLASSES}';\n`,
      );
      // Excluded by `@source not '../components/**/__tests__'`.
      write('src/components/__tests__/Box.test.tsx', 'render(<i className="w-7" />);\n');
      // Tailwind scans every text file of a source directory, not only TypeScript…
      write('src/lib/classes.md', 'Wave pads a card with `w-96`.\n');
      // …but takes no candidates from a CSS file.
      write('src/components/Box.css', '.h-7 { height: 1.75rem; }\n');
      write('dist/preflight.css', '*,:after,:before{box-sizing:border-box;margin:0;padding:0}');
    });

    afterAll(() => {
      rmSync(project, { recursive: true, force: true });
    });

    it('passes when every story class of dist comes from the library or the style entries', async () => {
      // w-20: a library class string; wave-dark: a selector class of tokens.css; h-96: a
      // story-only class that did not ship.
      write('stories/Box.stories.tsx', '<i className="bg-primary w-20 wave-dark" />;\n');
      write('stories/Notes.mdx', '<i className="h-96" />\n');
      writeDist('.w-20{width:5rem}');
      const { code, output } = await run(['--check-only']);
      expect(output).toMatch(passingReport('dist'));
      expect(code).toBe(0);
    });

    it('checks components.css and utilities.css next to styles.css', async () => {
      write('stories/Box.stories.tsx', '<i className="bg-primary" />;\n');
      write('stories/Notes.mdx', '\n');
      writeDist('');
      const utilities = readFileSync(join(project, 'dist/utilities.css'), 'utf8');
      // components.css without a utility of styles.css, with a token rule; utilities.css without
      // one of its classes.
      write(
        'dist/components.css',
        readFileSync(join(project, 'dist/components.css'), 'utf8').replace(UTILITIES[1], '') +
          '.wave-light{color-scheme:light}',
      );
      write('dist/utilities.css', utilities.replace('.bg-wave-primary{color:red}', ''));
      try {
        const { code, output } = await run(['--check-only']);
        expect(output.split('\n')).toEqual([
          'build-css: 3 problem(s) in dist:',
          '  - components.css: holds rules of tokens.css or base.css (.wave-light)',
          expect.stringMatching(
            /^ {2}- components\.css: is not styles\.css without the rules of tokens\.css and base\.css \(\d+ nodes for \d+; the first difference, node \d+: "\.animate-wave-spin\{/,
          ),
          expect.stringMatching(
            /^ {2}- utilities\.css: missing 1 of the \d+ namespaced utilities \(bg-wave-primary\)$/,
          ),
        ]);
        expect(code).toBe(1);
      } finally {
        write('dist/utilities.css', utilities);
      }
    });

    it('fails when components.css or utilities.css is missing', async () => {
      writeDist('');
      rmSync(join(project, 'dist/components.css'));
      const { code, output } = await run(['--check-only']);
      expect(output.split('\n')).toEqual([
        `build-css: ${join(project, 'dist', 'components.css')} does not exist (run without --check-only to build it)`,
      ]);
      expect(code).toBe(1);
    });

    it('fails on classes that only a comment or a non-TypeScript library file names', async () => {
      // w-96: a word of src/lib/classes.md (a library candidate, so no story-only class);
      // container: a word of a comment in Box.tsx.
      write('stories/Box.stories.tsx', '<i className="bg-primary w-96" />;\n');
      write('stories/Notes.mdx', '\n');
      writeDist('.w-96{width:24rem}.container{width:100%}');
      const { code, output } = await run(['--check-only']);
      expect(output.split('\n')).toEqual([
        'build-css: 1 problem(s) in dist:',
        '  - styles.css: contains classes that no class string of src/components or src/lib ' +
          'uses (words of comments, identifiers or other files; exclude them in ' +
          'src/styles/styles.css with @source not inline()): container w-96',
      ]);
      expect(code).toBe(1);
    });

    it('fails on story-only classes: named in a style entry comment, used by tests, in a non-TS story', async () => {
      // tokens.css names motion-reduce:animate-none in a comment only.
      expect(readCss('tokens.css')).toContain('motion-reduce:animate-none');
      write(
        'stories/Box.stories.tsx',
        '<i className="bg-primary motion-reduce:animate-none w-7" />;\n',
      );
      write('stories/Notes.mdx', '<i className="h-7" />\n');
      writeDist(
        String.raw`.h-7{height:1.75rem}.w-7{width:1.75rem}` +
          String.raw`@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}`,
      );
      const { code, output } = await run(['--check-only', '--out-dir', join(project, 'dist')]);
      expect(output.split('\n')).toEqual([
        'build-css: 1 problem(s) in dist:',
        '  - styles.css: contains story-only classes: h-7 motion-reduce:animate-none w-7',
      ]);
      expect(code).toBe(1);
    });
  });

  describe('main() compiling the real style entries (C-LOGICAL)', () => {
    /**
     * A project with copies of the real style entries, compiled by the Tailwind CLI. It lives
     * under the repository's node_modules/.cache, so `tailwindcss/*.css` resolves as it does here.
     */
    const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
    /** The motion representatives as the library writes them, with Wave's utility prefix. */
    const WAVE_MOTION_CLASSES = MOTION_CLASSES.split(' ')
      .map((word) => `wave:${word}`)
      .join(' ');
    const COMPONENT = [
      '/** A box that keeps its container in view; the chevron mirrors in RTL. */',
      'export function Box({ open, el }: { open: boolean; el: Element }) {',
      "  window.addEventListener('blur', close);",
      "  if (getComputedStyle(el).visibility === 'collapse') return null;",
      '  return (',
      '    <i',
      "      className={wcn('wave:bg-primary wave:text-body-1 wave:wave-rtl:-scale-x-100', open && 'wave:grid')}",
      '    />',
      '  );',
      '}',
      `export const fade = '${WAVE_MOTION_CLASSES}';`,
      '',
    ].join('\n');
    let project = '';

    function write(path: string, content: string) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), content);
    }

    /** Runs main() (a full build) and returns its exit code, its output and the stylesheet. */
    async function build(): Promise<{ code: number; output: string; css: string }> {
      const { main } = await loadBuildCss();
      const printed: unknown[][] = [];
      const error = vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args));
      const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
      try {
        const code = main([], { projectRoot: project });
        const css = readFileSync(join(project, 'dist', 'styles.css'), 'utf8');
        return { code, output: printed.map((args) => args.join(' ')).join('\n'), css };
      } finally {
        error.mockRestore();
        log.mockRestore();
      }
    }

    beforeAll(() => {
      const cache = join(REPO_ROOT, 'node_modules', '.cache');
      mkdirSync(cache, { recursive: true });
      project = mkdtempSync(join(cache, 'wave-build-css-compile-'));
      for (const name of [
        'styles.css',
        'theme.css',
        'tokens.css',
        'base.css',
        'variants.css',
        'preflight.css',
        'utilities.css',
      ]) {
        write(`src/styles/${name}`, readCss(name));
      }
      write('src/components/Box.tsx', COMPONENT);
      write('stories/Box.stories.tsx', '<Box open />;\n');
      // The prefix, as this repository declares it, so the compile check and the prefix gates run;
      // the allowlist names the two words of Box's non-class strings.
      write('src/lib/cn.ts', "export const UTILITY_PREFIX: string = 'wave';\n");
      write(
        'scripts/prefix-allowlist.json',
        `${JSON.stringify({ 'src/components/Box.tsx': ['blur', 'collapse'] })}\n`,
      );
    });

    afterAll(() => {
      rmSync(project, { recursive: true, force: true });
    });

    it('ships no class for the words of comments and non-class strings, and passes', async () => {
      const { code, output, css } = await build();
      const { selectorClasses, missingDirectionVariant } = await loadBuildCss();
      const classes = selectorClasses(css);
      // With the prefix no unprefixed word generates: no exclusion list is needed.
      expect(readCss('styles.css')).not.toMatch(/@source not inline/);
      for (const word of ['container', 'blur', 'collapse', 'visible']) {
        expect(classes, word).not.toContain(word);
        expect(classes, word).not.toContain(`wave:${word}`);
      }
      for (const name of [
        'wave:bg-primary',
        'wave:text-body-1',
        'wave:grid',
        'wave:wave-rtl:-scale-x-100',
        ...WAVE_MOTION_CLASSES.split(' '),
      ]) {
        expect(classes, name).toContain(name);
      }
      expect(missingDirectionVariant(css, ['wave:wave-rtl:-scale-x-100'])).toEqual([]);
      expect(output).toMatch(passingReport('dist', { compileCheckPassed: true }));
      expect(code).toBe(0);
    }, 60_000);

    it('compiles components.css from styles.css without the tokens and the base, and utilities.css from the namespaced keys', async () => {
      const { code } = await build();
      expect(code).toBe(0);
      const { selectorClasses, missingDirectionVariant, namespacedUtilities } =
        await loadBuildCss();
      const components = readFileSync(join(project, 'dist', 'components.css'), 'utf8');
      const componentClasses = selectorClasses(components);
      for (const name of [
        'wave:bg-primary',
        'wave:text-body-1',
        'wave:grid',
        'wave:wave-rtl:-scale-x-100',
      ]) {
        expect(componentClasses, name).toContain(name);
      }
      expect(missingDirectionVariant(components, ['wave:wave-rtl:-scale-x-100'])).toEqual([]);
      // No token rule, no base rule: the classes of tokens.css and base.css are not there.
      for (const name of ['wave-light', 'wave-dark', 'wave-high-contrast', 'wave-root']) {
        expect(componentClasses, name).not.toContain(name);
      }
      expect(components).not.toMatch(/--wave-primary:/);
      expect(components).toMatch(/@keyframes wave-spin\b/);

      const utilities = readFileSync(join(project, 'dist', 'utilities.css'), 'utf8');
      const expected = namespacedUtilities(readCss('tokens.css'));
      expect([...selectorClasses(utilities)].sort()).toEqual(expected);
      expect(expected).toEqual(
        expect.arrayContaining(['bg-wave-primary', 'text-wave-body-1', 'shadow-wave-4']),
      );
      expect(utilities).toMatch(/\}\.animate-wave-indeterminate\{/);
      expect(utilities).not.toMatch(/@layer utilities/);
      expect(utilities).not.toMatch(/--wave-primary:/);
    }, 60_000);

    it('ships utilities.css unlayered, so its classes beat the base styles of styles.css inside the root (ruling BL)', async () => {
      // The outputs are read whatever the gate says (it also fails on a layered utilities.css).
      const { code } = await build();
      const { parseCss } = await loadBuildCss();
      /** Every style rule outside keyframes, with the `@layer` names around it. */
      const rules = (nodes: CssNode[], layers: string[] = []): [CssNode, string[]][] =>
        nodes.flatMap((node): [CssNode, string[]][] => {
          if (node.children === null || node.prelude.startsWith('@keyframes')) return [];
          if (!node.prelude.startsWith('@')) return [[node, layers]];
          const layer = /^@layer\s+([\w-]+)$/.exec(node.prelude);
          return rules(node.children, layer ? [...layers, layer[1]] : layers);
        });
      const properties = (rule: CssNode) =>
        (rule.children ?? [])
          .filter((node) => node.children === null && node.prelude.includes(':'))
          .map((node) => node.prelude.slice(0, node.prelude.indexOf(':')).trim());
      const read = (name: string) =>
        rules(parseCss(readFileSync(join(project, 'dist', name), 'utf8')));

      // The utility classes sit in no layer (Tailwind's `properties` fallback holds none).
      const utilities = read('utilities.css').filter(([rule]) =>
        selectorList(rule.prelude).some((selector) => selector.startsWith('.')),
      );
      expect(utilities.length).toBeGreaterThan(800);
      expect(
        utilities.filter(([, layers]) => layers.length > 0).map(([rule]) => rule.prelude),
      ).toEqual([]);

      // The base styles of styles.css for the elements inside the root and a portal: unlayered,
      // zero-specificity resets (a native button's transparent background, inherited color and
      // font, every element's border color).
      const inside = /^:where\(\.wave-root, \.wave-portal\) /;
      const base = read('styles.css').filter(([rule]) =>
        selectorList(rule.prelude).every((selector) => inside.test(selector)),
      );
      expect(base.filter(([, layers]) => layers.length > 0)).toEqual([]);
      /** The longhands a shorthand of base.css sets. */
      const LONGHANDS: Record<string, string[]> = {
        font: ['font-family', 'font-size', 'line-height', 'font-weight', 'font-style'],
        border: ['border-color', 'border-width', 'border-style'],
        background: ['background-color'],
      };
      const sets = (rule: CssNode) =>
        new Set(properties(rule).flatMap((name) => [name, ...(LONGHANDS[name] ?? [])]));

      // Every utility beats every base rule that sets a property it sets, by specificity alone.
      const pairs: string[] = [];
      const losers: string[] = [];
      for (const [utility] of utilities) {
        const own = properties(utility);
        for (const [rule] of base) {
          const reset = sets(rule);
          const shared = own.filter((name) => reset.has(name));
          if (shared.length === 0) continue;
          for (const selector of selectorList(utility.prelude)) {
            for (const target of selectorList(rule.prelude)) {
              pairs.push(`${selector} ${shared.join(',')} / ${target}`);
              if (compareSpecificity(specificity(selector), specificity(target)) <= 0) {
                losers.push(`${selector} / ${target}`);
              }
            }
          }
        }
      }
      expect(losers).toEqual([]);
      // The cases of the browser pass: a native button's background, color and font, and the
      // border color of any element.
      const button = ':where(.wave-root, .wave-portal) :where(button, input, select, textarea)';
      const any = ':where(.wave-root, .wave-portal) :where(*)';
      expect(pairs).toEqual(
        expect.arrayContaining([
          `.bg-wave-error background-color / ${button}`,
          `.text-wave-foreground color / ${button}`,
          `.text-wave-body-1 font-size,line-height / ${button}`,
          `.font-wave font-family / ${button}`,
          `.border-wave-stroke border-color / ${any}`,
        ]),
      );
      expect(compareSpecificity(specificity('.bg-wave-error'), specificity(button))).toBe(1);
      expect(code).toBe(0);
    }, 60_000);

    it('throws instead of shipping the tokens in components.css when styles.css renames their import', async () => {
      const { main } = await loadBuildCss();
      write(
        'src/styles/styles.css',
        readCss('styles.css').replace("@import './tokens.css';", '@import "./tokens.css" ;'),
      );
      try {
        // A double-quoted import with a space is still the plain statement: it builds.
        expect((await build()).code).toBe(0);
        // Another form is not recognised: the build stops before it writes any output.
        rmSync(join(project, 'dist'), { recursive: true, force: true });
        write(
          'src/styles/styles.css',
          readCss('styles.css').replace("@import './tokens.css';", "@import url('./tokens.css');"),
        );
        // The compile check runs first and reports; its line is the only output before the throw.
        const printed: unknown[][] = [];
        const error = vi
          .spyOn(console, 'error')
          .mockImplementation((...args) => printed.push(args));
        const log = vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args));
        try {
          expect(() => main([], { projectRoot: project })).toThrow(
            new Error(
              "componentsSource: styles.css must @import './tokens.css' and './base.css' once " +
                'each (found: base)',
            ),
          );
        } finally {
          error.mockRestore();
          log.mockRestore();
        }
        expect(printed.map((args) => args.join(' ')).join('\n')).toMatch(
          /^build-css: compile check passed \(prefix wave: \d+ class words in \d+ files, \d+ allowlisted pairs\)$/,
        );
        expect(existsSync(join(project, 'dist'))).toBe(true);
        expect(existsSync(join(project, 'dist', 'styles.css'))).toBe(false);
      } finally {
        write('src/styles/styles.css', readCss('styles.css'));
      }
    }, 60_000);

    it('fails on a prefixed class that only a comment names (an unprefixed one never generates)', async () => {
      write('src/components/Box.tsx', `/** Sits in a wave:container box. */\n${COMPONENT}`);
      try {
        const { code, output, css } = await build();
        const { selectorClasses } = await loadBuildCss();
        expect(selectorClasses(css)).toContain('wave:container');
        expect(output.split('\n')).toContain(
          '  - styles.css: contains classes that no class string of src/components or src/lib ' +
            'uses (words of comments, identifiers or other files; exclude them in ' +
            'src/styles/styles.css with @source not inline()): wave:container',
        );
        expect(code).toBe(1);
      } finally {
        write('src/components/Box.tsx', COMPONENT);
      }
    }, 60_000);

    it('fails on a wave-rtl class when styles.css does not define the variant', async () => {
      write(
        'src/styles/styles.css',
        readCss('styles.css').replace("@import './variants.css';", ''),
      );
      try {
        const { code, output } = await build();
        expect(output).toContain(
          "styles.css: not compiled with Wave's wave-rtl variant " +
            '(:where(:nth-child(n of :dir(rtl))) under @supports selector(:nth-child(n of ' +
            ':dir(rtl))) and the [dir=rtl] fallback; is src/styles/variants.css imported?): ' +
            'wave:wave-rtl:-scale-x-100',
        );
        expect(code).toBe(1);
      } finally {
        write('src/styles/styles.css', readCss('styles.css'));
      }
    }, 60_000);
  });

  it('ships none of the excluded words from the real sources', async () => {
    // Compiles the real styles.css over the real src/components and src/lib. Only the shipped
    // classes are asserted: the other assertions of the gate belong to `npm run build`.
    const { main, selectorClasses } = await loadBuildCss();
    const out = mkdtempSync(join(tmpdir(), 'wave-build-css-real-'));
    // The report is captured and asserted: the whole gate passes on the real sources.
    const printed: unknown[][] = [];
    const spies = [
      vi.spyOn(console, 'error').mockImplementation((...args) => printed.push(args)),
      vi.spyOn(console, 'log').mockImplementation((...args) => printed.push(args)),
    ];
    try {
      const code = main(['--out-dir', out]);
      const output = printed.map((args) => args.join(' ')).join('\n');
      expect(output).toMatch(passingReport(String.raw`\S+`, { compileCheckPassed: true }));
      expect(code).toBe(0);
      const classes = selectorClasses(readFileSync(join(out, 'styles.css'), 'utf8'));
      expect(classes).toContain('wave:bg-primary');
      expect(
        EXCLUDED_WORDS.filter((word) => classes.has(word) || classes.has(`wave:${word}`)),
      ).toEqual([]);
      // No class without the prefix but the selector classes of the style entries.
      expect([...classes].filter((name) => !name.startsWith('wave:')).sort()).toEqual([
        'wave-dark',
        'wave-high-contrast',
        'wave-light',
        'wave-portal',
        'wave-root',
      ]);
    } finally {
      for (const spy of spies) spy.mockRestore();
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it('checks preflight.css: unlayered Preflight without Wave tokens', async () => {
    const { assertPreflightCss } = await loadBuildCss();
    const preflight = '*,:after,:before{box-sizing:border-box;margin:0;padding:0}';
    expect(assertPreflightCss(preflight)).toEqual([]);
    expect(assertPreflightCss(`@layer base{${preflight}}`)).toEqual([
      'preflight.css: layered output (@layer base)',
    ]);
    expect(assertPreflightCss(`${preflight}:root{--wave-primary:#0f6cbd}`)).toEqual([
      'preflight.css: contains Wave tokens',
    ]);
    expect(assertPreflightCss('.x{margin:0}')).toEqual(['preflight.css: Preflight rules missing']);
  });

  describe('components.css and utilities.css (spec R6 of Phase 14)', () => {
    it('lists the four outputs in the order of the report', async () => {
      const { OUTPUTS } = await loadBuildCss();
      expect(OUTPUTS).toEqual(['styles.css', 'components.css', 'utilities.css', 'preflight.css']);
    });

    it('derives the components source from styles.css without its tokens and base imports', async () => {
      const { componentsSource, parseCss } = await loadBuildCss();
      const statementsOf = (css: string) =>
        parseCss(css)
          .filter((node) => node.children === null)
          .map((node) => node.prelude.replace(/\s+/g, ' ').replace(/"/g, "'"));
      expect(statementsOf(componentsSource(readCss('styles.css')))).toEqual(
        statements('styles.css').filter(
          (statement) => !/^@import '\.\/(tokens|base)\.css'$/.test(statement),
        ),
      );
      expect(componentsSource(`@import "./base.css";\n@import './tokens.css' ;\n.x{}`)).toBe(
        '.x{}',
      );
    });

    it.each([
      ['neither import', "@import './theme.css';", 'neither'],
      ['one import', "@import './tokens.css';", 'tokens'],
      [
        'an import twice',
        "@import './tokens.css';\n@import './base.css';\n@import './base.css';",
        'base, base, tokens',
      ],
      ['another form', "@import url('./tokens.css');\n@import './base.css';", 'base'],
    ])('refuses a styles.css with %s', async (_, css, found) => {
      const { componentsSource } = await loadBuildCss();
      expect(() => componentsSource(css)).toThrow(
        new Error(
          "componentsSource: styles.css must @import './tokens.css' and './base.css' once each " +
            `(found: ${found})`,
        ),
      );
    });

    const THEME = [
      '@theme inline {',
      '  --color-wave-primary: var(--wave-primary);',
      '  --text-wave-body-1: 14px;',
      '  --text-wave-body-1--line-height: 20px;',
      '  --shadow-wave-4: var(--wave-shadow-4);',
      '  --font-wave: var(--wave-font-family);',
      '  --font-wave-mono: var(--wave-font-family-monospace);',
      '  --transition-duration-wave-fast: var(--wave-duration-fast);',
      '  --ease-wave-linear: var(--wave-curve-linear);',
      '  --animate-wave-spin: wave-spin 0.8s linear infinite;',
      '  --color-primary: var(--wave-primary);',
      '  @keyframes wave-spin { to { transform: rotate(360deg); } }',
      '}',
      ':root { --wave-primary: #0f6cbd; --color-wave-outside: red; }',
    ].join('\n');
    const GENERATED = [
      'animate-wave-spin',
      'bg-wave-primary',
      'border-wave-primary',
      'fill-wave-primary',
      'font-wave',
      'font-wave-mono',
      'ring-wave-primary',
      'shadow-wave-4',
      'stroke-wave-primary',
      'text-wave-body-1',
      'text-wave-primary',
    ];

    it('generates the namespaced token utilities from the @theme keys of tokens.css', async () => {
      // Six color utilities per color, one per type-ramp step, shadow level, font family and
      // animation; no sub-key, motion key, unnamespaced key or key outside @theme.
      const { namespacedUtilities } = await loadBuildCss();
      expect(namespacedUtilities(THEME)).toEqual(GENERATED);
    });

    it('generates the utilities of every namespaced key of the real tokens.css', async () => {
      const { namespacedUtilities } = await loadBuildCss();
      const keys = [...declarations(themeBlock().children ?? []).keys()];
      const count = (pattern: RegExp) => keys.filter((key) => pattern.test(key)).length;
      const classes = namespacedUtilities(readCss('tokens.css'));
      expect(classes).toHaveLength(
        count(/^--color-wave-/) * 6 +
          count(/^--text-wave-(?:(?!--).)+$/) +
          count(/^--shadow-wave-/) +
          count(/^--font-wave/) +
          count(/^--animate-wave-/),
      );
      expect(classes).toEqual(
        expect.arrayContaining([
          'bg-wave-primary',
          'text-wave-foreground',
          'border-wave-border',
          'ring-wave-ring',
          'fill-wave-palette-red',
          'stroke-wave-brand-80',
          'text-wave-body-1',
          'text-wave-display',
          'shadow-wave-64',
          'font-wave-numeric',
          'animate-wave-indeterminate-rtl',
        ]),
      );
      expect(classes.filter((name) => !/^[a-z]+-wave\b/.test(name))).toEqual([]);
    });

    it('appends the generated list to utilities.css as an @source inline()', async () => {
      const { utilitiesSource } = await loadBuildCss();
      expect(utilitiesSource("@import './tokens.css' reference;\n", THEME)).toBe(
        "@import './tokens.css' reference;\n\n" + `@source inline('${GENERATED.join(' ')}');\n`,
      );
      expect(() => utilitiesSource('', ':root { --wave-primary: #0f6cbd; }')).toThrow(
        'utilitiesSource: tokens.css declares no namespaced theme key (--color-wave-*, …)',
      );
    });

    describe('assertComponentsCss', () => {
      /** styles.css: a token rule, a base rule, utilities, an @supports block and a keyframe. */
      const STYLES =
        '@layer properties{@supports ((-webkit-hyphens:none)){*,:before{--tw-x:0}}}' +
        ':root,.wave-light{--wave-primary:#0f6cbd;--wave-foreground:#242424}' +
        '.wave-light{color-scheme:light}' +
        '.wave-root,.wave-portal{color:var(--wave-foreground)}' +
        '.bg-primary{background-color:var(--wave-primary)}' +
        String.raw`.\[--wave-card-padding\:12px\]{--wave-card-padding:12px}` +
        String.raw`@supports selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:-1 1}}` +
        '@keyframes wave-spin{to{opacity:1}}';
      const COMPONENTS =
        '@layer properties{@supports ((-webkit-hyphens:none)){*,:before{--tw-x:0}}}' +
        '.bg-primary{background-color:var(--wave-primary)}' +
        String.raw`.\[--wave-card-padding\:12px\]{--wave-card-padding:12px}` +
        String.raw`@supports selector(:nth-child(n of :dir(rtl))){.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:-1 1}}` +
        '@keyframes wave-spin{to{opacity:1}}';

      /** The gate on `css`, against STYLES unless `parity` is false (no styles.css given). */
      async function check(css: string, { parity = true } = {}) {
        const { assertComponentsCss } = await loadBuildCss();
        return assertComponentsCss(css, {
          ...(parity ? { stylesCss: STYLES } : {}),
          tokensCss: GATE_TOKENS,
          baseCss: GATE_BASE,
        });
      }

      it('passes styles.css without the token and base rules (a component custom property is no token)', async () => {
        expect(await check(COMPONENTS)).toEqual([]);
        expect(await check(COMPONENTS, { parity: false })).toEqual([]);
      });

      it('fails on a token rule, a base rule, a :root rule or a theme variable', async () => {
        expect(
          await check(`:root,.wave-light{--wave-primary:#0f6cbd}${COMPONENTS}`, { parity: false }),
        ).toEqual([
          'components.css: holds a :root rule (:root)',
          'components.css: holds rules of tokens.css or base.css (.wave-light)',
          'components.css: declares the tokens --wave-primary',
        ]);
        expect(
          await check(`${COMPONENTS}.wave-root,.wave-portal{color:var(--wave-foreground)}`, {
            parity: false,
          }),
        ).toEqual([
          'components.css: holds rules of tokens.css or base.css (.wave-root .wave-portal)',
        ]);
        expect(
          await check(`:host{--color-primary:var(--wave-primary);--spacing:.25rem}${COMPONENTS}`, {
            parity: false,
          }),
        ).toEqual([
          'components.css: declares the theme variables --color-primary, --spacing',
          'components.css: contains "--spacing:"',
        ]);
      });

      it('fails on layered output and on a Tailwind directive', async () => {
        expect(await check(`@layer components{${COMPONENTS}}`, { parity: false })).toEqual([
          'components.css: layered output (@layer components)',
        ]);
        expect(await check(`@import 'tailwindcss';${COMPONENTS}`, { parity: false })).toEqual([
          `components.css: unprocessed directive "@import 'tailwindcss'"`,
        ]);
      });

      it('fails when it is not styles.css without the token and base rules', async () => {
        // Node 4, the @supports block, serialised and cut at 80 characters in the message.
        const supports = (scale: string) =>
          JSON.stringify(
            (
              '@supports selector(:nth-child(n of :dir(rtl))){' +
              String.raw`.wave-rtl\:-scale-x-100:where(:nth-child(n of :dir(rtl))){scale:${scale};}}`
            ).slice(0, 80),
          );
        expect(await check(COMPONENTS.replace('scale:-1 1', 'scale:1 1'))).toEqual([
          'components.css: is not styles.css without the rules of tokens.css and base.css ' +
            `(5 nodes for 5; the first difference, node 4: ${supports('1 1')} for ${supports('-1 1')})`,
        ]);
        expect(await check(COMPONENTS.replace('@keyframes wave-spin{to{opacity:1}}', ''))).toEqual([
          'components.css: is not styles.css without the rules of tokens.css and base.css ' +
            '(4 nodes for 5; the first difference, node 5: "<none>" for "@keyframes wave-spin{to{opacity:1;}}")',
        ]);
      });
    });

    describe('assertUtilitiesCss', () => {
      const KEYS = THEME.replace(
        '  @keyframes wave-spin { to { transform: rotate(360deg); } }',
        ['wave-spin', 'wave-pulse', 'wave-indeterminate', 'wave-indeterminate-rtl']
          .map((name) => `  @keyframes ${name} { to { opacity: 1; } }`)
          .join('\n'),
      );
      let good = '';

      beforeAll(async () => {
        good = await utilitiesCssFor(KEYS);
      });

      async function check(css: string) {
        const { assertUtilitiesCss } = await loadBuildCss();
        return assertUtilitiesCss(css, { tokensCss: KEYS, baseCss: GATE_BASE });
      }

      it('passes exactly the generated classes, unlayered, with the keyframes', async () => {
        expect(good).toMatch(/^@layer properties\{.*\}\}\.animate-wave-spin\{/);
        expect(await check(good)).toEqual([]);
      });

      it('fails on a missing class, a variant, an unnamespaced or another utility', async () => {
        expect(await check(good.replace('.shadow-wave-4{color:red}', ''))).toEqual([
          'utilities.css: missing 1 of the 11 namespaced utilities (shadow-wave-4)',
        ]);
        const extra = good.replace(
          '.animate-wave-spin{',
          String.raw`.hover\:bg-wave-primary:hover{color:red}.bg-primary{color:red}.p-4{padding:1rem}.animate-wave-spin{`,
        );
        expect(await check(extra)).toEqual([
          'utilities.css: holds classes other than the namespaced token utilities ' +
            '(bg-primary hover:bg-wave-primary p-4)',
        ]);
      });

      it('fails on a layer, a class inside a layer and a directive (ruling BL: unlayered)', async () => {
        // The layered sheet of the first 1.0 build: its classes lose to the base styles.
        expect(await check(`${good}@layer utilities{.bg-wave-primary{color:red}}`)).toEqual([
          'utilities.css: layered output (@layer utilities)',
          'utilities.css: classes inside a @layer (.bg-wave-primary)',
        ]);
        // Tailwind's properties fallback is the one layer allowed, and it holds no class.
        expect(await check(`${good}@layer properties{.bg-wave-primary{color:red}}`)).toEqual([
          'utilities.css: classes inside a @layer (.bg-wave-primary)',
        ]);
        expect(await check(`@layer base{.x{color:red}}${good}`)).toEqual([
          'utilities.css: layered output (@layer base)',
          'utilities.css: classes inside a @layer (.x)',
          'utilities.css: holds classes other than the namespaced token utilities (x)',
        ]);
        expect(await check(`${good}@source inline('x');`)).toEqual([
          `utilities.css: unprocessed directive "@source inline('x')"`,
        ]);
      });

      it('fails on a token rule, a theme variable, another custom property and missing keyframes', async () => {
        expect(await check(`:root,.wave-root{--wave-primary:#0f6cbd}${good}`)).toEqual([
          'utilities.css: holds a :root rule (:root)',
          'utilities.css: holds rules of tokens.css or base.css (.wave-root)',
          'utilities.css: declares the tokens --wave-primary',
          'utilities.css: holds classes other than the namespaced token utilities (wave-root)',
        ]);
        expect(
          await check(
            good.replace(
              '.bg-wave-primary{color:red}',
              '.bg-wave-primary{--color-wave-primary:var(--wave-primary);--app-x:1;color:red}',
            ),
          ),
        ).toEqual([
          'utilities.css: declares the theme variables --color-wave-primary',
          'utilities.css: declares the custom properties --app-x',
        ]);
        expect(await check(good.replace(/@keyframes wave-pulse\{[^}]*\{[^}]*\}\}/, ''))).toEqual([
          'utilities.css: missing @keyframes wave-pulse',
        ]);
      });

      it('given styles.css, fails on a custom property it reads that styles.css does not declare (Task 20 review)', async () => {
        const { assertUtilitiesCss } = await loadBuildCss();
        // The styles.css of a plain app: the tokens, and Tailwind's own --tw-* registrations.
        const stylesCss =
          ':root,.wave-light{--wave-primary:#0f6cbd;--wave-error:#c50f1f}' +
          '@property --tw-shadow{syntax:"*";inherits:false}';
        const check = (css: string) =>
          assertUtilitiesCss(css, { tokensCss: KEYS, baseCss: GATE_BASE, stylesCss });
        // A token read through var(), and a --tw-* property: both resolve in a plain app.
        const reading = good.replace(
          '.bg-wave-primary{color:red}',
          '.bg-wave-primary{background-color:var(--wave-primary);box-shadow:var(--tw-shadow)}',
        );
        expect(check(reading)).toEqual([]);
        // A key mapped to a theme variable instead of a token: nothing declares it without Tailwind.
        const theme = good.replace(
          '.bg-wave-primary{color:red}',
          '.bg-wave-primary{background-color:var(--color-wave-primary);color:var(--wave-gone, red)}',
        );
        expect(check(theme)).toEqual([
          'utilities.css: reads custom properties that styles.css does not declare (a namespaced ' +
            'key mapped to a theme variable, not a token?): --color-wave-primary, --wave-gone',
        ]);
        // Without styles.css the rule is not checked (the unit fixtures above pass none).
        expect(assertUtilitiesCss(theme, { tokensCss: KEYS, baseCss: GATE_BASE })).toEqual([]);
      });
    });
  });

  describe('entry-script guard', () => {
    let scratch = '';
    /** A junction (a symlink off Windows) to the repo's real scripts/ directory. */
    let link = '';

    const isLink = (path: string) =>
      lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() === true;

    /** Removes the link itself (never its target); `unlink` refuses a real directory. */
    function removeLink() {
      if (isLink(link)) unlinkSync(link);
      if (existsSync(link) || isLink(link)) throw new Error(`could not remove ${link}`);
    }

    beforeAll(() => {
      scratch = mkdtempSync(join(tmpdir(), 'wave-build-css-'));
      link = join(scratch, 'scripts-link');
    });

    afterAll(() => {
      // Remove the link before the recursive removal, so that removal never depends on how rmSync
      // treats a link to the real scripts/ directory; removeLink throws (and the scratch directory
      // is left alone) if the link cannot be removed.
      removeLink();
      rmSync(scratch, { recursive: true, force: true });
    });

    // build-css starts through the shared guard of scripts/verify-dist.mjs (runScript), asked
    // here about build-css's own module URL.
    const BUILD_CSS_URL = pathToFileURL(BUILD_CSS_PATH).href;

    it('runs when invoked directly and stays inert when imported', async () => {
      const { entryStatus } = await loadEntryGuard();
      expect(entryStatus(BUILD_CSS_URL, BUILD_CSS_PATH)).toBe('main');
      expect(entryStatus(BUILD_CSS_URL, undefined)).toBe('imported');
      expect(entryStatus(BUILD_CSS_URL, join(scratch, 'other.mjs'))).toBe('imported');
      // Importing the script builds and checks nothing: a Node process that only imports it prints
      // nothing (a build or check prints its report) and exits 0.
      const imported = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', `await import(${JSON.stringify(BUILD_CSS_URL)});`],
        { encoding: 'utf8' },
      );
      expect({ status: imported.status, stdout: imported.stdout, stderr: imported.stderr }).toEqual(
        {
          status: 0,
          stdout: '',
          stderr: '',
        },
      );
      const buildCss = await loadBuildCss();
      expect(typeof buildCss.main).toBe('function');
    });

    it.runIf(process.platform === 'win32')(
      'compares paths case-insensitively on Windows',
      async () => {
        const { entryStatus } = await loadEntryGuard();
        expect(entryStatus(BUILD_CSS_URL, BUILD_CSS_PATH.toUpperCase())).toBe('main');
      },
    );

    it('runs when invoked through a symlink or junction', async () => {
      const { entryStatus } = await loadEntryGuard();
      symlinkSync(dirname(BUILD_CSS_PATH), link, 'junction');
      try {
        expect(isLink(link)).toBe(true);
        expect(entryStatus(BUILD_CSS_URL, join(link, 'build-css.mjs'))).toBe('main');

        // End to end: through the link, --check-only must run and fail on an empty output
        // directory instead of exiting 0 without checking anything.
        const empty = join(scratch, 'empty-dist');
        mkdirSync(empty);
        const result = spawnSync(
          process.execPath,
          [join(link, 'build-css.mjs'), '--check-only', '--out-dir', empty],
          { encoding: 'utf8' },
        );
        expect(result.stderr).toMatch(/build-css: .*styles\.css does not exist/);
        expect(result.status).toBe(1);
      } finally {
        removeLink();
      }
      expect(existsSync(link)).toBe(false);
      expect(existsSync(BUILD_CSS_PATH)).toBe(true);
      // The run reads the repository's UTILITY_PREFIX, so the compile check (a TypeScript program
      // over src) runs before the outputs are checked: seconds, more under a loaded suite.
    }, 60_000);

    it('fails closed when invoked as build-css.mjs but not recognised as this script', async () => {
      const { entryStatus } = await loadEntryGuard();
      // Another file of the same name that loads the real script: nothing is built or checked,
      // and the run fails instead of exiting 0.
      const impostor = join(scratch, 'build-css.mjs');
      writeFileSync(impostor, `import ${JSON.stringify(BUILD_CSS_URL)};\n`);
      expect(entryStatus(BUILD_CSS_URL, impostor)).toBe('mismatch');
      const result = spawnSync(process.execPath, [impostor, '--check-only'], { encoding: 'utf8' });
      expect(result.stderr).toMatch(/^build-css: cannot confirm that .*; nothing was checked/);
      expect(result.status).toBe(1);
    });
  });
});
