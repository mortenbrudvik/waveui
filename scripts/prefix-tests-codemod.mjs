#!/usr/bin/env node
/**
 * The test migration of the utilities flip (Phase 14 spec R6, "Transition"; Task 21, for Task 22):
 * prefixes WaveUI's own classes in the tests (`toHaveClass('bg-primary')` becomes
 * `toHaveClass('wave:bg-primary')`) and leaves the classes a test passes in as a consumer would
 * (`<Button className="p-2">`) unprefixed. Repo-internal: never packed.
 *
 * It reads the test files of the given paths (files under `__tests__`, `*.test.ts(x)`,
 * `test-utils*` and `*Harness.ts(x)`) with the TypeScript compiler and the tracer of
 * scripts/prefix-codemod.mjs, and decides each literal that holds a utility word by its context:
 *
 *   Wave's own class (prefixed)
 *     the arguments of `toHaveClass` (spread included) and of `classList.contains`, the second
 *     argument of `toHaveAttribute('class', …)`, `conflictingClass.overrides`, and the expected
 *     values of `toBe`/`toEqual`/`toStrictEqual`/`toContain`/`toContainEqual`/`toMatch`/
 *     `toMatchObject` (through `expect.arrayContaining`/`stringContaining`) when the `expect()`
 *     subject reads classes (its text names a class, a class list, `tokens(…)` or a `cn`/`wcn`
 *     merge); with any other subject only a literal of two or more words that are all utilities;
 *     the literal arguments of a `cn`/`wcn` call that come before its first other argument (a
 *     merge a test models: the component's own classes; a `className` identifier does not count),
 *     and the base class argument of `renderSlot`/`resolveSlot` (third) and `withPartClass`
 *     (second), where a test of the slot helpers plays the component;
 *   a consumer class (never prefixed)
 *     a JSX attribute or object property named `className` or `*ClassName`, the arguments of
 *     `classList.add/remove/toggle/replace` and `setAttribute('class', …)`, and the literal
 *     arguments of a `cn`/`wcn` call after its last other argument (a consumer override). A word
 *     a test passes in this way is kept unprefixed in the assertions of that test (and of the
 *     `describe` blocks and the file that enclose the context);
 *   a selector (`querySelector`, `querySelectorAll`, `closest`, `matches`)
 *     a class selector `.x` of a utility becomes `.wave\:x`;
 *   markup (a literal holding `class="…"`, a `renderToString` pin)
 *     the utility words of its class attributes are prefixed.
 *
 * Literals reach these contexts through the tracer (identifiers, maps, arrays, spreads, `join`,
 * `split`, conditionals) and through the places a test hands values on: the rows of `it.each`/
 * `describe.each` tables to the callback's parameters (by position, or by name for object rows),
 * `for…of` variables and the callbacks of `forEach`/`map`/`filter`/`some`/`every`/`flatMap` to
 * the elements they iterate (`Object.values`/`Object.entries` included), and a helper function's
 * parameters to the arguments of its calls. A class token built with a substitution
 * (`${HOVER_GATE}bg-primary-hover`) is prefixed at its start when every substitution resolves to
 * a constant. Test titles, roles and other strings are never touched. In test files that import
 * the public `cn` from `lib/cn` to model a component's merge, `cn` becomes `wcn` (the merge of the
 * components), except in the files that test the public `cn` itself (`DEFAULT_EXCLUDES`, which
 * are not migrated at all).
 *
 * Idempotent: a word that carries the prefix, a selector that does, a renamed import are left
 * alone. A token that starts with a substitution holding a whole class (`${MAP[key]}`) never gets
 * a prefix of its own: the literals behind it are prefixed where they are written. `--report`
 * lists every literal it could not classify, with its place, for a manual decision: a classy
 * literal no context reached (`untraced`), one whose contexts disagree (`ambiguous`), a merge
 * argument between two other arguments (`merge`), a matcher value that is a single word with an
 * unknown subject (`subject`), a token with a substitution that does not resolve (`glued`), an
 * escape in a class literal (`escaped`), a regular expression that names a utility (`regex`), a
 * class name in an expected object (`expected-object`), and every negative assertion that a word
 * passed in as a consumer class keeps unprefixed (`kept-negative`, with the assertion and the
 * pass-in site in `sites`): the decision is by word and scope, not by element, and a negative
 * assertion about Wave's own class would pass for nothing after the flip. A classy literal holds
 * a utility word with a dash, colon, bracket or slash, or two or more words all utilities.
 *
 * The run order of the flip: `scripts/prefix-codemod.mjs --write` over src first, then this tool,
 * then the manual pass over the report. `--write` refuses to run while src/lib/styles.ts holds no
 * prefixed class (`--allow-unprefixed-src` overrides it); a dry run or `--check` warns.
 *
 * Usage:
 *   node scripts/prefix-tests-codemod.mjs [--root <project>] [--prefix wave] [--theme <css>]...
 *        [--variants <css>] [--exclude <file>]... [--write [--allow-unprefixed-src] | --check]
 *        [--report <file.json>] <files or dirs>...
 *
 *   (no mode)   a dry run: counts what `--write` would change
 *   --write     rewrites the files (then `prettier --write`)
 *   --check     exits 1 when `--write` would change a file
 *
 * The functions are exported for scripts/__tests__/prefix-tests-codemod.test.mjs; importing the
 * module runs nothing. It starts through verify-dist's `runScript`.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  applyEdits,
  calleeName,
  CHAIN_METHODS,
  createProgram,
  createTracer,
  loadTypeScript,
  loadUtilityTest,
  MARKER,
  posix,
  propertyNameText,
  renameCn,
  returnExpressions,
  sourceFileOf,
  stripped,
} from './prefix-codemod.mjs';
import { runScript } from './verify-dist.mjs';

/**
 * Test files the migration never touches: the tests of the public `cn` (their classes are an
 * app's), the conventions gate's tests (their literals are source texts the gate reads, which it
 * reads alike prefixed or not) and the token and build-css tests (CSS fixtures and compiles, which
 * change with build-css's prefixed assertions at the flip, by hand).
 */
export const DEFAULT_EXCLUDES = [
  'src/lib/__tests__/cn.test.ts',
  'src/__tests__/classNames.test.ts',
  'src/__tests__/conventions.test.ts',
  'src/styles/__tests__/tokens.test.ts',
];

