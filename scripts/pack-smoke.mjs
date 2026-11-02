#!/usr/bin/env node
/**
 * Packaging smoke test (`npm run test:pack`, spec §3.2; repo-level#1, #5): packs the tarball the
 * way `npm publish` would and installs it into throwaway copies of the consumer fixtures in
 * `scripts/fixtures/`. Run it after `npm run build` (`prepublishOnly` does).
 *
 *   tarball   every `exports` target is packed (and every file the style sources `@import`,
 *             `dist/components.css` of `./tailwind` included), and so is the 1.0 migration
 *             codemod (`codemod/migrate-1.0.mjs`, run from node_modules); no tests, stories,
 *             component sources or other scripts are (a script outside `dist` is one of
 *             SHIPPED_SCRIPTS or an error).
 *   plain     an app without Tailwind (scripts/fixtures/plain):
 *               - `import()` (smoke.mjs) and `require()` (smoke.cjs: the package ships ES modules
 *                 only, and `require(esm)` loads the entry on Node.js 22.12 and later) load the
 *                 package, expose Button, WaveProvider and cn with the same names, and every
 *                 exported subpath resolves (the `./x` and `./x.css` aliases to one file). When
 *                 WAVE_NODE_FLOOR names a Node.js 22.12 binary, smoke.cjs runs on it too (the
 *                 Node floor: 22.12 prints an ExperimentalWarning, 22.13 and later do not);
 *                 without it that step is skipped with a message (nothing is downloaded);
 *               - `./styles` is the precompiled, unlayered stylesheet: `.bg-primary`,
 *                 `.text-body-1`, `--wave-primary`, `@keyframes wave-spin` and the native
 *                 reset scoped to `.wave-root`/`.wave-portal`, no `@layer` other than Tailwind's
 *                 `properties` fallback, no raw Tailwind directives; `./preflight.css` is
 *                 Preflight; `./utilities` holds the namespaced token utilities
 *                 (`.bg-wave-primary`, `.text-wave-body-1`, `.shadow-wave-4`, …) in
 *                 `@layer utilities`, without tokens, variants or component classes;
 *               - TypeScript type-checks two programs, both loading `dist/index.d.ts`: an `.mts`
 *                 file under `module` node16 (tsconfig.json) and a `.cts` file under `module`
 *                 node20 (tsconfig.cjs.json; the CommonJS file `require()`s the ES entry, which
 *                 `module` node16 and node18 refuse with TS1479);
 *               - an app importing `./styles` (`vite-entry.js`) built with Vite's defaults: the
 *                 emitted CSS passes the `./styles` checks, and every `wave-rtl:` class of the
 *                 dist keeps Wave's direction variant. Vite minifies CSS with Lightning CSS for
 *                 its default target (Chrome 111), which rewrites a bare `:dir(rtl)` to a
 *                 `:lang()` list that a page setting only `dir` never matches;
 *               - an app importing `./utilities.css` (`utilities-entry.js`) built with Vite's
 *                 defaults: the emitted CSS passes the `./utilities` checks;
 *               - the migration codemod runs from the installed package with Node.js alone: a
 *                 dry run over `migrate.css` reports its two rewrites and changes nothing.
 *   tailwind  a Tailwind 4 app (scripts/fixtures/tailwind) compiling, with @tailwindcss/cli,
 *               - `input.css`: `@import 'tailwindcss'; @import '@mortenbrudvik/waveui/tailwind';`
 *                 and the app's own token override in `@layer base`. Nothing of the package is
 *                 scanned (no `@source` of `dist`): the component classes come precompiled from
 *                 `dist/components.css` and sit in `@layer components` only (never generated
 *                 into `utilities`), with the dist's `wave-rtl:` classes compiled with the
 *                 direction variant; Wave's tokens sit in `@layer theme`, the app's override in
 *                 `@layer base`, Wave's base rules in `@layer base`, and the layers come in the
 *                 order theme, base, components, utilities, so the override and every utility
 *                 of the app win; the app's own classes are generated from the namespaced theme
 *                 keys (`bg-wave-primary`, `text-wave-body-1`, `shadow-wave-4`, `font-wave`,
 *                 the motion utilities) and its own `wave-rtl:` class with the variant;
 *               - `tokens-input.css`: the custom setup, `./tokens` (in `layer(theme)`) with
 *                 `./variants.css` for the app's own classes (the components come from
 *                 `./styles`): tokens in `@layer theme`, the app's classes generated as above,
 *                 and no component class;
 *               - `input.css` built by an app with Vite's defaults and @tailwindcss/vite: the
 *                 checks of `input.css`, and the `wave-rtl:` classes as for the plain fixture.
 *
 * The fixture dependencies (`smokeDependencies` in each fixture's package.json) are pinned to
 * the versions installed in this repository, so `npm install` is served from the npm cache when
 * it can be. TypeScript, @tailwindcss/cli, Vite and @tailwindcss/vite run from this repository.
 *
 * Usage: node scripts/pack-smoke.mjs [--fixture plain|tailwind]... [--keep]
 *   --fixture  run only this fixture (repeatable; default: both)
 *   --keep     keep the work directory (tarball and installed fixtures) for inspection
 *
 * Environment: WAVE_NODE_FLOOR, the path of a Node.js 22.12 binary, enables the floor step of
 * the plain fixture (`require()` of the ES entry on the Node floor).
 *
 * The assertions are exported and tested by scripts/__tests__/pack-smoke.test.mjs; importing
 * the module does not run anything.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertPreflightCss,
  classStringTokens,
  DIRECTION_VARIANT_FORM,
  hasDirectionVariant,
  loweredDirectionClasses,
  missingDirectionVariant,
  parseCss,
  selectorClasses,
  selectorList,
} from './build-css.mjs';
import { runScript } from './verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** The subpath exports of package.json besides `.` (the smoke fixtures resolve each one). */
export const EXPORTED_SUBPATHS = [
  './styles',
  './styles.css',
  './preflight.css',
  './utilities',
  './utilities.css',
  './tailwind',
  './tailwind.css',
  './tokens',
  './tokens.css',
  './variants',
  './variants.css',
  './package.json',
];

