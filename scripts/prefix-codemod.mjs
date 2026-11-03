#!/usr/bin/env node
/**
 * The prefix codemod and compile check of the library's own utilities (Phase 14 spec R6, "The src
 * codemod is AST-based" and "Compile check"; the Task 1 spike's tool, made a repository script by
 * Task 21). Repo-internal: never packed.
 *
 * Prefixes every Tailwind utility word of WaveUI's own class strings with `<prefix>:` (`wave:`), and
 * renames the internal merge calls `cn(…)` to `wcn(…)`. AST-based (the TypeScript compiler API and
 * its type checker), limited to class contexts:
 *
 *   sinks   the arguments of `cn`, `wcn`, `clsx`, `twMerge`; the base class argument of `renderSlot`
 *           and `resolveSlot` (third) and `withPartClass` (second); a JSX attribute or an object
 *           property named `className`, `class`, `*ClassName` or `*Classes`, and the default value
 *           of a parameter or binding of such a name; a variable named `*Classes`/`*ClassName`;
 *           `classList.add/remove/toggle/replace/contains` arguments and `.className =`; every
 *           variable and property initializer of the recipe modules (`src/lib/styles.ts`,
 *           `src/lib/motion.ts`). The `*ClassNames` registry (stable classes) is never a sink.
 *   tracing from a sink through conditionals, logical and `+` operators, templates, arrays,
 *           parentheses and type assertions, identifiers (to their declaration, across modules),
 *           property and element accesses (an element access reads the map's values), calls of
 *           the project's own functions (their return expressions, a parameter mapped to the
 *           call's argument), `useMemo` callbacks, and `.join`/`.trim`/`.filter`/`.concat` chains.
 *
 * A word is prefixed when Tailwind (the project's theme and variants, unprefixed) generates CSS for
 * it, or when it is a `group`/`peer` marker (`group/row`). A word already prefixed is left alone, so
 * a second run changes nothing. A word glued to a template substitution (`size-${n}`), or a literal
 * with an escape, is reported and left alone. Comments, identifiers and non-class strings are never
 * read, and no file of `__tests__` (scripts/prefix-tests-codemod.mjs migrates the tests).
 *
 * The compile check (`--check`) is the net for what the tracing misses. It reads the words of every
 * string literal of the given files (the TypeScript AST, never Tailwind's scanner, which also reads
 * comments) and tests each against the unprefixed design system, in two tiers:
 *   1. a literal the class-context tracing reaches may hold no unprefixed utility word at all (no
 *      allowlist): an unprefixed `relative` in a `wcn` call fails even in a file whose style
 *      object says `position: 'relative'`; and each of its prefixed words must compile: the
 *      prefix first (`hover:wave:bg-primary`, `!wave:p-4` and `wave:wave:p-4` compile to
 *      nothing), and the word without it a utility or a `group`/`peer` marker of the design system
 *      (`wave:bg-primry` fails; a word glued to a substitution is checked for the prefix only);
 *   2. any other literal (a positioning strategy, an ARIA role, a prop value, an event name, prose)
 *      may hold one only where the allowlist names that word for that file: a JSON map of file
 *      (relative to the root) to words, `scripts/prefix-allowlist.json`, never a global word list.
 * scripts/build-css.mjs runs it when `UTILITY_PREFIX` (src/lib/cn.ts) is set.
 *
 * Usage:
 *   node scripts/prefix-codemod.mjs [--root <project>] [--prefix wave] [--theme <css>]...
 *        [--variants <css>] [--no-rename-cn] [--write | --check [--allow <json>] [--write-allowlist]
 *        [--class-free <dir>]...]
 *        [--report <file.json>] <files or dirs>...
 *
 *   (no mode)          a dry run: counts what `--write` would change, writes nothing
 *   --write            rewrites the files (then run `prettier --write` on them: lines get longer)
 *   --check            the compile check (exit 1 on a finding); `--allow` names the allowlist
 *                      (default: <root>/scripts/prefix-allowlist.json when it exists, else none);
 *                      `--write-allowlist` writes the tier-2 pairs found to that file instead of
 *                      checking them (read every place first: a pair is a decision)
 *   --class-free <dir> a directory (relative to the root) that holds no class string because the
 *                      CSS build scans none of it (src/hooks): `--check` fails a prefixed word in
 *                      any of its string literals
 *   --report <json>    writes the details (per-file counts, glued and escaped words; for `--check`
 *                      the failures, the tier-2 word-file pairs and their lines, `untracedPlaces`)
 *
 * `--root` defaults to the current directory. `--theme` files hold the `@theme` mapping the design
 * system is loaded with (default `<root>/src/styles/theme.css`, else `<root>/src/styles/tokens.css`),
 * `--variants` the custom variants (default `<root>/src/styles/variants.css`). Directories are walked
 * for `.ts`/`.tsx` files, `__tests__` and `node_modules` excluded. TypeScript and Tailwind are
 * resolved from this repository, so `--root` may be any directory (the tests use fixture trees).
 *
 * The building blocks are exported for scripts/prefix-tests-codemod.mjs and the tests
 * (scripts/__tests__/prefix-codemod.test.mjs); importing the module runs nothing. It starts through
 * verify-dist's `runScript`, so a script of its name that cannot be matched to this file fails.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { runScript } from './verify-dist.mjs';

const require = createRequire(import.meta.url);

/** A path with forward slashes. */
export const posix = (path) => path.split(sep).join('/');

/** The TypeScript compiler of this repository. */
export function loadTypeScript() {
  return require('typescript');
}

