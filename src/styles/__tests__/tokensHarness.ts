/**
 * Shared harness of the token tests: the small CSS parser, the `var()` resolver, the WCAG 2.2
 * contrast maths and the theme-group lookups of `src/styles/tokens.css`. `tokens.test.ts` and the
 * tests that prove properties of the tokens read them from here. The parser is not a general CSS
 * parser: it covers what the style files use (rules, at-rules, nested `@theme`/`@keyframes`
 * blocks and declarations).
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
