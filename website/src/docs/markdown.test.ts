import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  extractSections,
  githubSlug,
  GUIDE_CONTENT_TAGS,
  isAllowedExternalLink,
  REPO_BLOB,
  renderMarkdown,
  Slugger,
} from './markdown';

/** The HTML parsed, no script run. */
const parse = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body;

const HOSTILE = [
  '## Title <img src=x onerror=alert(1)>',
  '',
  '<script>alert(1)</script>',
  '',
  '<details>',
  '<summary>More</summary>',
  '',
  'Inside.',
  '',
  '</details>',
  '',
  'Inline <b>bold</b> and <iframe src="https://evil.example"></iframe> and `<b>code</b>`.',
  '',
  '[x](javascript:alert(1)) [y](https://evil.example/) ![img](https://evil.example/a.png)',
  '',
  '[d](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==) [v](vbscript:msgbox(1)) [p](//evil.example/x) [J](JaVaScRiPt:alert(1)) <data:text/html,x>',
  '',
  '<style>body{display:none}</style>',
  '',
  '- [x] done',
].join('\n');

describe('renderMarkdown', () => {
  it('markdown raw HTML is escaped on the guide pages', () => {
    const { html } = renderMarkdown(HOSTILE, { source: 'README.md' });
    const body = parse(html);
    for (const element of body.querySelectorAll('*')) {
      expect(GUIDE_CONTENT_TAGS, element.outerHTML).toContain(element.tagName.toLowerCase());
      for (const name of element.getAttributeNames()) {
        expect(name, element.outerHTML).not.toMatch(/^on/i);
      }
    }
    for (const tag of ['script', 'img', 'iframe', 'style', 'details', 'summary', 'b', 'input']) {
      expect(body.querySelector(tag), tag).toBeNull();
    }
    // The markup shows as text.
    const text = body.textContent!;
    expect(text).toContain('<script>alert(1)</script>');
    expect(text).toContain('<details>');
    expect(text).toContain('<b>bold</b>');
    expect(text).toContain('<img src=x onerror=alert(1)>');
    expect(body.querySelector('code')?.textContent).toBe('<b>code</b>');
    // A link to another host, or with another scheme, is its text alone; an image its alt text.
    expect(body.querySelectorAll('a')).toHaveLength(0);
    expect(text).toContain('x');
    expect(text).toContain('img');
    // `data:`, `vbscript:`, any-case `javascript:` and a protocol-relative `//host` are text too,
    // and no attribute anywhere carries one.
    for (const word of ['d', 'v', 'p', 'J'])
      expect(text).toMatch(new RegExp(`(^|\\s)${word}(\\s|$)`));
    expect(body.querySelectorAll('[href], [src]')).toHaveLength(0);
    for (const element of body.querySelectorAll('*')) {
      for (const name of element.getAttributeNames()) {
        expect(element.getAttribute(name), name).not.toMatch(
          /data:|vbscript:|javascript:|\/\/evil/i,
        );
      }
    }
  });

  it('gives headings GitHub ids, deduplicated, and lists them', () => {
    const { html, headings } = renderMarkdown(
      '## Parts: `slotProps`\n\n### Without Tailwind (precompiled CSS)\n\n## Added\n\n## Added',
      { source: 'README.md' },
    );
    expect(headings).toEqual([
      { depth: 2, id: 'parts-slotprops', text: 'Parts: slotProps' },
      {
        depth: 3,
        id: 'without-tailwind-precompiled-css',
        text: 'Without Tailwind (precompiled CSS)',
      },
      { depth: 2, id: 'added', text: 'Added' },
      { depth: 2, id: 'added-1', text: 'Added' },
    ]);
    const body = parse(html);
    expect([...body.querySelectorAll('h2, h3')].map((h) => `${h.tagName}#${h.id}`)).toEqual([
      'H2#parts-slotprops',
      'H3#without-tailwind-precompiled-css',
      'H2#added',
      'H2#added-1',
    ]);
    expect(body.querySelector('h2 code')?.textContent).toBe('slotProps');
  });

  it('shifts heading levels and never goes above h2', () => {
    const { headings } = renderMarkdown('### Themes\n\n#### Detail\n\n# Top', {
      source: 'README.md',
      shift: 1,
    });
    expect(headings.map((h) => h.depth)).toEqual([2, 3, 2]);
  });

  it('a slugger skips the ids already on the page', () => {
    const slugger = new Slugger(['main']);
    const { headings } = renderMarkdown('## Main', { source: 'README.md', slugger });
    expect(headings[0]!.id).toBe('main-1');
  });

  it('resolves links: local fragments stay, others go to the page that has them or to GitHub', () => {
    const markdown = [
      '## Here',
      '',
      '[a](#here) [b](#elsewhere) [c](#nowhere) [d](docs/GUIDE.md) [e](./docs/x.md#part)',
      '[f](https://github.com/mortenbrudvik/waveui/issues) [g](https://www.npmjs.com/package/@mortenbrudvik/waveui)',
      '<https://github.com/mortenbrudvik/waveui> [h](http://github.com/x) [i](/absolute) [j](../outside.md)',
    ].join('\n');
    const { html } = renderMarkdown(markdown, {
      source: 'README.md',
      resolveFragment: (id) => (id === 'elsewhere' ? '/waveui/docs/theming#elsewhere' : null),
    });
    const links = [...parse(html).querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['a', '#here'],
      ['b', '/waveui/docs/theming#elsewhere'],
      ['c', `${REPO_BLOB}README.md#nowhere`],
      ['d', `${REPO_BLOB}docs/GUIDE.md`],
      ['e', `${REPO_BLOB}docs/x.md#part`],
      ['f', 'https://github.com/mortenbrudvik/waveui/issues'],
      ['g', 'https://www.npmjs.com/package/@mortenbrudvik/waveui'],
      ['https://github.com/mortenbrudvik/waveui', 'https://github.com/mortenbrudvik/waveui'],
    ]);
    // http, a path outside the app and a path above the repository are text only.
    expect(parse(html).textContent).toContain('h i j');
  });

  it('renders code blocks, tables and lists', () => {
    const { html } = renderMarkdown(
      '```bash\nnpm install x\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n1. one\n2. two',
      { source: 'README.md' },
    );
    const body = parse(html);
    expect(body.querySelector('pre code')?.textContent).toBe('npm install x\n');
    expect(body.querySelectorAll('table td')).toHaveLength(2);
    expect(body.querySelectorAll('ol li')).toHaveLength(2);
  });
});

