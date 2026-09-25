#!/usr/bin/env node
/**
 * Builds Wave's precompiled CSS with @tailwindcss/cli and asserts the result (repo-level#1,
 * spec §2.1.1 and §2.1.8):
 *
 *   src/styles/styles.css    -> <out>/styles.css     (`@mortenbrudvik/waveui/styles`)
 *   src/styles/preflight.css -> <out>/preflight.css  (`@mortenbrudvik/waveui/preflight.css`)
 *
 * Both files are minified and unlayered. The assertions on styles.css:
 *   - every theme rule of tokens.css (ramps, three theme groups, color-scheme rules) is present
 *     with the same properties, so every `--wave-*` variable ships;
 *   - every scoped base / native-reset rule of base.css is present with the same properties
 *     (property names only: the minifier rewrites values; the declared values of both source
 *     files are asserted by src/styles/__tests__/tokens.test.ts);
 *   - the `@keyframes wave-*` rules and the `animate-wave-*`, `bg-primary` and `text-body-1`
 *     utilities are present (the sources were scanned);
 *   - no top-level `@layer` other than Tailwind's `properties` fallback (the output is
 *     unlayered), and no Tailwind directive or `@import` survived;
 *   - no Tailwind theme variables leak (`--spacing:`, `--font-sans:`, `--color-red-500`,
 *     `--radius-`), so the file cannot override a Tailwind consumer's theme;
 *   - no class that occurs only in `stories/` is present (stories are never a source of dist):
 *     every story candidate in the file must also be a candidate of the library sources, an
 *     `@source inline()` safelist entry of styles.css, or a selector class of the style entries
 *     (`.wave-dark`, `.wave-root`); comments are never read as classes. Both sides are scanned
 *     the way the CLI build scans its sources, by Tailwind's scanner with scanner sources (every
 *     text file whatever its extension; binary and lock files are skipped, CSS files yield no
 *     candidates): the library side is the style entries' `@source` directives (src/components
 *     and src/lib without their tests), the story side is stories/;
 *   - no class that no class string of the library uses (x-styling-1): every class of the file
 *     is a whitespace-separated word of a string literal of a library script, a class of the
 *     style entries (safelist, selectors) or story-only (reported above). Tailwind reads every
 *     word of its sources, so a word of a comment or an identifier (`container`, `.filter(`)
 *     would otherwise ship as a global, unlayered utility; styles.css excludes such words with
 *     `@source not inline()`, and also the words of non-class strings, which this check cannot
 *     tell from classes;
 *   - every `wave-rtl:` class of a library class string is compiled with Wave's direction
 *     variant (src/styles/variants.css, R4): `:where(:dir(rtl))` under
 *     `@supports selector(:dir(rtl))` and the `[dir=rtl]` fallback under its negation;
 *   - no class with Tailwind's bare `rtl:`/`ltr:` variant ships (R4): they also match inside a
 *     subtree of the opposite direction.
 *
 * Usage: node scripts/build-css.mjs [--out-dir <dir>] [--check-only]
 *   --out-dir     output directory (default: dist)
 *   --check-only  skip the build and only assert the files already in the output directory
 *
 * The helpers are exported and tested by src/styles/__tests__/tokens.test.ts; importing the
 * module does not run the build. `main()` also takes the project root, so the tests run it end
 * to end on a fixture project. The script starts through verify-dist's `runScript`, so a file of
 * its name that cannot be matched to this module fails instead of passing without a check.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScript } from './verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const ENTRIES = [
  { input: 'src/styles/styles.css', output: 'styles.css' },
  { input: 'src/styles/preflight.css', output: 'preflight.css' },
];

const KEYFRAMES = ['wave-spin', 'wave-pulse', 'wave-indeterminate', 'wave-indeterminate-rtl'];

const REQUIRED_UTILITIES = [
  'bg-primary',
  'text-body-1',
  'animate-wave-spin',
  'animate-wave-spin-slow',
  'animate-wave-pulse',
  'animate-wave-indeterminate',
  'animate-wave-indeterminate-rtl',
];

/** Tailwind theme variables that must never ship in the precompiled CSS. */
const FORBIDDEN = ['--spacing:', '--font-sans:', '--color-red-500', '--radius-'];

