/**
 * The changelog page's content (the spec: "the 1.x sections of `CHANGELOG.md` and a link to the
 * whole file on GitHub"): each `## [x.y.z] - <date>` section of a 1.x version, its body rendered
 * by `renderMarkdown` (its `###` subsections become h3s under the version's h2, which the page
 * renders). Build-time code.
 */
import { Marked, type Tokens } from 'marked';
import { SHELL_IDS } from '../shell/ids';
import { REPO_BLOB, renderMarkdown, Slugger } from './markdown';

/** The whole changelog on GitHub. */
export const CHANGELOG_URL = `${REPO_BLOB}CHANGELOG.md`;

export interface ChangelogSection {
  /** `1.1.0` */
  version: string;
  /** What follows the version in its heading: `2026-11-07`, or a note such as `Not published`. */
  date: string;
  /** The section's body as HTML. */
  html: string;
}

/** The id of a version's heading on the page: `version-1-1-0`. */
export function changelogVersionId(version: string): string {
  return `version-${version.replaceAll('.', '-')}`;
}

const VERSION_HEADING = /^\[?(\d+)\.(\d+)\.(\d+)\]?\s*(?:[-–—]\s*(.*))?$/;

/**
 * The 1.x sections of a changelog in Keep a Changelog's form, in the file's order. Other headings
 * (`[Unreleased]`, 0.x and later majors) are left out with their bodies.
 */
export function parseChangelog(
  markdown: string,
  { slugger }: { slugger?: Slugger } = {},
): ChangelogSection[] {
  const tokens = new Marked({ gfm: true }).lexer(markdown);
  const found: { version: string; date: string; body: string }[] = [];
  let current: { version: string; date: string; body: string } | null = null;
  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth <= 2) {
      current = null;
      const match = VERSION_HEADING.exec((token as Tokens.Heading).text.trim());
      if ((token as Tokens.Heading).depth === 2 && match && match[1] === '1') {
        current = {
          version: `${match[1]}.${match[2]}.${match[3]}`,
          date: match[4] ?? '',
          body: '',
        };
        found.push(current);
      }
      continue;
    }
    if (current) current.body += token.raw;
  }
  const ids =
    slugger ??
    new Slugger([
      ...Object.values(SHELL_IDS),
      ...found.map((section) => changelogVersionId(section.version)),
    ]);
  return found.map(({ version, date, body }) => ({
    version,
    date: date.trim(),
    html: renderMarkdown(body.trim(), { source: 'CHANGELOG.md', slugger: ids }).html,
  }));
}
