#!/usr/bin/env node
/**
 * Builds Wave's precompiled CSS with @tailwindcss/cli and asserts the result (repo-level#1,
 * spec §2.1.1 and §2.1.8; Phase 14 spec R6):
 *
 *   src/styles/styles.css    -> <out>/styles.css      (`@mortenbrudvik/waveui/styles`)
 *   src/styles/styles.css    -> <out>/components.css  (internal: only `./tailwind` imports it)
 *   src/styles/utilities.css -> <out>/utilities.css   (`@mortenbrudvik/waveui/utilities`)
 *   src/styles/preflight.css -> <out>/preflight.css   (`@mortenbrudvik/waveui/preflight.css`)
 *
 * styles.css compiles the utilities against src/styles/theme.css, the internal, unnamespaced
 * theme (`--color-primary: var(--wave-primary)`, the type ramp, the shadows, …), which only it
 * imports: an `@theme inline reference` block, so no theme variable of it is emitted (1.0, spec
 * R6 of Phase 14; apps get the namespaced keys of tokens.css).
 *
 * components.css is styles.css without its `@import` of tokens.css and of base.css (see
 * `componentsSource`; the CLI reads that text from stdin in src/styles): the components'
 * utilities alone, which the `./tailwind` entry imports into `layer(components)` next to
 * tokens.css in `layer(theme)` and base.css in `layer(base)`, so an app's own layered token
 * overrides and `@layer base` element styles keep winning over Wave's as in 0.18 (spec §6, Task 1,
 * checks 15 and 18). utilities.css is src/styles/utilities.css plus an `@source inline()` list
 * generated from the namespaced theme keys of tokens.css (see `namespacedUtilities`): the token
 * utilities of apps without Tailwind (`bg-wave-primary`, `text-wave-body-1`, `shadow-wave-4`,
 * `font-wave`, `animate-wave-spin`, …), without variants, unlayered (ruling BL: its class
 * selectors beat the zero-specificity base styles of styles.css inside `.wave-root`, which a
 * layered class would lose to; the app's own unlayered CSS after it wins by source order).
 *
 * The four outputs are minified and unlayered. The assertions on styles.css:
 *   - every theme rule of tokens.css (ramps, three theme groups, color-scheme rules) is present
 *     with the same properties, so every `--wave-*` variable ships, and no rule selects `.dark`
 *     or `.high-contrast`, the theme classes 1.0 removed (the themes are `.wave-light`,
 *     `.wave-dark` and `.wave-high-contrast`);
 *   - every scoped base / native-reset rule of base.css is present with the same properties
 *     (property names only: the minifier rewrites values; the declared values of both source
 *     files are asserted by src/styles/__tests__/tokens.test.ts), and a declaration that is
 *     `!important` in the source (the `hidden` rule) is `!important` in the output too;
 *   - the `@keyframes wave-*` rules and the `animate-wave-*`, `bg-primary` and `text-body-1`
 *     utilities are present (the sources were scanned), and so are three representatives of the
 *     motion recipes of src/lib/motion.ts (`duration-wave-gentle`,
 *     `data-[presence=exiting]:opacity-0`, `data-[presence=entered]:contents`), each with the
 *     utility prefix when one is set (`wave:bg-primary`);
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
 *   - no class that no class string of the library uses: every class of the file
 *     is a whitespace-separated word of a string literal of a library script, a class of the
 *     style entries (safelist, selectors) or story-only (reported above). Tailwind reads every
 *     word of its sources, so a word of a comment or an identifier (`container`, `.filter(`)
 *     would otherwise ship as a global, unlayered utility. With the utility prefix only a word
 *     that carries it generates (a comment naming a `wave:` class that no string uses); without
 *     one, styles.css excluded such words with `@source not inline()`, and also the words of
 *     non-class strings, which this check cannot tell from classes;
 *   - every `wave-rtl:` class of a library class string is compiled with Wave's direction
 *     variant (src/styles/variants.css, C-LOGICAL): `:where(:nth-child(n of :dir(rtl)))` under
 *     `@supports selector(:nth-child(n of :dir(rtl)))` and the `[dir=rtl]` fallback under its
 *     negation (a bare `:dir(rtl)` does not count: an app's CSS minifier may rewrite it);
 *   - no class with Tailwind's bare `rtl:`/`ltr:` variant ships (C-LOGICAL): they also match inside
 *     a subtree of the opposite direction.
 *
 * The assertions on components.css (`assertComponentsCss`):
 *   - unlayered (only Tailwind's `properties` fallback), no Tailwind directive;
 *   - no token rule and no theme variable: no rule selects `:root` or a selector of a tokens.css
 *     or base.css rule, no declaration of a token tokens.css declares (a component's own custom
 *     property, `--wave-card-padding`, is none) or of a theme key (`--color-*`, `--text-*`,
 *     `--shadow-*`, `--font-*`, `--animate-*`, `--ease-*`), and none of the Tailwind theme
 *     variables of the styles.css list above;
 *   - it is styles.css without the rules of tokens.css and base.css: the same other nodes
 *     (utilities, `@supports` blocks, keyframes, `@property` registrations), byte for byte and in
 *     the same order, so every utility, keyframe and `wave-rtl:` rule of styles.css is there.
 *
 * The assertions on utilities.css (`assertUtilitiesCss`):
 *   - exactly the generated classes, every one of them: a namespaced theme key of tokens.css
 *     yields its utilities, nothing else ships (no variant, no unnamespaced or other utility);
 *   - unlayered: no `@layer` but Tailwind's `properties` fallback, no style rule of a class inside
 *     one, no Tailwind directive;
 *   - no token rule and no theme variable (no `:root` rule, no custom property other than
 *     Tailwind's `--tw-*`), and the `@keyframes wave-*` of the animations;
 *   - every custom property a declaration reads (`var(--name)`) is Tailwind's `--tw-*` or one that
 *     styles.css declares (a token): a namespaced key mapped to a theme variable instead of a
 *     token would read a `var(--color-wave-*)` that no stylesheet of a plain app declares.
 *
 * The utility prefix (Phase 14 spec R6): `UTILITY_PREFIX` of src/lib/cn.ts, read from the file's
 * text (`readUtilityPrefix`; a declaration that cannot be read stops the build). While it is
 * empty, the build says so in one line and checks nothing more. Once it is set:
 *   - the compile check runs first, before any compile: scripts/prefix-codemod.mjs `--check` over
 *     src/components, src/lib and src/hooks (the string literals of the TypeScript AST, in two
 *     tiers: no unprefixed utility word, and no prefixed word that compiles to nothing, in a
 *     literal the class-context tracing reaches; elsewhere only the words
 *     scripts/prefix-allowlist.json names for that file; and no prefixed word at all in
 *     src/hooks, which no `@source` scans). A finding fails the build, and a pass prints one line
 *     with what it read;
 *   - every class of styles.css that is no selector class of the style entries (`.wave-root`,
 *     the theme classes) starts with `<prefix>:`, and the required utilities are looked up with
 *     the prefix;
 *   - every custom property styles.css declares is a token tokens.css declares, Tailwind's
 *     `--tw-*`, or one an arbitrary-property utility of the library declares (`--option-bg`,
 *     `--wave-card-padding`), and none refers to itself: no theme variable ships (the
 *     `--spacing:`-style needles above cannot see a leak under the prefix, which would be named
 *     `--wave-spacing`, and a theme key `--shadow-4` would become the self-reference
 *     `--wave-shadow-4: var(--wave-shadow-4)`, a token's name).
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

/**
 * The outputs, each compiled from `input` (relative to the project root). With `source`, the CLI
 * compiles `source(text of input, style entries)` from stdin in the input's directory instead of
 * the file itself, so relative `@import` and `@source` paths resolve as in the file.
 */
