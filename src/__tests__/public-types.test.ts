// @vitest-environment node
/**
 * The public type surface (`button-provider#27`): every named type that a public declaration
 * refers to must be importable from the package entry (`src/index.ts`). A prop type, an `extends`
 * base, a parameter or return type — also one reached through an inferred type, such as a compound
 * component's `Object.assign` result or a hook's inferred return type — that the entry does not
 * export is declared without `export` in the rolled-up `dist/index.d.ts`, so consumers have to
 * spell it as an indexed access (`ToasterProps['position']`).
 *
 * {@link findUnexportedPublicTypes} walks the library program (`tsconfig.json`) with the
 * TypeScript compiler API, starting at the entry's exports. Only the structural helpers of
 * {@link INTERNAL_HELPERS} may stay internal; that list must stay current as well.
 */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AccordionBaseProps,
  AccordionMultipleProps,
  AccordionSingleProps,
  BreadcrumbItemAnchorProps,
  BreadcrumbItemButtonProps,
  BreadcrumbItemOwnProps,
  FieldContextValue,
  FieldControlIdClaim,
  NavItemAnchorProps,
  NavItemButtonProps,
  NavItemOwnProps,
  NavSubItemAnchorProps,
  NavSubItemButtonProps,
  NavSubItemOwnProps,
  SearchBoxInputProps,
  SearchBoxProps,
  SpinButtonInputProps,
  SpinButtonProps,
  ToasterProps,
  ToastPosition,
  TooltipAppearance,
  TooltipProps,
  UseRovingTabIndexOptions,
  WaveDir,
} from '../index';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

/** Named types (and classes/enums, which are types as well). */
const NAMED_TYPE =
  ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface | ts.SymbolFlags.Enum | ts.SymbolFlags.Class;

/**
 * The named types declared under `ownDir` that the exports of `entry` refer to (transitively) but
 * that `entry` does not export, as sorted `path/relative/to/ownDir#Name` labels.
 *
 * - Written types are read from the declarations (so an alias in an optional prop is not lost to
 *   the `| undefined` the checker adds); function and method bodies are skipped.
 * - Inferred types (an exported `const` without annotation, a function without a return type) are
 *   read from the checker: an alias or interface is followed to its declaration, a function type
 *   to its declaration, an anonymous object type (an object literal) member by member.
 * - Types declared outside `ownDir` (React, the DOM lib) are not walked; only their type arguments.
 *
 * Limit: the checker interns literal types, so an alias of a single literal (`type A = 'a'`) that
 * is reached only through an inferred type has no name left to report. Written types (the prop
 * interfaces and parameters) have no such limit.
 */
