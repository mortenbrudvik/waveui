/**
 * What a component page shows, decided at build time from the catalog entry and its docs
 * (`src/pages/components/[slug].astro` renders it). Pure functions, besides
 * {@link getSiteImportSizes}, which measures once per build.
 *
 * Descriptions are JSDoc text: the page renders it as paragraphs and code, and interprets nothing
 * else. Every run is text the page escapes, so `<b>` in a comment shows as `<b>`.
 */
import { join } from 'node:path';
import type { ComponentEntry } from '../catalog/catalog';
import { REPO_ROOT } from '../repoRoot';
import { getImportSizes, type ImportSize } from './sizes';

/** A piece of a line: code (a backtick span, without its backticks) or text. */
export interface TextRun {
  code: boolean;
  text: string;
}

/** A line of a paragraph: its runs. */
export type DescriptionLine = TextRun[];

/** A paragraph: its lines, which the page separates with a line break. */
export type DescriptionParagraph = DescriptionLine[];

/** A line that begins with a list marker (`- `, `* `, `1. `) starts a line of its own. */
const LIST_MARKER = /^(?:[-*]|\d+\.)\s/;

/** `{@link Target}`, `{@link Target text}`, `{@linkcode …}`, `{@linkplain …}`. */
const JSDOC_LINK = /\{@link(?:code|plain)?\s+([^\s}|]+)(?:[\s|]+([^}]*))?\}/g;

function runs(line: string): TextRun[] {
  const result: TextRun[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = result[result.length - 1];
    if (last && !last.code) last.text += text;
    else result.push({ code: false, text });
  };
  let rest = line;
  for (;;) {
    const open = rest.indexOf('`');
    const close = open === -1 ? -1 : rest.indexOf('`', open + 1);
    if (close === -1) {
      pushText(rest);
      return result;
    }
    pushText(rest.slice(0, open));
    const code = rest.slice(open + 1, close);
    if (code) result.push({ code: true, text: code });
    rest = rest.slice(close + 1);
  }
}

/**
 * The paragraphs of a JSDoc text. Paragraphs are separated by a blank line; within one, a wrapped
 * line joins the line before it with a space, and a line that begins with a list marker starts a
 * new line (the marker stays as text). A backtick span is code; a JSDoc `{@link X}` is written as
 * its text or its target. Nothing else (Markdown marks, HTML) is interpreted.
 */
export function formatDescription(text: string): DescriptionParagraph[] {
  const normalised = text
    .replace(/\r\n?/g, '\n')
    .replace(JSDOC_LINK, (_, target: string, label?: string) =>
      label?.trim() ? label.trim() : target,
    );
  return normalised
    .split(/\n[ \t]*\n/)
    .map((block) => {
      const lines: string[] = [];
      for (const raw of block.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        if (lines.length === 0 || LIST_MARKER.test(line)) lines.push(line);
        else lines[lines.length - 1] += ` ${line}`;
      }
      return lines.map(runs);
    })
    .filter((paragraph) => paragraph.length > 0);
}

/** A heading of the page's content, listed in its "On this page" pane. */
export interface PageSection {
  id: string;
  title: string;
}

/** What a page has content for. */
export interface PageContent {
  /** The number of stories shown. */
  examples: number;
  /** Whether the page has a props table (not for a hook, nor without props). */
  propsTable: boolean;
  /** The number of parts. */
  parts: number;
  /** Whether the export has a class-name constant. */
  classNames: boolean;
}

/** The page's sections, in page order: only those with content. */
export function pageSections(content: PageContent): PageSection[] {
  const sections: PageSection[] = [];
  if (content.examples > 0) sections.push({ id: 'examples', title: 'Examples' });
  if (content.propsTable) sections.push({ id: 'props', title: 'Props' });
  if (content.parts > 0) sections.push({ id: 'parts', title: 'Parts' });
  if (content.classNames) sections.push({ id: 'class-names', title: 'Stable class names' });
  return sections;
}

/** Whether a catalog entry documents a hook (`useTableFeatures`) rather than a component. */
export function isHookEntry(entry: Pick<ComponentEntry, 'exportName'>): boolean {
  return /^use[A-Z]/.test(entry.exportName);
}

/** The id of a story's heading: `example-with-icon-after` for `WithIconAfter`. */
export function exampleAnchor(exportName: string): string {
  const kebab = exportName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `example-${kebab}`;
}

let sizes: Promise<Record<string, ImportSize>> | undefined;

/**
 * The import size of every catalog export, measured from the repository's `dist` once per process
 * (every page of a build shows its own; `getImportSizes` keeps a disk cache across builds).
 */
export function getSiteImportSizes(): Promise<Record<string, ImportSize>> {
  sizes ??= getImportSizes(join(REPO_ROOT, 'dist'));
  return sizes;
}