// -------------------------------------------------------------------------------------------
// Options
// -------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    prefix: 'wave',
    themes: [],
    variants: null,
    renameCn: true,
    write: false,
    check: false,
    allow: null,
    writeAllowlist: false,
    report: null,
    classFree: [],
    paths: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') options.root = resolve(argv[++i]);
    else if (arg === '--prefix') options.prefix = argv[++i];
    else if (arg === '--theme') options.themes.push(resolve(argv[++i]));
    else if (arg === '--variants') options.variants = resolve(argv[++i]);
    else if (arg === '--no-rename-cn') options.renameCn = false;
    else if (arg === '--write') options.write = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--allow') options.allow = resolve(argv[++i]);
    else if (arg === '--write-allowlist') options.writeAllowlist = true;
    else if (arg === '--report') options.report = resolve(argv[++i]);
    else if (arg === '--class-free') options.classFree.push(posix(argv[++i]).replace(/\/+$/, ''));
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else options.paths.push(arg);
  }
  if (options.write && options.check) throw new Error('--write and --check exclude each other');
  if (options.writeAllowlist && !options.check) throw new Error('--write-allowlist needs --check');
  if (!options.prefix || !/^[a-z][a-z0-9]*$/.test(options.prefix)) {
    throw new Error(
      `--prefix must be a Tailwind prefix (lowercase letters and digits), not "${options.prefix}"`,
    );
  }
  if (options.paths.length === 0) throw new Error('no files or directories given');
  return options;
}

/**
 * The `.ts`/`.tsx` files of `paths` (files or directories, relative to `root`), absolute and with
 * forward slashes, sorted; directories are walked without `__tests__` and `node_modules`, and a
 * declaration file is never one. `include(name)` widens or narrows the walk (a test of the file
 * name, default: every script).
 */
export function listFiles(root, paths, { tests = false } = {}) {
  const files = [];
  const visit = (path) => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) {
        if (name === 'node_modules' || (!tests && name === '__tests__')) continue;
        visit(join(path, name));
      }
    } else if (/\.(ts|tsx)$/.test(path) && !/\.d\.ts$/.test(path)) {
      files.push(posix(resolve(path)));
    }
  };
  for (const path of paths) visit(resolve(root, path));
  return [...new Set(files)].sort();
}

// -------------------------------------------------------------------------------------------
// Tailwind: which words are utilities
// -------------------------------------------------------------------------------------------

/**
 * A predicate `isUtility(word)` over the project's design system, loaded unprefixed: Tailwind's
 * default theme, the project's theme file(s) and variants, and Tailwind's utilities (resolved from
 * this repository, so the root needs no `node_modules`).
 */
export async function loadUtilityTest(root, { themes = [], variants = null } = {}) {
  const node = require('@tailwindcss/node');
  const themeFiles = themes.length
    ? themes
    : [join(root, 'src/styles/theme.css'), join(root, 'src/styles/tokens.css')]
        .filter(existsSync)
        .slice(0, 1);
  const variantsFile = variants ?? join(root, 'src/styles/variants.css');
  const css = [
    `@import '${posix(require.resolve('tailwindcss/theme.css'))}' theme(inline);`,
    ...themeFiles.map((file) => `@import '${posix(file)}';`),
    existsSync(variantsFile) ? `@import '${posix(variantsFile)}';` : '',
    `@import '${posix(require.resolve('tailwindcss/utilities.css'))}';`,
  ].join('\n');
  const designSystem = await node.__unstable__loadDesignSystem(css, { base: root });
  const cache = new Map();
  return (word) => {
    if (!cache.has(word)) {
      let utility;
      try {
        utility = designSystem.candidatesToCss([word])[0] != null;
      } catch {
        utility = false;
      }
      cache.set(word, utility);
    }
    return cache.get(word);
  };
}

/** `group`, `peer` and their named forms carry no CSS but are classes a variant selects by. */
export const MARKER = /^(?:group|peer)(?:\/[\w-]+)?$/;

// -------------------------------------------------------------------------------------------
// TypeScript program
// -------------------------------------------------------------------------------------------

/**
 * A program over `files` with the root's `tsconfig.json` options (and its files) when there is
 * one, else plain TSX options, so the checker resolves identifiers across modules.
 */
export function createProgram(ts, root, files) {
  const configPath = join(root, 'tsconfig.json');
  let options = {
    allowJs: false,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  let rootNames = files;
  if (existsSync(configPath)) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    options = parsed.options;
    rootNames = [...new Set([...parsed.fileNames.map(posix), ...files])];
  }
  return ts.createProgram({ rootNames, options: { ...options, noEmit: true } });
}

/** The source file of `file` in `program` (paths compared without case on every platform). */
export function sourceFileOf(program, file) {
  return (
    program.getSourceFile(file) ??
    program.getSourceFiles().find((sf) => posix(sf.fileName).toLowerCase() === file.toLowerCase())
  );
}

const SINK_CALLS = new Set(['cn', 'wcn', 'clsx', 'twMerge', 'cx']);
const SLOT_CLASS_ARGUMENT = new Map([
  ['renderSlot', 2],
  ['resolveSlot', 2],
  ['withPartClass', 1],
]);
const CLASS_NAME =
  /^(?:className|class|[a-zA-Z]+ClassName|[a-zA-Z]*Classes|classes|[a-z][a-zA-Z]*Class)$/;
const STABLE_REGISTRY = /ClassNames$/;
const RECIPE_MODULES = ['src/lib/styles.ts', 'src/lib/motion.ts'];
export const CHAIN_METHODS = new Set(['join', 'trim', 'filter', 'concat', 'trimEnd', 'trimStart']);

export function propertyNameText(ts, name) {
  if (!name) return undefined;
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isPrivateIdentifier(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }
  return undefined;
}

