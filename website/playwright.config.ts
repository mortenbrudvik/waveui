/**
 * The site's end-to-end tests (`npm run site:e2e`): the built site (`website/dist`, so
 * `npm run site:build` first) in Chromium, served by `e2e/server.mjs` as production serves it:
 * the app's `vercel.json` behind the homepage's one rewrite of `/waveui/docs/:path*`.
 *
 * - `e2e/server.spec.ts`: the routing (the trailing-slash rule, clean URLs, headers) and a crawl of
 *   every page's addresses through the front server.
 * - `e2e/behaviour.spec.ts`: scripts off, the theme, storage, right to left, the keyboard, phone
 *   width, the navigation without the shell island, reduced motion, console errors.
 * - `e2e/pages.spec.ts`: every page, at desktop width with every example hydrated (no focus trap,
 *   scroll lock or `inert` left behind) and at phone width (no horizontal scroll).
 * - `e2e/budget.spec.ts`: the first-load JavaScript of every page in a real browser, at
 *   1280×800 and 390×844, against 150,000 B gzipped (`budget-real-browser.json` lists the
 *   exceptions); `e2e/budget-teardown.ts` joins the two viewports' rows into
 *   `.cache/real-browser-budget.json`.
 *
 * Results, traces and screenshots of failures go to `.cache/playwright/` (git-ignored).
 *
 * Browsers: `npx playwright install chromium`. That command also prunes the browser builds of
 * other Playwright versions from the shared cache (`%LOCALAPPDATA%\ms-playwright` on Windows,
 * `~/.cache/ms-playwright` elsewhere); set `PLAYWRIGHT_BROWSERS_PATH` to keep this project's
 * browsers apart.
 */
import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS } from './scripts/real-browser-budget.mjs';

const PORT = 4400;
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  outputDir: '.cache/playwright/results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalTeardown: './e2e/budget-teardown.ts',
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...VIEWPORTS.desktop },
    },
  ],
  webServer: {
    command: `node e2e/server.mjs --port ${PORT}`,
    url: `${ORIGIN}/waveui/docs`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 30_000,
  },
});