/** Subpaths that must resolve to the same file. */
const ALIASES = [
  ['./styles', './styles.css'],
  ['./utilities', './utilities.css'],
  ['./tailwind', './tailwind.css'],
  ['./tokens', './tokens.css'],
  ['./variants', './variants.css'],
];

/**
 * The scripts the package ships (outside `dist`): the 1.0 migration codemod, which apps run from
 * node_modules (Phase 14 spec R6). Any other script in the tarball is an error.
 */
export const SHIPPED_SCRIPTS = ['codemod/migrate-1.0.mjs'];

const FIXTURES = ['plain', 'tailwind'];
const REQUIRED_NAMES = ['Button', 'WaveProvider', 'cn'];
const NATIVE_RESET = ':where(.wave-root,.wave-portal) :where(button,input,select,textarea)';
const TAILWIND_DIRECTIVE =
  /^@(import|tailwind|theme|source|apply|utility|variant|custom-variant|plugin|config|reference)\b/;

// -------------------------------------------------------------------------------------------
// CSS helpers
// -------------------------------------------------------------------------------------------

/** Calls `visit(node, ancestors)` for every node of a parseCss tree. */
function visit(nodes, fn, ancestors = []) {
  for (const node of nodes) {
    fn(node, ancestors);
    if (node.children) visit(node.children, fn, [...ancestors, node]);
  }
}

function layerOf(ancestors) {
  const layer = ancestors.find((node) => /^@layer\b/.test(node.prelude));
  return layer ? layer.prelude.slice('@layer'.length).trim() : undefined;
}

function declares(node, property) {
  return node.children === null && node.prelude.startsWith(`${property}:`);
}

function isStyleRule(node) {
  return node.children !== null && !node.prelude.startsWith('@');
}

// -------------------------------------------------------------------------------------------
// Assertions
// -------------------------------------------------------------------------------------------

/**
 * The tarball's file list (paths relative to the package root): every export target is packed,
 * and so is every file a packed `src/styles` target `@import`s, transitively through the style
 * sources (a built file it imports, `./tailwind`'s `dist/components.css`, must be packed; it is
 * not read, so this runs before a build); tests, stories, component sources and scripts are not.
 * `readSource` reads a style source of this repository.
 */