// -------------------------------------------------------------------------------------------
// Minimal CSS parser (rules, at-rules, declarations; escape-, string- and comment-aware)
// -------------------------------------------------------------------------------------------

/** Index of the quote that closes the string opened at `open` (`text.length` if unterminated). */
function stringEnd(text, open) {
  let i = open + 1;
  while (i < text.length && text[i] !== text[open]) i += text[i] === '\\' ? 2 : 1;
  return Math.min(i, text.length);
}

/**
 * Parses CSS into nodes `{ prelude, children }`; `children` is null for declarations and
 * statements (`@import …;`). An escaped character is never syntax: Tailwind escapes the quotes,
 * brackets and punctuation of class names (`after:content-['*']` becomes
 * `.after\:content-\[\'\*\'\]`), and such a quote must not open a string.
 */
export function parseCss(css) {
  const nodes = [];
  let depth = 0;
  let start = 0;
  let bodyStart = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '\\') {
      i++;
    } else if (ch === '"' || ch === "'") {
      i = stringEnd(css, i);
    } else if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
    } else if (ch === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        nodes.push({
          prelude: stripComments(css.slice(start, bodyStart - 1)).trim(),
          children: parseCss(css.slice(bodyStart, i)),
        });
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      const statement = stripComments(css.slice(start, i)).trim();
      if (statement) nodes.push({ prelude: statement, children: null });
      start = i + 1;
    }
  }
  const rest = stripComments(css.slice(start)).trim();
  if (rest) nodes.push({ prelude: rest, children: null });
  return nodes;
}

/** Escapes and quoted strings, which are consumed whole so their content is never syntax. */
const ESCAPE_OR_STRING = String.raw`\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`;

function stripComments(css) {
  return css.replace(
    new RegExp(`(${ESCAPE_OR_STRING})|/\\*[\\s\\S]*?\\*/`, 'g'),
    (_, kept) => kept ?? '',
  );
}

/** `text` with every quoted string emptied, so no class name is read out of a string. */
function emptyStrings(text) {
  return text.replace(new RegExp(ESCAPE_OR_STRING, 'g'), (match) =>
    match.startsWith('\\') ? match : '""',
  );
}

/**
 * Splits `text` at each `separator` outside parentheses, brackets, braces and quoted strings; an
 * escaped character (`\,`, `\(`, `\'` in a class name) is never syntax. Mirrors Tailwind's own
 * `segment()`, which splits `@source inline()` candidates and brace alternatives.
 */
