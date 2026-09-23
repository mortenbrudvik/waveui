#!/usr/bin/env node
/**
 * Guards the TypeScript program layout (repo-level#20).
 *
 * The dev program (tsconfig.dev.json) must type-check tests, stories and the Storybook config. A
 * config that silently stops checking them — for example by inheriting the library program's
 * `exclude` — still type-checks "cleanly", so this script lists the program's files and fails
 * unless it contains:
 *   - at least one file under src/**\/__tests__/
 *   - at least one stories/*.stories.tsx file
 *   - .storybook/preview.tsx
 *
 * It also asserts the reverse for the library program (tsconfig.json): no tests, test helpers or
 * stories, so `npm run build` cannot be blocked by test/story type errors and the published
 * declarations never include test-only code.
 *
 * Finally, the node program (tsconfig.node.json) must type-check against the Node version that
 * `engines.node` promises: the declared and installed `@types/node` majors must equal the engines
 * floor's major. Newer typings would let vite.config.ts/vitest.config.ts use APIs the floor lacks.
 *
 * Usage: node scripts/check-ts-coverage.mjs [--dev <tsconfig>] [--lib <tsconfig>]
 *   [--package <package.json>]
 *
 * `lowestMajor` and `checkTypesNode` are exported for scripts/__tests__/check-ts-coverage.test.mjs;
 * importing the module does not run the checks.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * The lowest major version a semver range sets as a floor: `>=20.19.0` → 20, `^20.19 || >=22` → 20,
 * `20.0.0-rc1` → 20. Only the leading number of each comparator is a major, so minor, patch,
 * prerelease and build digits never count. Upper bounds (`<21`, `<=22`, the right end of a hyphen
 * range `20 - 22`) set no floor, and wildcards (`*`, `x`) or tags (`latest`) have no major; a
 * range with no floor returns undefined.
 */
export function lowestMajor(range) {
  const comparators = String(range ?? '')
    .replace(/([<>=^~])\s+/g, '$1') // `>= 20.19.0` is one comparator
    .split(/\s+|\|\|/)
    .filter(Boolean);
  const majors = [];
  for (let i = 0; i < comparators.length; i++) {
    const comparator = comparators[i];
    if (comparator === '-') {
      i++; // hyphen range: the upper end is not a floor
      continue;
    }
    if (comparator.startsWith('<')) continue;
    const match = /^[>=^~]*v?(\d+)(?:$|[.xX*+-])/.exec(comparator);
    if (match) majors.push(Number(match[1]));
  }
  return majors.length > 0 ? Math.min(...majors) : undefined;
}

/** The first line of an error's message (Node's resolution errors append a require stack). */
function firstLine(error) {
  return String(error instanceof Error ? error.message : error).split(/\r?\n/)[0];
}

/**
 * Checks that the declared (`pkg.devDependencies`) and installed `@types/node` majors equal the
 * `engines.node` floor's major. `readInstalled` returns the installed version and may throw when
 * `@types/node` is missing or unreadable; that becomes a failure line, never an uncaught error.
 * Returns the failure lines and the installed version (undefined when it could not be read).
 */
export function checkTypesNode(pkg, packageFile, readInstalled) {
  const failures = [];
  const enginesRange = pkg.engines?.node;
  const floorMajor = lowestMajor(enginesRange);
  const install =
    floorMajor === undefined
      ? 'npm install -D @types/node'
      : `npm install -D @types/node@^${floorMajor}`;

  let installed;
  try {
    installed = readInstalled();
  } catch (error) {
    failures.push(`@types/node is not installed or unreadable (${firstLine(error)}): ${install}`);
  }

  if (floorMajor === undefined) {
    failures.push(
      `${packageFile} has no engines.node lower bound (${enginesRange ?? 'missing'}) to check ` +
        '@types/node against',
    );
    return { failures, installed };
  }

  const declared = pkg.devDependencies?.['@types/node'];
  const typings = [
    [
      declared === undefined
        ? `${packageFile} does not declare @types/node in devDependencies`
        : `${packageFile} declares @types/node ${declared}`,
      lowestMajor(declared),
    ],
  ];
  if (installed !== undefined) {
    typings.push([`the installed @types/node is ${installed}`, lowestMajor(installed)]);
  }
  for (const [label, major] of typings) {
    if (major !== floorMajor) {
      failures.push(
        `${label}, but engines.node is ${enginesRange}: tsconfig.node.json must type-check ` +
          `against Node ${floorMajor} (${install})`,
      );
    }
  }
  return { failures, installed };
}

