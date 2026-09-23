#!/usr/bin/env node
/**
 * Packaging smoke test (`npm run test:pack`, spec §3.2; repo-level#1, #5): packs the tarball the
 * way `npm publish` would and installs it into throwaway copies of the consumer fixtures in
 * `scripts/fixtures/`. Run it after `npm run build` (`prepublishOnly` does).
 *
 *   tarball   every `exports` target is packed (and the style sources they `@import`); no tests,
 *             stories, component sources or scripts are.
 *   plain     an app without Tailwind (scripts/fixtures/plain):
 *               - `import` and `require` load the package, expose Button, WaveProvider and cn
 *                 with the same names in both formats, and every exported subpath resolves
 *                 (the `./x` and `./x.css` aliases to one file);
 *               - `./styles` is the precompiled, unlayered stylesheet: `.bg-primary`,
 *                 `.text-body-1`, `--wave-primary`, `@keyframes wave-spin` and the native
 *                 reset scoped to `.wave-root`/`.wave-portal`, no `@layer` other than Tailwind's
 *                 `properties` fallback, no raw Tailwind directives; `./preflight.css` is
 *                 Preflight;
 *               - TypeScript (node16) type-checks an ES module and a CommonJS file importing the
 *                 package: the ESM file gets `dist/index.d.ts`, the CommonJS file
 *                 `dist/index.d.cts` (no TS1479).
 *   tailwind  a Tailwind 4 app (scripts/fixtures/tailwind) compiling
 *             `@import 'tailwindcss'; @import '@mortenbrudvik/waveui/tailwind';` with
 *             @tailwindcss/cli: the component classes are generated from the package's `dist`,
 *             Wave's tokens sit in `@layer theme` and its base rules in `@layer base`, and the
 *             app's own utilities are still generated.
 *
 * The fixture dependencies (`smokeDependencies` in each fixture's package.json) are pinned to
 * the versions installed in this repository, so `npm install` is served from the npm cache when
 * it can be. TypeScript and @tailwindcss/cli run from this repository.
 *
 * Usage: node scripts/pack-smoke.mjs [--fixture plain|tailwind]... [--keep]
 *   --fixture  run only this fixture (repeatable; default: both)
 *   --keep     keep the work directory (tarball and installed fixtures) for inspection
 *
 * The assertions are exported and tested by scripts/__tests__/pack-smoke.test.mjs; importing
 * the module does not run anything.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPreflightCss, parseCss, selectorClasses, selectorList } from './build-css.mjs';
import { isMainModule } from './verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** The subpath exports of package.json besides `.` (the smoke fixtures resolve each one). */
export const EXPORTED_SUBPATHS = [
  './styles',
  './styles.css',
  './preflight.css',
  './tailwind',
  './tailwind.css',
  './tokens',
  './tokens.css',
  './legacy-tokens.css',
  './package.json',
];

/** Subpaths that must resolve to the same file. */
const ALIASES = [
  ['./styles', './styles.css'],
  ['./tailwind', './tailwind.css'],
  ['./tokens', './tokens.css'],
];

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
 * and so is every style source a packed `src/styles` target `@import`s; tests, stories,
 * component sources and scripts are not. `readSource` reads a source file of this repository.
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
    }
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
      if (packed.has(imported)) queue.push(imported);
      else errors.push(`${path} @imports ${imported}, which is not in the tarball`);
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
  for (const name of ['bg-primary', 'text-body-1']) {
    if (!classes.has(name)) errors.push(`missing the component utility .${name}`);
  }
  if (!tokenFound) errors.push('missing the token --wave-primary');
  if (!keyframesFound) errors.push('missing @keyframes wave-spin');
  if (!resetFound) errors.push(`missing the scoped native reset (${NATIVE_RESET})`);
  return errors;
}

/**
 * The Tailwind consumer build of `./tailwind` (repo-level#1): Wave's tokens in `@layer theme`,
 * its base rules in `@layer base`, the component classes generated from the package's `dist`,
 * and the consumer's own utilities.
 */
export function checkTailwindCss(css) {
  const errors = [];
  const tokenLayers = new Set();
  const baseLayers = new Set();
  visit(parseCss(css), (node, ancestors) => {
    if (declares(node, '--wave-primary')) tokenLayers.add(layerOf(ancestors) ?? '<unlayered>');
    if (isStyleRule(node) && /\.wave-root\b/.test(node.prelude)) {
      baseLayers.add(layerOf(ancestors) ?? '<unlayered>');
    }
  });
  if (tokenLayers.size === 0) errors.push('missing the Wave token --wave-primary');
  else if ([...tokenLayers].some((layer) => layer !== 'theme')) {
    errors.push(
      `Wave tokens (--wave-primary) must sit in @layer theme, found in ${[...tokenLayers].join(', ')}`,
    );
  }
  if (baseLayers.size === 0) errors.push('missing the Wave base rules (.wave-root)');
  else if ([...baseLayers].some((layer) => layer !== 'base')) {
    errors.push(
      `Wave base rules (.wave-root) must sit in @layer base, found in ${[...baseLayers].join(', ')}`,
    );
  }
  const classes = selectorClasses(css);
  for (const name of ['bg-primary', 'text-body-1']) {
    if (!classes.has(name)) {
      errors.push(
        `the component class .${name} was not generated (the package's dist was not scanned)`,
      );
    }
  }
  if (!classes.has('p-4')) {
    errors.push(
      "the consumer utility .p-4 was not generated (the fixture's own sources were not scanned)",
    );
  }
  return errors;
}

