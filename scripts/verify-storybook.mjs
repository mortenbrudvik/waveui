#!/usr/bin/env node
/**
 * Verifies the static Storybook build (`npm run build-storybook` runs it after `storybook
 * build`; spec §3.2, §3.3; repo-level#1; Phase 14 spec R6): the preview's stylesheet was compiled
 * by Tailwind from its two sheets, i.e.
 *   - it contains the library utility `.wave:bg-primary` (`.storybook/preview.css`, the library
 *     stylesheet with Wave's prefix: the components are not rendered unstyled), and
 *   - it contains every utility the stories use (`.storybook/stories.css`, the stories' own
 *     classes as an app's unprefixed Tailwind build compiles them), proving `@source '../stories'`
 *     took effect. Since 1.0 every utility of the stories is story-only: the library's classes all
 *     carry its prefix, so it provides none of them. They are found by compiling a reference —
 *     Tailwind's theme and utilities with Wave's namespaced keys (tokens.css as a reference) and
 *     variants, `stories/` as the only source, with the Tailwind CLI and independently of
 *     `.storybook/stories.css` — and keeping the Tailwind candidates of `stories/` it compiles.
 *     `scripts/build-css.mjs` asserts the reverse for dist/styles.css: no story-only class ships
 *     to consumers.
 *
 * When the stories use no utility, there is nothing a missing `@source` could leave unstyled and
 * the second check has nothing to require: the build passes on `.wave:bg-primary` (and fails
 * again as soon as a story adds a utility that the build lacks).
 *
 * The stylesheet also keeps Wave's direction variant (src/styles/variants.css, C-LOGICAL) for
 * every `wave-rtl:` class of the library, as scripts/build-css.mjs asserts for dist, and selects
 * none of them by `:lang()`. `storybook build` minifies the CSS with Vite's defaults (Lightning
 * CSS, Chrome 111 target), which rewrite a bare `:dir(rtl)` to a `:lang()` list that no story
 * matches (they set `dir`, not `lang`); an app built with Vite gets the same CSS.
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
import {
  classStringTokens,
  collectStorySources,
  DIRECTION_VARIANT_FORM,
  hasDirectionVariant,
  loweredDirectionClasses,
  missingDirectionVariant,
  selectorClasses,
  storyOnlyClasses,
} from './build-css.mjs';
import { runScript } from './verify-dist.mjs';

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

/** The library utility whose presence shows the library sheet was compiled (Wave's prefix). */
export const LIBRARY_PROBE = 'wave:bg-primary';

/**
 * The story-only utilities a correct Storybook build contains for the project at
 * `projectRoot`: Tailwind's theme (inlined) and utilities with the project's
 * `src/styles/tokens.css` as a reference (its namespaced keys) and `src/styles/variants.css`,
 * compiled by the Tailwind CLI with its `stories/` as the only source (what
 * `.storybook/stories.css` is meant to compile, independent of that file), reduced to the story
 * candidates it compiles (`storyOnlyClasses` of scripts/build-css.mjs over `sources.stories`; the
 * library, whose classes carry Wave's prefix, provides none of them). Empty when the stories use
 * no utility.
 */
