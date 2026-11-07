// @ts-check
/**
 * Splits chosen library modules into one module per group of top-level declarations, in the site's
 * client build only (website/BUDGET.md, "Lever: split the registries").
 *
 * Why: a bundler tree-shakes per statement across the whole build, then puts each module, whole,
 * in one chunk. A module that many islands use, such as the class-name registry
 * (`src/lib/classNames.ts`, 186 constants) or the icons (`src/lib/icons.tsx`), is therefore
 * rendered with every export that any of the 81 islands uses, and every page loads that union.
 * Split into parts, each declaration lands in the chunk of the islands that use it.
 *
 * How: the module's own id loads a facade that re-exports each exported value from its part
 * (`./icons.tsx?wave-split=3`); a part holds one strongly connected group of top-level
 * declarations (declarations that reference each other stay together, so no import cycle is
 * made), the import declarations it uses, and imports of the other parts it references. A
 * statement that only mutates declarations (`Thing.displayName = …`) goes with them. Types are
 * erased, so the facade re-exports values only. Every part evaluates after the parts it imports,
 * which is the order the original module's declarations already needed.
 *
 * Behaviour-neutral by construction: the same declarations, with the same text, evaluated once
 * each. The splitter refuses (throws) any top-level statement it cannot place, so a library change
 * that adds one fails the site build instead of changing behaviour. The library's `src` and `dist`
 * are not touched.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import ts from 'typescript';

export const SPLIT_QUERY = 'wave-split';

/**
 * @typedef {object} SplitPart
 * @property {number} index The part's number, in an order where each part follows those it imports.
 * @property {string[]} names The top-level value names the part declares.
 * @property {string} code The part's source.
 */

/**
 * @param {ts.Node} node
 * @param {ts.SyntaxKind} kind
 */
const hasModifier = (node, kind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((item) => item.kind === kind);

/** The names an identifier in this position does not reference (a key, a member, a label). */
function isReference(/** @type {ts.Identifier} */ node) {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent)) return parent.expression === node;
  if (ts.isQualifiedName(parent)) return parent.left === node;
  if (
    ts.isPropertyAssignment(parent) ||
    ts.isPropertyDeclaration(parent) ||
    ts.isPropertySignature(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isMethodSignature(parent) ||
    ts.isGetAccessorDeclaration(parent) ||
    ts.isSetAccessorDeclaration(parent) ||
    ts.isEnumMember(parent) ||
    ts.isJsxAttribute(parent)
  ) {
    return parent.name !== node;
  }
  if (ts.isBindingElement(parent)) return parent.propertyName !== node && parent.name !== node;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false;
  return true;
}

/**
 * Every identifier text a node references (an over-approximation: shadowing is ignored). JSX counts
 * as a reference to `React`, so a part keeps the import whichever JSX runtime compiles it.
 */
