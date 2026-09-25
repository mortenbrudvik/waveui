#!/usr/bin/env node
/**
 * Verifies the library build in `dist/` (spec §3.1; repo-level#2, #3, #4, #5). `npm run build`
 * runs it last, after `vite build` and `scripts/build-css.mjs`.
 *
 * Checks:
 *   - directives: every component and hook module (`dist/components/**`, `dist/hooks/**`, both
 *     formats) starts with `"use client"`; no other file does — not `dist/lib/cn.*`, not
 *     `dist/index.*`, not any `index.*` barrel, not the bundler runtime (repo-level#2);
 *   - declarations: `dist/index.d.ts` and its `dist/index.d.cts` copy for the `require`
 *     condition (repo-level#5); every component it exports carries a JSDoc (C-DOCS: a compound
 *     is documented on its `Object.assign` export, which is what the roll-up keeps);
 *   - development mode: `dist/lib/dev.mjs` and `dist/lib/dev.cjs` still read
 *     `process.env.NODE_ENV` at run time, so a consumer's bundler decides between development and
 *     production (a `define` in vite.config.ts would inline the library's own build mode);
 *   - imports: every bare import is a dependency or peer dependency of package.json (or a
 *     subpath of one), relative imports resolve inside `dist/`, no Node.js builtin is imported
 *     and no dependency was bundled into `dist/` (repo-level#4);
 *   - react-server: the package loads in a React Server Component (repo-level#2). A copy of
 *     `dist/` in which every `"use client"` module is replaced by client references (what an RSC
 *     bundler does) is loaded under `node --conditions=react-server`: every other module — the
 *     `index.*` entries, `dist/lib/**`, the bundler runtime — must evaluate (no client-only
 *     React API at module scope, no dotting into a client reference such as `Card.Header`);
 *     `dist/lib/cn.*` must work and `dist/index.*` must export the server-side `cn`;
 *   - flat names: every sub-component of a compound export (`Card.Header`) is also exported
 *     from `dist/index.mjs` under its flat name (`CardHeader`), bound to the same component
 *     (C-COMPOUND, repo-level#2) — except the components on {@link PENDING_FLAT_EXPORTS}, a
 *     bridge that closes before publishing (`--final`);
 *   - CommonJS parity: `dist/index.cjs` exports the same names as `dist/index.mjs`;
 *   - tree-shaking: a probe entry importing only `Button` from `dist/index.mjs`, bundled with
 *     Vite's own `build()` API, contains only Button's module and its static imports — no
 *     Dialog code (repo-level#3). The probe honours package.json `sideEffects` exactly as a
 *     consumer's bundler does.
 *
 * Usage: node scripts/verify-dist.mjs [--dist <dir>] [--no-pending | --final]
 *   --dist        the dist directory (default: dist); its parent holds the package.json
 *   --no-pending  ignore PENDING_FLAT_EXPORTS (every compound must have its flat names)
 *   --final       the publish gate (`prepublishOnly`, final gate of the review-fix spec §7.2):
 *                 like --no-pending, and PENDING_FLAT_EXPORTS itself must be empty
 *
 * The checks are exported and tested by scripts/__tests__/verify-dist.test.mjs; importing the
 * module does not run them.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/**
 * A temporary bridge: components whose flat sub-component names (`<Parent><Member>`,
 * C-COMPOUND) are not exported from `dist/index.mjs` yet. It is empty since INTEGRATION
 * re-exported every flat name from the barrels (wave E1), and it must stay empty:
 *   - an entry whose flat names all exist fails the check ("remove it"), and so does an entry
 *     that is not an exported component, so the list only shrinks;
 *   - an entry that is exported but not a compound yet is tolerated;
 *   - `--final` (`prepublishOnly`, the final gate) ignores the list and fails while it is not
 *     empty, so no release ships with the bridge open.
 * A compound that is not listed must export every flat name. A flat name that is exported must
 * equal its dotted member, listed or not.
 */
export const PENDING_FLAT_EXPORTS = [];

const JS_FILE = /\.(mjs|cjs|js)$/;

// -------------------------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------------------------

/** Every file under `dir`, as `/`-separated paths relative to it. */
function listFiles(dir, prefix = '') {
  const files = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(dir, path));
    else files.push(path);
  }
  return files.sort();
}

function toPosix(path) {
  return path.split(sep).join('/');
}

/** Real path, case-folded on Windows (paths are case-insensitive there). */
function canonicalPath(path) {
  const real = realpathSync(path);
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

/** A script's file name without its extension, case-folded. */
function scriptName(path) {
  return basename(path)
    .replace(/\.[cm]?js$/i, '')
    .toLowerCase();
}

/**
 * How the module at `metaUrl` was loaded, given the script path Node was started with (`argv1`):
 *   - `main`: it is that script (compared by real path, so a symlink, junction or drive-letter
 *     case difference still matches);
 *   - `mismatch`: a script with this module's name that could not be matched to it;
 *   - `imported`: anything else (a test or another script imported the module).
 */
export function entryStatus(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return 'imported';
  const self = fileURLToPath(metaUrl);
  try {
    if (canonicalPath(self) === canonicalPath(resolve(argv1))) return 'main';
  } catch {
    // An unresolvable path is not this module; the name check below decides.
  }
  return scriptName(argv1) === scriptName(self) ? 'mismatch' : 'imported';
}

/** Whether the module at `metaUrl` is the script Node was started with (see entryStatus). */
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  return entryStatus(metaUrl, argv1) === 'main';
}

