/**
 * The built pages (`website/dist`, written by `astro build`): the components index and one page per
 * catalog entry. The tests read the HTML files and parse them with jsdom, the pages' own scripts
 * never running (what a reader without scripts gets). They need a build of the current sources;
 * `test/builtSite.ts` says when they run, skip or fail.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { AVATAR_IMAGE } from '../plugins/localImages.mjs';
import { measurePage } from '../scripts/measure-page.mjs';
import { getCatalog, type ComponentEntry } from '../src/catalog/catalog';
import { extractDocs, type ComponentDocs } from '../src/docs/props';
import { CHANGELOG_URL, parseChangelog } from '../src/docs/changelog';
import { README_SECTIONS } from '../src/docs/guides';
import { GUIDE_CONTENT_TAGS, isAllowedExternalLink } from '../src/docs/markdown';
import { formatDescription, isHookEntry } from '../src/docs/page';
import { readSearchIndex, serialiseSearchIndex } from '../src/search/searchIndex';
import { getImportSizes, getLibraryVersion } from '../src/docs/sizes';
import { formatKB } from '../src/shell/StatusBar';
import { componentHref, DOCS_BASE, INTRO_URL } from '../src/shell/urls';
import { extractStorySource } from '../src/stories/source';
import { REPO_ROOT } from '../src/repoRoot';
import { requireBuiltSiteUnlessOptional, SITE_DIST } from '../test/builtSite';

const state = requireBuiltSiteUnlessOptional();
const title = state.ready ? 'built pages' : `built pages (skipped: ${state.reason})`;

const catalog = getCatalog();
const skipped = new Set(
  (
    JSON.parse(readFileSync(join(REPO_ROOT, 'website/skipped-stories.json'), 'utf8')) as {
      story: string;
    }[]
  ).map((item) => item.story),
);

const pageFile = (entry: ComponentEntry) => join(SITE_DIST, 'components', `${entry.slug}.html`);
const INDEX_FILE = join(SITE_DIST, 'components.html');

const documents = new Map<string, Document>();
/** The page parsed without running its scripts; parsed once per file. */
function load(file: string): Document {
  let document = documents.get(file);
  if (!document) {
    document = new JSDOM(readFileSync(file, 'utf8')).window.document;
    documents.set(file, document);
  }
  return document;
}

const docsOf = new Map<string, ComponentDocs>();
function docs(entry: ComponentEntry): ComponentDocs {
  let value = docsOf.get(entry.slug);
  if (!value) {
    value = extractDocs(entry);
    docsOf.set(entry.slug, value);
  }
  return value;
}

const firstStory = (entry: ComponentEntry) =>
  entry.storyNames.find((name) => !skipped.has(`${entry.storyFile}#${name}`))!;

/** Every HTML file of the build. */
function allPages(directory = SITE_DIST): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    if (item.isDirectory()) return item.name === '_assets' ? [] : allPages(path);
    return item.name.endsWith('.html') ? [path] : [];
  });
}

const normalise = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** Text without its whitespace: the page's lines and paragraphs meet with none between them. */
const squash = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, '');

/** The text formatDescription gives, as the page shows it. */
const descriptionText = (text: string) =>
  squash(
    formatDescription(text)
      .flat(2)
      .map((run) => run.text)
      .join(''),
  );

const content = (document: Document) => document.querySelector('main article')!;

/**
 * The page's own elements matching `selector`, outside the examples: a story may render headings
 * of its own (Text's `as="h1"`, Accordion's and Drawer's headers), which belong to the example.
 */
const own = (root: ParentNode, selector: string) =>
  [...root.querySelectorAll(selector)].filter((element) => !element.closest('astro-island'));

/**
 * The host whose images two stories name (Avatar and Persona). The site's build serves an inline
 * image in their place (`plugins/localImages.mjs`), so no page requests anything from it.
 */
const STORY_IMAGE_HOST = 'i.pravatar.cc';

/**
 * The one exception to "nothing outside /waveui/docs/" besides the Close link: a link (an `<a>`'s
 * `href`, never a script, stylesheet or image) inside a guide page's rendered content
 * (`[data-guide-content]`, src/docs/GuideArticle.astro) to GitHub or npm over https.
 */