function references(/** @type {ts.Node} */ root) {
  /** @type {Set<string>} */
  const found = new Set();
  const visit = (/** @type {ts.Node} */ node) => {
    if (ts.isIdentifier(node) && isReference(node)) found.add(node.text);
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      found.add('React');
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

/** The statement's text without its `export` and `default` keywords. */
function declarationText(/** @type {ts.Statement} */ statement, /** @type {ts.SourceFile} */ file) {
  /** @type {readonly ts.Modifier[]} */
  const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
  const isExportKeyword = (/** @type {ts.Modifier} */ item) =>
    item.kind === ts.SyntaxKind.ExportKeyword || item.kind === ts.SyntaxKind.DefaultKeyword;
  if (!modifiers.some(isExportKeyword)) return statement.getText(file);
  const kept = modifiers.filter((item) => !isExportKeyword(item)).map((item) => item.getText(file));
  const rest = file.text.slice(modifiers[modifiers.length - 1].end, statement.end).trimStart();
  return [...kept, rest].join(' ');
}

/** Tarjan's strongly connected components, emitted so each follows the components it uses. */
function stronglyConnected(/** @type {number[][]} */ edges) {
  let next = 0;
  /** @type {number[]} */ const index = [];
  /** @type {number[]} */ const low = [];
  /** @type {boolean[]} */ const onStack = [];
  /** @type {number[]} */ const stack = [];
  /** @type {number[][]} */ const components = [];
  const connect = (/** @type {number} */ node) => {
    index[node] = low[node] = next++;
    stack.push(node);
    onStack[node] = true;
    for (const target of edges[node]) {
      if (index[target] === undefined) {
        connect(target);
        low[node] = Math.min(low[node], low[target]);
      } else if (onStack[target]) {
        low[node] = Math.min(low[node], index[target]);
      }
    }
    if (low[node] === index[node]) {
      /** @type {number[]} */ const component = [];
      let member;
      do {
        member = /** @type {number} */ (stack.pop());
        onStack[member] = false;
        component.push(member);
      } while (member !== node);
      components.push(component.sort((a, b) => a - b));
    }
  };
  for (let node = 0; node < edges.length; node++) if (index[node] === undefined) connect(node);
  return components;
}

/**
 * Splits a module's source (see the module comment). `fileName` is the module's file name, which
 * the facade and the parts use to name the parts (`./<fileName>?wave-split=<index>`).
 *
 * @param {string} source
 * @param {string} fileName
 * @returns {{ facade: string, parts: SplitPart[], exports: Map<string, { local: string, part: number }> }}
 *   `exports` maps each exported value name to its local name and part.
 */
export function splitModule(source, fileName) {
  const kind =
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const fail = (/** @type {string} */ message) => {
    throw new Error(`${fileName}: ${message} (website/plugins/splitModules.mjs)`);
  };

  /** @type {{ text: string, bindings: string[] }[]} */
  const imports = [];
  /** @type {string[]} */
  const facadeStatements = [];
  /** @type {{ statement: ts.Statement, names: string[], text: string }[]} */
  const nodes = [];
  /** @type {[local: string, exported: string][]} */
  const exportsList = [];

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) {
        facadeStatements.push(statement.getText(file));
        continue;
      }
      if (clause.isTypeOnly) continue;
      /** @type {string[]} */
      const bindings = [];
      if (clause.name) bindings.push(clause.name.text);
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) bindings.push(named.name.text);
      if (named && ts.isNamedImports(named)) {
        for (const element of named.elements)
          if (!element.isTypeOnly) bindings.push(element.name.text);
      }
      if (bindings.length > 0) imports.push({ text: statement.getText(file), bindings });
      continue;
    }
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isEmptyStatement(statement) ||
      (ts.isModuleDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.DeclareKeyword))
    ) {
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      if (statement.moduleSpecifier) {
        facadeStatements.push(statement.getText(file));
        continue;
      }
      const clause = statement.exportClause;
      if (!clause || !ts.isNamedExports(clause)) fail('cannot split this export statement');
      for (const element of /** @type {ts.NamedExports} */ (clause).elements) {
        if (element.isTypeOnly) continue;
        exportsList.push([
          (element.propertyName ?? element.name).getText(file),
          element.name.getText(file),
        ]);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals || !ts.isIdentifier(statement.expression)) {
        fail('cannot split `export default` of an expression');
      }
      exportsList.push([/** @type {ts.Identifier} */ (statement.expression).text, 'default']);
      continue;
    }
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
    if (hasModifier(statement, ts.SyntaxKind.DeclareKeyword)) continue;
    /** @type {string[]} */
    let names;
    if (ts.isVariableStatement(statement)) {
      names = statement.declarationList.declarations.map((declaration) => {
        if (!ts.isIdentifier(declaration.name)) fail('cannot split a destructuring declaration');
        return /** @type {ts.Identifier} */ (declaration.name).text;
      });
    } else if (
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      if (!statement.name) fail('cannot split an anonymous default declaration');
      if (ts.isFunctionDeclaration(statement) && !statement.body) continue; // an overload signature
      names = [/** @type {ts.Identifier} */ (statement.name).text];
    } else if (ts.isExpressionStatement(statement)) {
      names = [];
    } else {
      return fail(`cannot split a top-level ${ts.SyntaxKind[statement.kind]}`);
    }
    if (exported) for (const name of names) exportsList.push([name, isDefault ? 'default' : name]);
    nodes.push({ statement, names, text: declarationText(statement, file) });
  }

  /** @type {Map<string, number>} */
  const declaredBy = new Map();
  nodes.forEach((node, index) => {
    for (const name of node.names) {
      if (declaredBy.has(name)) {
        // A function overload implementation repeats its name; keep the first declaration.
        if (!ts.isFunctionDeclaration(node.statement)) fail(`\`${name}\` is declared twice`);
        continue;
      }
      declaredBy.set(name, index);
    }
  });

  // A `let` or `var` binding may be assigned by any declaration that names it, and an imported
  // binding cannot be assigned, so it shares a part with every declaration that uses it.
  /** @type {Set<string>} */
  const mutable = new Set();
  for (const node of nodes) {
    if (
      ts.isVariableStatement(node.statement) &&
      !(node.statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      for (const name of node.names) mutable.add(name);
    }
  }

  /** @type {Set<number>[]} */
  const uses = nodes.map(() => new Set());
  /** @type {Set<string>[]} */
  const referenced = nodes.map(() => new Set());
  nodes.forEach((node, index) => {
    for (const name of references(node.statement)) {
      referenced[index].add(name);
      const target = declaredBy.get(name);
      if (target === undefined || target === index) continue;
      uses[index].add(target);
      if (mutable.has(name)) uses[target].add(index);
    }
    if (node.names.length === 0) {
      if (uses[index].size === 0)
        fail('cannot split a top-level statement that declares and references nothing');
      // A statement that mutates declarations goes with them: an edge back from each makes them
      // one strongly connected group.
      for (const target of uses[index]) uses[target].add(index);
    }
  });

  const components = stronglyConnected(uses.map((set) => [...set]));
  /** @type {number[]} */
  const partOf = [];
  components.forEach((members, part) => {
    for (const member of members) partOf[member] = part;
  });
  const partId = (/** @type {number} */ part) => `./${fileName}?${SPLIT_QUERY}=${part}`;

  const parts = components.map((members, part) => {
    const own = new Set(members);
    /** @type {Set<string>} */
    const names = new Set();
    /** @type {Set<string>} */
    const used = new Set();
    for (const member of members) {
      for (const name of nodes[member].names) names.add(name);
      for (const name of referenced[member]) used.add(name);
    }
    /** @type {Map<number, Set<string>>} */
    const fromParts = new Map();
    for (const name of used) {
      const target = declaredBy.get(name);
      if (target === undefined || own.has(target)) continue;
      const targetPart = partOf[target];
      if (!fromParts.has(targetPart)) fromParts.set(targetPart, new Set());
      /** @type {Set<string>} */ (fromParts.get(targetPart)).add(name);
    }
    const lines = [
      ...imports
        .filter((item) => item.bindings.some((name) => used.has(name)))
        .map((item) => item.text),
      ...[...fromParts.entries()]
        .sort(([a], [b]) => a - b)
        .map(
          ([target, list]) => `import { ${[...list].sort().join(', ')} } from '${partId(target)}';`,
        ),
      ...members.map((member) => nodes[member].text),
    ];
    const declared = [...names];
    if (declared.length > 0) lines.push(`export { ${declared.join(', ')} };`);
    return { index: part, names: declared, code: `${lines.join('\n')}\n` };
  });

  const exportsMap = new Map(
    exportsList.map(([local, exported]) => {
      const target = declaredBy.get(local);
      if (target === undefined)
        return fail(`exports \`${local}\`, which it does not declare as a value`);
      return [exported, { local, part: partOf[target] }];
    }),
  );
  const facade = [
    ...facadeStatements,
    ...[...exportsMap].map(([exported, { local, part }]) => {
      const binding = local === exported ? local : `${local} as ${exported}`;
      return `export { ${binding} } from '${partId(part)}';`;
    }),
  ];
  return { facade: `${facade.join('\n')}\n`, parts, exports: exportsMap };
}