describe('extractSections', () => {
  const README = [
    '# Name',
    '',
    '## One',
    '',
    'one',
    '',
    '```bash',
    '# not a heading',
    '```',
    '',
    '### One sub',
    '',
    'sub',
    '',
    '## Two',
    '',
    'two',
    '',
    '## Three',
    '',
    'three',
  ].join('\n');

  it('takes each named section with its subsections, in the file order', () => {
    const picked = extractSections(README, ['Three', 'One']);
    expect(picked).toContain('## One');
    expect(picked).toContain('# not a heading');
    expect(picked).toContain('### One sub');
    expect(picked).toContain('## Three');
    expect(picked).not.toContain('two');
    expect(picked.indexOf('## One')).toBeLessThan(picked.indexOf('## Three'));
  });

  it('fails for a section the file does not have', () => {
    expect(() => extractSections(README, ['Four'])).toThrow(/Four/);
  });
});

describe('links and ids', () => {
  it('githubSlug follows GitHub', () => {
    expect(githubSlug('Upgrading to 1.0')).toBe('upgrading-to-10');
    expect(githubSlug('Brand colors and token overrides')).toBe('brand-colors-and-token-overrides');
    expect(githubSlug('`ref` and `controlRef`')).toBe('ref-and-controlref');
  });

  it('allows only https links to GitHub and to npm', () => {
    expect(isAllowedExternalLink('https://github.com/mortenbrudvik/waveui/blob/main/x.md')).toBe(
      true,
    );
    expect(isAllowedExternalLink('https://www.npmjs.com/package/@mortenbrudvik/waveui')).toBe(true);
    expect(isAllowedExternalLink('https://github.com/microsoft/fluentui')).toBe(true);
    expect(isAllowedExternalLink('https://user@github.com/x')).toBe(false);
    expect(isAllowedExternalLink('http://github.com/mortenbrudvik/waveui')).toBe(false);
    expect(isAllowedExternalLink('https://keepachangelog.com/')).toBe(false);
    expect(isAllowedExternalLink('https://github.com.evil.example/mortenbrudvik/waveui')).toBe(
      false,
    );
  });
});
