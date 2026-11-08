/**
 * The deployment's routing, through `e2e/server.mjs`: the homepage (its `cleanUrls` and
 * `trailingSlash: false` redirects, copied in `HOMEPAGE_ROUTING` from the homepage repository's
 * `vercel.json`, then its one rewrite) in front of the app's `vercel.json`. A page, link or asset
 * that works on `astro preview` but not behind this chain fails here (Review Focus #1 of the plan).
 * The front server does not emulate the homepage's own global headers; the headers checked below
 * are the app's `vercel.json`'s.
 *
 * The trailing-slash rule, asserted below so that a change is deliberate:
 *
 * - Through the homepage, `/waveui/docs/components/button/`, `/waveui/docs/components/` and
 *   `/waveui/docs/` get a **308 to the address without the slash**, which then answers 200. The
 *   homepage's `trailingSlash: false` redirect does it: on Vercel redirects run before rewrites,
 *   and the homepage's rewrite source `/waveui/docs/:path*` (strict, as Vercel compiles sources)
 *   would not match a path that ends in `/` anyway.
 * - The app on its own (its `vercel.json` has `trailingSlash: false` too) answers the same 308;
 *   `.html` and `/index` addresses get a 308 to the clean address (`cleanUrls`, both projects).
 *   The site's own links never end in `/` or `.html`; the crawl below requires every address to
 *   answer 200 without a redirect.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test';
import { JSDOM } from 'jsdom';
import { INTRO_STUB_MARKER, loadVercelConfig, startServers } from './server.mjs';
import { DOCS, sitePages } from './site';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), geolocation=()',
};
const IMMUTABLE = 'public, max-age=31536000, immutable';

test.describe('routing behind the homepage rewrite', () => {
  test('the trailing-slash rule: a 308 to the address without the slash, then 200, through the homepage and from the app alone', async ({
    request,
  }) => {
    const slashed: [string, string][] = [
      [`${DOCS}/components/button/`, `${DOCS}/components/button`],
      [`${DOCS}/components/`, `${DOCS}/components`],
      [`${DOCS}/`, DOCS],
    ];
    for (const [from, to] of slashed) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers().location, from).toBe(to);
      const followed = await request.get(to, { maxRedirects: 0 });
      expect(followed.status(), to).toBe(200);
      expect(followed.headers()['content-type'], to).toBe('text/html; charset=utf-8');
    }

    const servers = await startServers({ port: 0 });
    const app = await playwrightRequest.newContext({ baseURL: servers.appOrigin });
    try {
      for (const [from, to] of slashed) {
        const response = await app.get(from, { maxRedirects: 0 });
        expect(response.status(), `app alone: ${from}`).toBe(308);
        expect(response.headers().location, `app alone: ${from}`).toBe(to);
        expect((await app.get(to, { maxRedirects: 0 })).status(), `app alone: ${to}`).toBe(200);
      }
    } finally {
      await app.dispose();
      await servers.close();
    }
  });

  test('clean URLs: .html and index addresses redirect to the clean one, which serves the page', async ({
    request,
  }) => {
    const redirects: [string, string][] = [
      [`${DOCS}/components/button.html`, `${DOCS}/components/button`],
      [`${DOCS}/index.html`, DOCS],
      [`${DOCS}/index`, DOCS],
      [`${DOCS}/components.html?x=1`, `${DOCS}/components?x=1`],
    ];
    for (const [from, to] of redirects) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status(), from).toBe(308);
      expect(response.headers().location, from).toBe(to);
    }
    for (const path of [DOCS, `${DOCS}/components`, `${DOCS}/components/data-grid`]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toBe('text/html; charset=utf-8');
    }
  });

  test('only /waveui/docs reaches the app; /waveui is the intro page; matching is case-sensitive', async ({
    request,
  }) => {
    for (const path of ['/', '/components/button', '/_assets/search-index.json', `/WaveUI/docs`]) {
      expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
    }
    const intro = await request.get('/waveui', { maxRedirects: 0 });
    expect(intro.status()).toBe(200);
    expect(await intro.text()).toContain(INTRO_STUB_MARKER);
  });

  test('security headers on pages and assets; hashed assets are immutable, the search index is not', async ({
    request,
  }) => {
    const page = await request.get(`${DOCS}/components/button`);
    const html = await page.text();
    const css = /href="(\/waveui\/docs\/_assets\/[^"]+\.css)"/.exec(html)?.[1];
    const js = /component-url="(\/waveui\/docs\/_assets\/[^"]+\.js)"/.exec(html)?.[1];
    expect(css && js).toBeTruthy();

    for (const path of [
      `${DOCS}/components/button`,
      css!,
      js!,
      `${DOCS}/_assets/search-index.json`,
    ]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        expect(response.headers()[key], `${path} ${key}`).toBe(value);
      }
    }
    expect(page.headers()['cache-control']).not.toContain('immutable');
    expect((await request.get(css!)).headers()['cache-control']).toBe(IMMUTABLE);
    expect((await request.get(js!)).headers()['cache-control']).toBe(IMMUTABLE);
    // What Vercel sends for a static `.js` file.
    expect((await request.get(js!)).headers()['content-type']).toBe(
      'application/javascript; charset=utf-8',
    );
    const index = await request.get(`${DOCS}/_assets/search-index.json`);
    expect(index.headers()['cache-control']).not.toContain('immutable');
  });

  test('the build settings of vercel.json are accepted and change no response', () => {
    const directory = mkdtempSync(join(tmpdir(), 'waveui-e2e-'));
    const file = join(directory, 'vercel.json');
    const routing = { cleanUrls: true, rewrites: [{ source: '/a', destination: '/b' }] };
    try {
      writeFileSync(file, JSON.stringify(routing));
      const without = loadVercelConfig(file);
      writeFileSync(
        file,
        JSON.stringify({
          ...routing,
          framework: null,
          installCommand: 'cd .. && npm ci',
          buildCommand: 'cd .. && npm run site:build',
          outputDirectory: 'dist',
        }),
      );
      expect(loadVercelConfig(file)).toEqual(without);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('the committed vercel.json builds the workspace from the repository root into dist', () => {
    // Vercel runs the commands in the Root Directory (website); the library and the site are
    // built by the root's scripts, so both commands go up one level first.
    const file = fileURLToPath(new URL('../vercel.json', import.meta.url));
    const config = JSON.parse(readFileSync(file, 'utf8'));
    expect(config).toMatchObject({
      framework: null,
      installCommand: 'cd .. && npm ci',
      buildCommand: 'cd .. && npm run site:build',
      outputDirectory: 'dist',
    });
    expect(() => loadVercelConfig(file)).not.toThrow();
  });

  test('the server refuses a vercel.json key it does not implement, at the top or in a rule', () => {
    const directory = mkdtempSync(join(tmpdir(), 'waveui-e2e-'));
    const file = join(directory, 'vercel.json');
    const load = (config: object) => {
      writeFileSync(file, JSON.stringify(config));
      return () => loadVercelConfig(file);
    };
    const rewrite = { source: '/waveui/docs/:path*', destination: '/:path*' };
    const header = { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] };
    try {
      expect(load({ cleanUrls: true, rewrites: [rewrite], headers: [header] })).not.toThrow();
      expect(load({ cleanUrls: true, redirects: [] })).toThrow(/does not implement "redirects"/);
      for (const key of ['has', 'missing', 'statusCode', 'permanent']) {
        expect(load({ rewrites: [{ ...rewrite, [key]: [] }] }), key).toThrow(
          new RegExp(`does not implement "${key}" in a rewrite`),
        );
        expect(load({ headers: [{ ...header, [key]: [] }] }), key).toThrow(
          new RegExp(`does not implement "${key}" in a headers rule`),
        );
      }
      expect(
        load({ headers: [{ source: '/(.*)', headers: [{ key: 'A', value: 'b', when: 1 }] }] }),
      ).toThrow(/does not implement "when" in a header/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/** Static and dynamic relative imports of a chunk, and Vite's preload list (`"_assets/x.js"`). */