function findUnexportedPublicTypes(program: ts.Program, entry: string, ownDir: string): string[] {
  const checker = program.getTypeChecker();
  const entryFile = program.getSourceFile(entry);
  if (!entryFile) throw new Error(`${entry} is not part of the program`);
  const moduleSymbol = checker.getSymbolAtLocation(entryFile);
  if (!moduleSymbol) throw new Error(`${entry} is not a module`);

  const resolveAlias = (symbol: ts.Symbol): ts.Symbol =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const exported = new Set(checker.getExportsOfModule(moduleSymbol).map(resolveAlias));

  const pathOf = (node: ts.Node): string => relative(ownDir, node.getSourceFile().fileName);
  const isOwn = (node: ts.Node): boolean => {
    const path = pathOf(node);
    return !path.startsWith('..') && !isAbsolute(path) && !path.includes('node_modules');
  };

  const found = new Set<string>();
  const seenSymbols = new Set<ts.Symbol>();
  const seenTypes = new Set<ts.Type>();

  function visitSymbol(raw: ts.Symbol | undefined): void {
    if (!raw) return;
    const symbol = resolveAlias(raw);
    if (seenSymbols.has(symbol)) return;
    seenSymbols.add(symbol);
    const declarations = (symbol.declarations ?? []).filter(isOwn);
    if (declarations.length === 0) return;
    if (symbol.flags & NAMED_TYPE && !exported.has(symbol)) {
      found.add(`${pathOf(declarations[0]).split(sep).join('/')}#${symbol.name}`);
    }
    for (const declaration of declarations) visitNode(declaration);
  }

  function visitSignature(node: ts.SignatureDeclaration): void {
    node.typeParameters?.forEach(visitNode);
    for (const parameter of node.parameters) {
      if (parameter.type) visitNode(parameter.type);
      else visitType(checker.getTypeAtLocation(parameter));
    }
    if (node.type) {
      visitNode(node.type);
    } else {
      const signature = checker.getSignatureFromDeclaration(node);
      if (signature) visitType(checker.getReturnTypeOfSignature(signature));
    }
  }

  function nameOf(node: ts.EntityName | ts.Expression): ts.Node {
    if (ts.isQualifiedName(node)) return node.right;
    if (ts.isPropertyAccessExpression(node)) return node.name;
    return node;
  }

  function visitNode(node: ts.Node): void {
    // The signature only: parameters, type parameters and the (written or inferred) return type.
    if (ts.isFunctionLike(node)) {
      visitSignature(node);
      return;
    }
    // The written type, else the inferred one; never the initializer.
    if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
      if (node.type) visitNode(node.type);
      else visitType(checker.getTypeAtLocation(node.name));
      return;
    }
    if (ts.isTypeReferenceNode(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.typeName)));
    } else if (ts.isExpressionWithTypeArguments(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.expression)));
    } else if (ts.isTypeQueryNode(node)) {
      visitSymbol(checker.getSymbolAtLocation(nameOf(node.exprName)));
    }
    ts.forEachChild(node, visitNode);
  }

  function visitType(type: ts.Type): void {
    if (seenTypes.has(type)) return;
    seenTypes.add(type);
    if (type.aliasSymbol) {
      visitSymbol(type.aliasSymbol);
      type.aliasTypeArguments?.forEach(visitType);
      return;
    }
    if (type.isUnionOrIntersection()) {
      type.types.forEach(visitType);
      return;
    }
    if (!(type.flags & ts.TypeFlags.Object)) return;
    const symbol = type.getSymbol();
    if ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference) {
      checker.getTypeArguments(type as ts.TypeReference).forEach(visitType);
      visitSymbol(symbol);
      return;
    }
    if (symbol && symbol.flags & NAMED_TYPE) {
      visitSymbol(symbol);
      return;
    }
    const own = (symbol?.declarations ?? []).filter(isOwn);
    if (own.some((node) => ts.isFunctionLike(node) || ts.isTypeLiteralNode(node))) {
      visitSymbol(symbol);
      return;
    }
    // An anonymous object type (an object literal, a library mapped type): its members.
    for (const property of checker.getPropertiesOfType(type)) {
      visitType(checker.getTypeOfSymbol(property));
    }
    for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
      for (const signature of checker.getSignaturesOfType(type, kind)) {
        for (const parameter of signature.getParameters()) {
          visitType(checker.getTypeOfSymbol(parameter));
        }
        visitType(signature.getReturnType());
      }
    }
  }

  for (const symbol of exported) visitSymbol(symbol);
  return [...found].sort();
}

/**
 * Named types that public declarations refer to but that are deliberately not public API: they
 * name no concept of their own, and exporting them would make every rename a breaking change.
 * Each is a key union for an `Omit` (the handlers a composite routes to its focusable control) or
 * a mask whose members are all `undefined`/`never` (it only makes other props a type error).
 */
const INTERNAL_HELPERS: Record<string, string> = {
  'components/input/Checkbox.tsx#CheckboxControlHandlers':
    'handler keys omitted from the root props (routed to the checkbox control)',
  'components/input/Combobox.tsx#RoutedHandlers':
    'handler keys omitted from the root props (routed to the combobox input)',
  'components/input/Dropdown.tsx#RoutedHandlers':
    'handler keys omitted from the root props (routed to the combobox button)',
  'components/input/Switch.tsx#SwitchControlHandlers':
    'handler keys omitted from the root props (routed to the switch control)',
  'components/input/TagPicker.tsx#RoutedHandlers':
    'handler keys omitted from the root props (routed to the combobox input)',
  'components/navigation/Breadcrumb.tsx#NoAnchorOnlyAttributes':
    'mask: link-only attributes are a type error on items without `href`',
  'components/navigation/Nav.tsx#NoAnchorOnlyAttributes':
    'mask: link-only attributes are a type error on items without `href`',
  'components/table/DataGrid.tsx#NoDeprecatedSortProps':
    'mask: the 0.4 sort props are a type error next to the 0.5 sort API',
};

/** A program over virtual files (plus the default lib), for testing the walker itself. */
function createVirtualProgram(files: Record<string, string>, root: string): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    types: [],
  };
  const key = (path: string): string => path.replace(/\\/g, '/').toLowerCase();
  const virtual = new Map(
    Object.entries(files).map(([name, text]) => [key(resolve(root, name)), text] as const),
  );
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile, directoryExists } = host;
  host.getSourceFile = (fileName, languageVersion, ...rest) => {
    const text = virtual.get(key(fileName));
    return text === undefined
      ? getSourceFile.call(host, fileName, languageVersion, ...rest)
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  host.fileExists = (fileName) => virtual.has(key(fileName)) || fileExists.call(host, fileName);
  host.readFile = (fileName) => virtual.get(key(fileName)) ?? readFile.call(host, fileName);
  // Module resolution looks for the directory before it asks for `./widget.ts`.
  host.directoryExists = (path) =>
    key(path) === key(root) || (directoryExists?.call(host, path) ?? true);
  return ts.createProgram({ rootNames: [resolve(root, 'index.ts')], options, host });
}