/**
 * What the plain fixture's ESM (`esm`) and CommonJS (`cjs`) smoke scripts observed: each loads
 * the package (`names`, `cn` result) and resolves every subpath (`resolved`).
 */
export function checkPlainSmoke({ esm, cjs }) {
  const errors = [];
  for (const [label, side] of [
    ['import', esm],
    ['require', cjs],
  ]) {
    if (!side) {
      errors.push(`${label}: no result`);
      continue;
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
  }
  if (esm?.names && cjs?.names) {
    const onlyEsm = esm.names.filter((name) => !cjs.names.includes(name));
    const onlyCjs = cjs.names.filter((name) => !esm.names.includes(name));
    if (onlyEsm.length > 0) errors.push(`only the ESM build exports ${onlyEsm.join(', ')}`);
    if (onlyCjs.length > 0) errors.push(`only the CommonJS build exports ${onlyCjs.join(', ')}`);
  }
  return errors;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The fixture's `tsc --listFiles` run (repo-level#5): no type errors, and the program loaded
 * this package's `dist/index.d.ts` (ESM file) and `dist/index.d.cts` (CommonJS file) — the
 * installed `node_modules/<packageName>/dist/…`, not another dependency's `dist/index.d.*`.
 */
export function checkTypeProgram({ status, output }, packageName = pkg.name) {
  const errors = [];
  const text = output.split('\\').join('/');
  const typeErrors = text.split('\n').filter((line) => /error TS\d+/.test(line));
  for (const line of typeErrors.slice(0, 10)) errors.push(`type error: ${line.trim()}`);
  if (status !== 0 && typeErrors.length === 0) errors.push(`tsc exited with status ${status}`);
  const installed = `/node_modules/${escapeRegExp(packageName)}/dist/`;
  if (!new RegExp(`${installed}index\\.d\\.ts\\s*$`, 'm').test(text)) {
    errors.push(`the ES module consumer did not load ${packageName}/dist/index.d.ts`);
  }
  if (!new RegExp(`${installed}index\\.d\\.cts\\s*$`, 'm').test(text)) {
    errors.push(`the CommonJS consumer did not load ${packageName}/dist/index.d.cts`);
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
 * The environment for npm in a fixture: without the `npm_*` variables of an enclosing
 * `npm run` (package and lifecycle data, prefixes), which describe this repository.
 */
function fixtureEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^npm_(package_|lifecycle_)/i.test(key)) continue;
    if (/^npm_config_(local_prefix|prefix|global|workspaces?)$/i.test(key)) continue;
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

/** Packs the package into `dir`; returns the tarball path and its file list. */
function pack(dir) {
  const { stdout } = npm('npm pack', ['pack', '--json', '--pack-destination', dir], { cwd: root });
  const [info] = JSON.parse(stdout.slice(stdout.indexOf('[')));
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
    { cwd: dir, env: fixtureEnv() },
  );
  return dir;
}

function smoke(dir, script) {
  const { status, stdout, stderr } = run(
    process.execPath,
    [script, JSON.stringify(EXPORTED_SUBPATHS)],
    { cwd: dir },
  );
  if (status !== 0) return { error: `${script} exited with ${status}: ${stderr.trim()}` };
  try {
    return JSON.parse(stdout.trim().split('\n').pop());
  } catch {
    return { error: `${script} printed no result: ${stdout}${stderr}` };
  }
}

function runPlain(dir) {
  const esm = smoke(dir, 'smoke.mjs');
  const cjs = smoke(dir, 'smoke.cjs');
  const errors = checkPlainSmoke({ esm, cjs });

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

  const tsc = join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  const types = run(process.execPath, [tsc, '-p', 'tsconfig.json', '--listFiles'], { cwd: dir });
  errors.push(
    ...checkTypeProgram({ status: types.status, output: `${types.stdout}${types.stderr}` }),
  );
  return errors;
}

function runTailwind(dir) {
  const manifestPath = require.resolve('@tailwindcss/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.tailwindcss;
  const result = run(
    process.execPath,
    [join(dirname(manifestPath), bin), '--input', 'input.css', '--output', 'out.css'],
    { cwd: dir },
  );
  if (result.status !== 0) {
    return [`@tailwindcss/cli failed (exit ${result.status}): ${result.stderr.trim()}`];
  }
  return checkTailwindCss(readFileSync(join(dir, 'out.css'), 'utf8'));
}

/** CLI entry; returns the exit code. `io` receives the report (default: the console). */
export async function main(argv = process.argv.slice(2), io = console) {
  const { fixtures, keep } = parseArgs(argv);
  for (const file of ['dist/index.mjs', 'dist/index.cjs', 'dist/styles.css']) {
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
      const errors = name === 'plain' ? runPlain(dir) : runTailwind(dir);
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

if (isMainModule(import.meta.url)) {
  process.exitCode = await main();
}
