/**
 * The first-load JavaScript of every page in a real browser (the spec's "Performance": every
 * script a page requests on a cold cache without scrolling or interacting, the shell included),
 * against 150,000 B gzipped, at 1280×800, 1920×1080 and 390×844.
 *
 * Per page and viewport: a fresh browser context (cold cache), the page loaded with no scrolling
 * or interaction; then the shell island's hydration (`client:idle`, so part of the first load),
 * `networkidle`, and a further 500 ms with no request in flight. Every response with a JavaScript
 * content type (or a `.js` address) counts, once per address, by the gzip size of its body at
 * zlib's default level, as `scripts/verify-dist.mjs` and the static gate measure; the page's
 * inline scripts are added (they are part of the HTML the browser runs before anything else, and
 * the static metric counts them too), so the two numbers compare. The static worst case
 * (`measure-page.mjs`'s `pageJsReport`, every example island counted) is recorded beside it.
 *
 * The rules are `scripts/real-browser-budget.mjs`'s (exceptions in `budget-real-browser.json`).
 * Each viewport is one test that measures the pages one after another (a step per page names it),
 * so the viewports run side by side and each measurement is alone in its context. Each test
 * writes its rows to `.cache/real-browser-budget/<viewport>.json`; `budget-teardown.ts` joins them
 * into `.cache/real-browser-budget.json`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, test, type Browser } from '@playwright/test';
import { pageJsReport } from '../scripts/measure-page.mjs';
import {
  checkRealBrowserBudget,
  readRealBrowserExceptions,
  REAL_BROWSER_LIMIT,
  VIEWPORTS,
} from '../scripts/real-browser-budget.mjs';
import { DIST, DOCS, SITE_ROOT, sitePages, waitForShell, type SitePage } from './site';

import { BUDGET_ROWS_DIR as ROWS_DIR } from './site';
const EXCEPTIONS = join(SITE_ROOT, 'budget-real-browser.json');
const QUIET_MS = 500;

export interface BudgetRow {
  page: string;
  viewport: keyof typeof VIEWPORTS;
  /** Inline scripts plus every JavaScript response, gzipped. */
  firstLoadGzip: number;
  /** The JavaScript responses alone. */
  requestedGzip: number;
  inlineGzip: number;
  /** How many JavaScript addresses the page requested. */
  scripts: number;
  /** The static gate's worst case (every island counted as first load). */
  staticFirstLoadGzip: number;
  /** `staticFirstLoadGzip - firstLoadGzip`: what the examples out of view did not load. */
  difference: number;
}

const isJavaScript = (url: string, contentType: string) =>
  /\bjavascript\b/i.test(contentType) || /\.m?js$/i.test(new URL(url).pathname);

async function measure(browser: Browser, sitePage: SitePage, viewport: keyof typeof VIEWPORTS) {
  const context = await browser.newContext(VIEWPORTS[viewport]);
  const page = await context.newPage();
  const scripts = new Map<string, Promise<number>>();
  const foreign: string[] = [];
  let inFlight = 0;
  let lastActivity = Date.now();
  page.on('request', () => {
    inFlight += 1;
    lastActivity = Date.now();
  });
  const settled = () => {
    inFlight -= 1;
    lastActivity = Date.now();
  };
  page.on('requestfinished', settled);
  page.on('requestfailed', settled);
  page.on('response', (response) => {
    const url = response.url();
    if (!isJavaScript(url, response.headers()['content-type'] ?? '')) return;
    if (!new URL(url).pathname.startsWith(`${DOCS}/_assets/`)) foreign.push(url);
    if (!scripts.has(url))
      scripts.set(
        url,
        response.body().then((body) => gzipSync(body).length),
      );
  });
  try {
    await page.goto(sitePage.path, { waitUntil: 'load' });
    await waitForShell(page);
    await page.waitForLoadState('networkidle');
    await expect
      .poll(() => inFlight === 0 && Date.now() - lastActivity >= QUIET_MS, {
        intervals: [50],
        timeout: 20_000,
      })
      .toBe(true);
    const scrolled = await page.evaluate(
      () => window.scrollY + (document.getElementById('main')?.scrollTop ?? 0),
    );
    expect(scrolled, `${sitePage.name} @ ${viewport} scrolled`).toBe(0);
    const sizes = await Promise.all(scripts.values());
    const html = readFileSync(join(DIST, `${sitePage.name}.html`), 'utf8');
    const report = pageJsReport(html, (path: string) => readFileSync(join(DIST, path)));
    const requestedGzip = sizes.reduce((total, size) => total + size, 0);
    const firstLoadGzip = report.totals.inlineGzip + requestedGzip;
    const row: BudgetRow = {
      page: sitePage.name,
      viewport,
      firstLoadGzip,
      requestedGzip,
      inlineGzip: report.totals.inlineGzip,
      scripts: sizes.length,
      staticFirstLoadGzip: report.totals.firstLoadGzip,
      difference: report.totals.firstLoadGzip - firstLoadGzip,
    };
    return { row, foreign };
  } finally {
    await context.close();
  }
}

// A failure names its pages in the message; a screenshot or trace of every context is no help.
test.use({ screenshot: 'off', trace: 'off' });

for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
  const { width, height } = VIEWPORTS[viewport].viewport;
  test(`first load in a real browser at ${viewport} (${width}×${height}) is at most ${REAL_BROWSER_LIMIT.toLocaleString('en-US')} B gzipped`, async ({
    browser,
  }) => {
    const pages = sitePages();
    test.setTimeout(pages.length * 15_000);
    const rows: BudgetRow[] = [];
    for (const sitePage of pages) {
      await test.step(`${sitePage.name} @ ${viewport}`, async () => {
        const { row, foreign } = await measure(browser, sitePage, viewport);
        expect(foreign, `${sitePage.name} @ ${viewport}: scripts outside ${DOCS}/_assets/`).toEqual(
          [],
        );
        rows.push(row);
      });
    }
    mkdirSync(ROWS_DIR, { recursive: true });
    writeFileSync(
      join(ROWS_DIR, `${viewport}.json`),
      `${JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
    const { problems, excepted } = checkRealBrowserBudget(
      rows,
      readRealBrowserExceptions(EXCEPTIONS),
    );
    for (const item of excepted) {
      test.info().annotations.push({
        type: 'exception',
        description: `${item.page} @ ${item.viewport}: ${item.measured.toLocaleString('en-US')} B (recorded ${item.recorded.toLocaleString('en-US')} B, headroom ${item.headroom.toLocaleString('en-US')} B)`,
      });
    }
    expect(problems, `the real-browser budget at ${viewport}`).toEqual([]);
  });
}
