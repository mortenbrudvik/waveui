// @ts-check
/**
 * No page of the site requests anything from another host (the spec's privacy and performance
 * rules), yet two stories, Avatar's and Persona's `WithImage`, name photos on
 * `https://i.pravatar.cc/`. `stories/` belongs to Storybook, so the site rewrites them instead:
 * every string literal (or template literal) that starts with that host becomes a small inline
 * SVG, a generic person on a neutral ground, in the module the site bundles (the Vite transform
 * {@link localStoryImages}: the server render and the client islands alike) and in the code a page
 * shows (`src/stories/source.ts`), so the code matches what renders.
 */
import { basename } from 'node:path';
import ts from 'typescript';

/** The host whose image addresses are rewritten (a literal must start with it). */
export const EXTERNAL_IMAGE_HOST = 'https://i.pravatar.cc/';

// An <img> cannot read the theme's tokens, so the image has fixed colours: the neutral greys the
// stories already use for fixtures (SwatchPicker's empty swatch). wave-allow-color: fixture image
const AVATAR_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<rect width='64' height='64' fill='#c8c6c4'/>" +
  "<circle cx='32' cy='25' r='11' fill='#605e5c'/>" +
  "<path d='M12 64a20 20 0 0 1 40 0z' fill='#605e5c'/></svg>";

/**
 * The image every rewritten address becomes: an SVG data URI with no quote, space, `<`, `>` or
 * `#` left unescaped, so it fits in any string literal and any attribute as it is.
 */
export const AVATAR_IMAGE = `data:image/svg+xml,${AVATAR_SVG.replace(
  /[\s"'<>#%]/g,
  (character) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
)}`;

/** The name of the constant the transform declares in a rewritten module. */
const IDENTIFIER = '__waveuiLocalImage';

/** The text of a string-like literal node, or of a template's head. */
function literalStart(/** @type {ts.Node} */ node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text;
  return undefined;
}

/**
 * Rewrites the literals of `code` that start with {@link EXTERNAL_IMAGE_HOST}. By default each
 * becomes a reference to one constant declared at the top of the module; with `inline` each
 * becomes the image itself, in the literal's own quotes (for code shown to readers). A literal
 * that is a JSX attribute's value becomes `{constant}` (or keeps its quotes, inline). Returns
 * `code` unchanged when nothing matched.
 *
 * @param {string} code
 * @param {string} fileName the file's name, which picks the parser (`.tsx` reads JSX)
 * @param {{ inline?: boolean }} [options]
 */
export function rewriteExternalImages(code, fileName, { inline = false } = {}) {
  if (!code.includes(EXTERNAL_IMAGE_HOST)) return code;
  const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, kind);
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [];
  const visit = (/** @type {ts.Node} */ node) => {
    const text = literalStart(node);
    if (text !== undefined && text.startsWith(EXTERNAL_IMAGE_HOST)) {
      const start = node.getStart(file);
      const inAttribute = ts.isJsxAttribute(node.parent);
      let replacement;
      if (inline) {
        const quote = ts.isStringLiteral(node) ? code[start] : '`';
        replacement = `${quote}${AVATAR_IMAGE}${quote}`;
      } else {
        replacement = inAttribute ? `{${IDENTIFIER}}` : IDENTIFIER;
      }
      edits.push({ start, end: node.end, text: replacement });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (edits.length === 0) return code;
  let result = code;
  for (const edit of edits.reverse()) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return inline ? result : `const ${IDENTIFIER} = ${JSON.stringify(AVATAR_IMAGE)};\n${result}`;
}

/** A path with forward slashes, for comparing ids on Windows. */
const normalise = (/** @type {string} */ path) => path.replaceAll('\\', '/');

/**
 * The Vite transform: rewrites the story files of `storiesDir` (`<storiesDir>/*.stories.tsx`) in
 * every environment and command, so the server render, the islands, `astro dev` and the tests all
 * get the inline image.
 *
 * @param {{ storiesDir: string }} options
 * @returns {import('vite').Plugin}
 */
export function localStoryImages({ storiesDir }) {
  const directory = `${normalise(storiesDir).replace(/\/$/, '')}/`;
  return {
    name: 'waveui-local-story-images',
    enforce: 'pre',
    transform(code, id) {
      const [path] = id.split('?');
      if (!path.startsWith(directory) || !path.endsWith('.stories.tsx')) return undefined;
      if (path.slice(directory.length).includes('/')) return undefined;
      const rewritten = rewriteExternalImages(code, basename(path));
      return rewritten === code ? undefined : { code: rewritten, map: null };
    },
  };
}