function isAllowedGuideLink(element: Element, attribute: string, value: string): boolean {
  return (
    attribute === 'href' &&
    element.tagName === 'A' &&
    element.closest('[data-guide-content]') !== null &&
    isAllowedExternalLink(value)
  );
}

/** The guide pages, by file. */
const GUIDE_FILES = {
  'getting-started': join(SITE_DIST, 'getting-started.html'),
  theming: join(SITE_DIST, 'theming.html'),
  changelog: join(SITE_DIST, 'changelog.html'),
} as const;

describe('the link-scan rule', () => {
  it('allows https links to GitHub and npm only as anchors inside rendered guide content', () => {
    const { document } = new JSDOM(`<body>
      <div data-guide-content>
        <a id="github" href="https://github.com/mortenbrudvik/waveui/blob/main/CHANGELOG.md">x</a>
        <a id="npm" href="https://www.npmjs.com/package/@mortenbrudvik/waveui">x</a>
        <a id="other-host" href="https://example.com/">x</a>
        <a id="http" href="http://github.com/mortenbrudvik/waveui">x</a>
        <img id="image" src="https://github.com/a.png" alt="">
        <script id="script" src="https://github.com/a.js"></script>
        <link id="sheet" rel="stylesheet" href="https://github.com/a.css">
      </div>
      <a id="outside" href="https://github.com/mortenbrudvik/waveui">x</a>
    </body>`).window;
    const allowed = (id: string, attribute: string) => {
      const element = document.getElementById(id)!;
      return isAllowedGuideLink(element, attribute, element.getAttribute(attribute)!);
    };
    expect(allowed('github', 'href')).toBe(true);
    expect(allowed('npm', 'href')).toBe(true);
    expect(allowed('other-host', 'href')).toBe(false);
    expect(allowed('http', 'href')).toBe(false);
    expect(allowed('image', 'src')).toBe(false);
    expect(allowed('script', 'src')).toBe(false);
    expect(allowed('sheet', 'href')).toBe(false);
    expect(allowed('outside', 'href')).toBe(false);
  });
});

