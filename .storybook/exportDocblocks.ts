/**
 * Storybook autodocs descriptions for components documented on their export (C-DOCS).
 *
 * The component JSDoc of a compound sits on its export, `export const Card = Object.assign(CardRoot,
 * { … })`, where it reaches the published `index.d.ts`. Storybook's docgen (react-docgen in
 * `@storybook/react-vite`) resolves that export to the `CardRoot` definition and reads only
 * `CardRoot`'s own docblock, so the autodocs page would show no description. The same happens to a
 * component exported through a wrapper call (`export const Option = markListboxElement(MemoOption,
 * …)`, `MemoOption = React.memo(OptionImpl)`) and to an overloaded function documented on its first
 * overload (`function BreadcrumbItem(props: …): …;`).
 *
 * {@link exportDocblockPlugin} runs right after Storybook's docgen plugin and gives such a
 * definition the docblock of the export instead, when docgen found none of its own. The rule for
 * the library is: one component JSDoc, on the export (or on the first overload); the definition it
 * wraps has none.
 */
import ts from 'typescript';
import type { Plugin } from 'vite';

/** The name of Storybook's react-docgen Vite plugin, which {@link exportDocblockPlugin} follows. */
export const STORYBOOK_DOCGEN_PLUGIN = 'storybook:react-docgen-plugin';

/** A docblock (`/** … *\/`) as react-docgen reads it (`getDocblock`): without the `*` gutter. */
function docblockText(comment: string): string {
  return comment
    .slice(2, -2)
    .replace(/^[ \t]*\*[ \t]?/gm, '')
    .trim();
}

/** The text of the last docblock right before `node`, or `null` (react-docgen's rule). */
export function leadingDocblock(source: string, node: ts.Node): string | null {
  const docblocks = (ts.getLeadingCommentRanges(source, node.getFullStart()) ?? [])
    .map((range) => source.slice(range.pos, range.end))
    .filter((comment) => /^\/\*\*\s/.test(comment));
  const last = docblocks.at(-1);
  return last === undefined ? null : docblockText(last) || null;
}

/** A top-level binding of a module: a `const` (its statement and initializer) or a function. */
type Binding =
  | { kind: 'const'; statement: ts.VariableStatement; init: ts.Expression | undefined }
  | { kind: 'function'; declarations: ts.FunctionDeclaration[] };

function collectBindings(file: ts.SourceFile): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          bindings.set(declaration.name.text, {
            kind: 'const',
            statement,
            init: declaration.initializer,
          });
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const existing = bindings.get(statement.name.text);
      if (existing?.kind === 'function') existing.declarations.push(statement);
      else bindings.set(statement.name.text, { kind: 'function', declarations: [statement] });
    }
  }
  return bindings;
}

/** `expression` without parentheses, type assertions, `satisfies` and non-null assertions. */
function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The name of the component definition an exported expression wraps: through the first argument of
 * each call (`Object.assign(Root, …)`, `React.memo(Impl)`, `markListboxElement(Memo, 'option')`)
 * and local constants initialized with such a call, down to a function declaration or a constant
 * holding an arrow or function expression. `undefined` for anything else.
 */
function wrappedDefinition(
  expression: ts.Expression,
  bindings: Map<string, Binding>,
  seen = new Set<string>(),
): string | undefined {
  const current = unwrapExpression(expression);
  if (ts.isCallExpression(current)) {
    const [first] = current.arguments;
    return first ? wrappedDefinition(first, bindings, seen) : undefined;
  }
  if (!ts.isIdentifier(current) || seen.has(current.text)) return undefined;
  seen.add(current.text);
  const binding = bindings.get(current.text);
  if (!binding) return undefined;
  if (binding.kind === 'function') return current.text;
  const init = binding.init && unwrapExpression(binding.init);
  if (!init) return undefined;
  if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return current.text;
  return ts.isCallExpression(init) ? wrappedDefinition(init, bindings, seen) : undefined;
}

/** The docblock a definition carries itself (react-docgen's component description). */
function ownDocblock(source: string, binding: Binding): string | null {
  if (binding.kind === 'const') return leadingDocblock(source, binding.statement);
  const implementation = binding.declarations.find((declaration) => declaration.body);
  return implementation ? leadingDocblock(source, implementation) : null;
}

const isExported = (statement: ts.Statement) =>
  ts.canHaveModifiers(statement) &&
  (ts.getModifiers(statement) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

/**
 * The component definitions of a module that have no docblock of their own but are documented on
 * their export, mapped to that docblock's text (react-docgen's format):
 * - `export const X = …(Definition, …)` with a docblock, where the expression wraps `Definition`
 *   (see the wrapping rule above);
 * - an overloaded function whose implementation has no docblock but whose first overload has one.
 */
export function exportDocblocks(source: string, fileName = 'component.tsx'): Map<string, string> {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const bindings = collectBindings(file);
  const found = new Map<string, string>();
  const add = (name: string, docblock: string | null) => {
    const binding = bindings.get(name);
    if (docblock && binding && !found.has(name) && !ownDocblock(source, binding)) {
      found.set(name, docblock);
    }
  };

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
    const docblock = leadingDocblock(source, statement);
    for (const declaration of statement.declarationList.declarations) {
      const definition =
        declaration.initializer && wrappedDefinition(declaration.initializer, bindings);
      if (definition) add(definition, docblock);
    }
  }
  for (const [name, binding] of bindings) {
    if (binding.kind === 'function' && binding.declarations.length > 1) {
      add(name, leadingDocblock(source, binding.declarations[0]));
    }
  }
  return found;
}

/**
 * The statements that give each definition of {@link exportDocblocks} its export's docblock as
 * its Storybook docgen description, when docgen left the description empty.
 */
export function docgenDescriptionPatch(source: string, fileName?: string): string {
  return [...exportDocblocks(source, fileName)]
    .map(
      ([name, docblock]) =>
        `;if (${name}.__docgenInfo && !${name}.__docgenInfo.description) ` +
        `${name}.__docgenInfo.description = ${JSON.stringify(docblock)};`,
    )
    .join('\n');
}

const COMPONENT_SOURCE = /[\\/]src[\\/]components[\\/](?:.+[\\/])?[^\\/]+\.tsx$/;

/**
 * A Vite plugin for Storybook: for every library component module, appends the
 * {@link docgenDescriptionPatch}. It must run after Storybook's docgen plugin, which appends the
 * `__docgenInfo` assignments it patches (see `withExportDocblocks` in `.storybook/main.ts`).
 */
export function exportDocblockPlugin(): Plugin {
  return {
    name: 'wave:export-docblocks',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!COMPONENT_SOURCE.test(file) || /[\\/]__tests__[\\/]/.test(file)) return null;
      const patch = docgenDescriptionPatch(code, file);
      // Appended code moves nothing, so the existing source map stays valid (`map: null`).
      return patch ? { code: `${code}\n${patch}\n`, map: null } : null;
    },
  };
}
