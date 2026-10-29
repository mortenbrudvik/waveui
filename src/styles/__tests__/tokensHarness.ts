/**
 * Shared harness of the token tests: the small CSS parser, the `var()` resolver, the WCAG 2.2
 * contrast maths, the theme-group lookups of `src/styles/tokens.css` and the contrast matrix (its
 * pair lists, the classification of every colour token, and `forEachContrastPair`, which walks it).
 * `tokens.test.ts` and the tests that prove properties of the tokens read them from here. The
 * parser is not a general CSS parser: it covers what the style files use (rules, at-rules, nested
 * `@theme`/`@keyframes` blocks and declarations).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Vitest runs with CSS processing disabled, which empties every `*.css?raw` import, so the files
// are read from disk.
export const STYLES_DIR = join(import.meta.dirname, '..');
export const CSS_FILE_NAMES = readdirSync(STYLES_DIR).filter((name) => name.endsWith('.css'));

export function readCss(name: string): string {
  const path = join(STYLES_DIR, name);
  if (!existsSync(path)) throw new Error(`src/styles/${name} does not exist`);
  return readFileSync(path, 'utf8');
}

// ---------------------------------------------------------------------------------------------
// Minimal CSS parser
// ---------------------------------------------------------------------------------------------

export interface CssNode {
  /** Selector list or at-rule prelude (`@theme inline`, `@keyframes wave-spin`, `@import …`). */
  prelude: string;
  /** `null` for statements (`@import …;`) and declarations. */
  children: CssNode[] | null;
}

// Removes comments. A comment opener inside a quoted string (an `@source` glob with a double-star
// directory segment) is part of the string, not a comment.
export function stripComments(css: string): string {
  return css.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\/\*[\s\S]*?\*\//g, (_, string) =>
    typeof string === 'string' ? string : '',
  );
}