describe.skipIf(!state.ready)(title, () => {
  it('80 component pages plus the index exist', () => {
    expect(catalog).toHaveLength(80);
    expect(existsSync(INDEX_FILE)).toBe(true);
    const missing = catalog.filter((entry) => !existsSync(pageFile(entry))).map((e) => e.slug);
    expect(missing).toEqual([]);
    const built = readdirSync(join(SITE_DIST, 'components')).filter((f) => f.endsWith('.html'));
    expect(built.sort()).toEqual(catalog.map((entry) => `${entry.slug}.html`).sort());
  });

  it('each page has one h1 equal to the component name', () => {
    for (const entry of catalog) {
      const headings = own(load(pageFile(entry)), 'h1');
      expect(headings, entry.slug).toHaveLength(1);
      expect(normalise(headings[0]!.textContent), entry.slug).toBe(entry.name);
    }
    const index = load(INDEX_FILE).querySelectorAll('h1');
    expect(index).toHaveLength(1);
    expect(normalise(index[0]!.textContent)).toBe('Components');
  });

  it('each page has the description, a props table (except hooks) and the code of its first story', () => {
    for (const entry of catalog) {
      const document = load(pageFile(entry));
      const page = docs(entry);
      const description = content(document).querySelector('[data-description]');
      expect(squash(description?.textContent), entry.slug).toBe(descriptionText(page.description));
      expect(squash(description?.textContent).length, entry.slug).toBeGreaterThan(0);

      const props = document.getElementById('props');
      const table = document.querySelector('section[aria-labelledby="props"] table');
      if (isHookEntry(entry) || page.props.length === 0) {
        expect(props, entry.slug).toBeNull();
        expect(table, entry.slug).toBeNull();
      } else {
        expect(props?.tagName, entry.slug).toBe('H2');
        expect(table?.querySelectorAll('tbody tr'), entry.slug).toHaveLength(page.props.length);
        const names = [...table!.querySelectorAll('tbody tr > th')].map((cell) =>
          normalise(cell.textContent),
        );
        expect(names, entry.slug).toEqual(page.props.map((prop) => prop.name));
        const headers = [...table!.querySelectorAll('thead th')].map((cell) =>
          normalise(cell.textContent),
        );
        expect(headers).toEqual(['Name', 'Type', 'Required', 'Default', 'Description']);
      }

      const code = document.querySelector('section[aria-labelledby="examples"] pre code');
      expect(code?.textContent, entry.slug).toBe(
        extractStorySource(entry.storyFile, firstStory(entry)),
      );
    }
  });

  it('each page shows every story with its name and its code', () => {
    const entry = catalog.find((candidate) => candidate.slug === 'button')!;
    const document = load(pageFile(entry));
    const section = document.querySelector('section[aria-labelledby="examples"]')!;
    const names = [...section.querySelectorAll('h3')].map((h) => normalise(h.textContent));
    expect(names.slice(0, 3)).toEqual(['Default', 'Primary', 'Outline']);
    expect(names).toHaveLength(entry.storyNames.length);
    const codes = [...section.querySelectorAll('pre code')].map((code) => code.textContent);
    expect(codes).toEqual(
      entry.storyNames.map((name) => extractStorySource(entry.storyFile, name)),
    );
    expect(section.querySelectorAll('astro-island')).toHaveLength(entry.storyNames.length);
  });

  it('each page shows the import size and version in the status bar', async () => {
    const sizes = await getImportSizes(join(REPO_ROOT, 'dist'));
    const version = getLibraryVersion();
    for (const entry of catalog) {
      const footer = load(pageFile(entry)).querySelector('body > div > footer')!;
      const size = sizes[entry.exportName]!;
      expect(
        [...footer.children].map((item) => normalise(item.textContent)),
        entry.slug,
      ).toEqual([
        `Import: ${formatKB(size.minified)} min / ${formatKB(size.gzip)} gz`,
        `Version ${version}`,
      ]);
    }
    const indexFooter = load(INDEX_FILE).querySelector('body > div > footer')!;
    expect([...indexFooter.children].map((item) => normalise(item.textContent))).toEqual([
      `Version ${version}`,
    ]);
  });

  it('the "On this page" pane lists the section headings present', () => {
    for (const entry of catalog) {
      const document = load(pageFile(entry));
      const panes = document.querySelectorAll('nav[aria-label="On this page"]');
      expect(panes, entry.slug).toHaveLength(1);
      const links = [...panes[0]!.querySelectorAll('a')];
      const headings = own(content(document), 'h2');
      expect(headings.length, entry.slug).toBeGreaterThan(0);
      expect(
        links.map((link) => [link.getAttribute('href'), normalise(link.textContent)]),
        entry.slug,
      ).toEqual(headings.map((heading) => [`#${heading.id}`, normalise(heading.textContent)]));
      for (const link of links) {
        const id = link.getAttribute('href')!.slice(1);
        expect(document.querySelectorAll(`[id="${id}"]`), `${entry.slug} #${id}`).toHaveLength(1);
        expect(document.getElementById(id)?.tagName, entry.slug).toBe('H2');
      }
    }
  });

  it('a page lists its parts and its stable class names when the component has them, and omits those sections when it has none', () => {
    const seen = { parts: 0, noParts: 0, classNames: 0, noClassNames: 0 };
    for (const entry of catalog) {
      const document = load(pageFile(entry));
      const page = docs(entry);
      const parts = document.querySelector('section[aria-labelledby="parts"]');
      if (page.parts.length > 0) {
        seen.parts++;
        const items = [...parts!.querySelectorAll('li')].map((item) => normalise(item.textContent));
        expect(items, entry.slug).toEqual(page.parts);
      } else {
        seen.noParts++;
        expect(parts, entry.slug).toBeNull();
        expect(document.getElementById('parts'), entry.slug).toBeNull();
      }
      const classNames = document.querySelector('section[aria-labelledby="class-names"]');
      if (page.classNames) {
        seen.classNames++;
        const rows = [...classNames!.querySelectorAll('tbody tr')].map((row) =>
          [...row.children].map((cell) => normalise(cell.textContent)),
        );
        expect(rows, entry.slug).toEqual(Object.entries(page.classNames));
      } else {
        seen.noClassNames++;
        expect(classNames, entry.slug).toBeNull();
        expect(document.getElementById('class-names'), entry.slug).toBeNull();
      }
    }
    // Both branches are exercised (Menu has parts, Button none; Dialog has no class names).
    expect(Object.values(seen).every((count) => count > 0)).toBe(true);
  });

  it('no page references a path outside /waveui/docs/ (asset, link or script)', () => {
    const URL_ATTRIBUTES = [
      'href',
      'src',
      'action',
      'poster',
      'component-url',
      'renderer-url',
      'before-hydration-url',
    ];
    /** A whole string that is an address: `/x`, `//host/x` or `scheme://…`. */
    const ADDRESS = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/)\S*$/i;
    const CSS_URL = /url\(\s*(['"]?)([^'")]*)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;

    const pages = allPages();
    expect(pages.length).toBeGreaterThanOrEqual(85);
    const sheets = new Set<string>();
    // The guides' links to GitHub and npm: the changelog's link to the whole file at least.
    let guideLinks = 0;

    /** An address in the app: under the prefix once, and not a directory (`…/`). */
    const expectInternal = (value: string, where: string) => {
      const path = value.split(/[?#]/)[0]!;
      expect(path.startsWith(`${DOCS_BASE}/`), `${where}: "${value}" is outside the app`).toBe(
        true,
      );
      expect(path.slice(DOCS_BASE.length).includes('/waveui/'), `${where}: "${value}"`).toBe(false);
      expect(path.endsWith('/'), `${where}: "${value}" ends with /`).toBe(false);
    };
    /** `url(…)` and `@import` addresses of CSS text, resolved against `base`. */
    const cssAddresses = (css: string, base: string) =>
      [...css.matchAll(CSS_URL)]
        .map((match) => (match[2] ?? match[4] ?? '').trim())
        .filter((url) => url && !url.startsWith('data:') && !url.startsWith('#'))
        .map((url) => (url.startsWith('/') ? url : new URL(url, `http://site${base}`).pathname));
    /** Every string of an astro-island's serialised props that is an address. */
    const propAddresses = (value: unknown): string[] =>
      typeof value === 'string'
        ? ADDRESS.test(value)
          ? [value]
          : []
        : Array.isArray(value)
          ? value.flatMap(propAddresses)
          : value && typeof value === 'object'
            ? Object.values(value).flatMap(propAddresses)
            : [];

    for (const file of pages) {
      const document = load(file);
      const name = relative(SITE_DIST, file).replace(/\\/g, '/');
      const pagePath = `${DOCS_BASE}/${name.replace(/\.html$/, '')}`;
      let closeLinks = 0;
      for (const element of document.querySelectorAll('*')) {
        const values = URL_ATTRIBUTES.map((attribute) => [
          attribute,
          element.getAttribute(attribute),
        ])
          .concat(
            (element.getAttribute('srcset') ?? '')
              .split(',')
              .map((candidate) => ['srcset', candidate.trim().split(/\s+/)[0] || null]),
          )
          .filter((pair): pair is [string, string] => pair[1] !== null);
        for (const [attribute, value] of values) {
          // A fragment and an inline `data:` image request nothing.
          if (value.startsWith('#') || value.startsWith('data:')) continue;
          if (attribute === 'href' && value === INTRO_URL && element.tagName === 'A') {
            closeLinks++;
            continue;
          }
          if (isAllowedGuideLink(element, attribute, value)) {
            guideLinks++;
            continue;
          }
          expectInternal(value, `${name}: ${attribute}`);
        }
        const style = element.getAttribute('style');
        if (style) {
          for (const url of cssAddresses(style, pagePath)) expectInternal(url, `${name}: style`);
        }
        if (element.tagName === 'META') {
          const content = element.getAttribute('content') ?? '';
          if (ADDRESS.test(content)) expectInternal(content, `${name}: meta content`);
        }
        if (element.tagName === 'ASTRO-ISLAND') {
          const props: unknown = JSON.parse(element.getAttribute('props') ?? '{}');
          for (const url of propAddresses(props)) expectInternal(url, `${name}: island props`);
        }
        if (element.tagName === 'LINK' && element.getAttribute('rel') === 'stylesheet') {
          sheets.add(element.getAttribute('href')!);
        }
      }
      expect(closeLinks, name).toBe(1);
      // Inline scripts and styles name no address outside the app either.
      for (const inline of document.querySelectorAll('script:not([src])')) {
        for (const [url] of (inline.textContent ?? '').matchAll(/["'`(]\/(?!\/)[^"'`)\s]*/g)) {
          expectInternal(url.slice(1), `${name}: inline script`);
        }
      }
      for (const inline of document.querySelectorAll('style')) {
        for (const url of cssAddresses(inline.textContent ?? '', pagePath)) {
          expectInternal(url, `${name}: <style>`);
        }
      }
    }
    expect(guideLinks).toBeGreaterThan(0);
    // The linked stylesheets: their url() and @import addresses.
    expect(sheets.size).toBeGreaterThan(0);
    for (const sheet of sheets) {
      expectInternal(sheet, 'stylesheet link');
      const css = readFileSync(join(SITE_DIST, sheet.slice(DOCS_BASE.length + 1)), 'utf8');
      for (const url of cssAddresses(css, sheet)) expectInternal(url, sheet);
    }
  });

  it('no built page or script chunk names the stories’ image host; the image is served inline', () => {
    const files = [
      ...allPages(),
      ...readdirSync(join(SITE_DIST, '_assets'))
        .filter((file) => file.endsWith('.js'))
        .map((file) => join(SITE_DIST, '_assets', file)),
    ];
    expect(files.length).toBeGreaterThan(82);
    const naming = files
      .filter((file) => readFileSync(file, 'utf8').includes(STORY_IMAGE_HOST))
      .map((file) => relative(SITE_DIST, file).replace(/\\/g, '/'));
    expect(naming).toEqual([]);

    // The stories that named it render the inline image, on the server and in their island.
    for (const slug of ['avatar', 'persona']) {
      const document = load(join(SITE_DIST, 'components', `${slug}.html`));
      const images = [...document.querySelectorAll('astro-island img')].map((image) =>
        image.getAttribute('src'),
      );
      expect(images, slug).toContain(AVATAR_IMAGE);
    }
    const islands = readdirSync(join(SITE_DIST, '_assets')).filter((file) =>
      /^(avatar|persona)\..*\.js$/.test(file),
    );
    expect(islands).toHaveLength(2);
    for (const file of islands) {
      expect(readFileSync(join(SITE_DIST, '_assets', file), 'utf8'), file).toContain(AVATAR_IMAGE);
    }
  });

  it('the h2 and h3 ids of every page are unique on the page', () => {
    for (const file of allPages()) {
      const document = load(file);
      const name = relative(SITE_DIST, file);
      for (const heading of document.querySelectorAll('h2[id], h3[id]')) {
        expect(
          document.querySelectorAll(`[id="${heading.id}"]`),
          `${name} #${heading.id}`,
        ).toHaveLength(1);
      }
    }
  });

  it('the index lists 80 links grouped by the 11 categories', () => {
    const document = load(INDEX_FILE);
    const article = content(document);
    const groups = [...article.querySelectorAll('section')].map((section) => ({
      category: normalise(section.querySelector('h2')?.textContent),
      links: [...section.querySelectorAll('a')].map((link) => ({
        href: link.getAttribute('href'),
        name: normalise(link.textContent),
      })),
    }));
    const categories = [...new Set(catalog.map((entry) => entry.category))];
    expect(categories).toHaveLength(11);
    expect(groups.map((group) => group.category)).toEqual(categories);
    expect(groups.flatMap((group) => group.links)).toEqual(
      catalog.map((entry) => ({ href: componentHref(entry.slug), name: entry.name })),
    );
    for (const group of groups) {
      expect(group.links.length).toBe(
        catalog.filter((entry) => entry.category === group.category).length,
      );
    }
    // No navigation entry is marked current on the index.
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it('the copy-code text of a page equals the source of its first story', () => {
    for (const entry of catalog) {
      const island = load(pageFile(entry)).querySelector(
        'astro-island[component-url*="ShellControls"]',
      );
      const props = JSON.parse(island!.getAttribute('props')!) as Record<string, [number, unknown]>;
      expect(props.copyText?.[1], entry.slug).toBe(
        extractStorySource(entry.storyFile, firstStory(entry)),
      );
    }
  });

  it('the description is escaped: a backtick span becomes code and angle brackets are text', () => {
    for (const entry of catalog) {
      const description = content(load(pageFile(entry))).querySelector('[data-description]')!;
      const tags = new Set([...description.querySelectorAll('*')].map((el) => el.tagName));
      for (const tag of tags) expect(['P', 'BR', 'CODE'], entry.slug).toContain(tag);
    }
    const button = content(load(pageFile(catalog.find((e) => e.slug === 'button')!)));
    const codes = [...button.querySelectorAll('[data-description] code')].map((c) => c.textContent);
    expect(codes).toContain('<button type="button">');
    expect(codes).toContain('<Button as="a" href="/docs">');
    // An angle bracket outside a backtick span is text too.
    const timePicker = content(load(pageFile(catalog.find((e) => e.slug === 'time-picker')!)));
    const arrow = [...timePicker.querySelectorAll('[data-description] p')]
      .flatMap((paragraph) => [...paragraph.childNodes])
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .find((text) => text?.includes(' -> '));
    expect(arrow).toBeDefined();
  });

  it('no unresolved "undefined" or "[object Object]" text appears in any page', () => {
    for (const file of allPages()) {
      const document = load(file);
      const name = relative(SITE_DIST, file);
      expect(document.body.textContent, name).not.toContain('[object Object]');
      for (const element of document.body.querySelectorAll('*')) {
        if (element.closest('pre, code, script, style')) continue;
        const own = [...element.childNodes]
          .filter((node) => node.nodeType === 3)
          .map((node) => node.textContent)
          .join('')
          .trim();
        expect(own, `${name}: <${element.tagName.toLowerCase()}>`).not.toBe('undefined');
        expect(own, `${name}: <${element.tagName.toLowerCase()}>`).not.toMatch(/\bNaN\b/);
        for (const attribute of element.getAttributeNames()) {
          const value = element.getAttribute(attribute)!;
          expect(value, `${name}: ${attribute}`).not.toBe('undefined');
          expect(value, `${name}: ${attribute}`).not.toContain('[object Object]');
        }
      }
    }
  });

  it('every page has a unique <title> and exactly one <main>', () => {
    const titles = new Map<string, string>();
    for (const file of allPages()) {
      const document = load(file);
      const name = relative(SITE_DIST, file);
      expect(document.querySelectorAll('main'), name).toHaveLength(1);
      expect(document.querySelectorAll('title'), name).toHaveLength(1);
      const text = normalise(document.title);
      expect(text.length, name).toBeGreaterThan(0);
      expect(titles.get(text), `${name} repeats the title of ${titles.get(text)}`).toBeUndefined();
      titles.set(text, name);
    }
    expect(normalise(load(pageFile(catalog[0]!)).title)).toBe(`${catalog[0]!.name} · WaveUI docs`);
  });

  it('the components index loads at most its recorded first-load JavaScript plus 2 KB', () => {
    // website/BUDGET.md records 97,599 B gzipped (scripts/measure-page.mjs): 96,790 B before the
    // search palette's shortcut listener and the preload list of its lazy chunk (+809 B). The full
    // budget check of every page is a later task; this guards the shell-only page, which every
    // page pays.
    const { totals, reactCoreChunks, reactDomClientChunks } = measurePage(INDEX_FILE);
    expect(totals.firstLoadGzip).toBeLessThanOrEqual(97_599 + 2_048);
    expect(reactCoreChunks).toHaveLength(1);
    expect(reactDomClientChunks).toHaveLength(1);
  });

  it("the palette chunk is not part of any page's first-load JavaScript", () => {
    const chunks = readdirSync(join(SITE_DIST, '_assets')).filter((file) =>
      /^SearchPalette\..*\.js$/.test(file),
    );
    expect(chunks).toHaveLength(1);
    const palette = `_assets/${chunks[0]}`;
    // A text only the palette's code holds.
    const marker = 'Search the docs';
    expect(readFileSync(join(SITE_DIST, palette), 'utf8')).toContain(marker);
    for (const file of allPages()) {
      const name = relative(SITE_DIST, file).replace(/\\/g, '/');
      const { firstLoad, later } = measurePage(file);
      const firstFiles = firstLoad.map((row) => row.file);
      expect(firstFiles, name).not.toContain(palette);
      // The page can load it later, when the palette is opened.
      expect(
        later.map((row) => row.file),
        name,
      ).toContain(palette);
      for (const chunk of firstFiles) {
        expect(readFileSync(join(SITE_DIST, chunk), 'utf8'), `${name}: ${chunk}`).not.toContain(
          marker,
        );
      }
      // No page asks the browser for it, nor for the index, up front.
      const html = readFileSync(file, 'utf8');
      expect(html, name).not.toContain('SearchPalette');
      expect(html, name).not.toContain('search-index.json');
    }
  });

  it('the search index is built: every component, prop and guide page, as the site reads them', () => {
    const file = join(SITE_DIST, '_assets', 'search-index.json');
    const text = readFileSync(file, 'utf8');
    expect(text).toBe(serialiseSearchIndex(readSearchIndex()));
    const entries = JSON.parse(text) as { kind: string; href: string }[];
    expect(entries.filter((entry) => entry.kind === 'component')).toHaveLength(80);
    // Every address it holds is a built page (with an anchor the page has).
    for (const entry of entries) {
      const [path, anchor] = entry.href.split('#');
      const page = join(SITE_DIST, `${path!.slice(DOCS_BASE.length + 1)}.html`);
      expect(existsSync(page), entry.href).toBe(true);
      if (anchor) expect(load(page).getElementById(anchor), entry.href).not.toBeNull();
    }
  });

  describe('the guide pages', () => {
    const guide = (key: keyof typeof GUIDE_FILES) => load(GUIDE_FILES[key]);
    const guideContent = (document: Document) =>
      document.querySelector('main article [data-guide-content]')!;

    it('each guide page has one h1, its "On this page" pane and no current navigation link', () => {
      const titles = {
        'getting-started': 'Getting started',
        theming: 'Theming',
        changelog: 'Changelog',
      };
      for (const [key, heading] of Object.entries(titles)) {
        const document = guide(key as keyof typeof GUIDE_FILES);
        const h1 = document.querySelectorAll('h1');
        expect(h1, key).toHaveLength(1);
        expect(normalise(h1[0]!.textContent), key).toBe(heading);
        expect(normalise(document.title), key).toBe(`${heading} · WaveUI docs`);
        const pane = document.querySelector('nav[aria-label="On this page"]')!;
        const links = [...pane.querySelectorAll('a')];
        const h2s = [...content(document).querySelectorAll('h2')];
        expect(h2s.length, key).toBeGreaterThan(0);
        expect(
          links.map((link) => [link.getAttribute('href'), normalise(link.textContent)]),
          key,
        ).toEqual(h2s.map((h2) => [`#${h2.id}`, normalise(h2.textContent)]));
        expect(document.querySelector('nav [aria-current]'), key).toBeNull();
        // The navigation's Guides group links to every guide page.
        for (const path of ['getting-started', 'theming', 'changelog', 'components']) {
          expect(
            document.querySelector(`nav[aria-label="Components"] a[href="${DOCS_BASE}/${path}"]`),
            `${key} -> ${path}`,
          ).not.toBeNull();
        }
      }
      const readmeH2s = (key: 'getting-started' | 'theming') =>
        [...content(guide(key)).querySelectorAll('h2')].map((h2) => normalise(h2.textContent));
      expect(readmeH2s('getting-started')).toEqual(README_SECTIONS['getting-started']);
      expect(readmeH2s('theming')).toEqual(README_SECTIONS.theming);
    });

    it('getting-started shows the install line and a minimal WaveProvider example taken from the README', () => {
      const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
      const fenced = [...readme.matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].map((m) => m[1]!);
      const codes = [...guideContent(guide('getting-started')).querySelectorAll('pre code')].map(
        (code) => code.textContent,
      );
      expect(codes).toContain('npm install @mortenbrudvik/waveui\n');
      const example = codes.find((code) => code?.includes('<WaveProvider theme="light">'));
      expect(example).toBeDefined();
      expect(fenced).toContain(example);
    });

    it('markdown raw HTML is escaped on the guide pages', () => {
      const allowed = new Set([...GUIDE_CONTENT_TAGS, 'section', 'time']);
      for (const key of Object.keys(GUIDE_FILES) as (keyof typeof GUIDE_FILES)[]) {
        const body = guideContent(guide(key));
        expect(body, key).not.toBeNull();
        for (const element of body.querySelectorAll('*')) {
          expect(allowed.has(element.tagName.toLowerCase()), `${key}: <${element.tagName}>`).toBe(
            true,
          );
          for (const attribute of element.getAttributeNames()) {
            expect(attribute, `${key}: ${element.tagName}`).not.toMatch(/^on/i);
          }
        }
      }
      // The changelog's "<status>, out of office" is text, not an element.
      const changelog = guideContent(guide('changelog'));
      expect(changelog.textContent).toContain('"<status>, out of office"');
      expect(changelog.querySelector('status')).toBeNull();
    });

    it('the changelog shows the 1.x releases, no 0.x one, and links to the whole file on GitHub', () => {
      const document = guide('changelog');
      const versions = [...content(document).querySelectorAll('h2')].map((h2) =>
        normalise(h2.textContent),
      );
      const expected = parseChangelog(readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8')).map(
        (section) => section.version,
      );
      expect(versions).toEqual(expected);
      expect(versions.slice(0, 2)).toEqual(['1.1.0', '1.0.0']);
      expect(versions.some((version) => version.startsWith('0.'))).toBe(false);
      // No 0.x section's heading, nor its first line (1.x text may name a 0.x version).
      expect(content(document).textContent).not.toMatch(/\[?0\.\d+\.\d+\]? - \d{4}/);
      expect(content(document).textContent).not.toContain('the 0.18.0 gate exceeded twelve');
      const link = guideContent(document).querySelector(`a[href="${CHANGELOG_URL}"]`);
      expect(normalise(link?.textContent)).toBe('whole changelog on GitHub');
    });

    it("the guides' links to other hosts go only to GitHub and npm, over https", () => {
      for (const key of Object.keys(GUIDE_FILES) as (keyof typeof GUIDE_FILES)[]) {
        for (const link of guideContent(guide(key)).querySelectorAll('a[href]')) {
          const href = link.getAttribute('href')!;
          if (href.startsWith('#') || href.startsWith(`${DOCS_BASE}/`)) continue;
          expect(isAllowedExternalLink(href), `${key}: ${href}`).toBe(true);
        }
      }
    });
  });

  describe('accessibility of a sample of pages (axe, without color contrast)', () => {
    beforeAll(() => {
      expect(axe.source.length).toBeGreaterThan(0);
    });

    it.each([
      'components.html',
      'components/button.html',
      'components/data-grid.html',
      'components/dialog.html',
      'getting-started.html',
      'theming.html',
      'changelog.html',
    ])('%s', async (page) => {
      const { window } = new JSDOM(readFileSync(join(SITE_DIST, page), 'utf8'), {
        runScripts: 'outside-only',
        pretendToBeVisual: true,
      });
      window.eval(axe.source);
      const run = (window as unknown as { axe: typeof axe }).axe.run(window.document, {
        rules: { 'color-contrast': { enabled: false } },
      });
      const results = await run;
      expect(results.passes.length).toBeGreaterThan(20);
      expect(
        results.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
        })),
      ).toEqual([]);
    });
  });
});
