/**
 * The repository root, for the build-time modules that read the library's files (the stories, the
 * sources, `dist`, the root `package.json`). It is found by walking up to the `package.json` named
 * `@mortenbrudvik/waveui`, not by a fixed `../..` from the module: `astro build` bundles a page's
 * server code into `website/dist/.prerender/chunks/`, where a fixed path lands in `website/`
 * (no `stories`, and the site's own `package.json` with version 0.0.0).
 *
 * Build-time code: it runs in Node and is never sent to the browser.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@mortenbrudvik/waveui';

function isLibraryRoot(directory: string): boolean {
  const file = join(directory, 'package.json');
  if (!existsSync(file)) return false;
  try {
    return (JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown }).name === PACKAGE_NAME;
  } catch {
    return false;
  }
}

/** The nearest directory at or above `from` whose `package.json` is the library's. */
export function findRepoRoot(from: string): string {
  let directory = from;
  for (;;) {
    if (isLibraryRoot(directory)) return directory;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`no WaveUI repository above ${from} (a package.json named ${PACKAGE_NAME})`);
    }
    directory = parent;
  }
}

/** The repository root of this checkout. */
export const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