const TEST_CALLS = new Set(['it', 'test', 'bench']);
const SUITE_CALLS = new Set(['describe', 'suite']);
const VALUE_MATCHERS = new Set([
  'toBe',
  'toEqual',
  'toStrictEqual',
  'toContain',
  'toContainEqual',
  'toMatch',
  'toMatchObject',
]);
const EXPECTATION_CALLS = new Set([
  ...VALUE_MATCHERS,
  'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
  'objectContaining',
]);
const PASS_THROUGH = new Set(['arrayContaining', 'stringContaining']);
const SELECTOR_CALLS = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);
const MERGE_CALLS = new Set(['cn', 'wcn', 'clsx', 'cx', 'twMerge']);
/** The slot helpers and the position of their base class argument (as the src codemod reads). */
const SLOT_BASE_ARGUMENT = new Map([
  ['renderSlot', 2],
  ['resolveSlot', 2],
  ['withPartClass', 1],
]);
const ITERATION_METHODS = new Set(['forEach', 'map', 'filter', 'some', 'every', 'flatMap', 'find']);
/** Array methods whose result holds the receiver's elements (the tracer follows them too). */
const ITERATION_CHAINS = new Set([
  'filter',
  'slice',
  'concat',
  'reverse',
  'sort',
  'toSorted',
  'toReversed',
  'flat',
]);
/** A stable class of the registry (`wave-button`, `wave-tag__media`): kept in a class list. */
const STABLE_CLASS = /^wave-[a-z0-9-]+(?:__[a-z0-9-]+)?$/;
const CONSUMER_NAME = /^(?:className|[a-zA-Z]+ClassName)$/;
/**
 * A name that holds classes: `cls`, `classes`, `tokens`, a `*Classes`/`*ClassName`/`*ClassList`
 * map or string (`buttonAppearanceClasses`, `menuSurfaceClasses`), never the stable-class registry
 * (`*ClassNames`, whose values are no utilities either way).
 */
const CLASS_HOLDER =
  /^(?:cls|classes|classList|className|tokens)$|(?:Classes|ClassName|ClassList)$/;
/** A function that returns classes: `classesOf`, `tokens`, `buttonClassName`, `tagRootClasses`. */
const CLASS_FUNCTION = /^(?:class\w*|tokens|\w+Class\w*)$/;
/** Methods whose result holds the receiver's classes (`[...el.classList].sort()`). */
const CLASS_WRAPPERS = new Set([
  'sort',
  'toSorted',
  'split',
  'join',
  'trim',
  'filter',
  'slice',
  'find',
  'findLast',
  'at',
]);

/** Whether `path` (forward slashes) is a test file or a test helper. */
export function isTestFile(path) {
  return (
    /\/__tests__\//.test(path) ||
    /\.test\.tsx?$/.test(path) ||
    /(?:^|\/)test-utils[^/]*\.tsx?$/.test(path) ||
    /[hH]arness\.tsx?$/.test(path)
  );
}

/** The test files of `paths` (files or directories under `root`), absolute, sorted. */
export function listTestFiles(root, paths) {
  const files = [];
  const visit = (path) => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) {
        if (name !== 'node_modules') visit(join(path, name));
      }
    } else if (/\.tsx?$/.test(path) && !/\.d\.ts$/.test(path) && isTestFile(posix(path))) {
      files.push(posix(resolve(path)));
    }
  };
  for (const path of paths) visit(resolve(root, path));
  return [...new Set(files)].sort();
}

export function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    prefix: 'wave',
    themes: [],
    variants: null,
    excludes: [...DEFAULT_EXCLUDES],
    write: false,
    check: false,
    report: null,
    allowUnprefixedSrc: false,
    paths: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') options.root = resolve(argv[++i]);
    else if (arg === '--prefix') options.prefix = argv[++i];
    else if (arg === '--theme') options.themes.push(resolve(argv[++i]));
    else if (arg === '--variants') options.variants = resolve(argv[++i]);
    else if (arg === '--exclude') options.excludes.push(posix(argv[++i]));
    else if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--report') options.report = resolve(argv[++i]);
    else if (arg === '--allow-unprefixed-src') options.allowUnprefixedSrc = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else options.paths.push(arg);
  }
  if (options.write && options.check) throw new Error('--write and --check exclude each other');
  if (!options.prefix || !/^[a-z][a-z0-9]*$/.test(options.prefix)) {
    throw new Error(`--prefix must be a Tailwind prefix, not "${options.prefix}"`);
  }
  if (options.paths.length === 0) throw new Error('no files or directories given');
  return options;
}

// -------------------------------------------------------------------------------------------
// Literal text: tokens with their source positions
// -------------------------------------------------------------------------------------------

/**
 * The parts of a string-like literal: text chunks `{ text, pos }` (raw source text and the
 * position of its first character) and substitutions `{ expression, pos }` (`pos`: the `${`).
 */
function partsOf(ts, node, source) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const pos = node.getStart() + 1;
    return [{ text: source.slice(pos, node.end - 1), pos }];
  }
  const parts = [];
  const head = node.head;
  parts.push({ text: source.slice(head.getStart() + 1, head.end - 2), pos: head.getStart() + 1 });
  node.templateSpans.forEach((span, index) => {
    const literal = span.literal;
    const isTail = index === node.templateSpans.length - 1;
    parts.push({ expression: span.expression, pos: literal.pos - 1 });
    const start = literal.getStart() + 1;
    parts.push({ text: source.slice(start, literal.end - (isTail ? 1 : 2)), pos: start });
  });
  // The substitution's `${` sits right after the text before it.
  for (let i = 1; i < parts.length; i += 2) {
    const before = parts[i - 1];
    parts[i].pos = before.pos + before.text.length;
  }
  return parts;
}

/**
 * The whitespace-separated tokens of `parts` (see partsOf): `{ start, pieces }`, where `start` is
 * the source position the token begins at and `pieces` its text chunks and substitutions in order.
 * `range` limits the tokens to `[from, to)` source positions (a class attribute's value).
 */
function tokensOf(parts, range) {
  const tokens = [];
  let current = null;
  const close = () => {
    if (current) tokens.push(current);
    current = null;
  };
  for (const part of parts) {
    if ('expression' in part) {
      if (range && (part.pos < range[0] || part.pos >= range[1])) {
        close();
        continue;
      }
      current ??= { start: part.pos, pieces: [] };
      current.pieces.push({ expression: part.expression });
      continue;
    }
    for (let i = 0; i < part.text.length; i++) {
      const position = part.pos + i;
      const ch = part.text[i];
      if ((range && (position < range[0] || position >= range[1])) || /\s/.test(ch)) {
        close();
        continue;
      }
      current ??= { start: position, pieces: [] };
      const last = current.pieces[current.pieces.length - 1];
      if (last && 'text' in last) last.text += ch;
      else current.pieces.push({ text: ch });
    }
  }
  close();
  return tokens;
}

// -------------------------------------------------------------------------------------------
// JavaScript string escapes (selectors)
// -------------------------------------------------------------------------------------------