/**
 * The entry point of a gate script: runs `main` and sets the exit code to its
 * result when Node was started with the module at `metaUrl`. A script of the module's name that
 * cannot be matched to it never passes silently: it reports that nothing was checked and sets
 * exit code 1. Returns the exit code it set (undefined when the module was imported).
 */
export async function runScript(metaUrl, main, { argv1 = process.argv[1], io = console } = {}) {
  const status = entryStatus(metaUrl, argv1);
  if (status === 'imported') return undefined;
  if (status === 'main') {
    process.exitCode = await main();
  } else {
    io.error(
      `${scriptName(fileURLToPath(metaUrl))}: cannot confirm that ${argv1} is ` +
        `${fileURLToPath(metaUrl)}; nothing was checked`,
    );
    process.exitCode = 1;
  }
  return process.exitCode;
}

/** Index just past the comment or whitespace run at `i` (or `i` itself). */
function skipTrivia(code, i, { newlines = true } = {}) {
  for (;;) {
    const ch = code[i];
    if (ch === '\n' || ch === '\r') {
      if (!newlines) return i;
      i++;
    } else if (ch === ' ' || ch === '\t' || ch === '\uFEFF') i++;
    else if (code.startsWith('//', i)) {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end;
    } else if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else return i;
  }
}

/** Characters that continue an expression when they start the next line (no ASI before them). */
const CONTINUES_EXPRESSION = new Set([...'.[(+-*/%,?=<>&|^`']);

/**
 * The directive prologue of a script or module: the raw texts of the string-literal statements
 * at its start (`"use strict"`, `"use client"`), before the first other statement. Comments, a
 * hashbang and ASI-terminated directives are handled; template literals are never directives.
 */
export function directivePrologue(code) {
  const directives = [];
  let i = code.startsWith('#!') ? code.indexOf('\n') : 0;
  if (i === -1) return directives;
  for (;;) {
    i = skipTrivia(code, i);
    const quote = code[i];
    if (quote !== '"' && quote !== "'") return directives;
    let end = i + 1;
    while (end < code.length && code[end] !== quote && code[end] !== '\n') {
      end += code[end] === '\\' ? 2 : 1;
    }
    if (code[end] !== quote) return directives;
    const text = code.slice(i + 1, end);
    let next = skipTrivia(code, end + 1, { newlines: false });
    if (code[next] === ';') {
      next++;
    } else if (next < code.length && code[next] !== '\n' && code[next] !== '\r') {
      // Same line, no semicolon: the literal is part of a larger expression.
      if (code[next] !== '}') return directives;
    } else {
      const after = skipTrivia(code, next);
      if (
        after < code.length &&
        (CONTINUES_EXPRESSION.has(code[after]) || /^(in|instanceof)\b/.test(code.slice(after)))
      ) {
        return directives;
      }
    }
    directives.push(text);
    i = next;
  }
}

/**
 * Whether a dist file (path relative to `dist/`, `/`-separated) must start with `"use client"`:
 * component and hook modules, never `index.*` barrels. Mirrors `useClient` in vite.config.ts.
 */
export function expectsUseClient(path) {
  const segments = path.split('/');
  if (segments[0] !== 'components' && segments[0] !== 'hooks') return false;
  if (segments.includes('node_modules')) return false;
  return !/^index\.(mjs|cjs|js)$/.test(segments[segments.length - 1]);
}

/**
 * The module specifiers a built file imports (static, dynamic and `require`), also from
 * whitespace-minified code: a static `import`/`export … from` starts the file or follows a line
 * break, `;`, `}` or a comment (`import{a}from"x"`, `export*from"./y.mjs"`).
 */
