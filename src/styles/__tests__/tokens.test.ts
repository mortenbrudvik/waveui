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
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Vitest runs with CSS processing disabled, which empties every `*.css?raw` import, so the files
// are read from disk.
const STYLES_DIR = join(import.meta.dirname, '..');
const CSS_FILE_NAMES = readdirSync(STYLES_DIR).filter((name) => name.endsWith('.css'));

function readCss(name: string): string {
  const path = join(STYLES_DIR, name);
  if (!existsSync(path)) throw new Error(`src/styles/${name} does not exist`);
  return readFileSync(path, 'utf8');
}

// ---------------------------------------------------------------------------------------------
// Minimal CSS parser
// ---------------------------------------------------------------------------------------------

interface CssNode {
  /** Selector list or at-rule prelude (`@theme inline`, `@keyframes wave-spin`, `@import …`). */
  prelude: string;
  /** `null` for statements (`@import …;`) and declarations. */
  children: CssNode[] | null;
}

// Removes comments. A comment opener inside a quoted string (an `@source` glob with a double-star
// directory segment) is part of the string, not a comment.
function stripComments(css: string): string {
  return css.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\//g, (_, string) =>
    typeof string === 'string' ? string : '',
  );
}

function parse(css: string): CssNode[] {
  const nodes: CssNode[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        nodes.push({
          prelude: css.slice(start, bodyStart - 1).trim(),
          children: parse(css.slice(bodyStart, i)),
        });
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      const statement = css.slice(start, i).trim();
      if (statement) nodes.push({ prelude: statement, children: null });
      start = i + 1;
    }
  }
  const rest = css.slice(start).trim();
  if (rest) nodes.push({ prelude: rest, children: null });
  return nodes;
}

function parseFile(name: string): CssNode[] {
  return parse(stripComments(readCss(name)));
}

type Decls = Map<string, string>;

function declarations(nodes: CssNode[]): Decls {
  const decls: Decls = new Map();
  for (const node of nodes) {
    if (node.children !== null || node.prelude.startsWith('@')) continue;
    const colon = node.prelude.indexOf(':');
    if (colon === -1) continue;
    decls.set(node.prelude.slice(0, colon).trim(), node.prelude.slice(colon + 1).trim());
  }
  return decls;
}

/** Collapses whitespace and uses single quotes, so selectors compare independently of format. */
function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/"/g, "'")
    .trim();
}

function selectorList(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of prelude) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);
  return parts.map(normalizeSelector);
}

function styleRules(nodes: CssNode[]): CssNode[] {
  return nodes.filter((node) => node.children !== null && !node.prelude.startsWith('@'));
}

/** The rule whose selector list is exactly `selectors` (order-insensitive). */
function ruleWithSelectors(nodes: CssNode[], selectors: string[]): CssNode | undefined {
  const wanted = selectors.map(normalizeSelector).sort().join('|');
  return styleRules(nodes).find(
    (rule) => [...selectorList(rule.prelude)].sort().join('|') === wanted,
  );
}

/** Declarations of every rule whose selector list contains one of `selectors`, in source order. */
function declsMatching(nodes: CssNode[], selectors: string[]): Decls {
  const wanted = selectors.map(normalizeSelector);
  const merged: Decls = new Map();
  for (const rule of styleRules(nodes)) {
    if (!selectorList(rule.prelude).some((selector) => wanted.includes(selector))) continue;
    for (const [name, value] of declarations(rule.children ?? [])) merged.set(name, value);
  }
  return merged;
}

function merge(...maps: Decls[]): Decls {
  const merged: Decls = new Map();
  for (const map of maps) for (const [name, value] of map) merged.set(name, value);
  return merged;
}

/**
 * Resolves `var()` references like the cascade does for custom properties: `scopes[0]` is the
 * element's own declarations, later scopes are its ancestors (inherited values).
 */