/**
 * Decodes the raw text of a JavaScript string or template chunk: `{ cooked, map }`, where
 * `map[i]` is the raw index of the cooked character `i` (`map[cooked.length]` the raw length).
 */
export function decodeJsString(raw) {
  let cooked = '';
  const map = [];
  const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
  for (let i = 0; i < raw.length; i++) {
    map.push(i);
    if (raw[i] !== '\\') {
      cooked += raw[i];
      continue;
    }
    const next = raw[i + 1];
    if (next === 'x') {
      cooked += String.fromCharCode(parseInt(raw.slice(i + 2, i + 4), 16));
      i += 3;
    } else if (next === 'u' && raw[i + 2] === '{') {
      const end = raw.indexOf('}', i);
      cooked += String.fromCodePoint(parseInt(raw.slice(i + 3, end), 16));
      i = end;
    } else if (next === 'u') {
      cooked += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16));
      i += 5;
    } else if (next === '\r' || next === '\n') {
      map.pop();
      i += next === '\r' && raw[i + 2] === '\n' ? 2 : 1;
    } else {
      cooked += simple[next] ?? next;
      i += 1;
    }
  }
  map.push(raw.length);
  return { cooked, map };
}

/** Unescapes a CSS identifier (`hover\:bg-x` -> `hover:bg-x`). */
function unescapeCss(ident) {
  return ident.replace(/\\([0-9a-fA-F]{1,6})\s?|\\([\s\S])/g, (_, hex, char) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : char,
  );
}

/** The class selectors of a cooked selector text: `{ index (after the dot), name }`. */
export function selectorClasses(cooked) {
  const out = [];
  const pattern = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[\s\S]|[\w-]|[\u0080-￿])+)/g;
  for (const match of cooked.matchAll(pattern)) {
    // A dot inside an attribute value or a number is no class selector.
    const before = cooked.slice(0, match.index);
    const open = (before.match(/\[/g) ?? []).length - (before.match(/\]/g) ?? []).length;
    if (open > 0 || /\d$/.test(before)) continue;
    out.push({ index: match.index + 1, name: unescapeCss(match[1]) });
  }
  return out;
}

// -------------------------------------------------------------------------------------------
// The migration
// -------------------------------------------------------------------------------------------

/**
 * Plans the migration of `files` (absolute test files) under `root`: returns the edits per file,
 * the counts and the literals left for a manual decision. `isUtility(word)` tests a word against
 * the unprefixed design system.
 */
