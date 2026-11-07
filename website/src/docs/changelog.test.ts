import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../repoRoot';
import { CHANGELOG_URL, parseChangelog } from './changelog';

const CHANGELOG = readFileSync(join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');

/** The HTML parsed, no script run. */
const fragment = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body;

describe('parseChangelog', () => {
  it('parseChangelog returns 1.1.0 and 1.0.0 and no 0.x section', () => {
    const sections = parseChangelog(CHANGELOG);
    expect(sections.map(({ version, date }) => ({ version, date }))).toEqual([
      { version: '1.1.0', date: '2026-11-07' },
      { version: '1.0.0', date: '2026-11-03' },
    ]);
    for (const section of sections) {
      expect(section.html).not.toMatch(/0\.18\.1\] - |## \[0\./);
    }
    // The 1.0.0 section ends before the 0.18.1 heading.
    expect(fragment(sections[1]!.html).textContent).not.toContain('0.18.1] -');
  });

  it("renders each section's body as HTML: its subsections are h3s, its lists and code", () => {
    const [latest] = parseChangelog(CHANGELOG);
    const body = fragment(latest!.html);
    const subsections = [...body.querySelectorAll('h3')].map((h) => h.textContent);
    expect(subsections).toContain('Added');
    expect(subsections).toContain('Upgrading from 1.0');
    expect(body.querySelector('h1, h2')).toBeNull();
    expect(body.querySelectorAll('li').length).toBeGreaterThan(10);
    expect(body.querySelectorAll('code').length).toBeGreaterThan(10);
  });

  it('keeps only 1.x versions, in the file order, and reads a date that is not a date as text', () => {
    const markdown = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '- pending',
      '',
      '## [1.2.0] - 2027-01-02',
      '',
      '### Added',
      '',
      '- **New** thing',
      '',
      '## [1.0.1] - Not published',
      '',
      'Text.',
      '',
      '## [2.0.0] - 2028-01-01',
      '',
      '- later major',
      '',
      '## [0.9.0] - 2026-01-01',
      '',
      '- old',
    ].join('\n');
    const sections = parseChangelog(markdown);
    expect(sections.map((section) => [section.version, section.date])).toEqual([
      ['1.2.0', '2027-01-02'],
      ['1.0.1', 'Not published'],
    ]);
    expect(fragment(sections[0]!.html).querySelector('strong')?.textContent).toBe('New');
  });

  it('points relative links at the file on GitHub', () => {
    const sections = parseChangelog(CHANGELOG);
    const hrefs = sections.flatMap((section) =>
      [...fragment(section.html).querySelectorAll('a')].map((a) => a.getAttribute('href')!),
    );
    expect(hrefs).toContain('https://github.com/mortenbrudvik/waveui/blob/main/docs/ROADMAP.md');
    for (const href of hrefs) {
      expect(href, href).toMatch(/^(#|https:\/\/github\.com\/mortenbrudvik\/waveui\/)/);
    }
    expect(CHANGELOG_URL).toBe('https://github.com/mortenbrudvik/waveui/blob/main/CHANGELOG.md');
  });
});
