/**
 * The budget and base-path gate (`scripts/check-budget.mjs`). Fixtures are small pages with
 * in-memory assets; their sizes come from incompressible filler, so a script's gzip size is
 * about the number asked for. The last suite runs the gate against the real build (`dist`),
 * following `test/builtSite.ts` for when that is possible.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { requireBuiltSiteUnlessOptional, SITE_DIST } from '../../test/builtSite';
import { checkPage, checkSite, LIMITS } from '../check-budget.mjs';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(SITE_ROOT, 'scripts', 'check-budget.mjs');
const A = '/waveui/docs/_assets';

/** A JavaScript comment that gzips to about `bytes` bytes. */
const filler = (bytes) => `/*${randomBytes(bytes).toString('base64')}*/`;

/** A page that passes every rule; `overrides` replace its parts. */
function pageHtml({
  html = '<html lang="en" dir="ltr">',
  head = '',
  body = '',
  scripts = [`<script type="module" src="${A}/a.js"></script>`],
  main = '<main><h1>Title</h1></main>',
  close = '<a href="/waveui">Close</a>',
} = {}) {
  return `<!DOCTYPE html>${html}<head><meta charset="utf-8"><title>T</title><link rel="stylesheet" href="${A}/a.css">${scripts.join('')}${head}</head><body><div>${close}${main}${body}</div></body></html>`;
}

const SMALL = { '_assets/a.js': 'export const a = 1;', '_assets/a.css': 'body{margin:0}' };

/** A reader of in-memory assets, throwing for a file the fixture lacks. */
const reader = (files) => (path) => {
  const content = files[path];
  if (content === undefined) throw new Error(`ENOENT: ${path}`);
  return Buffer.from(content);
};

const check = (html, files = SMALL, option) =>
  checkPage(html, reader({ ...SMALL, ...files }), option);