export function parse(css: string): CssNode[] {
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

export function parseFile(name: string): CssNode[] {
  return parse(stripComments(readCss(name)));
}

export type Decls = Map<string, string>;

export function declarations(nodes: CssNode[]): Decls {
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
export function normalizeSelector(selector: string): string {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/"/g, "'")
    .trim();
}

export function selectorList(prelude: string): string[] {
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

export function styleRules(nodes: CssNode[]): CssNode[] {
  return nodes.filter((node) => node.children !== null && !node.prelude.startsWith('@'));
}

/** The rule whose selector list is exactly `selectors` (order-insensitive). */
export function ruleWithSelectors(nodes: CssNode[], selectors: string[]): CssNode | undefined {
  const wanted = selectors.map(normalizeSelector).sort().join('|');
  return styleRules(nodes).find(
    (rule) => [...selectorList(rule.prelude)].sort().join('|') === wanted,
  );
}

/** Declarations of every rule whose selector list contains one of `selectors`, in source order. */
export function declsMatching(nodes: CssNode[], selectors: string[]): Decls {
  const wanted = selectors.map(normalizeSelector);
  const merged: Decls = new Map();
  for (const rule of styleRules(nodes)) {
    if (!selectorList(rule.prelude).some((selector) => wanted.includes(selector))) continue;
    for (const [name, value] of declarations(rule.children ?? [])) merged.set(name, value);
  }
  return merged;
}

export function merge(...maps: Decls[]): Decls {
  const merged: Decls = new Map();
  for (const map of maps) for (const [name, value] of map) merged.set(name, value);
  return merged;
}

/**
 * Resolves `var()` references like the cascade does for custom properties: `scopes[0]` is the
 * element's own declarations, later scopes are its ancestors (inherited values).
 */
export function resolveValue(value: string, scopes: Decls[], seen: string[] = []): string {
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

export function resolveToken(name: string, scopes: Decls[]): string {
  return resolveValue(`var(${name})`, scopes);
}

// ---------------------------------------------------------------------------------------------
// WCAG 2.2 contrast
// ---------------------------------------------------------------------------------------------

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export type ThemeName = 'light' | 'dark' | 'high-contrast';
export const THEMES: ThemeName[] = ['light', 'dark', 'high-contrast'];

/** Selector list of each theme group in tokens.css (§2.1.2). */
export const THEME_GROUPS: Record<ThemeName, string[]> = {
  light: [':root', '.wave-light'],
  dark: ['.wave-dark', '.dark'],
  'high-contrast': ['.wave-high-contrast', '.high-contrast'],
};

/** Classes a WaveProvider root / portal wrapper carries per theme (F3 `getThemeClassName`). */
export const PROVIDER_SELECTORS: Record<ThemeName, string[]> = {
  light: ['.wave-light'],
  dark: ['.wave-dark', '.dark'],
  'high-contrast': ['.wave-high-contrast', '.high-contrast'],
};

// Shared lookups
// ---------------------------------------------------------------------------------------------

export function tokensNodes(): CssNode[] {
  return parseFile('tokens.css');
}

export function themeRule(theme: ThemeName): CssNode {
  const rule = ruleWithSelectors(tokensNodes(), THEME_GROUPS[theme]);
  if (!rule) throw new Error(`tokens.css has no rule for "${THEME_GROUPS[theme].join(', ')}"`);
  return rule;
}

export function themeDecls(theme: ThemeName): Decls {
  return declarations(themeRule(theme).children ?? []);
}

/** Theme-independent constants (ramps, font family, z-index, motion) on the bare `:root` rule. */
export function rootConstants(): Decls {
  const rule = ruleWithSelectors(tokensNodes(), [':root']);
  if (!rule) throw new Error('tokens.css has no bare `:root` rule for the constants');
  return declarations(rule.children ?? []);
}

/** Resolved `--wave-<token>` of a theme in the default entries (no legacy file). */
export function resolved(theme: ThemeName, token: string): string {
  return resolveToken(`--wave-${token}`, [themeDecls(theme), rootConstants()]);
}

// ---------------------------------------------------------------------------------------------
// The contrast matrix
// ---------------------------------------------------------------------------------------------

/** The 12 persona palette hues (Avatar `color`, chart series), in tokens.css order. */
export const PALETTE_HUES = [
  'red',
  'pumpkin',
  'gold',
  'forest',
  'teal',
  'blue',
  'navy',
  'lavender',
  'purple',
  'magenta',
  'brown',
  'steel',
] as const;

/**
 * Contrast pairs of §2.1.3 (plus the review's component combinations, §4.5): [foreground,
 * background, threshold]. 4.5 for text, 3 for non-text UI and graphics.
 *
 * §4.5 requires foreground, muted-foreground, primary-as-text and ring against `selected`,
 * `subtle-selected` and `card`/`subtle-hover`; `SECTION_4_5_MATRIX` in tokens.test.ts checks that
 * every one of those combinations is listed here.
 */
export const CONTRAST_PAIRS: Array<[string, string, number]> = [
  ['foreground', 'background', 4.5],
  ['foreground', 'card', 4.5],
  ['foreground', 'subtle-hover', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'card', 4.5],
  ['muted-foreground', 'muted', 4.5],
  ['muted-foreground', 'subtle-hover', 4.5],
  // ToggleButton `isAccessible` (0.7) draws the pressed state as a brand fill with on-brand text,
  // on `primary` with an inset `primary-foreground` stroke, on the page and on cards. Its pairs
  // are the three `primary-foreground` fills below and `primary` on `background` and `card`; they
  // need no new entry.
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['primary-foreground', 'primary-pressed', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'subtle-hover', 4.5],
  ['primary', 'card', 4.5],
  // Also the checked box of a multi-select Option on its selected row (0.10, D8), a non-text
  // graphic that needs 3:1; the text threshold covers it.
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
  // The unchecked box of a multi-select Option (0.10, D8) on the active and the selected row.
  ['stroke-accessible', 'subtle-hover', 3],
  ['stroke-accessible', 'subtle-selected', 3],
  // Filled input focus ring and state colors on the input's own fill (Phase 4 D5).
  ['primary', 'input-filled-darker', 3],
  ['destructive', 'input-filled-darker', 3],
  ['ring', 'input-filled-darker', 3],
  ['primary', 'input-filled-lighter', 3],
  ['destructive', 'input-filled-lighter', 3],
  ['ring', 'input-filled-lighter', 3],
  // AlphaSlider's checkerboard (0.8): squares in `stroke` on `background` under the rail. A
  // pattern that must stay visible, not text or a control boundary: 1.5:1. (`muted` on
  // `background` reaches only 1.14, 1.24 and 1.21:1.) The thumbs of the color parts reuse
  // `foreground` on `background` and `ring` on `background` above.
  ['stroke', 'background', 1.5],
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
  // Tags (0.11). Tag's Dismiss ring on the filled chip and an InteractionTag's ring over its
  // filled neighbour; 0.10 already relied on it without asserting it: 4.72 / 4.18 / 16.21.
  ['ring', 'muted', 3],
  // Text on the hover and pressed fills of neutral chips (foreground text only):
  // 11.76 / 10.05 / 12.63.
  ['foreground', 'muted-hover', 4.5],
  // 10.17 / 13.58 / 8.45.
  ['foreground', 'muted-pressed', 4.5],
  // State steps that must be seen (1.15:1, a floor of this phase; 0.10's dismiss hover was
  // 1.05:1). The pressed step is judged against hover only, as Button's subtle-pressed is:
  // muted-pressed is 1.07:1 on the dark background and card, so no pressed pair is asserted
  // against a surface.
  // 1.16 / 1.17 / 1.38.
  ['muted-hover', 'muted', 1.15],
  // 1.16 / 1.35 / 1.49.
  ['muted-pressed', 'muted-hover', 1.15],
  // 1.16 / 1.38 / 1.40.
  ['selected-hover', 'selected', 1.15],
  // 1.16 / 1.56 / 1.43.
  ['selected-pressed', 'selected-hover', 1.15],
  // An outline tag's Dismiss circle on the page: 1.32 / 1.45 / 1.66.
  ['muted-hover', 'background', 1.15],
  // On a card: 1.26 / 1.26 / 1.66.
  ['muted-hover', 'card', 1.15],
  // Outline tags in a filled-darker TagPicker: 1.21 / 1.83 / 1.66.
  ['muted-hover', 'input-filled-darker', 1.15],
  // Palette borders (0.17): the hue's stroke on the page and on its own tint (WCAG 1.4.11). The
  // strong fill on the page (a chart series) has its own test in the palette block.
  ...PALETTE_HUES.flatMap((hue): Array<[string, string, number]> => [
    [`palette-${hue}-border`, 'background', 3],
    [`palette-${hue}-border`, `palette-${hue}-tint`, 3],
  ]),
];

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
export const TEXT_SURFACES = [
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
  'input-filled-darker',
  'input-filled-lighter',
];

/** Text tokens that may sit on every `TEXT_SURFACES` entry, with where they are used as text. */
export const SURFACE_TEXT_TOKENS: Record<string, string> = {
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
export const BOUND_TEXT_SURFACES: Record<string, string[]> = {
  'selected-foreground': ['selected', 'selected-hover', 'selected-pressed'],
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
  // Avatar colors (0.13): text on each persona palette fill, in every theme.
  'palette-red-foreground': ['palette-red'],
  'palette-pumpkin-foreground': ['palette-pumpkin'],
  'palette-gold-foreground': ['palette-gold'],
  'palette-forest-foreground': ['palette-forest'],
  'palette-teal-foreground': ['palette-teal'],
  'palette-blue-foreground': ['palette-blue'],
  'palette-navy-foreground': ['palette-navy'],
  'palette-lavender-foreground': ['palette-lavender'],
  'palette-purple-foreground': ['palette-purple'],
  'palette-magenta-foreground': ['palette-magenta'],
  'palette-brown-foreground': ['palette-brown'],
  'palette-steel-foreground': ['palette-steel'],
  // Palette tints (0.17): text and icons on the tint, on the page and on cards, in every theme.
  // The tints are surfaces for their own tint foreground only (not TEXT_SURFACES): muted text is
  // under 4.5:1 on the light tints.
  ...Object.fromEntries(
    PALETTE_HUES.map((hue) => [
      `palette-${hue}-tint-foreground`,
      [`palette-${hue}-tint`, 'background', 'card'],
    ]),
  ),
};

/**
 * Colour tokens that are never text on a surface, with the reason. Non-text contrast (3:1, WCAG
 * 1.4.11) of the strokes and graphics is asserted in `CONTRAST_PAIRS`.
 */
export const NOT_TEXT_TOKENS: Record<string, string> = {
  // Fills only by design, each carrying its own -foreground (BOUND_TEXT_SURFACES).
  warning: 'fill only: 1.30:1 on white; warning text and icons use warning-tint-foreground',
  severe: 'fill only (with severe-foreground); severe text uses severe-tint-foreground',
  info: 'fill and start border only (with info-foreground); info text uses info-tint-foreground',
  'primary-hover': 'fill state of primary (with primary-foreground)',
  'primary-pressed': 'fill state of primary (with primary-foreground)',
  // Not TEXT_SURFACES: primary text is 4.08 / 4.15:1 on muted-hover (light / dark) and
  // muted-foreground 4.48:1 in dark; a light grey dark enough to be seen cannot keep every text
  // token at 4.5:1 (#ebebeb, the darkest that does, is 1.05:1 from muted).
  'muted-hover':
    'fill state of muted chips (Tag, InteractionTag), with foreground text (CONTRAST_PAIRS)',
  'muted-pressed':
    'fill state of muted chips (Tag, InteractionTag), with foreground text (CONTRAST_PAIRS)',
  'selected-hover': 'fill state of selected (with selected-foreground)',
  'selected-pressed': 'fill state of selected (with selected-foreground)',
  subtle: 'transparent rest state of subtle controls',
  // Strokes, focus ring and graphics.
  border: 'decorative divider',
  stroke: 'control border (paired with stroke-accessible for 3:1 where it identifies a control)',
  'stroke-hover': 'control border state',
  'stroke-accessible': 'control border, Slider rail, Rating outline star (3:1)',
  input: 'control border',
  'input-filled-stroke': 'filled input border (transparent except in high contrast)',
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
  // Palette borders (0.17).
  ...Object.fromEntries(
    PALETTE_HUES.map((hue) => [
      `palette-${hue}-border`,
      "the hue's stroke, declared as its fill (3:1 on background and on its tint)",
    ]),
  ),
};

/** Each text token with every surface it is checked against. */
export const TEXT_MATRIX: Array<{ fg: string; surfaces: string[] }> = [
  ...Object.keys(SURFACE_TEXT_TOKENS).map((fg) => ({ fg, surfaces: TEXT_SURFACES })),
  ...Object.entries(BOUND_TEXT_SURFACES).map(([fg, surfaces]) => ({ fg, surfaces })),
];

/** A pair of the contrast matrix with its resolved colours and their unrounded WCAG 2.2 ratio. */
export interface ContrastCheck {
  fg: string;
  bg: string;
  threshold: number;
  fgValue: string;
  bgValue: string;
  ratio: number;
}

/**
 * Walks the whole contrast matrix of `theme`: every threshold pair of `CONTRAST_PAIRS`, then every
 * text token of `TEXT_MATRIX` on each of its surfaces at 4.5:1, calling `callback` with each
 * resolved pair. A token resolves in the theme group and then in `scopes`, the group's ancestors:
 * `[rootConstants()]` gives the values of `resolved`, and the constants with other values (a
 * generated brand ramp in place of the `--wave-brand-N` declarations) run the same matrix on them.
 */
export function forEachContrastPair(
  theme: ThemeName,
  scopes: Decls[],
  callback: (check: ContrastCheck) => void,
): void {
  const chain = [themeDecls(theme), ...scopes];
  const textPairs = TEXT_MATRIX.flatMap(({ fg, surfaces }) =>
    surfaces.map((bg): [string, string, number] => [fg, bg, 4.5]),
  );
  for (const [fg, bg, threshold] of [...CONTRAST_PAIRS, ...textPairs]) {
    const fgValue = resolveToken(`--wave-${fg}`, chain);
    const bgValue = resolveToken(`--wave-${bg}`, chain);
    callback({ fg, bg, threshold, fgValue, bgValue, ratio: contrastRatio(fgValue, bgValue) });
  }
}

// ---------------------------------------------------------------------------------------------
// Brand seeds
// ---------------------------------------------------------------------------------------------

/**
 * The seeds the brand tests generate ramps from (`createBrandTokens`): the default blue, the
 * extremes of the wheel at full chroma (yellow, lime, magenta, spring green), mid and dark hues,
 * a pale pink, a dark navy, the greys (mid grey, black, white) and the other spellings (three
 * digits, upper case). Several have a channel at 0.
 */
export const BRAND_SEEDS = [
  '#0f6cbd',
  '#ffd400',
  '#00ff00',
  '#ff00ff',
  '#c43e00',
  '#008080',
  '#800080',
  '#8b4513',
  '#ffc0cb',
  '#001f3f',
  '#808080',
  '#000000',
  '#ffffff',
  '#00ff7f',
  '#F0F',
  '#C43E00',
] as const;
