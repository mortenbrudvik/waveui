/**
 * Docs extraction: what a component page says about the export it documents, read from the
 * library's source with the TypeScript compiler API and checker. Build-time code: it runs in Node
 * and is never sent to the browser.
 *
 * One `ts.Program` is created per process, from the repository's root `tsconfig.json` (the
 * library's own program: its compiler options and its files), on the first call, and every later
 * call reuses it.
 *
 * Rules:
 * - **description**: the JSDoc text of the export (a compound's sits on its exported
 *   `Object.assign(…)` const, an overloaded function's on its first overload), without its tags.
 * - **props**: the properties of the export's props: the first parameter of its call signatures
 *   (a hook's options). Several plain signatures (Combobox's multi-select and single-select ones)
 *   and the members of a union of props (SpinButton's) are merged, a prop being required only
 *   where every form requires it; a generic signature counts only as the last one, the one
 *   `React.ComponentProps` reads (a polymorphic component's default-element props). Only
 *   properties declared in the library's own files are kept: the native attributes inherited from
 *   `@types/react` are left out and the element they belong to is named once, in `nativeElement`.
 *   A prop the library declares stays, also where it shadows a native one (Switch's `onClick`).
 *   A polymorphic component's `as` is `React.ElementType`, with the default element as its
 *   default.
 * - **prop types** read as the source writes them (`Slot<'span'>`, `React.ReactNode`, a callback
 *   without parentheses, an inline object on one line without its comments), with two
 *   exceptions: a union of literals is written out in its declared order (`Size` is
 *   `'extra-small' | 'small' | …`), and a type that mentions a type parameter is the checker's
 *   instantiated type (Combobox's `value` is `readonly string[] | string`). `undefined` is left
 *   out of an optional prop's type, and `never` out of a merged one.
 * - **parts**: the keys of the `slotProps` prop, then the members of a compound
 *   (`Menu.Item`, `Menu.Popover`, …: the keys of its `Object.assign(Root, { … })`).
 * - **classNames**: the export's `<name>ClassNames` constant of `src/lib/classNames.ts`
 *   (`buttonClassNames` for `Button`), or `null` when the registry has none (a hook, or Dialog,
 *   whose root renders no element).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { ComponentEntry } from '../catalog/catalog';

export interface PropDoc {
  name: string;
  /** The prop's type, as the source writes it, with a union of literals written out. */
  type: string;
  required: boolean;
  /** The text of the prop's `@default` tag, when it has one (`'outline'`, `false`). */
  default?: string;
  /** The prop's JSDoc text, without its tags; `''` when it has none. */
  description: string;
  /** The note of the prop's `@deprecated` tag (`Deprecated.` for a bare tag), when it has one. */
  deprecated?: string;
}

export interface ComponentDocs {
  description: string;
  props: PropDoc[];
  /** The `slotProps` keys, then a compound's members (`Menu.Item`). */
  parts: string[];
  /** The export's constant of the class-name registry, or `null` when it has none. */
  classNames: Record<string, string> | null;
  /**
   * The DOM element whose native attributes the props also take, left out of `props`
   * (`HTMLButtonElement`); absent when they take none.
   */
  nativeElement?: string;
}

/** Documents one export of a module: the export's name in, its docs out. */
export type DocsExtractor = (exportName: string) => ComponentDocs;