const RELATIVE_IMPORT =
  /\b(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["'`](\.{1,2}\/[^"'`]+?)["'`]/g;
const DYNAMIC_IMPORT = /\bimport\(\s*["'`](\.{1,2}\/[^"'`]+?)["'`]\s*\)/g;
const PRELOAD_DEP = /["'`](_assets\/[^"'`\s]+\.(?:js|css|json))["'`]/g;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)|@import\s+(['"])([^'"]+)\3/g;

/** What the addresses an earlier crawl of this worker fetched answered: a problem, or `null`. */
const answered = new Map<string, string | null>();

/** The static imports (addresses) found in each script this worker's crawls followed. */
const staticImports = new Map<string, string[]>();

/**
 * Fetches `url` (once per worker) and returns a problem, or `null` when it answered as it should:
 * 200 with no redirect, or the intro stub for `/waveui`. Scripts and stylesheets are followed.
 * `inFlight` holds this crawl's requests, so an address the page names twice is fetched once.
 */
function check(
  request: APIRequestContext,
  url: URL,
  follow: (url: URL, body: string) => void,
  inFlight: Map<string, Promise<string | null>>,
): Promise<string | null> {
  const key = url.pathname + url.search;
  if (answered.has(key)) return Promise.resolve(answered.get(key) ?? null);
  let result = inFlight.get(key);
  if (!result) {
    result = (async () => {
      const response = await request.get(key, { maxRedirects: 0 });
      const status = response.status();
      const body = await response.text();
      let problem: string | null = null;
      if (url.pathname === '/waveui') {
        if (status !== 200 || !body.includes(INTRO_STUB_MARKER)) {
          problem = `${key} answered ${status}, not the intro page`;
        }
      } else if (status !== 200) {
        problem = `${key} answered ${status}`;
      } else {
        follow(url, body);
      }
      answered.set(key, problem);
      return problem;
    })();
    inFlight.set(key, result);
  }
  return result;
}

test.describe('every address of every page answers through the homepage rewrite', () => {
  for (const sitePage of sitePages()) {
    test(`crawl ${sitePage.name}`, async ({ request, baseURL }) => {
      const pageUrl = new URL(sitePage.path, baseURL);
      const response = await request.get(sitePage.path, { maxRedirects: 0 });
      expect(response.status(), `${sitePage.path} itself`).toBe(200);
      const html = await response.text();
      const { document } = new JSDOM(html, { url: pageUrl.href }).window;

      const pending: Promise<string | null>[] = [];
      const inFlight = new Map<string, Promise<string | null>>();
      const external = new Set<string>();
      const visit = (value: string | null | undefined, base: URL): string | undefined => {
        if (!value || value.startsWith('#') || /^(data|mailto|tel|blob):/i.test(value)) return;
        const url = new URL(value, base);
        if (url.origin !== pageUrl.origin) {
          external.add(url.href);
          return;
        }
        url.hash = '';
        pending.push(check(request, url, follow, inFlight));
        return url.pathname + url.search;
      };
      const scanCss = (text: string, base: URL) => {
        for (const match of text.matchAll(CSS_URL)) visit(match[2] ?? match[4], base);
      };
      const follow = (url: URL, body: string) => {
        if (url.pathname.endsWith('.css')) scanCss(body, url);
        if (url.pathname.endsWith('.js')) {
          const imports = [...body.matchAll(RELATIVE_IMPORT)].map(([, spec]) => visit(spec, url));
          staticImports.set(
            url.pathname + url.search,
            imports.filter((key): key is string => key !== undefined),
          );
          for (const [, spec] of body.matchAll(DYNAMIC_IMPORT)) visit(spec, url);
          for (const [, spec] of body.matchAll(PRELOAD_DEP)) visit(`${DOCS}/${spec}`, url);
        }
      };

      for (const element of document.querySelectorAll('*')) {
        for (const name of ['href', 'src', 'action', 'poster'])
          visit(element.getAttribute(name), pageUrl);
        for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) {
          visit(element.getAttribute(name), pageUrl);
        }
        for (const name of ['srcset', 'imagesrcset']) {
          for (const candidate of (element.getAttribute(name) ?? '').split(',')) {
            visit(candidate.trim().split(/\s+/)[0], pageUrl);
          }
        }
        const style = element.getAttribute('style');
        if (style) scanCss(style, pageUrl);
      }
      for (const style of document.querySelectorAll('style'))
        scanCss(style.textContent ?? '', pageUrl);

      // The crawl reached at least every link of the navigation (a guard against a scan that
      // silently finds nothing).
      expect(pending.length).toBeGreaterThan(
        document.querySelectorAll('#components-nav a[href]').length,
      );
      // Followed scripts and stylesheets add to `pending` while it settles.
      const problems: string[] = [];
      for (let index = 0; index < pending.length; index += 1) {
        const problem = await pending[index];
        if (problem) problems.push(problem);
      }
      expect(
        problems,
        `${sitePage.name}: addresses that fail through the homepage rewrite`,
      ).toEqual([]);
      // Scripts were really followed: the static imports of at least one island's component chunk
      // were requested, and every one of them answered 200.
      const islandImports = [...document.querySelectorAll('astro-island[component-url]')].flatMap(
        (island) =>
          staticImports.get(new URL(island.getAttribute('component-url')!, pageUrl).pathname) ?? [],
      );
      expect(
        islandImports.length,
        `${sitePage.name}: imports of the island chunks`,
      ).toBeGreaterThan(0);
      for (const key of islandImports) {
        expect(answered.get(key), `${sitePage.name}: ${key}`).toBeNull();
      }
      for (const url of external) {
        // External links are never fetched; the build's gate allows only GitHub and npm in guides.
        expect(new URL(url).protocol, `${sitePage.name}: ${url}`).toBe('https:');
      }
    });
  }
});