export function calleeName(ts, expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

/** `expression` without parentheses, type assertions and `satisfies`. */
export function stripped(ts, expression) {
  let e = expression;
  while (
    e &&
    (ts.isParenthesizedExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isSatisfiesExpression?.(e) ||
      ts.isTypeAssertionExpression?.(e))
  ) {
    e = e.expression;
  }
  return e;
}

/** The return expressions of a function (its expression body, or every `return` of its body). */
export function returnExpressions(ts, fn) {
  if (!fn.body) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node !== fn) return;
    if (ts.isReturnStatement(node) && node.expression) out.push(node.expression);
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return out;
}

/**
 * The class-value tracer: `trace(node, depth, ctx, keys)` follows `node` to the string literals it
 * can evaluate to and hands each to `addLiteral(node, ctx)`. `depth` 0 is a class value; n > 0 is a
 * map (or array) whose values n levels down are class values. `ctx` carries the parameters of the
 * functions a trace entered (a parameter maps to the call's argument) and `ctx.origin`, the sink a
 * trace started from. By default a map level reads every value of the map (a property of a map
 * typed as a record is any of its values); with `preciseProperties`, `keys` names the property (or
 * `'*'`) each level selects, so `options.conflictingClass.overrides` reads that property of the
 * object literals the trace reaches and no other.
 *
 * `resolveParameter(declaration, depth, ctx, trace, keys)` may trace the values of a parameter (or
 * a binding element) that no entered call maps (callbacks, helpers), and `resolveVariable` those of
 * a variable declared without an initializer (a `for…of` variable). `onMergeCall(call, ctx, trace)`
 * replaces the default for a `cn`/`wcn`/`clsx` call a trace reaches (every argument a class
 * value), `passThroughCalls` names calls whose arguments are traced as the call's value
 * (`expect.arrayContaining`), and `chainMethods` the methods whose receiver is the value (default:
 * `join`, `trim`, `filter`, `concat`, `trimEnd`, `trimStart`). With `standaloneSpans`, a template's
 * substitution is traced only where it is a whole token (whitespace or the template's edge on both
 * sides): one glued to text (`my-${name}`) is a fragment of a class, not a class. With
 * `mapCallbacks`, the elements of `list.map(fn)` (and `flatMap`) are `fn`'s return values.
 */