/** The module a {@link DocsExtractor} documents. */
export interface DocsSource {
  /** The module whose exports are documented (absolute path). */
  entryFile: string;
  /** The module of the `<name>ClassNames` constants; without one, every `classNames` is `null`. */
  classNamesFile?: string;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ROOT_TSCONFIG = resolve(REPO_ROOT, 'tsconfig.json');
const LIBRARY: Required<DocsSource> = {
  entryFile: resolve(REPO_ROOT, 'src/index.ts'),
  classNamesFile: resolve(REPO_ROOT, 'src/lib/classNames.ts'),
};

const TYPE_FORMAT =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;

/** A literal a union of literals is written out with (`'small'`, `16`, `true`). */
const LITERAL_FLAGS =
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.BigIntLiteral |
  ts.TypeFlags.EnumLiteral |
  ts.TypeFlags.BooleanLiteral;

function parseTsconfig(path: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(path, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error(`${path} cannot be read`);
  if (parsed.errors.length > 0) {
    const messages = parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    throw new Error(`${path}: ${messages.join('; ')}`);
  }
  return parsed;
}

/** Native attributes come from declaration files under `node_modules` (`@types/react`). */
function isForeign(declaration: ts.Declaration): boolean {
  const file = declaration.getSourceFile();
  return file.isDeclarationFile || /[\\/]node_modules[\\/]/.test(file.fileName);
}

function unwrap(expression: ts.Expression): ts.Expression {
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

/** The keys of `Object.assign(Root, { … })`, the members of a compound, as `<Export>.<Key>`. */
function compoundMembers(declaration: ts.Declaration | undefined, exportName: string): string[] {
  if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return [];
  const call = unwrap(declaration.initializer);
  if (
    !ts.isCallExpression(call) ||
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression) ||
    call.expression.expression.text !== 'Object' ||
    call.expression.name.text !== 'assign'
  ) {
    return [];
  }
  const members: string[] = [];
  for (const argument of call.arguments.slice(1)) {
    const object = unwrap(argument);
    if (!ts.isObjectLiteralExpression(object)) continue;
    for (const property of object.properties) {
      if (
        (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
      ) {
        members.push(`${exportName}.${property.name.text}`);
      }
    }
  }
  return members;
}

/**
 * Calls `visit` for each character of a printed type outside quotes, with its bracket depth
 * (`(`, `[`, `{`, `<`; the `>` of an arrow `=>` closes nothing). `visit` returning `true` stops.
 */
function scanType(text: string, visit: (index: number, depth: number) => boolean | void): void {
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (')]}'.includes(char) || (char === '>' && text[index - 1] !== '=')) depth -= 1;
    if (visit(index, depth)) return;
    if ('([{<'.includes(char)) depth += 1;
  }
}

/** The top-level members of a printed union (`A | (B | C)[]` is `A` and `(B | C)[]`). */
function unionMembers(text: string): string[] {
  const members: string[] = [];
  let start = 0;
  scanType(text, (index, depth) => {
    if (text[index] === '|' && depth === 0) {
      members.push(text.slice(start, index).trim());
      start = index + 1;
    }
  });
  members.push(text.slice(start).trim());
  return members.filter((member) => member !== '');
}

/** `text` without parentheses around all of it (`((x: string) => void)`). */
function unparenthesize(text: string): string {
  if (!text.startsWith('(') || !text.endsWith(')')) return text;
  let closesAtEnd = true;
  scanType(text, (index, depth) => {
    if (text[index] === ')' && depth === 0 && index < text.length - 1) {
      closesAtEnd = false;
      return true;
    }
  });
  return closesAtEnd ? text.slice(1, -1).trim() : text;
}

/** Whether a union member needs parentheses: a function or a conditional type at its top. */
function needsParentheses(text: string): boolean {
  let found = false;
  scanType(text, (index, depth) => {
    if (depth === 0 && ((text[index] === '=' && text[index + 1] === '>') || text[index] === '?')) {
      found = true;
      return true;
    }
  });
  return found;
}

function createExtractor(
  options: ts.CompilerOptions,
  rootNames: readonly string[],
  source: DocsSource,
): DocsExtractor {
  const program = ts.createProgram({ rootNames, options: { ...options, noEmit: true } });
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: true });