export function importSpecifiers(code) {
  const specifiers = new Set();
  const statics =
    /(?:^|[;}\n]|\*\/)\s*(?:import|export)\s*(?:[^'"`;]*?\bfrom\s*)?(["'])([^"'\n]+)\1/g;
  const calls = /\b(?:import|require)\(\s*(["'`])([^"'`\n]+)\1\s*\)/g;
  for (const pattern of [statics, calls]) {
    for (const match of code.matchAll(pattern)) specifiers.add(match[2]);
  }
  return [...specifiers];
}

/** The package name of a bare specifier (`@scope/name/sub` → `@scope/name`). */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// -------------------------------------------------------------------------------------------
// Checks
// -------------------------------------------------------------------------------------------

/** `"use client"` on every component/hook module and on nothing else (repo-level#2). */
export function checkDirectives(dist) {
  const errors = [];
  let modules = 0;
  for (const path of listFiles(dist).filter((file) => JS_FILE.test(file))) {
    const expected = expectsUseClient(path);
    const has = directivePrologue(readFileSync(join(dist, path), 'utf8')).includes('use client');
    if (expected) modules++;
    if (expected && !has) errors.push(`${path} lacks "use client"`);
    if (!expected && has) {
      errors.push(
        `${path} must not start with "use client" (only component and hook modules do; ` +
          'barrels and src/lib stay importable from Server Components)',
      );
    }
  }
  if (modules === 0) {
    errors.push('no component or hook modules in dist (not built with preserveModules?)');
  }
  return errors;
}

/** A component name: PascalCase with a lower-case letter (not a `Z_INDEX` constant). */
const COMPONENT_NAME = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/;

/**
 * The components a rolled-up declaration file (`dist/index.d.ts`) exports without a JSDoc, in
 * declaration order (C-DOCS). A component is an exported value (`declare
 * const` or `declare function`) with a PascalCase name, exported directly or renamed by the roll-up
 * (`declare const Image_2` + `export { Image_2 as Image }`). Its JSDoc is the `/** … *\/` block
 * right before its first declaration (for overloads, the first signature).
 */
export function undocumentedComponents(dts) {
  const ts = require('typescript');
  const file = ts.createSourceFile(
    'index.d.ts',
    dts,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const isExported = (statement) =>
    (ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
  const hasJsDoc = (statement) =>
    (ts.getLeadingCommentRanges(dts, statement.getFullStart()) ?? []).some((range) =>
      /^\/\*\*\s/.test(dts.slice(range.pos, range.end)),
    );
  const valueNames = (statement) => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations
        .filter((declaration) => ts.isIdentifier(declaration.name))
        .map((declaration) => declaration.name.text);
    }
    return ts.isFunctionDeclaration(statement) && statement.name ? [statement.name.text] : [];
  };

  // The first declaration of every value, and the exported names (exported name → local name).
  const declarations = new Map();
  const exported = new Map();
  for (const statement of file.statements) {
    for (const name of valueNames(statement)) {
      if (!declarations.has(name)) declarations.set(name, statement);
      if (isExported(statement)) exported.set(name, name);
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        exported.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    }
  }
  return [...exported]
    .filter(([name, local]) => COMPONENT_NAME.test(name) && declarations.has(local))
    .map(([name, local]) => ({ name, statement: declarations.get(local) }))
    .filter(({ statement }) => !hasJsDoc(statement))
    .sort((a, b) => a.statement.pos - b.statement.pos)
    .map(({ name }) => name);
}

/**
 * `index.d.ts` and its `index.d.cts` copy for the `require` condition (repo-level#5); every
 * component the declarations export has a JSDoc (C-DOCS).
 */
export function checkDeclarations(dist) {
  const errors = [];
  const dts = join(dist, 'index.d.ts');
  const dcts = join(dist, 'index.d.cts');
  const esm = existsSync(dts) ? readFileSync(dts, 'utf8') : undefined;
  const cjs = existsSync(dcts) ? readFileSync(dcts, 'utf8') : undefined;
  if (esm === undefined) errors.push('index.d.ts is missing');
  else if (esm.trim() === '') errors.push('index.d.ts is empty');
  if (cjs === undefined) {
    errors.push('index.d.cts is missing (CommonJS consumers would get ESM-typed declarations)');
  } else if (esm !== undefined && cjs !== esm) {
    errors.push('index.d.cts differs from index.d.ts (it must be a copy of the rolled-up file)');
  }
  for (const name of esm ? undocumentedComponents(esm) : []) {
    errors.push(
      `index.d.ts: the exported component ${name} has no JSDoc (document it on its export, C-DOCS)`,
    );
  }
  return errors;
}

/**
 * `dist/lib/dev.mjs` and `dist/lib/dev.cjs` keep the literal `process.env.NODE_ENV` expression:
 * the consumer's bundler replaces it, so development warnings follow the consumer's
 * build mode. A `define` in vite.config.ts would inline the library's own mode instead.
 */
export function checkDevEnvironment(dist) {
  const errors = [];
  for (const path of ['lib/dev.mjs', 'lib/dev.cjs']) {
    const file = join(dist, path);
    if (!existsSync(file)) errors.push(`${path} is missing`);
    else if (!readFileSync(file, 'utf8').includes('process.env.NODE_ENV')) {
      errors.push(
        `${path} does not read process.env.NODE_ENV: the build inlined the mode (a \`define\` in ` +
          "vite.config.ts?), so the consumer's bundler can no longer choose development or production",
      );
    }
  }
  return errors;
}

/**
 * Every import of the built files: bare specifiers are declared dependencies or peer
 * dependencies (or subpaths of one), relative ones resolve inside `dist/`; no Node.js builtins
 * and no bundled `node_modules` code (repo-level#4).
 */
export function checkImports(dist, pkg) {
  const errors = [];
  const declared = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
  const files = listFiles(dist);
  for (const path of files) {
    if (path.split('/').includes('node_modules')) {
      errors.push(`bundled dependency in dist: ${path} (dependencies must stay external)`);
    }
  }
  const distRoot = resolve(dist);
  for (const path of files.filter((file) => JS_FILE.test(file))) {
    if (path.split('/').includes('node_modules')) continue;
    const code = readFileSync(join(dist, path), 'utf8');
    for (const specifier of importSpecifiers(code)) {
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(join(distRoot, path)), specifier);
        const inside = !relative(distRoot, target).startsWith('..');
        if (!inside || !existsSync(target)) {
          errors.push(`${path} imports "${specifier}", which does not resolve inside dist`);
        }
      } else if (specifier.startsWith('node:') || isBuiltin(specifier)) {
        errors.push(`${path} imports the Node.js builtin "${specifier}"`);
      } else if (/^([a-zA-Z]:|\/|file:)/.test(specifier)) {
        errors.push(`${path} imports the absolute path "${specifier}"`);
      } else if (!declared.has(packageName(specifier))) {
        errors.push(`${path} imports "${specifier}", which is not a dependency or peer dependency`);
      }
    }
  }
  return errors;
}

/**
 * `path` without the Windows namespace prefix (`\\?\C:\…`, `\\?\UNC\server\…`) that
 * `mkdirSync(…, { recursive: true })` returns on Windows, so it compares with plain paths.
 */
function withoutNamespace(path) {
  return resolve(path.replace(/^\\\\\?\\UNC\\/, '\\\\').replace(/^\\\\\?\\/, ''));
}

/**
 * Error codes of a `mkdir`/`mkdtemp` that raced a concurrent run removing the shared parent:
 * ENOENT once it is gone, EPERM while Windows still has it delete-pending.
 */
const WORK_DIR_RACE_CODES = new Set(['ENOENT', 'EPERM']);
const WORK_DIR_ATTEMPTS = 10;

/** Blocks the (synchronous) caller for `ms` milliseconds. */
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Creates a fresh work directory `<parent>/<prefix>XXXXXX`, creating `parent` and any missing
 * ancestor first. Returns `{ work, created }`, where `created` is the outermost directory this
 * call created (undefined when `parent` existed), for {@link removeWorkDir}.
 *
 * Concurrent runs share `parent`, and each removes it once empty, so either step can race a
 * removal (ENOENT, or EPERM while Windows has `parent` delete-pending): both steps are retried
 * together, with a short back-off, before the error is thrown.
 */
export function createWorkDir(parent, prefix) {
  let created;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const made = mkdirSync(parent, { recursive: true });
      const first = made === undefined ? undefined : withoutNamespace(made);
      if (first !== undefined && (created === undefined || first.length < created.length)) {
        created = first;
      }
      return { work: mkdtempSync(join(parent, prefix)), created };
    } catch (error) {
      if (!WORK_DIR_RACE_CODES.has(error?.code) || attempt === WORK_DIR_ATTEMPTS) throw error;
      pause(attempt * 2);
    }
  }
}