describe('checkPage', () => {
  it('a page under the limits passes', () => {
    const result = check(pageHtml());
    expect(result.problems).toEqual([]);
    expect(result.firstLoadGzip).toBeGreaterThan(0);
    expect(result.firstLoadGzip).toBeLessThan(LIMITS.firstLoadGzip);
    expect(result.totalGzip).toBe(result.firstLoadGzip);
  });

  it('first-load JS above 150 KB gz fails and names the largest script', () => {
    const files = {
      '_assets/big.js': filler(140_000),
      '_assets/a.js': `import './big.js';import './mid.js';${filler(5_000)}`,
      '_assets/mid.js': filler(20_000),
    };
    const result = check(pageHtml(), files);
    expect(result.firstLoadGzip).toBeGreaterThan(LIMITS.firstLoadGzip);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('first-load JavaScript');
    expect(result.problems[0]).toContain('150,000');
    expect(result.problems[0]).toContain('largest scripts: _assets/big.js');
  });

  it('the limits are 150,000 B and 250,000 B gzipped', () => {
    expect(LIMITS.firstLoadGzip).toBe(150_000);
    expect(LIMITS.totalGzip).toBe(250_000);
  });

  it('lazy scripts above 250 KB gz in total fail', () => {
    const files = {
      '_assets/a.js': `import('./lazy.js');${filler(10_000)}`,
      '_assets/lazy.js': filler(245_000),
    };
    const result = check(pageHtml(), files);
    expect(result.firstLoadGzip).toBeLessThan(LIMITS.firstLoadGzip);
    expect(result.totalGzip).toBeGreaterThan(LIMITS.totalGzip);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('everything the page can request');
    expect(result.problems[0]).toContain('250,000');
  });

  it('a data file the scripts name (the search index) counts in the total', () => {
    const files = {
      '_assets/a.js': `const u='/waveui/docs/_assets/search-index.json';${filler(10_000)}`,
      '_assets/search-index.json': JSON.stringify({
        text: randomBytes(245_000).toString('base64'),
      }),
    };
    const result = check(pageHtml(), files);
    expect(result.firstLoadGzip).toBeLessThan(LIMITS.firstLoadGzip);
    expect(result.totalGzip).toBeGreaterThan(LIMITS.totalGzip);
    expect(result.problems.join('\n')).toContain('everything the page can request');
    // A data file the scripts name but the build lacks is a problem of its own.
    const missing = check(pageHtml(), {
      '_assets/a.js': "const u='/waveui/docs/_assets/gone.json';",
    });
    expect(missing.problems.join('\n')).toContain('_assets/gone.json');
  });

  it('a script that the page requests but the build lacks fails', () => {
    const result = check(
      pageHtml({ scripts: [`<script type="module" src="${A}/missing.js"></script>`] }),
    );
    expect(result.problems.join('\n')).toContain('_assets/missing.js');
  });

  describe('an absolute URL outside /waveui/docs/ fails', () => {
    it.each([
      ['stylesheet', { head: '<link rel="stylesheet" href="https://cdn.example.com/x.css">' }],
      ['script', { scripts: ['<script src="https://cdn.example.com/x.js"></script>'] }],
      ['link', { body: '<a href="https://example.com/">out</a>' }],
      ['root-relative link outside the app', { body: '<a href="/other/page">out</a>' }],
      ['link without the base', { body: '<a href="components/button">relative</a>' }],
      ['image', { body: '<img alt="" src="https://example.com/a.png">' }],
      [
        'srcset',
        {
          body: `<img alt="" src="${A}/a.png" srcset="${A}/a.png 1x, https://example.com/b.png 2x">`,
        },
      ],
      ['form action', { body: '<form action="https://example.com/post"></form>' }],
      [
        'island URL',
        { body: '<astro-island component-url="https://example.com/c.js"></astro-island>' },
      ],
      [
        'island props',
        {
          body: '<astro-island props="{&quot;href&quot;:[0,&quot;https://example.com/a&quot;]}"></astro-island>',
        },
      ],
      [
        'inline style url()',
        { body: '<div style="background:url(https://example.com/a.png)"></div>' },
      ],
      ['style element @import', { head: '<style>@import "https://example.com/a.css";</style>' }],
      ['inline script path', { head: '<script>fetch("/elsewhere/data.json")</script>' }],
      [
        'meta content address',
        { head: '<meta property="og:image" content="https://example.com/a.png">' },
      ],
      ['http link', { body: '<a href="http://github.com/x">out</a>' }],
    ])('%s', (_name, parts) => {
      const result = check(pageHtml(parts));
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
    });

    it('a url() in a linked stylesheet', () => {
      const files = { '_assets/a.css': 'body{background:url("https://example.com/a.png")}' };
      expect(check(pageHtml(), files).problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
      const relative = { '_assets/a.css': 'body{background:url(../../elsewhere/a.png)}' };
      expect(check(pageHtml(), relative).problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
    });

    it('an address inside the app, a fragment and a data URI are fine', () => {
      const result = check(
        pageHtml({
          body: `<a href="/waveui/docs/components/button">b</a><a href="#top">t</a><img alt="" src="data:image/png;base64,AAAA"><div style="background:url(${A}/a.png)"></div>`,
        }),
        { '_assets/a.css': `body{background:url(a.png)}` },
      );
      expect(result.problems).toEqual([]);
    });

    it('allows the single Close link, and an https link to GitHub or npm only inside guide content', () => {
      const guide =
        '<div data-guide-content><p><a href="https://github.com/mortenbrudvik/waveui">g</a> <a href="https://www.npmjs.com/package/x">n</a></p></div>';
      expect(check(pageHtml({ body: guide })).problems).toEqual([]);
      const outside = check(
        pageHtml({ body: '<a href="https://github.com/mortenbrudvik/waveui">g</a>' }),
      );
      expect(outside.problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
      const otherHost = check(
        pageHtml({ body: '<div data-guide-content><a href="https://example.com/">x</a></div>' }),
      );
      expect(otherHost.problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
      const image = check(
        pageHtml({
          body: '<div data-guide-content><img alt="" src="https://github.com/a.png"></div>',
        }),
      );
      expect(image.problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
      // After the guide content closes, the allowance ends.
      const after = check(pageHtml({ body: `${guide}<a href="https://github.com/x">late</a>` }));
      expect(after.problems.join('\n')).toMatch(/outside \/waveui\/docs\//);
    });

    it('exactly one Close link is required', () => {
      expect(check(pageHtml({ close: '' })).problems.join('\n')).toContain('Close link');
      expect(
        check(
          pageHtml({ close: '<a href="/waveui">Close</a><a href="/waveui">Again</a>' }),
        ).problems.join('\n'),
      ).toContain('Close link');
      // The Close link is for anchors: a script may not hide behind it.
      expect(
        check(pageHtml({ scripts: ['<script src="/waveui"></script>'] })).problems.join('\n'),
      ).toMatch(/outside/);
    });
  });

  it('an iframe fails', () => {
    const result = check(pageHtml({ body: '<iframe src="/waveui/docs/x" title="x"></iframe>' }));
    expect(result.problems.join('\n')).toContain('<iframe>');
    // The word in escaped source text is not an element.
    expect(
      check(pageHtml({ body: '<pre><code>&lt;iframe src="x"&gt;</code></pre>' })).problems,
    ).toEqual([]);
  });

  describe('a font file or a Google Fonts link or an @font-face fails', () => {
    it.each([
      ['font file link', { head: `<link rel="preload" as="font" href="${A}/f.woff2">` }],
      ['font file in a style attribute', { body: `<div style="src:url(${A}/f.ttf)"></div>` }],
      [
        'Google Fonts stylesheet',
        { head: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">' },
      ],
      [
        'Google Fonts preconnect',
        { head: '<link rel="preconnect" href="https://fonts.gstatic.com">' },
      ],
      [
        '@font-face in a style element',
        { head: '<style>@font-face{font-family:X;src:local(X)}</style>' },
      ],
    ])('%s', (_name, parts) => {
      expect(check(pageHtml(parts)).problems.join('\n')).toMatch(/web font/);
    });

    it('@font-face and a font file in a linked stylesheet', () => {
      const face = check(pageHtml(), { '_assets/a.css': '@font-face{font-family:X;src:local(X)}' });
      expect(face.problems.join('\n')).toMatch(/web font/);
      const file = check(pageHtml(), { '_assets/a.css': `body{background:url(f.woff)}` });
      expect(file.problems.join('\n')).toMatch(/web font/);
    });
  });

  it('a page without lang and dir on html fails', () => {
    expect(check(pageHtml({ html: '<html dir="ltr">' })).problems.join('\n')).toContain('lang');
    expect(check(pageHtml({ html: '<html lang="en">' })).problems.join('\n')).toContain('dir');
    expect(check(pageHtml({ html: '<html lang="" dir="ltr">' })).problems.join('\n')).toContain(
      'lang',
    );
    expect(check(pageHtml({ html: '<html>' })).problems).toHaveLength(2);
  });

  it('two main elements fail, and so does none', () => {
    const two = check(pageHtml({ main: '<main>a</main><main>b</main>' }));
    expect(two.problems.join('\n')).toContain('<main>');
    const none = check(pageHtml({ main: '<div>a</div>' }));
    expect(none.problems.join('\n')).toContain('<main>');
  });

  it('a script or a modulepreload outside /waveui/docs/_assets/ fails', () => {
    const script = check(
      pageHtml({ scripts: ['<script type="module" src="/waveui/docs/x.js"></script>'] }),
      {
        'x.js': 'export {}',
      },
    );
    expect(script.problems.join('\n')).toContain('/waveui/docs/x.js');
    const preload = check(
      pageHtml({ head: '<link rel="modulepreload" href="/waveui/docs/x.js">' }),
      {
        'x.js': 'export {}',
      },
    );
    expect(preload.problems.join('\n')).toContain('/waveui/docs/x.js');
    const island = check(
      pageHtml({ body: '<astro-island component-url="/waveui/docs/x.js"></astro-island>' }),
      {
        'x.js': 'export {}',
      },
    );
    expect(island.problems.join('\n')).toContain('/waveui/docs/x.js');
  });

  it('a page, or a script it loads, that names i.pravatar.cc fails', () => {
    expect(
      check(pageHtml({ body: '<img alt="" src="/waveui/docs/i.pravatar.cc/a">' })).problems.join(
        '\n',
      ),
    ).toContain('i.pravatar.cc');
    const inScript = check(pageHtml(), { '_assets/a.js': 'const u="https://i.pravatar.cc/40";' });
    expect(inScript.problems.join('\n')).toContain('i.pravatar.cc');
  });

  describe('a documented exception', () => {
    const heavy = {
      '_assets/a.js': `import './big.js';`,
      '_assets/big.js': filler(155_000),
    };
    const measured = check(pageHtml(), heavy).firstLoadGzip;

    it('passes only when the measured number is not above the recorded one', () => {
      const exception = { firstLoadGzip: measured, reason: 'the page shows many components' };
      const same = check(pageHtml(), heavy, exception);
      expect(same.problems).toEqual([]);
      expect(same.excepted).toBe(true);
      const roomy = check(pageHtml(), heavy, { ...exception, firstLoadGzip: measured + 500 });
      expect(roomy.problems).toEqual([]);
      const regressed = check(pageHtml(), heavy, { ...exception, firstLoadGzip: measured - 1 });
      expect(regressed.problems).toHaveLength(1);
      expect(regressed.problems[0]).toContain('above its recorded');
      expect(regressed.problems[0]).toContain('budget-exceptions.json');
    });

    it('fails for a page that is now under the limit', () => {
      const result = check(pageHtml(), SMALL, { firstLoadGzip: 160_000, reason: 'once heavy' });
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0]).toContain('remove it');
    });

    it('does not excuse the 250 KB total or any other rule', () => {
      const result = check(
        pageHtml({ main: '<main>a</main><main>b</main>' }),
        {
          ...heavy,
          '_assets/lazy.js': filler(100_000),
          '_assets/a.js': `import './big.js';import('./lazy.js');`,
        },
        { firstLoadGzip: measured + 1_000, reason: 'x' },
      );
      const text = result.problems.join('\n');
      expect(text).toContain('everything the page can request');
      expect(text).toContain('<main>');
    });
  });
});

describe('checkSite and budget-exceptions.json', () => {
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** A temp site: pages by name, the assets of the fixtures, and an exceptions file. */
  function site({ pages, assets = SMALL, exceptions }) {
    const root = mkdtempSync(join(tmpdir(), 'waveui-budget-'));
    dirs.push(root);
    const dist = join(root, 'dist');
    for (const [path, content] of Object.entries(assets)) {
      mkdirSync(dirname(join(dist, path)), { recursive: true });
      writeFileSync(join(dist, path), content);
    }
    for (const [name, html] of Object.entries(pages)) {
      mkdirSync(dirname(join(dist, `${name}.html`)), { recursive: true });
      writeFileSync(join(dist, `${name}.html`), html);
    }
    const file = join(root, 'budget-exceptions.json');
    if (exceptions !== undefined)
      writeFileSync(file, typeof exceptions === 'string' ? exceptions : JSON.stringify(exceptions));
    return { dist, file };
  }

  const heavyAssets = {
    ...SMALL,
    '_assets/a.js': `import './big.js';`,
    '_assets/big.js': filler(155_000),
  };
  const heavyPage = { 'components/heavy': pageHtml(), components: pageHtml(), index: pageHtml() };
  const heavyMeasured = checkSite(
    site({ pages: heavyPage, assets: heavyAssets, exceptions: [] }).dist,
    undefined,
  ).pages.find((page) => page.page === 'components/heavy').firstLoadGzip;

  it('a page over the limit and not in the exceptions file fails', () => {
    const { dist, file } = site({ pages: heavyPage, assets: heavyAssets, exceptions: [] });
    const result = checkSite(dist, file);
    expect(result.problems).toHaveLength(3);
    expect(
      result.problems.every(
        (problem) => problem.startsWith('components') || problem.startsWith('index'),
      ),
    ).toBe(true);
    expect(result.problems[0]).toContain('first-load JavaScript');
  });

  it('a documented exception passes only when the measured number is not above the recorded one', () => {
    const entry = (firstLoadGzip) => [
      { page: 'components/heavy', firstLoadGzip, reason: 'many components' },
    ];
    const all = (firstLoadGzip) => ({
      pages: {
        'components/heavy': pageHtml(),
        components: pageHtml({ scripts: [] }),
        index: pageHtml({ scripts: [] }),
      },
      assets: heavyAssets,
      exceptions: entry(firstLoadGzip),
    });
    const ok = site(all(heavyMeasured));
    const passes = checkSite(ok.dist, ok.file);
    expect(passes.problems).toEqual([]);
    expect(passes.exceptions).toEqual([
      {
        page: 'components/heavy',
        recorded: heavyMeasured,
        measured: heavyMeasured,
        headroom: 0,
        reason: 'many components',
      },
    ]);
    const roomy = site(all(heavyMeasured + 700));
    expect(checkSite(roomy.dist, roomy.file).exceptions[0].headroom).toBe(700);
    const regressed = site(all(heavyMeasured - 1));
    const failing = checkSite(regressed.dist, regressed.file);
    expect(failing.problems).toHaveLength(1);
    expect(failing.problems[0]).toContain('above its recorded');
  });

  it('an exception for a page that is under the limit fails', () => {
    const { dist, file } = site({
      pages: { index: pageHtml(), components: pageHtml() },
      exceptions: [{ page: 'components', firstLoadGzip: 160_000, reason: 'once heavy' }],
    });
    const result = checkSite(dist, file);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('remove it');
  });

  it('an exception for a page the build does not have fails', () => {
    const { dist, file } = site({
      pages: { index: pageHtml() },
      exceptions: [{ page: 'components/gone', firstLoadGzip: 160_000, reason: 'once heavy' }],
    });
    const result = checkSite(dist, file);
    expect(result.problems.join('\n')).toContain('components/gone');
    expect(result.problems.join('\n')).toContain('no such page');
  });

  it('an exception without a reason, a duplicate and a malformed file fail', () => {
    const base = { pages: { index: pageHtml() } };
    const bad = (exceptions) =>
      checkSite(...Object.values(site({ ...base, exceptions }))).problems.join('\n');
    expect(bad([{ page: 'index', firstLoadGzip: 160_000, reason: '  ' }])).toContain('reason');
    expect(bad([{ page: 'index', firstLoadGzip: 160_000 }])).toContain('reason');
    expect(bad([{ page: 'index', firstLoadGzip: 'many', reason: 'x' }])).toContain('firstLoadGzip');
    expect(
      bad([
        { page: 'index', firstLoadGzip: 160_000, reason: 'a' },
        { page: 'index', firstLoadGzip: 160_000, reason: 'b' },
      ]),
    ).toContain('twice');
    expect(bad('{ not json')).toContain('budget-exceptions.json');
    expect(bad({ page: 'index' })).toContain('array');
  });

  it('lists the five largest first loads', () => {
    const { dist, file } = site({
      pages: { index: pageHtml(), components: pageHtml() },
      exceptions: [],
    });
    const result = checkSite(dist, file);
    expect(result.pages.map((page) => page.page).sort()).toEqual(['components', 'index']);
    expect(result.worst).toHaveLength(2);
    expect(result.worst[0].firstLoadGzip).toBeGreaterThanOrEqual(result.worst[1].firstLoadGzip);
  });

  it('the command line exits 1 with a clear message when there is no build', () => {
    const empty = mkdtempSync(join(tmpdir(), 'waveui-budget-'));
    dirs.push(empty);
    const run = spawnSync(process.execPath, [SCRIPT, empty], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('run npm run site:build first');
  });

  it('the command line prints the report and exits 1 on a problem, 0 on none', () => {
    const bad = site({ pages: { index: pageHtml({ html: '<html>' }) }, exceptions: [] });
    const failing = spawnSync(process.execPath, [SCRIPT, bad.dist, '--exceptions', bad.file], {
      encoding: 'utf8',
    });
    expect(failing.status).toBe(1);
    expect(failing.stdout).toContain('problems: 2');
    const good = site({ pages: { index: pageHtml() }, exceptions: [] });
    const passing = spawnSync(process.execPath, [SCRIPT, good.dist, '--exceptions', good.file], {
      encoding: 'utf8',
    });
    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('problems: 0');
  });
});

const state = requireBuiltSiteUnlessOptional();
describe.skipIf(!state.ready)(
  state.ready ? 'the real build' : `the real build (skipped: ${state.reason})`,
  () => {
    it('breaks no limit and no rule with the committed budget-exceptions.json', () => {
      const result = checkSite(SITE_DIST, join(SITE_ROOT, 'budget-exceptions.json'));
      expect(result.pages.length).toBeGreaterThanOrEqual(85);
      expect(result.problems).toEqual([]);
    }, 120_000);
  },
);
