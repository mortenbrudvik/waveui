// @vitest-environment node
/**
 * The Storybook docgen fallback of `.storybook/exportDocblocks.ts` and the library rule it relies
 * on (C-DOCS): a compound's component JSDoc is on its export, the definition it wraps has none,
 * and no story repeats it. Where `.storybook/main.ts` places the plugin is tested with the rest of
 * the Storybook configuration in scripts/__tests__/verify-storybook.test.mjs.
 */
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  docgenDescriptionPatch,
  exportDocblockPlugin,
  exportDocblocks,
  leadingDocblock,
} from '../exportDocblocks';

const entries = (map: Map<string, string>) => Object.fromEntries(map);

describe('exportDocblocks', () => {
  it('gives the root of an Object.assign compound the docblock of its export', () => {
    const source = [
      'const CardRoot = (props: CardProps) => null;',
      '/** The header. */',
      'const CardHeader = () => null;',
      '/**',
      ' * A surface that groups content.',
      ' *',
      ' * @example',
      ' * <Card />',
      ' */',
      'export const Card = /* @__PURE__ */ Object.assign(CardRoot, { Header: CardHeader });',
    ].join('\n');
    expect(entries(exportDocblocks(source))).toEqual({
      CardRoot: 'A surface that groups content.\n\n@example\n<Card />',
    });
  });

  it('follows wrapper calls and local constants to the definition', () => {
    const source = [
      'function OptionImpl(props: OptionProps) { return null; }',
      'const MemoOption = /* @__PURE__ */ React.memo(OptionImpl);',
      '/** An option. */',
      "export const Option: React.FC<OptionProps> = /* @__PURE__ */ markListboxElement(MemoOption, 'option') as never;",
      'const GroupImpl = function (props: GroupProps) { return null; };',
      '/** A group. */',
      'export const Group = (wrap(GroupImpl, 1)!);',
    ].join('\n');
    expect(entries(exportDocblocks(source))).toEqual({
      OptionImpl: 'An option.',
      GroupImpl: 'A group.',
    });
  });

  it('gives an overloaded function the docblock of its first overload', () => {
    const source = [
      '/** One step of a trail. */',
      'function Item(props: ButtonProps): React.ReactElement;',
      'function Item(props: AnchorProps): React.ReactElement;',
      'function Item(props: ButtonProps | AnchorProps) { return null; }',
      '/** An exported one. */',
      'export function Link(props: A): R;',
      'export function Link(props: A | B) { return null; }',
    ].join('\n');
    expect(entries(exportDocblocks(source))).toEqual({
      Item: 'One step of a trail.',
      Link: 'An exported one.',
    });
  });

  it('leaves a definition that has a docblock of its own, and exports without a docblock', () => {
    const source = [
      '/** The root has its own. */',
      'const ListRoot = () => null;',
      '/** The export. */',
      'export const List = Object.assign(ListRoot, {});',
      'const TableRoot = () => null;',
      '// A line comment is no docblock.',
      '/* Neither is a plain block comment. */',
      'export const Table = Object.assign(TableRoot, {});',
      '/** An overload set whose implementation is documented. */',
      'function Tab(props: A): R;',
      '/** The implementation. */',
      'function Tab(props: A) { return null; }',
    ].join('\n');
    expect(entries(exportDocblocks(source))).toEqual({});
  });

  it('ignores exports that wrap no component definition, and reference cycles', () => {
    const source = [
      '/** A context. */',
      'export const Context = React.createContext(null);',
      '/** A number. */',
      'export const limit = 3;',
      '/** A map. */',
      'export const sizes = Object.assign({}, base);',
      'const a = wrap(b);',
      'const b = wrap(a);',
      '/** A cycle. */',
      'export const C = wrap(a);',
      'const Alias = () => null;',
      '/** An alias of a documented definition. */',
      'export const Other = Alias;',
    ].join('\n');
    // An identifier export (an alias) is followed too: its definition has no docblock of its own.
    expect(entries(exportDocblocks(source))).toEqual({
      Alias: 'An alias of a documented definition.',
    });
  });

  it('reads the last docblock before a statement, as react-docgen does', () => {
    const source = '/** First. */\n/** Second. */\nconst x = 1;';
    const file = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
    expect(leadingDocblock(source, file.statements[0])).toBe('Second.');
  });
});

describe('docgenDescriptionPatch', () => {
  const source = [
    'const CardRoot = () => null;',
    '/** A card "quoted". */',
    'export const Card = Object.assign(CardRoot, {});',
  ].join('\n');

  const run = (docgenInfo: unknown) => {
    const CardRoot: { __docgenInfo?: unknown } = { __docgenInfo: docgenInfo };
    new Function('CardRoot', docgenDescriptionPatch(source))(CardRoot);
    return CardRoot.__docgenInfo;
  };

  it('fills an empty docgen description with the export docblock', () => {
    expect(run({ description: '', props: {} })).toEqual({
      description: 'A card "quoted".',
      props: {},
    });
  });

  it('keeps a description docgen found, and does nothing without docgen info', () => {
    expect(run({ description: 'Own.' })).toEqual({ description: 'Own.' });
    expect(run(undefined)).toBeUndefined();
  });

  it('is empty for a module without such a definition', () => {
    expect(docgenDescriptionPatch('/** Doc. */\nexport const Button = () => null;')).toBe('');
  });
});

