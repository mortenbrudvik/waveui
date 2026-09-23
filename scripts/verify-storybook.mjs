#!/usr/bin/env node
/**
 * Verifies the static Storybook build (`npm run build-storybook` runs it after `storybook
 * build`; spec §3.2, §3.3; repo-level#1): the preview's stylesheet was compiled by Tailwind from
 * `.storybook/preview.css`, i.e.
 *   - it contains the library utility `.bg-primary` (the stories are not rendered unstyled), and
 *   - it contains every utility the stories need that the library does not provide, proving
 *     `@source '../stories'` took effect. Those story-only utilities are found by compiling a
 *     reference — the library stylesheet `src/styles/styles.css` with `stories/` as an extra
 *     source, with the Tailwind CLI and independently of `.storybook/preview.css` — and keeping
 *     the Tailwind candidates of `stories/` that no library source (src/components, src/lib, the
 *     style entries) uses. `scripts/build-css.mjs` asserts the reverse for dist/styles.css: no
 *     story-only class ships to consumers.
 *
 * When the stories use no utility the library lacks, there is nothing a missing `@source` could
 * leave unstyled and the second check has nothing to require: the build passes on `.bg-primary`
 * (and fails again as soon as a story adds a story-only utility that the build lacks). So no
 * story has to keep a story-only class alive for the build to pass.
 *
 * Both sides are scanned with Tailwind's own scanner (the helpers of scripts/build-css.mjs), the
 * way the builds scan their sources.
 *
 * Usage: node scripts/verify-storybook.mjs [--dir <storybook-static>]
 *
 * The checks are exported and tested by scripts/__tests__/verify-storybook.test.mjs; importing
 * the module does not run them.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectStorySources, selectorClasses, storyOnlyClasses } from './build-css.mjs';
import { isMainModule } from './verify-dist.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** Every `.css` file under `dir`, as `/`-separated paths relative to it. */
function cssFiles(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...cssFiles(dir, path));
    else if (entry.name.endsWith('.css')) files.push(path);
  }
  return files.sort();
}

/** The @tailwindcss/cli executable (a devDependency; scripts/build-css.mjs builds with it). */
function tailwindCli() {
  const manifestPath = require.resolve('@tailwindcss/cli/package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.tailwindcss;
  return join(dirname(manifestPath), bin);
}

/** A CSS string literal of an absolute path (forward slashes, so Windows paths work too). */
function cssPath(path) {
  return JSON.stringify(path.split(sep).join('/'));
}

/**
 * The story-only utilities a correct Storybook build contains for the project at
 * `projectRoot`: its `src/styles/styles.css` compiled by the Tailwind CLI with its `stories/` as
 * an extra source (what `.storybook/preview.css` is meant to compile, independent of that file),
 * reduced to the story candidates no library source uses (`storyOnlyClasses` of
 * scripts/build-css.mjs over `sources`). Empty when the stories need no utility the library
 * lacks.
 */
export function expectedStoryOnly(projectRoot = root, sources = collectStorySources(projectRoot)) {
  const work = mkdtempSync(join(tmpdir(), 'wave-verify-storybook-'));
  try {
    const input = join(work, 'reference.css');
    const output = join(work, 'reference.out.css');
    writeFileSync(
      input,
      `@import ${cssPath(join(projectRoot, 'src', 'styles', 'styles.css'))};\n` +
        `@source ${cssPath(join(projectRoot, 'stories'))};\n`,
    );
    const result = spawnSync(
      process.execPath,
      [tailwindCli(), '--input', input, '--output', output],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(
        `tailwindcss failed to compile the reference stylesheet (exit ${result.status}):\n` +
          `${result.stderr}${result.stdout}`,
      );
    }
    return storyOnlyClasses(readFileSync(output, 'utf8'), sources);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * Checks one stylesheet: `.bg-primary` is present, and so is every story-only utility of
 * `expected` (see {@link expectedStoryOnly}). Returns the errors and the story-only classes
 * found.
 */
export function checkStorybookCss(css, expected) {
  const errors = [];
  const classes = selectorClasses(css);
  if (!classes.has('bg-primary')) {
    errors.push(
      'the Storybook CSS lacks .bg-primary: the preview is unstyled (.storybook/preview.css was ' +
        'not compiled by Tailwind)',
    );
    return { errors, storyOnly: [] };
  }
  const storyOnly = expected.filter((name) => classes.has(name));
  const missing = expected.filter((name) => !classes.has(name));
  if (missing.length > 0) {
    errors.push(
      `the Storybook CSS lacks ${missing.length} of the ${expected.length} utilities used only ` +
        `in stories/ (${missing.slice(0, 10).join(' ')}${missing.length > 10 ? ' …' : ''}): ` +
        "stories/ is not a Tailwind source of .storybook/preview.css (@source '../stories'), " +
        'or the build is older than the stories',
    );
  }
  return { errors, storyOnly };
}

/**
 * Finds the preview stylesheet of a static Storybook build in `dir` and checks it against the
 * `expected` story-only utilities. Returns the errors, the stylesheet checked (`file`, relative
 * to `dir`) and its story-only classes.
 */
export function verifyStorybook(dir, expected) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return {
      errors: [`${dir} does not exist (run storybook build first)`],
      file: undefined,
      storyOnly: [],
    };
  }
  const files = cssFiles(dir);
  if (files.length === 0) {
    return {
      errors: [`no CSS files in ${dir}: the preview stylesheet was not emitted`],
      file: undefined,
      storyOnly: [],
    };
  }
  // No stylesheet passes: report the first styled one (it has .bg-primary), else the first.
  let candidate;
  let candidateStyled = false;
  for (const file of files) {
    const css = readFileSync(join(dir, file), 'utf8');
    const result = { ...checkStorybookCss(css, expected), file };
    if (result.errors.length === 0) return result;
    const styled = selectorClasses(css).has('bg-primary');
    if (!candidate || (styled && !candidateStyled)) {
      candidate = result;
      candidateStyled = styled;
    }
  }
  return candidate;
}

function parseArgs(argv) {
  const options = { dir: join(root, 'storybook-static') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') options.dir = resolve(argv[++i]);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return options;
}

/**
 * CLI entry; returns the exit code. `io` receives the report; `expected` (the story-only
 * utilities) defaults to {@link expectedStoryOnly} of this repository.
 */
export function main(argv = process.argv.slice(2), io = console, expected = undefined) {
  const { dir } = parseArgs(argv);
  const where = relative(process.cwd(), dir) || dir;
  let wanted = expected;
  if (!wanted) {
    try {
      wanted = expectedStoryOnly();
    } catch (error) {
      io.error(`verify-storybook: ${error.message}`);
      return 1;
    }
  }
  const { errors, file, storyOnly } = verifyStorybook(dir, wanted);
  if (errors.length > 0) {
    io.error(`verify-storybook: ${errors.length} problem(s) in ${where}${file ? `/${file}` : ''}:`);
    for (const error of errors) io.error(`  - ${error}`);
    return 1;
  }
  io.log(
    storyOnly.length > 0
      ? `verify-storybook: ${where}/${file} OK (.bg-primary and all ${storyOnly.length} ` +
          `story-only utilities, e.g. ${storyOnly.slice(0, 5).join(' ')})`
      : `verify-storybook: ${where}/${file} OK (.bg-primary; the stories use no utility the ` +
          'library lacks, so there is no story-only utility to check)',
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = main();
}
