/**
 * The guide pages (`/waveui/docs/getting-started`, `/theming`, `/changelog`) and the navigation's
 * Guides group. Getting started and Theming are sections of the repository's README.md, taken as
 * written (picked here by their headings, never retyped) and rendered at build time by
 * `renderMarkdown`; the changelog page is `parseChangelog`'s. Build-time code, except the links.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot';
import { SHELL_IDS } from '../shell/ids';
import { GUIDE_LINKS } from '../shell/urls';
import { extractSections, renderMarkdown, Slugger, type RenderedMarkdown } from './markdown';

export { GUIDE_LINKS, type GuideLink } from '../shell/urls';

/** The guide pages made of README sections. */
export type ReadmeGuide = 'getting-started' | 'theming';

/**
 * The README's sections each page shows, by heading. Getting started: the install and first-use
 * sections (the requirements, the install line, the quick start with its minimal `WaveProvider`
 * app for either setup). Theming: the theming sections without "Color tokens", whose table sits in
 * raw HTML (`<details>`) that the guides show only as text; the page links to it on GitHub.
 */
export const README_SECTIONS: Readonly<Record<ReadmeGuide, readonly string[]>> = {
  'getting-started': ['Requirements', 'Installation', 'Quick start'],
  theming: ['Themes and direction', 'Brand colors and token overrides', 'Customizing tokens'],
};

/** How far each page's sections move up: Theming's are `###` sections of the README's Theming. */
const SHIFT: Readonly<Record<ReadmeGuide, number>> = { 'getting-started': 0, theming: 1 };

const GUIDE_HREF = (id: ReadmeGuide) => GUIDE_LINKS.find((link) => link.id === id)!.href;

const readReadme = () => readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');

function render(
  id: ReadmeGuide,
  readme: string,
  resolveFragment?: (fragment: string) => string | null,
): RenderedMarkdown {
  return renderMarkdown(extractSections(readme, README_SECTIONS[id]), {
    source: 'README.md',
    shift: SHIFT[id],
    slugger: new Slugger(Object.values(SHELL_IDS)),
    ...(resolveFragment ? { resolveFragment } : {}),
  });
}

/**
 * A README guide page's HTML and headings. A fragment link to a heading of the other README page
 * goes to that page; one to a heading neither page shows goes to the README on GitHub.
 */
export function renderGuide(id: ReadmeGuide, readme: string = readReadme()): RenderedMarkdown {
  const elsewhere = new Map<string, string>();
  for (const other of Object.keys(README_SECTIONS) as ReadmeGuide[]) {
    if (other === id) continue;
    for (const heading of render(other, readme).headings) {
      elsewhere.set(heading.id, `${GUIDE_HREF(other)}#${heading.id}`);
    }
  }
  return render(id, readme, (fragment) => elsewhere.get(fragment) ?? null);
}