export function planMigration(ts, { root, files, isUtility, prefix, excludes = DEFAULT_EXCLUDES }) {
  const excluded = new Set(excludes.map((path) => posix(resolve(root, path)).toLowerCase()));
  const migrated = files.filter((file) => !excluded.has(file.toLowerCase()));
  const fileSet = new Set(migrated.map((file) => file.toLowerCase()));
  const program = createProgram(ts, root, files);
  const checker = program.getTypeChecker();
  const marker = `${prefix}:`;
  const isClass = (word) => MARKER.test(word) || isUtility(word);
  const inMigrated = (node) => fileSet.has(posix(node.getSourceFile().fileName).toLowerCase());
  const placeOf = (node) => {
    const sf = node.getSourceFile();
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    return `${posix(relative(root, sf.fileName))}:${line}`;
  };

  // ---- scopes: the test and describe callbacks that enclose a node, innermost first ----
  const testCallKind = (call) => {
    let callee = call.expression;
    if (ts.isCallExpression(callee)) callee = callee.expression; // it.each(table)(title, fn)
    while (ts.isPropertyAccessExpression(callee)) callee = callee.expression;
    if (!ts.isIdentifier(callee)) return null;
    if (TEST_CALLS.has(callee.text)) return 'test';
    if (SUITE_CALLS.has(callee.text)) return 'suite';
    return null;
  };
  const scopesOf = (node) => {
    const scopes = [];
    for (let p = node.parent; p; p = p.parent) {
      if (
        (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
        p.parent &&
        ts.isCallExpression(p.parent) &&
        p.parent.arguments.includes(p) &&
        testCallKind(p.parent)
      ) {
        scopes.push(p);
      }
      // A shared test helper called in a describe block (`testSystemProps(…)`) defines tests of
      // its own: the classes its options pass in are its scope's, not the whole block's.
      if (ts.isCallExpression(p) && /^test[A-Z]/.test(calleeName(ts, p.expression) ?? '')) {
        scopes.push(p);
      }
      if (ts.isSourceFile(p)) scopes.push(p);
    }
    return scopes;
  };

  // ---- the values a parameter or a loop variable takes ----
  const resolveConst = (expression, seen = new Set()) => {
    const e = stripped(ts, expression);
    if (!e || seen.has(e)) return e;
    seen.add(e);
    if (ts.isIdentifier(e)) {
      const symbol = checker.getSymbolAtLocation(e);
      const declaration = symbol?.valueDeclaration;
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        ts.isIdentifier(declaration.name)
      ) {
        return resolveConst(declaration.initializer, seen);
      }
    }
    return e;
  };
  /** The element expressions of an iterated value (`null` entries: not resolvable). */
  const elementsOf = (expression) => {
    const e = resolveConst(expression);
    if (!e) return [];
    if (ts.isArrayLiteralExpression(e)) {
      return e.elements.flatMap((element) =>
        ts.isSpreadElement(element) ? elementsOf(element.expression) : [element],
      );
    }
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
      const receiver = e.expression.expression;
      const method = e.expression.name.text;
      if (ts.isIdentifier(receiver) && receiver.text === 'Object' && e.arguments[0]) {
        const object = resolveConst(e.arguments[0]);
        if (object && ts.isObjectLiteralExpression(object)) {
          const values = object.properties
            .filter((p) => ts.isPropertyAssignment(p))
            .map((p) => p.initializer);
          if (method === 'values') return values;
          if (method === 'entries') return values.map((value) => ({ entryValue: value }));
        }
        return [];
      }
      if (method === 'entries') {
        return elementsOf(receiver).map((value) => ({ entryValue: value }));
      }
      if (ITERATION_CHAINS.has(method)) return elementsOf(receiver);
      const callback = e.arguments[0];
      if (
        (method === 'map' || method === 'flatMap') &&
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
      ) {
        const returns = returnExpressions(ts, callback);
        return method === 'map' ? returns : returns.flatMap((value) => elementsOf(value));
      }
    }
    return [];
  };
  /** Follows a binding `path` (`{ index }` or `{ key }` steps) into a value expression. */
  const pick = (value, path) => {
    let current = value;
    for (const step of path) {
      if (current && typeof current === 'object' && 'entryValue' in current) {
        if (step.index !== 1) return null;
        current = current.entryValue;
        continue;
      }
      const e = resolveConst(current);
      if (!e) return null;
      if ('index' in step && ts.isArrayLiteralExpression(e)) current = e.elements[step.index];
      else if ('key' in step && ts.isObjectLiteralExpression(e)) {
        const property = e.properties.find(
          (p) =>
            (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
            propertyNameText(ts, p.name) === step.key,
        );
        if (!property) return null;
        current = ts.isPropertyAssignment(property) ? property.initializer : property.name;
      } else return null;
      if (!current || ts.isOmittedExpression(current)) return null;
    }
    return current && typeof current === 'object' && 'entryValue' in current ? null : current;
  };

  let callIndex = null;
  /** The calls of every function declared in the program's test files, by declaration. */
  const callsOf = (fn) => {
    if (!callIndex) {
      callIndex = new Map();
      for (const file of files) {
        const sf = sourceFileOf(program, file);
        if (!sf) continue;
        const visit = (node) => {
          if (ts.isCallExpression(node)) {
            const target = tracer.functionOf(node.expression);
            if (target) {
              if (!callIndex.has(target)) callIndex.set(target, []);
              callIndex.get(target).push(node);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(sf);
      }
    }
    return callIndex.get(fn) ?? [];
  };

  const resolveBinding = (declaration, depth, ctx, trace, keys) => {
    let node = declaration;
    const path = [];
    while (ts.isBindingElement(node)) {
      const pattern = node.parent;
      if (ts.isArrayBindingPattern(pattern))
        path.unshift({ index: pattern.elements.indexOf(node) });
      else path.unshift({ key: propertyNameText(ts, node.propertyName ?? node.name) });
      node = pattern.parent;
    }
    const traceValue = (value) => {
      const picked = pick(value, path);
      if (picked) trace(picked, depth, ctx, keys);
    };
    /** The values `path` binds in the elements of an iterated `expression`, through the tracer. */
    const traceElements = (expression) => {
      let e = stripped(ts, expression);
      let steps = path;
      if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
        const method = e.expression.name.text;
        const receiver = e.expression.expression;
        const objectCall = ts.isIdentifier(receiver) && receiver.text === 'Object';
        if (objectCall && method === 'values' && e.arguments[0]) e = e.arguments[0];
        else if (method === 'entries' && (!objectCall || e.arguments[0])) {
          // [key or index, value] pairs: only the value is a class value.
          if (steps[0]?.index !== 1) return;
          e = objectCall ? e.arguments[0] : receiver;
          steps = steps.slice(1);
        } else if (objectCall) return;
      }
      const stepKeys = steps.map((step) => ('index' in step ? String(step.index) : step.key));
      const tail = keys ?? Array(depth).fill('*');
      trace(e, depth + 1 + steps.length, ctx, ['*', ...stepKeys, ...tail]);
    };
    if (ts.isVariableDeclaration(node)) {
      const statement = node.parent?.parent;
      if (statement && ts.isForOfStatement(statement)) traceElements(statement.expression);
      return;
    }
    if (!ts.isParameter(node)) return;
    const fn = node.parent;
    const index = fn.parameters.indexOf(node);
    const call = fn.parent;
    if (call && ts.isCallExpression(call) && call.arguments.includes(fn)) {
      // it.each(table)(title, (a, b) => …) and describe.each.
      if (
        ts.isCallExpression(call.expression) &&
        calleeName(ts, call.expression.expression) === 'each'
      ) {
        for (const row of elementsOf(call.expression.arguments[0])) {
          if (!row || typeof row !== 'object' || 'entryValue' in row) continue;
          const resolved = resolveConst(row);
          if (resolved && ts.isArrayLiteralExpression(resolved)) {
            if (resolved.elements[index]) traceValue(resolved.elements[index]);
          } else if (index === 0) traceValue(row);
        }
        return;
      }
      // list.forEach((cls) => …) and the other iteration methods.
      if (
        ts.isPropertyAccessExpression(call.expression) &&
        ITERATION_METHODS.has(call.expression.name.text) &&
        call.arguments[0] === fn &&
        index === 0
      ) {
        traceElements(call.expression.expression);
      }
      return;
    }
    // A helper: the arguments of its calls.
    for (const site of callsOf(fn)) {
      if (node.dotDotDotToken) {
        // A rest parameter is the array of the remaining arguments.
        for (const argument of site.arguments.slice(index)) {
          if (ts.isSpreadElement(argument)) trace(argument.expression, depth, ctx, keys);
          else trace(argument, Math.max(depth - 1, 0), ctx, keys?.slice(1));
        }
      } else if (site.arguments[index]) {
        const argument = site.arguments[index];
        if (!ts.isSpreadElement(argument)) traceValue(argument);
      }
    }
  };

  // ---- tracing ----
  /** literal node -> origins ({ kind, scopes }) of the contexts that reached it. */
  const reached = new Map();
  const tracer = createTracer(ts, program, {
    addLiteral: (node, ctx) => {
      if (!ctx?.origin || !inMigrated(node)) return;
      if (!reached.has(node)) reached.set(node, []);
      reached.get(node).push(ctx.origin);
    },
    resolveParameter: resolveBinding,
    resolveVariable: resolveBinding,
    // Merge calls are classified where they are written (below), never through a trace.
    onMergeCall: () => {},
    passThroughCalls: PASS_THROUGH,
    chainMethods: new Set([...CHAIN_METHODS, ...ITERATION_CHAINS]),
    preciseProperties: true,
    standaloneSpans: true,
    mapCallbacks: true,
  });
  /** Whether a matcher call is negated (`expect(el).not.toHaveClass(…)`). */
  const isNegated = (call) => {
    if (!ts.isCallExpression(call)) return false;
    for (let e = call.expression; e && ts.isPropertyAccessExpression(e); e = e.expression) {
      if (e.name.text === 'not') return true;
    }
    return false;
  };
  const start = (node, kind, at, depth = 0) => {
    if (!node) return;
    const origin = {
      kind,
      scopes: scopesOf(at),
      file: at.getSourceFile().fileName,
      place: placeOf(at),
      negative: isNegated(at),
    };
    tracer.trace(node, depth, tracer.newContext(new Map(), origin));
  };
  const startArgument = (argument, kind, at) => {
    if (ts.isSpreadElement(argument)) start(argument.expression, kind, at, 1);
    else start(argument, kind, at);
  };
  /** An expected value: the values of its objects and the elements of its arrays, one by one. */
  const startExpected = (node, kind, at, seen = new Set()) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (ts.isSpreadElement(node)) return start(node.expression, kind, at, 1);
    const e = resolveConst(node);
    if (e && ts.isObjectLiteralExpression(e)) {
      for (const property of e.properties) {
        if (ts.isPropertyAssignment(property)) startExpected(property.initializer, kind, at, seen);
        else if (ts.isSpreadAssignment(property)) start(property.expression, kind, at, 1);
      }
      return;
    }
    if (e && ts.isArrayLiteralExpression(e)) {
      for (const element of e.elements) startExpected(element, kind, at, seen);
      return;
    }
    start(node, kind, at);
  };

  /** The `expect(…)` subject of a matcher call, or undefined when it is no `expect` chain. */
  const expectSubject = (call) => {
    let e = ts.isPropertyAccessExpression(call.expression) ? call.expression.expression : null;
    while (e && ts.isPropertyAccessExpression(e)) e = e.expression;
    if (e && ts.isCallExpression(e) && calleeName(ts, e.expression) === 'expect') {
      return e.arguments[0] ?? null;
    }
    return undefined;
  };
  /**
   * Whether an `expect()` subject reads classes, by its shape: `el.className`, `el.classList`,
   * `getAttribute('class')`, a `cn`/`wcn` merge, a class helper's result (`classesOf(el)`), a
   * class map or list (`buttonAppearanceClasses.primary`, `classes`), through `Array.from`, a
   * spread and `sort`/`split`/`join`, or a constant holding one of those. An array of other values
   * (`[wrap, grid, classes.root]`) and the keys of a class map (`Object.keys(…)`) are no classes.
   */
  const classLikeSubject = (subject, depth = 0) => {
    const e = stripped(ts, subject);
    if (!e || depth > 4) return false;
    if (ts.isCallExpression(e)) {
      const name = calleeName(ts, e.expression);
      if (ts.isPropertyAccessExpression(e.expression)) {
        const receiver = e.expression.expression;
        if (ts.isIdentifier(receiver) && receiver.text === 'Object') return false;
        if (ts.isIdentifier(receiver) && receiver.text === 'Array' && name === 'from') {
          return classLikeSubject(e.arguments[0], depth + 1);
        }
        if (name === 'getAttribute') return literalText(e.arguments[0]) === 'class';
        if (CLASS_WRAPPERS.has(name)) return classLikeSubject(receiver, depth + 1);
        // `sizes.map((s) => classesOf(…).find(…))`: what the callback returns.
        const callback = e.arguments[0];
        if (
          (name === 'map' || name === 'flatMap') &&
          callback &&
          (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))
        ) {
          const returns = returnExpressions(ts, callback);
          return returns.length > 0 && returns.every((r) => classLikeSubject(r, depth + 1));
        }
      }
      if (name === 'String') return classLikeSubject(e.arguments[0], depth + 1);
      return Boolean(name && (MERGE_CALLS.has(name) || CLASS_FUNCTION.test(name)));
    }
    if (ts.isArrayLiteralExpression(e)) {
      return (
        e.elements.length === 1 &&
        ts.isSpreadElement(e.elements[0]) &&
        classLikeSubject(e.elements[0].expression, depth + 1)
      );
    }
    if (ts.isPropertyAccessExpression(e)) {
      if (['className', 'classList'].includes(e.name.text)) return true;
      if (CLASS_HOLDER.test(e.name.text)) return true;
      // A value of a class map: `buttonAppearanceClasses.primary`.
      return (
        (ts.isIdentifier(e.expression) || ts.isPropertyAccessExpression(e.expression)) &&
        CLASS_HOLDER.test(
          ts.isIdentifier(e.expression) ? e.expression.text : e.expression.name.text,
        )
      );
    }
    if (ts.isElementAccessExpression(e)) return classLikeSubject(e.expression, depth + 1);
    if (ts.isIdentifier(e)) {
      if (CLASS_HOLDER.test(e.text)) return true;
      const resolved = resolveConst(e);
      return Boolean(resolved && resolved !== e && classLikeSubject(resolved, depth + 1));
    }
    return false;
  };
  /** Whether `node` is inside the arguments of an expectation (a matcher, `objectContaining`). */
  const inExpectation = (node) => {
    // Only the arguments count: the `expect(…)` subject sits in the matcher's callee.
    for (let child = node, p = node.parent; p && !ts.isStatement(p); child = p, p = p.parent) {
      if (
        ts.isCallExpression(p) &&
        p.arguments.includes(child) &&
        EXPECTATION_CALLS.has(calleeName(ts, p.expression))
      ) {
        return true;
      }
    }
    return false;
  };
  const literalText = (node) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : undefined;

  /** Merge calls: own classes before the first other argument, consumer ones after the last. */
  const classifyMerge = (call) => {
    const isOther = (argument) => {
      const e = stripped(ts, argument);
      if (
        ts.isStringLiteral(e) ||
        ts.isNoSubstitutionTemplateLiteral(e) ||
        ts.isTemplateExpression(e)
      ) {
        return false;
      }
      if (ts.isIdentifier(e) && /^className$/i.test(e.text)) return false;
      if (ts.isPropertyAccessExpression(e) && /^className$/i.test(e.name.text)) return false;
      return true;
    };
    const others = call.arguments.map(isOther);
    const first = others.indexOf(true);
    const last = others.lastIndexOf(true);
    call.arguments.forEach((argument, index) => {
      if (others[index]) return;
      const kind =
        first === -1 || index < first ? 'sink' : index > last ? 'consumer' : 'unsure-merge';
      startArgument(argument, kind, call);
    });
  };

  /** The source ranges of the class attribute values of a markup literal, across chunks. */
  const classRanges = (node) => {
    const ranges = [];
    const raw = node.getSourceFile().getFullText().slice(node.getStart(), node.end);
    for (const match of raw.matchAll(/\bclass=(\\?["'])/g)) {
      const from = node.getStart() + match.index + match[0].length;
      const close = raw.indexOf(match[1], match.index + match[0].length);
      if (close !== -1) ranges.push([from, node.getStart() + close]);
    }
    return ranges;
  };

  const titles = new Set();
  const markupLiterals = [];
  const regexes = [];
  const renames = new Map();
  for (const file of migrated) {
    const sf = sourceFileOf(program, file);
    if (!sf) continue;
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(ts, node.expression);
        const receiver = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.expression
          : null;
        const onClassList =
          receiver && ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'classList';
        if (testCallKind(node) && node.arguments[0]) titles.add(node.arguments[0]);
        if (name === 'toHaveClass') {
          for (const argument of node.arguments) startArgument(argument, 'sink', node);
        } else if (name === 'toHaveAttribute' && literalText(node.arguments[0]) === 'class') {
          if (node.arguments[1]) start(node.arguments[1], 'sink', node);
        } else if (name && VALUE_MATCHERS.has(name) && expectSubject(node) !== undefined) {
          const kind = classLikeSubject(expectSubject(node)) ? 'sink' : 'fallback';
          for (const argument of node.arguments) startExpected(argument, kind, node);
        } else if (name === 'contains' && onClassList) {
          start(node.arguments[0], 'sink', node);
        } else if (['add', 'remove', 'toggle', 'replace'].includes(name) && onClassList) {
          for (const argument of node.arguments) startArgument(argument, 'consumer', node);
        } else if (name === 'setAttribute' && literalText(node.arguments[0]) === 'class') {
          start(node.arguments[1], 'consumer', node);
        } else if (name && SELECTOR_CALLS.has(name)) {
          start(node.arguments[0], 'selector', node);
        } else if (name === 'getElementsByClassName') {
          start(node.arguments[0], 'sink', node);
        } else if (name && MERGE_CALLS.has(name)) {
          classifyMerge(node);
        } else if (name && SLOT_BASE_ARGUMENT.has(name)) {
          // A test of the slot helpers plays the component: the base classes are its own.
          start(node.arguments[SLOT_BASE_ARGUMENT.get(name)], 'sink', node);
        }
      } else if (ts.isJsxAttribute(node)) {
        const name = propertyNameText(ts, node.name);
        if (name && CONSUMER_NAME.test(name) && node.initializer) {
          const value = ts.isJsxExpression(node.initializer)
            ? node.initializer.expression
            : node.initializer;
          start(value, 'consumer', node);
        }
      } else if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
        const name = propertyNameText(ts, node.name);
        const value = ts.isPropertyAssignment(node) ? node.initializer : node.name;
        const owner = node.parent?.parent;
        if (
          name === 'overrides' &&
          owner &&
          ts.isPropertyAssignment(owner) &&
          propertyNameText(ts, owner.name) === 'conflictingClass'
        ) {
          start(value, 'sink', node);
        } else if (name && CONSUMER_NAME.test(name)) {
          start(value, inExpectation(node) ? 'expected-object' : 'consumer', node);
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.name.text === 'className'
      ) {
        // `el.className = '…'`: the test sets the element's classes itself.
        start(node.right, 'consumer', node);
      } else if (ts.isRegularExpressionLiteral(node)) {
        regexes.push(node);
      }
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node) ||
          ts.isTemplateExpression(node)) &&
        /\bclass=\\?["']/.test(node.getText())
      ) {
        markupLiterals.push(node);
        // A substitution in a class attribute is a class value of the markup.
        if (ts.isTemplateExpression(node)) {
          const ranges = classRanges(node);
          for (const part of partsOf(ts, node, node.getSourceFile().getFullText())) {
            if ('expression' in part && ranges.some(([a, b]) => part.pos >= a && part.pos < b)) {
              start(part.expression, 'sink', node);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    const edits = renameCn(ts, sf, checker);
    if (edits.length > 0) renames.set(file, edits);
  }

  // ---- constant text of a token ----
  const constString = (expression, seen = new Set()) => {
    const e = stripped(ts, expression);
    if (!e || seen.has(e)) return null;
    seen.add(e);
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isNumericLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) {
      let out = e.head.text;
      for (const span of e.templateSpans) {
        const value = constString(span.expression, seen);
        if (value === null) return null;
        out += value + span.literal.text;
      }
      return out;
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = constString(e.left, seen);
      const right = left === null ? null : constString(e.right, seen);
      return left === null || right === null ? null : left + right;
    }
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) {
      let symbol = checker.getSymbolAtLocation(ts.isIdentifier(e) ? e : e.name);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      const declaration = symbol?.valueDeclaration;
      if (
        declaration &&
        (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) &&
        declaration.initializer &&
        (!ts.isVariableDeclaration(declaration) || declaration.parent.flags & ts.NodeFlags.Const)
      ) {
        return constString(declaration.initializer, seen);
      }
    }
    return null;
  };
  /** A token's text when every substitution resolves, else `null`. */
  const tokenText = (token) => {
    let text = '';
    for (const piece of token.pieces) {
      if ('text' in piece) text += piece.text;
      else {
        const value = constString(piece.expression);
        if (value === null) return null;
        text += value;
      }
    }
    return text;
  };
  /** A token's source text, its substitutions as written (`my-${name}`). */
  const rawToken = (token) =>
    token.pieces
      .map((piece) => ('text' in piece ? piece.text : `\${${piece.expression.getText()}}`))
      .join('');
  const fragmentLooksLikeClass = (token) =>
    token.pieces.some(
      (piece) =>
        'text' in piece &&
        piece.text.length > 1 &&
        (isClass(piece.text) || (/-$/.test(piece.text) && isUtility(`${piece.text}4`))),
    );
  /** A word that reads as a class even alone: a utility with a dash, colon, bracket or slash. */
  const classyWord = (word) => !word.startsWith(marker) && isClass(word) && /[-:[/]/.test(word);
  const classy = (words) => {
    const utilities = words.filter((word) => !word.startsWith(marker) && isClass(word));
    return (
      utilities.some((word) => /[-:[/]/.test(word)) ||
      (words.length > 1 && utilities.length === words.length)
    );
  };
  /** A class list: two or more words, each a utility or a stable class, one a utility at least. */
  const classList = (words) =>
    words.length > 1 &&
    words.every((word) => word && (isClass(word) || STABLE_CLASS.test(word))) &&
    words.some((word) => word && isClass(word));

  /**
   * The scopes whose consumer words decide a literal for a context: the context's own, or, for a
   * context in another file (a shared helper such as testSystemProps), the literal's, so the
   * classes every caller of the helper passes in never mix.
   */
  const scopesFor = (origin, node) =>
    origin.file === node.getSourceFile().fileName ? origin.scopes : scopesOf(node);

  // ---- consumer words, by the scope of the context that passed them ----
  const consumerWords = new Map();
  for (const [node, origins] of reached) {
    const source = node.getSourceFile().getFullText();
    const words = tokensOf(partsOf(ts, node, source)).map(
      (token) => tokenText(token) ?? rawToken(token),
    );
    for (const origin of origins) {
      if (origin.kind !== 'consumer') continue;
      const scope = scopesFor(origin, node)[0];
      if (!consumerWords.has(scope)) consumerWords.set(scope, new Map());
      for (const word of words) {
        if (word && !consumerWords.get(scope).has(word)) {
          consumerWords.get(scope).set(word, origin.place);
        }
      }
    }
  }
  /** Where `word` is passed in as a consumer class in one of `scopes`, or `undefined`. */
  const passedInAt = (word, scopes) => {
    for (const scope of scopes) {
      const place = consumerWords.get(scope)?.get(word);
      if (place) return place;
    }
    return undefined;
  };
  const passedIn = (word, scopes) => passedInAt(word, scopes) !== undefined;

  // ---- decisions ----
  const edits = new Map();
  const addEdit = (node, edit) => {
    const file = posix(node.getSourceFile().fileName);
    if (!edits.has(file)) edits.set(file, []);
    edits.get(file).push(edit);
  };
  const stats = { words: 0, selectors: 0, markup: 0 };
  /** One entry per literal and kind: `{ place, kind, words, text }`, and `sites` when known. */
  const reports = new Map();
  const report = (node, kind, word, sites = []) => {
    const key = `${node.getSourceFile().fileName}:${node.getStart()}:${kind}`;
    if (!reports.has(key)) {
      reports.set(key, {
        place: placeOf(node),
        kind,
        words: new Set(),
        sites: new Set(),
        text: node.getText().replace(/\s+/g, ' ').slice(0, 120),
      });
    }
    if (word) reports.get(key).words.add(word);
    for (const site of sites) reports.get(key).sites.add(site);
  };
  /**
   * The places a decision rests on, collected while `decide` runs for one token: for a negative
   * assertion that a word passed in keeps unprefixed (`kept-negative`), the assertion and the
   * pass-in site. Such an assertion stays a check of the consumer's class; when it was about
   * Wave's own class it passes for nothing after the flip, so each one is reported.
   */
  let decisionSites = [];

  // ---- the values a substitution can take (a probe through its own tracer) ----
  let probed = null;
  const probeTracer = createTracer(ts, program, {
    addLiteral: (node) => probed?.push(node),
    resolveParameter: resolveBinding,
    resolveVariable: resolveBinding,
    onMergeCall: () => {},
    passThroughCalls: PASS_THROUGH,
    chainMethods: new Set([...CHAIN_METHODS, ...ITERATION_CHAINS]),
    preciseProperties: true,
    standaloneSpans: true,
    mapCallbacks: true,
  });
  /** The string values `expression` can take, or `null` when one does not resolve. */
  const probeValues = (expression) => {
    const constant = constString(expression);
    if (constant !== null) return [constant];
    probed = [];
    probeTracer.trace(expression, 0, probeTracer.newContext(new Map(), { kind: 'probe' }));
    const found = probed;
    probed = null;
    const values = new Set();
    for (const literal of found) {
      const value = constString(literal);
      if (value === null) return null;
      values.add(value);
    }
    return values.size > 0 ? [...values] : null;
  };
  /** Every text a token with substitutions can take (at most 256), or `null`. */
  const tokenCombinations = (token) => {
    let combinations = [''];
    for (const piece of token.pieces) {
      const values = 'text' in piece ? [piece.text] : probeValues(piece.expression);
      if (!values) return null;
      combinations = combinations.flatMap((head) => values.map((value) => head + value));
      if (combinations.length > 256) return null;
    }
    return combinations;
  };

  /** Prefixes the class tokens of `node` that `decide(text)` returns 'prefix' for. */
  /** Whether one of `values` is or holds a class, prefixed or not. */
  const holdsClass = (values) =>
    values.some((value) =>
      value.split(/\s+/).some((word) => word && (word.startsWith(marker) || isClass(word))),
    );

  /** Prefixes the class tokens of `node` that `decide(text)` returns 'prefix' for. */
  const rewriteTokens = (node, tokens, decide, count, passed = () => false) => {
    for (const token of tokens) {
      // A token that starts with a substitution holding a whole class (`${MAP[key]}`, a recipe of
      // src): the literals behind the substitution are traced and prefixed themselves (src by the
      // src codemod), in either order of the two runs, so the token never gets a prefix of its own.
      const first = token.pieces[0];
      if ('expression' in first) {
        const values = probeValues(first.expression);
        if (values && holdsClass(values)) continue;
      }
      const text = tokenText(token);
      decisionSites = [];
      if (text === null) {
        // Every value the substitutions can take (`text-${variant}` over the rows of an
        // `it.each`): prefixed at the token's start when each combination is a class.
        const combinations = tokenCombinations(token);
        const decision = combinations?.every((combo) => !combo.startsWith(marker) && isClass(combo))
          ? combine(new Set(combinations.map((combo) => decide(combo))))
          : null;
        if (decision === 'prefix') {
          addEdit(node, { start: token.start, end: token.start, text: marker });
          stats[count] += 1;
        } else if (decision === 'keep') {
          continue;
        } else if (decision) {
          report(node, decision, rawToken(token), decisionSites);
        } else if (fragmentLooksLikeClass(token) && !passed(rawToken(token))) {
          report(node, 'glued', token.pieces.map((p) => p.text ?? '${…}').join(''));
        }
        continue;
      }
      if (text.startsWith(marker) || !isClass(text)) continue;
      const decision = decide(text);
      if (decision === 'prefix') {
        addEdit(node, { start: token.start, end: token.start, text: marker });
        stats[count] += 1;
      } else if (decision !== 'keep') report(node, decision, text, decisionSites);
    }
  };

  /** The decision of several contexts for one word: a disagreement is reported. */
  const combine = (decisions) => {
    const kept = decisions.has('keep') || decisions.has('kept-negative');
    if (decisions.has('prefix') && kept) return 'ambiguous';
    if (decisions.has('prefix')) return 'prefix';
    if (decisions.has('kept-negative')) return 'kept-negative';
    if (decisions.has('keep')) return 'keep';
    return [...decisions][0];
  };

  const handled = new Set(markupLiterals);
  for (const node of markupLiterals) {
    const parts = partsOf(ts, node, node.getSourceFile().getFullText());
    const scopes = scopesOf(node);
    for (const range of classRanges(node)) {
      rewriteTokens(
        node,
        tokensOf(parts, range),
        (text) => (passedIn(text, scopes) ? 'keep' : 'prefix'),
        'markup',
        (raw) => passedIn(raw, scopes),
      );
    }
  }

  for (const [node, origins] of reached) {
    if (handled.has(node)) continue;
    handled.add(node);
    if (origins.some((origin) => origin.kind === 'consumer')) continue;
    const source = node.getSourceFile().getFullText();
    const kinds = new Set(origins.map((origin) => origin.kind));
    if (kinds.has('selector')) {
      if (kinds.size > 1) report(node, 'ambiguous');
      else rewriteSelector(node, source, origins);
      continue;
    }
    const parts = partsOf(ts, node, source);
    if (parts.some((part) => 'text' in part && part.text.includes('\\'))) {
      const words = parts.flatMap((part) => ('text' in part ? part.text.split(/\s+/) : []));
      if (classy(words.filter(Boolean))) report(node, 'escaped');
      continue;
    }
    const tokens = tokensOf(parts);
    const list = classList(tokens.map((token) => tokenText(token) ?? ''));
    rewriteTokens(
      node,
      tokens,
      (text) =>
        combine(
          new Set(
            origins.map((origin) => {
              if (origin.kind === 'unsure-merge') return 'merge';
              if (origin.kind === 'expected-object') return 'expected-object';
              if (origin.kind === 'fallback' && !list) return classyWord(text) ? 'subject' : 'keep';
              const site = passedInAt(text, scopesFor(origin, node));
              if (!site) return 'prefix';
              if (!origin.negative) return 'keep';
              decisionSites.push(`${origin.place} (passed in at ${site})`);
              return 'kept-negative';
            }),
          ),
        ),
      'words',
      (raw) => origins.some((origin) => passedIn(raw, scopesFor(origin, node))),
    );
  }

  function rewriteSelector(node, source, origins) {
    const parts = partsOf(ts, node, source);
    const isRaw =
      node.parent &&
      ts.isTaggedTemplateExpression(node.parent) &&
      node.parent.tag.getText() === 'String.raw';
    for (const part of parts) {
      if (!('text' in part)) continue;
      const { cooked, map } = isRaw
        ? { cooked: part.text, map: [...part.text].map((_, i) => i).concat(part.text.length) }
        : decodeJsString(part.text);
      for (const { index, name } of selectorClasses(cooked)) {
        if (name.startsWith(marker) || !isClass(name)) continue;
        if (origins.every((origin) => passedIn(name, scopesFor(origin, node)))) continue;
        addEdit(node, {
          start: part.pos + map[index],
          end: part.pos + map[index],
          text: isRaw ? `${prefix}\\:` : `${prefix}\\\\:`,
        });
        stats.selectors += 1;
      }
    }
  }

  // ---- what no context classified ----
  for (const file of migrated) {
    const sf = sourceFileOf(program, file);
    if (!sf) continue;
    const visit = (node) => {
      const stringLike =
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node);
      if (stringLike) {
        const parent = node.parent;
        const skip =
          handled.has(node) ||
          titles.has(node) ||
          ts.isImportDeclaration(parent) ||
          ts.isExportDeclaration(parent) ||
          ts.isLiteralTypeNode(parent) ||
          (ts.isPropertyAssignment(parent) && parent.name === node) ||
          (reached.get(node) ?? []).length > 0;
        if (!skip) {
          const text = ts.isTemplateExpression(node)
            ? [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ')
            : node.text;
          const words = text.split(/\s+/).filter(Boolean);
          const selectorHit =
            /[.]/.test(text) && selectorClasses(text).some(({ name }) => classyWord(name));
          if (classy(words) || selectorHit) report(node, 'untraced');
        }
        if (ts.isTemplateExpression(node)) {
          for (const span of node.templateSpans) visit(span.expression);
        }
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  for (const node of regexes) {
    const words = node.text
      .slice(1, node.text.lastIndexOf('/'))
      .split(/[^\w\-:[\]/.]+/)
      .filter((word) => word.length > 1);
    if (words.some((word) => /-/.test(word) && classyWord(word))) report(node, 'regex');
  }
  const unclassified = [...reports.values()].map(({ words, sites, ...entry }) => ({
    ...entry,
    words: [...words],
    ...(sites.size > 0 ? { sites: [...sites] } : {}),
  }));

  // ---- edits per file ----
  const plans = [];
  for (const file of migrated) {
    const fileEdits = [...(edits.get(file) ?? []), ...(renames.get(file) ?? [])];
    if (fileEdits.length === 0) continue;
    // Several origins may insert the same prefix at one place: once.
    const unique = [
      ...new Map(fileEdits.map((e) => [`${e.start}:${e.end}:${e.text}`, e])).values(),
    ];
    plans.push({ file, edits: unique, renamed: (renames.get(file) ?? []).length });
  }
  unclassified.sort((a, b) => (a.place < b.place ? -1 : a.place > b.place ? 1 : 0));
  return { files: migrated, plans, stats, unclassified };
}

// -------------------------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------------------------

/**
 * Whether the class strings of src carry `prefix` yet, read from src/lib/styles.ts (the recipes);
 * `undefined` for a project without it (the test fixtures).
 */
export function srcPrefixed(root, prefix) {
  const path = join(root, 'src/lib/styles.ts');
  if (!existsSync(path)) return undefined;
  return new RegExp(`['"\`\\s]${prefix}:`).test(readFileSync(path, 'utf8'));
}

/** Runs the migration; returns the exit code. `io` takes `log` and `error`. */
export async function main(argv = process.argv.slice(2), { io = console } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    io.error(`prefix-tests-codemod: ${error.message}`);
    return 2;
  }
  if (srcPrefixed(options.root, options.prefix) === false) {
    const order =
      'src is not prefixed yet (src/lib/styles.ts): the flip runs scripts/prefix-codemod.mjs ' +
      '--write over src first, then this tool';
    if (options.write && !options.allowUnprefixedSrc) {
      io.error(`prefix-tests-codemod: ${order} (--allow-unprefixed-src writes anyway)`);
      return 2;
    }
    io.error(`prefix-tests-codemod: warning: ${order}`);
  }
  const ts = loadTypeScript();
  const files = listTestFiles(options.root, options.paths);
  const isUtility = await loadUtilityTest(options.root, {
    themes: options.themes,
    variants: options.variants,
  });
  const plan = planMigration(ts, {
    root: options.root,
    files,
    isUtility,
    prefix: options.prefix,
    excludes: options.excludes,
  });
  const perFile = {};
  let changed = 0;
  let renamed = 0;
  for (const { file, edits, renamed: renames } of plan.plans) {
    const source = readFileSync(file, 'utf8');
    const next = applyEdits(source, edits);
    if (next === source) continue;
    changed += 1;
    renamed += renames;
    perFile[posix(relative(options.root, file))] = edits.length - renames;
    if (options.write) writeFileSync(file, next);
  }
  const summary = {
    files: plan.files.length,
    changedFiles: changed,
    ...plan.stats,
    renamed,
    residue: plan.unclassified.length,
    unclassified: plan.unclassified,
    perFile,
  };
  if (options.report) writeFileSync(options.report, `${JSON.stringify(summary, null, 1)}\n`);
  const mode = options.write ? '' : options.check ? ' (check)' : ' (dry run)';
  io.log(
    `prefix-tests-codemod: ${plan.stats.words} class word(s), ${plan.stats.selectors} selector(s) ` +
      `and ${plan.stats.markup} markup word(s) prefixed in ${changed} of ${plan.files.length} ` +
      `file(s)${mode}; ${renamed} cn rename(s); ${plan.unclassified.length} literal(s) left for ` +
      `a manual decision${options.report ? '' : ' (--report lists them)'}`,
  );
  if (options.check && changed > 0) {
    for (const file of Object.keys(perFile).slice(0, 20)) io.log(`  ${file}`);
    return 1;
  }
  return 0;
}

await runScript(import.meta.url, main);