/**
 * Removes a work directory made by {@link createWorkDir}, then — so a run leaves no empty
 * directory behind — its parent once empty (also when an earlier run left it), and each
 * ancestor up to the `created` one while empty. A directory that still holds something, such as
 * the work directory of a concurrent run, is kept. Removing the work directory is retried on a
 * transient Windows lock (EBUSY/EPERM), so cleanup in a `finally` does not mask a result.
 */
export function removeWorkDir({ work, created }) {
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  const stop = resolve(created ?? dirname(work));
  let dir = dirname(resolve(work));
  for (;;) {
    try {
      rmdirSync(dir);
    } catch {
      return; // not empty, or already removed by a concurrent run
    }
    const up = dirname(dir);
    if (dir === stop || up === dir || !`${up}${sep}`.startsWith(`${stop}${sep}`)) return;
    dir = up;
  }
}

/** Whether a built file is CommonJS (`.cjs`, or `.js` in a package without `type: module`). */
function isCommonJs(path, packageType) {
  return path.endsWith('.cjs') || (path.endsWith('.js') && packageType !== 'module');
}

/**
 * The source of a module standing in for a `"use client"` module on the server, as an RSC
 * bundler substitutes it: every export (`names`) is a client reference — a function that throws
 * when called and whose other properties can be neither read ("Cannot access Card.Header on the
 * server") nor assigned, like React's own client references — so evaluating the server module
 * graph never runs client code. As in React, reading `then` throws too ("Cannot await or return
 * from a thenable"), so server code that awaits a client reference or passes it to
 * `Promise.resolve` fails here as it does in an RSC bundler. `format` is `esm` or `cjs`.
 */
