import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot';
import { GUIDE_LINKS, README_SECTIONS, renderGuide } from './guides';

const README = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');

/** The HTML parsed, no script run. */
const parse = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body;

/** The fenced code blocks of a Markdown text, as their code. */
const fencedBlocks = (markdown: string) =>
  [...markdown.matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].map((match) => match[1]!);

describe('guide pages from the README', () => {
  it('getting-started shows the install line and a minimal WaveProvider example taken from the README', () => {
    const body = parse(renderGuide('getting-started').html);
    const codes = [...body.querySelectorAll('pre code')].map((code) => code.textContent);
    expect(codes).toContain('npm install @mortenbrudvik/waveui\n');
    const example = codes.find(
      (code) =>
        code?.includes('<WaveProvider') && code.includes("import '@mortenbrudvik/waveui/styles'"),
    );
    expect(example).toBeDefined();
    // Taken from the README as it is, not retyped.
    expect(fencedBlocks(README)).toContain(example);
    expect(fencedBlocks(README)).toContain('npm install @mortenbrudvik/waveui\n');
  });

  it("takes the README's install and first-use sections, and its theming sections, as h2s", () => {
    expect(README_SECTIONS['getting-started']).toEqual([
      'Requirements',
      'Installation',
      'Quick start',
    ]);
    expect(README_SECTIONS.theming).toEqual([
      'Themes and direction',
      'Brand colors and token overrides',
      'Customizing tokens',
    ]);
    for (const slug of ['getting-started', 'theming'] as const) {
      const { headings } = renderGuide(slug);
      expect(
        headings.filter((h) => h.depth === 2).map((h) => h.text),
        slug,
      ).toEqual(README_SECTIONS[slug]);
    }
    const theming = parse(renderGuide('theming').html).textContent!;
    expect(theming).toContain('createBrandTokens');
    expect(theming).toContain("dir: 'ltr'");
  });

  it('a fragment link goes to the guide page that has the heading, else to the README on GitHub', () => {
    const hrefs = [...parse(renderGuide('getting-started').html).querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toContain('#tailwind-css-4');
    expect(hrefs).toContain('/waveui/docs/theming#customizing-tokens');
    expect(hrefs).toContain(
      'https://github.com/mortenbrudvik/waveui/blob/main/README.md#styling-hooks',
    );
  });

  it('the navigation links of the guides', () => {
    expect(GUIDE_LINKS).toEqual([
      { id: 'getting-started', title: 'Getting started', href: '/waveui/docs/getting-started' },
      { id: 'theming', title: 'Theming', href: '/waveui/docs/theming' },
      { id: 'changelog', title: 'Changelog', href: '/waveui/docs/changelog' },
      { id: 'components', title: 'All components', href: '/waveui/docs/components' },
    ]);
  });
});