export function createTracer(
  ts,
  program,
  {
    addLiteral,
    resolveParameter,
    resolveVariable,
    onMergeCall,
    passThroughCalls = new Set(),
    chainMethods = CHAIN_METHODS,
    preciseProperties = false,
    standaloneSpans = false,
    mapCallbacks = false,
  },
) {
  const checker = program.getTypeChecker();
  const visited = new Set();
  let contextIds = 0;
  const projectFile = (node) => {
    const sf = node.getSourceFile();
    return sf && !sf.isDeclarationFile && !/[\\/]node_modules[\\/]/.test(sf.fileName);
  };

  const resolveSymbol = (node) => {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      try {
        symbol = checker.getAliasedSymbol(symbol);
      } catch {
        // An unresolved alias: keep the alias symbol.
      }
    }
    return symbol;
  };

  /** A new context: the parameters of an entered call, and the sink the trace started from. */
  const newContext = (params, origin) => ({ id: ++contextIds, params, origin });

  /** The keys one map level deeper: `head` first (precise mode only). */
  const deeper = (head, keys, depth) =>
    preciseProperties ? [head, ...(keys ?? Array.from({ length: depth }, () => '*'))] : undefined;
  /** The literal key of an element access (`map['x']`, `tuple[1]`), else any. */
  const elementKey = (argument) =>
    argument &&
    (ts.isStringLiteral(argument) ||
      ts.isNoSubstitutionTemplateLiteral(argument) ||
      ts.isNumericLiteral(argument))
      ? argument.text
      : '*';

  const trace = (node, depth = 0, ctx = null, keys = undefined) => {
    if (!node) return;
    const key =
      `${node.pos}:${node.end}:${posix(node.getSourceFile().fileName)}:${depth}:${ctx?.id ?? 0}` +
      (keys ? `:${keys.join('\u0001')}` : '');
    if (visited.has(key)) return;
    visited.add(key);

    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression?.(node) ||
      ts.isSatisfiesExpression?.(node)
    ) {
      return trace(node.expression, depth, ctx, keys);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (depth === 0) addLiteral(node, ctx);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      if (depth === 0) addLiteral(node, ctx);
      node.templateSpans.forEach((span, index) => {
        if (standaloneSpans) {
          // Only a substitution that is a whole class token: `my-${name}` holds a fragment.
          const before = index === 0 ? node.head.text : node.templateSpans[index - 1].literal.text;
          const after = span.literal.text;
          if (!(before === '' || /\s$/.test(before)) || !(after === '' || /^\s/.test(after)))
            return;
        }
        trace(span.expression, depth, ctx, keys);
      });
      return;
    }
    if (ts.isConditionalExpression(node)) {
      trace(node.whenTrue, depth, ctx, keys);
      trace(node.whenFalse, depth, ctx, keys);
      return;
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.CommaToken) {
        trace(node.right, depth, ctx, keys);
      } else if (
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken ||
        op === ts.SyntaxKind.PlusToken
      ) {
        trace(node.left, depth, ctx, keys);
        trace(node.right, depth, ctx, keys);
      }
      return;
    }
    if (ts.isArrayLiteralExpression(node)) {
      // At depth 0 a clsx array (its elements are class values); deeper, a tuple an element
      // access reads (`OFFSETS[size][index]`), one level down.
      if (depth === 0) {
        for (const element of node.elements) {
          if (ts.isSpreadElement(element)) trace(element.expression, 1, ctx, deeper('*', [], 0));
          else trace(element, 0, ctx);
        }
        return;
      }
      const head = keys?.[0] ?? '*';
      const rest = keys?.slice(1);
      node.elements.forEach((element, index) => {
        if (ts.isSpreadElement(element)) trace(element.expression, depth, ctx, keys);
        else if (head === '*' || !/^\d+$/.test(head) || Number(head) === index) {
          trace(element, depth - 1, ctx, rest);
        }
      });
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      if (depth > 0) {
        const head = keys?.[0] ?? '*';
        const rest = keys?.slice(1);
        for (const property of node.properties) {
          const name = property.name && propertyNameText(ts, property.name);
          const selected = head === '*' || name === head || name === undefined;
          if (ts.isPropertyAssignment(property)) {
            if (selected) trace(property.initializer, depth - 1, ctx, rest);
          } else if (ts.isShorthandPropertyAssignment(property)) {
            if (selected) {
              traceSymbol(
                checker.getShorthandAssignmentValueSymbol(property),
                depth - 1,
                ctx,
                rest,
              );
            }
          } else if (ts.isSpreadAssignment(property)) trace(property.expression, depth, ctx, keys);
        }
      } else {
        // clsx object syntax: the keys are the classes.
        for (const property of node.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isStringLiteral(property.name) || ts.isNoSubstitutionTemplateLiteral(property.name))
          ) {
            addLiteral(property.name, ctx);
          } else if (
            ts.isPropertyAssignment(property) &&
            ts.isComputedPropertyName(property.name)
          ) {
            trace(property.name.expression, 0, ctx);
          }
        }
      }
      return;
    }
    if (ts.isIdentifier(node)) {
      if (ctx) {
        const symbol = checker.getSymbolAtLocation(node);
        const declaration = symbol?.valueDeclaration;
        if (declaration && ctx.params?.has(declaration)) {
          const { argument, ctx: outer, rest } = ctx.params.get(declaration);
          if (rest) {
            for (const each of argument) trace(each, Math.max(depth - 1, 0), outer, keys?.slice(1));
            return;
          }
          return trace(argument, depth, outer, keys);
        }
      }
      return traceSymbol(resolveSymbol(node), depth, ctx, keys);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const symbol = resolveSymbol(node.name);
      if (
        symbol?.declarations?.some(
          (d) => ts.isPropertyAssignment(d) || ts.isShorthandPropertyAssignment(d),
        )
      ) {
        return traceSymbol(symbol, depth, ctx, keys);
      }
      // A property of a map typed as a record: read every value of the map (or, precise, the
      // property of that name).
      return trace(node.expression, depth + 1, ctx, deeper(node.name.text, keys, depth));
    }
    if (ts.isElementAccessExpression(node)) {
      return trace(
        node.expression,
        depth + 1,
        ctx,
        deeper(elementKey(node.argumentExpression), keys, depth),
      );
    }
    if (ts.isCallExpression(node)) {
      return traceCall(node, depth, ctx, keys);
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      // A class function passed as a value (`className={(state) => …}`): its returns.
      for (const expression of returnExpressions(ts, node)) trace(expression, depth, ctx, keys);
    }
  };

  const traceSymbol = (symbol, depth, ctx, keys) => {
    if (!symbol) return;
    for (const declaration of symbol.declarations ?? []) {
      if (!projectFile(declaration)) continue;
      if (
        ts.isVariableDeclaration(declaration) ||
        ts.isParameter(declaration) ||
        ts.isBindingElement(declaration) ||
        ts.isPropertyAssignment(declaration) ||
        ts.isPropertyDeclaration(declaration) ||
        ts.isEnumMember(declaration)
      ) {
        if (declaration.initializer) trace(declaration.initializer, depth, ctx, keys);
        // A `let` assigned later (`colorClass = '…'`): every assignment in its scope.
        if (ts.isVariableDeclaration(declaration)) {
          for (const right of assignmentsTo(symbol, declaration)) trace(right, depth, ctx, keys);
          if (!declaration.initializer && resolveVariable) {
            resolveVariable(declaration, depth, ctx, trace, keys);
          }
        }
        if ((ts.isParameter(declaration) || ts.isBindingElement(declaration)) && resolveParameter) {
          resolveParameter(declaration, depth, ctx, trace, keys);
        }
      } else if (ts.isShorthandPropertyAssignment(declaration)) {
        traceSymbol(checker.getShorthandAssignmentValueSymbol(declaration), depth, ctx, keys);
      }
    }
  };

  const assignmentCache = new Map();
  /** The right-hand sides of `name = …` assignments to the variable `symbol` declares. */
  const assignmentsTo = (symbol, declaration) => {
    if (assignmentCache.has(symbol)) return assignmentCache.get(symbol);
    const found = [];
    assignmentCache.set(symbol, found);
    const list = declaration.parent;
    if (!list || !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Var))) return found;
    let scope = list.parent;
    while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
    const visit = (node) => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) &&
        checker.getSymbolAtLocation(node.left) === symbol
      ) {
        found.push(node.right);
      }
      ts.forEachChild(node, visit);
    };
    if (scope) visit(scope);
    return found;
  };

  const functionOf = (expression) => {
    const symbol = resolveSymbol(
      ts.isPropertyAccessExpression(expression) ? expression.name : expression,
    );
    for (const declaration of symbol?.declarations ?? []) {
      if (!projectFile(declaration)) continue;
      if (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) {
        return declaration;
      }
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        return declaration.initializer;
      }
    }
    return undefined;
  };

  const traceCall = (call, depth, ctx, keys) => {
    const name = calleeName(ts, call.expression);
    if (name && SINK_CALLS.has(name) && depth === 0) {
      if (onMergeCall) onMergeCall(call, ctx, trace);
      else for (const argument of call.arguments) trace(argument, 0, ctx);
      return;
    }
    if (name && passThroughCalls.has(name)) {
      for (const argument of call.arguments) trace(argument, depth, ctx, keys);
      return;
    }
    if (name === 'useMemo' || name === 'useCallback') {
      const fn = call.arguments[0];
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
        for (const expression of returnExpressions(ts, fn)) trace(expression, depth, ctx, keys);
      }
      return;
    }
    if (ts.isPropertyAccessExpression(call.expression)) {
      const method = call.expression.name.text;
      if (chainMethods.has(method)) {
        trace(call.expression.expression, depth, ctx, keys);
        if (method === 'concat') for (const a of call.arguments) trace(a, depth, ctx, keys);
        return;
      }
      if (mapCallbacks && (method === 'map' || method === 'flatMap')) {
        // The elements of a mapped array are the callback's returns (one level up for `map`).
        const fn = call.arguments[0];
        if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
          const mapped = method === 'map' && depth > 0;
          for (const expression of returnExpressions(ts, fn)) {
            trace(expression, mapped ? depth - 1 : depth, ctx, mapped ? keys?.slice(1) : keys);
          }
        }
        return;
      }
      if (method === 'split') {
        // A class string split into its words: the receiver is the class value.
        trace(call.expression.expression, Math.max(depth - 1, 0), ctx, keys?.slice(1));
        return;
      }
    }
    const fn = functionOf(call.expression);
    if (!fn) return;
    const params = new Map(ctx?.params ?? []);
    fn.parameters.forEach((parameter, index) => {
      if (parameter.dotDotDotToken) {
        params.set(parameter, { argument: call.arguments.slice(index), ctx, rest: true });
      } else if (call.arguments[index]) {
        params.set(parameter, { argument: call.arguments[index], ctx });
      }
    });
    const inner = newContext(params, ctx?.origin);
    for (const expression of returnExpressions(ts, fn)) trace(expression, depth, inner, keys);
  };

  return { trace, traceSymbol, resolveSymbol, newContext, checker, functionOf };
}