const ENTRIES = [
  { input: 'src/styles/styles.css', output: 'styles.css' },
  {
    input: 'src/styles/styles.css',
    output: 'components.css',
    source: (stylesCss) => componentsSource(stylesCss),
  },
  {
    input: 'src/styles/utilities.css',
    output: 'utilities.css',
    source: (utilitiesCss, { tokensCss }) => utilitiesSource(utilitiesCss, tokensCss),
  },
  { input: 'src/styles/preflight.css', output: 'preflight.css' },
];

/** The output files, in the order of the build report. */
export const OUTPUTS = ENTRIES.map(({ output }) => output);

const KEYFRAMES = ['wave-spin', 'wave-pulse', 'wave-indeterminate', 'wave-indeterminate-rtl'];

const REQUIRED_UTILITIES = [
  'bg-primary',
  'text-body-1',
  'animate-wave-spin',
  'animate-wave-spin-slow',
  'animate-wave-pulse',
  'animate-wave-indeterminate',
  'animate-wave-indeterminate-rtl',
  // Representatives of the motion recipes of src/lib/motion.ts (0.15): a Wave duration token, an
  // exit class keyed on the presence core's phase, and the collapse wrappers' box-less entered
  // phase (collapseStructure, inlineDrawerStructure).
  'duration-wave-gentle',
  'data-[presence=exiting]:opacity-0',
  'data-[presence=entered]:contents',
];

/** Tailwind theme variables that must never ship in the precompiled CSS. */
const FORBIDDEN = ['--spacing:', '--font-sans:', '--color-red-500', '--radius-'];

/** The 0.4 theme classes, deprecated in 0.5 and removed in 1.0: no rule may select them. */
const REMOVED_THEME_CLASSES = ['dark', 'high-contrast'];

// -------------------------------------------------------------------------------------------
// The utility prefix and the compile check (Phase 14 spec R6)
// -------------------------------------------------------------------------------------------

/** The module that declares the prefix, relative to the project root. */
const CN_MODULE = 'src/lib/cn.ts';

/** The directories the compile check reads, relative to the project root. */
const COMPILE_CHECK_PATHS = ['src/components', 'src/lib', 'src/hooks'];

/**
 * The directories of COMPILE_CHECK_PATHS that hold no class string: no `@source` of styles.css
 * scans them, so a prefixed word there would compile to nothing (`--class-free`).
 */
const CLASS_FREE_PATHS = ['src/hooks'];

