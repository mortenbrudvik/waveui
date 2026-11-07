/**
 * The catalog: the one list of the component pages of the docs site, read from the stories.
 *
 * Every later part of the site (story loading, doc extraction, size measuring, the pages and the
 * search index) takes its list from `getCatalog()`. The list is not written down anywhere: each
 * `stories/*.stories.tsx` file is parsed with the TypeScript compiler API, the title of its
 * default-exported `meta` object decides whether it is a component page (`Components/<Category>/<Name>`;
 * the `Guides/...` stories document no component and are left out), and its named exports are the
 * stories. Nothing is imported from the story files, so no Storybook runtime is needed.
 *
 * Rules:
 * - `category` and `name` are the second and third segments of the title, and `name` keeps the
 *   title's spelling (`Custom overlays`).
 * - `slug` is the lower-case kebab of `name` (`DataGrid` is `data-grid`, `Custom overlays` is
 *   `custom-overlays`). For every component the name is the export's name, so this is the kebab of
 *   the export too (the spec's rule). The one exception is {@link SLUG_OVERRIDES}: the title
 *   `Components/Table/Features` is the table hooks, and a bare `features` is no page address.
 * - `exportName` is the identifier of `meta.component`, followed through a story-only alias
 *   (`const DataGridWithStoryArgs = DataGrid as unknown as ...` gives `DataGrid`). Two titles show
 *   no single component (`Features` renders a local table built on the table hooks, `Custom overlays`
 *   has no `component` at all); {@link EXPORT_OVERRIDES} names the public export each one is
 *   about. A test checks that every `exportName` is exported by the library entry.
 * - The list is sorted by category, then name.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { REPO_ROOT } from '../repoRoot';

export interface ComponentEntry {
  /** The page address segment: `/waveui/docs/components/<slug>`. */
  slug: string;
  /** The last segment of the story title. */
  name: string;
  /** The middle segment of the story title. */
  category: string;
  /** The story title, `Components/<category>/<name>`. */
  title: string;
  /** The story file, relative to the repository root, with forward slashes. */
  storyFile: string;
  /** The names of the file's story exports, in source order. */
  storyNames: string[];
  /** The library export the page documents; a name of `src/index.ts`. */
  exportName: string;
}

/** Titles whose `meta.component` is no public export of its own, with the export they are about. */
const EXPORT_OVERRIDES: Readonly<Record<string, string>> = {
  'Components/Table/Features': 'useTableFeatures',
  'Components/Overlays/Custom overlays': 'useModalLayer',
};

/** Titles whose kebab name would make a poor page address. */
const SLUG_OVERRIDES: Readonly<Record<string, string>> = {
  'Components/Table/Features': 'table-features',
};

const STORIES_DIR = 'stories';
const STORY_FILE = /\.stories\.tsx$/;

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  return property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
    ? property.name.text
    : undefined;
}

interface ParsedStoryFile {
  title: string | undefined;
  componentIdentifier: string | undefined;
  storyNames: string[];
}

function parseStoryFile(fileName: string, text: string): ParsedStoryFile {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const objects = new Map<string, ts.ObjectLiteralExpression>();
  const aliases = new Map<string, string>();
  const storyNames: string[] = [];
  let defaultExport: ts.Expression | undefined;

  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (exported) storyNames.push(name);
        if (!declaration.initializer) continue;
        const initializer = unwrap(declaration.initializer);
        if (ts.isObjectLiteralExpression(initializer)) objects.set(name, initializer);
        else if (ts.isIdentifier(initializer)) aliases.set(name, initializer.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      const isExported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (isExported && !isDefault) storyNames.push(statement.name.text);
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExport = statement.expression;
    }
  }

  let meta = defaultExport && unwrap(defaultExport);
  if (meta && ts.isIdentifier(meta)) meta = objects.get(meta.text);
  if (!meta || !ts.isObjectLiteralExpression(meta)) {
    return { title: undefined, componentIdentifier: undefined, storyNames };
  }

  let title: string | undefined;
  let componentIdentifier: string | undefined;
  for (const property of meta.properties) {
    const key = propertyName(property);
    if (key === 'title' && ts.isPropertyAssignment(property)) {
      const value = unwrap(property.initializer);
      if (ts.isStringLiteralLike(value)) title = value.text;
    } else if (key === 'component') {
      const value = ts.isPropertyAssignment(property)
        ? unwrap(property.initializer)
        : ts.isShorthandPropertyAssignment(property)
          ? property.name
          : undefined;
      if (value && ts.isIdentifier(value)) {
        componentIdentifier = value.text;
        // A story-only alias (`const XWithStoryArgs = X as unknown as ComponentType<...>`).
        const seen = new Set<string>();
        while (aliases.has(componentIdentifier) && !seen.has(componentIdentifier)) {
          seen.add(componentIdentifier);
          componentIdentifier = aliases.get(componentIdentifier)!;
        }
      }
    }
  }
  return { title, componentIdentifier, storyNames };
}

let cached: readonly ComponentEntry[] | undefined;

function copyEntry(entry: ComponentEntry): ComponentEntry {
  return { ...entry, storyNames: [...entry.storyNames] };
}

/**
 * The component entries, sorted by category and then name. The stories are read on the first call
 * of the process (every page of a build asks for the catalog); each call returns a copy, so a caller
 * may change what it gets. A story file added while `astro dev` runs needs a restart, as the
 * generated example islands do.
 */
export function getCatalog(): ComponentEntry[] {
  cached ??= readCatalog();
  return cached.map(copyEntry);
}

/** The component entries, read from the story files on every call ({@link getCatalog} keeps them). */
export function readCatalog(): ComponentEntry[] {
  const directory = resolve(REPO_ROOT, STORIES_DIR);
  const entries: ComponentEntry[] = [];
  for (const file of readdirSync(directory)
    .filter((f) => STORY_FILE.test(f))
    .sort()) {
    const parsed = parseStoryFile(file, readFileSync(resolve(directory, file), 'utf8'));
    const match = parsed.title?.match(/^Components\/([^/]+)\/([^/]+)$/);
    if (!parsed.title || !match) continue;
    const [, category, name] = match as unknown as [string, string, string];
    const exportName = EXPORT_OVERRIDES[parsed.title] ?? parsed.componentIdentifier;
    if (!exportName) {
      throw new Error(`${STORIES_DIR}/${file}: "${parsed.title}" has no meta.component identifier`);
    }
    entries.push({
      slug: SLUG_OVERRIDES[parsed.title] ?? kebab(name),
      name,
      category,
      title: parsed.title,
      storyFile: `${STORIES_DIR}/${file}`,
      storyNames: parsed.storyNames,
      exportName,
    });
  }
  return entries.sort(
    (a, b) => a.category.localeCompare(b.category, 'en') || a.name.localeCompare(b.name, 'en'),
  );
}