/** A file path with forward slashes, for comparing ids on Windows. */
const normalise = (/** @type {string} */ path) => path.replaceAll('\\', '/');

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * The Vite plugin: splits `files` (absolute paths) in the client build. `readFile` is for tests.
 *
 * Besides the facade, it rewrites every module that imports or re-exports names of a listed file
 * to take each name straight from its part (`import { a, b } from './icons'` becomes one import
 * per part), so the module graph holds only the parts a module uses: the site's chunking walks
 * that graph (`chunking.mjs`), and a walk through the facade would reach every part. A namespace
 * import or `export *` of a listed file keeps the facade.
 *
 * @param {{ files: string[], readFile?: (file: string) => string }} options
 * @returns {import('vite').Plugin}
 */
export function splitModules({ files, readFile = (file) => readFileSync(file, 'utf8') }) {
  const targets = new Map(files.map((file) => [normalise(file), file]));
  const stems = [...targets.keys()].map((key) => basename(key).replace(SOURCE_FILE, ''));
  /** @type {Map<string, ReturnType<typeof splitModule>>} */
  const cache = new Map();
  const split = (/** @type {string} */ key) => {
    let result = cache.get(key);
    if (!result) {
      const file = /** @type {string} */ (targets.get(key));
      result = splitModule(readFile(file), basename(file));
      cache.set(key, result);
    }
    return result;
  };
  /** The part of `key` that declares the exported value `name`, as an absolute id. */
  const partOfName = (/** @type {string} */ key, /** @type {string} */ name) => {
    const found = split(key).exports.get(name);
    return found && { id: `${key}?${SPLIT_QUERY}=${found.part}`, local: found.local };
  };
  return {
    name: 'waveui-split-modules',
    enforce: 'pre',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    buildStart() {
      cache.clear();
    },
    resolveId(source, importer) {
      const [path, query] = source.split('?');
      if (query === undefined || !new RegExp(`^${SPLIT_QUERY}=\\d+$`).test(query)) return undefined;
      const absolute =
        path.startsWith('./') && importer
          ? `${normalise(importer.split('?')[0]).replace(/[^/]*$/, '')}${path.slice(2)}`
          : normalise(path);
      return targets.has(absolute) ? `${absolute}?${query}` : undefined;
    },
    async transform(code, id) {
      const [path] = id.split('?');
      if (
        !SOURCE_FILE.test(path) ||
        targets.has(normalise(path)) ||
        path.includes('node_modules')
      ) {
        return undefined;
      }
      if (!stems.some((stem) => code.includes(stem))) return undefined;
      const kind = /x$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, kind);
      /** @type {{ start: number, end: number, text: string }[]} */
      const edits = [];
      for (const statement of file.statements) {
        const isImport = ts.isImportDeclaration(statement);
        const isReExport = ts.isExportDeclaration(statement) && statement.moduleSpecifier;
        if (!isImport && !isReExport) continue;
        const specifier = /** @type {ts.StringLiteral} */ (
          /** @type {ts.ImportDeclaration | ts.ExportDeclaration} */ (statement).moduleSpecifier
        ).text;
        if (!stems.some((stem) => specifier.includes(stem))) continue;
        const resolved = await this.resolve(specifier, id);
        const key = resolved && normalise(resolved.id.split('?')[0]);
        if (!key || !targets.has(key)) continue;

        /** @type {{ name: string, alias: string, text: string }[]} */
        const named = [];
        /** @type {ts.NodeArray<ts.ImportSpecifier | ts.ExportSpecifier>} */
        let elements;
        if (ts.isImportDeclaration(statement)) {
          const clause = statement.importClause;
          if (!clause || clause.isTypeOnly || !clause.namedBindings) continue;
          // A default import or a namespace import keeps the facade.
          if (clause.name || !ts.isNamedImports(clause.namedBindings)) continue;
          elements = clause.namedBindings.elements;
        } else {
          const declaration = /** @type {ts.ExportDeclaration} */ (statement);
          if (declaration.isTypeOnly || !declaration.exportClause) continue;
          if (!ts.isNamedExports(declaration.exportClause)) continue;
          elements = declaration.exportClause.elements;
        }
        for (const element of elements) {
          // A type is erased; leaving it out keeps the statement from importing the facade.
          if (element.isTypeOnly) continue;
          const name = (element.propertyName ?? element.name).text;
          named.push({ name, alias: element.name.text, text: element.getText(file) });
        }
        /** @type {Map<string, string[]>} */
        const byPart = new Map();
        /** @type {string[]} */
        const others = [];
        for (const { name, alias, text } of named) {
          const part = partOfName(key, name);
          // A name the file re-exports from another module stays on the original specifier.
          if (!part) {
            others.push(text);
            continue;
          }
          const binding = part.local === alias ? alias : `${part.local} as ${alias}`;
          if (!byPart.has(part.id)) byPart.set(part.id, []);
          /** @type {string[]} */ (byPart.get(part.id)).push(binding);
        }
        const keyword = isImport ? 'import' : 'export';
        const text = [
          ...[...byPart.entries()].map(
            ([part, bindings]) => `${keyword} { ${bindings.join(', ')} } from '${part}';`,
          ),
          ...(others.length > 0
            ? [`${keyword} { ${others.join(', ')} } from '${specifier}';`]
            : []),
        ].join(' ');
        edits.push({ start: statement.getStart(file), end: statement.end, text });
      }
      if (edits.length === 0) return undefined;
      let result = code;
      for (const edit of edits.reverse()) {
        result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
      }
      return { code: result, map: null };
    },
    load(id) {
      const [path, query] = id.split('?');
      const key = normalise(path);
      if (!targets.has(key)) return undefined;
      if (query === undefined) return split(key).facade;
      const match = new RegExp(`^${SPLIT_QUERY}=(\\d+)$`).exec(query);
      if (!match) return undefined;
      const part = split(key).parts[Number(match[1])];
      if (!part) throw new Error(`${path}: no part ${match[1]} (website/plugins/splitModules.mjs)`);
      return part.code;
    },
  };
}