/**
 * Collects the class literals of `files`: a Map of literal node -> { file }. `report` gathers the
 * traces that leave the file set (`outside`) and the files missing from the program (`errors`).
 */
export function collectClassLiterals(ts, program, files, report) {
  const fileSet = new Set(files.map((f) => f.toLowerCase()));
  const literals = new Map();
  const { trace } = createTracer(ts, program, {
    addLiteral: (node) => {
      const file = posix(node.getSourceFile().fileName);
      if (!fileSet.has(file.toLowerCase())) {
        const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
        report.outside.add(`${file}:${line}`);
        return;
      }
      literals.set(node, { file });
    },
  });

  for (const file of files) {
    const sf = sourceFileOf(program, file);
    if (!sf) {
      report.errors.push(`${file}: not in the program`);
      continue;
    }
    const recipe = RECIPE_MODULES.some((m) => file.toLowerCase().endsWith(m.toLowerCase()));
    const isTopLevel = (declaration) => ts.isSourceFile(declaration.parent?.parent?.parent);
    const inRecipe = (assignment) => {
      // A property of a top-level object literal of a recipe module (nested maps included).
      let node = assignment;
      while (node && !ts.isVariableDeclaration(node)) node = node.parent;
      return Boolean(node && isTopLevel(node));
    };
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(ts, node.expression);
        if (name && SINK_CALLS.has(name)) for (const argument of node.arguments) trace(argument);
        if (name && SLOT_CLASS_ARGUMENT.has(name)) {
          trace(node.arguments[SLOT_CLASS_ARGUMENT.get(name)]);
        }
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          /^(add|remove|toggle|replace|contains)$/.test(name) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          node.expression.expression.name.text === 'classList'
        ) {
          for (const argument of node.arguments.slice(0, name === 'toggle' ? 1 : undefined)) {
            trace(argument);
          }
        }
      } else if (ts.isJsxAttribute(node)) {
        const name = propertyNameText(ts, node.name);
        if (name && CLASS_NAME.test(name) && !STABLE_REGISTRY.test(name) && node.initializer) {
          trace(
            ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer,
          );
        }
      } else if (ts.isPropertyAssignment(node)) {
        const name = propertyNameText(ts, node.name);
        if (
          (name && CLASS_NAME.test(name) && !STABLE_REGISTRY.test(name)) ||
          (recipe && inRecipe(node))
        ) {
          trace(node.initializer);
        }
      } else if ((ts.isParameter(node) || ts.isBindingElement(node)) && node.initializer) {
        const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
        const prop =
          ts.isBindingElement(node) && node.propertyName
            ? propertyNameText(ts, node.propertyName)
            : undefined;
        if ((name && CLASS_NAME.test(name)) || (prop && CLASS_NAME.test(prop))) {
          trace(node.initializer);
        }
      } else if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name)) {
        const name = node.name.text;
        if (
          (CLASS_NAME.test(name) && !STABLE_REGISTRY.test(name)) ||
          (recipe && isTopLevel(node))
        ) {
          trace(node.initializer, 0);
          if (ts.isObjectLiteralExpression(stripped(ts, node.initializer))) {
            trace(node.initializer, 1);
          }
        }
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.name.text === 'className'
      ) {
        trace(node.right);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return literals;
}

// -------------------------------------------------------------------------------------------
// Rewriting
// -------------------------------------------------------------------------------------------

/** Prefixes the utility words of one chunk of literal text; reports glued words at its edges. */
export function prefixChunk(
  text,
  { prefix, isUtility, gluedStart, gluedEnd, onGlued, onWord, skip = () => false },
) {
  const parts = text.split(/(\s+)/);
  return parts
    .map((part, index) => {
      if (!part || /^\s+$/.test(part)) return part;
      const first = index === 0;
      const last = index === parts.length - 1;
      if ((first && gluedStart) || (last && gluedEnd)) {
        if (isUtility(part) || MARKER.test(part)) onGlued(part);
        return part;
      }
      if (part.startsWith(`${prefix}:`)) return part;
      if ((MARKER.test(part) || isUtility(part)) && !skip(part)) {
        onWord(part);
        return `${prefix}:${part}`;
      }
      return part;
    })
    .join('');
}