function resolveValue(value: string, scopes: Decls[], seen: string[] = []): string {
  const match = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(value.trim());
  if (!match) return value.trim().toLowerCase();
  const [, name, fallback] = match;
  if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(' -> ')}`);
  for (let depth = 0; depth < scopes.length; depth++) {
    const declared = scopes[depth].get(name);
    if (declared !== undefined) {
      // An inherited custom property was computed on the ancestor that declared it.
      return resolveValue(declared, scopes.slice(depth), [...seen, name]);
    }
  }
  if (fallback !== undefined) return resolveValue(fallback, scopes, seen);
  throw new Error(`unresolved custom property ${name} (via ${seen.join(' -> ') || 'root'})`);
}

function resolveToken(name: string, scopes: Decls[]): string {
  return resolveValue(`var(${name})`, scopes);
}

// ---------------------------------------------------------------------------------------------
// WCAG 2.2 contrast
// ---------------------------------------------------------------------------------------------

function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// ---------------------------------------------------------------------------------------------
// Expected values (spec §2.1.3)
// ---------------------------------------------------------------------------------------------

type ThemeName = 'light' | 'dark' | 'high-contrast';
const THEMES: ThemeName[] = ['light', 'dark', 'high-contrast'];

/** Selector list of each theme group in tokens.css (§2.1.2). */
const THEME_GROUPS: Record<ThemeName, string[]> = {
  light: [':root', '.wave-light'],
  dark: ['.wave-dark', '.dark'],
  'high-contrast': ['.wave-high-contrast', '.high-contrast'],
};

/** Classes a WaveProvider root / portal wrapper carries per theme (F3 `getThemeClassName`). */
const PROVIDER_SELECTORS: Record<ThemeName, string[]> = {
  light: ['.wave-light'],
  dark: ['.wave-dark', '.dark'],
  'high-contrast': ['.wave-high-contrast', '.high-contrast'],
};

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
  border: ['#e0e0e0', '#666666', '#ffffff'],
  stroke: ['#d1d1d1', '#666666', '#ffffff'],
  'stroke-hover': ['#c7c7c7', '#757575', '#ffffff'],
  'stroke-accessible': ['#616161', '#adadad', '#ffffff'],
  input: ['#d1d1d1', '#666666', '#ffffff'],
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
  backdrop: ['rgb(0 0 0 / 0.4)', 'rgb(0 0 0 / 0.5)', 'rgb(0 0 0 / 0.8)'],
};

/** Derived variables every theme group re-declares so nested themes re-resolve them (§2.1.2). */
const DERIVED: Record<string, string> = {
  'card-foreground': 'var(--wave-foreground)',
  'secondary-foreground': 'var(--wave-foreground)',
  accent: 'var(--wave-primary)',
  'accent-foreground': 'var(--wave-primary-foreground)',
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

/** The 0.4 semantic names (they collide with shadcn/ui; only legacy-tokens.css may use them). */
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
 * Contrast pairs of §2.1.3 (plus the review's component combinations, §4.5): [foreground,
 * background, threshold]. 4.5 for text, 3 for non-text UI and graphics.
 *
 * §4.5 requires foreground, muted-foreground, primary-as-text and ring against `selected`,
 * `subtle-selected` and `card`/`subtle-hover`; `SECTION_4_5_MATRIX` below checks that every one of
 * those combinations is listed here.
 */
const CONTRAST_PAIRS: Array<[string, string, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'card', 4.5],
  ['foreground', 'subtle-hover', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['muted-foreground', 'subtle-hover', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['primary-foreground', 'primary-pressed', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'subtle-hover', 4.5],
  ['primary', 'card', 4.5],
  ['primary', 'subtle-selected', 4.5],
  ['foreground', 'subtle-selected', 4.5],
  ['muted-foreground', 'subtle-selected', 4.5],
  ['selected-foreground', 'selected', 4.5],
  ['foreground', 'selected', 4.5],
  ['muted-foreground', 'selected', 4.5],
  ['primary', 'selected', 4.5],
  ['ring', 'selected', 3],
  ['ring', 'background', 3],
  ['ring', 'subtle-selected', 3],
  ['ring', 'card', 3],
  ['ring', 'subtle-hover', 3],
  ['stroke-accessible', 'background', 3],
  // Progress fills on the track (ProgressBar `color`; its warning fill uses `severe`).
  ['primary', 'track', 3],
  ['success', 'track', 3],
  ['error', 'track', 3],
  ['severe', 'track', 3],
  // CounterBadge dot fills on the page (a dot has no text). The primary, muted-foreground
  // (informative) and warning-tint-foreground (warning) dots are asserted at 4.5 in this list.
  ['success', 'background', 3],
  ['destructive', 'background', 3],
  ['severe', 'background', 3],
  ['error', 'background', 4.5],
  ['error', 'card', 4.5],
  // Field warning and success messages, on the page and on cards.
  ['warning-tint-foreground', 'background', 4.5],
  ['warning-tint-foreground', 'card', 4.5],
  ['success-tint-foreground', 'background', 4.5],
  ['success-tint-foreground', 'card', 4.5],
  ['error-foreground', 'error', 4.5],
  ['destructive-foreground', 'destructive', 4.5],
  ['success-foreground', 'success', 4.5],
  ['warning-foreground', 'warning', 4.5],
  ['severe-foreground', 'severe', 4.5],
  ['info-foreground', 'info', 4.5],
  ['success-tint-foreground', 'success-tint', 4.5],
  ['warning-tint-foreground', 'warning-tint', 4.5],
  ['error-tint-foreground', 'error-tint', 4.5],
  ['severe-tint-foreground', 'severe-tint', 4.5],
  ['info-tint-foreground', 'info-tint', 4.5],
  ['inverted-foreground', 'inverted', 4.5],
  ['rating', 'background', 3],
  ['presence-available', 'background', 3],
  ['presence-busy', 'background', 3],
  ['presence-away', 'background', 3],
  ['presence-offline', 'background', 3],
  ['presence-oof', 'background', 3],
  ['presence-glyph', 'presence-available', 3],
  ['presence-glyph', 'presence-busy', 3],
  ['presence-glyph', 'presence-away', 3],
  ['presence-glyph', 'presence-oof', 3],
];

/**
 * Ratios printed in §2.1.3 (rounded to two decimals there), plus the success, error and severe
 * progress fills on the track (recorded to two decimals in 0.6). The unrounded ratio must match
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
 * glyph on each presence fill.
 */
type MinimumPair = [theme: ThemeName, fg: string, bg: string, minimum: number];
const TABLED_MINIMUMS = [
  'presence-available',
  'presence-busy',
  'presence-away',
  'presence-oof',
].map((fill): MinimumPair => ['high-contrast', 'presence-glyph', fill, 7.09]);

/**
 * Text contrast matrix (WCAG 1.4.3: 4.5:1, compared unrounded). The pairs above are the ones the
 * spec tables; components and consumers also combine a text token with any surface of its theme.
 * A real-browser axe sweep of every story found high-contrast `error` text at 4.27:1 in a selected,
 * pressed List row (a subtle Button with `text-error` on `subtle-pressed`), a pair no table listed.
 * So every text-capable token is checked against every surface it can sit on, and every colour
 * token is classified (text, surface or excluded with a reason), so a new token cannot skip it.
 */

/**
 * Surfaces any text can sit on: the page (popovers, menus, dialogs and toasts are `background`
 * too), cards, neutral chips, the subtle control states, the selection tint, and the status tints
 * (MessageBar renders its title, body, links, actions and dismiss button on the tint).
 */
const TEXT_SURFACES = [
  'background',
  'card',
  'secondary',
  'muted',
  'subtle-hover',
  'subtle-pressed',
  'subtle-selected',
  'selected',
  'success-tint',
  'warning-tint',
  'error-tint',
  'severe-tint',
  'info-tint',
];

/** Text tokens that may sit on every `TEXT_SURFACES` entry, with where they are used as text. */
const SURFACE_TEXT_TOKENS: Record<string, string> = {
  foreground: 'body text',
  'card-foreground': 'alias of foreground',
  'secondary-foreground': 'alias of foreground',
  'muted-foreground': 'secondary text, placeholders, icon buttons',
  primary: 'links, transparent buttons, selected Nav/TabList/Stepper text',
  accent: 'alias of primary',
  error: 'validation messages, required markers, destructive actions (`text-error`)',
  // §2.1.3 gives destructive and error one value; 0.4 and shadcn-style code writes text-destructive.
  destructive: 'alias of error',
  success: 'completed Stepper steps (`text-success`)',
  'warning-tint-foreground': "warning's text token (the warning fill is not text, see below)",
  'info-tint-foreground': "info's text token (the info fill is a fill and border, see below)",
};

/** Text tokens bound to particular surfaces: their own fill or tint, or the inverted tooltip. */
const BOUND_TEXT_SURFACES: Record<string, string[]> = {
  'selected-foreground': ['selected'],
  'inverted-foreground': ['inverted'],
  // Status icons and badge text: on their tint (MessageBar, Badge, Stepper) and on the page (Toast).
  // Field success messages also sit on cards.
  'success-tint-foreground': ['success-tint', 'background', 'card'],
  'error-tint-foreground': ['error-tint', 'background'],
  'severe-tint-foreground': ['severe-tint', 'background'],
  // Text on fills.
  'primary-foreground': ['primary', 'primary-hover', 'primary-pressed'],
  'accent-foreground': ['accent'],
  'error-foreground': ['error'],
  'destructive-foreground': ['destructive'],
  'success-foreground': ['success'],
  'warning-foreground': ['warning'],
  'severe-foreground': ['severe'],
  'info-foreground': ['info'],
};

/**
 * Colour tokens that are never text on a surface, with the reason. Non-text contrast (3:1, WCAG
 * 1.4.11) of the strokes and graphics is asserted in `CONTRAST_PAIRS`.
 */
const NOT_TEXT_TOKENS: Record<string, string> = {
  // Fills only by design, each carrying its own -foreground (BOUND_TEXT_SURFACES).
  warning: 'fill only: 1.30:1 on white; warning text and icons use warning-tint-foreground',
  severe: 'fill only (with severe-foreground); severe text uses severe-tint-foreground',
  info: 'fill and start border only (with info-foreground); info text uses info-tint-foreground',
  'primary-hover': 'fill state of primary (with primary-foreground)',
  'primary-pressed': 'fill state of primary (with primary-foreground)',
  subtle: 'transparent rest state of subtle controls',
  // Strokes, focus ring and graphics.
  border: 'decorative divider',
  stroke: 'control border (paired with stroke-accessible for 3:1 where it identifies a control)',
  'stroke-hover': 'control border state',
  'stroke-accessible': 'control border, Slider rail, Rating outline star (3:1)',
  input: 'control border',
  ring: 'focus indicator (3:1)',
  track: 'progress track (the primary, success, error and severe fills carry 3:1)',
  skeleton: 'loading placeholder',
  rating: 'Rating star glyph (3:1)',
  'presence-available': 'presence glyph (3:1)',
  'presence-busy': 'presence glyph (3:1)',
  'presence-away': 'presence glyph (3:1)',
  'presence-offline': 'presence glyph (3:1)',
  'presence-oof': 'presence glyph (3:1)',
  'presence-glyph': 'glyph drawn on a presence fill (3:1)',
  'inverted-border': 'tooltip border',
  backdrop: 'translucent overlay scrim',
};

/** Each text token with every surface it is checked against. */
const TEXT_MATRIX: Array<{ fg: string; surfaces: string[] }> = [
  ...Object.keys(SURFACE_TEXT_TOKENS).map((fg) => ({ fg, surfaces: TEXT_SURFACES })),
  ...Object.entries(BOUND_TEXT_SURFACES).map(([fg, surfaces]) => ({ fg, surfaces })),
];

// ---------------------------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------------------------

function tokensNodes(): CssNode[] {
  return parseFile('tokens.css');
}

function themeRule(theme: ThemeName): CssNode {
  const rule = ruleWithSelectors(tokensNodes(), THEME_GROUPS[theme]);
  if (!rule) throw new Error(`tokens.css has no rule for "${THEME_GROUPS[theme].join(', ')}"`);
  return rule;
}

function themeDecls(theme: ThemeName): Decls {
  return declarations(themeRule(theme).children ?? []);
}

/** Theme-independent constants (ramps, font family, z-index) on the bare `:root` rule. */
function rootConstants(): Decls {
  const rule = ruleWithSelectors(tokensNodes(), [':root']);
  if (!rule) throw new Error('tokens.css has no bare `:root` rule for the constants');
  return declarations(rule.children ?? []);
}

function themeBlock(): CssNode {
  const block = tokensNodes().find((node) => /^@theme\b/.test(node.prelude));
  if (!block || !block.children) throw new Error('tokens.css has no @theme block');
  return block;
}

/** Resolved `--wave-<token>` of a theme in the default entries (no legacy file). */
function resolved(theme: ThemeName, token: string): string {
  return resolveToken(`--wave-${token}`, [themeDecls(theme), rootConstants()]);
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

  it('never reads a 0.4 semantic name (only the ramp names, as fallbacks)', () => {
    const source = stripComments(readCss('tokens.css'));
    const reads = [...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]);
    const foreign = reads.filter(
      (name) => !name.startsWith('--wave-') && !/^--(brand|grey)-\d+$/.test(name),
    );
    expect(foreign).toEqual([]);
    for (const name of LEGACY_SEMANTIC_NAMES) {
      expect(source).not.toMatch(new RegExp(`var\\(\\s*--${name}\\s*[,)]`));
    }
  });
});

describe('tokens.css — ramps, font and z-index (repo-level#7, repo-level#15)', () => {
  it('declares the brand ramp on :root, reading the 0.4 names as fallbacks', () => {
    const constants = rootConstants();
    for (const [step, hex] of Object.entries(BRAND_RAMP)) {
      expect(constants.get(`--wave-brand-${step}`)).toBe(`var(--brand-${step}, ${hex})`);
    }
  });

  it('declares the grey ramp on :root, reading the 0.4 names as fallbacks', () => {
    const constants = rootConstants();
    for (const [step, hex] of Object.entries(GREY_RAMP)) {
      expect(constants.get(`--wave-grey-${step}`)).toBe(`var(--grey-${step}, ${hex})`);
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

  it('re-themes when a consumer overrides a 0.4 ramp name on :root', () => {
    const consumer: Decls = new Map([
      ['--brand-80', '#6b2fa0'],
      ['--brand-110', '#c89ef0'],
    ]);
    const root = merge(rootConstants(), consumer);
    expect(resolveToken('--wave-primary', [themeDecls('light'), root])).toBe('#6b2fa0');
    expect(resolveToken('--wave-accent', [themeDecls('light'), root])).toBe('#6b2fa0');
    expect(resolveToken('--wave-primary', [themeDecls('dark'), root])).toBe('#c89ef0');
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

  it('never sets color-scheme on :root or on the deprecated .dark/.high-contrast aliases', () => {
    expect(colorSchemeFor(':root')).toEqual([]);
    expect(colorSchemeFor('.dark')).toEqual([]);
    expect(colorSchemeFor('.high-contrast')).toEqual([]);
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

  it('uses @theme inline', () => {
    expect(themeBlock().prelude).toMatch(/^@theme\s+inline$/);
  });

  it('maps every token to a --color-* utility color', () => {
    const decls = themeDeclarations();
    for (const token of Object.keys(TOKENS)) {
      expect(decls.get(`--color-${token}`)).toBe(`var(--wave-${token})`);
    }
  });

  it('exposes the brand ramp as --color-brand-*', () => {
    const decls = themeDeclarations();
    for (const step of Object.keys(BRAND_RAMP)) {
      expect(decls.get(`--color-brand-${step}`)).toBe(`var(--wave-brand-${step})`);
    }
  });

  it('maps font-wave to the runtime font token and keeps the type ramp and shadows', () => {
    const decls = themeDeclarations();
    expect(decls.get('--font-wave')).toBe('var(--wave-font-family)');
    expect(decls.get('--text-body-1')).toBe('14px');
    expect(decls.get('--text-body-1--line-height')).toBe('20px');
    expect(decls.get('--text-display')).toBe('68px');
    for (const size of ['2', '4', '8', '16', '28', '64']) {
      expect(decls.has(`--shadow-${size}`)).toBe(true);
    }
  });

  it('does not override Tailwind radius or font-sans defaults (repo-level#7, repo-level#8)', () => {
    const source = stripComments(readCss('tokens.css'));
    expect(source).not.toMatch(/--radius/);
    expect(source).not.toMatch(/--font-sans/);
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

// ---------------------------------------------------------------------------------------------
// base.css, animations.css (button-provider#2, repo-level#7, repo-level#12)
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

describe('animations.css (repo-level#12)', () => {
  it('is empty: keyframes live in @theme and there is no global reduced-motion override', () => {
    expect(parseFile('animations.css')).toEqual([]);
    expect(readCss('animations.css')).toMatch(/deprecated/i);
  });

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
 * Tailwind utilities that no component uses as a class, but whose names occur in the library
 * sources as words of comments, identifiers or non-class strings. styles.css
 * excludes them, so the unlayered precompiled file never restyles an app's own `.collapse`,
 * `.container` or `.table`.
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
  'resize',
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
  it('styles.css builds the unlayered precompiled CSS with pinned sources, utilities last', () => {
    expect(statements('styles.css')).toEqual([
      "@import 'tailwindcss/theme.css' theme(inline)",
      "@import './tokens.css'",
      "@import './base.css'",
      "@import './variants.css'",
      "@import 'tailwindcss/utilities.css' source(none)",
      "@source '../components'",
      "@source '../lib'",
      "@source not '../components/**/__tests__'",
      "@source not '../lib/**/__tests__'",
      "@source inline('animate-wave-spin animate-wave-spin-slow animate-wave-pulse animate-wave-indeterminate animate-wave-indeterminate-rtl')",
      `@source not inline('${EXCLUDED_WORDS.join(' ')}')`,
    ]);
    expect(parseFile('styles.css').filter((node) => node.children !== null)).toEqual([]);
    expect(readCss('styles.css')).not.toMatch(/layer\(/);
  });

  it('tailwind.css joins the consumer layer order, defines wave-rtl and scans dist', () => {
    expect(statements('tailwind.css')).toEqual([
      "@import './tokens.css' layer(theme)",
      "@import './base.css' layer(base)",
      "@import './variants.css'",
      "@source '../../dist'",
    ]);
  });

  it('preflight.css is an opt-in, unlayered Preflight entry', () => {
    expect(statements('preflight.css')).toEqual(["@import 'tailwindcss/preflight.css'"]);
  });

  it('globals.css is the dev entry mirroring the Tailwind consumer path', () => {
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
// legacy-tokens.css (repo-level#7): opt-in, deprecated, read + write compatible, cycle-free
// ---------------------------------------------------------------------------------------------

describe('legacy-tokens.css (repo-level#7)', () => {
  const NESTED_LIGHT = ':where(.wave-dark, .dark, .wave-high-contrast, .high-contrast) .wave-light';

  function legacyNodes(): CssNode[] {
    return parseFile('legacy-tokens.css');
  }

  /** Declarations applying to an element with the given selectors: tokens.css, then legacy. */
  function elementDecls(selectors: string[], extra: Decls = new Map()): Decls {
    return merge(
      declsMatching(tokensNodes(), selectors),
      declsMatching(legacyNodes(), selectors),
      extra,
    );
  }

  /** `<html>` (`:root`), optionally with consumer overrides loaded after Wave. */
  function htmlScope(consumer: Decls = new Map()): Decls {
    return elementDecls([':root'], consumer);
  }

  const providerSelectors = PROVIDER_SELECTORS;

  it('declares the 0.4 ramp names as literal constants (no var(), no cycle)', () => {
    const root = declsMatching(legacyNodes(), [':root']);
    for (const [step, hex] of Object.entries(BRAND_RAMP)) {
      expect(root.get(`--brand-${step}`)).toBe(hex);
    }
    for (const [step, hex] of Object.entries(GREY_RAMP)) {
      expect(root.get(`--grey-${step}`)).toBe(hex);
    }
    expect(stripComments(readCss('legacy-tokens.css'))).not.toMatch(
      /--(brand|grey)-\d+\s*:\s*var\(/,
    );
  });

  it.each(THEMES)('re-declares every 0.4 semantic name for the %s theme', (theme) => {
    const decls =
      theme === 'light'
        ? declsMatching(legacyNodes(), [':root'])
        : declsMatching(legacyNodes(), providerSelectors[theme]);
    const missing = LEGACY_SEMANTIC_NAMES.filter((name) => !decls.has(`--${name}`));
    expect(missing).toEqual([]);
  });

  it('re-declares the light 0.4 names on a light subtree nested inside another theme', () => {
    const nested = declsMatching(legacyNodes(), [NESTED_LIGHT]);
    expect(LEGACY_SEMANTIC_NAMES.filter((name) => !nested.has(`--${name}`))).toEqual([]);
  });

  it('points every matching --wave-* semantic at its 0.4 name in every theme group', () => {
    for (const theme of THEMES) {
      const decls = declsMatching(legacyNodes(), providerSelectors[theme]);
      for (const name of LEGACY_SEMANTIC_NAMES) {
        expect(decls.get(`--wave-${name}`), `${theme} --wave-${name}`).toBe(`var(--${name})`);
      }
    }
  });

  it.each(THEMES)('is cycle-free and keeps every %s token value', (theme) => {
    const html = htmlScope();
    const scopes = theme === 'light' ? [html] : [elementDecls(providerSelectors[theme]), html];
    const column = THEMES.indexOf(theme);
    for (const [token, values] of Object.entries(TOKENS)) {
      expect(resolveToken(`--wave-${token}`, scopes), `${theme} ${token}`).toBe(values[column]);
    }
    for (const [name] of elementDecls(theme === 'light' ? [':root'] : providerSelectors[theme])) {
      expect(() => resolveToken(name, scopes)).not.toThrow();
    }
  });

  it('keeps the light values in a light provider nested in a dark one', () => {
    const html = htmlScope();
    const dark = elementDecls(providerSelectors.dark);
    const nestedLight = elementDecls(['.wave-light', NESTED_LIGHT]);
    for (const [token, values] of Object.entries(TOKENS)) {
      expect(resolveToken(`--wave-${token}`, [nestedLight, dark, html]), token).toBe(values[0]);
    }
  });

  it('a 0.4 override on :root still reaches a top-level light provider (write compatibility)', () => {
    const html = htmlScope(new Map([['--primary', '#6b2fa0']]));
    const provider = elementDecls(providerSelectors.light);
    expect(resolveToken('--wave-primary', [provider, html])).toBe('#6b2fa0');
    expect(resolveToken('--wave-accent', [provider, html])).toBe('#6b2fa0');
  });

  it('a 0.4 override on .dark still reaches a dark provider (write compatibility)', () => {
    const provider = elementDecls(providerSelectors.dark, new Map([['--primary', '#c89ef0']]));
    expect(resolveToken('--wave-primary', [provider, htmlScope()])).toBe('#c89ef0');
  });

  it('never sets color-scheme or a style property (variables only)', () => {
    const names = styleRules(legacyNodes()).flatMap((rule) => [
      ...declarations(rule.children ?? []).keys(),
    ]);
    expect(names.filter((name) => !name.startsWith('--'))).toEqual([]);
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
  ];
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
        stylesCss: readCss('styles.css'),
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
          '.wave-dark, .dark { color-scheme: dark; }',
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
          'dark',
          'hover:bg-primary-hover',
          'hover:bg-primary-pressed',
          'm-0',
          'm-4',
          'm-8',
          'wave-dark',
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
      for (const name of ['animate-wave-spin-slow', 'animate-wave-indeterminate-rtl']) {
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

    beforeAll(() => {
      project = mkdtempSync(join(tmpdir(), 'wave-build-css-project-'));
      for (const name of ['styles.css', 'tokens.css', 'base.css']) {
        write(`src/styles/${name}`, readCss(name));
      }
      write(
        'src/components/Box.tsx',
        "/** Keeps its container. */\nexport const box = cn('bg-primary text-body-1');\n" +
          "export const wide = cn('w-20');\n",
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
      write('dist/styles.css', shippedCss('.w-20{width:5rem}'));
      const { code, output } = await run(['--check-only']);
      expect(output).toMatch(
        /^build-css: dist\/styles\.css \([\d.]+ kB\) and dist\/preflight\.css \([\d.]+ kB\) OK$/,
      );
      expect(code).toBe(0);
    });

    it('fails on classes that only a comment or a non-TypeScript library file names', async () => {
      // w-96: a word of src/lib/classes.md (a library candidate, so no story-only class);
      // container: a word of a comment in Box.tsx.
      write('stories/Box.stories.tsx', '<i className="bg-primary w-96" />;\n');
      write('stories/Notes.mdx', '\n');
      write('dist/styles.css', shippedCss('.w-96{width:24rem}.container{width:100%}'));
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
      write(
        'dist/styles.css',
        shippedCss(
          String.raw`.h-7{height:1.75rem}.w-7{width:1.75rem}` +
            String.raw`@media (prefers-reduced-motion:reduce){.motion-reduce\:animate-none{animation:none}}`,
        ),
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
    const COMPONENT = [
      '/** A box that keeps its container in view; the chevron mirrors in RTL. */',
      'export function Box({ open, el }: { open: boolean; el: Element }) {',
      "  window.addEventListener('blur', close);",
      "  if (getComputedStyle(el).visibility === 'collapse') return null;",
      "  return <i className={cn('bg-primary text-body-1 wave-rtl:-scale-x-100', open && 'grid')} />;",
      '}',
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
        'tokens.css',
        'base.css',
        'variants.css',
        'preflight.css',
      ]) {
        write(`src/styles/${name}`, readCss(name));
      }
      write('src/components/Box.tsx', COMPONENT);
      write('stories/Box.stories.tsx', '<Box open />;\n');
    });

    afterAll(() => {
      rmSync(project, { recursive: true, force: true });
    });

    it('ships no class for the words of comments and non-class strings, and passes', async () => {
      const { code, output, css } = await build();
      const { selectorClasses, missingDirectionVariant } = await loadBuildCss();
      const classes = selectorClasses(css);
      for (const word of ['container', 'blur', 'collapse', 'visible']) {
        expect(classes, word).not.toContain(word);
      }
      for (const name of ['bg-primary', 'text-body-1', 'grid', 'wave-rtl:-scale-x-100']) {
        expect(classes, name).toContain(name);
      }
      expect(missingDirectionVariant(css, ['wave-rtl:-scale-x-100'])).toEqual([]);
      expect(output).toMatch(/^build-css: dist\/styles\.css \([\d.]+ kB\) and .* OK$/);
      expect(code).toBe(0);
    }, 60_000);

    it('fails on a comment word that styles.css does not exclude', async () => {
      write(
        'src/styles/styles.css',
        readCss('styles.css').replace(/@source not inline\([^)]*\);/, ''),
      );
      try {
        const { code, output, css } = await build();
        const { selectorClasses } = await loadBuildCss();
        expect(selectorClasses(css)).toContain('container');
        expect(output.split('\n')).toContain(
          '  - styles.css: contains classes that no class string of src/components or src/lib ' +
            'uses (words of comments, identifiers or other files; exclude them in ' +
            'src/styles/styles.css with @source not inline()): container',
        );
        expect(code).toBe(1);
      } finally {
        write('src/styles/styles.css', readCss('styles.css'));
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
            'wave-rtl:-scale-x-100',
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
      expect(output).toMatch(
        /^build-css: \S+\/styles\.css \([\d.]+ kB\) and \S+\/preflight\.css \([\d.]+ kB\) OK$/,
      );
      expect(code).toBe(0);
      const classes = selectorClasses(readFileSync(join(out, 'styles.css'), 'utf8'));
      expect(classes).toContain('bg-primary');
      expect(EXCLUDED_WORDS.filter((word) => classes.has(word))).toEqual([]);
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
    });

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
