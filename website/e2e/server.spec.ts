/**
 * The deployment's routing, through `e2e/server.mjs`: the homepage's one rewrite in front of the
 * app's `vercel.json`. A page, link or asset that works on `astro preview` but not behind this
 * chain fails here (Review Focus #1 of the plan).
 *
 * The trailing-slash rule found (2026-11-08), asserted below so that a change is deliberate:
 *
 * - Through the homepage, `/waveui/docs/components/button/` (and `/waveui/docs/`) is a **404**.
 *   Vercel compiles a rewrite's `source` with path-to-regexp in strict mode, so the homepage's
 *   `/waveui/docs/:path*` does not match a path that ends in `/`, and the request never reaches
 *   the app. (It would become a redirect only if the homepage's own `vercel.json` said
 *   `trailingSlash: false`: redirects run before rewrites.)
 * - The app on its own answers it with a **308 to `/waveui/docs/components/button`**
 *   (`trailingSlash: false`), and `/waveui/docs/components/button.html` with a 308 to the same
 *   address (`cleanUrls`). The site's own links never end in `/` or `.html`; the crawl below
 *   requires every address to answer 200 without a redirect.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  test('the trailing-slash rule: a 404 through the homepage, a 308 from the app alone', async ({
    request,
  }) => {
    for (const path of [`${DOCS}/components/button/`, `${DOCS}/`, `${DOCS}/components/`]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }

    const servers = await startServers({ port: 0 });
    const app = await playwrightRequest.newContext({ baseURL: servers.appOrigin });
    try {
      const slash = await app.get(`${DOCS}/components/button/`, { maxRedirects: 0 });
      expect(slash.status()).toBe(308);
      expect(slash.headers().location).toBe(`${DOCS}/components/button`);
      const root = await app.get(`${DOCS}/`, { maxRedirects: 0 });
      expect(root.status()).toBe(308);
      expect(root.headers().location).toBe(DOCS);
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
    expect((await request.get(js!)).headers()['content-type']).toBe(
      'text/javascript; charset=utf-8',
    );
    const index = await request.get(`${DOCS}/_assets/search-index.json`);
    expect(index.headers()['cache-control']).not.toContain('immutable');
  });

  test('the server refuses a vercel.json key it does not implement', () => {
    const directory = mkdtempSync(join(tmpdir(), 'waveui-e2e-'));
    try {
      const file = join(directory, 'vercel.json');
      writeFileSync(file, JSON.stringify({ cleanUrls: true, redirects: [] }));
      expect(() => loadVercelConfig(file)).toThrow(/does not implement "redirects"/);
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
      const visit = (value: string | null | undefined, base: URL) => {
        if (!value || value.startsWith('#') || /^(data|mailto|tel|blob):/i.test(value)) return;
        const url = new URL(value, base);
        if (url.origin !== pageUrl.origin) {
          external.add(url.href);
          return;
        }
        url.hash = '';
        pending.push(check(request, url, follow, inFlight));
      };
      const scanCss = (text: string, base: URL) => {
        for (const match of text.matchAll(CSS_URL)) visit(match[2] ?? match[4], base);
      };
      const follow = (url: URL, body: string) => {
        if (url.pathname.endsWith('.css')) scanCss(body, url);
        if (url.pathname.endsWith('.js')) {
          for (const [, spec] of body.matchAll(RELATIVE_IMPORT)) visit(spec, url);
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
      for (const url of external) {
        // External links are never fetched; the build's gate allows only GitHub and npm in guides.
        expect(new URL(url).protocol, `${sitePage.name}: ${url}`).toBe('https:');
      }
    });
  }
});