/** Reads the installed `@types/node` version; throws when it is missing or has no version. */
function readInstalledTypesNode() {
  const { version } = JSON.parse(readFileSync(require.resolve('@types/node/package.json'), 'utf8'));
  if (typeof version !== 'string') throw new Error('@types/node/package.json has no version');
  return version;
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

/** Returns the program's own files as repo-relative POSIX paths (node_modules excluded). */
function listProgramFiles(project) {
  const tsc = require.resolve('typescript/bin/tsc');
  const result = spawnSync(process.execPath, [tsc, '-p', project, '--listFilesOnly'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`tsc -p ${project} --listFilesOnly exited with code ${result.status}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((file) => relative(root, resolve(root, file)).split('\\').join('/'))
    .filter((file) => !file.startsWith('..') && !file.includes('node_modules/'));
}

function main() {
  const devProject = option('--dev', 'tsconfig.dev.json');
  const libProject = option('--lib', 'tsconfig.json');
  const packageFile = option('--package', 'package.json');
  const failures = [];

  const devFiles = listProgramFiles(devProject);
  const required = [
    ['a test file under src/**/__tests__/', (f) => /^src\/(.+\/)?__tests__\/[^/]+\.tsx?$/.test(f)],
    ['a story file stories/*.stories.tsx', (f) => /^stories\/[^/]+\.stories\.tsx$/.test(f)],
    ['.storybook/preview.tsx', (f) => f === '.storybook/preview.tsx'],
  ];
  for (const [label, matches] of required) {
    if (!devFiles.some(matches)) failures.push(`${devProject} does not type-check ${label}`);
  }

  const libFiles = listProgramFiles(libProject);
  const forbidden = [
    ['test files (**/__tests__/)', (f) => /(^|\/)__tests__\//.test(f)],
    [
      'test helpers (src/test-setup.ts, src/test-utils*)',
      (f) => /^src\/test-(setup|utils)/.test(f),
    ],
    ['stories', (f) => f.startsWith('stories/')],
  ];
  for (const [label, matches] of forbidden) {
    const offenders = libFiles.filter(matches);
    if (offenders.length > 0) {
      failures.push(`${libProject} must not include ${label}: ${offenders.slice(0, 3).join(', ')}`);
    }
  }

  const pkg = JSON.parse(readFileSync(resolve(root, packageFile), 'utf8'));
  const typesNode = checkTypesNode(pkg, packageFile, readInstalledTypesNode);
  failures.push(...typesNode.failures);

  if (failures.length > 0) {
    console.error('check-ts-coverage: TypeScript program setup is wrong:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  const count = (matches) => devFiles.filter(matches).length;
  console.log(
    `check-ts-coverage: ${devProject} checks ${count(required[0][1])} test files, ` +
      `${count(required[1][1])} story files and .storybook; ${libProject} has no tests or stories; ` +
      `@types/node ${typesNode.installed} matches engines.node ${pkg.engines.node}.`,
  );
}

/** True when Node runs this file as the entry script (not when a test imports it). */
function isEntryScript() {
  if (!process.argv[1]) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const entry = realpathSync(resolve(process.argv[1]));
    return process.platform === 'win32'
      ? self.toLowerCase() === entry.toLowerCase()
      : self === entry;
  } catch {
    return false;
  }
}

if (isEntryScript()) main();