function rewriteLiteral(ts, node, source, options, stats) {
  const edits = [];
  const sf = node.getSourceFile();
  const line = () => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const where = `${posix(relative(options.root, sf.fileName))}:${line()}`;
  const chunk = (start, end, gluedStart, gluedEnd) => {
    const raw = source.slice(start, end);
    if (raw.includes('\\')) {
      stats.escaped.push(where);
      return;
    }
    const next = prefixChunk(raw, {
      prefix: options.prefix,
      isUtility: options.isUtility,
      gluedStart,
      gluedEnd,
      onGlued: (word) => stats.glued.push(`${where} ${word}`),
      onWord: (word) => {
        stats.words += 1;
        stats.unique.add(word);
      },
    });
    if (next !== raw) edits.push({ start, end, text: next });
  };
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    chunk(node.getStart() + 1, node.end - 1, false, false);
  } else if (ts.isTemplateExpression(node)) {
    const head = node.head;
    chunk(head.getStart() + 1, head.end - 2, false, true);
    node.templateSpans.forEach((span, index) => {
      const literal = span.literal;
      const isTail = index === node.templateSpans.length - 1;
      chunk(literal.getStart() + 1, literal.end - (isTail ? 1 : 2), true, !isTail);
    });
  }
  return edits;
}

/**
 * Renames the internal merge: `import { cn } from '…/lib/cn'` (or `'./cn'`) and its references
 * become `wcn`; `lib/cn.ts` itself and the barrels are left alone.
 */
export function renameCn(ts, sf, checker) {
  const edits = [];
  if (/[\\/]lib[\\/]cn\.ts$/.test(sf.fileName) || /[\\/]index\.ts$/.test(sf.fileName)) {
    return edits;
  }
  let importSymbol;
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    if (!/(^|\/)lib\/cn$|^\.\.?\/cn$/.test(statement.moduleSpecifier.text)) continue;
    const named = statement.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) continue;
    for (const element of named.elements) {
      if ((element.propertyName ?? element.name).text === 'cn' && element.name.text === 'cn') {
        const alreadyWcn = named.elements.some((other) => other.name.text === 'wcn');
        edits.push(
          alreadyWcn
            ? removeImportSpecifier(sf, named, element)
            : { start: element.name.getStart(), end: element.name.end, text: 'wcn' },
        );
        importSymbol = checker.getSymbolAtLocation(element.name);
      }
    }
  }
  if (!importSymbol) return edits;
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === 'cn' && !ts.isImportSpecifier(node.parent)) {
      if (checker.getSymbolAtLocation(node) === importSymbol) {
        edits.push({ start: node.getStart(), end: node.end, text: 'wcn' });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return edits;
}

/** The edit that removes `element` (and its comma) from a named import list. */
function removeImportSpecifier(sf, named, element) {
  const text = sf.getFullText();
  const index = named.elements.indexOf(element);
  const start = element.getStart();
  let end = element.end;
  const rest = text.slice(end);
  const comma = /^\s*,\s*/.exec(rest);
  if (comma && index < named.elements.length - 1) end += comma[0].length;
  else if (index > 0) {
    const before = text.slice(0, start);
    const lead = /,\s*$/.exec(before);
    if (lead) return { start: start - lead[0].length, end, text: '' };
  }
  return { start, end, text: '' };
}

/** Applies non-overlapping `{ start, end, text }` edits to `text`. */
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => b.start - a.start || b.end - a.end);
  let out = text;
  let lastStart = Infinity;
  for (const edit of sorted) {
    if (edit.end > lastStart) throw new Error('overlapping edits');
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    lastStart = edit.start;
  }
  return out;
}

// -------------------------------------------------------------------------------------------
// The compile check: unprefixed utility words in any string literal
// -------------------------------------------------------------------------------------------

/**
 * Every whitespace-separated word of every string literal of `files` that Tailwind compiles as an
 * unprefixed utility (or a `group`/`peer` marker), with its places (`file:line:start`): what a
 * prefixed build drops. Module specifiers and literal types are not class strings.
 */