export function expectedStoryOnly(projectRoot = root, sources = collectStorySources(projectRoot)) {
  const work = mkdtempSync(join(tmpdir(), 'wave-verify-storybook-'));
  try {
    const input = join(work, 'reference.css');
    const output = join(work, 'reference.out.css');
    const tailwind = dirname(
      createRequire(join(projectRoot, 'package.json')).resolve('tailwindcss/package.json'),
    );
    const style = (name) => join(projectRoot, 'src', 'styles', name);
    writeFileSync(
      input,
      `@import ${cssPath(join(tailwind, 'theme.css'))} theme(inline);\n` +
        `@import ${cssPath(style('tokens.css'))} reference;\n` +
        (existsSync(style('variants.css')) ? `@import ${cssPath(style('variants.css'))};\n` : '') +
        `@import ${cssPath(join(tailwind, 'utilities.css'))} source(none);\n` +
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
    return storyOnlyClasses(readFileSync(output, 'utf8'), {
      stories: sources.stories,
      library: [],
      libraryClasses: [],
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * The `wave-rtl:` classes of the library class strings of the project at `projectRoot` (the
 * sources of its style entries, read as scripts/build-css.mjs reads them), sorted.
 */
export function expectedDirectionClasses(projectRoot = root) {
  return [...classStringTokens(collectStorySources(projectRoot).library)]
    .filter(hasDirectionVariant)
    .sort();
}

/**
 * Checks one stylesheet: {@link LIBRARY_PROBE} is present, and so is every story-only utility of
 * `expected` (see {@link expectedStoryOnly}); every class of `directionClasses` (see
 * {@link expectedDirectionClasses}) is compiled with Wave's direction variant, and none is
 * selected by `:lang()`: Vite's CSS minifier (Lightning CSS) rewrites a bare `:dir(rtl)` to a
 * `:lang()` list for its default target, and the class then never matches a story, which sets
 * `dir` but no `lang`. Returns the errors and the story-only classes found.
 */
export function checkStorybookCss(css, expected, directionClasses = []) {
  const errors = [];
  const classes = selectorClasses(css);
  if (!classes.has(LIBRARY_PROBE)) {
    errors.push(
      `the Storybook CSS lacks .${LIBRARY_PROBE}: the components are unstyled ` +
        '(.storybook/preview.css was not compiled by Tailwind)',
    );
    return { errors, storyOnly: [] };
  }
  const storyOnly = expected.filter((name) => classes.has(name));
  const missing = expected.filter((name) => !classes.has(name));
  if (missing.length > 0) {
    errors.push(
      `the Storybook CSS lacks ${missing.length} of the ${expected.length} utilities used only ` +
        `in stories/ (${missing.slice(0, 10).join(' ')}${missing.length > 10 ? ' …' : ''}): ` +
        "stories/ is not a Tailwind source of .storybook/stories.css (@source '../stories'), " +
        'or the build is older than the stories',
    );
  }
  const lowered = loweredDirectionClasses(css);
  if (lowered.length > 0) {
    errors.push(
      `the Storybook CSS selects ${lowered.length} wave-rtl ` +
        `${lowered.length === 1 ? 'class' : 'classes'} by :lang() ` +
        `(${lowered.slice(0, 10).join(' ')}${lowered.length > 10 ? ' …' : ''}): the CSS ` +
        "minifier rewrote :dir(rtl) of Wave's direction variant, so the class never matches a " +
        'story that sets dir without a right-to-left lang',
    );
  }
  const uncompiled = missingDirectionVariant(css, directionClasses).filter(
    (name) => !lowered.includes(name),
  );
  if (uncompiled.length > 0) {
    errors.push(
      `the Storybook CSS lacks Wave's direction variant for ${uncompiled.length} of the ` +
        `${directionClasses.length} wave-rtl classes of the library ` +
        `(${uncompiled.slice(0, 10).join(' ')}${uncompiled.length > 10 ? ' …' : ''}): expected ` +
        `${DIRECTION_VARIANT_FORM} (src/styles/variants.css)`,
    );
  }
  return { errors, storyOnly };
}

/**
 * Finds the preview stylesheet of a static Storybook build in `dir` and checks it against the
 * `expected` story-only utilities and the library's `directionClasses`. Returns the errors, the
 * stylesheet checked (`file`, relative to `dir`) and its story-only classes.
 */
export function verifyStorybook(dir, expected, directionClasses = []) {
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
  // No stylesheet passes: report the first styled one (it has the probe), else the first.
  let candidate;
  let candidateStyled = false;
  for (const file of files) {
    const css = readFileSync(join(dir, file), 'utf8');
    const result = { ...checkStorybookCss(css, expected, directionClasses), file };
    if (result.errors.length === 0) return result;
    const styled = selectorClasses(css).has(LIBRARY_PROBE);
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
 * utilities) defaults to {@link expectedStoryOnly} and `directionClasses` (the library's
 * `wave-rtl:` classes) to {@link expectedDirectionClasses}, both of this repository.
 */
export function main(
  argv = process.argv.slice(2),
  io = console,
  expected = undefined,
  directionClasses = undefined,
) {
  const { dir } = parseArgs(argv);
  const where = relative(process.cwd(), dir) || dir;
  let wanted = expected;
  let direction = directionClasses;
  try {
    wanted ??= expectedStoryOnly();
    direction ??= expectedDirectionClasses();
  } catch (error) {
    io.error(`verify-storybook: ${error.message}`);
    return 1;
  }
  const { errors, file, storyOnly } = verifyStorybook(dir, wanted, direction);
  if (errors.length > 0) {
    io.error(`verify-storybook: ${errors.length} problem(s) in ${where}${file ? `/${file}` : ''}:`);
    for (const error of errors) io.error(`  - ${error}`);
    return 1;
  }
  const utilities =
    storyOnly.length > 0
      ? `.${LIBRARY_PROBE} and all ${storyOnly.length} story-only utilities, e.g. ` +
        storyOnly.slice(0, 5).join(' ')
      : `.${LIBRARY_PROBE}; the stories use no utility, so there is no story-only utility to ` +
        'check';
  io.log(
    `verify-storybook: ${where}/${file} OK (${utilities}; all ${direction.length} wave-rtl ` +
      "classes of the library with Wave's direction variant)",
  );
  return 0;
}

await runScript(import.meta.url, main);