export function clientReferenceStub(path, names, format) {
  const helper = `const clientReference = (name) => {
  const target = function () {
    throw new Error('Attempted to call ' + name + '() from the server: it is exported by the "use client" module ' + ${JSON.stringify(path)});
  };
  Object.defineProperties(target, {
    $$typeof: { value: Symbol.for('react.client.reference') },
    $$id: { value: ${JSON.stringify(path)} + '#' + name },
    $$async: { value: false },
    name: { value: name },
  });
  const readable = new Set(['$$typeof', '$$id', '$$async', 'name']);
  const undefinedKeys = new Set(['displayName', 'defaultProps', '_debugInfo', 'toJSON']);
  const refuse = () => {
    throw new Error('Cannot assign to a client module from a server module.');
  };
  return new Proxy(target, {
    get(target, key) {
      if (typeof key === 'symbol' || readable.has(key)) return target[key];
      if (undefinedKeys.has(key)) return undefined;
      if (key === 'then') {
        throw new Error(
          'Cannot await or return from a thenable. You cannot await a client module from a ' +
            'server component.',
        );
      }
      throw new Error(
        'Cannot access ' + name + '.' + key + ' on the server. You cannot dot into a client ' +
          'module from a server component. You can only pass the imported name through.',
      );
    },
    set: refuse,
    defineProperty: refuse,
    deleteProperty: refuse,
  });
};
`;
  if (format === 'cjs') {
    const assignments = names
      .filter((name) => name !== '__esModule')
      .map(
        (name) => `exports[${JSON.stringify(name)}] = clientReference(${JSON.stringify(name)});`,
      );
    return [
      "'use strict';",
      helper,
      "Object.defineProperty(exports, '__esModule', { value: true });",
      ...assignments,
      '',
    ].join('\n');
  }
  const declarations = names.map(
    (name, index) => `const reference${index} = clientReference(${JSON.stringify(name)});`,
  );
  const specifiers = names.map((name, index) => `reference${index} as ${JSON.stringify(name)}`);
  return [
    helper,
    ...declarations,
    names.length > 0 ? `export { ${specifiers.join(', ')} };` : 'export {};',
    '',
  ].join('\n');
}

/**
 * The script run under `node --conditions=react-server` that loads each of `files` (paths
 * relative to `dir`) and prints `{ [path]: { phase, message } }` for the failures: `load` when
 * the module does not evaluate, `check` when it loads but `lib/cn.*` does not work or `index.*`
 * does not export the server-side `cn`.
 */
function serverProbeSource(dir, files, format) {
  const load =
    format === 'cjs'
      ? `const load = async (path) => require(require('node:path').join(${JSON.stringify(dir)}, path));`
      : `const base = ${JSON.stringify(pathToFileURL(`${dir}/`).href)};\n` +
        'const load = (path) => import(new URL(path, base).href);';
  return `${load}
const files = ${JSON.stringify(files)};
const check = (path, m) => {
  if (/^lib\\/cn\\.[cm]?js$/.test(path)) {
    if (typeof m.cn !== 'function') throw new Error('cn is not exported');
    const out = m.cn('a', false, 'b');
    if (out !== 'a b') throw new Error("cn('a', false, 'b') returned " + JSON.stringify(out));
  }
  if (/^index\\.[cm]?js$/.test(path)) {
    if (typeof m.cn !== 'function') throw new Error('cn is not exported');
    if (m.cn.$$typeof === Symbol.for('react.client.reference')) {
      throw new Error('cn is a client reference (re-exported from a "use client" module)');
    }
  }
};
const message = (error) => String((error && error.message) || error).split('\\n')[0];
(async () => {
  const failures = {};
  for (const path of files) {
    let m;
    try {
      m = await load(path);
    } catch (error) {
      failures[path] = { phase: 'load', message: message(error) };
      continue;
    }
    try {
      check(path, m);
    } catch (error) {
      failures[path] = { phase: 'check', message: message(error) };
    }
  }
  process.stdout.write('\\n' + JSON.stringify(failures) + '\\n');
})();
`;
}

/** Runs a probe script with `node --conditions=react-server`; returns its failures. */
function runServerProbe(script) {
  const result = spawnSync(process.execPath, ['--conditions=react-server', script], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  const last = (result.stdout ?? '').trim().split('\n').pop() ?? '';
  try {
    if (result.status === 0) return JSON.parse(last);
  } catch {
    // Reported below.
  }
  const output = `${result.stderr}${result.stdout}`.trim().split('\n');
  const reason = output.find((line) => /Error|error:/.test(line)) ?? output[0] ?? '';
  throw new Error(`the probe exited with ${result.status}: ${reason.trim()}`);
}

/** Dist-relative paths of the relative imports of the dist file `path`. */
function relativeImports(dist, path) {
  const file = join(dist, path);
  return importSpecifiers(readFileSync(file, 'utf8'))
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => toPosix(relative(dist, resolve(dirname(file), specifier))));
}

/**
 * The package loads in a React Server Component (repo-level#2). An RSC bundler replaces every
 * `"use client"` module with client references and evaluates the rest on the server — the
 * `index.*` entries, `dist/lib/**` and the bundler runtime. This check does the same with a copy
 * of `dist` (export names of the client modules read by loading them normally, the copy placed
 * next to `dist` so dependencies resolve alike) and loads every other module, both formats, under
 * `node --conditions=react-server`. Reported: a module that does not evaluate (a client-only
 * React API at module scope, dotting into a client reference) — only the root cause, not the
 * modules that fail because they import it; a `lib/cn.*` that does not work; an `index.*` whose
 * `cn` is missing or a client reference.
 */
