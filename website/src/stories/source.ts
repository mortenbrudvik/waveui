/**
 * The source text of a story, for the code beside each example on a component page. Build-time
 * code: it reads the story file with the TypeScript compiler API in Node and is never sent to the
 * browser.
 *
 * The text is the story's whole statement as written in the file (`export const Primary: Story =
 * { args: { … } };`, its `render` function included), without the JSDoc in front of it (that is
 * the story's description), with `\n` line endings. Each file is parsed once per process. An image
 * address on another host is shown as the inline image the site renders in its place
 * (`plugins/localImages.mjs`), so the code matches the example.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import ts from 'typescript';
import { rewriteExternalImages } from '../../plugins/localImages.mjs';
import { REPO_ROOT } from '../repoRoot';

/** The story statements of each file read so far, by export name. */
const cache = new Map<string, ReadonlyMap<string, string>>();

function isExported(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) &&
    !(ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    )
  );
}

function readStories(path: string, storyFile: string): ReadonlyMap<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`${storyFile} cannot be read: ${(error as Error).message}`);
  }
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const stories = new Map<string, string>();
  for (const statement of source.statements) {
    if (!isExported(statement)) continue;
    // `getText` starts at the statement's first token, after its leading comments.
    const statementText = rewriteExternalImages(
      statement.getText(source).replace(/\r\n/g, '\n'),
      'story.tsx',
      { inline: true },
    );
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) stories.set(declaration.name.text, statementText);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      stories.set(statement.name.text, statementText);
    }
  }
  return stories;
}

/**
 * The source text of the story `exportName` of `storyFile` (a path relative to the repository
 * root, as `ComponentEntry.storyFile` gives it, or an absolute path). Throws when the file has no
 * such named export.
 */
export function extractStorySource(storyFile: string, exportName: string): string {
  const path = isAbsolute(storyFile) ? storyFile : resolve(REPO_ROOT, storyFile);
  let stories = cache.get(path);
  if (!stories) {
    stories = readStories(path, storyFile);
    cache.set(path, stories);
  }
  const text = stories.get(exportName);
  if (text === undefined) {
    throw new Error(`${storyFile} has no story export named "${exportName}"`);
  }
  return text;
}