describe('exportDocblockPlugin', () => {
  type Transform = (code: string, id: string) => { code: string; map: null } | null;
  const transform = exportDocblockPlugin().transform as unknown as Transform;
  const source = 'const Root = () => null;\n/** Doc. */\nexport const X = Object.assign(Root, {});';

  it('appends the patch to library component modules, keeping the source map', () => {
    const result = transform(source, 'C:/repo/src/components/layout/X.tsx?v=1');
    expect(result).toEqual({
      code: `${source}\n${docgenDescriptionPatch(source)}\n`,
      map: null,
    });
    expect(transform(source, '/repo/src/components/X.tsx')?.code).toContain('Root.__docgenInfo');
  });

  it('leaves stories, tests, other files and modules with nothing to patch alone', () => {
    expect(transform(source, '/repo/stories/X.stories.tsx')).toBeNull();
    expect(transform(source, '/repo/src/components/layout/__tests__/X.test.tsx')).toBeNull();
    expect(transform(source, '/repo/src/lib/x.ts')).toBeNull();
    expect(
      transform('/** Doc. */\nexport const Y = () => null;', '/repo/src/components/Y.tsx'),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The library rule (C-DOCS): one component JSDoc, on the export
// ---------------------------------------------------------------------------

const componentSources = import.meta.glob<string>(
  ['../../src/components/**/*.tsx', '!**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
);
const storySources = import.meta.glob<string>('../../stories/*.stories.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const repoPath = (key: string) => key.slice('../../'.length);

/** Every `export const X = /* @__PURE__ *\/ Object.assign(Root, …)`: [name, file, root, export docblock]. */
const compounds = Object.entries(componentSources).flatMap(([key, source]) => {
  const file = ts.createSourceFile(key, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return file.statements.flatMap((statement) => {
    if (!ts.isVariableStatement(statement)) return [];
    return statement.declarationList.declarations.flatMap((declaration) => {
      const init = declaration.initializer;
      const isAssign =
        init &&
        ts.isCallExpression(init) &&
        init.expression.getText(file) === 'Object.assign' &&
        ts.isIdentifier(init.arguments[0]);
      if (!isAssign || !ts.isIdentifier(declaration.name)) return [];
      const root = (init.arguments[0] as ts.Identifier).text;
      return [
        [declaration.name.text, repoPath(key), root, leadingDocblock(source, statement)],
      ] as const;
    });
  });
});

describe('component docs of the library (C-DOCS)', () => {
  it('finds the compounds', () => {
    expect(compounds.map(([name]) => name)).toEqual(
      expect.arrayContaining(['Accordion', 'Card', 'Carousel', 'Dialog', 'List', 'RadioGroup']),
    );
  });

  it.each(compounds)(
    '%s (%s): the component JSDoc is on the export only, and autodocs shows it',
    (_name, file, root, docblock) => {
      expect(docblock).toMatch(/\S/);
      expect(exportDocblocks(componentSources[`../../${file}`], file).get(root)).toBe(docblock);
    },
  );

  it.each([
    ['src/components/input/Option.tsx', ['OptionImpl', 'OptionGroupImpl']],
    ['src/components/navigation/Breadcrumb.tsx', ['BreadcrumbItem']],
    ['src/components/navigation/Nav.tsx', ['NavItem', 'NavSubItem']],
  ])(
    '%s: the definitions behind a wrapper or overloads get their export docblock',
    (file, names) => {
      const found = exportDocblocks(componentSources[`../../${file}`], file);
      for (const name of names) expect(found.get(name), name).toMatch(/\S/);
    },
  );

  it("no compound's story replaces its description (a meta JSDoc or docs.description.component)", () => {
    const compoundStories = new Set(compounds.map(([name]) => `stories/${name}.stories.tsx`));
    const repeated = Object.entries(storySources)
      .filter(([key]) => compoundStories.has(repoPath(key)))
      .filter(([, source]) => {
        const file = ts.createSourceFile('s.tsx', source, ts.ScriptTarget.Latest, true);
        const meta = file.statements.find(
          (statement) =>
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(
              (declaration) => declaration.name.getText(file) === 'meta',
            ),
        );
        return (
          (meta && leadingDocblock(source, meta)) || /description:\s*\{\s*component:/.test(source)
        );
      })
      .map(([key]) => repoPath(key));
    expect(repeated).toEqual([]);
  });
});