export async function checkServerImport(dist) {
  const errors = [];
  const distRoot = resolve(dist);
  for (const path of ['lib/cn.mjs', 'lib/cn.cjs']) {
    if (!existsSync(join(distRoot, path))) errors.push(`${path} is missing`);
  }
  const manifest = join(distRoot, '..', 'package.json');
  const packageType = existsSync(manifest) ? readJson(manifest).type : undefined;
  const files = listFiles(distRoot).filter(
    (path) => JS_FILE.test(path) && !path.split('/').includes('node_modules'),
  );
  const clientFiles = new Set(
    files.filter((path) =>
      directivePrologue(readFileSync(join(distRoot, path), 'utf8')).includes('use client'),
    ),
  );

  // Export names of the client modules, read under the default conditions. A client module that
  // does not load at all is broken for every consumer (checkImports and the entry-loading checks
  // report it); it is left as is, and a server module importing it is not blamed for it.
  const stubs = new Map();
  const unloadable = new Set();
  for (const path of clientFiles) {
    const file = join(distRoot, path);
    const format = isCommonJs(path, packageType) ? 'cjs' : 'esm';
    try {
      const names = Object.keys(
        format === 'cjs' ? require(file) : await import(pathToFileURL(file).href),
      );
      stubs.set(path, clientReferenceStub(path, names, format));
    } catch {
      unloadable.add(path);
    }
  }

  // Next to dist, so the dependencies resolve from the copy as they do from dist.
  const run = createWorkDir(
    join(dirname(distRoot), 'node_modules', '.cache', 'wave-verify-dist'),
    'rsc-',
  );
  const { work } = run;
  const failures = {};
  try {
    const copy = join(work, 'dist');
    cpSync(distRoot, copy, { recursive: true, filter: (source) => !source.endsWith('.map') });
    writeFileSync(join(work, 'package.json'), JSON.stringify({ type: packageType ?? 'commonjs' }));
    for (const [path, source] of stubs) writeFileSync(join(copy, path), source);

    const serverFiles = files.filter((path) => !clientFiles.has(path));
    for (const format of ['esm', 'cjs']) {
      const selected = serverFiles.filter(
        (path) => isCommonJs(path, packageType) === (format === 'cjs'),
      );
      if (selected.length === 0) continue;
      const probe = join(work, format === 'cjs' ? 'probe.cjs' : 'probe.mjs');
      writeFileSync(probe, serverProbeSource(toPosix(copy), selected, format));
      try {
        Object.assign(failures, runServerProbe(probe));
      } catch (error) {
        errors.push(`react-server check (${format}) failed: ${error.message}`);
      }
    }
  } finally {
    removeWorkDir(run);
  }

  for (const [path, { phase, message }] of Object.entries(failures).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (phase === 'load') {
      // A module that fails only because a module it imports fails (or is missing, or is an
      // unloadable client module) is not the cause; that module is reported instead (a missing
      // one by checkImports).
      const dependencies = relativeImports(distRoot, path);
      if (
        dependencies.some(
          (dep) => dep in failures || unloadable.has(dep) || !existsSync(join(distRoot, dep)),
        )
      ) {
        continue;
      }
      errors.push(
        `${path} does not load under node --conditions=react-server, so a Server Component ` +
          `importing the package fails: ${message}`,
      );
    } else {
      errors.push(`${path} under node --conditions=react-server: ${message}`);
    }
  }
  return errors;
}

/** A React component value: a function, or a memo/forwardRef/lazy/context object. */
function isComponentLike(value) {
  if (typeof value === 'function') return true;
  return value !== null && typeof value === 'object' && typeof value.$$typeof === 'symbol';
}

/**
 * The flat sub-component names of the module namespace `mod` (C-COMPOUND): for every export with
 * capitalised component members (`Card.Header`), `CardHeader` must be exported and be the same
 * component. Compounds on `pendingFlatExports` may lack flat names (returned as `pending`), and
 * listed components that are no compound yet are returned as `planned`; a listed compound that
 * is complete, or a listed name that is no exported component, is an error, so the list only
 * shrinks. `final` closes the bridge: the list is ignored and must be empty.
 */