export function unprefixedWords(ts, files, isUtility, prefix) {
  const found = new Map();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const visit = (node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        if (
          !ts.isImportDeclaration(node.parent) &&
          !ts.isExportDeclaration(node.parent) &&
          !ts.isExternalModuleReference?.(node.parent) &&
          !ts.isLiteralTypeNode(node.parent)
        ) {
          for (const word of node.text.split(/\s+/)) {
            if (!word || word.startsWith(`${prefix}:`)) continue;
            if (MARKER.test(word) || isUtility(word)) {
              const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
              if (!found.has(word)) found.set(word, []);
              found.get(word).push(`${posix(file)}:${line}:${node.getStart()}`);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return found;
}

/**
 * The words of a class literal (a string, or a template's text pieces), each with `glued`: whether
 * it touches a substitution (`p-${n}`, `${gate}bg-primary`), so that only part of it is in the
 * source.
 */
export function literalWords(ts, node) {
  const pieces = ts.isTemplateExpression(node)
    ? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)]
    : [node.text];
  const words = [];
  pieces.forEach((piece, index) => {
    const parts = piece.split(/\s+/);
    parts.forEach((word, i) => {
      if (!word) return;
      const glued = (i === 0 && index > 0) || (i === parts.length - 1 && index < pieces.length - 1);
      words.push({ word, glued });
    });
  });
  return words;
}

/**
 * The words of the string literals of `file` (comments, imports and literal types aside) that hold
 * `<prefix>:` anywhere, each with its line.
 */
export function prefixedWordsOf(ts, file, prefix) {
  const text = readFileSync(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const visit = (node) => {
    if (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isExportDeclaration(node.parent) &&
      !ts.isLiteralTypeNode(node.parent)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      for (const word of node.text.split(/\s+/)) {
        if (word.includes(`${prefix}:`)) found.push([word, line]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/**
 * Whether `word` holds `<prefix>:` other than at its start: after a variant (`hover:wave:bg-x`,
 * `wave:wave:p-4`), an important mark (`!wave:p-4`) or a bracket. Tailwind reads a prefix only as
 * the first part of a class, so such a word compiles to nothing.
 */
export function hasMisplacedPrefix(word, prefix) {
  const marker = `${prefix}:`;
  for (let at = word.indexOf(marker, 1); at !== -1; at = word.indexOf(marker, at + 1)) {
    if (!/[a-z0-9_-]/i.test(word[at - 1])) return true;
  }
  return false;
}

/**
 * The two-tier compile check of `files` (absolute) under `root`, for `prefix`. `allow` maps a file
 * (relative to `root`, forward slashes) to the words its untraced literals may hold. Tier 1 also
 * fails a prefixed word that compiles to nothing: one whose prefix is not at its start
 * (`hover:wave:bg-primary`, `!wave:p-4`), or whose utility is unknown (`wave:bg-primry`), each
 * with a reason (`prefixedFailures`; a word glued to a substitution is only checked for the
 * first). Returns the tier-1 failures (`file:line word`), the tier-2 failures, the tier-2 pairs found (`untraced`:
 * file to sorted words, the allowlist's shape; `untracedPlaces`: the same with each word's
 * lines), the allowlist pairs that no longer occur (`stale`, reported, never a failure), and how
 * much the check read: the class literals the tracing reached and their prefixed words.
 *
 * `classFree` names directories (relative to `root`) that hold no class string: the CSS build
 * scans none of them (`src/hooks`), so a prefixed word in any string literal there compiles to
 * nothing and fails (`prefixedFailures`); their unprefixed utility words are checked as above.
 */
export function checkFiles(ts, { root, files, isUtility, prefix, allow = {}, classFree = [] }) {
  const program = createProgram(ts, root, files);
  const traced = collectClassLiterals(ts, program, files, { outside: new Set(), errors: [] });
  const tracedRanges = new Map();
  const tracedFailures = [];
  const prefixedFailures = [];
  const unscanned = (rel) => classFree.find((dir) => rel.startsWith(`${dir}/`));
  for (const file of files) {
    const rel = posix(relative(root, file));
    const dir = unscanned(rel);
    if (!dir) continue;
    for (const [word, line] of prefixedWordsOf(ts, file, prefix)) {
      prefixedFailures.push(
        `${rel}:${line} ${word} (in ${dir}, which the CSS build does not scan: it compiles to nothing)`,
      );
    }
  }
  let classWords = 0;
  for (const [node, { file }] of traced) {
    const rel = posix(relative(root, file));
    if (!tracedRanges.has(rel)) tracedRanges.set(rel, []);
    tracedRanges.get(rel).push([node.getStart(), node.end]);
    const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
    for (const { word, glued } of literalWords(ts, node)) {
      const place = `${rel}:${line} ${word}`;
      // A prefixed word of a directory the CSS build does not scan is reported above.
      if (unscanned(rel) && word.includes(`${prefix}:`)) continue;
      if (hasMisplacedPrefix(word, prefix)) {
        prefixedFailures.push(`${place} (${prefix}: not at the start: it compiles to nothing)`);
      } else if (word.startsWith(`${prefix}:`)) {
        classWords += 1;
        // The word without its prefix compiles in the unprefixed design system exactly when the
        // word compiles in the prefixed one. A word glued to a substitution cannot be read whole.
        const utility = word.slice(prefix.length + 1);
        if (!glued && !MARKER.test(utility) && !isUtility(utility)) {
          prefixedFailures.push(`${place} (compiles to nothing)`);
        }
      } else if (MARKER.test(word) || isUtility(word)) {
        tracedFailures.push(place);
      }
    }
  }
  const untraced = {};
  for (const [word, places] of unprefixedWords(ts, files, isUtility, prefix)) {
    for (const place of places) {
      const [, file, line, start] = /^(.*):(\d+):(\d+)$/.exec(place);
      const rel = posix(relative(root, file));
      const ranges = tracedRanges.get(rel) ?? [];
      if (ranges.some(([s, e]) => Number(start) >= s && Number(start) < e)) continue;
      untraced[rel] ??= {};
      (untraced[rel][word] ??= []).push(Number(line));
    }
  }
  const untracedFailures = Object.entries(untraced)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([rel, words]) =>
      Object.keys(words)
        .sort()
        .filter((word) => !(allow[rel] ?? []).includes(word))
        .map((word) => `${rel}:${words[word][0]} ${word}`),
    );
  const pairs = Object.fromEntries(
    Object.entries(untraced)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([rel, words]) => [rel, Object.keys(words).sort()]),
  );
  const checked = new Set(files.map((file) => posix(relative(root, file))));
  const stale = Object.entries(allow).flatMap(([rel, words]) =>
    checked.has(rel)
      ? words.filter((word) => !(pairs[rel] ?? []).includes(word)).map((word) => `${rel} ${word}`)
      : [],
  );
  // The lines of every tier-2 pair, for the report: file to word to lines.
  const untracedPlaces = Object.fromEntries(
    Object.keys(pairs).map((rel) => [
      rel,
      Object.fromEntries(pairs[rel].map((word) => [word, untraced[rel][word]])),
    ]),
  );
  return {
    tracedFailures,
    prefixedFailures,
    untracedFailures,
    untraced: pairs,
    untracedPlaces,
    stale,
    classLiterals: traced.size,
    classWords,
  };
}

/**
 * The allowlist file's text for `pairs` (file to words), as Prettier prints JSON: one line per
 * file while it fits in 100 columns, else one word per line.
 */
export function formatAllowlist(pairs) {
  const entries = Object.entries(pairs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, words]) => {
      const one = `  ${JSON.stringify(file)}: [${words.map((w) => JSON.stringify(w)).join(', ')}]`;
      if (one.length + 1 <= 100) return one;
      return `  ${JSON.stringify(file)}: [\n${words.map((w) => `    ${JSON.stringify(w)}`).join(',\n')}\n  ]`;
    });
  return entries.length === 0 ? '{}\n' : `{\n${entries.join(',\n')}\n}\n`;
}

// -------------------------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------------------------

/** Runs the codemod or the check; returns the exit code. `io` takes `log` and `error`. */
export async function main(argv = process.argv.slice(2), { io = console } = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    io.error(`prefix-codemod: ${error.message}`);
    return 2;
  }
  const ts = loadTypeScript();
  const files = listFiles(options.root, options.paths);
  const isUtility = await loadUtilityTest(options.root, {
    themes: options.themes,
    variants: options.variants,
  });

  if (options.check) {
    const defaultAllow = join(options.root, 'scripts/prefix-allowlist.json');
    const allowPath =
      options.allow ?? (options.writeAllowlist || existsSync(defaultAllow) ? defaultAllow : null);
    const allow =
      allowPath && existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : {};
    const result = checkFiles(ts, {
      root: options.root,
      files,
      isUtility,
      prefix: options.prefix,
      allow: options.writeAllowlist ? {} : allow,
      classFree: options.classFree,
    });
    if (options.report) {
      writeFileSync(
        options.report,
        `${JSON.stringify({ files: files.length, ...result }, null, 1)}\n`,
      );
    }
    const pairCount = Object.values(result.untraced).reduce((n, words) => n + words.length, 0);
    const wordCount = new Set(Object.values(result.untraced).flat()).size;
    if (options.writeAllowlist) {
      if (!allowPath) {
        io.error('prefix-codemod: --write-allowlist needs --allow <file>');
        return 2;
      }
      writeFileSync(allowPath, formatAllowlist(result.untraced));
      const classFailures = [...result.tracedFailures, ...result.prefixedFailures];
      io.log(
        `prefix-codemod --check: ${result.tracedFailures.length} unprefixed word(s) in class contexts; ` +
          `${result.prefixedFailures.length} ${options.prefix}: word(s) that compile to nothing; ` +
          `wrote ${pairCount} word-file pair(s) (${wordCount} word(s)) to ${posix(allowPath)}`,
      );
      for (const failure of classFailures.slice(0, 40)) io.log(`  ${failure}`);
      return classFailures.length ? 1 : 0;
    }
    io.log(
      `prefix-codemod --check: ${result.tracedFailures.length} unprefixed word(s) in class contexts; ` +
        `${result.prefixedFailures.length} ${options.prefix}: word(s) that compile to nothing; ` +
        `${result.untracedFailures.length} outside the allowlist elsewhere (${pairCount} word-file ` +
        `pair(s), ${wordCount} word(s), in other literals) of ${files.length} file(s); ` +
        `${result.classWords} prefixed class word(s) in ${result.classLiterals} class literal(s)`,
    );
    const failures = [
      ...result.tracedFailures,
      ...result.prefixedFailures,
      ...result.untracedFailures,
    ];
    for (const failure of failures.slice(0, 40)) io.log(`  ${failure}`);
    if (result.stale.length > 0) {
      io.log(
        `  (${result.stale.length} allowlist pair(s) no longer occur: ${result.stale.slice(0, 10).join(', ')})`,
      );
    }
    return failures.length ? 1 : 0;
  }

  const program = createProgram(ts, options.root, files);
  const checker = program.getTypeChecker();
  const report = { outside: new Set(), errors: [] };
  const literals = collectClassLiterals(ts, program, files, report);
  const stats = { words: 0, unique: new Set(), glued: [], escaped: [], renamed: 0, files: {} };
  const byFile = new Map();
  for (const [node, { file }] of literals) {
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(node);
  }
  for (const file of files) {
    const sf = sourceFileOf(program, file);
    if (!sf) continue;
    const source = sf.getFullText();
    const before = stats.words;
    const edits = [];
    for (const node of byFile.get(file) ?? []) {
      edits.push(...rewriteLiteral(ts, node, source, { ...options, isUtility }, stats));
    }
    if (options.renameCn) {
      const renames = renameCn(ts, sf, checker);
      stats.renamed += renames.length;
      edits.push(...renames);
    }
    if (edits.length === 0) continue;
    stats.files[posix(relative(options.root, file))] = stats.words - before;
    if (options.write) writeFileSync(file, applyEdits(source, edits));
  }
  const summary = {
    files: files.length,
    changedFiles: Object.keys(stats.files).length,
    words: stats.words,
    uniqueWords: stats.unique.size,
    renamed: stats.renamed,
    glued: stats.glued,
    escaped: stats.escaped,
    outside: [...report.outside],
    errors: report.errors,
    perFile: stats.files,
  };
  if (options.report) writeFileSync(options.report, `${JSON.stringify(summary, null, 1)}\n`);
  io.log(
    `prefix-codemod: ${summary.words} word(s) (${summary.uniqueWords} distinct) prefixed in ` +
      `${summary.changedFiles} of ${files.length} file(s)${options.write ? '' : ' (dry run)'}; ` +
      `${summary.renamed} cn rename(s), ${summary.glued.length} glued, ${summary.escaped.length} ` +
      `escaped, ${summary.outside.length} outside`,
  );
  for (const error of report.errors) io.error(`  ${error}`);
  return report.errors.length ? 1 : 0;
}

await runScript(import.meta.url, main);
