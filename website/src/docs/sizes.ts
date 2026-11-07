/**
 * Import sizes and the library version: the two build-measured facts of the status bar.
 *
 * The size of a component is what `scripts/verify-dist.mjs` prints for an import of only that
 * export (`measureImport`): a minified Vite build of `import { Name } from 'dist/index.mjs'` with
 * bare imports external, as a consumer's production bundle has it. This module does not
 * re-implement that measurement; it calls it, four exports at a time, and keeps the result.
 *
 * Rules:
 * - The result is keyed by `ComponentEntry.exportName` and holds the minified and gzip bytes.
 * - **Cache**: `website/.cache/import-sizes.json`, keyed by a hash of `dist/index.mjs` plus the
 *   sorted list of the dist files with their sizes. An unchanged dist measures nothing; a changed
 *   one discards the whole cache. A cache that is missing, unreadable or of another key is a miss,
 *   never an error.
 * - **Missing exports**: a name that `dist/index.mjs` does not export is reported in one error that
 *   lists every missing name, before anything is measured.
 * - `getLibraryVersion()` reads the `version` of the repository's root `package.json`
 *   (`REPO_ROOT`, src/repoRoot.ts, which also holds in the bundled build).
 *
 * Build-time code: it runs in Node and is never sent to the browser.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { measureImport } from '../../../scripts/verify-dist.mjs';
import { getCatalog } from '../catalog/catalog';
import { REPO_ROOT } from '../repoRoot';

/** The default cache file, git-ignored. */
const DEFAULT_CACHE_FILE = resolve(REPO_ROOT, 'website/.cache/import-sizes.json');

/** Probes measured at the same time; each is a Vite build. */
const CONCURRENCY = 4;

export interface ImportSize {
  /** Minified bytes of the import's bundle. */
  minified: number;
  /** The same bundle's gzip bytes. */
  gzip: number;
}

export interface ImportSizesOptions {
  /** The measurement; defaults to `measureImport` of `scripts/verify-dist.mjs`. Tests pass a spy. */
  measure?: typeof measureImport;
  /** Where the sizes are cached; defaults to `website/.cache/import-sizes.json`. */
  cacheFile?: string;
  /** The exports to measure; defaults to the `exportName` of every catalog entry. */
  names?: readonly string[];
}

interface CacheContents {
  key: string;
  sizes: Record<string, ImportSize>;
}

function listFiles(root: string, directory = root): string[] {
  const files: string[] = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) files.push(...listFiles(root, path));
    else files.push(path);
  }
  return files;
}

/** A hash of `dist/index.mjs` and of the sorted `path:size` list of every file in `dist`. */
function distKey(distDir: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(join(distDir, 'index.mjs')));
  const listing = listFiles(distDir)
    .map((path) => `${relative(distDir, path).split('\\').join('/')}:${statSync(path).size}`)
    .sort();
  hash.update('\n');
  hash.update(listing.join('\n'));
  return hash.digest('hex');
}

function readCache(cacheFile: string, key: string): Record<string, ImportSize> {
  try {
    const parsed = JSON.parse(readFileSync(cacheFile, 'utf8')) as Partial<CacheContents>;
    if (parsed.key === key && parsed.sizes && typeof parsed.sizes === 'object') return parsed.sizes;
  } catch {
    // A missing or damaged cache is a miss.
  }
  return {};
}

function writeCache(cacheFile: string, contents: CacheContents): void {
  try {
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, `${JSON.stringify(contents, null, 2)}\n`);
  } catch {
    // The cache is an optimisation: a read-only checkout still builds.
  }
}

/** The names `dist/index.mjs` exports, from its closing `export { a as B, … }` statement. */
function exportedNames(distDir: string): Set<string> {
  const code = readFileSync(join(distDir, 'index.mjs'), 'utf8');
  const names = new Set<string>();
  for (const statement of code.matchAll(/(?:^|\n)export\s*\{([^}]*)\}/g)) {
    for (const specifier of statement[1]!.split(',')) {
      const parts = specifier.trim().split(/\s+as\s+/);
      const exported = parts[parts.length - 1]!.trim();
      if (exported) names.add(exported);
    }
  }
  return names;
}

/** Runs `task` for each item, `limit` at a time, keeping the order of the results. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * The production import size of each component export, keyed by `ComponentEntry.exportName`.
 * Measures only what the cache for this dist lacks.
 *
 * @throws when `dist/index.mjs` does not export some of the names; the message lists them all.
 */
export async function getImportSizes(
  distDir: string,
  options: ImportSizesOptions = {},
): Promise<Record<string, ImportSize>> {
  const { measure = measureImport, cacheFile = DEFAULT_CACHE_FILE } = options;
  const wanted = [
    ...new Set(options.names ?? getCatalog().map((entry) => entry.exportName)),
  ].sort();

  const exported = exportedNames(distDir);
  const missing = wanted.filter((name) => !exported.has(name));
  if (missing.length > 0) {
    throw new Error(
      `dist/index.mjs does not export ${missing.length === 1 ? 'this name' : 'these names'}, so no import size can be measured: ${missing.join(', ')}`,
    );
  }

  const key = distKey(distDir);
  const cached = readCache(cacheFile, key);
  const toMeasure = wanted.filter((name) => !cached[name]);

  if (toMeasure.length > 0) {
    const measured = await mapLimited(toMeasure, CONCURRENCY, async (name) => {
      const { minified, gzip } = await measure(distDir, [name]);
      return { name, size: { minified, gzip } };
    });
    for (const { name, size } of measured) cached[name] = size;
    writeCache(cacheFile, { key, sizes: cached });
  }

  return Object.fromEntries(wanted.map((name) => [name, cached[name]!]));
}

/** The `version` of the repository's root `package.json`: the library's version. */
export function getLibraryVersion(): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}