describe('findUnexportedPublicTypes (the walker)', () => {
  it('finds unexported names in written, heritage, parameter and inferred positions', () => {
    const root = resolve(srcDir, '__virtual_public_types__');
    const program = createVirtualProgram(
      {
        'index.ts': [
          "export { Widget, Compound, useWidget, makeThing } from './widget';",
          "export type { WidgetProps, PublicName } from './widget';",
        ].join('\n'),
        'widget.ts': [
          "type OptionalAlias = 'a' | 'b';",
          'interface HiddenBase { hidden?: boolean }',
          'type ParamAlias = { x: number };',
          'type ReturnAlias = { y: string };',
          "type QueryTarget = 'q' | 'r';",
          "type BodyOnly = 'body';",
          "type Unreached = 'u';",
          "export type PublicName = 'p';",
          'const queried = { value: 1 as unknown as QueryTarget };',
          'export interface WidgetProps extends HiddenBase {',
          '  kind?: OptionalAlias;',
          '  name?: PublicName;',
          '  query?: typeof queried;',
          '}',
          "export function Widget(props: WidgetProps) { const local: BodyOnly = 'body'; return local + String(props.kind); }",
          'function Item(props: ParamAlias) { return props.x; }',
          'export const Compound = Object.assign(Widget, { Item });',
          "function makeReturn(): ReturnAlias { return { y: '' }; }",
          'export function useWidget() { return makeReturn(); }',
          'export const makeThing = () => ({ nested: makeReturn() });',
          'export type Unused = Unreached extends string ? 1 : 0;',
        ].join('\n'),
      },
      root,
    );

    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    expect(diagnostics).toEqual([]);
    expect(findUnexportedPublicTypes(program, resolve(root, 'index.ts'), root)).toEqual([
      'widget.ts#HiddenBase',
      'widget.ts#OptionalAlias',
      'widget.ts#ParamAlias',
      'widget.ts#QueryTarget',
      'widget.ts#ReturnAlias',
    ]);
  });
});

describe('public type surface (src/index.ts)', () => {
  // One program for both tests (building it takes a few seconds).
  let unexported: string[] | undefined;
  const getUnexported = (): string[] => {
    if (!unexported) {
      const config = ts.readConfigFile(resolve(srcDir, '../tsconfig.json'), ts.sys.readFile);
      if (config.error) {
        throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
      }
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(srcDir, '..'));
      const entry = resolve(srcDir, 'index.ts');
      const program = ts.createProgram({
        rootNames: [entry],
        options: { ...parsed.options, noEmit: true },
      });
      unexported = findUnexportedPublicTypes(program, entry, srcDir);
    }
    return unexported;
  };

  it('exports every named type that a public declaration refers to', () => {
    expect(getUnexported().filter((label) => !(label in INTERNAL_HELPERS))).toEqual([]);
  }, 60_000);

  it('lists only internal helpers that a public declaration still refers to', () => {
    const current = getUnexported();
    expect(Object.keys(INTERNAL_HELPERS).filter((label) => !current.includes(label))).toEqual([]);
  }, 60_000);

  // The compile-time half (`npm run typecheck`, tsconfig.dev.json): the names import from the
  // entry and are the types of the props that use them.
  it('the exported names are the types of the props that use them', () => {
    expectTypeOf<NonNullable<UseRovingTabIndexOptions['dir']>>().toEqualTypeOf<WaveDir>();
    expectTypeOf<
      NonNullable<FieldContextValue['controlIdClaim']>
    >().toEqualTypeOf<FieldControlIdClaim>();
    expectTypeOf<NonNullable<TooltipProps['appearance']>>().toEqualTypeOf<TooltipAppearance>();
    expectTypeOf<NonNullable<ToasterProps['position']>>().toEqualTypeOf<ToastPosition>();

    expectTypeOf<SearchBoxProps>().toExtend<SearchBoxInputProps>();
    expectTypeOf<SpinButtonProps>().toExtend<SpinButtonInputProps>();
    expectTypeOf<AccordionSingleProps>().toExtend<AccordionBaseProps>();
    expectTypeOf<AccordionMultipleProps>().toExtend<AccordionBaseProps>();
    expectTypeOf<BreadcrumbItemAnchorProps>().toExtend<BreadcrumbItemOwnProps>();
    expectTypeOf<BreadcrumbItemButtonProps>().toExtend<BreadcrumbItemOwnProps>();
    expectTypeOf<NavItemAnchorProps>().toExtend<NavItemOwnProps>();
    expectTypeOf<NavItemButtonProps>().toExtend<NavItemOwnProps>();
    expectTypeOf<NavSubItemAnchorProps>().toExtend<NavSubItemOwnProps>();
    expectTypeOf<NavSubItemButtonProps>().toExtend<NavSubItemOwnProps>();
  });
});