function splitTopLevel(text, separator) {
  const parts = [];
  const closers = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') i++;
    else if (ch === '"' || ch === "'") i = stringEnd(text, i);
    else if (ch === '(') closers.push(')');
    else if (ch === '[') closers.push(']');
    else if (ch === '{') closers.push('}');
    else if (closers.length > 0 && ch === closers[closers.length - 1]) closers.pop();
    else if (ch === separator && closers.length === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** Every node, depth first. */
function walk(nodes, visit, parents = []) {
  for (const node of nodes) {
    visit(node, parents);
    if (node.children) walk(node.children, visit, [...parents, node]);
  }
}

function isStyleRule(node) {
  return node.children !== null && !node.prelude.startsWith('@');
}

/** Declared property names of a rule. */
function propertyNames(node) {
  return (node.children ?? [])
    .filter((child) => child.children === null && !child.prelude.startsWith('@'))
    .map((child) => child.prelude.slice(0, child.prelude.indexOf(':')).trim());
}

/**
 * Normalises one selector so authored and minified forms compare equal: whitespace, commas,
 * legacy single-colon `:before`/`:after`, and unquoted attribute values.
 */
export function normalizeSelector(selector) {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*([>+~])\s*/g, '$1')
    .replace(/::(before|after)\b/g, ':$1')
    .replace(/\[([\w-]+)=(['"])([\w-]+)\2\]/g, '[$1=$3]')
    .trim();
}

/**
 * Splits a selector list at top-level commas (not inside `:is(…)`, `[…]`, a string or an escape
 * such as `.content-\[\'\(\'\]`) and normalises each selector.
 */
export function selectorList(prelude) {
  return splitTopLevel(prelude, ',').map(normalizeSelector);
}

/** Unescapes a CSS identifier (`hover\:bg-x` -> `hover:bg-x`, `\32 xl` -> `2xl`). */
function unescapeIdent(ident) {
  return ident.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g, (_, hex, char) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : char,
  );
}

function isKeyframes(node) {
  return /^@(?:-[a-z]+-)?keyframes\b/.test(node.prelude);
}

/** Class names (unescaped) of a selector; quoted strings (`[href$='.pdf']`) contribute none. */
function classesOf(selector) {
  return [...emptyStrings(selector).matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[\s\S]|[\w-])+)/g)].map(
    (match) => unescapeIdent(match[1]),
  );
}

/**
 * Class names used in the selectors of a stylesheet (unescaped). Quoted strings
 * (`[href$='.pdf']`) and keyframe selectors (`33.3%`) contribute none.
 */
export function selectorClasses(css) {
  const classes = new Set();
  walk(parseCss(css), (node, parents) => {
    if (!isStyleRule(node) || parents.some(isKeyframes)) return;
    for (const name of classesOf(node.prelude)) classes.add(name);
  });
  return classes;
}

const NUMERIC_RANGE = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/;

/** `{from..to}` or `{from..to..step}`, inclusive, counting towards `to` whatever the step's sign. */
function numericRange(range) {
  const [, from, to, by] = NUMERIC_RANGE.exec(range);
  const start = Number(from);
  const end = Number(to);
  const step = by === undefined ? 1 : Math.abs(Number(by));
  if (step === 0) throw new Error('Step cannot be zero in sequence expansion.');
  const values = [];
  if (start <= end) for (let n = start; n <= end; n += step) values.push(String(n));
  else for (let n = start; n >= end; n -= step) values.push(String(n));
  return values;
}

/**
 * Tailwind's brace expansion of one `@source inline()` candidate, in Tailwind's order:
 * `{hover:,}bg-x` -> `hover:bg-x bg-x`, `p-{1..3}` -> `p-1 p-2 p-3`, `m-{0..8..4}` -> `m-0 m-4 m-8`,
 * nestable (`bg-red-{50,{100..300..100}}`).
 */
export function expandBraces(pattern) {
  const open = pattern.indexOf('{');
  if (open === -1) return [pattern];
  let close = pattern.lastIndexOf('}');
  for (let i = open, depth = 0; i < pattern.length; i++) {
    if (pattern[i] === '{') depth++;
    else if (pattern[i] === '}' && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < open) throw new Error(`The pattern \`${pattern}\` is not balanced.`);
  const inside = pattern.slice(open + 1, close);
  const parts = (
    NUMERIC_RANGE.test(inside) ? numericRange(inside) : splitTopLevel(inside, ',')
  ).flatMap(expandBraces);
  const head = pattern.slice(0, open);
  return expandBraces(pattern.slice(close + 1)).flatMap((tail) =>
    parts.map((part) => head + part + tail),
  );
}

/**
 * Class names the style entries themselves put into the stylesheet: the `@source inline()`
 * safelist of styles.css (split and brace-expanded as Tailwind does; `@source not inline()` adds
 * nothing) and the selector classes of the entries (`.wave-dark`, `.dark`, `.wave-root`). Comments
 * and declarations are never read, so a class that a style entry only names in a comment is not a
 * library class.
 */
export function styleEntryClasses({ stylesCss, tokensCss, baseCss }) {
  const classes = new Set(
    [stylesCss, tokensCss, baseCss].flatMap((css) => [...selectorClasses(css)]),
  );
  walk(parseCss(stylesCss), (node) => {
    const inline = /^@source\s+inline\(\s*(["'])([\s\S]*)\1\s*\)$/.exec(node.prelude);
    if (!inline) return;
    for (const candidate of splitTopLevel(inline[2], ' ')) {
      for (const name of expandBraces(candidate)) if (name) classes.add(name);
    }
  });
  return classes;
}

// -------------------------------------------------------------------------------------------
// Assertions
// -------------------------------------------------------------------------------------------

/** Names of every `@layer` in the stylesheet (statements and blocks, at any depth). */
function layerNames(nodes) {
  const names = [];
  walk(nodes, (node) => {
    if (!/^@layer\b/.test(node.prelude)) return;
    const list = node.prelude.slice('@layer'.length).trim();
    names.push(...(list ? list.split(',').map((name) => name.trim()) : ['<anonymous>']));
  });
  return names;
}

function assertUnlayered(nodes, label, errors) {
  const foreign = layerNames(nodes).filter((name) => name !== 'properties');
  if (foreign.length > 0) {
    errors.push(`${label}: layered output (@layer ${[...new Set(foreign)].join(', ')})`);
  }
  walk(nodes, (node) => {
    if (
      /^@(import|tailwind|source|theme|apply|utility|variant|custom-variant|plugin|config)\b/.test(
        node.prelude,
      )
    ) {
      errors.push(`${label}: unprocessed directive "${node.prelude.slice(0, 60)}"`);
    }
  });
}

/**
 * Each style rule of `sourceCss` must reappear in `nodes`: every selector of the source rule is
 * present in some top-level rule of the output, and those rules together declare every property
 * the source rule declares.
 */
function assertRulesShipped(nodes, sourceCss, sourceLabel, errors) {
  const outputRules = nodes.filter(isStyleRule).map((node) => ({
    selectors: selectorList(node.prelude),
    properties: propertyNames(node),
  }));
  for (const rule of parseCss(sourceCss).filter(isStyleRule)) {
    const wanted = propertyNames(rule);
    for (const selector of selectorList(rule.prelude)) {
      const matching = outputRules.filter((output) => output.selectors.includes(selector));
      if (matching.length === 0) {
        errors.push(`styles.css: missing rule "${selector}" from ${sourceLabel}`);
        continue;
      }
      const shipped = new Set(matching.flatMap((output) => output.properties));
      const missing = wanted.filter((property) => !shipped.has(property));
      if (missing.length > 0) {
        errors.push(
          `styles.css: "${selector}" (${sourceLabel}) lacks ${missing.slice(0, 8).join(', ')}` +
            (missing.length > 8 ? ` and ${missing.length - 8} more` : ''),
        );
      }
    }
  }
}

/**
 * The scanner sources that the `@source` directives of a style entry register, exactly as
 * Tailwind's compiler registers them: `{ base: the entry's directory, pattern, negated }`
 * (`@source not '…'` is negated). `@source inline()` registers no files (see styleEntryClasses).
 */
export function sourceEntries(css, base) {
  const entries = [];
  walk(parseCss(css), (node) => {
    const source = /^@source\s+(not\s+)?(["'])([\s\S]*)\2$/.exec(node.prelude);
    if (source) entries.push({ base, pattern: source[3], negated: source[1] !== undefined });
  });
  return entries;
}

let oxide;

/**
 * Tailwind's own candidate extractor (`@tailwindcss/oxide`, the scanner the CLI build uses),
 * resolved through `@tailwindcss/cli`, which depends on it.
 */
function tailwindScanner(sources = []) {
  if (!oxide) {
    const cliRequire = createRequire(require.resolve('@tailwindcss/cli/package.json'));
    oxide = cliRequire('@tailwindcss/oxide');
  }
  return new oxide.Scanner({ sources });
}

/**
 * Every Tailwind candidate of the given sources, each either
 *   - a text `{ content, extension }`, extracted as given, or
 *   - a scanner source `{ base, pattern, negated }` (see sourceEntries), scanned exactly as the
 *     CLI build scans it: every text file Tailwind selects under it whatever its extension (never
 *     a binary or lock file, no candidates from CSS files), minus what a negated source excludes.
 */
function candidates(sources) {
  const texts = sources.filter((source) => 'content' in source);
  const scannerSources = sources.filter((source) => !('content' in source));
  const found = new Set(texts.length === 0 ? [] : tailwindScanner().scanFiles(texts));
  if (scannerSources.some((source) => !source.negated)) {
    for (const candidate of tailwindScanner(scannerSources).scan()) found.add(candidate);
  }
  return found;
}

/** The style entries whose own classes and `@source` directives the story-only check reads. */
function readStyleEntries(projectRoot) {
  const read = (name) => readFileSync(join(projectRoot, 'src/styles', name), 'utf8');
  return {
    stylesCss: read('styles.css'),
    tokensCss: read('tokens.css'),
    baseCss: read('base.css'),
  };
}

/**
 * The inputs of the story-only check for the project at `projectRoot`, as scanner sources:
 *   - `stories`: the stories/ directory;
 *   - `library`: the style entries' `@source` directives, resolved against src/styles as the CLI
 *     build resolves them (src/components and src/lib, tests excluded);
 *   - `libraryClasses`: the style entries' own classes (styleEntryClasses), never their full
 *     text: words in their comments and declarations are not classes the library uses.
 */
export function collectStorySources(projectRoot) {
  const entries = readStyleEntries(projectRoot);
  const stylesDir = join(projectRoot, 'src/styles');
  return {
    stories: [{ base: join(projectRoot, 'stories'), pattern: '**/*', negated: false }],
    library: Object.values(entries).flatMap((css) => sourceEntries(css, stylesDir)),
    libraryClasses: styleEntryClasses(entries),
  };
}

/**
 * Classes of the stylesheet that are candidates of `stories` but not of the library: the
 * candidates of the `library` sources (components and lib) plus `libraryClasses` (the style
 * entries' own classes, see `styleEntryClasses`). Both source lists take texts or scanner
 * sources (see `candidates`); the candidates are extracted with Tailwind's scanner and compared
 * as sets, so a story-only `w-1` is reported even when the library uses `w-10`.
 */
export function storyOnlyClasses(css, { stories, library, libraryClasses = [] }) {
  const classes = selectorClasses(css);
  const libraryCandidates = new Set([...candidates(library), ...libraryClasses]);
  return [...candidates(stories)]
    .filter((candidate) => classes.has(candidate) && !libraryCandidates.has(candidate))
    .sort();
}

let typescript;

/** The TypeScript compiler (a devDependency), loaded on first use. */
function ts() {
  typescript ??= require('typescript');
  return typescript;
}

const SCRIPT_KINDS = {
  ts: 'TS',
  mts: 'TS',
  cts: 'TS',
  tsx: 'TSX',
  js: 'JS',
  mjs: 'JS',
  cjs: 'JS',
  jsx: 'JSX',
};

/** The script kind TypeScript parses a file extension as; undefined when it is no script. */
function scriptKind(extension) {
  const kind = SCRIPT_KINDS[extension.toLowerCase()];
  return kind && ts().ScriptKind[kind];
}

/** Adds the whitespace-separated words of every string literal of a script to `tokens`. */
function addStringTokens(content, extension, tokens) {
  const kind = scriptKind(extension);
  if (kind === undefined) return;
  const { SyntaxKind, ScriptTarget, createSourceFile, forEachChild } = ts();
  const literal = new Set([
    SyntaxKind.StringLiteral,
    SyntaxKind.NoSubstitutionTemplateLiteral,
    SyntaxKind.TemplateHead,
    SyntaxKind.TemplateMiddle,
    SyntaxKind.TemplateTail,
  ]);
  const visit = (node) => {
    if (literal.has(node.kind)) {
      for (const word of node.text.split(/\s+/)) if (word) tokens.add(word);
    }
    forEachChild(node, visit);
  };
  visit(createSourceFile(`source.${extension}`, content, ScriptTarget.Latest, false, kind));
}

/**
 * The words of the class strings of the given sources (texts or scanner sources, as for
 * `candidates`): the whitespace-separated words of every string literal — quoted, JSX attribute
 * value or template literal chunk — of each JavaScript or TypeScript file. Comments, identifiers,
 * JSX text and files of other types contribute none.
 */
export function classStringTokens(sources) {
  const tokens = new Set();
  const scannerSources = sources.filter((source) => !('content' in source));
  for (const { content, extension } of sources.filter((source) => 'content' in source)) {
    addStringTokens(content, extension, tokens);
  }
  if (scannerSources.some((source) => !source.negated)) {
    const scanner = tailwindScanner(scannerSources);
    scanner.scan();
    for (const file of scanner.files) {
      addStringTokens(readFileSync(file, 'utf8'), extname(file).slice(1), tokens);
    }
  }
  return tokens;
}

/**
 * Classes of the stylesheet that no class string of the `library` sources uses (see
 * `classStringTokens`) and that are not `libraryClasses` (the style entries' own classes):
 * utilities Tailwind generated from words of comments, identifiers or non-script files. A word of
 * a non-class string (`addEventListener('blur', …)`) counts as used: styles.css excludes those.
 * `tokens` takes the library's class-string words when the caller already has them.
 */
export function strayClasses(
  css,
  { library, libraryClasses = [], tokens = classStringTokens(library) },
) {
  const used = new Set([...tokens, ...libraryClasses]);
  return [...selectorClasses(css)].filter((name) => !used.has(name)).sort();
}

/** Whether a class name carries Wave's direction variant (`wave-rtl:`, maybe after others). */
export function hasDirectionVariant(name) {
  return /(?:^|:)wave-rtl:/.test(name);
}

/**
 * The classes of the stylesheet with Tailwind's bare `rtl:`/`ltr:` variant (`not-rtl:`/`not-ltr:`
 * included). Tailwind compiles them with `[dir=rtl] *` / `[dir=ltr] *`, which also match inside a
 * subtree of the opposite direction, so Wave uses its own `wave-rtl:` only (R4).
 */
export function bareDirectionClasses(css) {
  return [...selectorClasses(css)]
    .filter((name) => /(?:^|:)(?:not-)?(?:rtl|ltr):/.test(name))
    .sort();
}

const DIR_SUPPORTED = /^@supports\s+selector\(\s*:dir\(rtl\)\s*\)$/;
const DIR_UNSUPPORTED = /^@supports\s+not\s+selector\(\s*:dir\(rtl\)\s*\)$/;

/**
 * The selectors a (possibly nested) style rule applies to: `&` in a nested rule stands for the
 * enclosing rule's selector, and a nested selector without `&` is its descendant.
 */
function resolvedSelectors(node, parents) {
  let resolved;
  for (const rule of [...parents.filter(isStyleRule), node]) {
    const own = selectorList(rule.prelude);
    resolved = resolved
      ? resolved.flatMap((outer) =>
          own.map((inner) =>
            /(?<!\\)&/.test(inner) ? inner.replace(/(?<!\\)&/g, () => outer) : `${outer} ${inner}`,
          ),
        )
      : own;
  }
  return resolved;
}

/**
 * The given `wave-rtl:` classes that the stylesheet does not compile with Wave's direction
 * variant (src/styles/variants.css): a rule for the class with `:where(:dir(rtl))` under
 * `@supports selector(:dir(rtl))`, and one with `:where([dir=rtl],[dir=rtl] *)` under
 * `@supports not selector(:dir(rtl))`. Minified (flat) and unminified (nested) output are read.
 */
export function missingDirectionVariant(css, classes) {
  const native = new Set();
  const fallback = new Set();
  walk(parseCss(css), (node, parents) => {
    if (!isStyleRule(node)) return;
    const supported = parents.some((parent) => DIR_SUPPORTED.test(parent.prelude));
    const unsupported = parents.some((parent) => DIR_UNSUPPORTED.test(parent.prelude));
    if (!supported && !unsupported) return;
    for (const selector of resolvedSelectors(node, parents)) {
      const names = classesOf(selector);
      if (supported && selector.includes(':where(:dir(rtl))')) {
        for (const name of names) native.add(name);
      }
      if (unsupported && selector.includes(':where([dir=rtl],[dir=rtl] *)')) {
        for (const name of names) fallback.add(name);
      }
    }
  });
  return [...new Set(classes)].filter((name) => !native.has(name) || !fallback.has(name)).sort();
}

export function assertStylesCss(css, { tokensCss, baseCss, storySources }) {
  const errors = [];
  const nodes = parseCss(css);
  assertUnlayered(nodes, 'styles.css', errors);

  // tokens.css: constants, theme groups and color-scheme rules (outside @theme).
  assertRulesShipped(nodes, tokensCss, 'tokens.css', errors);
  const declared = new Set();
  walk(nodes, (node) => {
    if (node.children === null && node.prelude.startsWith('--wave-')) {
      declared.add(node.prelude.slice(0, node.prelude.indexOf(':')).trim());
    }
  });
  const expectedVars = new Set(
    [...stripComments(tokensCss).matchAll(/(--wave-[\w-]+)\s*:/g)].map((match) => match[1]),
  );
  const missingVars = [...expectedVars].filter((name) => !declared.has(name));
  if (missingVars.length > 0) errors.push(`styles.css: missing ${missingVars.join(', ')}`);

  // base.css: scoped base and native-element reset.
  assertRulesShipped(nodes, baseCss, 'base.css', errors);
  const portalBackground = nodes
    .filter(isStyleRule)
    .filter((node) => selectorList(node.prelude).includes('.wave-portal'))
    .flatMap(propertyNames)
    .filter((property) => property.startsWith('background'));
  if (portalBackground.length > 0) errors.push('styles.css: .wave-portal paints a background');

  // Keyframes and utilities.
  const keyframes = new Set();
  walk(nodes, (node) => {
    const match = /^@keyframes\s+([\w-]+)$/.exec(node.prelude);
    if (match) keyframes.add(match[1]);
  });
  for (const name of KEYFRAMES) {
    if (!keyframes.has(name)) errors.push(`styles.css: missing @keyframes ${name}`);
  }
  const classes = selectorClasses(css);
  for (const name of REQUIRED_UTILITIES) {
    if (!classes.has(name)) errors.push(`styles.css: missing utility .${name}`);
  }

  // No foreign theme variables.
  for (const needle of FORBIDDEN) {
    if (css.includes(needle)) errors.push(`styles.css: contains "${needle}"`);
  }

  // No class with Tailwind's bare direction variants (R4).
  const bareDirection = bareDirectionClasses(css);
  if (bareDirection.length > 0) {
    errors.push(
      "styles.css: contains classes with Tailwind's bare rtl:/ltr: variant, which also matches " +
        `inside a subtree of the opposite direction (use wave-rtl:, R4): ${bareDirection.slice(0, 20).join(' ')}`,
    );
  }

  if (storySources) {
    // No story-only classes.
    const leaked = storyOnlyClasses(css, storySources);
    if (leaked.length > 0) {
      errors.push(`styles.css: contains story-only classes: ${leaked.slice(0, 20).join(' ')}`);
    }

    // No class that only a comment, an identifier or a non-script file names (a story-only
    // class is reported once, above).
    const tokens = classStringTokens(storySources.library);
    const stray = strayClasses(css, {
      tokens,
      libraryClasses: [...(storySources.libraryClasses ?? []), ...leaked],
    });
    if (stray.length > 0) {
      errors.push(
        'styles.css: contains classes that no class string of src/components or src/lib uses ' +
          '(words of comments, identifiers or other files; exclude them in ' +
          `src/styles/styles.css with @source not inline()): ${stray.slice(0, 20).join(' ')}`,
      );
    }

    // Every wave-rtl: class of the library compiled with Wave's direction variant (R4).
    const uncompiled = missingDirectionVariant(css, [...tokens].filter(hasDirectionVariant));
    if (uncompiled.length > 0) {
      errors.push(
        "styles.css: not compiled with Wave's wave-rtl variant (:where(:dir(rtl)) under " +
          '@supports selector(:dir(rtl)) and the [dir=rtl] fallback; is ' +
          `src/styles/variants.css imported?): ${uncompiled.slice(0, 20).join(' ')}`,
      );
    }
  }
  return errors;
}

export function assertPreflightCss(css) {
  const errors = [];
  const nodes = parseCss(css);
  assertUnlayered(nodes, 'preflight.css', errors);
  if (!/box-sizing:\s*border-box/.test(css)) errors.push('preflight.css: Preflight rules missing');
  if (css.includes('--wave-')) errors.push('preflight.css: contains Wave tokens');
  return errors;
}

// -------------------------------------------------------------------------------------------
// Build
// -------------------------------------------------------------------------------------------

function tailwindCli() {
  const manifestPath = require.resolve('@tailwindcss/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.tailwindcss;
  return join(dirname(manifestPath), bin);
}

function compile(cli, input, output, cwd) {
  const result = spawnSync(
    process.execPath,
    [cli, '--input', input, '--output', output, '--minify'],
    { cwd, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `tailwindcss failed for ${input} (exit ${result.status}):\n${result.stderr}${result.stdout}`,
    );
  }
}

function parseArgs(argv, projectRoot) {
  const options = { outDir: join(projectRoot, 'dist'), checkOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir') options.outDir = resolve(argv[++i]);
    else if (argv[i] === '--check-only') options.checkOnly = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return options;
}

/**
 * Builds (unless `--check-only`) and asserts the precompiled CSS; returns the exit code.
 * `projectRoot` (default: this repository) holds src/styles, the sources and stories/.
 */
export function main(argv = process.argv.slice(2), { projectRoot = root } = {}) {
  const { outDir, checkOnly } = parseArgs(argv, projectRoot);
  if (!checkOnly) {
    mkdirSync(outDir, { recursive: true });
    const cli = tailwindCli();
    for (const { input, output } of ENTRIES) {
      compile(cli, join(projectRoot, input), join(outDir, output), projectRoot);
    }
  }

  const inside = relative(projectRoot, outDir);
  const where = (inside && !inside.startsWith('..') ? inside : outDir).split('\\').join('/');
  const missing = ENTRIES.map(({ output }) => join(outDir, output)).filter(
    (file) => !existsSync(file),
  );
  if (missing.length > 0) {
    for (const file of missing) {
      console.error(`build-css: ${file} does not exist (run without --check-only to build it)`);
    }
    return 1;
  }

  const read = (file) => readFileSync(file, 'utf8');
  const { tokensCss, baseCss } = readStyleEntries(projectRoot);
  const errors = [
    ...assertStylesCss(read(join(outDir, 'styles.css')), {
      tokensCss,
      baseCss,
      storySources: collectStorySources(projectRoot),
    }),
    ...assertPreflightCss(read(join(outDir, 'preflight.css'))),
  ];

  if (errors.length > 0) {
    console.error(`build-css: ${errors.length} problem(s) in ${where}:`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }
  const size = (name) => `${(statSync(join(outDir, name)).size / 1024).toFixed(1)} kB`;
  console.log(
    `build-css: ${where}/styles.css (${size('styles.css')}) and ${where}/preflight.css ` +
      `(${size('preflight.css')}) OK`,
  );
  return 0;
}

await runScript(import.meta.url, main);