export function checkFlatExports(
  mod,
  { pendingFlatExports = PENDING_FLAT_EXPORTS, final = false } = {},
) {
  const errors = [];
  const pending = [];
  const planned = [];
  if (final && pendingFlatExports.length > 0) {
    errors.push(
      `PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs still lists ` +
        `${[...pendingFlatExports].sort().join(', ')}: the flat-name bridge must be empty ` +
        'before publishing (export the flat names from the barrels, then empty the list)',
    );
  }
  const pendingSet = new Set(final ? [] : pendingFlatExports);
  const compounds = new Set();
  for (const [name, value] of Object.entries(mod)) {
    if (!/^[A-Z]/.test(name) || !isComponentLike(value)) continue;
    const members = Object.keys(value).filter(
      (key) => /^[A-Z]/.test(key) && isComponentLike(value[key]),
    );
    if (members.length === 0) continue;
    compounds.add(name);
    const missing = [];
    for (const member of members) {
      const flat = `${name}${member}`;
      if (!(flat in mod)) missing.push(flat);
      else if (mod[flat] !== value[member]) errors.push(`${flat} !== ${name}.${member}`);
    }
    if (missing.length === 0) {
      if (pendingSet.has(name)) {
        errors.push(
          `remove "${name}" from PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs: ` +
            'all its flat names are exported',
        );
      }
    } else if (pendingSet.has(name)) {
      pending.push(...missing);
    } else {
      for (const flat of missing) {
        errors.push(
          `${flat} is not exported from dist/index.mjs (flat name of ` +
            `${name}.${flat.slice(name.length)}, needed by Server Components)`,
        );
      }
    }
  }
  for (const name of pendingSet) {
    if (compounds.has(name)) continue;
    if (/^[A-Z]/.test(name) && Object.hasOwn(mod, name) && isComponentLike(mod[name])) {
      planned.push(name);
    } else {
      errors.push(
        `remove "${name}" from PENDING_FLAT_EXPORTS in scripts/verify-dist.mjs: ` +
          'it is not an exported component',
      );
    }
  }
  return { errors: errors.sort(), pending: pending.sort(), planned: planned.sort() };
}

/** The export names of a namespace or CommonJS exports object. */
function exportNames(mod) {
  return Object.keys(mod).filter((name) => name !== 'default' && name !== '__esModule');
}

/** `dist/index.cjs` exports exactly the names of `dist/index.mjs`. */
export async function checkCjsParity(dist) {
  const esm = exportNames(await import(pathToFileURL(resolve(dist, 'index.mjs')).href));
  const cjs = exportNames(require(resolve(dist, 'index.cjs')));
  const errors = [];
  const onlyEsm = esm.filter((name) => !cjs.includes(name));
  const onlyCjs = cjs.filter((name) => !esm.includes(name));
  if (onlyEsm.length > 0) errors.push(`index.cjs lacks ${onlyEsm.sort().join(', ')}`);
  if (onlyCjs.length > 0) errors.push(`index.mjs lacks ${onlyCjs.sort().join(', ')}`);
  return errors;
}

/** Relative paths (in `dist/`) of the modules `path` statically imports, transitively. */
function importClosure(dist, path) {
  const closure = new Set();
  const queue = [path];
  while (queue.length > 0) {
    const current = queue.pop();
    if (closure.has(current)) continue;
    closure.add(current);
    const file = join(dist, current);
    if (!existsSync(file)) continue;
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      queue.push(toPosix(relative(dist, resolve(dirname(file), specifier))));
    }
  }
  return closure;
}