export function checkPackedFiles(
  paths,
  manifest = pkg,
  readSource = (path) => readFileSync(join(root, path), 'utf8'),
) {
  const errors = [];
  const packed = new Set(paths);
  const targets = new Set();
  const collect = (value) => {
    if (typeof value === 'string') targets.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(manifest.exports);
  for (const target of targets) {
    if (!packed.has(target.replace(/^\.\//, ''))) {
      errors.push(`export target ${target} is not in the tarball`);
    }
  }

  for (const path of paths) {
    if (path.split('/').includes('__tests__')) errors.push(`tests are packed: ${path}`);
    else if (path.startsWith('stories/')) errors.push(`stories are packed: ${path}`);
    else if (path.startsWith('scripts/')) errors.push(`scripts are packed: ${path}`);
    else if (path.startsWith('src/') && !path.startsWith('src/styles/')) {
      errors.push(`library sources are packed: ${path} (only src/styles is published)`);
    } else if (
      /\.[cm]?[jt]s$/.test(path) &&
      !path.startsWith('dist/') &&
      !SHIPPED_SCRIPTS.includes(path)
    ) {
      errors.push(`scripts are packed: ${path} (only ${SHIPPED_SCRIPTS.join(', ')} ships)`);
    }
  }
  for (const script of SHIPPED_SCRIPTS) {
    if (!packed.has(script)) errors.push(`${script} is not in the tarball`);
  }

  const queue = [...targets]
    .map((target) => target.replace(/^\.\//, ''))
    .filter((path) => path.startsWith('src/styles/') && path.endsWith('.css') && packed.has(path));
  const seen = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    for (const match of readSource(path).matchAll(/@import\s+(["'])(\.{1,2}\/[^"']+)\1/g)) {
      const imported = posix.join(posix.dirname(path), match[2]);
      if (!packed.has(imported)) {
        errors.push(`${path} @imports ${imported}, which is not in the tarball`);
      } else if (imported.startsWith('src/styles/')) queue.push(imported);
    }
  }
  return errors;
}

/**
 * The precompiled `./styles` stylesheet (repo-level#1): unlayered (only Tailwind's `properties`
 * fallback layer), no raw Tailwind directives, and the component utilities, Wave tokens,
 * keyframes and scoped native reset a consumer without Tailwind needs.
 */
export function checkPlainCss(css) {
  const errors = [];
  const nodes = parseCss(css);
  const layers = new Set();
  let resetFound = false;
  let tokenFound = false;
  let keyframesFound = false;
  visit(nodes, (node) => {
    if (/^@layer\b/.test(node.prelude)) {
      for (const name of node.prelude.slice('@layer'.length).split(',')) {
        const layer = name.trim() || '<anonymous>';
        if (layer !== 'properties') layers.add(layer);
      }
    }
    if (TAILWIND_DIRECTIVE.test(node.prelude)) {
      errors.push(`raw Tailwind source, not compiled CSS: "${node.prelude.slice(0, 60)}"`);
    }
    if (declares(node, '--wave-primary')) tokenFound = true;
    if (/^@keyframes\s+wave-spin$/.test(node.prelude)) keyframesFound = true;
    if (isStyleRule(node) && selectorList(node.prelude).includes(NATIVE_RESET)) resetFound = true;
  });
  if (layers.size > 0) {
    errors.push(
      `layered output: @layer ${[...layers].join(', ')} (./styles must be unlayered, or any ` +
        'unlayered consumer CSS beats it)',
    );
  }
  const classes = selectorClasses(css);
  for (const name of ['bg-primary', 'text-body-1', ...FOCUS_RECIPE_UTILITIES]) {
    if (!classes.has(name)) errors.push(`missing the component utility .${name}`);
  }
  if (!tokenFound) errors.push('missing the token --wave-primary');
  if (!keyframesFound) errors.push('missing @keyframes wave-spin');
  if (!resetFound) errors.push(`missing the scoped native reset (${NATIVE_RESET})`);
  return errors;
}

/** Utilities of the exported focus recipes (`focusRing`, `focusRingInset`), which apps compose. */
const FOCUS_RECIPE_UTILITIES = ['focus-visible:outline-ring', 'focus-visible:-outline-offset-2'];

/**
 * Classes of the components that the Tailwind fixture's own source never uses: in a `./tailwind`
 * build they come from `dist/components.css` alone.
 */
const COMPONENT_UTILITIES = ['bg-primary', 'text-body-1', ...FOCUS_RECIPE_UTILITIES];

/** Wave motion utilities used by the Tailwind fixture's own source (`src/app.html`). */
const MOTION_UTILITIES = ['duration-wave-normal', 'ease-wave-decelerate-mid'];

/**
 * Namespaced token utilities used by the Tailwind fixture's own source (`src/app.html`): the
 * theme keys of `./tokens` generate them in an app's build.
 */
const NAMESPACED_APP_UTILITIES = [
  'bg-wave-primary',
  'text-wave-body-1',
  'border-wave-border',
  'shadow-wave-4',
  'font-wave',
];

/** The fixture source's own use of Wave's direction variant, a class no component uses. */
export const APP_DIRECTION_CLASS = 'wave-rtl:rotate-180';

/** The layers of a `./tailwind` build, in the order they must be declared. */
const LAYER_ORDER = ['theme', 'base', 'components', 'utilities'];

/** The top-level layers of a stylesheet in the order of their first statement or block. */
function layerOrder(nodes) {
  const order = [];
  for (const node of nodes) {
    if (!/^@layer\b/.test(node.prelude)) continue;
    for (const name of node.prelude.slice('@layer'.length).split(',')) {
      const layer = name.trim();
      if (layer && !order.includes(layer)) order.push(layer);
    }
  }
  return order;
}

/** The value of a declaration node (`--wave-primary: #c4314b` -> `#c4314b`), lowercased. */
function declaredValue(node) {
  return node.prelude
    .slice(node.prelude.indexOf(':') + 1)
    .trim()
    .toLowerCase();
}

/**
 * A Tailwind consumer build (repo-level#1; Phase 14 spec R6). `setup` names the build:
 *
 * - `'tailwind'` (default): the `./tailwind` entry. Wave's tokens (`--wave-primary`) sit in
 *   `@layer theme` and its base rules (`.wave-root`) in `@layer base`; the component classes
 *   (`.bg-primary`, `.text-body-1`, the focus recipes' utilities) come from the precompiled
 *   `dist/components.css` and sit in `@layer components` only: one in `utilities` means Tailwind
 *   scanned the package's dist, which the entry no longer does; each of `directionClasses` (the
 *   `wave-rtl:` classes of the dist's class strings) is compiled with Wave's direction variant;
 *   the layers are declared in the order theme, base, components, utilities; and `tokenOverride`,
 *   when given, is the value of the app's own `--wave-primary` override, which must sit in
 *   `@layer base` (after `theme`, so it wins over Wave's tokens).
 * - `'tokens'`: the custom setup on `./tokens` and `./variants.css` for the app's own classes;
 *   the components come from `./styles`, so no component class is in the build at all.
 *
 * Both: the app's own classes are generated, `.p-4`, the namespaced token utilities and the
 * motion utilities from the theme keys of `./tokens`, and `APP_DIRECTION_CLASS` with Wave's
 * direction variant. Any other `setup` throws a `TypeError`.
 */
export function checkTailwindCss(
  css,
  { directionClasses = [], setup = 'tailwind', tokenOverride } = {},
) {
  if (setup !== 'tailwind' && setup !== 'tokens') {
    throw new TypeError(
      `checkTailwindCss: unknown setup ${JSON.stringify(setup)} (expected 'tailwind' or 'tokens')`,
    );
  }
  const errors = [];
  const nodes = parseCss(css);
  const tokenLayers = new Set();
  const overrideLayers = new Set();
  const baseLayers = new Set();
  /** Every class of a style rule, with the layers its rules sit in. */
  const classLayers = new Map();
  visit(nodes, (node, ancestors) => {
    const layer = layerOf(ancestors) ?? '<unlayered>';
    if (declares(node, '--wave-primary')) {
      const isOverride =
        tokenOverride !== undefined && declaredValue(node) === tokenOverride.toLowerCase();
      (isOverride ? overrideLayers : tokenLayers).add(layer);
    }
    if (!isStyleRule(node) || ancestors.some((parent) => parent.prelude.startsWith('@keyframes'))) {
      return;
    }
    if (/\.wave-root\b/.test(node.prelude)) baseLayers.add(layer);
    for (const name of selectorClasses(`${node.prelude}{}`)) {
      if (!classLayers.has(name)) classLayers.set(name, new Set());
      classLayers.get(name).add(layer);
    }
  });
  const layersOf = (name) => [...(classLayers.get(name) ?? [])];

  if (tokenLayers.size === 0) errors.push('missing the Wave token --wave-primary');
  else if ([...tokenLayers].some((layer) => layer !== 'theme')) {
    errors.push(
      `Wave tokens (--wave-primary) must sit in @layer theme, found in ${[...tokenLayers].join(', ')}`,
    );
  }

  if (setup === 'tailwind') {
    const order = layerOrder(nodes).filter((layer) => LAYER_ORDER.includes(layer));
    if (order.join(',') !== LAYER_ORDER.join(',')) {
      errors.push(
        `the layers must come in the order ${LAYER_ORDER.join(', ')} (found ${order.join(', ') || 'none'})`,
      );
    }
    if (tokenOverride !== undefined) {
      if (overrideLayers.size === 0) {
        errors.push(`missing the app's token override (--wave-primary: ${tokenOverride})`);
      } else if ([...overrideLayers].some((layer) => layer !== 'base')) {
        errors.push(
          `the app's token override must sit in @layer base, found in ${[...overrideLayers].join(', ')}`,
        );
      }
    }
    if (baseLayers.size === 0) errors.push('missing the Wave base rules (.wave-root)');
    else if ([...baseLayers].some((layer) => layer !== 'base')) {
      errors.push(
        `Wave base rules (.wave-root) must sit in @layer base, found in ${[...baseLayers].join(', ')}`,
      );
    }
    for (const name of COMPONENT_UTILITIES) {
      const layers = layersOf(name);
      if (layers.length === 0) {
        errors.push(
          `the component class .${name} is missing (does @mortenbrudvik/waveui/tailwind import dist/components.css?)`,
        );
      } else if (layers.includes('utilities')) {
        errors.push(
          `the component class .${name} was generated into @layer utilities: Tailwind scanned ` +
            "the package's dist (./tailwind has no @source)",
        );
      } else if (layers.some((layer) => layer !== 'components')) {
        errors.push(
          `the component class .${name} must sit in @layer components, found in ${layers.join(', ')}`,
        );
      }
    }
    const uncompiled = missingDirectionVariant(css, directionClasses);
    if (uncompiled.length > 0) {
      errors.push(
        `the dist classes ${uncompiled.slice(0, 10).join(' ')} were not compiled with Wave's ` +
          'wave-rtl variant (is dist/components.css compiled with src/styles/variants.css?)',
      );
    }
  } else {
    const components = COMPONENT_UTILITIES.filter((name) => classLayers.has(name));
    if (components.length > 0) {
      errors.push(
        `the component classes ${components.map((name) => `.${name}`).join(', ')} are in the ` +
          'custom setup (its components come from ./styles: ./tokens must hold no unnamespaced ' +
          "theme key, and the setup must not scan the package's dist)",
      );
    }
  }

  const namespaced = NAMESPACED_APP_UTILITIES.filter((name) => !classLayers.has(name));
  if (namespaced.length > 0) {
    errors.push(
      `the namespaced token utilities ${namespaced.map((name) => `.${name}`).join(', ')} were ` +
        'not generated (the namespaced theme keys of @mortenbrudvik/waveui/tokens are missing)',
    );
  }
  const motion = MOTION_UTILITIES.filter((name) => !classLayers.has(name));
  if (motion.length > 0) {
    errors.push(
      `the motion utilities ${motion.map((name) => `.${name}`).join(', ')} were not generated ` +
        "(the Wave theme's --transition-duration-wave-* and --ease-wave-* mappings are missing)",
    );
  }
  if (missingDirectionVariant(css, [APP_DIRECTION_CLASS]).length > 0) {
    const hint =
      setup === 'tailwind'
        ? 'does @mortenbrudvik/waveui/tailwind import variants.css?'
        : 'does the setup import @mortenbrudvik/waveui/variants.css?';
    errors.push(
      `the app's class ${APP_DIRECTION_CLASS} was not compiled with Wave's wave-rtl variant (${hint})`,
    );
  }
  if (!classLayers.has('p-4')) {
    errors.push(
      "the consumer utility .p-4 was not generated (the fixture's own sources were not scanned)",
    );
  }
  return errors;
}

/** Representatives of every kind of the namespaced token utilities of `./utilities`. */
const UTILITIES_SAMPLE = [
  'bg-wave-primary',
  'text-wave-foreground',
  'border-wave-border',
  'ring-wave-ring',
  'fill-wave-palette-red',
  'stroke-wave-brand-80',
  'text-wave-body-1',
  'shadow-wave-4',
  'font-wave',
  'font-wave-mono',
  'animate-wave-spin',
];

/** A namespaced token utility without a variant (`bg-wave-primary`, `font-wave`). */
const NAMESPACED_UTILITY =
  /^(?:bg|text|border|ring|fill|stroke|shadow|font|animate)-wave(?:-[\w-]+)?$/;

/**
 * The `./utilities` stylesheet (Phase 14 spec R6), or an app's build of it: the namespaced token
 * utilities (`UTILITIES_SAMPLE`) in `@layer utilities` (Tailwind's `properties` fallback aside),
 * no other class (no variant, no component class), no token declaration (the tokens come from
 * `./styles`), no raw Tailwind directive, and the `@keyframes wave-spin` of `animate-wave-spin`.
 */
export function checkUtilitiesCss(css) {
  const errors = [];
  const outside = [];
  let tokenFound = false;
  let keyframesFound = false;
  visit(parseCss(css), (node, ancestors) => {
    if (TAILWIND_DIRECTIVE.test(node.prelude)) {
      errors.push(`raw Tailwind source, not compiled CSS: "${node.prelude.slice(0, 60)}"`);
    }
    if (node.children === null && node.prelude.startsWith('--wave-')) tokenFound = true;
    if (/^@keyframes\s+wave-spin$/.test(node.prelude)) keyframesFound = true;
    if (!isStyleRule(node) || ancestors.some((parent) => parent.prelude.startsWith('@keyframes'))) {
      return;
    }
    const layer = layerOf(ancestors);
    if (layer !== 'utilities' && layer !== 'properties') outside.push(node.prelude);
  });
  if (outside.length > 0) {
    errors.push(`rules outside @layer utilities: ${outside.slice(0, 5).join(' ')}`);
  }
  const classes = selectorClasses(css);
  const missing = UTILITIES_SAMPLE.filter((name) => !classes.has(name));
  if (missing.length > 0) {
    errors.push(`missing the token utilities ${missing.map((name) => `.${name}`).join(', ')}`);
  }
  const other = [...classes].filter((name) => !NAMESPACED_UTILITY.test(name)).sort();
  if (other.length > 0) {
    errors.push(
      `holds classes other than the namespaced token utilities: ${other.slice(0, 10).join(' ')}`,
    );
  }
  if (tokenFound) errors.push('declares Wave tokens (they come from ./styles)');
  if (!keyframesFound) errors.push('missing @keyframes wave-spin');
  return errors;
}

/**
 * The CSS of an app's Vite build (see {@link viteBuildCss}): each of `directionClasses` (the
 * `wave-rtl:` classes of the dist's class strings) keeps Wave's direction variant, and none is
 * selected by `:lang()`. Vite minifies CSS with Lightning CSS for its default `build.cssTarget`
 * (Chrome 111), which rewrites a bare `:dir(rtl)` to a `:lang()` list; the class then never
 * matches a page that sets `dir` without a right-to-left `lang`.
 */
export function checkViteCss(css, { directionClasses = [] } = {}) {
  const errors = [];
  const lowered = loweredDirectionClasses(css);
  if (lowered.length > 0) {
    errors.push(
      "the CSS minifier rewrote :dir(rtl) of Wave's wave-rtl variant to :lang(), so these " +
        'classes never match a page that sets dir without a right-to-left lang: ' +
        lowered.slice(0, 10).join(' '),
    );
  }
  const uncompiled = missingDirectionVariant(css, directionClasses).filter(
    (name) => !lowered.includes(name),
  );
  if (uncompiled.length > 0) {
    errors.push(
      `the classes ${uncompiled.slice(0, 10).join(' ')} lost Wave's wave-rtl variant ` +
        `(${DIRECTION_VARIANT_FORM})`,
    );
  }
  return errors;
}

/**
 * Builds `entry` (a CSS or JavaScript file of `dir`) the way an app's `vite build` does with
 * Vite's defaults, through the Vite of this repository; `tailwind` adds @tailwindcss/vite, as a
 * Tailwind app's config does. Returns the CSS the build emitted (under `dir/vite-out`).
 */
export async function viteBuildCss(dir, entry, { tailwind = false } = {}) {
  const { build } = await import('vite');
  const plugins = tailwind ? [(await import('@tailwindcss/vite')).default()] : [];
  const outDir = join(dir, 'vite-out');
  await build({
    root: dir,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: { outDir, emptyOutDir: true, rollupOptions: { input: join(dir, entry) } },
  });
  return readdirSync(outDir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.css'))
    .sort()
    .map((file) => readFileSync(join(outDir, file), 'utf8'))
    .join('\n');
}

/**
 * What one of the plain fixture's smoke scripts observed (`side`): it loads the package
 * (`names`, `cn` result) and resolves every subpath (`resolved`). `label` names the script's way
 * in ('import', 'require') in the messages.
 */
function checkSmokeSide(label, side) {
  const errors = [];
  if (!side) {
    errors.push(`${label}: no result`);
    return errors;
  }
  if (side.error) errors.push(`${label} failed: ${side.error}`);
  else {
    const missing = REQUIRED_NAMES.filter((name) => !side.names?.includes(name));
    if (missing.length > 0) errors.push(`${label} lacks ${missing.join(', ')}`);
    if (side.cn !== 'a b')
      errors.push(`${label}: cn('a', false, 'b') returned ${JSON.stringify(side.cn)}`);
  }
  const resolved = side.resolved ?? {};
  for (const subpath of EXPORTED_SUBPATHS) {
    if (!resolved[subpath]) errors.push(`${label}: ${subpath} does not resolve`);
  }
  for (const [a, b] of ALIASES) {
    if (resolved[a] && resolved[b] && resolved[a] !== resolved[b]) {
      errors.push(`${label}: ${a} and ${b} resolve to different files`);
    }
  }
  return errors;
}

/** `require()` and `import()` must expose the same names (one module, two ways in). */
function checkSameNames(esm, cjs, requireLabel) {
  const errors = [];
  if (esm?.names && cjs?.names) {
    const onlyImport = esm.names.filter((name) => !cjs.names.includes(name));
    const onlyRequire = cjs.names.filter((name) => !esm.names.includes(name));
    if (onlyImport.length > 0) {
      errors.push(`only import() exposes ${onlyImport.join(', ')} (${requireLabel} lacks them)`);
    }
    if (onlyRequire.length > 0) {
      errors.push(`only ${requireLabel} exposes ${onlyRequire.join(', ')}`);
    }
  }
  return errors;
}

/**
 * What the plain fixture's `import()` script (`esm`) and `require(esm)` script (`cjs`) observed:
 * each loads the package and resolves every subpath, and both expose the same names (the package
 * ships ES modules only; `require()` returns the same module).
 */
export function checkPlainSmoke({ esm, cjs }) {
  return [
    ...checkSmokeSide('import', esm),
    ...checkSmokeSide('require', cjs),
    ...checkSameNames(esm, cjs, 'require()'),
  ];
}

/**
 * What the fixture's `require(esm)` script (`floor`) observed on the Node floor (22.12): it loads
 * the entry and exposes the names `import()` (`esm`, run on the current Node) does.
 */
export function checkFloorSmoke({ esm, floor }) {
  return [
    ...checkSmokeSide('require (Node 22.12)', floor),
    ...checkSameNames(esm, floor, 'require() on Node 22.12'),
  ];
}

/**
 * The Node.js 22.12 binary of the floor step: the path in `env.WAVE_NODE_FLOOR`, when it is set.
 * `versionOf(path)` returns the binary's `--version` text (undefined when it cannot run). Returns
 * `{ path }` for a v22.12.x binary, else `{ skip }` with the message that tells why the step is
 * skipped. Nothing is downloaded.
 */
export function resolveFloorNode(env = process.env, versionOf = nodeVersionOf) {
  const path = env.WAVE_NODE_FLOOR;
  if (!path) return { skip: 'WAVE_NODE_FLOOR is not set (the path of a Node.js 22.12 binary)' };
  const version = versionOf(path)?.trim();
  if (!version) return { skip: `WAVE_NODE_FLOOR (${path}) could not be run` };
  if (!/^v22\.12\.\d+$/.test(version)) {
    return { skip: `WAVE_NODE_FLOOR (${path}) is ${version}, not Node.js 22.12` };
  }
  return { path };
}

function nodeVersionOf(path) {
  try {
    const result = run(path, ['--version']);
    return result.status === 0 ? result.stdout : undefined;
  } catch {
    return undefined;
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * One of the fixture's `tsc --listFiles` runs (repo-level#5): no type errors, and the program
 * loaded this package's `dist/index.d.ts` (the one declaration file, spec R4) — the installed
 * `node_modules/<packageName>/dist/…`, not another dependency's `dist/index.d.*`.
 */
export function checkTypeProgram({ status, output }, packageName = pkg.name) {
  const errors = [];
  const text = output.split('\\').join('/');
  const typeErrors = text.split('\n').filter((line) => /error TS\d+/.test(line));
  for (const line of typeErrors.slice(0, 10)) errors.push(`type error: ${line.trim()}`);
  if (status !== 0 && typeErrors.length === 0) errors.push(`tsc exited with status ${status}`);
  const installed = `/node_modules/${escapeRegExp(packageName)}/dist/`;
  if (!new RegExp(`${installed}index\\.d\\.ts\\s*$`, 'm').test(text)) {
    errors.push(`the consumers did not load ${packageName}/dist/index.d.ts`);
  }
  return errors;
}

/** The version of a package installed in this repository (undefined when it is not). */
function installedVersion(name) {
  try {
    return JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'))
      .version;
  } catch {
    return undefined;
  }
}

/**
 * The package.json of an installed fixture copy: the fixture manifest without
 * `smokeDependencies`, depending on the tarball and on each smoke dependency pinned to the
 * version installed in this repository.
 */
export function fixtureManifest(base, tarball, versionOf = installedVersion) {
  const { smokeDependencies = [], ...manifest } = base;
  const dependencies = { [pkg.name]: `file:${tarball.split('\\').join('/')}` };
  for (const name of smokeDependencies) {
    const version = versionOf(name);
    if (!version) throw new Error(`fixture dependency ${name} is not installed in the repository`);
    dependencies[name] = version;
  }
  return { ...manifest, dependencies };
}

export function parseArgs(argv) {
  const fixtures = [];
  let keep = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--keep') keep = true;
    else if (argv[i] === '--fixture') {
      const name = argv[++i];
      if (!FIXTURES.includes(name)) throw new Error(`unknown fixture: ${name}`);
      fixtures.push(name);
    } else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return { fixtures: fixtures.length > 0 ? fixtures : [...FIXTURES], keep };
}

// -------------------------------------------------------------------------------------------
// Running
// -------------------------------------------------------------------------------------------

/** How to run npm: its CLI script through this Node binary when it can be found. */
function npmCommand() {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const script = candidates.find((path) => path && /\.[cm]?js$/.test(path) && existsSync(path));
  return script
    ? { command: process.execPath, prefix: [script], shell: false }
    : { command: 'npm', prefix: [], shell: process.platform === 'win32' };
}

/**
 * The environment for a nested npm command (the pack and the fixture installs): without the
 * `npm_*` variables of an enclosing `npm run` (package and lifecycle data, prefixes), which
 * describe this repository, and without its dry run. `npm publish --dry-run` exports
 * `npm_config_dry_run=true` to prepublishOnly, and a nested `npm pack` would then write no
 * tarball.
 */
function npmEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^npm_(package_|lifecycle_)/i.test(key)) continue;
    if (/^npm_config_(local_prefix|prefix|global|workspaces?|dry_run)$/i.test(key)) continue;
    env[key] = value;
  }
  return env;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function runOrThrow(label, command, args, options) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status}):\n${result.stderr}${result.stdout}`);
  }
  return result;
}

function npm(label, args, options = {}) {
  const { command, prefix, shell } = npmCommand();
  return runOrThrow(label, command, [...prefix, ...args], { shell, ...options });
}

/**
 * The result (`filename`, `files`, …) of the one package in the output of `npm pack --json`:
 * npm 10 and 11 print an array of results, npm 12 an object keyed by package name. Anything
 * printed before the JSON is skipped: it starts at the first line that opens with `[` or `{`.
 */
export function parsePackOutput(stdout) {
  const start = stdout.search(/^[[{]/m);
  if (start === -1) throw new Error(`npm pack printed no JSON:\n${stdout}`);
  const parsed = JSON.parse(stdout.slice(start));
  const results = Array.isArray(parsed) ? parsed : Object.values(parsed);
  if (results.length !== 1) {
    throw new Error(`npm pack reported ${results.length} packages instead of 1:\n${stdout}`);
  }
  return results[0];
}

/**
 * Packs the package into `dir` (also under `npm publish --dry-run`, see npmEnv); returns the
 * tarball path and its file list.
 */
export function pack(dir) {
  const { stdout } = npm('npm pack', ['pack', '--json', '--pack-destination', dir], {
    cwd: root,
    env: npmEnv(),
  });
  const info = parsePackOutput(stdout);
  return { tarball: join(dir, info.filename), files: info.files.map((file) => file.path) };
}

/** Copies a fixture into the work directory and installs the tarball and its dependencies. */
function installFixture(name, work, tarball) {
  const dir = join(work, name);
  cpSync(join(root, 'scripts', 'fixtures', name), dir, { recursive: true });
  const base = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify(fixtureManifest(base, tarball), null, 2)}\n`,
  );
  npm(
    `npm install (${name} fixture)`,
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--prefer-offline',
      '--loglevel=error',
    ],
    { cwd: dir, env: npmEnv() },
  );
  return dir;
}

function smoke(dir, script, node = process.execPath) {
  const { status, stdout, stderr } = run(node, [script, JSON.stringify(EXPORTED_SUBPATHS)], {
    cwd: dir,
  });
  if (status !== 0) return { error: `${script} exited with ${status}: ${stderr.trim()}` };
  try {
    return JSON.parse(stdout.trim().split('\n').pop());
  } catch {
    return { error: `${script} printed no result: ${stdout}${stderr}` };
  }
}

/** The `wave-rtl:` classes of the class strings of the installed package's `dist`. */
function distDirectionClasses(dir) {
  const dist = {
    base: join(dir, 'node_modules', pkg.name, 'dist'),
    pattern: '**/*',
    negated: false,
  };
  return [...classStringTokens([dist])].filter(hasDirectionVariant);
}

/**
 * The fixture's Vite build of `entry` (see {@link viteBuildCss}), checked by `check` (the
 * checks of the fixture's own CSS) and, unless `directions` is false (a build without the
 * components' classes), {@link checkViteCss}; errors are labelled with `label`.
 */
async function checkViteBuild(dir, entry, { tailwind = false, directions = true, label, check }) {
  let css;
  try {
    css = await viteBuildCss(dir, entry, { tailwind });
  } catch (error) {
    return [`${label}: vite build failed: ${error.message}`];
  }
  return [
    ...check(css),
    ...(directions ? checkViteCss(css, { directionClasses: distDirectionClasses(dir) }) : []),
  ].map((error) => `${label}: ${error}`);
}

/** The fixture's type programs: the `.mts` file under node16 and the `.cts` file under node20. */
const TYPE_PROGRAMS = [
  { project: 'tsconfig.json', label: 'types (.mts, module node16)' },
  { project: 'tsconfig.cjs.json', label: 'types (.cts, module node20)' },
];

async function runPlain(dir, io) {
  const esm = smoke(dir, 'smoke.mjs');
  const cjs = smoke(dir, 'smoke.cjs');
  const errors = checkPlainSmoke({ esm, cjs });

  const floor = resolveFloorNode();
  if (floor.path) {
    errors.push(...checkFloorSmoke({ esm, floor: smoke(dir, 'smoke.cjs', floor.path) }));
    io.log('pack-smoke: smoke.cjs ran on the Node floor (22.12)');
  } else {
    io.log(`pack-smoke: skipped smoke.cjs on the Node floor: ${floor.skip}`);
  }

  const styles = esm.resolved?.['./styles'];
  if (styles && existsSync(styles)) {
    errors.push(
      ...checkPlainCss(readFileSync(styles, 'utf8')).map((error) => `./styles: ${error}`),
    );
  }
  const preflight = esm.resolved?.['./preflight.css'];
  if (preflight && existsSync(preflight)) {
    errors.push(...assertPreflightCss(readFileSync(preflight, 'utf8')));
  }
  const utilities = esm.resolved?.['./utilities'];
  if (utilities && existsSync(utilities)) {
    errors.push(
      ...checkUtilitiesCss(readFileSync(utilities, 'utf8')).map((error) => `./utilities: ${error}`),
    );
  }

  const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  for (const { project, label } of TYPE_PROGRAMS) {
    const types = run(process.execPath, [tsc, '-p', project, '--listFiles'], { cwd: dir });
    errors.push(
      ...checkTypeProgram({ status: types.status, output: `${types.stdout}${types.stderr}` }).map(
        (error) => `${label}: ${error}`,
      ),
    );
  }

  // An app that imports ./styles and builds with Vite's defaults.
  errors.push(
    ...(await checkViteBuild(dir, 'vite-entry.js', {
      label: './styles (vite build)',
      check: checkPlainCss,
    })),
  );
  // An app without Tailwind that imports the token utilities, built with Vite's defaults.
  errors.push(
    ...(await checkViteBuild(dir, 'utilities-entry.js', {
      directions: false,
      label: './utilities.css (vite build)',
      check: checkUtilitiesCss,
    })),
  );

  // The migration codemod, run from the installed package with Node.js alone.
  const codemod = join(
    dir,
    'node_modules',
    '@mortenbrudvik',
    'waveui',
    ...SHIPPED_SCRIPTS[0].split('/'),
  );
  const before = readFileSync(join(dir, CODEMOD_FIXTURE), 'utf8');
  const migration = run(
    process.execPath,
    [codemod, '--dry-run', '--include-shared', CODEMOD_FIXTURE],
    { cwd: dir },
  );
  errors.push(
    ...checkCodemodRun(migration, {
      before,
      after: readFileSync(join(dir, CODEMOD_FIXTURE), 'utf8'),
    }).map((error) => `codemod: ${error}`),
  );
  return errors;
}

/** The plain fixture's file the migration codemod dry-runs over (two rewrites). */
const CODEMOD_FIXTURE = 'migrate.css';

/**
 * The dry run of the shipped migration codemod over the plain fixture's `migrate.css`: it exits 0,
 * reports the file's two rewrites and leaves the file (`before`, `after`) as it was.
 */
export function checkCodemodRun({ status, stdout, stderr }, { before, after }) {
  const errors = [];
  if (status !== 0) errors.push(`exited with ${status}: ${`${stderr}${stdout}`.trim()}`);
  if (!/^migrate-1\.0 \(dry run\): 2 replacement\(s\) in 1 of 1 file\(s\)$/m.test(stdout)) {
    errors.push(`unexpected report: ${stdout.trim() || '(none)'}`);
  }
  if (before !== after) errors.push(`the dry run changed ${CODEMOD_FIXTURE}`);
  return errors;
}

/**
 * The value of the app's own `--wave-primary` override in `@layer base` of the Tailwind
 * fixture's `input.css`.
 */
export const APP_TOKEN_OVERRIDE = '#c4314b';

/** The fixture's Tailwind builds: the input file, its output file and its `setup`. */
const TAILWIND_BUILDS = [
  { input: 'input.css', output: 'out.css', setup: 'tailwind', tokenOverride: APP_TOKEN_OVERRIDE },
  { input: 'tokens-input.css', output: 'tokens-out.css', setup: 'tokens' },
];

async function runTailwind(dir) {
  const manifestPath = require.resolve('@tailwindcss/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.tailwindcss;
  const directionClasses = distDirectionClasses(dir);
  const errors = [];
  for (const { input, output, setup, tokenOverride } of TAILWIND_BUILDS) {
    const result = run(
      process.execPath,
      [join(dirname(manifestPath), bin), '--input', input, '--output', output],
      { cwd: dir },
    );
    if (result.status !== 0) {
      errors.push(
        `${input}: @tailwindcss/cli failed (exit ${result.status}): ${result.stderr.trim()}`,
      );
      continue;
    }
    const css = readFileSync(join(dir, output), 'utf8');
    errors.push(
      ...checkTailwindCss(css, { directionClasses, setup, tokenOverride }).map(
        (error) => `${input}: ${error}`,
      ),
    );
  }

  // The documented entry in an app built with Vite's defaults and @tailwindcss/vite; the
  // direction classes are checkViteCss's part.
  errors.push(
    ...(await checkViteBuild(dir, 'input.css', {
      tailwind: true,
      label: 'input.css (vite build)',
      check: (css) => checkTailwindCss(css, { tokenOverride: APP_TOKEN_OVERRIDE }),
    })),
  );
  return errors;
}

/** CLI entry; returns the exit code. `io` receives the report (default: the console). */
export async function main(argv = process.argv.slice(2), io = console) {
  const { fixtures, keep } = parseArgs(argv);
  for (const file of [
    'dist/index.mjs',
    'dist/styles.css',
    'dist/components.css',
    'dist/utilities.css',
  ]) {
    if (!existsSync(join(root, file))) {
      io.error(`pack-smoke: ${file} does not exist (run npm run build first)`);
      return 1;
    }
  }
  const work = mkdtempSync(join(tmpdir(), 'wave-pack-smoke-'));
  const failures = [];
  try {
    const { tarball, files } = pack(work);
    io.log(`pack-smoke: packed ${files.length} files`);
    failures.push(...checkPackedFiles(files).map((error) => `tarball: ${error}`));
    for (const name of fixtures) {
      const dir = installFixture(name, work, tarball);
      const errors = await (name === 'plain' ? runPlain(dir, io) : runTailwind(dir));
      failures.push(...errors.map((error) => `${name}: ${error}`));
      io.log(`pack-smoke: ${name} fixture ${errors.length === 0 ? 'OK' : 'FAILED'}`);
    }
  } catch (error) {
    failures.push(error.message);
  } finally {
    if (keep) io.log(`pack-smoke: work directory kept at ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }
  if (failures.length > 0) {
    io.error(`pack-smoke: ${failures.length} problem(s):`);
    for (const failure of failures) io.error(`  - ${failure}`);
    return 1;
  }
  io.log('pack-smoke: OK');
  return 0;
}

await runScript(import.meta.url, main);