/**
 * The value of `UTILITY_PREFIX` in the text of src/lib/cn.ts (`export const UTILITY_PREFIX:
 * string = 'wave';`), read without importing TypeScript. Throws when the declaration is missing,
 * declared twice or not a plain string literal: the check must never be skipped by accident.
 */
export function readUtilityPrefix(cnSource) {
  const declarations = cnSource.match(/^export const UTILITY_PREFIX\b/gm) ?? [];
  const found = [
    ...cnSource.matchAll(
      /^export const UTILITY_PREFIX(?:\s*:\s*string)?\s*=\s*(['"])([^'"\\]*)\1\s*;/gm,
    ),
  ];
  if (declarations.length !== 1 || found.length !== 1) {
    throw new Error(
      `readUtilityPrefix: ${CN_MODULE} must declare \`export const UTILITY_PREFIX: string = '…';\` ` +
        `once, with a string literal (found ${declarations.length} declaration(s), ` +
        `${found.length} readable)`,
    );
  }
  const prefix = found[0][2];
  if (prefix && !/^[a-z][a-z0-9]*$/.test(prefix)) {
    throw new Error(
      `readUtilityPrefix: "${prefix}" is no Tailwind prefix (lowercase letters and digits)`,
    );
  }
  return prefix;
}

/**
 * The utility prefix of the project at `projectRoot` (see readUtilityPrefix), or `undefined` for a
 * project without src/lib/cn.ts (a fixture of the tests: nothing to check, nothing said).
 */
export function utilityPrefixOf(projectRoot) {
  const path = join(projectRoot, CN_MODULE);
  return existsSync(path) ? readUtilityPrefix(readFileSync(path, 'utf8')) : undefined;
}

/**
 * The compile check of the project at `projectRoot` for `prefix`: runs scripts/prefix-codemod.mjs
 * `--check` (this repository's, with `--root projectRoot`; the allowlist is the project's
 * scripts/prefix-allowlist.json) over the existing directories of src/components, src/lib and
 * src/hooks, the last `--class-free` (no prefixed word: styles.css scans none of it).
 * Returns `{ ok, lines }`: the check's report, or why it could not run.
 */
export function compileCheck(projectRoot, prefix) {
  const codemod = join(dirname(fileURLToPath(import.meta.url)), 'prefix-codemod.mjs');
  const paths = COMPILE_CHECK_PATHS.filter((path) => existsSync(join(projectRoot, path)));
  if (paths.length === 0)
    return { ok: true, lines: ['compile check: no src/components, src/lib or src/hooks'] };
  const classFree = CLASS_FREE_PATHS.filter((path) => paths.includes(path)).flatMap((path) => [
    '--class-free',
    path,
  ]);
  const result = spawnSync(
    process.execPath,
    [codemod, '--check', '--root', projectRoot, '--prefix', prefix, ...classFree, ...paths],
    { encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  const lines = `${result.stdout}${result.stderr}`.split(/\r?\n/).filter(Boolean);
  if (result.status === 0) return { ok: true, lines };
  if (result.status === 1 && /^prefix-codemod --check: /.test(lines[0] ?? '')) {
    return { ok: false, lines };
  }
  return {
    ok: false,
    lines: [`prefix-codemod --check could not run (exit ${result.status})`, ...lines.slice(0, 20)],
  };
}

/**
 * The one-line summary of a passing compile check, from the report line of
 * `prefix-codemod --check`: `prefix wave: 4355 class words in 273 files, 131 allowlisted pairs`.
 */
export function compileCheckSummary(lines, prefix) {
  const report = lines[0] ?? '';
  const words = /(\d+) prefixed class word\(s\)/.exec(report)?.[1] ?? '?';
  const files = /of (\d+) file\(s\)/.exec(report)?.[1] ?? '?';
  const pairs = /\((\d+) word-file pair\(s\)/.exec(report)?.[1] ?? '?';
  return `prefix ${prefix}: ${words} class words in ${files} files, ${pairs} allowlisted pairs`;
}

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

/** Property names of a rule's `!important` declarations. */
function importantPropertyNames(node) {
  return (node.children ?? [])
    .filter((child) => child.children === null && /!\s*important\s*$/i.test(child.prelude))
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
 * nothing) and the selector classes of the entries (`.wave-dark`, `.wave-root`). Comments
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
// Derived sources: components.css and utilities.css
// -------------------------------------------------------------------------------------------

/** The `@import` statements of tokens.css and base.css in a style entry, each with its line end. */
const TOKEN_AND_BASE_IMPORT = /^@import\s+(["'])\.\/(tokens|base)\.css\1\s*;[^\S\n]*\n?/gm;

/**
 * The source of components.css: styles.css (`stylesCss`) without its `@import` of tokens.css and
 * of base.css, so it compiles the same utilities, keyframes and `@property` registrations without
 * the token rules and the scoped base. Throws unless styles.css imports each of the two once, as
 * plain statements: a renamed import would otherwise put the tokens into the `./tailwind` entry's
 * `components` layer (or leave the base out of `./styles`).
 */
export function componentsSource(stylesCss) {
  const removed = [...stylesCss.matchAll(TOKEN_AND_BASE_IMPORT)].map((match) => match[2]).sort();
  if (removed.join(' ') !== 'base tokens') {
    throw new Error(
      "componentsSource: styles.css must @import './tokens.css' and './base.css' once each " +
        `(found: ${removed.length > 0 ? removed.join(', ') : 'neither'})`,
    );
  }
  return stylesCss.replace(TOKEN_AND_BASE_IMPORT, '');
}

/**
 * The utilities of a namespaced theme key of tokens.css, by the key's namespace. A color yields
 * its six color utilities; the type ramp, the shadows, the font families and the animations one
 * each. Sub-keys (`--text-wave-body-1--line-height`), the motion keys
 * (`--transition-duration-wave-*`, `--ease-wave-*`) and any unnamespaced key yield none.
 */
const NAMESPACED_UTILITIES = [
  [
    /^--color-(wave-[\w-]+)$/,
    (name) => ['bg', 'text', 'border', 'ring', 'fill', 'stroke'].map((u) => `${u}-${name}`),
  ],
  [/^--text-(wave-(?:(?!--)[\w-])+)$/, (name) => [`text-${name}`]],
  [/^--shadow-(wave-[\w-]+)$/, (name) => [`shadow-${name}`]],
  [/^--font-(wave(?:-[\w-]+)?)$/, (name) => [`font-${name}`]],
  [/^--animate-(wave-[\w-]+)$/, (name) => [`animate-${name}`]],
];

/**
 * The classes of utilities.css, generated from the namespaced keys of the `@theme` blocks of
 * tokens.css (`tokensCss`): `bg-`, `text-`, `border-`, `ring-`, `fill-` and `stroke-wave-<color>`,
 * `text-wave-<step>` of the type ramp, `shadow-wave-<level>`, `font-wave` and its families, and
 * `animate-wave-<name>`; sorted, without duplicates. No list is kept by hand: a key added to
 * tokens.css adds its utilities.
 */
export function namespacedUtilities(tokensCss) {
  const classes = new Set();
  walk(parseCss(tokensCss), (node, parents) => {
    if (node.children !== null || !node.prelude.startsWith('--')) return;
    if (!parents.some((parent) => /^@theme\b/.test(parent.prelude))) return;
    const key = node.prelude.slice(0, node.prelude.indexOf(':')).trim();
    for (const [pattern, utilities] of NAMESPACED_UTILITIES) {
      const match = pattern.exec(key);
      if (match) for (const name of utilities(match[1])) classes.add(name);
    }
  });
  return [...classes].sort();
}

/**
 * The source of utilities.css: src/styles/utilities.css (`utilitiesCss`, which imports tokens.css
 * as a reference and Tailwind's utilities, unlayered, without sources) and an
 * `@source inline()` of the classes `namespacedUtilities` generates from `tokensCss`. Throws when
 * tokens.css declares no namespaced key.
 */
export function utilitiesSource(utilitiesCss, tokensCss) {
  const classes = namespacedUtilities(tokensCss);
  if (classes.length === 0) {
    throw new Error(
      'utilitiesSource: tokens.css declares no namespaced theme key (--color-wave-*, …)',
    );
  }
  return `${utilitiesCss.trimEnd()}\n\n@source inline('${classes.join(' ')}');\n`;
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
  assertLayers(nodes, label, [], errors);
}

/**
 * The output declares no `@layer` but the `allowed` ones and Tailwind's `properties` fallback
 * (with no layer allowed, "layered output"), and no Tailwind directive survived.
 */
function assertLayers(nodes, label, allowed, errors) {
  const foreign = layerNames(nodes).filter(
    (name) => name !== 'properties' && !allowed.includes(name),
  );
  if (foreign.length > 0) {
    errors.push(
      allowed.length === 0
        ? `${label}: layered output (@layer ${[...new Set(foreign)].join(', ')})`
        : `${label}: a layer other than ${allowed.join(', ')} (@layer ${[...new Set(foreign)].join(', ')})`,
    );
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
 * the source rule declares, `!important` where the source declares it so.
 */
function assertRulesShipped(nodes, sourceCss, sourceLabel, errors) {
  const outputRules = nodes.filter(isStyleRule).map((node) => ({
    selectors: selectorList(node.prelude),
    properties: propertyNames(node),
    important: importantPropertyNames(node),
  }));
  for (const rule of parseCss(sourceCss).filter(isStyleRule)) {
    const wanted = propertyNames(rule);
    const wantedImportant = importantPropertyNames(rule);
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
      const shippedImportant = new Set(matching.flatMap((output) => output.important));
      const notImportant = wantedImportant.filter(
        (property) => shipped.has(property) && !shippedImportant.has(property),
      );
      if (notImportant.length > 0) {
        errors.push(
          `styles.css: "${selector}" (${sourceLabel}) lacks !important on ${notImportant.join(', ')}`,
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
 * subtree of the opposite direction, so Wave uses its own `wave-rtl:` only (C-LOGICAL).
 */
export function bareDirectionClasses(css) {
  return [...selectorClasses(css)]
    .filter((name) => /(?:^|:)(?:not-)?(?:rtl|ltr):/.test(name))
    .sort();
}

/**
 * Wave's direction variant (src/styles/variants.css) selects by `:nth-child(n of :dir(rtl))`,
 * which matches exactly the elements `:dir(rtl)` matches. Lightning CSS keeps that form, whereas
 * it rewrites a bare `:dir(rtl)` to a `:lang()` list for targets below Chrome 120 (Vite's default
 * CSS minifier and target). esbuild and cssnano print it without the space before `:dir`.
 */
const DIR_NATIVE = String.raw`:nth-child\(\s*n\s+of\s*:dir\(rtl\)\s*\)`;
const DIR_SUPPORTED = new RegExp(String.raw`^@supports\s+selector\(\s*${DIR_NATIVE}\s*\)$`);
const DIR_UNSUPPORTED = new RegExp(String.raw`^@supports\s+not\s+selector\(\s*${DIR_NATIVE}\s*\)$`);
const DIR_NATIVE_SELECTOR = new RegExp(String.raw`:where\(${DIR_NATIVE}\)`);

/** How Wave's direction variant compiles, for the messages of the gates. */
export const DIRECTION_VARIANT_FORM =
  ':where(:nth-child(n of :dir(rtl))) under @supports selector(:nth-child(n of :dir(rtl))) ' +
  'and the [dir=rtl] fallback';

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
 * variant (src/styles/variants.css): a rule for the class with
 * `:where(:nth-child(n of :dir(rtl)))` under `@supports selector(:nth-child(n of :dir(rtl)))`,
 * and one with `:where([dir=rtl],[dir=rtl] *)` under the negation. A bare `:where(:dir(rtl))`
 * does not count: CSS minifiers rewrite it to `:lang()`. Minified (flat) and unminified (nested)
 * output are read.
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
      if (supported && DIR_NATIVE_SELECTOR.test(selector)) {
        for (const name of names) native.add(name);
      }
      if (unsupported && selector.includes(':where([dir=rtl],[dir=rtl] *)')) {
        for (const name of names) fallback.add(name);
      }
    }
  });
  return [...new Set(classes)].filter((name) => !native.has(name) || !fallback.has(name)).sort();
}

/**
 * The `wave-rtl:` classes of the stylesheet that a rule selects by `:lang()`: a CSS minifier
 * rewrote the variant's `:dir(rtl)` (Lightning CSS, Vite's default, does so for targets below
 * Chrome 120), so they never match a page that sets `dir` without a right-to-left `lang`.
 */
export function loweredDirectionClasses(css) {
  const lowered = new Set();
  walk(parseCss(css), (node, parents) => {
    if (!isStyleRule(node) || parents.some(isKeyframes)) return;
    for (const selector of resolvedSelectors(node, parents)) {
      if (!selector.includes(':lang(')) continue;
      for (const name of classesOf(selector)) {
        if (hasDirectionVariant(name)) lowered.add(name);
      }
    }
  });
  return [...lowered].sort();
}

export function assertStylesCss(css, { tokensCss, baseCss, storySources, prefix = '' }) {
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
    const required = prefix ? `${prefix}:${name}` : name;
    if (!classes.has(required)) errors.push(`styles.css: missing utility .${required}`);
  }

  // No foreign theme variables.
  for (const needle of FORBIDDEN) {
    if (css.includes(needle)) errors.push(`styles.css: contains "${needle}"`);
  }

  // With the utility prefix (Phase 14 spec R6): every utility carries it, and no theme variable
  // ships under any name.
  if (prefix) errors.push(...assertPrefixedCss(css, { prefix, tokensCss, baseCss }));

  // No rule of a removed theme class.
  const removedThemes = REMOVED_THEME_CLASSES.filter((name) => classes.has(name));
  if (removedThemes.length > 0) {
    errors.push(
      `styles.css: selects the theme classes 1.0 removed (${removedThemes.map((name) => `.${name}`).join(', ')}); ` +
        'the themes are .wave-light, .wave-dark and .wave-high-contrast',
    );
  }

  // No class with Tailwind's bare direction variants (C-LOGICAL).
  const bareDirection = bareDirectionClasses(css);
  if (bareDirection.length > 0) {
    errors.push(
      "styles.css: contains classes with Tailwind's bare rtl:/ltr: variant, which also matches " +
        `inside a subtree of the opposite direction (use Wave's wave-rtl: variant): ${bareDirection.slice(0, 20).join(' ')}`,
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

    // Every wave-rtl: class of the library compiled with Wave's direction variant (C-LOGICAL).
    const uncompiled = missingDirectionVariant(css, [...tokens].filter(hasDirectionVariant));
    if (uncompiled.length > 0) {
      errors.push(
        `styles.css: not compiled with Wave's wave-rtl variant (${DIRECTION_VARIANT_FORM}; is ` +
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

/** Custom properties a theme key or a Tailwind default would declare as a theme variable. */
const THEME_VARIABLE =
  /^--(?:color|text|shadow|font|animate|ease|transition-duration|spacing|radius)(?:-|$)/;

/** The names of every custom property the stylesheet declares (outside `@property` rules). */
function declaredCustomProperties(nodes) {
  const names = [];
  walk(nodes, (node, parents) => {
    if (node.children !== null || !node.prelude.startsWith('--')) return;
    if (parents.some((parent) => /^@property\b/.test(parent.prelude))) return;
    names.push(node.prelude.slice(0, node.prelude.indexOf(':')).trim());
  });
  return names;
}

/**
 * The assertions of a prefixed styles.css (`css`, built with `prefix(<prefix>)`; see the header):
 *   - every class is `<prefix>:`-prefixed, but the selector classes of tokens.css and base.css
 *     (`.wave-root`, `.wave-portal`, the theme classes), which no utility declares;
 *   - every declared custom property is a token tokens.css declares, Tailwind's `--tw-*`, or one
 *     that an arbitrary-property utility declares in its own rule (`.wave:[--option-bg:…]`): a
 *     theme variable (`--spacing`, `--color-primary`) is none of them;
 *   - no declaration refers to itself (`--wave-shadow-4: var(--wave-shadow-4)`): what a theme
 *     key `--shadow-4` becomes under the prefix `wave` when theme.css loses `reference`. Its name
 *     is a token's, so the rule above lets it pass; the value never is a token's.
 */
export function assertPrefixedCss(css, { prefix, tokensCss, baseCss }) {
  const errors = [];
  const own = new Set([...selectorClasses(tokensCss), ...selectorClasses(baseCss)]);
  const unprefixed = [...selectorClasses(css)]
    .filter((name) => !own.has(name) && !name.startsWith(`${prefix}:`))
    .sort();
  if (unprefixed.length > 0) {
    errors.push(
      `styles.css: holds classes without the utility prefix ${prefix}: (is the sheet built with ` +
        `prefix(${prefix})?): ${unprefixed.slice(0, 20).join(' ')}`,
    );
  }
  const tokens = tokenNamesOf(tokensCss);
  const foreign = new Set();
  const selfReferences = new Set();
  walk(parseCss(css), (node, parents) => {
    if (node.children !== null || !node.prelude.startsWith('--')) return;
    if (parents.some((parent) => /^@property\b/.test(parent.prelude))) return;
    const colon = node.prelude.indexOf(':');
    const name = node.prelude.slice(0, colon).trim();
    const value = node.prelude.slice(colon + 1).trim();
    if (value.replace(/\s+/g, '') === `var(${name})`) selfReferences.add(name);
    if (tokens.has(name) || name.startsWith('--tw-')) return;
    // A property an arbitrary-property utility sets (`[--option-bg:transparent]`), in its rule.
    const rule = [...parents].reverse().find(isStyleRule);
    const declaredByUtility =
      rule && classesOf(rule.prelude).some((cls) => cls.includes(`[${name}:`));
    if (!declaredByUtility) foreign.add(name);
  });
  if (foreign.size > 0) {
    errors.push(
      'styles.css: declares custom properties that are no token, no --tw-* property and no ' +
        `arbitrary property of a utility (theme variables?): ${[...foreign].sort().slice(0, 20).join(', ')}`,
    );
  }
  if (selfReferences.size > 0) {
    errors.push(
      'styles.css: declares custom properties that refer to themselves (a theme key emitted ' +
        `under the prefix: has theme.css lost \`reference\`?): ${[...selfReferences].sort().join(', ')}`,
    );
  }
  return errors;
}

/** The selectors (normalised) of the style rules of the stylesheets, which `:root` rules use. */
function ruleSelectors(...sources) {
  return new Set(
    sources.flatMap((css) =>
      parseCss(css)
        .filter(isStyleRule)
        .flatMap((rule) => selectorList(rule.prelude)),
    ),
  );
}

/** Whether a top-level node of a stylesheet is a rule of tokens.css or base.css. */
function isTokenOrBaseRule(node, tokenAndBaseSelectors) {
  return (
    isStyleRule(node) &&
    selectorList(node.prelude).every((selector) => tokenAndBaseSelectors.has(selector))
  );
}

/** Minified CSS of parsed (comment-free) nodes, for comparing two outputs node by node. */
function serializeNodes(nodes) {
  return nodes.map((node) =>
    node.children === null
      ? `${node.prelude};`
      : `${node.prelude}{${serializeNodes(node.children).join('')}}`,
  );
}

/**
 * No token rule, theme variable or `:root` rule in an output that must hold none (components.css,
 * utilities.css). `allowedProperty(name)` tells a custom property the output may declare.
 */
function assertNoTokens(
  nodes,
  label,
  { tokenAndBaseSelectors, tokenNames, allowedProperty },
  errors,
) {
  const rootRules = [];
  const foreignRules = [];
  walk(nodes, (node, parents) => {
    if (!isStyleRule(node) || parents.some(isKeyframes)) return;
    for (const selector of selectorList(node.prelude)) {
      if (selector.includes(':root')) rootRules.push(selector);
      else if (tokenAndBaseSelectors.has(selector)) foreignRules.push(selector);
    }
  });
  if (rootRules.length > 0) {
    errors.push(`${label}: holds a :root rule (${[...new Set(rootRules)].join(' ')})`);
  }
  if (foreignRules.length > 0) {
    errors.push(
      `${label}: holds rules of tokens.css or base.css (${[...new Set(foreignRules)].slice(0, 8).join(' ')})`,
    );
  }
  const declared = [...new Set(declaredCustomProperties(nodes))];
  const tokens = declared.filter((name) => tokenNames.has(name));
  if (tokens.length > 0) {
    errors.push(`${label}: declares the tokens ${tokens.slice(0, 8).join(', ')}`);
  }
  const theme = declared.filter((name) => !tokenNames.has(name) && THEME_VARIABLE.test(name));
  if (theme.length > 0) {
    errors.push(`${label}: declares the theme variables ${theme.slice(0, 8).join(', ')}`);
  }
  const other = declared.filter(
    (name) => !tokenNames.has(name) && !THEME_VARIABLE.test(name) && !allowedProperty(name),
  );
  if (other.length > 0) {
    errors.push(`${label}: declares the custom properties ${other.slice(0, 8).join(', ')}`);
  }
}

/** The `--wave-*` tokens a tokens.css declares. */
function tokenNamesOf(tokensCss) {
  return new Set(
    [...stripComments(tokensCss).matchAll(/(--wave-[\w-]+)\s*:/g)].map((match) => match[1]),
  );
}

/**
 * components.css (`css`): the utilities of styles.css (`stylesCss`, the built dist/styles.css)
 * without the token rules of tokens.css and the base rules of base.css, unlayered. See the header.
 */
export function assertComponentsCss(css, { stylesCss, tokensCss, baseCss }) {
  const errors = [];
  const nodes = parseCss(css);
  assertUnlayered(nodes, 'components.css', errors);
  const tokenAndBaseSelectors = ruleSelectors(tokensCss, baseCss);
  assertNoTokens(
    nodes,
    'components.css',
    // The components' own custom properties (`--option-bg`, `--wave-card-padding`) and
    // Tailwind's `--tw-*` are allowed; a token of tokens.css is not.
    { tokenAndBaseSelectors, tokenNames: tokenNamesOf(tokensCss), allowedProperty: () => true },
    errors,
  );
  for (const needle of FORBIDDEN) {
    if (css.includes(needle)) errors.push(`components.css: contains "${needle}"`);
  }
  if (stylesCss !== undefined) {
    const expected = serializeNodes(
      parseCss(stylesCss).filter((node) => !isTokenOrBaseRule(node, tokenAndBaseSelectors)),
    );
    const actual = serializeNodes(nodes);
    const length = Math.max(expected.length, actual.length);
    const first = Array.from({ length }, (_, i) => i).find((i) => expected[i] !== actual[i]);
    if (first !== undefined) {
      errors.push(
        'components.css: is not styles.css without the rules of tokens.css and base.css ' +
          `(${actual.length} nodes for ${expected.length}; the first difference, node ${first + 1}: ` +
          `${JSON.stringify((actual[first] ?? '<none>').slice(0, 80))} for ` +
          `${JSON.stringify((expected[first] ?? '<none>').slice(0, 80))})`,
      );
    }
  }
  return errors;
}

/** The custom properties the declarations of a stylesheet read (`var(--name…)`), sorted. */
function readCustomProperties(nodes) {
  const names = new Set();
  walk(nodes, (node) => {
    if (node.children !== null || node.prelude.startsWith('@')) return;
    const value = emptyStrings(node.prelude.slice(node.prelude.indexOf(':') + 1));
    for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1]);
  });
  return [...names].sort();
}

/**
 * utilities.css (`css`): exactly the classes `namespacedUtilities` generates from `tokensCss`,
 * unlayered, without tokens or theme variables, and, given the built styles.css (`stylesCss`),
 * reading no custom property but Tailwind's `--tw-*` and those styles.css declares. See the header.
 */
export function assertUtilitiesCss(css, { tokensCss, baseCss = '', stylesCss }) {
  const errors = [];
  const nodes = parseCss(css);
  assertUnlayered(nodes, 'utilities.css', errors);
  // Tailwind's `properties` fallback is the one layer allowed; a class inside it, or inside any
  // layer, would lose to the unlayered base styles of styles.css.
  const layered = [];
  walk(nodes, (node, parents) => {
    if (!isStyleRule(node) || parents.some(isKeyframes)) return;
    if (!parents.some((parent) => /^@layer\b/.test(parent.prelude))) return;
    if (selectorList(node.prelude).some((selector) => /\.[\w\\-]/.test(selector))) {
      layered.push(node.prelude);
    }
  });
  if (layered.length > 0) {
    errors.push(`utilities.css: classes inside a @layer (${layered.slice(0, 8).join(' ')})`);
  }
  assertNoTokens(
    nodes,
    'utilities.css',
    {
      tokenAndBaseSelectors: ruleSelectors(tokensCss, baseCss),
      tokenNames: tokenNamesOf(tokensCss),
      allowedProperty: (name) => name.startsWith('--tw-'),
    },
    errors,
  );

  const expected = namespacedUtilities(tokensCss);
  if (expected.length === 0) errors.push('utilities.css: tokens.css declares no namespaced key');
  const classes = selectorClasses(css);
  const missing = expected.filter((name) => !classes.has(name));
  if (missing.length > 0) {
    errors.push(
      `utilities.css: missing ${missing.length} of the ${expected.length} namespaced utilities ` +
        `(${missing.slice(0, 8).join(' ')})`,
    );
  }
  const wanted = new Set(expected);
  const extra = [...classes].filter((name) => !wanted.has(name)).sort();
  if (extra.length > 0) {
    errors.push(
      'utilities.css: holds classes other than the namespaced token utilities ' +
        `(${extra.slice(0, 8).join(' ')})`,
    );
  }

  const keyframes = new Set();
  walk(nodes, (node) => {
    const match = /^@keyframes\s+([\w-]+)$/.exec(node.prelude);
    if (match) keyframes.add(match[1]);
  });
  const animated = expected.some((name) => name.startsWith('animate-wave-'));
  for (const name of animated ? KEYFRAMES : []) {
    if (!keyframes.has(name)) errors.push(`utilities.css: missing @keyframes ${name}`);
  }

  if (stylesCss !== undefined) {
    const declared = new Set(declaredCustomProperties(parseCss(stylesCss)));
    const unread = readCustomProperties(nodes).filter(
      (name) => !name.startsWith('--tw-') && !declared.has(name),
    );
    if (unread.length > 0) {
      errors.push(
        'utilities.css: reads custom properties that styles.css does not declare (a namespaced ' +
          `key mapped to a theme variable, not a token?): ${unread.slice(0, 8).join(', ')}`,
      );
    }
  }
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

/**
 * Compiles `input` to `output` (minified). With `stdin`, the CLI compiles that text instead,
 * read from stdin in the input's directory, so its relative `@import` and `@source` paths resolve
 * as in the file.
 */
function compile(cli, { input, output, cwd, stdin, label = input }) {
  const result = spawnSync(
    process.execPath,
    [cli, '--input', stdin === undefined ? input : '-', '--output', output, '--minify'],
    stdin === undefined
      ? { cwd, encoding: 'utf8' }
      : { cwd: dirname(input), input: stdin, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `tailwindcss failed for ${label} (exit ${result.status}):\n${result.stderr}${result.stdout}`,
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

  // The compile check, before any compile (Phase 14 spec R6): only with a utility prefix.
  const prefix = utilityPrefixOf(projectRoot);
  if (prefix === '') {
    console.log(`build-css: compile check skipped (UTILITY_PREFIX in ${CN_MODULE} is empty)`);
  } else if (prefix !== undefined) {
    const check = compileCheck(projectRoot, prefix);
    if (!check.ok) {
      console.error(`build-css: the compile check failed (prefix ${prefix}):`);
      for (const line of check.lines) console.error(`  ${line}`);
      return 1;
    }
    console.log(`build-css: compile check passed (${compileCheckSummary(check.lines, prefix)})`);
  }

  if (!checkOnly) {
    mkdirSync(outDir, { recursive: true });
    const cli = tailwindCli();
    const entries = readStyleEntries(projectRoot);
    // Every derived source first: one that cannot be derived stops the build before any output.
    const jobs = ENTRIES.map(({ input, output, source }) => {
      const path = join(projectRoot, input);
      return {
        input: path,
        output: join(outDir, output),
        cwd: projectRoot,
        stdin: source && source(readFileSync(path, 'utf8'), entries),
        label: source ? `${input} (for ${output})` : input,
      };
    });
    for (const job of jobs) compile(cli, job);
  }

  const inside = relative(projectRoot, outDir);
  const where = (inside && !inside.startsWith('..') ? inside : outDir).split('\\').join('/');
  const missing = OUTPUTS.map((output) => join(outDir, output)).filter((file) => !existsSync(file));
  if (missing.length > 0) {
    for (const file of missing) {
      console.error(`build-css: ${file} does not exist (run without --check-only to build it)`);
    }
    return 1;
  }

  const read = (name) => readFileSync(join(outDir, name), 'utf8');
  const { tokensCss, baseCss } = readStyleEntries(projectRoot);
  const stylesCss = read('styles.css');
  const errors = [
    ...assertStylesCss(stylesCss, {
      tokensCss,
      baseCss,
      storySources: collectStorySources(projectRoot),
      prefix: prefix ?? '',
    }),
    ...assertComponentsCss(read('components.css'), { stylesCss, tokensCss, baseCss }),
    ...assertUtilitiesCss(read('utilities.css'), { tokensCss, baseCss, stylesCss }),
    ...assertPreflightCss(read('preflight.css')),
  ];

  if (errors.length > 0) {
    console.error(`build-css: ${errors.length} problem(s) in ${where}:`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }
  const report = OUTPUTS.map(
    (name) => `${where}/${name} (${(statSync(join(outDir, name)).size / 1024).toFixed(1)} kB)`,
  );
  console.log(`build-css: ${report.slice(0, -1).join(', ')} and ${report.at(-1)} OK`);
  return 0;
}

await runScript(import.meta.url, main);
