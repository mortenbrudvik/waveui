import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { measureImport } from '../../../scripts/verify-dist.mjs';
import { getCatalog } from '../catalog/catalog';
import { getImportSizes, getLibraryVersion } from './sizes';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIST = join(REPO_ROOT, 'dist');

/** Each probe is a Vite build: the 80 measurements of a cold run take minutes. */
const SLOW = 600_000;

let scratch: string;
let cacheFile: string;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'wave-sizes-test-'));
  cacheFile = join(scratch, 'import-sizes.json');
});

afterEach(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('getImportSizes', () => {
  it(
    'Button matches the number verify-dist prints for the same import',
    async () => {
      const expected = await measureImport(DIST, ['Button']);
      const measure = vi.fn(measureImport);
      const sizes = await getImportSizes(DIST, { measure, cacheFile, names: ['Button'] });
      expect(sizes.Button).toEqual({ minified: expected.minified, gzip: expected.gzip });
      expect(measure).toHaveBeenCalledWith(DIST, ['Button']);
    },
    SLOW,
  );

  it(
    'a second call with an unchanged dist reads the cache and measures nothing',
    async () => {
      const measure = vi.fn(measureImport);
      const options = { measure, cacheFile, names: ['Button', 'Badge'] };
      const first = await getImportSizes(DIST, options);
      expect(measure).toHaveBeenCalledTimes(2);

      measure.mockClear();
      const second = await getImportSizes(DIST, options);
      expect(measure).not.toHaveBeenCalled();
      expect(second).toEqual(first);
    },
    SLOW,
  );

  it('an export missing from the entry is reported by name', async () => {
    const measure = vi.fn(measureImport);
    const error = await getImportSizes(DIST, {
      measure,
      cacheFile,
      names: ['Button', 'NoSuchComponent', 'AnotherMissingOne'],
    }).then(
      () => undefined,
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('NoSuchComponent');
    expect(error?.message).toContain('AnotherMissingOne');
    expect(error?.message).not.toContain('Button');
    expect(measure).not.toHaveBeenCalled();
  });

  it(
    'all 80 catalog exports measure',
    async () => {
      const catalog = getCatalog();
      expect(catalog).toHaveLength(80);
      const measure = vi.fn(measureImport);

      const started = Date.now();
      const sizes = await getImportSizes(DIST, { measure, cacheFile });
      const coldSeconds = (Date.now() - started) / 1000;

      for (const entry of catalog) {
        const size = sizes[entry.exportName];
        expect(size, entry.exportName).toBeDefined();
        expect(size!.minified, entry.exportName).toBeGreaterThan(0);
        expect(size!.gzip, entry.exportName).toBeGreaterThan(0);
        expect(size!.gzip, entry.exportName).toBeLessThan(size!.minified);
      }

      measure.mockClear();
      const warmStarted = Date.now();
      const again = await getImportSizes(DIST, { measure, cacheFile });
      const warmMs = Date.now() - warmStarted;
      expect(measure).not.toHaveBeenCalled();
      expect(again).toEqual(sizes);

      const ranked = catalog
        .map((entry) => ({ name: entry.exportName, gzip: sizes[entry.exportName]!.gzip }))
        .sort((a, b) => a.gzip - b.gzip);
      console.info(
        `import sizes: cold ${coldSeconds.toFixed(1)} s, warm ${warmMs} ms; smallest ${ranked[0]!.name} ${ranked[0]!.gzip} B gzip, largest ${ranked.at(-1)!.name} ${ranked.at(-1)!.gzip} B gzip`,
      );
    },
    SLOW,
  );
});

describe('getLibraryVersion', () => {
  it('getLibraryVersion equals the root package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(getLibraryVersion()).toBe(pkg.version);
    expect(getLibraryVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
