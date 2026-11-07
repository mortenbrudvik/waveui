/**
 * Whether `website/dist` holds a build of the current sources, for the tests of the built pages
 * (`tests/pages.test.ts`). Those tests read what `astro build` wrote; they never build it
 * themselves, so `npm run site:test` stays fast:
 *
 * - `npm run site:build` and then `npm run site:test` (CI's order) runs them;
 * - `npm run site:test:pages` builds the site and then runs only them;
 * - a plain `npm run site:test` without a build, or after a source changed since the build, skips
 *   them and names the reason in the skipped suite's title.
 *
 * With `WAVEUI_REQUIRE_PAGES=1` (CI and `site:test:pages`) a missing or stale build fails instead.
 *
 * "Stale" compares modification times: the build's `components.html` against the newest file of
 * the sources a page is built from (the site's `src`, its build plugins, config and skipped list,
 * the library's `src` without its tests, `stories/` and the library's `dist/index.mjs`, whose sizes
 * the status bar shows).
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../src/repoRoot';

export const SITE_DIST = join(REPO_ROOT, 'website', 'dist');

/** The build's index page; every build writes it with the component pages. */
const MARKER = join(SITE_DIST, 'components.html');

const SOURCES = [
  'website/src',
  'website/plugins',
  'website/astro.config.mjs',
  'website/skipped-stories.json',
  'src',
  'stories',
  'dist/index.mjs',
];

const IGNORED = /(^|[\\/])(__tests__|node_modules)([\\/]|$)|\.test\.[cm]?[jt]sx?$/;

function newestFile(path: string): { path: string; mtimeMs: number } | undefined {
  if (!existsSync(path) || IGNORED.test(path)) return undefined;
  const stats = statSync(path);
  if (!stats.isDirectory()) return { path, mtimeMs: stats.mtimeMs };
  let newest: { path: string; mtimeMs: number } | undefined;
  for (const name of readdirSync(path)) {
    const candidate = newestFile(join(path, name));
    if (candidate && (!newest || candidate.mtimeMs > newest.mtimeMs)) newest = candidate;
  }
  return newest;
}

export type BuiltSiteState = { ready: true } | { ready: false; reason: string };

/** Whether the built pages can be tested, and why not. */
export function builtSiteState(): BuiltSiteState {
  if (!existsSync(MARKER)) {
    return { ready: false, reason: 'website/dist has no build; run npm run site:build first' };
  }
  const built = statSync(MARKER).mtimeMs;
  for (const source of SOURCES) {
    const newest = newestFile(join(REPO_ROOT, source));
    if (newest && newest.mtimeMs > built) {
      const changed = newest.path.slice(REPO_ROOT.length).replace(/^[\\/]/, '');
      return {
        ready: false,
        reason: `website/dist is older than ${changed.replace(/\\/g, '/')}; run npm run site:build first`,
      };
    }
  }
  return { ready: true };
}

/** {@link builtSiteState}, which throws instead of skipping when `WAVEUI_REQUIRE_PAGES` is set. */
export function requireBuiltSiteUnlessOptional(): BuiltSiteState {
  const state = builtSiteState();
  if (!state.ready && process.env.WAVEUI_REQUIRE_PAGES) {
    throw new Error(`The built pages are required (WAVEUI_REQUIRE_PAGES): ${state.reason}`);
  }
  return state;
}