  const moduleExports = (file: string): Map<string, ts.Symbol> => {
    const sourceFile = program.getSourceFile(file);
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (!sourceFile || !moduleSymbol) throw new Error(`${file} is not a module of the program`);
    return new Map(checker.getExportsOfModule(moduleSymbol).map((s) => [s.name, s]));
  };
  const resolveAlias = (symbol: ts.Symbol) =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const docText = (symbol: ts.Symbol) =>
    ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
  const tagText = (symbol: ts.Symbol, name: string): string | undefined => {
    const tag = symbol.getJsDocTags(checker).find((candidate) => candidate.name === name);
    return tag && ts.displayPartsToString(tag.text).trim();
  };
  const print = (type: ts.Type) => checker.typeToString(type, undefined, TYPE_FORMAT);
  /** A type node on one line, without comments: `{ a?: A; b: B }` (Prettier's spacing). */
  const printNode = (node: ts.TypeNode) =>
    printer
      .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
      .replace(/\s+/g, ' ')
      .replace(/; \}/g, ' }')
      .trim();

  const entryFile = program.getSourceFile(source.entryFile)?.fileName ?? source.entryFile;
  const entryExports = moduleExports(source.entryFile);

  let registry: Map<string, Record<string, string>> | undefined;
  const classNamesOf = (exportName: string): Record<string, string> | null => {
    if (!source.classNamesFile) return null;
    if (!registry) {
      registry = new Map();
      for (const [name, exported] of moduleExports(source.classNamesFile)) {
        if (!name.endsWith('ClassNames')) continue;
        const record: Record<string, string> = {};
        const constant = checker.getTypeOfSymbol(resolveAlias(exported));
        for (const part of checker.getPropertiesOfType(constant)) {
          const value = checker.getTypeOfSymbol(part);
          if (value.isStringLiteral()) record[part.name] = value.value;
        }
        registry.set(name, record);
      }
    }
    const constant = `${exportName.charAt(0).toLowerCase()}${exportName.slice(1)}ClassNames`;
    return registry.get(constant) ?? null;
  };

  /** The type node of a prop's one declaration in the library, if it has exactly one. */
  const ownTypeNode = (symbol: ts.Symbol): ts.TypeNode | undefined => {
    const own = (symbol.declarations ?? []).filter((declaration) => !isForeign(declaration));
    const [declaration] = own;
    return own.length === 1 && declaration && ts.isPropertySignature(declaration)
      ? declaration.type
      : undefined;
  };

  const mentionsTypeParameter = (node: ts.Node): boolean => {
    if (ts.isTypeReferenceNode(node)) {
      const symbol = checker.getSymbolAtLocation(node.typeName);
      if (symbol && symbol.flags & ts.SymbolFlags.TypeParameter) return true;
    }
    return ts.forEachChild(node, mentionsTypeParameter) ?? false;
  };

  /** The members of a declared type in source order, through the aliases it names (`Size`). */
  const declaredOrder = (node: ts.TypeNode, depth = 0): readonly ts.Type[] => {
    if (depth > 8) return [];
    if (ts.isParenthesizedTypeNode(node)) return declaredOrder(node.type, depth + 1);
    if (ts.isUnionTypeNode(node)) return node.types.flatMap((n) => declaredOrder(n, depth + 1));
    if (ts.isTypeReferenceNode(node) && !node.typeArguments) {
      const symbol = checker.getSymbolAtLocation(node.typeName);
      const alias = symbol && resolveAlias(symbol).declarations?.find(ts.isTypeAliasDeclaration);
      if (alias && !alias.typeParameters) return declaredOrder(alias.type, depth + 1);
    }
    const type = checker.getTypeFromTypeNode(node);
    return type.isUnion() ? type.types : [type];
  };

  /** The union members one declaration of a prop gives its type; see the module's rules. */
  const typeMembers = (symbol: ts.Symbol): string[] => {
    const type = checker.getTypeOfSymbol(symbol);
    const node = ownTypeNode(symbol);
    const members = type.isUnion() ? type.types : [type];
    const isLiteral = (m: ts.Type) => !!(m.flags & LITERAL_FLAGS);
    if (
      members.some(isLiteral) &&
      members.every((m) => isLiteral(m) || m.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined))
    ) {
      const order = node ? declaredOrder(node) : [];
      const rank = (m: ts.Type) => {
        const index = order.indexOf(m);
        return index === -1 ? order.length : index;
      };
      return [...members].sort((a, b) => rank(a) - rank(b)).map(print);
    }
    const instantiated = unionMembers(print(type));
    if (!node) return instantiated;
    if (!mentionsTypeParameter(node)) return unionMembers(printNode(node));
    // A type parameter the signature leaves as it is (Accordion's `V`) changes nothing: the
    // source's spelling still holds.
    const defined = (members: string[]) =>
      members
        .filter((m) => m !== 'undefined')
        .map(unparenthesize)
        .join(' | ');
    const declared = unionMembers(print(checker.getTypeFromTypeNode(node)));
    return defined(declared) === defined(instantiated)
      ? unionMembers(printNode(node))
      : instantiated;
  };

  /** A prop's type from the declarations of every form of the props that has it. */
  const formatType = (symbols: readonly ts.Symbol[], optional: boolean): string => {
    const members: string[] = [];
    const seen = new Set<string>();
    for (const symbol of symbols) {
      for (const member of typeMembers(symbol)) {
        const key = unparenthesize(member);
        if (!seen.has(key)) {
          seen.add(key);
          members.push(member);
        }
      }
    }
    let kept = members.filter((member) => !(optional && member === 'undefined'));
    if (kept.length > 1) kept = kept.filter((member) => member !== 'never');
    if (kept.includes('true') && kept.includes('false')) {
      const at = Math.min(kept.indexOf('true'), kept.indexOf('false'));
      kept = kept.filter((member) => member !== 'true' && member !== 'false');
      kept.splice(at, 0, 'boolean');
    }
    if (kept.length === 0) return members[0] ?? 'never';
    if (kept.length === 1) return unparenthesize(kept[0]!);
    return kept
      .map((member) =>
        needsParentheses(member) && unparenthesize(member) === member ? `(${member})` : member,
      )
      .join(' | ');
  };

  /** `as` of `PolymorphicProps` (src/lib/polymorphic.ts). */
  const isPolymorphicAs = (property: ts.Symbol) =>
    property.name === 'as' &&
    (property.declarations ?? []).some(
      (declaration) =>
        !isForeign(declaration) &&
        ts.findAncestor(declaration, ts.isTypeAliasDeclaration)?.name.text === 'PolymorphicProps',
    );

  /** A declaration only there to refuse the prop in its form (`openItems?: never`). */
  const isPlaceholder = (symbol: ts.Symbol) => {
    const type = checker.getTypeOfSymbol(symbol);
    return (type.isUnion() ? type.types : [type]).every(
      (member) => member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Never),
    );
  };

  const propDoc = (declared: readonly ts.Symbol[], optional: boolean): PropDoc => {
    // The forms that take the prop speak for it before those that refuse it.
    const symbols = [
      ...declared.filter((symbol) => !isPlaceholder(symbol)),
      ...declared.filter(isPlaceholder),
    ];
    const [first] = symbols as [ts.Symbol];
    const firstTag = (name: string) =>
      symbols.map((symbol) => tagText(symbol, name)).find((text) => text !== undefined);
    let type: string;
    let defaultValue = firstTag('default');
    if (isPolymorphicAs(first)) {
      type = 'React.ElementType';
      // The instantiated `as` of the default-element signature is the default element.
      const element = checker.getNonNullableType(checker.getTypeOfSymbol(first));
      if (!defaultValue && element.isStringLiteral()) defaultValue = print(element);
    } else {
      type = formatType(symbols, optional);
    }
    const deprecated = firstTag('deprecated');
    return {
      name: first.name,
      type,
      required: !optional,
      ...(defaultValue ? { default: defaultValue } : {}),
      description: symbols.map(docText).find((text) => text !== '') ?? '',
      ...(deprecated !== undefined ? { deprecated: deprecated || 'Deprecated.' } : {}),
    };
  };

  /** The element of a native event handler prop (`MouseEventHandler<HTMLLabelElement>`). */
  const handlerElement = (property: ts.Symbol): string | undefined =>
    /^on[A-Z]/.test(property.name)
      ? /EventHandler<(\w+)>/.exec(print(checker.getTypeOfSymbol(property)))?.[1]
      : undefined;

  /**
   * The forms of an export's props: the first parameter of each plain call signature, else of
   * the last signature, and each member of a union of props.
   */
  const propsForms = (symbol: ts.Symbol): ts.Type[] => {
    const signatures = checker.getTypeOfSymbol(symbol).getCallSignatures();
    const plain = signatures.filter((signature) => !signature.getTypeParameters()?.length);
    const forms: ts.Type[] = [];
    for (const signature of plain.length > 0 ? plain : signatures.slice(-1)) {
      const [parameter] = signature.getParameters();
      if (!parameter) continue;
      const type = checker.getTypeOfSymbol(parameter);
      forms.push(...(type.isUnion() ? type.types : [type]));
    }
    return forms;
  };

  return (exportName) => {
    const exported = entryExports.get(exportName);
    if (!exported) throw new Error(`"${exportName}" is not exported by ${entryFile}`);
    const symbol = resolveAlias(exported);
    const isHook = /^use[A-Z]/.test(exportName);

    // Every property of every form, by name: its declarations and whether it is optional.
    const forms = propsForms(symbol);
    const merged = new Map<string, { symbols: ts.Symbol[]; optional: boolean; forms: number }>();
    for (const form of forms) {
      for (const property of checker.getPropertiesOfType(form)) {
        const optional = !!(property.flags & ts.SymbolFlags.Optional);
        const known = merged.get(property.name);
        if (known) {
          known.symbols.push(property);
          known.optional ||= optional;
          known.forms += 1;
        } else {
          merged.set(property.name, { symbols: [property], optional, forms: 1 });
        }
      }
    }

    const props: PropDoc[] = [];
    let nativeElement: string | undefined;
    let slotParts: string[] = [];
    for (const { symbols, optional, forms: count } of merged.values()) {
      const [first] = symbols as [ts.Symbol];
      const declarations = symbols.flatMap((s) => s.declarations ?? []);
      if (declarations.length === 0 || declarations.every(isForeign)) {
        nativeElement ??= handlerElement(first);
        continue;
      }
      props.push(propDoc(symbols, optional || count < forms.length));
      if (first.name === 'slotProps' && !isHook) {
        const parts = checker.getNonNullableType(checker.getTypeOfSymbol(first));
        slotParts = checker.getPropertiesOfType(parts).map((part) => part.name);
      }
    }

    return {
      description: docText(symbol),
      props,
      parts: isHook ? [] : [...slotParts, ...compoundMembers(symbol.valueDeclaration, exportName)],
      classNames: isHook ? null : classNamesOf(exportName),
      ...(nativeElement ? { nativeElement } : {}),
    };
  };
}

/**
 * A {@link DocsExtractor} for a module other than the library (a test fixture), in a program of
 * its own with the root `tsconfig.json`'s compiler options.
 */
export function createDocsExtractor(source: DocsSource): DocsExtractor {
  const roots = [source.entryFile, ...(source.classNamesFile ? [source.classNamesFile] : [])];
  return createExtractor(parseTsconfig(ROOT_TSCONFIG).options, roots, source);
}

let library: DocsExtractor | undefined;

/** The docs of a catalog entry's export of the library (`src/index.ts`). */
export function extractDocs(entry: ComponentEntry): ComponentDocs {
  if (!library) {
    const tsconfig = parseTsconfig(ROOT_TSCONFIG);
    library = createExtractor(tsconfig.options, tsconfig.fileNames, LIBRARY);
  }
  return library(entry.exportName);
}