/** Folds a path for comparison (case-insensitive on Windows). */
function fold(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

/**
 * Tree-shaking probe (repo-level#3): bundles an entry that imports only `keep` from
 * `dist/index.mjs` with Vite's `build()` API (no write, no minification, bare imports external)
 * and asserts that the bundle holds `keep`'s module, only it and its static imports, and no code
 * of `drop` (its module or its `displayName`).
 *
 * The bundler reports module ids as real paths, so the probe imports and matches them through
 * the real path of `dist`: a dist reached through a symlink or a junction (a linked checkout or
 * `node_modules`) is checked module by module, not silently passed with no module matched.
 */
export async function probeTreeShaking(dist, { keep = 'Button', drop = 'Dialog' } = {}) {
  const errors = [];
  const distRoot = realpathSync(resolve(dist));
  const components = listFiles(distRoot).filter((path) => path.startsWith('components/'));
  const keepModules = components.filter((path) => path.endsWith(`/${keep}.mjs`));
  const dropModules = components.filter((path) => path.endsWith(`/${drop}.mjs`));
  if (keepModules.length === 0) {
    errors.push(`no dist module for ${keep} (components/**/${keep}.mjs): dist is not per module`);
  }

  const { build } = await import('vite');
  const probeDir = mkdtempSync(join(tmpdir(), 'wave-treeshake-'));
  let chunks;
  try {
    const entry = join(probeDir, 'probe.mjs');
    const index = toPosix(join(distRoot, 'index.mjs'));
    writeFileSync(
      entry,
      `import { ${keep} } from ${JSON.stringify(index)};\nexport { ${keep} };\n`,
    );
    const result = await build({
      configFile: false,
      root: probeDir,
      logLevel: 'silent',
      publicDir: false,
      build: {
        write: false,
        minify: false,
        emptyOutDir: false,
        copyPublicDir: false,
        rolldownOptions: {
          input: entry,
          preserveEntrySignatures: 'exports-only',
          external: (id) => /^[^./\0]/.test(id) && !/^[a-zA-Z]:/.test(id),
          output: { format: 'es' },
          onLog: () => {},
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    chunks = outputs.flatMap((output) => output.output).filter((item) => item.type === 'chunk');
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }

  const code = chunks.map((chunk) => chunk.code).join('\n');
  // Bundled dist modules, as paths relative to dist (original case).
  const byFolded = new Map(listFiles(distRoot).map((path) => [fold(path), path]));
  const distPrefix = `${fold(toPosix(distRoot))}/`;
  const included = new Set();
  for (const id of chunks.flatMap((chunk) => chunk.moduleIds)) {
    const folded = fold(toPosix(id));
    if (!folded.startsWith(distPrefix)) continue;
    const path = folded.slice(distPrefix.length);
    included.add(byFolded.get(path) ?? path);
  }
  const allowed = new Set();
  for (const path of keepModules) {
    for (const module of importClosure(distRoot, path)) allowed.add(fold(module));
  }
  const dropped = new Set(dropModules.map(fold));
  for (const path of keepModules) {
    if (!included.has(path)) {
      errors.push(`${path} is not in the bundle of an import of only ${keep}`);
    }
  }
  for (const path of [...included].sort()) {
    if (dropped.has(fold(path))) {
      errors.push(
        `${path} is in the bundle of an import of only ${keep} (${drop} must be dropped)`,
      );
    } else if (!allowed.has(fold(path))) {
      errors.push(`${path} is in the bundle of an import of only ${keep} (not one of its imports)`);
    }
  }
  const displayName = (name) => new RegExp(`\\.displayName\\s*=\\s*(["'\`])${name}\\1`);
  if (displayName(drop).test(code)) {
    errors.push(
      `${drop} code (displayName "${drop}") is in the bundle of an import of only ${keep}`,
    );
  }
  if (keepModules.length > 0 && !displayName(keep).test(code)) {
    errors.push(`the probe bundle lacks ${keep} (displayName "${keep}")`);
  }
  return errors;
}

/**
 * Runs every check on `dist` (its parent directory holds the package.json). Returns the errors,
 * the flat names still pending and the listed components that are no compound yet (see
 * {@link PENDING_FLAT_EXPORTS}); `final` closes the pending bridge.
 */
export async function verifyDist(
  dist,
  { pendingFlatExports = PENDING_FLAT_EXPORTS, final = false } = {},
) {
  const distRoot = resolve(dist);
  if (!existsSync(distRoot) || !statSync(distRoot).isDirectory()) {
    return { errors: [`${dist} does not exist (run vite build first)`], pending: [], planned: [] };
  }
  const pkg = readJson(join(distRoot, '..', 'package.json'));
  const errors = [
    ...checkDeclarations(distRoot),
    ...checkDevEnvironment(distRoot),
    ...checkDirectives(distRoot),
    ...checkImports(distRoot, pkg),
  ];
  try {
    errors.push(...(await checkServerImport(distRoot)));
  } catch (error) {
    errors.push(`react-server check failed: ${error.message}`);
  }
  let pending = [];
  let planned = [];
  try {
    const mod = await import(pathToFileURL(join(distRoot, 'index.mjs')).href);
    const flat = checkFlatExports(mod, { pendingFlatExports, final });
    errors.push(...flat.errors);
    pending = flat.pending;
    planned = flat.planned;
    errors.push(...(await checkCjsParity(distRoot)));
  } catch (error) {
    errors.push(`index.mjs/index.cjs do not load in Node.js: ${error.message}`);
  }
  try {
    errors.push(...(await probeTreeShaking(distRoot)));
  } catch (error) {
    errors.push(`tree-shaking probe failed: ${error.message}`);
  }
  return { errors, pending, planned };
}

function parseArgs(argv) {
  const options = {
    dist: join(root, 'dist'),
    pendingFlatExports: PENDING_FLAT_EXPORTS,
    final: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dist') options.dist = resolve(argv[++i]);
    else if (argv[i] === '--no-pending') options.pendingFlatExports = [];
    else if (argv[i] === '--final') options.final = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return options;
}

/** CLI entry; returns the exit code. `io` receives the report (default: the console). */
export async function main(argv = process.argv.slice(2), io = console) {
  const { dist, pendingFlatExports, final } = parseArgs(argv);
  const { errors, pending, planned } = await verifyDist(dist, { pendingFlatExports, final });
  const where = toPosix(relative(process.cwd(), dist) || dist);
  if (errors.length > 0) {
    io.error(`verify-dist: ${errors.length} problem(s) in ${where}:`);
    for (const error of errors) io.error(`  - ${error}`);
    return 1;
  }
  if (pending.length > 0 || planned.length > 0) {
    const parts = [];
    if (pending.length > 0) parts.push(`flat names ${pending.join(', ')}`);
    if (planned.length > 0) parts.push(`not compounds yet: ${planned.join(', ')}`);
    io.log(
      `verify-dist: PENDING_FLAT_EXPORTS bridge open (C-COMPOUND; ${parts.join('; ')}). ` +
        '`verify-dist --final` (prepublishOnly, the final gate) fails until it is empty.',
    );
  }
  io.log(`verify-dist: ${where} OK${final ? ' (final)' : ''}`);
  return 0;
}

await runScript(import.meta.url, main);
