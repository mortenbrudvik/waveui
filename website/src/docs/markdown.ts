/**
 * The guide pages' Markdown (README.md's sections, CHANGELOG.md's 1.x sections) to HTML, at build
 * time only: nothing of it reaches the browser, which gets the HTML.
 *
 * The output holds only the elements of {@link GUIDE_CONTENT_TAGS}, so the guide pages keep the
 * component pages' invariant that no source text injects markup:
 *
 * - Raw HTML in the Markdown (`<details>`, `<b>`, a `<script>`) is not passed through: it is shown
 *   as text. An image is its alt text, a task list's checkbox `[x]`/`[ ]` as text.
 * - Headings get GitHub's ids (`githubSlug`, deduplicated as GitHub does, skipping the ids the page
 *   already has), so the README's own fragment links resolve; `shift` moves them up a level (the
 *   README's `###` under a page's h1 becomes an h2), never above h2.
 * - Links: a fragment of a heading in the same text stays; another fragment goes where
 *   `resolveFragment` says (another guide page that has the heading), else to the source file on
 *   GitHub; a relative path goes to the file on GitHub; an absolute `https` link stays only when it
 *   is to GitHub or npm ({@link isAllowedExternalLink}). Any other link (another host, `http`, a
 *   path outside the app, another scheme) is its text alone.
 */
import { Marked, type RendererObject, type Token, type Tokens } from 'marked';

/** Where the repository's files are on GitHub. */
export const REPO_BLOB = 'https://github.com/mortenbrudvik/waveui/blob/main/';

/** Every element the rendered Markdown may contain. */
export const GUIDE_CONTENT_TAGS: readonly string[] = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'ul',
  'ol',
  'li',
  'a',
  'code',
  'pre',
  'strong',
  'em',
  'del',
  'blockquote',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

export interface MarkdownHeading {
  /** The level it renders at (after `shift`). */
  depth: number;
  id: string;
  /** Its plain text. */
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: MarkdownHeading[];
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text (or an attribute value) with its markup characters escaped. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

/** A heading's id as GitHub gives it: lower case, punctuation dropped, spaces to hyphens. */
export function githubSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

/** GitHub's deduplication: a repeated id gets `-1`, `-2`, … */
export class Slugger {
  readonly #occurrences = new Map<string, number>();

  /** @param taken ids the page already has, which no heading may take */
  constructor(taken: Iterable<string> = []) {
    for (const id of taken) this.#occurrences.set(id, 0);
  }

  slug(text: string): string {
    const base = githubSlug(text);
    let slug = base;
    if (this.#occurrences.has(slug)) {
      do {
        const count = this.#occurrences.get(base)! + 1;
        this.#occurrences.set(base, count);
        slug = `${base}-${count}`;
      } while (this.#occurrences.has(slug));
    }
    this.#occurrences.set(slug, 0);
    return slug;
  }
}

const EXTERNAL_HOSTS = new Set(['github.com', 'www.npmjs.com', 'npmjs.com']);

/** Whether an absolute link may stay a link in a guide: `https` to GitHub or npm. */
export function isAllowedExternalLink(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && EXTERNAL_HOSTS.has(url.hostname) && url.username === '';
  } catch {
    return false;
  }
}

/** The plain text of inline tokens (a heading's), without their markup. */
function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && token.tokens && token.type !== 'codespan') {
        return plainText(token.tokens);
      }
      return 'text' in token && typeof token.text === 'string' ? token.text : '';
    })
    .join('');
}

const markedFor = (renderer: RendererObject) => new Marked({ gfm: true, renderer });

/**
 * The named top-level sections of a Markdown text, each with its subsections (up to the next
 * heading of its level or above), joined in the file's order. Throws for a name it does not have,
 * so a renamed README section fails the build.
 */
export function extractSections(markdown: string, titles: readonly string[]): string {
  const tokens = new Marked({ gfm: true }).lexer(markdown);
  const ranges: [number, number][] = [];
  for (const title of titles) {
    const start = tokens.findIndex(
      (token) => token.type === 'heading' && plainText(token.tokens ?? []) === title,
    );
    if (start === -1) throw new Error(`The Markdown has no section "${title}"`);
    const depth = (tokens[start] as Tokens.Heading).depth;
    let end = start + 1;
    while (end < tokens.length) {
      const token = tokens[end]!;
      if (token.type === 'heading' && (token as Tokens.Heading).depth <= depth) break;
      end++;
    }
    ranges.push([start, end]);
  }
  return ranges
    .sort((a, b) => a[0] - b[0])
    .map(([start, end]) =>
      tokens
        .slice(start, end)
        .map((token) => token.raw)
        .join('')
        .trim(),
    )
    .join('\n\n');
}

export interface RenderMarkdownOptions {
  /** The repository file the text comes from (`README.md`): its links resolve against it. */
  source: string;
  /** Levels to move every heading up. @default 0 */
  shift?: number;
  /** The page's ids so far; a new one starts empty. Shared across the texts of one page. */
  slugger?: Slugger;
  /** The address of a fragment that is no heading of this text (another page's), or `null`. */
  resolveFragment?: (id: string) => string | null;
}

/** The repository path a relative link names, or `null` when it leaves the repository. */
function repositoryPath(source: string, relative: string): string | null {
  const segments = source.split('/').slice(0, -1);
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

/** Markdown to the guides' HTML, and its headings in order. */
export function renderMarkdown(
  markdown: string,
  { source, shift = 0, slugger = new Slugger(), resolveFragment }: RenderMarkdownOptions,
): RenderedMarkdown {
  const ids = new WeakMap<Token, string>();
  const headings: MarkdownHeading[] = [];
  const localIds = new Set<string>();

  const resolveHref = (raw: string): string | null => {
    const href = raw.trim();
    if (href.startsWith('#')) {
      let id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // Keep it as written.
      }
      if (localIds.has(id)) return `#${id}`;
      return resolveFragment?.(id) ?? `${REPO_BLOB}${source}#${id}`;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return isAllowedExternalLink(href) ? href : null;
    if (href.startsWith('/') || href.startsWith('\\')) return null;
    const [path = '', ...fragment] = href.split('#');
    const resolved = repositoryPath(source, path);
    if (resolved === null || resolved === '') return null;
    return `${REPO_BLOB}${resolved}${fragment.length > 0 ? `#${fragment.join('#')}` : ''}`;
  };

  const renderer: RendererObject = {
    heading(token) {
      const depth = Math.min(Math.max(token.depth - shift, 2), 6);
      const id = ids.get(token)!;
      return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(token.tokens)}</h${depth}>\n`;
    },
    html({ text, block }) {
      return block ? `<p>${escapeHtml(text.trim())}</p>\n` : escapeHtml(text);
    },
    link(token) {
      const inner = token.autolink ? escapeHtml(token.text) : this.parser.parseInline(token.tokens);
      const href = resolveHref(token.href);
      return href === null ? inner : `<a href="${escapeHtml(href)}">${inner}</a>`;
    },
    image(token) {
      return escapeHtml(token.text);
    },
    checkbox({ checked }) {
      return checked ? '[x] ' : '[ ] ';
    },
  };

  const marked = markedFor(renderer);
  const tokens = marked.lexer(markdown);
  marked.walkTokens(tokens, (token) => {
    if (token.type !== 'heading') return;
    const heading = token as Tokens.Heading;
    const text = plainText(heading.tokens);
    const id = slugger.slug(text);
    ids.set(token, id);
    localIds.add(id);
    headings.push({ depth: Math.min(Math.max(heading.depth - shift, 2), 6), id, text });
  });
  return { html: marked.parser(tokens), headings };
}
