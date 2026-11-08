/**
 * What the end-to-end specs share: the built pages, the two viewports and the waits for the
 * islands.
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

export const SITE_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DIST = join(SITE_ROOT, 'dist');

/** The app's prefix: every page and asset is under it. */
export const DOCS = '/waveui/docs';

export interface SitePage {
  /** The page as `check-budget.mjs` names it: `components/button`, `index`, `getting-started`. */
  name: string;
  /** Its address through the front server: `/waveui/docs/components/button`, `/waveui/docs`. */
  path: string;
}

/** Every page of the build, from `dist`'s HTML files (the `_assets` folder left out). */
export function sitePages(directory = DIST): SitePage[] {
  const pages = readdirSync(directory, { withFileTypes: true }).flatMap((item): SitePage[] => {
    const file = join(directory, item.name);
    if (item.isDirectory()) return item.name === '_assets' ? [] : sitePages(file);
    if (!item.name.endsWith('.html')) return [];
    const name = relative(DIST, file)
      .replaceAll('\\', '/')
      .replace(/\.html$/, '');
    return [{ name, path: name === 'index' ? DOCS : `${DOCS}/${name}` }];
  });
  return pages.sort((a, b) => a.name.localeCompare(b.name));
}

/** The desktop viewport of the budget and the page checks. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

/** A phone: 390×844 CSS pixels, touch, a mobile viewport. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
};

/** Waits until the shell island has hydrated: its controls are enabled. */
export async function waitForShell(page: Page): Promise<void> {
  await expect(
    page
      .getByRole('group', { name: 'Page commands' })
      .getByRole('button', { name: 'Search', exact: true }),
  ).toBeEnabled({ timeout: 15_000 });
}

/**
 * Scrolls every island into view in turn, so each `client:visible` example hydrates, waits until
 * none is left unhydrated (Astro removes an island's `ssr` attribute once it has hydrated), and
 * scrolls back to the top.
 */
export async function hydrateAllIslands(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(undefined)));
    for (const island of document.querySelectorAll('astro-island[ssr]')) {
      // An island is `display: contents`: its first child has the box.
      (island.firstElementChild ?? island).scrollIntoView({ block: 'center' });
      await frame();
      await frame();
    }
  });
  await page
    .waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0, null, {
      timeout: 30_000,
    })
    .catch(async () => {
      const left = await page.evaluate(() =>
        [...document.querySelectorAll('astro-island[ssr]')].map(
          (island) => island.getAttribute('component-url') ?? '?',
        ),
      );
      throw new Error(`islands still unhydrated after scrolling: ${left.join(', ')}`);
    });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.getElementById('main')?.scrollTo(0, 0);
  });
}
